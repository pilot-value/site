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

await asAnon();
{
  const r = call ? await call() : null;
  ok(r.ok === true, '未ログインでも一覧そのものは返る（画面が空にならない）');
  ok(r.unlocked === false, '未ログインは unlocked=false');
  ok(r.rows.length >= 3, `行は返る（${r.rows.length}件）`);
  const bad = r.rows.filter(x => CATS.some(k => x[k + '_comment'] !== undefined)
                              || x.translations !== undefined);
  ok(bad.length === 0, '★本文の鍵そのものが JSON に無い（ぼかしではなく不在）',
     bad.length ? JSON.stringify(bad[0]).slice(0, 160) : '');
  const leak = r.rows.filter(x => JSON.stringify(x).includes('あああ')
                              || JSON.stringify(x).includes('いいい'));
  ok(leak.length === 0, '★本文の断片がどこにも紛れ込んでいない');
  ok(r.rows.every(x => x.proof_hash === undefined),
     '★proof_hash は誰にも返らない（今まで select * で外に出ていた）');
  ok(r.rows.every(x => x.id && x.airline), '社名と id は返る（カードの見出しは出せる）');
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
}

await asUser(1);
{
  const r = await call();
  ok(r.unlocked === true, '出した人は unlocked=true');
  const ana = r.rows.find(x => x.airline === 'ana');
  ok(ana.culture_comment === LONG_A, '★出した人には本文が丸ごと返る（切らない）');
  ok(ana.translations && ana.translations.en, '訳文も返る（言語切替が動く）');
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

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
