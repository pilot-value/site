/* db/work-months.sql を本物の Postgres（PGlite = PG17 の WASM ビルド）に流して確かめる。

   実行: node db/test-work-months.mjs
   ネットワーク不要・本番に一切触らない。SQL を直したら必ずこれを通してから
   オーナーに実行を依頼すること。

   器は db/test-stays.mjs と同じ（anon / authenticated ロール、既定権限を
   全付与した状態、auth.uid() の代役、profiles、auth.users）。
   ★既定権限を先に全付与してあるからこそ work-months.sql の revoke が意味を持つ。
     無いと「元から権限が無いだけ」を「revoke が効いた」と誤読する。

   流す SQL の並びは serve-local.mjs の SQL_FILES を**そのまま読む**（写さない）。
   手元のサーバーが立ち上がるときと同じ DB の上で通ることを見るため。
   あちらに db/work-months.sql がまだ並んでいなければ、末尾に足して流す。
   ⚠️ 器（BOOT）だけは写し（あちらが export していない）。SQL_FILES に新しい前提が
      足されて「▼ SQL の適用」で止まったら、まず serve-local.mjs の BOOT と見比べる。

   ここでいちばん大事な4つ:
     ★ 勤務だけを出した人に、給与の資格が1つも付かない。
       pv_my_give() は basic:false のまま・pv_pay_rows() は閉じたまま・
       profiles は連投の数え以外、1列も変わらない（「給与の資格に数えない」の節）。
     ★ 0 と未回答が混ざらない。入口でも・表の中でも・本人への返事でも・幅でも。
       0 と入れた人は人数に入り、入れなかった人は入らない。
     ★ 3人に届かない項目は数字が出ない。同じ人を2回数えない
       （給与と勤務の両方を出した人／社名の綴りを変えて出した人）。
       届かない月の返事は、誰も出していない月と1文字も違わない。
     ★ ハッシュの式が給与の実物と同じ。pv_work_hash は submit_pay_report の式の
       写しなので、実際に給与を出して pay_reports に入った値と突き合わせる。
       ここが赤くなったら、写しが腐っている。

   ⚠️ set_config の第3引数は **false**（＝セッション全体）でなければならない。
      true にすると次の文では auth.uid() が null に戻り、
      「権限で弾かれた」という判定が全部空振りのまま緑になる。

   ⚠️ ここに出てくる会員・チャーター会社の名前は全部作り物（crew1@example.com・
      「Test Charter Alpha」など）。実在の人も会社も1つも書かない。
      一覧の会社は語彙（pv_airlines）から機械的に取るだけで、数字は検査のための作り物。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import { SQL_FILES } from '../serve-local.mjs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const MINE = 'db/work-months.sql';
const FILES = SQL_FILES.includes(MINE) ? [...SQL_FILES] : [...SQL_FILES, MINE];
const WORK_SQL = read(MINE);

const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;
await db.exec(`set timezone = 'UTC'`);   // 本番と同じ時計（current_date が「今月」を決める）

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

// ── 適用（順番も含めて手元のサーバーと同じ）──────────────────
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
const ANON = Symbol('anon');   // 未ログイン
const DEAD = Symbol('dead');   // ロールは会員だが、ログインが死んでいる（uid が空）

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

/* 外へ返った JSON は全部ためておく。最後の節で「出てはいけないもの」を
   1つ残らず見るため（途中の節が見ているのは、その節が気にした鍵だけ）。 */
const seen = [];
const rpc = async (who, fn, p) => {
  const r = await call(who, `select public.${fn}($1::jsonb) as v`, [p === undefined ? null : J(p)]);
  if (r.err) return { __err: r.err };
  seen.push({ fn, json: J(r.v.v) });
  return r.v.v;
};
const work  = (who, p) => rpc(who, 'submit_work_month', p);
const mine  = (who, p) => rpc(who, 'my_work_months', p);
const stats = (who, p) => rpc(who, 'pv_work_month_stats', p);
const bad    = (r, re) => !!(r && r.__err && re.test(r.__err));
const denied = (r) => bad(r, /permission denied/i);

// 以下は持ち主（postgres）として実行する。検査の準備と、表の中身を直接見るため
const one  = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const many = async (sql, params = []) => (await db.query(sql, params)).rows;
const boom = async (sql, params = []) => {
  try { await db.query(sql, params); return ''; } catch (e) { return String(e.message || e); }
};

// 会員を1人作る（auth.users に入れると db/schema-additions.sql のトリガが profiles を作る）
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let seat = 0;
const member = async () => {
  const id = uid(++seat), mail = `crew${seat}@example.com`;
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, mail]);
  await db.query(`insert into public.profiles (id, email) values ($1, $2) on conflict (id) do nothing`, [id, mail]);
  return id;
};
const crew = async (n) => { const a = []; for (let i = 0; i < n; i++) a.push(await member()); return a; };

/* 幅を読める人 ＝ 給与の鍵が生きている会員（2026-10-07 オーナー指定：他人の勤務はログイン＋給与提出資格）。
   幅の中身を見る検査は、この人として読む。未ログインと、鍵の無い会員に何が返るかは 1. の節が見る。
   ★鍵は検査の準備として持ち主が直接立てる（会員が自分で立てる道は無い）。 */
const unlock = (id) => db.query(`update public.profiles set access_until = now() + interval '30 days' where id = $1`, [id]);
const READER = await member();
await unlock(READER);
const view = (who, p) => rpc(who, 'pv_work_view', p);
const ago = (k) => { const t = NOW.y * 12 + (NOW.m - 1) - k; return { year: Math.floor(t / 12), month: (t % 12) + 1 }; };

// 「今月」は DB の時計から取る（この Mac の時計と月の境目でずれると、未来の月の検査が嘘の赤を出す）
const NOW  = await one(`select extract(year from current_date)::int as y, extract(month from current_date)::int as m`);
const YEAR = NOW.y - 1;   // 去年＝12か月ぜんぶが過去
const NEXT = NOW.m === 12 ? { year: NOW.y + 1, month: 1 } : { year: NOW.y, month: NOW.m + 1 };

const SIX = ['block_hours', 'duty_hours', 'work_days', 'duty_days', 'days_off', 'stay_nights'];
const allNull = (items) => !!items && SIX.every((k) => k in items && items[k] === null);
// 幅 1つぶん。{ lo, hi } の2つだけを持ち、値が合っていること
const rg = (v, lo, hi) => !!v && typeof v === 'object' && keys(v) === 'hi,lo' && v.lo === lo && v.hi === hi;

// 会社は語彙から機械的に取る（節ごとに別の会社を使い、互いの人数に混ざらないようにする）
const AIR = (await many(
  `select code from public.pv_airlines where code <> 'other' and active order by code limit 12`)).map((r) => r.code);
const [A_ONE, A_ZERO, A_FIX, A_PRIV, A_CHK, A_GATE, A_WALL, A_BOTH, A_HID, A_LIST, A_CAP, A_VIEW] = AIR;
const FLEET = (await one(`select code from public.pv_fleets where active order by code limit 1`)).code;

/* 給与を1件出す（対照と、給与の行を材料にする節で使う）。
   内訳は db/test-deep-pay.mjs と同じ形 ＝ 月 17,000 USD・年 204,000 USD（常識の幅の中）。
   ★other_allowance = 変動給 + その他（4000 + 400）。本番のフォームが送る形。 */
const PAY = { currency: 'USD', lang: 'en', tax_rate_pct: 0, position: 'cap', fleet: FLEET,
              base_pay: 9000, flight_variable_pay: 4000, other_allowance: 4400,
              command_pay: 2000, per_diem: 1000, housing_type: 'allowance', housing_amount: 600 };
const pay = async (who, p) => {
  await db.query(`select set_config('pv.uid', $1, false)`, [who]);
  try { return (await db.query(`select public.submit_pay_report($1::jsonb) as v`, [J({ ...PAY, ...p })])).rows[0].v; }
  catch (e) { return { __err: String(e.message || e) }; }
  finally { await asOwner(); await db.exec(`update public.profiles set pay_reports_today = 0`); }
};
// 給与の門を、その人として見る
const give = async (who) => {
  await db.query(`select set_config('pv.uid', $1, false)`, [who]);
  try { return (await db.query(`select public.pv_my_give() as g`)).rows[0].g; }
  finally { await asOwner(); }
};
const gate = async (who) => {
  const r = await call(who, `select public.pv_pay_rows() as v`);
  return r.err ? { __err: r.err } : r.v.v;
};


// ════════════════════════════════════════════════════════════
console.log('\n▼ 1. 権限（誰が何をできるか）');
// ════════════════════════════════════════════════════════════
{
  const [P1] = await crew(1);
  const p = { airline: A_ONE, position: 'cap', year: YEAR, month: 1, stay_nights: 5 };

  ok(denied(await work(ANON, p)), '未ログインは出せない（実行権が無い）');
  ok(denied(await mine(ANON, { airline: A_ONE })), '未ログインは「自分の勤務」を呼べない');
  ok(bad(await work(DEAD, p), /ログインが必要/), 'ログインが死んでいる会員は出せない（uid が空）');
  ok(bad(await mine(DEAD, { airline: A_ONE }), /ログインが必要/), 'ログインが死んでいる会員は「自分の勤務」も読めない');
  ok((await one(`select count(*)::int as n from public.pv_work_months`)).n === 0, '弾かれた回は1行も入っていない');

  for (const [who, name] of [[ANON, '未ログイン'], [P1, '会員']]) {
    ok(no(await call(who, `select count(*) from public.pv_work_months`)), `${name}は表を直接読めない`);
    ok(no(await call(who,
      `insert into public.pv_work_months (proof_hash, airline, period_year, period_month, "position", days_off)
       values ($1, $2, 2024, 1, 'cap', 8)`, ['a'.repeat(64), A_ONE])), `${name}は表へ直接入れられない`);
    ok(no(await call(who, `update public.pv_work_months set days_off = 0`)), `${name}は表を直接書き換えられない`);
    ok(no(await call(who, `delete from public.pv_work_months`)), `${name}は表から直接消せない`);
  }

  // 中だけで使う部品は、会員にも渡していない
  for (const [sig, name] of [
    [`select public.pv_work_hash('${P1}'::uuid, 'x', null)`, 'pv_work_hash（ハッシュを作る）'],
    [`select public.pv_work_num('1', 'x', 0, 9, true)`,      'pv_work_num（数字を読む）'],
    [`select public.pv_work_range(3, 1, 2, 1)`,              'pv_work_range（壁）'],
    [`select public.pv_month_days(2024, 2)`,                 'pv_month_days（月の日数）'],
    [`select * from public.pv_work_month_cells('${A_ONE}', 'cap')`, 'pv_work_month_cells（月ごとの幅を作る）'],
  ]) {
    ok(no(await call(P1, sig)) && no(await call(ANON, sig)), `会員も未ログインも ${name} を直接呼べない`);
  }

  // ★幅は、立場をサーバが見てから返す。資格の無い人への返事には、数字も月の一覧も入っていない
  const q1 = { airline: A_ONE, position: 'cap' }, q2 = { ...q1, year: YEAR, month: 1 };
  for (const [fn, name] of [['pv_work_month_stats', '月ごとの幅'], ['pv_work_view', '直近の幅']]) {
    for (const q of fn === 'pv_work_view' ? [{ airline: A_ONE }] : [q1, q2]) {
      ok(J(await rpc(ANON, fn, q)) === '{"ok":true,"state":"login"}', `未ログインへの${name}の返事は { ok, state:'login' } だけ`);
      ok(J(await rpc(P1, fn, q)) === '{"ok":true,"state":"locked"}', `給与の鍵が無い会員への${name}の返事は { ok, state:'locked' } だけ`);
    }
  }
  ok(J(await rpc(ANON, 'pv_work_month_stats', { airline: 'no-such-airline' })) === '{"ok":true,"state":"login"}',
     '未ログインには、会社が在る・無いの手がかりも返さない（中身を見る前に断る）');
  const s = await stats(READER, q1);
  ok(s.ok === true && s.state === 'open' && Array.isArray(s.months), '給与の鍵が生きている会員は幅を読める', J(s));
  const v0 = await view(READER, { airline: A_ONE });
  ok(v0.ok === true && v0.state === 'open' && v0.months === 12 && keys(v0.by) === 'cap,fo'
     && allNull(v0.by.cap) && allNull(v0.by.fo), '同じ人は直近の幅も読める（誰も出していない会社は全部 null）', J(v0));
  // 期限が切れたら閉じる（鍵は「持ったことがある」ではなく「いま生きている」）
  await db.query(`update public.profiles set access_until = now() - interval '1 minute' where id = $1`, [READER]);
  ok(J(await stats(READER, q1)) === '{"ok":true,"state":"locked"}', '鍵の期限が切れた会員は、鍵の無い会員と同じ返事');
  await unlock(READER);
  for (const sig of [
    `select * from public.pv_work_month_people('${A_ONE}', 'cap')`,
    `select public.pv_work_level()`,
    `select public.pv_work_month_clean('{}'::jsonb)`,
  ]) ok(no(await call(P1, sig)) && no(await call(ANON, sig)) && no(await call(READER, sig)), `誰も直接呼べない: ${sig.slice(7, 45)}`);

  const pol = await one(
    `select (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'pv_work_months') as n,
            (select relrowsecurity from pg_class where oid = 'public.pv_work_months'::regclass) as rls`);
  ok(pol.n === 0 && pol.rls === true, '表は RLS 有効・ポリシー0本');

  const cols = (await many(
    `select column_name as c from information_schema.columns
      where table_schema = 'public' and table_name = 'pv_work_months'`)).map((r) => r.c).sort().join(',');
  const want = ['id', 'created_at', 'updated_at', 'proof_hash', 'airline', 'airline_other',
                'period_year', 'period_month', 'position', 'fleet', 'base_iata', ...SIX,
                'duty_hours_basis', 'commute_included', 'note', 'lang'].sort().join(',');
  ok(cols === want, '表の列は決まった21本だけ（user_id もメールも金額の列も無い）', cols);
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 2. 知っている1項目だけで出せる');
// ════════════════════════════════════════════════════════════
{
  const [O1] = await crew(1);
  const r1 = await work(O1, { airline: A_ONE, position: 'cap', year: YEAR, month: 2, stay_nights: 7 });
  ok(r1.ok === true && r1.saved === true && r1.replaced === false && r1.year === YEAR && r1.month === 2,
     'ステイ泊数の1項目だけで出せる（通貨も金額も送っていない）', J(r1));
  ok(keys(r1) === 'month,ok,replaced,saved,year', '返事は { ok, saved, year, month, replaced } だけ', keys(r1));
  const row = await one(
    `select stay_nights = 7 as s, block_hours is null as b, duty_hours is null as d, work_days is null as w,
            duty_days is null as dd, days_off is null as o, fleet is null as f, base_iata is null as i
       from public.pv_work_months where airline = $1`, [A_ONE]);
  ok(row.s && row.b && row.d && row.w && row.dd && row.o, '入れていない5項目は表の中で null のまま（0 で埋めていない）', J(row));
  ok(row.f && row.i, '機材もベースも書かなくてよい');

  const base = { airline: A_ONE, position: 'cap', year: YEAR, month: 3 };
  ok(bad(await work(O1, base), /1つ以上/), '6項目とも鍵が無い → 受けない');
  ok(bad(await work(O1, { ...base, ...Object.fromEntries(SIX.map((k) => [k, null])) }), /1つ以上/), '6項目とも null → 受けない');
  ok(bad(await work(O1, { ...base, ...Object.fromEntries(SIX.map((k) => [k, k === 'days_off' ? '  ' : ''])) }), /1つ以上/),
     '6項目とも空文字 → 受けない');
  ok((await one(`select count(*)::int as n from public.pv_work_months where airline = $1 and period_month = 3`, [A_ONE])).n === 0,
     '受けなかった回は1行も残らない');

  // 6項目のどれでも、それ1つで出せる
  const each = { block_hours: 72.5, duty_hours: 160, work_days: 20, duty_days: 15, days_off: 9, stay_nights: 0 };
  let n = 0;
  for (const [i, k] of SIX.entries()) {
    const r = await work(O1, { airline: A_ONE, position: 'fo', year: YEAR, month: 4 + i, [k]: each[k] });
    if (r.ok === true && r.replaced === false) n++;
  }
  ok(n === 6, '6項目のどれでも、それ1つだけで出せる（0 が1つだけ、でも出せる）', `${n}/6`);

  // 金額を一緒に送ってきても、ここは受け取らない
  const withMoney = await work(O1, { airline: A_ONE, position: 'cap', year: YEAR, month: 10, days_off: 8,
                                     currency: 'USD', base_pay: 9000, gross_monthly: 17000 });
  ok(withMoney.ok === true, '金額の鍵が混ざっていても通る（読まない・置き場も無い）', J(withMoney));

  // 対象月は period_year / period_month でも受ける（給与のフォームと同じ鍵）
  const alias = await work(O1, { airline: A_ONE, position: 'cap', period_year: YEAR, period_month: 11, days_off: 8 });
  ok(alias.ok === true && alias.year === YEAR && alias.month === 11, '対象月は period_year / period_month でも受ける', J(alias));

  ok(bad(await work(O1, { airline: A_ONE, year: YEAR, month: 12, days_off: 8 }), /必須項目/), '職位が無い → 受けない');
  ok(bad(await work(O1, { position: 'cap', year: YEAR, month: 12, days_off: 8 }), /必須項目/), '会社が無い → 受けない');
  ok(bad(await work(O1, { airline: A_ONE, position: 'cap', year: YEAR, days_off: 8 }), /必須項目/), '対象月が無い → 受けない');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 3. 0 と未回答を混ぜない');
// ════════════════════════════════════════════════════════════
{
  const [Z1] = await crew(1);
  // stay_nights は鍵ごと無い・duty_hours は null・work_days は空文字 ＝ どれも未回答
  const rz = await work(Z1, { airline: A_ZERO, position: 'fo', year: YEAR, month: 5,
                              block_hours: 0, duty_hours: null, work_days: '', duty_days: 0, days_off: '0' });
  ok(rz.ok === true, '0 を含む回答が通る', J(rz));
  const z = ((await mine(Z1, { airline: A_ZERO })).rows || [])[0] || {};
  ok(z.block_hours === 0 && z.duty_days === 0 && z.days_off === 0, '★0 と入れた項目は 0 のまま返る', J(z));
  ok(z.duty_hours === null && z.work_days === null && z.stay_nights === null,
     '★入れなかった項目は null のまま返る（null・空文字・鍵なしのどれも 0 にならない）', J(z));
  ok(SIX.every((k) => k in z), '未回答でも鍵は落とさない（6つとも在る）', keys(z));
  const t = await one(
    `select block_hours = 0 as b0, duty_days = 0 as d0, days_off = 0 as o0,
            duty_hours is null as hn, work_days is null as wn, stay_nights is null as sn
       from public.pv_work_months where airline = $1`, [A_ZERO]);
  ok(t.b0 && t.d0 && t.o0 && t.hn && t.wn && t.sn, '表の中でも 0 は 0・未回答は null', J(t));

  await work(Z1, { airline: A_ZERO, position: 'fo', year: YEAR, month: 6, block_hours: 72.5, duty_hours: '151.25' });
  const d = ((await mine(Z1, { airline: A_ZERO })).rows || [])[0] || {};
  ok(d.month === 6 && d.block_hours === 72.5 && d.duty_hours === 151.25, '時間は小数のまま往復する（72.5 / 151.25）', J(d));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 4. 出し直し＝訂正（行ごと置き換える）');
// ════════════════════════════════════════════════════════════
{
  const [F1, F2] = await crew(2);
  const f = { airline: A_FIX, position: 'cap', year: YEAR, month: 6 };
  const NOTE = 'シミュレーター訓練が2日あった月';
  const fa = await work(F1, { ...f, fleet: FLEET, base_iata: 'nrt', block_hours: 70, duty_days: 15, days_off: 9,
                              duty_hours_basis: 'roster', commute_included: 'no', note: NOTE });
  ok(fa.ok === true && fa.replaced === false, '最初の1回は replaced:false', J(fa));
  const m1 = ((await mine(F1, { airline: A_FIX })).rows || [])[0] || {};
  ok(m1.block_hours === 70 && m1.duty_days === 15 && m1.days_off === 9, '数字が残る', J(m1));
  ok(m1.position === 'cap' && m1.fleet === FLEET && m1.base_iata === 'NRT' && m1.year === YEAR && m1.month === 6
     && m1.duty_hours_basis === 'roster' && m1.commute_included === 'no' && m1.note === NOTE,
     '条件と時点も一緒に残る（職位・機材・ベース・対象月・拘束時間の数え方・通勤・ひとこと）', J(m1));

  const fb = await work(F1, { ...f, block_hours: 75 });
  ok(fb.ok === true && fb.replaced === true, '同じ月を出し直すと replaced:true', J(fb));
  const m2 = (await mine(F1, { airline: A_FIX })).rows || [];
  ok(m2.length === 1 && m2[0].block_hours === 75, '行は増えず、数字が置き換わる', J(m2));
  ok(m2[0].duty_days === null && m2[0].days_off === null, '★出し直しで省いた項目は null に戻る（前の答えを残さない）', J(m2[0]));
  ok(m2[0].fleet === null && m2[0].base_iata === null && m2[0].duty_hours_basis === null
     && m2[0].commute_included === null && m2[0].note === null, '条件も、省いたものは空に戻る', J(m2[0]));

  await work(F1, { ...f, block_hours: 0 });
  const m3 = (await mine(F1, { airline: A_FIX })).rows || [];
  ok(m3.length === 1 && m3[0].block_hours === 0, '0 への訂正は 0 になる（前の 75 が残らない・未回答にもならない）', J(m3));

  const fc = await work(F1, { ...f, position: 'fo', block_hours: 60 });
  const m4 = (await mine(F1, { airline: A_FIX })).rows || [];
  ok(fc.replaced === true && m4.length === 1 && m4[0].position === 'fo', '職位を直しても同じ1行（1人×1社×1か月）', J(m4));

  const fd = await work(F1, { ...f, month: 7, stay_nights: 6 });
  const m5 = (await mine(F1, { airline: A_FIX })).rows || [];
  ok(fd.replaced === false && m5.length === 2 && m5[0].month === 7 && m5[1].month === 6, '別の月は別の行・新しい月が先', J(m5));

  // 26か月ぶん出す（古い月から）。返るのは新しい24件
  let saved = 0;
  for (let i = 0; i < 26; i++) {
    const r = await work(F2, { airline: A_FIX, position: 'cap', year: YEAR - 2 + Math.floor(i / 12), month: i % 12 + 1, stay_nights: i % 10 });
    if (r.ok === true) saved++;
  }
  const long = (await mine(F2, { airline: A_FIX })).rows || [];
  const ym = long.map((r) => r.year * 12 + r.month);
  ok(saved === 26 && long.length === 24, '26か月ぶん出しても、返るのは24件まで', `${saved}件保存・${long.length}件返った`);
  ok(long[0].year === YEAR && long[0].month === 2 && ym.every((v, i) => i === 0 || v < ym[i - 1]), '新しい月から順に並ぶ', J(ym.slice(0, 4)));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 5. 自分の勤務は本人にしか見えない');
// ════════════════════════════════════════════════════════════
{
  const [B1, B2] = await crew(2);
  await work(B1, { airline: A_PRIV, position: 'cap', year: YEAR, month: 4, block_hours: 66, note: '自分用のメモ' });
  const own = await mine(B1, { airline: A_PRIV });
  ok(own.ok === true && own.rows.length === 1 && own.rows[0].block_hours === 66, '本人には見える', J(own));
  const other = await mine(B2, { airline: A_PRIV });
  ok(other.ok === true && Array.isArray(other.rows) && other.rows.length === 0, '★同じ会社の別の会員には1行も見えない', J(other));
  ok(((await mine(B1, { airline: A_ONE })).rows || [0]).length === 0, '本人でも、別の会社を指定したら出ない');
  ok(keys(own.rows[0]) === ['year', 'month', 'position', 'fleet', 'base_iata', ...SIX,
                            'duty_hours_basis', 'commute_included', 'note'].sort().join(','),
     '返る行の鍵は決まった14個だけ（ハッシュ・行の id・時刻が無い）', keys(own.rows[0]));
  ok(keys(own) === 'ok,rows', '返事は { ok, rows } だけ', keys(own));

  // 一覧にない会社（社名を打ち込む）
  await work(B1, { airline: 'other', airline_other: 'Test Charter Alpha', position: 'cap', year: YEAR, month: 4, days_off: 10 });
  ok(((await mine(B1, { airline: 'other', airline_other: '  test CHARTER alpha ' })).rows || []).length === 1,
     '一覧にない会社は、同じ社名で引ける（大小文字・前後の空白は不問）');
  ok(((await mine(B1, { airline: 'other', airline_other: 'Test Charter Beta' })).rows || [0]).length === 0, '別の社名では出ない');
  ok(((await mine(B2, { airline: 'other', airline_other: 'Test Charter Alpha' })).rows || [0]).length === 0, '同じ社名でも他人には見えない');

  ok(bad(await mine(B1, { airline: 'no-such-airline' }), /航空会社が正しくありません/), '知らない会社コード → 受けない');
  ok(bad(await mine(B1, {}), /航空会社が正しくありません/), '会社を指定しない → 受けない');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 6. 検品（範囲・月・語彙・連投）');
// ════════════════════════════════════════════════════════════
{
  const [C1, L1] = await crew(2);
  const c = { airline: A_CHK, position: 'cap', year: YEAR, month: 1 };
  const rej = async (label, extra, re) => {
    const r = await work(C1, { ...c, ...extra });
    ok(bad(r, re), label, J(r));
  };
  const acc = async (label, extra) => {
    const r = await work(C1, { ...c, ...extra });
    ok(r.ok === true, label, J(r));
  };

  // ── 範囲
  await rej('乗務時間 201 → 受けない（200 に丸めて受け取らない）', { block_hours: 201 }, /乗務時間.*範囲/);
  await rej('乗務時間 -1 → 受けない', { block_hours: -1 }, /乗務時間.*範囲/);
  await rej('拘束時間 451 → 受けない', { duty_hours: 451 }, /拘束時間.*範囲/);
  for (const [k, ja] of [['work_days', '勤務日数'], ['duty_days', '乗務日数'], ['days_off', '公休日数'], ['stay_nights', 'ステイ泊数']]) {
    await rej(`${ja} 32 → 受けない`, { [k]: 32 }, new RegExp(ja + '.*範囲'));
  }
  await rej('日数に小数（8.5）→ 受けない', { days_off: 8.5 }, /公休日数は整数/);
  await rej('数字でないもの（abc）→ 受けない', { block_hours: 'abc' }, /乗務時間は数字/);
  await rej('指数表記（1e2）→ 受けない', { block_hours: '1e2' }, /乗務時間は数字/);
  await rej('true → 受けない（1 に読み替えない）', { stay_nights: true }, /ステイ泊数は数字/);
  await acc('上限ちょうどは通る（200 時間・450 時間・31 日・0 日・31 泊）',
            { block_hours: 200, duty_hours: 450, work_days: 31, duty_days: 31, days_off: 0, stay_nights: 31 });

  // ── 対象月
  await rej('未来の月 → 受けない', { ...NEXT, days_off: 8 }, /未来の月/);
  await acc('今月ぶんは出せる', { year: NOW.y, month: NOW.m, days_off: 8 });
  await rej('2014年 → 受けない', { year: 2014, month: 12, days_off: 8 }, /古すぎ/);
  await rej('13月 → 受けない', { month: 13, days_off: 8 }, /対象月が不正/);
  await rej('0月 → 受けない', { month: 0, days_off: 8 }, /対象月が不正/);
  await rej('年が数字でない → 受けない', { year: 'abcd', days_off: 8 }, /対象月が不正/);

  // ── 項目どうしの筋（両方に答えた人だけ見る）
  await rej('2025年2月（28日）に 勤務20＋公休9 → 受けない', { year: 2025, month: 2, work_days: 20, days_off: 9 }, /合計/);
  await acc('2025年2月に 勤務20＋公休8（ちょうど28日）は通る', { year: 2025, month: 2, work_days: 20, days_off: 8 });
  await acc('2024年2月（うるう年・29日）なら 勤務20＋公休9 が通る', { year: 2024, month: 2, work_days: 20, days_off: 9 });
  await rej('2024年2月でも 勤務20＋公休10 は受けない', { year: 2024, month: 2, work_days: 20, days_off: 10 }, /合計/);
  await rej('乗務日数 19 ＞ 勤務日数 18 → 受けない', { month: 4, work_days: 18, duty_days: 19 }, /乗務日数が勤務日数/);
  await acc('乗務日数 ＝ 勤務日数 は通る', { month: 4, work_days: 18, duty_days: 18 });
  await acc('片方しか答えていなければ突き合わせない（乗務日数だけ）', { month: 5, duty_days: 19 });

  // ── 語彙
  await rej('知らない会社コード → 受けない', { airline: 'no-such-airline', days_off: 8 }, /会社コードが不正/);
  await rej('「一覧にない会社」で社名なし → 受けない', { airline: 'other', days_off: 8 }, /社名の入力が必要/);
  await rej('81字の社名 → 受けない', { airline: 'other', airline_other: 'x'.repeat(81), days_off: 8 }, /社名が長すぎ/);
  await rej('選択肢に出していない職位（cadet）→ 受けない', { position: 'cadet', days_off: 8 }, /職位が不正/);
  await rej('知らない職位 → 受けない', { position: 'chief', days_off: 8 }, /職位が不正/);
  await rej('知らない「拘束時間の数え方」→ 受けない', { duty_hours: 150, duty_hours_basis: 'guess' }, /数え方が不正/);
  await rej('知らない「通勤を含めたか」→ 受けない', { duty_hours: 150, commute_included: 'maybe' }, /通勤.*不正/);
  let basisOK = 0;
  for (const b of ['report_to_release', 'incl_standby', 'roster', 'unknown']) {
    for (const cm of ['yes', 'no', 'unknown']) {
      const r = await work(C1, { ...c, month: 6, duty_hours: 150, duty_hours_basis: b, commute_included: cm });
      if (r.ok === true) basisOK++;
    }
  }
  ok(basisOK === 12, '数え方4種 × 通勤3種は全部通る', `${basisOK}/12`);
  await rej('ひとこと 501字 → 受けない', { month: 7, days_off: 8, note: 'あ'.repeat(501) }, /500字/);
  await acc('ひとこと 500字は通る', { month: 7, days_off: 8, note: 'あ'.repeat(500) });

  // 機材とベースは、語彙に無ければ黙って落とす（投稿ごと弾かない）
  await acc('知らない機材・形の違うベースでも投稿は通る', { month: 8, days_off: 8, fleet: 'no-such-fleet', base_iata: 'tokyo' });
  const soft = ((await mine(C1, { airline: A_CHK })).rows || []).find((r) => r.year === YEAR && r.month === 8) || {};
  ok(soft.fleet === null && soft.base_iata === null && soft.days_off === 8, '…そのとき機材とベースは空で残る（でたらめな文字列を持たない）', J(soft));

  // ── 表そのものの守り（関数を通らない道で入れようとしても止まる）
  const H = 'a'.repeat(64);
  const ins = (cols, vals) => boom(
    `insert into public.pv_work_months (proof_hash, airline, period_year, period_month, "position"${cols})
     values ($1, $2, 2025, 2, 'cap'${vals})`, [H, A_CHK]);
  ok(/pv_work_months_any_ck/.test(await ins('', '')), '表そのものも、6項目とも空の行を受けない');
  ok(/pv_work_months_range_ck/.test(await ins(', block_hours', ', 201')), '表そのものも、範囲の外を受けない');
  ok(/pv_work_months_sum_ck/.test(await ins(', work_days, days_off', ', 20, 9')), '表そのものも、勤務＋公休がその月の日数を超える行を受けない');
  ok(/pv_work_months_duty_ck/.test(await ins(', work_days, duty_days', ', 10, 11')), '表そのものも、乗務日数＞勤務日数の行を受けない');
  ok(/pv_work_months_basis_ck/.test(await ins(', days_off, duty_hours_basis', `, 8, 'guess'`)), '表そのものも、知らない数え方を受けない');
  ok(/pv_work_months_other_ck/.test(await ins(', days_off, airline_other', `, 8, 'Test Charter Alpha'`)),
     '表そのものも、一覧の会社に打ち込みの社名が付いた行を受けない');

  // ── 連投
  const lp = { airline: A_CAP, position: 'cap', year: YEAR, month: 1, days_off: 8 };
  await db.query(`update public.profiles set work_months_day = current_date, work_months_today = 40 where id = $1`, [L1]);
  ok(bad(await work(L1, lp), /上限/), '1日40件に達したら止まる');
  ok((await one(`select count(*)::int as n from public.pv_work_months where airline = $1`, [A_CAP])).n === 0, '止まった回は保存されていない');
  await db.query(`update public.profiles set work_months_day = current_date - 1 where id = $1`, [L1]);
  const again = await work(L1, lp);
  const cnt = await one(`select work_months_today as n, work_months_day = current_date as d from public.profiles where id = $1`, [L1]);
  ok(again.ok === true && cnt.n === 1 && cnt.d === true, '日付が変われば数え直す', J({ again, cnt }));
  await work(L1, { ...lp, block_hours: 999 });
  ok((await one(`select work_months_today as n from public.profiles where id = $1`, [L1])).n === 1, '弾かれた回は数えない');
  ok(no(await call(L1, `update public.profiles set work_months_today = 0 where id = $1`, [L1])),
     '会員は自分の数えを書き換えられない（上限を自分で外せない）');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 7. 給与の資格に数えない');
// ════════════════════════════════════════════════════════════
{
  const [W1, W2] = await crew(2);
  // 連投の数えの2列だけを除いた、profiles の1行まるごと
  const snap = async (who) => (await one(
    `select to_jsonb(f) - 'work_months_day' - 'work_months_today' as j from public.profiles f where id = $1`, [who])).j;
  const payCount = async () => (await one(`select count(*)::int as n from public.pay_reports`)).n;

  const g0 = await give(W1), s0 = await snap(W1), n0 = await payCount(), st0 = await gate(W1);
  ok(g0.basic === false && st0.state === 'locked', '（前提）何も出していない会員は、給与の門が閉じている', J({ g0, state: st0.state, err: st0.__err }));

  const full = { airline: A_GATE, position: 'cap', year: YEAR, month: 9,
                 block_hours: 78, duty_hours: 165, work_days: 19, duty_days: 16, days_off: 11, stay_nights: 9 };
  ok((await work(W1, full)).ok === true, '勤務を6項目とも出す');

  const g1 = await give(W1), s1 = await snap(W1), st1 = await gate(W1);
  ok(g1.basic === false && g1.detailed === false && g1.payslip === false && g1.full === false,
     '★勤務だけを出した人の pv_my_give() は basic:false のまま（給与を出したことにならない）', J(g1));
  ok(st1.state === 'locked', '★pv_pay_rows() は閉じたまま（REAL PAY が開かない）', J({ state: st1.state, err: st1.__err }));
  ok(J(s1) === J(s0), '★profiles は連投の数え以外、1列も変わらない（鍵の期限・給与の件数・バッジ・確認の印）',
     `前 ${J(s0)}\n     後 ${J(s1)}`);
  const cols = await one(
    `select access_until is null as a, pay_report_count = 0 as c, last_pay_report_at is null as l,
            badge = 'none' as b, verify_level = 0 as v, work_months_today = 1 as w
       from public.profiles where id = $1`, [W1]);
  ok(cols.a && cols.c && cols.l && cols.b && cols.v, '鍵の期限は空・給与の件数は0・バッジ無し・確認の印無し', J(cols));
  ok(cols.w, '動いたのは連投の数えだけ（1件ぶん）', J(cols));
  ok((await payCount()) === n0, '給与の表（pay_reports）に行が増えていない');

  for (let m = 1; m <= 8; m++) await work(W1, { ...full, month: m });
  const g9 = await give(W1), st9 = await gate(W1);
  ok(g9.basic === false && st9.state === 'locked' && J(await snap(W1)) === J(s0), '9か月ぶん出しても開かない・何も付かない', J({ g9, state: st9.state }));

  // 対照：この検査が「開いた」を見分けられること
  const pr = await pay(W2, { airline: A_GATE, period_year: YEAR, period_month: 9, block_hours: 70, stay_nights: 9 });
  ok(!pr.__err, '（対照）別の会員が給与を出す', pr.__err);
  const g2 = await give(W2), st2 = await gate(W2);
  ok(g2.basic === true && st2.state === 'open', '（対照）給与を出した人は basic:true・一覧が開く ＝ 上の検査は差を見分けられる',
     J({ g2, state: st2.state, err: st2.__err }));
  ok((await one(`select count(*)::int as n from public.pv_work_months where proof_hash = public.pv_work_hash($1, $2, null)`, [W2, A_GATE])).n === 0,
     '逆向きも別々：給与を出しても、勤務の置き場に行は勝手にできない');
  const still = await give(W1);
  ok(still.basic === false, '同じ会社で他人が給与を出しても、勤務だけの人は閉じたまま', J(still));

  // 末尾の検算（貼ったあとにオーナーが見る1行）
  const res = await db.exec(WORK_SQL);
  const chk = res[res.length - 1].rows[0] || {};
  ok(Number(chk['ポリシー数']) === 0 && chk['表は閉じている'] === true && chk['未ログインは出せない'] === true
     && chk['幅は資格を見てから返す'] === true && chk['給与の資格に触らない'] === true && chk['給与の門はこの表を読まない'] === true,
     '末尾の検算が6つともそろう（ポリシー0・それ以外は true）', J(chk));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 8. 幅（項目ごとに3人の壁）');
// ════════════════════════════════════════════════════════════
const WALL_Q = { airline: A_WALL, position: 'cap', year: YEAR, month: 3 };
{
  const [S1, S2, S3, S4] = await crew(4);
  const first = { ...WALL_Q, block_hours: 60, duty_hours: 151, work_days: 16, days_off: 10, stay_nights: 0 };
  await work(S1, first);
  await work(S2, { ...WALL_Q, block_hours: 80, duty_hours: 163, work_days: 18, stay_nights: 10 });
  const two = await stats(READER, WALL_Q);
  ok(two.ok === true && allNull(two.items), '2人では、どの項目も数字が出ない', J(two));
  const none = await stats(READER, { ...WALL_Q, month: 4 });
  ok(allNull(none.items) && J({ ...two, month: 0 }) === J({ ...none, month: 0 }),
     '★2人の月の返事は、誰も出していない月と1文字も違わない（在る／無いも出さない）', `${J(two)}\n     ${J(none)}`);
  ok(((await stats(READER, { airline: A_WALL, position: 'cap' })).months || [0]).length === 0, '2人の月は、月の一覧にも出ない');
  await work(S1, first); await work(S1, first);
  ok(allNull((await stats(READER, WALL_Q)).items), '同じ人が出し直しても人数は増えない');

  await work(S3, { ...WALL_Q, block_hours: 100, duty_hours: 178, work_days: 22 });
  const three = await stats(READER, WALL_Q);
  ok(rg(three.items.block_hours, 70, 90), '3人そろうと幅が出る（乗務時間 60・80・100 → 70〜90）', J(three.items));
  ok(rg(three.items.duty_hours, 155, 170), '時間は5刻みに丸める（拘束時間 151・163・178 → 155〜170）', J(three.items.duty_hours));
  ok(rg(three.items.work_days, 17, 20), '日数は1刻み（勤務日数 16・18・22 → 17〜20）', J(three.items.work_days));
  ok(three.items.stay_nights === null, '★未回答は人数に入らない（ステイ泊数は 0 と 10 の2人だけ → 出ない）', J(three.items.stay_nights));
  ok(three.items.days_off === null && three.items.duty_days === null,
     '壁は項目ごと（1人しか答えていない公休日数も、誰も答えていない乗務日数も出ない）', J(three.items));

  await work(S4, { ...WALL_Q, stay_nights: 12 });
  const four = await stats(READER, WALL_Q);
  ok(rg(four.items.stay_nights, 5, 11), '★0 と入れた人は人数に入る（ステイ泊数 0・10・12 → 5〜11）', J(four.items.stay_nights));
  ok(rg(four.items.block_hours, 70, 90), '★未回答を 0 として混ぜない（4人目は乗務時間を入れていない → 70〜90 のまま）', J(four.items.block_hours));

  ok(allNull((await stats(READER, { ...WALL_Q, position: 'fo' })).items), '職位が違えば混ぜない（機長4人の月を副操縦士で引いても出ない）');
  ok(allNull((await stats(READER, { ...WALL_Q, airline: A_ONE })).items), '会社が違えば混ぜない');
  ok(J(await stats(S1, WALL_Q)) === '{"ok":true,"state":"locked"}',
     '★勤務を出しただけの会員は、自分の出した月の幅も読めない（出したことは資格にならない）');
  await unlock(S1); await unlock(S4);
  ok(J(await stats(S1, WALL_Q)) === J(four) && J(await stats(S4, WALL_Q)) === J(four),
     '読める人なら誰が呼んでも同じ答え（呼んだ本人の値を足しも外しもしない）');
  const list = await stats(READER, { airline: A_WALL, position: 'cap' });
  ok(J(list.months) === J([{ year: YEAR, month: 3 }]) || (list.months.length === 1 && list.months[0].year === YEAR && list.months[0].month === 3),
     '幅が出る月は、月の一覧に出る', J(list));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 9. 給与と勤務の両方を出した人は1人');
// ════════════════════════════════════════════════════════════
{
  const [Q1, Q2, Q3, O2] = await crew(4);
  const q = { airline: A_BOTH, position: 'cap', year: YEAR, month: 5 };
  const pm = { airline: A_BOTH, period_year: YEAR, period_month: 5 };

  const p1 = await pay(Q1, { ...pm, block_hours: 70, stay_nights: 9, duty_days: 15, days_off: 9 });
  ok(!p1.__err, '1人目が給与を出す（乗務時間 70・ステイ 9）', p1.__err);
  await work(Q1, { ...q, block_hours: 50 });
  const same = await one(
    `select (select proof_hash from public.pay_reports where airline = $1)
          = (select proof_hash from public.pv_work_months where airline = $1) as b`, [A_BOTH]);
  ok(same.b === true, '★同じ人・同じ会社なら、給与の行と勤務の行のハッシュが同じ（式の写しが実物と合っている）');

  const p2 = await pay(Q2, { ...pm, block_hours: 90, stay_nights: 11 });
  ok(!p2.__err, '2人目は給与だけ出す（乗務時間 90・ステイ 11）', p2.__err);
  const b2 = await stats(READER, q);
  ok(allNull(b2.items), '★両方を出した人を2回数えない（2回数えると乗務時間が3人ぶんになって幅が出る）', J(b2.items));

  await work(Q3, { ...q, block_hours: 110 });
  const b3 = await stats(READER, q);
  ok(rg(b3.items.block_hours, 70, 100),
     '同じ項目が両方に在れば、勤務の置き場の値が先（50・90・110 → 70〜100。給与側の 70 を使うと 80〜100）', J(b3.items.block_hours));
  ok(b3.items.stay_nights === null, '給与の行のステイ泊数は2人ぶん（9・11）→ まだ出ない', J(b3.items.stay_nights));

  const p3 = await pay(Q3, { ...pm, block_hours: 120, stay_nights: 13 });
  ok(!p3.__err, '3人目があとから給与も出す（乗務時間 120・ステイ 13）', p3.__err);
  const b4 = await stats(READER, q);
  ok(rg(b4.items.stay_nights, 10, 12), '給与の行に書かれた勤務の数字も材料になる（ステイ 9・11・13 → 10〜12）', J(b4.items.stay_nights));
  ok(rg(b4.items.block_hours, 70, 100), '…あとから給与を出しても、勤務の置き場の値が先のまま（110 が 120 に替わらない）', J(b4.items.block_hours));

  // 一覧にない会社でも、式は給与と同じ（社名は小文字・前後の空白を落として混ぜる）
  const po = await pay(O2, { airline: 'other', airline_other: 'Test Charter Gamma', period_year: YEAR, period_month: 5, block_hours: 40, stay_nights: 2 });
  ok(!po.__err, '一覧にない会社で給与を出す', po.__err);
  await work(O2, { airline: 'other', airline_other: '  test CHARTER gamma ', position: 'cap', year: YEAR, month: 5, days_off: 12 });
  const so = await one(
    `select (select proof_hash from public.pay_reports   where airline = 'other' and lower(airline_other) = 'test charter gamma')
          = (select proof_hash from public.pv_work_months where airline = 'other' and lower(airline_other) = 'test charter gamma') as b`);
  ok(so.b === true, '★一覧にない会社でも、給与の行と勤務の行のハッシュが同じ');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 10. 打ち込まれた社名（一覧にない会社）');
// ════════════════════════════════════════════════════════════
let SPELL = [];
{
  // 英名をそのまま打つと自分の code に当たる会社を、まだ使っていない中から1つ取る。
  // 綴りは3通り。どれも給与の一覧と同じ寄せ方（pv_airline_resolve）で同じ会社に当たるが、
  // ハッシュの材料（小文字にした社名）は3つとも違う。
  const T = await one(
    `select a.code, a.name_en from public.pv_airlines a
      where a.active and a.code <> 'other'
        and not (a.code = any(string_to_array($1, ',')))
        and public.pv_airline_resolve(a.name_en) = a.code
        and public.pv_airline_resolve('-' || a.name_en) = a.code
        and public.pv_airline_resolve(a.name_en || ' .') = a.code
      order by a.code limit 1`, [AIR.join(',')]);
  SPELL = [T.name_en, '-' + T.name_en, T.name_en + ' .'];
  const tq = { airline: T.code, position: 'cap', year: YEAR, month: 8 };
  const [T1, T2, T3, X1, X2, X3] = await crew(6);

  for (const s of SPELL) await work(T3, { airline: 'other', airline_other: s, position: 'cap', year: YEAR, month: 8, block_hours: 100 });
  const h = await one(
    `select count(*)::int as n, count(distinct proof_hash)::int as h from public.pv_work_months
      where airline = 'other' and public.pv_airline_resolve(airline_other) = $1`, [T.code]);
  ok(h.n === 3 && h.h === 3, '（前提）1人が綴りを3つ変えると、別々のハッシュの3行になる', J(h));
  ok(allNull((await stats(READER, tq)).items), '★1人が綴りを3つ変えても3人にはならない（1つのアカウントで壁を破れない）');
  ok(((await stats(READER, { airline: T.code, position: 'cap' })).months || [0]).length === 0, '…月の一覧にも出ない');

  await work(T1, { ...tq, block_hours: 60 });
  ok(allNull((await stats(READER, tq)).items), '一覧から選んだ1人を足しても2人');
  await work(T2, { ...tq, block_hours: 80 });
  ok(rg((await stats(READER, tq)).items.block_hours, 70, 90),
     '打ち込まれた社名が会社に当たれば、その会社の1人として数える（60・80・100 → 70〜90）');

  // 'other' そのものは集計しない（別々の会社が1つの箱に混ざる）
  for (const [i, u] of [X1, X2, X3].entries()) {
    await work(u, { airline: 'other', airline_other: 'Test Charter Delta', position: 'cap', year: YEAR, month: 9, block_hours: 50 + i * 10 });
  }
  const ox = await stats(READER, { airline: 'other', position: 'cap', year: YEAR, month: 9 });
  const ol = await stats(READER, { airline: 'other', position: 'cap' });
  ok(allNull(ox.items) && ol.months.length === 0, '「一覧にない会社」は3人そろっても集計しない（幅も月の一覧も空）', J({ ox, ol }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 11. 給与の行は「一覧に出してよい行」だけを材料にする');
// ════════════════════════════════════════════════════════════
{
  const [H1, H2, H3] = await crew(3);
  const q = { airline: A_HID, position: 'cap', year: YEAR, month: 10 };
  for (const [i, u] of [H1, H2, H3].entries()) {
    const r = await pay(u, { airline: A_HID, period_year: YEAR, period_month: 10, block_hours: 60 + i * 20, stay_nights: 8 + i });
    if (r.__err) ok(false, '給与を出す', r.__err);
  }
  const pre = await one(
    `select count(*)::int as n, bool_and(annual_total_usd between 10000 and 700000) as sane
       from public.pay_reports where airline = $1`, [A_HID]);
  ok(pre.n === 3 && pre.sane === true, '（前提）3人ぶんの給与が、常識の幅の年換算で入っている', J(pre));

  const h0 = await stats(READER, q);
  ok(rg(h0.items.block_hours, 70, 90), '給与の行に書かれた勤務の数字だけでも、3人そろえば幅が出る（60・80・100 → 70〜90）', J(h0.items));
  ok(h0.items.work_days === null, '勤務日数は給与の行に欄が無い → 出ない（0 で埋めない）', J(h0.items.work_days));

  const keep = (await one(`select annual_total_usd::text as v from public.pay_reports where proof_hash = public.pv_work_hash($1, $2, null)`, [H1, A_HID])).v;
  await db.query(`update public.pay_reports set annual_total_usd = 900000 where proof_hash = public.pv_work_hash($1, $2, null)`, [H1, A_HID]);
  ok(allNull((await stats(READER, q)).items), '年換算が常識の幅を外れた給与の行は材料にしない（2人に減って出なくなる）');
  await db.query(`update public.pay_reports set annual_total_usd = $3::numeric where proof_hash = public.pv_work_hash($1, $2, null)`, [H1, A_HID, keep]);

  await db.query(`insert into public.pay_hidden (proof_hash, reason) values (public.pv_work_hash($1, $2, null), '本人の依頼（検査用）')`, [H2, A_HID]);
  ok(allNull((await stats(READER, q)).items), '★本人の依頼で一覧から下ろした人の給与の行は、ここでも材料にしない');
  await db.query(`delete from public.pay_hidden where proof_hash = public.pv_work_hash($1, $2, null)`, [H2, A_HID]);
  ok(rg((await stats(READER, q)).items.block_hours, 70, 90), '戻せば元どおり');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 12. 月の一覧と、受け取る形');
// ════════════════════════════════════════════════════════════
{
  const [M1, M2, M3] = await crew(3);
  const lm = { airline: A_LIST, position: 'fo' };
  // 25か月ぶん × 3人（古い月から）。25か月目 ＝ 去年の1月
  for (let i = 0; i < 25; i++) {
    for (const [k, u] of [M1, M2, M3].entries()) {
      await work(u, { ...lm, year: YEAR - 2 + Math.floor(i / 12), month: i % 12 + 1, days_off: 8 + k });
    }
  }
  // 去年の6月は2人だけ
  await work(M1, { ...lm, year: YEAR, month: 6, days_off: 8 });
  await work(M2, { ...lm, year: YEAR, month: 6, days_off: 9 });

  const list = await stats(READER, lm);
  const ym = (list.months || []).map((m) => m.year * 12 + m.month);
  ok(keys(list) === 'airline,months,ok,position,state' && list.state === 'open' && list.airline === A_LIST && list.position === 'fo', '年月を省くと { ok, state, airline, position, months } が返る', keys(list));
  ok(ym.length === 24, '月の一覧は24件まで（25か月ぶん在っても）', String(ym.length));
  ok(list.months[0].year === YEAR && list.months[0].month === 1 && ym.every((v, i) => i === 0 || v < ym[i - 1]), '新しい月が先');
  ok(!list.months.some((m) => m.year === YEAR && m.month === 6), '3人に届かない月は一覧に出ない');
  ok(list.months.every((m) => keys(m) === 'month,year'), '一覧の中身は { year, month } だけ');
  const cell = await stats(READER, { ...lm, year: YEAR, month: 1 });
  ok(keys(cell) === 'airline,items,month,ok,position,state,year' && cell.state === 'open' && keys(cell.items) === [...SIX].sort().join(',') && rg(cell.items.days_off, 9, 10),
     '年月を付けると { ok, airline, position, year, month, items } が返る（公休 8・9・10 → 9〜10）', J(cell));
  ok(rg((await stats(READER, { ...lm, period_year: YEAR, period_month: 1 })).items.days_off, 9, 10), '年月は period_year / period_month でも受ける');

  ok(bad(await stats(READER, { airline: 'no-such-airline', position: 'fo' }), /航空会社が正しくありません/), '知らない会社 → 受けない');
  ok(bad(await stats(READER, { airline: A_LIST, position: 'chief' }), /職位が正しくありません/), '知らない職位 → 受けない');
  ok(bad(await stats(READER, { airline: A_LIST }), /職位が正しくありません/), '職位を省く → 受けない');
  ok(bad(await stats(READER, { ...lm, year: YEAR }), /年月が正しくありません/), '年だけ → 受けない');
  ok(bad(await stats(READER, { ...lm, month: 1 }), /年月が正しくありません/), '月だけ → 受けない');
  ok(bad(await stats(READER, { ...lm, year: 'abcd', month: 1 }), /年月が正しくありません/), '年が数字でない → 受けない');
  ok(bad(await stats(READER, { ...lm, year: YEAR, month: 13 }), /年月が正しくありません/), '13月 → 受けない');
  ok(bad(await stats(READER, undefined), /航空会社が正しくありません/), '引数が空 → 受けない');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 12-b. 直近12か月の幅（会社ページと比較が読む口）');
// ════════════════════════════════════════════════════════════
{
  const [V1, V2, V3, V4, V5] = await crew(5);
  const m1 = ago(1), m2 = ago(2), old = ago(13);
  const base = { airline: A_VIEW, position: 'cap' };
  await work(V1, { ...base, ...m1, block_hours: 60, days_off: 8 });
  await work(V2, { ...base, ...m1, block_hours: 80, days_off: 10 });
  const two = await view(READER, { airline: A_VIEW });
  ok(two.state === 'open' && allNull(two.by.cap) && allNull(two.by.fo), '2人では、どの項目も出ない', J(two));
  // 同じ人がもう1か月出しても、人数は増えない（1人＝1つの値）
  await work(V1, { ...base, ...m2, block_hours: 100, days_off: 8 });
  ok(allNull((await view(READER, { airline: A_VIEW })).by.cap), '★同じ人が別の月を出しても人数は増えない（1人は1回だけ数える）');
  await work(V3, { ...base, ...m1, block_hours: 100, days_off: 0 });
  const three = await view(READER, { airline: A_VIEW });
  // V1 は 60 と 100 の平均 80・V2 は 80・V3 は 100 → 25〜75% は 80〜90
  ok(rg(three.by.cap.block_hours, 80, 90), '3人そろうと幅が出る（1人の複数月は平均してから数える：80・80・100 → 80〜90）', J(three.by.cap));
  ok(rg(three.by.cap.days_off, 4, 9), '★0 と入れた人は人数に入る（公休 8・10・0 → 4〜9）', J(three.by.cap.days_off));
  ok(three.by.cap.duty_hours === null && three.by.cap.stay_nights === null, '壁は項目ごと（誰も答えていない項目は出ない）');
  ok(allNull(three.by.fo), '職位は混ぜない（機長3人の会社を副操縦士で見ても出ない）');
  ok(keys(three) === 'airline,by,months,ok,state' && keys(three.by.cap) === [...SIX].sort().join(','), '返事の鍵は決まったものだけ（人数を持たない）', J(three));
  // 12か月より前の月は入れない
  await work(V4, { airline: A_VIEW, position: 'fo', ...old, stay_nights: 5 });
  await work(V5, { airline: A_VIEW, position: 'fo', ...old, stay_nights: 7 });
  await work(V1, { airline: A_VIEW, position: 'fo', ...old, stay_nights: 9 });
  ok(allNull((await view(READER, { airline: A_VIEW })).by.fo), '12か月より前の月は数えない（3人いても出ない）');
  ok(J(await view(V1, { airline: A_VIEW })) === '{"ok":true,"state":"locked"}', '★出した本人でも、給与の鍵が無ければ読めない');
  ok(bad(await view(READER, { airline: 'no-such-airline' }), /航空会社が正しくありません/), '知らない会社 → 受けない');
  ok(bad(await view(READER, { airline: 'other' }), /航空会社が正しくありません/), '自由入力の会社 → 受けない（名前の表記で分かれる）');
  const raw = J(three);
  ok(!/"(n|count|people|avg|mean|median|rows|note)"/i.test(raw) && !/[0-9a-f]{64}/.test(raw), '人数・平均・個票・ハッシュの鍵が無い');

  // 検品を通した形は、もう一度通しても1文字も変わらない（預かり → 引き継ぎで別の決まりに落ちない）
  const p0 = { airline: A_VIEW, position: 'cap', ...m1, block_hours: '72.5', days_off: 0, note: '  ひとこと  ', lang: 'EN' };
  const c1 = (await one(`select public.pv_work_month_clean($1::jsonb) as v`, [J(p0)])).v;
  const c2 = (await one(`select public.pv_work_month_clean($1::jsonb) as v`, [J(c1)])).v;
  ok(J(c1) === J(c2) && c1.days_off === 0 && c1.duty_hours === null && c1.note === 'ひとこと',
     '★検品を通した形は、もう一度通しても同じ（0 は 0・未回答は null のまま）', J({ c1, c2 }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 13. 返った JSON に、出てはいけないものが無い（この検査が受け取った返事ぜんぶ）');
// ════════════════════════════════════════════════════════════
{
  const st = seen.filter((s) => s.fn === 'pv_work_month_stats');
  const my = seen.filter((s) => s.fn === 'my_work_months');
  const stRaw = st.map((s) => s.json).join('\n');
  const all = seen.map((s) => s.json).join('\n');
  // 下の検査が「見るものが無いので緑」にならないための下限（上の節を削ると、ここが先に赤くなる）
  ok(st.length >= 20 && my.length >= 10, `見ている返事：幅 ${st.length}件・自分の勤務 ${my.length}件・全部で ${seen.length}件`);

  const int = (v) => Number.isInteger(v);
  const shape = (v) => {
    if (v.ok !== true) return false;
    if (v.state !== 'open') return keys(v) === 'ok,state' && (v.state === 'login' || v.state === 'locked');
    if ('months' in v) {
      return keys(v) === 'airline,months,ok,position,state'
        && Array.isArray(v.months) && v.months.every((m) => keys(m) === 'month,year' && int(m.year) && int(m.month));
    }
    return keys(v) === 'airline,items,month,ok,position,state,year' && int(v.year) && int(v.month)
      && keys(v.items) === [...SIX].sort().join(',')
      && SIX.every((k) => v.items[k] === null
        || (keys(v.items[k]) === 'hi,lo' && typeof v.items[k].lo === 'number' && typeof v.items[k].hi === 'number'
            && v.items[k].lo <= v.items[k].hi));
  };
  const off = st.filter((s) => !shape(JSON.parse(s.json)));
  ok(off.length === 0, '★幅の返事は決まった形だけ（開いた2つ＋断りの1つ）＝ 数字は 年・月・lo・hi しか無い（人数を持たない）', off.slice(0, 2).map((s) => s.json).join(' / '));
  const fives = st.every((s) => {
    const v = JSON.parse(s.json);
    return !v.items || ['block_hours', 'duty_hours'].every((k) => v.items[k] === null || (v.items[k].lo % 5 === 0 && v.items[k].hi % 5 === 0));
  });
  const whole = st.every((s) => {
    const v = JSON.parse(s.json);
    return !v.items || ['work_days', 'duty_days', 'days_off', 'stay_nights'].every((k) => v.items[k] === null || (int(v.items[k].lo) && int(v.items[k].hi)));
  });
  ok(fives && whole, '時間の幅は必ず5の倍数・日数と泊数の幅は必ず整数（生の値がそのまま出ていない）');
  ok(st.some((s) => /"lo"/.test(s.json)), '（前提）幅が実際に出た返事が含まれている');
  ok(!/"(n|count|cnt|people|persons|samples?|total|avg|average|mean|median|p50|mid|rows|note)"/i.test(stRaw),
     '幅の返事に、人数・平均・中央値・個票・ひとことの鍵が1つも無い');
  ok(!/Test Charter|訓練|メモ/.test(stRaw) && SPELL.slice(1).every((s) => !stRaw.includes(s)),
     '幅の返事に、打ち込まれた社名もひとことも出ない');

  const rowKeys = ['year', 'month', 'position', 'fleet', 'base_iata', ...SIX, 'duty_hours_basis', 'commute_included', 'note'].sort().join(',');
  ok(my.every((s) => { const v = JSON.parse(s.json); return keys(v) === 'ok,rows' && v.rows.every((r) => keys(r) === rowKeys); }),
     '「自分の勤務」の返事は、どの回も決まった14個の鍵だけ');

  ok(!/[0-9a-f]{64}/.test(all), 'ハッシュ（64桁の16進）がどの返事にも無い');
  ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(all), '会員の id も行の id も、どの返事にも無い');
  ok(!/@example\.com|proof_hash|user_id|created_at|updated_at/.test(all), 'メールアドレス・ハッシュの列名・時刻の列名がどの返事にも無い');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 14. データが入ったまま流し直す');
// ════════════════════════════════════════════════════════════
{
  const sum = () => one(
    `select count(*)::int as n, md5(string_agg(md5(w::text), '' order by w.id)) as h from public.pv_work_months w`);
  const before = await sum();
  let e = '';
  try { await db.exec(WORK_SQL); await db.exec(WORK_SQL); } catch (x) { e = String(x.message || x); }
  ok(e === '', `${before.n}行が入ったままで、2回続けて流し直せる`, e);
  const after = await sum();
  ok(after.n === before.n && after.h === before.h, '流し直しても行は1つも増えず・1文字も変わらない', J({ before, after }));
  const pol = await one(
    `select (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'pv_work_months') as n,
            has_function_privilege('anon', 'public.submit_work_month(jsonb)', 'execute') as a,
            has_function_privilege('authenticated', 'public.pv_work_month_cells(text, text)', 'execute') as c,
            has_table_privilege('authenticated', 'public.pv_work_months', 'select') as t`);
  ok(pol.n === 0 && pol.a === false && pol.c === false && pol.t === false, '流し直しても権限が開いていない', J(pol));
  ok(rg((await stats(READER, WALL_Q)).items.block_hours, 70, 90), '流し直したあとも同じ幅が返る');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 15. 前提が無い DB では、日本語の案内で止まる');
// ════════════════════════════════════════════════════════════
{
  const bare = new PGlite({ extensions: { pgcrypto } });
  await bare.waitReady;
  await bare.exec(`create schema if not exists extensions;`);
  let e = null;
  try { await bare.exec(WORK_SQL); } catch (x) { e = String(x.message || x); }
  ok(e !== null && e.includes('db/airlines.generated.sql') && /[ぁ-ん]/.test(e), '会社の名簿が無い → 「先に db/airlines.generated.sql」', e === null ? '止まらずに流れた' : e);
  const none = (await bare.query(`select to_regclass('public.pv_work_months') is null as n`)).rows[0].n;
  ok(none === true, '止まったときは表を作っていない');
  await bare.close();
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
