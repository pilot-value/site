/* db/pay-rows.sql を本物の Postgres（PGlite = PG17 の WASM ビルド）に流して確かめる。

   実行: node db/test-pay-rows.mjs   （または npm run test:sql）
   ネットワーク不要・本番に一切触らない。SQL を直したら必ずこれを通してから
   オーナーに実行を依頼すること。

   器は db/test-referrals.mjs と同じ（anon / authenticated ロール、既定権限を
   全付与した状態、auth.uid() の代役、profiles）。既定権限を先に全付与してあるから
   こそ pay-rows.sql の revoke が意味を持つ。無いと「元から権限が無いだけ」を
   「revoke が効いた」と誤読する。

   ★ここでいちばん大事なのは次の4本（落ちたら画面を作ってはいけない）。
     ・同じ人の12か月が5行に畳まれること      … 月をまたいで個人を追えないこと
     ・中央値の10倍がどこにも出てこないこと    … 極端な1人がそのまま浮かないこと
     ・787 と 330 を出した人がカテゴリで1人    … 粒度Bを粒度Aから積み上げていないこと
     ・pv_pay_rows('ana') が落ちること         … 引数の面が存在しないこと

   行を作るときは必ず submit_pay_report() を通す。proof_hash を手で作らない
   （式は2か所にしか無い、が CLAUDE.md の約束）。
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
               'db/pay-reports.sql', 'db/pay-report-pending.sql', 'db/pay-rows.sql'];

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
const asAnon = () => db.query(`select set_config('pv.uid', '', false)`);

/* ★1日10件の上限（db/pay-reports.sql の submit_pay_report）に当たらないよう、
   1件ごとに当日カウンタを戻す。上限そのものは db/test-pay-reports.mjs が見ている。
   ここで見たいのは「12か月ぶんが1行に畳まれるか」なので、上限は邪魔なだけ。 */
const submit = async (payload) => {
  const r = await one(`select submit_pay_report($1::jsonb) r`, [JSON.stringify(payload)]);
  await db.query(`update profiles set pay_reports_today = 0`);
  return r;
};

/* 対象年は去年に固定する。今年だと「未来の月は投稿できません」で 9〜12月が落ちる。
   年は区分の材料に入っていないので（会社×職位×機材まで）、結果には影響しない。 */
const YEAR = new Date().getFullYear() - 1;
const BASE = { currency: 'USD', lang: 'en', tax_rate_pct: 0 };

/* 1人ぶん作る。months = [{fleet, month, gross}]
   gross_monthly を使うので 年収 = gross × 12（USD は to_usd = 1.000000）。
   狙った額をそのまま作れるので、丸めとクリップの検算が読める形になる。 */
let seat = 1000;
const person = async (air, pos, months) => {
  const u = ++seat;
  await asUser(u);
  for (const m of months) {
    await submit({ ...BASE, airline: air, position: pos, fleet: m.fleet,
                   period_year: YEAR, period_month: m.month, gross_monthly: m.gross });
  }
  return u;
};

const backdateAll = (days) =>
  db.query(`update pay_reports set created_at = now() - ($1 || ' days')::interval`, [String(days)]);
const backdateAirline = (air, days) =>
  db.query(`update pay_reports set created_at = now() - ($2 || ' days')::interval where airline = $1`,
    [air, String(days)]);

const VIEWER = 9002;
const asViewer = () => db.query(`select set_config('pv.uid', $1, false)`, [uid(VIEWER)]);
const payRows = async () => (await one(`select pv_pay_rows() r`)).r;
const only = (rs, f) => rs.filter(f);

// 会社コードは語彙から取る（このテストのために特定の社名を覚えない）
const AIR = (await rows(
  `select code from pv_airlines where code <> 'other' and active order by code limit 8`
)).map(r => r.code);
const [A_FIVE, A_FOUR, A_M12, A_MIX, A_DELAY, A_NOCAT] = AIR;

// ════════════════════════════════════════════════════════════
console.log('\n▼ 1. 鍵（ログインと access_until）');
// ════════════════════════════════════════════════════════════
await asAnon();
ok(/ログイン/.test(await boom(`select pv_pay_rows()`) || ''),
   'ログインしていない人は呼べない');
ok(!(await one(`select has_function_privilege('anon','public.pv_pay_rows()','execute') b`)).b,
   'anon に execute が渡っていない');
ok((await one(`select has_function_privilege('authenticated','public.pv_pay_rows()','execute') b`)).b,
   'ログインした人には execute が渡っている');

await asUser(9001);                       // 一度も給与を出していない人
let r = await payRows();
ok(r.state === 'locked' && Array.isArray(r.rows) && r.rows.length === 0,
   '鍵を持っていない人は locked（行はゼロ）', JSON.stringify(r));
await db.query(`update profiles set access_until = now() - interval '1 day' where id = $1`, [uid(9001)]);
r = await payRows();
ok(r.state === 'locked' && r.rows.length === 0, '鍵が切れている人も locked', JSON.stringify(r));

/* 見る人は自分では1件も出していない。出させると、その1行が区分に混ざって
   下の検算（人数・中央値）がぜんぶ1ずれる。鍵だけ直接開ける。 */
await db.query(`insert into profiles(id,email,access_until) values($1,$2, now() + interval '90 days')
                on conflict (id) do update set access_until = excluded.access_until`,
  [uid(VIEWER), `viewer@example.com`]);

// ════════════════════════════════════════════════════════════
console.log('\n▼ 2. データを作る');
// ════════════════════════════════════════════════════════════
// (a) 5人。うち1人だけ中央値の10倍
for (const g of [15000, 15000, 15000, 15000, 150000])
  await person(A_FIVE, 'cap', [{ fleet: 'b777', month: 3, gross: g }]);

// (b) 4人だけ
for (let i = 0; i < 4; i++)
  await person(A_FOUR, 'cap', [{ fleet: 'b777', month: 3, gross: 15000 }]);

// (c) 5人 × 12か月
for (let i = 0; i < 5; i++)
  await person(A_M12, 'fo', Array.from({ length: 12 },
    (_, m) => ({ fleet: 'a320', month: m + 1, gross: 8000 + m * 100 })));

// (d) 1人が 787 と 330（どちらもワイドボディ）＋ 787 だけの4人
await person(A_MIX, 'cap', [{ fleet: 'b787', month: 1, gross: 10000 },
                            { fleet: 'a330', month: 2, gross: 20000 }]);
for (let i = 0; i < 4; i++)
  await person(A_MIX, 'cap', [{ fleet: 'b787', month: 1, gross: 15000 }]);

// (e) 30日の門を見るための5人
for (let i = 0; i < 5; i++)
  await person(A_DELAY, 'cap', [{ fleet: 'a350', month: 4, gross: 15000 }]);

// (f) 「一覧にない会社」5人
for (let i = 0; i < 5; i++) {
  const u = ++seat; await asUser(u);
  await submit({ ...BASE, airline: 'other', airline_other: 'Somewhere Air',
                 position: 'cap', fleet: 'b737', period_year: YEAR, period_month: 5,
                 gross_monthly: 15000 });
}

// (g) 機材の区分が無い行（★投稿側は弾くので、あとから作る。理由は下の検査に書いた）
for (let i = 0; i < 5; i++)
  await person(A_NOCAT, 'cap', [{ fleet: 'b767', month: 6, gross: 15000 }]);
await db.query(`update pay_reports set fleet_cat = null where airline = $1`, [A_NOCAT]);

await backdateAll(45);                    // 全部「45日前に出した」ことにする
await asViewer();
r = await payRows();
ok(r.ok === true && r.state === 'open', '鍵のある人には open が返る', JSON.stringify(r.state));
const R = r.rows;

// ════════════════════════════════════════════════════════════
console.log('\n▼ 3. 5人の門');
// ════════════════════════════════════════════════════════════
ok(only(R, x => x.airline === A_FOUR).length === 0,
   '4人しかいない区分は1行も出ない');
ok(only(R, x => x.airline === A_FIVE && x.grain === 'fleet').length === 5,
   '5人そろえば機材の粒度で5行');
ok(only(R, x => x.airline === A_FIVE && x.grain === 'cat').length === 5,
   '同じ5人がカテゴリの粒度でも5行（粒度は独立に作る）');
ok(only(R, x => x.airline === A_FIVE && x.grain === 'cat')
     .every(x => x.bucket === 'w'),
   'ワイドボディの行が w にまとまっている');

// ════════════════════════════════════════════════════════════
console.log('\n▼ 4. ★同じ人の複数月が1行に畳まれる');
// ════════════════════════════════════════════════════════════
const m12 = only(R, x => x.airline === A_M12 && x.grain === 'fleet');
ok(m12.length === 5, '5人が12か月ずつ出しても5行（60行にならない）', `= ${m12.length}行`);
ok((await one(`select count(*)::int c from pay_reports where airline = $1`, [A_M12])).c === 60,
   '　（元の表には60行ちゃんと入っている）');

// ════════════════════════════════════════════════════════════
console.log('\n▼ 5. ★外れ値がそのまま出ない');
// ════════════════════════════════════════════════════════════
const five = only(R, x => x.airline === A_FIVE && x.grain === 'fleet')
               .map(x => Number(x.annual_usd));
ok(!five.includes(150000 * 12), '中央値の10倍を出した人の額はどこにも現れない', JSON.stringify(five));
ok(Math.max(...five) < 150000 * 12, '　いちばん高い行も本人の額より下', `max=${Math.max(...five)}`);
ok(five.filter(v => v === 15000 * 12).length === 4, '　残り4人はそのままの額');

// ════════════════════════════════════════════════════════════
console.log('\n▼ 6. 有効数字2桁');
// ════════════════════════════════════════════════════════════
const notRounded = await rows(
  `select v from (
     select (e->>'annual_usd')::numeric v from jsonb_array_elements(pv_pay_rows()->'rows') e
     union all
     select (e->>'cohort_median_usd')::numeric from jsonb_array_elements(pv_pay_rows()->'rows') e
   ) q where pv_sig2(v) is distinct from v`);
ok(notRounded.length === 0, '画面に出るすべての額が有効数字2桁',
   JSON.stringify(notRounded.slice(0, 3)));
ok((await one(`select pv_sig2(183456::numeric) v`)).v == 180000, 'pv_sig2(183456) = 180000');
ok((await one(`select pv_sig2(0::numeric) v`)).v === null, 'pv_sig2(0) は null');

// ════════════════════════════════════════════════════════════
console.log('\n▼ 7. 30日の遅延');
// ════════════════════════════════════════════════════════════
await backdateAirline(A_DELAY, 29);
ok(only(await payRows().then(x => x.rows), x => x.airline === A_DELAY).length === 0,
   '出してから29日では出ない');
await backdateAirline(A_DELAY, 31);
{
  const back = await payRows().then(x => x.rows);
  // ★機材の粒度で5行・カテゴリの粒度で5行の 計10行。片方だけ数えると
  //   「出ていない」と「半分しか出ていない」を取り違える。
  ok(only(back, x => x.airline === A_DELAY && x.grain === 'fleet').length === 5,
     '31日たてば機材の粒度に出る');
  ok(only(back, x => x.airline === A_DELAY && x.grain === 'cat').length === 5,
     '　カテゴリの粒度にも出る');
}
await backdateAirline(A_DELAY, 45);

// ════════════════════════════════════════════════════════════
console.log('\n▼ 8. 混ざってはいけないもの');
// ════════════════════════════════════════════════════════════
ok(only(R, x => x.airline === 'other').length === 0,
   '「一覧にない会社」は1行も出ない（社名そのものが識別子）');
/* ★投稿側（pv_validate_pay_payload）は区分の無い機材を弾くので、この行は今日は作れない。
   それでも読み側に門を置いてある。語彙に区分の無い機材が足された日に、
   ラベルの無い null の区分が画面に生えるのを止めるため。 */
ok(only(R, x => x.airline === A_NOCAT && x.grain === 'cat').length === 0,
   '機材の区分が無い行はカテゴリの粒度に出ない');
ok(only(R, x => x.airline === A_NOCAT && x.grain === 'fleet').length === 5,
   '　ただし機材の粒度には出る');
ok(only(R, x => x.bucket === null || x.bucket === undefined).length === 0,
   'ラベルの無い区分が1つも無い');

// ════════════════════════════════════════════════════════════
console.log('\n▼ 9. ★粒度Bを粒度Aから積み上げていない');
// ════════════════════════════════════════════════════════════
const mixCat = only(R, x => x.airline === A_MIX && x.grain === 'cat');
ok(mixCat.length === 5,
   '787 と 330 を出した人がカテゴリで1人に数えられている（6行にならない）',
   `= ${mixCat.length}行`);
ok(only(R, x => x.airline === A_MIX && x.grain === 'fleet' && x.bucket === 'b787').length === 5,
   '　787 の粒度は5人ぶん出る');
ok(only(R, x => x.airline === A_MIX && x.grain === 'fleet' && x.bucket === 'a330').length === 0,
   '　330 は1人なので出ない');
ok(mixCat.map(x => Number(x.annual_usd)).includes(15000 * 12 * 1),
   '　カテゴリ側の額も2桁に丸めた値', JSON.stringify(mixCat.map(x => x.annual_usd)));

// ════════════════════════════════════════════════════════════
console.log('\n▼ 10. 返り値に何が入っているか');
// ════════════════════════════════════════════════════════════
const ALLOWED = ['airline', 'pos', 'grain', 'bucket', 'annual_usd', 'verified', 'cohort_median_usd'];
const extra = [...new Set(R.flatMap(x => Object.keys(x)))].filter(k => !ALLOWED.includes(k));
ok(extra.length === 0, '返す項目は7つだけ', JSON.stringify(extra));

const raw = (await one(`select pv_pay_rows()::text t`)).t;
const BANNED = ['proof_hash', 'base_iata', 'seniority', 'age_bucket', 'period_month',
                'period_year', 'created_at', 'annual_total_orig', 'currency',
                'contract_type', 'tax_country', 'nationality', 'verify_level',
                'base_pay', 'housing', 'per_diem', 'block_hours'];
const hit = BANNED.filter(w => raw.includes(w));
ok(hit.length === 0, '準識別子・個人の内訳が返り値の文字列に1つも無い', JSON.stringify(hit));

const fiveCat = only(R, x => x.airline === A_FIVE && x.grain === 'fleet');
ok(new Set(fiveCat.map(x => String(x.cohort_median_usd))).size === 1,
   '同じ区分の行は同じ中央値を持つ');
ok(Number(fiveCat[0].cohort_median_usd) === 15000 * 12,
   '中央値がその区分の中央値と一致する', String(fiveCat[0].cohort_median_usd));
ok(R.every(x => typeof x.verified === 'boolean'), '検証は true/false の1つだけ（段階を持たない）');
ok(R.every(x => x.verified === false), '　今日は検証済みがいないので全部 false');

// ════════════════════════════════════════════════════════════
console.log('\n▼ 11. ★引数の面が無い');
// ════════════════════════════════════════════════════════════
ok((await boom(`select pv_pay_rows('${A_M12}')`)) !== null,
   '会社を指定して呼ぶことはできない');
ok((await one(`select pronargs::int n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                where s.nspname='public' and p.proname='pv_pay_rows'`)).n === 0,
   '関数は引数を1つも取らない');

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12. 自己点検 SQL（ファイル末尾のものをそのまま流す）');
// ════════════════════════════════════════════════════════════
{
  const src = read('db/pay-rows.sql');
  const q = src.slice(src.lastIndexOf('with f as ('));
  const res = await rows(q);
  ok(res.length === 15, `自己点検が15行ぜんぶ出る（= ${res.length}行）`);
  for (const row of res) {
    ok(row['結果'] === '✅', `${row['#']}. ${row['見るところ']}`);
  }
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 13. 8-20（pay_reports を読む関数が anon に開いていないこと）');
// ════════════════════════════════════════════════════════════
{
  const src = read('db/pay-reports.sql');
  const q = src.slice(src.lastIndexOf('-- 8-20.'));
  const res = await rows(q.slice(q.indexOf('select')));
  ok(res.length === 0, 'pay_reports を読む security definer 関数が anon に1つも開いていない',
     JSON.stringify(res));
}

// ── まとめ ───────────────────────────────────────────────────
console.log(`\n${fail === 0 ? '✅ 全部通った' : '❌ 落ちた項目がある'}  pass ${pass} / fail ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
