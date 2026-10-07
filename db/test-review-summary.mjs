/* db/test-review-summary.mjs — 口コミの要約（db/review-summary.sql）が約束どおりに
   預かり・確かめ・返しているかを、本物の Postgres（PGlite）で実際に呼んで確かめる。

   実行: node db/test-review-summary.mjs   （または node check.mjs sql）
   ネットワーク不要・本番に一切触らない・Anthropic も呼ばない。

   なぜ要るか
     要約は「数人の感想を、会社の顔として1か所に大きく出す」部品。間違えたときの害が
     口コミ1件より大きい。なので守る線を全部サーバ側に置いてあり、ここがその線を1本ずつ踏む。
       ・本文を読めない人に、要約が1文字も返らない（判定は本文と同じ関数）
       ・要約が無いときの返事が、鍵の有無で変わらない
       ・3件に満たない会社／1件にしか支えられていない点／4つ以上／長すぎる文は入らない
       ・元の口コミが消えたら出さない（削除依頼で消した中身が要約に残らない）
       ・どの口コミが材料か（id）も、何件が支えたか（k）も、外へ出ない
       ・書けるのは運営だけ・表は直に読めない

   ⚠️ 字面では捕まらないものを見ている。revoke と書いてあっても、表ぜんぶの権限が
      残っていれば読める（db/test-reviews-gate.mjs と同じ罠）。だから実際に select する。

   ★写しの突き合わせもここ。分類の鍵・古い会社コード・字数は、SQL と画面と
     gen-review-summary.mjs に同じものが在る。片方だけ直すと黙って食い違う。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import { CATS, LIMITS, LEGACY_OF, MAX_POINTS, MIN_REVIEWS, MIN_SUPPORT,
         buildInput, settle, payloadOf, selftest } from '../gen-review-summary.mjs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label} ${extra}`); }
};
const one  = async (sql, params) => (await db.query(sql, params)).rows[0];
const rows = async (sql, params) => (await db.query(sql, params)).rows;
const boom = async (sql, params) => {
  try { await db.query(sql, params); return null; } catch (e) { return String(e.message || e); }
};
/* ★比べるときは鍵を並べ直す。jsonb は鍵を自分の順（短い順 → 字の順）に並べ替えて返すので、
   素の JSON.stringify で比べると「中身は同じなのに違う」と出る。配列の順はそのまま見る。 */
const canon = (x) => (Array.isArray(x) ? x.map(canon)
  : (x && typeof x === 'object') ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])]))
  : x);
const J = (x) => JSON.stringify(canon(x));

// ── 器（db/test-reviews-gate.mjs と同じ）─────────────────────
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  grant usage on schema public, extensions to anon, authenticated;
  /* ★既定権限を先に全付与しておく。無いと「元から権限が無いだけ」を
     「revoke が効いた」と誤読する。 */
  alter default privileges in schema public grant all on tables to anon, authenticated;
  /* ★関数も同じ。Supabase は public の新しい関数を、既定で anon / authenticated に配る。
     これが無いと「誰にも配っていない」が、revoke を書き忘れていても緑になる。 */
  alter default privileges in schema public grant execute on functions to anon, authenticated;

  grant usage on schema auth to anon, authenticated;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;

  create table public.profiles (id uuid primary key, email text);
  create table public.pv_admins (
    user_id uuid primary key references auth.users(id) on delete cascade,
    note text, added_at timestamptz not null default now());

  create table public.reviews_v2 (
    id          uuid primary key default gen_random_uuid(),
    proof_hash  text not null,
    airline     text not null,
    "position"  text,
    tenure_bucket text,
    age_bucket  text,
    fleet       text,
    job_role    text,
    monthly_salary integer,
    bonus       integer,
    annual_salary integer,
    base_annual integer,
    flight_allowance_annual integer,
    culture_score integer, salary_score integer, benefits_score integer,
    wlb_score integer, ops_score integer, training_score integer, mgmt_score integer,
    culture_comment text, salary_comment text, benefits_comment text,
    wlb_comment text, ops_comment text, training_comment text, mgmt_comment text,
    orig_lang   text,
    translations jsonb,
    created_at  timestamptz not null default now()
  );
`);

// ── 適用（本番と同じ順）──────────────────────────────────────
const FILES = ['db/airlines.generated.sql', 'db/vocab.generated.sql',
               'db/pay-reports.sql', 'db/pay-report-pending.sql', 'db/pay-rows.sql',
               'db/reviews-gate.sql', 'db/review-summary.sql'];

console.log('\n▼ SQL の適用');
for (const f of FILES) {
  try { await db.exec(read(f)); console.log(`  ✅ ${f}`); pass++; }
  catch (e) { console.log(`  ❌ ${f}\n     ${e.message}`); fail++; process.exit(1); }
}

// ── 道具 ─────────────────────────────────────────────────────
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const mkUser = async (n) => {
  await db.query(`insert into auth.users(id,email) values($1,$2) on conflict do nothing`,
    [uid(n), `p${n}@example.com`]);
  await db.query(`insert into public.profiles(id,email) values($1,$2) on conflict do nothing`,
    [uid(n), `p${n}@example.com`]);
};
const asUser = async (n) => {
  await db.exec(`reset role`);
  await db.query(`select set_config('pv.uid', $1, false)`, [uid(n)]);
  await db.exec(`set role authenticated`);
};
const asAnon = async () => {
  await db.exec(`reset role`);
  await db.query(`select set_config('pv.uid', '', false)`);
  await db.exec(`set role anon`);
};
const asOwner = async () => {
  await db.exec(`reset role`);
  await db.query(`select set_config('pv.uid', '', false)`);
};
const as = async (who) => (who === 'anon' ? asAnon() : who === 'owner' ? asOwner() : asUser(who));

/* 投稿する（proof_hash は本番と同じ式で作る）。 */
const post = async (n, code, extra = {}) => {
  await asOwner();
  const h = (await one(`select public.pv_review_hash($1::uuid,$2) h`, [uid(n), code])).h;
  const cols = Object.keys(extra).filter(k => k !== '__at');
  const vals = cols.map((_, i) => `$${i + 4}`).join(',');
  await db.query(
    `insert into public.reviews_v2(proof_hash, airline, created_at${cols.length ? ',' + cols.map(c => `"${c}"`).join(',') : ''})
     values($1,$2,$3${cols.length ? ',' + vals : ''})`,
    [h, code, extra.__at || new Date().toISOString(), ...cols.map(c => extra[c])]);
};

/* ★呼んだ関数の返り値は全部ここに溜める。最後に「id も k も1つも出ていない」をまとめて見る。 */
const RETURNS = [];
const rpc = async (fn, p) => {
  const r = (await one(`select public.${fn}($1::jsonb) r`, [p === null ? null : J(p)])).r;
  RETURNS.push({ fn, r });
  return r;
};
const getAs = async (who, airline, lang = 'ja') => {
  await as(who);
  const r = await rpc('pv_review_summary', { airline, lang });
  await asOwner();
  return r;
};
const putAs = async (who, p) => {
  await as(who);
  const r = await rpc('pv_review_summary_set', p);
  await asOwner();
  return r;
};
const stored = async (airline, lang = 'ja') => {
  await asOwner();
  return (await one(`select count(*)::int c from public.pv_review_summaries where airline=$1 and lang=$2`, [airline, lang])).c;
};

const OP = 9;        // 運営（口コミは1件も出していない）
const KEYED = 5;     // 別の会社に口コミを出した会員 ＝ 本文を読める
const NOKEY = 4;     // 登録だけの会員 ＝ 本文を読めない
for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 21, 22, 23, 24, 31, 32]) await mkUser(n);
await asOwner();
await db.query(`insert into public.pv_admins(user_id) values($1)`, [uid(OP)]);

// ana … 3人が1件ずつ（3件）
await post(1, 'ana', { culture_comment: '相談しやすい雰囲気です。', training_comment: '教官が丁寧に教えてくれます。', __at: '2026-03-01T00:00:00Z' });
await post(2, 'ana', { training_comment: '訓練は丁寧で質問しやすい。', wlb_comment: '勤務の変更が直前に来ることがある。', __at: '2026-03-02T00:00:00Z' });
await post(3, 'ana', { wlb_comment: '直前の勤務変更が多い。', mgmt_comment: '経営陣への提案です。', __at: '2026-03-03T00:00:00Z' });
// 別の会社に1件 ＝ 鍵を持つ会員
await post(KEYED, 'skymark', { culture_comment: '落ち着いた職場です。', __at: '2026-03-01T00:00:00Z' });
// peach … 2件だけ（3件に満たない）
await post(6, 'peach', { culture_comment: '若い人が多い。', __at: '2026-03-01T00:00:00Z' });
await post(7, 'peach', { culture_comment: '風通しが良い。', __at: '2026-03-02T00:00:00Z' });
// キャセイ … 古い短いコードに2件・いまのコードに1件（合わせて3件）
await post(11, 'cathay', { ops_comment: '運航の支援が手厚い。', __at: '2026-03-01T00:00:00Z' });
await post(12, 'cathay', { ops_comment: '支援の体制が心強い。', __at: '2026-03-02T00:00:00Z' });
await post(13, 'cathay-pacific', { culture_comment: '多国籍で話しやすい。', __at: '2026-03-03T00:00:00Z' });

const NEWEST_ANA = '2026-03-03T00:00:00Z';
const G = (k = 2) => ({ text: '訓練の教え方が丁寧だという声が複数ある', cat: 'training', k });
const C = (k = 2) => ({ text: '勤務の変更が直前に来るという声が複数ある', cat: 'wlb', k });
const anaPayload = (over = {}) => ({ airline: 'ana', lang: 'ja', n: 3, newest: NEWEST_ANA, good: [G()], concern: [C()], ...over });


// ════════════════════════════════════════════════════════════
console.log('\n▼ 1. 写しの突き合わせ（SQL ⇄ 画面 ⇄ gen-review-summary.mjs）');
// ════════════════════════════════════════════════════════════
{
  await asOwner();
  const sqlCats = (await one(`select public.pv_review_summary_cats() a`)).a;
  ok(J(sqlCats) === J(CATS), '分類の鍵が SQL と gen-review-summary.mjs で同じ', `${J(sqlCats)} / ${J(CATS)}`);

  const dataJs = read('airlines/airline-reviews-data.js');
  const keysOf = (name) => {
    const m = dataJs.match(new RegExp('const ' + name + '\\s*=\\s*\\[([\\s\\S]*?)\\];'));
    return m ? [...m[1].matchAll(/key:\s*'([a-z]+)'/g)].map((x) => x[1]) : null;
  };
  ok(J(keysOf('REVIEW_CATS')) === J(sqlCats), '分類の鍵が会社ページの絞り込みチップ（日本語）と同じ', J(keysOf('REVIEW_CATS')));
  ok(J(keysOf('REVIEW_CATS_EN')) === J(sqlCats), '分類の鍵が会社ページの絞り込みチップ（英語）と同じ', J(keysOf('REVIEW_CATS_EN')));

  const uiJs = read('airlines/airline-reviews-ui.js');
  const lm = uiJs.match(/var LEGACY_OF\s*=\s*\{([\s\S]*?)\};/);
  const uiLegacy = lm ? Object.fromEntries([...lm[1].matchAll(/'([a-z-]+)'\s*:\s*'([a-z-]+)'/g)].map((x) => [x[1], x[2]])) : null;
  ok(uiLegacy && Object.keys(uiLegacy).length >= 7, '会社ページの古いコードの表を読めた', J(uiLegacy));
  const sortObj = (o) => J(Object.entries(o || {}).sort());
  ok(sortObj(uiLegacy) === sortObj(LEGACY_OF), '古い会社コードの表が会社ページと gen-review-summary.mjs で同じ');
  let sqlSame = true;
  for (const [slug, old] of Object.entries(uiLegacy || {})) {
    const a = (await one(`select public.pv_review_summary_codes($1) a`, [slug])).a;
    if (J(a) !== J([slug, old])) { sqlSame = false; console.log(`     ${slug} → ${J(a)}`); }
  }
  ok(sqlSame, '古い会社コードの表が会社ページと SQL で同じ（7組とも）');
  ok(J((await one(`select public.pv_review_summary_codes('ana') a`)).a) === J(['ana']), '古いコードの無い会社は、いまのコード1つだけ');
  ok(J((await one(`select public.pv_review_summary_codes('cathay') a`)).a) === J(['cathay']), '古いコードから逆には引かない');

  /* 字数の境目を SQL に直接聞く。 */
  const bad = async (text, lang) =>
    (await one(`select public.pv_review_summary_bad($1::jsonb, $2, 3) e`, [J([{ text, cat: 'wlb', k: 2 }]), lang])).e;
  let lim = true;
  for (const lang of ['ja', 'en']) {
    const { min, max } = LIMITS[lang];
    const ch = lang === 'ja' ? 'あ' : 'a';
    const got = [await bad(ch.repeat(min - 1), lang), await bad(ch.repeat(min), lang),
                 await bad(ch.repeat(max), lang), await bad(ch.repeat(max + 1), lang)];
    if (J(got) !== J(['text_too_short', null, null, 'text_too_long'])) { lim = false; console.log(`     ${lang}: ${J(got)}`); }
  }
  ok(lim, `字数の境目が SQL と gen-review-summary.mjs で同じ（日本語 ${LIMITS.ja.min}〜${LIMITS.ja.max}・英語 ${LIMITS.en.min}〜${LIMITS.en.max}）`);
  ok(LIMITS.ja.min === 8 && LIMITS.ja.max === 90, '日本語は 8〜90字（決めた線そのもの）');
  ok(MAX_POINTS === 3 && MIN_REVIEWS === 3 && MIN_SUPPORT === 2, '3つまで・3件から・2件以上（gen-review-summary.mjs の定数）');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 2. 預かった要約が無いとき ── 誰が呼んでも同じ「無い」');
// ════════════════════════════════════════════════════════════
{
  const want = J({ ok: true, state: 'none' });
  const a = [await getAs('anon', 'ana'), await getAs(NOKEY, 'ana'), await getAs(KEYED, 'ana'), await getAs(OP, 'ana')];
  ok(a.every((r) => J(r) === want), '未ログイン・鍵なし・鍵あり・運営の4人とも {ok:true, state:"none"}', J(a));
  const z = [await getAs('anon', 'etihad'), await getAs(KEYED, 'etihad'), await getAs('anon', 'eva-air'), await getAs(KEYED, 'eva-air', 'en')];
  ok(z.every((r) => J(r) === want), '口コミが0件の会社（エティハド・エバー）は「無い」── 0点でも空の要約でもない', J(z));

  console.log('  ── 引数が変なとき ──');
  await asAnon();
  ok(J(await rpc('pv_review_summary', { airline: 'no-such-air', lang: 'ja' })) === J({ ok: false, error: 'bad_airline' }), '名簿に無い会社は bad_airline');
  ok(J(await rpc('pv_review_summary', { airline: 'other', lang: 'ja' })) === J({ ok: false, error: 'bad_airline' }), '「その他」は bad_airline');
  ok(J(await rpc('pv_review_summary', { airline: 'cathay', lang: 'ja' })) === J({ ok: false, error: 'bad_airline' }), '古い短いコードでは引けない（bad_airline）');
  ok(J(await rpc('pv_review_summary', {})) === J({ ok: false, error: 'bad_airline' }), '空の引数は bad_airline');
  ok(J(await rpc('pv_review_summary', null)) === J({ ok: false, error: 'bad_airline' }), 'null でも落ちずに bad_airline');
  ok(J(await rpc('pv_review_summary', { airline: 'ana', lang: 'fr' })) === J({ ok: false, error: 'bad_lang' }), '知らない言語は bad_lang');
  ok(J(await rpc('pv_review_summary', { airline: 'ana' })) === J({ ok: false, error: 'bad_lang' }), '言語が無ければ bad_lang');
  ok(J(await rpc('pv_review_summary', { airline: '  ANA ', lang: 'ja' })) === want, '会社コードの前後の空白・大文字はそろえて読む');
  await asOwner();
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 3. 預けられるのは運営だけ');
// ════════════════════════════════════════════════════════════
{
  await asAnon();
  const e0 = await boom(`select public.pv_review_summary_set($1::jsonb)`, [J(anaPayload())]);
  ok(e0 !== null && /permission denied/i.test(e0), '未ログインは預ける関数を呼べない', e0 || '← 呼べてしまった');
  for (const [who, label] of [[NOKEY, '登録だけの会員'], [KEYED, '口コミを出した会員'], [1, 'その会社に口コミを出した本人']]) {
    await asUser(who);
    const e = await boom(`select public.pv_review_summary_set($1::jsonb)`, [J(anaPayload())]);
    ok(e !== null && /管理者ではありません/.test(e), `${label}が呼ぶと「管理者ではありません」で止まる`, e || '← 通ってしまった');
    const e2 = await boom(`select public.pv_review_summary_set($1::jsonb)`, [J({ airline: 'ana', lang: 'ja', good: [], concern: [] })]);
    ok(e2 !== null && /管理者ではありません/.test(e2), `${label}は消すこともできない`, e2 || '← 通ってしまった');
  }
  ok(await stored('ana') === 0, '断られた呼び出しでは1行も入っていない');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 4. 預けるときの検査（運営が呼んでも、線を越えたものは入らない）');
// ════════════════════════════════════════════════════════════
{
  const T = (text) => ({ text, cat: 'wlb', k: 2 });
  const cases = [
    ['口コミの件数が3に満たない（n:2）',          anaPayload({ n: 2 }),                                   'too_few_reviews'],
    ['1件にしか支えられていない点（k:1）',         anaPayload({ good: [G(1)] }),                            'weak_point'],
    ['気になる点のほうだけ k:1',                   anaPayload({ concern: [C(1)] }),                         'weak_point'],
    ['k が 0',                                     anaPayload({ good: [G(0)] }),                            'weak_point'],
    ['k が口コミの件数より多い（k:4・n:3）',       anaPayload({ good: [G(4)] }),                            'bad_k'],
    ['k が整数でない（2.5）',                      anaPayload({ good: [G(2.5)] }),                          'bad_k'],
    ['k が文字（"2"）',                            anaPayload({ good: [G('2')] }),                          'bad_k'],
    ['k が無い',                                   anaPayload({ good: [{ text: G().text, cat: 'training' }] }), 'bad_point'],
    ['良い点が4つ',                                anaPayload({ good: [T('良い点その一という声が複数ある'), T('良い点その二という声が複数ある'), T('良い点その三という声が複数ある'), T('良い点その四という声が複数ある')] }), 'too_many'],
    ['気になる点が4つ',                            anaPayload({ concern: [T('気になる点その一という声が複数'), T('気になる点その二という声が複数'), T('気になる点その三という声が複数'), T('気になる点その四という声が複数')] }), 'too_many'],
    ['91字の文',                                   anaPayload({ good: [T('あ'.repeat(91))] }),              'text_too_long'],
    ['7字の文',                                    anaPayload({ good: [T('あ'.repeat(7))] }),               'text_too_short'],
    ['分類が mgmt（チップに無い）',                anaPayload({ good: [{ ...G(), cat: 'mgmt' }] }),         'bad_cat'],
    ['分類が other',                               anaPayload({ good: [{ ...G(), cat: 'other' }] }),        'bad_cat'],
    ['分類が空',                                   anaPayload({ good: [{ ...G(), cat: '' }] }),             'bad_cat'],
    ['改行の入った文',                             anaPayload({ good: [T('勤務の変更が\n直前に来るという声が複数ある')] }), 'not_plain_text'],
    ['タグの入った文',                             anaPayload({ good: [T('<b>勤務の変更</b>が直前に来るという声が複数')] }), 'not_plain_text'],
    ['前に空白のある文',                           anaPayload({ good: [T(' 勤務の変更が直前に来るという声が複数ある')] }), 'not_plain_text'],
    ['口コミの番号を付けたままの点（reviews）',    anaPayload({ good: [{ ...G(), reviews: [1, 2] }] }),     'bad_point'],
    ['口コミの id を付けたままの点（ids）',        anaPayload({ good: [{ ...G(), ids: [uid(1)] }] }),       'bad_point'],
    ['点が文字列',                                 anaPayload({ good: ['訓練の教え方が丁寧だという声が複数ある'] }), 'bad_point'],
    ['text が数',                                  anaPayload({ good: [{ text: 12345678, cat: 'wlb', k: 2 }] }), 'bad_point'],
    ['good が配列でない',                          anaPayload({ good: { 0: G() } }),                        'bad_shape'],
    ['concern が無い（書き損じ）',                 { airline: 'ana', lang: 'ja', n: 3, newest: NEWEST_ANA, good: [G()] }, 'bad_shape'],
    ['good も concern も無い',                     { airline: 'ana', lang: 'ja' },                          'bad_shape'],
    ['n が文字（"3"）',                            anaPayload({ n: '3' }),                                  'bad_n'],
    ['n が整数でない（3.5）',                      anaPayload({ n: 3.5 }),                                  'bad_n'],
    ['n が無い',                                   { airline: 'ana', lang: 'ja', newest: NEWEST_ANA, good: [G()], concern: [] }, 'bad_n'],
    ['newest が時刻として読めない',                anaPayload({ newest: 'きのう' }),                        'bad_newest'],
    ['newest が無い',                              { airline: 'ana', lang: 'ja', n: 3, good: [G()], concern: [] }, 'bad_newest'],
    ['newest が先の時刻',                          anaPayload({ newest: '2999-01-01T00:00:00Z' }),          'bad_newest'],
    ['件数を盛った（本当は3件なのに n:4）',        anaPayload({ n: 4 }),                                    'stale_input'],
    ['newest が古い（その時刻までには2件しか無い）', anaPayload({ newest: '2026-03-02T00:00:00Z' }),        'stale_input'],
    ['口コミが2件の会社に n:3 と書いて渡す',       { airline: 'peach', lang: 'ja', n: 3, newest: '2026-03-02T00:00:00Z', good: [G()], concern: [] }, 'too_few_reviews'],
    ['口コミが0件の会社（エティハド）',            { airline: 'etihad', lang: 'ja', n: 3, newest: '2026-03-02T00:00:00Z', good: [G()], concern: [] }, 'too_few_reviews'],
    ['口コミが0件の会社（エバー）',                { airline: 'eva-air', lang: 'ja', n: 3, newest: '2026-03-02T00:00:00Z', good: [G()], concern: [] }, 'too_few_reviews'],
    ['名簿に無い会社',                             anaPayload({ airline: 'no-such-air' }),                  'bad_airline'],
    ['「その他」',                                 anaPayload({ airline: 'other' }),                        'bad_airline'],
    ['古い短いコード（cathay）',                   anaPayload({ airline: 'cathay' }),                       'bad_airline'],
    ['知らない言語',                               anaPayload({ lang: 'fr' }),                              'bad_lang'],
    ['英語として預けるには短い文（15字）',         anaPayload({ lang: 'en', good: [T('a'.repeat(15))], concern: [] }), 'text_too_short'],
  ];
  for (const [label, p, want] of cases) {
    const r = await putAs(OP, p);
    ok(J(r) === J({ ok: false, error: want }), `${label} → ${want}`, J(r));
  }
  await asOwner();
  const c = (await one(`select count(*)::int c from public.pv_review_summaries`)).c;
  ok(c === 0, '断られたものは1行も入っていない', `→ ${c}行`);
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 5. 預ける → 読む（鍵のある人にだけ中身が返る）');
// ════════════════════════════════════════════════════════════
let today;
{
  today = (await one(`select to_char(now() at time zone 'utc', 'YYYY-MM-DD') d`)).d;
  const r = await putAs(OP, anaPayload());
  ok(J(r) === J({ ok: true, state: 'saved', airline: 'ana', lang: 'ja', n: 3, as_of: today }), '運営は預けられる', J(r));
  ok(await stored('ana') === 1, '1行入った');

  const locked = J({ ok: true, state: 'locked' });
  ok(J(await getAs('anon', 'ana')) === locked, '未ログインには {ok:true, state:"locked"} だけ');
  ok(J(await getAs(NOKEY, 'ana')) === locked, '登録だけの会員（口コミを出していない）にも locked だけ');

  const open = await getAs(KEYED, 'ana');
  ok(open.state === 'open' && open.ok === true, '口コミを出した会員には中身が返る', J(open));
  ok(J(Object.keys(open).sort()) === J(['as_of', 'concern', 'good', 'n', 'ok', 'state']), '返る鍵は ok・state・n・as_of・good・concern の6つだけ', J(Object.keys(open)));
  ok(open.n === 3 && open.as_of === today, 'n は預けたときの件数・as_of は預けた日', `${open.n} / ${open.as_of}`);
  ok(J(open.good) === J([{ text: G().text, cat: 'training' }]) && J(open.concern) === J([{ text: C().text, cat: 'wlb' }]),
     '点は text と cat の2つだけ（k は返らない）', J(open));
  ok(J(await getAs(OP, 'ana')) === J(open), '運営にも同じものが返る');
  ok(J(await getAs(1, 'ana')) === J(open), 'その会社に口コミを出した本人にも同じものが返る');
  ok(J(await getAs(KEYED, 'ana', 'en')) === J({ ok: true, state: 'none' }), '言語ごとに別 ── 日本語を預けても英語は「無い」');

  /* 鍵の判定が本文と同じ関数であること ── 本文の読め方と1人ずつ突き合わせる。 */
  let same = true;
  for (const who of ['anon', NOKEY, KEYED, OP, 1, 6]) {
    await as(who);
    const body = (await one(`select public.pv_reviews('{"airline":"ana","limit":5}'::jsonb) r`)).r;
    await asOwner();
    const sum = await getAs(who, 'ana');
    if ((body.unlocked === true) !== (sum.state === 'open')) { same = false; console.log(`     ${who}: 本文 ${body.unlocked} / 要約 ${sum.state}`); }
  }
  ok(same, '本文を読める人 ＝ 要約を読める人（6人で突き合わせ）');
  const sqlText = read('db/review-summary.sql');
  const readerSrc = sqlText.slice(sqlText.indexOf('create or replace function public.pv_review_summary(p jsonb)'),
                                  sqlText.indexOf('revoke all on function public.pv_review_summary(jsonb)'));
  ok(/public\.pv_has_review_key\(\)/.test(readerSrc) && !/proof_hash|pv_review_hash|auth\.uid/.test(readerSrc),
     '読む関数は鍵の判定を呼んでいる（写していない）');

  console.log('  ── 片方だけ・入れ直し ──');
  const r2 = await putAs(OP, anaPayload({ good: [G(3), { text: '同僚に相談しやすいという声が複数ある', cat: 'culture', k: 2 }, { text: 'あ'.repeat(90), cat: 'ops', k: 2 }], concern: [] }));
  ok(r2.ok === true && r2.state === 'saved', '良い点だけ（3つ・90字ちょうどを含む）でも預けられる', J(r2));
  ok(await stored('ana') === 1, '同じ会社・同じ言語は上書き（行は1つのまま）');
  const o2 = await getAs(KEYED, 'ana');
  ok(o2.good.length === 3 && J(o2.concern) === '[]' && o2.good[0].cat === 'training' && o2.good[2].text.length === 90, '預けた順のまま返る・気になる点は空の配列', J(o2));
  const r3 = await putAs(OP, anaPayload({ good: [], concern: [{ text: 'あ'.repeat(8), cat: 'salary', k: 3 }] }));
  ok(r3.state === 'saved' && (await getAs(KEYED, 'ana')).good.length === 0, '気になる点だけ（8字ちょうど・k は件数と同じ3）でも預けられる', J(r3));
  await putAs(OP, anaPayload());
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 6. 元の口コミが変わったとき');
// ════════════════════════════════════════════════════════════
{
  /* as_of を過去の日にしておく（「増えただけなら日付は動かない」を見るため）。
     時計の置き場所を東京にして、UTC の日付で出ることも一緒に見る。 */
  await asOwner();
  await db.exec(`update public.pv_review_summaries set made_at = '2026-04-02T03:00:00+09:00' where airline = 'ana'`);
  await db.exec(`set timezone = 'Asia/Tokyo'`);
  const o0 = await getAs(KEYED, 'ana');
  await db.exec(`set timezone = 'UTC'`);
  ok(o0.as_of === '2026-04-01', 'as_of は UTC の日付（東京の 4/2 03:00 ＝ UTC の 4/1）', o0.as_of);

  // 口コミが1件増えた
  await post(8, 'ana', { salary_comment: '手当の説明が分かりにくい。', __at: '2026-03-20T00:00:00Z' });
  const o1 = await getAs(KEYED, 'ana');
  ok(o1.state === 'open' && o1.n === 3 && o1.as_of === '2026-04-01', '口コミが増えただけなら、預けた要約をそのまま返す（n も日付も動かない）', J(o1));
  ok(J(await getAs('anon', 'ana')) === J({ ok: true, state: 'locked' }), '（未ログインには今までどおり locked）');

  // 材料にした1件が消えた（代わりに新しい1件が在るので、合計は3件のまま）
  await asOwner();
  const victim = (await one(`select id from public.reviews_v2 where airline = 'ana' order by created_at limit 1`)).id;
  const saved = await one(`select * from public.reviews_v2 where id = $1`, [victim]);
  await db.query(`delete from public.reviews_v2 where id = $1`, [victim]);
  const none = J({ ok: true, state: 'none' });
  ok(J(await getAs(KEYED, 'ana')) === none, '材料にした口コミが1件消えたら出さない（新しい1件が在って合計3件でも）');
  ok(J(await getAs('anon', 'ana')) === none && J(await getAs(NOKEY, 'ana')) === none, '出さなくなった要約は、鍵の無い人にも「無い」（locked と言わない）');
  ok(await stored('ana') === 1, '行は残っている（読む側が出さないだけ ── 預け直せば戻る）');

  // いまの3件で作り直して預け直す
  const again = await putAs(OP, anaPayload({ newest: '2026-03-20T00:00:00Z' }));
  ok(again.state === 'saved' && (await getAs(KEYED, 'ana')).state === 'open', 'いまの口コミで預け直せば、また出る', J(again));

  // 3件を切った
  await asOwner();
  await db.query(`delete from public.reviews_v2 where airline = 'ana' and created_at = '2026-03-20T00:00:00Z'`);
  ok(J(await getAs(KEYED, 'ana')) === none, '口コミが3件を切ったら出さない');
  ok(J(await putAs(OP, anaPayload({ n: 3 }))) === J({ ok: false, error: 'too_few_reviews' }), '3件を切った会社には預け直せない');

  // 元に戻す（消した1件を同じ時刻で入れ直す）→ また3件・その時刻までに3件
  await asOwner();
  await db.query(`insert into public.reviews_v2(id, proof_hash, airline, culture_comment, training_comment, created_at) values($1,$2,$3,$4,$5,$6)`,
    [saved.id, saved.proof_hash, saved.airline, saved.culture_comment, saved.training_comment, saved.created_at]);
  ok(J(await getAs(KEYED, 'ana')) === none, '消えた1件が戻っても、預けた時刻より前の件数が合わなければ出さない（材料が違う）');
  ok((await putAs(OP, anaPayload())).state === 'saved' && (await getAs(KEYED, 'ana')).state === 'open', '3件に戻った状態で預け直すと出る');

  // 本文を空にした（＝読める口コミではなくなった）
  await asOwner();
  await db.query(`update public.reviews_v2 set culture_comment = '  ', training_comment = null where id = $1`, [saved.id]);
  ok(J(await getAs(KEYED, 'ana')) === none, '材料の1件の本文が空になったら出さない（6分類のどれにも本文が無い行は数えない）');
  await db.query(`update public.reviews_v2 set culture_comment = $2, training_comment = $3 where id = $1`, [saved.id, saved.culture_comment, saved.training_comment]);
  ok((await getAs(KEYED, 'ana')).state === 'open', '本文が戻れば、また出る');

  // 日付を古く書いた1件が足された（口コミは画面から表へ直に入る ＝ 日付は書く側が決められる）
  await post(31, 'ana', { ops_comment: '古い日付で足された1件。', __at: '2026-03-02T06:00:00Z' });
  ok(J(await getAs(KEYED, 'ana')) === none, '古い日付で1件足されたら出さない（材料の集合が預けたときと違う）');
  await asOwner();
  await db.query(`delete from public.reviews_v2 where airline = 'ana' and created_at = '2026-03-01T00:00:00Z'`);
  ok(J(await getAs(KEYED, 'ana')) === none, '★1件消えて、古い日付の1件が足された ── 件数は3のままでも出さない（件数だけで比べていたら出ていた）');
  await db.query(`insert into public.reviews_v2(id, proof_hash, airline, culture_comment, training_comment, created_at) values($1,$2,$3,$4,$5,$6)`,
    [saved.id, saved.proof_hash, saved.airline, saved.culture_comment, saved.training_comment, saved.created_at]);
  await db.query(`delete from public.reviews_v2 where airline = 'ana' and created_at = '2026-03-02T06:00:00Z'`);
  ok((await getAs(KEYED, 'ana')).state === 'open', '材料の3件に戻れば、また出る');
  const sig = await one(`select sig, public.pv_review_summary_sig(array['ana'], newest_at) now_sig from public.pv_review_summaries where airline = 'ana' and lang = 'ja'`);
  ok(/^[0-9a-f]{32}$/.test(sig.sig) && sig.sig === sig.now_sig, '預かっているのは指紋1つ（md5 の32字）── id そのものは表に無い', J(sig));

  // 「経営陣への提案」だけの口コミは件数に入らない
  await post(8, 'ana', { mgmt_comment: '提案だけを書いた口コミ。', __at: '2026-03-02T12:00:00Z' });
  ok((await getAs(KEYED, 'ana')).n === 3 && (await getAs(KEYED, 'ana')).state === 'open', '提案だけの口コミは数えない（チップから辿れない欄）');
  ok(J(await putAs(OP, anaPayload({ n: 4, good: [G(4)] }))) === J({ ok: false, error: 'stale_input' }), '提案だけの1件を足して n:4 とは預けられない');

  // 預けた中身が今の検査を通らなくなった行（規則をあとで厳しくした場合の代わり）
  await asOwner();
  await db.exec(`alter table public.pv_review_summaries drop constraint pv_review_summaries_points_chk`);
  await db.query(`update public.pv_review_summaries set good = $1::jsonb where airline = 'ana'`, [J([{ text: G().text, cat: 'training', k: 1 }])]);
  ok(J(await getAs(KEYED, 'ana')) === none, '検査を通らない行（k:1）は、表に在っても出さない');
  await db.query(`update public.pv_review_summaries set good = $1::jsonb where airline = 'ana'`, [J([{ text: G().text, cat: 'training', k: 2, ids: [uid(1)] }])]);
  ok(J(await getAs(KEYED, 'ana')) === none, '余計な鍵（ids）の付いた行も出さない');
  await db.query(`update public.pv_review_summaries set good = '[]'::jsonb, concern = '[]'::jsonb where airline = 'ana'`);
  ok(J(await getAs(KEYED, 'ana')) === none, '両方とも空の行は「無い」（空の要約を open で返さない）');
  await db.exec(read('db/review-summary.sql'));
  ok(true, '（検査に通らない行が残っていても、SQL はもう一度そのまま流れる）');
  ok((await putAs(OP, anaPayload())).state === 'saved', '預け直して元に戻す');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 7. 消す（空で預ける）');
// ════════════════════════════════════════════════════════════
{
  ok(await stored('ana') === 1, '消す前は1行ある');
  ok(J(await putAs(OP, { airline: 'ana', lang: 'en', good: [], concern: [] })) === J({ ok: true, state: 'deleted' }) && await stored('ana') === 1,
     '別の言語を消しても、日本語の行は残る');
  const r = await putAs(OP, { airline: 'ana', lang: 'ja', good: [], concern: [] });
  ok(J(r) === J({ ok: true, state: 'deleted' }), '良い点・気になる点の両方を空で預けると消える（n も newest も要らない）', J(r));
  ok(await stored('ana') === 0, '行が無くなった');
  ok(J(await getAs(KEYED, 'ana')) === J({ ok: true, state: 'none' }) && J(await getAs('anon', 'ana')) === J({ ok: true, state: 'none' }), '消したあとは誰にも「無い」');
  ok(J(await putAs(OP, { airline: 'ana', lang: 'ja', good: [], concern: [] })) === J({ ok: true, state: 'deleted' }), '無いものを消しても落ちない');
  ok((await putAs(OP, anaPayload())).state === 'saved', '（あとの検査のために預け直す）');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 8. 表は直に読めない・書けない／中の部品は呼べない');
// ════════════════════════════════════════════════════════════
{
  for (const role of ['anon', 'authenticated']) {
    await asOwner();
    if (role === 'authenticated') await asUser(KEYED); else await asAnon();
    const e1 = await boom(`select * from public.pv_review_summaries`);
    ok(e1 !== null && /permission denied/i.test(e1), `${role} は表を直に読めない`, e1 || '← 読めてしまった');
    const e2 = await boom(`select good from public.pv_review_summaries where airline = 'ana'`);
    ok(e2 !== null, `${role} は列を名指ししても読めない`, e2 || '← 読めてしまった');
    const e3 = await boom(`insert into public.pv_review_summaries(airline, lang, n, newest_at, sig, good) values('ana','en',3,now(),'x','[]')`);
    ok(e3 !== null && /permission denied/i.test(e3), `${role} は直に入れられない`, e3 || '← 入ってしまった');
    const e4 = await boom(`update public.pv_review_summaries set n = 99`);
    const e5 = await boom(`delete from public.pv_review_summaries`);
    ok(e4 !== null && e5 !== null, `${role} は直に書き換えも削除もできない`);
    for (const f of [`pv_review_summary_cats()`, `pv_review_summary_codes('ana')`,
                     `pv_review_summary_ids(array['ana'], null)`,
                     `pv_review_summary_count(array['ana'], null)`,
                     `pv_review_summary_sig(array['ana'], null)`,
                     `pv_review_summary_bad('[]'::jsonb, 'ja', 3)`, `pv_review_summary_out('[]'::jsonb)`]) {
      const e = await boom(`select public.${f}`);
      ok(e !== null && /permission denied/i.test(e), `${role} は ${f.replace(/\(.*/, () => '')} を呼べない`, e || '← 呼べてしまった');
    }
  }
  await asOwner();

  /* 2本目の錠 ── うっかり select を配り直しても、RLS で1行も見えない。 */
  await db.exec(`grant select on public.pv_review_summaries to authenticated`);
  await asUser(OP);
  const seen = (await one(`select count(*)::int c from public.pv_review_summaries`)).c;
  await asOwner();
  await db.exec(`revoke select on public.pv_review_summaries from authenticated`);
  ok(seen === 0 && await stored('ana') === 1, '権限を配り直してしまっても、行は1つも見えない（RLS・ポリシー無し）', `→ ${seen}行`);
  const pol = (await one(`select count(*)::int c from pg_policies where schemaname='public' and tablename='pv_review_summaries'`)).c;
  ok(pol === 0, '表にポリシーが1つも無い');

  /* 表そのものの錠 ── SQL Editor から手で入れても、線を越えたものは入らない。 */
  const ins = (n, good) => boom(
    `insert into public.pv_review_summaries(airline, lang, n, newest_at, sig, good) values('jal','ja',$1,now(),'x',$2::jsonb)`, [n, J(good)]);
  ok(/pv_review_summaries_n_chk/.test(await ins(2, [G()]) || ''), '手で入れても n:2 は入らない');
  ok(/pv_review_summaries_points_chk/.test(await ins(3, [G(1)]) || ''), '手で入れても k:1 は入らない');
  ok(/pv_review_summaries_points_chk/.test(await ins(3, [G(), G(), G(), G()]) || ''), '手で入れても4つは入らない');
  ok(/pv_review_summaries_points_chk/.test(await ins(3, []) || ''), '手で入れても、両方とも空の行は入らない');
  /* 手で入れた行は指紋が合わない ＝ 線の内側の中身でも、読む側が出さない。 */
  ok(await ins(3, [G()]) === null && J(await getAs(KEYED, 'jal')) === J({ ok: true, state: 'none' }),
     '手で入れられた行（指紋がでたらめ）は、表に在っても出さない');
  await db.exec(`delete from public.pv_review_summaries where airline = 'jal'`);
  ok(/pv_review_summaries_lang_chk/.test(await boom(`insert into public.pv_review_summaries(airline, lang, n, newest_at, sig, good) values('jal','fr',3,now(),'x',$1::jsonb)`, [J([G()])]) || ''), '手で入れても知らない言語は入らない');
  ok(/foreign key|pv_review_summaries_airline_fkey/.test(await boom(`insert into public.pv_review_summaries(airline, lang, n, newest_at, sig, good) values('no-such-air','ja',3,now(),'x',$1::jsonb)`, [J([G()])]) || ''), '手で入れても名簿に無い会社は入らない');

  const chk = await rows(read('db/review-summary.sql').slice(read('db/review-summary.sql').lastIndexOf("select '表は anon")));
  ok(chk.length === 4 && chk.every((r) => r['結果'] === '✅'), 'ファイル末尾の検算が4行とも ✅', J(chk));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 9. 古い短い会社コードの口コミも数える（会社ページと同じ引き方）');
// ════════════════════════════════════════════════════════════
{
  const p = { airline: 'cathay-pacific', lang: 'ja', n: 3, newest: '2026-03-03T00:00:00Z',
              good: [{ text: '運航の支援が手厚いという声が複数ある', cat: 'ops', k: 2 }], concern: [] };
  const r = await putAs(OP, p);
  ok(r.ok === true && r.state === 'saved' && r.n === 3, '古いコード2件＋いまのコード1件 ＝ 3件として預けられる', J(r));
  await as(KEYED);
  const page = (await one(`select public.pv_reviews('{"airlines":["cathay-pacific","cathay"],"limit":500}'::jsonb) r`)).r;
  await asOwner();
  ok(page.rows.length === 3 && (await getAs(KEYED, 'cathay-pacific')).n === 3, '会社ページが引く件数（3）と要約の n（3）が同じ');
  await db.query(`delete from public.reviews_v2 where airline = 'cathay' and created_at = '2026-03-01T00:00:00Z'`);
  ok(J(await getAs(KEYED, 'cathay-pacific')) === J({ ok: true, state: 'none' }), '古いコードの1件が消えても出さなくなる');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 10. 英語');
// ════════════════════════════════════════════════════════════
{
  const en = { text: 'Several pilots mention that rosters change at short notice.', cat: 'wlb', k: 2 };
  const r = await putAs(OP, { airline: 'ana', lang: 'en', n: 3, newest: NEWEST_ANA, good: [], concern: [en] });
  ok(r.state === 'saved' && r.lang === 'en', '英語の要約は日本語とは別に預かる', J(r));
  const o = await getAs(KEYED, 'ana', 'en');
  ok(o.state === 'open' && J(o.concern) === J([{ text: en.text, cat: 'wlb' }]) && J(o.good) === '[]', '英語で読める', J(o));
  ok((await getAs(KEYED, 'ana', 'ja')).good[0].text === G().text, '日本語のほうはそのまま');
  ok(J(await getAs('anon', 'ana', 'en')) === J({ ok: true, state: 'locked' }), '英語も、鍵の無い人には locked だけ');
  ok(J(await putAs(OP, { airline: 'ana', lang: 'en', n: 3, newest: NEWEST_ANA, good: [{ ...en, text: 'x'.repeat(181) }], concern: [] })) === J({ ok: false, error: 'text_too_long' }), '英語は181字で断る');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 11. gen-review-summary.mjs の出力が、そのまま預けられる');
// ════════════════════════════════════════════════════════════
{
  // jal に4件。時刻はマイクロ秒つき（本番の created_at と同じ細かさ）
  await post(21, 'jal', { culture_comment: '相談しやすい職場です。', training_comment: '訓練の説明が丁寧。', position: 'captain', fleet: 'B787', __at: '2026-03-10T01:02:03.000111Z' });
  await post(22, 'jal', { training_comment: '教官が丁寧に教えてくれる。', wlb_comment: '勤務表が出るのが遅い。', __at: '2026-03-11T01:02:03.000222Z' });
  await post(23, 'jal', { wlb_comment: '勤務表の発表が遅いと感じる。', __at: '2026-03-12T01:02:03.000333Z' });
  await post(24, 'jal', { culture_comment: '分からないことを聞きやすい。', mgmt_comment: '提案です。', __at: '2026-03-12T01:02:03.000456Z' });
  await post(OP, 'jal', { mgmt_comment: '提案だけの1件。', __at: '2026-03-13T00:00:00Z' });

  // 運営として、会社ページと同じ関数から口コミの束を取る
  await asUser(OP);
  const bundle = (await one(`select public.pv_reviews('{"airlines":["jal"],"limit":500}'::jsonb) r`)).r;
  await asOwner();
  const inp = buildInput(bundle.rows, { airline: 'jal', lang: 'ja' });
  ok(inp.n === 4 && inp.seen === 5, '束から材料にする口コミを数える（提案だけの1件は数えない）', `n=${inp.n} seen=${inp.seen}`);
  ok(/\.000456/.test(String(inp.newest)), 'いちばん新しい時刻をマイクロ秒つきの字のまま持つ', String(inp.newest));

  // モデルの返事の代わり（番号は buildInput が振った 1〜4）
  const idxOf = (re) => inp.reviews.filter((r) => re.test(Object.values(r.cats).join(' '))).map((r) => r.i);
  const reply = {
    good: [
      { text: '訓練の教え方が丁寧だという声が複数ある', cat: 'training', reviews: idxOf(/丁寧/) },
      { text: '分からないことを聞きやすいという声が複数ある', cat: 'culture', reviews: idxOf(/相談しやすい|聞きやすい/) },
      { text: '提案を聞いてもらえるという声がある', cat: 'culture', reviews: [1] },
    ],
    concern: [{ text: '勤務表が出るのが遅いという声が複数ある', cat: 'wlb', reviews: idxOf(/勤務表/) }],
  };
  const settled = settle(reply, { lang: 'ja', n: inp.n });
  const payload = payloadOf({ airline: 'jal', lang: 'ja', n: inp.n, newest: inp.newest }, settled);
  ok(payload.good.length === 2 && payload.concern.length === 1 && payload.good.every((p) => p.k === 2), '検品を通った点だけが残る（1件だけの点は落ちる）', J(payload));
  const r = await putAs(OP, payload);
  ok(r.ok === true && r.state === 'saved' && r.n === 4, '道具の出力を1文字も直さずに預けられる（件数と時刻がサーバの数え直しと合う）', J(r));
  const o = await getAs(KEYED, 'jal');
  ok(o.state === 'open' && o.n === 4 && o.good.length === 2 && o.concern.length === 1, '預けたものが読める', J(o));

  // 罠 ── 時刻をミリ秒に丸めた束は断られる（いちばん新しい1件が「その時刻より後」になる）
  const rounded = { ...payload, newest: new Date(Date.parse(inp.newest)).toISOString() };
  ok(J(await putAs(OP, rounded)) === J({ ok: false, error: 'stale_input' }), '時刻をミリ秒に丸めた束は stale_input で断る（盛れない代わりに、束は字のまま渡す）');

  // 鍵の無い立場で取った束には本文が無い ＝ 材料が0件
  await asUser(NOKEY);
  const shut = (await one(`select public.pv_reviews('{"airlines":["jal"],"limit":500}'::jsonb) r`)).r;
  await asOwner();
  ok(buildInput(shut.rows, { airline: 'jal', lang: 'ja' }).n === 0, '鍵の無い立場で取った束からは、要約を作れない（本文が来ていない）');

  const st = await selftest(() => {});
  ok(st.fail === 0 && st.pass > 30, `gen-review-summary.mjs の検品（--selftest と同じもの）が全部通る`, `${st.pass} pass / ${st.fail} fail`);
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 12. どの返り値にも、口コミの id・書いた人・k が1つも出ていない');
// ════════════════════════════════════════════════════════════
{
  await asOwner();
  const ids = (await rows(`select id::text, proof_hash from public.reviews_v2`)).flatMap((r) => [r.id, r.proof_hash]);
  const all = RETURNS.map((x) => J(x.r));
  ok(RETURNS.length > 100, `集めた返り値は ${RETURNS.length} 個`);
  ok(!all.some((s) => /"k"\s*:/.test(s)), 'k という鍵がどこにも無い');
  ok(!all.some((s) => ids.some((v) => s.includes(v))), '口コミの id も proof_hash もどこにも無い');
  ok(!all.some((s) => /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(s)), 'uuid の形の字がどこにも無い');
  ok(!all.some((s) => /"(newest|newest_at|reviews|ids|id|sig|proof_hash|made_at|user_id)"\s*:/.test(s)), '材料の時刻・番号・指紋・書いた人に当たる鍵がどこにも無い');
  ok(!all.some((s) => /[0-9a-f]{32}/.test(s)), '指紋（md5 の32字）の形の字がどこにも無い');
  const keys = new Set();
  for (const x of RETURNS) for (const k of Object.keys(x.r || {})) keys.add(k);
  ok(J([...keys].sort()) === J(['airline', 'as_of', 'concern', 'error', 'good', 'lang', 'n', 'ok', 'state']),
     '2つの関数が返す鍵は全部で9種類だけ', J([...keys].sort()));
  const states = new Set(RETURNS.filter((x) => x.fn === 'pv_review_summary' && x.r.ok).map((x) => x.r.state));
  ok(J([...states].sort()) === J(['locked', 'none', 'open']), '読む関数の state は locked・none・open の3つだけ', J([...states]));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 13. 冪等性（行が入った状態で、もう一度そのまま流す）');
// ════════════════════════════════════════════════════════════
{
  await asOwner();
  const before = J(await rows(`select airline, lang, n, good, concern, made_at from public.pv_review_summaries order by 1, 2`));
  for (const f of FILES) {
    try { await db.exec(read(f)); pass++; console.log(`  ✅ ${f} 再適用OK`); }
    catch (e) { console.log(`  ❌ ${f} 再適用で失敗\n     ${e.message}`); fail++; }
  }
  const after = J(await rows(`select airline, lang, n, good, concern, made_at from public.pv_review_summaries order by 1, 2`));
  ok(before === after && JSON.parse(after).length >= 3, '流し直しても、預かっている要約は1文字も変わらない');
  await asAnon();
  const e = await boom(`select * from public.pv_review_summaries`);
  await asOwner();
  ok(e !== null, '流し直したあとも、表は直に読めない');
  ok((await getAs(KEYED, 'jal')).state === 'open' && J(await getAs('anon', 'jal')) === J({ ok: true, state: 'locked' }), '流し直したあとも、読める人・読めない人は同じ');
}

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
