/* db/pay-reports.sql を本物の Postgres（PGlite = PG17 の WASM ビルド）に流して確かめる。

   実行: node db/test-pay-reports.mjs   （または npm run test:sql）
   ネットワーク不要・本番に一切触らない。SQL を直したら必ずこれを通してから
   オーナーに実行を依頼すること。


   Supabase 本番では試せない（オーナー承認が要る）ので、同じ形の器をここに作る：
     ・anon / authenticated ロール
     ・schema public の既定権限を anon/authenticated に全付与（＝Supabase の初期状態）
       → これがあるからこそ pay-reports.sql の revoke が意味を持つ。無いと
         「元から権限が無いだけ」を「revoke が効いた」と誤読する。
     ・auth.uid()（テスト用 GUC から返す）
     ・profiles（id = auth.users.id）
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
/* 会社数の期待値は SSOT から取る。ここを固定値にすると、1社足すたびに
   「SQL は正しいのにテストだけ落ちる」になり、落ちたテストを疑わなくなる。 */
import { SALARY } from '../salary-data.mjs';
import { OPS, RETIRED } from '../airline-ops.mjs';

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

  -- 本番の auth.uid() の代役。テストから set_config で切り替える。
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;
`);

// ── 適用（順番も含めて本番と同じ手順）────────────────────────
console.log('\n▼ SQL の適用');
for (const f of ['db/airlines.generated.sql', 'db/vocab.generated.sql',
                 'db/pay-reports.sql', 'db/pay-edit.sql', 'db/pay-report-pending.sql']) {
  try { await db.exec(read(f)); console.log(`  ✅ ${f}`); pass++; }
  catch (e) { console.log(`  ❌ ${f}\n     ${e.message}`); fail++; process.exit(1); }
}

// 2回流しても壊れないこと（冪等）
console.log('\n▼ 冪等性（もう一度そのまま流す）');
for (const f of ['db/airlines.generated.sql', 'db/vocab.generated.sql',
                 'db/pay-reports.sql', 'db/pay-edit.sql', 'db/pay-report-pending.sql']) {
  try { await db.exec(read(f)); console.log(`  ✅ ${f} 再適用OK`); pass++; }
  catch (e) { console.log(`  ❌ ${f} 再適用で失敗\n     ${e.message}`); fail++; }
}

// ── 語彙が入ったか ───────────────────────────────────────────
console.log('\n▼ 語彙マスタ');
const cnt = await one(`select
  (select count(*) from pv_airlines where active)  a,
  (select count(*) from pv_fleets where active)    f,
  (select count(*) from pv_positions where active) p,
  (select count(*) from pv_age_buckets where active) g,
  (select count(*) from pv_currencies where active) c,
  (select count(*) from fx_rates) fx`);
/* ★会社の名簿は2つある（2026-09-13）。年収がある社（SALARY）と、
   年収を持たない投稿先だけの社（airline-ops.mjs の OPS）。
   どちらも db/airlines.generated.sql に入る。 */
const N_AIRLINES = Object.keys(SALARY).length + Object.keys(OPS).length + 1;  // 全社 ＋ other
ok(Number(cnt.a) === N_AIRLINES, `会社 ${N_AIRLINES}（other 込み）→ ${cnt.a}`);
ok(Number(cnt.f) === 19, `機種 19 → ${cnt.f}`);
/* ★2026-09-02、訓練生（cadet）を選択肢から外した（オーナー指示）。
   行は残して active=false にしてある＝ pay_reports.position の外部キーが切れず、
   既に入っている2件は REAL PAY に「訓練生」と出たまま。 */
ok(Number(cnt.p) === 2, `選べる職位 2（機長・副操縦士）→ ${cnt.p}`);
{
  const cd = await one(`select active from pv_positions where code = 'cadet'`);
  ok(cd && cd.active === false,
     '★訓練生の行は消さずに残っている（消すと過去の投稿が外部キーごと宙に浮く）');
}
/* ★2026-11-02 名簿から外した会社（RETIRED）は、訓練生と同じく行を消さずに active=false で残る
   （消すと過去の給与・口コミの外部キーが宙に浮く）。公開していない年収の幅は持たない（REAL PAY の ⚠ を付けない）。 */
for (const [code, a] of Object.entries(RETIRED)) {
  const r = await one(`select name_ja, name_en, active, cap_lo, cap_hi, fo_lo, fo_hi from pv_airlines where code = $1`, [code]);
  ok(r && r.active === false && r.name_ja === a.ja && r.name_en === a.en && [r.cap_lo, r.cap_hi, r.fo_lo, r.fo_hi].every((v) => v === null),
     `★名簿から外した会社（${code}）の行は消さずに残る（active=false・社名そのまま・年収の幅なし）`, JSON.stringify(r));
}
/* ★年代は口コミ（submit-review.html）が5歳刻みで先に集めている。こちらは10歳刻み。
   件数がずれたら、どちらかの刻みを動かした合図（gen-vocab.mjs が突き合わせている）。 */
ok(Number(cnt.g) === 5, `年代 5 → ${cnt.g}`);
/* 2026-11-02 多言語化でペルー・ソル（PEN）とアルゼンチン・ペソ（ARS）を足して 47 */
ok(Number(cnt.c) === 47, `通貨 47 → ${cnt.c}`);
/* ★語彙にある通貨は全部レートを持っていること。2026-08-22 まで7通貨しか無く、
   残り38通貨で出した人は annual_total_usd が null になって集計から黙って外れていた
   （実際にエバー航空の台湾ドルが1件）。ここが 47 未満に戻ったらまた穴が空く。 */
ok(Number(cnt.fx) === 47, `レート 47（fx-rates.mjs 由来。語彙の通貨と同数）→ ${cnt.fx}`);
ok(Number(cnt.fx) === Number(cnt.c), 'レートの無い通貨が1つも無い');

// ── 年換算の定義 ─────────────────────────────────────────────
console.log('\n▼ 年換算の計算');
/* ★第1引数は「その月の額面（総支給）」。内訳を足すときは null を渡す。
   2026-08-12 に引数が12→13本に増えた。古い12本版が残っていると、引数の数で
   新旧どちらが呼ばれるか変わり、同じ入力から違う年収が出るので、本数も見る。 */
const nfn = await one(`select count(*) c from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                        where n.nspname='public' and p.proname='pv_annual_total'`);
ok(Number(nfn.c) === 1, `pv_annual_total は1本だけ（古い12引数版が残っていない）→ ${nfn.c}`);
/* ★2026-08-26、保証給（p_guarantee_pay）・教官の手当（p_instructor_pay）・
   審査の手当（p_examiner_pay）・組合の手当（p_union_pay）・
   管理職の手当（p_management_pay）を末尾に足して19本になった。
   ★2026-08-27、その他の兼務・配属の手当（p_nonline_pay）を足して20本。
   ★2026-09-02、組合の分が総支給の外か（p_union_outside_gross）を足して21本。
   ★2026-11-04、パーディアムが明細とは別か（p_perdiem_outside_gross）を足して22本。
     どれも default 付きなので、13本で呼んでいる下の検査はそのまま通る。 */
const narg = await one(`select p.pronargs n from pg_proc p join pg_namespace nn on nn.oid=p.pronamespace
                         where nn.nspname='public' and p.proname='pv_annual_total'`);
ok(Number(narg.n) === 22,
   `pv_annual_total は22引数（保証給・教官・審査・組合・管理職・兼務＋組合の支給元＋パーディアムの受け取り方まで受ける）→ ${narg.n}`);
/* 保証給は基本給と足し上げる（別の列だが、年収では同じ「固定の支給」）。 */
const gp = await one(`select pv_annual_total(null,20000,null,null,null,null,null,null,
                                             null,null,null,null,null,null,5000) v`);
ok(Number(gp.v) === 300000, `基本給20,000＋保証給5,000 → ${gp.v}（期待 300000）`);
/* ★総支給がある行では今までどおり内訳を一切見ない＝保証給を足しても動かない。 */
const gp2 = await one(`select pv_annual_total(54250,20000,null,null,null,null,null,null,
                                              null,null,null,null,null,null,5000) v`);
ok(Number(gp2.v) === 651000, `総支給がある行は保証給でも動かない → ${gp2.v}（期待 651000）`);
/* ★教官の手当（2026-08-26 その3）。総支給がある行では1円も動かない
   ＝オーナー指示「本人が入れた総支給を書き換えない」がここでも守られる。 */
const ip = await one(`select pv_annual_total(null,20000,null,null,null,null,null,null,
                                             null,null,null,null,null,null,null,60000) v`);
ok(Number(ip.v) === 960000, `基本給20,000＋教官60,000 → ${ip.v}（期待 960000）`);
const ip2 = await one(`select pv_annual_total(54250,20000,null,null,null,null,null,null,
                                              null,null,null,null,null,null,null,60000) v`);
ok(Number(ip2.v) === 651000, `総支給がある行は教官の手当でも動かない → ${ip2.v}（期待 651000）`);
/* ★審査・査察の手当（2026-08-26 その4）。教官とは別の列で、同じように扱う。
   ⚠️ 教官の額に足し込まれていないことが本題（同じお金を2回数えない）。 */
const xp = await one(`select pv_annual_total(null,20000,null,null,null,null,null,null,
                                             null,null,null,null,null,null,null,null,40000) v`);
ok(Number(xp.v) === 720000, `基本給20,000＋審査40,000 → ${xp.v}（期待 720000）`);
const xp2 = await one(`select pv_annual_total(null,20000,null,null,null,null,null,null,
                                              null,null,null,null,null,null,null,60000,40000) v`);
ok(Number(xp2.v) === 1440000,
   `教官60,000と審査40,000は別々に足される → ${xp2.v}（期待 1440000）`);
const xp3 = await one(`select pv_annual_total(54250,20000,null,null,null,null,null,null,
                                              null,null,null,null,null,null,null,null,40000) v`);
ok(Number(xp3.v) === 651000, `総支給がある行は審査の手当でも動かない → ${xp3.v}（期待 651000）`);
/* ★管理・マネジメントの手当（2026-08-26 その6）。教官・審査・組合とはまた別の列。
   ⚠️ 組合と違い、SQL 側は支給元の条件を持たない（条件つきなのは画面の突き合わせだけ）。 */
const gm = await one(`select pv_annual_total(null,20000,null,null,null,null,null,null,
                                             null,null,null,null,null,null,null,null,null,null,5000) v`);
ok(Number(gm.v) === 300000, `基本給20,000＋管理職5,000 → ${gm.v}（期待 300000）`);
const gm2 = await one(`select pv_annual_total(null,20000,null,null,null,null,null,null,
                                              null,null,null,null,null,null,null,60000,40000,1000,5000) v`);
ok(Number(gm2.v) === 1512000,
   `教官・審査・組合・管理職が4つとも別々に足される → ${gm2.v}（期待 1512000）`);
const gm3 = await one(`select pv_annual_total(54250,20000,null,null,null,null,null,null,
                                              null,null,null,null,null,null,null,null,null,null,5000) v`);
ok(Number(gm3.v) === 651000, `総支給がある行は管理職の手当でも動かない → ${gm3.v}（期待 651000）`);
/* ★その他の兼務・配属の手当（2026-08-27 その7）。20番目。管理職と同じで条件を持たない。 */
const nl = await one(`select pv_annual_total(null,20000,null,null,null,null,null,null,
                                             null,null,null,null,null,null,null,null,null,null,null,30000) v`);
ok(Number(nl.v) === 600000, `基本給20,000＋兼務・配属30,000 → ${nl.v}（期待 600000）`);
const nl2 = await one(`select pv_annual_total(null,20000,null,null,null,null,null,null,
                                              null,null,null,null,null,null,null,60000,40000,1000,5000,30000) v`);
ok(Number(nl2.v) === 1872000,
   `教官・審査・組合・管理職・兼務が5つとも別々に足される → ${nl2.v}（期待 1872000）`);
const nl3 = await one(`select pv_annual_total(54250,20000,null,null,null,null,null,null,
                                              null,null,null,null,null,null,null,null,null,null,null,30000) v`);
ok(Number(nl3.v) === 651000, `総支給がある行は兼務・配属の手当でも動かない → ${nl3.v}（期待 651000）`);
const a1 = await one(`select pv_annual_total(null,20000,250,75,85,3000,'allowance',10000,null,null,null,null,null) v`);
ok(Number(a1.v) === 651000, `住宅手当は現金なので足す → ${a1.v}（期待 651000）`);
const a2 = await one(`select pv_annual_total(null,20000,250,75,85,3000,'provided',10000,null,null,null,null,null) v`);
ok(Number(a2.v) === 531000, `社宅（現物）は足さない → ${a2.v}（期待 531000）`);
const a3 = await one(`select pv_annual_total(null,20000,250,90,85,null,null,null,null,null,null,null,null) v`);
ok(Number(a3.v) === 510000, `実績85h < 保証90h なら保証で払われる → ${a3.v}（期待 510000）`);

// かんたん入力：総支給1本だけ（明細を開かずに答えられる唯一の数字）
const g1 = await one(`select pv_annual_total(54250,null,null,null,85,null,null,null,null,null,null,null,null) v`);
ok(Number(g1.v) === 651000, `総支給54,250×12 → ${g1.v}（期待 651000）`);
// ★総支給があるときは内訳を一切見ない＝住居や手当の二重計上が構造的に起きない
const g2 = await one(`select pv_annual_total(54250,20000,250,75,85,3000,'allowance',10000,2000,3000,1000,null,null) v`);
ok(Number(g2.v) === 651000, `総支給があれば内訳は無視 → ${g2.v}（期待 651000）`);
// 賞与は総支給の外（月額×12 に混ぜると、出す月で年収が倍ちがう）
const g3 = await one(`select pv_annual_total(54250,null,null,null,85,null,null,null,null,null,null,300000,null) v`);
ok(Number(g3.v) === 951000, `総支給×12＋年間賞与30万 → ${g3.v}（期待 951000）`);
// 総支給0は「入力なし」に倒す（0を入力ありと数えると年収0の行が通る）
const g4 = await one(`select pv_annual_total(0,20000,null,null,null,null,null,null,null,null,null,null,null) v`);
ok(Number(g4.v) === 240000, `総支給0なら内訳へ落ちる → ${g4.v}（期待 240000）`);

// ── 投稿 ─────────────────────────────────────────────────────
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const asUser = async (n) => {
  await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`,
    [uid(n), `p${n}@example.com`]);
  await db.query(`select set_config('pv.uid', $1, false)`, [uid(n)]);
};
const submit = (payload) => one(`select submit_pay_report($1::jsonb) r`, [JSON.stringify(payload)]);

const BASE = {
  airline: 'emirates', position: 'cap', fleet: 'b777', currency: 'AED',
  base_pay: 20000, hourly_rate: 250, guaranteed_hours: 75, block_hours: 85,
  per_diem: 3000, housing_type: 'allowance', housing_amount: 10000,
  base_iata: 'DXB', seniority_years: 15, rank_years: 6, tax_rate_pct: 0, lang: 'en',
  age_bucket: '40-49',
};

console.log('\n▼ 投稿（1人目）');
await asUser(1);
let r = (await submit({ ...BASE, period_year: 2026, period_month: 6 })).r;
ok(r.ok === true, '投稿が通る');
ok(Number(r.annual_total_orig) === 651000, `原本通貨の年換算 AED ${r.annual_total_orig}`);
ok(r.annual_total_usd !== null && Number(r.annual_total_usd) > 0, `USD 換算 $${r.annual_total_usd}`);
ok(Number(r.usd_per_block_hour) > 0, `$/block hour = ${r.usd_per_block_hour}`);
ok('benchmark' in r && r.benchmark === null, '投稿の見返り（benchmark）はキーだけ残して null（2026-11-08 から、人数に関係なくいつも）');

const stored = await one(`select * from pay_reports where period_month=6`);
ok(stored.currency === 'AED', `原本通貨のまま保存 → ${stored.currency}`);
ok(Number(stored.base_pay) === 20000, `原本の金額のまま保存 → ${stored.base_pay}`);
ok(stored.fleet_cat === 'w', `fleet_cat が語彙から自動で入る → ${stored.fleet_cat}`);
ok(stored.fx_at !== null, `fx_at が記録される → ${stored.fx_at}`);
ok(!('user_id' in stored), 'user_id 列が存在しない');

// ── 同じ月の出し直し ─────────────────────────────────────────
console.log('\n▼ 同一社・同一月の再投稿');
const again = (await submit({ ...BASE, period_year: 2026, period_month: 6, base_pay: 22000 })).r;
const dup = await one(`select count(*) n, max(base_pay) b from pay_reports where period_month=6`);
ok(Number(dup.n) === 1, `行は増えない（1件のまま）→ ${dup.n}`);
ok(Number(dup.b) === 22000, `訂正として上書きされる → ${dup.b}`);
ok(again.is_new === false, '訂正は is_new=false（コントリビューション数に数えない）');

// ── 連続 ─────────────────────────────────────────────────────
console.log('\n▼ 継続（対象月で数える）');
r = (await submit({ ...BASE, period_year: 2026, period_month: 7 })).r;
ok(r.streak_months === 2, `2ヶ月連続 → ${r.streak_months}`);
const before3 = await one(`select access_until from profiles where id=$1`, [uid(1)]);
r = (await submit({ ...BASE, period_year: 2026, period_month: 8 })).r;
ok(r.streak_months === 3, `3ヶ月連続 → ${r.streak_months}`);
const p1 = await one(`select access_until, pay_report_count, badge, badge_state, pay_reports_today from profiles where id=$1`, [uid(1)]);
const days = (new Date(p1.access_until) - Date.now()) / 86400000;
// ★ 続けても解放は 90日のまま。streak では絶対に伸ばさない（pay-reports.sql:512）
//   自己申告を3回繰り返しても本物の証明にはならないので、回数を期間に換算しない。
ok(days > 80 && days < 95, `継続しても解放は90日のまま → 残り約${Math.round(days)}日`);
const grew = (new Date(p1.access_until) - new Date(before3.access_until)) / 86400000;
ok(grew < 1, `3ヶ月目の投稿で期限が伸びていない → +${grew.toFixed(2)}日`);
ok(days < 400, '「永続」が存在しない（有限のまま）');
ok(p1.badge === 'contributor', `入力だけでは contributor 止まり → ${p1.badge}`);
ok(p1.badge_state === 'active', `badge_state=active → ${p1.badge_state}`);
ok(Number(p1.pay_report_count) === 3, `件数は実レポート数だけ（訂正は数えない）→ ${p1.pay_report_count}`);

// 間が空いたらリセット
r = (await submit({ ...BASE, airline: 'qatar-airways', period_year: 2026, period_month: 2 })).r;
ok(r.streak_months === 3, `過去月の穴埋めでは連続を減らさない → ${r.streak_months}`);

console.log('\n▼ 入口の検品');
ok((await boom(`select submit_pay_report($1::jsonb)`, [JSON.stringify({ ...BASE, period_year: 2030, period_month: 1 })]) || '').includes('未来'), '未来の月は弾く');
ok((await boom(`select submit_pay_report($1::jsonb)`, [JSON.stringify({ ...BASE, airline: 'qatar', period_year: 2026, period_month: 5 })]) || '').includes('会社コード'), "旧コード 'qatar' は弾く（SSOT に無い）");
/* ★2026-11-02 名簿から外した会社（airline-ops.mjs の RETIRED ── スピリット航空）。行は DB に残る（過去の投稿の外部キー）が、新しい給与は弾く */
ok(Object.keys(RETIRED).length > 0, '名簿から外した会社が1社以上ある（RETIRED）');
for (const code of Object.keys(RETIRED)) {
  ok((await boom(`select submit_pay_report($1::jsonb)`, [JSON.stringify({ ...BASE, airline: code, period_year: 2026, period_month: 5 })]) || '').includes('会社コード'),
     `★名簿から外した会社（${code}）の新しい給与は弾く（行は残っていても active=false）`);
}
ok((await boom(`select submit_pay_report($1::jsonb)`, [JSON.stringify({ ...BASE, fleet: 'b797', period_year: 2026, period_month: 5 })]) || '').includes('機材コード'), '存在しない機種は弾く');
ok((await boom(`select submit_pay_report($1::jsonb)`, [JSON.stringify({ ...BASE, base_pay: null, hourly_rate: null, period_year: 2026, period_month: 5 })]) || '').includes('報酬額'), '金額ゼロの空レポートは弾く');
ok((await boom(`select submit_pay_report($1::jsonb)`, [JSON.stringify({ ...BASE, airline: 'other', period_year: 2026, period_month: 5 })]) || '').includes('社名'), "'other' なのに社名が無ければ弾く");
/* ★選択肢から外した職位は、画面を書き換えても保存できない（2026-09-02）。
   2026-09-02 まではここに関所が無く、表の外部キーだけが見ていたので、
   古い画面や devtools からは外したはずのコードがそのまま入っていた。 */
ok((await boom(`select submit_pay_report($1::jsonb)`, [JSON.stringify({ ...BASE, position: 'cadet', period_year: 2026, period_month: 5 })]) || '').includes('職位'), '★訓練生は弾く（選択肢から外した職位は保存できない）');
ok((await boom(`select submit_pay_report($1::jsonb)`, [JSON.stringify({ ...BASE, position: 'sfo', period_year: 2026, period_month: 5 })]) || '').includes('職位'), '★SFO も同じく弾く（2026-08-18 に外した職位）');
/* ★預かり（ログイン前）も同じ判定を通る＝「受け取りましたと出したのに、
   会員登録のあとで落ちる」が起きない。判定は pv_validate_pay_payload の1か所だけ。 */
ok((await boom(`select submit_pay_report_pending($1::jsonb)`, [JSON.stringify({ ...BASE, position: 'cadet', period_year: 2026, period_month: 5 })]) || '').includes('職位'), '★預かりの入口でも訓練生は弾く（本登録との食い違いを作らない）');
/* ★手取りが総支給より多い行は受け取らない（2026-10-05 オーナー指摘「なんで通ってんだ？」）。
   本番で、手取りが総支給の何倍もある行がそのまま入っていた（下の数字は作り物）。
   線は「手取り ＞ 総支給 × 1.05」。画面（netOver）・出し直しのお願い（pv-pay-fix.js）・
   オーナー用の点検（db/usage.mjs）と**同じ線**。
   ★通る側は検品の関数だけを呼ぶ（行を作らない＝下の件数・連続の検査を動かさない）。 */
const NETCASE = { ...BASE, currency: 'USD', period_year: 2026, period_month: 5 };
const netBoom = (fn, gross, net) => boom(`select ${fn}($1::jsonb)`,
  [JSON.stringify({ ...NETCASE, gross_monthly: gross, net_pay_actual: net })]);
ok((await netBoom('submit_pay_report', 8000, 48000) || '').includes('手取り'),
   '★手取りが総支給の6倍の行は弾く');
ok((await netBoom('submit_pay_report_pending', 8000, 48000) || '').includes('手取り'),
   '★預かりの入口でも同じく弾く（引き取りのときに初めて落ちる人を作らない）');
ok((await netBoom('pv_validate_pay_payload', 8000, 8401) || '').includes('手取り'),
   '★5% を1でも超えたら弾く（線は × 1.05 の1本）');
ok((await netBoom('pv_validate_pay_payload', 8000, 8000)) === null, '同額は通す');
ok((await netBoom('pv_validate_pay_payload', 8000, 8400)) === null,
   '5% までの上振れは通す（還付で手取りがわずかに上回る月）');
ok((await netBoom('pv_validate_pay_payload', 8000, null)) === null,
   '手取りが空の行は見ない（聞く前に預かった仮受けを捨てない）');
ok((await netBoom('pv_validate_pay_payload', null, 48000)) === null,
   '総支給が空の行は見ない（基本給だけで出した行。比べる相手が無い）');
ok(Number((await one(`select count(*) n from pay_reports where period_year=2026 and period_month=5`)).n) === 0,
   '★弾いた行は1件も残っていない');

// profiles 行が無い人（トリガーの取りこぼし）でも書けること
await db.query(`select set_config('pv.uid', $1, false)`, [uid(77)]);
const orphan = await boom(`select submit_pay_report($1::jsonb)`,
  [JSON.stringify({ ...BASE, period_year: 2026, period_month: 5 })]);
ok(orphan === null, `profiles 行が無くても投稿が通る → ${orphan ? orphan.slice(0, 60) : 'OK'}`);
ok((await one(`select count(*) n from profiles where id=$1`, [uid(77)])).n == 1, 'profiles 行が補われる');

// 未ログイン
await db.query(`select set_config('pv.uid', '', false)`);
ok((await boom(`select submit_pay_report($1::jsonb)`, [JSON.stringify({ ...BASE, period_year: 2026, period_month: 5 })]) || '').includes('ログイン'), '未ログインでは書けない');

// レート制限
console.log('\n▼ レート制限');
await asUser(99);
const airlines = (await rows(`select code from pv_airlines where active and code<>'other' limit 12`)).map((x) => x.code);
let limited = null;
for (const a of airlines) {
  const e = await boom(`select submit_pay_report($1::jsonb)`,
    [JSON.stringify({ ...BASE, airline: a, period_year: 2026, period_month: 6 })]);
  if (e) { limited = e; break; }
}
ok((limited || '').includes('上限'), `1日10件で止まる → ${limited ? limited.slice(0, 40) : '止まらなかった'}`);

// ── k匿名 ────────────────────────────────────────────────────
console.log('\n▼ k-匿名（n=4 は出ない / n=5 で出る）');
await db.exec(`delete from pay_reports`);
for (let i = 10; i <= 13; i++) {
  await asUser(i);
  await submit({ ...BASE, base_pay: 18000 + i * 500, period_year: 2026, period_month: 6 });
}
let bm = await rows(`select * from pay_benchmarks where airline='emirates'`);
ok(bm.length === 0, `n=4 では公開集計に現れない → ${bm.length} 行`);
await asUser(14);
await submit({ ...BASE, base_pay: 30000, period_year: 2026, period_month: 6 });
bm = await rows(`select * from pay_benchmarks where airline='emirates'`);
ok(bm.length === 1 && Number(bm[0].n) === 5, `n=5 で現れる → ${bm.length} 行 / n=${bm[0]?.n}`);
ok(Number(bm[0].median_usd) > 0, `中央値が出る → $${bm[0].median_usd}`);

const viewCols = (await rows(`select column_name c from information_schema.columns
  where table_schema='public' and table_name='pay_benchmarks'`)).map((x) => x.c);
ok(!viewCols.includes('base_iata'), `公開集計に base_iata が無い → [${viewCols.join(', ')}]`);
ok(!viewCols.includes('seniority_years'), '公開集計に seniority_years が無い');
ok(!viewCols.includes('rank_years'), '公開集計に rank_years が無い（準識別子）');
ok(!viewCols.includes('proof_hash'), '公開集計に proof_hash が無い');

// 5人目の投稿にはベンチマークが返る
await asUser(15);
r = (await submit({ ...BASE, base_pay: 25000, period_year: 2026, period_month: 6 })).r;
/* ★2026-11-08 から見返りはいつも null。5人の区分の 25%・中央値・75% は2・3・4番目の人の額そのもので、
   新しい月に極端な額を出し直せば他人の額を読み戻せた（画面ももう読んでいない）。 */
ok('benchmark' in r && r.benchmark === null, `★5人そろっても投稿の見返りは返さない（他人の額を読み戻す道を作らない）→ ${JSON.stringify(r.benchmark)}`);

// 自由入力の社名は集計から外れる
console.log('\n▼ 自由入力の社名');
for (let i = 20; i <= 25; i++) {
  await asUser(i);
  await submit({ ...BASE, airline: 'other', airline_other: 'Some Charter Co', base_pay: 20000, period_year: 2026, period_month: 6 });
}
bm = await rows(`select * from pay_benchmarks where airline='other'`);
ok(bm.length === 0, `airline_other は6件あっても集計に出ない → ${bm.length} 行`);

// ── 公開集計は「人」で数える（2026-11-08）────────────────────
/* それまでは行のまま count(*) していたので、同じ人が同じ年に5か月出しただけでセルが開き、
   その1人の中央値・25%・75%・時間あたりが未ログインの人にも読めていた。
   いまは 1人（proof_hash）× セルで1行（その人のいちばん新しい月）に縮めてから数える。
   時間あたりの中央値（median_usd_per_bh）も、乗務時間を書いた人が5人以上のときだけ出す。
   投稿の見返り（submit_pay_report の 'benchmark'）は、2026-11-08 から人数に関係なくいつも null。
   ★下の personCheck() を、本物のビューと「行のまま数える」に戻した版の両方に当てる（壊す証明）。 */
console.log('\n▼ 公開集計は人で数える（1人が何か月出しても1人）');
await db.exec(`delete from pay_reports`);
const PP = { ...BASE, airline: 'emirates', position: 'cap', fleet: 'b777', period_year: 2025 };
const cellOf = async () => (await rows(
  `select * from pay_benchmarks where airline='emirates' and "position"='cap' and fleet='b777' and period_year=2025`));
// A：1人で5か月。休日とセクターも毎月書く（ほかの4人は書かない）。年収は5か月とも高い。
const PA = 700;
await asUser(PA);
let rA = null;
for (let m = 1; m <= 5; m++) rA = (await submit({ ...PP, base_pay: 60000, days_off: 10 + m, sectors: 40 + m, period_month: m })).r;
ok(Number((await one(`select count(*) n from pay_reports where airline='emirates'`)).n) === 5, '（準備）1人で5行（5か月）入った');
ok((await cellOf()).length === 0, '★1人 × 5か月ではセルが開かない（5行あっても1人）');
ok(rA.benchmark === null, '★1人 × 5か月では投稿の見返りも返らない（その人の数字が中央値として返らない）', JSON.stringify(rA.benchmark));
// B〜D：1か月ずつ。4人（行は8）ではまだ開かない。B〜E は乗務時間を書かない（時間あたりを持つのは A だけ）
const PB = [701, 702, 703, 704];
const lowBase = [20000, 21000, 22000, 23000];
const NOHOURS = { hourly_rate: null, guaranteed_hours: null, block_hours: null };
for (let i = 0; i < 3; i++) { await asUser(PB[i]); await submit({ ...PP, ...NOHOURS, base_pay: lowBase[i], period_month: 3 }); }
ok((await cellOf()).length === 0, '★4人（行は8）でもまだ開かない');
// E：5人目
await asUser(PB[3]);
const rE = (await submit({ ...PP, ...NOHOURS, base_pay: lowBase[3], period_month: 3 })).r;
ok(Number((await one(`select count(*) n from pay_reports where airline='emirates' and usd_per_block_hour is not null`)).n) === 5,
   '（準備）時間あたりを持つのは A の5行だけ（B〜E は乗務時間を書いていない）');
const cellP = (await cellOf())[0];
ok(cellP && Number(cellP.n) === 5, `★5人そろうと開く・n は人数 → n=${cellP?.n}（行は9）`);
/* 1人1値。5人の年収を小さい順に並べると [B, C, D, E, A]。
   percentile_cont の 25% / 50% / 75% は、5つのうち2・3・4番目ちょうどになる。
   行のまま数えると A の5行が上半分を占め、中央値は A の額になる。 */
const usdOf = async (n) => Number((await one(
  `select annual_total_usd v from pay_reports where proof_hash = encode(extensions.digest($1 || '::pv_pay::emirates','sha256'),'hex')
   order by period_month desc limit 1`, [uid(n)])).v);
const vals = [];
for (const n of [...PB, PA]) vals.push(await usdOf(n));
vals.sort((a, b) => a - b);
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.01;
ok(cellP && near(cellP.median_usd, vals[2]) && near(cellP.p25_usd, vals[1]) && near(cellP.p75_usd, vals[3]),
   `★1人が何か月出しても中央値を占めない（中央値 ${cellP?.median_usd} ＝ 3番目の人 ${vals[2]}・A の額 ${vals[4]} ではない）`,
   JSON.stringify({ cell: cellP && { m: cellP.median_usd, p25: cellP.p25_usd, p75: cellP.p75_usd }, vals }));
ok(cellP && cellP.median_days_off === null && cellP.median_sectors === null,
   `★休日・セクターを書いたのは A 1人（5か月）＝ 1人なので出さない → ${cellP?.median_days_off} / ${cellP?.median_sectors}`);
ok(cellP && Number(cellP.housing_provided_pct) === 0, `住居は5人とも答えている＝出る → ${cellP?.housing_provided_pct}`);
ok(cellP && cellP.median_usd_per_bh === null,
   `★時間あたりを持つのは A 1人（5か月）＝ 1人なので出さない（門は「書いた人が5人以上」）→ ${cellP?.median_usd_per_bh}`);
ok('benchmark' in rE && rE.benchmark === null,
   `★5人目が出しても投稿の見返りは返さない（2・3・4番目の人の額を返さない）→ ${JSON.stringify(rE.benchmark)}`);
// 残す1行は、その人のいちばん新しい月。A が6か月目に額を下げると、A の値として6か月目が入る
await asUser(PA);
await submit({ ...PP, base_pay: 19000, period_month: 6 });
const cellP6 = (await cellOf())[0];
const vals6 = [await usdOf(PA), ...(await Promise.all(PB.map(usdOf)))].sort((a, b) => a - b);
ok(cellP6 && Number(cellP6.n) === 5 && near(cellP6.median_usd, vals6[2]) && near(cellP6.p25_usd, vals6[1]),
   `★残すのはその人のいちばん新しい月（A は6か月目の額で1人ぶん・n は5のまま）→ n=${cellP6?.n} 中央値 ${cellP6?.median_usd}`,
   JSON.stringify({ vals6 }));

/* ── 壊す証明 ──
   同じ確かめ方（personCheck）を、ビューを「行のまま数える」昔の形に戻した版にも当てる。
   壊した版は begin … rollback の中でだけ入れる（ファイルは触らない）。 */
{
  const personCheck = async () => {
    // A だけが a380 に5か月（年は b777 と別にする ── 同じ年・同じ月は1人1行なので、b777 の行を上書きしてしまう）
    await db.exec(`delete from pay_reports where airline = 'emirates' and fleet = 'a380'`);
    await db.query(`update profiles set pay_reports_today = 0 where id = $1`, [uid(PA)]);   // 1日10件の上限はここの話ではない
    await asUser(PA);
    for (let m = 1; m <= 5; m++) await submit({ ...PP, fleet: 'a380', period_year: 2024, base_pay: 60000, days_off: 9, period_month: m });
    const solo = await rows(`select * from pay_benchmarks where airline='emirates' and fleet='a380'`);
    const c = (await cellOf())[0];
    return solo.length === 0 && c && Number(c.n) === 5 && near(c.median_usd, vals6[2]) && c.median_days_off === null;
  };
  ok(await personCheck(), '（本物）人で数える検査は緑');

  const src = read('db/pay-reports.sql');
  const a = src.indexOf('drop view if exists public.pay_benchmarks;');
  const b = src.indexOf('having count(*) >= 5;', a) + 'having count(*) >= 5;'.length;
  const view = a < 0 ? '' : src.slice(a, b);
  const s0 = view.indexOf('  from (\n'), s1 = view.indexOf('  ) one\n');
  const rowsView = (s0 < 0 || s1 < 0) ? '' : view.slice(0, s0)
    + `  from public.pay_reports\n where annual_total_usd is not null and airline_other is null\n`
    + view.slice(s1 + '  ) one\n'.length);
  ok(rowsView && !/distinct on/i.test(rowsView) && /having count\(\*\) >= 5/.test(rowsView),
     '（ビューを「行のまま数える」形に戻した版を作れた）');
  /* オーナーが本番で見る 8-16 と 8-16b（db/pay-reports.sql の検算）も、同じ2つに当てる。 */
  const q = (tag) => { const i = src.indexOf(`-- ${tag}.`); const j = src.indexOf('\nselect ', i); return i < 0 || j < 0 ? '' : src.slice(j + 1, src.indexOf(';', j)); };
  const q816 = q('8-16'), q816b = q('8-16b');
  ok(q816.includes('pay_benchmarks') && q816b.includes('count(distinct proof_hash)'), '（検算 8-16 と 8-16b を見つけた）');
  ok((await rows(q816)).length === 0 && (await rows(q816b)).length === 0, '（本物）検算 8-16・8-16b は 0 行');
  await db.exec(`begin`);
  await db.exec(rowsView);
  const red = await personCheck();
  const soloRed = await rows(`select n, median_usd, median_days_off from pay_benchmarks where airline='emirates' and fleet='a380'`);
  const red816 = (await rows(q816)).length, red816b = (await rows(q816b)).length;
  await db.exec(`rollback`);
  ok(!red && soloRed.length === 1 && Number(soloRed[0].n) === 5 && Number(soloRed[0].median_days_off) === 9,
     '★壊した版では、1人 × 5か月でセルが開き、その1人の休日数が「中央値」として出る（検査が赤くなる）', JSON.stringify(soloRed));
  ok(red816 > 0 && red816b > 0, `★壊した版では、オーナーの検算 8-16・8-16b にも行が出る（${red816} 行・${red816b} 行）`);
  ok(await personCheck(), '（巻き戻したあと: 本物は緑）');

  /* 時間あたりの門（書いた人が5人以上）を外した版。b777 のセルで時間あたりを持つのは A 1人。 */
  const GATE = '       case when count(usd_per_block_hour) >= 5\n'
             + '            then percentile_cont(0.5) within group (order by usd_per_block_hour)\n'
             + '       end ';
  const gi = view.indexOf(GATE), ge = gi < 0 ? -1 : view.indexOf('as median_usd_per_bh,', gi);
  const noGate = (gi < 0 || ge < 0) ? '' : view.slice(0, gi)
    + '       percentile_cont(0.5) within group (order by usd_per_block_hour) ' + view.slice(ge);
  ok(noGate && view.split(GATE).length === 2 && !noGate.includes('count(usd_per_block_hour)'), '（時間あたりの門を外した版を作れた）');
  const bhCheck = async () => { const c = (await cellOf())[0]; return !!c && Number(c.n) === 5 && c.median_usd_per_bh === null; };
  ok(await bhCheck(), '（本物）時間あたりの門の検査は緑');
  await db.exec(`begin`);
  await db.exec(noGate);
  const bhRed = await bhCheck();
  const bhVal = (await cellOf())[0]?.median_usd_per_bh;
  const bh816 = (await rows(q816)).length;
  await db.exec(`rollback`);
  ok(!bhRed && bhVal != null && bh816 > 0,
     `★門を外した版では、A 1人の時間あたりが「中央値」として出て（${bhVal}）、検算 8-16 にも行が出る（${bh816} 行）`);
  ok(await bhCheck(), '（巻き戻したあと: 本物は緑）');
}

// ── 任意入力の項目は「その項目を書いた人数」で門番する ──────────
// セルに6人いても、休日を書いたのが1人なら、その1人の実数が「中央値」の
// 名前で公開されてしまう。having count(*) >= 5 はここを守らない。
console.log('\n▼ 任意項目の k-匿名（書いた人が5人未満なら出さない）');
await db.exec(`delete from pay_reports`);
for (let i = 30; i <= 35; i++) {
  await asUser(i);
  // 30番だけが休日とセクターを書く。残り5人は空欄のまま。
  const extra = i === 30 ? { days_off: 9, sectors: 44 } : {};
  await submit({ ...BASE, ...extra, base_pay: 20000 + i * 100, period_year: 2026, period_month: 6 });
}
ok(Number((await one(`select days_off d from pay_reports where days_off is not null`)).d) === 9,
   '休日数がそのまま保存される → 9');
bm = await rows(`select * from pay_benchmarks where airline='emirates'`);
ok(Number(bm[0].n) === 6, `セルには6人いる → n=${bm[0]?.n}`);
ok(bm[0].median_days_off === null, `休日を書いたのが1人なら中央値を出さない → ${bm[0].median_days_off}`);
ok(bm[0].median_sectors === null, `セクターも同じ → ${bm[0].median_sectors}`);
// 住居は全員が答えている（BASE が allowance）ので、こちらは値が出る
ok(bm[0].housing_provided_pct !== null && Number(bm[0].housing_provided_pct) === 0,
   `住居は6人全員が答えているので出る（社宅0%）→ ${bm[0].housing_provided_pct}`);
ok(Number(bm[0].median_housing_usd_mo) > 0,
   `住宅手当の中央値は月額USD → $${bm[0].median_housing_usd_mo}`);

// 書いた人が5人になった瞬間に出る
for (let i = 36; i <= 39; i++) {
  await asUser(i);
  await submit({ ...BASE, days_off: 8 + (i - 36), sectors: 40 + i, base_pay: 21000, period_year: 2026, period_month: 6 });
}
bm = await rows(`select * from pay_benchmarks where airline='emirates'`);
ok(Number(bm[0].median_days_off) === 9, `5人が書いたら中央値が出る（8,9,9,10,11→9）→ ${bm[0].median_days_off}`);
ok(Number(bm[0].median_sectors) > 0, `セクターも出る → ${bm[0].median_sectors}`);
// 訂正しても休日とセクターが古い値のまま残らないこと（on conflict の取りこぼし）
await asUser(30);
await submit({ ...BASE, days_off: 20, sectors: 99, base_pay: 23000, period_year: 2026, period_month: 6 });
ok(Number((await one(`select days_off d from pay_reports where days_off=20`)).d) === 20,
   '出し直すと休日数も上書きされる（この2列だけ訂正が効かない、が起きていない）');

// 円・ドル以外の通貨（昔レートが無くて集計から落ちていた側）
console.log('\n▼ 円・ドル以外の通貨で出す');
await asUser(30);
r = (await submit({ ...BASE, airline: 'qatar-airways', currency: 'QAR', period_year: 2026, period_month: 6 })).r;
ok(r.fx_missing !== true && Number(r.annual_total_usd) > 0,
   `QAR でも USD が付く（昔は null で集計から外れていた）→ ${r.annual_total_usd}`);
const qar = await one(`select currency, base_pay, annual_total_orig from pay_reports where currency='QAR'`);
ok(qar.currency === 'QAR' && Number(qar.annual_total_orig) === 651000, `原本は失われない → ${qar.currency} ${qar.annual_total_orig}`);

/* ★エバー航空の台湾ドル（2026-08-21）と同じ形。語彙の45通貨すべてで
   USD が付くことを1件ずつ確かめる。1つでも欠けると、その通貨で出した人が
   提出は成功したのに集計から消える（本人には見えるので誰も気づかない）。 */
const CODES = (await db.query(`select code from pv_currencies where active order by code`)).rows.map((x) => x.code);
const noUsd = [];
for (let i = 0; i < CODES.length; i++) {
  // 1人1日10件までなので8件ごとに人を替える（この上限自体は別のテストが見ている）
  if (i % 8 === 0) await asUser(200 + i / 8);
  const rr = (await submit({ ...BASE, airline: 'eva-air', currency: CODES[i],
                             period_year: 2025, period_month: (i % 12) + 1 })).r;
  if (!(Number(rr.annual_total_usd) > 0)) noUsd.push(CODES[i]);
}
ok(noUsd.length === 0, `${CODES.length} 通貨すべてで USD が付く`, noUsd.join(' '));

/* ★取りこぼしの復旧（db/vocab.generated.sql の末尾）。
   レートが無かった時代に入った行を、原本から計算し直す。null の行だけ触る＝冪等。 */
await db.exec(`update pay_reports set annual_total_usd = null, annual_total_jpy = null,
                      fx_to_usd = null, fx_to_jpy = null, usd_per_block_hour = null
                where currency = 'TWD'`);
const before = await one(`select count(*) n from pay_reports where annual_total_usd is null`);
await db.exec(read('db/vocab.generated.sql'));
const after = await one(`select count(*) n from pay_reports where annual_total_usd is null`);
ok(Number(before.n) > 0 && Number(after.n) === 0,
   `レートが無くて落ちていた ${before.n} 件が復旧する（残り ${after.n} 件）`);
const twd = await one(`select annual_total_orig o, annual_total_usd u, fx_to_usd f
                         from pay_reports where currency='TWD' limit 1`);
ok(Math.abs(Number(twd.u) - Number(twd.o) * Number(twd.f)) < 0.01,
   `復旧した額が原本 × レートと合う → ${twd.o} × ${twd.f} = ${twd.u}`);

// ── かんたん入力（その月の額面1本）───────────────────────────
// 「基本給って何よ」で止まる人のための入力。明細を開かずに答えられる唯一の数字。
console.log('\n▼ かんたん入力（総支給1本）');
await asUser(41);
r = (await submit({
  ...BASE, base_pay: null, hourly_rate: null, per_diem: null, housing_amount: null,
  gross_monthly: 54250, airline: 'lufthansa', period_year: 2026, period_month: 6,
})).r;
ok(Number(r.annual_total_orig) === 651000, `総支給×12 で年換算 → ${r.annual_total_orig}`);
const gs = await one(`select * from pay_reports where airline='lufthansa' and period_month=6`);
ok(Number(gs.gross_monthly) === 54250, `総支給が専用の列に入る → ${gs.gross_monthly}`);
// ★ここが本題。総支給を base_pay に入れると支給構成が「基本給100%」という嘘の図になる
ok(gs.base_pay === null, `総支給を基本給の列に入れていない → ${gs.base_pay}`);
ok(Number(gs.guaranteed_hours) === 75, `保証時間は残る（金額ではなく契約の事実）→ ${gs.guaranteed_hours}`);
ok(gs.housing_type === 'allowance', `住居の種類も残る（金額だけ聞かない）→ ${gs.housing_type}`);

// 総支給と内訳は両方そろって残る（2026-08-26 オーナー指示で排他をやめた）。
// 会社ごとに変動給の建て付けが違うので、総支給は明細の印字どおりに残したまま
// 「そのうち何が固定で何が変動か」を別に書いてもらう形にした。
// ★年換算は今までどおり総支給が正（pv_annual_total は総支給があれば内訳を見ない）。
//   ＝二重計上は起きない。内訳は「支給構成の図」を描くためだけに残る。
// ⚠️ 例外は組合の手当だけ（2026-09-02）。支給元が「組合」「その他」のときは、
//    そのお金が会社の明細に印字されない＝本人が書いた総支給の中に**入っていない**ので、
//    総支給の枝でも足す。判定は pv_union_outside_gross の1か所。下の▼組合の節で見る。
await asUser(42);
r = (await submit({ ...BASE, gross_monthly: 54250, airline: 'lufthansa', period_year: 2026, period_month: 7 })).r;
ok(Number(r.annual_total_orig) === 651000, `内訳が付いてきても年換算は総支給が正 → ${r.annual_total_orig}`);
const both = await one(`select * from pay_reports where airline='lufthansa' and period_month=7`);
ok(Number(both.gross_monthly) === 54250 && Number(both.base_pay) === BASE.base_pay
   && Number(both.hourly_rate) === BASE.hourly_rate,
  `総支給と内訳が両方残る → ${both.gross_monthly} / ${both.base_pay} / ${both.hourly_rate}`);
ok(Number(both.per_diem) === 3000 && Number(both.housing_amount) === 10000,
  `パーディアムと住宅手当は総支給と一緒でも残る → ${both.per_diem} / ${both.housing_amount}`);

/* ── 保証給（2026-08-26 に足した列）──────────────────────────────
   ★基本給と別の列に持つ。日本＝基本給が主、米国＝保証給が下限、で意味が違う。
     足し込むと二度と割れず、レポートの「基本給」の切れが嘘になる。
   ⚠️ guaranteed_hours（保証**時間**）とは別物。両方が同じ行に立つ。 */
await asUser(43);
r = (await submit({ ...BASE, gross_monthly: null, hourly_rate: null, per_diem: null,
                    housing_type: null, housing_amount: null,
                    base_pay: 20000, guarantee_pay: 5000,
                    airline: 'lufthansa', period_year: 2026, period_month: 8 })).r;
ok(Number(r.annual_total_orig) === 300000,
  `保証給は基本給と足して年換算する → ${r.annual_total_orig}（期待 300000）`);
const gpr = await one(`select * from pay_reports where airline='lufthansa' and period_month=8`);
ok(Number(gpr.guarantee_pay) === 5000 && Number(gpr.base_pay) === 20000,
  `保証給は基本給とは別の列に残る → ${gpr.base_pay} / ${gpr.guarantee_pay}`);
ok(Number(gpr.guaranteed_hours) === 75,
  `保証時間（時間）と保証給（金額）は別物として同じ行に立つ → ${gpr.guaranteed_hours}`);
/* 出し直し（訂正）で保証給だけ古い値が残らないこと。 */
await submit({ ...BASE, gross_monthly: null, hourly_rate: null, per_diem: null,
               housing_type: null, housing_amount: null,
               base_pay: 20000, guarantee_pay: 7000,
               airline: 'lufthansa', period_year: 2026, period_month: 8 });
const gpr2 = await one(`select guarantee_pay from pay_reports where airline='lufthansa' and period_month=8`);
ok(Number(gpr2.guarantee_pay) === 7000, `保証給も訂正が効く → ${gpr2.guarantee_pay}`);
/* 保証給だけでも受け取る（基本給という項目が無い会社が実在する）。 */
await asUser(44);
r = (await submit({ ...BASE, gross_monthly: null, base_pay: null, hourly_rate: null,
                    per_diem: null, housing_type: null, housing_amount: null,
                    guarantee_pay: 9000,
                    airline: 'lufthansa', period_year: 2026, period_month: 2 })).r;
ok(Number(r.annual_total_orig) === 108000,
  `保証給だけの行も受け取る → ${r.annual_total_orig}（期待 108000）`);

/* ── 教官・訓練の手当（2026-08-26 その3 に足した列）────────────────
   ★金額は instructor_pay へ。command_pay / flight_variable_pay / other_allowance の
     どれにも足し込まない（オーナー指示「二重入力させない」）。足し込むと
     「教官をやると月いくら増えるのか」が二度と割り戻せなくなる。
   ★何の訓練を・何に対して払われたかは pay_items.instructor に残る。
     ⚠️ pay_items は知っているキーだけで組み直す作りなので、'instructor' を
        足し忘れると金額だけ残って中身が黙って消える。ここがその見張り。 */
await asUser(49);
const INSTR = { v: 1, fixed_none: false,
  instructor: { trainings: ['line', 'sim'], label: 'Training Captain',
                extra: 'separate', method: 'session', amount: 600, rate: 150, qty: 4 } };
r = (await submit({ ...BASE, gross_monthly: 54250, instructor_pay: 600, pay_items: INSTR,
                    job_roles: ['line', 'instructor'],
                    airline: 'lufthansa', period_year: 2026, period_month: 1 })).r;
const ins = await one(`select * from pay_reports where airline='lufthansa' and period_month=1`);
ok(Number(ins.instructor_pay) === 600,
  `教官の手当は専用の列に残る → ${ins.instructor_pay}`);
ok(ins.command_pay === null && ins.flight_variable_pay === null && ins.other_allowance === null,
  `職位手当・変動給・その他には1円も入らない → ${ins.command_pay} / ${ins.flight_variable_pay} / ${ins.other_allowance}`);
ok(ins.pay_items && ins.pay_items.instructor
   && ins.pay_items.instructor.method === 'session'
   && String(ins.pay_items.instructor.trainings) === 'line,sim'
   && ins.pay_items.instructor.label === 'Training Captain',
  `★教官の中身が組み直しを生き延びる → ${JSON.stringify(ins.pay_items?.instructor)}`);
ok(Number(r.annual_total_orig) === 651000,
  `★総支給がある行では年換算が1円も動かない → ${r.annual_total_orig}（期待 651000）`);
/* 金額だけ（単価も回数も分からない）でも保存できる。 */
await asUser(50);
await submit({ ...BASE, gross_monthly: 54250, instructor_pay: 900,
               pay_items: { v: 1, instructor: { extra: 'separate', method: 'monthly', amount: 900 } },
               airline: 'lufthansa', period_year: 2026, period_month: 5 });
const insB = await one(`select * from pay_reports where airline='lufthansa' and period_month=5`);
ok(Number(insB.instructor_pay) === 900 && insB.pay_items.instructor.method === 'monthly',
  `単価も回数も無い行も保存できる → ${insB.instructor_pay}`);
/* 教官を外して出し直したら、金額も中身も残らない。 */
await asUser(49);
await submit({ ...BASE, gross_monthly: 54250, job_roles: ['line'],
               airline: 'lufthansa', period_year: 2026, period_month: 1 });
const insC = await one(`select * from pay_reports where airline='lufthansa' and period_month=1`);
ok(insC.instructor_pay === null && insC.pay_items === null,
  `出し直して教官を外すと、金額も中身も残らない → ${insC.instructor_pay} / ${insC.pay_items}`);
/* 中身が大きすぎるものは捨てる（投稿そのものは落とさない）。 */
await asUser(50);
await submit({ ...BASE, gross_monthly: 54250,
               pay_items: { v: 1, instructor: { label: 'x'.repeat(4000) } },
               airline: 'lufthansa', period_year: 2026, period_month: 3 });
const insD = await one(`select * from pay_reports where airline='lufthansa' and period_month=3`);
ok(!insD.pay_items || !insD.pay_items.instructor,
  `大きすぎる教官の中身は捨てる（投稿は通る） → ${JSON.stringify(insD.pay_items)}`);

/* ── 審査・査察の手当（2026-08-26 その4 に足した列）────────────────
   ★教官とは別の列。両方やっている人が同じお金を2回入れないための分け方なので、
     ここでは「教官も審査も入れた行」で、どちらの列にも相手の額が混ざらないことを見る。
   ⚠️ pay_items は知っているキーだけで組み直す作り。'examiner' を足し忘れると
      金額だけ残って中身が黙って消える。ここがその見張り。 */
await asUser(51);
const EXAM = { v: 1, fixed_none: false,
  instructor: { trainings: ['sim'], extra: 'separate', method: 'session', amount: 600, qty: 4 },
  examiner: { checks: ['sim', 'line'], label: 'TRE', extra: 'separate',
              method: 'check', method_label: null, amount: 4000, qty: 3 } };
r = (await submit({ ...BASE, gross_monthly: 54250,
                    instructor_pay: 600, examiner_pay: 4000, pay_items: EXAM,
                    job_roles: ['line', 'instructor', 'examiner'],
                    airline: 'singapore-airlines', period_year: 2026, period_month: 8 })).r;
const exm = await one(`select * from pay_reports where airline='singapore-airlines' and period_month=8`);
ok(Number(exm.examiner_pay) === 4000 && Number(exm.instructor_pay) === 600,
  `★教官と審査は別々の列に残る（片方に吸われない） → ${exm.instructor_pay} / ${exm.examiner_pay}`);
ok(exm.command_pay === null && exm.flight_variable_pay === null && exm.other_allowance === null,
  `職位手当・変動給・その他には1円も入らない → ${exm.command_pay} / ${exm.flight_variable_pay} / ${exm.other_allowance}`);
ok(exm.pay_items && exm.pay_items.examiner
   && exm.pay_items.examiner.method === 'check'
   && String(exm.pay_items.examiner.checks) === 'sim,line'
   && exm.pay_items.examiner.label === 'TRE'
   && exm.pay_items.instructor,
  `★審査の中身が組み直しを生き延びる（教官も残ったまま） → ${JSON.stringify(exm.pay_items)}`);
ok(Number(r.annual_total_orig) === 651000,
  `★総支給がある行では年換算が1円も動かない → ${r.annual_total_orig}（期待 651000）`);
/* 「教官の手当とまとめて支給されている」人は、金額を持たずに答えだけ残る。 */
await asUser(52);
await submit({ ...BASE, gross_monthly: 54250, instructor_pay: 600,
               pay_items: { v: 1, instructor: { extra: 'separate', method: 'monthly', amount: 600 },
                            examiner: { checks: ['line'], extra: 'with_instructor', amount: null } },
               job_roles: ['instructor', 'examiner'],
               airline: 'singapore-airlines', period_year: 2026, period_month: 7 });
const exmB = await one(`select * from pay_reports where airline='singapore-airlines' and period_month=7`);
ok(exmB.examiner_pay === null
   && exmB.pay_items.examiner.extra === 'with_instructor'
   && Number(exmB.instructor_pay) === 600,
  `★「まとめて支給」は金額を持たず答えだけ残る（二重計上しない） → ${exmB.examiner_pay}`);

/* ★組合・乗員代表（2026-08-26 その5）。教官・審査ともまた別の列で、
   pay_items.union も組み直しを生き延びること。
   ★支給元が「組合」なら年換算に足す（2026-09-02 に直した本体）。
     組合が直接払ったお金は会社の明細に印字されない＝本人が書いた総支給の中に無い。
     ここを足さないと、乗員代表の年収が組合払いのぶんだけ丸ごと消える
     （本番で実際に1件起きた。年 ¥1,777万 が ¥931万 として保存されていた）。 */
await asUser(53);
r = (await submit({ ...BASE, gross_monthly: 54250,
                    instructor_pay: 600, examiner_pay: 4000, union_pay: 3000,
                    pay_items: { v: 1,
                      instructor: { trainings: ['sim'], extra: 'separate', method: 'session', amount: 600 },
                      examiner: { checks: ['line'], extra: 'separate', method: 'check', amount: 4000 },
                      union: { days: 12, extra: 'yes', source: 'union', amount: 3000 } },
                    job_roles: ['line', 'instructor', 'examiner', 'union'],
                    airline: 'singapore-airlines', period_year: 2026, period_month: 6 })).r;
const uni = await one(`select * from pay_reports where airline='singapore-airlines' and period_month=6`);
ok(Number(uni.union_pay) === 3000 && Number(uni.examiner_pay) === 4000
   && Number(uni.instructor_pay) === 600,
  `★教官・審査・組合が3つとも別々の列に残る → ${uni.instructor_pay} / ${uni.examiner_pay} / ${uni.union_pay}`);
ok(uni.command_pay === null && uni.flight_variable_pay === null && uni.other_allowance === null,
  `職位手当・変動給・その他には1円も入らない → ${uni.command_pay} / ${uni.flight_variable_pay} / ${uni.other_allowance}`);
ok(uni.pay_items && uni.pay_items.union
   && Number(uni.pay_items.union.days) === 12
   && uni.pay_items.union.source === 'union'
   && uni.pay_items.examiner && uni.pay_items.instructor,
  `★組合の中身が組み直しを生き延びる（教官・審査も残ったまま） → ${JSON.stringify(uni.pay_items.union)}`);
ok(Number(r.annual_total_orig) === 687000,
  `★支給元が組合なら、総支給がある行でも年換算に足す → ${r.annual_total_orig}（期待 687000 ＝ (54250+3000)×12）`);
ok(Number(uni.gross_monthly) === 54250,
  `★本人が書いた総支給は1円も書き換えない → ${uni.gross_monthly}`);
/* ★組合だけ書いた人の pay_items が「空の殻」として捨てられないこと。 */
await asUser(54);
await submit({ ...BASE, gross_monthly: 54250,
               pay_items: { v: 1, union: { days: 3, extra: 'none', source: null, amount: null } },
               job_roles: ['line', 'union'],
               airline: 'singapore-airlines', period_year: 2026, period_month: 5 });
const uniB = await one(`select * from pay_reports where airline='singapore-airlines' and period_month=5`);
ok(uniB.pay_items && uniB.pay_items.union && uniB.pay_items.union.extra === 'none',
  `★組合だけ書いた人の pay_items が捨てられない → ${JSON.stringify(uniB.pay_items)}`);
/* ★2026-09-02。上の月6（支給元＝組合）と対で読む。支給元が「会社」なら、
   そのお金は総支給の中に既に入っている＝足すと二重計上になる。 */
await asUser(59);
r = (await submit({ ...BASE, gross_monthly: 54250, union_pay: 3000,
                    pay_items: { v: 1, union: { days: 12, extra: 'yes', source: 'airline', amount: 3000 } },
                    job_roles: ['line', 'union'],
                    airline: 'singapore-airlines', period_year: 2026, period_month: 4 })).r;
ok(Number(r.annual_total_orig) === 651000,
  `★支給元が会社なら年換算は動かない（総支給の中にある） → ${r.annual_total_orig}（期待 651000）`);
/* ★支給元が空のまま（聞いたが答えていない）のときも足さない。
   分からないほうに倒すと年収を盛る。盛らない側へ倒すのがこのサイトの約束。 */
await asUser(60);
r = (await submit({ ...BASE, gross_monthly: 54250, union_pay: 3000,
                    pay_items: { v: 1, union: { days: 12, extra: 'yes', source: null, amount: 3000 } },
                    job_roles: ['line', 'union'],
                    airline: 'singapore-airlines', period_year: 2026, period_month: 9 })).r;
ok(Number(r.annual_total_orig) === 651000,
  `★支給元が空なら足さない（盛らない側に倒す） → ${r.annual_total_orig}（期待 651000）`);
/* ★内訳だけで出した行では、組合の手当も年換算に効く（総支給が無い枝）。 */
const uc = await one(`select pv_annual_total(null,20000,null,null,null,null,null,null,
                                             null,null,null,null,null,null,null,null,null,1000) v`);
ok(Number(uc.v) === 252000, `基本給20,000＋組合1,000 → ${uc.v}（期待 252000）`);

/* ★「組合の分が総支給の外にあるか」の規則そのもの（2026-09-02）。
   この判定は pv_union_outside_gross の1か所にしか無い（画面・預かり・本棚・
   DEEP PAY が全部ここを呼ぶ）ので、表の形で固定しておく。
   ⚠️ **外は「組合」だけ**（2026-09-02 オーナー判断）。その他を選ぶ人もお金は
      会社から出ているので中。ここを true に戻すと総支給に二重で足して年収を盛る。 */
const UOG = [
  [`'{"union":{"extra":"yes","source":"union"}}'`,    true,  '支給元＝組合 → 外'],
  [`'{"union":{"extra":"yes","source":"other"}}'`,    false, '★支給元＝その他 → 中（お金は会社から出ている）'],
  [`'{"union":{"extra":"yes","source":"airline"}}'`,  false, '支給元＝会社 → 中'],
  [`'{"union":{"extra":"yes","source":"both"}}'`,     false, '支給元＝両方 → 中（会社の分が総支給に入っている）'],
  [`'{"union":{"extra":"yes","source":""}}'`,         false, '支給元が空 → 中（盛らない側に倒す）'],
  [`'{"union":{"extra":"yes"}}'`,                     false, '支給元のキーが無い → 中'],
  [`'{"union":{"extra":"none","source":"union"}}'`,   false, '別途の支給が無い → 中'],
  [`'{"union":{"extra":"unknown","source":"union"}}'`, false, '分からない → 中'],
  [`'{}'`,                                            false, '組合の節そのものが無い → 中'],
  ['null',                                             false, 'pay_items が無い行 → 中'],
];
for (const [js, want, why] of UOG) {
  const u = await one(`select public.pv_union_outside_gross(${js}::jsonb) v`);
  ok(u.v === want, `${why} → ${u.v}`);
}
/* ★関数を直に叩いて、21番目の引数が総支給の枝にだけ効くことを固定する。 */
const uo1 = await one(`select pv_annual_total(54250,null,null,null,null,null,null,null,
                                              null,null,null,null,null,null,null,null,null,
                                              3000,null,null,true) v`);
ok(Number(uo1.v) === 687000, `総支給54,250＋組合3,000（外）→ ${uo1.v}（期待 687000）`);
const uo2 = await one(`select pv_annual_total(54250,null,null,null,null,null,null,null,
                                              null,null,null,null,null,null,null,null,null,
                                              3000,null,null,false) v`);
ok(Number(uo2.v) === 651000, `総支給54,250＋組合3,000（中）→ ${uo2.v}（期待 651000）`);
/* ★既定値。20引数までで呼んでいる古い場所は今までどおり動く。 */
const uo3 = await one(`select pv_annual_total(54250,null,null,null,null,null,null,null,
                                              null,null,null,null,null,null,null,null,null,
                                              3000) v`);
ok(Number(uo3.v) === 651000, `21番目を省くと今までどおり → ${uo3.v}（期待 651000）`);

/* ★明細とは別に受け取ったパーディアム（2026-11-04 オーナー決定）。組合の分とまったく同じ作り。
   総支給に印字されない＝中に入っていないので、総支給の枝でも ×12 で足す。
   印は pay_items.per_diem_src = 'outside' の1つだけ（判定は pv_perdiem_outside_gross の1か所）。 */
console.log('\n▼ 明細とは別に受け取ったパーディアム（per_diem_src・2026-11-04）');
const PDO = [
  [`'{"per_diem_src":"outside"}'`,                    true,  '受け取り方＝明細とは別 → 外'],
  [`'{"per_diem_src":"included"}'`,                   false, '★含まれている → 中'],
  [`'{"per_diem_src":"OUTSIDE"}'`,                    false, '大文字など白リストの外の値 → 中（盛らない側）'],
  [`'{"per_diem_src":true}'`,                         false, '真偽値 → 中'],
  [`'{"variable_none":true}'`,                        false, '★キーが無い（2026-11-04 より前の行は全部これ）→ 中'],
  [`'{}'`,                                            false, '空の内訳 → 中'],
  ['null',                                             false, 'pay_items が無い行 → 中'],
];
for (const [js, want, why] of PDO) {
  const u = await one(`select public.pv_perdiem_outside_gross(${js}::jsonb) v`);
  ok(u.v === want, `${why} → ${u.v}`);
}
/* 関数を直に叩いて、22番目の引数が総支給の枝にだけ効くことを固定する。 */
const pdA = (gross, flag) => one(`select pv_annual_total(${gross},null,null,null,null,5000,null,null,
                                              null,null,null,null,null,null,null,null,null,null,
                                              null,null,false${flag === undefined ? '' : ',' + flag}) v`);
ok(Number((await pdA(54250, true)).v) === 711000,
   `★総支給54,250＋パーディアム5,000（明細とは別）→ 12×59,250（期待 711000）`);
ok(Number((await pdA(54250, false)).v) === 651000, '　明細に含まれている → 651,000 のまま（二重に足さない）');
ok(Number((await pdA(54250)).v) === 651000, '　22番目を省くと今までどおり 651,000（古い呼び出しは1円も動かない）');
ok(Number((await pdA('null', true)).v) === 60000 && Number((await pdA('null', false)).v) === 60000,
   '★内訳の枝（総支給なし）はパーディアムを1回だけ数える（印があっても二重にしない）→ 12×5,000');
/* 組合の分と一緒でも、それぞれ1回ずつ。 */
const pdU = await one(`select pv_annual_total(54250,null,null,null,null,5000,null,null,
                                              null,null,null,null,null,null,null,null,null,3000,
                                              null,null,true,true) v`);
ok(Number(pdU.v) === 747000, `組合3,000（外）＋パーディアム5,000（外）→ 12×62,250 → ${pdU.v}（期待 747000）`);

/* 保存 → 再取得の通し。BASE のパーディアムは 3,000 → 651,000 + 3,000×12 = 687,000。 */
const PD_ROW = { ...BASE, gross_monthly: 54250, airline: 'cathay-pacific', period_year: 2024 };
await asUser(61);
r = (await submit({ ...PD_ROW, period_month: 10,
                    pay_items: { v: 2, variable_none: true, per_diem_src: 'outside' } })).r;
ok(Number(r.annual_total_orig) === 687000,
   `★明細とは別のパーディアムは総支給に足して ×12 → ${r.annual_total_orig}（期待 687000）`);
const pdRow = await one(`select * from pay_reports where airline='cathay-pacific' and period_year=2024 and period_month=10`);
ok(pdRow && pdRow.pay_items && pdRow.pay_items.per_diem_src === 'outside' && pdRow.pay_items.variable_none === true,
   `★印が白リストの組み直しを生き延びる → ${JSON.stringify(pdRow && pdRow.pay_items)}`);
ok(pdRow && Number(pdRow.per_diem) === 3000 && Number(pdRow.gross_monthly) === 54250,
   '　額は今までどおり per_diem の列・総支給は印字どおり（どちらも書き換えない）');
{
  const my = (await one(`select my_pay_reports() j`)).j;
  const m = (my.reports || []).find((x) => x.airline === 'cathay-pacific' && x.period_month === 10);
  ok(m && m.perdiem_outside_gross === true && m.pay_items === undefined,
     `★my_pay_reports() が真偽値だけ返す（pay_items そのものは返さない）→ ${m && m.perdiem_outside_gross}`);
}
/* ★壊す証明：同じ payload から印だけ外すと 1円も足さない（＝上の 687,000 は印が作っている）。 */
await asUser(62);
r = (await submit({ ...PD_ROW, period_month: 11, pay_items: { v: 2, variable_none: true } })).r;
ok(Number(r.annual_total_orig) === 651000,
   `★印が無ければ（＝総支給に含まれている）1円も足さない → ${r.annual_total_orig}（期待 651000）`);
{
  const my = (await one(`select my_pay_reports() j`)).j;
  const m = (my.reports || []).find((x) => x.airline === 'cathay-pacific' && x.period_month === 11);
  ok(m && m.perdiem_outside_gross === false, `　my_pay_reports() も false → ${m && m.perdiem_outside_gross}`);
}
/* ★印だけの内訳は「空の殻」として null に潰れる＝印も残らず、足しもしない
   （画面の perdiemOutsideGross も f-payitems が空なら足さない）。 */
await asUser(63);
r = (await submit({ ...PD_ROW, period_month: 12, pay_items: { v: 2, per_diem_src: 'outside' } })).r;
const pdShell = await one(`select pay_items from pay_reports where airline='cathay-pacific' and period_year=2024 and period_month=12`);
ok(pdShell && pdShell.pay_items === null && Number(r.annual_total_orig) === 651000,
   `★印だけの pay_items は潰れて足さない → ${JSON.stringify(pdShell && pdShell.pay_items)} / ${r.annual_total_orig}`);
/* ★白リストの外の値は保存の時点で落ちる（足さない）。 */
await asUser(64);
r = (await submit({ ...PD_ROW, period_month: 9,
                    pay_items: { v: 2, variable_none: true, per_diem_src: 'elsewhere' } })).r;
const pdBad = await one(`select pay_items from pay_reports where airline='cathay-pacific' and period_year=2024 and period_month=9`);
ok(pdBad && pdBad.pay_items && !('per_diem_src' in pdBad.pay_items) && Number(r.annual_total_orig) === 651000,
   `　'outside' 以外の値は鍵ごと落ちる → ${JSON.stringify(pdBad && pdBad.pay_items)} / ${r.annual_total_orig}`);

/* ★管理・マネジメント（2026-08-26 その6）。役割ごとのモジュールの4本目。
   ここでは4つ全部を同時に出して、どれもが自分の列に残り、
   互いに足し込まれていないことを見る（二重計上させないの実体）。 */
await asUser(55);
r = (await submit({ ...BASE, gross_monthly: 54250,
                    instructor_pay: 600, examiner_pay: 4000, union_pay: 3000, management_pay: 50000,
                    pay_items: { v: 1,
                      instructor: { trainings: ['sim'], extra: 'separate', method: 'session', amount: 600 },
                      examiner: { checks: ['line'], extra: 'separate', method: 'check', amount: 4000 },
                      union: { days: 12, extra: 'yes', source: 'union', amount: 3000 },
                      management: { days: 8, extra: 'separate', method: 'monthly', amount: 50000 } },
                    job_roles: ['line', 'instructor', 'examiner', 'union', 'management'],
                    airline: 'singapore-airlines', period_year: 2026, period_month: 3 })).r;
const mgt = await one(`select * from pay_reports where airline='singapore-airlines' and period_month=3`);
ok(Number(mgt.management_pay) === 50000 && Number(mgt.union_pay) === 3000
   && Number(mgt.examiner_pay) === 4000 && Number(mgt.instructor_pay) === 600,
  `★教官・審査・組合・管理職が4つとも別々の列に残る → ${mgt.instructor_pay} / ${mgt.examiner_pay} / ${mgt.union_pay} / ${mgt.management_pay}`);
ok(mgt.command_pay === null && mgt.flight_variable_pay === null && mgt.other_allowance === null,
  `職位手当・変動給・その他には1円も入らない → ${mgt.command_pay} / ${mgt.flight_variable_pay} / ${mgt.other_allowance}`);
ok(mgt.pay_items && mgt.pay_items.management
   && Number(mgt.pay_items.management.days) === 8
   && mgt.pay_items.management.method === 'monthly'
   && mgt.pay_items.union && mgt.pay_items.examiner && mgt.pay_items.instructor,
  `★管理職の中身が組み直しを生き延びる（ほかの3つも残ったまま） → ${JSON.stringify(mgt.pay_items.management)}`);
/* ★動いてよいのは組合の 3,000（支給元＝組合）だけ。651,000 + 3,000×12 = 687,000。
   教官600・審査4,000・管理職50,000 のどれか1つでも足し込まれていたら、この数にならない。 */
ok(Number(r.annual_total_orig) === 687000,
  `★総支給がある行で動くのは組合の分だけ（管理職の手当は1円も足さない） → ${r.annual_total_orig}（期待 687000）`);
/* ★管理職だけ書いた人の pay_items が「空の殻」として捨てられないこと。
   日数だけ書いて終える人が居る（Block Hours が少ない月の理由になる）。 */
await asUser(56);
await submit({ ...BASE, gross_monthly: 54250,
               pay_items: { v: 1, management: { days: 8, extra: null, method: null, amount: null } },
               job_roles: ['line', 'management'],
               airline: 'singapore-airlines', period_year: 2026, period_month: 2 });
const mgtB = await one(`select * from pay_reports where airline='singapore-airlines' and period_month=2`);
ok(mgtB.pay_items && mgtB.pay_items.management && Number(mgtB.pay_items.management.days) === 8,
  `★管理業務日数だけ書いた人の pay_items が捨てられない → ${JSON.stringify(mgtB.pay_items)}`);

/* ★その他の兼務・配属（2026-08-27 その7）。役割ごとのモジュールの5本目＝最後。
   ここでは5つ全部を同時に出して、どれもが自分の列に残り、
   互いに足し込まれていないことを見る（二重計上させないの実体）。 */
await asUser(57);
r = (await submit({ ...BASE, gross_monthly: 54250,
                    instructor_pay: 600, examiner_pay: 4000, union_pay: 3000, management_pay: 50000,
                    nonline_pay: 30000,
                    pay_items: { v: 1,
                      instructor: { trainings: ['sim'], extra: 'separate', method: 'session', amount: 600 },
                      examiner: { checks: ['line'], extra: 'separate', method: 'check', amount: 4000 },
                      union: { days: 12, extra: 'yes', source: 'union', amount: 3000 },
                      management: { days: 8, extra: 'separate', method: 'monthly', amount: 50000 },
                      nonline: { areas: ['safety', 'secondment'], days: 8, extra: 'separate', amount: 30000 } },
                    job_roles: ['line', 'instructor', 'examiner', 'union', 'management', 'nonline'],
                    airline: 'singapore-airlines', period_year: 2026, period_month: 1 })).r;
const nol = await one(`select * from pay_reports where airline='singapore-airlines' and period_month=1`);
ok(Number(nol.nonline_pay) === 30000 && Number(nol.management_pay) === 50000
   && Number(nol.union_pay) === 3000 && Number(nol.examiner_pay) === 4000
   && Number(nol.instructor_pay) === 600,
  `★教官・審査・組合・管理職・兼務が5つとも別々の列に残る → ${nol.instructor_pay} / ${nol.examiner_pay} / ${nol.union_pay} / ${nol.management_pay} / ${nol.nonline_pay}`);
ok(nol.command_pay === null && nol.flight_variable_pay === null && nol.other_allowance === null,
  `職位手当・変動給・その他には1円も入らない → ${nol.command_pay} / ${nol.flight_variable_pay} / ${nol.other_allowance}`);
ok(nol.pay_items && nol.pay_items.nonline
   && Array.isArray(nol.pay_items.nonline.areas) && nol.pay_items.nonline.areas.length === 2
   && Number(nol.pay_items.nonline.days) === 8
   && nol.pay_items.nonline.extra === 'separate'
   && nol.pay_items.management && nol.pay_items.union && nol.pay_items.examiner && nol.pay_items.instructor,
  `★兼務・配属の中身が組み直しを生き延びる（ほかの4つも残ったまま） → ${JSON.stringify(nol.pay_items.nonline)}`);
/* ★ここでも動いてよいのは組合の 3,000 だけ。兼務30,000・管理職50,000 は
   支給元を聞いていない＝総支給の中にあるものとして扱う（オーナー判断 2026-09-02）。 */
ok(Number(r.annual_total_orig) === 687000,
  `★総支給がある行で動くのは組合の分だけ（兼務・配属の手当は1円も足さない） → ${r.annual_total_orig}（期待 687000）`);
/* ★分野だけ選んで終える人が居る（追加報酬が無いのは普通のこと）。
   「空の殻」として捨てられないこと。 */
await asUser(58);
await submit({ ...BASE, gross_monthly: 54250,
               pay_items: { v: 1, nonline: { areas: ['fleet'], days: null, extra: 'none', amount: null } },
               job_roles: ['line', 'nonline'],
               airline: 'emirates', period_year: 2026, period_month: 2 });
const nolB = await one(`select * from pay_reports where airline='emirates' and period_month=2`);
ok(nolB.pay_items && nolB.pay_items.nonline && nolB.pay_items.nonline.extra === 'none',
  `★分野だけ書いた人の pay_items が捨てられない → ${JSON.stringify(nolB.pay_items)}`);

ok((await boom(`select submit_pay_report($1::jsonb)`, [JSON.stringify({
  ...BASE, base_pay: null, hourly_rate: null, gross_monthly: 0,
  airline: 'lufthansa', period_year: 2026, period_month: 4,
})]) || '').includes('報酬額'), '総支給0・基本給も時給も無い行は弾く');

// ── 役職・区分（複数）と内訳の行（2026-08-26 に足した2列）──────────
// 会社ごとに変動給の建て付けが違うので、固定の欄に押し込めない。行の形のまま溜める。
console.log('\n▼ 役職・区分（複数）と内訳の行');
await asUser(44);
const ITEMS = {
  v: 1, fixed_none: false,
  variable: [{ amount: 180000, basis: 'block', label: 'Flight Pay', rule: 'AED 250 / Block Hour' }],
  other: [{ amount: 12000, label: '通勤手当' }],
};
r = (await submit({
  ...BASE, gross_monthly: 54250, airline: 'ana', period_year: 2026, period_month: 5,
  job_roles: ['instructor', 'line'], pay_items: ITEMS,
})).r;
const jr = await one(`select * from pay_reports where airline='ana' and period_month=5`);
ok(String(jr.job_roles) === 'instructor,line', `役職を複数そのまま保存 → ${jr.job_roles}`);
// ★単数の列は消さない。過去の全行と管理者メールがそちらを見ている。
ok(jr.job_role === 'instructor', `job_role（単数）に先頭が入る → ${jr.job_role}`);
ok(jr.pay_items && jr.pay_items.variable[0].label === 'Flight Pay'
   && jr.pay_items.other[0].amount === 12000,
  `内訳の行がそのまま残る → 変動${jr.pay_items?.variable?.length} / その他${jr.pay_items?.other?.length}`);

// 文字列で送られてきても受ける（画面は JSON.stringify して送ることがある）
await asUser(45);
await submit({
  ...BASE, gross_monthly: 54250, airline: 'jal', period_year: 2026, period_month: 5,
  job_roles: ['union'], pay_items: JSON.stringify(ITEMS),
});
const js = await one(`select * from pay_reports where airline='jal' and period_month=5`);
ok(js.pay_items && js.pay_items.variable.length === 1, '文字列で送られた内訳も読める');

// 知らないキーは組み直しで落ちる（p はログイン利用者が自由に作れる）
await asUser(46);
await submit({
  ...BASE, gross_monthly: 54250, airline: 'ryanair', period_year: 2026, period_month: 5,
  pay_items: { v: 1, other: [{ amount: 500, label: 'x' }], evil: 'ここに何でも入れられては困る' },
});
const ev = await one(`select * from pay_reports where airline='ryanair' and period_month=5`);
ok(ev.pay_items && ev.pay_items.evil === undefined, `知らないキーは落ちる → ${JSON.stringify(ev.pay_items)}`);

// 空の殻は溜めない（行も「該当なし」も無い）
await asUser(47);
await submit({
  ...BASE, gross_monthly: 54250, airline: 'qantas', period_year: 2026, period_month: 5,
  pay_items: { v: 1, fixed_none: false },
});
ok((await one(`select * from pay_reports where airline='qantas' and period_month=5`)).pay_items === null,
  '中身の無い内訳は保存しない');

/* ── 「該当なし」3つ（2026-09-03。REAL PAY の内訳の門が読む）──────────
   ★これは「金額が0」ではなく「その項目が会社に無い」。0円とは別物として
     真偽で持つ（列は足していない。pay_items の中の3つ）。
   ⚠️ 空の殻を捨てる判定に *_none を足し忘れると、「該当なし」だけを
      答えた人の内訳が丸ごと null に潰れる。画面もDBも何も言わないまま、
      その人は REAL PAY の内訳が**一生開かない**。ここがその見張り。 */
await asUser(51);
await submit({
  ...BASE, gross_monthly: 54250, airline: 'qantas', period_year: 2026, period_month: 7,
  pay_items: { v: 1, fixed_none: true, guarantee_none: true, variable_none: true },
});
const nn = (await one(`select * from pay_reports where airline='qantas' and period_month=7`)).pay_items;
ok(nn && nn.fixed_none === true && nn.guarantee_none === true && nn.variable_none === true,
  `★「該当なし」3つだけでも内訳が残る（空の殻に潰されない） → ${JSON.stringify(nn)}`);

// false（＝「該当なし」ではない）は殻とみなす。全部 false なら今までどおり保存しない。
await asUser(52);
await submit({
  ...BASE, gross_monthly: 54250, airline: 'qantas', period_year: 2026, period_month: 8,
  pay_items: { v: 1, fixed_none: false, guarantee_none: false, variable_none: false },
});
ok((await one(`select * from pay_reports where airline='qantas' and period_month=8`)).pay_items === null,
  '「該当なし」が3つとも false なら、今までどおり中身なし扱い');

// 真偽以外は捨てる（画面が誤って文字列を送っても、真偽のふりをさせない）
await asUser(53);
await submit({
  ...BASE, gross_monthly: 54250, airline: 'qantas', period_year: 2026, period_month: 9,
  pay_items: { v: 1, guarantee_none: 'yes', variable_none: 1,
               other: [{ amount: 500, label: 'x' }] },
});
const nb = (await one(`select * from pay_reports where airline='qantas' and period_month=9`)).pay_items;
ok(nb && nb.guarantee_none === undefined && nb.variable_none === undefined,
  `★真偽でない「該当なし」は落ちる（文字列で門を開けさせない） → ${JSON.stringify(nb)}`);

/* ── 内訳の「形」だけを返す（2026-09-12・翌月のひな型の材料）──────────
   ★pv_pay_items_shape は my_pay_reports() が呼ぶ。金額を1円でも返すと、
     翌月のフォームに**先月の実績**が初期値として入る＝本人に嘘をつく。
     ここが「金額も数量も出ていない」ことの唯一の見張り。 */
console.log('\n▼ 内訳の形だけを返す（翌月のひな型）');
const SHAPE_IN = {
  v: 1, variable_none: false, guarantee_none: true,
  variable: [
    { amount: 180000, basis: 'block', label: 'Flight Pay', rule: 'AED 250 / Block Hour' },
    { amount: 0, basis: 'day', label: 'Layover' },
    { amount: 4000 },                      // 名前も単位も無い＝形を持たない行
  ],
  other: [{ amount: 12000, label: '通勤手当' }, {}],
  instructor: { trainings: 3, amount: 60000, label: 'OJT', extra: true, method: 'per', pay: 999 },
  examiner: { checks: 2, amount: 40000, method_label: 'LOSA' },
  union: { extra: true, source: 'union', amount: 12345 },
  management: { extra: true, method: 'fixed', amount: 777 },
  nonline: { areas: ['safety'], extra: true, days: 4, amount: 5555 },
  partial: true,
};
const SH = (await one(`select public.pv_pay_items_shape($1::jsonb) s`,
  [JSON.stringify(SHAPE_IN)])).s;
const SHJ = JSON.stringify(SH);

// ★これが本丸。金額・数量が1つでも混ざったら落ちる。
ok(!/180000|12000|60000|40000|12345|777|5555|4000|999/.test(SHJ),
  `★形だけ ── 金額が1円も出ない → ${SHJ}`);
ok(SH.variable && SH.variable.length === 2
   && SH.variable[0].label === 'Flight Pay' && SH.variable[0].basis === 'block'
   && SH.variable[1].label === 'Layover'    && SH.variable[1].basis === 'day',
  `★項目名・支給単位・並び順は残る → ${JSON.stringify(SH.variable)}`);
ok(SH.variable && SH.variable.every((x) => x.amount === undefined && x.rule === undefined),
  '★行に amount も rule も付けない（rule は「AED 250 / Block Hour」＝単価そのもの）');
ok(SH.variable && SH.variable.length === 2 && SH.other && SH.other.length === 1,
  `★名前も単位も無い行は落とす（＋を押しただけの空の行を翌月へ運ばない） → 変動${SH.variable?.length} / その他${SH.other?.length}`);
ok(SH.guarantee_none === true && SH.variable_none === undefined,
  `★「該当なし」は true のものだけ形に入る → ${SHJ}`);
// 役割の札は白リスト。増えた鍵が黙って混ざらないこと。
ok(SH.instructor && SH.instructor.trainings === 3 && SH.instructor.method === 'per'
   && SH.instructor.amount === undefined && SH.instructor.pay === undefined,
  `★役割は白リストの鍵だけ（金額は入らない） → ${JSON.stringify(SH.instructor)}`);
ok(SH.examiner && SH.examiner.checks === 2 && SH.examiner.method_label === 'LOSA'
   && SH.examiner.amount === undefined,
  `★審査も同じ → ${JSON.stringify(SH.examiner)}`);
ok(SH.nonline && String(SH.nonline.areas) === 'safety'
   && SH.nonline.days === undefined && SH.nonline.amount === undefined,
  `★兼務は分野だけ（日数も金額も出さない） → ${JSON.stringify(SH.nonline)}`);
ok(SH.partial === undefined,
  `★partial は形ではない（翌月のひな型に「一部未回答」を持ち越さない） → ${SHJ}`);
ok((await one(`select public.pv_pay_items_shape('null'::jsonb) s`)).s === null
   && (await one(`select public.pv_pay_items_shape(null::jsonb) s`)).s === null,
  '内訳が無い行では null（形も作らない）');

// my_pay_reports() が実際にその形を返すか（ここに写し忘れると機種変の人に効かない）
await asUser(44);
const MYR = (await one(`select my_pay_reports() j`)).j;
const mrow = (MYR.reports || []).find((x) => x.airline === 'ana' && x.period_month === 5);
ok(mrow && mrow.pay_items_shape && mrow.pay_items_shape.variable?.[0]?.label === 'Flight Pay',
  `★my_pay_reports() が形を返す → ${JSON.stringify(mrow?.pay_items_shape)}`);
ok(mrow && !/180000|12000/.test(JSON.stringify(mrow.pay_items_shape || {})),
  '★my_pay_reports() の形にも金額が入らない');
ok(mrow && mrow.pay_items === undefined,
  '★pay_items そのものは今までどおり返さない（形だけに限って広げた）');

/* ── 変動給を種類ごとに足す（2026-11-08・本人の年報の材料）──────────
   ★年報の「種類ごとの単価」は 額 ÷ 数量（block_hours / duty_hours / night_hours / sectors）。
     額は pay_items.variable の行の中にしか無いので、pv_variable_by_basis が種類ごとに足し、
     my_pay_reports() が本人の行にだけ添える。
   ★見るのは4つ ── 種類ごとに足す／空・一覧に無い種類は unknown／数でない額は捨てる／
     本人の行にしか出ない。最後に壊す証明（my_pay_reports から1行外すと赤くなる）。 */
console.log('\n▼ 変動給を種類ごとに足す（本人の年報の材料）');
const vbb = async (items) => (await one(`select public.pv_variable_by_basis($1::jsonb) v`,
  [items === null ? null : JSON.stringify(items)])).v;
const sameVB = (a, b) => !!a && typeof a === 'object'
  && JSON.stringify(Object.keys(a).sort()) === JSON.stringify(Object.keys(b).sort())
  && Object.keys(b).every((k) => Number(a[k]) === b[k]);
{
  const VB = await vbb({
    v: 2,
    variable: [
      { amount: 3000,   basis: 'block',   label: 'Flight Pay' },
      { amount: 1500.5, basis: 'block',   label: 'Flight Pay (extra)' },
      { amount: 800,    basis: 'night',   label: 'Night Allowance' },
      { amount: 400,    basis: 'sector',  label: 'Sector Pay' },
      { amount: 200,    basis: '',        label: '種類が空' },
      { amount: 100,                      label: '種類が無い' },
      { amount: 50,     basis: 'flight',  label: '一覧に無い種類' },
      { amount: 25,     basis: 'unknown', label: 'わからない' },
      { amount: 'abc',  basis: 'block' },   // 数でない
      { amount: '',     basis: 'night' },   // ＋を押しただけの空の行
      { basis: 'sector' },                  // 額が無い
      { amount: -300,   basis: 'duty' },    // マイナス（変動給の列は 0 以上）
      'これは行ではない',
    ],
    other:   [{ amount: 99999, label: '通勤手当' }],
    absence: [{ amount: -7777, label: 'Unpaid leave' }],
  });
  const VBJ = JSON.stringify(VB);
  ok(VB && Number(VB.block) === 4500.5, `★Block の2行は足し合わせる → ${VB && VB.block}（期待 4500.5）`);
  ok(VB && Number(VB.night) === 800 && Number(VB.sector) === 400,
     `★夜間とセクターは別々に出る → night ${VB && VB.night} / sector ${VB && VB.sector}`);
  ok(VB && Number(VB.unknown) === 375,
     `★種類が空・無い・一覧に無い行は unknown に寄せる（明示の unknown と合わせて 200+100+50+25）→ ${VB && VB.unknown}`);
  ok(sameVB(VB, { block: 4500.5, night: 800, sector: 400, unknown: 375 }),
     `★行の無い種類はキーごと出さない・数でない額とマイナスは捨てる（duty も flight も出ない）→ ${VBJ}`);
  ok(!/99999|7777/.test(VBJ), '★その他の現金手当・不就労減額は混ぜない（変動給の行だけ）');
  ok(!/Flight Pay|Night Allowance|Sector Pay/.test(VBJ), '★項目名は返さない（種類ごとの額だけ）');

  const empties = [
    ['null（SQL）', null],
    ['variable が無い', { v: 1, other: [{ amount: 500, label: 'x' }] }],
    ['variable が配列でない', { v: 1, variable: { amount: 5, basis: 'block' } }],
    ['variable が空の配列', { v: 1, variable: [] }],
    ['数でない額の行だけ', { v: 1, variable: [{ amount: 'x', basis: 'block' }, { label: '空' }] }],
    ['pay_items が配列', [{ amount: 5, basis: 'block' }]],
    ['pay_items が文字', 'これは内訳ではない'],
  ];
  const notEmpty = [];
  for (const [name, items] of empties) {
    const v = await vbb(items);
    if (JSON.stringify(v) !== '{}') notEmpty.push(`${name}: ${JSON.stringify(v)}`);
  }
  const vNullJson = (await one(`select public.pv_variable_by_basis('null'::jsonb) v`)).v;
  if (JSON.stringify(vNullJson) !== '{}') notEmpty.push(`null（JSON）: ${JSON.stringify(vNullJson)}`);
  ok(notEmpty.length === 0, `★変動給の行が無ければ {}（null にしない・壊れた形でも落ちない）→ ${empties.length + 1} 通り`,
     notEmpty.join(' | '));

  const vfn = await one(`select p.prosecdef d, p.provolatile v from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace where n.nspname='public' and p.proname='pv_variable_by_basis'`);
  ok(vfn && vfn.d === false && vfn.v === 'i',
     `★持ち主の権限で走らない・表を読まない（pv_absence_total と同じ扱い）→ secdef=${vfn && vfn.d} / ${vfn && vfn.v}`);
}

/* my_pay_reports() が本人の行にだけ添えること。
   A は内訳つきの月と内訳の無い月を1つずつ。B は同じ会社・同じ月に別の内訳。 */
const VROW = { ...BASE, gross_monthly: 54250, airline: 'finnair', period_year: 2019 };
const VB_A = { block: 4500, night: 800, sector: 400, unknown: 200 };
await asUser(70);
r = (await submit({ ...VROW, period_month: 3, flight_variable_pay: 5900,
  pay_items: { v: 2, variable: [
    { amount: 3000, basis: 'block',  label: 'Flight Pay' },
    { amount: 1500, basis: 'block',  label: 'Flight Pay (extra)' },
    { amount: 800,  basis: 'night',  label: 'Night' },
    { amount: 400,  basis: 'sector', label: 'Sector' },
    { amount: 200,  basis: '',       label: '種類が空' },
  ] } })).r;
ok(r.ok === true, '（内訳つきの月を出せた）');
await submit({ ...VROW, period_month: 4 });
await asUser(71);
await submit({ ...VROW, period_month: 3, flight_variable_pay: 999,
  pay_items: { v: 2, variable: [{ amount: 999, basis: 'duty', label: 'Duty Pay' }] } });
const vbMine = async (n) => {
  await asUser(n);
  return ((await one(`select my_pay_reports() j`)).j.reports || [])
    .filter((x) => x.airline === 'finnair' && x.period_year === 2019);
};
{
  const mA = await vbMine(70);
  const a3 = mA.find((x) => x.period_month === 3), a4 = mA.find((x) => x.period_month === 4);
  ok(a3 && sameVB(a3.variable_by_basis, VB_A),
     `★my_pay_reports() が本人の行に種類ごとの額を返す（原本通貨のまま）→ ${JSON.stringify(a3 && a3.variable_by_basis)}`);
  ok(a4 && JSON.stringify(a4.variable_by_basis) === '{}',
     `★内訳の無い月は {} → ${JSON.stringify(a4 && a4.variable_by_basis)}`);
  ok(a3 && a3.pay_items === undefined && Number(a3.flight_variable_pay) === 5900,
     '　pay_items そのものは今までどおり返さない・合計の列もそのまま');
  ok(mA.length === 2 && mA.every((x) => !('duty' in (x.variable_by_basis || {}))),
     `★他人（B）の行は混ざらない → ${mA.length} 行`);
  const mB = await vbMine(71);
  ok(mB.length === 1 && sameVB(mB[0].variable_by_basis, { duty: 999 }),
     `★B には B の行だけ（A の Block も夜間も見えない）→ ${JSON.stringify(mB.map((x) => x.variable_by_basis))}`);
}

/* ── 壊す証明 ──
   my_pay_reports() から variable_by_basis の1行を外した版を begin … rollback の中でだけ入れる（ファイルは触らない）。
   上と同じ確かめ方・オーナーの検算 8-23・verify.sql の23行目が、どれも赤くなること。 */
{
  const vbCheck = async () => {
    const a3 = (await vbMine(70)).find((x) => x.period_month === 3);
    return !!a3 && sameVB(a3.variable_by_basis, VB_A);
  };
  ok(await vbCheck(), '（本物）年報の材料の検査は緑');
  const src = read('db/pay-reports.sql');
  const a = src.indexOf('create or replace function public.my_pay_reports()');
  const b = a < 0 ? -1 : src.indexOf('\n$$;', a);
  const fn = (a < 0 || b < 0) ? '' : src.slice(a, b + '\n$$;'.length);
  const LINE = '           public.pv_variable_by_basis(r.pay_items) as variable_by_basis,\n';
  const broken = fn.split(LINE).length === 2 ? fn.split(LINE).join('') : '';
  ok(broken && !/as variable_by_basis/.test(broken) && broken.includes('as pay_items_shape'),
     '（my_pay_reports から1行だけ外した版を作れた）');
  const i823 = src.indexOf('-- 8-23.'), j823 = i823 < 0 ? -1 : src.indexOf('\nselect ', i823);
  const q823 = j823 < 0 ? '' : src.slice(j823 + 1, src.indexOf(';', j823));
  const v23 = async () => (await rows(read('db/pay-reports.verify.sql')))
    .find((x) => Number(x['#']) === 23)?.['判定'];
  ok(q823.includes('my_pay_reports') && (await one(q823))['返している'] === true && (await v23()) === '✅',
     '（本物）検算 8-23 は true・verify.sql の23行目は ✅');
  await db.exec(`begin`);
  await db.exec(broken);
  const red = await vbCheck();
  const red823 = (await one(q823))['返している'];
  const red23 = await v23();
  await db.exec(`rollback`);
  ok(!red, '★壊した版では、本人の行に種類ごとの額が出ない（検査が赤くなる）');
  ok(red823 === false && red23 === '❌',
     `★壊した版では、オーナーの検算 8-23 も verify.sql の23行目も赤（${red823} / ${red23}）`);
  ok(await vbCheck(), '（巻き戻したあと: 本物は緑）');
}

/* ── partial（内訳が一部未回答）────────────────────────────────
   ★これは「閲覧の資格」ではない。集計で「全額が揃った内訳」として
     足してよいかだけを決める印。pv_my_give の門はこれを読まない。 */
console.log('\n▼ partial（内訳が一部未回答）');
await asUser(54);
await submit({
  ...BASE, gross_monthly: 54250, airline: 'qantas', period_year: 2025, period_month: 10,
  pay_items: { v: 1, variable: [{ amount: 1000, label: 'Flight Pay' },
                                { label: 'Layover' }], partial: true },
});
const pt = (await one(`select * from pay_reports where airline='qantas' and period_year=2025 and period_month=10`)).pay_items;
ok(pt && pt.partial === true,
  `★partial が組み直しを生き延びる（写し忘れると、一部未回答の月が「揃った内訳」に混ざる） → ${JSON.stringify(pt)}`);

// partial だけの殻は中身ではない（行も「該当なし」も無いなら今までどおり保存しない）
await asUser(55);
await submit({
  ...BASE, gross_monthly: 54250, airline: 'qantas', period_year: 2025, period_month: 11,
  pay_items: { v: 1, partial: true },
});
ok((await one(`select * from pay_reports where airline='qantas' and period_year=2025 and period_month=11`)).pay_items === null,
  '★partial だけの殻は保存しない（中身のない「一部未回答」は意味を持たない）');

// 真偽でなければ落とす（文字列の 'yes' で門を開けさせない）
await asUser(56);
await submit({
  ...BASE, gross_monthly: 54250, airline: 'qantas', period_year: 2025, period_month: 12,
  pay_items: { v: 1, other: [{ amount: 500, label: 'x' }], partial: 'yes' },
});
const pf = (await one(`select * from pay_reports where airline='qantas' and period_year=2025 and period_month=12`)).pay_items;
ok(pf && pf.partial === undefined, `真偽でない partial は落ちる → ${JSON.stringify(pf)}`);

// ★partial は閲覧の資格ではない ── 内訳の門（base_pay is not null ほか）を塞がない
await asUser(57);
await submit({
  ...BASE, gross_monthly: 54250, airline: 'qantas', period_year: 2026, period_month: 6,
  base_pay: 0, pay_items: { v: 1, variable: [{ amount: 0, label: 'Flight Pay' },
                                             { label: 'Layover' }], partial: true },
});
const pg6 = await one(`select * from pay_reports where airline='qantas' and period_month=6`);
ok(Number(pg6.base_pay) === 0 && pg6.pay_items?.partial === true,
  `★基本給 0（＝回答済み）と partial が両立する → base_pay=${pg6.base_pay} / ${JSON.stringify(pg6.pay_items)}`);

// 語彙に無い役職は弾く（job_roles には外部キーを張れないので、ここが唯一の関門）
ok((await boom(`select submit_pay_report($1::jsonb)`, [JSON.stringify({
  ...BASE, gross_monthly: 54250, airline: 'ana', period_year: 2026, period_month: 3,
  job_roles: ['line', 'not-a-role'],
})]) || '').includes('役職'), '語彙に無い役職は弾く');

// ★壊れた内訳で投稿そのものを落とさない（1件が丸ごと無駄になるのがいちばん損）
await asUser(48);
r = (await submit({
  ...BASE, gross_monthly: 54250, airline: 'ana', period_year: 2026, period_month: 2,
  pay_items: 'これは JSON ではない',
})).r;
ok(r.ok === true, '内訳が壊れていても投稿は通る');

// 訂正で内訳が空になったら古い内訳を残さない
await asUser(44);
await submit({
  ...BASE, gross_monthly: 54250, airline: 'ana', period_year: 2026, period_month: 5,
  job_roles: ['line'],
});
const fix = await one(`select * from pay_reports where airline='ana' and period_month=5`);
ok(fix.pay_items === null && String(fix.job_roles) === 'line',
  `出し直すと役職も内訳も新しいほうになる → ${fix.job_roles} / ${fix.pay_items}`);

// ── ステイ日数と「今月出たボーナス」（2026-08-13 に足した2列）──────
// 総支給と手取りは「明細のとおり」＝ボーナスが出た月は込みの額で申告してもらう。
// そのまま ×12 すると年収が跳ね上がるので、うち今月出たぶんを別に聞いて引く。
console.log('\n▼ ステイ日数と今月出たボーナス');
await asUser(43);
r = (await submit({
  ...BASE, base_pay: null, hourly_rate: null,
  gross_monthly: 64250, bonus_month: 10000, stay_nights: 12,
  airline: 'zipair', period_year: 2026, period_month: 1,
})).r;
ok(Number(r.annual_total_orig) === 651000,
   `年換算は（総支給 − 今月のボーナス）×12 → ${r.annual_total_orig}`);
let st = await one(`select * from pay_reports where airline='zipair' and period_month=1`);
ok(Number(st.stay_nights) === 12 && Number(st.bonus_month) === 10000,
   `2列とも保存される → ステイ${st.stay_nights}泊 / 今月のボーナス${st.bonus_month}`);

// 同じ月を出し直したら上書きされること（on conflict の取りこぼしが起きていないか）
await submit({
  ...BASE, base_pay: null, hourly_rate: null,
  gross_monthly: 54250, bonus_month: 0, stay_nights: 0,
  airline: 'zipair', period_year: 2026, period_month: 1,
});
st = await one(`select * from pay_reports where airline='zipair' and period_month=1`);
ok(Number(st.stay_nights) === 0 && Number(st.bonus_month) === 0,
   `出し直すと2列とも上書きされる → ${st.stay_nights} / ${st.bonus_month}`);

// 日帰りだけの月の 0 は「未入力」ではない（null に潰さない）
ok(st.stay_nights !== null, 'ステイ0泊は 0 のまま保存される（null に潰れていない）');

// 範囲外は DB 側で弾く（画面の max だけに頼らない）
ok((await boom(`select submit_pay_report($1::jsonb)`, [JSON.stringify({
  ...BASE, base_pay: null, hourly_rate: null, gross_monthly: 54250,
  stay_nights: 40, airline: 'zipair', period_year: 2026, period_month: 5,
})]) || '').includes('stay_nights'), 'ステイ日数が32泊以上の行は DB が弾く');

// ── 権限 ─────────────────────────────────────────────────────
console.log('\n▼ 権限（ここが UI ではなく DB で守られているか）');
const grants = await rows(`select grantee, privilege_type from information_schema.role_table_grants
  where table_schema='public' and table_name='pay_reports' and grantee in ('anon','authenticated')`);
ok(grants.length === 0, `anon/authenticated に pay_reports の直接権限が無い → ${grants.length} 件`);

const pol = await rows(`select policyname from pg_policies where schemaname='public' and tablename='pay_reports'`);
ok(pol.length === 0, `pay_reports に SELECT ポリシーが1本も無い → ${pol.length} 本`);

const rls = await one(`select relrowsecurity r from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='pay_reports'`);
ok(rls.r === true, 'RLS が有効');

await db.exec(`set role anon`);
const denied = await boom(`select count(*) from public.pay_reports`);
ok(denied !== null && /permission denied/i.test(denied), `anon は個票を読めない → ${denied?.slice(0, 50)}`);
const readable = await boom(`select count(*) from public.pay_benchmarks`);
ok(/permission denied/i.test(readable || ''), `★anon は区分の集計を読めない（2026-11-08 から）→ ${readable?.slice(0, 50)}`);
const rpcDenied = await boom(`select submit_pay_report('{}'::jsonb)`);
ok(rpcDenied !== null && /permission denied/i.test(rpcDenied), 'anon は投稿 RPC を呼べない');
await db.exec(`reset role`);

const vopt = await one(`select reloptions o from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='pay_benchmarks'`);
ok(!String(vopt.o || '').includes('security_invoker'),
  `ビューは所有者権限で走る（security_invoker を立てていない）→ ${vopt.o || 'なし'}`);
await db.exec(`set role authenticated`);
const readableAuth = await boom(`select count(*) from public.pay_benchmarks`);
await db.exec(`reset role`);
ok(/permission denied/i.test(readableAuth || ''), `★ログイン済みの会員も区分の集計を読めない → ${readableAuth?.slice(0, 50)}`);
ok((await boom(`select count(*) from public.pay_benchmarks`)) === null, '持ち主（運営の道具）は今までどおり読める');

// ── バッジの鮮度 ─────────────────────────────────────────────
console.log('\n▼ バッジの鮮度（90日）');
await db.query(`update profiles set last_pay_report_at = now() - interval '90 days' where id=$1`, [uid(1)]);
await db.query(`update profiles set last_pay_report_at = now() - interval '91 days' where id=$1`, [uid(10)]);
await db.exec(`select pv_refresh_badge_states()`);
const s90 = await one(`select badge_state s from profiles where id=$1`, [uid(1)]);
const s91 = await one(`select badge_state s from profiles where id=$1`, [uid(10)]);
ok(s90.s === 'active', `90日目は active のまま → ${s90.s}`);
ok(s91.s === 'inactive', `91日目で inactive に落ちる → ${s91.s}`);

// ── 匿名性 ───────────────────────────────────────────────────
console.log('\n▼ 匿名性');
const cols = (await rows(`select column_name c from information_schema.columns
  where table_schema='public' and table_name='pay_reports'`)).map((x) => x.c);
ok(!cols.some((c) => ['user_id', 'uid', 'email', 'auth_id'].includes(c)),
  `どの列も auth.uid() に辿り着かない（${cols.length} 列）`);
const h = await one(`select count(distinct proof_hash) d, count(*) n from pay_reports`);
ok(Number(h.d) > 1, `proof_hash は人ごとに違う → ${h.d} 種 / ${h.n} 行`);

/* ── ラベル辞書 pv_label_hints（2026-08-14）─────────────────────
   海外の変動給は会社ごとに名前が違うので、分類できなかった行は金額だけ数えて
   最後に1問だけ本人に聞いている。その答えが payslip_detail.unmapped[].asked に入る。
   このビューは「3人以上が同じ答えを出したラベル」だけを返す＝4人目からは聞かない。

   ★ここで守りたいのは2つ。
     ① 1人の押し間違い（あるいは悪意）が、その会社の全員の分類を書き換えないこと
     ② 辞書が自分の出力を食べないこと（辞書が入れた行＝hint は1票も数えない）。
        混ざると、3人の答えが100人に自動適用されて「103人が確認済み」に化ける。 */
console.log('\n▼ ラベル辞書（pv_label_hints）');

const hint = (n, airline, month, unmapped, extra = {}) => asUser(n).then(() => submit({
  ...BASE, airline, period_year: 2026, period_month: month,
  payslip_detail: JSON.stringify({ v: 1, unmapped }), ...extra,
}));
const U = (label, asked, amount = 82400) => [{ label, amount, asked }];
const hints = (where = '') => rows(`select * from pv_label_hints ${where}`);

// ① 3人一致で載る／2人では載らない
await hint(60, 'zipair', 6, U('変動付加乗務手当', 'flight_variable'));
await hint(61, 'zipair', 6, U('変動付加乗務手当', 'flight_variable'));
let hv = await hints(`where label='変動付加乗務手当'`);
ok(hv.length === 0, `2人では辞書に載らない → ${hv.length} 件`);
await hint(62, 'zipair', 6, U('変動付加乗務手当', 'flight_variable'));
hv = await hints(`where label='変動付加乗務手当'`);
const byScope = (a, s) => a.filter((x) => x.scope === s);
ok(byScope(hv, 'airline').length === 1 && byScope(hv, 'airline')[0].airline === 'zipair' &&
   byScope(hv, 'airline')[0].asked === 'flight_variable',
   `3人目で会社の辞書に載る → ${JSON.stringify(byScope(hv, 'airline')[0] || null)}`);

// ② 同じ1人が3か月ぶん出しても1人（count(distinct proof_hash)）
await hint(63, 'jal', 6, U('乗務加給', 'command'));
await hint(63, 'jal', 7, U('乗務加給', 'command'));
await hint(63, 'jal', 8, U('乗務加給', 'command'));
const solo = await one(`select count(*) n from pay_reports where airline='jal'
                          and payslip_detail->'unmapped' is not null`);
ok(Number(solo.n) === 3, `同じ人の3か月ぶんが3行ある → ${solo.n} 行`);
ok((await hints(`where label='乗務加給'`)).length === 0,
   '同じ人が3回出しても載らない（数えるのは行ではなく人）');

// ③ 答えが割れたら載らない（3対3・会社別も会社またぎも）
for (const n of [64, 65, 66]) await hint(n, 'lufthansa', 6, U('Zulage', 'per_diem'));
for (const n of [67, 68, 69]) await hint(n, 'lufthansa', 6, U('Zulage', 'other'));
ok((await hints(`where label='zulage'`)).length === 0,
   '3対3で割れたら載らない（過半数に届かない）');

// ④ 6択に無い asked は3人揃っても入らない（★ここが唯一の門）
//    payslip_detail の配列の中身は submit_pay_report が素通しするので、
//    ログインすれば誰でも好きな文字列を入れられる。
for (const n of [70, 71, 72]) await hint(n, 'qatar-airways', 6, U('Fake Pay', 'base'));
for (const n of [73, 74, 75]) await hint(n, 'qatar-airways', 6, U('Fake Pay 2', 'f-base'));
ok((await hints(`where label like 'fake pay%'`)).length === 0,
   '6択に無い分類は、3人揃えても辞書に入らない');
// 長すぎるラベルも入れない（②の門）
const LONG = 'x'.repeat(61);
for (const n of [76, 77, 78]) await hint(n, 'qatar-airways', 7, U(LONG, 'other'));
ok((await hints(`where label like 'xxxxx%'`)).length === 0, '61文字のラベルは辞書に入らない');

// ⑤ 辞書が入れた行（hint）は票にならない
for (const n of [79, 80, 81]) {
  await hint(n, 'singapore-airlines', 6,
    [{ label: 'Productivity Pay', amount: 3240, asked: null, hint: 'flight_variable' }]);
}
ok((await hints(`where label='productivity pay'`)).length === 0,
   '辞書が入れた行は1票も数えない（3人ぶんあっても載らない）');
// 同じラベルに人が3人答えたらそこで初めて載る（hint 3件は足し算に入らない）
for (const n of [82, 83]) await hint(n, 'singapore-airlines', 7, U('Productivity Pay', 'flight_variable', 3240));
ok((await hints(`where label='productivity pay'`)).length === 0,
   '人の答えが2件・辞書の行が3件でも、まだ載らない');
await hint(84, 'singapore-airlines', 7, U('Productivity Pay', 'flight_variable', 3240));
ok(byScope(await hints(`where label='productivity pay'`), 'airline').length === 1,
   '人の答えが3人になった時点で載る');

// ⑥ 会社をまたいだ辞書（scope='global'）は 2/3 以上一致のときだけ
//    海外は1社あたり1〜2人しか投稿が無く、会社別だけだと辞書が永久に育たない。
await hint(85, 'cathay-pacific', 6, U('Sector Pay', 'flight_variable', 1485));
await hint(86, 'qantas', 6, U('Sector Pay', 'flight_variable', 1485));
await hint(87, 'british-airways', 6, U('Sector Pay', 'flight_variable', 1485));
hv = await hints(`where label='sector pay'`);
ok(byScope(hv, 'airline').length === 0 && byScope(hv, 'global').length === 1 &&
   byScope(hv, 'global')[0].airline === '*',
   `1社1人ずつでも、3社またげば会社またぎの辞書に載る → ${JSON.stringify(hv)}`);
// 割れているうちは出ない → 2/3 を超えた瞬間に出る
await hint(88, 'cathay-pacific', 7, U('Duty Top-up', 'other'));
await hint(89, 'qantas', 7, U('Duty Top-up', 'other'));
await hint(90, 'british-airways', 7, U('Duty Top-up', 'other'));
await hint(91, 'emirates', 5, U('Duty Top-up', 'per_diem'));
await hint(92, 'emirates', 4, U('Duty Top-up', 'per_diem'));
ok((await hints(`where label='duty top-up'`)).length === 0,
   '3対2（2/3に届かない）では会社をまたいだ辞書に載らない');
await hint(93, 'zipair', 7, U('Duty Top-up', 'other'));
ok(byScope(await hints(`where label='duty top-up'`), 'global').length === 1,
   '4対2（2/3ちょうど）で載る');

// ⑦ 自由入力の社名は会社別の辞書を作らない（別々の会社が 'other' に潰れて混ざる）
for (const [n, nm] of [[94, 'Foo Air'], [95, 'Bar Air'], [96, 'Baz Air']]) {
  await hint(n, 'other', 6, U('Roster Bonus', 'bonus'), { airline_other: nm });
}
hv = await hints(`where label='roster bonus'`);
ok(byScope(hv, 'airline').length === 0,
   `airline='other' から会社別の辞書は生まれない → ${byScope(hv, 'airline').length} 件`);
ok(byScope(hv, 'global').length === 1, '会社をまたいだ辞書には入る');

/* ⑧ 画面（payslip.js の normLabel）と SQL（lower(btrim(...))）が同じ答えを返すか。
      ★正規化を2か所に持っている。ずれると「辞書に入っているのに一生当たらない」
        という、いちばん気づけない壊れ方をする。コピーを置かず現物を切り出して回す。 */
const FRONT = read('payslip.js');
const cutN = FRONT.match(/\n {2}function normLabel\(s\) \{[^\n]*\n/);
ok(!!cutN, 'payslip.js から normLabel を切り出せる');
const normLabel = cutN ? new Function(cutN[0] + '\nreturn normLabel;')() : null;
const PROBE = ['  Sector Pay  ', 'SECTOR pay', '\u3000変動付加乗務手当\u3000',
               '\u00A0FDP Allowance\u00A0', 'Tunjangan\tTerbang', '\r\nAdicional de voo\n', ''];
let same = 0;
for (const s of PROBE) {
  const sql = await one(`select lower(btrim($1, E' \t\r\n\u00A0\u3000')) v`, [s]);
  if (normLabel && normLabel(s) === sql.v) same++;
  else console.log(`     ずれ: JS "${normLabel && normLabel(s)}" / SQL "${sql.v}"`);
}
ok(same === PROBE.length, `画面と SQL の正規化が同じ答え → ${same}/${PROBE.length}`);

// ⑨ 権限（誰が読めるか）
const hg = (await rows(`select grantee, privilege_type from information_schema.role_table_grants
  where table_schema='public' and table_name='pv_label_hints' and grantee in ('anon','authenticated')`))
  .map((x) => `${x.grantee}:${x.privilege_type}`);
ok(hg.includes('anon:SELECT') && hg.includes('authenticated:SELECT'),
   `anon/authenticated が辞書を読める → ${hg.join(' ')}`);
const hcols = (await rows(`select column_name c from information_schema.columns
  where table_schema='public' and table_name='pv_label_hints'`)).map((x) => x.c).sort();
ok(hcols.join(',') === 'airline,asked,label,scope',
   `人数を列に出していない（返すのは分類だけ）→ ${hcols.join(',')}`);
await db.exec(`set role anon`);
ok((await boom(`select count(*) from public.pv_label_hints`)) === null, 'anon は辞書を読める');
ok(/permission denied/i.test(await boom(`select count(*) from public.pay_reports`) || ''),
   'anon は個票を読めないまま（辞書を開けても本体は開かない）');
await db.exec(`reset role`);

// ── 先に預かって、あとから本人へ移す ─────────────────────────
/* 会員18人に対して給与レポート0件だった原因は「登録できないと保存されない」形。
   送信を押した瞬間にサーバへ預かり、登録できた人のぶんだけ本棚へ移す形に反転した。
   ここが壊れると、出してくれた人のデータが（本人は出したつもりのまま）入らない。 */
console.log('\n▼ 先に預かって、あとから本人へ移す');

const PEND = {
  ...BASE, base_pay: null, hourly_rate: null, gross_monthly: 54250,
  airline: 'jal', period_year: 2026, period_month: 4, currency: 'JPY',
};
const pend = (payload) => one(`select submit_pay_report_pending($1::jsonb) r`, [JSON.stringify(payload)]);

// 1) ログインしていなくても預けられる
await db.query(`select set_config('pv.uid', '', false)`);
await db.exec(`set role anon`);
const held = (await pend(PEND)).r;
ok(held.ok === true && typeof held.claim_token === 'string' && held.claim_token.length >= 32,
   `ログイン前でも預けられる（預かり証 ${String(held.claim_token).length} 文字）`);
// ★預かった時点では何も返さない。返すと登録せずに比較だけ持ち帰れて、登録する理由が消える
ok(!('annual_total_usd' in held) && !('benchmark' in held) && !('annual_total_orig' in held),
   '預かった時点では年収も比較も返さない', JSON.stringify(held));
// anon は預けた中身を読み返せない
ok(/permission denied/i.test(await boom(`select count(*) from public.pay_reports_pending`) || ''),
   'anon は置き場を直接read できない');
ok(/permission denied/i.test(await boom(`select claim_pending_report('x')`) || ''),
   'anon は紐付けの RPC を呼べない');
await db.exec(`reset role`);
// 本棚（pay_reports）にはまだ1行も入っていない
ok(Number((await one(`select count(*) n from pay_reports where airline='jal' and period_month=4`)).n) === 0,
   'この時点では pay_reports に入っていない');

// 2) 置き場の行は公開集計に出てこない（航空会社ページの中央値が汚れない）
const benchBefore = await one(
  `select count(*) n from pay_benchmarks where airline='jal'`);
ok(Number(benchBefore.n) === 0, '預かっただけの行は公開集計に出ない');
const bviewSrc = (await one(`select pg_get_viewdef('public.pay_benchmarks'::regclass) d`)).d;
ok(!/pay_reports_pending/.test(bviewSrc), '公開集計の定義が置き場を1文字も参照していない');

// 3) 登録できた人が呼ぶと、その人の行として本棚に入る
await asUser(90);
const claimed = (await one(`select claim_pending_report($1) r`, [held.claim_token])).r;
ok(claimed.ok === true && Number(claimed.annual_total_orig) === 54250 * 12,
   `紐付けると本人の行になる（年換算 ${claimed.annual_total_orig}）`);
ok(claimed.payload && claimed.payload.airline === 'jal',
   '紐付けの返りに payload が付く（ログインから戻った直後でもレポートを描ける）');
const moved = await one(`select * from pay_reports where airline='jal' and period_month=4`);
ok(moved && moved.proof_hash ===
   (await one(`select encode(extensions.digest($1 || '::pv_pay::jal','sha256'),'hex') h`, [uid(90)])).h,
   '本人の proof_hash で入っている（誰の行かは登録後に決まる）');
// 90日の解放は紐付けたときに初めて付く（＝登録する理由がこれ）
ok(new Date((await one(`select access_until a from profiles where id=$1`, [uid(90)])).a) > new Date(),
   '解放は紐付けた時点で付く');

/* 4) 二度押し・再読み込みでも二重に入らない
   ★2026-09-11 から「無い」ではなく「もう移してある」と答える。
     これが not_found だった間、給与フォームは
     **サーバでは成功したが応答が届かなかった**再試行を「預かりが無い」と読み、
     新規保存へ流れて祝っていた。預かり行は未引き取りのまま残るので、
     同じ人が REAL PAY に2行・pv_contributors() に2人として載る（最大24か月）。
     ＝画面の枝はこの reason だけを頼りにしている。文字列を変えたら画面も直す。 */
const twice = (await one(`select claim_pending_report($1) r`, [held.claim_token])).r;
ok(twice.ok === false && twice.reason === 'already_claimed',
   '★同じ預かり証の2回目は「もう移してある」と答える（「無い」ではない）', JSON.stringify(twice));
ok(!('payload' in twice),
   '★済んだ後は payload を返さない（預かり証を持っているだけの人に中身を読ませ続けない）');
ok(Number((await one(`select count(*) n from pay_reports where airline='jal' and period_month=4`)).n) === 1,
   '二度押ししても本棚の行は1本のまま');
/* ★応答だけ落ちた再試行を、そのまま5回。行も件数も1のまま動かないこと。
   （画面側は already_claimed を見て保存し直さないが、万一叩かれても増えない） */
for (let i = 0; i < 5; i++) await one(`select claim_pending_report($1) r`, [held.claim_token]);
ok(Number((await one(`select count(*) n from pay_reports where airline='jal' and period_month=4`)).n) === 1,
   '★何度再試行しても本棚は1行のまま');
ok(Number((await one(`select count(*) n from pay_reports_pending where claim_token=$1`,
  [held.claim_token])).n) === 1, '★何度再試行しても置き場も1行のまま');
/* ★人数（pv_contributors）の二重計上は db/pay-rows.sql 側の関数なので
   db/test-pay-rows.mjs で見る（ここは pay-reports.sql までしか読み込まない）。 */
// 移した行も消さない（出したのに会員にならなかった人を数えるための分母）
ok((await one(`select claimed_at c from pay_reports_pending where claim_token=$1`, [held.claim_token])).c !== null,
   '移したあとも置き場に行が残る（claimed_at が入る）');

// 5) 知らない預かり証は例外にしない（利用者に見せる異常ではない）
const nosuch = (await one(`select claim_pending_report($1) r`, ['0'.repeat(48)])).r;
ok(nosuch.ok === false && nosuch.reason === 'not_found', '知らない預かり証はエラーにせず空振り');
ok((await one(`select claim_pending_report('x') r`)).r.reason === 'not_found',
   '短すぎる預かり証も not_found（長さの門をくぐった先と同じ答え）');

// 6) ログインしていない人は紐付けられない
await db.query(`select set_config('pv.uid', '', false)`);
ok(/ログインが必要/.test(await boom(`select claim_pending_report($1)`, ['0'.repeat(48)]) || ''),
   'ログインしていないと紐付けられない');

/* 7) ★この検査がいちばん大事。
      預かるときと本棚へ入れるときで判定が食い違うと、
      「受け取りました ✓」と出したのに、会員登録まで済ませた人のデータが入らない
      ＝取り返しがつかない。同じ入力に同じ答えを返すことを突き合わせる。 */
const BADS = [
  [{ ...PEND, airline: null }, '必須項目が足りない'],
  [{ ...PEND, period_month: 13 }, '対象月が13'],
  [{ ...PEND, period_year: 2099 }, '未来の月'],
  [{ ...PEND, period_year: 2010 }, '2015年より前'],
  [{ ...PEND, airline: 'no-such-airline' }, '知らない会社コード'],
  [{ ...PEND, fleet: 'no-such-fleet' }, '知らない機材コード'],
  [{ ...PEND, age_bucket: 'no-such-age' }, '知らない年代コード'],
  [{ ...PEND, airline: 'other', airline_other: null }, '「一覧にない会社」なのに社名が無い'],
  [{ ...PEND, gross_monthly: null }, '金額がどこにも無い'],
  [{ ...PEND, gross_monthly: null, per_diem: 3000 }, '手当だけで基本給も時給も無い'],
];
await asUser(91);
let agree = 0;
for (const [bad, why] of BADS) {
  const j = JSON.stringify(bad);
  const a = await boom(`select submit_pay_report_pending($1::jsonb)`, [j]);
  const b = await boom(`select submit_pay_report($1::jsonb)`, [j]);
  const norm = (s) => String(s || '').replace(/^ERROR:\s*/, '').split('\n')[0].trim();
  if (a && b && norm(a) === norm(b)) agree++;
  else fail++, console.log(`  ❌ ${why} → 預かり:${norm(a) || '通った'} / 本登録:${norm(b) || '通った'}`);
}
ok(agree === BADS.length, `預かりと本登録が同じ入力に同じ答えを返す → ${agree}/${BADS.length}`);

// 8) 大きすぎる入力は量で止める（ログイン不要の口なので）
ok(/入力の形式が不正/.test(
     await boom(`select submit_pay_report_pending($1::jsonb)`,
       [JSON.stringify({ ...PEND, job_role: 'x'.repeat(30000) })]) || ''),
   '20KB を超える入力は預からない');

// 9) 置き場そのものの守り
const pgrants = await rows(`select grantee, privilege_type from information_schema.role_table_grants
  where table_schema='public' and table_name='pay_reports_pending' and grantee in ('anon','authenticated')`);
ok(pgrants.length === 0, `anon/authenticated に置き場の直接権限が無い → ${pgrants.length} 件`);
const ppol = await rows(`select policyname from pg_policies
  where schemaname='public' and tablename='pay_reports_pending'`);
ok(ppol.length === 0, `置き場にポリシーが1本も無い → ${ppol.length} 本`);
ok((await one(`select relrowsecurity r from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='pay_reports_pending'`)).r === true, '置き場の RLS が有効');
const pcols = (await rows(`select column_name c from information_schema.columns
  where table_schema='public' and table_name='pay_reports_pending'`)).map((x) => x.c);
ok(!pcols.includes('user_id') && !pcols.includes('email') && !pcols.includes('ip'),
   `置き場に個人へつながる列が無い → ${pcols.join(',')}`);

// 10) 古い預かりは移さない（忘れた頃に履歴へ入るのは事故）
await db.exec(`set role anon`);
const old = (await pend({ ...PEND, period_month: 3 })).r;
await db.exec(`reset role`);
await db.query(`update pay_reports_pending set created_at = now() - interval '31 days' where claim_token=$1`,
  [old.claim_token]);
await asUser(92);
const tooOld = (await one(`select claim_pending_report($1) r`, [old.claim_token])).r;
ok(tooOld.ok === false, '30日を過ぎた預かりは移さない');
/* ★「切れた」と「無い」を分ける。画面は expired を「もう受け取れません」と
   言い切れるが、not_found のままだと同じ文言が別端末の預かり証にも出る。 */
ok(tooOld.reason === 'expired', '★30日を過ぎた預かりは expired と答える（not_found ではない）',
   JSON.stringify(tooOld));
ok(Number((await one(`select count(*) n from pay_reports_pending where claim_token=$1`,
  [old.claim_token])).n) === 1, '移さなくても行は消さない（データとしては数える）');

/* 11) 同じ回線から「同じ会社・同じ月」をもう一度出したら、弾かずに畳む
   2026-09-01、英語版の給与フォームからカンタスのパイロットが12秒差で同じ月を2回出し、
   置き場に2行できた。表示は ip_day_hash で畳まれるので**見た目は正常**なまま、
   件数（stats.reports / db/usage.mjs）だけが静かに +1 されていた。
   ★ここは本番でしか働かない枝（IP が取れないと通らない）なので、
     この検査だけは x-forwarded-for を自分で立ててから流す。 */
console.log('\n▼ 同じ会社・同じ月の二度押しを畳む');
{
  const IP = '203.0.113.7';
  const withIp = async (ip) =>
    db.query(`select set_config('request.headers', $1, false)`, [JSON.stringify({ 'x-forwarded-for': ip })]);
  const iphOf = async (ip) => (await one(
    `select encode(extensions.digest($1 || '::' || current_date::text,'sha256'),'hex') h`, [ip])).h;

  await withIp(IP);
  const iph = await iphOf(IP);
  const nAt = async (extra) => Number((await one(
    `select count(*) n from pay_reports_pending where ip_day_hash=$1 ${extra}`, [iph])).n);

  const D = { ...PEND, airline: 'qantas', period_year: 2026, period_month: 7 };
  await db.exec(`set role anon`);
  const first = (await pend(D)).r;
  // ★IP が読めない環境なら、この節は成り立たない。先に確かめて、黙って通さない。
  await db.exec(`reset role`);
  const ipWorks = (await one(`select ip_day_hash h from pay_reports_pending where claim_token=$1`,
    [first.claim_token])).h === iph;
  ok(ipWorks, 'PGlite が request.headers を受ける（受けないとこの節は本番を写せない）');

  if (ipWorks) {
    await db.exec(`set role anon`);
    const again = (await pend({ ...D, gross_monthly: 61000 })).r;
    await db.exec(`reset role`);
    ok(again.ok === true && again.claim_token === first.claim_token,
       '二度目は同じ預かり証が返る（新しく発行すると端末の1枚が宙に浮く）', again.claim_token);
    ok(await nAt(`and airline='qantas' and period_month=7`) === 1,
       '同じ会社・同じ月は1行のまま（件数が水増しされない）');
    ok(Number((await one(`select (payload->>'gross_monthly')::int g from pay_reports_pending
                          where claim_token=$1`, [first.claim_token])).g) === 61000,
       '中身は後から出したほうで上書きされる（打ち間違いを直せる）');

    // 月が違えば別の行（＝畳みすぎない）
    await db.exec(`set role anon`);
    const other = (await pend({ ...D, period_month: 8 })).r;
    await db.exec(`reset role`);
    ok(other.claim_token !== first.claim_token && await nAt(`and airline='qantas'`) === 2,
       '月が違えば別の行として残る');

    /* ★「一覧にない会社」は社名まで見る。ここが一番静かに壊れる ──
       見ないと、同じ回線・同じ日の**別々の会社**2件が黙って融合し、
       片方の payload が失われる（いま直している事故と同じ質の損失）。 */
    const O = { ...PEND, airline: 'other', period_year: 2026, period_month: 9 };
    await db.exec(`set role anon`);
    const oa = (await pend({ ...O, airline_other: 'Air Alpha' })).r;
    const ob = (await pend({ ...O, airline_other: 'Air Beta' })).r;
    const oc = (await pend({ ...O, airline_other: '  air alpha ' })).r;
    await db.exec(`reset role`);
    ok(oa.claim_token !== ob.claim_token && await nAt(`and airline='other'`) === 2,
       '「一覧にない会社」は社名が違えば融合しない');
    ok(oc.claim_token === oa.claim_token, '同じ社名なら大文字小文字・前後の空白が違っても同じ行');

    // 引き取り済みの行は書き換えない（本棚と食い違う）
    await db.query(`update pay_reports_pending set claimed_at = now() where claim_token=$1`,
      [first.claim_token]);
    await db.exec(`set role anon`);
    const afterClaim = (await pend(D)).r;
    await db.exec(`reset role`);
    ok(afterClaim.claim_token !== first.claim_token,
       '引き取り済みの行には当てない（新しく預かる）');

    // 1日20件の上限（今まで一度も検査していなかった）
    await db.query(
      `insert into pay_reports_pending (claim_token, payload, airline, period_year, period_month, lang, ip_day_hash)
       select encode(extensions.digest('cap' || g::text, 'sha256'), 'hex'),
              $2::jsonb, 'jal', 2026, 1, 'ja', $1
         from generate_series(1, 20) g`, [iph, JSON.stringify(PEND)]);
    await db.exec(`set role anon`);
    const capped = await boom(`select submit_pay_report_pending($1::jsonb)`,
      [JSON.stringify({ ...PEND, airline: 'ana', period_month: 2 })]);   // ★未来の月にしない
    await db.exec(`reset role`);
    ok(/しばらくしてから/.test(capped || ''), '同じ回線から1日20件を超えると静かに断る', capped);
  }

  // 後片付け。以降の検査に IP を持ち込まない（この枝は本番だけの想定）
  await db.query(`select set_config('request.headers', '', false)`);
  await db.query(`delete from pay_reports_pending where ip_day_hash = $1`, [iph]);
}

// ── オーナーが Supabase に貼る検算そのもの ──────────────────
/* db/pay-reports.verify.sql は「本番に貼って目で見る」ための1枚。
   ここで流しておかないと、関数を増やしたのに検算だけ古いまま＝
   オーナーの画面には ✅ が並ぶのに実際は確かめていない、という形になる。
   （db/test-conditions.mjs が同じことをしている） */
console.log('\n▼ db/pay-reports.verify.sql（オーナーが貼る検算）');
{
  const vr = await rows(read('db/pay-reports.verify.sql'));
  const bad = vr.filter((x) => x['判定'] !== '✅');
  ok(vr.length === 23, `検算は23行（増やしたら CLAUDE.md の行数も直す）→ ${vr.length}`);
  ok(bad.length === 0, '★検算が23行すべて ✅',
     bad.map((x) => `${x['検査']}: 実際 ${x['実際']} / 期待 ${x['期待']}`).join(' | '));
}

// ── オーナーが貼る「保存 → 再取得 → 表示」の通し確認（2026-09-12・指摘4）──
/* db/pay-reports.roundtrip.sql は、列や鍵を足したときにだけ起きる
   「保存はされたが、その鍵だけ黙って消えている」を見るためのもの。
   ★わざと例外を投げて巻き戻す作りなので、ここでも例外が返るのが正常。
   ★ここで流しておかないと、鍵を1つ足したのに確認だけ古いまま＝
     オーナーの画面には ✅ が並ぶのに実際は確かめていない、という形になる。 */
console.log('\n▼ db/pay-reports.roundtrip.sql（オーナーが貼る通し確認）');
{
  /* 本番の auth.uid() は JWT の sub を読む。roundtrip.sql はそれを
     set_config('request.jwt.claims', …) で差し替えるので、ここだけ本番と同じ形にする。 */
  await db.exec(`
    create table if not exists auth.users (id uuid primary key, email text);
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid $$;
  `);
  const OPS = '00000000-0000-4000-8000-0000000000aa';
  await db.query(`insert into auth.users(id,email) values($1,$2) on conflict do nothing`,
                 [OPS, 'info@pilot-value.com']);
  await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`,
                 [OPS, 'info@pilot-value.com']);
  const before = Number((await one(`select count(*) c from pay_reports`)).c);

  let msg = '';
  try { await db.exec(read('db/pay-reports.roundtrip.sql')); }
  catch (e) { msg = String(e.message || e); }

  ok(/これはエラーではありません/.test(msg),
     '★最後まで走って、わざと巻き戻している（途中で落ちていない）', msg.slice(0, 300));
  const marks = (msg.match(/[✅❌]/g) || []);
  ok(marks.length === 20, `判定は20項目（増やしたら CLAUDE.md も直す）→ ${marks.length}`);
  ok(marks.length > 0 && marks.every((m) => m === '✅'),
     '★通し確認が全項目 ✅',
     msg.split('\n').filter((l) => l.indexOf('❌') >= 0).join(' | '));
  /* ★いちばん大事なのはこれ ── 検証用の行が1件も残っていないこと。
     残ると REAL PAY・DEEP PAY・公開集計に混ざる。 */
  const after = Number((await one(`select count(*) c from pay_reports`)).c);
  ok(after === before,
     '★検証用の行が1件も残らない（集計に混ざらない）', `${before} → ${after}`);

  /* 後片付け：auth.uid() をこの検査の前の形（pv.uid を読む）に戻す。 */
  await db.exec(`create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;`);
}

// ── MY PAGE の「編集」── 出した月の1行を本人に返す（db/pay-edit.sql・2026-11-09）──
/* オーナー「編集を押しても二択に行くから編集できない。最後のまとめの一覧に飛んで、そこから編集させればいい」。
   給与フォームはこの1行を欄に戻して確認の段から始める。見るのは ──
   本人には自分の行が内訳の行（pay_items）ごと返る／給与フォームが送る鍵が全部そろう（写し忘れると、編集して送り直した瞬間にその欄が消える）／
   別の会員・違う月・違う会社には null／一覧にない会社も社名の大小・前後の空白をまたいで引ける／未ログインは止まる／
   proof_hash を返さない／貼ったあとの検算が全部 ✅。最後に壊す証明（鍵の式を1文字変えると本人が引けない）。 */
console.log('\n▼ MY PAGE の「編集」── 出した月の1行を本人に返す（db/pay-edit.sql）');
{
  const getOne = async (n, a, o, y, m) => {
    if (n === null) await db.query(`select set_config('pv.uid', '', false)`);
    else await asUser(n);
    return (await one(`select my_pay_report_one($1, $2, $3, $4) j`, [a, o, y, m])).j;
  };
  const ED = { ...BASE, airline: 'finnair', period_year: 2021, period_month: 7, gross_monthly: 61000,
    flight_variable_pay: 3000, other_allowance: 3500, net_pay_actual: 42000, deduction_total: 19000,
    duty_hours: 120.5, night_hours: 14, credit_hours: 90, ytd_taxable: 400000, source: 'payslip',
    pay_items: { v: 2, variable: [{ amount: 3000, basis: 'block', label: 'Flight Pay' }],
                 other: [{ amount: 500, label: 'Meal' }], per_diem_src: 'outside' } };
  await asUser(95);
  ok((await submit(ED)).r.ok === true, '（編集する月を出せた）');
  await asUser(95);
  ok((await submit({ ...BASE, airline: 'other', airline_other: 'Foo Air', period_year: 2021, period_month: 7, gross_monthly: 30000 })).r.ok === true,
     '（一覧にない会社の月も出せた）');

  const mine = await getOne(95, 'finnair', null, 2021, 7);
  const saved = await one(`select * from pay_reports where airline = 'finnair' and period_year = 2021 and period_month = 7`);
  ok(mine && JSON.stringify(mine.pay_items) === JSON.stringify(saved.pay_items) && mine.pay_items.variable?.[0]?.amount === 3000,
     `★本人には内訳の行（pay_items）ごと返る → ${JSON.stringify(mine && mine.pay_items)}`);
  ok(mine && Number(mine.gross_monthly) === 61000 && Number(mine.hourly_rate) === 250 && Number(mine.duty_hours) === 120.5
       && mine.source === 'payslip' && mine.airline === 'finnair' && mine.period_month === 7,
     '　総支給・時給・勤務時間・出どころもそのまま');
  /* 給与フォームが送る鍵（buildPayload）を pay-report.html から読んで突き合わせる（表を写さない）。lang は画面の言語なので外す。 */
  const html = read('pay-report.html');
  const a0 = html.indexOf('function buildPayload('), b0 = html.indexOf('return payload;', a0);
  const sent = [...html.slice(a0, b0).matchAll(/^\s{4}([a-z_]+):/gm)].map((x) => x[1]).filter((k) => k !== 'lang');
  const lack = sent.filter((k) => !(k in (mine || {})));
  ok(sent.length >= 45 && lack.length === 0,
     `★給与フォームが送る鍵 ${sent.length} 個が全部そろう（欠け: ${lack.join(', ') || 'なし'}）`);
  const bad = ['proof_hash', 'id', 'created_at', 'ip_day_hash', 'user_id'].filter((k) => k in (mine || {}));
  ok(mine && bad.length === 0, `★proof_hash・id・時刻を返さない（返していた鍵: ${bad.join(', ') || 'なし'}）`);

  ok((await getOne(96, 'finnair', null, 2021, 7)) === null, '★別の会員が同じ会社・同じ月で呼んでも null（他人の行は返らない）');
  ok((await getOne(95, 'finnair', null, 2021, 8)) === null, '　違う月は null');
  ok((await getOne(95, 'emirates', null, 2021, 7)) === null, '　違う会社は null');
  ok((await getOne(95, 'finnair', 'Foo Air', 2021, 7))?.airline === 'finnair', '　一覧の会社に自由入力が残っていても引ける（送るときと同じく捨てる）');
  const oth = await getOne(95, 'other', '  foo AIR ', 2021, 7);
  ok(oth && oth.airline_other === 'Foo Air' && Number(oth.gross_monthly) === 30000,
     `★一覧にない会社も、社名の大小と前後の空白をまたいで引ける → ${oth && oth.airline_other}`);
  ok((await getOne(95, 'other', 'Bar Air', 2021, 7)) === null, '　別の社名は null');
  ok((await getOne(95, '', null, 2021, 7)) === null && (await getOne(95, 'finnair', null, null, 7)) === null, '　会社か年月が空なら null');

  await db.query(`select set_config('pv.uid', '', false)`);
  const anonMsg = await boom(`select my_pay_report_one('finnair', null, 2021, 7)`);
  ok(anonMsg !== null && /ログインが必要/.test(anonMsg), `★ログインしていなければ止まる → ${anonMsg?.slice(0, 40)}`);
  await db.exec(`set role anon`);
  const anonRole = await boom(`select my_pay_report_one('finnair', null, 2021, 7)`);
  await db.exec(`reset role`);
  ok(anonRole !== null && /permission denied/i.test(anonRole), '★未ログインの役（anon）は関数そのものを呼べない');

  /* 貼ったあとの検算（ファイルの最後の select）がここでも全部 ✅ */
  const res = await db.exec(read('db/pay-edit.sql'));
  const chk = res[res.length - 1].rows;
  ok(chk.length === 12 && chk.every((x) => x['判定'] === '✅'),
     `★db/pay-edit.sql の検算 ${chk.length} 行が全部 ✅`, chk.filter((x) => x['判定'] !== '✅').map((x) => x['#'] + ' ' + x['確かめること']).join(' | '));

  /* ── 壊す証明 ── 鍵の式の「::pv_pay::」を1文字変えた版を begin … rollback の中でだけ入れる（ファイルは触らない）。
     本人が自分の行を引けなくなり、検算5が ❌ になること。 */
  {
    const src = read('db/pay-edit.sql');
    const a = src.indexOf('create or replace function public.my_pay_report_one(');
    const b = a < 0 ? -1 : src.indexOf('\n$$;', a);
    const fn = (a < 0 || b < 0) ? '' : src.slice(a, b + '\n$$;'.length);
    const broken = fn.split(`'::pv_pay::'`).length === 2 ? fn.split(`'::pv_pay::'`).join(`'::pv_pay:'`) : '';
    ok(!!broken, '（鍵の式だけ1文字変えた版を作れた）');
    const tail = src.slice(src.indexOf('-- ── 3. 検算'));
    await db.exec(`begin`);
    await db.exec(broken);
    const red = await getOne(95, 'finnair', null, 2021, 7);
    const redChk = (await db.exec(tail)).pop().rows.find((x) => Number(x['#']) === 5)?.['判定'];
    await db.exec(`rollback`);
    ok(red === null && redChk === '❌', `★壊す証明：鍵の式を1文字変えると本人が引けず、検算5が ❌ → ${red === null ? 'null' : '引けた'} / ${redChk}`);
    ok((await getOne(95, 'finnair', null, 2021, 7))?.period_month === 7, '（巻き戻したら元どおり引ける）');
  }
  await db.query(`select set_config('pv.uid', '', false)`);
}

// ── MY PAGE の「削除」── 本人がその月の1行を消す（db/pay-edit.sql・2026-11-10）──
/* オーナー「自分の給与レポートを削除するところも作って」。オーナー決定：最後の1件を消したら REAL PAY は閉じる。
   見るのは ── 本人の行だけ消える（別の会員の同じ会社・同じ月は残る・別の会員からは消せない）／未ログインは止まる／
   無い月は deleted:false で profiles が1文字も変わらない／残りがあれば鍵と札はそのまま・件数・最新の対象月・継続を残りから作り直す
   （会社をまたいで数える）／最後の1件で鍵を閉じて提出前の形に戻す／返す鍵は4つだけ／検算12行。
   最後に壊す証明 ── 鍵の式を1文字変えると本人の行が消えない／数え直しを外すと、最後の1件を消しても REAL PAY が開いたまま。 */
console.log('\n▼ MY PAGE の「削除」── 本人がその月の1行を消す（db/pay-edit.sql）');
{
  const A = 310, B = 311, V = 312;
  const del = async (n, a, o, y, m) => {
    if (n === null) await db.query(`select set_config('pv.uid', '', false)`);
    else await asUser(n);
    return (await one(`select delete_my_pay_report($1, $2, $3, $4) j`, [a, o, y, m])).j;
  };
  const prof = async (n) => (await one(
    `select to_jsonb(p) - 'email' - 'name' as j from profiles p where id = $1`, [uid(n)])).j;
  const hashOf = (n, a, o) => one(
    `select encode(extensions.digest($1::text || '::pv_pay::' || $2 || coalesce('::' || lower($3), ''), 'sha256'), 'hex') h`,
    [uid(n), a, o || null]).then((x) => x.h);
  const rowsOf = async (n) => {
    const hs = [await hashOf(n, 'finnair'), await hashOf(n, 'other', 'Foo Air')];
    return (await rows(`select airline, period_year * 12 + period_month ym from pay_reports
                         where proof_hash = any($1::text[]) order by 2`, [hs])).map((x) => x.airline + ':' + x.ym);
  };
  const ym = (y, m) => y * 12 + m;
  const D = { ...BASE, airline: 'finnair', gross_monthly: 50000, period_year: 2022 };

  await asUser(A);
  for (const m of [1, 2, 3, 4]) ok((await submit({ ...D, period_month: m })).r.ok === true, `（会員Aが 2022年${m}月を出した）`);
  await asUser(B);
  ok((await submit({ ...D, period_month: 4 })).r.ok === true, '（会員Bも同じ会社・同じ 2022年4月を出した）');
  const pA0 = await prof(A), pB0 = await prof(B);
  ok(pA0.pay_report_count === 4 && pA0.pay_streak_months === 4 && pA0.access_until && pA0.badge === 'contributor',
     `（前提）会員Aは4件・4か月連続・鍵あり → ${pA0.pay_report_count} / ${pA0.pay_streak_months}`);
  /* 数え直しの写し（pv_pay_streak_of）が、submit が順に出したときの数と同じ */
  const st = async (arr) => (await one(`select pv_pay_streak_of($1::int[]) n`, [arr])).n;
  ok((await st([ym(2022, 1), ym(2022, 2), ym(2022, 3), ym(2022, 4)])) === pA0.pay_streak_months,
     '★継続の数え直しは、submit が順に数えた数と同じ（4）');
  ok((await st([ym(2022, 1), ym(2022, 3)])) === 1 && (await st([ym(2022, 3), ym(2022, 1), ym(2022, 2), ym(2022, 2)])) === 3
       && (await st([])) === 0 && (await st(null)) === 0,
     '　間が空けば1・順不同と重複はまとめる・何も無ければ0');

  // 未ログインは止まる
  const anonMsg = await (async () => { await db.query(`select set_config('pv.uid', '', false)`);
    return boom(`select delete_my_pay_report('finnair', null, 2022, 4)`); })();
  ok(anonMsg !== null && /ログインが必要/.test(anonMsg), `★ログインしていなければ止まる → ${anonMsg?.slice(0, 40)}`);
  await db.exec(`set role anon`);
  const anonRole = await boom(`select delete_my_pay_report('finnair', null, 2022, 4)`);
  await db.exec(`reset role`);
  ok(anonRole !== null && /permission denied/i.test(anonRole), '★未ログインの役（anon）は関数そのものを呼べない');
  await db.exec(`set role authenticated`);
  const streakRole = await boom(`select pv_pay_streak_of(array[1,2])`);
  await db.exec(`reset role`);
  ok(streakRole !== null && /permission denied/i.test(streakRole), '　数え直しの道具（pv_pay_streak_of）は会員からも呼べない');

  // 無い月・他人の月 → 何も起きない
  const n0 = await del(A, 'finnair', null, 2022, 9);
  ok(n0 && n0.ok === true && n0.deleted === false && n0.remaining === 4 && n0.closed === false,
     `★無い月は deleted:false → ${JSON.stringify(n0)}`);
  ok(JSON.stringify(await prof(A)) === JSON.stringify(pA0), '　profiles は1文字も変わらない');
  const v1 = await del(V, 'finnair', null, 2022, 1);
  ok(v1.deleted === false && v1.remaining === 0, '★別の会員が会員Aの月を指しても消えない（自分の行が無いので deleted:false）');
  ok((await rowsOf(A)).length === 4, '　会員Aの4件はそのまま');
  ok((await del(A, '', null, 2022, 4)).deleted === false && (await del(A, 'finnair', null, null, 4)).deleted === false,
     '　会社か年月が空なら消さない');

  // 4件のうち最新を消す → 残り3件。鍵と札はそのまま
  const r4 = await del(A, 'finnair', null, 2022, 4);
  ok(r4.deleted === true && r4.remaining === 3 && r4.closed === false, `★本人の行を消せる → ${JSON.stringify(r4)}`);
  ok(JSON.stringify(Object.keys(r4).sort()) === JSON.stringify(['closed', 'deleted', 'ok', 'remaining']),
     `★返す鍵は4つだけ（id・proof_hash を返さない）→ ${Object.keys(r4).join(',')}`);
  ok(JSON.stringify(await rowsOf(A)) === JSON.stringify(['finnair:' + ym(2022, 1), 'finnair:' + ym(2022, 2), 'finnair:' + ym(2022, 3)]),
     '　消えたのはその月の1行だけ');
  ok((await rowsOf(B)).length === 1 && JSON.stringify(await prof(B)) === JSON.stringify(pB0),
     '★別の会員の同じ会社・同じ月の行は残り、その人の profiles も変わらない');
  let pA = await prof(A);
  ok(pA.pay_report_count === 3 && pA.last_pay_period_ym === ym(2022, 3) && pA.pay_streak_months === 3,
     `★件数・最新の対象月・継続を残りから作り直す → ${pA.pay_report_count} / ${pA.last_pay_period_ym} / ${pA.pay_streak_months}`);
  ok(pA.access_until === pA0.access_until && pA.badge === 'contributor' && pA.badge_state === pA0.badge_state
       && pA.pay_day_of_month === pA0.pay_day_of_month && pA.last_pay_report_at === pA0.last_pay_report_at,
     '★残りがあれば鍵（access_until）・札・給料日はそのまま');
  ok(pA.pay_reports_today === pA0.pay_reports_today && pA.pay_reports_day === pA0.pay_reports_day,
     '　1日の上限の数えは触らない（消して出し直すで上限を抜けない）');

  // 真ん中を消す → 間が空いて継続は1
  await del(A, 'finnair', null, 2022, 2);
  pA = await prof(A);
  ok(pA.pay_report_count === 2 && pA.last_pay_period_ym === ym(2022, 3) && pA.pay_streak_months === 1,
     `　真ん中の月を消すと継続は1（1月と3月）→ ${pA.pay_streak_months}`);

  // 別の会社（一覧にない会社）の給与も「残り」に数える
  await asUser(A);
  ok((await submit({ ...D, airline: 'other', airline_other: 'Foo Air', period_month: 6 })).r.ok === true, '（会員Aが一覧にない会社の 2022年6月も出した）');
  const keyNow = (await prof(A)).access_until;   // 出し直すと鍵は「今から90日」へ延びる
  await del(A, 'finnair', null, 2022, 3);
  const r1 = await del(A, 'finnair', null, 2022, 1);
  pA = await prof(A);
  ok(r1.deleted === true && r1.remaining === 1 && r1.closed === false && keyNow && pA.access_until === keyNow,
     `★同じ人のほかの会社の給与が残っていれば閉じない → ${JSON.stringify(r1)}`);
  ok(pA.pay_report_count === 1 && pA.last_pay_period_ym === ym(2022, 6) && pA.pay_streak_months === 1,
     `　件数1・最新の対象月はほかの会社の月 → ${pA.pay_report_count} / ${pA.last_pay_period_ym}`);

  // 最後の1件 → REAL PAY を閉じる（社名の大小・前後の空白をまたいで引ける）
  const rl = await del(A, 'other', '  foo AIR ', 2022, 6);
  pA = await prof(A);
  ok(rl.deleted === true && rl.remaining === 0 && rl.closed === true, `★最後の1件を消すと closed:true → ${JSON.stringify(rl)}`);
  ok(pA.access_until === null, '★★最後の1件を消すと REAL PAY が閉じる（access_until が空）');
  ok(pA.pay_report_count === 0 && pA.pay_streak_months === 0 && pA.last_pay_period_ym === null
       && pA.last_pay_report_at === null && pA.pay_day_of_month === null && pA.badge === 'none' && pA.badge_state === 'none',
     '　件数・継続・最新の対象月・最後に出した日時・給料日・札が提出前の形に戻る', JSON.stringify(pA));
  ok(pA.pay_reports_today === pA0.pay_reports_today + 1, '　1日の上限の数えはそのまま（出した5件ぶん）');
  ok((await rowsOf(A)).length === 0 && (await rowsOf(B)).length === 1, '　会員Aの行は0件・会員Bの行は残る');
  const again = await del(A, 'other', 'Foo Air', 2022, 6);
  ok(again.deleted === false && again.remaining === 0 && again.closed === false, '　もう一度押しても何も起きない（closed は消したときだけ）');

  // verified 以上の札は検証で付いたもの ── 最後の1件を消しても残す
  await asUser(V);
  ok((await submit({ ...D, period_month: 5 })).r.ok === true, '（検証済みの会員が1件出した）');
  await db.query(`update profiles set badge = 'verified' where id = $1`, [uid(V)]);
  const rv = await del(V, 'finnair', null, 2022, 5);
  const pV = await prof(V);
  ok(rv.closed === true && pV.access_until === null && pV.badge === 'verified',
     `★verified の札は残す（給与を出しただけでは付かない札）→ ${pV.badge}`);

  /* 貼ったあとの検算（ファイルの最後の select）── 削除の5行も入って12行が全部 ✅ */
  const src = read('db/pay-edit.sql');
  const tail = src.slice(src.indexOf('-- ── 3. 検算'));
  const chk = (await db.exec(tail)).pop().rows;
  ok(chk.length === 12 && chk.slice(5).every((x) => x['判定'] === '✅'), `★削除の検算（6〜12）が全部 ✅`,
     chk.filter((x) => x['判定'] !== '✅').map((x) => x['#'] + ' ' + x['確かめること']).join(' | '));

  /* ── 壊す証明 ── begin … rollback の中でだけ壊した版を入れる（ファイルは触らない）。 */
  const fnSrc = (() => {
    const a = src.indexOf('create or replace function public.delete_my_pay_report(');
    const b = a < 0 ? -1 : src.indexOf('\n$$;', a);
    return (a < 0 || b < 0) ? '' : src.slice(a, b + '\n$$;'.length);
  })();
  await asUser(A);
  ok((await submit({ ...D, period_month: 8 })).r.ok === true, '（壊す証明のために会員Aがもう1件出した）');
  {
    // (1) 消す行の鍵の式を1文字変える → 本人の行が消えず、検算9が ❌
    const k = `v_uid::text || '::pv_pay::' || v_airline`;
    const broken = fnSrc.split(k).length === 2 ? fnSrc.split(k).join(`v_uid::text || '::pv_pay:' || v_airline`) : '';
    ok(!!broken, '（消す行の鍵の式だけ1文字変えた版を作れた）');
    await db.exec(`begin`);
    await db.exec(broken);
    const red = await del(A, 'finnair', null, 2022, 8);
    const redChk = (await db.exec(tail)).pop().rows.find((x) => Number(x['#']) === 9)?.['判定'];
    const left = (await rowsOf(A)).length;
    await db.exec(`rollback`);
    ok(red.deleted === false && left === 1 && redChk === '❌',
       `★壊す証明：鍵の式を1文字変えると本人の行が消えず、検算9が ❌ → deleted ${red.deleted} / 残り ${left} / ${redChk}`);
  }
  {
    // (2) 数え直しを外す → 最後の1件を消しても REAL PAY が開いたまま（＝閉じているのは数え直し）
    const broken = fnSrc.split('if v_n > 0 then').length === 2 ? fnSrc.split('if v_n > 0 then').join('if false then') : '';
    ok(!!broken, '（数え直しだけ外した版を作れた）');
    await db.exec(`begin`);
    await db.exec(broken);
    const red = await del(A, 'finnair', null, 2022, 8);
    const p = await prof(A);
    await db.exec(`rollback`);
    ok(red.deleted === true && red.remaining === 0 && p.access_until !== null && p.pay_report_count === 1,
       `★壊す証明：数え直しを外すと、最後の1件を消しても REAL PAY が開いたまま（鍵 ${p.access_until ? 'あり' : '空'}・件数 ${p.pay_report_count}）`);
  }
  const fin = await del(A, 'finnair', null, 2022, 8);
  ok(fin.closed === true && (await prof(A)).access_until === null, '（巻き戻したら元どおり、最後の1件で閉じる）');
  await db.query(`select set_config('pv.uid', '', false)`);
}

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
