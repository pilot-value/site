/* db/deep-pay.sql を本物の Postgres（PGlite = PG17 の WASM ビルド）に流して確かめる。

   実行: node db/test-deep-pay.mjs
   ネットワーク不要・本番に一切触らない。SQL を直したら必ずこれを通してから
   オーナーに実行を依頼すること。

   器は db/test-pay-rows.mjs と同じ。既定権限を先に全付与してあるからこそ
   deep-pay.sql の revoke が意味を持つ。無いと「元から権限が無いだけ」を
   「revoke が効いた」と誤読する。

   ★DEEP PAY は REAL PAY より深い画面。だからこのファイルが見ているのは
     「数字が合うか」より先に **「合わない数字を出さないか」**。
     落ちたら画面を作ってはいけない本命は6本：

       ・区分のはしごが、人数を数えた段と実際に集めた段でずれないこと
       ・列ごと・項目ごとにも n≧3 が掛かること（3人の区分で1人しか書いていない列）
       ・同じ人の複数月が1人に畳まれること
       ・変動給とその他手当を二重に数えないこと（両方の列に同じ額が写っている）
       ・返り値の文字列に準識別子が1語も無いこと
       ・pv_pay_comp が20引数のまま、誰にも開いていないこと

   ★db/pay-rows.sql 側の検査（db/test-pay-rows.mjs）に deep-pay.sql を足さないこと。
     足すと DEEP PAY のバグで REAL PAY の検査が赤くなり、どちらが壊れたのか
     分からなくなる。
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

  create table public.reviews_v2 (
    id         uuid primary key default gen_random_uuid(),
    proof_hash text not null,
    airline    text not null,
    "position" text,
    annual_salary            integer,
    base_annual              integer,
    flight_allowance_annual  integer,
    monthly_salary           integer,
    bonus                    integer,
    created_at timestamptz not null default now()
  );
`);

// ── 適用（順番も含めて本番と同じ手順）────────────────────────
const FILES = ['db/airlines.generated.sql', 'db/vocab.generated.sql',
               'db/pay-reports.sql', 'db/pay-report-pending.sql', 'db/pay-rows.sql',
               'db/deep-pay.sql'];

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

const submit = async (payload) => {
  const r = await one(`select submit_pay_report($1::jsonb) r`, [JSON.stringify(payload)]);
  await db.query(`update profiles set pay_reports_today = 0`);
  return r;
};

const YEAR = new Date().getFullYear() - 1;
const BASE = { currency: 'USD', lang: 'en', tax_rate_pct: 0 };

/* 1人ぶん作る。months = [{month, ...列}]。既定の内訳は
   固定9000 / 変動4000 / 職位2000 / パーディアム1000 / 住宅600 / その他400 = 17000。
   総支給を入れないので、cash_m は内訳の合計になり、割合が手で読める。

   ★other_allowance = 変動給 + その他（4000 + 400 = 4400）。
     これは本番の形。pay-report.html が「変動給の合計」を flight_variable_pay に、
     「変動給＋その他の合計」を other_allowance に入れて送る
     （db/pay-reports.sql:839 のコメント）。pv_annual_total は
     flight_variable_pay を足さず other_allowance だけを足すので、
     この関係を崩したテストデータを作ると年収が本番と違う値になる。 */
let seat = 2000;
const DET = { base_pay: 9000, flight_variable_pay: 4000, other_allowance: 4400,
              command_pay: 2000, per_diem: 1000,
              housing_type: 'allowance', housing_amount: 600 };
const person = async (air, pos, fleet, months, extra = {}) => {
  const u = ++seat;
  await asUser(u);
  for (const m of months) {
    await submit({ ...BASE, airline: air, position: pos, fleet,
                   period_year: YEAR, period_month: m.month ?? 2,
                   ...DET, ...extra, ...m });
  }
  return u;
};

/* 引数なしで呼ぶと今までどおり「呼び手自身の区分」。
   オブジェクトを渡すと、その区分を手で選んだ形になる。 */
const deep = async (sel) =>
  (await one(`select pv_deep_pay($1::jsonb) r`, [JSON.stringify(sel || {})])).r;
const give = async () => (await one(`select pv_my_give() g`)).g;
const openKey = (n) => db.query(
  `insert into profiles(id,email,access_until) values($1,$2, now() + interval '90 days')
     on conflict (id) do update set access_until = excluded.access_until`,
  [uid(n), `p${n}@example.com`]);

const VOCAB = await rows(
  `select code from pv_airlines where code <> 'other' and active order by code limit 20`);
const AIR = VOCAB.map(r => r.code);
const [A_HOME, A_CAT, A_FILL1, A_FILL2, A_FILL3, A_OTHER1, A_DUP, A_BAND,
       A_ROUND, A_DOUBLE, A_REST, A_BASIS, A_NWH, A_WORK, A_SIG,
       A_PEER, A_PEND, A_RV, A_BONUS, A_SPARE] = AIR;

// 呼び手（オーナー役）。この人の最新の1行が区分を決める。
const V = 9500;

// ════════════════════════════════════════════════════════════
console.log('\n▼ 1. 権限（誰が呼べるか）');
// ════════════════════════════════════════════════════════════
await asAnon();
ok(/ログイン/.test(await boom(`select pv_deep_pay()`) || ''),
   'ログインしていない人は呼べない');
ok(!(await one(`select has_function_privilege('anon','public.pv_deep_pay(jsonb)','execute') b`)).b,
   'anon に execute が渡っていない');
ok((await one(`select has_function_privilege('authenticated','public.pv_deep_pay(jsonb)','execute') b`)).b,
   'ログインした人には execute が渡っている');
for (const f of ['public.pv_my_keys()', 'public.pv_deep_pct(numeric[])']) {
  const r = await one(
    `select has_function_privilege('anon',$1,'execute') a,
            has_function_privilege('authenticated',$1,'execute') u`, [f]);
  ok(!r.a && !r.u, `★${f} は anon にも authenticated にも開いていない`);
}
ok((await one(`select prosecdef b from pg_proc where oid='public.pv_deep_pay(jsonb)'::regprocedure`)).b,
   'security definer で動く');
ok((await one(`select pronargs n from pg_proc where oid='public.pv_deep_pay(jsonb)'::regprocedure`)).n === 1,
   '★受け取る引数は jsonb 1つだけ');
/* ★引数には既定値があるので、引数なしの `pv_deep_pay()` も今までどおり通る。
   （上の1本目が「ログインしていない」で落ちている＝関数自体は見つかっている証拠。
   「関数が無い」で落ちていたら後方互換が切れている。） */
ok(!/does not exist|存在しません/.test(await boom(`select pv_deep_pay()`) || ''),
   '★引数なしでも今までどおり呼べる（後方互換）');
/* ★引数ゼロだった頃の関数が残っていないこと。残っていると、古い画面が
   そちらを呼び続けて「選べないほうの DEEP PAY」が生き残る。 */
ok(Number((await one(`select count(*) n from pg_proc where proname='pv_deep_pay'`)).n) === 1,
   '★pv_deep_pay は1本だけ（引数ゼロの旧版が残っていない）');

// ════════════════════════════════════════════════════════════
console.log('\n▼ 2. 門（鍵と、本人が内訳を出したか）');
// ════════════════════════════════════════════════════════════
// (a) 1枚も出していない人：鍵も内訳も無い
await asUser(9501);
{
  const d = await deep();
  ok(d.state === 'locked', '一度も出していない人は locked');
  ok(d.cohort === null && d.head === null && d.comp === null && d.work === null && d.var === null,
     '★locked のときは中身のキーが全部 null（隠すのではなく渡さない）');
  ok(d.gate && d.gate.key === false && d.gate.detailed === false,
     'どちらの門が閉じているかは返す（画面が「何を出せば開くか」を言える）');
  ok(typeof d.stats.contributors === 'number',
     '人数だけは鍵が無くても返す（Give の誘いに使う）');
}

// (b) 内訳は出したが鍵が切れている
//     ★出した瞬間は鍵が付く（db/pay-reports.sql:1114 が access_until を伸ばす＝
//       Give → Get の本体）。だから「鍵が無い」のは 90日たって切れた人だけ。
//       ここで手で切らすのは、その日の状態を先に見ておくため。
const uNoKey = await person(A_FILL1, 'cap', 'b777', [{ month: 2 }]);
{
  ok((await give()).detailed === true, '内訳を出したので detailed は true');
  ok((await deep()).gate.key === true, '出した瞬間に鍵が付く（Give → Get）');
  await db.query(`update profiles set access_until = now() - interval '1 day' where id = $1`,
                 [uid(uNoKey)]);
  const d = await deep();
  ok(d.state === 'locked' && d.gate.detailed === true && d.gate.key === false,
     '★90日たって鍵が切れたら、内訳を出した人でも locked',
     JSON.stringify(d.gate) + ' ' + d.state);
  ok(d.cohort === null && d.comp === null,
     '★鍵が切れた人には中身を渡さない（前に見えていたものも残さない）');
}

// (c) 鍵はあるが内訳が無い（かんたん入力だけ）
const uNoDet = ++seat;
await asUser(uNoDet);
await submit({ ...BASE, airline: A_FILL2, position: 'cap', fleet: 'b777',
               period_year: YEAR, period_month: 2, gross_monthly: 15000 });
await openKey(uNoDet);
await asUser(uNoDet);
{
  const d = await deep();
  ok(d.gate.key === true && d.gate.detailed === false && d.state === 'locked',
     '★鍵があっても内訳を出していなければ locked（JS だけの門を SQL に降ろした）');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 3. 区分のはしご');
// ════════════════════════════════════════════════════════════
// 呼び手は A_HOME / fo / a320。このファイルの間ずっとこの1行だけを持つ。
await asUser(V);
await submit({ ...BASE, airline: A_HOME, position: 'fo', fleet: 'a320',
               period_year: YEAR, period_month: 6, ...DET });
await openKey(V);
await asUser(V);
ok((await deep()).state === 'open', '鍵と内訳がそろえば open');

// 全体の頭数を3人以上にしておく（段5が成立する状態）
await person(A_FILL3, 'cap', 'b787', [{ month: 3 }]);
await person(A_FILL3, 'cap', 'b787', [{ month: 4 }]);
await asUser(V);
{
  const d = await deep();
  ok(d.cohort.level === 'all',
     '★自分だけの会社・役職では段が全部落ちて「全体」になる', d.cohort.level);
  ok(d.cohort.airline === A_HOME && d.cohort.pos === 'fo' && d.cohort.fleet === 'a320',
     '★落ちた段でも、返す会社・役職・機材は呼び手自身の値');
}

// 同じ会社・同じ役職・違う機材（a321 は無いので b737 = 同じ n 区分）を2人
await person(A_HOME, 'fo', 'b737', [{ month: 3 }]);
await person(A_HOME, 'fo', 'b737', [{ month: 4 }]);
await asUser(V);
ok((await deep()).cohort.level === 'airline_pos_cat',
   '★同じ機材区分（narrowbody）で3人そろえば段2');

// 同じ会社・同じ役職・広胴を1人足すと、機材区分では届かないが会社×役職では届く
await person(A_HOME, 'fo', 'b777', [{ month: 5 }]);
await asUser(V);
ok((await deep()).cohort.level === 'airline_pos_cat',
   '段2が成立している間は、より広い段へ行かない');

// 同じ機材（a320）を2人足すと段1
await person(A_HOME, 'fo', 'a320', [{ month: 3 }]);
await person(A_HOME, 'fo', 'a320', [{ month: 4 }]);
await asUser(V);
{
  const d = await deep();
  ok(d.cohort.level === 'airline_pos_fleet', '★同じ機材で3人そろえば段1に戻る');
  ok(d.cohort.n === 3, '★段1の人数はちょうど3（呼び手を含む）', String(d.cohort.n));
  ok(d.head.detailed_n === 3, '詳細投稿数は区分の人数と同じ');
}

// ★数えた段と集めた段がずれないこと
{
  const d = await deep();
  const lv = await one(`select count(*) n from (
      select proof_hash from pay_reports
       where airline = $1 and "position" = 'fo' and fleet = 'a320'
       group by proof_hash) z`, [A_HOME]);
  ok(Number(lv.n) === d.cohort.n,
     '★はしごが数えた人数と、実際にその段に居る人数が一致する', `${lv.n} vs ${d.cohort.n}`);
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 3-b. 手で選んだ区分（2026-08-30）');
// ════════════════════════════════════════════════════════════
/* いまの並び ── 呼び手 V は A_HOME / fo / a320。
     A_HOME fo a320 … 3人（V を含む）
     A_HOME fo b737 … 2人
     A_HOME fo b777 … 1人
     A_FILL3 cap b787 … 2人
   ★ここで見たいのは「選べること」ではなく、**選んでも壁が動かないこと**。 */
await asUser(V);
{
  const d = await deep({ airline: A_HOME, position: 'fo', fleet: 'a320' });
  ok(d.cohort.level === 'selected', '選んだ区分は selected として返る', d.cohort.level);
  ok(d.cohort.manual === true, '手で選んだことが分かる（manual）');
  ok(d.cohort.airline === A_HOME && d.cohort.pos === 'fo' && d.cohort.fleet === 'a320',
     '選んだ値がそのまま返る');
  ok(d.cohort.n === 3, '人数は選んだ区分の人数', String(d.cohort.n));
}
{
  /* ★本命。2人しか居ない区分を選んでも、広い区分に落として
     その見出しのまま数字を出さないこと。 */
  const d = await deep({ airline: A_HOME, position: 'fo', fleet: 'b737' });
  ok(d.cohort.level === 'none', '★3人に届かない区分は none（はしごを登らない）', d.cohort.level);
  ok(d.cohort.n === 0, '★人数は0（広い区分の人数を出さない）', String(d.cohort.n));
  ok(d.head.annual_usd === null, '★年収も出ない（全体の数字が漏れない）',
     String(d.head.annual_usd));
  ok(d.comp === null && d.work.block_h === null && (d.var || []).length === 0,
     '★給与構成・働き方・変動給も出ない');
}
{
  const d = await deep({ airline: 'zzzz-not-an-airline', position: 'fo' });
  ok(d.cohort.level === 'none', '★語彙に無い会社は none（広い区分に読み替えない）',
     d.cohort.level);
  ok(d.cohort.airline === null, '★語彙に無い値は echo もしない');
  ok(d.head.annual_usd === null, '★語彙に無い会社で全体の数字が出ない');
}
{
  const d = await deep({ airline: 'other' });
  ok(d.cohort.level === 'none', "★自由入力の社名（other）は選べない", d.cohort.level);
}
{
  const d = await deep({ position: 'zzz' });
  ok(d.cohort.level === 'none', '★語彙に無い役職も none');
}
{
  /* 会社を選ばずに役職だけ。段4と同じ広さ。 */
  const d = await deep({ position: 'fo' });
  ok(d.cohort.level === 'selected', '役職だけでも選べる', d.cohort.level);
  ok(d.cohort.airline === null, '会社を選んでいないので会社は null');
  const n = await one(`select count(*) n from (
      select proof_hash from pay_reports where "position" = 'fo'
       group by proof_hash) z`);
  ok(Number(n.n) === d.cohort.n, '数えた人数と実際の人数が一致する',
     `${n.n} vs ${d.cohort.n}`);
}
{
  /* ★自分が居ない会社を選んでも、自分の区分の数字が出ないこと。 */
  await person(A_FILL3, 'cap', 'b787', [{ month: 5 }]);   // 2人 → 3人
  await asUser(V);
  const mine = await deep();
  const other = await deep({ airline: A_FILL3, position: 'cap', fleet: 'b787' });
  ok(other.cohort.level === 'selected' && other.cohort.airline === A_FILL3,
     '★自分が居ない会社の区分も、3人そろっていれば見られる');
  ok(other.cohort.n === 3, '人数はその会社の人数', String(other.cohort.n));
  ok(mine.cohort.airline === A_HOME && mine.cohort.manual === false,
     '★選ばずに呼べば、今までどおり自分の区分に戻る');
}
{
  const a = await deep(), b = await deep({});
  ok(JSON.stringify(a) === JSON.stringify(b),
     '★空のオブジェクトは「選んでいない」と同じ（後方互換）');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 4. 1行＝1人（約束④）');
// ════════════════════════════════════════════════════════════
{
  const before = (await deep()).cohort.n;
  const u = await person(A_HOME, 'fo', 'a320',
    [{ month: 7 }, { month: 8 }, { month: 9 }, { month: 10 }, { month: 11 }, { month: 12 }]);
  await asUser(V);
  const after = (await deep()).cohort.n;
  ok(after === before + 1,
     '★同じ人の6か月ぶんは1人としてしか数えない', `${before} → ${after}`);
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 5. 給与構成（割合・合計ちょうど100）');
// ════════════════════════════════════════════════════════════
{
  const d = await deep();
  const segs = d.comp.segs;
  const sum = segs.reduce((a, s) => a + s.pct, 0);
  ok(sum === 100, '★構成比の合計はちょうど100', String(sum));
  ok(segs.every(s => s.pct > 0), '★0% の区分は1つも並んでいない（0 を印字しない）');
  ok(segs.every(s => Number.isInteger(s.pct)), '構成比は整数');
  ok(d.comp.total_kind === 'monthly_cash', '構成の分母は「その月の現金」');
  const k = segs.map(s => s.k);
  ok(new Set(k).size === k.length, '同じ区分が二度出てこない');
  ok(k.every(x => ['fixed','variable','command','role','perdiem','housing','other','rest'].includes(x)),
     '区分の名前は決めた8つだけ', JSON.stringify(k));
  // 固定9000 / 17000 ≒ 53%
  const f = segs.find(s => s.k === 'fixed');
  ok(f && f.pct >= 50 && f.pct <= 56, '★固定・保証給は約53%（9000 / 17000）', JSON.stringify(f));
  const v = segs.find(s => s.k === 'variable');
  ok(v && v.pct >= 21 && v.pct <= 26, '★変動給は約24%（4000 / 17000）', JSON.stringify(v));
  ok(d.head.fixed_pct !== null && d.head.fixed_pct > 0 && d.head.fixed_pct < 100,
     '固定・保証給比率は 0 でも 100 でもない', String(d.head.fixed_pct));
  const cmd = segs.find(s => s.k === 'command'), hou = segs.find(s => s.k === 'housing');
  const rol = segs.find(s => s.k === 'role');
  ok(d.head.fixed_pct === f.pct + (cmd ? cmd.pct : 0) + (rol ? rol.pct : 0),
     '★固定・保証給比率＝固定＋職位＋役割（配列と食い違わない）',
     `${d.head.fixed_pct} vs ${f.pct}+${cmd ? cmd.pct : 0}+${rol ? rol.pct : 0}`);
  /* ★住宅手当は固定側に入らない（2026-09-01・オーナー確定）。
     住宅手当は働きに対する報酬ではなく住居の補填で、現物の社宅を出す会社では
     同じ待遇でも 0 になる。混ぜると会社どうしの比較が成り立たない。
     この見本は住宅手当を持っているので、足した数と**一致しないこと**が意味を持つ。 */
  ok(hou && hou.pct > 0, '（この見本には住宅手当が在る）', JSON.stringify(hou));
  ok(d.head.fixed_pct !== f.pct + (cmd ? cmd.pct : 0) + (rol ? rol.pct : 0) + hou.pct,
     '★固定・保証給比率に住宅手当は入っていない',
     `${d.head.fixed_pct} / 住宅を足すと ${f.pct + (cmd ? cmd.pct : 0) + (rol ? rol.pct : 0) + hou.pct}`);

  // ── 月額（中央値）── 画面の3列目。割合の「おまけ」。
  ok(segs.every(s => 'med_usd' in s), 'どの区分にも med_usd のキーが在る');
  ok(Number(f.med_usd) > 0, '★固定・保証給の月額（USD）が出ている', String(f.med_usd));
  ok(Number(v.med_usd) > 0 && Number(v.med_usd) < Number(f.med_usd),
     '変動給の月額は固定給より小さい', `${v.med_usd} vs ${f.med_usd}`);
  ok(segs.every(s => s.med_usd == null
                  || String(Math.round(Number(s.med_usd))).replace(/0+$/, '').length <= 2),
     '★月額も有効数字2桁', JSON.stringify(segs.map(s => s.med_usd)));
  // 賞与ぬきの現金なので、月額の合計は「年収 ÷ 12」を超えない
  const amt = segs.reduce((a, s) => a + Number(s.med_usd || 0), 0);
  ok(amt > 0 && amt <= Number(d.head.annual_usd) / 12 * 1.3,
     '★月額の合計が年収の月割りとかけ離れていない', `${Math.round(amt)} vs ${Math.round(d.head.annual_usd / 12)}`);
}

// ★項目ごとの n≧3。3人の区分のうち1人しか書いていない列は出さない。
{
  // 呼び手の区分（A_HOME/fo/a320）に、教官手当を1人だけ書いた人を入れても
  // role は出ない（3人未満）
  const segsBefore = (await deep()).comp.segs.map(s => s.k);
  ok(!segsBefore.includes('role'),
     '★役割手当を誰も書いていないので role の区分は無い', JSON.stringify(segsBefore));
  await person(A_HOME, 'fo', 'a320', [{ month: 5, instructor_pay: 3000 }]);
  await asUser(V);
  const segsAfter = (await deep()).comp.segs.map(s => s.k);
  ok(!segsAfter.includes('role'),
     '★1人だけが書いた役割手当は区分として出さない（0 でも並べない）',
     JSON.stringify(segsAfter));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 6. 二重計上（変動給とその他手当）');
// ════════════════════════════════════════════════════════════
/* db/pay-reports.sql は pay_items.variable の合計を flight_variable_pay と
   other_allowance の両方に写す。素直に足すと変動給を2回数える。 */
{
  const uD = ++seat; await asUser(uD);
  await submit({ ...BASE, airline: A_DOUBLE, position: 'cadet', fleet: 'a320',
                 period_year: YEAR, period_month: 2,
                 base_pay: 10000, flight_variable_pay: 5000, other_allowance: 5000,
                 pay_items: { v: 1, variable: [{ amount: 5000, basis: 'block', label: 'Flight' }] } });
  const r = await one(
    `select flight_variable_pay f, other_allowance o, annual_total_usd a
       from pay_reports where airline = $1`, [A_DOUBLE]);
  ok(Number(r.f) === 5000 && Number(r.o) === 5000,
     '前提：同じ5000が両方の列に入っている（本番と同じ形）', JSON.stringify(r));
  // 手計算：現金 = 10000(固定) + 5000(変動) + 0(その他) = 15000。
  // その他は greatest(5000 - 5000, 0) = 0 なので変動は1回しか数えない。
  const u2 = await person(A_DOUBLE, 'cadet', 'a320', [{ month: 3 }], {
    base_pay: 10000, flight_variable_pay: 5000, other_allowance: 5000,
    command_pay: null, per_diem: null, housing_type: null, housing_amount: null,
    pay_items: { v: 1, variable: [{ amount: 5000, basis: 'block', label: 'Flight' }] } });
  const u3 = await person(A_DOUBLE, 'cadet', 'a320', [{ month: 4 }], {
    base_pay: 10000, flight_variable_pay: 5000, other_allowance: 5000,
    command_pay: null, per_diem: null, housing_type: null, housing_amount: null,
    pay_items: { v: 1, variable: [{ amount: 5000, basis: 'block', label: 'Flight' }] } });
  await openKey(uD); await asUser(uD);
  const d = await deep();
  ok(d.cohort.level === 'airline_pos_fleet' && d.cohort.n === 3,
     '二重計上の検査用に3人そろった', JSON.stringify(d.cohort));
  const f = d.comp.segs.find(s => s.k === 'fixed');
  const v = d.comp.segs.find(s => s.k === 'variable');
  const o = d.comp.segs.find(s => s.k === 'other');
  ok(f && f.pct === 67 && v && v.pct === 33,
     '★固定67% / 変動33%（10000:5000）。同じ5000を2回数えていない',
     JSON.stringify(d.comp.segs));
  ok(!o, '★その他手当は0なので区分ごと出てこない', JSON.stringify(o));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 7. 未分類（総支給に届かない分を吸う）');
// ════════════════════════════════════════════════════════════
{
  const mk = (m) => ({ ...BASE, airline: A_REST, position: 'cadet', fleet: 'b737',
                       period_year: YEAR, period_month: m,
                       gross_monthly: 10000, base_pay: 6000 });
  const uR = ++seat; await asUser(uR); await submit(mk(2));
  const u2 = ++seat; await asUser(u2); await submit(mk(3));
  const u3 = ++seat; await asUser(u3); await submit(mk(4));
  await openKey(uR); await asUser(uR);
  const d = await deep();
  const f = d.comp.segs.find(s => s.k === 'fixed');
  const rest = d.comp.segs.find(s => s.k === 'rest');
  ok(f && f.pct === 60, '★固定は60%（6000 / 10000）', JSON.stringify(f));
  ok(rest && rest.pct === 40,
     '★残り40%は未分類。0 として消さず、他の区分へ配りもしない', JSON.stringify(rest));
  ok(rest.med_usd == null,
     '★畳んだ区分があるとき、未分類の月額は出さない（割合と桁が合わないため）',
     String(rest.med_usd));
  ok(Number(f.med_usd) > 0, '固定給の月額は出る', String(f.med_usd));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 8. 働き方（列ごとに n≧3）');
// ════════════════════════════════════════════════════════════
{
  // 3人。block_hours は3人とも、duty_days は1人だけ書く。
  const mk = (m, extra) => ({ ...BASE, airline: A_WORK, position: 'cadet', fleet: 'b767',
                              period_year: YEAR, period_month: m, ...DET,
                              block_hours: 70, ...extra });
  const uW = ++seat; await asUser(uW); await submit(mk(2, { duty_days: 18 }));
  const w2 = ++seat; await asUser(w2); await submit(mk(3, {}));
  const w3 = ++seat; await asUser(w3); await submit(mk(4, {}));
  await openKey(uW); await asUser(uW);
  const d = await deep();
  ok(d.work.block_h !== null && Number(d.work.block_h) === 70,
     '★3人が書いた Block Hours は出る', String(d.work.block_h));
  ok(d.work.duty_days === null,
     '★1人しか書いていない Duty Days は null（その1人の実数を「中央値」と名乗らない）',
     String(d.work.duty_days));
  ok(d.work.duty_h === null && d.work.stay_nights === null,
     '誰も書いていない列も null（0 にしない）');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 9. 変動給の中身（区分ごとに n≧3・まとめない）');
// ════════════════════════════════════════════════════════════
{
  const items = (extra = []) => ({ v: 1, variable: [
    { amount: 3000, basis: 'block',   label: 'Flight Pay' },
    { amount: 1000, basis: 'night',   label: 'Night' },
    ...extra ] });
  const mk = (m, extra) => ({ ...BASE, airline: A_NWH, position: 'cadet', fleet: 'b787',
                              period_year: YEAR, period_month: m,
                              base_pay: 8000, flight_variable_pay: 4000 + (extra.add || 0),
                              other_allowance: 4000 + (extra.add || 0),
                              pay_items: items(extra.rows || []) });
  const uN = ++seat; await asUser(uN);
  await submit(mk(2, { add: 500, rows: [{ amount: 500, basis: 'weekend', label: 'Weekend' }] }));
  const n2 = ++seat; await asUser(n2); await submit(mk(3, {}));
  const n3 = ++seat; await asUser(n3); await submit(mk(4, {}));
  await openKey(uN); await asUser(uN);
  const d = await deep();
  const ks = d.var.map(x => x.k);
  ok(ks.includes('block') && ks.includes('night'),
     '★3人が書いた区分は出る（block と night）', JSON.stringify(ks));
  ok(!ks.includes('weekend'),
     '★1人しか書いていない weekend は配列ごと不在（pct 0 で置かない）', JSON.stringify(ks));
  ok(!ks.some(k => /premium|nwh/i.test(k)),
     '★night / weekend / holiday を1項目にまとめていない', JSON.stringify(ks));
  const sum = d.var.reduce((a, x) => a + x.pct, 0);
  ok(sum === 100, '★変動給の内訳もちょうど100', String(sum));
  ok(d.var.every(x => x.pct > 0), '0% の棒は無い');
  const blk = d.var.find(x => x.k === 'block');
  ok(blk && blk.pct === 75, '★block は75%（3000 / 4000）', JSON.stringify(blk));
}

// ★許可リストに無い basis は捨てる（other へ寄せない）
{
  const mk = (m) => ({ ...BASE, airline: A_BASIS, position: 'cadet', fleet: 'a330',
                       period_year: YEAR, period_month: m,
                       base_pay: 8000, flight_variable_pay: 4000, other_allowance: 4000,
                       pay_items: { v: 1, variable: [
                         { amount: 3000, basis: 'block', label: 'Flight' },
                         { amount: 1000, basis: 'zzz',   label: 'Nonsense' }] } });
  const uB = ++seat; await asUser(uB); await submit(mk(2));
  const b2 = ++seat; await asUser(b2); await submit(mk(3));
  const b3 = ++seat; await asUser(b3); await submit(mk(4));
  await openKey(uB); await asUser(uB);
  const d = await deep();
  const ks = d.var.map(x => x.k);
  ok(!ks.includes('zzz') && !ks.includes('other'),
     '★知らない basis は捨てる。other に寄せて本物の答えに見せない', JSON.stringify(ks));
  ok(ks.length === 1 && ks[0] === 'block' && d.var[0].pct === 100,
     '残った区分だけで100%になる', JSON.stringify(d.var));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 10. 有効数字2桁と常識の幅');
// ════════════════════════════════════════════════════════════
{
  /* ★総支給と内訳を食い違わせない。DET（内訳17000）に gross_monthly 12345 を
     足すと「内訳が総支給をはみ出している行」になり、検品で正しく落ちる。
     落ちると区分が段5まで落ちて、この節が測りたい丸めではなく別のものを見てしまう。 */
  const mk = (m, g) => ({ ...BASE, airline: A_SIG, position: 'cadet', fleet: 'a350',
                          period_year: YEAR, period_month: m,
                          gross_monthly: g, base_pay: g });
  const uS = ++seat; await asUser(uS); await submit(mk(2, 12345));
  const s2 = ++seat; await asUser(s2); await submit(mk(3, 12345));
  const s3 = ++seat; await asUser(s3); await submit(mk(4, 12345));
  await openKey(uS); await asUser(uS);
  const d = await deep();
  // 12345 × 12 = 148140 → 有効数字2桁 = 150000
  ok(Number(d.head.annual_usd) === 150000,
     '★年収は有効数字2桁（148,140 → 150,000）', String(d.head.annual_usd));
  ok(!/148140|12345/.test(JSON.stringify(d)),
     '★元の実額が返り値のどこにも出ていない');
}
{
  // 幅の外は数えない
  const mk = (m, g) => ({ ...BASE, airline: A_BAND, position: 'cadet', fleet: 'a380',
                          period_year: YEAR, period_month: m,
                          gross_monthly: g, base_pay: g });
  const uL = ++seat; await asUser(uL); await submit(mk(2, 20000));   // 年 240,000 → 入る
  const l2 = ++seat; await asUser(l2); await submit(mk(3, 400));     // 年   4,800 → 落ちる
  const l3 = ++seat; await asUser(l3); await submit(mk(4, 70000));   // 年 840,000 → 落ちる
  await openKey(uL); await asUser(uL);
  const d = await deep();
  ok(d.cohort.level !== 'airline_pos_fleet',
     '★幅の外の2人は数えないので、この機材では3人に届かない', d.cohort.level);
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 11. 準識別子ゼロ（約束⑥）');
// ════════════════════════════════════════════════════════════
await asUser(V);
{
  const d = await deep();
  const s = JSON.stringify(d);
  const banned = ['proof_hash', 'created_at', 'period_month', 'period_year',
                  'airline_other', 'age_bucket', 'years_at', 'base_iata',
                  'currency', 'fx_to_usd', 'net_monthly', 'gross_monthly',
                  'email', 'user_id', 'ip_day_hash'];
  for (const w of banned)
    ok(!s.includes(w), `★返り値に ${w} が無い`);
  ok(!/[0-9a-f]{64}/.test(s), '★64桁の16進（ハッシュ）が1つも無い');
  ok(Object.keys(d.cohort).sort().join(',') === 'airline,fleet,level,manual,n,pos',
     '区分に入っているキーは6つだけ', Object.keys(d.cohort).join(','));
}

// ★呼び手ごとに違う区分が返る
{
  const uP = ++seat; await asUser(uP);
  await submit({ ...BASE, airline: A_PEER, position: 'cap', fleet: 'b747',
                 period_year: YEAR, period_month: 6, ...DET });
  await openKey(uP); await asUser(uP);
  const dp = await deep();
  await asUser(V);
  const dv = await deep();
  ok(dp.cohort.airline === A_PEER && dv.cohort.airline === A_HOME,
     '★呼んだ人ごとに、その人自身の会社が返る');
  ok(dp.cohort.pos === 'cap' && dv.cohort.pos === 'fo',
     '★役職も呼んだ人自身の値');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12. 預かり・口コミは集計に混ぜない');
// ════════════════════════════════════════════════════════════
{
  await asUser(V);
  const before = await deep();
  await asAnon();
  await one(`select submit_pay_report_pending($1::jsonb) r`, [JSON.stringify({
    ...BASE, airline: A_HOME, position: 'fo', fleet: 'a320',
    period_year: YEAR, period_month: 2, gross_monthly: 20000 })]);
  await db.query(
    `insert into reviews_v2(proof_hash, airline, "position", annual_salary)
     values ('zz-review-1', $1, 'fo', 3000)`, [A_HOME]);
  await asUser(V);
  const after = await deep();
  ok(after.cohort.n === before.cohort.n,
     '★預かりと口コミは区分の人数に入らない', `${before.cohort.n} → ${after.cohort.n}`);
  ok(after.stats.contributors >= before.stats.contributors,
     '人数表示（stats）は動いてよい');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 13. pv_my_keys は pv_my_give と同じ人を拾う');
// ════════════════════════════════════════════════════════════
{
  // 一覧にない会社に出した人でも、両者が同じ行を拾えること
  const uO = ++seat; await asUser(uO);
  await submit({ ...BASE, airline: 'other', airline_other: 'Nowhere Air',
                 position: 'cap', fleet: 'b777',
                 period_year: YEAR, period_month: 2, ...DET });
  const g = await give();
  const n = await one(`select count(*) c from pay_reports
                        where proof_hash in (select pv_my_keys())`);
  ok(g.detailed === true && Number(n.c) === 1,
     '★自由入力の会社に出した人も、pv_my_keys が自分の1行を拾う',
     `give=${JSON.stringify(g)} keys=${n.c}`);

  // 一覧から選んだ人でも同じ
  await asUser(V);
  const nv = await one(`select count(*) c from pay_reports
                         where proof_hash in (select pv_my_keys())`);
  ok(Number(nv.c) === 1, '呼び手の行も1件だけ拾う', String(nv.c));
  const other = await one(`select count(*) c from pay_reports
                            where proof_hash not in (select pv_my_keys())`);
  ok(Number(other.c) > 0, '他人の行は拾わない', String(other.c));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 14. 旧 pv_pay_comp を触っていない');
// ════════════════════════════════════════════════════════════
{
  // ★db/pay-rows.sql:1240 が自己点検で使っている文字列と1字も違わないこと。
  //   あちらが直ればこちらも落ちる＝「引数を1つ足した」を2重に捕まえる。
  const SIG = 'public.pv_pay_comp(numeric,numeric,numeric,numeric,numeric,'
            + 'numeric,text,numeric,numeric,numeric,numeric,numeric,'
            + 'numeric,numeric,numeric,numeric,numeric,numeric,numeric,'
            + 'numeric)';
  ok((await one(`select to_regprocedure($1) p`, [SIG])).p !== null,
     '★pv_pay_comp は 20 引数のまま（引数を増やしていない）');
  for (const role of ['anon', 'authenticated']) {
    const r = await one(`select has_function_privilege($1, $2, 'execute') b`, [role, SIG]);
    ok(!r.b, `★pv_pay_comp は今も ${role} に開いていない`);
  }
  for (const f of ['public.pv_pct5(numeric[])', 'public.pv_pending_comp(jsonb)']) {
    const p = (await one(`select to_regprocedure($1) p`, [f])).p;
    if (p === null) { ok(false, `${f} が見つからない（署名が変わった）`); continue; }
    const r = await one(`select has_function_privilege('authenticated', $1, 'execute') b`, [f]);
    ok(!r.b, `★${f} も今も誰にも開いていない`);
  }
  /* deep-pay.sql があちらを呼んでいないこと。
     見るのは関数の本体だけ ── 説明コメントと末尾の自己点検には、
     わざと名前と署名が書いてある（触っていないことを確かめるため）。 */
  const src  = read('db/deep-pay.sql');
  const cut  = src.indexOf('-- 自己点検');
  ok(cut > 0, '自己点検の目印が見つかる（切り出しの前提）');
  const body = src.slice(0, cut).split('\n')
                 .filter(l => !l.trimStart().startsWith('--')).join('\n');
  ok(!/\bpv_pay_comp\s*\(/.test(body) && !/\bpv_pct5\s*\(/.test(body)
     && !/\bpv_pending_comp\s*\(/.test(body),
     '★deep-pay.sql の関数はあちらの3本を1回も呼んでいない');
  // 自己点検が使う署名は、あちらが使っている文字列と1字も違わないこと
  ok(src.includes(SIG.replace(/'\s*\+\s*'/g, '')) || src.includes(
       "'public.pv_pay_comp(numeric,numeric,numeric,numeric,numeric,'\n"
     + "                || 'numeric,text,"),
     '★自己点検の署名も numeric×6 → text → numeric×13');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 15. pv_deep_pct（合計ちょうど100）');
// ════════════════════════════════════════════════════════════
{
  const cases = [
    ['{0.333,0.333,0.333}', 3],
    ['{1,1,1,1,1,1,1}', 7],
    ['{0.1,0.2,0.3,0.4}', 4],
    ['{0.9999,0.0001}', 2],
    ['{5}', 1],
  ];
  for (const [arr, n] of cases) {
    const r = (await one(`select pv_deep_pct($1::numeric[]) a`, [arr])).a;
    const sum = r.reduce((a, b) => a + b, 0);
    ok(r.length === n && sum === 100, `合計100（${arr}）`, JSON.stringify(r));
  }
  ok((await one(`select pv_deep_pct('{0,0,0}'::numeric[]) a`)).a === null,
     '全部ゼロなら null（描かない）');
  ok((await one(`select pv_deep_pct(null::numeric[]) a`)).a === null, 'null なら null');
  const neg = (await one(`select pv_deep_pct('{-5,10}'::numeric[]) a`)).a;
  ok(neg && neg[0] === 0 && neg[1] === 100, '負の値は0として扱う', JSON.stringify(neg));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 16. 賞与はドーナツの外');
// ════════════════════════════════════════════════════════════
{
  const mk = (m) => ({ ...BASE, airline: A_BONUS, position: 'cadet', fleet: 'crj',
                       period_year: YEAR, period_month: m, ...DET,
                       bonus_annual: 40000 });
  const uB = ++seat; await asUser(uB); await submit(mk(2));
  const b2 = ++seat; await asUser(b2); await submit(mk(3));
  const b3 = ++seat; await asUser(b3); await submit(mk(4));
  await openKey(uB); await asUser(uB);
  const d = await deep();
  ok(!d.comp.segs.some(s => /bonus/i.test(s.k)),
     '★賞与はドーナツの区分に入っていない', JSON.stringify(d.comp.segs.map(s => s.k)));
  ok(d.comp.bonus && d.comp.bonus.pct_of_annual > 0,
     '★賞与は別行として返る', JSON.stringify(d.comp.bonus));
  // 現金 17000/月 = 204000/年 + 賞与 40000 = 244000。40000/244000 ≒ 16%
  ok(d.comp.bonus.pct_of_annual >= 14 && d.comp.bonus.pct_of_annual <= 18,
     '賞与は年収の約16%', String(d.comp.bonus.pct_of_annual));
}
// 賞与を誰も書いていない区分では別行そのものが無い
await asUser(V);
ok((await deep()).comp.bonus === null,
   '★賞与を書いた人が3人未満なら、その行ごと出さない');

// ════════════════════════════════════════════════════════════
console.log('\n▼ 17. 「時給」と呼んでいない');
// ════════════════════════════════════════════════════════════
{
  const src = read('db/deep-pay.sql');
  ok(!src.includes('時給とは'), '（表記の確認用）');
  ok(!/'hourly'|"hourly"|'per_hour'/.test(src),
     '★返り値のキーに hourly / per_hour を使っていない');
  ok(/per_block_usd/.test(src),
     '★Block Hour あたりのキー名は per_block_usd');
  const d = await deep();
  ok('per_block_usd' in d.head, '見出しに per_block_usd が在る');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 18. 末尾の自己点検（オーナーが SQL Editor で見る表）');
// ════════════════════════════════════════════════════════════
console.log('\n▼ 19. 画面の数字どうしが矛盾しないか（同じ区分の中）');
// ════════════════════════════════════════════════════════════
/* ★ここまでの検査は「合わない数字を出さないか」を見てきた。ここは逆に
     **出している数字どうしが割り算で結べるか**を見る。

   中央値どうしは、ふつう割り算で結べない（1人ずつ比を出してから中央値を取るので、
   中央値の比とは一致しない）。だから**全員まったく同じ**の区分をわざと作る。
   中央値＝その1人の値に潰れるので、そこでだけ「＝」で結べる。
   ここが崩れたら、定義がどこかで入れ替わっている。 */
{
  const BH = 80, BON = 24000;             // Block Hours / 年間賞与
  const IDENT = { ...DET, block_hours: BH, bonus_annual: BON };
  let uSame;
  for (let i = 0; i < 4; i++)
    uSame = await person(A_SPARE, 'cap', 'b787', [{ month: 2 }], IDENT);
  await openKey(uSame);
  await asUser(uSame);
  const d = await deep();

  // 保存した生の値（画面に出る前）。年収と Pay/BH は投稿した瞬間に列へ確定する。
  const raw = await one(
    `select annual_total_usd a, usd_per_block_hour p from pay_reports
      where airline = $1 and position = 'cap' limit 1`, [A_SPARE]);
  const sig2 = async (v) => Number((await one(`select pv_sig2($1::numeric) v`, [v])).v);

  ok(Number(raw.a) === 12 * 17000 + BON,
     '★年収＝月々の現金×12 ＋ 年間賞与（内訳17000・賞与24000）', String(raw.a));
  ok(Number(raw.p) === Math.round(Number(raw.a) / (12 * BH) * 100) / 100,
     '★Pay / Block Hour ＝ 年収 ÷ 12 ÷ Block Hours（保存時の定義）',
     `${raw.p} vs ${Number(raw.a) / (12 * BH)}`);

  ok(Number(d.work.block_h) === BH, '★Block Hours はそのまま出ている', String(d.work.block_h));
  ok(Number(d.head.annual_usd) === await sig2(Number(raw.a)),
     '★画面の年収＝保存した年収を有効数字2桁にしただけ',
     `${d.head.annual_usd} vs ${raw.a}`);
  ok(Number(d.head.per_block_usd) === await sig2(Number(raw.a) / 12 / BH),
     '★画面の Pay / Block Hour ＝ 年収 ÷ 12 ÷ Block Hours（全員同じなら「＝」で結べる）',
     `${d.head.per_block_usd} vs ${Number(raw.a) / 12 / BH}`);

  /* ★年収カードの「月換算（賞与ぬき）」と、給与構成の月額が同じ土俵に乗っているか。
     deep-pay.js の moneyMonth は 年収 ×(1−賞与割合)÷12 で出している。 */
  const bp = Number(d.comp.bonus.pct_of_annual);
  ok(bp === Math.round(BON / Number(raw.a) * 100),
     '★賞与の割合＝年間賞与 ÷ 年収', `${bp} vs ${BON}/${raw.a}`);
  const monthly = Number(d.head.annual_usd) * (1 - bp / 100) / 12;
  const amt = d.comp.segs.reduce((a, x) => a + Number(x.med_usd || 0), 0);
  ok(Math.abs(amt - monthly) / monthly <= 0.08,
     '★給与構成の月額の合計＝年収 ×(1−賞与割合)÷12（丸めのぶんだけずれる）',
     `${Math.round(amt)} vs ${Math.round(monthly)}`);
  /* ⚠️ 賞与を引かないと合わない。引かずに 年収÷12 と比べると 11% ずれる
        ＝これが 2026-09-01 まで画面に「月額が2つある」状態だったもの。 */
  ok(Math.abs(amt - Number(d.head.annual_usd) / 12) / (Number(d.head.annual_usd) / 12) > 0.08,
     '★賞与を引かない 年収÷12 とは合わない（引く必要があることの証拠）',
     `${Math.round(amt)} vs ${Math.round(Number(d.head.annual_usd) / 12)}`);

  /* ★DEEP PAY と会社比較が同じ数字を出すか。
     DEEP PAY は引数なし（呼び手自身の区分）、比較は会社・役職・機材を渡す。
     同じ区分なら**同じ関数の同じ経路**なので、head は1文字も違わないはず。
     ここが割れたら「同じ ANA / CAP / B787 なのに2つの画面で年収が違う」が起きる。 */
  const cmp = await deep({ airline: A_SPARE, position: 'cap', fleet: 'b787' });
  ok(JSON.stringify(cmp.head) === JSON.stringify(d.head),
     '★DEEP PAY と会社比較で head が完全に同じ',
     JSON.stringify(cmp.head) + ' vs ' + JSON.stringify(d.head));
  ok(JSON.stringify(cmp.comp) === JSON.stringify(d.comp),
     '★DEEP PAY と会社比較で給与構成も完全に同じ');
  ok(JSON.stringify(cmp.work) === JSON.stringify(d.work),
     '★DEEP PAY と会社比較で働き方も完全に同じ');
}
await asUser(V);

// ════════════════════════════════════════════════════════════
/* ★ここが一番効く。deep-pay.sql の末尾には、貼れたかどうかをオーナーが
     自分で確かめるための14行の表が付いている。**あの表自体が間違っている**と、
     オーナーは正しく貼れているのに ❌ を見て貼り直す（実際に13番の署名を
     1つ写し間違えていた）。手元で同じ表を出して、全部 ✅ を確かめる。 */
{
  const src = read('db/deep-pay.sql');
  const cut = src.indexOf('with d as (select pg_get_functiondef');
  ok(cut > 0, '自己点検の select が見つかる');
  const sql = src.slice(cut);
  const r = await rows(sql);
  ok(r.length >= 12, `自己点検は ${r.length} 行ある`, String(r.length));
  for (const x of r)
    ok(x['答え'] === '✅', `${x['#']}. ${x['見るもの']}`, x['答え']);
}

// ════════════════════════════════════════════════════════════
console.log(`\n${fail === 0 ? '✅ 全部通った' : '❌ 落ちた検査がある'}  ` +
            `pass ${pass} / fail ${fail}`);
process.exit(fail === 0 ? 0 : 1);
