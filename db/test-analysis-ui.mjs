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
   ⑦ 1か月なら比較を出さず、「2か月目から」を見出しで1回だけ言う。週末・祝日の手当を日数で割らない。 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
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
  ok(/2031/.test(A.headHTML()) && !/20(2\d|30)/.test(all), '② 見出しはデータの年（2031）だけ・ほかの年を出さない');
  ok(A.headHTML().split('<option').length - 1 === 12 + 11, '② 選べる月はデータの月だけ（明細12・比べる相手11）');
  ok(!all.includes(T.one), '⑦ 2か月以上では「2か月目から」を言わない');

  /* ③ 増減の「残り」の呼び名 */
  const BAD = /単価|料率|契約|rate|tarifa|tasa|precio|unit price/i;
  ok(!BAD.test(T.cResid) && !BAD.test(T.cDecNote) && !BAD.test(T.cQtyEff), '③ 残りの差を単価の変更と呼ばない：' + T.cResid);
  A.set({ C: { item: 'flight pay', other: false, busy: false, msg: null, edit: false } });
  const cHtml = A.cardC();
  ok(cHtml.includes(T.cResid) && cHtml.includes(T.cQtyEff), '③ 手当の掘り下げに、数量の差による分と残りの差が出ている');
  ok(!BAD.test(cHtml.replace(/<[^>]+>/g, ' ')), '③ 手当の掘り下げのカードに単価・料率の言葉が無い');

  /* ⑤ 候補は印だけ。描いても保存しない */
  ok(cHtml.includes(T.wq) && cHtml.includes('is-cand'), '⑤ 勤務月が分からない手当に「いつの勤務の分？」と、ロスターからの候補の印');
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
  ok(dHtml.includes(T.dBadge) && dHtml.includes(T.dFitErr.split('{n}')[0]) && dHtml.includes(T.dVal), '④ 計算候補は「未確定の候補（探索）」・当てはめた月と検証の月を分けて出す');
  ok(!/%/.test(dHtml) && !/確度|信頼度|confidence|confianza|probab/i.test(dHtml), '④ 計算候補に％・確度を出さない');
  const rg = A.rangeD();
  ok(rg && rg.min < rg.max && rg.min !== 360 && rg.max !== 720, '④ 基準の時間の範囲はデータから（見本の 6:00〜12:00 ではない）');

  /* ⑦ 1か月 */
  A.set({ ctx: { reports: [F.reps[11]], segName: SEG }, items: { items: [F.items[11]], maps: [], ok: true }, roster: null, sel: { a: null, b: null } });
  A.build();
  const h1 = A.headHTML(), a1 = A.cardA();
  ok(h1.includes(T.one) && !a1.includes(T.one) && !A.cardC().includes(T.one), '⑦ 1か月：「2か月目から」は見出しで1回だけ');
  ok(!a1.includes('data-act="a-view"') && a1.includes('an-cb'), '⑦ 1か月：収入の構成だけ（増減率の切り替えを出さない）');
  ok(A.cardD().includes('data-act="add-roster"'), '④ ロスターが無ければ「ロスターを足す」の入口');
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
  say(f.length === 0, lang + '：約束②〜⑤⑦がすべて守られている' + (f.length ? '：' + f.join(' / ') : ''));
}
console.log('▼ 給与が変わった理由（my-value.js の whyModel）');
{
  const { R } = load(ANA);
  const f = whySuite(MV, R);
  say(f.length === 0, '約束⑥がすべて守られている' + (f.length ? '：' + f.join(' / ') : ''));
  say(/var wy = why\(rows, m\);/.test(MV) && /function why\(rows, m\)[\s\S]*?return \{ card: compare\(rows, m\), table: '' \};/.test(MV),
    '⑥ 描けないときは今までの compare（前回の明細との差）を出す');
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
  ['⑦ 1か月でも増減率の切り替えを出す', "if (two()) h += seg('a-view'", "h += seg('a-view'"]
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
for (const [name, from, to] of BREAK_W) {
  if (MV.split(from).length !== 2) { say(false, `${name}：差し替える1行が my-value.js に1回だけ無い（検査が古い）`); continue; }
  let f;
  try { f = whySuite(MV.replace(from, () => to), load(ANA).R); } catch (e) { f = ['読み込めない: ' + e.message]; }
  say(f.length > 0, `${name} → 赤くなる（${f.length}件）`);
}

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
