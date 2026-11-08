/* db/referrals.sql を本物の Postgres（PGlite = PG17 の WASM ビルド）に流して確かめる。

   実行: node db/test-referrals.mjs   （または npm run test:sql）
   ネットワーク不要・本番に一切触らない。SQL を直したら必ずこれを通してから
   オーナーに実行を依頼すること。

   器は db/test-pay-reports.mjs と同じ（anon / authenticated ロール、既定権限を
   全付与した状態、auth.uid() の代役、profiles）。既定権限を先に全付与してあるから
   こそ referrals.sql の revoke が意味を持つ。無いと「元から権限が無いだけ」を
   「revoke が効いた」と誤読する。

   ★「あと○人」（my_cohort_gap）は 2026-11-08 から会社ページと同じ決まり（db/member-median.sql）。
     区分は 本人のいちばん新しい給与の 会社 × 機長／副操縦士・2人以上で開く・人数は保存してある表を読むだけ。
     ここでいちばん大事なのは「返り値の整数が remaining の 2 と 1（と、いつも 0 の gained）だけ」と
     「1人が何か月出しても1人（行ではなく人を数える）」。画面ではなくサーバの返り値で押さえる。
     ★壊す証明 ── 人数を表から読むのをやめて pay_reports の行を数える版にすると、
       1人 × 2か月で「開いた」になり、検査が赤くなる。
     ★本人の行が会員の中央値に数えられない（1 AED の基本給・24か月より古い・下ろした・テスト用アカウント）なら none。
       ほかに1人の区分と0人の区分で答えが1文字も違わない。壊す証明 ── その判定を抜くと「あと1人／あと2人」で読めてしまう。
   流す SQL は serve-local.mjs の SQL_FILES と同じ前後（referrals.sql は member-median.sql より先）。
   member-median.sql を流す前に、表が無いあいだは 'none'（何も言わない）を返すことも見る。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import { SQL_FILES } from '../serve-local.mjs';

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

// ── 器（serve-local.mjs の BOOT と同じ形。db/test-member-median.mjs と同じ）─────────────
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

  create table public.profiles (
    id uuid primary key, email text, name text,
    email_opt_in boolean not null default false,
    gender text, birthdate date, country text, company text, "position" text,
    created_at timestamptz not null default now()
  );

  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;

  -- 口コミの表（db/pay-rows.sql などが参照する）。形は serve-local.mjs と同じ
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

// ── 適用（順番も含めて本番と同じ手順）────────────────────────
/* serve-local.mjs の SQL_FILES を referrals.sql まで（写さずに読む）。「あと○人」が読む表（member-median.sql）はあとで流す。
   手元の器も同じ前後 ── 表がまだ無いあいだの答えを、ここで一度見る。
   ★referrals.sql の前提（pay_hidden・pv_my_keys）は db/pay-rows.sql・db/deep-pay.sql が作る ＝ どちらも referrals.sql より前。 */
const MM = 'db/member-median.sql';
const FILES = SQL_FILES.slice(0, SQL_FILES.indexOf('db/referrals.sql') + 1);
ok(FILES.length > 1 && FILES.includes('db/deep-pay.sql') && FILES.includes('db/pay-rows.sql')
   && SQL_FILES.indexOf(MM) > SQL_FILES.indexOf('db/referrals.sql'),
   `流す順が serve-local.mjs の SQL_FILES と同じ（referrals.sql は deep-pay.sql のあと・member-median.sql より先）→ ${FILES.length} 本`);

console.log('\n▼ SQL の適用');
for (const f of FILES) {
  try { await db.exec(read(f)); console.log(`  ✅ ${f}`); pass++; }
  catch (e) { console.log(`  ❌ ${f}\n     ${e.message}`); fail++; process.exit(1); }
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
const myCode = async () => (await one(`select my_referral_code() r`)).r;
const claim  = async (c) => (await one(`select claim_referral($1) r`, [c])).r;
const gap    = async () => (await one(`select my_cohort_gap() r`)).r;

const BASE = {
  airline: 'emirates', currency: 'AED',
  base_pay: 20000, hourly_rate: 250, guaranteed_hours: 75, block_hours: 85,
  per_diem: 3000, housing_type: 'allowance', housing_amount: 10000,
  base_iata: 'DXB', seniority_years: 15, rank_years: 4, tax_rate_pct: 0, lang: 'en',
  age_bucket: '40-49',
};
/* 区分（会社 × 職位）を丸ごと1つ占有して、n 人ぶんの行を作る（1人1行）。
   ★区分は会社 × 機長／副操縦士（2026-11-08。機材と年は区分に入れない）。区分ごとに別の会社を使う。
   ★ユーザーは区分ごとに使い捨てにする。同じ人が2つの区分に出すと
     my_cohort_gap は「最新の1件」の区分を返すので、狙った区分を見なくなる。 */
let seat = 1000;
const fill = async (air, pos, n, month = 3) => {
  const users = [];
  for (let i = 0; i < n; i++) {
    const u = ++seat;
    await asUser(u);
    await submit({ ...BASE, airline: air, position: pos, fleet: 'b777', period_year: 2026, period_month: month });
    users.push(u);
  }
  return users;
};
/* その人の行を過去へずらす。crossed は created_at と「2人そろった時刻」の前後だけで決まるので、
   1トランザクション1タイムスタンプのゆらぎにテストの合否を預けないためにこうする（本番の挙動は変えない）。
   ★created_at の書き換えでも会員の中央値の数え直しは走る（引き金が列を名指ししている）。 */
const backdate = (u, air, days = 1) =>
  db.query(`update pay_reports set created_at = created_at - ($1 || ' days')::interval
             where proof_hash = encode(extensions.digest($2 || '::pv_pay::' || $3, 'sha256'), 'hex')`,
           [String(days), uid(u), air]);
const keyOf = async (u, air) => (await one(
  `select encode(extensions.digest($1 || '::pv_pay::' || $2, 'sha256'), 'hex') h`, [uid(u), air])).h;
/* 返り値に出てよい整数は remaining の 2 と 1、gained の 0 だけ。ほかの数字が1つでも混ざったら赤。 */
const smallOnly = (o) => Object.entries(o).every(([k, v]) => typeof v !== 'number'
  || (k === 'remaining' && (v === 1 || v === 2)) || (k === 'gained' && v === 0));
/* 区分ごとに別の会社（語彙から取る。このテストのために特定の社名を覚えない）。emirates は上の節が使う。 */
const AIRS = (await rows(`select code, name_en from pv_airlines where active and code not in ('other', 'emirates')
                           and name_en is not null order by code limit 60`));
let airAt = 0;
const nextAir = () => AIRS[airAt++].code;


// ════════════════════════════════════════════════════════════
console.log('\n▼ 「あと○人」が読む表（db/member-median.sql）がまだ無いあいだ');
// ════════════════════════════════════════════════════════════
{
  const AIR0 = nextAir();
  await asUser(980);
  await submit({ ...BASE, airline: AIR0, position: 'cap', fleet: 'b777', period_year: 2026, period_month: 1 });
  const r = await gap();
  ok(r.state === 'none' && Object.keys(r).sort().join(',') === 'ok,state',
     `★表が無いあいだは何も言わない（数えていないものについて「あと2人」と言わない）→ ${JSON.stringify(r)}`);

  try { await db.exec(read(MM)); console.log(`  ✅ ${MM}`); pass++; }
  catch (e) { console.log(`  ❌ ${MM}\n     ${e.message}`); fail++; process.exit(1); }
  await asUser(980);
  const r2 = await gap();
  ok(r2.state === 'near' && r2.remaining === 1, `表を作った瞬間から読める（1人の区分 → あと1人）→ ${JSON.stringify(r2)}`);

  // 古い member-median.sql（そろった時刻の列が無い）の上に referrals.sql を貼ろうとしたら、日本語で止める
  await db.exec(`begin`);
  await db.exec(`alter table public.pv_member_median drop column opened_at`);
  const stop = await db.exec(read('db/referrals.sql')).then(() => null, (e) => String(e.message || e));
  await db.exec(`rollback`);
  ok(/先に db\/member-median\.sql を貼り直してください/.test(stop || ''),
     `★古い表の上に貼ろうとしたら止まる（貼れたまま全員にエラーを返す、を作らない）→ ${String(stop).slice(0, 80)}`);
}

console.log('\n▼ 冪等性（もう一度そのまま流す）');
for (const f of ['db/referrals.sql', MM]) {
  try { await db.exec(read(f)); console.log(`  ✅ ${f} 再適用OK`); pass++; }
  catch (e) { console.log(`  ❌ ${f} 再適用で失敗\n     ${e.message}`); fail++; }
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 招待コード');
// ════════════════════════════════════════════════════════════
await asUser(1);
const c1 = await myCode();
ok(c1.ok === true && typeof c1.code === 'string', '初回で作られる');
ok(/^[2-9A-HJ-NP-Z]{8}$/.test(c1.code || ''),
   `8文字・読み間違えない字だけ（0 1 I L O U 無し）→ ${c1.code}`);
ok((await myCode()).code === c1.code, '2回目は同じコードが返る（作り直さない）');
ok(Object.keys(c1).sort().join(',') === 'code,converted,invited,ok',
   `返るキーはこの4つだけ＝招待相手の情報が1つも出ない → ${Object.keys(c1).sort().join(',')}`);

// 乱数から作っている証明：同じ人の行を消して作り直すと別のコードになる。
// （ユーザーIDのハッシュや連番なら、必ず同じ文字列が返ってくる）
await db.query(`delete from referral_codes where owner_id=$1`, [uid(1)]);
const c1b = await myCode();
ok(c1b.code !== c1.code, `作り直すと別のコードになる（IDから導いていない）→ ${c1.code} / ${c1b.code}`);

const many = new Set();
for (let i = 100; i < 300; i++) { await asUser(i); many.add((await myCode()).code); }
ok(many.size === 200, `200人ぶんが全部ちがう → ${many.size} 種類`);
ok([...many].every((c) => /^[2-9A-HJ-NP-Z]{8}$/.test(c)), '200個すべてが同じ字種のルールを守る');
// 剰余の偏りを捨てているか（240 以上のバイトを捨てないと先頭の6文字が出やすくなる）。
// 200×8＝1600文字。30種類なら1文字あたり期待53回。極端な偏りだけ見る。
const hist = {};
for (const c of many) for (const ch of c) hist[ch] = (hist[ch] || 0) + 1;
ok(Object.keys(hist).length >= 28 && Math.max(...Object.values(hist)) < 110,
   `字の出方が偏っていない → ${Object.keys(hist).length} 種類・最多 ${Math.max(...Object.values(hist))} 回`);

await db.exec(`set role anon`);
ok((await boom(`select my_referral_code()`) || '').includes('permission denied'),
   '登録していない人はコードを取れない');
await db.exec(`reset role`);


// ════════════════════════════════════════════════════════════
console.log('\n▼ 帰属（誰が誰を招待したか）');
// ════════════════════════════════════════════════════════════
await asUser(2); const c2 = (await myCode()).code;
await asUser(3); const c3 = (await myCode()).code;

await asUser(2);
ok((await claim(c2)).status === 'self', '自分のコードは自分に使えない');
ok(Number((await one(`select count(*) n from referrals where invitee_id=$1`, [uid(2)])).n) === 0,
   '自己招待では行ができない');

await asUser(4);
const at = await claim(c1b.code);
ok(at.status === 'attributed', '他人のコードで帰属する');
ok(Number((await one(`select baseline_reports b from referrals where invitee_id=$1`, [uid(4)])).b) === 0,
   '帰属した時点の投稿数を控える（まだ0件）');

ok((await claim(c1b.code)).status === 'already', '同じコードをもう一度呼んでも already（冪等）');
ok((await claim(c2)).status === 'already', '別の有効なコードでも already（紹介者は一生1人）');
ok((await one(`select inviter_id i from referrals where invitee_id=$1`, [uid(4)])).i === uid(1),
   '紹介者は最初の1人のまま変わらない');
ok(Number((await one(`select count(*) n from referrals where invitee_id=$1`, [uid(4)])).n) === 1,
   '何度呼ばれても行は1つ（4か所から呼べる根拠）');

await asUser(5);
ok((await claim('ZZZZZZZZ')).status === 'invalid', '存在しないコードは invalid');
await db.query(`update referral_codes set revoked_at = now() where code = $1`, [c3]);
ok((await claim(c3)).status === 'invalid', '失効したコードも同じ invalid（失効を教えない）');
ok((await claim('abc')).status === 'invalid', '短すぎるコードは invalid（テーブルを見る前に弾く）');
ok((await claim('IIIIIIII')).status === 'invalid', '使わない字（I）が入っていれば invalid');
ok(Number((await one(`select count(*) n from referrals where invitee_id=$1`, [uid(5)])).n) === 0,
   '弾いたときは行を作らない');

// 大文字小文字と前後の空白は正規化する（クルーが手で打ち直すため）
await asUser(6);
ok((await claim('  ' + c2.toLowerCase() + '  ')).status === 'attributed',
   '小文字と前後の空白を直して受け取る');

// 置き場そのものの守り
const rg = await rows(`select grantee, table_name, privilege_type from information_schema.role_table_grants
  where table_schema='public' and table_name in ('referral_codes','referrals')
    and grantee in ('anon','authenticated')`);
ok(rg.length === 0, `anon/authenticated に直接の権限が無い → ${rg.length} 件`);
const rp = await rows(`select policyname from pg_policies
  where schemaname='public' and tablename in ('referral_codes','referrals')`);
ok(rp.length === 0, `2つの表にポリシーが1本も無い → ${rp.length} 本`);
await db.exec(`set role authenticated`);
ok((await boom(`select * from referrals`) || '').includes('permission denied'),
   'ログインしていても referrals は直接読めない（誰が誰を招待したかは出ない）');
ok((await boom(`insert into referrals(invitee_id,inviter_id,code,baseline_reports)
                values($1,$2,$3,0)`, [uid(7), uid(1), c1b.code]) || '').includes('permission denied'),
   '帰属を自分で書き込めない（baseline_reports を0に細工できない）');
await db.exec(`reset role`);


// ════════════════════════════════════════════════════════════
console.log('\n▼ 紹介の成立（submit_pay_report を触らずに導出する）');
// ════════════════════════════════════════════════════════════
await asUser(10);
ok((await claim(c1b.code)).status === 'attributed', '同じコードは何人でも使える（1回きりの鍵ではない）');
await asUser(1);
ok((await myCode()).converted === 0, '帰属しただけでは成立0');
ok((await myCode()).invited === 2, `招待した人数は数える → ${(await myCode()).invited}`);

// 招待された人（4）が給与を1件出す。誰も pv_referral_settle を呼んでいない。
await asUser(4);
await submit({ ...BASE, position: 'cap', fleet: 'b777', period_year: 2026, period_month: 6 });
await asUser(1);
ok((await myCode()).converted === 1,
   '招待された人が投稿すると、何も押していないのに成立1（記録ではなく導出）');

// 同じ月を出し直しても pay_report_count は増えない（db/pay-reports.sql:847）
// ＝ 出し直しで成立が二重に数えられない
await asUser(6);
const base6 = Number((await one(`select coalesce(pay_report_count,0) c from profiles where id=$1`, [uid(6)])).c);
await submit({ ...BASE, position: 'fo', fleet: 'b777', period_year: 2026, period_month: 6 });
await submit({ ...BASE, position: 'fo', fleet: 'b777', period_year: 2026, period_month: 6, base_pay: 21000 });
const after6 = Number((await one(`select coalesce(pay_report_count,0) c from profiles where id=$1`, [uid(6)])).c);
ok(after6 === base6 + 1, `同じ月の出し直しは1件としてしか数えない → ${base6}→${after6}`);
await asUser(2);
ok((await myCode()).converted === 1, '出し直しで成立が二重に立たない');

// 帰属より先に投稿していた人は、次の投稿まで成立しない
await asUser(8);
await submit({ ...BASE, position: 'cap', fleet: 'a320', period_year: 2026, period_month: 1 });
await submit({ ...BASE, position: 'cap', fleet: 'a320', period_year: 2026, period_month: 2 });
await asUser(9); const c9 = (await myCode()).code;
await asUser(8);
ok((await claim(c9)).status === 'attributed', '既に投稿がある人でも帰属はできる');
await asUser(9);
ok((await myCode()).converted === 0, '帰属より前の投稿は成立に数えない（少なく見る側に倒れる）');
await asUser(8);
await submit({ ...BASE, position: 'cap', fleet: 'a320', period_year: 2026, period_month: 3 });
await asUser(9);
ok((await myCode()).converted === 1, '帰属したあとの投稿で成立する');

// 控えの押し方
await asUser(8);
ok((await one(`select pv_referral_settle() r`)).r.ok === true, 'pv_referral_settle は素直に返る');
ok((await one(`select pv_referral_settle() r`)).r.ok === true, '2回呼んでも同じ');
await asUser(5);
ok((await one(`select pv_referral_settle() r`)).r.ok === true, '帰属していない人が呼んでも投げない');
ok((await one(`select converted_at is not null x from referrals where invitee_id=$1`, [uid(8)])).x === true,
   '成立した行には控えが押される');
await asAnon();
ok((await one(`select pv_referral_settle() r`)).r.ok === true, '未ログインでも投げない（投げっぱなしで呼ぶため）');


// ════════════════════════════════════════════════════════════
console.log('\n▼ 荒らし避け（招待した側で数える）');
// ════════════════════════════════════════════════════════════
await asUser(400); const c400 = (await myCode()).code;
// ★数えるのは「送った数」ではなく「そのリンクから登録した人の数」。
//   1日49人ぶんを直に作る（RPC で49回回すのと同じ状態）
for (let i = 401; i <= 449; i++) {
  await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`,
    [uid(i), `p${i}@example.com`]);
  await db.query(`insert into referrals(invitee_id,inviter_id,code,baseline_reports)
                  values($1,$2,$3,0)`, [uid(i), uid(400), c400]);
}
await asUser(450);
ok((await claim(c400)).status === 'attributed', '同じ日の50人目までは通る（大人数のグループに1本貼れる）');
await asUser(451);
ok((await claim(c400)).status === 'rate_limited', '同じ日の51人目は静かに断る');
ok(Number((await one(`select count(*) n from referrals where invitee_id=$1`, [uid(451)])).n) === 0,
   '断ったときは行を作らない');

await db.query(`update referrals set created_at = now() - interval '2 days' where inviter_id=$1`, [uid(400)]);
await asUser(451);
ok((await claim(c400)).status === 'attributed', '日をまたげばまた受け取れる（通算の上限ではない）');

// 未成立のまま通算200件で止まる
for (let i = 500; i <= 648; i++) {
  await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`,
    [uid(i), `p${i}@example.com`]);
  await db.query(`insert into referrals(invitee_id,inviter_id,code,baseline_reports,created_at)
                  values($1,$2,$3,0, now() - interval '2 days')`, [uid(i), uid(400), c400]);
}
ok(Number((await one(`select count(*) n from referrals where inviter_id=$1`, [uid(400)])).n) === 200,
   '未成立の帰属が通算200件たまった');
await asUser(649);
ok((await claim(c400)).status === 'rate_limited', '未成立が200件たまったら、日をまたいでも止める');


// ════════════════════════════════════════════════════════════
console.log('\n▼ 「あと○人で比較」— ここが本体（2人で開く・人数は会員の中央値の表を読むだけ）');
// ════════════════════════════════════════════════════════════
await asUser(700);
ok((await gap()).state === 'none', '投稿が1件も無い人には何も出さない');

await asUser(701);
await submit({ ...BASE, airline: 'other', airline_other: 'Some Charter Co',
               position: 'cap', fleet: 'a320', period_year: 2025, period_month: 4 });
ok((await gap()).state === 'none', '一覧にない会社（自由入力・どの会社にも当たらない）だけの人には出さない（集計に入らないため）');

// ── 1人（自分だけ）：あと1人 ────────────────────────────────
const AIR1 = nextAir();
const g1 = await fill(AIR1, 'fo', 1);
await asUser(g1[0]);
const r1 = await gap();
ok(r1.state === 'near' && r1.remaining === 1, `★1人（自分だけ）→ あと1人 → ${JSON.stringify(r1)}`);
ok(Object.keys(r1).sort().join(',') === 'crossed,gained,ok,remaining,state', `返るキーは今までと同じ形 → ${Object.keys(r1).sort().join(',')}`);
ok(!('n' in r1) && smallOnly(r1) && r1.gained === 0 && r1.crossed === false, '生の n は返さない・整数は remaining の 1 と gained の 0 だけ');

// ── 1人が何か月出しても1人（行ではなく人を数える）─────────────
/* personCheck() を、本物と「pay_reports の行を数える」に戻した版の両方に当てる（壊す証明は下）。 */
const AIRP = nextAir();
const PP = 960;
const personCheck = async () => {
  await asUser(PP);
  return (await gap());
};
await asUser(PP);
await submit({ ...BASE, airline: AIRP, position: 'cap', fleet: 'b777', period_year: 2026, period_month: 1 });
await submit({ ...BASE, airline: AIRP, position: 'cap', fleet: 'b777', period_year: 2026, period_month: 2 });
ok(Number((await one(`select count(*) n from pay_reports where proof_hash = $1`, [await keyOf(PP, AIRP)])).n) === 2, '（準備）1人で2行（2か月）');
const rpp = await personCheck();
ok(rpp.state === 'near' && rpp.remaining === 1, `★1人 × 2か月は1人のまま（開かない・あと1人）→ ${JSON.stringify(rpp)}`);

// ── 本人の行が会員の中央値に数えられない ＝ 何も言わない（ほかに0人か1人かを読ませない）──────────
/* 1 AED の基本給だけの行（年 $10,000 に届かない）で区分を決めると、表の n は「本人以外の人数」そのもの。
   ほかに1人いる区分と0人の区分で答えが変わると、どの会社 × 職位でも試して読めてしまう。
   leakCheck() を、本物と「本人の行の判定を抜いた版」の両方に当てる（壊す証明は下）。 */
const TINY = { ...BASE, base_pay: 1, hourly_rate: null, guaranteed_hours: null, block_hours: null,
               per_diem: null, housing_type: null, housing_amount: null };
const AIRL1 = nextAir(), AIRL0 = nextAir();
await fill(AIRL1, 'cap', 1);                                  // ほかに1人（ふつうの額）
const LK1 = 950, LK0 = 951;
await asUser(LK1); await submit({ ...TINY, airline: AIRL1, position: 'cap', fleet: 'b777', period_year: 2026, period_month: 3 });
await asUser(LK0); await submit({ ...TINY, airline: AIRL0, position: 'cap', fleet: 'b777', period_year: 2026, period_month: 3 });
ok(Number((await one(`select annual_total_usd v from pay_reports where proof_hash = $1`, [await keyOf(LK1, AIRL1)])).v) < 10000,
   '（準備）1 AED の行は年 $10,000 に届かない（会員の中央値に数えられない）');
const leakCheck = async () => {
  await asUser(LK1); const a = await gap();
  await asUser(LK0); const b = await gap();
  return { a, b, good: a.state === 'none' && b.state === 'none' && JSON.stringify(a) === JSON.stringify(b) };
};
const lk = await leakCheck();
ok(lk.a.state === 'none', `★数えられない本人 ＋ ほかに1人 → none（「あと1人」と言わない）→ ${JSON.stringify(lk.a)}`);
ok(lk.b.state === 'none', `★数えられない本人 ＋ ほかに0人 → none（「あと2人」と言わない）→ ${JSON.stringify(lk.b)}`);
ok(lk.good, '★ほかに1人の区分と0人の区分で、答えが1文字も違わない');
// ほかの「数えられない」も同じ：24か月より古い・下ろした・テスト用アカウント
{
  const AIRO = nextAir(), AIRH = nextAir(), AIRU = nextAir();
  const go = await fill(AIRO, 'fo', 1);
  await backdate(go[0], AIRO, 800);                           // 24か月より古い
  await asUser(go[0]);
  ok((await gap()).state === 'none', '24か月より古い行の人 → none');
  const gh = await fill(AIRH, 'cap', 1);
  await db.query(`insert into public.pay_hidden (proof_hash, reason) values ($1, '検査')`, [await keyOf(gh[0], AIRH)]);
  await asUser(gh[0]);
  ok((await gap()).state === 'none', '一覧から下ろした人 → none');
  const gu = await fill(AIRU, 'cap', 1);
  await db.query(`insert into public.pv_test_users (uid) values ($1)`, [uid(gu[0])]);
  await asUser(gu[0]);
  ok((await gap()).state === 'none', 'テスト用アカウント → none');
  // 数えられる本人は今までどおり（本人だけ ＝ あと1人）
  const gk = await fill(nextAir(), 'cap', 1);
  await asUser(gk[0]);
  const rk = await gap();
  ok(rk.state === 'near' && rk.remaining === 1 && smallOnly(rk), `数えられる本人だけの区分は今までどおり あと1人 → ${JSON.stringify(rk)}`);
}
// 壊す証明: 本人の行の判定（幅・24か月・下ろした・テスト用アカウント）を抜いた版
{
  const src = read('db/referrals.sql');
  const a0 = src.indexOf('create or replace function public.my_cohort_gap()');
  const fsrc = a0 < 0 ? '' : src.slice(a0, src.indexOf('\n$$;', a0) + '\n$$;'.length);
  const i0 = fsrc.indexOf('  if v_usd is null or not (v_usd between 10000 and 700000)');
  const i1 = i0 < 0 ? -1 : fsrc.indexOf('  end if;\n', i0);
  const broken = (i0 < 0 || i1 < 0) ? '' : fsrc.slice(0, i0) + fsrc.slice(i1 + '  end if;\n'.length);
  ok(broken && !broken.includes('v_usd between') && broken.includes('from public.pv_member_median m'), '（本人の行の判定を見つけて抜いた）');
  await db.exec(`begin`);
  await db.exec(broken);
  const red = await leakCheck();
  await db.exec(`rollback`);
  ok(!red.good && red.a.remaining === 1 && red.b.remaining === 2,
     `★抜いた版では「ほかに1人 → あと1人」「ほかに0人 → あと2人」と読めてしまう（検査が赤くなる）→ ${JSON.stringify({ a: red.a, b: red.b })}`);
  ok((await leakCheck()).good, '（巻き戻したあと: 本物は緑）');
}

// ── 2人：開く ────────────────────────────────────────────────
/* 1人目を1日前へずらしてから2人目が出す ＝ 2人そろったのは1人目が記録したあと。 */
const AIR2 = nextAir();
const g2a = await fill(AIR2, 'fo', 1);
await backdate(g2a[0], AIR2, 1);
const g2b = await fill(AIR2, 'fo', 1);
await asUser(g2b[0]);
const r2b = await gap();
ok(r2b.state === 'open', `★2人で open（普通の比較が出る）→ ${JSON.stringify(r2b)}`);
ok(!('remaining' in r2b), 'open では remaining を返さない（「あと0人」と書かせない）');
ok(r2b.crossed === false && r2b.gained === 0,
   `★自分の提出でちょうど2人になった人には「そろいました」を言わない → ${JSON.stringify(r2b)}`);
await asUser(g2a[0]);
const r2a = await gap();
ok(r2a.state === 'open' && r2a.crossed === true,
   `★自分が記録したあとに2人そろった人には crossed → ${JSON.stringify(r2a)}`);
ok(r2a.gained === 0,
   '★gained はいつも 0（保存してある表に「前回の人数」が無い＝本当のことを安く言えないので、言わない）');
const g2c = await fill(AIR2, 'fo', 1);
await asUser(g2c[0]);
ok((await gap()).crossed === false, 'もともと2人以上そろっていた区分に出した人には crossed を立てない');

// ── 9人：生の n は絶対に返らない ────────────────────────────────
const AIR9 = nextAir();
const g9 = await fill(AIR9, 'fo', 9);
await asUser(g9[8]);
const r9 = await gap();
ok(r9.state === 'open', 'n=9 も open');
ok(!Object.values(r9).includes(9) && smallOnly(r9), `★値が 9 のキーが1つも無い（生の n は絶対に返らない）→ ${JSON.stringify(r9)}`);

// ── 区分は「いちばん新しい給与の行」の 会社 × 職位 ─────────────
/* 2人いる会社に先に出し、あとで1人の会社へ移った人 → 移った先（1人）の区分で答える */
const AIRM = nextAir();
const gm = await fill(AIRM, 'fo', 1, 1);
await submit({ ...BASE, airline: AIR2, position: 'fo', fleet: 'b777', period_year: 2025, period_month: 12 });   // 同じ人・古い月・2人以上の会社
await asUser(gm[0]);
const rm = await gap();
ok(rm.state === 'near' && rm.remaining === 1, `★区分はいちばん新しい給与の月の会社（古い月の会社では開いていても）→ ${JSON.stringify(rm)}`);
// 職位は機長・副操縦士の2つだけ（昔の行に残る訓練生は 'none'）
const AIRC = nextAir();
const gc = await fill(AIRC, 'cap', 1);
await db.query(`update pay_reports set "position" = 'cadet' where proof_hash = $1`, [await keyOf(gc[0], AIRC)]);
await asUser(gc[0]);
ok((await gap()).state === 'none', '職位が機長でも副操縦士でもない行（昔の訓練生）なら何も出さない');

// ── 自由入力の社名が会社コードに直るなら、その会社の区分 ─────────
let AIRT = null, TYPED = null;
for (const r of AIRS.slice(airAt)) {
  const typed = String(r.name_en).toUpperCase();
  if ((await one(`select public.pv_airline_resolve($1) c`, [typed])).c === r.code) { AIRT = r.code; TYPED = typed; break; }
}
ok(AIRT, '（準備）自由入力の社名の見本', String(TYPED));
const gt = await fill(AIRT, 'cap', 1);
await asUser(970);
await submit({ ...BASE, airline: 'other', airline_other: TYPED, position: 'cap', fleet: 'b777', period_year: 2026, period_month: 3 });
const rt = await gap();
ok(rt.state === 'open', `★打ち込んだ社名が会社コードに直る人は、その会社の区分（2人そろって open）→ ${JSON.stringify(rt)}`);

// ── 人数は保存してある表から読む（読むたびに数えない）──────────────
/* 表の n だけを持ち主として書き換えると、答えがその n に従う ＝ 数え直していない証拠。
   次の書き込みで引き金が作り直すので、本番の数字は崩れない。 */
await db.query(`update public.pv_member_median set n = 5 where airline = $1 and rank = 'fo'`, [AIR1]);
await asUser(g1[0]);
ok((await gap()).state === 'open', '★表の n を書き換えると答えがそれに従う（読むたびに pay_reports を数え直していない）');
await db.exec(`select public.pv_member_median_refresh()`);
await asUser(g1[0]);
ok((await gap()).state === 'near', '（数え直すと元の 1人 に戻る）');
await db.query(`delete from public.pv_member_median where airline = $1`, [AIR1]);
await asUser(g1[0]);
const rgone = await gap();
ok(rgone.state === 'near' && rgone.remaining === 2, `表にその区分の行が無ければ 0人 ＝ あと2人 → ${JSON.stringify(rgone)}`);
await db.exec(`select public.pv_member_median_refresh()`);

// ── 他人の区分は引けない ────────────────────────────────────
ok(Number((await one(`select pronargs from pg_proc where proname='my_cohort_gap'`)).pronargs) === 0,
   'my_cohort_gap は引数を取らない（総当たりの対象が存在しない）');

// ── 壊す証明：人数を表から読むのをやめて、pay_reports の行を数える版 ──────────
{
  const src = read('db/referrals.sql');
  const a0 = src.indexOf('create or replace function public.my_cohort_gap()');
  const fsrc = a0 < 0 ? '' : src.slice(a0, src.indexOf('\n$$;', a0) + '\n$$;'.length);
  const READ = `  select m.n, m.opened_at
    into v_n, v_open
    from public.pv_member_median m
   where m.airline = v_air and m.rank = v_rank;`;
  const ROWS = `  select count(*), null
    into v_n, v_open
    from public.pay_reports r
   where r.airline = v_air and r."position" = v_pos and r.annual_total_usd is not null;`;
  const broken = fsrc.replace(READ, () => ROWS);
  ok(fsrc.split(READ).length === 2 && broken !== fsrc, '（表を読む1文を見つけて、行を数える1文に差し替えた）');
  ok((await personCheck()).state === 'near', '（本物）1人 × 2か月の人は near');
  await db.exec(`begin`);
  await db.exec(broken);
  const red = await personCheck();
  await db.exec(`rollback`);
  ok(red.state === 'open', `★壊した版では、1人 × 2か月で「開いた」になる（検査が赤くなる）→ ${JSON.stringify(red)}`);
  ok((await personCheck()).state === 'near', '（巻き戻したあと: 本物は near）');
}

// ── 式ずれの警報 ────────────────────────────────────────────
// pay_reports に user_id は無く、自分の行は sha256(uid || '::pv_pay::' || 会社コード)
// でしか特定できない。その式が変わると my_cohort_gap は全員に 'none' を返して
// 黙って死ぬ（画面はどこも赤くならない）。ここで気づけるようにしておく。
await asUser(9000);
await submit({ ...BASE, position: 'cap', fleet: 'b757', period_year: 2026, period_month: 2 });
ok((await gap()).state !== 'none',
   '★投稿した直後に none が返るなら、proof_hash の式がずれている（db/pay-reports.sql:556）');

await db.exec(`set role anon`);
ok((await boom(`select my_cohort_gap()`) || '').includes('permission denied'),
   '登録していない人は「あと○人」を引けない');
ok((await boom(`select claim_referral('ABCDEFGH')`) || '').includes('permission denied'),
   '登録していない人はコードを試せない（実在を探る窓口が無い）');
await db.exec(`reset role`);


// ════════════════════════════════════════════════════════════
console.log('\n▼ 公開している集計を緩めていないこと');
// ════════════════════════════════════════════════════════════
ok((await one(`select pg_get_viewdef('public.pay_benchmarks'::regclass) v`)).v.includes('>= 5'),
   'referrals.sql を流したあとも pay_benchmarks は5人未満を出さない');
const cols = (await rows(`select column_name c from information_schema.columns
  where table_schema='public' and table_name in ('referral_codes','referrals')`)).map((x) => x.c);
ok(!cols.some((c) => ['email', 'name', 'salary', 'amount', 'annual_total_usd', 'airline'].includes(c)),
   `招待の表に金額・メール・氏名・会社の列が無い → ${cols.join(',')}`);


// ════════════════════════════════════════════════════════════
console.log('\n▼ ファイル末尾の自己点検（オーナーが本番で見るのと同じもの）');
// ════════════════════════════════════════════════════════════
{
  const sql = read('db/referrals.sql');
  const head = sql.lastIndexOf('with f as (');
  ok(head > 0, '自己点検の SELECT がファイル末尾にある');
  const res = await rows(sql.slice(head));
  ok(res.length === 15, `自己点検が15行ある → ${res.length} 行`);
  for (const r of res) ok(r['結果'] === '✅', `自己点検 ${r['#']}. ${r['見るところ']}`);
}

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
