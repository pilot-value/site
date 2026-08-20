/* 明細ドロップの見た目を JP/EN × ライト／ダークで撮る。
   モックの解析結果を返すので Anthropic は呼ばない。
   出力は screenshot.mjs と同じ「temporary screenshots/」・同じ連番規則。
   実行: node db/shot-payslip.mjs [round]                                    */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, '..', 'temporary screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const ROUND = process.argv[2] || '1';

const FAKE = {
  ok: true,
  result: {
    currency: 'JPY', period: { year: 2026, month: 7 },
    earnings: [
      { label: '基本給', amount: 420000, kind: 'base' },
      { label: '職務手当', amount: 185000, kind: 'command' },
      { label: '変動付加乗務手当', amount: 148200, kind: 'flight_variable' },
      { label: '深夜割増', amount: 23400, kind: 'flight_variable' },
      { label: '住宅手当', amount: 60000, kind: 'housing' },
      { label: '通勤手当', amount: 18000, kind: 'transport' },
      { label: '日当（非課税）', amount: 42000, kind: 'per_diem' },
    ],
    deductions_total: 221354, net_pay: 690146,
    hours: [{ label: '総勤務時間', value: 168.5, kind: 'duty' },
            { label: '乗務時間', value: 78.2, kind: 'block' },
            { label: '深夜時間', value: 12.0, kind: 'night' }],
    unmapped: [{ label: '特別加算', amount: 12000 }],
    confidence: 'high',
  },
};
const CORS = { 'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS' };

const shot = async (node, label) => {
  let n = 1;
  const name = () => `screenshot-${n}-${label}.png`;
  while (fs.existsSync(path.join(OUT, name()))) n++;
  const p = path.join(OUT, name());
  await node.screenshot({ path: p });
  console.log(p);
};

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });

for (const lang of ['ja', 'en']) {
  for (const theme of ['light', 'dark']) {
    const url = `http://localhost:3000/${lang === 'en' ? 'en/' : ''}pay-report.html`;
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (!req.url().includes('/functions/v1/parse-payslip')) return req.continue();
      if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS, body: '' });
      req.respond({ status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
                    body: JSON.stringify(FAKE) });
    });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('pv-theme', t); }, theme);
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 700));

    const tag = `r${ROUND}-ps-${lang}-${theme}`;
    await shot(await page.$('#ps'), `${tag}-1drop`);

    const inp = await page.$('#ps-file');
    await inp.uploadFile(path.join(DIR, 'fixtures', 'payslip-jp-major.png'));
    await page.waitForSelector('.ps-rect', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 600));
    await shot(await page.$('#ps'), `${tag}-2edit`);

    await page.click('#ps-send');
    await page.waitForSelector('.ps-res', { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 600));
    await shot(await page.$('#ps'), `${tag}-3read`);
    const rate = await page.$('#ps-rate');
    if (rate) await shot(rate, `${tag}-4rate`);

    await page.close();
  }
}
await browser.close();
