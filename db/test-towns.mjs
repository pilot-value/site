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
         直した先の街をもう持っていても、前の街の行は消える（先の街の1行が出した中身に。LEAD-RULINGS-35 P12.21）
     TS10 上限 ── 1つの会社に10か所・1日20回・候補に無い名前は1日3つ（detail 'names'）
     TS11 自分の投稿は自分の行だけ。1件の形は POST の10個の鍵
     TS12 資格を1つも付けない ── 呼ぶたびに、プロフィールの行・給与の行の数・運営の名簿・pv_contrib_give の返事が同じ
     TS13 運営が見送った名前は、断る文で止まり、何も書かない
     TG1 街の候補の種（db/towns.generated.sql）は、node gen-towns.mjs の出力そのもの
     TG2 種の行（台帳の街・別の書き方）が入っている・もう一度流しても1行も変わらない
     TG3 確認待ちの打ち込まれた名前と種が出会う ── 名前なら public、別の書き方なら束ねて投稿を街の下へ（両方に出した人は1行）
     TG4 本物の種で、1つの基地の中の鍵がぶつからない（検査だけの種で、赤く出ることも確かめる）
     TG7 種の別の書き方を打つと、その場でその街に入る（新しい名前としては数えない）
     TG8 1人が同じ街の別の書き方2つに出していた（街の行には無い）── 種は止まらず、その人は街の1行（LEAD-RULINGS-35 P12.23 b）
     TG9 運営が書き方を束ねてあった街を、種が別の書き方にする ── その書き方も種の街へ付け替える（1段のまま。LEAD-RULINGS-35 P12.23 c）
     TB1〜TB3 街の一覧（pv_town_board）は、開いていない人に状態の1語だけを返す（字そのもの。会社・基地・投稿の有無で変わらない）
         未ログイン → login ／ 会員・確認済みの印とステイ先の承認だけの人・鍵が切れた人・鍵だけの人 → locked ／ ほかの会社の給与だけ → give
     TB4 開いている人（自分の会社の給与・5つ答えた人・運営）への返事の鍵は決めたものだけ
     TB5 1人目の投稿から一覧に出る・同じ人は1人・並びは人数の多い順、同じ数は街の鍵のバイト順
     TB6 確認待ちの名前は一覧に出ない      TB7 文は承認済みだけ・5つまで・読む人の文が先頭
     TB8 開いた返事に、書いた人の印・時刻・家賃・通勤が無い
     TB9 候補（pv_town_options）は、サイトの名前だけ・誰が読んでも同じ字
     TB10 mine は読む人自身の街と文にだけ      TB11 db/contrib.sql が無ければ一覧は止まり、候補は答える
     TO1 運営の3つの口（pv_town_queue・pv_town_moderate・pv_town_admin_add）は運営だけ ── ほかの人には forbidden の字だけ・何も変えない
     TO2 確認待ちの形と絞り込み ── 投稿の無くなった名前・見送った名前の下の文は出さない・書いた人の印も日付も無い
     TO3 名前を通す・見送る ── 見送ったものは、この口から公開へ戻せない（final）
     TO4 文は、運営が見た字の印（rev）でだけ通る ── 本人が直したら前の印は changed
     TO5 束ねる（into）── 投稿は束ねた先へ・両方に出した人は1行（2つの書き方を束ねても1行。LEAD-RULINGS-35 P12.22 b）
     TO6 運営が足す ── 候補になる（人数は付かない）。台帳の街は動かさない。見送った街・束ねた街は候補から消える（P12.22 a）
     TO7 確認待ちの数は、運営のぶんだけ ── 会員が出したぶんだけ増え、ほかの人の一覧にも自分の投稿にも出ない
     TO8 別の書き方を束ねてある街を、さらに束ねる ── その書き方も束ねた先へ付け替える（LEAD-RULINGS-35 P12.23 a）
     TA1〜TA9 未ログインの預かり（db/contrib.sql の kind 'town'）と、ログインしてからの引き継ぎ
         TA1 預かりは held・鍵が返る      TA2 その鍵にだけ返る      TA3 一覧・候補・確認待ちに出ない・街の行を作らない
         TA4 引き継ぐと会員の行（打ち込んだ名前はそこで確認待ち）      TA5 会員のもっと新しい行が勝つ（kept）
         TA6 街の上限と、月の勤務・質問の引き継ぎは互いに止めない（想定外の失敗でも、先に済んだ引き継ぎは取り消さない）
         TA8 預かりの was は残さない      TA9 1本の鍵・1つの会社に10か所まで
     （TS12 はもう一度、一覧と候補を読んだあと・運営の口のあと・預けた街の引き継ぎのあとにも見る ＝ TA7）
     TZ  返事に、64けたの16進・author_hash・user_id・created_at・updated_at が無い。住んだ時期・家賃・通勤は本人への返事だけ

   ⚠️ set_config の第3引数は **false**（＝セッション全体）でなければならない。
      true にすると次の文では auth.uid() が null に戻り、
      「権限で弾かれた」という判定が全部空振りのまま緑になる。

   ⚠️ ここに出てくる会員は全部作り物（crew1@example.com など）。実在の人を1人も書かない。
      会社は語彙（pv_airlines）から機械的に取る。基地 'QZT' と 'QZU' は検査のための作り物。
      本物の街の候補の種（db/towns.generated.sql）は SQL_FILES と一緒に流れ、TG1〜TG4・TG7 が見る。
      TS の節は、種の中身（台帳の街の名前）に左右されないよう、作り物の基地に自分で台帳の街を入れる
      （持ち主として・origin 'ledger'）。TS・TB の準備では、運営が足した街（origin 'operator'）と、運営の承認・見送り
      （state の書き換え）も持ち主として書く。運営の口そのものは TO の節が、運営の名簿の会員（OPM）として確かめる。
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

// ── 器（serve-local.mjs の BOOT の写し。TB11 が2つ目の DB にも同じものを使う）────────
const BOOT_SQL = `
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
    gender text, birthdate date, country text, company text, "position" text,
    created_at timestamptz not null default now());

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
`;
await db.exec(BOOT_SQL);

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

// 作り物の基地の台帳の街を1つ（本物の種 db/towns.generated.sql は作り物の基地を持たないので、検査が持ち主として入れる）
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
const CLOSING = ['表は閉じている', '表は誰も直接読めない', '住所も位置も人の印も持たない',
                 '一覧は同じ決まりで返す', '候補は誰が読んでも同じ', '運営の口は名簿を見る', '入口は決めたものだけ', '資格に触らない'];
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
// 持ち主として、運営の確認を書く（TS・TB の準備。運営の口 pv_town_moderate そのものは TO の節で確かめる）
const approveText = async (who) => db.query(
  `update public.pv_town_posts set text_state = 'public', moderated_at = now() where author_hash = $1`, [await hashOf(who)]);
const setTown = async (name, state) => db.query(
  `update public.pv_towns set state = $4, moderated_at = now()
    where airline = $1 and base_iata = $2 and tkey = public.pv_town_key($3)`, [A1, BASE, name, state]);

// 候補の街を足す（持ち主として。作り物の基地の台帳の街と、TS・TB の準備の運営の街。pv_town_admin_add は TO6 で確かめる）
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

  // 直した先の街を、もう持っている回（LEAD-RULINGS-35 P12.21）。前の街の行は消え、先の街の1行が出した中身になる
  const H = await member(), O = await member();
  must(!(await post(H, P('品川', { good: '坂が多い' }))).__err && !(await post(H, P('大崎'))).__err
       && !(await post(O, P('品川'))).__err, '直す前の2か所（品川・大崎）を出せなかった');
  const oRow = J((await rowsOf(O)).map((x) => [x.id, x.tname, x.updated_at]));
  const at0 = await postsAt('品川');
  const r3 = await post(H, P('大崎', { was: '品川', lived: 'now' }));
  const m3 = await mine(H, { airline: A1 });
  const towns3 = (m3.posts || []).map((x) => x.town);
  ok(!r3.__err && r3.replaced === true && J(towns3) === J(['大崎']) && m3.posts[0].lived === 'now'
     && (await postsAt('品川')) === at0 - 1 && J((await rowsOf(O)).map((x) => [x.id, x.tname, x.updated_at])) === oRow,
     'TS9 直した先（大崎）をもう持っている → 品川の行は消え、大崎の1行が出した中身に（replaced:true）・品川の数から外れる・ほかの人の品川はそのまま',
     J({ r3, towns3, at0, now: await postsAt('品川') }));
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
let TS12 = null;
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
  TS12 = { G, snap, s0 };   // 一覧と候補の節（TB）のあとで、もう一度同じものを見る
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


// ── 街の候補の種（db/towns.generated.sql・TG1〜TG4・TG7）の道具 ─────────────
// 種の文の values の行を読む（節の見出し「-- 1.」「-- 2.」から、その節の「) as v(」まで）。
// ★行は種の文から取る（打ち込まない）。鍵は SQL の pv_town_key で作る（JS に写さない）。
const SEED_FILE = 'db/towns.generated.sql';
const SEED = read(SEED_FILE);
const tuples = (text, head) => {
  const i = text.indexOf('\n' + head);
  if (i < 0) return [];
  const j = text.indexOf('\n  ) as v(', i);
  return text.slice(i, j < 0 ? undefined : j).split('\n').filter((l) => /^ {4}\(/.test(l))
    .map((l) => [...l.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, () => "'")));
};
const mainsOf   = (text) => tuples(text, '-- 1.');    // [会社, 基地, 街]
const aliasesOf = (text) => tuples(text, '-- 2.');    // [会社, 基地, 街, 別の書き方]
const tkey = async (s) => (await one(`select public.pv_town_key($1) as k`, [s])).k;
const scopeRow = async (air, base, name) => (await one(
  `select id, name, origin, state, alias_of from public.pv_towns
    where airline = $1 and base_iata = $2 and tkey = public.pv_town_key($3)`, [air, base, name])) || null;
const tablesText = async () => J(await one(
  `select (select string_agg(t::text, E'\\n' order by t.id) from public.pv_towns t) as towns,
          (select string_agg(s::text, E'\\n' order by s.id) from public.pv_town_posts s) as posts`));
// 種の文に1行ずつ足す（TG3・TG4 の自前の種。台帳は直さない）
const withRow = (text, head, row) => {
  const at = head === '-- 1.' ? '\n  ) as v(airline, base, name)\n' : '\n  ) as v(airline, base, name, alias)\n';
  must(text.split(at).length === 2, `種の文に「${at.trim()}」が1つではない`);
  return text.replace(at, () => `,\n    (${row.map((x) => `'${x.replace(/'/g, () => "''")}'`).join(', ')})${at}`);
};
// 1つの基地の中で、鍵がぶつかる組（名前どうし・別の書き方 ⇄ ほかの街）
const clashes = async (text) => {
  const out = [], names = new Map();
  for (const [air, base, name] of mainsOf(text)) {
    const k = `${air}/${base}/${await tkey(name)}`;
    if (names.has(k)) out.push(`名前どうし：${names.get(k)} ⇄ ${name}（${k}）`);
    else names.set(k, name);
  }
  for (const [air, base, name, alias] of aliasesOf(text)) {
    const k = `${air}/${base}/${await tkey(alias)}`;
    if (names.has(k) && names.get(k) !== name) out.push(`別の書き方：${alias}（${name}）⇄ 街 ${names.get(k)}（${k}）`);
  }
  return out;
};


// ════════════════════════════════════════════════════════════
console.log('\n▼ TG1 街の候補の種のファイルは、生成スクリプトの出力そのもの');
// ════════════════════════════════════════════════════════════
{
  const { build: seedText } = await import('../gen-towns.mjs');
  ok(SEED === seedText(), `TG1 ${SEED_FILE} は node gen-towns.mjs の出力と1文字も違わない（手で直していない・流し忘れていない）`);
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TG2 種の行が入っている・もう一度流しても1行も変わらない');
// ════════════════════════════════════════════════════════════
{
  const M = mainsOf(SEED), AL = aliasesOf(SEED);
  must(M.length > 0, '種の文に台帳の街が1行も無い');
  const badM = [];
  for (const [air, base, name] of M) {
    const t = await scopeRow(air, base, name);
    if (!(t && t.name === name && t.origin === 'ledger' && t.state === 'public' && t.alias_of === null)) badM.push({ air, base, name, t });
  }
  ok(badM.length === 0, `TG2 台帳の街 ${M.length} 行が、どれも origin ledger・state public・束ねていない行として入っている`, J(badM));
  const badA = [];
  for (const [air, base, name, alias] of AL) {
    const t = await scopeRow(air, base, name), a = await scopeRow(air, base, alias);
    if (!(t && a && a.name === alias && a.origin === 'ledger' && a.state === 'public' && Number(a.alias_of) === Number(t.id))) {
      badA.push({ air, base, name, alias, t, a });
    }
  }
  ok(badA.length === 0, `TG2 別の書き方 ${AL.length} 行が、どれも origin ledger で、その街へ束ねてある（alias_of ＝ 街の id）`, J(badA));
  const before = await tablesText();
  await db.exec(SEED);
  ok((await tablesText()) === before, 'TG2 種をもう一度流しても、街の表・投稿の表の1行も変わらない（文字で比べる）');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TG3 確認待ちの打ち込まれた名前と、種が出会う');
// ════════════════════════════════════════════════════════════
{
  // 検査だけの種：本物の種に、作り物の基地（QZT）の行を1つずつ足す（台帳は直さない）
  const NAME = '港南', ALIAS = 'Konan';
  const Ma = await member(), Mb = await member(), Mc = await member();
  const a = await post(Ma, P(NAME));
  const b = await post(Mb, P(ALIAS));
  const c1 = await post(Mc, P(ALIAS, { lived: 'past' }));
  const c2 = await post(Mc, P(NAME, { lived: 'now' }));
  const t0 = await townRow(NAME), al0 = await townRow(ALIAS);
  must(!a.__err && !b.__err && !c1.__err && !c2.__err && t0?.state === 'pending' && t0?.origin === 'member'
       && al0?.state === 'pending' && al0?.origin === 'member' && (await postsAt(ALIAS)) === 2,
       '打ち込んだ名前（港南・Konan）を出せなかった', J({ a, b, c1, c2, t0, al0 }));
  const text = withRow(withRow(SEED, '-- 1.', [A1, BASE, NAME]), '-- 2.', [A1, BASE, NAME, ALIAS]);
  await db.exec(text);
  const t1 = await townRow(NAME), al1 = await townRow(ALIAS);
  ok(t1 && t1.id === t0.id && t1.origin === 'ledger' && t1.state === 'public' && t1.alias_of === null && (await postsAt(NAME)) >= 2,
     'TG3 確認待ちの「港南」と鍵が同じ台帳の街 → 同じ行のまま public（origin ledger）・その行の投稿もそのまま', J({ t0, t1 }));
  ok(al1 && al1.id === al0.id && al1.origin === 'ledger' && Number(al1.alias_of) === Number(t0.id) && (await postsAt(ALIAS)) === 0,
     'TG3 投稿の付いた確認待ちの「Konan」と鍵が同じ別の書き方 → 「港南」へ束ねた行になり、その行の投稿は0', J({ al0, al1, left: await postsAt(ALIAS) }));
  const rb = await rowsOf(Mb), rc = await rowsOf(Mc);
  ok(rb.length === 1 && rb[0].tname === NAME && rc.length === 1 && rc[0].tname === NAME && rc[0].lived === 'now'
     && (await postsAt(NAME)) === 3,
     'TG3 「Konan」に出していた人の投稿は「港南」の下に立つ ── 両方に出していた人は1行（街の行のほうが残る）・港南は3人', J({ rb, rc }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TG4 本物の種で、鍵がぶつからない');
// ════════════════════════════════════════════════════════════
{
  const real = await clashes(SEED);
  ok(real.length === 0 && mainsOf(SEED).length > 0,
     `TG4 本物の種：1つの基地の中で、街の名前どうしの鍵も、別の書き方とほかの街の鍵もぶつからない（街 ${mainsOf(SEED).length}・別の書き方 ${aliasesOf(SEED).length}）`, J(real));
  // 検査そのものが見えていることを、検査だけの種で確かめる（同じ名前の2つの書き方・ほかの街の名前に畳まれる別の書き方）
  const [air, base, name] = mainsOf(SEED)[0];
  const other = mainsOf(SEED).find((r) => r[0] === air && r[1] === base && r[2] !== name);
  must(!!other, '同じ基地に街が2つ無い（検査だけの種を作れない）');
  const two = await clashes(withRow(SEED, '-- 1.', [air, base, name + '駅']));
  const into = await clashes(withRow(SEED, '-- 2.', [air, base, name, other[2] + '駅']));
  ok(two.length === real.length + 1 && into.length === real.length + 1,
     `TG4 （検査の確かめ）「${name}」と「${name}駅」・「${other[2]}駅」と書いた別の書き方 → どちらも1組だけ赤く出る`, J({ two, into }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TG7 種の別の書き方を打つと、その場でその街に入る');
// ════════════════════════════════════════════════════════════
{
  const AL = aliasesOf(SEED);
  must(AL.length > 0, '種の文に別の書き方が1行も無い');
  const [air, base, name, alias] = AL[0];
  const W = await member();
  const t = await scopeRow(air, base, name);
  const at = async (id) => (await one(`select count(*)::int as n from public.pv_town_posts where town_id = $1`, [id])).n;
  const before = await at(t.id);
  const r = await post(W, { airline: air, base_iata: base, town: alias });
  const rt = await rateOf(W, air);
  const rows = await rowsOf(W, air);
  ok(!r.__err && r.replaced === false && r.post.town === name && r.post.town_state === 'public',
     `TG7 種の別の書き方「${alias}」（${air} / ${base}）を打つ → town_state public・replaced:false・街の名前は「${name}」`, J(r));
  ok((await at(t.id)) === before + 1 && rows.length === 1 && Number(rows[0].town_id) === Number(t.id) && rt && rt.n === 1 && rt.names === 0,
     `TG7 その場で「${name}」の数に入る（行は街のほう）・新しい街の名前としては数えない（names 0）`, J({ before, rows, rt }));
}


// ── 街の一覧（pv_town_board）と候補（pv_town_options）の道具・読む人 ─────────────
// 返事は Postgres が返す字そのもので比べる（::text）。見た返事は seen にも入れる（最後の TZ が見る）
const RAW = (s) => ({ raw: s });                     // 形の崩れた引数（そのままの JSON の字）
const readT = async (who, fn, p) => {
  const noArg = p === undefined;
  const r = await call(who, noArg ? `select public.${fn}()::text as v` : `select public.${fn}($1::jsonb)::text as v`,
    noArg ? [] : [p === null ? null : (p.raw !== undefined ? p.raw : J(p))]);
  if (r.err) return { __err: r.err, code: r.code };
  seen.push({ fn, json: r.v.v });
  return r.v.v;
};
const boardT = (who, p) => readT(who, 'pv_town_board', p);
const optsT  = (who, p) => readT(who, 'pv_town_options', p);
const SCOPE = { airline: A1, base: BASE };
const board = async (who, p = SCOPE) => { const t = await boardT(who, p); return typeof t === 'string' ? JSON.parse(t) : t; };
const townIn = (b, name) => ((b && b.towns) || []).find((t) => t.name === name) || null;
const STATE = (w) => `{"ok": true, "state": "${w}"}`;
// 決める所（pv_contrib_sees）を、その人として読む（準備の確かめだけ。外からは呼べない関数なので持ち主の役のまま）
const sees = async (who, air) => {
  await db.query(`select set_config('pv.uid', $1, false)`, [who]);
  try { return (await one(`select public.pv_contrib_sees($1) as s`, [air])).s; }
  finally { await asOwner(); }
};
// 読む人は作る（打ち込まない）。PILOT は、持ち主が確認済みの印（verify_level）を立て、ステイ先を見られる人として
// 承認した会員 ＝ 給与の鍵は無い（街の一覧は、ステイ先の承認でも確認済みの印でも開かない）
const OPM = await member();
must((await one(`select to_regclass('public.pv_admins') is not null as x`)).x, 'この器に運営の名簿 pv_admins が無い');
await db.query(`insert into public.pv_admins (user_id, note) values ($1, 'test') on conflict do nothing`, [OPM]);
const PLAIN = await member();
const PILOT = await member();
await db.query(`update public.profiles set verify_level = 1 where id = $1`, [PILOT]);
await db.query(
  `insert into public.pv_stay_viewers (user_id, state, decided_by, decided_at) values ($1, 'approved', $2, now())
   on conflict (user_id) do update set state = 'approved', decided_by = excluded.decided_by, decided_at = excluded.decided_at`, [PILOT, OPM]);
const OWN = await member();      await paid(OWN, A1);
const OTHER = await member();    await paid(OTHER, A2);
const FIVER = await member();    await paid(FIVER, A2);
{
  const Q = (await many(
    `select id, choice_codes from public.pv_condition_questions
      where active and parent is null and kind = 'choice' order by priority, id`))
    .slice(0, 5).map((q) => ({ question_id: q.id, code: q.choice_codes.find((c) => c !== 'unknown') }));
  const r = await call(FIVER, `select public.submit_airline_conditions($1::jsonb) as v`, [J({ airline: A2, answers: Q })]);
  must(!r.err && r.v.v.saved === 5, '5つ答えられなかった（FIVE）', J(r));
}
const EXPIRED = await member();  await paid(EXPIRED, A1);
await db.query(`update public.profiles set access_until = now() - interval '1 minute' where id = $1`, [EXPIRED]);
const NOREPORT = await member();
await db.query(`update public.profiles set access_until = now() + interval '30 days' where id = $1`, [NOREPORT]);
{
  const want = { PLAIN: 'locked', PILOT: 'locked', EXPIRED: 'locked', NOREPORT: 'locked', OTHER: 'give', OWN: 'open', FIVE: 'open', OP: 'open' };
  const got = {};
  for (const [k, who] of Object.entries({ PLAIN, PILOT, EXPIRED, NOREPORT, OTHER, OWN, FIVE: FIVER, OP: OPM })) got[k] = await sees(who, A1);
  must(J(got) === J(want), `読む人の立場が決めたとおりでない（${A1} について）`, J(got));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TB1〜TB3 開いていない人への返事は、状態の1語だけ（字そのもの）');
// ════════════════════════════════════════════════════════════
{
  must((await postsAt('品川')) > 0, `一覧に出る投稿が ${A1} / ${BASE} に無い`);
  must((await one(`select count(*)::int as n from public.pv_towns where airline = any($1) and base_iata = $2`, [[A2, A3], BASE])).n === 0,
       `投稿の無い基地として使う ${A2} / ${A3} の ${BASE} に、街が在る`);
  const CASES = [['会社と基地（投稿あり）', SCOPE], ['知らない会社', { airline: 'zz-none', base: BASE }], ["会社 'other'", { airline: 'other', base: BASE }],
    ['引数なし', undefined], ['null', null], ['配列', RAW('[1, 2]')], ['文字', RAW('"x"')], ['会社が数', { airline: 5 }],
    ['基地の形でない', { airline: A1, base: 'not a base' }]];
  for (const [who, label] of [[ANON, '未ログイン'], [DEAD, 'ログインが死んでいる会員']]) {
    const got = [];
    for (const [, p] of CASES) got.push(await boardT(who, p));
    ok(got.every((t) => t === STATE('login')),
       `TB1 ${label}：${CASES.length}通り（${CASES.map((c) => c[0]).join('・')}）が全部 ${STATE('login')} の字そのもの（エラーにもならない）`, J(got));
  }
  for (const [who, label] of [[PLAIN, 'PLAIN（会員）'], [PILOT, 'PILOT（確認済みの印・ステイ先の承認・鍵なし）'],
                              [EXPIRED, 'EXPIRED（鍵が切れた）'], [NOREPORT, 'NOREPORT（鍵だけ・給与の行なし）']]) {
    const a = await boardT(who, SCOPE), b = await boardT(who, { airline: A2, base: BASE });
    ok(a === STATE('locked') && b === STATE('locked'), `TB2 ${label}：投稿のある基地も無い基地も ${STATE('locked')} の字そのもの`, J({ a, b }));
  }
  const a = await boardT(OTHER, SCOPE), b = await boardT(OTHER, { airline: A3, base: BASE });
  ok(a === STATE('give') && b === STATE('give'), `TB3 OTHER（ほかの会社の給与・答えなし）：投稿のある基地も無い基地も ${STATE('give')} の字そのもの`, J({ a, b }));
}


// 一覧に出す投稿（TB4〜TB10）。街は持ち主が運営の街として足す（準備。運営の口は TO の節で確かめる）
await addTown('芝浦', 'operator');
await addTown('台場', 'operator');
const X = await member(), Y = await member();
const W = [];                                   // 台場に承認済みの良い点を書く6人（6人とも自分の会社 A1 の給与を出した ＝ 一覧を読める）
for (let i = 1; i <= 6; i++) {
  const w = await member();
  await paid(w, A1);
  must(!(await post(w, P('台場', { good: `台場の良い点その${i}` }))).__err, `台場に書けなかった（${i}人目）`);
  await approveText(w);
  W.push({ who: w, text: `台場の良い点その${i}` });
}
const WP = await member(), WR = await member();
must(!(await post(WP, P('台場', { good: '確認待ちの文' }))).__err && !(await post(WR, P('台場', { good: '見送りの文' }))).__err,
     '台場に確認待ち・見送りの文を書けなかった');
await db.query(`update public.pv_town_posts set text_state = 'rejected', moderated_at = now() where author_hash = $1`, [await hashOf(WR)]);
// 気になる点も同じ決まり（承認済みだけ）。確認待ち・見送り・承認済みの気になる点を、台場に1つずつ（別の3人）
const CP = await member(), CR = await member(), CA = await member();
must(!(await post(CP, P('台場', { concern: '確認待ちの気になる点' }))).__err && !(await post(CR, P('台場', { concern: '見送りの気になる点' }))).__err
     && !(await post(CA, P('台場', { concern: '台場の気になる点' }))).__err, '台場に気になる点を書けなかった');
await approveText(CA);
await db.query(`update public.pv_town_posts set text_state = 'rejected', moderated_at = now() where author_hash = $1`, [await hashOf(CR)]);


// ════════════════════════════════════════════════════════════
console.log('\n▼ TB4 開いている人への返事の鍵は、決めたものだけ');
// ════════════════════════════════════════════════════════════
for (const [who, label] of [[OWN, 'OWN（自分の会社の給与）'], [FIVER, 'FIVE（ほかの会社の給与＋5つ答えた）'], [OPM, 'OP（運営）']]) {
  const b = await board(who);
  const towns = (b && b.towns) || [];
  const texts = towns.flatMap((t) => [...(t.good || []), ...(t.concern || [])]);
  ok(keys(b) === 'ok,state,towns' && b.ok === true && b.state === 'open' && towns.length > 0 && texts.length > 0
     && towns.every((t) => keys(t) === 'concern,good,mine,n,name') && texts.every((x) => keys(x) === 'mine,text'),
     `TB4 ${label}：返事は ok・state・towns だけ／街は name・n・mine・good・concern だけ／文は text・mine だけ`, J(b));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TB5 1人目の投稿から一覧に出る・並びは人数の多い順');
// ════════════════════════════════════════════════════════════
{
  const z0 = townIn(await board(OWN), '芝浦');
  await post(X, P('芝浦'));
  const z1 = townIn(await board(OWN), '芝浦');
  ok(z0 === null && z1 && z1.n === 1, 'TB5 1人の投稿で一覧に出る（n 1 ── 何人からという下限を置かない）', J({ z0, z1 }));
  await post(Y, P('芝浦'));
  const z2 = townIn(await board(OWN), '芝浦');
  await post(X, P('芝浦', { lived: 'now' }));
  const z3 = townIn(await board(OWN), '芝浦');
  ok(z2 && z2.n === 2 && z3 && z3.n === 2, 'TB5 2人目で n 2・同じ人がもう一度出しても数は変わらない（n 2 のまま）', J({ z2, z3 }));
  // 並びは検査が自分で数えて並べる（数は表から・鍵のバイト順は Buffer で）
  const rows = await many(
    `select t.name, t.tkey, count(*)::int as n from public.pv_towns t join public.pv_town_posts s on s.town_id = t.id
      where t.airline = $1 and t.base_iata = $2 and t.state = 'public' and t.alias_of is null group by t.id`, [A1, BASE]);
  const want = rows.sort((a, b) => b.n - a.n || Buffer.compare(Buffer.from(a.tkey), Buffer.from(b.tkey))).slice(0, 30)
    .map((r) => [r.name, r.n]);
  const got = ((await board(OWN)).towns || []).map((t) => [t.name, t.n]);
  const ties = want.some((r, i) => i > 0 && want[i - 1][1] === r[1]);
  ok(want.length > 2 && ties && J(got) === J(want),
     `TB5 並びは n の多い順・同じ数は街の鍵のバイト順（検査が表から数えて並べた ${want.length} 街と同じ・同じ数の組を含む）`, J({ got, want }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TB6 確認待ちの名前は、一覧に出ない');
// ════════════════════════════════════════════════════════════
{
  const T1 = await member(), T2 = await member();
  must(!(await post(T1, P('高浜'))).__err && !(await post(T2, P('高浜駅'))).__err && (await townRow('高浜'))?.state === 'pending'
       && (await postsAt('高浜')) === 2, '確認待ちの「高浜」に2人が出せなかった');
  const a = townIn(await board(OWN), '高浜');
  await setTown('高浜', 'public');
  const b = townIn(await board(OWN), '高浜');
  ok(a === null && b && b.n === 2, 'TB6 確認待ちの「高浜」（2人）は一覧に無い → 運営（持ち主）が public にすると n 2 で出る', J({ a, b }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TB7 文は承認済みだけ・1つの街に5つまで・読む人の文が先頭');
// ════════════════════════════════════════════════════════════
{
  const d = townIn(await board(OWN), '台場');
  const texts = ((d && d.good) || []).map((x) => x.text);
  const OKS = new Set(W.map((w) => w.text));
  ok(d && texts.length === 5 && texts.every((t) => OKS.has(t)) && !texts.includes('確認待ちの文') && !texts.includes('見送りの文'),
     'TB7 承認済みの良い点だけが出る（確認待ち・見送りの文は無い）・6つ承認済みでも5つまで', J(d));
  ok(d && J((d.concern || []).map((x) => x.text)) === J(['台場の気になる点']),
     'TB7 気になる点も承認済みだけが出る（確認待ち・見送りの気になる点は無い）', J(d && d.concern));
  const bad = [];
  for (const w of W) {
    const g = (townIn(await board(w.who), '台場') || {}).good || [];
    if (!(g.length === 5 && g[0].text === w.text && g[0].mine === true && g.slice(1).every((x) => x.mine === false && x.text !== w.text))) {
      bad.push({ who: w.text, g });
    }
  }
  ok(bad.length === 0, 'TB7 6人のどの人が読んでも、自分の文は5つの中に入り、先頭に立つ（mine:true はその1つだけ）', J(bad));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TB8 開いた返事に、書いた人の印・時刻・家賃・通勤が無い');
// ════════════════════════════════════════════════════════════
{
  const marks = (await many(`select distinct author_hash as h from public.pv_town_posts`)).map((r) => r.h);
  const WORDS = /lived|rent|trip|amount|minutes|layout|created|updated|rev/i;
  const DATE = /\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}/;
  const bad = [];
  for (const [who, label] of [[OWN, 'OWN'], [FIVER, 'FIVE'], [OPM, 'OP'], [W[0].who, '台場に書いた人']]) {
    const t = await boardT(who, SCOPE);
    if (typeof t !== 'string' || !t.includes('"open"') || marks.some((h) => t.includes(h)) || WORDS.test(t) || DATE.test(t)) {
      bad.push({ label, t: typeof t === 'string' ? t.slice(0, 300) : t });
    }
  }
  ok(marks.length > 10 && bad.length === 0,
     `TB8 4人の読む人の返事（字そのもの）に、表の書いた人の印 ${marks.length} 個のどれも・lived／rent／trip／amount／minutes／layout／created／updated／rev の字も・日付も時刻も無い`, J(bad));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TB9 候補の一覧は、サイトの名前だけ・誰が読んでも同じ字');
// ════════════════════════════════════════════════════════════
{
  const READERS = [[ANON, '未ログイン'], [PLAIN, 'PLAIN'], [OTHER, 'OTHER'], [OWN, 'OWN'], [FIVER, 'FIVE'], [OPM, 'OP']];
  const texts = [];
  for (const [who] of READERS) texts.push(await optsT(who, SCOPE));
  const want = (await many(
    `select name from public.pv_towns
      where airline = $1 and base_iata = $2 and state = 'public' and alias_of is null and origin in ('ledger', 'operator')
      order by case origin when 'ledger' then 0 else 1 end, id`, [A1, BASE])).map((r) => r.name);
  const got = typeof texts[0] === 'string' ? JSON.parse(texts[0]) : texts[0];
  ok(texts.every((t) => typeof t === 'string' && t === texts[0]) && keys(got) === 'ok,towns' && J(got.towns) === J(want),
     `TB9 ${READERS.map((r) => r[1]).join('・')} の6人に、1文字も違わない同じ字（台帳の街 → 運営が足した街の ${want.length} 個）`, J({ texts, want }));
  const notSite = (await many(
    `select name, origin, state, alias_of from public.pv_towns
      where airline = $1 and base_iata = $2 and (origin = 'member' or state <> 'public' or alias_of is not null)`, [A1, BASE]));
  const typedPublic = notSite.filter((r) => r.origin === 'member' && r.state === 'public' && r.alias_of === null).map((r) => r.name);
  const leak = notSite.filter((r) => got.towns.includes(r.name)).map((r) => r.name);
  ok(typedPublic.length >= 2 && notSite.some((r) => r.state === 'pending') && notSite.some((r) => r.state === 'rejected')
     && notSite.some((r) => r.alias_of !== null) && leak.length === 0,
     `TB9 会員が打ち込んで運営（持ち主）が public にした名前（${typedPublic.join('・')}）も、確認待ち・見送り・束ねた別の書き方も、誰の候補にも無い`, J({ leak, notSite }));
  const EMPTY = '{"ok": true, "towns": []}';
  const e = [await optsT(ANON, { airline: 'zz-none', base: BASE }), await optsT(ANON, { airline: A1, base: NO_SCOPE }),
             await optsT(ANON, { airline: 'other', base: BASE }), await optsT(ANON)];
  ok(e.every((t) => t === EMPTY), `TB9 知らない会社・街の無い基地・'other'・引数なし → ${EMPTY} の字そのもの`, J(e));
  const scopes = [...new Set(mainsOf(SEED).map((r) => `${r[0]}/${r[1]}`))];
  const off = [];
  for (const s of scopes) {
    const [air, base] = s.split('/');
    const o = JSON.parse(await optsT(ANON, { airline: air, base }));
    const w = mainsOf(SEED).filter((r) => r[0] === air && r[1] === base).map((r) => r[2]);
    if (J(o.towns) !== J(w)) off.push({ s, got: o.towns, want: w });
  }
  ok(scopes.length > 0 && off.length === 0,
     `TB9 種の ${scopes.length} の会社・基地では、候補は種の台帳の街そのもの（同じ並び・別の書き方は入らない）`, J(off));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TB10 mine は、読む人自身の街と文にだけ true');
// ════════════════════════════════════════════════════════════
{
  const mineOf = (b) => ({
    towns: ((b && b.towns) || []).filter((t) => t.mine === true).map((t) => t.name),
    texts: ((b && b.towns) || []).flatMap((t) => [...t.good, ...t.concern]).filter((x) => x.mine === true).map((x) => x.text),
  });
  const w = mineOf(await board(W[0].who)), o = mineOf(await board(OWN));
  ok(J(w) === J({ towns: ['台場'], texts: [W[0].text] }) && J(o) === J({ towns: [], texts: [] }),
     'TB10 台場に書いた人：mine は台場とその人の文だけ／何も出していない人（OWN）：mine はどこにも無い', J({ w, o }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TB11 db/contrib.sql の無い DB では、一覧は止まり、候補は答える');
// ════════════════════════════════════════════════════════════
{
  const db2 = new PGlite({ extensions: { pgcrypto } });
  await db2.waitReady;
  await db2.exec(`set timezone = 'UTC'`);
  await db2.exec(BOOT_SQL);
  for (const f of FILES.filter((x) => x !== 'db/contrib.sql')) await db2.exec(read(f));
  const [air, base] = mainsOf(SEED)[0];
  const q = async (d, fn) => {
    await d.exec(`set role anon`);
    await d.query(`select set_config('pv.uid', '', false)`);
    try { return { v: (await d.query(`select public.${fn}($1::jsonb)::text as v`, [J({ airline: air, base })])).rows[0].v }; }
    catch (e) { return { err: String(e.message || e) }; }
    finally { await d.exec(`reset role`); }
  };
  const b2 = await q(db2, 'pv_town_board'), o2 = await q(db2, 'pv_town_options'), o1 = await q(db, 'pv_town_options');
  await db2.close();
  ok(!!b2.err && /pv_contrib_sees/.test(b2.err) && !o2.err && o2.v === o1.v,
     `TB11 db/contrib.sql の無い DB：pv_town_board は止まる（pv_contrib_sees が無い、と言う）・pv_town_options はいつもと同じ字を返す（${air} / ${base}）`,
     J({ b2, o2, o1 }));
}


// ── 運営の口（TO1〜TO7）の道具 ─────────────────────────────
// 運営 ＝ 運営の名簿（pv_admins）に居る会員 OPM（db/pay-rows.sql の pv_is_operator の1か所が見る）。
// ★ステイ先を見られる人の承認（db/stays.sql）とは別のもの。ここではそれに1つも触らない（PILOT は「運営ではない」側にだけ居る）。
const queue    = (who) => rpc(who, 'pv_town_queue', {});
const moderate = (who, p) => rpc(who, 'pv_town_moderate', p);
const adminAdd = (who, p) => rpc(who, 'pv_town_admin_add', p);
const FORBIDDEN = '{"ok": false, "status": "forbidden"}';
// 鍵の並びに左右されずに比べる（jsonb は鍵を自分の順に並べ直す）
const canon = (x) => J(JSON.parse(J(x) ?? 'null', (k, v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map((q) => [q, v[q]])) : v)));
const idOf    = async (name) => Number((await townRow(name)).id);
const textOf  = async (id) => (await one(`select text_state, good, concern from public.pv_town_posts where id = $1`, [id])) || null;
const revOf   = async (id) => (await one(`select public.pv_town_rev(s) as r from public.pv_town_posts s where s.id = $1`, [id])).r;
const rowAt   = async (who, name) => (await one(
  `select s.id from public.pv_town_posts s
    where s.author_hash = $1
      and s.town_id = (select id from public.pv_towns where airline = $2 and base_iata = $3 and tkey = public.pv_town_key($4))`,
  [await hashOf(who), A1, BASE, name])) || null;
const optsHas = async (name) => JSON.parse(await optsT(ANON, SCOPE)).towns.includes(name);


// ════════════════════════════════════════════════════════════
console.log('\n▼ TO1 運営の3つの口は、運営だけが使える');
// ════════════════════════════════════════════════════════════
{
  const pend = await townRow('大井町');
  must(pend && pend.state === 'pending' && (await postsAt('大井町')) > 0, '確認待ちの「大井町」（投稿あり）が無い');
  const ARGS = [['pv_town_queue', {}], ['pv_town_moderate', { target: 'town', id: Number(pend.id), state: 'public' }],
                ['pv_town_admin_add', { airline: A1, base: BASE, name: '平和島' }]];
  const before = await tablesText();
  const anon = [];
  for (const [fn, p] of ARGS) anon.push(refused(await rpc(ANON, fn, p), fn));
  ok(anon.length === 3 && anon.every(Boolean), 'TO1 未ログイン：pv_town_queue・pv_town_moderate・pv_town_admin_add のどれも呼べない（実行権が無い）', J(anon));
  const bad = [];
  for (const [who, label] of [[PLAIN, 'PLAIN'], [OWN, 'OWN'], [PILOT, 'PILOT'], [DEAD, 'ログインが死んでいる会員']]) {
    for (const [fn, p] of ARGS) { const t = await readT(who, fn, p); if (t !== FORBIDDEN) bad.push({ label, fn, t }); }
  }
  ok(bad.length === 0 && (await tablesText()) === before && (await townRow('大井町')).state === 'pending' && (await townRow('平和島')) === null,
     `TO1 PLAIN・OWN・PILOT（確認済みの印・ステイ先の承認）・ログインが死んでいる会員：3つの口のどれも ${FORBIDDEN} の字そのもの・街の表も投稿の表も1行も変わらない`,
     J(bad));
  const op = await queue(OPM);
  must(op && op.ok === true, '運営（OPM）が確認待ちを読めない', J(op));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TO2 確認待ちの形と絞り込み');
// ════════════════════════════════════════════════════════════
let KAT = null;          // 「勝島」の文の id（TO4 が使う）
const Q1 = await member();   // 「勝島」に書いた会員（TO4・TO7 も使う）
{
  const Q2 = await member(), Q3 = await member();
  must(!(await post(Q1, P('勝島', { good: '運河沿いが静か' }))).__err, '「勝島」に書けなかった');
  must(!(await post(Q2, P('八潮'))).__err && !(await post(Q2, P('品川', { was: '八潮' }))).__err
       && (await townRow('八潮'))?.state === 'pending' && (await postsAt('八潮')) === 0,
       '「八潮」を出してから品川へ直せなかった（投稿が0になった確認待ちの名前）');
  must(!(await post(Q3, P('東品川', { good: '公園が多い' }))).__err, '「東品川」に書けなかった');
  const rj = await moderate(OPM, { target: 'town', id: await idOf('東品川'), state: 'rejected' });
  must(rj && rj.ok === true && rj.state === 'rejected', '運営が「東品川」を見送れなかった', J(rj));

  const q = await queue(OPM);
  const qt = await readT(OPM, 'pv_town_queue', {});
  const kat = ((q && q.towns) || []).find((t) => t.name === '勝島') || null;
  const kt = ((q && q.texts) || []).find((x) => x.town === '勝島') || null;
  ok(keys(q) === 'ok,scopes,texts,towns' && q.ok === true && kat && keys(kat) === 'airline,base,id,name,posts'
     && kat.airline === A1 && kat.base === BASE && kat.posts === 1 && Number(kat.id) === await idOf('勝島'),
     'TO2 返事は ok・scopes・towns・texts だけ／会員が打ち込んだ「勝島」が towns に在る（鍵は airline・base・id・name・posts だけ・posts 1）',
     J({ keys: keys(q), kat }));
  ok(kt && keys(kt) === 'airline,base,concern,good,id,rev,town,town_state' && kt.airline === A1 && kt.base === BASE
     && kt.good === '運河沿いが静か' && kt.concern === null && kt.town_state === 'pending' && kt.rev === await revOf(kt.id),
     'TO2 その良い点・気になる点の組が texts に在る（鍵は airline・base・concern・good・id・rev・town・town_state だけ・rev は今の字の印）', J(kt));
  KAT = kt && kt.id;

  // towns：検査が表から作った「投稿の付いた・確認待ちの・束ねていない名前」（古い順。投稿の数も表から）と同じ
  const wantT = (await many(
    `select t.id, t.airline, t.base_iata as base, t.name,
            (select count(*)::int from public.pv_town_posts s where s.town_id = t.id) as posts
       from public.pv_towns t
      where t.state = 'pending' and t.alias_of is null
      order by t.created_at, t.id`)).filter((r) => r.posts > 0).map((r) => ({ ...r, id: Number(r.id) }));
  ok(wantT.length >= 3 && canon(q.towns) === canon(wantT) && !(q.towns || []).some((t) => t.name === '八潮'),
     `TO2 towns は、投稿の付いた確認待ちの名前 ${wantT.length} 個だけ（古い順・投稿の数は表と同じ）── 出した人が街を直して投稿が0になった「八潮」は無い`,
     J({ got: q.towns, want: wantT }));
  // texts：検査が表から作った「確認待ちの文（見送った名前の下を除く）」（古い順。rev も表の字から）と同じ
  const wantX = (await many(
    `select s.id::text as id, s.airline, s.base_iata as base, t.name as town, t.state as town_state,
            s.good, s.concern, public.pv_town_rev(s) as rev
       from public.pv_town_posts s join public.pv_towns t on t.id = s.town_id
      where s.text_state = 'pending'
      order by s.updated_at, s.id`)).filter((r) => r.town_state !== 'rejected');
  ok(wantX.length >= 3 && canon(q.texts) === canon(wantX) && !(q.texts || []).some((x) => x.town === '東品川'),
     `TO2 texts は、確認待ちの文 ${wantX.length} 組だけ（古い順）── 運営が見送った名前（東品川）の下の文は無い`, J({ got: q.texts, want: wantX }));
  // scopes：街の在る会社・基地の全部と、その基地の公開の候補（鍵のバイト順）
  const sc = new Map();
  for (const r of await many(
    `select t.airline, a.name_ja, t.base_iata, t.id, t.name, t.tkey, t.state, t.alias_of
       from public.pv_towns t join public.pv_airlines a on a.code = t.airline`)) {
    const k = `${r.airline}/${r.base_iata}`;
    if (!sc.has(k)) sc.set(k, { airline: r.airline, name: r.name_ja, base: r.base_iata, towns: [] });
    if (r.state === 'public' && r.alias_of === null) sc.get(k).towns.push(r);
  }
  const wantS = [...sc.values()].map((s) => ({ ...s, towns: s.towns
    .sort((a, b) => Buffer.compare(Buffer.from(a.tkey), Buffer.from(b.tkey))).map((t) => ({ id: Number(t.id), name: t.name })) }));
  const byScope = (a) => [...(a || [])].sort((x, y) => (`${x.airline}/${x.base}` < `${y.airline}/${y.base}` ? -1 : 1));
  ok(wantS.length >= 6 && canon(byScope(q.scopes)) === canon(byScope(wantS)),
     `TO2 scopes は、街の在る会社・基地 ${wantS.length} 組の全部（会社の名前・その基地の公開の候補 id と名前）`, J({ got: q.scopes, want: wantS }));
  const marks = (await many(`select distinct author_hash as h from public.pv_town_posts`)).map((r) => r.h);
  ok(typeof qt === 'string' && marks.length > 10 && !marks.some((h) => qt.includes(h))
     && !/\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}/.test(qt) && !/author|user_id|email|created|updated|moderated/.test(qt),
     `TO2 返事（字そのもの）に、書いた人の印 ${marks.length} 個のどれも・日付も時刻も・author／user_id／email／created／updated／moderated の字も無い`,
     typeof qt === 'string' ? qt.slice(0, 300) : J(qt));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TO3 名前を通す・見送る（見送ったものは、この口から戻せない）');
// ════════════════════════════════════════════════════════════
{
  const id = await idOf('勝島');
  const r = await moderate(OPM, { target: 'town', id, state: 'public' });
  const b = townIn(await board(OWN), '勝島');
  ok(canon(r) === canon({ ok: true, target: 'town', id, state: 'public' }) && (await townRow('勝島')).state === 'public'
     && b && b.n === 1 && b.n === (await postsAt('勝島')),
     'TO3 打ち込まれた名前を通す → {ok, target town, id, state public}・一覧（OWN）に n ＝ その名前の投稿の数（1）で出る', J({ r, b }));

  const R = await member();
  must(!(await post(R, P('南大井', { good: '商店街が近い' }))).__err, '「南大井」に書けなかった');
  const sid = await idOf('南大井');
  const r1 = await moderate(OPM, { target: 'town', id: sid, state: 'rejected' });
  const own = ((await mine(R, { airline: A1 })).posts || []).find((x) => x.town === '南大井') || null;
  const r2 = await moderate(OPM, { target: 'town', id: sid, state: 'public' });
  ok(canon(r1) === canon({ ok: true, target: 'town', id: sid, state: 'rejected' }) && own && own.town_state === 'rejected'
     && canon(r2) === canon({ ok: false, status: 'final' }) && (await townRow('南大井')).state === 'rejected'
     && townIn(await board(OWN), '南大井') === null,
     'TO3 見送る → 書いた本人の自分の投稿は town_state rejected／もう一度通そうとすると final・見送りのまま・一覧に無い', J({ r1, own, r2 }));

  const T = await member();
  must(!(await post(T, P('品川', { concern: '人が多い' }))).__err, '品川に気になる点を書けなかった');
  const tid = (await rowAt(T, '品川')).id;
  const rev = await revOf(tid);
  const t1 = await moderate(OPM, { target: 'text', id: tid, state: 'rejected' });
  const t2 = await moderate(OPM, { target: 'text', id: tid, state: 'public', rev });
  const tm = ((await mine(T, { airline: A1 })).posts || []).find((x) => x.town === '品川') || null;
  ok(canon(t1) === canon({ ok: true, target: 'text', id: tid, state: 'rejected' }) && canon(t2) === canon({ ok: false, status: 'final' })
     && (await textOf(tid)).text_state === 'rejected' && tm && tm.text_state === 'rejected',
     'TO3 文を見送る（rev は要らない）→ 本人の投稿は text_state rejected／見た字の印を添えても、通そうとすると final', J({ t1, t2, tm }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TO4 文は、運営が見た字の印（rev）でだけ通る');
// ════════════════════════════════════════════════════════════
{
  must(!!KAT, 'TO2 で「勝島」の文が確認待ちに出ていない');
  const st = async () => (await textOf(KAT)).text_state;
  const revIn = async () => (((await queue(OPM)).texts || []).find((x) => x.id === KAT) || {}).rev;
  const rev0 = await revIn();
  const a = await moderate(OPM, { target: 'text', id: KAT, state: 'public' });
  const b = await moderate(OPM, { target: 'text', id: KAT, state: 'public', rev: '0123456789abcdef' });
  ok(canon(a) === canon({ ok: false, status: 'changed' }) && canon(b) === canon({ ok: false, status: 'changed' }) && (await st()) === 'pending',
     'TO4 rev なし・違う rev で通そうとする → changed・文は確認待ちのまま', J({ a, b }));
  const c = await moderate(OPM, { target: 'text', id: KAT, state: 'public', rev: rev0 });
  const g = (townIn(await board(OWN), '勝島') || {}).good || [];
  ok(!!rev0 && canon(c) === canon({ ok: true, target: 'text', id: KAT, state: 'public' }) && (await st()) === 'public'
     && J(g.map((x) => x.text)) === J(['運河沿いが静か']),
     'TO4 確認待ちの一覧が返した rev を添えて通す → public・一覧の「勝島」に、その字のまま出る', J({ c, g }));
  must(!(await post(Q1, P('勝島', { good: '運河沿いが静か。' }))).__err && (await st()) === 'pending', '本人が文を直せなかった');
  const d = await moderate(OPM, { target: 'text', id: KAT, state: 'public', rev: rev0 });
  const g2 = (townIn(await board(OWN), '勝島') || {}).good || [];
  const rev1 = await revIn();
  ok(canon(d) === canon({ ok: false, status: 'changed' }) && (await st()) === 'pending' && g2.length === 0 && !!rev1 && rev1 !== rev0,
     'TO4 本人が1文字直したあと、前の rev で通そうとする → changed・確認待ちのまま・一覧には古い字も新しい字も無い（一覧の rev は新しい字の印）',
     J({ d, g2, rev0, rev1 }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TO5 束ねる（into）── 投稿は束ねた先へ・1人は1行');
// ════════════════════════════════════════════════════════════
{
  const X = '勝島', Y = 'Katsushima', Y2 = 'かつしま';
  const U1 = await member(), U2 = await member(), U3 = await member();
  must(!(await post(U1, P(Y, { lived: 'past' }))).__err
       && !(await post(U2, P(X, { lived: 'now' }))).__err && !(await post(U2, P(Y, { lived: 'past' }))).__err
       && !(await post(U3, P(Y, { lived: 'past' }))).__err && !(await post(U3, P(Y2, { lived: 'now' }))).__err
       && (await townRow(Y))?.state === 'pending' && (await townRow(Y2))?.state === 'pending',
       '束ねる前の投稿（Katsushima・かつしま・勝島）を出せなかった');
  const xid = await idOf(X), yid = await idOf(Y), y2id = await idOf(Y2);
  const other = await one(`select id from public.pv_towns where airline <> $1 and state = 'public' and alias_of is null order by id limit 1`, [A1]);
  must(!!other, 'ほかの会社の公開の街が無い');
  const before = await tablesText();
  const bad = [];
  for (const [label, into] of [['ほかの会社・基地の街', Number(other.id)], ['確認待ちの名前', y2id], ['自分自身', yid], ['数でない', 'x']]) {
    const r = await moderate(OPM, { target: 'town', id: yid, state: 'public', into });
    if (canon(r) !== canon({ ok: false, status: 'bad_into' })) bad.push({ label, r });
  }
  ok(bad.length === 0 && (await tablesText()) === before,
     'TO5 束ねる先が、ほかの会社・基地の街／確認待ちの名前／自分自身／数でない → bad_into・何も変わらない', J(bad));

  const n0 = await postsAt(X);
  const r = await moderate(OPM, { target: 'town', id: yid, state: 'public', into: xid });
  const ty = await townRow(Y);
  ok(canon(r) === canon({ ok: true, target: 'town', id: yid, state: 'public', into: xid })
     && ty && Number(ty.alias_of) === xid && ty.state === 'public' && (await postsAt(Y)) === 0 && (await postsAt(X)) === n0 + 2,
     'TO5 「Katsushima」を「勝島」として束ねる → {…, into 勝島}・Katsushima は勝島の別の書き方に・投稿は勝島へ（Katsushima に0・勝島は2人増える）',
     J({ r, ty, n0, now: await postsAt(X) }));
  const u1 = await rowsOf(U1), u2 = await rowsOf(U2);
  ok(u1.length === 1 && u1[0].tname === X && u1[0].lived === 'past' && u2.length === 1 && u2[0].tname === X && u2[0].lived === 'now',
     'TO5 Katsushima だけに出した人は勝島の1行に／勝島と Katsushima の両方に出していた人は1行（勝島の行が残る ── P12.22 b）',
     J({ u1: u1.map((x) => [x.tname, x.lived]), u2: u2.map((x) => [x.tname, x.lived]) }));
  const r2 = await moderate(OPM, { target: 'town', id: y2id, state: 'public', into: xid });
  const u3 = await rowsOf(U3);
  ok(r2 && r2.ok === true && Number((await townRow(Y2)).alias_of) === xid && (await postsAt(Y2)) === 0
     && u3.length === 1 && u3[0].tname === X && u3[0].lived === 'past',
     'TO5 1人が2つの書き方（Katsushima・かつしま）に出していた → 2つとも勝島へ束ねても、その人は勝島の1行（先に移った行が残る ── P12.22 b）',
     J({ r2, u3: u3.map((x) => [x.tname, x.lived]) }));

  const U4 = await member();
  const n1 = await postsAt(X);
  const p = await post(U4, P(Y));
  const b = townIn(await board(OWN), X);
  ok(!p.__err && p.replaced === false && p.post.town === X && p.post.town_state === 'public'
     && (await postsAt(X)) === n1 + 1 && (await postsAt(Y)) === 0 && b && b.n === n1 + 1,
     'TO5 次に「Katsushima」と打つ → 勝島の行に入る（replaced:false・town_state public・その場で勝島の数に入り、一覧も n ＋1）', J({ p, n1, b }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TO6 運営が足す街は、候補になる（人数は付かない）');
// ════════════════════════════════════════════════════════════
{
  const a = await adminAdd(OPM, { airline: A1, base: BASE, name: '鈴ヶ森' });
  const ta = await townRow('鈴ヶ森');
  ok(a && keys(a) === 'existed,id,name,ok,state' && a.ok === true && a.existed === false && a.name === '鈴ヶ森' && a.state === 'public'
     && ta && Number(ta.id) === Number(a.id) && ta.origin === 'operator' && ta.state === 'public'
     && (await optsHas('鈴ヶ森')) && townIn(await board(OWN), '鈴ヶ森') === null && (await postsAt('鈴ヶ森')) === 0,
     'TO6 新しい名前を足す → {ok, id, name, state public, existed:false}・運営の街（origin operator・public）・未ログインの候補に入る・一覧には出ない（誰も挙げていない）',
     J({ a, ta }));

  const H1 = await member();
  must(!(await post(H1, P('浜川'))).__err && (await townRow('浜川'))?.state === 'pending', '「浜川」を出せなかった');
  const hid = await idOf('浜川');
  const h = await adminAdd(OPM, { airline: A1, base: BASE, name: '浜川駅' });
  const th = await townRow('浜川');
  ok(h && h.existed === true && Number(h.id) === hid && th.state === 'public' && th.origin === 'operator'
     && (await optsHas('浜川')) && townIn(await board(OWN), '浜川')?.n === 1,
     'TO6 確認待ちの名前を足す（「浜川駅」と足しても同じ街）→ existed:true・同じ行が公開の運営の街に・候補に入る・一覧に n 1 で出る', J({ h, th }));

  const H2 = await member();
  must(!(await post(H2, P('大井競馬場前'))).__err, '「大井競馬場前」を出せなかった');
  const kid = await idOf('大井競馬場前');
  must((await moderate(OPM, { target: 'town', id: kid, state: 'public' }))?.ok === true && !(await optsHas('大井競馬場前')),
       '「大井競馬場前」を通せなかった・通しただけで候補に入っている');
  const k = await adminAdd(OPM, { airline: A1, base: BASE, name: '大井競馬場前' });
  const tk = await townRow('大井競馬場前');
  ok(k && k.existed === true && Number(k.id) === kid && tk.origin === 'operator' && tk.state === 'public' && (await optsHas('大井競馬場前')),
     'TO6 会員が打ち込み運営が通した名前（候補には無い）を足す → existed:true・運営の街になり、ここから未ログインの候補に入る', J({ k, tk }));

  const n = await countOf('pv_towns');
  const u1 = await adminAdd(OPM, { airline: A1, base: NO_SCOPE, name: '鈴ヶ森' });
  const u2 = await adminAdd(OPM, { airline: 'zz-none', base: BASE, name: '鈴ヶ森' });
  ok(said(u1, '基地が正しくありません', '22023') && said(u2, '航空会社が正しくありません', '22023') && (await countOf('pv_towns')) === n,
     'TO6 街の台帳の無い基地・知らない会社に足す → 22023 で断る（行は増えない）', J({ u1, u2 }));

  const led = async () => J(await many(`select * from public.pv_towns where id in ($1, $2) order by id`, [await idOf('品川'), await idOf('Osaki')]));
  const l0 = await led();
  const m = await moderate(OPM, { target: 'town', id: await idOf('品川'), state: 'rejected' });
  const l1 = await adminAdd(OPM, { airline: A1, base: BASE, name: '品川' });
  const l2 = await adminAdd(OPM, { airline: A1, base: BASE, name: 'Osaki' });
  ok(canon(m) === canon({ ok: false, status: 'ledger' }) && l1?.existed === true && Number(l1.id) === await idOf('品川')
     && l2?.existed === true && Number(l2.id) === await idOf('大崎') && (await led()) === l0,
     'TO6 台帳の街：見送ろうとすると ledger・足しても existed:true（台帳の別の書き方 Osaki は大崎の id）・台帳の行は1文字も変わらない', J({ m, l1, l2 }));

  // LEAD-RULINGS-35 P12.22 a：運営が見送った街も、束ねた街も、候補（誰が読んでも同じ字）に出ない
  const s1 = await moderate(OPM, { target: 'town', id: await idOf('鈴ヶ森'), state: 'rejected' });
  const e = await adminAdd(OPM, { airline: A1, base: BASE, name: '大森東' });
  const inE = await optsHas('大森東');
  const s2 = await moderate(OPM, { target: 'town', id: Number(e && e.id), state: 'public', into: await idOf('品川') });
  ok(s1?.ok === true && s1.state === 'rejected' && inE && s2?.ok === true && Number((await townRow('大森東')).alias_of) === await idOf('品川')
     && !(await optsHas('鈴ヶ森')) && !(await optsHas('大森東')),
     'TO6 運営が見送った街（鈴ヶ森）も、別の書き方として束ねた街（大森東 → 品川）も、候補から消える（LEAD-RULINGS-35 P12.22 a）', J({ s1, inE, s2 }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TO7 確認待ちの数は運営のぶんだけ ── ほかの人には出ない');
// ════════════════════════════════════════════════════════════
{
  const count = async () => { const q = await queue(OPM); return ((q && q.towns) || []).length + ((q && q.texts) || []).length; };
  const V = await member();
  const c0 = await count();
  must(!(await post(V, P('平和島'))).__err, '「平和島」を出せなかった');
  const c1 = await count();
  must(!(await post(V, P('品川', { good: '駅前が便利' }))).__err, '品川に書けなかった');
  const c2 = await count();
  must(!(await post(V, P('大崎'))).__err, '大崎を出せなかった');
  const c3 = await count();
  ok(c1 === c0 + 1 && c2 === c1 + 1 && c3 === c2,
     'TO7 運営の確認待ちの数（towns ＋ texts）は、会員が出したぶんだけ増える（打ち込んだ名前 ＋1・候補に書いた文 ＋1・文の無い候補 ＋0）', J({ c0, c1, c2, c3 }));
  const qp = await readT(PLAIN, 'pv_town_queue', {}), qo = await readT(OWN, 'pv_town_queue', {});
  ok(qp === FORBIDDEN && qo === FORBIDDEN, `TO7 PLAIN・OWN は確認待ちを読めない（${FORBIDDEN}）`, J({ qp, qo }));
  const leak = [];
  for (const [who, label] of [[OWN, 'OWN'], [PLAIN, 'PLAIN'], [W[0].who, '台場に書いた人'], [Q1, '勝島に書いた人']]) {
    const t = J(await mine(who, { airline: A1 }));
    if (t.includes('平和島') || t.includes('駅前が便利')) leak.push({ label, fn: 'my_town_posts' });
  }
  for (const [who, label] of [[OWN, 'OWN'], [FIVER, 'FIVE'], [OPM, 'OP'], [W[0].who, '台場に書いた人']]) {
    const t = await boardT(who, SCOPE);
    if (typeof t !== 'string' || !t.includes('"open"') || t.includes('平和島') || t.includes('駅前が便利')) leak.push({ label, fn: 'pv_town_board' });
  }
  const vm = J(await mine(V, { airline: A1 }));
  ok(leak.length === 0 && vm.includes('平和島') && vm.includes('駅前が便利'),
     'TO7 その名前と文は、ほかの会員の自分の投稿に無く、誰の一覧（運営の一覧も）にも無い ── 本人の自分の投稿にだけ在る', J(leak));
}


// ── 未ログインの預かり（kind 'town'）と引き継ぎ（TA1〜TA9）の道具 ─────────────
// 預かる口・読む口・引き継ぐ口は db/contrib.sql（あとのファイル）に在る本物を呼ぶ。鍵は預けた返事が返したものだけを使う。
// ★同じ鍵に預ける答えは、A1 ではなく A3 の質問へ。TS12 の会員の pv_contrib_give は、A1 で「答えた人の少ない質問」を
//   並べて返す ＝ ほかの会員が A1 に答えると、その会員に何も付いていなくても字が変わる（TS12 の比べ方が意味を失う）。
const ANS_AIR  = A3;
const anonT    = (p, key) => rpc(ANON, 'submit_contrib_anon', { ...(key ? { key } : {}), kind: 'town', data: p });
const anonC    = (key, answers) => rpc(ANON, 'submit_contrib_anon', { ...(key ? { key } : {}), kind: 'cond', data: { airline: ANS_AIR, answers } });
const heldOf   = (key, air = A1) => rpc(ANON, 'my_contrib_anon', { ...(key !== undefined ? { key } : {}), ...(air ? { airline: air } : {}) });
const claimT   = (who, key) => rpc(who, 'claim_contrib', { key });
const pendOf   = async (key) => many(
  `select kind, airline, item_key, payload from public.pv_contrib_pending
    where key_hash = public.pv_contrib_key_hash($1) order by kind, item_key collate "C"`, [key]);
const keyLives = async (key) => (await one(
  `select count(*)::int as n from public.pv_contrib_keys where key_hash = public.pv_contrib_key_hash($1)`, [key])).n === 1;
const answersOf = async (who) => (await one(
  `select count(*)::int as n from public.airline_conditions where proof_hash = public.pv_condition_hash($1::uuid, $2, null)`, [who, ANS_AIR])).n;
const CLAIM_KEYS = 'dropped,kept,known,left,moved,ok,stale';
const claimIs = (r, m, k, d, l) => !!r && !r.__err && keys(r) === CLAIM_KEYS && r.ok === true && r.known === true
  && r.moved === m && r.kept === k && r.dropped === d && r.stale === 0 && r.left === l;
// 親の無い選ぶ質問を5つ（FIVE と同じ取り方。打ち込まない）
const FIVEQ = (await many(
  `select id, choice_codes from public.pv_condition_questions
    where active and parent is null and kind = 'choice' order by priority, id`))
  .slice(0, 5).map((q) => ({ question_id: q.id, code: q.choice_codes.find((c) => c !== 'unknown') }));
must(FIVEQ.length === 5, '親の無い選ぶ質問が5つ無い');
// 1本の鍵に、5つの答えと街を預ける（答えが先・街があと。返すのは鍵）
const holdMix = async (towns) => {
  const a = await anonC(undefined, FIVEQ);
  must(a && a.saved === 5 && /^[0-9a-f]{48}$/.test(a.key || ''), '5つの答えを預けられなかった', J(a));
  for (const t of towns) must(!(await anonT(P(t), a.key)).__err, `「${t}」を預けられなかった`);
  return a.key;
};


// ════════════════════════════════════════════════════════════
console.log('\n▼ TA1 未ログインの預かり（kind town）── 保存され、預かりのまま・鍵が返る');
// ════════════════════════════════════════════════════════════
let K1 = null, HELD1 = null;
{
  const r = await anonT(P('品川', { lived: 'now', good: '静かな通り', rent: { layout: '1K', amount: '120000', currency: CUR },
                                     trip: { mode: 'train', minutes: '30' } }));
  ok(r && !r.__err && keys(r) === 'key,ok,post,replaced,saved' && r.ok === true && r.saved === true && r.replaced === false
     && /^[0-9a-f]{48}$/.test(r.key) && keys(r.post) === POST_KEYS && r.post.town === '品川'
     && r.post.town_state === 'held' && r.post.text_state === 'held' && r.post.lived === 'now',
     'TA1 submit_contrib_anon {kind:town} → {ok, saved:true, replaced:false, post, key}・post は POST の10個の鍵・town_state も text_state も held', J(r));
  K1 = r && r.key; HELD1 = r && r.post;
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TA2 預かりは、その鍵にだけ返る（towns・POST と同じ形）');
// ════════════════════════════════════════════════════════════
{
  const r2 = await anonT(P('大崎', { good: '別の鍵の預かり' }));
  const K2 = r2 && r2.key;
  must(!!K1 && !!K2 && K1 !== K2, '2本目の鍵を作れなかった');
  const m1 = await heldOf(K1), m2 = await heldOf(K2);
  ok(m1 && keys(m1) === 'answers,known,ok,rows,towns' && m1.known === true && m1.towns.length === 1 && canon(m1.towns[0]) === canon(HELD1)
     && m2.towns.length === 1 && m2.towns[0].town === '大崎',
     'TA2 my_contrib_anon（その鍵）→ towns に預けた1件が、預けた時の post と同じ形・同じ字で返る／別の鍵には、その鍵の1件だけ', J({ m1, m2 }));
  const none = [await heldOf(undefined), await heldOf(''), await heldOf('c'.repeat(48)), await heldOf(K1, A2)];
  ok(none.every((m) => m && Array.isArray(m.towns) && m.towns.length === 0) && none.slice(0, 3).every((m) => m.known === false),
     'TA2 鍵なし・空の鍵・知らない鍵 → towns は空（known:false）／同じ鍵でもほかの会社 → towns は空', J(none));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TA3 預かりは、一覧にも候補にも運営の確認待ちにも出ない・街の行を作らない');
// ════════════════════════════════════════════════════════════
{
  const state = async () => J([await boardT(OWN, SCOPE), await optsT(ANON, SCOPE), await readT(OPM, 'pv_town_queue', {}),
                               await countOf('pv_towns'), await countOf('pv_town_posts')]);
  const before = await state();
  const a = await anonT(P('預かりだけの街', { good: '預かりの文' }));
  const b = await anonT(P('品川', { concern: '預かりの気になる点' }), a && a.key);
  must(a && !a.__err && b && !b.__err, '預けられなかった', J({ a, b }));
  ok((await state()) === before && (await townRow('預かりだけの街')) === null,
     'TA3 候補に無い名前と文を預けても、一覧（OWN）・候補（未ログイン）・運営の確認待ちの字も、街の表・投稿の表の行の数も変わらない（「預かりだけの街」の行は無い）');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TA4 ログインして引き継ぐと、会員の行になる（打ち込んだ名前は、そこで確認待ちに）');
// ════════════════════════════════════════════════════════════
{
  const r = await anonT(P('旧東海道', { good: '古い町並み' }));
  must(r && !r.__err && (await townRow('旧東海道')) === null, '「旧東海道」を預けられなかった', J(r));
  const M = await member();
  const q0 = await queue(OPM);
  const c = await claimT(M, r.key);
  const q1 = await queue(OPM);
  const own = ((await mine(M, { airline: A1 })).posts || []).find((x) => x.town === '旧東海道') || null;
  const t = await townRow('旧東海道');
  ok(claimIs(c, 1, 0, 0, 0) && own && own.town_state === 'pending' && own.text_state === 'pending' && own.good === '古い町並み'
     && t && t.origin === 'member' && t.state === 'pending',
     'TA4 claim_contrib → moved 1・会員の自分の投稿に「旧東海道」（town_state pending・文も pending）・街の行は会員の名前として確認待ち', J({ c, own, t }));
  ok(q1.towns.length === q0.towns.length + 1 && q1.texts.length === q0.texts.length + 1
     && q1.towns.some((x) => x.name === '旧東海道') && q1.texts.some((x) => x.town === '旧東海道')
     && (await pendOf(r.key)).length === 0 && !(await keyLives(r.key)) && (await heldOf(r.key)).known === false,
     'TA4 運営の確認待ちは、名前 ＋1・文 ＋1（ここで初めて）・預かりは空で、鍵も消える', J({ q0: [q0.towns.length, q0.texts.length], q1: [q1.towns.length, q1.texts.length] }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TA5 会員の側に同じ街のもっと新しい投稿が在れば、そちらを残す');
// ════════════════════════════════════════════════════════════
{
  const M = await member();
  const r = await anonT(P('品川', { lived: 'past' }));
  must(r && !r.__err && !(await post(M, P('品川', { lived: 'now' }))).__err, '預けてから会員として出せなかった');
  const c = await claimT(M, r.key);
  const rows = await rowsOf(M);
  ok(claimIs(c, 0, 1, 0, 0) && rows.length === 1 && rows[0].tname === '品川' && rows[0].lived === 'now' && !(await keyLives(r.key)),
     'TA5 預けたあとで会員として同じ街を出していた → kept 1・会員の行（lived now）がそのまま・預かりは捨てて鍵も消える', J({ c, rows: rows.map((x) => [x.tname, x.lived]) }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TA6 引き継ぎの上限は、街と、月の勤務・質問とで互いに止めない');
// ════════════════════════════════════════════════════════════
{
  // a 候補に無い名前4つ（ローマ字 ＝ 鍵の並びで候補の街より先に回る）・候補の街1つ・親の無い質問5つ
  const Ma = await member();
  const ka = await holdMix(['Alpha', 'Bravo', 'Charlie', 'Delta', '天王洲アイル']);
  const ca = await claimT(Ma, ka);
  const ra = (await rowsOf(Ma)).map((x) => x.tname);
  ok(claimIs(ca, 9, 0, 0, 1) && (await keyLives(ka)) && (await answersOf(Ma)) === 5 && ra.length === 4 && ra.includes('天王洲アイル')
     && (await pendOf(ka)).length === 1 && (await pendOf(ka))[0].item_key === `${BASE}:delta`,
     'TA6 a 名前4つ・候補の街1つ・答え5つ → moved 9（答え5・名前3・候補の街）・left 1（4つ目の名前だけ）・鍵は残る・答えは会員の行に5つ',
     J({ ca, ra, left: (await pendOf(ka)).map((x) => x.item_key) }));
  await yesterday(Ma);
  const ca2 = await claimT(Ma, ka);
  ok(claimIs(ca2, 1, 0, 0, 0) && !(await keyLives(ka)) && (await rowsOf(Ma)).length === 5,
     'TA6 a 数えの日を前の日へ動かして（持ち主として）もう一度 → moved 1・left 0・鍵は消える', J(ca2));

  // b 1日の保存の数（20回）に当たっている会員：街は残り、同じ鍵の答えは引き継がれる
  const Mb = await member();
  await db.query(
    `insert into public.pv_town_rate (author_hash, day, n, names) values ($1, current_date, 20, 0)
     on conflict (author_hash) do update set day = current_date, n = 20`, [await hashOf(Mb)]);
  const kb = await holdMix(['品川', '大崎']);
  const cb = await claimT(Mb, kb);
  ok(claimIs(cb, 5, 0, 0, 2) && (await keyLives(kb)) && (await answersOf(Mb)) === 5 && (await rowsOf(Mb)).length === 0,
     'TA6 b 1日の保存の数（20回）に当たっている → 街2つは残り（left 2）・同じ鍵の答え5つは引き継がれる（moved 5）', J(cb));

  // c 答えの1日の上限に当たっている会員：答えは残り、同じ鍵の候補の街は引き継がれる
  const Mc = await member();
  await db.query(`update public.profiles set cond_answers_day = current_date, cond_answers_today = 60 where id = $1`, [Mc]);
  const kc = await holdMix(['品川']);
  const cc = await claimT(Mc, kc);
  const rc = (await rowsOf(Mc)).map((x) => x.tname);
  ok(claimIs(cc, 1, 0, 0, 5) && (await keyLives(kc)) && (await answersOf(Mc)) === 0 && J(rc) === J(['品川']),
     'TA6 c 答えの1日の上限に当たっている → 答え5つは残り（left 5）・同じ鍵の候補の街は引き継がれる（moved 1）', J({ cc, rc }));

  // d 想定外の失敗（持ち主が投稿の表に、必ず失敗する決まりを一時だけ置く）：答えは引き継がれ、街は残る（LEAD 補足 A16）
  const Md = await member();
  const kd = await holdMix(['品川']);
  let cd;
  await db.exec(`
    create or replace function public.pv_test_town_boom() returns trigger language plpgsql as $b$
    begin raise exception '検査のための失敗' using errcode = 'P0001'; end $b$;
    create trigger pv_test_town_boom before insert on public.pv_town_posts for each row execute function public.pv_test_town_boom();`);
  try { cd = await claimT(Md, kd); }
  finally {
    await db.exec(`drop trigger if exists pv_test_town_boom on public.pv_town_posts; drop function if exists public.pv_test_town_boom();`);
  }
  ok(claimIs(cd, 5, 0, 0, 1) && (await keyLives(kd)) && (await answersOf(Md)) === 5 && (await rowsOf(Md)).length === 0,
     'TA6 d 街の引き継ぎで想定外の失敗 → 引き継ぎ全体は落ちない：答え5つは moved・街は left 1・鍵は残る', J(cd));
  const cd2 = await claimT(Md, kd);
  ok(claimIs(cd2, 1, 0, 0, 0) && !(await keyLives(kd)) && J((await rowsOf(Md)).map((x) => x.tname)) === J(['品川']),
     'TA6 d 失敗の決まりを外して（持ち主として）もう一度 → moved 1・left 0・鍵は消える（街は消えずに残っていた）', J(cd2));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TA8 預かりの街を直す（was）── 1行・was は残さない');
// ════════════════════════════════════════════════════════════
{
  const a = await anonT(P('品川', { good: '直す前' }));
  const b = await anonT(P('大崎', { was: '品川', good: '直した後' }), a && a.key);
  const rows = await pendOf(a && a.key);
  ok(a && b && !b.__err && b.replaced === true && b.post.town === '大崎' && rows.length === 1 && rows[0].item_key === `${BASE}:大崎`
     && rows[0].payload.town === '大崎' && !('was' in rows[0].payload),
     'TA8 預けた品川を大崎へ直す（was 品川）→ replaced:true・預かりは大崎の1行だけ・預かった中身に was の鍵は無い', J({ b, rows }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TA9 1本の鍵・1つの会社で預かれる街は10か所まで');
// ════════════════════════════════════════════════════════════
{
  const first = await anonT(P(TEN[0]));
  const key = first && first.key;
  let n = first && first.saved === true ? 1 : 0;
  for (const t of TEN.slice(1, 10)) { const r = await anonT(P(t), key); if (r && r.saved === true) n++; }
  const r11 = await anonT(P(TEN[10]), key);
  const again = await anonT(P(TEN[0], { lived: 'now' }), key);
  ok(n === 10 && said(r11, '1つの会社に出せる街は10か所までです', '22023') && (await pendOf(key)).length === 10
     && again && again.replaced === true,
     'TA9 10か所を預けた鍵で11か所目 → 22023「1つの会社に出せる街は10か所までです」（預かりは10のまま）・持っている街の出し直しは通る', J({ n, r11, again }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TS12（くり返し）一覧と候補を読んでも、資格は1つも付かない');
// ════════════════════════════════════════════════════════════
{
  const { G, snap, s0 } = TS12;
  const moved = [];
  for (const [label, f] of [['一覧を読む', () => boardT(G, SCOPE)], ['候補を読む', () => optsT(G, SCOPE)]]) {
    const a = await snap();
    const r = await f();
    const b = await snap();
    if (typeof r !== 'string' || J(a) !== J(b)) moved.push({ label, r, a, b });
  }
  // 給与の行の数と運営の名簿の数は、TB の準備（持ち主が作った読む人）で増えている ＝ 最初と比べるのは、その会員自身の2つ
  const end = await snap();
  ok(moved.length === 0 && end.profile === s0.profile && end.give === s0.give,
     'TS12 給与を出した会員が一覧（開いている）と候補を読んでも、前と後でプロフィールの行・給与の行の数・運営の名簿・pv_contrib_give の返事が同じ（その会員のプロフィールと pv_contrib_give は TS12 の最初とも同じ）',
     J({ moved, s0, end }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TS12（くり返し）運営の口を呼んでも・運営がその人の名前を通しても、資格は1つも付かない');
// ════════════════════════════════════════════════════════════
{
  const { G, snap, s0 } = TS12;
  const g = await townRow('御殿山');
  must(g && g.state === 'pending' && (await rowsOf(G)).some((x) => x.tname === '御殿山'), 'TS12 の会員の「御殿山」が確認待ちでない');
  const a = await snap();
  const rs = [await readT(G, 'pv_town_queue', {}),
              await readT(G, 'pv_town_moderate', { target: 'town', id: Number(g.id), state: 'public' }),
              await readT(G, 'pv_town_admin_add', { airline: A1, base: BASE, name: '御殿山' })];
  const r4 = await moderate(OPM, { target: 'town', id: Number(g.id), state: 'public' });
  const b = await snap();
  ok(rs.every((t) => t === FORBIDDEN) && r4 && r4.ok === true && J(a) === J(b) && b.profile === s0.profile && b.give === s0.give,
     'TS12 給与を出した会員が運営の3つの口を呼んでも（どれも forbidden）、運営がその人の打ち込んだ名前を通しても、プロフィールの行・給与の行の数・運営の名簿・pv_contrib_give の返事は同じ（その会員のプロフィールと pv_contrib_give は TS12 の最初とも同じ）',
     J({ rs, r4, a, b }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TS12（くり返し）未ログインで預けた街を引き継いでも、資格は1つも付かない（TA7 をここで見る）');
// ════════════════════════════════════════════════════════════
{
  const { G, snap, s0 } = TS12;
  const a = await snap();
  const d1 = await anonT(P('御殿山', { lived: 'now' }));
  const key = d1 && d1.key;
  const d2 = await anonT(P('戸越', { good: '商店街が長い' }), key);
  const d3 = await anonT(P('品川', { rent: { layout: '1LDK', amount: '150000', currency: CUR } }), key);
  const c = await claimT(G, key);
  const b = await snap();
  ok(!!key && !d2.__err && !d3.__err && claimIs(c, 3, 0, 0, 0) && J(a) === J(b) && b.profile === s0.profile && b.give === s0.give,
     'TS12 給与を出した会員が、未ログインで預けた街3つを引き継いでも（moved 3）、プロフィールの行・給与の行の数・運営の名簿・pv_contrib_give の返事は同じ（その会員のプロフィールと pv_contrib_give は TS12 の最初とも同じ ＝ 答えた数に街は入らない）',
     J({ c, a, b }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TO8 別の書き方を束ねてある街を、さらに束ねる ── その書き方も束ねた先へ（LEAD-RULINGS-35 P12.23 a）');
// ════════════════════════════════════════════════════════════
// ★TZ の手前に置く（「勝島」を「品川」へ束ねるので、勝島・品川を使うほかの節より後）
{
  const X = '品川', Y = '勝島', AL = ['Katsushima', 'かつしま'];
  const xid = await idOf(X), yid = await idOf(Y);
  must((await townRow(Y)).state === 'public' && (await townRow(Y)).alias_of === null
       && (await Promise.all(AL.map(townRow))).every((t) => t && Number(t.alias_of) === yid),
       'TO5 の「Katsushima」「かつしま」が「勝島」へ束ねていない');
  const who = Number((await one(
    `select count(distinct author_hash)::int as n from public.pv_town_posts where town_id in ($1, $2)`, [xid, yid])).n);
  const r = await moderate(OPM, { target: 'town', id: yid, state: 'public', into: xid });
  const ty = await townRow(Y), ta = await Promise.all(AL.map(townRow));
  const b = townIn(await board(OWN), X);
  ok(canon(r) === canon({ ok: true, target: 'town', id: yid, state: 'public', into: xid })
     && Number(ty.alias_of) === xid && ta.every((t) => Number(t.alias_of) === xid)
     && (await postsAt(Y)) === 0 && (await postsAt(X)) === who && b && b.n === who,
     'TO8 「勝島」（Katsushima・かつしまを束ねてある）を「品川」へ束ねる → 勝島も Katsushima も かつしま も束ねた先は品川（1段のまま）・投稿は品川へ（両方に出した人は1人）',
     J({ r, ty, ta, who, n: await postsAt(X), b }));
  const U = await member();
  const p = await post(U, P(AL[0]));
  const b2 = townIn(await board(OWN), X), ru = await rowsOf(U);
  ok(!p.__err && p.replaced === false && p.post.town === X && p.post.town_state === 'public'
     && ru.length === 1 && ru[0].tname === X && (await postsAt(X)) === who + 1 && b2 && b2.n === who + 1
     && (await postsAt(Y)) === 0 && (await postsAt(AL[0])) === 0,
     'TO8 そのあと「Katsushima」と打つ → 品川の行に入る（本人への返事も品川・public）・品川の数も一覧も ＋1（勝島・Katsushima には0）',
     J({ p, ru: ru.map((x) => x.tname), n: await postsAt(X), b2 }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TG8 1人が同じ街の別の書き方2つに出していた ── 種は止まらず、その人は街の1行（LEAD-RULINGS-35 P12.23 b）');
// ════════════════════════════════════════════════════════════
{
  // 検査だけの種：本物の種に、作り物の基地（QZT）の街1つと、その別の書き方2つを足す（台帳は直さない）
  const NAME = '東大井', S = ['Higashi-Oi', 'ひがしおおい'];
  const Ma = await member(), Mb = await member();
  const a1 = await post(Ma, P(S[0], { lived: 'past' }));
  const a2 = await post(Ma, P(S[1], { lived: 'now' }));
  const b1 = await post(Mb, P(S[0], { lived: 'past' }));
  // どちらが新しいかは、持ち主として決めておく（時計の刻みに頼らない）
  await db.query(
    `update public.pv_town_posts set updated_at = now() - interval '1 hour'
      where author_hash = $1 and town_id = (select id from public.pv_towns where airline = $2 and base_iata = $3 and tkey = public.pv_town_key($4))`,
    [await hashOf(Ma), A1, BASE, S[0]]);
  must(!a1.__err && !a2.__err && !b1.__err && (await townRow(NAME)) === null
       && (await townRow(S[0]))?.state === 'pending' && (await townRow(S[1]))?.state === 'pending'
       && (await postsAt(S[0])) === 2 && (await postsAt(S[1])) === 1,
       '打ち込んだ名前（Higashi-Oi・ひがしおおい）を出せなかった', J({ a1, a2, b1 }));
  const text = withRow(withRow(withRow(SEED, '-- 1.', [A1, BASE, NAME]), '-- 2.', [A1, BASE, NAME, S[0]]), '-- 2.', [A1, BASE, NAME, S[1]]);
  let err = null;
  try { await db.exec(text); } catch (e) { err = e.message; }
  const t = await townRow(NAME), al = await Promise.all(S.map(townRow));
  const ra = await rowsOf(Ma), rb = await rowsOf(Mb);
  ok(err === null && t && t.origin === 'ledger' && al.every((x) => x && Number(x.alias_of) === Number(t.id))
     && (await postsAt(S[0])) === 0 && (await postsAt(S[1])) === 0 && (await postsAt(NAME)) === 2
     && ra.length === 1 && ra[0].tname === NAME && ra[0].lived === 'now' && rb.length === 1 && rb[0].tname === NAME,
     'TG8 「Higashi-Oi」「ひがしおおい」の両方に出していた人（「東大井」には無い）→ 種が2つとも東大井の別の書き方にしても止まらない・その人は東大井の1行（新しいほう）・東大井は2人',
     J({ err, t, al, ra: ra.map((x) => [x.tname, x.lived]), rb: rb.map((x) => x.tname) }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TG9 運営が書き方を束ねてあった街を、種が別の書き方にする ── その書き方も種の街へ（LEAD-RULINGS-35 P12.23 c）');
// ════════════════════════════════════════════════════════════
{
  // 検査だけの種：作り物の基地（QZT）の街「武蔵小山」と、その別の書き方「中延」（会員が打ち、運営が通した街。台帳は直さない）
  const NAME = '武蔵小山', Y = '中延', Z = 'Nakanobu';
  const Ma = await member(), Mb = await member();
  const a = await post(Ma, P(Y)), b = await post(Mb, P(Z));
  must(!a.__err && !b.__err && (await townRow(NAME)) === null
       && (await townRow(Y))?.state === 'pending' && (await townRow(Z))?.state === 'pending',
       '打ち込んだ名前（中延・Nakanobu）を出せなかった', J({ a, b }));
  const yid = await idOf(Y), zid = await idOf(Z);
  const r1 = await moderate(OPM, { target: 'town', id: yid, state: 'public' });
  const r2 = await moderate(OPM, { target: 'town', id: zid, state: 'public', into: yid });
  must(r1?.ok === true && r2?.ok === true && (await townRow(Y)).state === 'public' && (await townRow(Y)).alias_of === null
       && Number((await townRow(Z)).alias_of) === yid && (await postsAt(Y)) === 2 && (await postsAt(Z)) === 0,
       '運営が「Nakanobu」を「中延」へ束ねられなかった', J({ r1, r2 }));
  const text = withRow(withRow(SEED, '-- 1.', [A1, BASE, NAME]), '-- 2.', [A1, BASE, NAME, Y]);
  let err = null;
  try { await db.exec(text); } catch (e) { err = e.message; }
  const t = await townRow(NAME), ty = await townRow(Y), tz = await townRow(Z);
  const Mc = await member();
  const p = await post(Mc, P(Z));
  const rc = await rowsOf(Mc);
  ok(err === null && t && t.origin === 'ledger' && t.alias_of === null
     && ty && Number(ty.alias_of) === Number(t.id) && tz && Number(tz.alias_of) === Number(t.id)
     && !p.__err && p.replaced === false && p.post.town === NAME && p.post.town_state === 'public'
     && rc.length === 1 && rc[0].tname === NAME
     && (await postsAt(NAME)) === 3 && (await postsAt(Y)) === 0 && (await postsAt(Z)) === 0,
     'TG9 「Nakanobu」を束ねてあった「中延」を、種が「武蔵小山」の別の書き方にする → Nakanobu の束ねた先も武蔵小山（1段のまま）・そのあと「Nakanobu」と打つと武蔵小山に入る（本人への返事も武蔵小山・public）・武蔵小山は3人',
     J({ err, t, ty, tz, p, rc: rc.map((x) => x.tname), n: await postsAt(NAME) }));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ TZ 返事に出てはいけないもの（ここまでの返事を全部見る）');
// ════════════════════════════════════════════════════════════
{
  const HEX = /[0-9a-f]{64}/i;
  const NEVER = new Set(['author_hash', 'user_id', 'created_at', 'updated_at']);
  // 本人への返事：会員の入口・自分の投稿と、預けた端末への返事（預かる口・預かりを読む口）
  const OWN = new Set(['submit_town_post', 'my_town_posts', 'submit_contrib_anon', 'my_contrib_anon']);
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
