/* db/test-follow.mjs — 気になる会社のフォローと、新着の知らせ（db/follow.sql ＋ supabase/functions/follow-notify）

   実行: node db/test-follow.mjs   （check.mjs sql にも入っている）。ネットワーク不要・本番に一切触らない（PGlite・fetch は差し替え）。

   守っているもの（2026-11-07 オーナー採用）
     A) フォローの口 ── 自分の会社は最初からフォロー済み・外せる（印だけ残す）・付け直せる・10社まで・一覧に無い会社は断る・
        自分の分しか触れない（未ログインは呼べない・表は直接読めない・送る相手は呼べない）
     B) 知らせる相手 ── 給与・口コミ・待遇の答えのどれが入ったかだけを返す（件数・金額・誰が出したかは返さない）・
        ★出した本人には知らせない・通知を外した人／確認待ちで止めた会員には送らない・テスト用アカウント／幅の外の給与／
        一覧から下ろした人／スキップ・「わからない」は数えない・フォローする前と数え始めより前は数えない・
        ★入った日の分は次の日の17時（受け取る人の国の時間）に1通・1人1日1通・国 → 時間帯・3回失敗でその日は諦める・退会で消える
     C) 壊す証明 ── 本人を外す数行を抜くと、本人に知らせが行く＝B が赤くなる
     D) メール ── 言語の決め方が歓迎メールと同じ・数字を書かない・ページのある会社だけリンク・1人1日1通の鍵・解除の口
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import { createHash } from 'node:crypto';
import { SQL_FILES } from '../serve-local.mjs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const MINE = 'db/follow.sql';

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
must(['db/member-median.sql', 'db/pilot-proof.sql', 'db/reviews-gate.sql', 'db/airline-conditions.sql', 'db/profile-lang.sql']
  .every((f) => SQL_FILES.indexOf(MINE) > SQL_FILES.indexOf(f)), `${MINE} は名簿・確認・口コミ・待遇・言語のあと`);
for (const f of SQL_FILES) {
  try { await db.exec(read(f)); } catch (e) { ok(false, f, e.message); process.exit(1); }
}
ok(true, `SQL を ${SQL_FILES.length} 本流した（最後が ${MINE}）`);
const FOLLOW = read(MINE);
const checks = (await db.query(FOLLOW.slice(FOLLOW.indexOf("select case when to_regclass('public.pv_follow')")))).rows.map((r) => r['検算']);
ok(checks.filter((c) => c.startsWith('✅')).length === 6 && !checks.some((c) => c.startsWith('❌')), '末尾の検算が全部 ✅（時計の無い所は ℹ️）', checks.join(' / '));
try { await db.exec(FOLLOW); ok(true, 'もう一度貼っても同じ（冪等）'); } catch (e) { ok(false, '再適用で失敗', e.message); }

// ── 道具 ─────────────────────────────────────────────────────
const ANON = Symbol('anon');
const as = async (who) => {
  await db.exec(who === ANON ? `set role anon` : `set role authenticated`);
  await db.query(`select set_config('pv.uid', $1, false)`, [typeof who === 'string' ? who : '']);
};
const asOwner = async () => { await db.exec(`reset role`); await db.query(`select set_config('pv.uid', '', false)`); };
const call = async (who, sql, params = []) => {
  await as(who);
  try { const r = await db.query(sql, params); return { rows: r.rows }; }
  catch (e) { return { err: String(e.message || e) }; }
  finally { await asOwner(); }
};
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let seat = 0;
const member = async ({ company = null, opt = true, lang = 'ja', name = null, ago = '2 hours', country = null } = {}) => {
  const id = uid(++seat), mail = `crew${seat}@example.com`;
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, mail]);
  await db.query(`insert into public.profiles (id, email, company, email_opt_in, name, created_at) values ($1,$2,$3,$4,$5, now() - $6::interval)
                  on conflict (id) do update set company = excluded.company, email_opt_in = excluded.email_opt_in, name = excluded.name, created_at = excluded.created_at`,
    [id, mail, company, opt, name, ago]);
  await db.query(`update public.profiles set lang = $2, country = $3 where id = $1`, [id, lang, country]);
  return id;
};
const sha = (s) => createHash('sha256').update(s).digest('hex');
const payKey = (id, airline) => sha(`${id}::pv_pay::${airline}`);
const reviewKey = (id, airline) => sha(`${id}::pv_anon::${airline}::2026`);
const condKey = (id, airline) => sha(`${id}::pv_cond::${airline}`);
const NOW = await one(`select extract(year from current_date)::int as y, extract(month from current_date)::int as m`);
/* 新着を1件入れる（時刻を決められる）。給与は本物の submit_pay_report をその会員として通してから、時刻と年収だけ持ち主として書き換える。 */
let seq = 0;
const BASE = { currency: 'USD', lang: 'en', tax_rate_pct: 0, fleet: 'a320', gross_monthly: 9000 };
/* at は「いまから何分前」（文字）か、決まった時刻（Date）。 */
const when = (at, n) => (at instanceof Date ? `$${n}::timestamptz` : `now() - $${n}::interval`);
const pay = async (who, airline, { at = '5 minutes', usd = 120000 } = {}) => {
  seq++;
  const t = (NOW.y * 12 + NOW.m - 1) - seq;   // 同じ人でも月を変えて別の行に
  const body = { ...BASE, airline, position: 'cap', period_year: Math.floor(t / 12), period_month: (t % 12) + 1 };
  const r = await call(who, `select public.submit_pay_report($1::jsonb) as v`, [J(body)]);
  await db.exec(`update public.profiles set pay_reports_today = 0`);
  must(!r.err && r.rows[0].v && r.rows[0].v.ok !== false, `給与を出せなかった（${airline}）`, r.err || J(r.rows && r.rows[0]));
  const u = await db.query(`update public.pay_reports set annual_total_usd = $1, created_at = ${when(at, 2)}
                             where proof_hash = $3 and period_year = $4 and period_month = $5`,
    [usd, at, payKey(who, airline), body.period_year, body.period_month]);
  must(u.affectedRows === 1, `給与の行を見つけられない（${airline}）`);
};
/* 知らせが飛ぶ新着を1件（口コミ）。時刻の検査はこれで作る（給与は 2026-11-12 から新着に数えない）。 */
const news = async (who, airline, { at = '5 minutes' } = {}) => review(who, airline, at);
const review = async (who, airline, at = '5 minutes') =>
  db.query(`insert into public.reviews_v2 (proof_hash, airline, "position", created_at) values ($1, $2, 'fo', ${when(at, 3)})`,
    [reviewKey(who, airline), airline, at]);
const cond = async (who, airline, { at = '5 minutes', skip = false, unknown = false, q = 'annual_leave_days' } = {}) =>
  db.query(`insert into public.airline_conditions (proof_hash, airline, question_id, answer_num, answer_code, skipped_at, effective_year, effective_month, created_at)
            values ($1, $2, $3, $4, $5, $6, $7, $8, now() - $9::interval)`,
    [condKey(who, airline), airline, q, skip || unknown ? null : 20, unknown ? 'unknown' : null, skip ? new Date().toISOString() : null, NOW.y, NOW.m, at]);
const my = async (who) => { const r = await call(who, `select public.pv_my_follows() as v`); return r.err ? { err: r.err } : r.rows[0].v; };
const set = async (who, code, on) => { const r = await call(who, `select public.pv_follow_set($1, $2) as v`, [code, on]); return r.err ? { err: r.err } : r.rows[0].v; };
const codes = (v) => (v && v.list ? v.list.map((x) => x.code) : []);
/* ★送るのは「次の日の17時（受け取る人の国の時間）」なので、検査の時計を決めて呼ぶ。
   wall(tz, d, 'hh:mm') ＝ その国で、今日から d 日後の hh:mm。nextDay17(tz, t) ＝ t の次の日の17時（その国で）。
   CLOCK ＝ 明日の17時30分（日本）＝ いまより前に入った分は全部「前の日まで」になる時刻。 */
const TOKYO = 'Asia/Tokyo';
const wall = async (tz, d, hm) => (await one(`select (date_trunc('day', now() at time zone $1) + $2::interval) at time zone $1 as t`, [tz, `${d} days ${hm}`])).t;
const nextDay17 = async (tz, t) => (await one(`select (date_trunc('day', $2::timestamptz at time zone $1) + interval '1 day 17 hours') at time zone $1 as t`, [tz, t])).t;
const CLOCK = await wall(TOKYO, 1, '17:30');
const due = async (at = CLOCK) => (await db.query(`select * from public.pv_follow_due(200, $1)`, [at])).rows;
const itemsOf = async (who, at = CLOCK) => { const r = (await due(at)).find((x) => x.id === who); return r ? r.items : null; };
const kindsOf = async (who, code, at = CLOCK) => { const it = await itemsOf(who, at); const x = it && it.find((i) => i.code === code); return x ? x.kinds : null; };
/* 送れた／送れなかった。Edge Function と同じく、送る相手の行の upto（どこまでの新着か）を渡す。 */
const mark = async (who, okv, at = CLOCK) => {
  const r = (await due(at)).find((x) => x.id === who);
  return db.query(`select public.pv_follow_mark($1, $2, $3)`, [who, okv, r ? r.upto : null]);
};
const reset = async () => {
  await db.exec(`delete from public.pay_reports; delete from public.reviews_v2; delete from public.airline_conditions; delete from public.pv_follow_mail;`);
  await db.exec(`update public.pv_follow_launch set at = now() - interval '1 day'`);
};

// ════════════════ A) フォローの口（会員が呼ぶ） ════════════════
console.log('\n▼ A フォローの口');
await reset();
const A = await member({ company: 'ana' });
let v = await my(A);
ok(v.ok && JSON.stringify(codes(v)) === '["ana"]' && v.list[0].own === true && v.list[0].ja === '全日本空輸（ANA）' && v.list[0].page === true,
   '★自分の会社（登録の会社）は最初からフォロー済み（会社名とページの有無も返す）', J(v));
v = await set(A, 'jal', true);
ok(JSON.stringify(codes(v)) === '["ana","jal"]' && v.list[1].own === false, '会社をフォローできる（自分の会社が先頭）', J(codes(v)));
v = await set(A, 'jal', false);
ok(JSON.stringify(codes(v)) === '["ana"]' && !(await one(`select 1 x from public.pv_follow where uid=$1 and airline='jal'`, [A])),
   'ほかの会社を外すと、記録ごと消える');
v = await set(A, 'ana', false);
ok(codes(v).length === 0 && (await one(`select following from public.pv_follow where uid=$1 and airline='ana'`, [A]))?.following === false,
   '自分の会社も外せる（外した印だけが残る）');
v = await set(A, 'ana', true);
ok(JSON.stringify(codes(v)) === '["ana"]' && !(await one(`select 1 x from public.pv_follow where uid=$1 and airline='ana'`, [A])),
   '付け直すと印が消えて、最初からフォロー済みの状態に戻る');
for (const bad of ['other', 'no-such-air', null]) {
  v = await set(A, bad, true);
  ok(v.ok === false && v.reason === 'bad_airline', `一覧に無い会社・その他はフォローできない（${bad}）`);
}
await db.query(`update public.pv_airlines set active = false where code = 'zipair'`);
v = await set(A, 'zipair', true);
ok(v.reason === 'bad_airline', '今は無い会社（active でない）はフォローできない');
await db.query(`update public.pv_airlines set active = true where code = 'zipair'`);
const many = (await db.query(`select code from public.pv_airlines where active and code not in ('other','ana') and cap_lo is not null order by code limit 10`)).rows.map((r) => r.code);
for (const c of many.slice(0, 9)) await set(A, c, true);
v = await my(A);
ok(codes(v).length === 10, '10社までフォローできる（自分の会社を含めて）', J(codes(v)));
v = await set(A, many[9], true);
ok(v.ok === false && v.reason === 'too_many' && v.max === 10, '11社目は断る（too_many）');
v = await set(A, many[0], true);
ok(v.ok === true, 'すでにフォロー中の会社をもう一度押しても、断らない');
for (const c of many.slice(0, 9)) await set(A, c, false);
const B = await member({ company: 'Foo Air 123' });
v = await my(B);
ok(v.ok && codes(v).length === 0, '語彙に当たらない社名の会員：自分の会社のフォローは無い');
ok(!JSON.stringify(await my(B)).includes('ana'), 'ほかの会員のフォローは見えない（自分の分だけ返る）');
v = await my(ANON);
ok(v.err && /permission denied/.test(v.err), '未ログイン（anon）は呼べない', J(v));
v = await call(A, `select * from public.pv_follow`);
ok(v.err && /permission denied/.test(v.err), '会員でも、フォローの表を直接は読めない');
v = await call(A, `select * from public.pv_follow_due(5, now())`);
ok(v.err && /permission denied/.test(v.err), '会員は、送る相手を呼べない');
v = await call(A, `insert into public.pv_follow(uid, airline, following) values ('${B}', 'jal', true)`);
ok(v.err && /permission denied/.test(v.err), '会員は、ほかの人のフォローを書けない');

// ════════════════ B) 知らせる相手と中身 ════════════════
console.log('\n▼ B 知らせる相手（pv_follow_due）');
await reset();
const R1 = await member({ company: 'ana' });                    // ANA の会員（自分の会社）
const R2 = await member({ company: 'jal' });                    // JAL の会員。ANA をフォロー
await set(R2, 'ana', true);
const R3 = await member({ company: 'ana', opt: false });        // 通知を外した
const R4 = await member({ company: 'ana' });                    // 確認待ちで止めた
await db.query(`insert into public.pv_proof (user_id, state) values ($1, 'required')`, [R4]);
const AU = await member({ company: 'ana' });                    // 書いた本人（ANA の会員）
const T = await member({ company: 'jal' });                     // テスト用アカウント
await db.query(`insert into public.pv_test_users (uid) values ($1)`, [T]);
await db.query(`update public.pv_follow set updated_at = now() - interval '1 hour' where uid = $1`, [R2]);

ok((await due()).length === 0, '新着が無ければ、誰にも送らない');
/* ★2026-11-12 オーナー指示「出しづらいからメールなしにして。給与投稿はいらない」＝ 給与では誰にも知らせない。 */
await pay(AU, 'ana'); await pay(AU, 'ana');
ok((await due()).length === 0, '★給与が入っても、誰にも知らせない（同じ会社の会員にも・フォローしている会員にも・2か月目でも）');
await news(AU, 'ana');
ok(JSON.stringify(await kindsOf(R1, 'ana')) === '["review"]', 'ANA に口コミが入った → 自分の会社が ANA の会員に「口コミ」');
ok(JSON.stringify(await kindsOf(R2, 'ana')) === '["review"]', '→ ANA をフォローしている会員にも「口コミ」');
ok((await itemsOf(AU)) === null, '★出した本人には知らせない（同じ会社の会員でも）');
ok((await itemsOf(R3)) === null, '通知を外した人には送らない');
ok((await itemsOf(R4)) === null, '確認待ちで止めた会員には送らない');
await cond(AU, 'ana');
ok((await itemsOf(AU)) === null, '★本人の口コミ・待遇の答えでも、本人には知らせない');
const RV = await member({ company: 'jal' });
await review(RV, 'ana');
const CD = await member({ company: 'jal' });
await cond(CD, 'ana');
await pay(RV, 'ana');
ok(JSON.stringify(await kindsOf(R1, 'ana')) === '["review","cond"]', '口コミ・待遇の答えは「何が入ったか」だけ返す（口コミ→待遇の順）。★ほかの人の給与が入っていても「給与」は出ない');
const row = (await due()).find((x) => x.id === R1);
ok(Object.keys(row).join(',') === 'id,email,name,country,airline_region,lang,unsub_token,has_key,items,upto'
   && Object.keys(row.items[0]).sort().join(',') === 'code,conds,en,ja,kinds,page,reviews,why', '★返す欄は決まった形だけ（会社・何が入ったか・口コミの抜粋・待遇の質問名）', J(row.items));
ok(!/"(annual|usd|gross|amount|net|salary|proof|hash|email|uid)[a-z_]*":/i.test(J(row.items)), '★給与の金額も、誰が出したかも返さない（そういう欄が1つも無い）', J(row.items));
ok(row.items[0].conds.length === 1 && row.items[0].conds[0].ja === '年間の有給休暇は何日ですか？', '待遇は答えが入った質問の名前だけ（答えは返さない）', J(row.items[0].conds));
ok(row.has_key === false, '給与の鍵が無い会員は has_key が偽');

console.log('\n▼ B-2 数えないもの');
await reset();
await cond(CD, 'jal', { skip: true });
await cond(RV, 'jal', { unknown: true });
ok((await kindsOf(R2, 'jal')) === null, '待遇の質問をスキップした行・「わからない」の答えは数えない');
await pay(T, 'jal'); await review(T, 'jal'); await cond(T, 'jal', { q: 'sick_leave_days' });
ok((await kindsOf(R2, 'jal')) === null, 'テスト用アカウントの給与・口コミ・待遇の答えでは知らせない');
await pay(RV, 'jal');
ok((await kindsOf(R2, 'jal')) === null, '★ふつうの会員の、幅の中の給与でも数えない（給与は新着ではない）');
await db.query(`insert into public.pv_review_pending (airline, created_at) select 'jal', now() where false`);   // 形だけ（列が変わったら下で落ちる）
await db.query(`delete from public.pay_hidden`);
await reset();

console.log('\n▼ B-3 いつから数えるか');
await news(RV, 'ana', { at: '2 hours' });       // R2 が ANA をフォローする前
ok((await kindsOf(R2, 'ana')) === null && JSON.stringify(await kindsOf(R1, 'ana')) === '["review"]',
   'フォローする前の新着では知らせない（自分の会社は登録した時刻から）');
await db.exec(`update public.pv_follow_launch set at = now()`);
ok((await itemsOf(R1)) === null, '数え始め（ファイルを初めて貼った時刻）より前の新着では知らせない');
await db.exec(`update public.pv_follow_launch set at = now() - interval '1 day'`);

console.log('\n▼ B-4 次の日の17時（受け取る人の国の時間）に1通（2026-11-09 オーナー指示）');
await reset();
const T1 = await wall(TOKYO, 1, '10:00');                     // 明日の10時（日本）に給与が入る
await news(RV, 'ana', { at: T1 });
ok((await itemsOf(R1, await wall(TOKYO, 1, '23:59'))) === null, '★入った日のうちは送らない（17時を過ぎても、その日の分は次の日に回す）');
ok((await itemsOf(R1, await wall(TOKYO, 2, '16:59'))) === null, '★次の日も17時より前は送らない');
const S2 = await wall(TOKYO, 2, '17:00');
ok(J(await kindsOf(R1, 'ana', S2)) === '["review"]', '★次の日の17時（日本時間）に送る');
const r1 = (await due(S2)).find((x) => x.id === R1);
ok(r1 && new Date(r1.upto).getTime() === (await wall(TOKYO, 2, '00:00')).getTime(), 'upto ＝ 受け取る人の国の、その日の0時（ここまでの新着を送った）', J(r1 && r1.upto));
await mark(R1, true, S2);
ok((await itemsOf(R1, await wall(TOKYO, 2, '18:00'))) === null && (await itemsOf(R1, await wall(TOKYO, 2, '23:59'))) === null,
   '送ったら、その日はもう送らない（1日1通）');
await review(CD, 'ana', await wall(TOKYO, 2, '12:00'));       // 送った日の昼に入った口コミ
{ const it = ((await itemsOf(R1, await wall(TOKYO, 3, '17:00'))) || []).find((i) => i.code === 'ana');
  ok(it && J(it.kinds) === '["review"]' && it.reviews.length === 1, '送った日に入った分は次の日の1通に（前の1通の口コミは二度と入らない）', J(it)); }

await reset();
await db.query(`insert into public.pv_follow_mail (uid, sent_at, tries, tried_at) values ($1, $2, 0, $2)`, [R1, await wall(TOKYO, 1, '23:07')]);
await review(RV, 'ana', await wall(TOKYO, 1, '23:02'));
await news(CD, 'ana', { at: await wall(TOKYO, 1, '23:30') });
{ const it = ((await itemsOf(R1, await wall(TOKYO, 2, '17:00'))) || []).find((i) => i.code === 'ana');
  ok(it && J(it.kinds) === '["review"]' && it.reviews.length === 1, '17時に変える前に送った人（upto が空）は、送った時刻より後の分だけ（同じ投稿を二度知らせない）'); }

await reset();
const US = await member({ company: 'ana', country: 'アメリカ' });
await news(RV, 'ana', { at: T1 });
const usAt = await nextDay17('America/Chicago', T1);
ok((await itemsOf(R1, await nextDay17(TOKYO, T1))) !== null && (await itemsOf(US, await nextDay17(TOKYO, T1))) === null,
   '★日本の17時には、日本の会員に送り、アメリカの会員には送らない');
ok((await itemsOf(US, new Date(usAt.getTime() - 60e3))) === null && J(await kindsOf(US, 'ana', usAt)) === '["review"]',
   '★アメリカの会員には、向こうの次の日の17時に送る（日の区切りも向こうの0時）');

await reset();
await news(RV, 'ana', { at: '30 minutes' });
await mark(R2, false); await mark(R2, false);
ok((await itemsOf(R2)) !== null, '2回失敗：まだ送る');
await mark(R2, false);
await db.query(`update public.pv_follow_mail set tried_at = $2 where uid = $1`, [R2, CLOCK]);   // 検査の時計に合わせる（今日の17時より後に3回失敗した）
ok((await itemsOf(R2)) === null, '続けて3回失敗したら、その日は諦める');
ok((await itemsOf(R2, await wall(TOKYO, 2, '17:00'))) !== null, '次の日の17時に、もう一度送る');
await db.query(`delete from public.profiles where id = $1`, [R2]);
ok(!(await one(`select 1 x from public.pv_follow where uid = $1`, [R2])) && !(await one(`select 1 x from public.pv_follow_mail where uid = $1`, [R2])),
   '退会したら、フォローも送った記録も消える');

console.log('\n▼ B-5 口コミの抜粋（サイトで見せている範囲だけ）');
await reset();
await db.query(`insert into public.reviews_v2 (proof_hash, airline, "position", tenure_bucket, culture_score, salary_score, wlb_score,
                  culture_comment, salary_comment, created_at)
                values ($1, 'ana', 'cap', '5-10', 4, 3, 5, $2, $3, now() - interval '5 minutes')`,
  [reviewKey(RV, 'ana'), 'あ'.repeat(60), 'い'.repeat(200)]);
const rvi = (await itemsOf(R1)).find((i) => i.code === 'ana').reviews[0];
const ORDER = ['culture', 'salary', 'benefits', 'wlb', 'ops', 'training', 'mgmt'];
const txt = ORDER.map((k) => rvi.text[k + '_comment'] || '').join('');
ok(rvi.score === 4 && rvi.pos_ja && rvi.tenure === '5-10', '評価（3つの点の平均）・職位・在籍年数を返す', J(rvi));
ok(txt.replace(/…$/, '').length <= 80 && txt.startsWith('あ'.repeat(60)) && !txt.includes('い'.repeat(30)),
   '★本文は最初の80字まで（それより先は1文字も返さない）', txt.length + ' ' + txt.slice(0, 90));
const site80 = (await one(`select public.pv_review_fill(to_jsonb(v), '_comment', 80) as j from public.reviews_v2 v where v.proof_hash = $1`, [reviewKey(RV, 'ana')])).j;
ok(J(rvi.text) === J(site80), 'サイトの抜粋（pv_review_fill・80字）と1文字も違わない');
await db.query(`update public.profiles set access_until = now() + interval '30 days' where id = $1`, [R1]);
ok((await due()).find((x) => x.id === R1).has_key === true, '給与の鍵が生きている会員は has_key が真（メールで REAL PAY へ案内する）');
await db.query(`update public.profiles set access_until = null where id = $1`, [R1]);

console.log('\n▼ B-6 見た会社（フォローしていなくても）');
await reset();
const V = await member({ company: 'jal' });
v = await call(ANON, `select public.pv_follow_seen('emirates') as v`);
ok(v.err && /permission denied/.test(v.err), '未ログインは見た記録を書けない');
let sv = (await call(V, `select public.pv_follow_seen('emirates') as v`)).rows[0].v;
ok(sv.ok === true && JSON.stringify((await my(V)).seen.map((x) => x.code)) === '["emirates"]', '会社ページを見ると「最近見た会社」に入る', J(await my(V)));
ok(JSON.stringify(codes(await my(V))) === '["jal"]', '見た会社はフォローの一覧（と10社の数）には入らない');
await db.query(`update public.pv_follow_view set viewed_at = now() - interval '1 hour' where uid = $1`, [V]);
await news(RV, 'emirates', { at: '2 hours' });
ok((await kindsOf(V, 'emirates')) === null, '見る前の新着では知らせない');
await news(CD, 'emirates', { at: '10 minutes' });
const vi = (await itemsOf(V)) || [];
ok(vi.length === 1 && vi[0].code === 'emirates' && vi[0].why === 'seen' && J(vi[0].kinds) === '["review"]', '★見たあとに入った新着は知らせる（why は seen）', J(vi));
await set(V, 'emirates', true);
ok((await itemsOf(V)).filter((i) => i.code === 'emirates').length === 1 && (await my(V)).seen.length === 0, 'フォローしたら、見た会社と二重にならない');
await set(V, 'emirates', false);
await db.query(`update public.pv_follow_view set viewed_at = now() - interval '31 days' where uid = $1`, [V]);
ok((await my(V)).seen.length === 0 && (await itemsOf(V)) === null, '30日たった見た記録は使わない（一覧にも知らせにも）');
const many2 = (await db.query(`select code from public.pv_airlines where active and code not in ('other','jal') order by code limit 12`)).rows.map((r) => r.code);
for (const c of many2) { await call(V, `select public.pv_follow_seen($1) as v`, [c]); await db.query(`update public.pv_follow_view set viewed_at = viewed_at - interval '1 second' where uid = $1`, [V]); }
ok((await one(`select count(*)::int n from public.pv_follow_view where uid = $1`, [V])).n === 10, '見た記録は1人10社まで（古いものから消える）');
v = await call(V, `select public.pv_follow_unsee($1) as v`, [many2[11]]);
ok(!v.err && !(await my(V)).seen.some((x) => x.code === many2[11]), '「最近見た会社」から1社ずつ消せる');
v = await call(V, `select public.pv_follow_unsee(null) as v`);
ok(!v.err && (await my(V)).seen.length === 0, 'まとめて消せる');
v = await call(V, `select * from public.pv_follow_view`);
ok(v.err && /permission denied/.test(v.err), '会員でも、見た記録の表を直接は読めない（ほかの人が何を見たかは見えない）');

console.log('\n▼ B-7 国 → 時間帯（pv_follow_tz）');
{
  const vals = new Set();
  for (const f of ['signup.html', 'en/signup.html', 'es/signup.html', 'profile.html', 'en/profile.html', 'es/profile.html']) {
    const sel = read(f).match(/<select[^>]*id="(?:s2|e)-country"[^>]*>([\s\S]*?)<\/select>/);
    if (!must(sel, `${f} に国の選択肢が見つからない`)) continue;
    for (const m of sel[1].matchAll(/<option(?:\s+value="([^"]*)")?[^>]*>([^<]*)/g)) vals.add(m[1] !== undefined ? m[1] : m[2].trim());
  }
  vals.delete('');
  const bad = [];
  for (const c of vals) {
    let r;
    try { r = await one(`select public.pv_follow_tz($1) as z, (now() at time zone public.pv_follow_tz($1)) is not null as valid`, [c]); }
    catch (e) { bad.push(`${c}（時間帯の名前が無い: ${e.message}）`); continue; }
    if (r.z === TOKYO && !['日本', 'その他'].includes(c)) bad.push(c);
  }
  ok(vals.size >= 20 && bad.length === 0,
     `★登録・プロフィールの国の選択肢（日英西・${vals.size}）は全部、その国の時間帯に当たる（足した国を忘れると日本時間で届く）`, bad.join(', '));
  ok((await one(`select public.pv_follow_tz(null) a, public.pv_follow_tz('その他') b, public.pv_follow_tz('アメリカ') c`)).a === TOKYO
     && (await one(`select public.pv_follow_tz('その他') b`)).b === TOKYO
     && (await one(`select public.pv_follow_tz('アメリカ') c`)).c === 'America/Chicago',
     '国が空・「その他」は日本時間・アメリカは中部時間');
}

// ════════════════ C) 壊す証明 ════════════════
console.log('\n▼ C 壊す証明');
{
  const broken = FOLLOW.replace(/       -- ★自分が出した分では知らせない[\s\S]*?else               public\.pv_condition_hash\(w\.id, l\.airline, null\) end\)\n/, () => '');
  ok(broken !== FOLLOW, '（準備）「自分が出した分では知らせない」の数行を抜いた版を作れた');
  await db.exec(broken.slice(0, broken.indexOf('-- ── 6. 1時間おきの時計')));
  await reset();
  await news(AU, 'ana');
  ok((await itemsOf(AU)) !== null, '抜いた版では、出した本人にも知らせが行く＝B の「出した本人には知らせない」が赤くなる');
  await db.exec(FOLLOW.slice(0, FOLLOW.indexOf('-- ── 6. 1時間おきの時計')));
}
{
  const broken = FOLLOW.replace(/\n       and e\.at < w\.cut[^\n]*/, () => '');
  ok(broken !== FOLLOW, '（準備）「今日入った分は次の日に回す」の1行を抜いた版を作れた');
  await db.exec(broken.slice(0, broken.indexOf('-- ── 6. 1時間おきの時計')));
  await reset();
  await news(RV, 'ana', { at: await wall(TOKYO, 1, '10:00') });
  ok((await itemsOf(R1, await wall(TOKYO, 1, '17:30'))) !== null, '抜いた版では、入ったその日の17時に送ってしまう＝B-4 の「入った日のうちは送らない」が赤くなる');
  await db.exec(FOLLOW.slice(0, FOLLOW.indexOf('-- ── 6. 1時間おきの時計')));
}

// ════════════════ D) 知らせのメール（本物の index.ts）════════════════
console.log('\n▼ D 知らせのメール');
const SUPA = 'https://example.supabase.test';
const ENV = { SUPABASE_URL: SUPA, SUPABASE_SERVICE_ROLE_KEY: 'svc', RESEND_API_KEY: 're', PV_CRON_SECRET: 'cron-secret' };
globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: () => {} };
const F = await import('../supabase/functions/follow-notify/index.ts');
const Wm = await import('../supabase/functions/welcome-member/index.ts');
const site = 'https://pilot-value.com';
const people = [{ lang: 'ja' }, { lang: 'en' }, { lang: 'es' }, { name: '山田' }, { country: '日本' }, { country: 'UAE' }, { airline_region: 'japan' }, {}];
ok(people.every((p) => F.followLangOf(p) === Wm.welcomeLangOf(p)), '言語の決め方は歓迎メールと同じ（写しが1文字もずれていない）');
const items = [{ code: 'ana', ja: '全日本空輸（ANA）', en: 'All Nippon Airways (ANA)', page: true, why: 'follow', kinds: ['pay', 'review', 'cond'],
                 reviews: [{ score: 4, pos_ja: '機長（CAP）', pos_en: 'Captain (CAP)', tenure: '5-10', orig: 'ja',
                             text: { culture_comment: '自由な社風で、若手でも意見が通りやすい。' }, tr: { en: { culture: 'Open culture; juniors get heard.' } } }],
                 conds: [{ ja: '年間の有給休暇は何日ですか？', en: 'How many days of annual paid leave are there?' }] },
               { code: 'ops-x', ja: '運航会社', en: 'Ops Co', page: false, why: 'seen', kinds: ['pay'] }];
const fs = await import('fs');
const exists = (href) => fs.existsSync(new URL('../' + href.replace(site + '/', '').split('#')[0], import.meta.url));
for (const l of ['ja', 'en', 'es']) {
  for (const hasKey of [false, true]) {
    const c = F.followCopy(l, items, hasKey, site);
    const s0 = c.sections[0], s1 = c.sections[1];
    const tag = `${l}${hasKey ? '・鍵あり' : '・鍵なし'}`;
    ok(s0.page === `${site}/${F.airlinePath(l, 'ana')}` && exists(s0.page) && s1.page === '' && s0.reviews[0].more === s0.page + '#reviews',
       `${tag}：会社のページがある会社だけリンク（先が在る）・口コミの「続きを見る」は口コミの欄へ`);
    ok(s0.reviews[0].meta.startsWith('★4.0') && s0.reviews[0].meta.includes(l === 'ja' ? '機長（CAP）' : 'Captain (CAP)') && /5/.test(s0.reviews[0].meta),
       `${tag}：口コミの見出しは評価・職位・在籍年数（サイトで見せている範囲）`, s0.reviews[0].meta);
    ok(s0.reviews[0].text === (l === 'ja' ? '自由な社風で、若手でも意見が通りやすい。' : 'Open culture; juniors get heard.'),
       `${tag}：口コミの抜粋は受け取る人の言語の訳（無ければ元の字）`, s0.reviews[0].text);
    ok(hasKey ? (s0.pay.note === '' && exists(s0.pay.link) && c.all === null) : (s0.pay.note !== '' && s0.pay.link === '' && c.all && exists(c.all.cta.href)),
       `${tag}：給与は「入った」だけ。鍵が無ければ「共有すると見られる」＋最後に共有のボタン／鍵があれば REAL PAY へ`);
    const all = [c.subject, ...c.sections.flatMap((x) => [x.head, ...x.reviews.flatMap((r) => [r.meta, r.text]), x.pay ? x.pay.t + x.pay.note : '', ...x.conds])].join(' ');
    ok(!/[¥$€£]|万円|USD|JPY|\d{3,}/.test(all), `${tag}：金額・件数を書かない`, all);
    ok(s0.head !== s1.head && (l !== 'ja' || (s0.head.startsWith('フォロー中の') && s1.head.startsWith('あなたが見た'))), `${tag}：フォロー中の会社と見た会社で見出しを分ける`);
    ok(exists(c.noteLink.href), `${tag}：マイページへのリンクの先が在る`);
  }
}
ok(F.followCopy('ja', items.slice(0, 1), false, site).subject === '全日本空輸（ANA）に新しい口コミが入りました'
   && F.followCopy('ja', items, false, site).subject === '全日本空輸（ANA）など、気になる会社に新しい情報が入りました'
   && F.followCopy('ja', items.slice(1), false, site).subject === '運航会社に新しい情報が入りました', '件名：口コミが入った1社／2社以上／口コミ以外');
ok(F.followCopy('ja', items, false, site).all.cta.label === '自分の給与を匿名で共有する', '共有のボタンの字は2通目と同じオーナーの字');
ok(F.tenureText('20+', 'ja') === '在籍20年以上' && F.tenureText('', 'ja') === '' && F.tenureText('1-5', 'en') === '1–5 yrs at airline', '在籍年数の書き方');
const mailBoth = F.buildFollow({ lang: 'en', unsub_token: 'tok', items }, { siteUrl: site, supabaseUrl: SUPA });
ok(mailBoth.lang === 'both' && mailBoth.oneClickUrl === `${SUPA}/functions/v1/remind-payslip?u=tok` && /unsubscribe\.html\?token=tok/.test(mailBoth.unsubUrl),
   '英語で登録した人は英語＋日本語の1通・解除の口がある');

console.log('\n▼ D-2 送る処理');
const sent = [], marks = [];
const UPTO = '2026-11-09T15:00:00.000Z';   // 日本の 2026-11-10 0時
let dueRows = [{ id: uid(900), email: 'x@example.com', lang: 'ja', unsub_token: 'tok', items, upto: UPTO }];
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  const b = init.body ? JSON.parse(init.body) : {};
  if (url === `${SUPA}/rest/v1/rpc/pv_follow_due`) return Response.json(dueRows);
  if (url === `${SUPA}/rest/v1/rpc/pv_follow_mark`) { marks.push(b); return Response.json(0); }
  if (url === 'https://api.resend.com/emails') { sent.push({ h: init.headers, b }); return Response.json({ id: 'x' }); }
  throw new Error('想定していない通信: ' + url);
};
const post = async (body = {}, secret = 'cron-secret') => (await F.handler(new Request('https://fn.test/', { method: 'POST', headers: { 'x-pv-cron-secret': secret }, body: JSON.stringify(body) }))).json();
let out = await post({}, 'wrong');
ok(out.ok === false && sent.length === 0, '合言葉が違えば送らない');
out = await post({ dry: true });
ok(out.ok && out.due === 1 && sent.length === 0 && marks.length === 0, '下見（dry）は人数だけ・送らない・記録しない');
out = await post();
ok(out.sent === 1 && sent[0].h['Idempotency-Key'] === `follow:${uid(900)}:2026-11-09` && sent[0].b.reply_to === 'info@pilot-value.com',
   '1人1通（鍵は follow:<id>:<どこまでの新着かの日付>＝同じ日に2通送らない）・返信は info@', J(out));
ok(marks.length === 1 && marks[0].p_ok === true && marks[0].p_upto === UPTO, '送れたら、どこまでの新着を送ったか（upto）と一緒に記録する', J(marks));
ok(F.followKey({ id: 'a' }, new Date('2026-11-09T03:00:00Z')) === 'follow:a:2026-11-09', 'upto が無い行（古い SQL）の鍵は今日の日付');
ok(!/\d{2,}/.test(sent[0].b.subject) && /全日本空輸（ANA）/.test(sent[0].b.html) && /自由な社風/.test(sent[0].b.html), '件名に数字が無い・本文に会社名と口コミの抜粋');

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
