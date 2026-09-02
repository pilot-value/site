/* ═══════════════════════════════════════════════════════════════════
   lang-toggle 回帰テスト

   1) 静的不変条件 — lang-toggle.js の allowlist が en/ の実ファイルと完全一致すること。
      ここがズレると「EN版が無い社へ飛ばす→404」＋「pv-lang='en' が保存済みなので
      毎回そこへ自動リダイレクトされる」という詰み状態になる。
      （以前はこれを「EN版が無い1社」をブラウザで踏んで確認していたが、
       116社すべてに EN 版が出来た今その被験体が存在しないので、
       全件を集合比較する形に強化した。標本1件より強い。）

   2) 往復 — JP⇄EN をボタンで行き来できること。
      オーナー報告「英語版にしたあと日本語版にもどらない」の回帰テスト。
      原因は index.html / en/index.html に直書きされていた <button id="lang-toggle">
      （EN 面でも pv-lang='en' を保存して /en/ ＝自分自身へ飛んでいた）。
   ═══════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/%20/g, ' ');
const BASE = 'http://localhost:3000';

let fail = 0;
let ran = 0;
const ok = (cond, name, detail = '') => {
  ran++;
  if (!cond) fail++;
  console.log(`${cond ? '✓' : '✗ FAIL'}  ${name}${detail ? `\n        → ${detail}` : ''}`);
};

/* ── 1) 静的不変条件：allowlist ≡ 実ファイル ───────────────────────── */
const src = fs.readFileSync(path.join(ROOT, 'lang-toggle.js'), 'utf8');
const parseSet = (tag) => {
  const m = src.match(new RegExp(`${tag}:BEGIN[\\s\\S]*?\\[([\\s\\S]*?)\\][\\s\\S]*?${tag}:END`));
  if (!m) return null;
  return new Set([...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
};
const diff = (a, b) => [...a].filter((x) => !b.has(x));

const enAirlinesDisk = new Set(
  fs.readdirSync(path.join(ROOT, 'en/airlines')).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, ''))
);
const enPagesDisk = new Set(
  fs.readdirSync(path.join(ROOT, 'en')).filter((f) => f.endsWith('.html') && f !== 'index.html')
);

const enCountriesDisk = new Set(
  fs.existsSync(path.join(ROOT, 'en/countries'))
    ? fs.readdirSync(path.join(ROOT, 'en/countries')).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, ''))
    : []
);

const enAirlinesList = parseSet('EN-AIRLINES');
const enPagesList = parseSet('EN-PAGES');
const enCountriesList = parseSet('EN-COUNTRIES');

ok(!!enAirlinesList, 'EN-AIRLINES ブロックを読める');
ok(!!enPagesList, 'EN-PAGES ブロックを読める');
ok(!!enCountriesList, 'EN-COUNTRIES ブロックを読める');

if (enAirlinesList) {
  const missing = diff(enAirlinesDisk, enAirlinesList); // 実在するのに allowlist に無い＝EN へ飛べない
  const ghost = diff(enAirlinesList, enAirlinesDisk);   // allowlist にあるのに実在しない＝404 の罠
  ok(ghost.length === 0, `EN-AIRLINES に実在しない社が無い (${enAirlinesList.size}件)`,
     ghost.length ? `404になる: ${ghost.join(', ')}` : '');
  ok(missing.length === 0, `en/airlines の実ファイルが全て allowlist に載っている (${enAirlinesDisk.size}枚)`,
     missing.length ? `EN へ飛べない: ${missing.join(', ')}` : '');
}
if (enPagesList) {
  const ghost = diff(enPagesList, enPagesDisk);
  const missing = diff(enPagesDisk, enPagesList);
  ok(ghost.length === 0, `EN-PAGES に実在しないページが無い (${enPagesList.size}件)`,
     ghost.length ? `404になる: ${ghost.join(', ')}` : '');
  ok(missing.length === 0, `en/ の実ファイルが全て allowlist に載っている (${enPagesDisk.size}枚)`,
     missing.length ? `EN へ飛べない: ${missing.join(', ')}` : '');
}
if (enCountriesList) {
  const ghost = diff(enCountriesList, enCountriesDisk);
  const missing = diff(enCountriesDisk, enCountriesList);
  ok(ghost.length === 0, `EN-COUNTRIES に実在しない国が無い (${enCountriesList.size}件)`,
     ghost.length ? `404になる: ${ghost.join(', ')}` : '');
  ok(missing.length === 0, `en/countries の実ファイルが全て allowlist に載っている (${enCountriesDisk.size}枚)`,
     missing.length ? `EN へ飛べない: ${missing.join(', ')}` : '');
}

/* ── 2) ブラウザ：往復・自動リダイレクト・二重注入 ─────────────────── */
const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

/* localStorage は同一オリジンで共有されるので、まず素のパスを開いて直接書いてから
   本番URLへ遷移する。evaluateOnNewDocument で仕込むと「以後の全遷移」で発火し続け、
   クリックハンドラが書いた pv-lang を毎回消してしまう（＝テスト側の事故）。 */
async function open(url, savedLang) {
  await page.goto(`${BASE}/blank-seed`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.evaluate((lang) => {
    try {
      if (lang) localStorage.setItem('pv-lang', lang);
      else localStorage.removeItem('pv-lang');
    } catch (e) {}
  }, savedLang);
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 700)); // location.replace / 動的 inject の落ち着き待ち
}

async function state() {
  return page.evaluate(() => {
    const els = document.querySelectorAll('#lang-toggle');
    return {
      count: els.length,
      label: els[0] ? els[0].textContent.trim() : null,
      saved: (() => { try { return localStorage.getItem('pv-lang'); } catch (e) { return null; } })(),
    };
  });
}

async function clickToggle() {
  await page.evaluate(() => document.getElementById('lang-toggle').click());
  await page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 500));
}

/* --- トップページ往復（報告された不具合そのもの） --- */
await open(`${BASE}/`, null);
let s = await state();
ok(s.count === 1, 'JP トップ: #lang-toggle がちょうど1個', `count=${s.count} label="${s.label}"`);
await clickToggle();
ok(page.url().replace(/index\.html$/, '').endsWith('/en/'), 'JP トップ → クリック → /en/ へ', `url=${page.url()}`);

s = await state();
ok(s.count === 1, 'EN トップ: #lang-toggle がちょうど1個', `count=${s.count} label="${s.label}"`);
await clickToggle();
const backJa = new URL(page.url()).pathname;
ok(backJa === '/' || backJa === '/index.html', '★EN トップ → クリック → 日本語トップへ戻る', `url=${page.url()}`);
ok((await state()).saved === 'ja', 'EN→JP のクリックで pv-lang が ja に更新される');

/* --- 保存言語による自動リダイレクト --- */
await open(`${BASE}/en/`, 'ja');
ok(['/', '/index.html'].includes(new URL(page.url()).pathname),
   "pv-lang='ja' で /en/ を開くと日本語トップへ戻される", `url=${page.url()}`);

await open(`${BASE}/`, 'en');
ok(new URL(page.url()).pathname.startsWith('/en'),
   "pv-lang='en' で / を開くと英語トップへ飛ぶ", `url=${page.url()}`);

/* --- 航空会社ページの往復 --- */
await open(`${BASE}/en/airlines/emirates.html`, null);
s = await state();
ok(s.count === 1, 'EN 航空会社ページ: #lang-toggle がちょうど1個', `count=${s.count}`);
await clickToggle();
ok(new URL(page.url()).pathname === '/airlines/emirates.html',
   'EN 航空会社ページ → クリック → JP 航空会社ページへ戻る', `url=${page.url()}`);

await clickToggle();
ok(new URL(page.url()).pathname === '/en/airlines/emirates.html',
   'JP 航空会社ページ → クリック → EN へ', `url=${page.url()}`);

/* --- 国別ハブページの往復（/countries/ の写像規則がある証明）--- */
if (enCountriesDisk.has('japan')) {
  await open(`${BASE}/countries/japan.html`, null);
  s = await state();
  ok(s.count === 1, 'JP 国別ページ: #lang-toggle がちょうど1個', `count=${s.count}`);
  await clickToggle();
  ok(new URL(page.url()).pathname === '/en/countries/japan.html',
     'JP 国別ページ → クリック → EN へ', `url=${page.url()}`);
  await clickToggle();
  ok(new URL(page.url()).pathname === '/countries/japan.html',
     'EN 国別ページ → クリック → JP へ戻る', `url=${page.url()}`);
}

/* --- ★英語を選んだ人が、日本語に落ちないこと（2026-09-02）--------------------
   ここまで pv-lang は「トグルを押した人」にしか付かなかった。英語版の画面に
   直接来た人は無印のままで、一度でも日本語側の URL を踏むとそこから先ずっと
   日本語だった。2026-09-01 に英語で給与を出したカンタスのパイロットがこの道。
   見るのは3つ ①英語の操作画面に来たら覚える ②日本語の URL を踏んでも英語に戻る
   ③検索から人が降りてくるページでは覚えない（日本語の人を巻き込まない）。 */
await open(`${BASE}/en/pay-report.html`, null);
ok((await state()).saved === 'en',
   '★英語の給与フォームに来ただけで pv-lang が en になる（トグルを押さなくても）');

await page.goto(`${BASE}/pay-report.html`, { waitUntil: 'load', timeout: 45000 });
await new Promise((r) => setTimeout(r, 700));
ok(new URL(page.url()).pathname === '/en/pay-report.html',
   '★その人が日本語の URL を踏んでも英語へ戻される', `url=${page.url()}`);

for (const [url, where] of [
  [`${BASE}/en/airlines/emirates.html`, '英語の航空会社ページ'],
  [`${BASE}/en/`,                       '英語のトップ'],
]) {
  await open(url, null);
  ok((await state()).saved === null,
     `★${where}に来ただけでは pv-lang を付けない（日本語の人を英語に閉じ込めない）`,
     `saved=${(await state()).saved}`);
}

/* --- ★言語を移すときにクエリとハッシュを捨てないこと -------------------------
   ?claim=（預かった給与の引換券）・?redirect=（ログイン後の戻り先）・?ref=（招待）が
   ここで消えていた。?ref= だけは pv-referral.js が読み込み時に localStorage へ
   写していたので無事だった＝**気づける形では壊れていなかった**ので長く残った。 */
for (const [from, want, desc] of [
  ['/login.html?redirect=%2Fpay-report.html', '/en/login.html?redirect=%2Fpay-report.html', 'ログイン後の戻り先'],
  ['/?ref=ABCD1234',                          '/en/?ref=ABCD1234',                          '招待コード'],
  ['/world-airlines.html?q=ana#list',          '/en/world-airlines.html?q=ana#list',          'クエリとハッシュの両方'],
]) {
  await open(`${BASE}${from}`, 'en');
  const u = new URL(page.url());
  ok(u.pathname + u.search + u.hash === want, `★${desc}を連れて英語へ移る  ${from} → ${want}`,
     `url=${u.pathname + u.search + u.hash}`);
}
await open(`${BASE}/en/login.html?redirect=%2Fen%2Fpay-report.html`, 'ja');
{
  const u = new URL(page.url());
  ok(u.pathname + u.search === '/login.html?redirect=%2Fen%2Fpay-report.html',
     '★日本語へ戻すときも同じく連れて行く', `url=${u.pathname + u.search}`);
}

await browser.close();

console.log(`\n==== ${ran - fail}/${ran} passed ====`);
process.exit(fail ? 1 : 0);
