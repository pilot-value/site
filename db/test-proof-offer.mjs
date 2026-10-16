/* db/test-proof-offer.mjs — 自分から出す画像（申請）とオーナーの verified を PGlite で見る（2026-10-16）。

   実行: node db/test-proof-offer.mjs      （全部 ✅ で exit 0。手で流す検査 ── check.mjs には入れない）
   見ている5つの約束（オーナーの 2026-10-16 の答え）
     1 申請は何も止めない（REAL PAY・DEEP PAY・口コミ本文・ホテルの追加・いま見られているもの）
     2 申請してきた人は、画像が無ければ verified にならない（画像の無い申請は作れない）
     3 一覧・画像・verified はサーバで「設定したオーナー」だけ。ほかの運営・会員・未ログインは何も分からない
     4 パイロットの確認（pv_proof の approved）・運営の名簿・給与・印では開かない／verified は proof を approved にしない
     5 決めた瞬間に画像は消える（申請の行も）
   ＋ db/proof-store.sql が main の切り出しそのままか（指紋）。main を取り込んだあと（db/pilot-proof.sql が在る）は、
     db/proof-store.sql が消えていること・main の運営の入口が申請を見せないこと、を見る。
   ⚠️ 会員を名指しで書かない。ここの人は全員、作り物の uuid。 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const has = (f) => existsSync(new URL('../' + f, import.meta.url));
const MERGED = has('db/pilot-proof.sql');          // main を取り込んだあと

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };
const J = (v) => JSON.stringify(v);

/* ── 0. main の切り出しそのままか（指紋。main 05c7f2f の文から取った） ── */
const SLICES = [
  { id: 'P1', file: 'db/pay-rows.sql',    from: 'create table if not exists public.pv_proof (', to: '\n);\n',
    sha: 'f5b7fe9d88bcb67d00a0208c8c48d1d17be369e3ed7a73d49b46a908d9949bce' },
  { id: 'P2', file: 'db/pay-rows.sql',    from: 'alter table public.pv_proof enable row level security;', to: "security definer の中からしか読めない。';\n",
    sha: '4f51fda14d3d13ab15e43f5933fe772c72c7031115e6c44e2426ef7f52b96272' },
  { id: 'I',  file: 'db/pilot-proof.sql', from: '-- ── 1. 画像（1人につき1枚）', to: 'revoke all on function public.pv_proof_image_guard_tg() from public, anon, authenticated;\n',
    sha: 'ef2b739f931ca7292d271a10eba134fe6433eb2ea6e15292e5fce16afc969909' },
];
const cut = (text, s) => { const i = text.indexOf(s.from); if (i < 0 || text.indexOf(s.from, i + 1) >= 0) return null;
                            const j = text.indexOf(s.to, i); return j < 0 ? null : text.slice(i, j + s.to.length); };
const sha = (t) => createHash('sha256').update(t, 'utf8').digest('hex');
console.log('\n▼ 0. 画像の置き場は main の定義そのまま');
if (!MERGED) {
  const st = read('db/proof-store.sql');
  for (const s of SLICES) ok(cut(st, s) && sha(cut(st, s)) === s.sha, `db/proof-store.sql の ${s.id} は main:${s.file} の切り出しと1文字も違わない`);
  const code = st.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '');
  ok(!/pv_proof_state_ck/.test(code), 'db/proof-store.sql は状態の制約を持ってこない（決めるのは db/proof-offer.sql の 1.）');
  const made = (code.match(/create or replace function public\.(\w+)/g) || []).map((x) => x.split('.')[1]);
  ok(J(made) === J(['pv_proof_discard_tg', 'pv_proof_image_guard_tg']) && !/create (or replace )?function|create trigger (?!pv_proof_(discard|image_guard)\b)/.test(code.replace(/create or replace function public\.pv_proof_(discard|image_guard)_tg/g, '')),
     'db/proof-store.sql が作る関数は main の2つの引き金だけ（止める仕組み・止まった会員の入口・運営の入口・検算は持ってこない）', J(made));
} else {
  ok(!has('db/proof-store.sql'), '★main を取り込んだら db/proof-store.sql は消してある（同じ表を2か所で作らない）');
  for (const s of SLICES) ok(cut(read(s.file), s) && sha(cut(read(s.file), s)) === s.sha,
     `main の ${s.file} の ${s.id} は、db/proof-offer.sql が前提にした形のまま（変わっていたら proof-offer.sql を見直す）`);
}

/* ── 器 ── */
const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  grant usage on schema public, extensions to anon, authenticated;
  grant usage on schema auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
  create table public.profiles (
    id uuid primary key, email text, name text,
    gender text, birthdate date, country text, company text, "position" text
  );
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
                    nullif(current_setting('request.jwt.claims', true), ''))::jsonb $$;
  create table public.reviews_v2 (
    id uuid primary key default gen_random_uuid(),
    proof_hash text not null, airline text not null, "position" text,
    tenure_bucket text, age_bucket text, fleet text, job_role text,
    monthly_salary integer, bonus integer, annual_salary integer,
    base_annual integer, flight_allowance_annual integer,
    culture_score integer, salary_score integer, benefits_score integer,
    wlb_score integer, ops_score integer, training_score integer, mgmt_score integer,
    culture_comment text, salary_comment text, benefits_comment text,
    wlb_comment text, ops_comment text, training_comment text, mgmt_comment text,
    orig_lang text, translations jsonb,
    created_at timestamptz not null default now()
  );
`);

const FILES = ['db/airlines.generated.sql', 'db/vocab.generated.sql', 'db/schema-additions.sql',
               'db/pay-reports.sql', 'db/pay-report-pending.sql', 'db/pay-rows.sql', 'db/admin.sql',
               'db/reviews-gate.sql', 'db/deep-pay.sql',
               ...(MERGED ? ['db/pilot-proof.sql'] : ['db/proof-store.sql']),
               'db/proof-offer.sql', 'db/stays.sql'];
console.log('\n▼ SQL の適用（本番に貼る順）' + (MERGED ? '── main を取り込んだあとの形' : ''));
const checks = {};
for (const f of FILES) {
  try { const r = await db.exec(read(f)); checks[f] = r; ok(true, f); }
  catch (e) { ok(false, f, e.message); process.exit(1); }
}
for (const f of FILES) {
  try { await db.exec(read(f)); ok(true, f + ' 再適用OK'); } catch (e) { ok(false, f + ' 再適用で失敗', e.message); }
}
const lastRows = (res) => (res && res.length ? res[res.length - 1].rows : []);
const selfCheck = async (f) => lastRows(await db.exec(read(f))).map((r) => r['結果']);

const OWN = '00000000-0000-4000-8000-00000000ad11';  // オーナー（運営の名簿にも居る）
const OP2 = '00000000-0000-4000-8000-00000000ad22';  // 運営（オーナーではない）
const A   = '00000000-0000-4000-8000-0000000000a1';  // 申請して verified になる人（給与と口コミの鍵を持つ）
const B   = '00000000-0000-4000-8000-0000000000a2';  // 申請して見送られる人
const C   = '00000000-0000-4000-8000-0000000000c1';  // 申請していない会員（会員一覧の verified）
const V   = '00000000-0000-4000-8000-0000000000c2';  // 会員一覧から verified にした人
const PRF = '00000000-0000-4000-8000-0000000000d1';  // パイロットの確認（proof）が approved の人
const CHK = '00000000-0000-4000-8000-0000000000d2';  // 運営の確認の途中（proof が submitted）の人
const M2  = '00000000-0000-4000-8000-0000000000e1';  // 印（verify_level 2）と給与の鍵だけ
const U   = '00000000-0000-4000-8000-0000000000f1';  // 登録しただけ
const T10 = '00000000-0000-4000-8000-0000000000f2';  // 出しすぎる人
const ALL = [OWN, OP2, A, B, C, V, PRF, CHK, M2, U, T10];
for (const id of ALL) {
  await db.query(`insert into auth.users(id,email) values($1,$2)`, [id, id.slice(-4) + '@example.com']);
  await db.query(`insert into public.profiles(id,email,company,"position") values($1,$2,'テスト社','cap') on conflict (id) do nothing`, [id, id.slice(-4) + '@example.com']);
}
await db.query(`insert into public.pv_admins(user_id, note) values($1,'テスト'),($2,'テスト') on conflict (user_id) do nothing`, [OWN, OP2]);
await db.query(`insert into public.pv_stay_owner(user_id) values($1)`, [OWN]);
await db.query(`update public.profiles set verify_level = 2 where id = $1`, [M2]);

// ── 出入り口 ──
const reset = async () => { await db.exec(`reset role`); await db.query(`select set_config('pv.uid', '', false)`); };
const call = async (uid, sql, params = []) => {
  await db.exec(uid ? `set role authenticated` : `set role anon`);
  await db.query(`select set_config('pv.uid', $1, false)`, [uid || '']);
  try { return { v: (await db.query(sql, params)).rows[0]?.v }; }
  catch (e) { return { err: String(e.message || e) }; }
  finally { await reset(); }
};
const own = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const asDefiner = async (uid, sql) => { await db.query(`select set_config('pv.uid', $1, false)`, [uid]);
                                        try { return (await db.query(sql)).rows[0]?.v; } finally { await reset(); } };
const denied = (r) => /permission denied/.test(r.err || '');
const rpc = (uid, fn, p) => call(uid, `select public.${fn}($1::jsonb) as v`, [p === undefined ? null : J(p)]);
const apply   = (uid, p) => rpc(uid, 'pv_stay_apply', p);
const appls   = (uid) => call(uid, `select public.pv_stay_applicants() as v`);
const members = (uid) => call(uid, `select public.pv_stay_members() as v`);
const aimg    = (uid, id) => rpc(uid, 'pv_stay_applicant_image', { id });
const verify  = (uid, id, state, via) => rpc(uid, 'pv_stay_viewer_verify', { id, state, via });
const stays   = (uid) => rpc(uid, 'pv_stays', { airline: 'etihad', iata: 'NRT' });
const realpay = (uid) => call(uid, `select public.pv_pay_rows() as v`);
const deep    = (uid) => call(uid, `select public.pv_deep_pay('{}'::jsonb) as v`);
const review  = (uid) => call(uid, `select public.pv_has_review_key() as v`);
const images  = async (uid) => Number((await own(`select count(*)::int n from public.pv_proof_images where user_id = $1`, [uid])).n);
const prow    = async (uid) => (await own(`select state, tries from public.pv_proof where user_id = $1`, [uid])) || null;
const vrow    = async (uid) => (await own(`select state, decided_by from public.pv_stay_viewers where user_id = $1`, [uid])) || null;
const nViewers = async () => Number((await own(`select count(*)::int n from public.pv_stay_viewers`)).n);
const nProof   = async () => J((await db.query(`select user_id, state from public.pv_proof order by user_id`)).rows);
const LOCKED = J({ ok: true, state: 'locked' });
const FORBID = J({ ok: false, status: 'forbidden' });
const NONE   = J({ ok: false, status: 'none' });
const isLocked = (r) => !!(r && r.v && r.v.ok === true && r.v.state === 'locked' && !J(r.v).includes('テスト用ホテル'));
const opens = (r) => !!(r && r.v && r.v.ok === true && r.v.state !== 'locked' && J(r.v).includes('テスト用ホテル'));
const nows = (b) => String(b || '').replace(/\s+/g, '');
const BLOCKING = ['required', 'submitted'];          // main の止める決まり（pv_proof_blocked・pv_proof_held_keys・pv_proof_state）

const jpeg = (len, fill = 0x41) => { const b = Buffer.alloc(len, fill); b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[3] = 0xe0; return b.toString('base64'); };
const IMG1 = jpeg(4000, 0x41), IMG2 = jpeg(5000, 0x42), IMG3 = jpeg(3000, 0x43);
const PNG  = Buffer.from('89504e470d0a1a0a' + '00'.repeat(200), 'hex').toString('base64');

const YEAR = new Date().getFullYear() - 1;
const pay = async (uid, extra) => {
  const r = await call(uid, `select public.submit_pay_report($1::jsonb) as v`,
    [J({ currency: 'USD', lang: 'en', tax_rate_pct: 0, period_year: YEAR, period_month: 3, gross_monthly: 12000,
         position: 'cap', fleet: 'b777', ...extra })]);
  await db.query(`update public.profiles set pay_reports_today = 0`);
  return r;
};

// ── 材料：A は給与と口コミ（鍵を持つ）。B・M2 は給与。公開のホテルを1件 ──
{
  const r = [await pay(A, { airline: 'jal' }), await pay(B, { airline: 'ana' }),
             await pay(M2, { airline: 'emirates', position: 'fo', fleet: 'a320' })];
  ok(r.every((x) => !x.err), '（前提）給与が入った', r.map((x) => x.err).filter(Boolean).join(' / '));
  const h = (await own(`select public.pv_review_hash($1::uuid, 'jal') h`, [A])).h;
  await db.query(`insert into public.reviews_v2(proof_hash, airline, culture_comment) values($1, 'jal', '本文')`, [h]);
  const ad = await rpc(OWN, 'pv_stay_add', { airline: 'etihad', iata: 'NRT', kind: 'hotel', name: 'テスト用ホテル' });
  const mo = ad.v && ad.v.ok ? await rpc(OP2, 'pv_stay_moderate', { target: 'place', id: ad.v.item.id, state: 'public' }) : ad;
  ok(mo.v && mo.v.ok === true, '（前提）公開のホテルが1件ある', J(ad) + ' ' + J(mo));
  ok(opens(await stays(OWN)) && isLocked(await stays(A)), '（前提）オーナーは読める・A は locked');
  // パイロットの確認の行（main の形。このブランチでは運営の入口が無いので、DB の持ち主として置く）
  await db.query(`insert into public.pv_proof(user_id, state, decided_at) values($1, 'approved', now())`, [PRF]);
  await db.query(`insert into public.pv_proof(user_id, state, submitted_at) values($1, 'submitted', now())`, [CHK]);
  await db.query(`insert into public.pv_proof_images(user_id, bytes, byte_len) values($1, decode($2,'base64'), 3000)`, [CHK, IMG3]);
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 1. 申請は何も止めない（REAL PAY・DEEP PAY・口コミ本文・ホテルの追加・いま見られているもの）');
{
  const before = { rp: J((await realpay(A)).v), dp: J((await deep(A)).v), rk: (await review(A)).v };
  ok(before.rk === true && /"ok":true/.test(before.rp), '（前提）申請の前、A は給与と口コミの鍵で開いている', before.rp.slice(0, 120));
  const r = await apply(A, { image: IMG1 });
  ok(J(r.v) === J({ ok: true, state: 'offered' }), 'A の申請は受け付けられた', J(r));
  const pr = await prow(A);
  ok(pr && pr.state === 'offered' && !BLOCKING.includes(pr.state),
     '★申請の行は、main の止める決まり（required / submitted）のどちらでもない', J(pr));
  ok(J((await realpay(A)).v) === before.rp, '★申請のあとも REAL PAY の答えは1バイトも変わらない');
  ok(J((await deep(A)).v) === before.dp, '★申請のあとも DEEP PAY の答えは1バイトも変わらない');
  ok((await review(A)).v === true, '★申請のあとも口コミ本文の鍵は開いたまま');
  const add = await rpc(A, 'pv_stay_add', { airline: 'etihad', iata: 'NRT', kind: 'hotel', name: 'Aが足したホテル' });
  ok(add.v && add.v.ok === true, '★申請のあとも、ホテルの追加は今までどおり（名前 → 送信1回）', J(add));
  if (MERGED) {
    ok((await asDefiner(A, `select public.pv_proof_blocked() as v`)) === false, '★（取り込み後）main の門 pv_proof_blocked は「止まっていない」と答える');
    ok((({ state, again }) => state === 'none' && again === false)((await call(A, `select public.pv_proof_state() as v`)).v || {}), '★（取り込み後）止める板は出ない（pv_proof_state は none）');
  }
  // もう見てよい人は画像を出せない（何も預からない・見られているものはそのまま）
  await db.query(`insert into public.pv_stay_viewers(user_id, state, decided_by, decided_at) values($1,'approved',$2,now())`, [V, OWN]);
  const rv = await apply(V, { image: IMG2 });
  ok(J(rv.v) === J({ ok: true, state: 'approved' }) && (await images(V)) === 0 && (await prow(V)) === null
     && opens(await stays(V)), '★もう見てよい人が出しても何も預からない・読めるまま', J(rv));
  const trg = (await db.query(`select t.tgname from pg_trigger t where not t.tgisinternal and t.tgrelid in ('public.pv_proof'::regclass, 'public.pv_proof_images'::regclass) order by 1`)).rows.map((r) => r.tgname);
  ok(J(trg) === J(['pv_proof_discard', 'pv_proof_image_guard', 'pv_proof_offer_keep']),
     '★2つの表の引き金はこの3つだけ（申請を置く途中の submitted を聞いている引き金が無い ── 増えたら proof-offer.sql を見直す）', J(trg));
  const sc = await selfCheck('db/proof-offer.sql');
  ok(sc.length === 6 && sc.every((x) => x === '✅'), 'db/proof-offer.sql の検算が6行とも ✅（申請の画像があるとき）', J(sc));
}

console.log('\n▼ 2. 申請してきた人は、画像が無ければ verified にならない');
{
  const bad = [await apply(B, { image: '' }), await apply(B, { image: '   ' }), await apply(B, { image: PNG }),
               await apply(B, { image: '%%%not-base64%%%' }), await apply(B, { image: jpeg(60) }),
               await apply(B, { image: jpeg(900001) })];
  ok(J(bad.map((x) => x.v && x.v.status)) === J(['image_bad', 'image_bad', 'image_bad', 'image_bad', 'image_bad', 'image_too_big']),
     '画像でないもの・小さすぎ・900KB 超は、それぞれの理由で断る（置き場の制約がそのまま決める）', J(bad));
  ok((await prow(B)) === null && (await images(B)) === 0, '★断った画像では申請の行も残らない（画像の無い申請は無い）');
  ok(!((await appls(OWN)).v.rows || []).some((x) => x.id === B), '断られた人は申請の一覧に出ない');
  const n0 = await nViewers();
  const r = await verify(OWN, C, 'approved', 'applicant');
  ok(J(r.v) === J({ ok: false, status: 'no_image' }) && (await nViewers()) === n0 && (await vrow(C)) === null,
     '★申請（画像）の無い人を「申請してきた人」として verified にすると no_image・何も書かない', J(r));
  // 申請の行が在るあいだ、画像は手で消しても消えない（画像の無い申請は作れない）
  await db.query(`delete from public.pv_proof_images where user_id = $1`, [A]);
  ok((await images(A)) === 1, '★申請の行が在るあいだ、その画像は消せない（画像の無い申請は作れない）');
  const sc = await selfCheck('db/proof-offer.sql');
  ok(sc[0] === '✅', '検算1行目：申請の行には必ず画像が1枚ある', J(sc));
}

console.log('\n▼ 3. 一覧・画像・verified は「設定したオーナー」だけ');
{
  const n0 = await nViewers(), p0 = await nProof();
  for (const [who, label] of [[OP2, 'ほかの運営'], [A, '申請した本人'], [V, '見てよい人'], [U, '登録しただけの会員'], [PRF, 'パイロットの確認が済んだ人']]) {
    const got = [J((await appls(who)).v), J((await aimg(who, A)).v), J((await members(who)).v),
                 J((await verify(who, A, 'approved', 'applicant')).v), J((await verify(who, C, 'approved', 'member')).v)];
    ok(got.every((x) => x === FORBID), `★${label}には一覧・画像・会員一覧・verified の5つとも forbidden だけ`, J(got));
  }
  ok((await nViewers()) === n0 && (await nProof()) === p0 && (await images(A)) === 1, '★断られた呼び出しは何も書かず、画像も申請も残っている');
  const anon = [await call(null, `select public.pv_stay_applicants() as v`), await rpc(null, 'pv_stay_applicant_image', { id: A }),
                await call(null, `select public.pv_stay_members() as v`), await rpc(null, 'pv_stay_viewer_verify', { id: A, state: 'approved', via: 'member' }),
                await rpc(null, 'pv_stay_apply', { image: IMG1 })];
  ok(anon.every(denied), '未ログインは5つとも呼べない', J(anon.map((x) => x.err || x.v)));
  const priv = [await call(A, `select public.pv_proof_offer($1) as v`, [IMG1]), await call(A, `select count(*) as v from public.pv_proof_offers()`),
                await call(OP2, `select public.pv_proof_offer_image($1::uuid) as v`, [A]), await call(OP2, `select public.pv_proof_offer_close($1::uuid) as v`, [A]),
                await call(A, `select count(*) as v from public.pv_proof_images`), await call(OP2, `select count(*) as v from public.pv_proof`)];
  ok(priv.every(denied), '★申請の4本と2つの表は、会員からも運営からも直接は呼べない・読めない', J(priv.map((x) => x.err || x.v)));
  const im = await aimg(OWN, A);
  ok(im.v && im.v.ok === true && nows(im.v.b64) === IMG1 && im.v.mime === 'image/jpeg', 'オーナーは申請の画像をそのまま見られる');
  const ap = (await appls(OWN)).v;
  ok(ap.ok && ap.rows.length === 1 && ap.rows[0].id === A && ap.rows[0].size === 4000 && !('b64' in ap.rows[0]),
     'オーナーの申請一覧には A だけ（画像は返さない・大きさだけ）', J(ap));
  const im2 = await aimg(OWN, CHK);
  ok(J(im2.v) === NONE, '★運営の確認の途中の画像（申請ではない）は、この口からは出ない', J(im2));
  const mb = (await members(OWN)).v;
  ok(mb.ok && mb.rows.length === ALL.length - 1 && !mb.rows.some((x) => x.id === OWN)
     && mb.rows[0].id === A && mb.rows[0].applied === true && mb.rows.find((x) => x.id === V).state === 'approved',
     'オーナーの会員一覧：オーナー自身は出さない・申請ありが先頭・状態はいまのオーナーにとっての状態', J(mb.rows.slice(0, 3)));
  // オーナーが決まっていなければ、誰も決められず画像も受け取らない
  await db.query(`delete from public.pv_stay_owner`);
  const cl = [J((await apply(U, { image: IMG2 })).v), J((await appls(OWN)).v), J((await verify(OWN, C, 'approved', 'member')).v)];
  ok(cl[0] === J({ ok: false, status: 'closed' }) && cl[1] === FORBID && cl[2] === FORBID && (await prow(U)) === null,
     '★オーナーの行が無いあいだは closed（画像を受け取らない）・誰も一覧も verified もできない', J(cl));
  await db.query(`insert into public.pv_stay_owner(user_id) values($1)`, [OWN]);
}

console.log('\n▼ 4. パイロットの確認・運営の名簿・給与・印では開かない／verified は proof を approved にしない');
{
  ok(isLocked(await stays(PRF)) && (await asDefiner(PRF, `select public.pv_stay_sees() as v`)) === false,
     '★パイロットの確認（pv_proof が approved）だけではホテルは開かない');
  ok(isLocked(await stays(OP2)) && isLocked(await stays(M2)) && isLocked(await stays(A)),
     '★ほかの運営・印（verify_level 2）と給与の鍵・申請しただけの人は locked');
  const ap0 = Number((await own(`select count(*)::int n from public.pv_proof where state = 'approved'`)).n);
  const r = await verify(OWN, CHK, 'approved', 'member');
  ok(r.v && r.v.ok === true && J(await prow(CHK)) === J({ state: 'submitted', tries: 0 }) && (await images(CHK)) === 1,
     '★運営の確認の途中の人を verified にしても、その確認の行と画像には触らない', J([r, await prow(CHK)]));
  ok(opens(await stays(CHK)), 'verified にした人は読める（会員一覧から）');
  const r2 = await verify(OWN, CHK, 'revoked', 'member');
  ok(r2.v && r2.v.state === 'revoked' && isLocked(await stays(CHK)), '取り消すと、次に呼んだ瞬間から locked');
  ok(Number((await own(`select count(*)::int n from public.pv_proof where state = 'approved'`)).n) === ap0,
     '★verified／取り消しのどれも、proof の approved を1行も作っていない');
}

console.log('\n▼ 5. 決めた瞬間に画像は消える（申請の行も）');
{
  const r = await verify(OWN, A, 'approved', 'applicant');
  ok(J(r.v) === J({ ok: true, state: 'approved', discarded: 1 }), 'A を verified にした（消えた画像 1枚）', J(r));
  ok((await images(A)) === 0 && (await prow(A)) === null, '★★決めた瞬間に画像も申請の行も消える');
  const vr = await vrow(A);
  ok(vr && vr.state === 'approved' && vr.decided_by === OWN, 'verified の行は「決めた人 ＝ いまのオーナー」');
  ok(opens(await stays(A)), 'verified になった A はホテルを読める');
  ok(((await appls(OWN)).v.rows || []).length === 0, '申請の一覧は空になった');
  ok(J((await realpay(A)).v).includes('"ok":true') && (await review(A)).v === true, 'A の REAL PAY と口コミの鍵はそのまま');
  const rb = await apply(B, { image: IMG2 });
  const db1 = await verify(OWN, B, 'denied', 'applicant');
  ok(rb.v && rb.v.ok && J(db1.v) === J({ ok: true, state: 'denied', discarded: 1 }) && (await images(B)) === 0 && (await prow(B)) === null
     && isLocked(await stays(B)), '★見送りでも画像はその場で消える・B は locked のまま', J([rb, db1]));
  const rb2 = await apply(B, { image: IMG3 });
  ok(J(rb2.v) === J({ ok: true, state: 'offered' }) && (await images(B)) === 1, '見送られた人は、また申請できる');
  const dm = await verify(OWN, B, 'approved', 'member');
  ok(J(dm.v) === J({ ok: true, state: 'approved', discarded: 1 }) && (await images(B)) === 0, '会員一覧から verified にしても、その人の申請の画像は消える');
}

console.log('\n▼ 6. 出し直し・上限・前の確認の行');
{
  ok(J((await apply(T10, { image: IMG1 })).v) === J({ ok: true, state: 'offered' }), 'T10 が出した');
  ok(J((await apply(T10, { image: IMG2 })).v) === J({ ok: true, state: 'offered' }) && (await images(T10)) === 1
     && nows((await own(`select encode(bytes,'base64') b from public.pv_proof_images where user_id = $1`, [T10])).b) === IMG2,
     '出し直しは上書き（1人1枚のまま・新しい方）');
  for (let i = 0; i < 8; i++) await apply(T10, { image: IMG1 });
  ok((await prow(T10)).tries === 10 && J((await apply(T10, { image: IMG3 })).v) === J({ ok: false, status: 'too_many' }),
     '10回で止まる（置き場を埋める連投を止める ── main と同じ数）');
  ok(J((await apply(PRF, { image: IMG1 })).v) === J({ ok: false, status: 'unavailable' }) && J(await prow(PRF)) === J({ state: 'approved', tries: 0 }),
     '前の確認の控え（approved）がある人には unavailable とだけ言い、控えは書き換えない');
  ok(J((await apply(CHK, { image: IMG1 })).v) === J({ ok: false, status: 'unavailable' }) && J(await prow(CHK)) === J({ state: 'submitted', tries: 0 }),
     '運営の確認の途中の人にも unavailable とだけ言い、その行には触らない');
  ok(J((await apply(U, {})).v) === J({ ok: true, state: 'none' }) && J((await apply(T10, null)).v) === J({ ok: true, state: 'offered' }),
     '画像を付けなければ読むだけ（none / offered）');
}

console.log('\n▼ 6-b. 申請があるまま、全部の SQL を貼り直す（serve-local は立ち上げるたびに全部流す）');
for (const f of FILES) {
  try { await db.exec(read(f)); ok(true, f + ' 申請があっても貼り直せる'); } catch (e) { ok(false, f + ' 申請があると貼り直せない', e.message); }
}
ok(J(await prow(T10)) === J({ state: 'offered', tries: 10 }) && (await images(T10)) === 1, '貼り直しても申請と画像はそのまま');

if (MERGED) {
  console.log('\n▼ 7.（取り込み後）main の運営の入口は申請を見せない・決められない');
  const lp = (await call(OP2, `select public.admin_list_proofs() as v`)).v;
  ok(Array.isArray(lp) && !lp.some((x) => x.state === 'offered'), '★運営の「資格確認」の一覧に申請は出ない', J(lp));
  ok(J((await call(OP2, `select public.admin_proof_image($1::uuid) as v`, [T10])).v) === NONE
     && J((await call(OWN, `select public.admin_proof_image($1::uuid) as v`, [T10])).v) === NONE,
     '★運営の画像の口からは、申請の画像は「無い」と同じ答え');
  ok(J((await call(OP2, `select public.admin_proof_approve($1::uuid) as v`, [T10])).v) === NONE && (await images(T10)) === 1,
     '運営の承認は申請には効かない（画像も残る）');
  const sc = await selfCheck('db/pilot-proof.sql');
  ok(sc.length === 8 && sc.every((x) => x === '✅'), 'main の検算8行が、申請の画像があっても全部 ✅', J(sc));
}

console.log(`\n${fail ? '❌' : '✅'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
