/* db/test-report-engine.mjs — マイレポートの計算エンジン（pv-report-engine.js）の約束（2026-11-09）
   サーバも DB もブラウザも要らない。pay-viz.js と pv-report-engine.js を node の vm で読み、PVReport を直接呼ぶ。
   データはすべて作り物（実在の給与・ロスター・氏名は使わない）。

   見ていること
   ・通貨の最小単位（JPY 0 / USD 2 / KWD 3）・10進のまま丸める
   ・明細の行 → 総支給（内訳・総支給 − 控除 ＝ 手取り・増減の合計 ＝ Δ総支給）が一致し、食い違いは赤にする
   ・pay-viz.js の segments / totals と同じ数え方（総支給の外の組合・パーディアム・不就労減額）
   ・1 / 2 / 12か月以上・抜けた月・0 と null・数量なし
   ・支給月と勤務月：対応表（offset 0 / -1）・項目だけ別期間・後の月の調整・勤務月が分からない行は単位あたりから外す
   ・賞与（年額の申告）・パーディアム・非現金を二重に数えない
   ・ロスター：日付またぎ・DH／地上／不明の区間・欠けた月は null・夏時間
   ・明細とロスターの対応候補はぴったりのときだけ
   ・手当の増減の分解（数量の差 ＋ 残り ＝ 実際の差）・週末手当を日数で割らない
   ・日ごとの超過と月の超過は別の式・当てはめた月と検証の月を分ける・確度％を出さない
   ・分割スクショのつなぎ（重なり・切れ・欠けた区間・食い違い・同じ写り・月またぎ）
   最後に「壊す証明」：守りの1行を外すと赤くなること。 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIZ = fs.readFileSync(path.join(ROOT, 'pay-viz.js'), 'utf8');
const SRC = fs.readFileSync(path.join(ROOT, 'pv-report-engine.js'), 'utf8');

function load(src) {
  const win = { document: { documentElement: { getAttribute: () => 'ja' }, addEventListener() {} }, addEventListener() {} };
  win.window = win;
  const ctx = vm.createContext(win);
  vm.runInContext(VIZ, ctx);
  vm.runInContext(src, ctx);
  return { R: win.PVReport, V: win.PVViz };
}
const J = (x) => JSON.stringify(x);
const near = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

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
    sectors: null, duty_days: null, stay_nights: null, days_off: null
  }, o || {});
}
function item(ym, pay_items, payslip_detail, o) {
  const [y, m] = ym.split('-').map(Number);
  return Object.assign({ airline: 'pv', airline_other: null, period_year: y, period_month: m, pay_items: pay_items || null, payslip_detail: payslip_detail || null }, o || {});
}
const LEGS2 = () => [
  { seq: 1, flight: 'PV101', from: 'HND', to: 'KIX', out: '08:00', in: '09:15', in_day: 0, block: '1:15', role: 'CAP', kind: 'operating' },
  { seq: 2, flight: 'PV102', from: 'KIX', to: 'HND', out: '10:30', in: '11:45', in_day: 0, block: '1:15', role: 'CAP', kind: 'operating' }
];
const DUTY = (date) => ({ date, code: null, d_on: '07:00', d_off: '15:00', d_off_day: 0, legs: LEGS2() });
function month(ym, special, dutyDays) {
  const n = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate(), out = [];
  for (let d = 1; d <= n; d++) {
    const date = ym + '-' + String(d).padStart(2, '0');
    if (special && special[d]) out.push(Object.assign({ date }, special[d]));
    else if (dutyDays && dutyDays.includes(d)) out.push(DUTY(date));
    else out.push({ date, code: 'OFF1', d_on: null, d_off: null, d_off_day: 0, legs: [] });
  }
  return out;
}
const PROFILE = { kind: 'actual', time_ref: 'local', tz: null, codes: { OFF1: 'off', VAC: 'vac', TRN: 'training', SBY: 'standby' } };

function suite(R, V) {
  const res = [];
  const ok = (c, m) => res.push([!!c, m]);
  const segOf = (k) => R.KINDS[k].seg;

  /* ▼ 通貨の最小単位 */
  ok(R.minorDigits('JPY') === 0 && R.minorDigits('USD') === 2 && R.minorDigits('KWD') === 3 && R.minorDigits('KRW') === 0 && R.minorDigits('aed') === 2,
     '通貨の桁：JPY 0・USD 2・KWD 3（KRW も 0）');
  ok(R.toMinor('1234.565', 'USD') === 123457 && R.toMinor(1.005, 'USD') === 101 && R.toMinor(1.15, 'USD') === 115 && R.toMinor('-2.505', 'USD') === -251,
     '10進のまま丸める（1.005 → 101 セント。2進の 1.005×100=100.49… を通さない）');
  ok(R.toMinor('12.3456', 'KWD') === 12346 && R.toMinor(1234.5, 'JPY') === 1235 && R.toMinor(null, 'USD') === null && R.toMinor('', 'USD') === null && R.toMinor(0, 'USD') === 0,
     'KWD は3桁・JPY は整数・null と空は null・0 は 0');
  {
    const k = R.linesOf(rep('2026-01', { currency: 'KWD', fx_to_jpy: 480, gross_monthly: 2000.5, base_pay: 1234.567 }));
    ok(k.anchor === 2000500 && k.lines.find((l) => l.kind === 'base').amount === 1234567 && k.unexplained === 765933,
       'KWD の明細：最小単位の整数で総支給 − 基本給 ＝ 残り');
  }

  /* ▼ 明細1枚の行 */
  const r1 = rep('2026-09', { gross_monthly: 600000, net_pay_actual: 450000, deduction_total: 150000, base_pay: 400000, command_pay: 50000,
    flight_variable_pay: 80000, other_allowance: 100000, per_diem: 30000, transport: 10000, block_hours: 80.5, duty_hours: 150 });
  r1.pay_items = { v: 1, variable: [{ amount: 50000, basis: 'block', label: '  Flight   PAY ' }, { amount: 30000, basis: 'night', label: 'Night Premium' }], other: [{ amount: 20000, label: 'Sky Allowance' }] };
  r1.payslip_detail = { v: 1, earnings: [{ label: '基本給A', amount: 300000, kind: 'base' }, { label: '基本給B', amount: 100000, kind: 'base' }], hours: [] };
  const L1 = R.linesOf(r1);
  const keys = L1.lines.map((l) => l.labelKey);
  ok(keys.includes('flight pay') && keys.includes('night premium') && keys.includes('sky allowance') && keys.includes('k:command'),
     '項目名の鍵：小文字・空白をつめる／列だけの行は k:種類');
  ok(L1.lines.filter((l) => l.kind === 'base').map((l) => l.amount).join() === '300000,100000', '基本給は明細の2行に割れる（合計は列の額）');
  ok(L1.unexplained === 10000 && R.helpers.labelKey('A  b ') === 'a b', '総支給 − 分かっている分 ＝ 残り（どの項目にも入れていない分）');
  ok(L1.qty.block === 4830 && L1.qty.duty === 9000, '時間は整数の分（80.5h → 4830 分）');
  {
    const r = rep('2026-09', { gross_monthly: 600000, flight_variable_pay: 80000, other_allowance: 80000 });
    r.pay_items = { variable: [{ amount: 60000, basis: 'block', label: 'Flight Pay' }] };
    const L = R.linesOf(r).lines.filter((l) => l.kind === 'flight');
    ok(L.length === 2 && L[1].remainder && L[1].labelKey === 'k:flight' && L[1].amount === 20000, '明細の行が列に足りないときは、残りを列の行（k:flight）で持つ');
    r.pay_items = { variable: [{ amount: 90000, basis: 'block', label: 'Flight Pay' }] };
    const L2 = R.linesOf(r).lines.filter((l) => l.kind === 'flight');
    ok(L2.length === 1 && L2[0].labelKey === 'k:flight' && L2[0].amount === 80000 && L2[0].detailMismatch, '明細の行が列を超えたら行を使わず列の額のまま（印を付ける）');
  }

  /* ▼ pay-viz.js と同じ数え方（segments / totals） */
  const r2 = rep('2026-10', { gross_monthly: 500000, net_pay_actual: 380000, deduction_total: 120000, base_pay: 300000, union_pay: 40000, union_outside_gross: true,
    per_diem: 30000, perdiem_outside_gross: true, housing_type: 'allowance', housing_amount: 20000, bonus_month: 50000, absence_total: 12000 });
  r2.pay_items = { union: { days: 6, extra: 'yes', source: 'union', amount: 40000 }, per_diem_src: 'outside', absence: [{ label: '欠勤控除', amount: -12000 }] };
  const r3 = rep('2026-11', { gross_monthly: 450000, base_pay: 300000, flight_variable_pay: 90000, other_allowance: 50000, housing_type: 'company', housing_amount: 80000 });
  const r4 = rep('2026-12', { currency: 'USD', fx_to_jpy: 150, gross_monthly: 15234.56, net_pay_actual: 11000.11, deduction_total: 4234.45, base_pay: 9000.25,
    guarantee_pay: 1200.10, instructor_pay: 800.33, flight_variable_pay: 2100.49, other_allowance: 2500.49, transport: 120.5 });
  const r5 = rep('2027-01', { gross_monthly: 300000, base_pay: 350000 });
  for (const [nm, r] of [['内訳＋明細', r1], ['組合の外・パーディアムの外・減額・住宅・賞与', r2], ['変動給が逆転・現物の社宅', r3], ['USD のセント', r4], ['内訳が総支給を超える', r5]]) {
    const s = V.segments(r), L = R.linesOf(r), fx = r.fx_to_jpy;
    if (!s) { ok(L.overGross > 0 && L.unexplained === null, `segments と同じ：${nm} は図を出さない（内訳が総支給を超える）`); continue; }
    const mine = {};
    L.lines.forEach((l) => { const k = segOf(l.kind); if (k && l.counted) mine[k] = (mine[k] || 0) + l.amount; });
    mine.rest = (mine.rest || 0) + L.carved;
    const bad = Object.keys(s.vals).filter((k) => !near((R.fromMinor(mine[k] || 0, r.currency)) * fx, s.vals[k]));
    ok(bad.length === 0, `segments と同じ：${nm}${bad.length ? '（ずれ：' + bad.join(',') + '）' : ''}`);
  }
  {
    const rows = [r1, r2, r4];
    const t = V.totals(rows);
    const mine = rows.map((r) => R.linesOf(r)).reduce((a, x) => a + R.fromMinor(x.received, x.currency) * x.fx_to_jpy, 0);
    ok(near(mine, t.gross), 'totals と同じ：受け取った額 ＝ 総支給 ＋ 総支給の外（組合・明細とは別のパーディアム）');
    ok(R.linesOf(r1).gross === R.toMinor(V.grossOrig(r1), 'JPY') && R.linesOf(r4).gross === 1523456, '総支給は PVViz.grossOrig と同じ額（手取り＋控除が先）');
  }

  /* ▼ 0 と null */
  {
    const L = R.linesOf(rep('2026-01', { gross_monthly: 300000, base_pay: 0, command_pay: null, flight_variable_pay: 0, other_allowance: 20000 }));
    ok(L.lines.some((l) => l.kind === 'base' && l.amount === 0) && !L.lines.some((l) => l.kind === 'command'), '0 は「0円」として行に残し、null は行を作らない');
    ok(L.lines.some((l) => l.kind === 'flight' && l.amount === 0), '変動給 0 も答え（行が残る）');
    const m = R.build({ reports: [rep('2026-01', { gross_monthly: 300000, base_pay: 0 }), rep('2026-02', { gross_monthly: 300000 })] });
    const c = R.cardC(m, { item: 'k:base' });
    ok(c.series[0].amount === 0 && c.series[1].amount === null, '項目の推移：0 と「無い」を分ける');
  }

  /* ▼ 1か月・2か月 */
  const g1 = rep('2026-09', { gross_monthly: 600000, net_pay_actual: 450000, deduction_total: 150000, base_pay: 400000, flight_variable_pay: 80000, other_allowance: 80000, block_hours: 80, duty_hours: 150, duty_days: 16, sectors: 40 });
  const g2 = rep('2026-10', { gross_monthly: 640000, net_pay_actual: 475000, deduction_total: 165000, base_pay: 400000, flight_variable_pay: 110000, other_allowance: 130000, block_hours: 92, duty_hours: 160, duty_days: 17, sectors: 46 });
  g2.pay_items = { other: [{ amount: 20000, label: 'Retro Pay Adj' }] };
  {
    const m = R.build({ reports: [g1] });
    const s = R.summary(m);
    ok(m.months.length === 1 && s.kpi.gross.b === 600000 && s.kpi.gross.delta === null && s.kpi.gross.rate === null, '1か月：実額は出す・増減は出さない');
    ok(s.composition && s.composition.total === 600000 && R.checks(m).pairs.length === 0 && R.cardA(m).metrics[0].rate === null, '1か月：構成は出す・比べる組は無い');
  }
  {
    const m = R.build({ reports: [g1, g2] });
    const s = R.summary(m), wf = s.waterfall;
    ok(wf.ok === true && wf.sum === 40000 && wf.deltaGross === 40000, '2か月：増減の合計 ＝ Δ総支給');
    ok(wf.items.find((i) => i.kind === 'flight').delta === 30000 && wf.items.find((i) => i.kind === 'other').delta === 20000, '2か月：何が動いたか（変動給 +30,000・その他 +20,000）');
    ok(s.netChange.consistent === true && s.netChange.delta.net === 25000, '控除と手取りの増減：Δ総支給 − Δ控除 ＝ Δ手取り');
    const A = R.cardA(m), gr = A.metrics.find((x) => x.k === 'gross'), bl = A.metrics.find((x) => x.k === 'block');
    ok(near(gr.rate, 40000 / 600000) && bl.delta === 720 && near(bl.rate, 720 / 4800), 'A：増減率（総支給・乗務時間）');
    ok(A.moved[0].cat === 'variable' && A.composition.b.find((x) => x.cat === 'allowance').amount === 20000, 'A：構成と「何が動いたか」');
    const B = R.cardB(m, { num: 'gross', den: 'duty' });
    ok(near(B.points[0].value, 600000 * 60 / 9000) && B.points[0].basis === 'payslip', 'B：同じ明細の数量で割る（総勤務1時間あたり）');
    const B2 = R.cardB(m, { num: 'net', den: 'sectors' });
    ok(near(B2.points[1].value, 475000 / 46), 'B：手取り ÷ 便数');
    const C = R.cardC(m, { item: 'k:flight' });
    ok(C.series[0].qty === null && C.decomposition.reason === 'no_quantity', 'C：何に連動するか分からない変動給は数量を作らない');
  }

  /* ▼ 12か月以上・抜けた月 */
  {
    const reps = [];
    R.helpers.ymRange('2025-01', '2026-03').forEach((ym, i) => {
      if (ym === '2025-02') return;
      reps.push(rep(ym, { gross_monthly: 500000 + i * 1000, net_pay_actual: 400000, deduction_total: 100000 + i * 1000, base_pay: 400000, bonus_annual: 1200000 }));
    });
    const m = R.build({ reports: reps });
    const s = R.summary(m);
    ok(m.months.length === 14 && J(m.gaps) === J(['2025-02']) && J(s.totals.gaps) === J(['2025-02']), '15か月のうち1か月抜け：抜けた月を数える（0 で埋めない）');
    ok(s.totals.gross === reps.reduce((a, r) => a + r.gross_monthly, 0) && s.totals.monthsGross === 14, '提出済みの合計は出した月だけ');
    const y25 = s.years.find((y) => y.year === 2025);
    ok(y25.months === 11 && y25.full === false && y25.bonusDeclared.amount === 1200000 && y25.annualized.estimate === true, '年のまとまり：11か月・申告の賞与は1回だけ（足さない）・年換算は推計の印');
    ok(s.trailing12 && s.trailing12.from === '2025-04' && s.trailing12.gross === reps.slice(-12).reduce((a, r) => a + r.gross_monthly, 0), '直近12か月が連続なら実績の合計');
    const m2 = R.build({ reports: reps.filter((r) => !(r.period_year === 2025 && r.period_month === 7)) });
    ok(R.summary(m2).trailing12 === null, '直近12か月に抜けがあれば実績の合計を出さない');
    ok(!s.composition.months.some((x) => x.cats.bonus), '年額の賞与の申告を月の構成に入れない');
    ok(R.checks(m).pairs.every((p) => p.waterfallEqDelta === true) && R.checks(m).months.every((x) => x.sumToGross === true && x.grossMinusDeductEqNet === true), '14か月すべてで3つの検算が一致');
  }

  /* ▼ 支給月と勤務月（対応表）・明細 ⇄ ロスター */
  const rAug = month('2026-08', null, [3, 4, 5, 6, 7, 10, 11, 12, 13, 14]);        // 10日 × 150分 = 1500
  const rSep = month('2026-09', null, [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 15, 16]);  // 12日 × 150分 = 1800
  const s09 = rep('2026-09', { gross_monthly: 500000, net_pay_actual: 380000, deduction_total: 120000, base_pay: 400000, flight_variable_pay: 75000, other_allowance: 75000, block_hours: 25, duty_hours: 80 });
  const s10 = rep('2026-10', { gross_monthly: 512000, net_pay_actual: 389000, deduction_total: 123000, base_pay: 400000, flight_variable_pay: 90000, other_allowance: 105000, block_hours: 30, duty_hours: 90 });
  const it09 = item('2026-09', { variable: [{ amount: 75000, basis: 'block', label: 'Flight Pay' }] });
  const it10 = item('2026-10', { variable: [{ amount: 90000, basis: 'block', label: 'Flight Pay' }], other: [{ amount: 15000, label: 'Retro Pay Adj' }] });
  const maps = [
    { airline: 'pv', airline_other: null, label_key: 'k:flight', offset: -1, status: 'confirmed', qty_kind: null },
    { airline: 'pv', airline_other: null, label_key: 'k:base', offset: 0, status: 'confirmed', qty_kind: null },
    { airline: 'pv', airline_other: null, label_key: 'retro pay adj', offset: null, status: 'other', qty_kind: null },
    { airline: 'pv', airline_other: null, label_key: '2026-10|retro pay adj', offset: -3, status: 'other', qty_kind: null },
    { airline: 'zz', airline_other: null, label_key: 'k:unexplained', offset: 0, status: 'confirmed', qty_kind: null }
  ];
  const roster = { days: rAug.concat(rSep), profile: PROFILE };
  const MS = R.build({ reports: [s09, s10], items: [it09, it10], maps, roster });
  {
    const al = MS.align;
    ok(al[0].candidate === -1 && al[0].compare[0].equal === false && al[0].compare[1].rosterBlockMin === 1500, '9月の明細の乗務 25h ＝ 8月のロスター 1500分 → 候補は「前月」');
    ok(al[1].candidate === -1 && al[1].compare[0].rosterBlockMin === null, '10月の明細 30h ＝ 9月のロスター（10月のロスターは無い＝比べない）');
    const off1 = R.alignCandidates([rep('2026-09', { block_hours: 1501 / 60 })], MS.roster.byYm);
    ok(off1[0].candidate === null && off1[0].reason === 'no_match' && off1[0].compare[1].diffMin === 1, '1分でも違えば候補を出さない（作らない）');
    ok(R.alignCandidates([rep('2026-09', { block_hours: 1501 / 60 })], MS.roster.byYm, { tolerance: 1 })[0].candidate === -1, '許す幅を明示したときだけ広げる（tolerance）');
    const same = R.rosterMonths(month('2026-08', null, [3, 4]).concat(month('2026-09', null, [7, 8])), PROFILE);
    const amb = R.alignCandidates([rep('2026-09', { block_hours: 5 })], same)[0];
    ok(amb.candidate === null && amb.ambiguous === true, '両方の月とぴったりなら決めない（ambiguous）');
    ok(R.alignCandidates([rep('2026-09', {})], MS.roster.byYm)[0].reason === 'no_slip_block', '明細に乗務時間が無ければ候補なし');
  }
  {
    const fl10 = MS.months[1].lines.find((l) => l.labelKey === 'flight pay');
    ok(fl10.workYm === '2026-09' && fl10.mapKey === 'k:flight' && fl10.offset === -1, '対応表 k:flight（前月）→ 10月の変動給は9月の勤務');
    const un = MS.months[0].lines.find((l) => l.kind === 'unexplained');
    ok(un && un.workYm === null && un.mapStatus === null, '対応表に無い行は勤務月なし（他の会社の対応表を使わない）');
    const W8 = MS.work.find((w) => w.ym === '2026-08'), W9 = MS.work.find((w) => w.ym === '2026-09'), W10 = MS.work.find((w) => w.ym === '2026-10');
    ok(W8.byCurrency.JPY.inGross === 75000 && J(W8.missingPayMonths) === J(['2026-08']), '8月の勤務：9月の明細の変動給だけ・8月の明細（基本給）が無いことを示す');
    ok(W9.byCurrency.JPY.inGross === 490000 && J(W9.fromPayMonths) === J(['2026-09', '2026-10']) && W9.missingPayMonths.length === 0, '9月の勤務：9月の基本給＋10月の変動給（支給月をまたいで集める）');
    ok(J(W10.missingPayMonths) === J(['2026-11']), '10月の勤務：変動給の届く11月の明細がまだ無い');
    const B = R.cardB(MS, { basis: 'roster', num: 'gross', den: 'duty' });
    const p9 = B.points.find((p) => p.ym === '2026-09');
    ok(p9.numerator === 490000 && p9.denominator === 12 * 480 && near(p9.value, 490000 * 60 / 5760), 'B（勤務月）：対応づけた行 ÷ その月のロスターの勤務時間');
    ok(B.points.find((p) => p.ym === '2026-10').reason === 'no_roster', 'B（勤務月）：ロスターの無い月は割らない');
    ok(R.cardB(MS, { basis: 'roster', num: 'net' }).points.every((p) => p.value === null && p.reason === 'net_not_itemized'), 'B（勤務月）：手取りは項目に割れない＝出さない');
    const sm = R.summary(MS);
    ok(sm.composition.cats.find((c) => c.cat === 'unexplained').amount === 25000 + 7000, '勤務月の分からない行も収入の構成には入る');
    ok(B.days.length === 22 && B.dist.length === 1 && B.dist[0].fromMin === 480 && B.dist[0].n === 22, 'B：日ごとの点と勤務時間の分布（勤務月の日）');
  }
  {
    const retro = MS.months[1].lines.find((l) => l.labelKey === 'retro pay adj');
    ok(retro.workYm === '2026-07' && retro.mapKey === '2026-10|retro pay adj', '後の月の調整：その月だけの対応（2026-10|…）が、項目の対応より先に当たる');
    const m3 = R.build({ reports: [s09, s10, rep('2026-11', { gross_monthly: 100000, base_pay: 80000, other_allowance: 20000 })],
      items: [it09, it10, item('2026-11', { other: [{ amount: 20000, label: 'Retro  Pay ADJ' }] })], maps, roster });
    const r11 = m3.months[2].lines.find((l) => l.labelKey === 'retro pay adj');
    ok(r11.ownPeriod === true && r11.workYm === null, '項目だけ別の期間（その他・期間なし）：勤務月に入れず、単位あたりから外す');
    ok(!m3.work.some((w) => w.lines.includes(r11)), '別の期間の行は勤務月の集計に入らない');
  }

  /* ▼ 賞与・パーディアム・非現金を二重に数えない */
  {
    const r = rep('2026-05', { gross_monthly: 900000, net_pay_actual: 700000, deduction_total: 200000, base_pay: 400000, other_allowance: 300000,
      per_diem: 30000, perdiem_outside_gross: true, bonus_annual: 1200000 });
    r.payslip_detail = { v: 1, earnings: [{ label: '賞与', amount: 300000, kind: 'bonus' }, { label: '航空券課税', amount: 8000, kind: 'notional' }], hours: [] };
    const L = R.linesOf(r);
    const inG = L.lines.filter((l) => l.inGross).reduce((a, l) => a + l.amount, 0);
    ok(L.lines.find((l) => l.label === '賞与').kind === 'other' && !L.lines.some((l) => l.amount === 1200000), '明細に出た賞与は「その他」の内訳に1回・年額の申告は行にしない');
    const pd = L.lines.find((l) => l.kind === 'perdiem');
    ok(pd.outsideGross && !pd.inGross && L.received === 930000 && inG === 900000, 'パーディアム（明細とは別）：総支給の外・受け取った額にだけ足す');
    const nt = L.lines.find((l) => l.kind === 'notional');
    ok(nt.inGross && !nt.cash && nt.counted && L.unexplained === 900000 - 700000 - 8000 && inG === 900000, '非現金（航空券課税）：総支給の中から切り出す・現金とは言わない・残りから引く');
    const r6 = rep('2026-06', { gross_monthly: 700000, base_pay: 700000 });
    r6.payslip_detail = { earnings: [{ label: '航空券課税', amount: 8000, kind: 'notional' }] };
    const L6 = R.linesOf(r6), n6 = L6.lines.find((l) => l.kind === 'notional');
    ok(!n6.counted && !n6.inGross && L6.lines.filter((l) => l.inGross).reduce((a, l) => a + l.amount, 0) === 700000, '総支給に収まらない非現金は数えない（見せるだけ）');
    const m = R.build({ reports: [r, rep('2026-06', { gross_monthly: 700000, base_pay: 700000, bonus_annual: 1200000 })] });
    const y = R.summary(m).years[0];
    ok(y.bonusDeclared.amount === 1200000 && y.totals.gross === 1600000, '年の合計に申告の賞与を足さない（申告は別に1回だけ）');
  }

  /* ▼ 検算：一致する月と、食い違う月 */
  {
    const good = rep('2026-01', { gross_monthly: 600000, net_pay_actual: 450000, deduction_total: 150000, base_pay: 500000 });
    const over = rep('2026-02', { gross_monthly: 600000, net_pay_actual: 450000, deduction_total: 150000, base_pay: 700000 });
    const net = rep('2026-03', { gross_monthly: 600000, net_pay_actual: 440000, deduction_total: 150000, base_pay: 500000 });
    const m = R.build({ reports: [good, over, net] });
    const ck = R.checks(m);
    ok(ck.months[0].sumToGross === true && ck.months[0].grossMinusDeductEqNet === true, '一致：内訳 → 総支給・総支給 − 控除 ＝ 手取り');
    ok(ck.months[1].sumToGross === false && ck.months[1].overGross === 100000, '食い違い：内訳が総支給を 100,000 超える → 赤');
    ok(ck.months[2].grossMinusDeductEqNet === false, '食い違い：総支給 − 控除 ≠ 手取り → 赤');
    ok(ck.pairs[0].waterfallEqDelta === false && ck.pairs[1].waterfallEqDelta === false, '食い違う月をはさむ増減の合計は Δ総支給と合わない → 赤');
    const m2 = R.build({ reports: [good, rep('2026-02', { gross_monthly: 640000, net_pay_actual: 470000, deduction_total: 170000, base_pay: 500000 })] });
    ok(R.checks(m2).pairs[0].waterfallEqDelta === true, '一致する2か月の増減の合計は Δ総支給');
    const der = R.build({ reports: [rep('2026-01', { annual_total_orig: 6000000, base_pay: 500000 }), rep('2026-02', { annual_total_orig: 6600000, base_pay: 550000 })] });
    const ckd = R.checks(der);
    ok(ckd.months[0].sumToGross === null && ckd.pairs[0].waterfallEqDelta === null && der.months[0].grossBasis === 'derived', '総支給の欄が無い月は検算しない（null・作らない）');
  }

  /* ▼ ロスターの集計 */
  {
    const aug = month('2026-08', {
      3: DUTY('x'),
      5: { code: null, d_on: '06:00', d_off: '14:00', d_off_day: 0, legs: [
        { seq: 1, flight: 'PV201', from: 'HND', to: 'CTS', out: '07:00', in: '08:35', in_day: 0, block: '1:35', role: 'CAP', kind: 'operating' },
        { seq: 2, flight: 'PV202', from: 'CTS', to: 'HND', out: '10:00', in: '11:05', in_day: 0, block: '1:05', role: 'DH1', kind: 'deadhead' }] },
      7: { code: 'TRN', d_on: '09:00', d_off: '17:00', d_off_day: 0, legs: [{ seq: 1, loc: 'TRC', out: '09:00', in: '12:00', in_day: 0, kind: 'ground' }] },
      9: { code: null, d_on: '08:00', d_off: '12:00', d_off_day: 0, legs: [{ seq: 1, flight: 'X1', from: 'HND', to: 'NRT', block: '0:45', kind: 'unknown' }] },
      15: { code: 'XYZ', d_on: null, d_off: null, legs: [] },
      20: { code: 'VAC', d_on: null, d_off: null, legs: [] },
      31: { code: null, d_on: '21:00', d_off: '05:30', d_off_day: 1, legs: [{ seq: 1, flight: 'PV301', from: 'HND', to: 'HKG', out: '22:00', in: '02:10', in_day: 1, block: '5:10', role: 'CAP', kind: 'operating' }] }
    });
    aug[2].date = '2026-08-03';
    const rm = R.rosterMonths(aug.concat([{ date: '2026-09-01', code: 'OFF1', legs: [] }]), PROFILE);
    const A = rm[0], S = rm[1];
    ok(A.complete && A.dutyDays === 5 && A.vacDays === 1 && A.offDays === 24, '勤務日・休暇・休日（コードの区分は本人の profile.codes）');
    ok(A.dutyMin === 480 + 480 + 480 + 240 + 510, '総勤務：日付をまたぐ 21:00→翌05:30 は 510 分・D-ON の日（8/31）の月に数える');
    ok(A.blockMin.operating === 150 + 95 + 310 && A.blockMin.deadhead === 65 && A.blockMin.unknown === 45, '区間時間を種類ごとに（乗務・DH・不明を混ぜない）');
    ok(A.blockMin.ground === null && A.gaps.block.ground === 1 && A.partial.blockMin.ground === 0, '地上の時間：印字が無く時刻が現地なら作らない（null・欠け1）');
    ok(A.sectors === 4 && A.dhLegs === 1 && A.groundLegs === 1 && A.unknownLegs === 1, '便数は乗務の区間だけ・DH は別に数える');
    ok(A.classCounts.unclassified === 1 && J(A.unclassifiedCodes) === J(['XYZ']), '区分の分からないコードは聞く対象として残す');
    ok(S.complete === false && S.dutyDays === null && S.offDays === null && S.partial.offDays === 1 && S.dutyMin === null, '欠けた月は null（0 にしない）・分かった分は partial');
    const leg = A.days[6].legs[0];
    ok(leg.loc === 'TRC' && leg.from === null && leg.to === null, '地上の場所コードを空港間の便にしない');
    const U = R.rosterMonths(aug, Object.assign({}, PROFILE, { time_ref: 'utc' }))[0];
    ok(U.blockMin.ground === 180, 'UTC と確かめた時刻なら、発着の時刻から区間時間を数える');
    const bad = R.rosterMonths([{ date: '2026-08-01', d_on: '15:00', d_off: '07:00', d_off_day: 0, legs: [] }], PROFILE)[0];
    ok(bad.days[0].dutyMin === null && bad.days[0].invalidTimes, '終わりが始まりより前（日付またぎの印なし）は作らない');
    const dst = [{ date: '2026-03-29', d_on: '00:30', d_off: '03:30', d_off_day: 0, legs: [] }];
    const tz = R.rosterMonths(dst, { time_ref: 'local', tz: 'Europe/London' })[0].days[0];
    const clk = R.rosterMonths(dst, { time_ref: null })[0].days[0];
    ok(tz.dutyMin === 120 && tz.elapsedBasis === 'tz' && clk.dutyMin === 180 && clk.elapsedBasis === 'clock', '時刻帯：夏時間の朝は 120 分（確かめていない時刻は時計の差＋印）');
  }

  /* ▼ 手当の掘り下げ（分解の合計 ＝ 実際の差） */
  {
    const a = rep('2026-01', { gross_monthly: 500000, base_pay: 400000, flight_variable_pay: 100000, other_allowance: 100000, block_hours: 80.5 });
    const b = rep('2026-02', { gross_monthly: 513000, base_pay: 400000, flight_variable_pay: 113000, other_allowance: 113000, block_hours: 91.5 });
    a.pay_items = { variable: [{ amount: 100000, basis: 'block', label: 'Flight Pay' }] };
    b.pay_items = { variable: [{ amount: 113000, basis: 'block', label: 'Flight Pay' }] };
    const m = R.build({ reports: [a, b] });
    const C = R.cardC(m, { item: 'flight pay' }), D = C.decomposition;
    ok(C.series[0].qty.value === 4830 && near(C.series[0].ref, 100000 * 60 / 4830), 'C：数量（同じ明細の乗務）と参考値（額 ÷ 時間）');
    ok(D.delta === 13000 && D.qtyEffect === Math.round(660 * 100000 / 4830) && D.qtyEffect + D.residual === D.delta, 'C：数量の差 × 前の参考値 ＋ 残り ＝ 実際の差（ぴったり）');
    ok(!Object.keys(D).some((k) => /rate.?change|contract/i.test(k)), 'C：残りを「単価の変更」と呼ばない');
    const w = rep('2026-03', { gross_monthly: 450000, base_pay: 400000, flight_variable_pay: 50000, other_allowance: 50000, duty_days: 18 });
    w.pay_items = { variable: [{ amount: 50000, basis: 'weekend', label: 'Weekend Duty' }] };
    const w2 = Object.assign({}, w, { period_month: 4, flight_variable_pay: 60000, other_allowance: 60000, gross_monthly: 460000, pay_items: { variable: [{ amount: 60000, basis: 'weekend', label: 'Weekend Duty' }] } });
    const Cw = R.cardC(R.build({ reports: [w, w2] }), { item: 'weekend duty' });
    ok(Cw.series.every((s) => s.qty === null && s.ref === null) && Cw.decomposition.reason === 'no_quantity', '週末手当：日数が分からなければ日割りしない（勤務日数でも割らない）');
    const mq = R.build({ reports: [w, w2], maps: [{ airline: 'pv', label_key: 'weekend duty', offset: null, status: 'unknown', qty_kind: 'dutyDays' }] });
    ok(R.cardC(mq, { item: 'weekend duty' }).series[0].qty.value === 18, '本人が数量を確かめた（qty_kind）ときだけ、その数量で割る');
  }

  /* ▼ 給与ルールの候補（D の口） */
  {
    const days = [600, 420, 600].map((d, i) => ({ date: '2026-08-0' + (i + 1), ym: '2026-08', isDuty: true, dutyMin: d, blockMin: { operating: 300 } }));
    const de = R.ruleFit.dailyExcess(days, 480);
    const total = 1620;
    ok(de.total === 240 && de.count === 2, '日ごとの超過：120 ＋ 0 ＋ 120 ＝ 240 分');
    ok(R.ruleFit.monthlyExcess(total, 1500) === 120 && R.ruleFit.monthlyExcess(total, 480) === 1140 && de.total !== R.ruleFit.monthlyExcess(total, 480),
       '月の合計に当てる式は別物（同じ日でも答えが違う）');
    ok(R.ruleFit.dailyExcess(days.concat([{ date: '2026-08-05', isDuty: true, dutyMin: null }]), 480).total === null, '時間の分からない勤務日があれば日ごとの合計は出さない');
    ok(R.ruleFit.guarantee(3000, 4500) === 4500 && R.ruleFit.guarantee(5000, 4500) === 5000 && R.ruleFit.guarantee(null, 4500) === null, '保証：max(数量, 保証)');
    const rows = [['2026-01', 100], ['2026-02', 120], ['2026-03', 90], ['2026-04', 110], ['2026-05', 100]].map(([ym, x], i) => ({ ym, x, y: i === 4 ? 260 : 2 * x }));
    const sp = R.ruleFit.holdout(rows.map((r) => r.ym));
    const ev = R.ruleFit.evaluate(rows, sp);
    ok(J(sp.validate) === J(['2026-05']) && sp.fit.length === 4 && sp.fit.indexOf('2026-05') < 0, '当てはめの月と検証の月を分ける（最新1か月を検証へ）');
    ok(ev.rate === 2 && ev.fit.maxAbsError === 0 && ev.validation.maxAbsError === 60 && ev.rows[4].role === 'validate', '単価は当てはめの月だけで出し、検証の月の誤差を別に返す');
    const ev2 = R.ruleFit.evaluate(rows.map((r) => r.ym === '2026-05' ? Object.assign({}, r, { y: 999 }) : r), sp);
    ok(ev2.rate === ev.rate, '検証の月の額を変えても単価は変わらない（使っていない）');
    ok(ev.status === 'exploration' && !/confiden|確度|probab/i.test(J(ev)), '確度の％を作らない・「確定」にしない');
    ok(R.ruleFit.holdout(['2026-01', '2026-02']).validate.length === 0, '2か月しか無ければ検証に回さない（当てはめは2か月以上）');
    const fr = R.ruleFit.fitRate([{ x: 60, y: 120 }, { x: 120, y: 240 }]);
    ok(fr.rate === 2 && R.ruleFit.fitRate([{ x: 0, y: 5 }]).rate === null, '原点を通る最小二乗・分母 0 なら出さない');
    const c1 = R.ruleFit.candidate(MS, { item: 'k:flight', kind: 'daily', qty: 'duty', thresholdMin: 420, validate: 0 });
    const c2 = R.ruleFit.candidate(MS, { item: 'k:flight', kind: 'monthly', qty: 'duty', thresholdMin: 4200, validate: 0 });
    ok(c1.rows.length === 2 && c1.rows[0].workYm === '2026-08' && c1.rows[0].x === 10 * 60 && c2.rows[0].x === 4800 - 4200, '候補：対応づけた勤務月のロスターで、日ごと（600分）と月（600分）を別に数える');
    ok(c1.contributions.length === 22 && c1.contributions[0].excessMin === 60, '候補：日ごとの寄与（どの日が何分）を返す');
    const one = R.build({ reports: [s10], items: [it10], maps, roster });
    const k1 = R.ruleFit.candidate(one, { item: 'k:flight', kind: 'daily', thresholdMin: 420 });
    const k2 = R.ruleFit.candidate(one, { item: 'k:flight', kind: 'daily', thresholdMin: 300 });
    ok(J(R.ruleFit.compare([k1, k2])) === J([[0, 1]]), '1か月に合うだけの候補どうしは「区別できない」と束ねる');
    const nomap = R.ruleFit.candidate(R.build({ reports: [s09], items: [it09], roster }), { item: 'k:flight', kind: 'daily', thresholdMin: 420 });
    ok(nomap.rows.length === 0 && nomap.skipped[0].reason === 'work_month_unknown', '勤務月が分からない月は候補の計算に使わない');
  }

  /* ▼ my_report_items だけの行（判定はサーバと同じ式で pay_items から） */
  {
    const it = item('2026-04', { union: { extra: 'yes', source: 'union', amount: 30000 }, per_diem_src: 'outside' }, null,
      { currency: 'JPY', fx_to_jpy: 1, gross_monthly: 400000, net_pay_actual: 320000, deduction_total: 80000, union_pay: 30000, base_pay: 350000, per_diem: 10000 });
    const m = R.build({ items: [it] });
    const L = m.months[0];
    ok(L.lines.find((l) => l.kind === 'union').outsideGross && L.lines.find((l) => l.kind === 'perdiem').outsideGross && L.unexplained === 50000,
       '明細の項目だけの行でも、組合（組合払い）・パーディアム（明細とは別）は総支給の外');
  }

  /* ▼ 分割スクショのつなぎ */
  {
    const D = (date, o) => Object.assign({ date, code: null, d_on: '07:00', d_off: '15:00', d_off_day: 0, cut: null, page: 1, row: 1, legs: LEGS2() }, o || {});
    const p1 = { v: 1, period: { from: '2026-08-01', to: '2026-08-31' }, hints: { kind: 'actual', time_ref: null }, days: ['01', '02', '03', '04', '05'].map((d) => D('2026-08-' + d)) };
    const p2 = { v: 1, period: null, hints: { kind: 'actual', time_ref: null }, days: ['03', '04', '05', '06', '07', '08'].map((d) => D('2026-08-' + d, { page: 2 })) };
    const mg = R.mergePages([p1, p2]);
    ok(mg.days.length === 8 && J(mg.days.map((d) => d.date.slice(8))) === J(['01', '02', '03', '04', '05', '06', '07', '08']), '3日重なる2枚：日付は1回ずつ');
    ok(mg.days.every((d) => d.legs.length === 2) && mg.issues.length === 0, '重なった日の区間を二重にしない・食い違いなし');
    ok(J(R.mergePages([p1, p1])) === J(R.mergePages([p1])) && J(R.mergePages([p2, p2, p2]).days) === J(R.mergePages([p2]).days), '同じスクショを何回出しても変わらない');
    const A = D('2026-08-10', { d_off: null, cut: 'bottom', legs: [
      { seq: 1, flight: 'PV111', from: 'HND', to: 'FUK', out: '08:00', in: '09:50', in_day: 0, block: '1:50', role: 'CAP', kind: 'operating' },
      { seq: 2, flight: 'PV112', from: 'FUK', to: 'HND', out: '10:40', in: '12:15', in_day: 0, block: '1:35', role: 'CAP', kind: 'operating' }] });
    const B = D('2026-08-10', { d_on: null, d_off: '18:00', cut: 'top', page: 2, legs: [
      { seq: 1, flight: 'PV113', from: 'HND', to: 'OKA', out: '13:00', in: '15:30', in_day: 0, block: '2:30', role: 'CAP', kind: 'operating' },
      { seq: 2, flight: 'PV114', from: 'OKA', to: 'HND', out: '15:30', in: '17:40', in_day: 0, block: '2:10', role: 'CAP', kind: 'operating' }] });
    for (const order of [[A, B], [B, A]]) {
      const m = R.mergePages(order.map((d) => ({ days: [d] })));
      const d = m.days[0];
      ok(d.legs.length === 4 && J(d.legs.map((l) => l.flight)) === J(['PV111', 'PV112', 'PV113', 'PV114']) && J(d.legs.map((l) => l.seq)) === J([1, 2, 3, 4]),
         `1日が2枚に割れた（${order[0] === A ? '上→下' : '下→上'}の順）：区間を合わせて時刻順に番号を振り直す`);
      ok(d.cut === null && d.d_on === '07:00' && d.d_off === '18:00' && !m.issues.length, '上と下がそろえば欠けではない・D-ON は上から・D-OFF は下から');
    }
    const P1 = D('2026-08-12', { cut: 'bottom', legs: [
      { seq: 1, flight: 'PV121', from: 'HND', to: 'KIX', out: '08:00', in: '09:10', in_day: 0, block: '1:10', kind: 'operating' },
      { seq: 2, flight: 'PV124', from: 'HND', to: 'ITM', out: '10:00', in: null, block: null, kind: 'operating', partial: true }] });
    const P2 = D('2026-08-12', { cut: 'top', page: 2, legs: [
      { seq: 1, flight: null, from: null, to: 'ITM', out: null, in: '11:10', in_day: 0, block: '1:10', kind: 'operating', partial: true },
      { seq: 2, flight: 'PV125', from: 'ITM', to: 'HND', out: '12:30', in: '13:40', in_day: 0, block: '1:10', kind: 'operating' }] });
    const mp = R.mergePages([{ days: [P1] }, { days: [P2] }]), lp = mp.days[0].legs;
    ok(lp.length === 3 && lp[1].flight === 'PV124' && lp[1].in === '11:10' && lp[1].block === '1:10' && lp[1].partial === false && !mp.issues.length,
       '端で切れた区間：もう1枚の写りで欠けた欄を埋める（新しく作らない）');
    const C1 = D('2026-08-14', { d_on: '06:00' }), C2 = D('2026-08-14', { d_on: '06:30', page: 2, legs: LEGS2().slice(0, 1) });
    const mc = R.mergePages([{ days: [C2] }, { days: [C1] }]);
    const iss = mc.issues.find((x) => x.field === 'd_on');
    ok(iss && J(iss.values) === J(['06:30', '06:00']) && mc.days[0].d_on === '06:00', 'D-ON の食い違い：区間の多い写りを採り、本人に聞く印を残す');
    const two = R.mergePages([{ days: [D('2026-08-15', { legs: [LEGS2()[0]] })] }, { days: [D('2026-08-15', { legs: [Object.assign(LEGS2()[0], { out: '18:00', in: '19:15' })] })] }]);
    ok(two.days[0].legs.length === 2, '同じ便名でも発時刻が違えば別の区間');
    const inc = R.mergePages([{ days: [D('2026-08-20', { cut: 'bottom', d_off: null })] }]);
    ok(inc.days.length === 1 && inc.issues.some((x) => x.date === '2026-08-20' && x.type === 'incomplete' && x.cut === 'bottom'), '下が切れたまま続きの写りが無い日：残して「欠けている」と知らせる');
    const R1 = { days: [D('2026-08-30'), D('2026-08-31', { d_on: '21:00', d_off: '05:30', d_off_day: 1, legs: [
      { seq: 2, flight: 'PV302', from: 'HKG', to: 'HND', out: '00:40', in: '05:00', in_day: 1, block: '4:20', kind: 'operating' },
      { seq: 1, flight: 'PV301', from: 'HND', to: 'HKG', out: '22:00', in: '00:10', in_day: 1, block: '3:10', kind: 'operating' }] })] };
    const R2 = { days: [D('2026-08-31', { d_on: '21:00', d_off: '05:30', d_off_day: 1, cut: 'top', legs: [{ seq: 1, flight: 'PV302', from: 'HKG', to: 'HND', out: '00:40', in: '05:00', in_day: 1, block: '4:20', kind: 'operating' }] }), D('2026-09-01', { code: 'OFF1', d_on: null, d_off: null, legs: [] })] };
    const mr = R.mergePages([R1, R2]);
    const d31 = mr.days.find((d) => d.date === '2026-08-31');
    ok(J(mr.days.map((d) => d.date)) === J(['2026-08-30', '2026-08-31', '2026-09-01']) && d31.d_off_day === 1 && d31.legs.length === 2 && d31.legs[0].flight === 'PV301',
       '月またぎ（8/31 → 9/1）：日付と「翌日」の印を保ち、0時過ぎの区間は後ろに');
    const back = R.rosterMonths(mr.days, PROFILE);
    ok(back[0].ym === '2026-08' && back[0].days.find((d) => d.date === '2026-08-31').dutyMin === 510, 'つないだ日はそのまま集計に渡せる');

    /* ▼ 空欄の日・読めなかった日（2026-11-09 オーナー「何も無い日がある（OFF でもない）」） */
    const E0 = { d_on: null, d_off: null, legs: [] };
    const B1 = { days: [D('2026-08-16', E0), D('2026-08-17', { d_on: '06:00', d_off: null, legs: [], unread: true }), D('2026-08-18')] };
    const B2 = { days: [D('2026-08-16', { page: 2 }), D('2026-08-17', Object.assign({ code: 'OFF1', page: 2 }, E0))] };
    const mb = R.mergePages([B1, B2]), mb2 = R.mergePages([B2, B1]);
    const d16 = mb.days.find((d) => d.date === '2026-08-16'), d17 = mb.days.find((d) => d.date === '2026-08-17');
    ok(d16 && d16.d_on === '07:00' && d16.legs.length === 2 && !d16.blank && !d16.unread, '空欄の写りは中身のある写りに負ける');
    ok(d17 && d17.code === 'OFF1' && d17.d_on === null && !d17.unread && !mb.issues.length,
       '読めなかった写り（unread）の値は使わない・中身のある写りとぶつけない（食い違いにしない）');
    ok(J(mb.days) === J(mb2.days), '空欄・読めなかった写りは、どちらの順でも同じ答え');
    const lone = R.mergePages([{ days: [D('2026-08-20', E0), D('2026-08-21', Object.assign({ unread: true }, E0)), D('2026-08-22', { d_on: '07:00', d_off: null, legs: [], unread: true })] }]);
    const L0 = lone.days;
    ok(L0.length === 3 && L0[0].blank === true && !L0[0].unread && L0[1].blank === true && L0[1].unread === true && L0[1].legs.length === 0,
       'どの写りにも中身の無い日は、日付だけ残して印を付ける（空欄 blank・読めなかった unread）');
    ok(L0[2].unread === true && !L0[2].blank && L0[2].d_on === '07:00', '読めなかった日の読めた欄は残す（印つき）');
    const rmB = R.rosterMonths(L0.concat([D('2026-08-23')]), PROFILE)[0];
    ok(rmB && rmB.coveredDays === 1 && rmB.days.length === 1 && rmB.days[0].date === '2026-08-23', '空欄・読めなかった日は覆った日に数えない（データではない）');
    const rmS = R.rosterMonths([{ date: '2026-08-24', code: null, d_on: null, d_off: null, d_off_day: 0, legs: [] }, D('2026-08-25')], PROFILE)[0];
    ok(rmS && rmS.coveredDays === 1 && R.helpers.dayEmpty({ date: '2026-08-24', legs: [{ seq: 1, kind: 'ground' }] }) && !R.helpers.dayEmpty(D('2026-08-25')),
       '前に保存された空の日（印なし）も数えない・中身の無い区間だけの日も空');
  }

  /* ▼ 決定的（同じ入力 → 同じ答え） */
  {
    const a = R.build({ reports: [s09, s10], items: [it09, it10], maps, roster });
    const b = R.build({ reports: [s09, s10], items: [it09, it10], maps, roster });
    const strip = (m) => J({ months: m.months.map((x) => Object.assign({}, x, { row: null })), work: m.work.map((w) => Object.assign({}, w, { roster: null, lines: w.lines.map((l) => l.id) })), align: m.align });
    ok(strip(a) === strip(b), '同じ入力なら同じ模型');
  }
  return res;
}

/* ── 走らせる ─────────────────────────────────────────── */
let pass = 0, fail = 0;
const say = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };

console.log('▼ いまの pv-report-engine.js');
let now;
try { const E = load(SRC); now = suite(E.R, E.V); } catch (e) { now = [[false, '読み込み・実行で例外：' + (e && e.stack || e)]]; }
now.forEach(([c, m]) => say(c, m));

console.log('▼ 時計も乱数も使わない');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, () => '').replace(/^\s*\/\/.*$/gm, () => '');   // コメントを外した本体
say(!/Date\.now|Math\.random|new Date\(\)|performance\.now/.test(CODE), '計算に Date.now / Math.random / new Date() を使っていない');
say(!/\.replace\([^,]+,\s*['"`]/.test(CODE), '置き換えは関数形だけ（$ を解釈させない）');
const PII = new RegExp(['/Us' + 'ers/', '@gm' + 'ail', '@ya' + 'hoo'].join('|'));
say(!PII.test(SRC) && !PII.test(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')), '絶対パス・個人のアドレスを書いていない');

/* ▼ 壊す証明：守りの1行を外すと、上の検査が赤くなること */
console.log('▼ 壊す証明');
const BREAK = [
  ['欠けた月を 0 として出す', "dutyMin: (complete && !dutyGaps) ? dutyKnown : null,", 'dutyMin: dutyKnown,'],
  ['候補を「近い」で出す（許す幅を無視）', 'equal: diff != null && Math.abs(diff) <= tol', 'equal: diff != null && Math.abs(diff) <= 5'],
  ['内訳が総支給を超えても残りをマイナスで足す', 'if (rest < 0) { overGross = -rest; flags.overGross = true; }', 'if (false) { overGross = -rest; }'],
  ['日ごとの超過を月の合計で数える', 'excessMin: Math.max(0, v - thresholdMin)', 'excessMin: v'],
  ['検証の月も当てはめに使う', "var fitRows = rows.filter(function (r) { return split.fit.indexOf(r.ym) >= 0; });", 'var fitRows = rows;'],
  ['対応表の無い行を同じ月の勤務にする', "if (!hit) return;", "if (!hit) { l.workYm = mo.ym; l.offset = 0; return; }"],
  ['パーディアム（明細とは別）を総支給の中に数える', "inGross: o.inGross != null ? o.inGross : !o.outsideGross,", 'inGross: true,'],
  ['2進のまま丸める', "z = Number(m[2] + (frac + '000').slice(0, d));\n    if (frac.length > d && +frac.charAt(d) >= 5) z += 1;", 'z = Math.round(Number(s) * Math.pow(10, d));'],
  ['重なった日の区間を二重にする', 'if (best && tie)', 'best = null; if (best && tie)'],
  ['切れた日を黙って通す', "if (out.cut) issues.push({ date: date, type: 'incomplete', cut: out.cut });", ''],
  ['読めなかった写りの値も使う', 'var os = real.length ? real : all;', 'var os = all;'],
  ['空欄・読めなかった日も覆った日に数える', 'if (dayEmpty(D)) return; ', ''],
  ['中身の無い日に印を付けない', 'if (!dayHas(out)) out.blank = true;', ''],
  ['分解の残りを丸めずに足す', 'out.qtyEffect = q < 0 ? -Math.round(-q) : Math.round(q);', 'out.qtyEffect = q;']
];
for (const [name, from, to] of BREAK) {
  if (SRC.split(from).length !== 2) { say(false, `${name}：差し替える1行が pv-report-engine.js に1回だけ無い（検査が古い）`); continue; }
  const broken = SRC.replace(from, () => to);
  let f;
  try { const E = load(broken); f = suite(E.R, E.V).filter(([c]) => !c); } catch (e) { f = [[false, '例外']]; }
  say(f.length > 0, `${name} → 赤くなる（${f.length}件）`);
}

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
