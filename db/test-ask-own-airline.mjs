/* db/ask-own-airline.sql を本物の Postgres（PGlite = PG17 の WASM ビルド）に流して確かめる。

   実行: node db/test-ask-own-airline.mjs
   ネットワーク不要・本番に一切触らない。

   器は db/test-contrib.mjs と同じ。流す SQL の並びは serve-local.mjs の SQL_FILES を**そのまま読む**。

   ここでいちばん大事なこと（2026-10-30 オーナー指示「〇〇のこと、ひとつ教えて。」）:
     ★ 聞くのは、給与か口コミを出した会員だけ。会社は最新の給与、無ければ最新の口コミ。
       未ログイン・何も出していない会員・止めた会員には何も返らない。
     ★ 順番は ask_rank（正本は pv-conditions.mjs の ASK）。表に無い質問は1つも出ない。
     ★ 3人以上が同じ答え かつ 過半数 ＝ 埋まった → 出さない。割れていれば出す。わからないは数えない。
       数字は中央の値から ±10%（最低1刻み）に3人以上 かつ 過半数。
     ★ 48時間に1回（サーバの ask_prompt_at）。板の続き（cont）だけは窓を見ない。
     ★ ほかの人の人数を1つも返さない。
     ★ 壊す証明：「埋まった」を外すと、3人同じでも出てしまう。

   ⚠️ ここに出てくる会員は全部作り物（crew1@example.com など）。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import { SQL_FILES } from '../serve-local.mjs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const MINE = 'db/ask-own-airline.sql';
const FILES = SQL_FILES.includes(MINE) ? [...SQL_FILES] : [...SQL_FILES, MINE];

const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;
await db.exec(`set timezone = 'UTC'`);

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };
const J = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x) : x));

// ── 器（db/test-contrib.mjs と同じ）──────────────────────────
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

console.log('\n▼ SQL の適用（本番に貼る順）');
for (const f of FILES) {
  try { await db.exec(read(f)); } catch (e) { ok(false, f, e.message); process.exit(1); }
}
ok(true, `${FILES.length} 本を流せた（最後が ${MINE}）`);
console.log('\n▼ 冪等性（もう一度そのまま流す）');
for (const f of FILES) {
  try { await db.exec(read(f)); } catch (e) { ok(false, f + ' 再適用で失敗', e.message); }
}
ok(true, '2回目も全部流せた');

// ── 道具 ───────────────────────────────────────────────────
const ANON = Symbol('anon');
const asOwner = async () => { await db.exec(`reset role`); await db.query(`select set_config('pv.uid', '', false)`); };
const call = async (who, sql, params = []) => {
  await db.exec(who === ANON ? `set role anon` : `set role authenticated`);
  await db.query(`select set_config('pv.uid', $1, false)`, [typeof who === 'string' ? who : '']);
  try { return { v: (await db.query(sql, params)).rows[0] }; }
  catch (e) { return { err: String(e.message || e) }; }
  finally { await asOwner(); }
};
const seen = [];
const rpc = async (who, fn, p) => {
  const r = p === undefined
    ? await call(who, `select public.${fn}() as v`)
    : await call(who, `select public.${fn}($1::jsonb) as v`, [J(p)]);
  if (r.err) return { __err: r.err };
  seen.push(J(r.v.v));
  return r.v.v;
};
const next = (who, p = {}) => rpc(who, 'pv_ask_next', p);
const seenIt = (who) => rpc(who, 'pv_ask_seen');
const ids = (r) => ((r && r.questions) || []).map((q) => q.id);
const one  = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const many = async (sql, params = []) => (await db.query(sql, params)).rows;

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
const FLEET = (await one(`select code from public.pv_fleets where active order by code limit 1`)).code;
const PAY = { currency: 'USD', lang: 'en', tax_rate_pct: 0, position: 'cap', fleet: FLEET,
              base_pay: 9000, flight_variable_pay: 4000, other_allowance: 4400,
              command_pay: 2000, per_diem: 1000, housing_type: 'allowance', housing_amount: 600 };
const paid = async (who, airline, k = 1) => {
  await db.query(`select set_config('pv.uid', $1, false)`, [who]);
  try {
    const r = (await db.query(`select public.submit_pay_report($1::jsonb) as v`,
      [J({ ...PAY, airline, period_year: ago(k).year, period_month: ago(k).month })])).rows[0].v;
    if (!r || r.access_until == null) ok(false, `（準備が崩れた）給与を出せなかった（${airline}）`, J(r));
  } catch (e) { ok(false, `（準備が崩れた）給与を出せなかった（${airline}）`, String(e.message || e)); }
  finally { await asOwner(); await db.exec(`update public.profiles set pay_reports_today = 0`); }
};
const reviewed = async (who, airline, daysAgo = 0) => {
  await db.query(
    `insert into public.reviews_v2 (proof_hash, airline, created_at)
     values (public.pv_review_hash($1::uuid, $2), $2, now() - make_interval(days => $3))`, [who, airline, daysAgo]);
};
/* 他人の答え。本物の submit_airline_conditions を通す（会員なら誰でも書ける） */
const answer = async (who, airline, answers) => {
  const r = await rpc(who, 'submit_airline_conditions', { airline, answers });
  if (r.__err || r.saved !== answers.length) ok(false, '（準備が崩れた）答えを保存できなかった', J(r));
  await db.exec(`update public.profiles set cond_answers_today = 0`);
};

const AIR = (await many(`select code from public.pv_airlines where code <> 'other' and active order by code limit 15`)).map((r) => r.code);
const [A_PAY, A_REV, A_F, A_SPLIT, A_UNK, A_NUM, A_NUM2, A_MULTI, A_SEEN, A_KID, A_BREAK, A_OLD, A_CUR, A_CUR2, A_CUR3] = AIR;
const ASK = (await many(`select id, kind, parent from public.pv_condition_questions
                          where active and ask_rank is not null order by ask_rank`));
const ASK_IDS = ASK.map((q) => q.id);
const ROOTS = ASK.filter((q) => !q.parent).map((q) => q.id);
const Q1 = ROOTS[0];

console.log('\n▼ 1. 誰に聞くか');
{
  const r = await call(ANON, `select public.pv_ask_next('{}'::jsonb) as v`);
  ok(!!r.err && /permission denied/i.test(r.err), '未ログインの役は pv_ask_next を呼べない', J(r));
  const s = await call(ANON, `select public.pv_ask_seen() as v`);
  ok(!!s.err && /permission denied/i.test(s.err), '未ログインの役は pv_ask_seen を呼べない', J(s));

  const nobody = await member();
  const n = await next(nobody);
  ok(n.due === false && n.why === 'none', '給与も口コミも出していない会員 → 聞かない（none）', J(n));

  const pr = await member();
  await paid(pr, A_PAY);
  const p = await next(pr);
  ok(p.due === true && p.airline === A_PAY, '給与を出した会員 → 給与の会社について聞く', J(p));
  ok(typeof p.name_ja === 'string' && p.name_ja && typeof p.name_en === 'string' && p.name_en, '社名（日英）が付く', J(p));

  const rv = await member();
  await reviewed(rv, A_REV);
  const v = await next(rv);
  ok(v.due === true && v.airline === A_REV, '口コミだけ出した会員 → 口コミの会社について聞く', J(v));

  const both = await member();
  await reviewed(both, A_REV);
  await paid(both, A_PAY);
  const b = await next(both);
  ok(b.airline === A_PAY, '給与と口コミの両方 → 給与の会社が先', J(b));

  const two = await member();
  await reviewed(two, A_PAY, 30);
  await reviewed(two, A_REV, 1);
  const t = await next(two);
  ok(t.airline === A_REV, '口コミが2社 → 新しいほうの会社', J(t));

  const blocked = await member();
  await paid(blocked, A_PAY);
  await db.query(`insert into public.pv_proof(user_id, state) values ($1, 'required')`, [blocked]);
  const bl = await next(blocked);
  ok(bl.due === false && bl.why === 'blocked', 'パイロット確認で止めた会員 → 聞かない（blocked）', J(bl));
}

console.log('\n▼ 2. 順番と、表に無い質問');
{
  const m = await member();
  await paid(m, A_PAY);
  const r = await next(m);
  ok(J(ids(r)) === J(ROOTS.slice(0, 3)), `初めての人には ask_rank の順に親の無い3問（${ROOTS.slice(0, 3).join(' → ')}）`, J(ids(r)));
  ok(J(ids(await next(m, { limit: 1 }))) === J([Q1]), 'limit:1 → 1問だけ');
  ok(ids(await next(m, { limit: 99 })).length === 3, 'limit:99 → 3問まで（設定の ask_limit で止まる）');
  ok(J(ids(await next(m, { not: [Q1] }))) === J(ROOTS.slice(1, 4)), 'not に渡した質問は出ない（板で出した分を2度出さない）');

  /* 全部「わからない」でない答えで埋めていき、出た質問が全部 ASK に在ることを見る */
  const all = new Set();
  for (let i = 0; i < 40; i++) {
    const g = await next(m, { cont: true, limit: 1 });
    if (!g.due) break;
    const q = g.questions[0];
    all.add(q.id);
    const def = await one(`select kind, choice_codes, num_min, has_currency from public.pv_condition_questions where id = $1`, [q.id]);
    const a = def.kind === 'num' ? { question_id: q.id, num: Number(def.num_min) + 5, ...(def.has_currency ? { currency: 'USD' } : {}) }
            : def.kind === 'multi' ? { question_id: q.id, codes: [def.choice_codes[0]] }
            : { question_id: q.id, code: def.choice_codes[0] };
    await answer(m, A_PAY, [a]);
  }
  ok([...all].every((id) => ASK_IDS.includes(id)), `出た質問 ${all.size} 問はすべて ASK の中`, J([...all].filter((id) => !ASK_IDS.includes(id))));
  ok(all.size >= ROOTS.length, '親の無い質問は全部いつか出る', J([...all]));
  const done = await next(m, { cont: true });
  ok(done.due === false && done.why === 'done', '答え尽くしたら聞かない（done）', J(done));
}

console.log('\n▼ 3. 埋まった質問は出さない（3人以上・過半数）');
{
  const firstCode = (await one(`select choice_codes from public.pv_condition_questions where id = $1`, [Q1])).choice_codes;
  const [YES, NO] = firstCode.filter((c) => c !== 'unknown');
  const askAt = async (airline) => { const m = await member(); await paid(m, airline); return ids(await next(m)); };

  for (let i = 0; i < 3; i++) await answer(await member(), A_F, [{ question_id: Q1, code: YES }]);
  ok(!(await askAt(A_F)).includes(Q1), '3人が同じ答え → その質問は出ない');

  for (let i = 0; i < 2; i++) await answer(await member(), A_SPLIT, [{ question_id: Q1, code: YES }]);
  for (let i = 0; i < 2; i++) await answer(await member(), A_SPLIT, [{ question_id: Q1, code: NO }]);
  ok((await askAt(A_SPLIT)).includes(Q1), '2対2に割れている → まだ出す');
  await answer(await member(), A_SPLIT, [{ question_id: Q1, code: YES }]);
  ok(!(await askAt(A_SPLIT)).includes(Q1), '3対2（3人以上・過半数）→ 出さない');
  await answer(await member(), A_SPLIT, [{ question_id: Q1, code: NO }]);
  ok((await askAt(A_SPLIT)).includes(Q1), 'あとから割れた（3対3）→ また出す（いったん卒業しただけ）');
  await answer(await member(), A_SPLIT, [{ question_id: Q1, code: NO }]);
  ok(!(await askAt(A_SPLIT)).includes(Q1), '3対4（4人の側が過半数）→ また出さない');

  for (let i = 0; i < 4; i++) await answer(await member(), A_UNK, [{ question_id: Q1, code: 'unknown' }]);
  ok((await askAt(A_UNK)).includes(Q1), '「わからない」が4人 → 埋まったことにしない');

  /* 数字：中央の値の近く */
  const NUMQ = ASK.find((q) => q.kind === 'num' && !q.parent).id;
  const askNum = async (airline) => { const m = await member(); await paid(m, airline); return ids(await next(m, { limit: 5, not: ROOTS.slice(0, ROOTS.indexOf(NUMQ)) })); };
  for (const v of [20, 21, 19]) await answer(await member(), A_NUM, [{ question_id: NUMQ, num: v }]);
  ok(!(await askNum(A_NUM)).includes(NUMQ), `数字（${NUMQ}）が 20・21・19 → 近い（±10%）ので出さない`);
  for (const v of [10, 20, 30]) await answer(await member(), A_NUM2, [{ question_id: NUMQ, num: v }]);
  ok((await askNum(A_NUM2)).includes(NUMQ), `数字（${NUMQ}）が 10・20・30 → ばらばらなので出す`);

  /* 額（通貨つき）：同じ通貨どうしでしか比べない（2026-10-30 着陸手当の額・日当を足した） */
  const MONEY = new Set((await many(`select id from public.pv_condition_questions where has_currency`)).map((r) => r.id));
  const CQ = ASK.find((q) => q.kind === 'num' && MONEY.has(q.id) && q.parent
    && ASK.find((x) => x.id === q.parent && !x.parent && x.kind === 'choice'));
  ok(!!CQ, `板で聞く額の質問がある（${CQ && CQ.id}）`);
  if (CQ) {
    const link = await one(`select parent, parent_when from public.pv_condition_links where question_id = $1 order by 1 limit 1`, [CQ.id]);
    const say = async (airline, num, currency) => answer(await member(), airline, [{ question_id: link.parent, code: link.parent_when[0] },
                                                                 { question_id: CQ.id, num, currency }]);
    const askCur = async (airline) => {
      const m = await member(); await paid(m, airline);
      await answer(m, airline, [{ question_id: link.parent, code: link.parent_when[0] }]);
      /* 前の質問で3問の枠が埋まらないよう、この質問より前は全部「板で出した」ことにする */
      return ids(await next(m, { cont: true, limit: 5, not: ASK_IDS.slice(0, ASK_IDS.indexOf(CQ.id)) }));
    };
    ok((await askCur(A_CUR)).includes(CQ.id), `まだ誰も答えていない会社では、額（${CQ.id}）が出る（下の「出さない」が空振りでない印）`);
    for (const v of [100, 104, 97]) await say(A_CUR, v, 'USD');
    ok(!(await askCur(A_CUR)).includes(CQ.id), `額（${CQ.id}）が 100・104・97 ドル → 近いので出さない`);
    for (const c of ['USD', 'EUR', 'GBP']) await say(A_CUR2, 100, c);
    ok((await askCur(A_CUR2)).includes(CQ.id), '額が 100 ドル・100 ユーロ・100 ポンド → 数字は同じでも通貨が違うので出す（通貨を混ぜない）');
    for (const v of [10000, 10200, 9900]) await say(A_CUR3, v, 'JPY');
    for (const v of [70, 71]) await say(A_CUR3, v, 'USD');
    ok(!(await askCur(A_CUR3)).includes(CQ.id), '額が 円で3人そろう＋ドルが2人 → 3人以上・5人の過半数なので出さない');
    await say(A_CUR3, 72, 'USD');
    ok((await askCur(A_CUR3)).includes(CQ.id), '額が 円3人・ドル3人に割れた → また出す');
  }

  /* 複数選ぶ：親に「ある」と答えた3人が同じ形を選ぶ */
  const MQ = ASK.find((q) => q.kind === 'multi');
  if (MQ) {
    const link = await one(`select parent, parent_when from public.pv_condition_links where question_id = $1 order by 1 limit 1`, [MQ.id]);
    const mcodes = (await one(`select choice_codes from public.pv_condition_questions where id = $1`, [MQ.id])).choice_codes;
    for (let i = 0; i < 3; i++) {
      await answer(await member(), A_MULTI, [{ question_id: link.parent, code: link.parent_when[0] },
                                              { question_id: MQ.id, codes: [mcodes[0]] }]);
    }
    const m = await member(); await paid(m, A_MULTI);
    await answer(m, A_MULTI, [{ question_id: link.parent, code: link.parent_when[0] }]);
    const r = ids(await next(m, { cont: true, limit: 5 }));
    ok(!r.includes(MQ.id), `複数選ぶ（${MQ.id}）で3人が同じ項目 → 出さない`, J(r));
  }
}

console.log('\n▼ 4. 本人が答えた・飛ばした質問、子の質問');
{
  const m = await member(); await paid(m, A_KID);
  const codes = (await one(`select choice_codes from public.pv_condition_questions where id = $1`, [Q1])).choice_codes;
  await answer(m, A_KID, [{ question_id: Q1, code: codes[0] }]);
  ok(!ids(await next(m)).includes(Q1), '答えた質問は出ない（365日の窓）');
  await rpc(m, 'submit_airline_conditions', { airline: A_KID, answers: [{ question_id: ROOTS[1], skip: true }] });
  ok(!ids(await next(m)).includes(ROOTS[1]), 'スキップした質問は出ない（90日の窓）');

  const KID = ASK.find((q) => q.parent && ASK.find((x) => x.id === q.parent && !x.parent && x.kind === 'choice'));
  const link = await one(`select parent_when from public.pv_condition_links where question_id = $1 and parent = $2`, [KID.id, KID.parent]);
  const pcodes = (await one(`select choice_codes from public.pv_condition_questions where id = $1`, [KID.parent])).choice_codes;
  const noCode = pcodes.find((c) => c !== 'unknown' && !link.parent_when.includes(c));
  const a = await member(); await paid(a, A_KID);
  ok(!ids(await next(a, { limit: 5, cont: true })).includes(KID.id), `親（${KID.parent}）に答えていない人には子（${KID.id}）を出さない`);
  await answer(a, A_KID, [{ question_id: KID.parent, code: link.parent_when[0] }]);
  ok(ids(await next(a, { limit: 1, cont: true, not: ROOTS.filter((x) => ASK_IDS.indexOf(x) < ASK_IDS.indexOf(KID.id)) })).includes(KID.id),
     `親に「${link.parent_when[0]}」と答えたら、子（${KID.id}）が出る`);
  if (noCode) {
    const b = await member(); await paid(b, A_KID);
    await answer(b, A_KID, [{ question_id: KID.parent, code: noCode }]);
    ok(!ids(await next(b, { limit: 5, cont: true })).includes(KID.id), `親に「${noCode}」と答えた人には子を出さない`);
  }

  /* 窓が明けた自分の答え → 前回の答え（mine_code）を添えて聞き直す */
  const o = await member(); await paid(o, A_OLD);
  await answer(o, A_OLD, [{ question_id: Q1, code: codes[0] }]);
  await db.query(`update public.airline_conditions set updated_at = now() - interval '400 days'
                   where question_id = $1 and proof_hash = public.pv_condition_hash($2::uuid, $3, null)`, [Q1, o, A_OLD]);
  const re = await next(o);
  const q1 = (re.questions || []).find((q) => q.id === Q1);
  ok(!!q1 && q1.mine_code === codes[0], '1年たった自分の答えは、前回の答えを添えて聞き直す', J(re));
}

console.log('\n▼ 5. 48時間に1回');
{
  const m = await member(); await paid(m, A_SEEN);
  ok((await next(m)).due === true, '一度も開いていない → 聞く');
  const s = await seenIt(m);
  ok(s.ok === true && !!s.next_at, '板を開いた（pv_ask_seen）→ 次に聞いてよい時刻が返る', J(s));
  const w = await next(m);
  ok(w.due === false && w.why === 'wait' && !!w.next_at, '開いた直後 → 聞かない（wait）', J(w));
  const hrs = (new Date(w.next_at) - Date.now()) / 3600e3;
  ok(hrs > 47 && hrs <= 48.01, `次に聞くのは約48時間後（${hrs.toFixed(2)} 時間）`);
  ok((await next(m, { cont: true })).due === true, '開いている板の続き（cont）は窓を見ない');
  const s2 = await seenIt(m);
  ok(J(s2.next_at) === J(s.next_at), 'もう一度 pv_ask_seen を呼んでも窓は延びない（2台目の端末）', J([s, s2]));
  await db.query(`update public.profiles set ask_prompt_at = now() - interval '49 hours' where id = $1`, [m]);
  ok((await next(m)).due === true, '49時間たったら、また聞く');
  const up = await call(m, `update public.profiles set ask_prompt_at = null where id = '${m}'`);
  ok(!!up.err && /permission denied/i.test(up.err), '会員は ask_prompt_at を自分で書き換えられない', J(up));
}

console.log('\n▼ 6. ほかの人の人数を返さない');
{
  const TOP = new Set(['ok', 'due', 'why', 'next_at', 'airline', 'name_ja', 'name_en', 'questions']);
  const Q = new Set(['id', 'kind', 'mine_code']);
  const bad = [];
  for (const s of seen) {
    let o; try { o = JSON.parse(s); } catch { continue; }
    if (!o || typeof o !== 'object' || !('due' in o)) continue;
    for (const k of Object.keys(o)) if (!TOP.has(k)) bad.push(k);
    for (const q of o.questions || []) for (const k of Object.keys(q)) if (!Q.has(k)) bad.push('q.' + k);
  }
  ok(!bad.length, '返した形は決めた鍵だけ（人数・n・割合が無い）', J([...new Set(bad)]));
  for (const fn of ['pv_ask_filled(text)', 'pv_ask_own(uuid)', 'pv_condition_ans()']) {
    const r = await one(`select has_function_privilege('authenticated', 'public.${fn}', 'execute') as a,
                                has_function_privilege('anon', 'public.${fn}', 'execute') as b`);
    ok(!r.a && !r.b, `中の部品 ${fn} は会員も未ログインも呼べない`);
  }
}

console.log('\n▼ 7. 壊す証明（「埋まった」を外すと、3人同じでも出てしまう）');
{
  const src = read(MINE);
  const cut = src.replace(/\n\s+and q\.id <> all\(v_filled\)/, () => '');
  ok(cut !== src, '外す行が見つかった');
  await db.exec(cut);
  const m = await member(); await paid(m, A_F);
  ok(ids(await next(m)).includes(Q1), '外したら、3人同じ答えの質問が出た ＝ 上の ✅ はこの1行が効いている');
  await db.exec(src);
  const m2 = await member(); await paid(m2, A_F);
  ok(!ids(await next(m2)).includes(Q1), '戻したら、また出ない');
}

console.log('\n▼ 7b. 壊す証明（額を通貨ごとに分けるのをやめると、100 ドル・100 ユーロ・100 ポンドが「そろった」になる）');
{
  const src = read(MINE);
  /* 通貨を全部「無し」にして、額の行も数える ＝ 円もドルも1つの塊で比べる形 */
  const cut = src.replace(/c\.answer_currency::text as cur/, () => 'null::text as cur')
                 .replace(/\n\s+and \(a\.cur is not null or not a\.has_currency\)/, () => '');
  ok(cut !== src, '通貨で分けている行が見つかった');
  await db.exec(cut);
  const MONEY = new Set((await many(`select id from public.pv_condition_questions where has_currency`)).map((r) => r.id));
  const CQ = ASK.find((q) => q.kind === 'num' && MONEY.has(q.id) && q.parent
    && ASK.find((x) => x.id === q.parent && !x.parent && x.kind === 'choice'));
  const link = await one(`select parent, parent_when from public.pv_condition_links where question_id = $1 order by 1 limit 1`, [CQ.id]);
  const before = { cont: true, limit: 5, not: ASK_IDS.slice(0, ASK_IDS.indexOf(CQ.id)) };
  const m = await member(); await paid(m, A_CUR2);
  await answer(m, A_CUR2, [{ question_id: link.parent, code: link.parent_when[0] }]);
  ok(!ids(await next(m, before)).includes(CQ.id), '通貨で分けるのをやめたら、通貨の違う 100 が「そろった」になった ＝ 上の ✅ はこの分け方が効いている');
  await db.exec(src);
  const m2 = await member(); await paid(m2, A_CUR2);
  await answer(m2, A_CUR2, [{ question_id: link.parent, code: link.parent_when[0] }]);
  ok(ids(await next(m2, before)).includes(CQ.id), '戻したら、また出る');
}

console.log('\n▼ 8. 公開の集計は今までどおり（ビューを関数に切り出した）');
{
  const v = await one(`select n, top_code from public.airline_condition_facts where airline = $1 and question_id = $2`, [A_F, Q1]);
  ok(!!v && Number(v.n) === 3, '3人が答えた質問は集計に出る（n=3）', J(v));
  const s = await one(`select count(*)::int as c from public.airline_condition_facts where airline = $1 and question_id = $2`, [A_UNK, Q1]);
  ok(s.c === 0, '「わからない」だけの質問は集計に出ない（今までどおり）', J(s));
}

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
