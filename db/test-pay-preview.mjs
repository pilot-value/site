/* db/test-pay-preview.mjs — 「公開イメージ」の JS が SQL と同じ答えを返すか
   ═══════════════════════════════════════════════════════════════════
   実行: node db/test-pay-preview.mjs   （check.mjs の SQL 群にも入っている）
   ネットワーク不要・本番に一切触らない。PGlite（PG17 の WASM）に本物の
   db/pay-rows.sql を流し、pay-wizard.js の純関数と1件ずつ突き合わせる。

   ★なぜ写しが要るのか。
     確認画面（5/5）は「出したらこう見えます」を**出す前に**見せる。
     その行はまだサーバのどこにも無いので、サーバに聞くことができない。
     だから pay-wizard.js は pv_sig2 / pv_band_grid / pv_band と
     8区分の切り分け（shelf）を**写している**。写しは必ず腐る。
     腐ったことに気づくための唯一の仕掛けがこのファイル。

   ★見ているのは3つ。
     A) 純関数（pv_sig2 / pv_band_grid / pv_band）が、境界・ゼロ・負・null で
        1つ残らず同じ答えを返すこと
     B) 実際に submit_pay_report() を通した行を pv_pay_rows() で取り出し、
        同じ payload を pay-wizard.js に渡した結果と**行ごと一致**すること
     C) 帯の9色が、確認画面（pay-report.css の .wz-seg-dot.is-*）と
        REAL PAY（actual-pay.css の .ap-dw-c-*）で**同じ値**であること。
        ここは数字が合っていても静かに壊れる側 ── 同じ人が同じ月の内訳を
        2つの画面で見比べたときに、基本給が緑と青になる。
        ライト／ダークで分岐させないことも見る（REAL PAY は分岐させないと
        決めてあるので、片方だけ濃い側へ寄せると必ずズレる）。

   ★ここで見ていないもの（別の検査の担当）。
     ・年換算そのもの（pv_annual_total）── 画面側は annualTotal() の答えを
       受け取るだけで、pay-wizard.js は足し算を1つも持たない。
       このファイルも DB の annual_total_orig を読んで渡している。
     ・為替 ── サーバのレートが正。画面は fx_rates から同じ数を読む。
     ・複数の月を出した人の中央値 ── 出す前の画面には1か月ぶんしか無い。
       だから確認画面は「この1か月の値ではない」と断らなければならない。

   ⚠️ days_off はフォームに欄が無い（＝実際の payload には絶対に入らない）。
      それでも写しの側は band を持っているので、ここでは明示的に渡して
      式が合っていることだけ見ている。欄を作るときはここが先に緑になる。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import { createRequire } from 'node:module';

const W = createRequire(import.meta.url)('../pay-wizard.js');
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

/* 数を比べるための正規化。PGlite は numeric を文字列で返す。 */
const num = (v) => (v === null || v === undefined ? null : Number(v));
/* null のキーを落として深く比べる（SQL 側は jsonb_strip_nulls で消えている）。 */
const norm = (v) => {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.map(norm);
  if (typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) {
      const w = norm(v[k]);
      if (w !== null) o[k] = w;
    }
    return Object.keys(o).length ? o : null;
  }
  if (typeof v === 'string' && v !== '' && isFinite(Number(v))) return Number(v);
  return v;
};
const same = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));

// ── 器（db/test-pay-rows.mjs と同じもの）─────────────────────
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

const FILES = ['db/airlines.generated.sql', 'db/vocab.generated.sql',
               'db/pay-reports.sql', 'db/pay-report-pending.sql', 'db/pay-rows.sql'];
console.log('\n▼ SQL の適用');
for (const f of FILES) {
  try { await db.exec(read(f)); console.log(`  ✅ ${f}`); pass++; }
  catch (e) { console.log(`  ❌ ${f}\n     ${e.message}`); process.exit(1); }
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ A-1. 有効数字2桁（pv_sig2 ⇄ preview.sig2）');
// ════════════════════════════════════════════════════════════
/* ★境界・ゼロ・負・null をすべて通す。0 と負は「返さない（null）」が正解で、
     0 を返すと画面が「年収 $0」と書いてしまう。 */
const SIG2 = [null, 0, -1, -12345, 1, 4, 5, 9, 10, 11, 15, 45, 55, 95, 99,
              100, 101, 105, 149, 150, 151, 999, 1000, 1050, 1500, 2500,
              9999, 10000, 10500, 11500, 12500, 121626, 123456, 129000,
              125000, 135000, 699999, 700000, 999999, 1000000,
              0.15, 0.999, 7.5, 0.0001];
{
  const bad = [];
  for (const v of SIG2) {
    const s = num((await one(`select public.pv_sig2($1::numeric) v`, [v])).v);
    const j = W.sig2(v);
    if (!same(s, j)) bad.push(`${v}: SQL=${s} JS=${j}`);
  }
  ok(bad.length === 0, `${SIG2.length} 通りの入力で同じ答え`, bad.join(' / '));
  ok(W.sig2(0) === null && W.sig2(-5) === null && W.sig2(null) === null,
     '★0・負・null は「返さない」（0 を返して画面に $0 と書かせない）');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ A-2. 帯の刻み（pv_band_grid ⇄ preview.bandGrid）');
// ════════════════════════════════════════════════════════════
/* 刻みは 年収/40 を {1,2,5}×10ⁿ の直上へ切り上げる。
   ちょうど p・2p・5p のときにどちらへ倒れるかが見どころ。 */
const GRID = [null, 0, -1, 1, 40, 40000, 79999, 80000, 80001,
              120000, 125000, 129000, 130000, 180000, 200000, 270000,
              400000, 700000, 4000, 8000, 20000, 39999, 4000000];
{
  const bad = [];
  for (const v of GRID) {
    const s = num((await one(`select public.pv_band_grid($1::numeric) v`, [v])).v);
    const j = W.bandGrid(v);
    if (!same(s, j)) bad.push(`${v}: SQL=${s} JS=${j}`);
  }
  ok(bad.length === 0, `${GRID.length} 通りの年収で同じ刻み`, bad.join(' / '));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ A-3. 帯そのもの（pv_band ⇄ preview.band）');
// ════════════════════════════════════════════════════════════
/* ★2×刻み未満を畳む（collapse）側と、畳まない側の両方を通す。
     畳む側の境目（v = 2×grid ちょうど）は畳まない ── ここを1つ間違えると、
     いちばん小さい区分の人だけ帯が1段粗くなる。 */
const BANDS = [];
for (const grid of [null, 0, 5000, 10000, 2, 10]) {
  for (const v of [null, 0, -1, 1, 2, 9, 10, 11, 14, 15, 16, 19, 20, 21,
                   4999, 5000, 9999, 10000, 10001, 60000, 81084, 121626]) {
    BANDS.push([v, grid, true]);
    BANDS.push([v, grid, false]);
  }
}
{
  const bad = [];
  for (const [v, g, c] of BANDS) {
    const s = (await one(`select public.pv_band($1::numeric, $2::numeric, $3) v`, [v, g, c])).v;
    const j = W.band(v, g, c);
    if (!same(s, j)) bad.push(`(${v},${g},${c}): SQL=${JSON.stringify(s)} JS=${JSON.stringify(j)}`);
  }
  ok(bad.length === 0, `${BANDS.length} 通りの (値・刻み・畳む) で同じ帯`, bad.slice(0, 4).join(' / '));
  ok(JSON.stringify(W.band(10000, 5000, true)) === JSON.stringify([10000, 15000]),
     '★2×刻み「ちょうど」は畳まない（10000 は 0〜10000 ではなく 10000〜15000）',
     JSON.stringify(W.band(10000, 5000, true)));
  ok(JSON.stringify(W.band(9999, 5000, true)) === JSON.stringify([0, 10000]),
     '　2×刻み未満は 0〜2×刻みへ畳む', JSON.stringify(W.band(9999, 5000, true)));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ A-4. 「空の殻」の内訳（保存の時点で消える形）');
// ════════════════════════════════════════════════════════════
/* db/pay-reports.sql は、行も「該当なし」も役割モジュールも無い pay_items を
   保存の時点で null に潰す。写しの側が潰さないと、画面だけが
   「内訳が出ます」と約束して実際には出ない（どちらも普通に動いたまま）。 */
ok(W.hasItems({ v: 1 }) === false, '★{v:1} だけの内訳は「無い」と数える');
ok(W.hasItems(null) === false && W.hasItems(undefined) === false, '　null は当然「無い」');
ok(W.hasItems({ v: 1, fixed_none: true }) === true, '　「該当なし」は立派な回答＝「ある」');
ok(W.hasItems({ v: 1, variable: [] }) === true, '　行の配列があれば「ある」（空でもサーバは残す）');
ok(W.hasItems({ v: 1, union: { extra: 'yes' } }) === true, '　役割モジュールがあれば「ある」');
ok(W.unionOutside({ union: { extra: 'yes', source: 'union' } }) === true
   && W.unionOutside({ union: { extra: 'yes', source: 'company' } }) === false
   && W.unionOutside({ union: { extra: 'no', source: 'union' } }) === false
   && W.unionOutside(null) === false,
   '★組合が「総支給の外」になるのは 支給あり かつ 支給元＝組合 のときだけ');

// ════════════════════════════════════════════════════════════
console.log('\n▼ B. 本物の行と突き合わせる（submit → pv_pay_rows）');
// ════════════════════════════════════════════════════════════
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const asUser = async (n) => {
  await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`,
    [uid(n), `p${n}@example.com`]);
  await db.query(`select set_config('pv.uid', $1, false)`, [uid(n)]);
};
const submit = async (payload) => {
  const r = await one(`select submit_pay_report($1::jsonb) r`, [JSON.stringify(payload)]);
  await db.query(`update profiles set pay_reports_today = 0`);
  return r;
};

const YEAR = new Date().getFullYear() - 1;
const AIR = (await rows(
  `select code from pv_airlines where code <> 'other' and active order by code limit 40`)).map(r => r.code);
const JPY = num((await one(`select to_usd from fx_rates where code = 'JPY'`)).to_usd);

/* 通貨は USD（to_usd = 1.000000）を既定にする。狙った額をそのまま作れるので、
   ずれたときに「丸めの写し間違い」か「為替の掛け方」かを切り分けられる。 */
const B = { currency: 'USD', lang: 'ja', tax_rate_pct: 0, fleet: 'b777',
            period_year: YEAR, period_month: 5, position: 'cap' };

/* 見どころを1つずつ持たせた行。airline は語彙から順に割り当てる。 */
let ai = 0;
const FIX = [
  { name: '総支給だけ（内訳を書いていない人）',
    p: { gross_monthly: 10000, seniority_years: 12, block_hours: 80, duty_days: 15 },
    note: '帯は付かない（why=nodetail）。勤務の帯と在籍の段だけ出る' },

  { name: '内訳を全部書いた人（8区分＋賞与）',
    p: { gross_monthly: 20000, seniority_years: 3, position: 'fo',
         base_pay: 9000, guarantee_pay: 1000, command_pay: 800,
         instructor_pay: 300, examiner_pay: 200, union_pay: 100,
         management_pay: 50, nonline_pay: 50,
         per_diem: 600, housing_type: 'allowance', housing_amount: 1500,
         transport: 200, other_allowance: 1200, flight_variable_pay: 900,
         bonus_annual: 24000, profit_share_annual: 6000,
         block_hours: 85, duty_days: 16, days_off: 9 },
    note: '★その他の二重計上の引き算（1200−900）と、賞与を12倍しないこと' },

  { name: '組合が総支給の外（支給元＝組合）',
    p: { gross_monthly: 10000, union_pay: 2000, base_pay: 6000, guarantee_pay: 1000,
         pay_items: { v: 1, union: { days: 4, extra: 'yes', source: 'union' } } },
    note: '★現金は 10000 ではなく 12000（総支給ぜんぶ ＝ 会社から ＋ 組合から）' },

  { name: '組合の支給元が会社（総支給の中）',
    p: { gross_monthly: 10000, union_pay: 2000, base_pay: 6000, guarantee_pay: 1000,
         pay_items: { v: 1, union: { days: 4, extra: 'yes', source: 'company' } } },
    note: '　同じ額でも支給元が違えば現金は 10000 のまま' },

  { name: '内訳の合計が総支給を2%超えた人',
    p: { gross_monthly: 5000, base_pay: 9000 },
    note: '★帯を付けない（按分すると嘘の内訳になる）。行そのものは残る' },

  { name: '区分が1つだけ（基本給＝総支給）',
    p: { gross_monthly: 15000, base_pay: 15000 },
    note: '余りが 0 なので落ち、fixed 1本だけになる' },

  { name: '変動給を「行」だけで書いた人',
    p: { gross_monthly: 10000, base_pay: 5000, guarantee_pay: 1000,
         pay_items: { v: 1, variable: [{ amount: 2000, basis: 'block', label: 'Flight' }] } },
    note: '★行の額を勝手に変動給へ足さない（合計欄が空なら 0 のまま）' },

  { name: '3つとも「該当なし」と答えた人',
    p: { gross_monthly: 10000,
         pay_items: { v: 1, fixed_none: true, guarantee_none: true, variable_none: true } },
    note: '内訳は「ある」と数えるが、金額が1つも無いので帯は付かない' },

  { name: '内訳が「空の殻」（保存で消える）',
    p: { gross_monthly: 10000, pay_items: { v: 1 } },
    note: '★サーバが null に潰す側。画面も潰していなければここで落ちる' },

  { name: '時給制（総支給を書いていない）',
    p: { hourly_rate: 150, block_hours: 80, guaranteed_hours: 75, command_pay: 500,
         seniority_years: 22 },
    note: '★現金は総支給ではなく内訳の足し算から出る。在籍は上の段' },

  { name: '帯の下端ちょうど（60000 = 12×5000）',
    p: { gross_monthly: 10000, base_pay: 5000 },
    note: '★下端ちょうどは上の帯に入る（59999 と 60000 が別の帯になる）' },

  { name: '賞与が 2×刻み ちょうど（畳まない）',
    p: { gross_monthly: 10000, base_pay: 5000, bonus_annual: 10000 },
    note: '★10000 は 0〜10000 ではなく 10000〜15000' },

  { name: '賞与が 2×刻み 未満（畳む）',
    p: { gross_monthly: 10000, base_pay: 5000, bonus_annual: 9000 },
    note: '　9000 は 0〜10000 へ畳む' },

  { name: '円で出した人（為替を掛ける）',
    p: { currency: 'JPY', gross_monthly: 1500000, base_pay: 900000, guarantee_pay: 100000,
         block_hours: 78, duty_days: 14, seniority_years: 9 },
    note: '★掛け算の順番と丸めが写せているか。JS は二進小数なのでここが本番' },

  { name: '在籍4年の副操縦士（下の段）',
    p: { gross_monthly: 9000, position: 'fo', seniority_years: 4 }, note: 'ten = 0' },
  { name: '在籍5年の副操縦士（上の段）',
    p: { gross_monthly: 9000, position: 'fo', seniority_years: 5 }, note: 'ten = 1' },
  { name: '在籍20年の機長（いちばん上の段）',
    p: { gross_monthly: 9000, position: 'cap', seniority_years: 20 }, note: 'ten = 2' },
  { name: '在籍を書いていない人',
    p: { gross_monthly: 9000, position: 'cap' }, note: 'ten はキーごと消える' },

  { name: '常識の幅の下（年 $10,000 未満）',
    p: { gross_monthly: 500 }, note: '★一覧に1行も出ない。画面は「出ません」と言う' },
  { name: '常識の幅の上（年 $700,000 超）',
    p: { gross_monthly: 70000 }, note: '★同じく出ない' },
];

/* 1社＝1人。出したあとに annual_total_orig と為替を読み、
   同じ payload を pay-wizard.js へ渡す。 */
let seat = 1000;
const made = [];
for (const f of FIX) {
  const airline = AIR[ai++];
  const payload = { ...B, ...f.p, airline };
  await asUser(++seat);
  try { await submit(payload); }
  catch (e) { ok(false, `${f.name} — 投稿そのものが通らない`, e.message); continue; }
  const st = await one(
    `select annual_total_orig a, fx_to_usd fx from pay_reports where airline = $1`, [airline]);
  made.push({ ...f, airline, payload, annualOrig: num(st.a), fx: num(st.fx) });
}

/* 見る人 ── 鍵（access_until）を持ち、内訳も出している（＝ full が開く）。
   この人自身の行も一覧に出るが、会社コードで引くので混ざらない。 */
const VIEWER = 9500;
await asUser(VIEWER);
await submit({ ...B, airline: AIR[ai++], gross_monthly: 12000,
               base_pay: 8000, guarantee_pay: 1000, flight_variable_pay: 2000 });
await db.query(`update profiles set access_until = now() + interval '90 days' where id = $1`,
  [uid(VIEWER)]);
await db.query(`select set_config('pv.uid', $1, false)`, [uid(VIEWER)]);

const res = await one(`select pv_pay_rows() r`);
const R = res.r;
ok(R.state === 'open' && R.give && R.give.full === true,
   '見る人は鍵も内訳の門も開いている（帯まで返る状態）',
   JSON.stringify({ state: R.state, give: R.give }));

const byAir = new Map(R.rows.map(x => [x.airline, x]));

for (const m of made) {
  const js = W.row(m.payload, { annualOrig: m.annualOrig, fx: m.fx });
  const sql = byAir.get(m.airline) || null;

  if (!js.inRange) {
    ok(sql === null, `${m.name} — 一覧に出ない（写しも出ないと言っている）`,
       JSON.stringify({ usd: js.usd, sql: sql && sql.annual_usd }));
    continue;
  }
  if (!sql) { ok(false, `${m.name} — 一覧に出るはずの行が無い`, JSON.stringify(js)); continue; }

  const want = { airline: js.airline, pos: js.pos, annual_usd: js.annual_usd,
                 verified: false, age: 0, fleet: js.fleet, ten: js.ten,
                 pay: js.pay, work: js.work };
  ok(same(want, sql), `${m.name} — 行がまるごと一致`,
     `\n     写し: ${JSON.stringify(norm(want))}\n     本物: ${JSON.stringify(norm(sql))}`);
}

// ── 個別に名指しで見るもの（落ちたときに理由が読める形で）──────
{
  const pick = (label) => {
    const m = made.find(x => x.name === label);
    return { m, js: W.row(m.payload, { annualOrig: m.annualOrig, fx: m.fx }),
             sql: byAir.get(m.airline) };
  };

  const u1 = pick('組合が総支給の外（支給元＝組合）');
  const u2 = pick('組合の支給元が会社（総支給の中）');
  ok(W.shelf(u1.m.payload).cash_m === 12000 && W.shelf(u2.m.payload).cash_m === 10000,
     '★組合払いは現金に足す・会社払いは足さない（写しの側）',
     JSON.stringify([W.shelf(u1.m.payload).cash_m, W.shelf(u2.m.payload).cash_m]));
  ok(u1.js.annual_usd === 140000 && num(u1.sql.annual_usd) === 140000,
     '　組合払いの人の年収は 144,000 → 有効数字2桁で 140,000（両方）',
     JSON.stringify([u1.js.annual_usd, u1.sql.annual_usd]));

  const ov = pick('内訳の合計が総支給を2%超えた人');
  ok(ov.js.why === 'over' && !('pay' in ov.sql),
     '★はみ出した行は、写しも本物も帯を付けない（行そのものは残る）',
     JSON.stringify({ why: ov.js.why, keys: Object.keys(ov.sql) }));

  const nd = pick('総支給だけ（内訳を書いていない人）');
  ok(nd.js.why === 'nodetail' && !('pay' in nd.sql) && !('paylock' in nd.sql),
     '★内訳が無い行には門も出さない（書いていない人を「隠している」と読ませない）',
     JSON.stringify(Object.keys(nd.sql)));

  const one1 = pick('区分が1つだけ（基本給＝総支給）');
  ok(one1.js.pay && one1.js.pay.length === 1 && one1.js.pay[0].k === 'fixed',
     '　基本給＝総支給の人は fixed 1本（余りは 0 で落ちる）',
     JSON.stringify(one1.js.pay));

  const rowsOnly = pick('変動給を「行」だけで書いた人');
  ok(!rowsOnly.js.pay.some(x => x.k === 'variable'),
     '★行に 2000 と書いてあっても、合計欄が空なら変動給は 0 のまま',
     JSON.stringify(rowsOnly.js.pay.map(x => x.k)));

  const shell = pick('内訳が「空の殻」（保存で消える）');
  ok(shell.js.why === 'nodetail' && !('pay' in shell.sql) && !('paylock' in shell.sql),
     '★空の殻は写しの側でも「内訳なし」（画面だけが約束しない）',
     JSON.stringify({ why: shell.js.why, keys: Object.keys(shell.sql) }));

  const jp = pick('円で出した人（為替を掛ける）');
  ok(jp.js.pay && jp.js.pay.length >= 2 && same(jp.js.pay, jp.sql.pay),
     '★円の行でも帯が1つ残らず一致する（二進小数のずれが出ていない）',
     `\n     写し: ${JSON.stringify(jp.js.pay)}\n     本物: ${JSON.stringify(jp.sql.pay)}`);
  ok(JPY > 0 && JPY < 1, '　JPY の to_usd は fx_rates から読んでいる（写していない）', String(JPY));

  const edge = pick('帯の下端ちょうど（60000 = 12×5000）');
  ok(same(edge.js.pay.find(x => x.k === 'fixed').r, [60000, 65000]),
     '★下端ちょうどは上の帯（60000 は 55000〜60000 ではない）',
     JSON.stringify(edge.js.pay.find(x => x.k === 'fixed')));

  const b2 = pick('賞与が 2×刻み ちょうど（畳まない）');
  const b1 = pick('賞与が 2×刻み 未満（畳む）');
  ok(same(b2.js.pay.find(x => x.k === 'bonus').r, [10000, 15000])
     && same(b1.js.pay.find(x => x.k === 'bonus').r, [0, 10000]),
     '★賞与の帯 ── ちょうどは畳まない／未満は畳む',
     JSON.stringify([b2.js.pay.find(x => x.k === 'bonus'), b1.js.pay.find(x => x.k === 'bonus')]));

  const all = pick('内訳を全部書いた人（8区分＋賞与）');
  ok(JSON.stringify(all.js.pay.map(x => x.k))
     === JSON.stringify(['fixed', 'variable', 'command', 'role', 'perdiem',
                         'housing', 'other', 'rest', 'bonus']),
     '★区分の並びは金額順ではなく固定順（順位を漏らさない）',
     JSON.stringify(all.js.pay.map(x => x.k)));
  ok(same(all.js.work, { bh: [80, 90], dd: [16, 18], off: [8, 10] }),
     '　勤務の帯は3つだけ・刻みは年収に連動しない', JSON.stringify(all.js.work));
}

// ── 鍵を持たない人には帯が届かない（区分の名前だけ）──────────
{
  const NOGIVE = 9600;
  await db.query(
    `insert into profiles(id,email,access_until) values($1,$2, now() + interval '90 days')
       on conflict (id) do update set access_until = excluded.access_until`,
    [uid(NOGIVE), 'nogive@example.com']);
  await db.query(`select set_config('pv.uid', $1, false)`, [uid(NOGIVE)]);
  const L = (await one(`select pv_pay_rows() r`)).r;
  const m = made.find(x => x.name === '内訳を全部書いた人（8区分＋賞与）');
  const locked = L.rows.find(x => x.airline === m.airline);
  const js = W.row(m.payload, { annualOrig: m.annualOrig, fx: m.fx });
  ok(L.give.full === false && locked && !('pay' in locked),
     '★内訳を出していない人には帯が1つも届かない（ぼかしではなく未送信）',
     JSON.stringify({ full: L.give.full, keys: locked && Object.keys(locked) }));
  ok(same(locked.paylock, js.pay.map(x => x.k)),
     '★閉じている面に届く「区分の名前」も、写しの並びと一致する',
     JSON.stringify([locked.paylock, js.pay.map(x => x.k)]));
}


// ── C) 帯の9色が2つの画面で同じか（CSS を字で読む）────────────
{
  console.log('\nC) 帯の色 ── 確認画面（.wz-seg-dot.is-*）と REAL PAY（.ap-dw-c-*）');

  /* 平らな規則だけ拾う。@media の中も中身は平らなので、この1本で両方取れる。 */
  const rules = (css) => [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
    .map((m) => ({ sel: m[1].trim(), body: m[2].trim(), at: m.index }));

  /* @media / @supports の塊の範囲。中に色を書いたら「分岐させた」ことになる。 */
  const atBlocks = (css) => {
    const out = [];
    for (const m of css.matchAll(/@(media|supports)[^{]*\{/g)) {
      let i = m.index + m[0].length, depth = 1;
      while (i < css.length && depth > 0) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') depth--;
        i++;
      }
      out.push([m.index, i]);
    }
    return out;
  };

  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /* ⚠️ CSS のコメントを先に落とす。落とさないと直前の注記が丸ごと選択子に化けて、
     「.ap-dw-c-fixed」の後ろに注記がぶら下がった嘘の食い違いが出る
     （assert-pay-report-sync.mjs が同じ罠を踏んで、同じ対処をしている）。 */
  const grab = (file, cls) => {
    const css = read(file).replace(/\/\*[\s\S]*?\*\//g, () => '');
    const at = atBlocks(css);
    const bare = new RegExp('^' + esc(cls) + '([a-z]+)$');
    const color = {}, forked = [];
    for (const r of rules(css)) {
      if (r.sel.indexOf(cls) < 0) continue;
      const hex = (r.body.match(/background:\s*(#[0-9a-fA-F]{3,8})/) || [])[1];
      /* 色を持たない規則（形や大きさだけ）は分岐ではない。 */
      if (!hex) continue;
      const m = r.sel.match(bare);
      const inAt = at.some(([a, b]) => r.at > a && r.at < b);
      if (m && !inAt) { color[m[1]] = hex.toLowerCase(); continue; }
      forked.push(r.sel + (inAt ? '（@media の中）' : ''));
    }
    return { color, forked };
  };

  const W_ = grab('pay-report.css', '.wz-seg-dot.is-');
  const A_ = grab('actual-pay.css', '.ap-dw-c-');
  const KEYS = W.segKeys;

  ok(JSON.stringify(Object.keys(W_.color).sort()) === JSON.stringify([...KEYS].sort()),
     '★確認画面の色が、写しの出す区分と過不足なく同じ顔ぶれ',
     `\n     CSS: ${Object.keys(W_.color).sort().join(',')}\n     JS : ${[...KEYS].sort().join(',')}`);
  ok(JSON.stringify(Object.keys(A_.color).sort()) === JSON.stringify([...KEYS].sort()),
     '★REAL PAY の色も同じ顔ぶれ（片方にだけ区分が増えていない）',
     `\n     CSS: ${Object.keys(A_.color).sort().join(',')}`);

  const diff = KEYS.filter((k) => W_.color[k] !== A_.color[k]);
  ok(diff.length === 0,
     '★9色が1つ残らず同じ値（同じ項目が2画面で違う色にならない）',
     diff.map((k) => `\n     ${k}: 確認画面 ${W_.color[k]} / REAL PAY ${A_.color[k]}`).join(''));

  ok(W_.forked.length === 0 && A_.forked.length === 0,
     '★ライト／ダークで色を分岐させていない（REAL PAY が分岐しないので必ずズレる）',
     [...W_.forked, ...A_.forked].join(' / '));
}

console.log(`\n${fail === 0 ? '✅' : '❌'} 通過 ${pass} / 失敗 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
