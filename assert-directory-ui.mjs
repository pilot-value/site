/* ════════════════════════════════════════════════════════════════
   assert-directory-ui.mjs ── 航空会社一覧（world-airlines.html・en/world-airlines.html）を、
   手元の使い捨ての保存先（serve-local.mjs）に立ててブラウザで歩く検査（REAL LOCAL CONNECTION）。

   ★ 3000 番にも本番にも1回も通信しない。
     サーバーは local-chain.mjs の bring()（空いているポート・一時の保存先・解析タグは配る時に外す）、
     ページは local-chain.mjs の open()（門：手元と書体・部品の配信元 LIBS だけを通す。*.supabase.* は st.supa、
     ほかの行き先は st.blocked に書き留めて止める）で開く。
   ★ 期待する値は、ここ（Node）で台帳から作る ── SALARY（salary-data.mjs）と一覧の行（airlines-meta.js）。
     gen-directory.mjs・directory-model.mjs・ページの台本からは作らない（検査される側の答えを写さない）。
   ★ 待つのは条件だけ（時間では待たない）。
   ★ どの場面も最後に quiet(st, 場面) が空であること ── 一覧のページが開いているあいだ、
     サーバーの口（/rest/v1/rpc/…）を1本も呼ばない（QUIET_ALLOW に在る名前だけは呼んでよい。この一覧では空）。
     スクリプトの止まり（st.errs）と、手元の配信元からの 4xx も落ちる。

   場面 base（日英・1440×900）
     b1 見えているカード ＝ 台帳の112社を一覧の並び（地域の順 → 一覧の行の順）で・社数「112社」／«112 airlines»
     b2 地域のボタンを1つずつ押す → 見えているカード ＝ その地域の会社（集合）・社数・押したボタンだけ aria-pressed="true"
     b3 FSC → 一覧の行の type が fsc の会社・LCC/ULCC → lcc・免税 → SALARY の taxFree
     b4 レベリング比較 → 絞り込みの帯（#filter-bar）が消え、#lvl-wa-grid に4本の .lvl-col・カード一覧 → 戻る
     b5 テーマのボタンで data-theme が入れ替わる（もう1回で戻る）
     b6 古い地図：アジアに指を載せる → #map-tooltip に「アジア」／«Asia» と社数・押すと選ばれ、もう1回で外れる・
        ピンの8つの社数（#pc-…）＝ 地域の社数
     b7 検索欄に «emirates» → エミレーツが見えている・«zzzz» → 見つからない（#no-results）
     b8 ヘッダーの検索（#pv-search-btn）で «Solairus» → airlines/solairus.html へのリンクが出る
     b9 quiet(st, 'base') が空

   場面 first（日英・390×680 のスマホ）
     検索欄（#search）が最初の1画面の中・高さ 48px 以上・字 16px 以上・見出しと検索欄のあいだに押せるもの無し・
     見出し「次のキャリアを、選択する」／«Choose your next career»・結果の見出し「すべて」／«All»・
     開いたときは地域の札・解除・見つからないときのボタンを見せない・quiet が空
   場面 nojs（日英・台本を止める）
     112社のリンクが見えている・h2#wd-rh-name「すべて」／«All»・検索欄／絞り込みの帯／表示の切り替え／古い地図を見せない・quiet が空

   使い方: node assert-directory-ui.mjs [--scenes base,first,nojs] [--lang ja,en] [--shots <リポジトリの外のフォルダ>]
     --shots  名前の付いた段ごとに PNG を1枚（<scene>-<lang>-<段>.png）

   ほかの検査が読む名前（export）: dirOpen / ready / visible / QUIET_ALLOW / quiet
   ════════════════════════════════════════════════════════════════ */

import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bring, open } from './local-chain.mjs';
import { SALARY } from './salary-data.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* ── 共有の言葉（契約。台帳から作れないものだけここに書く）──────────────── */
/** 地域の8つの符号（この順が一覧の並び） */
const REG8 = ['japan', 'asia', 'mideast', 'africa', 'europe', 'us', 'oceania', 'latam'];
/** 地域の名前（日・英） */
const REGION_LABEL = {
  all: ['すべて', 'All'], japan: ['日本', 'Japan'], asia: ['アジア', 'Asia'], mideast: ['中東', 'Middle East'], africa: ['アフリカ', 'Africa'],
  europe: ['欧州', 'Europe'], us: ['北米', 'North America'], oceania: ['オセアニア', 'Oceania'], latam: ['中南米', 'Latin America'],
};
/** 社数の書き方 */
const COUNT = { ja: (n) => `${n}社`, en: (n) => `${n} airlines` };
/** 見出しの字（オーナーの字・進行役の決め C4） */
const H1 = { ja: '次のキャリアを、選択する', en: 'Choose your next career' };
/** 一覧の2枚のページ */
const PAGE_REL = { ja: 'world-airlines.html', en: 'en/world-airlines.html' };

/* ── 読む（台帳）──────────────────────────────────────────── */
/** 一覧の行（airlines-meta.js の window.PV_AIRLINES）。slug は PV_slugOf で */
function listRows() {
  const win = {};
  new Function('window', read('airlines-meta.js'))(win);
  return win.PV_AIRLINES.map((r) => ({ ...r, slug: win.PV_slugOf(r) }));
}
const LIST = listRows();
const POS = new Map(LIST.map((r, i) => [r.slug, i]));
const ROW = new Map(LIST.map((r) => [r.slug, r]));
const SLUGS = Object.keys(SALARY);
/** 一覧の並び（地域の順 → 一覧の行の順） */
const ORDER = SLUGS.slice().sort((a, b) => (REG8.indexOf(SALARY[a].region) - REG8.indexOf(SALARY[b].region))
  || ((POS.get(a) ?? 1e9) - (POS.get(b) ?? 1e9)));
const inRegion = (code) => SLUGS.filter((s) => code === 'all' || SALARY[s].region === code);
const listType = (s) => (ROW.get(s) || {}).type || '';

/* ── 道具（export）──────────────────────────────────────────── */
/** 一覧のページが今の文書のあいだに呼んでよいサーバーの口（この一覧では空） */
export const QUIET_ALLOW = [];

/** カードのリンクが描かれ、通貨の切り替え（currency.js）が立ち上がるまで */
export function ready(page) {
  return page.waitForFunction(() => window.PVCurrency && document.querySelectorAll('#airline-grid a[href^="airlines/"]').length > 0);
}

/** 見えているカードの slug（DOM の順） */
export function visible(page) {
  return page.evaluate(() => [...document.querySelectorAll('#airline-grid a[href^="airlines/"]')]
    .filter((a) => a.getClientRects().length > 0)
    .map((a) => a.getAttribute('href').replace(/^airlines\//, () => '').replace(/\.html$/, () => '')));
}

/** 一覧のページを、新しい窓（context）で開く。
    st.segs ＝ 主の枠が移るたびに { at: その時の st.calls の本数, dir: 一覧のページか }（quiet が「一覧が開いていたあいだの呼び出し」を切り分ける）
    st.http4 ＝ 手元の配信元が 4xx / 5xx で答えた要求 */
export async function dirOpen(browser, L, { rel = 'world-airlines.html', query = '', w = 1440, h = 900, touch = false, theme = null, js = true } = {}) {
  const o = await open(browser, L.base, { w, h, touch, theme });
  const { page, st } = o, origin = new URL(L.base).origin;
  st.segs = [];
  st.http4 = [];
  page.on('framenavigated', (f) => {
    if (f !== page.mainFrame()) return;
    let p = '';
    try { p = new URL(f.url()).pathname; } catch { p = ''; }
    st.segs.push({ at: st.calls.length, dir: /\/(en\/)?world-airlines\.html$/.test(p) });
  });
  page.on('response', (res) => {
    let u;
    try { u = new URL(res.url()); } catch { return; }
    if (u.origin === origin && res.status() >= 400) st.http4.push(`${res.status()} ${u.pathname}`);
  });
  if (js === false) await page.setJavaScriptEnabled(false);
  await page.goto(`${L.base}/${rel}${query}`, { waitUntil: js === false ? 'domcontentloaded' : 'load', timeout: 60000 });
  if (js !== false) await ready(page);
  return o;
}

/** 静かか（[] ＝ 静か）。外への通信（st.supa・st.blocked）と、一覧の文書が今だったあいだのサーバーの口の呼び出しで allow に無いもの */
export function quiet(st, label, { allow = QUIET_ALLOW } = {}) {
  const out = [...st.supa, ...st.blocked].map((x) => `${label}：外への通信 ${x}`);
  const segs = st.segs || [];
  st.calls.forEach((name, i) => {
    let seg = null;
    for (const s of segs) if (s.at <= i) seg = s;
    if (seg && seg.dir && !allow.includes(name)) out.push(`${label}：一覧のページがサーバーの口 ${name} を呼んだ（${i + 1}本目）`);
  });
  return out;
}

/* ── 実行（このファイルを直接流したときだけ）────────────────────── */
/* ⚠️ 実体のパスどうしで比べる。リンク越し（/tmp → /private/tmp、写しの中のリンク）で流すと、Node は argv[1] をリンクのまま・
   import.meta.url を実体で持つので、素の path.resolve では一致せず「何も流さず exit 0」＝検査の門が黙って緑になる */
const realOf = (p) => { try { return fs.realpathSync(path.resolve(p)); } catch { return path.resolve(p); } };
if (process.argv[1] && realOf(process.argv[1]) === realOf(fileURLToPath(import.meta.url))) await main();

async function main() {
  const argv = process.argv.slice(2);
  const val = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const SCENES = { base, first, nojs };
  const want = (val('--scenes') || Object.keys(SCENES).join(',')).split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = want.filter((s) => !SCENES[s]);
  if (unknown.length) { console.error(`✗ 知らない場面: ${unknown.join(', ')}（あるのは ${Object.keys(SCENES).join(', ')}）`); process.exit(2); }
  const LANGS = (val('--lang') || 'ja,en').split(',').map((s) => s.trim()).filter(Boolean);
  if (!LANGS.length || LANGS.some((l) => !PAGE_REL[l])) { console.error('✗ --lang は ja / en'); process.exit(2); }
  const SHOTS = val('--shots') ? path.resolve(val('--shots')) : '';
  if (SHOTS && (SHOTS + path.sep).startsWith(ROOT)) { console.error('✗ --shots はリポジトリの外に置く'); process.exit(2); }
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

  let pass = 0, fail = 0;
  const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? ' ' + e : ''))); };
  const J = (v) => { try { return JSON.stringify(v).slice(0, 400); } catch { return String(v); } };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const sameSet = (a, b) => same([...new Set(a)].sort(), [...new Set(b)].sort());

  const L = await bring();
  const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
  const PAGES = [];
  console.log(`手元の使い捨ての保存先 ${L.base}（REAL LOCAL CONNECTION・3000 番でも本番でもない）`);

  /* 条件がそろうまで待つ（上限つき。時間では待たない）。そろわなければ false */
  const until = (page, fn, ...args) => page.waitForFunction(fn, { timeout: 20000 }, ...args).then(() => true, () => false);
  const shot = async (page, scene, lang, name) => {
    if (!SHOTS) return;
    await page.screenshot({ path: path.join(SHOTS, `${scene}-${lang}-${name}.png`) });
  };
  const press = (page, sel) => page.click(sel);
  /* 検索欄に打つ（値を入れて input を1回） */
  const type = (page, s) => page.evaluate((s) => {
    const el = document.getElementById('search');
    el.value = s;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, s);
  const countText = (page) => page.evaluate(() => (document.getElementById('result-count') || {}).textContent || '');
  const pressed = (page) => page.evaluate(() => [...document.querySelectorAll('#region-strip .rstrip-btn')]
    .filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.region));
  const shown = (page, sel) => page.evaluate((sel) => { const el = document.querySelector(sel); return !!el && getComputedStyle(el).display !== 'none'; }, sel);
  /* 要素の上で、その要素そのものに当たる点（地図の形は四角でないので、当たる所を探す） */
  const pointIn = (page, sel) => page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    for (let iy = 1; iy < 24; iy++) for (let ix = 1; ix < 24; ix++) {
      const x = r.left + (r.width * ix) / 24, y = r.top + (r.height * iy) / 24;
      const hit = document.elementFromPoint(x, y);
      if (hit && hit.closest(sel)) return { x, y };
    }
    return null;
  }, sel);
  /* 滑らかなスクロールが止まるまで（2コマ続けて同じ位置） */
  const still = (page) => until(page, () => new Promise((res) => {
    const y = window.scrollY;
    requestAnimationFrame(() => requestAnimationFrame(() => res(window.scrollY === y)));
  }));

  async function base(lang) {
    const T = (s) => `[${lang}] ${s}`, C = COUNT[lang];
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang] });
    PAGES.push(P);
    const { page, st } = P;
    try {
      /* b1 */
      const v1 = await visible(page);
      ok(same(v1, ORDER), T(`b1 見えているカード ＝ 台帳の${ORDER.length}社を一覧の並びで`), J({ n: v1.length, first: v1.slice(0, 3) }));
      const c1 = await countText(page);
      ok(c1 === C(ORDER.length), T(`b1 社数「${C(ORDER.length)}」`), J(c1));
      await shot(page, 'base', lang, 'b1');

      /* b2 地域のボタン（すべて ＋ 8地域） */
      for (const code of ['all', ...REG8]) {
        await press(page, `#region-strip .rstrip-btn[data-region="${code}"]`);
        const exp = inRegion(code);
        const on = await until(page, (code) => {
          const b = document.querySelector(`#region-strip .rstrip-btn[data-region="${code}"]`);
          return !!b && b.getAttribute('aria-pressed') === 'true';
        }, code);
        const v = await visible(page), c = await countText(page), pr = await pressed(page);
        ok(on && sameSet(v, exp) && v.length === exp.length && c === C(exp.length) && same(pr, [code]),
          T(`b2 ${REGION_LABEL[code][lang === 'en' ? 1 : 0]} → その地域の${exp.length}社・社数「${C(exp.length)}」・押したボタンだけ aria-pressed="true"`),
          J({ n: v.length, c, pr }));
        if (code === 'europe') await shot(page, 'base', lang, 'b2-europe');
      }
      await press(page, '#region-strip .rstrip-btn[data-region="all"]');

      /* b3 種類（FSC・LCC/ULCC・免税 → すべて） */
      const TYPES = [
        ['fsc', 'FSC', SLUGS.filter((s) => listType(s) === 'fsc')],
        ['lcc', 'LCC/ULCC', SLUGS.filter((s) => listType(s) === 'lcc')],
        ['taxfree', '免税', SLUGS.filter((s) => SALARY[s].taxFree === true)],
        ['all', 'すべて', SLUGS],
      ];
      for (const [t, name, exp] of TYPES) {
        await press(page, `.ftype-btn[data-type="${t}"]`);
        const on = await until(page, (t) => { const b = document.querySelector(`.ftype-btn[data-type="${t}"]`); return !!b && b.classList.contains('active'); }, t);
        const v = await visible(page);
        ok(on && exp.length > 0 && sameSet(v, exp) && v.length === exp.length,
          T(`b3 ${name} → ${t === 'taxfree' ? 'SALARY の taxFree の' : t === 'all' ? '台帳の' : `一覧の行の type が ${t} の`}${exp.length}社`), J({ n: v.length }));
      }

      /* b4 レベリング比較 ⇄ カード一覧 */
      await press(page, '.view-btn[data-view="range"]');
      const cols = await until(page, () => document.querySelectorAll('#lvl-wa-grid .lvl-col').length === 4);
      const fb = await shown(page, '#filter-bar');
      ok(cols && !fb, T('b4 レベリング比較 → 絞り込みの帯が消え、#lvl-wa-grid に4本の .lvl-col'),
        J({ cols: await page.evaluate(() => document.querySelectorAll('#lvl-wa-grid .lvl-col').length), filterBar: fb }));
      await shot(page, 'base', lang, 'b4-range');
      await press(page, '.view-btn[data-view="card"]');
      const back = await until(page, () => getComputedStyle(document.getElementById('range-view')).display === 'none');
      const v4 = await visible(page), fb2 = await shown(page, '#filter-bar');
      ok(back && fb2 && same(v4, ORDER), T('b4 カード一覧 → 絞り込みの帯と112枚のカードに戻る'), J({ back, filterBar: fb2, n: v4.length }));

      /* b5 テーマ */
      const th0 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      await press(page, '#theme-toggle');
      const th1 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      await press(page, '#theme-toggle');
      const th2 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      ok(['light', 'dark'].includes(th0) && th1 === (th0 === 'dark' ? 'light' : 'dark') && th2 === th0,
        T('b5 テーマのボタンで data-theme が入れ替わり、もう1回で戻る'), J([th0, th1, th2]));

      /* b6 古い地図 */
      const AS = '.map-region-group[data-region="asia"]', nAsia = inRegion('asia').length, lab = REGION_LABEL.asia[lang === 'en' ? 1 : 0];
      const pt = await pointIn(page, AS);
      if (pt) await page.mouse.move(pt.x, pt.y);
      const tip = !!pt && await until(page, (lab, c) => {
        const t = document.getElementById('map-tooltip');
        return !!t && t.style.opacity === '1' && t.textContent.includes(lab) && t.textContent.includes(c);
      }, lab, C(nAsia));
      ok(tip, T(`b6 地図のアジアに指を載せる → 吹き出しに「${lab}」と「${C(nAsia)}」`),
        J({ pt, tip: await page.evaluate(() => { const t = document.getElementById('map-tooltip'); return t ? [t.style.opacity, t.textContent] : null; }) }));
      await shot(page, 'base', lang, 'b6-tooltip');
      if (pt) await page.mouse.click(pt.x, pt.y);
      const sel1 = !!pt && await until(page, () => { const b = document.querySelector('#region-strip .rstrip-btn[data-region="asia"]'); return !!b && b.getAttribute('aria-pressed') === 'true'; });
      const v6 = await visible(page);
      ok(sel1 && sameSet(v6, inRegion('asia')) && v6.length === nAsia, T(`b6 地図のアジアを押す → アジアが選ばれ、${nAsia}社`), J({ n: v6.length }));
      await still(page);
      const pt2 = await pointIn(page, AS);
      if (pt2) await page.mouse.click(pt2.x, pt2.y);
      const sel2 = !!pt2 && await until(page, () => { const b = document.querySelector('#region-strip .rstrip-btn[data-region="all"]'); return !!b && b.getAttribute('aria-pressed') === 'true'; });
      const v6b = await visible(page);
      ok(sel2 && same(v6b, ORDER), T('b6 もう1回押す → 選ぶのをやめ、112社に戻る'), J({ pt2, n: v6b.length, pr: await pressed(page) }));
      await still(page);
      const pins = await page.evaluate((codes) => codes.map((c) => ((document.getElementById('pc-' + c) || {}).textContent || '')), REG8);
      const pinWant = REG8.map((c) => C(inRegion(c).length));
      ok(same(pins, pinWant), T('b6 地図のピンの8つの社数 ＝ 地域の社数'), J({ pins, pinWant }));

      /* b7 一覧の検索欄 */
      await type(page, 'emirates');
      const em = await until(page, () => { const a = document.querySelector('#airline-grid a[href="airlines/emirates.html"]'); return !!a && a.getClientRects().length > 0 && [...document.querySelectorAll('#airline-grid a[href^="airlines/"]')].some((x) => x.getClientRects().length === 0); });
      const v7 = await visible(page);
      ok(em && v7.includes('emirates') && v7.length < ORDER.length, T('b7 «emirates» → エミレーツが見えている（絞り込まれている）'), J({ n: v7.length }));
      await type(page, 'zzzz');
      const none = await until(page, () => { const n = document.getElementById('no-results'); return !!n && getComputedStyle(n).display !== 'none'; });
      const v7b = await visible(page);
      ok(none && v7b.length === 0, T('b7 «zzzz» → 見つからない（#no-results）・カードは0枚'), J({ n: v7b.length }));
      await shot(page, 'base', lang, 'b7-none');
      await type(page, '');
      const v7c = await visible(page);
      ok(same(v7c, ORDER), T('b7 検索欄を空に → 112社に戻る'), J({ n: v7c.length }));

      /* b8 ヘッダーの検索 */
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await press(page, '#pv-search-btn');
      await until(page, () => { const i = document.getElementById('pv-search-input'); return !!i && i.getClientRects().length > 0; });
      await page.evaluate(() => {
        const el = document.getElementById('pv-search-input');
        el.value = 'Solairus';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      const hs = await until(page, () => [...document.querySelectorAll('#pv-search-dd a.pv-si')]
        .some((a) => a.getClientRects().length > 0 && (a.getAttribute('href') || '').endsWith('airlines/solairus.html')));
      ok(hs, T('b8 ヘッダーの検索で «Solairus» → airlines/solairus.html へのリンク'),
        J(await page.evaluate(() => [...document.querySelectorAll('#pv-search-dd a.pv-si')].map((a) => a.getAttribute('href')))));
      await shot(page, 'base', lang, 'b8-header');

      /* b9 静か */
      const q = quiet(st, 'base');
      ok(q.length === 0, T('b9 quiet(st, \'base\') が空 ── 外への通信も、一覧のページからのサーバーの口の呼び出しも無い'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* 場面 first（日英・390×680 のスマホ）── 開いた最初の1画面に、見出しのすぐ下の大きな検索欄 */
  async function first(lang) {
    const T = (s) => `[${lang}] ${s}`;
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], w: 390, h: 680, touch: true });
    PAGES.push(P);
    const { page, st } = P;
    try {
      await page.evaluate(() => document.fonts && document.fonts.ready);
      const m = await page.evaluate(() => {
        const s = document.getElementById('search'), h1 = document.querySelector('#wa-hero h1'), hero = document.getElementById('wa-hero');
        const r = s ? s.getBoundingClientRect() : null;
        /* 見出しと検索欄のあいだ（#wa-hero の中・文書の順）に押せるものが無い */
        const between = !h1 || !s ? ['?'] : [...hero.querySelectorAll('a[href],button,input,select,textarea,[tabindex],[role="button"]')]
          .filter((e) => e !== s && e.getClientRects().length > 0
            && (h1.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING) && (e.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING))
          .map((e) => e.outerHTML.slice(0, 80));
        const shownEl = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;
        return {
          rect: r && { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }, vh: window.innerHeight,
          font: s ? parseFloat(getComputedStyle(s).fontSize) : 0, h1: h1 ? h1.textContent : null, between,
          h2: (document.getElementById('wd-rh-name') || {}).textContent ?? null,
          shown: ['#wd-scope', '#wd-clear', '#wd-scope-e', '#wd-clear-e', '.wd-else-b'].filter((sel) => [...document.querySelectorAll(sel)].some(shownEl)),
        };
      });
      ok(!!m.rect && m.rect.top >= 0 && m.rect.bottom <= m.vh, T(`first #search が最初の1画面（390×680）の中`), J(m.rect));
      ok(!!m.rect && m.rect.h >= 48, T('first #search の高さ 48px 以上'), J(m.rect));
      ok(m.font >= 16, T('first #search の字 16px 以上（iOS の拡大を起こさない）'), J(m.font));
      ok(m.between.length === 0, T('first 見出しと検索欄のあいだに押せるものが無い'), J(m.between));
      ok(m.h1 === H1[lang], T(`first 見出し「${H1[lang]}」`), J(m.h1));
      ok(m.h2 === REGION_LABEL.all[lang === 'en' ? 1 : 0], T(`first 結果の見出し「${REGION_LABEL.all[lang === 'en' ? 1 : 0]}」`), J(m.h2));
      ok(m.shown.length === 0, T('first 開いたときは、地域の札・解除・見つからないときのボタンを見せない'), J(m.shown));
      await shot(page, 'first', lang, '390');
      const q = quiet(st, 'first');
      ok(q.length === 0, T('first quiet(st, \'first\') が空'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* 場面 nojs（日英・台本を止めたブラウザ）── 112社のリンクと見出しは HTML だけで読め、台本が要る部品は見せない */
  async function nojs(lang) {
    const T = (s) => `[${lang}] ${s}`;
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], js: false });
    PAGES.push(P);
    const { page, st } = P;
    try {
      const v = await visible(page);
      ok(same(v, ORDER), T(`nojs 台帳の${ORDER.length}社のリンクが見えている（一覧の並び）`), J({ n: v.length }));
      const h2 = await page.evaluate(() => (document.getElementById('wd-rh-name') || {}).textContent ?? null);
      ok(h2 === REGION_LABEL.all[lang === 'en' ? 1 : 0], T(`nojs h2#wd-rh-name「${REGION_LABEL.all[lang === 'en' ? 1 : 0]}」`), J(h2));
      const vis = await page.evaluate(() => ['.wd-search', '#filter-bar', '.view-toggle', '.map-wrapper']
        .filter((sel) => [...document.querySelectorAll(sel)].some((el) => getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0)));
      ok(vis.length === 0, T('nojs 検索欄・絞り込みの帯・表示の切り替え・古い地図を見せない'), J(vis));
      await shot(page, 'nojs', lang, '1440');
      const q = quiet(st, 'nojs');
      ok(q.length === 0, T('nojs quiet(st, \'nojs\') が空'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  try {
    for (const s of want) for (const lang of LANGS) {
      console.log(`\n════ ${s}（${lang}） ════`);
      try { await SCENES[s](lang); }
      catch (e) { ok(false, `[${lang}] 場面が途中で止まった（${s}）`, String(e && e.stack || e).split(ROOT).join('').slice(0, 600)); }
    }
  } finally {
    await browser.close().catch(() => {});
    await L.stop().catch(() => {});
  }

  /* 閉じの行（どの実行でも出す） */
  const supa = PAGES.flatMap((p) => [...p.st.supa]), blocked = PAGES.flatMap((p) => [...p.st.blocked]);
  const dirCalls = PAGES.flatMap((p) => p.st.calls.filter((_, i) => { let seg = null; for (const g of p.st.segs || []) if (g.at <= i) seg = g; return seg && seg.dir; }));
  const errs = PAGES.flatMap((p) => p.st.errs), http4 = PAGES.flatMap((p) => p.st.http4 || []);
  console.log('');
  console.log(`  st.supa ${supa.length} · st.blocked ${blocked.length} · 一覧のページの st.calls ${dirCalls.length}（${PAGES.length}枚）${dirCalls.length ? '：' + dirCalls.join(', ') : ''}`);
  ok(errs.length === 0, '★どのページにも、スクリプトの止まり（pageerror）が無い', J(errs));
  ok(http4.length === 0, '★手元の配信元が 4xx / 5xx で答えた要求が無い', J(http4));
  console.log(`\n══ assert-directory-ui：${pass} pass / ${fail} fail ══`);
  process.exitCode = fail ? 1 : 0;
}
