/* 会社ページの「会員が出した年収の中央値」（db/member-median.sql）を、本物の Postgres（PGlite = PG17 の WASM ビルド）で確かめる。

   実行: node db/test-member-median.mjs   （check.mjs sql にも入っている）
   ネットワーク不要・本番に一切触らない。

   守っているもの（2026-10-31 オーナー指示「提出のたびにすぐ変える」）:
     ★ 数え方は手元の道具 member-median.mjs と同じ ── 道具の規則を JS へそのまま写した port() と、
       表の中身（会社 × 職位・中央値・人数）が1つ残らず同じ。さらに手で数えた答えとも同じ（奇数・偶数・1人の組）
     ★ 外す行 ── テスト用アカウントの給与と口コミ（自由入力の社名の給与も）・本人が下ろした人・
       24か月より古い行・年 $10,000〜$700,000 の外・機長／副操縦士でない職位・どの会社にも当たらない社名
     ★ 同じ人の新しい1件だけ・給与を出した人の口コミは数えない・自由入力の社名が会社コードに直って数えられる
     ★ 引き金 ── 給与を1件入れる・テスト用アカウントを名簿に足す・下ろす・口コミを入れる（ログイン済みの人として）と、
       その場で表が変わる（数え直しを手で呼ばない）
     ★ 人数を外へ出さない ── 未ログイン・ログイン済みは2つの表を直接読めない・数え直しを呼べない。
       読む口が返す列は rank と median_man の2つだけ・1人の組は返らない
     ★ 数え直しの中で失敗が起きても、給与の書き込みは通る（表は前の中身のまま）
     ★ 壊す証明 ── テスト用アカウントを外す2行を抜いた版では、テスト用アカウントの検査が赤くなる

   器は db/test-company-comp.mjs と同じ（anon / authenticated ロール、既定の権限を全部付けた状態、auth.uid() の代役、
   profiles、auth.users、reviews_v2）。流す SQL の並びは serve-local.mjs の SQL_FILES をそのまま読む（写さない）。
   給与は本物の submit_pay_report をその会員として通して出し、年収と時刻だけを持ち主として書き換える。

   ⚠️ set_config の第3引数は false（＝セッション全体）。
   ⚠️ ここに出てくる会員は全部作り物（crew1@example.com など）。数字も検査のための作り物。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import { createHash } from 'node:crypto';
import { SQL_FILES } from '../serve-local.mjs';
import { JPY_PER } from '../fx-rates.mjs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const MINE = 'db/member-median.sql';

const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;
await db.exec(`set timezone = 'UTC'`);

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };
const must = (c, l, e = '') => { if (!c) ok(false, '（準備が崩れた）' + l, e); return !!c; };
const J = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x) : x));

// ── 器（db/test-company-comp.mjs と同じ）──────────────────────
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
must(SQL_FILES.indexOf(MINE) > SQL_FILES.indexOf('db/pay-rows.sql') && SQL_FILES.indexOf(MINE) > SQL_FILES.indexOf('db/reviews-gate.sql'),
  `${MINE} は db/pay-rows.sql と db/reviews-gate.sql のあと`);
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

const BASE = { currency: 'USD', lang: 'en', tax_rate_pct: 0, fleet: 'a320', gross_monthly: 9000 };
/* 給与を1件出す（本物の submit_pay_report をその会員として通す）。そのあと年収と時刻だけを持ち主として書き換える。 */
const pay = async (who, airline, pos, usd, { k = 1, at = '10 days', other } = {}) => {
  const body = { ...BASE, airline, position: pos, period_year: ago(k).year, period_month: ago(k).month };
  if (other) body.airline_other = other;
  const r = await call(who, `select public.submit_pay_report($1::jsonb) as v`, [J(body)]);
  await db.exec(`update public.profiles set pay_reports_today = 0`);
  must(!r.err && r.rows[0].v && r.rows[0].v.access_until != null, `給与を出せなかった（${airline} / ${pos} / ${other || ''}）`, r.err || J(r.rows && r.rows[0]));
  const h = payKey(who, airline, other);
  const u = await db.query(`update public.pay_reports set annual_total_usd = $1, created_at = now() - $2::interval
                             where proof_hash = $3 and period_year = $4 and period_month = $5`,
    [usd, at, h, ago(k).year, ago(k).month]);
  must(u.affectedRows === 1, `給与の行を見つけられない（${airline} / ${pos}）`);
  return h;
};
/* 口コミを1件入れる（持ち主として）。link のときだけ対応表（pv_review_person）に人の鍵を入れる。
   鍵の式は db/pay-rows.sql 1-d と同じ（口コミ側は ::pv_anon::…::2026、人の鍵は 'r:' ＋ 給与側の形）。 */
const review = async (who, airline, pos, money, { at = '10 days', link = true } = {}) => {
  const m = { annual_salary: null, base_annual: null, flight_allowance_annual: null, monthly_salary: null, bonus: null, ...money };
  const r = await one(`insert into public.reviews_v2 (proof_hash, airline, "position", annual_salary, base_annual,
                         flight_allowance_annual, monthly_salary, bonus, created_at)
                       values ($1, $2, $3, $4, $5, $6, $7, $8, now() - $9::interval) returning id`,
    [sha(`${who}::pv_anon::${airline}::2026`), airline, pos, m.annual_salary, m.base_annual,
     m.flight_allowance_annual, m.monthly_salary, m.bonus, at]);
  if (link) await db.query(`insert into public.pv_review_person (review_id, pkey) values ($1, $2)`, [r.id, 'r:' + payKey(who, airline)]);
  return r.id;
};

const table = async () => {
  await asOwner();
  return Object.fromEntries((await rows(`select airline, rank, median_man, n from public.pv_member_median`))
    .map((r) => [`${r.airline} ${r.rank}`, { median: Number(r.median_man), n: Number(r.n) }]));
};
const cell = async (air, rank) => (await table())[`${air} ${rank}`] || null;

/* ── 手元の道具（member-median.mjs）の規則を、そのまま JS に写したもの ──────────────────
   道具は本番の REST から読む。ここは同じ表を持ち主として読む。違いは道具の注にある①だけ:
   ① どの会社にも当たらない社名（'other'）は捨てる（db/member-median.sql の「道具と違うところ」①）。
   ⚠️ 道具の規則を直したら、ここも db/member-median.sql も一緒に直す。 */
const port = async () => {
  await asOwner();
  const t = (x) => new Date(x).getTime();
  const M24 = t((await one(`select now() - interval '24 months' as v`)).v);
  const pr = await rows(`select created_at, airline, airline_other, "position", annual_total_usd, proof_hash from public.pay_reports`);
  const rv = await rows(`select id, created_at, airline, "position", proof_hash, annual_salary, base_annual,
                                flight_allowance_annual, monthly_salary, bonus from public.reviews_v2`);
  const links = await rows(`select review_id, pkey from public.pv_review_person`);
  const fx = await rows(`select to_usd from public.fx_rates where code = 'JPY'`);
  const hide = await rows(`select proof_hash from public.pay_hidden`);
  const testIds = (await rows(`select uid from public.pv_test_users`)).map((r) => r.uid);

  const payHash = (u, a, o) => payKey(u, a, o);
  const reviewHash = (u, a) => sha(`${u}::pv_anon::${a}::2026`);
  const testPay = new Set(), testRv = new Set();
  for (const id of testIds) { for (const r of pr) testPay.add(payHash(id, r.airline, r.airline_other)); for (const r of rv) testRv.add(reviewHash(id, r.airline)); }
  const hidden = new Set(hide.map((h) => 'r:' + h.proof_hash));
  const resolved = new Map();
  const resolve = async (x) => { const k = String(x ?? ''); if (!resolved.has(k)) resolved.set(k, (await one(`select public.pv_airline_resolve($1) as c`, [k])).c); return resolved.get(k); };
  const RANK = (p) => ({ captain: 'cap', cap: 'cap', tri_tre: 'cap', fo: 'fo', sfo: 'fo' })[p] || null;
  const jpyToUsd = fx[0] ? Number(fx[0].to_usd) : null;
  const out = []; const shelfKeys = new Set();
  for (const r of pr) {
    if (r.annual_total_usd == null || t(r.created_at) < M24 || testPay.has(r.proof_hash)) continue;
    shelfKeys.add('r:' + r.proof_hash);
    out.push({ key: 'r:' + r.proof_hash, air: r.airline === 'other' ? await resolve(r.airline_other) : r.airline, rank: RANK(r.position), usd: Number(r.annual_total_usd), at: t(r.created_at) });
  }
  const linkBy = Object.fromEntries(links.map((l) => [l.review_id, l.pkey]));
  const nz = (x) => (Number(x) || 0) || null;
  for (const v of rv) {
    const key = linkBy[v.id]; if (!key || t(v.created_at) < M24 || shelfKeys.has(key) || testRv.has(v.proof_hash)) continue;
    const man = nz(v.annual_salary) ?? ((nz(v.base_annual) || nz(v.flight_allowance_annual)) ? (Number(v.base_annual) || 0) + (Number(v.flight_allowance_annual) || 0) + (Number(v.bonus) || 0) : null)
      ?? (nz(v.monthly_salary) ? Number(v.monthly_salary) * 12 + (Number(v.bonus) || 0) : null);
    if (man == null || jpyToUsd == null) continue;
    out.push({ key, air: await resolve(v.airline), rank: RANK(v.position), usd: man * 10000 * jpyToUsd, at: t(v.created_at), review: true });
  }
  const good = out.filter((r) => r.rank && r.air && r.air !== 'other' /* ① */ && r.usd >= 10000 && r.usd <= 700000 && !hidden.has(r.key));
  const latest = new Map(); for (const r of good) { const k = [r.key, r.air, r.rank].join(' '); if (!latest.has(k) || latest.get(k).at < r.at) latest.set(k, r); }
  const groups = new Map(); for (const r of latest.values()) { const k = r.air + ' ' + r.rank; (groups.get(k) || groups.set(k, []).get(k)).push(r); }
  const res = {};
  for (const [k, g] of groups) {
    const v = g.map((r) => r.usd * JPY_PER.USD / 10000).sort((a, b) => a - b), n = v.length;
    const med = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
    res[k] = { median: Math.round(med), n };
  }
  return res;
};
const sortKeys = (o) => JSON.stringify(Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]])));
const samePort = async () => { const [a, b] = [await table(), await port()]; return { same: sortKeys(a) === sortKeys(b), table: a, port: b }; };

// 会社コードは語彙から取る（このテストのために特定の社名を覚えない）
const AIR = (await rows(`select code, name_en from public.pv_airlines where code <> 'other' and active and name_en is not null order by code limit 40`));
const [A1, A2, A3, A4, A6] = AIR.slice(0, 5).map((r) => r.code);
// 自由入力の社名で出す会社: 英語名を大文字にして打ち込んでも、pv_airline_resolve がその会社に寄せるもの
let A5 = null, TYPED = null;
for (const r of AIR.slice(5)) {
  const typed = '  ' + String(r.name_en).toUpperCase() + ' ';
  if ((await one(`select public.pv_airline_resolve($1) as c`, [typed.trim()])).c === r.code) { A5 = r.code; TYPED = typed.trim(); break; }
}
const NOWHERE = 'Zzqx Imaginary Airways';
must(A5 && (await one(`select public.pv_airline_resolve($1) as c`, [NOWHERE])).c === 'other', '自由入力の社名の見本を作れない', J({ A5, TYPED }));
const USD_JPY = Number((await one(`select to_jpy from public.fx_rates where code = 'USD'`)).to_jpy);
must(USD_JPY === JPY_PER.USD, 'DB の USD の to_jpy が fx-rates.mjs の JPY_PER.USD と違う（道具と同じ換算にならない）', J({ USD_JPY, JPY_PER: JPY_PER.USD }));


// ════════════════════════════════════════════════════════════
console.log('\n▼ M1 見本を入れる（給与は本物の submit_pay_report・口コミは持ち主として）');
// ════════════════════════════════════════════════════════════
// A1 機長（奇数）: 3人 ＋ 古い行・見習い・テスト用アカウント
const P1 = await member(), P2 = await member(), P3 = await member();
await pay(P1, A1, 'cap', 100000); await pay(P2, A1, 'cap', 150000); await pay(P3, A1, 'cap', 200000);
const OLD = await member(); await pay(OLD, A1, 'cap', 50000, { at: '25 months' });          // 24か月より古い
// 機長でも副操縦士でもない（訓練生は 2026-09-02 から選べない＝出したあとで昔の行の形に書き換える。本番にも残っている形）
const CADET = await member();
const CADET_KEY = await pay(CADET, A1, 'cap', 120000);
must((await db.query(`update public.pay_reports set "position" = 'cadet' where proof_hash = $1`, [CADET_KEY])).affectedRows === 1, '訓練生の行を作れない');
const TESTER = await member();
await pay(TESTER, A1, 'cap', 690000);                                                      // テスト用アカウント（給与）
await pay(TESTER, 'other', 'cap', 690000, { other: TYPED });                               // テスト用アカウント（自由入力の社名の給与）
await review(TESTER, A4, 'fo', { annual_salary: 2500 });                                   // テスト用アカウント（口コミ）
// A2 副操縦士（偶数）: 4人。Q1 は2件（古いほうは大きい額）。H はあとで下ろす
const Q1 = await member(), Q2 = await member(), Q3 = await member(), Q4 = await member(), H = await member();
await pay(Q1, A2, 'fo', 300000, { k: 2, at: '40 days' });
await pay(Q1, A2, 'fo', 60000, { k: 1, at: '5 days' });
await pay(Q2, A2, 'fo', 80000); await pay(Q3, A2, 'fo', 90000); await pay(Q4, A2, 'fo', 120000);
const H_KEY = await pay(H, A2, 'fo', 70000);
// A3 機長: 1人だけ
const R1 = await member(); await pay(R1, A3, 'cap', 120000);
// A4: 口コミの組。年額の3つの作り方・職位の読み替え・給与を出した人の口コミ・対応表の無い口コミ・古い口コミ
const V1 = await member(), V2 = await member(), V3 = await member();
await review(V1, A4, 'fo', { annual_salary: 1500 });
await review(V2, A4, 'sfo', { annual_salary: 0, base_annual: 1200, flight_allowance_annual: 400, bonus: 100 });
await review(V3, A4, 'fo', { monthly_salary: 110, bonus: 300 });
const W = await member();
await pay(W, A4, 'fo', 80000, { at: '20 days' });
await review(W, A4, 'fo', { annual_salary: 3000 }, { at: '2 days' });                     // 給与を出した人の口コミ（新しいが数えない）
const V5 = await member(); await review(V5, A4, 'fo', { annual_salary: 2500 }, { link: false }); // 対応表に無い
const V9 = await member(); await review(V9, A4, 'fo', { annual_salary: 2500 }, { at: '25 months' }); // 24か月より古い
const V10 = await member(); await review(V10, A4, 'purser', { annual_salary: 2500 });      // 職位が読めない
const V7 = await member(), V8 = await member();
await review(V7, A4, 'captain', { annual_salary: 2000 });
await review(V8, A4, 'tri_tre', { annual_salary: 2400 });
// A5: 自由入力の社名（大文字で打っても会社コードに直る）／どこにも当たらない社名
const F1 = await member(), F2 = await member(), U = await member();
await pay(F1, 'other', 'cap', 100000, { other: TYPED });
await pay(F2, 'other', 'cap', 140000, { other: TYPED.toLowerCase() });
await pay(U, 'other', 'cap', 130000, { other: NOWHERE });
// A6 機長: 幅の端（1万ドルと70万ドルちょうどは入る・その外は入らない）
const E1 = await member(), E2 = await member(), E3 = await member(), E4 = await member();
await pay(E1, A6, 'cap', 10000); await pay(E2, A6, 'cap', 700000);
await pay(E3, A6, 'cap', 9999.99); await pay(E4, A6, 'cap', 700000.01);
ok(true, `見本: 会員 ${seat} 人・給与 ${(await one(`select count(*)::int as c from public.pay_reports`)).c} 件・口コミ ${(await one(`select count(*)::int as c from public.reviews_v2`)).c} 件`);


// ════════════════════════════════════════════════════════════
console.log('\n▼ M2 引き金（名簿に足す・下ろす）で、その場で表が変わる');
// ════════════════════════════════════════════════════════════
{
  const b1 = await cell(A1, 'cap'), b2 = await cell(A2, 'fo'), b4 = await cell(A4, 'fo'), b5 = await cell(A5, 'cap');
  ok(b1 && b1.n === 4 && b1.median === 2782, '（名簿に足す前）A1 機長はテスト用アカウントも数えて 4人・2,782万', J(b1));
  ok(b5 && b5.n === 3, '（名簿に足す前）A5 機長はテスト用アカウントの自由入力の社名の給与も数えて 3人', J(b5));
  ok(b4 && b4.n === 5, '（名簿に足す前）A4 副操縦士はテスト用アカウントの口コミも数えて 5人', J(b4));
  ok(b2 && b2.n === 5 && b2.median === 1272, '（下ろす前）A2 副操縦士は下ろす人も数えて 5人・1,272万', J(b2));

  await db.query(`insert into public.pv_test_users (uid) values ($1)`, [TESTER]);
  const a1 = await cell(A1, 'cap'), a4 = await cell(A4, 'fo'), a5 = await cell(A5, 'cap');
  ok(a1 && a1.n === 3 && a1.median === 2384, '★テスト用アカウントを名簿に足した瞬間、その給与が外れる（A1 機長 3人・2,384万）', J(a1));
  ok(a5 && a5.n === 2, '★テスト用アカウントの自由入力の社名の給与も外れる（A5 機長 2人）', J(a5));
  ok(a4 && a4.n === 4, '★テスト用アカウントの口コミも外れる（A4 副操縦士 4人）', J(a4));

  await db.query(`insert into public.pay_hidden (proof_hash, reason) values ($1, '検査')`, [H_KEY]);
  const a2 = await cell(A2, 'fo');
  ok(a2 && a2.n === 4 && a2.median === 1351, '★下ろした瞬間、その人が外れる（A2 副操縦士 4人・1,351万）', J(a2));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ M3 数え方: 手元の道具と同じ・手で数えた答えと同じ');
// ════════════════════════════════════════════════════════════
{
  const { same, table: tb, port: pt } = await samePort();
  ok(same && Object.keys(tb).length >= 6, `★表の中身（${Object.keys(tb).length} 区分の中央値と人数）が、道具の規則の写し（port）と1つ残らず同じ`, J({ table: tb, port: pt }));
  const HAND = [
    [A1, 'cap', 3, 2384, '奇数 ── 3人のまんなか（15万ドル → 2,384.25 → 2,384）・古い行・見習い・テスト用アカウントは入らない'],
    [A2, 'fo', 4, 1351, '偶数 ── まんなか2人の平均（8.5万ドル → 1,351.075 → 1,351）・同じ人は新しい1件だけ・下ろした人は入らない'],
    [A3, 'cap', 1, 1907, '1人の組も表には在る（読む口は返さない ── M5）'],
    [A4, 'fo', 4, 1560, '口コミ ── 年額の3つの作り方・sfo は副操縦士・給与を出した人の口コミは数えない（給与の 8万ドルが入る）'],
    [A4, 'cap', 2, 2200, '口コミ ── captain と tri_tre は機長'],
    [A5, 'cap', 2, 1907, '自由入力の社名が会社コードに直る（大文字・小文字・前後の空白を問わない）'],
    [A6, 'cap', 2, 5643, '幅の端 ── 1万ドルと70万ドルちょうどは入る・9,999.99 と 700,000.01 は入らない'],
  ];
  for (const [air, rank, n, median, label] of HAND) {
    const c = tb[`${air} ${rank}`];
    ok(c && c.n === n && c.median === median, `${label}（${n}人・${median.toLocaleString('en-US')}万）`, J(c));
  }
  ok(!Object.keys(tb).some((k) => k.startsWith('other ')), 'どの会社にも当たらない社名は、どの区分にも入らない（"other" の区分を作らない）', J(Object.keys(tb)));
  ok(Object.keys(tb).every((k) => /^\S+ (cap|fo)$/.test(k)), '職位は機長と副操縦士の2つだけ（見習い・読めない職位の区分を作らない）', J(Object.keys(tb)));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ M4 引き金: 給与・口コミを1件入れると、すぐ表が変わる（数え直しを手で呼ばない）');
// ════════════════════════════════════════════════════════════
{
  const P4 = await member();
  await pay(P4, A1, 'cap', 260000);
  const c = await cell(A1, 'cap');
  ok(c && c.n === 4 && c.median === 2782, '★給与を1件出した瞬間、A1 機長が 4人・2,782万になる', J(c));
  ok((await samePort()).same, '（そのあとも道具の規則の写しと同じ）');

  // ログイン済みの会員として口コミを書く（引き金は security definer ── 会員に数え直しの実行権が無くても動く）
  const before = (await one(`select max(updated_at) as t from public.pv_member_median`)).t;
  const X = await member();
  const r = await call(X, `insert into public.reviews_v2 (proof_hash, airline, "position", annual_salary) values ($1, $2, 'fo', 1800)`,
    [sha(`${X}::pv_anon::${A3}::2026`), A3]);
  const after = (await one(`select max(updated_at) as t from public.pv_member_median`)).t;
  ok(!r.err && new Date(after) > new Date(before), '★ログイン済みの会員が口コミを書くと、その場で数え直しが走る（書き込みも通る）', r.err || J({ before, after }));

  // 翻訳の書き込み（数字に関係しない列）では数え直さない
  const t0 = (await one(`select max(updated_at) as t from public.pv_member_median`)).t;
  await db.query(`update public.reviews_v2 set translations = '{"en":{}}'::jsonb where airline = $1`, [A4]);
  await db.query(`update public.pay_reports set verify_level = 1 where airline = $1`, [A1]).catch(() => null);
  const t1 = (await one(`select max(updated_at) as t from public.pv_member_median`)).t;
  ok(String(t0) === String(t1), '口コミの翻訳・給与の検証の印の書き換えでは数え直さない（数字に関わる列だけ）', J({ t0, t1 }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ M5 人数を外へ出さない（表は読めない・読む口は2列だけ・1人の組は返らない）');
// ════════════════════════════════════════════════════════════
{
  for (const [who, nm] of [[ANON, '未ログイン'], [await member(), 'ログイン済み']]) {
    const t1 = await call(who, `select * from public.pv_member_median`);
    const t2 = await call(who, `select * from public.pv_test_users`);
    ok(t1.err && t2.err, `★${nm}は2つの表を直接読めない`, J({ t1, t2 }));
    const w = await call(who, `insert into public.pv_test_users (uid) values ($1)`, [uid(9999)]);
    ok(!!w.err, `${nm}はテスト用アカウントの名簿に書けない（人を勝手に外させない）`, J(w));
    const f = await call(who, `select public.pv_member_median_refresh()`);
    ok(!!f.err, `${nm}は数え直しを呼べない（外から何度も呼んで重くさせない）`, J(f));

    const r = await call(who, `select * from public.pv_member_medians($1)`, [A1]);
    ok(!r.err && J(r.fields.map((x) => x.name)) === J(['rank', 'median_man']), `★${nm}: 読む口が返す列は rank と median_man の2つだけ（人数を返さない）`, J(r.err || r.fields));
    ok(!r.err && J(r.rows) === J([{ rank: 'cap', median_man: 2782 }]), `${nm}: A1 は機長の中央値だけ（副操縦士の組は無い）`, J(r.rows));
    const r4 = await call(who, `select * from public.pv_member_medians($1)`, [A4]);
    ok(!r4.err && J(r4.rows) === J([{ rank: 'cap', median_man: 2200 }, { rank: 'fo', median_man: 1560 }]), `${nm}: A4 は機長・副操縦士の順に2つ`, J(r4.rows));
    const r3 = await call(who, `select * from public.pv_member_medians($1)`, [A3]);
    ok(!r3.err && r3.rows.length === 0, `★${nm}: 1人の組（A3 機長）は返らない`, J(r3.rows));
    const rx = await call(who, `select * from public.pv_member_medians($1)`, ['no-such-airline']);
    const rn = await call(who, `select * from public.pv_member_medians(null)`);
    ok(!rx.err && rx.rows.length === 0 && !rn.err && rn.rows.length === 0, `${nm}: 無い会社・空の引数は何も返さない（例外も出さない）`, J({ rx, rn }));
  }
  const def = (await one(`select pg_get_functiondef('public.pv_member_medians(text)'::regprocedure) as s`)).s;
  ok(!/pay_reports|reviews_v2|refresh|percentile|count\(/.test(def), '読む口は表を引くだけ（給与・口コミの表を読まない・数えない＝開くたびに重くならない）');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ M6 数え直しの中で失敗が起きても、給与の書き込みは通る');
// ════════════════════════════════════════════════════════════
{
  const snap = sortKeys(await table());
  // 表に「どの中央値も入れられない」制約を一時だけ足す ＝ 数え直しの insert が必ず失敗する
  await db.exec(`alter table public.pv_member_median add constraint pv_mm_break check (median_man < 0) not valid`);
  const Z = await member();
  const body = { ...BASE, airline: A3, position: 'cap', period_year: ago(1).year, period_month: ago(1).month };
  const r = await call(Z, `select public.submit_pay_report($1::jsonb) as v`, [J(body)]);
  await db.exec(`update public.profiles set pay_reports_today = 0`);
  const saved = (await one(`select count(*)::int as c from public.pay_reports where proof_hash = $1`, [payKey(Z, A3)])).c;
  ok(!r.err && r.rows[0].v.access_until != null && saved === 1, '★数え直しが失敗しても、給与は保存され鍵も開く', r.err || J(r.rows));
  ok(sortKeys(await table()) === snap, '表は前の中身のまま（失敗した数え直しの途中の削除も残らない）');
  await db.exec(`alter table public.pv_member_median drop constraint pv_mm_break`);
  await db.query(`update public.pay_reports set annual_total_usd = 130000 where proof_hash = $1`, [payKey(Z, A3)]);
  const c = await cell(A3, 'cap');
  ok(c && c.n === 2 && (await samePort()).same, '直したあとの次の書き込みで、取りこぼした1件も数えられる（A3 機長 2人）', J(c));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ M7 冪等（db/member-median.sql をもう一度そのまま流す）');
// ════════════════════════════════════════════════════════════
{
  const snap = sortKeys(await table());
  const users = (await one(`select count(*)::int as c from public.pv_test_users`)).c;
  let res = null;
  try { res = await db.exec(read(MINE)); ok(true, MINE + ' 再適用OK'); }
  catch (e) { ok(false, MINE + ' 再適用で失敗', e.message); }
  ok(sortKeys(await table()) === snap && (await one(`select count(*)::int as c from public.pv_test_users`)).c === users,
    '流し直しても表の中身とテスト用アカウントの名簿は変わらない');
  const trg = (await one(`select count(*)::int as c from pg_trigger where tgname = 'trg_pv_member_median' and not tgisinternal`)).c;
  ok(trg === 5, '引き金は5つの表に1つずつ（流し直しても増えない）', String(trg));
  const check = res && res[res.length - 1] && res[res.length - 1].rows;
  ok(Array.isArray(check) && check.length === 10 && check.every((x) => String(x.結果).startsWith('✅')),
    'ファイル末尾の検算 10行が全部 ✅', J(check && check.filter((x) => !String(x.結果).startsWith('✅'))));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ M8 壊す証明: テスト用アカウントを外す2行を抜いた版では、テスト用アカウントの検査が赤くなる');
// ════════════════════════════════════════════════════════════
{
  /* M2・M3 と同じ確かめ方（表 ＝ 道具の規則の写し、かつ テスト用アカウントの給与・口コミが入っていない）を関数にして、
     本物と壊した版の両方に当てる。壊した版は begin … rollback の中でだけ入れる（ファイルは触らない）。 */
  const testerCheck = async () => {
    const tb = await table();
    return (await samePort()).same && tb[`${A1} cap`]?.n === 4 && tb[`${A4} fo`]?.n === 4 && tb[`${A5} cap`]?.n === 2;
  };
  ok(await testerCheck(), '（本物）テスト用アカウントの検査は緑');

  const src = read(MINE);
  const a = src.indexOf('create or replace function public.pv_member_median_refresh(');
  const fsrc = a < 0 ? '' : src.slice(a, src.indexOf('$fn$;', a) + '$fn$;'.length);
  const CUT = [
    `
       and not exists (select 1 from public.pv_test_users t   -- ★テスト用アカウント（給与）
                        where encode(extensions.digest(t.uid::text || '::pv_pay::' || p.airline || coalesce('::' || lower(p.airline_other), ''), 'sha256'), 'hex') = p.proof_hash)`,
    `
       and not exists (select 1 from public.pv_test_users t   -- ★テスト用アカウント（口コミ）
                        where encode(extensions.digest(t.uid::text || '::pv_anon::' || v.airline || '::2026', 'sha256'), 'hex') = v.proof_hash)`,
  ];
  const broken = CUT.reduce((s, c) => s.replace(c, () => ''), fsrc);
  ok(CUT.every((c) => fsrc.split(c).length === 2) && !broken.includes('pv_test_users'), '（テスト用アカウントを外す2行を見つけて抜いた）');
  await asOwner(); await db.exec(`begin`);
  await db.exec(broken);
  await db.exec(`select public.pv_member_median_refresh()`);
  const red = await testerCheck();
  const tb = await table();
  await asOwner(); await db.exec(`rollback`);
  ok(!red && tb[`${A1} cap`]?.n === 5 && tb[`${A4} fo`]?.n === 5 && tb[`${A5} cap`]?.n === 3,
    '★壊した版では、テスト用アカウントの給与・自由入力の社名の給与・口コミが数えられ、検査が赤くなる', J({ A1: tb[`${A1} cap`], A4: tb[`${A4} fo`], A5: tb[`${A5} cap`] }));
  ok(await testerCheck(), '（巻き戻したあと: 本物は緑）');
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
