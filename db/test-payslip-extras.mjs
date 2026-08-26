/* ════════════════════════════════════════════════════════════════
   明細から読めているのに送っていなかった7列＋出所が、
   ①壊さずに ②落とさずに ③危ない値は送らずに 保存されることを測る。

   なぜこのテストが要るか:

   ① db/pay-reports.sql は net_pay_actual / ytd_taxable / flight_variable_pay /
      deduction_total / duty_hours / night_hours / credit_hours を最初から持ち、
      submit_pay_report も受け取れた。しかしフォームの payload に無く、
      **一度も保存されていなかった**。明細画像は保存しない設計なので、
      送らなかったぶんは後から復元できない。落ちていたら気づけない類の欠損。

   ② ★flight_variable_pay を「その他手当から移す」と年収が丸ごと下がる。
      pay-tracker の donut は flight_variable_pay を other_allowance の
      部分集合として扱い、pv_annual_total() は other_allowance しか足さない。
      しかも annualTotal()（ライブ計算）と pv_annual_total()（サーバ）が
      対称に下がるので、**test-form-contract.mjs では検出できない**。
      だから「二重書きであること」をここで見張る。

   ③ 列の CHECK に触れる値を送ると insert ごと失敗する＝誤読1つで明細1枚を失う。
      "999H00" のような読み違いが素通りしないことを確かめる。

   ④ PRESET_IDS（端末プリセット）に混ぜると、先月の年初来累計が翌月のフォームに
      載り、手入力を永久に source:'payslip' と申告し続ける。混ざっていないこと。

   ここで使う数字はすべて作り話。実物の明細の数字はこのリポジトリに1つも無い。

   実行: node db/test-payslip-extras.mjs
   ════════════════════════════════════════════════════════════════ */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };
const eq = (got, want, m) =>
  ok(got === want, `${m}  → ${JSON.stringify(got)}${got === want ? '' : `  （期待 ${JSON.stringify(want)}）`}`);

const PAYSLIP = read('payslip.js');
const JA = read('pay-report.html');
const EN = read('en/pay-report.html');

/* 隠しフィールド id → payload キー。この対応が唯一の正。 */
const MAP = {
  'f-netpay':   'net_pay_actual',
  'f-ytd':      'ytd_taxable',
  'f-flightvar': 'flight_variable_pay',
  'f-deduct':   'deduction_total',
  'f-duty-h':   'duty_hours',
  'f-night-h':  'night_hours',
  'f-credit-h': 'credit_hours',
  'f-source':   'source',
};

/* ══ ① ページ側の契約 ═══════════════════════════════════════ */
console.log('\n① 隠しフィールドと payload（JA / EN の両方）');
/* ★2026-08-13 に、この2つは隠し欄から普通の欄へ出た（手取りは必須・勤務時間は任意）。
   payload・ALL_IDS・PRESET_IDS の扱いは今までどおりなので、下の検査からは外さない。
   外すのは「隠し欄であること」だけ。
   ★2026-08-13（その2）に、金額の欄は桁区切りを出すため type="text" になった
   （type="number" にはカンマを表示できない。ブラウザが値ごと捨てる）。
   時間の欄は上限の検査を残したいので number のまま。だから見る型が2つある。 */
const NOW_VISIBLE = { 'f-netpay': 'text', 'f-duty-h': 'number' };

for (const [name, s] of [['pay-report.html', JA], ['en/pay-report.html', EN]]) {
  for (const id of Object.keys(MAP)) {
    if (NOW_VISIBLE[id]) {
      ok(new RegExp(`<input type="${NOW_VISIBLE[id]}" id="${id}"`).test(s),
         `${name}: ${id} は表の欄になっている（隠し欄ではない）`);
      continue;
    }
    ok(s.includes(`<input type="hidden" id="${id}">`), `${name}: 隠し欄 ${id} がある`);
  }
  /* ★2026-08-26、flight_variable_pay だけ val() 1つではなくなった。明細から読めた分
     （隠し欄 f-flightvar）に加えて、本人が手で足した「変動給」の行の合計（f-var-sum）も
     足す。だから見るのは書き方ではなく **その隠し欄が payload のそのキーに繋がっているか**。 */
  for (const [id, key] of Object.entries(MAP)) {
    const line = (s.match(new RegExp(`\\n\\s*${key}:[^\\n]*`)) || [''])[0];
    ok(/(val|sumField)\(/.test(line) && line.includes(`'${id}'`),
       `${name}: payload に ${key} がある（隠し欄 ${id} から来ている）`);
  }

  // ★ ALL_IDS には入れる（未ログイン→ログイン後の再送で落ちないため）
  const all = s.match(/const ALL_IDS = PRESET_IDS\.concat\(\[[\s\S]*?\]\);/);
  ok(!!all, `${name}: ALL_IDS を読めた`);
  for (const id of Object.keys(MAP)) ok(all && all[0].includes(`'${id}'`), `${name}: ALL_IDS に ${id} がある`);

  // ★ PRESET_IDS には入れない（翌月のフォームに持ち越すと静かに壊れる）
  const preset = s.match(/const PRESET_IDS = \[[\s\S]*?\];/);
  ok(!!preset, `${name}: PRESET_IDS を読めた`);
  for (const id of Object.keys(MAP)) {
    ok(preset && !preset[0].includes(`'${id}'`), `${name}: ★PRESET_IDS に ${id} が混ざっていない`);
  }

  // ★ 乗務日数(duty_days)の f-duty と、勤務時間の f-duty-h は別物
  ok(/duty_days:\s+val\('f-duty'\)/.test(s), `${name}: duty_days は f-duty のまま（乗務日数）`);
  ok(/duty_hours:\s+val\('f-duty-h'\)/.test(s), `${name}: duty_hours は f-duty-h（勤務時間）`);

  // ★ source はクライアント申告。何かの権限をこれで分岐させていない
  ok(/source は「出所ラベル」/.test(s) || /VERIFIED-PILOT 3-2 A-1/.test(s),
     `${name}: source を権限判定に使わない理由が書いてある`);
}

/* ══ ② flight_variable は「移さない・二重に書く」 ═══════════ */
console.log('\n② flight_variable を その他手当 から抜いていない（年収が下がる事故）');
const kindField = PAYSLIP.match(/var KIND_FIELD = \{[\s\S]*?\};/);
ok(!!kindField, 'KIND_FIELD を読めた');
ok(kindField && /flight_variable:\s*'f-other'/.test(kindField[0]),
   "★KIND_FIELD.flight_variable は 'f-other' のまま（＝年収に入り続ける）");
ok(kindField && !/'f-flightvar'/.test(kindField[0]),
   '★KIND_FIELD に f-flightvar を生やしていない（生やすと f-other から移動して年収が下がる）');
ok(/writeHidden\('f-flightvar'/.test(PAYSLIP), 'flight_variable_pay は隠し欄へ別途書いている（二重書き）');
ok(/表で金額を直したら専用列も追随/.test(PAYSLIP) || /pushTrace[\s\S]{0,400}f-flightvar/.test(PAYSLIP),
   '表で直したときも f-flightvar が追随する');

/* ══ ③ 出荷されるコードをそのまま走らせる ═════════════════════
   writeHidden〜writeExtras を payslip.js から切り出して、偽の document で実行する。
   （書き写しではなく、本当に出荷される文字列を動かす） */
console.log('\n③ writeExtras を実際に走らせる（範囲ガード）');
const s0 = PAYSLIP.indexOf('  function writeHidden(id, v) {');
const s1 = PAYSLIP.indexOf('  /* 表で直した金額を反映');
ok(s0 > 0 && s1 > s0, 'writeHidden〜writeExtras を切り出せた');
const BLOCK = PAYSLIP.slice(s0, s1);

/* ★setField は切り出す範囲の外にある（本体は classList / dispatchEvent を使うので
   偽の document では動かない）。ここでは同じ形の受け皿を差し込み、
   「どの欄が setField を通ったか」を記録する。
   2026-08-13 に手取りと勤務時間が表の欄へ出たので、この2つは writeHidden ではなく
   setField を通らないといけない（通らないと値は入るのに段階表示が進まない）。 */
const build = new Function('document', 'lastHours', 'setField',
  BLOCK + '\nreturn { writeExtras: writeExtras, okAmount: okAmount, okHours: okHours, sumKind: sumKind };');

const fakeDoc = (ids) => {
  const els = {};
  (ids || Object.keys(MAP)).forEach((i) => { els[i] = { value: '' }; });
  return { getElementById: (i) => els[i] || null, els };
};
const mkSetField = (doc, seen) => (id, v) => {
  const e = doc.getElementById(id);
  if (!e) return false;
  e.value = String(v);
  seen.push(id);
  return true;
};

// ── 正常系 ──
{
  const doc = fakeDoc();
  const seen = [];
  const api = build(doc, { block: 86.5, duty: 171.2, night: 12.5, credit: 90 }, mkSetField(doc, seen));
  api.writeExtras(
    { net_pay: 812345.6, ytd_taxable: 5400000, deductions_total: 233654 },
    [{ field: 'f-other', amount: 120000, kind: 'flight_variable' },
     { field: 'f-other', amount:  30000, kind: 'flight_variable' },
     { field: 'f-other', amount:   5000, kind: 'other' },
     { field: 'f-base',  amount: 480000, kind: 'base' }]
  );
  const v = (id) => doc.els[id].value;
  eq(v('f-netpay'), '812346', 'net_pay が四捨五入で入る');
  eq(v('f-ytd'), '5400000', 'ytd_taxable が入る');
  eq(v('f-deduct'), '233654', 'deductions_total が入る');
  eq(v('f-duty-h'), '171.2', 'duty hours が入る');
  eq(v('f-night-h'), '12.5', 'night hours が入る');
  eq(v('f-credit-h'), '90', 'credit hours が入る');
  eq(v('f-source'), 'payslip', "source は 'payslip'");
  eq(v('f-flightvar'), '150000', '★flight_variable だけを kind で合計（その他 5,000 は混ぜない）');
  ok(seen.includes('f-netpay') && seen.includes('f-duty-h'),
     '★手取りと勤務時間は setField で入れる（表に出た欄なので印と再計算が要る）',
     seen.join(','));
  ok(!seen.includes('f-ytd') && !seen.includes('f-deduct') && !seen.includes('f-flightvar'),
     '画面に出ていない欄は writeHidden のまま（1枚で7回描き直さない）', seen.join(','));
}

// ── 範囲外・欠損 ──
{
  const doc = fakeDoc();
  const seen = [];
  const api = build(doc, { block: 80, duty: 999, night: 0, credit: -3 }, mkSetField(doc, seen));
  api.writeExtras({ net_pay: -1, ytd_taxable: null, deductions_total: undefined }, []);
  const v = (id) => doc.els[id].value;
  ok(seen.length === 0, '読めなかった欄は setField を呼ばない（空で上書きするだけ）', seen.join(','));
  eq(v('f-duty-h'), '', '★999h は送らない（CHECK 0..400 に触れると送信ごと失敗する）');
  eq(v('f-night-h'), '', '0h は「読めなかった」として送らない');
  eq(v('f-credit-h'), '', 'マイナスの時間は送らない');
  eq(v('f-netpay'), '', '★マイナスの支給額は送らない（CHECK >= 0）');
  eq(v('f-ytd'), '', 'null はそのまま空（列は NULL になる）');
  eq(v('f-deduct'), '', 'undefined はそのまま空');
  eq(v('f-flightvar'), '', 'flight_variable の行が無ければ空（0 を捏造しない）');
}

// ── 境界 ──
{
  const api = build(fakeDoc(), {}, () => false);
  eq(api.okHours(400), 400, '400h ちょうどは通す');
  eq(api.okHours(400.1), null, '400.1h は落とす');
  eq(api.okAmount(0), 0, '0 は有効な値として通す（無給の月は実在する）');
  eq(api.okAmount(NaN), null, 'NaN は落とす');
  eq(api.okAmount(Infinity), null, 'Infinity は落とす');
  eq(api.sumKind([{ kind: 'flight_variable', amount: 0 }], 'flight_variable'), 0,
     '合計0でも「行はあった」なら 0 を返す（null と区別する）');
}

// ── 隠し欄が無い古いHTMLでも落ちない ──
{
  const doc = { getElementById: () => null };
  const api = build(doc, { duty: 100 }, () => false);
  let threw = false;
  try { api.writeExtras({ net_pay: 1 }, []); } catch (e) { threw = true; }
  ok(!threw, '隠し欄が無いページでも例外を投げない');
}

/* ══ ④ 文言 ═══════════════════════════════════════════════ */
console.log('\n④ 「保存していません」が嘘になっていない');
ok(!/控除合計・差引支給額・総勤務時間は、いまは<b>画面に出すだけ<\/b>で保存していません/.test(PAYSLIP),
   '★旧文言「保存していません」が残っていない（保存するようになったので嘘になる）');
ok(/一緒に保存します/.test(PAYSLIP), 'JA: 保存することを言っている');
ok(/stored with this report/.test(PAYSLIP), 'EN: 保存することを言っている');
ok(/控除の<b>内訳<\/b>は保存しません/.test(PAYSLIP), 'JA: 控除の内訳は保存しないと言っている');
ok(/breakdown<\/b> of deductions is never stored/.test(PAYSLIP), 'EN: 控除の内訳は保存しないと言っている');

/* ══ ⑤ PGlite 往復 ═══════════════════════════════════════ */
console.log('\n⑤ 本物の submit_pay_report / my_pay_reports に通す');
const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  grant usage on schema public, extensions to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  create table public.profiles (
    id uuid primary key, email text, name text,
    email_opt_in boolean not null default false
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;
`);
for (const f of ['db/airlines.generated.sql', 'db/vocab.generated.sql', 'db/pay-reports.sql']) {
  await db.exec(read(f));
}
const UID = '00000000-0000-4000-8000-0000000000e1';
await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`, [UID, 'extras@example.com']);
await db.query(`select set_config('pv.uid', $1, false)`, [UID]);

const payload = {
  airline: 'emirates', position: 'cap', fleet: 'b777', job_role: 'line',
  base_iata: 'DXB', period_year: 2026, period_month: 6, currency: 'AED',
  base_pay: 48500, block_hours: 86.5, per_diem: 6200,
  housing_type: 'allowance', housing_amount: 17500,
  command_pay: 3200, transport: 1500, other_allowance: 4100,
  bonus_annual: 52000, profit_share_annual: 18000,
  // ★今回から送る側
  net_pay_actual: 61200, ytd_taxable: 402000, flight_variable_pay: 3200,
  deduction_total: 9800, duty_hours: 171.2, night_hours: 12.5, credit_hours: 90,
  source: 'payslip', lang: 'ja',
};
const res = (await db.query(`select public.submit_pay_report($1::jsonb) as r`, [JSON.stringify(payload)])).rows[0].r;
ok(res && res.ok, 'RPC が ok を返す');

const row = (await db.query(`
  select net_pay_actual, ytd_taxable, flight_variable_pay, deduction_total,
         duty_hours, night_hours, credit_hours, other_allowance, source, base_iata
    from public.pay_reports limit 1`)).rows[0];
eq(Number(row.net_pay_actual), 61200, 'net_pay_actual が保存された');
eq(Number(row.ytd_taxable), 402000, 'ytd_taxable が保存された');
eq(Number(row.flight_variable_pay), 3200, 'flight_variable_pay が保存された');
eq(Number(row.deduction_total), 9800, 'deduction_total が保存された');
eq(Number(row.duty_hours), 171.2, 'duty_hours が保存された');
eq(Number(row.night_hours), 12.5, 'night_hours が保存された');
eq(Number(row.credit_hours), 90, 'credit_hours が保存された');
eq(row.source, 'payslip', 'source が保存された');
ok(Number(row.other_allowance) === 4100,
   '★その他手当は flight_variable_pay を引かれていない（＝年収が下がらない）');

/* ★ source を申告しただけでは何の権限も動かない（VERIFIED-PILOT 3-2 A-1） */
const prof = (await db.query(`select verify_level, badge from public.profiles where id=$1`, [UID])).rows[0];
eq(Number(prof.verify_level || 0), 0, "★source:'payslip' を送っても verify_level は上がらない");

const mine = (await db.query(`select public.my_pay_reports() as r`)).rows[0].r;
const r0 = mine.reports[0];
eq(r0.base_iata, 'DXB', '★my_pay_reports が base_iata を返す（レポート概要の Base）');
eq(Number(r0.duty_hours), 171.2, 'my_pay_reports が duty_hours を返す');
eq(Number(r0.net_pay_actual), 61200, 'my_pay_reports が net_pay_actual を返す');
eq(Number(r0.ytd_taxable), 402000, 'my_pay_reports が ytd_taxable を返す');

/* Gross は列を足さずに出せる（VERIFIED-PILOT 3-4） */
eq(Number(r0.net_pay_actual) + Number(r0.deduction_total), 71000,
   'Gross = net_pay_actual + deduction_total で出せる（新しい列は要らない）');

console.log(`\n${'─'.repeat(46)}\n${pass} pass / ${fail} fail`);
if (fail) process.exitCode = 1;
