/* db/test-welcome-followup.mjs — 登録だけで止まっている会員への2通目（db/welcome-followup.sql ＋ welcome-member の2段目）

   実行: node db/test-welcome-followup.mjs   ネットワーク不要・本番に一切触らない（PGlite = PG17 の WASM・fetch は差し替え）。

   見ていること（2026-11-07 オーナー採用「登録だけで止まっている人への2通目」・登録から3日後）
     A) 誰に送るか（SQL）── 通知を希望・歓迎メールを受け取って2日以上・登録から3〜10日・給与をまだ出していない・
        確認待ちで止めていない・1人1回（送れたら二度と選ばない・3回失敗したら諦める）。会員からは呼べない・表も読めない。
        打ち込まれた社名は返さない（語彙の会社コードと表の名前だけ）。退会したら記録も消える。何度貼っても同じ。
        壊す証明：給与の条件を外すと、出した人が選ばれる＝この検査が赤くなる。
     B) 文面（本物の index.ts を import）── 会社のページへのリンクの先が本当にある（日英西・年収を載せている全社）・
        会社が分からない人は一覧へ・ボタンは給与の1つだけ・「匿名で」・「90日間」は歓迎メールと同じ日数・ほかの数字を書かない・解除の口。
     C) 送る処理 ── 2通目は welcome2:<id> の鍵で1通・記録する・口がまだ無い（SQL を貼る前）なら飛ばして歓迎メールは今までどおり。 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, existsSync } from 'fs';

const ROOT = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, ROOT), 'utf8');
const WELCOME = read('db/welcome-mail.sql');
const SQL = read('db/welcome-followup.sql');

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function fresh({ proof = true, welcome = true } = {}) {
  const db = new PGlite();
  await db.waitReady;
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    create table public.profiles (
      id uuid primary key, email text, name text, country text, company text, "position" text,
      email_opt_in boolean not null default false,
      unsub_token uuid not null default gen_random_uuid(),
      created_at timestamptz not null default now(), lang text, pay_report_count int not null default 0);
    create table public.pv_airlines (code text primary key, name_ja text not null, name_en text not null, region text not null,
      active boolean not null default true, cap_lo int);
    insert into public.pv_airlines values ('ana','全日本空輸（ANA）','All Nippon Airways (ANA)','japan',true,2200),
      ('ops-co','運航会社','Ops Co','asia',true,null), ('gone','終わった会社','Gone Air','asia',false,1000), ('other','その他','Other','other',true,null);
    create function public.pv_airline_resolve(t text) returns text language sql stable as $$
      select coalesce((select a.code from public.pv_airlines a where a.code = lower(btrim(t))), 'other') $$;
    ${proof ? `create table public.pv_proof (user_id uuid primary key, state text not null);` : ''}
  `);
  if (welcome) await db.exec(WELCOME);
  return db;
}
/* 既定は「送る相手」：希望・登録4日前・歓迎メールを3日前に受け取った・給与なし・ANA・日本語 */
async function person(db, n, o = {}) {
  await db.query(`insert into profiles(id,email,country,company,"position",email_opt_in,created_at,lang,pay_report_count)
     values($1,$2,'日本',$3,'captain',$4, now() - ($5 || ' hours')::interval,$6,$7)`,
    [uid(n), `p${n}@example.com`, 'company' in o ? o.company : 'ana', o.opt ?? true, String(o.hoursAgo ?? 96), o.lang ?? 'ja', o.pay ?? 0]);
  if (o.welcome !== false) {
    await db.query(`insert into pv_welcome_mail(id, sent_at, tries) values($1, now() - ($2 || ' hours')::interval, 1)`,
      [uid(n), String(o.welcomeHoursAgo ?? 72)]);
  }
  if (o.proof) await db.query(`insert into pv_proof(user_id, state) values($1,$2)`, [uid(n), o.proof]);
}
const due = async (db) => { await db.exec('reset role'); return (await db.query('select * from pv_welcome_followup_due(200)')).rows; };
const ids = async (db) => (await due(db)).map((r) => r.id);

/* ════════════════════ A) 誰に送るか ════════════════════ */
console.log('\n▼ A-1 貼る');
{
  const noW = await fresh({ welcome: false });
  let msg = ''; try { await noW.exec(SQL); } catch (e) { msg = e.message; }
  ok(/welcome-mail\.sql/.test(msg), '歓迎メールの記録が無ければ「先に welcome-mail.sql」と言って止まる', msg);
  const noP = await fresh({ proof: false });
  msg = ''; try { await noP.exec(SQL); } catch (e) { msg = e.message; }
  ok(/pilot-proof\.sql/.test(msg), 'pv_proof が無ければ「先に pilot-proof.sql」と言って止まる', msg);
}
const db = await fresh();
try { await db.exec(SQL); ok(true, 'welcome-followup.sql が流れる'); } catch (e) { ok(false, '流れる', e.message); process.exit(1); }
try { await db.exec(SQL); ok(true, 'もう一度貼っても同じ（冪等）'); } catch (e) { ok(false, '再適用で失敗', e.message); }
const checks = (await db.query(SQL.slice(SQL.indexOf("select case when to_regclass('public.pv_welcome_followup')")))).rows.map((r) => r['検算']);
ok(checks.filter((c) => c.startsWith('✅')).length === 3 && !checks.some((c) => c.startsWith('❌')), '末尾の検算が全部 ✅', checks.join(' / '));

console.log('\n▼ A-2 送る相手');
await person(db, 1);                                         // 送る
await person(db, 2, { opt: false });                         // 通知を外した
await person(db, 3, { welcome: false });                     // 歓迎メールを受け取っていない（今までの会員）
await person(db, 4, { welcomeHoursAgo: 30 });                // 歓迎メールから2日たっていない
await person(db, 5, { hoursAgo: 60, welcomeHoursAgo: 50 });  // 登録から3日たっていない
await person(db, 6, { hoursAgo: 250 });                      // 登録から10日より前
await person(db, 7, { pay: 1 });                             // 給与を出した
await person(db, 8, { proof: 'required' });                  // 確認待ちで止めた（求めている）
await person(db, 9, { proof: 'submitted' });                 // 確認待ちで止めた（出して待っている）
await person(db, 10, { proof: 'approved' });                 // 確認が済んだ → 送る
await person(db, 11, { company: 'Foo Air 123' });            // 打ち込まれた社名（語彙に当たらない）→ 送る・会社なし
await person(db, 12, { company: 'ops-co' });                 // 年収を載せていない会社 → 送る・ページなし
await person(db, 13, { company: 'gone' });                   // 今は無い会社 → 送る・会社なし
await db.query(`update pv_welcome_mail set sent_at = null, tries = 3 where id = $1`, [uid(5)]);   // （5 は元々外れる）
let got = await ids(db);
const want = [1, 10, 11, 12, 13].map(uid);
ok(JSON.stringify([...got].sort()) === JSON.stringify([...want].sort()), '送るのは 1・10・11・12・13 だけ（希望・歓迎メールから2日・登録3〜10日・給与なし・止めていない）',
   JSON.stringify(got));
const rows = await due(db);
const r1 = rows.find((r) => r.id === uid(1)), r11 = rows.find((r) => r.id === uid(11)), r12 = rows.find((r) => r.id === uid(12)), r13 = rows.find((r) => r.id === uid(13));
ok(r1 && r1.airline === 'ana' && r1.airline_ja === '全日本空輸（ANA）' && r1.airline_en === 'All Nippon Airways (ANA)' && r1.airline_page === true,
   '会社が分かる人：会社コード・表の名前（日英）・ページあり', JSON.stringify(r1));
ok(r11 && r11.airline === null && r11.airline_page === false, '語彙に当たらない社名：会社なし・ページなし');
ok(!JSON.stringify(rows).includes('Foo Air'), '打ち込まれた社名は1文字も返さない');
ok(r12 && r12.airline === 'ops-co' && r12.airline_page === false, '年収を載せていない会社：ページなし（リンクを作らない）');
ok(r13 && r13.airline === null, '今は無い会社（active でない）：会社なし');
ok(Object.keys(rows[0]).join(',') === 'id,email,name,country,airline_region,lang,unsub_token,airline,airline_ja,airline_en,airline_page',
   '返す欄はこれだけ（勤務先の打ち込みの字も、ほかの人の数も無い）', Object.keys(rows[0]).join(','));

console.log('\n▼ A-3 1人1回');
const mark = async (n, v) => (await db.query('select pv_welcome_followup_mark($1,$2) t', [uid(n), v])).rows[0].t;
ok(await mark(1, true) === 1, '送れたら記録（1回目）');
ok(!(await ids(db)).includes(uid(1)), '送れた人は二度と選ばない');
await mark(1, false);
ok((await db.query('select sent_at from pv_welcome_followup where id=$1', [uid(1)])).rows[0].sent_at !== null, 'あとで失敗を記録しても「送った」のまま');
await mark(10, false); await mark(10, false);
ok((await ids(db)).includes(uid(10)), '2回失敗：まだ選ぶ');
await mark(10, false);
ok(!(await ids(db)).includes(uid(10)), '3回失敗したら諦める');
ok((await db.query('select pv_welcome_followup_mark($1,true) t', [uid(999)])).rows[0].t === null
   && (await db.query('select count(*)::int n from pv_welcome_followup where id=$1', [uid(999)])).rows[0].n === 0, '居ない人には何も書かない');
await db.query('delete from profiles where id=$1', [uid(1)]);
ok((await db.query('select count(*)::int n from pv_welcome_followup where id=$1', [uid(1)])).rows[0].n === 0, '退会したら記録も消える');

console.log('\n▼ A-4 会員からは呼べない・読めない');
for (const role of ['anon', 'authenticated']) {
  await db.exec(`set role ${role}`);
  let denied = 0;
  for (const q of ['select * from pv_welcome_followup_due(5)', `select pv_welcome_followup_mark('${uid(11)}', true)`, 'select * from pv_welcome_followup']) {
    try { await db.query(q); } catch { denied++; }
  }
  await db.exec('reset role');
  ok(denied === 3, `${role} は送る相手も記録も取れない・書けない`);
}

console.log('\n▼ A-5 壊す証明');
{
  const bad = await fresh();
  await bad.exec(SQL.replace("     and coalesce(p.pay_report_count, 0) = 0\n", () => ''));
  await person(bad, 7, { pay: 1 });
  ok((await ids(bad)).includes(uid(7)), '給与の条件を外した版では、給与を出した人が選ばれる＝A-2 が赤くなる');
}

/* ════════════════════ B) 文面 ════════════════════ */
console.log('\n▼ B 文面');
const SUPA = 'https://example.supabase.test';
const ENV = { SUPABASE_URL: SUPA, SUPABASE_SERVICE_ROLE_KEY: 'svc', RESEND_API_KEY: 're', PV_CRON_SECRET: 'cron-secret' };
globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: () => {} };
const M = await import('../supabase/functions/welcome-member/index.ts');
const site = 'https://pilot-value.com';
const ana = { lang: 'ja', airline: 'ana', airline_ja: '全日本空輸（ANA）', airline_en: 'All Nippon Airways (ANA)', airline_page: true, unsub_token: 'tok' };
const none = { lang: 'ja', airline: null, airline_page: false, unsub_token: 'tok' };
const fileOf = (href) => href.replace(site + '/', '').split('#')[0].split('?')[0] || 'index.html';
for (const l of ['ja', 'en', 'es']) {
  const a = M.followupCopy(l, ana, site), n = M.followupCopy(l, none, site);
  const name = l === 'ja' ? ana.airline_ja : ana.airline_en;
  ok(a.subject.includes(name) && a.body[0][0].includes(name) && a.see.label.includes(name), `${l}：会社が分かる人は件名・本文・リンクに表の名前`);
  ok(existsSync(new URL(fileOf(a.see.href), ROOT)) && /airlines\/ana\.html$/.test(a.see.href), `${l}：会社のページへのリンクの先が在る（${fileOf(a.see.href)}）`);
  ok(existsSync(new URL(fileOf(n.see.href), ROOT)) && /world-airlines\.html$/.test(n.see.href) && !/ANA/.test(n.subject + n.body.flat().join('')),
     `${l}：会社が分からない人は一覧へ（${fileOf(n.see.href)}）`);
  ok(existsSync(new URL(fileOf(a.ask.cta.href), ROOT)) && /pay-report\.html#ps$/.test(a.ask.cta.href), `${l}：ボタンの先は給与フォーム（${fileOf(a.ask.cta.href)}）`);
  ok((l === 'ja' ? /匿名/ : l === 'en' ? /anonymously/ : /anónima/).test(a.ask.cta.label), `${l}：ボタンに「匿名で」`);
  const words = [a.subject, ...a.lead, ...a.body.flat(), a.see.label, a.ask.lead, a.ask.t, a.ask.cta.label, a.ask.note, ...a.close].join(' ');
  const nums = (words.match(/\d+/g) || []);
  const w90 = (M.welcomeCopy(l, site).ask.t.match(/\d+/g) || []);
  /* 「1件」（匿名で1件）は日が経っても嘘にならない。それ以外は「90日間」だけ（歓迎メールと同じ日数） */
  ok(nums.includes('90') && nums.every((x) => x === '90' || x === '1') && w90.includes('90'), `${l}：数字は「90日間」と「1件」だけ（社数・人数・件数を書かない）`, nums.join(','));
  const mail = M.buildFollowup({ ...ana, lang: l }, { siteUrl: site, supabaseUrl: SUPA });
  const perLang = mail.lang === 'both' ? 2 : 1;   // 英語で登録した人は英語＋日本語の1通（言語ごとに1つ）
  ok((mail.html.match(/background:#f5c842;color:#111;text-decoration:none/g) || []).length === perLang, `${l}：押すボタンは言語ごとに1つだけ（給与）`);
  ok(mail.oneClickUrl === `${SUPA}/functions/v1/remind-payslip?u=tok` && /unsubscribe\.html\?token=tok/.test(mail.unsubUrl) && mail.html.includes(a.unsub),
     `${l}：解除の口（1クリック・解除の画面）`);
}
const both = M.buildFollowup({ ...ana, lang: 'en' }, { siteUrl: site, supabaseUrl: SUPA });
ok(both.lang === 'both' && both.subject.startsWith('Share your All Nippon Airways (ANA) pay') && both.subject.includes('全日本空輸（ANA）'),
   '英語で登録した人は、英語が上・日本語が下の1通（歓迎メールと同じ決まり）');
/* 年収を載せている全社に、日英西のページが在る（airline_page が true になる会社＝cap_lo のある会社） */
const gen = read('db/airlines.generated.sql');
const withPay = [...gen.matchAll(/\('([a-z0-9-]+)', '[^']*', '[^']*', '[a-z_]+', (\d+|null),/g)].filter((m) => m[2] !== 'null').map((m) => m[1]);
const missing = [];
for (const c of withPay) for (const l of ['ja', 'en', 'es']) if (!existsSync(new URL(M.airlinePagePath(l, c), ROOT))) missing.push(M.airlinePagePath(l, c));
ok(withPay.length >= 100 && missing.length === 0, `年収を載せている ${withPay.length} 社すべてに、日英西の会社のページが在る`, missing.slice(0, 6).join(' '));

/* ════════════════════ C) 送る処理 ════════════════════ */
console.log('\n▼ C 送る処理');
const sent = [], marks = [];
let followupRpc = 'ok';
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  const b = init.body ? JSON.parse(init.body) : {};
  if (url === `${SUPA}/rest/v1/rpc/pv_welcome_due`) return Response.json([]);
  if (url === `${SUPA}/rest/v1/rpc/pv_welcome_followup_due`) {
    if (followupRpc === 'missing') return new Response('{"message":"not found"}', { status: 404 });
    return Response.json([{ id: uid(50), email: 'p50@example.com', lang: 'ja', unsub_token: 'tok', ...ana }]);
  }
  if (url === `${SUPA}/rest/v1/rpc/pv_welcome_followup_mark`) { marks.push(b); return Response.json(1); }
  if (url === 'https://api.resend.com/emails') { sent.push({ h: init.headers, b }); return Response.json({ id: 'x' }); }
  throw new Error('想定していない通信: ' + url);
};
const call = async (body = {}) => {
  const res = await M.handler(new Request('https://fn.test/', { method: 'POST', headers: { 'x-pv-cron-secret': 'cron-secret' }, body: JSON.stringify(body) }));
  return res.json();
};
let out = await call({ dry: true });
ok(out.ok && out.due2 === 1 && sent.length === 0 && marks.length === 0, '下見（dry）は人数だけ返し、送らない・記録しない', JSON.stringify(out));
out = await call();
ok(out.ok && out.sent2 === 1 && sent.length === 1 && sent[0].h['Idempotency-Key'] === `welcome2:${uid(50)}`,
   '2通目は welcome2:<id> の鍵で1通（歓迎メールの鍵 welcome:<id> と別）', JSON.stringify(out));
ok(sent[0].b.subject.includes('全日本空輸（ANA）') && sent[0].b.reply_to === 'info@pilot-value.com' && /List-Unsubscribe/.test(JSON.stringify(sent[0].b.headers)),
   '件名に会社の名前・返信は info@・配信停止のヘッダつき');
ok(marks.length === 1 && marks[0].p_id === uid(50) && marks[0].p_ok === true, '送れたら記録する');
followupRpc = 'missing'; sent.length = 0;
out = await call();
ok(out.ok === true && out.followup === 'unavailable' && sent.length === 0, '2通目の口がまだ無い（SQL を貼る前）なら飛ばす＝歓迎メールの回は今までどおり成功', JSON.stringify(out));

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
