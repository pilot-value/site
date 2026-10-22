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
       ・列ごと・項目ごとにも人数の壁が掛かること（1人しか書いていない列）
       ・同じ人の複数月が1人に畳まれること
       ・変動給とその他手当を二重に数えないこと（両方の列に同じ額が写っている）
       ・返り値の文字列に準識別子が1語も無いこと
       ・pv_pay_comp が20引数のまま、誰にも開いていないこと

   ★2026-10-11（オーナー判断）── この日から4つ変わった。検査の書き方もそれに合わせてある。
       ① 人数の壁は 3人 → **2人**（db/deep-pay.sql の定数 v_min）。
          「1人では出ない／2人そろえば出る」で見る。
       ② **その区分に何人いるかを、関数は返さない。** だからこのファイルも人数では見ない。
          見るのは cohort.level（none かどうか）・head が在るか・picks に載っているか・
          中央値がどの人たちのものか、の4つ。
          ⚠️ 「人数が返ってこないので確かめられない」と、検査のほうを緩めないこと。
             どの人が集計に入ったかは、**わざと額を変えた人を1人混ぜれば中央値に出る**
             （見本の倍額を出す X2 がその役）。
       ③ 見出しの2つ（年収の中央値・Pay / Block Hour）は刻み（$50・$0.5）。
          給与構成の月額は今までどおり有効数字2桁。
       ④ **見る資格が上がった。** DEEP PAY は「自分に当てはまる項目をぜんぶ答えた月」を
          直近24か月に持つ人にだけ開く（db/deep-pay.sql の v_rdy。線は pv_deep_missing）。
          門が返す鍵も detailed → ready / todo に替わった。
          ・**数えられる側（区分の頭数）は、この日は動いていない**（動いたのは 2026-10-12。下の⑥）。
            見本（DET）は内訳だけのまま残し、**画面を見る役の人**にだけ
            答えきった1行（FULL）を別に持たせている（下の ready()）。
          ・線そのものの検査は ▼2-b（項目ごと・保存の道を通す）・▼2-c（どの行で決まるか ──
            どの月でも・窓の中・本人の行・運営）・▼23（見る線と数える線は別）。
          ⚠️ 検査を通すために DET を答えきった形にしないこと。勤務の列が全員に入り、
             ▼8 の「1人しか書いていない列は出さない」が測れなくなる。
       ⑤ 同じ日、**公開より前から居た人**の決まりが1つ入った（オーナー判断「3つとも答えて
          いる人はそのまま開く」。db/deep-pay.sql の v_old・境目は定数 v_launch）。
          DEEP PAY の公開より前に、基本給／保証手当・職務手当／変動給の3つに答えて出して
          いた人は、残りが空でも開く。公開から先に出す行は、④の線のまま。
          ・このファイルの見本は**既定で「公開から先に出した行」**（道具の節の submit()）。
            だから ▼2-b・▼2-c・▼23 は今までどおり④の線を測っている。
          ・公開より前の行は stamp() で名指しで作る。検査は ▼2-d（門）と ▼24（区分の数字が
            動かないこと）。
          ⚠️ submit() の時刻送りを外さないこと。外しても、v_launch を過ぎた日に流せば緑の
             まま ── **v_launch がまだ先の日にだけ**、▼2-b と ▼2-c が「欠けても閉じない」で落ちる。

   ★2026-10-12（オーナー判断）── **誰を数えるか**と**賞与の扱い**が変わった。門は1文字も変わっていない。
       ⑥ 母集団が2つになった（db/deep-pay.sql 3章「母集団は2つ」）。
          ・年収の側（選べる組み合わせ・区分の段・人数の壁・年収の中央値・Pay / Block Hour・
            月換算・働き方）は、**有効な年収を出した人ぜんぶ**。内訳を書いたかは見ない。
            昔の口コミに書かれた年収も入る（機材を条件にする区分・時間・内訳には入らない）。
          ・給与構成の側（月額・割合・固定・保証給比率・賞与の割合・変動給の中身）は、
            使える内訳を書いた人だけの**平均**。金額を先に平均し、割合はその平均から出す。
            その人たちが壁に届かない区分は、年収は出たまま comp / var / head.fixed_pct が null。
          ④に書いた「数えられる側は動いていない」は、この日から**動いた**（内訳を書いた人 →
          有効な年収を出した人）。見本（DET）は内訳つきなので、どちらの母集団にも入る。
       ⑦ 賞与 ── 「会社 × 職位」で賞与を申告した人の平均を、その区分の全員の年収と
          Pay / Block Hour に割り振る（保存してある額 − 自分の申告 ＋ 平均）。申告した人が
          壁に届かない区分は保存してある額のまま。head に真偽の目印が2つ（bonus_est / bonus_gap）と、
          月換算（month_usd ＝ 保存してある値だけで作る賞与ぬきの月額）が入った。
          ⚠️ 見本の DET は年間賞与を**書いていない**（空欄）。だから ▼3〜▼24 の見本の区分には
             賞与の平均が無く、年収は保存してあるまま ＝ 前からの期待値がそのまま使える。
             賞与を書いた見本を足すときは、その会社×職位の全員の年収が動くことを忘れない。
          検査は ▼25（誰を数えるか）・▼26（賞与）・▼27（給与構成の平均）・▼28（変動給の中身）・
          ▼29（口コミ由来）。どれも区分に入る行を足すので、いちばん最後に置いてある。

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

/* ── 100人の門を、区分のテストの間だけ開けておく ────────────
   pv_deep_pay は「給与を出したパイロットが100人」を門にしている（約束①）。
   このファイルが見たいのは区分・中央値・匿名性なので、そこを毎回100人ぶん
   作るのは意味が無い。抜け道を明示的に立てて通す。

   ★この抜け道は**本番では立てようがない**。
     pv_deep_pay は「auth.users が無い」ことも同時に見ていて、
     この器（PGlite）は auth.uid() の代役しか作っていないから通るだけ。
     本番の Supabase には auth.users が必ず在る。
   ★門そのものは ▼2 の最後で、この設定を外して確かめる。 */
await db.query(`select set_config('pv.deep_bypass', 'on', false)`);

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

/* ── 公開の瞬間と、見本の行を「出した時刻」（2026-10-11）──────────────
   db/deep-pay.sql の門は、その行を出したのが DEEP PAY の公開（定数 v_launch）より前か
   どうかで線が違う ── 公開より前に内訳の3つ（基本給／保証手当・職務手当／変動給）に
   答えていた人は、残りを埋めなくても開く（オーナー判断「3つとも答えている人はそのまま開く」。
   線の検査は ▼2-d と ▼24）。
   このファイルの見本は「いま」入る。v_launch がまだ先の日（この検査を書いた日がそう）だと、
   放っておけば**3つに答えた見本がぜんぶ「公開より前の行」になり**、▼2-b の項目ごとの表と
   ▼2-c が赤くなる（3つ以外は、欠けても閉じない ── 実際に外して流すと、この2節で34本落ちた）。
   ⚠️ そのとき検査のほうを「開く」に合わせて直さないこと。「ぜんぶ答える」線を測る検査が
      1本も残らなくなる（公開から先の人には、その線が今も本物）。
   だから**既定を「公開から先に出した行」にする** ── 下の submit() が、入れた行の時刻を
   公開の先へ送る。公開より前の行は、stamp() で**名指しで**作る（▼2-d・▼24 だけ）。
   ★SQL の側に、検査のための切り替え（合言葉・設定値・引数）は1つも足していない。
     動かすのは見本の行の時刻だけ ＝ 試験の準備。
   ★境目は SQL の宣言から読む。ここに日付を写して持たない ── オーナーが貼る前に
     公開の日時を直しても、検査は1文字も直さなくてよい。
   ★送る幅は**どの行も同じ**（ここで1回だけ決める）。行どうしの前後を崩さないため ──
     門の todo と、区分を決める「いちばん新しい1行」は、同じ月なら出した時刻の新しい順
     （▼2-c の④）。v_launch を1日より多く過ぎた日に流すと、幅は 0
     ＝ いま入れた行が、そのまま「公開から先に出した行」。 */
const LAUNCH = (read('db/deep-pay.sql')
  .match(/\n  v_launch constant timestamptz := timestamptz '([^'\n]+)';/) || [])[1];
if (!LAUNCH) {
  console.log('  ❌ db/deep-pay.sql から公開の瞬間（v_launch の宣言）が読めない');
  process.exit(1);
}
const SHIFT = (await one(
  `select greatest($1::timestamptz - now() + interval '1 day', interval '0')::text s`,
  [LAUNCH])).s;

const submit = async (payload) => {
  const r = await one(`select submit_pay_report($1::jsonb) r`, [JSON.stringify(payload)]);
  await db.query(`update profiles set pay_reports_today = 0`);
  /* ★既定は「公開から先に出した行」（上の注）。保存の道は、出し直すたびに出した時刻を
       「いま」へ戻すので、出すたびにその1行だけを送り直す。 */
  await db.query(`update pay_reports set created_at = created_at + $2::interval where id = $1`,
                 [r.r.id, SHIFT]);
  return r;
};
/* その1行の「出した時刻」を、公開の瞬間からの差で**名指しで**置く。
     '-1 day' … 公開の1日前（＝公開より前の行）  '0' … ちょうど  '1 day' … 1日あと */
const stamp = (id, delta) => db.query(
  `update pay_reports set created_at = $2::timestamptz + $3::interval where id = $1`,
  [id, LAUNCH, delta]);

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

/* ── 人数を使わずに「出ている／出ていない」を見る道具（2026-10-11）──
   関数は区分の人数を返さなくなった。壁に届いたかどうかは、返り値の形で分かる：
     届いた     … cohort.level が none 以外・head が在る・信頼度の段（trust）が付く
     届いていない … level = none・trust = null・head / comp / work / var が4つとも null */
const shown  = (d) => !!(d && d.cohort && d.cohort.level !== 'none' && d.head
                         && ['high', 'mid', 'low'].includes(d.cohort.trust));
const hidden = (d) => !!(d && d.cohort && d.cohort.level === 'none' && d.cohort.trust === null
                         && d.head === null && d.comp === null && d.work === null
                         && d.var === null);
/* 返り値のどこかに「人数のキー」が残っていないか。n という名前と、_n で終わる名前を
   入れ子の奥まで探して、見つけた場所を返す（配列の中の要素も見る）。 */
const countKeys = (d) => {
  const bad = [];
  const walk = (v, at) => {
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${at}[${i}]`)); return; }
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      if (k === 'n' || /_n$/.test(k)) bad.push(`${at}.${k}`);
      walk(x, `${at}.${k}`);
    }
  };
  for (const k of ['cohort', 'head', 'comp', 'work', 'var']) walk(d[k], k);
  return bad;
};
/* 見本（DET）の倍額。**割合は見本とまったく同じ**（どの項目も2倍）なので、
   給与構成の検査を1つも動かさずに、年収だけを 204,000 → 408,000 にできる。
   「この人が集計に入っているか」を、人数ではなく中央値で見分けるために混ぜる。 */
const DET2 = { base_pay: 18000, flight_variable_pay: 8000, other_allowance: 8800,
               command_pay: 4000, per_diem: 2000,
               housing_type: 'allowance', housing_amount: 1200 };
const openKey = (n) => db.query(
  `insert into profiles(id,email,access_until) values($1,$2, now() + interval '90 days')
     on conflict (id) do update set access_until = excluded.access_until`,
  [uid(n), `p${n}@example.com`]);

/* ── 見る資格の1行（2026-10-11・オーナー判断）────────────────────
   DEEP PAY は「自分に当てはまる項目をぜんぶ答えた月」を直近24か月に持つ人にだけ開く。
   見本の DET は内訳を書いただけで、答えきってはいない（保証手当・変動給の行・賞与・
   勤務・役職が空）。だから**画面を見る役の人**には、答えきった1行を別に持たせる。

   ★この1行は**わざと常識の幅（約束⑦・年 $10,000〜）の下**に置いてある（年 $6,120）。
     幅の外の行はどの区分の集計にも入らない ＝ 見る役の人に足しても、中央値・割合・
     列ごとの壁・選べる組み合わせが**1つも動かない**（区分の検査を弱めない）。
     見る資格は幅を見ない（db/deep-pay.sql 3章「見る資格と、数えられる資格は別の線」）。
     ⚠️ 見る資格が幅も見るように変わった日は、このファイルの「open」が全部 locked に
        なる。そのときは ▼2-b の最初の1本（出発点）が先に名指しで落ちる。
   ★形はフォームが送るもの（pay-report.html の buildPayload / pdSync）に合わせてある ──
     役職・区分は job_roles、変動給は pay_items.variable の行（金額＋何に連動する支給か）、
     other_allowance は「変動給＋その他」の合計。
     保存は必ず submit_pay_report を通す ＝ pay_items の白リストも毎回通る。
   ★対象月は去年の1月。このファイルの見本はどれも2月以降なので、
     「呼び手の最新の1行」（＝ pv_deep_pay が区分を決める行）は入れ替わらない。 */
const FULL = {
  base_pay: 300, guarantee_pay: 50, command_pay: 20, per_diem: 10,
  housing_type: 'allowance', housing_amount: 30,
  flight_variable_pay: 100, other_allowance: 100,
  bonus_annual: 0, profit_share_annual: 0,
  block_hours: 70, duty_hours: 120, duty_days: 16, stay_nights: 6,
  job_roles: ['line'], job_role: 'line',
  pay_items: { v: 2, fixed_none: false, guarantee_none: false, variable_none: false,
               variable: [{ amount: 100, label: 'Flight Pay', basis: 'block' }],
               other: [] },
};
/* n 番の人を「答えきった人」にする。会社・役職・機材は、その人のいちばん新しい行と同じ
   （pv_deep_pay の me と同じ並べ方で引く）。呼んだあと、いまの利用者は n のまま。 */
const ready = async (n) => {
  await asUser(n);
  const m = await one(
    `select airline, airline_other, "position" as pos, fleet from pay_reports
      where proof_hash in (select pv_my_keys())
      order by period_year desc, period_month desc, created_at desc limit 1`);
  if (!m) throw new Error(`ready(${n}): この人はまだ1行も出していない`);
  await submit({ ...BASE, airline: m.airline, airline_other: m.airline_other,
                 position: m.pos, fleet: m.fleet,
                 period_year: YEAR, period_month: 1, ...FULL });
};
/* 門の答えを2つの形で見る。
     lacks … 閉じていて、残っている項目がちょうど want（並びも見る）
     opens … 開いていて、残りを返していない（todo は null） */
const lacks = async (label, want) => {
  const d = await deep();
  const got = d.gate.todo ? d.gate.todo.items : null;
  ok(d.state === 'locked' && d.gate.ready === false
     && JSON.stringify(got) === JSON.stringify(want),
     label, `${d.state} / ${JSON.stringify(d.gate)}`);
};
const opens = async (label) => {
  const d = await deep();
  ok(d.state === 'open' && d.gate.ready === true && d.gate.todo === null,
     label, `${d.state} / ${JSON.stringify(d.gate)}`);
};
/* gate.todo の形。入っている鍵は年・月・残っている項目の**3つだけ**
   （その行のほかの値 ── 金額・会社・出した時刻 ── は1つも返さない）。 */
const todoIs = (t, y, m, items) =>
  !!t && Object.keys(t).sort().join(',') === 'items,month,year'
  && Number(t.year) === y && Number(t.month) === m
  && JSON.stringify(t.items) === JSON.stringify(items);
// 「いまから k か月前」を Postgres 自身に数えさせる（時差でずれないように）
const ago = async (k) => await one(
  `select extract(year  from d)::int y,
          extract(month from d)::int m
     from (select (date_trunc('month', now()) - make_interval(months => $1))::date d) z`,
  [k]);

const VOCAB = await rows(
  `select code from pv_airlines where code <> 'other' and active order by code limit 23`);
const AIR = VOCAB.map(r => r.code);
const [A_HOME, A_CAT, A_FILL1, A_FILL2, A_FILL3, A_OTHER1, A_DUP, A_BAND,
       A_ROUND, A_DOUBLE, A_REST, A_BASIS, A_NWH, A_WORK, A_SIG,
       A_PEER, A_PEND, A_RV, A_BONUS, A_SPARE, A_UNION, A_PART, A_ABS] = AIR;

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
for (const f of ['public.pv_my_keys()', 'public.pv_deep_pct(numeric[])',
                 'public.pv_deep_step(numeric,numeric)',
                 'public.pv_deep_missing(public.pay_reports)']) {
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
console.log('\n▼ 2. 門（鍵と、本人が答えきったか）');
// ════════════════════════════════════════════════════════════
/* ★2026-10-11（オーナー判断）── 本人の側の門が「内訳を出したか」から
     「自分に当てはまる項目をぜんぶ答えたか」に上がった。門が返す鍵も
     gate.detailed → gate.ready / gate.todo に替わっている。
   ここは門の3つの立ち位置だけを見る。線の中身（どの項目を・どう読むか）は ▼2-b。 */
// (a) 1枚も出していない人：鍵も、答えきった行も無い
await asUser(9501);
{
  const d = await deep();
  ok(d.state === 'locked', '一度も出していない人は locked');
  ok(d.cohort === null && d.head === null && d.comp === null && d.work === null && d.var === null,
     '★locked のときは中身のキーが全部 null（隠すのではなく渡さない）');
  ok(d.gate && d.gate.key === false && d.gate.ready === false,
     'どちらの門が閉じているかは返す（画面が「何を出せば開くか」を言える）');
  ok(d.gate.todo === null,
     '★1枚も出していない人に「残っている項目」は無い（todo は null。空の配列でも返さない）',
     JSON.stringify(d.gate.todo));
  ok(!('detailed' in d.gate),
     '★前の鍵（gate.detailed）は名前ごと無い（2026-10-11）', Object.keys(d.gate).join(','));
  ok(typeof d.stats.contributors === 'number',
     '人数だけは鍵が無くても返す（Give の誘いに使う）');
}

// (b) 答えきったが鍵が切れている
//     ★出した瞬間は鍵が付く（db/pay-reports.sql:1114 が access_until を伸ばす＝
//       Give → Get の本体）。だから「鍵が無い」のは 90日たって切れた人だけ。
//       ここで手で切らすのは、その日の状態を先に見ておくため。
const uNoKey = await person(A_FILL1, 'cap', 'b777', [{ month: 2 }]);
{
  ok((await give()).detailed === true, '内訳を出したので detailed は true（pv_my_give は変えていない）');
  {
    /* ★ここが 2026-10-11 に変わった所。前はこの時点で開いていた。 */
    const d = await deep();
    ok(d.gate.key === true, '出した瞬間に鍵が付く（Give → Get）');
    ok(d.state === 'locked' && d.gate.ready === false && d.give.detailed === true,
       '★★内訳を書いただけでは開かない（鍵は在る・内訳も在る・でも答えきっていない）',
       `${d.state} / ${JSON.stringify(d.gate)}`);
  }
  await ready(uNoKey);
  await opens('★答えきった月を1つ持てば開く');
  await db.query(`update profiles set access_until = now() - interval '1 day' where id = $1`,
                 [uid(uNoKey)]);
  const d = await deep();
  ok(d.state === 'locked' && d.gate.ready === true && d.gate.key === false,
     '★90日たって鍵が切れたら、答えきった人でも locked',
     JSON.stringify(d.gate) + ' ' + d.state);
  ok(d.gate.todo === null,
     '　止めているのは鍵だけなので、残っている項目は返さない（todo は null）',
     JSON.stringify(d.gate.todo));
  ok(d.cohort === null && d.comp === null,
     '★鍵が切れた人には中身を渡さない（前に見えていたものも残さない）');
}

// (c) 鍵はあるが、総支給しか出していない（かんたん入力だけ）
const uNoDet = ++seat;
await asUser(uNoDet);
await submit({ ...BASE, airline: A_FILL2, position: 'cap', fleet: 'b777',
               period_year: YEAR, period_month: 2, gross_monthly: 15000 });
await openKey(uNoDet);
await asUser(uNoDet);
{
  const d = await deep();
  ok(d.gate.key === true && d.gate.ready === false && d.state === 'locked',
     '★鍵があっても、総支給しか出していなければ locked（門は SQL の側に在る）');
  /* ★残っている項目は**決まった並び**で返る。画面はこの順のまま出せばフォームの順になる。
       役割ごとの5つ（教官…兼務）が無いのは、どの役割にも印を付けていないから
       ── そもそも役職・区分（roles）が未回答。 */
  ok(todoIs(d.gate.todo, YEAR, 2,
            ['base', 'guarantee', 'variable', 'command', 'perdiem', 'housing',
             'bonus', 'profit', 'block', 'duty_h', 'duty_days', 'stay', 'roles']),
     '★総支給だけの行は13項目ぜんぶが残り（並びは固定）、どの月の行かも返る',
     JSON.stringify(d.gate.todo));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 2-b. 見る資格の線 ── 項目ごと（1つ欠ければ閉じ、戻せば開く）');
// ════════════════════════════════════════════════════════════
/* db/deep-pay.sql の pv_deep_missing（2-c 章）── オーナー判断 2026-10-11。
   「自分に当てはまる項目をぜんぶ答えた人にだけ開く」。給与フォームは変えず、
   **保存されている行**だけで判定する。

   ★どの1本も submit_pay_report を通して入れ直す（同じ会社・同じ月＝上書き）。
     線が読む列と pay_items の鍵は、保存の道（'' → null・0 は 0 のまま・pay_items の
     白リスト・jsonb_strip_nulls）を通ったあとの形でなければ意味が無い。
     保存の道が鍵を1つ落とせば（白リストへの書き忘れ・鍵の付け替え）、ここが名指しで落ちる。
   ★見るのは門そのもの（pv_deep_pay の state / gate.ready / gate.todo）。
     「欠ければ閉じる」と「戻せば開く」を必ず対で見る ── 閉じる側だけ見ていると、
     何を出しても開かない線になっていても緑のまま。
   ★この節の行はどれも常識の幅の下（年 $1万未満）＝どの区分の集計にも入らない。
     うしろの節の「壁に届いている／いない」を1つも動かさない。 */
{
  const CELL = { airline: A_FILL2, position: 'cap', fleet: 'b777' };
  const uQ = ++seat;
  await asUser(uQ);
  /* 答えきった1行（FULL）から、列を patch で・pay_items の鍵を items で上書きして出し直す。
     items に null を渡すと pay_items そのものを送らない（内訳の行を持たない古い形）。 */
  const put = async (patch = {}, items = {}) => {
    const p = { ...BASE, ...CELL, period_year: YEAR, period_month: 1, ...FULL, ...patch };
    p.pay_items = items === null ? null : { ...FULL.pay_items, ...items };
    await submit(p);
  };
  // 保存されたこの人の1行（同じ月を上書きし続けるので、いつも1行）
  const row = async (expr) => (await one(
    `select ${expr} as v from pay_reports r
      where r.proof_hash in (select pv_my_keys())`)).v;

  await put();
  await opens('（出発点）答えきった1行で open ── 残っている項目は無い（todo は null）');
  ok(Number(await row('count(*)')) === 1 && Number(await row('max(r.annual_total_usd)')) < 10000,
     '（前提）この人の行は1つだけで、常識の幅の下（年 $1万未満）＝区分の集計には入らない',
     String(await row('max(r.annual_total_usd)')));
  {
    const m = (await one(`select pv_deep_missing(r) m from pay_reports r
                           where r.proof_hash in (select pv_my_keys())`)).m;
    ok(Array.isArray(m) && m.length === 0,
       '★pv_deep_missing は、答えきった行に**空の配列**を返す（null ではない）', JSON.stringify(m));
  }
  ok(await row(`bool_and(r.transport is null
                         and jsonb_array_length(r.pay_items -> 'other') = 0)`) === true,
     '★その他の現金手当と交通費は空のまま開いている（今のフォームが「無い」を保存できないので、わざと線に入れていない）');

  /* ── 1つだけ空にする → 閉じる・残りはその1つだけ ／ 戻す → 開く ──────────
     変動給は「行が無い」形で空にする。合計の列（flight_variable_pay）は 100 のまま
     残っている ＝ **合計の列だけでは答えにならない**ことも一緒に見ている。 */
  const BLANK = [
    ['base',      { base_pay: null }],
    ['guarantee', { guarantee_pay: null }],
    ['variable',  {}, { variable: [] }],
    ['command',   { command_pay: null }],
    ['perdiem',   { per_diem: null }],
    ['housing',   { housing_type: null, housing_amount: null }],
    ['bonus',     { bonus_annual: null }],
    ['profit',    { profit_share_annual: null }],
    ['block',     { block_hours: null }],
    ['duty_h',    { duty_hours: null }],
    ['duty_days', { duty_days: null }],
    ['stay',      { stay_nights: null }],
    ['roles',     { job_roles: [], job_role: '' }],
  ];
  for (const [code, patch, items] of BLANK) {
    await put(patch, items || {});
    await lacks(`★${code} だけ空 → locked・残っているのは ${code} の1つだけ`, [code]);
    await put();
    await opens(`　${code} を戻す → open`);
  }

  /* ── 0 は答え。空欄だけが未回答 ─────────────────────────────
     上の表は全部「空（null）」で閉じた。同じ欄に 0 を入れると閉じない。
     （賞与・利益分配は FULL が最初から 0。基本給と保証手当を両方 0 にすると
       「報酬額が入力されていません」で保存そのものが弾かれるので、総支給を足す。） */
  await put({ gross_monthly: 500, base_pay: 0, guarantee_pay: 0, command_pay: 0, per_diem: 0,
              housing_type: 'allowance', housing_amount: 0,
              flight_variable_pay: 0, other_allowance: 0,
              block_hours: 0, duty_hours: 0, duty_days: 0, stay_nights: 0 },
            { variable: [{ amount: 0, label: 'Flight Pay', basis: 'block' }] });
  await opens('★0 は答え（基本給・保証手当・職位手当・パーディアム・住宅手当の額・賞与・利益分配・勤務の4つ・変動給の行の金額）');

  /* ── 「該当なし」も答え（pay_items の3つの印）─────────────────── */
  const NONE3 = { gross_monthly: 500, base_pay: null, guarantee_pay: null,
                  flight_variable_pay: null, other_allowance: null };
  const none3 = { fixed_none: true, guarantee_none: true, variable_none: true, variable: [] };
  await put(NONE3, none3);
  await opens('★「該当なし」3つ（基本給・保証手当・変動給）は、金額が空でも答え');
  // 印を1つ外すと、その1つだけが残る（保存の白リストが3つとも運んでいることも分かる）
  for (const [flag, code] of [['fixed_none', 'base'], ['guarantee_none', 'guarantee'],
                              ['variable_none', 'variable']]) {
    await put(NONE3, { ...none3, [flag]: false });
    await lacks(`　${flag} を外す → 残っているのは ${code} だけ`, [code]);
  }

  /* ── 変動給の行 ── **どの行にも**「金額」と「何に連動する支給か」が要る ──── */
  await put({}, { variable: [{ amount: 100, label: 'Flight Pay', basis: 'unknown' }] });
  await opens('★「わからない」（basis = unknown）も答え（フォームが用意している逃げ道）');
  await put({}, null);
  ok(Number(await row('max(r.flight_variable_pay)')) === 100
     && await row('bool_and(r.pay_items is null)') === true,
     '（前提）変動給の合計の列は 100・内訳の行（pay_items）は無い ＝ 古い形の行');
  await lacks('★★変動給の合計の列（flight_variable_pay）だけでは答えにならない', ['variable']);
  await put({}, { variable: [{ amount: null, label: 'Flight Pay', basis: 'block' }] });
  await lacks('★金額の無い行（項目名と連動先だけ）は未回答', ['variable']);
  await put({}, { variable: [{ amount: 100, label: 'Flight Pay', basis: null }] });
  await lacks('★「何に連動する支給か」の無い行は未回答', ['variable']);
  await put({}, { partial: true, variable: [
    { amount: 100, label: 'Flight Pay', basis: 'block' },
    { amount: null, label: 'Night', basis: 'night' }] });
  await lacks('★2行のうち1行でも金額が空なら未回答（先頭の行だけ見ていない）', ['variable']);
  await put({}, { variable: [
    { amount: 60, label: 'Flight Pay', basis: 'block' },
    { amount: 40, label: 'Night', basis: 'night' }] });
  await opens('　2行とも書けば open');

  /* ── 住宅 ── 住宅手当（現金）を選んだときだけ、額も要る ──────────── */
  await put({ housing_type: 'allowance', housing_amount: null });
  await lacks('★住宅手当（現金）を選んで額が空 → 残っているのは housing', ['housing']);
  await put({ housing_type: 'provided', housing_amount: null });
  await opens('　社宅（現物）は額が無くても答え');
  await put({ housing_type: 'none', housing_amount: null });
  await opens('　「なし」も答え');

  /* ── 役職・区分 ── 複数（job_roles）が正。古い行は単数（job_role）で見る ── */
  await put({ job_roles: undefined, job_role: 'line' });
  ok(await row(`bool_and(r.job_roles is null and r.job_role = 'line')`) === true,
     '（前提）job_roles が無く job_role だけの行（2026-08-26 より前の形）');
  await opens('★複数を持たない古い行は、単数の役職で「答えた」と数える');

  /* ── 役割ごとの手当 ── 印を付けた役割だけ。line にはモジュールが無い ────
     extra は「別に支給されているか」の問い（pay-report.html の f-*-extra）。
       separate（組合は yes）… 別に支給されている → その役割の金額の列も要る
       それ以外               … 含まれている・無い・わからない → それだけで答え
     ★金額は**列**で見る。画面は 0 を列には 0 で送るが、pay_items の amount には入れない。 */
  const MODS = [
    // [コード, 金額の列, 「別に支給されている」の値, 金額の要らない答え]
    ['instructor', 'instructor_pay', 'separate', ['included', 'none', 'unknown']],
    ['examiner',   'examiner_pay',   'separate', ['with_instructor', 'included', 'none', 'unknown']],
    ['union',      'union_pay',      'yes',      ['none', 'unknown']],
    ['management', 'management_pay', 'separate', ['included', 'none', 'unknown']],
    ['nonline',    'nonline_pay',    'separate', ['included', 'none', 'unknown']],
  ];
  for (const [code, col, paid, soft] of MODS) {
    const on  = { job_roles: ['line', code], job_role: 'line' };
    const src = code === 'union' ? { source: 'airline' } : {};   // 組合は支給元も要る（下で別に見る）
    await put({}, { [code]: { extra: paid } });
    await opens(`★${code}：印を付けていない役割は見ない（書きかけの中身が残っていても）`);
    await put(on);
    await lacks(`★${code}：印を付けて未回答 → 残っているのは ${code} だけ`, [code]);
    await put(on, { [code]: { days: 2 } });
    await lacks(`　${code}：中身（日数）だけ書いても、支給の有無に答えていなければ未回答`, [code]);
    for (const v of soft) {
      await put(on, { [code]: { extra: v } });
      await opens(`★${code}：extra = ${v} は答え（金額は要らない）`);
    }
    await put(on, { [code]: { extra: paid, ...src } });
    await lacks(`★${code}：「別に支給」（${paid}）と答えて金額が空 → 未回答`, [code]);
    await put({ ...on, [col]: 0 }, { [code]: { extra: paid, ...src } });
    await opens(`　${code}：金額が 0 でも答え（列で見る。pay_items の amount は見ない）`);
    await put({ ...on, [col]: 10 }, { [code]: { extra: paid, amount: 10, ...src } });
    await opens(`　${code}：金額を書けば open`);
  }
  // 組合だけ：支給されているなら、支給元（会社／組合／両方／その他）も要る
  {
    const on = { job_roles: ['line', 'union'], job_role: 'line', union_pay: 10 };
    await put(on, { union: { extra: 'yes', amount: 10 } });
    await lacks('★union：支給あり・金額あり・**支給元が空** → 未回答', ['union']);
    for (const s of ['airline', 'union', 'both', 'other']) {
      await put(on, { union: { extra: 'yes', amount: 10, source: s } });
      await opens(`　union：支給元 = ${s} を選べば open`);
    }
  }
  /* 並び。役割5つに印を付けて、どれも未回答。
     ★保存の道は job_roles を ABC 順に並べ直す（examiner → instructor → …）。
       返ってくる並びはそれでも、印を付けた順でもなく、**線が決めた順**。 */
  await put({ job_roles: ['nonline', 'union', 'management', 'examiner', 'instructor', 'line'],
              job_role: 'line' });
  await lacks('★役割5つがどれも未回答 → 5つとも残る（並びは固定：教官・審査・組合・管理・兼務）',
              ['instructor', 'examiner', 'union', 'management', 'nonline']);
  await put({ job_roles: undefined, job_role: 'instructor' });
  await lacks('★古い行（単数の役職＝教官）でも、教官の手当の問いは要る', ['instructor']);

  /* ── フォームの選択肢と、線が読む値が同じ集合か（写しの見張り）──────────
     pv_deep_missing は「別に支給されている」を**値の字**で見分けている
     （組合は yes・ほかの4つは separate。住宅は allowance のときだけ額を見る）。
     フォームが選択肢の値を1つ変えるか足すと、その答えは「金額の要らない答え」と読まれ、
     **線が黙って緩む**（画面も保存も普通に動いたまま）。役職の箱が1つ増えた日も同じ ──
     その役割の問いは、線に入らないまま「答えきった」になる。
     だから日英のフォームから option を読み、上の表（MODS）と**同じ集合**かを見る。
     ⚠️ 落ちたら数を合わせて通さない。足された値を pv_deep_missing がどう読むか
        （金額が要る答えか・要らない答えか）を決めてから、SQL と MODS の両方に足す。 */
  {
    const optionsOf = (html, id) => {
      const m = html.match(new RegExp('<select[^>]*id="' + id + '"[\\s\\S]*?</select>'));
      return m ? Array.from(m[0].matchAll(/<option value="([^"]*)"/g))
                   .map(x => x[1]).filter(Boolean).sort().join(',') : '（欄が無い）';
    };
    const SEL = { instructor: 'f-instr-extra', examiner: 'f-exam-extra', union: 'f-union-extra',
                  management: 'f-mgmt-extra', nonline: 'f-nonline-extra' };
    for (const f of ['pay-report.html', 'en/pay-report.html']) {
      const html = read(f);
      for (const [code, , paid, soft] of MODS) {
        const got = optionsOf(html, SEL[code]);
        ok(got === [paid, ...soft].sort().join(','),
           `★${f}: ${code} の「別に支給されているか」の選択肢が、線の読む値と同じ集合`, got);
      }
      ok(optionsOf(html, 'f-union-src') === 'airline,both,other,union',
         `${f}: 組合の支給元の選択肢は4つ（どれを選んでも「答えた」）`, optionsOf(html, 'f-union-src'));
      ok(optionsOf(html, 'f-housing') === 'allowance,none,provided',
         `${f}: 住宅の選択肢は3つ（額が要るのは allowance だけ）`, optionsOf(html, 'f-housing'));
      const boxes = Array.from(html.matchAll(/<input type="checkbox" name="f-jobrole" value="([^"]*)"/g))
                      .map(x => x[1]).sort().join(',');
      ok(boxes === ['line', ...MODS.map(m => m[0])].sort().join(','),
         `★${f}: 役職・区分の箱は line ＋ 線が見る5つ（箱が増えたら、その役割の問いを線に足す）`, boxes);
      const tpl = (html.match(/<template id="tpl-pd-var">[\s\S]*?<\/template>/) || [''])[0];
      ok(/<option value="unknown">/.test(tpl) && /class="[^"]*\bpd-basis\b/.test(tpl),
         `${f}: 変動給の行に「何に連動する支給か」の欄と、逃げ道の unknown が在る`);
    }
  }

  /* ── 明細から読んだ行も同じ線（特別扱いしない）────────────────
     verify_level は submit_pay_report が触らない列なので、直に立てる
     （本番では parse-payslip が立てる）。 */
  await put({ block_hours: null });
  await db.query(`update pay_reports set verify_level = 1
                   where proof_hash in (select pv_my_keys())`);
  await lacks('★明細の裏付けがある行（verify_level = 1）でも、空の欄は空として数える', ['block']);
  await put();
  ok(Number(await row('max(r.verify_level)')) === 1, '（前提）出し直しても verify_level は 1 のまま');
  await opens('　その行を答えきれば open');

  /* ── フォームが実際に送る形そのまま（pay-report.html の buildPayload）────
     ・金額の欄は val() が**文字列**で送る。空の欄は null。
     ・pay_items の中の金額は数。役割モジュールは instrRead / examRead / unionRead /
       mgmtRead / nonlineRead が組む形（答えていない欄は null で入っている）。
     ・役割は5つとも印あり。教官＝別に支給／審査＝教官とまとめて／組合＝支給あり・会社から／
       管理＝通常の給与に含まれる／兼務＝わからない。
     ここが落ちたら、線のほうではなく**保存の道が何かを落とした**ことを先に疑う。 */
  const FORM = {
    airline: CELL.airline, airline_other: null, position: CELL.position, fleet: CELL.fleet,
    job_roles: ['line', 'instructor', 'examiner', 'union', 'management', 'nonline'],
    job_role: 'line', age_bucket: null, base_iata: null,
    period_year: String(YEAR), period_month: '1', currency: 'USD',
    gross_monthly: '520', base_pay: '300', guarantee_pay: '0',
    hourly_rate: null, guaranteed_hours: null,
    block_hours: '70.5', duty_days: '16', stay_nights: '6', per_diem: '10',
    housing_type: 'allowance', housing_amount: '30', transport: null, command_pay: '0',
    instructor_pay: '10', examiner_pay: null, union_pay: '10',
    management_pay: null, nonline_pay: null,
    other_allowance: '100', bonus_annual: '0', profit_share_annual: '0', pension_pct: null,
    contract_type: null, tax_country: null, tax_rate_pct: '0',
    seniority_years: '5', rank_years: '3',
    net_pay_actual: null, ytd_taxable: null, flight_variable_pay: '100', deduction_total: null,
    duty_hours: '120', night_hours: null, credit_hours: null,
    payslip_detail: null,
    pay_items: {
      v: 2, fixed_none: false, guarantee_none: false, variable_none: false,
      variable: [{ amount: 60, label: 'Flight Pay', basis: 'block' },
                 { amount: 40, label: null, basis: 'unknown' }],
      other: [],
      instructor: { trainings: ['line_training'], label: null, extra: 'separate',
                    method: 'monthly', amount: 10, qty: null },
      examiner:   { checks: [], label: null, extra: 'with_instructor',
                    method: null, method_label: null, amount: null, qty: null },
      union:      { days: 2, extra: 'yes', source: 'airline', amount: 10 },
      management: { days: null, extra: 'included', method: null, amount: null },
      nonline:    { areas: [], days: null, extra: 'unknown', amount: null },
    },
    source: 'web', lang: 'en',
  };
  await submit(FORM);
  await opens('★★フォームが送る形（金額は文字列・役割5つ）を保存の道に通すと、答えきった行になる');
  {
    const s = await one(
      `select r.job_roles, r.base_pay, r.guarantee_pay, r.command_pay, r.block_hours,
              r.instructor_pay, r.examiner_pay, r.union_pay, r.pay_items
         from pay_reports r where r.proof_hash in (select pv_my_keys())`);
    ok(JSON.stringify(s.job_roles) ===
         JSON.stringify(['examiner', 'instructor', 'line', 'management', 'nonline', 'union']),
       '　保存された役職・区分は6つ（保存の道が ABC 順に並べ直す）', JSON.stringify(s.job_roles));
    ok(Number(s.guarantee_pay) === 0 && Number(s.command_pay) === 0
       && s.guarantee_pay !== null && s.command_pay !== null && s.examiner_pay === null,
       '　文字列の "0" は 0 として残り（null にならない）、空の欄は null のまま',
       JSON.stringify({ g: s.guarantee_pay, c: s.command_pay, e: s.examiner_pay }));
    const pi = s.pay_items;
    ok(pi.instructor.extra === 'separate' && pi.examiner.extra === 'with_instructor'
       && pi.union.extra === 'yes' && pi.union.source === 'airline'
       && pi.management.extra === 'included' && pi.nonline.extra === 'unknown'
       && pi.variable.length === 2 && pi.variable.every(v => 'amount' in v && v.basis),
       '★保存の白リストを通ったあとも、線が読む鍵（役割の extra・組合の source・変動給の行の amount / basis）が残っている',
       JSON.stringify(pi));
  }
  // 同じ形で、フォームの「支給元」だけ選んでいない（unionRead は source を null で送る）
  await submit({ ...FORM, pay_items: { ...FORM.pay_items,
                   union: { ...FORM.pay_items.union, source: null } } });
  await lacks('　同じ形で、組合の支給元だけ選んでいない → 残っているのは union だけ', ['union']);
  await submit(FORM);
  await opens('　選び直せば open');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 2-c. 見る資格 ── どの行で決まるか（どの月でも・窓の中・本人の行・運営）');
// ════════════════════════════════════════════════════════════
/* 線の中身は ▼2-b。ここは「どの行を見て決めるか」（db/deep-pay.sql の v_own / v_todo）。
     ① 答えきった月が窓の中に**1つでも**あれば足りる（あとの書きかけの月で閉め直さない）
     ② 見るのは**本人の行**だけ（他人が答えきっていても関係ない）
     ③ 窓は区分の本棚と同じ直近24か月（対象月で見る。25か月前は外・24か月前は中）
     ④ 足りない人に返す todo は、窓の中で**いちばん新しい自分の1行**の残り
     ⑤ 運営は1行も出していなくても通る（鍵と同じ特例）
   ★ここの行も常識の幅の下に置いてある（区分の検査を動かさない）。 */
{
  const CELL = { airline: A_FILL2, position: 'cap', fleet: 'b777' };
  const THIN = { gross_monthly: 500 };             // 総支給だけ ＝ 13項目ぜんぶが残る
  const ALL13 = ['base', 'guarantee', 'variable', 'command', 'perdiem', 'housing',
                 'bonus', 'profit', 'block', 'duty_h', 'duty_days', 'stay', 'roles'];
  const at = (y, m, body, cell = CELL) =>
    submit({ ...BASE, ...cell, period_year: y, period_month: m, ...body });

  // ① 答えきった月が1つあれば足りる
  const u1 = ++seat; await asUser(u1);
  await at(YEAR, 1, FULL);
  await opens('答えきった月が1つ → open');
  await at(YEAR, 5, THIN);
  await opens('★★あとから出した書きかけの月があっても閉め直さない（答えきった月が窓の中に1つあれば足りる）');

  // ② 他人の答えきった行は、自分の資格にならない（u1 と同じ会社・役職・機材・同じ月）
  const u2 = ++seat; await asUser(u2);
  await at(YEAR, 1, THIN);
  await lacks('★★同じ会社・同じ月に他人が答えきっていても、自分の資格にはならない（残りは自分の行のもの）',
              ALL13);

  // ③ 窓 ── 25か月前は外・24か月前（いちばん古い月）は中
  const out = await ago(24), old = await ago(23);
  const u3 = ++seat; await asUser(u3);
  await at(out.y, out.m, FULL);
  {
    const d = await deep();
    ok(d.state === 'locked' && d.gate.ready === false,
       `★★窓の外（${out.y}年${out.m}月＝25か月前）で答えきっていても、見る資格にはならない`,
       `${d.state} / ${JSON.stringify(d.gate)}`);
    ok(d.gate.todo === null,
       '★窓の中に自分の行が1つも無い人には、残っている項目を返さない（todo は null）',
       JSON.stringify(d.gate.todo));
  }
  await at(YEAR, 3, THIN);
  {
    const d = await deep();
    ok(d.state === 'locked' && todoIs(d.gate.todo, YEAR, 3, ALL13),
       '★窓の中に書きかけの行が出来ると、todo はその行を指す（窓の外の行は指さない）',
       JSON.stringify(d.gate.todo));
  }
  await at(old.y, old.m, FULL);
  await opens(`★窓のいちばん古い月（${old.y}年${old.m}月＝24か月前）で答えきっていれば数える（区分の本棚と同じ境目）`);

  // ④ todo は、窓の中でいちばん新しい自分の1行
  const u4 = ++seat; await asUser(u4);
  const LATE = { ...FULL, bonus_annual: null, stay_nights: null };
  await at(YEAR, 3, { ...FULL, block_hours: null });
  await at(YEAR, 7, LATE);
  {
    const d = await deep();
    ok(d.state === 'locked' && todoIs(d.gate.todo, YEAR, 7, ['bonus', 'stay']),
       '★todo は対象月がいちばん新しい行の残り（古い月の残りを混ぜない・年と月と項目の3つだけ）',
       JSON.stringify(d.gate.todo));
  }
  // 同じ月に2社ぶん → あとから出したほう
  await at(YEAR, 7, { ...FULL, command_pay: null },
           { airline: A_FILL1, position: 'cap', fleet: 'b777' });
  {
    const d = await deep();
    ok(todoIs(d.gate.todo, YEAR, 7, ['command']),
       '★同じ月の行が2つ（2社）あるときは、あとから出したほう', JSON.stringify(d.gate.todo));
  }
  await at(YEAR, 7, LATE);          // 1社目を出し直す ＝ こちらが「あと」になる
  {
    const d = await deep();
    ok(todoIs(d.gate.todo, YEAR, 7, ['bonus', 'stay']),
       '　出し直せば、出し直したほうへ移る', JSON.stringify(d.gate.todo));
  }
  await at(YEAR, 3, FULL);          // 古いほうの月を答えきる
  await opens('★古い月のほうを答えきっても開く（どの月でもよい）。開いたら todo は消える');

  // ⑤ 運営は1行も出していなくても通る
  const uOp = ++seat; await asUser(uOp);
  {
    const d = await deep();
    ok(d.state === 'locked' && d.gate.key === false && d.gate.ready === false,
       '（前提）名簿に載る前は、1枚も出していないふつうの人');
  }
  await db.exec(`create table if not exists public.pv_admins (user_id uuid primary key)`);
  await db.query(`insert into public.pv_admins(user_id) values($1) on conflict do nothing`,
                 [uid(uOp)]);
  {
    const d = await deep();
    const mine = Number((await one(`select count(*) n from pay_reports
                                     where proof_hash in (select pv_my_keys())`)).n);
    ok(mine === 0 && d.state === 'open' && d.gate.key === true
       && d.gate.ready === true && d.gate.todo === null,
       '★★運営（pv_admins）は1行も出していなくても開く（偽の給与を出して開ける手を取らせない）',
       `${mine}行 / ${d.state} / ${JSON.stringify(d.gate)}`);
  }
  await asUser(u2);
  await lacks('　通るのは名簿に載っている本人だけ。ほかの人の門は動かない', ALL13);
  await db.exec(`drop table if exists public.pv_admins`);
  await asUser(uOp);
  ok((await deep()).state === 'locked', '　名簿が無くなれば、元どおり閉じる');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 2-d. 公開より前から居た人（内訳の3つに答えていれば、残りを埋めなくても開く）');
// ════════════════════════════════════════════════════════════
/* db/deep-pay.sql の v_old ── オーナー判断 2026-10-11「3つとも答えている人はそのまま開く」。
   DEEP PAY を公開する（定数 v_launch）**より前に**、基本給／保証手当・職務手当／変動給
   （何に連動する支給かまで）の3つに答えて出していた人は、残りが空でも開いたまま。
   それ以外の人と、公開から先に出す行（出し直しも）は、▼2-b の線 ── ぜんぶ答えること。
     ① 3つに答えた行を、公開より前に出していれば開く（何も頼まない ＝ todo は null）
     ② 同じ行でも、公開から先に出していれば閉じる（境目ちょうどは「前」ではない）
     ③ 3つのうち1つでも空なら閉じる（読み方は ▼2-b と同じ ── 0・「該当なし」・
        「わからない」は答え。変動給は合計の列だけでは答えにならない）
     ④ 窓・本人の行・鍵・みんなの側の条件は、この人たちにも同じに掛かる
     ⑤ 公開から先に同じ月を出し直すと「前の行」ではなくなる（保存の道が時刻を新しくする）
   ★見るのは門そのもの（pv_deep_pay の state / gate）。「閉じる」と「開く」を必ず対で見る ──
     閉じる側だけ見ていると、この決まりが丸ごと抜けていても緑のまま。
   ★行の時刻は stamp() で**公開の瞬間からの差**として置く（道具の節の注）。
     このファイルの見本は既定で「公開から先に出した行」なので、ここだけが名指しで前へ置く。
   ★ここの行も常識の幅の下（年 $1万未満）＝どの区分の集計にも入らない。
     区分の数字が動かないこと（数えられる側に触れていないこと）は、いちばん最後の ▼24。 */
{
  const CELL = { airline: A_FILL2, position: 'cap', fleet: 'b777' };
  /* 3つ（基本給・保証手当・変動給の行＝金額と連動先）は答えてあり、残りのうち5つが空。
     ★空にしたうちの3つ（職位手当・プロフィットシェア・乗務日数）は、給与フォームでは
       任意の「＋」を押した先に在る欄 ── この決まりが出来た理由そのもの。 */
  const CORE = { ...FULL, command_pay: null, bonus_annual: null, profit_share_annual: null,
                 duty_hours: null, duty_days: null };
  const REST = ['command', 'bonus', 'profit', 'duty_h', 'duty_days'];
  const BEFORE = '-1 day', AFTER = '1 day';
  /* いまの利用者の1行を出し（同じ会社・同じ月＝上書き）、出した時刻を when に置く。
     when = null なら置かない ＝ submit() の既定（公開から先に出した行）のまま。 */
  const put = async (when, patch = {}, items = {}, y = YEAR, m = 1) => {
    const p = { ...BASE, ...CELL, period_year: y, period_month: m, ...CORE, ...patch };
    p.pay_items = items === null ? null : { ...FULL.pay_items, ...items };
    const id = (await submit(p)).r.id;
    if (when !== null) await stamp(id, when);
    return id;
  };
  const at = async (id) => await one(
    `select r.created_at <  $2::timestamptz as early,
            r.created_at =  $2::timestamptz as exact,
            pv_deep_missing(r)             as miss,
            r.annual_total_usd             as usd
       from pay_reports r where r.id = $1`, [id, LAUNCH]);

  // ── ① 公開より前に3つ答えた行 → 開く ／ ② 公開から先なら閉じる ────────────
  const uA = ++seat; await asUser(uA);
  const idA = await put(null);
  {
    const r = await at(idA);
    ok(r.early === false && JSON.stringify(r.miss) === JSON.stringify(REST)
       && Number(r.usd) < 10000,
       '（前提）見本の既定は「公開から先に出した行」。残りは5つ・常識の幅の下（区分に入らない）',
       JSON.stringify(r));
  }
  {
    const d = await deep();
    ok(d.state === 'locked' && d.gate.key === true && d.gate.ready === false
       && todoIs(d.gate.todo, YEAR, 1, REST),
       '★★公開から先に出した行は、3つに答えていても locked ── 残りの5つを返す（▼2-b の線のまま）',
       `${d.state} / ${JSON.stringify(d.gate)}`);
  }
  await stamp(idA, BEFORE);
  ok((await at(idA)).early === true, '（前提）同じ行の出した時刻を、公開の1日前に置いた');
  {
    const d = await deep();
    ok(d.state === 'open' && d.gate.key === true && d.gate.ready === true && d.gate.todo === null,
       '★★同じ行を公開より前に出していれば open ── ready は true・何も頼まない（todo は null）',
       `${d.state} / ${JSON.stringify(d.gate)}`);
    ok(Object.keys(d.gate).sort().join(',') === 'contributors,crowd,goal,key,ready,todo',
       '★門が返す鍵は6つのまま（どの道で通ったかは返さない）', Object.keys(d.gate).join(','));
    ok(d.cohort !== null && d.picks !== null,
       '　開いた人には、ほかの開いた人と同じものを渡す（区分と、選べる組み合わせ）');
  }
  ok(JSON.stringify((await at(idA)).miss) === JSON.stringify(REST),
     '　その行の残りは5つのまま（答えを足して開けたのではない）');

  // 境目 ── ちょうどは「前」ではない。1マイクロ秒でも前なら「前」
  await stamp(idA, '0');
  ok((await at(idA)).exact === true, '（前提）出した時刻が、公開の瞬間とちょうど同じ');
  await lacks('★★境目ちょうど（出した時刻 ＝ v_launch）は「前」ではない → locked', REST);
  await stamp(idA, '-1 microsecond');
  ok((await at(idA)).early === true && (await at(idA)).exact === false,
     '（前提）公開の瞬間の1マイクロ秒前');
  await opens('★★1マイクロ秒でも前なら「前」→ open');
  await stamp(idA, '1 microsecond');
  await lacks('　1マイクロ秒あと → locked', REST);
  await stamp(idA, AFTER);
  await lacks('　1日あと → locked', REST);
  await stamp(idA, BEFORE);
  await opens('　前へ戻す → open');

  // ── ③ 3つのうち1つでも空なら閉じる（戻せば開く）────────────────────────
  /* 変動給は「行が無い」形で空にする。合計の列（flight_variable_pay）は 100 のまま ──
     pv_my_give の full（REAL PAY の内訳の鍵）はこれで通すが、こちらは通さない。別の線。 */
  for (const [code, patch, items] of [
    ['base',      { base_pay: null }],
    ['guarantee', { guarantee_pay: null }],
    ['variable',  {}, { variable: [] }],
  ]) {
    await put(BEFORE, patch, items || {});
    await lacks(`★★公開より前でも ${code} が空なら locked（3つのうち2つでは足りない）`,
                [code, ...REST]);
    await put(BEFORE);
    await opens(`　${code} を戻す → open`);
  }
  await put(BEFORE, {}, { variable: [{ amount: 100, label: 'Flight Pay', basis: null }] });
  await lacks('★変動給の金額だけで「何に連動する支給か」が無い行 → locked', ['variable', ...REST]);
  await put(BEFORE, {}, { variable: [{ amount: null, label: 'Flight Pay', basis: 'block' }] });
  await lacks('★連動先だけで金額の無い行 → locked', ['variable', ...REST]);
  await put(BEFORE, {}, { partial: true, variable: [
    { amount: 100, label: 'Flight Pay', basis: 'block' },
    { amount: null, label: 'Night', basis: 'night' }] });
  await lacks('★2行のうち1行でも金額が空 → locked', ['variable', ...REST]);
  await put(BEFORE, {}, null);
  {
    const s = await one(`select r.flight_variable_pay v, r.pay_items is null as bare
                           from pay_reports r where r.id = $1`, [idA]);
    ok(Number(s.v) === 100 && s.bare === true,
       '（前提）変動給の合計の列は 100・内訳の行（pay_items）は無い ＝ 古い形の行');
  }
  await lacks('★★変動給の合計の列だけの古い行は、公開より前でも locked（連動先に答えていない）',
              ['variable', ...REST]);
  await put(BEFORE);
  await opens('　3つとも答えた形へ戻す → open');

  // 「該当なし」・0・「わからない」は答え（▼2-b と同じ読み方 ── 写しではなく同じ判定）
  const NONE3 = { gross_monthly: 500, base_pay: null, guarantee_pay: null,
                  flight_variable_pay: null, other_allowance: null };
  const none3 = { fixed_none: true, guarantee_none: true, variable_none: true, variable: [] };
  await put(BEFORE, NONE3, none3);
  await opens('★★「該当なし」3つ（基本給・保証手当・変動給）も答え → open');
  for (const [flag, code] of [['fixed_none', 'base'], ['guarantee_none', 'guarantee'],
                              ['variable_none', 'variable']]) {
    await put(BEFORE, NONE3, { ...none3, [flag]: false });
    await lacks(`　${flag} を外す → locked（${code} が残る）`, [code, ...REST]);
  }
  await put(BEFORE, { gross_monthly: 500, base_pay: 0, guarantee_pay: 0,
                      flight_variable_pay: 0, other_allowance: 0 },
            { variable: [{ amount: 0, label: 'Flight Pay', basis: 'unknown' }] });
  await opens('★0 と「わからない」（basis = unknown）も答え → open');
  await put(BEFORE);

  // ── ⑤ 公開から先に同じ月を出し直すと、「前の行」ではなくなる ───────────────
  /* 保存の道（db/pay-reports.sql ── 同じ会社・同じ月は上書き）は、出し直しのたびに
     出した時刻を「いま」にする。公開から先の「いま」は公開より後なので、出し直した行は
     ぜんぶ答える側の線へ移る。ここは保存の道を**そのまま**呼ぶ（submit() の時刻送りを
     通さない）── 時刻が本当に新しくなることを見る。 */
  {
    await opens('（前提）公開の1日前に出した行で開いている');
    const p = { ...BASE, ...CELL, period_year: YEAR, period_month: 1, ...CORE,
                pay_items: FULL.pay_items };
    const r = (await one(`select submit_pay_report($1::jsonb) r`, [JSON.stringify(p)])).r;
    await db.query(`update profiles set pay_reports_today = 0`);
    const s = await one(
      `select r.created_at = $2::timestamptz + interval '-1 day'              as kept,
              r.created_at between now() - interval '5 minutes' and now()     as fresh
         from pay_reports r where r.id = $1`, [idA, LAUNCH]);
    ok(r.id === idA && s.kept === false && s.fresh === true,
       '★★同じ月を出し直すと、同じ行の出した時刻が「いま」に替わる（前の時刻は残らない）',
       JSON.stringify({ same: r.id === idA, ...s }));
    await stamp(idA, AFTER);          // 公開から先の「いま」＝ 公開より後
    await lacks('★★公開から先に出し直した行は「前の行」ではない → locked（残りを答える）', REST);
  }
  // 出し直さずに、別の月を新しく出すぶんには閉め直さない（前の行はそのまま残る）
  await put(BEFORE);
  await put(null, { block_hours: null }, {}, YEAR, 5);
  await opens('★公開から先に別の月を書きかけで出しても、前の行が残っているかぎり閉め直さない');
  // ぜんぶ答えた人は、もちろん出した時刻に関係なく開く
  {
    const uFull = ++seat; await asUser(uFull);
    const id = await put(null, FULL);
    await opens('　ぜんぶ答えた行は、公開から先に出していても open（v_own の道）');
    await stamp(id, BEFORE);
    await opens('　公開より前でも open');
  }

  // ── ④ 窓・本人の行・鍵・みんなの側 ────────────────────────────────────
  // 窓 ── 25か月前は外・24か月前（いちばん古い月）は中（答えきった行と同じ境目）
  const out = await ago(24), old = await ago(23);
  const uW = ++seat; await asUser(uW);
  await put(BEFORE, {}, {}, out.y, out.m);
  {
    const d = await deep();
    ok(d.state === 'locked' && d.gate.ready === false && d.gate.todo === null,
       `★★公開より前に3つ答えていても、窓の外（${out.y}年${out.m}月＝25か月前）の行では開かない`,
       `${d.state} / ${JSON.stringify(d.gate)}`);
  }
  await put(BEFORE, {}, {}, old.y, old.m);
  await opens(`★窓のいちばん古い月（${old.y}年${old.m}月＝24か月前）なら開く（答えきった行と同じ窓）`);

  // 本人の行だけ ── 他人の「前の行」は自分の資格にならない（同じ会社・役職・機材・同じ月）
  const uO = ++seat; await asUser(uO);
  await put(null);
  await asUser(uA);
  await opens('（前提）uA は公開より前の行で開いている');
  await asUser(uO);
  await lacks('★★同じ区分・同じ月に他人の「前の行」が在っても、自分の行が公開から先なら locked', REST);

  // 鍵 ── この道で通る人にも、生きた鍵が要る
  await asUser(uA);
  await db.query(`update profiles set access_until = now() - interval '1 day' where id = $1`,
                 [uid(uA)]);
  {
    const d = await deep();
    ok(d.state === 'locked' && d.gate.key === false && d.gate.ready === true
       && d.gate.todo === null && d.cohort === null && d.head === null && d.picks === null,
       '★★公開より前から居た人でも、鍵が切れていれば locked（中身は渡さない・止めているのは鍵だけ）',
       `${d.state} / ${JSON.stringify(d.gate)}`);
  }
  await openKey(uA); await asUser(uA);
  await opens('　鍵が戻れば open');
  // みんなの側 ── 100人 or 正式公開フラグ（ここまでは試験の抜け道で開けてある）
  await db.query(`select set_config('pv.deep_bypass', '', false)`);
  {
    const d = await deep();
    ok(d.state === 'locked' && d.gate.crowd === false && d.gate.key === true
       && d.gate.ready === true && d.gate.todo === null && d.cohort === null,
       '★★公開より前から居た人でも、みんなの側の条件（100人 or 正式公開）が無ければ locked',
       `${d.state} / ${JSON.stringify(d.gate)}`);
  }
  await db.query(`select set_config('pv.deep_bypass', 'on', false)`);
  await opens('　条件が戻れば open');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 3. 区分のはしご');
// ════════════════════════════════════════════════════════════
// 呼び手は A_HOME / fo / a320。区分に入る行は、このファイルの間ずっとこの1行だけ
// （ほかに「見る資格の1行」を持つが、あれは常識の幅の下＝どの区分にも入らない）。
await asUser(V);
await submit({ ...BASE, airline: A_HOME, position: 'fo', fleet: 'a320',
               period_year: YEAR, period_month: 6, ...DET });
await openKey(V);
await asUser(V);
{
  /* ★2026-10-11 より前は、ここで開いていた（鍵と内訳がそろえば open）。 */
  const d = await deep();
  ok(d.state === 'locked' && d.gate.key === true && d.gate.ready === false,
     '★鍵があって内訳を書いていても、答えきっていなければ locked',
     `${d.state} / ${JSON.stringify(d.gate)}`);
}
await ready(V);
ok((await deep()).state === 'open', '鍵があって、答えきった月が1つあれば open');

// 全体の頭数を壁（2人）以上にしておく（段5が成立する状態）
await person(A_FILL3, 'cap', 'b787', [{ month: 3 }]);
await asUser(V);
{
  const d = await deep();
  ok(d.cohort.level === 'all',
     '★自分だけの会社・役職では段が全部落ちて「全体」になる', d.cohort.level);
  ok(d.cohort.airline === A_HOME && d.cohort.pos === 'fo' && d.cohort.fleet === 'a320',
     '★落ちた段でも、返す会社・役職・機材は呼び手自身の値');
  ok(d.cohort.trust === 'low',
     '★「全体」まで落ちた数字の信頼度は low（区分が広いほど自分の給与から遠い）',
     String(d.cohort.trust));
}

// 同じ会社・同じ役職・違う機材（a321 は無いので b737 = 同じ n 区分）を1人
await person(A_HOME, 'fo', 'b737', [{ month: 3 }]);
await asUser(V);
ok((await deep()).cohort.level === 'airline_pos_cat',
   '★同じ機材区分（narrowbody）で2人そろえば段2');

// 同じ会社・同じ役職・広胴を1人足しても、段2が成立しているので動かない
await person(A_HOME, 'fo', 'b777', [{ month: 5 }]);
await asUser(V);
ok((await deep()).cohort.level === 'airline_pos_cat',
   '段2が成立している間は、より広い段へ行かない');

/* 同じ機材（a320）を1人足すと段1。
   ★この人だけ見本の倍額（DET2・年収 408,000）にしてある。割合は見本と同じなので
     給与構成の検査は動かず、**誰が集計に入ったか**だけが年収の中央値に出る：
       段1（a320 の2人）だけなら        (204,000 + 408,000) ÷ 2 ＝ 306,000
       段2（narrowbody の3人）を集めたら  204,000
       段3（会社×役職の4人）を集めたら    204,000 */
const X2 = await person(A_HOME, 'fo', 'a320', [{ month: 3 }], DET2);
await asUser(V);
{
  const d = await deep();
  ok(d.cohort.level === 'airline_pos_fleet', '★同じ機材で2人そろえば段1に戻る');
  /* ★数えた段と集めた段がずれないこと。前は返ってきた人数を DB の人数と比べていた。
     人数は返らなくなったので、**集めた人たちの中央値**で同じことを見る。 */
  ok(Number(d.head.annual_usd) === 306000,
     '★はしごが数えた段と、実際に集めた段が同じ（段1の2人だけの中央値＝306,000）',
     String(d.head.annual_usd));
  ok(d.cohort.trust === 'low', '2人の区分の信頼度は low', String(d.cohort.trust));
  ok(!('n' in d.cohort) && !('detailed_n' in d.head) && !('verified_n' in d.head),
     '★区分の人数も、詳細投稿の人数も、明細ありの人数も返ってこない（2026-10-11）',
     JSON.stringify({ cohort: Object.keys(d.cohort), head: Object.keys(d.head) }));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 3-b. 手で選んだ区分（2026-08-30）');
// ════════════════════════════════════════════════════════════
/* いまの並び ── 呼び手 V は A_HOME / fo / a320。
     A_HOME fo a320 … 2人（V と、倍額の X2）
     A_HOME fo b737 … 1人
     A_HOME fo b777 … 1人
     A_FILL3 cap b787 … 1人
   ★ここで見たいのは「選べること」ではなく、**選んでも壁が動かないこと**。 */
await asUser(V);
{
  const d = await deep({ airline: A_HOME, position: 'fo', fleet: 'a320' });
  ok(d.cohort.level === 'selected', '選んだ区分は selected として返る', d.cohort.level);
  ok(d.cohort.manual === true, '手で選んだことが分かる（manual）');
  ok(d.cohort.airline === A_HOME && d.cohort.pos === 'fo' && d.cohort.fleet === 'a320',
     '選んだ値がそのまま返る');
  ok(Number(d.head.annual_usd) === 306000,
     '選んだ区分の人たちの中央値が返る（a320 の2人＝306,000）', String(d.head.annual_usd));
}
{
  /* ★本命。1人しか居ない区分を選んでも、広い区分に落として
     その見出しのまま数字を出さないこと。 */
  const d = await deep({ airline: A_HOME, position: 'fo', fleet: 'b737' });
  ok(d.cohort.level === 'none', '★壁（2人）に届かない区分は none（はしごを登らない）', d.cohort.level);
  ok(d.cohort.trust === null && countKeys(d).length === 0,
     '★信頼度の段も付かず、人数も返らない（広い区分の人数を出さない）',
     JSON.stringify(d.cohort));
  /* ★2026-09-01、null を詰めた塊すら返さなくなった（オーナー必須修正2）。
     前は head の中の値が null。今は head という塊ごと返さない。 */
  ok(d.head === null, '★年収も出ない（頭の塊ごと返さない）', JSON.stringify(d.head));
  ok(d.comp === null && d.work === null && (d.var || []).length === 0,
     '★給与構成・働き方・変動給も出ない');
}
{
  const d = await deep({ airline: 'zzzz-not-an-airline', position: 'fo' });
  ok(d.cohort.level === 'none', '★語彙に無い会社は none（広い区分に読み替えない）',
     d.cohort.level);
  ok(d.cohort.airline === null, '★語彙に無い値は echo もしない');
  ok(d.head === null, '★語彙に無い会社で全体の数字が出ない');
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
  /* 副操縦士は全社で4人（204,000 が3人・倍額の X2 が1人）＝中央値 204,000。
     a320 の2人だけを集めていれば 306,000 になるので、絞り方が効いていることが分かる。 */
  ok(Number(d.head.annual_usd) === 204000,
     '数えた区分と集めた区分が同じ（全社の副操縦士4人の中央値＝204,000）',
     String(d.head.annual_usd));
  ok(d.cohort.trust === 'low',
     '★役職だけで選んだ数字の信頼度は low（選んだ軸が1つ）', String(d.cohort.trust));
}
{
  /* ★自分が居ない会社を選んでも、自分の区分の数字が出ないこと。 */
  await person(A_FILL3, 'cap', 'b787', [{ month: 5 }]);   // 1人 → 2人
  await asUser(V);
  const mine = await deep();
  const other = await deep({ airline: A_FILL3, position: 'cap', fleet: 'b787' });
  ok(other.cohort.level === 'selected' && other.cohort.airline === A_FILL3,
     '★自分が居ない会社の区分も、2人そろっていれば見られる');
  ok(Number(other.head.annual_usd) === 204000 && Number(mine.head.annual_usd) === 306000,
     '★出るのはその会社の数字（自分の区分の 306,000 ではない）',
     `${other.head.annual_usd} / ${mine.head.annual_usd}`);
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
/* 前は「6か月ぶん出した人を足すと、返ってくる人数が1だけ増える」で見ていた。
   人数は返らなくなったので、同じことを2つに分けて見る ──
     壁  … 1人が6か月ぶん出しても、その区分は1人のまま＝出ない
     重み … 2人目が来たとき、6か月の人は**6票ではなく1票**で中央値に入る */
{
  const SIX = [{ month: 7 }, { month: 8 }, { month: 9 }, { month: 10 }, { month: 11 }, { month: 12 }];
  await person(A_DUP, 'fo', 'a320', SIX);
  await asUser(V);
  const alone = await deep({ airline: A_DUP, position: 'fo', fleet: 'a320' });
  ok(hidden(alone),
     '★同じ人の6か月ぶんは1人としてしか数えない（6行あっても壁に届かない）',
     JSON.stringify(alone.cohort));
  // 2人目は倍額を1か月だけ。行で数えれば 204,000 が6票で中央値は 204,000 のまま
  await person(A_DUP, 'fo', 'a320', [{ month: 7 }], DET2);
  await asUser(V);
  const two = await deep({ airline: A_DUP, position: 'fo', fleet: 'a320' });
  ok(shown(two), '2人目が出せば、その区分は出る', JSON.stringify(two.cohort));
  ok(Number(two.head.annual_usd) === 306000,
     '★6か月の人は1票（2人の中央値＝306,000。行で数えると 204,000 になる）',
     String(two.head.annual_usd));
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
  ok(k.every(x => ['base','guarantee','variable','command','role',
                   'perdiem','housing','other','rest'].includes(x)),
     '区分の名前は決めた9つだけ', JSON.stringify(k));
  /* 基本給9000 / 17000 ≒ 53%
     ★2026-09-15、'fixed' を 'base'（基本給）と 'guarantee'（保証手当）に割った。
       この見本は guarantee_pay を持たないので、額はそのまま base に出る。 */
  const f = segs.find(s => s.k === 'base');
  ok(f && f.pct >= 50 && f.pct <= 56, '★基本給は約53%（9000 / 17000）', JSON.stringify(f));
  ok(!segs.find(s => s.k === 'guarantee'),
     '　保証手当を書いていない見本には guarantee の区分が出ない（0 を印字しない）');
  const v = segs.find(s => s.k === 'variable');
  ok(v && v.pct >= 21 && v.pct <= 26, '★変動給は約24%（4000 / 17000）', JSON.stringify(v));
  ok(d.head.fixed_pct !== null && d.head.fixed_pct > 0 && d.head.fixed_pct < 100,
     '固定・保証給比率は 0 でも 100 でもない', String(d.head.fixed_pct));
  const cmd = segs.find(s => s.k === 'command'), hou = segs.find(s => s.k === 'housing');
  const rol = segs.find(s => s.k === 'role');
  ok(d.head.fixed_pct === f.pct + (cmd ? cmd.pct : 0) + (rol ? rol.pct : 0),
     '★固定・保証給比率＝基本給＋保証手当＋職位＋役割（配列と食い違わない）',
     `${d.head.fixed_pct} vs ${f.pct}+${cmd ? cmd.pct : 0}+${rol ? rol.pct : 0}`);
  /* ★住宅手当は固定側に入らない（2026-09-01・オーナー確定）。
     住宅手当は働きに対する報酬ではなく住居の補填で、現物の社宅を出す会社では
     同じ待遇でも 0 になる。混ぜると会社どうしの比較が成り立たない。
     この見本は住宅手当を持っているので、足した数と**一致しないこと**が意味を持つ。 */
  ok(hou && hou.pct > 0, '（この見本には住宅手当が在る）', JSON.stringify(hou));
  ok(d.head.fixed_pct !== f.pct + (cmd ? cmd.pct : 0) + (rol ? rol.pct : 0) + hou.pct,
     '★固定・保証給比率に住宅手当は入っていない',
     `${d.head.fixed_pct} / 住宅を足すと ${f.pct + (cmd ? cmd.pct : 0) + (rol ? rol.pct : 0) + hou.pct}`);

  /* ── 月額（平均）── 画面の3列目。
       ★2026-10-12、鍵が med_usd → **avg_usd** に替わった（中央値をやめて平均にしたため）。
         前の名前は、どの区分にも残っていないこと。 */
  ok(segs.every(s => 'avg_usd' in s), 'どの区分にも avg_usd のキーが在る');
  ok(segs.every(s => !('med_usd' in s)), '★前の鍵（med_usd）は、どの区分にも無い（2026-10-12）');
  ok(Number(f.avg_usd) > 0, '★基本給の月額（USD）が出ている', String(f.avg_usd));
  ok(Number(v.avg_usd) > 0 && Number(v.avg_usd) < Number(f.avg_usd),
     '変動給の月額は基本給より小さい', `${v.avg_usd} vs ${f.avg_usd}`);
  ok(segs.every(s => s.avg_usd == null
                  || String(Math.round(Number(s.avg_usd))).replace(/0+$/, '').length <= 2),
     '★月額も有効数字2桁', JSON.stringify(segs.map(s => s.avg_usd)));
  // 賞与ぬきの現金なので、月額の合計は「年収 ÷ 12」を超えない
  const amt = segs.reduce((a, s) => a + Number(s.avg_usd || 0), 0);
  ok(amt > 0 && amt <= Number(d.head.annual_usd) / 12 * 1.3,
     '★月額の合計が年収の月割りとかけ離れていない', `${Math.round(amt)} vs ${Math.round(d.head.annual_usd / 12)}`);
}

// ★項目ごとにも人数の壁（2人）。区分は出ていても、1人しか書いていない項目は出さない。
{
  // 呼び手の区分（A_HOME/fo/a320）に、教官手当を1人だけ書いた人を入れても
  // role は出ない（壁に届かない）
  const segsBefore = (await deep()).comp.segs.map(s => s.k);
  ok(!segsBefore.includes('role'),
     '★役割手当を誰も書いていないので role の区分は無い', JSON.stringify(segsBefore));
  await person(A_HOME, 'fo', 'a320', [{ month: 5, instructor_pay: 3000 }]);
  await asUser(V);
  const one1 = await deep();
  const segsAfter = one1.comp.segs.map(s => s.k);
  ok(!segsAfter.includes('role'),
     '★1人だけが書いた役割手当は区分として出さない（0 でも並べない）',
     JSON.stringify(segsAfter));
  ok(one1.comp.segs.reduce((a, s) => a + s.pct, 0) === 100,
     '　出さなかった分は未分類へ畳まれ、合計は100のまま', JSON.stringify(one1.comp.segs));
  // 2人目が書いた瞬間に出る（厳しすぎて永久に出ない、を防ぐ）
  await person(A_HOME, 'fo', 'a320', [{ month: 6, instructor_pay: 3000 }]);
  await asUser(V);
  const segsTwo = (await deep()).comp.segs.map(s => s.k);
  ok(segsTwo.includes('role'),
     '★2人が書けば役割手当の区分が出る（項目ごとの壁も2人）', JSON.stringify(segsTwo));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 6. 二重計上（変動給とその他手当）');
// ════════════════════════════════════════════════════════════
/* db/pay-reports.sql は pay_items.variable の合計を flight_variable_pay と
   other_allowance の両方に写す。素直に足すと変動給を2回数える。 */
{
  const uD = ++seat; await asUser(uD);
  await submit({ ...BASE, airline: A_DOUBLE, position: 'fo', fleet: 'a320',
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
  const u2 = await person(A_DOUBLE, 'fo', 'a320', [{ month: 3 }], {
    base_pay: 10000, flight_variable_pay: 5000, other_allowance: 5000,
    command_pay: null, per_diem: null, housing_type: null, housing_amount: null,
    pay_items: { v: 1, variable: [{ amount: 5000, basis: 'block', label: 'Flight' }] } });
  const u3 = await person(A_DOUBLE, 'fo', 'a320', [{ month: 4 }], {
    base_pay: 10000, flight_variable_pay: 5000, other_allowance: 5000,
    command_pay: null, per_diem: null, housing_type: null, housing_amount: null,
    pay_items: { v: 1, variable: [{ amount: 5000, basis: 'block', label: 'Flight' }] } });
  await ready(uD); await openKey(uD); await asUser(uD);
  const d = await deep();
  ok(d.cohort.level === 'airline_pos_fleet' && shown(d),
     '二重計上の検査用の区分が出ている（段1）', JSON.stringify(d.cohort));
  const f = d.comp.segs.find(s => s.k === 'base');
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
  const mk = (m) => ({ ...BASE, airline: A_REST, position: 'fo', fleet: 'b737',
                       period_year: YEAR, period_month: m,
                       gross_monthly: 10000, base_pay: 6000 });
  const uR = ++seat; await asUser(uR); await submit(mk(2));
  const u2 = ++seat; await asUser(u2); await submit(mk(3));
  const u3 = ++seat; await asUser(u3); await submit(mk(4));
  await ready(uR); await openKey(uR); await asUser(uR);
  const d = await deep();
  const f = d.comp.segs.find(s => s.k === 'base');
  const rest = d.comp.segs.find(s => s.k === 'rest');
  ok(f && f.pct === 60, '★固定は60%（6000 / 10000）', JSON.stringify(f));
  ok(rest && rest.pct === 40,
     '★残り40%は未分類。0 として消さず、他の区分へ配りもしない', JSON.stringify(rest));
  /* ★2026-10-12 から、未分類の月額も出る。前は「割合には畳んだぶんが入り、金額には入って
       いない」ので出さなかった。いまは割合も金額も**同じ平均の額**から作る ＝ 桁が合う。
       3人とも 総支給 10,000・基本給 6,000 ＝ 未分類 4,000（持つ人が3人 ＝ 壁を越える）。 */
  ok(Number(f.avg_usd) === 6000 && Number(rest.avg_usd) === 4000,
     '★月額は 基本給 6,000・未分類 4,000（割合 60 / 40 と同じ数から出ている）',
     `${f.avg_usd} / ${rest.avg_usd}`);
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 7-b. ★組合が総支給の外で払われている行（2026-09-02）');
// ════════════════════════════════════════════════════════════
/* 本番で実際に起きた形。乗員代表で、会社の明細に印字された総支給（10,000）より
   組合から直接受け取った額（9,000）のほうが大きい月がある。
   総支給だけを「その月の現金」と見なすと、④役割手当が分母を超えて
   上の ok（1.02倍の関所）でこの行がまるごと落ちる ── 年収カードだけでなく
   ドーナツからも消える。cash_m に組合の分を足すと、普通に数えられる。 */
{
  const mk = (m) => ({ ...BASE, airline: A_UNION, position: 'fo', fleet: 'b737',
                       period_year: YEAR, period_month: m,
                       gross_monthly: 10000, base_pay: 6000, union_pay: 9000,
                       job_roles: ['line', 'union'],
                       pay_items: { v: 1, union: { days: 10, extra: 'yes',
                                                   source: 'union', amount: 9000 } } });
  const uU = ++seat; await asUser(uU); await submit(mk(2));
  const u2 = ++seat; await asUser(u2); await submit(mk(3));
  const u3 = ++seat; await asUser(u3); await submit(mk(4));
  await ready(uU); await openKey(uU); await asUser(uU);
  const d = await deep();
  /* ★段1（会社・職位・機材）に残ること。落ちると段が下りて
     よその会社の数字にすり替わる ── 画面は普通に出るので気づけない。
     （3人とも同じ形なので、関所で落ちるなら3人とも落ちて段1ごと消える） */
  ok(d.cohort.level === 'airline_pos_fleet' && shown(d),
     '★組合払いの行が関所で落ちない（落ちると段が下りて別の集団の数字になる）',
     JSON.stringify(d.cohort));
  const seg = (k) => (d.comp?.segs || []).find(s => s.k === k);
  ok(seg('role') && seg('base') && seg('role').pct > seg('base').pct,
     '★役割手当（9,000）が固定給（6,000）より大きい割合で出る',
     JSON.stringify(d.comp?.segs));
  ok((d.comp?.segs || []).reduce((a, s) => a + s.pct, 0) === 100,
     '★割合の合計はちょうど100のまま', JSON.stringify(d.comp?.segs));
  /* ★分母が総支給＋組合であること。19,000 の 6,000 ＝ 32%（10,000 のままなら 60%）。 */
  ok(seg('base') && seg('base').pct === 32,
     '★分母は総支給＋組合（19,000）。固定は32%（総支給だけなら60%になる）',
     String(seg('base')?.pct));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 7-b2. ★不就労減額のあった月（2026-09-12）');
// ════════════════════════════════════════════════════════════
/* 明細に印字された総支給は、欠勤控除などの減額を**引いたあと**の額。いっぽう
   下の8区分（基本給・変動給…）は引く**前**の額。そのまま比べると内訳の合計が
   総支給を超え、上の ok（1.02倍の関所）でこの行がまるごと落ちる ──
   組合の 7-b とまったく同じ形の欠陥で、画面は普通に動いたまま。
   cash_m に減額を足し戻すと普通に数えられる。
   ⚠️ 足すのは分母（その月の現金）だけ。年収（pv_annual_total）には足さない。 */
{
  const mk = (m) => ({ ...BASE, airline: A_ABS, position: 'fo', fleet: 'b737',
                       period_year: YEAR, period_month: m,
                       gross_monthly: 5830, base_pay: 3600,
                       flight_variable_pay: 2240, other_allowance: 2320,
                       per_diem: 90,
                       pay_items: { v: 2,
                                    absence: [{ label: 'Unpaid leave', amount: -180 }] } });
  const uA = ++seat; await asUser(uA); await submit(mk(2));
  const a2 = ++seat; await asUser(a2); await submit(mk(3));
  const a3 = ++seat; await asUser(a3); await submit(mk(4));
  await ready(uA); await openKey(uA); await asUser(uA);
  const d = await deep();
  ok(d.cohort.level === 'airline_pos_fleet' && shown(d),
     '★減額のあった行が関所で落ちない（落ちると段が下りて別の集団の数字になる）',
     JSON.stringify(d.cohort));
  const seg = (k) => (d.comp?.segs || []).find(s => s.k === k);
  ok((d.comp?.segs || []).reduce((a, s) => a + s.pct, 0) === 100,
     '★割合の合計はちょうど100のまま', JSON.stringify(d.comp?.segs));
  /* ★分母は 5,830 ＋ 180 ＝ 6,010（減額前）。固定 3,600 は 60%。
     足し戻さないと分母 5,830 に内訳 6,010 が乗り、そもそも行ごと落ちる。 */
  ok(seg('base') && seg('base').pct === 60,
     '★分母は総支給＋減額（6,010）。基本給は60%', String(seg('base')?.pct));
  /* ★年収は印字の総支給のまま（5,830 × 12 ＝ 69,960）。分母へ足し戻したぶんを
     年収に持ち込まない ── 持ち込むと、休んだ月がある人の年収だけ高く出る。 */
  // （1月は呼び手の「見る資格の1行」。減額のあった見本は2〜4月）
  const ann = await one(
    `select round(annual_total_usd) a from pay_reports
      where airline = $1 and period_month <> 1 limit 1`,
    [A_ABS]);
  ok(Number(ann.a) === 69960,
     '★年収には1円も足し戻さない（5,830 × 12 のまま）', String(ann.a));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 7-c. ★内訳が一部未回答の月（partial・2026-09-12）');
// ════════════════════════════════════════════════════════════
/* 変動給の行を1つだけ書いて、残りは「分からないので空のまま」にした月。
   その月の金額は**入力済み分の合計**でしかないのに、そのまま割合へ混ぜると
   変動給が実際より低く、未分類が実際より高く出る（画面は普通に動いたまま）。
   det（内訳を1つも書いていない月）と同じ理由 ── 観測していないものを 0% と読まない。
   ⚠️ partial の印そのものは**閲覧の資格ではない**。pv_my_give の内訳の鍵は今までどおり
      開く（最後から2本目）。
   ★DEEP PAY の見る資格は、2026-10-11 から別の線（▼2-b）で行ごとに見ている。
     金額の無い変動給の行が残っている月は、そちらで「変動給が未回答」になる（最後の1本）。
     印を読んで閉じているのではない ── 行そのものを読んでいる。 */
{
  const full = (m) => ({ ...BASE, airline: A_PART, position: 'fo', fleet: 'b737',
                         period_year: YEAR, period_month: m,
                         gross_monthly: 10000, base_pay: 6000,
                         flight_variable_pay: 4000, other_allowance: 4000,
                         command_pay: null, per_diem: null,
                         housing_type: null, housing_amount: null,
                         pay_items: { v: 1, variable: [
                           { amount: 3000, basis: 'block', label: 'Flight' },
                           { amount: 1000, basis: 'day',   label: 'Layover' }] } });
  // 同じ形の翌月。2行のうち1行だけ書いて、もう1行は空 ＝ 一部未回答。
  const part = (m) => ({ ...full(m),
                         flight_variable_pay: 1000, other_allowance: 1000,
                         pay_items: { v: 1, partial: true, variable: [
                           { amount: 1000, basis: 'block', label: 'Flight' },
                           { basis: 'day', label: 'Layover' }] } });
  /* ★ちょうど2人（壁ぎりぎり）。一部未回答の月を理由に1人でも落とすと、
       壁を割って区分ごと消える ── 人数を見なくても「落としていない」が分かる。 */
  const seats = [];
  for (let i = 0; i < 2; i++) {
    const u = ++seat; await asUser(u);
    await submit(full(2)); await submit(part(3));
    seats.push(u);
  }
  await ready(seats[0]); await openKey(seats[0]); await asUser(seats[0]);
  const d = await deep();
  ok(d.cohort.level === 'airline_pos_fleet' && shown(d),
     '一部未回答の月があっても2人そろう（人を落としていない）', JSON.stringify(d.cohort));
  const seg = (k) => (d.comp?.segs || []).find(s => s.k === k);
  ok(seg('base') && seg('base').pct === 60,
     '基本給は60%（6,000 / 10,000）', String(seg('base')?.pct));
  ok(seg('variable') && seg('variable').pct === 40,
     '★変動は40%のまま（入力済み分だけの月を割合に混ぜていない。混ぜると25%へ下がる）',
     JSON.stringify(d.comp?.segs));
  ok(!seg('rest'),
     '★未分類が生えない（未回答を「どこにも入れていない現金」として数えない）',
     JSON.stringify(d.comp?.segs));
  /* ★金額の側（2026-10-12）。月額は「使える内訳の月」だけの平均 ＝ 基本給 6,000・変動 4,000。
       一部未回答の月（変動 1,000 だけ書いた月）を混ぜると、変動が (4,000 + 1,000) ÷ 2 ＝ 2,500 に
       下がり、未分類 1,500 が生える。 */
  ok(Number(seg('base')?.avg_usd) === 6000 && Number(seg('variable')?.avg_usd) === 4000,
     '★月額も一部未回答の月を使っていない（基本給 6,000・変動 4,000）',
     JSON.stringify(d.comp?.segs));
  ok(Number(d.head?.annual_usd) > 0,
     '★年収は一部未回答の月も使う（総支給は欠けていない）', String(d.head?.annual_usd));

  // ★資格と完全性は別 ── 一部未回答の月しか出していない人でも鍵は開く
  const uOnly = ++seat; await asUser(uOnly);
  await submit(part(4));
  ok((await give()).detailed === true,
     '★partial だけを理由に内訳の鍵を閉めない（閲覧の資格と、集計に使える完全性は別物）');
  {
    const d = await deep();
    const left = (d.gate.todo && d.gate.todo.items) || [];
    ok(d.state === 'locked' && d.gate.ready === false && left.includes('variable'),
       '★金額の無い変動給の行が残る月は、DEEP PAY の見る資格では「変動給が未回答」（別の線）',
       JSON.stringify(d.gate));
  }
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 8. 働き方（列ごとに人数の壁）');
// ════════════════════════════════════════════════════════════
{
  // 3人。block_hours は3人とも、stay_nights は2人、duty_days は1人だけ書く。
  const mk = (m, extra) => ({ ...BASE, airline: A_WORK, position: 'fo', fleet: 'b767',
                              period_year: YEAR, period_month: m, ...DET,
                              block_hours: 70, ...extra });
  const uW = ++seat; await asUser(uW); await submit(mk(2, { duty_days: 18 }));
  const w2 = ++seat; await asUser(w2); await submit(mk(3, { stay_nights: 6 }));
  const w3 = ++seat; await asUser(w3); await submit(mk(4, { stay_nights: 8 }));
  await ready(uW); await openKey(uW); await asUser(uW);
  const d = await deep();
  ok(d.work.block_h !== null && Number(d.work.block_h) === 70,
     '★3人が書いた Block Hours は出る', String(d.work.block_h));
  ok(Number(d.work.stay_nights) === 7,
     '★2人が書いた列は出る（列ごとの壁も2人。6泊と8泊の中央値＝7）',
     String(d.work.stay_nights));
  ok(d.work.duty_days === null,
     '★1人しか書いていない Duty Days は null（その1人の実数を「中央値」と名乗らない）',
     String(d.work.duty_days));
  ok(d.work.duty_h === null,
     '誰も書いていない列も null（0 にしない）');
}
// ★見出しの Pay / Block Hour にも同じ壁が掛かる（区分は出ていても、列は別に数える）
{
  const mk = (m, extra) => ({ ...BASE, airline: A_ROUND, position: 'fo', fleet: 'b767',
                              period_year: YEAR, period_month: m, ...DET, ...extra });
  const u1 = ++seat; await asUser(u1); await submit(mk(2, { block_hours: 80 }));
  const u2 = ++seat; await asUser(u2); await submit(mk(2, {}));
  await ready(u1); await openKey(u1); await asUser(u1);
  const d1 = await deep();
  ok(shown(d1) && d1.head.per_block_usd === null && d1.work.block_h === null,
     '★乗務時間を書いたのが1人なら Pay / Block Hour は null（区分は2人で出ていても、その1人の実数になるため）',
     JSON.stringify({ head: d1.head, work: d1.work }));
  await asUser(u2); await submit(mk(3, { block_hours: 80 }));
  await asUser(u1);
  const d2 = await deep();
  // 204,000 ÷ 12 ÷ 80 ＝ 212.5
  ok(Number(d2.head.per_block_usd) === 212.5 && Number(d2.work.block_h) === 80,
     '★2人が書いた瞬間に出る（212.5）', JSON.stringify({ head: d2.head, work: d2.work }));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 9. 変動給の中身（区分ごとに人数の壁・まとめない）');
// ════════════════════════════════════════════════════════════
{
  const items = (extra = []) => ({ v: 1, variable: [
    { amount: 3000, basis: 'block',   label: 'Flight Pay' },
    { amount: 1000, basis: 'night',   label: 'Night' },
    ...extra ] });
  const mk = (m, extra) => ({ ...BASE, airline: A_NWH, position: 'fo', fleet: 'b787',
                              period_year: YEAR, period_month: m,
                              base_pay: 8000, flight_variable_pay: 4000 + (extra.add || 0),
                              other_allowance: 4000 + (extra.add || 0),
                              pay_items: items(extra.rows || []) });
  /* ★ちょうど2人（壁ぎりぎり）。block と night は2人とも、weekend は1人だけ書く。 */
  const uN = ++seat; await asUser(uN);
  await submit(mk(2, { add: 500, rows: [{ amount: 500, basis: 'weekend', label: 'Weekend' }] }));
  const n2 = ++seat; await asUser(n2); await submit(mk(3, {}));
  await ready(uN); await openKey(uN); await asUser(uN);
  const d = await deep();
  const ks = d.var.map(x => x.k);
  ok(ks.includes('block') && ks.includes('night'),
     '★2人が書いた区分は出る（block と night）', JSON.stringify(ks));
  ok(!ks.includes('weekend'),
     '★1人しか書いていない weekend は、単独の棒としては並ばない（pct 0 でも置かない）',
     JSON.stringify(ks));
  ok(!ks.some(k => /premium|nwh/i.test(k)),
     '★night / weekend / holiday を1項目にまとめていない', JSON.stringify(ks));
  const sum = d.var.reduce((a, x) => a + x.pct, 0);
  ok(sum === 100, '★変動給の内訳もちょうど100', String(sum));
  ok(d.var.every(x => x.pct > 0), '0% の棒は無い');
  /* ★2026-10-12 から、金額を先に平均して、割合はその平均から出す。壁に届かない連動先は
       **落とさずに rest（集計できなかった分）へ畳む** ── 円は全体のまま。
       手計算（2人の平均。USD）：block (3000 + 3000) ÷ 2 ＝ 3000 ／ night 1000 ／
       weekend (500 + 0) ÷ 2 ＝ 250（持つのは1人 → 畳む）。合計 4250。
         block 70.59 → 71 ／ night 23.53 → 23 ／ rest 5.88 → 6（最大剰余法で合計100）
       前（落として100に直す）は block 75 / night 25 ── 1人しか持たない 250 が消えて、
       残りが実際より大きく出ていた。 */
  const blk = d.var.find(x => x.k === 'block');
  const ngt = d.var.find(x => x.k === 'night');
  const rst = d.var.find(x => x.k === 'rest');
  ok(blk && blk.pct === 71 && ngt && ngt.pct === 23,
     '★block 71%・night 23%（平均の額 3000・1000 を、畳んだぶんも含めた全体 4250 で割る）',
     JSON.stringify(d.var));
  ok(rst && rst.pct === 6,
     '★壁に届かない weekend は rest へ畳まれて 6%（落とさない ＝ 円が全体のまま）',
     JSON.stringify(d.var));
  ok(d.var.every(x => Object.keys(x).sort().join(',') === 'k,pct'),
     '★棒に入っている鍵は k と pct だけ（金額も人数も無い）', JSON.stringify(d.var));
}

// ★許可リストに無い basis は捨てる（other へ寄せない）
{
  const mk = (m) => ({ ...BASE, airline: A_BASIS, position: 'fo', fleet: 'a330',
                       period_year: YEAR, period_month: m,
                       base_pay: 8000, flight_variable_pay: 4000, other_allowance: 4000,
                       pay_items: { v: 1, variable: [
                         { amount: 3000, basis: 'block', label: 'Flight' },
                         { amount: 1000, basis: 'zzz',   label: 'Nonsense' }] } });
  const uB = ++seat; await asUser(uB); await submit(mk(2));
  const b2 = ++seat; await asUser(b2); await submit(mk(3));
  const b3 = ++seat; await asUser(b3); await submit(mk(4));
  await ready(uB); await openKey(uB); await asUser(uB);
  const d = await deep();
  const ks = d.var.map(x => x.k);
  ok(!ks.includes('zzz') && !ks.includes('other'),
     '★知らない basis は捨てる。other に寄せて本物の答えに見せない', JSON.stringify(ks));
  ok(ks.length === 1 && ks[0] === 'block' && d.var[0].pct === 100,
     '残った区分だけで100%になる', JSON.stringify(d.var));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 10. 丸め（見出しは刻み・月額は有効数字2桁）と常識の幅');
// ════════════════════════════════════════════════════════════
/* ★2026-10-11（オーナー判断）── 見出しの2つだけ、有効数字2桁から**刻み**に替えた。
       年収の中央値      … $50 刻み （148,140 → 148,150。前は 150,000）
       Pay / Block Hour … $0.5 刻み（176.36 → 176.5。前は 180）
     給与構成の月額は今までどおり有効数字2桁（12,345 → 12,000）。
     どちらの道でも、丸める前の額そのものは返り値のどこにも出ない。 */
{
  /* ★総支給と内訳を食い違わせない。DET（内訳17000）に gross_monthly 12345 を
     足すと「内訳が総支給をはみ出している行」になり、検品で正しく落ちる。
     落ちると区分が段5まで落ちて、この節が測りたい丸めではなく別のものを見てしまう。 */
  const mk = (m, g) => ({ ...BASE, airline: A_SIG, position: 'fo', fleet: 'a350',
                          period_year: YEAR, period_month: m,
                          gross_monthly: g, base_pay: g, block_hours: 70 });
  const uS = ++seat; await asUser(uS); await submit(mk(2, 12345));
  const s2 = ++seat; await asUser(s2); await submit(mk(3, 12345));
  const s3 = ++seat; await asUser(s3); await submit(mk(4, 12345));
  await ready(uS); await openKey(uS); await asUser(uS);
  const d = await deep();
  // 12345 × 12 = 148140 → $50 刻み = 148150（有効数字2桁なら 150000）
  ok(Number(d.head.annual_usd) === 148150,
     '★年収は $50 刻み（148,140 → 148,150。有効数字2桁の 150,000 ではない）',
     String(d.head.annual_usd));
  // 148140 ÷ 12 ÷ 70 = 176.357… → 保存時に 176.36 → $0.5 刻み = 176.5
  // （1月は呼び手の「見る資格の1行」。丸めの見本は2〜4月）
  const rawP = await one(
    `select usd_per_block_hour p from pay_reports
      where airline = $1 and period_month <> 1 limit 1`, [A_SIG]);
  ok(Number(rawP.p) === 176.36, '（前提）保存してある時間あたりは 176.36', String(rawP.p));
  ok(Number(d.head.per_block_usd) === 176.5,
     '★Pay / Block Hour は $0.5 刻み（176.36 → 176.5。有効数字2桁の 180 ではない）',
     String(d.head.per_block_usd));
  const base = d.comp.segs.find(s => s.k === 'base');
  ok(base && Number(base.avg_usd) === 12000,
     '★給与構成の月額は有効数字2桁のまま（12,345 → 12,000。刻みに替えていない）',
     JSON.stringify(base));
  /* ★月換算（賞与ぬき）も有効数字2桁（2026-10-12）。見出しの2つの刻みにはしていない。
       3人とも 12,345 × 12 ÷ 12 ＝ 12,345 → 12,000。 */
  ok(Number(d.head.month_usd) === 12000,
     '★月換算（head.month_usd）も有効数字2桁（12,345 → 12,000）', String(d.head.month_usd));
  ok(!/148140|12345|176\.36/.test(JSON.stringify(d)),
     '★元の実額が返り値のどこにも出ていない');
}
// 刻みの道具そのもの（pv_deep_step）
{
  const st = async (v, s) => {
    const r = (await one(`select pv_deep_step($1::numeric, $2::numeric) v`, [v, s])).v;
    return r === null ? null : Number(r);
  };
  ok(await st(148140, 50) === 148150, 'pv_deep_step：148,140 を 50 刻みで → 148,150');
  ok(await st(148124.99, 50) === 148100 && await st(148125, 50) === 148150,
     'pv_deep_step：いちばん近い倍数に寄せる（境目の 148,125 は上へ）');
  ok(await st(92.59, 0.5) === 92.5 && await st(92.76, 0.5) === 93,
     'pv_deep_step：0.5 刻み（92.59 → 92.5 ／ 92.76 → 93）');
  ok(await st(null, 50) === null && await st(0, 50) === null && await st(-5, 50) === null,
     '★null と 0 以下は null（0 を置いて埋めない）');
}
{
  // 幅の外は数えない
  const mk = (m, g) => ({ ...BASE, airline: A_BAND, position: 'fo', fleet: 'a380',
                          period_year: YEAR, period_month: m,
                          gross_monthly: g, base_pay: g });
  const uL = ++seat; await asUser(uL); await submit(mk(2, 20000));   // 年 240,000 → 入る
  const l2 = ++seat; await asUser(l2); await submit(mk(3, 400));     // 年   4,800 → 落ちる
  const l3 = ++seat; await asUser(l3); await submit(mk(4, 70000));   // 年 840,000 → 落ちる
  await ready(uL); await openKey(uL); await asUser(uL);
  const d = await deep();
  ok(d.cohort.level !== 'airline_pos_fleet',
     '★幅の外の2人は数えないので、この機材では壁（2人）に届かない', d.cohort.level);
  ok(hidden(await deep({ airline: A_BAND, position: 'fo', fleet: 'a380' })),
     '　手で選んでも出ない（幅の中に居るのは1人だけ）');
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
  ok(Object.keys(d.cohort).sort().join(',') === 'airline,fleet,level,manual,pos,trust',
     '区分に入っているキーは6つだけ（人数は無く、信頼度の段が在る）',
     Object.keys(d.cohort).join(','));
  /* ★2026-10-12、見出しの鍵は 3 → 6。足したのは 月換算（month_usd）と、賞与の目印の
       真偽2つ（bonus_est / bonus_gap）。**人数も、賞与の額も、足していない。** */
  ok(Object.keys(d.head).sort().join(',')
       === 'annual_usd,bonus_est,bonus_gap,fixed_pct,month_usd,per_block_usd',
     '見出しに入っているキーは6つだけ（人数も、賞与の額も無い）', Object.keys(d.head).join(','));
  ok(typeof d.head.bonus_est === 'boolean' && typeof d.head.bonus_gap === 'boolean',
     '★賞与の目印は真偽だけ（数ではない）',
     `${typeof d.head.bonus_est} / ${typeof d.head.bonus_gap}`);
  ok(Object.keys(d.comp).sort().join(',') === 'bonus,segs,total_kind',
     '給与構成に入っているキーは3つだけ（人数は無い）', Object.keys(d.comp).join(','));
  ok(Object.keys(d.gate).sort().join(',') === 'contributors,crowd,goal,key,ready,todo',
     '門に入っているキーは6つ（2026-10-11：detailed が無くなり、ready と todo が入った）',
     Object.keys(d.gate).join(','));
  ok(d.gate.ready === true && d.gate.todo === null,
     '　答えきっている呼び手には、残っている項目も、どの月の行かも返っていない',
     JSON.stringify(d.gate));
}

/* ★人数のキーが、返り値の奥まで探しても1つも無い（2026-10-11・オーナー判断）。
     「隠すのではなく、最初から渡さない」。画面で伏せるだけだと、関数を直接叩けば取れる。
   見るのは cohort / head / comp / work / var の5つの塊ぜんぶ ── n という名前と、
   _n で終わる名前を、配列の中の要素まで探す。
   ★ここの見本は2つ：数字が出ている区分・壁に届かない区分。
     賞与の行が出ている区分（前は賞与を貰った人数も返していた）は ▼16 で見る。
   ⚠️ gate.contributors / stats.* は**サイト全体**の数なので、ここでは見ない。 */
{
  await asUser(V);
  const open = await deep();
  ok(shown(open) && open.comp && open.comp.segs.length > 0 && Array.isArray(open.var),
     '（前提）数字が出ている区分で確かめる', JSON.stringify(open.cohort));
  ok(countKeys(open).length === 0,
     '★★数字が出ている区分の返り値に、人数のキーが1つも無い', countKeys(open).join(' '));
  const thin = await deep({ airline: A_HOME, position: 'fo', fleet: 'b737' });
  ok(hidden(thin) && countKeys(thin).length === 0,
     '★★壁に届かない区分の返り値にも、人数のキーが1つも無い', countKeys(thin).join(' '));
  // 道具そのものが空回りしていないこと（見つけるべき形を渡せば見つける）
  ok(countKeys({ cohort: { n: 3 }, head: { detailed_n: 3 },
                 comp: { bonus: { n: 2 }, segs: [{ k: 'base', n: 1 }] } }).length === 4,
     '（検査の道具）人数のキーを渡せば、入れ子の奥・配列の中でも見つける');
}

// ★呼び手ごとに違う区分が返る
{
  const uP = ++seat; await asUser(uP);
  await submit({ ...BASE, airline: A_PEER, position: 'cap', fleet: 'b747',
                 period_year: YEAR, period_month: 6, ...DET });
  await ready(uP); await openKey(uP); await asUser(uP);
  const dp = await deep();
  await asUser(V);
  const dv = await deep();
  ok(dp.cohort.airline === A_PEER && dv.cohort.airline === A_HOME,
     '★呼んだ人ごとに、その人自身の会社が返る');
  ok(dp.cohort.pos === 'cap' && dv.cohort.pos === 'fo',
     '★役職も呼んだ人自身の値');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12. 預かりと、持ち主に当たらない口コミは集計に混ぜない');
// ════════════════════════════════════════════════════════════
/* 前は「預かりと口コミを足しても、返ってくる人数が変わらない」で見ていた。
   人数は返らなくなったので、**会員が1人だけの区分**で見る ── 預かりや口コミが
   頭数に入るなら、壁（2人）に届いてその1人の数字が出てしまう。
   ★2026-10-12 から、昔の口コミに書かれた年収は**年収の母集団に入る**（▼29）。ただし入るのは
     「同じ人に当たる」口コミだけ ── 対応表（pv_review_person）に無い口コミは、誰のものか
     分からないので数えない（fail closed）。ここの口コミは持ち主の鍵がでたらめ ＝ 当たらない。
     しかも選んでいるのは機材まで絞った区分で、口コミ由来は機材を持たない ＝ 二重に入らない。
   ★預かりは今も読まない（端末 × 日であって人ではない。壁を押し上げる）。 */
{
  await person(A_PEND, 'fo', 'a320', [{ month: 3 }]);      // 会員は1人だけ
  await asUser(V);
  const before = await deep();
  ok(hidden(await deep({ airline: A_PEND, position: 'fo', fleet: 'a320' })),
     '（前提）会員が1人だけの区分は出ていない');
  await asAnon();
  // ★預かりは内訳つき（DET）。「内訳が無いから数えない」ではなく、預かりだから数えない
  const pend = (await one(`select submit_pay_report_pending($1::jsonb) r`, [JSON.stringify({
    ...BASE, airline: A_PEND, position: 'fo', fleet: 'a320',
    period_year: YEAR, period_month: 2, ...DET })])).r;
  ok(pend && typeof pend.claim_token === 'string', '（前提）預かりが1件できた');
  await db.query(
    `insert into reviews_v2(proof_hash, airline, "position", annual_salary)
     values ('zz-review-1', $1, 'fo', 3000)`, [A_PEND]);
  await asUser(V);
  const after = await deep();
  ok(hidden(await deep({ airline: A_PEND, position: 'fo', fleet: 'a320' })),
     '★預かりと、持ち主に当たらない口コミは区分の頭数に入らない（会員1人のまま＝出ない）');
  ok(hidden(await deep({ airline: A_PEND, position: 'fo' }))
     && hidden(await deep({ airline: A_PEND })),
     '★機材で絞らない区分（会社×職位・会社だけ）でも同じ ── 預かりも、当たらない口コミも数えない');
  ok(JSON.stringify(after.head) === JSON.stringify(before.head)
     && JSON.stringify(after.comp) === JSON.stringify(before.comp),
     '★呼び手自身の区分の数字も1つも動かない');
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
  ok(Number(nv.c) === 2,
     '呼び手の行も自分のぶんだけ拾う（区分に入る1行＋見る資格の1行＝2件）', String(nv.c));
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
  const mk = (m) => ({ ...BASE, airline: A_BONUS, position: 'fo', fleet: 'crj',
                       period_year: YEAR, period_month: m, ...DET,
                       bonus_annual: 40000 });
  const uB = ++seat; await asUser(uB); await submit(mk(2));
  const b2 = ++seat; await asUser(b2); await submit(mk(3));
  const b3 = ++seat; await asUser(b3); await submit(mk(4));
  await ready(uB); await openKey(uB); await asUser(uB);
  const d = await deep();
  ok(!d.comp.segs.some(s => /bonus/i.test(s.k)),
     '★賞与はドーナツの区分に入っていない', JSON.stringify(d.comp.segs.map(s => s.k)));
  ok(d.comp.bonus && d.comp.bonus.pct_of_annual > 0,
     '★賞与は別行として返る', JSON.stringify(d.comp.bonus));
  // 現金 17000/月 = 204000/年 + 賞与 40000 = 244000。40000/244000 ≒ 16%
  ok(d.comp.bonus.pct_of_annual >= 14 && d.comp.bonus.pct_of_annual <= 18,
     '賞与は年収の約16%', String(d.comp.bonus.pct_of_annual));
  ok(Object.keys(d.comp.bonus).join(',') === 'pct_of_annual' && countKeys(d).length === 0,
     '★賞与の行に入っているのは割合だけ（貰った人数は返さない）',
     JSON.stringify(d.comp.bonus));
}
// 賞与を誰も書いていない区分では別行そのものが無い
await asUser(V);
ok((await deep()).comp.bonus === null,
   '★賞与を書いた人が壁（2人）に届かなければ、その行ごと出さない');

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
  await ready(uSame);
  await openKey(uSame);
  await asUser(uSame);
  const d = await deep();

  // 保存した生の値（画面に出る前）。年収と Pay/BH は投稿した瞬間に列へ確定する。
  // （1月は呼び手の「見る資格の1行」。まったく同じ4人の見本は2月）
  const raw = await one(
    `select annual_total_usd a, usd_per_block_hour p from pay_reports
      where airline = $1 and position = 'cap' and period_month <> 1 limit 1`, [A_SPARE]);
  /* ★見出しの2つは 2026-10-11 から刻み（年収＝$50・Pay / Block Hour＝$0.5）。
       この見本は 228,000 と 237.5 で、どちらも最初から刻みの倍数 ＝ 丸めても動かない。
       だから「保存した値そのもの」と「＝」で結べる（丸めで動く例は ▼10 に在る）。 */
  const step = async (v, s) =>
    Number((await one(`select pv_deep_step($1::numeric, $2::numeric) v`, [v, s])).v);

  ok(Number(raw.a) === 12 * 17000 + BON,
     '★年収＝月々の現金×12 ＋ 年間賞与（内訳17000・賞与24000）', String(raw.a));
  ok(Number(raw.p) === Math.round(Number(raw.a) / (12 * BH) * 100) / 100,
     '★Pay / Block Hour ＝ 年収 ÷ 12 ÷ Block Hours（保存時の定義）',
     `${raw.p} vs ${Number(raw.a) / (12 * BH)}`);

  ok(Number(d.work.block_h) === BH, '★Block Hours はそのまま出ている', String(d.work.block_h));
  ok(Number(d.head.annual_usd) === await step(Number(raw.a), 50)
     && Number(d.head.annual_usd) === 228000,
     '★画面の年収＝保存した年収を $50 刻みに寄せただけ（228,000）',
     `${d.head.annual_usd} vs ${raw.a}`);
  ok(Number(d.head.per_block_usd) === await step(Number(raw.a) / 12 / BH, 0.5)
     && Number(d.head.per_block_usd) === 237.5,
     '★画面の Pay / Block Hour ＝ 年収 ÷ 12 ÷ Block Hours を $0.5 刻みに寄せただけ（237.5）',
     `${d.head.per_block_usd} vs ${Number(raw.a) / 12 / BH}`);

  /* ★年収カードの「月換算（賞与ぬき）」と、給与構成の月額が同じ土俵に乗っているか。
     2026-10-12 まで、画面（deep-pay.js の moneyMonth）が 年収 ×(1−賞与割合)÷12 で作っていた。
     いまはサーバが head.month_usd で出す（年収は全員・賞与の平均込み、賞与の割合は内訳を
     書いた人だけ ── 母集団の違う2つを画面で掛けさせないため）。
     この見本は4人とも同じで、全員が内訳も賞与も書いている ＝ どの道で出しても同じ額になる。 */
  const bp = Number(d.comp.bonus.pct_of_annual);
  ok(bp === Math.round(BON / Number(raw.a) * 100),
     '★賞与の割合＝年間賞与 ÷ 年収', `${bp} vs ${BON}/${raw.a}`);
  const monthly = Number(d.head.annual_usd) * (1 - bp / 100) / 12;
  const amt = d.comp.segs.reduce((a, x) => a + Number(x.avg_usd || 0), 0);
  ok(Math.abs(amt - monthly) / monthly <= 0.08,
     '★給与構成の月額の合計＝年収 ×(1−賞与割合)÷12（丸めのぶんだけずれる）',
     `${Math.round(amt)} vs ${Math.round(monthly)}`);
  // （228,000 − 24,000）÷ 12 ＝ 17,000。内訳の合計（17,000）とちょうど同じ
  ok(Number(d.head.month_usd) === 17000 && amt === 17000,
     '★月換算（head.month_usd）＝（年収 − 年間賞与）÷ 12 ＝ 給与構成の月額の合計（17,000）',
     `${d.head.month_usd} / ${amt}`);
  /* ★賞与の目印。4人とも同じ額を申告している ＝ 平均は 24,000 で、割り振っても1人も動かない
       （228,000 − 24,000 ＋ 24,000）。それでも「平均で作った」ので bonus_est は true。
       全員が答えているので bonus_gap は false。 */
  ok(d.head.bonus_est === true && d.head.bonus_gap === false,
     '★全員が同じ賞与を申告した区分：平均で作った印は立ち、賞与が無い人の印は立たない',
     JSON.stringify(d.head));
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
console.log('\n▼ 20. 境界（2026-09-01 の作り直しで効かせたもの）');
// ════════════════════════════════════════════════════════════
/* ★Codex の独立監査で出た6件のうち、直した4件をここで1つずつ固定する。
     どれも **画面は普通に動いたまま静かに違う数字を出す** 形なので、
     ここが赤くなったら検査を直す前に db/deep-pay.sql の並び（hum→…→coh）を読む。

   ★この節は**いちばん最後に置く**。中で会社を10社ぶん増やし、最後に人を99人
     積むので、先に置くと上の節の「壁に届いている／いない」が全部ずれる。
   ★2026-10-11、どの見本も**ちょうど2人（壁ぎりぎり）**に組み直した。人数は返って
     こないので、「2人とも集計に入っている」ことを「壁を割っていない＝出ている」で見る。
     1人でも落ちれば none になる ── 3人で組むと、1人落ちても出たままで気づけない。 */

// 上の節が使っていない会社を借りる（AIR は先頭20社）
const EX = (await rows(
  `select code from pv_airlines
    where code <> 'other' and active
      and code <> all(string_to_array($1, ','))
    order by code limit 14`, [AIR.join(',')])).map(r => r.code);
ok(EX.length >= 13, '境界テスト用の会社が足りている', String(EX.length));

// ★「いまから k か月前」を数える ago() は、道具の節（ファイルの頭）へ移した
//   （2026-10-11。▼2-b の見る資格の窓も同じ道具で測るため。定義は1つのまま）。

// ── (a) 昇進しても、FO だったころの給与は FO の統計に残る ──────
{
  const A = EX[0];
  for (let i = 0; i < 2; i++)
    await person(A, 'fo', 'a320',
      [{ month: 2 }, { month: 3 },
       { month: 6, position: 'cap', fleet: 'b777', base_pay: 19000 }]);
  await asUser(V);
  const fo  = await deep({ airline: A, position: 'fo',  fleet: 'a320' });
  const cap = await deep({ airline: A, position: 'cap', fleet: 'b777' });
  ok(shown(fo),  '★昇進した2人の「FO だった月」が FO の区分に残っている（1人でも欠ければ出ない）',
     JSON.stringify(fo.cohort));
  ok(shown(cap), '★同じ2人が CAP の区分にも居る（月ごとに分かれる）',
     JSON.stringify(cap.cohort));
  /* FO の月は見本どおり 204,000。CAP の月は基本給だけ 19,000 に上げた 324,000。
     混ざっていれば、どちらかがこの額からずれる。 */
  ok(Number(fo.head.annual_usd) === 204000 && Number(cap.head.annual_usd) === 324000,
     '★CAP の年収に FO だった月が混ざっていない（前は人の代表値1つで分けていた）',
     `${fo.head.annual_usd} → ${cap.head.annual_usd}`);
}

// ── (b) 機種を変えても、変える前の機種の統計が残る ──────────────
{
  const A = EX[1];
  for (let i = 0; i < 2; i++)
    await person(A, 'cap', 'a320',
      [{ month: 2 }, { month: 6, fleet: 'b787', base_pay: 19000 }]);
  await asUser(V);
  const a = await deep({ airline: A, position: 'cap', fleet: 'a320' });
  const b = await deep({ airline: A, position: 'cap', fleet: 'b787' });
  ok(shown(a) && shown(b),
     '★機種を変えた2人が、前の機種にも今の機種にも居る',
     `${a.cohort.level} / ${b.cohort.level}`);
  ok(Number(a.head.annual_usd) === 204000 && Number(b.head.annual_usd) === 324000,
     '★新しい機種の数字に前の機種の月が混ざっていない',
     `${a.head.annual_usd} → ${b.head.annual_usd}`);
}

// ── (c) 「直近24か月」は**その報酬がいつのものか**で見る ──────────
/* 前は「いつ投稿されたか」で見ていたので、5年前の給与を昨日書いた行が
   直近に入り、去年書いた去年の給与が今年落ちていた。 */
{
  const out = await ago(24);   // 25か月前 ＝ 窓の1つ外
  const old = await ago(23);   // いちばん古い、窓の中
  const now = await ago(0);    // 当月

  for (let i = 0; i < 2; i++)
    await person(EX[2], 'cap', 'b787',
      [{ period_year: out.y, period_month: out.m }]);
  for (let i = 0; i < 2; i++)
    await person(EX[3], 'cap', 'b787',
      [{ period_year: old.y, period_month: old.m }]);
  for (let i = 0; i < 2; i++)
    await person(EX[4], 'cap', 'b787',
      [{ period_year: now.y, period_month: now.m }]);
  await asUser(V);

  const dOut = await deep({ airline: EX[2], position: 'cap', fleet: 'b787' });
  const dOld = await deep({ airline: EX[3], position: 'cap', fleet: 'b787' });
  const dNow = await deep({ airline: EX[4], position: 'cap', fleet: 'b787' });
  ok(hidden(dOut), `★${out.y}年${out.m}月（25か月前）は入らない`, JSON.stringify(dOut.cohort));
  ok(shown(dOld),  `★${old.y}年${old.m}月（24か月前）は入る`,   JSON.stringify(dOld.cohort));
  ok(shown(dNow),  `★${now.y}年${now.m}月（当月）は入る`,       JSON.stringify(dNow.cohort));
}

// ── (d) 未来の月は、投稿の時点で弾かれている ───────────────────
/* ＝上の窓の「上限」は保険。既存の行を1つも落とさないことの根拠。 */
{
  const f = await ago(-1);            // 来月
  const u = ++seat;
  await asUser(u);
  const e = await boom(`select submit_pay_report($1::jsonb)`,
    [JSON.stringify({ ...BASE, airline: EX[5], position: 'cap', fleet: 'b777',
                      period_year: f.y, period_month: f.m, ...DET })]);
  ok(/未来/.test(e || ''), '★未来の月は投稿の時点で弾かれる（DB 側の検証が生きている）',
     String(e).slice(0, 60));
}

// ── (e) その月の賞与を年に2回数えない ─────────────────────────
/* 総支給 19000・そのうち賞与 2000 → その月の現金は 17000。
   年収は (19000 − 2000) × 12。賞与の割合の分子にもう一度足すと、
   給与構成の月額が 15000 になって年収カードと食い違う。 */
{
  const A = EX[7];
  for (let i = 0; i < 2; i++)
    await person(A, 'cap', 'b777', [{ month: 4 }],
                 { gross_monthly: 19000, bonus_month: 2000 });
  await asUser(V);
  const d = await deep({ airline: A, position: 'cap', fleet: 'b777' });
  ok(shown(d), '2人そろっている', JSON.stringify(d.cohort));
  ok(d.comp.bonus === null,
     '★その月の賞与は「年収に対する賞与の割合」に出さない（総支給の中に既にある）',
     JSON.stringify(d.comp.bonus));
  const amt = d.comp.segs.reduce((a, x) => a + Number(x.avg_usd || 0), 0);
  ok(Math.abs(amt - 17000) / 17000 <= 0.02,
     '★給与構成の月額の合計＝総支給 − その月の賞与（二重に引かれていない）',
     `${Math.round(amt)} vs 17000`);
  ok(Number(d.head.month_usd) === 17000,
     '★月換算（head.month_usd）も、その月の賞与を引いた 17,000（年収が既に引いている）',
     String(d.head.month_usd));
}

// ── (f) 賞与の割合は「申告した人だけ」の数字ではない ──────────────
/* 2026-10-12 まで、ここは「7人中3人が貰っていても、割合の中央値は 0」を固定していた
   （Codex ⑥。直さないと決めた読み違いの形）。割合を平均の比に替えたので、その形は消えた ──
     分子 … 内訳を書いた7人の、申告されていた年額の平均 ＝ 24,000 × 3 ÷ 7 ＝ 10,285.7
     分母 … 同じ7人の、保存してある年収の平均 ＝（228,000 × 3 ＋ 204,000 × 4）÷ 7 ＝ 214,285.7
     割合 ＝ 4.8% → 5%（中央値なら 0%・申告した人だけなら 10.5% → 11%）
   ★賞与を答えていない4人は、分子に 0・分母に賞与抜きの年収で入る（保存してあるまま）。
     「5%」＝「全員が 5% 貰っている」ではない ── 見出しの年収の側は、下のとおり全員に平均を割り振る。 */
{
  const A = EX[8];
  for (let i = 0; i < 3; i++) await person(A, 'cap', 'b787', [{ month: 4 }], { bonus_annual: 24000 });
  for (let i = 0; i < 4; i++) await person(A, 'cap', 'b787', [{ month: 4 }]);
  await asUser(V);
  const d = await deep({ airline: A, position: 'cap', fleet: 'b787' });
  /* ★前はここで「貰った人は3人」という人数も確かめていた。人数は返らなくなったので、
       行が出ている（＝受給者が壁に届いている）ことと、割合を見る。 */
  ok(d.comp.bonus && Number(d.comp.bonus.pct_of_annual) === 5,
     '★7人中3人が申告：賞与の割合は平均の比で 5%（中央値の 0% でも、申告した人だけの 11% でもない）',
     JSON.stringify(d.comp.bonus));
  ok(Object.keys(d.comp.bonus).join(',') === 'pct_of_annual',
     '★賞与の行は割合だけ（貰った人数は返さない）', JSON.stringify(d.comp.bonus));
  /* ★見出しの年収（2026-10-12）。申告した3人の平均は 24,000。全員に割り振るので、
       申告した人 228,000 − 24,000 ＋ 24,000 ＝ 228,000 ／ 答えていない人 204,000 ＋ 24,000 ＝ 228,000。
       7人とも 228,000（保存してあるままの中央値なら 204,000）。 */
  ok(Number(d.head.annual_usd) === 228000,
     '★★年収は、賞与の平均を全員に割り振った 228,000（保存してあるままなら 204,000）',
     String(d.head.annual_usd));
  ok(d.head.bonus_est === true && d.head.bonus_gap === false,
     '★平均で作った印（bonus_est）が立ち、賞与が無い人の印（bonus_gap）は立たない',
     JSON.stringify(d.head));
  ok(Number(d.head.month_usd) === 17000,
     '★月換算は賞与の平均に左右されない（7人とも 17,000。申告した人は自分の賞与を引いた額）',
     String(d.head.month_usd));
}
{
  const A = EX[9];
  for (let i = 0; i < 2; i++) await person(A, 'cap', 'b787', [{ month: 4 }], { bonus_annual: 24000 });
  await person(A, 'cap', 'b787', [{ month: 4 }]);
  await asUser(V);
  const d = await deep({ airline: A, position: 'cap', fleet: 'b787' });
  ok(d.comp.bonus && Number(d.comp.bonus.pct_of_annual) > 0,
     '★3人中2人なら中央値は 0 でない（門は受給者2人で開く）',
     JSON.stringify(d.comp.bonus));
}
{
  // 受給者が1人だけ → 区分は出るが、賞与の行は出ない（その1人の割合がそのまま出るため）
  const A = EX[6];
  await person(A, 'cap', 'b787', [{ month: 4 }], { bonus_annual: 24000 });
  await person(A, 'cap', 'b787', [{ month: 4 }]);
  await asUser(V);
  const d = await deep({ airline: A, position: 'cap', fleet: 'b787' });
  ok(shown(d) && d.comp && d.comp.bonus === null,
     '★受給者が1人なら賞与の行ごと出さない（区分そのものは2人で出ている）',
     JSON.stringify({ level: d.cohort.level, bonus: d.comp && d.comp.bonus }));
  /* ★見出しの側も同じ壁（2026-10-12）。申告した人が1人では平均を作らない ── 作ると、
       答えていない人の年収が「204,000 ＋ その1人の賞与」になって、賞与が割り戻せる。
       年収は保存してあるまま：(228,000 ＋ 204,000) ÷ 2 ＝ 216,000。 */
  ok(Number(d.head.annual_usd) === 216000 && d.head.bonus_est === false
     && d.head.bonus_gap === true,
     '★申告した人が1人：年収は保存してあるまま（216,000）・平均の印は立たず、賞与が無い人の印が立つ',
     JSON.stringify(d.head));
}

// ── (g) 人の対応表 ── 正常な行は落ちず、当たらない行は壁を押し上げない ──
{
  const miss = await one(
    `select count(*) n from pay_reports r
       left join pv_pay_person_map() m on m.h = r.proof_hash
      where m.human is null`);
  ok(Number(miss.n) === 0,
     '★submit_pay_report を通した行は1行残らず「同じ人」に当たる（fail closed の代償が出ない）',
     String(miss.n));

  const A = EX[10];
  const us = [];
  for (let i = 0; i < 2; i++) us.push(await person(A, 'cap', 'b787', [{ month: 8 }]));
  await asUser(V);
  ok(shown(await deep({ airline: A, position: 'cap', fleet: 'b787' })),
     '2人そろえば出る（このあと1人を名簿から消す）');

  const before = Number((await one(
    `select count(*) n from pay_reports where airline = $1`, [A])).n);
  await db.query(`delete from profiles where id = $1`, [uid(us[0])]);
  await asUser(V);
  const d = await deep({ airline: A, position: 'cap', fleet: 'b787' });
  ok(Number((await one(`select count(*) n from pay_reports where airline = $1`, [A])).n) === before
     && before === 2,
     '★行そのものは消えていない（消したのは名簿だけ・行は2件のまま）');
  ok(hidden(d),
     '★名簿に当たらない行は壁を押し上げない（数えられるのは1人＝数字が出ない）',
     JSON.stringify(d.cohort));
}

// ── (h) 人の通し番号は返り値に1文字も出ない ─────────────────────
{
  await asUser(V);
  const s = JSON.stringify(await deep({ airline: EX[0], position: 'fo', fleet: 'a320' }));
  ok(!s.includes('human'), '★返ってきた JSON に人の通し番号が出ない');
}

/* ★100人目になった人。▼21 でこの1人だけを名簿から消して 100 → 99 に落とす。
     消す相手を決め打ちにしないと、どの人を消したかで人数が変わって読めなくなる。 */
let HUNDREDTH = null;
// ── (i) 100人の門（★この節はいちばん最後。人を99人積む）──────────
{
  /* ★gate.crowd（2026-10-11）──「みんなの側」の条件（100人以上 or 手動フラグ）が
       満たされているか。門が読んでいるのと**同じ値**で、画面はこれが false のときだけ
       「100人に届いたら開く」の行を出す。ここまでは抜け道が立っていたので true。 */
  await asUser(V);
  ok((await deep()).gate.crowd === true,
     '（前提）抜け道が立っているあいだ、crowd は true（門と同じ値）');

  await db.query(`select set_config('pv.deep_bypass', '', false)`);
  await asUser(V);
  {
    const d = await deep();
    ok(d.state === 'locked', '★抜け道を外すと、100人に届くまで locked');
    ok(d.gate.crowd === false && d.gate.key === true && d.gate.ready === true,
       '★★鍵が在って答えきってもいる人を止めているのは人数だけ ＝ crowd が false で返る',
       JSON.stringify(d.gate));
  }

  /* ★本番と同じ形（auth.users が在る）にすると、抜け道を立てても効かない。
     ＝「管理者だけ静かに迂回できる隠し例外」になっていないことの証拠。 */
  await db.exec(`create table auth.users (id uuid primary key)`);
  await db.query(`select set_config('pv.deep_bypass', 'on', false)`);
  await asUser(V);
  {
    const d = await deep();
    ok(d.state === 'locked',
       '★本番の形では抜け道が効かない（隠し例外になっていない）');
    ok(d.gate.crowd === false, '　crowd も false のまま（門と食い違わない）');
  }
  await db.exec(`drop table auth.users`);
  await db.query(`select set_config('pv.deep_bypass', '', false)`);

  const cur = Number((await one(`select pv_deep_contributors() n`)).n);
  ok(cur < 99, `いまの人数は ${cur}人（ここから99人まで積む）`, String(cur));

  let last;
  for (let i = cur; i < 99; i++)
    last = await person(EX[11], 'cap', 'b777', [{ month: 9 }]);

  ok(Number((await one(`select pv_deep_contributors() n`)).n) === 99,
     '★ちょうど99人');

  // 同じ人が2社目に出しても人数は増えない（人×会社では数えない）
  await asUser(last);
  await submit({ ...BASE, airline: EX[12], position: 'cap', fleet: 'b777',
                 period_year: YEAR, period_month: 11, ...DET });
  ok(Number((await one(`select pv_deep_contributors() n`)).n) === 99,
     '★既に出している人が2社目に出しても99人のまま');

  await asUser(V);
  let d = await deep();
  ok(d.state === 'locked' && d.cohort === null && d.head === null,
     '★99人では開かない（中身のキーは渡さない）');
  ok(d.gate.crowd === false, '★99人では crowd は false', JSON.stringify(d.gate));
  ok(Number(d.gate.contributors) === 99 && Number(d.gate.goal) === 100,
     '★錠前に出す人数と門が同じ数（「表示は100人なのに開かない」が起きない）',
     `${d.gate.contributors}/${d.gate.goal}`);
  ok(Number(d.stats.contributors) === 99,
     '★左メニューの数も同じ（3か所とも pv_deep_contributors() を呼んでいる）',
     String(d.stats.contributors));
  const g = (await one(`select pv_give_progress() g`)).g;
  ok(Number(g.contributors) === 99, '★Give の進み具合も同じ数', String(g.contributors));

  // 100人目
  HUNDREDTH = await person(EX[11], 'cap', 'b777', [{ month: 9 }]);
  await asUser(V);
  d = await deep();
  ok(Number(d.gate.contributors) === 100, '★100人になった', String(d.gate.contributors));
  ok(d.state === 'open' && d.cohort !== null, '★100人で開く');
  ok(d.gate.crowd === true, '★100人で crowd は true', JSON.stringify(d.gate));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 21. オーナー確定の6件（2026-09-01・Codex 再監査分）');
// ════════════════════════════════════════════════════════════
/* ★この節も▼20と同じく**最後に置く**。中で人を足し引きするので、
     先に置くと上の節の「壁に届いている／いない」が全部ずれる。

   見ているのは4つ。どれも **画面は普通に動いたまま静かに違う数字を出す** 形：
     ・内訳を書いていない月が「0%」として給与構成に混ざる
     ・人数の壁に満たないのに、関数を直接叩けば集計値が取れてしまう
     ・「◯人」に登録前の預かり（端末×日）が混ざる
     ・正式公開フラグが、消し残した自動記録のトリガで勝手に立つ

   ★この節は▼20の続きから始まる。入口の状態は
     「ちょうど100人・手動フラグは立っていない・抜け道は外れている」。 */

// ▼20 と▼21 の前で使っていない会社を借りる
const EX2 = (await rows(
  `select code from pv_airlines
    where code <> 'other' and active
      and code <> all(string_to_array($1, ','))
    order by code limit 10`, [AIR.concat(EX).join(',')])).map(r => r.code);
ok(EX2.length >= 7, '▼21 用の会社が足りている', String(EX2.length));

// ── (f) 解放は「今100人以上 or 手動フラグ」の2つだけ ────────────
/* ★2026-09-01、100人到達を自動で永久記録する仕掛け（表2つのトリガ）は取りやめた。
     残っているのはこの1行だけ：
       開く ＝ 今のユニークな人数が100人以上  or  pv_deep_launch に行が在る
     フラグは**管理者が一度だけ手で立てる。** 自動では立たないし、自動では降りない。
   ★ここで指定の 1〜5 を順に確かめる（99人で閉じる／100人で開く／100→99で閉じる／
     フラグを立てれば99人でも開く／預かりは人数に入らない）。 */
{
  // ① 自動では立たない ── 100人に達しても表は空のまま
  ok(Number((await one(`select count(*) n from pv_deep_launch`)).n) === 0,
     '★★100人に達しても正式公開フラグは立たない（自動で書く仕掛けはもう無い）');

  // ② 100人ちょうどで開く
  await asUser(V);
  ok((await deep()).state === 'open', '★100人ちょうどで開く');

  // ③ 100人目が退会して99人 → 閉じる（フラグを立てるまでは毎回判定する）
  await db.query(`delete from profiles where id = $1`, [uid(HUNDREDTH)]);
  await asUser(V);
  let d = await deep();
  ok(Number((await one(`select pv_deep_contributors() n`)).n) === 99, '★99人に戻った');
  ok(d.state === 'locked' && Number(d.gate.contributors) === 99,
     '★★フラグを立てるまでは 100人 → 99人 で閉じる',
     `${d.state} / ${d.gate.contributors}`);

  // ④ 登録前の預かりは何件あっても人数に入らない
  await asAnon();
  const toks = [];
  for (let i = 0; i < 5; i++)
    toks.push((await one(`select submit_pay_report_pending($1::jsonb) r`, [JSON.stringify({
      ...BASE, airline: EX2[2], position: 'cap', fleet: 'b777',
      period_year: YEAR, period_month: 3 + i, ...DET })])).r.claim_token);
  ok(toks.every(t => typeof t === 'string' && t.length > 16), '預かりが5件できた');
  ok(Number((await one(`select pv_deep_contributors() n`)).n) === 99,
     '★★登録前の預かりは何件あっても人数に入らない（端末×日を「人」と呼ばない）');
  await asUser(V);
  ok((await deep()).state === 'locked', '★預かり5件では開かない');

  // ⑤ 預けた人が会員になって引き取る＝ここで初めて100人目になる
  const uC = ++seat;
  await asUser(uC);
  const r = (await one(`select claim_pending_report($1) r`, [toks[0]])).r;
  ok(r.ok === true, '預かりを引き取れた', JSON.stringify(r));
  ok(Number((await one(`select pv_deep_contributors() n`)).n) === 100,
     '★引き取って会員になった瞬間に100人目になる（会員になって初めて1人）');
  await asUser(V);
  ok((await deep()).state === 'open', '★また開いた');

  // ⑥ その人が退会すれば また閉じる ── 自動記録がもう無いことの証拠
  await db.query(`delete from profiles where id = $1`, [uid(uC)]);
  await asUser(V);
  d = await deep();
  ok(d.state === 'locked' && Number(d.gate.contributors) === 99,
     '★★また99人になれば また閉じる（自動で永久記録する仕掛けは消えている）',
     `${d.state} / ${d.gate.contributors}`);
  ok(d.gate.crowd === false, '　このとき crowd は false（止めているのは人数）',
     JSON.stringify(d.gate));

  // ⑦ 管理者が手でフラグを立てる → 99人でも開く
  await db.query(`insert into pv_deep_launch (one) values (true) on conflict do nothing`);
  await asUser(V);
  d = await deep();
  ok(d.state === 'open',
     '★★手動フラグを立てれば99人でも開く（開く ＝ 100人以上 or フラグ）', d.state);
  ok(Number(d.gate.contributors) === 99,
     '★人数は正直に99と出す（開いているのに99、が正しい状態）',
     String(d.gate.contributors));
  /* ★★ここが gate.crowd を足した理由そのもの（2026-10-11）。
       99 / 100 のまま開いている日に、画面が contributors と goal を比べて
       「100人に届いたら開く」を出すと、鍵の無い人に嘘の理由を見せることになる。
       その人を止めているのは人数ではなく、自分の鍵。 */
  ok(d.gate.crowd === true && Number(d.gate.contributors) < Number(d.gate.goal),
     '★★フラグで開いた日は、99 / 100 のままでも crowd は true（人数を比べて決めない）',
     JSON.stringify(d.gate));
  {
    const uLk = ++seat;
    await asUser(uLk);                       // 1枚も出していない人
    const dl = await deep();
    ok(dl.state === 'locked' && dl.gate.crowd === true
       && dl.gate.key === false && dl.gate.ready === false,
       '★★鍵の無い人にも crowd は true で返る（「人数待ち」と言わせない）',
       JSON.stringify(dl.gate));
    await asUser(V);
  }

  // ⑧ 通常ユーザーはフラグを読むことも書くこともできない
  const priv = (await one(
    `select case when not has_table_privilege('authenticated','public.pv_deep_launch','select')
                  and not has_table_privilege('authenticated','public.pv_deep_launch','insert')
                  and not has_table_privilege('anon','public.pv_deep_launch','select')
                  and not has_table_privilege('anon','public.pv_deep_launch','insert')
                 then 'ok' else 'ng' end as x`)).x;
  ok(priv === 'ok',
     '★★通常ユーザーはフラグを読むことも書くこともできない（RLS ＋ 全権限 revoke）', priv);

  // ⑨ SQL を貼り直しても、立てたフラグは消えも増えもしない
  await db.exec(read('db/pay-rows.sql'));
  ok(Number((await one(`select count(*) n from pv_deep_launch`)).n) === 1,
     '★貼り直してもフラグは1行のまま（勝手に降りない・勝手に増えない）');
  ok((await rows(`select tgname from pg_trigger
                   where not tgisinternal and tgname like 'trg_pv_deep_latch%'`)).length === 0,
     '★★自動記録のトリガは1本も残っていない（貼り直しで消える後始末が効いている）');
  await asUser(V);
  ok((await deep()).state === 'open', '★貼り直したあとも開いたまま');
}

/* ── (a)(b) 給与構成は「内訳を書いた月」だけで出す【Release blocker】──
   2人とも「総支給だけの月が2つ・内訳を書いた月が1つ（固定給100%）」。
   ★直す前は、内訳を書いていない2か月が「固定給 0%」という観測として
     中央値に混ざり、固定給が 100% → 0% に化けていた。
   ★同時に、その2か月が**年収の統計からは消えていない**ことも見る。 */
{
  const C = EX2[1];
  for (let i = 0; i < 2; i++) {
    const u = ++seat;
    await asUser(u);
    for (const m of [2, 3])       // 総支給だけ（内訳なし）
      await submit({ ...BASE, airline: C, position: 'cap', fleet: 'b777',
                     period_year: YEAR, period_month: m, gross_monthly: 10000 });
    await submit({ ...BASE, airline: C, position: 'cap', fleet: 'b777',   // 内訳あり
                   period_year: YEAR, period_month: 4, base_pay: 30000 });
  }
  await asUser(V);
  const d = await deep({ airline: C, position: 'cap', fleet: 'b777' });
  ok(shown(d), '2人そろっている', JSON.stringify(d.cohort));
  const seg = (d.comp.segs || []).find(s => s.k === 'base');
  ok(seg && Number(seg.pct) === 100,
     '★★内訳を書いた月だけで割合を出す（3か月のうち1か月しか書いていなくても固定給100%）',
     JSON.stringify(d.comp.segs));
  ok(Number(d.head.annual_usd) === 120000,
     '★総支給だけの月も年収の統計には残る（120000。内訳の月だけなら360000になる）',
     String(d.head.annual_usd));
}

/* ── (c)(c') 数えられる人が1人 → 関数が集計値を1つも返さない ────
   ★オーナー必須修正2。画面で隠すのではなく**返り値に入れない。**
     ここは画面を通さず関数を直接呼んでいる＝API を叩いた人と同じ見え方。
   ★2026-10-11、壁は 3人 → 2人。「2人では出ない／3人で出る」だったここを、
     「1人では出ない／2人で出る」に置き換えた。
   ★2026-10-12、数えるのは「有効な年収を出した人」になった（前は「内訳を書いた人」）。
     この見本は内訳つき（DET）なので、どちらの数え方でも1人。 */
{
  const B = EX2[0];
  const u1 = await person(B, 'cap', 'b787', [{ month: 5 }]);
  await asUser(V);
  const d = await deep({ airline: B, position: 'cap', fleet: 'b787' });
  ok(d.cohort.level === 'none' && d.cohort.trust === null,
     '★1人では区分そのものが空（広い区分の数字で埋めない・信頼度の段も付けない）',
     JSON.stringify(d.cohort));
  ok(d.head === null && d.comp === null && d.work === null && d.var === null,
     '★★壁に届かなければ head / comp / work / var を1つも返さない',
     JSON.stringify({ head: d.head, comp: d.comp, work: d.work, var: d.var }));
  const s = JSON.stringify(d);
  for (const k of ['annual_usd', 'per_block_usd', 'month_usd', 'fixed_pct',
                   'bonus_est', 'bonus_gap',
                   'pct_of_annual', 'block_h', 'duty_h', 'stay_nights', 'avg_usd', 'med_usd'])
    ok(!s.includes(k), `★返ってきた JSON に ${k} が1文字も無い`);
  ok(countKeys(d).length === 0, '★人数のキーも1つも無い', countKeys(d).join(' '));
  ok(d.ok === true && d.state === 'open' && d.gate && d.give
     && typeof d.stats.contributors === 'number',
     '★「非公開だと画面が判断するための材料」は返す（ok/state/gate/give/stats/cohort）');

  // ── (d)(d') 2人目が出した瞬間に4つとも出る（厳しすぎて永久に出ない、を防ぐ）
  await person(B, 'cap', 'b787', [{ month: 5 }]);
  await asUser(V);
  const d3 = await deep({ airline: B, position: 'cap', fleet: 'b787' });
  ok(d3.cohort.level === 'selected' && d3.cohort.trust === 'low',
     '★2人になった（区分が出て、信頼度の段は low）', JSON.stringify(d3.cohort));
  ok(d3.head !== null && d3.comp !== null && d3.work !== null && d3.var !== null,
     '★★2人になった瞬間に4つとも出る',
     JSON.stringify({ head: !!d3.head, comp: !!d3.comp,
                      work: !!d3.work, var: !!d3.var }));
  ok(Number(d3.head.annual_usd) > 0, '★年収の中央値が出る', String(d3.head.annual_usd));

  // ── (g) 区分の人数の壁は「今のデータ」で毎回判定する（100人の門とは別物）
  await db.query(`delete from profiles where id = $1`, [uid(u1)]);
  await asUser(V);
  const d2 = await deep({ airline: B, position: 'cap', fleet: 'b787' });
  ok(hidden(d2),
     '★2人→1人に減れば、その区分はまた非表示になる', JSON.stringify(d2.cohort));
  ok(d2.state === 'open',
     '★★区分が消えてもサイト全体は開いたまま（区分の壁と100人の区切りは別物）', d2.state);
}

/* ── (h) 1人1票 ── 給与差の大きい2社を経験した人 ──────────────
   ★機種だけで選ぶ（この機種を出しているのはこの3人だけ）。
     直す前は本人×会社で数えていたので、この人が2人になり、
     人数も中央値もずれた（3人 → 4人 / 150000 → 180000）。 */
{
  const F = 'dhc8';
  const uMix = ++seat;
  await asUser(uMix);
  for (let m = 1; m <= 6; m++)         // A社：月 5,000 → 年 60,000
    await submit({ ...BASE, airline: EX2[4], position: 'cap', fleet: F,
                   period_year: YEAR, period_month: m, base_pay: 5000 });
  for (let m = 7; m <= 12; m++)        // B社：月 20,000 → 年 240,000
    await submit({ ...BASE, airline: EX2[5], position: 'cap', fleet: F,
                   period_year: YEAR, period_month: m, base_pay: 20000 });
  for (const v of [10000, 25000]) {    // 同じ機種の別の2人
    const u = ++seat;
    await asUser(u);
    await submit({ ...BASE, airline: EX2[4], position: 'cap', fleet: F,
                   period_year: YEAR, period_month: 2, base_pay: v });
  }
  await asUser(V);
  const d = await deep({ fleet: F });
  ok(Number(d.head.annual_usd) === 150000,
     '★その人の寄与は自分の12か月の中央値1つ（12票でも2票でもない。2票なら180000）',
     String(d.head.annual_usd));

  /* ★★壁の側（2026-10-11）。壁が2人になったので、ここがいちばん危ない形になった ──
       **2社に出した1人**を会社ごとに数えると、それだけで2人＝壁に届き、
       その1人の年収がそのまま「中央値」として出る。
     この機種（ATR）を出しているのは、2社を経験したこの1人だけ。 */
  const F2 = 'atr';
  const uOne = ++seat;
  await asUser(uOne);
  await submit({ ...BASE, airline: EX2[4], position: 'cap', fleet: F2,
                 period_year: YEAR, period_month: 2, base_pay: 9000 });
  await submit({ ...BASE, airline: EX2[5], position: 'cap', fleet: F2,
                 period_year: YEAR, period_month: 8, base_pay: 21000 });
  ok(Number((await one(`select count(distinct proof_hash) n from pay_reports
                         where fleet = $1`, [F2])).n) === 2,
     '（前提）この1人の行は、鍵（本人×会社）で数えると2つ在る');
  await asUser(V);
  ok(hidden(await deep({ fleet: F2 })),
     '★★2社を経験した1人は1人（会社ごとに2人と数えない＝壁に届かず、何も出ない）');
}

/* ── (i) 3つのハッシュ式が同じ人を指している ────────────────────
   ★pv_my_keys / pv_my_give / pv_pay_person_map に同じ式の写しが3つある。
     今回まとめない代わりに、ズレをここで検出する（技術的負債の印は
     db/pay-rows.sql の pv_pay_person_map のコメントに置いた）。 */
{
  const uK = ++seat;
  await asUser(uK);
  await submit({ ...BASE, airline: EX2[6], position: 'cap', fleet: 'b777',
                 period_year: YEAR, period_month: 2, ...DET });
  await submit({ ...BASE, airline: 'other', airline_other: 'Nowhere Air Three',
                 position: 'cap', fleet: 'b777',
                 period_year: YEAR, period_month: 3, ...DET });
  /* ★pv_my_keys は「あり得る鍵」を総当たりで作る（語彙110社 ＋ 実在する
       自由入力の社名ぶん）ので、返る本数そのものは人数と関係が無い。
       見るのは**その鍵に当たった本人の行**。 */
  const ks = (await rows(
    `select r.proof_hash h from pay_reports r
      where r.proof_hash in (select pv_my_keys())`)).map(r => r.h);
  ok(ks.length === 2, '★pv_my_keys が本人の2社ぶんの行を拾う', String(ks.length));
  const hum = await rows(
    `select distinct m.human from pv_pay_person_map() m
      where m.h = any(string_to_array($1, ','))`, [ks.join(',')]);
  ok(hum.length === 1,
     '★pv_pay_person_map は2社ぶんを同じ1人に当てる', JSON.stringify(hum));
  const cnt = await one(
    `select count(*) c from pay_reports r
       join pv_pay_person_map() m on m.h = r.proof_hash
      where m.human = $1`, [hum[0] && hum[0].human]);
  ok(Number(cnt.c) === 2, '★その人の行は2件（会社ごとに別人になっていない）', String(cnt.c));
  const g = await give();
  ok(g.basic === true && g.detailed === true,
     '★pv_my_give も同じ2件を拾う（3つの式が同じ答えを出す）', JSON.stringify(g));
}
await asUser(V);

/* ── (k) 選べる組み合わせ（picks）── 画面の選択肢はこれで絞る ────
   約束は1つ ── **選べる ＝ 必ず数字が返る**（オーナー確定 2026-09-01）。
   110社・3職位・19機材を素で並べると、選んだ先が「まだ出せません」しか無い
   選択肢が大半になる。だから中身のある組み合わせだけをサーバから配る。

   ★数え方は区分の壁（lvl）と**同じでなければならない**
     ＝「有効な年収を出した**実人物**が2人以上」（人数は 2026-10-11 から2人。数える相手は
       2026-10-12 から ── その前は「内訳を書いた月を持つ人」だけを数えていた）。
     ズレると「選択肢に出ているのに選ぶと空」が、**画面は普通に動いたまま**起きる。
     行で数えていないか／1人の複数月で増えないか／**総支給だけの人も頭数に入っているか**を、
     4社を並べて確かめる。
   ★「選べる ＝ **年収が**必ず返る」。給与構成は別の壁（内訳を書いた人が2人）なので、
     選べる区分でも comp が null のことがある（下の Z）。

   ★最後に**配った選択肢を全部たどって、本当に数字が返るかを確かめる**。
     ここが約束そのもの。閾値を片方だけ直した日に、必ずここが落ちる。 */
{
  const NEW = (await rows(
    `select code from pv_airlines
      where code <> 'other' and active
        and code <> all(string_to_array($1, ','))
      order by code limit 4`, [AIR.concat(EX, EX2).join(',')])).map(r => r.code);
  ok(NEW.length === 4, '★(k) 用の会社を4社借りられた', String(NEW.length));
  const [X, Y, Z, Q] = NEW;

  /* ★どの見本も**壁ぎりぎり**で組む（出る側はちょうど2人・出ない側はちょうど1人）。
       3人で組むと、数え方が1人ぶんずれても出たままで気づけない。 */
  // X … 機長×B777 が2人（うち1人は2か月ぶん）→ 会社も、機長も、B777 も出る
  await person(X, 'cap', 'b777', [{ month: 6 }, { month: 7 }]);
  await person(X, 'cap', 'b777', [{ month: 6 }]);
  // X … 副操縦士×A320 も2人 → 同じ会社で職位が2つ、機材は職位ごとに違う
  await person(X, 'fo', 'a320', [{ month: 6 }]);
  await person(X, 'fo', 'a320', [{ month: 6 }]);
  /* X … 機長×A320 は1人だけ。会社ぜんぶで見れば A320 は3人（副操縦士2＋機長1）
       なので、**機材の一覧を会社だけで作ると A320 が機長の欄に出てしまう**。
       選ぶと空になる。会社×職位で数えている証拠にする。 */
  await person(X, 'cap', 'a320', [{ month: 6 }]);
  // Y … 内訳つきで1人 → 出ない
  await person(Y, 'cap', 'b777', [{ month: 6 }]);
  /* Z … 2人いて、内訳を書いたのは1人（2人目は総支給だけ・年 120,000）。
       ★2026-10-12 から**出る**（前は、総支給だけの人を頭数に入れず「出ない」だった）。
         年収は2人の中央値 (204,000 ＋ 120,000) ÷ 2 ＝ 162,000。
         給与構成は、内訳を書いた人が1人なので返さない（その1人の内訳を平均と名乗らない）。 */
  await person(Z, 'cap', 'b777', [{ month: 6 }]);
  {
    const u = ++seat;
    await asUser(u);
    await submit({ ...BASE, airline: Z, position: 'cap', fleet: 'b777',
                   period_year: YEAR, period_month: 6, gross_monthly: 10000 });
  }
  // Q … 1人が3か月ぶん出しただけ → 出ない（行ではなく人を数えている証拠）
  await person(Q, 'cap', 'b777', [{ month: 6 }, { month: 7 }, { month: 8 }]);

  await asUser(V);
  const d = await deep();
  const pk = d.picks;
  const sorted = (l) => JSON.stringify(l) === JSON.stringify(l.slice().sort());

  ok(pk && Array.isArray(pk.air) && pk.pos && pk.flt
        && !Array.isArray(pk.pos) && !Array.isArray(pk.flt),
     '★選べる組み合わせは 会社 / 会社ごとの職位 / 会社×職位ごとの機材 の3つで返る',
     JSON.stringify(Object.keys(pk || {})));

  // ── 会社 ────────────────────────────────────────────────
  ok(pk.air.includes(X), '★内訳つきで2人そろった会社は一覧に出る');
  ok(!pk.air.includes(Y),
     '★★1人しか居ない会社は一覧に出ない（選んでも空になる選択肢を並べない）');
  ok(pk.air.includes(Z),
     '★★内訳を書いたのが1人でも、年収を出した人が2人いる会社は一覧に出る（総支給だけの人も頭数に入る・2026-10-12）');
  ok(!pk.air.includes(Q),
     '★★1人が3か月ぶん出しただけの会社は出ない（行ではなく人を数えている）');
  ok(!pk.air.includes('other'),
     '★一覧に無い航空会社（other）は会社として選ばせない（別々の会社が1社に潰れるため）');
  ok(!Object.keys(pk.pos).includes('other') && !Object.keys(pk.flt).some(k => k.startsWith('other|')),
     '★other は職位・機材の鍵にも出ない');
  ok(sorted(pk.air),
     '★一覧は並びが決まっている（呼ぶたびに順番が変わらない）', JSON.stringify(pk.air));
  ok(pk.air.every(c => typeof c === 'string' && c !== ''),
     '★入っているのは会社コードだけ（人数も、どの会社が何人かも返さない）');

  // ── 会社ごとの職位 ──────────────────────────────────────
  ok((pk.pos[X] || []).includes('cap') && (pk.pos[X] || []).includes('fo'),
     '★その会社で数字が返る職位が並ぶ', JSON.stringify(pk.pos[X]));
  ok(!pk.pos[Y] && !pk.pos[Q],
     '★★数字が返らない会社は職位の鍵ごと無い（会社を選べないので職位も要らない）');
  ok((pk.pos[Z] || []).includes('cap') && (pk.flt[Z + '|cap'] || []).includes('b777'),
     '★総支給だけの人が居る会社も、職位・機材まで選べる（2人とも機長・B777）',
     JSON.stringify({ pos: pk.pos[Z], flt: pk.flt[Z + '|cap'] }));
  ok(Array.isArray(pk.pos['']),
     '★会社を選ばないときの職位も入っている（空文字＝絞っていない）',
     JSON.stringify(pk.pos['']));

  // ── 会社×職位ごとの機材 ────────────────────────────────
  const fX = (a, b) => pk.flt[a + '|' + b] || [];
  ok(fX(X, 'cap').includes('b777'), '★会社×職位で2人そろった機材は出る',
     JSON.stringify(fX(X, 'cap')));
  ok(!fX(X, 'cap').includes('a320'),
     '★★機材の一覧は「会社×職位」で数える（会社ぜんぶでは3人でも、機長では1人なので出さない）',
     JSON.stringify(fX(X, 'cap')));
  ok(fX(X, 'fo').includes('a320'), '★同じ会社でも職位が違えば機材の一覧が違う',
     JSON.stringify(fX(X, 'fo')));
  ok(fX(X, '').includes('a320') && fX(X, '').includes('b777'),
     '★職位を選ばないときは会社ぜんぶで数える（A320 は3人なので出る）',
     JSON.stringify(fX(X, '')));
  ok(Array.isArray(pk.flt['|']), '★どちらも選ばないときの機材も入っている',
     JSON.stringify(pk.flt['|']));
  ok(Object.values(pk.pos).concat(Object.values(pk.flt))
       .every(l => Array.isArray(l) && l.length && sorted(l) && l.every(v => v !== '')),
     '★★どの一覧も 空でない・並びが決まっている・空文字が混ざらない');

  /* ★★ここが約束そのもの。**配った選択肢を1つ残らず選んでみて、
       本当に数字が返るかを確かめる。** 閾値や数え方を片方だけ直すと、
       画面は普通に動いたまま「選べるのに空」が生まれる。 */
  {
    const combos = [];
    for (const a of pk.air) combos.push({ airline: a });
    for (const [a, ps] of Object.entries(pk.pos))
      for (const ps1 of ps) combos.push(a ? { airline: a, position: ps1 } : { position: ps1 });
    for (const [k, fs] of Object.entries(pk.flt)) {
      const [a, ps1] = k.split('|');
      for (const f of fs) combos.push(Object.assign({ fleet: f },
        a ? { airline: a } : {}, ps1 ? { position: ps1 } : {}));
    }
    const bad = [];
    for (const c of combos) {
      const r = await deep(c);
      /* ★「数字が返る」＝区分が出ていて、年収の中央値が在り、信頼度の段が付いている。
           前は返ってきた人数が壁以上かを見ていた。人数は返らなくなった。 */
      if (!shown(r) || r.cohort.level !== 'selected'
          || !(Number(r.head.annual_usd) > 0) || countKeys(r).length) bad.push(c);
    }
    ok(bad.length === 0,
       `★★配った選択肢 ${combos.length} 通りを全部たどって、全部で数字が返る`,
       JSON.stringify(bad.slice(0, 5)));
  }
  /* ★逆も見る。配っていない組み合わせは none で返り続ける
       （壁が緩んだのに一覧だけ古い、の逆パターンを止める）。 */
  ok(hidden(await deep({ airline: Y })),
     '★一覧に無い会社を手で指定しても数字は出ない');
  {
    /* ★★ここが 2026-10-12 に変わった所。総支給だけの人も年収の母集団に入る。 */
    const z = await deep({ airline: Z, position: 'cap', fleet: 'b777' });
    ok(shown(z) && Number(z.head.annual_usd) === 162000,
       '★★総支給だけの人も数える：年収は2人の中央値 162,000（内訳を書いた1人だけなら、そもそも出ない）',
       JSON.stringify({ cohort: z.cohort, head: z.head }));
    ok(z.comp === null && z.var === null && z.head.fixed_pct === null,
       '★★内訳を書いた人が1人なので、給与構成・変動給の中身・固定・保証給比率は返さない（年収は出たまま）',
       JSON.stringify({ comp: z.comp, var: z.var, fixed: z.head.fixed_pct }));
    ok(z.work !== null && Number(z.head.month_usd) === 14000,
       '　働き方の塊と月換算は出る（月換算＝(17,000 ＋ 10,000) ÷ 2 ＝ 13,500 → 有効数字2桁で 14,000）',
       JSON.stringify({ work: z.work, month: z.head.month_usd }));
    const s = JSON.stringify(z);
    ok(!s.includes('avg_usd') && !s.includes('pct_of_annual') && countKeys(z).length === 0,
       '　返ってきた JSON に、内訳の金額も賞与の割合も人数も1文字も無い');
  }
  ok(hidden(await deep({ airline: X, position: 'cap', fleet: 'a320' })),
     '★★一覧に無い機材を手で指定しても数字は出ない（一覧と壁が同じ場所を見ている）');

  /* ★選んだ区分で一覧が入れ替わらないこと。入れ替わると、会社Aを選び直している
       途中で会社Bが選択肢から消える（B社を選んでいる側の欄が空になる）。 */
  const pkSel = (await deep({ airline: Y, position: 'cap', fleet: 'b777' })).picks;
  ok(JSON.stringify(pkSel) === JSON.stringify(pk),
     '★★選んだ区分では一覧が変わらない（選び直しの途中で会社が消えない）',
     JSON.stringify(pkSel && pkSel.air));

  /* ★鍵が閉じている人には一覧そのものを渡さない。
       画面は閉じているときそもそも選択欄を出さないが、**渡していないものは
       隠せない**（pv_pay_rows の rows と同じ考え方）。 */
  const uNo = ++seat;
  await asUser(uNo);
  const dLock = await deep();
  ok(dLock.state === 'locked' && dLock.picks === null,
     '★★鍵が閉じている人には一覧そのものを渡さない',
     `${dLock.state} / ${JSON.stringify(dLock.picks)}`);
  await asUser(V);
}

// ▼22 用に、ここまでのどの節も使っていない会社を借りる（先頭4社は (k) が使った）
const EX3 = (await rows(
  `select code from pv_airlines
    where code <> 'other' and active
      and code <> all(string_to_array($1, ','))
    order by code limit 6`, [AIR.concat(EX, EX2).join(',')])).map(r => r.code).slice(4);
ok(EX3.length >= 2, '▼22 用の会社が足りている', String(EX3.length));

// ════════════════════════════════════════════════════════════
console.log('\n▼ 22. 信頼度の段（cohort.trust）── 人数のかわりに返す、たった1つの値');
// ════════════════════════════════════════════════════════════
/* 2026-10-11（オーナー判断）。区分の人数は返さず、3段だけを返す。
   式は db/deep-pay.sql の trust ── それまで画面（deep-pay.js）が人数から
   出していたものを、そのままサーバへ移した（画面の側の式はもう無い。
   画面は返ってきた cohort.trust を読むだけ）：
     人数の段   … 10人以上＝3 ／ 5人以上＝2 ／ それ未満＝1
     区分の上限 … 段1（会社×役職×機材）・段2（会社×役職×機材区分）＝3
                   段3（会社×役職）＝2 ／ 段4（役職のみ）・段5（全体）＝1
                   手で選んだ区分は、選んだ軸の数（3つ＝3 ／ 2つ＝2 ／ 1つ＝1）
     低いほうを採って 3＝high ／ 2＝mid ／ 1＝low。壁に届かない区分は null。
   ★境目（4人→5人・9人→10人）を、人を1人ずつ足して両側から踏む。
   ★この時点で正式公開フラグが立っているので、鍵が在って答えきっていれば開く。
     この節は呼び手が何度も入れ替わる（me・c2〜c5）。**呼ぶ人ごとに ready() が要る** ──
     足しているのは幅の下の1行なので、区分の人数（＝段）は1人ぶんも動かない。 */
{
  const [TR, TR2] = EX3;
  const sel3 = { airline: TR, position: 'cap', fleet: 'b777' };   // 軸3つ
  const sel2 = { airline: TR, position: 'cap' };                  // 軸2つ
  const sel1 = { airline: TR };                                   // 軸1つ
  const me = await person(TR, 'cap', 'b777', [{ month: 6 }]);     // 呼び手（この区分の1人目）
  await ready(me);
  let have = 1;
  const grow = async (to) => {
    for (; have < to; have++) await person(TR, 'cap', 'b777', [{ month: 6 }]);
    await asUser(me);
  };
  const tr = async (sel) => (await deep(sel)).cohort.trust;

  await asUser(me);
  ok(await tr(sel3) === null && hidden(await deep(sel3)),
     '★1人（壁の下）… 段は付かない（null）');

  await grow(2);
  {
    const d = await deep();
    ok(d.cohort.level === 'airline_pos_fleet' && d.cohort.trust === 'low',
       '★2人 … 段1でも low（人数の段が1）', JSON.stringify(d.cohort));
    ok(await tr(sel3) === 'low', '　手で3つ選んでも low');
  }
  await grow(4);
  ok(await tr() === 'low' && await tr(sel3) === 'low' && await tr(sel2) === 'low',
     '★4人 … まだ low（境目の手前）');
  await grow(5);
  ok(await tr() === 'mid' && await tr(sel3) === 'mid',
     '★5人 … mid に上がる（境目）', `${await tr()} / ${await tr(sel3)}`);
  ok(await tr(sel2) === 'mid', '　軸2つ（会社×役職）でも 5人なら mid', String(await tr(sel2)));
  ok(await tr(sel1) === 'low',
     '★軸1つ（会社だけ）は、人数がそろっても low（区分が広い）', String(await tr(sel1)));
  await grow(9);
  ok(await tr() === 'mid' && await tr(sel3) === 'mid',
     '★9人 … まだ mid（境目の手前）', `${await tr()} / ${await tr(sel3)}`);
  await grow(10);
  ok(await tr() === 'high' && await tr(sel3) === 'high',
     '★10人 … high に上がる（境目。区分は会社×役職×機材まで絞れている）',
     `${await tr()} / ${await tr(sel3)}`);
  ok(await tr(sel2) === 'mid',
     '★軸2つは 10人いても mid 止まり（上限が人数に勝つ）', String(await tr(sel2)));
  ok(await tr(sel1) === 'low' && await tr({ fleet: 'b777' }) === 'low'
     && await tr({ position: 'cap' }) === 'low',
     '★軸1つは 10人いても low 止まり（「役職だけ・全社」に 高 と出さない）');
  ok(await tr({ position: 'cap', fleet: 'b777' }) === 'mid',
     '　会社を選ばない軸2つ（役職×機材）も mid 止まり');
  ok(countKeys(await deep()).length === 0 && countKeys(await deep(sel3)).length === 0,
     '★段が high でも、人数そのものは返り値のどこにも無い');

  // ── はしごが落ちた段ごとの上限（呼び手の区分から自動で落ちるとき）──
  // 段2：同じ会社・役職・機材区分（B787 も広胴）に落ちる → 上限3 ＝ high
  const c2 = await person(TR, 'cap', 'b787', [{ month: 6 }]);
  await ready(c2);
  {
    const d = await deep();
    ok(d.cohort.level === 'airline_pos_cat' && d.cohort.trust === 'high',
       '★段2（会社×役職×機材区分）に落ちても、10人以上なら high', JSON.stringify(d.cohort));
  }
  // 段3：機材区分も合わない（A320 は狭胴）→ 会社×役職 → 上限2 ＝ mid
  const c3 = await person(TR, 'cap', 'a320', [{ month: 6 }]);
  await ready(c3);
  {
    const d = await deep();
    ok(d.cohort.level === 'airline_pos' && d.cohort.trust === 'mid',
       '★段3（会社×役職）は 10人以上でも mid 止まり', JSON.stringify(d.cohort));
  }
  // 段4：会社に自分しか居ない → 役職のみ（全社の機長）→ 上限1 ＝ low
  const c4 = await person(TR2, 'cap', 'a320', [{ month: 6 }]);
  await ready(c4);
  {
    const d = await deep();
    ok(d.cohort.level === 'pos' && d.cohort.trust === 'low',
       '★段4（役職のみ・全社）は何人いても low', JSON.stringify(d.cohort));
  }
  /* 段5：役職にも自分しか居ない → 全体 → 上限1 ＝ low。
     選択肢から外した職位（訓練生）の行は本番に実在する（過去の投稿は残してある）。
     フォームからはもう出せないので、ここでは保存済みの行の職位を直に書き換えて作る。 */
  const c5 = await person(TR2, 'cap', 'b737', [{ month: 6 }]);
  // ★見る資格の1行は、職位を書き換える**前**に出す（訓練生はもうフォームから出せない）。
  //   下の update はこの人の行ぜんぶ（2行とも）を訓練生にする。
  await ready(c5);
  await db.query(`update pay_reports set "position" = 'cadet'
                   where proof_hash in (select pv_my_keys())`);
  {
    const d = await deep();
    ok(d.cohort.level === 'all' && d.cohort.trust === 'low',
       '★段5（全体）は何人いても low', JSON.stringify(d.cohort));
  }
  await asUser(V);
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 23. 見る線と数える線は別（内訳だけの人は、数えられるが、自分では見られない）');
// ════════════════════════════════════════════════════════════
/* 2026-10-11（オーナー判断）で上がったのは**見る**側だけ。**数えられる**側（区分の頭数）は
   別の線 ── 2026-10-12 からは「有効な年収を出した人ぜんぶ」（db/deep-pay.sql の pop。
   その前は「内訳を書いた月を持つ人」）。この節の2人は内訳つきなので、どちらの線でも数えられる。
   ★見る線を数える側へ持ち込むと、答えきっていない人が頭数から消え、区分がいっせいに壁を割る
     （画面は「まだ出せません」と出るだけ）。逆に、見る側を内訳だけに戻すと、線を上げた
     意味が無くなる。**両側を同じ2人で見る。**
   ★この節は区分に入る行（常識の幅の中）を足すので、最後に置く。
     入口の状態は「正式公開フラグが立っている・抜け道は外れている」。 */
const EX4 = (await rows(
  `select code from pv_airlines
    where code <> 'other' and active
      and code <> all(string_to_array($1, ','))
    order by code limit 7`, [AIR.concat(EX, EX2).join(',')])).map(r => r.code).slice(6);
ok(EX4.length >= 1, '▼23 用の会社が足りている', String(EX4.length));
{
  const G = EX4[0];
  const sel = { airline: G, position: 'cap', fleet: 'b777' };
  /* DET ＝ 内訳だけ（基本給・職位手当・パーディアム・住宅手当）。残りはこの9つ。 */
  const LEFT = ['guarantee', 'variable', 'bonus', 'profit',
                'block', 'duty_h', 'duty_days', 'stay', 'roles'];
  const g1 = await person(G, 'cap', 'b777', [{ month: 6 }]);
  {
    const d = await deep();
    ok(d.state === 'locked' && d.gate.key === true && d.gate.ready === false
       && d.give.detailed === true && todoIs(d.gate.todo, YEAR, 6, LEFT),
       '★内訳を書いただけの人は locked（鍵は在る・内訳も在る）。残りは9項目で、どの月の行かも返る',
       `${d.state} / ${JSON.stringify(d.gate)}`);
    ok(d.cohort === null && d.head === null && d.picks === null,
       '　中身は1つも渡していない');
  }
  await asUser(V);
  ok(hidden(await deep(sel)), '（前提）その会社・役職・機材に居るのは、まだ1人（壁の下）');

  const g2 = await person(G, 'cap', 'b777', [{ month: 6 }], DET2);   // 見本の倍額・同じく内訳だけ
  ok((await deep()).state === 'locked', '　2人目も内訳だけなので、自分では見られない');
  await asUser(V);
  {
    const d = await deep(sel);
    ok(shown(d) && Number(d.head.annual_usd) === 306000,
       '★★自分では見られない2人が、区分の頭数には入っている（2人そろって出る・中央値は2人の 306,000）',
       JSON.stringify({ cohort: d.cohort, head: d.head }));
    ok(d.picks.air.includes(G), '　選べる会社の一覧にも出ている（選べる ＝ 数字が返る、のまま）');
  }
  await asUser(g1);
  ok((await deep()).state === 'locked',
     '★区分に数えられていても、本人の門は閉じたまま（数えられること ≠ 見られること）');

  // 答えきった1行を足す → 開く。足したのは幅の下の行なので、区分の数字は動かない
  await ready(g1);
  {
    const d = await deep();
    ok(d.state === 'open' && d.gate.ready === true && d.gate.todo === null
       && d.cohort.level === 'airline_pos_fleet' && Number(d.head.annual_usd) === 306000,
       '★答えきれば開き、見えるのは同じ2人の数字（見る資格の1行は区分に入っていない）',
       JSON.stringify({ gate: d.gate, cohort: d.cohort, head: d.head }));
  }
  await asUser(V);
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 24. 公開より前から居た人 ── 変わるのは本人が見られるかだけ（区分の数字は1つも動かない）');
// ════════════════════════════════════════════════════════════
/* db/deep-pay.sql の v_old（オーナー判断 2026-10-11「3つとも答えている人はそのまま開く」）。
   門の側は ▼2-d。ここは**数えられる側に触れていないこと**を見る ──
   この決まりが広げるのは「見る」だけで、区分の頭数（年収の母集団）には触れていない。
   ★同じ1行の出した時刻だけを、公開の境目の前と後ろへ置き直して、**同じ問い合わせ**
     （別の人が、その会社・役職・機材を手で選ぶ）の答えを比べる。区分・見出し・給与構成・
     働き方・変動給・選べる組み合わせが1文字も違わないこと。変わるのは本人の門だけ。
     ⚠️ stats は比べない（サイト全体の「この30日の件数」は、出した時刻で数えている）。
   ★▼23 と同じく、区分に入る行（常識の幅の中）を足すので最後に置く。
     入口の状態は「正式公開フラグが立っている・抜け道は外れている」。 */
const EX5 = (await rows(
  `select code from pv_airlines
    where code <> 'other' and active
      and code <> all(string_to_array($1, ','))
    order by code limit 8`, [AIR.concat(EX, EX2).join(',')])).map(r => r.code).slice(7);
ok(EX5.length >= 1, '▼24 用の会社が足りている', String(EX5.length));
{
  const H = EX5[0];
  const sel = { airline: H, position: 'cap', fleet: 'b777' };
  /* 公開より前から居た人の役。見本（DET）に、保証手当（0 ＝ 無い）と内訳の行を足した形
     （変動給の行＝金額と連動先。other_allowance 4,400 ＝ 変動給 4,000 ＋ その他 400 の
     ままなので、年収は見本と同じ 204,000 ＝ 区分に入る）。3つに答えてあり、残りはこの7つ。 */
  const OLD = { ...DET, guarantee_pay: 0,
                pay_items: { v: 2, fixed_none: false, guarantee_none: false, variable_none: false,
                             variable: [{ amount: 4000, label: 'Flight Pay', basis: 'block' }],
                             other: [{ amount: 400, label: 'Misc' }] } };
  const LEFT = ['bonus', 'profit', 'block', 'duty_h', 'duty_days', 'stay', 'roles'];
  const pic = (d) => JSON.stringify({ cohort: d.cohort, head: d.head, comp: d.comp,
                                      work: d.work, var: d.var, picks: d.picks });

  const h1 = ++seat; await asUser(h1);
  const id1 = (await submit({ ...BASE, ...sel, period_year: YEAR, period_month: 6, ...OLD })).r.id;
  await person(H, 'cap', 'b777', [{ month: 6 }], DET2);     // 2人目（見本の倍額・内訳だけ）

  // 公開から先に出した行のとき
  await asUser(h1);
  {
    const d = await deep();
    ok(d.state === 'locked' && d.gate.ready === false && todoIs(d.gate.todo, YEAR, 6, LEFT),
       '（出発点）3つに答えた行でも、公開から先に出していれば本人は locked（残りは7つ）',
       `${d.state} / ${JSON.stringify(d.gate)}`);
  }
  await asUser(V);
  const after = await deep(sel);
  ok(shown(after) && Number(after.head.annual_usd) === 306000 && after.comp !== null,
     '（前提）その2人の区分は出ている（中央値は2人の 306,000）── 本人が見られなくても数えられている',
     JSON.stringify({ cohort: after.cohort, head: after.head }));

  // 同じ行を、公開より前に出していたことにする
  await stamp(id1, '-1 day');
  await asUser(h1);
  let mine;
  {
    mine = await deep();
    ok(mine.state === 'open' && mine.gate.ready === true && mine.gate.todo === null,
       '★★同じ行を公開より前に出していれば、本人は open ── 残りが7つ在っても何も頼まない（todo は null）',
       `${mine.state} / ${JSON.stringify(mine.gate)}`);
  }
  await asUser(V);
  const before = await deep(sel);
  ok(pic(before) === pic(after),
     '★★区分の数字は1文字も動かない（区分・見出し・給与構成・働き方・変動給・選べる組み合わせ）',
     `前 ${pic(before).slice(0, 200)} / 後 ${pic(after).slice(0, 200)}`);
  ok(mine.cohort.level === 'airline_pos_fleet'
     && JSON.stringify(mine.head) === JSON.stringify(before.head)
     && JSON.stringify(mine.comp) === JSON.stringify(before.comp)
     && JSON.stringify(mine.work) === JSON.stringify(before.work)
     && JSON.stringify(mine.var)  === JSON.stringify(before.var),
     '★本人に見えるのも同じ2人の数字（この道で通った人だけの別の集計は無い）',
     JSON.stringify({ cohort: mine.cohort, head: mine.head }));

  // 境目の上へ戻す → 本人だけが閉じ、区分はそのまま
  await stamp(id1, '0');
  await asUser(h1);
  await lacks('★境目ちょうどへ戻すと、本人はまた locked', LEFT);
  await asUser(V);
  ok(pic(await deep(sel)) === pic(after), '★そのあいだも区分の数字は同じ');
}

/* ════════════════════════════════════════════════════════════
   ここから下（▼25〜▼29）は 2026-10-12 に足した。誰を数えるか・賞与・給与構成の平均・
   変動給の中身・口コミ由来。どれも区分に入る行を足すので、いちばん最後に置く。
   入口の状態は「正式公開フラグが立っている・抜け道は外れている」。画面を見る役は V
   （鍵が在って答えきっている）。V は A_HOME の副操縦士で、下の会社には1行も持たない
   ＝ どの区分も**手で選んで**見る。
   ★見本は**手で計算できる額**だけで組む。期待値は式ごとコメントに書いてある。
   ★人数は返ってこないので、「誰が入ったか」は中央値で見る（額をわざと変えてある）。 */
const EX6 = (await rows(
  `select code from pv_airlines
    where code <> 'other' and active
      and code <> all(string_to_array($1, ','))
    order by code limit 48`, [AIR.concat(EX, EX2).join(',')])).map(r => r.code).slice(8);
ok(EX6.length >= 38, '▼25〜▼29 用の会社が足りている', String(EX6.length));
let ex6 = 0;
const fresh = () => {
  const c = EX6[ex6++];
  if (!c) throw new Error('▼25〜▼29 用の会社を使い切った（EX6 の limit を増やす）');
  return c;
};
/* 1行出す。cols に書いた欄だけが入る（既定は何も足さない ＝ 総支給だけの行も作れる）。
   u を省くと新しい人。返すのは { u, id }。 */
const put = async (u, air, pos, fleet, month, cols) => {
  const who = u || ++seat;
  await asUser(who);
  const r = await submit({ ...BASE, airline: air, position: pos, fleet,
                           period_year: YEAR, period_month: month, ...cols });
  return { u: who, id: r.r.id };
};
// $50 刻み・$0.5 刻み（SQL の pv_deep_step と同じ丸め。期待値を手で作るため）
const step50  = (v) => Math.round(v / 50) * 50;
const stepHalf = (v) => Math.round(v * 2) / 2;
const median = (a) => {
  const s = a.slice().sort((x, y) => x - y), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const seg = (d, k) => ((d.comp && d.comp.segs) || []).find((s) => s.k === k);
const vk  = (d, k) => (d.var || []).find((s) => s.k === k);
// 保存してある行ぜんぶの指紋（呼ぶ前と後で1バイトも違わないことを見る）
const fingerprint = async () => (await one(
  `select md5(coalesce((select string_agg(t::text, '|' order by t.id) from pay_reports t), ''))
       || md5(coalesce((select string_agg(t::text, '|' order by t.id) from reviews_v2 t), ''))
       || md5(coalesce((select string_agg(t::text, '|' order by t.review_id) from pv_review_person t), ''))
       || md5(coalesce((select string_agg(t::text, '|' order by t.id) from profiles t), '')) f`)).f;
const FP0 = await fingerprint();

// ════════════════════════════════════════════════════════════
console.log('\n▼ 25. 誰を数えるか ── 有効な年収を出した人ぜんぶ（内訳を書いたかは見ない）');
// ════════════════════════════════════════════════════════════
/* オーナーの言葉「これってみんなの年収入ってるの？」。前は内訳を書いた人だけが区分に入り、
   総支給だけを出した人は、選べる組み合わせにも・人数の壁にも・年収の中央値にも居なかった。
   同じ会社・機長・B777 に1人ずつ足しながら、年収の側と給与構成の側を別々に見る。 */
{
  const A = fresh();
  const sel = { airline: A, position: 'cap', fleet: 'b777' };
  // ① 総支給だけの2人（乗務時間は書いている）
  await put(0, A, 'cap', 'b777', 2, { gross_monthly: 10000, block_hours: 80 });   // 年 120,000
  await put(0, A, 'cap', 'b777', 2, { gross_monthly: 14000, block_hours: 70 });   // 年 168,000
  await asUser(V);
  {
    const d = await deep(sel);
    ok(shown(d) && d.cohort.trust === 'low',
       '★★総支給だけの2人で区分が出る（前は「内訳を書いた人が居ない」で出なかった）',
       JSON.stringify(d.cohort));
    ok(Number(d.head.annual_usd) === 144000,
       '★年収は2人の中央値 (120,000 ＋ 168,000) ÷ 2 ＝ 144,000', String(d.head.annual_usd));
    // 時間あたり：120,000 ÷ 12 ÷ 80 ＝ 125.00 ／ 168,000 ÷ 12 ÷ 70 ＝ 200.00 → 中央値 162.5
    ok(Number(d.head.per_block_usd) === 162.5 && Number(d.work.block_h) === 75,
       '★書いてある所（乗務時間・Pay / Block Hour）は、内訳が無くても出る（162.5・75時間）',
       JSON.stringify({ head: d.head, work: d.work }));
    ok(Number(d.head.month_usd) === 12000,
       '★月換算も出る（10,000 と 14,000 の中央値 12,000）', String(d.head.month_usd));
    ok(d.comp === null && d.var === null && d.head.fixed_pct === null,
       '★★給与構成・変動給の中身・固定・保証給比率は null（内訳を書いた人が居ない。0 で埋めない）',
       JSON.stringify({ comp: d.comp, var: d.var, fixed: d.head.fixed_pct }));
    ok(d.head.bonus_est === false && d.head.bonus_gap === true,
       '　2人とも年間賞与を答えていない ＝ 平均の印は立たず、賞与が無い人の印が立つ',
       JSON.stringify(d.head));
    const pk = d.picks;
    ok(pk.air.includes(A) && (pk.pos[A] || []).includes('cap')
       && (pk.flt[A + '|cap'] || []).includes('b777'),
       '★★選べる組み合わせにも出る（会社・職位・機材。選べる ＝ 年収が返る）',
       JSON.stringify({ pos: pk.pos[A], flt: pk.flt[A + '|cap'] }));
    ok(countKeys(d).length === 0, '　人数のキーは今も1つも無い', countKeys(d).join(' '));
  }
  // ② 内訳を書いた人が1人だけ加わる（総支給 11,000・基本給 6,600）
  await put(0, A, 'cap', 'b777', 2, { gross_monthly: 11000, base_pay: 6600 });    // 年 132,000
  await asUser(V);
  {
    const d = await deep(sel);
    ok(Number(d.head.annual_usd) === 132000,
       '★3人の年収の中央値 132,000（内訳を書いた人も、書いていない人も同じ1票）',
       String(d.head.annual_usd));
    ok(d.comp === null && d.var === null && d.head.fixed_pct === null,
       '★★内訳を書いたのが1人（壁の下）では、給与構成はまだ null（その1人の内訳を平均と名乗らない）',
       JSON.stringify({ comp: d.comp, fixed: d.head.fixed_pct }));
  }
  // ③ 内訳を書いた人が2人になる（総支給 12,000・基本給 9,600）
  await put(0, A, 'cap', 'b777', 2, { gross_monthly: 12000, base_pay: 9600 });    // 年 144,000
  await asUser(V);
  let compAt4;
  {
    const d = await deep(sel);
    // 120,000・132,000・144,000・168,000 → 中央値 138,000
    ok(Number(d.head.annual_usd) === 138000,
       '★4人の年収の中央値 138,000', String(d.head.annual_usd));
    /* 給与構成は内訳を書いた2人だけ。基本給の平均 (6,600 ＋ 9,600) ÷ 2 ＝ 8,100、
       未分類の平均 (4,400 ＋ 2,400) ÷ 2 ＝ 3,400。合計 11,500 → 70.4% / 29.6%。 */
    ok(d.comp !== null && seg(d, 'base') && seg(d, 'base').pct === 70
       && seg(d, 'rest') && seg(d, 'rest').pct === 30,
       '★★内訳を書いた人が2人になった瞬間に給与構成が出る（基本給 70%・未分類 30%）',
       JSON.stringify(d.comp));
    ok(Number(seg(d, 'base').avg_usd) === 8100 && Number(seg(d, 'rest').avg_usd) === 3400,
       '★月額は内訳を書いた2人の平均（基本給 8,100・未分類 3,400）。総支給だけの2人は入っていない',
       JSON.stringify(d.comp.segs));
    ok(d.head.fixed_pct === 70, '　固定・保証給比率も出る（70）', String(d.head.fixed_pct));
    ok(Array.isArray(d.var) && d.var.length === 0,
       '　変動給の中身は空の配列（変動給の行を書いた人が居ない。null は給与構成が無いとき）',
       JSON.stringify(d.var));
    compAt4 = JSON.stringify(d.comp);
  }
  /* ④ 総支給は有効だが、内訳がそれをはみ出している人（総支給 30,000・基本給 40,000）。
       前は**行ごと落ちて**年収からも消えていた。いまは年収には入り、給与構成には入らない。 */
  await put(0, A, 'cap', 'b777', 2, { gross_monthly: 30000, base_pay: 40000 });   // 年 360,000
  await asUser(V);
  {
    const d = await deep(sel);
    // 120,000・132,000・144,000・168,000・360,000 → 中央値 144,000
    ok(Number(d.head.annual_usd) === 144000,
       '★★内訳が総支給をはみ出した人も、年収には数える（中央値が 138,000 → 144,000 に動く）',
       String(d.head.annual_usd));
    ok(JSON.stringify(d.comp) === compAt4,
       '★★その人は給与構成には入らない（1文字も動かない。入れば基本給が 133% の人が混ざる）',
       JSON.stringify(d.comp));
  }
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 26. 賞与 ── 会社×職位で申告した人の平均を、全員の年収と Pay / Block Hour に割り振る');
// ════════════════════════════════════════════════════════════
/* オーナーの言葉「基本的に同じ役職の人は賞与同じだから。賞与出してる人の平均をみんなに
   割り振って年収だして」。決まりは db/deep-pay.sql 3章「賞与の決まり」。
     1行ごと、区分（会社×職位）に平均 M が在るとき：
       年収 ＝ 保存してある年収 − その行が申告した賞与（空なら 0）＋ M
       Pay / Block Hour ＝ 保存してある値 ＋（M − その行が申告した賞与）÷ 12 ÷ Block Hours
   ★関数は1人ぶんの額を返さない。だから**2人ずつの区分を3つ**作って（機材を1人2つずつ）、
     3つの中央値（＝2人の平均）から3人の額を解く：
       x ＝ A ＋ B − C ／ y ＝ A ＋ C − B ／ z ＝ B ＋ C − A */
// ── (a) 申告した人がちょうど壁（2人）── 全員が「賞与ぬきの額 ＋ 平均」に乗る ──
{
  const A = fresh();
  const sA = { airline: A, position: 'cap', fleet: 'b777' };   // 高い人 ＋ 0 の人
  const sB = { airline: A, position: 'cap', fleet: 'b787' };   // 高い人 ＋ 答えていない人
  const sC = { airline: A, position: 'cap', fleet: 'a350' };   // 0 の人 ＋ 答えていない人
  // 高い賞与を申告した人：総支給 10,000・賞与 40,000 → 年 160,000（賞与ぬき 120,000）
  const hi = await put(0, A, 'cap', 'b777', 2,
    { gross_monthly: 10000, bonus_annual: 40000, block_hours: 80 });
  await put(hi.u, A, 'cap', 'b787', 3,
    { gross_monthly: 10000, bonus_annual: 40000, block_hours: 80 });
  // 0 と申告した人：総支給 12,000・賞与 0 → 年 144,000
  const zero = await put(0, A, 'cap', 'b777', 2,
    { gross_monthly: 12000, bonus_annual: 0, block_hours: 60 });
  await put(zero.u, A, 'cap', 'a350', 3,
    { gross_monthly: 12000, bonus_annual: 0, block_hours: 60 });
  // 答えていない人：総支給 15,000 → 年 180,000
  const non = await put(0, A, 'cap', 'b787', 2, { gross_monthly: 15000, block_hours: 75 });
  await put(non.u, A, 'cap', 'a350', 3, { gross_monthly: 15000, block_hours: 75 });

  const st = async (id) => await one(
    `select annual_total_usd a, usd_per_block_hour p, bonus_annual b from pay_reports where id = $1`, [id]);
  const sHi = await st(hi.id), sZero = await st(zero.id), sNon = await st(non.id);
  ok(Number(sHi.a) === 160000 && Number(sZero.a) === 144000 && Number(sNon.a) === 180000
     && Number(sZero.b) === 0 && sNon.b === null,
     '（前提）保存してある年収は 160,000・144,000・180,000。0 は 0 のまま・空欄は null のまま',
     JSON.stringify([sHi, sZero, sNon]));
  ok(Number(sHi.p) === 166.67 && Number(sZero.p) === 200 && Number(sNon.p) === 200,
     '（前提）保存してある Pay / Block Hour は 166.67・200.00・200.00',
     JSON.stringify([sHi.p, sZero.p, sNon.p]));

  await asUser(V);
  const before = await fingerprint();
  const dA = await deep(sA), dB = await deep(sB), dC = await deep(sC);
  const dAll = await deep({ airline: A, position: 'cap' });
  /* 平均 M ＝ (40,000 ＋ 0) ÷ 2 ＝ 20,000。
       高い人 120,000 ＋ 20,000 ＝ 140,000 ／ 0 の人 144,000 ＋ 20,000 ＝ 164,000 ／
       答えていない人 180,000 ＋ 20,000 ＝ 200,000 */
  const a = Number(dA.head.annual_usd), b = Number(dB.head.annual_usd), c = Number(dC.head.annual_usd);
  ok(a === 152000 && b === 170000 && c === 182000,
     '★2人ずつの区分の年収：152,000・170,000・182,000', `${a} / ${b} / ${c}`);
  ok(a + b - c === 140000,
     '★★高い賞与を申告した人 ＝ 160,000 − 40,000 ＋ 20,000 ＝ 140,000（自分の賞与を引いてから平均）',
     String(a + b - c));
  ok(a + c - b === 164000,
     '★★0 と申告した人 ＝ 144,000 − 0 ＋ 20,000 ＝ 164,000（0 は1票。その人にも平均が乗る）',
     String(a + c - b));
  ok(b + c - a === 200000,
     '★★答えていない人 ＝ 180,000 ＋ 20,000 ＝ 200,000', String(b + c - a));
  ok(Number(dAll.head.annual_usd) === 164000,
     '★会社×機長の3人の中央値は 164,000（保存してあるままなら 160,000）',
     String(dAll.head.annual_usd));
  ok([dA, dB, dC, dAll].every((d) => d.head.bonus_est === true && d.head.bonus_gap === false),
     '★どの区分も：平均で作った印（bonus_est）が立ち、賞与が無い人の印（bonus_gap）は立たない',
     JSON.stringify([dA.head, dB.head, dC.head]));

  /* Pay / Block Hour ── 保存してある値に、同じ差し替えを差として足す。
       高い人     166.67 ＋ (20,000 − 40,000) ÷ 12 ÷ 80 ＝ 166.67 − 20.83 ＝ 145.84（下がる）
       0 の人     200.00 ＋ 20,000 ÷ 12 ÷ 60 ＝ 227.78（上がる）
       答えてない 200.00 ＋ 20,000 ÷ 12 ÷ 75 ＝ 222.22（上がる）
     2人ずつの中央値：(145.84 ＋ 227.78) ÷ 2 ＝ 186.81 → 187.0 ／ (145.84 ＋ 222.22) ÷ 2 ＝ 184.03 → 184.0 ／
                      (227.78 ＋ 222.22) ÷ 2 ＝ 225.0
     保存してあるままなら 183.5・183.5・200.0。 */
  const pa = Number(dA.head.per_block_usd), pb = Number(dB.head.per_block_usd),
        pc = Number(dC.head.per_block_usd);
  ok(pa === 187 && pb === 184 && pc === 225,
     '★★Pay / Block Hour も同じ差し替えを受ける（187.0・184.0・225.0。保存してあるままなら 183.5・183.5・200.0）',
     `${pa} / ${pb} / ${pc}`);
  ok(pa + pb - pc === 146 && pa + pc - pb === 228 && pb + pc - pa === 222,
     '★3人ぶんに解くと 146・228・222（＝ 145.84 下がる・227.78 上がる・222.22 上がる。刻みのぶんだけ丸い）',
     `${pa + pb - pc} / ${pa + pc - pb} / ${pb + pc - pa}`);
  ok(Number(dA.work.block_h) === 70 && Number(dB.work.block_h) === 77.5,
     '★働き方（Block Hours）は保存してあるまま（70・77.5）',
     `${dA.work.block_h} / ${dB.work.block_h}`);

  /* 月換算（賞与ぬき）── 保存してある・申告された値だけ。平均は入らない。
       高い人 (160,000 − 40,000) ÷ 12 ＝ 10,000 ／ 0 の人 12,000 ／ 答えていない人 15,000
       A (10,000 ＋ 12,000) ÷ 2 ＝ 11,000 ／ B 12,500 → 13,000 ／ C 13,500 → 14,000 */
  ok(Number(dA.head.month_usd) === 11000 && Number(dB.head.month_usd) === 13000
     && Number(dC.head.month_usd) === 14000,
     '★月換算は申告した人と答えていない人を同じ区分で扱える（11,000・13,000・14,000。平均は入らない）',
     `${dA.head.month_usd} / ${dB.head.month_usd} / ${dC.head.month_usd}`);
  ok(dA.comp === null && dA.head.fixed_pct === null,
     '　総支給だけの人たちなので給与構成は無い（見積もりは給与構成に触れない）');
  ok((await fingerprint()) === before,
     '★★呼ぶ前と後で、保存してある行は1バイトも違わない（給与・口コミ・対応表・名簿）');
  ok(before !== FP0, '（検査の道具）指紋は、行を足せば変わる');
}

// ── (b) 何か月も出した人も1票（その人が申告した行の平均）──────────────
{
  const A = fresh();
  // 3か月ぶん申告した人：賞与 20,000・40,000・30,000 → その人の1票は平均の 30,000
  const p1 = await put(0, A, 'fo', 'a320', 2, { gross_monthly: 10000, bonus_annual: 20000 });
  await put(p1.u, A, 'fo', 'a320', 3, { gross_monthly: 10000, bonus_annual: 40000 });
  await put(p1.u, A, 'fo', 'a320', 4, { gross_monthly: 10000, bonus_annual: 30000 });
  await put(0, A, 'fo', 'a320', 2, { gross_monthly: 10000, bonus_annual: 0 });   // 0 と申告
  await put(0, A, 'fo', 'a320', 2, { gross_monthly: 10000 });                    // 答えていない
  await asUser(V);
  const d = await deep({ airline: A, position: 'fo', fleet: 'a320' });
  /* 1人1票：M ＝ (30,000 ＋ 0) ÷ 2 ＝ 15,000。どの行も 120,000 ＋ 15,000 ＝ 135,000。
     行で数えると M ＝ (20,000 ＋ 40,000 ＋ 30,000 ＋ 0) ÷ 4 ＝ 22,500 → 142,500 になる。 */
  ok(Number(d.head.annual_usd) === 135000,
     '★★3か月ぶん申告した人も1票（年収 135,000。行で数えれば 142,500）',
     String(d.head.annual_usd));
  ok(d.head.bonus_est === true && d.head.bonus_gap === false, '　目印は est だけ',
     JSON.stringify(d.head));
}

// ── (c) 通貨が違う申告は、その行が自分で持っている比で USD に直す ─────────
{
  const A = fresh();
  await put(0, A, 'fo', 'a320', 2, { gross_monthly: 10000, bonus_annual: 20000 });   // 年 140,000
  const jp = await put(0, A, 'fo', 'a320', 2,
    { currency: 'JPY', gross_monthly: 2000000, bonus_annual: 3000000 });
  await put(0, A, 'fo', 'a320', 2, { gross_monthly: 10000 });                        // 年 120,000
  const j = await one(
    `select annual_total_usd u, annual_total_orig o, currency c from pay_reports where id = $1`, [jp.id]);
  const k = Number(j.u) / Number(j.o);            // その行が投稿の瞬間に確定した比
  ok(j.c === 'JPY' && Number(j.o) === 27000000 && k > 0 && k < 0.5,
     '（前提）円の行：原通貨の年収は 27,000,000・USD への比は 1 ではない', JSON.stringify(j));
  const bJ = 3000000 * k;                          // 円の賞与を USD に
  const M = (20000 + bJ) / 2;
  const want = step50(median([120000 + M, Number(j.u) - bJ + M, 120000 + M]));
  await asUser(V);
  const sel = { airline: A, position: 'fo', fleet: 'a320' };
  const d = await deep(sel);
  ok(Number(d.head.annual_usd) === want,
     '★★円で申告した賞与は、その行の比で USD に直してから平均に入る',
     `${d.head.annual_usd} vs ${want}`);
  ok(Number(d.head.annual_usd) !== step50(120000 + (20000 + 3000000) / 2),
     '　直さずに足していない（3,000,000 をそのまま USD と読めば、桁が違う額になる）');
  /* ★いまの為替表は引かない。表の円のレートを2倍にしても、数字は1つも動かない
       （動くなら、為替表を貼り直すたびに過去の賞与の額が変わる）。 */
  const rate = (await one(`select to_usd from fx_rates where code = 'JPY'`)).to_usd;
  await db.query(`update fx_rates set to_usd = to_usd * 2 where code = 'JPY'`);
  const d2 = await deep(sel);
  await db.query(`update fx_rates set to_usd = $1 where code = 'JPY'`, [rate]);
  ok(JSON.stringify(d2.head) === JSON.stringify(d.head),
     '★★為替表の円のレートを2倍にしても、見出しは1文字も動かない（投稿の瞬間の比を使っている）',
     JSON.stringify(d2.head));
}

// ── (d) 申告した人が壁の1人手前 ── 何も変わらない ───────────────────
let B4 = null;
{
  const A = B4 = fresh();
  // 申告した人は1人だけ（総支給 10,000・賞与 40,000 → 年 160,000）
  const dec = await put(0, A, 'cap', 'b777', 2, { gross_monthly: 10000, bonus_annual: 40000 });
  await put(dec.u, A, 'cap', 'b787', 3, { gross_monthly: 10000, bonus_annual: 40000 });
  await put(dec.u, A, 'cap', 'bizjet', 4, { gross_monthly: 10000, bonus_annual: 40000 });
  const n1 = await put(0, A, 'cap', 'b777', 2, { gross_monthly: 15000 });            // 年 180,000
  await put(n1.u, A, 'cap', 'b787', 3, { gross_monthly: 15000 });
  await put(0, A, 'cap', 'b777', 2, { gross_monthly: 12000 });                       // 年 144,000
  await asUser(V);
  const d = await deep({ airline: A, position: 'cap', fleet: 'b777' });
  /* 保存してあるまま：160,000・180,000・144,000 の中央値 ＝ 160,000。
     1人の申告を平均と名乗って配ると 160,000・220,000・184,000 → 184,000 になり、
     答えていない人の年収からその1人の賞与（40,000）が割り戻せる。 */
  ok(Number(d.head.annual_usd) === 160000,
     '★★申告した人が1人では平均を作らない（年収は保存してあるまま 160,000）',
     String(d.head.annual_usd));
  ok(d.head.bonus_est === false && d.head.bonus_gap === true,
     '★平均の印は立たず、答えていない人が数えられているので、賞与が無い人の印が立つ',
     JSON.stringify(d.head));
  ok(Number(d.head.month_usd) === 12000,
     '　月換算は 10,000・15,000・12,000 の中央値 12,000', String(d.head.month_usd));
  /* 月換算は平均の有無に左右されない ── (a) の「高い人＋答えていない人」（平均あり）と、
     同じ保存値のこの2人（平均なし）で、同じ 13,000。 */
  const dB = await deep({ airline: A, position: 'cap', fleet: 'b787' });
  ok(Number(dB.head.month_usd) === 13000 && dB.head.bonus_est === false,
     '★月換算は、賞与の平均が在っても無くても同じ（(10,000 ＋ 15,000) ÷ 2 ＝ 12,500 → 13,000）',
     JSON.stringify(dB.head));

  /* 全員が申告していて、どの区分にも平均が無い ── 目印は2つとも立たない。
     別の会社の、申告した人が1人だけの区分と、機材（ビジネスジェット）だけで束ねる。 */
  const B = fresh();
  await put(0, B, 'cap', 'bizjet', 2, { gross_monthly: 10000, bonus_annual: 10000 });  // 年 130,000
  await asUser(V);
  const dx = await deep({ fleet: 'bizjet' });
  ok(shown(dx) && Number(dx.head.annual_usd) === 145000,
     '（前提）機材だけで束ねた2人（2社）の中央値は (160,000 ＋ 130,000) ÷ 2 ＝ 145,000',
     JSON.stringify(dx.head));
  ok(dx.head.bonus_est === false && dx.head.bonus_gap === false,
     '★★2人とも申告していて、平均はどちらの区分にも無い → 目印は2つとも立たない',
     JSON.stringify(dx.head));
}

// ── (e) よその会社・よその職位の申告は、平均に入らない ─────────────────
{
  const A = fresh(), B = fresh();
  // A 社・機長：申告した人は1人だけ
  await put(0, A, 'cap', 'b777', 2, { gross_monthly: 10000, bonus_annual: 40000 });  // 年 160,000
  await put(0, A, 'cap', 'b777', 2, { gross_monthly: 15000 });                       // 年 180,000
  // A 社・副操縦士：申告した人が2人（10,000 と 30,000）＋ 答えていない人
  await put(0, A, 'fo', 'a320', 2, { gross_monthly: 8000, bonus_annual: 10000 });    // 年 106,000
  await put(0, A, 'fo', 'a320', 2, { gross_monthly: 9000, bonus_annual: 30000 });    // 年 138,000
  await put(0, A, 'fo', 'a320', 2, { gross_monthly: 9500 });                         // 年 114,000
  // B 社・機長：申告した人が2人（50,000 ずつ）
  await put(0, B, 'cap', 'b777', 2, { gross_monthly: 10000, bonus_annual: 50000 });
  await put(0, B, 'cap', 'b777', 2, { gross_monthly: 10000, bonus_annual: 50000 });
  await asUser(V);
  const cap = await deep({ airline: A, position: 'cap' });
  /* A 社の機長は申告が1人 ＝ 平均なし。同じ会社の副操縦士（2人）や、よその会社の機長（2人）の
     申告を借りない。借りれば 170,000 ではなくなる（職位を混ぜると 176,650）。 */
  ok(Number(cap.head.annual_usd) === 170000 && cap.head.bonus_est === false
     && cap.head.bonus_gap === true,
     '★★同じ会社の別の職位・別の会社の同じ職位の申告は、平均に入らない（年収 170,000 のまま）',
     JSON.stringify(cap.head));
  const fo = await deep({ airline: A, position: 'fo' });
  /* 副操縦士の平均 ＝ (10,000 ＋ 30,000) ÷ 2 ＝ 20,000。
     96,000 ＋ 20,000 ＝ 116,000 ／ 108,000 ＋ 20,000 ＝ 128,000 ／ 114,000 ＋ 20,000 ＝ 134,000 */
  ok(Number(fo.head.annual_usd) === 128000 && fo.head.bonus_est === true
     && fo.head.bonus_gap === false,
     '★副操縦士は自分たちの平均（20,000）で 128,000（保存してあるままなら 114,000）',
     JSON.stringify(fo.head));
  /* ★会社だけで選んだ区分でも、1人ずつ**自分の会社×職位**の平均を使う。
       機長 160,000・180,000（平均なし）／副操縦士 116,000・128,000・134,000 → 中央値 134,000。
       会社ぜんぶで1つの平均（26,666.67）を作ると 140,650、保存してあるままなら 138,000。 */
  const all = await deep({ airline: A });
  ok(Number(all.head.annual_usd) === 134000,
     '★★会社だけの区分でも、賞与の平均は1人ずつ自分の会社×職位のもの（134,000）',
     String(all.head.annual_usd));
  ok(all.head.bonus_est === true && all.head.bonus_gap === true,
     '　平均で作った人（副操縦士）と、賞与が無いままの人（機長の1人）が両方居る ＝ 目印は2つとも立つ',
     JSON.stringify(all.head));
  const other = await deep({ airline: B, position: 'cap' });
  ok(Number(other.head.annual_usd) === 170000 && other.head.bonus_est === true,
     '　B 社の機長は自分たちの平均（50,000）── 170,000 − 50,000 ＋ 50,000 ＝ 170,000',
     JSON.stringify(other.head));
}

// ── (f) プロフィットシェアは平均に入れない・引かない（保存してあるまま）──────
{
  const A = fresh();
  const sA = { airline: A, position: 'cap', fleet: 'b777' };
  const sB = { airline: A, position: 'cap', fleet: 'b787' };
  const sC = { airline: A, position: 'cap', fleet: 'a350' };
  // 賞与 20,000 ＋ プロフィットシェア 6,000 → 年 146,000
  const d1 = await put(0, A, 'cap', 'b777', 2,
    { gross_monthly: 10000, bonus_annual: 20000, profit_share_annual: 6000 });
  await put(d1.u, A, 'cap', 'b787', 3,
    { gross_monthly: 10000, bonus_annual: 20000, profit_share_annual: 6000 });
  // 賞与 0（プロフィットシェアは空）→ 年 120,000
  const d2 = await put(0, A, 'cap', 'b777', 2, { gross_monthly: 10000, bonus_annual: 0 });
  await put(d2.u, A, 'cap', 'a350', 3, { gross_monthly: 10000, bonus_annual: 0 });
  // 賞与は空・プロフィットシェア 12,000 → 年 132,000
  const n = await put(0, A, 'cap', 'b787', 2, { gross_monthly: 10000, profit_share_annual: 12000 });
  await put(n.u, A, 'cap', 'a350', 3, { gross_monthly: 10000, profit_share_annual: 12000 });
  ok(Number((await one(`select annual_total_usd a from pay_reports where id = $1`, [d1.id])).a) === 146000
     && Number((await one(`select annual_total_usd a from pay_reports where id = $1`, [n.id])).a) === 132000,
     '（前提）保存してある年収は、申告したプロフィットシェア込み（146,000・132,000）');
  await asUser(V);
  const dA = await deep(sA), dB = await deep(sB), dC = await deep(sC);
  /* 平均は**賞与だけ** ＝ (20,000 ＋ 0) ÷ 2 ＝ 10,000（プロフィットシェアを混ぜれば 13,000）。
       1人目 146,000 − 20,000 ＋ 10,000 ＝ 136,000（6,000 は残る）
       2人目 120,000 − 0 ＋ 10,000 ＝ 130,000
       3人目 132,000 ＋ 10,000 ＝ 142,000（自分の 12,000 は残る・二重に足さない） */
  const a = Number(dA.head.annual_usd), b = Number(dB.head.annual_usd), c = Number(dC.head.annual_usd);
  ok(a === 133000 && b === 139000 && c === 136000,
     '★2人ずつの区分の年収：133,000・139,000・136,000', `${a} / ${b} / ${c}`);
  ok(a + b - c === 136000 && a + c - b === 130000 && b + c - a === 142000,
     '★★3人ぶんに解くと 136,000・130,000・142,000 ＝ プロフィットシェアは平均に入らず、引かれもしない',
     `${a + b - c} / ${a + c - b} / ${b + c - a}`);
  /* 月換算は賞与もプロフィットシェアも引く：3人とも (年収 − 申告の年額) ÷ 12 ＝ 10,000。
     プロフィットシェアを引き忘れると 10,500・11,000、2回引くと 9,500・9,000 になる。 */
  ok(Number(dA.head.month_usd) === 10000 && Number(dB.head.month_usd) === 10000
     && Number(dC.head.month_usd) === 10000,
     '★★月換算は、申告したプロフィットシェアをちょうど1回だけ引いている（3区分とも 10,000）',
     `${dA.head.month_usd} / ${dB.head.month_usd} / ${dC.head.month_usd}`);
}

// ── (g) 申告した賞与が年収より大きい行（壊れた行）── 引かない・1票にもしない ──
{
  const A = fresh();
  const sB = { airline: A, position: 'cap', fleet: 'b787' };
  const d1 = await put(0, A, 'cap', 'b777', 2, { gross_monthly: 10000, bonus_annual: 20000 });  // 年 140,000
  await put(d1.u, A, 'cap', 'b787', 3, { gross_monthly: 10000, bonus_annual: 20000 });
  await put(0, A, 'cap', 'b777', 2, { gross_monthly: 10000, bonus_annual: 0 });                // 年 120,000
  const x = await put(0, A, 'cap', 'b787', 2, { gross_monthly: 15000, bonus_annual: 30000 });  // 年 210,000
  await asUser(V);
  {
    /* まだ壊していない：平均 ＝ (20,000 ＋ 0 ＋ 30,000) ÷ 3 ＝ 16,666.67
       B787 の2人 ＝ 136,666.67 と 196,666.67 → 中央値 166,666.67 → 166,650 */
    const d = await deep(sB);
    ok(Number(d.head.annual_usd) === 166650, '（前提）壊す前は3人の平均で 166,650',
       String(d.head.annual_usd));
  }
  /* 保存の道を通った行では起きない（年収は賞与を足して作る）。あとから片方だけ書き換わった
     行を作る ── 賞与の欄だけが年収（210,000）より大きい。 */
  await db.query(`update pay_reports set bonus_annual = 999999 where id = $1`, [x.id]);
  await asUser(V);
  const d = await deep(sB);
  /* 壊れた行は1票にしない ＝ 平均は (20,000 ＋ 0) ÷ 2 ＝ 10,000。
     1人目 140,000 − 20,000 ＋ 10,000 ＝ 130,000。壊れた行は**保存してあるまま** 210,000
     （引くと 210,000 − 999,999 で負になる）。中央値 170,000。 */
  ok(Number(d.head.annual_usd) === 170000,
     '★★賞与が年収より大きい行は、引かずに保存してある年収を使い、平均の1票にもしない（170,000）',
     String(d.head.annual_usd));
  ok(d.head.bonus_est === true && d.head.bonus_gap === false,
     '　目印：もう1人は平均で作った（est）。壊れた行の人は「答えていない」ではない（gap は立たない）',
     JSON.stringify(d.head));
  ok(d.head.month_usd === null,
     '★月換算は、値を持つ人が1人（壊れた行は入れない）＝ 列ごとの壁で null',
     String(d.head.month_usd));
}

// ── (h) 組合が総支給の外で払った分は、Pay / Block Hour の分子から抜いたまま ────
{
  /* 保存してある Pay / Block Hour は、組合が直接払った分を分子から抜いてある（乗務の対価では
     ないため。db/pay-reports.sql の pv_block_hour_usd）。賞与の差し替えは**差として足すだけ**で、
     年収 ÷ 12 ÷ 時間 を作り直さない ── 作り直すと、抜いた分が黙って戻る。 */
  const mk = (extra) => ({ gross_monthly: 10000, base_pay: 6000, union_pay: 9000, block_hours: 80,
                           job_roles: ['line', 'union'],
                           pay_items: { v: 1, union: { days: 10, extra: 'yes',
                                                       source: 'union', amount: 9000 } },
                           ...extra });
  // 平均が無い区分：2人とも賞与を答えていない
  const A = fresh();
  const u1 = await put(0, A, 'fo', 'b737', 2, mk({}));
  await put(0, A, 'fo', 'b737', 2, mk({}));
  const s1 = await one(
    `select annual_total_usd a, usd_per_block_hour p from pay_reports where id = $1`, [u1.id]);
  ok(Number(s1.a) === 228000 && Number(s1.p) === 125,
     '（前提）年収は組合の分込みで 228,000・時間あたりは組合の分を抜いた 125.00（年収 ÷ 12 ÷ 80 ＝ 237.5 ではない）',
     JSON.stringify(s1));
  await asUser(V);
  const dA = await deep({ airline: A, position: 'fo', fleet: 'b737' });
  ok(Number(dA.head.per_block_usd) === 125 && Number(dA.head.annual_usd) === 228000
     && dA.head.bonus_est === false,
     '★★平均が無い区分の Pay / Block Hour は、保存してある値のまま（125.0）',
     JSON.stringify(dA.head));

  // 平均が在る区分：賞与 12,000 と 0 を申告した2人 ＋ 答えていない1人
  const B = fresh();
  const b1 = await put(0, B, 'fo', 'b737', 2, mk({ bonus_annual: 12000 }));
  await put(0, B, 'fo', 'b737', 2, mk({ bonus_annual: 0 }));
  await put(0, B, 'fo', 'b737', 2, mk({}));
  const s2 = await one(
    `select annual_total_usd a, usd_per_block_hour p from pay_reports where id = $1`, [b1.id]);
  ok(Number(s2.a) === 240000 && Number(s2.p) === 137.5,
     '（前提）賞与 12,000 の人：年収 240,000・保存してある時間あたり 137.50', JSON.stringify(s2));
  await asUser(V);
  const dB = await deep({ airline: B, position: 'fo', fleet: 'b737' });
  /* 平均 ＝ (12,000 ＋ 0) ÷ 2 ＝ 6,000。
       137.50 ＋ (6,000 − 12,000) ÷ 960 ＝ 131.25 ／ 125.00 ＋ 6,000 ÷ 960 ＝ 131.25（2人とも）
       3人とも 131.25 → $0.5 刻みで 131.5。
     保存してあるままなら 125.0、年収から作り直すと 234,000 ÷ 960 ＝ 243.75 → 244.0。 */
  ok(Number(dB.head.per_block_usd) === 131.5,
     '★★平均が在る区分：保存してある値に差だけを足す（131.5。作り直せば 244.0・足さなければ 125.0）',
     String(dB.head.per_block_usd));
  ok(Number(dB.head.annual_usd) === 234000 && dB.head.bonus_est === true,
     '　年収は3人とも 228,000 ＋ 6,000 ＝ 234,000', JSON.stringify(dB.head));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 27. 給与構成 ── 内訳を書いた人だけの平均（金額を先に平均し、割合はその平均から）');
// ════════════════════════════════════════════════════════════
/* オーナーの言葉「内訳提出してる人の中で内訳の集計、平均を出せばいいじゃん」。
   ★「割合の平均 × 現金の平均」は、金額の平均ではない。金額を先に平均する。
     使うのは**使える内訳の月**だけ（検品を通り・内訳を書いて・一部未回答でない月）。
     総支給だけの月は、金額にもその分母にも入らない。 */
// ── (a) 内訳の月と、総支給だけの月を持つ人 ──────────────────────────
{
  const A = fresh();
  const sel = { airline: A, position: 'fo', fleet: 'a320' };
  const p = await put(0, A, 'fo', 'a320', 2, { gross_monthly: 1000, base_pay: 1000 });
  await put(0, A, 'fo', 'a320', 2, { gross_monthly: 1000, base_pay: 1000 });
  await asUser(V);
  const d0 = await deep(sel);
  ok(seg(d0, 'base') && seg(d0, 'base').pct === 100 && Number(seg(d0, 'base').avg_usd) === 1000,
     '（出発点）2人とも 現金 1,000・基本給 1,000 → 基本給 100%・月額 1,000',
     JSON.stringify(d0.comp));
  // 1人目に、総支給だけの月（現金 9,000）を足す
  await put(p.u, A, 'fo', 'a320', 3, { gross_monthly: 9000 });
  await asUser(V);
  const d1 = await deep(sel);
  /* 「割合 100% × 現金の平均 5,000」なら、この人の基本給は 5,000 になり、2人の平均は 3,000。
     本当に書いてあるのは 1,000。 */
  ok(Number(seg(d1, 'base').avg_usd) === 1000,
     '★★総支給だけの月は金額の分母に入らない（基本給の月額は 1,000 のまま。割合×現金の平均なら 3,000）',
     JSON.stringify(d1.comp));
  ok(JSON.stringify(d1.comp) === JSON.stringify(d0.comp),
     '★★総支給だけの月を足しても、給与構成は1文字も動かない');
  // 年収の側は動く：その人は 12,000 と 108,000 の中央値 60,000 → 2人の中央値 36,000
  ok(Number(d0.head.annual_usd) === 12000 && Number(d1.head.annual_usd) === 36000,
     '　年収の側は、総支給だけの月も使う（12,000 → 36,000）',
     `${d0.head.annual_usd} → ${d1.head.annual_usd}`);
}
// ── (b) 内訳の月が2つ（現金 1,000・基本給 1,000 ／ 現金 2,000・基本給 0）──────
{
  const A = fresh();
  for (let i = 0; i < 2; i++) {
    const p = await put(0, A, 'fo', 'a320', 2, { gross_monthly: 1000, base_pay: 1000 });
    await put(p.u, A, 'fo', 'a320', 3, { gross_monthly: 2000, base_pay: 0 });
  }
  await asUser(V);
  const d = await deep({ airline: A, position: 'fo', fleet: 'a320' });
  /* 1人ぶん：基本給 (1,000 ＋ 0) ÷ 2 ＝ 500 ／ 未分類 (0 ＋ 2,000) ÷ 2 ＝ 1,000。合計 1,500。
     「割合の平均 50% × 現金の平均 1,500」なら基本給は 750 になる。 */
  ok(Number(seg(d, 'base').avg_usd) === 500 && Number(seg(d, 'rest').avg_usd) === 1000,
     '★★金額を先に平均する（基本給 500・未分類 1,000。割合の平均×現金の平均なら 750）',
     JSON.stringify(d.comp));
  ok(seg(d, 'base').pct === 33 && seg(d, 'rest').pct === 67,
     '★割合はその平均の比（500 : 1,000 ＝ 33% : 67%。割合の平均なら 50% : 50%）',
     JSON.stringify(d.comp));
}
// ── (c) 3人・平均 ≠ 中央値 ── 割合 × 合計 ＝ 金額 ────────────────────
{
  const A = fresh();
  await put(0, A, 'fo', 'a320', 2, { gross_monthly: 10000, base_pay: 6000 });
  await put(0, A, 'fo', 'a320', 2, { gross_monthly: 10000, base_pay: 6000 });
  await put(0, A, 'fo', 'a320', 2, { gross_monthly: 10000, base_pay: 9000 });
  await asUser(V);
  const d = await deep({ airline: A, position: 'fo', fleet: 'a320' });
  // 平均：基本給 (6,000 ＋ 6,000 ＋ 9,000) ÷ 3 ＝ 7,000 ／ 未分類 3,000。中央値なら 6,000 / 4,000
  ok(seg(d, 'base').pct === 70 && seg(d, 'rest').pct === 30,
     '★★3人の平均で 70% / 30%（中央値なら 60% / 40%）', JSON.stringify(d.comp));
  ok(Number(seg(d, 'base').avg_usd) === 7000 && Number(seg(d, 'rest').avg_usd) === 3000,
     '★月額も平均（基本給 7,000・未分類 3,000）', JSON.stringify(d.comp));
  const total = d.comp.segs.reduce((a, s) => a + Number(s.avg_usd || 0), 0);
  ok(total === 10000 && d.comp.segs.every((s) => Number(s.avg_usd) === total * s.pct / 100),
     '★★割合 × 合計 ＝ 金額（画面の割合と金額が食い違わない。合計は現金の平均 10,000）',
     JSON.stringify(d.comp.segs));
  ok(d.head.fixed_pct === 70, '　固定・保証給比率も同じ割合から（70）', String(d.head.fixed_pct));
  ok(d.comp.segs.reduce((a, s) => a + s.pct, 0) === 100, '　割合の合計はちょうど100');
}
// ── (d) 壁に届かない項目は未分類へ畳む ── 合計は変わらない ─────────────
{
  const A = fresh();
  // 住宅手当（現金）を持つのは1人だけ
  await put(0, A, 'fo', 'a320', 2,
    { gross_monthly: 10000, base_pay: 6000, housing_type: 'allowance', housing_amount: 1000 });
  await put(0, A, 'fo', 'a320', 2, { gross_monthly: 10000, base_pay: 6000 });
  await asUser(V);
  const d = await deep({ airline: A, position: 'fo', fleet: 'a320' });
  /* 平均：基本給 6,000 ／ 住宅 (1,000 ＋ 0) ÷ 2 ＝ 500（持つのは1人 → 畳む）／
           未分類 (3,000 ＋ 4,000) ÷ 2 ＝ 3,500。畳んだあとの未分類 ＝ 4,000。合計 10,000。 */
  ok(!seg(d, 'housing'), '★1人しか持たない住宅手当は、単独の区分としては並ばない',
     JSON.stringify(d.comp.segs));
  ok(seg(d, 'base').pct === 60 && seg(d, 'rest').pct === 40,
     '★畳んだぶんは未分類へ（60% / 40%。落とせば 63% / 37% になり、合計の意味が変わる）',
     JSON.stringify(d.comp.segs));
  ok(Number(seg(d, 'base').avg_usd) === 6000 && Number(seg(d, 'rest').avg_usd) === 4000,
     '★★金額も同じ：未分類 3,500 ＋ 畳んだ 500 ＝ 4,000。合計は現金の平均 10,000 のまま',
     JSON.stringify(d.comp.segs));
}
// ── (e) 通貨が違う人の内訳は、その行の比で USD に直してから平均する ─────────
{
  const A = fresh();
  await put(0, A, 'fo', 'a320', 2, { gross_monthly: 10000, base_pay: 6000 });
  const jp = await put(0, A, 'fo', 'a320', 2,
    { currency: 'JPY', gross_monthly: 2000000, base_pay: 1000000 });
  const j = await one(
    `select annual_total_usd u, annual_total_orig o from pay_reports where id = $1`, [jp.id]);
  const k = Number(j.u) / Number(j.o);
  const sig2 = async (v) => Number((await one(`select pv_sig2($1::numeric) v`, [v])).v);
  const mBase = (6000 + 1000000 * k) / 2, mRest = (4000 + 1000000 * k) / 2;
  await asUser(V);
  const sel = { airline: A, position: 'fo', fleet: 'a320' };
  const d = await deep(sel);
  ok(Number(seg(d, 'base').avg_usd) === await sig2(mBase)
     && Number(seg(d, 'rest').avg_usd) === await sig2(mRest),
     '★★円の人の内訳は、その行の比で USD に直してから平均（基本給・未分類とも）',
     `${JSON.stringify(d.comp.segs)} vs ${mBase} / ${mRest}`);
  ok(seg(d, 'base').pct === Math.round(mBase / (mBase + mRest) * 100),
     '　割合もその平均の比', `${seg(d, 'base').pct} vs ${mBase / (mBase + mRest) * 100}`);
  const rate = (await one(`select to_usd from fx_rates where code = 'JPY'`)).to_usd;
  await db.query(`update fx_rates set to_usd = to_usd * 2 where code = 'JPY'`);
  const d2 = await deep(sel);
  await db.query(`update fx_rates set to_usd = $1 where code = 'JPY'`, [rate]);
  ok(JSON.stringify(d2.comp) === JSON.stringify(d.comp),
     '★★為替表の円のレートを2倍にしても、給与構成は1文字も動かない（いまのレートを引いていない）');
}
// ── (f) 賞与の割合 ── 分子と分母は、同じ人・同じ月 ────────────────────
{
  const A = fresh();
  // 内訳を書いた2人：賞与 24,000 と 12,000。内訳の無い（総支給だけ）3人目は賞与 60,000
  await put(0, A, 'fo', 'a320', 2, { gross_monthly: 10000, base_pay: 6000, bonus_annual: 24000 });  // 年 144,000
  await put(0, A, 'fo', 'a320', 2, { gross_monthly: 10000, base_pay: 6000, bonus_annual: 12000 });  // 年 132,000
  await put(0, A, 'fo', 'a320', 2, { gross_monthly: 10000, bonus_annual: 60000 });                  // 年 180,000
  await asUser(V);
  const d = await deep({ airline: A, position: 'fo', fleet: 'a320' });
  /* 内訳を書いた2人だけ：分子 (24,000 ＋ 12,000) ÷ 2 ＝ 18,000 ／ 分母 (144,000 ＋ 132,000) ÷ 2 ＝ 138,000
     → 13.04% → 13%。総支給だけの3人目を混ぜると (96,000 ÷ 3) ÷ (456,000 ÷ 3) ＝ 21%。 */
  ok(d.comp.bonus && Number(d.comp.bonus.pct_of_annual) === 13,
     '★★賞与の割合は、内訳を書いた人たちの「申告の年額の平均 ÷ 保存してある年収の平均」（13%。全員で割れば 21%）',
     JSON.stringify(d.comp.bonus));
  /* 見出しの年収は**全員**・賞与の平均込み：平均 (24,000 ＋ 12,000 ＋ 60,000) ÷ 3 ＝ 32,000。
     3人とも 120,000 ＋ 32,000 ＝ 152,000。月換算は3人とも 10,000。
     ⚠️ 152,000 ×(1 − 13%)÷ 12 ＝ 11,020 は月換算ではない（母集団の違う2つを掛けている）。 */
  ok(Number(d.head.annual_usd) === 152000 && Number(d.head.month_usd) === 10000,
     '★見出しの年収は全員ぶん（152,000）。月換算はサーバが出す 10,000（年収 × 賞与の割合で作らない）',
     JSON.stringify(d.head));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 28. 変動給の中身 ── 母集団は1つ（変動給の内訳が揃っている人ぜんぶ）');
// ════════════════════════════════════════════════════════════
/* 連動先ごとに「それを書いた人だけ」で平均すると嘘になる ── 20人のうち18人が block だけ・
   2人が duty だけなら、書いた人だけの平均は 100% と 100% ＝ 並べて 50 / 50。
   1人1票の本当の答えは 90 / 10。**全員**で割る（持たない人は 0）。 */
const vrow = (rows) => {
  const tot = rows.reduce((a, r) => a + (r.amount || 0), 0);
  return { base_pay: 8000, flight_variable_pay: tot, other_allowance: tot,
           pay_items: { v: 1, variable: rows } };
};
{
  const A = fresh();
  for (let i = 0; i < 18; i++)
    await put(0, A, 'fo', 'a320', 2, vrow([{ amount: 1000, basis: 'block', label: 'Flight' }]));
  for (let i = 0; i < 2; i++)
    await put(0, A, 'fo', 'a320', 2, vrow([{ amount: 1000, basis: 'duty', label: 'Duty' }]));
  await asUser(V);
  const d = await deep({ airline: A, position: 'fo', fleet: 'a320' });
  ok(vk(d, 'block') && vk(d, 'block').pct === 90 && vk(d, 'duty') && vk(d, 'duty').pct === 10,
     '★★18人が block だけ・2人が duty だけ → 90 / 10（書いた人だけで平均すると 50 / 50）',
     JSON.stringify(d.var));
  ok(d.var.length === 2 && d.var.reduce((a, x) => a + x.pct, 0) === 100,
     '　棒は2本・合計はちょうど100', JSON.stringify(d.var));
}
{
  // 壁に届かない連動先は畳む：3人のうち night を書いたのは1人
  const A = fresh();
  await put(0, A, 'fo', 'a320', 2, vrow([{ amount: 1000, basis: 'block', label: 'Flight' }]));
  await put(0, A, 'fo', 'a320', 2, vrow([{ amount: 1000, basis: 'block', label: 'Flight' }]));
  await put(0, A, 'fo', 'a320', 2, vrow([{ amount: 400, basis: 'block', label: 'Flight' },
                                         { amount: 600, basis: 'night', label: 'Night' }]));
  await asUser(V);
  const d = await deep({ airline: A, position: 'fo', fleet: 'a320' });
  // 平均：block (1,000 ＋ 1,000 ＋ 400) ÷ 3 ＝ 800 ／ night 600 ÷ 3 ＝ 200（1人 → 畳む）
  ok(vk(d, 'block').pct === 80 && vk(d, 'rest') && vk(d, 'rest').pct === 20 && !vk(d, 'night'),
     '★★1人しか書いていない night は rest へ畳む（80 / 20・合計100。落とせば block 100% になる）',
     JSON.stringify(d.var));
}
{
  /* 連動先を答えていない行を持つ人は、母集団に入れない（0 と読まない）。
     3人目は「duty 1,000」と「連動先が空の 3,000」。この月は変動給の内訳が揃っていない。 */
  const A = fresh();
  await put(0, A, 'fo', 'a320', 2, vrow([{ amount: 1000, basis: 'block', label: 'Flight' }]));
  await put(0, A, 'fo', 'a320', 2, vrow([{ amount: 1000, basis: 'block', label: 'Flight' }]));
  await put(0, A, 'fo', 'a320', 2, vrow([{ amount: 1000, basis: 'duty', label: 'Duty' },
                                         { amount: 3000, label: 'Mystery' }]));
  await asUser(V);
  const d = await deep({ airline: A, position: 'fo', fleet: 'a320' });
  /* 揃っている2人だけ：block 100%。3人目を「block 0」と数えれば block 67% / rest 33% になる。 */
  ok(d.var.length === 1 && vk(d, 'block') && vk(d, 'block').pct === 100,
     '★★連動先が空の行を持つ人は母集団から外す（block 100%。0 と数えれば 67% / 33%）',
     JSON.stringify(d.var));
  ok(shown(d) && d.comp !== null,
     '　その人は年収にも給与構成にも居る（外れるのは変動給の円だけ）');
}
{
  // 変動給の内訳が揃っている人が壁の下（1人）→ 空の配列。給与構成は出たまま
  const A = fresh();
  await put(0, A, 'fo', 'a320', 2, vrow([{ amount: 1000, basis: 'block', label: 'Flight' }]));
  await put(0, A, 'fo', 'a320', 2, { gross_monthly: 9000, base_pay: 8000 });
  await asUser(V);
  const d = await deep({ airline: A, position: 'fo', fleet: 'a320' });
  ok(d.comp !== null && Array.isArray(d.var) && d.var.length === 0,
     '★変動給の行を書いたのが1人では、円は出さない（空の配列。その1人の内訳を平均と名乗らない）',
     JSON.stringify(d.var));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 29. 口コミ由来の年収と賞与（REAL PAY の一覧に出ている人たち）');
// ════════════════════════════════════════════════════════════
/* 給与の仕組みができる前、口コミのフォームが年収と賞与も聞いていた（万円）。その人たちは
   REAL PAY の一覧に1行ずつ出ている。2026-10-12 から、この画面の**年収の母集団**にも入る
   （db/deep-pay.sql 3章「口コミ由来の給与」）。読み方は REAL PAY と同じ ──
     同じ人かどうか＝対応表（pv_review_person）／会社＝pv_airline_resolve／
     職位＝古いコードを寄せる（captain → cap ほか。寄せられなければ落とす）／
     USD ＝ 万円 × 10000 × いまの円のレート／同じ人がその会社の給与を本棚に出していたら使わない。
   ★機材・勤務・内訳は持っていない ＝ 機材を条件にする区分・Pay / Block Hour・働き方・
     給与構成には1人も入らない。
   ★口コミの総額は**賞与込みの合計**。賞与の平均を割り振るときは3通りに分かれる ──
       賞与を書いている            … 書いた賞与を引いて、平均を足す
       賞与は空・部品から組み立てた … 賞与は入っていない。平均を足す
       賞与は空・総額に直に入っている … 何も引かず、何も足さない（総額の中に賞与が居る）
   ★対応表は db/pay-rows.sql を流したときに埋まる。口コミを足すたびに流し直す（link）。 */
const SR = read('submit-review.html');
const SALT = SR.match(/encode\(\s*userId \+ '([^']+)' \+ airline \+ '([^']+)'\s*\)/);
ok(!!SALT, '口コミの持ち主キーの作り方を submit-review.html から読み取れた');
const { createHash } = await import('node:crypto');
const revHash = (u, air) =>
  createHash('sha256').update(uid(u) + SALT[1] + air + SALT[2]).digest('hex');
/* 口コミを1件置く。金額は万円（ann＝総額／base・fa＝基本給・乗務手当／mon＝月給／bon＝賞与）。
   u を省くと新しい人。 */
const review = async (u, air, pos, cols) => {
  const who = u || ++seat;
  await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`,
    [uid(who), `p${who}@example.com`]);
  await db.query(
    `insert into reviews_v2(proof_hash, airline, "position", annual_salary, base_annual,
                            flight_allowance_annual, monthly_salary, bonus)
     values($1,$2,$3,$4,$5,$6,$7,$8)`,
    [revHash(who, air), air, pos, cols.ann ?? null, cols.base ?? null, cols.fa ?? null,
     cols.mon ?? null, cols.bon ?? null]);
  return who;
};
const link = async () => { await db.exec(read('db/pay-rows.sql')); await asUser(V); };
const JPY = Number((await one(`select to_usd from fx_rates where code = 'JPY'`)).to_usd);
// 万円 → USD。REAL PAY と同じ直し方（× 10000 × いまの円のレート）
const man = (m) => Math.round(m * 10000 * JPY * 100) / 100;
const sig2 = async (v) => Number((await one(`select pv_sig2($1::numeric) v`, [v])).v);
// REAL PAY の一覧（V は鍵を持っている）から、その会社の行だけ
const realPay = async (air) =>
  ((await one(`select pv_pay_rows() r`)).r.rows || []).filter((x) => x.airline === air);

// ── (a) 口コミだけの区分 ── 年収の母集団に入り、賞与の申告も1票になる ─────────
{
  const A = fresh();
  const sel = { airline: A, position: 'cap' };
  await review(0, A, 'captain', { ann: 3000, bon: 600 });     // 総額 3,000万（賞与 600万込み）
  await review(0, A, 'captain', { mon: 200 });                // 月給 200万 × 12 ＝ 2,400万（賞与は空）
  // 職位を語彙に寄せられない口コミ（賞与 900万を書いている）
  await review(0, A, 'dispatcher', { ann: 5000, bon: 900 });
  await link();
  const d1 = await deep(sel);
  /* 申告した人は1人（壁の下）＝ 平均なし。年収は保存してあるまま (3,000 ＋ 2,400) ÷ 2 ＝ 2,700万。
     寄せられない口コミの 900万 は、どの区分の1票にもならない（なれば平均ができて額が動く）。 */
  ok(shown(d1) && Number(d1.head.annual_usd) === step50((man(3000) + man(2400)) / 2),
     '★★口コミだけの2人で区分が出る（年収 ＝ 2,700万を REAL PAY と同じレートで USD に）',
     `${JSON.stringify(d1.head)} vs ${step50((man(3000) + man(2400)) / 2)}`);
  ok(d1.head.bonus_est === false && d1.head.bonus_gap === true,
     '★申告が1人では平均を作らない。部品から組み立てた合計で賞与が空の人 ＝ 賞与が無い人の印',
     JSON.stringify(d1.head));
  ok(Number((await deep({ airline: A })).head.annual_usd) === Number(d1.head.annual_usd),
     '★★職位を寄せられない口コミは、会社だけの区分にも入らない（REAL PAY が行ごと落とすのと同じ）');
  ok(hidden(await deep({ airline: A, position: 'cap', fleet: 'b777' })),
     '★★機材まで絞った区分には、口コミ由来の人は1人も入らない（機材を持っていない）');
  ok(d1.head.per_block_usd === null && d1.work.block_h === null && d1.work.duty_h === null
     && d1.comp === null && d1.var === null && d1.head.fixed_pct === null,
     '★★Pay / Block Hour・働き方・給与構成・変動給の中身には1人も入らない（null。0 で埋めない）',
     JSON.stringify({ head: d1.head, work: d1.work, comp: d1.comp, var: d1.var }));
  ok(d1.picks.air.includes(A) && (d1.picks.pos[A] || []).includes('cap')
     && !Object.keys(d1.picks.flt).some((k) => k.startsWith(A + '|')),
     '★選べる組み合わせ：会社と職位には出る・機材の選択肢には出ない',
     JSON.stringify({ pos: d1.picks.pos[A] }));
  {
    const rp = await realPay(A);
    const got = rp.map((x) => Number(x.annual_usd)).sort((x, y) => x - y);
    ok(rp.length === 2 && got[0] === await sig2(man(2400)) && got[1] === await sig2(man(3000)),
       '★★REAL PAY の一覧も同じ2人・同じ換算（寄せられない職位は、あちらでも落ちている）',
       JSON.stringify(got));
  }
  // 申告する人をもう1人（総額 2,600万・賞与 200万）→ 壁に届いて平均ができる
  await review(0, A, 'captain', { ann: 2600, bon: 200 });
  await link();
  const d2 = await deep(sel);
  /* 平均 ＝ (600 ＋ 200) ÷ 2 ＝ 400万。
       3,000 − 600 ＋ 400 ＝ 2,800 ／ 2,600 − 200 ＋ 400 ＝ 2,800 ／ 2,400 ＋ 400 ＝ 2,800（万円）
     3人とも 2,800万。保存してあるままなら中央値は 2,600万。
     ★総額は賞与込みなので、書いた賞与を引いてから足している（引かなければ 3,400 と 3,000）。 */
  ok(Number(d2.head.annual_usd) === step50(man(2800)),
     '★★口コミの申告だけで平均ができ（申告2人）、総額から自分の賞与を引いて平均を足す（3人とも 2,800万）',
     `${d2.head.annual_usd} vs ${step50(man(2800))}`);
  ok(d2.head.bonus_est === true && d2.head.bonus_gap === false,
     '　平均で作った印が立ち、賞与が無い人の印は消える', JSON.stringify(d2.head));
  // 月換算：(3,000 − 600) ÷ 12 ＝ 200 ／ (2,600 − 200) ÷ 12 ＝ 200 ／ 2,400 ÷ 12 ＝ 200（万円）
  ok(Number(d2.head.month_usd) === await sig2(man(200)),
     '★月換算は、書いた賞与を引いた額（3人とも月 200万）', String(d2.head.month_usd));
}

// ── (b) 総額だけ・賞与は空 ── 何も引かず、何も足さない。換算は REAL PAY と同じ ─────
{
  const A = fresh();
  await review(0, A, 'fo', { ann: 3000 });
  await review(0, A, 'fo', { ann: 3000 });
  await link();
  const d = await deep({ airline: A, position: 'fo' });
  const rp = await realPay(A);
  ok(Number(d.head.annual_usd) === step50(man(3000)),
     '★万円 → USD は「× 10000 × いまの円のレート」（3,000万）', String(d.head.annual_usd));
  ok(rp.length === 2 && rp.every((x) => Number(x.annual_usd) === Number(rp[0].annual_usd))
     && await sig2(Number(d.head.annual_usd)) === Number(rp[0].annual_usd),
     '★★同じ口コミについて、REAL PAY の1行と同じ額（有効数字2桁にそろえて比べる）',
     `${d.head.annual_usd} / ${JSON.stringify(rp.map((x) => x.annual_usd))}`);
  ok(d.head.bonus_est === false && d.head.bonus_gap === false,
     '★★総額に直に入っている人は、見積もりの印も、賞与が無い印も立てない（総額の中に賞与が居る）',
     JSON.stringify(d.head));
  ok(d.head.month_usd === null,
     '★月換算には入れない（賞与ぬきの額が言い切れない ＝ 列ごと null）', String(d.head.month_usd));
}

// ── (c) 平均が在る区分でも、総額に直に入っている人は動かさない ────────────
{
  const A = fresh();
  const sel = { airline: A, position: 'fo' };
  await review(0, A, 'fo', { ann: 3000 });
  await review(0, A, 'fo', { ann: 3400 });
  /* 平均を作る2人。本棚にも同じ会社の給与を出している（年 4,800 ＝ 常識の幅の下）ので、
     口コミは年収の母集団に入らず（本棚が勝つ）、本棚の行は幅の外で入らない ──
     **区分には居ないが、口コミに書いた賞与は1票になる**（本棚に賞与の申告が無いため）。 */
  for (const [ann, bon] of [[3000, 600], [2600, 200]]) {
    const u = await review(0, A, 'fo', { ann, bon });
    await put(u, A, 'fo', 'a320', 2, { gross_monthly: 400 });
  }
  await link();
  const d1 = await deep(sel);
  // 区分に居るのは総額だけの2人：(3,000 ＋ 3,400) ÷ 2 ＝ 3,200万。平均（400万）は足さない
  ok(Number(d1.head.annual_usd) === step50(man(3200)),
     '★★総額に直に入っている人には、区分に平均が在っても足さない（3,200万。足せば 3,600万）',
     `${d1.head.annual_usd} vs ${step50(man(3200))}`);
  ok(d1.head.bonus_est === false && d1.head.bonus_gap === false,
     '★★その人たちは目印を2つとも立てない', JSON.stringify(d1.head));
  // 部品から組み立てた人（月給 200万・賞与は空）を足す → この人には平均が乗る
  await review(0, A, 'fo', { mon: 200 });
  await link();
  const d2 = await deep(sel);
  /* 3,000（そのまま）・3,400（そのまま）・2,400 ＋ 400 ＝ 2,800 → 中央値 3,000万。
     総額の人にも足していれば 3,400・3,800・2,800 → 3,400万。 */
  ok(Number(d2.head.annual_usd) === step50(man(3000)),
     '★★同じ区分で：総額の人はそのまま・組み立てた人には平均が乗る（中央値 3,000万）',
     `${d2.head.annual_usd} vs ${step50(man(3000))}`);
  ok(d2.head.bonus_est === true && d2.head.bonus_gap === false,
     '★区分に平均が在ることの証拠：組み立てた人が est を立て、賞与が無い印は立たない',
     JSON.stringify(d2.head));
}

// ── (d) 3通りが1つの区分に居る ── 中央値で確かめる ─────────────────────
{
  const A = fresh();
  await review(0, A, 'fo', { ann: 3050 });               // 総額だけ      → 3,050 のまま
  await review(0, A, 'fo', { mon: 200 });                // 組み立て 2,400 → ＋600 ＝ 3,000
  await review(0, A, 'fo', { ann: 2800, bon: 400 });     // 賞与を書いた  → 2,800 − 400 ＋ 600 ＝ 3,000
  await review(0, A, 'fo', { ann: 3300, bon: 800 });     // 賞与を書いた  → 3,300 − 800 ＋ 600 ＝ 3,100
  await review(0, A, 'fo', { mon: 210 });                // 組み立て 2,520 → ＋600 ＝ 3,120
  await link();
  const d = await deep({ airline: A, position: 'fo' });
  /* 平均 ＝ (400 ＋ 800) ÷ 2 ＝ 600万。並べると 3,000・3,000・3,050・3,100・3,120 → 中央値 3,050万。
       総額の人にも足せば 3,650 → 中央値 3,100／賞与を引かなければ 3,400・3,900 → 中央値 3,120／
       組み立てた人に足さなければ 2,400・2,520 → 中央値 3,000。 */
  ok(Number(d.head.annual_usd) === step50(man(3050)),
     '★★3通りが混ざった区分の中央値は 3,050万（どれか1つでも取り違えると別の額になる）',
     `${d.head.annual_usd} vs ${step50(man(3050))}`);
  ok(d.head.bonus_est === true && d.head.bonus_gap === false, '　目印は est だけ',
     JSON.stringify(d.head));
  /* 月換算：総額だけの人は入らない。残り4人 ＝ 200・200・(3,300 − 800) ÷ 12 ＝ 208.33・210（万円）
     → 中央値 204.17万。 */
  ok(Number(d.head.month_usd) === await sig2(median(
       [man(2400) / 12, (man(2800) - man(400)) / 12, (man(3300) - man(800)) / 12, man(2520) / 12])),
     '★月換算は、賞与ぬきの額が言い切れる4人だけの中央値', String(d.head.month_usd));
}

// ── (e) 本棚の申告と口コミの申告は、1人1票ずつで一緒に平均する ────────────
{
  const A = fresh();
  await put(0, A, 'cap', 'b777', 2, { gross_monthly: 10000, bonus_annual: 30000 });   // 年 150,000
  await put(0, A, 'cap', 'b777', 2, { gross_monthly: 10000 });                        // 年 120,000
  await review(0, A, 'captain', { ann: 3000, bon: 500 });                             // 賞与 500万
  await link();
  const M = (30000 + man(500)) / 2;
  const dP = await deep({ airline: A, position: 'cap' });
  // 本棚の2人は 120,000 ＋ M。口コミの人は 3,000万 − 500万 ＋ M（いちばん高い）→ 中央値 120,000 ＋ M
  ok(Number(dP.head.annual_usd) === step50(120000 + M),
     '★★本棚の申告（30,000）と口コミの申告（500万）が、1票ずつで1つの平均になる',
     `${dP.head.annual_usd} vs ${step50(120000 + M)}`);
  /* 機材まで絞った区分には口コミの人は居ないが、**その人の申告は平均に入っている**。
     入っていなければ申告は1人 ＝ 平均なしで (150,000 ＋ 120,000) ÷ 2 ＝ 135,000。 */
  const dF = await deep({ airline: A, position: 'cap', fleet: 'b777' });
  ok(Number(dF.head.annual_usd) === step50(120000 + M) && dF.head.bonus_est === true,
     '★★機材まで絞った区分（本棚の2人だけ）にも、口コミの申告を含めた平均が乗る（135,000 ではない）',
     JSON.stringify(dF.head));
}

// ── (f) 本棚と口コミの両方に居る人 ── 数えるのは1回・賞与の1票も1回 ─────────
{
  /* 本棚に給与は出したが年間賞与は空、口コミには賞与を書いていた人。
       年収の母集団 … 本棚の行だけ（口コミの年収は使わない。同じ人が2行にならない）
       賞与の1票   … 口コミに書いた賞与（本棚に申告が無いので。蓄積された申告を捨てない） */
  const A = fresh();
  const x = await put(0, A, 'cap', 'b777', 2, { gross_monthly: 10000 });              // 年 120,000
  await review(x.u, A, 'captain', { ann: 3000, bon: 600 });
  await put(0, A, 'cap', 'b777', 2, { gross_monthly: 12000, bonus_annual: 20000 });   // 年 164,000
  await link();
  const M = (man(600) + 20000) / 2;
  const want = step50(((120000 + M) + (144000 + M)) / 2);
  const d = await deep({ airline: A, position: 'cap' });
  ok(Number(d.head.annual_usd) === want,
     '★★本棚の賞与が空の人は、口コミの賞与を1票として出す。本人の年収は 120,000 ＋ 平均（口コミの賞与を引かない）',
     `${d.head.annual_usd} vs ${want}`);
  ok(Number((await deep({ airline: A })).head.annual_usd) === want,
     '★★その人は年収の母集団に1回だけ（口コミの 3,000万 を2行目として数えていない）');
  ok((await realPay(A)).length === 2,
     '　REAL PAY の一覧でも2人（同じ人の口コミ側は落ちている ＝ 同じ決まり）');

  // 本棚にも口コミにも賞与を書いた人 ── 1票は本棚のぶんだけ
  const B = fresh();
  const y = await put(0, B, 'cap', 'b777', 2, { gross_monthly: 10000, bonus_annual: 10000 });  // 年 130,000
  await review(y.u, B, 'captain', { ann: 3000, bon: 900 });
  await put(0, B, 'cap', 'b777', 2, { gross_monthly: 12000, bonus_annual: 30000 });            // 年 174,000
  await put(0, B, 'cap', 'b777', 2, { gross_monthly: 11000 });                                 // 年 132,000
  await link();
  const d2 = await deep({ airline: B, position: 'cap' });
  /* 平均 ＝ (10,000 ＋ 30,000) ÷ 2 ＝ 20,000（口コミの 900万は使わない）。
     140,000・164,000・152,000 → 中央値 152,000。口コミの賞与を足したり差し替えたりすれば動く。 */
  ok(Number(d2.head.annual_usd) === 152000,
     '★★両方に賞与を書いた人の1票は、本棚の申告だけ（中央値 152,000）',
     String(d2.head.annual_usd));
}

// ── (g) はしごの側 ── 口コミ由来は「機材区分」の段にも入らない ──────────────
{
  /* 呼び手の機材が「その他」（機材区分が空）のとき、2段（会社×役職×機材区分）は
     「区分が同じ」を null どうしでも真と読む。口コミ由来も機材区分が null なので、
     名指しで外していないと**機材区分の段に口コミの人が入る**（持っていない機材区分で数える）。
     正しくは：1段・2段は呼び手1人だけで壁の下 → 3段（会社×役職）で口コミの人と2人になる。 */
  const A = fresh();
  const me = await put(0, A, 'fo', 'b777', 6, { gross_monthly: 10000 });    // 年 120,000
  await review(0, A, 'fo', { ann: 3000 });
  await link();
  await ready(me.u);
  await openKey(me.u);
  /* いまの保存の道は機材「その他」を受け付けない（機材区分が引けないので弾く）。機材区分が空の
     行は、その検品より前の古い行にだけ在りうる ── 保存済みの行を直に書き換えて作る
     （見る資格の1行は、書き換える**前**に出してある）。 */
  await db.query(`update pay_reports set fleet = 'other', fleet_cat = null where id = $1`, [me.id]);
  await asUser(me.u);
  const d = await deep();
  ok(d.state === 'open' && d.cohort.level === 'airline_pos',
     '★★口コミ由来の人は機材区分の段（2段）に入らない ── 会社×役職（3段）で初めて一緒に数える',
     `${d.state} / ${JSON.stringify(d.cohort)}`);
  ok(Number(d.head.annual_usd) === step50((120000 + man(3000)) / 2),
     '　3段の年収は、呼び手と口コミの人の中央値', String(d.head.annual_usd));
  await asUser(V);
}
ok((await fingerprint()) !== FP0,
   '（検査の道具）口コミと対応表を足したので、指紋は変わっている');
{
  // 最後にもう一度：どれだけ呼んでも、保存してある行は書き換わらない
  const before = await fingerprint();
  await asUser(V);
  await deep(); await deep({ position: 'cap' }); await deep({ position: 'fo' });
  await deep({ fleet: 'b777' });
  ok((await fingerprint()) === before,
     '★★区分を変えて何度呼んでも、給与・口コミ・対応表・名簿は1バイトも違わない（読むだけ）');
}

// ════════════════════════════════════════════════════════════
/* ★ここが一番効く。deep-pay.sql の末尾には、貼れたかどうかをオーナーが
     自分で確かめるための37行の表が付いている。**あの表自体が間違っている**と、
     オーナーは正しく貼れているのに ❌ を見て貼り直す（実際に13番の署名を
     1つ写し間違えていた）。手元で同じ表を出して、全部 ✅ を確かめる。 */
{
  const src = read('db/deep-pay.sql');
  const cut = src.indexOf('with d as (select pg_get_functiondef');
  ok(cut > 0, '自己点検の select が見つかる');
  /* ★16番は「本番では試験用の抜け道が効かない」を見ている。この器には
       auth.users が無い（だから抜け道が通る）ので、本番と同じ形にしてから回す。
       抜け道そのものが効かないことは ▼20-(i) で確かめてある。 */
  await db.exec(`create table if not exists auth.users (id uuid primary key)`);
  const sql = src.slice(cut);
  const r = await rows(sql);
  /* ★行数は固定で見る（2026-10-11 に 21 → 24、同じ日に見る資格の5行で 24 → 29、
       公開より前から居た人の1行で 29 → 30。2026-10-12 に、誰を数えるか・賞与の扱いの
       7行で 30 → 37）。
       「以上」で見ると、union all を1行消しても緑のまま ── 消えた1行が、
       いちばん守りたい約束かもしれない。 */
  ok(r.length === 37, `自己点検は ${r.length} 行ある（37行）`, String(r.length));
  ok(r.map(x => Number(x['#'])).join(',') ===
       Array.from({ length: 37 }, (_, i) => i + 1).join(','),
     '番号は 1〜37 が1つずつ（重複も欠番も無い）', r.map(x => x['#']).join(','));
  for (const x of r)
    ok(x['答え'] === '✅', `${x['#']}. ${x['見るもの']}`, x['答え']);
}

// ════════════════════════════════════════════════════════════
console.log(`\n${fail === 0 ? '✅ 全部通った' : '❌ 落ちた検査がある'}  ` +
            `pass ${pass} / fail ${fail}`);
process.exit(fail === 0 ? 0 : 1);
