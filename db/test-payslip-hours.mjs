/* ════════════════════════════════════════════════════════════════
   日本様式の明細で「時給の分母」と「支給合計」が壊れないことを測る。

   なぜこのテストが要るか（現実の様式を見て分かったこと）:

   ① 日本の明細の時間は 60進で「111H59」と印字される。111.59 ではなく
      111時間59分＝111.98時間。取り違えると分母が小さくなり、
      時給が実際より高く出る＝こちらが煽る方向に外れる。

      ※実測（2026-08-04・合成の日本様式1枚）では、モデルは 120H30 を
        自前で 120.5 に直して返してきた。つまり「日本様式だと時間が読めない」
        という故障は本番では観測されていない。直したのは別の理由：
        モデルが "111H59" を文字のまま返した場合、旧実装は H を落として
        11159 と読み、上限(900)超えで黙って捨てる（＝分母が消える）。
        そして 120.30 と返された場合、受け取る側にはそれが正しい10進なのか
        60進の読み違いなのか区別する術が無い。
        だから raw（印字そのまま）をもらって、割り算はこちらでやる。
        モデルの気分に左右される所を、決まった動きに変えるための変更。

   ② 支給欄にはマイナスが立つ（不就労減額）。旧実装は amount<=0 を
      黙って捨てていた。★これは実測で確認された故障：合成明細の
      -18,000 が earnings にも unmapped にも現れず、支給の合計が
      1,052,000（正解は 1,045,000）になった。ずれる向きは
      「収入が多く見える」側＝いちばん危ない向き。

   ③ 同じ項目が支給と控除に同額で立つ（航空券課税＝現物給与の課税処理）。
      手取りは1円も動かないので、収入に数えると水増しになる。
      ★実測では unmapped に落ちていた＝本人に「これはどれですか」と聞き、
      「その他手当」と答えられたら分子に入ってしまう所だった。

   ★ここで検算に使う数字は db/fixtures/payslip-jp-compact.png と同じ
     完全な作り話。現実の明細の数字はこのリポジトリに1つも無い。

   実行: node db/test-payslip-hours.mjs
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(ROOT, 'supabase/functions/parse-payslip/index.ts'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };
const eq = (got, want, m) => ok(got === want, `${m}  → ${JSON.stringify(got)}${got === want ? '' : ` （期待 ${JSON.stringify(want)}）`}`);
const near = (got, want, tol, m) =>
  ok(got !== null && Math.abs(got - want) <= tol, `${m}  → ${got}${got !== null && Math.abs(got - want) <= tol ? '' : ` （期待 ${want}±${tol}）`}`);

/* Edge Function の関数を、そのソースから切り出してそのまま動かす。
   写経した複製を測ると「テストは通るが本番は直っていない」が起きるので、
   本物のソースを読んで評価する。 */
function lift(name) {
  const i = SRC.indexOf(`function ${name}(`);
  if (i < 0) throw new Error(`${name} が index.ts に無い`);
  let d = 0, j = SRC.indexOf('{', i);
  for (let k = j; k < SRC.length; k++) {
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}' && --d === 0) { j = k + 1; break; }
  }
  const body = SRC.slice(i, j)
    .replace(/:\s*unknown/g, '').replace(/:\s*number \| null/g, '')
    .replace(/:\s*Parsed\b/g, '').replace(/\bas\s+readonly\s+string\[\]/g, '')
    .replace(/\bas\s+const\b/g, '').replace(/<[^<>()]*>\(/g, '(');
  return eval(`(${body.replace(/^function\s+\w+/, 'function')})`);
}
const parseHours = lift('parseHours');

// ═══ ① 60進の読み取り ═══════════════════════════════════════════
console.log('\n① 「111H59」は 111.59 ではない');
near(parseHours('111H59'), 111 + 59 / 60, 0.001, '111H59 → 111時間59分');
eq(parseHours('55H00'), 55, '55H00 → 55.0');
near(parseHours('3H14'), 3 + 14 / 60, 0.001, '3H14 → 3時間14分');
eq(parseHours('5H'), 5, '5H → 5.0（分の欄が無い）');
near(parseHours('120H30'), 120.5, 0.001, '120H30 → 120.5');
near(parseHours('78:12'), 78.2, 0.001, '78:12 → 78.2（欧米のコロン表記）');
near(parseHours('164:30'), 164.5, 0.001, '164:30 → 164.5');
near(parseHours('111時間59分'), 111 + 59 / 60, 0.001, '111時間59分');
near(parseHours('１２０Ｈ３０'), 120.5, 0.001, '全角でも読める');
eq(parseHours('78.2'), 78.2, '78.2 は素の10進としてそのまま');
eq(parseHours(76.3), 76.3, '数字で来たらそのまま');

console.log('\n①-b 読めないものは黙って通さない');
eq(parseHours('111H73'), null, '分が60以上＝読み違い。捨てる');
eq(parseHours(''), null, '空欄（明細に印字だけあって中身が無い）');
eq(parseHours('—'), null, '記号だけ');
eq(parseHours(null), null, 'null');

console.log('\n①-c モデルが文字のまま返してきたときの備え（実測では起きていない）');
const naive = parseFloat(String('111H59').replace(/[^0-9.\-]/g, ''));
eq(naive, 11159, '旧実装なら "111H59" は 11159 になる（H が消えて連結）');
ok(naive > 900, 'そして上限900を超えて黙って捨てられる＝分母が消える');
ok(parseHours('111H59') < 900, '新実装は上限に引っかからない');
ok(parseHours('120.30') !== parseHours('120H30'),
   '★120.30 と 120H30 は別の値。数字だけ渡されると区別できないので raw をもらう');

// ═══ ② 支給合計との突き合わせ ═══════════════════════════════════
/* 合成明細 payslip-jp-compact.png と同じ（全部でたらめな）数字。 */
console.log('\n② 支給欄のマイナス行（不就労減額）');
const EARNINGS = [
  ['本給A', 150000, 'base'], ['本給B', 210000, 'base'],
  ['住宅手当', 8000, 'housing'], ['不就労減額', -18000, 'absence'],
  ['職務手当', 460000, 'command'],
  ['変動付加乗務時間', 160000, 'flight_variable'],
  ['深夜変動付加割増', 2000, 'flight_variable'],
  ['変動付加乗務回数', 11000, 'flight_variable'],
  ['深夜勤務割増手当', 6000, 'flight_variable'],
  ['土日祝出勤手当', 5000, 'flight_variable'],
  ['特別勤務割増手当', 40000, 'flight_variable'],
  ['航空券課税', 9000, 'notional'],
  ['株式積立奨励金', 2000, 'other'],
];
const GROSS = 1045000;   // 明細に印字された支給合計

const sum = EARNINGS.reduce((a, e) => a + e[1], 0);
eq(sum, GROSS, '13行を符号のまま足すと支給合計に一致する');

const dropped = EARNINGS.filter((e) => e[1] > 0).reduce((a, e) => a + e[1], 0);
eq(dropped, GROSS + 18000, '旧実装のようにマイナスを捨てると 18,000 多くなる');
ok(dropped > GROSS, 'ずれる向きが「収入が多く見える」側＝いちばん危ない向き');

console.log('\n③ 相殺項目（航空券課税）を収入に数えない');
const income = EARNINGS.filter((e) => e[2] !== 'notional').reduce((a, e) => a + e[1], 0);
eq(income, GROSS - 9000, '航空券課税を除いた額が時給の分子');
eq(GROSS - 375275, 669725, '支給合計 − 控除合計 ＝ 差引支給額（控除にも同額が立っている）');

console.log('\n③-b 不就労時間は分母から引かない');
/* 実測（2026-08-05）: 日本の様式では勤務時間 111H59 に不就労時間 5H は入っていない。
   引くと二重に差し引くことになり、分母が小さくなって時給が高く出る。 */
ok(/不就労時間 \/ absence hours/.test(SRC), 'モデルに不就労時間を hours として返させない');
ok(/勤務時間の欄に不就労時間は最初から入っていない/.test(readFileSync(path.join(ROOT, 'payslip.js'), 'utf8')),
   '分母から引かない理由がコードに残っている');

console.log('\n④ 分母が2つあること自体が商品');
const duty = parseHours('120H30'), block = parseHours('60H00');
near(income / block, 17266.67, 1, '乗務時間あたり（飛んでいた時間だけ）');
near(income / duty, 8597.51, 1, '勤務時間あたり（待機・地上まで含む）');
ok(income / block > income / duty * 1.9, '同じ明細で時給がおよそ半分になる');

// ═══ ⑤ 実装が本当にそうなっているか（ソースを見る）══════════════
console.log('\n⑤ index.ts 側の作りを確認');
ok(/const value = parseHours\(row\.raw\)/.test(SRC), '時間は印字そのまま(raw)を優先している');
ok(!/amount === null \|\| amount <= 0/.test(SRC), 'amount<=0 の切り捨てが残っていない');
ok(/amount === null \|\| amount === 0/.test(SRC), '0円行だけを落としている（マイナスは残す）');
ok(/'absence',/.test(SRC) && /'notional',/.test(SRC), 'absence と notional が語彙にある');
ok(/△▲/.test(SRC), '△・▲ のマイナス表記も読む');
ok(/ytd_taxable/.test(SRC), '累積課税支給額を拾っている');
ok(/NEVER return 組合費/.test(SRC), '組合名は返させない（どの組合かは極めて機微）');

const FRONT = readFileSync(path.join(ROOT, 'payslip.js'), 'utf8');
ok(/absence: 'f-other'/.test(FRONT), 'absence は符号のまま「その他手当」に足し込まれる');
ok(/kind === 'notional'/.test(FRONT), 'notional は分子から外している');
ok(!/notional:\s*'f-/.test(FRONT), 'notional に入力欄を割り当てていない（＝合計に入らない）');
ok(/notionalNote/.test(FRONT) && /not counted as income/.test(FRONT), '数えていないことを JP/EN で言っている');

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
