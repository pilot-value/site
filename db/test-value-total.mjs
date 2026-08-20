/* ════════════════════════════════════════════════════════════════
   test-value-total.mjs — 累計（PVViz.totals）が何を足して何を足さないか固定する。

   実行: node db/test-value-total.mjs   （サーバもDBも要らない）

   pay-viz.js を素の VM に読み込んで totals() を直接叩く。
   puppeteer も PGlite も要らないので速い。ここで見張るのは金額の正しさより
   「足してはいけないものを足していないか」。

   なぜこのテストが要るか:

   ① 累計は **画面でいちばん大きい数字** になる。ここが1桁ずれても、
      誰も「おかしい」と気づけない（本人にも正解が分からない）。
      式を機械で押さえるしかない。

   ② 為替。各月は **その行の fx_to_jpy** で円に直してから足す＝受け取った
      時点の価値。ここを最新レートに揃えると、為替が動いただけで過去の
      給料が増減する。定数に落ちていないことを、月ごとに違うレートで測る。

   ③ 会社の壁。§6 の差と §7 の線は同じ会社の中だけ（比較だから）。
      **累計だけは会社をまたぐ**（受け取った事実は転職で消えない）。
      sameAirline の絞り込みがこちらへ漏れると、転職した人の累計が
      静かに減る。減ったことは画面から分からない。

   ④ 額面は **総支給が分かる月ぜんぶ**、手取り・控除は **手取りを書いた月だけ**。
      控除は同じ部分集合の額面から引く＝画面の「額面 − 手取り = 控除」は
      その範囲の中で必ず合う。ここが崩れると、3つの数字が並んだまま計算が
      合わない画面になる（本人には正解が分からない）。
      総支給の作り方は3通りある（明細の実額／本人が書いた総支給／内訳から
      サーバが数えた月額）。かんたん入力の行で3つ目に落ちると、その月の
      ボーナスぶんだけ静かに目減りする。

   ⑤ 0件のとき null（¥0 ではない）。¥0 は「稼いでいない」に読めるが、
      実際は「まだ読み取れていない」。意味が違う。
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label} ${extra}`); }
};
// 円の足し算は浮動小数。1円未満のずれは許す（表示は必ず丸められる）
const near = (a, b) => a != null && b != null && Math.abs(a - b) < 1;

/* pay-viz.js は (function(w){ … }(window)) なので、window だけ渡せば動く。
   ★ PVCurrency を置かない＝fmt() のフォールバック側（生の円）を通す。
     ここで測るのは金額であって表示ではない。 */
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(ROOT, 'pay-viz.js'), 'utf8'), ctx, { filename: 'pay-viz.js' });
const V = ctx.window.PVViz;

console.log('\n読み込み');
ok(!!V, 'pay-viz.js が PVViz を出している');
ok(typeof V.totals === 'function', 'totals() がある');
ok(typeof V.grossOrig === 'function', 'grossOrig() がある');

/* 合成データ。★ 実物の明細の数字はこのリポジトリに1つも無い。
   金額は暗算で検算できる丸い数にしてある（テストが自分で足し直さないため）。 */
const mk = (y, m, over = {}) => Object.assign({
  airline: 'emirates', airline_other: null,
  period_year: y, period_month: m,
  currency: 'AED', fx_to_jpy: 40,
  net_pay_actual: 50000, deduction_total: 10000
}, over);

// ── ① 基本の足し算 ────────────────────────────────────────
console.log('\n① 足し算そのもの');
{
  const t = V.totals([mk(2025, 1), mk(2025, 2), mk(2025, 3)]);
  // 額面 60,000 AED × 40 = 2,400,000円/月 × 3ヶ月
  ok(near(t.gross, 7200000), '額面 = (手取り+控除) × レート × 3ヶ月', String(t.gross));
  ok(near(t.net, 6000000), '手取り = 50,000 × 40 × 3ヶ月', String(t.net));
  ok(near(t.deduct, 1200000), '控除 = 10,000 × 40 × 3ヶ月', String(t.deduct));
  ok(near(t.gross - t.net, t.deduct), '★ 額面 − 手取り = 控除（画面の3つの数字が必ず合う）');
  ok(t.months === 3 && t.total === 3 && t.skipped === 0, '枚数 3/3・スキップ0');
  ok(t.from.period_month === 1 && t.to.period_month === 3, '対象期間の端が最初と最後の月');
}

// ── ② 為替は行ごと ────────────────────────────────────────
console.log('\n② 各月をその行のレートで円に直してから足す');
{
  const t = V.totals([
    mk(2025, 1, { fx_to_jpy: 30 }),   // 額面 60,000 × 30 = 1,800,000
    mk(2025, 2, { fx_to_jpy: 40 }),   //              × 40 = 2,400,000
    mk(2025, 3, { fx_to_jpy: 50 })    //              × 50 = 3,000,000
  ]);
  ok(near(t.gross, 7200000), '違うレートの3ヶ月が、それぞれのレートで足される', String(t.gross));
  // 最新レート(50)で全月を揃えると 9,000,000 になる。そうなっていないこと
  ok(!near(t.gross, 9000000), '★ 最新レートで全月を換算し直していない');
  // 最初のレート(30)で揃えると 5,400,000
  ok(!near(t.gross, 5400000), '★ 最初のレートで全月を換算し直していない');
}

// ── ③ 会社をまたぐ ────────────────────────────────────────
console.log('\n③ 会社をまたいで足す（累計だけの決めごと）');
{
  const t = V.totals([
    mk(2025, 1, { airline: 'zipair', currency: 'JPY', fx_to_jpy: 1,
                  net_pay_actual: 900000, deduction_total: 300000 }),   // 1,200,000
    mk(2025, 2, { airline: 'zipair', currency: 'JPY', fx_to_jpy: 1,
                  net_pay_actual: 900000, deduction_total: 300000 }),   // 1,200,000
    mk(2025, 6)                                                          // 2,400,000（エミレーツ）
  ]);
  ok(near(t.gross, 4800000), '転職前2ヶ月＋転職後1ヶ月が全部入る', String(t.gross));
  ok(t.months === 3, '★ 最新の会社の1枚だけに絞られていない（sameAirline が漏れていない）');

  // 「一覧にない会社」も同じ扱い（会社を見ていないのだから当然だが、明示しておく）
  const t2 = V.totals([
    mk(2025, 1, { airline: 'other', airline_other: 'A社' }),
    mk(2025, 2, { airline: 'other', airline_other: 'B社' })
  ]);
  ok(t2.months === 2, '自由入力の別会社2社も両方入る');
}

// ── ④ 総支給が作れない行だけが落ちる ──────────────────────
console.log('\n④ 総支給が1通りも作れない行は落ちる');
{
  /* mk() の行は総支給の欄も年額も持たないので、手取り・控除・レートの
     どれかが欠けると3通りとも作れない＝落ちる。 */
  const CASES = [
    ['手取りが無い',   { net_pay_actual: null }],
    ['控除合計が無い', { deduction_total: null }],
    ['レートが無い',   { fx_to_jpy: null }],
    ['手取りが空文字', { net_pay_actual: '' }],
    ['控除が undefined', { deduction_total: undefined }]
  ];
  for (const [nm, over] of CASES) {
    const t = V.totals([mk(2025, 1), mk(2025, 2, over)]);
    ok(near(t.gross, 2400000) && near(t.net, 2000000),
       `${nm} 月は額面にも手取りにも入らない`, `gross=${t.gross} net=${t.net}`);
    ok(t.months === 1 && t.monthsNet === 1 && t.skipped === 1 && t.total === 2,
       `${nm}: 1枚中1枚・スキップ1・全2枚と数える`);
    ok(near(t.gross - t.net, t.deduct), `${nm}: それでも 額面 − 手取り = 控除`);
  }
  // 控除0は「控除が無かった月」で、読めなかった月ではない（無税国）
  const t0 = V.totals([mk(2025, 1, { deduction_total: 0 })]);
  ok(t0.months === 1 && near(t0.gross, 2000000) && near(t0.deduct, 0),
     '★ 控除 0 の月は落とさない（無税国の明細は控除ゼロが正しい）');
}

// ── ④b 手で入れた月も積む（2026-08-18）──────────────────────
console.log('\n④b 手取りを書いていない月も、総支給が分かれば額面に入る');
{
  /* かんたん入力で総支給だけ書いた月（手取りの欄が必須になる前の行）。 */
  const t = V.totals([mk(2025, 1), mk(2025, 2, {
    net_pay_actual: null, deduction_total: null, gross_monthly: 70000
  })]);
  ok(near(t.gross, 2400000 + 2800000), '総支給だけ書いた月も額面に入る', String(t.gross));
  ok(near(t.net, 2000000), '手取りは、手取りを書いた月だけの合計', String(t.net));
  ok(near(t.deduct, 400000),
     '★ 控除は手取りを書いた月の額面から引く（(60,000−50,000)×40）', String(t.deduct));
  ok(t.months === 2 && t.monthsNet === 1 && t.skipped === 0,
     '額面2ヶ月・手取り1ヶ月・落とした行なし');

  /* 内訳（基本給・パーディアム・住宅手当）だけで入れた月。総支給の欄そのものが
     空なので、サーバが数えた年額から月額を戻すしかない。 */
  const bd = mk(2025, 3, {
    currency: 'JPY', fx_to_jpy: 1, net_pay_actual: null, deduction_total: null,
    base_pay: 1080000, per_diem: 35000, housing_amount: 9000,
    annual_total_orig: 15488000, bonus_annual: 2000000
  });
  const u = V.totals([bd]);
  ok(near(u.gross, 1124000),
     '★ 内訳だけの月は (年額 − 年間賞与) ÷ 12 で積む＝本人が打った 1,080,000+35,000+9,000',
     String(u.gross));
  ok(u.months === 1 && u.monthsNet === 0 && u.skipped === 0, '額面1ヶ月・手取り0ヶ月');
  ok(u.net === null && u.deduct === null,
     '手取りが1ヶ月も無ければ手取り・控除は null（¥0 と言わない）');

  /* かんたん入力の行で3つ目の道に落ちると、その月の賞与ぶんだけ目減りする。 */
  const easy = mk(2025, 4, {
    currency: 'JPY', fx_to_jpy: 1, net_pay_actual: null, deduction_total: null,
    gross_monthly: 800000, bonus_month: 300000,
    annual_total_orig: 6000000, bonus_annual: 0
  });
  ok(V.grossOrig(easy) === 800000,
     '★ 総支給の欄がある行はそれを使う（サーバの月額 500,000 に落ちない）',
     String(V.grossOrig(easy)));

  /* 中身が何も無い行の年額は null ではなく 0 で来る。¥0 を総支給と呼ばない。 */
  ok(V.grossOrig(mk(2025, 5, {
    net_pay_actual: null, deduction_total: null, annual_total_orig: 0
  })) === null, '★ 年額 0 の行は ¥0 ではなく null');
}

// ── ⑤ 0件は null（¥0 と言わない）──────────────────────────
console.log('\n⑤ 足せる明細が1枚も無いとき');
{
  for (const [nm, rows] of [['0件', []], ['undefined', undefined],
                            ['全部欠け', [mk(2025, 1, { net_pay_actual: null })]]]) {
    const t = V.totals(rows);
    ok(t.gross === null && t.net === null && t.deduct === null,
       `${nm}: null を返す（¥0 は「稼いでいない」に読めるので言わない）`);
    ok(t.months === 0 && t.from === null && t.to === null && t.series.length === 0,
       `${nm}: 枚数0・期間なし・折れ線の点なし`);
  }
}

// ── ⑥ 積み上がりの折れ線 ──────────────────────────────────
console.log('\n⑥ series（積み上がりの running total）');
{
  const t = V.totals([mk(2025, 1), mk(2025, 2), mk(2025, 3)]);
  ok(t.series.length === 3, '点の数 = 足せた枚数');
  ok(t.series.every((s, i) => i === 0 || s.gross > t.series[i - 1].gross),
     '★ 単調に増える（累計なので下がることはない）');
  ok(near(t.series[t.series.length - 1].gross, t.gross), '最後の点 = 額面の合計');
  ok(near(t.series[t.series.length - 1].net, t.net), '最後の点 = 手取りの合計');
  ok(t.series.every((s) => s.r && s.r.period_month), '各点が元の明細を持っている（横軸ラベル用）');

  // 順番が狂って渡ってきても、時系列に直してから積む
  const u = V.totals([mk(2025, 3), mk(2025, 1), mk(2025, 2)]);
  ok(u.series.map((s) => s.r.period_month).join(',') === '1,2,3',
     '★ 順不同で渡されても月順に積む（線がジグザグにならない）');
  ok(u.from.period_month === 1 && u.to.period_month === 3, '順不同でも対象期間の端が正しい');
  ok(near(u.gross, t.gross), '順番を変えても合計は同じ');
}

// ── ⑦ grossOrig は原本通貨のまま ──────────────────────────
console.log('\n⑦ grossOrig()（総支給の唯一の式）');
{
  ok(V.grossOrig(mk(2025, 1)) === 60000,
     '原本通貨のまま返す（円に直さない＝月どうしの増減を為替で汚さない）');
  ok(V.grossOrig(mk(2025, 1, { net_pay_actual: null })) === null,
     '手取りも総支給も年額も無ければ null');
  ok(V.grossOrig(mk(2025, 1, { deduction_total: null })) === null,
     '控除も総支給も年額も無ければ null');
  ok(V.grossOrig(mk(2025, 1, { deduction_total: 0 })) === 50000, '控除0は 0 として足す');
  ok(V.grossOrig(mk(2025, 1, {
    net_pay_actual: null, deduction_total: null, gross_monthly: 70000
  })) === 70000, '本人が書いた総支給も原本通貨のまま返す');
}

// ── ⑧ chart() の valueAt が既存の呼び出しを壊していない ────
console.log('\n⑧ chart() の valueAt フック');
{
  /* ★ ここが本命。valueOf という名前にすると Object.prototype.valueOf が
     継承されていて typeof が常に 'function' になり、valueAt を渡していない
     既存の4箇所まで全部そちらへ落ちて線が消える。名前の事故を固定する。 */
  const rows = [
    { period_year: 2025, period_month: 1, fx_to_jpy: 1, annual_total_jpy: 12000000 },
    { period_year: 2025, period_month: 2, fx_to_jpy: 1, annual_total_jpy: 15000000 }
  ];
  const plain = V.chart(rows, 'annual', { width: 500, labelOf: (r) => String(r.period_month) });
  ok(/<svg/.test(plain) && /<path/.test(plain),
     '★ valueAt を渡さない既存の呼び出しは今までどおり線を描く');

  const cum = V.chart(rows, 'cum', {
    width: 500, valueAt: (r, i) => [100, 250][i], labelOf: (r) => String(r.period_month)
  });
  ok(/<svg/.test(cum), 'valueAt を渡すと key を無視して値を取る');
  ok(!/pay-viz/.test(cum) && cum !== plain, 'valueAt 版と既存版で別の線になる');

  // valueAt が null を返す点は落ちる（＝「使える月が無い」の文言に落ちる）
  const none = V.chart(rows, 'cum', { width: 500, valueAt: () => null, noMetric: 'なし' });
  ok(/なし/.test(none) && !/<svg/.test(none), 'valueAt が全部 null なら noMetric の文言を返す');
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
