/* db/test-hotel-suggest.mjs — ホテルの名前の候補（Google）の「月 10,000 回で止める」を、PGlite と手元の模擬の Google で見る（2026-10-19）。

   実行: node db/test-hotel-suggest.mjs      （全部 ✅ で exit 0。check.mjs sql に入っている）
   見ているもの（2026-10-18 オーナー「V7 ホテル名の候補 google で作る 月10000回？超えたらストップ」・P12.61・P12.62）
     A 数え札（db/hotel-suggest.sql）── 10,000 回目は通り、10,001 回目は止まる・表の制約で 10,001 にはならない・
       9,990 から同時に50本 → ちょうど10本・立ち上げ直しても回数は残る（流し直しても消えない）・
       UTC の月と America/Los_Angeles の月は、それぞれ自分の札だけが新しくなり、境目では厳しい方が勝つ（夏時間の切り替えも）・
       会員・未ログインからは表も関数も見えない／service_role が呼べるのは「いまの時刻で取る」口だけ
     B Edge Function（supabase/functions/hotel-suggest/index.ts をそのまま import）を手元の模擬の Google につないで ──
       10,001 回目は Google へ送る前に止まる・9,990 から同時に50本 → Google へはちょうど10本・
       Google が失敗した・時間切れになった・読めない返事の回も1回に数える・鍵が無い → Google へも数え札へも0本・
       数え札が答えない／読めない答え → Google へ0本・鍵は返事にもログにも出ない・
       Google へ送るのは places:autocomplete の1つの口だけ（Place Details・写真・口コミは1本も無い）
     C 本番の数え札の呼び方（restTake・restRoom）── service_role で pv_hotel_suggest_take を呼び、{"ok":true} そのものの時だけ通す／
       pv_hotel_suggest_room を呼び、true そのものの時だけ「空きがある」
     P ping（打った字を含まない問い合わせ。2026-10-19 P12.74）── on が真になるのは、鍵があり・数え札につながり・空きの口がちょうど true と
       答えたときだけ（止まっている・つながっていない・答えが無い／読めない → 偽）。ping は札を1つも進めない・Google へも送らない・回数を返さない
   ★Google には1回も通信しない。模擬の Google と模擬の PostgREST は、この Mac の 127.0.0.1 に OS が選ぶ番号で立てる。
   ★鍵は作り物の字（本物の鍵ではない）。 */
import { PGlite } from '@electric-sql/pglite';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SQL = read('db/hotel-suggest.sql');
const TS_FILE = 'supabase/functions/hotel-suggest/index.ts';
const TS = read(TS_FILE);
const S = await import(path.join(ROOT, TS_FILE));

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };
const J = (v) => { try { return JSON.stringify(v).slice(0, 500); } catch { return String(v); } };
const FAKE = 'pv-test-not-a-real-google-key-7f3a9c';   // 作り物の鍵（これが返事やログに出たら落とす）
const CAP = 10000;

/* ════ 0. 書いてあること（字で見る）════════════════════════════════ */
console.log('\n▼ 0. 書いてあること');
const sqlCode = SQL.replace(/--.*$/gm, '');
ok((sqlCode.match(/function public\.pv_hotel_suggest_cap\(\)[\s\S]*?\$\$\s*select (\d+);\s*\$\$/) || [])[1] === String(CAP) && /check \(n between 0 and 10000\)/.test(sqlCode)
   && (sqlCode.match(/\b1\d{4}\b/g) || []).every((x) => x === '10000') && (sqlCode.match(/\b1\d{4}\b/g) || []).length === 2
   && /c_cap constant integer := public\.pv_hotel_suggest_cap\(\);/.test(sqlCode)
   && /q\.n >= public\.pv_hotel_suggest_cap\(\)/.test(sqlCode),
   '天井は 10,000 回（pv_hotel_suggest_cap と表の制約の2か所だけ。取る口も空きを見る口もそれを読む。ほかの 1 万台の数は書いていない）');
ok(!/n\s*=\s*n\s*-|greatest\s*\(\s*n\s*-|delete\s+from\s+public\.pv_hotel_suggest_quota/i.test(sqlCode),
   '数え札を減らす文・消す文は1つも無い（Google が失敗しても、取った1回は返さない）');
ok(/'America\/Los_Angeles'/.test(sqlCode) && /at time zone 'UTC'/.test(sqlCode) && !/Asia\/Tokyo'\)::date|date_trunc\('month', now\(\)\)/.test(sqlCode),
   '月の区切りは UTC と America/Los_Angeles の2つだけ（日本時間はオーナーの表の「始まった時刻」にだけ使う）');
const tsCode = TS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, (m, a) => a);   // 行の注釈だけ落とす（https:// は残す）
const urls = [...tsCode.matchAll(/https?:\/\/[^\s'"`]+/g)].map((m) => m[0]);
ok(J(urls.filter((u) => /google/i.test(u))) === J(['https://places.googleapis.com/v1/places:autocomplete']) && S.ENDPOINT === urls.find((u) => /google/i.test(u)),
   'Google の住所は places:autocomplete の1つだけ', J(urls));
ok(!/places\/\$\{|:searchText|:searchNearby|photos|reviews|maps\.googleapis\.com|place\/details/i.test(tsCode),
   'Place Details・写真・口コミ・ほかの検索の口は、どこにも書いていない');
ok(S.FIELD_MASK === 'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat',
   '返してもらう欄は place ID と「名前・住所」だけ（X-Goog-FieldMask）', S.FIELD_MASK);
ok(J([...tsCode.matchAll(/rpc\/\$\{[A-Z_]+\}|rpc\/([a-z_]+)/g)].map((m) => m[0]).sort()) === J(['rpc/${ROOM_RPC}', 'rpc/${TAKE_RPC}'])
   && S.TAKE_RPC === 'pv_hotel_suggest_take' && S.ROOM_RPC === 'pv_hotel_suggest_room',
   '呼ぶ数え札の口は pv_hotel_suggest_take と pv_hotel_suggest_room の2つだけ（返す口・時刻を選ぶ口は呼ばない）');
ok(/D\.env\.get\('GOOGLE_PLACES_API_KEY'\)/.test(tsCode) && !/AIza[0-9A-Za-z_-]{10,}/.test(TS),
   '鍵は secret（GOOGLE_PLACES_API_KEY）からだけ読む・鍵らしい字はファイルに無い');

/* ════ 器（Supabase と同じ3つの役・既定の権限）════════════════════════════ */
async function boot(dir) {
  const db = dir ? new PGlite(dir) : new PGlite();
  await db.waitReady;
  await db.exec(`set timezone = 'UTC'`);
  const fresh = !(await db.query(`select 1 from pg_roles where rolname = 'service_role'`)).rows.length;
  if (fresh) {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      grant usage on schema public to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;`);
  }
  await db.exec(SQL);
  return db;
}
const db = await boot();
const take = async (at) => (await db.query(`select public.pv_hotel_suggest_take_at($1::timestamptz) as r`, [at])).rows[0].r;
const room = async (at) => (await db.query(`select public.pv_hotel_suggest_room_at($1::timestamptz) as r`, [at])).rows[0].r;
const rows = async () => (await db.query(`select bucket, to_char(month, 'YYYY-MM') as m, n from public.pv_hotel_suggest_quota order by month, bucket`)).rows;
const nOf = async (bucket, m) => ((await db.query(`select n from public.pv_hotel_suggest_quota where bucket = $1 and to_char(month, 'YYYY-MM') = $2`, [bucket, m])).rows[0] || {}).n ?? null;
const preset = async (pairs) => {
  for (const [bucket, m, n] of pairs) {
    await db.query(`insert into public.pv_hotel_suggest_quota (bucket, month, n) values ($1, ($2 || '-01')::date, $3)
                    on conflict (bucket, month) do update set n = excluded.n`, [bucket, m, n]);
  }
};
const wipe = () => db.exec(`delete from public.pv_hotel_suggest_quota`);
const as = async (role, sql) => {
  await db.exec(`set role ${role}`);
  try { return { v: (await db.query(sql)).rows[0] }; } catch (e) { return { err: String(e.message || e) }; } finally { await db.exec('reset role'); }
};
const denied = (r) => /permission denied/.test(r.err || '');

console.log('\n▼ A1. 流すこと（2回目も通る・検算の 2099 年の札は残らない）');
ok(J(await rows()) === '[]', '1回目を流したあと、表は空（検算の札は巻き戻っている）', J(await rows()));
await db.exec(SQL);
ok(J(await rows()) === '[]', '2回目を流しても通る・表は空のまま');

console.log('\n▼ A2. 見える人');
for (const role of ['anon', 'authenticated']) {
  ok(denied(await as(role, `select public.pv_hotel_suggest_take() as r`)), `${role}：pv_hotel_suggest_take() は呼べない`);
  ok(denied(await as(role, `select public.pv_hotel_suggest_take_at(now()) as r`)), `${role}：pv_hotel_suggest_take_at() は呼べない`);
  ok(denied(await as(role, `select * from public.pv_hotel_suggest_usage()`)), `${role}：pv_hotel_suggest_usage() は呼べない`);
  ok(denied(await as(role, `select public.pv_hotel_suggest_room() as r`)) && denied(await as(role, `select public.pv_hotel_suggest_room_at(now()) as r`))
     && denied(await as(role, `select public.pv_hotel_suggest_cap() as r`)), `${role}：空きの口（room・room_at）も天井（cap）も呼べない`);
  ok(denied(await as(role, `select count(*) from public.pv_hotel_suggest_quota`)), `${role}：表は読めない`);
  ok(denied(await as(role, `update public.pv_hotel_suggest_quota set n = 0`)), `${role}：表は書けない`);
}
const sr = await as('service_role', `select public.pv_hotel_suggest_take() as r`);
ok(sr.v && J(sr.v.r) === '{"ok":true}', 'service_role：pv_hotel_suggest_take()（いまの時刻）は呼べる', J(sr));
const cur = (await db.query(`select to_char(now() at time zone 'UTC', 'YYYY-MM') as u, to_char(now() at time zone 'America/Los_Angeles', 'YYYY-MM') as l`)).rows[0];
ok(await nOf('utc', cur.u) === 1 && await nOf('la', cur.l) === 1, `いまの時刻で取ると、いまの UTC の月（${cur.u}）と LA の月（${cur.l}）の札が1つずつ進む`, J(await rows()));
ok(denied(await as('service_role', `select public.pv_hotel_suggest_take_at(timestamptz '2099-01-01 00:00+00') as r`)),
   'service_role：時刻を選べる口 pv_hotel_suggest_take_at() は呼べない（ほかの月の札を使わせない）');
ok(denied(await as('service_role', `select * from public.pv_hotel_suggest_usage()`)) && denied(await as('service_role', `update public.pv_hotel_suggest_quota set n = 0`)),
   'service_role：オーナーの表（usage）も、表そのものの書き換えもできない');
const srr = await as('service_role', `select public.pv_hotel_suggest_room() as r`);
ok(srr.v && srr.v.r === true && await nOf('utc', cur.u) === 1 && await nOf('la', cur.l) === 1,
   'service_role：空きの口 pv_hotel_suggest_room()（いまの時刻）は呼べる・真か偽だけを返し、札は進めない', J({ srr, rows: await rows() }));
ok(denied(await as('service_role', `select public.pv_hotel_suggest_room_at(timestamptz '2099-01-01 00:00+00') as r`))
   && denied(await as('service_role', `select public.pv_hotel_suggest_cap() as r`)),
   'service_role：時刻を選べる空きの口 pv_hotel_suggest_room_at() と天井 pv_hotel_suggest_cap() は呼べない');
await wipe();

console.log('\n▼ A3. 10,000 回目は通り、10,001 回目は止まる（同じ月の中で、0 から本当に数える）');
const AT = '2026-10-15 03:00:00+00';
const room0 = await room(AT), rows0 = await rows();
let passed = 0, t0 = Date.now();
for (let i = 0; i < CAP; i++) if ((await take(AT)).ok === true) passed++;
const room10000 = await room(AT), rowsAfter = J(await rows());
const r10001 = await take(AT), r10002 = await take(AT);
ok(passed === CAP, `0 から ${CAP} 回取ると ${CAP} 回とも通る（${Date.now() - t0}ms）`, String(passed));
ok(J(r10001) === '{"ok":false,"cap":"month"}' && J(r10002) === '{"ok":false,"cap":"month"}', '10,001 回目・10,002 回目は止まる（{"ok":false,"cap":"month"}）', J([r10001, r10002]));
ok(J(await rows()) === J([{ bucket: 'la', m: '2026-10', n: CAP }, { bucket: 'utc', m: '2026-10', n: CAP }]), '札は2つとも 10,000 のまま（止まった回は数えない）', J(await rows()));
ok(room0 === true && J(rows0) === '[]' && room10000 === false && rowsAfter === J(await rows()) && await room('2026-12-15 03:00:00+00') === true
   && J(await rows()) === J([{ bucket: 'la', m: '2026-10', n: CAP }, { bucket: 'utc', m: '2026-10', n: CAP }]),
   '空きの口：0 回では真・10,000 回では偽・まだ札の無い月は真 ── 見るだけで、札も行も1つも増やさない', J({ room0, rows0, room10000 }));
let over = null;
try { await db.query(`update public.pv_hotel_suggest_quota set n = 10001 where bucket = 'la'`); } catch (e) { over = String(e.message); }
ok(/pv_hotel_suggest_quota_n_ck/.test(over || ''), '表の制約：どんな道で書いても 10,001 にはならない', over);
await wipe();

console.log('\n▼ A4. 9,990 から同時に50本 → ちょうど10本');
await preset([['la', '2026-10', 9990], ['utc', '2026-10', 9990]]);
const par = await Promise.all(Array.from({ length: 50 }, () => take(AT)));
ok(par.filter((r) => r.ok === true).length === 10 && par.filter((r) => r.ok === false && r.cap === 'month').length === 40,
   '同時に50本 → 通るのは10本・止まるのは40本', J(par.map((r) => r.ok ? 1 : 0).join('')));
ok(await nOf('la', '2026-10') === CAP && await nOf('utc', '2026-10') === CAP, '札は2つとも 10,000（数え漏れ・数えすぎが無い）', J(await rows()));
await wipe();

console.log('\n▼ A5. 月の区切り（UTC の月と America/Los_Angeles の月。日本時間はオーナーへの言い方だけ）');
const jst = (iso) => new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
/* (a) 2026年10月 → 11月（LA は夏時間）：UTC の月が先に新しくなる。LA の10月が一杯なら止まったまま */
await preset([['la', '2026-10', CAP], ['utc', '2026-10', CAP]]);
const e1 = await take('2026-10-31 23:59:59+00');
const e2 = await take('2026-11-01 00:00:00+00');
const re2 = await room('2026-11-01 00:00:00+00'), re3 = await room('2026-11-01 06:59:59+00'), re4 = await room('2026-11-01 07:00:00+00');
ok(e1.ok === false && e2.ok === false && await nOf('utc', '2026-11') === 0,
   `UTC の11月が始まった（${jst('2026-11-01T00:00:00Z')} 日本時間）が、LA はまだ10月で一杯 → 止まったまま・UTC の11月の札は進めない（厳しい方が勝つ）`, J(await rows()));
const e3 = await take('2026-11-01 06:59:59+00');
const e4 = await take('2026-11-01 07:00:00+00');
ok(e3.ok === false && e4.ok === true && await nOf('la', '2026-11') === 1 && await nOf('utc', '2026-11') === 1 && await nOf('la', '2026-10') === CAP,
   `LA の11月は ${jst('2026-11-01T07:00:00Z')} 日本時間（夏時間）に始まる → そこで戻る（11月の札が2つとも 1・10月の札はそのまま）`, J(await rows()));
ok(re2 === false && re3 === false && re4 === true, '空きの口も同じ境目：UTC の11月が始まっても LA の10月が一杯なら偽 → LA の11月で真', J({ re2, re3, re4 }));
/* (b) 夏時間の終わり（2026-11-01 2:00 PDT → 1:00 PST）では、LA の札は新しくならない */
const d1 = await take('2026-11-01 08:59:59+00'), d2 = await take('2026-11-01 09:00:00+00'), d3 = await take('2026-11-01 10:30:00+00');
ok(d1.ok && d2.ok && d3.ok && await nOf('la', '2026-11') === 4 && await nOf('utc', '2026-11') === 4,
   '夏時間が終わる時刻（11月1日 1:59 PDT → 1:00 PST）をまたいでも、LA の11月の札は続けて数える（新しくならない）', J(await rows()));
/* (c) 2026年11月 → 12月（LA は冬時間）：UTC の12月が始まっても、LA の11月が一杯なら 08:00 UTC まで止まる */
await preset([['la', '2026-11', CAP], ['utc', '2026-11', CAP]]);
const c1 = await take('2026-12-01 00:00:00+00'), c2 = await take('2026-12-01 07:59:59+00'), c3 = await take('2026-12-01 08:00:00+00');
ok(c1.ok === false && c2.ok === false && c3.ok === true && await nOf('la', '2026-12') === 1 && await nOf('utc', '2026-12') === 1,
   `冬時間の月：LA の12月は ${jst('2026-12-01T08:00:00Z')} 日本時間に始まる（${jst('2026-12-01T07:59:59Z')} までは止まったまま）`, J(await rows()));
/* (d) 反対の向き：UTC の札が一杯で LA に空きがある → UTC の月が新しくなった所で戻る（LA の札は新しくならない） */
await wipe();
await preset([['la', '2027-02', 9000], ['utc', '2027-02', CAP]]);
const ru1 = await room('2027-02-28 20:00:00+00'), ru2 = await room('2027-03-01 00:00:00+00');
const u1 = await take('2027-02-28 20:00:00+00'), u2 = await take('2027-03-01 00:00:00+00');
ok(u1.ok === false && u2.ok === true && await nOf('la', '2027-02') === 9001 && await nOf('utc', '2027-03') === 1 && await nOf('utc', '2027-02') === CAP,
   `UTC の札が一杯なら LA に空きがあっても止まる → UTC の3月（${jst('2027-03-01T00:00:00Z')} 日本時間）で戻る・LA はまだ2月の札で数える`, J(await rows()));
ok(ru1 === false && ru2 === true, '空きの口も同じ：UTC の札が一杯なら偽 → UTC の3月で真', J({ ru1, ru2 }));
/* (e) 夏時間が始まる年の境目：3月1日は冬時間（08:00 UTC）、4月1日は夏時間（07:00 UTC） */
await wipe();
await preset([['la', '2027-02', CAP], ['utc', '2027-02', CAP], ['la', '2027-03', CAP], ['utc', '2027-03', CAP]]);
const m1 = await take('2027-03-01 07:59:59+00'), m2 = await take('2027-03-01 08:00:00+00');
const a1 = await take('2027-04-01 06:59:59+00'), a2 = await take('2027-04-01 07:00:00+00');
ok(m1.ok === false && m2.ok === false && a1.ok === false && a2.ok === true && await nOf('la', '2027-04') === 1,
   `3月1日（冬時間）は ${jst('2027-03-01T08:00:00Z')}・4月1日（夏時間）は ${jst('2027-04-01T07:00:00Z')} 日本時間に LA の月が始まる（どちらの札も一杯のあいだは止まる）`, J(await rows()));
await wipe();

console.log('\n▼ A6. 立ち上げ直しても回数は残る（手元の保存先は流すたびに全部の SQL を流し直す ── serve-local.mjs と同じ）');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-hotel-suggest-'));
try {
  let fdb = await boot(path.join(tmp, 'pg'));
  for (let i = 0; i < 3; i++) await fdb.query(`select public.pv_hotel_suggest_take_at(timestamptz '2026-10-15 03:00+00')`);
  await fdb.close();
  fdb = await boot(path.join(tmp, 'pg'));
  const kept = (await fdb.query(`select bucket, n from public.pv_hotel_suggest_quota order by bucket`)).rows;
  const r4 = (await fdb.query(`select public.pv_hotel_suggest_take_at(timestamptz '2026-10-15 03:00+00') as r`)).rows[0].r;
  const after = (await fdb.query(`select n from public.pv_hotel_suggest_quota where bucket = 'utc'`)).rows[0].n;
  await fdb.close();
  ok(J(kept) === J([{ bucket: 'la', n: 3 }, { bucket: 'utc', n: 3 }]) && r4.ok === true && after === 4,
     '3回取って閉じ → 開き直して SQL を流し直しても 3 のまま・次の1回で 4', J({ kept, r4, after }));
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

/* ════ B. Edge Function × 手元の模擬の Google ════════════════════════════ */
const G = { mode: 'ok', reqs: [], all: [], hang: [] };   // reqs は節ごとに空にする・all は空にしない（全部の要求）
const google = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const rec = { method: req.method, path: req.url, key: req.headers['x-goog-api-key'] || '', mask: req.headers['x-goog-fieldmask'] || '', body: null };
    try { rec.body = JSON.parse(body); } catch { rec.body = body; }
    G.reqs.push(rec);
    G.all.push(rec);
    if (req.method !== 'POST' || req.url !== '/v1/places:autocomplete') { res.writeHead(404); return res.end(); }
    if (G.mode === 'fail') { res.writeHead(500, { 'content-type': 'application/json' }); return res.end('{"error":{"code":500}}'); }
    if (G.mode === 'junk') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('<html>not json'); }
    if (G.mode === 'hang') { G.hang.push(res); return; }
    const q = rec.body && rec.body.input ? String(rec.body.input) : '';
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ suggestions: [
      { placePrediction: { place: 'places/ChIJpvTestHotel0001', placeId: 'ChIJpvTestHotel0001', text: { text: `${q} 本館, 東京` },
        structuredFormat: { mainText: { text: `${q} 本館` }, secondaryText: { text: '日本、東京都' } }, types: ['lodging'] } },
      { placePrediction: { placeId: 'ChIJpvTestHotel0002', structuredFormat: { mainText: { text: `${q} 別館` }, secondaryText: { text: '日本、東京都' } } } },
      { queryPrediction: { text: { text: `${q} 近く` } } },
      { placePrediction: { placeId: 'bad id with spaces', structuredFormat: { mainText: { text: '落とす候補' } } } },
      { placePrediction: { placeId: 'ChIJpvTestHotel0003', structuredFormat: { mainText: { text: '' } } } },
      ...[4, 5, 6, 7].map((i) => ({ placePrediction: { placeId: `ChIJpvTestHotel000${i}`, structuredFormat: { mainText: { text: `${q} ${i}号館` } } } })),
    ] }));
  });
});
await new Promise((r) => google.listen(0, '127.0.0.1', r));
const GURL = `http://127.0.0.1:${google.address().port}/v1/places:autocomplete`;

const LOGS = [];
const BODIES = [];
const logCap = (...a) => LOGS.push(a.map(String).join(' '));
const sqlTake = (at = AT) => async () => (await db.query(`select public.pv_hotel_suggest_take_at($1::timestamptz) as r`, [at])).rows[0].r;
const sqlRoom = (at = AT) => async () => (await db.query(`select public.pv_hotel_suggest_room_at($1::timestamptz) as r`, [at])).rows[0].r;
const H = (o = {}) => S.makeHandler({ key: FAKE, take: sqlTake(), room: sqlRoom(), endpoint: GURL, timeoutMs: 400, log: logCap, ...o });
const post = async (h, body, headers = {}) => {
  const r = await h(new Request('http://local/functions/v1/hotel-suggest', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
  const text = await r.text();
  BODIES.push(text);
  let j = null;
  try { j = JSON.parse(text); } catch { j = null; }
  return { status: r.status, j, text, headers: r.headers };
};
const outs = () => G.reqs.length;
/* console へ出たものも拾う（鍵が出ていないかを見る） */
const con = { log: console.log, error: console.error, warn: console.warn };
const capture = (fn) => async (...a) => {
  console.error = (...x) => LOGS.push(x.map(String).join(' '));
  console.warn = (...x) => LOGS.push(x.map(String).join(' '));
  try { return await fn(...a); } finally { console.error = con.error; console.warn = con.warn; }
};

console.log('\n▼ B1. ふつうの1回（模擬の Google）');
await wipe();
const b1 = await post(H(), { q: 'ヒルトン', lang: 'ja', near: '東京' });
const g1 = G.reqs[0] || {};
ok(b1.status === 200 && b1.j && b1.j.ok === true && J(b1.j.items) === J([
    { name: 'ヒルトン 東京 本館', address: '日本、東京都', place_id: 'ChIJpvTestHotel0001' },
    { name: 'ヒルトン 東京 別館', address: '日本、東京都', place_id: 'ChIJpvTestHotel0002' },
    { name: 'ヒルトン 東京 4号館', address: '', place_id: 'ChIJpvTestHotel0004' },
    { name: 'ヒルトン 東京 5号館', address: '', place_id: 'ChIJpvTestHotel0005' },
    { name: 'ヒルトン 東京 6号館', address: '', place_id: 'ChIJpvTestHotel0006' }]),
   '返すのは候補の名前・住所・place ID だけ（最大5つ・形の違うもの・place ID の字が変なもの・名前の無いものは落とす）', J(b1.j));
ok(outs() === 1 && g1.method === 'POST' && g1.path === '/v1/places:autocomplete' && g1.key === FAKE && g1.mask === S.FIELD_MASK
   && J(g1.body) === J({ input: 'ヒルトン 東京', languageCode: 'ja', includedPrimaryTypes: ['lodging'], includeQueryPredictions: false }),
   'Google へは1本：places:autocomplete・鍵は X-Goog-Api-Key の見出しだけ・欄の指定・打った字＋都市・日本語・泊まる所（lodging）だけ', J(g1));
ok(await nOf('utc', '2026-10') === 1 && await nOf('la', '2026-10') === 1, '送った1回は、2つの札に1つずつ数えた', J(await rows()));
const b1b = await post(H(), { q: 'Hilton Tokyo', lang: 'en', near: 'tokyo' });
ok(b1b.j && b1b.j.ok === true && G.reqs[1] && J(G.reqs[1].body.input) === '"Hilton Tokyo"' && G.reqs[1].body.languageCode === 'en',
   '打った字に都市の名前がもう入っていれば足さない・英語の画面は en', J(G.reqs[1] && G.reqs[1].body));

console.log('\n▼ B2. 送らない場面（Google へも数え札へも0本）');
await wipe();
G.reqs.length = 0;
let took = 0;
const counting = async () => { took++; return { ok: true }; };
for (const q of ['', 'ヒ', 'ab', '   ', 'x'.repeat(81), 12345, null]) {
  const r = await post(H({ take: counting }), { q, lang: 'ja' });
  ok(r.status === 400 && r.j && r.j.reason === 'bad_request', `短すぎる・長すぎる・字でない（${J(q).slice(0, 20)}）→ bad_request`, J(r.j));
}
const nc1 = await post(H({ key: '', take: counting }), { q: 'ヒルトン' });
const nc2 = await post(H({ take: null }), { q: 'ヒルトン' });
ok(nc1.j && nc1.j.reason === 'not_configured' && nc2.j && nc2.j.reason === 'not_configured', '鍵が無い・数え札が無い → not_configured', J([nc1.j, nc2.j]));
const ping = await post(H({ take: counting }), { ping: 1 });
ok(ping.j && J(Object.keys(ping.j).sort()) === J(['build', 'has_db', 'has_key', 'ok', 'on']) && ping.j.ok === true && ping.j.build === S.BUILD
   && ping.j.has_key === true && ping.j.has_db === true && ping.j.on === true && !ping.text.includes(FAKE),
   '{"ping":1} は版と真偽だけ（ok・build・has_key・has_db・on。回数も鍵の字も返さない）', ping.text);
ok(took === 0 && outs() === 0, `ここまでの ${9 + 1} 本で、数え札は0回・Google は0本`, J({ took, outs: outs() }));

console.log('\n▼ P. ping の on（打った字を送ってよいか）── 真は「鍵・数え札・空きの口が true」の3つがそろったときだけ');
let roomed = 0;
const R0 = (v) => async () => { roomed++; if (v instanceof Error) throw v; return v; };
for (const [label, o, want] of [
  ['そろっている（空きの口が true）', { take: counting, room: R0(true) }, true],
  ['空きの口が false（止まっている）', { take: counting, room: R0(false) }, false],
  ['空きの口が投げる', { take: counting, room: R0(new Error('db down')) }, false],
  ['空きの口が "true"（字）', { take: counting, room: R0('true') }, false],
  ['空きの口が 1', { take: counting, room: R0(1) }, false],
  ['空きの口が null', { take: counting, room: R0(null) }, false],
  ['空きの口が {"ok":true}', { take: counting, room: R0({ ok: true }) }, false],
  ['空きの口が無い', { take: counting, room: null }, false],
  ['空きの口を渡さない', { take: counting, room: undefined }, false],
  ['鍵が無い', { key: '', take: counting, room: R0(true) }, false],
  ['数え札が無い', { take: null, room: R0(true) }, false],
]) {
  const r = await post(H(o), { ping: 1 });
  ok(r.j && r.j.ok === true && r.j.on === want, `ping：${label} → on は ${want}`, J(r.j));
}
ok(roomed === 7 && took === 0 && outs() === 0, 'ping は、鍵と数え札と空きの口がそろっているときだけ空きの口を見る（7回）・札は1回も取らない・Google へは0本', J({ roomed, took, outs: outs() }));
await wipe();
await preset([['la', '2026-10', CAP - 1], ['utc', '2026-10', CAP - 1]]);
const pa = await post(H(), { ping: 1 }), pb = await post(H(), { ping: 1 }), rowsP1 = J(await rows());
await preset([['la', '2026-10', CAP], ['utc', '2026-10', 0]]);
const pc = await post(H(), { ping: 1 });
await preset([['la', '2026-10', 0], ['utc', '2026-10', CAP]]);
const pd = await post(H(), { ping: 1 }), rowsP2 = J(await rows());
ok(pa.j.on === true && pb.j.on === true && rowsP1 === J([{ bucket: 'la', m: '2026-10', n: CAP - 1 }, { bucket: 'utc', m: '2026-10', n: CAP - 1 }])
   && pc.j.on === false && pd.j.on === false && rowsP2 === J([{ bucket: 'la', m: '2026-10', n: 0 }, { bucket: 'utc', m: '2026-10', n: CAP }]) && outs() === 0,
   '手元の本物の数え札で：9,999 なら on は真（2回聞いても札は 9,999 のまま）・どちらかの札が 10,000 なら偽・Google へは0本', J({ pa: pa.j, pc: pc.j, pd: pd.j, rowsP1, rowsP2 }));
await wipe();

console.log('\n▼ B3. 数え札が答えない・読めない → Google へ0本');
for (const [label, t] of [
  ['投げる', async () => { throw new Error('db down'); }],
  ['null', async () => null],
  ['{"ok":"true"}（字の true）', async () => ({ ok: 'true' })],
  ['{"ok":1}', async () => ({ ok: 1 })],
  ['{"ok":false,"cap":"bad"}', async () => ({ ok: false, cap: 'bad' })],
  ['配列', async () => [{ ok: true }]],
]) {
  const r = await post(H({ take: t }), { q: 'ヒルトン' });
  ok(r.j && r.j.ok === false && r.j.reason === 'quota_unavailable', `数え札が「${label}」→ quota_unavailable`, J(r.j));
}
ok(outs() === 0, '数え札が答えない6通りで、Google は0本', String(outs()));

console.log('\n▼ B4. 10,001 回目は Google へ送る前に止まる');
await wipe();
await preset([['la', '2026-10', CAP - 1], ['utc', '2026-10', CAP - 1]]);
const s1 = await post(H(), { q: 'ヒルトン' });
const before = outs();
const s2 = await post(H(), { q: 'ヒルトン' }), s3 = await post(H(), { q: 'オークラ' });
ok(s1.j && s1.j.ok === true && before === 1, '10,000 回目は通る（Google へ1本）', J(s1.j));
ok(s2.j && s2.j.reason === 'stopped' && s3.j && s3.j.reason === 'stopped' && outs() === before,
   '10,001 回目・10,002 回目は stopped・Google へは1本も増えない', J({ s2: s2.j, s3: s3.j, outs: outs() }));
await preset([['la', '2026-10', CAP], ['utc', '2026-10', 0]]);
const s4 = await post(H(), { q: 'ヒルトン' });
await preset([['la', '2026-10', 0], ['utc', '2026-10', CAP]]);
const s5 = await post(H(), { q: 'ヒルトン' });
ok(s4.j && s4.j.reason === 'stopped' && s5.j && s5.j.reason === 'stopped' && outs() === before, 'どちらか一方の札が 10,000 なら止まる（LA だけ・UTC だけ）', J([s4.j, s5.j]));

console.log('\n▼ B5. 9,990 から同時に50本 → Google へちょうど10本');
await wipe();
G.reqs.length = 0;
await preset([['la', '2026-10', 9990], ['utc', '2026-10', 9990]]);
const h5 = H();
const many = await Promise.all(Array.from({ length: 50 }, (_, i) => post(h5, { q: `ホテル${i}` })));
ok(outs() === 10 && many.filter((r) => r.j && r.j.ok === true).length === 10 && many.filter((r) => r.j && r.j.reason === 'stopped').length === 40,
   '同時に50本 → Google へ10本・候補が返るのは10本・stopped が40本', J({ outs: outs(), ok: many.filter((r) => r.j && r.j.ok).length }));
ok(await nOf('la', '2026-10') === CAP && await nOf('utc', '2026-10') === CAP, '札は2つとも 10,000', J(await rows()));

console.log('\n▼ B6. Google が失敗しても1回に数える（返さない）');
for (const mode of ['fail', 'junk', 'hang']) {
  await wipe();
  G.reqs.length = 0;
  G.mode = mode;
  const r = await capture(post)(H(), { q: 'ヒルトン' });
  ok(r.j && r.j.ok === false && r.j.reason === 'read_failed' && outs() === 1 && await nOf('la', '2026-10') === 1 && await nOf('utc', '2026-10') === 1,
     `Google が${{ fail: '500 を返した', junk: '読めない返事をした', hang: '答えない（時間切れ）' }[mode]} → read_failed・送った1回は数えたまま（札は 1）`, J({ r: r.j, outs: outs(), rows: await rows() }));
}
G.hang.forEach((res) => { try { res.destroy(); } catch { /* もう切れている */ } });
G.mode = 'ok';

console.log('\n▼ B7. 鍵は返事にもログにも出ない・Google へ送ったのは autocomplete の口だけ');
const allPaths = [...new Set(G.all.map((r) => `${r.method} ${r.path}`))];
const leakedBody = BODIES.filter((t) => t.includes(FAKE));
const leakedLog = LOGS.filter((t) => t.includes(FAKE));
ok(BODIES.length > 30 && leakedBody.length === 0, `ここまでの返事 ${BODIES.length} 本に、鍵の字は1つも無い`, J(leakedBody));
ok(LOGS.length >= 3 && leakedLog.length === 0 && LOGS.every((l) => /^hotel-suggest: google (status \d{3}|unreachable)$/.test(l)),
   `ログ ${LOGS.length} 行は「hotel-suggest: google status 番号／unreachable」だけ（鍵・打った字・返事の中身は無い）`, J(LOGS));
ok(J(allPaths) === J(['POST /v1/places:autocomplete']), 'Google が受け取った要求は全部 POST /v1/places:autocomplete（Place Details・写真・口コミは0本）', J(allPaths));

console.log('\n▼ B8. ブラウザへの許し（CORS）');
const o1 = await post(H({ take: counting }), { ping: 1 }, { origin: 'https://pilot-value.com' });
const o2 = await post(H({ take: counting }), { ping: 1 }, { origin: 'https://example.com' });
ok(o1.headers.get('access-control-allow-origin') === 'https://pilot-value.com' && o2.headers.get('access-control-allow-origin') === null,
   'このサイトの画面には許す・ほかのサイトには許さない', J([o1.headers.get('access-control-allow-origin'), o2.headers.get('access-control-allow-origin')]));

/* ════ C. 本番の数え札の呼び方（restTake）════════════════════════════════ */
console.log('\n▼ C. restTake（service_role で数え札の口を呼ぶ）');
const R = { mode: 'ok', reqs: [] };
const rest = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    R.reqs.push({ method: req.method, path: req.url, apikey: req.headers.apikey || '', auth: req.headers.authorization || '', body });
    const send = (st, t) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(t); };
    if (R.mode === 'ok') return send(200, '{"ok": true}');
    if (R.mode === 'month') return send(200, '{"ok": false, "cap": "month"}');
    if (R.mode === '500') return send(500, '{"message":"boom"}');
    if (R.mode === 'html') return send(200, '<html>');
    if (R.mode === 'string') return send(200, '{"ok": "true"}');
    if (R.mode === 'array') return send(200, '[{"ok": true}]');
    if (R.mode === 'true') return send(200, 'true');
    if (R.mode === 'false') return send(200, 'false');
    if (R.mode === 'qtrue') return send(200, '"true"');
    if (R.mode === 'atrue') return send(200, '[true]');
    return send(404, '{}');
  });
});
await new Promise((r) => rest.listen(0, '127.0.0.1', r));
const RURL = `http://127.0.0.1:${rest.address().port}`;
const SR = 'pv-test-service-role-not-real';
G.reqs.length = 0;
const want = { ok: true, month: 'stopped', 500: 'quota_unavailable', html: 'quota_unavailable', string: 'quota_unavailable', array: 'quota_unavailable', 404: 'quota_unavailable' };
for (const mode of Object.keys(want)) {
  R.mode = mode;
  const r = await post(H({ take: S.restTake(RURL, SR) }), { q: 'ヒルトン' });
  ok(want[mode] === true ? r.j && r.j.ok === true : r.j && r.j.reason === want[mode], `数え札の答えが ${mode} → ${want[mode] === true ? '候補を返す' : want[mode]}`, J(r.j));
}
const r0 = R.reqs[0] || {};
ok(R.reqs.length === 7 && R.reqs.every((x) => x.method === 'POST' && x.path === '/rest/v1/rpc/pv_hotel_suggest_take' && x.apikey === SR && x.auth === `Bearer ${SR}` && x.body === '{}'),
   '数え札へは毎回 POST /rest/v1/rpc/pv_hotel_suggest_take（service_role の鍵・中身は {}）', J(r0));
ok(outs() === 1, '数え札が {"ok":true} そのものを返した1回だけ、Google へ送った（ほかの6通りは0本）', String(outs()));
R.reqs.length = 0;
const wantRoom = { true: true, false: false, ok: false, string: false, qtrue: false, atrue: false, 500: false, html: false, 404: false };
const gotRoom = {};
for (const mode of Object.keys(wantRoom)) { R.mode = mode; gotRoom[mode] = await S.restRoom(RURL, SR)(); }
ok(J(gotRoom) === J(wantRoom), '空きの口の答えが true そのもののときだけ「空きがある」（false・{"ok":true}・"true"・[true]・500・html・404 は全部「無い」）', J(gotRoom));
ok(R.reqs.length === 9 && R.reqs.every((x) => x.method === 'POST' && x.path === '/rest/v1/rpc/pv_hotel_suggest_room' && x.apikey === SR && x.auth === `Bearer ${SR}` && x.body === '{}'),
   '空きの口へは毎回 POST /rest/v1/rpc/pv_hotel_suggest_room（service_role の鍵・中身は {}）', J(R.reqs[0]));
const pr = await post(H({ take: S.restTake(RURL, SR), room: S.restRoom(RURL, SR) }), { ping: 1 });
ok(pr.j && pr.j.on === false && outs() === 1, '本番の呼び方で：空きの口が 404 → ping の on は偽・Google へは0本', J(pr.j));
/* ════ D. 本番の立ち上がり方（Deno.serve に渡る形・secret の名前）════════════════════════
   ★ここでは fetch を差し替え、127.0.0.1 のほかへは1本も出さない（出そうとしたら数えて落とす）。本番の Google の住所へは届かない。 */
console.log('\n▼ D. 本番の立ち上がり方（secret の名前・鍵が無いときは数え札にも Google にも触らない）');
const realFetch = globalThis.fetch, away = [];
globalThis.fetch = (u, init) => {
  const s = String(u && u.url ? u.url : u);
  if (!/^http:\/\/127\.0\.0\.1:\d+\//.test(s)) { away.push(s.replace(/\?.*$/, '')); return Promise.reject(new Error('refused by the test')); }
  return realFetch(u, init);
};
const served = [];
const boot1 = async (env, tag) => {
  globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { served.push(h); } };
  try { await import(path.join(ROOT, TS_FILE) + '?deno=' + tag); } finally { delete globalThis.Deno; }
  return served[served.length - 1];
};
try {
  R.mode = 'month';
  R.reqs.length = 0;
  const noKey = await boot1({ SUPABASE_URL: RURL, SUPABASE_SERVICE_ROLE_KEY: SR }, 'nokey');
  const noDb = await boot1({ GOOGLE_PLACES_API_KEY: FAKE }, 'nodb');
  const both = await boot1({ GOOGLE_PLACES_API_KEY: FAKE, SUPABASE_URL: RURL, SUPABASE_SERVICE_ROLE_KEY: SR }, 'both');
  const d1 = await post(noKey, { q: 'ヒルトン' }), d2 = await post(noDb, { q: 'ヒルトン' });
  ok(served.length === 3 && d1.j && d1.j.reason === 'not_configured' && d2.j && d2.j.reason === 'not_configured' && R.reqs.length === 0,
     'Deno の上では Deno.serve に1つ渡す・GOOGLE_PLACES_API_KEY が無い／SUPABASE_URL が無い → not_configured（数え札へも0本）', J([d1.j, d2.j, R.reqs.length]));
  const d3 = await post(both, { q: 'ヒルトン' });
  ok(d3.j && d3.j.reason === 'stopped' && R.reqs.length === 1 && R.reqs[0].path === '/rest/v1/rpc/pv_hotel_suggest_take' && R.reqs[0].apikey === SR,
     '3つそろうと、SUPABASE_URL の数え札を SUPABASE_SERVICE_ROLE_KEY で呼ぶ（止まっていれば、そこで stopped）', J({ d3: d3.j, reqs: R.reqs }));
  R.reqs.length = 0;
  const dp1 = await post(both, { ping: 1 });
  R.mode = 'true';
  const dp2 = await post(both, { ping: 1 });
  const dp3 = await post(noKey, { ping: 1 }), dp4 = await post(noDb, { ping: 1 });
  ok(dp1.j && dp1.j.on === false && dp2.j && dp2.j.on === true && dp3.j && dp3.j.on === false && dp4.j && dp4.j.on === false
     && R.reqs.length === 2 && R.reqs.every((x) => x.path === '/rest/v1/rpc/pv_hotel_suggest_room' && x.apikey === SR),
     '3つそろうと、ping は SUPABASE_URL の空きの口を SUPABASE_SERVICE_ROLE_KEY で見る（止まっていれば on は偽・空きがあれば真）・鍵か数え札が無ければ見ずに偽', J({ dp1: dp1.j, dp2: dp2.j, dp3: dp3.j, dp4: dp4.j, reqs: R.reqs }));
  ok(away.length === 0, 'この節で 127.0.0.1 のほかへ出ようとした要求は0本（本番の Google の住所へは1本も無い）', J(away));
} finally { globalThis.fetch = realFetch; }

await new Promise((r) => rest.close(r));
const gone = await post(H({ take: S.restTake(RURL, SR) }), { q: 'ヒルトン' });
ok(gone.j && gone.j.reason === 'quota_unavailable' && outs() === 1, '数え札に届かない（つながらない）→ quota_unavailable・Google へ0本', J(gone.j));

const finalPaths = [...new Set(G.all.map((r) => `${r.method} ${r.path}`))];
ok(G.all.length >= 15 && J(finalPaths) === J(['POST /v1/places:autocomplete']) && G.all.every((r) => r.key === FAKE && r.mask === S.FIELD_MASK),
   `★終わりに：模擬の Google が受け取った全部（${G.all.length}本）が POST /v1/places:autocomplete・鍵は見出しだけ・欄の指定つき（Place Details・写真・口コミは0本）`, J(finalPaths));
await new Promise((r) => google.close(r));
await db.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exitCode = fail ? 1 : 0;
