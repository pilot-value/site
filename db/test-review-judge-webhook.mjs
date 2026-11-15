/* db/test-review-judge-webhook.mjs — 預かりの口コミを AI の判定へ回す Webhook（db/review-judge-webhook.sql）を
   本物の Postgres（PGlite）で流して確かめる（2026-11-15）。

   実行: node db/test-review-judge-webhook.mjs
   ネットワーク不要・本番に一切触らない。supabase_functions.http_request は「呼ばれた」を表に書くだけの身代わり。

   守っているもの
     ・作るのは pv_review_pending の INSERT にだけ translate-review を呼ぶ1本。名前・イベント・表だけが変わり、
       URL・認証ヘッダ・待ち時間は reviews_v2 のひな型のまま（キーを打ち込まない・画面に出さない）
     ・ひな型（reviews_v2 の translate-review）と、預かりの通知（notify-admin）には1文字も触らない
     ・受け皿（表 pv_review_judge と2つの関数・db/reviews-gate.sql）が無ければ作らない
     ・何度流しても1本・画面から作った別名の1本が在れば足さない（1件の預かりで2回判定＝課金が倍、を作らない）
     ・ひな型に WHEN や列の指定が付いていたら写さずに止まる・止まったときの文にキーも URL も出ない
     ・引き取り（UPDATE）では呼ばない（中身が消えていて判定するものが無い）
     ・最後の確認の表がそのまま流れ、キーが出ない
   ★壊す証明：守りの1行を外した版では、名指しした検査が赤くなる。
*/
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'fs';

const SQL = readFileSync(new URL('./review-judge-webhook.sql', import.meta.url), 'utf8');
const J = (x) => JSON.stringify(x);
const NEW = 'translate_review_pv_review_pending';
const KEY = 'test-bearer-not-a-real-key';
const HEADERS = `{"Content-type":"application/json","Authorization":"Bearer ${KEY}"}`;
const hookOn = (name, tbl, events, fn, extra = '') => `create trigger ${name} after ${events} on public.${tbl}
   for each row ${extra} execute function supabase_functions.http_request(
     'https://example.supabase.co/functions/v1/${fn}', 'POST', '${HEADERS}', '{}', '1000')`;

/* 器：最小の reviews_v2・預かり・判定の表と関数（中身は使わない。在ることだけが条件）・身代わりの http_request。
   PGlite は1つだけ立てて、場面ごとに丸ごと作り直す（場面ごとに立てると、混んだ機械で1分を超える）。 */
const db = new PGlite();
await db.waitReady;
async function fresh({ judge = true, pending = true } = {}) {
  await db.exec(`
    drop schema if exists supabase_functions cascade;
    drop table if exists public.t_hook_log, public.reviews_v2, public.t_other, public.pv_review_pending, public.pv_review_judge cascade;
    drop function if exists public.pv_review_judge_get(text, uuid);
    drop function if exists public.pv_review_judge_put(text, uuid, text, text, text, text, text);
    create schema supabase_functions;
    create table public.t_hook_log (seq serial primary key, tbl text, op text, target text, method text, headers text, params text, wait text);
    create function supabase_functions.http_request() returns trigger language plpgsql as $f$
    begin
      insert into public.t_hook_log (tbl, op, target, method, headers, params, wait)
      values (TG_TABLE_NAME, TG_OP, TG_ARGV[0], TG_ARGV[1], TG_ARGV[2], TG_ARGV[3], TG_ARGV[4]);
      return null;
    end $f$;
    create table public.reviews_v2 (id uuid primary key default gen_random_uuid(), airline text, culture_comment text,
      orig_lang text not null default 'ja', translations jsonb);
    create table public.t_other (id int);
  `);
  if (pending) await db.exec(`create table public.pv_review_pending (id uuid primary key default gen_random_uuid(),
      claim_token text, claimed_at timestamptz, airline text, culture_comment text, orig_lang text not null default 'ja')`);
  if (judge) await db.exec(`
    create table public.pv_review_judge (src text, rid uuid, body_sha text, primary key (src, rid));
    create function public.pv_review_judge_get(p_src text, p_rid uuid) returns jsonb language sql as $f$ select null::jsonb $f$;
    create function public.pv_review_judge_put(p_src text, p_rid uuid, p_sha text, p_lang text, p_verdict text, p_reason text, p_note text)
      returns jsonb language sql as $f$ select '{"ok":true,"mail":false}'::jsonb $f$;
  `);
  const rows = async (q, p) => (await db.query(q, p)).rows;
  const one = async (q, p) => (await rows(q, p))[0];
  const run = async (src) => {
    try { const r = await db.exec(src); return { err: null, last: r[r.length - 1]?.rows ?? [] }; }
    catch (e) { return { err: [e.message, e.detail, e.hint].filter(Boolean).join(' ｜ ') || String(e), last: [] }; }
  };
  const trigs = async (tbl) => rows(`select tg.tgname n, pg_get_triggerdef(tg.oid) d from pg_trigger tg
     where not tg.tgisinternal and tg.tgrelid = to_regclass('public.${tbl}') order by 1`);
  const toJudge = async () => (await trigs('pv_review_pending')).filter((t) => t.d.includes('/functions/v1/translate-review'));
  return { db, rows, one, run, trigs, toJudge };
}

/* 検査ひとそろい。[通ったか, 名前, 詳しく] を返す（本物にも、壊した版にも同じものを当てる）。 */
async function suite(sql) {
  const out = [];
  const t = (ok, name, detail = '') => out.push([!!ok, name, detail]);
  const hide = (s) => String(s).split(KEY).join('***');

  // ── 字面 ──
  const code = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  t(!/\b(drop|alter|truncate|disable)\b/i.test(code), '字面：動く行に drop / alter が1つも無い（在るのはコメントの「止めるとき」だけ）');
  t(/^\s*--\s+drop trigger if exists translate_review_pv_review_pending on public\.pv_review_pending;/m.test(sql), '字面：止め方が末尾のコメントに在る');
  t(!/Bearer\s+[A-Za-z0-9._-]{12,}|https:\/\/[a-z0-9]+\.supabase\.co/.test(sql), '字面：URL もキーも書いていない（ひな型から写す）');

  // ── 受け皿・ひな型が無ければ作らない ──
  {
    const x = await fresh({ judge: false });
    await x.db.exec(hookOn('"Translate review"', 'reviews_v2', 'insert or update', 'translate-review'));
    const r = await x.run(sql);
    t(r.err !== null && /pv_review_judge/.test(r.err) && (await x.toJudge()).length === 0,
      '受け皿（db/reviews-gate.sql の表と関数）が無ければ、止まって何も作らない', hide(r.err));
  }
  {
    const x = await fresh({ pending: false });
    await x.db.exec(hookOn('"Translate review"', 'reviews_v2', 'insert or update', 'translate-review'));
    const r = await x.run(sql);
    t(r.err !== null && /pv_review_pending がありません/.test(r.err), '預かりの表が無ければ、止まる', hide(r.err));
  }
  {
    const x = await fresh();
    await x.db.exec(hookOn('t_translate_elsewhere', 't_other', 'insert', 'translate-review'));
    const r = await x.run(sql);
    t(r.err !== null && /translate-review の Webhook トリガが見つかりません/.test(r.err) && (await x.toJudge()).length === 0,
      'reviews_v2 にひな型が無ければ、止まって何も作らない（ほかの表に在っても使わない）', hide(r.err));
  }

  // ── 作る（本番にある形：翻訳＝INSERT・UPDATE／預かりの通知＝INSERT）──
  const x = await fresh();
  await x.db.exec(hookOn('"Translate review"', 'reviews_v2', 'insert or update', 'translate-review'));
  await x.db.exec(hookOn('notify_admin_pv_review_pending', 'pv_review_pending', 'insert', 'notify-admin'));
  const beforeR = await x.trigs('reviews_v2');
  const beforeQ = await x.trigs('pv_review_pending');
  const r1 = await x.run(sql);
  const mine = await x.toJudge();
  t(r1.err === null && mine.length === 1 && mine[0].n === NEW, '流すと pv_review_pending に1本できる', hide(r1.err ?? J(mine.map((m) => m.n))));
  t(mine[0]?.d === `CREATE TRIGGER ${NEW} AFTER INSERT ON public.pv_review_pending FOR EACH ROW EXECUTE FUNCTION `
    + `supabase_functions.http_request('https://example.supabase.co/functions/v1/translate-review', 'POST', '${HEADERS}', '{}', '1000')`,
    '名前・INSERT だけ・表だけが変わり、呼び先・URL・認証ヘッダ・待ち時間はひな型のまま', hide(mine[0]?.d ?? ''));
  t(J(await x.trigs('reviews_v2')) === J(beforeR), 'reviews_v2 の translate-review のトリガは、作る前と1文字も違わない');
  t(J((await x.trigs('pv_review_pending')).filter((tg) => tg.n !== NEW)) === J(beforeQ), '預かりの通知（notify-admin）のトリガも、そのまま');

  // ── 最後の確認の表 ──
  const vr = r1.last;
  const vq = vr.filter((v) => v.table === 'pv_review_pending' && v['呼び先'] === 'translate-review');
  t(vq.length === 1 && vq[0].webhook === NEW && vq[0]['イベント'] === 'INSERT'
    && vr.some((v) => v.table === 'reviews_v2' && v['呼び先'] === 'translate-review')
    && vr.some((v) => v.table === 'pv_review_pending' && v['呼び先'] === 'notify-admin'),
    '確認の表に、預かりの translate-review が1本・INSERT と出る（ひな型と通知の行も見える）', hide(J(vr)));
  t(vr.length > 0 && !J(vr).includes(KEY) && !J(vr).includes('Bearer'), '確認の表にキーが出ない');

  // ── 何度流しても1本 ──
  const afterQ = await x.trigs('pv_review_pending');
  const r2 = await x.run(sql);
  const r3 = await x.run(sql);
  t(r2.err === null && r3.err === null && J(await x.trigs('pv_review_pending')) === J(afterQ), '貼り直しても、トリガは1本も増えない・変わらない');

  // ── 呼ばれる回 ──
  await x.db.exec(`truncate public.t_hook_log`);
  const qid = (await x.one(`insert into public.pv_review_pending (claim_token, airline, culture_comment) values ('tok', 'jal', '預かりの確認用。') returning id`)).id;
  await x.db.query(`update public.pv_review_pending set claimed_at = now(), culture_comment = null where id = $1`, [qid]);
  await x.db.exec(`insert into public.reviews_v2 (airline, culture_comment) values ('jal', '口コミの確認用。')`);
  const log = await x.rows(`select tbl, op, target, method, headers, wait from public.t_hook_log order by seq`);
  const fnOf = (l) => String(l.target).replace(/^.*\/functions\/v1\//, '');
  const tq = log.filter((l) => l.tbl === 'pv_review_pending' && fnOf(l) === 'translate-review');
  t(J(tq.map((l) => l.op)) === J(['INSERT']), '預かりが入ったときに1回だけ呼ばれる（引き取りの UPDATE では呼ばない）', J(log.map((l) => `${l.tbl} ${l.op} ${fnOf(l)}`)));
  t(tq.length === 1 && tq[0].method === 'POST' && tq[0].headers === HEADERS && tq[0].wait === '1000', '呼び先・ヘッダ・待ち時間がひな型と同じ');
  t(J(log.filter((l) => l.tbl === 'reviews_v2').map((l) => `${l.op} ${fnOf(l)}`)) === J(['INSERT translate-review'])
    && J(log.filter((l) => l.tbl === 'pv_review_pending' && fnOf(l) === 'notify-admin').map((l) => l.op)) === J(['INSERT']),
    '口コミの翻訳と預かりの通知は、今までどおりの回にだけ呼ばれる', J(log.map((l) => `${l.tbl} ${l.op} ${fnOf(l)}`)));

  // ── 画面から作った別名の1本が在れば足さない ──
  await x.db.exec(`drop trigger if exists ${NEW} on public.pv_review_pending`);   // 作れていない版（壊す証明）でも先へ進む
  await x.db.exec(hookOn('"Judge pending review"', 'pv_review_pending', 'insert', 'translate-review'));
  const r5 = await x.run(sql);
  const s5 = await x.toJudge();
  t(r5.err === null && s5.length === 1 && s5[0].n === 'Judge pending review', '名前が違っても、呼び先が同じなら作らない（1件で2回判定しない）', J(s5.map((s) => s.n)));
  await x.db.exec(`drop trigger "Judge pending review" on public.pv_review_pending`);

  // ── ひな型に条件が付いていたら、写さずに止まる ──
  for (const [label, events, extra] of [
    ['WHEN の条件つき', 'insert', "when (new.orig_lang = 'en')"],
    ['列を指定した UPDATE', 'insert or update of translations', ''],
  ]) {
    await x.db.exec(`drop trigger "Translate review" on public.reviews_v2`);
    await x.db.exec(hookOn('"Translate review"', 'reviews_v2', events, 'translate-review', extra));
    const snap = J([await x.trigs('reviews_v2'), await x.trigs('pv_review_pending')]);
    const r = await x.run(sql);
    t(r.err !== null && /差し替えに失敗/.test(r.err) && (await x.toJudge()).length === 0
      && J([await x.trigs('reviews_v2'), await x.trigs('pv_review_pending')]) === snap,
      `${label}のひな型 → 止まって何も作らない（条件ごと写すと、呼ばれるはずの回に呼ばれない）`, hide(r.err));
    t(r.err !== null && /差し替えた定義の頭: CREATE TRIGGER /.test(r.err) && !r.err.includes(KEY) && !r.err.includes('Bearer') && !r.err.includes('example.supabase.co'),
      `${label}：止まったときの文（detail・hint まで）に、キーも URL も出ない`, hide(r.err));
  }
  return out;
}

let pass = 0, fail = 0;
const say = (ok, msg) => { if (ok) { pass++; console.log(`  ✅ ${msg}`); } else { fail++; console.log(`  ❌ ${msg}`); } };

console.log('\n▼ 預かりを判定へ回す Webhook（db/review-judge-webhook.sql）');
for (const [ok, name, detail] of await suite(SQL)) say(ok, ok || !detail ? name : `${name}\n       ${String(detail).slice(0, 400)}`);

console.log('\n▼ 壊す証明');
const BREAK = [
  ['受け皿が無くても進む', "    raise exception using\n      message = '口コミの AI の判定の表", "    raise notice using\n      message = '口コミの AI の判定の表", '受け皿'],
  ['WHEN の確かめを外す', "     or position('FOR EACH ROW EXECUTE ' in newdef) <> length(head) + 1\n", '', 'WHEN の条件つき'],
  ['呼び先で既存を探さない', "   and pg_get_triggerdef(tg.oid) like '%/functions/v1/translate-review%'\n   order by tg.tgname", "   and tg.tgname = 'translate_review_pv_review_pending'\n   order by tg.tgname", '名前が違っても'],
  ['UPDATE でも呼ぶ', "' AFTER INSERT ON public.pv_review_pending'\n", "' AFTER INSERT OR UPDATE ON public.pv_review_pending'\n", '1本できる'],
];
for (const [name, from, to, must] of BREAK) {
  if (SQL.split(from).length !== 2) { say(false, `${name}：差し替える字が SQL に1回だけ無い（検査が古い）`); continue; }
  let failed;
  try { failed = (await suite(SQL.replace(from, () => to))).filter(([ok]) => !ok).map(([, n]) => n); }
  catch (e) { failed = [`例外: ${String(e.message || e).slice(0, 80)}`]; }
  const hit = failed.some((n) => n.includes(must));
  say(hit, `${name} → 赤くなる（${failed.length}件）${hit ? `・「${must}」が落ちる` : `・「${must}」が落ちていない：${failed.slice(0, 2).join(' / ')}`}`);
}

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
