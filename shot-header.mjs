/* ════════════════════════════════════════════════════════════════
   shot-header.mjs — ヘッダーだけを幅ごとに並べて撮る

   なぜ要るか
     ヘッダーは幅が足りなくなると search.js が自動で畳む。畳み方が正しいかは
     数字（assert-header.mjs）では「はみ出していない」までしか言えないので、
     実際どう見えているかを1枚にまとめて目で見る。

   使い方（node serve.mjs を起動した状態で）
     node shot-header.mjs                 390,768,900,1024,1280 を dark で
     node shot-header.mjs 768,1280        幅を指定
     node shot-header.mjs 768 light       テーマを指定
     node shot-header.mjs 390 dark open   引き出しを開けた状態で撮る

   保存先: ./temporary screenshots/screenshot-N-header-<幅>-<テーマ>.png
════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';

const widths = (process.argv[2] || '390,768,900,1024,1280').split(',').map(Number);
const theme  = process.argv[3] || 'dark';
const open   = process.argv.includes('open');

/* テンプレートが違うものを1枚ずつ。同じ生成物を並べても同じ絵が増えるだけ。 */
const PAGES = [
  ['/',                     'ja トップ'],
  ['/en/',                  'en トップ'],
  ['/world-airlines.html',  'ja 航空会社一覧'],
  ['/community.html',       'ja 口コミ'],
  ['/airlines/ana.html',    'ja 航空会社ページ'],
  ['/en/airlines/ana.html', 'en 航空会社ページ'],
];

const dir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const nextPath = (label) => {
  let n = 1;
  while (fs.existsSync(path.join(dir, `screenshot-${n}-${label}.png`))) n++;
  return path.join(dir, `screenshot-${n}-${label}.png`);
};

/* headless:'new' はこの環境で page.screenshot() が返ってこない（screenshot.mjs 参照）。 */
const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });

for (const w of widths) {
  const page = await browser.newPage();
  /* iframe を縦に積むので、外枠は 1枚ぶんの幅＋余白で足りる */
  await page.setViewport({ width: w + 40, height: 200 });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => localStorage.setItem('pv-theme', t), theme);

  await page.evaluate((args) => {
    const { PAGES, w, theme } = args;
    document.documentElement.setAttribute('data-theme', theme);
    document.body.innerHTML = '';
    document.body.style.cssText =
      'margin:0;padding:20px;display:flex;flex-direction:column;gap:14px;' +
      'background:' + (theme === 'dark' ? '#05070a' : '#e9edf2') + ';' +
      'font:12px/1.4 -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';
    PAGES.forEach(([href, label]) => {
      const cap = document.createElement('div');
      cap.textContent = label + '   ' + href;
      cap.style.cssText = 'color:' + (theme === 'dark' ? '#7b8ba0' : '#5b6b80') + ';letter-spacing:.02em';
      const f = document.createElement('iframe');
      f.src = href;
      /* iframe は本物の高さ（820px）で描く。低い iframe にすると
         トップページの 100vh のヒーローが縦中央＝ヘッダーの上に重なって写る。
         見たいのは上だけなので、外の箱で切り取る。 */
      f.style.cssText = 'width:' + w + 'px;height:820px;border:0;display:block';
      const clip = document.createElement('div');
      clip.style.cssText = 'width:' + w + 'px;height:150px;overflow:hidden;' +
        'box-shadow:0 0 0 1px ' + (theme === 'dark' ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)');
      clip.appendChild(f);
      document.body.appendChild(cap);
      document.body.appendChild(clip);
    });
  }, { PAGES, w, theme });

  await new Promise(r => setTimeout(r, 2600));

  if (open) {
    await page.evaluate(() => {
      document.querySelectorAll('iframe').forEach(f => {
        try {
          const d = f.contentDocument;
          const b = d.getElementById('pv-ham-btn');
          if (b) b.click();
          f.parentNode.style.height = '560px';   /* 引き出しの中身が見えるところまで切り取りを広げる */
        } catch (e) {}
      });
    });
    await new Promise(r => setTimeout(r, 900));
  }

  const out = nextPath('header-' + w + '-' + theme + (open ? '-open' : ''));
  await page.screenshot({ path: out, fullPage: true });
  console.log(out);
  await page.close();
}
await browser.close();
