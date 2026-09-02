/* ════════════════════════════════════════════════════════════════
   test-value-breakdown.mjs — 支給構成の円グラフ（PVViz.segments）が
   「手で入れた人」にも嘘をつかずに出るかを固定する。

   実行: node db/test-value-breakdown.mjs   （サーバもDBも要らない）

   pay-viz.js を素の VM に読み込んで segments() を直接叩く。
   my-value.html（市場価値レポート）と profile.html（マイページ）は
   どちらもこの1本を読むので、ここが正しければ2画面とも正しい。

   なぜこのテストが要るか:

   ① 2026-08-18 まで、総支給を1本で出した行（かんたん入力）は
      図そのものが出なかった。写真を出した人だけ図が見られる状態で、
      レポート側は「明細からしか作れません」と嘘まで書いていた。

   ② かといって素直に描けない。2026-08-13 からパーディアムと住宅手当は
      全員に聞く欄になったので、そのまま円にすると
      **「パーディアムと住宅手当で100%」** という嘘の図になる。
      そこで総支給を円ぜんぶとし、説明できない残りを灰色に置いている。
      この「灰色を置く」判断がずれると、画面は静かに嘘をつく。

   ③ **内訳のある行（写真・くわしく入れる）は1円も変わってはいけない。**
      新しい枝が古い行に漏れると、既に見えている図が黙って変わる。

   ④ 灰色が円の全部になる行（総支給1本だけ出した人）にも**図を出す**
      （2026-09-02・オーナー指示で反転）。前は見本をぼかして出していたが、
      給与を出してくれた人の画面に自分の数字が1つも無い図が並ぶほうが悪い。
      灰色1色でも真ん中には本人の額が出る。ただし「手当ごとに入れると分かれる」の
      1行を必ず添えること（noBreakdown → notes.noBreakdown）。

   ⑤ 手当の合計が総支給を超える行（別建て支給・入力違い）は
      正しい図が描けない。負のスライスを出すくらいなら出さない。
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
const near = (a, b) => a != null && b != null && Math.abs(a - b) < 1;

/* pay-viz.js は (function(w){ … }(window))。window だけ渡せば動く。
   ★ PVCurrency を置かない＝fmt() は生の円。ここで測るのは金額であって表示ではない。 */
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(ROOT, 'pay-viz.js'), 'utf8'), ctx, { filename: 'pay-viz.js' });
const V = ctx.window.PVViz;

console.log('\n読み込み');
ok(!!V, 'pay-viz.js が PVViz を出している');
ok(typeof V.segments === 'function', 'segments() がある');

// 合成データ。★ 実物の明細の数字はこのリポジトリに1つも無い。
const base = { airline: 'zipair', currency: 'JPY', fx_to_jpy: 1, period_year: 2026, period_month: 7 };
const mk = (over) => Object.assign({}, base, over);
const val = (s, k) => (s.segs.find((x) => x.k === k) || { v: 0 }).v;
const keys = (s) => s.segs.map((x) => x.k).join(',');

// ── ① 内訳のある行は今までどおり ──────────────────────────
console.log('\n① 内訳を分けて入れた行（写真・くわしく入れる）は1円も変わらない');
{
  const s = V.segments(mk({
    base_pay: 500000, command_pay: 100000, other_allowance: 80000,
    flight_variable_pay: 30000, housing_type: 'allowance', housing_amount: 150000,
    transport: 20000, per_diem: 60000
  }));
  ok(!!s, '図が出る');
  ok(near(val(s, 'base'), 500000) && near(val(s, 'command'), 100000), '基本給・機長手当がそのまま');
  ok(near(val(s, 'flight'), 30000) && near(val(s, 'other'), 50000),
     '★ 乗務変動手当はその他手当の内訳なので二重に足さない（80,000 − 30,000）',
     `flight=${val(s, 'flight')} other=${val(s, 'other')}`);
  ok(near(s.total, 910000), '合計 = 50+10+8+15+2+6 万', String(s.total));
  ok(s.partial === false, '★ partial が立たない（基本給が分かっている＝割合を刷ってよい）');
  ok(val(s, 'rest') === 0 && val(s, 'bonus') === 0,
     '★ 灰色も賞与も生えない（新しい枝が古い行に漏れていない）', keys(s));

  // 賞与を入れていても、内訳の行では円に足さない（総支給を超えてしまうため）
  const b = V.segments(mk({ base_pay: 500000, per_diem: 60000, bonus_month: 900000 }));
  ok(val(b, 'bonus') === 0 && near(b.total, 560000),
     '★ 内訳の行では今月の賞与をスライスにしない', String(b.total));

  // 社宅（現物支給）は現金ではないので入れない
  const h = V.segments(mk({ base_pay: 500000, housing_type: 'company', housing_amount: 150000 }));
  ok(near(h.total, 500000), '社宅（現物支給）は円に入れない', String(h.total));
}

// ── ①-b 保証給（2026-08-26） ───────────────────────────────
console.log('\n①-b 保証給を入れた人のぶんが灰色に落ちない');
{
  const s = V.segments(mk({ base_pay: 400000, guarantee_pay: 100000, per_diem: 60000 }));
  ok(near(val(s, 'guarantee'), 100000),
     '★ 保証給に色が付く（足し忘れると「どの項目にも入れていない分」に落ちて、入れた本人に嘘をつく）',
     keys(s));
  ok(near(val(s, 'base'), 400000), '基本給に足し込まれていない（別の色で残る）', String(val(s, 'base')));
  ok(near(s.total, 560000), '合計 = 40 + 10 + 6 万', String(s.total));

  // 基本給が無く保証給だけの会社（米国型）
  const g = V.segments(mk({ gross_monthly: 500000, guarantee_pay: 300000 }));
  ok(near(val(g, 'guarantee'), 300000) && near(val(g, 'rest'), 200000),
     '★ 保証給だけの行でも灰色が減る（総支給 50 − 保証給 30 = 20 万）',
     `guarantee=${val(g, 'guarantee')} rest=${val(g, 'rest')}`);
  ok(g.partial === true, '基本給が分かっていないので partial は立ったまま');
}

// ── ② 総支給1本＋分かっている手当 ─────────────────────────
console.log('\n② かんたん入力（総支給1本）— 入っている分だけ色を付ける');
{
  const s = V.segments(mk({
    gross_monthly: 800000, per_diem: 60000,
    housing_type: 'allowance', housing_amount: 150000, bonus_month: 90000
  }));
  ok(!!s, '★ 図が出る（2026-08-18 まではここが null だった）');
  ok(near(s.total, 800000), '★ 円ぜんぶ = 総支給（中心の数字が総支給と一致する）', String(s.total));
  ok(near(val(s, 'housing'), 150000) && near(val(s, 'perdiem'), 60000) && near(val(s, 'bonus'), 90000),
     '住宅手当・パーディアム・今月の賞与に色が付く');
  ok(near(val(s, 'rest'), 500000), '説明できない残りが灰色に入る（80 − 15 − 6 − 9 万）', String(val(s, 'rest')));
  ok(val(s, 'base') === 0 && val(s, 'command') === 0,
     '★ 基本給・機長手当を0として刷らない（スライスが生えない）', keys(s));
  ok(s.partial === true, '★ partial が立つ（呼ぶ側は「基本給の割合」を出してはいけない）');
  ok(near(s.segs.reduce((a, x) => a + x.v, 0), s.total), 'スライスの合計 = 円の合計');

  // 灰色は最後（円を閉じる位置）
  ok(s.segs[s.segs.length - 1].k === 'rest', '灰色が最後に来る（描き順）', keys(s));
}

// ── ③ 灰色しか無い行にも図を出す（2026-09-02 に反転）──────
console.log('\n③ 総支給しか入っていない行にも円を出す');
{
  /* オーナー指示：「給与提出してくれた人にはマイレポートの支給構成の円グラフを出す」。
     本番に1件、かんたん入力で総支給1本だけ出した人がいて、その人だけ
     支給構成の節が**他人の割合の見本（ぼかし）**になっていた。 */
  const s = V.segments(mk({ gross_monthly: 800000 }));
  ok(s !== null, '★ 総支給1本だけの行でも図が返る（見本に落とさない）');
  ok(s && keys(s) === 'rest', '灰色1色（どの項目にも入れていない分）', s ? keys(s) : '(null)');
  ok(s && near(s.total, 800000), '円ぜんぶ＝その月の総支給', s ? String(s.total) : '');
  ok(s && s.noBreakdown === true,
     '★ noBreakdown が立つ（呼ぶ側はこれを見て「入れると分かれる」の1行を添える）');
  ok(s && s.partial === true, '基本給は分かっていない＝割合の1行は出さない');

  const z = V.segments(mk({ gross_monthly: 800000, per_diem: 0, bonus_month: 0,
                            housing_type: 'none', housing_amount: 0 }));
  ok(z && z.noBreakdown === true && keys(z) === 'rest',
     'パーディアム0・賞与0・住宅なしでも同じ（0 は「入れていない」と同じ扱い）');

  const h = V.segments(mk({ gross_monthly: 800000, housing_type: 'company', housing_amount: 150000 }));
  ok(h && h.noBreakdown === true && keys(h) === 'rest',
     '社宅（現物支給）だけの行も灰色1色（現金ではないので色が付かない）');
  ok(h && near(h.total, 800000), '★ 現物の社宅を円に足していない', h ? String(h.total) : '');

  /* ★ここは今までどおり空のまま。金額が1つも無い行に円は描けない。 */
  ok(V.segments(mk({ per_diem: 0 })) === null, '総支給も手当も無い行は今までどおり図なし');
  ok(V.segments(mk({ gross_monthly: 0 })) === null, '総支給が0の行も図なし（0円の円は描けない）');

  /* ★内訳を1つでも書いた行では noBreakdown が立たない＝
     「手当ごとに入れると分かれます」の1行が、既に分けて書いた人に出ない。 */
  const one = V.segments(mk({ gross_monthly: 800000, per_diem: 60000 }));
  ok(one && one.noBreakdown === false, '★ 手当を1つでも書いた行では noBreakdown が立たない');
}

// ── ④ 手当が総支給を超える行 ──────────────────────────────
console.log('\n④ 手当の合計が総支給を超える行（別建て支給・入力違い）');
{
  ok(V.segments(mk({ gross_monthly: 300000, per_diem: 500000 })) === null,
     '★ 負のスライスを出すくらいなら図を出さない');
  ok(V.segments(mk({ gross_monthly: 300000, housing_type: 'allowance', housing_amount: 400000 })) === null,
     '住宅手当が総支給を超える行も同じ');
}

// ── ④-b 組合が総支給の外で払われている行 ──────────────────
console.log('\n④-b 組合が総支給の外で払われている行（2026-09-02）');
{
  /* 本番で実際に起きた形。乗員代表で、会社の明細に印字された総支給より
     組合から直接受け取った額のほうが大きい月がある。

     ★この円は「**受け取った額**がどう分かれているか」に答える図。組合が総支給の
       外で払った分も**円に入れる**（2026-09-02、オーナー指摘）。入れないと、
       半分が組合から出ている人の円が会社ぶんだけになり、本人の実感と合わない。
       内訳を1つも書いていない人（本番の1件）は組合の額が唯一の色になるので、
       入れないと図そのものが出ない＝見本のまま何も見えない。
     ★**総支給ぜんぶ ＝ 会社から ＋ 組合から**（2026-09-02、オーナーが決めた定義）。
       だから「基本給が総支給に占める割合」の分母も、この円ぜんぶをそのまま使う。
       年収（pv_annual_total）も DEEP PAY の支給構成（cash_m）も同じ数え方 ＝
       **画面と集計で3つとも揃っている**。下の ⑧ で引き算が戻っていないか見張る。
     ★判定は自分でせず、サーバが付けてくる union_outside_gross をそのまま読む
       （pv_union_outside_gross が出す。年収の式と同じ1つの判定）。 */
  const out = V.segments(mk({ gross_monthly: 300000, base_pay: 200000,
                              union_pay: 700000, union_outside_gross: true }));
  ok(out !== null, '★ 組合が外でも図が消えない（消えていたのがこの件の症状）');
  ok(out && near(out.total, 1000000),
     '★ 円ぜんぶ＝総支給 ＋ 総支給の外の組合分（300,000 ＋ 700,000）',
     String(out && out.total));
  ok(out && val(out, 'union') === 700000,
     '★ 組合のスライスが生える（受け取った額なので）', String(out && val(out, 'union')));
  ok(out && val(out, 'rest') === 100000,
     '★ 灰色は総支給のうち説明できていない分だけ（300,000 − 200,000）',
     String(out && val(out, 'rest')));
  ok(out && out.outsideGross === undefined,
     '★ 総支給の外の額は返さない（引き算をする道具を置かない）',
     String(out && out.outsideGross));
  ok(out && !out.partial &&
     Math.round(val(out, 'base') / out.total * 100) === 20,
     '★ 基本給の割合は受け取った額ぜんぶで数える（200,000 / 1,000,000 ＝ 20%）',
     String(out && Math.round(val(out, 'base') / out.total * 100)));

  /* 会社の内訳を1つも書いていない行（本番の1件がこれ）。以前は円に色が付く分が
     無くなって図ごと消えていた。組合の額を入れるようになったので、
     「組合 70% / どの項目にも入れていない分 30%」の図が出る。 */
  const only = V.segments(mk({ gross_monthly: 300000, union_pay: 700000,
                               union_outside_gross: true }));
  ok(only !== null, '★ 組合しか書いていない行でも図が出る（見本のままにしない）');
  ok(only && val(only, 'union') === 700000 && val(only, 'rest') === 300000,
     '★ その図は 組合700,000 と どの項目にも入れていない分300,000 の2つ',
     String(only && val(only, 'union')) + ' / ' + String(only && val(only, 'rest')));
  ok(only && only.partial === true,
     '★ 基本給が分かっていないので「基本給の割合」は出さない（partial）');

  /* ★円の外に出す金額。ここが 0 のまま画面に出ないと、総支給と年換算の
     掛け算が合わない画面になる（オーナー指摘 2026-09-02）。 */
  ok(typeof V.unionOutsideJpy === 'function', 'unionOutsideJpy() がある');
  ok(V.unionOutsideJpy(mk({ union_pay: 700000, union_outside_gross: true })) === 700000,
     '★ 外の組合分をそのまま円で返す');
  ok(V.unionOutsideJpy(mk({ union_pay: 700000, union_outside_gross: false })) === 0,
     '★ 支給元が会社なら 0（総支給の中にあるので円の外に出さない）');
  ok(V.unionOutsideJpy(mk({ union_pay: 700000 })) === 0,
     '★ 列そのものが無い古い行も 0（undefined は足さない側）');
  ok(V.unionOutsideJpy(mk({ currency: 'AED', fx_to_jpy: 30, union_pay: 1000,
                            union_outside_gross: true })) === 30000,
     '★ 原本通貨はその行のレートで円に直す');

  /* ★支給元が会社（＝総支給の中）の行は今までどおり。ここが変わると
     会社払いの人の図が黙って大きくなる＝二重計上した図になる。 */
  ok(V.segments(mk({ gross_monthly: 300000, union_pay: 700000,
                     union_outside_gross: false })) === null,
     '★ 支給元が会社なら今までどおり（総支給を超える行は図を出さない）');
  ok(V.segments(mk({ gross_monthly: 300000, union_pay: 700000 })) === null,
     '★ 列そのものが無い古い行も今までどおり（undefined は足さない側）');
  const inn = V.segments(mk({ gross_monthly: 1000000, union_pay: 700000,
                              union_outside_gross: false }));
  ok(inn && near(inn.total, 1000000),
     '会社払いの行の円ぜんぶは総支給のまま', String(inn && inn.total));
  ok(inn && val(inn, 'union') === 700000,
     '会社払いの組合手当はスライスとして出る', String(inn && val(inn, 'union')));
}

// ── ⑤ ぴったり説明しきった行に灰色を生やさない ────────────
console.log('\n⑤ 端数の灰色を出さない（1円の遊び）');
{
  const s = V.segments(mk({ gross_monthly: 210000, per_diem: 60000,
                            housing_type: 'allowance', housing_amount: 150000 }));
  ok(s && val(s, 'rest') === 0, '★ ぴったりの行に灰色が生えない', keys(s || { segs: [] }));
  ok(near(s.total, 210000), '合計は総支給のまま', String(s.total));

  // 原本通貨 × レートの端数（0.3円ぶん）で灰色を生やさない
  const f = V.segments(mk({ currency: 'AED', fx_to_jpy: 30.1,
                            gross_monthly: 20000, per_diem: 5000,
                            housing_type: 'allowance', housing_amount: 15000 }));
  ok(f && val(f, 'rest') === 0, '★ 為替の端数ぶんの灰色も生やさない', keys(f || { segs: [] }));
}

// ── ⑥ 原本通貨は円に直してから描く ────────────────────────
console.log('\n⑥ 為替（各値はその行の fx_to_jpy で円に直す）');
{
  const s = V.segments(mk({ currency: 'AED', fx_to_jpy: 40,
                            gross_monthly: 30000, per_diem: 5000,
                            housing_type: 'allowance', housing_amount: 10000, bonus_month: 2000 }));
  ok(near(s.total, 1200000), '円ぜんぶ = 30,000 AED × 40', String(s.total));
  ok(near(val(s, 'housing'), 400000) && near(val(s, 'perdiem'), 200000) && near(val(s, 'bonus'), 80000),
     '各スライスも同じレートで円になっている');
  ok(near(val(s, 'rest'), 520000), '灰色も円（1,200,000 − 400,000 − 200,000 − 80,000）', String(val(s, 'rest')));

  ok(V.segments(mk({ fx_to_jpy: null, gross_monthly: 800000, per_diem: 60000 })) === null,
     'レートが無い行は図を出さない（円に直せない）');
}

// ── ⑦ donut() まで通す ────────────────────────────────────
console.log('\n⑦ donut()（画面に出る形）');
{
  const nm = { housing: '住宅手当', perdiem: 'パーディアム', bonus: '今月の賞与', rest: '内訳を入れていない分' };
  const html = V.donut(mk({ gross_monthly: 800000, per_diem: 60000,
                            housing_type: 'allowance', housing_amount: 150000, bonus_month: 90000 }),
                       { title: '2026年7月', name: nm });
  ok(/<svg/.test(html), '★ かんたん入力の行でも図の HTML が返る');
  ok(html.includes('内訳を入れていない分') && html.includes('今月の賞与'), '凡例に新しい2語が出る');
  ok(/63%/.test(html), '灰色の割合が出る（500,000 / 800,000 = 62.5%）');
  /* ★2026-09-02、灰色1色の行も図を返すようになった。 */
  const bare = V.donut(mk({ gross_monthly: 800000 }), { title: 'x', name: nm,
                       notes: { noBreakdown: '※ 手当ごとに分けて入れると、この灰色が項目ごとに分かれます。' } });
  ok(/<svg/.test(bare), '★ 灰色しか無い行でも図の HTML が返る（見本に落とさない）');
  ok(bare.includes('100%'), '灰色が100%と出る');
  ok(bare.includes('この灰色が項目ごとに分かれます'),
     '★ 何が足りないのかの1行が付く（付けないと「これで全部」と読まれる）');
  ok(!V.donut(mk({ gross_monthly: 800000 }), { title: 'x', name: nm }).includes('項目ごとに分かれます'),
     '断りを渡さなければ出ない（文言は画面側が持つ）');
  ok(V.donut(mk({ per_diem: 0 }), { title: 'x', name: nm }) === '',
     '金額が1つも無い行は今までどおり空を返す（呼ぶ側が見本を出す）');
}

// ── ⑧ 画面の文言が揃っているか ────────────────────────────
console.log('\n⑧ 名前の対応表（my-value.js / pay-tracker.js の両方）');
{
  for (const f of ['my-value.js', 'pay-tracker.js']) {
    const src = readFileSync(path.join(ROOT, f), 'utf8');
    ok(/bonus:\s*T\.segBonus/.test(src) && /rest:\s*T\.segRest/.test(src),
       `${f}: SEGNAME に bonus / rest がある（無いと凡例が undefined になる）`);
    ok(src.includes("segBonus: '今月の賞与'") && src.includes("segRest: 'どの項目にも入れていない分'"),
       `${f}: 日本語の語がある`);
    ok(/segBonus: 'Bonus this month'/.test(src) && /segRest: 'Not itemised'/.test(src),
       `${f}: 英語の語がある`);
    /* ★2026-08-26、札を2つの呼び名の併記にした（オーナー指示。同じ金額が会社に
       よって「保証給」とも「職務手当」とも呼ばれ、片方しか出ていないと
       もう片方の人が自分の明細のどこを写せばいいのか分からない）。
       列は guarantee_pay のまま。ここが「保証給」だけに戻ったら、それは
       画面の札も戻っているということ。 */
    ok(/guarantee:\s*T\.segGuarantee/.test(src)
       && src.includes("segGuarantee: '保証手当・職務手当'") && /segGuarantee: 'Guarantee \/ duty'/.test(src),
       `${f}: ★ 保証給の語が2つの呼び名を併記している（無いと凡例が undefined になる）`);
    /* ★教官・訓練の手当（2026-08-26 その3）。 */
    ok(/instructor:\s*T\.segInstructor/.test(src)
       && src.includes("segInstructor: '教官・訓練手当'") && /segInstructor: 'Instructor \/ training'/.test(src),
       `${f}: ★ 教官の語がある（無いと凡例が undefined になる）`);
    /* ★審査・査察の手当（2026-08-26 その4）。教官とは別のスライス。 */
    ok(/examiner:\s*T\.segExaminer/.test(src)
       && src.includes("segExaminer: '審査・査察手当'") && /segExaminer: 'Examiner \/ check'/.test(src),
       `${f}: ★ 審査の語がある（無いと凡例が undefined になる）`);
    /* ★組合・乗員代表の手当（2026-08-26 その5）。教官・審査ともまた別のスライス。 */
    ok(/union:\s*T\.segUnion/.test(src)
       && src.includes("segUnion: '組合・乗員代表手当'") && /segUnion: 'Union \/ representative'/.test(src),
       `${f}: ★ 組合の語がある（無いと凡例が undefined になる）`);
    /* ★管理・マネジメントの手当（2026-08-26 その6）。役割ごとの4本目のスライス。 */
    ok(/management:\s*T\.segManagement/.test(src)
       && src.includes("segManagement: '管理・マネジメント手当'")
       && /segManagement: 'Management \/ leadership'/.test(src),
       `${f}: ★ 管理職の語がある（無いと凡例が undefined になる）`);
    /* ★その他の兼務・配属（2026-08-27 その7）。役割ごとの5本目＝最後のスライス。 */
    ok(/nonline:\s*T\.segNonline/.test(src)
       && src.includes("segNonline: 'その他の兼務・配属手当'")
       && /segNonline: 'Other \/ non-line assignment'/.test(src),
       `${f}: ★ 兼務・配属の語がある（無いと凡例が undefined になる）`);
    /* ★組合が総支給の外で払った分も、受け取った額として円に入れている（2026-09-02）。
       会社の明細には印字されない額なので、その1点だけ断る。donut() は
       notes.unionOut を渡されたときだけ刷るので、**2画面とも渡していること**を
       ここで見張る。片方だけ直すと、その画面だけ「明細と合わない円」になる。 */
    ok(/notes:\s*\{[^}]*unionOut:\s*T\.unionOutNote/.test(src),
       `${f}: ★ donut() に unionOut の断りを渡している（無いと円から消えた額が無言になる）`);
    /* ★「基本給が総支給に占める割合」の分母は**円ぜんぶ**（＝受け取った額）。
       総支給は会社から＋組合から、というのがオーナーの決めた定義で、年収も
       DEEP PAY の支給構成も同じ数え方をしている。
       ⚠️ 2026-09-02 の一時期ここだけ組合の分を引いていた（明細に印字された額に
          戻すつもりだった）。同じ日に戻したので、**引き算が復活していないこと**を
          見張る。この1行は my-value.js にしか無い（pay-tracker は割合を刷らない）。 */
    if (f === 'my-value.js') {
      ok(!/outsideGross/.test(src),
         `${f}: ★ 基本給の割合の分母から引き算していない（円ぜんぶで割る）`);
      ok(/mv-ratio"><b>' \+ basePc \+ '%/.test(src),
         `${f}: ★ 刷っているのは basePc（円ぜんぶで割った pc ではない）`);
      /* ★灰色1色の行では「固定/変動/判別できない」の3本棒を出さない。
         出すと「判別できない 100%」と刷るだけで、何も言っていない。
         代わりに入口（pt-btn）を1つ置いて、Give & Get の Get 側にする。 */
      ok(/if \(s && s\.noBreakdown\)[\s\S]{0,220}pt-btn/.test(src),
         `${f}: ★ 灰色1色の行は「円＋入口」で返す（3本棒を刷らない）`);
      /* ★見本（ぼかし）の道は残す。円そのものが描けない行はまだあるため
         （その月の総支給が無い・レートが無い・手当の合計が総支給を大きく超える）。 */
      ok(/if \(!dn\) return sec\(T\.breakdown, maskSample\(sampleBreakdown\(\), T\.noBd\)\)/.test(src),
         `${f}: 円が描けない行の見本は残っている`);
    }
    /* ★灰色1色の円（総支給1本だけの月）には「手当ごとに入れると分かれます」の
       1行を必ず添える（2026-09-02）。添えないと、灰色100%の円が
       「これで全部」に見える。2画面とも渡していることを見張る。 */
    ok(/notes:\s*\{[^}]*noBreakdown:\s*T\.restOnly/.test(src),
       `${f}: ★ donut() に noBreakdown の1行を渡している（無いと灰色100%が言い放しになる）`);
    ok(src.includes('restOnly:') && src.includes('この灰色が項目ごとに分かれます'),
       `${f}: restOnly の日本語がある`);
    ok(/restOnly: '※ Enter your pay allowance by allowance and this grey circle splits/.test(src),
       `${f}: restOnly の英語がある`);
    ok(src.includes('unionOutNote:') && src.includes('この円に入れています'),
       `${f}: 日本語の断りがある`);
    ok(/unionOutNote: '※ Money your union pays you directly/.test(src),
       `${f}: 英語の断りがある`);
  }
  const mv = readFileSync(path.join(ROOT, 'my-value.js'), 'utf8');
  /* ★「固定 / 変動 / 判別できない」の3本のバケツ。segments() のスライスを
     ひとつ残らず、どれか1本に入れる約束。落とすと3本の合計が円ぜんぶに届かず、
     割合が静かにズレる（2026-08-26、保証給を足したときに実際そうなっていた）。 */
  {
    const grab = (name) => {
      const m = mv.match(new RegExp('var ' + name + '\\s*=([^;]*);'));
      return m ? [...m[1].matchAll(/v\.([a-z]+)/g)].map((x) => x[1]) : [];
    };
    const buckets = [...grab('fixed'), ...grab('vari'), ...grab('unk')];
    const all = Object.keys(V.segments(mk({ base_pay: 1, guarantee_pay: 1 })).vals);
    ok(buckets.includes('guarantee'),
       '★ 保証給が3本のどれかに入っている（毎月かならず出る下限なので「固定」）', buckets.join(','));
    /* ★教官の手当は担当したセッション数・日数で月ごとに変わるので「変動」。
       職位手当・変動給・その他の現金手当とは**別の入れ物**なので、
       どれかに紛れ込ませず1本の独立したスライスとして数える。 */
    ok(buckets.includes('instructor'),
       '★ 教官の手当が3本のどれかに入っている（変動）', buckets.join(','));
    /* ★審査の手当も同じ理由で「変動」。担当した Check の回数で月ごとに変わる。
       教官と同じ本に入るが、スライスとしては別々（同じお金を2回数えないため）。 */
    ok(buckets.includes('examiner'),
       '★ 審査の手当が3本のどれかに入っている（変動）', buckets.join(','));
    /* ★組合の手当も同じ理由で「変動」。活動した日数で月ごとに変わる。
       ⚠️ この列だけ会社が払っているとは限らない（支給元は pay_items.union.source）。
          支給元が組合のときは総支給の**外**にあるので、segments() が円から外す
          （④-b を見よ）。3本のバケツに入れておくのは、会社が払っている
          ふつうの行のため。外の行では union が 0 になるだけで矛盾しない。 */
    ok(buckets.includes('union'),
       '★ 組合の手当が3本のどれかに入っている（変動）', buckets.join(','));
    /* ★管理職の手当も同じ理由で「変動」。管理業務にあたった日数で月ごとに変わる。
       ⚠️ 組合と違い、この額は会社が払う＝総支給の中にある。それでも図は
          「その月にいくら受け取ったか」を描くので、スライスとしての扱いは同じ。 */
    ok(buckets.includes('management'),
       '★ 管理職の手当が3本のどれかに入っている（変動）', buckets.join(','));
    /* ★兼務・配属の手当も同じ理由で「変動」。関連する業務にあたった日数で月ごとに変わる。
       ⚠️ 出向の場合、その額を出向先が払っていて会社の明細に載っていないことがあるが、
          図は「その月にいくら受け取ったか」を描くので扱いは同じ。 */
    ok(buckets.includes('nonline'),
       '★ 兼務・配属の手当が3本のどれかに入っている（変動）', buckets.join(','));
    const miss = all.filter((k) => !buckets.includes(k));
    ok(miss.length === 0, '★ segments() のスライスが1つも取りこぼされていない', miss.join(','));
    ok(new Set(buckets).size === buckets.length,
       '★ 同じスライスを2本に入れていない（二重に数えない）', buckets.join(','));
  }
  ok(!/明細からしか作れません/.test(mv),
     '★ my-value.js から「明細からしか作れません」が消えている（手で分けて入れても出るので嘘）');
  ok(/s\.partial \? ''/.test(mv),
     '★ partial の行では「基本給が総支給に占める割合」を出さない（0% と刷らないため）');
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
