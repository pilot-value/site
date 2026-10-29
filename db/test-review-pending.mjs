/* db/test-review-pending.mjs — ログインせずに出した口コミの預かり（2026-10-29）
   と、Vote の流れるカード（pv_vote_latest）・本文の文字数（n）を PGlite で確かめる。

   実行: node db/test-review-pending.mjs   （または node check.mjs sql）

   守っているもの
     ・預かりの表は誰も直接読めない（入口は関数だけ）。返すのは預かり証だけ。
     ・受け取れない口コミはサーバーでも止める（画面の決まりと同じ）。
     ・預かった口コミは一覧に出る（2026-10-29 オーナー決定）。本文の見せ方は普通の口コミと同じ規則。
     ・引き取ると本人の口コミになり、鍵が開く。2回出ない。済み／無い／切れた／同じ会社は分けて返す。
     ・Vote の流れるカードは 12件まで・1欄80字まで・文字数つき。トップ（pv_review_voices）は6件のまま。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label} ${extra}`); }
};
const one  = async (sql, params) => (await db.query(sql, params)).rows[0];
const boom = async (sql, params) => {
  try { await db.query(sql, params); return null; } catch (e) { return String(e.message || e); }
};
const J = (x) => JSON.stringify(x);

// ── 器（db/test-reviews-gate.mjs と同じ最小形）──────────────
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  grant usage on schema public, extensions to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  grant usage on schema auth to anon, authenticated;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;
  create table public.profiles (id uuid primary key, email text);
  create table public.pv_admins (
    user_id uuid primary key references auth.users(id) on delete cascade,
    note text, added_at timestamptz not null default now());
  create table public.reviews_v2 (
    id uuid primary key default gen_random_uuid(),
    proof_hash text not null, airline text not null, "position" text,
    tenure_bucket text, age_bucket text, fleet text, job_role text,
    monthly_salary integer, bonus integer, annual_salary integer, base_annual integer, flight_allowance_annual integer,
    culture_score integer, salary_score integer, benefits_score integer,
    wlb_score integer, ops_score integer, training_score integer, mgmt_score integer,
    culture_comment text, salary_comment text, benefits_comment text,
    wlb_comment text, ops_comment text, training_comment text, mgmt_comment text,
    orig_lang text, translations jsonb,
    created_at timestamptz not null default now());
  create policy reviews_v2_insert_member on public.reviews_v2 for insert to authenticated with check (true);
`);

const FILES = ['db/airlines.generated.sql', 'db/vocab.generated.sql',
               'db/pay-reports.sql', 'db/pay-report-pending.sql', 'db/pay-rows.sql',
               'db/reviews-gate.sql', 'db/review-pending.sql'];
console.log('\n▼ SQL の適用と冪等性');
for (const f of FILES) {
  try { await db.exec(read(f)); pass++; console.log(`  ✅ ${f}`); }
  catch (e) { console.log(`  ❌ ${f}\n     ${e.message}`); fail++; process.exit(1); }
}
for (const f of ['db/reviews-gate.sql', 'db/review-pending.sql']) {
  let e = null; try { await db.exec(read(f)); } catch (x) { e = String(x.message || x); }
  ok(e === null, `${f} をもう一度流しても通る`, e || '');
}

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const mkUser = async (n) => {
  await db.query(`insert into auth.users(id,email) values($1,$2) on conflict do nothing`, [uid(n), `p${n}@example.com`]);
  await db.query(`insert into public.profiles(id,email) values($1,$2) on conflict do nothing`, [uid(n), `p${n}@example.com`]);
};
const asUser = async (n) => { await db.exec(`reset role`); await db.query(`select set_config('pv.uid', $1, false)`, [uid(n)]); await db.exec(`set role authenticated`); };
const asAnon = async () => { await db.exec(`reset role`); await db.query(`select set_config('pv.uid', '', false)`); await db.exec(`set role anon`); };
const asOwner = async () => { await db.exec(`reset role`); await db.query(`select set_config('pv.uid', '', false)`); };
const ip = async (v) => { await db.query(`select set_config('request.headers', $1, false)`, [v ? J({ 'x-forwarded-for': v }) : '']); };
await mkUser(1); await mkUser(2); await mkUser(9);
await db.query(`insert into public.pv_admins(user_id) values($1)`, [uid(9)]);

/* 作り物の口コミ（実在の投稿ではない）。末尾に目印 ── 80字より先に置く。 */
const MARK = '【預かりの末尾の目印】';
const body = (head) => head + 'あ'.repeat(120) + MARK;              // 1欄 120字超
const good = (air, extra = {}) => ({
  airline: air, position: 'fo', tenure_bucket: '5-10', age_bucket: '30-34', fleet: 'a320', job_role: 'line',
  culture_score: 4, salary_score: 3, benefits_score: 4, wlb_score: 3, ops_score: 4, training_score: 5,
  culture_comment: body('預かりの口コミです。'), salary_comment: body('給与の話です。'), wlb_comment: body('勤務の話です。'),
  lang: 'ja', ...extra,
});
const submit = async (p) => (await one(`select public.submit_review_pending($1::jsonb) r`, [J(p)])).r;

// ════════════════════════════════════════════════════════════
console.log('\n▼ 1. 預ける（未ログイン）');
// ════════════════════════════════════════════════════════════
await asAnon();
let T1;
{
  const r = await submit(good('ana'));
  T1 = r.claim_token;
  ok(J(Object.keys(r).sort()) === J(['claim_token', 'id', 'ok']) && /^[0-9a-f]{48}$/.test(r.claim_token),
     '未ログインで預けられる・返るのは預かり証だけ', J(r));
  const bad = [
    ['航空会社が空', { airline: ' ' }], ['職位が知らない値', { position: 'cadet' }], ['勤務年数が空', { tenure_bucket: '' }],
    ['年代の形が違う', { age_bucket: '30代' }], ['点が無い', { ops_score: null }], ['点が6', { ops_score: 6 }],
    ['1欄が300字を超える', { culture_comment: 'う'.repeat(301) }],
    ['本文の合計が300字に足りない', { culture_comment: 'え'.repeat(100), salary_comment: null, wlb_comment: null }],
    ['機材の形が違う', { fleet: '<b>' }],
  ];
  for (const [what, x] of bad) {
    const e = await boom(`select public.submit_review_pending($1::jsonb)`, [J(good('jal', x))]);
    ok(e !== null, `受け取らない：${what}`, e ? '' : '← 通ってしまった');
  }
  ok((await boom(`select * from public.pv_review_pending`)) !== null, '★未ログインは預かりの表を直接読めない');
  await asUser(2);
  ok((await boom(`select * from public.pv_review_pending`)) !== null, '★ログインした人も預かりの表を直接読めない');
  /* 壊す証明：読む権限を1つ与えると、上の検査は落ちる形になる */
  await asOwner(); await db.exec(`grant select on public.pv_review_pending to anon`);
  await asAnon();
  ok((await boom(`select count(*) from public.pv_review_pending`)) === null, '…（壊す証明）権限を足すと読めてしまう＝上の検査はそれを捕まえる');
  await asOwner(); await db.exec(`revoke select on public.pv_review_pending from anon`);
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 2. 預かった口コミは一覧に出る（本文の規則は普通の口コミと同じ）');
// ════════════════════════════════════════════════════════════
const list = async () => (await one(`select public.pv_reviews('{"limit":500}'::jsonb) r`)).r;
const latest = async () => (await one(`select public.pv_vote_latest() v`)).v;
/* 1件の本文（*_comment）の字数の合計 ── 流れるカードは1件で80字まで（項目をまたいで数える） */
const sum = (x) => Object.entries(x).filter(([k]) => /_comment$/.test(k)).reduce((s, [, t]) => s + String(t).length, 0);
{
  await asAnon();
  const r = await list();
  const p = r.rows.find((x) => x.pending === true && x.airline === 'ana');
  const want = ['預かりの口コミです。', '給与の話です。', '勤務の話です。'].reduce((s, h) => s + body(h).length, 0);
  ok(!!p, '★預かった口コミが鍵の無い人の一覧に出る（pending の印つき）');
  ok(p && !Object.keys(p).some((k) => /_comment$/.test(k)) && !J(p).includes(MARK) && !('id' in p) && !('claim_token' in p) && !('ip_day_hash' in p),
     '★鍵の無い人には本文・番号・預かり証・回線の控えを返さない', J(p || {}).slice(0, 200));
  ok(p && p.clip && p.clip.k === 'culture' && p.clip.o.length <= 41, '抜粋は先頭の1欄・40字まで（普通の口コミと同じ）', J(p && p.clip));
  ok(p && p.n === want, `本文の文字数 n（7欄の合計）＝ ${want}`, J(p && p.n));
  await asUser(9);
  const r9 = await list();
  const p9 = r9.rows.find((x) => x.pending === true && x.airline === 'ana');
  ok(p9 && String(p9.culture_comment || '').includes(MARK), '鍵のある人（運営）には預かった口コミの本文も全部出る');
  await asAnon();
  const v = await latest();
  const pv = v.find((x) => x.pending === true);
  ok(!!pv && pv.n === want && !J(v).includes(MARK) && !v.some((x) => 'id' in x), '★流れるカードにも出る・80字より先は返らない・番号も返らない', J(pv || {}).slice(0, 160));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 3. 流れるカード（pv_vote_latest）は12件・80字・トップは6件のまま');
// ════════════════════════════════════════════════════════════
{
  await asOwner();
  for (let i = 0; i < 15; i++) {
    const h = (await one(`select public.pv_review_hash($1::uuid,$2) h`, [uid(100 + i), 'jal'])).h;
    await db.query(`insert into public.reviews_v2(proof_hash, airline, culture_score, culture_comment, created_at)
                    values($1,'jal',4,$2, now() - ($3 || ' minutes')::interval)`, [h, body('作り物の口コミ' + i + '。'), String(i)]);
  }
  await db.query(`insert into public.reviews_v2(proof_hash, airline, culture_comment) values('short','jal','短い')`);
  await asAnon();
  const v = await latest();
  const long = v.filter((x) => sum(x) > 80);
  ok(v.length === 12, `12件だけ返る（${v.length}件）`);
  ok(!long.length && !J(v).includes(MARK), '★1件で80字まで（項目をまたいで数える・80字より先は1文字も返らない）', J(long[0] || {}).slice(0, 120));
  ok(!v.some((x) => x.culture_comment === '短い'), '本文が合わせて20字に満たない口コミは出さない');
  ok(v.every((x) => Number.isInteger(x.n) && x.n > 0), 'どの行にも文字数 n がある');
  const top = (await one(`select public.pv_review_voices() v`)).v;
  ok(top.length === 6, `★トップの抜粋は6件のまま（${top.length}件）`);
  await asUser(9);
  ok((await latest()).every((x) => x.id), '鍵のある人には番号（id）が付く（画面が全文と突き合わせる）');
}
{
  /* ★2026-10-29 オーナー指摘「80文字までなのに10文字くらいで終わる」── 最初の欄が短くても、次の欄へ続けて80字まで */
  await asOwner();
  const SHORT = 'すごく良い、美しい、気に入っている、素晴らしい';                     // 23字
  const h = (await one(`select public.pv_review_hash($1::uuid,$2) h`, [uid(300), 'jal'])).h;
  await db.query(`insert into public.reviews_v2(proof_hash, airline, culture_score, culture_comment, salary_comment, wlb_comment, training_comment, translations, created_at)
                  values($1,'jal',5,$2,$3,$4,$5,$6::jsonb, now() + interval '1 minute')`,
    [h, SHORT, '基本給は同業の中では標準的で、乗務手当が月ごとに変わる。' + 'い'.repeat(60) + MARK, '勤務の話。' + 'う'.repeat(40) + MARK, '訓練の話。' + MARK,
     J({ en: { culture: 'Really good, beautiful, love it, wonderful.', salary: 'Base pay is about average; flight pay changes month to month. ' + 'x'.repeat(80) + MARK } })]);
  await asAnon();
  const x = (await latest()).find((r) => r.culture_comment === SHORT);
  const en = (x && x.translations && x.translations.en) || {};
  const enSum = Object.values(en).reduce((s, t) => s + String(t).length, 0);
  ok(x && x.culture_comment === SHORT && String(x.salary_comment || '').startsWith('基本給は同業') && String(x.salary_comment).endsWith('…'),
     '★最初の欄が短い投稿は、次の欄（給与）へ続けて出す（給与の欄は残りの字数で切れて「…」）', J(x || {}).slice(0, 240));
  ok(x && sum(x) === 80 && !('wlb_comment' in x) && !('training_comment' in x) && !J(x).includes(MARK),
     '★合わせてちょうど80字・80字に入らなかった欄（勤務・訓練）は本文を返さない', J(x || {}).slice(0, 240));
  ok(x && J(x.cats) === J(['culture', 'salary', 'wlb', 'training']),
     '書かれた欄の名前（cats）は全部返す ── 引き出しが「コメントなし」と言わないため', J(x && x.cats));
  ok(en.culture && en.salary && enSum === 80 && !J(en).includes(MARK), '★訳文も同じ決まりで、言語ごとに合わせて80字まで', J(en));
  /* 後片付け（このあとの件数の確認を変えない） */
  await asOwner();
  await db.query(`delete from public.reviews_v2 where proof_hash = $1`, [h]);
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 4. 引き取る（ログインした人）');
// ════════════════════════════════════════════════════════════
const claim = async (t) => (await one(`select public.claim_review_pending($1) r`, [t])).r;
{
  await asAnon();
  ok((await boom(`select public.claim_review_pending($1)`, [T1])) !== null, '未ログインは引き取れない');
  await asUser(2);
  ok((await one(`select public.pv_has_review_key() v`)).v === false, '預けただけでは鍵は開かない（給与と同じ）');
  const r = await claim(T1);
  ok(r.ok === true && !r.dup, '引き取れる', J(r));
  ok((await one(`select public.pv_has_review_key() v`)).v === true, '★引き取った瞬間に口コミの鍵が開く');
  await asOwner();
  const h = (await one(`select public.pv_review_hash($1::uuid,'ana') h`, [uid(2)])).h;
  const n = (await one(`select count(*)::int n from public.reviews_v2 where proof_hash = $1`, [h])).n;
  ok(n === 1, '本人の口コミとして1件入る（proof_hash はサーバーの式）');
  await asAnon();
  const L = (await list()).rows;
  const WANT = ['預かりの口コミです。', '給与の話です。', '勤務の話です。'].reduce((t, hd) => t + body(hd).length, 0);
  ok(L.filter((x) => x.pending === true && x.airline === 'ana').length === 0 && L.filter((x) => x.airline === 'ana' && x.n === WANT).length === 1,
     '★引き取ったあと、一覧に2回出ない（預かりの行は消え、口コミの行が1つ）');
  await asUser(2);
  ok((await claim(T1)).reason === 'already_claimed', 'もう一度引き取ろうとすると「済み」');
  ok((await claim('0'.repeat(48))).reason === 'not_found', '知らない預かり証は「無い」');
  // 30日を過ぎた預かり
  await asAnon();
  const old = await submit(good('peach'));
  await asOwner(); await db.query(`update public.pv_review_pending set created_at = now() - interval '31 days' where claim_token = $1`, [old.claim_token]);
  await asUser(2);
  ok((await claim(old.claim_token)).reason === 'expired', '30日を過ぎた預かりは「切れた」');
  // 同じ会社の口コミがもうある人（1 さん は ana に出している）
  await asOwner();
  const h1 = (await one(`select public.pv_review_hash($1::uuid,'ana') h`, [uid(1)])).h;
  await db.query(`insert into public.reviews_v2(proof_hash, airline, culture_comment) values($1,'ana',$2)`, [h1, body('1さんの口コミ。')]);
  await asAnon();
  const dupT = (await submit(good('ana', { culture_comment: body('二つ目の預かり。') }))).claim_token;
  await asUser(1);
  const d = await claim(dupT);
  await asOwner();
  const n1 = (await one(`select count(*)::int n from public.reviews_v2 where proof_hash = $1`, [h1])).n;
  ok(d.ok === true && d.dup === true && n1 === 1, '★同じ会社の口コミがもうある人は、入れずに「引き取り済み」（1社1件）', J(d));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 5. 同じ回線から1日5件まで・同じ会社は畳む');
// ════════════════════════════════════════════════════════════
{
  await asAnon(); await ip('203.0.113.7');
  const a = await submit(good('skymark'));
  const b = await submit(good('skymark', { wlb_comment: body('書き直しました。') }));
  ok(a.claim_token === b.claim_token, '同じ回線・同じ日・同じ会社は畳んで、同じ預かり証を返す');
  for (const air of ['airdo', 'zipair', 'starlux', 'emirates']) await submit(good(air));
  const e = await boom(`select public.submit_review_pending($1::jsonb)`, [J(good('delta'))]);
  ok(e !== null && /しばらく/.test(e), '6社目は断る（1日5件まで）', e || '← 通ってしまった');
  const c = await submit(good('skymark', { wlb_comment: body('もう一度。') }));
  ok(c.claim_token === a.claim_token, '上限に達していても、同じ会社の書き直しは畳んで受ける');
  await ip('');
}

await asOwner();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
