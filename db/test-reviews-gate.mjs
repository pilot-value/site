/* db/test-reviews-gate.mjs — 口コミの本文がサーバー側で止まっているかを、
   本物の Postgres（PGlite）で実際に読ませて確かめる。

   実行: node db/test-reviews-gate.mjs   （または npm run test:sql / node check.mjs sql）
   ネットワーク不要・本番に一切触らない。

   なぜ要るか
     2026-09-07 まで、口コミの本文は **ログインしていない人でも全部読めた**。
     画面のぼかし（community.html の .rv-locked-tail・filter:blur）は見た目だけで、
     開発者ツールで CSS を外せば読めたし、REST を直に叩けば最初から素で返っていた。
     REAL PAY は既にサーバー側で止めている（db/pay-rows.sql）。同じ形に揃えた。

   ⚠️ ここには**権限の罠**がある。Postgres は「表ぜんぶの SELECT」と
      「列ごとの SELECT」を別に持っていて、表ぜんぶを持っているロールから
      列を1つ revoke しても **警告が出るだけで何も起きない**。
      字面の検査では絶対に捕まらない（revoke と書いてあるので通ってしまう）。
      だから本物の Postgres で実際に select してみる。

   ★もう1つの罠 ── 表ぜんぶの SELECT を落とすと `select('*')` が丸ごと通らなくなる。
      airlines/airline-reviews-ui.js が `select('*')` を使っていたので、
      同じコミットで RPC 経由へ付け替えてある。assert-unlock.mjs が字で見張る。
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
const rows = async (sql, params) => (await db.query(sql, params)).rows;
const boom = async (sql, params) => {
  try { await db.query(sql, params); return null; } catch (e) { return String(e.message || e); }
};

// ── 器 ───────────────────────────────────────────────────────
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  grant usage on schema public, extensions to anon, authenticated;
  /* ★既定権限を先に全付与しておく。無いと「元から権限が無いだけ」を
     「revoke が効いた」と誤読する（db/test-admin-grants.mjs と同じ考え方）。 */
  alter default privileges in schema public grant all on tables to anon, authenticated;

  grant usage on schema auth to anon, authenticated;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;

  create table public.profiles (id uuid primary key, email text);
  create table public.pv_admins (
    user_id uuid primary key references auth.users(id) on delete cascade,
    note text, added_at timestamptz not null default now());

  /* 口コミの表。本番の定義はリポジトリに無いので、画面が読む列を写した最小形。
     ★本番にしか無い列があっても pv_reviews は to_jsonb(行) で拾うので、
       ここに全部そろっている必要はない。 */
  create table public.reviews_v2 (
    id          uuid primary key default gen_random_uuid(),
    proof_hash  text not null,
    airline     text not null,
    "position"  text,
    tenure_bucket text,
    age_bucket  text,
    fleet       text,
    job_role    text,
    monthly_salary integer,
    bonus       integer,
    annual_salary integer,
    base_annual integer,
    flight_allowance_annual integer,
    culture_score integer, salary_score integer, benefits_score integer,
    wlb_score integer, ops_score integer, training_score integer, mgmt_score integer,
    culture_comment text, salary_comment text, benefits_comment text,
    wlb_comment text, ops_comment text, training_comment text, mgmt_comment text,
    orig_lang   text,
    translations jsonb,
    created_at  timestamptz not null default now()
  );
`);

// ── 適用（本番と同じ順）──────────────────────────────────────
const FILES = ['db/airlines.generated.sql', 'db/vocab.generated.sql',
               'db/pay-reports.sql', 'db/pay-report-pending.sql', 'db/pay-rows.sql',
               'db/reviews-gate.sql'];

console.log('\n▼ SQL の適用');
for (const f of FILES) {
  try { await db.exec(read(f)); console.log(`  ✅ ${f}`); pass++; }
  catch (e) { console.log(`  ❌ ${f}\n     ${e.message}`); fail++; process.exit(1); }
}

console.log('\n▼ 冪等性（もう一度そのまま流す）');
for (const f of FILES) {
  try { await db.exec(read(f)); console.log(`  ✅ ${f} 再適用OK`); pass++; }
  catch (e) { console.log(`  ❌ ${f} 再適用で失敗\n     ${e.message}`); fail++; }
}

// ── 道具 ─────────────────────────────────────────────────────
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const mkUser = async (n) => {
  await db.query(`insert into auth.users(id,email) values($1,$2) on conflict do nothing`,
    [uid(n), `p${n}@example.com`]);
  await db.query(`insert into public.profiles(id,email) values($1,$2) on conflict do nothing`,
    [uid(n), `p${n}@example.com`]);
};
const asUser = async (n) => {
  await db.exec(`reset role`);
  await db.query(`select set_config('pv.uid', $1, false)`, [uid(n)]);
  await db.exec(`set role authenticated`);
};
const asAnon = async () => {
  await db.exec(`reset role`);
  await db.query(`select set_config('pv.uid', '', false)`);
  await db.exec(`set role anon`);
};
const asOwner = async () => {
  await db.exec(`reset role`);
  await db.query(`select set_config('pv.uid', '', false)`);
};

const LONG_A = 'ここは' + 'あ'.repeat(200);            // 200字超え
const LONG_B = 'こちらは' + 'い'.repeat(150);
const CATS = ['culture', 'salary', 'benefits', 'wlb', 'ops', 'training', 'mgmt'];

/* 投稿する（proof_hash は本番と同じ式で作る）。 */
const post = async (n, code, extra = {}) => {
  await asOwner();
  const h = (await one(`select public.pv_review_hash($1::uuid,$2) h`, [uid(n), code])).h;
  const cols = Object.keys(extra).filter(k => k !== '__at');
  const vals = cols.map((_, i) => `$${i + 4}`).join(',');
  await db.query(
    `insert into public.reviews_v2(proof_hash, airline, created_at${cols.length ? ',' + cols.map(c => `"${c}"`).join(',') : ''})
     values($1,$2,$3${cols.length ? ',' + vals : ''})`,
    [h, code, extra.__at || new Date().toISOString(), ...cols.map(c => extra[c])]);
};

await mkUser(1); await mkUser(2); await mkUser(9);

// 1 さん … ana に1件（本文あり）
await post(1, 'ana', {
  position: 'fo', tenure_bucket: '3-5', culture_score: 4, salary_score: 3,
  culture_comment: LONG_A, salary_comment: LONG_B, mgmt_comment: '短い',
  orig_lang: 'ja', translations: JSON.stringify({ en: { culture: LONG_A, salary: LONG_B } }),
  __at: '2026-09-01T00:00:00Z',
});
// 2 さん … 口コミを1件も出していない（＝鍵なし）
// 旧コードの1件（LEGACY_CODES の 'cathay'）— 1 さんが出したもの
await post(1, 'cathay', { culture_comment: LONG_A, __at: '2026-08-01T00:00:00Z' });
// jal に1件（2 さんではない別人＝ 9 さん・運営）
await post(9, 'jal', { wlb_comment: LONG_B, __at: '2026-09-02T00:00:00Z' });


// ════════════════════════════════════════════════════════════
console.log('\n▼ 1. 表を直に読んでも本文は返らない（★ここが本題）');
// ════════════════════════════════════════════════════════════
for (const role of ['anon', 'authenticated']) {
  await asOwner(); await db.exec(`set role ${role}`);
  const err = await boom(`select culture_comment from public.reviews_v2 limit 1`);
  ok(err !== null && /permission|権限/i.test(err),
     `${role} は本文の列を直に読めない（culture_comment）`, err || '← 読めてしまった');
  const err2 = await boom(`select translations from public.reviews_v2 limit 1`);
  ok(err2 !== null, `${role} は訳文の列を直に読めない（translations）`, err2 || '← 読めてしまった');
  const err3 = await boom(`select * from public.reviews_v2 limit 1`);
  ok(err3 !== null, `${role} は select * ができない（＝表ぜんぶの権限が落ちている）`,
     err3 || '← 通ってしまった');
}
await asOwner();

console.log('\n  ── ただし、画面が要る列は今までどおり読める ──');
for (const role of ['anon', 'authenticated']) {
  await asOwner(); await db.exec(`set role ${role}`);
  const e1 = await boom(`select id, airline, "position", culture_score, created_at
                           from public.reviews_v2 limit 1`);
  ok(e1 === null, `${role} は点数・社名・日付を読める`, e1);
  // ★重複チェック（submit-review.html）と premium-auth-lock.js は proof_hash で絞り込む
  const e2 = await boom(`select id from public.reviews_v2 where proof_hash = 'x'`);
  ok(e2 === null, `${role} は proof_hash で絞り込める（投稿の重複チェックが生きる）`, e2);
}
await asOwner();

console.log('\n  ── 投稿（insert）は今までどおり通る ──');
await asUser(2);
{
  const err = await boom(
    `insert into public.reviews_v2(proof_hash, airline, culture_comment)
     values('dummyhash','jal',$1)`, ['テスト本文']);
  ok(err === null, '会員は口コミを投稿できる（select を落としても insert は無事）', err);
  await asOwner();
  await db.exec(`delete from public.reviews_v2 where culture_comment = 'テスト本文'`);
}
await asOwner();


// ════════════════════════════════════════════════════════════
console.log('\n▼ 2. 鍵の判定（pv_has_review_key）');
// ════════════════════════════════════════════════════════════
await asAnon();
{
  const err = await boom(`select public.pv_has_review_key() v`);
  ok(err !== null, 'ログインしていない人はそもそも鍵の判定を呼べない');
}

await asUser(1);
ok((await one(`select public.pv_has_review_key() v`)).v === true,
   '口コミを出した人は鍵を持つ');

await asUser(2);
ok((await one(`select public.pv_has_review_key() v`)).v === false,
   '会員登録しただけの人は鍵を持たない');

// 旧コードだけで出した人も鍵を持つ
await asOwner();
await mkUser(3);
await post(3, 'spring', { culture_comment: LONG_A });
await asUser(3);
ok((await one(`select public.pv_has_review_key() v`)).v === true,
   '★もう使っていない旧コード（spring）で出した人の鍵も生きている');

// 運営
await asOwner();
await db.query(`insert into public.pv_admins(user_id) values($1)`, [uid(9)]);
await asUser(2);
ok((await one(`select public.pv_has_review_key() v`)).v === false,
   '運営でない人はやはり鍵を持たない');
await asUser(9);
ok((await one(`select public.pv_has_review_key() v`)).v === true,
   '運営は出していなくても読める');
await asOwner();


// ════════════════════════════════════════════════════════════
console.log('\n▼ 3. pv_reviews ── 鍵の無い人に本文を1文字も返さない');
// ════════════════════════════════════════════════════════════
const call = async (p = {}) =>
  (await one(`select public.pv_reviews($1::jsonb) r`, [JSON.stringify(p)])).r;

let ANON_JSON = '';
await asAnon();
{
  const r = call ? await call() : null;
  ANON_JSON = JSON.stringify(r);
  ok(r.ok === true, '未ログインでも一覧そのものは返る（画面が空にならない）');
  ok(r.unlocked === false, '未ログインは unlocked=false');
  ok(r.rows.length >= 3, `行は返る（${r.rows.length}件）`);
  const bad = r.rows.filter(x => CATS.some(k => x[k + '_comment'] !== undefined)
                              || x.translations !== undefined);
  ok(bad.length === 0, '★本文の鍵そのものが JSON に無い（ぼかしではなく不在）',
     bad.length ? JSON.stringify(bad[0]).slice(0, 160) : '');
  /* ★2026-09-16、オーナー指示で「先頭の1欄だけ40字」を返すことにした（★2026-10-29 オーナー「最初の80文字は見せて」で80字に）。
       ここは元は「本文の断片がどこにも紛れ込んでいない」1本だった ── 渡すと
       決めた40字と、渡さないと決めた残りを、**3つに割って**引き継ぐ。
     ⚠️ ana の行で見る（本文のある欄が3つある唯一の行）。jal は先頭の欄が
        wlb なので、そちらでは「い」が正しく出る。 */
  const ana0 = r.rows.find(x => x.airline === 'ana');
  ok(!!(ana0 && ana0.clip) && ana0.clip.k === 'culture'
     && ana0.clip.o === LONG_A.slice(0, 80) + '…',
     '★先頭の欄は80字まで出る（読めるのはきっかり80字・2026-10-29 に40字から）',
     JSON.stringify(ana0 && ana0.clip || {}).slice(0, 160));
  ok(!JSON.stringify(ana0).includes('あ'.repeat(78)),   // 抜粋は「ここは」＋77字＋「…」── 78字続けば81字目から先が漏れている
     '★★81字目から先は1文字も出ない');
  ok(!JSON.stringify(ana0).includes('い'),
     '★★★抜粋が出るのは最初に書かれた欄だけ（2欄目は1文字も出ない）',
     JSON.stringify(ana0).slice(0, 200));
  ok(!Object.keys(ana0).some(k => /_comment$/.test(k)),
     '★★抜粋の鍵の名前が _comment で終わっていない'
     + '（終わると review-i18n.js が「鍵を持っている」と誤判定して錠前ごと消える）',
     Object.keys(ana0).join(','));
  ok(ana0.clip.t && ana0.clip.t.en === LONG_A.slice(0, 80) + '…',
     '★訳文の側も同じ80字で切る（英語面から全文が漏れない）',
     JSON.stringify(ana0.clip.t || {}).slice(0, 160));
  /* ★「先頭」は culture 固定ではなく、その行で**最初に書かれている**欄。 */
  const jal0 = r.rows.find(x => x.airline === 'jal');
  ok(!!(jal0 && jal0.clip) && jal0.clip.k === 'wlb'
     && jal0.clip.o === LONG_B.slice(0, 80) + '…',
     '★先頭は culture 固定ではない（その行で最初に書かれた欄）',
     JSON.stringify(jal0 && jal0.clip || {}).slice(0, 160));
  ok(r.rows.every(x => x.proof_hash === undefined),
     '★proof_hash は誰にも返らない（今まで select * で外に出ていた）');
  /* ★2026-10-17 まではここが「社名と id は返る」だった。鍵の無い人には口コミの番号を返さない
       （要約の番号と同じ扱い・7. で全文を探す）。画面は鍵の無い行の id を使っていない。 */
  ok(r.rows.every(x => x.airline && !Object.prototype.hasOwnProperty.call(x, 'id')),
     '★社名は返る・口コミの番号（id）は返らない（カードの見出しは出せる）',
     r.rows.filter(x => Object.prototype.hasOwnProperty.call(x, 'id')).length + '行に id');
  const withCats = r.rows.find(x => x.airline === 'ana');
  ok(Array.isArray(withCats.cats) && withCats.cats.includes('culture'),
     '★どの欄に本文があるかの名前は返る（項目名まで消すと件数が全部0になる）',
     JSON.stringify(withCats && withCats.cats));
  ok(!withCats.cats.includes('wlb'), '本文が無い欄は名前も出さない');
}

await asUser(2);
{
  const r = await call();
  ok(r.unlocked === false, '会員登録しただけの人も unlocked=false');
  ok(r.rows.every(x => x.culture_comment === undefined),
     '★ログインしていても、出していない人には本文を返さない');
  /* ★未ログインと「登録しただけ」で1バイトも違わない ── 片方にだけ抜粋が付く、
       片方にだけ本文が付く、を1本で捕まえる（2026-09-16）。 */
  ok(JSON.stringify(r) === ANON_JSON,
     '★★未ログインと「登録しただけ」で返る中身が1バイト違わない');
}

await asUser(1);
{
  const r = await call();
  ok(r.unlocked === true, '出した人は unlocked=true');
  const ana = r.rows.find(x => x.airline === 'ana');
  ok(ana.culture_comment === LONG_A, '★出した人には本文が丸ごと返る（切らない）');
  ok(ana.translations && ana.translations.en, '訳文も返る（言語切替が動く）');
  ok(ana.clip === undefined,
     '★鍵を持つ人には抜粋を付けない（全文が在るのに80字も並べない）',
     JSON.stringify(ana.clip || null));
  ok(ana.proof_hash === undefined, '鍵を持つ人にも proof_hash は返さない');
}

await asUser(9);
{
  const r = await call();
  ok(r.unlocked === true && r.rows.some(x => x.culture_comment === LONG_A),
     '運営は本文を読める');
}

console.log('\n  ── 絞り込み ──');
await asUser(1);
{
  const r1 = await call({ airline: 'ana' });
  ok(r1.rows.length === 1 && r1.rows[0].airline === 'ana', '1社に絞れる');
  const r2 = await call({ airlines: ['ana', 'jal'] });
  ok(r2.rows.length === 2, '複数社に絞れる（航空会社ページ用）', `${r2.rows.length}件`);
  const r3 = await call({ mine: true });
  ok(r3.rows.length === 2 && r3.rows.every(x => ['ana', 'cathay'].includes(x.airline)),
     '★自分の投稿だけを引ける（マイページ用・旧コードも拾う）',
     r3.rows.map(x => x.airline).join(','));
  const r4 = await call({ limit: 1 });
  ok(r4.rows.length === 1, '件数を絞れる');
  const r5 = await call({ limit: 99999 });
  ok(r5.rows.length <= 500, '件数の上限が効く（500まで）');
  // 新しい順
  const r6 = await call();
  const ds = r6.rows.map(x => x.created_at);
  ok(ds.join('|') === ds.slice().sort().reverse().join('|'), '新しい順で返る');
}
await asAnon();
{
  const err = await boom(`select public.pv_reviews('{"mine":true}'::jsonb)`);
  ok(err !== null && /ログインが必要/.test(err),
     '未ログインが mine を頼むと 42501 で断る（他人のを渡さない）', err || '← 通った');
}
await asOwner();


// ════════════════════════════════════════════════════════════
console.log('\n▼ 4. トップページの抜粋 ── ここだけ開いている（穴の大きさを固定する）');
// ════════════════════════════════════════════════════════════
await asAnon();
{
  const v = (await one(`select public.pv_review_voices() v`)).v;
  ok(Array.isArray(v), '未ログインでも配列が返る（トップの「まだ投稿が少ない」を出さない）');
  ok(v.length <= 6, `★6件まで（${v.length}件）── lp.js が描くのは先頭4枚だけ`);
  ok(v.length >= 1, '本文のある行は出る');
  const lens = [];
  for (const row of v) {
    for (const k of CATS) if (row[k + '_comment']) lens.push(row[k + '_comment'].length);
    if (row.translations) for (const l of Object.values(row.translations))
      for (const t of Object.values(l || {})) if (t) lens.push(String(t).length);
  }
  ok(lens.length > 0 && Math.max(...lens) <= 80,
     `★どの欄も80字まで（最長 ${lens.length ? Math.max(...lens) : 0}字）`);
  ok(v.every(r => r.proof_hash === undefined), 'proof_hash は出さない');
  const clipped = v.map(r => r.culture_comment).filter(Boolean);
  ok(clipped.every(s => s.length < 80 || s.endsWith('…')),
     '切ったところに「…」が付く（lp.js の clip と同じ）');
  // 訳文も切れているか（1 さんの ana 行が en を持っている）
  const withTr = v.find(r => r.translations && r.translations.en);
  ok(withTr && String(withTr.translations.en.culture).length <= 80,
     '★訳文も同じ80字で切れている（切らないと英語側から全文が漏れる）',
     withTr ? String(withTr.translations.en.culture).length + '字' : '対象が無い');
}
{
  // 短すぎる本文は出さない（lp.js の足切りと同じ）
  await asOwner();
  await mkUser(4);
  await post(4, 'jal', { culture_comment: 'みじかい', __at: '2026-09-05T00:00:00Z' });
  await asAnon();
  const v = (await one(`select public.pv_review_voices() v`)).v;
  ok(!v.some(r => r.culture_comment === 'みじかい'),
     '★20字に満たない本文は抜粋に出さない（lp.js の足切りと同じ）');
}
{
  // ★lp.js が見るのは「KEYS 順の最初の1欄」だけ。あとの欄が長くても、
  //   最初の欄が短ければあちらはカードを描かない＝ここでも出さない。
  await asOwner();
  await mkUser(5);
  await post(5, 'jal', { culture_comment: 'みじかい',
                         salary_comment: 'こちらは十分に長い本文で、二十字はゆうに超えています。',
                         __at: '2026-09-05T01:00:00Z' });
  await asAnon();
  const v = (await one(`select public.pv_review_voices() v`)).v;
  ok(!v.some(r => r.culture_comment === 'みじかい'),
     '★最初の1欄が短い行は、あとの欄が長くても抜粋に出さない');
}
await asOwner();


// ════════════════════════════════════════════════════════════
console.log('\n▼ 5. 権限そのもの（字ではなく実際の付与を見る）');
// ════════════════════════════════════════════════════════════
{
  const hide = ['culture_comment','salary_comment','benefits_comment','wlb_comment',
                'ops_comment','training_comment','mgmt_comment','translations'];
  const r = await rows(
    `select grantee, column_name from information_schema.column_privileges
      where table_schema='public' and table_name='reviews_v2'
        and privilege_type='SELECT' and grantee in ('anon','authenticated')
        and column_name = any($1)`, [hide]);
  ok(r.length === 0, '★本文の8列に読み取り権限が1つも残っていない',
     r.map(x => x.grantee + '.' + x.column_name).join(', '));

  const t = await rows(
    `select grantee from information_schema.role_table_grants
      where table_schema='public' and table_name='reviews_v2'
        and privilege_type='SELECT' and grantee in ('anon','authenticated')`);
  ok(t.length === 0, '★表ぜんぶの読み取りが落ちている（＝列の制限が本当に効く形）',
     t.map(x => x.grantee).join(', '));

  const keep = await rows(
    `select column_name from information_schema.column_privileges
      where table_schema='public' and table_name='reviews_v2'
        and privilege_type='SELECT' and grantee='anon'`);
  ok(keep.length >= 15, `本文以外は読める（${keep.length}列）`);
  ok(keep.some(x => x.column_name === 'proof_hash'),
     'proof_hash の絞り込みは残す（投稿の重複チェックが死なない）');

  const ins = await rows(
    `select grantee from information_schema.role_table_grants
      where table_schema='public' and table_name='reviews_v2'
        and privilege_type='INSERT' and grantee='authenticated'`);
  ok(ins.length === 1, '会員の投稿権限は触っていない');
}

console.log('\n  ── 内側の関数は誰にも呼ばせない ──');
for (const [fn, arg] of [['pv_review_hash', `'${uid(1)}'::uuid,'ana'`],
                         ['pv_review_codes', ''],
                         ['pv_review_clip', `'abc',3`]]) {
  for (const role of ['anon', 'authenticated']) {
    await asOwner(); await db.exec(`set role ${role}`);
    const err = await boom(`select public.${fn}(${arg})`);
    ok(err !== null, `${role} は ${fn} を直に呼べない`, err ? '' : '← 呼べてしまった');
  }
}
await asOwner();

console.log('\n  ── 新しい列が増えたら閉じる側に倒れる ──');
{
  await db.exec(`alter table public.reviews_v2 add column secret_note text`);
  await db.exec(`set role anon`);
  const err = await boom(`select secret_note from public.reviews_v2 limit 1`);
  ok(err !== null, '★あとから足した列は、このファイルを流し直すまで誰にも読めない',
     err ? '' : '← 読めてしまった');
  await asOwner();
  await db.exec(read('db/reviews-gate.sql'));
  await db.exec(`set role anon`);
  const err2 = await boom(`select secret_note from public.reviews_v2 limit 1`);
  ok(err2 === null, '流し直すと読めるようになる（本文8列以外は自動で拾う）', err2);
  await asOwner();
  await db.exec(`alter table public.reviews_v2 drop column secret_note`);
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 6. 式が画面側と一致しているか（写し間違いを捕まえる）');
// ════════════════════════════════════════════════════════════
{
  const js = read('pv-reunlock.js');
  const m = js.match(/userId\s*\+\s*"([^"]+)"\s*\+\s*code\s*\+\s*"([^"]+)"/);
  ok(!!m, 'pv-reunlock.js から proof_hash の式を読めた');
  if (m) {
    const sql = read('db/reviews-gate.sql');
    ok(sql.includes(`'${m[1]}'`) && sql.includes(`'${m[2]}'`),
       `★SQL と画面の式が同じ（${m[1]} … ${m[2]}）`);
  }
  const legacy = js.match(/LEGACY_CODES\s*=\s*\[([^\]]+)\]/);
  ok(!!legacy, 'pv-reunlock.js から旧コードの一覧を読めた');
  if (legacy) {
    const codes = legacy[1].match(/["']([a-z-]+)["']/g).map(s => s.replace(/["']/g, ''));
    const sql = read('db/reviews-gate.sql');
    const missing = codes.filter(c => !sql.includes(`'${c}'`));
    ok(missing.length === 0, `★旧コード ${codes.length} 件が SQL にも入っている`,
       missing.join(', '));
  }
  const lp = read('lp.js');
  ok(/clip\(text,\s*80\)/.test(lp), '★lp.js の抜粋は 80字（SQL 側と同じ）',
     'lp.js を変えたら db/reviews-gate.sql の 80 も変える');
  ok(/\.length\s*<\s*20/.test(lp), '★lp.js の足切りは 20字（SQL 側と同じ）');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 7. 口コミの番号（id）は、本文を読める人と自分の口コミにだけ返す（2026-10-17）');
// ════════════════════════════════════════════════════════════
/* なぜ要るか
     2026-10-16 まで、pv_reviews() と pv_review_voices() は鍵の無い人にも全行の id を返していた。
     番号だけで書いた人は分からないが、要約の番号（db/review-summary.sql の ids）は
     本文を読める人にしか返していない ── 同じ扱いにそろえた。
   ⚠️ 表を直に読む道（1. の「画面が要る列」の id）は、今回は変えていない
      （submit-review.html・airlines/premium-auth-lock.js・airlines/airline-base.js が
       まだ表から id を引いている。付け替えてから閉じる）。 */
{
  await asOwner();
  const all = await rows(`select id::text as id, to_jsonb(created_at) #>> '{}' as at, airline
                            from public.reviews_v2 order by created_at desc nulls last`);
  const IDS = all.map(x => x.id);
  const idAt = Object.fromEntries(all.map(x => [x.at, x.id]));
  const MINE = all.filter(x => ['ana', 'cathay'].includes(x.airline)).map(x => x.id);   // 1 さんの2件
  const has = (o) => Object.prototype.hasOwnProperty.call(o, 'id');
  const leak = (v) => { const s = JSON.stringify(v); return IDS.filter(id => s.includes(id)); };
  const voices = async () => (await one(`select public.pv_review_voices() v`)).v;
  const ASKS = [{}, { airline: 'ana' }, { airlines: ['ana', 'jal', 'cathay', 'spring'] }, { limit: 500 }];
  ok(IDS.length >= 6, `（見本の口コミ ${IDS.length}件の番号を控えた）`);

  console.log('  ── 鍵の無い人（未ログイン・登録しただけ）──');
  for (const [who, as] of [['未ログイン', asAnon], ['登録しただけ', () => asUser(2)]]) {
    await as();
    let n = 0, withId = 0, found = [];
    for (const p of ASKS) {
      const r = await call(p);
      n += r.rows.length; withId += r.rows.filter(has).length; found = found.concat(leak(r));
    }
    ok(n > 0 && withId === 0, `★${who}: pv_reviews のどの行にも id の欄が無い（${n}行）`, `${withId}行に id`);
    ok(found.length === 0, `★★${who}: pv_reviews の返事のどこにも口コミの番号が無い（${IDS.length}件の番号を全文で探す）`,
       found.join(','));
    const v = await voices();
    ok(v.length > 0 && !v.some(has), `★${who}: トップの抜粋（pv_review_voices）の行にも id の欄が無い（${v.length}行）`);
    ok(leak(v).length === 0, `★★${who}: トップの抜粋の返事のどこにも口コミの番号が無い`, leak(v).join(','));
  }

  console.log('  ── 鍵を持つ人・運営・自分の口コミは今までどおり ──');
  for (const [who, n] of [['口コミを出した人', 1], ['運営', 9]]) {
    await asUser(n);
    const r = await call({ limit: 500 });
    ok(r.unlocked === true && JSON.stringify(r.rows.map(x => x.id)) === JSON.stringify(IDS),
       `★${who}: pv_reviews の id は表の番号そのまま・同じ並び（${r.rows.length}行）`,
       JSON.stringify(r.rows.map(x => x.id || null)).slice(0, 160));
    const v = await voices();
    ok(v.length > 0 && v.every(x => typeof x.id === 'string' && x.id === idAt[x.created_at]),
       `★${who}: トップの抜粋にも id が今までどおり付く（${v.length}行）`,
       JSON.stringify(v.map(x => x.id || null)).slice(0, 160));
  }
  await asUser(1);
  {
    const m = await call({ mine: true });
    ok(JSON.stringify(m.rows.map(x => x.id)) === JSON.stringify(MINE),
       '★自分の口コミ（mine）は id 付きで返る（マイページ）', JSON.stringify(m.rows.map(x => x.id || null)));
  }

  /* ★鍵の判定が false でも、自分の口コミ（mine）の id は残す。
       main の db/pay-rows.sql には pv_proof_blocked（2026-10-13）があり、口コミを出した人でも
       確認待ちのあいだは鍵が false になる。ここでは鍵の判定だけを false に差し替えて
       その形を作り、確かめたら流し直して戻す。 */
  await asOwner();
  await db.exec(`create or replace function public.pv_has_review_key() returns boolean
                   language sql stable as $$ select false $$`);
  await asUser(1);
  {
    const m = await call({ mine: true });
    ok(m.unlocked === false && JSON.stringify(m.rows.map(x => x.id)) === JSON.stringify(MINE)
       && m.rows.every(x => x.culture_comment === undefined),
       '★鍵が閉じていても、自分の口コミ（mine）は id 付きで返る（本文は返らない）',
       JSON.stringify(m.rows.map(x => x.id || null)));
    const r = await call();
    ok(r.unlocked === false && r.rows.length > 0 && !r.rows.some(has) && leak(r).length === 0,
       '★★鍵が閉じている人がふつうに引くと、自分の行にも id は付かない（mine のときだけ）');
  }
  await asOwner();
  await db.exec(read('db/reviews-gate.sql'));
  await asUser(1);
  ok((await one(`select public.pv_has_review_key() v`)).v === true, '流し直すと鍵の判定が元に戻る');

  console.log('  ── 鍵の無い人の返事は、番号が無いことのほかは今までと同じ ──');
  /* 全部読める人（運営）の返事から、本文の8欄と id を引き、抜粋を足したもの ＝ 鍵の無い人の返事。
     抜粋・項目名・点・日付・並びのどれか1つでも鍵の無い側だけ変わったら、ここが落ちる。 */
  const HIDE = CATS.map(k => k + '_comment').concat(['translations', 'id']);
  await asUser(9); const full = await call({ limit: 500 }); const vFull = await voices();
  await asAnon();  const shut = await call({ limit: 500 }); const vShut = await voices();
  await asOwner();
  const diff = [];
  shut.rows.forEach((s, i) => {
    const f = { ...full.rows[i] }, t = { ...s };
    for (const k of HIDE) delete f[k];
    if (s.cats.length && !s.clip) diff.push(`${i}: 抜粋が無い`);
    delete t.clip;
    if (JSON.stringify(t) !== JSON.stringify(f)) diff.push(`${i}: ${JSON.stringify(t).slice(0, 80)} ≠ ${JSON.stringify(f).slice(0, 80)}`);
  });
  ok(Object.keys(shut).sort().join() === 'ok,rows,unlocked' && shut.rows.length === full.rows.length && diff.length === 0,
     '★★鍵の無い人の pv_reviews は「本文8欄と id が無い・抜粋が付く」のほかは、全部読める人の返事と1字も違わない',
     diff.join(' | ').slice(0, 300));
  ok(vShut.length === vFull.length
     && JSON.stringify(vShut) === JSON.stringify(vFull.map(({ id, ...x }) => x)),
     '★★鍵の無い人のトップの抜粋は、id が無いことのほかは鍵を持つ人の返事と1字も違わない');
}


/* ══ ★2026-11-06 鍵の無い人の一覧は「書き込みのときに作っておいた行」を引くだけ（Supabase の Disk IO 警告）══
   答えが元の作り方と1字も違わないことを、元の関数の写し（REF）と突き合わせて確かめる。
   ⚠️ REF は 2026-11-06 時点の pv_reviews の写し。鍵の無い人の行の形をわざと変えるときは、
      db/reviews-gate.sql の pv_review_card_of() と else の式、そしてこの REF の3つを一緒に直す。 */
const REF = "create or replace function public.pv_reviews_ref(p jsonb default '{}'::jsonb)\nreturns jsonb\nlanguage plpgsql\nsecurity definer\nstable\nset search_path = public, extensions\nas $fn$\ndeclare\n  v_uid   uuid    := auth.uid();\n  v_open  boolean := public.pv_has_review_key();\n  v_air   text    := nullif(btrim(p->>'airline'), '');\n  v_airs  text[]  := null;\n  v_mine  boolean := coalesce((p->>'mine')::boolean, false);\n  v_limit int     := least(greatest(coalesce((p->>'limit')::int, 200), 1), 500);\n  v_hide  text[]  := array['culture_comment', 'salary_comment', 'benefits_comment',\n                           'wlb_comment', 'ops_comment', 'training_comment',\n                           'mgmt_comment', 'translations'];\n  v_rows  jsonb;\nbegin\n  if jsonb_typeof(p->'airlines') = 'array' then\n    select array_agg(x) into v_airs from jsonb_array_elements_text(p->'airlines') x;\n    if v_airs is not null and cardinality(v_airs) = 0 then v_airs := null; end if;\n  end if;\n  if v_mine and v_uid is null then\n    raise exception 'ログインが必要です' using errcode = '42501';\n  end if;\n  with mine as (\n    select public.pv_review_hash(v_uid, c) as h\n      from public.pv_review_codes() c\n     where v_mine and v_uid is not null\n  ), src as (\n    select to_jsonb(r) as j, r.created_at as at, r.airline as air, r.proof_hash as ph\n      from public.reviews_v2 r\n    union all\n    select (to_jsonb(q) - 'claim_token' - 'claimed_at' - 'ip_day_hash')\n             || jsonb_build_object('pending', true),\n           q.created_at, q.airline, null::text\n      from public.pv_review_pending q\n     where q.claimed_at is null\n  ), pick as (\n    select s.*\n      from src s\n     where (v_air  is null or s.air = v_air)\n       and (v_airs is null or s.air = any (v_airs))\n       and (not v_mine or s.ph in (select h from mine))\n     order by s.at desc nulls last\n     limit v_limit\n  )\n  select coalesce(jsonb_agg(z.j order by z.ord), '[]'::jsonb)\n    into v_rows\n    from (\n      select row_number() over (order by pick.at desc nulls last) as ord,\n             (case when v_open then pick.j - 'proof_hash'\n                   when v_mine then pick.j - 'proof_hash' - v_hide\n                   else pick.j - 'proof_hash' - v_hide - 'id' end)\n             || jsonb_build_object('cats', to_jsonb(ck.a), 'n', ck.n)\n             || case when v_open or ck.a[1] is null then '{}'::jsonb\n                     else jsonb_build_object('clip', jsonb_build_object(\n                       'k', ck.a[1],\n                       'o', public.pv_review_clip(\n                              pick.j ->> (ck.a[1] || '_comment'), 81),\n                       't', coalesce((\n                              select jsonb_object_agg(l.key,\n                                       to_jsonb(public.pv_review_clip(\n                                         l.value ->> ck.a[1], 81)))\n                                from jsonb_each(case when jsonb_typeof(pick.j -> 'translations') = 'object'\n                                                     then pick.j -> 'translations'\n                                                     else '{}'::jsonb end) l\n                               where jsonb_typeof(l.value) = 'object'\n                                 and nullif(l.value ->> ck.a[1], '') is not null\n                            ), '{}'::jsonb)))\n                end as j\n        from pick,\n             lateral (select array_remove(array[\n                  case when btrim(coalesce(pick.j ->> 'culture_comment',  '')) <> '' then 'culture'  end,\n                  case when btrim(coalesce(pick.j ->> 'salary_comment',   '')) <> '' then 'salary'   end,\n                  case when btrim(coalesce(pick.j ->> 'benefits_comment', '')) <> '' then 'benefits' end,\n                  case when btrim(coalesce(pick.j ->> 'wlb_comment',      '')) <> '' then 'wlb'      end,\n                  case when btrim(coalesce(pick.j ->> 'ops_comment',      '')) <> '' then 'ops'      end,\n                  case when btrim(coalesce(pick.j ->> 'training_comment', '')) <> '' then 'training' end,\n                  case when btrim(coalesce(pick.j ->> 'mgmt_comment',     '')) <> '' then 'mgmt'     end\n                ], null) as a,\n                public.pv_review_len(pick.j) as n) ck\n    ) z;\n  return jsonb_build_object('ok', true, 'unlocked', v_open, 'rows', v_rows);\nend\n$fn$;";
console.log('\n▼ ★鍵の無い人の一覧は作っておいた行を引くだけ ── 元の作り方と1字も違わない');
{
  await asOwner();
  await db.exec(REF + '\ngrant execute on function public.pv_reviews_ref(jsonb) to anon, authenticated;');
  const PS = [{}, { airline: 'ana' }, { airlines: ['ana', 'ana-wings'] }, { limit: 2 }, { airlines: [] },
              { airline: 'nope' }, { limit: 600 }, { airline: ' jal ' }];
  /* 同じ時刻の行どうしの並びは、元の作り方でも決まっていない（どちらも正しい）。それ以外は1字も違わない。 */
  const sameRows = (a, b) => {
    if (JSON.stringify(a) === JSON.stringify(b)) return true;
    const ka = a.rows.map((r) => JSON.stringify(r)).sort(), kb = b.rows.map((r) => JSON.stringify(r)).sort();
    return a.unlocked === b.unlocked && JSON.stringify(ka) === JSON.stringify(kb)
      && JSON.stringify(a.rows.map((r) => r.created_at)) === JSON.stringify(b.rows.map((r) => r.created_at));
  };
  const check = async () => {
    const bad = [];
    for (const who of ['anon', 'user']) {
      if (who === 'anon') await asAnon(); else { await asOwner(); await mkUser(901); await asUser(901); }
      for (const p of PS) {
        const a = (await one('select public.pv_reviews($1::jsonb) as v', [JSON.stringify(p)])).v;
        const b = (await one('select public.pv_reviews_ref($1::jsonb) as v', [JSON.stringify(p)])).v;
        if (!sameRows(a, b)) bad.push(`${who} ${JSON.stringify(p)} new=${a.rows.length} ref=${b.rows.length}`);
      }
    }
    await asOwner();
    return bad;
  };
  const n0 = (await one('select count(*)::int as n from public.reviews_v2')).n;
  ok(n0 > 0 && (await one('select count(*)::int as n from public.pv_review_card')).n >= n0,
     '作っておいた行が、口コミの数だけある', String(n0));
  let bad = await check();
  ok(!bad.length, '★はじめ：鍵の無い人・鍵の無い会員の一覧が、元の作り方と1字も違わない（8通りの絞り込み）', bad.join(' | '));
  /* 入る（訳つき・長文・空白だけの欄）／直る／訳が後から付く／消える／預かりが入る／引き取られる、のどれでも作り直されている */
  await db.query(`insert into public.reviews_v2(proof_hash, airline, created_at, culture_comment, wlb_comment, translations)
     values ('ph-card-1', 'ana', '2026-11-06T00:00:01Z', '   ', $1, $2::jsonb),
            ('ph-card-2', 'ana-wings', '2026-11-06T00:00:02Z', $3, null, null)`,
    [LONG_A, JSON.stringify({ en: { wlb: 'W'.repeat(120) }, es: { wlb: 'x' } }), 'みじかい']);
  bad = await check(); ok(!bad.length, '★口コミが入っても、元の作り方と同じ', bad.join(' | '));
  await db.query(`update public.reviews_v2 set salary_comment = $1 where proof_hash = 'ph-card-2'`, [LONG_B]);
  bad = await check(); ok(!bad.length, '★口コミが直っても、元の作り方と同じ', bad.join(' | '));
  await db.query(`update public.reviews_v2 set translations = $1::jsonb where proof_hash = 'ph-card-2'`,
    [JSON.stringify({ en: { culture: 'Short in English', salary: 'S'.repeat(90) } })]);
  bad = await check(); ok(!bad.length, '★訳が後から付いても、元の作り方と同じ', bad.join(' | '));
  await db.query(`delete from public.reviews_v2 where proof_hash = 'ph-card-1'`);
  bad = await check(); ok(!bad.length, '★口コミが消えても、元の作り方と同じ（消えた行は一覧に残らない）', bad.join(' | '));
  await db.query(`insert into public.pv_review_pending(claim_token, airline, created_at, ops_comment)
     values ('tok-card-1', 'ana', '2026-11-06T00:00:03Z', $1)`, [LONG_B]);
  bad = await check(); ok(!bad.length, '★預かりが入っても、元の作り方と同じ（pending の印つき）', bad.join(' | '));
  await db.query(`update public.pv_review_pending set claimed_at = now() where claim_token = 'tok-card-1'`);
  bad = await check(); ok(!bad.length, '★預かりが引き取られたら一覧から外れる（元の作り方と同じ）', bad.join(' | '));
  /* 壊す証明：引き金を外すと、直したのに古い行のまま ＝ 元の作り方と食い違う（この検査は空振りしていない） */
  await db.exec('drop trigger if exists pv_review_card_sync on public.reviews_v2');
  await db.query(`update public.reviews_v2 set salary_comment = 'こわすしょうめい' where proof_hash = 'ph-card-2'`);
  bad = await check();
  ok(bad.length > 0, '★壊す証明：引き金を外すと、元の作り方と食い違う（検査が空振りしていない）', String(bad.length));
  await db.exec(read('db/reviews-gate.sql'));
  bad = await check(); ok(!bad.length, '★このファイルを貼り直すと、全部作り直されて元の作り方と同じに戻る', bad.join(' | '));
  /* 作っておいた行の表そのものは誰にも読ませない */
  await asAnon();
  ok(!!(await boom('select * from public.pv_review_card limit 1')), '作っておいた行の表は、鍵の無い人から直接は読めない');
  await asOwner();
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 10. トップに出さない口コミ（ゲーム・下品な語・2026-11-14）');
// ════════════════════════════════════════════════════════════
{
  await asOwner();
  /* 本番の pv_is_admin（db/admin.sql）と同じ式。名簿に居る人だけが承諾できる。 */
  await db.exec(`create or replace function public.pv_is_admin() returns boolean language sql stable
                 security definer set search_path = public as $$
                   select exists (select 1 from public.pv_admins a where a.user_id = auth.uid()) $$`);
  await mkUser(20); await mkUser(21);
  await db.query(`insert into public.pv_admins(user_id) values($1) on conflict do nothing`, [uid(20)]);
  const ng = async (t) => (await one(`select public.pv_review_ng_words($1) w`, [t])).w;

  /* 本物のパイロットが書きそうな文は止めない（語の頭で区切る・紛らわしい語は一覧に入れていない） */
  const CLEAN = [
    'The cockpit culture is professional and SOPs are well defined across the fleet.',
    'Base pay plus flying pay; classes and assessments in the sim are thorough. Passenger loads are high.',
    'Housing in the GTA is expensive. There is a lot of camaraderie among us pilots.',
    'We fly the Pokemon jet sometimes. Layovers in Yellowknife and Scunthorpe, shiitake ramen in Tokyo.',
    'Hancock and Dickson are good captains. The new roster system is a game changer.',
    '多国籍のクルーが一緒に飛ぶ環境で、上下関係ははっきりしている。ポケモンジェットにも乗る。',
    'イエローナイフへの便があり、ゲームチェンジャーになる制度改定だった。約束どおり手当が出る。',
  ];
  const clean = [];
  for (const t of CLEAN) { const w = await ng(t); if (w.length) clean.push(`${w.join(',')} ← ${t.slice(0, 40)}`); }
  ok(clean.length === 0, '本物のパイロットの文は止めない（cockpit・Scunthorpe・among us・GTA・ポケモン・イエロー・ゲームチェンジャー）', clean.join(' | '));

  const DIRTY = [
    ['Wow its the best guys I love it lets play roblox adopt me and ptfs lets poop', ['roblox', 'ptfs', 'adopt me', "let's play", 'poop']],
    ['ＲＯＢＬＯＸ is fun', ['roblox']],
    ["Let’s play Minecraft after the flight", ['minecraft', "let's play"]],
    ['Management is bullshit and the roster is fucking awful', ['fuck', 'shit']],
    ['POOP everywhere', ['poop']],
    ['経営陣はクソ。うんこみたいな会社', ['うんこ', 'クソ']],
  ];
  const miss = [];
  for (const [t, want] of DIRTY) { const w = await ng(t); if (JSON.stringify(w.slice().sort()) !== JSON.stringify(want.slice().sort())) miss.push(`${t.slice(0, 30)} → ${JSON.stringify(w)}`); }
  ok(miss.length === 0, 'ゲームと下品な語は止める（全角・大文字・’ の付いた let’s も）', miss.join(' | '));

  /* 投稿した瞬間に印が付き、トップに出ない（いちばん新しくても）。Vote には今までどおり出る（指示はトップだけ）。 */
  const BAD = 'It it very good beautiful I love it magnificent and lets play roblox adopt me';
  await post(21, 'riyadh-air', { culture_comment: BAD, salary_comment: '15k dollar a month basic + guaranteed 75 hour fly',
                                 __at: '2026-12-01T00:00:00Z' });
  const badId = (await one(`select id from public.reviews_v2 where airline = 'riyadh-air' and culture_comment = $1`, [BAD])).id;
  const hold = await one(`select words, approved_at from public.pv_review_top_hold where review_id = $1`, [badId]);
  ok(hold && hold.words.includes('roblox') && hold.approved_at === null, '★投稿した瞬間に印が付く（保留・語つき）', JSON.stringify(hold));
  const onTop = async () => (await one(`select public.pv_review_voices() v`)).v.some((x) => x.airline === 'riyadh-air');
  await asAnon();
  const top = (await one(`select public.pv_review_voices() v`)).v;
  ok(!top.some((x) => x.airline === 'riyadh-air') && top.length >= 1, `★いちばん新しくてもトップに出ない（ほかの${top.length}件は出る）`);
  ok((await one(`select public.pv_vote_latest() v`)).v.some((x) => x.airline === 'riyadh-air'),
     'Vote の流れるカードには今までどおり出る（オーナーの指示はトップだけ）');
  ok(!!(await boom('select * from public.pv_review_top_hold')), '印の表は、鍵の無い人から直接は読めない');
  ok(!!(await boom(`select public.admin_review_top_decide($1, true)`, [badId])), '★ログインしていない人は承諾できない');
  ok(!!(await boom(`select public.admin_list_top_holds()`)), 'ログインしていない人は保留の一覧を読めない');
  await asUser(21);
  ok(!!(await boom(`select public.admin_review_top_decide($1, true)`, [badId])), '★運営でない会員（投稿した本人でも）は承諾できない');
  ok(!!(await boom('select * from public.pv_review_top_hold')), '印の表は、会員からも直接は読めない');
  await asAnon();
  ok(!(await onTop()), '断られたあとも、トップには出ていない');

  /* 運営が承諾するとトップに出る。外すとまた出ない。 */
  await asUser(20);
  const list = (await one(`select public.admin_list_top_holds() v`)).v;
  const it = list.find((x) => x.id === badId);
  ok(it && it.words.includes('roblox') && it.approved_at == null && it.text.includes('roblox'), '運営の一覧に、語と本文つきで出る（保留中が先）', JSON.stringify(list[0] || null).slice(0, 200));
  const d1 = (await one(`select public.admin_review_top_decide($1, true) v`, [badId])).v;
  await asAnon();
  ok(d1.ok === true && d1.shown === true && await onTop(), '★運営が承諾するとトップに出る', JSON.stringify(d1));
  await asUser(20);
  await one(`select public.admin_review_top_decide($1, false) v`, [badId]);
  await asAnon();
  ok(!(await onTop()), '★運営が外すと、またトップに出ない');
  await asUser(20);
  const nh = (await one(`select public.admin_review_top_decide($1, true) v`, [uid(999)])).v;
  ok(nh.ok === false && nh.reason === 'not_held', '印の無い口コミを承諾しようとしても何も起きない', JSON.stringify(nh));
  await one(`select public.admin_review_top_decide($1, true) v`, [badId]);   // 承諾した状態にして続ける

  /* 貼り直しても承諾は残る。引き金が無かったあいだに入った口コミも、貼り直しで拾う。 */
  await asOwner();
  await db.exec('drop trigger if exists pv_review_top_hold_sync on public.reviews_v2');
  await post(21, 'emirates', { culture_comment: 'Crew life is fine but honestly this place is shit for juniors.', __at: '2026-12-02T00:00:00Z' });
  await db.exec(read('db/reviews-gate.sql'));
  const h2 = await rows(`select r.airline, h.approved_at from public.pv_review_top_hold h join public.reviews_v2 r on r.id = h.review_id
                          where r.airline in ('riyadh-air', 'emirates') order by r.airline`);
  ok(h2.length === 2 && h2[0].airline === 'emirates' && h2[0].approved_at === null && h2[1].approved_at !== null,
     '貼り直しても承諾は残り、引き金が無かったあいだの口コミも拾う', JSON.stringify(h2));

  /* 本文が直ったら：語が消えれば印も消える／別の語に変われば承諾はやり直し。 */
  await db.query(`update public.reviews_v2 set culture_comment = 'Crew life is fine but juniors wait long for upgrades.' where airline = 'emirates' and culture_comment like '%shit%'`);
  ok(!(await rows(`select 1 from public.pv_review_top_hold h join public.reviews_v2 r on r.id = h.review_id where r.airline = 'emirates'`)).length,
     '本文から語が消えたら、印も消える');
  await db.query(`update public.reviews_v2 set mgmt_comment = 'lets play fortnite' where id = $1`, [badId]);
  const h3 = await one(`select words, approved_at from public.pv_review_top_hold where review_id = $1`, [badId]);
  ok(h3.approved_at === null && h3.words.includes('fortnite'), '承諾のあとで別の語が足されたら、承諾はやり直し（トップから外れる）', JSON.stringify(h3));

  /* 貼ったあとの検算の⑨ */
  const chk9 = async () => (await rows(read('db/reviews-gate.sql').split('-- 8. 検算')[1].replace(/^[^\n]*\n(-- [^\n]*\n)*/, ''))).find((x) => x['項目'].startsWith('⑨'));
  await asOwner();
  let c9 = await chk9();
  ok(c9 && c9['値'].startsWith('✅') && /保留中 1件/.test(c9['値']), '検算の⑨が ✅（保留中の件数つき）', JSON.stringify(c9));

  /* 壊す証明：トップの抜粋から「印の付いた口コミを外す1行」を抜くと、上の検査も検算の⑨も落ちる */
  const src = read('db/reviews-gate.sql');
  const fn = src.slice(src.indexOf('create or replace function public.pv_review_voices()'), src.indexOf('revoke all on function public.pv_review_voices()'));
  const broken = fn.replace(/\n\s*and not exists \(select 1 from public\.pv_review_top_hold h\n[^\n]*\n/, () => '\n');
  ok(broken !== fn, '壊す証明の準備：外す1行が見つかる');
  await db.exec(broken);
  await asAnon();
  const leaked = await onTop();
  await asOwner();
  c9 = await chk9();
  ok(leaked && c9['値'].startsWith('❌'), '★壊す証明：外す1行を抜くと、保留中の口コミがトップに出て、検算の⑨も ❌ になる', JSON.stringify(c9));
  await db.exec(read('db/reviews-gate.sql'));
  await asAnon();
  ok(!(await onTop()), 'ファイルを貼り直すと、また出なくなる');
  await asOwner();
}

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
