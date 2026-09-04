// 管理者への通知メール（supabase/functions/notify-admin/index.ts）の検査。
//
// この検査を作った理由:
//   1) 給与レポートは user_id を持たない設計で「誰がいくら」を運営側に残さない
//      （db/pay-reports.sql）。その数字をメールに載せると、受信箱と Resend の
//      送信ログに残る＝設計で守ったものを送信で外に出すことになる。
//      db/test-announce.mjs が会員向けお知らせメールに同じ検査をしているが、
//      管理者向けには今まで何も無かった。ビルダーに1行足すだけで漏れる。
//   2) いちばん静かな壊れ方は「ビルダーだけ足して Webhook のトリガを忘れる」。
//      実装は正しく見えるのに一通も届かない。両者の顔ぶれを突き合わせる。
//   3) 待遇アンケートは「スキップした」だけの行も本物の行として保存される
//      （db/airline-conditions.sql の ac_answer_any_ck）。それで通知すると
//      質問を飛ばすたびに中身の無いメールが飛ぶ。
//
// 本体（TypeScript）をそのまま import する。Node 24 は .ts を直接読めるので
// 型注釈を剥がす必要はない。Deno.env / Deno.serve と fetch だけ差し替える。
// assert-translate-review.mjs と同じ手口。
//
// ネットワークも API キーも localhost も使わない。使い方: node assert-admin-notify.mjs

import { readFileSync } from 'fs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

globalThis.Deno = { env: { get: () => '' }, serve: () => {} };

/* 偽の Supabase。テーブル名ごとに返す行を差し替える。 */
let ROWS = {};
globalThis.fetch = async (url) => {
  const t = String(url).match(/\/rest\/v1\/([a-z_]+)/)?.[1];
  const got = ROWS[t];
  if (got === undefined) throw new Error(`テストが用意していないテーブルを引いた: ${t}`);
  return { ok: true, json: async () => (Array.isArray(got) ? got : [got]) };
};

const nx = await import('./supabase/functions/notify-admin/index.ts');

let pass = 0, fail = 0;
const ck = (name, ok, detail = '') => {
  if (ok) pass++; else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
};

/* ════════════════════════════════════════════════════════════════
   ① 金額・明細の項目名がメールに1文字も出ないこと
   ════════════════════════════════════════════════════════════════
   本物の行より「多い」データを返す。ビルダーが SELECT を広げても、
   本文に出さない限り通る＝守りたいのは出力であって SELECT ではない。 */

// 見つけたら即アウトの値。実データでは絶対に出ない並びにしてある。
const SECRET = {
  '月額総支給':        '1234567',
  '基本給':            '2345678',
  '飛行手当':          '3456789',
  '年間賞与':          '4567890',
  '年収（原通貨）':    '5678901',
  '年収（USD）':       '6789012',
  '年収（円）':        '7890123',
  '手取り':            '8901234',
  '明細の項目名':      'ZZ-TESTALLOWANCE-LABEL',
  /* ★2026-08-26 追加。本人が手で書いた内訳（pay_items）の「明細上の名称」と金額。
     読み取った明細と同じ扱い＝行数だけ出して、名前も額も出さない。 */
  '内訳の項目名':      'ZZ-MYITEM-LABEL',
  '内訳の金額':        '8887776',
  '預かりの中身':      'ZZ-PENDING-PAYLOAD-9998887',
  '待遇の金額回答':    '9998887',
  '待遇の自由記述':    'ZZ-FREE-TEXT-SHOULD-NOT-APPEAR',
  /* ★2026-09-04 追加。要望の投稿者ハッシュ。sha256(user_id ‖ 固定文字列) ＝
     同じ人なら毎回同じ値なので、メールに1度でも出れば
     「この12件は同じ人が書いた」が受信箱と Resend のログの上で組める。 */
  '要望の投稿者ハッシュ': 'ZZ-AUTHOR-HASH-DO-NOT-SEND',
};
const leaks = (mail) => {
  const hay = `${mail.subject}\n${mail.html}`;
  return Object.entries(SECRET).filter(([, v]) => hay.includes(v)).map(([k]) => k);
};

/* ── 給与レポート ─────────────────────────────────────────── */
ROWS = {
  pay_reports: {
    id: 'pr-1', created_at: '2026-08-22T11:00:00+00:00',
    airline: 'emirates', airline_other: null,
    period_year: 2026, period_month: 7,
    position: 'captain', fleet: 'b777',
    /* 役職・区分は 2026-08-26 から複数。単数の job_role には先頭が残る。 */
    job_role: 'line', job_roles: ['line', 'instructor'],
    currency: 'AED', source: 'payslip', lang: 'ja', verify_level: 1,
    // ↓ ここから下は全部「出てはいけない」もの
    gross_monthly: 1234567, base_pay: 2345678, flight_variable_pay: 3456789,
    bonus_annual: 4567890, annual_total_orig: 5678901, annual_total_usd: 6789012,
    annual_total_jpy: 7890123, net_pay_actual: 8901234,
    payslip_detail: { v: 1, earnings: [
      { label: 'ZZ-TESTALLOWANCE-LABEL', amount: 3456789, kind: 'allowance' },
      { label: 'ZZ-TESTALLOWANCE-LABEL', amount: 2345678, kind: 'base' },
    ] },
    pay_items: { v: 1, fixed_none: false,
      variable: [{ amount: 8887776, basis: 'block', label: 'ZZ-MYITEM-LABEL', rule: 'ZZ-MYITEM-LABEL' }],
      other: [{ amount: 8887776, label: 'ZZ-MYITEM-LABEL' }] },
  },
};
const pr = await nx.buildPayReport('pr-1');
console.log('\n── 給与レポート ─────────────────────────');
ck('メールができる', !!pr);
ck('金額・項目名が1つも出ない', leaks(pr).length === 0, `漏れた: ${leaks(pr).join(' / ')}`);
ck('件名で「給与レポート」とわかる', pr.subject.includes('給与レポート'));
ck('件名に会社と対象月が出る', pr.subject.includes('emirates') && pr.subject.includes('2026-07'),
   pr.subject);
ck('入れ方が「明細から」', pr.html.includes('明細から'));
ck('内訳は件数だけ（2項目）', pr.html.includes('2項目'));
/* ★2026-08-26。本人が書いた内訳も行数だけ。名前と額は SECRET が見張っている。 */
ck('本人が書いた内訳も行数だけ（2行）', pr.html.includes('2行'), pr.html);
/* ★役職・区分は複数。ここが1つしか出ないと、教官・組合を兼ねている人の
   「どの役割の給与か」が運営側から見えなくなる。 */
ck('区分に複数の役職が並ぶ', pr.html.includes('line・instructor'), pr.html);

ROWS.pay_reports = { ...ROWS.pay_reports, source: 'web', payslip_detail: null, pay_items: null,
                     job_roles: null };
const prWeb = await nx.buildPayReport('pr-1');
ck('手入力は「手入力」', prWeb.html.includes('手入力') && !prWeb.html.includes('明細から'));
ck('内訳が無ければ「なし」', prWeb.html.includes('なし'));
/* 配列が空でも単数の job_role が残っていれば、そちらを出す（過去の行）。 */
ck('配列が無ければ単数の役職を出す', prWeb.html.includes('line'), prWeb.html);

/* ── 登録前の預かり ───────────────────────────────────────── */
ROWS = {
  pay_reports_pending: {
    id: 'pp-1', created_at: '2026-08-22T12:00:00+00:00',
    airline: 'ana', period_year: 2026, period_month: 7, lang: 'ja',
    payload: { gross_monthly: 'ZZ-PENDING-PAYLOAD-9998887' },
  },
};
const pp = await nx.buildPayReportPending('pp-1');
console.log('\n── 登録前の預かり ───────────────────────');
ck('メールができる', !!pp);
ck('payload の中身が出ない', leaks(pp).length === 0, `漏れた: ${leaks(pp).join(' / ')}`);
ck('件名で「預かり」とわかる', pp.subject.includes('預かり'), pp.subject);
ck('本文に「もう1通届く」の説明がある', pp.html.includes('もう1通'));
ck('本文に「離脱」の説明がある', pp.html.includes('離脱'));

/* ── 待遇アンケート ───────────────────────────────────────── */
const COND = {
  id: 'ac-1', created_at: '2026-08-22T13:00:00+00:00',
  proof_hash: 'deadbeef', airline: 'jal', airline_other: null,
  question_id: 'days_off_request',
  answer_code: 'yes', answer_codes: null, answer_num: null,
  answer_currency: null, answer_text: null, skipped_at: null,
  position: 'fo', fleet: 'b787', lang: 'ja',
};
const QUESTIONS = [
  { id: 'days_off_request', label_ja: '希望する休日の日付を指定できますか？', kind: 'choice', has_currency: false },
];
ROWS = {
  airline_conditions: COND,
  pv_condition_questions: QUESTIONS,
};
console.log('\n── 待遇アンケート ───────────────────────');

// 累計の数え上げと質問マスタで同じテーブルを何度も引くので、引き方で返し分ける
globalThis.fetch = async (url) => {
  const u = String(url);
  const t = u.match(/\/rest\/v1\/([a-z_]+)/)?.[1];
  if (t === 'airline_conditions') {
    // id=eq.<id> は1行、proof_hash=eq.<h> は「これまでに答えた行」
    return { ok: true, json: async () => (u.includes('proof_hash=eq.')
      ? [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }, { id: 'f' }, { id: 'g' }]
      : [ROWS.airline_conditions]) };
  }
  if (t === 'pv_condition_questions') {
    return { ok: true, json: async () => (u.includes('active=eq.true')
      ? Array.from({ length: 32 }, (_, i) => ({ id: `q${i}` }))
      : QUESTIONS.filter((q) => u.includes(encodeURIComponent(q.id)) || u.includes(q.id))) };
  }
  throw new Error(`テストが用意していないテーブルを引いた: ${t}`);
};

const c1 = await nx.buildCondition('ac-1');
ck('メールができる', !!c1);
ck('件名で「待遇アンケート」とわかる', c1.subject.includes('待遇アンケート'), c1.subject);
ck('質問文が出る', c1.html.includes('希望する休日の日付を指定できますか'));
ck('選んだコードがそのまま出る', c1.html.includes('yes'));
ck('累計が n / 32問 で出る', c1.html.includes('7 / 32問'));

// スキップの行では送らない
ROWS.airline_conditions = { ...COND, answer_code: null, skipped_at: '2026-08-22T13:05:00+00:00' };
ck('スキップでは送らない', (await nx.buildCondition('ac-1')) === null);

// 金額の回答は数字を出さない
ROWS.airline_conditions = { ...COND, answer_code: null, answer_num: 9998887, answer_currency: 'JPY' };
QUESTIONS[0] = { ...QUESTIONS[0], kind: 'num', has_currency: true };
const cMoney = await nx.buildCondition('ac-1');
ck('金額の回答は数字を出さない', leaks(cMoney).length === 0, `漏れた: ${leaks(cMoney).join(' / ')}`);
ck('代わりに「金額の回答あり」と出る', cMoney.html.includes('金額の回答あり'));

// 金額でない数値（年数・日数）はそのまま出す
QUESTIONS[0] = { ...QUESTIONS[0], kind: 'num', has_currency: false };
ROWS.airline_conditions = { ...COND, answer_code: null, answer_num: 20, answer_currency: null };
ck('日数・年数はそのまま出る', (await nx.buildCondition('ac-1')).html.includes('20'));

// 自由記述は中身を出さない
ROWS.airline_conditions = { ...COND, answer_text: 'ZZ-FREE-TEXT-SHOULD-NOT-APPEAR' };
const cText = await nx.buildCondition('ac-1');
ck('自由記述の中身を出さない', leaks(cText).length === 0, `漏れた: ${leaks(cText).join(' / ')}`);
ck('付いている事実は伝える', cText.html.includes('自由記述あり'));

// 質問マスタが引けなくても数値を出さない（金額かもしれない側に倒す）
QUESTIONS.length = 0;
ROWS.airline_conditions = { ...COND, answer_code: null, answer_num: 9998887, answer_currency: null };
ck('質問マスタが引けないときは数値を出さない',
   leaks(await nx.buildCondition('ac-1')).length === 0);

// 数え上げに失敗しても通知そのものは落とさない（累計はおまけ）。
// 「0 / 0問」のような嘘の数字も出さない。
const fetchOK = globalThis.fetch;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('proof_hash=eq.') || u.includes('active=eq.true')) throw new Error('数え上げに失敗');
  return fetchOK(url);
};
QUESTIONS[0] = { id: 'days_off_request', label_ja: '希望する休日の日付を指定できますか？', kind: 'choice', has_currency: false };
ROWS.airline_conditions = { ...COND };
const cNoCount = await nx.buildCondition('ac-1');
ck('累計を数えられなくてもメールは届く', !!cNoCount && cNoCount.html.includes('希望する休日'));
ck('数えられないときは累計の行を出さない', !!cNoCount && !cNoCount.html.includes('累計'), cNoCount?.html);

// 質問マスタが空で返ってきた場合も同じ（「0 / 0問」を出さない）
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('active=eq.true')) return { ok: true, json: async () => [] };
  return fetchOK(url);
};
const cZero = await nx.buildCondition('ac-1');
ck('質問が0件で返っても「0問」と出さない', !!cZero && !cZero.html.includes('累計'), cZero?.html);
globalThis.fetch = fetchOK;

/* ════════════════════════════════════════════════════════════════
   ② 新規会員登録と「行の補完」が件名で区別できること
   ════════════════════════════════════════════════════════════════
   投稿・招待まわりの4つの RPC が `insert into public.profiles (id) values (...)`
   を打つ。それも INSERT なので webhook が飛び、中身が全部「—」の
   「新規会員登録 — 氏名なし」が新規登録として届いていた。 */
console.log('\n── 新規会員登録 ─────────────────────────');
globalThis.fetch = async (url) => {
  const t = String(url).match(/\/rest\/v1\/([a-z_]+)/)?.[1];
  if (t !== 'profiles') throw new Error(`想定外: ${t}`);
  return { ok: true, json: async () => [ROWS.profiles] };
};
ROWS = { profiles: {
  id: 'u-1', created_at: '2026-08-22T10:51:47+00:00', name: '大空 翔',
  email: 'somebody@example.com', company: 'ANA', position: 'fo',
  country: 'JP', email_opt_in: true,
} };
const p1 = await nx.buildProfile('u-1');
ck('本物の登録は「新規会員登録」', p1.subject.includes('新規会員登録'), p1.subject);
ck('メール受信の同意が出る', p1.html.includes('メール受信の同意'));

ROWS.profiles = { id: 'u-2', created_at: '2026-08-22T10:51:47+00:00', name: null,
  email: null, company: null, position: null, country: null, email_opt_in: false };
const p2 = await nx.buildProfile('u-2');
ck('email が無い行は「新規登録ではありません」と件名に出る',
   p2.subject.includes('新規登録ではありません'), p2.subject);
ck('「新規会員登録」を名乗らない', !p2.subject.includes('新規会員登録'), p2.subject);

/* ── 要望（ロードマップの画面） ───────────────────────────── */
/* ②が「profiles しか引けない」偽物に差し替えているので、ROWS を素直に返す形へ戻す。 */
globalThis.fetch = async (url) => {
  const t = String(url).match(/\/rest\/v1\/([a-z_]+)/)?.[1];
  const got = ROWS[t];
  if (got === undefined) throw new Error(`テストが用意していないテーブルを引いた: ${t}`);
  return { ok: true, json: async () => (Array.isArray(got) ? got : [got]) };
};
/* ★守るのは「誰が書いたか」。本文は出してよい（返事をするのに要る）が、
     author_hash は1文字も出してはいけない。 */
ROWS = {
  pv_requests: {
    id: 'rq-1', created_at: '2026-09-04T09:00:00+00:00',
    body: '機種ごとの月間フライト時間を会社別に見たい',
    category: 'data', status: 'new',
    // ↓ ビルダーが SELECT を広げても、本文に出さない限り通る
    author_hash: 'ZZ-AUTHOR-HASH-DO-NOT-SEND',
  },
};
const rq = await nx.buildRequest('rq-1');
console.log('\n── 要望 ─────────────────────────────────');
ck('メールができる', !!rq);
ck('★投稿者のハッシュが1文字も出ない', leaks(rq).length === 0, `漏れた: ${leaks(rq).join(' / ')}`);
ck('件名で「要望」とわかる', rq.subject.includes('要望'), rq.subject);
ck('件名に区分が出る', rq.subject.includes('データ'), rq.subject);
ck('本文が読める', rq.html.includes('機種ごとの月間フライト時間'));
/* 生の HTML をメールに通さない。<script> をそのまま書かれても、
   受信箱で動く形にはしない（esc を通してから <br> に直している）。 */
ROWS.pv_requests = { ...ROWS.pv_requests, body: '<script>alert(1)</script>\n2行目' };
const rqX = await nx.buildRequest('rq-1');
ck('★本文の HTML がそのまま通らない', !rqX.html.includes('<script>'), rqX.html);
ck('改行は <br> になる', rqX.html.includes('<br>2行目'), rqX.html);

/* ════════════════════════════════════════════════════════════════
   ③ ビルダーと Webhook のトリガの顔ぶれが一致すること
   ════════════════════════════════════════════════════════════════ */
console.log('\n── ビルダー ↔ Webhook ───────────────────');
const ts = read('./supabase/functions/notify-admin/index.ts');
const sql = read('./db/notify-admin-webhooks.sql');

const bBlock = ts.slice(ts.indexOf('const builders'), ts.indexOf('};', ts.indexOf('const builders')));
const builders = [...bBlock.matchAll(/^\s*([a-z_0-9]+):\s*build/gm)].map((m) => m[1]).sort();

const aStart = sql.indexOf('foreach tbl in array array[');
const aBlock = sql.slice(aStart, sql.indexOf('] loop', aStart));
const tables = [...aBlock.matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1]).sort();

ck('ビルダーを7つ持っている', builders.length === 7, builders.join(', '));
ck('index.ts の builders と db/notify-admin-webhooks.sql の表が同じ',
   JSON.stringify(builders) === JSON.stringify(tables),
   `builders: ${builders.join(', ')}\n      webhooks: ${tables.join(', ')}`);

/* ── SQL が壊れていないこと ──────────────────────────────────
   2026-08-23、この SQL を Node の String.replace(old, new) で一括編集して
   壊した。置換文字列の中の $ は特殊記号として解釈される:
     $$ → $ に潰れる（do $$ が do $ になり Postgres が構文エラー）
     $' → マッチより後ろの文字列全体に化ける（末尾の確認クエリが
          ファイルの途中に丸ごと混入した）
   本番の SQL Editor に貼るまで気づけなかったので、ここで見張る。
   一括編集は必ず関数形 s.replace(old, () => neu) で書くこと。 */
console.log('\n── SQL の形 ─────────────────────────────');
{
  // -- のコメント行を落としてから見る（コメント内の例は数えない）
  const live = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  const tags = [...live.matchAll(/\$([a-z_]*)\$/g)].map((m) => m[1]);
  const counts = {};
  for (const t of tags) counts[t] = (counts[t] ?? 0) + 1;
  const odd = Object.entries(counts).filter(([, n]) => n % 2 !== 0);
  ck('$$ の開きと閉じが対になっている', odd.length === 0,
     odd.map(([t, n]) => `$${t}$ が ${n} 個`).join(' / '));
  ck('do $ が単独で残っていない', !/\bdo\s+\$(?![a-z_]*\$)/.test(live));
  ck('確認クエリが1つだけ（末尾が途中に混入していない）',
     live.split('as webhook,').length - 1 === 1);
  ck('7つの表が全部書かれている',
     ['contacts', 'profiles', 'reviews_v2', 'pay_reports',
      'pay_reports_pending', 'airline_conditions',
      'pv_requests'].every((t) => live.includes(`'${t}'`)));
  /* ★♡ の表は入れない。1押しごとにメールが飛ぶ。 */
  ck('★pv_request_likes は Webhook を作らない', !live.includes("'pv_request_likes'"));
}

/* ════════════════════════════════════════════════════════════════
   ④ 「入れ方」の言い方が db/usage.mjs と同じであること
   ════════════════════════════════════════════════════════════════
   同じものの言い方が2つに割れると、数字を突き合わせるときに迷う。 */
console.log('\n── 文言 ─────────────────────────────────');
const usage = read('./db/usage.mjs');
for (const w of ['明細から', '手入力']) {
  ck(`「${w}」が db/usage.mjs と揃っている`, usage.includes(w) && ts.includes(w));
}

/* ════════════════════════════════════════════════════════════════ */
console.log(`\n${fail ? '❌' : '✅'} ${pass} 件通過 / ${fail} 件失敗`);
if (fail) process.exitCode = 1;
