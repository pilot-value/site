// Load every EN page in USD state, scan visible innerText for currency-bug signatures. Localhost only.
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const enAirlines = fs.readdirSync(path.join(__dirname, 'en', 'airlines')).filter(f => f.endsWith('.html'));
// 国別ハブも金額だらけなので同じ検査に載せる（載せ忘れると新しい面だけ無検査になる）
const enCountries = fs.existsSync(path.join(__dirname, 'en', 'countries'))
  ? fs.readdirSync(path.join(__dirname, 'en', 'countries')).filter(f => f.endsWith('.html')) : [];
// 地域ハブ（en/{region}-pilot-salary.html）も同じ理由で載せる。綴りで拾うので
// 増えても手で足さなくていい（pilot-salary-guide.html は末尾が違うので入らない）。
const enRegions = fs.readdirSync(path.join(__dirname, 'en')).filter(f => /-pilot-salary\.html$/.test(f));
const targets = ['en/index.html', 'en/countries.html', 'en/world-airlines.html',
  ...enRegions.map(f => `en/${f}`),
  ...enAirlines.map(f => `en/airlines/${f}`), ...enCountries.map(f => `en/countries/${f}`)];

// Bug signatures in a non-JPY (USD) rendered page:
const SIGS = [
  { re: /¥\s?\d/g,                         name: 'unconverted-¥ (currency.js missed a token)' },
  { re: /(?<![.\d])[$€£]0(?![.\d])/g,      name: '$0 / €0 / £0 (misparsed small value)' },
  { re: /[$€£]0\.\d+M/g,                   name: '$0.xM (the original bug)' },
  { re: /[–〜~](?:\s?)\d[\d,.]*[MK]\b/g,    name: 'half-range tail  –NN M/K (no currency symbol)' },
];

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
/* ★時計の置き場所を日本に固定する（2026-09-24）。currency.js は英語ページの既定通貨を
   **見ている地域から**決めるようになったので、これが無いと検査の答えが
   「この Mac がどこにあるか」で変わる（欧州で流すと EUR になって嘘の赤が出る）。
   日本に固定するのは、ここがまさにオーナーの症状 ──「日本から英語ページを開いたのに ¥」──
   だから。日本 ＋ 英語ページ ＝ 必ず USD、が下の DEFAULT-CURRENCY の1行の意味。 */
await page.emulateTimezone('Asia/Tokyo');

let bad = 0, checked = 0;
for (const t of targets) {
  await page.goto('http://localhost:3000/' + t, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 350));
  const info = await page.evaluate(() => ({
    cur: window.PVCurrency ? window.PVCurrency.get() : 'NO-API',
    spans: document.querySelectorAll('span.pv-cur').length,
    text: document.body ? document.body.innerText : ''
  }));
  checked++;
  // 元が「¥0」なら $0 は誤変換ではなく正しい答え。ana-vs-emirates の
  // 「所得税 ¥0（非課税）」がそれで、ずっと誤検知していた。ページ内に
  // 素の ¥0 が書かれている場合だけ $0 のシグネチャを外す。
  const literalZero = /¥0(?![\d.,])/.test(fs.readFileSync(path.join(__dirname, t), "utf8"));
  const hits = [];
  for (const s of SIGS) {
    if (literalZero && s.name.startsWith('$0 / €0')) continue;
    const m = info.text.match(s.re);
    if (m) hits.push(`${s.name}: ${[...new Set(m)].slice(0, 6).join(' , ')}`);
  }
  if (info.cur !== 'USD') hits.push(`DEFAULT-CURRENCY NOT USD (got ${info.cur})`);
  if (info.spans === 0)   hits.push('NO pv-cur spans (currency.js not wired?)');
  if (hits.length) { bad++; console.log(`\n✗ ${t}  [cur=${info.cur}, spans=${info.spans}]`); hits.forEach(h => console.log('   - ' + h)); }
}
/* ── 既定の通貨の決め方（2026-09-24 オーナー指示）──────────────────────────
   1) 英語ページは**見ている地域**で既定を決める（通信はしない。ブラウザのタイムゾーンだけ）
   2) ★どの地域から見ても、英語ページの既定が JPY になることは無い
      （元の不具合：日本語ページで一度 ¥ を選ぶと、英語ページも ¥ のままだった）
   3) ★自分で選んだ通貨は、ページを移っても地域の通貨に戻らない（オーナーの条件）
   4) 日本語ページは地域を見ない＝今までどおり必ず円
   ⚠️ 表は currency.js の TZ_CUR を写している。あちらを変えたらここも直す
      （片方だけ直すと、地域判定が黙って別物になっても緑のまま）。 */
const REGION = [
  ['Asia/Dubai', 'AED'], ['Asia/Singapore', 'SGD'], ['Australia/Sydney', 'AUD'],
  ['Europe/London', 'GBP'], ['Europe/Paris', 'EUR'], ['Europe/Zurich', 'EUR'],
  ['America/New_York', 'USD'], ['America/Toronto', 'USD'], ['Asia/Tokyo', 'USD'],
  ['Asia/Kolkata', 'USD'], ['Africa/Johannesburg', 'USD'],
];
async function curAt(tz, url, seed, pick) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.emulateTimezone(tz);
  await p.goto('http://localhost:3000/' + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (seed) {
    await p.evaluate(o => { for (const k in o) localStorage.setItem(k, o[k]); }, seed);
    await p.reload({ waitUntil: 'domcontentloaded' });
  }
  await new Promise(r => setTimeout(r, 300));
  if (pick) await p.evaluate(c => window.PVCurrency.set(c), pick);
  const got = await p.evaluate(() => (window.PVCurrency ? window.PVCurrency.get() : 'NO-API'));
  await ctx.close();
  return got;
}
console.log('\n---- 既定の通貨の決め方 ----');
let dbad = 0;
const say = (okv, label, got, want) => {
  if (okv) console.log(`  ✅ ${label}`);
  else { dbad++; console.log(`  ✗ ${label} → ${got}（あるべきは ${want}）`); }
};
for (const [tz, want] of REGION) {
  const got = await curAt(tz, 'en/index.html');
  say(got === want, `${tz} から英語ページ`, got, want);
  if (got === 'JPY') { console.log('     ↑ ★英語ページの既定が円になっている（直した不具合の再発）'); }
}
for (const tz of ['Asia/Dubai', 'Europe/Paris', 'America/New_York']) {
  const got = await curAt(tz, 'index.html');
  say(got === 'JPY', `${tz} から日本語ページ（地域を見ない）`, got, 'JPY');
}
{ // 昔の1つだけのキーからの引き継ぎ
  const a = await curAt('America/New_York', 'en/index.html', { 'pv-currency': 'JPY' });
  say(a === 'USD', '昔のキーが JPY のとき、英語ページは引き継がない', a, 'USD');
  const b = await curAt('America/New_York', 'en/index.html', { 'pv-currency': 'AED' });
  say(b === 'AED', '昔のキーが AED のとき、英語ページは引き継ぐ', b, 'AED');
}
{ // ★選んだ通貨が、ページを移っても地域の通貨に戻らない
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.emulateTimezone('Asia/Dubai');
  await p.goto('http://localhost:3000/en/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 300));
  const first = await p.evaluate(() => window.PVCurrency.get());
  say(first === 'AED', 'ドバイから開いた英語ページの既定', first, 'AED');
  await p.evaluate(() => window.PVCurrency.set('GBP'));
  for (const u of ['en/airlines/emirates.html', 'en/world-airlines.html', 'en/index.html']) {
    await p.goto('http://localhost:3000/' + u, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 300));
    const got = await p.evaluate(() => window.PVCurrency.get());
    say(got === 'GBP', `★£ を選んだあと ${u} へ移っても £ のまま`, got, 'GBP');
  }
  // 英語で選んだ通貨は日本語ページには移らない（日本語は必ず円）
  await p.goto('http://localhost:3000/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 300));
  const ja = await p.evaluate(() => window.PVCurrency.get());
  say(ja === 'JPY', '英語で £ を選んでも日本語ページは円', ja, 'JPY');
  await ctx.close();
}

await browser.close();
console.log(`\n==== ${checked} EN pages checked, ${bad} with signature hits ／ 既定の通貨 ${dbad} 件が不一致 ====`);
/* ★終了コードを返す（2026-09-24）。前はここが無く、✗ を何本出しても終了コード 0 ＝
   check.mjs の一覧では「✓ assert-currency.mjs」と緑で出ていた（落ちた回だけ本文を出す作りなので、
   ✗ の行そのものが誰の目にも入らない）。英語ページの通貨が壊れても気づけない状態だった。 */
process.exit(bad || dbad ? 1 : 0);
