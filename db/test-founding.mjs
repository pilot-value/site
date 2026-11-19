/* db/founding.sql を本物の Postgres（PGlite = PG17 の WASM ビルド）に流して確かめる。

   実行: node db/test-founding.mjs   （または npm run test:sql）
   ネットワーク不要・本番に一切触らない。SQL を直したら必ずこれを通してから
   オーナーに実行を依頼すること。

   器は db/test-referrals.mjs と同じ（anon / authenticated ロール、既定権限を
   全付与した状態、auth.uid() の代役、profiles）。既定権限を先に全付与してある
   からこそ founding.sql の revoke が意味を持つ。無いと「元から権限が無いだけ」を
   「revoke が効いた」と誤読する。

   ★ここでいちばん大事な2行:
     ① 本人が自分の番号を書き換えられないこと。
        profiles に列を足す案を捨てたのは、db/admin.sql:81 が profiles を
        列単位の制限なしで authenticated に update 可能にしているから。
        同じ穴を新しい表で作り直していないかを、画面ではなく権限で押さえる。
     ② 番号が凍結していること。行を消しても他人の番号が動かない・
        消えた番号が使い回されない。動くならそれは称号ではない。

   ★口コミ側のハッシュは submit-review.html の makeProofHash を**切り出して**
     動かす（写経しない）。給与側は本物の submit_pay_report に作らせる。
     どちらかの式が変わったら、ここが落ちて気づける。
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
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const rows = async (sql, params) => (await db.query(sql, params)).rows;
const boom = async (sql, params) => {
  try { await db.query(sql, params); return null; } catch (e) { return String(e.message || e); }
};

// ── 口コミのハッシュ：submit-review.html の実体をそのまま動かす ──────
/* reviews_v2 の作成 SQL はこのリポジトリに無い（Supabase の画面で作られた）。
   だから下の器は手で書いた最小形で、本物と同じなのは
   「proof_hash / airline / created_at がある」ところまで。 */
const reviewSrc = (() => {
  const s = read('submit-review.html');
  const i = s.indexOf('async function makeProofHash');
  if (i < 0) throw new Error('submit-review.html から makeProofHash を見つけられない');
  const j = s.indexOf('\n}', i);
  return s.slice(i, j + 2);
})();
const makeProofHash = new Function(`return (${reviewSrc})`)();

// ── 器 ───────────────────────────────────────────────────────
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  create role service_role;
  grant usage on schema public, extensions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated;

  create table public.profiles (
    id uuid primary key, email text, name text,
    email_opt_in boolean not null default false
  );
  /* ★2026-11-19 口コミの保留（db/reviews-gate.sql）を土台に足した。運営の名簿と、
     本番の pv_is_admin（db/admin.sql）と同じ式（db/test-reviews-gate.mjs と同じ器）。 */
  create table auth.users (id uuid primary key, email text);
  create table public.pv_admins (
    user_id uuid primary key references auth.users(id) on delete cascade,
    note text, added_at timestamptz not null default now());

  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;
  create function public.pv_is_admin() returns boolean language sql stable
    security definer set search_path = public as $$
      select exists (select 1 from public.pv_admins a where a.user_id = auth.uid()) $$;
`);

const FILES = ['db/airlines.generated.sql', 'db/vocab.generated.sql',
               'db/pay-reports.sql', 'db/pay-report-pending.sql'];

console.log('\n▼ 土台の適用');
for (const f of FILES) {
  try { await db.exec(read(f)); console.log(`  ✅ ${f}`); pass++; }
  catch (e) { console.log(`  ❌ ${f}\n     ${e.message}`); fail++; process.exit(1); }
}

/* 口コミの表。founding.sql が触るのは id / proof_hash / airline / created_at だけだが、
   ★2026-11-19 から保留（db/reviews-gate.sql）を土台に貼るので、あちらの関数が読む列も並べる
   （本番の定義はリポジトリに無い。db/test-reviews-gate.mjs と同じ最小形）。 */
await db.exec(`
  create table public.reviews_v2 (
    id         uuid primary key default gen_random_uuid(),
    proof_hash text not null,
    airline    text not null references public.pv_airlines(code),
    "position"  text, tenure_bucket text, age_bucket text, fleet text, job_role text,
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
for (const f of ['db/pay-rows.sql', 'db/reviews-gate.sql']) {   // 口コミの保留の土台（本番と同じ順）
  try { await db.exec(read(f)); ok(true, f); }
  catch (e) { ok(false, f, e.message); process.exit(1); }
}

console.log('\n▼ db/founding.sql の適用');
try { await db.exec(read('db/founding.sql')); ok(true, 'db/founding.sql'); }
catch (e) { ok(false, 'db/founding.sql', e.message); process.exit(1); }
try { await db.exec(read('db/founding.sql')); ok(true, 'db/founding.sql 再適用OK（冪等）'); }
catch (e) { ok(false, 'db/founding.sql 再適用で失敗', e.message); }

/* 先に流していない状態を弾くか（reviews_v2 が無いと止まる）。 */
{
  const t = new PGlite({ extensions: { pgcrypto } });
  await t.waitReady;
  await t.exec(`create table public.profiles (id uuid primary key);`);
  let msg = null;
  try { await t.exec(read('db/founding.sql')); } catch (e) { msg = String(e.message || e); }
  ok(msg !== null && /pay_reports|reviews_v2/.test(msg),
     '土台が無いまま流すと、何が足りないかを言って止まる', msg ?? '(止まらなかった)');
  await t.close();
}

// ── 道具 ─────────────────────────────────────────────────────
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const asUser = async (n) => {
  await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`,
    [uid(n), `p${n}@example.com`]);
  await db.query(`select set_config('pv.uid', $1, false)`, [uid(n)]);
};
const asAnon = async () => { await db.query(`select set_config('pv.uid', '', false)`); };
const submit = (payload) => one(`select submit_pay_report($1::jsonb) r`, [JSON.stringify(payload)]);
const mine   = async () => (await one(`select my_founding() r`)).r;
const noOf   = async (n) =>
  (await one(`select "no" from founding_members where user_id=$1`, [uid(n)]))?.no ?? null;
const roster = () => rows(`select user_id, "no", first_source from founding_members order by "no"`);

const BASE = {
  airline: 'emirates', currency: 'AED',
  base_pay: 20000, hourly_rate: 250, guaranteed_hours: 75, block_hours: 85,
  per_diem: 3000, housing_type: 'allowance', housing_amount: 10000,
  base_iata: 'DXB', seniority_years: 15, rank_years: 4, tax_rate_pct: 0, lang: 'en',
  age_bucket: '40-49', position: 'cap', fleet: 'b777',
};
/* 口コミを1件出す（本物のハッシュで）。 */
const review = async (n, airline = 'emirates') => {
  const h = await makeProofHash(uid(n), airline);
  await db.query(`insert into reviews_v2(proof_hash, airline) values($1,$2)`, [h, airline]);
};


// ════════════════════════════════════════════════════════════
console.log('\n▼ 番号が入る');
// ════════════════════════════════════════════════════════════
await asUser(1);
ok((await mine()).no === null, '出す前は番号が無い（null。0 でも「まだ」でもない）');

await review(1);
ok(await noOf(1) === 1, `口コミ1件で 1 番が入る → ${await noOf(1)}`);
ok((await mine()).no === 1, 'my_founding が自分の番号を返す');
ok((await one(`select first_source s from founding_members where user_id=$1`, [uid(1)])).s === 'review',
   'どちらで入ったかが残る（review）');

await asUser(2);
await submit({ ...BASE, period_year: 2026, period_month: 1 });
ok(await noOf(2) === 2, `給与レポート1件で 2 番が入る → ${await noOf(2)}`);
ok((await one(`select first_source s from founding_members where user_id=$1`, [uid(2)])).s === 'pay',
   'どちらで入ったかが残る（pay）');

// ── 番号は増えない・動かない ──────────────────────────────
await asUser(1);
await review(1, 'qatar-airways');
await submit({ ...BASE, airline: 'qatar-airways', currency: 'QAR', base_iata: 'DOH',
               period_year: 2026, period_month: 2 });
ok(await noOf(1) === 1, '同じ人が何度出しても番号は1つ・変わらない');
ok((await roster()).length === 2, `名簿は2人のまま → ${(await roster()).length}`);

// 同じ月を出し直しても（on conflict do update）番号は動かない
await asUser(2);
await submit({ ...BASE, period_year: 2026, period_month: 1, base_pay: 21000 });
ok(await noOf(2) === 2, '同じ月の出し直しでも番号は動かない');


// ════════════════════════════════════════════════════════════
console.log('\n▼ 番号は凍結している（消しても動かない・使い回さない）');
// ════════════════════════════════════════════════════════════
await db.query(`delete from founding_members where "no" = 1`);
ok(await noOf(2) === 2, '1番を消しても 2番の人は 2 のまま（詰め直さない）');

await asUser(3);
await review(3);
ok(await noOf(3) === 3, `次の人は 3（空いた 1 を使い回さない）→ ${await noOf(3)}`);

// 退会：本人との紐付けだけ消えて、番号は残る（使い回さないため）
await db.query(`delete from profiles where id=$1`, [uid(3)]);
ok(await noOf(3) === null, '退会すると本人と名簿の紐付けが切れる');
ok((await rows(`select 1 from founding_members where "no"=3 and user_id is null`)).length === 1,
   '行そのものは残る（番号・review|pay・日付だけ。誰だったかは残らない）');
await asUser(4);
await review(4);
ok(await noOf(4) === 4, `それでも次は 4（消えた番号は使い回さない）→ ${await noOf(4)}`);


// ════════════════════════════════════════════════════════════
console.log('\n▼ 自分の番号しか分からない');
// ════════════════════════════════════════════════════════════
await asUser(2);
const m2 = await mine();
ok(m2.no === 2, '自分の番号は返る');
ok(Object.keys(m2).sort().join(',') === 'no,ok',
   `返るのは ok と no だけ → ${Object.keys(m2).sort().join(',')}`);
ok(!JSON.stringify(m2).includes('4'),
   '他人の番号も総数も残り枠も入っていない');

await asUser(99);
ok((await mine()).no === null, '出していない人は null（「あと何人で埋まる」も返さない）');

await asAnon();
ok((await boom(`select my_founding()`) || '').includes('ログインが必要'),
   'ログインしていないと呼べない');

// 名簿そのものの守り
await asUser(2);
await db.exec(`set role authenticated`);
ok((await rows(`select * from founding_members`)).length === 1,
   '自分の1行しか読めない（RLS）');
ok((await boom(`insert into founding_members(user_id,"no",first_source)
                values($1,1,'review')`, [uid(2)]) || '').includes('permission denied'),
   '自分を1番として書き込めない');
ok((await boom(`update founding_members set "no" = 1`) || '').includes('permission denied'),
   '自分の番号を1番に書き換えられない');
ok((await boom(`delete from founding_members`) || '').includes('permission denied'),
   '名簿を消せない');
ok((await boom(`select pv_backfill_founding()`) || '').includes('permission denied'),
   '遡って振る関数を呼べない（番号を作り直せない）');
await db.exec(`reset role`);

await db.exec(`set role anon`);
ok((await boom(`select * from founding_members`) || '').includes('permission denied'),
   'ログインしていない人は名簿を1行も読めない');
ok((await boom(`select my_founding()`) || '').includes('permission denied'),
   'ログインしていない人は関数を呼べない');
await db.exec(`reset role`);


// ════════════════════════════════════════════════════════════
console.log('\n▼ 遡って振る（pv_backfill_founding）');
// ════════════════════════════════════════════════════════════
/* いまある投稿を消さずに名簿だけ空にして、出した順に振り直させる。
   ★ ここで突き合わせているのは
     ・給与 = 本物の submit_pay_report が作った proof_hash
     ・口コミ = submit-review.html から切り出した makeProofHash が作った proof_hash
     どちらかの式と founding.sql の式がずれたら、ここが 0人 になって落ちる。 */
await db.query(`delete from founding_members`);

// 出した順を作る（同じトランザクションでは now() が同じなので手でずらす）
await db.query(`update reviews_v2  set created_at = now() - interval '30 days'
                 where proof_hash = $1`, [await makeProofHash(uid(1), 'emirates')]);
await db.query(`update reviews_v2  set created_at = now() - interval '5 days'
                 where proof_hash = $1`, [await makeProofHash(uid(4), 'emirates')]);
await db.query(`update pay_reports set created_at = now() - interval '20 days'`);

await asUser(5);   // 番号は持たないが profiles にはいる人（投稿ゼロ）
const bf = await rows(`select * from pv_backfill_founding()`);
ok(bf.length === 3, `出した人にだけ番号が入る（投稿ゼロの人は入らない）→ ${bf.length}人`);
ok(await noOf(1) === 1, `いちばん早く出した人が 1 → ${await noOf(1)}`);
ok(await noOf(2) === 2, `次に早い人が 2 → ${await noOf(2)}`);
ok(await noOf(4) === 3, `最後に出した人が 3 → ${await noOf(4)}`);
ok((await one(`select first_source s from founding_members where user_id=$1`, [uid(2)])).s === 'pay',
   '遡ったぶんも「どちらで入ったか」が残る');
ok((await one(`select awarded_at::date = (now() - interval '30 days')::date d
                 from founding_members where user_id=$1`, [uid(1)])).d === true,
   '日付は「番号を渡した日」ではなく「最初に出した日」');

const before = JSON.stringify(await roster());
await rows(`select * from pv_backfill_founding()`);
ok(JSON.stringify(await roster()) === before, '2回流しても結果が変わらない（冪等）');

// 動作確認用のアカウントを外す
await db.query(`delete from founding_members`);
await rows(`select * from pv_backfill_founding($1::uuid[])`, [[uid(2)]]);
ok(await noOf(2) === null, '外したアカウントには番号が入らない');
ok(await noOf(1) === 1 && await noOf(4) === 2,
   `外したぶんを詰めて 1・2 になる → ${await noOf(1)}・${await noOf(4)}`);

// 遡ったあとに新しく出した人は、その続きから
await asUser(6);
await review(6);
ok(await noOf(6) === 3, `遡ったあとの新しい人は続きの 3 → ${await noOf(6)}`);


// ════════════════════════════════════════════════════════════
console.log('\n▼ 保留中の口コミでは付けない（2026-11-19）');
// ════════════════════════════════════════════════════════════
/* 保留は、口コミが入った数秒後に translate-review が判定の表（pv_review_judge）へ書く。
   ここでは判定の表に直に書いて（運営の答えは本物の admin_review_hold_decide で）確かめる。 */
{
  const ridOf = async (n, airline = 'emirates') =>
    (await one(`select id from reviews_v2 where proof_hash = $1`, [await makeProofHash(uid(n), airline)])).id;
  const judge = (rid, verdict, src = 'r') => db.query(
    `insert into public.pv_review_judge (src, rid, body_sha, verdict, reason)
     values ($1, $2, 'sha', $3, $4)
     on conflict (src, rid) do update set verdict = excluded.verdict, reason = excluded.reason,
                                          decided = null, decided_at = null, decided_by = null`,
    [src, rid, verdict, verdict === 'hold' ? 'spam' : null]);
  const ADMIN = 320;
  await db.query(`insert into auth.users(id) values($1) on conflict do nothing`, [uid(ADMIN)]);
  await db.query(`insert into public.pv_admins(user_id) values($1) on conflict do nothing`, [uid(ADMIN)]);
  const decide = async (rid, d) => {
    await asUser(ADMIN);
    const r = (await one(`select public.admin_review_hold_decide('r', $1::uuid, $2) r`, [rid, d])).r;
    return r;
  };

  await asUser(300); await review(300);
  const n300 = await noOf(300);
  ok(typeof n300 === 'number', `口コミを出した時点では今までどおり付く（${n300} 番）`);
  await judge(await ridOf(300), 'ok');
  ok(await noOf(300) === n300, '判定が ok なら何も変わらない');

  await asUser(301); await review(301);
  const n301 = await noOf(301);
  await judge(await ridOf(301), 'hold');
  ok(await noOf(301) === null, '★口コミだけで称号を得た人は、その口コミが保留になったら外れる');
  await asUser(301);
  ok((await mine()).no === null, '  本人の my_founding も null');

  await asUser(305); await review(305);
  ok(await noOf(305) === n301, `外した番号がいちばん大きければ、次の人がそのまま使う（${await noOf(305)} 番）`);

  const d1 = await decide(await ridOf(301), 'show');
  ok(d1 && d1.ok === true, '運営が「出す」にできる', JSON.stringify(d1));
  ok(typeof await noOf(301) === 'number', `★運営が「出す」にしたら付け直す（${await noOf(301)} 番）`);

  await asUser(302);
  await submit({ ...BASE, airline: 'qatar-airways', period_year: 2026, period_month: 2 });
  await review(302);
  const n302 = await noOf(302);
  await judge(await ridOf(302), 'hold');
  ok(await noOf(302) === n302, '★給与を出した人は、口コミが保留になっても外れない');

  await asUser(303); await review(303); await review(303, 'qatar-airways');
  const n303 = await noOf(303);
  await judge(await ridOf(303, 'qatar-airways'), 'hold');
  ok(await noOf(303) === n303, '保留になっていない口コミがほかにあれば外れない');

  await asUser(304); await review(304);
  await judge(await ridOf(304), 'hold');
  ok(await noOf(304) === null, '保留で外れる');
  const rid304 = await ridOf(304);
  const d2 = await decide(rid304, 'delete');
  ok(d2 && d2.ok === true && await noOf(304) === null, '運営が「消す」にしたら外れたまま（口コミごと消える）', JSON.stringify(d2));

  await judge(await ridOf(300), 'hold');
  ok(await noOf(300) === null, '「出す」のあとに書き直されて保留になった口コミでも外れる');
  await judge(await ridOf(300), 'ok');
  ok(typeof await noOf(300) === 'number', '判定し直して ok になったら付け直す');

  /* 運営が SQL で外した番号（試験用の口座など）は、判定のたびに生き返らない */
  await asUser(306); await review(306);
  await db.query(`delete from founding_members where user_id = $1`, [uid(306)]);
  await judge(await ridOf(306), 'ok');
  await judge(await ridOf(306), 'ok');
  ok(await noOf(306) === null, '★運営が外した番号は、保留が解けたとき以外に付け直さない');

  const before = JSON.stringify(await roster());
  await judge('00000000-0000-4000-8000-000000009999', 'hold', 'q');
  ok(JSON.stringify(await roster()) === before, 'ログインなしの預かり（q）の判定では名簿が動かない');

  /* この貼り付けより前に保留になった口コミ（2026-11-16〜）を、ファイルを貼ると1回だけ直す */
  await asUser(307); await review(307);
  await db.exec(`alter table public.pv_review_judge disable trigger pv_founding_on_judge`);
  await judge(await ridOf(307), 'hold');
  await db.exec(`alter table public.pv_review_judge enable trigger pv_founding_on_judge`);
  ok(typeof await noOf(307) === 'number', '（引き金の無かった頃に保留になった口コミ：まだ付いている）');
  await db.exec(read('db/founding.sql'));
  ok(await noOf(307) === null, '★ファイルを貼ると、いま保留中の口コミだけで付いていた分が外れる');
  const again = JSON.stringify(await roster());
  await db.exec(read('db/founding.sql'));
  ok(JSON.stringify(await roster()) === again, '  もう一度貼っても名簿は変わらない');

  /* 称号のために保留を落とさない */
  await asUser(308); await review(308);
  await db.exec(`alter table public.founding_members rename to founding_members_hidden`);
  const threw = await boom(
    `insert into public.pv_review_judge (src, rid, body_sha, verdict, reason) values ('r', $1, 'sha', 'hold', 'spam')`,
    [await ridOf(308)]);
  await db.exec(`alter table public.founding_members_hidden rename to founding_members`);
  ok(threw === null, '名簿が壊れていても判定（保留）は書ける', threw ?? '');

  /* 壊す証明：引き金を外すと、保留になっても外れない */
  await db.exec(`drop trigger pv_founding_on_judge on public.pv_review_judge`);
  await asUser(309); await review(309);
  await judge(await ridOf(309), 'hold');
  ok(typeof await noOf(309) === 'number', '★壊す証明：判定の表の引き金を外すと、保留中の口コミでも付いたままになる');
  await db.exec(read('db/founding.sql'));
  ok(await noOf(309) === null, '  貼り直すと外れる');

  await asUser(310);
  await db.exec(`set role authenticated`);
  for (const f of ['pv_founding_recheck($1::uuid, true)', 'pv_founding_grant($1::uuid, \'review\')', 'pv_founding_counts($1::uuid)']) {
    ok((await boom(`select public.${f}`, [uid(310)]) || '').includes('permission denied'), `会員は ${f.split('(')[0]} を呼べない`);
  }
  await db.exec(`reset role`);
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 101人目');
// ════════════════════════════════════════════════════════════
await db.query(`delete from founding_members`);
for (let i = 1; i <= 100; i++) {
  await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`,
    [uid(500 + i), `f${i}@example.com`]);
  await db.query(`insert into founding_members(user_id,"no",first_source)
                  values($1,$2,'review')`, [uid(500 + i), i]);
}
await asUser(701);
await review(701);
ok(await noOf(701) === null, '101人目には番号が入らない');
ok((await rows(`select 1 from reviews_v2 where proof_hash=$1`,
     [await makeProofHash(uid(701), 'emirates')])).length === 1,
   '番号が入らなくても口コミそのものは通る');
await submit({ ...BASE, period_year: 2026, period_month: 3 });
ok((await rows(`select 1 from pay_reports where "position"='cap' and period_month=3`)).length === 1,
   '番号が入らなくても給与レポートは通る');
ok((await mine()).no === null, '101人目の my_founding は null（例外にしない）');
ok((await roster()).length === 100, `名簿は 100人で止まる → ${(await roster()).length}`);

// 遡りも 100 を超えない
await db.query(`select pv_backfill_founding()`);
ok((await roster()).length === 100, '遡って振る側も 100 を超えない');


// ════════════════════════════════════════════════════════════
console.log('\n▼ 称号のために投稿を落とさない');
// ════════════════════════════════════════════════════════════
/* 名簿を隠して、付与の中で必ず失敗する状態を作る。
   投稿そのものが通ることが、この設計でいちばん譲れないところ。 */
await db.exec(`alter table public.founding_members rename to founding_members_hidden`);
await asUser(800);
let threw = await boom(`insert into reviews_v2(proof_hash, airline) values($1,'emirates')`,
  [await makeProofHash(uid(800), 'emirates')]);
ok(threw === null, '名簿が壊れていても口コミは保存される', threw ?? '');
threw = null;
try { await submit({ ...BASE, period_year: 2026, period_month: 4 }); }
catch (e) { threw = String(e.message || e); }
ok(threw === null, '名簿が壊れていても給与レポートは保存される', threw ?? '');
await db.exec(`alter table public.founding_members_hidden rename to founding_members`);


// ════════════════════════════════════════════════════════════
console.log('\n▼ 自己点検（オーナーが Supabase で見るのと同じもの）');
// ════════════════════════════════════════════════════════════
{
  const src = read('db/founding.sql');
  const i = src.lastIndexOf('with f as (');
  const checks = await rows(src.slice(i));
  for (const r of checks) ok(r['結果'] === '✅', `${r['#']}. ${r['見るところ']}`);
}


console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} pass / ${fail} fail`);
await db.close();
process.exit(fail === 0 ? 0 : 1);
