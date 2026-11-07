/* db/test-welcome.mjs — 登録した会員への歓迎メール（db/welcome-mail.sql ＋ supabase/functions/welcome-member）

   実行: node db/test-welcome.mjs   ネットワーク不要・本番に一切触らない（PGlite = PG17 の WASM）。

   見ていること
     A) 誰に送るか（SQL）── 通知を希望・会員になった（登録画面を終えた か 給与を出した）・72時間以内・まだ送っていない人だけ。
        1人1回（送れたら二度と選ばない・3回失敗したら諦める）。会員からは呼べない・表も読めない。
        打ち込まれた社名を関数に渡さない。退会したら記録も消える。何度貼っても同じ。
        壊す証明：条件を1つ外すと、送ってはいけない人が選ばれる＝この検査が赤くなる。
     B) 文面（Edge Function の本物を import）── 何語で送るか（言語が無い人は週まとめと同じ答え）・
        「90日間」がサイトの登録完了画面と同じ日数・行き先のページが本当にある・
        出してもらうボタンは給与の1つだけ・「匿名で」が付いている・
        日が経つと嘘になる数字を書いていない・解除の口がある。
        ★日本語の文はオーナーが書いたもの（2026-11-07）。ここでは字を縛らない（直すのはオーナー）。 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, existsSync } from 'fs';
import { buildWelcome, welcomeCopy, welcomeLangOf } from '../supabase/functions/welcome-member/index.ts';
import { digestLangOf } from '../supabase/functions/weekly-digest/index.ts';

const ROOT = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, ROOT), 'utf8');
const SQL = read('db/welcome-mail.sql');

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/* 器：本番の profiles のうち、このファイルが触る列だけ。社名の語彙は最小の代役
   （本物の pv_airline_resolve は週まとめの検査が見ている。ここで見たいのは「地域だけを渡す」こと）。 */
async function fresh({ withLang = true, withPay = true } = {}) {
  const db = new PGlite();
  await db.waitReady;
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    grant usage on schema public to anon, authenticated, service_role;
    /* ★本番（Supabase）と同じく、新しい表・関数は最初から全員に開いている。
       だからこそ welcome-mail.sql の revoke が意味を持つ。 */
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    create table public.profiles (
      id uuid primary key, email text, name text, country text, company text, "position" text,
      email_opt_in boolean not null default false,
      unsub_token uuid not null default gen_random_uuid(),
      created_at timestamptz not null default now()
      ${withLang ? ', lang text' : ''}
      ${withPay ? ', pay_report_count int not null default 0' : ''}
    );
    create table public.pv_airlines (code text primary key, region text);
    insert into public.pv_airlines values ('emirates', 'mideast'), ('ana', 'japan');
    create function public.pv_airline_resolve(t text) returns text language sql stable as $$
      select coalesce((select a.code from public.pv_airlines a where a.code = lower(btrim(t))), 'other') $$;
  `);
  return db;
}

/* 人を1人入れる。既定は「送る相手」になる形（希望・登録済み・1時間前・日本語）。 */
const person = (db, n, o = {}) => db.query(
  `insert into profiles(id,email,name,country,company,"position",email_opt_in,created_at,lang,pay_report_count)
   values($1,$2,$3,$4,$5,$6,$7, now() - ($8 || ' hours')::interval, $9, $10)`,
  [uid(n), o.email ?? `p${n}@example.com`, o.name ?? null,
   'country' in o ? o.country : '日本', 'company' in o ? o.company : 'ana',
   'position' in o ? o.position : 'captain', o.opt ?? true, String(o.hoursAgo ?? 1),
   'lang' in o ? o.lang : 'ja', o.pay ?? 0]);

const asOwner = (db) => db.exec('reset role');
const dueIds = async (db, limit = 200) => {
  await asOwner(db);
  return (await db.query('select id from pv_welcome_due($1)', [limit])).rows.map((r) => r.id);
};
const mark = async (db, n, okv) => (await db.query('select pv_welcome_mark($1, $2) as t', [uid(n), okv])).rows[0].t;

/* ════════════════════ A) 誰に送るか ════════════════════ */
console.log('\n▼ A-1 貼る');
{
  const bare = await fresh({ withLang: false });
  let msg = '';
  try { await bare.exec(SQL); } catch (e) { msg = e.message; }
  ok(/profile-lang\.sql/.test(msg), 'profiles.lang が無ければ「先に profile-lang.sql」と言って止まる', msg);
  const noPay = await fresh({ withPay: false });
  msg = '';
  try { await noPay.exec(SQL); } catch (e) { msg = e.message; }
  ok(/pay-reports\.sql/.test(msg), 'profiles.pay_report_count が無ければ「先に pay-reports.sql」と言って止まる', msg);
}
const db = await fresh();
try { await db.exec(SQL); ok(true, 'welcome-mail.sql が流れる'); } catch (e) { ok(false, 'welcome-mail.sql が流れる', e.message); process.exit(1); }
try { await db.exec(SQL); ok(true, 'もう一度貼っても同じ（冪等）'); } catch (e) { ok(false, '再適用で失敗', e.message); }

console.log('\n▼ A-2 送る相手');
await person(db, 1);                                            // 送る
await person(db, 2, { opt: false });                            // 通知を外した
await person(db, 3, { company: null });                         // 登録の途中（在籍企業が空）
await person(db, 4, { country: '  ' });                         // 登録の途中（居住国が空白だけ）
await person(db, 5, { position: null });                        // 登録の途中（職位が空）
await person(db, 6, { hoursAgo: 80 });                          // 72時間より前の会員
await person(db, 7, { email: 'nope' });                         // アドレスの形でない
await person(db, 8, { hoursAgo: 71 });                          // 72時間の内側
await person(db, 9, { lang: null, country: 'UAE', company: 'emirates' });  // 言語が残っていない人
await person(db, 10, { company: 'ヒミツ航空' });                // 語彙に無い社名
const blank = { country: null, company: null, position: null, lang: null };
await person(db, 11, { ...blank, pay: 1 });                     // 給与フォームから入った人（メールだけで会員・給与を出した）
await person(db, 12, { ...blank, pay: 1, opt: false });         // 同じだが、メールを受け取る印を外した
let due = await dueIds(db);
const has = (n) => due.includes(uid(n));
ok(has(1) && has(8) && has(9) && has(10), '希望・登録済み・72時間以内の人が選ばれる');
ok(!has(2), '通知を外した人には送らない');
ok(!has(3) && !has(4) && !has(5), '登録を終えていない人には送らない（居住国・在籍企業・職位のどれかが空）');
ok(!has(6), '72時間より前に登録した人には送らない（初めて動かした日に全員へ飛ばない）');
ok(!has(7), 'アドレスの形でないものには送らない');
ok(has(11), '給与フォームから入った人（居住国・在籍企業・職位が空でも、給与を出した）には送る');
ok(!has(12), '給与を出していても、メールを受け取る印を外した人には送らない');
{
  const order = (await db.query('select id from pv_welcome_due(200)')).rows.map((r) => r.id);
  ok(order[0] === uid(8), 'いちばん先に登録した人が先頭', order.join(','));
  ok((await db.query('select id from pv_welcome_due(1)')).rows.length === 1, '1回に送る上限が効く');
}

console.log('\n▼ A-3 渡す中身');
{
  const r = (await db.query('select * from pv_welcome_due(200)')).rows;
  const keys = Object.keys(r[0]).sort().join(',');
  ok(keys === 'airline_region,country,email,gave_pay,id,lang,name,unsub_token', '返す鍵はこの8つだけ（社名そのものは渡さない）', keys);
  ok(r.find((x) => x.id === uid(11))?.gave_pay === true && r.find((x) => x.id === uid(8))?.gave_pay === false,
    '給与を出したかどうかを渡す（文面のお願いを替えるため）');
  const p9 = r.find((x) => x.id === uid(9)); const p10 = r.find((x) => x.id === uid(10));
  ok(p9?.airline_region === 'mideast', '勤務先は語彙に寄せた地域だけになる');
  ok(p10?.airline_region === '' && !JSON.stringify(r).includes('ヒミツ'), '語彙に無い社名は1文字も出ない');
  ok(p9?.lang === null && r.find((x) => x.id === uid(1))?.lang === 'ja', '登録した画面の言語を渡す（無い人は空）');
  ok(typeof r[0].unsub_token === 'string' && r[0].unsub_token.length === 36, '解除の鍵を文字で渡す');
}

console.log('\n▼ A-4 1人1回');
ok(await mark(db, 1, true) === 1, '送れたら記録する');
due = await dueIds(db);
ok(!due.includes(uid(1)), '送れた人は二度と選ばない');
ok(await mark(db, 1, false) === 2 && (await db.query('select sent_at from pv_welcome_mail where id=$1', [uid(1)])).rows[0].sent_at,
  'あとで失敗を記録しても「送った」は消えない');
await mark(db, 8, false); await mark(db, 8, false);
ok((await dueIds(db)).includes(uid(8)), '2回失敗した人は、もう1回試す');
await mark(db, 8, false);
ok(!(await dueIds(db)).includes(uid(8)), '3回失敗したら諦める（壊れたアドレスに打ち続けない）');
ok(await mark(db, 999, true) === null && (await db.query('select count(*)::int n from pv_welcome_mail where id=$1', [uid(999)])).rows[0].n === 0,
  '退会してもう居ない人には何も書かない');
await db.query('delete from profiles where id = $1', [uid(1)]);
ok((await db.query('select count(*)::int n from pv_welcome_mail where id=$1', [uid(1)])).rows[0].n === 0,
  '退会したら、送った記録も一緒に消える');

console.log('\n▼ A-5 会員からは触れない');
for (const role of ['anon', 'authenticated']) {
  await db.exec(`set role ${role}`);
  let e1 = '', e2 = '', e3 = '';
  try { await db.query('select * from pv_welcome_due(10)'); } catch (e) { e1 = e.message; }
  try { await db.query('select pv_welcome_mark($1, true)', [uid(9)]); } catch (e) { e2 = e.message; }
  try { await db.query('select * from pv_welcome_mail'); } catch (e) { e3 = e.message; }
  ok(/permission denied/.test(e1), `${role}: 送る相手の一覧を呼べない`, e1);
  ok(/permission denied/.test(e2), `${role}: 記録を書けない`, e2);
  ok(/permission denied/.test(e3), `${role}: 記録の表を読めない`, e3);
  await asOwner(db);
}
await db.exec('set role service_role');
{
  let e = '';
  try { await db.query('select * from pv_welcome_due(10)'); } catch (x) { e = x.message; }
  ok(e === '', 'service_role（Edge Function）は呼べる', e);
}
await asOwner(db);
ok((await db.query(`select count(*)::int n from pg_policies where tablename='pv_welcome_mail'`)).rows[0].n === 0,
  '記録の表にポリシーが1つも無い');
{
  const r = (await db.query(`select 検算 from (${SQL.slice(SQL.lastIndexOf('select case when to_regclass')).trim().replace(/;$/, '')}) t`)).rows.map((x) => x['検算']);
  ok(r.length === 5 && r.filter((s) => s.startsWith('❌')).length === 0, 'ファイル末尾の検算に ❌ が無い', r.join(' / '));
}

console.log('\n▼ A-6 壊す証明（条件を1つ外すと、送ってはいけない人が選ばれる）');
const MUTANTS = [
  ['     and w.sent_at is null\n', '', '送った人を外す条件', (ids) => ids.includes(uid(1))],
  ['   where coalesce(p.email_opt_in, false)\n', '   where true\n', '通知を外した人を外す条件', (ids) => ids.includes(uid(2))],
  ["     and p.created_at > now() - interval '72 hours'\n", '', '72時間の条件', (ids) => ids.includes(uid(6))],
  ['\n          or coalesce(p.pay_report_count, 0) > 0)', ')', '「給与を出した人も会員」の条件', (ids) => !ids.includes(uid(11))],
];
for (const [cut, put, label, broke] of MUTANTS) {
  ok(SQL.includes(cut), `（${label}が SQL にある）`);
  const m = await fresh();
  const mutated = SQL.replace(cut, () => put);
  await m.exec(mutated);
  await person(m, 1); await person(m, 2, { opt: false }); await person(m, 6, { hoursAgo: 80 });
  await person(m, 11, { country: null, company: null, position: null, pay: 1 });
  await m.query('select pv_welcome_mark($1, true)', [uid(1)]);
  ok(broke(await dueIds(m)), `${label}を外すと、この検査が赤くなる`);
}

/* ════════════════════ B) 文面 ════════════════════ */
console.log('\n▼ B-1 何語で送るか');
ok(welcomeLangOf({ lang: 'ja', country: 'UAE' }) === 'ja', '日本語のページで登録 → 日本語（海外に住んでいても）');
ok(welcomeLangOf({ lang: 'es', country: '日本' }) === 'es', 'スペイン語のページで登録 → スペイン語');
ok(welcomeLangOf({ lang: 'en', country: '日本' }) === 'both', '英語のページで登録 → 英語が上・日本語が下');
const NOLANG = [
  { name: '高橋 蓮', country: 'UAE' }, { name: 'Alex Mercer', country: '日本' }, { name: null, country: 'UAE' },
  { name: null, country: null, airline_region: 'japan' }, { name: null, country: null, airline_region: 'mideast' },
  { name: null, country: null }, { name: 'Ren Aoki', country: '' },
];
ok(NOLANG.every((p) => welcomeLangOf({ ...p, lang: null }) === digestLangOf(p)),
  '言語が残っていない人は、週まとめと同じ答え（写しがずれていない）');

console.log('\n▼ B-2 「90日間」がサイトと同じ日数');
/* 登録完了画面の #success-lead が言う日数（ja「90日間」/ en「for 90 days」/ es「durante 90 días」）。 */
const DAYS_RE = { ja: /(\d+)日間/, en: /for (\d+) days/, es: /durante (\d+) días/ };
const SIGNUP = { ja: 'signup.html', en: 'en/signup.html', es: 'es/signup.html' };
for (const l of ['ja', 'en', 'es']) {
  const leadHtml = (read(SIGNUP[l]).match(/<span id="success-lead">([\s\S]*?)<\/span>/) || [])[1] || '';
  const site = (leadHtml.replace(/<[^>]+>/g, '').match(DAYS_RE[l]) || [])[1];
  const mail = (welcomeCopy(l, 'https://pilot-value.com').ask.t.match(DAYS_RE[l]) || [])[1];
  ok(site && mail === site, `${l}: メールの日数（${mail}）＝ ${SIGNUP[l]} の日数（${site}）`);
}

console.log('\n▼ B-3 組み上がったメール');
const SITE_URL = 'https://pilot-value.com';
const who = { id: uid(1), unsub_token: '11111111-2222-4333-8444-555555555555' };
for (const lang of ['ja', 'en', 'es', 'both']) {
  const m = buildWelcome(who, { lang, siteUrl: SITE_URL, supabaseUrl: 'https://example.supabase.co' });
  const langs = lang === 'both' ? ['en', 'ja'] : [lang];
  ok(m.subject && m.html && m.text, `${lang}: 件名・本文（HTML と文字だけの版）がそろう`);
  const every = langs.map((l) => welcomeCopy(l, SITE_URL)).flatMap((t) =>
    [...t.lead, ...t.body.flat(), t.ask.lead, t.ask.t, t.ask.note, ...t.close, t.sign]);
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const lost = every.filter((s) => !m.html.includes(esc(s)) || !m.text.includes(s));
  ok(lost.length === 0, `${lang}: 文面の全部の文が HTML にも文字だけの版にも入っている`, lost.join(' / '));
  const buttons = (m.html.match(/display:inline-block;background:#f5c842/g) || []).length;
  ok(buttons === langs.length, `${lang}: 出してもらうボタンは給与の1つだけ（言語ごと）`, `ボタン ${buttons}`);
  ok(m.html.includes(`unsubscribe.html?token=${who.unsub_token}`) && m.oneClickUrl.endsWith(`?u=${who.unsub_token}`),
    `${lang}: 配信停止の口がある（本文のリンクと受信箱のワンクリック）`);
  const hrefs = [...m.html.matchAll(/href="([^"]+)"/g)].map((x) => x[1].replace(/&amp;/g, '&'));
  const missing = hrefs.filter((h) => h.startsWith(SITE_URL + '/'))
    .map((h) => h.slice(SITE_URL.length + 1).split(/[?#]/)[0] || 'index.html')
    .filter((f) => !existsSync(new URL(f, ROOT)));
  ok(missing.length === 0, `${lang}: 行き先のページが全部ある`, missing.join(', '));
  if (lang === 'both') {
    const en = welcomeCopy('en', SITE_URL).lead[0], ja = welcomeCopy('ja', SITE_URL).lead[0];
    ok(m.html.indexOf(esc(en)) < m.html.indexOf(esc(ja)), 'both: 英語が上・日本語が下');
  }
  if (lang === 'es') ok(hrefs.some((h) => h.includes('/es/pay-report.html#ps')), 'es: 給与のボタンはスペイン語のフォームへ');
  if (lang === 'en') ok(hrefs.some((h) => h.includes('/en/pay-report.html#ps')), 'en: 給与のボタンは英語のフォームへ');
  if (lang === 'ja') ok(hrefs.some((h) => h === `${SITE_URL}/pay-report.html#ps`), 'ja: 給与のボタンは日本語のフォームへ');
}
console.log('\n▼ B-4 もう給与を出した人には、お願いを口コミに替える');
for (const lang of ['ja', 'en', 'es', 'both']) {
  const m = buildWelcome({ ...who, gave_pay: true }, { lang, siteUrl: SITE_URL, supabaseUrl: 'https://example.supabase.co' });
  const hrefs = [...m.html.matchAll(/href="([^"]+)"/g)].map((x) => x[1]);
  ok(hrefs.some((h) => /\/submit-review\.html$/.test(h)) && !hrefs.some((h) => h.includes('pay-report.html')),
    `${lang}: ボタンは口コミの投稿へ（給与のフォームへは送らない）`);
  ok((m.html.match(/display:inline-block;background:#f5c842/g) || []).length === (lang === 'both' ? 2 : 1), `${lang}: ボタンは1つだけ（言語ごと）`);
  const missing = hrefs.filter((h) => h.startsWith(SITE_URL + '/'))
    .map((h) => h.slice(SITE_URL.length + 1).split(/[?#]/)[0] || 'index.html')
    .filter((f) => !existsSync(new URL(f, ROOT)));
  ok(missing.length === 0, `${lang}: 行き先のページが全部ある`, missing.join(', '));
}
{
  const a = welcomeCopy('ja', SITE_URL, false), b = welcomeCopy('ja', SITE_URL, true);
  ok(JSON.stringify({ ...a, ask: 0 }) === JSON.stringify({ ...b, ask: 0 }), 'ja: 替わるのは囲みの中だけ（オーナーの文はそのまま）');
  ok(buildWelcome({ ...who, gave_pay: null }, { lang: 'ja', siteUrl: SITE_URL }).html.includes('pay-report.html'),
    '給与を出したか分からない人には、今までどおり給与のお願い');
}
for (const l of ['ja', 'en', 'es']) for (const gp of [false, true]) {
  const t = welcomeCopy(l, SITE_URL, gp);
  const anon = { ja: /^匿名で/, en: /anonymously$/, es: /de forma anónima$/ }[l];
  ok(anon.test(t.ask.cta.label), `${l}${gp ? '（給与を出した人）' : ''}: 出すボタンに「匿名で」が付いている`, t.ask.cta.label);
  const words = [t.subject, ...t.lead, ...t.body.flat(), t.ask.thanks || '', t.ask.lead, t.ask.t, t.ask.cta.label, t.ask.note,
    ...t.close, t.sign, t.foot].join(' ');
  const nums = [...new Set(words.match(/\d+/g) || [])].sort();
  ok(nums.every((n) => n === '1' || n === '90'), `${l}: 日が経つと嘘になる数字を書いていない（あるのは「1件」と「90日」だけ）`, nums.join(','));
  ok(!/DEEP PAY|VERIFIED PAY/.test(words), `${l}: 閉じているものを約束しない`);
}

console.log(`\n${fail ? '❌' : '✅'} ${pass} 件 OK${fail ? ` / ${fail} 件 NG` : ''}`);
process.exit(fail ? 1 : 0);
