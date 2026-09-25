/* ════════════════════════════════════════════════════════════════
   assert-hero-fold.mjs — トップの帯2本が「最初の1画面」に入っているか

   なぜ要るか
     2026-09-24、オーナーの画面（1440×780）で **緑のカードの帯も口コミの帯も
     1画面に出ていなかった**（口コミ帯の下端が 969px ＝ 189px はみ出し）。
     ヒーローの余白を少し足すだけで簡単に戻る形で、しかも **画面は普通に動いたまま**
     ＝スクロールすれば見えるので、誰も壊れたと気づけない。
     帯2本は「本物のパイロットが出した数字と言葉」を最初の1画面で見せる装置なので、
     ここが画面外へ落ちるのは静かな機能停止にあたる。

   ★★ 2026-09-24 夜、この検査が全部 ✅ のままオーナーの実機（iPhone）では
      帯が1本も見えていなかった。**この検査がブラウザのバーを数えていなかった。**
      `window.innerHeight` は 844/852 を返すが、実機では上のアドレスバー（約112px）と
      下のバー（約60px）に食われて、ページに使えるのは **約 680px** しかない。
      ⚠️ だから下の SIZES の高さは **「バーを引いたあとの、本当に見える高さ」**。
         端末の仕様表の数字（844 や 1180）に戻さない。戻した瞬間にこの検査は
         また嘘をつき始める。

   見るもの（日英 × 8つの大きさ）
     A) 緑の帯（上の段）の下端が画面に収まっているか ── **全サイズで必須**
     B) 口コミの帯（下の段）── PC と iPad 縦は完全に収まること。
        iPad 横とスマホは縦が足りないので **頭が覗いていれば可**
        （2026-09-24 オーナー判断「緑の帯だけ完全に入れる」。部品は1つも消さない）
     C) 帯にカードが実際に入っているか（高さだけ空いていて中身が空、を通さない）
     D) 帯2本のあいだが 10px のままか（片方だけ余白を変えると上下で塊に見えなくなる）

   実行: node serve.mjs を起動した状態で node assert-hero-fold.mjs
════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';

const BASE = 'http://localhost:3000';

/* 高さは全部「バーを引いた実寸」。'both' ＝ 帯2本とも完全に入る・'peek' ＝ 緑は完全で
   口コミは頭が覗けばよい。
   ⚠️ 段組みは **幅と高さの両方** で変わる（1100px 以上、または 768px 以上かつ
      高さ 1000px 以上で2列）。iPad は縦向き（2列）と横向き（1列）の両方を見る。
      ⚠️ iPad 縦の 1080 は「1000 以上」の側にぎりぎり居る。バーがもっと厚いブラウザでは
         1列に落ちるので 820×980 も並べてある（1列でも収まることの確認）。 */
const SIZES = [
  [1440, 780, 'オーナーの画面', 'both'],
  [1680, 900, '大きい画面', 'both'],
  [820, 1080, 'iPad 縦向き', 'both'],
  [820, 980, 'iPad 縦・バーが厚いとき（1列に落ちる）', 'both'],
  [1080, 730, 'iPad 横向き', 'peek'],
  [1024, 690, 'iPad 横向き・低い', 'peek'],  // 幅は足りるのに縦が短い。いちばん余裕が無い形
  [390, 680, 'iPhone（オーナーの実機）', 'peek'],
  [375, 640, '小さめの iPhone', 'peek'],
];
const PAGES = [['/index.html', '日本語'], ['/en/index.html', '英語']];

let fail = 0, pass = 0;
const ok = (m) => { pass++; console.log(`  ✅ ${m}`); };
const ng = (m) => { fail++; console.log(`  ❌ ${m}`); };

const browser = await puppeteer.launch({ headless: 'new' });

for (const [path, lang] of PAGES) {
  for (const [w, h, label, mode] of SIZES) {
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

    // A) 緑の帯 ── 全サイズで完全に入ること
    if (m.pay.bottom <= m.vh) ok(`${head} 緑のカードの帯が1画面に入っている（下端 ${m.pay.bottom} ≤ ${m.vh}）`);
    else ng(`${head} 緑のカードの帯が ${m.pay.bottom - m.vh}px はみ出している（下端 ${m.pay.bottom} > 画面 ${m.vh}）`);

    // B) 口コミの帯 ── PC/iPad 縦は完全に、それ以外は頭が覗いていれば可
    if (mode === 'both') {
      if (m.rv.bottom <= m.vh) ok(`${head} 口コミの帯も1画面に入っている（下端 ${m.rv.bottom} ≤ ${m.vh}）`);
      else ng(`${head} 口コミの帯が ${m.rv.bottom - m.vh}px はみ出している（この大きさでは2本とも入るはず）`);
    } else {
      const peek = m.vh - m.rv.top;
      if (peek > 0) ok(`${head} 口コミの帯の頭が ${peek}px 覗いている`);
      else ng(`${head} 口コミの帯が1ピクセルも見えていない（上端 ${m.rv.top} ≥ 画面 ${m.vh}）`);
    }

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
  console.log('広い幅で効くのは 上余白・段の間・緑の面の高さ（.hero-panel の padding と .lp-phone の負の margin）。');
  console.log('スマホ（max-width:639px）で効くのは 上余白・段の間・見出しの大きさ・文章まわりの余白。');
  console.log('⚠️ SIZES の高さは端末の仕様表ではなく「ブラウザのバーを引いた実寸」。大きい数字に戻さない。');
}
process.exit(fail ? 1 : 0);
