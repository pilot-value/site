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

   ④ 灰色が円の全部になる行（総支給しか無い人）は、図を出さずに
      見本のまま。灰色100%の円は何も言わないうえ、何かを言っているように見える。

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

// ── ③ 灰色しか無い行は図を出さない ────────────────────────
console.log('\n③ 総支給しか入っていない行は見本のまま');
{
  ok(V.segments(mk({ gross_monthly: 800000 })) === null,
     '★ 灰色100%の円は出さない（何も言っていないのに何か言っているように見える）');
  ok(V.segments(mk({ gross_monthly: 800000, per_diem: 0, bonus_month: 0,
                     housing_type: 'none', housing_amount: 0 })) === null,
     'パーディアム0・賞与0・住宅なしでも同じ（0 は「入れていない」と同じ扱い）');
  ok(V.segments(mk({ gross_monthly: 800000, housing_type: 'company', housing_amount: 150000 })) === null,
     '社宅（現物支給）だけの行も出さない（現金ではないので色が付かない）');
}

// ── ④ 手当が総支給を超える行 ──────────────────────────────
console.log('\n④ 手当の合計が総支給を超える行（別建て支給・入力違い）');
{
  ok(V.segments(mk({ gross_monthly: 300000, per_diem: 500000 })) === null,
     '★ 負のスライスを出すくらいなら図を出さない');
  ok(V.segments(mk({ gross_monthly: 300000, housing_type: 'allowance', housing_amount: 400000 })) === null,
     '住宅手当が総支給を超える行も同じ');
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
  ok(V.donut(mk({ gross_monthly: 800000 }), { title: 'x', name: nm }) === '',
     '灰色しか無い行は空を返す（呼ぶ側が見本を出す）');
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
    ok(/guarantee:\s*T\.segGuarantee/.test(src)
       && src.includes("segGuarantee: '保証給'") && /segGuarantee: 'Guaranteed pay'/.test(src),
       `${f}: ★ 保証給の語がある（無いと凡例が undefined になる）`);
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
