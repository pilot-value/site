/* db/test-review-summary.mjs — 口コミの要約（db/review-summary.sql）が約束どおりに
   預かり・確かめ・返しているかを、本物の Postgres（PGlite）で実際に呼んで確かめる。

   実行: node db/test-review-summary.mjs   （手で流す。check.mjs の一覧には入っていない）
   ネットワーク不要・本番に一切触らない・Anthropic も呼ばない。

   なぜ要るか
     要約は「数人の感想を、会社の顔として1か所に大きく出す」部品。間違えたときの害が
     口コミ1件より大きい。なので守る線を全部サーバ側に置いてあり、ここがその線を1本ずつ踏む。
       ・本文を読めない人に、要約が1文字も返らない（判定は本文と同じ関数）
       ・要約が無いときの返事が、鍵の有無で変わらない
       ・3件に満たない会社／1件にしか支えられていない点／4つ以上／長すぎる文は入らない
       ・元の口コミが消えたら出さない（削除依頼で消した中身が要約に残らない）
       ・どの口コミが材料か（id）も、何件が支えたか（k）も、外へ出ない
       ・書けるのは運営と、サーバの鍵を持つ自動の道だけ・表は直に読めない
       ・自動の道（14〜）は、変わっていなければ材料を渡さない／同じ集合に二度払わせない／
         古い集合から作った要約で、新しい集合の要約を上書きさせない
       ・Webhook を作る1枚（17・db/review-summary-webhook.sql）は、翻訳と通知の Webhook に
         1文字も触らない／何度流しても1本／キーを画面に出さない
       ・関数の本体（supabase/functions/summarize-reviews/index.ts）が呼ぶ名前・渡す形と、
         SQL が受ける名前・返す形が合っている（18・両方を実際につないで通す。身代わりはモデルの返事だけ）

   ★SQL の置き場は PV_REVIEW_SUMMARY_SQL で差し替えられる（既定はリポジトリの db/review-summary.sql）。
     書きかけの1枚を、ほかの道具が読んでいるリポジトリの1枚を汚さずに確かめるため。
       PV_REVIEW_SUMMARY_SQL=/どこか/review-summary.sql node db/test-review-summary.mjs

   ⚠️ 字面では捕まらないものを見ている。revoke と書いてあっても、表ぜんぶの権限が
      残っていれば読める（db/test-reviews-gate.mjs と同じ罠）。だから実際に select する。

   ★写しの突き合わせもここ。分類の鍵・古い会社コード・字数は、SQL と画面と
     要約を作る側（supabase/functions/summarize-reviews/index.ts。
     gen-review-summary.mjs はそれを読んで同じ名前で出し直している）に同じものが在る。
     片方だけ直すと黙って食い違う。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import { CATS, LIMITS, LEGACY_OF, MAX_POINTS, MIN_REVIEWS, MIN_SUPPORT,
         buildInput, settle, payloadOf, selftest } from '../gen-review-summary.mjs';

const SUMMARY_SQL = 'db/review-summary.sql';
const SUMMARY_SQL_AT = process.env.PV_REVIEW_SUMMARY_SQL || '';
const read = (f) => (f === SUMMARY_SQL && SUMMARY_SQL_AT)
  ? readFileSync(SUMMARY_SQL_AT, 'utf8')
  : readFileSync(new URL('../' + f, import.meta.url), 'utf8');
if (SUMMARY_SQL_AT) console.log('（db/review-summary.sql の代わりに、PV_REVIEW_SUMMARY_SQL の1枚を読みます）');
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

  /* ★サーバの鍵の役。**既定権限は配らない** ── 自動の道（14〜）を呼べるのは、
     SQL が名指しで grant したからだ、と言える形にしておく。 */
  create role service_role;
  grant usage on schema public, extensions to service_role;
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
/* ana の3件の口コミの id（古い順）。uid(n) は会員の id で、口コミの id ではない。 */
await asOwner();
const [R1, R2, R3] = (await rows(`select id::text from public.reviews_v2 where airline = 'ana' order by created_at`)).map((r) => r.id);
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
/* 数・金額の入った文（SQL の has_figure と、作る側の検品の両方で落ちる）。4 と 11 が同じこれを使う。
   NOT_FIGURE は「円」の字があっても金額ではない文 ── どちらも通す。 */
const FIGURES = ['年収が高いという声が2件ある', '年収が高いという声が２件ある', '手当が$出るという声が複数ある', '手当が三千万円あるという声が複数ある'];
const NOT_FIGURE = '円滑に進むという声が複数ある';


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
console.log('\n▼ 2. 預かった要約が無いとき ── 3件以上なら誰が呼んでも同じ「無い」／3件に満たない会社は誰が呼んでも同じ「少ない」');
// ════════════════════════════════════════════════════════════
{
  const want = J({ ok: true, state: 'none' });
  const a = [await getAs('anon', 'ana'), await getAs(NOKEY, 'ana'), await getAs(KEYED, 'ana'), await getAs(OP, 'ana')];
  ok(a.every((r) => J(r) === want), '未ログイン・鍵なし・鍵あり・運営の4人とも {ok:true, state:"none"}', J(a));
  const z = [await getAs('anon', 'etihad'), await getAs(KEYED, 'etihad'), await getAs('anon', 'eva-air'), await getAs(KEYED, 'eva-air', 'en')];
  ok(z.every((r) => J(r) === J({ ok: true, state: 'few' })), '口コミが0件の会社（エティハド・エバー）は「少ない」（few）── 0点でも空の要約でもない', J(z));
  /* skymark は1件・peach は2件（どちらも3件に満たない）、ana は3件で預かった行が無い。 */
  const fz = [];
  for (const air of ['skymark', 'peach']) for (const who of ['anon', NOKEY, KEYED]) fz.push(await getAs(who, air));
  const nz = [await getAs('anon', 'ana'), await getAs(NOKEY, 'ana'), await getAs(KEYED, 'ana')];
  ok(fz.length === 6 && fz.every((r) => J(r) === J({ ok: true, state: 'few' })) && nz.every((r) => J(r) === want),
     'few と none は、鍵のある人・無い人・未ログインで同じ', J({ fz, nz }));

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
    ...FIGURES.map((f) => [`数・金額の入った文（${f}）`, anaPayload({ good: [T(f)] }), 'has_figure']),
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
  const nf = (await one(`select public.pv_review_summary_bad($1::jsonb, 'ja', 3) e`, [J([T(NOT_FIGURE)])])).e;
  ok(nf === null, `「円」の字があっても金額でない文（${NOT_FIGURE}）は通る`, nf);
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
  ok(J(await getAs('anon', 'ana')) === J({ ok: true, state: 'login' }), '未ログインには {ok:true, state:"login"} だけ');
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
  const four = [['login', await getAs('anon', 'ana')], ['locked', await getAs(NOKEY, 'ana')],
                ['few', await getAs(KEYED, 'etihad')], ['none', await getAs(KEYED, 'ana', 'en')]];
  ok(four.every(([st, x]) => Object.keys(x).sort().join() === 'ok,state' && x.ok === true && x.state === st),
     'login・locked・few・none の返事は {ok, state} の2つだけ（点も件数も id も無い）', J(four));

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
  ok(/public\.pv_has_review_key\(\)/.test(readerSrc) && !/proof_hash|pv_review_hash/.test(readerSrc) && (readerSrc.match(/auth\.uid\(\)/g) || []).length === 1 && /auth\.uid\(\) is null/.test(readerSrc),
     '読む関数は鍵の判定を呼んでいる（写していない）');

  console.log('  ── 片方だけ・入れ直し ──');
  const r2 = await putAs(OP, anaPayload({ good: [G(3), { text: '同僚に相談しやすいという声が複数ある', cat: 'culture', k: 2 }, { text: 'あ'.repeat(90), cat: 'ops', k: 2 }], concern: [] }));
  ok(r2.ok === true && r2.state === 'saved', '良い点だけ（3つ・90字ちょうどを含む）でも預けられる', J(r2));
  ok(await stored('ana') === 1, '同じ会社・同じ言語は上書き（行は1つのまま）');
  const o2 = await getAs(KEYED, 'ana');
  /* ★返事に good が無い（open でない）ときも落ちずに ❌ を出す ── そのあとの検査まで走らせるため。 */
  ok(o2.good?.length === 3 && J(o2.concern) === '[]' && o2.good?.[0]?.cat === 'training' && o2.good?.[2]?.text?.length === 90, '預けた順のまま返る・気になる点は空の配列', J(o2));
  const r3 = await putAs(OP, anaPayload({ good: [], concern: [{ text: 'あ'.repeat(8), cat: 'salary', k: 3 }] }));
  ok(r3.state === 'saved' && (await getAs(KEYED, 'ana')).good?.length === 0, '気になる点だけ（8字ちょうど・k は件数と同じ3）でも預けられる', J(r3));
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
  ok(J(await getAs('anon', 'ana')) === J({ ok: true, state: 'login' }), '（未ログインには今までどおり login）');

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
  ok(J(await getAs(KEYED, 'ana')) === J({ ok: true, state: 'few' }), '口コミが3件を切ったら出さない（few）');
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
  ok(J(await getAs(KEYED, 'ana')) === J({ ok: true, state: 'few' }), '材料の1件の本文が空になったら出さない（6分類のどれにも本文が無い行は数えない）（few）');
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
  const sig = await one(`select sig, public.pv_review_summary_sig(array['ana'], newest_at, 'ja') now_sig from public.pv_review_summaries where airline = 'ana' and lang = 'ja'`);
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

  /* ★指紋は id の集合だけでなく中身も見る（同じ id のまま本文が書き換わったら、その要約は出さない）。
     1段ずつ begin … rollback の中で動かす ── ana の口コミと預けた要約は、あとの節もそのまま使う。
     （rollback は中で切り替えた役も戻すので、そのあとにもう一度 asOwner を呼ぶ） */
  console.log('  ── 指紋は本文と、要約の言語の訳を見る（点数・ほかの言語の訳は見ない）──');
  const needAna = async () => { await asOwner(); return (await rows(`select public.pv_review_summary_need('ana', 'ja') as v`))[0].v; };
  let rd, nd;

  await asOwner(); await db.exec(`begin`);
  await db.query(`update public.reviews_v2 set training_comment = training_comment || '（追記）' where id = $1`, [R1]);
  rd = await getAs(KEYED, 'ana'); nd = await needAna();
  ok(J(rd) === none, 'a) 材料の1件の本文を書き換えたら（id は同じまま）出さない', J(rd));
  ok(nd === 'stale', 'a) 本文を書き換えたら、作り直しが要る（stale）', nd);
  await db.exec(`rollback`); await asOwner();

  await asOwner(); await db.exec(`begin`);
  await db.query(`update public.reviews_v2 set wlb_score = 1 where id = $1`, [R2]);
  rd = await getAs(KEYED, 'ana'); nd = await needAna();
  ok(rd.state === 'open', 'b) 点数だけ変わっても、預けた要約をそのまま返す', J(rd));
  ok(nd === 'fresh', 'b) 点数だけなら、作り直さない（fresh ＝ モデルを呼ばない）', nd);
  await db.exec(`rollback`); await asOwner();

  await asOwner(); await db.exec(`begin`);
  await db.query(`update public.reviews_v2 set translations = '{"en":{"wlb":"x"}}'::jsonb where id = $1`, [R2]);
  rd = await getAs(KEYED, 'ana'); nd = await needAna();
  ok(rd.state === 'open', 'c) 日本語の口コミにほかの言語（en）の訳が入っても、日本語の要約はそのまま返す', J(rd));
  ok(nd === 'fresh', 'c) ほかの言語の訳だけなら、日本語の要約は作り直さない（fresh）', nd);
  await db.exec(`rollback`); await asOwner();

  await asOwner(); await db.exec(`begin`);
  await db.query(`update public.reviews_v2 set orig_lang = 'en' where id = $1`, [R2]);
  await db.query(`update public.reviews_v2 set translations = '{"ja":{"wlb":"訳"}}'::jsonb where id = $1`, [R2]);
  rd = await getAs(KEYED, 'ana'); nd = await needAna();
  ok(J(rd) === none, 'd) ほかの言語で書かれた材料に、要約の言語（ja）の訳が入ったら出さない', J(rd));
  ok(nd === 'stale', 'd) 要約の言語の訳が入ったら、作り直しが要る（stale）', nd);
  await db.exec(`rollback`); await asOwner();

  rd = await getAs(KEYED, 'ana'); nd = await needAna();
  ok(rd.state === 'open' && nd === 'fresh',
     '（a〜d のあと: ana は鍵のある人に open・作り直しは要らない（fresh）── どの段も何も残していない）', J({ rd, nd }));
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
                     `pv_review_summary_sig(array['ana'], null, 'ja')`,
                     `pv_review_summary_marks(array['ana'], null, 'ja')`,
                     `pv_review_summary_bad('[]'::jsonb, 'ja', 3)`, `pv_review_summary_out('[]'::jsonb)`,
                     `pv_review_summary_put('{}'::jsonb)`, `pv_review_summary_need('ana', 'ja')`]) {
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
  ok(await ins(3, [G()]) === null && J(await getAs(KEYED, 'jal')) === J({ ok: true, state: 'few' }),
     '手で入れられた行（指紋がでたらめ）は、表に在っても出さない（口コミの無い会社は few）');
  await db.exec(`delete from public.pv_review_summaries where airline = 'jal'`);
  ok(/pv_review_summaries_lang_chk/.test(await boom(`insert into public.pv_review_summaries(airline, lang, n, newest_at, sig, good) values('jal','fr',3,now(),'x',$1::jsonb)`, [J([G()])]) || ''), '手で入れても知らない言語は入らない');
  ok(/foreign key|pv_review_summaries_airline_fkey/.test(await boom(`insert into public.pv_review_summaries(airline, lang, n, newest_at, sig, good) values('no-such-air','ja',3,now(),'x',$1::jsonb)`, [J([G()])]) || ''), '手で入れても名簿に無い会社は入らない');

  const chk = await rows(read('db/review-summary.sql').slice(read('db/review-summary.sql').lastIndexOf("select '表は anon")));
  ok(chk.length === 6 && chk.every((r) => r['結果'] === '✅'), 'ファイル末尾の検算が6行とも ✅', J(chk));
}
{
  await asOwner();
  const e = await boom(
    `insert into public.pv_review_summaries(airline, lang, n, newest_at, sig, good) values('cathay-pacific','ja',3,now(),'x',$1::jsonb)`, [J([G()])]);
  const z = [await getAs('anon', 'cathay-pacific'), await getAs(NOKEY, 'cathay-pacific'), await getAs(KEYED, 'cathay-pacific')];
  ok(e === null && z.every((r) => J(r) === J({ ok: true, state: 'none' })),
    '3件以上あって預かった行の指紋が合わない会社は、未ログイン・鍵なし・鍵ありの3人とも {ok:true, state:"none"}', J(z));
  await db.exec(`delete from public.pv_review_summaries where airline = 'cathay-pacific'`);
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
  ok(J(await getAs(KEYED, 'cathay-pacific')) === J({ ok: true, state: 'few' }), '古いコードの1件が消えても出さなくなる（few）');
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

  /* ★指紋は言語ごと（決めごと L4）。読む側も預ける側も、その要約の言語で指紋を取る。
     日本語で書かれた口コミに英語の訳が入ると、英語の指紋だけが変わる。begin … rollback の中で動かす。 */
  const needEn = async () => { await asOwner(); return (await rows(`select public.pv_review_summary_need('ana', 'en') as v`))[0].v; };
  await asOwner(); await db.exec(`begin`);
  await db.query(`update public.reviews_v2 set translations = '{"en":{"training":"x"}}'::jsonb where id = $1`, [R1]);
  const oe = await getAs(KEYED, 'ana', 'en'), ne = await needEn();
  ok(J(oe) === J({ ok: true, state: 'none' }), '材料（日本語）に英語の訳が入ったら、英語の要約は出さない（英語の指紋で比べる）', J(oe));
  ok(ne === 'stale', '英語の訳が入ったら、英語の要約は作り直しが要る（stale）', ne);
  const rj = await putAs(OP, anaPayload());
  const oj = await getAs(KEYED, 'ana', 'ja');
  ok(rj.state === 'saved' && oj.state === 'open',
     '英語の訳が在るまま日本語の要約を預け直しても、日本語の要約は出る（日本語の指紋で預ける）', J({ rj, oj }));
  await db.exec(`rollback`); await asOwner();
  const oe2 = await getAs(KEYED, 'ana', 'en'), ne2 = await needEn();
  ok(oe2.state === 'open' && ne2 === 'fresh', '（訳を戻したあと: 英語の要約は open・作り直しは要らない（fresh））', J({ oe2, ne2 }));

  ok((await getAs(KEYED, 'ana', 'ja')).good[0].text === G().text, '日本語のほうはそのまま');
  ok(J(await getAs('anon', 'ana', 'en')) === J({ ok: true, state: 'login' }), '英語も、未ログインには login だけ');
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
  /* 4 で SQL が has_figure で断る文は、作る側の検品でも同じ語で落ちる（FIGURES は同じ1つ）。 */
  const figs = FIGURES.map((text) => settle({ good: [{ text, cat: 'wlb', reviews: [1, 2] }], concern: [] }, { lang: 'ja', n: 3 }));
  ok(figs.every((s) => s.good.length === 0 && s.dropped.length === 1 && s.dropped[0].why === 'has_figure'),
     `数・金額の入った${FIGURES.length}つの文は、作る側の検品でも has_figure で落ちる`, J(figs.map((s) => s.dropped)));
  const plain = settle({ good: [{ text: NOT_FIGURE, cat: 'wlb', reviews: [1, 2] }], concern: [] }, { lang: 'ja', n: 3 });
  ok(plain.good.length === 1 && plain.dropped.length === 0, `「円」の字があっても金額でない文（${NOT_FIGURE}）は、作る側の検品も通る`, J(plain));
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
  ok(J([...states].sort()) === J(['few', 'locked', 'login', 'none', 'open']), '読む関数の state は few・locked・login・none・open の5つだけ', J([...states]));
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
  ok((await getAs(KEYED, 'jal')).state === 'open' && J(await getAs('anon', 'jal')) === J({ ok: true, state: 'login' }), '流し直したあとも、読める人・読めない人は同じ');
}

// ════════════════════════════════════════════════════════════
// ここから下は「自動の道」（db/review-summary.sql の 6 の節）。
// Edge Function の summarize-reviews が、サーバの鍵で呼ぶ4本を実際に呼ぶ。
//   ★ここの返り値は RETURNS に入れない。指紋（basis）と材料の本文が返る道で、
//     12 が見ているのは会員に返る2本。会員から呼べないことは 14 で先に確かめる。
//   ★モデルは呼ばない。返事の代わりを手で作り、本物の検品（settle）に通す。
// ════════════════════════════════════════════════════════════
const asService = async () => {
  await db.exec(`reset role`);
  await db.query(`select set_config('pv.uid', '', false)`);
  await db.exec(`set role service_role`);
};
const svc = async (fn, p) => {
  await asService();
  try { return (await one(`select public.${fn}($1::jsonb) r`, [J(p)])).r; }
  finally { await asOwner(); }
};
const refused = async (who, sql, params) => {
  if (who === 'service') await asService(); else await as(who);
  const e = await boom(sql, params);
  await asOwner();
  return e;
};
const take = (airline, lang = 'ja') => svc('pv_review_summary_take', { airline, lang });
const done = (airline, basis, state, lang = 'ja') => svc('pv_review_summary_done', { airline, lang, basis, state });
const dueOf = (airline, langs = ['ja']) => svc('pv_review_summary_due', airline ? { airline, langs } : { langs });
/* 控えの1行（無ければ null）。 */
const run = async (airline, lang = 'ja') => {
  await asOwner();
  return (await one(`select sig, n, state, tries from public.pv_review_summary_runs where airline=$1 and lang=$2`, [airline, lang])) || null;
};
/* 時計を進める代わりに、控えの時刻を戻す。 */
const rewind = async (airline, minutes, lang = 'ja') => {
  await asOwner();
  await db.query(`update public.pv_review_summary_runs set ran_at = now() - make_interval(mins => $3::int) where airline=$1 and lang=$2`, [airline, lang, minutes]);
};
const A_STAR = 'starflyer';
const SVC = ['pv_review_summary_due', 'pv_review_summary_take', 'pv_review_summary_set_auto', 'pv_review_summary_done'];
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
for (const n of [41, 42, 43, 44, 45, 46, 47, 51, 52, 53, 61, 62, 63]) await mkUser(n);
await asOwner();


// ════════════════════════════════════════════════════════════
console.log('\n▼ 14. 自動の道は、サーバの鍵でしか呼べない');
// ════════════════════════════════════════════════════════════
{
  const arg = { airline: 'no-such-air', lang: 'ja', langs: ['ja'], basis: '0'.repeat(32), state: 'released', good: [], concern: [] };
  for (const [who, label] of [['anon', '未ログイン'], [KEYED, '会員'], [OP, '運営（ページから ＝ 会員の鍵）']]) {
    for (const fn of SVC) {
      const e = await refused(who, `select public.${fn}($1::jsonb)`, [J(arg)]);
      ok(e !== null && /permission denied/i.test(e), `${label} は ${fn} を呼べない`, e || '← 呼べてしまった');
    }
  }
  for (const fn of SVC) {
    const e = await refused('service', `select public.${fn}($1::jsonb)`, [J(arg)]);
    ok(e === null, `サーバの鍵は ${fn} を呼べる`, e || '');
  }
  /* ここの service_role には既定の権限を配っていない ＝ 通ったのは SQL が名指しで配った4本だけ。
     （Supabase の service_role は元から何でもできる鍵。ここで見ているのは「SQL が何を配ったか」） */
  for (const f of [`pv_review_summary_put('{}'::jsonb)`, `pv_review_summary_need('ana', 'ja')`]) {
    const e = await refused('service', `select public.${f}`);
    ok(e !== null && /permission denied/i.test(e), `SQL は ${f.replace(/\(.*/, () => '')} を誰にも（サーバの鍵にも）名指しで配っていない`, e || '← 呼べてしまった');
  }

  for (const [who, label] of [['anon', '未ログイン'], [KEYED, '会員'], [OP, '運営（ページから）']]) {
    const e1 = await refused(who, `select * from public.pv_review_summary_runs`);
    const e2 = await refused(who, `insert into public.pv_review_summary_runs(airline, lang, sig, n, state) values('ana','ja','x',3,'saved')`);
    const e3 = await refused(who, `delete from public.pv_review_summary_runs`);
    ok([e1, e2, e3].every((e) => e !== null && /permission denied/i.test(e)), `${label} は控えの表を直に読めない・書けない`, J([e1, e2, e3]));
  }
  const rls = await one(`select c.relrowsecurity r,
      (select count(*)::int from pg_policies q where q.schemaname='public' and q.tablename='pv_review_summary_runs') p
    from pg_class c where c.oid = 'public.pv_review_summary_runs'::regclass`);
  ok(rls.r === true && rls.p === 0, '控えの表にも RLS が掛かっていて、ポリシーは1つも無い', J(rls));

  /* 検査して入れる本体は1つ。運営の道と自動の道は、門が違うだけ。 */
  const sqlText = read('db/review-summary.sql');
  const bodyOf = (name) => {
    const a = sqlText.indexOf(`create or replace function public.${name}(p jsonb)`);
    return a < 0 ? '' : sqlText.slice(a, sqlText.indexOf('$fn$;', a));
  };
  const writes = /(insert\s+into|delete\s+from|update)\s+public\.pv_review_summaries\b/;
  const put = bodyOf('pv_review_summary_put'), set = bodyOf('pv_review_summary_set'), auto = bodyOf('pv_review_summary_set_auto');
  ok(writes.test(put) && /pv_review_summary_bad\(/.test(put) && !/pv_is_operator/.test(put), '要約の表に書くのは、中の1本（検査もそこ・誰が呼んだかは見ない）');
  ok(set !== '' && !writes.test(set) && /public\.pv_review_summary_put\(/.test(set) && /pv_is_operator\(\)/.test(set) && !/pv_review_summary_bad\(/.test(set),
     '運営の道は、門を見てから中の1本を呼ぶだけ（自分では書かない・検査を写していない）');
  ok(auto !== '' && !writes.test(auto) && /public\.pv_review_summary_put\(/.test(auto) && !/pv_review_summary_bad\(/.test(auto),
     '自動の道も、同じ中の1本を呼ぶだけ（自分では書かない・検査を写していない）');
  ok(sqlText.split(/insert\s+into\s+public\.pv_review_summaries\b/).length === 2, '要約の表への insert は、ファイル全体で1か所だけ');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 15. 作り直しが要るかは DB が決める（変わっていなければ材料を渡さない）');
// ════════════════════════════════════════════════════════════
{
  const A = 'starflyer';
  const d0 = await dueOf(A);
  ok(J(d0) === J({ ok: true, checked: 0, due: [] }), '口コミも要約も無い会社は、見もしない', J(d0));
  await post(41, A, { culture_comment: '少人数で顔が見える職場です。', training_comment: '訓練は細かく見てもらえる。',
                      mgmt_comment: '経営陣への提案です。', position: 'captain', fleet: 'A320', tenure_bucket: '10-15',
                      __at: '2026-04-01T00:00:00.000101Z' });
  await post(42, A, { training_comment: '訓練で細かく見てもらえた。', wlb_comment: '休みの希望が通りにくい。', __at: '2026-04-02T00:00:00.000202Z' });
  const d2 = await dueOf(A);
  ok(J(d2) === J({ ok: true, checked: 1, due: [] }), '2件では要らない（見たうえで、要らない）', J(d2));
  ok(J(await take(A)) === J({ ok: true, state: 'none' }), '2件のときに番を取りに行っても none だけ（材料は渡らない）');

  await post(43, A, { wlb_comment: '休みの希望は通りにくいと感じる。', culture_comment: '顔が見える規模で話しやすい。', __at: '2026-04-03T00:00:00.000303Z' });
  const d3 = await dueOf(A);
  ok(J(d3) === J({ ok: true, checked: 1, due: [{ airline: A, lang: 'ja', why: 'missing' }] }), '3件そろって、要約が無い → missing', J(d3));
  ok(!UUID.test(J(d3)) && !/[0-9a-f]{32}/.test(J(d3)), '一覧に出るのは会社コード・言語・理由の語だけ（id も指紋も出ない）');

  console.log('  ── 番を取る・材料を受け取る ──');
  const t1 = await take(A);
  ok(t1.ok === true && t1.state === 'go' && t1.why === 'missing' && t1.n === 3 && /^[0-9a-f]{32}$/.test(t1.basis) && t1.rows.length === 3,
     '番を取ると、材料3件と集合の指紋が返る', J({ ...t1, rows: (t1.rows || []).length }));
  const rowKeys = J([...new Set(t1.rows.flatMap((r) => Object.keys(r)))].sort());
  ok(rowKeys === J(['airline', 'created_at', 'orig_lang', 'translations', ...CATS.map((c) => c + '_comment')].sort()),
     '材料の1行は、会社コード・時刻・言語を選ぶ2欄・6分類の本文だけ', rowKeys);
  const ids = (await rows(`select id::text, proof_hash from public.reviews_v2`)).flatMap((r) => [r.id, r.proof_hash]);
  const t1s = J(t1);
  ok(!ids.some((v) => t1s.includes(v)) && !UUID.test(t1s), '材料に口コミの id も proof_hash も入っていない');
  ok(!/captain|A320|10-15|経営陣への提案/.test(t1s) && /細かく見てもらえる/.test(t1s), '材料に職位・機種・在籍年数・提案の欄が入っていない（本文は入っている）');
  const r1 = await run(A);
  ok(r1 && r1.state === 'running' && r1.sig === t1.basis && r1.n === 3 && r1.tries === 1, '控えに「いま作っている」と書かれた', J(r1));

  /* 同じ知らせがもう1本来る ── 口コミが入った数秒後に、翻訳が同じ行を書き換える。 */
  const t1b = await take(A);
  ok(J(t1b) === J({ ok: true, state: 'busy' }), '作っている最中に来た2人目には busy だけ（材料も指紋も渡らない ＝ モデルを呼べない）', J(t1b));
  ok(J((await dueOf(A)).due) === '[]', '作っている最中は、一覧にも出ない');

  console.log('  ── 預ける ──');
  const inp = buildInput(t1.rows, { airline: A, lang: 'ja' });
  ok(inp.n === t1.n, '道具が数えた件数と、サーバが数えた件数が同じ', `${inp.n} / ${t1.n}`);
  const idxOf = (input, re) => input.reviews.filter((r) => re.test(Object.values(r.cats).join(' '))).map((r) => r.i);
  const replyOf = (input) => ({
    good: [{ text: '訓練で細かく見てもらえるという声が複数ある', cat: 'training', reviews: idxOf(input, /細かく見て/) },
           { text: '提案を聞いてもらえるという声がある', cat: 'culture', reviews: [1] }],
    concern: [{ text: '休みの希望が通りにくいという声が複数ある', cat: 'wlb', reviews: idxOf(input, /通りにくい/) }],
  });
  const autoPayload = (t, input) => {
    const s = settle(replyOf(input), { lang: 'ja', n: input.n });
    return { airline: A, lang: 'ja', basis: t.basis, n: input.n, good: s.good, concern: s.concern };
  };
  const p1 = autoPayload(t1, inp);
  ok(p1.good.length === 1 && p1.concern.length === 1, '（検品を通るのは、2件以上がそろった点だけ）', J(p1));
  const w1 = await svc('pv_review_summary_set_auto', p1);
  ok(w1.ok === true && w1.state === 'saved' && w1.n === 3 && w1.airline === A, '検品を通った点を、指紋と一緒に預けられる（時刻は渡していない）', J(w1));
  const o1 = await getAs(KEYED, A);
  ok(o1.state === 'open' && o1.n === 3 && o1.good.length === 1 && o1.concern.length === 1 && !/"k"/.test(J(o1)), '自動で預けたものが、会社ページの読む関数から読める', J(o1));
  ok(J(await getAs('anon', A)) === J({ ok: true, state: 'login' }), '自動で預けたものも、未ログインには login だけ');
  ok((await run(A)).state === 'saved', '控えは「預けた」に変わった');

  console.log('  ── 変わっていなければ、何もしない ──');
  ok(J(await dueOf(A)) === J({ ok: true, checked: 1, due: [] }), '預けた直後は要らない');
  ok(J(await take(A)) === J({ ok: true, state: 'fresh' }), '変わっていないのに番を取りに行っても fresh だけ（材料は渡らない）');

  console.log('  ── 1件増えた／作っている間にもう1件 ──');
  await post(44, A, { training_comment: '訓練の進め方が丁寧。', __at: '2026-04-04T00:00:00.000404Z' });
  ok(J((await dueOf(A)).due) === J([{ airline: A, lang: 'ja', why: 'stale' }]), '1件増えた → stale');
  ok((await getAs(KEYED, A)).n === 3, '（作り直すまでは、前の要約がそのまま読める）');
  const t2 = await take(A);
  ok(t2.state === 'go' && t2.why === 'stale' && t2.n === 4 && t2.basis !== t1.basis, '番を取る（4件・指紋は前と違う）', J({ ...t2, rows: (t2.rows || []).length }));
  const in2 = buildInput(t2.rows, { airline: A, lang: 'ja' });
  const p2 = autoPayload(t2, in2);
  /* ── モデルを呼んでいる間に、もう1件入った ── */
  await post(45, A, { culture_comment: '少人数なので相談しやすい。', __at: '2026-04-05T00:00:00.000505Z' });
  ok(J(await take(A)) === J({ ok: true, state: 'busy' }), 'あとから来た知らせは busy（先の人がまだ作っている）');
  const w2 = await svc('pv_review_summary_set_auto', p2);
  ok(J(w2) === J({ ok: false, error: 'stale_input' }), '材料を受け取ったあとで口コミが増えた → stale_input で断る（古い集合の要約は預からない）', J(w2));
  ok((await getAs(KEYED, A)).n === 3 && await run(A) === null, '断られても預かっている要約はそのまま／自分の番は返した');
  const t3 = await take(A);
  ok(t3.state === 'go' && t3.n === 5 && t3.basis !== t2.basis, '番を返したので、すぐ取り直せる（5件の集合）', J({ ...t3, rows: (t3.rows || []).length }));
  const in3 = buildInput(t3.rows, { airline: A, lang: 'ja' });
  const w3 = await svc('pv_review_summary_set_auto', { ...autoPayload(t3, in3), newest: '2001-01-01T00:00:00Z' });
  ok(w3.ok === true && w3.state === 'saved' && w3.n === 5, '新しい集合の要約を預ける（でたらめな newest を付けても、時刻はサーバが引く）', J(w3));
  /* ── 遅れて着いた、古い集合の要約 ── */
  const late = await svc('pv_review_summary_set_auto', p2);
  ok(J(late) === J({ ok: false, error: 'stale_input' }) && (await getAs(KEYED, A)).n === 5, '遅れて着いた古い集合の要約で、新しい要約を上書きできない', J(late));
  const r3 = await run(A);
  ok(r3.state === 'saved' && r3.sig === t3.basis, '断られた側は、新しい側の控えに触らない', J(r3));

  console.log('  ── 1件消えた／失敗の扱い ──');
  await db.query(`delete from public.reviews_v2 where airline = $1 and created_at = '2026-04-05T00:00:00.000505Z'`, [A]);
  ok(J((await dueOf(A)).due) === J([{ airline: A, lang: 'ja', why: 'stale' }]), '1件消えた → stale');
  ok(J(await getAs(KEYED, A)) === J({ ok: true, state: 'none' }), '（消えた口コミを材料にした要約は、作り直すまで誰にも出ない）');
  const t4 = await take(A);
  ok(t4.state === 'go' && t4.n === 4 && t4.basis === t2.basis, '同じ顔ぶれに戻れば、指紋も同じに戻る', J({ ...t4, rows: (t4.rows || []).length }));
  const f1 = await done(A, t4.basis, 'failed');
  ok(J(f1) === J({ ok: true, state: 'failed', hit: true }) && (await run(A)).state === 'failed', 'モデルが落ちたら、控えに「失敗」と書く', J(f1));
  ok(J(await take(A)) === J({ ok: true, state: 'cooling' }) && J((await dueOf(A)).due) === '[]', '失敗の直後は cooling（30分は呼ばせない・一覧にも出ない）');
  await rewind(A, 29);
  ok(J(await take(A)) === J({ ok: true, state: 'cooling' }), '29分ではまだ');
  await rewind(A, 31);
  const t5 = await take(A);
  ok(t5.state === 'go' && (await run(A)).tries === 2, '30分たてばもう一度（2回目）');
  await done(A, t5.basis, 'failed'); await rewind(A, 31);
  const t6 = await take(A);
  ok(t6.state === 'go' && (await run(A)).tries === 3, '3回目');
  await done(A, t6.basis, 'failed'); await rewind(A, 600);
  ok(J(await take(A)) === J({ ok: true, state: 'parked' }) && J((await dueOf(A)).due) === '[]', '同じ集合で3回失敗したら止める（何時間たっても呼ばせない）');
  await post(46, A, { ops_comment: '運航の支援は必要十分。', __at: '2026-04-06T00:00:00.000606Z' });
  const t7 = await take(A);
  ok(t7.state === 'go' && t7.n === 5 && (await run(A)).tries === 1, '集合が変われば、回数は1から数え直す');

  console.log('  ── 番を返す／切れた番 ──');
  const rl = await done(A, t7.basis, 'released');
  ok(J(rl) === J({ ok: true, state: 'released', hit: true }) && await run(A) === null, '鍵の問題でやめたときは、番を消す（回数に数えない）', J(rl));
  const t8 = await take(A);
  ok(t8.state === 'go' && (await run(A)).tries === 1 && (await take(A)).state === 'busy', '消したあとはすぐ取れる（取った直後の2人目は busy）');
  await rewind(A, 9);
  ok((await take(A)).state === 'busy', '9分ではまだ busy');
  await rewind(A, 11);
  ok(J(await take(A)) === J({ ok: true, state: 'cooling' }), '番は10分で切れる。切れた番（途中で落ちた呼び出し）は失敗と同じ扱い ＝ 同じ集合は30分待つ');
  await rewind(A, 31);
  const t9 = await take(A);
  ok(t9.state === 'go' && (await run(A)).tries === 2, '30分たてば次の人が引き継ぐ（落ちた1回も回数に数える）', J({ ...t9, rows: (t9.rows || []).length }));
  const miss = await done(A, 'f'.repeat(32), 'failed');
  ok(J(miss) === J({ ok: true, state: 'failed', hit: false }) && (await run(A)).state === 'running', '指紋の違う番は返せない（ほかの人の番に触らない）', J(miss));

  console.log('  ── 点が1つも残らなかった／サーバの検査 ──');
  const e1 = await svc('pv_review_summary_set_auto', { airline: A, lang: 'ja', basis: t9.basis, n: 5, good: [], concern: [] });
  ok(J(e1) === J({ ok: true, state: 'deleted' }) && (await run(A)).state === 'empty' && await stored(A) === 0, '点が1つも残らなかったら、預かっている要約を消し、控えに「空」と書く', J(e1));
  ok(J(await take(A)) === J({ ok: true, state: 'settled' }) && J((await dueOf(A)).due) === '[]', '同じ集合では、もう呼ばせない（settled ── 同じ答えにもう一度払わない）');
  const again = await svc('pv_review_summary_set_auto', { airline: A, lang: 'ja', basis: t9.basis, n: 5, good: [{ text: '訓練で細かく見てもらえるという声がある', cat: 'training', k: 1 }], concern: [] });
  ok(again.ok === false && (await run(A)).state === 'empty' && J(await take(A)) === J({ ok: true, state: 'settled' }),
     '済んだ集合に、断られる中身をもう一度投げても、控えは「済み」のまま（失敗に戻して払い直させない）', J(again));
  await post(47, A, { benefits_comment: '福利厚生は必要十分。', __at: '2026-04-07T00:00:00.000707Z' });
  const t10 = await take(A);
  ok(t10.state === 'go' && t10.why === 'missing' && t10.n === 6, '集合が変われば、また作る');
  const weak = await svc('pv_review_summary_set_auto', { airline: A, lang: 'ja', basis: t10.basis, n: 6, good: [{ text: '訓練で細かく見てもらえるという声がある', cat: 'training', k: 1 }], concern: [] });
  ok(J(weak) === J({ ok: false, error: 'weak_point' }) && (await run(A)).state === 'failed' && await stored(A) === 0,
     '自動の道でも、1件にしか支えられていない点は入らない（検査は運営の道と同じ1本）', J(weak));
  const many = await svc('pv_review_summary_set_auto', { airline: A, lang: 'ja', basis: t10.basis, n: 6, good: [G(), G(3), G(4), G(5)], concern: [] });
  ok(many.ok === false && await stored(A) === 0, '自動の道でも、4つは入らない', J(many));
  await rewind(A, 31);
  const t11 = await take(A);
  const badn = await svc('pv_review_summary_set_auto', { airline: A, lang: 'ja', basis: t11.basis, n: 5, good: [G()], concern: [] });
  ok(t11.state === 'go' && J(badn) === J({ ok: false, error: 'bad_n' }) && await stored(A) === 0, '件数がサーバの数と違えば bad_n（画面に出る「n件の口コミから」を盛れない）', J(badn));

  console.log('  ── 形の違う頼み方 ──');
  const BL = J({ ok: false, error: 'bad_lang' });
  ok([J(await svc('pv_review_summary_due', {})), J(await svc('pv_review_summary_due', { langs: [] })), J(await svc('pv_review_summary_due', { langs: ['fr'] })),
      J(await svc('pv_review_summary_due', { langs: 'ja' })), J(await svc('pv_review_summary_due', { langs: [1] }))].every((x) => x === BL),
     '一覧: langs が無い・空・知らない言語・配列でない → bad_lang');
  ok(J(await dueOf('no-such-air')) === J({ ok: true, checked: 0, due: [] }) && J(await dueOf('other')) === J({ ok: true, checked: 0, due: [] }),
     '一覧: 名簿に無い会社・「その他」で知らせても、何も見ない');
  ok(J(await take('no-such-air')) === J({ ok: false, error: 'bad_airline' }) && J(await take('other')) === J({ ok: false, error: 'bad_airline' })
     && J(await take('cathay')) === J({ ok: false, error: 'bad_airline' }) && J(await take(A, 'fr')) === BL,
     '番: 名簿に無い会社・「その他」・古い短いコード・知らない言語は断る');
  const BB = J({ ok: false, error: 'bad_basis' });
  ok(J(await svc('pv_review_summary_set_auto', { airline: A, lang: 'ja', n: 6, good: [G()], concern: [] })) === BB
     && J(await svc('pv_review_summary_set_auto', { airline: A, lang: 'ja', basis: 'F'.repeat(32), n: 6, good: [G()], concern: [] })) === BB
     && J(await done(A, 'x', 'failed')) === BB, '預ける・返す: 指紋の形でない basis は断る');
  ok(J(await done(A, t11.basis, 'saved')) === J({ ok: false, error: 'bad_state' }), '返す: failed でも released でもない語は断る');

  console.log('  ── 3回とも途中で落ちた／落ちた番が残っているあいだに集合が変わった ──');
  await rewind(A, 31);
  const t12 = await take(A);
  ok(t12.state === 'go' && (await run(A)).tries === 3 && (await run(A)).state === 'running', '（3回目の番を取ったまま、呼び出しが落ちたことにする）');
  await rewind(A, 600);
  ok(J(await take(A)) === J({ ok: true, state: 'parked' }), '落ちた番も回数に入る ＝ 3回目が落ちたら止まる');
  await rewind(A, 11);
  await post(51, A, { ops_comment: '運航の支援が手厚い。', __at: '2026-04-08T00:00:00.000808Z' });
  const t13 = await take(A);
  ok(t13.state === 'go' && t13.n === 7 && t13.basis !== t12.basis && (await run(A)).tries === 1,
     '集合が変わっていれば、落ちた番が切れた時点（10分）ですぐ作る（回数は1から）', J({ ...t13, rows: (t13.rows || []).length }));
  const in13 = buildInput(t13.rows, { airline: A, lang: 'ja' });
  const w13 = await svc('pv_review_summary_set_auto', autoPayload(t13, in13));
  ok(w13.ok === true && w13.state === 'saved' && w13.n === 7 && (await getAs(KEYED, A)).n === 7, '最後は預かって終わる（7件）', J(w13));
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 16. 3件を切った会社は消す／古い短いコードの知らせ／全部を見て回る');
// ════════════════════════════════════════════════════════════
{
  const CX = 'cathay-pacific';
  ok(await stored(CX) === 1 && (await one(`select public.pv_review_summary_count(public.pv_review_summary_codes($1), null) c`, [CX])).c === 2,
     '（キャセイは、要約を預かったまま口コミが2件に減っている）');
  const d = await dueOf('cathay');     // 口コミの行に入っている、古い短いコードのまま知らせる
  ok(J(d) === J({ ok: true, checked: 1, due: [{ airline: CX, lang: 'ja', why: 'too_few' }] }), '古い短いコードで知らせても、いまの会社コードに引き直す／3件を切った → too_few', J(d));
  const t = await take(CX);
  ok(t.ok === true && t.state === 'too_few' && t.n === 2 && /^[0-9a-f]{32}$/.test(t.basis) && !('rows' in t), '3件を切った会社には、材料を渡さない（モデルは呼ばない）', J(t));
  ok(await run(CX) === null, '番も取らない');
  const keep = await svc('pv_review_summary_set_auto', { airline: CX, lang: 'ja', basis: t.basis, n: 2, good: [G()], concern: [] });
  ok(keep.ok === false && await stored(CX) === 1, '2件の会社に、自動の道から要約を預けることはできない', J(keep));
  const w = await svc('pv_review_summary_set_auto', { airline: CX, lang: 'ja', basis: t.basis, good: [], concern: [] });
  ok(J(w) === J({ ok: true, state: 'deleted' }) && await stored(CX) === 0 && await run(CX) === null, '空で預けると消える（控えも残さない）', J(w));
  ok(J(await dueOf(CX)) === J({ ok: true, checked: 1, due: [] }) && J(await take(CX)) === J({ ok: true, state: 'none' }), '消したあとは要らない');

  console.log('  ── いちばん新しい口コミの時刻が先の日付 ──');
  const Z = 'zipair';
  await post(52, Z, { culture_comment: '新しい会社で風通しがよい。', __at: '2026-05-01T00:00:00.000111Z' });
  await post(53, Z, { culture_comment: '風通しのよさを感じる。', __at: '2026-05-02T00:00:00.000222Z' });
  await post(61, Z, { culture_comment: '若い会社らしく話が早い。', __at: '2099-01-01T00:00:00.000333Z' });
  ok(J(await dueOf(Z)) === J({ ok: true, checked: 1, due: [] }) && J(await take(Z)) === J({ ok: true, state: 'bad_newest' }) && await run(Z) === null,
     '時刻が先の日付の口コミが混ざった会社は、作らせない（預けても断られる集合に払わない）');

  console.log('  ── 訳があれば訳を渡す（ページの言語のぶんだけ） ──');
  const E = 'emirates';
  await post(62, E, { culture_comment: 'Crew are friendly across nationalities.', orig_lang: 'en',
                      translations: J({ ja: { culture: '国籍を問わず乗員どうしの仲がよい。', mgmt: '経営陣への提案の訳。', junk: 'x' },
                                        fr: { culture: 'Les équipages sont sympathiques.' } }),
                      __at: '2026-05-03T00:00:00.000111Z' });
  await post(63, E, { culture_comment: '多国籍でも乗員どうしの仲がよい。', __at: '2026-05-04T00:00:00.000222Z' });
  await post(41, E, { culture_comment: '乗員どうしの仲がよいと感じる。', __at: '2026-05-05T00:00:00.000333Z' });
  const te = await take(E);
  const first = (te.rows || [])[0] || {};
  ok(te.state === 'go' && te.n === 3 && first.orig_lang === 'en' && J(Object.keys(first.translations || {})) === J(['ja'])
     && J(Object.keys(first.translations.ja)) === J(['culture']),
     '訳は、頼んだ言語のぶんだけ・6分類のぶんだけ渡る（ほかの言語・提案の欄・知らない鍵は渡らない）', J(first.translations));
  const ie = buildInput(te.rows, { airline: E, lang: 'ja' });
  ok(ie.n === 3 && ie.reviews[0].cats.culture === '国籍を問わず乗員どうしの仲がよい。', '道具は、訳があれば訳を材料にする', J(ie.reviews[0]));
  ok(J(await done(E, te.basis, 'released')) === J({ ok: true, state: 'released', hit: true }), '（番を返しておく）');

  console.log('  ── 全部を見て回る（知らせ無し） ──');
  /* 運営が手で預けた要約（ana・jal）は、口コミが変わっていない ＝ 作り直さない。
     スターフライヤーは 15 で預け終えた。キャセイ・ZIPAIR は上のとおり。残るのはエミレーツだけ。 */
  const all = await dueOf(null);
  ok(all.ok === true && J(all.due) === J([{ airline: E, lang: 'ja', why: 'missing' }]),
     '運営が手で預けた要約は、口コミが変わらないかぎり作り直さない／要るのは、まだ無い1社だけ', J(all));
  ok(all.checked === (await one(`select count(*)::int c from public.pv_airlines a where a.code <> 'other' and (
         exists (select 1 from public.reviews_v2 r where r.airline = any(public.pv_review_summary_codes(a.code)))
         or exists (select 1 from public.pv_review_summaries s where s.airline = a.code))`)).c,
     '見るのは、口コミか要約のある会社だけ', String(all.checked));
  const both = await dueOf(null, ['ja', 'en', 'ja']);
  ok(both.checked === all.checked * 2, '言語を足すと、そのぶんだけ見る（同じ言語を2度書いても1度）', String(both.checked));
  const en = both.due.filter((d) => d.lang === 'en').map((d) => d.airline);
  ok(!en.includes('ana') && en.includes('jal') && en.includes(A_STAR) && en.includes(E) && both.due.filter((d) => d.lang === 'ja').length === 1,
     '英語を足すと、英語の要約がまだ無い会社が並ぶ（英語を預かっている ANA は出ない）', J(both.due));

  console.log('  ── SQL を貼り直しても、控えと要約は消えない ──');
  await asOwner();
  const snap = async () => J(await rows(`select 's' t, airline, lang, sig, n::text x from public.pv_review_summaries
                                         union all select 'r', airline, lang, sig, state || tries from public.pv_review_summary_runs order by 1, 2, 3`));
  const before = await snap();
  await db.exec(read('db/review-summary.sql'));
  ok(before === await snap() && JSON.parse(before).some((r) => r.t === 'r'), '貼り直しの前後で、要約の表も控えの表も1行も変わらない');
  ok(J(await take(A_STAR)) === J({ ok: true, state: 'fresh' }) && (await refused(KEYED, `select public.pv_review_summary_take('{}'::jsonb)`)) !== null,
     '貼り直したあとも、判定はそのまま・会員からは呼べないまま');
}


// ════════════════════════════════════════════════════════════
console.log('\n▼ 17. Webhook を作る1枚（db/review-summary-webhook.sql）');
// ════════════════════════════════════════════════════════════
{
  /* 本番の supabase_functions.http_request は外へ投げる。ここに置くのは「呼ばれた」を
     表に書くだけの身代わり ＝ 通信は1本も出ない。見るのは、作られるトリガの形と、
     ひな型（translate-review）に1文字も触らないこと。 */
  await asOwner();
  const HOOK_SQL = read('db/review-summary-webhook.sql');
  const NEW = 'summarize_reviews_reviews_v2';
  const KEY = 'test-bearer-not-a-real-key';
  const HEADERS = `{"Content-type":"application/json","Authorization":"Bearer ${KEY}"}`;
  const hookOn = (name, tbl, events, fn, extra = '') => `create trigger ${name} after ${events} on public.${tbl}
     for each row ${extra} execute function supabase_functions.http_request(
       'https://example.supabase.co/functions/v1/${fn}', 'POST', '${HEADERS}', '{}', '1000')`;
  /* 止まったときに画面へ出る字は3つ（本文・detail・hint）。キーが出ないことは3つとも見る。 */
  const run17 = async () => {
    try { await db.exec(HOOK_SQL); return null; }
    catch (e) { return [e.message, e.detail, e.hint].filter(Boolean).join(' ｜ ') || String(e); }
  };
  const trigs = async () => rows(`select tg.tgname n, pg_get_triggerdef(tg.oid) d from pg_trigger tg
     where not tg.tgisinternal and tg.tgrelid = 'public.reviews_v2'::regclass order by 1`);
  const toSummarize = async () => (await trigs()).filter((t) => t.d.includes('/functions/v1/summarize-reviews'));

  await db.exec(`
    create schema supabase_functions;
    create table public.t_hook_log (seq serial primary key, op text, target text, method text, headers text, params text, wait text);
    create function supabase_functions.http_request() returns trigger language plpgsql as $f$
    begin
      insert into public.t_hook_log (op, target, method, headers, params, wait)
      values (TG_OP, TG_ARGV[0], TG_ARGV[1], TG_ARGV[2], TG_ARGV[3], TG_ARGV[4]);
      return null;
    end $f$;
    create table public.t_other (id int);
  `);

  console.log('  ── 字面 ──');
  const code = HOOK_SQL.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  ok(!/\b(drop|alter|truncate|disable)\b/i.test(code), '動く行に drop / alter が1つも無い（在るのはコメントの「止めるとき」だけ）');
  ok(/^\s*--\s+drop trigger if exists summarize_reviews_reviews_v2 on public\.reviews_v2;/m.test(HOOK_SQL), '止め方が末尾のコメントに在る');
  ok(!/Bearer\s+[A-Za-z0-9._-]{12,}|https:\/\/[a-z0-9]+\.supabase\.co/.test(HOOK_SQL), 'URL もキーも書いていない（ひな型から写す）');

  console.log('  ── ひな型が無ければ作らない ──');
  await db.exec(hookOn('t_translate_elsewhere', 't_other', 'insert', 'translate-review'));
  const e0 = await run17();
  ok(e0 !== null && /translate-review の Webhook トリガが見つかりません/.test(e0) && (await toSummarize()).length === 0,
     'reviews_v2 に translate-review の Webhook が無ければ、止まって何も作らない（ほかの表に在っても使わない）', String(e0));
  await db.exec(`drop trigger t_translate_elsewhere on public.t_other`);

  /* 本番にある形：翻訳（INSERT・UPDATE）と、運営への通知（INSERT）。 */
  await db.exec(hookOn('"Translate review"', 'reviews_v2', 'insert or update', 'translate-review'));
  await db.exec(hookOn('notify_admin_reviews_v2', 'reviews_v2', 'insert', 'notify-admin'));
  const before = await trigs();
  ok(before.some((t) => t.n === 'Translate review') && before.some((t) => t.n === 'notify_admin_reviews_v2'), '（ひな型と、通知の Webhook を置いた）');

  console.log('  ── 受け皿（db/review-summary.sql）が無ければ作らない ──');
  await db.exec(`begin`);
  await db.exec(`drop function public.pv_review_summary_done(jsonb)`);
  const e1 = await run17();
  await db.exec(`rollback`);
  ok(e1 !== null && /自動の道/.test(e1) && (await toSummarize()).length === 0
     && (await one(`select to_regprocedure('public.pv_review_summary_done(jsonb)') is not null y`)).y === true,
     '自動の道の関数が1つでも欠けていたら、止まって何も作らない', String(e1));

  console.log('  ── 作る ──');
  const e2 = await run17();
  const after = await trigs();
  const made = after.find((t) => t.n === NEW);
  ok(e2 === null && !!made, '流すと1本できる', String(e2));
  ok(!!made && made.d === `CREATE TRIGGER ${NEW} AFTER INSERT OR DELETE OR UPDATE ON public.reviews_v2 FOR EACH ROW EXECUTE FUNCTION `
     + `supabase_functions.http_request('https://example.supabase.co/functions/v1/summarize-reviews', 'POST', '${HEADERS}', '{}', '5000')`,
     '名前・3つのイベント・呼び先・待ち時間だけが変わり、URL の頭と認証ヘッダはひな型のまま', made && made.d.split(KEY).join('***'));
  ok(J(after.filter((t) => t.n !== NEW)) === J(before), '翻訳と通知の Webhook は、作る前と1文字も違わない');

  console.log('  ── 末尾の確認の SQL が、そのまま流れる ──');
  const m = HOOK_SQL.match(/▼確認ここから\n([\s\S]*?)\n-- ▲確認ここまで/);
  const verify = m ? m[1].split('\n').map((l) => l.replace(/^-- ?/, '')).join('\n') : '';
  const vr = verify ? await rows(verify) : [];
  const mine = vr.filter((r) => r['呼び先'] === 'summarize-reviews');
  ok(vr.length === 3 && mine.length === 1 && mine[0].webhook === NEW && mine[0]['イベント'] === 'INSERT OR DELETE OR UPDATE' && mine[0]['待ち時間ms'] === '5000',
     '確認の表に、summarize-reviews が1本・3つのイベント・5000ms と出る', J(vr).split(KEY).join('***'));
  ok(vr.length > 0 && !J(vr).includes(KEY) && !J(vr).includes('Bearer'), '確認の表にキーが出ない');

  console.log('  ── 何度流しても1本 ──');
  const e3 = await run17(); const e4 = await run17();
  ok(e3 === null && e4 === null && J(await trigs()) === J(after), '貼り直しても、トリガは1本も増えない・変わらない');

  console.log('  ── 3つのイベントで呼ばれる ──');
  await db.exec(`truncate public.t_hook_log`);
  const rid = (await one(`insert into public.reviews_v2 (proof_hash, airline, culture_comment) values ('t17', 'zipair', '確認用の行。') returning id`)).id;
  await db.query(`update public.reviews_v2 set fleet = 'B787' where id = $1`, [rid]);
  await db.query(`delete from public.reviews_v2 where id = $1`, [rid]);
  const log = await rows(`select op, target, method, headers, params, wait from public.t_hook_log order by seq`);
  const fnOf = (r) => String(r.target).replace(/^.*\/functions\/v1\//, '');
  const sr = log.filter((r) => fnOf(r) === 'summarize-reviews');
  ok(J(sr.map((r) => r.op)) === J(['INSERT', 'UPDATE', 'DELETE']), '入った・変わった・消えた のそれぞれで、ちょうど1回ずつ呼ばれる', J(sr.map((r) => r.op)));
  ok(sr.length === 3 && sr.every((r) => r.method === 'POST' && r.headers === HEADERS && r.wait === '5000' && r.target === 'https://example.supabase.co/functions/v1/summarize-reviews'),
     '呼び先・ヘッダ・待ち時間が3回とも同じ');
  ok(J(log.filter((r) => fnOf(r) === 'translate-review').map((r) => r.op)) === J(['INSERT', 'UPDATE'])
     && J(log.filter((r) => fnOf(r) === 'notify-admin').map((r) => r.op)) === J(['INSERT']),
     '翻訳と通知は、今までどおりの回にだけ呼ばれる（消えたときに翻訳を呼ばない）', J(log.map((r) => r.op + ' ' + fnOf(r))));

  console.log('  ── 画面から作った1本が在れば、2本目を足さない ──');
  await db.exec(`drop trigger ${NEW} on public.reviews_v2`);
  await db.exec(hookOn('"Summarize reviews"', 'reviews_v2', 'insert or update or delete', 'summarize-reviews'));
  const e5 = await run17();
  const s5 = await toSummarize();
  ok(e5 === null && s5.length === 1 && s5[0].n === 'Summarize reviews', '名前が違っても、呼び先が同じなら作らない（1件で2回呼ばれない）', J(s5.map((t) => t.n)));
  await db.exec(`drop trigger "Summarize reviews" on public.reviews_v2`);

  console.log('  ── ひな型に条件が付いていたら、写さずに止まる ──');
  for (const [label, events, extra] of [
    ['WHEN の条件つき', 'insert', 'when (new.orig_lang is not null)'],
    ['列を指定した UPDATE', 'insert or update of translations', ''],
  ]) {
    await db.exec(`drop trigger "Translate review" on public.reviews_v2`);
    await db.exec(hookOn('"Translate review"', 'reviews_v2', events, 'translate-review', extra));
    const snap = await trigs();
    const e = await run17();
    ok(e !== null && /差し替えに失敗/.test(e) && (await toSummarize()).length === 0 && J(await trigs()) === J(snap),
       `${label}のひな型 → 止まって何も作らない（条件ごと写すと、呼ばれるはずの回に呼ばれない）`, String(e).split(KEY).join('***'));
    ok(e !== null && /差し替えた定義の頭: CREATE TRIGGER /.test(e) && !e.includes(KEY) && !e.includes('Bearer') && !e.includes('example.supabase.co'),
       `${label}：止まったときの文（detail・hint まで）に、キーも URL も出ない`, String(e).split(KEY).join('***'));
  }

  /* 後始末（この下に検査を足す人が、身代わりのトリガに驚かないように）。 */
  await db.exec(`drop trigger "Translate review" on public.reviews_v2;
                 drop trigger notify_admin_reviews_v2 on public.reviews_v2;`);
  ok((await trigs()).every((t) => !t.d.includes('supabase_functions.http_request')), '（身代わりのトリガを片付けた）');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 18. 関数の本体を、本物の SQL につないで通しで動かす（身代わりはモデルの返事だけ）');
// ════════════════════════════════════════════════════════════
/* 14〜16 は SQL を手で呼んでいる。assert-review-summary-auto.mjs は関数を**身代わりの DB**で
   動かしている（返事の語と形を、SQL から手で写したもの）。どちらも緑のまま、
   「関数が呼ぶ名前・渡す形」と「SQL が受ける名前・返す形」だけが食い違うことがある。
   その2つを実際につないで通すのは、ここだけ。
     ・DB への呼び出しは、関数が組み立てた宛先・鍵・本文をそのまま読み、同じ名前の SQL を
       サーバの鍵の役（service_role）で呼ぶ
     ・モデルは呼ばない。返事の代わりを返す（知らない宛先へ投げたら落とす）
   ★作る言語が増えても（LANGS に 'en' を足しても）このまま通るように、言語の数で数える。 */
try {
  const SR = await import('../supabase/functions/summarize-reviews/index.ts');
  const LANGS = SR.LANGS;
  const X = 'singapore-airlines', OLD = 'singapore';   // ほかの節が使っていない会社（古い短いコードも持つ）
  const DB = 'https://db.example.test', SKEY = 'service-key-for-test', AKEY = 'model-key-for-test';
  const TEXT = {
    ja: { good: '訓練の教え方が丁寧だという声が複数ある', concern: '勤務の変更が直前に来るという声が複数ある', weak: '提案を聞いてもらえるという声がある' },
    en: { good: 'Several pilots say the training is careful and thorough.', concern: 'Several pilots say roster changes arrive at short notice.', weak: 'One pilot says suggestions are listened to.' },
  };
  const net = { model: [], rpc: [], other: [], logs: [], results: [] };
  let modelStatus = 200;      // モデルの返事（200 以外なら落とす）
  let duringModel = null;     // モデルが考えているあいだに起きること（1回だけ）
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetch18 = async (url, init) => {
    const u = String(url);
    if (u.startsWith(DB + '/rest/v1/rpc/')) {
      const fn = u.slice((DB + '/rest/v1/rpc/').length);
      const body = JSON.parse(init.body);
      net.rpc.push({ fn, keys: J(Object.keys(body)),
                     auth: init.method === 'POST' && init.headers.apikey === SKEY && init.headers.Authorization === 'Bearer ' + SKEY });
      if (!SVC.includes(fn)) return reply(404, {});
      return reply(200, await svc(fn, body.p));           // ← 本物の SQL
    }
    if (u === 'https://api.anthropic.com/v1/messages') {
      const b = JSON.parse(init.body);
      const lang = LANGS.find((l) => SR.systemPrompt(l) === b.system) || '';
      net.model.push({ lang, user: b.messages[0].content, key: init.headers['x-api-key'] === AKEY });
      if (duringModel) { const f = duringModel; duringModel = null; await f(); }
      if (modelStatus !== 200) {
        return reply(modelStatus, { type: 'error', error: { type: modelStatus === 401 ? 'authentication_error' : 'api_error', message: 'x' } });
      }
      const T = TEXT[lang];
      const input = { good: [{ text: T.good, cat: 'training', reviews: [1, 2] }, { text: T.weak, cat: 'culture', reviews: [1] }],
                      concern: [{ text: T.concern, cat: 'wlb', reviews: [2, 3] }] };
      return reply(200, { content: [{ type: 'tool_use', name: 'submit_summary', input }], stop_reason: 'tool_use',
                          usage: { input_tokens: 100, output_tokens: 50 } });
    }
    net.other.push(u);
    throw new Error('知らない宛先');
  };
  const ENV = { ANTHROPIC_API_KEY: AKEY, SUPABASE_URL: DB, SUPABASE_SERVICE_ROLE_KEY: SKEY };
  const deps = { fetch: fetch18, env: (k) => ENV[k] || '', log: (l) => net.logs.push(String(l)), now: () => Date.now() };
  const call = async (body) => {
    const before = net.model.length;
    const res = await SR.handle(new Request('https://fn.example.test/summarize-reviews', { method: 'POST', body: JSON.stringify(body) }), deps);
    const j = await res.json();
    for (const r of (Array.isArray(j.results) ? j.results : [])) net.results.push(r);
    return { status: res.status, j, calls: net.model.length - before };
  };
  /* Database Webhook が送る形。行の中身は丸ごと来るが、関数が読むのは会社コードだけ。 */
  const ev = (type, airline) => ({
    type, table: 'reviews_v2', schema: 'public',
    record: type === 'DELETE' ? null : { id: 'row-id', airline, culture_comment: 'この欄は関数に読まれない', position: 'captain' },
    old_record: type === 'INSERT' ? null : { id: 'row-id', airline },
  });
  const byLang = (a, b) => (a.lang < b.lang ? -1 : a.lang > b.lang ? 1 : 0);
  const perLang = (f) => J(LANGS.map(f).sort(byLang));
  const got = (list) => J([...(list || [])].sort(byLang));
  const statesOf = (j, lang) => (j.results || []).filter((r) => r.airline === X && r.lang === lang).map((r) => r.state);
  const everyLang = async (f) => { for (const l of LANGS) { if (!(await f(l))) return false; } return true; };
  /* どの言語から手を付けるかは、DB の一覧の並びが決める（LANGS の並びではない）。 */
  const firstOf = (j) => ((j.results || [])[0] || {}).lang || '';
  const restOf = (j) => LANGS.filter((l) => l !== firstOf(j));

  /* 材料: いまのコードで2件・古い短いコードで1件・半角の空白だけの1件（サーバも関数も数えない）。 */
  await post(41, X, { training_comment: '訓練の教え方が丁寧で助かった。', wlb_comment: '勤務の変更が直前に来る。',
                      position: 'captain', fleet: 'A350', __at: '2026-05-01T00:00:00.000101Z' });
  await post(42, X, { training_comment: '教え方が丁寧。', wlb_comment: '直前の勤務変更が多い。', __at: '2026-05-02T00:00:00.000202Z' });
  await post(43, OLD, { wlb_comment: '勤務の変更は直前に来ることが多い。', __at: '2026-05-03T00:00:00.000303Z' });
  await post(44, X, { culture_comment: '   ', __at: '2026-05-04T00:00:00.000404Z' });

  console.log('  ── 見るだけ（費用ゼロの確認）──');
  const d0 = await call({ airline: X, dry: true });
  ok(d0.status === 200 && d0.j.ok === true && d0.j.mode === 'dry' && d0.j.key_set === true && d0.calls === 0
     && got(d0.j.due) === perLang((lang) => ({ airline: X, lang, why: 'missing' })),
     '{"dry":true}: 作り直しが要る会社と理由の語が返る／モデルは呼ばない', J(d0.j));
  ok(await everyLang(async (l) => (await run(X, l)) === null && (await stored(X, l)) === 0), '見るだけでは番を取らない・何も預けない');

  console.log('  ── 口コミが入った（古い短いコードの行）→ 作って預ける ──');
  const e1 = await call(ev('INSERT', OLD));
  ok(e1.status === 200 && e1.j.ok === true && e1.j.mode === 'event' && e1.calls === LANGS.length && e1.j.calls === LANGS.length && e1.j.deferred === 0,
     'モデルを呼ぶのは言語の数だけ', J({ ...e1.j, real: e1.calls }));
  ok(got(e1.j.results) === perLang((lang) => ({ airline: X, lang, state: 'saved', n: 3, good: 1, concern: 1, dropped: 1 })),
     '古いコードの知らせでも、いまの会社コードで預かる／件数はサーバと関数で同じ（空白だけの1件は数えない）／1件にしか支えられていない点は落ちる', J(e1.j.results));
  for (const lang of LANGS) {
    const o = await getAs(KEYED, X, lang);
    ok(o.state === 'open' && o.n === 3 && J(o.good) === J([{ text: TEXT[lang].good, cat: 'training' }]) && J(o.concern) === J([{ text: TEXT[lang].concern, cat: 'wlb' }]),
       `[${lang}] 会社ページが読む関数から、検品を通った点だけが読める`, J(o));
    ok((await run(X, lang)).state === 'saved', `[${lang}] 控えは「預けた」`);
  }
  ok(J(await getAs('anon', X)) === J({ ok: true, state: 'login' }), '未ログインには login だけ');
  ok(J(await getAs(NOKEY, X)) === J({ ok: true, state: 'locked' }), '関数が預けたものも、登録だけの会員には locked だけ');
  const m1 = net.model.slice(-LANGS.length);
  ok(m1.length === LANGS.length && m1.every((m) => m.key && LANGS.includes(m.lang) && m.user.startsWith('Reviews: 3\n')
       && m.user.includes('勤務の変更は直前に来ることが多い。') && !/captain|A350|singapore|2026-05|row-id|読まれない/.test(m.user)),
     'モデルに渡ったのは、番号を振った本文3件だけ（会社コードも職位も機種も時刻も、知らせに付いてきた行の中身も無い）');

  console.log('  ── 中身の変わらない UPDATE → 何もしない ──');
  /* 本当に1行を書き換える（点数だけ）。知らせだけ送っても「書き換えたのに払わない」は確かめられない。 */
  await asOwner();
  const u2 = await db.query(`update public.reviews_v2 set wlb_score = 2 where airline = $1 and created_at = '2026-05-02T00:00:00.000202Z'`, [X]);
  const e2 = await call(ev('UPDATE', X));
  ok(u2.affectedRows === 1 && e2.j.ok === true && e2.calls === 0 && e2.j.calls === 0 && J(e2.j.results) === '[]', '集合も中身も同じなら、モデルは呼ばれない（課金なし）', J({ ...e2.j, updated: u2.affectedRows }));

  console.log('  ── モデルが落ちた → 控えに残し、すぐには呼び直さない ──');
  await post(45, X, { training_comment: '訓練の進め方が丁寧だった。', __at: '2026-05-05T00:00:00.000505Z' });
  modelStatus = 500;
  const e3 = await call(ev('INSERT', X));
  ok(got(e3.j.results) === perLang((lang) => ({ airline: X, lang, state: 'model_failed', why: 'http_500' })), '落ちたことは語だけで返る', J(e3.j.results));
  ok(await everyLang(async (l) => { const r = await run(X, l); return r && r.state === 'failed' && r.tries === 1 && r.n === 4; }), '控えに「失敗・1回目」と書かれた');
  ok(await everyLang(async (l) => (await getAs(KEYED, X, l)).n === 3), '（作り直せるまでは、前の要約がそのまま読める）');
  modelStatus = 200;
  const e4 = await call(ev('UPDATE', X));
  ok(e4.calls === 0 && J(e4.j.results) === '[]', '直後にもう一度知らせが来ても、モデルは呼ばれない（30分あける）', J(e4.j));
  for (const l of LANGS) await rewind(X, 31, l);
  const e5 = await call({ airline: X });
  ok(e5.j.mode === 'one' && e5.calls === LANGS.length && got(e5.j.results) === perLang((lang) => ({ airline: X, lang, state: 'saved', n: 4, good: 1, concern: 1, dropped: 1 })),
     '30分たってから手で1社を頼むと、作り直して預かる', J(e5.j));

  console.log('  ── 鍵が死んでいる → 回数に数えない・その回はそこでやめる ──');
  await post(46, X, { wlb_comment: '勤務の変更が直前に来て困る。', __at: '2026-05-06T00:00:00.000606Z' });
  modelStatus = 401;
  const e6 = await call(ev('INSERT', X));
  ok(e6.calls === 1 && J(statesOf(e6.j, firstOf(e6.j))) === J(['key_error']) && e6.j.deferred === LANGS.length - 1
     && restOf(e6.j).length === LANGS.length - 1 && restOf(e6.j).every((l) => J(statesOf(e6.j, l)) === J(['deferred'])),
     '最初の1回で鍵の問題と分かったら、残りは呼ばずに見送る', J(e6.j));
  modelStatus = 200;
  const e7 = await call(ev('UPDATE', X));
  ok(e7.calls === LANGS.length && got(e7.j.results) === perLang((lang) => ({ airline: X, lang, state: 'saved', n: 5, good: 1, concern: 1, dropped: 1 })),
     '鍵が直れば、待たずに次の知らせで作り直せる（番を返してある＝失敗に数えていない）', J(e7.j));

  console.log('  ── モデルが考えているあいだに、もう1件入った ──');
  await post(47, X, { ops_comment: '運航の支援は十分。', __at: '2026-05-07T00:00:00.000707Z' });
  duringModel = () => post(51, X, { culture_comment: '相談しやすい雰囲気。', __at: '2026-05-08T00:00:00.000808Z' });
  const e8 = await call(ev('INSERT', X));
  ok(J(statesOf(e8.j, firstOf(e8.j))) === J(['superseded', 'saved']) && restOf(e8.j).length === LANGS.length - 1
     && restOf(e8.j).every((l) => J(statesOf(e8.j, l)) === J(['saved'])) && e8.calls === LANGS.length + 1,
     '古い集合から作った要約は預からず（superseded）、その場で新しい集合から作り直す', J(e8.j));
  ok(await everyLang(async (l) => (await getAs(KEYED, X, l)).n === 7 && (await run(X, l)).state === 'saved'), '預かっているのは、7件ぜんぶから作った要約');

  console.log('  ── 改行だけの欄（サーバは数える）──');
  await post(52, X, { ops_comment: '\n', __at: '2026-05-09T00:00:00.000909Z' });
  const e9 = await call(ev('INSERT', X));
  ok(got(e9.j.results) === perLang((lang) => ({ airline: X, lang, state: 'saved', n: 8, good: 1, concern: 1, dropped: 1 })),
     '関数の数え方とサーバの数え方が同じ（食い違うと count_mismatch で止まる）', J(e9.j.results));
  ok(net.model.slice(-1)[0].user.startsWith('Reviews: 8\n') && net.model.slice(-1)[0].user.includes('(no text)'), '（本文の無い1件は、番号だけで渡る）');

  console.log('  ── 口コミが消えて3件を切った → 預かっている要約も消す ──');
  await asOwner();
  await db.query(`delete from public.reviews_v2 where airline in ($1, $2) and created_at > '2026-05-02T12:00:00Z'`, [X, OLD]);
  const e10 = await call(ev('DELETE', X));
  ok(e10.calls === 0 && got(e10.j.results) === perLang((lang) => ({ airline: X, lang, state: 'cleared', n: 2 })), 'モデルを呼ばずに消す', J(e10.j));
  ok(await everyLang(async (l) => (await stored(X, l)) === 0 && (await run(X, l)) === null && J(await getAs(KEYED, X, l)) === J({ ok: true, state: 'few' })),
     '要約の行も控えも残っていない／読む関数は「少ない」');
  const e11 = await call(ev('DELETE', X));
  ok(e11.calls === 0 && J(e11.j.results) === '[]', 'もう一度知らせが来ても、することは無い', J(e11.j));

  console.log('  ── つなぎ目 ──');
  ok(net.rpc.length > 0 && net.rpc.every((r) => r.auth && r.keys === '["p"]' && SVC.includes(r.fn)),
     'DB へは、サーバの鍵で・{p} の形で・自動の道の4本だけを呼んでいる', J([...new Set(net.rpc.map((r) => r.fn))]));
  ok(SVC.every((fn) => net.rpc.some((r) => r.fn === fn)), '4本とも、実際に本物の SQL を通った');
  ok(net.other.length === 0, 'DB とモデル以外の宛先へは1本も投げていない', J(net.other));
  ok(!net.results.some((r) => r.state === 'error' || r.state === 'rejected'), '関数と SQL の食い違い（error / rejected）は1回も出ていない', J(net.results.filter((r) => r.state === 'error' || r.state === 'rejected')));
  const said = net.logs.join('\n');
  const TEXTS = [...Object.values(TEXT).flatMap((t) => Object.values(t)), '助かった', '直前', '相談しやすい', '読まれない', 'captain', 'A350', SKEY, AKEY];
  ok(net.logs.length > 0 && !TEXTS.some((s) => said.includes(s)), 'ログに、口コミの文も要約の文も鍵も出ていない');
} catch (e) {
  await asOwner();
  ok(false, '18 が途中で落ちた', String((e && e.message) || e).slice(0, 300));
}

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
