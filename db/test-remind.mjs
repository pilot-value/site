/* ════════════════════════════════════════════════════════════════
   月次リマインドを、本物の Postgres（PGlite）で測る。

   なぜこのテストが要るか:

   ① profiles には「メールを送ってよいか」の旗が2つある
      （email_opt_in ＝昔からある方 / mail_optin ＝トラッカー用に足した方）。
      片方だけ落ちる経路があると、**解除リンクを踏んだ人に送り続ける**。
      機能の不具合ではなく事業のリスクなので、DB のトリガーで
      「食い違えない」ことを固定する。ここが本丸。

   ② 送信対象の条件は全部 SQL 側（pv_reminder_due）に置いた。
      Edge Function 側に条件を書くと測れない。ここで境界を全部踏む。

   ③ 給料日は国・会社で違う。31日払いの人が30日までの月に
      永久に取りこぼされないこと（月末への丸め）を測る。

   ④ メール本文に金額・会社名・明細の項目を入れない。
      pay_reports は user_id を持たない設計なのに、メールに額を書けば
      Resend のログと受信箱に「このアドレスの人の報酬額」が残る。
      index.ts を grep して固定する。

   実行: node db/test-remind.mjs
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
const sec = (s) => console.log('\n── ' + s + ' ' + '─'.repeat(Math.max(0, 56 - s.length)));

// ── 本番と同じ器 ────────────────────────────────────────────────
const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  create role service_role;
  grant usage on schema public, extensions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  create table public.profiles (id uuid primary key, email text, name text, country text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;
`);

/* schema-additions.sql の 1)列追加 と 2)解除RPC だけを本物のまま流す。
   3) 以降は auth.users のトリガーと reviews_v2 なので、ここでは要らない。
   ★スライスなので、向こうを直せばこちらも自動で追従する（写経しない）。 */
const addSrc = read('db/schema-additions.sql');
const from = addSrc.indexOf('-- ── 1) 列の追加');
const to = addSrc.indexOf('-- ── 3) 新規登録トリガー');
ok(from > 0 && to > from, 'schema-additions.sql から 1)〜2) を切り出せた');
await db.exec(addSrc.slice(from, to));

for (const f of ['db/airlines.generated.sql', 'db/vocab.generated.sql', 'db/pay-reports.sql', 'db/pay-reminder.sql']) {
  await db.exec(read(f));
}

const U = (n) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const q = async (sql, args) => (await db.query(sql, args)).rows;
const prof = async (id) => (await q('select * from profiles where id=$1', [id]))[0];

// 全員ぶんの土台を作る（あとで1人ずつ条件を振る）
for (let i = 1; i <= 12; i++) {
  await db.query(
    `insert into profiles(id,email,name,country,email_opt_in,mail_optin,last_pay_report_at,
                          pay_report_count,pay_streak_months,pay_day_of_month,access_until)
     values($1,$2,$3,'日本',true,true, now() - interval '2 months', 3, 3, 1, now() + interval '40 days')`,
    [U(i), `p${i}@example.com`, `テスト ${i}`],
  );
}

// ════════════════════════════════════════════════════════════════
sec('① 同意の旗が食い違えないこと（本丸）');
// ════════════════════════════════════════════════════════════════

// 1-1. profile.html は profiles を直接 update する。その経路でも子が落ちる
await db.query('update profiles set email_opt_in=false where id=$1', [U(1)]);
{
  const p = await prof(U(1));
  ok(p.email_opt_in === false && p.mail_optin === false,
    'email_opt_in を直接 false にすると mail_optin も落ちる（profile.html の経路）');
}

// 1-2. 解除リンク（unsubscribe.html → unsubscribe RPC）でも落ちる
await q('select public.unsubscribe((select unsub_token from profiles where id=$1))', [U(2)]);
{
  const p = await prof(U(2));
  ok(p.email_opt_in === false && p.mail_optin === false,
    'unsubscribe(p_token) 1回で両方 false になる（＝ワンクリックで全部止まる）');
}

// 1-3. 再開しても、止めてくれと言われたリマインドは勝手に戻さない
await q('select public.resubscribe((select unsub_token from profiles where id=$1))', [U(2)]);
{
  const p = await prof(U(2));
  ok(p.email_opt_in === true && p.mail_optin === false,
    'resubscribe は親だけ戻す（リマインドは本人が入れ直す）');
}

// 1-4. リマインドを自分でオンにしたら、親の同意も立つ（無言の失敗を作らない）
await db.query('update profiles set email_opt_in=false, mail_optin=false, email_opt_in_at=null where id=$1', [U(3)]);
await db.exec(`set pv.uid = '${U(3)}'`);
await q('select public.set_mail_optin(true)');
{
  const p = await prof(U(3));
  ok(p.mail_optin === true && p.email_opt_in === true,
    'set_mail_optin(true) は email_opt_in も立てる（オンなのに一通も来ない状態を作らない）');
  ok(p.email_opt_in_at !== null && p.mail_optin_at !== null, '同意した時刻が両方とも残る');
}

// 1-5. 逆はしない。リマインドを切っても他のメールまで止めない
await q('select public.set_mail_optin(false)');
{
  const p = await prof(U(3));
  ok(p.mail_optin === false && p.email_opt_in === true,
    'set_mail_optin(false) は親に触らない（他の配信まで勝手に止めない）');
}
await db.exec(`set pv.uid = ''`);

// 1-6. 既に食い違っている行を直すバックフィルが効く
await db.query('update profiles set mail_optin=true where id=$1', [U(1)]);   // 親は false のまま
{
  const before = await prof(U(1));
  ok(before.mail_optin === true && before.email_opt_in === false, '（前提）食い違った行を作れた');
}
await db.exec(`update public.profiles set mail_optin = false
                where mail_optin and not coalesce(email_opt_in, false);`);
{
  const p = await prof(U(1));
  ok(p.mail_optin === false, '既存の食い違い行はバックフィルで揃う');
}

// 1-7. 食い違いが1行も残らないこと（pay-reminder.sql の検算 6-1 と同じ）
{
  const r = await q(`select count(*)::int n from profiles
                      where coalesce(mail_optin,false) and not coalesce(email_opt_in,false)`);
  ok(r[0].n === 0, '解除済みなのにリマインドが残っている人が0人');
}

// ════════════════════════════════════════════════════════════════
sec('② 誰に送るか（境界を全部踏む）');
// ════════════════════════════════════════════════════════════════
const dueIds = async () => (await q('select id from public.pv_reminder_due(2000)')).map((r) => r.id);

// 土台に戻す（1〜3 は上でいじったので除外して考える）
for (let i = 4; i <= 12; i++) {
  await db.query(
    `update profiles set email_opt_in=true, mail_optin=true,
       last_pay_report_at = now() - interval '2 months',
       mail_last_sent_at = null, pay_day_of_month = 1
     where id=$1`, [U(i)]);
}

ok((await dueIds()).includes(U(4)), '同意あり・投稿実績あり・給料日到来・今月未投稿・今月未送信 → 送る');

await db.query('update profiles set mail_optin=false where id=$1', [U(5)]);
ok(!(await dueIds()).includes(U(5)), 'リマインド同意が無い人には送らない');

await db.query('update profiles set email_opt_in=false where id=$1', [U(6)]);
ok(!(await dueIds()).includes(U(6)), 'メール同意（親）が無い人には送らない');

await db.query('update profiles set last_pay_report_at=null where id=$1', [U(7)]);
ok(!(await dueIds()).includes(U(7)), '一度も明細を出していない人には送らない（獲得メールにしない）');

await db.query('update profiles set last_pay_report_at=now() where id=$1', [U(8)]);
ok(!(await dueIds()).includes(U(8)), '今月もう出した人には催促しない');

await db.query('update profiles set mail_last_sent_at=now() where id=$1', [U(9)]);
ok(!(await dueIds()).includes(U(9)), '今月もう送った人には二度送らない（cron が二度走っても1通）');

await db.query(`update profiles set mail_last_sent_at = date_trunc('month', current_date) - interval '1 day'
                 where id=$1`, [U(10)]);
ok((await dueIds()).includes(U(10)), '先月送った人は今月また送る');

await db.query('update profiles set email=null where id=$1', [U(11)]);
ok(!(await dueIds()).includes(U(11)), 'メールアドレスが無い人は落とす');
await db.query(`update profiles set email='not-an-email' where id=$1`, [U(11)]);
ok(!(await dueIds()).includes(U(11)), '@ が無いアドレスは落とす');

// 送信記録
{
  const before = (await prof(U(4))).mail_last_sent_at;
  const n = (await q('select public.pv_reminder_mark_sent($1::uuid[]) n', [[U(4)]]))[0].n;
  const after = (await prof(U(4))).mail_last_sent_at;
  ok(before === null && after !== null && n === 1, 'pv_reminder_mark_sent が送信時刻を刻む');
  ok(!(await dueIds()).includes(U(4)), '記録した直後から対象に出てこない');
  await db.query('update profiles set mail_last_sent_at=null where id=$1', [U(4)]);
}

// 解除した人は即座に対象から消える（①と②の接続）
await q('select public.unsubscribe((select unsub_token from profiles where id=$1))', [U(4)]);
ok(!(await dueIds()).includes(U(4)), '解除リンクを踏んだ人は、その瞬間から送信対象に出てこない');

// ════════════════════════════════════════════════════════════════
sec('③ 給料日（世界規模なので固定日にしない）');
// ════════════════════════════════════════════════════════════════
const todayDay = new Date().getUTCDate();

await db.query('update profiles set email_opt_in=true, mail_optin=true, pay_day_of_month=1 where id=$1', [U(12)]);
ok((await dueIds()).includes(U(12)), '1日払いの人は月の頭から対象になる');

await db.query('update profiles set pay_day_of_month=null where id=$1', [U(12)]);
{
  const day = (await q('select pay_day from public.pv_reminder_due(2000) where id=$1', [U(12)]))[0];
  const expect = todayDay >= 25;
  ok(!!day === expect, `給料日が未学習なら 25 を仮置き（今日は ${todayDay} 日なので ${expect ? '対象' : '対象外'}）`);
}

// 31日払いの丸め。「30日までの月に永久に取りこぼされない」ことを、
// 関数の中で使っている式そのものを取り出して12ヶ月ぶん確かめる。
{
  const src = read('db/pay-reminder.sql');
  const m = src.match(/extract\(day from \(date_trunc\('month', current_date\)[^)]*\)+::int/);
  ok(!!m, 'pv_reminder_due から「その月の日数」を出す式を取り出せた');
  const expr = m[0].replace('current_date', '$1::date');
  const DAYS = { '2026-01': 31, '2026-02': 28, '2026-03': 31, '2026-04': 30, '2028-02': 29 };
  let allOk = true;
  for (const [ym, n] of Object.entries(DAYS)) {
    const r = await q(`select ${expr} as d, least(31, ${expr}) as clamped`, [`${ym}-01`]);
    if (r[0].d !== n || r[0].clamped !== n) allOk = false;
  }
  ok(allOk, '31日払いは各月の末日に丸まる（2月=28/29・4月=30・うるう年も）');
}

// ════════════════════════════════════════════════════════════════
sec('④ 権限（会員名簿を外に開かない）');
// ════════════════════════════════════════════════════════════════
{
  const rows = await q(`select p.proname, coalesce(array_to_string(p.proacl::text[], ', '), '') acl
                          from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                         where n.nspname='public'
                           and p.proname in ('pv_reminder_due','pv_reminder_mark_sent','pv_reminder_unsub')`);
  ok(rows.length === 3, '送信系の関数が3本ある');
  for (const r of rows) {
    ok(!/(^|,)\s*anon=/.test(r.acl) && !/(^|,)\s*authenticated=/.test(r.acl),
      `${r.proname} は anon/authenticated に開いていない`);
    ok(/service_role=/.test(r.acl), `${r.proname} は service_role から呼べる`);
  }
}
{
  // my_pay_reports は同意を両方返す（UI が「オン」と言うのに送られない状態を作らない）
  const def = (await q(`select pg_get_functiondef(p.oid) d from pg_proc p
                          join pg_namespace n on n.oid=p.pronamespace
                         where n.nspname='public' and p.proname='my_pay_reports'`))[0].d;
  ok(/'mail_optin'/.test(def) && /'email_opt_in'/.test(def),
    'my_pay_reports が同意を2つとも返す');
}

// ════════════════════════════════════════════════════════════════
sec('⑤ メール本文（金額・会社名・明細の項目を出さない）');
// ════════════════════════════════════════════════════════════════
const fn = read('supabase/functions/remind-payslip/index.ts');
// 説明コメントに書いた「入れない理由」が禁止語に引っかからないよう、先に剥がす
const code = fn
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
ok(!/入れていない/.test(code) && /入れていない/.test(fn),
  'コメント剥がしが効いている（説明文は消え、原本には残っている）');

const BANNED = [
  [/usd_per_block_hour|annual_total|net_pay_actual|ytd_taxable|net_annual/, '報酬額の列名'],
  [/base_pay|command_pay|housing_amount|per_diem|bonus_annual|profit_share|deduction/, '明細の項目名'],
  // ★「英単語 airline を含むか」では測らない。EN の但し書きが
  //   "no airline name" と自分で言っているので、それに引っかかる。
  //   測りたいのは「会社名のデータに触っているか」なので、参照の形で見る。
  [/p\.airline|['"`]airline['"`]|airline_other/i, '会社名'],
  [/\bfleet\b|\bposition\b/i, '機材・職位'],
  [/[¥€£]|\$\s?[0-9]/, '通貨記号つきの数字'],
  [/時給|年収|万円|手取り/, '報酬額の日本語表現'],
  [/hourly|take-?home|salary|per block hour/i, '報酬額の英語表現'],
];
for (const [re, why] of BANNED) {
  ok(!re.test(code), `本文に ${why} が出てこない（${re}）`);
}

// 本人に届く値として許しているのは、報酬額でないものだけ
ok(/days_left/.test(code) && /streak_months/.test(code) && /report_count/.test(code),
  '出すのは残り日数・連続月数・累計枚数だけ');

// pv_reminder_due が返す列に、報酬額を1つも入れていない
{
  const cols = (await q(`select a.attname from pg_proc p
                           join pg_namespace n on n.oid=p.pronamespace,
                           unnest(p.proallargtypes) with ordinality t(typ,i)
                           join lateral (select p.proargnames[t.i] as attname) a on true
                          where n.nspname='public' and p.proname='pv_reminder_due'`)).map((r) => r.attname);
  ok(cols.length > 0 && !cols.some((c) => /pay(?!_day)|salary|amount|jpy|usd|hour|net_/.test(String(c))),
    `pv_reminder_due が報酬額の列を返さない（${cols.join(',')}）`);
}

// 但し書きを日英とも自分から言っている（言わずに済ませない）
ok(/金額・会社名・明細の項目は一切含めていません/.test(fn), 'JP の但し書きがある（何を入れていないかを明記）');
ok(/no amounts, no airline name and no payslip line items/.test(fn), 'EN の但し書きがある');

// 解除まわり
ok(/List-Unsubscribe['"]?\s*:/.test(code), 'List-Unsubscribe ヘッダを付けている');
ok(/List-Unsubscribe-Post/.test(code) && /One-Click/.test(code),
  'RFC 8058 のワンクリック解除（POST）に対応している');
ok(/unsubscribe\.html\?token=/.test(code), '本文の解除リンクが既存の解除ページを指している');
ok(/pv_reminder_unsub/.test(code), 'ワンクリック解除がサーバ側 RPC を呼んでいる');

// 入口の締まり
ok(/if\s*\(!CRON_SECRET\)\s*return/.test(code),
  'PV_CRON_SECRET が未設定なら動かない（入れ忘れで入口が全開にならない）');
ok(/x-pv-cron-secret/.test(code), '一斉送信の入口が共有秘密で塞がれている');
ok(/Idempotency-Key/.test(code), '同じ人・同じ月で二通にならない（Resend 側の冪等キー）');

// ログとレスポンスに名簿を出さない
ok(!/console\.(log|error)\([^)]*\.email/.test(code), 'ログにメールアドレスを出していない');
ok(!/console\.(log|error)\([^)]*\.name/.test(code), 'ログに氏名を出していない');
{
  const dry = code.match(/if \(dry\) return json\(\{[^}]*\}\)/);
  ok(!!dry && !/email|name|due:\s*due\b/.test(dry[0].replace('due: due.length', '')),
    'dry 実行のレスポンスに会員のメール・氏名が出ない');
}

// 送信の並びが正しい（送れた人だけ記録する）
ok(/sent\.push\(p\.id\)/.test(code) && /pv_reminder_mark_sent[^;]*sent/.test(code),
  '送信できた人だけ記録する（失敗した人は翌日また拾われる）');

// ════════════════════════════════════════════════════════════════
sec('⑥ 組み上がった本文（grep ではなく実物を組んで見る）');
// ════════════════════════════════════════════════════════════════
const { build } = await import('../supabase/functions/remind-payslip/index.ts');
const mk = (o) => build({
  id: 'x', email: 'x@example.com', unsub_token: 'tok-1', name: '高橋 蓮', country: '日本',
  pay_day: 25, streak_months: 3, report_count: 3,
  access_until: new Date(Date.now() + 40 * 86400000).toISOString(), days_left: 40, ...o,
});

{
  // 言語の見当。★このサイトの中心は「ドバイに住んでいる日本人パイロット」なので
  //   居住国だけで決めると日本語話者に英語が飛ぶ。
  ok(mk({ country: 'UAE' }).lang === 'ja', '氏名が日本語なら、居住国が UAE でも日本語で送る');
  ok(mk({ name: 'Alex Mercer', country: 'UAE' }).lang === 'en', '氏名が英字で居住国が海外なら英語');
  ok(mk({ name: 'Alex Mercer', country: '日本' }).lang === 'ja', '居住国が日本なら日本語');
  ok(mk({ name: null, country: 'イギリス' }).lang === 'en', '氏名が無くても落ちない');
}

{
  const cases = [
    mk({}), mk({ days_left: 5 }), mk({ days_left: 0, access_until: new Date(Date.now() - 86400000).toISOString() }),
    mk({ name: 'Alex Mercer', country: 'UAE' }), mk({ name: null, country: 'イギリス', days_left: 0 }),
  ];
  let money = 0, unsub = 0, escaped = 0;
  for (const m of cases) {
    if (/[¥€£]|\$\s?[0-9]/.test(m.html)) money++;
    if (m.html.includes('unsubscribe.html?token=tok-1')) unsub++;
    if (m.html.includes('<script') || /on\w+=/.test(m.html)) escaped++;
  }
  ok(money === 0, '組み上がった本文のどれにも通貨つきの数字が出ない');
  ok(unsub === cases.length, 'どの本文にも解除リンクが入っている');
  ok(escaped === 0, '本文にスクリプトやイベント属性が混ざらない');
}

{
  // ★氏名は件名にも本文にも1文字も出さない。
  //   4f11d6c で挨拶から外した。匿名で給与と職場のことを出してもらっているのに、
  //   こちらから氏名で呼ぶと受信箱と送信ログに「このアドレス＝この氏名」が残る。
  //   氏名は今も言語の見当にだけ使う（ひとつ上の節）。だから build には渡っている。
  //   渡っているものが出力に出ていないことを、組んだ実物で見る。
  //   ★実体参照を戻してから探す。挨拶が esc(p.name) で戻ると、素の形だけを見る検査は
  //     &lt;b&gt; を「氏名ではない」と見なして素通りする。二重に包まれても同じ。
  const unesc = (s) => {
    let t = String(s), prev;
    do { prev = t; t = t.replace(/&lt;/g, () => '<').replace(/&gt;/g, () => '>')
                       .replace(/&quot;/g, () => '"').replace(/&amp;/g, () => '&'); }
    while (t !== prev);
    return t;
  };
  const leaked = [];
  for (const name of ['高橋 蓮', 'Alex Mercer', '<b>hack</b>']) {
    const m = mk({ name });
    if (unesc(m.html).includes(name) || unesc(m.subject).includes(name)) leaked.push(name);
  }
  ok(leaked.length === 0, '★氏名が件名にも本文にも1文字も出ない（氏名で呼びかけない）'
    + (leaked.length ? ' — 出ていた: ' + leaked.join(' / ') : ''));
}

{
  const a = mk({ days_left: 0, access_until: new Date(Date.now() - 86400000).toISOString() });
  const b = mk({ days_left: 5 });
  const c = mk({ days_left: 40 });
  ok(/切れています/.test(a.html) && /切れています/.test(a.subject), '解放切れは件名でも本文でもそう言う');
  ok(/あと5日/.test(b.subject), '残り14日以内は件名で日数を出す');
  ok(!/あと40日/.test(c.subject), '余裕があるときは件名で急かさない');
  ok(a.html !== b.html && b.html !== c.html, '3つの状態で本文が違う');
}

// ════════════════════════════════════════════════════════════════
sec('⑦ マイページの2つのスイッチが食い違って見えないこと');
// ════════════════════════════════════════════════════════════════
{
  const tracker = read('pay-tracker.js');
  ok(/w\.PVRemindSync\s*=\s*function/.test(tracker), 'pay-tracker.js が PVRemindSync を公開している');
  ok(/PVOptInSync/.test(tracker), 'pay-tracker.js が親のスイッチに結果を伝えている');
  ok(!/PVRemindSync[\s\S]{0,400}?SB\.rpc/.test(tracker),
    'PVRemindSync は書きに行かない（DB が返した値に画面を合わせるだけ）');
  for (const f of ['profile.html', 'en/profile.html']) {
    const src = read(f);
    ok(/window\.PVOptInSync\s*=\s*function/.test(src), `${f} が PVOptInSync を公開している`);
    ok(/window\.PVRemindSync\s*===\s*'function'\s*\)\s*window\.PVRemindSync\(next\)/.test(src),
      `${f} がオフにしたときトラッカー側にも伝える`);
  }
}

// ════════════════════════════════════════════════════════════════
sec('⑧ 送るものと、送ると書いてあることが合っていること');
// ════════════════════════════════════════════════════════════════
{
  // 送信の実装を変えたのに personal-data.html を直し忘れる、が一番起きやすい。
  // 「既定オフ」「金額を入れない」「解除できる」「Resend を経由する」の4点を両言語で見る。
  const pages = [
    ['personal-data.html', [
      [/既定でオフ/, '既定はオフだと書いてある'],
      [/金額は<b>一切書きません|金額は\s*<b>一切|<b>金額は一切書きません/, '金額を入れないと書いてある'],
      [/配信を停止する/, '止めかたが書いてある'],
      [/Resend/, 'Resend を経由することを開示している'],
      [/推定した給料日/, '給料日を推定して保存することを開示している'],
    ]],
    ['en/personal-data.html', [
      [/off by default/i, '既定はオフだと書いてある'],
      [/no amounts at all/i, '金額を入れないと書いてある'],
      [/Unsubscribe/, '止めかたが書いてある'],
      [/Resend/, 'Resend を経由することを開示している'],
      [/pay day estimated from it/i, '給料日を推定して保存することを開示している'],
    ]],
  ];
  for (const [f, checks] of pages) {
    const src = read(f);
    for (const [re, msg] of checks) ok(re.test(src), `${f}：${msg}`);
  }
}

console.log('\n' + '─'.repeat(60));
console.log(`${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
