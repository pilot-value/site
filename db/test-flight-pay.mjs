/* db/test-flight-pay.mjs — 便ごとの稼ぎ（目安）pv-report-engine.js の flightPay（2026-11-12）
   サーバも DB もブラウザも要らない。pay-viz.js と pv-report-engine.js を node の vm で読み、PVReport.flightPay を直接呼ぶ。
   データはすべて作り物（実在の給与・ロスター・氏名は使わない）。

   見ていること（オーナー回答「時給＋手当」）
   ・地上勤務の多い月でも便の額が膨らまない（総支給 ÷ 飛んだ時間 × 便の時間 にならない）
   ・1か月の便の額と、便の無い勤務の額を足すと、その月に割り当てたお金にぴったり戻る
   ・便乗に乗務手当・日当が付かない／総支給だけの明細は「総支給 ÷ 勤務時間ぜんぶ」
   ・賞与・組合から総支給の外で出た分を入れない／「飛んだ分は翌月の明細」の答え（pay_lag）どおりに月を結ぶ
   ・明細が無い月・スケジュールが月の一部の月・便の時間が分からない便は額を出さない（推測で埋めない）
   ・地球儀の字に「単価」「料率」を使わない
   ★2026-11-13 勤務時間の数え方の穴（オーナーの相談 → ChatGPT と点検）
   ・訓練などの勤務コードだけの日（時刻も地上の行も無い）を落とさない＝時給が2倍にならない
   ・時刻の無い日は、本人の「時刻の印字がある日」だけを材料に補う（同じ勤務コード → 同じ種類 → 勤務日ぜんぶ）。根拠を返す。
     補った値を材料にしない。補えない勤務日がある月は額を出さない（0時間のまま配り切らない）
   ・休み・有給と読まれた日の便にも額が出る（手当が月の合計から消えない）。出頭・解散の印字があれば実際の時刻
   ・勤務コードが未分類・便なしでも、出頭・解散の印字がある日は勤務日のまま
   ・スタンバイの手当（連動先が待機の行）は便に載せない
   ・月の検算（check）は、お金が消えたら本当に落ちる（引き算で帳尻を合わせていない）
   最後に「壊す証明」：守りの1行を外すと赤くなること。 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIZ = fs.readFileSync(path.join(ROOT, 'pay-viz.js'), 'utf8');
const SRC = fs.readFileSync(path.join(ROOT, 'pv-report-engine.js'), 'utf8');
const TZ = fs.readFileSync(path.join(ROOT, 'pv-airport-tz.js'), 'utf8');

function load(src) {
  const win = { document: { documentElement: { getAttribute: () => 'ja' }, addEventListener() {} }, addEventListener() {} };
  win.window = win;
  const ctx = vm.createContext(win);
  vm.runInContext(VIZ, ctx);
  vm.runInContext(TZ, ctx);
  vm.runInContext(src, ctx);
  return win.PVReport;
}

/* ── 作り物 ─────────────────────────────────────────────── */
function rep(ym, o) {
  const [y, m] = ym.split('-').map(Number);
  return Object.assign({
    airline: 'pv', airline_other: null, period_year: y, period_month: m, currency: 'JPY', fx_to_jpy: 1,
    gross_monthly: null, net_pay_actual: null, deduction_total: null, annual_total_orig: null,
    base_pay: null, guarantee_pay: null, command_pay: null, instructor_pay: null, examiner_pay: null, union_pay: null,
    management_pay: null, nonline_pay: null, flight_variable_pay: null, other_allowance: null,
    housing_type: null, housing_amount: null, transport: null, per_diem: null, bonus_month: null,
    bonus_annual: null, profit_share_annual: null,
    union_outside_gross: false, perdiem_outside_gross: false, absence_total: 0,
    block_hours: null, duty_hours: null, night_hours: null, credit_hours: null, guaranteed_hours: null,
    sectors: null, duty_days: null, stay_nights: null, days_off: null, fleet: 'B787'
  }, o || {});
}
const FLY = (date, o) => Object.assign({ date, code: null, d_on: '07:00', d_off: '15:00', d_off_day: 0, legs: [
  { seq: 1, from: 'HND', to: 'KIX', out: '08:00', in: '09:15', in_day: 0, block: '1:15', kind: 'operating' },
  { seq: 2, from: 'KIX', to: 'HND', out: '10:30', in: '11:45', in_day: 0, block: '1:15', kind: 'operating' }] }, o || {});
const SIM = (date) => ({ date, code: 'TRN', d_on: '09:00', d_off: '17:00', d_off_day: 0, legs: [{ seq: 1, loc: 'HND', kind: 'ground' }] });
const OFF = (date) => ({ date, code: 'OFF1', d_on: null, d_off: null, d_off_day: 0, legs: [] });
/* ym の月を全部埋める。fly / sim に日（1〜）を並べる。special で1日だけ差し替え */
function month(ym, fly, sim, special) {
  const n = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate(), out = [];
  for (let d = 1; d <= n; d++) {
    const date = ym + '-' + String(d).padStart(2, '0');
    if (special && special[d]) out.push(Object.assign({ date }, special[d]));
    else if (fly.includes(d)) out.push(FLY(date));
    else if (sim.includes(d)) out.push(SIM(date));
    else out.push(OFF(date));
  }
  return out;
}
const PROFILE = (o) => Object.assign({ kind: 'actual', time_ref: 'local', tz: null, codes: { OFF1: 'off', TRN: 'training' } }, o || {});
const D10 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], S10 = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
/* 基本給 1,000,000・乗務手当 200,000（その他の手当の内訳）・日当 50,000 ＝ 総支給 1,250,000 */
const OCT = (o) => rep('2026-10', Object.assign({ gross_monthly: 1250000, base_pay: 1000000, other_allowance: 200000, flight_variable_pay: 200000, per_diem: 50000 }, o || {}));

/* 明細の内訳（my_report_items の1行）。変動給の行に連動先（basis）が付く */
function item(ym, pay_items) {
  const [y, m] = ym.split('-').map(Number);
  return { airline: 'pv', airline_other: null, period_year: y, period_month: m, pay_items: pay_items || null, payslip_detail: null };
}
function run(R, reports, days, prof, items) {
  const model = R.build({ reports, items: items || [], maps: [], roster: { days, profile: prof || PROFILE() } });
  return R.flightPay(model);
}
/* month() の special 用（日付は month() が付けるので、ここでは持たせない） */
const each = (ds, f) => Object.fromEntries(ds.map((d) => [d, f()]));
const LEGS = () => FLY('x').legs;
const TRN0 = () => ({ code: 'TRN', d_on: null, d_off: null, d_off_day: 0, legs: [] });        // 訓練コードだけの日（時刻も地上の行も無い）
const TRN4 = () => ({ code: 'TRN', d_on: '09:00', d_off: '13:00', d_off_day: 0, legs: [] });  // 時刻のある訓練（4時間）
const BARE = () => ({ code: null, d_on: null, d_off: null, d_off_day: 0, legs: LEGS() });     // 出頭・解散の印字が無い乗務日

function suite(R) {
  const res = [];
  const ok = (c, m) => res.push([!!c, m]);

  /* 1. 地上勤務の多い月：飛んだ日10日（1日 8時間・1:15 × 2区間）・シミュレーター10日（8時間） */
  {
    const fp = run(R, [OCT()], month('2026-10', D10, S10));
    const L = fp.legs.filter((l) => l.ym === '2026-10');
    const a = L[0] || {};
    ok(L.length === 20, '飛んだ区間を全部返す（20区間）');
    /* 手当 250,000 ÷ 1,500分 × 75分 ＝ 12,500／基本給の分 1,000,000 ÷ 9,600分 × 240分 ＝ 25,000 */
    ok(a.flight === 12500 && a.fixed === 25000 && a.amount === 37500, '★時給＋手当：基本給の分 25,000 ＋ 手当の分 12,500 ＝ 37,500');
    ok(a.amount < 1250000 * 75 / 1500, '★総支給 ÷ 飛んだ時間（62,500）より小さい＝地上勤務で膨らまない');
    ok(a.dutyMin === 240, 'その日の勤務 8時間を、2区間のブロックタイムで按分（4時間ずつ）');
    ok(Math.round(a.ratePerHour) === 6250, '時給 ＝ 基本給などの 1,000,000 ÷ 勤務時間ぜんぶ 160時間 ＝ 6,250');
    const M = fp.byYm['2026-10'];
    const ground = 10 * 480 * (M.otMinor / M.dutyMin);
    const total = L.reduce((s, l) => s + l.amount, 0) + ground;
    ok(Math.abs(total - (M.flMinor + M.otMinor)) <= L.length, '★便の額 ＋ 便の無い勤務の額 ＝ その月のお金（1,250,000）にぴったり戻る');
    ok(M.basis === 'split' && M.fleet === 'B787', '内訳のある明細は「時給＋手当」・機材は明細から');
    const C = M.check || {};
    ok(C.ok === true && C.basis === 'actual' && C.target === 1250000 && C.legs === 750000 && C.nonFlight === 500000 && C.diff === 0,
      '★月の検算：便 750,000 ＋ 便の無い勤務 500,000 ＝ 明細 1,250,000（実際の明細どおり）');
    ok(M.dutyEst === null && fp.dutyByDate['2026-10-01']?.src === 'times' && !fp.dutyByDate['2026-10-21'], '全部の日に時刻があれば補わない・休みの日は勤務時間に入れない');
  }

  /* 2. 便乗：手当は付けない（基本給の分だけ） */
  {
    const dh = { code: null, d_on: '07:00', d_off: '15:00', d_off_day: 0, legs: [
      { seq: 1, from: 'HND', to: 'CTS', out: '08:00', in: '09:30', in_day: 0, block: '1:30', kind: 'deadhead' },
      { seq: 2, from: 'CTS', to: 'HND', out: '11:00', in: '12:30', in_day: 0, block: '1:30', kind: 'operating' }] };
    const fp = run(R, [OCT()], month('2026-10', D10, S10, { 25: dh }));
    const d = fp.legs.find((l) => l.kind === 'deadhead');
    const o = fp.legs.find((l) => l.date === '2026-10-25' && l.kind === 'operating');
    ok(d && d.flight === 0 && d.fixed > 0 && d.amount === d.fixed, '★便乗に乗務手当・日当が付かない（基本給の分だけ）');
    ok(o && o.flight > 0, '同じ日の乗務の便には手当が付く');
  }

  /* 3. 総支給だけの明細：時給 ＝ 総支給 ÷ 勤務時間ぜんぶ */
  {
    const fp = run(R, [rep('2026-10', { gross_monthly: 960000 })], month('2026-10', D10, S10));
    const a = fp.legs[0];
    ok(fp.byYm['2026-10'].basis === 'gross' && a.flight === 0, '総支給だけの明細は手当の分を作らない');
    ok(a.amount === 24000, '★総支給 960,000 ÷ 9,600分 × 240分 ＝ 24,000');
  }

  /* 4. 賞与と組合（総支給の外）は入れない */
  {
    const base = run(R, [OCT()], month('2026-10', D10, S10)).legs[0].amount;
    const withBonus = run(R, [OCT({ gross_monthly: 1750000, bonus_month: 500000 })], month('2026-10', D10, S10)).legs[0].amount;
    ok(withBonus === base, '★月の賞与を便の額に入れない');
    const withUnion = run(R, [OCT({ union_pay: 80000, union_outside_gross: true })], month('2026-10', D10, S10)).legs[0].amount;
    ok(withUnion === base, '組合から総支給の外で出た分を入れない');
  }

  /* 5. 明細の無い月・スケジュールが月の一部・便の時間が分からない */
  {
    const fp = run(R, [OCT()], month('2026-10', D10, S10).concat(month('2026-11', [2, 3], [])));
    const nov = fp.legs.filter((l) => l.ym === '2026-11');
    ok(nov.length === 4 && nov.every((l) => l.amount === null && l.reason === 'no_payslip'), '★明細の無い月は額を出さない');
    ok(fp.byYm['2026-11'].missing.join() === '2026-11', 'どの月の明細が足りないかを返す');
    /* ★2026-11-12 オーナー回答「欠けた日を補って出す」：25日ぶん（26〜31日が無い）でも額を出す。
         勤務 9,600分 × 31 ÷ 25 ＝ 11,904分・乗務 1,500分 × 31 ÷ 25 ＝ 1,860分 で割る */
    const part = run(R, [OCT()], month('2026-10', D10, S10).slice(0, 25));
    const p0 = part.legs[0];
    ok(p0 && p0.amount === Math.round(1000000 / 11904 * 240) + Math.round(250000 * 75 / 1860), '★スケジュールが月の一部でも、欠けた日を補って額を出す');
    ok(p0 && p0.partial && p0.partial.covered === 25 && JSON.stringify(p0.partial.gaps) === '[[26,31]]', '欠けた日の範囲を返す（26〜31日）');
    const pc = part.byYm['2026-10'].check || {};
    ok(pc.ok === true && pc.basis === 'partial' && pc.uncovered > 0, '月の検算：スケジュールが月の一部の月は「partial」・取り込んでいない日の分を別に持つ');
    const part2 = run(R, [OCT({ block_hours: 25 })], month('2026-10', D10, S10).slice(0, 25));
    ok(part2.legs[0].flight === 12500 && part2.legs[0].partial.blockFrom === 'payslip', '★明細に乗務時間が印字されていれば、乗務手当はその時間で割る');
    const full = run(R, [OCT()], month('2026-10', D10, S10));
    ok(full.legs[0].partial === null, '全部の日がある月は partial を返さない');
    const nob = { code: null, d_on: null, d_off: null, d_off_day: 0, legs: [{ seq: 1, from: 'HND', to: 'FUK', kind: 'operating' }] };
    const fb = run(R, [OCT()], month('2026-10', D10, S10, { 26: nob }));
    const x = fb.legs.find((l) => l.to === 'FUK');
    ok(x && x.amount === null && x.reason === 'no_block', '便の時間も勤務の時刻も無い便は額を出さない');
    ok(fb.legs.filter((l) => l.amount != null).length === 20, 'ほかの便はそのまま出す');
  }

  /* 6. 「飛んだ分は翌月の明細」（pay_lag 1）：10月の便の手当は11月の明細から・基本給は10月の明細から */
  {
    const r10 = rep('2026-10', { gross_monthly: 1000000, base_pay: 1000000 });
    const r11 = rep('2026-11', { gross_monthly: 1250000, base_pay: 1000000, other_allowance: 200000, flight_variable_pay: 200000, per_diem: 50000 });
    const fp = run(R, [r10, r11], month('2026-10', D10, S10), PROFILE({ pay_lag: 1 }));
    const a = fp.legs[0];
    ok(a && a.fixed === 25000 && a.flight === 12500, '★pay_lag どおり：10月の便の手当は11月の明細・基本給は10月の明細');
    const lc = fp.byYm['2026-10'].check || {};
    ok(lc.ok === true && lc.basis === 'actual' && lc.target === 1250000, '★翌月払いの月の検算：対象の額 ＝ その月の決まった分 1,000,000 ＋ 翌月の明細の手当 250,000');
    const fp2 = run(R, [r10], month('2026-10', D10, S10), PROFILE({ pay_lag: 1 }));
    ok(fp2.byYm['2026-10'].missing.join() === '2026-11' && fp2.legs.every((l) => l.amount === null), '★翌月の明細がまだ無ければ額を出さない（手当の行がまだ1つも無くても）');
  }

  /* 8. その月の明細が無いとき（オーナー回答「近い月の明細で出す」）：決まった額は近い月から・乗務手当は借りない */
  {
    const r11 = rep('2026-11', { gross_monthly: 1250000, base_pay: 1000000, other_allowance: 200000, flight_variable_pay: 200000, per_diem: 50000 });
    /* 飛んだ分は翌月の明細（pay_lag 1）・10月の明細は無い：10月の便 ＝ 手当は11月の明細・基本給は近い月（11月）から */
    const fp = run(R, [r11], month('2026-10', D10, S10), PROFILE({ pay_lag: 1 }));
    const a = fp.legs[0];
    ok(a && a.amount === 37500 && a.fixedFrom === '2026-11', '★明細の無い月は、決まった額を近い月の明細から（どの月からかを返す）');
    const bc = fp.byYm['2026-10'].check || {};
    ok(bc.ok === true && bc.basis === 'borrowed' && bc.borrowed === 1000000, '月の検算：近い月から借りた月は「borrowed」（実際の明細と合った月と区別する）');
    ok(fp.lagAsked === true, '飛んだ分が何月の明細に出るかを答えてあれば、聞かない');
    /* 飛んだ分は同じ月（答えていない）＝乗務手当は10月の明細に載る → 10月の明細が無ければ出さない（借りない） */
    const fq = run(R, [r11], month('2026-10', D10, S10));
    ok(fq.legs.every((l) => l.amount === null && l.reason === 'no_payslip') && fq.byYm['2026-10'].missing.join() === '2026-10', '★乗務手当は近い月から借りない');
    ok(fq.lagAsked === false, '飛んだ分が何月の明細に出るかをまだ答えていなければ、画面が聞く（lagAsked=false）');
  }

  /* 9. ★訓練コードだけの日（時刻も地上の行も無い）：落とさない。材料が乗務日（8時間）だけなら 8時間で補う */
  {
    const fp = run(R, [OCT()], month('2026-10', D10, [], each(S10, TRN0)));
    const a = fp.legs[0], M = fp.byYm['2026-10'];
    ok(a.amount === 37500 && Math.round(a.ratePerHour) === 6250, '★訓練コードだけの日が10日あっても、時給 6,250・1便 37,500（62,500 に膨らまない）');
    ok(M.dutyEst && M.dutyEst.days === 10 && M.dutyEst.min === 4800 && M.dutyEst.by.all === 10 && M.dutyEst.unresolved === 0, '補った日数と根拠（勤務日ぜんぶの平均）を返す');
    const d = fp.dutyByDate['2026-10-11'];
    ok(d && d.min === 480 && d.src === 'all', '日ごとの勤務時間に、補った値と根拠が入る');
    ok(M.check && M.check.ok === true, '月の検算が合う');
  }

  /* 10. ★同じ訓練コードに時刻のある日（4時間）がある：8時間ではなく 4時間で補う */
  {
    const sp = Object.assign(each([11, 12, 13, 14, 15], TRN4), each([16, 17, 18, 19, 20], TRN0));
    const fp = run(R, [OCT()], month('2026-10', D10, [], sp));
    const a = fp.legs[0], M = fp.byYm['2026-10'], d = fp.dutyByDate['2026-10-16'] || {};
    /* 勤務 ＝ 乗務10日 × 480 ＋ 訓練10日 × 240 ＝ 7,200分 → 基本給の分 1,000,000 ÷ 7,200 × 240 ＝ 33,333 */
    ok(a.fixed === 33333 && a.amount === 45833, '★同じ訓練が普段4時間なら 4時間で補う（1便 45,833。8時間で補った 37,500 ではない）');
    ok(d.min === 240 && d.src === 'code' && M.dutyEst?.by.code === 5, '★根拠が「同じ勤務コード」と返る');
    /* 同じ月に時刻のある訓練が無ければ、ほかの月の同じ勤務コードから */
    const sep = month('2026-09', D10, [], each([11, 12], TRN4));
    const fq = run(R, [OCT()], sep.concat(month('2026-10', D10, [], each(S10, TRN0))));
    ok((fq.legs.find((l) => l.ym === '2026-10') || {}).amount === 45833, '同じ月に材料が無ければ、ほかの月の同じ勤務コードから');
  }

  /* 11. ★補った値を、次の補いの材料にしない */
  {
    const prof = PROFILE({ codes: { OFF1: 'off', TRN: 'training', SBY: 'standby' } });
    const sby = () => ({ code: 'SBY', d_on: null, d_off: null, d_off_day: 0, legs: [] });
    const sp = Object.assign(each([11], TRN4), each([12, 13, 14, 15], TRN0), each([16], sby));
    const fp = run(R, [OCT()], month('2026-10', D10, [], sp), prof);
    /* 材料は時刻のある11日（乗務 480 × 10・訓練 240 × 1）→ 平均 458分。補った訓練4日（240分）を混ぜると 400分になる */
    const d = fp.dutyByDate['2026-10-16'] || {};
    ok(d.src === 'all' && d.min === 458, '★補った日を材料にしていない（スタンバイの日は 458分。400分ではない）');
  }

  /* 12. ★補えない勤務日がある月は、0時間のまま配り切らない＝額を出さない */
  {
    const fp = run(R, [OCT()], month('2026-10', [], [], Object.assign(each(D10, BARE), each(S10, TRN0))));
    const M = fp.byYm['2026-10'];
    ok(fp.legs.length === 20 && fp.legs.every((l) => l.amount === null && l.reason === 'no_duty'), '★補う材料の無い勤務日がある月は額を出さない（0時間のまま配り切らない）');
    ok(M.dutyEst && M.dutyEst.unresolved === 10 && M.check === null, '補えなかった日数を返す（検算は作らない）');
    /* 訓練の日が無ければ、今までどおり便の時間で代えて出す */
    const fq = run(R, [OCT()], month('2026-10', [], [], each(D10, BARE)));
    ok(fq.legs[0].amount === 62500 && fq.byYm['2026-10'].dutyEst?.by.block === 10, '時刻のある日が1日も無いロスターは、今までどおり便の時間で代える');
  }

  /* 13. ★休み・有給のコードの日に便がある：その便にも額を出す。出頭・解散の印字があれば実際の時刻を使う */
  {
    const fp = run(R, [OCT()], month('2026-10', D10, S10, { 25: { code: 'OFF1', d_on: '06:00', d_off: '16:00', d_off_day: 0, legs: LEGS() } }));
    const M = fp.byYm['2026-10'], d = fp.dutyByDate['2026-10-25'] || {}, day = fp.legs.filter((l) => l.date === '2026-10-25');
    ok(d.min === 600 && d.src === 'times', '★休みのコードの日でも、出頭・解散の印字（06:00〜16:00）をそのまま使う');
    ok(day.length === 2 && day.every((l) => l.amount > 0 && l.flight > 0), '★休みと読まれた日の便にも額が出る');
    const fl = fp.legs.reduce((s, l) => s + (l.flight || 0), 0);
    ok(Math.abs(fl - M.flMinor) <= fp.legs.length, '★便の手当の合計が、月の手当（250,000）に戻る＝どの便にも載らないお金が無い');
    ok(M.check && M.check.ok === true && Math.abs(M.check.diff) <= fp.legs.length, '★月の検算：休みと読まれた日に便があっても合う（消えたお金があれば落ちる）');
    /* 印字が無ければ、その日のブロックタイム × 本人の「勤務 ÷ ブロック」（150分 × 480 ÷ 150） */
    const fq = run(R, [OCT()], month('2026-10', D10, S10, { 25: { code: 'OFF1', d_on: null, d_off: null, d_off_day: 0, legs: LEGS() } }));
    const dq = fq.dutyByDate['2026-10-25'] || {};
    ok(dq.min === 480 && dq.src === 'ratio' && fq.legs.filter((l) => l.date === '2026-10-25').every((l) => l.amount > 0), '印字が無ければ、ブロックタイム × 本人の「勤務 ÷ ブロック」で補う');
  }

  /* 14. ★勤務コードが未分類・便なし・出頭と解散だけ印字された日：勤務日のまま（実際の時刻） */
  {
    const fp = run(R, [OCT()], month('2026-10', D10, S10, { 27: { code: 'XYZ', d_on: '09:00', d_off: '17:00', d_off_day: 0, legs: [] } }));
    const d = fp.dutyByDate['2026-10-27'] || {}, M = fp.byYm['2026-10'];
    ok(d.min === 480 && d.src === 'times' && M.dutyMin === 10080, '★未分類のコード・便なしでも、出頭・解散の印字がある日は実際の 8時間として数える');
    ok(M.dutyEst === null, '実測なので、補った日には数えない');
  }

  /* 15. スタンバイの手当（連動先が「待機」の行）は便に載せない */
  {
    const it = item('2026-10', { variable: [{ label: '乗務手当', basis: 'block', amount: 170000 }, { label: '待機手当', basis: 'reserve', amount: 30000 }] });
    const fp = run(R, [OCT()], month('2026-10', D10, S10), null, [it]);
    const a = fp.legs[0], M = fp.byYm['2026-10'];
    /* 便へ配る手当 ＝ 乗務手当 170,000 ＋ 日当 50,000 ＝ 220,000 → 1便 11,000 */
    ok(M.offLeg?.reserve === 30000 && M.flMinor === 220000 && a.flight === 11000 && a.amount === 36000, '★待機の行は便に載らない（元の行の 30,000 を別に持つ）');
    ok(M.check?.ok === true && M.check.target === 1250000 && M.check.reserve === 30000, '月の検算：便 ＋ 便の無い勤務 ＋ スタンバイの手当 ＝ 明細の額（1,250,000）');
    const plain = run(R, [OCT()], month('2026-10', D10, S10), null, [item('2026-10', { variable: [{ label: '乗務手当', basis: 'block', amount: 200000 }] })]);
    ok(plain.legs[0].amount === 37500 && plain.byYm['2026-10'].offLeg?.reserve === 0, '待機の行が無ければ、今と同じ数字');
  }

  /* 7. 字：地球儀に「単価」「料率」を使わない */
  {
    const gp = path.join(ROOT, 'my-globe.js');
    const g = fs.existsSync(gp) ? fs.readFileSync(gp, 'utf8') : '';
    const T = (g.match(/var T = \{[\s\S]*?\n  \};/) || [''])[0];
    ok(T.length > 0 && !/単価|料率|tarifa|rate per/i.test(T), '地球儀の字に「単価」「料率」が無い');
    /* ★2026-11-13 地球儀は勤務時間を数えない（数えるのは flightPay の1か所）。
         輪は「この期間の稼ぎのうち、どこで稼いだか」＝ 日は便ごと・それより長い期間はルートごと（pieRows）。
         オーナー「変動給のパーセンテージ出してもずっと変わらない」＝ 固定給と変動給の割合を輪に戻さない。
         オーナー「まだブロック率のままやん」＝ ブロック率（勤務時間のうちブロックタイム）を輪にも便のカードにも戻さない。
         オーナー「固定給と変動給でわけるだけでいいや。細かいと突っ込まれそうだから」＝ 便のカードの内訳は手当ごとに分けない */
    const oldCalc = g.split('\n').filter((ln) => /x\.isDuty|x\.dutyMin|blockKnown|dutyByDate/.test(ln));
    const sum = (g.match(/function sumHTML[\s\S]*?\n  \}\n/) || [''])[0];
    ok(oldCalc.length === 0 && !/dayRatio|ブロックタイムの割合|ringL/.test(g),
      '★地球儀は勤務時間を数えない・ブロック率を出さない');
    ok(/pieRows\(V\)/.test(sum) && !/mixRows|V\.fx|V\.fv|fixed|flight/.test(sum) && /function pieRows/.test(g) && /day \? T\.restF : T\.restR/.test(g),
      '★輪は便ごと（日）・ルートごと（それより長い期間）の割合で、固定給と変動給の割合を出さない');
    ok(!/segName|パーディアム|perdiem/.test(g), '★便のカードの内訳は固定給と変動給の2つだけ（手当ごと・日当を分けて書かない）');
  }
  return res;
}

let pass = 0, fail = 0;
const say = (c, m) => { if (c) pass++; else fail++; console.log(`  ${c ? '✅' : '❌'} ${m}`); };
console.log('▼ 便ごとの稼ぎ（目安）');
suite(load(SRC)).forEach(([c, m]) => say(c, m));

console.log('▼ 壊す証明');
const BREAK = [
  ['基本給の分を飛んだ時間で割る（地上勤務で膨らむ）', 'if (!M.reason) M.ratePerHour = ot * 60 / duty;\n', 'if (!M.reason) M.ratePerHour = ot * 60 / duty; duty = opBlock;\n'],
  ['便乗にも手当を付ける', "var fv = L.kind === 'deadhead' || !(opBlock > 0) ? 0 : M.flMinor * L.blockMin / opBlock;", 'var fv = !(opBlock > 0) ? 0 : M.flMinor * L.blockMin / opBlock;'],
  ['賞与を入れる', 'var FP_SKIP_CAT = { bonus: 1, noncash: 1 };', 'var FP_SKIP_CAT = { noncash: 1 };'],
  ['明細の無い月も額を出す', "if (M.missing.length) M.reason = 'no_payslip';\n      else ", ''],
  ['欠けた日を補わずに割る', 'duty = duty * dim / cov;', ''],
  ['近い月の明細を使わない', 'if (fb) M.fixedFrom = fb;', 'fb = null;'],
  ['乗務手当も近い月から借りる', 'flNeed.forEach(function (p) { if (p && !have[p] && M.missing.indexOf(p) < 0) M.missing.push(p); });', ''],
  /* ★2026-11-13 勤務時間の数え方。4つ目の欄が在れば、その字を含む検査も落ちること（＝その守りが効いていること）まで見る */
  ['訓練などの勤務コードだけの日を落とす（時給が2倍）', ' || (!rest && !!FP_WORK_CLS[x.cls])', '', '62,500 に膨らまない'],
  ['休みと読まれた日の便を勤務日に数えない（手当が消える）', ' || (rest && hasLeg)', '', '月の検算：休みと読まれた日'],
  ['休みのコードの日の出頭・解散の印字を使わない', 'if (min == null && rest) {', 'if (false) {', '印字（06:00〜16:00）をそのまま使う'],
  ['いままで勤務日だった日を落とす（未分類のコード・時刻だけの日）', 'var isWork = x.isDuty || ', 'var isWork = ', '未分類のコード・便なしでも'],
  ['補った値を次の補いの材料にする', "map[y.date].src === 'times'", 'map[y.date].min != null', '補った日を材料にしていない'],
  ['補えない勤務日を0時間のまま配る', "else if (est.unresolved) M.reason = 'no_duty';", '', '0時間のまま配り切らない'],
  ['同じ勤務コードを先に見ない', "if (x.code) { v = mean(near(x, function (y) { return y.code === x.code; })); if (v != null) src = 'code'; }", '', '根拠が「同じ勤務コード」'],
  ['スタンバイの手当を便に載せる', "l.basis === 'reserve'", 'false', '待機の行は便に載らない']
];
for (const [name, from, to, must] of BREAK) {
  if (SRC.split(from).length !== 2) { say(false, `${name}：差し替える1行が pv-report-engine.js に1回だけ無い（検査が古い）`); continue; }
  let f;
  try { f = suite(load(SRC.replace(from, () => to))).filter(([c]) => !c); } catch (e) { f = [[false, '例外']]; }
  const hit = !must || f.some(([, m]) => m.includes(must));
  say(f.length > 0 && hit, `${name} → 赤くなる（${f.length}件）` + (must ? (hit ? `・「${must}」が落ちる` : `・「${must}」が落ちていない`) : ''));
}
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
