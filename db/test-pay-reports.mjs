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
                 'db/pay-reports.sql', 'db/pay-report-pending.sql']) {
  try { await db.exec(read(f)); console.log(`  ✅ ${f}`); pass++; }
  catch (e) { console.log(`  ❌ ${f}\n     ${e.message}`); fail++; process.exit(1); }
}

// 2回流しても壊れないこと（冪等）
console.log('\n▼ 冪等性（もう一度そのまま流す）');
for (const f of ['db/airlines.generated.sql', 'db/vocab.generated.sql',
                 'db/pay-reports.sql', 'db/pay-report-pending.sql']) {
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
const N_AIRLINES = Object.keys(SALARY).length + 1;   // SSOT の全社 ＋ other
ok(Number(cnt.a) === N_AIRLINES, `会社 ${N_AIRLINES}（other 込み）→ ${cnt.a}`);
ok(Number(cnt.f) === 19, `機種 19 → ${cnt.f}`);
ok(Number(cnt.p) === 3, `職位 3 → ${cnt.p}`);
/* ★年代は口コミ（submit-review.html）が5歳刻みで先に集めている。こちらは10歳刻み。
   件数がずれたら、どちらかの刻みを動かした合図（gen-vocab.mjs が突き合わせている）。 */
ok(Number(cnt.g) === 5, `年代 5 → ${cnt.g}`);
ok(Number(cnt.c) === 45, `通貨 45 → ${cnt.c}`);
/* ★語彙にある通貨は全部レートを持っていること。2026-08-22 まで7通貨しか無く、
   残り38通貨で出した人は annual_total_usd が null になって集計から黙って外れていた
   （実際にエバー航空の台湾ドルが1件）。ここが 45 未満に戻ったらまた穴が空く。 */
ok(Number(cnt.fx) === 45, `レート 45（fx-rates.mjs 由来。語彙の通貨と同数）→ ${cnt.fx}`);
ok(Number(cnt.fx) === Number(cnt.c), 'レートの無い通貨が1つも無い');

// ── 年換算の定義 ─────────────────────────────────────────────
console.log('\n▼ 年換算の計算');
/* ★第1引数は「その月の額面（総支給）」。内訳を足すときは null を渡す。
   2026-08-12 に引数が12→13本に増えた。古い12本版が残っていると、引数の数で
   新旧どちらが呼ばれるか変わり、同じ入力から違う年収が出るので、本数も見る。 */
const nfn = await one(`select count(*) c from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                        where n.nspname='public' and p.proname='pv_annual_total'`);
ok(Number(nfn.c) === 1, `pv_annual_total は1本だけ（古い12引数版が残っていない）→ ${nfn.c}`);
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
  base_iata: 'DXB', seniority_years: 15, tax_rate_pct: 0, lang: 'en',
  age_bucket: '40-49',
};

console.log('\n▼ 投稿（1人目）');
await asUser(1);
let r = (await submit({ ...BASE, period_year: 2026, period_month: 6 })).r;
ok(r.ok === true, '投稿が通る');
ok(Number(r.annual_total_orig) === 651000, `原本通貨の年換算 AED ${r.annual_total_orig}`);
ok(r.annual_total_usd !== null && Number(r.annual_total_usd) > 0, `USD 換算 $${r.annual_total_usd}`);
ok(Number(r.usd_per_block_hour) > 0, `$/block hour = ${r.usd_per_block_hour}`);
ok(r.benchmark === null, 'n<5 なのでベンチマークを返さない（k≧5 は RPC でも同じ閾値）');

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
ok((await boom(`select submit_pay_report($1::jsonb)`, [JSON.stringify({ ...BASE, fleet: 'b797', period_year: 2026, period_month: 5 })]) || '').includes('機材コード'), '存在しない機種は弾く');
ok((await boom(`select submit_pay_report($1::jsonb)`, [JSON.stringify({ ...BASE, base_pay: null, hourly_rate: null, period_year: 2026, period_month: 5 })]) || '').includes('報酬額'), '金額ゼロの空レポートは弾く');
ok((await boom(`select submit_pay_report($1::jsonb)`, [JSON.stringify({ ...BASE, airline: 'other', period_year: 2026, period_month: 5 })]) || '').includes('社名'), "'other' なのに社名が無ければ弾く");

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
ok(!viewCols.includes('proof_hash'), '公開集計に proof_hash が無い');

// 5人目の投稿にはベンチマークが返る
await asUser(15);
r = (await submit({ ...BASE, base_pay: 25000, period_year: 2026, period_month: 6 })).r;
ok(r.benchmark !== null, `n≧5 になったら投稿の見返りが返る → n=${r.benchmark?.n} / 上位${100 - Number(r.benchmark?.percentile)}%`);

// 自由入力の社名は集計から外れる
console.log('\n▼ 自由入力の社名');
for (let i = 20; i <= 25; i++) {
  await asUser(i);
  await submit({ ...BASE, airline: 'other', airline_other: 'Some Charter Co', base_pay: 20000, period_year: 2026, period_month: 6 });
}
bm = await rows(`select * from pay_benchmarks where airline='other'`);
ok(bm.length === 0, `airline_other は6件あっても集計に出ない → ${bm.length} 行`);

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
await asUser(42);
r = (await submit({ ...BASE, gross_monthly: 54250, airline: 'lufthansa', period_year: 2026, period_month: 7 })).r;
ok(Number(r.annual_total_orig) === 651000, `内訳が付いてきても年換算は総支給が正 → ${r.annual_total_orig}`);
const both = await one(`select * from pay_reports where airline='lufthansa' and period_month=7`);
ok(Number(both.gross_monthly) === 54250 && Number(both.base_pay) === BASE.base_pay
   && Number(both.hourly_rate) === BASE.hourly_rate,
  `総支給と内訳が両方残る → ${both.gross_monthly} / ${both.base_pay} / ${both.hourly_rate}`);
ok(Number(both.per_diem) === 3000 && Number(both.housing_amount) === 10000,
  `パーディアムと住宅手当は総支給と一緒でも残る → ${both.per_diem} / ${both.housing_amount}`);

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
  airline: 'zipair', period_year: 2026, period_month: 6,
})).r;
ok(Number(r.annual_total_orig) === 651000,
   `年換算は（総支給 − 今月のボーナス）×12 → ${r.annual_total_orig}`);
let st = await one(`select * from pay_reports where airline='zipair' and period_month=6`);
ok(Number(st.stay_nights) === 12 && Number(st.bonus_month) === 10000,
   `2列とも保存される → ステイ${st.stay_nights}泊 / 今月のボーナス${st.bonus_month}`);

// 同じ月を出し直したら上書きされること（on conflict の取りこぼしが起きていないか）
await submit({
  ...BASE, base_pay: null, hourly_rate: null,
  gross_monthly: 54250, bonus_month: 0, stay_nights: 0,
  airline: 'zipair', period_year: 2026, period_month: 6,
});
st = await one(`select * from pay_reports where airline='zipair' and period_month=6`);
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
ok(readable === null, 'anon は公開集計を読める');
const rpcDenied = await boom(`select submit_pay_report('{}'::jsonb)`);
ok(rpcDenied !== null && /permission denied/i.test(rpcDenied), 'anon は投稿 RPC を呼べない');
await db.exec(`reset role`);

const vopt = await one(`select reloptions o from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='pay_benchmarks'`);
ok(!String(vopt.o || '').includes('security_invoker'),
  `ビューは所有者権限で走る（security_invoker を立てていない）→ ${vopt.o || 'なし'}`);

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

// 4) 二度押し・再読み込みでも二重に入らない
const twice = (await one(`select claim_pending_report($1) r`, [held.claim_token])).r;
ok(twice.ok === false && twice.reason === 'not_found', '同じ預かり証の2回目は静かに空振りする');
ok(Number((await one(`select count(*) n from pay_reports where airline='jal' and period_month=4`)).n) === 1,
   '二度押ししても本棚の行は1本のまま');
// 移した行も消さない（出したのに会員にならなかった人を数えるための分母）
ok((await one(`select claimed_at c from pay_reports_pending where claim_token=$1`, [held.claim_token])).c !== null,
   '移したあとも置き場に行が残る（claimed_at が入る）');

// 5) 知らない預かり証は例外にしない（利用者に見せる異常ではない）
const nosuch = (await one(`select claim_pending_report($1) r`, ['0'.repeat(48)])).r;
ok(nosuch.ok === false && nosuch.reason === 'not_found', '知らない預かり証はエラーにせず空振り');

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
ok(Number((await one(`select count(*) n from pay_reports_pending where claim_token=$1`,
  [old.claim_token])).n) === 1, '移さなくても行は消さない（データとしては数える）');

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
