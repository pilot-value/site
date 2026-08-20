// Capture a page in multiple currency states via window.PVCurrency.set(). Localhost only.
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url    = process.argv[2];
const label  = process.argv[3] || 'state';
const states = (process.argv[4] || 'DEFAULT,JPY,EUR').split(',');
const dir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1200));
for (const st of states) {
  if (st !== 'DEFAULT') {
    await page.evaluate((s) => window.PVCurrency && window.PVCurrency.set(s), st);
    await new Promise(r => setTimeout(r, 400));
  }
  const cur = await page.evaluate(() => window.PVCurrency ? window.PVCurrency.get() : 'NO-API');
  let n = 1;
  while (fs.existsSync(path.join(dir, `states-${label}-${st}-${cur}-${n}.png`))) n++;
  const out = path.join(dir, `states-${label}-${st}-${cur}-${n}.png`);
  await page.screenshot({ path: out, fullPage: true });
  console.log(`${st} (api=${cur}) -> ${out}`);
}
await browser.close();
