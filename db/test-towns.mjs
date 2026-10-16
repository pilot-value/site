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
     TS5 未ログインは入口（submit_town_post・my_town_posts）を呼べない・ログインが死んでいれば「ログインが必要です」
     TS6 候補から選んだ街は、その場で数に入る ── 同じ人が何度出しても（「…駅」と書いても）1行
     TS7 候補に無い名前は、会員の街（origin member・pending）として1行。2人目が打っても同じ行
     TS8 文（良い点・気になる点）は、新しい時と1文字でも変えた時に確認待ち。消せば none
     TS9 街を直す（was）── 前の街の行は消え、新しい街に1行。ほかの人の行には触らない
     TS10 上限 ── 1つの会社に10か所・1日20回・候補に無い名前は1日3つ（detail 'names'）
     TS11 自分の投稿は自分の行だけ。1件の形は POST の10個の鍵
     TS12 資格を1つも付けない ── 呼ぶたびに、プロフィールの行・給与の行の数・運営の名簿・pv_contrib_give の返事が同じ
     TS13 運営が見送った名前は、断る文で止まり、何も書かない
     TZ  返事に、64けたの16進・author_hash・user_id・created_at・updated_at が無い。住んだ時期・家賃・通勤は本人への返事だけ

   ⚠️ set_config の第3引数は **false**（＝セッション全体）でなければならない。
      true にすると次の文では auth.uid() が null に戻り、
      「権限で弾かれた」という判定が全部空振りのまま緑になる。

   ⚠️ ここに出てくる会員は全部作り物（crew1@example.com など）。実在の人を1人も書かない。
      会社は語彙（pv_airlines）から機械的に取る。基地 'QZT' と 'QZU' は検査のための作り物。
      街の台帳（db/towns.generated.sql）がまだ無いあいだは、検査が自分で台帳の街を入れる
      （持ち主として・origin 'ledger'）。運営が足した街（origin 'operator'）と、運営の承認・見送り
      （state の書き換え）も、運営の口ができるまでは持ち主として書く。
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
const DEAD = Symbol('dead');   // ロールは会員だが、ログインが死んでいる（uid が空）

const as = async (who) => {
  await db.exec(who === ANON ? `set role anon` : `set role authenticated`);
  await db.query(`select set_config('pv.uid', $1, false)`, [typeof who === 'string' ? who : '']);
};
const asOwner = async () => { await db.exec(`reset role`); await db.query(`select set_config('pv.uid', '', false)`); };
const call = async (who, sql, params = []) => {
  await as(who);
  try { return { v: (await db.query(sql, params)).rows[0] }; }
  catch (e) { return { err: String(e.message || e), code: e.code, detail: e.detail }; }
  finally { await asOwner(); }
};
// 弾かれたのが、名指しした表・関数そのものか（別の理由の失敗を「弾かれた」と数えない）
const denied = (r, what, name) => !!(r.err && new RegExp(`permission denied for ${what} ${name}\\b`, 'i').test(r.err));

/* 外へ返った JSON は全部ためておく。会員の入口ができたら、最後の節で
   「出てはいけないもの」を1つ残らず見るため。 */
const seen = [];
const rpc = async (who, fn, p) => {
  const r = await call(who, `select public.${fn}($1::jsonb) as v`, [p === undefined ? null : J(p)]);
  if (r.err) return { __err: r.err, code: r.code, detail: r.detail };   // 断る文・エラーコード・detail（上限の見分け）
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
const CLOSING = ['表は閉じている', '表は誰も直接読めない', '住所も位置も人の印も持たない', '入口は決めたものだけ', '資格に触らない'];
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


// ── 会員の入口（TS5〜TS13）の道具 ─────────────────────────────
const post = (who, p) => rpc(who, 'submit_town_post', p);
const mine = (who, p) => rpc(who, 'my_town_posts', p);
const P = (town, x = {}) => ({ airline: A1, base_iata: BASE, town, ...x });
// 弾かれたのが、その関数の実行権か（rpc の返す形で）
const refused = (r, fn) => denied({ err: r && r.__err }, 'function', fn);
// 断る文とエラーコードが、決めたとおりか
const said = (r, msg, code) => !!(r && r.__err === msg && r.code === code);
const POST_KEYS = 'base,concern,good,lived,lived_to_year,rent,text_state,town,town_state,trip';   // 3-c の10個
const LOGIN = 'ログインが必要です';
const hashOf  = async (who, air = A1) => (await one(`select public.pv_town_hash($1::uuid, $2) as h`, [who, air])).h;
const rowsOf  = async (who, air = A1) => many(
  `select s.*, t.name as tname from public.pv_town_posts s join public.pv_towns t on t.id = s.town_id
    where s.author_hash = $1 order by t.tkey collate "C"`, [await hashOf(who, air)]);
const rateOf  = async (who, air = A1) => (await one(
  `select n, names from public.pv_town_rate where author_hash = $1`, [await hashOf(who, air)])) || null;
const townRow = async (name) => (await one(
  `select id, name, origin, state, alias_of from public.pv_towns
    where airline = $1 and base_iata = $2 and tkey = public.pv_town_key($3)`, [A1, BASE, name])) || null;
const countOf = async (t) => (await one(`select count(*)::int as n from public.${t}`)).n;
const postsAt = async (name) => (await one(
  `select count(*)::int as n from public.pv_town_posts
    where town_id = (select id from public.pv_towns where airline = $1 and base_iata = $2 and tkey = public.pv_town_key($3))`,
  [A1, BASE, name])).n;
const yesterday = async (who) => db.query(
  `update public.pv_town_rate set day = current_date - 1 where author_hash = $1`, [await hashOf(who)]);
// 持ち主として、運営の確認を書く（運営の口 pv_town_moderate ができるまで）
const approveText = async (who) => db.query(
  `update public.pv_town_posts set text_state = 'public', moderated_at = now() where author_hash = $1`, [await hashOf(who)]);
const setTown = async (name, state) => db.query(
  `update public.pv_towns set state = $4, moderated_at = now()
    where airline = $1 and base_iata = $2 and tkey = public.pv_town_key($3)`, [A1, BASE, name, state]);

// 候補の街を足す（持ち主として。台帳の街は db/towns.generated.sql、運営の街は pv_town_admin_add ができるまで）
const addTown = (name, origin, aliasOf = null) => db.query(
  `insert into public.pv_towns (airline, base_iata, tkey, name, origin, state, alias_of)
   values ($1, $2, public.pv_town_key($3), $3, $4, 'public',
           (select id from public.pv_towns where airline = $1 and base_iata = $2 and tkey = public.pv_town_key($5)))
   on conflict (airline, base_iata, tkey) do nothing`, [A1, BASE, name, origin, aliasOf]);
await addTown('大崎', 'ledger');
await addTown('Osaki', 'ledger', '大崎');               // 台帳が持つ別の書き方（大崎へ束ねてある）
await addTown('天王洲アイル', 'operator');
const TEN = 'ABCDEFGHIJK'.split('').map((c) => '試験の街' + c);   // 1人に11か所を出させるための、運営の街
for (const t of TEN) await addTown(t, 'operator');
must((await townRow('Osaki'))?.alias_of === (await townRow('大崎'))?.id && (await townRow('大崎')) !== null,
     '台帳の別の書き方（Osaki → 大崎）が入っていない');

// 給与を1件出す（TS12 の「pv_contrib_give の返事が変わらない」を、give の人で見るため）。
// db/test-work-months.mjs の FLEET / PAY / pay / paid の写し（1日の件数は毎回戻す）。月は DB の時計から取る
const NOW = await one(`select extract(year from current_date)::int as y, extract(month from current_date)::int as m`);
const ago = (k) => { const t = NOW.y * 12 + (NOW.m - 1) - k; return { year: Math.floor(t / 12), month: (t % 12) + 1 }; };
const FLEET = (await one(`select code from public.pv_fleets where active order by code limit 1`)).code;
const PAY = { currency: 'USD', lang: 'en', tax_rate_pct: 0, position: 'cap', fleet: FLEET,
              base_pay: 9000, flight_variable_pay: 4000, other_allowance: 4400,
              command_pay: 2000, per_diem: 1000, housing_type: 'allowance', housing_amount: 600 };
const pay = async (who, p) => {
  await db.query(`select set_config('pv.uid', $1, false)`, [who]);
  try { return (await db.query(`select public.submit_pay_report($1::jsonb) as v`, [J({ ...PAY, ...p })])).rows[0].v; }
  catch (e) { return { __err: String(e.message || e) }; }
  finally { await asOwner(); await db.exec(`update public.profiles set pay_reports_today = 0`); }
};
const paid = async (who, airline) => {
  const r = await pay(who, { airline, period_year: ago(1).year, period_month: ago(1).month });
  must(!r.__err && r.access_until != null, `給与を出せなかった（${airline}）`, J(r));
  return r;
};


// ════════════════════════════════════════════════════════════
console.log('\n▼ TS5 未ログインは入口を呼べない・ログインが死んでいれば「ログインが必要です」');
// ════════════════════════════════════════════════════════════
{
  const count = async () => J([await countOf('pv_town_posts'), await countOf('pv_towns'), await countOf('pv_town_rate')]);
  const before = await count();
  const a1 = await post(ANON, P('品川'));
  ok(refused(a1, 'submit_town_post'), 'TS5 未ログイン：submit_town_post を呼べない（実行権が無い）', J(a1));
  const a2 = await mine(ANON, { airline: A1 });
  ok(refused(a2, 'my_town_posts'), 'TS5 未ログイン：my_town_posts を呼べない（実行権が無い）', J(a2));
  const d1 = await post(DEAD, P('品川'));
  ok(said(d1, LOGIN, '42501'), `TS5 ログインが死んでいる会員：submit_town_post →「${LOGIN}」（42501）`, J(d1));
  const d2 = await mine(DEAD, { airline: A1 });
  ok(said(d2, LOGIN, '42501'), `TS5 ログインが死んでいる会員：my_town_posts →「${LOGIN}」（42501）`, J(d2));
  await post(ANON, P('大井町'));
  await post(DEAD, P('大井町', { good: '駅が近い' }));
  ok((await count()) === before, 'TS5 断られた回は、投稿・街・連投の数えのどれにも1行も入っていない（候補に無い名前でも）',
     J({ before, after: await count() }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TS6 候補から選んだ街は、その場で数に入る（同じ人は何度出しても1つ）');
// ════════════════════════════════════════════════════════════
{
  const M = await member();
  const r1 = await post(M, P('品川'));
  ok(!r1.__err && keys(r1) === 'ok,post,replaced,saved' && r1.ok === true && r1.saved === true && r1.replaced === false
     && r1.post.town === '品川' && r1.post.town_state === 'public' && r1.post.text_state === 'none',
     'TS6 候補の街を選ぶ → {ok, saved:true, replaced:false}・街は public・文は none', J(r1));
  const towns0 = await countOf('pv_towns');
  const r2 = await post(M, P('品川'));
  const r3 = await post(M, P('品川駅'));
  ok(r2.replaced === true && r3.replaced === true && r3.post.town === '品川' && r3.post.town_state === 'public',
     'TS6 同じ人が同じ街をもう一度・「品川駅」でもう一度 → どちらも replaced:true（街の名前は候補の「品川」）', J({ r2, r3 }));
  const rows = await rowsOf(M);
  ok(rows.length === 1 && rows[0].tname === '品川', 'TS6 3回出しても、その人の行は1つ', J(rows.map((r) => r.tname)));
  ok((await countOf('pv_towns')) === towns0, 'TS6 「品川駅」で街の行は増えない（鍵で候補の「品川」に決まる）');

  const M2 = await member();
  const r4 = await post(M2, P('品川駅'));
  const rt = await rateOf(M2);
  ok(!r4.__err && r4.replaced === false && r4.post.town === '品川' && r4.post.town_state === 'public'
     && rt && rt.n === 1 && rt.names === 0,
     'TS6 別の人が初めて「品川駅」と書いても、候補の「品川」に入る ── 新しい街の名前としては数えない（names 0）', J({ r4, rt }));
  ok((await postsAt('品川')) === 2, 'TS6 品川の行の数は、出した会員の数（1人目は3回出して1・2人目が1 ＝ 2）', String(await postsAt('品川')));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TS7 候補に無い名前は、運営が見るまで待つ（2人目も同じ街の行に入る）');
// ════════════════════════════════════════════════════════════
{
  const M3 = await member(), M4 = await member();
  const before = await countOf('pv_towns');
  const r1 = await post(M3, P('大井町'));
  const t1 = await townRow('大井町');
  ok(!r1.__err && r1.post.town === '大井町' && r1.post.town_state === 'pending'
     && t1 && t1.origin === 'member' && t1.state === 'pending' && (await countOf('pv_towns')) === before + 1,
     'TS7 候補に無い名前「大井町」→ 街の行が1つ（origin member・state pending）・返事も pending', J({ r1, t1 }));
  const r2 = await post(M4, P('大井町駅'));
  const t2 = await townRow('大井町');
  ok(!r2.__err && r2.post.town === '大井町' && r2.post.town_state === 'pending'
     && t2 && t2.id === t1.id && t2.state === 'pending' && (await countOf('pv_towns')) === before + 1
     && (await postsAt('大井町')) === 2,
     'TS7 2人目が「大井町駅」と打っても、同じ街の行に入る（街の行は増えない・まだ pending）', J({ r2, t2 }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TS8 文は、新しい時と1文字でも変えた時に確認待ち');
// ════════════════════════════════════════════════════════════
{
  const M5 = await member();
  const st = async () => one(`select text_state, moderated_at from public.pv_town_posts where author_hash = $1`, [await hashOf(M5)]);
  const TXT = { good: '駅が近い', concern: '家賃が高い' };
  const r1 = await post(M5, P('品川', TXT));
  ok(!r1.__err && r1.post.text_state === 'pending' && r1.post.good === TXT.good && (await st()).text_state === 'pending',
     'TS8 新しく書いた文 → pending', J(r1));
  const r2 = await post(M5, P('品川', TXT));
  ok(!r2.__err && r2.post.text_state === 'pending' && (await st()).text_state === 'pending', 'TS8 同じ文で出し直す → pending のまま', J(r2));
  await approveText(M5);
  const r3 = await post(M5, P('品川', TXT));
  const s3 = await st();
  ok(!r3.__err && r3.post.text_state === 'public' && s3.text_state === 'public' && s3.moderated_at !== null,
     'TS8 承認（持ち主として）のあと、同じ文で出し直す → public のまま（運営の印 moderated_at も残る）', J({ r3, s3 }));
  const r4 = await post(M5, P('品川', { ...TXT, good: '駅が近い。' }));
  const s4 = await st();
  ok(!r4.__err && r4.post.text_state === 'pending' && s4.text_state === 'pending' && s4.moderated_at === null,
     'TS8 1文字変える（「。」を1つ足す）→ pending に戻り、moderated_at は空に戻る', J({ r4, s4 }));
  await approveText(M5);
  const r5 = await post(M5, P('品川'));
  const s5 = await st();
  ok(!r5.__err && r5.post.text_state === 'none' && r5.post.good === null && r5.post.concern === null && s5.text_state === 'none',
     'TS8 文を消して出し直す → none（良い点・気になる点は空）', J({ r5, s5 }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TS9 街を直す（was）');
// ════════════════════════════════════════════════════════════
{
  const M6 = await member();
  await post(M6, P('品川', { good: '静か' }));
  await approveText(M6);
  const r = await post(M6, P('天王洲アイル', { was: '品川', good: '静か' }));
  const rows = await rowsOf(M6);
  ok(!r.__err && r.replaced === true && r.post.town === '天王洲アイル'
     && rows.length === 1 && rows[0].tname === '天王洲アイル',
     'TS9 街を直す（town 天王洲アイル・was 品川）→ 品川の行は消え、天王洲アイルに1行・replaced:true', J({ r, rows: rows.map((x) => x.tname) }));
  ok(r.post.text_state === 'pending' && rows[0].text_state === 'pending',
     'TS9 街を直した投稿の文は、同じ字でも確認待ちに戻る（承認は前の街のもの）', J(r.post));
  const others = await postsAt('大井町');
  const r2 = await post(M6, P('大崎', { was: '大井町' }));
  ok(!r2.__err && r2.replaced === false && (await rowsOf(M6)).length === 2 && (await postsAt('大井町')) === others,
     'TS9 自分の持っていない街を was に書いても、ほかの人の行には触らない（新しい1行・replaced:false）', J(r2));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TS10 上限（10か所・1日20回・候補に無い名前は1日3つ）');
// ════════════════════════════════════════════════════════════
let NAMER;   // 下の (3) で7か所に出した会員（TS11 が「自分の行だけ」を見る相手）
{
  // (1) 1人・1つの会社に10か所
  const M7 = await member();
  const got = [];
  for (const t of TEN.slice(0, 10)) { const r = await post(M7, P(t)); got.push(!r.__err && r.replaced === false); }
  must(got.length === 10 && got.every(Boolean), '1人で10か所を出せなかった', J(got));
  const r11 = await post(M7, P(TEN[10]));
  ok(said(r11, '1つの会社に出せる街は10か所までです', '22023') && (await rowsOf(M7)).length === 10,
     'TS10 1人・1つの会社で11か所目 → 22023「1つの会社に出せる街は10か所までです」（行は10のまま）', J(r11));
  const rA = await post(M7, P(TEN[0], { lived: 'now' }));
  ok(!rA.__err && rA.replaced === true && (await rowsOf(M7)).length === 10, 'TS10 10か所あっても、持っている街の出し直しは通る', J(rA));
  const rK = await post(M7, P(TEN[10], { was: TEN[0] }));
  const names7 = (await rowsOf(M7)).map((x) => x.tname);
  ok(!rK.__err && rK.replaced === true && names7.length === 10 && names7.includes(TEN[10]) && !names7.includes(TEN[0]),
     'TS10 10か所あっても、街を直す（A → K）は通る（数は10のまま）', J({ rK, names7 }));

  // (2) 1日20回
  const DAY = '1日に投稿できる件数の上限に達しました。明日また続きをどうぞ。';
  const M8 = await member();
  let n = 0;
  for (let i = 0; i < 20; i++) { const r = await post(M8, P('品川')); if (!r.__err) n++; }
  const r21 = await post(M8, P('品川'));
  ok(n === 20 && said(r21, DAY, '54000') && !r21.detail,
     `TS10 1日の21回目 → 54000「${DAY}」・detail は付かない`, J({ n, r21 }));
  await yesterday(M8);
  const r22 = await post(M8, P('品川'));
  ok(!r22.__err && r22.replaced === true, 'TS10 数えの日を前の日へ動かす（持ち主として）→ 次の1回は通る', J(r22));

  // (3) 候補に無い名前は1日3つ ── もう誰かが打った名前も、運営が承認した名前も、同じに数える
  const NAMES = '新しい街の名前を出せるのは、1日に3つまでです。明日また続きをどうぞ。';
  const M9 = await member(), M10 = await member(), M11 = await member();
  for (const t of ['青物横丁', '鮫洲']) must(!(await post(M10, P(t))).__err, `ほかの会員が「${t}」を出せなかった`);
  for (const t of ['立会川', '大森海岸']) must(!(await post(M11, P(t))).__err, `ほかの会員が「${t}」を出せなかった`);
  await setTown('鮫洲', 'public');
  await setTown('大森海岸', 'public');
  const a = await post(M9, P('新馬場'));     // まだ誰も打っていない名前
  const b = await post(M9, P('青物横丁'));   // ほかの会員が打って、確認待ちの名前
  const c = await post(M9, P('鮫洲'));       // ほかの会員が打って、運営（持ち主）が public にした名前
  ok(!a.__err && !b.__err && !c.__err
     && a.post.town_state === 'pending' && b.post.town_state === 'pending' && c.post.town_state === 'public',
     'TS10 候補に無い名前を3つ（新しい名前・確認待ちの名前・承認済みの打たれた名前）→ 3つとも通る（返事は pending・pending・public）', J({ a, b, c }));
  ok((await rateOf(M9))?.names === 3, 'TS10 3つとも、新しい街の名前として数える（names 3）', J(await rateOf(M9)));
  const free = [
    ['台帳の街「品川」', await post(M9, P('品川'))],
    ['運営の街「天王洲アイル」', await post(M9, P('天王洲アイル'))],
    ['台帳の別の書き方「Osaki」', await post(M9, P('Osaki'))],
    ['自分がもう出している打ち込んだ街「新馬場」の出し直し', await post(M9, P('新馬場', { lived: 'now' }))],
  ];
  ok(free.every(([, r]) => !r.__err) && (await rateOf(M9))?.names === 3
     && free[2][1].post.town === '大崎' && free[3][1].replaced === true,
     'TS10 数えない：台帳の街・運営の街・台帳の別の書き方（Osaki → 大崎）・自分の打ち込んだ街の出し直し → 4つとも通り、names は 3 のまま',
     J({ free, rate: await rateOf(M9) }));
  const towns0 = await countOf('pv_towns');
  for (const [label, t] of [['まだ誰も打っていない名前', '北品川'], ['確認待ちの名前', '立会川'], ['承認済みの打たれた名前', '大森海岸']]) {
    const r = await post(M9, P(t));
    ok(said(r, NAMES, '54000') && r.detail === 'names', `TS10 4つ目（${label}「${t}」）→ 54000「${NAMES}」・detail 'names'`, J(r));
  }
  ok((await countOf('pv_towns')) === towns0 && (await townRow('北品川')) === null && (await rowsOf(M9)).length === 6,
     'TS10 断られた4つ目は何も残さない（新しい名前の街の行も一緒に取り消される・本人の行は6のまま）',
     J({ towns0, now: await countOf('pv_towns'), rows: (await rowsOf(M9)).map((x) => x.tname) }));
  await yesterday(M9);
  const d = await post(M9, P('北品川'));
  ok(!d.__err && d.post.town_state === 'pending' && (await rateOf(M9))?.names === 1,
     'TS10 数えの日を前の日へ動かす（持ち主として）→ 4つ目の名前も通る（その日の1つ目）', J({ d, rate: await rateOf(M9) }));
  NAMER = M9;
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TS11 自分の投稿は、自分の行だけ');
// ════════════════════════════════════════════════════════════
{
  const M9 = NAMER;
  const r9 = await mine(M9, { airline: A1 });
  const want = (await rowsOf(M9)).map((x) => x.tname).sort();
  ok(!r9.__err && keys(r9) === 'ok,posts' && r9.ok === true && r9.posts.length === want.length && want.length === 7
     && J(r9.posts.map((x) => x.town).sort()) === J(want),
     `TS11 my_town_posts：自分の行が全部・自分の行だけ返る（${want.length}件）`, J({ r9, want }));
  ok(r9.posts.length > 0 && r9.posts.every((x) => keys(x) === POST_KEYS), 'TS11 1件の形は POST の10個の鍵だけ', J(r9.posts[0]));

  const O = await member();
  await post(O, P('大井町'));
  const ro = await mine(O, { airline: A1 });
  ok(!ro.__err && ro.posts.length === 1 && ro.posts[0].town === '大井町',
     'TS11 ほかの会員には、その人の1件だけ（同じ大井町を出したほかの2人の行も、M9 の7件も入らない）', J(ro));
  const Z = await member();
  ok(J(await mine(Z, { airline: A1 })) === J({ ok: true, posts: [] }), 'TS11 まだ何も出していない会員 → posts は空');
  ok(J(await mine(M9, { airline: A2 })) === J({ ok: true, posts: [] }), 'TS11 同じ会員でも、ほかの会社のぶんは空');
  for (const [label, p] of [['会社なし', {}], ["会社 'other'", { airline: 'other' }], ['知らない会社', { airline: 'zz-none' }]]) {
    const r = await mine(M9, p);
    ok(said(r, '航空会社が正しくありません', '22023'), `TS11 ${label} → 22023「航空会社が正しくありません」`, J(r));
  }

  // 本人への返事は、出したものをそのまま返す（家賃・通勤・住んだ時期も、本人にだけ）
  const F = await member();
  const full = P('品川', { lived: 'past', lived_to_year: '2020', good: '静か', concern: '坂が多い',
                          rent: { layout: '1K', area: '25', amount: '120000', currency: CUR },
                          trip: { mode: 'train', airport: 'HND', terminal: 'T3', hour: '7', minutes: '40' } });
  const s = await post(F, full);
  const rf = await mine(F, { airline: A1 });
  const WANT = { base: BASE, concern: '坂が多い', good: '静か', lived: 'past', lived_to_year: 2020,
                 rent: { area: 25, amount: 120000, layout: '1K', currency: CUR, area_unit: 'm2' },
                 text_state: 'pending', town: '品川', town_state: 'public',
                 trip: { hour: 7, mode: 'train', airport: 'HND', minutes: 40, terminal: 'T3' } };
  const norm = (x) => JSON.parse(J(x), (k, v) => (v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((q) => [q, v[q]])) : v));
  ok(!s.__err && !rf.__err && rf.posts.length === 1 && J(norm(rf.posts[0])) === J(norm(WANT)) && J(norm(s.post)) === J(norm(WANT)),
     'TS11 本人の返事（保存の返事・自分の投稿）は、出したものをそのまま返す（住んだ時期・家賃・通勤も）', J({ s: s.post, rf }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TS12 資格を1つも付けない（呼ぶたびに、前と後で同じ）');
// ════════════════════════════════════════════════════════════
{
  const G = await member();
  await paid(G, A1);
  const snap = async () => {
    const g = await call(G, `select public.pv_contrib_give('{}'::jsonb) as v`);
    return {
      profile: (await one(`select md5(p::text) as m from public.profiles p where p.id = $1`, [G])).m,
      pay_reports: await countOf('pay_reports'),
      pv_admins: await countOf('pv_admins'),
      give: g.err ? 'ERR ' + g.err : J(g.v.v),
    };
  };
  const s0 = await snap();
  must(JSON.parse(s0.give || 'null')?.state === 'give', '給与を出した会員の pv_contrib_give が give でない', s0.give);
  const CALLS = [
    ['候補の街を選ぶ', () => post(G, P('品川'))],
    ['候補に無い名前', () => post(G, P('御殿山'))],
    ['文を書く', () => post(G, P('品川', { good: '静か', concern: '坂が多い' }))],
    ['家賃・通勤・住んだ時期も書く', () => post(G, P('品川', { lived: 'now', rent: { layout: '2LDK', amount: '180000', currency: CUR },
                                                         trip: { mode: 'bus', minutes: '30' } }))],
    ['街を直す', () => post(G, P('大崎', { was: '品川' }))],
    ['断られる（番地の形の街）', () => post(G, P('北品川1-2-3'))],
    ['自分の投稿を読む', () => mine(G, { airline: A1 })],
  ];
  const moved = [];
  let saved = 0;
  for (const [label, f] of CALLS) {
    const a = await snap();
    const r = await f();
    if (r && r.saved === true) saved++;
    const b = await snap();
    if (J(a) !== J(b)) moved.push({ label, a, b });
  }
  ok(saved === 5 && moved.length === 0,
     `TS12 入口を${CALLS.length}通りに呼んでも（保存5回）、プロフィールの行（md5）・給与の行の数・運営の名簿の数・pv_contrib_give の返事は1文字も変わらない`,
     J({ saved, moved }));
  ok(J(await snap()) === J(s0), 'TS12 最初と最後も同じ（give のまま・答えた数も同じ）', J({ s0, end: await snap() }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TS13 運営が見送った名前は、断る文で止まり、何も書かない');
// ════════════════════════════════════════════════════════════
{
  const R1 = await member(), R2 = await member();
  const r0 = await post(R1, P('没の街', { good: 'にぎやか' }));
  must(!r0.__err && r0.post.town_state === 'pending', '打ち込んだ名前を出せなかった', J(r0));
  await setTown('没の街', 'rejected');
  const state = async () => J({ posts: await countOf('pv_town_posts'), towns: await countOf('pv_towns'),
                                rate2: await rateOf(R2), rate1: await rateOf(R1),
                                mine1: (await rowsOf(R1)).map((x) => [x.tname, x.good, x.text_state]) });
  const before = await state();
  const MSG = 'この街の名前は、いま受け付けていません';
  const r = await post(R2, P('没の街駅'));
  ok(said(r, MSG, '22023'), `TS13 運営が見送った名前（「没の街駅」も同じ街）→ 22023「${MSG}」`, J(r));
  const r1 = await post(R1, P('没の街', { good: 'しずか' }));
  ok(said(r1, MSG, '22023'), 'TS13 その名前を打った本人が出し直しても、同じ文で断る', J(r1));
  ok((await state()) === before, 'TS13 断られた回は何も書かない（投稿・街の行・連投の数え・本人の前の行もそのまま）',
     J({ before, after: await state() }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TZ 返事に出てはいけないもの（ここまでの返事を全部見る）');
// ════════════════════════════════════════════════════════════
{
  const HEX = /[0-9a-f]{64}/i;
  const NEVER = new Set(['author_hash', 'user_id', 'created_at', 'updated_at']);
  const OWN = new Set(['submit_town_post', 'my_town_posts']);    // 本人への返事（預かりの返事は db/contrib.sql の段で足す）
  const PRIVATE = new Set(['lived', 'rent', 'trip', 'layout']);
  const walk = (v, f) => { if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { f(k); walk(x, f); } };
  const hex = [], never = [], priv = [];
  let ownPriv = 0;
  for (const s of seen) {
    if (HEX.test(s.json)) hex.push(s.fn);
    walk(JSON.parse(s.json), (k) => {
      if (NEVER.has(k)) never.push(`${s.fn}:${k}`);
      if (PRIVATE.has(k)) { if (OWN.has(s.fn)) ownPriv++; else priv.push(`${s.fn}:${k}`); }
    });
  }
  const fns = [...new Set(seen.map((s) => s.fn))];
  ok(seen.length >= 50 && fns.includes('submit_town_post') && fns.includes('my_town_posts'),
     `TZ 見た返事は ${seen.length} 件（${fns.join('・')}）`, J(fns));
  ok(hex.length === 0, 'TZ どの返事にも、64けたの16進（author_hash の形）が無い', J(hex));
  ok(never.length === 0, 'TZ どの返事にも、author_hash・user_id・created_at・updated_at の鍵が無い', J(never.slice(0, 5)));
  ok(priv.length === 0 && ownPriv > 0,
     'TZ 住んだ時期・家賃・通勤・間取り（lived・rent・trip・layout）は、本人への返事にだけ在る（ほかの返事に 0・本人の返事には在る ＝ 見落としではない）',
     J({ priv, ownPriv }));
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
