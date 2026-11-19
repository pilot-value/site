/* db/payslip-verify.sql と submit_pay_report の「明細の Verified」を本物の Postgres（PGlite）で確かめる。

   実行: node db/test-payslip-verify.mjs   ネットワーク不要・本番に一切触らない。

   ★見ている約束（2026-11-19 オーナー決定）
     Verified ＝「その月の総支給が、本人が出した明細の印字と一致した」行だけ。
     ① parse-payslip が出した一度きりの引換券が、年・月・通貨・総支給と1文字も違わないときだけ付く
     ② 読んだあとで総支給（月・通貨）を書き換えたら付かない／同じ券で2回目は付かない／7日で切れる
     ③ 同じ明細（指紋）で、ほかの人が先に付いていたら付かない。本人が同じ月を出し直すのは付く
     ④ 券なしの出し直しは、総支給と通貨が前のままなら前の印を残す（年数だけ直した人から外さない）
     ⑤ 運営が外した行は、何を出し直しても戻らない
     ⑥ source = 'payslip' では付かない（ブラウザが書ける字）
     ⑦ 券の表に人は入らない・会員は券を作れない／読めない
     ⑧ 照合の関数がまだ無い DB でも、提出は今どおり通る（印が付かないだけ）
   ★壊す証明：照合から総支給の1行を外すと、② が落ちることを見せる。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label} ${extra}`); }
};
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const boom = async (sql, params) => {
  try { await db.query(sql, params); return null; } catch (e) { return String(e.message || e); }
};

// ── 器（Supabase と同じく3つの役が居て、既定で何でも呼べる状態から始める）──
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon; create role authenticated; create role service_role;
  grant usage on schema public, extensions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

  create table public.profiles (
    id uuid primary key, email text, name text,
    email_opt_in boolean not null default false
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;
`);

const BASE_FILES = ['db/airlines.generated.sql', 'db/vocab.generated.sql',
                    'db/pay-reports.sql', 'db/pay-report-pending.sql'];
console.log('\n▼ 土台の適用');
for (const f of BASE_FILES) {
  try { await db.exec(read(f)); ok(true, f); }
  catch (e) { ok(false, f, e.message); process.exit(1); }
}

// ── 道具 ─────────────────────────────────────────────────────
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const asUser = async (n) => {
  await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`,
    [uid(n), `p${n}@example.com`]);
  await db.query(`select set_config('pv.uid', $1, false)`, [uid(n)]);
};
const submit = (payload) => one(`select submit_pay_report($1::jsonb) r`, [JSON.stringify(payload)]);
/* parse-payslip が service_role で呼ぶのと同じ関数で券を作る。 */
const ticket = async (y, m, cur, gross, net = gross * 0.8, deduct = gross * 0.2, ytd = null) =>
  (await one(`select public.pv_payslip_ticket_put($1,$2,$3,$4,$5,$6,$7) t`,
    [y, m, cur, gross, net, deduct, ytd])).t;
/* その人のその月の行の印。proof_hash はサーバと同じ式で作る（一覧から選んだ会社）。 */
const vf = (n, air, y, m) => one(
  `select verify_level, verify_method, verify_fp, gross_monthly from public.pay_reports
    where proof_hash = encode(extensions.digest($1 || '::pv_pay::' || $2, 'sha256'), 'hex')
      and period_year = $3 and period_month = $4`, [uid(n), air, y, m]);

const P = {
  airline: 'jal', position: 'cap', fleet: 'b787', currency: 'JPY',
  base_iata: 'HND', seniority_years: 15, rank_years: 6, tax_rate_pct: 20, lang: 'ja',
  age_bucket: '40-49', source: 'payslip',
};

// ════════════════════════════════════════════════════════════
console.log('\n▼ ⑧ 照合の関数がまだ無い DB（pay-reports.sql だけ貼った状態）');
// ════════════════════════════════════════════════════════════
await asUser(1);
{
  const r = (await submit({ ...P, period_year: 2026, period_month: 1, gross_monthly: 1500000,
                            payslip_ticket: 'a'.repeat(48) })).r;
  const row = await vf(1, 'jal', 2026, 1);
  ok(r.ok === true && row && row.verify_level === 0,
     '券を付けて出しても提出は通る・印は付かない（関数が無ければ呼ばない）', JSON.stringify(row));
}

console.log('\n▼ db/payslip-verify.sql の適用');
try { await db.exec(read('db/payslip-verify.sql')); ok(true, 'db/payslip-verify.sql'); }
catch (e) { ok(false, 'db/payslip-verify.sql', e.message); process.exit(1); }
try { await db.exec(read('db/payslip-verify.sql')); ok(true, '再適用OK（冪等）'); }
catch (e) { ok(false, '再適用で失敗', e.message); }
{
  const res = await db.query(read('db/payslip-verify.sql').slice(read('db/payslip-verify.sql').lastIndexOf('select n, what')));
  const rows = res.rows;
  ok(rows.length === 5 && rows.every((x) => x.result === '✅'),
     `末尾の検算5行が全部 ✅`, JSON.stringify(rows.filter((x) => x.result !== '✅')));
}
/* 先に pay-reports.sql を貼っていない DB では、何が足りないかを言って止まる。 */
{
  const t = new PGlite({ extensions: { pgcrypto } });
  await t.waitReady;
  await t.exec(`create table public.pay_reports (id uuid primary key);`);
  let msg = null;
  try { await t.exec(read('db/payslip-verify.sql')); } catch (e) { msg = String(e.message || e); }
  ok(msg !== null && /pay-reports\.sql/.test(msg), '土台が古いまま流すと、何が足りないかを言って止まる', msg ?? '(止まらなかった)');
  await t.close();
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ ① 券が合えば付く');
// ════════════════════════════════════════════════════════════
await asUser(2);
const T2 = await ticket(2026, 2, 'JPY', 1500000);
ok(/^[0-9a-f]{48}$/.test(T2 || ''), `券は48文字の16進（${String(T2).length}）`);
ok(Number((await one(`select count(*) n from public.pv_payslip_tickets where token_sha = $1`, [T2])).n) === 0,
   '★表には券そのものを置かない（sha256 だけ）');
await submit({ ...P, period_year: 2026, period_month: 2, gross_monthly: 1500000, payslip_ticket: T2 });
{
  const row = await vf(2, 'jal', 2026, 2);
  ok(row.verify_level === 1 && row.verify_method === 'payslip' && /^[0-9a-f]{64}$/.test(row.verify_fp || ''),
     '年・月・通貨・総支給が券と同じ → verify_level = 1・method = payslip・指紋が入る', JSON.stringify(row));
}
ok(Number((await one(`select count(*) n from public.pv_payslip_tickets`)).n) === 0, '使った券はその場で消える');
{
  /* 一覧（REAL PAY）が読む列そのもの。pay-rows.sql の vf = verify_level >= 1 */
  const n = Number((await one(`select count(*) n from public.pay_reports where verify_level >= 1`)).n);
  ok(n === 1, `印が付いた行は1行だけ（${n}）`);
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ ② 書き換えたら付かない・券は一度きり・7日で切れる');
// ════════════════════════════════════════════════════════════
const MISS = [
  ['総支給を書き換えた', 3, { gross_monthly: 1600000 }, ['JPY', 1500000]],
  ['月を書き換えた',     4, {},                         ['JPY', 1500000, 5]],
  ['通貨が違う',         6, { currency: 'USD', gross_monthly: 15000 }, ['JPY', 15000]],
];
let who = 10;
for (const [label, m, over, [cur, g, mt]] of MISS) {
  await asUser(++who);
  const t = await ticket(2026, mt || m, cur, g);
  await submit({ ...P, period_year: 2026, period_month: m, gross_monthly: g, ...over, payslip_ticket: t });
  const row = await vf(who, 'jal', 2026, m);
  ok(row && row.verify_level === 0 && row.verify_fp === null, `${label} → 付かない`, JSON.stringify(row));
  ok(Number((await one(`select count(*) n from public.pv_payslip_tickets`)).n) === 0, `  （${label}でも券は使い切る）`);
}
{
  await asUser(++who);
  const t = await ticket(2026, 7, 'JPY', 1400000);
  await submit({ ...P, period_year: 2026, period_month: 7, gross_monthly: 1400000, payslip_ticket: t });
  await asUser(++who);
  await submit({ ...P, period_year: 2026, period_month: 7, gross_monthly: 1400000, payslip_ticket: t });
  const row = await vf(who, 'jal', 2026, 7);
  ok(row.verify_level === 0, '同じ券を別の人が使っても付かない（一度きり）', JSON.stringify(row));
}
{
  await asUser(++who);
  const t = await ticket(2026, 8, 'JPY', 1300000);
  await db.query(`update public.pv_payslip_tickets set created_at = now() - interval '8 days'`);
  await submit({ ...P, period_year: 2026, period_month: 8, gross_monthly: 1300000, payslip_ticket: t });
  ok((await vf(who, 'jal', 2026, 8)).verify_level === 0, '8日前の券は切れている');
}
for (const junk of ['', 'x', "'; drop table pay_reports; --", 'A'.repeat(48), 'f'.repeat(64)]) {
  await asUser(++who);
  const r = (await submit({ ...P, period_year: 2026, period_month: 9, gross_monthly: 1200000, payslip_ticket: junk })).r;
  ok(r.ok === true && (await vf(who, 'jal', 2026, 9)).verify_level === 0,
     `でたらめな券（${JSON.stringify(junk).slice(0, 20)}）でも提出は通り、付かない`);
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ ③ 同じ明細で2人目には付かない／本人の出し直しは付く');
// ════════════════════════════════════════════════════════════
{
  await asUser(30);
  await submit({ ...P, period_year: 2026, period_month: 3, gross_monthly: 1777777,
                 payslip_ticket: await ticket(2026, 3, 'JPY', 1777777, 1300000, 477777, 9000000) });
  ok((await vf(30, 'jal', 2026, 3)).verify_level === 1, '1人目は付く');
  await asUser(31);
  await submit({ ...P, period_year: 2026, period_month: 3, gross_monthly: 1777777,
                 payslip_ticket: await ticket(2026, 3, 'JPY', 1777777, 1300000, 477777, 9000000) });
  const r31 = await vf(31, 'jal', 2026, 3);
  ok(r31.verify_level === 0 && r31.verify_fp === null, '★同じ明細（指紋が同じ）で2人目には付かない', JSON.stringify(r31));
  await asUser(32);
  await submit({ ...P, period_year: 2026, period_month: 3, gross_monthly: 1777777,
                 payslip_ticket: await ticket(2026, 3, 'JPY', 1777777, 1310000, 467777, 8800000) });
  ok((await vf(32, 'jal', 2026, 3)).verify_level === 1, '総支給が同じでも手取り・控除が違う明細なら付く（同じ給与表の別の人）');
  await asUser(30);
  await submit({ ...P, period_year: 2026, period_month: 3, gross_monthly: 1777777, seniority_years: 16,
                 payslip_ticket: await ticket(2026, 3, 'JPY', 1777777, 1300000, 477777, 9000000) });
  ok((await vf(30, 'jal', 2026, 3)).verify_level === 1, '本人が同じ明細でその月を出し直すのは付く（自分の行は数えない）');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ ④ 券なしの出し直し');
// ════════════════════════════════════════════════════════════
{
  await asUser(2);
  await submit({ ...P, period_year: 2026, period_month: 2, gross_monthly: 1500000, rank_years: 7 });
  ok((await vf(2, 'jal', 2026, 2)).verify_level === 1, '総支給と通貨が前のまま（年数だけ直した）→ 印は残る');
  await submit({ ...P, period_year: 2026, period_month: 2, gross_monthly: 1900000 });
  const r = await vf(2, 'jal', 2026, 2);
  ok(r.verify_level === 0 && r.verify_method === null && r.verify_fp === null, '総支給を書き換えた → 外れる', JSON.stringify(r));
  await submit({ ...P, period_year: 2026, period_month: 2, gross_monthly: 1500000 });
  ok((await vf(2, 'jal', 2026, 2)).verify_level === 0, '元の額に戻しても、券なしでは戻らない');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ ⑤ 運営が外す');
// ════════════════════════════════════════════════════════════
{
  await asUser(32);
  const id = (await one(`select id from public.pay_reports where verify_level = 1 and gross_monthly = 1777777
                           and proof_hash = encode(extensions.digest($1 || '::pv_pay::jal', 'sha256'), 'hex')`, [uid(32)])).id;
  ok((await one(`select public.pv_payslip_unverify($1) n`, [id])).n === 1, '外すと1行が変わる');
  const r = await vf(32, 'jal', 2026, 3);
  ok(r.verify_level === 0 && r.verify_method === 'revoked', '外した行は verify_level = 0・method = revoked', JSON.stringify(r));
  await submit({ ...P, period_year: 2026, period_month: 3, gross_monthly: 1777777,
                 payslip_ticket: await ticket(2026, 3, 'JPY', 1777777, 1310000, 467777, 8800000) });
  const r2 = await vf(32, 'jal', 2026, 3);
  ok(r2.verify_level === 0 && r2.verify_method === 'revoked', '★新しい券で出し直しても戻らない', JSON.stringify(r2));
  ok((await one(`select public.pv_payslip_unverify($1) n`, [id])).n === 0, '2回外しても何も変わらない');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ ⑥ source = payslip だけでは付かない');
// ════════════════════════════════════════════════════════════
{
  await asUser(40);
  await submit({ ...P, source: 'payslip', period_year: 2026, period_month: 5, gross_monthly: 1450000 });
  ok((await vf(40, 'jal', 2026, 5)).verify_level === 0, 'source = payslip と書いただけ → 付かない');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 預けて（ログインなし）→ 引き取る');
// ════════════════════════════════════════════════════════════
{
  const t = await ticket(2026, 6, 'JPY', 1450000);
  await db.query(`select set_config('pv.uid', '', false)`);
  await db.exec(`set role anon`);
  const held = (await one(`select submit_pay_report_pending($1::jsonb) r`,
    [JSON.stringify({ ...P, period_year: 2026, period_month: 6, gross_monthly: 1450000, payslip_ticket: t })])).r;
  await db.exec(`reset role`);
  ok(held.ok === true, '券を付けたまま預けられる');
  ok(Number((await one(`select count(*) n from public.pv_payslip_tickets`)).n) === 1, '預けただけでは券は使わない');
  await asUser(41);
  const c = (await one(`select claim_pending_report($1) r`, [held.claim_token])).r;
  ok(c.ok === true && (await vf(41, 'jal', 2026, 6)).verify_level === 1, '★引き取ったら印が付く（券は預かりの中身ごと届く）');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ ⑦ 人は入らない・会員は触れない');
// ════════════════════════════════════════════════════════════
{
  const cols = (await db.query(`select column_name c from information_schema.columns
                                 where table_schema='public' and table_name='pv_payslip_tickets'`)).rows.map((x) => x.c);
  ok(!cols.some((c) => /uid|user|proof|report|email|ip_/.test(c)), `券の表の列：${cols.join(', ')}`);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    ok(/permission denied/i.test(await boom(`select count(*) from public.pv_payslip_tickets`) || ''), `${role} は券の表を読めない`);
    ok(/permission denied/i.test(await boom(`select public.pv_payslip_ticket_put(2026,1,'JPY',1,1,1,1)`) || ''), `${role} は券を作れない`);
    ok(/permission denied/i.test(await boom(`select public.pv_payslip_redeem('a',2026,1,'JPY',1)`) || ''), `${role} は照合を直に呼べない`);
    ok(/permission denied/i.test(await boom(`select public.pv_payslip_unverify(gen_random_uuid())`) || ''), `${role} は印を外せない`);
    await db.exec(`reset role`);
  }
  await db.exec(`set role service_role`);
  ok(await boom(`select public.pv_payslip_ticket_put(2026,1,'JPY',100000,80000,20000,null)`) === null,
     'service_role（parse-payslip）は券を作れる');
  await db.exec(`reset role`);
  await db.query(`delete from public.pv_payslip_tickets`);
  for (const [label, args] of [['月が13', [2026, 13, 'JPY', 1]], ['通貨が英字3文字でない', [2026, 1, 'JP1', 1]],
                               ['総支給が0', [2026, 1, 'JPY', 0]], ['年が古すぎる', [2001, 1, 'JPY', 1]]]) {
    const t = (await one(`select public.pv_payslip_ticket_put($1,$2,$3,$4,null,null,null) t`, args)).t;
    ok(t === null, `形がおかしければ券を作らない（${label}）`);
  }
  /* MY PAY が読む本人の明細に、指紋を載せない */
  const def = (await one(`select pg_get_functiondef('public.my_pay_reports()'::regprocedure) d`)).d;
  ok(!/verify_fp/.test(def), 'my_pay_reports は指紋を返さない');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 壊す証明：照合から総支給の1行を外すと、② が落ちる');
// ════════════════════════════════════════════════════════════
{
  const src = read('db/payslip-verify.sql');
  const broken = src.replace("\n     or v_t.gross is distinct from p_gross then", () => ' then');
  ok(broken !== src, '（照合の1行を外した版を作れた）');
  await db.exec(broken);
  await asUser(50);
  await submit({ ...P, period_year: 2026, period_month: 4, gross_monthly: 2500000,
                 payslip_ticket: await ticket(2026, 4, 'JPY', 1500000) });
  ok((await vf(50, 'jal', 2026, 4)).verify_level === 1,
     '★外すと「総支給を書き換えても付く」になる＝② はこの1行が守っている');
  await db.exec(src);
  await asUser(51);
  await submit({ ...P, period_year: 2026, period_month: 4, gross_monthly: 2500000,
                 payslip_ticket: await ticket(2026, 4, 'JPY', 1500000) });
  ok((await vf(51, 'jal', 2026, 4)).verify_level === 0, '戻すと付かない');
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
