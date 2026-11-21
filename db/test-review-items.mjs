/* db/review-items.sql と db/reviews-gate.sql 3-d を本物の Postgres（PGlite = PG17 の WASM ビルド）に流して確かめる。

   実行: node db/test-review-items.mjs
   ネットワーク不要・本番に一切触らない。流す SQL の並びは serve-local.mjs の SQL_FILES を**そのまま読む**。

   ここでいちばん大事なこと（2026-11-20 オーナー決定「書いた項目は、全社ぶん読める。7項目書けば全部読める。」）:
     ★ 板で書いた項目だけ、全社の口コミのその項目が読める。書いていない項目の本文・訳は1文字も返らない。
     ★ 7項目そろうと全部読める（鍵 pv_has_review_key が開く）。
     ★ フォームで出した口コミ・前からある口コミは、今までどおり1件で全部読める。
     ★ 板は7日に1回・待遇の板と同じ日に出さない（両方向）・全部読める人には出さない・自分で押したら待たない。
     ★ 1項目40字以上・その会社の自分の口コミは1件だけ（書き足していく）・本文が変わったら訳を消す。
     ★ AI が保留にした口コミで書いた項目は数えない。
     ★ ほかの人のことを返さない（板の答えに人数も件数も無い）。
     ★ 壊す証明：守りの1行を外すと、名指しした検査が赤くなる。

   ⚠️ ここに出てくる会員・口コミは全部作り物（crew1@example.com など）。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import { SQL_FILES } from '../serve-local.mjs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const MINE = 'db/review-items.sql';
const FILES = SQL_FILES.includes(MINE) ? [...SQL_FILES] : [...SQL_FILES, MINE];

const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;
await db.exec(`set timezone = 'UTC'`);

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };
const J = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x) : x));

// ── 器（db/test-ask-own-airline.mjs と同じ）──────────────────────
const BOOT = `
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
    culture_score integer not null, salary_score integer not null, benefits_score integer not null,
    wlb_score integer not null, ops_score integer not null, training_score integer not null, mgmt_score integer,
    culture_comment text, salary_comment text, benefits_comment text,
    wlb_comment text, ops_comment text, training_comment text, mgmt_comment text,
    orig_lang text, translations jsonb,
    created_at timestamptz not null default now());
  alter table public.reviews_v2 enable row level security;
  revoke all on public.reviews_v2 from anon;
  create policy reviews_v2_insert_member on public.reviews_v2
    for insert to authenticated with check (true);
`;
/* ★点数の6列に NOT NULL を付けて立てる（本番の表はダッシュボードで作られていて、付いているかもしれない）。
     db/review-items.sql の 0. が外す ── 外れなければ、1項目だけの口コミが入らない（下の ▼1 が赤くなる）。 */
await db.exec(BOOT);

console.log('\n▼ SQL の適用（本番に貼る順）');
for (const f of FILES) {
  try { await db.exec(read(f)); } catch (e) { ok(false, f, e.message); process.exit(1); }
}
ok(true, `${FILES.length} 本を流せた（${MINE} まで）`);
for (const f of FILES) {
  try { await db.exec(read(f)); } catch (e) { ok(false, f + ' 再適用で失敗', e.message); }
}
ok(true, '2回目も全部流せた（冪等）');

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
const rpc = async (who, fn, p) => {
  const r = p === undefined
    ? await call(who, `select public.${fn}() as v`)
    : await call(who, `select public.${fn}($1::jsonb) as v`, [J(p)]);
  return r.err ? { __err: r.err } : r.v.v;
};
const one  = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const many = async (sql, params = []) => (await db.query(sql, params)).rows;

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let seat = 0;
const member = async (pos = null) => {
  const id = uid(++seat), mail = `crew${seat}@example.com`;
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, mail]);
  await db.query(`insert into public.profiles (id, email) values ($1, $2) on conflict (id) do nothing`, [id, mail]);
  if (pos) await db.query(`update public.profiles set "position" = $2 where id = $1`, [id, pos]);
  return id;
};
const CATS = ['culture', 'salary', 'benefits', 'wlb', 'ops', 'training', 'mgmt'];
/* 項目ごとに見分けのつく本文（40字を超える・字の種類も多い）。印 【誰-項目】 で、どの本文が返ったかを見る。 */
const T = (who, cat) => `【${who}-${cat}】乗務手当で手取りに波がある。夏の繁忙期は乗務が増えて手取りが上がるが、冬は基本給だけに近い月もある。`;
/* フォームで出したのと同じ形の口コミ（6つの評価・7項目に本文）。書きかけの印は付かない。 */
const formReview = async (u, airline, tag, extra = {}) => {
  const cols = { proof_hash: null, airline, position: 'fo' };
  for (const k of CATS) { cols[k + '_score'] = 4; cols[k + '_comment'] = T(tag, k); }
  Object.assign(cols, extra);
  const ks = Object.keys(cols).filter((k) => k !== 'proof_hash');
  await db.query(`insert into public.reviews_v2 (proof_hash, ${ks.map((k) => `"${k}"`).join(', ')})
                  values (public.pv_review_hash($1::uuid, $2), ${ks.map((_, i) => '$' + (i + 3)).join(', ')})`,
    [u, airline, ...ks.map((k) => cols[k])]);
  return (await one(`select id from public.reviews_v2 where proof_hash = public.pv_review_hash($1::uuid, $2)`, [u, airline])).id;
};
const item = (u, airline, cat, text, extra = {}) =>
  rpc(u, 'submit_review_item', { airline, position: 'fo', cat, score: 3, comment: text, ...extra });
const board = (u, p = {}) => rpc(u, 'pv_review_board', p);
const list = (u, p = { limit: 500 }) => rpc(u, 'pv_reviews', p);
const keyOf = async (u) => (await call(u, `select public.pv_has_review_key() as v`)).v?.v;
const rowOf = (u, airline) => one(`select * from public.reviews_v2 where proof_hash = public.pv_review_hash($1::uuid, $2)`, [u, airline]);
const isPartial = async (id) => !!(await one(`select 1 x from public.pv_review_partial where rid = $1`, [id]));
const resetDay = () => db.exec(`update public.profiles set review_items_today = 0`);

/* 読む側の目印：返事の中に誰のどの項目の本文が入っているか（訳文も含めて全部の字を見る）。 */
const marks = (res) => [...new Set((J(res).match(/【[^】]+】/g) || []))].sort();

// ════════════════════════════════════════════════════════════
console.log('\n▼ 0. 準備：フォームで出した人（全部読める）と、まだ何も出していない人');
// ════════════════════════════════════════════════════════════
const W1 = await member('captain');          // ほかの人の口コミ（フォーム）
const W1R = await formReview(W1, 'jal', 'W1', { translations: J({ en: Object.fromEntries(CATS.map((k) => [k, `[en:W1-${k}] translated text`])) }), orig_lang: 'ja' });
const W2 = await member('fo');
await formReview(W2, 'ana', 'W2');
ok(await keyOf(W1) === true && !(await isPartial(W1R)), 'フォームで出した口コミは書きかけではない ＝ 今までどおり全部読める');

const A = await member('fo');                // 板で書いていく人
const C = await member('captain');           // 給与も口コミも無い人（会社を板で選ぶ）
ok(await keyOf(A) === false, '何も出していない人は鍵が閉じている');

// ════════════════════════════════════════════════════════════
console.log('\n▼ 1. 1項目ずつ保存する');
// ════════════════════════════════════════════════════════════
{
  const short = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよら';   // 39字
  ok((await item(A, 'ana', 'salary', short)).why === 'short', '39字は受け取らない（short）', String(short.length));
  ok((await item(A, 'ana', 'salary', short + 'るれろ'.repeat(87) + 'わ')).why === 'long', '301字は受け取らない（long）');
  ok((await item(A, 'ana', 'salary', 'あ'.repeat(20) + 'い'.repeat(20))).why === 'quality', '字の種類が少なすぎる文は受け取らない（quality）');
  ok((await item(A, 'ana', 'pay', T('A', 'salary'))).why === 'cat', '7項目に無い名前は受け取らない（cat）');
  ok((await item(A, 'ana', 'salary', T('A', 'salary'), { score: 6 })).why === 'score', '評価は1〜5だけ（score）');
  ok((await item(A, 'other', 'salary', T('A', 'salary'))).why === 'airline', '一覧に無い会社（other）は受け取らない');
  ok((await item(A, 'ana', 'salary', T('A', 'salary'), { position: 'cap' })).why === 'position', '職位は captain / fo だけ');
  ok(!!(await rpc(ANON, 'submit_review_item', { airline: 'ana', position: 'fo', cat: 'salary', score: 3, comment: T('x', 'salary') })).__err,
     '未ログインは呼べない');
  await resetDay();

  const r = await item(A, 'ana', 'salary', T('A', 'salary'));
  const row = await rowOf(A, 'ana');
  ok(r.ok === true && J(r.done) === J(['salary']) && J(r.open) === J(['salary']) && r.full === false,
     '1項目を保存できる（点数の列に NOT NULL が付いた表でも入る）', J(r));
  ok(row && row.salary_comment === T('A', 'salary') && row.salary_score === 3 && row.culture_comment === null && row.culture_score === null,
     '書いた項目だけが入り、ほかは空のまま');
  ok(await isPartial(row.id), '板で書き始めた口コミには書きかけの印が付く');
  ok(await keyOf(A) === false, '1項目では鍵（7項目ぜんぶ）は開かない');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 2. 書いた項目は、全社ぶん読める（書いていない項目は1文字も返らない）');
// ════════════════════════════════════════════════════════════
{
  const res = await list(A);
  const w1 = res.rows.find((x) => x.airline === 'jal');
  ok(res.unlocked === false && J(res.open) === J(['salary']), '返事の open ＝ 読める項目', J(res.open));
  ok(w1 && w1.salary_comment === T('W1', 'salary') && w1.culture_comment === undefined && w1.mgmt_comment === undefined,
     'ほかの人の口コミの「給与」は全文が返る・ほかの項目は返らない');
  ok(w1 && J(w1.translations) === J({ en: { salary: '[en:W1-salary] translated text' } }), '訳文も読める項目の分だけ');
  ok(w1 && J(w1.open) === J(['salary']) && J(w1.cats) === J(CATS) && w1.clip && w1.clip.k === 'culture',
     '行には印 open・書いた項目の一覧 cats・先頭の抜粋 clip が付く（画面が錠前を描ける）');
  ok(w1 && w1.id === undefined && w1.proof_hash === undefined, '番号（id）と proof_hash は返らない');
  const mk = marks(res).filter((m) => m.startsWith('【W'));
  ok(mk.every((m) => m.endsWith('-salary】') || m.endsWith('-culture】')),
     'ほかの人の本文で返るのは「給与」と、先頭80字の抜粋（企業文化）だけ', mk.join(' '));

  const anon = await list(ANON);
  ok(marks(anon).filter((m) => m.startsWith('【W')).every((m) => m.endsWith('-culture】')) && anon.open.length === 0,
     '未ログインには今までどおり抜粋（先頭の1欄）だけ');

  const mine = await list(A, { mine: true });
  ok(mine.rows.length === 1 && mine.rows[0].salary_comment === T('A', 'salary') && !!mine.rows[0].id,
     '自分の口コミ（mine）には、書いた本文が id 付きで返る');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 3. 書き直し・訳・7項目そろう');
// ════════════════════════════════════════════════════════════
{
  const row0 = await rowOf(A, 'ana');
  await db.query(`update public.reviews_v2 set translations = '{"en":{"salary":"x"}}', orig_lang = 'ja' where id = $1`, [row0.id]);
  await item(A, 'ana', 'salary', T('A', 'salary'), { score: 5 });
  let row = await rowOf(A, 'ana');
  ok(row.salary_score === 5 && row.translations !== null, '本文が同じなら訳は残す（点数だけ書き換わる）');
  await item(A, 'ana', 'salary', T('A', 'salary') + '賞与は業績次第。');
  row = await rowOf(A, 'ana');
  ok(row.translations === null && row.id === row0.id, '本文が変わったら訳を消す（同じ口コミのまま・1社1件）');
  ok((await many(`select 1 from public.reviews_v2 where proof_hash = public.pv_review_hash($1::uuid, 'ana')`, [A])).length === 1,
     'その会社の自分の口コミは1件のまま');
  ok((await item(A, 'ana', 'wlb', ' ' + T('A', 'salary').toUpperCase() + '賞与は業績次第。 ')).why === 'copy',
     '同じ文を別の項目に貼り回すのは受け取らない（copy）');

  let last;
  for (const k of ['wlb', 'benefits', 'training', 'ops', 'culture']) last = await item(A, 'ana', k, T('A', k));
  ok(last.ok && last.done.length === 6 && last.full === false && await keyOf(A) === false, '6項目ではまだ全部は読めない');
  const six = await list(A);
  ok(J(six.open) === J(['culture', 'salary', 'benefits', 'wlb', 'ops', 'training'])
     && six.rows.find((x) => x.airline === 'jal').mgmt_comment === undefined, '6項目なら6項目だけ（経営陣への提案はまだ読めない）');
  last = await item(A, 'ana', 'mgmt', T('A', 'mgmt'));
  row = await rowOf(A, 'ana');
  ok(last.full === true && J(last.open) === J(CATS) && await keyOf(A) === true && !(await isPartial(row.id)),
     '7項目そろうと書きかけの印が外れ、全部読める（鍵が開く）', J(last));
  const all = await list(A);
  ok(all.unlocked === true && all.rows.find((x) => x.airline === 'jal').mgmt_comment === T('W1', 'mgmt'), '一覧も全部返る');
  ok((await board(A)).why === 'done', '全部読める人には板を出さない');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 4. 板を出すか（7日に1回・待遇の板と同じ日に出さない）');
// ════════════════════════════════════════════════════════════
{
  ok((await board(ANON)).__err !== undefined || (await board(ANON)).why === 'login', '未ログインには出さない');
  ok((await board(W1)).why === 'done', 'フォームで出した人には出さない');

  const b = await board(C);
  ok(b.due === true && b.airline === null && b.position === 'captain' && J(b.done) === '[]',
     '給与も口コミも無い人：会社は空（板が聞く）・職位は登録のときの職位', J(b));
  ok(J(b.order) === J(['salary', 'wlb', 'benefits', 'training', 'ops', 'culture', 'mgmt']), '聞く順は給与から');
  ok(!J(b).match(/"n"|count|people|人数/), '人数・件数は返さない');

  /* 給与を出した人には、会社を聞かない（給与の会社がそのまま入る）。本物の submit_pay_report を通す。 */
  const P2 = await member('fo');
  const FLEET = (await one(`select code from public.pv_fleets where active order by code limit 1`)).code;
  const NOW = await one(`select extract(year from current_date)::int as y, extract(month from current_date)::int as m`);
  await db.query(`select set_config('pv.uid', $1, false)`, [P2]);
  try {
    await db.query(`select public.submit_pay_report($1::jsonb)`, [J({
      currency: 'USD', lang: 'en', tax_rate_pct: 0, position: 'cap', fleet: FLEET, airline: 'ana',
      period_year: NOW.m === 1 ? NOW.y - 1 : NOW.y, period_month: NOW.m === 1 ? 12 : NOW.m - 1,
      base_pay: 9000, flight_variable_pay: 4000, other_allowance: 4400 })]);
  } catch (e) { ok(false, '（準備が崩れた）給与を出せなかった', String(e.message || e)); }
  finally { await asOwner(); await db.exec(`update public.profiles set pay_reports_today = 0`); }
  const bp = await board(P2);
  ok(bp.due === true && bp.airline === 'ana' && bp.position === 'captain' && bp.name_ja,
     '給与を出した人：会社は給与の会社（板は会社を聞かない）・職位も給与の職位', J(bp));

  const B = await member('fo');
  await item(B, 'skymark', 'wlb', T('B', 'wlb'));
  const bb = await board(B);
  ok(bb.due === true && bb.airline === 'skymark' && bb.position === 'fo' && J(bb.done) === J(['wlb']) && bb.name_ja,
     '書きかけの口コミがあれば、その会社と書いた項目を返す', J(bb));

  await rpc(B, 'pv_review_board_seen');
  const w = await board(B);
  ok(w.due === false && w.why === 'wait', '板を開いたら7日は出さない');
  const days = (await one(`select extract(epoch from ($1::timestamptz - now())) / 86400 as d`, [w.next_at])).d;
  ok(days > 6.9 && days <= 7, '次は7日後', String(days));
  ok((await board(B, { manual: true })).due === true, '自分で押して開いた板（manual）は7日を待たない');
  const again = await rpc(B, 'pv_review_board_seen');
  ok(J(again.next_at) === J(w.next_at), '窓の中でもう一度開いても、窓は延びない');

  await db.query(`update public.profiles set review_prompt_at = now() - interval '8 days', ask_prompt_at = now() - interval '2 hours' where id = $1`, [B]);
  const g = await board(B);
  ok(g.due === false && g.why === 'wait', '待遇の板を開いてから24時間は出さない');
  await db.query(`update public.profiles set ask_prompt_at = now() - interval '25 hours' where id = $1`, [B]);
  ok((await board(B)).due === true, '24時間を過ぎたら出す');

  /* 逆向き：口コミの板を開いた日は、待遇の板も出さない（db/ask-own-airline.sql の pv_ask_next） */
  await db.query(`update public.profiles set ask_prompt_at = null, review_prompt_at = now() - interval '1 hour' where id = $1`, [W1]);
  const ask1 = await rpc(W1, 'pv_ask_next', {});
  await db.query(`update public.profiles set review_prompt_at = now() - interval '25 hours' where id = $1`, [W1]);
  const ask2 = await rpc(W1, 'pv_ask_next', {});
  ok(ask1.why === 'wait' && ask2.why !== 'wait', '口コミの板を開いてから24時間は、待遇の板も出さない', J([ask1.why, ask2.why]));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 5. AI が保留にした口コミで書いた項目は数えない／2社に書いても1人ぶん');
// ════════════════════════════════════════════════════════════
{
  const H = await member('fo');
  await item(H, 'zipair', 'salary', T('H', 'salary'));
  const hr = await rowOf(H, 'zipair');
  await db.query(`insert into public.pv_review_judge (src, rid, body_sha, lang, verdict, reason, judged_at)
                  values ('r', $1, 'x', 'ja', 'hold', 'other', now())`, [hr.id]);
  const hl = await list(H);
  ok(J(hl.open) === '[]' && !marks(hl).some((m) => m.endsWith('-salary】')), '保留中の口コミで書いた項目では読めない', J(hl.open));
  await db.query(`update public.pv_review_judge set decided = 'show', decided_at = now() where rid = $1`, [hr.id]);
  ok(J((await list(H)).open) === J(['salary']), '運営が載せたら読める');

  const M = await member('fo');
  await item(M, 'peach', 'salary', T('M', 'salary'));
  await item(M, 'jetstar-japan', 'wlb', T('M', 'wlb'));
  ok(J((await list(M)).open) === J(['salary', 'wlb']), '2社に書いた項目は合わせて読める');

  await db.query(`update public.profiles set review_items_today = 30, review_items_day = current_date where id = $1`, [M]);
  ok((await item(M, 'peach', 'benefits', T('M', 'benefits'))).why === 'limit', '1日30回まで');
  await resetDay();
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 6. 書きかけの口コミを、フォームで出し切る');
// ════════════════════════════════════════════════════════════
{
  const F = await member('fo');
  await item(F, 'starflyer', 'salary', T('F', 'salary'));
  const form = { airline: 'starflyer', position: 'captain' };
  for (const k of CATS) { form[k + '_score'] = '4'; form[k + '_comment'] = k === 'mgmt' ? '' : T('F', k); }
  ok(!!(await rpc(F, 'submit_review_finish', { ...form, culture_comment: '短い', salary_comment: '短い', benefits_comment: '', wlb_comment: '', ops_comment: '', training_comment: '' })).__err,
     'フォームの決まり（合計300字）に足りなければ止める');
  ok((await rpc(F, 'submit_review_finish', { ...form, airline: 'ibex' })).why === 'none', 'その会社の書きかけの口コミが無ければ none（フォームは今までどおり新しく入れる）');
  const r = await rpc(F, 'submit_review_finish', form);
  const row = await rowOf(F, 'starflyer');
  ok(r.ok === true && !(await isPartial(row.id)) && await keyOf(F) === true && row.position === 'captain' && row.mgmt_comment === null,
     '出し切ると書きかけの印が外れ、全部読める（フォームで1件出したのと同じ）', J(r));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 7. 検算（db/review-items.sql の末尾）');
// ════════════════════════════════════════════════════════════
{
  const src = read(MINE);
  const q = src.slice(src.indexOf('-- ── 検算'));
  const res = await db.exec(q);
  const rows = res[res.length - 1].rows;
  ok(rows.length === 6 && rows.every((x) => String(x['結果']).startsWith('✅')), '6行とも ✅', J(rows.filter((x) => !String(x['結果']).startsWith('✅'))));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 8. 壊す証明（守りの1行を外すと赤くなる・貼り直すと戻る）');
// ════════════════════════════════════════════════════════════
{
  const GATE = read('db/reviews-gate.sql');
  const ITEMS = read(MINE);
  const P = await member('fo');
  await item(P, 'airdo', 'salary', T('P', 'salary'));

  // a) 書きかけの印を付けないと、1項目で全部読めてしまう
  const cutA = ITEMS.replace(/\n\s*insert into public\.pv_review_partial \(rid\) values \(v_id\) on conflict \(rid\) do nothing;/, () => '');
  ok(cutA !== ITEMS, '（準備）書きかけの印を付ける1行を見つけた');
  await db.exec(cutA);
  const Q = await member('fo');
  await item(Q, 'solaseed', 'salary', T('Q', 'salary'));
  ok(await keyOf(Q) === true, '★壊す証明：書きかけの印を付けないと、1項目で全部読めてしまう');
  await db.exec(ITEMS);

  // b) 読める項目の本文を戻さないと、書いた項目も読めない
  const cutB = GATE.replace(/ - 'id' \|\| public\.pv_review_open_part\(pick\.j, v_cats\) end\)/, () => " - 'id' end)");
  ok(cutB !== GATE, '（準備）一覧に読める項目を戻す1行を見つけた');
  await db.exec(cutB);
  ok(!marks(await list(P)).includes('【W1-salary】'), '★壊す証明：その1行を外すと、書いた「給与」もほかの人の分が読めない');
  await db.exec(GATE);
  ok(marks(await list(P)).includes('【W1-salary】'), '　貼り直すと読める');

  // c) 読める項目を絞らないと（全部の本文を戻すと）、書いていない項目まで読めてしまう
  const cutC = GATE.replace(/\|\| public\.pv_review_open_part\(pick\.j, v_cats\) end\)/, () => "|| public.pv_review_open_part(pick.j, public.pv_review_keys()) end)");
  await db.exec(cutC);
  ok(marks(await list(P)).includes('【W1-mgmt】'), '★壊す証明：読める項目で絞らないと、書いていない「経営陣への提案」まで出る（上の ▼2 はこれを赤にする）');
  await db.exec(GATE);
  ok(!marks(await list(P)).includes('【W1-mgmt】'), '　貼り直すと出ない');

  // d) 待遇の板との間隔を見ないと、同じ日に2枚出る
  const cutD = ITEMS.replace(/,\n\s*pr\.ask_prompt_at\s*\+ public\.pv_board_gap\(\)\)/, () => ')');
  ok(cutD !== ITEMS, '（準備）待遇の板との間隔を見る1行を見つけた');
  await db.exec(cutD);
  await db.query(`update public.profiles set review_prompt_at = null, ask_prompt_at = now() - interval '1 hour' where id = $1`, [P]);
  ok((await board(P)).due === true, '★壊す証明：その1行を外すと、待遇の板を開いた日に口コミの板も出る');
  await db.exec(ITEMS);
  ok((await board(P)).due === false, '　貼り直すと出ない');
}

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
