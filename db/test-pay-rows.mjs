/* db/pay-rows.sql を本物の Postgres（PGlite = PG17 の WASM ビルド）に流して確かめる。

   実行: node db/test-pay-rows.mjs   （または npm run test:sql）
   ネットワーク不要・本番に一切触らない。SQL を直したら必ずこれを通してから
   オーナーに実行を依頼すること。

   器は db/test-referrals.mjs と同じ（anon / authenticated ロール、既定権限を
   全付与した状態、auth.uid() の代役、profiles）。既定権限を先に全付与してあるから
   こそ pay-rows.sql の revoke が意味を持つ。無いと「元から権限が無いだけ」を
   「revoke が効いた」と誤読する。

   ★2026-08-23、オーナー判断で k≧5 の門・30日の遅延・p10-p90 のクリップを外した。
     ＝ 出した人は全員そのまま行になる。だからこのファイルが見ているのは
     「出るか出ないか」ではなく、**出たあとで何が漏れないか**に移っている。
     落ちたら画面を作ってはいけない本命は次の5本：

       ・同じ人の12か月が1行に畳まれること      … 出した回数から常連が割れないこと
       ・返り値の文字列に準識別子が1語も無いこと  … 基地・年代・投稿月・原本通貨など
       ・自由入力の社名が返り値に出ないこと      … 打ち込まれた文字列そのものが識別子
       ・並びが投稿順でも金額順でもないこと      … 並び順から「誰が最近出したか」が読めない
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
const [A_ONE, A_M12, A_MIX, A_OLD, A_ORD, A_VF, A_OUT, A_FOTHER] = AIR;

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

// (g) 中央値の10倍を出した1人＋ふつうの4人（★クリップを外したので、この人は出る）
for (const g of [15000, 15000, 15000, 15000, 150000])
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

const mix = only(R, x => x.airline === A_MIX);
ok(mix.length === 2, '1人が2機材を出すと機材ごとに1行（＝2行）', `= ${mix.length}行`);
ok(mix.map(x => x.fleet).sort().join() === 'a330,b787', '　787 と 330 が1行ずつ');
ok(mix.find(x => x.fleet === 'b787')?.annual_usd == 10000 * 12
   && mix.find(x => x.fleet === 'a330')?.annual_usd == 20000 * 12,
   '　機材ごとの額が混ざっていない', JSON.stringify(mix.map(x => [x.fleet, x.annual_usd])));

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
  ok(Math.max(...outs) === 150000 * 12,
     '★中央値の10倍の人はクリップされずに出る（丸めだけが効く）', JSON.stringify(outs));
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
  const a = (await payRows()).rows.map(x => `${x.airline}/${x.fleet}/${x.annual_usd}`).join('|');
  const b = (await payRows()).rows.map(x => `${x.airline}/${x.fleet}/${x.annual_usd}`).join('|');
  ok(a === b, '何度呼んでも同じ並び（md5 順で固定）');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 7. ★返り値に何が入っているか');
// ════════════════════════════════════════════════════════════
const ALLOWED = ['airline', 'pos', 'fleet', 'annual_usd', 'verified'];
const extra = [...new Set(R.flatMap(x => Object.keys(x)))].filter(k => !ALLOWED.includes(k));
ok(extra.length === 0, '返す項目は5つだけ', JSON.stringify(extra));

const raw = (await one(`select pv_pay_rows()::text t`)).t;
const BANNED = ['proof_hash', 'base_iata', 'seniority', 'age_bucket', 'period_month',
                'period_year', 'created_at', 'annual_total_orig', 'currency',
                'contract_type', 'tax_country', 'nationality', 'verify_level',
                'base_pay', 'housing', 'per_diem', 'block_hours', 'airline_other'];
const hit = BANNED.filter(w => raw.includes(w));
ok(hit.length === 0, '準識別子・個人の内訳が返り値の文字列に1つも無い', JSON.stringify(hit));
ok(!raw.includes(OTHER_NAME) && !raw.toLowerCase().includes('somewhere'),
   '★打ち込まれた自由入力の社名が返り値に1文字も無い');
ok(only(R, x => x.airline === 'other').every(x => x.fleet === 'b737'),
   '　その人たちは airline が other のまま（社名の代わりに固定のコード）');

ok(only(R, x => x.fleet === 'other').length === 1,
   '機材の「その他」はそのまま other として出る（ラベルは画面が付ける）');
ok(R.every(x => x.airline && x.pos && x.fleet), 'ラベルの無い列が1つも無い');
ok(R.every(x => typeof x.verified === 'boolean'), '検証は true/false の1つだけ（段階を持たない）');
{
  const vf = only(R, x => x.airline === A_VF);
  ok(vf.length === 2 && vf.filter(x => x.verified).length === 1,
     '検証済みの人だけ verified が true', JSON.stringify(vf.map(x => x.verified)));
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
console.log('\n▼ 10. 自己点検 SQL（ファイル末尾のものをそのまま流す）');
// ════════════════════════════════════════════════════════════
{
  const src = read('db/pay-rows.sql');
  const q = src.slice(src.lastIndexOf('with f as ('));
  const res = await rows(q);
  ok(res.length === 14, `自己点検が14行ぜんぶ出る（= ${res.length}行）`);
  for (const row of res) {
    ok(row['結果'] === '✅', `${row['#']}. ${row['見るところ']}`);
  }
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 11. 8-20（pay_reports を読む関数が anon に開いていないこと）');
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
