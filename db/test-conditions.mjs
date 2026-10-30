/* db/airline-conditions.sql を本物の Postgres（PGlite = PG17 の WASM ビルド）に流して確かめる。

   実行: node db/test-conditions.mjs   （または npm run test:sql）
   ネットワーク不要・本番に一切触らない。SQL を直したら必ずこれを通してから
   オーナーに実行を依頼すること。

   器は db/test-pay-reports.mjs と同じ（anon / authenticated ロール、schema public の
   既定権限を全付与＝Supabase の初期状態、auth.uid() の代役、profiles）。
   既定権限を先に付けておくことに意味がある。無いと「元から権限が無いだけ」を
   「revoke が効いた」と誤読する。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
/* 質問の期待値は SSOT から取る。固定値を書くと、質問を1つ足すたびに
   「SQL は正しいのにテストだけ落ちる」になり、落ちたテストを疑わなくなる。 */
import { QUESTIONS, SETTINGS, UNKNOWN } from '../pv-conditions.mjs';

/* 一覧と1問枠に出る質問／話題の入口からだけ出る質問（2026-10-04）。
   ★「答えた項目：N／M」の M は**一覧に出る質問の数**。質問マスタの行数（QUESTIONS.length）ではない。
     マスタには話題の入口からだけ出す質問も入っているので、あちらで数えると M が増える。 */
const LISTED = QUESTIONS.filter((q) => !q.topicOnly);
const TOPIC_ONLY = QUESTIONS.filter((q) => q.topicOnly);

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
const boom = async (sql, params) => {
  try { await db.query(sql, params); return null; } catch (e) { return String(e.message || e); }
};

// ── 器 ───────────────────────────────────────────────────────
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  grant usage on schema public, extensions to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;

  create table public.profiles (
    id uuid primary key, email text, name text,
    email_opt_in boolean not null default false
  );

  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;
`);

const FILES = ['db/airlines.generated.sql', 'db/vocab.generated.sql',
               'db/conditions.generated.sql', 'db/airline-conditions.sql'];

// ── 適用（順番も含めて本番と同じ手順）────────────────────────
console.log('\n▼ SQL の適用');
for (const f of FILES) {
  try { await db.exec(read(f)); console.log(`  ✅ ${f}`); pass++; }
  catch (e) { console.log(`  ❌ ${f}\n     ${e.message}`); fail++; process.exit(1); }
}

// 2回流しても壊れないこと（冪等）
console.log('\n▼ 冪等性（もう一度そのまま流す）');
for (const f of FILES) {
  try { await db.exec(read(f)); console.log(`  ✅ ${f} 再適用OK`); pass++; }
  catch (e) { console.log(`  ❌ ${f} 再適用で失敗\n     ${e.message}`); fail++; }
}

// ── 質問マスタが SSOT と一致するか ───────────────────────────
console.log('\n▼ 質問マスタ（SSOT との突き合わせ）');
const qm = await one(`select
  (select count(*) from pv_condition_questions where active) q,
  (select count(*) from pv_condition_questions where active and not topic_only) l,
  (select count(*) from pv_condition_sections where active) s,
  (select count(*) from pv_condition_questions where active and micro) m,
  (select count(*) from pv_condition_questions where active and tier = 'A') a`);
ok(Number(qm.q) === QUESTIONS.length, `質問 ${QUESTIONS.length} → ${qm.q}`);
ok(Number(qm.l) === LISTED.length && LISTED.length + TOPIC_ONLY.length === QUESTIONS.length,
  `   うち一覧に出る質問 ${LISTED.length} → ${qm.l}（話題の入口からだけ出る質問 ${TOPIC_ONLY.length} は別）`);
/* ★この1行だけは数字で書く（2026-10-05）。冒頭の「固定値を書かない」の例外。
     上の2行は両側とも生成元から数えているので、今までの質問にうっかり topicOnly を付けても
     （4問のどれかから外しても）一緒に動いて緑のまま ＝ 「N／48 を動かさない」をどこも見ていなかった。
     一覧に出る質問を本当に足した回は、この1行と、48 を字で持っている所を一緒に直す
     （assert-admin-notify.mjs・roadmap-config.js・workflows/deploy-checklist.md）。
   ★2026-10-09、着陸手当の額と数え方の5問を足して 43 → 48 にした（見るのは ㉑）。
   ★2026-10-30、日当（パーディアム）の3問を足して 48 → 51 にした（オーナー指示・戻ってきた会員に聞く板）。 */
ok(LISTED.length === 51 && TOPIC_ONLY.length === 4,
  '   ★一覧に出る質問は 51・話題の入口からだけ出る質問は 4（ここだけ数字で固定）',
  `一覧 ${LISTED.length}・入口だけ ${TOPIC_ONLY.length}`);
ok(Number(qm.m) === QUESTIONS.filter((q) => q.micro).length,
  `★（1問だけ出せる）${QUESTIONS.filter((q) => q.micro).length} → ${qm.m}`);
ok(Number(qm.a) === QUESTIONS.filter((q) => q.tier === 'A').length,
  `Tier A ${QUESTIONS.filter((q) => q.tier === 'A').length} → ${qm.a}`);

/* ⑦ 選択肢コードが1つ残らず DB に入っているか。
   JSON だけ直して SQL を流し忘れると、画面では選べるのに保存だけ弾かれる。 */
const dbq = Object.fromEntries((await rows(
  `select id, choice_codes, kind, tier, parent, parent_when, topic, topic_only from pv_condition_questions`))
  .map((r) => [r.id, r]));
const codeGap = QUESTIONS.filter((q) => q.choices)
  .flatMap((q) => q.choices.map((c) => [q.id, c.code]))
  .filter(([id, code]) => !(dbq[id]?.choice_codes || []).includes(code));
ok(codeGap.length === 0, `全選択肢コードが DB にある（${QUESTIONS.filter((q) => q.choices).length}問）`,
  JSON.stringify(codeGap.slice(0, 5)));

// ── 権限（個票は誰にも読ませない）────────────────────────────
console.log('\n▼ 権限');
await db.exec('set role anon');
ok((await boom(`select * from airline_conditions limit 1`)) !== null,
  'anon は airline_conditions を直接読めない');
ok((await boom(`insert into airline_conditions(proof_hash,airline,question_id,effective_year,effective_month,answer_code)
                values('x','zipair','reserve_duty',2026,8,'yes')`)) !== null,
  'anon は直接書き込めない');
ok((await boom(`select submit_airline_conditions('{}'::jsonb)`)) !== null,
  'anon は保存 RPC を叩けない');
ok((await boom(`select * from airline_condition_facts limit 1`)) !== null,
  'anon は集計を直接読めない（読む口は pv_contrib_facts だけ）');
await db.exec('reset role');

await db.exec('set role authenticated');
ok((await boom(`select * from airline_conditions limit 1`)) !== null,
  'ログイン済みでも個票は直接読めない（RPC 経由のみ）');
ok((await boom(`select * from airline_condition_facts limit 1`)) !== null,
  'ログイン済みでも集計は直接読めない');
ok((await boom(`select pv_condition_hash('00000000-0000-4000-8000-000000000001'::uuid,'zipair',null)`)) !== null,
  'proof_hash の作り方は誰にも渡していない');
ok((await boom(`select * from pv_contributor_stats()`)) !== null,
  '貢献者集計はオーナーだけ');
await db.exec('reset role');

// ⑥ 集計に出してはいけない列が無いこと
const leak = await rows(`select column_name from information_schema.columns
  where table_schema='public' and table_name='airline_condition_facts'
    and column_name in ('answer_text','answer_json','proof_hash','airline_other',
                        'position','fleet','base_iata','contract_type')`);
ok(leak.length === 0, '集計に自由記述・準識別子が1列も無い',
  JSON.stringify(leak.map((r) => r.column_name)));

// ── 投稿 ─────────────────────────────────────────────────────
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const asUser = async (n) => {
  await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`,
    [uid(n), `p${n}@example.com`]);
  await db.query(`select set_config('pv.uid', $1, false)`, [uid(n)]);
};
const submit = async (payload) =>
  (await one(`select submit_airline_conditions($1::jsonb) r`, [JSON.stringify(payload)])).r;
const next = async (payload) =>
  (await one(`select next_condition_questions($1::jsonb) r`, [JSON.stringify(payload)])).r;
const mine = async (payload = {}) =>
  (await one(`select my_airline_conditions($1::jsonb) r`, [JSON.stringify(payload)])).r;

const CTX = { airline: 'zipair', year: 2026, month: 8, position: 'cap',
              fleet: 'a380', base_iata: 'ITM', contract_type: 'permanent', lang: 'ja' };

console.log('\n▼ 保存と検証');
await asUser(1);
let r = await submit({ ...CTX, answers: [{ question_id: 'reserve_duty', code: 'yes' }] });
ok(r.ok === true && r.saved === 1, `1問保存できる → saved=${r.saved}`);
ok(r.answered_total === 1 && r.questions_total === LISTED.length,
  `答えた項目 1／${LISTED.length} を返す（分母は一覧に出る質問の数）`);

// ⑤ 語彙にない答えは弾く
r = await submit({ ...CTX, answers: [{ question_id: 'reserve_duty', code: 'maybe' }] });
ok(r.saved === 0 && r.rejected[0]?.reason === 'bad_code',
  `語彙にない answer_code を弾く → ${JSON.stringify(r.rejected)}`);
r = await submit({ ...CTX, answers: [{ question_id: 'nope_nope', code: 'yes' }] });
ok(r.saved === 0 && r.rejected[0]?.reason === 'unknown_question', '存在しない質問を弾く');
r = await submit({ ...CTX, answers: [{ question_id: 'roster_lead_days', num: 999 }] });
ok(r.saved === 0 && r.rejected[0]?.reason === 'out_of_range', '範囲外の数値を弾く（1〜90日前）');
r = await submit({ ...CTX, answers: [{ question_id: 'roster_lead_days', num: 'abc' }] });
ok(r.saved === 0 && r.rejected[0]?.reason === 'bad_number', '数値でない文字列を弾く（取引ごと落ちない）');
r = await submit({ ...CTX, answers: [
  { question_id: 'ground_duty_pay', code: 'yes', text: 'あ'.repeat(301) }] });
ok(r.saved === 0 && r.rejected[0]?.reason === 'text_too_long', '301字の自由記述を弾く');
r = await submit({ ...CTX, answers: [
  { question_id: 'ground_duty_pay', code: 'yes', text: '地上業務1時間＝乗務0.5時間' }] });
ok(r.saved === 1, '300字までの自由記述は受ける');

// ⑨ 親に答えていない人の子は受けない／出さない
await asUser(2);
r = await submit({ ...CTX, answers: [{ question_id: 'reserve_location', code: 'home' }] });
ok(r.saved === 0 && r.rejected[0]?.reason === 'parent_missing',
  '親（Reserve の有無）に答えていない人の子の回答は受けない');
let nx = await next({ airline: 'zipair', limit: 30 });
ok(nx.questions.length > 0 && nx.questions.every((q) => !('n' in q)), '次の質問の返事に、答えた人数が入っていない');
ok(!nx.questions.some((q) => q.id === 'reserve_location'),
  '⑨ 親に答えていない人に、子の質問を出さない');

// 同じ送信の中で親→子の順に並べ替えて受ける（priority の昇順で回している）
r = await submit({ ...CTX, answers: [
  { question_id: 'reserve_location', code: 'home' },        // 子を先に置いても
  { question_id: 'reserve_duty', code: 'yes' }] });         // 親が先に保存される
ok(r.saved === 2, `同じ送信なら親→子の順に直して両方保存する → saved=${r.saved}`);
nx = await next({ airline: 'zipair', limit: 30 });
ok(nx.questions.some((q) => q.id === 'reserve_days'),
  '親に答えたら、子の質問が候補に入る');

// ⑧ 回答済みは出さない
ok(!nx.questions.some((q) => q.id === 'reserve_duty'),
  '⑧ 回答済みの質問を next が返さない');
// ★だけに絞れる
const micro = await next({ airline: 'zipair', micro: true, limit: 30 });
ok(micro.questions.length > 0 && micro.questions.every((q) => q.micro === true),
  '★（1タップで終わる質問）だけに絞れる');

// ④ 答え直しても行が増えない
console.log('\n▼ 答え直し');
await asUser(1);
const before = await one(`select count(*) n from airline_conditions
  where question_id='reserve_duty' and airline='zipair'`);
await submit({ ...CTX, answers: [{ question_id: 'reserve_duty', code: 'no' }] });
const after = await one(`select count(*) n, max(answer_code) code,
  bool_or(updated_at > created_at) moved from airline_conditions
  where question_id='reserve_duty' and airline='zipair'`);
ok(Number(after.n) === Number(before.n), `答え直しても行が増えない（${before.n} → ${after.n}）`);
ok(after.moved === true, '答え直すと updated_at だけ動く（＝最終確認日）');

// ② k≧3 の閾値
console.log('\n▼ 集計（k≧3）');
const askJal = async (n, code) => {
  await asUser(n);
  await submit({ airline: 'jal', year: 2026, month: 8,
    answers: [{ question_id: 'roster_changes', code }] });
};
await askJal(11, 'rare'); await askJal(12, 'rare');
let v = await rows(`select * from airline_condition_facts where airline='jal'`);
ok(v.length === 0, '② 2人では集計に出ない');
await askJal(13, 'sometimes');
v = await rows(`select * from airline_condition_facts where airline='jal' and question_id='roster_changes'`);
ok(v.length === 1 && Number(v[0].n) === 3, `② 3人で出る → n=${v[0]?.n}`);
ok(v[0]?.top_code === 'rare' && Number(v[0]?.top_share) === 70,
  `多い答えと割合（10%刻み）→ ${v[0]?.top_code} / ${v[0]?.top_share}%`);
ok(JSON.stringify(v[0]?.answer_dist) === JSON.stringify({ rare: 2, sometimes: 1 }),
  `割れているのが見える形で出る → ${JSON.stringify(v[0]?.answer_dist)}`);

// ③ 「わからない」だけでは事実にしない
const askAnz = async (n) => {
  await asUser(n);
  await submit({ airline: 'air-new-zealand', year: 2026, month: 8,
    answers: [{ question_id: 'sick_leave', code: UNKNOWN }] });
};
await askAnz(21); await askAnz(22); await askAnz(23);
v = await rows(`select * from airline_condition_facts where airline='air-new-zealand'`);
ok(v.length === 0, '③「わからない」だけ3人では集計に出ない');
const stored = await one(`select count(*) n from airline_conditions
  where airline='air-new-zealand' and answer_code='unknown'`);
ok(Number(stored.n) === 3, '   ただし行としては保存する（翌月また同じことを聞かないため）');

// 「わからない」は n に数えず n_unknown に出る
const askQf = async (n, code) => {
  await asUser(n);
  await submit({ airline: 'qantas', year: 2026, month: 8,
    answers: [{ question_id: 'sick_leave', code }] });
};
await askQf(31, 'days'); await askQf(32, 'days'); await askQf(33, 'days'); await askQf(34, UNKNOWN);
v = await rows(`select * from airline_condition_facts where airline='qantas'`);
ok(v.length === 1 && Number(v[0].n) === 3 && Number(v[0].n_unknown) === 1,
  `「わからない」は n に数えない → n=${v[0]?.n} / n_unknown=${v[0]?.n_unknown}`);

// 数値質問は中央値だけ出す
const askNum = async (n, num) => {
  await asUser(n);
  await submit({ airline: 'qantas', year: 2026, month: 8,
    answers: [{ question_id: 'annual_leave_days', num }] });
};
await askNum(41, 20); await askNum(42, 28); await askNum(43, 30);
v = await rows(`select * from airline_condition_facts
  where airline='qantas' and question_id='annual_leave_days'`);
ok(Number(v[0]?.median_num) === 28, `数値質問は中央値を出す → ${v[0]?.median_num}`);
ok(v[0]?.top_code === null && v[0]?.answer_dist === null, '数値質問に選択肢の分布は出ない');

// 「その他（自由入力の社名）」は集計に出さない
for (const n of [51, 52, 53]) {
  await asUser(n);
  await submit({ airline: 'other', airline_other: 'Testair', year: 2026, month: 8,
    answers: [{ question_id: 'cadet_program', code: 'none' }] });
}
v = await rows(`select * from airline_condition_facts where airline='other'`);
ok(v.length === 0, '自由入力の社名（その他）は集計に出さない');

// ⑩ Tier A が埋まるまで Tier B を出さない
console.log('\n▼ 聞く順番');
await asUser(60);
const byId = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
const answerFor = (q) => {
  const first = (q.choices || []).find((c) => c.code !== UNKNOWN)?.code;
  if (q.kind === 'choice') return { question_id: q.id, code: first };
  if (q.kind === 'multi') return { question_id: q.id, codes: [first] };
  if (q.kind === 'num') {
    const mid = Math.round(((q.num.min + q.num.max) / 2) * 100) / 100;
    return { question_id: q.id, num: mid, currency: q.currency ? 'JPY' : undefined };
  }
  return { question_id: q.id, code: UNKNOWN };
};
const asked = [];
let firstNonA = null;
for (let i = 0; i < QUESTIONS.length + 5; i++) {
  const got = (await next({ airline: 'skymark', limit: 1 })).questions[0];
  if (!got) break;
  if (got.tier !== 'A') { firstNonA = got; break; }
  asked.push(got.id);
  const res = await submit({ airline: 'skymark', year: 2026, month: 8,
    answers: [answerFor(byId[got.id])] });
  if (res.saved !== 1) { ok(false, `${got.id} を保存できない`, JSON.stringify(res.rejected)); break; }
}
ok(asked.every((id) => byId[id].tier === 'A'), `Tier A から順に聞く（${asked.length}問）`);
ok(firstNonA && firstNonA.tier === 'B', `⑩ A を出し切ってから B に移る → ${firstNonA?.id}(${firstNonA?.tier})`);
const leftA = (await next({ airline: 'skymark', limit: 30 })).questions.filter((q) => q.tier === 'A');
ok(leftA.length === 0, '   このとき候補に Tier A は1問も残っていない',
  JSON.stringify(leftA.map((q) => q.id)));

/* ★TQ5 ほかの人の回答の数を並びに使ってよい相手は、db/contrib.sql の pv_contrib_sees が決める（2026-10-11）。
   あのファイルは db/airline-conditions.sql より後に貼る ＝ この器には無い（上の FILES に入っていない）。
   そのあいだも、次の質問は止まらずに返る。数は誰の並びにも使わない（閉じる側に倒す）。
   「使わない」の見方 ── まだ1問も答えていない人には、回答の集まり方が違う2社（zipair / skymark）で同じ並びが返る ＝ 質問の表の順。
   ⚠️ 落とし方は db/airline-conditions.sql の側を壊す（関数が在るかを見る if を外す／v_open の初めの値を true にする）。 */
{
  const FRESH = 8860;                                     // この節でだけ使う、まだ誰も使っていない会員番号
  const unused = Number((await one(`select count(*)::int n from profiles where id = $1`, [uid(FRESH)])).n) === 0;
  const noRule = (await one(`select to_regprocedure('public.pv_contrib_sees(text)') is null as none`)).none === true;
  const safe = async (payload) => { try { return await next(payload); } catch (e) { return { __err: String(e.message || e) }; } };
  const idsOf = (x) => JSON.stringify(((x && x.questions) || []).map((q) => q.id));
  const fine = (x) => !x.__err && x.ok === true && x.questions.length > 0 && x.questions.every((q) => q.n == null);
  const answered = await safe({ airline: 'skymark', limit: 30 });                 // 答えた人（会員60。上で Tier A を出し切った）
  await asUser(FRESH);
  const fa = await safe({ airline: 'zipair', limit: 30 }), fb = await safe({ airline: 'skymark', limit: 30 });
  await asUser(60);                                       // この下は会員60の続き
  ok(unused && noRule && fine(answered) && answered.mine_count > 0
     && fine(fa) && fine(fb) && fa.mine_count === 0 && fb.mine_count === 0 && idsOf(fa) === idsOf(fb),
    '見せる決まりがまだ無い DB でも、次の質問は返る（人数は使わない）',
    JSON.stringify({ unused, noRule, err: [answered, fa, fb].map((x) => x.__err || null),
                     got: [answered, fa, fb].map((x) => (x.questions || []).length), same: idsOf(fa) === idsOf(fb) }));
}

// 通貨つきの金額（Bond）
r = await submit({ airline: 'skymark', year: 2026, month: 8, answers: [
  { question_id: 'training_bond_amount', num: 5000000 }] });
ok(r.rejected[0]?.reason === 'bad_currency', '金額の質問は通貨が要る');
r = await submit({ airline: 'skymark', year: 2026, month: 8, answers: [
  { question_id: 'training_bond_amount', num: 5000000, currency: 'JPY' }] });
ok(r.saved === 1, '通貨コードつきなら保存できる');

// 自分の回答が読めること（詳細ページの初期表示）
console.log('\n▼ 自分の回答');
const my = await mine({ airline: 'skymark' });
// Bond の金額は Tier A の周回で既に答えている＝答え直しなので件数は増えない
ok(my.ok === true && my.answered_total === asked.length,
  `自分の回答を全部返す → ${my.answered_total}件（期待 ${asked.length}）`);
const other = await mine({});
ok(other.answered_total >= my.answered_total, '会社を指定しなければ全社ぶんを返す');
await asUser(99);
ok((await mine({})).answered_total === 0, '他人の回答は1件も混ざらない');

// 少しずつ答えるほど聞ける質問が増える（＝毎月戻る理由）
const fresh = await next({ airline: 'skymark', micro: true, limit: 30 });
ok(fresh.questions.length > 0, '初めての人にも★の質問が出る');

/* ── 出す問数と、聞き直すまでの窓 ────────────────────────────────
   ここが本番で間違うと「同じ質問が毎回出る」か「二度と出ない」になる。
   どちらも黙って起きるので、時計を進める代わりに行の日付を過去へずらして確かめる。 */
console.log('\n▼ 聞く頻度');

/* その人のその質問の日付を n 日前へずらす（時間を進める代わり）。
   updated_at は on conflict で now() に戻るので、直接 update する */
const ageRow = (n, airline, qid, days) => db.query(
  `update airline_conditions
      set updated_at = updated_at - make_interval(days => $3),
          skipped_at = skipped_at - make_interval(days => $3)
    where proof_hash = pv_condition_hash($1::uuid, $2, null) and question_id = $4`,
  [uid(n), airline, days, qid]);
const offered = async (n, airline, qid, limit = 30) => {
  await asUser(n);
  return (await next({ airline, limit })).questions.some((q) => q.id === qid);
};

// ⑮ まだ1問も答えていない人には、最初の3問が指定した順で出る
const BOOST3 = QUESTIONS.filter((q) => q.boost).sort((a, b) => b.boost - a.boost).map((q) => q.id);
await asUser(70);
let head = (await next({ airline: 'jal', micro: true, limit: 3 })).questions.map((q) => q.id);
ok(JSON.stringify(head) === JSON.stringify(BOOST3),
  `⑮ 回答ゼロの人には最初の3問がこの順で出る → ${head.join(' / ')}`, `期待 ${BOOST3.join(' / ')}`);
ok((await next({ airline: 'jal', micro: true, limit: 3 })).mine_count === 0,
  '   mine_count が 0（画面はこれを見て3問出す）');

// 1問答えると boost は効かなくなる（＝残りは普通の順に戻る）
await submit({ airline: 'jal', year: 2026, month: 8,
  answers: [{ question_id: BOOST3[0], code: 'yes' }] });
let nq = await next({ airline: 'jal', micro: true, limit: 3 });
ok(nq.mine_count === 1, `   1問答えたら mine_count が 1 → 画面は残り2問だけ出す`);
ok(!nq.questions.some((q) => q.id === BOOST3[0]), '   答えた質問はもう出ない');

// ⑪ スキップした質問は skip_reask_days の間は出ない
await asUser(71);
r = await submit({ airline: 'jal', year: 2026, month: 8,
  answers: [{ question_id: 'days_off_request', skip: true }] });
ok(r.ok === true && r.skipped === 1 && r.saved === 0,
  `スキップを受け付ける → skipped=${r.skipped} / saved=${r.saved}`);
ok(r.answered_total === 0, '   スキップは「答えた項目」に数えない');
ok(!(await offered(71, 'jal', 'days_off_request')),
  `⑪ スキップした質問は ${SETTINGS.skip_reask_days} 日の間は出ない`);
await ageRow(71, 'jal', 'days_off_request', SETTINGS.skip_reask_days - 1);
ok(!(await offered(71, 'jal', 'days_off_request')), `   ${SETTINGS.skip_reask_days - 1} 日後でもまだ出ない`);
await ageRow(71, 'jal', 'days_off_request', 2);
ok(await offered(71, 'jal', 'days_off_request'), `   ${SETTINGS.skip_reask_days + 1} 日後には戻ってくる`);

// ⑭ スキップした質問にあとから本当に答えると、行が増えず印だけ消える
const cntSkip = async (n) => one(
  `select count(*) n, count(*) filter (where skipped_at is not null) s
     from airline_conditions
    where proof_hash = pv_condition_hash($1::uuid,'jal',null) and question_id='days_off_request'`,
  [uid(n)]);
let b4 = await cntSkip(71);
await asUser(71);
await submit({ airline: 'jal', year: 2026, month: 8,
  answers: [{ question_id: 'days_off_request', code: 'yes' }] });
let af = await cntSkip(71);
ok(Number(b4.n) === 1 && Number(b4.s) === 1 && Number(af.n) === 1 && Number(af.s) === 0,
  `⑭ スキップ→回答で行が増えず、スキップの印が消える（${b4.n}行/印${b4.s} → ${af.n}行/印${af.s}）`);

// ⑫ 3本の窓が別々に効く（答えた=365 / わからない=180 / スキップ=90）
await asUser(72);
await submit({ airline: 'jal', year: 2026, month: 8, answers: [
  { question_id: 'days_off_request', code: 'yes' },
  { question_id: 'schedule_bidding', code: UNKNOWN }] });
await ageRow(72, 'jal', 'days_off_request', SETTINGS.unknown_reask_days + 1);
await ageRow(72, 'jal', 'schedule_bidding', SETTINGS.unknown_reask_days + 1);
ok(!(await offered(72, 'jal', 'days_off_request')),
  `⑫ 答えた質問は ${SETTINGS.unknown_reask_days + 1} 日ではまだ戻らない（窓は ${SETTINGS.answer_reask_days} 日）`);
ok(await offered(72, 'jal', 'schedule_bidding'),
  `   「わからない」は ${SETTINGS.unknown_reask_days} 日で戻る（同じ日数でも別の窓）`);
await ageRow(72, 'jal', 'days_off_request', SETTINGS.answer_reask_days - SETTINGS.unknown_reask_days);
ok(await offered(72, 'jal', 'days_off_request'),
  `   答えた質問も ${SETTINGS.answer_reask_days} 日を過ぎれば戻る（＝再確認）`);

// ⑯ 戻ってきた質問には前回の答えが付く（再確認の文言に使う）
await asUser(72);
nq = await next({ airline: 'jal', limit: 30 });
const back = nq.questions.find((q) => q.id === 'days_off_request');
ok(back?.mine_code === 'yes', `⑯ 戻ってきた質問に前回の答えが付く → ${back?.mine_code}`);
ok(nq.questions.find((q) => q.id === 'reserve_duty')?.mine_code === null,
  '   まだ一度も答えていない質問には付かない（初めて聞く文言になる）');
const unk = nq.questions.find((q) => q.id === 'schedule_bidding');
ok(unk?.mine_code === UNKNOWN, '   「わからない」だった質問にも前回の答えが付く');

// ⑬ スキップだけの行は、集計にも自分の回答にも出ない
for (const n of [81, 82, 83]) {
  await asUser(n);
  await submit({ airline: 'peach', year: 2026, month: 8,
    answers: [{ question_id: 'landing_pay', skip: true }] });
}
v = await rows(`select * from airline_condition_facts where airline='peach'`);
ok(v.length === 0, '⑬ スキップだけ3人では集計に出ない（n にも n_unknown にも入らない）');
await asUser(81);
ok((await mine({ airline: 'peach' })).answered_total === 0,
  '   自分の回答一覧にも出ない（詳細ページに空欄が並ばない）');
const stat = await rows(`select * from pv_contributor_stats()
  where proof_hash = pv_condition_hash($1::uuid,'peach',null)`, [uid(81)]);
ok(stat.length === 0, '   貢献者の集計にも数えない');

// ⑰ 日数は SQL の直書きではなく設定表から来ている
await asUser(84);
await submit({ airline: 'peach', year: 2026, month: 8,
  answers: [{ question_id: 'days_off_request', code: 'yes' }] });
await ageRow(84, 'peach', 'days_off_request', SETTINGS.answer_reask_days - 10);
ok(!(await offered(84, 'peach', 'days_off_request')), '⑰ 既定の窓ではまだ戻らない');
await db.exec(`update pv_condition_settings set value = 30 where key = 'answer_reask_days'`);
ok(await offered(84, 'peach', 'days_off_request'),
  '   設定表の値を 30 日に変えると戻る（SQL に日数が直書きされていない証拠）');
await db.exec(`update pv_condition_settings set value = ${SETTINGS.answer_reask_days}
               where key = 'answer_reask_days'`);
ok(!(await offered(84, 'peach', 'days_off_request')), '   元に戻すとまた黙る');

/* ⑱ 通勤の移動 ── 手段ごとに分けて聞く（2026-10-04）。
   あいだの親（commuting_transport_method）は「複数選ぶ」質問で、タクシーの3問と
   クルーバスの2問が、選んだ手段ごとに別々に開く。
   ★ここが壊れても画面は普通に動く（タクシーの条件がバスの人にも出る・バスの答えが
     タクシーの欄に混ざる）ので、ここでしか気づけない。
   見ること:
     ・両方を選んだ人には5問とも出る／片方だけの人には、選んでいない手段の質問が出ない・
       送っても受け取られない
     ・同じ人が「バスは制限なし・会社が全額」「タクシーは公共交通が動いていない時間だけ・
       一部は本人」を別々の行として残せる
     ・いちばん上（通勤の移動があるか）を条件の外へ答え直すと、その下は出ない・受けない・数えない
   ⚠️ next の上限は30問。一覧が上限で切れていたら「出ない」は証拠にならないので、
      切れていないことを一緒に見る（uncut）。 */
console.log('\n▼ ⑱ 通勤の移動 ── タクシーとクルーバスを別々に聞く（親が「複数選ぶ」質問）');
const QBY = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
const kids = (pid) => QUESTIONS.filter((q) => q.parent === pid).map((q) => q.id);
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const TAXI = ['commuting_taxi_when', 'commuting_taxi_where', 'commuting_taxi_cost'];
const BUS = ['commuting_bus_when', 'commuting_bus_cost'];
const CAP = 'commuting_taxi_cap';   // 話題の入口からだけ出す上限の1問（見るのは ⑳）
const GONE = ['commuting_transport_when', 'commuting_transport_where', 'commuting_transport_cost'];
const CT = QBY.commuting_transport, METHOD = QBY.commuting_transport_method;
const CT_IN = METHOD.parentWhen[0];
const CT_OUT = CT.choices.find((c) => c.code !== UNKNOWN && !METHOD.parentWhen.includes(c.code)).code;

ok(METHOD.kind === 'multi' && METHOD.parent === CT.id, '   あいだの親は「複数選ぶ」質問（手段をいくつでも選べる）');
ok(same(kids(METHOD.id), [...TAXI, ...BUS, CAP]),
  '   手段の下に在るのはタクシー3問とクルーバス2問、それと話題の入口からだけ出す上限の1問だけ',
  JSON.stringify(kids(METHOD.id)));
ok(TAXI.every((id) => same(QBY[id].parentWhen, ['company_taxi', 'reimburse'])),
  '   タクシーの3問は「会社手配のタクシー」「立て替えて精算」のときだけ開く');
ok(BUS.every((id) => same(QBY[id].parentWhen, ['crew_bus'])), '   クルーバスの2問は「クルーバス」のときだけ開く');
ok(GONE.every((id) => !QBY[id]), '   手段を混ぜて聞いていた3問はバンクに無い');
ok(Number((await one(`select count(*) n from pv_condition_questions where active and id = any($1)`, [GONE])).n) === 0,
  '   DB の質問マスタでも有効になっていない');
const choiceSig = (id) => JSON.stringify(QBY[id].choices.map((c) => [c.code, c.ja, c.en]));
ok(choiceSig('commuting_taxi_when') === choiceSig('commuting_bus_when'),
  '   「どんなときに使えるか」の選択肢は、タクシーとクルーバスで同じ（手段どうしを比べられる）');
ok(QBY.commuting_taxi_when.choices[0].code === 'any_time' && QBY.commuting_bus_when.choices[0].code === 'any_time',
  '   どちらも先頭の選択肢が「制限はない（いつでも）」');
/* 親が隣に無い所（1問だけ出す画面・通知・集計）でも、どの手段の話か分かる見出し */
ok(TAXI.every((id) => QBY[id].ja.label.includes('タクシー') && /taxi/i.test(QBY[id].en.label)),
  '   タクシーの3問は、見出しだけで「タクシーの話」と分かる（日英）');
ok(BUS.every((id) => QBY[id].ja.label.includes('クルーバス') && /crew bus/i.test(QBY[id].en.label)),
  '   クルーバスの2問は、見出しだけで「クルーバスの話」と分かる（日英）');
const words = (q) => [q.ja.label, q.en.label, q.ja.help || '', q.en.help || '',
  ...(q.choices || []).flatMap((c) => [c.ja, c.en])];
ok([...TAXI, ...BUS].every((id) => words(QBY[id]).every((w) => !/[0-9０-９]/.test(w))),
  '   金額・距離・時刻の数字を1つも書いていない（見出し・補足・選択肢）');
ok(QUESTIONS.every((q) => !q.ja.label.includes('早朝・深夜の通勤条件')),
  '   「早朝・深夜の通勤条件」を見出しに使っていない');

const CM = { airline: 'starflyer', year: 2026, month: 8 };
/* いま候補に出る質問（上限で切れていないことも一緒に返す） */
const offer = async (n, airline) => {
  await asUser(n);
  const q = (await next({ airline, limit: 30 })).questions.map((x) => x.id);
  return { ids: q, uncut: q.length < 30 };
};
const mineOf = async (n, airline) => {
  await asUser(n);
  return Object.fromEntries((await mine({ airline })).answers.map((a) => [a.question_id, a]));
};
const allMissing = (res, ids) => res.saved === 0 && same(res.rejected.map((x) => x.question_id), ids)
  && res.rejected.every((x) => x.reason === 'parent_missing');
const send5 = (pick) => [
  { question_id: 'commuting_taxi_when', codes: ['disruption'] },
  { question_id: 'commuting_taxi_where', code: 'door_to_door' },
  { question_id: 'commuting_taxi_cost', code: 'self_full' },
  { question_id: 'commuting_bus_when', codes: ['disruption'] },
  { question_id: 'commuting_bus_cost', code: 'self_full' }].filter((a) => pick.includes(a.question_id));

// 手段をまだ答えていない人
let o = await offer(201, CM.airline);
ok(o.uncut && [...TAXI, ...BUS].every((id) => !o.ids.includes(id)), '⑱ 何も答えていない人には5問とも出ない');
await submit({ ...CM, answers: [{ question_id: CT.id, code: CT_IN }] });
o = await offer(201, CM.airline);
ok(o.uncut && o.ids.includes(METHOD.id) && [...TAXI, ...BUS].every((id) => !o.ids.includes(id)),
  '   通勤の移動が「ある」だけでは、手段を聞く質問だけが出る（5問はまだ出ない）');
r = await submit({ ...CM, answers: send5([...TAXI, ...BUS]) });
ok(allMissing(r, [...TAXI, ...BUS]), '   手段を答える前に5問を送っても受け取らない',
  JSON.stringify(r.rejected));

// タクシーとクルーバスの両方を選んだ人
r = await submit({ ...CM, answers: [{ question_id: METHOD.id, codes: ['company_taxi', 'crew_bus'] }] });
ok(r.saved === 1, '   手段を2つ選んで保存できる（会社手配のタクシー・クルーバス）');
o = await offer(201, CM.airline);
ok([...TAXI, ...BUS].every((id) => o.ids.includes(id)), '⑱ ★両方を選んだ人には5問とも出る',
  JSON.stringify(o.ids.filter((id) => id.startsWith('commuting_'))));
r = await submit({ ...CM, answers: [
  { question_id: 'commuting_bus_when', codes: ['any_time'] },
  { question_id: 'commuting_bus_cost', code: 'company_full' },
  { question_id: 'commuting_taxi_when', codes: ['no_public_transport'] },
  { question_id: 'commuting_taxi_cost', code: 'partial' }] });
ok(r.saved === 4 && r.rejected.length === 0, '   バスの2問とタクシーの2問を、1回の送信で別々に保存できる',
  JSON.stringify(r.rejected));
let m = await mineOf(201, CM.airline);
ok(same(m.commuting_bus_when?.codes || [], ['any_time']) && m.commuting_bus_cost?.code === 'company_full',
  '⑱ ★「バスは制限なし・会社が全額」が、バスの行に残る',
  JSON.stringify([m.commuting_bus_when?.codes, m.commuting_bus_cost?.code]));
ok(same(m.commuting_taxi_when?.codes || [], ['no_public_transport']) && m.commuting_taxi_cost?.code === 'partial',
  '⑱ ★「タクシーは公共交通が動いていない時間だけ・一部は本人」が、同じ人のタクシーの行に残る',
  JSON.stringify([m.commuting_taxi_when?.codes, m.commuting_taxi_cost?.code]));
ok(!m.commuting_taxi_where, '   答えていない質問（タクシーでどこまで）は空のまま（ほかの答えで埋めない）');

// クルーバスだけを選んだ人
await asUser(202);
await submit({ ...CM, answers: [{ question_id: CT.id, code: CT_IN },
  { question_id: METHOD.id, codes: ['crew_bus'] }] });
o = await offer(202, CM.airline);
ok(o.uncut && BUS.every((id) => o.ids.includes(id)) && TAXI.every((id) => !o.ids.includes(id)),
  '⑱ ★クルーバスだけの人には、バスの2問だけが出る（タクシーの3問は出ない）',
  JSON.stringify(o.ids.filter((id) => id.startsWith('commuting_'))));
r = await submit({ ...CM, answers: send5(TAXI) });
ok(allMissing(r, TAXI), '⑱ ★クルーバスだけの人がタクシーの3問を送っても受け取らない', JSON.stringify(r.rejected));
r = await submit({ ...CM, answers: [{ question_id: 'commuting_bus_when', codes: ['any_time'] },
  { question_id: 'commuting_bus_cost', code: 'company_full' }] });
ok(r.saved === 2, '   バスの2問は受け取る');

// タクシーだけ（立て替えて精算）を選んだ人
await asUser(203);
await submit({ ...CM, answers: [{ question_id: CT.id, code: CT_IN },
  { question_id: METHOD.id, codes: ['reimburse'] }] });
o = await offer(203, CM.airline);
ok(o.uncut && TAXI.every((id) => o.ids.includes(id)) && BUS.every((id) => !o.ids.includes(id)),
  '   立て替えて精算だけの人には、タクシーの3問だけが出る（バスの2問は出ない）',
  JSON.stringify(o.ids.filter((id) => id.startsWith('commuting_'))));
r = await submit({ ...CM, answers: send5(BUS) });
ok(allMissing(r, BUS), '   その人がバスの2問を送っても受け取らない', JSON.stringify(r.rejected));

// どちらでもない手段（ホテル）／手段が「わからない」人
await asUser(204);
await submit({ ...CM, answers: [{ question_id: CT.id, code: CT_IN },
  { question_id: METHOD.id, codes: ['hotel'] }] });
o = await offer(204, CM.airline);
ok(o.uncut && [...TAXI, ...BUS].every((id) => !o.ids.includes(id)), '   ホテルだけの人には5問とも出ない');
r = await submit({ ...CM, answers: [{ question_id: METHOD.id, code: UNKNOWN }] });
ok(r.saved === 1, '   手段が「わからない」も保存できる');
r = await submit({ ...CM, answers: send5([...TAXI, ...BUS]) });
ok(allMissing(r, [...TAXI, ...BUS]), '   手段が「わからない」の人から5問を受け取らない', JSON.stringify(r.rejected));

// 集計 ── 手段を選んだ人のぶんだけを数える
await asUser(205);
await submit({ ...CM, answers: [{ question_id: CT.id, code: CT_IN },
  { question_id: METHOD.id, codes: ['crew_bus', 'other'] },
  { question_id: 'commuting_bus_cost', code: 'company_full' }] });
const factN = async (airline, qid) => {
  const f = await rows(`select n, answer_dist from airline_condition_facts where airline = $1 and question_id = $2`,
    [airline, qid]);
  return f.length ? f[0] : null;
};
let f = await factN(CM.airline, 'commuting_bus_cost');
ok(f && f.n === 3 && f.answer_dist.company_full === 3, '⑱ バスの費用に3人が答えたら集計に出る（3人とも会社が全額）',
  JSON.stringify(f));
ok((await factN(CM.airline, 'commuting_taxi_cost')) === null,
  '   タクシーの費用は1人だけ ＝ 出ない（バスの答えがタクシーの欄に混ざらない）');

// あいだの親（手段）からクルーバスを外した人のぶんは数えない
await asUser(202);
await submit({ ...CM, answers: [{ question_id: METHOD.id, codes: ['hotel'] }] });
ok((await factN(CM.airline, 'commuting_bus_cost')) === null,
  '⑱ ★手段からクルーバスを外した人の、バスの古い答えを数え続けない（3人 → 2人で出なくなる）');
m = await mineOf(202, CM.airline);
ok(m.commuting_bus_cost?.code === 'company_full', '   行は消していない（答え直せば、また数える）');
await asUser(202);
await submit({ ...CM, answers: [{ question_id: METHOD.id, codes: ['crew_bus', 'hotel'] }] });
ok((await factN(CM.airline, 'commuting_bus_cost'))?.n === 3, '   クルーバスを選び直すと、また3人に戻る');

// いちばん上（通勤の移動があるか）を条件の外へ答え直した人
await asUser(201);
await submit({ ...CM, answers: [{ question_id: CT.id, code: CT_OUT }] });
o = await offer(201, CM.airline);
ok(o.uncut && [METHOD.id, ...TAXI, ...BUS].every((id) => !o.ids.includes(id)),
  '⑱ ★いちばん上を「ない」に答え直すと、手段もその下の5問も出ない');
r = await submit({ ...CM, answers: send5(['commuting_taxi_where']) });
ok(allMissing(r, ['commuting_taxi_where']),
  '   手段の古い答えが条件に合っていても、その下の質問を受け取らない（いちばん上まで見る）',
  JSON.stringify(r.rejected));
ok((await factN(CM.airline, 'commuting_bus_cost')) === null, '   その人のバスの答えも数えない（3人 → 2人）');
await asUser(201);
await submit({ ...CM, answers: [{ question_id: CT.id, code: CT_IN }] });
ok((await factN(CM.airline, 'commuting_bus_cost'))?.n === 3, '   元に戻すと、前の答えのまま数に戻る');

/* ⑲ 社員向け航空券を使える人 ── 券の種類ごとに分けて聞く（2026-10-04）。
   「空席待ちは親まで・座席を確保できる券は本人だけ」のように、券によって使える人が違う会社を
   1つの質問で聞くと、どちらの話か分からない答えが残る。
   共通の1問（staff_travel_family）は本番に在るので触っていない。 */
console.log('\n▼ ⑲ 社員向け航空券を使える人 ── 空席待ちと座席確保を別々に聞く');
const FAM_S = 'staff_travel_standby_family', FAM_C = 'staff_travel_confirmed_family';
const ST = QBY.staff_travel, BOOK = QBY.staff_travel_booking;
ok(QBY[FAM_S].kind === 'multi' && QBY[FAM_C].kind === 'multi'
   && QBY[FAM_S].parent === BOOK.id && QBY[FAM_C].parent === BOOK.id,
  '   2問とも「複数選ぶ」質問で、親は「空席待ちか・座席確保か」');
ok(same(QBY[FAM_S].parentWhen, ['standby', 'both']) && same(QBY[FAM_C].parentWhen, ['both', 'confirmed']),
  '   空席待ちの券を持つ人・座席確保の券を持つ人に、それぞれだけ開く');
ok(choiceSig(FAM_S) === choiceSig(FAM_C), '   使える人の選択肢は、2つの券で同じ（券どうしを比べられる）');
ok(same(QBY[FAM_S].choices.map((c) => c.code),
        ['self', 'partner', 'children', 'parents', 'siblings', 'nominee', 'other']),
  '   選択肢は 本人・配偶者／パートナー・子・親・きょうだい・指名した人・その他');
ok(QBY.staff_travel_family && !QBY.staff_travel_family.parentWhen.includes(UNKNOWN)
   && QBY.staff_travel_family.parent === ST.id, '   共通の1問（staff_travel_family）は今までどおり在る');

const FT = { airline: 'airdo', year: 2026, month: 8 };
const ST_IN = BOOK.parentWhen[0];
const book = async (n, code) => {
  await asUser(n);
  return submit({ ...FT, answers: [{ question_id: ST.id, code: ST_IN }, { question_id: BOOK.id, code }] });
};
await book(211, 'both');
o = await offer(211, FT.airline);
ok(o.uncut && o.ids.includes(FAM_S) && o.ids.includes(FAM_C), '⑲ 両方の券がある人には、2問とも出る');
r = await submit({ ...FT, answers: [
  { question_id: FAM_S, codes: ['self', 'partner', 'children', 'parents'] },
  { question_id: FAM_C, codes: ['self'] }] });
ok(r.saved === 2 && r.rejected.length === 0, '   2問を1回の送信で別々に保存できる', JSON.stringify(r.rejected));
m = await mineOf(211, FT.airline);
ok(same(m[FAM_S]?.codes || [], ['self', 'partner', 'children', 'parents']) && same(m[FAM_C]?.codes || [], ['self']),
  '⑲ ★「空席待ちは親まで・座席確保は本人だけ」を、同じ人が別々の行に残せる',
  JSON.stringify([m[FAM_S]?.codes, m[FAM_C]?.codes]));

await book(212, 'standby');
o = await offer(212, FT.airline);
ok(o.uncut && o.ids.includes(FAM_S) && !o.ids.includes(FAM_C),
  '⑲ 空席待ちだけの人には、座席確保の券の質問が出ない');
r = await submit({ ...FT, answers: [{ question_id: FAM_C, codes: ['self'] }] });
ok(allMissing(r, [FAM_C]), '   送っても受け取らない', JSON.stringify(r.rejected));

await book(213, 'confirmed');
o = await offer(213, FT.airline);
ok(o.uncut && o.ids.includes(FAM_C) && !o.ids.includes(FAM_S),
  '⑲ 座席確保だけの人には、空席待ちの券の質問が出ない');
r = await submit({ ...FT, answers: [{ question_id: FAM_S, codes: ['self'] }] });
ok(allMissing(r, [FAM_S]), '   送っても受け取らない', JSON.stringify(r.rejected));
r = await submit({ ...FT, answers: [{ question_id: FAM_C, codes: ['self', 'grandparents'] }] });
ok(r.saved === 0 && r.rejected[0]?.reason === 'bad_code', '   選択肢に無い人（祖父母など）は受け取らない');

/* ⑳ 話題の入口からだけ出す4問（2026-10-04・オーナー判断「4問を足し、その話題の入口から来た人にだけ出す」）。
   通勤のタクシー代の上限と、機長昇格の3問。提出直後の1問枠にも一覧にも出さず、
   「答えた項目：N／M」の分母にも分子にも数えない。保存・自分の回答・集計は他の質問と同じ。
   ★ここが壊れても画面は普通に動く（1問枠に昇格の条件が混ざる・N が M を超える・
     話題の入口で先に1問答えた人に最初の3問が出なくなる）ので、ここでしか気づけない。 */
console.log('\n▼ ⑳ 話題の入口からだけ出す4問 ── 1問枠にも「答えた項目」の数にも混ぜない');
const UPG = ['upgrade_order', 'upgrade_min_hours', 'upgrade_min_tenure'];
const ONLY4 = [CAP, ...UPG];
const TOPIC_IDS = ['taxi', 'staff_travel', 'upgrade'];
/* その質問から上へたどった先（自分を含む）に root が居るか */
const under = (root) => QUESTIONS.filter((q) => {
  for (let x = q; x; x = x.parent ? QBY[x.parent] : null) if (x.id === root) return true;
  return false;
}).map((q) => q.id);
const withTopic = (t) => QUESTIONS.filter((q) => q.topic === t).map((q) => q.id);

ok(same(TOPIC_ONLY.map((q) => q.id), ONLY4), '   話題の入口からだけ出すのは、この4問だけ（今までの質問には付いていない）',
  JSON.stringify(TOPIC_ONLY.map((q) => q.id)));
ok(ONLY4.every((id) => QBY[id] && QBY[id].kind === 'choice' && !QBY[id].micro && !QBY[id].boost
     && QBY[id].choices[QBY[id].choices.length - 1].code === UNKNOWN),
  '   4問とも1つ選ぶ質問で、最後の選択肢が「わからない」。1問枠の印（micro・boost）は付いていない');
ok(ONLY4.every((id) => !/その|それ/.test(QBY[id].ja.label) && !/\b(it|its|that|this|those)\b/i.test(QBY[id].en.label)),
  '   見出しが前の質問を指していない（「その」「それ」を使わない・日英）');
ok(QBY[CAP].ja.label.includes('タクシー') && /taxi/i.test(QBY[CAP].en.label)
   && UPG.every((id) => QBY[id].ja.label.includes('機長') && /captain/i.test(QBY[id].en.label)),
  '   見出しだけで何の話か分かる（タクシー／機長昇格・日英）');
ok(QBY[CAP].parent === METHOD.id && same(QBY[CAP].parentWhen, QBY.commuting_taxi_cost.parentWhen),
  '   上限の質問が開く条件は、タクシーの費用の質問と同じ（タクシーを選んだ人だけ）');
ok(ONLY4.every((id) => !QBY[id].num && !QBY[id].currency),
  '   4問とも数値の欄を持たない（額・時間・年数は段で聞く）');
ok(UPG.every((id) => !QBY[id].parent), '   機長昇格の3問は親を持たない');
ok(QBY[CAP].note === true && QBY.upgrade_order.note === true
   && !QBY.upgrade_min_hours.note && !QBY.upgrade_min_tenure.note,
  '   詳しい説明（任意の補足）を書けるのは、上限と昇格の順番の2問');

// 話題の印が付いている質問の集合
ok(same(withTopic('taxi'), under(CT.id)) && withTopic('taxi').includes(CAP),
  `   話題「通勤タクシー」＝ 通勤の移動の枝ぜんぶ（${withTopic('taxi').length}問・上限の1問を含む）`,
  JSON.stringify(withTopic('taxi')));
ok(same(withTopic('staff_travel'), under('staff_travel')),
  `   話題「社員向け航空券」＝ 社員向け航空券の枝ぜんぶ（${withTopic('staff_travel').length}問）`,
  JSON.stringify(withTopic('staff_travel')));
ok(same(withTopic('upgrade'), ['upgrade_years', ...UPG]),
  '   話題「機長昇格」＝ 昇格までの年数 ＋ 新しい3問', JSON.stringify(withTopic('upgrade')));
ok(QUESTIONS.every((q) => q.topic == null || TOPIC_IDS.includes(q.topic))
   && QUESTIONS.filter((q) => q.topic).length
      === TOPIC_IDS.reduce((n, t) => n + withTopic(t).length, 0),
  '   それ以外の質問に話題の印は付いていない');
const topicGap = QUESTIONS.filter((q) => (dbq[q.id]?.topic ?? null) !== (q.topic ?? null)
  || dbq[q.id]?.topic_only !== !!q.topicOnly).map((q) => q.id);
ok(topicGap.length === 0, '   DB の質問マスタの topic / topic_only が、生成元と1問残らず同じ', JSON.stringify(topicGap));

/* 上書きの側を通す（2026-10-05・検品の指摘）。
   上の1行が見たのは**空の DB に流した結果**＝どの質問も insert の側で入っている。
   オーナーが貼る先は逆で、印の列が無いまま質問がもう入っている。そこで起きるのは
   「列を足す → 今までの質問は on conflict … do update で印が付く → 4問だけ新しく入る」で、
   印が付くかどうかは update set の並びだけが決める。
   ★update set から topic / topic_only を落としても、ここ以外は1つも赤くならない。貼った先では
     今までの質問に話題の印が1つも付かず、あとから入口だけに回した質問は一覧と1問枠に出続ける。 */
const regen = async () => {
  try { await db.exec(read('db/conditions.generated.sql')); return null; }
  catch (e) { return String(e.message || e); }
};
const marks = async () => {
  const got = Object.fromEntries((await rows(
    `select id, topic, topic_only, active from pv_condition_questions`)).map((x) => [x.id, x]));
  return {
    gap: QUESTIONS.filter((q) => (got[q.id]?.topic ?? null) !== (q.topic ?? null)
      || got[q.id]?.topic_only !== !!q.topicOnly).map((q) => q.id),
    listed: Object.values(got).filter((x) => x.active && !x.topic_only).length,
    only: Object.values(got).filter((x) => x.active && x.topic_only).length,
  };
};

// ① 印の列が無かった頃の形（4問なし・列なし）へ戻してから流す ＝ 貼る先で起きること
await db.query(`delete from pv_condition_questions where id = any($1)`, [ONLY4]);
await db.exec(`alter table pv_condition_questions drop column topic_only, drop column topic`);
v = await rows(`select column_name from information_schema.columns
  where table_schema='public' and table_name='pv_condition_questions' and column_name in ('topic','topic_only')`);
const oldN = Number((await one(`select count(*) n from pv_condition_questions where active`)).n);
ok(v.length === 0 && oldN === LISTED.length,
  `   （下ごしらえ）印の列が無く、質問は ${LISTED.length} ＝ 4問を足す前の形`, `列 ${v.length}・質問 ${oldN}`);
/* 期待する数は LISTED / TOPIC_ONLY から取る（48 と 4 は、質問マスタの節の1行が数字で固定している） */
const marksOk = (x) => x.gap.length === 0 && x.listed === LISTED.length && x.only === TOPIC_ONLY.length;
let upErr = await regen();
let mk = upErr ? null : await marks();
ok(upErr === null && marksOk(mk),
  `⑳ ★印の列が無い質問マスタに流すと、今までの質問に話題の印が付き、4問が入る（一覧 ${LISTED.length}・入口だけ ${TOPIC_ONLY.length}）`,
  upErr || `${JSON.stringify(mk.gap)}・一覧 ${mk.listed}・入口だけ ${mk.only}`);
// 列が戻らないまま先へ進むと、下が全部別の理由で赤くなる。ここで止める
if (upErr) { console.log(`\n══ ${pass} pass / ${fail} fail ══`); process.exit(1); }

// ② 印だけ消してもう一度流す ＝ 4問も上書きの側を通る（①では新しく入った側だった）
const MARKED = QUESTIONS.filter((q) => q.topic).map((q) => q.id);
await db.query(`update pv_condition_questions set topic = null, topic_only = false where id = any($1)`, [MARKED]);
mk = await marks();
ok(mk.only === 0 && same(mk.gap, MARKED), `   （下ごしらえ）話題の印を全部消した（${MARKED.length}問）`,
  `入口だけ ${mk.only}・${JSON.stringify(mk.gap)}`);
upErr = await regen();
mk = upErr ? null : await marks();
ok(upErr === null && marksOk(mk),
  `⑳ ★印を消してから流し直すと、topic も topic_only も1問残らず戻る（一覧 ${LISTED.length}・入口だけ ${TOPIC_ONLY.length}）`,
  upErr || `${JSON.stringify(mk.gap)}・一覧 ${mk.listed}・入口だけ ${mk.only}`);

// DB 側の検品（生成元を通さず手で1行直されたときに効く）
ok((await boom(`update pv_condition_questions set micro = true where id = 'upgrade_min_hours'`)) !== null,
  '   DB でも、話題の入口からだけ出す質問を1問枠（micro）に回せない');
ok((await boom(`update pv_condition_questions set boost = 9 where id = 'upgrade_min_hours'`)) !== null,
  '   最初の3問（boost）にも回せない');
ok((await boom(`update pv_condition_questions set topic_only = true where id = 'reserve_duty'`)) !== null,
  '   入口（topic）の無い質問を、話題の入口からだけ出す質問にできない');
ok((await boom(`update pv_condition_questions set topic = 'salary' where id = 'reserve_duty'`)) !== null,
  '   知らない話題の印を付けられない');

const TP = { airline: 'ana', year: 2026, month: 8 };
const cntOnly4 = async (n, airline) => Number((await one(
  `select count(*) n from airline_conditions
    where proof_hash = pv_condition_hash($1::uuid, $2, null) and question_id = any($3)`,
  [uid(n), airline, ONLY4])).n);

// まだ1問も答えていない人
o = await offer(221, TP.airline);
ok(o.uncut && ONLY4.every((id) => !o.ids.includes(id)), '⑳ ★何も答えていない人に、4問とも出ない（一覧の「次の質問」）');
nq = await next({ airline: TP.airline, micro: true, limit: 30 });
ok(nq.questions.length < 30 && ONLY4.every((id) => !nq.questions.some((q) => q.id === id)),
  '⑳ ★提出直後の1問枠にも出ない');

// 話題の入口（機長昇格）で、先に1問だけ答えた人
r = await submit({ ...TP, answers: [{ question_id: 'upgrade_order', code: 'seniority_selection', text: '筆記と面接がある' }] });
ok(r.saved === 1 && r.rejected.length === 0, '   親に何も答えていなくても、昇格の質問は保存できる', JSON.stringify(r.rejected));
ok(r.answered_total === 0 && r.questions_total === LISTED.length,
  `⑳ ★話題の質問に答えても「答えた項目」は 0／${LISTED.length} のまま（分子にも分母にも数えない）`,
  `${r.answered_total}／${r.questions_total}`);
nq = await next({ airline: TP.airline, micro: true, limit: 3 });
ok(JSON.stringify(nq.questions.map((q) => q.id)) === JSON.stringify(BOOST3) && nq.mine_count === 0,
  '⑳ ★その人にも、最初の3問がこの順で出る（mine_count は 0 のまま）',
  `${nq.questions.map((q) => q.id).join(' / ')}・mine_count=${nq.mine_count}`);

// 上限の質問は、タクシーを選んだ人からだけ受け取る
r = await submit({ ...TP, answers: [{ question_id: CAP, code: 'per_ride' }] });
ok(allMissing(r, [CAP]), '   通勤の移動に何も答えていない人から、上限の答えを受け取らない', JSON.stringify(r.rejected));
r = await submit({ ...TP, answers: [{ question_id: CT.id, code: CT_IN },
  { question_id: METHOD.id, codes: ['company_taxi'] }] });
ok(r.saved === 2 && r.answered_total === 2, `   一覧に出る質問に2問答えると 2／${LISTED.length}`);
o = await offer(221, TP.airline);
ok(o.uncut && TAXI.every((id) => o.ids.includes(id)) && !o.ids.includes(CAP),
  '⑳ ★タクシーを選んだ人には今までの3問が出て、上限の質問は出ない',
  JSON.stringify(o.ids.filter((id) => id.startsWith('commuting_'))));

// 4問そろえて保存する
r = await submit({ ...TP, answers: [
  { question_id: CAP, code: 'per_ride', text: '深夜だけ上限が上がる' },
  { question_id: 'upgrade_min_hours', code: 'h3000_4999', text: 'ここは補足の欄が無い質問' },
  { question_id: 'upgrade_min_tenure', code: 'y3_5' }] });
ok(r.saved === 3 && r.rejected.length === 0, '   残りの3問も保存できる（上限・必要な飛行時間・必要な在籍年数）',
  JSON.stringify(r.rejected));
ok(r.answered_total === 2 && r.questions_total === LISTED.length,
  `⑳ ★4問とも答えても 2／${LISTED.length} のまま（増えない・分母も動かない）`,
  `${r.answered_total}／${r.questions_total}`);
let my4 = await mine({ airline: TP.airline });
m = Object.fromEntries(my4.answers.map((a) => [a.question_id, a]));
ok(m[CAP]?.code === 'per_ride' && m.upgrade_order?.code === 'seniority_selection'
   && m.upgrade_min_hours?.code === 'h3000_4999' && m.upgrade_min_tenure?.code === 'y3_5',
  '⑳ ★自分の回答に4問とも返る（話題の入口の画面が、前に選んだ答えを出せる）',
  JSON.stringify(ONLY4.map((id) => [id, m[id]?.code])));
/* ★2026-10-07 オーナー指定「選択回答に任意の補足説明を添えられる」。
     前は欄を持つ2問だけ残し、ほかの質問に送った文は黙って捨てていた。いまはどの質問でも残る。 */
ok(m[CAP]?.text === '深夜だけ上限が上がる' && m.upgrade_order?.text === '筆記と面接がある'
   && m.upgrade_min_hours?.text === 'ここは補足の欄が無い質問' && m.upgrade_min_tenure?.text === null,
  '   任意の補足は、どの質問でも残る（送っていない質問は空のまま）');
/* 補足を会員に見せてよい印は、「見せます」と書いた画面から送られたときだけ立つ。
     印を付けずに送る今までの画面の補足は、本人しか読めないまま（db/contrib.sql が印の行だけ返す）。 */
{
  const shared = async () => Object.fromEntries((await rows(
    `select question_id, text_shared from airline_conditions
      where airline = $1 and proof_hash = pv_condition_hash($2::uuid, $1, null)`,
    [TP.airline, uid(221)])).map((x) => [x.question_id, x.text_shared]));
  let sh = await shared();
  ok(ONLY4.every((id) => sh[id] === false), '   ★補足を見せてよい印は、何も言わなければ付かない（今までの補足は本人だけ）',
    JSON.stringify(sh));
  r = await submit({ ...TP, answers: [
    { question_id: 'upgrade_min_hours', code: 'h3000_4999', text: 'ここは補足の欄が無い質問', share: true },
    { question_id: 'upgrade_min_tenure', code: 'y3_5', share: true }] });
  sh = await shared();
  ok(r.saved === 2 && sh.upgrade_min_hours === true && sh.upgrade_min_tenure === false && sh[CAP] === false,
    '   ★「見せます」と送った補足にだけ印が付く（文の無い答えには付かない・ほかの行は動かない）',
    JSON.stringify(sh));
  {
    const back = Object.fromEntries((await mine({ airline: TP.airline })).answers.map((x) => [x.question_id, x.shared]));
    ok(back.upgrade_min_hours === true && back.upgrade_min_tenure === false && back[CAP] === false,
      '   ★本人の読み口が、その印をそのまま返す（画面が、直していない補足の印を勝手に変えないため）',
      JSON.stringify(back));
  }
  r = await submit({ ...TP, answers: [
    { question_id: 'upgrade_min_hours', code: 'h3000_4999', text: 'ここは補足の欄が無い質問' }] });
  sh = await shared();
  ok(sh.upgrade_min_hours === false, '   印を付けずに出し直すと、印は外れる（黙って見せ続けない）', JSON.stringify(sh));
}
ok(my4.answers.length === 6 && my4.answered_total === 2 && my4.questions_total === LISTED.length,
  `⑳ ★自分の回答は6件返るが、「答えた項目」は 2／${LISTED.length}（話題の4問を数えない）`,
  `answers=${my4.answers.length}・${my4.answered_total}／${my4.questions_total}`);
ok((await next({ airline: TP.airline, limit: 1 })).mine_count === 2, '   mine_count も 2 のまま');

// 答え直し
const n4 = await cntOnly4(221, TP.airline);
r = await submit({ ...TP, answers: [
  { question_id: CAP, code: 'by_zone' },
  { question_id: 'upgrade_order', code: 'vacancy_bid' },
  { question_id: 'upgrade_min_hours', code: 'none' },
  { question_id: 'upgrade_min_tenure', code: UNKNOWN }] });
m = await mineOf(221, TP.airline);
ok(r.saved === 4 && n4 === 4 && (await cntOnly4(221, TP.airline)) === 4,
  '⑳ 4問を出し直しても行が増えない（1人1社1問につき1行）');
ok(m[CAP]?.code === 'by_zone' && m.upgrade_order?.code === 'vacancy_bid'
   && m.upgrade_min_hours?.code === 'none' && m.upgrade_min_tenure?.code === UNKNOWN,
  '⑳ ★出し直した答えで上書きされる', JSON.stringify(ONLY4.map((id) => [id, m[id]?.code])));
ok(m[CAP]?.text === null && m.upgrade_order?.text === null, '   補足を書かずに出し直すと、前の補足は残らない');
ok(r.answered_total === 2, '   出し直しても「答えた項目」は 2 のまま');
r = await submit({ ...TP, answers: [{ question_id: 'upgrade_order', code: 'lottery' }] });
ok(r.saved === 0 && r.rejected[0]?.reason === 'bad_code', '   選択肢に無い答えは受け取らない');

// 窓が切れても、1問枠と一覧には戻ってこない（聞き直すのも話題の入口から）
for (const id of ONLY4) await ageRow(221, TP.airline, id, SETTINGS.answer_reask_days + 1);
o = await offer(221, TP.airline);
nq = await next({ airline: TP.airline, micro: true, limit: 30 });
ok(o.uncut && ONLY4.every((id) => !o.ids.includes(id))
   && ONLY4.every((id) => !nq.questions.some((q) => q.id === id)),
  `⑳ ★答えてから ${SETTINGS.answer_reask_days + 1} 日たっても、再確認として戻ってこない`);

// クルーバスだけの人
await asUser(222);
await submit({ ...TP, answers: [{ question_id: CT.id, code: CT_IN },
  { question_id: METHOD.id, codes: ['crew_bus'] }] });
r = await submit({ ...TP, answers: [{ question_id: CAP, code: 'no_cap' }] });
ok(allMissing(r, [CAP]), '⑳ クルーバスだけの人から、タクシー代の上限を受け取らない', JSON.stringify(r.rejected));

// 集計（k≧3）は、ほかの質問と同じに働く
const TF = { airline: 'solaseed', year: 2026, month: 8 };
const ask4 = async (n, order, methods, cap) => {
  await asUser(n);
  return submit({ ...TF, answers: [
    { question_id: 'upgrade_order', code: order },
    { question_id: CT.id, code: CT_IN },
    { question_id: METHOD.id, codes: methods },
    { question_id: CAP, code: cap }] });
};
await ask4(223, 'seniority', ['company_taxi'], 'per_ride');
r = await ask4(224, 'seniority', ['reimburse'], 'per_ride');
ok(r.saved === 4, '   立て替えて精算を選んだ人も、上限の質問に答えられる', JSON.stringify(r.rejected));
ok((await factN(TF.airline, 'upgrade_order')) === null && (await factN(TF.airline, CAP)) === null,
  '⑳ 2人では集計に出ない（昇格の順番・タクシー代の上限）');
await ask4(225, 'selection', ['company_taxi', 'crew_bus'], 'no_cap');
f = await factN(TF.airline, 'upgrade_order');
ok(f && f.n === 3 && JSON.stringify(f.answer_dist) === JSON.stringify({ selection: 1, seniority: 2 }),
  '⑳ ★3人で出る（昇格の順番・答えが割れているのが見える形）', JSON.stringify(f));
f = await factN(TF.airline, CAP);
ok(f && f.n === 3 && f.answer_dist.per_ride === 2 && f.answer_dist.no_cap === 1,
  '⑳ ★3人で出る（タクシー代の上限）', JSON.stringify(f));
await asUser(226);
await submit({ ...TF, answers: [{ question_id: 'upgrade_order', code: UNKNOWN }] });
v = await rows(`select n, n_unknown from airline_condition_facts where airline = $1 and question_id = 'upgrade_order'`,
  [TF.airline]);
ok(v.length === 1 && v[0].n === 3 && v[0].n_unknown === 1,
  `   「わからない」は n に数えない → n=${v[0]?.n} / n_unknown=${v[0]?.n_unknown}`);
v = await rows(`select column_name from information_schema.columns
  where table_schema='public' and table_name='airline_condition_facts' and column_name in ('answer_text','topic','topic_only')`);
ok(v.length === 0, '   任意の補足は集計に出ない（列そのものが無い）');
await asUser(225);
await submit({ ...TF, answers: [{ question_id: METHOD.id, codes: ['crew_bus'] }] });
ok((await factN(TF.airline, CAP)) === null,
  '⑳ ★手段からタクシーを外した人の、上限の古い答えを数え続けない（3人 → 2人で出なくなる）');
await asUser(225);
await submit({ ...TF, answers: [{ question_id: METHOD.id, codes: ['company_taxi', 'crew_bus'] }] });
ok((await factN(TF.airline, CAP))?.n === 3, '   タクシーを選び直すと、また3人に戻る');

/* ㉑ 着陸手当の額と数え方 ── 「あり」と答えた人にだけ、その場で聞く（2026-10-09・オーナー指定）。
   「1回あたり一定額」の人には、額（通貨つき）と何を1回と数えるか。
   「一定額ではない」の人には、低いほう・高いほうの額（どちらも任意）と何で変わるか。
   「ない」「わからない」の人には何も聞かない。
   ★ここが壊れても画面は普通に動く（「ない」に直した人の古い額を数え続ける・円とドルの額を
     1つの数字にまとめて出す・通貨の無い額や 0 が入る）ので、ここでしか気づけない。
   ⚠️ 下の額（1500・10・9 など）は検査のための作りもの。どの会社の着陸手当でもない。 */
console.log('\n▼ ㉑ 着陸手当の額と数え方 ── 「あり」と答えた人にだけ聞く');
const LP = QBY.landing_pay;
const LP_FIXED = ['landing_pay_amount', 'landing_pay_unit'];
const LP_VAR = ['landing_pay_from', 'landing_pay_to', 'landing_pay_varies_by'];
const LP_MONEY = ['landing_pay_amount', 'landing_pay_from', 'landing_pay_to'];
const LP_ALL = [...LP_FIXED, ...LP_VAR];

ok(same(kids(LP.id), LP_ALL), '   着陸手当の下に在るのは、この5問だけ', JSON.stringify(kids(LP.id)));
ok(LP_FIXED.every((id) => same(QBY[id]?.parentWhen || [], ['fixed']))
   && LP_VAR.every((id) => same(QBY[id]?.parentWhen || [], ['variable'])),
  '   額と数え方の2問は「1回あたり一定額」のときだけ・幅と「何で変わるか」の3問は「一定額ではない」のときだけ開く');
ok(same(LP.choices.map((c) => c.code), ['fixed', 'variable', 'no', UNKNOWN])
   && LP_ALL.every((id) => !QBY[id]?.parentWhen.includes('no') && !QBY[id]?.parentWhen.includes(UNKNOWN)),
  '   「ない」「わからない」で開く質問は1つも無い');
ok(same(LP_ALL.filter((id) => QBY[id]?.currency), LP_MONEY) && LP_MONEY.every((id) => QBY[id]?.kind === 'num'),
  '   通貨を聞くのは額の3問だけ（数え方と「何で変わるか」は選ぶ質問）');
ok(LP_MONEY.every((id) => QBY[id]?.num.min >= 1),
  '   ★額の下限は 1 以上（0 を入れられると「答えていない」と見分けがつかない）',
  JSON.stringify(LP_MONEY.map((id) => [id, QBY[id]?.num.min])));
ok(LP_ALL.every((id) => QBY[id]?.ja.label.includes('着陸手当') && /landing allowance/i.test(QBY[id]?.en.label)),
  '   見出しだけで「着陸手当の話」と分かる（親が隣に無い通知や一覧でも・日英）');
ok(QBY.landing_pay_varies_by?.note === true
   && LP_ALL.every((id) => !QBY[id]?.micro && !QBY[id]?.topic && !QBY[id]?.topicOnly),
  '   補足の欄を持つのは「何で変わるか」。5問とも1問枠には回さない（一覧と会社ページで聞く）');
v = await rows(`select id, parent, parent_when, has_currency, num_min
                  from pv_condition_questions where active and id = any($1)`, [LP_ALL]);
const lpDb = Object.fromEntries(v.map((x) => [x.id, x]));
ok(LP_ALL.every((id) => lpDb[id]?.parent === LP.id && same(lpDb[id].parent_when, QBY[id].parentWhen)
     && lpDb[id].has_currency === !!QBY[id].currency)
   && LP_MONEY.every((id) => Number(lpDb[id]?.num_min) >= 1),
  '   DB の質問マスタでも、親・開く条件・通貨の印・額の下限が生成元と同じ', JSON.stringify(v));

const LC = { airline: 'emirates', year: 2026, month: 8, position: 'fo', fleet: 'b737', lang: 'ja' };
const lpRows = async (n) => rows(
  `select question_id, answer_code, answer_num, answer_currency,
          "position", fleet, effective_year, effective_month
     from airline_conditions
    where proof_hash = pv_condition_hash($1::uuid, $2, null) and question_id = any($3)`,
  [uid(n), LC.airline, [LP.id, ...LP_ALL]]);
const sendLp = (pick) => [
  { question_id: 'landing_pay_amount', num: 1500, currency: 'JPY' },
  { question_id: 'landing_pay_unit', code: 'per_landing' },
  { question_id: 'landing_pay_from', num: 1000, currency: 'JPY' },
  { question_id: 'landing_pay_to', num: 3000, currency: 'JPY' },
  { question_id: 'landing_pay_varies_by', code: 'aircraft' }].filter((a) => pick.includes(a.question_id));
const factLp = async (qid) => {
  const x = await rows(`select n, median_num, top_code, answer_dist from airline_condition_facts
                         where airline = $1 and question_id = $2`, [LC.airline, qid]);
  return x.length ? x[0] : null;
};

// まだ答えていない人／「ない」「わからない」の人
o = await offer(231, LC.airline);
r = await submit({ ...LC, answers: sendLp(LP_ALL) });
ok(o.uncut && LP_ALL.every((id) => !o.ids.includes(id)) && allMissing(r, LP_ALL),
  '㉑ 着陸手当にまだ答えていない人には5問とも出ない・送っても受け取らない', JSON.stringify(r.rejected));
for (const [n, code, word] of [[232, 'no', 'ない'], [233, UNKNOWN, 'わからない']]) {
  await asUser(n);
  await submit({ ...LC, answers: [{ question_id: LP.id, code }] });
  o = await offer(n, LC.airline);
  r = await submit({ ...LC, answers: sendLp(LP_ALL) });
  ok(o.uncut && LP_ALL.every((id) => !o.ids.includes(id)) && allMissing(r, LP_ALL),
    `㉑ ★着陸手当が「${word}」の人には5問とも出ない・送っても受け取らない`, JSON.stringify(r.rejected));
}

// 「1回あたり一定額」の人 ── 親・額・数え方を1回で送る
await asUser(231);
r = await submit({ ...LC, answers: [
  { question_id: 'landing_pay_unit', code: 'per_landing' },            // 子を先に置いても
  { question_id: 'landing_pay_amount', num: 1500, currency: 'JPY' },
  { question_id: LP.id, code: 'fixed' }] });                           // 親が先に保存される
ok(r.saved === 3 && r.rejected.length === 0,
  '㉑ ★着陸手当（一定額）・額・数え方を、1回の送信で3件とも保存できる', JSON.stringify(r.rejected));
let lp = await lpRows(231);
ok(lp.length === 3 && lp.every((x) => x.position === LC.position && x.fleet === LC.fleet
     && x.effective_year === LC.year && x.effective_month === LC.month),
  '㉑ ★1回の保存で送った3行は、同じ職位・機種・適用時期を持つ', JSON.stringify(lp));
m = await mineOf(231, LC.airline);
ok(Number(m.landing_pay_amount?.num) === 1500 && m.landing_pay_amount?.currency === 'JPY'
   && m.landing_pay_unit?.code === 'per_landing',
  '   自分の回答に、額・通貨・数え方がそのまま返る（読み込み直した画面が元に戻せる）',
  JSON.stringify([m.landing_pay_amount, m.landing_pay_unit?.code]));
o = await offer(231, LC.airline);
r = await submit({ ...LC, answers: sendLp(LP_VAR) });
ok(o.uncut && LP_VAR.every((id) => !o.ids.includes(id)) && allMissing(r, LP_VAR),
  '㉑ ★一定額の人には、もう一方の枝（幅・何で変わるか）は出ない・送っても受け取らない', JSON.stringify(r.rejected));

// 額の検品
r = await submit({ ...LC, answers: [{ question_id: 'landing_pay_amount', num: 1500 }] });
ok(r.saved === 0 && r.rejected[0]?.reason === 'bad_currency', '㉑ ★通貨の無い額は受け取らない',
  JSON.stringify(r.rejected));
r = await submit({ ...LC, answers: [{ question_id: 'landing_pay_amount', num: 1500, currency: 'XXX' }] });
ok(r.saved === 0 && r.rejected[0]?.reason === 'bad_currency', '   語彙に無い通貨も受け取らない',
  JSON.stringify(r.rejected));
r = await submit({ ...LC, answers: [{ question_id: 'landing_pay_amount', num: 0, currency: 'JPY' }] });
ok(r.saved === 0 && r.rejected[0]?.reason === 'out_of_range', '㉑ ★0 は受け取らない（額は 1 以上）',
  JSON.stringify(r.rejected));
r = await submit({ ...LC, answers: [{ question_id: 'landing_pay_unit', code: 'per_month' }] });
ok(r.saved === 0 && r.rejected[0]?.reason === 'bad_code', '   数え方の選択肢に無い答えは受け取らない');
lp = await lpRows(231);
ok(lp.some((x) => x.question_id === 'landing_pay_amount' && Number(x.answer_num) === 1500 && x.answer_currency === 'JPY'),
  '   弾かれた送信で、前に入れた額は書き換わらない', JSON.stringify(lp));

// 「一定額ではない」の人 ── 額は任意。片方だけでも、理由と補足だけでも残せる
await asUser(234);
r = await submit({ ...LC, answers: [
  { question_id: LP.id, code: 'variable' },
  { question_id: 'landing_pay_from', num: 1000, currency: 'USD' },
  { question_id: 'landing_pay_varies_by', code: 'airport', text: '検査用の補足' }] });
ok(r.saved === 3 && r.rejected.length === 0,
  '㉑ 「一定額ではない」の人は、低いほうの額と「何で変わるか」だけで保存できる（高いほうは入れなくてよい）',
  JSON.stringify(r.rejected));
m = await mineOf(234, LC.airline);
ok(!m.landing_pay_to && Number(m.landing_pay_from?.num) === 1000 && m.landing_pay_from?.currency === 'USD'
   && m.landing_pay_varies_by?.code === 'airport' && m.landing_pay_varies_by?.text === '検査用の補足',
  '   入れていない高いほうの額は空のまま（0 でも、低いほうの額でも埋めない）・補足は残る',
  JSON.stringify([m.landing_pay_from, m.landing_pay_to, m.landing_pay_varies_by?.text]));
o = await offer(234, LC.airline);
r = await submit({ ...LC, answers: sendLp(LP_FIXED) });
ok(o.uncut && o.ids.includes('landing_pay_to') && LP_FIXED.every((id) => !o.ids.includes(id)) && allMissing(r, LP_FIXED),
  '㉑ ★一定額ではない人には、額と数え方（もう一方の枝）は出ない・送っても受け取らない', JSON.stringify(r.rejected));

// 集計 ── 通貨の違う額を、1つの数字にまとめない
const askLp = async (n, num, currency) => {
  await asUser(n);
  return submit({ ...LC, answers: [{ question_id: LP.id, code: 'fixed' },
    { question_id: 'landing_pay_amount', num, currency }] });
};
await askLp(235, 10, 'USD');
ok((await factLp('landing_pay_amount')) === null, '㉑ 額に答えたのが2人では集計に出ない');
await askLp(236, 9, 'EUR');
f = await factLp('landing_pay_amount');
ok(f && f.n === 3, '㉑ 3人で出る（出るのは人数）', JSON.stringify(f));
ok(f && f.median_num === null,
  '㉑ ★通貨の違う額（円・ドル・ユーロ）の真ん中を、1つの数字として出さない（中央値は空）', JSON.stringify(f));
ok(f && f.top_code === null && f.answer_dist === null, '   額は、選択肢の分布にも入らない');
v = await rows(`select median_num from airline_condition_facts
  where airline='qantas' and question_id='annual_leave_days'`);
ok(Number(v[0]?.median_num) === 28, `   対照: 通貨の無い数値質問（有給休暇の日数）の中央値は今までどおり出る → ${v[0]?.median_num}`);

// 親を答え直した人の、古い額を数え続けない
await asUser(231);
await submit({ ...LC, answers: [{ question_id: LP.id, code: 'no' }] });
ok((await factLp('landing_pay_amount')) === null,
  '㉑ ★着陸手当を「ない」に答え直した人の、古い額を数え続けない（3人 → 2人で出なくなる）');
lp = await lpRows(231);
ok(lp.some((x) => x.question_id === 'landing_pay_amount' && Number(x.answer_num) === 1500 && x.answer_currency === 'JPY'),
  '   行は消していない（答え直せば、前の額のまま数に戻る）', JSON.stringify(lp));
await submit({ ...LC, answers: [{ question_id: LP.id, code: 'fixed' }] });
ok((await factLp('landing_pay_amount'))?.n === 3, '   「1回あたり一定額」に戻すと、また3人に戻る');
await asUser(235);
await submit({ ...LC, answers: [{ question_id: LP.id, code: 'variable' }] });
ok((await factLp('landing_pay_amount')) === null,
  '㉑ ★「一定額」から「一定額ではない」に答え直した人の、古い額も数えない（枝をまたいで残さない）');
await submit({ ...LC, answers: [{ question_id: LP.id, code: 'fixed' }] });
ok((await factLp('landing_pay_amount'))?.n === 3, '   元に戻すと、また3人に戻る');


/* ㉑ の続き ── 対になる額（低いほう・高いほう）の決まりの置き場（2026-10-11）。
   着陸手当の「低いほうの額」と「高いほうの額」は別々の質問・別々の行だが、2つで1つの幅。
   どの2問が対かは、質問バンクの高いほうの rangeLow の1か所で決まり、画面が読む
   pv-conditions.json（rangeLow）と質問マスタの spec（range_low）へ運ばれる。
   サーバで対の相手を引くのは pv_condition_range_other、対として悪いかを言うのは pv_condition_range_bad
   （db/airline-conditions.sql の 4d）。ここで見るのは、その置き場そのもの。
   ⚠️ 下の額（100・200・300）は検査のための作りもの。どの会社の着陸手当でもない。 */
console.log('\n▼ ㉑ 対になる額（低いほう・高いほう）── 決まりの置き場');
const LO = 'landing_pay_from', HI = 'landing_pay_to';
const PAIRS = QUESTIONS.filter((q) => q.rangeLow).map((q) => `${q.id} > ${q.rangeLow}`);
const dbPairs = async () => (await rows(
  `select id, spec->>'range_low' as low from pv_condition_questions
    where active and spec->>'range_low' is not null order by priority`)).map((x) => `${x.id} > ${x.low}`);
v = await dbPairs();
ok(v.length === 1 && v[0] === `${HI} > ${LO}`,
  '㉑ ★質問マスタで対になっているのは、着陸手当の「高いほう → 低いほう」の1組だけ（決まりが、ほかの質問に広がっていない）',
  JSON.stringify(v));
ok(same(v, PAIRS), '   生成元（pv-conditions.mjs の rangeLow）と同じ組', JSON.stringify([PAIRS, v]));
v = JSON.parse(read('pv-conditions.json')).questions.filter((q) => q.rangeLow).map((q) => `${q.id} > ${q.rangeLow}`);
ok(v.length === 1 && v[0] === `${HI} > ${LO}`,
  '   画面が読む pv-conditions.json にも、同じ1組が入っている（画面とサーバが別々の対を読まない）', JSON.stringify(v));

const pairOf = async (id) => (await one(`select public.pv_condition_range_other($1::text) r`, [id])).r;
const pairBad = async (id, num, cur, onum, ocur) => (await one(
  `select public.pv_condition_range_bad($1::text, $2::numeric, $3::text, $4::numeric, $5::text) r`,
  [id, num, cur, onum, ocur])).r;

ok((await pairOf(HI)) === LO, '㉑ 高いほうから見た相手は、低いほう');
ok((await pairOf(LO)) === HI, '㉑ ★低いほうから見た相手は、高いほう（どちらの端を渡しても、対が分かる）');
ok((await pairOf('landing_pay_amount')) === null && (await pairOf(LP.id)) === null,
  '   対でない質問（一定額のときの額・親の質問）には、相手が無い');
ok((await pairOf('no_such_question')) === null && (await pairOf(null)) === null,
  '   知らない質問・空の id にも、相手が無い');
/* 使わなくなった質問（active = false）。片方でも使わなくなったら、対そのものが無い。 */
for (const [off, other, word] of [[LO, HI, '低いほう'], [HI, LO, '高いほう']]) {
  await db.query(`update pv_condition_questions set active = false where id = $1`, [off]);
  const got = { self: await pairOf(off), other: await pairOf(other),
    bad: [await pairBad(LO, 300, 'USD', 200, 'USD'), await pairBad(HI, 100, 'USD', 200, 'USD')] };
  await db.query(`update pv_condition_questions set active = true where id = $1`, [off]);
  ok(got.self === null, `㉑ ★使わなくなった質問（${word}）を渡しても、相手は返らない`, JSON.stringify(got));
  ok(got.other === null,
    `㉑ ★${word}を使わなくなったら、残った片方にも相手が無い（もう答え直せない相手と比べない）`, JSON.stringify(got));
  ok(got.bad.every((x) => x === null), '   そのあいだは、大小が逆の2つを渡しても何も言わない', JSON.stringify(got));
}
ok((await pairOf(LO)) === HI && (await pairOf(HI)) === LO, '   2問とも使っている状態に戻せば、また対になる');

const PAIR_CASES = [
  // [渡す質問, その額, その通貨, 相手の額, 相手の通貨, 期待, 何を見ているか]
  [LO, 100, 'USD', 200, 'USD', null, '低い 100・高い 200（低いほうを渡す）'],
  [HI, 200, 'USD', 100, 'USD', null, '低い 100・高い 200（高いほうを渡す）'],
  [LO, 300, 'USD', 200, 'USD', 'range_order', '★低い 300・高い 200（低いほうを渡す）'],
  [HI, 100, 'USD', 200, 'USD', 'range_order', '★低い 200・高い 100（高いほうを渡す）'],
  [LO, 200, 'USD', 200, 'USD', null, '★同じ額はよい（低いほうを渡す）'],
  [HI, 200, 'USD', 200, 'USD', null, '★同じ額はよい（高いほうを渡す）'],
  [LO, 100, 'USD', 200, 'EUR', 'range_currency', '★大小は合っていても、通貨が違う（低いほうを渡す）'],
  [HI, 200, 'USD', 100, 'EUR', 'range_currency', '★大小は合っていても、通貨が違う（高いほうを渡す）'],
  [LO, 300, 'USD', 200, 'EUR', 'range_currency', '★通貨も大小も悪いときは、通貨を先に言う（低いほうを渡す）'],
  [HI, 100, 'USD', 200, 'EUR', 'range_currency', '★通貨も大小も悪いときは、通貨を先に言う（高いほうを渡す）'],
  [LO, 100, 'USD', null, null, null, '★片方だけ ── 低いほうだけ在る（低いほうを渡す）'],
  [LO, null, null, 200, 'USD', null, '★片方だけ ── 高いほうだけ在る（低いほうを渡す）'],
  [HI, 200, 'USD', null, null, null, '★片方だけ ── 高いほうだけ在る（高いほうを渡す）'],
  [HI, null, null, 100, 'USD', null, '★片方だけ ── 低いほうだけ在る（高いほうを渡す）'],
  [LO, 100, 'usd', 200, ' USD ', null, '通貨の書き方の揺れ（小文字・前後の空白）は、同じ通貨'],
  [LO, 300, null, 200, 'USD', 'range_order', '片方の通貨が空でも、大小は見る（通貨が違うとは言わない）'],
  [HI, 200, 'USD', 100, null, null, '片方の通貨が空で、大小が合っていれば通す'],
  ['landing_pay_amount', 300, 'USD', 200, 'EUR', null, '対でない質問には、何も言わない'],
  ['no_such_question', 300, 'USD', 200, 'EUR', null, '知らない質問にも、何も言わない'],
];
for (const [id, num, cur, onum, ocur, want, word] of PAIR_CASES) {
  const got = await pairBad(id, num, cur, onum, ocur);
  ok(got === want, `㉑ 対の検品: ${word} → ${want || '通す'}`, `（返ったのは ${got}）`);
}

/* 貼る先の質問マスタには、対の印が無いまま2問がもう入っていることがある（spec は刻みだけ）。
   その形へ戻してから、生成した SQL をもう一度流す ＝ 上書きの側（on conflict … do update）を通す。
   ★update set から spec を落としても、空の DB に流したここまでの行は全部緑のまま。貼った先では
     対がどこにも無く、上の2つの関数は何を渡されても「対でない」と答える。 */
await db.query(`update pv_condition_questions set spec = spec - 'range_low' where id = $1`, [HI]);
v = await dbPairs();
ok(v.length === 0 && (await pairOf(HI)) === null && (await pairOf(LO)) === null,
  '   （下ごしらえ）対の印を消した ＝ 印が無かった頃の質問マスタ（対はどこにも無い）', JSON.stringify(v));
upErr = await regen();
v = upErr ? [] : await dbPairs();
ok(upErr === null && v.length === 1 && v[0] === `${HI} > ${LO}` && (await pairOf(LO)) === HI,
  '㉑ ★対の印が無い質問マスタに流し直すと、印が付く（上書きの側でも運ばれる）', upErr || JSON.stringify(v));

/* 2つとも、API からは呼べない（1件ぶんの検品 pv_condition_clean と同じ扱い）。
   本番（Supabase）は、public に作った関数の実行を anon・authenticated へも既定で渡す。この器には
   その既定が無いので、作ったままの姿だと「public からだけ外した」形でも、下は緑になる。
   そこで、3つとも渡した状態を作ってから、このファイルをもう一度流す ＝ 貼る先と同じ出発点。 */
const RANGE_FNS = ['pv_condition_clean(text, jsonb)', 'pv_condition_range_other(text)',
  'pv_condition_range_bad(text, numeric, text, numeric, text)'];
for (const fn of RANGE_FNS) await db.exec(`grant execute on function public.${fn} to public, anon, authenticated`);
let reErr = null;
try { await db.exec(read('db/airline-conditions.sql')); } catch (e) { reErr = String(e.message || e); }
ok(reErr === null,
  '   （下ごしらえ）3つの関数の実行を public・anon・authenticated に渡してから、db/airline-conditions.sql を流し直した',
  String(reErr));
for (const [role, word] of [['anon', 'ログインしていない人'], ['authenticated', '会員']]) {
  await db.exec(`set role ${role}`);
  const e0 = await boom(`select public.pv_condition_clean('landing_pay_from', '{"num":100,"currency":"USD"}'::jsonb)`);
  const e1 = await boom(`select public.pv_condition_range_other('landing_pay_to')`);
  const e2 = await boom(`select public.pv_condition_range_bad('landing_pay_from', 300, 'USD', 200, 'USD')`);
  await db.exec('reset role');
  ok(/permission denied for function pv_condition_range_other/.test(e1 || ''),
    `㉑ ★${word}は「対の相手」を直接は呼べない`, String(e1));
  ok(/permission denied for function pv_condition_range_bad/.test(e2 || ''),
    `㉑ ★${word}は「対の検品」を直接は呼べない`, String(e2));
  ok(/permission denied for function pv_condition_clean/.test(e0 || ''),
    `   対照: ${word}は「1件ぶんの検品」も直接は呼べない（3つとも同じ扱い）`, String(e0));
}

/* ㉑ の続き ── 職位・機種・基地・契約は「1組」（2026-10-11）。
   回答の行には、答えたときの職位・機種・基地・契約が付いている。会員の保存の入口は、この4つを
   送信が運んできたもので毎回そのまま上書きしていたので、
     ・一覧のページで答えだけ直す（あの画面は4つを運ばない）と、行から職位も機種も消えた
     ・親（着陸手当）を先に答えて、額と数え方をあとの保存で足すと、足した行だけ4つが空だった
   決まりは3つ（db/airline-conditions.sql の submit_airline_conditions）。
     1. 送信が4つのうち1つでも運んでいれば、その送信の組をそのまま使う（欠けた分は空）
     2. 1つも運んでいなくて、行にもう答えが在れば、行の組を動かさない
     3. 1つも運んでいなくて、まだ答えが無い（行が無い／スキップの印だけ）なら、すぐ上の親の行の組
   ★4つを1列ずつ別々に決めない（新しい職位に、前の機種がくっ付く）。
   ★適用時期（年月）は写さない。あとから足した行の年月は、足した月。
   ★上の「1回の保存で送った3行は…」は、1回の送信が1つの組を持つことしか見ていない
     （親と続きを別々の保存で送ったときに何が起きても緑）。別々の保存を見るのは下の t1〜t5。 */
console.log('\n▼ ㉑ 職位・機種・基地・契約は1組 ── 直しても消えない・混ざらない／あとから足した続きの質問は親の組を持つ');
const XC = { airline: 'fda', lang: 'ja' };   // ここまでのどの検査も回答を入れていない会社
const SET_A = { position: 'cap', fleet: 'b787', base_iata: 'HND', contract_type: 'direct' };
const SET_B = { position: 'fo', fleet: 'a320', base_iata: 'NRT', contract_type: 'contract' };
const A_SET = 'cap/b787/HND/direct', B_SET = 'fo/a320/NRT/contract', NO_SET = '—/—/—/—';
const AUG = { year: 2025, month: 8 };        // 先に答えた月（今日より前の、今日とは違う月）
const today = await one(`select extract(year from current_date)::int y, extract(month from current_date)::int m`);
/* その人の、その会社の行をそのまま読む（自分の回答の一覧は、4つもスキップの印も返さない） */
const rowsOf = async (n, airline, ids) => Object.fromEntries((await rows(
  `select question_id, answer_code, answer_num, answer_currency,
          "position", fleet, base_iata, contract_type, effective_year, effective_month,
          skipped_at is not null as skipped,
          num_nonnulls(answer_code, answer_codes, answer_num, answer_text, answer_json) > 0 as answered
     from airline_conditions
    where proof_hash = pv_condition_hash($1::uuid, $2, null) and question_id = any($3)`,
  [uid(n), airline, ids])).map((x) => [x.question_id, x]));
const setOf = (x) => (x ? [x.position, x.fleet, x.base_iata, x.contract_type].map((s) => s ?? '—').join('/') : '行なし');
const monthOf = (x) => (x ? `${x.effective_year}-${x.effective_month}` : '行なし');

// 直す（親の無い質問で見る ＝ 下の「親の組」の決まりが混ざらない）
const RD = QBY.reserve_duty;
const [RD_1, RD_2] = RD.choices.map((c) => c.code).filter((c) => c !== UNKNOWN);
const storeRd = async (n) => {
  await asUser(n);
  return submit({ ...XC, ...AUG, ...SET_A, answers: [{ question_id: RD.id, code: RD_1 }] });
};
const fixRd = async (n, ctx) => {
  const res = await submit({ ...XC, ...ctx, answers: [{ question_id: RD.id, code: RD_2 }] });
  return { res, row: (await rowsOf(n, XC.airline, [RD.id]))[RD.id] };
};
await storeRd(301);
let cx = (await rowsOf(301, XC.airline, [RD.id]))[RD.id];
ok(cx?.answer_code === RD_1 && setOf(cx) === A_SET && monthOf(cx) === '2025-8',
  '   （下ごしらえ）機長・B787・基地・契約を付けて1問を保存した', JSON.stringify(cx));
let fx = await fixRd(301, {});
ok(fx.res.saved === 1 && fx.row?.answer_code === RD_2 && setOf(fx.row) === A_SET,
  '㉑ ★c1 職位・機種・基地・契約を1つも運ばない保存で答えを直しても、行の4つは消えない（答えは新しくなる）',
  JSON.stringify(fx.row));
await storeRd(302);
fx = await fixRd(302, SET_B);
ok(fx.res.saved === 1 && fx.row?.answer_code === RD_2 && setOf(fx.row) === B_SET,
  '㉑ ★c2 別の組（副操縦士・A320・別の基地・別の契約）を運ぶ保存で直すと、行は新しい組になる', JSON.stringify(fx.row));
await storeRd(303);
fx = await fixRd(303, { position: 'fo' });
ok(fx.res.saved === 1 && fx.row?.answer_code === RD_2 && setOf(fx.row) === 'fo/—/—/—',
  '㉑ ★c3 職位だけを運ぶ保存で直すと、職位は新しく、機種・基地・契約は空（新しい職位に、前の機種をくっ付けない）',
  JSON.stringify(fx.row));
await storeRd(304);
fx = await fixRd(304, { base_iata: 'KIX' });
await storeRd(305);
const fx5 = await fixRd(305, { contract_type: 'agency' });
ok(setOf(fx.row) === '—/—/KIX/—' && setOf(fx5.row) === '—/—/—/agency',
  '   基地だけ・契約だけを運ぶ保存も「その送信の組」（残りの3つは空）', JSON.stringify([fx.row, fx5.row]));

// あとから足す（親を先に答えて、続きの質問を別の保存で送る）
const AMT = { question_id: 'landing_pay_amount', num: 1500, currency: 'JPY' };
const UNIT = { question_id: 'landing_pay_unit', code: 'per_landing' };
const LP3 = [LP.id, AMT.question_id, UNIT.question_id];
const storeLpParent = async (n, airline = XC.airline, set = SET_A) => {
  await asUser(n);
  return submit({ ...XC, airline, ...AUG, ...set, answers: [{ question_id: LP.id, code: 'fixed' }] });
};
await storeLpParent(311);
r = await submit({ ...XC, answers: [AMT, UNIT] });   // 年月も4つも運ばない（会社ページのシートが、月の勤務の無い人について送る形）
cx = await rowsOf(311, XC.airline, LP3);
ok(r.saved === 2 && setOf(cx[AMT.question_id]) === A_SET && setOf(cx[UNIT.question_id]) === A_SET,
  '㉑ ★t1 親（着陸手当）を先に答え、額と数え方をあとの保存で足しても、2行とも親と同じ職位・機種・基地・契約を持つ',
  JSON.stringify(cx));
ok([AMT, UNIT].every((a) => monthOf(cx[a.question_id]) === `${today.y}-${today.m}`)
   && monthOf(cx[LP.id]) === '2025-8' && setOf(cx[LP.id]) === A_SET,
  '   適用時期は答えた月（足した2行は足した月・親の行は先に答えた月のまま）', JSON.stringify(cx));
await storeLpParent(312);
r = await submit({ ...XC, position: 'fo', fleet: 'a320', answers: [AMT, UNIT] });
cx = await rowsOf(312, XC.airline, LP3);
ok(r.saved === 2 && setOf(cx[AMT.question_id]) === 'fo/a320/—/—' && setOf(cx[UNIT.question_id]) === 'fo/a320/—/—'
   && setOf(cx[LP.id]) === A_SET,
  '㉑ ★t2 あとの保存が自分の組（副操縦士・A320）を運んでいれば、足した2行はその組（親の組で上書きしない）',
  JSON.stringify(cx));
r = await submit({ ...XC, answers: [{ ...AMT, num: 1600 }] });
cx = await rowsOf(312, XC.airline, LP3);
ok(r.saved === 1 && Number(cx[AMT.question_id]?.answer_num) === 1600 && setOf(cx[AMT.question_id]) === 'fo/a320/—/—'
   && setOf(cx[LP.id]) === A_SET,
  '㉑ ★t3 自分の組を持つ続きの行を、何も運ばない保存で直しても、その行の組のまま（親の組に替わらない）',
  JSON.stringify(cx));
await asUser(313);
await submit({ ...XC, ...AUG, ...SET_A, answers: [{ question_id: CT.id, code: CT_IN }] });
await submit({ ...XC, answers: [{ question_id: METHOD.id, codes: ['company_taxi'] }] });
r = await submit({ ...XC, answers: [{ question_id: CAP, code: 'per_ride' }] });
cx = await rowsOf(313, XC.airline, [CT.id, METHOD.id, CAP]);
ok(r.saved === 1 && [CT.id, METHOD.id, CAP].every((id) => setOf(cx[id]) === A_SET),
  '㉑ ★t4 3段（通勤の移動 → 手段 → タクシー代の上限）を1回に1段ずつ足しても、いちばん上の組が3段目まで届く',
  JSON.stringify(cx));
await asUser(314);
await submit({ ...XC, ...AUG, ...SET_A, answers: [{ question_id: ST.id, code: ST_IN }] });
r = await submit({ ...XC, answers: [{ question_id: BOOK.id, skip: true }] });
cx = (await rowsOf(314, XC.airline, [BOOK.id]))[BOOK.id];
ok(r.skipped === 1 && cx && cx.skipped && !cx.answered && setOf(cx) === NO_SET,
  '   （下ごしらえ）続きの質問を先にスキップした ＝ 答えの無い、スキップの印だけの行が在る', JSON.stringify(cx));
r = await submit({ ...XC, answers: [{ question_id: BOOK.id, code: 'standby' }] });
cx = (await rowsOf(314, XC.airline, [BOOK.id]))[BOOK.id];
ok(r.saved === 1 && cx?.answer_code === 'standby' && !cx.skipped && setOf(cx) === A_SET,
  '㉑ ★t5 先にスキップしていた続きの質問にあとから答えても、親の組を持つ（スキップの印は消える）', JSON.stringify(cx));
await storeLpParent(315);
r = await submit({ ...XC, answers: [{ question_id: LP.id, skip: true }] });
cx = await rowsOf(315, XC.airline, LP3);
const parentMarked = cx[LP.id]?.skipped && cx[LP.id]?.answered;
r = await submit({ ...XC, answers: [AMT] });
cx = await rowsOf(315, XC.airline, LP3);
ok(parentMarked && r.saved === 1 && setOf(cx[AMT.question_id]) === A_SET,
  '   親の行がスキップの印も持っていても、答えは答え（続きの質問を受け取り、親の組を渡す）', JSON.stringify(cx));
await asUser(316);
await submit({ ...XC, ...AUG, answers: [{ question_id: LP.id, code: 'fixed' }] });   // この会社の親は、4つとも空
await storeLpParent(316, 'starlux', SET_B);                                          // 同じ人の、ほかの会社の親
await storeLpParent(317, XC.airline, SET_B);                                         // ほかの人の、同じ会社の親
await asUser(316);
r = await submit({ ...XC, answers: [AMT] });
cx = await rowsOf(316, XC.airline, LP3);
ok(r.saved === 1 && setOf(cx[AMT.question_id]) === NO_SET && setOf(cx[LP.id]) === NO_SET,
  '   親の行に組が無ければ、足した行も空のまま（同じ人のほかの会社の行・ほかの人の行からは取らない）',
  JSON.stringify(cx));

/* ㉑ の続き ── 対になる額を、会員の保存の入口が受け取るとき（2026-10-11）。
   「低いほう 300・高いほう 200」「低いほう USD・高いほう EUR」が、そのまま保存されていた
   （1件ぶんの検品は、1問ずつしか見ない）。入口は、額を保存する前に対の相手と比べる。
   相手 ＝ **この送信が終わったあとに残る**相手の額。
     ・同じ送信に相手の答えが入っている … その額（「わからない」なら相手は無い。検品で落ちる答えは
       保存されないので、いま保存されている額）
     ・入っていない／スキップだけ … いま保存されている額。★スキップの印が付いていても額は残っている
   大小と通貨を比べるのは pv_condition_range_bad の1か所（上の「決まりの置き場」）。
   ⚠️ 下の額は検査のための作りもの。どの会社の着陸手当でもない。 */
console.log('\n▼ ㉑ 対になる額 ── 会員の保存の入口は、食い違う2つを受け取らない');
const PC = { airline: 'asiana', lang: 'ja' };   // ここまでのどの検査も回答を入れていない会社
const VAR = { question_id: LP.id, code: 'variable' };
const low = (num, currency = 'USD') => ({ question_id: LO, num, currency });
const high = (num, currency = 'USD') => ({ question_id: HI, num, currency });
const dunno = (id) => ({ question_id: id, code: UNKNOWN });
const skipOf = (id) => ({ question_id: id, skip: true });
/* 新しい会員が「一定額ではない」と答える。stored なら、低いほう 100 USD・高いほう 200 USD も先に保存しておく */
const pairUser = async (n, stored = true) => {
  await asUser(n);
  return submit({ ...PC, answers: [VAR, ...(stored ? [low(100), high(200)] : [])] });
};
/* いま保存されている2つ。「100 USD／200 USD」の形（額の無い答えはその答え・スキップの印が在れば末尾に「*」） */
const pairRows = async (n) => rowsOf(n, PC.airline, [LO, HI]);
const sayEnd = (y) => (!y ? '行なし'
  : (y.answer_num === null ? (y.answer_code || '答えなし') : `${Number(y.answer_num)} ${y.answer_currency}`)
    + (y.skipped ? '*' : ''));
const pairNow = async (n) => { const x = await pairRows(n); return `${sayEnd(x[LO])}／${sayEnd(x[HI])}`; };
const whyOf = (res) => res.rejected.map((x) => `${x.question_id}:${x.reason}`).sort().join(' ');
const BOTH_ORDER = `${LO}:range_order ${HI}:range_order`, BOTH_CUR = `${LO}:range_currency ${HI}:range_currency`;
const day = async (n) => Number((await one(`select cond_answers_today n from profiles where id = $1`, [uid(n)])).n);
let now2;

r = await pairUser(401);
ok(r.saved === 3 && (await pairNow(401)) === '100 USD／200 USD',
  '   （下ごしらえ）「一定額ではない」と、低いほう 100 USD・高いほう 200 USD を保存できる', JSON.stringify(r.rejected));

await pairUser(402, false);
r = await submit({ ...PC, answers: [low(300), high(200)] });
now2 = await pairNow(402);
m = await mineOf(402, PC.airline);
ok(whyOf(r) === BOTH_ORDER && now2 === '行なし／行なし' && !m[LO] && !m[HI],
  '㉑ ★p1 1回の送信で 低いほう 300 USD・高いほう 200 USD → 2つとも断る（range_order）。どちらの行もできない',
  `${whyOf(r)} ｜ ${now2}`);
await pairUser(403, false);
r = await submit({ ...PC, answers: [low(100, 'USD'), high(200, 'EUR')] });
now2 = await pairNow(403);
ok(whyOf(r) === BOTH_CUR && now2 === '行なし／行なし',
  '㉑ ★p2 1回の送信で 100 USD・200 EUR（大小は合っている）→ 2つとも断る（range_currency）', `${whyOf(r)} ｜ ${now2}`);
await pairUser(404, false);
r = await submit({ ...PC, answers: [low(300, 'USD'), high(200, 'EUR')] });
now2 = await pairNow(404);
ok(whyOf(r) === BOTH_CUR && now2 === '行なし／行なし',
  '㉑ ★p3 1回の送信で 300 USD・200 EUR（通貨も大小も悪い）→ 言うのは通貨（range_currency）', `${whyOf(r)} ｜ ${now2}`);
await pairUser(405, false);
r = await submit({ ...PC, answers: [low(200), high(200)] });
now2 = await pairNow(405);
ok(r.rejected.length === 0 && r.saved === 2 && now2 === '200 USD／200 USD',
  '㉑ p4 対照: 同じ額（200 USD・200 USD）は保存できる', `${whyOf(r)} ｜ ${now2}`);
await pairUser(406, false);
r = await submit({ ...PC, answers: [low(100)] });
now2 = await pairNow(406);
await pairUser(407, false);
const r5 = await submit({ ...PC, answers: [high(200)] });
ok(r.saved === 1 && now2 === '100 USD／行なし' && r5.saved === 1 && (await pairNow(407)) === '行なし／200 USD',
  '㉑ p5 対照: 片方だけ（低いほうだけ／高いほうだけ）は保存できる',
  `${whyOf(r)} ｜ ${now2} ｜ ${whyOf(r5)} ｜ ${await pairNow(407)}`);

await pairUser(408);
r = await submit({ ...PC, answers: [low(250)] });
now2 = await pairNow(408);
ok(whyOf(r) === `${LO}:range_order` && now2 === '100 USD／200 USD',
  '㉑ ★p6 100／200 USD を持つ人が、低いほうだけ 250 に直す → 断る（range_order）。低いほうは 100 のまま',
  `${whyOf(r)} ｜ ${now2}`);
await pairUser(409);
r = await submit({ ...PC, answers: [low(300), high(400)] });
now2 = await pairNow(409);
ok(r.rejected.length === 0 && r.saved === 2 && now2 === '300 USD／400 USD',
  '㉑ ★p7 100／200 USD を持つ人が、1回の送信で 300／400 に直す → 2つとも保存（300 を、前の 200 と比べない）',
  `${whyOf(r)} ｜ ${now2}`);
await pairUser(410);
r = await submit({ ...PC, answers: [high(150, 'EUR')] });
now2 = await pairNow(410);
ok(whyOf(r) === `${HI}:range_currency` && now2 === '100 USD／200 USD',
  '㉑ ★p8 100／200 USD を持つ人が、高いほうだけ 150 EUR で送る → 断る（range_currency）。何も変わらない',
  `${whyOf(r)} ｜ ${now2}`);
await pairUser(411);
r = await submit({ ...PC, answers: [skipOf(LO), high(50)] });
now2 = await pairNow(411);
ok(whyOf(r) === `${HI}:range_order` && r.skipped === 1 && now2 === '100 USD*／200 USD',
  '㉑ ★p9 100／200 USD を持つ人が、1回の送信で 低いほうをスキップ・高いほうを 50 → 高いほうを断る（range_order）。'
  + 'スキップは額を消さない（低いほうは 100 のまま・印だけ付く）', `${whyOf(r)} ｜ ${now2}`);
await pairUser(412);
r = await submit({ ...PC, answers: [dunno(LO), high(50)] });
now2 = await pairNow(412);
ok(r.rejected.length === 0 && r.saved === 2 && now2 === `${UNKNOWN}／50 USD`,
  '㉑ ★p10a 100／200 USD を持つ人が、1回の送信で 低いほうを「わからない」・高いほうを 50 → 2つとも保存（低いほうに、もう額が無い）',
  `${whyOf(r)} ｜ ${now2}`);
await pairUser(413);
r = await submit({ ...PC, answers: [dunno(HI), low(300)] });
now2 = await pairNow(413);
ok(r.rejected.length === 0 && r.saved === 2 && now2 === `300 USD／${UNKNOWN}`,
  '㉑ ★p10b 100／200 USD を持つ人が、1回の送信で 高いほうを「わからない」・低いほうを 300 → 2つとも保存',
  `${whyOf(r)} ｜ ${now2}`);
await pairUser(414, false);
r = await submit({ ...PC, answers: [high(200), low(300)] });
now2 = await pairNow(414);
await pairUser(415);
const r11 = await submit({ ...PC, answers: [high(400), low(300)] });
ok(whyOf(r) === BOTH_ORDER && now2 === '行なし／行なし'
   && r11.rejected.length === 0 && (await pairNow(415)) === '300 USD／400 USD',
  '㉑ ★p11 高いほうを先に並べた送信でも同じ（300・200 は2つとも断る／100・200 から 300・400 へは2つとも保存）',
  `${whyOf(r)} ｜ ${now2} ｜ ${whyOf(r11)} ｜ ${await pairNow(415)}`);
await pairUser(416);
const day0 = await day(416);
r = await submit({ ...PC, answers: [low(250)] });
const day1 = await day(416);
const r12 = await submit({ ...PC, answers: [low(150)] });
ok(day0 === 3 && whyOf(r) === `${LO}:range_order` && r.saved === 0 && day1 === day0
   && r12.saved === 1 && (await day(416)) === day0 + 1,
  '㉑ ★p12 断った答えは、保存した数にも、1日の上限の数にも入らない（受け取った答えは、今までどおり1つ数える）',
  JSON.stringify({ day0, day1, saved: r.saved, why: whyOf(r), next: r12.saved }));
await pairUser(417, false);
await submit({ ...PC, answers: [low(100)] });
r = await submit({ ...PC, answers: [skipOf(LO)] });
now2 = await pairNow(417);
ok(r.skipped === 1 && now2 === '100 USD*／行なし',
  '   （下ごしらえ）低いほう 100 USD を入れた人が、あとの送信でそれをスキップした ＝ 額は 100 のまま、印が付いている', now2);
r = await submit({ ...PC, answers: [high(50)] });
now2 = await pairNow(417);
ok(whyOf(r) === `${HI}:range_order` && now2 === '100 USD*／行なし',
  '㉑ ★p13 スキップの印が付いた 100 USD を持つ人が、高いほうを 50 で送る → 断る（range_order）。印の付いた額とも比べる',
  `${whyOf(r)} ｜ ${now2}`);
await pairUser(418);
r = await submit({ ...PC, answers: [low(300), high(400, 'XXX')] });
now2 = await pairNow(418);
ok(whyOf(r) === `${LO}:range_order ${HI}:bad_currency` && now2 === '100 USD／200 USD',
  '㉑ ★p14 同じ送信の相手が検品で落ちる（語彙に無い通貨の 400）→ 相手は保存されないので、300 は前の 200 と比べて断る',
  `${whyOf(r)} ｜ ${now2}`);
/* 同じ端を2回入れた送信（画面は送らない。手で作った送信）。同じ送信の相手と比べてよいのは、
   その質問の最後の答えだけ（あとの答えに上書きされる答えは、その時点で保存されている相手と比べる）。
   これが無いと、250 が「同じ送信の 300」と比べて通り、その 300 は 900 と食い違って断られ、
   低いほう 250・高いほう 200 が残る。 */
await pairUser(419);
r = await submit({ ...PC, answers: [low(250), low(900), high(300)] });
cx = await pairRows(419);
ok(cx[LO] && cx[HI] && Number(cx[LO].answer_num) <= Number(cx[HI].answer_num)
   && cx[LO].answer_currency === cx[HI].answer_currency,
  '㉑ ★同じ端を2回入れた送信（低いほう 250・低いほう 900・高いほう 300）でも、食い違う2つは残らない',
  `${whyOf(r)} ｜ ${await pairNow(419)}`);
await pairUser(420);
r = await submit({ ...PC, answers: [low(300), low(350), high(400)] });
now2 = await pairNow(420);
ok(now2 === '350 USD／400 USD' && whyOf(r) === `${LO}:range_order`,
  '   対照: 最後の答えどうし（350・400）は、同じ送信の相手と比べて保存する（先の 300 は、前の 200 と比べて断る）',
  `${whyOf(r)} ｜ ${now2}`);
/* 上の決まりの2行は、ここまでのどの検査でも赤くできなかった（2026-10-11。どちらも、手で作った送信）。
     c1 「その質問の最後の答え」を決めるとき、あとに在るスキップは答えに数えない。数えると、低いほう 50 EUR が
        「最後ではない」になり、前の 200 USD と比べて断られ、100 USD／60 EUR が残る。
     c2 同じ送信に相手の答えが2つ在るとき、比べるのは最後のもの。最初のものと比べると、500 が 600 と・60 が 50 と
        比べて通り、500 USD／60 USD が残る。 */
await pairUser(422);
r = await submit({ ...PC, answers: [low(50, 'EUR'), skipOf(LO), high(60, 'EUR')] });
now2 = await pairNow(422);
ok(r.rejected.length === 0 && r.saved === 2 && r.skipped === 1 && now2 === '50 EUR*／60 EUR',
  '㉑ ★c1 100／200 USD を持つ人が、1回の送信で 低いほう 50 EUR・低いほうをスキップ・高いほう 60 EUR → 2つとも保存'
  + '（あとに在るスキップは答えではない ＝ 50 EUR は「最後の答え」のまま、同じ送信の 60 EUR と比べる）', `${whyOf(r)} ｜ ${now2}`);
await pairUser(423);
r = await submit({ ...PC, answers: [low(50), low(500), high(600), high(60)] });
now2 = await pairNow(423);
ok(whyOf(r) === BOTH_ORDER && r.saved === 2 && now2 === '50 USD／600 USD',
  '㉑ ★c2 両方の端を2回ずつ入れた送信（低い 50・低い 500・高い 600・高い 60）→ 最後の答えどうし（500・60）を比べて2つとも断る。'
  + '先の 50 と 600 が残る（相手の「最初の」答えと比べて、500／60 を通さない）', `${whyOf(r)} ｜ ${now2}`);

/* ★1日の上限（60件）が、対の2つのあいだで切れるとき（2026-10-11）。
   前は、先に回る低いほうだけが入り（同じ送信の高いほうと比べて通る）、高いほうは上限で断られて、
   「低いほう 300・高いほう 200」が残った。食い違う2つを受け取らない、という決まりの、最後の抜け道。
   同じ送信の2つの端は「1組」── **2つとも書くか、2つとも書かない**（額の無い「わからない」の端も、組に入る）。
   上限に2件ぶんの空きが無ければ、2つとも rate_limited で返る（新しい理由は作らない）。
   ⚠️ submit は、最後に asUser した会員として送る（pairUser も asUser を呼ぶ）。数を置く setDay と、
      読むだけの pairRows・pairNow・day は、会員を切り替えない。 */
const BOTH_LIM = `${LO}:rate_limited ${HI}:rate_limited`;
const setDay = (n, k) => db.query(
  `update profiles set cond_answers_day = current_date, cond_answers_today = $2 where id = $1`, [uid(n), k]);
let dayN;

await pairUser(431);
await setDay(431, 59);
r = await submit({ ...PC, answers: [low(300), high(400)] });
now2 = await pairNow(431);
dayN = await day(431);
ok(whyOf(r) === BOTH_LIM && r.saved === 0 && now2 === '100 USD／200 USD' && dayN === 59,
  '㉑ ★d1 100／200 USD を持つ人が、残り1件の日に、1回の送信で 300／400 に直す → 2つとも断る（rate_limited）。'
  + '何も変わらない（低いほうだけ入って 300／200 にならない）・1日の数も増えない', `${whyOf(r)} ｜ 保存 ${r.saved} ｜ ${now2} ｜ 数 ${dayN}`);
r = await submit({ ...PC, answers: [low(150)] });
now2 = await pairNow(431);
dayN = await day(431);
ok(r.rejected.length === 0 && r.saved === 1 && now2 === '150 USD／200 USD' && dayN === 60,
  '   d1 のつづき: 同じ人が、低いほうだけ 150 を送る → 保存（1件だけの答えは、今までどおり、残りの1件で入る）',
  `${whyOf(r)} ｜ 保存 ${r.saved} ｜ ${now2} ｜ 数 ${dayN}`);
await pairUser(432);
await setDay(432, 59);
r = await submit({ ...PC, answers: [high(400), low(300)] });
now2 = await pairNow(432);
dayN = await day(432);
ok(whyOf(r) === BOTH_LIM && r.saved === 0 && now2 === '100 USD／200 USD' && dayN === 59,
  '㉑ ★d1b 高いほうを先に並べた送信でも同じ（2つとも rate_limited・100／200 のまま・数も増えない）',
  `${whyOf(r)} ｜ 保存 ${r.saved} ｜ ${now2} ｜ 数 ${dayN}`);
await pairUser(433);
await setDay(433, 58);
r = await submit({ ...PC, answers: [low(300), high(400)] });
now2 = await pairNow(433);
dayN = await day(433);
ok(r.rejected.length === 0 && r.saved === 2 && now2 === '300 USD／400 USD' && dayN === 60,
  '㉑ d2 対照: 残り2件の日なら、300／400 は2つとも保存（1日の数は 60 ちょうど）',
  `${whyOf(r)} ｜ 保存 ${r.saved} ｜ ${now2} ｜ 数 ${dayN}`);
await pairUser(434);
await setDay(434, 59);
r = await submit({ ...PC, answers: [low(300), dunno(HI)] });
now2 = await pairNow(434);
ok(whyOf(r) === BOTH_LIM && r.saved === 0 && now2 === '100 USD／200 USD',
  '㉑ ★d3 残り1件の日に、低いほう 300・高いほう「わからない」→ 2つとも断る（額の無い端も、組に入る）。100／200 のまま',
  `${whyOf(r)} ｜ 保存 ${r.saved} ｜ ${now2}`);
await pairUser(435);
await setDay(435, 59);
r = await submit({ ...PC, answers: [dunno(LO), high(50)] });
now2 = await pairNow(435);
ok(whyOf(r) === BOTH_LIM && r.saved === 0 && now2 === '100 USD／200 USD',
  '㉑ ★d3\' 残り1件の日に、低いほう「わからない」・高いほう 50 → 2つとも断る。100／200 のまま',
  `${whyOf(r)} ｜ 保存 ${r.saved} ｜ ${now2}`);
await pairUser(436);
await setDay(436, 58);
r = await submit({ ...PC, answers: [low(300), skipOf(LO), high(400)] });
now2 = await pairNow(436);
dayN = await day(436);
ok(whyOf(r) === `${LO}:rate_limited` && r.saved === 2 && r.skipped === 0 && now2 === '300 USD／400 USD' && dayN === 60,
  '㉑ ★d4 残り2件の日に、低いほう 300・低いほうをスキップ・高いほう 400 → 断るのは、あいだのスキップだけ。'
  + '300／400 が入り、スキップの印は付かない・1日の数は 60（高いほうのために取っておいた1件ぶんを、スキップに使わせない）',
  `${whyOf(r)} ｜ 保存 ${r.saved}・スキップ ${r.skipped} ｜ ${now2} ｜ 数 ${dayN}`);
await pairUser(437);
await setDay(437, 57);
r = await submit({ ...PC, answers: [low(300), high(400), { question_id: 'landing_pay_varies_by', code: 'aircraft' }] });
now2 = await pairNow(437);
dayN = await day(437);
ok(r.rejected.length === 0 && r.saved === 3 && now2 === '300 USD／400 USD' && dayN === 60,
  '㉑ ★d5 残り3件の日に、300／400 と「何で変わるか」→ 3件とも保存（取っておいた1件ぶんは、高いほうを書いたら使い終わり）',
  `${whyOf(r)} ｜ 保存 ${r.saved} ｜ ${now2} ｜ 数 ${dayN}`);
await asUser(438);
await setDay(438, 58);
r = await submit({ ...PC, answers: [VAR, low(300), high(400)] });
now2 = await pairNow(438);
dayN = await day(438);
m = await mineOf(438, PC.airline);
ok(whyOf(r) === BOTH_LIM && r.saved === 1 && m[LP.id]?.code === 'variable' && now2 === '行なし／行なし' && dayN === 59,
  '㉑ ★d6 対をまだ持たない人が、残り2件の日に「一定額ではない」・300・400 → 親だけ保存し、2つの端は2つとも断る'
  + '（親で1件使ったあとの空きは1件。どちらの行もできない・1日の数は 59）',
  `${whyOf(r)} ｜ 保存 ${r.saved} ｜ ${now2} ｜ 数 ${dayN}`);

/* 上の8行は、決めた形だけ。こちらは「性質」を見る ── 上限の近く（55〜60件め）で、対の2問に何をどう
   並べて送っても、(1) 額を持つ2つが食い違って残らない・(2) 1日の数が 60 を超えない。
   送信は、決まった種から作る（Math.random を使わない ＝ 毎回同じ 400 回）。1回に1〜4件、中身は
   低いほう／高いほうの額（6つの額 × USD が多め・ときどき EUR）・「わからない」・スキップ。
   ⚠️ 数だけで緑にしない: 「2つとも上限で断った回」と「2件以上保存した回」が1回も無い並びでは、
      何も試していない。どちらかが 0 になったら、決まりではなく種を替える。 */
{
  let seed = 20261011;
  const rnd = () => {               // 決まった並びを返す（mulberry32）
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (k) => Math.floor(rnd() * k);
  const pick = (xs) => xs[int(xs.length)];
  const AMTS = [50, 100, 150, 200, 300, 400], CURS = ['USD', 'USD', 'USD', 'EUR'];
  const draw = () => {
    const k = int(8);
    if (k < 3) return low(pick(AMTS), pick(CURS));
    if (k < 6) return high(pick(AMTS), pick(CURS));
    return k === 6 ? dunno(pick([LO, HI])) : skipOf(pick([LO, HI]));
  };
  const said = (a) => `${a.question_id === LO ? '低' : '高'}${a.skip ? 'スキップ' : a.code ? '?' : `${a.num}${a.currency}`}`;
  let calls = 0, broken = 0, over60 = 0, cut = 0, both = 0, first = '';
  for (const n of [441, 442, 443, 444]) {
    await pairUser(n);
    for (let i = 0; i < 100; i++) {
      const start = 55 + int(6);
      const answers = Array.from({ length: 1 + int(4) }, draw);
      await setDay(n, start);
      const res = await submit({ ...PC, answers });
      const x = await pairRows(n);
      const end = await day(n);
      const why = whyOf(res);
      calls++;
      const clash = !!(x[LO] && x[HI] && x[LO].answer_num !== null && x[HI].answer_num !== null
        && (x[LO].answer_currency !== x[HI].answer_currency || Number(x[LO].answer_num) > Number(x[HI].answer_num)));
      if (clash) broken++;
      if (end > 60) over60++;
      if (start < 60 && why.includes(`${LO}:rate_limited`) && why.includes(`${HI}:rate_limited`)) cut++;
      if (res.saved >= 2) both++;
      if ((clash || end > 60) && !first) {
        first = `会員 ${n}・${i + 1}回め: 数 ${start} → ${end} ｜ ${answers.map(said).join('・')} ｜ ${why || '断りなし'} ｜ ${sayEnd(x[LO])}／${sayEnd(x[HI])}`;
      }
    }
  }
  ok(broken === 0 && over60 === 0 && cut > 0 && both > 0,
    '㉑ ★上限の近く（55〜60件め）で、対の2問に何を並べて送っても、食い違う2つは残らない・1日の数は 60 を超えない'
    + `（決まった並びの ${calls} 回: 食い違い ${broken}・60超え ${over60} ｜ 2つとも上限で断った回 ${cut}・2件以上保存した回 ${both}）`,
    first);
}
/* 相手の額は、この人の・この会社の行からだけ読む。同じ人がほかの会社で持っている額とは比べない
   （ほかの人の額と比べないことは、下の集計の3人が見ている ── 混ざると、あちらが通貨の違いで断られる）。 */
const PC2 = { airline: 'thai-airways', lang: 'ja' };   // ここまでのどの検査も回答を入れていない会社
await pairUser(421);                                   // PC の会社に、低いほう 100 USD・高いほう 200 USD
r = await submit({ ...PC2, answers: [VAR, low(300)] });
cx = await rowsOf(421, PC2.airline, [LO, HI]);
now2 = await pairNow(421);
ok(r.rejected.length === 0 && r.saved === 2 && sayEnd(cx[LO]) === '300 USD' && !cx[HI] && now2 === '100 USD／200 USD',
  '   同じ人がほかの会社で持っている額とは比べない（ほかの会社に 100／200 USD を持つ人が、この会社で低いほうを 300 → 保存）',
  `${whyOf(r)} ｜ ${sayEnd(cx[LO])}／${sayEnd(cx[HI])} ｜ ほかの会社 ${now2}`);

/* 集計 ── 通貨つきの質問は、**どれも**中央値を出さない（2026-10-11）。
   上の「通貨の違う額の真ん中を…」の1行は着陸手当の額（一定額）しか見ていないので、決まりが
   その1問だけに狭まっても緑のままだった。
   通貨つきの質問は質問マスタから引く（集計が見ているのと同じ印）。質問を足せば、ここも
   自動でその質問を見る。1問ずつ、別々の3人が円・ドル・ユーロで答える。
   ★1人が入れるのは、その1問だけ（同じ人に、低いほうと高いほうを別々の通貨で持たせない）。
   ⚠️ 額（下限 +1・+2・+3）は検査のための作りもの。 */
console.log('\n▼ ㉑ 集計 ── 通貨つきの質問は、どれも中央値を出さない');
const CURQ = (await rows(`select id from pv_condition_questions where active and has_currency order by priority`))
  .map((x) => x.id);
console.log(`   通貨つきの質問（質問マスタから）: ${CURQ.join('・')}`);
ok(['training_bond_amount', 'landing_pay_amount', 'landing_pay_from', 'landing_pay_to'].every((id) => CURQ.includes(id)),
  '㉑ 通貨つきの質問に、Bond の額と、着陸手当の額の3問（一定額・低いほう・高いほう）が入っている（空の一覧のまま通さない）',
  JSON.stringify(CURQ));
ok(same(CURQ, QUESTIONS.filter((q) => q.currency).map((q) => q.id)),
  '   質問マスタの通貨の印は、生成元と同じ質問に付いている', JSON.stringify(CURQ));

const MC = { ...LC, airline: 'korean-air' };   // ここまでのどの検査も回答を入れていない会社
let seat = 9001;                                // ここから先の会員番号は、まだ誰も使っていない
/* いちばん上の親から順に、その質問が開く答えを並べる（親の筋を通す） */
const chainOf = (id) => {
  const out = [];
  for (let q = QBY[id]; q.parent; q = QBY[q.parent]) {
    const p = QBY[q.parent];
    out.unshift(p.kind === 'multi' ? { question_id: p.id, codes: [q.parentWhen[0]] }
                                   : { question_id: p.id, code: q.parentWhen[0] });
  }
  return out;
};
/* 新しい3人が、親の筋を通して、その1問だけに答える。保存できなかった答えがあれば、それを返す */
const three = async (id, curs) => {
  const lost = [];
  for (let i = 0; i < 3; i++) {
    await asUser(seat++);
    const a = { question_id: id, num: QBY[id].num.min + i + 1 };
    if (curs) a.currency = curs[i];
    lost.push(...(await submit({ ...MC, answers: [...chainOf(id), a] })).rejected);
  }
  return lost;
};
const factOf = async (id) => (await rows(
  `select n, median_num from airline_condition_facts where airline = $1 and question_id = $2`,
  [MC.airline, id]))[0] || null;

for (const id of CURQ) {
  const lost = await three(id, ['JPY', 'USD', 'EUR']);
  f = await factOf(id);
  ok(lost.length === 0 && f && f.n === 3,
    `㉑ ${id}: 別々の3人が円・ドル・ユーロで答えたら、集計に出る（出るのは人数）`, JSON.stringify([lost, f]));
  ok(f && f.median_num === null,
    `㉑ ★${id}: 通貨の違う額の真ん中を、1つの数字として出さない（中央値は空）`, JSON.stringify(f));
}
/* 対照 ── 同じ形（新しい3人・親の筋を通す）で、通貨の無い数値質問には中央値が出る。
   これが無いと、「どの質問にも中央値を出さない」壊れ方でも、上が全部緑になる。 */
const CTL = QUESTIONS.find((q) => q.kind === 'num' && !q.currency && !q.topicOnly);
const ctlLost = await three(CTL.id, null);
f = await factOf(CTL.id);
ok(ctlLost.length === 0 && f && f.n === 3 && f.median_num !== null && Number(f.median_num) === CTL.num.min + 2,
  `   対照: 通貨の無い数値質問（${CTL.id}）は、同じ3人の形で中央値が出る → ${f?.median_num}`,
  JSON.stringify([ctlLost, f]));


/* オーナーが SQL Editor で見る検算表そのものを、ここで先に回しておく。
   本番で ❌ が出たときに「SQL が悪いのか検算が悪いのか」を迷わないため。 */
console.log('\n▼ db/airline-conditions.verify.sql');
const vrows = await rows(read('db/airline-conditions.verify.sql'));
const vbad = vrows.filter((x) => x['判定'] !== '✅');
ok(vrows.length === 15 && vbad.length === 0,
  `検算 ${vrows.length}行すべて ✅`,
  JSON.stringify(vbad.map((x) => `${x['検査']}: ${x['実際']}`)));

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
