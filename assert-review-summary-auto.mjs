// 口コミの要約を「自動で作り直す」側（Edge Function summarize-reviews）を、通信ゼロで確かめる。
//
// 守っているもの:
//   ・変わっていなければ、モデルを呼ばない（＝お金がかからない）
//   ・変わっていたら、1社につきちょうど1回だけ呼ぶ／検品を通った点だけを預ける
//   ・3件を切った会社は、モデルを呼ばずに消す
//   ・鍵が死んだら運営に1日1通だけ知らせて、その回はそこでやめる（失敗の回数に数えない）
//   ・作っているあいだに口コミが動いたら、古い集合の要約は預からない ── これは**正常**として扱う
//   ・同じ会社の知らせが重なっても、2人目は払わない
//   ・口コミの文・要約の文・向こうの返事の文・キーが、ログにも返り値にも1文字も出ない
//
// ここで見ていないもの（＝本番で実際に流すまで分からないもの）:
//   モデルが返す日本語の質／1回の費用／モデルがこの呼び方を受け付けるか／
//   返事のあとも関数が走り続けるか（EdgeRuntime.waitUntil）。
//   DB 側の判定（同じ集合に二度払わせない・古い集合で上書きさせない）の本体は SQL に在り、
//   db/test-review-summary.mjs の 14〜16 が本物の Postgres で見ている。
//   ★ここの DB は**身代わり**（下の makeWorld）。返す語と形だけを SQL に合わせてある。
//     関数と本物の SQL を実際につないで通すのは、db/test-review-summary.mjs の 18。
//
// ネットワークも API キーも使わない。使い方: node assert-review-summary-auto.mjs
//
// 本体（TypeScript）をそのまま import する（assert-translate-review.mjs と同じやり方）。
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC_AT = new URL('./supabase/functions/summarize-reviews/index.ts', import.meta.url);
/* ★先に素のまま読む ＝ Deno が無くても読めること（道具 gen-review-summary.mjs が Node から読む）。 */
const SR = await import('./supabase/functions/summarize-reviews/index.ts');
const TOOLSIDE = await import('./gen-review-summary.mjs');
globalThis.Deno = { env: { get: () => '' }, serve: () => {} };
const TR = await import('./supabase/functions/translate-review/index.ts');
delete globalThis.Deno;

/* 作る言語（LANGS）だけを替えた形で、本体をもう1つ読む。
   出荷の形と同じ言語を頼まれたら、本物の1枚をそのまま読む（別の実体として）。
   違うときだけ、その1行を書き換えた写しを一時フォルダに置いて読む（リポジトリには書かない）。
   ★下の場面は全部「日本語だけ」の形で書いてある。LANGS に 'en' を足しても、この検査は緑のまま
     （足した形そのものは 16 で見ている）。 */
const SRC = readFileSync(SRC_AT, 'utf8');
const LANGS_LINE = /^export const LANGS = \[[^\]\n]*\];$/m;
const temps = [];
async function build(langs, tag) {
  if (JSON.stringify(langs) === JSON.stringify(SR.LANGS)) return import(`./supabase/functions/summarize-reviews/index.ts?as=${tag}`);
  const dir = mkdtempSync(join(tmpdir(), 'pv-summarize-'));
  temps.push(dir);
  writeFileSync(join(dir, 'index.ts'), SRC.replace(LANGS_LINE, () => `export const LANGS = ${JSON.stringify(langs)};`));
  return import(pathToFileURL(join(dir, 'index.ts')).href + `?as=${tag}`);
}
const JA = JSON.stringify(SR.LANGS) === '["ja"]' ? SR : await build(['ja'], 'ja');

let pass = 0, fail = 0;
const realLog = console.log;
const ck = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; realLog(`  ✗ ${name}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`); }
};
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; realLog(`  ✗ ${name} ${extra}`); } };
/* 1つの場面が途中で落ちても、残りを流して最後の行まで出す（落ちたことは fail に数える）。 */
const section = async (fn) => {
  try { await fn(); } catch (e) { fail++; realLog(`  ✗ 場面が途中で落ちた: ${String((e && e.message) || e).slice(0, 200)}`); }
};
const tick = () => new Promise((r) => setImmediate(r));
/* 時間で待たない。条件が満たされるまで待つ。 */
const until = async (cond, label) => {
  for (let i = 0; i < 5000; i++) { if (cond()) return; await tick(); }
  throw new Error('待っても満たされない: ' + label);
};

// ── 身代わりの世界（DB・Anthropic・Resend）─────────────────────
const SB = 'https://db.example.test';
const DAY0 = Date.parse('2026-10-07T03:00:00Z');
const G_TEXT = 'ヨウヤク 乗員どうしの風通しがよいという声が複数ある。';
const C_TEXT = 'ヨウヤク 勤務の変更が直前に入ることがあるという声がある。';
const GOOD_REPLY = {
  good: [{ text: G_TEXT, cat: 'culture', reviews: [1, 2] }],
  concern: [{ text: C_TEXT, cat: 'wlb', reviews: [2, 3] }],
};
const modelOk = (input, usage = { input_tokens: 812, output_tokens: 143 }, stop = 'tool_use') => ({
  ok: true, status: 200,
  json: async () => ({ content: [{ type: 'tool_use', name: 'submit_summary', input }], stop_reason: stop, usage }),
});
const modelErr = (status, type) => ({
  ok: false, status,
  text: async () => (type === null ? '<html>ERRBODYMARK bad gateway</html>'
    : JSON.stringify({ type: 'error', error: { type, message: 'ERRBODYMARK ' + type } })),
});

function makeWorld() {
  const w = {
    t: DAY0, seq: 0,
    rows: new Map(),      // 会社コード → 口コミの行
    stored: new Map(),    // 「会社|言語」→ 預かっている要約
    runs: new Map(),      // 「会社|言語」→ 番（控え）
    http: [], logs: [], mails: [], modelCalls: [], replies: [],
    model: null,
    env: {
      ANTHROPIC_API_KEY: 'sk-test-KEYMARK-anthropic', SUPABASE_URL: SB,
      SUPABASE_SERVICE_ROLE_KEY: 'service-KEYMARK-role', RESEND_API_KEY: 're-KEYMARK-send',
    },
  };
  const key = (a, l) => `${a}|${l}`;
  const canon = (a) => Object.keys(SR.LEGACY_OF).find((k) => SR.LEGACY_OF[k] === a) || a;
  const rowsOf = (a) => w.rows.get(a) || [];
  w.sig = (a) => createHash('md5').update(rowsOf(a).map((r) => r.id).sort().join(',')).digest('hex');
  w.add = (a, count = 1) => {
    if (!w.rows.has(a)) w.rows.set(a, []);
    for (let i = 0; i < count; i++) {
      const s = ++w.seq;
      w.rows.get(a).push({
        id: `id-${String(s).padStart(4, '0')}`, airline: a, created_at: `2026-05-${String((s % 27) + 1).padStart(2, '0')}T00:00:00.000${String(100 + s)}Z`,
        orig_lang: 'ja', translations: null, position: 'ROWMARK機長', fleet: 'ROWMARK-B787', proof_hash: 'ROWMARK-hash',
        culture_comment: `ホンブン 風通しがよいと感じる（${s}）`, wlb_comment: `ホンブン 勤務の変更が直前に入る（${s}）`,
        salary_comment: null, benefits_comment: null, ops_comment: null, training_comment: null,
      });
    }
  };
  w.drop = (a, count = 1) => { w.rows.set(a, rowsOf(a).slice(0, Math.max(0, rowsOf(a).length - count))); };
  /* いまの集合で「預かっている」ことにする（＝新しい状態）。 */
  w.store = (a, l = 'ja') => { w.stored.set(key(a, l), { sig: w.sig(a), n: rowsOf(a).length, good: [{ text: 'ヨウヤク 前から預かっている点。', cat: 'culture', k: 2 }], concern: [] }); };
  /* SQL の pv_review_summary_need と同じ語を返す（判定の本体は SQL。ここは形だけ）。 */
  w.need = (a, l) => {
    const n = rowsOf(a).length, st = w.stored.get(key(a, l)), run = w.runs.get(key(a, l));
    if (n < SR.MIN_REVIEWS) return st ? 'too_few' : 'none';
    const sig = w.sig(a);
    if (st && st.sig === sig) return 'fresh';
    if (run && run.sig === sig) return run.state === 'running' ? 'busy' : run.state === 'done' ? 'settled' : run.tries >= 3 ? 'parked' : 'cooling';
    return st ? 'stale' : 'missing';
  };
  w.rpc = {
    pv_review_summary_due: (p) => {
      const langs = [...new Set(p.langs || [])];
      const all = p.airline ? [canon(p.airline)] : [...new Set([...w.rows.keys(), ...[...w.stored.keys()].map((k) => k.split('|')[0])])].sort();
      const due = [];
      for (const a of all) for (const l of langs) {
        const why = w.need(a, l);
        if (['stale', 'missing', 'too_few'].includes(why)) due.push({ airline: a, lang: l, why });
      }
      return { ok: true, checked: all.length * langs.length, due };
    },
    pv_review_summary_take: (p) => {
      const why = w.need(p.airline, p.lang), n = rowsOf(p.airline).length, basis = w.sig(p.airline);
      if (why === 'too_few') return { ok: true, state: 'too_few', n, basis };
      if (why !== 'stale' && why !== 'missing') return { ok: true, state: why };
      w.runs.set(key(p.airline, p.lang), { sig: basis, state: 'running', tries: 0 });
      /* 本物と同じく、渡すのは会社コード・時刻・原文の言語・訳・6分類の本文だけ（id や職位は渡さない）。 */
      const rows = rowsOf(p.airline).map((r) => ({
        airline: r.airline, created_at: r.created_at, orig_lang: r.orig_lang, translations: r.translations,
        culture_comment: r.culture_comment, salary_comment: r.salary_comment, benefits_comment: r.benefits_comment,
        wlb_comment: r.wlb_comment, ops_comment: r.ops_comment, training_comment: r.training_comment,
      }));
      return { ok: true, state: 'go', why, n, basis, rows };
    },
    pv_review_summary_set_auto: (p) => {
      const k = key(p.airline, p.lang), run = w.runs.get(k);
      if (p.basis !== w.sig(p.airline)) {
        if (run && run.sig === p.basis && run.state === 'running') w.runs.delete(k);
        return { ok: false, error: 'stale_input' };
      }
      const pts = [...(p.good || []), ...(p.concern || [])];
      if (!pts.length) {
        w.stored.delete(k);
        if (rowsOf(p.airline).length >= SR.MIN_REVIEWS) w.runs.set(k, { sig: p.basis, state: 'done', tries: 0 }); else w.runs.delete(k);
        return { ok: true, state: 'deleted' };
      }
      if (p.n !== rowsOf(p.airline).length) return { ok: false, error: 'bad_n' };
      if (pts.some((x) => !(x.k >= SR.MIN_SUPPORT))) return { ok: false, error: 'weak_point' };
      w.stored.set(k, { sig: p.basis, n: p.n, good: p.good, concern: p.concern });
      w.runs.set(k, { sig: p.basis, state: 'done', tries: 0 });
      return { ok: true, state: 'saved', airline: p.airline, lang: p.lang, n: p.n, as_of: '2026-05-31' };
    },
    pv_review_summary_done: (p) => {
      const k = key(p.airline, p.lang), run = w.runs.get(k);
      const hit = !!run && run.sig === p.basis && run.state === 'running';
      if (hit && p.state === 'released') w.runs.delete(k);
      if (hit && p.state === 'failed') w.runs.set(k, { sig: p.basis, state: 'failed', tries: run.tries + 1 });
      return { ok: true, state: p.state, hit };
    },
  };
  return w;
}

/* 1回の呼び出しに渡す道具一式。o.rpc で、その回だけ DB の返事を差し替えられる。 */
function depsOf(w, o = {}) {
  const d = {
    fetch: async (url, init = {}) => {
      const rec = { tag: o.tag || '', url: String(url), method: init.method, headers: init.headers || {}, body: init.body };
      w.http.push(rec);
      if (rec.url.startsWith(SB + '/rest/v1/rpc/')) {
        rec.rpc = rec.url.slice((SB + '/rest/v1/rpc/').length);
        rec.p = JSON.parse(rec.body).p;
        const over = o.rpc ? await o.rpc(rec.rpc, rec.p, w) : undefined;
        if (over && over.throws) throw new Error('DBBODYMARK connection refused');
        if (over && over.http) return { ok: false, status: over.http, json: async () => ({ message: 'DBBODYMARK' }), text: async () => 'DBBODYMARK' };
        if (over && over.notJson) return { ok: true, status: 200, json: async () => { throw new SyntaxError('DBBODYMARK'); } };
        const reply = over && 'raw' in over ? over.raw : w.rpc[rec.rpc] ? w.rpc[rec.rpc](rec.p) : null;
        if (reply === null && !(over && 'raw' in over)) return { ok: false, status: 404, json: async () => ({}), text: async () => 'DBBODYMARK' };
        return { ok: true, status: 200, json: async () => reply };
      }
      if (rec.url === 'https://api.anthropic.com/v1/messages') {
        const req = JSON.parse(rec.body);
        w.modelCalls.push({ tag: rec.tag, req, headers: rec.headers, signal: init.signal });
        return (o.model || w.model || (() => modelOk(GOOD_REPLY)))(req, w, w.modelCalls.length);
      }
      if (rec.url === 'https://api.resend.com/emails') {
        w.mails.push({ headers: rec.headers, body: JSON.parse(rec.body) });
        if (o.mailFails) throw new Error('resend down');
        return { ok: true, status: 200, json: async () => ({ id: 'x' }) };
      }
      throw new Error('検査の外へ出ようとした: ' + rec.url);
    },
    env: (k) => ((o.env && k in o.env ? o.env[k] : w.env[k]) ?? ''),
    log: (line) => { w.logs.push(String(line)); },
    now: () => w.t,
  };
  if (o.waitUntil) d.waitUntil = o.waitUntil;
  return d;
}

const AT = 'https://edge.example.test/functions/v1/summarize-reviews';
async function call(w, body, o = {}, handle = JA.handle) {
  const init = { method: o.method || 'POST', headers: { 'Content-Type': 'application/json', ...(o.headers || {}) } };
  if (init.method === 'POST') init.body = typeof body === 'string' ? body : JSON.stringify(body);
  const res = await handle(new Request(AT, init), depsOf(w, o));
  const text = await res.text();
  w.replies.push(text);
  return { status: res.status, body: JSON.parse(text) };
}
const event = (type, airline, oldAirline) => ({
  type, table: 'reviews_v2', schema: 'public',
  record: type === 'DELETE' ? null : { id: 'ROWMARK-id', airline, culture_comment: 'ホンブン webhook が運んできた本文', proof_hash: 'ROWMARK-hash' },
  old_record: type === 'INSERT' ? null : { id: 'ROWMARK-id', airline: oldAirline || airline, culture_comment: 'ホンブン 古い本文' },
});
const rpcs = (w, name, tag) => w.http.filter((h) => h.rpc === name && (tag === undefined || h.tag === tag));
const worlds = [];
const world = () => { const w = makeWorld(); worlds.push(w); return w; };


// ════════════════════════════════════════════════════════════
// 1) 文面・検品・上限の実体は1つ
// ════════════════════════════════════════════════════════════
await section(async () => {
  const src = SRC;
  ok('作る言語の一覧は1行で書いてある（1語足せば済む形）', (src.match(new RegExp(LANGS_LINE.source, 'gm')) || []).length === 1);
  ck('作る言語は、文面と字数の上限を持っている言語だけ（空でない・重複なし）',
     [SR.LANGS.length > 0, SR.LANGS.filter((l) => !(l in SR.LIMITS) || !SR.systemPrompt(l)), new Set(SR.LANGS).size === SR.LANGS.length], [true, [], true]);
  ck('下の場面で使う形は「日本語だけ」', JA.LANGS, ['ja']);
  ck('モデルの名前は道具と同じ定数', [SR.MODEL, TOOLSIDE.MODEL], ['claude-opus-5', 'claude-opus-5']);
  const shared = ['MODEL', 'CATS', 'LIMITS', 'MAX_POINTS', 'MIN_REVIEWS', 'MIN_SUPPORT', 'LEGACY_OF', 'codesOf',
                  'buildInput', 'systemPrompt', 'userMessage', 'TOOL', 'requestBody', 'callModel', 'settle', 'payloadOf'];
  ck('道具（gen-review-summary.mjs）が出しているのは、関数の実体そのもの（写しではない）',
     shared.filter((k) => TOOLSIDE[k] !== SR[k]), []);
  const toolSrc = readFileSync(new URL('./gen-review-summary.mjs', import.meta.url), 'utf8');
  ok('道具の側に、文面や検品の書き写しが残っていない',
     !/function (systemPrompt|settle|settleSide|buildInput|requestBody|userMessage|callModel)\b/.test(toolSrc));
  /* ダッシュボードには1枚を貼る。ほかのファイルを読んでいたら、貼った先で動かない。 */
  ok('関数の1枚は、ほかのファイルを読まない（import / require が無い）',
     !/^\s*import\s/m.test(src) && !/\bfrom\s+['"]/.test(src) && !/\brequire\(/.test(src) && !/\bimport\(/.test(src));
  const body = SR.requestBody('ja', [{ i: 1, cats: { culture: 'x' } }]);
  ok('temperature を送らない／受け取り口を強制している',
     !('temperature' in body) && body.tool_choice.type === 'tool' && body.tool_choice.name === 'submit_summary' && body.model === SR.MODEL);

  /* 鍵が死んだときの判定は translate-review と同じ。両方の実体を呼んで突き合わせる。 */
  const diff = [];
  for (const s of [200, 400, 401, 402, 403, 404, 408, 413, 429, 500, 502, 503, 529]) {
    for (const t of ['', 'invalid_request_error', 'authentication_error', 'permission_error', 'rate_limit_error', 'overloaded_error', 'api_error']) {
      if (SR.isFatalKeyError(s, t) !== TR.isFatalKeyError(s, t)) diff.push(`${s} ${t}`);
    }
  }
  ck('鍵の問題かどうかの判定が、translate-review と1つも違わない', diff, []);
  ck('鍵の問題と数えるもの', [SR.isFatalKeyError(401, ''), SR.isFatalKeyError(403, ''), SR.isFatalKeyError(400, 'invalid_request_error'),
                              SR.isFatalKeyError(400, ''), SR.isFatalKeyError(429, 'rate_limit_error'), SR.isFatalKeyError(529, 'overloaded_error')],
     [true, true, true, false, false, false]);
});


// ════════════════════════════════════════════════════════════
// 2) 何を頼まれたかの読み方
// ════════════════════════════════════════════════════════════
await section(async () => {
  ck('空 → 全社を見て回る', SR.planOf({}), { mode: 'sweep', hints: [], dry: false });
  ck('読めないボディ → 全社を見て回る', [SR.planOf(null), SR.planOf('x'), SR.planOf([1])].map((p) => p.mode), ['sweep', 'sweep', 'sweep']);
  ck('INSERT → その会社', SR.planOf(event('INSERT', 'ana')), { mode: 'event', hints: ['ana'], dry: false });
  ck('DELETE（record が null）→ 消えた行の会社', SR.planOf(event('DELETE', 'jal')), { mode: 'event', hints: ['jal'], dry: false });
  ck('UPDATE で会社が付け替わった → 両方', SR.planOf(event('UPDATE', 'cathay-pacific', 'cathay')), { mode: 'event', hints: ['cathay-pacific', 'cathay'], dry: false });
  ck('UPDATE で会社が同じ → 1つ', SR.planOf(event('UPDATE', 'ana')).hints, ['ana']);
  ck('ほかの表の webhook → 何もしない', SR.planOf({ type: 'INSERT', table: 'pay_reports', record: { airline: 'ana' } }), { mode: 'skip', hints: [], dry: false, note: 'other_table' });
  ck('webhook の形なのに会社が読めない → 何もしない（見回りに化けない）',
     [SR.planOf({ type: 'INSERT', table: 'reviews_v2', record: {} }), SR.planOf({ type: 'INSERT', table: 'reviews_v2', record: { airline: 'A B; drop' } })].map((p) => [p.mode, p.note]),
     [['skip', 'no_airline'], ['skip', 'no_airline']]);
  ck('{"airline":…} → その1社', SR.planOf({ airline: ' ANA ' }), { mode: 'one', hints: ['ana'], dry: false });
  ck('{"airline": 変な字} → 何もしない', SR.planOf({ airline: '../x' }), { mode: 'skip', hints: [], dry: false, note: 'bad_airline' });
  ck('dry は true のときだけ', [SR.planOf({ dry: true }).dry, SR.planOf({ dry: 'true' }).dry, SR.planOf({ dry: 1 }).dry], [true, false, false]);
});


// ════════════════════════════════════════════════════════════
// 3) 入口の関所
// ════════════════════════════════════════════════════════════
await section(async () => {
  const w = world(); w.add('ana', 3);
  ck('POST 以外は 405', await call(w, null, { method: 'GET' }), { status: 405, body: { error: 'method not allowed' } });
  ck('合言葉が違えば 403', await call(w, {}, { env: { PV_WEBHOOK_SECRET: 'open-sesame' }, headers: { 'x-pv-webhook-secret': 'nope' } }),
     { status: 403, body: { error: 'forbidden' } });
  ck('合言葉が無ければ 403', (await call(w, {}, { env: { PV_WEBHOOK_SECRET: 'open-sesame' } })).status, 403);
  ck('鍵が無ければ 500（モデルを呼ぶ回）', await call(w, {}, { env: { ANTHROPIC_API_KEY: '' } }), { status: 500, body: { error: 'ANTHROPIC_API_KEY is not set' } });
  ck('DB の行き先が無ければ 500', await call(w, {}, { env: { SUPABASE_SERVICE_ROLE_KEY: '' } }), { status: 500, body: { error: 'supabase env missing' } });
  ck('ここまで、DB にもモデルにも1本も出ていない', w.http.length, 0);
  const r = await call(w, {}, { env: { PV_WEBHOOK_SECRET: 'open-sesame' }, headers: { 'x-pv-webhook-secret': 'open-sesame' } });
  ck('合言葉が合えば通る', [r.status, r.body.ok, r.body.mode, r.body.calls], [200, true, 'sweep', 1]);
  const j = await call(w, '{ これは JSON ではない', {});
  ck('壊れたボディは「全社を見て回る」として扱う（落ちない）', [j.status, j.body.mode, j.body.calls], [200, 'sweep', 0]);
});


// ════════════════════════════════════════════════════════════
// 4) 変わっていなければ、モデルを呼ばない
// ════════════════════════════════════════════════════════════
await section(async () => {
  const w = world();
  w.add('ana', 4); w.store('ana'); w.add('jal', 5); w.store('jal'); w.add('zipair', 2);
  ck('見回り：どこも変わっていない → 呼ばない', await call(w, {}), { status: 200, body: { ok: true, mode: 'sweep', checked: 3, calls: 0, deferred: 0, results: [] } });
  ck('知らせ：その会社が変わっていない → 呼ばない', await call(w, event('UPDATE', 'ana')), { status: 200, body: { ok: true, mode: 'event', checked: 1, calls: 0, deferred: 0, results: [] } });
  ck('3件に満たず、預かりも無い会社 → 何もしない', (await call(w, event('INSERT', 'zipair'))).body.results, []);
  ck('モデルへの通信は 0 本・番も取っていない', [w.modelCalls.length, rpcs(w, 'pv_review_summary_take').length, rpcs(w, 'pv_review_summary_set_auto').length], [0, 0, 0]);
  ck('ほかの表の webhook は、DB にも聞かない', [(await call(w, { type: 'INSERT', table: 'pay_reports', record: { airline: 'ana' } })).body, w.http.length],
     [{ ok: true, mode: 'skip', note: 'other_table', checked: 0, calls: 0, deferred: 0, results: [] }, 3]);
});


// ════════════════════════════════════════════════════════════
// 5) 変わっていたら、ちょうど1回呼ぶ／検品を通った点だけ預ける
// ════════════════════════════════════════════════════════════
await section(async () => {
  const w = world();
  w.add('starflyer', 3); w.store('starflyer'); w.add('starflyer', 1);          // 4件・古い要約あり
  w.model = () => modelOk({
    good: [
      { text: G_TEXT, cat: 'culture', reviews: [1, 2, 2, 3] },                                              // 残る（重複は数えず k=3）
      { text: 'ヨウヤク ステル 年収は1,800万円ほどという声がある。', cat: 'salary', reviews: [1, 2] },        // 数字
      { text: 'ヨウヤク ステル 訓練が手厚いと感じる人がいる。', cat: 'training', reviews: [4] },              // 1件だけ
      { text: 'ヨウヤク ステル 範囲の外の番号が支えている点である。', cat: 'ops', reviews: [9, 1] },          // 範囲外を除くと1件
      { text: 'ステル短い', cat: 'ops', reviews: [1, 2] },                                                   // 短い
    ],
    concern: [
      { text: C_TEXT, cat: 'wlb', reviews: [3, 4] },                                                         // 残る（k=2）
      { text: 'ヨウヤク ステル 経営への不満があるという声が複数ある。', cat: 'mgmt', reviews: [1, 2] },      // 分類の外
      { text: 'ヨウヤク ステル <b>太字</b>の入った点が書かれている。', cat: 'ops', reviews: [1, 2] },        // タグ
    ],
  });
  const r = await call(w, event('INSERT', 'starflyer'));
  ck('結果は saved（残した数・落とした数だけが返る）', r.body,
     { ok: true, mode: 'event', checked: 1, calls: 1, deferred: 0,
       results: [{ airline: 'starflyer', lang: 'ja', state: 'saved', n: 4, good: 1, concern: 1, dropped: 6 }] });
  ck('モデルを呼んだのは1回だけ', w.modelCalls.length, 1);

  const m = w.modelCalls[0];
  ck('呼び方（鍵・版・モデル・受け取り口の強制）',
     [m.headers['x-api-key'], m.headers['anthropic-version'], m.req.model, m.req.tool_choice, m.req.max_tokens, 'temperature' in m.req],
     ['sk-test-KEYMARK-anthropic', '2023-06-01', 'claude-opus-5', { type: 'tool', name: 'submit_summary' }, 4000, false]);
  ok('待ち時間の上限が付いている', typeof AbortSignal !== 'undefined' && m.signal instanceof AbortSignal);
  ck('文面は、道具が --call で送るものと同じ（system）', m.req.system, SR.systemPrompt('ja'));
  const sent = JSON.stringify(m.req);
  const user = m.req.messages[0].content;
  ok('モデルに渡るのは番号と本文だけ（会社コード・時刻・id・職位・機種は渡らない）',
     m.req.messages.length === 1 && user.startsWith('Reviews: 4\n\n[1]\nculture: ホンブン') && !sent.includes('starflyer') && !sent.includes('2026-05')
     && !sent.includes('ROWMARK') && !sent.includes('id-0') && !/proof_hash|created_at|orig_lang|position|fleet/.test(sent), user.slice(0, 80));

  const sets = rpcs(w, 'pv_review_summary_set_auto');
  ck('預けたのは、検品を通った2点だけ（番号は付けない・k は数え直した数）', sets.map((s) => s.p),
     [{ airline: 'starflyer', lang: 'ja', basis: w.sig('starflyer'), n: 4,
        good: [{ text: G_TEXT, cat: 'culture', k: 3 }], concern: [{ text: C_TEXT, cat: 'wlb', k: 2 }] }]);
  ck('DB に預かった形', [w.stored.get('starflyer|ja').n, w.stored.get('starflyer|ja').good.length, w.need('starflyer', 'ja')], [4, 1, 'fresh']);

  /* DB の呼び方：サーバの鍵で、4つの関数だけ。運営の道・表の直読みは使わない。 */
  const db = w.http.filter((h) => h.url.startsWith(SB));
  ck('呼ぶ DB の関数は4つのうちだけ（運営の道 pv_review_summary_set / 表の直読みは使わない）',
     [...new Set(db.map((h) => h.url.slice(SB.length)))],
     ['/rest/v1/rpc/pv_review_summary_due', '/rest/v1/rpc/pv_review_summary_take', '/rest/v1/rpc/pv_review_summary_set_auto']);
  ok('どの呼び出しもサーバの鍵・POST・{p:…} の形',
     db.every((h) => h.method === 'POST' && h.headers.apikey === 'service-KEYMARK-role' && h.headers.Authorization === 'Bearer service-KEYMARK-role'
       && JSON.stringify(Object.keys(JSON.parse(h.body))) === '["p"]'));
  ck('DB への聞き方（言語は LANGS・会社は知らせのコード）', rpcs(w, 'pv_review_summary_due').map((h) => h.p), [{ langs: ['ja'], airline: 'starflyer' }]);

  /* 費用を測る1行。 */
  const line = w.logs.map((l) => JSON.parse(l.replace(/^summarize-reviews /, ''))).find((x) => x.step === 'model');
  ck('費用を測る1行がログに出る（数だけ）', line, { airline: 'starflyer', lang: 'ja', step: 'model', why: 'stale', n: 4, ok: true, in_tok: 812, out_tok: 143, ms: 0 });

  const again = await call(w, event('UPDATE', 'starflyer'));     // 直後に来る「訳が入った」の UPDATE
  ck('同じ集合への2回目の知らせでは呼ばない（払うのは1回）', [again.body.calls, again.body.results, w.modelCalls.length], [0, [], 1]);

  /* 要約がまだ無い会社（missing）も同じ道。 */
  w.add('peach', 3);
  const p = await call(w, { airline: 'peach' });
  ck('まだ無い会社 → 1回呼んで預ける', [p.body.mode, p.body.calls, p.body.results[0].state, w.modelCalls.length], ['one', 1, 'saved', 2]);

  /* 古い短いコードで知らせが来ても、DB が引き直したコードで進める。 */
  w.add('cathay-pacific', 3);
  const c = await call(w, event('INSERT', 'cathay'));
  ck('古い短いコードの知らせ → いまの会社コードで預ける', [rpcs(w, 'pv_review_summary_due').at(-1).p.airline, c.body.results[0].airline, c.body.results[0].state],
     ['cathay', 'cathay-pacific', 'saved']);
});


// ════════════════════════════════════════════════════════════
// 6) 3件を切ったら消す／何も残らなければ空で預ける
// ════════════════════════════════════════════════════════════
await section(async () => {
  const w = world();
  w.add('ana', 3); w.store('ana'); w.drop('ana', 1);               // 2件に減った・要約は預かったまま
  const r = await call(w, event('DELETE', 'ana'));
  ck('3件を切った → cleared', r.body, { ok: true, mode: 'event', checked: 1, calls: 0, deferred: 0, results: [{ airline: 'ana', lang: 'ja', state: 'cleared', n: 2 }] });
  ck('モデルは呼ばない・空で預けて消す', [w.modelCalls.length, rpcs(w, 'pv_review_summary_set_auto').map((s) => s.p), w.stored.has('ana|ja')],
     [0, [{ airline: 'ana', lang: 'ja', basis: w.sig('ana'), good: [], concern: [] }], false]);
  ck('消したあとの知らせでは何もしない', (await call(w, event('DELETE', 'ana'))).body.results, []);

  /* 余力が尽きていても、消すだけの仕事は見送らない（モデルを呼ばないので）。 */
  const w2 = world();
  for (const a of ['a1', 'a2', 'a3', 'a4', 'a5']) { w2.add(a, 3); }
  w2.add('zz-gone', 3); w2.store('zz-gone'); w2.drop('zz-gone', 2);
  const r2 = await call(w2, {});
  ck('上限まで呼んだ回でも、消す仕事は済ませる', [r2.body.calls, r2.body.deferred, r2.body.results.at(-1)], [4, 1, { airline: 'zz-gone', lang: 'ja', state: 'cleared', n: 1 }]);

  /* 検品を1点も通らなかった。 */
  const w3 = world();
  w3.add('jal', 3); w3.store('jal'); w3.add('jal', 1);
  w3.model = () => modelOk({ good: [{ text: 'ヨウヤク ステル 1人だけが言っている点である。', cat: 'culture', reviews: [2] }], concern: [] });
  const r3 = await call(w3, event('INSERT', 'jal'));
  ck('1点も残らない → empty（古い要約は消える）', [r3.body.results, w3.stored.has('jal|ja')], [[{ airline: 'jal', lang: 'ja', state: 'empty', n: 4, dropped: 1 }], false]);
  ck('空で預けている（n つき）', rpcs(w3, 'pv_review_summary_set_auto').map((s) => [s.p.n, s.p.good, s.p.concern]), [[4, [], []]]);
  const r3b = await call(w3, {});
  ck('同じ集合には、もう払わない（空だったことを DB が覚えている）', [r3b.body.calls, w3.modelCalls.length], [0, 1]);
  const r3c = await call(w3, {}, { model: () => modelOk({ good: 'ステル 配列でない', concern: null }) });
  w3.add('jal', 1);
  const r3d = await call(w3, {}, { model: () => modelOk({ good: 'ステル 配列でない', concern: null }) });
  ck('受け取り口の中身が配列でなくても落ちない（empty）', [r3c.body.calls, r3d.body.results[0].state], [0, 'empty']);
});


// ════════════════════════════════════════════════════════════
// 7) 鍵が死んだ → 1日1通だけ知らせて、その回はやめる
// ════════════════════════════════════════════════════════════
await section(async () => {
  const cases = [[401, 'authentication_error'], [403, 'permission_error'], [400, 'invalid_request_error']];
  for (let i = 0; i < cases.length; i++) {
    const [status, type] = cases[i];
    const w = world(); w.t = DAY0 + i * 86_400_000;                 // 1日1通なので、日を変えて試す
    for (const a of ['ana', 'jal', 'peach']) w.add(a, 3);
    w.model = () => modelErr(status, type);
    const r = await call(w, {});
    ck(`${status} ${type} → key_error・残りは見送る`, r.body,
       { ok: true, mode: 'sweep', checked: 3, calls: 1, deferred: 2,
         results: [{ airline: 'ana', lang: 'ja', state: 'key_error', why: `http_${status}` },
                   { airline: 'jal', lang: 'ja', state: 'deferred' }, { airline: 'peach', lang: 'ja', state: 'deferred' }] });
    ck(`${status}：モデルを呼ぶのは最初の1回だけ・見送った会社の番は取らない`, [w.modelCalls.length, rpcs(w, 'pv_review_summary_take').length], [1, 1]);
    ck(`${status}：番を返す（失敗の回数に数えない）`, [rpcs(w, 'pv_review_summary_done').map((d) => d.p.state), w.runs.size, w.need('ana', 'ja')], [['released'], 0, 'missing']);
    const day = new Date(w.t).toISOString().slice(0, 10);
    ck(`${status}：運営に1通（同じ日の2通目を止める鍵つき）`,
       w.mails.map((m) => [m.headers.Authorization, m.headers['Idempotency-Key'], m.body.to, m.body.from, /自動更新が止まっています/.test(m.body.subject)]),
       [['Bearer re-KEYMARK-send', `summarize-key-dead:${day}`, ['info@pilot-value.com'], 'PILOT VALUE <noreply@pilot-value.com>', true]]);
    ok(`${status}：知らせの文に、口コミも向こうの返事もキーも入らない`,
       w.mails.length === 1 && !/ホンブン|ヨウヤク|ERRBODYMARK|KEYMARK/.test(JSON.stringify(w.mails[0].body)) && w.mails[0].body.text.includes(String(status)));

    if (i === cases.length - 1) {
      const r2 = await call(w, {});
      ck('同じ日にもう一度落ちても、2通目は出さない（やめるのは同じ）', [r2.body.results[0].state, w.mails.length, w.modelCalls.length], ['key_error', 1, 2]);
      w.t += 86_400_000;
      await call(w, {}, { env: { ADMIN_EMAIL: 'ops@example.test', FROM_EMAIL: 'X <x@example.test>' } });
      ck('日が変われば、また1通（宛先と差出人は secret で替えられる）', [w.mails.length, w.mails[1].body.to, w.mails[1].body.from], [2, ['ops@example.test'], 'X <x@example.test>']);
      w.t += 86_400_000;
      const r4 = await call(w, {}, { env: { RESEND_API_KEY: '' } });
      ck('メールの鍵が無くても、やめ方は同じ（知らせは出せない）', [r4.body.results[0].state, w.mails.length], ['key_error', 2]);
      w.t += 86_400_000;
      const r5 = await call(w, {}, { mailFails: true });
      ck('メールが落ちても、返事は変わらない', [r5.status, r5.body.results[0].state, r5.body.deferred], [200, 'key_error', 2]);
    }
  }
});


// ════════════════════════════════════════════════════════════
// 8) 鍵のせいではない失敗 → 失敗として数える・知らせない・次の会社へ進む
// ════════════════════════════════════════════════════════════
await section(async () => {
  const timeout = () => { const e = new Error('ERRBODYMARK The operation timed out'); e.name = 'TimeoutError'; throw e; };
  const kinds = [
    ['429', () => modelErr(429, 'rate_limit_error'), 'http_429', [0, 0]],
    ['529', () => modelErr(529, 'overloaded_error'), 'http_529', [0, 0]],
    ['502 の HTML', () => modelErr(502, null), 'http_502', [0, 0]],
    ['400 でも鍵の種類ではない', () => modelErr(400, 'ERRBODYMARK other'), 'http_400', [0, 0]],
    ['途中で切れた', () => modelOk(GOOD_REPLY, { input_tokens: 900, output_tokens: 4000 }, 'max_tokens'), 'truncated', [900, 4000]],
    ['断られた', () => modelOk(GOOD_REPLY, { input_tokens: 900, output_tokens: 12 }, 'refusal'), 'refusal', [900, 12]],
    ['受け取り口に入っていない', () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'ERRBODYMARK ヨウヤク' }], stop_reason: 'end_turn', usage: { input_tokens: 7, output_tokens: 3 } }) }), 'no_tool', [7, 3]],
    ['通信が落ちた', () => { throw new Error('ERRBODYMARK ECONNRESET'); }, 'network', [0, 0]],
    ['時間切れ', timeout, 'timeout', [0, 0]],
  ];
  for (const [label, model, why, tok] of kinds) {
    const w = world(); w.add('ana', 3); w.add('jal', 3);
    let nth = 0;
    w.model = () => (++nth === 1 ? model() : modelOk(GOOD_REPLY));
    const r = await call(w, {});
    ck(`${label} → model_failed（${why}）・次の会社は作る`, r.body.results,
       [{ airline: 'ana', lang: 'ja', state: 'model_failed', why }, { airline: 'jal', lang: 'ja', state: 'saved', n: 3, good: 1, concern: 1, dropped: 0 }]);
    ck(`${label}：失敗として控える・知らせは出さない・何も預けない`,
       [rpcs(w, 'pv_review_summary_done').map((d) => [d.p.airline, d.p.basis === w.sig('ana'), d.p.state]), w.mails.length, w.stored.has('ana|ja'), w.runs.get('ana|ja').state],
       [[['ana', true, 'failed']], 0, false, 'failed']);
    const line = w.logs.map((l) => JSON.parse(l.replace(/^summarize-reviews /, ''))).find((x) => x.step === 'model' && x.airline === 'ana');
    ck(`${label}：落ちた回も、費用の1行は出る`, [line.ok, line.in_tok, line.out_tok], [false, ...tok]);
  }
});


// ════════════════════════════════════════════════════════════
// 9) 作っているあいだに口コミが動いた → 古い集合の要約は預からない（正常）
// ════════════════════════════════════════════════════════════
await section(async () => {
  const w = world(); w.add('ana', 3); w.store('ana'); w.add('ana', 1);
  const old = JSON.stringify(w.stored.get('ana|ja'));
  w.model = (req, ww, nth) => { if (nth === 1) ww.add('ana', 1); return modelOk(GOOD_REPLY); };   // 1回目の最中に1件増える
  const r = await call(w, event('INSERT', 'ana'));
  ck('superseded は失敗ではない／その場でもう1回だけ、新しい集合で作り直す', r.body,
     { ok: true, mode: 'event', checked: 1, calls: 2, deferred: 0,
       results: [{ airline: 'ana', lang: 'ja', state: 'superseded', n: 4 }, { airline: 'ana', lang: 'ja', state: 'saved', n: 5, good: 1, concern: 1, dropped: 0 }] });
  ck('預かったのは新しい集合（5件）の要約だけ', [w.stored.get('ana|ja').n, w.stored.get('ana|ja').sig === w.sig('ana'), w.modelCalls.length], [5, true, 2]);
  ck('2回目に渡したのは5件ぶん', w.modelCalls[1].req.messages[0].content.startsWith('Reviews: 5\n'), true);
  ck('失敗として控えていない・知らせも出していない', [rpcs(w, 'pv_review_summary_done').length, w.mails.length], [0, 0]);

  /* 2回続けて動いたら、そこでやめる（際限なく払わない）。古い要約は古いまま残る。 */
  const w2 = world(); w2.add('jal', 3); w2.store('jal'); w2.add('jal', 1);
  const old2 = JSON.stringify(w2.stored.get('jal|ja'));
  w2.model = (req, ww) => { ww.add('jal', 1); return modelOk(GOOD_REPLY); };
  const r2 = await call(w2, event('INSERT', 'jal'));
  ck('2回続けて動いた → 2回でやめる', [r2.body.ok, r2.body.calls, r2.body.results.map((x) => x.state), w2.modelCalls.length], [true, 2, ['superseded', 'superseded'], 2]);
  ck('古い集合の要約で上書きしていない（前のまま）・番も残していない', [JSON.stringify(w2.stored.get('jal|ja')) === old2, w2.runs.size, w2.need('jal', 'ja')], [true, 0, 'stale']);
  ok('（1つ目の例でも、上書きされたのは新しい集合の要約）', old !== JSON.stringify(w.stored.get('ana|ja')));
  w2.model = null;
  ck('次の知らせ（か見回り）で追いつく', [(await call(w2, {})).body.results.map((x) => x.state), w2.need('jal', 'ja')], [['saved'], 'fresh']);

  /* 消す仕事の最中に増えた。 */
  const w3 = world(); w3.add('peach', 3); w3.store('peach'); w3.drop('peach', 1);
  let bumped = false;
  const r3 = await call(w3, event('DELETE', 'peach'), {
    rpc: (name, p, ww) => { if (name === 'pv_review_summary_set_auto' && !bumped) { bumped = true; ww.add('peach', 2); } },
  });
  ck('消そうとした瞬間に増えた → 消さずに、新しい集合で作り直す', [r3.body.results.map((x) => x.state), r3.body.calls, w3.stored.get('peach|ja').n], [['superseded', 'saved'], 1, 4]);
});


// ════════════════════════════════════════════════════════════
// 10) 同じ会社の知らせが重なった → 2人目は払わない
// ════════════════════════════════════════════════════════════
await section(async () => {
  const w = world(); w.add('ana', 3); w.store('ana'); w.add('ana', 1);
  let release; const gate = new Promise((res) => { release = res; });
  const first = call(w, event('INSERT', 'ana'), { tag: 'A', model: async () => { await gate; return modelOk(GOOD_REPLY); } });
  await until(() => w.modelCalls.length === 1, '1人目がモデルを呼ぶ');

  const second = await call(w, event('UPDATE', 'ana'), { tag: 'B' });              // 1人目が作っている最中に来た
  ck('2人目（あとから聞いた）：DB が「いま作っている」と答える → 何もしない', second.body, { ok: true, mode: 'event', checked: 1, calls: 0, deferred: 0, results: [] });
  /* 聞いたときはまだ番が無く、取りに行ったら取られていた、の順。 */
  const third = await call(w, event('UPDATE', 'ana'), { tag: 'C', rpc: (name) => (name === 'pv_review_summary_due' ? { raw: { ok: true, checked: 1, due: [{ airline: 'ana', lang: 'ja', why: 'stale' }] } } : undefined) });
  ck('3人目（聞いたあとで取られた）：busy で帰る', third.body, { ok: true, mode: 'event', checked: 1, calls: 0, deferred: 0, results: [{ airline: 'ana', lang: 'ja', state: 'busy' }] });
  ck('このあいだ、モデルへ出たのは1人目の1本だけ・2人目3人目に材料は渡っていない',
     [w.modelCalls.map((m) => m.tag), rpcs(w, 'pv_review_summary_take', 'C').length, w.http.filter((h) => h.tag !== 'A' && h.rpc === 'pv_review_summary_set_auto').length], [['A'], 1, 0]);
  release();
  ck('1人目はそのまま預けて終わる', (await first).body.results, [{ airline: 'ana', lang: 'ja', state: 'saved', n: 4, good: 1, concern: 1, dropped: 0 }]);
  ck('払ったのは全部で1回', w.modelCalls.length, 1);
});


// ════════════════════════════════════════════════════════════
// 11) 1回の呼び出しで使う量に上限がある
// ════════════════════════════════════════════════════════════
await section(async () => {
  const six = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'];
  const w = world(); for (const a of six) w.add(a, 3);
  const r = await call(w, {});
  ck('見回り1回でモデルを呼ぶのは4回まで・残りは見送る', [r.body.calls, r.body.deferred, r.body.results.map((x) => x.state)],
     [4, 2, ['saved', 'saved', 'saved', 'saved', 'deferred', 'deferred']]);
  ck('見送った会社の番は取っていない（次の回がすぐ作れる）', [rpcs(w, 'pv_review_summary_take').length, w.runs.has('a5|ja'), w.need('a5', 'ja')], [4, false, 'missing']);
  const r2 = await call(w, {});
  ck('もう一度流すと残りを作る → 見送りが 0 になる', [r2.body.calls, r2.body.deferred, six.map((a) => w.need(a, 'ja')).every((x) => x === 'fresh')], [2, 0, true]);

  const w2 = world(); for (const a of six) w2.add(a, 3);
  w2.model = (req, ww) => { ww.t += 31_000; return modelOk(GOOD_REPLY); };         // モデルが遅い
  const r3 = await call(w2, {});
  ck('30秒を過ぎたら、新しくは呼び始めない', [r3.body.calls, r3.body.deferred], [1, 5]);
  const ms = w2.logs.map((l) => JSON.parse(l.replace(/^summarize-reviews /, ''))).find((x) => x.step === 'model').ms;
  ck('かかった時間がログに出る', ms, 31_000);

  /* 番を取ったあとで余力が切れた。 */
  const w3 = world(); w3.add('ana', 3);
  const r4 = await call(w3, {}, { rpc: (name, p, ww) => { if (name === 'pv_review_summary_take') ww.t += 31_000; } });
  ck('番を取ったあとで時間が切れた → 番を返して見送る（払わない・失敗に数えない）',
     [r4.body.results, r4.body.deferred, w3.modelCalls.length, rpcs(w3, 'pv_review_summary_done').map((d) => d.p.state), w3.runs.size],
     [[{ airline: 'ana', lang: 'ja', state: 'deferred' }], 1, 0, ['released'], 0]);
});


// ════════════════════════════════════════════════════════════
// 12) DB が変な返事をした
// ════════════════════════════════════════════════════════════
await section(async () => {
  const mk = () => { const w = world(); w.add('ana', 3); w.store('ana'); w.add('ana', 1); return w; };
  const on = (target, over) => (name) => (name === target ? over : undefined);

  let w = mk();
  ck('SQL を貼る前（関数が無い）→ db_http_404', (await call(w, {}, { rpc: on('pv_review_summary_due', { http: 404 }) })).body, { ok: false, mode: 'sweep', step: 'due', error: 'db_http_404' });
  ck('DB に届かない → db_unreachable', (await call(w, {}, { rpc: on('pv_review_summary_due', { throws: true }) })).body.error, 'db_unreachable');
  ck('DB の返事が JSON でない → db_bad_reply', (await call(w, {}, { rpc: on('pv_review_summary_due', { notJson: true }) })).body.error, 'db_bad_reply');
  ck('DB の返事が形違い（配列・null）→ 進まない', [(await call(w, {}, { rpc: on('pv_review_summary_due', { raw: [1] }) })).body.ok, (await call(w, {}, { rpc: on('pv_review_summary_due', { raw: null }) })).body.ok,
                                                    (await call(w, {}, { rpc: on('pv_review_summary_due', { raw: { ok: true, due: 'ホンブン' } }) })).body.ok], [false, false, false]);
  ck('DB が断った語は、決まった形のときだけ写す', (await call(w, {}, { rpc: on('pv_review_summary_due', { raw: { ok: false, error: 'DBBODYMARK <長い文>' } }) })).body.error, 'unknown');
  ck('ここまでモデルは呼んでいない', w.modelCalls.length, 0);

  ck('番を取る所で落ちた → error（呼ばない）', [(await call(w, {}, { rpc: on('pv_review_summary_take', { http: 500 }) })).body.results, w.modelCalls.length],
     [[{ airline: 'ana', lang: 'ja', state: 'error', why: 'db_http_500' }], 0]);
  ck('DB が知らない語を返した → そのまま進まない', (await call(w, {}, { rpc: on('pv_review_summary_take', { raw: { ok: true, state: 'ホンブン 変な語' } }) })).body.results[0].state, 'unknown');

  /* DB の数え方と、こちらの数え方が食い違った。 */
  w = mk();
  const r = await call(w, {}, { rpc: (name, p, ww) => (name === 'pv_review_summary_take' ? { raw: { ...ww.rpc.pv_review_summary_take(p), n: 9 } } : undefined) });
  ck('件数が食い違った → 払わずにやめて、番を返す', [r.body.results, w.modelCalls.length, rpcs(w, 'pv_review_summary_done').map((d) => d.p.state), w.runs.size],
     [[{ airline: 'ana', lang: 'ja', state: 'error', why: 'count_mismatch', n: 9 }], 0, ['released'], 0]);

  /* モデルは答えたが、預ける所で落ちた・断られた。 */
  w = mk();
  ck('預ける所で DB が落ちた → error', (await call(w, {}, { rpc: on('pv_review_summary_set_auto', { http: 503 }) })).body.results, [{ airline: 'ana', lang: 'ja', state: 'error', why: 'db_http_503', n: 4 }]);
  w = mk();
  ck('DB の検査が断った → rejected（語だけ）', (await call(w, {}, { rpc: on('pv_review_summary_set_auto', { raw: { ok: false, error: 'weak_point' } }) })).body.results, [{ airline: 'ana', lang: 'ja', state: 'rejected', why: 'weak_point', n: 4 }]);

  /* DB が頼んでいない言語・変なコードを返してきた。 */
  w = mk();
  const odd = await call(w, {}, { rpc: on('pv_review_summary_due', { raw: { ok: true, checked: 2, due: [
    { airline: 'ana', lang: 'en', why: 'missing' }, { airline: 'A B', lang: 'ja', why: 'stale' }, { airline: 'ana', lang: 'ja', why: 'stale' }, { airline: 'ana', lang: 'ja', why: 'stale' }] } }) });
  ck('頼んでいない言語・変なコード・重複は捨てる', [odd.body.calls, odd.body.results.map((x) => [x.airline, x.lang, x.state])], [1, [['ana', 'ja', 'saved']]]);

  /* 途中で例外が出ても、返すのは名前だけ。 */
  w = mk();
  const boom = await call(w, {}, { rpc: (name) => { if (name === 'pv_review_summary_take') return { raw: { ok: true, state: 'go', n: 3, basis: 'x', rows: [{ airline: 'ana', culture_comment: 'ホンブン', get wlb_comment() { throw new RangeError('ホンブン DBBODYMARK'); } }] } }; } });
  ck('中で例外が出ても 200 と名前だけ', [boom.status, boom.body], [200, { ok: false, mode: 'sweep', step: 'internal', error: 'rangeerror' }]);
});


// ════════════════════════════════════════════════════════════
// 13) 見るだけ（dry）── お金を使わずに確かめる道
// ════════════════════════════════════════════════════════════
await section(async () => {
  const w = world(); w.add('ana', 3); w.add('jal', 3); w.store('jal'); w.add('peach', 3); w.store('peach'); w.drop('peach', 1);
  const r = await call(w, { dry: true });
  ck('どこを作り直すかだけ返す', r.body, { ok: true, mode: 'dry', checked: 3, due: [{ airline: 'ana', lang: 'ja', why: 'missing' }, { airline: 'peach', lang: 'ja', why: 'too_few' }], key_set: true });
  ck('鍵が無くても答える（入っているかを返す）', (await call(w, { dry: true, airline: 'ana' }, { env: { ANTHROPIC_API_KEY: '' } })).body,
     { ok: true, mode: 'dry', checked: 1, due: [{ airline: 'ana', lang: 'ja', why: 'missing' }], key_set: false });
  ck('webhook の形 ＋ dry でも、見るだけ', (await call(w, { ...event('INSERT', 'ana'), dry: true }, { waitUntil: () => {} })).body.mode, 'dry');
  ck('番を取らない・モデルを呼ばない・何も消さない', [rpcs(w, 'pv_review_summary_take').length, rpcs(w, 'pv_review_summary_set_auto').length, w.modelCalls.length, w.stored.has('peach|ja')], [0, 0, 0, true]);
});


// ════════════════════════════════════════════════════════════
// 14) webhook には先に返事をして、仕事は後ろで続ける
// ════════════════════════════════════════════════════════════
await section(async () => {
  const w = world(); w.add('ana', 3); w.store('ana'); w.add('ana', 1);
  let release; const gate = new Promise((res) => { release = res; });
  const kept = [];
  /* モデルの返事を止めてある。返事を待ってしまう作りだと、ここで帰ってこない
     ── なので「モデルを呼ぶ所まで進んだのに、まだ返事が無い」を見てから手を離す。 */
  let r = null;
  const answered = call(w, event('INSERT', 'ana'), { waitUntil: (p) => { kept.push(p); }, model: async () => { await gate; return modelOk(GOOD_REPLY); } })
    .then((v) => { r = v; });
  await until(() => w.modelCalls.length === 1, '後ろの仕事がモデルを呼ぶ所まで進む');
  for (let i = 0; i < 20 && !r; i++) await tick();
  ck('知らせには、モデルを待たずに「受け取った」とだけ返す', r, { status: 200, body: { ok: true, mode: 'event', accepted: true } });
  ck('仕事は1つだけ預けてある・まだ終わっていない', [kept.length, w.stored.get('ana|ja').n], [1, 3]);
  release();
  await answered;
  const done = await kept[0];
  ck('後ろで最後まで走る', [done.results, w.stored.get('ana|ja').n], [[{ airline: 'ana', lang: 'ja', state: 'saved', n: 4, good: 1, concern: 1, dropped: 0 }], 4]);
  ok('結果はログで読める', w.logs.some((l) => l === 'summarize-reviews {"airline":"ana","lang":"ja","state":"saved","n":4,"good":1,"concern":1,"dropped":0}'), w.logs.join(' / '));

  w.add('ana', 1);
  const kept2 = [];
  const s = await call(w, {}, { waitUntil: (p) => { kept2.push(p); } });
  ck('手で呼んだとき（見回り）は、終わるまで待って結果を返す', [s.body.mode, s.body.results.map((x) => x.state), kept2.length], ['sweep', ['saved'], 1]);
  w.add('ana', 1);
  const o = await call(w, { airline: 'ana' }, { waitUntil: () => {} });
  ck('手で呼んだとき（1社）も同じ', [o.body.mode, o.body.results.map((x) => x.state)], ['one', ['saved']]);
  w.add('ana', 1);
  const t = await call(w, event('INSERT', 'ana'), { waitUntil: () => { throw new Error('no such thing'); } });
  ck('預ける口が壊れていたら、待って結果を返す（仕事は落とさない）', [t.body.mode, t.body.results.map((x) => x.state)], ['event', ['saved']]);
  w.add('ana', 1);
  const u = await call(w, event('INSERT', 'ana'));
  ck('預ける口が無い環境でも、待って結果を返す', [u.body.mode, u.body.results.map((x) => x.state), 'accepted' in u.body], ['event', ['saved'], false]);

  /* 後ろの仕事が落ちても、投げっぱなしにしない（名前だけをログに残して終わる）。 */
  const w2 = world(); w2.add('jal', 3);
  const kept3 = [];
  const v = await call(w2, event('INSERT', 'jal'), { waitUntil: (p) => { kept3.push(p); },
    rpc: (name) => { if (name === 'pv_review_summary_take') return { raw: { ok: true, state: 'go', n: 3, basis: 'x', rows: [{ airline: 'jal', get culture_comment() { throw new TypeError('ホンブン'); } }] } }; } });
  ck('後ろの仕事が落ちても、返事は同じ・例外は外へ漏れない', [v.body, await kept3[0]], [{ ok: true, mode: 'event', accepted: true }, { ok: false, mode: 'event', step: 'internal', error: 'typeerror' }]);
});


// ════════════════════════════════════════════════════════════
// 15) 本番の入口（Deno.serve・EdgeRuntime.waitUntil・console.log）の配線
// ════════════════════════════════════════════════════════════
await section(async () => {
  const w = world(); w.add('ana', 3);
  const saved = { fetch: globalThis.fetch, log: console.log };
  let served = null; const kept = []; let early = null; let later = null; let got405 = null;
  try {
    globalThis.Deno = { env: { get: (k) => w.env[k] }, serve: (fn) => { served = fn; } };
    globalThis.EdgeRuntime = { waitUntil: (p) => { kept.push(p); } };
    globalThis.fetch = depsOf(w).fetch;                     // ★本物の fetch を外す（外へ1本も出さない）
    console.log = (line) => { w.logs.push(String(line)); };
    await build(['ja'], 'deno');
    got405 = (await served(new Request(AT, { method: 'GET' }))).status;
    const res = await served(new Request(AT, { method: 'POST', body: JSON.stringify(event('INSERT', 'ana')) }));
    const text = await res.text(); w.replies.push(text); early = JSON.parse(text);
    later = await kept[0];
  } finally {
    globalThis.fetch = saved.fetch; console.log = saved.log;
    delete globalThis.Deno; delete globalThis.EdgeRuntime;
  }
  ck('Deno の上では入口を登録する', [typeof served, got405], ['function', 405]);
  ck('本番の配線でも、知らせには先に返事をする', early, { ok: true, mode: 'event', accepted: true });
  ck('後ろの仕事が最後まで走り、ログは console.log に出る', [kept.length, later && later.results.map((x) => x.state), w.stored.has('ana|ja'), w.logs.filter((l) => l.startsWith('summarize-reviews ')).length >= 3],
     [1, ['saved'], true, true]);
});


// ════════════════════════════════════════════════════════════
// 16) 英語を足したとき（LANGS に 'en' を1語）── その形を実際に動かす
// ════════════════════════════════════════════════════════════
await section(async () => {
  const BOTH = await build(['ja', 'en'], 'both');
  ck('1語足した形', BOTH.LANGS, ['ja', 'en']);
  const EN_G = 'YOUYAKU Several reviews describe an open atmosphere among crew.';
  const EN_C = 'YOUYAKU Some reviews mention roster changes arriving at short notice.';
  const w = world(); w.add('ana', 3);
  for (const r of w.rows.get('ana')) r.translations = { en: { culture: 'HONBUN-EN the atmosphere is open', wlb: 'HONBUN-EN rosters change late' } };
  w.rows.get('ana')[2].translations = null;                       // 訳がまだ入っていない1件
  w.model = (req) => (req.system === SR.systemPrompt('en')
    ? modelOk({ good: [{ text: EN_G, cat: 'culture', reviews: [1, 2] }], concern: [{ text: EN_C, cat: 'wlb', reviews: [1, 2] }] })
    : modelOk(GOOD_REPLY));
  const r = await call(w, event('INSERT', 'ana'), {}, BOTH.handle);
  ck('日本語と英語を1回ずつ作る', r.body,
     { ok: true, mode: 'event', checked: 2, calls: 2, deferred: 0,
       results: [{ airline: 'ana', lang: 'ja', state: 'saved', n: 3, good: 1, concern: 1, dropped: 0 },
                 { airline: 'ana', lang: 'en', state: 'saved', n: 3, good: 1, concern: 1, dropped: 0 }] });
  ck('DB には両方の言語を聞く', rpcs(w, 'pv_review_summary_due').map((h) => h.p), [{ langs: ['ja', 'en'], airline: 'ana' }]);
  ck('文面は言語ごと', w.modelCalls.map((m) => m.req.system), [SR.systemPrompt('ja'), SR.systemPrompt('en')]);
  const en = w.modelCalls[1].req.messages[0].content;
  ok('英語の回には訳を渡す（訳がまだ無い1件だけは原文のまま）',
     en.includes('[1]\nculture: HONBUN-EN the atmosphere is open') && en.includes('[3]\nculture: ホンブン') && !en.includes('[1]\nculture: ホンブン'), en.slice(0, 120));
  ck('日本語の回には原文を渡す', w.modelCalls[0].req.messages[0].content.includes('HONBUN-EN'), false);
  ck('言語ごとに預かる（英語の字数の上限で検品している）',
     [w.stored.get('ana|ja').good[0].text, w.stored.get('ana|en').good[0].text, w.stored.get('ana|en').concern[0].k], [G_TEXT, EN_G, 2]);
  ck('次の知らせでは、どちらの言語も呼ばない', [(await call(w, event('UPDATE', 'ana'), {}, BOTH.handle)).body.calls, w.modelCalls.length], [0, 2]);
});


// ════════════════════════════════════════════════════════════
// 17) ログにも返り値にも、文とキーが1文字も出ない
// ════════════════════════════════════════════════════════════
await section(async () => {
  const MARK = /ホンブン|ヨウヤク|ステル|HONBUN|YOUYAKU|ERRBODYMARK|DBBODYMARK|ROWMARK|KEYMARK|Bearer|sk-test|service-|re-KEY/;
  const logs = worlds.flatMap((w) => w.logs);
  const replies = worlds.flatMap((w) => w.replies);
  ok('（材料：ログと返り値が十分に集まっている）', logs.length > 100 && replies.length > 50, `${logs.length} / ${replies.length}`);
  ck('ログに、口コミ・要約・落とした点・向こうの返事・キーが出ない', logs.filter((l) => MARK.test(l)), []);
  ck('返り値に、口コミ・要約・落とした点・向こうの返事・キーが出ない', replies.filter((l) => MARK.test(l)), []);

  /* 形でも縛る ── 出てよい字は、決まった鍵と、会社コード／状態の語／数／真偽だけ。 */
  const KEYS = new Set(['ok', 'mode', 'note', 'checked', 'calls', 'deferred', 'results', 'due', 'key_set', 'accepted', 'step', 'error', 'stop',
                        'airline', 'lang', 'state', 'why', 'n', 'good', 'concern', 'dropped', 'in_tok', 'out_tok', 'ms']);
  const FIXED = new Set(['method not allowed', 'forbidden', 'ANTHROPIC_API_KEY is not set', 'supabase env missing']);
  const bad = [];
  const walk = (v, where) => {
    if (Array.isArray(v)) return v.forEach((x) => walk(x, where));
    if (v && typeof v === 'object') return Object.entries(v).forEach(([k, x]) => { if (!KEYS.has(k)) bad.push(`${where}: 鍵 ${k}`); walk(x, where); });
    if (typeof v === 'string' && !/^[a-z0-9_-]{1,60}$/.test(v) && !FIXED.has(v)) bad.push(`${where}: 字 ${v.slice(0, 40)}`);
  };
  for (const l of logs) {
    if (!l.startsWith('summarize-reviews ')) { bad.push('頭が違う: ' + l.slice(0, 40)); continue; }
    try { walk(JSON.parse(l.slice('summarize-reviews '.length)), 'log'); } catch { bad.push('JSON でない: ' + l.slice(0, 40)); }
  }
  for (const r of replies) walk(JSON.parse(r), 'reply');
  ck('ログと返り値に出るのは、決まった鍵・会社コード・状態の語・数だけ', bad.slice(0, 5), []);
  ok('返り値は小さい（いちばん大きいものでも 1KB に届かない）', Math.max(...replies.map((r) => r.length)) < 1024, String(Math.max(...replies.map((r) => r.length))));

  /* 外へ出た通信の行き先は3つだけ。 */
  const hosts = [...new Set(worlds.flatMap((w) => w.http.map((h) => new URL(h.url).host)))].sort();
  ck('通信の行き先は DB・Anthropic・Resend の3つだけ', hosts, ['api.anthropic.com', 'api.resend.com', 'db.example.test']);
  const toResend = worlds.flatMap((w) => w.mails.map((m) => JSON.stringify(m.body)));
  ck('Resend へ送る中身にも、文とキーは入らない', toResend.filter((b) => /ホンブン|ヨウヤク|ステル|ERRBODYMARK|DBBODYMARK|ROWMARK|KEYMARK/.test(b)), []);
});

for (const d of temps) rmSync(d, { recursive: true, force: true });
realLog(`\n==== ${pass} pass / ${fail} fail ====`);
process.exit(fail ? 1 : 0);
