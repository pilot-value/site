/* ════════════════════════════════════════════════════════════════
   解放ルールと Step7-B2 の列を、本物の Postgres（PGlite）で測る。

   なぜこのテストが要るか:

   ① 以前の submit_pay_report は「3ヶ月連続で出したら解放を12ヶ月に伸ばす」
      だった。つまり3回出せば1年間戻ってくる理由が無くなる。
      この事業の資産は「月次で更新され続けるデータ」なので、
      それは資産そのものを削る設定だった。★ここが二度と戻らないよう固定する。

   ② 解放期間は一度配ると取り返せない。だから既に長い解放を持っている人からは
      取り上げない（greatest を残す）。「縮まないこと」も測る。

   ③ 明細から読めているのに捨てていた実額（差引支給額・累積課税支給額）を
      保存できること。既存26キーを1つも壊していないことは
      db/test-form-contract.mjs（88検査）が別途見ている。

   ④ my_pay_reports は user_id を持たないまま本人の行だけを返す。
      「他人には1行も返らない」が崩れると疑似匿名が崩れるので、そこを測る。

   実行: node db/test-unlock-rule.mjs
   ════════════════════════════════════════════════════════════════ */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };

// ── 本番と同じ器（test-form-contract.mjs と同じ組み方）─────────────
const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  grant usage on schema public, extensions to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  ${/* 本番の profiles が持っている同意まわりの列（db/schema-additions.sql 1)）を
        そのまま生やす。set_mail_optin が「子（mail_optin）をオンにしたら
        親（email_opt_in）も立てる」ようになったので、親側の列が欠けていると
        ここだけ本番と違う形になってしまう。 */''}
  create table public.profiles (
    id uuid primary key, email text, name text,
    email_opt_in    boolean not null default false,
    email_opt_in_at timestamptz,
    unsub_token     uuid not null default gen_random_uuid()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;
`);
for (const f of ['db/airlines.generated.sql', 'db/vocab.generated.sql', 'db/pay-reports.sql']) {
  await db.exec(read(f));
}

const A = '00000000-0000-4000-8000-00000000a001';   // 本人
const B = '00000000-0000-4000-8000-00000000b002';   // 別人
for (const [id, mail] of [[A, 'a@example.com'], [B, 'b@example.com']]) {
  await db.query('insert into profiles(id,email) values($1,$2) on conflict do nothing', [id, mail]);
}
const as = (uid) => db.query('select set_config($1,$2,false)', ['pv.uid', uid]);
const q = async (sql, args = []) => (await db.query(sql, args)).rows;

/* 明細から埋まる想定の最小ペイロード。金額は全部でたらめ（実物ではない）。 */
const base = (y, m, extra = {}) => ({
  airline: 'emirates', position: 'cap', fleet: 'b777',
  currency: 'AED', period_year: y, period_month: m,
  base_pay: '48500', block_hours: '86.5', lang: 'ja', ...extra,
});
const submit = async (p) => (await q('select submit_pay_report($1::jsonb) r', [JSON.stringify(p)]))[0].r;
const prof = async (uid) => (await q('select * from profiles where id=$1', [uid]))[0];
const days = (until) => Math.round((new Date(until) - Date.now()) / 86400000);

// ═══ ① 解放は常に90日。連続提出で伸びない ═══════════════════════
console.log('\n① 解放は何ヶ月続けても90日（3ヶ月で12ヶ月に化けない）');
await as(A);
const seen = [];
for (const m of [3, 4, 5, 6]) {
  const r = await submit(base(2026, m));
  const p = await prof(A);
  seen.push({ month: m, streak: p.pay_streak_months, days: days(r.access_until) });
}
seen.forEach((s) => ok(Math.abs(s.days - 90) <= 1,
  `${s.month}月ぶん提出（連続${s.streak}ヶ月目）→ 解放 ${s.days}日`));
ok(seen[3].streak === 4, `連続月数はちゃんと積み上がる → ${seen[3].streak}`);
ok(Math.max(...seen.map((s) => s.days)) <= 91,
   '★どの回も90日を超えない（旧実装なら3回目で365日になっていた）');

// ═══ ② 既に長い解放を持っている人からは取り上げない ══════════════
console.log('\n② 仕様変更は前向きだけに効く（過去に配ったものは取り返さない）');
await db.query(`update profiles set access_until = now() + interval '12 months' where id=$1`, [A]);
const longBefore = days((await prof(A)).access_until);
const r2 = await submit(base(2026, 7));
ok(days(r2.access_until) === longBefore,
   `12ヶ月の解放を持つ人が提出しても縮まない → ${longBefore}日のまま`);
ok(days(r2.access_until) > 300, '旧ルールで得た長い解放はそのまま残る');

// ═══ ③ Step7-B2：明細の実額が往復する ═══════════════════════════
console.log('\n③ 読めているのに捨てていた実額が保存される');
await as(B);
await submit(base(2026, 6, {
  net_pay_actual: '669725', ytd_taxable: '5400000',
  flight_variable_pay: '224000', deduction_total: '375275',
  duty_hours: '120.5', night_hours: '4.2', credit_hours: '78.2',
  source: 'payslip',
}));
const row = (await q(`select * from pay_reports order by created_at desc limit 1`))[0];
ok(Number(row.net_pay_actual) === 669725, `差引支給額の実額 → ${row.net_pay_actual}`);
ok(Number(row.ytd_taxable) === 5400000, `累積課税支給額（年収ペースの素） → ${row.ytd_taxable}`);
ok(Number(row.deduction_total) === 375275, `控除は合計だけ → ${row.deduction_total}`);
ok(Number(row.duty_hours) === 120.5 && Number(row.credit_hours) === 78.2,
   `拘束時間と credit hours が別々に入る → duty ${row.duty_hours} / credit ${row.credit_hours}`);
ok(Number(row.block_hours) === 86.5 && Number(row.duty_hours) !== Number(row.block_hours),
   '★block と duty は別列（混ぜると時給の物差しが壊れる）');
ok(row.source === 'payslip', `AIが下書きした行を後から見分けられる → source=${row.source}`);

console.log('\n③-b 知らない source は素通しにしない');
await submit(base(2026, 5, { source: 'まちがい' }));
ok((await q(`select source from pay_reports order by created_at desc limit 1`))[0].source === 'web',
   '知らない値は web に倒す（集計に使えなくなるのを防ぐ）');

// ═══ ④ 控除の内訳は持てない（組合が割れる）═══════════════════════
console.log('\n④ 控除の内訳を保存する列が存在しないこと');
const cols = (await q(`select column_name from information_schema.columns
  where table_schema='public' and table_name='pay_reports'`)).map((r) => r.column_name);
// ⚠️ union_pay（組合手当）は**この検査の対象ではない**。
//    ここが見張っているのは「組合費 ＝ 控除」のほう。額から所属組合が割れるので持たない。
//    union_pay は逆に**支給**側で、組合の役員をしている人に出る手当。
//    給与フォームの作り直し（2026-08-26）で専用の列にすると決めている
//    （CLAUDE.md「絶対に破らない6つ」の2番＝職位手当や変動給に足し込ませないため）。
//    2026-08-28、名前に union が入るというだけでこの検査が落ちていたので外した。
//    ⚠️ 外すのは**この1列だけ**。union_fee / union_dues のような控除側の列が増えたら、
//    これまでどおり落ちる。
const DUES = cols.filter((c) => c !== 'union_pay');
ok(!DUES.some((c) => /union|kumiai|deduction_item|deduction_detail/i.test(c)),
   '組合費・控除内訳の列が無い（どの組合かは極めて機微／組合手当 union_pay は支給側なので別）');
ok(cols.includes('deduction_total'), '持つのは合計だけ');

// ═══ ⑤ my_pay_reports は本人の行だけ ════════════════════════════
console.log('\n⑤ user_id を持たないまま、本人の履歴だけ返る');
await as(A);
const mineA = (await q('select my_pay_reports() r'))[0].r;
await as(B);
const mineB = (await q('select my_pay_reports() r'))[0].r;
ok(mineA.reports.length === 5, `A は自分の5件が見える → ${mineA.reports.length}件`);
ok(mineB.reports.length === 2, `B は自分の2件だけ → ${mineB.reports.length}件`);
const ymA = mineA.reports.map((r) => r.period_ym);
ok(new Set(ymA).size === ymA.length && ymA.every((v, i, a) => !i || a[i - 1] <= v),
   '対象月の昇順で重複なく返る（推移グラフがそのまま描ける）');
ok(!JSON.stringify(mineA).includes('proof_hash'), 'proof_hash を外に出していない');
ok(!cols.includes('user_id'), '★pay_reports に user_id は無いまま（疑似匿名を弱めていない）');

/* マイページは金額を円に直して PVCurrency に載せる（サイト共通の通貨切替ルール）。
   明細の実額は全部「原本通貨」なので、レートが返らないと1つも換算できない。 */
console.log('\n⑤-a マイページが円に直せるだけの材料が返る');
const last = mineA.reports[mineA.reports.length - 1];
ok(last.fx_to_jpy != null && Number(last.fx_to_jpy) > 0,
   `原本通貨→円のレートが付いてくる → ${last.currency} 1 = ¥${last.fx_to_jpy}`);
ok(Math.abs(Number(last.base_pay) * Number(last.fx_to_jpy) - 48500 * Number(last.fx_to_jpy)) < 0.01,
   '明細の実額（原本通貨）× レート で円になる');
ok(mineA.pay_day_of_month != null, `給料日も一緒に返る（次はいつ、が言える） → ${mineA.pay_day_of_month}日`);

console.log('\n⑤-b 「一覧にない会社」も本人には見える（ハッシュに社名が入るため）');
await as(B);
await submit({ ...base(2026, 4), airline: 'other', airline_other: 'Foo Air' });
const mineB2 = (await q('select my_pay_reports() r'))[0].r;
ok(mineB2.reports.some((r) => r.airline === 'other' && r.airline_other === 'Foo Air'),
   '自由入力の社名の行も拾える');
await as(A);
ok(!((await q('select my_pay_reports() r'))[0].r.reports).some((r) => r.airline === 'other'),
   '★他人の「一覧にない会社」の行は1件も混ざらない');

console.log('\n⑤-c 未ログインでは開かない');
await db.query(`select set_config('pv.uid','',false)`);
let denied = false;
try { await q('select my_pay_reports() r'); } catch (e) { denied = /ログイン/.test(String(e.message || e)); }
ok(denied, '未ログインは弾く');

// ═══ ⑥ メール同意は既定で false ═════════════════════════════════
console.log('\n⑥ 同意した人にしか一通も送らない');
await as(A);
ok((await prof(A)).mail_optin === false, '既定は false（黙って送らない）');
ok((await prof(A)).mail_unsub_token != null, '解除トークンが最初から入っている');
await q('select set_mail_optin(true) r');
ok((await prof(A)).mail_optin === true, '本人が入れれば true になる');
ok((await prof(A)).mail_optin_at != null, 'いつ同意したかが残る');
await q('select set_mail_optin(false) r');
const off = await prof(A);
ok(off.mail_optin === false && off.mail_optin_at != null,
   '外しても同意した記録は消さない（後から証明できる）');

console.log('\n⑥-b 給料日は投稿日から学習する（毎月25日に一斉、ではない）');
ok((await prof(A)).pay_day_of_month === new Date().getDate(),
   `その人の給料日を覚えている → ${(await prof(A)).pay_day_of_month}日`);

// ═══ ⑦ ソース側にルールが残っていること ══════════════════════════
console.log('\n⑦ 二度と12ヶ月に戻らないよう、ソースにも印を残す');
const SRC = read('db/pay-reports.sql');
ok(/interval '90 days'/.test(SRC), '90日が書かれている');
ok(!/then interval '12 months'/.test(SRC), "★「連続なら12ヶ月」の分岐が消えている");
ok(/streak で期間を伸ばしてはいけない/.test(SRC), '伸ばしてはいけない理由がコードに残っている');
ok(/greatest\(\s*coalesce\(v_prof\.access_until/.test(SRC), 'greatest で既存の解放を守っている');

console.log(`\n${pass} pass / ${fail} fail`);
await db.close();
process.exit(fail ? 1 : 0);
