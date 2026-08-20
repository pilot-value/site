/* shot-aha.mjs — 「n=0 のアハ」カードを localhost の実ページで撮る。

   アハは明細を読ませたあとにしか出ないが、Edge Function を叩かずに検分したい。
   payslip.js の renderAha は #ps-aha があれば #form-wrap の input で描き直すので、
   カードの器だけ差し込んでフォームに値を入れ、input を1回投げれば実物が描かれる。
   ★ここで作るのは「フォームの数値」だけ。payslip.js には一切触らない
     （触ると、撮った絵が本番の絵でなくなる）。

   実行: node shot-aha.mjs <scene> <lang> <theme>
     scene: pick | below | mid | top | cadet | nofx
     lang : ja | en    theme: dark | light
   保存先は screenshot.mjs と同じ ./temporary screenshots/
*/
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scene = process.argv[2] || 'mid';
const lang  = process.argv[3] || 'ja';
const theme = process.argv[4] || 'dark';

const dir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const label = `aha-${scene}-${lang}-${theme}`;
let n = 1;
while (fs.existsSync(path.join(dir, `screenshot-${n}-${label}.png`))) n++;
const outPath = path.join(dir, `screenshot-${n}-${label}.png`);

const url = `http://localhost:3000/${lang === 'en' ? 'en/' : ''}pay-report.html`;

/* 月給・時間は全部でたらめ（合成）。狙うのは「レンジのどこに立つか」の分岐だけ。
   gross は原本通貨の月の額面。年額 = gross×12 で SSOT（万円）と突き合わされる。
   ★2026-08-13 に額面の欄が f-base（内訳の中・既定で閉じている）から
     f-gross（誰にでも聞く欄）へ移った。f-base に入れても年額が 0 のままで
     カードが描かれない（実際にそれで撮影が落ちていた）。 */
const SCENES = {
  pick:  { airline: '',         position: '',        currency: 'JPY', gross: 1900000 },
  below: { airline: 'ana',      position: 'cap',     currency: 'JPY', gross: 1500000 },  // 2200万を割る
  mid:   { airline: 'emirates', position: 'cap',     currency: 'AED', gross: 78000  },   // レンジ内
  top:   { airline: 'united',   position: 'cap',     currency: 'USD', gross: 60000  },   // 誰より上
  cadet: { airline: 'ana',      position: 'cadet',   currency: 'JPY', gross: 450000 },
  nofx:  { airline: 'qatar-airways', position: 'cap', currency: 'QAR', gross: 90000 },   // レート未整備
};

/* headless:'new' はこの環境で page.screenshot() が返ってこない（Chrome 側の問題。
   args を振っても直らず、headless:'shell' だけ返る）。描画エンジンは同じ。 */
const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
await page.evaluateOnNewDocument((t) => { localStorage.setItem('pv-theme', t); }, theme);
await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

/* 入口の2択（2026-08-13 追加）を抜けないとフォームが hidden のままで、
   #ps-aha の boundingBox が null になり撮影が落ちる。 */
await page.click('#entry-manual');
await new Promise((r) => setTimeout(r, 300));

await page.evaluate((s) => {
  const set = (id, v) => {
    const e = document.getElementById(id);
    if (!e) return;
    e.value = v;
    e.dispatchEvent(new Event('input',  { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
  };
  set('f-currency', s.currency);
  set('f-gross', s.gross);
  set('f-block', 82);
  if (s.airline)  set('f-airline',  s.airline);
  if (s.position) set('f-position', s.position);

  // payslip.js が明細を読んだあとに差し込むのと同じ器を、同じ場所に置く
  const panel = document.getElementById('ps-panel');
  panel.innerHTML = '<div class="ps-aha pv-no-cur" id="ps-aha"></div>';
  document.getElementById('f-gross').dispatchEvent(new Event('input', { bubbles: true }));
}, SCENES[scene]);

await new Promise((r) => setTimeout(r, 1200));      // salary-data.json の fetch を待つ

// カードだけを撮る（ページ全体だと 8,000px になってカードが読めない）
const card = await page.$('#ps-aha');
if (card) {
  const b = await card.boundingBox();
  await page.screenshot({
    path: outPath,
    clip: { x: b.x - 24, y: b.y - 24, width: b.width + 48, height: b.height + 48 },
  });
} else {
  await page.screenshot({ path: outPath, fullPage: true });
}
await browser.close();
console.log(outPath);
