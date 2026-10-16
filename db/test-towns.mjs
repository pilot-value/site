/* db/towns.sql を本物の Postgres（PGlite = PG17 の WASM ビルド）に流して確かめる。

   実行: node db/test-towns.mjs
   ネットワーク不要・本番に一切触らない。SQL を直したら必ずこれを通してから
   オーナーに実行を依頼すること。
   ★ check.mjs の一覧には入っていない。db/towns.sql か、このファイルを直した回は、手でこれを流す。

   器は db/test-work-months.mjs と同じ（anon / authenticated ロール、既定権限を
   全付与した状態、auth.uid() の代役、profiles、auth.users）。
   ★既定権限を先に全付与してあるからこそ towns.sql の revoke が意味を持つ。
     無いと「元から権限が無いだけ」を「revoke が効いた」と誤読する。

   流す SQL の並びは serve-local.mjs の SQL_FILES を**そのまま読む**（写さない）。
   手元のサーバーが立ち上がるときと同じ DB の上で通ることを見るため。
   ★あちらに db/towns.sql が並んでいなければ、ここで止める
     （手元のサーバーが読まない SQL を、ここだけで確かめても意味が無い）。
   ⚠️ 器（BOOT）だけは写し（あちらが export していない）。SQL_FILES に新しい前提が
      足されて「▼ SQL の適用」で止まったら、まず serve-local.mjs の BOOT と見比べる。

   ここで見ていること（番号は設計の TS の番号）:
     TS0 貼ったあとに出る検算の1行 ── ポリシー数 0・それ以外は全部 true
     TS1 表の列は決めたものだけ ── 家の住所・位置・人の印（user_id・メール）の列が無い
     TS2 街の鍵 ──「品川」＝「品川駅」、「林口」＝「林口站」。「しながわ」と「品川」は別の鍵
     TS3 中身の検品 ── 受ける形・断る形（断る文も）・黙って落とす形。
         ★書いていない欄は、返す形に鍵ごと無い（未回答は 0 ではない）
     TS4 表も中の部品も、未ログインと会員からは読めない・呼べない

   ⚠️ set_config の第3引数は **false**（＝セッション全体）でなければならない。
      true にすると次の文では auth.uid() が null に戻り、
      「権限で弾かれた」という判定が全部空振りのまま緑になる。

   ⚠️ ここに出てくる会員は全部作り物（crew1@example.com など）。実在の人を1人も書かない。
      会社は語彙（pv_airlines）から機械的に取る。基地 'QZT' と 'QZU' は検査のための作り物。
      街の台帳（db/towns.generated.sql）がまだ無いあいだは、検査が自分で台帳の街を1つ入れる
      （持ち主として・origin 'ledger'）。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import { SQL_FILES } from '../serve-local.mjs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const MINE = 'db/towns.sql';
const TOWNS_SQL = read(MINE);

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };
const J = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x) : x));
const keys = (o) => Object.keys(o || {}).sort().join(',');

if (!SQL_FILES.includes(MINE)) {
  ok(false, 'serve-local.mjs の SQL_FILES に db/towns.sql が無い（手元のサーバーが読まない）');
  process.exit(1);
}
const FILES = [...SQL_FILES];

const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;
await db.exec(`set timezone = 'UTC'`);   // 本番と同じ時計（current_date が「今年」を決める）

// ── 器（serve-local.mjs の BOOT の写し）──────────────────────
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  grant usage on schema public, extensions, auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;

  create table auth.users (
    id uuid primary key, email text, raw_user_meta_data jsonb,
    created_at timestamptz not null default now());
  create unique index auth_users_email on auth.users (lower(email));
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;

  create table public.profiles (
    id uuid primary key, email text, name text,
    email_opt_in boolean not null default false,
    gender text, birthdate date, country text, company text, "position" text);

  create table public.reviews_v2 (
    id uuid primary key default gen_random_uuid(),
    proof_hash text not null, airline text not null, "position" text,
    tenure_bucket text, age_bucket text, fleet text, job_role text,
    monthly_salary integer, bonus integer, annual_salary integer, base_annual integer,
    flight_allowance_annual integer,
    culture_score integer, salary_score integer, benefits_score integer,
    wlb_score integer, ops_score integer, training_score integer, mgmt_score integer,
    culture_comment text, salary_comment text, benefits_comment text,
    wlb_comment text, ops_comment text, training_comment text, mgmt_comment text,
    orig_lang text, translations jsonb,
    created_at timestamptz not null default now());
  alter table public.reviews_v2 enable row level security;
  revoke all on public.reviews_v2 from anon;
  create policy reviews_v2_insert_member on public.reviews_v2
    for insert to authenticated with check (true);
`);

// ── 適用（順番も含めて手元のサーバーと同じ）──────────────────
console.log('\n▼ SQL の適用');
for (const f of FILES) {
  try { await db.exec(read(f)); ok(true, f); }
  catch (e) { ok(false, f, e.message); process.exit(1); }
}

console.log('\n▼ 冪等性（もう一度そのまま流す）');
for (const f of FILES) {
  try { await db.exec(read(f)); ok(true, f + ' 再適用OK'); }
  catch (e) { ok(false, f + ' 再適用で失敗', e.message); }
}

// ── 道具 ─────────────────────────────────────────────────────
const ANON = Symbol('anon');   // 未ログイン

const as = async (who) => {
  await db.exec(who === ANON ? `set role anon` : `set role authenticated`);
  await db.query(`select set_config('pv.uid', $1, false)`, [typeof who === 'string' ? who : '']);
};
const asOwner = async () => { await db.exec(`reset role`); await db.query(`select set_config('pv.uid', '', false)`); };
const call = async (who, sql, params = []) => {
  await as(who);
  try { return { v: (await db.query(sql, params)).rows[0] }; }
  catch (e) { return { err: String(e.message || e) }; }
  finally { await asOwner(); }
};
// 弾かれたのが、名指しした表・関数そのものか（別の理由の失敗を「弾かれた」と数えない）
const denied = (r, what, name) => !!(r.err && new RegExp(`permission denied for ${what} ${name}\\b`, 'i').test(r.err));

/* 外へ返った JSON は全部ためておく。会員の入口ができたら、最後の節で
   「出てはいけないもの」を1つ残らず見るため。 */
const seen = [];
const rpc = async (who, fn, p) => {
  const r = await call(who, `select public.${fn}($1::jsonb) as v`, [p === undefined ? null : J(p)]);
  if (r.err) return { __err: r.err };
  seen.push({ fn, json: J(r.v.v) });
  return r.v.v;
};

// 以下は持ち主（postgres）として実行する。検査の準備と、表の中身を直接見るため
const one  = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const many = async (sql, params = []) => (await db.query(sql, params)).rows;

// 会員を1人作る（auth.users に入れると db/schema-additions.sql のトリガが profiles を作る）
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let seat = 0;
const member = async () => {
  const id = uid(++seat), mail = `crew${seat}@example.com`;
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, mail]);
  await db.query(`insert into public.profiles (id, email) values ($1, $2) on conflict (id) do nothing`, [id, mail]);
  return id;
};

// 準備の確かめ。通れば何も数えない。崩れたら ❌ を1行出して数える（黙って先へ進まない）
const must = (c, l, e = '') => { if (!c) ok(false, '（準備が崩れた）' + l, e); return !!c; };

// 会社は語彙から機械的に取る（打ち込まない）
const [A1, A2, A3] = (await many(
  `select code from public.pv_airlines where code <> 'other' and active order by code limit 3`)).map((r) => r.code);
const CUR = (await one(`select code from public.pv_currencies where active order by code limit 1`)).code;
const BASE = 'QZT';       // 検査のための作り物の基地（A1 にだけ台帳の街を入れる）
const NO_SCOPE = 'QZU';   // 台帳の街が1つも無い基地

// 台帳の街を1つ（db/towns.generated.sql が来るまで、検査が持ち主として入れる）
await db.query(
  `insert into public.pv_towns (airline, base_iata, tkey, name, origin, state)
   values ($1, $2, public.pv_town_key($3), $3, 'ledger', 'public')
   on conflict (airline, base_iata, tkey) do nothing`, [A1, BASE, '品川']);
must((await one(`select count(*)::int as n from public.pv_towns where airline = $1 and base_iata = $2`, [A1, BASE])).n === 1,
     `台帳の街が1つ入っていない（${A1} / ${BASE}）`);


// ════════════════════════════════════════════════════════════
console.log('\n▼ TS0 貼ったあとに出る検算の1行');
// ════════════════════════════════════════════════════════════
// ★段が進んで検算の値が増えたら、ここに足す（列の数ごと見ている ＝ 値が黙って消えても赤くなる）
const CLOSING = ['表は閉じている', '表は誰も直接読めない', '住所も位置も人の印も持たない'];
{
  const res = await db.exec(TOWNS_SQL);
  const chk = res[res.length - 1].rows[0] || {};
  ok(keys(chk) === ['ポリシー数', ...CLOSING].sort().join(','),
     `TS0 検算の列は ${1 + CLOSING.length} つ（ポリシー数・${CLOSING.join('・')}）`, J(chk));
  ok(chk['ポリシー数'] !== undefined && Number(chk['ポリシー数']) === 0, 'TS0 ポリシー数は 0', J(chk));
  for (const k of CLOSING) ok(chk[k] === true, `TS0 「${k}」が true`, J(chk));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TS1 表の列は決めたものだけ（住所・位置・人の印の列が無い）');
// ════════════════════════════════════════════════════════════
{
  const COLS = {
    pv_towns: ['id', 'airline', 'base_iata', 'tkey', 'name', 'origin', 'state', 'alias_of', 'created_at', 'moderated_at'],
    pv_town_posts: ['id', 'author_hash', 'airline', 'base_iata', 'town_id', 'lived', 'lived_to_year', 'good', 'concern',
      'text_state', 'rent_layout', 'rent_area', 'rent_area_unit', 'rent_amount', 'rent_currency', 'trip_mode',
      'trip_airport', 'trip_terminal', 'trip_hour', 'trip_minutes', 'lang', 'created_at', 'updated_at', 'moderated_at'],
  };
  const all = [];
  for (const [t, want] of Object.entries(COLS)) {
    const got = (await many(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = $1 order by ordinal_position`, [t])).map((r) => r.column_name);
    all.push(...got);
    ok(J(got) === J(want), `TS1 ${t} の列は決めた ${want.length} 列だけ（並びも同じ）`, J(got));
  }
  const PLACE = /(^|_)(address|lat|latitude|lng|lon|longitude|geo|coord|coords|postal|zip|user_id|uid|email)($|_)/;
  ok(all.length > 0 && !all.some((c) => PLACE.test(c)),
     'TS1 どの列も、住所・位置・人の印（user_id・uid・email）の名前ではない', J(all.filter((c) => PLACE.test(c))));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TS2 街の鍵');
// ════════════════════════════════════════════════════════════
{
  const key = async (s) => (await one(`select public.pv_town_key($1) as k`, [s])).k;
  const TABLE = [
    ['品川', '品川'], ['品川駅', '品川'], [' 品川　駅 ', '品川'],
    ['林口', '林口'], ['林口站', '林口'],
    ['ＴＳＩＮＧ　ＹＩ', 'tsingyi'], ['ＡＢＣ１２３', 'abc123'],
    ['Tsing Yi Station', 'tsingyi'], ['tsing yi', 'tsingyi'], ['TSINGYI', 'tsingyi'],
    ['品川（東京都）', '品川'], ['Tung Chung (Lantau)', 'tungchung'],
    ['天王洲・アイル', '天王洲アイル'],
    ['駅', null], ['站', null], ['', null], [null, null],
  ];
  for (const [typed, want] of TABLE) {
    const got = await key(typed);
    ok(got === want, `TS2 ${J(typed)} → ${J(want)}`, '実際は ' + J(got));
  }
  const a = await key('しながわ'), b = await key('品川');
  ok(a !== null && b !== null && a !== b, 'TS2 「しながわ」と「品川」は別の鍵（かなと漢字を機械で束ねない）', J({ a, b }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TS3 中身の検品（受ける・断る・黙って落とす）');
// ════════════════════════════════════════════════════════════
{
  const clean = async (p) => {
    try { return (await db.query(`select public.pv_town_clean($1::jsonb) as v`, [J(p)])).rows[0].v; }
    catch (e) { return { __err: String(e.message || e), code: e.code }; }
  };
  const P0 = { airline: A1, base_iata: BASE, town: '品川' };
  const MIN = 'airline,base_iata,lang,tkey,town';

  const m = await clean(P0);
  ok(!m.__err && keys(m) === MIN && m.airline === A1 && m.base_iata === BASE && m.town === '品川' && m.tkey === '品川' && m.lang === 'ja',
     'TS3 いちばん小さい投稿は airline・base_iata・lang・tkey・town の5つだけを返す（書いていない欄は鍵ごと無い）', J(m));
  const e = await clean({ ...P0, lived: '', lived_to_year: '', good: '', concern: ' ',
                          rent: { layout: '', area: '', amount: '', currency: '' }, trip: { mode: '', hour: '', minutes: '' } });
  ok(!e.__err && keys(e) === MIN, 'TS3 空の欄を送っても、その欄は鍵ごと無い（未回答を 0 にしない）', J(e));

  const ADDR = '街・最寄駅に、番地・部屋番号・URL は書けません';
  const LAY = '間取りが正しくありません';
  const TERM = 'ターミナルが正しくありません';
  const MINS = '通勤の所要時間は1〜600分で入れてください';
  const REFUSE = [
    ['知らない会社', { ...P0, airline: 'zz-none' }, '航空会社が正しくありません'],
    ["会社 'other'", { ...P0, airline: 'other' }, '航空会社が正しくありません'],
    ['台帳の街が無い基地', { ...P0, base_iata: NO_SCOPE }, '基地が正しくありません'],
    ['空の街', { ...P0, town: '' }, '街・最寄駅は1〜30字で入れてください'],
    ['31字の街', { ...P0, town: 'あ'.repeat(31) }, '街・最寄駅は1〜30字で入れてください'],
    ['番地の形の街（1-2-3）', { ...P0, town: '北品川1-2-3' }, ADDR],
    ['「〒」の付いた街', { ...P0, town: '〒品川' }, ADDR],
    ['4けたの数字が続く街', { ...P0, town: '品川1234' }, ADDR],
    ['URL の街', { ...P0, town: 'https://example.com' }, ADDR],
    ['良い点 201字', { ...P0, good: 'あ'.repeat(201) }, '良い点は200字までです'],
    ['気になる点に URL', { ...P0, concern: '詳しくは https://example.com' }, '良い点・気になる点に、URL やメールアドレスは書けません'],
    ['広さ 3 ㎡', { ...P0, rent: { area: '3', area_unit: 'm2' } }, '広さが正しくありません'],
    ['広さ「約30」', { ...P0, rent: { area: '約30' } }, '広さが正しくありません'],
    ['月額「20万」', { ...P0, rent: { amount: '20万', currency: CUR } }, '家賃の月額が正しくありません'],
    ['月額に通貨が無い', { ...P0, rent: { amount: '150000' } }, '家賃の通貨を選んでください'],
    ['間取り 13字', { ...P0, rent: { layout: 'あ'.repeat(13) } }, LAY],
    ['間取り「1-2-3」', { ...P0, rent: { layout: '1-2-3' } }, LAY],
    ['ターミナル 13字', { ...P0, trip: { terminal: 'T'.repeat(13) } }, TERM],
    ['URL のターミナル', { ...P0, trip: { terminal: 'www.t1.jp' } }, TERM],
    ['所要時間 0分', { ...P0, trip: { minutes: '0' } }, MINS],
    ['所要時間 601分', { ...P0, trip: { minutes: '601' } }, MINS],
  ];
  for (const [label, p, say] of REFUSE) {
    const r = await clean(p);
    ok(!!r.__err && r.__err === say && r.code === '22023', `TS3 断る：${label} →「${say}」`, J(r));
  }

  for (const lay of ['1K', '3 bed', '2LDK+S']) {
    const r = await clean({ ...P0, rent: { layout: lay } });
    ok(!r.__err && J(r.rent) === J({ layout: lay }), `TS3 受ける：間取り「${lay}」は打ったとおりの字で返る`, J(r));
  }
  {
    const r = await clean({ ...P0, rent: { layout: '2LDK', area: '55.5', amount: '180000', currency: CUR.toLowerCase() },
                            trip: { mode: 'train', airport: 'hnd', terminal: 'T3', hour: '7', minutes: '45' } });
    ok(!r.__err && J(r.rent) === J({ area: 55.5, amount: 180000, layout: '2LDK', currency: CUR, area_unit: 'm2' })
       && J(r.trip) === J({ hour: 7, mode: 'train', airport: 'HND', minutes: 45, terminal: 'T3' }),
       'TS3 （対照）語彙の中の値は、家賃も通勤も全部そろって返る ＝ 下の「黙って落とす」は見分けられる', J(r));
  }

  const DROP = [
    ['知らない住んだ時期', { ...P0, lived: 'soon' }, 'lived'],
    ['知らない交通手段', { ...P0, trip: { mode: 'rocket' } }, 'trip'],
    ['時間帯 24', { ...P0, trip: { hour: '24' } }, 'trip'],
    ['4文字の空港', { ...P0, trip: { airport: 'HNDX' } }, 'trip'],
  ];
  for (const [label, p, k] of DROP) {
    const r = await clean(p);
    ok(!r.__err && keys(r) === MIN && !(k in r), `TS3 黙って落とす：${label}（${k} の鍵が無い・断らない）`, J(r));
  }
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TS4 表も中の部品も、未ログインと会員からは読めない・呼べない');
// ════════════════════════════════════════════════════════════
{
  const M1 = await member();
  const post = J({ airline: A1, base_iata: BASE, town: '品川' });
  const FNS = [
    ['pv_town_key',       `select public.pv_town_key('品川') as v`, []],
    ['pv_town_hash',      `select public.pv_town_hash($1::uuid, $2) as v`, [M1, A1]],
    ['pv_town_clean',     `select public.pv_town_clean($1::jsonb) as v`, [post]],
    ['pv_town_post_json', `select public.pv_town_post_json(null::public.pv_town_posts, null::public.pv_towns) as v`, []],
    ['pv_town_held_json', `select public.pv_town_held_json($1::jsonb) as v`, [post]],
    ['pv_town_rev',       `select public.pv_town_rev(null::public.pv_town_posts) as v`, []],
    ['pv_town_newer',     `select public.pv_town_newer($1::uuid, $2::jsonb, now()) as v`, [M1, post]],
  ];
  for (const [who, label] of [[ANON, '未ログイン'], [M1, '会員']]) {
    for (const t of ['pv_towns', 'pv_town_posts', 'pv_town_rate']) {
      const r = await call(who, `select count(*)::int as n from public.${t}`);
      ok(denied(r, 'table', t), `TS4 ${label}：${t} を直接読めない`, J(r));
    }
    for (const [fn, sql, params] of FNS) {
      const r = await call(who, sql, params);
      ok(denied(r, 'function', fn), `TS4 ${label}：${fn} を呼べない`, J(r));
    }
  }
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
