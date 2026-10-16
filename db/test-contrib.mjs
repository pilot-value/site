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
     ★ 他人の補足は、立場をサーバが見てから返す。未ログインにも、給与の鍵が無い会員にも、1文字も返らない。
       給与の鍵が生きている人には、自分の会社は全部。ほかの会社は、自分の会社に5つ答えてから。
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
  catch (e) { return { err: String(e.message || e), code: e.code || null }; }
  finally { await asOwner(); }
};
const no = (r) => !!(r.err && /permission denied/i.test(r.err));

/* 外へ返った JSON は全部ためておく（最後の節で「出てはいけないもの」を1つ残らず見る）。 */
const seen = [];
/* 検査のあいだに、鍵の表に在った「回線の印」（9 でためて、11 でどの返事にも無いことを見る）。 */
const MARKS = [];
const rpc = async (who, fn, p) => {
  const r = await call(who, `select public.${fn}($1::jsonb) as v`, [p === undefined ? null : J(p)]);
  if (r.err) return { __err: r.err, __code: r.code };
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
const facts  = (who, airline, keys) => rpc(who, 'pv_contrib_facts', { ...(airline ? { airline } : {}), ...(keys ? { keys } : {}) });
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
  `select code from public.pv_airlines where code <> 'other' and active order by code limit 13`)).map((r) => r.code);
const [A_ONE, A_TWO, A_WALL, A_CLAIM, A_NEW, A_NOTE, A_LIM, A_EXP, A_FLOW, A_BARE, A_HOME, A_OTH, A_FACT] = AIR;

/* ── 「誰に見せるか」の節（8-0）で使う道具 ────────────────────────
   他人の回答を読める人は、ここの paid で作る ＝ 本物の submit_pay_report を通す。
   上の unlock（access_until を手で書く）で立てた鍵には給与の行が無いので、決める所は 'locked' と答える
   （＝ 鍵の無い会員と同じ返事）。「開いた読み手」を unlock で作らない。 */
// 準備の確かめ。通れば何も数えない。崩れたら ❌ を1行出して数える（黙って先へ進まない）
const must = (c, l, e = '') => { if (!c) ok(false, '（準備が崩れた）' + l, e); return !!c; };
// 給与を1件出す。db/test-work-months.mjs の FLEET / PAY / pay の写し（1日の件数は毎回戻す）
const FLEET = (await one(`select code from public.pv_fleets where active order by code limit 1`)).code;
const PAY = { currency: 'USD', lang: 'en', tax_rate_pct: 0, position: 'cap', fleet: FLEET,
              base_pay: 9000, flight_variable_pay: 4000, other_allowance: 4400,
              command_pay: 2000, per_diem: 1000, housing_type: 'allowance', housing_amount: 600 };
const pay = async (who, p) => {
  await db.query(`select set_config('pv.uid', $1, false)`, [who]);
  try { return (await db.query(`select public.submit_pay_report($1::jsonb) as v`, [J({ ...PAY, ...p })])).rows[0].v; }
  catch (e) { return { __err: String(e.message || e) }; }
  finally { await asOwner(); await db.exec(`update public.profiles set pay_reports_today = 0`); }
};
// その会社で、先月ぶんの給与を出す（月は DB の時計から取る。打ち込まない・未来の月にしない）
const paid = async (who, airline, x = {}) => {
  const r = await pay(who, { airline, period_year: ago(1).year, period_month: ago(1).month, ...x });
  must(!r.__err && r.access_until != null, `給与を出せなかった（${airline}）`, J(r));
  return r;
};
// 答えに使う質問6つ。質問の表から読む（打ち込まない）── 親の無い「選ぶ」質問を、聞く順に。答えは「わからない」でない最初の選択肢
const FIVE = (await many(
  `select id, choice_codes from public.pv_condition_questions
    where active and parent is null and kind = 'choice' order by priority, id`))
  .slice(0, 6).map((q) => ({ question_id: q.id, code: q.choice_codes.find((c) => c !== 'unknown') }));
// その会社について、FIVE の頭から n 問に答える
const five = async (who, airline, n = 5) => {
  const r = await condM(who, { airline, answers: FIVE.slice(0, n) });
  must(r.saved === n, `${n}問を保存できなかった（${airline}）`, J(r));
  return r;
};
// 自分の会社（A_HOME）に給与を出して、5つ答えた人 ＝ ほかの会社も開く人
const qualify = async (who) => { await paid(who, A_HOME); await five(who, A_HOME); };
/* 決める所（pv_contrib_sees）を、その人として読む。外からは呼べない関数なので、持ち主の役のまま、読む人だけを差し替える
   （上の give が pv_my_give を読むのと同じやり方）。ANON と DEAD は「読む人なし」（as と同じ扱い）。 */
const sees = async (who, airline) => {
  await db.query(`select set_config('pv.uid', $1, false)`, [typeof who === 'string' ? who : '']);
  try { return (await db.query(`select public.pv_contrib_sees($1) as s`, [airline])).rows[0].s; }
  finally { await asOwner(); }
};
// その人の「自分の会社」のうち code の会社について、答えた質問の数。自分の会社でなければ null
const haveOf = async (who, code) => {
  const o = (await many(`select * from public.pv_contrib_own($1)`, [who])).find((x) => x.o_code === code);
  return o ? Number(o.o_have) : null;
};
// カードの材料（外から呼べる口）を、その人として読む
const giveOf = (who) => rpc(who, 'pv_contrib_give');
/* 開いていない人への、補足の読み口の返事。字として、この3つのどれか（一覧も、会社の名前も、数も入らない）。 */
const L0 = '{"ok":true,"state":"login"}', L1 = '{"ok":true,"state":"locked"}', L2 = '{"ok":true,"state":"give"}';

/* 読む人（どの会社も開いている人）。開くのは 5 の頭の qualify から ＝ 本物の給与 ＋ 自分の会社（A_HOME）に5つ。
   ここで開かないのは、4 が会員の回答の表を1度まるごと空にするため（先に答えた5つが消える）。 */
const READER = await member();


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
    ok(no(await call(who, `select public.pv_contrib_mark_sweep()`)), `${name}は回線の印を片付ける関数を直接呼べない`);
  }
  ok(denied(await claim(ANON, 'a'.repeat(48))), '★未ログインは引き継ぎを呼べない（実行権が無い）');
  ok(bad(await claim(DEAD, 'a'.repeat(48)), /ログインが必要/), 'ログインが死んでいる会員も引き継げない');

  const chk = (await db.query(CONTRIB_SQL.slice(CONTRIB_SQL.lastIndexOf('\nselect (select count(*) from pg_policies')))).rows[0];
  const vals = Object.entries(chk);
  ok(vals.length === 10 && Number(vals[0][1]) === 0 && vals.slice(1).every(([, v]) => v === true),
    '末尾の検算：ポリシー数 0・残り9つが全部 true', J(chk));
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
  const same = (r) => r && r.ok === true && r.known === false && r.rows.length === 0 && r.answers.length === 0 && keys(r) === 'answers,known,ok,rows,towns' && r.towns.length === 0;
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
await qualify(READER);
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
  ok(await cnt(`public.airline_condition_facts where airline = $1`, [A_WALL]) === 0, '★集計にも入っていない');
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
  ok(r.ok && r.known === true && r.moved === 2 && r.kept === 0 && r.dropped === 0 && r.stale === 0 && r.left === 0 && keys(r) === 'dropped,kept,known,left,moved,ok,stale',
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
  ok(J(await notes(three[0], A_WALL)) === L1, '   TN2 補足の読み口も閉じたまま（自分が引き継いだ補足が在る会社でも、1文字も返らない）');

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
    '★集計にも入る');
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
console.log('\n▼ 8-0. 誰に見せるか（自分の会社・5つ）');
// ════════════════════════════════════════════════════════════
/* ★2026-10-11 オーナー指定:
     「他の人が出した情報は、給与提出後に見れる形。」
     「給与を提出していて、やっぱり5つにしよう。さらに自分の会社に5つ以上答えた人（両方）」
   決める所は db/contrib.sql の pv_contrib_sees の1か所。返すのは login / locked / give / open の1語。
   ここで見るのは、その1語と、カードの材料（pv_contrib_give）だけ。
   ⚠️ 会社（A_HOME / A_OTH）と質問（FIVE）は表から読む。答えの中身は検査のための作りもの。
   ⚠️ 落とし方（わざと壊して赤を見る）は、db/contrib.sql の 6-b の側を壊す。ここの期待を緩めない。 */
{
  const [MEM, HAND, P1] = await crew(3);
  const LOCKED = '{"ok":true,"state":"locked"}', OPEN = '{"ok":true,"state":"open"}';
  // 在る会社・知らない会社・会社なし の3つを続けて聞く
  const three = async (who) => [await sees(who, A_HOME), await sees(who, 'no-such-airline'), await sees(who, null)].join(' ');

  // ── TM1 外から呼べる関数ではない ──
  for (const [who, name] of [[ANON, '未ログイン'], [MEM, '会員']]) {
    const r = [await call(who, `select public.pv_contrib_sees($1)`, [A_HOME]),
               await call(who, `select count(*) from public.pv_contrib_own($1)`, [MEM]),
               await call(who, `select public.pv_contrib_need()`)];
    ok(r.every(no), `★TM1 ${name}は、決める所（pv_contrib_sees）・自分の会社の一覧（pv_contrib_own）・数（pv_contrib_need）を直接呼べない`,
      r.map((x, i) => `${['sees', 'own', 'need'][i]}: ${x.err ? x.err.split('\n')[0] : '呼べた ' + J(x.v)}`).join(' ｜ '));
  }
  const vol = await many(
    `select proname, provolatile from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname in ('pv_contrib_sees', 'pv_contrib_own', 'pv_contrib_give', 'pv_contrib_need')
      order by proname`);
  ok(vol.map((x) => `${x.proname}:${x.provolatile}`).join(' ')
       === 'pv_contrib_give:s pv_contrib_need:i pv_contrib_own:s pv_contrib_sees:s',
    '   TM1 決める所・自分の会社・カードの材料は stable（何も書かない）／数は immutable', J(vol));

  // ── TM2 立場が先 ──
  const anon3 = await three(ANON), dead3 = await three(DEAD), mem3 = await three(MEM);
  ok(anon3 === 'login login login' && dead3 === 'login login login',
    '★TM2 立場が先 ── 未ログイン・ログインが死んでいる人には、在る会社・知らない会社・会社なし のどれを聞いても login', J({ anon3, dead3 }));
  ok(mem3 === 'locked locked locked', '★TM2 ログインしただけの会員（給与の鍵が無い）には、どれを聞いても locked', mem3);

  // ── TM3 手で立てた鍵（給与の行が1つも無い）──
  await unlock(HAND);
  const hand3 = await three(HAND), handOth = await sees(HAND, A_OTH);
  ok(hand3 === 'locked locked locked' && handOth === 'locked',
    '★TM3 給与の鍵だけを手で立てた人（給与の行が1つも無い）には、どの会社を聞いても locked ＝ 鍵の無い会員と同じ', J({ hand3, handOth }));
  const handGive = J(await giveOf(HAND));
  ok(handGive === LOCKED, '   TM3 その人のカードの材料も {ok, state:locked} だけ（1文字も違わない）', handGive);

  // ── TM4 自分の会社は、給与の鍵だけで開く ──
  await paid(P1, A_HOME);
  const own4 = await sees(P1, A_HOME);
  const oth4 = [await sees(P1, A_OTH), await sees(P1, 'no-such-airline'), await sees(P1, null)].join(' ');
  ok(own4 === 'open', '★TM4 自分の会社（給与を出した会社）は、給与の鍵だけで open（まだ1つも答えていない）', own4);
  ok(oth4 === 'give give give', '★TM4 ほかの会社・知らない会社・会社なし は give（自分の会社に5つ答えるまで）', oth4);

  // ── TM5 4つ → 5つ ──
  await five(P1, A_HOME, 4);
  const s4 = await sees(P1, A_OTH), g4 = await giveOf(P1);
  ok(s4 === 'give' && g4.state === 'give' && g4.airline === A_HOME && g4.have === 4 && g4.need === 5,
    '★TM5 自分の会社に4つ答えた人 ── ほかの会社は give のまま。カードの材料は 自分の会社・have 4・need 5', J({ sees: s4, give: g4 }));
  const r5 = await condM(P1, { airline: A_HOME, answers: [FIVE[4]] });
  const s5 = await sees(P1, A_OTH), g5 = J(await giveOf(P1));
  ok(r5.saved === 1 && s5 === 'open' && g5 === OPEN,
    '★TM5 5つ目を答えたら、ほかの会社が open。カードの材料は {ok, state:open} だけ', J({ saved: r5.saved, sees: s5, give: g5 }));

  /* ── ここから TM6〜TM20：数え間違える道を1つずつ塞ぐ ──
     どの人も、まず自分の会社（A_HOME）に給与を出す（paid）。そのうえで「5つ」に届く・届かないを見る。
     質問・選択肢・親子の組・社名は、どれも表から読む（下の Q / PAIR / nameOf）。 */
  const LOGIN = '{"ok":true,"state":"login"}';
  const Q = Object.fromEntries((await many(
    `select id, kind, parent, priority, choice_codes, num_min from public.pv_condition_questions where active`)).map((q) => [q.id, q]));
  const codesOf = (id) => (Q[id].choice_codes || []).filter((c) => c !== 'unknown');
  const ans = (who, airline, answers, more = {}) => condM(who, { airline, ...more, answers });
  const nameOf = async (code) => (await one(`select name_ja from public.pv_airlines where code = $1`, [code])).name_ja;
  const state = async (who, airline) => `${await haveOf(who, A_HOME)} ${await sees(who, airline)}`;   // 「自分の会社の数 ほかの会社の1語」
  const HOME_NAME = await nameOf(A_HOME), OTH_NAME = await nameOf(A_OTH);

  // ── TM6 同じ質問を何度答え直しても、1つ ──（壊して見る相手は無い：1人1問1行は表の決まり。別の数え方に替わったときの見張り）
  {
    const [P] = await crew(1);
    await paid(P, A_HOME);
    const q0 = FIVE[0].question_id, cs = codesOf(q0);
    must(cs.length >= 2, `TM6 ${q0} に「わからない」以外の選択肢が2つ以上要る`, J(cs));
    await ans(P, A_HOME, [FIVE[0]]);
    const first = await state(P, A_OTH);
    let saves = 0;
    for (let i = 1; i <= 5; i++) saves += (await ans(P, A_HOME, [{ question_id: q0, code: cs[i % cs.length] }])).saved || 0;
    const rows = await cnt(`public.airline_conditions where proof_hash = public.pv_condition_hash($1, $2, null) and question_id = $3`, [P, A_HOME, q0]);
    ok(first === '1 give' && saves === 5 && rows === 1 && await state(P, A_OTH) === '1 give',
      '★TM6 同じ質問を、答えを替えて5回答え直しても、数は1のまま（ほかの会社は give のまま）', J({ first, saves, rows, after: await state(P, A_OTH) }));
  }

  // ── TM7 スキップは答えではない・「ない」は答え ──
  {
    const [P] = await crew(1);
    await paid(P, A_HOME);
    await five(P, A_HOME, 4);
    const used = FIVE.slice(0, 4).map((x) => x.question_id);
    const noQ = Object.values(Q).filter((q) => q.kind === 'choice' && q.parent === null && q.choice_codes.includes('no') && !used.includes(q.id))
      .sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : 1))[0];
    must(!!noQ, 'TM7 「ない」（no）を選べる、親の無い質問が要る');
    const sk = await ans(P, A_HOME, [{ question_id: noQ.id, skip: true }]);
    const skipped = await state(P, A_OTH);
    ok(sk.skipped === 1 && sk.saved === 0 && skipped === '4 give',
      '★TM7 4つ答えた人が5つ目をスキップしても、数は4のまま（スキップは答えではない）', J({ skipped: sk.skipped, saved: sk.saved, state: skipped }));
    const no5 = await ans(P, A_HOME, [{ question_id: noQ.id, code: 'no' }]);
    const answered = await state(P, A_OTH);
    ok(no5.saved === 1 && answered === '5 open', '★TM7 同じ質問に「ない」と答えたら5つ目に数える（「ない」は答え）→ ほかの会社が open', J({ saved: no5.saved, state: answered }));
  }

  // ── TM8 「わからない」は数えない ──
  {
    const [P] = await crew(1);
    await paid(P, A_HOME);
    await five(P, A_HOME, 4);
    const u = await ans(P, A_HOME, [{ question_id: FIVE[4].question_id, code: 'unknown' }]);
    const st = await state(P, A_OTH);
    ok(u.saved === 1 && st === '4 give', '★TM8 5つ目を「わからない」と答えても、数は4のまま', J({ saved: u.saved, state: st }));
  }

  // ── TM9 0 は答え ──
  {
    const [P] = await crew(1);
    const zq = Q.annual_leave_days;
    must(!!zq && zq.kind === 'num' && zq.parent === null && Number(zq.num_min) === 0, 'TM9 annual_leave_days は、親の無い、下限 0 の数字の質問であること', J(zq || null));
    await paid(P, A_HOME);
    await five(P, A_HOME, 4);
    const z = await ans(P, A_HOME, [{ question_id: 'annual_leave_days', num: 0 }]);
    const st = await state(P, A_OTH);
    ok(z.saved === 1 && st === '5 open', '★TM9 5つ目に数字の 0 を答えたら、5つ目に数える（0 は答え）', J({ saved: z.saved, state: st }));
  }

  // ── TM10 上の質問を答え直すと、外れた下の質問は数えない（消してはいないので、戻せば戻る）──
  {
    const [P] = await crew(1);
    // 親子の組は表（pv_condition_links）から：親は親の無い「選ぶ」質問・「はい」（yes）で子が開く・子も「選ぶ」質問
    const PAIR = (await many(
      `select k.question_id as child, k.parent, k.parent_when
         from public.pv_condition_links k
         join public.pv_condition_questions c on c.id = k.question_id and c.active and c.kind = 'choice'
         join public.pv_condition_questions p on p.id = k.parent and p.active and p.kind = 'choice' and p.parent is null
        where 'yes' = any(k.parent_when)
          and (select count(*) from public.pv_condition_links z where z.question_id = k.question_id) = 1
        order by c.priority, c.id limit 1`))[0];
    const out = PAIR ? codesOf(PAIR.parent).find((c) => !PAIR.parent_when.includes(c)) : null;   // 子が外れる親の答え（「わからない」ではない）
    const plain = FIVE.filter((x) => PAIR && x.question_id !== PAIR.parent).slice(0, 3);
    must(!!PAIR && !!out && plain.length === 3 && codesOf(PAIR.child).length >= 1, 'TM10 親子の組と、子が外れる親の答えが、質問の表から取れること', J({ PAIR, out }));
    await paid(P, A_HOME);
    const r = await ans(P, A_HOME, [...plain, { question_id: PAIR.parent, code: 'yes' }, { question_id: PAIR.child, code: codesOf(PAIR.child)[0] }]);
    const full = await state(P, A_OTH);
    const re = await ans(P, A_HOME, [{ question_id: PAIR.parent, code: out }]);
    const cut = await state(P, A_OTH);
    const kept = await cnt(`public.airline_conditions where proof_hash = public.pv_condition_hash($1, $2, null) and question_id = $3 and answer_code is not null`, [P, A_HOME, PAIR.child]);
    ok(r.saved === 5 && full === '5 open' && re.saved === 1 && cut === '4 give' && kept === 1,
      '★TM10 親＋子で5つの人が、親を「子が開かない答え」に答え直すと、子は数えない（4・give。子の行は消していない）', J({ saved: r.saved, full, cut, kept, pair: PAIR, out }));
    const back = await ans(P, A_HOME, [{ question_id: PAIR.parent, code: 'yes' }]);
    const again = await state(P, A_OTH);
    ok(back.saved === 1 && again === '5 open', '   TM10 親を元の答えに戻すと、また5つ（open）', J({ saved: back.saved, again }));
  }

  /* ── TM10b 使わなくなった質問（active = false）への答えは数えない ──
     点検で足した見張り：「答えた」の決まりのうち「使っている質問」だけ、落ちる検査が無かった
     （pv_contrib_own の join から `and q.active` を外しても、この節は全部緑のままだった）。
     質問の表を一時的に書き換えるので、必ず元に戻す（db/test-conditions.mjs の「使わなくなった質問」と同じやり方）。 */
  {
    const [P] = await crew(1);
    await paid(P, A_HOME);
    await five(P, A_HOME);
    const q5 = FIVE[4].question_id;
    const on = await state(P, A_OTH);
    let off = null;
    await db.query(`update public.pv_condition_questions set active = false where id = $1`, [q5]);
    try { off = await state(P, A_OTH); }
    finally { await db.query(`update public.pv_condition_questions set active = true where id = $1`, [q5]); }
    const back = await state(P, A_OTH);
    ok(on === '5 open' && off === '4 give' && back === '5 open',
      '★TM10b 5つ答えた質問の1つが使われなくなったら、その答えは数えない（4・give）。質問が戻れば、また5つ（open）', J({ on, off, back, q: q5 }));
  }

  // ── TM11 自分の会社ではない会社についての回答は数えない ──
  {
    const [P] = await crew(1);
    await paid(P, A_HOME);
    await five(P, A_OTH);
    const st = [await haveOf(P, A_HOME), await haveOf(P, A_OTH), await sees(P, A_OTH), await sees(P, A_FLOW)];
    ok(J(st) === J([0, null, 'give', 'give']),
      '★TM11 給与を出していない会社について5つ答えても、数えない（自分の会社の数は 0・その会社も、ほかの会社も give）', J(st));
  }

  // ── TM12 ほかの会員の回答は数えない ──
  {
    const [X, P] = await crew(2);
    await five(X, A_HOME);                      // X は給与を出していない会員。A_HOME について5つ答える
    await paid(P, A_HOME);                      // P は A_HOME に給与を出しただけ（1つも答えていない）
    const st = await state(P, A_OTH), x = await sees(X, A_HOME);
    ok(st === '0 give' && x === 'locked', '★TM12 同じ会社についてほかの会員が5つ答えていても、自分の数は 0（give）。答えただけの会員は locked のまま', J({ st, x }));
  }

  // ── TM13 ログインせずに預けた回答は、引き継いでから数える ──
  {
    const [P] = await crew(1);
    const k = await putC(null, { airline: A_HOME, answers: FIVE.slice(0, 5) });
    must(KEY.test(k.key || '') && k.saved === 5, 'TM13 未ログインで5つ預けられること', J(k));
    await paid(P, A_HOME);
    const before = await state(P, A_OTH);
    ok(before === '0 give', '★TM13 預けただけの5つは、まだ数えない（引き継ぐ前は 0・give）', before);
    const c = await claim(P, k.key);
    const after = await state(P, A_OTH);
    ok(c.moved === 5 && after === '5 open', '★TM13 ログインして引き継いだら、5つとも数える（open）', J({ moved: c.moved, left: c.left, after }));
  }

  // ── TM14 罠：自分で書き換えられる字（プロフィールの在籍企業）で、会社を「自分の会社」にできない ──
  {
    const [P, Pb] = await crew(2);
    const fold = (await one(`select public.pv_airline_resolve($1) as c`, [OTH_NAME])).c;
    must(fold === A_OTH, 'TM14 ほかの会社の社名が、その会社の code に当たること（当たらないと、罠を試したことにならない）', J({ OTH_NAME, fold }));
    const rewrite = (id) => db.query(`update public.profiles set company = $2, name = $2, country = 'JP' where id = $1`, [id, OTH_NAME]);
    await paid(P, A_HOME);
    // (a) 会員が自分で書ける字を、ぜんぶ「ほかの会社」に書き換える
    await rewrite(P);
    const a = [await sees(P, A_OTH), (await giveOf(P)).airline];
    ok(J(a) === J(['give', A_HOME]), '★TM14a プロフィールの在籍企業・名前を「ほかの会社」に書き換えても、その会社は give のまま。カードが聞くのも、給与を出した会社のまま', J(a));
    // (b) その会社について5つ答える（給与は出していない）
    await five(P, A_OTH);
    const b = [await sees(P, A_OTH), await haveOf(P, A_HOME)];
    ok(J(b) === J(['give', 0]), '★TM14b そのうえで、その会社について5つ答えても give のまま（給与を出していない会社の回答は数えない）', J(b));
    // (c) 通る道は1つ ＝ その会社に、本物の給与をもう1件出す
    const n0 = (await one(`select pay_report_count as n from public.profiles where id = $1`, [P])).n;
    await paid(P, A_OTH);
    const n1 = (await one(`select pay_report_count as n from public.profiles where id = $1`, [P])).n;
    const c = [await sees(P, A_OTH), await sees(P, A_FLOW), await haveOf(P, A_OTH), n1 - n0];
    ok(J(c) === J(['open', 'open', 5, 1]),
      '★TM14c その会社に給与を出せば自分の会社になる（open）。(b) の5つも数に入り、ほかの会社も open。給与の件数は1つ増えている（給与の入口を通った）', J(c));
    await paid(Pb, A_HOME); await rewrite(Pb); await paid(Pb, A_OTH);
    const cb = [await sees(Pb, A_OTH), await sees(Pb, A_FLOW)];
    ok(J(cb) === J(['open', 'give']), '   TM14c 5つ答えていない人が同じことをしても、開くのは給与を出した会社だけ（ほかの会社は give）', J(cb));
    /* (d) 点検で足した見張り：「5つ」は1社について数える。自分の会社が2つある人の、会社をまたいだ合計ではない
       （pv_contrib_sees の `bool_or(o.o_have >= …)` を `sum(o.o_have) >= …` に替えても、この節は全部緑のままだった）。 */
    await five(Pb, A_HOME, 3);
    const r2 = await ans(Pb, A_OTH, FIVE.slice(3, 5));
    const d = [r2.saved, await haveOf(Pb, A_HOME), await haveOf(Pb, A_OTH), await sees(Pb, A_FLOW), (await giveOf(Pb)).state];
    ok(J(d) === J([2, 3, 2, 'give', 'give']),
      '★TM14d 自分の会社が2つある人が、片方に3つ・もう片方に2つ答えても、ほかの会社は give のまま（5つは1社について数える。会社をまたいで足さない）', J(d));
  }

  // ── TM15 鍵が切れたら閉じる・給与を出し直せば、答え直さずに開く ──
  {
    const live = [await sees(P1, A_HOME), await sees(P1, A_OTH)].join(' ');
    await db.query(`update public.profiles set access_until = now() - interval '1 minute' where id = $1`, [P1]);
    const dead = [await sees(P1, A_HOME), await sees(P1, A_OTH), await sees(P1, null)].join(' ');
    const deadGive = J(await giveOf(P1));
    ok(live === 'open open' && dead === 'locked locked locked' && deadGive === LOCKED,
      '★TM15 給与の鍵が切れたら、自分の会社も、ほかの会社も locked（5つ答えていても）。カードの材料も {ok, state:locked} だけ', J({ live, dead, deadGive }));
    await paid(P1, A_HOME);                     // 同じ会社・同じ月を出し直す ＝ 行は増えず、鍵が今から90日になる
    const renewed = [await sees(P1, A_HOME), await sees(P1, A_OTH), await haveOf(P1, A_HOME)];
    ok(J(renewed) === J(['open', 'open', 5]), '★TM15 給与を出し直したら、その場で open に戻る（回答は残っている ＝ 答え直さない）', J(renewed));
  }

  // ── TM16 運営 ──
  if (await cnt(`information_schema.tables where table_schema = 'public' and table_name = 'pv_admins'`) === 1) {
    const [OP] = await crew(1);
    await db.query(`insert into public.pv_admins (user_id, note) values ($1, 'test') on conflict do nothing`, [OP]);
    const op = [await sees(OP, A_HOME), await sees(OP, A_OTH), await sees(OP, 'no-such-airline'), await sees(OP, null)].join(' ');
    const opGive = J(await giveOf(OP));
    await db.query(`delete from public.pv_admins where user_id = $1`, [OP]);
    const off = await sees(OP, A_HOME);
    ok(op === 'open open open open' && opGive === OPEN && off === 'locked',
      '★TM16 運営は、給与も回答も無しで、どの会社も open。カードの材料は {ok, state:open} だけ（名簿から外れたら locked）', J({ op, opGive, off }));
  } else {
    console.log('  （この器に運営の名簿 pv_admins が無い ＝ TM16 は見ていない）');
  }

  // ── TM17 一覧に無い会社（打ち込んだ社名）も、自分の会社 ──
  {
    const [P] = await crew(1);
    await paid(P, 'other', { airline_other: 'Test Charter Gamma' });
    const s0 = await sees(P, A_HOME), g0 = await giveOf(P);
    ok(s0 === 'give' && g0.state === 'give' && g0.airline === 'other' && g0.name === 'Test Charter Gamma' && J(g0.ask) === '[]' && g0.have === 0,
      '★TM17 一覧に無い会社に給与を出した人 ── 一覧の会社は give。カードの材料は 会社 other・打ち込んだ社名・ask は空', J({ sees: s0, give: g0 }));
    const r = await ans(P, 'other', FIVE.slice(0, 5), { airline_other: 'test charter GAMMA' });   // 大文字小文字の違う綴り
    const st = [r.saved, await haveOf(P, 'other'), await sees(P, A_HOME)];
    ok(J(st) === J([5, 5, 'open']), '★TM17 その社名（綴りの大文字小文字が違っても）で5つ答えたら、一覧の会社が open', J(st));
  }

  // ── TM18 カードの材料（pv_contrib_give）──
  {
    const [R, Pc] = await crew(2);
    await paid(R, A_HOME);
    // その会社で、その質問に答えた人の数（持ち主の数え。「わからない」と、答えの無い行は数えない）
    const countAll = async () => Object.fromEntries((await many(
      `select q.id,
              (select count(distinct c.proof_hash)::int from public.airline_conditions c
                where c.airline = $1 and c.airline_other is null and c.question_id = q.id
                  and c.answer_code is distinct from 'unknown'
                  and num_nonnulls(c.answer_code, c.answer_codes, c.answer_num, c.answer_text, c.answer_json) > 0) as n
         from public.pv_condition_questions q where q.active`, [A_HOME])).map((x) => [x.id, x.n]));
    /* R は1つも答えていない ＝ 候補は、親の無い質問の全部。誰も答えていない候補が8つ以上あると、ask は「0人」が8つ並ぶだけで、
       「少ない順」を何も試さない。そこで R が、誰も答えていない候補を2つだけ残してスキップする（触った質問は ask から外れる）。
       残るのは、その2つ（0人）と、ほかの人が答えた質問 ＝ 並びに人数の違いが出る。R 自身の数は 0 のまま。 */
    const c0 = await countAll();
    const roots = Object.values(Q).filter((q) => q.parent === null).sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : 1)).map((q) => q.id);
    const nobody = roots.filter((id) => c0[id] === 0), somebody = roots.filter((id) => c0[id] > 0);
    must(nobody.length >= 2 && somebody.length >= 1, 'TM18 誰も答えていない質問が2つ以上・誰かが答えた質問が1つ以上あること', J({ nobody: nobody.length, somebody: somebody.length }));
    const skips = nobody.slice(2);
    if (skips.length) {
      const sk = await ans(R, A_HOME, skips.map((id) => ({ question_id: id, skip: true })));
      must(sk.skipped === skips.length, 'TM18 誰も答えていない質問をスキップできること', J(sk));
    }
    const C = await countAll();
    const g = await giveOf(R), text = J(g), text2 = J(await giveOf(R));
    const ask = Array.isArray(g.ask) ? g.ask : [];
    const mineRows = (await many(
      `select question_id from public.airline_conditions where proof_hash = public.pv_condition_hash($1, $2, null)`, [R, A_HOME])).map((x) => x.question_id);
    const shut = ask.every((id) => typeof id === 'string') ? await cnt(
      `unnest($1::text[]) x(id)
        where exists (select 1 from public.pv_condition_links k
                       where k.question_id = x.id
                         and not exists (select 1 from public.airline_conditions m
                                          where m.proof_hash = public.pv_condition_hash($2, $3, null) and m.question_id = k.parent
                                            and (m.answer_code = any(k.parent_when) or m.answer_codes && k.parent_when)))`, [ask, R, A_HOME]) : -1;
    const ns = ask.map((id) => C[id]);
    const want = Math.min(8, roots.length - skips.length);
    const digitFree = (s) => !/\d/.test(s);
    must(digitFree(A_HOME + HOME_NAME + A_OTH + OTH_NAME) && Object.keys(Q).every(digitFree), 'TM18 会社の code・社名・質問の id に数字が無いこと（在ると「数が入っていない」を字で見られない）');

    ok(keys(g) === 'airline,ask,have,name,need,ok,state' && g.state === 'give' && g.airline === A_HOME && g.name === HOME_NAME && g.have === 0 && g.need === 5,
      '★TM18 give の人のカードの材料は ok・state・airline・name・have・need・ask の7つだけ（会社は自分の会社・have は本人の数）', text);
    ok(J(await giveOf(ANON)) === LOGIN && J(await giveOf(DEAD)) === LOGIN && J(await giveOf(MEM)) === LOCKED,
      '   TM18 未ログイン・ログインが死んでいる人には {ok, state:login} だけ／鍵の無い会員には {ok, state:locked} だけ');
    ok(ask.length === want && ask.length <= 8 && new Set(ask).size === ask.length && ask.every((id) => typeof id === 'string' && !!Q[id])
       && !ask.some((id) => mineRows.includes(id)) && shut === 0,
      '★TM18 ask は8件まで・どれも使っている質問・本人が触った質問（答えた・スキップした）は無い・上の質問が開いていない下の質問も無い',
      J({ ask, want, touched: mineRows.length, shut }));
    ok(ns.length >= 2 && ns.every((n, i) => Number.isInteger(n) && (i === 0 || ns[i - 1] <= n)) && new Set(ns).size >= 2,
      '★TM18 ask の並びは、その会社で答えた人が少ない質問が先（持ち主の数えと突き合わせる。人数の違う質問が2種類以上並んでいる）', J(ns));
    ok(digitFree(text.replace(/"(have|need)":\d+/g, '')),
      '★TM18 返事に入っている数は have と need の2つだけ（ほかの人の回答の数は、1つも入っていない）', text);
    ok(text === text2, '   TM18 続けて2回読んでも、1文字も違わない（並びが動かない）', text2);

    await paid(Pc, A_HOME, { period_year: ago(2).year, period_month: ago(2).month });
    await paid(Pc, A_OTH);
    const gc = await giveOf(Pc);
    ok(gc.state === 'give' && gc.airline === A_OTH && gc.name === OTH_NAME && gc.have === 0,
      '★TM18 給与を2社に出した人のカードが聞くのは、対象月がいちばん新しい給与の会社（社名は会社の表の名前）', J(gc));
  }

  // ── TM19 読むだけでは、資格は1つも付かない ──（「決める所」と「カードの材料」を、開いている人・鍵の無い会員・give の人として読む、その前後を比べる）
  {
    const [G] = await crew(1);
    await paid(G, A_HOME);                      // give の人（カードの材料が最後の行まで走る）
    // 確認済みの印の列（verify_level）は、在る器でだけ見る（▼ 8 と同じ見方。この節の中で確かめ直す）
    const vlCol = await cnt(`information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'verify_level'`) === 1;
    const snap = async (who) => J({
      give: await give(who), gate: await gate(who),
      prof: await one(`select access_until${vlCol ? ', verify_level' : ''}, pay_report_count, badge from public.profiles where id = $1`, [who]) });
    const who3 = [P1, MEM, G];
    const words = [];
    const before = []; for (const w of who3) before.push(await snap(w));
    for (const w of who3) {
      for (let i = 0; i < 2; i++) {
        words.push(await sees(w, A_HOME), await sees(w, A_OTH), await sees(w, null), (await giveOf(w)).state);
      }
    }
    const after = []; for (const w of who3) after.push(await snap(w));
    ok(words.join(' ') === ['open open open open', 'open open open open', 'locked locked locked locked', 'locked locked locked locked', 'open give give give', 'open give give give'].join(' ')
       && J(before) === J(after),
      `★TM19 決める所・カードの材料を何度読んでも、給与の門（pv_my_give）・給与の一覧・給与の鍵の期限${vlCol ? '・確認済みの印' : ''}は1文字も変わらない（開いている人・鍵の無い会員・give の人）`,
      J({ words: words.join(' '), same: before.map((b, i) => b === after[i]) }));
  }

  // ── TM20 打ち込んだ社名が一覧の会社に当たるとき：打ち込んだ社名のままの回答も、code での回答も数える（同じ質問は1つ）──
  {
    const [P] = await crew(1);
    await paid(P, 'other', { airline_other: OTH_NAME });
    const folded = [await sees(P, A_OTH), await haveOf(P, A_OTH), await haveOf(P, 'other')];
    const r4 = await ans(P, 'other', FIVE.slice(0, 4), { airline_other: OTH_NAME });
    if (must(r4.saved === 4, 'TM20 打ち込んだ社名のままの回答を、サーバが4つ受け取ること（受け取らないなら、この先は見ていない）', J(r4))) {
      const typed = [await haveOf(P, A_OTH), await sees(P, A_FLOW)];
      ok(J(folded) === J(['open', 0, null]) && J(typed) === J([4, 'give']),
        '★TM20 一覧の会社の社名を打ち込んで給与を出した人 ── その会社が自分の会社（open）。打ち込んだ社名のまま答えた4つを数える（4・give）', J({ folded, typed }));
      const dup = await ans(P, A_OTH, [FIVE[0]]);                 // 同じ質問を、こんどは code で
      const twice = [dup.saved, await haveOf(P, A_OTH), await sees(P, A_FLOW)];
      ok(J(twice) === J([1, 4, 'give']), '★TM20 そのうち1つを code でも答えても、4のまま（同じ質問は、印が2つあっても1つ）', J(twice));
      const fifth = await ans(P, A_OTH, [FIVE[4]]);               // 別の質問を code で
      const done = [fifth.saved, await haveOf(P, A_OTH), await sees(P, A_FLOW)];
      ok(J(done) === J([1, 5, 'open']), '★TM20 別の質問を code で答えたら5つ（ほかの会社が open）', J(done));
    }
  }
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 8-0b. 次に聞く質問（ほかの人の回答の数を、並びにも返事にも使わない）');
// ════════════════════════════════════════════════════════════
/* 「次に聞く質問」（db/airline-conditions.sql の next_condition_questions）は、その会社で答えた人が少ない質問を先に出す。
   その数は、ほかの人の回答の数。返事に入れなくても、並びの段差が「ここは何人か答えている」の手がかりになる。
   そこで、数を並びに使う相手を、決める所（pv_contrib_sees）がその会社について open と言った人だけにした（2026-10-11）。
   ほかの人には、質問の表の順で出す ＝ 回答が在る会社と無い会社で、並び（質問の id の列）が1文字も違わない。
   ⚠️ 会社（A_QA / A_QB）も質問（X）も表から読む。会社は、どの節も回答を入れていない2社を、一覧の**末尾**から取る
      （頭から取ると、下の 8-2 の続きが使う会社に当たる。あちらは「上のどの節も回答を入れていない」が前提）。
   ⚠️ 落とし方（わざと壊して赤を見る）は、db/airline-conditions.sql の v_open の行を壊す。ここの期待を緩めない。 */
{
  const nextQ = (who, airline) => rpc(who, 'next_condition_questions', { airline, limit: 30 });
  const list  = (r) => ((r && r.questions) || []).map((q) => q.id);
  const ids   = (r) => J(list(r));
  const noN   = (r) => list(r).length > 0 && r.questions.every((q) => q.n == null);     // 人数の欄が無い（在っても空）
  const [A_QA, A_QB] = (await many(
    `select code from public.pv_airlines
      where code <> 'other' and active and code <> all($1::text[]) order by code desc limit 2`, [AIR])).map((r) => r.code);
  const dirty = A_QA && A_QB ? await cnt(`public.airline_conditions where airline = any($1::text[])`, [[A_QA, A_QB]]) : -1;

  if (must(!!A_QA && !!A_QB && A_QA !== A_QB && dirty === 0,
        '8-0b どの節も回答を入れていない会社が2つ要る（一覧の末尾から2つ。回答が1行でも在れば、この節は見ていない）', J({ A_QA, A_QB, rows: dirty }))) {
    const [QUAL, MEM, GIVE4, S1, S2, S3] = await crew(6);
    await qualify(QUAL);                                           // ほかの会社も開いている人
    await paid(GIVE4, A_HOME); await five(GIVE4, A_HOME, 4);       // give の人（自分の会社に4つ）
    const words = [await sees(QUAL, A_QA), await sees(QUAL, A_QB), await sees(MEM, A_QA), await sees(MEM, A_QB),
                   await sees(GIVE4, A_QA), await sees(GIVE4, A_QB)].join(' ');
    must(words === 'open open locked locked give give', '8-0b 読む3人の立場（開いている人・鍵の無い会員・give の人）', words);

    // 確認済みの印の列（verify_level）は、在る器でだけ見る
    const vl = await cnt(`information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'verify_level'`) === 1;
    const snap = async () => J(await many(
      `select id, access_until${vl ? ', verify_level' : ''} from public.profiles where id = any($1::uuid[]) order by id`, [[QUAL, MEM, GIVE4]]));
    const before = await snap();

    /* X ＝ 誰も答えていない会社（A_QB）で、開いている人に返る並びの中の1問。
       最初の3問（boost）に入っていない・親の無い・答えを1つ選ぶ質問で、すぐ後ろに同じ Tier の質問が続くもの
       （後ろに同じ Tier が居ないと、人数で後ろへ回っても場所が変わらない）。 */
    const LEDGER = Object.fromEntries((await many(
      `select id, kind, parent, boost, choice_codes from public.pv_condition_questions where active`)).map((q) => [q.id, q]));
    const openB = await nextQ(QUAL, A_QB);
    const qb = openB.questions || [];
    const posB = qb.findIndex((q, i) => {
      const L = LEDGER[q.id];
      return !!L && Number(L.boost || 0) === 0 && L.kind === 'choice' && L.parent === null && !!qb[i + 1] && qb[i + 1].tier === q.tier;
    });
    if (must(posB >= 0, '8-0b 後ろに同じ Tier の質問が続く、親の無い「選ぶ」質問が要る（X。無ければ、この節は見ていない）', ids(openB))) {
      const X = qb[posB].id;
      const code = LEDGER[X].choice_codes.find((c) => c !== 'unknown');
      // ほかの3人が、A_QA について X に答える（A_QB には誰も答えない）
      let seeded = 0;
      for (const s of [S1, S2, S3]) seeded += (await condM(s, { airline: A_QA, answers: [{ question_id: X, code }] })).saved || 0;
      must(seeded === 3, '8-0b 3人が A_QA について X に答えられること', J({ X, code, seeded }));

      // ── TQ1 給与の鍵が無い会員 ──
      const mA = await nextQ(MEM, A_QA), mB = await nextQ(MEM, A_QB);
      ok(ids(mA) === ids(mB) && noN(mA) && noN(mB),
        '★TQ1 給与の鍵が無い会員 ── 3人が答えた質問が在る会社でも、誰も答えていない会社でも、次の質問の並びは同じ。返事に人数は無い',
        J({ X, withAnswers: list(mA).indexOf(X), without: list(mB).indexOf(X) }));

      // ── TQ2 give の人（給与は出した・自分の会社にまだ4つ）──
      const gA = await nextQ(GIVE4, A_QA), gB = await nextQ(GIVE4, A_QB);
      ok(ids(gA) === ids(gB) && noN(gA) && noN(gB),
        '★TQ2 give の人（ほかの会社がまだ開いていない）── 同じく、並びは同じ。返事に人数は無い',
        J({ X, withAnswers: list(gA).indexOf(X), without: list(gB).indexOf(X) }));

      // ── TQ3 開いている人には、今までどおり（答えた人が少ない質問が先）──
      const openA = await nextQ(QUAL, A_QA);
      const posA = list(openA).indexOf(X);
      const rest = (r) => list(r).filter((id) => id !== X);
      const m = Math.min(rest(openA).length, rest(openB).length);
      ok((posA > posB || (posA === -1 && list(openA).length === 30)) && m > 0 && J(rest(openA).slice(0, m)) === J(rest(openB).slice(0, m)),
        '★TQ3 ほかの会社も開いている人には、今までどおり ── 3人が答えた質問は、その会社では後ろへ回る（ほかの質問の順は動かない）',
        J({ X, without: posB, withAnswers: posA, of: list(openA).length }));

      // ── TQ4 ほかは何も動いていない ──
      ok(keys(mA) === 'airline,mine_count,ok,questions' && mA.airline === A_QA && mB.airline === A_QB
         && J({ ...mA, airline: '' }) === J({ ...mB, airline: '' }),
        '   TQ4 鍵の無い会員への2社の返事は、会社の欄（airline）だけが違う', J({ a: keys(mA), b: keys(mB) }));
      ok(denied(await nextQ(ANON, A_QA)), '   TQ4 未ログインは、今までどおり呼べない（permission denied）');
      const after = await snap();
      ok(before === after, `   TQ4 次の質問を何度読んでも、給与の鍵の期限${vl ? '・確認済みの印' : ''}は1文字も変わらない（3人とも）`, J({ before, after }));

      /* ── TQ3b 自分の会社は、5つ答える前でも開いている（点検で足した）──
         給与を出した直後に出る「もう1問」は、ここを通る ＝ 自分の会社について・まだ1問も答えていない人。
         上の TQ3 の人は、5つ答え終えて全社が開いた人。その人だけを見ていると、呼び出しが会社を渡さなくなっても
         （pv_contrib_sees(null) ＝ カードの材料が使う「ほかの会社が開くか」の聞き方）緑のまま、いちばん使われる道だけが
         質問の表の順に変わる。
         ⚠️ 落とし方は、db/airline-conditions.sql の呼び出しの引数（v_airline）を null にする。ここの期待を緩めない。 */
      const OWN = await member();
      await paid(OWN, A_QA);                                         // A_QA が「自分の会社」。回答は1つも無い
      const ownWords = `${await sees(OWN, A_QA)} ${await sees(OWN, A_QB)}`;
      const oA = await nextQ(OWN, A_QA), oB = await nextQ(OWN, A_QB);
      const ownA = list(oA).indexOf(X), ownB = list(oB).indexOf(X);
      ok(ownWords === 'open give' && ids(oA) === ids(openA) && ids(oB) === ids(mB)
         && (ownA > ownB || (ownA === -1 && list(oA).length === 30)) && noN(oA) && noN(oB),
        '★TQ3b 自分の会社は、5つ答える前でも今までどおり ── 給与を出した会社では、3人が答えた質問が後ろへ回る（全社が開いた人と同じ並び）',
        J({ X, sees: ownWords, own: ownA, other: ownB, sameAsOpen: ids(oA) === ids(openA) }));
    }
  }
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 8. 他人の補足（立場ごとに何が返るか）');
// ════════════════════════════════════════════════════════════
/* ★2026-10-11 から、補足を見せてよいかは pv_contrib_sees が決める（db/contrib.sql の 6-b）。
   読む人:  PAYER … この会社（A_NOTE）に給与を出しただけ。1つも答えていない ＝ 自分の会社なので開く
           GIVER … ほかの会社（A_HOME）に給与を出して、そこに4つ答えた ＝ あと1つ（give）
           READER … どの会社も開いている人（5 の頭で qualify）
           MEM / REV / PIL … 給与の鍵が無い会員 ／ W1 … 書いた本人
   開いていない人への返事は L0 / L1 / L2 の字そのもの（一覧も、会社の名前も、数も入らない）。 */
{
  const [W1, W2, MEM, REV, PIL, PAYER, GIVER] = await crew(7);
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
  await paid(PAYER, A_NOTE);                                   // この会社に給与を出しただけ（1つも答えていない）
  await paid(GIVER, A_HOME); await five(GIVER, A_HOME, 4);     // ほかの会社に給与を出して、そこに4つ答えた
  must(await sees(PAYER, A_NOTE) === 'open' && await sees(GIVER, A_NOTE) === 'give' && await haveOf(PAYER, A_NOTE) === 0
       && await sees(READER, A_NOTE) === 'open' && await sees(MEM, A_NOTE) === 'locked',
    '8 の読む人が、決める所でそれぞれの1語になっていること');

  const texts = (r) => (r.notes || []).map((x) => x.text).sort().join('|');
  const list  = (r) => (Array.isArray(r.notes) ? r.notes : []);
  const ALL   = ['3年で消える', '冬は少なめ', '月に3日ほど', '社内に窓口'].sort().join('|');

  // TN1 未ログイン
  ok(J(await notes(ANON, A_NOTE)) === L0, '★未ログインには、1文字も返らない', J(await notes(ANON, A_NOTE)));
  ok(J(await notes(ANON, 'no-such-airline')) === L0 && J(await rpc(ANON, 'pv_contrib_notes')) === L0,
    '   知らない会社を聞いても同じ返事（在る・無いの手がかりを返さない）');

  // TN2 給与の鍵が無い会員（口コミを書いた人・確認済みの印の人も同じ）
  const mem = J(await notes(MEM, A_NOTE));
  ok(mem === L1, '★TN2 ログインしただけの会員には、1文字も返らない（補足の一覧そのものが、返事に無い）', mem);
  const rev = J(await notes(REV, A_NOTE));
  ok(rev === L1, '★TN2 口コミの資格では開かない（会員と同じ返事）', rev);
  const pil = J(await notes(PIL, A_NOTE));
  ok(pil === L1, `★TN2 確認済みパイロットの印でも開かない（給与の鍵とは別物${hasVL ? '' : '・この器に印の列は無い'}）`, pil);
  const memBad = [J(await notes(MEM, 'no-such-airline')), J(await notes(MEM, 'other')), J(await rpc(MEM, 'pv_contrib_notes'))];
  ok(memBad.every((x) => x === L1),
    '   TN2 鍵の無い会員が、知らない会社・自由入力の会社を聞いても、会社を指さなくても、同じ返事（断りもしない）', memBad.join(' ｜ '));

  // TN3 この会社に給与を出した人（自分の会社は、鍵だけで開く）
  const payr = await notes(PAYER, A_NOTE);
  ok(payr.state === 'open' && texts(payr) === ALL && keys(payr) === 'notes,ok,state',
    '★TN3 この会社に給与を出した人には（1つも答えていなくても）、勤務・訓練・月の勤務のひとことまで返る', J(payr));
  ok(!J(payr).includes('印を付けていない補足')
     && await cnt(`public.airline_conditions where airline = $1 and answer_text = '印を付けていない補足' and not text_shared`, [A_NOTE]) === 1,
    '★「見せます」の印が無い補足は、誰にも返らない（今までの補足は本人だけのまま）');
  ok(list(payr).length === 4 && list(payr).every((x) => keys(x) === 'mine,q,text,topic'), '★1件の中身は 話題・質問・文・自分のものか の4つだけ', J(list(payr)[0]));
  const by = Object.fromEntries(list(payr).map((x) => [x.text, x]));
  ok(by['月に3日ほど']?.topic === 'roster' && by['月に3日ほど']?.q === 'reserve_duty' && by['3年で消える']?.topic === 'career'
     && by['社内に窓口']?.topic === 'benefits' && by['冬は少なめ']?.topic === 'work' && by['冬は少なめ']?.q === null,
    '   話題と質問の id が合っている（月の勤務のひとことは質問なし）');
  ok(list(payr).length === 4 && list(payr).every((x) => x.mine === false), '   他人が読むと、どれも「自分のもの」ではない');
  ok(payr.state === 'open' && !/"(yes|internal|fixed|cap|b787)"/.test(J(payr)) && !J(payr).includes(String(M.year)),
    '★選んだ答え・職位・機種・対象月は入っていない', J(payr));

  // TN4 ほかの会社に給与を出して、そこにまだ4つの人
  const g4 = [J(await notes(GIVER, A_NOTE)), J(await notes(GIVER, A_BARE)), J(await notes(GIVER, 'no-such-airline')), J(await notes(GIVER, 'other'))];
  ok(g4.every((x) => x === L2),
    '★TN4 自分の会社にまだ4つの人には、ほかの会社の補足は1文字も返らない（補足が在る会社・無い会社・知らない会社で、同じ返事）', g4.join(' ｜ '));
  const r5 = await condM(GIVER, { airline: A_HOME, answers: [FIVE[4]] });
  const g5 = await notes(GIVER, A_NOTE);
  ok(r5.saved === 1 && g5.state === 'open' && texts(g5) === ALL && list(g5).every((x) => x.mine === false),
    '★TN4 5つ目を答えると、ほかの会社の補足が開く（4つとも返る）', J(g5));

  // TN5 書いた本人が読む
  const own = await notes(W1, A_NOTE);
  const kept = (await mineC(W1, { airline: A_NOTE })).answers.filter((x) => x.shared === true).map((x) => x.text).sort().join('|');
  ok(J(own) === L1 && kept === ['3年で消える', '月に3日ほど', '社内に窓口'].sort().join('|'),
    '★TN5 書いた本人でも、給与の鍵が無ければ1文字も返らない（自分の補足は「自分の回答」の読み口に、印ごと残っている）', J(own) + ' ｜ ' + kept);
  await paid(W1, A_NOTE);
  const own2 = await notes(W1, A_NOTE);
  ok(own2.state === 'open' && own2.notes.length === 4 && own2.notes.every((x) => x.mine === true), '給与の鍵が生きれば全部読める（全部自分のもの）', J(own2));

  // TN6 鍵が切れた ／ TN7 運営
  await db.query(`update public.profiles set access_until = now() - interval '1 minute' where id = $1`, [PAYER]);
  const expired = J(await notes(PAYER, A_NOTE));
  ok(expired === L1, '★TN6 給与の鍵が切れたら、1文字も返らない（鍵の無い会員と同じ返事）', expired);
  if (await cnt(`information_schema.tables where table_schema = 'public' and table_name = 'pv_admins'`) === 1) {
    await db.query(`insert into public.pv_admins (user_id, note) values ($1, 'test') on conflict do nothing`, [MEM]);
    const op = await notes(MEM, A_NOTE);
    await db.query(`delete from public.pv_admins where user_id = $1`, [MEM]);
    const off = J(await notes(MEM, A_NOTE));
    ok(op.state === 'open' && texts(op) === ALL && off === L1, '運営は全部読める（運営の名簿に居る人だけ）', J(op) + ' ｜ 名簿から外したあと ' + off);
  }

  // TN10 / TN11 開いている人（READER）
  ok(bad(await notes(READER, 'no-such-airline'), /航空会社が正しくありません/) && bad(await notes(READER, 'other'), /航空会社が正しくありません/),
    'TN10 開いている人が、知らない会社・自由入力の会社を聞いたら断る');
  const bare = await notes(READER, A_BARE);
  ok(bare.state === 'open' && Array.isArray(bare.notes) && bare.notes.length === 0, '補足の無い会社は空の一覧', J(bare));

  // TN12 補足を消したら出なくなる
  const was = await notes(READER, A_NOTE);
  await condM(W1, { airline: A_NOTE, answers: [{ question_id: 'peer_support', code: 'internal' }] });
  const now = await notes(READER, A_NOTE);
  ok(was.state === 'open' && texts(was) === ALL && list(was).every((x) => x.mine === false)
     && now.state === 'open' && texts(now) === ['3年で消える', '冬は少なめ', '月に3日ほど'].sort().join('|'),
    '★本人が補足を消したら、他人の画面からも消える', J(was) + ' → ' + J(now));

  // TN9b 見せる区分の決まりを、SQL の字として持っていない（db/contrib.sql の字をそのまま読む）
  const fnAt = CONTRIB_SQL.indexOf('create or replace function public.pv_contrib_notes(');
  const fnNotes = fnAt < 0 ? '' : CONTRIB_SQL.slice(fnAt, CONTRIB_SQL.indexOf('\n$$;', fnAt));
  ok(!/q\.section (not )?in \(|p_section/.test(CONTRIB_SQL) && fnNotes.includes('pv_contrib_sees(') && !fnNotes.includes('pv_work_level()'),
    '補足を見せる区分の決まりを、SQL に書き戻していない（決めるのは pv_contrib_sees だけ）');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 8-2. 上の質問を答え直した人の、下の質問（着陸手当の額・数え方・何で変わるか）');
// ════════════════════════════════════════════════════════════
/* ★2026-10-09、着陸手当（landing_pay）の下に、額・数え方・何で変わるか の5問を足した。
   上の質問を「ない」に答え直しても、下の質問の行は消さない（答え直せば、そのまま戻るように）。
   そのかわり、**出す側が毎回「上の質問まで条件が続いているか」を見る**。ここで見るのは2つ ──
     ・他人の補足（pv_contrib_notes）…… 続いていない人の補足を見せ続けない
     ・預かりの引き継ぎ（claim_contrib）…… 続いていない額を、会員の回答にしない
   集計の側は db/test-conditions.mjs の ㉑ が見ている。
   ⚠️ 下の額と文は検査のための作りもの。どの会社の着陸手当でもない。 */
{
  const [W, MEM, P1, P2] = await crew(4);
  /* TN8 補足を読む2人（MEM と、書く本人の W）は、この会社に給与を出した人 ＝ この会社の補足が開いている人。
     「出ない」は、開いている人に空の一覧が返ること（none）。開いていない人への1語を「出ない」に数えない。 */
  await paid(MEM, A_CLAIM); await paid(W, A_CLAIM);
  const texts = (r) => (r.notes || []).map((x) => x.text).sort().join('|');
  const none = (n) => n.state === 'open' && Array.isArray(n.notes) && n.notes.length === 0;
  const LP = (code) => ({ airline: A_CLAIM, answers: [{ question_id: 'landing_pay', code }] });

  // ── 補足 ── W が「一定額ではない」を選び、「何で変わるか」に「見せます」の補足を付ける
  let r = await condM(W, { airline: A_CLAIM, position: 'cap', fleet: 'b787', answers: [
    { question_id: 'landing_pay', code: 'variable' },
    { question_id: 'landing_pay_from', num: 10, currency: 'USD' },
    { question_id: 'landing_pay_varies_by', code: 'airport', text: '空港によって違う', share: true }] });
  ok(r.saved === 3 && r.rejected.length === 0, '着陸手当（一定額ではない）・低いほうの額・何で変わるか を1回で保存できる', J(r));
  let n = await notes(MEM, A_CLAIM);
  ok(n.state === 'open' && texts(n) === '空港によって違う'
     && n.notes[0].topic === 'benefits' && n.notes[0].q === 'landing_pay_varies_by',
    '★「何で変わるか」に付けた補足は、ほかの会員に見える', J(n));

  await condM(W, LP('no'));
  n = await notes(MEM, A_CLAIM);
  ok(none(n), '★着陸手当を「ない」に答え直した人の、下の質問への古い補足を、他人に見せ続けない', J(n));
  ok(none(await notes(W, A_CLAIM)), '   書いた本人の一覧からも外れる（集計と同じ決め方）');
  ok(await cnt(`public.airline_conditions where airline = $1 and question_id = 'landing_pay_varies_by'
                 and answer_text = '空港によって違う' and text_shared`, [A_CLAIM]) === 1,
    '   行そのものは消していない（答え直せば戻せる）');

  await condM(W, LP('fixed'));
  ok(none(await notes(MEM, A_CLAIM)),
    '★「一定額」に答え直しても出ない（その補足は「一定額ではない」の下の質問のもの）');
  await condM(W, LP('variable'));
  n = await notes(MEM, A_CLAIM);
  ok(texts(n) === '空港によって違う', '★「一定額ではない」に戻すと、また見える', J(n));

  // ── 預かり ── 未ログインのまま、着陸手当（一定額）・額・数え方を預ける
  const C = { airline: A_CLAIM, position: 'fo', fleet: 'a320', lang: 'ja' };
  const FIXED = [
    { question_id: 'landing_pay', code: 'fixed' },
    { question_id: 'landing_pay_amount', num: 1500, currency: 'JPY' },
    { question_id: 'landing_pay_unit', code: 'per_landing' }];
  const a = await putC(null, { ...C, answers: FIXED });
  ok(a.saved === 3 && a.rejected.length === 0 && KEY.test(a.key || ''),
    '★未ログインのまま、着陸手当（一定額）・額・数え方を1回で預けられる', J(a));
  let m = Object.fromEntries((await mineA(a.key, A_CLAIM)).answers.map((x) => [x.question_id, x]));
  ok(m.landing_pay.code === 'fixed' && m.landing_pay_amount.num === 1500 && m.landing_pay_amount.currency === 'JPY'
     && m.landing_pay_unit.code === 'per_landing',
    '★読み直すと、額・通貨・数え方が同じ内容で返る', J(m));

  let c = await claim(P1, a.key);
  ok(c.moved === 3 && c.dropped === 0 && c.left === 0, '★ログインして引き継ぐと、3件とも会員の回答になる（親→子の順で通る）', J(c));
  const got = await many(
    `select question_id, "position" as pos, fleet, answer_num, answer_currency as cur, answer_code
       from public.airline_conditions
      where proof_hash = public.pv_condition_hash($1::uuid, $2, null) order by question_id`, [P1, A_CLAIM]);
  ok(got.length === 3 && got.every((x) => x.pos === 'fo' && x.fleet === 'a320'),
    '★引き継いだ3行とも、預けた時の職位・機種を持っている（額と数え方が、親に付けた条件を引き継ぐ）', J(got));
  const amt = got.find((x) => x.question_id === 'landing_pay_amount') || {};
  ok(Number(amt.answer_num) === 1500 && amt.cur === 'JPY',
    '   額と通貨も、1文字も変わらずに移っている', J(got));

  // 預けたあとで、親を「ない」に直した人
  const b = await putC(null, { ...C, answers: FIXED });
  r = await putC(b.key, { ...C, answers: [{ question_id: 'landing_pay', code: 'no' }] });
  ok(r.saved === 1, '預けたあとで、着陸手当を「ない」に直せる', J(r));
  r = await putC(b.key, { ...C, answers: [{ question_id: 'landing_pay_amount', num: 2000, currency: 'JPY' }] });
  ok(r.saved === 0 && r.rejected[0]?.reason === 'parent_missing', '   「ない」に直したあとは、額だけ送っても預からない', J(r));
  ok((await mineA(b.key, A_CLAIM)).answers.length === 3,
    '   預かりの行は消していない（数えない・出さないは画面の役目 ＝ assert-contrib.mjs が見る）');
  /* n1 ここは前、dropped 2 と決めていた。画面は dropped を「いまの形式では受け取れず、引き継げませんでした」と
     伝えるので、自分で「ない」に直しただけの人に、2件を失ったと告げていた（どの答えの形も悪くない・何も失っていない）。
     本人が上の質問を答え直して、もう聞かれなくなった古い答えは stale に数える（画面は何も言わない）。 */
  c = await claim(P2, b.key);
  ok(c.moved === 1 && c.dropped === 0 && c.stale === 2 && c.left === 0,
    '★引き継ぐとき、「ない」に直した人の古い額と数え方は、会員の回答にしない（捨てる）', J(c));
  ok(c.moved + c.kept + c.dropped + c.stale + c.left === 3,
    '   n4 引き継ぎの5つの数（moved・kept・dropped・stale・left）を足すと、預けていた3件になる', J(c));
  const mine2 = (await mineC(P2, { airline: A_CLAIM })).answers;
  ok(mine2.length === 1 && mine2[0].question_id === 'landing_pay' && mine2[0].code === 'no',
    '   会員の回答に入ったのは「ない」の1件だけ', J(mine2.map((x) => x.question_id)));
  ok(await cnt(`public.pv_contrib_pending where airline = $1`, [A_CLAIM]) === 0, '   預かりは空になった');
}

/* 8-2 の続き（2026-10-11）。ここから下は、上のどの節も回答を入れていない会社でやる。 */
const [A_WALK, A_PAIR, A_PAIR2, A_CTX, A_HAND, A_HAND2, A_DAY] = (await many(
  `select code from public.pv_airlines
    where code <> 'other' and active and code <> all($1::text[]) order by code limit 7`, [AIR])).map((r) => r.code);

/* ── 補足の決まりを、2段の筋・答えを複数選べる親でも歩く ──
   上の検査が歩いているのは着陸手当だけ（1段・答えを1つ選ぶ親）。決まりが「複数選べる親を見ない」
   「すぐ上の親しか見ない」「着陸手当の下しか見ない」に変わっても、1本も赤くならなかった。
   歩く筋: 通勤の送迎（commuting_transport）→ その手段（commuting_transport_method ＝ 複数選べる）
           → タクシー代の上限（commuting_taxi_cap ＝ ここに「見せます」の補足）
   毎回見るのは、**書いた人ではない会員**が pv_contrib_notes から受け取るもの。
   ⚠️ 下の文は検査のための作りもの。どの会社の決まりでもない。 */
{
  const [W, MEM] = await crew(2);
  await paid(MEM, A_WALK); await paid(W, A_WALK);        // TN8 読む2人は、この会社に給与を出した人（この会社の補足が開いている）
  const NOTE = '月の上限まで会社が出す';
  const TOP = (code) => ({ airline: A_WALK, answers: [{ question_id: 'commuting_transport', code }] });
  const MID = (codes) => ({ airline: A_WALK, answers: [{ question_id: 'commuting_transport_method', codes }] });
  /* 別の会員が受け取った一覧。「見える」は、その1件だけが・他人のものとして入っていること */
  const seen1 = (n) => n.state === 'open' && n.notes.length === 1 && n.notes[0].q === 'commuting_taxi_cap'
    && n.notes[0].text === NOTE && n.notes[0].mine === false && n.notes[0].topic === 'benefits';
  const gone = (n) => n.state === 'open' && n.notes.length === 0;
  /* 書いた人の行（上限の答えと、印の付いた補足）は、どの段でも残っている ＝ 出ないのは決まりのせい */
  const kept = () => cnt(`public.airline_conditions
     where proof_hash = public.pv_condition_hash($1::uuid, $2, null) and question_id = 'commuting_taxi_cap'
       and answer_code = 'per_ride' and answer_text = $3 and text_shared`, [W, A_WALK, NOTE]);
  const mid = async () => J((await one(`select answer_codes c from public.airline_conditions
     where proof_hash = public.pv_condition_hash($1::uuid, $2, null)
       and question_id = 'commuting_transport_method'`, [W, A_WALK]))?.c);

  ok(W !== MEM && A_WALK && gone(await notes(MEM, A_WALK)),
    '   （下ごしらえ）読むのは書く人とは別の会員。この会社には、まだ補足が1つも無い');

  let r = await condM(W, { airline: A_WALK, answers: [
    { question_id: 'commuting_transport', code: 'always' },
    { question_id: 'commuting_transport_method', codes: ['company_taxi'] },
    { question_id: 'commuting_taxi_cap', code: 'per_ride', text: NOTE, share: true }] });
  let n = await notes(MEM, A_WALK);
  ok(r.saved === 3 && r.rejected.length === 0 && seen1(n),
    '★歩き1 送迎「いつも」・手段［会社のタクシー］・上限に「見せます」の補足 → ほかの会員に見える（複数選べる親でも筋が通る）', J(n));
  const own = await notes(W, A_WALK);
  ok(own.state === 'open' && own.notes.length === 1 && own.notes[0].mine === true,
    '   書いた本人が読むと「自分のもの」の印が付く ＝ 上で読んだのは、確かに本人ではない', J(own));

  r = await condM(W, MID(['crew_bus']));
  n = await notes(MEM, A_WALK);
  ok(r.saved === 1 && await mid() === '["crew_bus"]' && await kept() === 1 && gone(n),
    '★歩き2 手段を［乗員バス］だけに答え直す → 上限への補足は、ほかの会員に見えなくなる（行は残っている）', `${J(n)} ｜ 手段 ${await mid()} ｜ 行 ${await kept()}`);

  r = await condM(W, MID(['company_taxi', 'crew_bus']));
  n = await notes(MEM, A_WALK);
  ok(r.saved === 1 && seen1(n),
    '★歩き3 手段を［会社のタクシー・乗員バス］に答え直す → また見える（選んだうちの1つが合えばよい）', J(n));

  r = await condM(W, TOP('no'));
  n = await notes(MEM, A_WALK);
  ok(r.saved === 1 && await mid() === '["company_taxi","crew_bus"]' && await kept() === 1 && gone(n),
    '★歩き4 いちばん上の送迎を「ない」に答え直す → 見えなくなる（すぐ上の手段は合ったまま ＝ 2段上まで見ている）', `${J(n)} ｜ 手段 ${await mid()} ｜ 行 ${await kept()}`);

  r = await condM(W, TOP('conditional'));
  n = await notes(MEM, A_WALK);
  ok(r.saved === 1 && seen1(n), '★歩き5 送迎を「条件つき」に答え直す → また見える', J(n));
}

/* ── 対になる額を、未ログインの入口が預かるとき ──
   「低いほう 300・高いほう 200」「低いほう USD・高いほう EUR」が、そのまま預かりに入っていた
   （1件ぶんの検品は、1問ずつしか見ない）。入口は、額を預かる前に対の相手と比べる。
   相手 ＝ **この呼び出しが終わったあとに、この鍵の・この会社の預かりに残る**相手の額。
   会員の入口の同じ決まりは db/test-conditions.mjs の ㉑ が見ている。比べる所は1つ
   （db/airline-conditions.sql の 4d）で、ここが見るのは「未ログインの入口が、そこへ正しい相手を渡すか」。
   ⚠️ 下の額は検査のための作りもの。どの会社の着陸手当でもない。 */
{
  const HI = 'landing_pay_to';
  const LO = (await one(`select public.pv_condition_range_other($1::text) r`, [HI])).r;
  const pr = Object.fromEntries((await many(
    `select id, priority from public.pv_condition_questions where id = any($1::text[])`, [[LO, HI]])).map((x) => [x.id, x.priority]));
  ok(LO === 'landing_pay_from' && pr[LO] < pr[HI],
    '   （下ごしらえ）対は 低いほうの額・高いほうの額。入口は低いほうを先に見る（priority が小さい）', J({ LO, pr }));

  const VAR = { question_id: 'landing_pay', code: 'variable' };
  const low = (num, currency = 'USD') => ({ question_id: LO, num, currency });
  const high = (num, currency = 'USD') => ({ question_id: HI, num, currency });
  const whyOf = (res) => (res.rejected || []).map((x) => `${x.question_id}:${x.reason}`).sort().join(' ');
  const BOTH_ORDER = `${LO}:range_order ${HI}:range_order`, BOTH_CUR = `${LO}:range_currency ${HI}:range_currency`;
  const sayEnd = (y) => (!y ? '行なし' : (y.num === null ? (y.code || '答えなし') : `${y.num} ${y.currency}`));
  /* この鍵が、この会社でいま預けている2つ。「100 USD／200 USD」の形 */
  const heldNow = async (key, airline = A_PAIR) => {
    const a = Object.fromEntries((await mineA(key, airline)).answers.map((x) => [x.question_id, x]));
    return `${sayEnd(a[LO])}／${sayEnd(a[HI])}`;
  };
  const send = (key, answers, airline = A_PAIR) => putC(key, { airline, answers });
  /* 新しい端末が「一定額ではない」と答える。stored なら、低いほう 100 USD・高いほう 200 USD も先に預けておく */
  const device = async (stored = true, airline = A_PAIR) =>
    (await send(null, [VAR, ...(stored ? [low(100), high(200)] : [])], airline)).key;
  const nKeys = () => cnt(`public.pv_contrib_keys`);
  let r, k, now2;

  /* 先に、別の端末 X が同じ会社に 500／600 USD を預けておく。下の a1〜a5 は、X が居るまま通す */
  const X = await device(false);
  r = await send(X, [low(500), high(600)]);
  ok(r.saved === 2 && (await heldNow(X)) === '500 USD／600 USD',
    '   （下ごしらえ）別の端末 X が、同じ会社に 低いほう 500 USD・高いほう 600 USD を預けている', `${whyOf(r)} ｜ ${await heldNow(X)}`);

  k = await device(false);
  r = await send(k, [low(300), high(200)]);
  now2 = await heldNow(k);
  ok(whyOf(r) === BOTH_ORDER && r.saved === 0 && !('key' in r) && now2 === '行なし／行なし',
    '★a1 1回の呼び出しで 低いほう 300 USD・高いほう 200 USD → 2つとも断る（range_order）。どちらも預からない', `${whyOf(r)} ｜ ${now2}`);
  let n0 = await nKeys();
  r = await send(null, [VAR, low(300), high(200)]);
  now2 = await heldNow(r.key);
  ok(whyOf(r) === BOTH_ORDER && r.saved === 1 && KEY.test(r.key || '') && now2 === '行なし／行なし'
     && (await mineA(r.key, A_PAIR)).answers.length === 1 && await nKeys() === n0 + 1,
    '   a1 初めての端末が、上の質問と一緒に送っても同じ（預かるのは上の質問の1件だけ・鍵はその1件のために1本）', `${whyOf(r)} ｜ ${now2}`);
  n0 = await nKeys();
  r = await send(null, [low(300), high(200)]);
  ok(r.saved === 0 && !('key' in r) && await nKeys() === n0
     && whyOf(r) === `${LO}:parent_missing ${HI}:parent_missing`,
    '   a1 初めての端末が、断られる答えだけを送った → 何も残らない（鍵も作らない。理由は「上の質問が無い」）', J(r));

  k = await device(false);
  r = await send(k, [low(100, 'USD'), high(200, 'EUR')]);
  now2 = await heldNow(k);
  ok(whyOf(r) === BOTH_CUR && r.saved === 0 && now2 === '行なし／行なし',
    '★a2 1回の呼び出しで 100 USD・200 EUR（大小は合っている）→ 2つとも断る（range_currency）', `${whyOf(r)} ｜ ${now2}`);
  k = await device(false);
  r = await send(k, [low(300, 'USD'), high(200, 'EUR')]);
  now2 = await heldNow(k);
  ok(whyOf(r) === BOTH_CUR && now2 === '行なし／行なし',
    '   a2 300 USD・200 EUR（通貨も大小も悪い）→ 言うのは通貨（range_currency）', `${whyOf(r)} ｜ ${now2}`);
  ok(!/[0-9]/.test(r.rejected.map((x) => x.reason).join('')) && r.rejected.every((x) => keys(x) === 'question_id,reason'),
    '   断った理由は、今までと同じ形（質問の id と短い語だけ）。額は入っていない', J(r.rejected));

  k = await device();
  r = await send(k, [low(300), high(400)]);
  now2 = await heldNow(k);
  ok(r.rejected.length === 0 && r.saved === 2 && now2 === '300 USD／400 USD',
    '★a3 100／200 USD を預けた端末が、1回の呼び出しで 300／400 に直す → 2つとも預かる（300 を、前の 200 と比べない）', `${whyOf(r)} ｜ ${now2}`);

  k = await device();
  r = await send(k, [low(250)]);
  now2 = await heldNow(k);
  ok(whyOf(r) === `${LO}:range_order` && r.saved === 0 && now2 === '100 USD／200 USD',
    '★a4 100／200 USD を預けた端末が、低いほうだけ 250 に直す → 断る（range_order）。低いほうは 100 のまま', `${whyOf(r)} ｜ ${now2}`);

  k = await device(false);
  r = await send(k, [low(200), high(200)]);
  const k5 = await device(false), k5b = await device(false);
  const r5 = await send(k5, [low(100)]), r5b = await send(k5b, [high(200)]);
  ok(r.saved === 2 && r.rejected.length === 0 && (await heldNow(k)) === '200 USD／200 USD'
     && r5.saved === 1 && (await heldNow(k5)) === '100 USD／行なし'
     && r5b.saved === 1 && (await heldNow(k5b)) === '行なし／200 USD',
    '   a5 対照: 同じ額（200・200）は預かる。片方だけ（低いほうだけ／高いほうだけ）も預かる',
    `${whyOf(r)} ｜ ${await heldNow(k)} ｜ ${await heldNow(k5)} ｜ ${await heldNow(k5b)}`);

  /* a6 相手の額は、この鍵の・この会社の預かりからだけ読む。
     この会社では、ここまでにほかの端末が預けた低いほうは、どれも 100 以上（X の 500 を含む）。
     高いほうを 50 で送ると、ほかの端末の行を1つでも読んだ時点で断ることになる。 */
  k = await device(false);
  r = await send(k, [high(50)]);
  now2 = await heldNow(k);
  ok(r.saved === 1 && r.rejected.length === 0 && now2 === '行なし／50 USD' && (await heldNow(X)) === '500 USD／600 USD',
    '★a6 ほかの端末が同じ会社に預けている額とは比べない（低いほうをまだ預けていない端末の、高いほう 50 → 預かる）', `${whyOf(r)} ｜ ${now2}`);
  const Z = await device(false, A_PAIR2);
  await send(Z, [low(500)], A_PAIR2);
  r = await send(Z, [VAR, high(50)]);
  now2 = await heldNow(Z);
  ok(r.saved === 2 && r.rejected.length === 0 && now2 === '行なし／50 USD' && (await heldNow(Z, A_PAIR2)) === '500 USD／行なし',
    '★a6 同じ端末がほかの会社に預けている額とも比べない（ほかの会社に低いほう 500 → この会社で高いほう 50 → 預かる）',
    `${whyOf(r)} ｜ ${now2} ｜ ほかの会社 ${await heldNow(Z, A_PAIR2)}`);
  const [PM] = await crew(1);
  await condM(PM, { airline: A_PAIR, answers: [VAR, low(500), high(600)] });
  r = await putC(null, { airline: A_PAIR, answers: [VAR, high(50)] }, PM);
  now2 = await heldNow(r.key);
  ok(r.saved === 2 && r.rejected.length === 0 && now2 === '行なし／50 USD',
    '★a6 会員の回答とも比べない（会員として 500／600 USD を持つ人が、ログインしたままこの入口で高いほう 50 → 預かる）', `${whyOf(r)} ｜ ${now2}`);

  /* a8 この入口は、スキップを必ず断る ＝ 預かりを変えない。だから相手は、預かっている額のまま */
  k = await device();
  r = await send(k, [{ question_id: LO, skip: true }, high(50)]);
  now2 = await heldNow(k);
  ok(whyOf(r) === `${LO}:skip_needs_login ${HI}:range_order` && r.saved === 0 && now2 === '100 USD／200 USD',
    '★a8 100／200 USD を預けた端末が、1回の呼び出しで 低いほうをスキップ・高いほうを 50 → スキップは今までどおり断り、高いほうも断る（range_order）。どちらも元のまま',
    `${whyOf(r)} ｜ ${now2}`);
  k = await device();
  r = await send(k, [{ question_id: LO, skip: true, num: 10, currency: 'USD' }, high(50)]);
  now2 = await heldNow(k);
  ok(whyOf(r) === `${LO}:skip_needs_login ${HI}:range_order` && now2 === '100 USD／200 USD',
    '★a8 スキップに額（10）を添えた呼び出しでも同じ（預からない 10 を、相手の額として使わない）', `${whyOf(r)} ｜ ${now2}`);

  /* 同じ呼び出しに入っている相手が「わからない」／検品で落ちる */
  k = await device();
  r = await send(k, [{ question_id: LO, code: 'unknown' }, high(50)]);
  now2 = await heldNow(k);
  ok(r.rejected.length === 0 && r.saved === 2 && now2 === 'unknown／50 USD',
    '★a9 同じ呼び出しで 低いほうを「わからない」・高いほうを 50 → 2つとも預かる（低いほうに、もう額が無い）', `${whyOf(r)} ｜ ${now2}`);
  k = await device();
  r = await send(k, [{ question_id: HI, code: 'unknown' }, low(300)]);
  now2 = await heldNow(k);
  ok(r.rejected.length === 0 && r.saved === 2 && now2 === '300 USD／unknown',
    '★a9 同じ呼び出しで 高いほうを「わからない」・低いほうを 300 → 2つとも預かる（300 を、これから消える 200 と比べない）', `${whyOf(r)} ｜ ${now2}`);
  k = await device();
  r = await send(k, [low(300), high(400, 'XXX')]);
  now2 = await heldNow(k);
  ok(whyOf(r) === `${LO}:range_order ${HI}:bad_currency` && now2 === '100 USD／200 USD',
    '★a10 同じ呼び出しの相手が検品で落ちる（語彙に無い通貨の 400）→ 相手は預からないので、300 は預けてある 200 と比べて断る',
    `${whyOf(r)} ｜ ${now2}`);

  /* 同じ端を2回入れた呼び出し（画面は送らない。手で作った呼び出し）。同じ呼び出しの相手と比べてよいのは、
     その質問の最後の答えだけ。これが無いと、250 が「同じ呼び出しの 300」と比べて通り、その 300 は 900 と
     食い違って断られ、低いほう 250・高いほう 200 が残る。 */
  k = await device();
  r = await send(k, [low(250), low(900), high(300)]);
  let a = Object.fromEntries((await mineA(k, A_PAIR)).answers.map((x) => [x.question_id, x]));
  ok(a[LO] && a[HI] && a[LO].num <= a[HI].num && a[LO].currency === a[HI].currency,
    '★a11 同じ端を2回入れた呼び出し（低いほう 250・低いほう 900・高いほう 300）でも、食い違う2つは残らない',
    `${whyOf(r)} ｜ ${await heldNow(k)}`);
  k = await device();
  r = await send(k, [low(300), low(350), high(400)]);
  now2 = await heldNow(k);
  ok(now2 === '350 USD／400 USD' && whyOf(r) === `${LO}:range_order`,
    '   a11 対照: 最後の答えどうし（350・400）は、同じ呼び出しの相手と比べて預かる（先の 300 は、預けてある 200 と比べて断る）',
    `${whyOf(r)} ｜ ${now2}`);
  /* 同じ端のあとにスキップが続く呼び出し。スキップは答えではないので、その前の答えが「最後の答え」。
     スキップを答えに数えると、50 EUR は「先の答え」として預けてある 200 USD と比べて断られ、
     高いほうの 60 EUR だけが入って、低いほう 100 USD・高いほう 60 EUR が残る。 */
  k = await device();
  r = await send(k, [low(50, 'EUR'), { question_id: LO, skip: true }, high(60, 'EUR')]);
  now2 = await heldNow(k);
  ok(whyOf(r) === `${LO}:skip_needs_login` && r.saved === 2 && now2 === '50 EUR／60 EUR',
    '★a11 同じ端のあとにスキップが続く呼び出し（低いほう 50 EUR・低いほうのスキップ・高いほう 60 EUR）→ スキップは答えに数えない。50 と 60 を比べて、2つとも預かる',
    `${whyOf(r)} ｜ ${now2}`);
  /* 両方の端を2回ずつ入れた呼び出し。同じ呼び出しの相手は、その質問の**最後の**答え（先の答えではない）。
     先の答えと比べると、500 は 600 と・60 は 50 と比べて通り、低いほう 500・高いほう 60 が残る。 */
  k = await device();
  r = await send(k, [low(50), low(500), high(600), high(60)]);
  now2 = await heldNow(k);
  ok(whyOf(r) === `${LO}:range_order ${HI}:range_order` && r.saved === 2 && now2 === '50 USD／600 USD',
    '★a11 両方の端を2回ずつ入れた呼び出し（低いほう 50・500／高いほう 600・60）→ 最後の答えどうし（500・60）は2つとも断る。残るのは先の 50／600',
    `${whyOf(r)} ｜ ${now2}`);

  /* 上の質問を「ない」に直しても、預かりの行は消さない（上の検査）。「一定額ではない」へ戻せば、
     残っていた額はまた生きる（引き継げば会員の回答になる）＝ 戻したあとは、相手として比べる。 */
  k = await device();
  await send(k, [{ question_id: 'landing_pay', code: 'no' }]);
  r = await send(k, [high(50)]);
  const rBack = await send(k, [VAR, high(50)]);
  now2 = await heldNow(k);
  ok(whyOf(r) === `${HI}:parent_missing` && whyOf(rBack) === `${HI}:range_order` && rBack.saved === 1 && now2 === '100 USD／200 USD',
    '★a12 上の質問を「ない」に直してから戻した端末: 残っていた 低いほう 100 が、戻した呼び出しの中でも相手として効く（高いほう 50 → 断る）',
    `ない のあいだ ${whyOf(r)} ｜ 戻した呼び出し ${whyOf(rBack)} ｜ ${now2}`);

  /* ★1日の上限（1本の鍵で80件）が、対の2つのあいだで切れるとき（2026-10-11）。
     前は、先に回る低いほうだけを預かり（同じ呼び出しの高いほうと比べて通る）、高いほうは上限で断って、
     「低いほう 300・高いほう 200」が預かりに残った。会員の入口と同じ決まりにした ── 同じ呼び出しの2つの端は
     「1組」で、**2つとも預かるか、2つとも預からない**（額の無い「わからない」の端も、組に入る）。
     上限に2件ぶんの空きが無ければ、2つとも rate_limited で返る（新しい理由は作らない）。
     会員の入口の同じ行は db/test-conditions.mjs の ㉑（d1〜d6）。
     どの回も新しい端末で、この節だけの会社（A_DAY）でやる（上の a1〜a12 が見ている預かりを動かさない）。 */
  const BOTH_LIM = `${LO}:rate_limited ${HI}:rate_limited`;
  const VARIES = (code) => ({ question_id: 'landing_pay_varies_by', code });
  const dunno = (q) => ({ question_id: q, code: 'unknown' });
  const setSaves = (key, n) => db.query(
    `update public.pv_contrib_keys set saves_day = current_date, saves_today = $2
      where key_hash = public.pv_contrib_key_hash($1)`, [key, n]);
  const savesOf = async (key) => (await one(
    `select saves_today n from public.pv_contrib_keys where key_hash = public.pv_contrib_key_hash($1)`, [key]))?.n;
  const rowsOf = (key) => cnt(`public.pv_contrib_pending where key_hash = public.pv_contrib_key_hash($1)`, [key]);
  const heldMap = async (key) => Object.fromEntries((await mineA(key, A_DAY)).answers.map((x) => [x.question_id, x]));
  let dayN;

  k = await device(true, A_DAY);
  await setSaves(k, 79);
  r = await send(k, [low(300), high(400)], A_DAY);
  now2 = await heldNow(k, A_DAY);
  dayN = await savesOf(k);
  ok(whyOf(r) === BOTH_LIM && r.saved === 0 && !('key' in r) && now2 === '100 USD／200 USD' && dayN === 79,
    '★e1 100／200 USD を預けた端末が、残り1件の日に、1回の呼び出しで 300／400 に直す → 2つとも断る（rate_limited）。'
    + '預かりは変わらない（低いほうだけ預かって 300／200 にしない）・1日の数も増えない',
    `${whyOf(r)} ｜ 預かった数 ${r.saved} ｜ ${now2} ｜ 数 ${dayN}`);
  r = await send(k, [low(150)], A_DAY);
  now2 = await heldNow(k, A_DAY);
  dayN = await savesOf(k);
  ok(r.rejected.length === 0 && r.saved === 1 && now2 === '150 USD／200 USD' && dayN === 80,
    '   e1 のつづき: 同じ端末が、低いほうだけ 150 を送る → 預かる（1件だけの答えは、今までどおり、残りの1件で入る）',
    `${whyOf(r)} ｜ 預かった数 ${r.saved} ｜ ${now2} ｜ 数 ${dayN}`);

  k = await device(true, A_DAY);
  await setSaves(k, 79);
  r = await send(k, [high(400), low(300)], A_DAY);
  now2 = await heldNow(k, A_DAY);
  dayN = await savesOf(k);
  ok(whyOf(r) === BOTH_LIM && r.saved === 0 && !('key' in r) && now2 === '100 USD／200 USD' && dayN === 79,
    '★e1b 高いほうを先に並べた呼び出しでも同じ（2つとも rate_limited・100／200 のまま・数も増えない）',
    `${whyOf(r)} ｜ 預かった数 ${r.saved} ｜ ${now2} ｜ 数 ${dayN}`);

  k = await device(true, A_DAY);
  await setSaves(k, 78);
  r = await send(k, [low(300), high(400)], A_DAY);
  now2 = await heldNow(k, A_DAY);
  dayN = await savesOf(k);
  ok(r.rejected.length === 0 && r.saved === 2 && now2 === '300 USD／400 USD' && dayN === 80,
    '   e2 対照: 残り2件の日なら、300／400 は2つとも預かる（1日の数は 80 ちょうど）',
    `${whyOf(r)} ｜ 預かった数 ${r.saved} ｜ ${now2} ｜ 数 ${dayN}`);

  k = await device(true, A_DAY);
  await setSaves(k, 79);
  r = await send(k, [low(300), dunno(HI)], A_DAY);
  now2 = await heldNow(k, A_DAY);
  ok(whyOf(r) === BOTH_LIM && r.saved === 0 && now2 === '100 USD／200 USD',
    '★e3 残り1件の日に、低いほう 300・高いほう「わからない」→ 2つとも断る（額の無い端も、組に入る）。100／200 のまま',
    `${whyOf(r)} ｜ 預かった数 ${r.saved} ｜ ${now2}`);
  k = await device(true, A_DAY);
  await setSaves(k, 79);
  r = await send(k, [dunno(LO), high(50)], A_DAY);
  now2 = await heldNow(k, A_DAY);
  ok(whyOf(r) === BOTH_LIM && r.saved === 0 && now2 === '100 USD／200 USD',
    '★e3\' 残り1件の日に、低いほう「わからない」・高いほう 50 → 2つとも断る。100／200 のまま',
    `${whyOf(r)} ｜ 預かった数 ${r.saved} ｜ ${now2}`);

  k = await device(true, A_DAY);
  await setSaves(k, 78);
  r = await send(k, [low(300), high(350), high(400)], A_DAY);
  now2 = await heldNow(k, A_DAY);
  dayN = await savesOf(k);
  ok(whyOf(r) === `${HI}:rate_limited` && r.saved === 2 && now2 === '300 USD／400 USD' && dayN === 80,
    '★e4 残り2件の日に、低いほう 300・高いほう 350・高いほう 400 → 断るのは、先の高いほう（350）だけ。300／400 を預かり、'
    + '1日の数は 80（最後の高いほうのために取っておいた1件ぶんを、先の高いほうに使わせない）',
    `${whyOf(r)} ｜ 預かった数 ${r.saved} ｜ ${now2} ｜ 数 ${dayN}`);

  /* e5 預かりの数の上限（1本の鍵で200件）は、この決まりに入れない。その理由で断る端には、まだ行が無い ＝
     残るのは片方だけで、食い違いは残らない。見るのは2つ:
       ・取っておいた端がそこで断られたら、取っておいた1件ぶんは返す（返さないと、そのあとの答えが、
         誰も使わない1件ぶんのせいで「1日の上限」で断られる）
       ・そこで断る理由は、1日の上限の理由（rate_limited）ではない。画面は rate_limited を「1日に送れる件数の
         上限に達しました。明日また続きをどうぞ。」と伝える。預かりの数の上限は1日の上限ではなく、明日に
         なっても空かない ＝ その文は本当でない。入口は、この上限だけの理由（pending_full）で返す。
     端末は「一定額ではない」・低いほう 100・「何で変わるか」の3件を預けている（高いほうは、まだ無い）。
     ほかの会社の行で、この鍵の預かりを200件ちょうどにしてから送る。 */
  k = await device(false, A_DAY);
  r = await send(k, [low(100), VARIES('airport')], A_DAY);
  await db.query(
    `insert into public.pv_contrib_pending (key_hash, kind, airline, item_key, payload)
     select public.pv_contrib_key_hash($1), 'work', $2, 'x-' || g, '{}'::jsonb from generate_series(1, 197) g`, [k, A_PAIR2]);
  const full5 = r.saved === 2 && await rowsOf(k) === 200;
  await setSaves(k, 78);
  r = await send(k, [low(300), high(400), VARIES('aircraft')], A_DAY);
  now2 = await heldNow(k, A_DAY);
  dayN = await savesOf(k);
  a = await heldMap(k);
  ok(full5 && whyOf(r) === `${HI}:pending_full` && r.saved === 2 && now2 === '300 USD／行なし'
     && a.landing_pay_varies_by?.code === 'aircraft' && dayN === 80 && await rowsOf(k) === 200,
    '★e5 預かりが200件の端末が、残り2件の日に、低いほう 300（直す）・高いほう 400（新しい行が要る）・「何で変わるか」を送る → '
    + '断るのは高いほうだけ。理由は1日の上限ではない（pending_full）。低いほうと「何で変わるか」は預かり、1日の数は 80'
    + '（高いほうのために取っておいた1件ぶんは返して、あとの答えに使う）',
    `下ごしらえ ${full5} ｜ ${whyOf(r)} ｜ 預かった数 ${r.saved} ｜ ${now2} ｜ 何で変わるか ${a.landing_pay_varies_by?.code} ｜ 数 ${dayN} ｜ 行 ${await rowsOf(k)}`);
  await db.query(
    `delete from public.pv_contrib_pending
      where key_hash = public.pv_contrib_key_hash($1) and item_key like 'x-%'`, [k]);

  k = await device(true, A_DAY);
  await setSaves(k, 77);
  r = await send(k, [low(300), high(400), VARIES('aircraft')], A_DAY);
  now2 = await heldNow(k, A_DAY);
  dayN = await savesOf(k);
  ok(r.rejected.length === 0 && r.saved === 3 && now2 === '300 USD／400 USD' && dayN === 80,
    '★e6 残り3件の日に、300／400 と「何で変わるか」→ 3件とも預かる（取っておいた1件ぶんは、高いほうを預かったら使い終わり）',
    `${whyOf(r)} ｜ 預かった数 ${r.saved} ｜ ${now2} ｜ 数 ${dayN}`);

  k = await device(false, A_DAY);
  await setSaves(k, 78);
  r = await send(k, [VAR, low(300), high(400)], A_DAY);
  now2 = await heldNow(k, A_DAY);
  dayN = await savesOf(k);
  a = await heldMap(k);
  ok(whyOf(r) === BOTH_LIM && r.saved === 1 && a.landing_pay?.code === 'variable' && now2 === '行なし／行なし' && dayN === 79,
    '★e7 対をまだ預けていない端末が、残り2件の日に「一定額ではない」・300・400 → 上の質問だけ預かり直し、2つの端は2つとも断る'
    + '（上の質問で1件使ったあとの空きは1件。どちらの行もできない・1日の数は 79）',
    `${whyOf(r)} ｜ 預かった数 ${r.saved} ｜ ${now2} ｜ 数 ${dayN}`);

  /* 上の行は、決めた形だけ。こちらは「性質」を見る ── 上限の近く（75〜80件め）で、対の2問に何をどう
     並べて送っても、(1) 額を持つ2つが食い違って預かりに残らない・(2) 1日の数が 80 を超えない。
     呼び出しは、決まった種から作る（Math.random を使わない ＝ 毎回同じ 400 回）。1回に1〜4件、中身は
     低いほう／高いほうの額（6つの額 × USD が多め・ときどき EUR）・「わからない」・スキップ（この入口は必ず断る）。
     ⚠️ 数だけで緑にしない: 「2つとも上限で断った回」と「2件以上預かった回」が1回も無い並びでは、
        何も試していない。どちらかが 0 になったら、決まりではなく種を替える。 */
  {
    let seed = 20261011;
    const rnd = () => {               // 決まった並びを返す（mulberry32）
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const int = (n) => Math.floor(rnd() * n);
    const pick = (xs) => xs[int(xs.length)];
    const AMTS = [50, 100, 150, 200, 300, 400], CURS = ['USD', 'USD', 'USD', 'EUR'];
    const draw = () => {
      const j = int(8);
      if (j < 3) return low(pick(AMTS), pick(CURS));
      if (j < 6) return high(pick(AMTS), pick(CURS));
      return j === 6 ? dunno(pick([LO, HI])) : { question_id: pick([LO, HI]), skip: true };
    };
    const said = (y) => `${y.question_id === LO ? '低' : '高'}${y.skip ? 'スキップ' : y.code ? '?' : `${y.num}${y.currency}`}`;
    let calls = 0, broken = 0, over80 = 0, cut = 0, both = 0, first = '';
    for (let dev = 1; dev <= 4; dev++) {
      const key = await device(true, A_DAY);
      for (let i = 0; i < 100; i++) {
        const start = 75 + int(6);
        const answers = Array.from({ length: 1 + int(4) }, draw);
        await setSaves(key, start);
        const res = await send(key, answers, A_DAY);
        const y = await heldMap(key);
        const end = await savesOf(key);
        const why = whyOf(res);
        calls++;
        const clash = !!(y[LO] && y[HI] && y[LO].num !== null && y[HI].num !== null
          && (y[LO].currency !== y[HI].currency || Number(y[LO].num) > Number(y[HI].num)));
        if (clash) broken++;
        if (end > 80) over80++;
        if (start < 80 && why.includes(`${LO}:rate_limited`) && why.includes(`${HI}:rate_limited`)) cut++;
        if (res.saved >= 2) both++;
        if ((clash || end > 80) && !first) {
          first = `端末 ${dev}・${i + 1}回め: 数 ${start} → ${end} ｜ ${answers.map(said).join('・')} ｜ ${why || '断りなし'} ｜ ${sayEnd(y[LO])}／${sayEnd(y[HI])}`;
        }
      }
    }
    ok(broken === 0 && over80 === 0 && cut > 0 && both > 0,
      '★上限の近く（75〜80件め）で、対の2問に何を並べて送っても、食い違う2つは預かりに残らない・1日の数は 80 を超えない'
      + `（決まった並びの ${calls} 回: 食い違い ${broken}・80超え ${over80} ｜ 2つとも上限で断った回 ${cut}・2件以上預かった回 ${both}）`,
      first);
  }

  /* a7 職位・機種・基地・契約は、4つで1組。4つを1つも運ばない呼び出しで答えを直しても、
     預けてある行の組は消えない。1つでも運べば、組は丸ごと入れ替わる（1つずつ混ぜない）。 */
  const CTX = { position: 'cap', fleet: 'b787', base_iata: 'HND', contract_type: 'direct' };
  const heldRow = async (key, q) => (await one(
    `select c.payload p from public.pv_contrib_pending c
      where c.key_hash = public.pv_contrib_key_hash($1) and c.kind = 'cond' and c.airline = $2 and c.item_key = $3`,
    [key, A_CTX, q]))?.p;
  const setOf = (p) => (p ? [p.position, p.fleet, p.base_iata, p.contract_type].map((x) => x ?? '空').join('・') : '行なし');
  const TOPQ = 'landing_pay';
  r = await putC(null, { airline: A_CTX, ...CTX, lang: 'ja', answers: [{ question_id: TOPQ, code: 'fixed', text: '月で変わる', share: true }] });
  const K7 = r.key;
  let p7 = await heldRow(K7, TOPQ);
  ok(r.saved === 1 && setOf(p7) === 'cap・b787・HND・direct' && p7.text === '月で変わる' && p7.share === true,
    '   （下ごしらえ）機長・B787・HND・直接雇用 を添えて、着陸手当を預けた', setOf(p7));
  r = await putC(K7, { airline: A_CTX, lang: 'en', answers: [{ question_id: TOPQ, code: 'variable' }] });
  p7 = await heldRow(K7, TOPQ);
  ok(r.saved === 1 && setOf(p7) === 'cap・b787・HND・direct' && p7.code === 'variable',
    '★a7 4つを1つも運ばない呼び出しで答えだけ直す → 預けてある職位・機種・基地・契約は、そのまま残る', `${setOf(p7)} ｜ ${p7.code}`);
  ok(p7.text === null && p7.share === false && p7.lang === 'en',
    '   a7 前の行から残すのは、その4つだけ（消した補足は消える・lang はこの呼び出しのもの）', J(p7));
  r = await putC(K7, { airline: A_CTX, position: 'no-such-rank', answers: [{ question_id: TOPQ, code: 'variable' }] });
  p7 = await heldRow(K7, TOPQ);
  ok(r.saved === 1 && setOf(p7) === 'cap・b787・HND・direct',
    '   a7 語彙に無い職位だけを添えた呼び出しは、運んでいないのと同じ（預けてある組を、空で上書きしない）', setOf(p7));
  r = await putC(K7, { airline: A_CTX, answers: [low(100)] });
  ok(r.saved === 1 && setOf(await heldRow(K7, LO)) === '空・空・空・空',
    '   a7 初めて預ける下の質問は、運んできたまま（空なら空。親の組を受け取るのは、引き継ぐとき）', setOf(await heldRow(K7, LO)));
  const [P7] = await crew(1);
  const c7 = await claim(P7, K7);
  const got7 = Object.fromEntries((await many(
    `select question_id q, "position" as pos, fleet, base_iata, contract_type
       from public.airline_conditions
      where proof_hash = public.pv_condition_hash($1::uuid, $2, null)`, [P7, A_CTX])).map((x) => [x.q, setOf({ ...x, position: x.pos })]));
  ok(c7.moved === 2 && c7.dropped === 0 && got7[TOPQ] === 'cap・b787・HND・direct' && got7[LO] === 'cap・b787・HND・direct',
    '★a7 ログインして引き継ぐと、会員の行は2つとも 機長・B787・HND・直接雇用（直した答えにも、あとから足した額にも付く）', J({ c7, got7 }));

  r = await putC(null, { airline: A_CTX, ...CTX, answers: [{ question_id: TOPQ, code: 'fixed' }] });
  const K7b = r.key;
  r = await putC(K7b, { airline: A_CTX, position: 'fo', answers: [{ question_id: TOPQ, code: 'fixed' }] });
  p7 = await heldRow(K7b, TOPQ);
  ok(r.saved === 1 && setOf(p7) === 'fo・空・空・空',
    '★a7 1つでも運んできたら、組は丸ごと入れ替わる（副操縦士だけを添えて直す → 前の機種・基地・契約は付いてこない）', setOf(p7));
}

/* ── 引き継ぐとき ── 本人が答え直して要らなくなった古い答え／対になる額（2026-10-11）──
   claim_contrib は、預かりを1件ずつ会員の入口へ出し、断られたものを全部 dropped に数えていた。
   画面は dropped を「いまの形式では受け取れず、引き継げませんでした」と伝える。本当でないことが2つ起きた。
     n … 上の質問を自分で答え直した人の、もう聞かれない古い答えまで「引き継げませんでした」と告げていた。
         → その答えは stale に数える（会員の回答にしない・画面は何も言わない）。
           stale は「本人が、上の質問を別の答えにしている」ときだけ。上の質問が受け取れなかった・
           上の質問に答えが無い、のせいで落ちる答えは、今までどおり dropped（失ったものは告げる）。
     h … 低いほう・高いほうを1件ずつ出すので、100／200 を持つ会員が 300／400 を引き継ぐと、低いほうの 300 が
         前の 200 と比べて断られ、会員の額は 100／400 になっていた（入れた 300 が消える）。
         → 文脈（年月・職位・機種・基地・契約・lang）が同じ2件は、1回の呼び出しで出す。
   どの回も、5つの数（moved・kept・dropped・stale・left）を足すと、引き継ぐ前に預けていた件数になる（n4）。
   ⚠️ 下の額は検査のための作りもの。どの会社の着陸手当でも、通勤の決まりでもない。 */
{
  const LO = 'landing_pay_from', HI = 'landing_pay_to';
  const VAR = { question_id: 'landing_pay', code: 'variable' };
  const FIX = { question_id: 'landing_pay', code: 'fixed' };
  const NONE = { question_id: 'landing_pay', code: 'no' };
  const AMT = { question_id: 'landing_pay_amount', num: 1500, currency: 'JPY' };
  const low = (num, currency = 'USD') => ({ question_id: LO, num, currency });
  const high = (num, currency = 'USD') => ({ question_id: HI, num, currency });
  const CTX = { position: 'fo', fleet: 'a320', lang: 'ja' };
  const say = (c) => (c && !c.__err ? `moved ${c.moved}・kept ${c.kept}・dropped ${c.dropped}・stale ${c.stale}・left ${c.left}` : J(c));
  const is = (c, moved, kept, dropped, stale, left) =>
    !!c && c.moved === moved && c.kept === kept && c.dropped === dropped && c.stale === stale && c.left === left;
  const prep = [];   // 下ごしらえが思ったとおりに入らなかった所（最後に1行で見る）

  /* 未ログインで預ける。key を渡すと、同じ端末の続きとして預ける */
  const hold = async (answers, airline = A_HAND, ctx = CTX, key = null) => {
    const r = await putC(key, { airline, ...ctx, answers });
    if (r.saved !== answers.length) prep.push('預ける: ' + J(r));
    return key || r.key;
  };
  /* 預かりの行を、入口を通さずに直す・消す（昔の決まりで預かった行や、壊れた行の代わり） */
  const patch = (key, q, obj) => db.query(
    `update public.pv_contrib_pending set payload = payload || $3::jsonb
      where key_hash = public.pv_contrib_key_hash($1) and kind = 'cond' and item_key = $2`, [key, q, J(obj)]);
  const unhold = (key, q) => db.query(
    `delete from public.pv_contrib_pending
      where key_hash = public.pv_contrib_key_hash($1) and kind = 'cond' and item_key = $2`, [key, q]);
  const heldN = (key) => cnt(`public.pv_contrib_pending where key_hash = public.pv_contrib_key_hash($1)`, [key]);
  const keyLives = async (key) => (await cnt(`public.pv_contrib_keys where key_hash = public.pv_contrib_key_hash($1)`, [key])) === 1;
  /* 「どちらが新しいか」を決めるために、時刻を前へずらす */
  const ageHeld = (key, hours) => db.query(
    `update public.pv_contrib_pending set updated_at = now() - make_interval(hours => $2::int)
      where key_hash = public.pv_contrib_key_hash($1)`, [key, hours]);
  const ageMine = (who, hours, airline = A_HAND) => db.query(
    `update public.airline_conditions set updated_at = now() - make_interval(hours => $3::int)
      where proof_hash = public.pv_condition_hash($1::uuid, $2, null)`, [who, airline, hours]);

  /* 会員の行（この会員の・この会社のものだけ） */
  const mineOf = async (who, airline = A_HAND) => Object.fromEntries((await many(
    `select question_id q, answer_code c, answer_num::float8 n, answer_currency cur, fleet, skipped_at is not null as skip
       from public.airline_conditions
      where proof_hash = public.pv_condition_hash($1::uuid, $2, null)`, [who, airline])).map((x) => [x.q, x]));
  const sayEnd = (x) => (!x ? '行なし' : (x.n === null ? (x.c || '答えなし') : `${x.n} ${x.cur}`));
  const pairOf = async (who, airline = A_HAND) => { const m = await mineOf(who, airline); return `${sayEnd(m[LO])}／${sayEnd(m[HI])}`; };
  /* 前から「一定額ではない」・低いほう・高いほう を持っている会員（どの行も、預かりより古い） */
  const memberWith = async (lo, hi, airlines = [A_HAND]) => {
    const [P] = await crew(1);
    for (const airline of airlines) {
      const r = await condM(P, { airline, position: 'cap', fleet: 'b787', answers: [VAR, low(lo), high(hi)] });
      if (r.saved !== 3) prep.push('会員の回答: ' + J(r));
      await ageMine(P, 4, airline);
    }
    return P;
  };

  /* 引き継ぐ。n ＝ 引き継ぐ前に、この鍵が預けていた件数 */
  const hand = async (who, key) => { const n = await heldN(key); const c = await claim(who, key); return { c, n }; };
  const sumOk = (x, tag) => ok(!x.c.__err && x.c.moved + x.c.kept + x.c.dropped + x.c.stale + x.c.left === x.n,
    `   n4 ${tag}: 5つの数を足すと、預けていた ${x.n} 件になる`, say(x.c));

  ok(A_HAND && A_HAND2 && A_HAND !== A_HAND2
     && await cnt(`public.airline_conditions where airline = any($1::text[])`, [[A_HAND, A_HAND2]]) === 0
     && await cnt(`public.pv_contrib_pending where airline = any($1::text[])`, [[A_HAND, A_HAND2]]) === 0,
    '   （下ごしらえ）ここで使う2社には、まだ会員の回答も預かりも1件も無い', J([A_HAND, A_HAND2]));

  let x, k, P, m;

  // ── n 本人が答え直して要らなくなった答え と、本当に受け取れなかった答え ──
  [P] = await crew(1);
  k = await hold([FIX, AMT]);
  await patch(k, 'landing_pay', { code: 'no-such-code' });
  x = await hand(P, k);
  ok(x.n === 2 && is(x.c, 0, 0, 2, 0, 0) && Object.keys(await mineOf(P)).length === 0,
    '★n2 上の質問が、受け取れない形（質問の表に無い答え）で預かっていた → 上の質問も、その下の額も dropped（stale にしない ＝ 失ったものは告げる）', say(x.c));
  sumOk(x, 'n2');

  [P] = await crew(1);
  await condM(P, { airline: A_HAND, answers: [NONE] });
  await ageMine(P, 4);
  k = await hold([FIX, AMT]);
  await patch(k, 'landing_pay', { code: 'no-such-code' });
  x = await hand(P, k);
  m = await mineOf(P);
  ok(x.n === 2 && is(x.c, 0, 0, 2, 0, 0) && Object.keys(m).length === 1 && m.landing_pay.c === 'no',
    '★n2 前から「ない」と答えている会員でも同じ → 2件とも dropped（額が落ちたのは、あとから預けた上の質問が受け取れなかったせい。本人が答え直したせいではない）', say(x.c));
  sumOk(x, 'n2（前から「ない」の会員）');

  [P] = await crew(1);
  k = await hold([
    { question_id: 'commuting_transport', code: 'always' },
    { question_id: 'commuting_transport_method', codes: ['company_taxi'] },
    { question_id: 'commuting_taxi_cap', code: 'per_ride' }]);
  await hold([{ question_id: 'commuting_transport', code: 'no' }], A_HAND, CTX, k);
  x = await hand(P, k);
  m = await mineOf(P);
  ok(x.n === 3 && is(x.c, 1, 0, 0, 2, 0) && Object.keys(m).length === 1 && m.commuting_transport.c === 'no',
    '★n3 3段の筋（送迎 → 手段 → タクシー代の上限）で、いちばん上を「ない」に直した人 → 下の2件は stale（2段下も。すぐ上の「手段」が会員の行に無くても dropped にしない）', say(x.c));
  sumOk(x, 'n3');

  [P] = await crew(1);
  k = await hold([FIX, AMT]);
  await unhold(k, 'landing_pay');
  x = await hand(P, k);
  ok(x.n === 1 && is(x.c, 0, 0, 1, 0, 0) && Object.keys(await mineOf(P)).length === 0,
    '★n5 上の質問の預かりが無く、会員も上の質問に答えていない → 下の額は dropped（本人が答え直したのではない。stale にして黙って消さない）', say(x.c));
  sumOk(x, 'n5');

  [P] = await crew(1);
  k = await hold([FIX, AMT]);
  await ageHeld(k, 2);
  await condM(P, { airline: A_HAND, answers: [NONE] });
  x = await hand(P, k);
  m = await mineOf(P);
  ok(x.n === 2 && is(x.c, 0, 1, 0, 1, 0) && Object.keys(m).length === 1 && m.landing_pay.c === 'no',
    '★n6 預けたあとで、会員として上の質問を「ない」と答えた人 → 上の質問は kept・下の額は stale（どちらも、本人の新しい答えのため）', say(x.c));
  sumOk(x, 'n6');

  /* n7 会員の入口は、1日の上限（60件）を、親の筋より先に見る。上の質問を「ない」に直した人の引き継ぎで、
     その「ない」がちょうど60件目になると、下の古い額は parent_missing ではなく rate_limited で返ってくる。
     それを left に数えて残すと、画面は「まだ引き継げていません。次に…続きを引き継ぎます」と告げ、次の回には
     黙って stale にすることになる（引き継がれることは無い答え）。行き先がもう決まっている答えは、その場で数える。
     対照は、上の質問を直していない人（下の額は、上限が明けたら本当に入る ＝ 残す）。 */
  const dayAt = (who, n) => db.query(
    `update public.profiles set cond_answers_day = current_date, cond_answers_today = $2 where id = $1`, [who, n]);
  [P] = await crew(1);
  k = await hold([FIX, AMT]);
  await hold([NONE], A_HAND, CTX, k);
  await dayAt(P, 59);
  x = await hand(P, k);
  m = await mineOf(P);
  ok(x.n === 2 && is(x.c, 1, 0, 0, 1, 0) && !(await keyLives(k)) && Object.keys(m).length === 1 && m.landing_pay.c === 'no',
    '★n7 上の質問を「ない」に直した人の引き継ぎで、その「ない」が1日の上限のちょうど最後の1件になる → 下の古い額は、その場で stale（残して「次に続きを引き継ぎます」と告げない）。鍵は消える。会員の回答は「ない」だけ',
    `${say(x.c)} ｜ 鍵 ${(await keyLives(k)) ? '残っている' : '消えた'} ｜ ${J(Object.keys(m))}`);
  sumOk(x, 'n7');

  [P] = await crew(1);
  k = await hold([FIX, AMT]);
  await dayAt(P, 59);
  x = await hand(P, k);
  m = await mineOf(P);
  ok(x.n === 2 && is(x.c, 1, 0, 0, 0, 1) && await keyLives(k) && Object.keys(m).length === 1 && m.landing_pay.c === 'fixed',
    '   n7 対照: 上の質問を直していない人の、下の額が上限で断られた → left（残す。上の質問は、いまもこの額を聞いている）。鍵は残る。会員の回答は上の質問だけ',
    `${say(x.c)} ｜ 鍵 ${(await keyLives(k)) ? '残っている' : '消えた'} ｜ ${J(Object.keys(m))}`);
  sumOk(x, 'n7（対照）');
  await db.query(`update public.profiles set cond_answers_day = current_date - 1 where id = $1`, [P]);
  x = await hand(P, k);
  m = await mineOf(P);
  ok(x.n === 1 && is(x.c, 1, 0, 0, 0, 0) && !(await keyLives(k))
     && m.landing_pay_amount && m.landing_pay_amount.n === 1500 && m.landing_pay_amount.cur === 'JPY',
    '   n7 対照: 日が変わってから、もう一度引き継ぐ → 残っていた額が moved（1500 JPY）。鍵はここで消える',
    `${say(x.c)} ｜ 鍵 ${(await keyLives(k)) ? '残っている' : '消えた'} ｜ ${J(m.landing_pay_amount || null)}`);
  sumOk(x, 'n7（対照・2回目）');

  /* n8 上限で断られた答えを「その場で数える」ときの分け方も、n2 と同じ（2026-10-11）。
     上の質問の預かりが、この引き継ぎの中で受け取られなかった（dropped）なら、下の額は、前から「ない」と
     答えている会員でも dropped（失ったものは告げる）。「上限で断られた・会員の答えは『ない』」だけを見て
     stale にすると、上が受け取れなかったせいで落ちた額が、黙って消える（n7 は、上の質問が入った回しか見ていない）。
     上の質問は、1日の上限より先に断られる形にしてある（年が、会員の入口の受け取る範囲の外）。
     会員の1日の数は、もう上限 ＝ 下の額は rate_limited で返る。 */
  [P] = await crew(1);
  await condM(P, { airline: A_HAND, answers: [NONE] });
  await ageMine(P, 4);
  k = await hold([FIX, AMT]);
  await patch(k, 'landing_pay', { year: 1900 });
  await dayAt(P, 60);
  x = await hand(P, k);
  m = await mineOf(P);
  ok(x.n === 2 && is(x.c, 0, 0, 2, 0, 0) && !(await keyLives(k)) && Object.keys(m).length === 1 && m.landing_pay.c === 'no',
    '★n8 上の質問の預かりが受け取られず（dropped）、下の額は1日の上限で断られた → 下の額も dropped（前から「ない」の会員でも stale にしない・残して「次に続きを引き継ぎます」とも告げない）。鍵は消える',
    `${say(x.c)} ｜ 鍵 ${(await keyLives(k)) ? '残っている' : '消えた'} ｜ ${J(Object.keys(m))}`);
  sumOk(x, 'n8');

  // ── h 対になる額（低いほう・高いほう）──
  /* 別の端末 X が、同じ会社に・同じ文脈で 10／20 USD を預けている。下の回は X が居るまま通す
     （相手を探すのは、引き継いでいる鍵の預かりからだけ）。 */
  const X = await hold([VAR, low(10), high(20)]);

  P = await memberWith(100, 200);
  k = await hold([VAR, low(300), high(400)]);
  x = await hand(P, k);
  m = await mineOf(P);
  ok(x.n === 3 && is(x.c, 3, 0, 0, 0, 0) && (await pairOf(P)) === '300 USD／400 USD' && m[LO].fleet === 'a320' && m[HI].fleet === 'a320',
    '★h1 100／200 USD を持つ会員が、預けていた 300／400 USD（同じ文脈）を引き継ぐ → 3件とも moved。会員の額は 300／400（低いほうの 300 を、前の 200 と比べて落とさない）',
    `${say(x.c)} ｜ ${await pairOf(P)}`);
  sumOk(x, 'h1');
  ok(!(await keyLives(k)) && await heldN(X) === 3, '   h1 残りが無いので、鍵は消えている。別の端末 X の預かり3件は、そのまま');

  P = await memberWith(100, 200);
  k = await hold([VAR, low(100), high(200)]);
  await patch(k, LO, { num: 300 });
  x = await hand(P, k);
  ok(x.n === 3 && is(x.c, 1, 0, 2, 0, 0) && (await pairOf(P)) === '100 USD／200 USD',
    '★h2 預かりの中で食い違っている2件（低いほう 300・高いほう 200。手で作った古い行）→ 2件とも dropped（stale ではない ＝ 告げる）。会員の 100／200 は変わらない',
    `${say(x.c)} ｜ ${await pairOf(P)}`);
  sumOk(x, 'h2');

  P = await memberWith(100, 200);
  k = await hold([VAR, low(100), high(200)]);
  await patch(k, HI, { currency: 'EUR' });
  x = await hand(P, k);
  ok(x.n === 3 && is(x.c, 1, 0, 2, 0, 0) && (await pairOf(P)) === '100 USD／200 USD',
    '   h2 通貨が食い違っている2件（100 USD・200 EUR）でも同じ → 2件とも dropped。会員の 100／200 USD は変わらない',
    `${say(x.c)} ｜ ${await pairOf(P)}`);
  sumOk(x, 'h2（通貨）');

  /* h3 ここは「分かっている端の場合」を、今の形のまま固定する検査。2件の文脈が違う預かりは、1回の呼び出しに
     まとめない（呼び出しが運べる文脈は1組。片方の答えに、もう片方の機種を付けない）。1件ずつ出すので、
     低いほうが会員の前の高いほうと比べて断られることがある。その1件は、本当に引き継げていない ＝ 告げる。 */
  P = await memberWith(100, 200);
  k = await hold([VAR, low(300)], A_HAND, { position: 'fo', fleet: 'a320', lang: 'ja' });
  await hold([high(400)], A_HAND, { position: 'fo', fleet: 'b787', lang: 'ja' }, k);
  x = await hand(P, k);
  ok(x.n === 3 && is(x.c, 2, 0, 1, 0, 0) && (await pairOf(P)) === '100 USD／400 USD',
    '★h3 2件の機種が違う預かり（低いほう 300 は A320・高いほう 400 は B787）→ 1件ずつ出す。低いほうは前の 200 と比べて dropped・高いほうは moved。会員は 100／400',
    `${say(x.c)} ｜ ${await pairOf(P)}`);
  sumOk(x, 'h3');

  P = await memberWith(100, 900);
  k = await hold([VAR, low(300), high(400)]);
  await ageHeld(k, 2);
  let r = await condM(P, { airline: A_HAND, answers: [low(450)] });
  x = await hand(P, k);
  ok(r.saved === 1 && x.n === 3 && is(x.c, 1, 1, 1, 0, 0) && (await pairOf(P)) === '450 USD／900 USD',
    '★h4 預けたあとで、会員として低いほうを 450 に直した人（高いほうは前から 900）→ 低いほうは kept。預かりの高いほう 400 は1件で出て、会員の 450 と比べて dropped（会員の新しい 450 を、預かりの 300 で置き換えない）',
    `${say(x.c)} ｜ ${await pairOf(P)}`);
  sumOk(x, 'h4');

  P = await memberWith(100, 200);
  k = await hold([VAR, low(300), high(400)]);
  await ageHeld(k, 2);
  r = await condM(P, { airline: A_HAND, answers: [high(500)] });
  x = await hand(P, k);
  ok(r.saved === 1 && x.n === 3 && is(x.c, 2, 1, 0, 0, 0) && (await pairOf(P)) === '300 USD／500 USD',
    '★h4 預けたあとで、会員として高いほうを 500 に直した人 → 預かりの低いほう 300 は1件で出て moved（会員の 500 と比べる）・高いほうは kept。会員は 300／500（会員の新しい 500 を、預かりの 400 で置き換えない）',
    `${say(x.c)} ｜ ${await pairOf(P)}`);
  sumOk(x, 'h4（高いほうが新しい）');

  /* h5 会員の入口の1日の上限（60件）に、対の2件ぶんの空きが無い（上の質問で1件使うと、残り1件）。
     会員の入口は、同じ呼び出しの2つの端を「1組」として、2つとも rate_limited で断る
     （db/airline-conditions.sql の「★1組」）＝ 引き継ぎは、2件とも残して止まる。
     入口が片方だけ入れて返す形（低いほうは同じ呼び出しの高いほう 400 と比べて入り、高いほうは上限で断られる ＝
     会員の額が 300／200 になる）は、いまの入口からは返らない。それでも返ったら、2件まとめた呼び出しを丸ごと
     取り消して、2件とも残す（claim_contrib の PVC01。入口の決まりが外れたときの、2つ目の網）。 */
  P = await memberWith(100, 200);
  k = await hold([VAR, low(300), high(400)]);
  await db.query(`update public.profiles set cond_answers_day = current_date, cond_answers_today = 58 where id = $1`, [P]);
  x = await hand(P, k);
  ok(x.n === 3 && is(x.c, 1, 0, 0, 0, 2) && (await pairOf(P)) === '100 USD／200 USD' && await keyLives(k),
    '★h5 1日の上限に、対の2件ぶんの空きが無い会員 → 会員の入口が2件とも断り、2件とも left（片方だけ入れて、会員の額を 300／200 にしない）。残りが在るので、鍵は残る',
    `${say(x.c)} ｜ ${await pairOf(P)}`);
  sumOk(x, 'h5');
  await db.query(`update public.profiles set cond_answers_day = current_date - 1 where id = $1`, [P]);
  x = await hand(P, k);
  ok(x.n === 2 && is(x.c, 2, 0, 0, 0, 0) && (await pairOf(P)) === '300 USD／400 USD' && !(await keyLives(k)),
    '   h5 日が変わってから、もう一度引き継ぐ → 残っていた2件が moved。会員は 300／400。鍵はここで消える',
    `${say(x.c)} ｜ ${await pairOf(P)}`);
  sumOk(x, 'h5（2回目）');

  P = await memberWith(100, 200, [A_HAND, A_HAND2]);
  k = await hold([VAR, low(300)]);
  await hold([VAR, high(400)], A_HAND2, CTX, k);
  x = await hand(P, k);
  ok(x.n === 4 && is(x.c, 3, 0, 1, 0, 0) && (await pairOf(P)) === '100 USD／200 USD' && (await pairOf(P, A_HAND2)) === '100 USD／400 USD',
    '★h6 同じ鍵が、会社Aに低いほう 300・会社Bに高いほう 400 を預けている → 会社をまたいで2件を組にしない（Aの 300 は Aの 200 と比べて dropped・Bの 400 は moved）',
    `${say(x.c)} ｜ A ${await pairOf(P)} ｜ B ${await pairOf(P, A_HAND2)}`);
  sumOk(x, 'h6');

  P = await memberWith(100, 200);
  k = await hold([VAR, low(300), high(400)]);
  await patch(k, LO, { year: 1900 });
  await patch(k, HI, { year: 1900 });
  x = await hand(P, k);
  ok(x.n === 3 && is(x.c, 1, 0, 2, 0, 0) && (await pairOf(P)) === '100 USD／200 USD',
    '★h7 2件まとめた呼び出しを、会員の入口が丸ごと断る形（年が範囲の外。手で作った行）→ 今までどおり1件ずつ出して、2件とも dropped。引き継ぎそのものは止まらない',
    `${say(x.c)} ｜ ${await pairOf(P)}`);
  sumOk(x, 'h7');

  /* h8 2件まとめた呼び出しの返事は、質問ごとに読む（断った理由に名前が無いほうは、保存された）。
     返事が「2件ぶん」になっていないとき（保存した数 ＋ 断った数 が 2 でない）は、そう読めない ＝
     まとめた呼び出しを取り消して、今までどおり1件ずつ出す。入口は、スキップの印が付いた答えを
     「保存した」にも「断った」にも数えないので、手で印を付けた行でその形を作る（預かる入口は、スキップを預からない）。 */
  P = await memberWith(100, 200);
  k = await hold([VAR, low(150), high(400)]);
  await patch(k, LO, { skip: true });
  x = await hand(P, k);
  ok(x.n === 3 && is(x.c, 2, 0, 1, 0, 0) && (await pairOf(P)) === '100 USD／400 USD',
    '★h8 2件まとめた返事が「2件ぶん」に読めない形（スキップの印が付いた、手で作った行）→ 1件ずつ出し直す。保存されていない低いほうを moved に数えない（会員の低いほうは 100 のまま）',
    `${say(x.c)} ｜ ${await pairOf(P)}`);
  sumOk(x, 'h8');

  /* h10 2件を組にするのは、2件とも「行の質問と、中身が名乗る質問が同じ」ときだけ。預かる入口は必ず同じにして
     書くので、外れるのは手で作った行だけ。外れた行を組にすると、入口には同じ質問が2回届く。返事の「断った数」は
     2 になるが、2つの端のことではない ＝ 名前の出なかった端（何も書かれていない）を、保存されたと読んでしまう。
       h10  … 相手の行（高いほう）が、低いほうの質問を名乗っている（ループが先に着くのは、まともな低いほうの行）
       h10' … ループが先に着く行（低いほう）が、高いほうの質問を名乗っている */
  P = await memberWith(100, 200);
  k = await hold([VAR, low(300), high(400)]);
  await patch(k, HI, { question_id: LO });
  x = await hand(P, k);
  ok(x.n === 3 && is(x.c, 1, 0, 2, 0, 0) && (await pairOf(P)) === '100 USD／200 USD',
    '★h10 高いほうの行の中身が、低いほうの質問を名乗っている（手で作った行）→ 組にしない。1件ずつ出して2件とも dropped（何も書かれていない行を moved に数えない）。会員の 100／200 は変わらない',
    `${say(x.c)} ｜ ${await pairOf(P)}`);
  sumOk(x, 'h10');

  P = await memberWith(100, 200);
  k = await hold([VAR, low(50), high(60)]);
  await patch(k, LO, { question_id: HI });
  x = await hand(P, k);
  ok(x.n === 3 && is(x.c, 1, 0, 2, 0, 0) && (await pairOf(P)) === '100 USD／200 USD',
    '★h10 低いほうの行の中身が、高いほうの質問を名乗っている（ループが先に着く行のほうが外れている）→ 同じ。2件とも dropped。会員の 100／200 は変わらない',
    `${say(x.c)} ｜ ${await pairOf(P)}`);
  sumOk(x, 'h10（先に着く行が外れている）');

  /* h9 相手を探すのは、引き継いでいる鍵の預かりからだけ。この鍵は低いほうしか預けていない ＝ 同じ会社・同じ文脈で
     高いほうを預けているのは、別の端末 X（20 USD）だけ。X の行を相手にすると、300 と 20 が食い違って2件とも断られ、
     X の預かりが1件消える。 */
  P = await memberWith(100, 400);
  k = await hold([VAR, low(300)]);
  x = await hand(P, k);
  ok(x.n === 2 && is(x.c, 2, 0, 0, 0, 0) && (await pairOf(P)) === '300 USD／400 USD' && await heldN(X) === 3,
    '★h9 高いほうを預けているのが別の端末だけのとき → その行を相手にしない。低いほう 300 は1件で出て moved（会員は 300／400）。別の端末の預かりは3件のまま',
    `${say(x.c)} ｜ ${await pairOf(P)} ｜ X ${await heldN(X)} 件`);
  sumOk(x, 'h9');

  /* 上の h の行は、決めた形だけ。こちらは「性質」を見る ── 会員の1日の数が上限の近く（56〜60件め）に在るとき、
     端末が対の2問をどう預けていても、引き継いだあと (1) 会員の2つの額が食い違わない・(2) 5つの数を足すと
     預けていた件数になる・(3) 会員の1日の数が 60 を超えない。
     1回ごとに、新しい端末が「一定額ではない」・300／400 USD を預け、決まった種から作った呼び出しを0〜3回足す
     （文脈は hold と同じ ＝ 2つの端は組にできるまま。足す呼び出しは断られてもよい）。引き継ぐのは、
     前から 100／200 USD を持つ新しい会員。
     ⚠️ 端末の初めの額は、会員の 100／200 ではなく 300／400。片方だけ入った形が食い違いになるのは、預かりの
        低いほうが、会員の高いほう（200）に収まらないときだけ（100／200 どうしでは、片方だけ入っても 100／200）。
     ⚠️ 数だけで緑にしない: 残した回・2つの端とも moved の回・「切れ目の回」（会員の数が 58 ＝ 上の質問で1件
        使うと残り1件 で、預かりの低いほうが 200 を超えるか USD でない）が1回も無い並びでは、何も試していない。
        0 になったら、決まりではなく種を替える。 */
  {
    let seed = 20261011;
    const rnd = () => {               // 決まった並びを返す（mulberry32）
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const int = (n) => Math.floor(rnd() * n);
    const pick = (xs) => xs[int(xs.length)];
    const AMTS = [50, 100, 150, 200, 300, 400], CURS = ['USD', 'USD', 'USD', 'EUR'];
    const draw = () => {
      const j = int(7);
      if (j < 3) return low(pick(AMTS), pick(CURS));
      if (j < 6) return high(pick(AMTS), pick(CURS));
      return { question_id: pick([LO, HI]), code: 'unknown' };
    };
    const heldOf = async (key) => Object.fromEntries((await many(
      `select item_key q, payload p from public.pv_contrib_pending
        where key_hash = public.pv_contrib_key_hash($1) and kind = 'cond' and airline = $2`, [key, A_DAY])).map((y) => [y.q, y.p]));
    const sayHeld = (p) => (!p ? '行なし' : (p.num == null ? (p.code || '答えなし') : `${p.num} ${p.currency}`));
    let rounds = 0, handBroken = 0, handSumBad = 0, handOver = 0, handLeft = 0, handMovedPair = 0, handCut = 0, first = '';
    for (let i = 0; i < 16; i++) {
      const key = await hold([VAR, low(300), high(400)], A_DAY);
      for (let j = int(4); j > 0; j--) {
        await putC(key, { airline: A_DAY, ...CTX, answers: Array.from({ length: 1 + int(2) }, draw) });
      }
      const who = await memberWith(100, 200, [A_DAY]);
      const start = 56 + int(5);
      await dayAt(who, start);
      const h = await heldOf(key);
      const y = await hand(who, key);
      const mm = await mineOf(who, A_DAY);
      const end = (await one(`select cond_answers_today n from public.profiles where id = $1`, [who])).n;
      rounds++;
      const clash = !!(mm[LO] && mm[HI] && mm[LO].n !== null && mm[HI].n !== null
        && (mm[LO].cur !== mm[HI].cur || mm[LO].n > mm[HI].n));
      const sumBad = !!y.c.__err || y.c.moved + y.c.kept + y.c.dropped + y.c.stale + y.c.left !== y.n;
      if (clash) handBroken++;
      if (sumBad) handSumBad++;
      if (end > 60) handOver++;
      if (!y.c.__err && y.c.left > 0) handLeft++;
      if (!y.c.__err && h[LO] && h[HI] && y.c.moved === y.n) handMovedPair++;
      if (start === 58 && h[LO] && h[HI] && h[LO].num != null && (Number(h[LO].num) > 200 || h[LO].currency !== 'USD')) handCut++;
      if ((clash || sumBad || end > 60) && !first) {
        first = `${i + 1}回め: 会員の数 ${start} → ${end} ｜ 預かり ${sayHeld(h[LO])}／${sayHeld(h[HI])} ｜ ${say(y.c)}（預けていた ${y.n} 件）｜ 会員 ${await pairOf(who, A_DAY)}`;
      }
    }
    ok(handBroken === 0 && handSumBad === 0 && handOver === 0 && handLeft > 0 && handMovedPair > 0 && handCut > 0,
      '★会員の1日の数が上限の近く（56〜60件め）でも、引き継いだあと、会員の2つの額は食い違わない・5つの数は預けていた件数になる・1日の数は 60 を超えない'
      + `（決まった並びの ${rounds} 回: 食い違い ${handBroken}・数が合わない ${handSumBad}・60超え ${handOver} ｜ 残した回 ${handLeft}・2つの端とも moved の回 ${handMovedPair}・切れ目の回 ${handCut}）`,
      first);
  }

  ok(prep.length === 0 && await heldN(X) === 3, '   （下ごしらえ）どの回も、預ける・会員の回答を置く、が思ったとおりに入っていた。別の端末 X の預かりは最後まで3件', J(prep.slice(0, 3)));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 8-3. 他人の回答の集計（立場ごとに何が返るか・直接は読めない）');
// ════════════════════════════════════════════════════════════
/* 会員の回答の集計（3人そろった質問だけ）を返す口は pv_contrib_facts の1つ。見せてよいかは pv_contrib_sees が決める。
   会社は A_FACT（ほかの節が使わない会社）。答える人は F1〜F4。
   読む人:  MEM … ログインしただけ ／ PIL … 確認済みの印だけ ／ HAND … 鍵を手で立てただけ（給与の行が無い）
           PAYER … この会社に給与を出しただけ。1つも答えていない ＝ 自分の会社なので開く
           GIVE4 … ほかの会社（A_HOME）に給与を出して、そこに4つ答えた ＝ あと1つ（give）
           GIVE5 … 同じく5つ答えた ＝ どの会社も開く ／ OP … 運営（運営の名簿が在る DB だけ）
   開いていない人への返事は L0 / L1 / L2 の字そのもの（集計も、会社の名前も、数も入らない）。
   ⚠️ 期待する答えは、ここで出した答えから書く（ビューを読み返して合わせない）。
      人数だけは、持ち主の役でビューを読んだ値（truth）と突き合わせる。
   ⚠️ 落とし方（わざと壊して赤を見る）は、db/contrib.sql（3人の壁は db/airline-conditions.sql も）の側を壊す。ここの期待を緩めない。 */
{
  const [F1, F2, F3, F4, MEM, PIL, PAYER, OP, GIVE4, GIVE5, HAND] = await crew(11);
  const KEYS = ['peer_support', 'reserve_duty', 'roster_lead_days', 'sick_leave', 'training_bond'];
  const OPEN4 = ['peer_support', 'reserve_duty', 'roster_lead_days', 'training_bond'];   // 3人が答えた4問（sick_leave は2人だけ）

  // 答えを置く。数の質問の3つの値は、質問の表の下限・上限から作る（打ち込まない）
  const RL = await one(`select num_min, num_max from public.pv_condition_questions where id = 'roster_lead_days'`);
  const NUMS = [Number(RL.num_min), Math.floor((Number(RL.num_min) + Number(RL.num_max)) / 2), Number(RL.num_max)];
  let put = 0;
  for (const [who, rd, tb, ps, num] of [[F1, 'yes', 'yes', 'internal', NUMS[0]], [F2, 'yes', 'yes', 'internal', NUMS[1]], [F3, 'no', 'yes', 'external', NUMS[2]]]) {
    put += (await condM(who, { airline: A_FACT, answers: [
      { question_id: 'reserve_duty', code: rd }, { question_id: 'training_bond', code: tb },
      { question_id: 'peer_support', code: ps }, { question_id: 'roster_lead_days', num }] })).saved || 0;
  }
  for (const who of [F1, F2]) put += (await condM(who, { airline: A_FACT, answers: [{ question_id: 'sick_leave', code: 'days' }] })).saved || 0;
  must(put === 14 && NUMS[0] < NUMS[1] && NUMS[1] < NUMS[2], '8-3 の答え（3人×4問＋2人×1問）を置けたこと', J({ put, NUMS }));

  // 立場を作る
  const hasVL = await cnt(`information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'verify_level'`) === 1;
  if (hasVL) await db.query(`update public.profiles set verify_level = 1 where id = $1`, [PIL]);
  await paid(PAYER, A_FACT);                                   // この会社に給与を出しただけ（1つも答えていない）
  await paid(GIVE4, A_HOME); await five(GIVE4, A_HOME, 4);     // ほかの会社に給与を出して、そこに4つ
  await paid(GIVE5, A_HOME); await five(GIVE5, A_HOME, 5);     // 同じく5つ ＝ どの会社も開く
  await unlock(HAND);                                          // 鍵を手で立てただけ（給与の行が無い）
  const hasOps = await cnt(`information_schema.tables where table_schema = 'public' and table_name = 'pv_admins'`) === 1;

  // 人数の正解は、持ち主の役でビューを読んだ値
  const truth = await many(`select question_id, n from public.airline_condition_facts where airline = $1`, [A_FACT]);
  const nOf = Object.fromEntries(truth.map((t) => [t.question_id, Number(t.n)]));
  const ids = (r) => (Array.isArray(r && r.facts) ? r.facts.map((f) => f.question_id).sort().join(',') : '（facts が無い）');
  const fact = (r, id) => (Array.isArray(r && r.facts) ? r.facts : []).find((f) => f.question_id === id);

  /* T13（この節のいちばん最後）が比べる「読む前」の姿。読み口を1度も呼ばないうちに取っておく。
     給与の資格（pv_my_give）・給与の一覧（pv_pay_rows）・鍵の期限・確認済みの印 ── 答えた人・会員・あと1つの人・開いている人。
     給与の一覧は、行を決まった順に並べてから比べる：T5 で PAYER が同じ月の給与を出し直すと、その1行が一覧の先頭へ動く
     （中身は同じ・並びだけ）。読んだ人の資格とは関係の無い動きなので、並びは見ない。行の中身と数は、1文字ずつ見る。 */
  const fixed = (g) => (g && Array.isArray(g.rows) ? { ...g, rows: g.rows.map((r) => J(r)).sort() } : g);
  const standing = async (who) => J({ give: await give(who), gate: fixed(await gate(who)),
    row: await one(`select access_until${hasVL ? ', verify_level' : ''} from public.profiles where id = $1`, [who]) });
  const WATCH = [['答えた人', F1], ['会員', MEM], ['あと1つの人', GIVE4], ['開いている人', GIVE5]];
  const BEFORE = {};
  for (const [name, who] of WATCH) BEFORE[name] = await standing(who);

  // ── T1 未ログイン ──
  const t1 = [J(await facts(ANON, A_FACT, KEYS)), J(await facts(ANON, 'no-such-airline', KEYS)), J(await facts(ANON, 'other', KEYS)), J(await facts(ANON, null, KEYS))];
  ok(t1.every((x) => x === L0),
    '★T1 未ログインには、集計は1文字も返らない（在る会社・知らない会社・自由入力の会社・会社なしで、同じ返事。中身は ok と state だけ）', t1.join(' ｜ '));
  const t1x = [J(await facts(ANON)), J(await facts(ANON, A_FACT, 'reserve_duty')), J(await facts(ANON, A_FACT, [])),
               J(await facts(ANON, A_FACT, Array.from({ length: 121 }, (_, i) => 'q' + i)))];
  ok(t1x.every((x) => x === L0),
    '   T1 未ログインが、引数なし・質問の指定が字・空の並び・121件 で呼んでも、同じ返事（断りもしない）', t1x.join(' ｜ '));

  // ── T1b ログインが死んでいる人 ──
  const t1b = J(await facts(DEAD, A_FACT, KEYS));
  ok(t1b === L0, '★T1b ログインが死んでいる人には、未ログインと同じ返事', t1b);

  // ── T2 ログインしただけの会員 ──
  const t2 = J(await facts(MEM, A_FACT, KEYS));
  ok(t2 === L1, '★T2 ログインしただけの会員には、集計は1文字も返らない（集計の一覧そのものが、返事に無い）', t2);

  // ── T3 確認済みの印・答えた本人・手で立てた鍵 ──
  const t3 = [J(await facts(PIL, A_FACT, KEYS)), J(await facts(F1, A_FACT, KEYS)), J(await facts(HAND, A_FACT, KEYS))];
  const f1own = ((await mineC(F1, { airline: A_FACT })).answers || []).filter((x) => x.question_id === 'reserve_duty').map((x) => x.code).join(',');
  ok(t3.every((x) => x === L1) && f1own === 'yes',
    `★T3 確認済みパイロットの印の人・答えた本人・鍵を手で立てただけの人（給与の行が無い）も、会員と同じ返事（本人の答えは「自分の回答」の読み口に残っている${hasVL ? '' : '・この器に印の列は無い'}）`,
    t3.join(' ｜ ') + ' ｜ 本人の reserve_duty: ' + f1own);

  // ── T4 この会社に給与を出した人（自分の会社は、鍵だけで開く）──
  const payer = await facts(PAYER, A_FACT, KEYS);
  ok(payer.state === 'open' && keys(payer) === 'facts,ok,state' && ids(payer) === OPEN4.join(',')
     && ids(payer) === truth.map((t) => t.question_id).sort().join(','),
    '★T4 この会社に給与を出した人には（1つも答えていなくても）、3人そろった4問の集計が返る（返事は ok・state・facts だけ。質問はビューに在るものと同じ）',
    J(payer) + ' ｜ ビュー: ' + J(truth));
  ok(payer.state === 'open' && OPEN4.every((id) => fact(payer, id) && fact(payer, id).n === nOf[id] && nOf[id] === 3),
    '   T4 どの質問も、人数はビューの値と同じ（3人）', J((payer.facts || []).map((f) => [f.question_id, f.n])) + ' ｜ ビュー: ' + J(nOf));
  const num = fact(payer, 'roster_lead_days') || {};
  ok(num.kind === 'num' && num.median_num != null && Object.hasOwn(num, 'lead') && num.lead === null,
    '★T4 数の質問（roster_lead_days）は、中央値が在り、lead の欄は在って null', J(num));
  const leads = J(['reserve_duty', 'training_bond', 'peer_support'].map((id) => (fact(payer, id) || {}).lead));
  ok(leads === J([['yes'], ['yes'], ['internal']]),
    '★T4 選ぶ質問の lead は、出した答えのとおり ── reserve_duty は yes（yes・yes・no）／training_bond は yes（3人とも）／peer_support は internal（internal・internal・external）', leads);

  // ── T5 鍵が切れた → 出し直す ──
  await db.query(`update public.profiles set access_until = now() - interval '1 minute' where id = $1`, [PAYER]);
  const expired = J(await facts(PAYER, A_FACT, KEYS));
  ok(expired === L1, '★T5 給与の鍵が切れたら、1文字も返らない（鍵の無い会員と同じ返事）', expired);
  await paid(PAYER, A_FACT);
  const again = await facts(PAYER, A_FACT, KEYS);
  ok(again.state === 'open' && J(again) === J(payer), '   T5 同じ会社・同じ月の給与を出し直すと、また開く（切れる前と同じ返事）', J(again));

  // ── T6 運営 ──
  let opIds = null;
  if (hasOps) {
    await db.query(`insert into public.pv_admins (user_id, note) values ($1, 'test') on conflict do nothing`, [OP]);
    const op = await facts(OP, A_FACT, KEYS);
    await db.query(`delete from public.pv_admins where user_id = $1`, [OP]);
    const off = J(await facts(OP, A_FACT, KEYS));
    opIds = ids(op);
    ok(op.state === 'open' && J(op.facts) === J(payer.facts) && off === L1,
      '★T6 運営には開く（この会社に給与を出した人と同じ集計）。運営の名簿から外したあとは、会員と同じ返事', J(op) + ' ｜ 名簿から外したあと ' + off);
  } else {
    console.log('  （pv_admins が無い DB：運営の行は見ていない）');
  }

  // ── T7 3人の壁は、開いている人にも残る ──
  const two = [J(await facts(GIVE5, A_FACT, ['sick_leave'])), J(await facts(GIVE5, A_BARE, ['sick_leave']))];
  ok(!ids(payer).includes('sick_leave') && (opIds === null || !opIds.includes('sick_leave'))
     && two[0] === two[1] && two[0] === '{"ok":true,"facts":[],"state":"open"}'
     && await cnt(`public.airline_conditions where airline = $1 and question_id = 'sick_leave'`, [A_FACT]) === 2,
    '★T7 2人しか答えていない質問（sick_leave）は、開いている人にも返らない ＝ 誰も答えていない会社と、返事が1文字も違わない', two.join(' ｜ '));
  const f4 = await condM(F4, { airline: A_FACT, answers: [{ question_id: 'sick_leave', code: 'days' }] });
  const three = [fact(await facts(PAYER, A_FACT, KEYS), 'sick_leave'), fact(await facts(GIVE5, A_FACT, KEYS), 'sick_leave')];
  ok(f4.saved === 1 && three.every((f) => f && f.n === 3 && J(f.lead) === J(['days'])),
    '   T7 3人めが答えると、この会社に給与を出した人にも、どの会社も開いている人にも、3人として返る', J(three));

  // ── T7b あと1つの人（give）／ 5つ答えた人 ──
  const g4 = [J(await facts(GIVE4, A_FACT, KEYS)), J(await facts(GIVE4, A_BARE, KEYS)), J(await facts(GIVE4, 'no-such-airline', KEYS)),
              J(await facts(GIVE4, 'other', KEYS)), J(await facts(GIVE4, null, KEYS))];
  ok(g4.every((x) => x === L2),
    '★T7b 自分の会社にまだ4つの人には、ほかの会社の集計は1文字も返らない（回答が在る会社・無い会社・知らない会社・自由入力の会社・会社なしで、同じ返事）', g4.join(' ｜ '));
  const g5 = J(await facts(GIVE5, A_FACT, KEYS)), own = J(await facts(PAYER, A_FACT, KEYS));
  ok(g5 === own && JSON.parse(g5).state === 'open' && ids(JSON.parse(g5)) === KEYS.join(','),
    '★T7b 自分の会社に5つ答えた人には、ほかの会社の集計が開く（その会社に給与を出した人と、1文字も違わない返事）', g5 + ' ｜ ' + own);

  /* ── TL 「最多」と書いてよい答え（lead）の決まり ──
     決めるのは pv_contrib_facts の中の1か所（画面は数えない・決めない）。ここは、本物の回答を置いて、その結果だけを見る。
     答える人は V1〜V6（この節のほかの人は、ここでは1つも答えない ＝ T13 の「読む前」の姿が動かない）。読む人は GIVE5。
     質問は表から読む（打ち込まない）:
       MQ … 選べるだけ選ぶ質問を3つ（親が1つだけ・その親は「1つ選ぶ」質問で、親を持たない・「わからない」以外の選択肢が3つ以上）
       CQ … 1つ選ぶ質問を4つ（親が無い・KEYS でも MQ の親でもない・「わからない」以外の選択肢が3つ以上）
     期待する値は、ここで出した答えから書く（ビューの分布を読み返して合わせない）。並びは符号の順（sort）。
     1件は [人数, lead] の字で比べる。同じ人が同じ質問に答え直すと、前の答えと入れ替わる。
     ⚠️ 下の行は、この順のまま（1行ごとに、次の答えを置く前に判定する）。 */
  {
    const [V1, V2, V3, V4, V5, V6] = await crew(6);
    const MQ = await many(
      `select k.question_id as id, k.parent, k.parent_when[1] as pw, array_remove(q.choice_codes, 'unknown') as c
         from public.pv_condition_links k
         join public.pv_condition_questions q on q.id = k.question_id and q.active and q.kind = 'multi'
         join public.pv_condition_questions pq on pq.id = k.parent and pq.active and pq.kind = 'choice'
        where (select count(*) from public.pv_condition_links z where z.question_id = k.question_id) = 1
          and not exists (select 1 from public.pv_condition_links z where z.question_id = k.parent)
          and cardinality(array_remove(q.choice_codes, 'unknown')) >= 3
        order by k.question_id limit 3`);
    const CQ = await many(
      `select q.id, array_remove(q.choice_codes, 'unknown') as c from public.pv_condition_questions q
        where q.active and q.kind = 'choice' and q.id <> all($1::text[]) and q.id <> all($2::text[])
          and cardinality(array_remove(q.choice_codes, 'unknown')) >= 3
          and not exists (select 1 from public.pv_condition_links k where k.question_id = q.id)
        order by q.id limit 4`, [KEYS, MQ.map((m) => m.parent)]);
    ok(MQ.length === 3, `   TL 選べるだけ選ぶ質問を、質問の表から3つ読めた: ${MQ.map((m) => m.id).join(' / ')}`, J(MQ));
    ok(CQ.length === 4, `   TL 1つ選ぶ質問を、質問の表から4つ読めた: ${CQ.map((q) => q.id).join(' / ')}`, J(CQ));
    if (MQ.length === 3 && CQ.length === 4) {
      let sent = 0, kept = 0;
      const say  = async (who, answers) => { sent += answers.length; kept += (await condM(who, { airline: A_FACT, answers })).saved || 0; };
      const pick = (q, who, code) => say(who, [{ question_id: q.id, code }]);                                             // 1つ選ぶ
      const tick = (m, who, codes) => say(who, [{ question_id: m.parent, code: m.pw }, { question_id: m.id, codes }]);     // 親と同じ呼び出しで、選べるだけ選ぶ
      const led  = async (id) => {
        const r = await facts(GIVE5, A_FACT, [id]), f = fact(r, id);
        return f ? J([f.n, f.lead]) : '（その質問の行が無い）' + J(r);
      };
      const unknownRows = (id) => cnt(`public.airline_conditions where airline = $1 and question_id = $2 and answer_code = 'unknown'`, [A_FACT, id]);
      const [c0, c1] = CQ[0].c;

      // TL1 いちばん多い答えが1つ
      await pick(CQ[0], V1, c0); await pick(CQ[0], V2, c0); await pick(CQ[0], V3, c1);
      let got = await led(CQ[0].id);
      ok(got === J([3, [c0]]), `★TL1 いちばん多い答えが1つ（${c0}・${c0}・${c1}）→ 3人・lead はその1つ`, got);

      // TL6 「わからない」は数えない
      await pick(CQ[0], V4, 'unknown'); await pick(CQ[0], V5, 'unknown'); await pick(CQ[0], V6, 'unknown');
      got = await led(CQ[0].id);
      ok(got === J([3, [c0]]) && await unknownRows(CQ[0].id) === 3,
        '★TL6 そこへ3人が「わからない」と答えても、3人・lead は同じ1つのまま（「わからない」は、いちばん多い答えにも、人数にもならない）', got);
      await pick(CQ[3], V1, 'unknown'); await pick(CQ[3], V2, 'unknown'); await pick(CQ[3], V3, 'unknown');
      const allUnk = [J(await facts(GIVE5, A_FACT, [CQ[3].id])), J(await facts(GIVE5, A_BARE, [CQ[3].id]))];
      ok(allUnk[0] === allUnk[1] && await unknownRows(CQ[3].id) === 3,
        '★TL6 3人とも「わからない」の質問は、行が無い ＝ 誰も答えていない会社と、返事が1文字も違わない', allUnk.join(' ｜ '));

      // TL2 並んだ（1つ選ぶ質問）
      await pick(CQ[1], V1, CQ[1].c[0]); await pick(CQ[1], V2, CQ[1].c[0]); await pick(CQ[1], V3, CQ[1].c[1]); await pick(CQ[1], V4, CQ[1].c[1]);
      got = await led(CQ[1].id);
      ok(got === J([4, []]), '★TL2 1つ選ぶ質問で、2人と2人に並んだ → 4人・lead は空（どちらも「最多」と書かない）', got);

      // TL3 3人が、1つずつ別の答え
      await pick(CQ[2], V1, CQ[2].c[0]); await pick(CQ[2], V2, CQ[2].c[1]); await pick(CQ[2], V3, CQ[2].c[2]);
      got = await led(CQ[2].id);
      ok(got === J([3, []]), '★TL3 3人が、1つずつ別の答え → 3人・lead は空', got);

      // TL4 選べるだけ選ぶ質問で並んで、どちらも半分より多い
      let [m0, m1, m2] = MQ[0].c;
      await tick(MQ[0], V1, [m0, m1]); await tick(MQ[0], V2, [m0, m1]); await tick(MQ[0], V3, [m2]);
      got = await led(MQ[0].id);
      ok(got === J([3, [m0, m1].sort()]), '★TL4 選べるだけ選ぶ質問で、2つの答えが並んで、どちらも3人のうち2人が選んだ → 3人・lead はその2つ', got);
      await tick(MQ[0], V3, MQ[0].c);
      got = await led(MQ[0].id);
      ok(got === J([3, [m0, m1].sort()]), '   TL4 3人めが選択肢をぜんぶ選び直しても（1人が全部に入る）、3人・lead は3人とも選んだ2つ', got);

      // TL5 選べるだけ選ぶ質問で並んだが、半分より多くない
      [m0, m1, m2] = MQ[1].c;
      await tick(MQ[1], V1, [m0]); await tick(MQ[1], V2, [m1]); await tick(MQ[1], V3, [m2]);
      got = await led(MQ[1].id);
      ok(got === J([3, []]), '★TL5 選べるだけ選ぶ質問で、3人が1つずつ別の答え → 3人・lead は空', got);

      // TL1b 選べるだけ選ぶ質問でも、いちばん多い答えが1つなら、半分より多くなくてよい
      [m0, m1, m2] = MQ[2].c;
      await tick(MQ[2], V1, [m0]); await tick(MQ[2], V2, [m0]); await tick(MQ[2], V3, [m1]); await tick(MQ[2], V4, [m2]);
      got = await led(MQ[2].id);
      ok(got === J([4, [m0]]), '★TL1b 選べるだけ選ぶ質問で、いちばん多い答えが1つ（4人のうち2人）→ 4人・lead はその1つ（1つだけなら、半分より多くなくてよい）', got);
      await tick(MQ[2], V4, [m1]);
      got = await led(MQ[2].id);
      ok(got === J([4, []]), '★TL5 4人めが答え直して2人と2人に並んだ（ちょうど半分）→ 4人・lead は空（半分ちょうどは「半分より多い」ではない）', got);

      // TL8 並んだ答えに、台帳に無い符号が混じる（持ち主の役で、1行の符号を書き換える）
      await db.query(
        `update public.airline_conditions set answer_codes = array['zz_gone']
          where ctid = (select ctid from public.airline_conditions where airline = $1 and question_id = $2 order by created_at limit 1)`, [A_FACT, MQ[1].id]);
      const gone = fact(await facts(GIVE5, A_FACT, [MQ[1].id]), MQ[1].id);
      ok(!!gone && gone.n === 3 && Object.hasOwn(gone, 'lead') && gone.lead === null,
        '★TL8 並んだ答えに、台帳に無い符号が混じる → lead の欄は在って null（名前の引けない答えを「最多」と書かせない）', J(gone));

      // TL9 答えごとの人数が、答えた人数を超える（製品が書けない行。持ち主の役で作る）
      [m0, m1] = MQ[0].c;
      await tick(MQ[0], V4, [m0, m1]); await tick(MQ[0], V5, [m0, m1]);
      await db.query(
        `update public.airline_conditions set answer_code = 'unknown'
          where ctid in (select ctid from public.airline_conditions where airline = $1 and question_id = $2 order by created_at desc limit 2)`, [A_FACT, MQ[0].id]);
      const over = await one(`select n, answer_dist from public.airline_condition_facts where airline = $1 and question_id = $2`, [A_FACT, MQ[0].id]);
      got = await led(MQ[0].id);
      ok(got === J([3, []]) && !!over && Number(over.n) === 3 && Number(over.answer_dist[m0]) === 5 && Number(over.answer_dist[m1]) === 5,
        '★TL9 答えごとの人数（5）が、答えた人数（3）を超えている行 → 3人・lead は空（人数より多い答えを「最多」と書かない）', got + ' ｜ ビュー: ' + J(over));

      must(kept === sent, 'TL の答えを、出したとおりに置けたこと', J({ sent, kept }));
    } else {
      ok(false, '★TL 質問が足りないので、lead の決まりを見ていない', J({ MQ, CQ }));
    }
  }

  // ── T8 返事の形 ──（ここまでに pv_contrib_facts が返した返事を、1つ残らず見る）
  {
    const recs = seen.filter((s) => s.fn === 'pv_contrib_facts').map((s) => JSON.parse(s.json));
    const opens = recs.filter((r) => r.state === 'open'), shut = recs.filter((r) => r.state !== 'open');
    const rows = opens.flatMap((r) => (Array.isArray(r.facts) ? r.facts : [null]));
    const FACT_KEYS = 'kind,lead,median_num,n,question_id,ym';
    const offKeys = rows.find((f) => !f || keys(f) !== FACT_KEYS);
    ok(rows.length > 0 && offKeys === undefined,
      '★T8 集計の1件に在るのは kind・lead・median_num・n・question_id・ym の6つだけ（top_code も、答えごとの人数も、割合も無い）', J(offKeys));
    const leadOk = (f) => !!f && (f.lead === null || (Array.isArray(f.lead) && f.lead.every((c) => typeof c === 'string')));
    const forms = [rows.some((f) => f && f.lead === null), rows.some((f) => f && Array.isArray(f.lead) && f.lead.length === 0),
                   rows.some((f) => f && Array.isArray(f.lead) && f.lead.length === 1), rows.some((f) => f && Array.isArray(f.lead) && f.lead.length === 2)];
    ok(rows.every(leadOk) && forms.every(Boolean),
      '★T8 lead は null か、字だけの並び（数も、入れ子も入らない ＝ 人数を運べない）。null・空・1つ・2つ の4つの形とも見ている', J({ off: rows.find((f) => !leadOk(f)), forms }));
    ok(rows.length > 0 && rows.every((f) => f && /^\d{4}-\d{2}$/.test(f.ym)), '   T8 ym は YYYY-MM（日も時刻も無い）', J(rows.find((f) => !f || !/^\d{4}-\d{2}$/.test(f.ym))));
    ok(opens.length > 0 && opens.every((r) => keys(r) === 'facts,ok,state') && shut.length > 0 && shut.every((r) => keys(r) === 'ok,state'),
      '★T8 開いている人への返事は facts・ok・state だけ。それ以外の返事は ok・state だけ', J([...opens.filter((r) => keys(r) !== 'facts,ok,state'), ...shut.filter((r) => keys(r) !== 'ok,state')].slice(0, 2)));
  }

  // ── T9 引数 ──（開いている人は GIVE5 ＝ どの会社も開く人。PAYER は自分の会社しか開かないので、ここには使えない）
  const BIG = Array.from({ length: 121 }, (_, i) => 'q' + i);
  const badAir = [await facts(GIVE5, 'other', KEYS), await facts(GIVE5, 'no-such-airline', KEYS), await facts(GIVE5, null, KEYS)];
  ok(badAir.every((r) => bad(r, /航空会社が正しくありません/)),
    '★T9 開いている人が、自由入力の会社・知らない会社・会社なしで聞いたら、「航空会社が正しくありません」と断る', J(badAir));
  const badKeys = [await facts(GIVE5, A_FACT), await facts(GIVE5, A_FACT, 'reserve_duty'), await facts(GIVE5, A_FACT, {}),
                   await facts(GIVE5, A_FACT, []), await facts(GIVE5, A_FACT, BIG)];
  ok(badKeys.every((r) => bad(r, /質問の指定が正しくありません/)),
    '★T9 開いている人が、質問の指定なし・字・並びでないもの・空の並び・121件 で聞いたら、「質問の指定が正しくありません」と断る', J(badKeys));
  const junk = await facts(GIVE5, A_FACT, ['reserve_duty', 'no_such_question', 'DROP TABLE x', 'a'.repeat(65), '', 7, null]);
  ok(junk.state === 'open' && ids(junk) === 'reserve_duty',
    '   T9 質問の指定に混じったごみ（無い質問・記号の入った字・長すぎる字・空・数・null）は、断らずに読み飛ばす（その行は無い）', J(junk));
  const shutArgs = async (who) => {
    const out = [];
    for (const [a, k] of [['other', KEYS], ['no-such-airline', KEYS], [null, KEYS], [A_FACT, undefined], [A_FACT, 'reserve_duty'], [A_FACT, {}], [A_FACT, []], [A_FACT, BIG]]) {
      out.push(J(await facts(who, a, k)));
    }
    return out;
  };
  const memArgs = await shutArgs(MEM), giveArgs = await shutArgs(GIVE4);
  ok(memArgs.length === 8 && memArgs.every((x) => x === L1) && giveArgs.length === 8 && giveArgs.every((x) => x === L2),
    '★T9 開いていない人（会員・あと1つの人）は、同じ8通りのどれで聞いても、断られずに、いつもの1語だけが返る', J({ 会員: [...new Set(memArgs)], あと1つの人: [...new Set(giveArgs)] }));

  // ── T10 ビューは直接読めない ──
  const direct = [await call(ANON, 'select * from public.airline_condition_facts limit 1'),
                  await call(MEM, 'select * from public.airline_condition_facts limit 1'),
                  await call(PAYER, 'select * from public.airline_condition_facts limit 1')];
  ok(direct.every(no), '★T10 集計のビューは、未ログインも、会員も、給与を出した人も、直接は読めない',
    direct.map((x, i) => `${['未ログイン', '会員', '給与を出した人'][i]}: ${x.err ? x.err.split('\n')[0] : '読めた'}`).join(' ｜ '));
  ok(/create view public\.airline_condition_facts[\s\S]*?where a\.n >= 3;\s*(--[^\n]*\n\s*)*revoke all on public\.airline_condition_facts from public, anon, authenticated;/.test(read('db/airline-conditions.sql')),
    'ビューを作った直後に閉じている（作り直した回に開かない）');

  // ── T11 決める所は外から呼べない・どの読み口も決める所を呼ぶ ──
  const shutFn = [];
  for (const who of [ANON, MEM]) {
    shutFn.push(await call(who, `select public.pv_contrib_sees($1)`, [A_FACT]), await call(who, `select count(*) from public.pv_contrib_own($1)`, [MEM]));
  }
  ok(shutFn.every(no), '★T11 決める所（pv_contrib_sees）と、自分の会社の一覧（pv_contrib_own）は、未ログインも会員も直接呼べない',
    shutFn.map((x, i) => `${['未ログイン sees', '未ログイン own', '会員 sees', '会員 own'][i]}: ${x.err ? x.err.split('\n')[0] : '呼べた'}`).join(' ｜ '));
  const PATHS = ['pv_contrib_facts', 'pv_contrib_notes', 'pv_work_view', 'pv_work_month_stats', 'next_condition_questions', 'pv_contrib_give'];
  const defs = Object.fromEntries((await many(
    `select proname, pg_get_functiondef(oid) as def from pg_proc
      where pronamespace = 'public'::regnamespace and proname = any($1::text[])`, [PATHS])).map((x) => [x.proname, x.def]));
  const naming = (re) => PATHS.filter((p) => re.test(defs[p] || ''));
  ok(PATHS.every((p) => typeof defs[p] === 'string') && naming(/pv_contrib_sees\(/).length === PATHS.length,
    '★T11 読み口の5つ（集計・補足・月の勤務の2つ・次に聞く質問）と、カードの材料は、どれも決める所（pv_contrib_sees）を呼んでいる',
    '呼んでいない: ' + J(PATHS.filter((p) => !/pv_contrib_sees\(/.test(defs[p] || ''))));

  // ── T12 決まりは1か所 ──
  ok(PATHS.every((p) => typeof defs[p] === 'string') && naming(/pv_work_level\(\)|pv_is_operator\(\)/).length === 0 && !(defs.pv_contrib_give || '>=').includes('>='),
    '★T12 決まりは1か所 ── 6つのどれも、立場（pv_work_level）と運営（pv_is_operator）を自分では見ない。カードの材料は、数を自分で比べない（>= が無い）',
    J({ 立場か運営を見ている: naming(/pv_work_level\(\)|pv_is_operator\(\)/), カードの材料に不等号: (defs.pv_contrib_give || '').includes('>=') }));
  const WM_SQL = read('db/work-months.sql');
  const SECT = /p_section|section in \(|section not in \(/, QUOTED = /'(roster|career|time_off|benefits)'/;
  ok(!SECT.test(CONTRIB_SQL) && !SECT.test(WM_SQL) && !QUOTED.test(CONTRIB_SQL) && naming(QUOTED).length === 0,
    '★T12 節で分ける決まりを、SQL に書き戻していない（p_section・section in (…) が db/contrib.sql と db/work-months.sql に無い。節の名前が db/contrib.sql と6つの関数に無い）',
    J({ contrib: [SECT.test(CONTRIB_SQL), QUOTED.test(CONTRIB_SQL)], workMonths: SECT.test(WM_SQL), 関数: naming(QUOTED) }));
  ok(typeof defs.pv_contrib_facts === 'string' && !defs.pv_contrib_facts.includes('public.airline_conditions')
     && ['pv_contrib_facts', 'pv_contrib_notes'].every((p) => typeof defs[p] === 'string' && !/access_until|pay_report|verify_level/.test(defs[p])),
    '★T12 集計の読み口は、回答の表を直接読まない。集計と補足の読み口は、給与の鍵の期限・給与の行・確認済みの印に触れない',
    J(['pv_contrib_facts', 'pv_contrib_notes'].filter((p) => /access_until|pay_report|verify_level/.test(defs[p] || ''))));

  // ── T13 読んでも、資格は1つも付かない ──（この節のいちばん最後。上の BEFORE と比べる）
  const cards = [];
  for (const [, who] of WATCH) cards.push((await giveOf(who)).state);
  const moved = [];
  for (const [name, who] of WATCH) if (await standing(who) !== BEFORE[name]) moved.push(name);
  ok(moved.length === 0 && cards.join(' ') === 'locked locked give open',
    `★T13 集計（pv_contrib_facts）とカードの材料（pv_contrib_give）を何度読んでも、給与の門（pv_my_give）・給与の一覧・給与の鍵の期限${hasVL ? '・確認済みの印' : ''}は1文字も変わらない（答えた人・会員・あと1つの人・開いている人）`,
    J({ 変わった人: moved, カードの材料: cards.join(' ') }));
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

  /* ── 回線の印は、1日だけ（2026-10-12）────────────────────────
     鍵の行の「回線の印」を読むのは、すぐ上の「1日に20本まで」の数えだけで、数えるのは作って1日以内の行だけ。
     なのに印は、鍵が消えるまで（最後の保存から90日）行に残っていた。中身は「IP と日付」の sha256 で、
     秘密の値は混ぜていない ＝ 残っているあいだ、預かった回答が、回線へたどれる値とつながったままになる。
     いまは、作って1日たった行の印を、未ログインの保存と引き継ぎの**どの呼び出しも**空にする。
     ⚠️ a の「ほかの端末」は新しい鍵を作らない保存・c の2本目は何も引き継がない呼び出しにしてある。
        新しい鍵を作る回・引き継げた回だけで消す形にすると、そういう呼び出ししか来ない日は印が残る。
     ⚠️ b を外さない。消す側の条件が広がると、上の「1日に20本まで」が数える行の印まで消える（上限が黙って外れる）。 */
  const hdr      = (ip) => db.query(`select set_config('request.headers', $1, false)`, [J({ 'x-forwarded-for': ip })]);
  const keyRow   = async (key) => one(`select * from public.pv_contrib_keys where key_hash = $1`, [await kh(key)]);
  const heldOf   = async (key) => J(await many(
    `select kind, airline, item_key, payload from public.pv_contrib_pending where key_hash = $1 order by id`, [await kh(key)]));
  const backBy   = async (key, hours) => db.query(
    `update public.pv_contrib_keys set created_at = now() - make_interval(hours => $2::int) where key_hash = $1`, [await kh(key), hours]);
  const isMark   = (m) => /^[0-9a-f]{64}$/.test(m || '');
  const markSay  = (row) => (!row ? '行が無い' : row.ip_day_hash === null ? '印は空' : '印が在る');
  const restSame = (x, y) => !!x && !!y && J({ ...x, ip_day_hash: null }) === J({ ...y, ip_day_hash: null });   // 印のほかの欄
  const noteMarks = async () => {
    for (const k of await many(`select distinct ip_day_hash as m from public.pv_contrib_keys where ip_day_hash is not null`))
      if (!MARKS.includes(k.m)) MARKS.push(k.m);
  };
  const W = (k, more) => ({ airline: A_LIM, position: 'fo', ...ago(k), ...more });
  await noteMarks();

  // a. 作って25時間たった鍵 → ほかの端末の保存で、印が消える。鍵と預かりはそのまま
  await hdr('203.0.113.21');
  const o = await putW(null, W(1, { duty_days: 12 }));
  await putC(o.key, { airline: A_LIM, answers: [{ question_id: 'landing_pay', code: 'fixed' }] });
  await hdr('203.0.113.22');
  const d2 = await putW(null, W(1, { duty_days: 11 }));          // ほかの端末。先に鍵を持たせておく
  await noteMarks();
  await backBy(o.key, 25);
  const o0 = await keyRow(o.key), oHeld0 = await heldOf(o.key);
  const s2 = await putW(d2.key, W(1, { duty_days: 10 }));         // 鍵を持った端末の保存 ＝ 新しい鍵を作らない回
  const o1 = await keyRow(o.key), oHeld1 = await heldOf(o.key);
  ok(isMark(o0?.ip_day_hash) && s2.ok === true && s2.replaced === true && !('key' in s2) && !!o1 && o1.ip_day_hash === null,
    '★a 作って25時間たった鍵の「回線の印」は、ほかの端末が未ログインで保存した時に消える（その端末が新しい鍵を作らない回でも）',
    `前: ${markSay(o0)} ｜ ほかの端末の保存: ${s2.__err || `replaced ${s2.replaced}・鍵は${'key' in s2 ? '返った' : '返らない'}`} ｜ 後: ${markSay(o1)}`);
  // a'. 自分の鍵が古い回 ── 片付けは「自分の鍵の行を掴んだあと」に走る。掴んでいるのが自分なら、その行も飛ばさずに空にする
  await backBy(d2.key, 25);
  const dOwn0 = await keyRow(d2.key);
  const sOwn = await putW(d2.key, W(1, { duty_days: 8 }));
  const dOwn1 = await keyRow(d2.key);
  ok(isMark(dOwn0?.ip_day_hash) && sOwn.ok === true && !!dOwn1 && dOwn1.ip_day_hash === null,
    "★a' 自分の鍵が作って25時間たっている回は、その保存で自分の行の印も消える（自分で掴んでいる行は飛ばさない）",
    `前: ${markSay(dOwn0)} ｜ 保存: ${sOwn.__err || 'ok'} ｜ 後: ${markSay(dOwn1)}`);
  const o2 = await putW(o.key, W(2, { duty_days: 9 }));
  const oMine = await mineA(o.key, A_LIM);
  ok(restSame(o0, o1) && oHeld1 === oHeld0 && JSON.parse(oHeld0).length === 2
     && o2.ok === true && o2.replaced === false && !('key' in o2)
     && oMine.known === true && oMine.rows.length === 2 && oMine.answers.length === 1,
    '   a その鍵は生きたまま: 預かりの2件は数も中身も同じ・印のほかの欄は動かない・その鍵で続きを保存できる（新しい鍵は返らない）',
    `印のほかの欄 ${restSame(o0, o1) ? '同じ' : '動いた'} ｜ 預かり ${JSON.parse(oHeld0).length}件 → ${JSON.parse(oHeld1).length}件（中身 ${oHeld1 === oHeld0 ? '同じ' : '違う'}）｜ 続きの保存: ${o2.__err || `replaced ${o2.replaced}・鍵は${'key' in o2 ? '返った' : '返らない'}`} ｜ 読み直し: known ${oMine.known}・月 ${oMine.rows?.length}・答え ${oMine.answers?.length}`);

  // b. 作って23時間の鍵 → 印は残り、数えも今までどおり
  await hdr('203.0.113.23');
  const yKh = [];
  for (let i = 0; i < 20; i++) yKh.push(await kh((await putW(null, W(1, { duty_days: 12 }))).key));
  await noteMarks();
  await db.query(`update public.pv_contrib_keys set created_at = now() - interval '23 hours' where key_hash = any($1::text[])`, [yKh]);
  const yMarks = async () => (await many(
    `select ip_day_hash as m from public.pv_contrib_keys where key_hash = any($1::text[]) order by key_hash`, [yKh])).map((k) => k.m);
  const y0 = await yMarks();
  await hdr('203.0.113.22');
  const s3 = await putW(d2.key, W(1, { duty_days: 9 }));          // ほかの端末の保存（印を消す1文を通る）
  const h3 = await claim(P, r.key);                               // ほかの人の引き継ぎの呼び出し（同じ1文を通る。鍵は切れている）
  const y1 = await yMarks();
  ok(y0.length === 20 && y0.every(isMark) && new Set(y0).size === 1 && s3.ok === true && h3.known === false && J(y1) === J(y0),
    '★b 作って23時間の鍵の印は、ほかの端末が保存しても、ほかの人が引き継ぎを呼んでも残る（20本とも）',
    `前: 印が在る ${y0.filter(isMark).length}/${y0.length} ｜ ほかの端末の保存: ${s3.__err || 'ok'} ｜ 引き継ぎの呼び出し: ${h3.__err || `known ${h3.known}`} ｜ 後: 印が在る ${y1.filter(isMark).length}/${y1.length}`);
  await hdr('203.0.113.23');
  const y21 = await putW(null, W(1, { duty_days: 12 }));
  ok(bad(y21, /しばらくしてからもう一度お試しください/) && y21.__code === '54000' && (await yMarks()).filter(isMark).length === 20,
    '★b その20本は今までどおり数える: 同じ回線の21本目は「しばらくしてからもう一度お試しください」（54000）で断る',
    y21.__err ? `${y21.__err} ｜ ${y21.__code}` : `21本目が作れてしまった（鍵は${'key' in y21 ? '返った' : '返らない'}）`);

  // c. 引き継ぎでも消える
  await hdr('203.0.113.24');
  const x = await putW(null, W(1, { duty_days: 12 }));            // 別の端末
  const own = await putW(null, W(1, { duty_days: 7 }));           // これから会員になる人の端末
  await noteMarks();
  await backBy(x.key, 25);
  const x0 = await keyRow(x.key), xHeld0 = await heldOf(x.key);
  const [Pc] = await crew(1);
  const c1 = await claim(Pc, own.key);
  const x1 = await keyRow(x.key), xHeld1 = await heldOf(x.key);
  ok(isMark(x0?.ip_day_hash) && c1.known === true && c1.moved === 1 && c1.left === 0
     && !!x1 && x1.ip_day_hash === null && restSame(x0, x1) && xHeld1 === xHeld0 && JSON.parse(xHeld0).length === 1
     && (await mineA(x.key, A_LIM)).known === true,
    '★c 引き継ぎでも消える: ある会員の引き継ぎが、別の端末の25時間たった鍵の印を消す（その鍵と預かりはそのまま）',
    `前: ${markSay(x0)} ｜ 引き継ぎ: ${c1.__err || `known ${c1.known}・moved ${c1.moved}・left ${c1.left}`} ｜ 後: ${markSay(x1)} ｜ 印のほかの欄 ${restSame(x0, x1) ? '同じ' : '動いた'} ｜ 預かり ${xHeld1 === xHeld0 ? '同じ' : '違う'}`);
  await db.query(`update public.pv_contrib_keys set ip_day_hash = $2 where key_hash = $1`, [await kh(x.key), x0?.ip_day_hash ?? null]);
  const c2 = await claim(Pc, own.key);                            // 使い終わった鍵 ＝ 何も引き継がない呼び出し
  const x2 = await keyRow(x.key);
  ok(isMark(x0?.ip_day_hash) && c2.known === false && !!x2 && x2.ip_day_hash === null,
    '   c 何も引き継がない呼び出し（使い終わった鍵を出した）でも消える',
    `引き継ぎ: ${c2.__err || `known ${c2.known}`} ｜ 後: ${markSay(x2)}`);
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
  /* 回線の印と IP は、値そのものでも見る（上の2本は「64文字そろった16進」と「欄の名前」しか見ていない ＝
     IP そのものや、切り詰めた印が別の名前で返っても通る）。印は 9 で表に在った値。頭と末尾の16文字ずつで探す。 */
  const leak = seen.filter((s) => s.json.includes('203.0.113')
    || MARKS.some((m) => s.json.includes(m.slice(0, 16)) || s.json.includes(m.slice(-16))));
  ok(MARKS.length >= 6 && MARKS.every((m) => /^[0-9a-f]{64}$/.test(m)) && leak.length === 0,
    '★d 回線の印（検査のあいだに表に在った値）も IP も、どの返事にも入っていない（預ける・読む・引き継ぐ・補足・会員の入口の全部）',
    `見た印 ${MARKS.length}種 ｜ 入っていた返事: ${J([...new Set(leak.map((s) => s.fn))])}`);
  const withKey = seen.filter((s) => /"key":/.test(s.json));
  ok(withKey.length > 0 && withKey.every((s) => s.fn === 'submit_contrib_anon'), '★鍵が入っている返事は、預けた時の返事だけ',
    J([...new Set(withKey.map((s) => s.fn))]));
  ok(seen.filter((s) => s.fn === 'my_contrib_anon' || s.fn === 'claim_contrib' || s.fn === 'pv_contrib_notes' || s.fn === 'pv_contrib_facts')
        .every((s) => !/[0-9a-f]{48}/.test(s.json)), '読み口・引き継ぎ・補足・集計の返事に、鍵は1本も入っていない');
  ok(seen.filter((s) => s.fn === 'pv_contrib_notes').every((s) => !/updated_at|created_at|"position"|"fleet"|"code"/.test(s.json)),
    '補足の返事に、時刻・職位・機種・選んだ答えの欄が無い');
  // T14 集計の読み口（pv_contrib_facts）の返事を、1つ残らず見る（8-3 で返ったもの全部）
  const fr = seen.filter((s) => s.fn === 'pv_contrib_facts');
  const stateOf = (s) => { try { return JSON.parse(s.json).state; } catch { return null; } };
  const metStates = ['login', 'locked', 'give', 'open'].filter((w) => fr.some((s) => stateOf(s) === w));
  ok(metStates.length === 4, '   T14 集計の返事を、4つの状態（login・locked・give・open）とも、1つ以上見ている', `${fr.length} 件 ｜ 見た状態: ${metStates.join(' ')}`);
  const T14_DATE = /\d{4}-\d{2}-\d{2}/, T14_WORD = /answer_dist|top_share|n_unknown|"section"|"tier"|last_confirmed|"locked":\[/;
  ok(fr.every((s) => !T14_DATE.test(s.json) && !T14_WORD.test(s.json)),
    '★T14 集計の返事のどれにも、日付・答えごとの人数（分布）・割合・「わからない」の数・節・区分・確かめた日時が無い',
    (fr.find((s) => T14_DATE.test(s.json) || T14_WORD.test(s.json)) || { json: '' }).json.slice(0, 300));
  const shutFr = fr.filter((s) => stateOf(s) !== 'open');
  ok(shutFr.length > 0 && shutFr.every((s) => !s.json.includes('"facts"') && !/\d/.test(s.json)),
    '★T14 開いていない人への集計の返事には、facts の欄も、数字も、1つも無い',
    (shutFr.find((s) => s.json.includes('"facts"') || /\d/.test(s.json)) || { json: '' }).json.slice(0, 300));
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

  /* 対になる額の2つ（pv_condition_range_other / pv_condition_range_bad）も、前のファイルに在るものを呼ぶ（2026-10-11）。
     plpgsql は、呼んでいる関数が在るかを、作るときには見ない ＝ 2つが無い DB にもこのファイルは貼れてしまい、
     そのあとは、未ログインの保存も引き継ぎも、動かしたときに初めて落ちる。貼るときに止める。
     ここの DB は空で、冒頭の案内がこれまで探していた3つの関数の「代役」だけを置く（名前と引数の型だけが本物）。
     対の2つは、頼まれたものだけ置く。本物のファイルを順に貼って通ることは、いちばん上の「▼ SQL の適用」が見ている。 */
  const guardRun = async (withOther, withBad) => {
    const b = new PGlite({ extensions: { pgcrypto } });
    await b.waitReady;
    await b.exec(`
      create schema if not exists extensions;
      create function public.pv_work_month_clean(jsonb) returns jsonb language sql as $$ select null::jsonb $$;
      create function public.pv_work_level() returns text language sql as $$ select null::text $$;
      create function public.pv_condition_clean(text, jsonb) returns jsonb language sql as $$ select null::jsonb $$;
    `);
    if (withOther) await b.exec(
      `create function public.pv_condition_range_other(text) returns text language sql as $$ select null::text $$;`);
    if (withBad) await b.exec(
      `create function public.pv_condition_range_bad(text, numeric, text, numeric, text) returns text language sql as $$ select null::text $$;`);
    let err = null;
    try { await b.exec(CONTRIB_SQL); } catch (x) { err = String(x.message || x); }
    const table = (await b.query(`select to_regclass('public.pv_contrib_pending') is not null as t`)).rows[0].t;
    await b.close();
    return { err, table };
  };
  const named = (g) => g.err !== null && (g.err.includes('pv_condition_range_other') || g.err.includes('pv_condition_range_bad'));
  const stopsHere = (g) => g.err !== null && g.err.includes('db/airline-conditions.sql')
    && g.err.includes('pv_condition_range_other') && g.err.includes('pv_condition_range_bad')
    && /[ぁ-ん]/.test(g.err) && g.table === false;
  const told = (g) => (g.err === null ? '止まらずに流れた' : g.err.split('\n')[0]) + (g.table ? ' ｜ 表ができている' : '');

  let g = await guardRun(false, false);
  ok(stopsHere(g), '★12a 対になる額の2つ（pv_condition_range_other / pv_condition_range_bad）がどちらも無い → 「先に db/airline-conditions.sql」と2つの名前を出して止まる。表は作っていない', told(g));
  g = await guardRun(true, false);
  ok(stopsHere(g), '   12b pv_condition_range_other だけ在る（pv_condition_range_bad が無い）→ 同じ案内で止まる。表は作っていない', told(g));
  g = await guardRun(false, true);
  ok(stopsHere(g), '   12c pv_condition_range_bad だけ在る（pv_condition_range_other が無い）→ 同じ案内で止まる。表は作っていない', told(g));
  g = await guardRun(true, true);
  ok(!named(g) && !(g.err || '').includes('db/airline-conditions.sql'),
    `   12d 対照: 2つとも在れば、この案内では止まらない（代役の引数の型は、案内が探している型と同じ）。その先: ${g.err === null ? '最後まで流れた' : g.err.split('\n')[0].slice(0, 90)}`, told(g));

  /* 12e 住みやすい街の部品（db/towns.sql の pv_town_clean ほか4つ）も、前のファイルに在るものを呼ぶ（街の預かりと引き継ぎ）。
     案内がそれより前に探すものの代役を全部置き、街の4つだけを置かない DB → 「先に db/towns.sql」で止まる。 */
  {
    const b = new PGlite({ extensions: { pgcrypto } });
    await b.waitReady;
    await b.exec(`
      create schema if not exists extensions;
      create function public.pv_work_month_clean(jsonb) returns jsonb language sql as $$ select null::jsonb $$;
      create function public.pv_work_level() returns text language sql as $$ select null::text $$;
      create function public.pv_condition_clean(text, jsonb) returns jsonb language sql as $$ select null::jsonb $$;
      create function public.pv_condition_range_other(text) returns text language sql as $$ select null::text $$;
      create function public.pv_condition_range_bad(text, numeric, text, numeric, text) returns text language sql as $$ select null::text $$;
      create table public.pay_reports (id int);
      create function public.pv_airline_resolve(text) returns text language sql as $$ select null::text $$;
      create function public.pv_is_operator() returns boolean language sql as $$ select false $$;
      create function public.pv_work_hash(uuid, text, text) returns text language sql as $$ select null::text $$;
      create view public.airline_condition_facts as select 1 as x;
    `);
    let err = null;
    try { await b.exec(CONTRIB_SQL); } catch (x) { err = String(x.message || x); }
    const none = (await b.query(
      `select to_regclass('public.pv_contrib_pending') is null and to_regclass('public.pv_contrib_keys') is null as n`)).rows[0].n;
    await b.close();
    ok(err !== null && err.includes('db/towns.sql') && err.includes('pv_town_clean') && /[ぁ-ん]/.test(err) && none === true,
      '★12e 案内がそれより前に探す前提が全部在り、街の部品（db/towns.sql）だけが無い → 「先に db/towns.sql」と pv_town_clean の名前を出して止まる。表は作っていない',
      err === null ? '止まらずに流れた' : err.split('\n')[0]);
  }
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
