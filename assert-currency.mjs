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
await browser.close();
console.log(`\n==== ${checked} EN pages checked, ${bad} with signature hits ====`);
