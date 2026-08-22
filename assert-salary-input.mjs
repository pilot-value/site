// ⚠️ 2026-08-16 から休止中。この検査は動かない（走らせると全部落ちる）。
//    口コミの投稿フォームから金額欄（f-base / f-duty / f-monthly / f-bonus / f-annual /
//    sal-total-val）を外し、年収は給与明細（pay-report.html）に一本化したため、
//    ここが読む要素がページに無い。デプロイ前チェックの一覧からも外してある。
//    ★口コミフォームに金額入力が戻ったときだけ、この検査を復活させる。
//    ★通貨切替そのものは assert-jp.mjs / assert-currency.mjs が今も見ている。
//    同じ理由で salary-input-currency.js も読み込まれなくなったが、ファイルは残してある。
//
// 口コミ投稿フォームの給与入力欄が、ヘッダーの通貨切替に追随するかを実測する。
// 見た目（単位ラベル・placeholder・欄の値）と、保存値（getVals は常に万円）の両方を見る。
// 通貨を往復させても保存値が動かないことが要（丸めで痩せると一次データが静かに壊れる）。
// localhost 必須。使い方: node serve.mjs を起動してから node assert-salary-input.mjs
import puppeteer from 'puppeteer';
import { JPY_PER } from './fx-rates.mjs';

const BASE = 'http://localhost:3000';
// レートは fx-rates.mjs が唯一の正（currency.js もそこから作られる）。ここに数字を書き写さない
const RATES = Object.fromEntries(['JPY', 'USD', 'EUR', 'AED'].map((c) => [c, JPY_PER[c]]));

let fail = 0, pass = 0;
function check(name, got, want) {
  const ok = String(got) === String(want);
  if (ok) { pass++; } else { fail++; console.log(`  ✗ ${name}\n      got  ${got}\n      want ${want}`); }
}

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });

// ページ側の状態を読む（単位ラベル・欄の値・getVals の万円）
const snap = () => page.evaluate(() => ({
  cur:      window.PVCurrency.get(),
  unitYear: document.querySelector('[data-money-unit="year"]').textContent,
  baseVal:  document.getElementById('f-base').value,
  basePh:   document.getElementById('f-base').placeholder,
  baseMax:  document.getElementById('f-base').max,
  annual:   document.getElementById('f-annual').value,
  total:    document.getElementById('sal-total-val').textContent,
  vals:     (({ base, duty, bonus, annual, inputCur, inputRate }) =>
              ({ base, duty, bonus, annual, inputCur, inputRate }))(getVals()),
}));
const setCur = async (c) => { await page.evaluate((x) => window.PVCurrency.set(x), c); };
const type = async (id, v) => page.evaluate((i, x) => {
  const el = document.getElementById(i);
  el.value = x;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, id, v);

// ★ 英語ページは JPY を選んでも「万円」で入力させない（万＝1万 は日本語圏の位取り）。
//   素の円で打ってもらう＝他の通貨と同じ扱い。保存値はどちらの画面でも万円のまま。
for (const [label, url, unitJPY, unitUSD, defCur] of [
  ['EN', `${BASE}/en/submit-review.html`, 'JPY / year', 'USD / year', 'USD'],
  ['JA', `${BASE}/submit-review.html`,    '万円 / 年',  'USD / 年',   'JPY'],
]) {
  const EN = label === 'EN';
  const asMan = !EN;                       // その画面が「万円で入力させる」か
  const jpyShown = (man) => asMan ? man : man * 10000;   // 欄に出る数字
  console.log(`\n── ${label} ${url.replace(BASE, '')} ─────────────────────────`);
  // 前のページで保存した通貨を持ち越さない（localStorage が言語別の既定より優先される）
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('pv-currency'));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.PVMoney && window.PVCurrency, { timeout: 10000 });

  let s = await snap();
  check('既定の通貨', s.cur, defCur);

  // ── JPY：日本語ページはこれまでと1文字も変わらないこと（回帰ゼロ）。
  //    英語ページは万円をやめて素の円になっていること。
  await setCur('JPY');
  s = await snap();
  check('JPY 単位ラベル', s.unitYear, unitJPY);
  check('JPY placeholder', s.basePh, EN ? 'e.g. 9,500,000' : '例：950');
  check('JPY max',         s.baseMax, String(jpyShown(99999)));

  // ── その画面の単位で入力 → 通貨を回しても保存値（万円）は動かない ──
  await type('f-base',  String(jpyShown(950)));
  await type('f-duty',  String(jpyShown(620)));
  await type('f-bonus', String(jpyShown(200)));
  s = await snap();
  check('JPY 入力後 base(万円)', s.vals.base, 950);
  check('JPY 自動計算の年収',    s.annual, String(jpyShown(1770)));
  check('JPY 合計表示',          s.total.replace(/\s/g, ''),
        EN ? '17,700,000JPY/year' : '1,770万円/年');
  check('JPY inputCurrency',     s.vals.inputCur, 'JPY');

  for (const c of ['USD', 'EUR', 'AED', 'JPY']) {
    await setCur(c);
    s = await snap();
    const shown = c === 'JPY' ? jpyShown(950) : Math.round(950 * 10000 / RATES[c]);
    check(`${c} 欄の見た目`,     s.baseVal, String(shown));
    check(`${c} 単位ラベル`,     s.unitYear, c === 'JPY' ? unitJPY : `${c} / ${EN ? 'year' : '年'}`);
    check(`${c} 保存値は万円のまま`, s.vals.base, 950);
    check(`${c} 年収も万円のまま`,   s.vals.annual, 1770);
    check(`${c} inputCurrency`,  s.vals.inputCur, c);
    check(`${c} inputRate`,      s.vals.inputRate, RATES[c]);
  }

  // ── 外貨でそのまま打ったときに、正しい万円へ戻ること ──
  await setCur('USD');
  await type('f-base', '100000');   // $100,000 × 160円 ÷ 1万 = 1,600万円
  await type('f-duty', '');
  await type('f-bonus', '');
  s = await snap();
  check('USD 直接入力 → 万円', s.vals.base, 1600);
  check('USD 直接入力 → 年収', s.vals.annual, 1600);
  check('USD placeholder',     s.basePh, EN ? 'e.g. 59,000' : '例：59,000');
  check('USD max',             s.baseMax, String(Math.round(99999 * 10000 / 160)));
  await setCur('JPY');
  s = await snap();
  check('JPY へ戻すと 1,600 万円', s.baseVal, String(jpyShown(1600)));
}

await browser.close();
console.log(`\n==== ${pass} pass / ${fail} fail ====`);
if (fail) process.exitCode = 1;
