/* db/test-year-report.mjs — マイレポートの「1年」（my-year.js）の計算の約束（2026-11-08）
   サーバも DB もブラウザも要らない。pay-viz.js と my-year.js を node の vm で読み、PVYear.calc を直接呼ぶ。

   守っていること（どれも、わざと壊すと赤くなることをこのファイルの最後で確かめる）
   ① 単価は「同じ月に額と数量の両方がある月」だけで数える（Σ額 ÷ Σ数量）。片方しか無い月を混ぜない。
   ② 「1時間多く飛ぶと」は4か月以上・相関がはっきりしているときだけ。3か月・ばらばらの記録では出さない。
   ③ 「単価が変わる点」は両側3か月以上・直線より誤差が半分以下のときだけ。まっすぐな記録・片側2か月では出さない。
   ④ 書いていない項目は 0 で埋めない（カード・行・小さなグラフ・合計ごと出さない）。
   ⑤ 金額は各月のレートで円に直してから足す（累計と同じ）。
   ⑥ 年間のボーナス・プロフィットシェアは毎月の行に同じ額が持ち越される＝足さない。その年のいちばん新しい申告を1回だけ
      （その行のレートで円に）。0 は「無い」＝出さない。 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIZ = fs.readFileSync(path.join(ROOT, 'pay-viz.js'), 'utf8');
const SRC = fs.readFileSync(path.join(ROOT, 'my-year.js'), 'utf8');

function load(src) {
  const win = { document: { documentElement: { getAttribute: () => 'ja' }, addEventListener() {} }, addEventListener() {} };
  win.window = win;
  const ctx = vm.createContext(win);
  vm.runInContext(VIZ, ctx);
  vm.runInContext(src, ctx);
  return win.PVYear;
}

/* 行の作り物（原本通貨・レートつき）。年額は総支給 × 12（pv_annual_total と同じ組み方・賞与なし） */
function row(m, o) {
  const r = Object.assign({
    period_year: 2026, period_month: m, currency: 'AED', fx_to_jpy: 40, fx_to_usd: 0.27,
    gross_monthly: 60000, per_diem: 4000, flight_variable_pay: null,
    block_hours: null, duty_hours: null, night_hours: null, sectors: null, stay_nights: null, duty_days: null, days_off: null,
    guaranteed_hours: null, bonus_annual: 0, profit_share_annual: 0, variable_by_basis: null
  }, o || {});
  r.annual_total_orig = r.gross_monthly * 12;
  return r;
}

function checks(Y) {
  const fails = [];
  const ok = (c, msg) => { if (!c) fails.push(msg); };

  // ① 深夜手当：3か月とも額はあるが、2月だけ夜間の時間が無い → 2月は額も時間も数えない
  const R1 = [
    row(1, { block_hours: 80, night_hours: 10, variable_by_basis: { night: 500 } }),
    row(2, { block_hours: 80, night_hours: null, variable_by_basis: { night: 9000 } }),
    row(3, { block_hours: 80, night_hours: 20, variable_by_basis: { night: 1000 } })
  ];
  const m1 = Y.calc(R1, 2026);
  const night = m1.rates.find((x) => x.k === 'vb-night');
  ok(night && Math.abs(night.rate - (1500 * 40) / 30) < 1e-6, '① 深夜の時給は両方そろった月だけ（Σ額 ÷ Σ時間）');
  ok(night && night.qty === 30 && night.months.length === 2, '① 片方しか無い月は数量にも月ごとの線にも入れない');

  // ② 傾き：3か月では出さない／4か月以上でまっすぐなら出す／ばらばらなら出さない
  const lin = (n) => Array.from({ length: n }, (_, i) => row(i + 1, { block_hours: 70 + i * 5, gross_monthly: 50000 + (70 + i * 5) * 100 }));
  ok(!Y.calc(lin(3), 2026).ins.slope, '② 3か月では「1時間多く飛ぶと」を出さない');
  const s4 = Y.calc(lin(4), 2026).ins.slope;
  ok(s4 && Math.abs(s4.v - 100 * 40) < 1e-6, '② 4か月で、傾き（1時間あたり ¥4,000）を出す');
  /* 右上がりだが、ばらつきが大きい（相関が弱い）記録 */
  const noisy = [70, 75, 80, 85, 90, 95].map((h, i) => row(i + 1, { block_hours: h, gross_monthly: [55000, 61000, 50000, 62000, 52000, 60000][i] }));
  ok(!Y.calc(noisy, 2026).ins.slope, '② 相関がはっきりしない記録では出さない');

  // ③ 単価が変わる点
  const hinge = [62, 66, 70, 73, 78, 82, 86, 90, 94].map((h, i) => row(i + 1, {
    block_hours: h, variable_by_basis: { block: Math.min(h, 75) * 60 + Math.max(0, h - 75) * 150 + [5, -8, 3, -2, 6, -4, 2, -6, 4][i] }
  }));
  const k = Y.calc(hinge, 2026).kink;
  ok(k && Math.abs(k.t - 75) <= 2, '③ 折れ目（約75h）を見つける');
  ok(k && k.above > k.below * 1.2, '③ 超えた側の単価が高い');
  const straight = [62, 66, 70, 73, 78, 82, 86, 90, 94].map((h, i) => row(i + 1, { block_hours: h, variable_by_basis: { block: h * 100 + [5, -8, 3, -2, 6, -4, 2, -6, 4][i] } }));
  ok(!Y.calc(straight, 2026).kink, '③ まっすぐな記録には折れ目を出さない');
  /* ゆるく曲がっていて、ばらつきもある記録＝折れ線のほうが少し合うが、はっきりした折れ目とは言えない */
  const soft = [62, 66, 70, 73, 78, 82, 86, 90, 94].map((h, i) => row(i + 1, { block_hours: h,
    variable_by_basis: { block: h * 100 + 0.6 * (h - 62) * (h - 62) + [300, -500, 250, -400, 450, -350, 200, -450, 380][i] } }));
  ok(!Y.calc(soft, 2026).kink, '③ はっきりしない曲がり方には折れ目を出さない（直線より誤差が半分以下のときだけ）');
  const oneSide = [62, 66, 80, 82, 86, 90, 94].map((h, i) => row(i + 1, {
    block_hours: h, variable_by_basis: { block: Math.min(h, 75) * 60 + Math.max(0, h - 75) * 150 }
  }));
  const k2 = Y.calc(oneSide, 2026).kink;
  ok(!k2 || (k2.nBelow >= 3 && k2.nAbove >= 3), '③ 折れ目の片側が2か月以下なら出さない');

  // ④ 書いていない項目は出さない
  const bare = [row(1, { block_hours: 80 }), row(2, { block_hours: 82, duty_days: 17 })];
  const mb = Y.calc(bare, 2026);
  ok(mb.tiles.days == null, '④ 勤務日数が欠けた月があれば、合計を出さない（0 にしない）');
  ok(!mb.smalls.some((s) => s.k === 'night' || s.k === 'sectors' || s.k === 'stay'), '④ 書いていない深夜・セクター・ステイの小さなグラフを出さない');
  ok(!mb.rates.some((x) => x.k === 'vb-night' || x.k === 'vb-sector'), '④ 額の無い変動給の行を出さない');
  ok(!mb.ins.guar, '④ 保証時間を書いていなければ「保証を超えた月」を出さない');

  // ⑤ 月ごとのレートで足す
  const fx = [row(1, { gross_monthly: 1000, fx_to_jpy: 100 }), row(2, { gross_monthly: 1000, fx_to_jpy: 200 })];
  ok(Y.calc(fx, 2026).tiles.gross === 300000, '⑤ 総支給の合計は各月のレートで円にしてから足す');

  // ⑥ ボーナス（年間の申告）
  const b3 = [1, 2, 3].map((m) => row(m, { bonus_annual: 50000 }));
  ok(Y.calc(b3, 2026).tiles.bonus === 50000 * 40, '⑥ 3か月に同じ年間ボーナスがあっても1回だけ数える');
  const bNew = [row(1, { bonus_annual: 30000 }), row(2, { bonus_annual: 60000, fx_to_jpy: 50 }), row(3, { bonus_annual: null, profit_share_annual: null })];
  ok(Y.calc(bNew, 2026).tiles.bonus === 60000 * 50, '⑥ いちばん新しい申告を、その行のレートで（空の月は飛ばす）');
  ok(Y.calc([row(1), row(2)], 2026).tiles.bonus == null && Y.calc([row(1), row(2)], 2026).tiles.profit == null, '⑥ 0 は出さない');
  ok(Y.calc([row(1, { profit_share_annual: 42000 })], 2026).tiles.profit === 42000 * 40, '⑥ プロフィットシェアも同じ');

  return fails;
}

let pass = 0, fail = 0;
const say = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };

console.log('▼ いまの my-year.js');
const now = checks(load(SRC));
say(now.length === 0, '約束①〜⑤がすべて守られている' + (now.length ? '：' + now.join(' / ') : ''));

/* ▼ 壊す証明：守りの1行を外すと、上の検査が赤くなること */
console.log('▼ 壊す証明');
const BREAK = [
  ['① 片方しか無い月を混ぜる', 'if (a > 0 && q > 0) { amt += a; qty += q;', 'if (a > 0) { amt += a; qty += (q || 0);'],
  ['② 3か月でも傾きを出す', 'if (P.length >= 4) {', 'if (P.length >= 3) {'],
  ['② 相関を見ない', 'f.b > 0 && f.r >= 0.5', 'f.b > 0'],
  ['③ 直線と比べない', "if (!(best.e <= lin.e * 0.5)) return null;", ''],
  ['③ 片側の月数を見ない', 'if (nb < 3 || na < 3) continue;', 'if (nb < 1 || na < 1) continue;'],
  ['④ 欠けた月を 0 として合計する', "days: all('days') ? tot('days') : null", "days: tot('days')"],
  ['⑤ 最後の月のレートでまとめて換算する', 'gross: (g != null && fx) ? g * fx + V.unionOutsideJpy(r) + V.perdiemOutsideJpy(r) : null,',
    'gross: (g != null && fx) ? g * num(list[list.length - 1].fx_to_jpy) + V.unionOutsideJpy(r) + V.perdiemOutsideJpy(r) : null,'],
  ['⑥ 毎月の年間ボーナスを足し上げる', "tiles.bonus = lastDecl('bonus_annual');",
    "tiles.bonus = sum(list.map(function (r) { return (num(r.bonus_annual) || 0) * num(r.fx_to_jpy); })) || null;"],
  ['⑥ 0 を出す', 'if (v != null && fx) return v > 0 ? v * fx : null;', 'if (v != null && fx) return v * fx;']
];
for (const [name, from, to] of BREAK) {
  if (SRC.split(from).length !== 2) { say(false, `${name}：差し替える1行が my-year.js に1回だけ無い（検査が古い）`); continue; }
  const broken = SRC.replace(from, () => to);
  let f;
  try { f = checks(load(broken)); } catch (e) { f = ['読み込めない: ' + e.message]; }
  say(f.length > 0, `${name} → 赤くなる（${f.length}件）`);
}

/* ▼ my-value.js が後から読む部品の指紋（YEAR_V / SAMPLE_V / 勤務ロスターの4本 / 分析の2本）が中身と一致する（.js は4時間覚えられる＝ずれると古い部品が残る） */
console.log('▼ 後から読む部品の指紋');
{
  const { createHash } = await import('crypto');
  const mv = fs.readFileSync(path.join(ROOT, 'my-value.js'), 'utf8');
  /* ★2026-11-09 勤務ロスターのタブが後から読む4本も同じ決まり（タブを開いたときだけ読む） */
  for (const [name, file] of [['YEAR_V', 'my-year.js'], ['SAMPLE_V', 'my-value-sample.js'],
    ['ROSTER_V', 'my-roster.js'], ['ROSTER_CSS_V', 'my-roster.css'], ['UPLOAD_V', 'roster-upload.js'], ['ENGINE_V', 'pv-report-engine.js'],
    /* ★分析のタブ（2026-11-09）も同じ決まり */
    ['ANALYSIS_V', 'my-analysis.js'], ['ANALYSIS_CSS_V', 'my-analysis.css'],
    /* ★スケジュールの地球儀（2026-11-12）も同じ決まり */
    ['GLOBE_V', 'my-globe.js'], ['GLOBE_CSS_V', 'my-globe.css'], ['AIRPORT_GEO_V', 'pv-airport-geo.js'], ['GLOBE_LAND_V', 'pv-globe-land.js'], ['GLOBE_COAST_V', 'pv-globe-coast.js']]) {
    const want = createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex').slice(0, 8);
    const m = mv.match(new RegExp('var ' + name + " = '([0-9a-f]{8})';"));
    say(m && m[1] === want, name + '（' + file + '）の指紋が中身と一致' + (m && m[1] !== want ? '：' + m[1] + ' → ' + want + ' に直す' : ''));
  }
}

/* ▼ 給与フォームは、変動給の種類ごとの額（variable_by_basis）を読まない＝翌月の初期値に使わない（pv_pay_items_shape の決まり） */
console.log('▼ 給与フォーム');
for (const f of ['pay-report.html', 'en/pay-report.html', 'es/pay-report.html', 'pay-wizard.js', 'payslip.js']) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  say(!fs.readFileSync(p, 'utf8').includes('variable_by_basis'), f + ' は variable_by_basis を読まない');
}

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
