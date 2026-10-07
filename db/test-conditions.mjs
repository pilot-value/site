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
     （4問のどれかから外しても）一緒に動いて緑のまま ＝ 「N／43 を動かさない」をどこも見ていなかった。
     一覧に出る質問を本当に足した回は、この1行と、43 を字で持っている所を一緒に直す
     （assert-admin-notify.mjs・roadmap-config.js・workflows/deploy-checklist.md）。 */
ok(LISTED.length === 43 && TOPIC_ONLY.length === 4,
  '   ★一覧に出る質問は 43・話題の入口からだけ出る質問は 4（ここだけ数字で固定）',
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
ok((await boom(`select * from airline_condition_facts limit 1`)) === null,
  'anon でも公開集計は読める');
await db.exec('reset role');

await db.exec('set role authenticated');
ok((await boom(`select * from airline_conditions limit 1`)) !== null,
  'ログイン済みでも個票は直接読めない（RPC 経由のみ）');
ok((await boom(`select pv_condition_hash('00000000-0000-4000-8000-000000000001'::uuid,'zipair',null)`)) !== null,
  'proof_hash の作り方は誰にも渡していない');
ok((await boom(`select * from pv_contributor_stats()`)) !== null,
  '貢献者集計はオーナーだけ');
await db.exec('reset role');

// ⑥ 公開集計に出してはいけない列が無いこと
const leak = await rows(`select column_name from information_schema.columns
  where table_schema='public' and table_name='airline_condition_facts'
    and column_name in ('answer_text','answer_json','proof_hash','airline_other',
                        'position','fleet','base_iata','contract_type')`);
ok(leak.length === 0, '公開集計に自由記述・準識別子が1列も無い',
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
console.log('\n▼ 公開集計（k≧3）');
const askJal = async (n, code) => {
  await asUser(n);
  await submit({ airline: 'jal', year: 2026, month: 8,
    answers: [{ question_id: 'roster_changes', code }] });
};
await askJal(11, 'rare'); await askJal(12, 'rare');
let v = await rows(`select * from airline_condition_facts where airline='jal'`);
ok(v.length === 0, '② 2人では公開集計に出ない');
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
ok(v.length === 0, '③「わからない」だけ3人では公開集計に出ない');
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

// 「その他（自由入力の社名）」は公開集計に出さない
for (const n of [51, 52, 53]) {
  await asUser(n);
  await submit({ airline: 'other', airline_other: 'Testair', year: 2026, month: 8,
    answers: [{ question_id: 'cadet_program', code: 'none' }] });
}
v = await rows(`select * from airline_condition_facts where airline='other'`);
ok(v.length === 0, '自由入力の社名（その他）は公開集計に出さない');

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

// ⑬ スキップだけの行は、公開集計にも自分の回答にも出ない
for (const n of [81, 82, 83]) {
  await asUser(n);
  await submit({ airline: 'peach', year: 2026, month: 8,
    answers: [{ question_id: 'landing_pay', skip: true }] });
}
v = await rows(`select * from airline_condition_facts where airline='peach'`);
ok(v.length === 0, '⑬ スキップだけ3人では公開集計に出ない（n にも n_unknown にも入らない）');
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

// 公開集計 ── 手段を選んだ人のぶんだけを数える
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
ok(f && f.n === 3 && f.answer_dist.company_full === 3, '⑱ バスの費用に3人が答えたら公開集計に出る（3人とも会社が全額）',
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
   「答えた項目：N／M」の分母にも分子にも数えない。保存・自分の回答・公開集計は他の質問と同じ。
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
   上の1行が見たのは**空の DB に流した結果**＝47問とも insert の側で入っている。
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
/* 期待する数は LISTED / TOPIC_ONLY から取る（43 と 4 は、質問マスタの節の1行が数字で固定している） */
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

// 公開集計（k≧3）は、ほかの質問と同じに働く
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
  '⑳ 2人では公開集計に出ない（昇格の順番・タクシー代の上限）');
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
ok(v.length === 0, '   任意の補足は公開集計に出ない（列そのものが無い）');
await asUser(225);
await submit({ ...TF, answers: [{ question_id: METHOD.id, codes: ['crew_bus'] }] });
ok((await factN(TF.airline, CAP)) === null,
  '⑳ ★手段からタクシーを外した人の、上限の古い答えを数え続けない（3人 → 2人で出なくなる）');
await asUser(225);
await submit({ ...TF, answers: [{ question_id: METHOD.id, codes: ['company_taxi', 'crew_bus'] }] });
ok((await factN(TF.airline, CAP))?.n === 3, '   タクシーを選び直すと、また3人に戻る');


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
