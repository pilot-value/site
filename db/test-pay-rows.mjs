/* db/pay-rows.sql を本物の Postgres（PGlite = PG17 の WASM ビルド）に流して確かめる。

   実行: node db/test-pay-rows.mjs   （または npm run test:sql）
   ネットワーク不要・本番に一切触らない。SQL を直したら必ずこれを通してから
   オーナーに実行を依頼すること。

   器は db/test-referrals.mjs と同じ（anon / authenticated ロール、既定権限を
   全付与した状態、auth.uid() の代役、profiles）。既定権限を先に全付与してあるから
   こそ pay-rows.sql の revoke が意味を持つ。無いと「元から権限が無いだけ」を
   「revoke が効いた」と誤読する。

   ★2026-08-24、マイページを3枚に分けた（REAL PAY / DEEP PAY / VERIFIED PAY）。
     この画面（REAL PAY）は **機材も支給の内訳も返さない**。個人特定を避けるため、
     画面で隠すのではなく**そもそも送らない**。返るのは会社・職位・年収・検証の4つだけ。
     pv_pay_comp / pv_pct5 / pv_pending_comp は定義だけ残してある（DEEP PAY 用）ので、
     その3つ単体の検査は下の「▼ 7-b」に残してある。消さないこと。

   ★2026-08-23、オーナー判断で k≧5 の門・30日の遅延・p10-p90 のクリップを外した。
     ＝ 出した人は全員そのまま行になる。だからこのファイルが見ているのは
     「出るか出ないか」ではなく、**出たあとで何が漏れないか**に移っている。
     落ちたら画面を作ってはいけない本命は次の5本：

       ・同じ人の12か月が1行に畳まれること      … 出した回数から常連が割れないこと
       ・返り値の文字列に準識別子が1語も無いこと  … 基地・年代・投稿月・原本通貨など
       ・自由入力の社名が返り値に出ないこと      … 打ち込まれた文字列そのものが識別子
       ・並びが投稿順でも金額順でもないこと      … 並び順から「誰が最近出したか」が読めない
       ・pv_pay_rows('ana') が落ちること         … 引数の面が存在しないこと
       ・fleet と comp のキーごと無いこと         … 機材と内訳は REAL PAY の役目ではない

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

  /* 口コミの表（このファイルが触る列だけの最小形）。
     ★db/pay-rows.sql は口コミに書かれた給与も一覧に混ぜるので、
       流す前にこれが無いと落ちる（本番では元からある表）。
     ★airline に外部キーを張らない。pv_airlines はこの下で作られるので順番が逆。 */
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
   狙った額をそのまま作れるので、丸めの検算が読める形になる。 */
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

/* 登録前の「預かり」を1件作る。★本物の口（submit_pay_report_pending）を通す。
   ip_day_hash は IP ヘッダから作られるが、ローカルでは取れないので null になる。
   「同じ人」を作り分けたいので、入れてから書き換える。 */
const pend = async (air, opts) => {
  await asAnon();
  const res = (await one(`select submit_pay_report_pending($1::jsonb) r`,
    [JSON.stringify({ ...BASE, airline: air, position: opts.pos || 'cap', fleet: opts.fleet || 'b777',
                      period_year: YEAR, period_month: opts.month, gross_monthly: opts.gross })])).r;
  if (opts.iph !== null)
    await db.query(`update pay_reports_pending set ip_day_hash = $2 where id = $1::uuid`,
      [res.id, opts.iph]);
  return res;
};

const backdateAirline = (air, days) =>
  db.query(`update pay_reports set created_at = now() - ($2 || ' days')::interval where airline = $1`,
    [air, String(days)]);

const VIEWER = 9002;
const asViewer = () => db.query(`select set_config('pv.uid', $1, false)`, [uid(VIEWER)]);
const payRows = async () => (await one(`select pv_pay_rows() r`)).r;
const only = (rs, f) => rs.filter(f);
// 画面に出るのと同じ丸め（有効数字2桁）。畳んだ額の検算に使う。
const pv2 = (v) => Number(v.toPrecision(2));

// 会社コードは語彙から取る（このテストのために特定の社名を覚えない）
const AIR = (await rows(
  `select code from pv_airlines where code <> 'other' and active order by code limit 21`
)).map(r => r.code);
const [A_ONE, A_M12, A_MIX, A_OLD, A_ORD, A_VF, A_OUT, A_FOTHER,
       A_BAND, A_PEND, A_CLAIMED, A_NULLIP, A_CROSS, A_COMP, A_STAT,
       A_RV_MON, A_RV_ANN, A_RV_SUM, A_RV_DUP, A_RV_NONE, A_AGE] = AIR;

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

/* 見る人は自分では1件も出していない。出させると、その1行が下の行数の検算に混ざる。
   鍵だけ直接開ける。 */
await db.query(`insert into profiles(id,email,access_until) values($1,$2, now() + interval '90 days')
                on conflict (id) do update set access_until = excluded.access_until`,
  [uid(VIEWER), `viewer@example.com`]);

// ════════════════════════════════════════════════════════════
console.log('\n▼ 2. データを作る');
// ════════════════════════════════════════════════════════════
// (a) たった1人。しかも今日出したばかり（★門も遅延も無いので出るはず）
await person(A_ONE, 'cap', [{ fleet: 'b777', month: 3, gross: 15000 }]);

// (b) 3人 × 12か月
for (let i = 0; i < 3; i++)
  await person(A_M12, 'fo', Array.from({ length: 12 },
    (_, m) => ({ fleet: 'a320', month: m + 1, gross: 8000 + m * 100 })));

// (c) 1人が 787 と 330 の両方
await person(A_MIX, 'cap', [{ fleet: 'b787', month: 1, gross: 10000 },
                            { fleet: 'a330', month: 2, gross: 20000 }]);

// (d) 2人ぶん。あとで 800 日前にする（24ヶ月の窓）
for (let i = 0; i < 2; i++)
  await person(A_OLD, 'cap', [{ fleet: 'a350', month: 4, gross: 15000 }]);

// (e) 並びを見るための6人。投稿順に金額が増えていく
const ORD_GROSS = [10000, 11000, 12000, 13000, 14000, 15000];
for (const g of ORD_GROSS) await person(A_ORD, 'cap', [{ fleet: 'b737', month: 7, gross: g }]);

// (f) 検証済みが1人・していない人が1人
const VF_UID = await person(A_VF, 'cap', [{ fleet: 'b787', month: 8, gross: 15000 }]);
await person(A_VF, 'cap', [{ fleet: 'b787', month: 8, gross: 16000 }]);
await db.query(
  `update pay_reports set verify_level = 1 where airline = $1
     and proof_hash in (select proof_hash from pay_reports where airline = $1 order by created_at limit 1)`,
  [A_VF]);

// (g) 中央値の5倍を出した1人＋ふつうの4人（★クリップを外したので、この人は出る）
//     ★ここで見たいのはクリップが無いことなので、5倍にしても「常識の幅」（年 $70万）
//       に当たらない額にしてある。ふつうの4人が年 $12万、5倍の人が年 $60万。
for (const g of [10000, 10000, 10000, 10000, 50000])
  await person(A_OUT, 'cap', [{ fleet: 'b777', month: 9, gross: g }]);

// (h) 「一覧にない会社」2人（★全員出すので、この2人も出る。ただし社名は出ない）
const OTHER_NAME = 'Somewhere Air';
for (let i = 0; i < 2; i++) {
  const u = ++seat; await asUser(u);
  await submit({ ...BASE, airline: 'other', airline_other: OTHER_NAME,
                 position: 'cap', fleet: 'b737', period_year: YEAR, period_month: 5,
                 gross_monthly: 15000 });
}

/* (i) 機材が「その他」の行。★投稿側（pv_validate_pay_payload）は区分の無い機材を
   弾くので、submit では作れない。読み側が 'other' をそのまま返すことを見たいので
   入れてから書き換える。 */
await person(A_FOTHER, 'cap', [{ fleet: 'b737', month: 6, gross: 15000 }]);
await db.query(`update pay_reports set fleet = 'other', fleet_cat = null where airline = $1`, [A_FOTHER]);

/* (j) 常識の幅の材料。3人とも投稿としては正しいので、保存されたあとの額だけ書き換える。
   ★桁を打ち損ねた行と、月額の欄に年額を入れた行。本番で実際にあった2つの形。 */
for (const g of [15000, 16000, 17000])
  await person(A_BAND, 'cap', [{ fleet: 'b777', month: 10, gross: g }]);
await db.query(`update pay_reports set annual_total_usd = 0.75
                 where airline = $1 and annual_total_usd = $2`, [A_BAND, 16000 * 12]);
await db.query(`update pay_reports set annual_total_usd = 12000000
                 where airline = $1 and annual_total_usd = $2`, [A_BAND, 17000 * 12]);

/* (k) 預かり（登録前に出されたぶん）*/
// 同じ人が同じ日に2か月ぶん出した → 1行に畳まれるはず
await pend(A_PEND, { fleet: 'b777', month: 3, gross: 15000, iph: 'iph-aaa' });
await pend(A_PEND, { fleet: 'b777', month: 4, gross: 17000, iph: 'iph-aaa' });
// 別の人 → もう1行
await pend(A_PEND, { fleet: 'b777', month: 3, gross: 20000, iph: 'iph-bbb' });
// 語彙に無い会社コードに書き換えた行 → 出さない（画面の辞書に無い＝コードが素で出る）
{
  const bogus = await pend(A_PEND, { fleet: 'b777', month: 5, gross: 15000, iph: 'iph-ccc' });
  await db.query(`update pay_reports_pending set airline = 'zzz-bogus' where id = $1::uuid`, [bogus.id]);
}
// 本棚へ移したぶん → 出さない（移した先に同じ人が居る＝二重計上）
{
  const claimed = await pend(A_CLAIMED, { fleet: 'b787', month: 3, gross: 15000, iph: 'iph-ddd' });
  await db.query(`update pay_reports_pending set claimed_at = now() where id = $1::uuid`, [claimed.id]);
}
// IP が取れなかったぶん → 出さない（誰の行かまとめられないので畳めない）
await pend(A_NULLIP, { fleet: 'b787', month: 3, gross: 15000, iph: null });
// レートの無い通貨 → 出さない（本棚側の annual_total_usd が null になるのと同じ扱い）
{
  await asAnon();
  await one(`select submit_pay_report_pending($1::jsonb) r`, [JSON.stringify({
    ...BASE, currency: 'ZZZ', airline: A_NULLIP, position: 'cap', fleet: 'b787',
    period_year: YEAR, period_month: 4, gross_monthly: 15000 })]);
  await db.query(`update pay_reports_pending set ip_day_hash = 'iph-eee'
                   where airline = $1 and payload->>'currency' = 'ZZZ'`, [A_NULLIP]);
}

/* (l) 支給の内訳（割合）の材料。6人ぶん、機材で見分けられるようにしてある。
   ★機材は「▼ 7-b」でどの行を取るかに使うだけ。返り値には機材は出ない。
   ★手計算は下の「▼ 7-b」に書いてある。ここは形を作るだけ。 */
{
  const put = async (fleet, p) => {
    const u = ++seat; await asUser(u);
    for (const m of [].concat(p)) 
      await submit({ ...BASE, airline: A_COMP, position: 'cap', fleet,
                     period_year: YEAR, ...m });
  };
  // ① 総支給1本＋パーディアム＋住宅手当＋年1回の賞与（本番でいちばん多い形）
  await put('b777', { period_month: 1, gross_monthly: 9000, per_diem: 400,
                      housing_type: 'allowance', housing_amount: 70, bonus_annual: 26000 });
  // ② 内訳を全部入れた形
  await put('b787', { period_month: 1, base_pay: 9000, per_diem: 1200,
                      housing_type: 'allowance', housing_amount: 2500,
                      transport: 300, command_pay: 800, other_allowance: 200,
                      bonus_annual: 20000, profit_share_annual: 5000 });
  // ③ 社宅が現物支給（住宅は現金ではないので割合に入らない）
  await put('a320', { period_month: 1, base_pay: 9000,
                      housing_type: 'provided', housing_amount: 2500 });
  // ④ 手当が総支給を超えている（入力違い）→ 内訳を出さない
  await put('a330', { period_month: 1, gross_monthly: 1000, per_diem: 2000 });
  // ⑤ 同じ人の2か月。割合が月ごとに違う → 平均される
  await put('a350', [{ period_month: 1, gross_monthly: 10000 },
                     { period_month: 2, gross_monthly: 10000, bonus_annual: 120000 }]);
  // ⑥ 2か月のうち1か月が入力違い → その人の内訳は丸ごと出さない
  await put('b737', [{ period_month: 3, gross_monthly: 1000, per_diem: 2000 },
                     { period_month: 4, gross_monthly: 10000 }]);
}

await backdateAirline(A_OLD, 800);        // ★この会社だけ2年より前にする
await asViewer();
r = await payRows();
ok(r.ok === true && r.state === 'open', '鍵のある人には open が返る', JSON.stringify(r.state));
const R = r.rows;

// ════════════════════════════════════════════════════════════
console.log('\n▼ 3. ★全員出る（門も遅延も無い）');
// ════════════════════════════════════════════════════════════
ok(only(R, x => x.airline === A_ONE).length === 1,
   '★その会社に1人しかいなくても、その1人が行になる', `= ${only(R, x => x.airline === A_ONE).length}行`);
ok(only(R, x => x.airline === A_ONE)[0]?.annual_usd == 15000 * 12,
   '　額もそのまま（丸めた形で）', JSON.stringify(only(R, x => x.airline === A_ONE)));
{
  const fresh = await one(`select min(created_at) > now() - interval '1 hour' b
                             from pay_reports where airline = $1`, [A_ONE]);
  ok(fresh.b === true, '　（その行は今日出したもの＝30日の遅延が本当に無い）');
}
ok(only(R, x => x.airline === 'other').length === 2,
   '★「一覧にない会社」の人も出る（2人）', `= ${only(R, x => x.airline === 'other').length}行`);
ok(only(R, x => x.airline === A_OLD).length === 0,
   '2年より前の行は出ない（24ヶ月の窓は残っている）');

// ════════════════════════════════════════════════════════════
console.log('\n▼ 4. ★同じ人の複数月が1行に畳まれる');
// ════════════════════════════════════════════════════════════
const m12 = only(R, x => x.airline === A_M12);
ok(m12.length === 3, '3人が12か月ずつ出しても3行（36行にならない）', `= ${m12.length}行`);
ok((await one(`select count(*)::int c from pay_reports where airline = $1`, [A_M12])).c === 36,
   '　（元の表には36行ちゃんと入っている）');
ok(new Set(m12.map(x => String(x.annual_usd))).size === 1,
   '　3人とも同じ12か月なので同じ額に落ちる', JSON.stringify(m12.map(x => x.annual_usd)));

/* ★機材を返さなくなったので、同じ人が2機材ぶん出しても1行に畳まれる。
   前は機材ごとに1行だった。「1人＝1行」に近づいた側の変化。 */
const mix = only(R, x => x.airline === A_MIX);
ok(mix.length === 1, '★1人が2機材を出しても1行（機材で行が割れない）', `= ${mix.length}行`);
ok((await one(`select count(*)::int c from pay_reports where airline = $1`, [A_MIX])).c === 2,
   '　（元の表には2行ちゃんと入っている）');
ok(Number(mix[0]?.annual_usd) === pv2((10000 * 12 + 20000 * 12) / 2),
   '　額は2つの中央値（どちらの機材の額とも違う）', JSON.stringify(mix.map(x => x.annual_usd)));

// ════════════════════════════════════════════════════════════
console.log('\n▼ 5. 丸め（k≧5 の門を外した今、いちばん外側の守り）');
// ════════════════════════════════════════════════════════════
const notRounded = await rows(
  `select v from (
     select (e->>'annual_usd')::numeric v from jsonb_array_elements(pv_pay_rows()->'rows') e
   ) q where pv_sig2(v) is distinct from v`);
ok(notRounded.length === 0, '画面に出るすべての額が有効数字2桁',
   JSON.stringify(notRounded.slice(0, 3)));
ok((await one(`select pv_sig2(183456::numeric) v`)).v == 180000, 'pv_sig2(183456) = 180000');
ok((await one(`select pv_sig2(0::numeric) v`)).v === null, 'pv_sig2(0) は null');
{
  /* ★クリップを外したので、極端に高い1人はそのままの桁で出る。
     これは仕様（オーナー判断）。**黙って戻さない**ために、出ることを検査で固定しておく。
     戻すなら pay-rows.sql の冒頭ごと直すこと。 */
  const outs = only(R, x => x.airline === A_OUT).map(x => Number(x.annual_usd));
  ok(outs.length === 5, '外れ値の会社は5人ぶん出る', `= ${outs.length}行`);
  ok(Math.max(...outs) === 50000 * 12,
     '★中央値の5倍の人はクリップされずに出る（丸めだけが効く）', JSON.stringify(outs));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 6. ★並びに時間が入っていない');
// ════════════════════════════════════════════════════════════
{
  const got  = only(R, x => x.airline === A_ORD).map(x => Number(x.annual_usd));
  const asc  = ORD_GROSS.map(g => g * 12);        // 投稿順 ＝ 金額の昇順に作ってある
  const desc = [...asc].reverse();
  ok(got.length === 6, '並びを見る会社は6人ぶん出る', `= ${got.length}行`);
  ok(new Set(got).size === 6, '　6人の額はすべて違う（並びが読める形になっている）',
     JSON.stringify(got));
  ok(got.join() !== asc.join(),  '★投稿の順に並んでいない',       JSON.stringify(got));
  ok(got.join() !== desc.join(), '★投稿の逆順にも並んでいない',   JSON.stringify(got));
  ok(got.join() !== [...got].sort((a, b) => a - b).join()
     && got.join() !== [...got].sort((a, b) => b - a).join(),
     '★金額の順にも並んでいない（この画面はランキングではない）', JSON.stringify(got));
}
{
  // 2回呼んでも同じ並び（md5 は固定。呼ぶたびに変わると「並びが乱数」＝説明できない）
  const a = (await payRows()).rows.map(x => `${x.airline}/${x.pos}/${x.annual_usd}`).join('|');
  const b = (await payRows()).rows.map(x => `${x.airline}/${x.pos}/${x.annual_usd}`).join('|');
  ok(a === b, '何度呼んでも同じ並び（md5 順で固定）');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 7. ★返り値に何が入っているか');
// ════════════════════════════════════════════════════════════
const ALLOWED = ['airline', 'pos', 'annual_usd', 'verified', 'age'];
const extra = [...new Set(R.flatMap(x => Object.keys(x)))].filter(k => !ALLOWED.includes(k));
ok(extra.length === 0, '返す項目は5つだけ', JSON.stringify(extra));
ok(R.every(x => !('fleet' in x)),
   '★どの行にも機材のキーが無い（null ではなく、キーごと無い）');
ok(R.every(x => !('comp' in x)),
   '★どの行にも支給の内訳のキーが無い（内訳は DEEP PAY の役目）');

const raw = (await one(`select pv_pay_rows()::text t`)).t;
const BANNED = ['proof_hash', 'base_iata', 'seniority', 'age_bucket', 'period_month',
                'period_year', 'created_at', 'annual_total_orig', 'currency',
                'contract_type', 'tax_country', 'nationality', 'verify_level',
                'base_pay', 'housing', 'per_diem', 'block_hours', 'airline_other'];
const hit = BANNED.filter(w => raw.includes(w));
ok(hit.length === 0, '準識別子・個人の内訳が返り値の文字列に1つも無い', JSON.stringify(hit));
ok(!raw.includes(OTHER_NAME) && !raw.toLowerCase().includes('somewhere'),
   '★打ち込まれた自由入力の社名が返り値に1文字も無い');
ok(only(R, x => x.airline === 'other').every(x => Object.keys(x).length === 5),
   '　その人たちの行にも余分な欄が1つも無い（打ち込まれた社名の置き場が無い）');
ok(R.every(x => Number.isInteger(x.age) && x.age >= 0 && x.age <= 4),
   '★投稿の時期は0〜4の段だけ（日付も年月も入っていない）');
ok(!/\d{4}-\d{2}/.test(raw),
   '★返り値の文字列に年月の形をした数字が1つも無い');

ok(!raw.includes('fleet') && !raw.includes('comp') && !raw.includes('"b737"'),
   '★返り値の文字列に機材も内訳も1語も無い');
ok(only(R, x => x.airline === A_FOTHER).length === 1,
   '　機材の区分が無い行も、機材を返さないので普通に1行として出る');
ok(R.every(x => x.airline && x.pos), 'ラベルの無い列が1つも無い');
ok(R.every(x => typeof x.verified === 'boolean'), '検証は true/false の1つだけ（段階を持たない）');
{
  const vf = only(R, x => x.airline === A_VF);
  ok(vf.length === 2 && vf.filter(x => x.verified).length === 1,
     '検証済みの人だけ verified が true', JSON.stringify(vf.map(x => x.verified)));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 7-b. ★支給の内訳（DEEP PAY 用。REAL PAY からは呼ばれない）');
// ════════════════════════════════════════════════════════════
/* 2026-08-24。内訳は REAL PAY では出さないことにしたが、pv_pay_comp / pv_pct5 の
   **定義は残してある**（DEEP PAY で「この給与は何で構成されているか」を集計する材料）。
   使う側が居ないと検査ごと消えて、次に使うときに誰も正しさを知らない状態になるので、
   ここで関数を直に呼んで確かめておく。★消さないこと。

   内訳の**金額**を返すと有効数字2桁の丸めをすり抜けて実額の個票になるので、
   返すのは割合だけ（db/pay-rows.sql の3つとも金額を1つも返さない）。

   ★ここが落ちたら DEEP PAY を作ってはいけない本命は3つ：
     ・値がすべて 0〜100 の整数であること（金額が混ざっていない）
     ・合計がちょうど 100 になること（99 や 101 だと円グラフに隙間が出る）
     ・足し算が pv_annual_total と同じであること（下の手計算） */
{
  /* pay_reports の1行を、そのまま pv_pay_comp → pv_pct5 に通す。
     ★機材は「どの行を取るか」に使っているだけ。返り値には出ない。 */
  const cmAt = async (fleet, month) => (await one(`
    select public.pv_pct5(public.pv_pay_comp(
             gross_monthly, base_pay, hourly_rate, guaranteed_hours, block_hours,
             per_diem, housing_type, housing_amount, transport, command_pay,
             other_allowance, bonus_annual, profit_share_annual, bonus_month)) c
      from pay_reports where airline = $1 and fleet = $2 and period_month = $3`,
    [A_COMP, fleet, month])).c;
  const cm = (fleet) => cmAt(fleet, 1);
  const KEYS = ['m', 'b', 'd', 'h', 'o'];
  const eq = (c, e) => c !== null && c !== undefined
    && KEYS.every(k => c[k] === e[k]);

  const comps = (await Promise.all(
    ['b777', 'b787', 'a320', 'a350'].map(f => cm(f)))).filter(c => c !== null);
  ok(comps.length === 4, '　内訳が出る行が実際にある', String(comps.length));
  ok(comps.every(c => Object.keys(c).length === 5
                   && KEYS.every(k => Number.isInteger(c[k]))),
     '★内訳は m/b/d/h/o の5つだけ。値は整数（金額が混ざっていない）',
     JSON.stringify(comps.find(c => Object.keys(c).length !== 5
                                 || !KEYS.every(k => Number.isInteger(c[k])))));
  ok(comps.every(c => KEYS.every(k => c[k] >= 0 && c[k] <= 100)),
     '　どの値も 0〜100 の中（額がそのまま入っていない）');
  ok(comps.every(c => KEYS.reduce((s, k) => s + c[k], 0) === 100),
     '★合計がちょうど 100（丸めの端数を最大の成分で吸収している）',
     JSON.stringify(comps.map(c => KEYS.reduce((s, k) => s + c[k], 0)).filter(v => v !== 100)));

  /* ★以下の①〜④は「1行ぶん」の手計算。前は pv_pay_rows が返す comp を見ていたが、
     今は関数を直に呼んでいる。期待値は1つも変えていない。 */

  /* ① 総支給9000＋パーディアム400＋住宅手当70＋年1回の賞与26000
        年収 = 12×9000 + 26000 = 134,000（pv_annual_total と同じ）
        m = 12×(9000−400−70) = 102,360 → 76.4% → 76
        b = 26,000 → 19.4% → 19 ／ d = 4,800 → 3.6% → 4 ／ h = 840 → 0.6% → 1 */
  ok(eq(await cm('b777'), { m: 76, b: 19, d: 4, h: 1, o: 0 }),
     '① 総支給＋パーディアム＋住宅手当＋賞与（手計算と一致）', JSON.stringify(await cm('b777')));

  /* ② 内訳を全部入れた形。年収 = 12×14,000 + 25,000 = 193,000
        m = 108,000 → 56 ／ b = 25,000 → 13 ／ d = 14,400 → 7
        h = 30,000 → 16 ／ o = 12×1,300 = 15,600 → 8 */
  ok(eq(await cm('b787'), { m: 56, b: 13, d: 7, h: 16, o: 8 }),
     '② 内訳を全部入れた形（手計算と一致）', JSON.stringify(await cm('b787')));

  /* ③ 社宅が現物支給。pv_annual_total が足さないので、割合にも入らない */
  ok(eq(await cm('a320'), { m: 100, b: 0, d: 0, h: 0, o: 0 }),
     '★③ 現物支給の社宅は住宅手当に入らない（金額に入れていないので割合にも入れない）',
     JSON.stringify(await cm('a320')));

  /* ④ パーディアム2000 が総支給1000 を超えている＝入力違い。
        嘘の円を描くより描かない方がよい。 */
  ok(await cm('a330') === null,
     '★④ 手当が総支給を超えている行は内訳を出さない（null）', JSON.stringify(await cm('a330')));

  /* ⑤ 同じ人の2か月。1月は 100/0、2月は 50/50。
        ★「平均して 75/25 にする」側の足し算は pv_pay_rows の中にあったので、
          機材と内訳を落としたときに一緒に消えた。DEEP PAY で書き直すことになる。
          ここでは、その材料になる**月ごとの値**が正しいことだけを見ておく。 */
  ok(eq(await cmAt('a350', 1), { m: 100, b: 0, d: 0, h: 0, o: 0 }),
     '⑤ 同じ人の1月ぶん（賞与なし）', JSON.stringify(await cmAt('a350', 1)));
  ok(eq(await cmAt('a350', 2), { m: 50, b: 50, d: 0, h: 0, o: 0 }),
     '　同じ人の2月ぶん（賞与が出た月）', JSON.stringify(await cmAt('a350', 2)));

  /* ⑥ 2か月のうち1か月が入力違い。
        ★DEEP PAY で平均するときは、この人を丸ごと落とすこと（半分だけの円を描かない）。 */
  ok(await cmAt('b737', 3) === null,
     '★⑥ 手当が総支給を超えている月は null（この人は丸ごと落とす材料になる）',
     JSON.stringify(await cmAt('b737', 3)));
  ok(eq(await cmAt('b737', 4), { m: 100, b: 0, d: 0, h: 0, o: 0 }),
     '　同じ人のもう1か月は普通に出る（だから「丸ごと落とす」を忘れると混ざる）');

  /* 端数の吸収が「たまたま」でないことを、総当たりで見る。 */
  const badSum = await rows(`
    select a, public.pv_pct5(a) c
      from (select array[i::numeric, j::numeric, k::numeric, l::numeric, m::numeric] a
              from generate_series(0, 7) i, generate_series(0, 7) j, generate_series(0, 7) k,
                   generate_series(0, 7) l, generate_series(0, 7) m
             where i + j + k + l + m > 0) t
     where (public.pv_pct5(a)->>'m')::int + (public.pv_pct5(a)->>'b')::int
         + (public.pv_pct5(a)->>'d')::int + (public.pv_pct5(a)->>'h')::int
         + (public.pv_pct5(a)->>'o')::int <> 100
     limit 5`);
  ok(badSum.length === 0,
     '★5本の割合を 8×8×8×8×8 通り試して、合計が 100 でないものが1つも無い',
     JSON.stringify(badSum));
  const negPct = await rows(`
    select a from (select array[i::numeric, j::numeric, k::numeric, l::numeric, m::numeric] a
              from generate_series(0, 7) i, generate_series(0, 7) j, generate_series(0, 7) k,
                   generate_series(0, 7) l, generate_series(0, 7) m
             where i + j + k + l + m > 0) t
     where least((public.pv_pct5(a)->>'m')::int, (public.pv_pct5(a)->>'b')::int,
                 (public.pv_pct5(a)->>'d')::int, (public.pv_pct5(a)->>'h')::int,
                 (public.pv_pct5(a)->>'o')::int) < 0 limit 5`);
  ok(negPct.length === 0, '　端数を吸収しても負の割合が出ない', JSON.stringify(negPct));

  ok((await one(`select public.pv_pct5(null::numeric[]) c`)).c === null,
     '　材料が無ければ null（画面は円グラフを出さない）');
  ok((await one(`select public.pv_pct5(array[0,0,0,0,0]::numeric[]) c`)).c === null,
     '　全部ゼロでも null（0で割らない）');

  const rawC = (await one(`select pv_pay_rows()::text t`)).t;
  ok(!/"(m|b|d|h|o)":/.test(rawC),
     '★REAL PAY の返り値に内訳の欄が1つも無い（丸ごと DEEP PAY に移した）');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 8. ★引数の面が無い');
// ════════════════════════════════════════════════════════════
ok((await boom(`select pv_pay_rows('${A_M12}')`)) !== null,
   '会社を指定して呼ぶことはできない');
ok((await one(`select pronargs::int n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                where s.nspname='public' and p.proname='pv_pay_rows'`)).n === 0,
   '関数は引数を1つも取らない');

// ════════════════════════════════════════════════════════════
console.log('\n▼ 9. 公開集計（pay_benchmarks）の5人未満ルールは今も生きている');
// ════════════════════════════════════════════════════════════
ok((await one(`select pg_get_viewdef('public.pay_benchmarks'::regclass) like '%>= 5%' b`)).b,
   '★一覧の門を外しても、集計側の5人未満ルールは緩めていない');

// ════════════════════════════════════════════════════════════
console.log('\n▼ 10. ★常識の幅（打ち間違いだけを落とす）');
// ════════════════════════════════════════════════════════════
/* ★これは外した p10-p90 のクリップとは別物。クリップは「同じ区分の実データに寄せる」＝
   本物の値を書き換える処理だった。こちらは固定の幅で、実在しうる年収は1つも落ちない。
   落ちるのは打ち間違いだけ。幅を狭めると本物の高給・訓練生の低給が消えるので狭めないこと。 */
{
  const band = only(R, x => x.airline === A_BAND);
  ok(band.length === 1, '★3人のうち、打ち間違いの2人は出ない', `= ${band.length}行`);
  ok(Number(band[0]?.annual_usd) === 15000 * 12,
     '　残るのは普通の額の1人だけ', JSON.stringify(band));
  ok((await one(`select count(*)::int c from pay_reports where airline = $1`, [A_BAND])).c === 3,
     '　（元の表には3行とも残っている＝消していない、出さないだけ）');
  const amounts = R.map(x => Number(x.annual_usd));
  ok(amounts.every(v => v >= 10000 && v <= 700000),
     '★画面に出る額がすべて年 $10,000〜$700,000 の中',
     JSON.stringify(amounts.filter(v => v < 10000 || v > 700000)));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 11. ★登録前の預かりも出る（そして二重に出ない）');
// ════════════════════════════════════════════════════════════
/* 給与は会員登録の前にも出せる。出した人の多くはそのあと登録しない＝本棚に移らない。
   本番で実際に、出した11件のうち7件が移らないまま寝ていた。
   出してくれたのに1行も出ないのは Give & Get の約束と食い違うので、ここも一覧に出す。 */
{
  const pd = only(R, x => x.airline === A_PEND);
  ok(pd.length === 2, '★預かりも行になる（同じ日の同じ人は1行に畳んで2人ぶん）',
     `= ${pd.length}行`);
  ok((await one(`select count(*)::int c from pay_reports_pending where airline = $1`, [A_PEND])).c === 3,
     '　（預かりの表には3行入っている＝同じ人の2件が畳まれている）');
  const folded = pd.find(x => Number(x.annual_usd) !== 20000 * 12);
  ok(Number(folded?.annual_usd) === pv2((15000 * 12 + 17000 * 12) / 2),
     '　畳んだ人は2か月の中央値（どちらの月とも違う額）になる', JSON.stringify(pd.map(x => x.annual_usd)));
  ok(pd.every(x => x.verified === false),
     '★預かりに ✓ Verified は付かない（明細検証の経路を通っていない）');

  ok(only(R, x => x.airline === A_CLAIMED).length === 0,
     '★本棚へ移した預かりは出ない（同じ人が二重に出ない）');
  ok(only(R, x => x.airline === A_NULLIP).length === 0,
     '　IP が取れなかった預かりは出ない（誰の行かまとめられない）');
  ok(only(R, x => x.airline === 'zzz-bogus').length === 0,
     '　語彙に無い会社コードの預かりは出ない（画面の辞書に無い）');
  ok((await one(`select count(*)::int c from pay_reports_pending`)).c === 7,
     '　（預かりの表そのものは7行のまま＝消していない、出さないだけ）');

  const raw2 = (await one(`select pv_pay_rows()::text t`)).t;
  ok(!raw2.includes('iph-') && !raw2.includes('claim_token') && !raw2.includes('ip_day_hash'),
     '★預かり証・回線のハッシュが返り値に1文字も無い');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12. ★預かりの年換算が、本棚に入れたときと1円まで一致する');
// ════════════════════════════════════════════════════════════
/* pv_pending_usd は年換算＋USD換算の2つめの実装になる（本棚は列に持っている）。
   定義そのもの（pv_annual_total）は共有しているが、payload の読み方と
   レートの掛け方はここが2つめ。片方だけ直されると静かにズレるので、
   同じ payload を submit_pay_report にも通して突き合わせる。 */
{
  const CROSS = [
    { m: 1,  label: '総支給だけ',           p: { gross_monthly: 15000 } },
    { m: 2,  label: '内訳だけ',             p: { base_pay: 9000, transport: 300, command_pay: 800,
                                                 other_allowance: 200, bonus_annual: 20000 } },
    { m: 3,  label: '時給＋保証時間＋実績', p: { hourly_rate: 200, guaranteed_hours: 75,
                                                 block_hours: 82, per_diem: 1200 } },
    { m: 4,  label: '住宅（手当）',         p: { base_pay: 9000, housing_type: 'allowance',
                                                 housing_amount: 2500 } },
    { m: 5,  label: '住宅（現物・足さない）', p: { base_pay: 9000, housing_type: 'provided',
                                                 housing_amount: 2500 } },
    { m: 6,  label: '★総支給と内訳の両方（内訳を捨てる側）',
                                            p: { gross_monthly: 15000, base_pay: 9000, transport: 300,
                                                 command_pay: 800, other_allowance: 200, per_diem: 1000,
                                                 housing_type: 'allowance', housing_amount: 2000 } },
    { m: 7,  label: 'ボーナスが出た月',     p: { gross_monthly: 40000, bonus_month: 25000 } },
    { m: 8,  label: '利益分配',             p: { base_pay: 9000, profit_share_annual: 5000 } },
    { m: 9,  label: '空文字が混ざる',       p: { gross_monthly: 15000, base_pay: '', transport: '',
                                                 housing_amount: '', bonus_annual: '' } },
    { m: 10, label: '円（レートを掛ける）', p: { currency: 'JPY', gross_monthly: 900000 } },
    { m: 11, label: 'ユーロ',               p: { currency: 'EUR', base_pay: 9000, bonus_annual: 15000 } },
    // ★レートの無い通貨は本棚側では作れない（currency に語彙の外部キーがある）。
    //   預かりは payload を寝かせるだけなので作れる。だから下で片側だけ見る。
  ];
  const u = ++seat; await asUser(u);
  for (const c of CROSS) {
    const payload = { ...BASE, airline: A_CROSS, position: 'cap', fleet: 'b777',
                      period_year: YEAR, period_month: c.m, ...c.p };
    await submit(payload);
    const stored = (await one(
      `select annual_total_usd v from pay_reports where airline = $1 and period_month = $2`,
      [A_CROSS, c.m])).v;
    const derived = (await one(`select pv_pending_usd($1::jsonb) v`, [JSON.stringify(payload)])).v;
    const same = (stored === null && derived === null)
              || (stored !== null && derived !== null && Number(stored) === Number(derived));
    ok(same, `${c.label}`, `本棚 ${stored} ≠ 預かり ${derived}`);

    /* ★内訳も同じ。pv_pending_comp は payload の読み方をもう一度書いている
       （額の pv_pending_usd とは別の関数）。片方だけ直されると静かにズレるので、
       同じ1件を本棚の列から作った割合と突き合わせる。 */
    const cmp = await one(`
      select public.pv_pending_comp($1::jsonb)::text a,
             (select public.pv_pay_comp(gross_monthly, base_pay, hourly_rate,
                       guaranteed_hours, block_hours, per_diem, housing_type,
                       housing_amount, transport, command_pay, other_allowance,
                       bonus_annual, profit_share_annual, bonus_month)::text
                from pay_reports where airline = $2 and period_month = $3) b`,
      [JSON.stringify(payload), A_CROSS, c.m]);
    ok(cmp.a === cmp.b, `　${c.label}（内訳の割合も一致）`,
       `預かり ${cmp.a} ≠ 本棚 ${cmp.b}`);
  }
  const noFx = (await one(`select pv_pending_usd($1::jsonb) v`, [JSON.stringify(
    { ...BASE, currency: 'ZZZ', airline: A_CROSS, position: 'cap', fleet: 'b777',
      period_year: YEAR, period_month: 1, gross_monthly: 15000 })])).v;
  ok(noFx === null, '★レートの無い通貨は null（本棚の annual_total_usd と同じ扱い）', String(noFx));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12-b. ★数え上げ（画面の上に並ぶ数字のうち、サーバから来る2つ）');
// ════════════════════════════════════════════════════════════
/* 2026-08-24 オーナー判断で「本当の数字だけ出す」ことになった。
   画面の4枚のうち2枚（表の行数・会社数）は rows を数えれば出るので、
   サーバが返すのは残り2つ（提出の件数・今月のぶん）だけ。

   ★いちばん大事なのは「行と同じ材料から数えていること」。
     別のところから数え直すと、画面に「126件」と出ているのに表が60行しかない
     理由を誰も説明できなくなる。だから下は全部**差分**で見る。 */
await asViewer();
{
  const s0 = await payRows();
  ok(s0.stats && typeof s0.stats === 'object' && !Array.isArray(s0.stats),
     '数え上げが返ってくる', JSON.stringify(s0.stats));
  ok(Number.isInteger(s0.stats.reports) && Number.isInteger(s0.stats.month),
     '2つとも整数（小数や文字列で返さない）', JSON.stringify(s0.stats));
  ok(s0.stats.reports >= s0.rows.length,
     '★件数は必ず表の行数以上（1人が何ヶ月ぶん出しても行は1つ）',
     `件数 ${s0.stats.reports} / 行 ${s0.rows.length}`);
  ok(s0.stats.reports - s0.rows.length >= 33,
     '　複数月を出した人のぶんだけ、件数のほうが多い（36件が3行に畳まれている）',
     `差 ${s0.stats.reports - s0.rows.length}`);
  ok(s0.stats.month <= s0.stats.reports, '　今月のぶんは件数を超えない');

  const b = { r: s0.stats.reports, m: s0.stats.month, n: s0.rows.length };

  // ① 新しい1人が1か月ぶん出す → 件数 +1・行 +1
  const U = await person(A_STAT, 'cap', [{ fleet: 'b777', month: 1, gross: 15000 }]);
  await asViewer();
  let t = await payRows();
  ok(t.stats.reports === b.r + 1 && t.rows.length === b.n + 1,
     '1人が1件出すと 件数 +1・行 +1', `件数 ${t.stats.reports} / 行 ${t.rows.length}`);
  ok(t.stats.month === b.m + 1, '　今月のぶんも +1', String(t.stats.month));

  // ② 同じ人がもう1か月ぶん出す → 件数だけ +1（行は増えない）
  await asUser(U);
  await submit({ ...BASE, airline: A_STAT, position: 'cap', fleet: 'b777',
                 period_year: YEAR, period_month: 2, gross_monthly: 15000 });
  await asViewer();
  t = await payRows();
  ok(t.stats.reports === b.r + 2 && t.rows.length === b.n + 1,
     '★同じ人がもう1か月出すと 件数だけ +1（行は増えない）',
     `件数 ${t.stats.reports} / 行 ${t.rows.length}`);

  // ③ 打ち間違い（常識の幅の外）は、表からも件数からも落ちる
  await db.query(`update pay_reports set annual_total_usd = 0.75
                   where airline = $1 and period_month = 2`, [A_STAT]);
  t = await payRows();
  ok(t.stats.reports === b.r + 1,
     '★常識の幅の外は件数からも落ちる（表と同じ材料から数えている証拠）',
     `件数 ${t.stats.reports}`);

  // ④ 24ヶ月の窓の外も同じ
  await backdateAirline(A_STAT, 800);
  t = await payRows();
  ok(t.stats.reports === b.r && t.rows.length === b.n,
     '★24ヶ月の窓の外は件数からも落ちる', `件数 ${t.stats.reports} / 行 ${t.rows.length}`);
  ok(t.stats.month === b.m, '　今月のぶんにも入らない', String(t.stats.month));

  // ⑤ 鍵が無い人には数字も返らない（数字も鍵の内側）
  await asUser(9001);
  const lk = await payRows();
  ok(lk.state === 'locked' && !('stats' in lk),
     '★鍵の無い人には数字が1つも返らない', JSON.stringify(lk));
  await asViewer();
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12-c. ★昔の口コミに書かれた給与も一覧に混ざる');
// ════════════════════════════════════════════════════════════
/* 口コミの持ち主キーは submit-review.html が作る。塩をここに書き写すと、
   あちらを直したときにテストだけ通り続けて本番が黙って壊れる。
   だから**あちらから読み取って**、db/pay-rows.sql が同じ塩を使っていることも見る。 */
const SR = read('submit-review.html');
const SALT = SR.match(/encode\(\s*userId \+ '([^']+)' \+ airline \+ '([^']+)'\s*\)/);
ok(!!SALT, '口コミの持ち主キーの作り方を submit-review.html から読み取れた');
const PR_SRC = read('db/pay-rows.sql');
ok(!!SALT && PR_SRC.includes(`'${SALT[1]}'`) && PR_SRC.includes(`'${SALT[2]}'`),
   '★対応表が口コミと同じ塩を使っている（片方だけ直すとここで落ちる）',
   SALT ? `${SALT[1]} / ${SALT[2]}` : '');

const { createHash } = await import('node:crypto');
const revHash = (u, air) =>
  createHash('sha256').update(uid(u) + SALT[1] + air + SALT[2]).digest('hex');

/* 口コミを1件置く。金額は万円で入る（口コミは原本通貨を持たない）。 */
let revSeat = 3000;
const review = async (air, pos, cols, days = 5) => {
  const u = ++revSeat;
  await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`,
    [uid(u), `r${u}@example.com`]);
  await db.query(
    `insert into reviews_v2(proof_hash, airline, "position", annual_salary, base_annual,
                            flight_allowance_annual, monthly_salary, bonus, created_at)
     values($1,$2,$3,$4,$5,$6,$7,$8, now() - ($9 || ' days')::interval)`,
    [revHash(u, air), air, pos, cols.ann ?? null, cols.base ?? null, cols.fa ?? null,
     cols.mon ?? null, cols.bon ?? null, String(days)]);
  return u;
};

/* 同じ人が給与明細も出している会社。明細が採られて口コミが落ちるはず。 */
const dupUid = await person(A_RV_DUP, 'cap', [{ fleet: 'b777', month: 4, gross: 10000 }]);
await db.query(
  `insert into reviews_v2(proof_hash, airline, "position", monthly_salary, bonus)
   values($1,$2,'captain',100,200)`, [revHash(dupUid, A_RV_DUP), A_RV_DUP]);

await review(A_RV_MON,  'captain', { mon: 100, bon: 200 });   // 月給×12＋賞与 = 1400万
await review(A_RV_ANN,  'fo',      { ann: 3000, mon: 999 });  // 総額が最優先 = 3000万
await review(A_RV_SUM,  'captain', { base: 2000, fa: 500, bon: 300 }); // 合算 = 2800万
await review(A_RV_NONE, 'fo',      {});                        // 金額が無い＝一覧に出ない

/* 対応表は pay-rows.sql を流したときに埋まる。口コミを足したので流し直す。
   ★ここで冪等性も一緒に確かめている（何度流しても同じ）。 */
await db.exec(read('db/pay-rows.sql'));

const JPY = Number((await one(`select to_usd from fx_rates where code = 'JPY'`)).to_usd);
const man2usd = (man) => pv2(Math.round(man * 10000 * JPY * 100) / 100);

await asViewer();
const RV = (await payRows()).rows;
const pick = (air) => only(RV, x => x.airline === air);

ok(pick(A_RV_MON).length === 1 && pick(A_RV_MON)[0].annual_usd == man2usd(1400),
   '月給×12＋賞与の口コミが1行になる（口コミカードと同じ式）',
   JSON.stringify(pick(A_RV_MON)));
ok(pick(A_RV_ANN).length === 1 && pick(A_RV_ANN)[0].annual_usd == man2usd(3000),
   '総額が入っている口コミは総額を採る（月給を足さない）',
   JSON.stringify(pick(A_RV_ANN)));
ok(pick(A_RV_SUM).length === 1 && pick(A_RV_SUM)[0].annual_usd == man2usd(2800),
   '基本給＋乗務手当＋賞与の口コミも1行になる',
   JSON.stringify(pick(A_RV_SUM)));
ok(pick(A_RV_NONE).length === 0, '金額の無い口コミは一覧に出ない');
ok(pick(A_RV_MON).every(x => x.verified === false),
   '★口コミ由来の行は verified が false（明細の裏付けは無い）');
ok(pick(A_RV_MON)[0].pos === 'cap' && pick(A_RV_SUM)[0].pos === 'cap',
   "★古い職位コード（captain）が cap に寄る", JSON.stringify(pick(A_RV_MON)[0]));

ok(pick(A_RV_DUP).length === 1 && pick(A_RV_DUP)[0].verified === false
   && pick(A_RV_DUP)[0].annual_usd == pv2(10000 * 12),
   '★同じ人が明細も出していたら明細を採り、口コミ側は落ちる（1行のまま）',
   JSON.stringify(pick(A_RV_DUP)));

ok((await one(`select count(*)::int n from pv_review_person`)).n === 4,
   '★対応表に入るのは金額を持つ口コミだけ（4件）',
   String((await one(`select count(*)::int n from pv_review_person`)).n));
ok(!(await one(`select has_table_privilege('anon','public.pv_review_person','select') b`)).b
   && !(await one(`select has_table_privilege('authenticated','public.pv_review_person','select') b`)).b,
   '★対応表は anon にも会員にも開いていない');

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12-d. ★投稿の時期は5段の粗い区分だけ');
// ════════════════════════════════════════════════════════════
/* 段の境目。1ヶ月／3ヶ月／6ヶ月／1年 の内と外に、余裕を持たせて置く。
   ★段は「その人のいちばん新しい提出」から決まる。 */
const AGE_CASES = [[20, 0], [40, 1], [100, 2], [200, 3], [400, 4]];
for (const [days, want] of AGE_CASES) {
  const u = await review(A_AGE, 'fo', { ann: 1000 + days }, days);
  ok(true, `　${days}日前の口コミを1件置いた（uid ${u % 1000}）`);
}
await db.exec(read('db/pay-rows.sql'));
await asViewer();
{
  const got = only((await payRows()).rows, x => x.airline === A_AGE)
    .map(x => x.age).sort((a, b) => a - b);
  ok(JSON.stringify(got) === JSON.stringify(AGE_CASES.map(c => c[1])),
     '★20/40/100/200/400日前が 0/1/2/3/4 の段に分かれる', JSON.stringify(got));
}
{
  /* 同じ人が古い月と新しい月を出していたら、新しいほうの段になる。 */
  const u = await person(A_OLD, 'cadet', [{ fleet: 'b737', month: 6, gross: 4000 }]);
  await db.query(`update pay_reports set created_at = now() - interval '400 days'
                   where airline = $1 and created_at > now() - interval '1 day'`, [A_OLD]);
  await asUser(u);
  await submit({ ...BASE, airline: A_OLD, position: 'cadet', fleet: 'b737',
                 period_year: YEAR, period_month: 7, gross_monthly: 4000 });
  await asViewer();
  const row = only((await payRows()).rows, x => x.airline === A_OLD && x.pos === 'cadet');
  ok(row.length === 1 && row[0].age === 0,
     '★同じ人の古い月と新しい月は1行に畳まれ、段は新しいほうになる', JSON.stringify(row));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 13. 自己点検 SQL（ファイル末尾のものをそのまま流す）');
// ════════════════════════════════════════════════════════════
{
  const src = read('db/pay-rows.sql');
  const q = src.slice(src.lastIndexOf('with f as ('));
  const res = await rows(q);
  ok(res.length === 32, `自己点検が32行ぜんぶ出る（= ${res.length}行）`);
  for (const row of res) {
    ok(row['結果'] === '✅', `${row['#']}. ${row['見るところ']}`);
  }
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 14. 8-20（pay_reports を読む関数が anon に開いていないこと）');
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
