// JP-side regression guard: default JPY, clean USD conversion, and JPY→USD→JPY round-trip idempotency.
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const jpAirlines = fs.readdirSync(path.join(__dirname, 'airlines')).filter(f => f.endsWith('.html'));
// 国別ハブも金額だらけなので同じ検査に載せる（載せ忘れると新しい面だけ無検査になる）
const jpCountries = fs.existsSync(path.join(__dirname, 'countries'))
  ? fs.readdirSync(path.join(__dirname, 'countries')).filter(f => f.endsWith('.html')) : [];
// 地域ハブ（{region}-pilot-salary.html）も同じ理由で載せる。綴りで拾うので
// 増えても手で足さなくていい（pilot-salary-guide.html は末尾が違うので入らない）。
const jpRegions = fs.readdirSync(__dirname).filter(f => /-pilot-salary\.html$/.test(f));
const tops = ['index.html', 'world-airlines.html', 'countries.html', ...jpRegions]
  .filter(f => fs.existsSync(path.join(__dirname, f)));
const targets = [...tops, ...jpAirlines.map(f => `airlines/${f}`), ...jpCountries.map(f => `countries/${f}`)];

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

let bad = 0, errs = 0, done = 0;
for (const t of targets) {
  try {
    await page.goto('http://localhost:3000/' + t, { waitUntil: 'domcontentloaded', timeout: 45000 });
  } catch (e) {
    errs++; console.log(`⚠ LOAD-FAIL ${t}: ${e.message.split('\n')[0]}`); continue;
  }
  await new Promise(r => setTimeout(r, 250));
  done++;
  const r = await page.evaluate(() => {
    const get = () => document.body ? document.body.innerText : '';
    const api = window.PVCurrency;
    const defCur = api ? api.get() : 'NO-API';
    const jpy0 = get();
    let usdText = '', jpy1 = '';
    if (api) { api.set('USD'); usdText = get(); api.set('JPY'); jpy1 = get(); }
    return { defCur, jpy0, jpy1, usdText, spans: document.querySelectorAll('span.pv-cur').length };
  });
  const hits = [];
  if (r.defCur !== 'JPY') hits.push(`default NOT JPY (${r.defCur})`);
  if (r.jpy0 !== r.jpy1)  hits.push('round-trip JPY→USD→JPY changed text (not reversible)');
  const usdLeftYen = r.usdText.match(/¥\s?\d/g);            // in USD state no ¥-number should remain
  if (usdLeftYen) hits.push(`USD state left ¥: ${[...new Set(usdLeftYen)].slice(0,4).join(' ')}`);
  const halfRange = r.usdText.match(/[–〜~](?:\s?)\d[\d,.]*[MK]\b/g);
  if (halfRange) hits.push(`USD half-range: ${[...new Set(halfRange)].slice(0,4).join(' ')}`);
  if (hits.length) { bad++; console.log(`✗ ${t} [def=${r.defCur}, spans=${r.spans}]  ${hits.join(' | ')}`); }
}
await browser.close();
console.log(`\n==== ${done}/${targets.length} JP pages checked, ${bad} regressions, ${errs} load-fails ====`);
