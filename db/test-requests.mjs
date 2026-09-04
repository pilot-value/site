/* db/requests.sql を本物の Postgres（PGlite = PG17 の WASM ビルド）に流して確かめる。

   実行: node db/test-requests.mjs   （または npm run test:sql）
   ネットワーク不要・本番に一切触らない。SQL を直したら必ずこれを通してから
   オーナーに実行を依頼すること。

   器は db/test-admin-grants.mjs と同じ（anon / authenticated ロール、既定権限を
   全付与した状態、auth.uid() の代役、profiles、auth.users）。
   ★既定権限を先に全付与してあるからこそ requests.sql の revoke が意味を持つ。
     無いと「元から権限が無いだけ」を「revoke が効いた」と誤読する。

   ここでいちばん大事な1行:
     ★ author_hash が画面へ1回も出ないこと。
       出た瞬間にそれは安定した仮名 ID になり、
       「この人はこの12件を書いた」が組み立てられる。匿名が匿名でなくなる。
       だから「'author_hash' という語が無い」だけでなく
       **A の実際のハッシュ値が JSON のどこにも無い**ことまで見る。

   ⚠️ set_config の第3引数は **false**（＝セッション全体）でなければならない。
      true にすると次の文では auth.uid() が null に戻り、
      「権限で弾かれた」という判定が全部空振りのまま緑になる。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };

const A     = '00000000-0000-4000-8000-00000000000a';  // 一般会員その1
const B     = '00000000-0000-4000-8000-00000000000b';  // 一般会員その2
const ADMIN = '00000000-0000-4000-8000-00000000ad11';  // 管理者

// ── 器 ───────────────────────────────────────────────────────
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  grant usage on schema public, extensions to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;

  create table public.profiles (
    id uuid primary key, email text, name text,
    gender text, birthdate date, country text, company text, "position" text
  );
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;
  create table public.reviews_v2 (
    id uuid primary key default gen_random_uuid(),
    proof_hash text not null, airline text not null, "position" text,
    created_at timestamptz not null default now()
  );
`);

console.log('\n▼ SQL の適用');
const FILES = ['db/airlines.generated.sql', 'db/vocab.generated.sql',
               'db/schema-additions.sql', 'db/pay-reports.sql',
               'db/admin.sql', 'db/requests.sql'];
for (const f of FILES) {
  try { await db.exec(read(f)); ok(true, f); }
  catch (e) { ok(false, f, e.message); process.exit(1); }
}

console.log('\n▼ 冪等性（もう一度そのまま流す）');
for (const f of FILES) {
  try { await db.exec(read(f)); ok(true, f + ' 再適用OK'); }
  catch (e) { ok(false, f + ' 再適用で失敗', e.message); }
}

// ── 人を3人作る ──────────────────────────────────────────────
for (const [uid, mail] of [[A, 'a@example.com'], [B, 'b@example.com'], [ADMIN, 'ops@example.com']]) {
  await db.query(`insert into auth.users(id,email) values($1,$2)`, [uid, mail]);
  await db.query(`insert into public.profiles(id,email) values($1,$2)
                  on conflict (id) do nothing`, [uid, mail]);
}
await db.query(`insert into public.pv_admins(user_id, note) values($1,'テスト')
                on conflict (user_id) do nothing`, [ADMIN]);

// ── 出入り口 ─────────────────────────────────────────────────
const asMember = async (uid) => {
  await db.exec(`set role authenticated`);
  await db.query(`select set_config('pv.uid', $1, false)`, [uid]);
};
const asOwner = async () => {
  await db.exec(`reset role`);
  await db.query(`select set_config('pv.uid', '', false)`);
};
/* 会員として1文だけ走らせる。返り値は {v} か {err}。 */
const call = async (uid, sql, params = []) => {
  await asMember(uid);
  try { return { v: (await db.query(sql, params)).rows[0] }; }
  catch (e) { return { err: String(e.message || e) }; }
  finally { await asOwner(); }
};
const submit = (uid, body, cat = 'other') =>
  call(uid, `select public.pv_request_submit($1,$2) as v`, [body, cat]);
const list = (uid, sort = 'popular', lim = 20, off = 0) =>
  call(uid, `select public.pv_requests_list($1,$2,$3) as v`, [sort, lim, off]);
const toggle = (uid, id) =>
  call(uid, `select public.pv_request_like_toggle($1) as v`, [id]);

/* ★時計を進める代わりに、書けた行を過去へずらす（オーナーとして）。
   60秒の連投制限に毎回引っかかると、以降の検査が全部「連投」で緑にも赤にもならない。 */
let clock = 1;
const ageOut = async (uid) => {
  clock += 1;
  await db.query(
    `update public.pv_requests set created_at = now() - (($2 || ' minutes')::interval)
      where author_hash = public.pv_request_hash($1)
        and created_at > now() - interval '60 seconds'`, [uid, String(clock)]);
};
const freshSubmit = async (uid, body, cat) => {
  const r = await submit(uid, body, cat);
  await ageOut(uid);
  return r;
};

// ════════════════════════════════════════════════════════════
console.log('\n▼ ① 表そのものが会員から見えない（出入口は関数だけ）');
for (const t of ['pv_requests', 'pv_request_likes']) {
  const r = await call(A, `select count(*) as n from public.${t}`);
  ok(!!r.err && /permission denied|許可|denied/i.test(r.err), `会員は ${t} を直接読めない`, r.err || '読めてしまった');
  const w = await call(A, `insert into public.${t} default values returning 1 as n`);
  ok(!!w.err, `会員は ${t} に直接書けない`, w.err ? '' : '書けてしまった');
}
{
  const r = await db.query(`select count(*)::int as n from pg_policies
                             where schemaname='public' and tablename in ('pv_requests','pv_request_likes')`);
  ok(r.rows[0].n === 0, 'ポリシーを1つも作っていない（＝ PostgREST から表は見えない）', 'policies=' + r.rows[0].n);
}
{
  const r = await call(A, `select public.pv_request_hash($1) as h`, [A]);
  ok(!!r.err, '会員は pv_request_hash を呼べない（uuid の総当たりで匿名が解けない）',
     r.err ? '' : '呼べてしまった: ' + JSON.stringify(r.v));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ ② 出す（投稿）');
const first = await freshSubmit(A, '国別の年収を並べて見たいです', 'feature');
ok(first.v && first.v.v && first.v.v.ok === true, '会員は要望を出せる', JSON.stringify(first));
const ID1 = first.v && first.v.v && first.v.v.item && first.v.v.item.id;
ok(first.v.v.item.like_count === 1, '投稿直後の ♡ は 1（本人の1票。飾りではない）');
ok(first.v.v.item.liked_by_me === true, '本人には liked_by_me:true');
ok(first.v.v.item.status === 'new', '初期状態は new（勝手に「検討中」と約束しない）');
{
  const r = await db.query(`select count(*)::int as n from public.pv_request_likes where request_id=$1`, [ID1]);
  ok(r.rows[0].n === 1, '★その1票は pv_request_likes に本当に入っている（fake count ではない）');
}
{
  const r = await db.query(`select author_hash from public.pv_requests where id=$1`, [ID1]);
  ok(/^[0-9a-f]{64}$/.test(r.rows[0].author_hash), '保存されているのはハッシュだけ（生の user_id は無い）');
  ok(!r.rows[0].author_hash.includes(A.replace(/-/g, '')), 'ハッシュに user_id がそのまま入っていない');
}
{
  const cols = await db.query(`select column_name from information_schema.columns
                                where table_schema='public' and table_name='pv_requests'`);
  const names = cols.rows.map(r => r.column_name);
  ok(!names.includes('user_id') && !names.includes('email') && !names.includes('airline')
     && !names.includes('position'),
     '★航空会社・職位・メール・user_id の列がそもそも無い（結びつけようがない）', names.join(','));
}
{
  /* auth.uid() が null のまま呼ぶ＝ログイン前。ここで通ると匿名の投げ込み口になる。 */
  await asOwner();
  await db.exec(`set role authenticated`);
  let anon = null;
  try { await db.query(`select public.pv_request_submit('未ログインの投稿') as v`); }
  catch (e) { anon = String(e.message || e); }
  await asOwner();
  ok(!!anon, '未ログインでは出せない', anon ? '' : '出せてしまった');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ ③ 文字数と空投稿はサーバ側で止める（画面の maxlength は目安にすぎない）');
{
  const short = await submit(A, 'あ');
  ok(!!short.err, '3文字未満は弾く', short.err ? '' : '通ってしまった');
  const spaces = await submit(A, ' '.repeat(500));
  ok(!!spaces.err, '★空白500個は弾く（btrim が先だから通らない）', spaces.err ? '' : '通ってしまった');
  const over = await submit(A, 'あ'.repeat(501));
  ok(!!over.err, '501文字は弾く', over.err ? '' : '通ってしまった');

  const max = await freshSubmit(A, 'あ'.repeat(500));
  ok(max.v && max.v.v && max.v.v.ok === true, 'ちょうど500文字は通る', JSON.stringify(max));

  const pad = await freshSubmit(A, '   前後に空白がある要望です   ');
  ok(pad.v.v.item.body === '前後に空白がある要望です', '前後の空白は落として保存する', JSON.stringify(pad.v.v.item.body));
}
{
  const weird = await freshSubmit(A, '知らない区分で出してみる', 'nonsense');
  ok(weird.v && weird.v.v && weird.v.v.ok === true && weird.v.v.item.category === 'other',
     '知らない区分は other に丸める（区分の綴り違いで本文を落とさない）', JSON.stringify(weird));
}
{
  const xss = await freshSubmit(A, '<img src=x onerror=alert(1)> と <script>alert(2)</script> を含む要望');
  ok(xss.v.v.ok === true && xss.v.v.item.body.includes('<script>'),
     'HTML はそのまま保存する（消さない。逃がすのは画面側の textContent の仕事）');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ ④ ★ author_hash が外へ出ない');
{
  const hash = (await db.query(`select public.pv_request_hash($1) as h`, [A])).rows[0].h;
  for (const [who, uid] of [['本人（A）', A], ['他人（B）', B], ['管理者', ADMIN]]) {
    const r = await list(uid, 'new', 100);
    const raw = JSON.stringify(r.v ? r.v.v : r.err);
    ok(!raw.includes('author_hash'), `${who}の一覧に author_hash という語が無い`);
    ok(!raw.includes(hash), `★${who}の一覧に A の実際のハッシュ値が無い`);
    ok(!raw.includes('liker_hash'), `${who}の一覧に liker_hash という語が無い`);
    ok(!raw.includes(A), `${who}の一覧に A の user_id が無い`);
  }
  const s = JSON.stringify(first.v.v);
  ok(!s.includes('author_hash') && !s.includes(hash), '★投稿の返り値にもハッシュが無い');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ ⑤ ♡ は1人1票');
{
  const t1 = await toggle(B, ID1);
  ok(t1.v && t1.v.v.like_count === 2 && t1.v.v.liked_by_me === true, 'B が押すと 2 になる', JSON.stringify(t1));
  const t2 = await toggle(B, ID1);
  ok(t2.v && t2.v.v.like_count === 1 && t2.v.v.liked_by_me === false, 'もう一度押すと 1 に戻る', JSON.stringify(t2));
  const t3 = await toggle(B, ID1);
  ok(t3.v && t3.v.v.like_count === 2, 'また押すと 2', JSON.stringify(t3));

  const dup = await db.query(`select public.pv_request_hash($1) as h`, [B]);
  let e = null;
  try {
    await db.query(`insert into public.pv_request_likes(request_id, liker_hash) values($1,$2)`,
                   [ID1, dup.rows[0].h]);
  } catch (err) { e = err; }
  ok(e && String(e.code || '') === '23505',
     '★2票目は主キーで弾かれる（関数の判定ではなく表の形で担保している）', e ? String(e.message) : '入ってしまった');

  const n = await db.query(`select count(*)::int as n from public.pv_request_likes where request_id=$1`, [ID1]);
  ok(n.rows[0].n === 2, '実データも 2 のまま');

  const meB = await list(B, 'new', 100);
  const rowB = meB.v.v.items.find(x => x.id === ID1);
  ok(rowB && rowB.like_count === 2 && rowB.liked_by_me === true, '一覧の like_count はサーバが数え直した実数');

  const meA = await list(A, 'new', 100);
  const rowA = meA.v.v.items.find(x => x.id === ID1);
  ok(rowA && rowA.liked_by_me === true, 'A から見ても自分は押した状態');

  const gone = await toggle(A, '00000000-0000-4000-8000-0000000ffff1');
  ok(!!gone.err, '無い要望には押せない', gone.err ? '' : '押せてしまった');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ ⑥ 管理者だけが状態を変えられる');
{
  const bad = await call(A, `select public.pv_request_set_status($1,'done') as v`, [ID1]);
  ok(!!bad.err && /42501|管理者/.test(bad.err), '★一般会員は状態を変えられない', bad.err || '変えられてしまった');
  const bad2 = await call(B, `select public.pv_request_set_hidden($1,true) as v`, [ID1]);
  ok(!!bad2.err && /42501|管理者/.test(bad2.err), '★一般会員は伏せられない', bad2.err || '伏せられてしまった');
  const stillNew = (await db.query(`select status, is_hidden from public.pv_requests where id=$1`, [ID1])).rows[0];
  ok(stillNew.status === 'new' && stillNew.is_hidden === false, '弾かれたので1文字も変わっていない');

  const good = await call(ADMIN, `select public.pv_request_set_status($1,'building') as v`, [ID1]);
  ok(good.v && good.v.v.ok === true, '管理者は状態を変えられる', JSON.stringify(good));
  ok((await db.query(`select status from public.pv_requests where id=$1`, [ID1])).rows[0].status === 'building',
     '実データも building になった');

  const junk = await call(ADMIN, `select public.pv_request_set_status($1,'awesome') as v`, [ID1]);
  ok(!!junk.err, '知らない状態は管理者でも入れられない', junk.err ? '' : '入ってしまった');

  await call(ADMIN, `select public.pv_request_set_status($1,'new') as v`, [ID1]);
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ ⑦ 伏せた要望は一般会員に返さない');
{
  const bad = await freshSubmit(B, 'ここに荒らしの文が入っているとする');
  const HID = bad.v.v.item.id;
  await call(ADMIN, `select public.pv_request_set_hidden($1,true) as v`, [HID]);

  const asA = (await list(A, 'new', 100)).v.v;
  ok(!asA.items.some(x => x.id === HID), '★伏せた行は一般会員の items に無い');
  ok(!JSON.stringify(asA).includes('荒らしの文'), '★本文も1文字も出ない');

  const asAdmin = (await list(ADMIN, 'new', 100)).v.v;
  ok(asAdmin.items.some(x => x.id === HID), '管理者には出る');
  ok(asAdmin.total === asA.total + 1, 'total も一般会員のほうが1件少ない（KPI に伏せた行が混ざらない）');
  ok(asA.items.every(x => x.is_hidden === null), '一般会員の JSON には is_hidden の中身が入らない');
  ok(asAdmin.items.some(x => x.is_hidden === true), '管理者の JSON には is_hidden が入る');

  const like = await toggle(A, HID);
  ok(!!like.err, '伏せた行には ♡ を押せない', like.err ? '' : '押せてしまった');

  await call(ADMIN, `select public.pv_request_set_hidden($1,false) as v`, [HID]);
  ok((await list(A, 'new', 100)).v.v.items.some(x => x.id === HID), '戻せば また出る');
  await call(ADMIN, `select public.pv_request_set_hidden($1,true) as v`, [HID]);
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ ⑧ 並び順と件数');
{
  const pop = (await list(A, 'popular', 100)).v.v;
  const counts = pop.items.map(x => x.like_count);
  ok(counts.every((n, i) => i === 0 || counts[i - 1] >= n), '人気順は ♡ の多い順', counts.join(','));
  ok(pop.sort === 'popular', 'sort をそのまま返す（画面のタブと食い違わない）');

  const nw = (await list(A, 'new', 100)).v.v;
  const times = nw.items.map(x => +new Date(x.created_at));
  ok(times.every((t, i) => i === 0 || times[i - 1] >= t), '新着順は新しい順', times.length + '件');
  ok(nw.sort === 'new', 'sort=new をそのまま返す');

  const junk = (await list(A, 'ZZZ', 100)).v.v;
  ok(junk.sort === 'popular', '知らない並びは人気順に倒す');

  ok(pop.total === nw.total && pop.total === pop.items.length,
     'total は実数（1ページに収まっているうちは items の数と一致）', `${pop.total} / ${pop.items.length}`);

  const p1 = (await list(A, 'new', 2, 0)).v.v;
  const p2 = (await list(A, 'new', 2, 2)).v.v;
  ok(p1.items.length === 2 && p2.items.length >= 1, '2件ずつ取れる');
  ok(!p1.items.some(x => p2.items.some(y => y.id === x.id)), '1ページ目と2ページ目が重ならない');

  const huge = (await list(A, 'new', 100000, 0)).v.v;
  ok(huge.limit === 100, '★上限は100に丸める（全件をブラウザへ投げない）', String(huge.limit));
  const neg = (await list(A, 'new', -1, -5)).v.v;
  ok(neg.limit === 1 && neg.offset === 0, '負の数でも落ちない', `${neg.limit}/${neg.offset}`);

  await asOwner();
  await db.exec(`set role authenticated`);
  let anonList = null;
  try { await db.query(`select public.pv_requests_list('new',5,0) as v`); }
  catch (e) { anonList = String(e.message || e); }
  await asOwner();
  ok(!!anonList, '未ログインでは一覧も読めない', anonList ? '' : '読めてしまった');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ ⑨ 連投・上限・同じ内容');
{
  const C = '00000000-0000-4000-8000-00000000000c';
  await db.query(`insert into auth.users(id,email) values($1,'c@example.com')`, [C]);
  await db.query(`insert into public.profiles(id,email) values($1,'c@example.com')
                  on conflict (id) do nothing`, [C]);

  const r1 = await submit(C, '1本目の要望です');
  ok(r1.v.v.ok === true, '1本目は通る');
  const r2 = await submit(C, '2本目の要望です');
  ok(r2.v.v.ok === false && r2.v.v.status === 'too_fast',
     '60秒以内の2本目は too_fast（例外ではなく ok:false で返す）', JSON.stringify(r2.v.v));
  ok((await db.query(`select count(*)::int as n from public.pv_requests
                       where author_hash = public.pv_request_hash($1)`, [C])).rows[0].n === 1,
     '★弾いたときは1行も入っていない');

  await ageOut(C);
  const dup = await submit(C, '1本目の要望です');
  ok(dup.v.v.ok === false && dup.v.v.status === 'duplicate',
     '24時間以内の同じ本文は duplicate', JSON.stringify(dup.v.v));
  const dupCase = await submit(C, '  1本目の要望デス  '.replace('デス', 'です'));
  ok(dupCase.v.v.ok === false, '前後の空白を足しただけでも重複と見なす', JSON.stringify(dupCase.v.v));

  for (let i = 2; i <= 5; i++) {
    const r = await submit(C, `${i}本目の要望です`);
    ok(r.v.v.ok === true, `${i}本目まではまだ出せる`, JSON.stringify(r.v.v));
    await ageOut(C);
  }
  const sixth = await submit(C, '6本目の要望です');
  ok(sixth.v.v.ok === false && sixth.v.v.status === 'rate_limited',
     '★24時間に6本目は rate_limited', JSON.stringify(sixth.v.v));
  ok((await db.query(`select count(*)::int as n from public.pv_requests
                       where author_hash = public.pv_request_hash($1)`, [C])).rows[0].n === 5,
     '上限で止めたので5行のまま');

  // 25時間前へ押し戻すと、また出せる（窓が本当に24時間で動いている）
  await db.query(`update public.pv_requests set created_at = now() - interval '25 hours'
                   where author_hash = public.pv_request_hash($1)`, [C]);
  const later = await submit(C, '翌日の要望です');
  ok(later.v.v.ok === true, '24時間の窓が過ぎればまた出せる', JSON.stringify(later.v.v));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ ⑩ 前提が無いときは日本語で止まる');
{
  const db2 = new PGlite({ extensions: { pgcrypto } });
  await db2.waitReady;
  await db2.exec(`
    create schema if not exists extensions;
    create schema if not exists auth;
    create role anon; create role authenticated;
    grant usage on schema public, extensions to anon, authenticated;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('pv.uid', true), '')::uuid $$;
  `);
  let msg = null;
  try { await db2.exec(read('db/requests.sql')); } catch (e) { msg = String(e.message || e); }
  ok(!!msg && msg.includes('db/admin.sql'),
     '★db/admin.sql を先に流していないと、日本語で止まる（黙って半分だけ作らない）', msg || '通ってしまった');
  await db2.close();
}

// ════════════════════════════════════════════════════════════
console.log(`\n${fail === 0 ? '✅' : '❌'} 合計 ${pass} 件成功 / ${fail} 件失敗`);
await db.close();
process.exit(fail === 0 ? 0 : 1);
