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
const VOCAB = (await rows(
  `select code, name_ja, name_en from pv_airlines
    where code <> 'other' and active order by code limit 34`
));
const AIR = VOCAB.map(r => r.code);
const [A_ONE, A_M12, A_MIX, A_OLD, A_ORD, A_VF, A_OUT, A_FOTHER,
       A_BAND, A_PEND, A_CLAIMED, A_NULLIP, A_CROSS, A_COMP, A_STAT,
       A_RV_MON, A_RV_ANN, A_RV_SUM, A_RV_DUP, A_RV_NONE, A_AGE,
       A_AGE2, A_EDGE, A_NM_JA, A_NM_EN, A_NM_CODE, A_RV_FREE,
       A_GV_BASIC, A_GV_DET, A_GV_PS, A_GV_OTHER, A_GV_ITEMS, A_GV_GUAR,
       A_CROSS2] = AIR;
const nameOf = (code) => VOCAB.find(r => r.code === code);

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
console.log('\n▼ 6. ★並びは新しい順（2026-08-25。前は md5 順だった）');
// ════════════════════════════════════════════════════════════
/* ★オーナー指示で md5 順をやめ、新しい順（新しいほうが上）にした。
   A_ORD の6人は「投稿順に金額が増える」ように作ってあるので、
   新しい順に並んでいれば金額は降順になる。 */
{
  const got = only(R, x => x.airline === A_ORD).map(x => Number(x.annual_usd));
  // ★丸めたあとの額で比べる。生の額で比べると、丸めのせいで
  //   「並びが違う」といつでも言えてしまい、検査が何も見なくなる。
  const desc = ORD_GROSS.map(g => pv2(g * 12)).reverse();
  ok(got.length === 6, '並びを見る会社は6人ぶん出る', `= ${got.length}行`);
  ok(new Set(got).size === 6, '　6人の額はすべて違う（並びが読める形になっている）',
     JSON.stringify(got));
  ok(got.join() === desc.join(), '★新しい順（新しいほうが上）に並んでいる',
     JSON.stringify(got));
}
{
  // 2回呼んでも同じ並び（同着でも md5 が第2キーで押さえる）
  const a = (await payRows()).rows.map(x => `${x.airline}/${x.pos}/${x.annual_usd}`).join('|');
  const b = (await payRows()).rows.map(x => `${x.airline}/${x.pos}/${x.annual_usd}`).join('|');
  ok(a === b, '何度呼んでも同じ並び（同着は md5 で固定）');
}
{
  /* ★並びと右端の列が食い違わないこと。
     新しい順（新しいほうが上）に並び、段はその同じ時刻から決まるので、
     上から下へ段は必ず 0→4 の向きにしか動かない。逆流したら、
     並べるのに使った時刻と段を出した時刻が別物になっている。 */
  const ages = R.map(x => x.age);
  const bad  = ages.findIndex((a, i) => i > 0 && a < ages[i - 1]);
  ok(bad === -1, '★上から下へ段が逆流しない（並びと投稿時期が同じ時刻から出ている）',
     bad === -1 ? '' : `${bad}行目 ${ages[bad - 1]} → ${ages[bad]}`);
}
{
  // 並べるのに使う時刻は返していない（返すと秒単位の提出時刻がそのまま漏れる）
  const t = (await one(`select pv_pay_rows()::text t`)).t;
  ok(!t.includes('last_at'), '★並べるのに使う時刻（last_at）を行に入れていない');
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

  /* ⑦ 保証給・教官・審査の手当（2026-08-26）。pv_pay_comp は「引数の並びが pv_annual_total と
     1文字も違わない」「5本の合計があちらの返り値と一致する」を約束している。
     片方だけに引数を足すと、その2つが黙って破れる。 */
  const nc = await one(`select p.pronargs n from pg_proc p join pg_namespace s on s.oid=p.pronamespace
                         where s.nspname='public' and p.proname='pv_pay_comp'`);
  ok(Number(nc.n) === 17, `★pv_pay_comp も17引数（pv_annual_total と同じ並び）→ ${nc.n}`);
  const gcomp = await one(`
    select public.pv_pct5(public.pv_pay_comp(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, 5000, null)) c,
           public.pv_annual_total(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, 5000, null) v`);
  ok(gcomp.c && gcomp.c.m === 100 && Number(gcomp.v) === 300000,
     '★保証給は「月々の支給（m）」に入る（灰色にも賞与にも落ちない）',
     JSON.stringify(gcomp));

  const icomp = await one(`
    select public.pv_pct5(public.pv_pay_comp(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, 600)) c,
           public.pv_annual_total(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, 600) v`);
  /* 教官の手当は「その他の手当（o）」の側。保証給（m）と行き先が違うのは、
     保証給が基本給と同じ「毎月の下限」なのに対し、教官の手当は職位手当や
     交通費と同じ手当だから。o に入れておくと DEEP PAY で
     「基本給の割合」を出したときに教官の分が混ざらない。 */
  ok(icomp.c && icomp.c.m === 97 && icomp.c.o === 3 && Number(icomp.v) === 247200,
     '★教官の手当は「その他の手当（o）」に入る（賞与にも住宅にも落ちない）',
     JSON.stringify(icomp));

  /* ★審査・査察の手当（2026-08-26 その4）。教官と同じ「その他の手当（o）」。
     m（月々の支給）に混ぜると DEEP PAY の「基本給の割合」が審査の手当で汚れる。 */
  const xcomp = await one(`
    select public.pv_pct5(public.pv_pay_comp(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, null, 600)) c,
           public.pv_annual_total(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, null, 600) v`);
  ok(xcomp.c && xcomp.c.m === 97 && xcomp.c.o === 3 && Number(xcomp.v) === 247200,
     '★審査の手当も「その他の手当（o）」に入る（教官と同じ扱い）',
     JSON.stringify(xcomp));
  /* ★教官と審査を両方入れても、片方に吸われず両方 o に積まれる。
     年額 240,000（基本給）＋7,200（教官）＋7,200（審査）＝254,400 のうち
     o は 14,400 ＝ 5.66% → 丸めて 6%。片方だけしか積まれていなければ 3% になる。 */
  const bcomp = await one(`
    select public.pv_pct5(public.pv_pay_comp(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, 600, 600)) c,
           public.pv_annual_total(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, 600, 600) v`);
  ok(bcomp.c && bcomp.c.o === 6 && bcomp.c.m === 94 && Number(bcomp.v) === 254400,
     '★教官と審査は別々に積まれる（o に両方ぶん）', JSON.stringify(bcomp));

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
    /* ★2026-08-26 に足した2列。どちらも「内訳だけの行」でしか効かない
       （総支給がある行は pv_annual_total が内訳を一切見ない）。
       だから内訳だけの形と、総支給と両方ある形の2通りを通す。 */
    { m: 12, label: '保証給（内訳だけ）',   p: { base_pay: 9000, guarantee_pay: 2000 } },
    /* 月は1〜12しか無く上で使い切ったので、ここから先は別の会社で数える
       （行の引き当ては「会社＋月」で、年では絞っていない）。 */
    { m: 1,  a: A_CROSS2, label: '★教官の手当（内訳だけ）',
                                            p: { base_pay: 9000, instructor_pay: 600 } },
    { m: 2,  a: A_CROSS2, label: '★教官の手当（総支給がある＝効かない側）',
                                            p: { gross_monthly: 15000, base_pay: 9000, instructor_pay: 600 } },
    // ★レートの無い通貨は本棚側では作れない（currency に語彙の外部キーがある）。
    //   預かりは payload を寝かせるだけなので作れる。だから下で片側だけ見る。
  ];
  const u = ++seat; await asUser(u);
  for (const c of CROSS) {
    const air = c.a || A_CROSS;
    const payload = { ...BASE, airline: air, position: 'cap', fleet: 'b777',
                      period_year: YEAR, period_month: c.m, ...c.p };
    await submit(payload);
    const stored = (await one(
      `select annual_total_usd v from pay_reports where airline = $1 and period_month = $2`,
      [air, c.m])).v;
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
                       bonus_annual, profit_share_annual, bonus_month,
                       /* ★2026-08-26 に足した2列。ここに渡し忘れると、本棚の側だけ
                          その額を持たない図になり、預かりと静かにズレる。 */
                       guarantee_pay, instructor_pay)::text
                from pay_reports where airline = $2 and period_month = $3) b`,
      [JSON.stringify(payload), air, c.m]);
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
   サーバが返すのは残り2つ（提出の件数・直近1ヶ月のぶん）だけ。

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
  ok(s0.stats.month <= s0.stats.reports, '　直近1ヶ月のぶんは件数を超えない');

  const b = { r: s0.stats.reports, m: s0.stats.month, n: s0.rows.length };

  // ① 新しい1人が1か月ぶん出す → 件数 +1・行 +1
  const U = await person(A_STAT, 'cap', [{ fleet: 'b777', month: 1, gross: 15000 }]);
  await asViewer();
  let t = await payRows();
  ok(t.stats.reports === b.r + 1 && t.rows.length === b.n + 1,
     '1人が1件出すと 件数 +1・行 +1', `件数 ${t.stats.reports} / 行 ${t.rows.length}`);
  ok(t.stats.month === b.m + 1, '　直近1ヶ月のぶんも +1', String(t.stats.month));

  // ② 同じ人がもう1か月ぶん出す → 件数だけ +1（行は増えない）
  await asUser(U);
  await submit({ ...BASE, airline: A_STAT, position: 'cap', fleet: 'b777',
                 period_year: YEAR, period_month: 2, gross_monthly: 15000 });
  await asViewer();
  t = await payRows();
  ok(t.stats.reports === b.r + 2 && t.rows.length === b.n + 1,
     '★同じ人がもう1か月出すと 件数だけ +1（行は増えない）',
     `件数 ${t.stats.reports} / 行 ${t.rows.length}`);

  /* ②-b ★窓は「暦の月」ではなく「直近1ヶ月」（2026-08-25 オーナー指示）。
        20日前に出した1件は、月の何日に走らせても必ず「直近1ヶ月」に入る。
        date_trunc('month', now()) に戻すと、**毎月20日より前に走らせた日だけ**
        この行が落ちてここが赤くなる（＝暦の月に戻したことに気づける）。 */
  await db.query(`update pay_reports set created_at = now() - interval '20 days'
                   where airline = $1 and period_month = 2`, [A_STAT]);
  t = await payRows();
  ok(t.stats.month === b.m + 2,
     '★20日前の1件も「直近1ヶ月」に入る（暦の月で数えていない）',
     `${t.stats.month} / 期待 ${b.m + 2}`);

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
  ok(t.stats.month === b.m, '　直近1ヶ月のぶんにも入らない', String(t.stats.month));

  /* ⑤ 鍵が無い人に何が返るか。
        ★2026-08-25、オーナー判断でここが**反転した**。前は「数字も鍵の内側」として
          stats ごと落としていた。いまは数え上げだけ返す。
          出す前の人に「どれだけ集まっているか」が見えないと Give & Get を
          選びようがない、というのが理由。
        ⚠️ 反転したのは数字だけ。**行は今までどおり1つも返らない**。
          下の3つが、それを別々の角度から押さえている。 */
  await asUser(9001);
  const lk = await payRows();
  ok(lk.state === 'locked' && lk.rows.length === 0,
     '★鍵の無い人には行が1つも返らない', JSON.stringify(lk.rows));
  ok(typeof lk.stats === 'object' && lk.stats
     && typeof lk.stats.reports === 'number'
     && typeof lk.stats.airlines === 'number'
     && typeof lk.stats.contributors === 'number',
     '★鍵の無い人にも数え上げは返る（2026-08-25 に反転）', JSON.stringify(lk.stats));
  /* ★いちばん大事な1本。返り値の文字列のどこにも金額が無いこと。
       stats を返すようになった以上、「うっかり金額まで載る」道は
       件数の隣が一番近い。行の金額（下の open 側で確かめた値）が
       1つも混ざっていないことを、丸ごとの文字列で見る。 */
  const lkTxt = JSON.stringify(lk);
  ok(!/annual|usd|pay_?amount|salary/i.test(lkTxt),
     '★鍵の無い人の返り値に金額らしき語が1つも無い', lkTxt.slice(0, 160));
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
console.log('\n▼ 12-e. ★段が「その人の本当の投稿日」と1つずつ合っている');
// ════════════════════════════════════════════════════════════
/* ★オーナー指示（2026-08-25）「投稿時期の列はちゃんと本人の投稿時期と
   正確にあってるかも一緒に検証して」。
   上の 12-d は「20日前は0、40日前は1」のように、境目から離れたところしか見ていない。
   ここでは (a) 境目そのものの内と外 (b) 一覧に出ている行を1つずつ生のテーブルと
   突き合わせる、の2つを見る。 */
{
  /* (a) 境目。「1ヶ月」はカレンダー基準（2月と8月で長さが違う）なので、
     日数ではなく**同じ interval を使って** 6時間だけ内と外にずらす。
     8人ぶんを金額で見分けられるようにしてある（丸めても重ならない額）。 */
  const IV = [['1 month', 0, 1], ['3 months', 1, 2], ['6 months', 2, 3], ['12 months', 3, 4]];
  const want = [];
  let g = 10000;
  for (const [iv, inner, outer] of IV) {
    for (const side of ['in', 'out']) {
      await person(A_EDGE, 'cap', [{ fleet: 'b777', month: 11, gross: g }]);
      const off = side === 'in' ? `interval '${iv}' - interval '6 hours'`
                                : `interval '${iv}' + interval '6 hours'`;
      await db.query(`update pay_reports set created_at = now() - (${off})
                       where airline = $1 and annual_total_usd = $2`, [A_EDGE, g * 12]);
      want.push({ usd: pv2(g * 12), age: side === 'in' ? inner : outer, iv, side });
      g += 1000;
    }
  }
  await asViewer();
  const got = only((await payRows()).rows, x => x.airline === A_EDGE);
  ok(got.length === 8, '境目に置いた8人が8行として出る', `= ${got.length}行`);
  for (const w of want) {
    const row = got.find(x => Number(x.annual_usd) === w.usd);
    ok(!!row && row.age === w.age,
       `　★${w.iv} の${w.side === 'in' ? '内側' : '外側'}6時間 → 段 ${w.age}`,
       row ? `= ${row.age}` : '行が見つからない');
  }
}
{
  /* (b) 一覧に出ている行を1つずつ、生の pay_reports から数え直したものと突き合わせる。
     関数の中の CTE を通らずに、テーブルから直接「人ごとのいちばん新しい提出」を出す。
     ・group by を間違えている（別の人の日付を貼っている）
     ・max ではなく min を見ている（初回の日付が出ている）
     ・口コミや預かりと取り違えている
     このどれが起きても、ここで金額と段の組が食い違う。
     ★預かり（人の単位が違う）と、打ち込まれた社名の行（12-e(a) の担当）は外す。 */
  const SKIP = [A_PEND, A_CLAIMED, A_NULLIP, 'other',
                A_RV_MON, A_RV_ANN, A_RV_SUM, A_RV_NONE, A_RV_FREE, A_AGE];
  const exp = await rows(`
    select r.airline,
           r."position" as pos,
           public.pv_sig2((percentile_cont(0.5) within group
             (order by r.annual_total_usd))::numeric) as usd,
           case when max(r.created_at) >= now() - interval '1 month'   then 0
                when max(r.created_at) >= now() - interval '3 months'  then 1
                when max(r.created_at) >= now() - interval '6 months'  then 2
                when max(r.created_at) >= now() - interval '12 months' then 3
                else 4 end as age
      from pay_reports r
     where r.annual_total_usd is not null
       and r.annual_total_usd between 10000 and 700000
       and r.created_at >= now() - interval '24 months'
       and r.airline <> 'other'
     group by r.proof_hash, r.airline, r."position"
  `);
  const key = (x) => `${x.airline}/${x.pos}/${Number(x.usd ?? x.annual_usd)}/${x.age}`;
  const mine = only((await payRows()).rows, x => !SKIP.includes(x.airline));
  const A = exp.map(key).sort();
  const B = mine.map(key).sort();
  ok(A.length === B.length && A.join('|') === B.join('|'),
     `★${B.length}行すべて、段が生のテーブルの「その人の最新の提出」と一致する`,
     A.join('|') === B.join('|') ? ''
       : `違い: ${A.filter(x => !B.includes(x)).slice(0, 3).join(' , ')}`);
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12-f. ★打ち込まれた社名を「知っている航空会社」に寄せる');
// ════════════════════════════════════════════════════════════
/* ★オーナー指示（2026-08-25）「REAL PAY の『その他の航空会社』ってなに？
   失礼じゃない？ちゃんと航空会社名書いて」。
   打ち込まれた文字列は外に出せない（準識別子になる）ので、語彙に当ててから出す。
   当たれば本当の社名、当たらなければ 'other'。 */
{
  const typeIn = async (air, typed) => {
    const u = ++seat; await asUser(u);
    await submit({ ...BASE, airline: 'other', airline_other: typed, position: 'cap',
                   fleet: 'b737', period_year: YEAR, period_month: 12, gross_monthly: 15000 });
    return u;
  };
  await typeIn(A_NM_JA,   nameOf(A_NM_JA).name_ja);              // 和名そのまま
  await typeIn(A_NM_EN,   nameOf(A_NM_EN).name_en.toUpperCase()); // 英名・大文字
  await typeIn(A_NM_CODE, ' ' + A_NM_CODE.replace(/-/g, ' ') + ' '); // コード・空白とハイフンのゆれ

  await asViewer();
  const RR = (await payRows()).rows;
  for (const [air, how] of [[A_NM_JA, '和名'], [A_NM_EN, '英名（大文字）'],
                            [A_NM_CODE, 'コード（空白・ハイフンのゆれ）']]) {
    ok(only(RR, x => x.airline === air).length === 1,
       `★「その他」に${how}を打った人が、その航空会社の行として出る（${air}）`,
       `= ${only(RR, x => x.airline === air).length}行`);
  }
  ok(only(RR, x => x.airline === 'other').length === 2,
     "★語彙に無い社名を打った人は 'other' のまま（画面が「一覧にない航空会社」と書く）",
     `= ${only(RR, x => x.airline === 'other').length}行`);
  const raw2 = (await one(`select pv_pay_rows()::text t`)).t;
  ok(!raw2.includes(OTHER_NAME) && !raw2.toLowerCase().includes('somewhere'),
     '★寄せたあとも、打ち込まれた文字列そのものは1文字も返っていない');
  ok(!(await one(`select has_function_privilege('anon','public.pv_airline_resolve(text)','execute') b`)).b
     && !(await one(`select has_function_privilege('authenticated','public.pv_airline_resolve(text)','execute') b`)).b,
     '★社名を寄せる関数は誰にも開いていない（総当たりで語彙を舐められない）');
  ok((await one(`select public.pv_airline_resolve($1) c`, ['ぜんぜん違う会社'])).c === 'other'
     && (await one(`select public.pv_airline_resolve($1) c`, [''])).c === 'other'
     && (await one(`select public.pv_airline_resolve(null) c`)).c === 'other',
     "★当たらない・空・null はすべて 'other'（前方一致や部分一致で当てない）");
}
{
  /* 口コミ側は社名の欄そのものが自由入力になりうる（submit-review.html の
     effectiveAirline）。素通しすると打ち込まれた文字列が画面に出る。 */
  await review(A_RV_FREE, 'captain', { ann: 1500 });
  await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`,
    [uid(3900), 'free@example.com']);
  await db.query(
    `insert into reviews_v2(proof_hash, airline, "position", annual_salary)
     values($1, $2, 'captain', 1600)`,
    [createHash('sha256').update(uid(3900) + SALT[1] + 'ぼくの会社' + SALT[2]).digest('hex'),
     'ぼくの会社']);
  await db.exec(read('db/pay-rows.sql'));
  await asViewer();
  const RF = (await payRows()).rows;
  ok(only(RF, x => x.airline === A_RV_FREE).length === 1,
     '★口コミの社名がコードのときは、そのまま その航空会社の行になる');
  const t = (await one(`select pv_pay_rows()::text t`)).t;
  ok(!t.includes('ぼくの会社'),
     '★口コミの社名の欄に打ち込まれた文字列も、そのままでは1文字も返らない');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12-g. ★本人が何を出したか（DEEP PAY の個人条件）');
// ════════════════════════════════════════════════════════════
/* DEEP PAY が本人に開く条件は2つで、どちらも満たしたときだけ（オーナー決定・2026-08-25）。
     ① 給与を出したユニークな人が 100人 …… stats.contributors（上の 12-b）
     ② 本人が「くわしく」出している ……… ここで見る give.detailed
   ★①と②は別々に判定する。100人は Privacy Threshold ではなく、
     「DEEP PAY という機能を正式に開ける区切り」でしかない。

   ★DEEP PAY のために新しい列は1つも作っていない。総支給と内訳は 2026-08-26 から
     **両立する**ので、判定は「内訳の欄が1つでも埋まっているか」で見る。
     つまり**過去に内訳で出してくれた人は、さかのぼって条件を満たす**。 */
{
  const give = async () => (await payRows()).give;

  // (a) 一度も出していない人
  await asUser(9101);
  const g0 = await give();
  ok(g0 && g0.basic === false && g0.detailed === false && g0.payslip === false,
     '★一度も出していない人は3つとも false', JSON.stringify(g0));

  // (b) かんたん入力だけ（総支給1本）
  const uB = ++seat; await asUser(uB);
  await submit({ ...BASE, airline: A_GV_BASIC, position: 'cap', fleet: 'b777',
                 period_year: YEAR, period_month: 2, gross_monthly: 15000 });
  const gB = await give();
  ok(gB.basic === true && gB.detailed === false && gB.payslip === false,
     '★かんたん入力だけの人は basic だけ true（REAL PAY は開くが DEEP PAY の準備は未了）',
     JSON.stringify(gB));

  // (c) くわしく入力（内訳）。昔の形＝総支給の代わりに内訳を入れた人
  const uD = ++seat; await asUser(uD);
  await submit({ ...BASE, airline: A_GV_DET, position: 'cap', fleet: 'b777',
                 period_year: YEAR, period_month: 2,
                 base_pay: 9000, command_pay: 2000, per_diem: 1200,
                 transport: 300, other_allowance: 500 });
  const gD = await give();
  ok(gD.basic === true && gD.detailed === true && gD.payslip === false,
     '★内訳を出した人は detailed も true（DEEP PAY の個人条件はここで満たす）',
     JSON.stringify(gD));

  /* (c2) ★新しい形（2026-08-26）。総支給はそのまま残し、内訳は「変動給の行」で書く。
     固定・保証給は「該当なし」を選べるので base_pay が入らないことがある。
     判定を `gross_monthly is null and base_pay is not null` に戻すと、
     この人が丸ごと「内訳なし」に落ちる。画面は普通に動くので誰も気づけない。 */
  const uI = ++seat; await asUser(uI);
  await submit({ ...BASE, airline: A_GV_ITEMS, position: 'cap', fleet: 'b777',
                 period_year: YEAR, period_month: 2,
                 gross_monthly: 15000, base_pay: null, flight_variable_pay: 4000,
                 other_allowance: 4500,
                 pay_items: { v: 1, fixed_none: true,
                              variable: [{ amount: 4000, basis: 'block', label: 'Flight Pay' }],
                              other: [{ amount: 500, label: '通勤手当' }] } });
  const gI = await give();
  ok(gI.basic === true && gI.detailed === true,
     '★総支給を残したまま内訳の行を書いた人も detailed が true', JSON.stringify(gI));

  /* (c3) ★保証給だけを書いた人（2026-08-26）。米国型の会社には「基本給」という項目が
     無く、Minimum Guarantee が下限として1本立つだけのことがある。判定に
     guarantee_pay を入れ忘れると、この人が丸ごと「内訳なし」に落ちる。 */
  const uG = ++seat; await asUser(uG);
  await submit({ ...BASE, airline: A_GV_GUAR, position: 'cap', fleet: 'b777',
                 period_year: YEAR, period_month: 2,
                 gross_monthly: 15000, base_pay: null, guarantee_pay: 8000 });
  const gG = await give();
  ok(gG.basic === true && gG.detailed === true,
     '★保証給だけを書いた人も detailed が true（基本給の無い会社を落とさない）',
     JSON.stringify(gG));

  // (d) 明細から。★読み取れた行は内訳の欄が埋まるので、detailed も自動で true になる。
  //     オーナー指示「Payslip を出した人に Detailed Form をもう一度入力させない」は
  //     特別扱いを書かなくても、この形のまま満たされる。
  const uP = ++seat; await asUser(uP);
  await submit({ ...BASE, airline: A_GV_PS, position: 'cap', fleet: 'b777',
                 period_year: YEAR, period_month: 3,
                 base_pay: 9500, command_pay: 2100, per_diem: 1000 });
  await db.query(`update pay_reports set verify_level = 1 where airline = $1`, [A_GV_PS]);
  const gP = await give();
  ok(gP.basic === true && gP.detailed === true && gP.payslip === true,
     '★明細から出した人は3つとも true（もう一度フォームを入れさせない）',
     JSON.stringify(gP));

  // (e) 隣の人が出しても自分の条件は動かない
  await asUser(uB);
  const gB2 = await give();
  ok(gB2.basic === true && gB2.detailed === false,
     '★他人が内訳を出しても、自分の detailed は false のまま', JSON.stringify(gB2));

  // (f) 「一覧にない会社」に打ち込んだ人も、自分の行として拾える
  const uO = ++seat; await asUser(uO);
  await submit({ ...BASE, airline: 'other', airline_other: 'Nowhere Air', position: 'cap',
                 fleet: 'b737', period_year: YEAR, period_month: 4,
                 base_pay: 8800, command_pay: 1500 });
  const gO = await give();
  ok(gO.basic === true && gO.detailed === true,
     '★社名を打ち込んで出した人も、自分の条件として拾える', JSON.stringify(gO));

  // (g) 返っているのは真偽3つだけ。金額も件数も日付もここから出ない。
  const keys = Object.keys(gP).sort().join(',');
  ok(keys === 'basic,detailed,payslip', `★返るのは真偽3つだけ（= ${keys}）`);
  ok(Object.values(gP).every(v => typeof v === 'boolean'),
     '★3つとも真偽値（数を混ぜていない）', JSON.stringify(gP));

  // (h) 鍵が無い人にも返る。DEEP PAY の準備は REAL PAY を開ける前からできる。
  await asUser(9102);
  const lk = await payRows();
  ok(lk.state === 'locked' && lk.give && lk.give.basic === false,
     '★鍵が無い人にも give は返る（先に内訳を出した人が損をしないための表示に使う）',
     JSON.stringify(lk.give));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12-h. ★DEEP PAY の札を、左メニューを持つどの画面でも同じ数にする');
// ════════════════════════════════════════════════════════════
/* 左メニュー（マイレポート／REAL PAY／DEEP PAY／VERIFIED PAY／設定）は4画面に
   同じものが出ていて、DEEP PAY を押すとどこでも同じ説明が開く。
   ところが数を持っているのは pv_pay_rows() を引く2画面だけで、残りは
   「準備中」のままだった＝**同じボタンなのに画面によって答えが違う**（2026-08-25）。

   ではなぜ全画面で pv_pay_rows() を引かないか。
   鍵を持つ人が引くと**一覧が丸ごと付いてくる**（あの関数の本体は行）。
   pv_give_progress() は札に要る2つだけを返す口で、行を1つも作らない。

   ★ここで見るのはただ1つ ── **一覧の数と札の数が必ず同じであること**。
     数え方を書き写すと静かにずれるので、両方が pv_contributors() を呼ぶ形にしてある。 */
{
  const prog = async () => (await one(`select pv_give_progress() r`)).r;

  // (a) 鍵を持つ人：一覧の数と札の数が1つも違わない
  await asViewer();
  const full = await payRows();
  const p1 = await prog();
  ok(p1 && p1.ok === true, '★札の口が返ってくる', JSON.stringify(p1));
  ok(p1.contributors === full.stats.contributors,
     '★札の人数が一覧の人数とぴったり同じ（数え方が1か所だから）',
     `札 ${p1 && p1.contributors} / 一覧 ${full.stats.contributors}`);
  ok(JSON.stringify(p1.give) === JSON.stringify(full.give),
     '★本人が何を出したかも一覧と同じ答え', JSON.stringify(p1.give));

  // (b) 鍵の無い人でも同じ。DEEP PAY の準備は REAL PAY を開ける前からできる。
  await asUser(9001);
  const lk = await payRows();
  const p2 = await prog();
  ok(p2 && p2.contributors === lk.stats.contributors,
     '★鍵の無い人でも、札の人数は一覧の数え上げと同じ',
     `札 ${p2 && p2.contributors} / 一覧 ${lk.stats.contributors}`);

  // (c) 返るのは整数1つと真偽3つだけ。行も金額も日付も社名も入らない。
  const keys = Object.keys(p2).sort().join(',');
  ok(keys === 'contributors,give,ok', `★返るのは3つだけ（= ${keys}）`);
  ok(Number.isInteger(p2.contributors), '　人数は整数', String(p2.contributors));
  ok(Object.values(p2.give).every((v) => typeof v === 'boolean'),
     '　本人の側は真偽だけ（数を混ぜていない）', JSON.stringify(p2.give));
  const txt = JSON.stringify(p2);
  ok(!/annual|usd|salary|airline|created|month|proof/i.test(txt),
     '★札の返り値に 金額・社名・日付らしき語が1つも無い', txt.slice(0, 160));
  ok(!/\d{4}-\d{2}-\d{2}/.test(txt), '　生の日付が1文字も入らない', txt.slice(0, 160));

  // (d) ログインしていない人には何も返さない（0 を置いて埋めない）
  await asAnon();
  ok((await prog()) === null,
     '★ログインしていない人には何も返さない（画面は「準備中」のまま）');

  // (e) 入口の開き方。anon には渡さない・ログインした人には渡す。
  ok(!(await one(`select has_function_privilege('anon','public.pv_give_progress()','execute') b`)).b,
     '★登録していない人（anon）は札の口を呼べない');
  ok((await one(`select has_function_privilege('authenticated','public.pv_give_progress()','execute') b`)).b,
     'ログインした人は札の口を呼べる');

  // (f) 人数の数え方そのものは、誰にも開いていない
  ok(!(await one(`select has_function_privilege('anon','public.pv_contributors()','execute') b`)).b
     && !(await one(`select has_function_privilege('authenticated','public.pv_contributors()','execute') b`)).b,
     '★人数を数える関数は誰にも開いていない（security definer の中からだけ）');

  await asViewer();
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 13. 自己点検 SQL（ファイル末尾のものをそのまま流す）');
// ════════════════════════════════════════════════════════════
{
  const src = read('db/pay-rows.sql');
  const q = src.slice(src.lastIndexOf('with f as ('));
  const res = await rows(q);
  ok(res.length === 43, `自己点検が43行ぜんぶ出る（= ${res.length}行）`);
  for (const row of res) {
    ok(row['結果'] === '✅', `${row['#']}. ${row['見るところ']}`);
  }
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 14. 8-20（pay_reports を読む関数が anon に開いていないこと）');
// ════════════════════════════════════════════════════════════
{
  const src = read('db/pay-reports.sql');
  /* ★1文だけ切り出す。「そこから最後まで」にすると、あのファイルの末尾に
     検査を1つ足しただけで「複数の文は流せない」で落ちる（実際に落ちた）。 */
  const cut = (tag) => {
    const from = src.lastIndexOf(tag);
    if (from < 0) return null;
    const tail = src.slice(from);
    const next = tail.indexOf('\n-- 8-', 1);
    const one = next < 0 ? tail : tail.slice(0, next);
    return one.slice(one.indexOf('select'));
  };
  const res = await rows(cut('-- 8-20.'));
  ok(res.length === 0, 'pay_reports を読む security definer 関数が anon に1つも開いていない',
     JSON.stringify(res));

  // 8-21 … 2026-08-26 に足した5列（役職・区分の複数／内訳の行／保証給／教官／審査）
  const cols = await rows(cut('-- 8-21.'));
  ok(cols.length === 5 && cols.every((c) => c['ある'] === true),
     '役職（複数）・内訳の行・保証給・教官・審査の5列が入っている', JSON.stringify(cols));

  // 8-22 … 総支給と内訳の排他が復活していないこと
  const exc = await rows(cut('-- 8-22.'));
  ok(exc.length === 2 && exc.every((c) => c['内訳を捨てている'] === false),
     '総支給が来ても内訳を捨てていない（排他が復活していない）', JSON.stringify(exc));
}

// ── まとめ ───────────────────────────────────────────────────
console.log(`\n${fail === 0 ? '✅ 全部通った' : '❌ 落ちた項目がある'}  pass ${pass} / fail ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
