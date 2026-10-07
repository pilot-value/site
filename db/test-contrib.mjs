/* db/contrib.sql を本物の Postgres（PGlite = PG17 の WASM ビルド）に流して確かめる。

   実行: node db/test-contrib.mjs
   ネットワーク不要・本番に一切触らない。SQL を直したら必ずこれを通してから
   オーナーに実行を依頼すること。

   器は db/test-work-months.mjs と同じ（anon / authenticated ロール、既定権限を全付与した状態、
   auth.uid() の代役、profiles、auth.users）。流す SQL の並びは serve-local.mjs の SQL_FILES を
   **そのまま読む**（写さない）。

   ここでいちばん大事な5つ:
     ★ 預けた回答は、鍵を持っている端末にしか返らない。
       鍵を知らない人・形だけ合わせた鍵・期限の切れた鍵には、空しか返らない。
       表には鍵そのものが無い（sha256 だけ）。
     ★ 預かっているあいだは、集計にも他人の画面にも出ない。
       未ログインの3人ぶんを置いても、3人の壁は破れない。引き継いで初めて数に入る。
     ★ 引き継ぎはログインした本人が鍵を出して行う。鍵は1回で消える。
       会員の側にもっと新しい同じ回答が在れば、そちらが残る。
     ★ 預けても・引き継いでも、資格は1つも付かない。
       pv_my_give() は basic:false のまま・給与の一覧は閉じたまま・勤務の幅も閉じたまま。
     ★ 他人の補足は、立場をサーバが見てから返す。未ログインには1文字も返らない。
       会員には勤務・訓練と月の勤務**以外**。給与の鍵が生きている人には全部。
       「見せます」の印が無い補足は、誰にも返らない。

   ⚠️ set_config の第3引数は **false**（＝セッション全体）でなければならない。
   ⚠️ ここに出てくる会員は全部作り物（crew1@example.com など）。数字も文も検査のための作り物。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import { SQL_FILES } from '../serve-local.mjs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const MINE = 'db/contrib.sql';
const FILES = SQL_FILES.includes(MINE) ? [...SQL_FILES] : [...SQL_FILES, MINE];
const CONTRIB_SQL = read(MINE);

const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;
await db.exec(`set timezone = 'UTC'`);

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };
const J = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x) : x));
const keys = (o) => Object.keys(o || {}).sort().join(',');

// ── 器（serve-local.mjs の BOOT の写し）──────────────────────
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
    gender text, birthdate date, country text, company text, "position" text);

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

console.log('\n▼ SQL の適用');
for (const f of FILES) {
  try { await db.exec(read(f)); ok(true, f); }
  catch (e) { ok(false, f, e.message); process.exit(1); }
}
console.log('\n▼ 冪等性（もう一度そのまま流す）');
for (const f of FILES) {
  try { await db.exec(read(f)); ok(true, f + ' 再適用OK'); }
  catch (e) { ok(false, f + ' 再適用で失敗', e.message); }
}

// ── 道具 ─────────────────────────────────────────────────────
const ANON = Symbol('anon');
const DEAD = Symbol('dead');
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
const no = (r) => !!(r.err && /permission denied/i.test(r.err));

/* 外へ返った JSON は全部ためておく（最後の節で「出てはいけないもの」を1つ残らず見る）。 */
const seen = [];
const rpc = async (who, fn, p) => {
  const r = await call(who, `select public.${fn}($1::jsonb) as v`, [p === undefined ? null : J(p)]);
  if (r.err) return { __err: r.err };
  seen.push({ fn, who: who === ANON ? 'anon' : 'member', json: J(r.v.v) });
  return r.v.v;
};
const bad    = (r, re) => !!(r && r.__err && re.test(r.__err));
const denied = (r) => bad(r, /permission denied/i);

const put    = (who, p) => rpc(who, 'submit_contrib_anon', p);
const putW   = (key, data, who = ANON) => put(who, { ...(key ? { key } : {}), kind: 'work', data });
const putC   = (key, data, who = ANON) => put(who, { ...(key ? { key } : {}), kind: 'cond', data });
const mineA  = (key, airline, who = ANON) => rpc(who, 'my_contrib_anon', { key, ...(airline ? { airline } : {}) });
const claim  = (who, key) => rpc(who, 'claim_contrib', { key });
const notes  = (who, airline) => rpc(who, 'pv_contrib_notes', { airline });
const workM  = (who, p) => rpc(who, 'submit_work_month', p);
const mineW  = (who, p) => rpc(who, 'my_work_months', p);
const condM  = (who, p) => rpc(who, 'submit_airline_conditions', p);
const mineC  = (who, p) => rpc(who, 'my_airline_conditions', p);
const view   = (who, p) => rpc(who, 'pv_work_view', p);

const one  = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const many = async (sql, params = []) => (await db.query(sql, params)).rows;
const cnt  = async (sql, params = []) => Number((await one(`select count(*)::int as n from ${sql}`, params)).n);

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let seat = 0;
const member = async () => {
  const id = uid(++seat), mail = `crew${seat}@example.com`;
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, mail]);
  await db.query(`insert into public.profiles (id, email) values ($1, $2) on conflict (id) do nothing`, [id, mail]);
  return id;
};
const crew = async (n) => { const a = []; for (let i = 0; i < n; i++) a.push(await member()); return a; };
/* 給与の鍵は、検査の準備として持ち主が直接立てる（会員が自分で立てる道は無い）。 */
const unlock = (id) => db.query(`update public.profiles set access_until = now() + interval '30 days' where id = $1`, [id]);
const give = async (who) => {
  await db.query(`select set_config('pv.uid', $1, false)`, [who]);
  try { return (await db.query(`select public.pv_my_give() as g`)).rows[0].g; }
  finally { await asOwner(); }
};
const gate = async (who) => {
  const r = await call(who, `select public.pv_pay_rows() as v`);
  return r.err ? { __err: r.err } : r.v.v;
};

const NOW  = await one(`select extract(year from current_date)::int as y, extract(month from current_date)::int as m`);
const ago  = (k) => { const t = NOW.y * 12 + (NOW.m - 1) - k; return { year: Math.floor(t / 12), month: (t % 12) + 1 }; };
const KEY  = /^[0-9a-f]{48}$/;
const SIX  = ['block_hours', 'duty_hours', 'work_days', 'duty_days', 'days_off', 'stay_nights'];

const AIR = (await many(
  `select code from public.pv_airlines where code <> 'other' and active order by code limit 10`)).map((r) => r.code);
const [A_ONE, A_TWO, A_WALL, A_CLAIM, A_NEW, A_NOTE, A_LIM, A_EXP, A_FLOW, A_BARE] = AIR;

const READER = await member();
await unlock(READER);


// ════════════════════════════════════════════════════════════
console.log('\n▼ 1. 権限（誰が何をできるか）');
// ════════════════════════════════════════════════════════════
{
  const [P1] = await crew(1);
  for (const [who, name] of [[ANON, '未ログイン'], [P1, '会員']]) {
    for (const t of ['pv_contrib_keys', 'pv_contrib_pending']) {
      ok(no(await call(who, `select count(*) from public.${t}`)), `${name}は ${t} を直接読めない`);
      ok(no(await call(who, `delete from public.${t}`)), `${name}は ${t} から直接消せない`);
    }
    ok(no(await call(who, `select public.pv_contrib_key_live($1)`, ['a'.repeat(48)])), `${name}は鍵を確かめる関数を直接呼べない`);
    ok(no(await call(who, `select public.pv_contrib_key_hash($1)`, ['a'.repeat(48)])), `${name}は鍵を表の形にする関数を直接呼べない`);
  }
  ok(denied(await claim(ANON, 'a'.repeat(48))), '★未ログインは引き継ぎを呼べない（実行権が無い）');
  ok(bad(await claim(DEAD, 'a'.repeat(48)), /ログインが必要/), 'ログインが死んでいる会員も引き継げない');

  const chk = (await db.query(CONTRIB_SQL.slice(CONTRIB_SQL.lastIndexOf('\nselect (select count(*) from pg_policies')))).rows[0];
  const vals = Object.entries(chk);
  ok(vals.length === 7 && Number(vals[0][1]) === 0 && vals.slice(1).every(([, v]) => v === true),
    '末尾の検算：ポリシー数 0・残り6つが全部 true', J(chk));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 2. 未ログインで月の勤務を預ける');
// ════════════════════════════════════════════════════════════
let K1;
{
  const M1 = ago(2);
  // 1項目だけ・0 を入れる
  const r = await putW(null, { airline: A_ONE, position: 'cap', ...M1, days_off: 0 });
  K1 = r.key;
  ok(r.ok === true && r.saved === true && r.replaced === false && r.year === M1.year && r.month === M1.month,
    '★1項目だけで預けられる', J(r));
  ok(KEY.test(K1 || ''), '★初めての保存で、鍵が1本返る（48文字の16進）');
  ok(await cnt(`public.pv_contrib_keys`) === 1 && await cnt(`public.pv_contrib_pending`) === 1, '鍵1本・預かり1行');
  const k = await one(`select key_hash from public.pv_contrib_keys`);
  ok(k.key_hash !== K1 && /^[0-9a-f]{64}$/.test(k.key_hash)
     && await cnt(`public.pv_contrib_keys where key_hash = $1`, [K1]) === 0
     && !J(await many(`select * from public.pv_contrib_keys`)).includes(K1)
     && !J(await many(`select * from public.pv_contrib_pending`)).includes(K1),
    '★表に鍵そのものは無い（置いてあるのは sha256 だけ）');
  ok(await cnt(`public.pv_work_months`) === 0, '★会員の勤務の表には1行も入っていない（預かりは別の置き場）');

  // 本人が読む
  let m = await mineA(K1, A_ONE);
  ok(m.ok && m.known === true && m.rows.length === 1 && m.answers.length === 0, '鍵を出すと、預けた1か月が返る', J(m));
  const row = m.rows[0];
  ok(row.days_off === 0 && SIX.filter((x) => x !== 'days_off').every((x) => row[x] === null),
    '★0 は 0 のまま・入れなかった5項目は未回答（null）のまま', J(row));
  ok(row.position === 'cap' && row.year === M1.year && row.month === M1.month, '会社・月・職位を引き継いでいる');

  // 同じ月を直す（鍵を付けて）
  const r2 = await putW(K1, { airline: A_ONE, position: 'cap', ...M1, days_off: 9, block_hours: 72.5, note: '夏は多め' });
  ok(r2.ok && r2.replaced === true && !('key' in r2), '★2回目からは鍵を返さない（同じ預かりを直すだけ）', J(r2));
  m = await mineA(K1, A_ONE);
  ok(m.rows.length === 1 && m.rows[0].days_off === 9 && m.rows[0].block_hours === 72.5 && m.rows[0].note === '夏は多め',
    '★直した内容がそのまま返る（行は増えない・ひとことも残る）', J(m.rows));
  // 別の月を足す
  const r3 = await putW(K1, { airline: A_ONE, position: 'cap', ...ago(3), stay_nights: 6 });
  ok(r3.ok && r3.replaced === false && !('key' in r3) && (await mineA(K1, A_ONE)).rows.length === 2, '別の月は別の行になる（新しい月が先）');
  ok((await mineA(K1, A_TWO)).rows.length === 0 && (await mineA(K1)).rows.length === 2, '会社で絞れる／絞らなければ全部');

  // 形は会員の読み口と同じ
  const [P] = await crew(1);
  await workM(P, { airline: A_ONE, position: 'cap', ...M1, days_off: 9 });
  const mm = await mineW(P, { airline: A_ONE });
  ok(keys(mm.rows[0]) === keys(m.rows[0]), '★返る1行の形が、会員の「自分の勤務」と同じ（画面が同じ部品で描ける）',
    keys(mm.rows[0]) + ' ⇄ ' + keys(m.rows[0]));
  await db.exec(`delete from public.pv_work_months`);

  // おかしい入力のために鍵を作らない
  const n0 = await cnt(`public.pv_contrib_keys`);
  ok(bad(await putW(null, { airline: 'no-such-airline', position: 'cap', ...M1, days_off: 3 }), /[ぁ-ん]/), '知らない会社は日本語で断る');
  ok(bad(await putW(null, { airline: A_ONE, position: 'cap', ...M1 }), /[ぁ-ん]/), '6項目が全部空なら断る（空の月は預からない）');
  ok(bad(await putW(null, { airline: A_ONE, position: 'cap', year: NOW.y + 1, month: 1, days_off: 3 }), /[ぁ-ん]/), '未来の月は断る');
  ok(bad(await putW(null, { airline: 'other', airline_other: 'Test Charter Alpha', position: 'cap', ...M1, days_off: 3 }),
    /ログインしてから/), '★一覧に無い会社（自由入力）は預からない');
  ok(bad(await put(ANON, { kind: 'pay', data: {} }), /入力の形式/) && bad(await put(ANON, { kind: 'work' }), /入力の形式/)
     && bad(await put(ANON, { kind: 'work', data: { airline: A_ONE, note: 'x'.repeat(21000) } }), /入力の形式/),
    '種類が違う・中身が無い・長すぎる入力は断る');
  ok(await cnt(`public.pv_contrib_keys`) === n0, '★断った回は鍵を1本も作っていない');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 3. 鍵を知らない人には返らない');
// ════════════════════════════════════════════════════════════
{
  const [P1] = await crew(1);
  const EMPTY = '{"ok":true,"rows":[],"known":false,"answers":[]}';
  const same = (r) => r && r.ok === true && r.known === false && r.rows.length === 0 && r.answers.length === 0 && keys(r) === 'answers,known,ok,rows';
  ok(same(await mineA('b'.repeat(48), A_ONE)), '★形だけ合わせた鍵には、空しか返らない');
  ok(same(await mineA('', A_ONE)) && same(await rpc(ANON, 'my_contrib_anon', {})) && same(await rpc(ANON, 'my_contrib_anon')),
    '鍵を出さなければ空');
  ok(same(await mineA(K1.toUpperCase(), A_ONE)) && same(await mineA(K1.slice(0, 47), A_ONE)) && same(await mineA(K1 + '0', A_ONE)),
    '1文字違う・大文字・長さ違いの鍵でも空（近い鍵に手がかりを返さない）');
  const kh = (await one(`select key_hash from public.pv_contrib_keys`)).key_hash;
  ok(same(await mineA(kh, A_ONE)), '★表に置いてある形（sha256）を出しても読めない');
  ok(same(await mineA(K1, A_ONE, P1)) === false && (await mineA(K1, A_ONE, P1)).rows.length === 2,
    '鍵を持っていれば、ログインしていても読める（引き継ぐ前の確認に使う）');
  ok(EMPTY.length > 0 && (await claim(P1, 'b'.repeat(48))).known === false, '知らない鍵を引き継ごうとしても、何も起きない');

  // 知らない鍵を付けて預けると、その鍵は使われず、新しい鍵が作られる
  const forged = 'c'.repeat(48);
  const r = await putW(forged, { airline: A_TWO, position: 'fo', ...ago(1), work_days: 18 });
  ok(r.ok && KEY.test(r.key || '') && r.key !== forged, '★画面が作った鍵は受け付けない（サーバが新しい鍵を作って返す）', J(r));
  ok(same(await mineA(forged, A_TWO)) && (await mineA(r.key, A_TWO)).rows.length === 1, '   作った鍵では読めない・返った鍵でだけ読める');
  ok((await mineA(r.key, A_ONE)).rows.length === 0 && (await mineA(K1, A_TWO)).rows.length === 0,
    '★別の端末の預かりは、互いに見えない');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 4. 未ログインで質問に答える（選択＋任意の補足）');
// ════════════════════════════════════════════════════════════
let K2;
{
  const C = { airline: A_ONE, position: 'cap', lang: 'ja' };
  // 子だけ先に送る → 親が無い
  let r = await putC(null, { ...C, answers: [{ question_id: 'commuting_taxi_cost', code: 'company_full' }] });
  ok(r.ok && r.saved === 0 && r.rejected[0]?.reason === 'parent_missing' && !('key' in r),
    '親に答えていない人の子の回答は預からない（鍵も作らない）', J(r));
  ok(await cnt(`public.pv_contrib_keys`) === 2, '   空の鍵が残っていない');

  // 親 → 子 → 孫をまとめて。補足はどの質問にも付けられる
  r = await putC(null, { ...C, answers: [
    { question_id: 'commuting_taxi_cost', code: 'company_full', text: '深夜は全額', share: true },
    { question_id: 'commuting_transport_method', codes: ['company_taxi', 'crew_bus'] },
    { question_id: 'commuting_transport', code: 'conditional', text: '早朝と深夜だけ', share: true },
    { question_id: 'upgrade_min_hours', code: 'h3000_4999', text: '目安として' },
    { question_id: 'upgrade_years', num: 9 },
    { question_id: 'no_such_question', code: 'yes' },
    { question_id: 'staff_travel', code: 'yes', text: 'x'.repeat(301) },
    { question_id: 'reserve_duty', skip: true }] });
  K2 = r.key;
  ok(r.ok && r.saved === 5 && KEY.test(K2 || ''), '★順番がばらばらでも、親→子の順に預かる（5件）', J(r));
  const why = Object.fromEntries(r.rejected.map((x) => [x.question_id, x.reason]));
  ok(why.no_such_question === 'unknown_question' && why.staff_travel === 'text_too_long' && why.reserve_duty === 'skip_needs_login'
     && r.rejected.length === 3, '知らない質問・300字を超える補足・スキップは理由つきで返す', J(r.rejected));
  ok(await cnt(`public.airline_conditions`) === 0, '★会員の回答の表には1行も入っていない');

  const m = await mineA(K2, A_ONE);
  const a = Object.fromEntries(m.answers.map((x) => [x.question_id, x]));
  ok(m.answers.length === 5 && a.commuting_transport.code === 'conditional' && a.commuting_transport.text === '早朝と深夜だけ'
     && J(a.commuting_transport_method.codes) === '["company_taxi","crew_bus"]' && a.upgrade_years.num === 9
     && a.upgrade_min_hours.text === '目安として' && a.commuting_taxi_cost.text === '深夜は全額',
    '★選んだ答えと補足が、そのまま返る（どの質問の補足も残る）', J(m.answers));
  ok(a.commuting_transport.shared === true && a.commuting_taxi_cost.shared === true
     && a.upgrade_min_hours.shared === false && a.upgrade_years.shared === false,
    '★「見せます」の印が付いているかも本人に返る（画面が、直していない補足の印を勝手に変えないため）',
    J(m.answers.map((x) => [x.question_id, x.shared])));

  // 形は会員の読み口と同じ
  const [P] = await crew(1);
  await condM(P, { ...C, answers: [{ question_id: 'commuting_transport', code: 'conditional' }] });
  const mc = await mineC(P, { airline: A_ONE });
  ok(keys(mc.answers[0]) === keys(m.answers[0]), '★返る1件の形が、会員の「自分の回答」と同じ', keys(mc.answers[0]) + ' ⇄ ' + keys(m.answers[0]));
  await db.exec(`delete from public.airline_conditions`);

  // 直す（補足を消す・答えを変える）
  r = await putC(K2, { ...C, answers: [{ question_id: 'commuting_transport', code: 'always' }] });
  const m2 = Object.fromEntries((await mineA(K2, A_ONE)).answers.map((x) => [x.question_id, x]));
  ok(r.saved === 1 && !('key' in r) && m2.commuting_transport.code === 'always' && m2.commuting_transport.text === null
     && (await mineA(K2, A_ONE)).answers.length === 5, '★答えを直せる（行は増えない・消した補足は消える）', J(m2.commuting_transport));

  ok(bad(await putC(K2, { ...C, answers: [] }), /回答がありません/), '答えが空なら断る');
  ok(bad(await putC(K2, { airline: 'other', answers: [{ question_id: 'reserve_duty', code: 'yes' }] }), /ログインしてから/),
    '一覧に無い会社（自由入力）は預からない');
  ok(bad(await putC(K2, { ...C, answers: Array.from({ length: 61 }, () => ({ question_id: 'reserve_duty', code: 'yes' })) }), /60件まで/),
    '一度に61件は断る');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 5. 預かっているあいだは、集計にも他人の画面にも出ない');
// ════════════════════════════════════════════════════════════
const WALL_M = ago(1);
const wallKeys = [];
{
  // 未ログインの3台が、同じ会社・同じ月を出す
  for (const bh of [70, 80, 90]) {
    const r = await putW(null, { airline: A_WALL, position: 'cap', ...WALL_M, block_hours: bh, note: '預かりのひとこと' });
    wallKeys.push(r.key);
    await putC(r.key, { airline: A_WALL, position: 'cap', answers: [
      { question_id: 'peer_support', code: 'internal', text: '預かりの補足', share: true }] });
  }
  ok(wallKeys.every((k) => KEY.test(k || '')) && new Set(wallKeys).size === 3, '3台それぞれに別の鍵');
  const v = await view(READER, { airline: A_WALL });
  ok(v.state === 'open' && v.by.cap.block_hours === null, '★未ログインの3人ぶんでは、勤務の幅は出ない（3人の壁を鍵3本で破れない）', J(v.by?.cap));
  ok(await cnt(`public.airline_condition_facts where airline = $1`, [A_WALL]) === 0, '★公開の集計にも入っていない');
  const n = await notes(READER, A_WALL);
  ok(n.state === 'open' && n.notes.length === 0, '★預かりの補足・ひとことは、資格者にも出ない', J(n));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 6. ログインして引き継ぐ');
// ════════════════════════════════════════════════════════════
{
  const three = await crew(3);
  const snap = async (id) => J(await one(`select to_jsonb(f) - 'work_months_today' - 'work_months_day'
                                             - 'cond_answers_today' - 'cond_answers_day' as j
                                        from public.profiles f where id = $1`, [id]));
  const before = await snap(three[0]);
  const g0 = await give(three[0]);

  const r = await claim(three[0], wallKeys[0]);
  ok(r.ok && r.known === true && r.moved === 2 && r.kept === 0 && r.dropped === 0 && r.left === 0 && keys(r) === 'dropped,kept,known,left,moved,ok',
    '★鍵を出すと、預けた2件が会員の回答になる', J(r));
  const w = (await mineW(three[0], { airline: A_WALL })).rows;
  ok(w.length === 1 && w[0].block_hours === 70 && w[0].days_off === null && w[0].note === '預かりのひとこと',
    '★数字・未回答・ひとことが、1文字も変わらずに移っている', J(w));
  const c = (await mineC(three[0], { airline: A_WALL })).answers;
  ok(c.length === 1 && c[0].code === 'internal' && c[0].text === '預かりの補足', '★選んだ答えと補足も移っている', J(c));
  ok((await one(`select text_shared from public.airline_conditions where airline = $1`, [A_WALL])).text_shared === true,
    '   「見せます」の印も一緒に移っている');

  // 鍵は1回で消える
  const again = await claim(three[1], wallKeys[0]);
  ok(again.known === false && again.moved === 0, '★同じ鍵は、もう誰も使えない（別の会員が横から引き取れない）', J(again));
  ok((await mineA(wallKeys[0], A_WALL)).known === false, '   預かりの読み口も、もう空');
  ok(await cnt(`public.pv_contrib_pending p join public.pv_contrib_keys k using (key_hash)
               where p.airline = $1`, [A_WALL]) === 4, '   ほかの2台の預かりはそのまま');

  // 資格は1つも付かない
  const g1 = await give(three[0]);
  ok(J(g0) === J(g1) && g1.basic === false, '★引き継いでも pv_my_give() は1文字も変わらない（basic:false のまま）', J(g1));
  ok(before === await snap(three[0]), '★profiles は連投の数え以外、1列も変わらない');
  const pr = await gate(three[0]);
  ok(pr.__err || pr.unlocked !== true, '★給与の一覧は閉じたまま', J(pr).slice(0, 120));
  ok(J(await view(three[0], { airline: A_WALL })) === '{"ok":true,"state":"locked"}', '★勤務の幅も閉じたまま（出しただけでは読めない）');
  ok((await notes(three[0], A_WALL)).state === 'member', '   補足の読み口も「会員」のまま');

  // 3人が引き継いで、はじめて幅が出る
  let v = await view(READER, { airline: A_WALL });
  ok(v.by.cap.block_hours === null, '1人が引き継いだだけでは、まだ出ない');
  await claim(three[1], wallKeys[1]);
  v = await view(READER, { airline: A_WALL });
  ok(v.by.cap.block_hours === null, '2人でも出ない');
  await claim(three[2], wallKeys[2]);
  v = await view(READER, { airline: A_WALL });
  ok(v.by.cap.block_hours && v.by.cap.block_hours.lo === 75 && v.by.cap.block_hours.hi === 85,
    '★3人が引き継いで、はじめて勤務の幅が出る（投稿が集計へ届く）', J(v.by.cap));
  ok(await cnt(`public.airline_condition_facts where airline = $1 and question_id = 'peer_support'`, [A_WALL]) >= 1,
    '★公開の集計にも入る');
  ok(await cnt(`public.pv_contrib_pending where airline = $1`, [A_WALL]) === 0, '預かりは空になった');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 7. 引き継ぎで、新しいほうが残る');
// ════════════════════════════════════════════════════════════
{
  const [P1, P2] = await crew(2);
  const M = ago(2);
  // 先に預ける → あとから会員として同じ月・同じ質問を出す（会員の側が新しい）
  const r = await putW(null, { airline: A_NEW, position: 'fo', ...M, work_days: 10 });
  await putC(r.key, { airline: A_NEW, answers: [{ question_id: 'landing_pay', code: 'fixed' }] });
  await db.exec(`update public.pv_contrib_pending set updated_at = now() - interval '2 hours' where airline = '${A_NEW}'`);
  await workM(P1, { airline: A_NEW, position: 'fo', ...M, work_days: 20 });
  await condM(P1, { airline: A_NEW, answers: [{ question_id: 'landing_pay', code: 'variable' }] });
  let c = await claim(P1, r.key);
  ok(c.moved === 0 && c.kept === 2 && c.left === 0, '★会員の側が新しければ、預かりは捨てる（古い内容で上書きしない）', J(c));
  ok((await mineW(P1, { airline: A_NEW })).rows[0].work_days === 20
     && (await mineC(P1, { airline: A_NEW })).answers[0].code === 'variable', '   会員の回答はそのまま');

  // 会員が先に出していて、あとから未ログインで直した（預かりの側が新しい）
  await workM(P2, { airline: A_NEW, position: 'fo', ...M, work_days: 20 });
  await db.exec(`update public.pv_work_months set updated_at = now() - interval '2 hours'
                  where proof_hash = public.pv_work_hash('${P2}'::uuid, '${A_NEW}', null)`);
  const r2 = await putW(null, { airline: A_NEW, position: 'fo', ...M, work_days: 11 });
  c = await claim(P2, r2.key);
  ok(c.moved === 1 && c.kept === 0, '★預かりの側が新しければ、それで直る', J(c));
  const rows = (await mineW(P2, { airline: A_NEW })).rows;
  ok(rows.length === 1 && rows[0].work_days === 11, '   同じ月は1行のまま（増えない）', J(rows));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 8. 他人の補足（立場ごとに何が返るか）');
// ════════════════════════════════════════════════════════════
{
  const [W1, W2, MEM, REV, PIL, PAYER] = await crew(6);
  const M = ago(1);
  // W1 が「見せます」で書く：勤務（roster）・訓練（career）・福利（benefits）＋月の勤務のひとこと
  await condM(W1, { airline: A_NOTE, position: 'cap', fleet: 'b787', answers: [
    { question_id: 'reserve_duty', code: 'yes', text: '月に3日ほど', share: true },
    { question_id: 'training_bond', code: 'yes', text: '3年で消える', share: true },
    { question_id: 'peer_support', code: 'internal', text: '社内に窓口', share: true },
    { question_id: 'landing_pay', code: 'fixed', text: '印を付けていない補足' }] });
  await workM(W1, { airline: A_NOTE, position: 'cap', ...M, block_hours: 80, note: '冬は少なめ' });
  // W2 は補足なしで答えるだけ
  await condM(W2, { airline: A_NOTE, answers: [{ question_id: 'peer_support', code: 'no' }] });

  // 立場を作る
  await db.query(`insert into public.reviews_v2 (proof_hash, airline) values ($1, $2)`, ['r'.repeat(40), A_NOTE]);   // 口コミを書いた人（鍵は別物）
  const hasVL = await cnt(`information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'verify_level'`) === 1;
  if (hasVL) await db.query(`update public.profiles set verify_level = 1 where id = $1`, [PIL]);
  await unlock(PAYER);

  const EXACT = '{"ok":true,"state":"login"}';
  ok(J(await notes(ANON, A_NOTE)) === EXACT, '★未ログインには、1文字も返らない', J(await notes(ANON, A_NOTE)));
  ok(J(await notes(ANON, 'no-such-airline')) === EXACT && J(await rpc(ANON, 'pv_contrib_notes')) === EXACT,
    '   知らない会社を聞いても同じ返事（在る・無いの手がかりを返さない）');

  const texts = (r) => (r.notes || []).map((x) => x.text).sort().join('|');
  const mem = await notes(MEM, A_NOTE);
  ok(mem.state === 'member' && texts(mem) === '社内に窓口', '★ログインしただけの会員には、勤務・訓練と月の勤務**以外**の補足だけ', J(mem));
  const rev = await notes(REV, A_NOTE);
  ok(rev.state === 'member' && texts(rev) === '社内に窓口', '★口コミの資格では、勤務の補足は開かない（会員と同じ）', J(rev));
  const pil = await notes(PIL, A_NOTE);
  ok(pil.state === 'member' && texts(pil) === '社内に窓口', `★確認済みパイロットの印でも開かない（給与の鍵とは別物${hasVL ? '' : '・この器に印の列は無い'}）`, J(pil));
  const payr = await notes(PAYER, A_NOTE);
  ok(payr.state === 'open' && texts(payr) === ['3年で消える', '冬は少なめ', '月に3日ほど', '社内に窓口'].sort().join('|'),
    '★給与の鍵が生きている会員には、勤務・訓練・月の勤務のひとことまで返る', J(payr));
  ok(!J(payr).includes('印を付けていない補足') && !J(mem).includes('印を付けていない補足'),
    '★「見せます」の印が無い補足は、誰にも返らない（今までの補足は本人だけのまま）');
  ok(payr.notes.every((x) => keys(x) === 'mine,q,text,topic'), '★1件の中身は 話題・質問・文・自分のものか の4つだけ', J(payr.notes[0]));
  const by = Object.fromEntries(payr.notes.map((x) => [x.text, x]));
  ok(by['月に3日ほど'].topic === 'roster' && by['月に3日ほど'].q === 'reserve_duty' && by['3年で消える'].topic === 'career'
     && by['社内に窓口'].topic === 'benefits' && by['冬は少なめ'].topic === 'work' && by['冬は少なめ'].q === null,
    '   話題と質問の id が合っている（月の勤務のひとことは質問なし）');
  ok(payr.notes.every((x) => x.mine === false), '   他人が読むと、どれも「自分のもの」ではない');
  ok(!/"(yes|internal|fixed|cap|b787)"/.test(J(payr)) && !J(payr).includes(String(M.year)),
    '★選んだ答え・職位・機種・対象月は入っていない', J(payr));

  // 書いた本人が読む
  const own = await notes(W1, A_NOTE);
  ok(own.state === 'member' && own.notes.length === 1 && own.notes[0].mine === true, '書いた本人には「自分のもの」の印が付く（鍵が無ければ範囲は会員と同じ）', J(own));
  await unlock(W1);
  const own2 = await notes(W1, A_NOTE);
  ok(own2.state === 'open' && own2.notes.length === 4 && own2.notes.every((x) => x.mine === true), '給与の鍵が生きれば全部読める（全部自分のもの）', J(own2));

  // 鍵が切れた・運営
  await db.query(`update public.profiles set access_until = now() - interval '1 minute' where id = $1`, [PAYER]);
  ok((await notes(PAYER, A_NOTE)).state === 'member' && texts(await notes(PAYER, A_NOTE)) === '社内に窓口', '★給与の鍵が切れたら、会員の範囲へ戻る');
  if (await cnt(`information_schema.tables where table_schema = 'public' and table_name = 'pv_admins'`) === 1) {
    await db.query(`insert into public.pv_admins (user_id, note) values ($1, 'test') on conflict do nothing`, [MEM]);
    ok((await notes(MEM, A_NOTE)).state === 'open', '運営は全部読める（運営の名簿に居る人だけ）');
    await db.query(`delete from public.pv_admins where user_id = $1`, [MEM]);
  }
  ok(bad(await notes(MEM, 'no-such-airline'), /航空会社が正しくありません/) && bad(await notes(MEM, 'other'), /航空会社が正しくありません/),
    '会員が知らない会社・自由入力の会社を聞いたら断る');
  ok((await notes(MEM, A_BARE)).notes.length === 0, '補足の無い会社は空の一覧');

  // 補足を消したら出なくなる
  await condM(W1, { airline: A_NOTE, answers: [{ question_id: 'peer_support', code: 'internal' }] });
  ok((await notes(MEM, A_NOTE)).notes.length === 0, '★本人が補足を消したら、他人の画面からも消える');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 9. 期限と上限');
// ════════════════════════════════════════════════════════════
{
  const M = ago(1);
  // 期限（90日）
  const r = await putW(null, { airline: A_EXP, position: 'cap', ...M, days_off: 8 });
  const kh = async (key) => (await one(`select public.pv_contrib_key_hash($1) as h`, [key])).h;
  await db.query(`update public.pv_contrib_keys set last_at = now() - interval '89 days' where key_hash = $1`, [await kh(r.key)]);
  ok((await mineA(r.key, A_EXP)).known === true, '89日前に保存した預かりは、まだ読める');
  await db.query(`update public.pv_contrib_keys set last_at = now() - interval '91 days' where key_hash = $1`, [await kh(r.key)]);
  ok((await mineA(r.key, A_EXP)).known === false, '★91日たった預かりは、鍵を出しても読めない');
  const [P] = await crew(1);
  ok((await claim(P, r.key)).known === false, '   引き継ぎもできない');
  const r2 = await putW(r.key, { airline: A_EXP, position: 'cap', ...M, days_off: 7 });
  ok(KEY.test(r2.key || '') && r2.key !== r.key && r2.replaced === false, '切れた鍵で保存すると、新しい鍵で預かり直す', J(r2));
  ok(await cnt(`public.pv_contrib_keys where key_hash = $1`, [await kh(r.key)]) === 0
     && await cnt(`public.pv_contrib_pending where key_hash = $1`, [await kh(r.key)]) === 0,
    '★切れた鍵と、その預かりは片付いている');

  // 1本の鍵で1日80件
  const a = await putW(null, { airline: A_LIM, position: 'cap', ...M, days_off: 8 });
  await db.query(`update public.pv_contrib_keys set saves_today = 80, saves_day = current_date where key_hash = $1`, [await kh(a.key)]);
  ok(bad(await putW(a.key, { airline: A_LIM, position: 'cap', ...ago(2), days_off: 8 }), /しばらくしてから/), '★1日80件を超えたら、月の勤務は待ってもらう');
  const lim = await putC(a.key, { airline: A_LIM, answers: [{ question_id: 'landing_pay', code: 'fixed' }] });
  ok(lim.saved === 0 && lim.rejected[0]?.reason === 'rate_limited', '   質問への答えは、理由つきで返す', J(lim));
  await db.query(`update public.pv_contrib_keys set saves_day = current_date - 1 where key_hash = $1`, [await kh(a.key)]);
  ok((await putW(a.key, { airline: A_LIM, position: 'cap', ...ago(2), days_off: 8 })).ok === true, '   日が変われば、また保存できる');

  // 1本の鍵で200件
  await db.query(
    `insert into public.pv_contrib_pending (key_hash, kind, airline, item_key, payload)
     select $1, 'work', $2, 'x-' || g, '{}'::jsonb from generate_series(1, 198) g`, [await kh(a.key), A_LIM]);
  ok(bad(await putW(a.key, { airline: A_LIM, position: 'cap', ...ago(3), days_off: 8 }), /件数の上限/), '★預かりが200件あると、新しい月は預からない（ログインを案内）');
  ok((await putW(a.key, { airline: A_LIM, position: 'cap', ...M, days_off: 5 })).replaced === true, '   すでに預けた月を直すことはできる');
  await db.query(`delete from public.pv_contrib_pending where item_key like 'x-%'`);

  // 同じ回線から1日に作れる鍵は20本
  await db.query(`select set_config('request.headers', $1, false)`, [J({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })]);
  let made = 0, stopped = null;
  for (let i = 0; i < 21; i++) {
    const x = await putW(null, { airline: A_LIM, position: 'fo', ...M, duty_days: 12 });
    if (x.__err) { stopped = x.__err; break; }
    made++;
  }
  ok(made === 20 && /しばらくしてから/.test(stopped || ''), '★同じ回線から1日に作れる鍵は20本まで', `made=${made} ${stopped || ''}`);
  await db.query(`select set_config('request.headers', $1, false)`, [J({ 'x-forwarded-for': '203.0.113.8' })]);
  ok(KEY.test((await putW(null, { airline: A_LIM, position: 'fo', ...M, duty_days: 12 })).key || ''), '   別の回線は巻き込まれない');
  ok(!J(await many(`select * from public.pv_contrib_keys`)).includes('203.0.113'), '★表に IP そのものは残っていない');
  await db.query(`select set_config('request.headers', '', false)`);
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 10. 通しの流れ（未ログインで出す → 読み直す → 直す → ログイン → 引き継ぐ）');
// ════════════════════════════════════════════════════════════
{
  const M = ago(1);
  const a = await putW(null, { airline: A_FLOW, position: 'fo', fleet: 'a320', ...M, block_hours: 60, stay_nights: 0, note: '初回' });
  await putC(a.key, { airline: A_FLOW, position: 'fo', answers: [
    { question_id: 'commuting_transport', code: 'always', text: '自宅まで', share: true },
    { question_id: 'commuting_transport_method', codes: ['company_taxi'] },
    { question_id: 'commuting_taxi_cap', code: 'per_ride', text: '上限あり', share: true },
    { question_id: 'upgrade_order', code: 'seniority', text: '年功', share: true },
    { question_id: 'upgrade_min_hours', code: 'none' },
    { question_id: 'upgrade_min_tenure', code: 'y3_5' }] });
  let m = await mineA(a.key, A_FLOW);
  ok(m.rows.length === 1 && m.answers.length === 6, '★話題の入口からだけ出る4問も、未ログインのまま答えられる', J(m.answers.map((x) => x.question_id)));
  await putW(a.key, { airline: A_FLOW, position: 'fo', fleet: 'a320', ...M, block_hours: 65, stay_nights: 0, note: '直した' });
  m = await mineA(a.key, A_FLOW);
  ok(m.rows[0].block_hours === 65 && m.rows[0].stay_nights === 0 && m.rows[0].note === '直した', '読み直して、直せる');

  const [P] = await crew(1);
  const c = await claim(P, a.key);
  ok(c.moved === 7 && c.dropped === 0 && c.left === 0, '★ログインして引き継ぐと、7件とも会員の回答になる（親→子の順で通る）', J(c));
  const mw = (await mineW(P, { airline: A_FLOW })).rows[0];
  const mc = Object.fromEntries((await mineC(P, { airline: A_FLOW })).answers.map((x) => [x.question_id, x]));
  ok(mw.block_hours === 65 && mw.stay_nights === 0 && mw.days_off === null && mw.fleet === 'a320' && mw.note === '直した'
     && mc.commuting_taxi_cap.text === '上限あり' && mc.upgrade_order.text === '年功' && mc.upgrade_min_tenure.code === 'y3_5'
     && J(mc.commuting_transport_method.codes) === '["company_taxi"]',
    '★引き継いだあと、会員の読み口から同じ内容が返る（0 は 0・未回答は未回答）', J({ mw, mc: Object.keys(mc) }));
  ok(await cnt(`public.pv_contrib_keys where key_hash = public.pv_contrib_key_hash($1)`, [a.key]) === 0, '鍵は消えている');
  // 会員になったあとは、会員の入口でそのまま直せる
  const u = await workM(P, { airline: A_FLOW, position: 'fo', fleet: 'a320', ...M, block_hours: 66 });
  ok(u.ok === true && (await mineW(P, { airline: A_FLOW })).rows.length === 1, '引き継いだ月を、会員として直せる（行は増えない）');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 11. 外へ出てはいけないものが、どの返事にも入っていない');
// ════════════════════════════════════════════════════════════
{
  const all = seen.map((s) => s.json).join('\n');
  ok(!/[0-9a-f]{64}/.test(all), '★64文字の16進（表に置く形・人の印）が、どの返事にも無い');
  ok(!/proof_hash|key_hash|ip_day|"user_id"|"email"/.test(all), '人の印・鍵の表の列・IP・メールの名前が、どの返事にも無い');
  const withKey = seen.filter((s) => /"key":/.test(s.json));
  ok(withKey.length > 0 && withKey.every((s) => s.fn === 'submit_contrib_anon'), '★鍵が入っている返事は、預けた時の返事だけ',
    J([...new Set(withKey.map((s) => s.fn))]));
  ok(seen.filter((s) => s.fn === 'my_contrib_anon' || s.fn === 'claim_contrib' || s.fn === 'pv_contrib_notes')
        .every((s) => !/[0-9a-f]{48}/.test(s.json)), '読み口・引き継ぎ・補足の返事に、鍵は1本も入っていない');
  ok(seen.filter((s) => s.fn === 'pv_contrib_notes').every((s) => !/updated_at|created_at|"position"|"fleet"|"code"/.test(s.json)),
    '補足の返事に、時刻・職位・機種・選んだ答えの欄が無い');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 12. 前提が無い DB では、日本語の案内で止まる');
// ════════════════════════════════════════════════════════════
{
  const bare = new PGlite({ extensions: { pgcrypto } });
  await bare.waitReady;
  await bare.exec(`create schema if not exists extensions;`);
  let e = null;
  try { await bare.exec(CONTRIB_SQL); } catch (x) { e = String(x.message || x); }
  ok(e !== null && e.includes('db/work-months.sql') && /[ぁ-ん]/.test(e), '勤務の SQL が無い → 「先に db/work-months.sql」', e === null ? '止まらずに流れた' : e);
  const none = (await bare.query(`select to_regclass('public.pv_contrib_pending') is null as n`)).rows[0].n;
  ok(none === true, '止まったときは表を作っていない');
  await bare.close();
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
