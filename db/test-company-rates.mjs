/* 会社 × 職位の単価と「単価が変わる点」（db/company-rates.sql）を、本物の Postgres（PGlite = PG17 の WASM ビルド）で確かめる。

   実行: node db/test-company-rates.mjs   （check.mjs sql にも入っている）
   ネットワーク不要・本番に一切触らない。

   守っているもの（2026-11-08 オーナー承認「明細が1枚入るたびに、その会社のことが少し詳しくなる」）:
     ★ 1人の区分は返らない・2人そろうと中央値（手で数えた答えと1円の端数まで同じ）
     ★ 1人1票 ── 10か月出した人も1人（1人の単価を先に作ってから中央値）
     ★ 額だけあって数量の無い月は、その人の単価に入れない（my-year.js と同じ「両方そろった月だけ」）
     ★ 外す行 ── テスト用アカウント・本人が下ろした人・24か月より古い行・年 $10,000〜$700,000 の外・
       機長／副操縦士でない職位・どの会社にも当たらない社名（自由入力の社名が会社コードに直る行は数える）
     ★ 写し ── 6種類の単価が、my-year.js（pay-viz.js の calc を含む）をそのまま読んで1人ずつ出した単価の中央値と同じ。
       乗務1時間あたり（perBlock）は手で作った行の答えとも同じ（賞与・利益分配・パーディアム・総支給の外の組合分）
     ★ 折れ目 ── 2人以上の点から、はっきりした折れ目（約75h）を見つける・まっすぐな点には出さない・1人だけなら出さない・
       乗務時間の変動給の点が6つに届かなければ変動給の合計の点に替える。
       当てはめ（pv_company_kink_fit）は my-year.js の findKink と、作り物の点 240組で同じ答え
     ★ Give & Get ── 読む口は給与の鍵が生きている会員と運営だけ（会社ページの給与の図と同じ pv_work_level() = 'pay'）。
       給与を出していない会員・鍵の切れた会員には単価も折れ目も0行・本物の submit_pay_report で出した瞬間に読める
     ★ 読む口は人数も月の点も返さない（列は決まった3つ／4つだけ）・未ログインは呼べない・止めた会員には何も返さない・
       表は誰も直接読めない・数え直しと当てはめは誰も呼べない
     ★ 引き金 ── 会員が給与を出す・下ろす・テスト用アカウントを名簿に足すと、その場で表が変わる。数に関係しない列の update では数え直さない
     ★ 数え直しの中で失敗が起きても、給与の書き込みは通る（表は前の中身のまま）
     ★ 冪等（流し直しても表は同じ・末尾の検算 14行が全部 ✅）
     ★ 壊す証明 ── 2人の門を1人に緩める・人ではなく月を数える・折れ目の2人の門を緩める・テスト用アカウントを外す行を抜く・
       数量の無い月を混ぜる・乗務1時間あたりの分子からパーディアムを引かない・Give & Get の門を抜く、のどれでも赤くなる

   器は db/test-member-median.mjs と同じ。流す SQL の並びは serve-local.mjs の SQL_FILES をそのまま読む（写さない）。
   給与の行はほとんど持ち主として直接入れる（1つの文でまとめて入れる＝引き金は1回）。引き金の検査だけ本物の submit_pay_report を会員として通す。

   ⚠️ set_config の第3引数は false（＝セッション全体）。
   ⚠️ ここに出てくる会員は全部作り物（crew1@example.com など）。数字も検査のための作り物。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import vm from 'vm';
import { createHash } from 'node:crypto';
import { SQL_FILES } from '../serve-local.mjs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const MINE = 'db/company-rates.sql';

const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;
await db.exec(`set timezone = 'UTC'`);

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };
const must = (c, l, e = '') => { if (!c) ok(false, '（準備が崩れた）' + l, e); return !!c; };
const J = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x) : x));
const near = (a, b, tol = 0.006) => a != null && b != null && Math.abs(Number(a) - Number(b)) <= tol;

// ── my-year.js（と pay-viz.js）をそのまま読む（db/test-year-report.mjs と同じ読み方）────────
function loadYear() {
  const win = { document: { documentElement: { getAttribute: () => 'ja' }, addEventListener() {} }, addEventListener() {} };
  win.window = win;
  const ctx = vm.createContext(win);
  vm.runInContext(read('pay-viz.js'), ctx);
  vm.runInContext(read('my-year.js'), ctx);
  return win.PVYear;
}
const Y = loadYear();
must(Y && typeof Y.calc === 'function' && typeof Y.findKink === 'function', 'my-year.js の PVYear.calc / findKink が読めない');

// ── 器（db/test-member-median.mjs と同じ）──────────────────────
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
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;

  create table public.profiles (
    id uuid primary key, email text, name text,
    email_opt_in boolean not null default false,
    gender text, birthdate date, country text, company text, "position" text,
    created_at timestamptz not null default now());

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

console.log('\n▼ SQL の適用（serve-local.mjs の SQL_FILES の順）');
must(SQL_FILES.includes(MINE), `serve-local.mjs の SQL_FILES に ${MINE} が無い`);
must(SQL_FILES.indexOf(MINE) > SQL_FILES.indexOf('db/member-median.sql') && SQL_FILES.indexOf(MINE) > SQL_FILES.indexOf('db/pay-rows.sql'),
  `${MINE} は db/pay-rows.sql と db/member-median.sql のあと`);
for (const f of SQL_FILES) {
  try { await db.exec(read(f)); ok(true, f); }
  catch (e) { ok(false, f, e.message); process.exit(1); }
}

// ── 道具 ─────────────────────────────────────────────────────
const ANON = Symbol('anon');
const as = async (who) => {
  await db.exec(who === ANON ? `set role anon` : `set role authenticated`);
  await db.query(`select set_config('pv.uid', $1, false)`, [typeof who === 'string' ? who : '']);
};
const asOwner = async () => { await db.exec(`reset role`); await db.query(`select set_config('pv.uid', '', false)`); };
const call = async (who, sql, params = []) => {
  await as(who);
  try { const r = await db.query(sql, params); return { rows: r.rows, fields: r.fields }; }
  catch (e) { return { err: String(e.message || e) }; }
  finally { await asOwner(); }
};
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let seat = 0;
const member = async () => {
  const id = uid(++seat), mail = `crew${seat}@example.com`;
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, mail]);
  await db.query(`insert into public.profiles (id, email) values ($1, $2) on conflict (id) do nothing`, [id, mail]);
  return id;
};
/* 給与の鍵が生きている会員（読む口を呼ぶ側）。鍵の決め方は pv_work_level（db/work-months.sql）の1か所 ── ここは鍵の列を置くだけ */
const giver = async () => {
  const id = await member();
  await db.query(`update public.profiles set access_until = now() + interval '30 days' where id = $1`, [id]);
  return id;
};
const sha = (s) => createHash('sha256').update(s).digest('hex');
/* 給与の行の鍵（本人 × 会社［× 打ち込んだ社名］）。式は db/pay-reports.sql の submit_pay_report の v_hash と同じ。 */
const payKey = (id, airline, other) => sha(`${id}::pv_pay::${airline}${other ? '::' + String(other).toLowerCase() : ''}`);

/* 給与の行をまとめて入れる（持ち主として・1つの文＝引き金は1回）。
   1行 ＝ { who, air, pos, m, ...列 }。年は 2025 年（my-year.js の calc に1年ぶんとして渡せる）・作った時刻は10日前が既定。 */
const COLS = {
  airline_other: 'text', period_year: 'int', period_month: 'int', currency: 'text', fx_to_jpy: 'numeric',
  annual_total_usd: 'numeric', annual_total_orig: 'numeric', bonus_annual: 'numeric', profit_share_annual: 'numeric',
  block_hours: 'numeric', duty_hours: 'numeric', night_hours: 'numeric', sectors: 'int', stay_nights: 'int',
  per_diem: 'numeric', flight_variable_pay: 'numeric', union_pay: 'numeric', pay_items: 'jsonb',
};
const insert = async (list) => {
  const recs = list.map((o) => {
    const { who, air, pos, m, ago = '10 days', other, ...rest } = o;
    return { proof_hash: payKey(who, air, other), airline: air, position: pos, ago,
             airline_other: other || null, period_year: o.y || 2025, period_month: m, currency: 'USD', fx_to_jpy: 150,
             annual_total_usd: 100000, annual_total_orig: 100000, ...rest, y: undefined };
  });
  const names = Object.keys(COLS);
  await asOwner();
  await db.query(
    `insert into public.pay_reports (proof_hash, airline, "position", fleet, created_at, ${names.join(', ')})
     select x.proof_hash, x.airline, x."position", 'a320', now() - x.ago::interval, ${names.map((n) => 'x.' + n).join(', ')}
       from jsonb_to_recordset($1::jsonb) as x(proof_hash text, airline text, "position" text, ago text,
            ${names.map((n) => `${n} ${COLS[n]}`).join(', ')})`, [J(recs)]);
};
/* 変動給の行（pay_items.variable）。{ block: 3000, night: 200 } → 種類ごとに1行 */
const vbItems = (o) => ({ variable: Object.entries(o).map(([basis, amount]) => ({ label: basis, amount, basis })) });

/* その人の行を、my_pay_reports() が返す形（my-year.js が読む列）で引く */
const myRows = async (who, air, other) => {
  await asOwner();
  return (await rows(`select r.period_year, r.period_month, r.fx_to_jpy, r.annual_total_orig, r.bonus_annual, r.profit_share_annual,
                             r.per_diem, r.union_pay, r.flight_variable_pay, r.block_hours, r.duty_hours, r.night_hours,
                             r.sectors, r.stay_nights, r.net_pay_actual, r.deduction_total, r.gross_monthly,
                             public.pv_union_outside_gross(r.pay_items) as union_outside_gross,
                             public.pv_perdiem_outside_gross(r.pay_items) as perdiem_outside_gross,
                             public.pv_variable_by_basis(r.pay_items) as variable_by_basis
                        from public.pay_reports r where r.proof_hash = $1 order by r.period_year, r.period_month`,
    [payKey(who, air, other)]));
};
/* SQL の k → my-year.js の rates の k */
const JSK = { block: 'vb-block', duty: 'vb-duty', night: 'vb-night', sector: 'vb-sector', perdiem: 'perdiem', perBlock: 'block' };
const median = (v) => { const s = [...v].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
/* 1人ずつ my-year.js で単価を出し、種類ごとに中央値（2人以上の種類だけ）を作る ＝ 会社の口が返すべき答え */
const oracle = async (people) => {
  const per = {};
  for (const [who, air, other] of people) {
    const md = Y.calc(await myRows(who, air, other), 2025);
    for (const [k, jk] of Object.entries(JSK)) {
      const r = md.rates.find((x) => x.k === jk);
      if (r) (per[k] = per[k] || []).push(r.rate);
    }
  }
  return Object.fromEntries(Object.entries(per).filter(([, v]) => v.length >= 2).map(([k, v]) => [k, median(v)]));
};

const tableRates = async (air) => {
  await asOwner();
  return Object.fromEntries((await rows(`select rank, k, rate_jpy, n from public.pv_company_rate where airline = $1`, [air]))
    .map((r) => [`${r.rank} ${r.k}`, { rate: Number(r.rate_jpy), n: Number(r.n) }]));
};
const tableKink = async (air) => {
  await asOwner();
  return Object.fromEntries((await rows(`select rank, t, below, above, n from public.pv_company_kink where airline = $1`, [air]))
    .map((r) => [r.rank, { t: Number(r.t), below: Number(r.below), above: Number(r.above), n: Number(r.n) }]));
};
const rates = async (who, air) => {
  const r = await call(who, `select * from public.pv_company_rates($1)`, [air]);
  if (r.err) return { err: r.err };
  return { cols: r.fields.map((x) => x.name), map: Object.fromEntries(r.rows.map((x) => [`${x.rank} ${x.k}`, Number(x.rate_jpy)])), rows: r.rows };
};
const kink = async (who, air) => {
  const r = await call(who, `select * from public.pv_company_kink($1)`, [air]);
  if (r.err) return { err: r.err };
  return { cols: r.fields.map((x) => x.name), map: Object.fromEntries(r.rows.map((x) => [x.rank, { t: Number(x.t), below: Number(x.below), above: Number(x.above) }])), rows: r.rows };
};
/* 当てはめを直接呼ぶ（持ち主として） */
const fitSql = async (P) => {
  await asOwner();
  const lit = (a) => '{' + a.map((v) => String(v)).join(',') + '}';
  const r = await rows(`select t, below, above from public.pv_company_kink_fit($1::float8[], $2::float8[])`,
    [lit(P.map((p) => p.x)), lit(P.map((p) => p.y))]);
  return r[0] ? { t: Number(r[0].t), below: Number(r[0].below), above: Number(r[0].above) } : null;
};

// 会社コードは語彙から取る（このテストのために特定の社名を覚えない）
const AIR = (await rows(`select code, name_en from public.pv_airlines where code <> 'other' and active and name_en is not null order by code limit 40`));
const [A1, A2, A3, A4, A5, A6, A7, A8] = AIR.slice(0, 8).map((r) => r.code);
let TYPED = null;
{
  // 自由入力の社名で A2 に寄る字を作る（A2 の英語名を大文字にして打ち込む）
  const nm = AIR.find((r) => r.code === A2).name_en;
  const typed = String(nm).toUpperCase();
  if ((await one(`select public.pv_airline_resolve($1) as c`, [typed])).c === A2) TYPED = typed;
}
const NOWHERE = 'Zzqx Imaginary Airways';
must(TYPED && (await one(`select public.pv_airline_resolve($1) as c`, [NOWHERE])).c === 'other', '自由入力の社名の見本を作れない', J({ A2, TYPED }));


// ════════════════════════════════════════════════════════════
console.log('\n▼ C1 1人では返らない・2人で中央値・1人1票・数量の無い月は入れない（A1 機長・乗務時間の変動給）');
// ════════════════════════════════════════════════════════════
const P1 = await member(), P2 = await member(), P3 = await member();
{
  // P1: 1月 60h で 3,000 ドル・2月 90h で 6,300 ドル・3月は額だけ（時間なし）9,999 ドル → (3000+6300)×150 ÷ 150h ＝ 9,300 円
  //     （月ごとの単価の平均なら 9,000 円 ＝ 先に1人の Σ額 ÷ Σ時間 を作っているかが分かる）
  await insert([
    { who: P1, air: A1, pos: 'cap', m: 1, block_hours: 60, pay_items: vbItems({ block: 3000 }) },
    { who: P1, air: A1, pos: 'cap', m: 2, block_hours: 90, pay_items: vbItems({ block: 6300 }) },
    { who: P1, air: A1, pos: 'cap', m: 3, block_hours: null, pay_items: vbItems({ block: 9999 }) },
  ]);
  let t = await tableRates(A1);
  ok(t['cap block'] && t['cap block'].n === 1 && t['cap block'].rate === 9300,
    '（表）1人の単価は Σ額 ÷ Σ時間 ＝ 9,300 円（額だけの3月は入らない・月ごとの平均 9,000 円ではない）', J(t['cap block']));
  const r1 = await rates(await giver(), A1);
  ok(!r1.err && r1.rows.length === 0, '★1人の区分は返らない（会員が呼んでも0行）', J(r1));

  // P2: 1月 70h で 4,900 ドル（レート 140）・2月 80h で 5,600 ドル（レート 160）→ (686,000 + 896,000) ÷ 150 ＝ 10,546.67 円
  await insert([
    { who: P2, air: A1, pos: 'cap', m: 1, block_hours: 70, fx_to_jpy: 140, pay_items: vbItems({ block: 4900 }) },
    { who: P2, air: A1, pos: 'cap', m: 2, block_hours: 80, fx_to_jpy: 160, pay_items: vbItems({ block: 5600 }) },
  ]);
  const r2 = await rates(await giver(), A1);
  ok(!r2.err && r2.map['cap block'] === 9923.33, '★2人そろうと中央値（(9,300 + 10,546.67) ÷ 2 ＝ 9,923.33 円）・金額は各月のレートで円にしてから', J(r2));

  // P3: 10か月とも 100h で 12,000 ドル → 18,000 円。3人のまんなかは P2 の 10,546.67（月の数で数えたら 18,000 になる）
  await insert(Array.from({ length: 10 }, (_, i) => ({ who: P3, air: A1, pos: 'cap', m: i + 1, block_hours: 100, pay_items: vbItems({ block: 12000 }) })));
  const r3 = await rates(await giver(), A1);
  t = await tableRates(A1);
  ok(!r3.err && r3.map['cap block'] === 10546.67 && t['cap block'].n === 3,
    '★10か月出した人も1人（3人のまんなか 10,546.67 円・人数は 3）', J({ r3: r3.map, t: t['cap block'] }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ C2 外す行（A2 副操縦士）── テスト用アカウント・下ろした人・古い行・幅の外・職位・どこにも当たらない社名');
// ════════════════════════════════════════════════════════════
const TESTER = await member(), HID = await member();
{
  const G1 = await member(), G2 = await member(), G3 = await member();
  const OLD = await member(), LOW = await member(), HIGH = await member(), CADET = await member(), NOWH = await member();
  const blk = (who, rate, extra = {}) => ({ who, air: A2, pos: 'fo', m: 1, block_hours: 100, pay_items: vbItems({ block: rate * 100 / 150 }), ...extra });
  await insert([
    blk(G1, 8000), blk(G2, 10000),
    { ...blk(G3, 12000), air: 'other', other: TYPED },                           // 自由入力の社名 → A2 に直る（数える）
    blk(TESTER, 50000), blk(HID, 50000),                                          // あとで名簿に足す・下ろす
    blk(OLD, 50000, { ago: '25 months' }),                                        // 24か月より古い
    blk(LOW, 50000, { annual_total_usd: 9999.99 }), blk(HIGH, 50000, { annual_total_usd: 700000.01 }), // 幅の外
    blk(CADET, 50000, { pos: 'cadet' }),                                          // 機長でも副操縦士でもない
    { ...blk(NOWH, 50000), air: 'other', other: NOWHERE },                        // どの会社にも当たらない
  ]);
  let t = await tableRates(A2);
  ok(t['fo block'] && t['fo block'].n === 5 && t['fo block'].rate === 12000,
    '（名簿に足す前・下ろす前）テスト用アカウントと下ろす人も数えて 5人・まんなか 12,000 円', J(t['fo block']));

  await db.query(`insert into public.pv_test_users (uid) values ($1)`, [TESTER]);
  t = await tableRates(A2);
  ok(t['fo block'] && t['fo block'].n === 4 && t['fo block'].rate === 11000, '★テスト用アカウントを名簿に足した瞬間に外れる（4人・11,000 円）', J(t['fo block']));

  await db.query(`insert into public.pay_hidden (proof_hash, reason) values ($1, '検査')`, [payKey(HID, A2)]);
  t = await tableRates(A2);
  ok(t['fo block'] && t['fo block'].n === 3 && t['fo block'].rate === 10000,
    '★下ろした瞬間に外れる（3人・10,000 円）── 古い行・幅の外・訓練生は最初から入らない・自由入力の社名は数える', J(t['fo block']));
  const all = await rows(`select distinct airline, rank from public.pv_company_rate`);
  ok(!all.some((x) => x.airline === 'other') && all.every((x) => x.rank === 'cap' || x.rank === 'fo'),
    'どの会社にも当たらない社名の区分（"other"）・機長／副操縦士以外の区分を作らない', J(all));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ C3 写し: 6種類の単価が my-year.js（pay-viz.js の calc）で1人ずつ出した単価の中央値と同じ（A3 機長）');
// ════════════════════════════════════════════════════════════
const U1 = await member(), U2 = await member(), U3 = await member();
{
  const UNION_OUT = { union: { extra: 'yes', source: 'union', amount: 400 } };
  const UNION_IN = { union: { extra: 'yes', source: 'airline', amount: 300 } };
  await insert([
    // U1: 年 120,000・賞与 12,000 → 月 9,000。パーディアム 600・総支給の外の組合 400 → 分子 8,000 ドル × 150 ÷ 80h ＝ 15,000 円
    { who: U1, air: A3, pos: 'cap', m: 1, annual_total_orig: 120000, bonus_annual: 12000, per_diem: 600, union_pay: 400, stay_nights: 6,
      block_hours: 80, duty_hours: 120, night_hours: 12, sectors: 30,
      pay_items: { ...UNION_OUT, ...vbItems({ block: 2400, duty: 900, night: 360, sector: 450, overtime: 77 }) } },
    // U2: 年 96,000・利益分配 6,000 → 月 7,500。パーディアム 500・組合は会社払い（引かない）→ 分子 7,000 × 150 ÷ 75h ＝ 14,000 円
    { who: U2, air: A3, pos: 'cap', m: 1, annual_total_orig: 96000, profit_share_annual: 6000, per_diem: 500, union_pay: 300, stay_nights: 5,
      block_hours: 75, duty_hours: 110, night_hours: 0, sectors: 25,
      pay_items: { ...UNION_IN, ...vbItems({ block: 2000, duty: 700, night: 500, sector: 300 }) } },
  ]);
  const h = await rates(await giver(), A3);
  ok(!h.err && h.map['cap perBlock'] === 14500,
    '★乗務1時間あたり（手で作った2人）＝ (15,000 + 14,000) ÷ 2 ＝ 14,500 円（賞与・利益分配・パーディアム・総支給の外の組合分を引く）', J(h));
  ok(!h.err && h.map['cap night'] == null,
    '夜間の時間が 0 の月は夜間の単価に入れない（U2 は額 500 ドルがあっても数えない ＝ 1人だけ ＝ 返らない）', J(h.map));

  // U3: 3か月・レートも数量もばらばら・一部の月は数量が無い・ステイ 0 の月がある
  await insert([
    { who: U3, air: A3, pos: 'cap', m: 1, fx_to_jpy: 148.5, annual_total_orig: 150000, bonus_annual: 15000, profit_share_annual: 3000,
      per_diem: 900, stay_nights: 8, block_hours: 85.5, duty_hours: 130, night_hours: 20, sectors: 34,
      pay_items: vbItems({ block: 3100, duty: 1200, night: 640, sector: 680 }) },
    { who: U3, air: A3, pos: 'cap', m: 2, fx_to_jpy: 151.25, annual_total_orig: 150000, bonus_annual: 15000, profit_share_annual: 3000,
      per_diem: 700, stay_nights: 0, block_hours: 71, duty_hours: null, night_hours: 9.5, sectors: null,
      pay_items: { ...UNION_OUT, ...vbItems({ block: 2550, duty: 999, night: 300, sector: 888 }) }, union_pay: 250 },
    { who: U3, air: A3, pos: 'cap', m: 3, fx_to_jpy: 153.8, annual_total_orig: 156000, bonus_annual: 15000, profit_share_annual: 3000,
      per_diem: 0, stay_nights: 4, block_hours: 92, duty_hours: 140, night_hours: 14, sectors: 36,
      pay_items: vbItems({ block: 3600, night: 450, sector: 720 }) },
  ]);
  const want = await oracle([[U1, A3], [U2, A3], [U3, A3]]);
  const got = (await rates(await giver(), A3)).map;
  const keys = Object.keys(JSK);
  const diff = keys.filter((k) => !((want[k] == null && got['cap ' + k] == null) || near(got['cap ' + k], want[k])));
  ok(Object.keys(want).length === 6 && diff.length === 0,
    `★6種類とも my-year.js の答え（1人ずつの単価の中央値）と同じ（${keys.map((k) => k + ' ' + (got['cap ' + k] ?? '—')).join('・')}）`,
    J({ want, got, diff }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ C4 単価が変わる点（折れ目）');
// ════════════════════════════════════════════════════════════
const K1 = await member(), K2 = await member(), SOLO = await member();
const NOISE = [5, -8, 3, -2, 6, -4, 2, -6, 4, -3];
const hinge = (h, t, lo, hi) => Math.min(h, t) * lo + Math.max(0, h - t) * hi;
{
  // A4 機長: 2人の点（5か月 ＋ 4か月）。75h を超えた分は 1時間 60 → 150 ドル
  const H1 = [62, 70, 78, 86, 94], H2 = [66, 73, 82, 90];
  const pts = [];
  await insert([
    ...H1.map((h, i) => ({ who: K1, air: A4, pos: 'cap', m: i + 1, block_hours: h, pay_items: vbItems({ block: hinge(h, 75, 60, 150) + NOISE[i] }) })),
    ...H2.map((h, i) => ({ who: K2, air: A4, pos: 'cap', m: i + 1, block_hours: h, pay_items: vbItems({ block: hinge(h, 75, 60, 150) + NOISE[i + 5] }) })),
  ]);
  // 点の並びは SQL と同じ（人の鍵 → 月）
  for (const [who, H, off] of [[K1, H1, 0], [K2, H2, 5]].sort((a, b) => ('r:' + payKey(a[0], A4)).localeCompare('r:' + payKey(b[0], A4))))
    H.forEach((h, i) => pts.push({ x: h, y: (hinge(h, 75, 60, 150) + NOISE[i + off]) * 150 }));
  const js = Y.findKink(pts);
  const k = await kink(await giver(), A4);
  ok(js && !k.err && k.map.cap && Math.abs(k.map.cap.t - 75) <= 2,
    `★2人の点から折れ目を見つける（約 ${k.map.cap && k.map.cap.t}h・手前 ${k.map.cap && k.map.cap.below} 円／超えた分 ${k.map.cap && k.map.cap.above} 円）`, J({ k, js }));
  ok(js && k.map.cap && k.map.cap.t === js.t && near(k.map.cap.below, js.below, 0.006) && near(k.map.cap.above, js.above, 0.006),
    '★my-year.js の findKink に同じ点を渡した答えと同じ（t は同じ・below / above は小数2桁で同じ）', J({ sql: k.map.cap, js: js && { t: js.t, below: js.below, above: js.above } }));
  ok(J(k.cols) === J(['rank', 't', 'below', 'above']) && k.rows.every((x) => Object.keys(x).length === 4),
    '★折れ目の口が返す列は rank・t・below・above の4つだけ（人数も点も返さない）', J(k.cols));
  const tk = await tableKink(A4);
  ok(tk.cap && tk.cap.n === 2, '（表）点を出した人数は 2（点の数 9 ではない）', J(tk));

  // 片方を下ろすと1人 ＝ 折れ目は消える（引き金）→ 戻すと出る
  await db.query(`insert into public.pay_hidden (proof_hash, reason) values ($1, '検査')`, [payKey(K2, A4)]);
  const k1 = await kink(await giver(), A4);
  ok(!k1.err && k1.rows.length === 0 && !(await tableKink(A4)).cap, '★1人だけになると折れ目は表からも消える（下ろした瞬間・引き金）', J(k1));
  await db.query(`delete from public.pay_hidden where proof_hash = $1`, [payKey(K2, A4)]);
  ok((await kink(await giver(), A4)).map.cap, '（戻すと出る）');

  // A5 機長: まっすぐな点（2人）→ 出さない
  const S1 = await member(), S2 = await member();
  await insert([
    ...H1.map((h, i) => ({ who: S1, air: A5, pos: 'cap', m: i + 1, block_hours: h, pay_items: vbItems({ block: h * 100 + NOISE[i] }) })),
    ...H2.map((h, i) => ({ who: S2, air: A5, pos: 'cap', m: i + 1, block_hours: h, pay_items: vbItems({ block: h * 100 + NOISE[i + 5] }) })),
  ]);
  const ks = await kink(await giver(), A5);
  ok(!ks.err && ks.rows.length === 0 && !(await tableKink(A5)).cap, '★まっすぐな点には折れ目を出さない（表にも置かない）', J(ks));

  // A6 機長: 1人だけ（10か月・はっきりした折れ目）→ 出さない
  const HS = [60, 65, 70, 75, 80, 85, 90, 95, 100, 105];
  await insert(HS.map((h, i) => ({ who: SOLO, air: A6, pos: 'cap', m: i + 1, block_hours: h, per_diem: 300, stay_nights: 4,
    pay_items: vbItems({ block: hinge(h, 80, 60, 160) + NOISE[i] }) })));
  const solo = Y.findKink(HS.map((h, i) => ({ x: h, y: (hinge(h, 80, 60, 160) + NOISE[i]) * 150 })));
  const k6 = await kink(await giver(), A6);
  ok(solo && !k6.err && k6.rows.length === 0 && !(await tableKink(A6)).cap,
    '★1人だけの点は、はっきりした折れ目があっても出さない（表にも置かない ── my-year.js なら本人には出る点）', J({ k6, solo: !!solo }));

  // A7 副操縦士: 乗務時間の変動給の点は2つだけ（6つに届かない）→ 変動給の合計の点（2人・9点）で 80h の折れ目
  const F1 = await member(), F2 = await member();
  const HF1 = [60, 68, 76, 84, 92], HF2 = [64, 72, 88, 96];
  await insert([
    ...HF1.map((h, i) => ({ who: F1, air: A7, pos: 'fo', m: i + 1, block_hours: h, flight_variable_pay: hinge(h, 80, 50, 120) + NOISE[i],
      pay_items: i < 2 ? vbItems({ block: 999 }) : null })),
    ...HF2.map((h, i) => ({ who: F2, air: A7, pos: 'fo', m: i + 1, block_hours: h, flight_variable_pay: hinge(h, 80, 50, 120) + NOISE[i + 5] })),
  ]);
  const fpts = [];
  for (const [H, off, who] of [[HF1, 0, F1], [HF2, 5, F2]].sort((a, b) => ('r:' + payKey(a[2], A7)).localeCompare('r:' + payKey(b[2], A7))))
    H.forEach((h, i) => fpts.push({ x: h, y: (hinge(h, 80, 50, 120) + NOISE[i + off]) * 150 }));
  const jf = Y.findKink(fpts);
  const k7 = await kink(await giver(), A7);
  ok(jf && k7.map.fo && k7.map.fo.t === jf.t && Math.abs(k7.map.fo.t - 80) <= 2 && near(k7.map.fo.above, jf.above),
    `★乗務時間の変動給の点が6つに届かなければ、変動給の合計の点で当てはめる（約 ${k7.map.fo && k7.map.fo.t}h ＝ my-year.js と同じ）`, J({ k7, jf }));

  // 当てはめそのもの: 作り物の点 240組で my-year.js の findKink と同じ答え
  //   形は4つ ── ばらつきのある折れ線・まっすぐ・でたらめ・ばらつきの無い折れ線（整数の時間・同じ時間の月が重なる）。点は 5〜120個。
  //   SQL は和の足す順が違う（点を並べて後ろから足す）ので、below / above は1千万分の1まで同じなら同じとみなす。t は完全に同じ。
  let seed = 20261108;   // 決まった種（毎回同じ240組）
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let z = Math.imul(seed ^ (seed >>> 15), 1 | seed); z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z; return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
  const SETS = 240;
  let same = 0, found = 0, worst = 0; const bad = [];
  for (let s = 0; s < SETS; s++) {
    const kind = s % 4, n = 5 + Math.floor(rnd() * (s % 8 === 0 ? 116 : 18));
    const t0 = 60 + rnd() * 40, lo = rnd() * 120, hi = lo + (rnd() - 0.3) * 200, noise = rnd() * 600;
    const P = Array.from({ length: n }, () => {
      const x = kind === 3 ? 50 + Math.floor(rnd() * 60) : Math.round((40 + rnd() * 90) * 10) / 10;
      const base = kind === 0 || kind === 3 ? hinge(x, kind === 3 ? Math.round(t0) : t0, lo, hi) : kind === 1 ? x * lo : 3000 + rnd() * 4000;
      return { x, y: Math.round((base + (kind === 3 ? 0 : (rnd() - 0.5) * noise)) * 150 * 100) / 100 };
    });
    const a = Y.findKink(P), b = await fitSql(P);
    if (a) found++;
    const rel = (u, v) => Math.abs(u - v) / Math.max(1, Math.abs(u));
    const eq = (!a && !b) || (a && b && a.t === b.t && rel(a.below, b.below) <= 1e-7 && rel(a.above, b.above) <= 1e-7);
    if (a && b) worst = Math.max(worst, rel(a.below, b.below), rel(a.above, b.above));
    if (eq) same++; else bad.push({ s, kind, n, a: a && { t: a.t, below: a.below, above: a.above }, b });
  }
  ok(same === SETS && found >= SETS / 8 && found <= SETS * 7 / 8,
    `★当てはめ（pv_company_kink_fit）は my-year.js の findKink と ${SETS}組とも同じ答え（折れ目が出た組 ${found}・出なかった組 ${SETS - found}・いちばん大きい違い ${worst.toExponential(1)}）`, J(bad.slice(0, 3)));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ C5 読む口: 人数も月の点も返さない・未ログインは呼べない・止めた会員には何も返さない・表は誰も読めない');
// ════════════════════════════════════════════════════════════
{
  const M = await giver();
  const r = await rates(M, A1);
  ok(!r.err && J(r.cols) === J(['rank', 'k', 'rate_jpy']) && r.rows.every((x) => Object.keys(x).length === 3 && !('n' in x)),
    '★単価の口が返す列は rank・k・rate_jpy の3つだけ（人数を返さない）', J(r.cols));
  const r6 = await rates(M, A6);
  const t6 = await tableRates(A6);
  ok(!r6.err && r6.rows.length === 0 && t6['cap block'] && t6['cap block'].n === 1 && t6['cap perdiem'],
    '★1人の区分（A6 機長・10か月）は表には在るが、単価の口は1行も返さない', J({ r6, t6 }));
  const rx = await rates(M, 'no-such-airline'), rn = await call(M, `select * from public.pv_company_rates(null)`);
  ok(!rx.err && rx.rows.length === 0 && !rn.err && rn.rows.length === 0, '無い会社・空の引数は何も返さない（例外も出さない）', J({ rx, rn }));

  for (const [fn, arg] of [['pv_company_rates', A1], ['pv_company_kink', A4]]) {
    const a = await call(ANON, `select * from public.${fn}($1)`, [arg]);
    ok(!!a.err, `★未ログインは ${fn} を呼べない（実行権が無い）`, J(a));
  }
  for (const [who, nm] of [[ANON, '未ログイン'], [M, 'ログイン済み']]) {
    const t1 = await call(who, `select * from public.pv_company_rate`), t2 = await call(who, `select * from public.pv_company_kink`);
    ok(t1.err && t2.err, `★${nm}は2つの表を直接読めない`, J({ t1, t2 }));
    const f1 = await call(who, `select public.pv_company_rate_refresh()`);
    const f2 = await call(who, `select * from public.pv_company_kink_fit('{1,2,3,4,5,6}'::float8[], '{1,2,3,4,5,6}'::float8[])`);
    ok(!!f1.err && !!f2.err, `${nm}は数え直しも当てはめも呼べない（外から何度も呼んで重くさせない）`, J({ f1, f2 }));
  }

  // 止めた会員（パイロットであることの確認待ち）── 給与の鍵は生きているのに止まっている
  const B = await giver();
  await db.query(`insert into public.pv_proof (user_id, state) values ($1, 'required')`, [B]);
  const br = await rates(B, A1), bk = await kink(B, A4);
  ok(!br.err && br.rows.length === 0 && !bk.err && bk.rows.length === 0, '★止めた会員には単価も折れ目も何も返さない（区分が無い会社と同じ答え）', J({ br, bk }));
  ok(Object.keys((await rates(M, A1)).map).length > 0 && (await kink(M, A4)).rows.length > 0, '（止めていない会員には返る）');

  for (const fn of ['pv_company_rates(text)', 'pv_company_kink(text)']) {
    const def = (await one(`select pg_get_functiondef('public.${fn}'::regprocedure) as s`)).s;
    ok(!/pay_reports|refresh|kink_fit|percentile|count\(|array_agg/.test(def) && /not public\.pv_proof_blocked\(\)/.test(def),
      `${fn} は表を引くだけ（給与の表を読まない・数えない）・止めた会員の1行がある`);
  }
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ C5-b Give & Get: 読めるのは給与の鍵が生きている会員と運営だけ（会社ページの給与の図と同じ門）');
// ════════════════════════════════════════════════════════════
{
  const NOW = await one(`select extract(year from current_date)::int as y, extract(month from current_date)::int as m`);
  const N = await member();
  const n0 = await rates(N, A1), k0 = await kink(N, A4);
  ok(!n0.err && n0.rows.length === 0 && !k0.err && k0.rows.length === 0,
    '★給与を出していない会員には、単価も折れ目も0行（区分が無い会社と同じ答え・例外も出さない）', J({ n0, k0 }));

  // 本物の submit_pay_report で給与を出す（鍵が開く）→ その場で読める
  const r = await call(N, `select public.submit_pay_report($1::jsonb) as v`, [J({ currency: 'USD', lang: 'en', tax_rate_pct: 0, fleet: 'a320',
    gross_monthly: 9000, airline: A8, position: 'cap', period_year: NOW.y, period_month: NOW.m })]);
  await db.exec(`update public.profiles set pay_reports_today = 0`);
  must(!r.err && r.rows[0].v && r.rows[0].v.access_until != null, '給与を出せなかった', r.err || J(r.rows));
  const n1 = await rates(N, A1), k1 = await kink(N, A4);
  ok(!n1.err && n1.map['cap block'] === 10546.67 && k1.map.cap, '★給与を出した会員には返る（A1 機長の単価・A4 機長の折れ目）', J({ n1: n1.map, k1: k1.map }));

  // 鍵が切れた会員
  const E = await giver();
  await db.query(`update public.profiles set access_until = now() - interval '1 day' where id = $1`, [E]);
  const e0 = await rates(E, A1), ek = await kink(E, A4);
  ok(!e0.err && e0.rows.length === 0 && !ek.err && ek.rows.length === 0, '★給与の鍵が切れた会員にも0行', J({ e0, ek }));

  // 運営（給与を出していなくても見える ── pv_work_level が運営を 'pay' にする）
  const O = await member();
  await db.query(`insert into public.pv_admins (user_id, note) values ($1, '検査')`, [O]);
  const o0 = await rates(O, A1), ok0 = await kink(O, A4);
  ok(!o0.err && o0.map['cap block'] === 10546.67 && ok0.map.cap, '運営は給与を出していなくても読める（会社ページの給与の図と同じ）', J({ o0: o0.map, ok0: ok0.map }));

  for (const fn of ['pv_company_rates(text)', 'pv_company_kink(text)']) {
    const def = (await one(`select pg_get_functiondef('public.${fn}'::regprocedure) as s`)).s;
    ok(def.includes("and public.pv_work_level() = 'pay'") && !/access_until|pv_admins|pv_is_operator/.test(def),
      `${fn} の門は pv_work_level の1行だけ（鍵や運営の条件を書き写さない）`);
  }
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ C6 引き金: 会員が給与を出すとその場で表が変わる・数に関係しない列では数え直さない');
// ════════════════════════════════════════════════════════════
{
  const X = await member(), Z = await member();
  const NOW = await one(`select extract(year from current_date)::int as y, extract(month from current_date)::int as m`);
  const body = (amount, bh) => ({ currency: 'USD', lang: 'en', tax_rate_pct: 0, fleet: 'a320', gross_monthly: 9000,
    airline: A8, position: 'fo', period_year: NOW.y, period_month: NOW.m, block_hours: bh,
    pay_items: { v: 1, ...vbItems({ block: amount }) } });
  for (const [who, amount, bh] of [[X, 3000, 80], [Z, 4200, 84]]) {
    const r = await call(who, `select public.submit_pay_report($1::jsonb) as v`, [J(body(amount, bh))]);
    await db.exec(`update public.profiles set pay_reports_today = 0`);
    must(!r.err && r.rows[0].v && r.rows[0].v.access_until != null, '給与を出せなかった', r.err || J(r.rows));
  }
  const fx = Number((await one(`select fx_to_jpy from public.pay_reports where proof_hash = $1`, [payKey(X, A8)])).fx_to_jpy);
  const want = Math.round(((3000 * fx / 80) + (4200 * fx / 84)) / 2 * 100) / 100;
  const r = await rates(X, A8);
  ok(!r.err && near(r.map['fo block'], want, 0.011),
    `★会員2人が本物の submit_pay_report で出した瞬間、単価の口に出る（数え直しを手で呼ばない・${r.map['fo block']} 円）`, J({ r, want, fx }));

  const t0 = (await one(`select max(updated_at) as t from public.pv_company_rate`)).t;
  await db.query(`update public.pay_reports set verify_level = 1 where airline = $1`, [A8]);
  const t1 = (await one(`select max(updated_at) as t from public.pv_company_rate`)).t;
  ok(String(t0) === String(t1), '給与の検証の印の書き換えでは数え直さない（数に関わる列だけ）', J({ t0, t1 }));
  await db.query(`update public.pay_reports set block_hours = 100 where proof_hash = $1`, [payKey(X, A8)]);
  const r2 = await rates(X, A8);
  const want2 = Math.round(((3000 * fx / 100) + (4200 * fx / 84)) / 2 * 100) / 100;
  ok(near(r2.map['fo block'], want2, 0.011), '乗務時間を書き換えると、その場で数え直す', J({ r2, want2 }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ C7 数え直しの中で失敗が起きても、給与の書き込みは通る');
// ════════════════════════════════════════════════════════════
const snapAll = async () => {
  await asOwner();
  return J([await rows(`select airline, rank, k, rate_jpy::text, n from public.pv_company_rate order by 1, 2, 3`),
            await rows(`select airline, rank, t::text, below::text, above::text, n from public.pv_company_kink order by 1, 2`)]);
};
{
  const snap = await snapAll();
  await db.exec(`alter table public.pv_company_rate add constraint pv_cr_break check (rate_jpy < 0) not valid`);
  const W = await member();
  let err = null;
  try { await insert([{ who: W, air: A1, pos: 'cap', m: 5, block_hours: 50, pay_items: vbItems({ block: 9000 }) }]); } catch (e) { err = e.message; }
  const saved = (await one(`select count(*)::int as c from public.pay_reports where proof_hash = $1`, [payKey(W, A1)])).c;
  ok(!err && saved === 1, '★数え直しが失敗しても、給与は保存される', err || '');
  ok((await snapAll()) === snap, '表は前の中身のまま（失敗した数え直しの途中の削除も残らない）');
  await db.exec(`alter table public.pv_company_rate drop constraint pv_cr_break`);
  await db.query(`delete from public.pay_reports where proof_hash = $1`, [payKey(W, A1)]);
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ C8 冪等（db/company-rates.sql をもう一度そのまま流す）');
// ════════════════════════════════════════════════════════════
{
  const snap = await snapAll();
  let res = null;
  try { res = await db.exec(read(MINE)); ok(true, MINE + ' 再適用OK'); }
  catch (e) { ok(false, MINE + ' 再適用で失敗', e.message); }
  ok((await snapAll()) === snap, '流し直しても2つの表の中身は変わらない');
  const trg = (await one(`select count(*)::int as c from pg_trigger where tgname = 'trg_pv_company_rate' and not tgisinternal`)).c;
  ok(trg === 3, '引き金は3つの表に1つずつ（流し直しても増えない）', String(trg));
  const check = res && res[res.length - 1] && res[res.length - 1].rows;
  ok(Array.isArray(check) && check.length === 14 && check.every((x) => String(x.結果).startsWith('✅')),
    'ファイル末尾の検算 14行が全部 ✅', J(check && check.filter((x) => !String(x.結果).startsWith('✅'))));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ C9 壊す証明（begin … rollback の中でだけ入れ替える。ファイルは触らない）');
// ════════════════════════════════════════════════════════════
{
  const src = read(MINE);
  const fnSrc = (name) => { const a = src.indexOf(`create or replace function public.${name}(`); return a < 0 ? '' : src.slice(a, src.indexOf('$fn$;', a) + '$fn$;'.length); };
  /* 上の約束をまとめて確かめる（本物で緑・壊した版で赤） */
  const green = async () => {
    const M = await giver(), N = await member();
    const r1 = await rates(M, A1), r2 = await rates(M, A2), r3 = await rates(M, A3), r6 = await rates(M, A6), k6 = await kink(M, A6);
    const tk6 = await tableKink(A6);
    return {
      solo: r6.rows.length === 0 && k6.rows.length === 0 && !tk6.cap,        // 1人の区分は出ない（単価も折れ目も・表にも折れ目を置かない）
      median: r1.map['cap block'] === 10546.67,                               // 1人1票・数量の無い月を入れない
      exclude: r2.map['fo block'] === 10000,                                  // テスト用アカウント・下ろした人を外す
      perBlock: r3.map['cap perBlock'] != null && near(r3.map['cap perBlock'], (await oracle([[U1, A3], [U2, A3], [U3, A3]])).perBlock),
      // Give & Get ── 鍵の無い会員には単価も折れ目も0行（鍵のある会員には返る）
      gate: (await rates(N, A1)).rows.length === 0 && (await kink(N, A4)).rows.length === 0
            && r1.rows.length > 0 && (await kink(M, A4)).rows.length > 0,
    };
  };
  const base = await green();
  ok(Object.values(base).every(Boolean), '（本物）約束の検査はぜんぶ緑', J(base));

  /* [名前, [[関数, 差し替える字, 新しい字], …], 赤くなるはずの約束] */
  const GATE = "     and public.pv_work_level() = 'pay'  -- ★給与の鍵が生きている会員と運営だけ（pv_company_pay と同じ門）\n";
  const BREAK = [
    ['単価の口の2人の門を1人に緩める', [['pv_company_rates', '     and r.n >= 2\n', '     and r.n >= 1\n']], ['solo']],
    ['人ではなく月を数える（人の鍵に月を足す）', [['pv_company_rate_refresh', `'r:' || p.proof_hash as pkey`,
      `'r:' || p.proof_hash || ':' || p.period_year || '-' || p.period_month as pkey`]], ['solo', 'median']],
    // 折れ目の門を緩めた版は、表に置かれた1人の区分を読む口で確かめるため、読む口の門も一緒に緩める
    ['折れ目の2人の門を緩める（表に置く門）', [['pv_company_rate_refresh', '   where g.n >= 2;', '   where g.n >= 1;'],
      ['pv_company_kink', '     and k.n >= 2\n', '     and k.n >= 1\n']], ['solo']],
    ['テスト用アカウントを外す行を抜く', [['pv_company_rate_refresh',
      `\n       and not exists (select 1 from public.pv_test_users t   -- ★テスト用アカウント（給与）\n                        where encode(extensions.digest(t.uid::text || '::pv_pay::' || p.airline || coalesce('::' || lower(p.airline_other), ''), 'sha256'), 'hex') = p.proof_hash)`,
      '']], ['exclude']],
    // 数量の無い月の額も足す（数量が1か月も無い人は落とす ＝ my-year.js の「qty > 0 のときだけ出す」と同じ逃げ道を付けた壊し方）
    ['額だけで数量の無い月を混ぜる', [['pv_company_rate_refresh', '       and v.amt > 0 and v.qty > 0', '       and v.amt > 0 and v.qty is distinct from 0'],
      ['pv_company_rate_refresh', '     group by s.air, s.rank, s.k, s.pkey\n', '     group by s.air, s.rank, s.k, s.pkey\n    having sum(s.qty) > 0\n']], ['median']],
    ['乗務1時間あたりの分子からパーディアムを引かない', [['pv_company_rate_refresh', '                                 - coalesce(p.per_diem, 0)\n', '\n']], ['perBlock']],
    ['Give & Get の門（pv_work_level）の1行を2つの読む口から抜く', [['pv_company_rates', GATE, ''], ['pv_company_kink', GATE, '']], ['gate']],
  ];
  for (const [name, edits, expect] of BREAK) {
    const miss = edits.filter(([fn, from]) => fnSrc(fn).split(from).length !== 2);
    if (miss.length) { ok(false, `${name}：差し替える字が ${miss.map((m) => m[0]).join('・')} に1回だけ無い（検査が古い）`); continue; }
    await asOwner(); await db.exec(`begin`);
    let g = null, e = null;
    try {
      // 同じ関数への差し替えは1つの本文に重ねてから流す
      const body = {};
      for (const [fn, from, to] of edits) body[fn] = (body[fn] ?? fnSrc(fn)).replace(from, () => to);
      for (const f of Object.values(body)) await db.exec(f);
      await db.exec(`select public.pv_company_rate_refresh()`);
      g = await green();
    } catch (x) { e = x.message; }
    // 先に巻き戻す（壊した版が途中で例外を出すと、取引が止まって role を戻せない）
    await db.exec(`rollback`); await asOwner();
    const red = g && expect.every((k) => g[k] === false);
    ok(red, `★${name} → 赤くなる（${expect.join('・')}）`, e || J(g));
  }
  const after = await green();
  ok(Object.values(after).every(Boolean), '（巻き戻したあと: 本物は緑）', J(after));
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
