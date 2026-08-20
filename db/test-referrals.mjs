/* db/referrals.sql を本物の Postgres（PGlite = PG17 の WASM ビルド）に流して確かめる。

   実行: node db/test-referrals.mjs   （または npm run test:sql）
   ネットワーク不要・本番に一切触らない。SQL を直したら必ずこれを通してから
   オーナーに実行を依頼すること。

   器は db/test-pay-reports.mjs と同じ（anon / authenticated ロール、既定権限を
   全付与した状態、auth.uid() の代役、profiles）。既定権限を先に全付与してあるから
   こそ referrals.sql の revoke が意味を持つ。無いと「元から権限が無いだけ」を
   「revoke が効いた」と誤読する。

   ★ここでいちばん大事な1行は「n≦2 のとき返り値に数字が1文字も無い」。
     5人未満の件数を出さない約束は3か所（pay-tracker.js / index.html / my-value.js）に
     理由つきで書いてあり、今回そこに例外を1つだけ開けている。例外が「3・4のときの
     2と1だけ」に留まっていることを、画面ではなくサーバの返り値で押さえる。
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
    email_opt_in boolean not null default false
  );

  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;
`);

// ── 適用（順番も含めて本番と同じ手順）────────────────────────
const FILES = ['db/airlines.generated.sql', 'db/vocab.generated.sql',
               'db/pay-reports.sql', 'db/pay-report-pending.sql', 'db/referrals.sql'];

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
  base_iata: 'DXB', seniority_years: 15, tax_rate_pct: 0, lang: 'en',
  age_bucket: '40-49',
};
/* 区分（会社・職位・機材・年）を丸ごと1つ占有して、n 人ぶんの行を作る。
   ★ユーザーは区分ごとに使い捨てにする。同じ人が2つの区分に出すと
     my_cohort_gap は「最新の1件」の区分を返すので、狙った区分を見なくなる。 */
let seat = 1000;
const fill = async (pos, fleet, year, n, monthFrom = 1) => {
  const users = [];
  for (let i = 0; i < n; i++) {
    const u = ++seat;
    await asUser(u);
    await submit({ ...BASE, position: pos, fleet, period_year: year, period_month: monthFrom + i });
    users.push(u);
  }
  return users;
};
/* その区分の「いま在る行」を過去へずらす。gained / crossed は created_at の
   前後だけで決まるので、1トランザクション1タイムスタンプのゆらぎに
   テストの合否を預けないためにこうする（本番の挙動は変えない）。 */
const backdate = (pos, fleet, year, days = 1) =>
  db.query(`update pay_reports set created_at = created_at - ($1 || ' days')::interval
             where "position"=$2 and fleet=$3 and period_year=$4`, [String(days), pos, fleet, year]);


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
console.log('\n▼ 「あと○人で詳細比較」— ここが本体');
// ════════════════════════════════════════════════════════════
const numbersIn = (o) => JSON.stringify(o).replace(/"[^"]*"\s*:/g, '').match(/\d/g) || [];

await asUser(700);
ok((await gap()).state === 'none', '投稿が1件も無い人には何も出さない');

await asUser(701);
await submit({ ...BASE, airline: 'other', airline_other: 'Some Charter Co',
               position: 'cap', fleet: 'a320', period_year: 2025, period_month: 4 });
ok((await gap()).state === 'none', '一覧にない会社（自由入力）だけの人には出さない（集計に入らないため）');

// ── n=1 と n=2：数字を1つも返さない ────────────────────────
const g1 = await fill('fo', 'a320', 2025, 1);
await asUser(g1[0]);
const r1 = await gap();
ok(r1.state === 'few', 'n=1 は few');
ok(numbersIn(r1).length === 0, `★n=1 の返り値に数字が1文字も無い → ${JSON.stringify(r1)}`);
ok(!('remaining' in r1) && !('n' in r1) && !('gained' in r1),
   'n=1 では remaining も n も gained も返さない');

const g2 = await fill('fo', 'b737', 2025, 2);
await asUser(g2[0]);
const r2 = await gap();
ok(r2.state === 'few', 'n=2 も few');
ok(numbersIn(r2).length === 0, `★n=2 の返り値に数字が1文字も無い → ${JSON.stringify(r2)}`);
ok(JSON.stringify(r1) === JSON.stringify(r2), 'n=1 と n=2 は見分けがつかない（人数が漏れない）');

// ── n=3 / n=4：ここだけ数を出す ────────────────────────────
const g3 = await fill('fo', 'a220', 2025, 3);
await asUser(g3[2]);            // 最後に出した人が見る
const r3 = await gap();
ok(r3.state === 'near' && r3.remaining === 2, `n=3 → あと2人 → ${JSON.stringify(r3)}`);
ok(!('n' in r3), 'n=3 でも生の n は返さない');

const g4 = await fill('fo', 'b757', 2025, 4);
await asUser(g4[3]);
const r4 = await gap();
ok(r4.state === 'near' && r4.remaining === 1, `n=4 → あと1人 → ${JSON.stringify(r4)}`);

// ── n≧5：比較が出るので招待の導線は出さない ────────────────
const g5 = await fill('cadet', 'a320', 2025, 5);
await asUser(g5[4]);            // 最後に出した人＝自分より後の行が無い
const r5 = await gap();
ok(r5.state === 'open', 'n=5 は open（普通の比較が出る）');
ok(!('remaining' in r5), 'open では remaining を返さない（「あと0人」と書かせない）');
ok(r5.crossed === false && r5.gained === 0, `最後に出した人には増分が無い → ${JSON.stringify(r5)}`);

const g9 = await fill('cadet', 'b737', 2025, 9);
await asUser(g9[8]);
const r9 = await gap();
ok(r9.state === 'open', 'n=9 も open');
ok(!Object.values(r9).includes(9), `★値が 9 のキーが1つも無い（生の n は絶対に返らない）→ ${JSON.stringify(r9)}`);

// ── 他人の区分は引けない ────────────────────────────────────
await asUser(g1[0]);
ok((await gap()).state === 'few', '引数が無いので、自分の区分しか見られない（n=1 の人には few のまま）');
ok(Number((await one(`select pronargs from pg_proc where proname='my_cohort_gap'`)).pronargs) === 0,
   'my_cohort_gap は引数を取らない（総当たりの対象が存在しない）');

// ── 「良くなった」の判定 ────────────────────────────────────
const gg = await fill('cap', 'a220', 2025, 1);
await backdate('cap', 'a220', 2025, 1);          // 自分の行を1日前へ
await fill('cap', 'a220', 2025, 2, 5);           // そのあと2件増える
await asUser(gg[0]);
const rg2 = await gap();
ok(rg2.state === 'near' && rg2.remaining === 2 && rg2.gained === 2,
   `前回自分が記録してから2件増えた → ${JSON.stringify(rg2)}`);

// §25 — 自分より前の行しか無い区分では、どう呼んでも「増えました」にならない
const gb = await fill('cap', 'b757', 2025, 2);
await backdate('cap', 'b757', 2025, 1);
const gb2 = await fill('cap', 'b757', 2025, 1, 5);
await asUser(gb2[0]);
const rb = await gap();
ok(rb.gained === 0, `★全部が自分の投稿より前なら gained は0（嘘の「増えました」が表現できない）→ ${JSON.stringify(rb)}`);
await asUser(gb2[0]);
ok((await gap()).gained === 0, '何度呼んでも0のまま');

// crossed — 4人から5人へ越えた瞬間だけ true
const gc = await fill('cadet', 'a220', 2025, 1);
await backdate('cadet', 'a220', 2025, 1);
await fill('cadet', 'a220', 2025, 4, 5);
await asUser(gc[0]);
const rc = await gap();
ok(rc.state === 'open' && rc.crossed === true && rc.gained === 4,
   `4人ぶん増えて5人になった → ${JSON.stringify(rc)}`);
await asUser(g9[8]);
ok((await gap()).crossed === false, 'もともと5人以上そろっていた人には crossed を立てない');

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
  ok(res.length === 12, `自己点検が12行ある → ${res.length} 行`);
  for (const r of res) ok(r['結果'] === '✅', `自己点検 ${r['#']}. ${r['見るところ']}`);
}

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
