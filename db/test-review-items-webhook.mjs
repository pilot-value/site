/* db/test-review-items-webhook.mjs — 口コミの本文が書き足されたら translate-review をもう一度呼ぶ Webhook
   （db/review-items-webhook.sql・2026-11-20）を、本物の Postgres（PGlite）で流して確かめる。

   実行: node db/test-review-items-webhook.mjs
   ネットワーク不要・本番に一切触らない。supabase_functions.http_request は「呼ばれた」を表に書くだけの身代わり。

   守っているもの
     ・作るのは reviews_v2 の「7つの本文の書き足し」にだけ translate-review を呼ぶ1本。URL・認証ヘッダ・待ち時間は
       INSERT のひな型のまま（キーを打ち込まない）。ひな型には1文字も触らない
     ・訳を書く（translations だけが変わる）では呼ばない ＝ 翻訳が自分を呼び続ける輪にならない
     ・本文が変わり、訳が消えたときだけ呼ぶ（submit_review_item が消す）。運営の「載せる」（airline = airline）でも呼ばない
     ・何度流しても1本・1項目ずつ保存する関数（db/review-items.sql）が無ければ作らない・ひな型が無ければ作らない
   ★壊す証明：条件（WHEN と列の指定）を外した版では、訳を書くたびに呼ばれて赤くなる。
*/
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'fs';

const SQL = readFileSync(new URL('./review-items-webhook.sql', import.meta.url), 'utf8');
const KEY = 'test-bearer-not-a-real-key';
const HEADERS = `{"Content-type":"application/json","Authorization":"Bearer ${KEY}"}`;
const hookOn = (name, events, fn) => `create trigger ${name} after ${events} on public.reviews_v2
   for each row execute function supabase_functions.http_request(
     'https://example.supabase.co/functions/v1/${fn}', 'POST', '${HEADERS}', '{}', '5000')`;
const COMMENTS = ['culture', 'salary', 'benefits', 'wlb', 'ops', 'training', 'mgmt'].map((k) => `${k}_comment text`).join(', ');

const db = new PGlite();
await db.waitReady;
async function fresh({ items = true, template = true } = {}) {
  await db.exec(`
    drop schema if exists supabase_functions cascade;
    drop table if exists public.t_hook_log, public.reviews_v2 cascade;
    drop function if exists public.submit_review_item(jsonb);
    create schema supabase_functions;
    create table public.t_hook_log (seq serial primary key, op text, target text, headers text, wait text);
    create function supabase_functions.http_request() returns trigger language plpgsql as $f$
    begin
      insert into public.t_hook_log (op, target, headers, wait) values (TG_OP, TG_ARGV[0], TG_ARGV[2], TG_ARGV[4]);
      return null;
    end $f$;
    create table public.reviews_v2 (id uuid primary key default gen_random_uuid(), airline text, ${COMMENTS},
      orig_lang text not null default 'ja', translations jsonb);
  `);
  if (items) await db.exec(`create function public.submit_review_item(p jsonb) returns jsonb language sql as $f$ select '{}'::jsonb $f$`);
  if (template) await db.exec(`${hookOn('"Translate review"', 'insert', 'translate-review')};
                               ${hookOn('notify_admin_reviews_v2', 'insert', 'notify-admin')};`);
}
const rows = async (q, p) => (await db.query(q, p)).rows;
const run = async (src) => {
  try { const r = await db.exec(src); return { err: null, last: r[r.length - 1]?.rows ?? [] }; }
  catch (e) { return { err: [e.message, e.detail, e.hint].filter(Boolean).join(' ｜ ') || String(e), last: [] }; }
};
const trigs = () => rows(`select tg.tgname n, pg_get_triggerdef(tg.oid) d from pg_trigger tg
   where not tg.tgisinternal and tg.tgrelid = to_regclass('public.reviews_v2') order by 1`);
const log = async () => rows(`select op, target, headers, wait from public.t_hook_log order by seq`);

async function suite(sql) {
  const out = [];
  const t = (ok, name, detail = '') => out.push([!!ok, name, detail]);

  await fresh();
  const before = (await trigs()).map((x) => x.d);
  const r1 = await run(sql);
  const after = await trigs();
  const up = after.filter((x) => x.d.includes('translate-review') && x.d.includes(' AFTER UPDATE '));
  t(!r1.err && up.length === 1 && up[0].n === 'translate_review_items_update', '本文の書き足しの Webhook が1本できる', r1.err || JSON.stringify(after.map((x) => x.n)));
  t(up[0] && up[0].d.includes(`'${HEADERS}'`) && up[0].d.includes("'5000'") && up[0].d.includes('/functions/v1/translate-review'),
    '呼び先・認証ヘッダ・待ち時間は INSERT のひな型のまま');
  t(before.every((d) => after.some((x) => x.d === d)), 'ひな型（translate-review と notify-admin の INSERT）には1文字も触らない');
  t(r1.last.length >= 3 && !JSON.stringify(r1.last).includes(KEY), '最後の確認の表が出て、キーは出ない', JSON.stringify(r1.last).slice(0, 200));

  const r2 = await run(sql);
  t(!r2.err && (await trigs()).filter((x) => x.d.includes(' AFTER UPDATE ')).length === 1, '2回流しても1本のまま');

  await db.exec(`insert into public.reviews_v2 (airline, salary_comment) values ('ana', '給与の本文')`);
  const id = (await rows(`select id from public.reviews_v2 limit 1`))[0].id;
  const n0 = (await log()).length;
  await db.query(`update public.reviews_v2 set wlb_comment = 'WLB の本文', translations = null where id = $1`, [id]);
  const l1 = await log();
  t(l1.length === n0 + 1 && l1[l1.length - 1].op === 'UPDATE' && l1[l1.length - 1].target.endsWith('/translate-review'),
    '本文を書き足して訳を消したら、translate-review を1回呼ぶ', JSON.stringify(l1.slice(n0)));
  await db.query(`update public.reviews_v2 set translations = '{"en":{"salary":"pay"}}', orig_lang = 'ja' where id = $1`, [id]);
  t((await log()).length === l1.length, '訳を書く（translations だけ）では呼ばない ＝ 輪にならない');
  await db.query(`update public.reviews_v2 set airline = airline where id = $1`, [id]);
  t((await log()).length === l1.length, '運営の「載せる」（airline = airline）では呼ばない');
  await db.query(`update public.reviews_v2 set salary_comment = '書き換え' where id = $1`, [id]);
  t((await log()).length === l1.length, '訳が残ったままの書き換えでは呼ばない（訳を消すのは submit_review_item）');
  return out;
}

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };

console.log('\n▼ 本物');
for (const [c, l, e] of await suite(SQL)) ok(c, l, e);

console.log('\n▼ 受け皿・ひな型が無いときは作らない');
await fresh({ items: false });
let r = await run(SQL);
ok(!!r.err && r.err.includes('db/review-items.sql') && !(await trigs()).some((x) => x.d.includes(' AFTER UPDATE ')),
   '1項目ずつ保存する関数が無ければ、作らずに止まる', r.err);
await fresh({ template: false });
r = await run(SQL);
ok(!!r.err && !(await trigs()).length && !r.err.includes(KEY), 'ひな型が無ければ、作らずに止まる（キーは出ない）', r.err);

console.log('\n▼ 壊す証明');
{
  const broken = SQL.replace(/ AFTER UPDATE OF culture_comment[^']*'\s*\|\| ' ON public\.reviews_v2 FOR EACH ROW WHEN[\s\S]*?\(old\.mgmt_comment IS DISTINCT FROM new\.mgmt_comment\)\)\) ';/,
    () => ` AFTER UPDATE ON public.reviews_v2 FOR EACH ROW ';`);
  ok(broken !== SQL, '（準備）条件（列の指定と WHEN）を外した版を作れた');
  const res = await suite(broken);
  const loop = res.find(([, l]) => l.startsWith('訳を書く'));
  ok(loop && loop[0] === false, '★壊す証明：条件を外すと、訳を書くたびに呼ばれる（上の「輪にならない」が赤くなる）');
}

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
