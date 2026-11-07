/* 明細の読み取りに失敗したら、運営（info@）にすぐ知らせる（db/parse-outcome.sql ＋ parse-payslip ＋ payslip.js の report）。

   実行: node db/test-parse-outcome.mjs   （check.mjs sql にも入っている）
   ネットワーク不要・本番に一切触らない・Anthropic も Resend も叩かない（fetch を差し替える）。

   守っているもの（2026-11-07 オーナー「失敗したらすぐにメール・原因も」）:
     ★ 数える ── 1時間ごとの箱に種類ごとの回数だけ（欄は5つ。人・画像・金額の欄が無い）。直近24時間・今日の数・
       「24時間 成功0」の印（成功0 かつ こちら側3回以上 または 合わせて5回以上）。90日より古い箱は消える。
       会員・未ログインは読めない・呼べない
     ★ 関数の通し ── 本物の parse-payslip（index.ts）を動かし、数える口を本物の SQL（PGlite）へつなぐ。
       失敗するたびに info@ へ1通（理由を日本語で・コード・秒・画像の大きさ・今日の回数）／成功では送らない／
       1日30通まで／「24時間 成功0」なら件名に印／回数制限で止めた呼び出しは数えない・送らない／
       回数を数える DB に届かず読み取りを止めたとき（quota_unavailable）も送る／
       数える口が無くても失敗は知らせ、読み取りの返事は1文字も変わらない／
       ブラウザからの知らせ（report）は白リストの語だけ受け取り、本人の回数を減らさない／
       知らせに画像・金額・明細の文字が入らない
     ★ 壊す証明 ── 「成功0」の条件を抜いた版では、成功が挟まっても印が付いてしまい、この検査が赤くなる
*/
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'fs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const SQL = read('db/parse-outcome.sql');
const CHECKS_AT = SQL.indexOf('select \'1 表がある\'');

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };

/* 器：Supabase と同じく anon / authenticated / service_role が居て、既定で何でも呼べる状態から始める
   （revoke が効いていることを確かめるため）。 */
async function makeDb(sql) {
  const db = new PGlite();
  await db.waitReady;
  await db.exec(`set timezone = 'UTC'`);
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;`);
  await db.exec(sql);
  return db;
}
const add = async (db, kind) => (await db.query(`select public.pv_parse_outcome_add($1) as v`, [kind])).rows[0].v;
const reset = (db) => db.exec(`delete from public.pv_parse_outcome`);

// ═══ ① SQL ═════════════════════════════════════════════════════
console.log('\n① 数える（直近24時間・今日の数・24時間 成功0 の印）');
const db = await makeDb(SQL);

const checks = (await db.query(SQL.slice(CHECKS_AT))).rows;
ok(checks.length === 7 && checks.every((r) => r['結果'] === '✅'), `末尾の検算 ${checks.length} 行が全部 ✅`,
   JSON.stringify(checks.filter((r) => r['結果'] !== '✅')));

await reset(db);
let t = await add(db, 'ng');
ok(t.ng === 1 && t.today === 1 && t.stalled === false, '1回目の失敗：数は1・印なし', JSON.stringify(t));
await add(db, 'ng');
t = await add(db, 'ng');
ok(t.ng === 3 && t.today === 3 && t.stalled === true, '3回目の失敗で「24時間 成功0」の印', JSON.stringify(t));
t = await add(db, 'ok');
ok(t.ok === 1 && t.today === 3 && t.stalled === false, '成功は today に数えない・成功が入れば印は外れる', JSON.stringify(t));
t = await add(db, 'ng');
ok(t.stalled === false, '成功が1回挟まったあとは、失敗が続いても印は付かない（24時間のうちに成功がある）');

await reset(db);
await add(db, 'user_ng'); await add(db, 'user_ng'); await add(db, 'client_ng');
t = await add(db, 'client_ng');
ok(t.stalled === false && t.user_ng === 2 && t.client_ng === 2, '本人側2＋ブラウザ2（合わせて4回）では印なし', JSON.stringify(t));
t = await add(db, 'user_ng');
ok(t.stalled === true && t.today === 5, '合わせて5回で印・今日の数は種類をまたいで数える', JSON.stringify(t));

await reset(db);
await db.exec(`insert into public.pv_parse_outcome(hr, ok, ng, user_ng, client_ng)
               values (date_trunc('hour', now()) - interval '25 hours', 0, 9, 0, 0)`);
t = await add(db, 'ng');
ok(t.ng === 1 && t.stalled === false, '24時間より前の失敗は数えない', JSON.stringify(t));
await db.exec(`insert into public.pv_parse_outcome(hr, ok, ng, user_ng, client_ng)
               values (date_trunc('hour', now()) - interval '23 hours', 1, 0, 0, 0)`);
await add(db, 'ng');
t = await add(db, 'ng');
ok(t.ok === 1 && t.stalled === false, '23時間前の成功は数える（印は付かない）', JSON.stringify(t));

await db.exec(`insert into public.pv_parse_outcome(hr, ok, ng, user_ng, client_ng)
               values (date_trunc('hour', now()) - interval '91 days', 5, 0, 0, 0)`);
await add(db, 'ok');
const old = (await db.query(`select count(*)::int n from public.pv_parse_outcome where hr < now() - interval '90 days'`)).rows[0].n;
ok(old === 0, '90日より古い箱は、足したときに消える');
const before = (await db.query(`select sum(ok+ng+user_ng+client_ng)::int n from public.pv_parse_outcome`)).rows[0].n;
ok((await add(db, 'what')) === null && (await add(db, null)) === null, '知らない種類は null（何も足さない）');
const after = (await db.query(`select sum(ok+ng+user_ng+client_ng)::int n from public.pv_parse_outcome`)).rows[0].n;
ok(before === after, '知らない種類では表の数が1つも変わらない');

const cols = (await db.query(`select column_name from information_schema.columns
                              where table_name = 'pv_parse_outcome' order by ordinal_position`)).rows.map((r) => r.column_name);
ok(JSON.stringify(cols) === JSON.stringify(['hr', 'ok', 'ng', 'user_ng', 'client_ng']), '表の欄は5つだけ（人・画像・金額の欄が無い）', cols.join(','));

for (const role of ['anon', 'authenticated']) {
  await db.exec(`set role ${role}`);
  let denied = 0;
  try { await db.query(`select * from public.pv_parse_outcome`); } catch { denied++; }
  try { await db.query(`select public.pv_parse_outcome_add('ng')`); } catch { denied++; }
  await db.exec(`reset role`);
  ok(denied === 2, `${role} は表を読めない・足す関数を呼べない`);
}

let again = true;
try { await db.exec(SQL); } catch (e) { again = String(e.message || e); }
ok(again === true, 'ファイルをもう一度流しても通る（冪等）', again);

/* 初版（2026-11-07 の朝・client_ng の無い表と3引数の関数）の上に貼っても通る */
const v1 = await makeDb(`
  create table public.pv_parse_outcome (hr timestamptz primary key, ok int not null default 0,
    ng int not null default 0, user_ng int not null default 0);
  insert into public.pv_parse_outcome values (date_trunc('hour', now()), 2, 0, 0);
  create function public.pv_parse_outcome_stalled(p_ok int, p_ng int, p_user_ng int) returns boolean
    language sql immutable as $$ select false $$;
  create function public.pv_parse_outcome_add(p_kind text) returns boolean language sql as $$ select false $$;`);
let up = true;
try { await v1.exec(SQL); } catch (e) { up = String(e.message || e); }
t = up === true ? await add(v1, 'client_ng') : null;
ok(up === true && t && t.ok === 2 && t.client_ng === 1, '初版の表の上に貼っても通り、前の数を残したまま新しい欄が使える', String(up));

// ═══ ② 関数の通し（本物の index.ts × 本物の SQL）══════════════════
console.log('\n② 関数の通し（parse-payslip を偽のネットワークで動かす）');
const SUPA = 'https://example.supabase.test';
const ENV = {
  ANTHROPIC_API_KEY: 'test-key', SUPABASE_URL: SUPA, SUPABASE_SERVICE_ROLE_KEY: 'service-test',
  PV_IP_SALT: 'salt-test-0123456789', RESEND_API_KEY: 'resend-test',
};
let handler = null;
globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: (h) => { handler = h; } };

let anthropic = () => new Response('{}', { status: 500 });
let outcomeRpc = 'sql';            // 'sql' ＝ PGlite へ／'missing' ＝ まだ貼っていない（404）
let quota = 'ok';                  // 'ok' / 'subject'（本人の上限）/ 'down'（数える所に届かない）
const sent = [];                   // Resend へ送ったもの
const counted = [];                // 数える口に渡した種類
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url === `${SUPA}/rest/v1/rpc/pv_parse_quota_take_v2`) {
    if (quota === 'down') throw new Error('connect failed');
    return Response.json(quota === 'ok' ? { ok: true, n: 1, g: 1 } : { ok: false, cap: 'subject' });
  }
  if (url === `${SUPA}/rest/v1/rpc/pv_parse_outcome_add`) {
    const kind = JSON.parse(init.body).p_kind;
    counted.push(kind);
    if (outcomeRpc === 'missing') return new Response('{"message":"not found"}', { status: 404 });
    return Response.json(await add(db, kind));
  }
  if (url === 'https://api.anthropic.com/v1/messages') return anthropic();
  if (url === 'https://api.resend.com/emails') { sent.push({ headers: init.headers, body: JSON.parse(init.body) }); return Response.json({ id: 'x' }); }
  throw new Error('想定していない通信: ' + url);
};
const mod = await import('../supabase/functions/parse-payslip/index.ts');
ok(typeof handler === 'function', 'index.ts が読み込めて、受け口が取れた');

const IMG = Buffer.from('fake-image-bytes-0123456789').toString('base64');
const post = async (body) => {
  const res = await handler(new Request('https://fn.test/parse-payslip', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
    body: JSON.stringify(body),
  }));
  return { status: res.status, body: await res.json() };
};
const call = () => post({ image_b64: IMG, mime: 'image/jpeg', lang: 'ja' });
const U = { usage: { input_tokens: 10, output_tokens: 5 } };
const reply = (o) => () => Response.json({ ...U, ...o });
const GOOD = reply({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({
  currency: 'JPY', period: { year: 2026, month: 7 }, earnings: [{ label: '基本給', amount: '512345', kind: 'base' }],
  gross_total: '512345', deductions_total: null, net_pay: null, ytd_taxable: null, hours: [], unmapped: [], confidence: 'high' }) }] });
const NOT_SLIP = reply({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({
  currency: 'JPY', period: null, earnings: [], gross_total: null, deductions_total: null, net_pay: null,
  ytd_taxable: null, hours: [], unmapped: [], confidence: 'low' }) }] });
const REFUSED = reply({ stop_reason: 'refusal', content: [] });
const BROKEN = reply({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] });
const DOWN = () => new Response('{"error":{"type":"overloaded_error"}}', { status: 529 });
const DEAD = () => new Response('{"error":{"type":"authentication_error"}}', { status: 401 });
const last = () => sent.at(-1) || { headers: {}, body: {} };
const txt = (m) => (m.body.subject || '') + '\n' + (m.body.text || '');
const clean = (m) => !txt(m).includes(IMG) && !/512,?345|基本給/.test(txt(m));

await reset(db); sent.length = 0; counted.length = 0;
anthropic = GOOD;
let r = await call();
ok(r.body.ok === true && counted.at(-1) === 'ok' && sent.length === 0, '読めたら「成功」として数えるだけ（メールは送らない）');

anthropic = NOT_SLIP; r = await call();
ok(r.body.reason === 'not_a_payslip' && counted.at(-1) === 'user_ng' && sent.length === 1,
   '「明細ではない」→ 本人側として数え、すぐ1通');
ok(/明細として読める所が無かった/.test(last().body.subject) && /本人側/.test(last().body.text) && /not_a_payslip/.test(last().body.text),
   '件名に理由（日本語）・本文に「本人側」とコード', last().body.subject);
ok(/今日の失敗：1 回目/.test(last().body.text) && /成功 1/.test(last().body.text), '本文に今日の回数と直近24時間の成功の数');

anthropic = REFUSED; r = await call();
ok(r.body.reason === 'read_refused' && counted.at(-1) === 'user_ng' && sent.length === 2, '断られた → 本人側として数え、1通');
anthropic = BROKEN; r = await call();
ok(r.body.reason === 'read_bad_format' && counted.at(-1) === 'ng' && sent.length === 3, '答えの形が崩れた → こちら側として数え、1通');
ok(/AI の答えの形が崩れていた/.test(last().body.subject) && /こちら側/.test(last().body.text), '件名と本文に理由');
anthropic = DOWN; r = await call();
ok(r.body.reason === 'read_busy' && counted.at(-1) === 'ng' && /AI 側が混雑/.test(last().body.subject), '向こうの混雑（529）→ こちら側・件名「AI 側が混雑している」');
ok(/かかった時間：[\d.]+秒／画像 \d+KB／AI の止まり方 -／HTTP 529/.test(last().body.text), '本文に秒・画像の大きさ・HTTP の番号', last().body.text);
anthropic = DEAD; r = await call();
ok(r.body.reason === 'read_failed' && /API の鍵か残高/.test(last().body.subject), '鍵が死んでいる → 件名「API の鍵か残高の問題」');
ok(sent.every(clean), 'どの知らせにも画像・金額・明細の文字が入らない');
ok(sent.every((m) => JSON.stringify(m.body.to) === '["info@pilot-value.com"]'), '宛先は info@ だけ');
const day = new Date().toISOString().slice(0, 10);
const keys = sent.filter((m) => String(m.headers['Idempotency-Key']).startsWith('parse-fail:')).map((m) => m.headers['Idempotency-Key']);
ok(keys.length >= 5 && new Set(keys).size === keys.length && keys.every((k) => k.startsWith(`parse-fail:${day}:`)),
   '1通ずつ別の鍵（parse-fail:<日付>:<今日の何回目>）＝同じ失敗を2通送らない', keys.join(' '));
ok(!sent.some((m) => /24時間 成功0/.test(m.body.subject)), '成功が挟まっているあいだは「24時間 成功0」の印を付けない');

await reset(db); sent.length = 0;
anthropic = DOWN;
await call(); await call(); await call();
ok(sent.length === 3 && /【24時間 成功0】/.test(sent[2].body.subject) && !/【/.test(sent[1].body.subject),
   '成功0のまま3回目の失敗から件名に【24時間 成功0】', sent.map((m) => m.body.subject).join(' | '));

await reset(db); sent.length = 0;
await db.exec(`insert into public.pv_parse_outcome(hr, ok, ng, user_ng, client_ng) values (date_trunc('hour', now()), 0, 29, 0, 0)`);
await call(); await call(); await call();
ok(sent.length === 1 && /今日の失敗：30 回目/.test(sent[0].body.text), '1日30通まで（31回目からは送らない）', `${sent.length} 通`);

quota = 'subject'; counted.length = 0; sent.length = 0;
r = await call();
ok(r.status === 429 && counted.length === 0 && sent.length === 0, '本人の回数制限で止めた呼び出しは数えない・送らない');
quota = 'down';
await reset(db); r = await call();
ok(r.status === 503 && r.body.reason === 'quota_unavailable' && sent.length === 1 && /DB に届かず/.test(sent[0].body.subject),
   '回数を数える DB に届かず読み取りを止めたら、それも送る（件名「…DB に届かず、読み取りを止めている」）');
quota = 'ok';

outcomeRpc = 'missing'; sent.length = 0;
anthropic = GOOD; const a1 = await call();
anthropic = DOWN; const a2 = await call();
ok(sent.length === 1 && /回数は数えられませんでした/.test(sent[0].body.text),
   '数える口が無くても（SQL を貼る前）、失敗は知らせる（回数は数えられなかったと書く）');
anthropic = DOWN; await call();
ok(sent.length === 1, '数える口が無いときは、同じ理由を10分に1通まで（洪水よけ）');
outcomeRpc = 'sql';
anthropic = GOOD; const b1 = await call();
anthropic = DOWN; const b2 = await call();
ok(JSON.stringify(a1) === JSON.stringify(b1) && JSON.stringify(a2) === JSON.stringify(b2),
   '数える口の有る無しで、読み取りの返事は1文字も変わらない');

console.log('\n②-b ブラウザからの知らせ（report）');
await reset(db); sent.length = 0; counted.length = 0;
r = await post({ report: { reason: 'image_decode', stage: 'file', kb: 4321.4 } });
ok(r.status === 200 && r.body.ok === true && counted.at(-1) === 'client_ng' && sent.length === 1, 'ファイルが開けなかった → ブラウザの中として数え、1通');
ok(/写真を開けなかった/.test(sent[0].body.subject) && /ブラウザの中/.test(sent[0].body.text) && /画像：4321KB/.test(sent[0].body.text),
   '件名に理由・本文に「ブラウザの中」と画像の大きさ', sent[0].body.text);
r = await post({ report: { reason: 'network', stage: 'network' } });
ok(r.body.ok === true && /通信が切れた/.test(last().body.subject), '通信が切れた → 1通');
const n0 = sent.length;
for (const bad of [{ reason: 'hello', stage: 'file' }, { reason: 'network', stage: 'server' }, { reason: '<b>x</b>', stage: 'file' }, 'x', null]) {
  r = await post({ report: bad });
  ok(r.status === 400 && r.body.reason === 'bad_report', `白リストの外は捨てる（${JSON.stringify(bad)}）`);
}
ok(sent.length === n0, '捨てた知らせではメールを送らない');
quota = 'subject'; r = await post({ report: { reason: 'prep_failed', stage: 'prep' } }); quota = 'ok';
ok(r.body.ok === true, '知らせは回数制限より手前（本人の読み取りの回数を減らさない）');
ok(mod.CLIENT_REASONS instanceof Set && [...mod.CLIENT_REASONS].every((c) => mod.whyText(c) !== '分類していない失敗'),
   'ブラウザから受け取る語には全部、日本語の理由がある');

/* payslip.js が送る語が全部白リストに入っている（入っていないと、その失敗だけ黙って捨てられる） */
const PS = read('payslip.js');
const browserCodes = new Set([
  ...[...PS.matchAll(/\btag\('([a-z_]+)'/g)].map((m) => m[1]),
  ...[...PS.matchAll(/withTimeout\([^;]*?,\s*[A-Z_]+,\s*'([a-z_]+)'\)/g)].map((m) => m[1]),
  ...['too_large', 'bad_type', 'pdf_locked', 'pdf_broken', 'pdf_xfa', 'pdf_blank'],
]);
const missing = [...browserCodes].filter((c) => !mod.CLIENT_REASONS.has(c));
ok(missing.length === 0, `payslip.js の失敗の語（${browserCodes.size}個）が全部受け取れる`, missing.join(','));
ok(/report\(why, 'file', file\.size\)/.test(PS) && /if \(stage !== 'server'\) report\(code, stage, 0\)/.test(PS),
   'payslip.js はファイルの失敗と、サーバー以外の段の失敗を知らせる（サーバーの失敗はサーバーが自分で送る）');
ok(!/report\([^)]*(image_b64|b64|file\.name|amount)/.test(PS), 'payslip.js の知らせに画像・ファイル名・金額を渡していない');

// ═══ ③ 壊す証明 ════════════════════════════════════════════════
console.log('\n③ 壊す証明');
const BROKEN_SQL = SQL.replace("select coalesce(p_ok, 0) = 0\n     and ", () => 'select ');
ok(BROKEN_SQL !== SQL, '（準備）「成功0」の条件を抜いた版を作れた');
const bad = await makeDb(BROKEN_SQL.slice(0, BROKEN_SQL.indexOf('select \'1 表がある\'')));
await add(bad, 'ok'); await add(bad, 'ng'); await add(bad, 'ng');
ok((await add(bad, 'ng')).stalled === true, '抜いた版は成功が挟まっても印が付く＝①の「成功が挟まったら印は付かない」が赤くなる');

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
