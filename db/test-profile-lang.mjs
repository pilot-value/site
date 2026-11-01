/* db/test-profile-lang.mjs — 会員の言語（profiles.lang・pv_set_lang）を本物の Postgres（PGlite）で確かめる。
   実行: node db/test-profile-lang.mjs   ネットワーク不要・本番に一切触らない。

   見ること
     ・本人は自分の行の言語だけを書ける（ほかの人の行は1文字も変わらない）
     ・一覧に無い言語・空・未ログインは黙って捨てる（エラーにしない＝登録を止めない）
     ・会員が profiles.lang を直接書くことはできない（書く口は関数1本だけ）
     ・何度貼っても同じ（冪等）
     ・壊す証明：関数から「本人の行だけ」の条件を外すと、ほかの人の行まで書き換わる */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'fs';
const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';

async function fresh(sql) {
  const db = new PGlite();
  await db.waitReady;
  await db.exec(`
    create schema if not exists auth;
    create role anon; create role authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    create table public.profiles (id uuid primary key, email text, name text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('pv.uid', true), '')::uuid $$;
    /* 本番と同じく、会員が書ける列は名指しの分だけ（db/admin.sql）。lang は入れない */
    revoke insert, update on public.profiles from authenticated;
    grant select on public.profiles to authenticated;
    grant update (email, name) on public.profiles to authenticated;
  `);
  await db.exec(sql);
  await db.query(`insert into public.profiles(id,email) values($1,'a@example.com'),($2,'b@example.com')`, [A, B]);
  return db;
}
const as = async (db, uid) => { await db.exec('set role authenticated'); await db.query(`select set_config('pv.uid', $1, false)`, [uid || '']); };
const owner = async (db) => { await db.exec('reset role'); await db.query(`select set_config('pv.uid', '', false)`); };
const langOf = async (db, id) => (await db.query('select lang from public.profiles where id = $1', [id])).rows[0].lang;

const SQL = read('db/profile-lang.sql');

console.log('\n▼ 適用と冪等性');
const db = await fresh(SQL);
ok(true, 'db/profile-lang.sql を流せた');
try { await db.exec(SQL); ok(true, 'もう一度流しても落ちない'); } catch (e) { ok(false, 'もう一度流すと落ちる', e.message); }
const checks = (await db.query(SQL.slice(SQL.indexOf('select case when exists (select 1 from information_schema.columns')))).rows;
ok(checks.every((r) => String(Object.values(r)[0]).startsWith('✅')), '末尾の検算が全部 ✅', JSON.stringify(checks));

console.log('\n▼ 本人の行だけを書く');
await as(db, A); await db.query(`select public.pv_set_lang('es')`); await owner(db);
ok(await langOf(db, A) === 'es', 'A が es を書けた');
ok(await langOf(db, B) === null, 'B の行は変わらない');

console.log('\n▼ 一覧に無い値・空・未ログインは黙って捨てる');
for (const bad of ['fr', '', 'ES', "es'; drop table profiles; --"]) {
  await as(db, A);
  let err = null;
  try { await db.query('select public.pv_set_lang($1)', [bad]); } catch (e) { err = e.message; }
  await owner(db);
  ok(!err && await langOf(db, A) === 'es', `「${bad}」は捨てて es のまま（エラーも出さない）`, err || '');
}
await as(db, A); await db.query('select public.pv_set_lang(null)'); await owner(db);
ok(await langOf(db, A) === 'es', 'null も捨てる');
await as(db, null);
let anonErr = null;
try { await db.exec(`set role anon`); await db.query(`select public.pv_set_lang('ja')`); } catch (e) { anonErr = e.message; }
await owner(db);
ok(!!anonErr && await langOf(db, A) === 'es', '未ログイン（anon）からは呼べない', anonErr || '呼べてしまった');

console.log('\n▼ 会員が列を直接書けない');
await as(db, A);
let direct = null;
try { await db.query(`update public.profiles set lang = 'ja' where id = $1`, [A]); } catch (e) { direct = e.message; }
await owner(db);
ok(!!direct && await langOf(db, A) === 'es', 'update profiles set lang は権限で弾かれる', direct || '書けてしまった');

console.log('\n▼ 壊す証明：本人の行だけの条件を外すと、ほかの人の行まで変わる（＝この検査は効いている）');
const broken = SQL.replace("where id = auth.uid() and lang is distinct from p_lang;", () => 'where lang is distinct from p_lang;');
ok(broken !== SQL, '壊した SQL を作れた');
const db2 = await fresh(broken);
await as(db2, A); await db2.query(`select public.pv_set_lang('es')`); await owner(db2);
ok(await langOf(db2, B) === 'es', '壊した版では B の行まで es になる（＝上の「B は変わらない」は意味のある検査）');

console.log(`\n==== ${pass}/${pass + fail} passed ====`);
process.exit(fail ? 1 : 0);
