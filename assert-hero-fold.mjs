/* ════════════════════════════════════════════════════════════════
   assert-hero-fold.mjs — トップの帯2本が「最初の1画面」に入っているか

   なぜ要るか
     2026-09-24、オーナーの画面（1440×780）で **緑のカードの帯も口コミの帯も
     1画面に出ていなかった**（口コミ帯の下端が 969px ＝ 189px はみ出し）。
     ヒーローの余白を少し足すだけで簡単に戻る形で、しかも **画面は普通に動いたまま**
     ＝スクロールすれば見えるので、誰も壊れたと気づけない。
     帯2本は「本物のパイロットが出した数字と言葉」を最初の1画面で見せる装置なので、
     ここが画面外へ落ちるのは静かな機能停止にあたる。

   見るもの（日英 × 3つの画面の大きさ）
     A) 口コミの帯（下の段）の下端が画面の高さに収まっているか
     B) 緑の帯（上の段）の下端も収まっているか（Aが通ればまず通るが、順番が
        入れ替わったときに気づけるように別で見る）
     C) 帯にカードが実際に入っているか（高さだけ空いていて中身が空、を通さない）
     D) 帯2本のあいだが 10px のままか（片方だけ余白を変えると上下で塊に見えなくなる）

   ⚠️ 基準の大きさは **1440×780**（オーナーの画面。ブラウザの枠を除いた実寸）。
      1280×720 のような背の低い画面は**わざと見ていない** ── そこまで入れようとすると
      電話の中身が「1行＋内訳」だけになり、見本として意味が無くなる。

   実行: node serve.mjs を起動した状態で node assert-hero-fold.mjs
════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';

const BASE = 'http://localhost:3000';

/* 1440×780 ＝ オーナーの画面。ほかは「もっと広い/狭い側でも崩れない」の確認。
   ⚠️ 段組みは **幅と高さの両方** で変わる（1100px 以上、または 768px 以上かつ
      高さ 1000px 以上で2列）。だから iPad は縦向き（2列）と横向き（1列）の両方を見る。
      とくに 1024×768 は幅が足りるのに縦が短く、いまいちばん余裕が無い。 */
const SIZES = [
  [1440, 780, 'オーナーの画面'],
  [1680, 900, '大きい画面'],
  [1180, 820, 'iPad 横向き'],       // ★2026-09-24 追加（オーナーが iPad/iPhone も見ると言ったため）
  [1024, 768, 'iPad 横向き・低い'],  // ★いまいちばん苦しい形。幅は足りるのに縦が 768px しかない
  [820, 1180, 'iPad 縦向き'],       //    縦向きは2列（3段の見出し＋右に電話）・低い横向きは1列
  [390, 844, 'スマホ'],
];
const PAGES = [['/index.html', '日本語'], ['/en/index.html', '英語']];

let fail = 0, pass = 0;
const ok = (m) => { pass++; console.log(`  ✅ ${m}`); };
const ng = (m) => { fail++; console.log(`  ❌ ${m}`); };

const browser = await puppeteer.launch({ headless: 'new' });

for (const [path, lang] of PAGES) {
  for (const [w, h, label] of SIZES) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(BASE + path, { waitUntil: 'networkidle0' });

    /* 帯のカードは lp.js が後から入れる。入る前に測ると必ず通ってしまうので待つ。
       ⚠️ 時間で待たない（混んだ回に嘘の赤が出る）。件数が入ったことを条件にする。 */
    await page.waitForFunction(
      () => document.getElementById('hero-mq-track')?.children.length > 0
         && document.getElementById('hero-rv-track')?.children.length > 0,
      { timeout: 20000 },
    ).catch(() => {});

    const m = await page.evaluate(() => {
      const box = (s) => {
        const e = document.querySelector(s);
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom) };
      };
      return {
        vh: window.innerHeight,
        pay: box('.hero-strip:not(.hero-strip--rv)'),
        rv: box('.hero-strip--rv'),
        payCards: document.querySelectorAll('#hero-mq-track > *').length,
        rvCards: document.querySelectorAll('#hero-rv-track > *').length,
      };
    });
    await page.close();

    const head = `${lang} ${w}×${h}（${label}）`;
    if (!m.pay || !m.rv) { ng(`${head} — 帯が見つからない（.hero-strip / .hero-strip--rv）`); continue; }

    // A) 口コミの帯
    if (m.rv.bottom <= m.vh) ok(`${head} 口コミの帯が1画面に入っている（下端 ${m.rv.bottom} ≤ ${m.vh}）`);
    else ng(`${head} 口コミの帯が ${m.rv.bottom - m.vh}px はみ出している（下端 ${m.rv.bottom} > 画面 ${m.vh}）`);

    // B) 緑の帯
    if (m.pay.bottom <= m.vh) ok(`${head} 緑のカードの帯が1画面に入っている（下端 ${m.pay.bottom} ≤ ${m.vh}）`);
    else ng(`${head} 緑のカードの帯が ${m.pay.bottom - m.vh}px はみ出している`);

    // C) 中身
    if (m.payCards >= 2 && m.rvCards >= 2) ok(`${head} 帯にカードが入っている（緑 ${m.payCards} 枚・口コミ ${m.rvCards} 枚）`);
    else ng(`${head} 帯が空（緑 ${m.payCards} 枚・口コミ ${m.rvCards} 枚）＝高さだけ空いて中身が無い`);

    // D) 帯2本のあいだ
    const gap = m.rv.top - m.pay.bottom;
    if (gap === 10) ok(`${head} 帯2本のあいだが 10px`);
    else ng(`${head} 帯2本のあいだが ${gap}px（10px のはず。row-gap を変えたら .hero-strip--rv の負の margin も直す）`);
  }
}

await browser.close();

console.log(`\n${fail ? '❌' : '✅'} assert-hero-fold: ${pass} 件 OK / ${fail} 件 NG`);
if (fail) {
  console.log('\nヒーローの縦を詰める場所は lp.css の「★2026-09-24」の節にまとめてある。');
  console.log('効くのは 上余白・段の間・緑の面の高さ（.hero-panel の padding と .lp-phone の負の margin）の3つだけ。');
}
process.exit(fail ? 1 : 0);
