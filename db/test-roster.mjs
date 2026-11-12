/* db/roster.sql（勤務表の取り込み・マイレポートの読む口）を本物の Postgres（PGlite）に流して確かめる。

   実行: node db/test-roster.mjs
   ネットワーク不要・本番に一切触らない。中身は作り物だけ（実在の勤務表・氏名は使わない）。

   見ているもの
     ・出した日と便が入る／同じファイルの二度目は何もしない
     ・重なった日・改訂版は**日付で**入れ替わる（二重に数えない・入れ替わった日の便は残らない）
     ・ほかの会員は読めない・消せない／anon は呼べない／未ログインは 42501
     ・不正なコード・氏名・自由記述は弾くか落とす／大きすぎ・多すぎは弾く／1日30本まで
     ・ファイルを消すと、まだそのファイルが持っている日だけ消える
     ・★便名は保存しない（送っても落ちる・読む口も返さない）
     ・★2年より前の日は月の合計にまとめて消す（合計は pv-report-engine.js の数え方と1分も違わない・境目は月の頭）
     ・読み方（profile）の検品・明細の行の答え（line map）と my_report_items の往復（「その他」の会社も）
     ・★1日を手で直す・消す（edit_roster_day）：検品は submit_roster と同じ・在る日はそのファイルのまま・
       無い日は本人の置き場（manual）1つへ・2年の境目より前は受け付けない・1人1日200回まで・ほかの会員の日に触れない
     ・★便の乗務の区分（CAP／FO）は保存しない（列が無い・送っても黙って落ちる＝古い画面でも止めない）
     ・★勤務コードは英字の形か読み取りの印（'#'＋小文字の16進16字）。#xyz・大文字の16進・漢字は弾く
     ・読み方の空欄の意味（blank：off／none／null）・会社（airline）・codes のキーの印
     ・★会社の辞書：3人以上が同じ答え かつ 過半数だけ置く（2人・3対3・unknown は置かない）・消すと数え直す・
       ほかの会社に触れない・テスト用アカウントを外す・人数を返さない・「一覧にない会社」は空・前の版の行を当て直す
     ・末尾の検算が全部 ✅ ／ 壊す証明（鍵の式を1文字変える・anon に呼ばせる・手で直す口のログイン確認や2年の境目を外す・
       辞書の線を2人に下げる・区分の列を戻す → 検算が ❌）
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import vm from 'vm';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label} ${extra}`); }
};
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const rows = async (sql, params) => (await db.query(sql, params)).rows;
// 失敗したら { msg, code }、通ったら null
const boom = async (sql, params) => {
  try { await db.query(sql, params); return null; }
  catch (e) { return { msg: String(e.message || e), code: e.code || '' }; }
};

// ── 器（Supabase の初期状態と同じ形）──────────────────────────
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  grant usage on schema public, extensions to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  -- ★Supabase は関数にも既定で anon/authenticated の実行権を付ける。これが無いと revoke が効いたかを誤読する。
  alter default privileges in schema public grant all on functions to anon, authenticated;

  create table public.profiles (
    id uuid primary key, email text, name text,
    email_opt_in boolean not null default false
  );

  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;
`);

// 前提の関所：pay-reports.sql より先に貼ると、何も作らずに止まる
{
  const bare = new PGlite({ extensions: { pgcrypto } });
  await bare.waitReady;
  await bare.exec(`create schema if not exists extensions; create schema if not exists auth;
                   create role anon; create role authenticated;`);
  let msg = '';
  try { await bare.exec(read('db/roster.sql')); } catch (e) { msg = String(e.message || e); }
  const made = (await bare.query(`select to_regclass('public.pv_roster_days') t`)).rows[0].t;
  ok(msg.includes('先に db/pay-reports.sql') && made === null,
     '★前提の関所：pay-reports.sql より先に貼ると止まり、表を1つも作らない', msg.slice(0, 60));
  await bare.close();
}

const FILES = ['db/airlines.generated.sql', 'db/vocab.generated.sql',
               'db/pay-reports.sql', 'db/pay-edit.sql', 'db/roster.sql'];

console.log('\n▼ SQL の適用');
for (const f of FILES) {
  try { await db.exec(read(f)); ok(true, f); }
  catch (e) { ok(false, f, '\n     ' + e.message); process.exit(1); }
}
console.log('\n▼ 冪等性（もう一度そのまま流す）');
for (const f of FILES) {
  try { await db.exec(read(f)); ok(true, `${f} 再適用OK`); }
  catch (e) { ok(false, `${f} 再適用で失敗`, '\n     ' + e.message); }
}

// ── 道具 ─────────────────────────────────────────────────────
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const asUser = async (n) => {
  await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`, [uid(n), `p${n}@example.com`]);
  await db.query(`select set_config('pv.uid', $1, false)`, [uid(n)]);
};
const logout = () => db.query(`select set_config('pv.uid', '', false)`);

const TODAY = (await one(`select current_date::text d`)).d;
const addDays = (iso, n) => {
  const t = new Date(iso + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
const D = (n) => addDays(TODAY, n - 40);             // 40日前を起点にした作り物の日付
const sha = (n) => n.toString(16).padStart(64, '0');

const leg = (seq, x = {}) => ({
  seq, flight: 'EK101', from: 'DXB', to: 'LHR', loc: null, out: '07:00', in: '14:17', in_day: 0,
  block: '7:17', role: 'CAP', kind: 'operating', page: 1, row: 1, ...x,
});
const day = (n, x = {}) => ({
  date: D(n), code: null, d_on: '05:40', d_off: '15:00', d_off_day: 0, page: 1, row: n + 1,
  legs: [leg(1), leg(2, { flight: 'EK102', from: 'LHR', to: 'DXB', out: '16:00', in: '23:50', block: '7:50' })],
  ...x,
});
const roster = (days, x = {}) => ({ airline: 'emirates', file_sha: sha(1), pages: 2, period: null, days, ...x });

const submitR = async (p) => (await one(`select submit_roster($1::jsonb) r`, [JSON.stringify(p)])).r;
const trySubmit = (p) => boom(`select submit_roster($1::jsonb)`, [JSON.stringify(p)]);
const myRoster = async (a = 'emirates', o = null, f = null, t = null) =>
  (await one(`select my_roster($1, $2, $3::date, $4::date) r`, [a, o, f, t])).r;
const myDocs = async (a = 'emirates', o = null) => (await one(`select my_roster_docs($1, $2) r`, [a, o])).r;
const delDoc = async (id, a = null, o = null) => (await one(`select delete_roster_doc($1::uuid, $2, $3) r`, [id, a, o])).r;
const setProfile = async (p, a = 'emirates', o = null) =>
  (await one(`select set_roster_profile($1, $2, $3::jsonb) r`, [a, o, p === null ? null : JSON.stringify(p)])).r;
const setMap = async (label, off, status, qty = null, a = 'emirates', o = null) =>
  (await one(`select set_line_map($1, $2, $3, $4, $5, $6) r`, [a, o, label, off, status, qty])).r;
const trySetMap = (label, off, status, qty = null, a = 'emirates', o = null) =>
  boom(`select set_line_map($1, $2, $3, $4, $5, $6)`, [a, o, label, off, status, qty]);
const items = async () => (await one(`select my_report_items() r`)).r;
const cnt = async (t) => Number((await one(`select count(*) n from public.${t}`)).n);
const dump = async () => JSON.stringify(await rows(`
  select (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.pv_roster_days x) d,
         (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.pv_roster_legs x) l,
         (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.pv_roster_docs x) f,
         (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.pv_roster_profile x) p`));

// ── 1. 出す ──────────────────────────────────────────────────
console.log('\n▼ 勤務表を出す（10日）');
await asUser(1);
const daysA = [];
for (let n = 0; n < 10; n++) daysA.push(day(n));
// 3日目：日をまたぐ（解散が翌日・最後の便の到着も翌日）＋回送＋地上業務（空港を入れてきても落とす）＋不明
daysA[3] = day(3, {
  d_on: '18:00', d_off: '02:10', d_off_day: 1,
  legs: [
    leg(1, { flight: 'EK201', from: 'DXB', to: 'BKK', out: '19:00', in: '01:50', in_day: 1, block: '6:50' }),
    leg(2, { flight: 'EK9', from: 'BKK', to: 'DXB', kind: 'deadhead', role: 'DH1', block: '6:05' }),
    leg(3, { flight: null, from: 'DXB', to: 'DXB', loc: 'TRC', kind: 'ground', role: 'TRN', block: '4:00' }),
    leg(4, { flight: null, from: null, to: null, loc: null, kind: 'unknown', role: null, block: null, out: null, in: null }),
  ],
});
daysA[0] = day(0, { code: 'OFF1', d_on: null, d_off: null, legs: [] });
daysA[1] = day(1, { code: 'VAC', d_on: null, d_off: null, legs: undefined });
const rA = await submitR(roster(daysA));
ok(rA.ok === true && rA.dup === false && rA.days === 10 && rA.replaced === 0,
   `通る → days ${rA.days} / replaced ${rA.replaced}`, JSON.stringify(rA));
ok(rA.legs === 7 * 2 + 4, `便は 7日×2 ＋ 4 = 18 本 → ${rA.legs}`);
ok(await cnt('pv_roster_days') === 10 && await cnt('pv_roster_legs') === 18, '表に 10日・18便');
{
  const r = await myRoster();
  ok(r.ok === true && r.days.length === 10, `my_roster が10日を返す → ${r.days.length}`);
  ok(r.days.every((x, i, a) => i === 0 || a[i - 1].date < x.date), '日付の順に並ぶ');
  const d3 = r.days.find((x) => x.date === D(3));
  ok(d3 && d3.d_on === '18:00' && d3.d_off === '02:10' && d3.d_off_day === 1, '日をまたぐ解散（02:10・翌日）がそのまま返る', JSON.stringify(d3 && { on: d3.d_on, off: d3.d_off, k: d3.d_off_day }));
  ok(d3 && d3.legs.map((l) => l.seq).join() === '1,2,3,4', '便は順番どおり');
  const [l1, l2, l3, l4] = d3 ? d3.legs : [];
  ok(l1 && l1.in === '01:50' && l1.in_day === 1 && l1.block === '6:50' && l1.block_min === 410,
     `到着が翌日の便・ブロック 6:50 = 410分 → ${l1 && l1.block_min}`);
  ok(l2 && l2.kind === 'deadhead' && !('role' in l2), '回送は deadhead・★乗務の区分（送った DH1）は持たない（鍵ごと無い）');
  ok(l3 && l3.kind === 'ground' && l3.from === null && l3.to === null && l3.loc === 'TRC',
     '★地上業務に空港を作らない（送られてきた DXB→DXB を落とし、場所は loc だけ）');
  ok(l4 && l4.kind === 'unknown' && l4.block === null && l4.block_min === null, '分からない便は unknown・ブロック null（0 にしない）');
  const d0 = r.days.find((x) => x.date === D(0));
  ok(d0 && d0.code === 'OFF1' && d0.d_on === null && d0.legs.length === 0, '休みの日（OFF1・時刻なし・便なし）');
  const d5 = r.days.find((x) => x.date === D(5));
  ok(d5 && d5.legs[0].block === '7:17' && d5.legs[0].block_min === 437 && d5.legs[0].from === 'DXB' && !('role' in d5.legs[0]),
     'ふつうの便：7:17 = 437分・DXB（送った CAP は返らない）');
  ok(r.days.every((x) => x.legs.every((l) => !('role' in l))), '★読む口は乗務の区分を返さない（鍵ごと無い）');
  ok(!(await rows(`select 1 from pg_attribute where attrelid = 'public.pv_roster_legs'::regclass and attname in ('role', 'role_raw') and not attisdropped`)).length,
     '★便の表に乗務の区分の列が無い（ほかの乗員の CAP／FO だったため）');
  ok(!/"(CAP|DH1|TRN)"/.test(JSON.stringify(await rows(`select to_jsonb(l) j from public.pv_roster_legs l`))), '★表のどの欄にも送った区分（CAP・DH1・TRN）が無い');
  ok(d5 && d5.doc_id === rA.doc_id && d5.page === 1 && d5.row === 6, '日がどのファイル・何ページ何行目かを持つ');
  ok(r.profile === null, 'まだ読み方を答えていない → profile は null');
  ok(r.days.every((x) => x.legs.every((l) => !('flight' in l))), '★読む口は便名を返さない（鍵ごと無い）');
  ok(!(await rows(`select 1 from pg_attribute where attrelid = 'public.pv_roster_legs'::regclass and attname = 'flight' and not attisdropped`)).length,
     '★便の表に便名の列が無い（送った EK101 はどこにも残らない）');
  ok(!JSON.stringify(await rows(`select to_jsonb(l) j from public.pv_roster_legs l`)).includes('EK'), '★表のどの欄にも便名の字が無い');
}

// ── 2. 同じファイルの二度目 ─────────────────────────────────────
console.log('\n▼ 同じファイルをもう一度');
{
  const again = await submitR(roster(daysA.map((d) => ({ ...d, code: 'XX' }))));
  ok(again.ok === true && again.dup === true && again.doc_id === rA.doc_id, '同じ指紋 → dup:true・何もしない');
  ok(await cnt('pv_roster_docs') === 1 && await cnt('pv_roster_days') === 10 && await cnt('pv_roster_legs') === 18,
     '表は1文字も変わらない');
  ok((await myRoster()).days.every((d) => d.code !== 'XX'), '中身も前のまま');
}

// ── 3. 重なる2本目（5〜14日目）─────────────────────────────────
console.log('\n▼ 期間が重なる2本目（日付で入れ替わる）');
const daysB = [];
for (let n = 5; n < 15; n++) daysB.push(day(n, { legs: [leg(1, { flight: 'EK999', block: '1:00' })] }));
const rB = await submitR(roster(daysB, { file_sha: sha(2) }));
ok(rB.ok && rB.days === 10 && rB.replaced === 5, `重なった5日だけ入れ替わる → replaced ${rB.replaced}`);
{
  const r = await myRoster();
  ok(r.days.length === 15, `日は 0〜14 の15日（二重に数えない）→ ${r.days.length}`);
  const over = r.days.filter((d) => d.date >= D(5) && d.date <= D(9));
  ok(over.every((d) => d.doc_id === rB.doc_id), '重なった日は新しいファイルのもの');
  ok(over.every((d) => d.legs.length === 1 && d.legs[0].block_min === 60),
     '★入れ替わった日に古い便が1本も残らない');
  ok(r.days.filter((d) => d.date < D(5)).every((d) => d.doc_id === rA.doc_id), '重ならない日は前のファイルのまま');
  const blk = Number((await one(`select sum(block_min) s from pv_roster_legs`)).s);
  ok(blk === 2 * (437 + 470) + (410 + 365 + 240) + 10 * 60, `ブロックの合計が二重に数えられていない → ${blk}`);
}

// ── 4. 改訂版（同じ期間・中身が違う）───────────────────────────
console.log('\n▼ 改訂版を出し直す');
const daysC = daysB.map((d) => ({ ...d, code: 'REV', legs: [leg(1, { flight: 'EK777' }), leg(2, { flight: 'EK778' })] }));
const rC = await submitR(roster(daysC, { file_sha: sha(3) }));
ok(rC.ok && rC.replaced === 10, `改訂版は10日とも入れ替わる → ${rC.replaced}`);
{
  const r = await myRoster();
  ok(r.days.length === 15, '日数は15のまま');
  ok(r.days.filter((d) => d.date >= D(5)).every((d) => d.code === 'REV' && d.legs.map((l) => l.block_min).join() === '437,437'),
     '改訂版の中身だけが残る');
  const docs = (await myDocs()).docs;
  const own = Object.fromEntries(docs.map((d) => [d.id, d.days_owned]));
  ok(docs.length === 3 && own[rA.doc_id] === 5 && own[rB.doc_id] === 0 && own[rC.doc_id] === 10,
     `ファイル一覧：まだ持っている日 A=5・B=0・C=10 → ${JSON.stringify(Object.values(own))}`);
  const a = docs.find((d) => d.id === rA.doc_id);
  ok(a && a.days === 10 && a.date_from === D(0) && a.date_to === D(9) && a.pages === 2 && a.file_sha === sha(1),
     '一覧に取り込んだときの日数・日付の幅・ページ数・指紋', JSON.stringify(a));
  ok(docs[0].id === rC.doc_id, '新しい順');
  ok(!JSON.stringify(docs).includes('proof_hash'), '一覧に鍵（proof_hash）を出さない');
}

// ── 5. ほかの会員 ──────────────────────────────────────────────
console.log('\n▼ ほかの会員は読めない・消せない');
await asUser(2);
{
  const r = await myRoster();
  ok(r.ok && r.days.length === 0 && r.profile === null, '同じ会社でも、ほかの人の日は1日も返らない');
  ok((await myDocs()).docs.length === 0, 'ほかの人のファイル一覧も返らない');
  const d = await delDoc(rC.doc_id, 'emirates');
  ok(d.ok && d.deleted === false, 'ほかの人のファイルは消せない（deleted:false）');
  ok(await cnt('pv_roster_docs') === 3 && await cnt('pv_roster_days') === 15, '何も消えていない');
  const r2 = await submitR(roster([day(5), day(6)], { file_sha: sha(1) }));
  ok(r2.ok && r2.dup === false && r2.replaced === 0, '同じ指紋・同じ日付でも、ほかの人の提出は別もの（dup にも入れ替えにもならない）');
}
await asUser(1);
ok((await myRoster()).days.length === 15, '本人の日はそのまま15日');

// ── 6. 消す ───────────────────────────────────────────────────
console.log('\n▼ ファイルを消す');
{
  const d = await delDoc(rA.doc_id);
  ok(d.ok && d.deleted === true && d.days === 5, `A を消すと、まだ A が持っていた5日だけ消える → ${d.days}`);
  const r = await myRoster();
  ok(r.days.length === 10 && r.days.every((x) => x.date >= D(5)), '5〜14日目（C のもの）は残る');
  ok(Number((await one(`select count(*) n from pv_roster_legs l join pv_roster_days d using (proof_hash, duty_date) where d.duty_date < $1::date`, [D(5)])).n) === 0
     && Number((await one(`select count(*) n from pv_roster_legs where duty_date < $1::date`, [D(5)])).n) === 0,
     '消した日の便も残らない');
  const again = await delDoc(rA.doc_id);
  ok(again.deleted === false, 'もう無いファイルは deleted:false');
  const b = await delDoc(rB.doc_id, 'emirates');
  ok(b.deleted === true && b.days === 0 && (await myRoster()).days.length === 10, '持っている日が0のファイルを消しても、日は減らない');
}

// ── 7. 呼べる人 ────────────────────────────────────────────────
console.log('\n▼ anon・直接の読み書き');
await db.exec(`set role anon`);
for (const [sql, label] of [
  [`select submit_roster('{}'::jsonb)`, 'submit_roster'],
  [`select edit_roster_day('emirates', null, '{}'::jsonb)`, 'edit_roster_day'],
  [`select my_roster('emirates', null, null, null)`, 'my_roster'],
  [`select my_roster_docs('emirates', null)`, 'my_roster_docs'],
  [`select delete_roster_doc(gen_random_uuid())`, 'delete_roster_doc'],
  [`select set_roster_profile('emirates', null, '{}'::jsonb)`, 'set_roster_profile'],
  [`select set_line_map('emirates', null, 'k:base_pay', 0, 'confirmed', null)`, 'set_line_map'],
  [`select my_report_items()`, 'my_report_items'],
  [`select my_roster_airline_codes('emirates', null)`, 'my_roster_airline_codes'],
  [`select count(*) from public.pv_roster_days`, '表 pv_roster_days'],
  [`select count(*) from public.pv_roster_legs`, '表 pv_roster_legs'],
  [`select count(*) from public.pv_line_map`, '表 pv_line_map'],
  [`select count(*) from public.pv_roster_edit_quota`, '表 pv_roster_edit_quota'],
  [`select count(*) from public.pv_roster_airline_codes`, '表 pv_roster_airline_codes'],
]) {
  const e = await boom(sql);
  ok(e && /permission denied/i.test(e.msg), `anon は ${label} を使えない`, e ? e.msg.slice(0, 60) : '通ってしまった');
}
await db.exec(`reset role`);
await db.exec(`set role authenticated`);
for (const t of ['pv_roster_profile', 'pv_roster_docs', 'pv_roster_days', 'pv_roster_legs', 'pv_line_map', 'pv_roster_edit_quota',
                 'pv_roster_airline_codes', 'pv_test_users']) {
  const e = await boom(`select count(*) from public.${t}`);
  ok(e && /permission denied/i.test(e.msg), `ログイン済みでも表 ${t} は直接読めない`);
}
{
  const e = await boom(`delete from public.pv_roster_days`);
  ok(e && /permission denied/i.test(e.msg), 'ログイン済みでも表を直接消せない');
  const k = await boom(`select pv_roster_key($1::uuid, 'emirates', null)`, [uid(1)]);
  ok(k && /permission denied/i.test(k.msg), '★鍵の式（pv_roster_key）を直接呼べない（他人の鍵を作れない）');
  const c = await boom(`select pv_roster_clean_day('{}'::jsonb, 1)`);
  ok(c && /permission denied/i.test(c.msg), '1日の組み直し（pv_roster_clean_day）も直接は呼べない');
  const rc = await boom(`select pv_roster_airline_recount('emirates')`);
  const ra = await boom(`select pv_roster_airline_recount_all()`);
  ok(rc && /permission denied/i.test(rc.msg) && ra && /permission denied/i.test(ra.msg), '会社の辞書の数え直しも直接は呼べない');
}
await db.exec(`reset role`);

console.log('\n▼ 未ログイン');
await logout();
for (const [sql, label, params] of [
  [`select submit_roster($1::jsonb)`, 'submit_roster', [JSON.stringify(roster([day(1)], { file_sha: sha(90) }))]],
  [`select edit_roster_day('emirates', null, $1::jsonb)`, 'edit_roster_day', [JSON.stringify({ date: D(5), day: null })]],
  [`select my_roster('emirates', null, null, null)`, 'my_roster'],
  [`select my_roster_docs('emirates', null)`, 'my_roster_docs'],
  [`select delete_roster_doc($1::uuid)`, 'delete_roster_doc', [rC.doc_id]],
  [`select set_roster_profile('emirates', null, '{}'::jsonb)`, 'set_roster_profile'],
  [`select set_line_map('emirates', null, 'k:base_pay', 0, 'confirmed', null)`, 'set_line_map'],
  [`select my_report_items()`, 'my_report_items'],
  [`select my_roster_airline_codes('emirates', null)`, 'my_roster_airline_codes'],
]) {
  const e = await boom(sql, params);
  ok(e && e.code === '42501' && e.msg.includes('ログイン'), `未ログインの ${label} は 42501`, e ? `${e.code} ${e.msg.slice(0, 40)}` : '通ってしまった');
}
ok(await cnt('pv_roster_docs') === 2, '（未ログインの呼び出しで何も変わっていない）');

// ── 8. 検品 ───────────────────────────────────────────────────
console.log('\n▼ 不正な中身は弾く（何も書かない）');
await asUser(4);
const base = () => roster([day(20), day(21)], { file_sha: sha(400) });
const withDay = (patch) => { const p = base(); p.days[0] = { ...p.days[0], ...patch }; return p; };
const withLeg = (patch) => { const p = base(); p.days[0] = { ...p.days[0], legs: [{ ...leg(1), ...patch }] }; return p; };
const before = await cnt('pv_roster_docs');
const bad = [
  ['勤務コードが小文字（off1）', withDay({ code: 'off1' })],
  ['勤務コードに空白（氏名の形）', withDay({ code: 'JOHN SMITH' })],
  ['勤務コードが13文字', withDay({ code: 'ABCDEFGHIJKLM' })],
  ['勤務コードが数値', withDay({ code: 123 })],
  ['空港コードが5文字', withLeg({ from: 'TOKYO' })],
  ['空港コードが小文字', withLeg({ to: 'lhr' })],
  ['勤務コードが印の形でない（#xyz）', withDay({ code: '#xyz' })],
  ['勤務コードの印が大文字の16進', withDay({ code: '#0123456789ABCDEF' })],
  ['勤務コードの印が17字', withDay({ code: '#0123456789abcdef0' })],
  ['勤務コードの印に # が無い', withDay({ code: '0123456789abcdef' })],
  ['勤務コードが漢字（公休）', withDay({ code: '公休' })],
  ['場所が文章', withLeg({ loc: 'Training Center' })],
  ['時刻の頭の0が無い（7:05）', withLeg({ out: '7:05' })],
  ['時刻が25:00', withDay({ d_on: '25:00' })],
  ['ブロックが24時間を超える', withLeg({ block: '25:01' })],
  ['ブロックの分が1桁', withLeg({ block: '1:7' })],
  ['解散の日が3', withDay({ d_off_day: 3 })],
  ['到着の日がマイナス', withLeg({ in_day: -1 })],
  ['在り得ない日付（2月30日）', withDay({ date: '2026-02-30' })],
  ['日付が401日先', withDay({ date: addDays(TODAY, 401) })],
  ['日付が401日前', withDay({ date: addDays(TODAY, -401) })],
  ['日付の形が違う', withDay({ date: '2026/01/05' })],
  ['日付が無い', withDay({ date: null })],
  ['同じ日付が2回', (() => { const p = base(); p.days[1] = { ...p.days[1], date: p.days[0].date }; return p; })()],
  ['便の順番が重なる', (() => { const p = base(); p.days[0].legs = [leg(1), leg(1)]; return p; })()],
  ['便の順番が0', withLeg({ seq: 0 })],
  ['便の順番が無い', withLeg({ seq: null })],
  ['便の種類が知らない言葉', withLeg({ kind: 'flying' })],
  ['ページがページ数より大きい', withDay({ page: 3 })],
  ['ファイルの指紋が大文字', { ...base(), file_sha: sha(400).toUpperCase().replace(/^0/, () => 'A') }],
  ['ファイルの指紋が短い', { ...base(), file_sha: 'abc123' }],
  ['ページ数が0', { ...base(), pages: 0 }],
  ['ページ数が61', { ...base(), pages: 61 }],
  ['日が0日', { ...base(), days: [] }],
  ['日が配列でない', { ...base(), days: { a: 1 } }],
  ['日が63日', { ...base(), days: Array.from({ length: 63 }, (_, i) => day(i, { legs: [] })) }],
  ['1日の便が17本', (() => { const p = base(); p.days[0].legs = Array.from({ length: 17 }, (_, i) => leg(i + 1)); return p; })()],
  ['400KB を超える', { ...base(), junk: 'x'.repeat(410 * 1024) }],
  ['会社コードが不正', { ...base(), airline: 'nope-air' }],
  ['会社が空', { ...base(), airline: '' }],
  ['「その他」なのに社名が無い', { ...base(), airline: 'other', airline_other: '  ' }],
  ['期間が逆さま', { ...base(), period: { from: D(30), to: D(1) } }],
  ['期間の形が違う', { ...base(), period: '2026-01' }],
];
for (const [label, p] of bad) {
  const e = await trySubmit(p);
  ok(e && /^(22023|54000)$/.test(e.code) && /ロスター|会社|社名/.test(e.msg), `弾く：${label}${e ? ' → ' + e.msg.split(' / ')[0].slice(0, 36) : ''}`, e ? e.code : '通ってしまった');
}
ok(await cnt('pv_roster_docs') === before, `弾いた提出は1件も残っていない → ${await cnt('pv_roster_docs') - before}`);
{
  // 便名は検品もしない（保存しない欄で止めない）。空白入り・文章でも通り、どこにも残らない
  await db.exec('begin');
  const r = await submitR(withLeg({ flight: 'EK 101 Captain Smith' }));
  const left = JSON.stringify(await rows(`select to_jsonb(l) j from public.pv_roster_legs l`));
  await db.exec('rollback');
  ok(r && r.ok === true && !left.includes('Smith') && !left.includes('EK 101'), '★便名の欄は何が来ても落とすだけ（通る・どこにも残らない）');
}
{
  // エラーの文に、送られてきた値を書かない
  const e = await trySubmit(withDay({ code: 'Jane Q Example' }));
  ok(e && !e.msg.includes('Jane'), 'エラーの文に送られてきた値（名前の形）を書かない');
}

console.log('\n▼ 知らないキー（氏名・自由記述）は落とす');
{
  const p = base();
  p.note = 'Captain Alex Mercer swapped with FO Kai Example';
  p.crew = ['Alex Mercer', 'Kai Example'];
  p.days[0].name = 'Alex Mercer';
  p.days[0].remarks = 'hotel shuttle 18:00';
  p.days[0].legs[0].crew = 'Kai Example';
  p.days[0].legs[0].text = 'free text';
  const r = await submitR(p);
  ok(r.ok && r.days === 2, '知らないキーがあっても提出は通る');
  const all = await dump();
  ok(!/Mercer|Kai Example|shuttle|free text|remarks|crew|"note"|"name"/.test(all),
     '★表のどこにも名前・自由記述・知らないキーが残っていない');
  const back = JSON.stringify(await myRoster());
  ok(!/Mercer|Example|shuttle|free text/.test(back), '読み返しても出てこない');
}

console.log('\n▼ 乗務の区分は黙って落とす・勤務コードの印（#＋16進16字）は通る');
// （手で直す口の道具は下の 11-c で定義する。ここでは同じ形をその場で作る）
const editNow = async (date, d) =>
  (await one(`select edit_roster_day('emirates', null, $1::jsonb) r`, [JSON.stringify({ date, day: d })])).r;
const eday0 = (x = {}) => ({ code: null, d_on: '06:00', d_off: '15:00', d_off_day: 0, legs: [leg(1)], ...x });
{
  // 古い画面（キャッシュの JS）が区分を送ってきても止めない。どんな形でも落とすだけ。
  await db.exec('begin');
  const p = roster([day(22, { legs: [leg(1, { role: 'Captain Smith' }), leg(2, { role: 'FO', from: 'LHR', to: 'DXB' }), leg(3, { role: 12 })] })],
                   { file_sha: sha(410) });
  const r = await submitR(p);
  const left = JSON.stringify(await rows(`select to_jsonb(l) j from public.pv_roster_legs l`));
  await db.exec('rollback');
  ok(r && r.ok === true && r.legs === 3 && !/Smith|"FO"|Captain/.test(left),
     '★便に乗務の区分（文章・FO・数）が付いていても提出は通り、どこにも残らない', JSON.stringify(r));
  const e = await editNow(D(23), eday0({ cat: 'off', legs: [leg(1, { role: 'Captain Smith' })] }));
  const left2 = JSON.stringify(await rows(`select to_jsonb(l) j from public.pv_roster_legs l`));
  ok(e.ok && e.legs === 1 && !/Smith|Captain/.test(left2), '★手で直す口も同じ（区分は黙って落ちる）');
  {
    // 読み取りが日に付ける分類（cat）は保存しない（知らないキーとして落ちる・止めない）
    const r2 = await submitR(roster([day(27, { cat: 'leave', code: 'VAC', d_on: null, d_off: null, legs: [] }),
                                     day(28, { cat: 'unclear' })], { file_sha: sha(430) }));
    const back = (await myRoster()).days.filter((d) => [D(23), D(27), D(28)].includes(d.date));
    ok(r2.ok && r2.days === 2 && back.length === 3 && back.every((d) => !('cat' in d))
       && !/"cat"|leave|unclear/.test(await dump()),
       '★日の分類（cat）は出す口・手で直す口とも黙って落ちる（どこにも残らない・読む口も返さない）');
  }
  await editNow(D(23), null);
  await db.query(`delete from public.pv_roster_docs where manual and proof_hash = public.pv_roster_key($1::uuid, 'emirates', null)`, [uid(4)]);
}
{
  const TOK = '#0123456789abcdef', TOK2 = '#fedcba9876543210';
  const r = await submitR(roster([day(24, { code: TOK, d_on: null, d_off: null, legs: [] }), day(25, { code: 'SBY' })], { file_sha: sha(420) }));
  ok(r.ok && r.days === 2, '勤務コードが印（#＋小文字の16進16字）の日を出せる');
  const back = (await myRoster()).days;
  ok(back.find((d) => d.date === D(24))?.code === TOK && back.find((d) => d.date === D(25))?.code === 'SBY',
     '★印はそのまま保存され、読む口がそのまま返す（英字のコードも今までどおり）');
  const e = await editNow(D(26), eday0({ code: TOK2, d_on: null, d_off: null, legs: [] }));
  ok(e.ok && (await myRoster()).days.find((d) => d.date === D(26))?.code === TOK2, '手で直す口も印を受け付ける');
  await editNow(D(26), null);
}

// ── 9. 1日30本まで ─────────────────────────────────────────────
console.log('\n▼ 1日に取り込めるのは30本まで');
await asUser(3);
{
  let first = null, okN = 0;
  for (let i = 0; i < 30; i++) {
    const r = await submitR(roster([day(1)], { file_sha: sha(1000 + i) }));
    if (r.ok && !r.dup) okN++;
    if (i === 0) first = r;
  }
  ok(okN === 30, `30本までは通る → ${okN}`);
  const e = await trySubmit(roster([day(1)], { file_sha: sha(2000) }));
  ok(e && e.code === '54000' && e.msg.includes('上限'), `31本目は止まる → ${e ? e.code : '通った'}`);
  const dup = await submitR(roster([day(1)], { file_sha: sha(1000) }));
  ok(dup.ok && dup.dup === true && dup.doc_id === first.doc_id, '上限のあとでも、同じファイルの二度目は dup で返る（エラーにしない）');
  ok((await myRoster()).days.length === 1, '同じ日を30回出しても日は1日のまま');
  await asUser(5);
  ok((await submitR(roster([day(1)], { file_sha: sha(2000) }))).ok, 'ほかの人は数に入らない');
}

// ── 10. 読み方 ─────────────────────────────────────────────────
console.log('\n▼ 読み方（profile）');
await asUser(1);
{
  const r = await setProfile({ kind: 'actual', time_ref: 'utc', tz: 'Asia/Dubai', time_meaning: 'block',
                               codes: { OFF1: 'off', VAC: 'vac', SBY: 'standby', TRN: 'training' },
                               share_company: true, name: 'Alex Mercer' });
  ok(r.ok && r.profile.kind === 'actual' && r.profile.time_ref === 'utc' && r.profile.tz === 'Asia/Dubai'
     && r.profile.time_meaning === 'block' && r.profile.share_company === true && r.profile.codes.SBY === 'standby',
     '保存できる', JSON.stringify(r));
  ok(!JSON.stringify(r).includes('Mercer') && !(await dump()).includes('Mercer'), '知らないキー（name）は落ちる');
  const r2 = await setProfile({ kind: 'planned' });
  ok(r2.profile.kind === 'planned' && r2.profile.tz === 'Asia/Dubai' && r2.profile.codes.OFF1 === 'off',
     '在るキーだけ書き換わる（ほかは前のまま）');
  const r3 = await setProfile({ tz: null, codes: { OFF: 'off' } });
  ok(r3.profile.tz === null && JSON.stringify(r3.profile.codes) === '{"OFF":"off"}', 'null で消せる・codes は丸ごと置き換え');
  ok((await myRoster()).profile.kind === 'planned', 'my_roster が読み方を一緒に返す');
  // 空欄の日の意味（blank）：off / none / null（まだ答えていない）
  ok(r3.profile.blank === null && 'blank' in r3.profile, 'まだ答えていない空欄の意味は null（キーは在る）');
  const b1 = await setProfile({ blank: 'off' });
  const b2 = await setProfile({ kind: 'planned' });
  ok(b1.profile.blank === 'off' && b2.profile.blank === 'off', '空欄の意味 off を保存できる・ほかのキーだけ書いても前のまま');
  const b3 = await setProfile({ blank: 'none' });
  ok(b3.profile.blank === 'none' && (await myRoster()).profile.blank === 'none', '空欄の意味 none を保存できる・my_roster も返す');
  const b4 = await setProfile({ blank: null });
  ok(b4.profile.blank === null, '空欄の意味は null で「まだ答えていない」に戻せる');
  // ★2026-11-11 給与明細に出る月（pay_lag）：0 同じ月／1 翌月／2 翌々月／-1 わからない／null まだ聞いていない
  ok(b4.profile.pay_lag === null && 'pay_lag' in b4.profile, 'まだ聞いていない「明細に出る月」は null（キーは在る）');
  const g1 = await setProfile({ pay_lag: 1 });
  const g2 = await setProfile({ kind: 'actual' });
  ok(g1.profile.pay_lag === 1 && g2.profile.pay_lag === 1, '「翌月」を保存できる・ほかのキーだけ書いても前のまま');
  const g3 = await setProfile({ pay_lag: -1 });
  ok(g3.profile.pay_lag === -1 && (await myRoster()).profile.pay_lag === -1, '「わからない」（-1）も答えとして残る・my_roster も返す');
  const g4 = await setProfile({ pay_lag: null });
  ok(g4.profile.pay_lag === null, 'null で「まだ聞いていない」に戻せる');
  await setProfile({ kind: 'planned' });
  // 勤務コードのキーに読み取りの印（#＋小文字の16進16字）
  const tk = await setProfile({ codes: { OFF: 'off', '#0123456789abcdef': 'vac', '#a0b1c2d3e4f5a6b7': 'unknown' } });
  ok(tk.ok && tk.profile.codes['#0123456789abcdef'] === 'vac' && tk.profile.codes['#a0b1c2d3e4f5a6b7'] === 'unknown',
     '★読み方の codes のキーに読み取りの印を使える', JSON.stringify(tk.profile.codes));
  /* ★2026-11-12 オーナー「わからないの他にその他」：勤務コードの意味に other（その他）を受け付ける */
  const ot = await setProfile({ codes: { OFF: 'off', S4N: 'other' } });
  ok(ot.ok && ot.profile.codes.S4N === 'other', '★勤務コードの意味に「その他」（other）を受け付ける', JSON.stringify(ot.profile && ot.profile.codes));
  {
    const air = (await one(`select airline from public.pv_roster_profile where proof_hash = public.pv_roster_key($1::uuid, 'emirates', null)`, [uid(1)])).airline;
    ok(air === 'emirates', `★読み方の行に会社（一覧の会社コード）が入る → ${air}`);
  }
  await setProfile({ codes: { OFF: 'off' } });
  const badP = [
    ['知らないタイムゾーン', { tz: 'Mars/Olympus' }],
    ['タイムゾーンが41文字', { tz: 'A'.repeat(41) }],
    ['実績・予定以外', { kind: 'maybe' }],
    ['時刻の基準が知らない言葉', { time_ref: 'gmt' }],
    ['時間の意味が知らない言葉', { time_meaning: 'credit' }],
    ['共有の答えが文字列', { share_company: 'yes' }],
    ['勤務コードが小文字', { codes: { off1: 'off' } }],
    ['勤務コードの意味が知らない言葉', { codes: { OFF1: 'party' } }],
    ['勤務コードが配列', { codes: ['OFF1'] }],
    ['勤務コードが201個', { codes: Object.fromEntries(Array.from({ length: 201 }, (_, i) => ['C' + i, 'off'])) }],
    ['勤務コードのキーが印の形でない（#xyz）', { codes: { '#xyz': 'off' } }],
    ['勤務コードのキーの印が大文字の16進', { codes: { '#0123456789ABCDEF': 'off' } }],
    ['勤務コードのキーが漢字（公休）', { codes: { '公休': 'off' } }],
    ['空欄の意味が知らない言葉', { blank: 'maybe' }],
    ['空欄の意味が大文字', { blank: 'OFF' }],
    ['空欄の意味が数', { blank: 1 }],
    ['空欄の意味が真偽', { blank: true }],
    ['明細に出る月が範囲の外（3か月あと）', { pay_lag: 3 }],
    ['明細に出る月が範囲の外（-2）', { pay_lag: -2 }],
    ['明細に出る月が字', { pay_lag: '1' }],
  ];
  for (const [label, p] of badP) {
    const e = await boom(`select set_roster_profile('emirates', null, $1::jsonb)`, [JSON.stringify(p)]);
    ok(e && /^(22023|54000)$/.test(e.code) && e.msg.includes('ロスター'), `弾く：${label}${e ? ' → ' + e.msg.slice(0, 36) : ''}`, e ? e.code : '通ってしまった');
  }
  ok((await myRoster()).profile.kind === 'planned', '弾いたあとも前の読み方のまま');
  await asUser(2);
  ok((await myRoster()).profile === null, 'ほかの人の読み方は見えない');
  await asUser(1);
  const del = await setProfile(null);
  ok(del.ok && del.deleted === true && (await myRoster()).profile === null, 'p = null で読み方を消せる');
  await setProfile({ kind: 'actual', codes: { OFF1: 'off' } });
}

// ── 11. 明細の行の答えと my_report_items ─────────────────────────
console.log('\n▼ 明細の行の答え（line map）と my_report_items');
const LAST = (await one(`select extract(year from current_date - 31)::int y, extract(month from current_date - 31)::int m`));
const PAY = {
  airline: 'emirates', position: 'cap', fleet: 'b777', currency: 'AED',
  gross_monthly: 52000, base_pay: 20000, block_hours: 85, net_pay_actual: 51000, deduction_total: 1000,
  hourly_rate: 250, period_year: LAST.y, period_month: LAST.m, lang: 'en',
  pay_items: { v: 1, variable: [{ label: 'Flying Pay', amount: 21250, basis: 'block' }], other: [{ label: 'Layover Allowance', amount: 800 }] },
  payslip_detail: { v: 1, earnings: [{ label: 'Basic Salary', amount: 20000 }], hours: [{ label: 'Block Hours', value: 85 }] },
};
await asUser(1);
{
  const s = await one(`select submit_pay_report($1::jsonb) r`, [JSON.stringify(PAY)]);
  ok(s.r.ok, '（本人が給与を出す：エミレーツ）');
  const s2 = await one(`select submit_pay_report($1::jsonb) r`, [JSON.stringify({ ...PAY, airline: 'other', airline_other: 'Sky Example Air', gross_monthly: 9000, base_pay: 4000, net_pay_actual: 8500, deduction_total: 500, currency: 'USD', pay_items: null, payslip_detail: null })]);
  ok(s2.r.ok, '（本人が給与を出す：一覧にない会社）');
  await asUser(2);
  await one(`select submit_pay_report($1::jsonb) r`, [JSON.stringify({ ...PAY, gross_monthly: 61000, net_pay_actual: 60000 })]);
  await one(`select submit_pay_report($1::jsonb) r`, [JSON.stringify({ ...PAY, airline: 'other', airline_other: 'SKY EXAMPLE AIR', gross_monthly: 7000, base_pay: 3000, net_pay_actual: 6500, deduction_total: 500, currency: 'USD', pay_items: null, payslip_detail: null })]);
  await asUser(1);

  const m1 = await setMap('k:flight_variable_pay', -1, 'confirmed', 'block');
  ok(m1.ok && m1.map.offset === -1 && m1.map.status === 'confirmed' && m1.map.qty_kind === 'block', '答えを保存できる');
  const m2 = await setMap('flying pay', 0, 'confirmed', null, 'other', 'sky example air');
  ok(m2.ok, '「一覧にない会社」の行にも答えられる（社名の大文字小文字は問わない）');
  await setMap('layover allowance', null, 'unknown');
  await setMap('k:base_pay', 0, 'confirmed');

  const it = await items();
  ok(it.ok && it.items.length === 2, `本人の明細だけ（2件・ほかの人の同じ会社・同じ社名は入らない）→ ${it.items.length}`);
  const ek = it.items.find((x) => x.airline === 'emirates');
  ok(ek && Number(ek.gross_monthly) === 52000 && Number(ek.net_pay_actual) === 51000 && Number(ek.deduction_total) === 1000
     && ek.currency === 'AED' && Number(ek.fx_to_jpy) > 0 && Number(ek.hourly_rate) === 250
     && ek.period_year === LAST.y && ek.period_month === LAST.m,
     '明細の数字が返る（総支給・手取り・控除・通貨・レート・時間単価・対象月）', JSON.stringify(ek && { g: ek.gross_monthly, n: ek.net_pay_actual }));
  ok(ek && ek.pay_items && ek.pay_items.variable[0].label === 'Flying Pay' && ek.payslip_detail && ek.payslip_detail.earnings[0].label === 'Basic Salary',
     'pay_items と payslip_detail が本人にだけ返る');
  ok(ek && Object.keys(ek).sort().join() === ['airline', 'airline_other', 'currency', 'deduction_total', 'fx_to_jpy', 'gross_monthly',
     'hourly_rate', 'job_roles', 'net_pay_actual', 'pay_items', 'payslip_detail', 'period_month', 'period_year'].sort().join(),
     '返すキーは約束の13個だけ（鍵・id・回線のハッシュを返さない）', ek ? Object.keys(ek).join() : '');
  const ot = it.items.find((x) => x.airline === 'other');
  ok(ot && ot.airline_other === 'Sky Example Air' && Number(ot.gross_monthly) === 9000, '「一覧にない会社」の明細も本人の書き方で返る');

  ok(it.maps.length === 4, `答えは4つ → ${it.maps.length}`);
  const mm = Object.fromEntries(it.maps.map((m) => [m.label_key, m]));
  ok(mm['k:flight_variable_pay'] && mm['k:flight_variable_pay'].airline === 'emirates' && mm['k:flight_variable_pay'].airline_other === null
     && mm['k:flight_variable_pay'].offset === -1 && mm['k:flight_variable_pay'].qty_kind === 'block', '答えが会社つきで返る');
  ok(mm['flying pay'] && mm['flying pay'].airline === 'other' && mm['flying pay'].airline_other === 'Sky Example Air' && mm['flying pay'].offset === 0,
     '★「一覧にない会社」の答えは本人の社名の書き方で返る（ほかの人の SKY EXAMPLE AIR を混ぜない）');
  ok(mm['layover allowance'] && mm['layover allowance'].status === 'unknown' && mm['layover allowance'].offset === null, 'unknown は offset を持たない');

  const up = await setMap('k:flight_variable_pay', 0, 'confirmed', 'block');
  ok(up.map.offset === 0 && (await items()).maps.find((m) => m.label_key === 'k:flight_variable_pay').offset === 0, '同じ行は上書き');
  const u2 = await setMap('layover allowance', -3, 'unknown');
  ok(u2.map.offset === null, 'unknown に offset を送っても持たない');
  const dl = await setMap('k:base_pay', null, null);
  ok(dl.ok && dl.deleted === true && (await items()).maps.length === 3, 'status = null で答えを消せる');
  const ot2 = await setMap('own period line', null, 'other');
  ok(ot2.ok && ot2.map.status === 'other' && ot2.map.offset === null, '自分の期間を持つ行（other）は offset なしで保存できる');

  const badM = [
    ['offset が 2', ['k:x', 2, 'confirmed']],
    ['offset が -13', ['k:x', -13, 'confirmed']],
    ['confirmed なのに offset が無い', ['k:x', null, 'confirmed']],
    ['status が知らない言葉', ['k:x', 0, 'maybe']],
    ['名前が空', ['', 0, 'confirmed']],
    ['名前が81字', ['a'.repeat(81), 0, 'confirmed']],
    ['名前に制御文字', ['a\u0001b', 0, 'confirmed']],
    ['数量の種類が大文字・記号', ['k:x', 0, 'confirmed', 'Block!']],
    ['会社が不正', ['k:x', 0, 'confirmed', null, 'nope-air']],
  ];
  for (const [label, args] of badM) {
    const e = await trySetMap(...args);
    ok(e && e.code === '22023' && /明細|会社/.test(e.msg), `弾く：${label}${e ? ' → ' + e.msg.slice(0, 36) : ''}`, e ? e.code : '通ってしまった');
  }

  await asUser(2);
  const it2 = await items();
  ok(it2.items.length === 2 && it2.items.every((x) => Number(x.gross_monthly) !== 52000) && it2.maps.length === 0,
     'ほかの人には本人の明細も答えも1件も返らない');
  await asUser(6);
  const it3 = await items();
  ok(it3.ok && it3.items.length === 0 && it3.maps.length === 0, '何も出していない人には空の一覧');
  await asUser(1);
}

// 「一覧にない会社」の勤務表：社名を渡せば読める・消せる（ロスターの表は社名を持たない）
console.log('\n▼ 「一覧にない会社」の勤務表');
await asUser(7);
{
  const r = await submitR(roster([day(2)], { airline: 'other', airline_other: 'Example Charter Co', file_sha: sha(700) }));
  ok(r.ok && r.days === 1, '出せる');
  ok((await myRoster('other', 'EXAMPLE CHARTER CO')).days.length === 1, '社名の大文字小文字を問わず読める');
  ok((await myRoster('emirates')).days.length === 0, 'ほかの会社の勤務表とは混ざらない');
  ok((await delDoc(r.doc_id)).deleted === false, '社名を渡さないと（給与も無い会社なので）見つからない');
  ok((await delDoc(r.doc_id, 'other', 'example charter co')).deleted === true, '社名を渡せば消せる');
}

console.log('\n▼ 期間');
await asUser(1);
{
  ok((await myRoster('emirates', null, D(5), D(6))).days.length === 2, '期間で絞れる');
  const e = await boom(`select my_roster('emirates', null, $1::date, $2::date)`, [D(0), addDays(D(0), 401)]);
  ok(e && e.code === '22023', '401日の幅は弾く（400日まで）');
  const e2 = await boom(`select my_roster('emirates', null, $1::date, $2::date)`, [D(9), D(1)]);
  ok(e2 && e2.code === '22023', '逆さまの期間は弾く');
}

// ── 11-b. 2年より前の日は月の合計にまとめて消す ─────────────────────
console.log('\n▼ 2年より前の日は月の合計にまとめて消す（取引の中で試して巻き戻す）');
{
  // 画面の数え方（pv-report-engine.js）を node の vm で読み、まとめた合計と1分も違わないかを見る
  const win = { document: { documentElement: { getAttribute: () => 'ja' }, addEventListener() {} }, addEventListener() {} };
  win.window = win;
  const ctx = vm.createContext(win);
  vm.runInContext(read('pay-viz.js'), ctx);
  vm.runInContext(read('pv-report-engine.js'), ctx);
  const R = win.PVReport;
  const sumOf = (gs, f) => gs.reduce((a, g) => a + f(g), 0);
  const KINDS = ['operating', 'deadhead', 'ground', 'unknown'];
  const same = (E, row, codes) => {          // codes: 意味を当てたコード（{OFF1:'off'} など）
    const e = E.find((x) => x.ym === row.ym.slice(0, 7));
    if (!e) return 'engine に月が無い';
    const cls = (g) => (g.code && codes[g.code]) || null;
    const duty = row.groups.filter((g) => cls(g) !== 'off' && cls(g) !== 'vac');
    const want = {
      covered: e.coveredDays, dutyDays: e.partial.dutyDays, dutyMin: e.partial.dutyMin, dutyGaps: e.gaps.duty,
      off: e.partial.offDays, vac: e.partial.vacDays,
      sectors: e.partial.sectors, dh: e.partial.dhLegs, gnd: e.partial.groundLegs, unk: e.partial.unknownLegs,
      ...Object.fromEntries(KINDS.flatMap((k) => [['b_' + k, e.partial.blockMin[k]], ['g_' + k, e.gaps.block[k]]])),
    };
    const got = {
      covered: row.covered_days, dutyDays: sumOf(duty, (g) => g.duty_days), dutyMin: sumOf(duty, (g) => g.duty_min),
      dutyGaps: sumOf(duty, (g) => g.duty_days - g.timed_days),
      off: sumOf(row.groups.filter((g) => cls(g) === 'off'), (g) => g.days),
      vac: sumOf(row.groups.filter((g) => cls(g) === 'vac'), (g) => g.days),
      sectors: sumOf(row.groups, (g) => g.legs.operating.n), dh: sumOf(row.groups, (g) => g.legs.deadhead.n),
      gnd: sumOf(row.groups, (g) => g.legs.ground.n), unk: sumOf(row.groups, (g) => g.legs.unknown.n),
      ...Object.fromEntries(KINDS.flatMap((k) => [['b_' + k, sumOf(row.groups, (g) => g.legs[k].block_min)],
                                                  ['g_' + k, sumOf(row.groups, (g) => g.legs[k].gaps)]])),
    };
    const diff = Object.keys(want).filter((k) => want[k] !== got[k]);
    return diff.length ? diff.map((k) => `${k}: engine ${want[k]} / SQL ${got[k]}`).join(' · ') : '';
  };
  const monthsOf = async (n) => (await rows(
    `select m.ym::text ym, m.covered_days, m.time_basis, m.groups from public.pv_roster_months m
      where m.proof_hash = public.pv_roster_key($1::uuid, 'emirates', null) order by m.ym`, [uid(n)]));
  const compact = async (today) => (await one(`select public.pv_roster_compact($1::date) r`, [today])).r;
  const ymStart = (iso) => iso.slice(0, 7) + '-01';
  const plus24m = (iso) => { const [y, m] = iso.split('-').map(Number); return `${y + 2}-${String(m).padStart(2, '0')}-01`; };

  await db.exec('begin');
  // 会員7：時刻の基準は UTC。休み・休暇・ふつう・日またぎ・時刻なしの便・時刻だけの地上・逆さまの時刻・スタンバイ・次の月
  await asUser(7);
  await setProfile({ time_ref: 'utc' });
  const L = (seq, x = {}) => leg(seq, { flight: 'ZZ' + seq, ...x });
  const days7 = [
    day(2, { code: 'OFF1', d_on: null, d_off: null, legs: [] }),
    day(3, { code: 'VAC', d_on: null, d_off: null, legs: [] }),
    day(5, { legs: [L(1), L(2, { from: 'LHR', to: 'DXB', out: '16:00', in: '23:50', block: '7:50' })] }),
    day(6, { d_on: '22:00', d_off: '06:30', d_off_day: 1,
             legs: [L(1, { out: '23:00', in: '05:10', in_day: 1, block: null }), L(2, { kind: 'deadhead', role: 'DH1', block: '1:00' })] }),
    day(7, { d_on: null, d_off: null, legs: [L(1, { out: null, in: null, block: null })] }),
    day(8, { d_on: '09:00', d_off: '17:00', legs: [L(1, { from: null, to: null, loc: 'TRC', kind: 'ground', role: 'TRN', block: '4:00' })] }),
    day(9, { d_on: '10:00', d_off: '09:00', legs: [] }),
    day(10, { code: 'SBY', d_on: '06:00', d_off: '12:00', legs: [] }),
    day(35, { legs: [L(1, { kind: 'unknown', role: null, block: null, out: '08:00', in: '07:00' })] }),
    day(36, { legs: [L(1, { block: '0:00' })] }),
  ];
  const r7 = await submitR(roster(days7, { file_sha: sha(7001) }));
  const before7 = (await myRoster()).days;
  const P7 = { time_ref: 'utc', codes: {} }, C7 = { OFF1: 'off', VAC: 'vac', SBY: 'standby' };
  const E7 = R.rosterMonths(before7, P7), E7c = R.rosterMonths(before7, { ...P7, codes: C7 });

  // 会員8：ロンドンの現地時刻・夏時間が切り替わる夜をまたぐ勤務（engine は夏時間込みで数える）
  const lastSun = (y, m) => { const t = new Date(Date.UTC(y, m, 0)); t.setUTCDate(t.getUTCDate() - t.getUTCDay()); return t.toISOString().slice(0, 10); };
  const y0 = Number(TODAY.slice(0, 4));
  const dst = [lastSun(y0, 10), lastSun(y0, 3), lastSun(y0 - 1, 10), lastSun(y0 - 1, 3)]
    .map((d) => addDays(d, -1)).filter((d) => d >= addDays(TODAY, -390) && d <= addDays(TODAY, -1))[0];
  await asUser(8);
  await setProfile({ time_ref: 'local', tz: 'Europe/London' });
  const r8 = await submitR(roster([{ ...day(0, { d_on: '20:00', d_off: '06:00', d_off_day: 1, legs: [] }), date: dst }], { file_sha: sha(8001) }));
  const before8 = (await myRoster()).days;
  const E8 = R.rosterMonths(before8, { time_ref: 'local', tz: 'Europe/London', codes: {} });
  ok(r7 && r7.ok && r8 && r8.ok && dst && E8[0] && E8[0].partial.dutyMin !== 600,
     `（作り物を入れた：会員7は${before7.length}日・会員8は夏時間の夜 ${dst} → engine ${E8[0] && E8[0].partial.dutyMin}分）`);

  // ① 境目は月の頭：最後の月の頭から数えて24か月後に流すと、最後の月より前だけまとまる
  await asUser(7);
  const lastYm = ymStart(D(36));
  const c1 = await compact(plus24m(lastYm));
  const left1 = (await myRoster()).days.map((d) => d.date);
  const m1 = await monthsOf(7);
  ok(c1.ok && left1.length > 0 && left1.every((d) => d >= lastYm) && m1.length >= 1 && m1.every((m) => m.ym < lastYm),
     `★境目は24か月前の月の頭（その月の日は残る・前の月だけ合計になる）→ 残り ${left1.length}日 / 合計 ${m1.map((m) => m.ym.slice(0, 7)).join(',')}`);

  // ② 全部まとめる
  const c2 = await compact(addDays(TODAY, 1000));
  const m2 = await monthsOf(7);
  ok(c2.ok && (await myRoster()).days.length === 0 && Number((await one(
       `select count(*) n from public.pv_roster_legs where proof_hash = public.pv_roster_key($1::uuid, 'emirates', null)`, [uid(7)])).n) === 0,
     '★まとめたあと日も便も残らない（読む口も0日）');
  ok(m2.length === E7.length && m2.every((m) => m.time_basis === 'utc'),
     `月の合計は月の数だけ（${m2.length}か月・数え方は utc）`);
  for (const m of m2) {
    const d0 = same(E7, m, {}), d1 = same(E7c, m, C7);
    ok(!d0 && !d1, `★${m.ym.slice(0, 7)} の合計が画面の数え方と1分も違わない（コードの意味を当てる前も・当てた後も）`, d0 + ' ' + d1);
  }
  const txt = JSON.stringify(m2);
  ok(!/\d{1,2}:\d{2}/.test(txt) && !/DXB|LHR|TRC|ZZ\d|EK/.test(txt) && !/\d{4}-\d{2}-(0[2-9]|[12]\d|3[01])/.test(txt),
     '★月の合計に日付・空港・場所・時刻・便名が入らない（月の頭の日付だけ）');
  ok(m2.flatMap((m) => m.groups.map((g) => g.code)).filter(Boolean).sort().join() === 'OFF1,SBY,VAC',
     '勤務コードは印字のまま残る（意味は後から読み方で当てる）');

  // ③ 夏時間をまたぐ夜（会員8）も画面と同じ分
  await asUser(8);
  const m8 = await monthsOf(8);
  ok(m8.length === 1 && m8[0].time_basis === 'tz' && !same(E8, m8[0], {}),
     `★夏時間の夜も画面と同じ分（${m8[0] && m8[0].groups[0].duty_min}分・数え方 ${m8[0] && m8[0].time_basis}）`, m8[0] ? same(E8, m8[0], {}) : '月が無い');

  // ④ もう一度流しても何も変わらない
  const c3 = await compact(addDays(TODAY, 1000));
  ok(c3.ok && c3.months === 0 && c3.days === 0 && JSON.stringify(await monthsOf(8)) === JSON.stringify(m8), '二度流しても同じ（何も足さない・何も消さない）');

  // ⑤ ファイルの記録は残る → 本人がそこから月の合計ごと消せる
  await asUser(7);
  const docs7 = (await myDocs()).docs;
  ok(docs7.length === 1 && docs7[0].id === r7.doc_id && docs7[0].days_owned === 0, 'ファイルの記録（指紋・期間）は残る・持っている日は0');
  const del7 = await delDoc(r7.doc_id, 'emirates');
  ok(del7.deleted === true && (await monthsOf(7)).length === 0, '★ファイルを消すと、その期間の月の合計も消える');

  // ⑥ ほかの会員は呼べない（片づけは毎日の時計だけ）
  const e = await boom(`select has_function_privilege('authenticated', 'public.pv_roster_compact(date)', 'EXECUTE') a`);
  const priv = await one(`select has_function_privilege('authenticated', 'public.pv_roster_compact(date)', 'EXECUTE') a,
                                 has_function_privilege('anon', 'public.pv_roster_compact(date)', 'EXECUTE') b`);
  ok(!e && priv.a === false && priv.b === false, '片づけの関数は会員からも未ログインからも呼べない');
  await db.exec('rollback');
  ok(await cnt('pv_roster_months') === 0, '（巻き戻した ── ほかの節の作り物は元どおり）');
}

// ── 11-c. 1日を手で直す・消す（edit_roster_day）─────────────────────
console.log('\n▼ 1日を手で直す・消す（edit_roster_day）');
const editR = async (date, d, a = 'emirates', o = null) =>
  (await one(`select edit_roster_day($1, $2, $3::jsonb) r`, [a, o, JSON.stringify({ date, day: d })])).r;
const tryEdit = (p, a = 'emirates', o = null) =>
  boom(`select edit_roster_day($1, $2, $3::jsonb)`, [a, o, p === null ? null : JSON.stringify(p)]);
const eday = (x = {}) => ({ code: null, d_on: '06:00', d_off: '15:00', d_off_day: 0, page: 9, row: 99,
                            legs: [leg(1, { page: 7, row: 33 })], ...x });
// 月の合計にまとめる境目（今月の頭から24か月前）
const CUT = (() => { const [y, m] = TODAY.split('-').map(Number); return `${y - 2}-${String(m).padStart(2, '0')}-01`; })();
await asUser(1);
let MAN = null;
{
  const docs0 = (await myDocs()).docs;
  ok(docs0.length === 1 && docs0[0].id === rC.doc_id && docs0[0].manual === false,
     'my_roster_docs が manual を返す（取り込んだファイルは false）', JSON.stringify(docs0.map((d) => d.manual)));

  // ① 在る日（C が持つ日）を直す → C のまま入れ替わる
  const e1 = await editR(D(5), eday({ code: 'SBY', legs: [
    leg(1, { page: 7, row: 33, block: '2:05' }),
    leg(2, { flight: 'EK 9 Captain Smith', kind: 'ground', from: 'DXB', to: 'DXB', loc: 'TRC', role: 'TRN', block: '1:00' }),
  ] }));
  ok(e1.ok === true && e1.date === D(5) && e1.legs === 2 && Object.keys(e1).sort().join() === 'date,legs,ok',
     `在る日を直す → {ok, date, legs} → ${JSON.stringify(e1)}`);
  const r = await myRoster();
  const d5 = r.days.find((x) => x.date === D(5));
  ok(d5 && d5.doc_id === rC.doc_id, '★在る日は、その日のファイル（C）のまま入れ替わる');
  ok(d5 && d5.code === 'SBY' && d5.d_on === '06:00' && d5.legs.length === 2 && d5.legs[0].block_min === 125,
     '中身が入れ替わる（前の2便は残らない・2:05 = 125分）');
  ok(d5 && d5.page === null && d5.row === null && d5.legs.every((l) => l.page === null && l.row === null),
     '手で直した日は page・row を持たない（送っても入れない・ページ数で弾きもしない）');
  ok(d5 && d5.legs[1].kind === 'ground' && d5.legs[1].from === null && d5.legs[1].to === null && d5.legs[1].loc === 'TRC',
     '★地上業務に空港を作らない（submit_roster と同じ）');
  ok(!/EK|Smith/.test(JSON.stringify(await rows(`select to_jsonb(l) j from public.pv_roster_legs l`))), '★便名は保存しない（送っても落ちる）');
  ok(r.days.length === 10 && (await myDocs()).docs.length === 1, '在る日を直しても日数は同じ・置き場は作らない');

  // ② 無い日 → 本人の「手で直した日」の置き場（manual）へ
  const e2 = await editR(D(30), eday({ code: 'OFF1', d_on: null, d_off: null, legs: [] }));
  ok(e2.ok && e2.date === D(30) && e2.legs === 0, '無い日を足せる（便なし）');
  const man = (await myDocs()).docs.filter((d) => d.manual);
  MAN = man[0];
  ok(man.length === 1 && MAN.date_from === D(30) && MAN.date_to === D(30) && MAN.days === 1 && MAN.days_owned === 1
     && MAN.pages === 1 && /^[0-9a-f]{64}$/.test(MAN.file_sha),
     '★無い日は置き場（manual:true・1ページ）に入る・幅はその1日', JSON.stringify(man));
  await editR(D(28), eday());
  await editR(D(33), eday({ legs: [] }));
  const man2 = (await myDocs()).docs.filter((d) => d.manual);
  ok(man2.length === 1 && man2[0].id === MAN.id && man2[0].date_from === D(28) && man2[0].date_to === D(33)
     && man2[0].days === 3 && man2[0].days_owned === 3,
     '★新しい日が増えても置き場は1つのまま・日付の幅が広がる', JSON.stringify(man2));
  ok((await myRoster()).days.filter((d) => [D(28), D(30), D(33)].includes(d.date)).every((d) => d.doc_id === MAN.id),
     '足した日は置き場のもの');
  await editR(D(30), eday({ code: 'VAC', d_on: null, d_off: null, legs: [] }));
  const d30 = (await myRoster()).days.find((d) => d.date === D(30));
  ok(d30 && d30.doc_id === MAN.id && d30.code === 'VAC' && (await myDocs()).docs.filter((d) => d.manual).length === 1,
     '置き場の日をもう一度直しても置き場のまま（2つ目を作らない）');

  // ③ day:null で消す
  const x1 = await editR(D(33), null);
  ok(x1.ok && x1.deleted === true && x1.date === D(33) && Object.keys(x1).sort().join() === 'date,deleted,ok', 'day:null でその日を消す → {ok, date, deleted}');
  const man3 = (await myDocs()).docs.find((d) => d.manual);
  ok(!(await myRoster()).days.some((d) => d.date === D(33)) && man3.days === 2 && man3.days_owned === 2 && man3.date_to === D(33),
     '消すと置き場の日数を数え直す（日付の幅は狭めない）');
  const x2 = await editR(D(6), null);
  ok(x2.ok && x2.deleted === true && !(await myRoster()).days.some((d) => d.date === D(6))
     && Number((await one(`select count(*) n from pv_roster_legs where duty_date = $1::date and proof_hash = public.pv_roster_key($2::uuid, 'emirates', null)`, [D(6), uid(1)])).n) === 0
     && (await myDocs()).docs.find((d) => d.id === rC.doc_id).days_owned === 9,
     '取り込んだファイルの日も消せる（便も一緒に・C が持つ日は9に）');
  const x3 = await editR(D(34), null);
  ok(x3.ok && x3.deleted === true, 'もともと無い日を消しても止まらない（その日はもう無い）');

  // ④ 知らないキー・便名は落ちる
  const kx = await editR(D(41), { ...eday(), name: 'Alex Mercer', remarks: 'hotel shuttle',
    legs: [{ ...leg(1), crew: 'Kai Example', text: 'free text', flight: 'EK 77 Mercer' }] });
  ok(kx.ok && kx.legs === 1 && !/Mercer|Kai Example|shuttle|free text|EK 77|remarks|crew/.test(await dump()),
     '★知らないキー（氏名・備考）と便名は落ちる（表のどこにも残らない）');
}

console.log('\n▼ edit_roster_day：ほかの会員の日に触れない');
{
  const mine = JSON.stringify((await myRoster()).days);
  await asUser(2);
  const o1 = await editR(D(30), null);
  const o2 = await editR(D(28), eday({ code: 'HACK1' }));
  ok(o1.ok && o2.ok, '（ほかの会員も、自分の鍵でなら呼べる）');
  const docs2 = (await myDocs()).docs;
  ok(docs2.filter((d) => d.manual).length === 1 && !docs2.some((d) => d.id === MAN.id), 'ほかの会員は自分の置き場を持つ（本人の置き場に入らない）');
  ok((await delDoc(MAN.id, 'emirates')).deleted === false, 'ほかの会員は本人の置き場を消せない');
  await asUser(1);
  ok(JSON.stringify((await myRoster()).days) === mine, '★ほかの会員が同じ日付を直しても消しても、本人の日は1文字も変わらない');
}

console.log('\n▼ edit_roster_day：不正な中身は弾く（何も書かない）');
{
  const snap = await dump();
  const wDay = (patch) => ({ date: D(40), day: { ...eday(), ...patch } });
  const wLeg = (patch) => ({ date: D(40), day: { ...eday(), legs: [{ ...leg(1), ...patch }] } });
  const badE = [
    ['勤務コードが小文字（off1）', wDay({ code: 'off1' })],
    ['勤務コードに空白（氏名の形）', wDay({ code: 'JOHN SMITH' })],
    ['勤務コードが13文字', wDay({ code: 'ABCDEFGHIJKLM' })],
    ['勤務コードが数値', wDay({ code: 123 })],
    ['空港コードが5文字', wLeg({ from: 'TOKYO' })],
    ['空港コードが小文字', wLeg({ to: 'lhr' })],
    ['勤務コードが印の形でない（#xyz）', wDay({ code: '#xyz' })],
    ['勤務コードが漢字（公休）', wDay({ code: '公休' })],
    ['場所が文章', wLeg({ loc: 'Training Center' })],
    ['時刻の頭の0が無い（7:05）', wLeg({ out: '7:05' })],
    ['時刻が25:00', wDay({ d_on: '25:00' })],
    ['ブロックが24時間を超える', wLeg({ block: '25:01' })],
    ['ブロックの分が1桁', wLeg({ block: '1:7' })],
    ['解散の日が3', wDay({ d_off_day: 3 })],
    ['到着の日がマイナス', wLeg({ in_day: -1 })],
    ['便の順番が重なる', wDay({ legs: [leg(1), leg(1)] })],
    ['便の順番が0', wLeg({ seq: 0 })],
    ['便の順番が無い', wLeg({ seq: null })],
    ['便の種類が知らない言葉', wLeg({ kind: 'flying' })],
    ['1日の便が17本', wDay({ legs: Array.from({ length: 17 }, (_, i) => leg(i + 1)) })],
    ['便が配列でない', wDay({ legs: { a: 1 } })],
    ['日が文字列', { date: D(40), day: 'OFF' }],
    ['day の鍵が無い（消すつもりでない呼び出しで消さない）', { date: D(40) }],
    ['在り得ない日付（2月30日）', { date: '2026-02-30', day: eday() }],
    ['日付の形が違う', { date: '2026/01/05', day: eday() }],
    ['日付が無い', { day: eday() }],
    ['日付が401日先', { date: addDays(TODAY, 401), day: eday() }],
    ['日付が401日前', { date: addDays(TODAY, -401), day: eday() }],
    ['日付が2年の境目より前（まとめた月）', { date: addDays(CUT, -1), day: eday() }],
    ['形が配列', [1, 2]],
    ['形が null', null],
    ['32KB を超える', { date: D(40), day: eday(), junk: 'x'.repeat(33 * 1024) }],
  ];
  for (const [label, p] of badE) {
    const e = await tryEdit(p);
    ok(e && /^(22023|54000)$/.test(e.code) && /ロスター/.test(e.msg), `弾く：${label}${e ? ' → ' + e.msg.slice(0, 36) : ''}`, e ? e.code : '通ってしまった');
  }
  for (const [label, a, o] of [['会社コードが不正', 'nope-air', null], ['「その他」なのに社名が無い', 'other', '  ']]) {
    const e = await tryEdit({ date: D(40), day: eday() }, a, o);
    ok(e && e.code === '22023' && e.msg.includes('会社'), `弾く：${label}`, e ? e.msg : '通ってしまった');
  }
  const ec = await tryEdit({ date: addDays(CUT, -1), day: null });
  ok(ec && ec.code === '22023' && ec.msg.includes('2年'), '★2年の境目より前の日は「2年より前」で止める（消すのも・まとめた月に日の行を作らない）', ec ? ec.msg : '通ってしまった');
  const en = await tryEdit(wDay({ code: 'Jane Q Example' }));
  ok(en && !en.msg.includes('Jane'), 'エラーの文に送られてきた値（名前の形）を書かない');
  ok(await dump() === snap, '弾いた呼び出しは1文字も書いていない');
}

console.log('\n▼ edit_roster_day：1人1日200回まで');
await asUser(11);
{
  const qOf = async (n) => rows(`select day::text d, n from public.pv_roster_edit_quota where proof_hash = public.pv_roster_key($1::uuid, 'emirates', null)`, [uid(n)]);
  let n200 = 0;
  for (let i = 0; i < 200; i++) {
    const r = await editR(D(50 + (i % 3)), i % 2 ? null : eday({ legs: [] }));
    if (r.ok) n200++;
  }
  ok(n200 === 200, `200回までは通る（消すのも1回）→ ${n200}`);
  const e = await tryEdit({ date: D(50), day: eday() });
  ok(e && e.code === '54000' && e.msg.includes('上限'), `201回目は止まる → ${e ? e.code : '通った'}`);
  const q = await qOf(11);
  ok(q.length === 1 && q[0].d === TODAY && q[0].n === 200, '数える表は 人×日 の1行だけ（どの日を直したかは持たない）', JSON.stringify(q));
  await db.query(`update public.pv_roster_edit_quota set day = day - 1 where proof_hash = public.pv_roster_key($1::uuid, 'emirates', null)`, [uid(11)]);
  ok((await editR(D(50), null)).ok, '日が変われば、また直せる');
  const q2 = await qOf(11);
  ok(q2.length === 1 && q2[0].d === TODAY && q2[0].n === 1, '前の日の行は消える（1人1行より増えない）', JSON.stringify(q2));
  await asUser(12);
  ok((await editR(D(50), eday())).ok, 'ほかの人は数に入らない');
}

console.log('\n▼ edit_roster_day：置き場を消す・取り込みとの関係');
await asUser(1);
{
  const man = (await myDocs()).docs.find((d) => d.manual);
  const dd = await delDoc(man.id);
  ok(dd.deleted === true && dd.days === man.days_owned && !(await myDocs()).docs.some((d) => d.manual),
     `★置き場もほかのファイルと同じように消せる（持っていた${dd.days}日ごと）`);
  const left = (await myRoster()).days.map((d) => d.date);
  ok(![D(28), D(30), D(41)].some((x) => left.includes(x)) && left.includes(D(5)),
     '置き場の日だけ消え、取り込んだファイルの日（直した D(5) も）は残る');
  const again = await editR(D(30), eday());
  const m4 = (await myDocs()).docs.filter((d) => d.manual);
  ok(again.ok && m4.length === 1 && m4[0].id !== man.id && m4[0].date_from === D(30) && m4[0].days === 1,
     '消したあとに直すと、新しい置き場が1つできる');
  const rs = await submitR(roster([day(30)], { file_sha: sha(5000) }));
  const m5 = (await myDocs()).docs.find((d) => d.manual);
  ok(rs.ok && rs.replaced === 1 && m5.days_owned === 0 && (await myRoster()).days.find((d) => d.date === D(30)).doc_id === rs.doc_id,
     '後から取り込んだ勤務表は、手で直した日も日付で入れ替える（いつも新しいほうが残る）');
}
await asUser(1);

// ── 11-d. 会社の辞書（3人以上が同じ答え かつ 答えた人の過半数）──────────────
console.log('\n▼ 会社の辞書（書き込みのときに数える・3人以上 かつ 過半数・人数は返さない）');
const QA = 'qatar-airways', SQ = 'singapore-airlines';
const TOKD = '#0123456789abcdef';
const dict = async (a = QA, o = null) => (await one(`select my_roster_airline_codes($1, $2) r`, [a, o])).r;
const rawDict = async (a = QA) => rows(`select key, meaning, updated_at::text t from public.pv_roster_airline_codes where airline = $1 order by key`, [a]);
const profAs = async (n, p, a = QA, o = null) => { await asUser(n); return setProfile(p, a, o); };
{
  const P1 = { kind: 'actual', time_ref: 'utc', blank: 'off', codes: { OFF1: 'off', SBY: 'standby', [TOKD]: 'vac' } };
  await profAs(21, P1);
  await profAs(22, P1);
  const d2 = await dict();
  ok(d2.ok === true && Object.keys(d2).sort().join() === 'codes,ok' && Object.keys(d2.codes).length === 0,
     '★2人がそろっても辞書には置かない（codes は空・kind なども無い）', JSON.stringify(d2));
  await profAs(23, P1);
  const d3 = await dict();
  ok(d3.codes.OFF1 === 'off' && d3.codes.SBY === 'standby' && d3.codes[TOKD] === 'vac'
     && d3.kind === 'actual' && d3.time_ref === 'utc' && d3.blank === 'off' && !('time_meaning' in d3),
     '★3人がそろうと置く（勤務コード・読み取りの印・実績か予定か・時刻の基準・空欄の意味。答えの無い time_meaning はキーごと無い）', JSON.stringify(d3));

  // 3対3 は割れている。'unknown' は答えに数えない。
  const P2 = { kind: 'actual', codes: { SBY: 'duty', [TOKD]: 'unknown' } };
  for (const n of [24, 25, 26]) await profAs(n, P2);
  const d6 = await dict();
  ok(!('SBY' in d6.codes), '★3対3 に割れたコード（SBY）は置かない', JSON.stringify(d6.codes));
  ok(d6.codes[TOKD] === 'vac', '★「わからない（unknown）」は答えに数えない（vac 3人 ＋ unknown 3人 → vac のまま）');
  ok(d6.codes.OFF1 === 'off' && d6.kind === 'actual' && d6.time_ref === 'utc',
     '答えていない人は分母に入らない（OFF1 は3人中3人・時刻の基準は3人中3人）');
  await profAs(27, { codes: { SBY: 'standby' } });
  ok((await dict()).codes.SBY === 'standby', '4対3 になれば過半数 → 置く');

  // テスト用アカウントは外す（名簿が変わったら全部の会社を数え直す）
  await db.query(`insert into public.pv_test_users (uid) values ($1)`, [uid(27)]);
  ok(!('SBY' in (await dict()).codes), '★テスト用アカウントを名簿に入れると、その人の答えは数えない（3対3 に戻る）');
  await db.query(`delete from public.pv_test_users where uid = $1`, [uid(27)]);
  ok((await dict()).codes.SBY === 'standby', '名簿から外すと、また数える');

  // 読み方を消すと数え直す
  await asUser(23);
  await setProfile(null, QA);
  const dd = await dict();
  ok(!('OFF1' in dd.codes) && !(TOKD in dd.codes) && !('blank' in dd) && !('time_ref' in dd) && dd.kind === 'actual',
     '★読み方を消すと数え直す（2人に減った OFF1・印・空欄の意味・時刻の基準は消え、5人の kind は残る）', JSON.stringify(dd));

  // 答えに関わらない書き換え（タイムゾーンだけ）は数え直さない
  const snapQA = JSON.stringify(await rawDict(QA));
  await profAs(21, { tz: 'Asia/Qatar' }, QA);
  ok(JSON.stringify(await rawDict(QA)) === snapQA, '答えに関わらない書き換え（タイムゾーンだけ）では辞書を作り直さない（時刻も変わらない）');

  // ほかの会社には触れない
  await profAs(30, { codes: { SBY: 'standby' } }, SQ);
  await profAs(31, { codes: { SBY: 'standby' } }, SQ);
  ok(Object.keys((await dict(SQ)).codes).length === 0, '別の会社で2人がそろっても置かない');
  ok(JSON.stringify(await rawDict(QA)) === snapQA, '★別の会社の書き込みは、この会社の辞書に1行も触れない（時刻も変わらない）');
  const n1 = Number((await one(`select public.pv_roster_airline_recount($1) n`, [SQ])).n);
  ok(n1 === 0 && JSON.stringify(await rawDict(QA)) === snapQA, '★数え直しはその会社の分だけ（ほかの会社の行は消しも書きもしない）');
  ok((await dict()).kind === 'actual' && !('kind' in (await dict(SQ))), '辞書は会社ごとに別もの（カタールでそろった答えはシンガポールに出ない）');

  // 返す形：人数・誰が答えたかを返さない
  const shape = await dict();
  const allowed = new Set(['ok', 'codes', 'kind', 'time_ref', 'time_meaning', 'blank']);
  ok(Object.keys(shape).every((k) => allowed.has(k))
     && Object.values(shape.codes).every((v) => typeof v === 'string')
     && ['kind', 'time_ref', 'time_meaning', 'blank'].every((k) => !(k in shape) || typeof shape[k] === 'string')
     && !/proof_hash|"n"|count|people|updated/.test(JSON.stringify(shape)),
     '★返すのは ok・codes・そろった4つの答えだけ（人数・鍵・時刻は返さない）', JSON.stringify(shape));
  ok(JSON.stringify(await dict('ana')) === JSON.stringify({ ok: true, codes: {} }), '答えが無い会社は {ok:true, codes:{}}');

  // 「一覧にない会社」は辞書を持たない
  for (const n of [21, 22, 23]) await profAs(n, P1, 'other', 'Example Charter Co');
  const ot = await dict('other', 'EXAMPLE CHARTER CO');
  ok(JSON.stringify(ot) === JSON.stringify({ ok: true, codes: {} }), '★「一覧にない会社」は3人そろっても {ok:true, codes:{}}', JSON.stringify(ot));
  ok(Number((await one(`select count(*) n from public.pv_roster_profile
                         where proof_hash = public.pv_roster_key($1::uuid, 'other', 'example charter co') and airline is null`, [uid(21)])).n) === 1
     && Number((await one(`select count(*) n from public.pv_roster_airline_codes where airline not in ($1, $2)`, [QA, SQ])).n) === 0,
     '「一覧にない会社」の読み方は会社を持たない（airline = null）・辞書に行を作らない');
  const eBad = await boom(`select my_roster_airline_codes('nope-air', null)`);
  ok(eBad && eBad.code === '22023' && eBad.msg.includes('会社'), '不正な会社は 22023');
  await logout();
  const eOut = await boom(`select my_roster_airline_codes($1, null)`, [QA]);
  ok(eOut && eOut.code === '42501', '★ログインしていなければ 42501（辞書も読めない）');

  // 前に貼った版の読み方（会社の欄が無い）は、会社の列を初めて足す貼り付けで鍵から当て直す
  await asUser(33);
  await db.exec(`alter table public.pv_roster_profile drop column airline`);   // 前の版の形に戻す
  await db.query(`insert into public.pv_roster_profile (proof_hash, kind, codes)
                  values (public.pv_roster_key($1::uuid, $2, null), 'actual', '{"OFF1":"off"}')`, [uid(33), QA]);
  const airOf = async (n, a = QA) => (await one(`select airline from public.pv_roster_profile where proof_hash = public.pv_roster_key($1::uuid, $2, null)`, [uid(n), a])).airline;
  await db.exec(read('db/roster.sql'));
  const after33 = await airOf(33), after21 = await airOf(21), after30 = await airOf(30, SQ);
  ok(after33 === QA && after21 === QA && after30 === SQ,
     `★会社の列が無い前の版から貼ると、全員の読み方に鍵から会社が入る（${after33}・${after21}・${after30}）`);
  ok(Number((await one(`select count(*) n from public.pv_roster_profile
                         where proof_hash = public.pv_roster_key($1::uuid, 'other', 'example charter co')`, [uid(21)])).n) === 1
     && (await one(`select airline from public.pv_roster_profile
                    where proof_hash = public.pv_roster_key($1::uuid, 'other', 'example charter co')`, [uid(21)])).airline === null,
     '「一覧にない会社」の行は null のまま');
  // 2回目からの貼り付けは重い当て直しをしない（給与の行と同じ鍵の行だけ、軽い道で当てる）
  await asUser(35);
  await asUser(2);
  await db.query(`insert into public.pv_roster_profile (proof_hash, kind, codes)
                  values (public.pv_roster_key($1::uuid, $2, null), 'actual', '{}'),
                         (public.pv_roster_key($3::uuid, 'emirates', null), 'actual', '{}')`, [uid(35), QA, uid(2)]);
  await db.exec(read('db/roster.sql'));
  ok(await airOf(35) === null && await airOf(2, 'emirates') === 'emirates',
     '★2回目からの貼り付けは「会員 × 全社」の当て直しをしない（給与の行がある人だけ軽い道で入る）');
  await db.query(`delete from public.pv_roster_profile where proof_hash in
                  (public.pv_roster_key($1::uuid, $2, null), public.pv_roster_key($3::uuid, 'emirates', null))`, [uid(35), QA, uid(2)]);
  await asUser(33);
  ok((await dict()).codes.OFF1 === 'off', '当て直した行も数に入る（21・22・33 の3人で OFF1 がまたそろう）');
  ok(Object.keys((await dict(SQ)).codes).length === 0, '（シンガポールは2人のまま置かない）');
}
await asUser(1);

// ── 12. 検算 ───────────────────────────────────────────────────
console.log('\n▼ 貼ったあとの検算');
const SRC = read('db/roster.sql');
const TAIL = SRC.slice(SRC.indexOf('-- ── 11. 検算'));
{
  const before = await cnt('pv_roster_days');
  const res = await db.exec(SRC);
  const chk = res[res.length - 1].rows;
  ok(chk.length === 22 && chk.every((x) => x['判定'] === '✅'),
     `★db/roster.sql の検算 ${chk.length} 行が全部 ✅`, chk.filter((x) => x['判定'] !== '✅').map((x) => x['#'] + ' ' + x['確かめること']).join(' | '));
  ok(await cnt('pv_roster_days') === before, 'もう一度流しても、入っている勤務表は消えない');
  ok(TAIL.length > 100, '（検算の部分だけを切り出せた）');
}

// ── 13. 壊す証明 ─────────────────────────────────────────────────
console.log('\n▼ 壊す証明');
{
  // 鍵の式の「::pv_pay::」を1文字変えた版を begin … rollback の中でだけ入れる（ファイルは触らない）
  const a = SRC.indexOf('create or replace function public.pv_roster_key(');
  const b = a < 0 ? -1 : SRC.indexOf('\n$$;', a);
  const fn = (a < 0 || b < 0) ? '' : SRC.slice(a, b + '\n$$;'.length);
  const broken = fn.split(`'::pv_pay::'`).length === 2 ? fn.split(`'::pv_pay::'`).join(`'::pv_pay:'`) : '';
  ok(!!broken, '（鍵の式だけ1文字変えた版を作れた）');
  const okBefore = (await myRoster()).days.length;
  await db.exec('begin');
  await db.exec(broken);
  const red = (await myRoster()).days.length;
  const redChk = (await db.exec(TAIL)).pop().rows.find((x) => Number(x['#']) === 7)?.['判定'];
  await db.exec('rollback');
  ok(okBefore > 0 && red === 0 && redChk === '❌',
     `★鍵の式を1文字変えると本人が自分の勤務表を読めず、検算7が ❌ → ${okBefore}日 → ${red}日 / ${redChk}`);
  ok((await myRoster()).days.length === okBefore, '（巻き戻したら元どおり読める）');
}
{
  await db.exec('begin');
  await db.exec(`grant execute on function public.submit_roster(jsonb) to anon`);
  const redChk = (await db.exec(TAIL)).pop().rows.find((x) => Number(x['#']) === 2)?.['判定'];
  await db.exec('rollback');
  ok(redChk === '❌', `★anon に呼ばせると検算2が ❌ → ${redChk}`);
}
{
  await db.exec('begin');
  await db.exec(`grant select on public.pv_roster_days to authenticated`);
  const redChk = (await db.exec(TAIL)).pop().rows.find((x) => Number(x['#']) === 6)?.['判定'];
  await db.exec('rollback');
  ok(redChk === '❌', `★表を authenticated に開けると検算6が ❌ → ${redChk}`);
}
{
  // 日付で入れ替えるのをやめた版（先に消す1文を外す）→ 重なった提出が主キーで止まり、検算8が ❌
  const a = SRC.indexOf('create or replace function public.submit_roster(');
  const b = SRC.indexOf('\n$$;', a);
  const fn = SRC.slice(a, b + '\n$$;'.length);
  const DEL = `  delete from public.pv_roster_days t\n   where t.proof_hash = v_key and t.duty_date = any (v_dates);\n  get diagnostics v_replaced = row_count;\n`;
  const broken = fn.includes(DEL) ? fn.replace(DEL, () => '  v_replaced := 0;\n') : '';
  ok(!!broken, '（入れ替えの1文だけ外した版を作れた）');
  await db.exec('begin');
  await db.exec(broken);
  const redChk = (await db.exec(TAIL)).pop().rows.find((x) => Number(x['#']) === 8)?.['判定'];
  const e = await trySubmit(roster([day(10)], { file_sha: sha(9001) }));   // 失敗でこの取引は止まる → すぐ巻き戻す
  await db.exec('rollback');
  ok(e && redChk === '❌', `★入れ替えをやめると同じ日の提出が通らず、検算8が ❌ → ${e ? e.code : '通った'} / ${redChk}`);
}
{
  // 便名の列を戻した版 → 検算11が ❌
  await db.exec('begin');
  await db.exec(`alter table public.pv_roster_legs add column flight text`);
  const redChk = (await db.exec(TAIL)).pop().rows.find((x) => Number(x['#']) === 11)?.['判定'];
  await db.exec('rollback');
  ok(redChk === '❌', `★便名の列を戻すと検算11が ❌ → ${redChk}`);
}
{
  // 日を消さない片づけ（合計を作るだけ）→ 検算12が ❌
  const a = SRC.indexOf('create or replace function public.pv_roster_compact(');
  const b = SRC.indexOf('\n$$;', a);
  const fn = SRC.slice(a, b + '\n$$;'.length);
  const DEL = '  delete from public.pv_roster_days x where x.duty_date < v_cut;\n  get diagnostics v_days = row_count;\n';
  const broken = fn.includes(DEL) ? fn.replace(DEL, () => '  v_days := 0;\n') : '';
  ok(!!broken, '（片づけから日を消す1文だけ外した版を作れた）');
  await db.exec('begin');
  await db.exec(broken);
  const redChk = (await db.exec(TAIL)).pop().rows.find((x) => Number(x['#']) === 12)?.['判定'];
  await db.exec('rollback');
  ok(redChk === '❌', `★日を消さない片づけにすると検算12が ❌ → ${redChk}`);
}
{
  // 手で直す口からログインの確認を外した版 → 検算13（と4）が ❌・未ログインでも 42501 で止まらなくなる
  const a = SRC.indexOf('create or replace function public.edit_roster_day(');
  const b = a < 0 ? -1 : SRC.indexOf('\n$$;', a);
  const fn = (a < 0 || b < 0) ? '' : SRC.slice(a, b + '\n$$;'.length);
  const LOGIN = `  if v_uid is null then\n    raise exception 'ログインが必要です' using errcode = '42501';\n  end if;\n`;
  const broken = fn.split(LOGIN).length === 2 ? fn.replace(LOGIN, () => '') : '';
  ok(!!broken, '（手で直す口からログインの確認だけ外した版を作れた）');
  await db.exec('begin');
  await db.exec(broken);
  const chk = (await db.exec(TAIL)).pop().rows;
  await logout();
  const e = await tryEdit({ date: D(5), day: null });
  await db.exec('rollback');
  await asUser(1);
  const at = (n) => chk.find((x) => Number(x['#']) === n)?.['判定'];
  ok(at(13) === '❌' && at(4) === '❌' && e && e.code !== '42501',
     `★手で直す口からログインの確認を外すと検算13・4が ❌（未ログインが 42501 で止まらない → ${e ? e.code : '通った'}）`);
}
{
  // 2年の境目を外した版 → 境目より前の日が「2年より前」で止まらなくなり、検算15が ❌
  const a = SRC.indexOf('create or replace function public.edit_roster_day(');
  const b = a < 0 ? -1 : SRC.indexOf('\n$$;', a);
  const fn = (a < 0 || b < 0) ? '' : SRC.slice(a, b + '\n$$;'.length);
  const CUTCHK = `  if v_date < v_cut then\n    raise exception 'ロスターの日付が2年より前です（月の合計にまとめた期間は直せません）' using errcode = '22023';\n  end if;\n`;
  const broken = fn.split(CUTCHK).length === 2 ? fn.replace(CUTCHK, () => '') : '';
  ok(!!broken, '（手で直す口から2年の境目だけ外した版を作れた）');
  await db.exec('begin');
  await db.exec(broken);
  const redChk = (await db.exec(TAIL)).pop().rows.find((x) => Number(x['#']) === 15)?.['判定'];
  const e = await tryEdit({ date: addDays(CUT, -1), day: eday() });   // 失敗でこの取引は止まる → すぐ巻き戻す
  await db.exec('rollback');
  ok(redChk === '❌' && e && !e.msg.includes('2年'),
     `★2年の境目を外すと検算15が ❌（境目より前の日を「2年より前」で止めなくなる → ${e ? e.msg.slice(0, 24) : '通った'}）`);
}
{
  // submit_roster が1日の組み直しを呼ばない版（自前の検品に戻した形）→ 検算14が ❌
  const a = SRC.indexOf('create or replace function public.submit_roster(');
  const b = SRC.indexOf('\n$$;', a);
  const fn = SRC.slice(a, b + '\n$$;'.length);
  const CALL = `public.pv_roster_clean_day(v_d, v_pages)`;
  const broken = fn.split(CALL).length === 2
    ? fn.replace(CALL, () => `jsonb_build_object('legs', '[]'::jsonb, 'x', public.pv_roster_txt(v_d, 'x', '^[A-Z0-9]{3,4}$', '出発地'))`) : '';
  ok(!!broken, '（submit_roster が自前で検品する版を作れた）');
  await db.exec('begin');
  await db.exec(broken);
  const redChk = (await db.exec(TAIL)).pop().rows.find((x) => Number(x['#']) === 14)?.['判定'];
  await db.exec('rollback');
  ok(redChk === '❌', `★submit_roster が1日の組み直しを呼ばず自前の検品を持つと検算14が ❌ → ${redChk}`);
}
{
  // 会社の辞書の線を2人に下げた版 → 2人がそろった会社（シンガポール）に置いてしまい、検算20が ❌
  const a = SRC.indexOf('create or replace function public.pv_roster_airline_recount(');
  const b = a < 0 ? -1 : SRC.indexOf('\n$$;', a);
  const fn = (a < 0 || b < 0) ? '' : SRC.slice(a, b + '\n$$;'.length);
  const C3 = 'c_min_agree constant int := 3;';
  const broken = fn.split(C3).length === 2 ? fn.replace(C3, () => 'c_min_agree constant int := 2;') : '';
  ok(!!broken, '（会社の辞書の線だけ2人に下げた版を作れた）');
  await asUser(1);
  const okBefore = (await dict(SQ)).codes.SBY;
  await db.exec('begin');
  await db.exec(broken);
  await db.query(`select public.pv_roster_airline_recount($1)`, [SQ]);
  const red = (await dict(SQ)).codes.SBY;
  const redChk = (await db.exec(TAIL)).pop().rows.find((x) => Number(x['#']) === 20)?.['判定'];
  await db.exec('rollback');
  ok(okBefore === undefined && red === 'standby' && redChk === '❌',
     `★線を2人に下げると2人の会社に置いてしまい、検算20が ❌ → ${okBefore} → ${red} / ${redChk}`);
  ok((await dict(SQ)).codes.SBY === undefined, '（巻き戻したら元どおり置かない）');
}
{
  // 乗務の区分の列を戻した版 → 検算17が ❌
  await db.exec('begin');
  await db.exec(`alter table public.pv_roster_legs add column role_raw text`);
  const redChk = (await db.exec(TAIL)).pop().rows.find((x) => Number(x['#']) === 17)?.['判定'];
  await db.exec('rollback');
  ok(redChk === '❌', `★乗務の区分の列を戻すと検算17が ❌ → ${redChk}`);
}
await logout();

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
