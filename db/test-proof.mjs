/* パイロットであることの確認（db/pilot-proof.sql ＋ db/pay-rows.sql 1-e2）を
   本物の Postgres（PGlite = PG17 の WASM ビルド）に流して確かめる。

   実行: node db/test-proof.mjs   （または node check.mjs sql）
   ネットワーク不要・本番に一切触らない。

   器は db/test-requests.mjs と同じ（anon / authenticated ロール、既定権限を
   全付与した状態、auth.uid() の代役、profiles、auth.users、本物の db/admin.sql）。
   ★既定権限を先に全付与してあるからこそ revoke が意味を持つ。

   ここで見ている約束（db/pilot-proof.sql の冒頭の①〜④と、門と印）
     門  … 止めた会員には、REAL PAY・DEEP PAY・口コミ本文の3つとも
           「鍵が無い人」と同じ答えが返る。鍵そのものは書き換わらない。
     印  … その会員が出した行にだけ hold が付く。伏せた一覧には付かない。
           承認した瞬間に消える。
     ①  … 画像は確認待ちのあいだだけ在る（承認・出し直し・手で書き換え・退会）。
     ②  … 画像を読めるのは運営だけ。
     ③  … 会員が自分で止めたり解いたりできない。
     ④  … 止まっていない会員は画像を出せない。

   ⚠️ 会員を名指しで書かない。ここの人は全員、作り物の uuid。
   ⚠️ set_config の第3引数は **false**（＝セッション全体）。true にすると次の文で
      auth.uid() が null に戻り、判定が全部空振りのまま緑になる。 */

import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };

const A     = '00000000-0000-4000-8000-00000000000a';  // 止められる会員
const B     = '00000000-0000-4000-8000-00000000000b';  // 鍵を持つ普通の会員（見る側）
const C     = '00000000-0000-4000-8000-00000000000c';  // もう1人の普通の会員
const D     = '00000000-0000-4000-8000-00000000000d';  // 退会する会員
const ADMIN = '00000000-0000-4000-8000-00000000ad11';  // 運営
const GHOST = '00000000-0000-4000-8000-0000000000ff';  // 居ない会員

// ── 器 ────────────────────────────────────────────────────
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  grant usage on schema public, extensions to anon, authenticated;
  grant usage on schema auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;

  create table public.profiles (
    id uuid primary key, email text, name text,
    gender text, birthdate date, country text, company text, "position" text
  );
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;
  /* 口コミの表。★db/test-reviews-gate.mjs から写した最小形。 */
  create table public.reviews_v2 (
    id          uuid primary key default gen_random_uuid(),
    proof_hash  text not null,
    airline     text not null,
    "position"  text,
    tenure_bucket text, age_bucket text, fleet text, job_role text,
    monthly_salary integer, bonus integer, annual_salary integer,
    base_annual integer, flight_allowance_annual integer,
    culture_score integer, salary_score integer, benefits_score integer,
    wlb_score integer, ops_score integer, training_score integer, mgmt_score integer,
    culture_comment text, salary_comment text, benefits_comment text,
    wlb_comment text, ops_comment text, training_comment text, mgmt_comment text,
    orig_lang   text,
    translations jsonb,
    created_at  timestamptz not null default now()
  );
`);

console.log('\n▼ SQL の適用（本番でオーナーが貼る順）');
const FILES = ['db/airlines.generated.sql', 'db/vocab.generated.sql',
               'db/schema-additions.sql', 'db/pay-reports.sql',
               'db/pay-report-pending.sql', 'db/pay-rows.sql', 'db/admin.sql',
               'db/deep-pay.sql', 'db/reviews-gate.sql', 'db/pilot-proof.sql'];
for (const f of FILES) {
  try { await db.exec(read(f)); ok(true, f); }
  catch (e) { ok(false, f, e.message); process.exit(1); }
}

console.log('\n▼ 冪等性（もう一度そのまま流す）');
for (const f of FILES) {
  try { await db.exec(read(f)); ok(true, f + ' 再適用OK'); }
  catch (e) { ok(false, f + ' 再適用で失敗', e.message); }
}

// ── 人を作る ─────────────────────────────────────────────────
for (const [uid, mail] of [[A, 'a@example.com'], [B, 'b@example.com'], [C, 'c@example.com'],
                           [D, 'd@example.com'], [ADMIN, 'ops@example.com']]) {
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
  try { return { v: (await db.query(sql, params)).rows[0]?.v }; }
  catch (e) { return { err: String(e.message || e) }; }
  finally { await asOwner(); }
};
/* 未ログインとして1文だけ走らせる。 */
const anon = async (sql, params = []) => {
  await db.exec(`set role anon`);
  await db.query(`select set_config('pv.uid', '', false)`);
  try { return { v: (await db.query(sql, params)).rows[0]?.v }; }
  catch (e) { return { err: String(e.message || e) }; }
  finally { await asOwner(); }
};
const own = async (sql, params = []) => (await db.query(sql, params)).rows[0];

/* 給与を出す。対象年は去年（今年だと未来の月が弾かれる）。
   1日10件の上限に当たらないよう、1件ごとに当日カウンタを戻す。 */
const YEAR = new Date().getFullYear() - 1;
const pay = async (uid, extra) => {
  const r = await call(uid, `select public.submit_pay_report($1::jsonb) as v`,
    [JSON.stringify({ currency: 'USD', lang: 'en', tax_rate_pct: 0,
                      period_year: YEAR, period_month: 3, gross_monthly: 12000,
                      position: 'cap', fleet: 'b777', ...extra })]);
  await db.query(`update public.profiles set pay_reports_today = 0`);
  return r;
};

/* 3つの門を、その会員として叩く。 */
const rows   = (uid) => call(uid, `select public.pv_pay_rows() as v`);
const deep   = (uid) => call(uid, `select public.pv_deep_pay('{}'::jsonb) as v`);
const review = (uid) => call(uid, `select public.pv_has_review_key() as v`);
const state  = (uid) => call(uid, `select public.pv_proof_state() as v`);
const give   = (uid, b64) => call(uid, `select public.pv_proof_submit($1) as v`, [b64]);
const adm    = (uid, fn, target) =>
  call(uid, `select public.${fn}(${target === undefined ? '' : '$1'}) as v`,
       target === undefined ? [] : [target]);
const images = async (uid) => Number((await own(
  `select count(*)::int n from public.pv_proof_images where user_id = $1`, [uid])).n);

/* 作り物の JPEG（先頭3バイトだけ本物）。 */
const jpeg = (len, fill = 0x41) => {
  const b = Buffer.alloc(len, fill);
  b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[3] = 0xe0;
  return b.toString('base64');
};
const IMG1 = jpeg(4000, 0x41);
const IMG2 = jpeg(5000, 0x42);

// ── 材料：A は2社（一覧の会社と、打ち込んだ社名）に出す。B・C は1社ずつ ──
const TYPED = 'Somewhere Air';
{
  const r1 = await pay(A, { airline: 'jal' });
  const r2 = await pay(A, { airline: 'other', airline_other: TYPED, position: 'fo', fleet: 'a320' });
  const r3 = await pay(B, { airline: 'ana' });
  const r4 = await pay(C, { airline: 'emirates', position: 'fo', fleet: 'a320' });
  ok(!r1.err && !r2.err && !r3.err && !r4.err, '（前提）4件の給与が入った',
     [r1.err, r2.err, r3.err, r4.err].filter(Boolean).join(' / '));
  // A は口コミも1件出している（口コミ本文の鍵を持っている）
  const h = (await own(`select public.pv_review_hash($1::uuid, 'jal') h`, [A])).h;
  await db.query(`insert into public.reviews_v2(proof_hash, airline, culture_comment)
                  values($1, 'jal', '社風についての本文')`, [h]);
}
/* A が出した行は、一覧で (会社, 職位) がこの2つ。ほかの人と重ならないように作ってある。 */
const isA = (r) => (r.airline === 'jal' && r.pos === 'cap') || (r.pos === 'fo' && r.airline !== 'emirates');
const untilOf = async (uid) => (await own(
  `select access_until::text u from public.profiles where id = $1`, [uid])).u;

// ════════════════════════════════════════════════════════════
console.log('\n▼ 1. 止める前：3つの門は今までどおり開いている');
// ════════════════════════════════════════════════════════════
{
  const s = await state(A);
  ok(s.v?.state === 'none' && s.v?.again === false, '止まっていない会員の状態は none', JSON.stringify(s));
  const r = await rows(A);
  ok(r.v?.state === 'open' && r.v.rows.some(x => x.annual_usd > 0),
     'REAL PAY が開いていて、金額が返る', r.err || r.v?.state);
  ok(r.v.rows.filter(isA).length === 2, '（前提）A の行は2つ（一覧の会社と、打ち込んだ社名）',
     JSON.stringify(r.v.rows.map(x => [x.airline, x.pos])));
  ok(r.v.rows.every(x => !('hold' in x)), '誰も止まっていないとき、どの行にも印が無い');
  const d = await deep(A);
  ok(d.v?.gate?.key === true, 'DEEP PAY の鍵が開いている', d.err || JSON.stringify(d.v?.gate));
  const k = await review(A);
  ok(k.v === true, '口コミ本文の鍵が開いている', JSON.stringify(k));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 2. ③ 会員は自分で止めたり解いたりできない');
// ════════════════════════════════════════════════════════════
for (const [fn, arg] of [['admin_list_proofs', undefined], ['admin_proof_require', B],
                         ['admin_proof_image', B], ['admin_proof_approve', A],
                         ['admin_proof_reject', A]]) {
  const r = await adm(A, fn, arg);
  ok(/管理者ではありません/.test(r.err || ''), `会員が ${fn} を呼ぶと断られる`, JSON.stringify(r));
  const n = await anon(`select public.${fn}(${arg === undefined ? '' : `'${arg}'`}) as v`);
  ok(/permission denied/.test(n.err || ''), `未ログインは ${fn} を呼べない`, JSON.stringify(n));
}
for (const fn of ['pv_proof_state()', `pv_proof_submit('x')`]) {
  const n = await anon(`select public.${fn} as v`);
  ok(/permission denied/.test(n.err || ''), `未ログインは ${fn} を呼べない`, JSON.stringify(n));
}
for (const fn of ['pv_proof_blocked()', 'pv_proof_held_keys()']) {
  const r = await call(A, `select public.${fn} as v`);
  ok(/permission denied/.test(r.err || ''), `会員は ${fn} を直接呼べない`, JSON.stringify(r));
}
for (const [what, sql] of [
  ['pv_proof を読む',        `select count(*) as v from public.pv_proof`],
  ['pv_proof に書く',        `insert into public.pv_proof(user_id, state) values('${B}', 'required')`],
  ['pv_proof を書き換える',  `update public.pv_proof set state = 'approved'`],
  ['pv_proof を消す',        `delete from public.pv_proof`],
  ['pv_proof_images を読む', `select count(*) as v from public.pv_proof_images`],
  ['pv_proof_images に書く', `insert into public.pv_proof_images(user_id, bytes, byte_len) values('${A}', '\\xffd8ff', 3)`]]) {
  const r = await call(A, sql);
  ok(/permission denied/.test(r.err || ''), `会員は表を直接触れない：${what}`, JSON.stringify(r));
}
{
  // ④ 止まっていない会員は画像を出せない
  const r = await give(A, IMG1);
  ok(r.v?.ok === false && r.v.status === 'not_required', '④ 止まっていない会員は画像を出せない', JSON.stringify(r));
  ok(await images(A) === 0, '④ 画像は1枚も置かれていない');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 3. 運営が止める');
// ════════════════════════════════════════════════════════════
const untilBefore = await untilOf(A);
{
  const g = await adm(ADMIN, 'admin_proof_require', GHOST);
  ok(g.v?.ok === false && g.v.status === 'no_member', '居ない会員は止められない', JSON.stringify(g));
  const s = await adm(ADMIN, 'admin_proof_require', ADMIN);
  ok(s.v?.ok === false && s.v.status === 'is_admin', '★運営は止められない（解く人が居なくなる）', JSON.stringify(s));
  const r = await adm(ADMIN, 'admin_proof_require', A);
  ok(r.v?.ok === true && r.v.state === 'required' && r.v.changed === true, 'A を止めた', JSON.stringify(r));
  const r2 = await adm(ADMIN, 'admin_proof_require', A);
  ok(r2.v?.ok === true && r2.v.changed === false, 'もう一度押しても何も変わらない', JSON.stringify(r2));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 4. ★門：止めた会員には、3つとも「鍵が無い人」と同じ答えが返る');
// ════════════════════════════════════════════════════════════
const MK3 = ['age', 'airline', 'verified'];
{
  const s = await state(A);
  ok(s.v?.state === 'required' && s.v.again === false, 'A の状態は required', JSON.stringify(s));

  const r = await rows(A);
  ok(r.v?.state === 'locked', '★REAL PAY が閉じる', r.err || r.v?.state);
  ok(r.v.rows.length > 0 && r.v.rows.every(x => Object.keys(x).sort().join() === MK3.join()),
     '★返る行は 会社・出典・投稿時期 の3つだけ（金額・職位・機材が1つも無い）',
     JSON.stringify(r.v.rows[0]));
  const n = await anon(`select public.pv_pay_rows() as v`);
  ok(JSON.stringify(n.v?.rows) === JSON.stringify(r.v.rows),
     '★その行は、未ログインの人に返る行と1文字も違わない');

  const d = await deep(A);
  ok(d.v?.gate?.key === false && d.v.state === 'locked', '★DEEP PAY が閉じる',
     d.err || JSON.stringify([d.v?.state, d.v?.gate]));
  ok(d.v.cohort == null && d.v.comp == null && d.v.head == null,
     '★DEEP PAY の中身（区分・構成・見出しの数字）が1つも返らない');

  const k = await review(A);
  ok(k.v === false, '★口コミ本文の鍵が閉じる', JSON.stringify(k));

  ok(await untilOf(A) === untilBefore && untilBefore !== null,
     '★鍵そのもの（access_until）は書き換えていない');
  const h = (await own(`select public.pv_review_hash($1::uuid, 'jal') h`, [A])).h;
  ok(Number((await own(`select count(*)::int n from public.reviews_v2 where proof_hash = $1`, [h])).n) === 1,
     '★口コミそのものも触っていない');

  // 止めたあとに給与を出しても開かない（鍵が延びるだけで、門は閉じたまま）
  const p = await pay(A, { airline: 'jal', period_month: 4 });
  ok(!p.err, '（止まっていても給与は出せる ── 匿名でも出せるので、ここで断っても意味が無い）', p.err);
  ok((await rows(A)).v?.state === 'locked', '★止まっているあいだに給与を出しても REAL PAY は開かない');

  // ほかの会員は何も変わらない
  const b = await rows(B);
  ok(b.v?.state === 'open', 'ほかの会員の REAL PAY は開いたまま', b.err || b.v?.state);
  ok((await deep(B)).v?.gate?.key === true, 'ほかの会員の DEEP PAY の鍵も開いたまま');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 5. ★印：止めた会員が出した行にだけ hold が付く');
// ════════════════════════════════════════════════════════════
{
  const b = await rows(B);
  const R = b.v.rows;
  const mine = R.filter(isA), rest = R.filter(x => !isA(x));
  ok(mine.length === 2 && mine.every(x => x.hold === true),
     '★A の行は2つとも印が付く（一覧の会社の行と、打ち込んだ社名の行）',
     JSON.stringify(mine.map(x => [x.airline, x.pos, x.hold])));
  ok(rest.length >= 2 && rest.every(x => !('hold' in x)),
     '★ほかの人の行には鍵ごと無い（false や null で全行に生やさない）',
     JSON.stringify(rest.map(x => [x.airline, x.pos, x.hold])));
  ok(mine.every(x => x.annual_usd > 0),
     '★数字は書き換えていない・行も消していない（金額がそのまま出る）');
  ok((await rows(ADMIN)).v.rows.filter(isA).every(x => x.hold === true), '運営の一覧にも同じ印が出る');
  const n = await anon(`select public.pv_pay_rows() as v`);
  ok(n.v.rows.every(x => !('hold' in x)), '★伏せた一覧（未ログイン）には印を返さない');
  ok(!JSON.stringify(b.v).includes(A) && !JSON.stringify(b.v).includes('pv_pay'),
     '★返り値に会員の id も鍵の材料も出ない');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 6. 会員が画像を出す');
// ════════════════════════════════════════════════════════════
{
  const bad = [
    ['空',                 '',                                    'image_bad'],
    ['base64 でない',      '%%%not-base64%%%',                    'image_bad'],
    ['JPEG でない（PNG）', Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(400)]).toString('base64'), 'image_bad'],
    ['小さすぎる',         Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64'), 'image_bad'],
    ['900KB を超える',     jpeg(900001),                          'image_too_big'],
    ['長すぎる文字列',     'A'.repeat(1250001),                   'image_too_big']];
  for (const [what, b64, want] of bad) {
    const r = await give(A, b64);
    ok(r.v?.ok === false && r.v.status === want, `受け取らない：${what} → ${want}`, JSON.stringify(r).slice(0, 200));
  }
  ok(await images(A) === 0, '断った画像は1枚も置かれていない');
  ok((await state(A)).v?.state === 'required', '断ったあとも状態は required のまま');

  const r = await give(A, IMG1);
  ok(r.v?.ok === true && r.v.state === 'submitted', 'JPEG を受け取る', JSON.stringify(r));
  ok(!('b64' in (r.v || {})) && !JSON.stringify(r.v).includes(IMG1.slice(0, 40)),
     '② 返事に画像そのものは入っていない');
  ok(await images(A) === 1, '画像が1枚置かれた');
  const s = await state(A);
  ok(s.v?.state === 'submitted', 'A の状態は submitted', JSON.stringify(s));
  ok(Object.keys(s.v).sort().join() === 'again,state', '② 状態の返事は again と state の2つだけ（画像を返さない）');
  ok((await rows(A)).v?.state === 'locked' && (await review(A)).v === false,
     '★出しただけでは開かない（運営が確認するまで閉じたまま）');
  ok((await rows(B)).v.rows.filter(isA).every(x => x.hold === true), '★確認待ちのあいだも印は付いたまま');

  // 出し直しは上書き（2枚目を作らない）
  const r2 = await give(A, IMG2);
  ok(r2.v?.ok === true && await images(A) === 1, '出し直すと上書きされる（1人1枚のまま）', JSON.stringify(r2));

  // ② 本人も、ほかの会員も、画像を読めない
  for (const who of [A, B]) {
    const x = await adm(who, 'admin_proof_image', A);
    ok(/管理者ではありません/.test(x.err || ''), `② ${who === A ? '出した本人' : 'ほかの会員'}は画像を読めない`, JSON.stringify(x));
  }
  // ほかの会員は出せない
  const o = await give(B, IMG1);
  ok(o.v?.ok === false && o.v.status === 'not_required' && await images(B) === 0,
     '④ 止まっていない会員が出しても置かれない', JSON.stringify(o));

  // 連投の上限
  await db.query(`update public.pv_proof set tries = 10 where user_id = $1`, [A]);
  const t = await give(A, IMG1);
  ok(t.v?.ok === false && t.v.status === 'too_many', '10回を超えると受け取らない', JSON.stringify(t));
  await db.query(`update public.pv_proof set tries = 2 where user_id = $1`, [A]);
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 7. 運営が見る');
// ════════════════════════════════════════════════════════════
{
  const l = await adm(ADMIN, 'admin_list_proofs');
  const row = (l.v || []).find(x => x.user_id === A);
  ok(row && row.state === 'submitted' && row.has_image === true && row.byte_len === 5000,
     '一覧に A が確認待ちで出る（画像あり・大きさ）', JSON.stringify(l).slice(0, 300));
  ok(!JSON.stringify(l.v).includes(IMG2.slice(0, 40)) && !('b64' in (row || {})) && !('bytes' in (row || {})),
     '一覧には画像そのものを入れない');
  ok(!('email' in (row || {})) && !('name' in (row || {})),
     '一覧に氏名・メールを入れない（会員の表は admin_list_profiles の1か所から）');
  const i = await adm(ADMIN, 'admin_proof_image', A);
  ok(i.v?.ok === true && i.v.mime === 'image/jpeg' && i.v.b64.replace(/\s/g, '') === IMG2,
     '運営は、出された画像をそのまま見られる（出し直した後の1枚）', JSON.stringify(i).slice(0, 120));
  const none = await adm(ADMIN, 'admin_proof_image', B);
  ok(none.v?.ok === false && none.v.status === 'none', '画像の無い会員は none', JSON.stringify(none));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 8. ① 出し直しを求めると、画像はその場で消える（会員は止まったまま）');
// ════════════════════════════════════════════════════════════
{
  const r = await adm(ADMIN, 'admin_proof_reject', A);
  ok(r.v?.ok === true && r.v.state === 'required' && r.v.discarded === 1, '出し直しを求めた', JSON.stringify(r));
  ok(await images(A) === 0, '★画像が消えている');
  const s = await state(A);
  ok(s.v?.state === 'required' && s.v.again === true, '会員の板は「出し直し」を言う（again）', JSON.stringify(s));
  ok((await rows(A)).v?.state === 'locked', '会員は止まったまま');
  const r2 = await adm(ADMIN, 'admin_proof_reject', A);
  ok(r2.v?.ok === false && r2.v.status === 'none', '確認待ちでない会員には押せない', JSON.stringify(r2));
  ok((await adm(ADMIN, 'admin_proof_image', A)).v?.status === 'none', '運営にも、もう画像は返らない');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 9. ① 承認すると、画像はその場で消え、3つの門が元どおり開く');
// ════════════════════════════════════════════════════════════
{
  const g = await give(A, IMG1);
  ok(g.v?.ok === true && await images(A) === 1, '（前提）A が出し直した', JSON.stringify(g));
  ok((await state(A)).v?.again === false, '出し直したら again は消える');

  const r = await adm(ADMIN, 'admin_proof_approve', A);
  ok(r.v?.ok === true && r.v.state === 'approved' && r.v.discarded === 1, '承認した', JSON.stringify(r));
  ok(await images(A) === 0, '★★承認した瞬間に画像が消えている');
  ok(Number((await own(`select count(*)::int n from public.pv_proof_images`)).n) === 0,
     '★★画像の表は空');

  ok((await state(A)).v?.state === 'none', '会員の状態は none（前に求められたことは画面へ渡さない）');
  const a = await rows(A);
  ok(a.v?.state === 'open' && a.v.rows.some(x => x.annual_usd > 0), '★REAL PAY が元どおり開く', a.err || a.v?.state);
  ok((await deep(A)).v?.gate?.key === true, '★DEEP PAY の鍵が元どおり開く');
  ok((await review(A)).v === true, '★口コミ本文の鍵が元どおり開く');
  ok((await rows(B)).v.rows.every(x => !('hold' in x)), '★印が消える（どの行にも hold が無い）');

  const l = await adm(ADMIN, 'admin_list_proofs');
  const row = (l.v || []).find(x => x.user_id === A);
  ok(row && row.state === 'approved' && row.has_image === false && row.decided_at,
     '一覧には「承認済み」として控えが残る（画像なし）', JSON.stringify(row));
  const r2 = await adm(ADMIN, 'admin_proof_approve', A);
  ok(r2.v?.ok === false && r2.v.status === 'none', '承認済みの会員にもう一度は押せない', JSON.stringify(r2));
  ok((await give(A, IMG1)).v?.status === 'not_required' && await images(A) === 0,
     '④ 承認済みの会員は、もう画像を出せない');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 10. ① は関数ではなく表が守っている（手で書き換えても残らない）');
// ════════════════════════════════════════════════════════════
{
  // 画像なしでも承認できる（止める相手を間違えたときに解く道）
  await adm(ADMIN, 'admin_proof_require', C);
  const c = await adm(ADMIN, 'admin_proof_approve', C);
  ok(c.v?.ok === true && c.v.discarded === 0 && (await rows(C)).v?.state === 'open',
     '画像が無くても承認できる（discarded は 0 ＝ 消えていないのに「破棄した」と言わない）', JSON.stringify(c));

  // 承認済みにもう一度求められる。回数は戻る
  const again = await adm(ADMIN, 'admin_proof_require', A);
  const t = await own(`select tries, submitted_at, decided_at from public.pv_proof where user_id = $1`, [A]);
  ok(again.v?.changed === true && t.tries === 0 && t.submitted_at === null && t.decided_at === null,
     '承認済みの会員にもう一度求められる（回数と時刻は最初から）', JSON.stringify([again, t]));
  ok((await rows(A)).v?.state === 'locked', 'もう一度止まる');
  await give(A, IMG1);
  ok(await images(A) === 1, '（前提）画像が在る');

  // SQL Editor から手で承認済みに書き換える
  await db.query(`update public.pv_proof set state = 'approved' where user_id = $1`, [A]);
  ok(await images(A) === 0, '★手で state を approved に書き換えても、画像は残らない（引き金）');

  // 確認待ちでない会員に画像を置こうとする
  let err = '';
  try {
    await db.query(`insert into public.pv_proof_images(user_id, bytes, byte_len)
                    values($1, decode($2, 'base64'), 4000)`, [A, IMG1]);
  } catch (e) { err = String(e.message || e); }
  ok(/確認待ちではない/.test(err) && await images(A) === 0,
     '★承認済みの会員に、手で画像を置くこともできない（網）', err);

  // ── 壊す証明：引き金を外すと、承認そのものが通らない ──
  await adm(ADMIN, 'admin_proof_require', A);
  await give(A, IMG1);
  await db.exec(`drop trigger pv_proof_discard on public.pv_proof`);
  const broken = await adm(ADMIN, 'admin_proof_approve', A);
  ok(/画像を破棄できませんでした/.test(broken.err || ''),
     '★壊す証明：引き金を外すと、承認は「破棄できませんでした」で止まる', JSON.stringify(broken));
  const st = await own(`select state from public.pv_proof where user_id = $1`, [A]);
  ok(st.state === 'submitted' && await images(A) === 1 && (await rows(A)).v?.state === 'locked',
     '★そのとき承認は丸ごと巻き戻る（画像を残したまま開くことはない）', JSON.stringify(st));
  const brokenR = await adm(ADMIN, 'admin_proof_reject', A);
  ok(/画像を破棄できませんでした/.test(brokenR.err || ''), '★出し直しも同じく止まる', JSON.stringify(brokenR));
  await db.exec(read('db/pilot-proof.sql'));   // 貼り直すと引き金が戻る
  const fixed = await adm(ADMIN, 'admin_proof_approve', A);
  ok(fixed.v?.ok === true && fixed.v.discarded === 1 && await images(A) === 0,
     'ファイルを貼り直すと引き金が戻り、承認で画像が消える', JSON.stringify(fixed));

  // ── 壊す証明：門の1行を外すと、止めた会員に REAL PAY が開く ──
  await adm(ADMIN, 'admin_proof_require', A);
  const src = read('db/pay-rows.sql');
  const cut = src.replace(/\n\s+and not public\.pv_proof_blocked\(\);/, () => ';');
  ok(cut !== src, '（前提）門の1行を切り取れた');
  await db.exec(cut);
  ok((await rows(A)).v?.state === 'open', '★壊す証明：門の1行を外すと、止めた会員に REAL PAY が開いてしまう');
  await db.exec(src);
  ok((await rows(A)).v?.state === 'locked', '戻すと閉じる');
  await adm(ADMIN, 'admin_proof_approve', A);
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 11. 会員を消すと、控えも画像も一緒に消える');
// ════════════════════════════════════════════════════════════
{
  await adm(ADMIN, 'admin_proof_require', D);
  await give(D, IMG1);
  ok(await images(D) === 1, '（前提）D の画像が在る');
  await db.query(`delete from public.profiles where id = $1`, [D]);
  const n = await own(`select (select count(*) from public.pv_proof where user_id = $1)::int a,
                              (select count(*) from public.pv_proof_images where user_id = $1)::int b`, [D]);
  ok(n.a === 0 && n.b === 0, '★会員の行を消すと、確認の控えも画像も残らない', JSON.stringify(n));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12. ファイル末尾の検算（オーナーが貼ったときに見る表）');
// ════════════════════════════════════════════════════════════
{
  const res = await db.exec(read('db/pilot-proof.sql'));
  const last = res[res.length - 1].rows;
  ok(last.length === 8, '検算は8行', String(last.length));
  for (const r of last) ok(r['結果'] === '✅', `${r['#']}. ${r['項目']}`, r['結果']);
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 13. 会員を名指しで書いていない（公開リポジトリ）');
// ════════════════════════════════════════════════════════════
{
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const MAIL = /[A-Za-z0-9._%+-]+@(?!example\.com)[A-Za-z0-9.-]+\.[a-z]{2,}/;
  for (const f of ['db/pilot-proof.sql']) {
    const s = read(f);
    ok(!UUID.test(s), `${f} に会員の id が1つも書かれていない`);
    ok(!MAIL.test(s), `${f} にメールアドレスが1つも書かれていない`);
  }
  const sec = read('db/pay-rows.sql').split('-- 1-e2. pv_proof')[1].split('-- 1-f. pv_contributors')[0];
  ok(!UUID.test(sec) && !MAIL.test(sec), 'db/pay-rows.sql の 1-e2 にも id・メールが書かれていない');
}

console.log(`\n${fail === 0 ? '✅ 全部通った' : '❌ 落ちた'}  pass ${pass} / fail ${fail}`);
process.exit(fail === 0 ? 0 : 1);
