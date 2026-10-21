/* 比較（career.html）の「提出された年収」が頼っている2つの口を、本物の Postgres（PGlite = PG17 の WASM ビルド）で確かめる。

   実行: node db/test-pay-compare.mjs
   手で流す検査（check.mjs にはまだ入れていない）。ネットワーク不要・本番に一切触らない。
   db/pay-median.sql か db/company-pay.sql を直したら、これを通してからオーナーに貼ってもらう。

   守っているもの（画面が頼っている形だけを見る。ほかの会話の検査と同じことは繰り返さない）:
     ★ pv_pay_rows()（REAL PAY の一覧）── 未ログイン・給与を出していない会員・口コミだけの会員・鍵の切れた人には
       同じバイトの行（会社・出典・時期の3つだけ）。開くのは給与を出した人と運営だけ。口コミの鍵では開かない。
       鍵の切れた人は give.basic が true、出したことの無い人は false（鍵の日付だけ動いた人も false）。
     ★ pv_company_pay()（db/company-pay.sql）── 鍵の無い人には { ok, state } の2つだけ（引数がおかしくても同じ）。
       開くのは pv_pay_rows() が開く人とぴったり同じ人（結果で突き合わせる）。
     ★ 数字の決め方（db/pay-median.sql の pv_pay_medians）── 壁の人数に届かない区分は { s:'few' } だけ・
       1人は1回（同じ人の何か月もまんなか1つ）・2社に出した人は両方に1人ずつ・
       口コミに書かれた年収・登録前の預かり・下ろした人・常識の幅の外・24か月より前の月は入らない。
     ★ 人数・件数・幅はどの返事にも無い（人数はどこにも出さない）。実行権。2つのファイルの末尾の検算（6行と6行）。

   器は db/test-contrib.mjs と同じ（anon / authenticated ロール、既定の権限を全部付けた状態、auth.uid() の代役、
   profiles、auth.users、reviews_v2）。流す SQL の並びは serve-local.mjs の SQL_FILES をそのまま読む（写さない）。
   読み手は本物の submit_pay_report をその会員として通して作る（access_until を先へ書いて鍵を作らない）。
   運営は db/test-pay-rows.mjs と同じく名簿（pv_admins）に入れて作る。

   ⚠️ set_config の第3引数は false（＝セッション全体）。
   ⚠️ ここに出てくる会員は全部作り物（crew1@example.com など）。数字も検査のための作り物。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import { SQL_FILES } from '../serve-local.mjs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const MEDIAN = 'db/pay-median.sql', MINE = 'db/company-pay.sql', AFTER = 'db/work-months.sql';

/* 壁の人数。db/pay-median.sql の `3 as c_floor` と同じ数（A4）。
   main の DEEP PAY（壁は2人）をこの枝へ合流させるときは、あちらの knob・頭の約束 6 と 7・末尾の検算の6行目と一緒に、
   ここも同じ手で 2 にする。「2以上」とは書かない（数がずれたことに気づけなくなる）。 */
const FLOOR = 3;

const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;
await db.exec(`set timezone = 'UTC'`);

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };
// 準備の確かめ。通れば何も数えない。崩れたら ❌ を1行出して数える（黙って先へ進まない）
const must = (c, l, e = '') => { if (!c) ok(false, '（準備が崩れた）' + l, e); return !!c; };
const J = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x) : x));
// キーの並びに左右されない比べ方
const canon = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x)
  : (x && typeof x === 'object' && !Array.isArray(x)) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));
const keys = (o) => Object.keys(o || {}).sort().join(',');

// ── 器（serve-local.mjs の BOOT の写し。db/test-contrib.mjs と同じ）──────
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
const FILES = [...SQL_FILES];
const listed = FILES.indexOf(MEDIAN) === FILES.indexOf(AFTER) + 1 && FILES.indexOf(MINE) === FILES.indexOf(AFTER) + 2;
ok(listed, `serve-local.mjs の SQL_FILES で ${AFTER} の直後に ${MEDIAN} → ${MINE} の順`,
  J(FILES.slice(Math.max(0, FILES.indexOf(AFTER) - 1), FILES.indexOf(AFTER) + 4)));
if (!listed) {
  for (const f of [MEDIAN, MINE]) if (FILES.includes(f)) FILES.splice(FILES.indexOf(f), 1);
  FILES.splice(FILES.indexOf(AFTER) + 1, 0, MEDIAN, MINE);
}
for (const f of FILES) {
  try { await db.exec(read(f)); ok(true, f); }
  catch (e) { ok(false, f, e.message); process.exit(1); }
}
console.log('\n▼ 冪等性（この2つをもう一度そのまま流す）');
for (const f of [MEDIAN, MINE]) {
  try { await db.exec(read(f)); ok(true, f + ' 再適用OK'); }
  catch (e) { ok(false, f + ' 再適用で失敗', e.message); }
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
  try { return { v: (await db.query(sql, params)).rows[0] }; }
  catch (e) { return { err: String(e.message || e) }; }
  finally { await asOwner(); }
};
const denied = (r) => !!(r && r.err && /permission denied/i.test(r.err));
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const many = async (sql, params = []) => (await db.query(sql, params)).rows;

/* 比較の口の返事は全部ためておく（T-Q13 で、人数・件数・幅がどの返事にも無いことを見る）。 */
const SEEN = [];
const cmp = async (who, p) => {
  const r = p === undefined
    ? await call(who, `select public.pv_company_pay() as v`)
    : await call(who, `select public.pv_company_pay($1::jsonb) as v`, [p === null ? null : J(p)]);
  if (r.err) return { __err: r.err };
  SEEN.push(r.v.v);
  return r.v.v;
};
const payRows = async (who) => {
  const r = await call(who, `select public.pv_pay_rows() as v`);
  return r.err ? { __err: r.err } : r.v.v;
};

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
const ym = (o) => `${o.year}-${String(o.month).padStart(2, '0')}`;

const FLEET = (await one(`select code from public.pv_fleets where active order by code limit 1`)).code;
const BASE = { currency: 'USD', lang: 'en', tax_rate_pct: 0, fleet: FLEET };
/* 給与を1件出す。その会員として本物の submit_pay_report を通す（1日の件数は毎回戻す）。
   gross_monthly を使うので 年収 ＝ その額 × 12（USD）。月は DB の時計から k か月前。 */
const put = async (who, airline, pos, gross, k = 1, x = {}) => {
  const r = await call(who, `select public.submit_pay_report($1::jsonb) as v`,
    [J({ ...BASE, airline, position: pos, period_year: ago(k).year, period_month: ago(k).month, gross_monthly: gross, ...x })]);
  await db.exec(`update public.profiles set pay_reports_today = 0`);
  const v = r.err ? { __err: r.err } : r.v.v;
  must(!v.__err && v.access_until != null, `給与を出せなかった（${airline} / ${pos} / ${gross}）`, J(v));
  return v;
};
// 1人ぶん（months = [[額, k], …]）
const person = async (airline, pos, months) => {
  const id = await member();
  for (const [g, k] of months) await put(id, airline, pos, g, k);
  return id;
};
const sig2 = async (v) => Number((await one(`select public.pv_sig2($1::numeric) as v`, [v])).v);
const midOf = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

// 会社コードは語彙から取る（このテストのために特定の社名を覚えない）
const AIR = (await many(
  `select code from public.pv_airlines where code <> 'other' and active order by code limit 8`)).map((r) => r.code);
const [A_READ, A_FLOOR, A_NINE, A_NINE2, A_TEN, A_RES, A_EMPTY, A_THIRD] = AIR;

// ── 読み手 ──────────────────────────────────────────────────
const MEMBER = await member();                       // 給与を出していない会員
const REVIEWER = await member();                     // 口コミだけ出した会員（口コミの鍵だけを持つ）
await db.query(`insert into public.reviews_v2 (proof_hash, airline, "position", culture_score)
                values (public.pv_review_hash($1::uuid, $2), $2, 'captain', 4)`, [REVIEWER, A_READ]);
const SUBMITTER = await member();                    // 給与を出した会員（鍵が生きている）
await put(SUBMITTER, A_READ, 'cap', 15000);
const EXPIRED = await member();                      // 給与を出したが鍵が切れた会員
await put(EXPIRED, A_READ, 'fo', 9000);
await db.query(`update public.profiles set access_until = now() - interval '1 day' where id = $1`, [EXPIRED]);
const TRAP = await member();                         // 給与を出していないのに、鍵の日付だけ動いた会員（罠）
await db.query(`update public.profiles set access_until = now() + interval '30 days' where id = $1`, [TRAP]);
await db.query(`update public.profiles set access_until = now() - interval '1 day' where id = $1`, [TRAP]);
const OPERATOR = await member();                     // 運営（給与は出していない）
await db.query(`insert into public.pv_admins (user_id, note) values ($1, '運営（検査）') on conflict (user_id) do nothing`, [OPERATOR]);
{
  const k = await call(REVIEWER, `select public.pv_has_review_key() as v`);
  must(!k.err && k.v.v === true, '口コミだけの会員が口コミの鍵を持っていない', J(k));
  const a = await one(`select annual_total_usd::numeric as v from public.pay_reports order by created_at limit 1`);
  must(Number(a.v) === 15000 * 12, '年収 ＝ 月の額 × 12 になっていない', J(a));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ T-Q1 未ログイン: pv_pay_rows() は locked・give は null・行は会社・出典・時期の3つだけ');
// ════════════════════════════════════════════════════════════
const G = await payRows(ANON);
{
  must(Array.isArray(G.rows) && G.rows.length > 0, '一覧に行が無い（何も確かめられない）', J(G).slice(0, 200));
  ok(G.state === 'locked', '★未ログインは locked', G.state);
  ok(G.give === null, '未ログインの give は null', J(G.give));
  ok(G.rows.every((r) => keys(r) === 'age,airline,verified'),
    '★行のキーはちょうど airline / verified / age（職位・年収・印は渡さない）', J(G.rows.slice(0, 2)));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ T-Q2 給与を出していない会員: 未ログインと同じバイト・give.basic は false');
// ════════════════════════════════════════════════════════════
{
  const m = await payRows(MEMBER);
  ok(m.state === 'locked', '会員は locked', m.state);
  ok(m.give && m.give.basic === false, '★give.basic は false（＝給与未提出）', J(m.give));
  ok(J(m.rows) === J(G.rows), '★行は未ログインとバイトまで同じ', J(m.rows).slice(0, 160));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ T-Q3 給与を出した会員: open・行に職位・年収・時期・出典');
// ════════════════════════════════════════════════════════════
{
  const s = await payRows(SUBMITTER);
  ok(s.state === 'open', '★給与を出した会員は open', s.state);
  ok(Array.isArray(s.rows) && s.rows.length > 0
    && s.rows.every((r) => ['pos', 'annual_usd', 'age', 'verified'].every((k) => k in r)),
    '★開いた行は pos / annual_usd / age / verified を持つ', J((s.rows || []).slice(0, 2)));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ T-Q4 鍵の切れた会員: locked・give.basic は true・行は未ログインと同じバイト');
// ════════════════════════════════════════════════════════════
{
  const e = await payRows(EXPIRED), g = await payRows(ANON);
  ok(e.state === 'locked', '★鍵が切れたら locked', e.state);
  ok(e.give && e.give.basic === true, '★give.basic は true（＝期限切れ。未提出と見分けられる）', J(e.give));
  ok(J(e.rows) === J(g.rows), '★行は未ログインとバイトまで同じ', J(e.rows).slice(0, 160));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ T-Q5 罠: 給与の行が無いのに鍵の日付だけ先へ・過去へ動いた会員は give.basic が false');
// ════════════════════════════════════════════════════════════
{
  const t = await payRows(TRAP);
  ok(t.state === 'locked', '鍵の日付が過去なら locked', t.state);
  ok(t.give && t.give.basic === false, '★give.basic は false（＝給与未提出。期限切れと言わない）', J(t.give));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ T-Q6 運営は open・口コミだけの会員は T-Q2 と同じ（口コミの鍵で給与は開かない）');
// ════════════════════════════════════════════════════════════
{
  const o = await payRows(OPERATOR), r = await payRows(REVIEWER), g = await payRows(ANON);
  ok(o.state === 'open', '★運営は open', o.state);
  ok(r.state === 'locked', '★口コミだけの会員は locked（鍵は混ぜない）', r.state);
  ok(r.give && r.give.basic === false, '口コミだけの会員の give.basic は false', J(r.give));
  ok(J(r.rows) === J(g.rows), '★口コミだけの会員の行は未ログインとバイトまで同じ', J(r.rows).slice(0, 160));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ T-Q7 鍵の無い人へは pv_company_pay がちょうど {ok:true, state:"locked"}（引数がおかしくても同じ）');
// ════════════════════════════════════════════════════════════
{
  const LOCKED = canon({ ok: true, state: 'locked' });
  const ARGS = [[{ airlines: [A_FLOOR, A_NINE] }, '正しい2社'], [{ airlines: A_FLOOR }, '配列でない'],
                [{ airlines: [A_FLOOR, A_NINE, A_TEN] }, '3社'], [{}, '空の形'], [null, 'null'], [undefined, '引数なし']];
  for (const [who, name] of [[MEMBER, '給与を出していない会員'], [REVIEWER, '口コミだけの会員'],
                             [EXPIRED, '鍵の切れた会員'], [TRAP, '鍵の日付だけ動いた会員']]) {
    const got = [];
    for (const [p] of ARGS) got.push(await cmp(who, p));
    ok(got.every((v) => canon(v) === LOCKED), `★${name}: ${ARGS.map(([, n]) => n).join('・')} のどれでも locked だけ`,
      got.map((v) => canon(v)).join(' | '));
  }
}

// ════════════════════════════════════════════════════════════
console.log(`\n▼ T-Q8 壁は ${FLOOR}人: ${FLOOR - 1}人の区分は {s:"few"} だけ・${FLOOR}人目で中央値（真ん中の人の有効数字2桁）`);
// ════════════════════════════════════════════════════════════
{
  const GROSS = [10000, 15000, 20000, 25000, 30000];
  for (let i = 0; i < FLOOR - 1; i++) await person(A_FLOOR, 'cap', [[GROSS[i], 1]]);
  const a = await cmp(SUBMITTER, { airlines: [A_FLOOR] });
  ok(canon(a.airlines && a.airlines[A_FLOOR] && a.airlines[A_FLOOR].cap) === canon({ s: 'few' }),
    `★${FLOOR - 1}人の機長は {s:"few"} だけ（ほかのキーが無い）`, J(a.airlines));
  ok(canon(a.airlines && a.airlines[A_FLOOR] && a.airlines[A_FLOOR].fo) === canon({ s: 'few' }),
    '0人の副操縦士も {s:"few"} だけ（0人と2人を見分けない）', J(a.airlines));
  await person(A_FLOOR, 'cap', [[GROSS[FLOOR - 1], 1]]);
  const b = await cmp(SUBMITTER, { airlines: [A_FLOOR] });
  const want = await sig2(midOf(GROSS.slice(0, FLOOR).map((g) => g * 12)));
  const cell = b.airlines && b.airlines[A_FLOOR] && b.airlines[A_FLOOR].cap;
  ok(cell && cell.s === 'ok' && keys(cell) === 'median_usd,s' && Number(cell.median_usd) === want,
    `★${FLOOR}人目で {s:"ok", median_usd:${want}}（真ん中の人の額を pv_sig2 に通した値）`, J(cell));
  ok(b.floor === FLOOR, `★返事の floor は ${FLOOR}`, J(b.floor));
  const knob = await one(`select (public.pv_pay_medians('{}'::jsonb) ->> 'floor')::int as f`);
  ok(knob.f === FLOOR, `db/pay-median.sql の壁（knob）も ${FLOOR}`, J(knob));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ T-Q9 1人は1回（本人の月々のまんなか1つ）・2社に出した人は両方に1人ずつ');
// ════════════════════════════════════════════════════════════
{
  // 人のまんなかの中央値・月をそのまま並べた中央値・人の平均が、3つとも違う数になる組
  const P1 = [[10000, 1], [11000, 2], [12000, 3]], P2 = [[20000, 1]], P3 = [[25000, 1]];
  await person(A_NINE, 'fo', P1);
  const p2 = await person(A_NINE, 'fo', P2);
  await person(A_NINE, 'fo', P3);
  await put(p2, A_NINE2, 'fo', 16000, 1);                    // 同じ人が別の会社にも出す
  await person(A_NINE2, 'fo', [[10000, 1]]);
  await person(A_NINE2, 'fo', [[30000, 1]]);
  const people = [midOf(P1.map(([g]) => g * 12)), P2[0][0] * 12, P3[0][0] * 12];
  const byPeople = await sig2(midOf(people));
  const byMonths = await sig2(midOf([...P1, ...P2, ...P3].map(([g]) => g * 12)));
  const byMean = await sig2(people.reduce((s, v) => s + v, 0) / people.length);
  must(new Set([byPeople, byMonths, byMean]).size === 3, '3つの決め方が同じ数になる組になっている', J([byPeople, byMonths, byMean]));
  const r = await cmp(SUBMITTER, { airlines: [A_NINE, A_NINE2] });
  const n1 = r.airlines && r.airlines[A_NINE] && r.airlines[A_NINE].fo;
  ok(n1 && n1.s === 'ok' && Number(n1.median_usd) === byPeople,
    `★3か月出した人も1人: 中央値は人のまんなかの ${byPeople}（月をそのまま並べると ${byMonths}・人の平均は ${byMean}）`, J(n1));
  const n2 = r.airlines && r.airlines[A_NINE2] && r.airlines[A_NINE2].fo;
  const want2 = await sig2(midOf([16000, 10000, 30000].map((g) => g * 12)));
  ok(n2 && n2.s === 'ok' && Number(n2.median_usd) === want2,
    `★2社に出した人はもう1社でも1人（その人が抜けると ${FLOOR}人に届かない）: ${want2}`, J(n2));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ T-Q10 口コミの年収・登録前の預かり・下ろした人・常識の幅の外・24か月より前の月は中央値を動かさない');
// ════════════════════════════════════════════════════════════
{
  for (const g of [10000, 15000, 20000]) await person(A_TEN, 'cap', [[g, 1]]);
  const med = async (who) => { const v = await cmp(who, { airlines: [A_TEN] }); return v.airlines && v.airlines[A_TEN] && v.airlines[A_TEN].cap; };
  const same = (a, b) => !!a && !!b && a.s === 'ok' && canon(a) === canon(b);
  const listedTen = async () => ((await payRows(SUBMITTER)).rows || []).filter((x) => x.airline === A_TEN).length;
  const BASEMED = await sig2(180000);
  const start = await med(SUBMITTER);
  must(!!start && start.s === 'ok' && Number(start.median_usd) === BASEMED, `3人で中央値が ${BASEMED} になっていない`, J(start));
  /* どれか1つでも入れば4人になり、中央値が動く額にしてある（上に入れば 210000・下に入れば 150000）。
     1つずつ「足す直前の答え」と比べる ── ほかの1つが崩れても、その1つの行だけが赤くなる。 */
  let before, n0;

  // (a) 口コミに書かれた年収（万円）
  const JPY = Number((await one(`select to_usd from public.fx_rates where code = 'JPY'`)).to_usd);
  const MAN = 8000;
  must(MAN * 10000 * JPY > 240000 && MAN * 10000 * JPY < 700000, '口コミの額が「入れば中央値が動く・常識の幅の中」になっていない', String(MAN * 10000 * JPY));
  const RV = await member();
  before = await med(SUBMITTER); n0 = await listedTen();
  await db.query(`insert into public.reviews_v2 (proof_hash, airline, "position", annual_salary)
                  values (public.pv_review_hash($1::uuid, $2), $2, 'captain', $3)`, [RV, A_TEN, MAN]);
  /* 口コミの年収は昔の口コミだけ（今は集めていない）。一覧がそれを読むための対応表は db/pay-rows.sql を
     流したときに埋まるので、置いてから流し直す（db/test-pay-rows.mjs と同じ）。 */
  await db.exec(read('db/pay-rows.sql'));
  must(await listedTen() === n0 + 1, '口コミの年収が REAL PAY の一覧に出ていない（前提）');
  ok(same(await med(SUBMITTER), before), '★口コミに書かれた年収は REAL PAY の一覧には出るが、中央値は動かない', J(await med(SUBMITTER)));

  // (b) 登録前の預かり（未ログインで出して、まだ引き取られていない）
  before = await med(SUBMITTER); n0 = await listedTen();
  /* 本番では回線（x-forwarded-for）から日ごとの印が付く。手元には回線が無いので、例示用のアドレスを1つ渡す。 */
  await as(ANON);
  let pend;
  try {
    await db.query(`select set_config('request.headers', $1, false)`, [J({ 'x-forwarded-for': '203.0.113.7' })]);
    pend = { v: (await db.query(`select public.submit_pay_report_pending($1::jsonb) as v`,
      [J({ ...BASE, airline: A_TEN, position: 'cap', period_year: ago(2).year, period_month: ago(2).month, gross_monthly: 45000 })])).rows[0] };
  } catch (e) { pend = { err: String(e.message || e) }; }
  finally { await db.query(`select set_config('request.headers', '', false)`); await asOwner(); }
  must(!pend.err, '預かりを作れなかった', pend.err || '');
  must(await listedTen() === n0 + 1, '預かりが REAL PAY の一覧に出ていない（前提）');
  ok(same(await med(SUBMITTER), before), '★登録前の預かりは REAL PAY の一覧には出るが、中央値は動かない', J(await med(SUBMITTER)));

  // (c) 常識の幅（年 1万〜70万ドル）の外 ── 上と下
  before = await med(SUBMITTER);
  await put(await member(), A_TEN, 'cap', 70000, 1);         // 年 84万ドル
  ok(same(await med(SUBMITTER), before), '★年 70万ドルを超える額は入らない', J(await med(SUBMITTER)));
  before = await med(SUBMITTER);
  await put(await member(), A_TEN, 'cap', 500, 1);           // 年 6千ドル
  ok(same(await med(SUBMITTER), before), '★年 1万ドルに届かない額は入らない', J(await med(SUBMITTER)));

  // (d) 24か月より前の月（いま出したので REAL PAY の一覧には出る ── 窓が違う）
  before = await med(SUBMITTER); n0 = await listedTen();
  await put(await member(), A_TEN, 'cap', 26000, 30);
  must(await listedTen() === n0 + 1, '昔の月を今出した行が REAL PAY の一覧に出ていない（前提）');
  ok(same(await med(SUBMITTER), before), '★給与の月が24か月より前なら、最近出した行でも中央値には入らない', J(await med(SUBMITTER)));

  // (e) 本人の依頼で下ろした人（pay_hidden）── 運営が呼んでも入らない
  before = await med(SUBMITTER);
  const hr = await put(await member(), A_TEN, 'cap', 30000, 1);
  const moved = await med(SUBMITTER);
  must(!!moved && moved.s === 'ok' && !same(moved, before), '下ろす前のこの人が数に入っていない（前提）', J([before, moved]));
  await db.query(`insert into public.pay_hidden (proof_hash, reason)
                  select r.proof_hash, '本人の依頼' from public.pay_reports r where r.id = $1::uuid
                  on conflict (proof_hash) do nothing`, [hr.id]);
  ok(same(await med(SUBMITTER), before), '★下ろした人は入らない（給与を出した会員が呼んだとき）', J(await med(SUBMITTER)));
  ok(same(await med(OPERATOR), before), '★運営が呼んでも下ろした人は入らない', J(await med(OPERATOR)));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ T-Q11 形の違う入力は {ok:false, state:"bad"}（鍵のある人）・打ち込まれた社名は当たった会社に入る');
// ════════════════════════════════════════════════════════════
{
  const BAD = canon({ ok: false, state: 'bad' });
  const CASES = [[{ airlines: [A_FLOOR, A_NINE, A_TEN] }, '3社'], [{ airlines: [A_FLOOR, A_FLOOR] }, '同じ会社2つ'],
                 [{ airlines: ['zz-no-such-airline'] }, '語彙に無い会社'], [{ airlines: [A_FLOOR, 'zz-no-such-airline'] }, '1社が語彙に無い'],
                 [{ airlines: ['other'] }, 'その他'], [{ airlines: A_FLOOR }, '配列でない'], [{ airlines: {} }, '中身が形'],
                 [{ airlines: [] }, '空の配列'], [{}, '会社の欄なし'], [null, 'null'], [undefined, '引数なし']];
  const got = [];
  for (const [p] of CASES) got.push(await cmp(SUBMITTER, p));
  ok(got.every((v) => canon(v) === BAD), `★${CASES.map(([, n]) => n).join('・')} はどれも bad だけ`,
    got.map((v, i) => CASES[i][1] + '=' + canon(v)).filter((s) => !s.endsWith(BAD)).join(' | '));
  const one1 = await cmp(SUBMITTER, { airlines: [A_FLOOR] }), two = await cmp(SUBMITTER, { airlines: [A_FLOOR, A_NINE] });
  ok(one1.state === 'open' && keys(one1.airlines) === A_FLOOR && two.state === 'open' && keys(two.airlines) === [A_FLOOR, A_NINE].sort().join(','),
    '1社でも2社でも open（聞いた会社だけが返る）', J([keys(one1.airlines), keys(two.airlines)]));

  // 「その他」で打ち込まれた社名が一覧の会社に当たるなら、その会社の1人
  const NAME = (await one(`select name_ja from public.pv_airlines where code = $1`, [A_RES])).name_ja;
  must((await one(`select public.pv_airline_resolve($1) as c`, [NAME])).c === A_RES, '打ち込む社名がその会社に当たらない', NAME);
  await person(A_RES, 'cap', [[10000, 1]]);
  await person(A_RES, 'cap', [[20000, 1]]);
  must(canon((await cmp(SUBMITTER, { airlines: [A_RES] })).airlines[A_RES].cap) === canon({ s: 'few' }), '2人で few になっていない（前提）');
  await put(await member(), 'other', 'cap', 15000, 1, { airline_other: NAME });
  const c = (await cmp(SUBMITTER, { airlines: [A_RES] })).airlines[A_RES].cap;
  ok(c && c.s === 'ok' && Number(c.median_usd) === await sig2(180000),
    '★「その他」で打ち込まれた社名が一覧の会社に当たれば、その会社の1人として数える', J(c));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ T-Q12 見られる人は結果で突き合わせる: pv_company_pay が open ⇔ pv_pay_rows が open');
// ════════════════════════════════════════════════════════════
{
  const WHO = [[MEMBER, '給与を出していない会員', 'locked'], [REVIEWER, '口コミだけの会員', 'locked'],
               [SUBMITTER, '給与を出した会員', 'open'], [EXPIRED, '鍵の切れた会員', 'locked'],
               [TRAP, '鍵の日付だけ動いた会員', 'locked'], [OPERATOR, '運営', 'open']];
  for (const [who, name, want] of WHO) {
    const a = (await payRows(who)).state, b = (await cmp(who, { airlines: [A_FLOOR, A_NINE] })).state;
    ok(a === want && b === want, `★${name}: REAL PAY ${a} ／ 比較の中央値 ${b}（どちらも ${want}）`);
  }
  const g = await cmp(ANON, { airlines: [A_FLOOR] });
  ok(!!g.__err && /permission denied/i.test(g.__err) && (await payRows(ANON)).state === 'locked',
    '★未ログインは比較の中央値を呼べない（REAL PAY は locked）', J(g));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ T-Q12b 写真で止められた会員（main を合流したあと）');
// ════════════════════════════════════════════════════════════
{
  const has = (await one(`select to_regprocedure('public.pv_proof_blocked()') is not null as b`)).b;
  if (!has) console.log('  ・ この枝には止める仕組みが無い（見送り）');
  else {
    /* 合流のとき: main の写真の検査が「止められた会員」を作るやり方を、ここに1つだけ入れる（いまは何もしない）。
       作れていなければ下の準備の確かめが赤くなる＝確かめないまま緑にはならない。 */
    const blockMember = async (id) => { void id; };
    const PB = await member();
    await put(PB, A_READ, 'cap', 14000);
    await blockMember(PB);
    await db.query(`select set_config('pv.uid', $1, false)`, [PB]);
    let blocked;
    try { blocked = (await one(`select public.pv_proof_blocked() as b`)).b; } finally { await asOwner(); }
    must(blocked === true, '止められた会員を作れていない（合流のとき、main の作り方を blockMember に入れる）', J(blocked));
    const a = (await payRows(PB)).state, b = (await cmp(PB, { airlines: [A_FLOOR] })).state;
    ok(a === b, `★止められた会員（鍵は生きている）: REAL PAY ${a} ／ 比較の中央値 ${b}（同じ答え）`);
  }
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ T-Q13 返事の形・実行権・末尾の検算');
// ════════════════════════════════════════════════════════════
{
  const r = await cmp(SUBMITTER, { airlines: [A_FLOOR, A_EMPTY] });
  ok(keys(r) === 'airlines,floor,ok,period,state' && r.ok === true && r.state === 'open',
    '★開いた返事のキーはちょうど ok / state / period / floor / airlines', keys(r));
  const from = ym(ago(23)), to = ym(ago(0));
  ok(keys(r.period) === 'from,to' && r.period.from === from && r.period.to === to,
    `期間は給与の月で ${from} 〜 ${to}（当月を含む24か月）`, J(r.period));
  ok(canon(r.airlines[A_EMPTY]) === canon({ cap: { s: 'few' }, fo: { s: 'few' } }),
    '投稿の無い会社も2職位とも {s:"few"}（どこに数字が在るかを形で教えない）', J(r.airlines[A_EMPTY]));
  const firms = SEEN.filter((v) => v && v.state === 'open').flatMap((v) => Object.values(v.airlines || {}));
  ok(firms.length > 0 && firms.every((a) => keys(a) === 'cap,fo'),
    `これまでの開いた返事の会社（${firms.length}社ぶん）はどれも機長と副操縦士の2つだけ`, J(firms.filter((a) => keys(a) !== 'cap,fo').slice(0, 2)));
  const cells = firms.flatMap((a) => [a.cap, a.fo]);
  const cellOk = (c) => !!c && typeof c === 'object'
    && ((c.s === 'few' && keys(c) === 's') || (c.s === 'ok' && keys(c) === 'median_usd,s' && Number(c.median_usd) > 0));
  ok(cells.length > 0 && cells.every(cellOk),
    `★これまでの開いた返事の区分（${cells.length}個）はどれも {s} か {s, median_usd} だけ`, J(cells.filter((c) => !cellOk(c)).slice(0, 3)));
  const leak = SEEN.map((v) => J(v)).filter((s) => /"(people|records|p25_usd|p75_usd|band_floor|groups|months|human)"/.test(s));
  ok(SEEN.length > 0 && leak.length === 0, `★比較の口の返事（${SEEN.length}通）のどれにも人数・件数・幅のキーが無い`, leak.slice(0, 2).join(' | '));

  const priv = await one(`
    select has_function_privilege('anon', 'public.pv_company_pay(jsonb)', 'execute') as c_anon,
           has_function_privilege('authenticated', 'public.pv_company_pay(jsonb)', 'execute') as c_auth,
           exists (select 1 from pg_proc q, lateral aclexplode(coalesce(q.proacl, acldefault('f', q.proowner))) a
                    where q.oid = 'public.pv_company_pay(jsonb)'::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE') as c_public,
           has_function_privilege('anon', 'public.pv_pay_medians(jsonb)', 'execute') as m_anon,
           has_function_privilege('authenticated', 'public.pv_pay_medians(jsonb)', 'execute') as m_auth,
           exists (select 1 from pg_proc q, lateral aclexplode(coalesce(q.proacl, acldefault('f', q.proowner))) a
                    where q.oid = 'public.pv_pay_medians(jsonb)'::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE') as m_public`);
  ok(priv.c_anon === false && priv.c_auth === true && priv.c_public === false,
    '★pv_company_pay を呼べるのはログイン済みだけ（未ログイン・PUBLIC には渡っていない）', J(priv));
  ok(priv.m_anon === false && priv.m_auth === false && priv.m_public === false,
    '★pv_pay_medians は誰にも渡っていない', J(priv));
  const direct = await call(SUBMITTER, `select public.pv_pay_medians($1::jsonb) as v`, [J({ x: [A_FLOOR] })]);
  ok(denied(direct), '★鍵の生きている会員でも pv_pay_medians を直接は呼べない（人数の入った返事に届かない）', J(direct));
  ok(denied(await call(ANON, `select public.pv_company_pay($1::jsonb) as v`, [J({ airlines: [A_FLOOR] })])),
    '未ログインは pv_company_pay を呼べない（実行権が無い）');

  for (const f of [MINE, MEDIAN]) {
    const src = read(f);
    const tail = src.slice(src.lastIndexOf('\nwith d as ('));
    const rows = await many(tail);
    const bad = rows.filter((x) => x['結果'] !== '✅');
    ok(rows.length === 6 && bad.length === 0, `★${f} の末尾の検算 6行が全部 ✅`, J(bad.length ? bad : rows.length));
  }
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
