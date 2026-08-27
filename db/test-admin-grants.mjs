/* db/test-admin-grants.mjs — profiles に「会員が書ける列」を機械で確かめる。

   実行: node db/test-admin-grants.mjs   （または npm run test:sql）
   ネットワーク不要・本番に一切触らない。

   なぜ要るか
     2026-08-27 まで db/admin.sql は
         grant select, insert, update on public.profiles to authenticated
     ＝ **表ごと** 書き換えを許していた。RLS は「どの行か」しか見ないので、
     ログインしている人なら誰でもブラウザの開発者ツールから

         await sb.from('profiles').update({ access_until:'2099-01-01' }).eq('id', myId)

     で自分の REAL PAY を永久に開けたし、verify_level を上げて Verified を
     名乗ることもできた。画面に出していない列でも、表に書ける以上は書ける。

   ⚠️ ここは**順番の罠**がある。Postgres は「表ごとの revoke」で
      その表の列の許可も道連れに消す。revoke を grant の後ろに書くと
      profiles に1文字も書けなくなり、**登録もプロフィール保存も黙って失敗する**
      （本人は成功したつもりで、氏名も会社も空のまま残る）。
      字面だけの検査では捕まらないので、本物の Postgres で実際に書いてみる。

   assert-admin.mjs は同じことを **db/admin.sql の字** で見ている。
   こちらは **実際に動かした結果** で見る。両方要る。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };

const UID = '00000000-0000-4000-8000-000000000001';

// ── 器（本番と同じ順で流す）─────────────────────────────────
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  grant usage on schema public, extensions to anon, authenticated;
  -- ★既定権限を先に全付与しておく。無いと「元から権限が無いだけ」を
  --   「revoke が効いた」と誤読する（db/test-pay-rows.mjs と同じ考え方）。
  alter default privileges in schema public grant all on tables to anon, authenticated;

  create table public.profiles (
    id uuid primary key, email text, name text,
    gender text, birthdate date, country text, company text, "position" text
  );
  -- ★raw_user_meta_data が要る（db/schema-additions.sql が auth.users に
  --   handle_new_user トリガーを付けて、そこから読む）。
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
               'db/schema-additions.sql', 'db/pay-reports.sql', 'db/admin.sql'];
for (const f of FILES) {
  try { await db.exec(read(f)); ok(true, f); }
  catch (e) { ok(false, f, e.message); process.exit(1); }
}

console.log('\n▼ 冪等性（もう一度そのまま流す）');
for (const f of FILES) {
  try { await db.exec(read(f)); ok(true, f + ' 再適用OK'); }
  catch (e) { ok(false, f + ' 再適用で失敗', e.message); }
}

/* ★auth.users に入れると handle_new_user が profiles の行も作る（本番と同じ）。
   だから profiles 側は「無ければ作る」にしておく。 */
await db.query(`insert into auth.users(id,email) values($1,'p1@example.com')`, [UID]);
await db.query(`insert into public.profiles(id,email) values($1,'p1@example.com')
                on conflict (id) do nothing`, [UID]);

// ── 会員になって実際に書いてみる ────────────────────────────
/* ⚠️ set_config の第3引数は **false**（＝セッション全体）でなければならない。
   true にすると「今のトランザクションだけ」＝ 直後の1文にはもう効かず、
   auth.uid() が null のまま走る。すると RLS が行を1つも通さず、
   update は**エラーも出さずに0行**で終わる ＝「書けた」と誤って読める。
   db/test-pay-rows.mjs:109 と同じ形にしてある。 */
const asMember = async () => {
  await db.exec(`set role authenticated`);
  await db.query(`select set_config('pv.uid', $1, false)`, [UID]);
};
const asOwner = async () => {
  await db.exec(`reset role`);
  await db.query(`select set_config('pv.uid', '', false)`);
};

/* 書けたかを試す。返り値は null（書けた）かエラーメッセージ（書けなかった）。
   ★0行で終わったものは「書けた」と数えない（RLS に弾かれてもエラーは出ないため）。 */
const tryWrite = async (sql, params) => {
  await asMember();
  try {
    const r = await db.query(sql, params);
    return r.rows.length ? null : '0行（RLS に弾かれた）';
  }
  catch (e) { return String(e.message || e); }
  finally { await asOwner(); }
};

console.log('\n▼ 画面が実際に書く列は、今までどおり書ける');
for (const [label, col, val] of [
  ['氏名（プロフィール編集）',        'name',            'サンプル 太郎'],
  ['性別',                            'gender',          'other'],
  ['生年月日',                        'birthdate',       '1990-01-01'],
  ['居住国',                          'country',         'JP'],
  ['在籍企業',                        'company',         'Sample Air'],
  ['役職',                            'position',        'fo'],
  ['メール通知のトグル',              'email_opt_in',    true],
  ['メール通知の同意日時',            'email_opt_in_at', '2026-08-27T00:00:00Z'],
]) {
  const err = await tryWrite(
    `update public.profiles set "${col}" = $2 where id = $1 returning id`, [UID, val]);
  ok(err === null, `${label}（${col}）を書ける`, err);
}

/* ★登録の upsert。PostgREST は insert ... on conflict do update に展開するので、
   id と email も SET に入る。ここが落ちると**新規登録が黙って壊れる**。 */
const upsertErr = await tryWrite(
  `insert into public.profiles (id, email, name, gender, birthdate, country, company, "position",
                                email_opt_in, email_opt_in_at)
   values ($1,'p1@example.com','サンプル 太郎','other','1990-01-01','JP','Sample Air','fo',true,now())
   on conflict (id) do update set
     email = excluded.email, name = excluded.name, gender = excluded.gender,
     birthdate = excluded.birthdate, country = excluded.country, company = excluded.company,
     "position" = excluded."position", email_opt_in = excluded.email_opt_in,
     email_opt_in_at = excluded.email_opt_in_at
   returning id`, [UID]);
ok(upsertErr === null, '登録の upsert（id と email を含む）が通る', upsertErr);

console.log('\n▼ 自分で自分に与えられてはいけない列');
for (const [label, col, val] of [
  ['REAL PAY の解放',        'access_until',       '2099-01-01T00:00:00Z'],
  ['Verified の段',          'verify_level',       2],
  ['Verified の航空会社',    'verified_airline',   'ana'],
  ['Verified の日時',        'verified_at',        '2099-01-01T00:00:00Z'],
  ['バッジ',                 'badge',              'verified'],
  ['バッジの状態',           'badge_state',        'verified'],
  ['出した件数',             'pay_report_count',   99],
  ['連続month数',            'pay_streak_months',  99],
  ['給料日',                 'pay_day_of_month',   1],
  ['最後に出した日時',       'last_pay_report_at', '2099-01-01T00:00:00Z'],
  ['解除トークン',           'mail_unsub_token',   '00000000-0000-4000-8000-0000000000ff'],
  ['月次メールの同意',       'mail_optin',         true],
]) {
  const err = await tryWrite(
    `update public.profiles set "${col}" = $2 where id = $1 returning id`, [UID, val]);
  ok(err !== null && /permission denied/i.test(err), `${label}（${col}）は書けない`, err || '書けてしまった');
}

/* ★列を混ぜても駄目。許された列と一緒なら通る、という抜け道が無いこと。 */
const mixErr = await tryWrite(
  `update public.profiles set name = 'x', access_until = '2099-01-01' where id = $1 returning id`, [UID]);
ok(mixErr !== null && /permission denied/i.test(mixErr),
   '許された列に混ぜても解放は書けない', mixErr || '書けてしまった');

/* ★他人の行は RLS が止める（列の許可とは別の守り）。 */
await db.query(`insert into auth.users(id,email) values($1,'p2@example.com')`,
  ['00000000-0000-4000-8000-000000000002']);
await db.query(`insert into public.profiles(id,email) values($1,'p2@example.com')
                on conflict (id) do nothing`, ['00000000-0000-4000-8000-000000000002']);
await asMember();
const other = await db.query(`update public.profiles set name='のっとり' where id = $1 returning id`,
  ['00000000-0000-4000-8000-000000000002']);
await asOwner();
ok(other.rows.length === 0, '他人の行は1行も書き換えられない（RLS）');

console.log('\n▼ サーバー側の口は今までどおり動く（security definer は grant の影響を受けない）');
await asMember();
let sErr = null;
try {
  await db.query(`select submit_pay_report($1::jsonb)`, [JSON.stringify({
    airline: 'ana', position: 'fo', fleet: 'b777', currency: 'JPY', lang: 'ja',
    period_year: new Date().getFullYear() - 1, period_month: 3, gross_monthly: 1000000, tax_rate_pct: 0
  })]);
} catch (e) { sErr = String(e.message || e); }
await asOwner();
ok(sErr === null, '会員のまま submit_pay_report が通る', sErr);
const after = (await db.query(`select access_until, pay_report_count from public.profiles where id=$1`, [UID])).rows[0];
ok(after && after.access_until && new Date(after.access_until) > new Date(),
   '給与を出したときだけ、サーバーが解放を立てる');
ok(after && after.pay_report_count === 1, '件数もサーバーが立てる');

console.log(`\n${fail === 0 ? '✅ 全部通った' : '❌ 落ちた'}  pass ${pass} / fail ${fail}`);
process.exit(fail === 0 ? 0 : 1);
