/* 航空会社の一覧の「新しい投稿順」（db/airline-activity.sql）を、本物の Postgres（PGlite = PG17 の WASM ビルド）で確かめる。

   実行: node db/test-airline-activity.mjs   （check.mjs sql にも入っている）
   ネットワーク不要・本番に一切触らない。

   守っているもの（2026-11-04 オーナー決定「情報の更新順」→ 会員の給与・口コミが新しく入った順）:
     ★ 並びは新しい順 ── 給与・口コミ・引き取っていない口コミの預かりの3つをまたいで、会社ごとにいちばん新しい1つで並ぶ。
       新しい口コミは、古い給与しかない会社を追い越す。手で決めた並びとも、規則を JS へ写した port() とも同じ
     ★ 預かり ── 引き取っていない預かりは数える。引き取ったら預かりそのものはもう数えない
       （同じ会社の口コミがもうあった人＝預かりだけ閉じる、のときは元の並びへ戻る／普通に引き取ったら、口コミの行の時刻で数える）
     ★ 外す行 ── 年 $10,000〜$700,000 の外の給与・本人が下ろした人・テスト用アカウントの給与と口コミ・
       どの会社にも当たらない社名（'other'）・会社の表に無いコード・active でない会社
     ★ 引き金 ── 給与を出す・口コミを書く・預ける・引き取る・下ろす・名簿に足す・消すと、その場で並びが変わる（数え直しを手で呼ばない）。
       口コミの翻訳・本文・給与の検証の印など、並びに関係しない列の update では数え直さない
     ★ 順番だけを出す ── 未ログイン・ログイン済みは表を直接読めない・数え直しを呼べない。
       読む口が返すのは会社コード（文字列）の配列1つだけ（日付も件数も無い）
     ★ 数え直しの中で失敗が起きても、給与の書き込みは通る（表は前の中身のまま）
     ★ 冪等 ── ファイルをもう一度流しても中身は同じ・引き金は増えない・末尾の検算10行が全部 ✅
     ★ 壊す証明 ── テスト用アカウントを外す2行を抜いた版では、テスト用アカウントの検査が赤くなる。
       引き取っていない預かりだけに絞る1行を抜いた版では、引き取った預かりの検査が赤くなる

   器は db/test-member-median.mjs と同じ（anon / authenticated ロール、既定の権限を全部付けた状態、auth.uid() の代役、
   profiles、auth.users、reviews_v2）。流す SQL の並びは serve-local.mjs の SQL_FILES をそのまま読む（写さない）。
   給与は本物の submit_pay_report、預かりは本物の submit_review_pending / claim_review_pending を通す。

   ⚠️ set_config の第3引数は false（＝セッション全体）。
   ⚠️ ここに出てくる会員は全部作り物（crew1@example.com など）。数字も検査のための作り物。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import { createHash } from 'node:crypto';
import { SQL_FILES } from '../serve-local.mjs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const MINE = 'db/airline-activity.sql';

const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;
await db.exec(`set timezone = 'UTC'`);

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };
const must = (c, l, e = '') => { if (!c) ok(false, '（準備が崩れた）' + l, e); return !!c; };
const J = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x) : x));

// ── 器（db/test-member-median.mjs と同じ）──────────────────────
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  grant usage on schema public, extensions, auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;

  create table auth.users (
    id uuid primary key, email text, raw_user_meta_data jsonb,
    created_at timestamptz not null default now());
  create unique index auth_users_email on auth.users (lower(email));
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;

  create table public.profiles (
    id uuid primary key, email text, name text,
    email_opt_in boolean not null default false,
    gender text, birthdate date, country text, company text, "position" text,
    created_at timestamptz not null default now());

  create table public.reviews_v2 (
    id uuid primary key default gen_random_uuid(),
    proof_hash text not null, airline text not null, "position" text,
    tenure_bucket text, age_bucket text, fleet text, job_role text,
    monthly_salary integer, bonus integer, annual_salary integer, base_annual integer,
    flight_allowance_annual integer,
    culture_score integer, salary_score integer, benefits_score integer,
    wlb_score integer, ops_score integer, training_score integer, mgmt_score integer,
    culture_comment text, salary_comment text, benefits_comment text,
    wlb_comment text, ops_comment text, training_comment text, mgmt_comment text,
    orig_lang text, translations jsonb,
    created_at timestamptz not null default now());
  alter table public.reviews_v2 enable row level security;
  revoke all on public.reviews_v2 from anon;
  create policy reviews_v2_insert_member on public.reviews_v2
    for insert to authenticated with check (true);
`);

console.log('\n▼ SQL の適用（serve-local.mjs の SQL_FILES の順）');
must(SQL_FILES.includes(MINE), `serve-local.mjs の SQL_FILES に ${MINE} が無い`);
must(SQL_FILES.indexOf(MINE) > SQL_FILES.indexOf('db/member-median.sql')
  && SQL_FILES.indexOf(MINE) > SQL_FILES.indexOf('db/pay-rows.sql')
  && SQL_FILES.indexOf(MINE) > SQL_FILES.indexOf('db/reviews-gate.sql'),
  `${MINE} は db/pay-rows.sql・db/reviews-gate.sql・db/member-median.sql のあと`);
for (const f of SQL_FILES) {
  try { await db.exec(read(f)); ok(true, f); }
  catch (e) { ok(false, f, e.message); process.exit(1); }
}

// ── 道具 ─────────────────────────────────────────────────────
const ANON = Symbol('anon');
const as = async (who) => {
  await db.exec(who === ANON ? `set role anon` : `set role authenticated`);
  await db.query(`select set_config('pv.uid', $1, false)`, [typeof who === 'string' ? who : '']);
};
const asOwner = async () => { await db.exec(`reset role`); await db.query(`select set_config('pv.uid', '', false)`); };
const call = async (who, sql, params = []) => {
  await as(who);
  try { const r = await db.query(sql, params); return { rows: r.rows, fields: r.fields }; }
  catch (e) { return { err: String(e.message || e) }; }
  finally { await asOwner(); }
};
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let seat = 0;
const member = async () => {
  const id = uid(++seat), mail = `crew${seat}@example.com`;
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, mail]);
  await db.query(`insert into public.profiles (id, email) values ($1, $2) on conflict (id) do nothing`, [id, mail]);
  return id;
};

const NOW = await one(`select extract(year from current_date)::int as y, extract(month from current_date)::int as m`);
const ago = (k) => { const t = NOW.y * 12 + (NOW.m - 1) - k; return { year: Math.floor(t / 12), month: (t % 12) + 1 }; };

const sha = (s) => createHash('sha256').update(s).digest('hex');
/* 給与の行の鍵（本人 × 会社［× 打ち込んだ社名］）。式は db/pay-reports.sql の submit_pay_report の v_hash と同じ。 */
const payKey = (id, airline, other) => sha(`${id}::pv_pay::${airline}${other ? '::' + String(other).toLowerCase() : ''}`);
/* 口コミの鍵。式は db/reviews-gate.sql の pv_review_hash と同じ。 */
const reviewKey = (id, airline) => sha(`${id}::pv_anon::${airline}::2026`);

const BASE = { currency: 'USD', lang: 'en', tax_rate_pct: 0, fleet: 'a320', gross_monthly: 9000 };
/* 給与を1件出すだけ（本物の submit_pay_report をその会員として通す）。時刻は出した瞬間のまま。 */
const submit = async (who, airline, pos, { k = 1, other } = {}) => {
  const body = { ...BASE, airline, position: pos, period_year: ago(k).year, period_month: ago(k).month };
  if (other) body.airline_other = other;
  const r = await call(who, `select public.submit_pay_report($1::jsonb) as v`, [J(body)]);
  await db.exec(`update public.profiles set pay_reports_today = 0`);
  must(!r.err && r.rows[0].v && r.rows[0].v.access_until != null, `給与を出せなかった（${airline} / ${pos} / ${other || ''}）`, r.err || J(r.rows && r.rows[0]));
  return payKey(who, airline, other);
};
/* 給与を1件出して、年収と時刻だけを持ち主として書き換える（書き換えでも引き金は走る）。 */
const pay = async (who, airline, usd, { at = '10 days', other, k = 1 } = {}) => {
  const h = await submit(who, airline, 'cap', { k, other });
  const u = await db.query(`update public.pay_reports set annual_total_usd = $1, created_at = now() - $2::interval
                             where proof_hash = $3 and period_year = $4 and period_month = $5`,
    [usd, at, h, ago(k).year, ago(k).month]);
  must(u.affectedRows === 1, `給与の行を見つけられない（${airline}）`);
  return h;
};
/* 口コミを1件入れる（持ち主として）。社名の欄は打ち込まれた字のこともある。 */
const review = async (who, airline, at = '10 days') =>
  (await one(`insert into public.reviews_v2 (proof_hash, airline, "position", created_at)
              values ($1, $2, 'fo', now() - $3::interval) returning id`, [reviewKey(who, airline), airline, at])).id;
/* ログインせずに口コミを預ける（本物の submit_review_pending を未ログインとして通す）。at があれば時刻を持ち主として戻す。 */
const MARK = 'あ'.repeat(120);
const pending = async (airline, at = null) => {
  const p = {
    airline, position: 'fo', tenure_bucket: '5-10', age_bucket: '30-34', fleet: 'a320', job_role: 'line',
    culture_score: 4, salary_score: 3, benefits_score: 4, wlb_score: 3, ops_score: 4, training_score: 5,
    culture_comment: '社風の話。' + MARK, salary_comment: '給与の話。' + MARK, wlb_comment: '勤務の話。' + MARK, lang: 'ja',
  };
  const r = await call(ANON, `select public.submit_review_pending($1::jsonb) as v`, [J(p)]);
  must(!r.err && r.rows[0].v && r.rows[0].v.ok, `預けられなかった（${airline}）`, r.err || J(r.rows));
  const v = r.rows[0].v;
  if (at) await db.query(`update public.pv_review_pending set created_at = now() - $1::interval where id = $2`, [at, v.id]);
  return v;
};

/* 読む口（未ログインとして呼ぶ ＝ 一覧のページと同じ）。 */
const order = async (who = ANON) => {
  const r = await call(who, `select public.pv_airline_activity_order() as v`);
  if (r.err) return { err: r.err };
  return r.rows[0].v;
};
/* 表の中身（持ち主として）。時刻はマイクロ秒の整数の字で持つ（JS の Date はミリ秒で丸めるため）。 */
const table = async () => {
  await asOwner();
  return Object.fromEntries((await rows(`select airline, (extract(epoch from last_at) * 1000000)::bigint::text as t
                                           from public.pv_airline_activity order by airline`)).map((r) => [r.airline, r.t]));
};
const stamp = async () => { await asOwner(); return String((await one(`select max(updated_at) as t from public.pv_airline_activity`)).t); };

/* ── 決め方（db/airline-activity.sql の冒頭の「数え方」）を、そのまま JS に写したもの ──────────────────
   ⚠️ 数え方を直したら、ここも db/airline-activity.sql も一緒に直す。 */
const port = async () => {
  await asOwner();
  const T = `(extract(epoch from created_at) * 1000000)::bigint::text`;
  const pr = await rows(`select airline, airline_other, annual_total_usd, proof_hash, ${T} as t from public.pay_reports`);
  const rv = await rows(`select airline, proof_hash, ${T} as t from public.reviews_v2`);
  const pd = await rows(`select airline, claimed_at, ${T} as t from public.pv_review_pending`);
  const hidden = new Set((await rows(`select proof_hash from public.pay_hidden`)).map((r) => r.proof_hash));
  const testIds = (await rows(`select uid from public.pv_test_users`)).map((r) => r.uid);
  const live = new Set((await rows(`select code from public.pv_airlines where active and code <> 'other'`)).map((r) => r.code));
  const testPay = new Set(), testRv = new Set();
  for (const id of testIds) { for (const r of pr) testPay.add(payKey(id, r.airline, r.airline_other)); for (const r of rv) testRv.add(reviewKey(id, r.airline)); }
  const resolved = new Map();
  const resolve = async (x) => { const k = String(x); if (!resolved.has(k)) resolved.set(k, (await one(`select public.pv_airline_resolve($1) as c`, [k])).c); return resolved.get(k); };
  const last = new Map();
  const put = (code, t) => { if (code && live.has(code) && (!last.has(code) || BigInt(last.get(code)) < BigInt(t))) last.set(code, t); };
  for (const r of pr) {
    const usd = r.annual_total_usd == null ? null : Number(r.annual_total_usd);
    if (usd == null || usd < 10000 || usd > 700000 || hidden.has(r.proof_hash) || testPay.has(r.proof_hash)) continue;
    put(r.airline === 'other' ? (r.airline_other == null ? null : await resolve(r.airline_other)) : r.airline, r.t);
  }
  for (const r of rv) { if (!testRv.has(r.proof_hash)) put(await resolve(r.airline), r.t); }
  for (const r of pd) { if (r.claimed_at == null) put(await resolve(r.airline), r.t); }
  const byTime = [...last].sort((a, b) => (BigInt(b[1]) > BigInt(a[1]) ? 1 : BigInt(b[1]) < BigInt(a[1]) ? -1 : a[0] < b[0] ? -1 : 1));
  return { order: byTime.map((x) => x[0]), table: Object.fromEntries([...last].sort((a, b) => (a[0] < b[0] ? -1 : 1))) };
};
/* 読む口の並び ＝ 写しの並び、かつ 表の中身 ＝ 写しの中身（active でない会社は表から消えたあと）。 */
const samePort = async () => {
  const [o, t, p] = [await order(), await table(), await port()];
  return { same: J(o) === J(p.order) && J(t) === J(p.table), order: o, port: p.order };
};

// 会社コードは語彙から取る（このテストのために特定の社名を覚えない）
const AIR = await rows(`select code, name_en from public.pv_airlines where code <> 'other' and active and name_en is not null order by code limit 60`);
const [PAY1, REV, PEND, MOVE, BAND, EDGE, HIDE, TPAY, TREV, OFF, CLM] = AIR.slice(0, 11).map((r) => r.code);
// 自由入力の社名で出す会社: 英語名を大文字にして打ち込んでも、pv_airline_resolve がその会社に寄せるもの
let TYPEDA = null, TYPED = null;
for (const r of AIR.slice(11)) {
  const typed = String(r.name_en).toUpperCase();
  if ((await one(`select public.pv_airline_resolve($1) as c`, [typed])).c === r.code) { TYPEDA = r.code; TYPED = typed; break; }
}
const NOWHERE = 'Zzqx Imaginary Airways';
const NOCODE = 'zz-no-such-code';
must(CLM && TYPEDA && (await one(`select public.pv_airline_resolve($1) as c`, [NOWHERE])).c === 'other'
  && (await one(`select count(*)::int as c from public.pv_airlines where code = $1`, [NOCODE])).c === 0,
  '見本の会社コードを作れない', J({ CLM, TYPEDA, TYPED }));


// ════════════════════════════════════════════════════════════
console.log('\n▼ A1 見本を入れる（給与は本物の submit_pay_report・預かりは本物の submit_review_pending）');
// ════════════════════════════════════════════════════════════
ok(J(await order()) === '[]', '何も無いうちは空の配列（例外も出さない）', J(await order()));
const P1 = await member(); await pay(P1, PAY1, 120000, { at: '10 days' });
const R1 = await member(); await review(R1, REV, '5 days');
await pending(PEND, '1 day');                                                               // 引き取っていない預かり
const M1 = await member(); await pay(M1, MOVE, 150000, { at: '20 days' });                  // あとで新しい口コミが追い越す
const B1 = await member(), B2 = await member();
await pay(B1, BAND, 9999.99, { at: '2 days' }); await pay(B2, BAND, 700000.01, { at: '2 days' }); // 常識の幅の外
const E1 = await member(); await pay(E1, EDGE, 10000, { at: '30 days' });                   // 幅の端（ちょうど1万ドルは入る）
const H = await member(); const H_KEY = await pay(H, HIDE, 90000, { at: '4 days' });       // あとで下ろす
const TESTER = await member();
await pay(TESTER, TPAY, 200000, { at: '6 hours' });                                          // テスト用アカウント（給与）
await review(TESTER, TREV, '7 hours');                                                       // テスト用アカウント（口コミ）
const O1 = await member(); await pay(O1, OFF, 110000, { at: '8 days' });                     // あとで active でなくす
const F1 = await member(); await pay(F1, 'other', 130000, { at: '15 days', other: TYPED });  // 自由入力の社名 → 会社コード
const CL = await member(); await review(CL, CLM, '60 days');                                 // あとで同じ会社の預かりを引き取る人
const U = await member();
await pay(U, 'other', 140000, { at: '1 hour', other: NOWHERE });                             // どこにも当たらない社名（給与）
await review(U, NOWHERE, '1 hour');                                                          // どこにも当たらない社名（口コミ）
await review(U, NOCODE, '1 hour');                                                           // 会社の表に無いコード
ok(true, `見本: 会員 ${seat} 人・給与 ${(await one(`select count(*)::int as c from public.pay_reports`)).c} 件・口コミ ${(await one(`select count(*)::int as c from public.reviews_v2`)).c} 件・預かり ${(await one(`select count(*)::int as c from public.pv_review_pending`)).c} 件`);


// ════════════════════════════════════════════════════════════
console.log('\n▼ A2 並びは新しい順（3つの出どころをまたいで・数え直しを手で呼ばない）');
// ════════════════════════════════════════════════════════════
{
  const o = await order();
  const HAND = [TPAY, TREV, PEND, HIDE, REV, OFF, PAY1, TYPEDA, MOVE, EDGE, CLM];
  ok(J(o) === J(HAND), '★給与・口コミ・預かりの最新の時刻で、新しい順に並ぶ（名簿に足す前・下ろす前）', J({ o, HAND }));
  ok(o.indexOf(PEND) >= 0 && o.indexOf(PEND) < o.indexOf(REV), '★引き取っていない預かり（1日前）も数え、5日前の口コミより前に来る', J(o));
  ok(!o.includes(BAND), '年 $10,000〜$700,000 の外の給与（9,999.99・700,000.01）しか無い会社は入らない', J(o));
  ok(o.includes(EDGE), 'ちょうど1万ドルの給与は数える（幅の端は入る）', J(o));
  ok(o.includes(TYPEDA), '自由入力の社名（大文字で打っても）は会社コードに直って数えられる', J(o));
  ok(!o.includes('other') && !o.includes(NOCODE) && !o.includes(NOWHERE), 'どの会社にも当たらない社名・会社の表に無いコードは入らない（"other" も入らない）', J(o));
  ok((await samePort()).same, '（決め方の写し port と、並びも表の中身も同じ）', J(await samePort()));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ A3 外す行（名簿に足す・下ろす・active でなくす）は、その場で並びから消える');
// ════════════════════════════════════════════════════════════
{
  await db.query(`insert into public.pv_test_users (uid) values ($1)`, [TESTER]);
  const o1 = await order();
  ok(!o1.includes(TPAY) && !o1.includes(TREV) && o1[0] === PEND,
    '★テスト用アカウントを名簿に足した瞬間、その給与の会社も口コミの会社も並びから消える', J(o1));

  await db.query(`insert into public.pay_hidden (proof_hash, reason) values ($1, '検査')`, [H_KEY]);
  const o2 = await order();
  ok(!o2.includes(HIDE), '★本人が下ろした瞬間、その人の給与しか無い会社は並びから消える', J(o2));

  await db.query(`update public.pv_airlines set active = false where code = $1`, [OFF]);
  const o3 = await order();
  ok(!o3.includes(OFF) && J(o3) === J([PEND, REV, PAY1, TYPEDA, MOVE, EDGE, CLM]),
    '★active でなくした会社は、数え直しを待たずに読む口の並びから消える', J(o3));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ A4 新しい口コミ・預かり・引き取り・給与で、その場で並びが変わる');
// ════════════════════════════════════════════════════════════
{
  const R2 = await member();
  const mvId = await review(R2, MOVE, '3 days');
  const o1 = await order();
  ok(J(o1) === J([PEND, MOVE, REV, PAY1, TYPEDA, EDGE, CLM]),
    '★3日前の口コミで、20日前の給与しか無かった会社が5日前の口コミ・10日前の給与の会社を追い越す', J(o1));
  ok(!Object.keys(await table()).includes(OFF), '（次の書き込みで、active でない会社は表からも消える）', J(await table()));
  ok((await samePort()).same, '（写しと同じ）');

  // 未ログインの人が預けた瞬間（引き金は security definer ── 未ログインに数え直しの権限が無くても動く）
  const tk = await pending(CLM);
  const o2 = await order();
  ok(o2[0] === CLM, '★未ログインの人が口コミを預けた瞬間、60日前の口コミしか無かった会社が先頭に来る', J(o2));

  // 同じ会社の口コミがもうある人が引き取る ＝ 預かりだけ閉じる（口コミは増えない）
  const c1 = await call(CL, `select public.claim_review_pending($1) as v`, [tk.claim_token]);
  must(!c1.err && c1.rows[0].v.ok && c1.rows[0].v.dup, '同じ会社の口コミがある人の引き取りが dup にならない', c1.err || J(c1.rows));
  const o3 = await order();
  ok(J(o3) === J([PEND, MOVE, REV, PAY1, TYPEDA, EDGE, CLM]),
    '★引き取った預かりはもう数えない（口コミが増えなかったので、元の60日前の位置へ戻る）', J(o3));

  // 普通に引き取る ＝ 口コミの行（引き取った時刻）として1回だけ数える
  const before = await table();
  const [pk] = await rows(`select claim_token from public.pv_review_pending where airline = $1 and claimed_at is null`, [PEND]);
  const CN = await member();
  const c2 = await call(CN, `select public.claim_review_pending($1) as v`, [pk.claim_token]);
  must(!c2.err && c2.rows[0].v.ok && !c2.rows[0].v.dup, '普通の引き取りができない', c2.err || J(c2.rows));
  const got = (await one(`select (extract(epoch from created_at) * 1000000)::bigint::text as t from public.reviews_v2 where proof_hash = $1`,
    [reviewKey(CN, PEND)])).t;
  const after = await table();
  ok(after[PEND] === got && BigInt(after[PEND]) > BigInt(before[PEND]),
    '★普通に引き取ると、預かりの時刻ではなく口コミの行（引き取った時刻）で数える', J({ before: before[PEND], after: after[PEND], got }));
  ok((await samePort()).same, '（写しと同じ）');

  // 給与を1件出した瞬間（時刻は書き換えない＝ insert の引き金だけで変わる）
  const P9 = await member();
  await submit(P9, EDGE, 'fo');
  const o4 = await order();
  ok(o4[0] === EDGE, '★給与を1件出した瞬間、30日前の給与しか無かった会社が先頭に来る', J(o4));

  // 消すと戻る
  await db.query(`delete from public.reviews_v2 where id = $1`, [mvId]);
  const o5 = await order();
  ok(o5.indexOf(MOVE) > o5.indexOf(TYPEDA), '口コミを消すと、その会社は元の給与（20日前）の位置へ戻る', J(o5));
  ok((await samePort()).same, '（写しと同じ）');

  // 並びに関係しない列の書き換えでは数え直さない
  const t0 = await stamp();
  await db.query(`update public.reviews_v2 set translations = '{"en":{}}'::jsonb where airline = $1`, [REV]);
  await db.query(`update public.reviews_v2 set culture_comment = '直した本文' where airline = $1`, [REV]);
  await db.query(`update public.pay_reports set verify_level = 1 where airline = $1`, [PAY1]);
  await db.query(`update public.pv_review_pending set culture_comment = culture_comment || '。' where airline = $1`, [CLM]);
  const t1 = await stamp();
  ok(t0 === t1, '口コミの翻訳・本文、給与の検証の印、預かりの本文の書き換えでは数え直さない（並びに関わる列だけ）', J({ t0, t1 }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ A5 順番だけを出す（表は読めない・数え直しは呼べない・読む口は文字列の配列だけ）');
// ════════════════════════════════════════════════════════════
{
  const codes = new Set((await rows(`select code from public.pv_airlines where active and code <> 'other'`)).map((r) => r.code));
  const n = Object.keys(await table()).length;
  for (const [who, nm] of [[ANON, '未ログイン'], [await member(), 'ログイン済み']]) {
    const t1 = await call(who, `select * from public.pv_airline_activity`);
    ok(!!t1.err, `★${nm}は表を直接読めない（日付を外へ出さない）`, J(t1));
    const w = await call(who, `insert into public.pv_airline_activity (airline, last_at) values ($1, now())`, [PAY1]);
    ok(!!w.err, `${nm}は表に書けない（並びを勝手に動かさせない）`, J(w));
    const f = await call(who, `select public.pv_airline_activity_refresh()`);
    ok(!!f.err, `${nm}は数え直しを呼べない（外から何度も呼んで重くさせない）`, J(f));

    const r = await call(who, `select public.pv_airline_activity_order() as v`);
    const v = r.rows && r.rows[0].v;
    ok(!r.err && J(r.fields.map((x) => x.name)) === J(['v']) && Array.isArray(v),
      `★${nm}: 読む口は配列1つだけを返す`, J(r.err || r.fields));
    ok(Array.isArray(v) && v.length === n && v.every((x) => typeof x === 'string' && codes.has(x)) && new Set(v).size === v.length,
      `★${nm}: 中身は会社コードの文字列だけ（日付も件数も無い・同じ会社は1回）`, J(v));
  }
  const res = (await one(`select pg_get_function_result('public.pv_airline_activity_order()'::regprocedure) as s`)).s;
  ok(res === 'jsonb', '読む口の返す型は jsonb 1つ（表の形で日付の列を返さない）', res);
  const def = (await one(`select pg_get_functiondef('public.pv_airline_activity_order()'::regprocedure) as s`)).s;
  ok(!/pay_reports|reviews_v2|pv_review_pending|refresh|count\(/.test(def), '読む口は表を引くだけ（給与・口コミ・預かりの表を読まない・数えない＝開くたびに重くならない）');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ A6 数え直しの中で失敗が起きても、給与の書き込みは通る');
// ════════════════════════════════════════════════════════════
{
  const snap = J(await table());
  // 表に「どの時刻も入れられない」制約を一時だけ足す ＝ 数え直しの insert が必ず失敗する
  await db.exec(`alter table public.pv_airline_activity add constraint pv_aa_break check (last_at < '2000-01-01') not valid`);
  const Z = await member();
  const body = { ...BASE, airline: PAY1, position: 'cap', period_year: ago(1).year, period_month: ago(1).month };
  const r = await call(Z, `select public.submit_pay_report($1::jsonb) as v`, [J(body)]);
  await db.exec(`update public.profiles set pay_reports_today = 0`);
  const saved = (await one(`select count(*)::int as c from public.pay_reports where proof_hash = $1`, [payKey(Z, PAY1)])).c;
  ok(!r.err && r.rows[0].v.access_until != null && saved === 1, '★数え直しが失敗しても、給与は保存され鍵も開く', r.err || J(r.rows));
  ok(J(await table()) === snap, '表は前の中身のまま（失敗した数え直しの途中の削除も残らない）');
  await db.exec(`alter table public.pv_airline_activity drop constraint pv_aa_break`);
  await db.query(`update public.pay_reports set annual_total_usd = 130000 where proof_hash = $1`, [payKey(Z, PAY1)]);
  const o = await order();
  ok(o[0] === PAY1 && (await samePort()).same, '直したあとの次の書き込みで、取りこぼした1件も数えられる（その会社が先頭）', J(o));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ A7 冪等（db/airline-activity.sql をもう一度そのまま流す）');
// ════════════════════════════════════════════════════════════
{
  const snap = J(await table());
  let res = null;
  try { res = await db.exec(read(MINE)); ok(true, MINE + ' 再適用OK'); }
  catch (e) { ok(false, MINE + ' 再適用で失敗', e.message); }
  ok(J(await table()) === snap, '流し直しても表の中身（会社と時刻）は変わらない');
  const trg = (await one(`select count(*)::int as c from pg_trigger where tgname = 'trg_pv_airline_activity' and not tgisinternal`)).c;
  ok(trg === 5, '引き金は5つの表に1つずつ（流し直しても増えない）', String(trg));
  const check = res && res[res.length - 1] && res[res.length - 1].rows;
  ok(Array.isArray(check) && check.length === 10 && check.every((x) => String(x.結果).startsWith('✅')),
    'ファイル末尾の検算 10行が全部 ✅', J(check && check.filter((x) => !String(x.結果).startsWith('✅'))));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ A8 壊す証明（壊した版は begin … rollback の中でだけ入れる・ファイルは触らない）');
// ════════════════════════════════════════════════════════════
{
  const src = read(MINE);
  const a = src.indexOf('create or replace function public.pv_airline_activity_refresh(');
  const fsrc = a < 0 ? '' : src.slice(a, src.indexOf('$fn$;', a) + '$fn$;'.length);
  /* 壊した版の数え直しを1回流し、確かめ方 check を当てて、巻き戻す。 */
  const tryBroken = async (cut, check) => {
    const broken = cut.reduce((s, c) => s.replace(c, () => ''), fsrc);
    const found = cut.every((c) => fsrc.split(c).length === 2);
    await asOwner(); await db.exec(`begin`);
    await db.exec(broken);
    await db.exec(`select public.pv_airline_activity_refresh()`);
    const res = await check();
    const o = await order();
    await asOwner(); await db.exec(`rollback`);
    return { found, broken, res, o };
  };

  // ① テスト用アカウントを外す2行
  const testerCheck = async () => { const o = await order(); return (await samePort()).same && !o.includes(TPAY) && !o.includes(TREV); };
  ok(await testerCheck(), '（本物）テスト用アカウントの検査は緑');
  const CUT1 = [
    `
       and not exists (select 1 from public.pv_test_users t   -- ★テスト用アカウント（給与）
                        where encode(extensions.digest(t.uid::text || '::pv_pay::' || p.airline || coalesce('::' || lower(p.airline_other), ''), 'sha256'), 'hex') = p.proof_hash)`,
    `
         where not exists (select 1 from public.pv_test_users t   -- ★テスト用アカウント（口コミ）
                            where encode(extensions.digest(t.uid::text || '::pv_anon::' || v.airline || '::2026', 'sha256'), 'hex') = v.proof_hash)`,
  ];
  const b1 = await tryBroken(CUT1, testerCheck);
  ok(b1.found && !b1.broken.includes('pv_test_users'), '（テスト用アカウントを外す2行を見つけて抜いた）');
  ok(!b1.res && b1.o.includes(TPAY) && b1.o.includes(TREV) && b1.o.indexOf(TPAY) < b1.o.indexOf(TREV),
    '★壊した版では、テスト用アカウントの給与・口コミの会社が並びに戻り、検査が赤くなる', J(b1.o));
  ok(await testerCheck(), '（巻き戻したあと: 本物は緑）');

  // ② 引き取っていない預かりだけに絞る1行
  const claimedCheck = async () => { const o = await order(); return (await samePort()).same && o[o.length - 1] === CLM; };
  ok(await claimedCheck(), '（本物）引き取った預かりの検査は緑（預かりを閉じた会社は60日前の位置のまま）');
  const CUT2 = [`
         where q.claimed_at is null`];
  const b2 = await tryBroken(CUT2, claimedCheck);
  ok(b2.found && !b2.broken.includes('claimed_at'), '（引き取っていない預かりだけに絞る1行を見つけて抜いた）');
  ok(!b2.res && b2.o[b2.o.length - 1] !== CLM,
    '★壊した版では、引き取った預かりがまた数えられ、預かりを閉じた会社が前へ出て検査が赤くなる', J(b2.o));
  ok(await claimedCheck(), '（巻き戻したあと: 本物は緑）');
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
