/* db/test-analysis-ui.mjs — マイレポートの「分析」のタブ（my-analysis.js）と「給与が変わった理由」（my-value.js）の約束（2026-11-09）
   サーバも DB もブラウザも要らない。pay-viz.js → pv-report-engine.js → my-analysis.js を node の vm で読み、
   画面を持たない部品（PVAnalysis._）でカードの HTML を組んで確かめる。給与サマリーの判定は my-value.js から
   whyModel の関数をそのまま切り出して評価する（写さない）。データはすべて作り物。

   守っていること（どれも、わざと壊すと赤くなることをこのファイルの最後で確かめる）
   ① 後から読む：分析の2本は指紋つきで、見た目と計算の部品が先・画面が後。マイページの HTML は直に読まない。
   ② 月は決め打ちしない：別の年のデータを入れると、見出しも図もその年で出る（コードに年月・見本の閾値が無い）。
   ③ 増減の「残り」を単価の変更と呼ばない（日英西）。
   ④ 計算候補に確度の％を出さない。
   ⑤ 「いつの勤務の分？」は候補に印を付けるだけで、描いただけでは保存しない（押したときだけ）。
   ⑥ 給与が変わった理由：検算（増減の合計 ＝ Δ総支給・内訳の合計 ＝ 総支給・同じ通貨・前の明細あり）が1つでも通らなければ描かない
      （＝前回の明細との差に戻す）。通るときは項目の増減の合計が Δ総支給にぴったり合う。
   ⑦ 1か月なら比較を出さず、「2か月目から」を見出しで1回だけ言う。週末・祝日の手当を日数で割らない。
   ⑧ CSV は選んでいる期間だけ（ファイル名と1行目に範囲・ほかの月を1つも書かない・通貨の欄・時間は H:MM と分）。
      字の包み方は my-value.js の csvText（BOM・CRLF・引用符・表計算の式にさせない）。
   ⑨ 印刷は表示中のタブの写しだけ（隠れたタブ・タブの帯は紙に出さない・操作の部品は外す）。
   ⑩ 比べる明細は選ばせない（いちばん新しい明細 ⇄ その前の同じ通貨の明細・月が飛んでも実際の月の名前）。期間は 3か月｜6か月｜1年｜全部
      （既定 1年・明細が3か月以下なら出さない・中身が同じ候補は出さない）。期間の外の月は B の棒・A の積み上げ・C の推移・CSV に出ない。
      A は「収入の構成」が先で既定。期間に3か月以上なら月ごとの積み上げ・2か月までは今までの2本。
   ⑪ B の数量の基準の既定は「勤務1時間 → 乗務1時間 → 1勤務日 → 1便」で期間に数がある最初のもの（本人が選んだらそのまま）。
      数が無い基準は空の図・見方の切り替え・「—」を出さず1行だけ。目盛は同じ字を2本描かない・数が無ければ描かない。
   ⑫ 不要な文言を置かない（2026-11-10 オーナー）：見出し（LOOK DEEPER・題・「◯月を◯月と比べています」）も右上の札も無い。
      比べている前の月は大きい数字の横（「11月から」）で、実際の月の名前で言う。B の題名は数量の基準に合わせて変わる。
      「いつの勤務の分？」の問いに、選んでいる手当の名前が入る。 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const escH = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const VIZ = read('pay-viz.js'), ENG = read('pv-report-engine.js'), ANA = read('my-analysis.js'), MV = read('my-value.js');

function load(ana, lang = 'ja') {
  const win = {
    document: { documentElement: { getAttribute: () => (lang === 'ja' ? 'ja' : 'en') }, addEventListener() {}, createElement() { return {}; } },
    addEventListener() {}
  };
  win.window = win;
  if (lang === 'es') { win.PV_LANG = 'es'; win.PV_BASE = 'en'; win.PV_T = (T, L) => T.es || T[L]; }
  if (lang === 'en') { win.PV_LANG = 'en'; win.PV_BASE = 'en'; }
  const ctx = vm.createContext(win);
  for (const s of [VIZ, ENG, ana]) vm.runInContext(s, ctx);
  return { A: win.PVAnalysis && win.PVAnalysis._, R: win.PVReport, win };
}
/* my-value.js の whyModel をそのまま切り出す（波かっこを数える） */
function cut(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let k = src.indexOf('{', i), depth = 0;
  for (; k < src.length; k++) { if (src[k] === '{') depth++; else if (src[k] === '}') { depth--; if (!depth) break; } }
  return src.slice(i, k + 1);
}

/* ── 作り物 ─────────────────────────────────────────────── */
const pad = (n) => String(n).padStart(2, '0');
function rep(ym, o) {
  const [y, m] = ym.split('-').map(Number);
  return Object.assign({ airline: 'pv', airline_other: null, period_year: y, period_month: m, currency: 'JPY', fx_to_jpy: 1,
    gross_monthly: null, net_pay_actual: null, deduction_total: null, base_pay: null, command_pay: null, flight_variable_pay: null, other_allowance: null,
    housing_type: null, housing_amount: null, transport: null, per_diem: null, block_hours: null, duty_hours: null, sectors: null, duty_days: null,
    union_outside_gross: false, perdiem_outside_gross: false, absence_total: 0 }, o || {});
}
/* 内訳の合計 ＝ 総支給（手取り＋控除）になる月。fv は乗務の手当（時間）、wk は週末の手当（数量なし） */
function month(ym, fv, wk, block, o) {
  const base = 500000, cmd = 60000, oth = fv + wk, gross = base + cmd + oth;
  const r = rep(ym, Object.assign({ gross_monthly: gross, net_pay_actual: gross - 120000, deduction_total: 120000, base_pay: base, command_pay: cmd,
    flight_variable_pay: fv, other_allowance: oth, block_hours: block, duty_hours: block * 1.8, sectors: 40, duty_days: 16 }, o || {}));
  const items = { airline: 'pv', airline_other: null, period_year: r.period_year, period_month: r.period_month,
    pay_items: { variable: [{ amount: fv, basis: 'block', label: 'Flight Pay' }], other: [{ amount: wk, label: 'Weekend Duty' }] } };
  return { r, items };
}
function days(ym, blockPerDay, dutyDays) {
  const n = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate(), out = [];
  for (let d = 1; d <= n; d++) {
    const date = ym + '-' + pad(d);
    if (d <= dutyDays) out.push({ date, code: null, d_on: '07:00', d_off: '16:30', d_off_day: 0,
      legs: [{ seq: 1, flight: 'PV1', from: 'AAA', to: 'BBB', out: '08:00', in: '09:00', in_day: 0, block_min: blockPerDay, role: 'CAP', kind: 'operating' }] });
    else out.push({ date, code: 'OFF', d_on: null, d_off: null, d_off_day: 0, legs: [] });
  }
  return out;
}
const PROFILE = { kind: 'actual', time_ref: 'local', tz: null, time_meaning: 'block', codes: { OFF: 'off' } };
const SEG = { base: 'Base', command: 'Command', flight: 'Flight', other: 'Other', rest: 'Rest', bonus: 'Bonus' };
/* 別の年（2031）で：12か月・ロスターは最後の2か月の前月ぶん（支給月 = 勤務月の翌月）。block はロスターと同じ分（候補が出る） */
function fixture12() {
  const reps = [], items = [];
  for (let i = 0; i < 12; i++) {
    const ym = '2031-' + pad(i + 1), block = 60 + i;                     // 60h〜71h
    const m = month(ym, block * 4000, 9000 * (2 + (i % 3)), block);
    reps.push(m.r); items.push(m.items);
  }
  /* 勤務月 2031-10・2031-11 のロスター：1日の便の時間 × 30日 ＝ 70h・71h → 支給月 11・12 の明細の block と同じ（候補が出る） */
  const roster = { days: days('2031-10', 140, 30).concat(days('2031-11', 142, 30)), profile: PROFILE };
  return { reps, items, roster };
}

function suite(A, R, opts) {
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  if (!A) return ['部品が読めない'];
  const T = A.T;
  let rpc = 0;
  const sb = { rpc: () => { rpc++; return Promise.resolve({ data: { ok: true } }); } };

  /* ② 2031 年のデータ：見出しと図がその年で出る */
  const F = fixture12();
  A.set({ ctx: { reports: F.reps, segName: SEG }, sb, items: { items: F.items, maps: [], ok: true }, roster: F.roster, airline: 'pv', other: null,
          sel: { a: null, b: null }, C: { item: null, other: false, busy: false, msg: null, edit: false } });
  A.build();
  const S = A.S;
  ok(S.sel.b === '2031-12' && S.sel.a === '2031-11', '② 既定は最新の2か月（データから）：' + S.sel.a + ' → ' + S.sel.b);
  let all = '';
  try { all = A.headHTML() + A.cardA() + A.cardB() + A.cardC() + A.cardD(); } catch (e) { fails.push('カードが組めない: ' + e.message); }
  ok(/2031/.test(all) && !/20(2\d|30)/.test(all), '② 見出しとカードはデータの年（2031）だけ・ほかの年を出さない');
  ok(!all.includes(T.one), '⑦ 2か月以上では「2か月目から」を言わない');

  /* ⑩ 比べる明細は選ばせない・期間 */
  const box = () => ({ clientWidth: 640, innerHTML: '' });
  const drawn = (k) => { const b = box(); A.drawBox(b, k); return b.innerHTML; };
  const pressed = (h, act) => { const m = h.match(new RegExp('data-act="' + act + '" data-v="([^"]+)" aria-pressed="true"')); return m && m[1]; };
  const pers = (h) => [...h.matchAll(/data-act="per" data-v="([^"]+)"/g)].map((m) => m[1]);
  const has = (h, yms) => yms.every((y) => h.includes(A.ymL(y)));
  const hasNone = (h, yms) => yms.every((y) => !h.includes(A.ymL(y)));
  const head = A.headHTML();
  ok(!/<select/.test(head), '⑩ 見出しに月を選ぶ欄が無い');
  const headTx = head.replace(/<[^>]+>/g, ' ');
  ok(!/class="an-(ey|h|sub)"/.test(head) && !/LOOK DEEPER/i.test(head) && !headTx.includes(A.ymL('2031-12')) && !headTx.includes(A.ymL('2031-11')),
     '⑫ 見出し（LOOK DEEPER・題・比べている月と枚数）を置かない');
  ok(!/an-badge/.test(all) && T.aBadge == null && T.bBadge == null && T.cBadge == null && T.dBadge == null, '⑫ カードの右上の札を置かない');
  ok(A.cardB().includes('<span class="an-cap">' + escH(A.fill(T.from, { a: A.ymS('2031-11') })) + '</span>'),
     '⑫ 比べている前の月は、大きい数字の横に実際の月の名前で（「11月から」）');
  ok(S.per === '1y' && pressed(head, 'per') === '1y', '⑩ 期間の既定は1年：' + S.per + ' / ' + pressed(head, 'per'));
  ok(pers(head).join() === '3m,6m,1y', '⑩ 12か月：中身が1年と同じ「全部」は出さない：' + pers(head).join());
  A.set({ per: 'all' });
  ok(pressed(A.headHTML(), 'per') === '1y', '⑩ 「全部」を選んでいても、同じ中身の「1年」が押されて見える');
  A.set({ per: '1y' });
  const a12 = A.cardA();
  ok(a12.indexOf('data-v="comp"') >= 0 && a12.indexOf('data-v="comp"') < a12.indexOf('data-v="change"') && pressed(a12, 'a-view') === 'comp',
     '⑩ A は「収入の構成」が先で既定');
  ok(a12.includes('data-ch="a-comp"') && !a12.includes('class="an-cb"') && a12.includes(T.aMoved), '⑩ 期間に3か月以上：月ごとの積み上げ（2本の横の棒ではない）と「動いた区分」');
  ok(has(drawn('a-comp'), ['2031-01', '2031-06', '2031-12']), '⑩ 1年：積み上げは12か月ぶん');
  A.set({ per: '3m' });
  const in3 = ['2031-10', '2031-11', '2031-12'], out3 = ['2031-01', '2031-05', '2031-09'];
  const ac = drawn('a-comp'), be = drawn('b-eff');
  ok(has(ac, in3) && hasNone(ac, out3) && (ac.match(/class="an-hit"/g) || []).length === 3, '⑩ 3か月：A の積み上げは期間の中の3か月だけ');
  ok(/class="an-stk c-fixed"/.test(ac) && ac.includes(T.aTot), '⑩ 積み上げは区分の色と、小窓に合計');
  ok(has(be, in3) && hasNone(be, out3), '⑩ 3か月：B の棒は期間の中の月だけ');
  A.set({ C: { item: 'flight pay', other: false, busy: false, msg: null, edit: false } });
  const ca = drawn('c-amt');
  ok(has(ca, in3) && hasNone(ca, out3), '⑩ 3か月：C の推移は期間の中の月だけ');
  A.set({ per: '1y', sel: { a: '2031-03', b: '2031-05' } });
  A.build();
  ok(S.sel.b === '2031-12' && S.sel.a === '2031-11', '⑩ 前に持っていた月を持ち越さない（いつも最新とその前）：' + S.sel.a + ' → ' + S.sel.b);

  /* ③ 増減の「残り」の呼び名 */
  const BAD = /単価|料率|契約|rate|tarifa|tasa|precio|unit price/i;
  ok(!BAD.test(T.cResid) && !BAD.test(T.cDecNote) && !BAD.test(T.cQtyEff), '③ 残りの差を単価の変更と呼ばない：' + T.cResid);
  A.set({ C: { item: 'flight pay', other: false, busy: false, msg: null, edit: false } });
  const cHtml = A.cardC();
  ok(cHtml.includes(T.cResid) && cHtml.includes(T.cQtyEff), '③ 手当の掘り下げに、数量の差による分と残りの差が出ている');
  ok(!BAD.test(cHtml.replace(/<[^>]+>/g, ' ')), '③ 手当の掘り下げのカードに単価・料率の言葉が無い');

  /* ⑤ 候補は印だけ。描いても保存しない */
  ok(cHtml.includes(escH(A.fill(T.wq, { item: 'Flight Pay' }))) && cHtml.includes('is-cand'),
     '⑤⑫ 勤務月が分からない手当に「（手当の名前）は、いつの勤務の分？」と、ロスターからの候補の印');
  ok(rpc === 0, '⑤ 描いただけではサーバへ1本も送らない（保存は押したときだけ）：' + rpc + '本');

  /* ⑦ 週末の手当は数量を決めない＝日数で割らない */
  A.set({ C: { item: 'weekend duty', other: false, busy: false, msg: null, edit: false } });
  const wk = A.cardC();
  ok(wk.includes('Weekend Duty') && !wk.includes(T.cRef) && !wk.includes(T.cQtyEff), '⑦ 週末の手当は参考値（額 ÷ 数量）も分け方も出さない');

  /* ④ 計算候補：答え（勤務月）を入れると候補が出る。確度の％は無い */
  const maps = [{ airline: 'pv', airline_other: null, label_key: 'flight pay', offset: -1, status: 'confirmed', qty_kind: null }];
  A.set({ items: { items: F.items, maps, ok: true }, D: { item: 'flight pay', kind: 'monthly', qty: 'block', thr: {}, grid: {} } });
  A.build();
  const dHtml = A.cardD();
  ok(dHtml.includes(escH(T.dT)) && /推定|estimated|estimada/.test(T.dT) && dHtml.includes(T.dFitErr.split('{n}')[0]) && dHtml.includes(T.dVal),
     '④ 計算ルールは題名で「（推定）」と言う・当てはめた月と検証の月を分けて出す');
  ok(!/%/.test(dHtml) && !/確度|信頼度|confidence|confianza|probab/i.test(dHtml), '④ 計算候補に％・確度を出さない');
  const rg = A.rangeD();
  ok(rg && rg.min < rg.max && rg.min !== 360 && rg.max !== 720, '④ 基準の時間の範囲はデータから（見本の 6:00〜12:00 ではない）');

  /* ⑧ CSV：選んでいる期間（3か月 ＝ 2031-10 → 2031-12）だけ */
  const cells = (rows) => rows.reduce((a, r) => a.concat(r || []), []).map(String);
  A.set({ per: '3m', C: { item: 'flight pay', other: false, busy: false, msg: null, edit: false } });
  const cv = A.csvOf();
  ok(cv && cv.name === 'pilot-value-analysis_2031-10_2031-12', '⑧ ファイル名に範囲：' + (cv && cv.name));
  ok(cv && cv.rows[0].join(' ').includes('2031-10→2031-12'), '⑧ 1行目に範囲');
  const all8 = cv ? cells(cv.rows) : [];
  const firsts = cv ? cv.rows.map((r) => String((r || [])[0] || '')).filter((c) => /^\d{4}-\d{2}$/.test(c)) : [];
  ok(['2031-10', '2031-11', '2031-12'].every((m) => all8.includes(m)) && firsts.length && firsts.every((c) => c >= '2031-10' && c <= '2031-12'),
     '⑧ 期間の月の行だけを書く（行の月がほかに1つも無い。勤務月の欄は、その行の対応として出す）');
  const hdr = cv ? cv.rows.find((r) => r && r[0] === 'pay_month') : null, r10 = cv ? cv.rows.find((r) => r && r[0] === '2031-10' && r[1] === 'JPY') : null;
  ok(hdr && hdr[1] === 'currency' && r10 && r10[1] === 'JPY', '⑧ 通貨の欄（明細の通貨のまま）');
  ok(r10 && /^\d+:\d{2}$/.test(r10[hdr.indexOf('block_hm')]) && r10[hdr.indexOf('block_min')] === 69 * 60, '⑧ 時間は H:MM と分の両方');
  ok(cv && cv.rows.some((r) => r && r[0] === '2031-11' && r[1] === 'Flight Pay'), '⑧ 手当ごとの掘り下げで選んでいる項目の行');
  const dm = cv ? cv.rows.filter((r) => r && /^2031-1[01]$/.test(r[0]) && r.length === 14) : [];
  ok(dm.length === 2, '⑧ 期間の中のロスターの月（勤務月）だけ：' + dm.length);
  A.set({ per: '1y' });
  ok((A.csvOf() || {}).name === 'pilot-value-analysis_2031-01_2031-12', '⑧ 1年：ファイル名は期間の中の最初の明細から');
  /* ロスターが期間の外（2031-06）だけ：3か月なら節を書かない・1年なら書く */
  A.set({ roster: { days: days('2031-06', 140, 30), profile: PROFILE }, per: '3m' });
  A.build();
  ok(!(A.csvOf() || { rows: [] }).rows.some((r) => r && r[0] === 'duty_month'), '⑧ 期間にロスターの月が無ければロスターの節を書かない');
  A.set({ per: '1y' });
  ok((A.csvOf() || { rows: [] }).rows.some((r) => r && r[0] === 'duty_month'), '⑧ 期間を広げればロスターの節が出る');

  /* ⑦ 1か月 */
  A.set({ ctx: { reports: [F.reps[11]], segName: SEG }, items: { items: [F.items[11]], maps: [], ok: true }, roster: null, sel: { a: null, b: null } });
  A.build();
  const h1 = A.headHTML(), a1 = A.cardA();
  ok(h1.includes(T.one) && !a1.includes(T.one) && !A.cardC().includes(T.one), '⑦ 1か月：「2か月目から」は見出しで1回だけ');
  ok(!a1.includes('data-act="a-view"') && a1.includes('an-cb'), '⑦ 1か月：収入の構成だけ（増減率の切り替えを出さない）');
  ok(A.cardD().includes('data-act="add-roster"'), '④ ロスターが無ければ「ロスターを足す」の入口');

  /* ⑩ 明細の月の並びごとの期間 */
  const use = (ms) => {
    A.set({ ctx: { reports: ms.map((m) => m.r), segName: SEG }, items: { items: ms.map((m) => m.items), maps: [], ok: true }, roster: null,
            sel: { a: null, b: null }, per: '1y', A: { view: 'comp' }, C: { item: 'flight pay', other: false, busy: false, msg: null, edit: false } });
    A.build();
  };
  const mk = (yms, o) => yms.map((ym, i) => month(ym, (60 + i) * 4000, 18000, 60 + i, o ? o(ym) : null));
  use(mk(['2031-10', '2031-11', '2031-12']));
  ok(!A.headHTML().includes('data-act="per"'), '⑩ 明細が3か月なら期間を出さない');
  use(mk(['2030-01', '2031-10', '2031-11', '2031-12']));
  const h4 = A.headHTML();
  ok(pers(h4).join() === '3m,all' && pressed(h4, 'per') === '3m',
     '⑩ 4か月（1年より前に1つ）：3か月｜全部だけ・既定の1年は同じ中身の3か月が押されて見える：' + pers(h4).join() + ' / ' + pressed(h4, 'per'));
  /* 月が飛ぶ（11月 → 2月）。1年より前にも1つ */
  use(mk(['2029-05', '2030-08', '2030-09', '2030-10', '2030-11', '2031-02']));
  ok(S.sel.b === '2031-02' && S.sel.a === '2030-11', '⑩ 月が飛んでも、いちばん新しい明細とその前の明細を比べる：' + S.sel.a + ' → ' + S.sel.b);
  const hg = A.headHTML();
  const from11 = escH(A.fill(T.from, { a: A.ymS('2030-11') }));
  ok(A.cardB().includes('<span class="an-cap">' + from11 + '</span>') && A.cardC().includes(from11 + '</span>'),
     '⑩⑫ 月が飛んでも、比べた前の月は実際の月の名前（B・C の大きい数字の横に「11月から」）');
  ok(pers(hg).join() === '3m,6m,1y,all', '⑩ 中身が違う候補はすべて出す：' + pers(hg).join());
  A.set({ per: '3m' });
  const ag = A.cardA();
  ok((ag.match(/class="an-cb"/g) || []).length === 2 && !ag.includes('data-ch="a-comp"') && ag.includes(A.fill(T.payOf, { t: A.ymS('2030-11') })),
     '⑩ 期間に明細が2か月まで：今までの2本（前の明細は実際の月の名前）');
  ok(/class="an-big">[+−±][\d.]+%/.test(A.cardB()), '⑩ B の見出しの％は期間に関係なく b と a');
  ok(A.cardC().includes(T.cResid), '⑩ C の分け方は期間に関係なく b と a');
  A.set({ per: '6m' });
  const g6 = drawn('a-comp');
  ok(A.cardA().includes('data-ch="a-comp"') && has(g6, ['2030-09', '2031-02']) && hasNone(g6, ['2030-08', '2029-05']), '⑩ 6か月：積み上げは期間の中の4か月');
  A.set({ per: '1y' });
  const cg = cells((A.csvOf() || { rows: [] }).rows);
  ok(!cg.includes('2029-05') && cg.includes('2030-08'), '⑩ 1年：期間の外の月は CSV に書かない');
  A.set({ per: 'all' });
  ok(cells((A.csvOf() || { rows: [] }).rows).includes('2029-05'), '⑩ 全部：いちばん古い明細まで');
  /* 期間の中に別の通貨の月（1〜3月がドル） */
  use(mk(['2031-01', '2031-02', '2031-03', '2031-04', '2031-05', '2031-06', '2031-07', '2031-08', '2031-09', '2031-10', '2031-11', '2031-12'],
         (ym) => (ym <= '2031-03' ? { currency: 'USD', fx_to_jpy: 150 } : null)));
  const ax = A.cardA(), gx = drawn('a-comp');
  ok(ax.includes(A.fill(T.aCurEx, { n: 3 })) && has(gx, ['2031-04', '2031-12']) && hasNone(gx, ['2031-01', '2031-03']), '⑩ 別の通貨の月は積まずに1行で言う');

  /* ⑪ B の数量の基準：既定は「勤務1時間 → 乗務1時間 → 1勤務日 → 1便」で数がある最初のもの。数が無い基準は空の図を描かず1行だけ */
  const yms4 = ['2031-09', '2031-10', '2031-11', '2031-12'];
  const B0 = { num: 'gross', den: 'duty', denSet: false, basis: 'payslip', view: 'eff', work: null, bin: null };
  const noDenLine = '<p class="an-muted">' + String(T.bNoDen || '').replace(/'/g, '&#39;') + '</p>';
  const yLabs = (svg) => [...svg.matchAll(/text-anchor="end">([^<]*)</g)].map((m) => m[1]);
  use(mk(yms4, () => ({ duty_hours: null })));
  A.set({ B: Object.assign({}, B0) });
  const bd = A.cardB(), bdSvg = drawn('b-eff'), bdLabs = yLabs(bdSvg);
  ok(S.B.den === 'block' && bd.includes('data-ch="b-eff"') && !bd.includes(noDenLine), '⑪ 明細に勤務時間が無ければ、既定は乗務1時間：' + S.B.den);
  ok(bdLabs.length >= 2 && new Set(bdLabs).size === bdLabs.length, '⑪ 目盛の字はどれも違う：' + bdLabs.join(' '));
  A.set({ B: Object.assign({}, B0, { den: 'duty', denSet: true }) });
  const bx = A.cardB();
  ok(S.B.den === 'duty' && bx.includes(noDenLine) && !bx.includes('data-ch="b-eff"') && !bx.includes('data-act="b-view"') && !bx.includes('class="an-big"'),
     '⑪ 本人が選んだ基準は替えない・数が無ければ1行だけ（空の図・見方の切り替え・「—」の見出しを出さない）');
  ok(yLabs(drawn('b-eff')).length === 0, '⑪ 数が1つも無い図に目盛の字を描かない（¥1・¥1・¥0 にしない）');
  const tiny = [1.4, 3, 0.6].map((v) => A.yTicks(0, v).ticks.map(A.fmtAxis));
  ok(tiny.every((l) => l.length >= 2 && new Set(l).size === l.length), '⑪ 小さい額でも同じ字の目盛を2本描かない：' + tiny.map((l) => l.join('/')).join(' '));
  use(mk(yms4, () => ({ duty_hours: null, block_hours: null, duty_days: null, sectors: null })));
  A.set({ B: Object.assign({}, B0) });
  const b0 = A.cardB();
  ok(S.B.den === 'duty' && b0.includes(noDenLine) && !b0.includes('data-ch="b-eff"'), '⑪ どの基準にも数が無ければ1行だけ（既定は勤務1時間のまま）');

  /* ⑫ B の題名は、選んでいる数量の基準に合わせて変わる（勤務1時間／乗務1時間／1勤務日／1便） */
  use(mk(yms4));
  const titles = [['duty', 'bTDuty'], ['block', 'bTBlock'], ['dutyDays', 'bTDays'], ['sectors', 'bTSectors']].map(([d, k]) => {
    A.set({ B: Object.assign({}, B0, { den: d, denSet: true }) });
    const h = A.cardB(), m = h.match(/id="an-b-t">([^<]*)<\/h3>/);
    ok(m && m[1] === escH(T[k]), '⑫ B の題名が数量の基準（' + d + '）に合う：' + (m && m[1]));
    return m && m[1];
  });
  ok(new Set(titles).size === 4, '⑫ 4つの基準で B の題名がどれも違う：' + titles.join(' / '));
  return fails;
}

/* ⑥ 給与が変わった理由の判定（my-value.js の whyModel をそのまま） */
function whySuite(mvSrc, R) {
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  const src = cut(mvSrc, 'whyModel');
  if (!src) return ['my-value.js に whyModel が無い'];
  const whyModel = vm.runInNewContext('(' + src + ')', {});
  const two = (a, b, items) => whyModel(R, [a.r, b.r], items ? [a.items, b.items] : [], [], b.r);
  const a = month('2031-01', 240000, 18000, 60), b = month('2031-02', 280000, 27000, 70);
  const W = two(a, b, true);
  ok(W && W.s.waterfall.ok === true, '⑥ 検算が通る2か月は描く');
  if (W) {
    const wf = W.s.waterfall, sum = wf.items.reduce((s, x) => s + x.delta, 0);
    ok(sum === wf.deltaGross && wf.deltaGross === 49000, '⑥ 項目の増減の合計 ＝ Δ総支給（' + sum + ' / ' + wf.deltaGross + '）');
    ok(wf.items.some((x) => x.label === 'Flight Pay') && wf.items.some((x) => x.label === 'Weekend Duty'), '⑥ 明細の項目名で分ける');
  }
  ok(whyModel(R, [b.r], [], [], b.r) === null, '⑥ 1か月なら描かない（前回との差の側へ）');
  /* 通貨が違う前の月しかない */
  const c = month('2031-01', 240000, 18000, 60, { currency: 'USD', fx_to_jpy: 150 });
  ok(two(c, b, false) === null, '⑥ 前の明細が別の通貨なら描かない');
  /* 内訳の合計が総支給を超える月（2か月とも同じだけ超える＝増減の合計はたまたま合う） */
  const o1 = month('2031-01', 240000, 18000, 60), o2 = month('2031-02', 280000, 27000, 70);
  [o1, o2].forEach((x) => { x.r.base_pay += 30000; });
  ok(two(o1, o2, false) === null, '⑥ 内訳の合計 ≠ 総支給の月があれば描かない（増減の合計が偶然合っても）');
  /* 総支給の欄と「手取り＋控除」が食い違う月（内訳は総支給の欄に合う）＝ 増減の合計 ≠ Δ総支給 */
  const g1 = month('2031-01', 240000, 18000, 60), g2 = month('2031-02', 280000, 27000, 70);
  g2.r.net_pay_actual -= 10000;
  ok(two(g1, g2, false) === null, '⑥ 増減の合計 ≠ Δ総支給なら描かない');
  return fails;
}

let pass = 0, fail = 0;
const say = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };
const run = (ana, lang) => { try { const x = load(ana, lang); return suite(x.A, x.R, { lang }); } catch (e) { return ['読み込めない: ' + e.message]; } };

console.log('▼ 分析のタブ（my-analysis.js）');
for (const lang of ['ja', 'en', 'es']) {
  const f = run(ANA, lang);
  say(f.length === 0, lang + '：約束②〜⑤⑦⑧⑩⑪がすべて守られている' + (f.length ? '：' + f.join(' / ') : ''));
}
console.log('▼ 給与が変わった理由（my-value.js の whyModel）');
{
  const { R } = load(ANA);
  const f = whySuite(MV, R);
  say(f.length === 0, '約束⑥がすべて守られている' + (f.length ? '：' + f.join(' / ') : ''));
  say(/var wy = why\(rows, m\);/.test(MV) && /function why\(rows, m\)[\s\S]*?return \{ card: compare\(rows, m\), table: '' \};/.test(MV),
    '⑥ 描けないときは今までの compare（前回の明細との差）を出す');
}

/* ⑧ 字の包み方（my-value.js の csvText をそのまま） */
function csvSuite(mvSrc) {
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  const src = cut(mvSrc, 'csvText');
  if (!src) return ['my-value.js に csvText が無い'];
  const csvText = vm.runInNewContext('(' + src + ')', {});
  const t = csvText([['範囲', '支給月 2031-03→2031-05'], ['a,b', 'say "hi"', '=SUM(A1)', '-12.50', -3, null, '+81 x']]);
  ok(t.charCodeAt(0) === 0xFEFF, '⑧ 先頭に BOM（Excel で文字化けしない）');
  ok(t.includes('\r\n') && t.endsWith('\r\n'), '⑧ 行の区切りは CRLF');
  ok(t.includes('"a,b"') && t.includes('"say ""hi"""'), '⑧ カンマ・引用符を包む');
  ok(t.includes("'=SUM(A1)") && t.includes("'+81 x") && t.includes(',-12.50,') && t.includes(',-3,'), '⑧ 式に読める字は前に引用符（数は触らない）');
  return fails;
}

console.log('▼ ⑧ CSV の字の包み方（my-value.js の csvText）');
{
  const f = csvSuite(MV);
  say(f.length === 0, '約束⑧（BOM・CRLF・包み方）が守られている' + (f.length ? '：' + f.join(' / ') : ''));
}

console.log('▼ ⑨ 印刷（表示中のタブだけ）');
const CSS = read('my-value.css');
function printSuite(mv, css) {
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  const pp = cut(mv, 'printPane') || '';
  ok(/var src = panes && panes\[state\.tab\];/.test(pp) && /src\.cloneNode\(true\)/.test(pp), '⑨ 写すのは表示中のタブの面だけ');
  ok(/c\.querySelectorAll\(PR_DROP\)/.test(pp) && /\.an-tools/.test(mv) && /\.rs-hd-r/.test(mv), '⑨ 操作の部品（CSV・印刷・切り替え）は写しから外す');
  ok(/pv-printing/.test(pp) && /afterprint/.test(pp), '⑨ 1年の PDF と同じ仕組み（.pv-printing・印刷が終われば写しを消す）');
  const pr = (css.match(/@media print\{[\s\S]*?\n\}/g) || []).join('\n');
  ok(/#pv-value \.mv-tabs,#pv-value \.mv-pane\[hidden\]/.test(pr), '⑨ ブラウザの印刷でも、隠れたタブとタブの帯は紙に出さない');
  ok(/html\.pv-printing body > \*:not\(#pv-print\)\{display:none !important\}/.test(pr), '⑨ 写しのほか（サイトの枠・ほかの節）は紙に出さない');
  return fails;
}
{
  const f = printSuite(MV, CSS);
  say(f.length === 0, '約束⑨が守られている' + (f.length ? '：' + f.join(' / ') : ''));
  say(/data-act="print"/.test(ANA) && /S\.ctx\.print\(/.test(ANA) && /csv: saveCsv, print: printPane/.test(MV), '⑨ 分析のタブの印刷・CSV は my-value.js の1か所を呼ぶ');
}

console.log('▼ ① 後から読む部品');
{
  for (const [name, file] of [['ANALYSIS_V', 'my-analysis.js'], ['ANALYSIS_CSS_V', 'my-analysis.css']]) {
    const want = createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex').slice(0, 8);
    const m = MV.match(new RegExp('var ' + name + " = '([0-9a-f]{8})';"));
    say(m && m[1] === want, name + '（' + file + '）の指紋が中身と一致' + (m && m[1] !== want ? '：' + m[1] + ' → ' + want + ' に直す' : ''));
  }
  say(/analysis: 'my-analysis\.js\?v=' \+ ANALYSIS_V/.test(MV) && /analysisCss: 'my-analysis\.css\?v=' \+ ANALYSIS_CSS_V/.test(MV), '読む住所は指紋つき');
  const oa = cut(MV, 'openAnalysis') || '';
  const iCss = oa.indexOf('lateCss(LATE.analysisCss)'), iEng = oa.indexOf('lateJs(LATE.engine'), iAna = oa.indexOf('lateJs(LATE.analysis,');
  say(iCss >= 0 && iEng >= 0 && iAna > iCss && iAna > iEng, '見た目と計算の部品が届いてから画面の部品を読む');
  say(/if \(k === 'analysis'\) openAnalysis\(\);/.test(MV), '分析のタブを開いたときだけ読む');
  for (const p of ['profile.html', 'en/profile.html', 'es/profile.html']) {
    if (!fs.existsSync(path.join(ROOT, p))) continue;
    say(!/my-analysis\.(js|css)/.test(read(p)), p + ' は分析の部品を直に読まない（開いた人だけ）');
  }
}

console.log('▼ ② コードに年月・見本の閾値を書いていない');
{
  const code = ANA.replace(/\/\*PV-MSG:[a-z-]+\*\/[\s\S]*?\/\*\/PV-MSG:[a-z-]+\*\//g, '')
    .replace(/var T = \{[\s\S]*?\n  \};\n/, '')                       // 辞書（月の名前）は除く
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  say(!/20\d\d[-年/]|'\d{1,2}月'|\b(540|510|360|720)\b/.test(code), '年月の決め打ち・見本の閾値（9:00 など）が無い');
  say(!/confidence|確度|信頼度|confianza/i.test(ANA.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')), '確度という言葉をコードにも辞書にも持たない（注記の「作らない」は除く）');
}

/* ▼ 壊す証明：守りの1行を外すと、上の検査が赤くなること */
console.log('▼ 壊す証明');
const BREAK_A = [
  ['③ 残りの差を「単価の変化分」と呼ぶ', "cResid: '残りの差',", "cResid: '単価の変化分',"],
  ['④ 計算候補に確度の％を出す', "esc(fill(T.dFitErr, { n: ev.fitMonths.length }))", "'確度 90% ' + esc(fill(T.dFitErr, { n: ev.fitMonths.length }))"],
  ['⑤ 候補を描いた時点で保存する', "var c = q.cand ? q.cand.offset : null;", "var c = q.cand ? q.cand.offset : null; if (c != null) saveAsk(String(c));"],
  ['② 最新の月を決め打ちする', "S.sel.b = ms[ms.length - 1].ym;", "S.sel.b = '2026-10';"],
  ['⑦ 1か月でも増減率の切り替えを出す', "if (two()) h += seg('a-view'", "h += seg('a-view'"],
  ['⑧ CSV に範囲の外の月も書く', "var list = months().filter(function (m) { return m.ym >= r.a && m.ym <= r.b; });", "var list = months();"],
  ['⑩ A の既定を増減率に戻す', "A: { view: 'comp' },", "A: { view: 'change' },"],
  ['⑩ 比べる明細を前の選び方に戻す（持っていた月を残す）', "    S.sel.a = prevSame(S.sel.b);\n  }",
   "    if (monthAt(S.sel.a) && S.sel.a < S.sel.b) return;\n    S.sel.a = prevSame(S.sel.b);\n  }"],
  ['⑩ 中身が同じ期間の候補も出す', "if (c > last) { out.push", "if (c >= last) { out.push"],
  ['⑩ B の棒を期間で絞らない', "from: perFrom(), to: S.sel.b }).points;", "}).points;"],
  ['⑩ C の推移を期間で絞らない', "cc.series.filter(function (s) { return inPer(s.ym); }).map(", "cc.series.map("],
  ['⑩ 別の通貨の月も積む', "if (m.currency !== b.currency) { out.excluded++; return; }", ""],
  ['⑪ 既定の数量の基準を勤務1時間に決め打ち', "    if (S.B.denSet) return;\n    var d", "    return;\n    var d"],
  ['⑪ 数の無い基準でも空の図を描く', "var noDen = eff && S.B.basis === 'payslip' && !denHas(S.B.den);", "var noDen = false;"],
  ['⑪ 数が無い図にも目盛を描く', "if (!(hi > lo)) return { top: lo + 1, bot: lo, ticks: [] };", "if (!(hi > lo)) hi = lo + 1;"],
  ['⑪ 同じ字の目盛を描く', "if (ticks.length > 1 && labs.every(function (x, i) { return labs.indexOf(x) === i; }))", "if (ticks.length > 1)"],
  ['⑫ B の題名を数量の基準に合わせない', "cardOpen('b', T[BTITLE[S.B.den]] || T.bTDuty)", "cardOpen('b', T.bTDuty)"],
  ['⑫ 問いに手当の名前を入れない', "esc(fill(T.wq, { item: nm }))", "esc(fill(T.wq, { item: '' }))"],
  ['⑫ カードの右上に札を戻す', "'<div class=\"an-card-h\"><h3 class=\"an-card-t\" id=\"an-' + id + '-t\">' + esc(title) + '</h3></div>'",
   "'<div class=\"an-card-h\"><h3 class=\"an-card-t\" id=\"an-' + id + '-t\">' + esc(title) + '</h3><span class=\"an-badge\">x</span></div>'"],
  ['⑫ 見出しに比べている月を戻す', "return '<div class=\"an-hd\">' + per + tools + '</div>' +",
   "return '<div class=\"an-hd\"><p class=\"an-sub\">' + esc(ymL(S.sel.b)) + '</p>' + per + tools + '</div>' +"],
  ['⑧ ファイル名に範囲を入れない', "return { name: 'pilot-value-analysis_' + (r.a === r.b ? r.b : r.a + '_' + r.b), rows: rows };", "return { name: 'pilot-value-analysis', rows: rows };"]
];
for (const [name, from, to] of BREAK_A) {
  if (ANA.split(from).length !== 2) { say(false, `${name}：差し替える1行が my-analysis.js に1回だけ無い（検査が古い）`); continue; }
  const f = run(ANA.replace(from, () => to), 'ja');
  say(f.length > 0, `${name} → 赤くなる（${f.length}件）`);
}
const BREAK_W = [
  ['⑥ 内訳の合計 ＝ 総支給 を見ない', 'if (!good(s.a) || !good(s.b)) return null;', ''],
  ['⑥ 増減の合計 ＝ Δ総支給 を見ない', "|| wf.ok !== true) return null;", ') return null;']
];
for (const [name, from, to, which] of [
  ['⑧ BOM を付けない', "return '\\uFEFF' + rows.map(", "return '' + rows.map(", 'csv'],
  ['⑧ 式に読める字をそのまま書く', `if (/^[=+\\-@\\t\\r]/.test(t) && !/^[+\\-]?\\d+(\\.\\d+)?$/.test(t)) t = "'" + t;`, '', 'csv'],
  ['⑨ 印刷で全部のタブを写す', 'var src = panes && panes[state.tab];', 'var src = host;', 'print'],
  ['⑨ 隠れたタブを紙に出す（CSS）', '#pv-value .mv-tabs,#pv-value .mv-pane[hidden],#pv-value .mv-vrow{display:none !important}', '#pv-value .mv-vrow{display:none !important}', 'css']
]) {
  const src = which === 'css' ? CSS : MV;
  if (src.split(from).length !== 2) { say(false, `${name}：差し替える1行が1回だけ無い（検査が古い）`); continue; }
  const broken = src.replace(from, () => to);
  let f;
  try { f = which === 'csv' ? csvSuite(broken) : which === 'print' ? printSuite(broken, CSS) : printSuite(MV, broken); } catch (e) { f = ['読み込めない: ' + e.message]; }
  say(f.length > 0, `${name} → 赤くなる（${f.length}件）`);
}
for (const [name, from, to] of BREAK_W) {
  if (MV.split(from).length !== 2) { say(false, `${name}：差し替える1行が my-value.js に1回だけ無い（検査が古い）`); continue; }
  let f;
  try { f = whySuite(MV.replace(from, () => to), load(ANA).R); } catch (e) { f = ['読み込めない: ' + e.message]; }
  say(f.length > 0, `${name} → 赤くなる（${f.length}件）`);
}

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
