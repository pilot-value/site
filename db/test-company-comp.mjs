/* 会社ページの「平均の月の支給構成」（db/deep-pay.sql 4章の pv_company_comp）を、本物の Postgres（PGlite = PG17 の WASM ビルド）で確かめる。

   実行: node db/test-company-comp.mjs   （check.mjs sql にも入っている）
   ネットワーク不要・本番に一切触らない。

   守っているもの（2026-10-30 オーナー指示「給与の鍵のある人には、会社ページに平均の月の支給構成のドーナツ」）:
     ★ 門 ── 開くのは給与の鍵が生きている人と運営だけ（pv_work_level の1か所。pv_company_pay と同じ人）。
       未ログインは呼べない（実行権が無い）。鍵の無い会員・鍵の切れた会員・止めた会員（鍵は生きている）は
       { ok, state:'locked' } の2つだけ（引数がおかしくても同じ）。
     ★ 数え方は pv_deep_pay の給与構成の写し ── 同じ見本について、pv_deep_pay の comp.segs と
       **1文字も違わない**（k・pct・avg_usd・並び）。比べる相手は2つ:
         ・pv_deep_pay を {airline, position} で手で選んだとき（0段 ＝ 会社 × 職位・機材で絞らない）
         ・何も選ばない呼び手の区分のはしごが「会社 × 職位」（3段・airline_pos）に落ちたとき
     ★ 手で数えた答えとも同じ（平均は1人1票・項目を持つ人が2人に届かない項目は rest へ畳む・
       pct は合計100・avg_usd は有効数字2桁・畳んだ rest を持つ人が1人なら avg_usd は null）
     ★ 入らない月 ── 総支給だけ・一部未回答・内訳が総支給をはみ出した・24か月より前・常識の幅の外・
       ほかの職位・口コミに書かれた年収。下ろした人（pay_hidden）も入らない（pv_deep_pay とは違う・わざと）
     ★ 1人の区分は {s:'few'} だけ。人数・持っている人の数・件数のキーは、どの返事にも無い
     ★ 壊す証明 ── 係数を1つ変えた版（住宅手当を数えない）は、pv_deep_pay と同じ答えにならない

   器は db/test-pay-compare.mjs と同じ（anon / authenticated ロール、既定の権限を全部付けた状態、auth.uid() の代役、
   profiles、auth.users、reviews_v2）。流す SQL の並びは serve-local.mjs の SQL_FILES をそのまま読む（写さない）。
   読み手の鍵は本物の submit_pay_report をその会員として通して作る。運営は名簿（pv_admins）に入れて作る。
   pv_deep_pay の「みんなの側」の門は、手動の公開フラグ（pv_deep_launch）を1行立てて通す（auth.users が在るので抜け道は効かない）。

   ⚠️ set_config の第3引数は false（＝セッション全体）。
   ⚠️ ここに出てくる会員は全部作り物（crew1@example.com など）。数字も検査のための作り物。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import { SQL_FILES } from '../serve-local.mjs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const MINE = 'db/deep-pay.sql';

const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;
await db.exec(`set timezone = 'UTC'`);

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };
// 準備の確かめ。通れば何も数えない。崩れたら ❌ を1行出して数える（黙って先へ進まない）
const must = (c, l, e = '') => { if (!c) ok(false, '（準備が崩れた）' + l, e); return !!c; };
const J = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x) : x));
// キーの並びに左右されない比べ方（配列の並びはそのまま見る）
const canon = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x)
  : (x && typeof x === 'object' && !Array.isArray(x)) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));
const keys = (o) => Object.keys(o || {}).sort().join(',');

// ── 器（db/test-pay-compare.mjs と同じ）──────────────────────
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
for (const f of SQL_FILES) {
  try { await db.exec(read(f)); ok(true, f); }
  catch (e) { ok(false, f, e.message); process.exit(1); }
}
console.log('\n▼ 冪等性（db/deep-pay.sql をもう一度そのまま流す）');
try { await db.exec(read(MINE)); ok(true, MINE + ' 再適用OK'); }
catch (e) { ok(false, MINE + ' 再適用で失敗', e.message); }

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
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

/* 支給構成の口の返事は全部ためておく（C5 で、人数のキーがどの返事にも無いことを見る）。 */
const SEEN = [];
const comp = async (who, p) => {
  const r = p === undefined
    ? await call(who, `select public.pv_company_comp() as v`)
    : await call(who, `select public.pv_company_comp($1::jsonb) as v`, [p === null ? null : J(p)]);
  if (r.err) return { __err: r.err };
  SEEN.push(r.v.v);
  return r.v.v;
};
const cpay = async (who, p) => {
  const r = await call(who, `select public.pv_company_pay($1::jsonb) as v`, [J(p)]);
  return r.err ? { __err: r.err } : r.v.v;
};
const deep = async (who, sel) => {
  const r = await call(who, `select public.pv_deep_pay($1::jsonb) as v`, [J(sel || {})]);
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

const BASE = { currency: 'USD', lang: 'en', tax_rate_pct: 0, fleet: 'a320' };
/* 給与を1件出す。その会員として本物の submit_pay_report を通す（1日の件数は毎回戻す）。月は DB の時計から k か月前。 */
const put = async (who, airline, pos, k, x) => {
  const r = await call(who, `select public.submit_pay_report($1::jsonb) as v`,
    [J({ ...BASE, airline, position: pos, period_year: ago(k).year, period_month: ago(k).month, ...x })]);
  await db.exec(`update public.profiles set pay_reports_today = 0`);
  const v = r.err ? { __err: r.err } : r.v.v;
  must(!v.__err && v.access_until != null, `給与を出せなかった（${airline} / ${pos} / ${J(x).slice(0, 80)}）`, J(v));
  return v;
};
const person = async (airline, pos, months) => {
  const id = await member();
  for (const [k, x] of months) await put(id, airline, pos, k, x);
  return id;
};
/* 給与の行の鍵（本人 × 会社）。式は db/pay-rows.sql の pv_pay_person_map と同じ（会員 id と会社コードの sha256）。 */
const payKey = async (id, airline) => (await one(
  `select encode(extensions.digest($1 || '::pv_pay::' || $2, 'sha256'), 'hex') as h`, [id, airline])).h;
const sig2 = async (v) => (v == null ? null : Number((await one(`select public.pv_sig2($1::numeric) as v`, [v])).v));

// 会社コードは語彙から取る（このテストのために特定の社名を覚えない）
const AIR = (await db.query(
  `select code from public.pv_airlines where code <> 'other' and active order by code limit 8`)).rows.map((r) => r.code);
const [A_READ, A_HAND, A_MIX, A_ONE, A_EMPTY] = AIR;

// ── 読み手 ──────────────────────────────────────────────────
const MEMBER = await member();                         // 給与を出していない会員
const SUBMITTER = await member();                      // 給与を出した会員（鍵が生きている）
await put(SUBMITTER, A_READ, 'cap', 1, { gross_monthly: 15000 });
const EXPIRED = await member();                        // 給与を出したが鍵が切れた会員
await put(EXPIRED, A_READ, 'fo', 1, { gross_monthly: 9000 });
await db.query(`update public.profiles set access_until = now() - interval '1 day' where id = $1`, [EXPIRED]);
const BLOCKED = await member();                        // 給与を出した（鍵は生きている）が、写真で止められた会員
await put(BLOCKED, A_READ, 'cap', 1, { gross_monthly: 14000 });
await db.query(`insert into public.pv_proof (user_id, state) values ($1, 'required')`, [BLOCKED]);
const OPERATOR = await member();                       // 運営（給与は出していない）
await db.query(`insert into public.pv_admins (user_id, note) values ($1, '運営（検査）') on conflict (user_id) do nothing`, [OPERATOR]);
// pv_deep_pay の「みんなの側」の門 ── 手動の公開フラグを1行（比べる相手を開くためだけ。pv_company_comp はこれを読まない）
await db.query(`insert into public.pv_deep_launch (one) values (true) on conflict do nothing`);
{
  await db.query(`select set_config('pv.uid', $1, false)`, [BLOCKED]);
  const b = (await one(`select public.pv_proof_blocked() as b, public.pv_work_level() as w`));
  await asOwner();
  must(b.b === true && b.w === 'member', '止められた会員を作れていない', J(b));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ C1 門: 開くのは給与の鍵が生きている人と運営だけ（pv_company_pay と同じ人）');
// ════════════════════════════════════════════════════════════
{
  const LOCKED = canon({ ok: true, state: 'locked' });
  const ARGS = [[{ airlines: [A_HAND] }, '正しい1社'], [{ airlines: [A_HAND, A_MIX] }, '正しい2社'], [{ airlines: A_HAND }, '配列でない'],
                [{ airlines: [A_HAND, A_MIX, A_ONE] }, '3社'], [{}, '空の形'], [null, 'null'], [undefined, '引数なし']];
  for (const [who, name] of [[MEMBER, '給与を出していない会員'], [EXPIRED, '鍵の切れた会員'], [BLOCKED, '止められた会員（鍵は生きている）']]) {
    const got = [];
    for (const [p] of ARGS) got.push(await comp(who, p));
    ok(got.every((v) => canon(v) === LOCKED), `★${name}: ${ARGS.map(([, n]) => n).join('・')} のどれでも {ok:true, state:"locked"} だけ`,
      got.map((v) => canon(v)).join(' | '));
  }
  for (const [who, name] of [[SUBMITTER, '給与を出した会員'], [OPERATOR, '運営']]) {
    const v = await comp(who, { airlines: [A_HAND] });
    ok(v.ok === true && v.state === 'open', `★${name}は open`, J(v));
  }
  const g = await comp(ANON, { airlines: [A_HAND] });
  ok(!!g.__err && /permission denied/i.test(g.__err), '★未ログインは呼べない（実行権が無い）', J(g));
  for (const [who, name] of [[MEMBER, '給与を出していない会員'], [EXPIRED, '鍵の切れた会員'], [BLOCKED, '止められた会員'],
                             [SUBMITTER, '給与を出した会員'], [OPERATOR, '運営']]) {
    const a = (await comp(who, { airlines: [A_HAND] })).state, b = (await cpay(who, { airlines: [A_HAND] })).state;
    ok(a === b, `${name}: 支給構成 ${a} ／ 提出された年収の中央値 ${b}（同じ門）`);
  }
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ C2 形: 鍵のある人にも、形の違う入力は {ok:false, state:"bad"}・開いた返事の鍵は ok / state / period / airlines');
// ════════════════════════════════════════════════════════════
{
  const BAD = canon({ ok: false, state: 'bad' });
  const CASES = [[{ airlines: [A_HAND, A_MIX, A_ONE] }, '3社'], [{ airlines: [A_HAND, A_HAND] }, '同じ会社2つ'],
                 [{ airlines: ['zz-no-such-airline'] }, '語彙に無い会社'], [{ airlines: [A_HAND, 'zz-no-such-airline'] }, '1社が語彙に無い'],
                 [{ airlines: ['other'] }, 'その他'], [{ airlines: A_HAND }, '配列でない'], [{ airlines: {} }, '中身が形'],
                 [{ airlines: [] }, '空の配列'], [{}, '会社の欄なし'], [null, 'null'], [undefined, '引数なし']];
  const got = [];
  for (const [p] of CASES) got.push(await comp(SUBMITTER, p));
  ok(got.every((v) => canon(v) === BAD), `★${CASES.map(([, n]) => n).join('・')} はどれも bad だけ`,
    got.map((v, i) => CASES[i][1] + '=' + canon(v)).filter((s) => !s.endsWith(BAD)).join(' | '));
  const r = await comp(SUBMITTER, { airlines: [A_EMPTY, A_HAND] });
  ok(keys(r) === 'airlines,ok,period,state' && r.ok === true && r.state === 'open', '★開いた返事の鍵はちょうど ok / state / period / airlines', keys(r));
  const from = ym(ago(23)), to = ym(ago(0));
  ok(keys(r.period) === 'from,to' && r.period.from === from && r.period.to === to, `期間は給与の月で ${from} 〜 ${to}（当月を含む24か月）`, J(r.period));
  ok(keys(r.airlines) === [A_EMPTY, A_HAND].sort().join(',') && canon(r.airlines[A_EMPTY]) === canon({ cap: { s: 'few' }, fo: { s: 'few' } }),
    '聞いた会社だけが返る・投稿の無い会社も2職位とも {s:"few"}（どこに数字が在るかを形で教えない）', J(r.airlines));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ C3 手で数えた答えと同じ（1人1票の平均・2人に届かない項目は rest へ畳む・pct は合計100）');
// ════════════════════════════════════════════════════════════
/* 2人。どちらも USD（年収の USD ÷ 本人の通貨 ＝ 1）・総支給を書かない（現金 ＝ 内訳の合計 ＝ 未分類 0）。
     P1 … 1か月: 基本給 9000・変動給 4000・その他 400（other_allowance ＝ 変動給＋その他 ＝ 4400）・職位 2000・
                  パーディアム 1000・住宅 600・教官 500
     P2 … 2か月: 基本給 10000 / 12000・変動給 3000 / 5000・その他 200 / 0・職位 1000 / 1000・パーディアム 500 / 1500
   1人ぶんの平均 → 人どうしの平均:
     基本給 10000・変動給 4000・職位 1500・役割 250（P1 だけ）・パーディアム 1000・住宅 300（P1 だけ）・その他 250・未分類 0
   役割と住宅は持つ人が1人 ＝ rest へ畳む（rest ＝ 0 ＋ 250 ＋ 300 ＝ 550）。rest を持つ人も1人なので rest の avg_usd は null。 */
const P1 = { base_pay: 9000, flight_variable_pay: 4000, other_allowance: 4400, command_pay: 2000, per_diem: 1000,
             housing_type: 'allowance', housing_amount: 600, instructor_pay: 500 };
const P2a = { base_pay: 10000, flight_variable_pay: 3000, other_allowance: 3200, command_pay: 1000, per_diem: 500 };
const P2b = { base_pay: 12000, flight_variable_pay: 5000, other_allowance: 5000, command_pay: 1000, per_diem: 1500 };
const ONE_DET = { base_pay: 9000, flight_variable_pay: 4000, other_allowance: 4400, command_pay: 2000 };
let HAND_BEFORE;
{
  await person(A_HAND, 'cap', [[1, P1]]);
  const solo = (await comp(SUBMITTER, { airlines: [A_HAND] })).airlines?.[A_HAND];
  ok(canon(solo) === canon({ cap: { s: 'few' }, fo: { s: 'few' } }), '★内訳を書いた人が1人の区分は {s:"few"} だけ（ほかのキーが無い）', J(solo));
  await person(A_HAND, 'cap', [[1, P2a], [2, P2b]]);
  const KS = ['base', 'guarantee', 'variable', 'command', 'role', 'perdiem', 'housing', 'other', 'rest'];
  const MEAN = { base: 10000, guarantee: 0, variable: 4000, command: 1500, role: 250, perdiem: 1000, housing: 300, other: 250, rest: 0 };
  const HOLD = { base: 2, guarantee: 0, variable: 2, command: 2, role: 1, perdiem: 2, housing: 1, other: 2 };
  const shown = KS.slice(0, 8).map((k) => (HOLD[k] >= 2 ? MEAN[k] : 0));
  const uAll = MEAN.rest + KS.slice(0, 8).filter((k) => HOLD[k] < 2).reduce((s, k) => s + MEAN[k], 0);
  await asOwner();
  const pc = (await one(`select public.pv_deep_pct($1::numeric[]) as a`, [`{${[...shown, uAll].join(',')}}`])).a;
  const avg = [];
  for (const k of KS.slice(0, 8)) avg.push(HOLD[k] >= 2 ? await sig2(MEAN[k]) : null);
  avg.push(null);                                       // rest を持つ人は P1 だけ（1人）
  const want = KS.map((k, i) => ({ k, pct: pc[i], avg_usd: avg[i], i })).filter((x) => x.pct > 0)
    .sort((a, b) => b.pct - a.pct || a.i - b.i).map(({ k, pct, avg_usd }) => ({ k, pct, avg_usd }));
  must(uAll === 550 && pc.reduce((s, v) => s + v, 0) === 100, '手で数えた材料が崩れた', J({ uAll, pc }));
  const got = (await comp(SUBMITTER, { airlines: [A_HAND] })).airlines?.[A_HAND];
  ok(got && got.cap && got.cap.s === 'ok' && keys(got.cap) === 's,segs' && canon(got.cap.segs) === canon(want),
    `★2人目で {s:"ok", segs}。segs は手で数えた答えと同じ: ${want.map((x) => `${x.k} ${x.pct}%`).join('・')}`, J({ got: got && got.cap, want }));
  ok(got && got.cap && got.cap.segs && !got.cap.segs.some((x) => x.k === 'role' || x.k === 'housing')
     && got.cap.segs.some((x) => x.k === 'rest' && x.avg_usd === null),
    '★1人しか持たない項目（役割・住宅）は自分の名前で出ず、rest に畳まれる（rest の金額は、持つ人が1人なので null）', J(got && got.cap));
  ok(got && got.cap && got.cap.segs && got.cap.segs.reduce((s, x) => s + x.pct, 0) === 100
     && got.cap.segs.every((x) => keys(x) === 'avg_usd,k,pct' && Number.isInteger(x.pct) && x.pct > 0),
    '割合は正の整数で合計ちょうど100・1項目の鍵は k / pct / avg_usd の3つだけ', J(got && got.cap));
  ok(got && canon(got.fo) === canon({ s: 'few' }), '同じ会社の副操縦士（0人）は {s:"few"}', J(got && got.fo));
  HAND_BEFORE = got;

  /* 入らない月。どれも「入れば平均が動く」額にしてある（3人目の内訳はほかの2人と比が違う）。
     1つずつ「足す直前の答え」と比べる ── ほかの1つが崩れても、その1つの行だけが赤くなる。 */
  const same = async () => canon((await comp(SUBMITTER, { airlines: [A_HAND] })).airlines?.[A_HAND]) === canon(HAND_BEFORE);
  const OTHER = { base_pay: 20000, flight_variable_pay: 1000, other_allowance: 1000, command_pay: 5000 };
  {
    const id = await person(A_HAND, 'cap', [[1, { gross_monthly: 30000 }]]);
    await asOwner();
    const row = await one(`select bool_and(pay_items is null and base_pay is null and guarantee_pay is null and command_pay is null) as gross_only,
                                   count(*)::int as c
                              from public.pay_reports where proof_hash = $1`, [await payKey(id, A_HAND)]);
    must(row && row.c === 1 && row.gross_only === true, '総支給だけの行に内訳が入っている（前提）', J(row));
    ok(await same(), '★総支給だけの月は入らない（金額にも分母にも）');
  }
  await person(A_HAND, 'cap', [[1, { ...OTHER, pay_items: { v: 1, partial: true, variable: [
    { amount: 1000, basis: 'block', label: 'Flight' }, { basis: 'day', label: 'Layover' }] } }]]);
  ok(await same(), '★一部未回答の月（pay_items.partial）は入らない');
  await person(A_HAND, 'cap', [[1, { ...OTHER, gross_monthly: 6000 }]]);
  ok(await same(), '★内訳が総支給をはみ出した月（1.02 倍を超える）は入らない');
  await person(A_HAND, 'cap', [[30, OTHER]]);
  ok(await same(), '★24か月より前の月は入らない（給与の月で見る）');
  await person(A_HAND, 'cap', [[1, { ...OTHER, base_pay: 80000 }]]);
  ok(await same(), '★常識の幅（年 $10,000〜$700,000）の外は入らない');
  await person(A_HAND, 'fo', [[1, OTHER]]);
  ok(await same(), '★副操縦士の月は機長の区分に入らない（職位は月ごと）');
  {
    const rv = await member();
    await db.query(`insert into public.reviews_v2 (proof_hash, airline, "position", annual_salary, culture_score)
                    values (public.pv_review_hash($1::uuid, $2), $2, 'captain', 2000, 4)`, [rv, A_HAND]);
    await db.exec(read('db/pay-rows.sql'));             // 口コミの対応表を埋め直す（db/test-pay-compare.mjs と同じ）
    ok(await same(), '★口コミに書かれた年収は入らない（内訳を持たない）');
  }
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ C4 pv_deep_pay の給与構成と1文字も違わない（会社 × 職位・機材で絞らない）');
// ════════════════════════════════════════════════════════════
/* 比べ方: pv_company_comp の <会社>.<職位> と、pv_deep_pay の comp.segs。
     comp が null（区分が壁に届かない）なら {s:"few"}、在れば {s:"ok", segs: comp.segs} と同じでなければならない。
   pv_deep_pay の相手は2つ ──
     (0段) {airline, position} を手で選ぶ（機材は選ばない ＝ 機材で絞らない。cohort.level は selected）
     (3段) 何も選ばない呼び手の区分が「会社 × 職位」（airline_pos）に落ちる形。呼び手の最新の1行を
           ほかの誰とも機材も機材区分も重ならない行にして、1段・2段を壁の下に置く。 */
const sameAsDeep = (cell, d) => !!d && !d.__err && d.state === 'open'
  && (d.comp == null ? canon(cell) === canon({ s: 'few' })
                     : canon(cell) === canon({ s: 'ok', segs: d.comp.segs }));
/* 見本: A_MIX の機長4人（機材も通貨も混ぜる）と副操縦士2人。
     M1 … USD・a320・2か月。保証手当・住宅・審査の手当つき（未分類 0）
     M2 … JPY・b787・1か月。住宅・審査の手当つき（年収の USD ÷ 円の額 で直す）
     M3 … USD・a320・総支給 20000 と内訳（未分類 5000）
     M4 … USD・b737・総支給だけ（年収の母集団にだけ入り、給与構成には入らない）
   住宅と審査の手当は2人が持つ ＝ 自分の名前で出る（C6 の壊す証明がこれを使う）。 */
{
  await person(A_MIX, 'cap', [
    [1, { base_pay: 8000, guarantee_pay: 1000, flight_variable_pay: 3000, other_allowance: 3300, command_pay: 1500,
          per_diem: 800, housing_type: 'allowance', housing_amount: 700, examiner_pay: 400 }],
    [3, { base_pay: 8200, guarantee_pay: 1000, flight_variable_pay: 3600, other_allowance: 3600, command_pay: 1500,
          per_diem: 1000, housing_type: 'allowance', housing_amount: 700, examiner_pay: 0 }]]);
  await person(A_MIX, 'cap', [
    [2, { currency: 'JPY', fleet: 'b787', base_pay: 1300000, flight_variable_pay: 500000, other_allowance: 520000,
          command_pay: 200000, per_diem: 100000, housing_type: 'allowance', housing_amount: 80000, examiner_pay: 50000 }]]);
  await person(A_MIX, 'cap', [[1, { gross_monthly: 20000, base_pay: 9000, flight_variable_pay: 4000, other_allowance: 4000, command_pay: 2000 }]]);
  await person(A_MIX, 'cap', [[1, { fleet: 'b737', gross_monthly: 18000 }]]);
  await person(A_MIX, 'fo', [[1, { base_pay: 5000, flight_variable_pay: 2000, other_allowance: 2000, per_diem: 500 }]]);
  await person(A_MIX, 'fo', [[2, { base_pay: 6000, flight_variable_pay: 2500, other_allowance: 2600, per_diem: 700, instructor_pay: 300 }]]);
  await person(A_ONE, 'fo', [[1, ONE_DET]]);

  /* 壁に届く区分（selected）と、届かない区分（none ＝ comp は null）の両方を比べる。 */
  const cells = [[A_HAND, 'cap'], [A_HAND, 'fo'], [A_MIX, 'cap'], [A_MIX, 'fo'], [A_ONE, 'fo'], [A_ONE, 'cap'], [A_EMPTY, 'cap']];
  const levels = [];
  for (const [a, pos] of cells) {
    const c = (await comp(OPERATOR, { airlines: [a] })).airlines?.[a]?.[pos];
    const d = await deep(OPERATOR, { airline: a, position: pos });
    levels.push(d && d.cohort && d.cohort.level);
    must(d && d.state === 'open' && d.cohort && d.cohort.manual === true
         && (d.cohort.level === 'selected' ? d.cohort.fleet === null : d.cohort.level === 'none' && d.comp === null),
      `pv_deep_pay が手で選んだ区分（機材なし）で開いていない（${a} / ${pos}）`, J(d && d.cohort));
    ok(sameAsDeep(c, d), `★${a} × ${pos}（0段）: ${c && c.s === 'ok' ? c.segs.map((x) => `${x.k} ${x.pct}%`).join('・') : 'few'} ＝ pv_deep_pay`,
      J({ comp: c, deep: d && d.comp }));
  }
  must(levels.filter((l) => l === 'selected').length >= 3 && levels.includes('none'),
    '比べた区分に、壁に届くもの（3つ以上）と届かないものの両方が無い', J(levels));
  const mixCap = (await comp(OPERATOR, { airlines: [A_MIX] })).airlines?.[A_MIX]?.cap;
  must(mixCap && mixCap.s === 'ok' && mixCap.segs.some((x) => x.k === 'housing') && mixCap.segs.some((x) => x.k === 'role')
       && !mixCap.segs.some((x) => x.k === 'guarantee'),
    'A_MIX の機長に住宅・役割の区分が出ていない／1人しか持たない保証手当が畳まれていない（見本の前提）', J(mixCap));
  ok(canon((await comp(OPERATOR, { airlines: [A_ONE] })).airlines?.[A_ONE]) === canon({ cap: { s: 'few' }, fo: { s: 'few' } }),
    '★内訳を書いた人が1人の副操縦士も {s:"few"}（0人と見分けない）');

  /* 2社を一度に聞いても、1社ずつ聞いたのと同じ */
  const two = await comp(SUBMITTER, { airlines: [A_MIX, A_HAND] });
  const m1 = await comp(SUBMITTER, { airlines: [A_MIX] }), h1 = await comp(SUBMITTER, { airlines: [A_HAND] });
  ok(canon(two.airlines?.[A_MIX]) === canon(m1.airlines?.[A_MIX]) && canon(two.airlines?.[A_HAND]) === canon(h1.airlines?.[A_HAND]),
    '2社を一度に聞いても、1社ずつ聞いたのと同じ答え');
  ok(canon(two) === canon(await comp(OPERATOR, { airlines: [A_MIX, A_HAND] })), '給与を出した会員と運営で同じ答え（誰が読んでも同じ数字）');

  /* (3段) 呼び手（運営）の最新の1行を A_MIX × 機長・crj（機材区分 r）・総支給だけにする。
     ほかの機長は a320・b737（n）と b787（w）＝ 1段・2段は運営1人で壁の下 → 3段（会社 × 職位）に落ちる。
     総支給だけの行なので、給与構成には入らない（年収の母集団にだけ入る）。 */
  await put(OPERATOR, A_MIX, 'cap', 1, { fleet: 'crj', gross_monthly: 21000 });
  const d3 = await deep(OPERATOR);
  must(d3 && d3.state === 'open' && d3.cohort && d3.cohort.level === 'airline_pos', 'pv_deep_pay のはしごが「会社 × 職位」に落ちていない', J(d3 && d3.cohort));
  const c3 = (await comp(OPERATOR, { airlines: [A_MIX] })).airlines?.[A_MIX]?.cap;
  ok(sameAsDeep(c3, d3), '★何も選ばない呼び手のはしごが「会社 × 職位」（3段）に落ちたときの comp.segs とも同じ', J({ comp: c3, deep: d3 && d3.comp }));
  ok(canon(c3) === canon(mixCap), '（呼び手の総支給だけの行は、支給構成を1文字も動かさない）');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ C5 人数・持っている人の数・件数のキーは、どの返事にも無い');
// ════════════════════════════════════════════════════════════
{
  const bad = [];
  const walk = (v, at) => {
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${at}[${i}]`)); return; }
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      if (/people|holders|records|\bn\b|count|^n_|_n$|^nb$|human|months/.test(k)) bad.push(`${at}.${k}`);
      walk(x, `${at}.${k}`);
    }
  };
  SEEN.forEach((v, i) => walk(v, `#${i}`));
  ok(SEEN.length > 20 && bad.length === 0, `★支給構成の口の返事（${SEEN.length}通）のどこにも、人数・件数のキーが無い`, bad.slice(0, 5).join(' '));
  const segKeys = new Set(SEEN.flatMap((v) => Object.values(v?.airlines || {}).flatMap((a) => Object.values(a || {})))
    .flatMap((c) => (c && c.segs ? c.segs.map((x) => x.k) : [])));
  ok([...segKeys].every((k) => ['base', 'guarantee', 'variable', 'command', 'role', 'perdiem', 'housing', 'other', 'rest'].includes(k)) && segKeys.size >= 6,
    'segs の k は base・guarantee・variable・command・role・perdiem・housing・other・rest のどれか（pv_deep_pay の cseg と同じ9つ）', J([...segKeys]));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ C6 下ろした人（pay_hidden）は入らない（pv_deep_pay とは違う・わざと）／壊す証明');
// ════════════════════════════════════════════════════════════
{
  /* 会社ページの中央値（db/pay-median.sql の約束 7）と同じ。2人の区分に残すと、一覧に出ているもう1人の内訳から割り戻せる。 */
  const id = await person(A_HAND, 'cap', [[1, { base_pay: 20000, flight_variable_pay: 1000, other_allowance: 1000, command_pay: 5000 }]]);
  const moved = (await comp(SUBMITTER, { airlines: [A_HAND] })).airlines?.[A_HAND];
  must(canon(moved) !== canon(HAND_BEFORE), '下ろす前のこの人が数に入っていない（前提）', J(moved));
  await asOwner();
  const hk = await payKey(id, A_HAND);
  must((await one(`select count(*)::int as c from public.pay_reports where proof_hash = $1`, [hk])).c === 1, '下ろす人の行の鍵を作れていない');
  await db.query(`insert into public.pay_hidden (proof_hash, reason) values ($1, '本人の依頼') on conflict (proof_hash) do nothing`, [hk]);
  ok(canon((await comp(SUBMITTER, { airlines: [A_HAND] })).airlines?.[A_HAND]) === canon(HAND_BEFORE), '★下ろした人は入らない（給与を出した会員が呼んだとき）');
  ok(canon((await comp(OPERATOR, { airlines: [A_HAND] })).airlines?.[A_HAND]) === canon(HAND_BEFORE), '★運営が呼んでも下ろした人は入らない');
  const dh = await deep(OPERATOR, { airline: A_HAND, position: 'cap' });
  ok(dh && dh.comp && canon({ s: 'ok', segs: dh.comp.segs }) === canon(moved.cap),
    '（比べる相手の pv_deep_pay は、下ろした人も数えたまま ── 違いはこの1つだけ・わざと）', J({ deep: dh && dh.comp && dh.comp.segs, moved: moved.cap }));

  /* 壊す証明: 係数を1つ変えた版（住宅手当を数えない）を begin … rollback の中でだけ入れる（ファイルは触らない）。
     A_MIX の機長は住宅を2人が持つので、pv_deep_pay と同じ答えにならなくなる ＝ C4 の比べ方が捕まえる。 */
  const src = read(MINE);
  const a = src.indexOf('create or replace function public.pv_company_comp(');
  const fsrc = a < 0 ? '' : src.slice(a, src.indexOf('$fn$;', a) + '$fn$;'.length);
  const HOUSE = `then coalesce(r.housing_amount, 0) else 0 end          as a_house,`;
  const broken = fsrc.replace(HOUSE, () => `then 0 else 0 end          as a_house,`);
  ok(fsrc.split(HOUSE).length === 2 && broken !== fsrc, '（pv_company_comp の住宅手当の1行を見つけた）');
  const before = (await comp(OPERATOR, { airlines: [A_MIX] })).airlines?.[A_MIX]?.cap;
  const dm = await deep(OPERATOR, { airline: A_MIX, position: 'cap' });
  must(sameAsDeep(before, dm), '壊す前に同じ答えになっていない（前提）', J({ before, deep: dm && dm.comp }));
  await asOwner(); await db.exec(`begin`);
  await db.exec(broken);
  const bc = (await comp(OPERATOR, { airlines: [A_MIX] })).airlines?.[A_MIX]?.cap;
  const bd = await deep(OPERATOR, { airline: A_MIX, position: 'cap' });
  await asOwner(); await db.exec(`rollback`);
  ok(!sameAsDeep(bc, bd) && bc && bc.s === 'ok' && !bc.segs.some((x) => x.k === 'housing'),
    '★壊した版（住宅手当を数えない）なら、pv_deep_pay と同じ答えにならない（C4 の比べ方が捕まえる）', J({ broken: bc, deep: bd && bd.comp && bd.comp.segs }));
  ok(sameAsDeep((await comp(OPERATOR, { airlines: [A_MIX] })).airlines?.[A_MIX]?.cap, await deep(OPERATOR, { airline: A_MIX, position: 'cap' })),
    '（巻き戻したあと: 本物は同じ答え）');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ C7 実行権・本文（門の写しを持たない・読まない表）');
// ════════════════════════════════════════════════════════════
{
  const priv = await one(`
    select has_function_privilege('anon', 'public.pv_company_comp(jsonb)', 'execute') as c_anon,
           has_function_privilege('authenticated', 'public.pv_company_comp(jsonb)', 'execute') as c_auth,
           exists (select 1 from pg_proc q, lateral aclexplode(coalesce(q.proacl, acldefault('f', q.proowner))) a
                    where q.oid = 'public.pv_company_comp(jsonb)'::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE') as c_public,
           (select prosecdef from pg_proc where oid = 'public.pv_company_comp(jsonb)'::regprocedure) as sd,
           (select provolatile from pg_proc where oid = 'public.pv_company_comp(jsonb)'::regprocedure) as vol`);
  ok(priv.c_anon === false && priv.c_auth === true && priv.c_public === false, '★呼べるのはログイン済みだけ（未ログイン・PUBLIC には渡っていない）', J(priv));
  ok(priv.sd === true && priv.vol === 's', 'security definer・stable（読むだけ）', J(priv));
  const def = (await one(`select pg_get_functiondef('public.pv_company_comp(jsonb)'::regprocedure) as s`)).s;
  const body = def.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
  ok(/public\.pv_work_level\(\) is distinct from 'pay'/.test(body)
     && !/access_until|pv_deep_launch|pv_my_give|pv_deep_missing|pv_deep_contributors|pv_is_operator|pv_proof_blocked|auth\.uid/.test(body),
    '★門は pv_work_level の1か所（pv_deep_pay の門・鍵の列・止める仕組みを写していない）');
  ok(!/reviews_v2|pv_review_person|pay_reports_pending|fx_rates|pv_pay_comp|pv_pct5|pv_pending_comp/.test(body),
    '口コミ・預かり・為替表・旧 pv_pay_comp を読まない（給与構成は本棚の行が自分で持つ比だけで直す）');
  ok(!/\b(insert|update|delete|truncate)\b/i.test(body), '本文に書き込む命令が1つも無い');
  /* 写しの字の突き合わせ（動きは C4 が見ている。ここは「同じ字で写した」を名指しで見る）。 */
  const dp = (await one(`select pg_get_functiondef('public.pv_deep_pay(jsonb)'::regprocedure) as s`)).s;
  const norm = (s) => s.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ');
  const [nb, nd] = [norm(def), norm(dp)];
  const FRAG = [
    'and (s.a_base + s.a_gtee + s.a_var + s.a_cmd + s.a_role + s.a_pd + s.a_house + s.a_other) <= s.cash_m * 1.02) as okb',
    'greatest(coalesce(r.other_allowance, 0) - coalesce(r.flight_variable_pay, 0), 0) + coalesce(r.transport, 0) as a_other',
    'where t.okb and t.det and not t.part and t.ann_o is not null and t.ann_o > 0',
    "unnest(array['base','guarantee','variable','command','role', 'perdiem','housing','other','rest'],",
    'order by t.p desc, t.i',
    'v_min constant int := 2;',
    "v_from constant date := (date_trunc('month', now()) - interval '23 months')::date;",
  ];
  const miss = FRAG.filter((f) => !nb.includes(f) || !nd.includes(f));
  ok(miss.length === 0, `★写しの要の${FRAG.length}か所が、pv_deep_pay と同じ字（検品の 1.02・命綱の引き算・使える月の線・並び・壁・窓）`, miss.join(' | '));
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
