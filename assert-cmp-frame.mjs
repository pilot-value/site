/* ══════════════════════════════════════════════════════════════════
   assert-cmp-frame.mjs — 比較の枠（career.html?view=compare と、同じ部品が動く会社ページ）の場面（2026-10-22）

   守っているもの（比較の枠：待ちの上限・切り替えの取り違え・片側の失敗・戻る・カードの評価・画像に入れないもの・顔）
     ・待ちの上限（場面 stall）── 返事の来ない読みは、1本ごとの上限（career-live.js の REQ_LIMIT_MS）で「いま読み出せません」と
       「やり直す」になる。上限で切った通信は本当に止める（abort）。自動では聞き直さない（1本のまま）。遅れて届いた返事は画面を変えない。
       「やり直す」で埋まる。会社ページ（airlines/jal.html の評価スコアのカード）も同じ部品なので同じ。
     ・切り替えの取り違え（場面 race）── 読み込みの途中で会社を選び直し・入れ替えても、去った会社の返事（遅れて届いた値も、失敗も）は
       新しい2社の欄に1文字も出ない。
     ・部品の配信元が止まっても（場面 cdn）── supabase-js の読み込みが返ってこなくても、欄は上限で失敗の顔になり、「やり直す」で読み直す。
     ・門（どの場面も）── 開く画面は全部1つの門を通る。通してよいのは、この検査が起こした手元のサーバーと、部品・書体の配信元（LIBS）だけ。
       ほかの行き先への要求は止めたうえで、その場面ごと赤くする（本番へは1本も出ない）。
   どの場面も、終わりに確かめる：門が止めた外への要求 0・本番の supabase への要求 0・すり抜け 0・自分の担当の呼び出しに全部返事があった。

   実行: node assert-cmp-frame.mjs [--scenes a,b] [--shots <folder>]
     --scenes  場面を選ぶ（stall・race・cdn）。付けなければ全部
     --shots   場面の途中の顔（失敗の顔・埋まった顔）を撮って置く（置き場は打った場所。ファイルに書かない）
   自分で手元の保存先を空いているポートで起こし、終わったら捨てる（cmp-stubs.mjs の startLocal）。3000番・3100番は使わない。
   返事は全部この検査が作る（MOCK）。結果の行の頭に [MOCK] と書く。本番については何も言わない（本番は 未確認）。
   ⚠️ 場面 stall は上限まで本当に待つ（時計を進めない）。ほかのブラウザの検査と同時に流さない（混んだ機械は待ちを延ばす）。
   check.mjs には入っていない。手で流す。
   ══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import * as H from './cmp-stubs.mjs';

const { release, watch, seen } = H;
const read = (rel) => fs.readFileSync(path.join(H.ROOT, rel), 'utf8');

const argv = process.argv.slice(2);
const argOf = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const WANT = argOf('--scenes') ? argOf('--scenes').split(',').map((s) => s.trim()).filter(Boolean) : null;
const SHOTS = argOf('--shots');

/* ── 数え方と書き方 ─────────────────────────────────────────── */
let pass = 0, fail = 0, CUR = null;
const ok = (cond, label, detail = '') => {
  const who = CUR ? `${CUR.key}: ` : '';
  if (cond) { pass++; console.log(`[MOCK] ✓ ${who}${label}`); }
  else { fail++; console.log(`[MOCK] ✗ ${who}${label}${detail ? `\n      ${String(detail).slice(0, 600)}` : ''}`); }
};
const head = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(4, 44 - t.length))}`);
const J = (v) => JSON.stringify(v);
/* 検査の側の条件が満たされるまで待つ（時間では待たない） */
const waitFor = async (fn, ms = 8000) => {
  const t0 = Date.now();
  while (!fn()) { if (Date.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, 20)); }
  return true;
};
/* 描いたあとの2コマ */
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));

/* ── 場面の登録 ───────────────────────────────────────────── */
const SCENES = {};
const scene = (key, label, fn) => { SCENES[key] = { key, label, fn }; };

let browser = null, env = null;
const NET = { through: 0, supa: 0, blocked: 0 };
/* 門：この検査の画面は、全部ここから開く（cmp-stubs.mjs の open ＝ 要求を1本ずつ門に通す）。場面の終わりに、開いた全部を確かめる */
const open = async (size, opt = {}) => {
  const o = await H.open(browser, env.local, size, { mode: 'mock', ...opt });
  CUR.pages.push(o);
  return o;
};
async function shot(page, sel, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  const h = await page.$(sel);
  if (h) await h.screenshot({ path: path.join(SHOTS, `${CUR.key}-${name}.png`) });
}

/* ── 製品から読む数（打ち込まない）──────────────────────────────── */
const LJ = read('career-live.js');
const LIMIT = Number((LJ.match(/\n {2}var REQ_LIMIT_MS = (\d+);/) || [])[1]);
const SB_CDN = (LJ.match(/\n {2}var SB_CDN = '([^']+)';/) || [])[1] || '';

/* ── 画面の字（オーナーの言葉。ページのコードからは作らない）──────── */
const ERR = 'いま読み出せません', RETRY = 'やり直す';

/* ── 返事の材料（この枠の場面だけのもの。期待する字は検査が持つ）──────────
   ⚠️ 段階の共通の材料（cmp-stubs.mjs）に口コミ・月の勤務の「開いた」返事が置かれたら、そちらを名前で取る（ここに増やさない）。 */
const SC = ['culture_score', 'salary_score', 'benefits_score', 'wlb_score', 'ops_score', 'training_score'];
const rated = (id, v, extra = {}) => ({ id, airline: 'x', created_at: '2026-09-01T00:00:00Z', cats: ['salary'],
  ...Object.fromEntries(SC.map((k) => [k, v])), ...extra });
const ROWS = {
  jal: [rated('j1', 3)],                       // → 「3.0」・「1件の評価」
  ana: [rated('a1', 5), rated('a2', 4)],       // → 「4.5」・「2件の評価」
  etihad: [rated('e1', 4), rated('e2', 4)],    // → 「4.0」・「2件の評価」
};
const work = (lo, hi) => ({ ok: true, state: 'open', by: { cap: { block_hours: { lo, hi } }, fo: {} } });
const WORK = { jal: work(70, 80), ana: work(50, 55), etihad: work(61, 66) };
/* 去っていく会社（キャセイ）にだけ植える印：数・抜粋・件数。新しい2社の欄に出たら取り違え */
const CX = 'cathay-pacific', CX_MARK = 'CX-PLANTED-913';
const CX_ROWS = Array.from({ length: 7 }, (_, i) => rated('c' + i, 1, { clip: { k: 'salary', o: CX_MARK, t: {} } }));
const CX_REPLY = (name, p) => {
  if (name === 'pv_reviews') return { status: 200, body: { ok: true, unlocked: false, rows: CX_ROWS } };
  if (name === 'pv_work_view') return { status: 200, body: work(913, 917) };
  if (name === 'pv_contrib_facts') {
    const keys = p && Array.isArray(p.keys) ? p.keys : [];
    return { status: 200, body: { ok: true, state: 'open', facts: keys.map((k) => ({ question_id: k, kind: 'num', median_num: 913.7, n: 7 })) } };
  }
  return { status: 200, body: { ok: true, state: 'open', marker: CX_MARK, n: 7 } };     // この日にまだ無い欄の読み（その日に在る読みは全部止める）
};
const CX_SEEN = [CX_MARK, '913', '7件', 'キャセイ'];
const CX_FAIL = () => ({ status: 500, body: { code: 'XX000', details: null, hint: null, message: 'planted failure' } });

/* 送った p が、その会社を名指ししているか */
const names = (p, slug) => !!p && (p.airline === slug || (Array.isArray(p.airlines) && p.airlines.includes(slug)));
const reviewsBy = (map) => (p) => {
  const a = p && Array.isArray(p.airlines) ? p.airlines[0] : '';
  return { status: 200, body: { ok: true, unlocked: false, rows: map[a] || [] } };
};
const workBy = (map) => (p) => ({ status: 200, body: map[p && p.airline] || { ok: true, state: 'login' } });
const factsOpen = () => ({ status: 200, body: { ok: true, state: 'open', facts: [] } });
const callsOf = (st, name, slug) => st.calls.filter((c) => c.name === name && names(c.p, slug)).length;
/* 止めておいた要求を、全部答える（どの名前でも）。答えた要求を返す */
function releaseAll(st, make) {
  const out = [];
  for (const name of Object.keys(st.held)) {
    while ((st.held[name] || []).length) {
      const r = st.held[name][0];
      let p = null;
      try { const b = JSON.parse(r.postData() || 'null'); p = b && typeof b === 'object' && 'p' in b ? b.p : b; } catch { p = null; }
      out.push(r);
      release(st, name, make(name, p));
    }
  }
  return out;
}
/* 要求が終わった（届いた・落ちた）ことを書き留める */
function ends(page) {
  const done = new Set();
  page.on('requestfinished', (r) => done.add(r));
  page.on('requestfailed', (r) => done.add(r));
  return done;
}

/* 書き留め役：fetch の信号が abort を鳴らした要求の住所と中身（ページのどのスクリプトよりも先に置く）。
   ⚠️ 手元のサーバーの差し込み（supabase の住所を手元へ向ける fetch）は、これの上に重なる ＝ 書き留めるのは手元の住所。 */
const ABORTS = () => {
  window.__aborted = [];
  const F = window.fetch;
  window.fetch = function (input, init) {
    try {
      const u = String((input && input.url) || input);
      const sig = (init && init.signal) || (input && input.signal);
      const body = init && typeof init.body === 'string' ? init.body : '';
      if (sig && typeof sig.addEventListener === 'function') {
        sig.addEventListener('abort', () => { window.__aborted.push({ u, body }); }, { once: true });
      }
    } catch (e) { /* 書き留められなくても、通信はそのまま */ }
    return F.apply(this, arguments);
  };
};
const abortedOf = (page) => page.evaluate(() => (window.__aborted || []).slice());
const isCall = (x, name, slug) => x.u.includes('/rest/v1/rpc/' + name) && x.body.includes(`"${slug}"`);

/* ── 画面の道具 ───────────────────────────────────────────── */
const PAIR = (a, b) => `/career.html?view=compare&a=${a}&b=${b}`;
/* その欄の顔：状態・2社・字・「いま読み出せません」の数・「やり直す」の数・片側だけの印 */
const faceOf = (page, sel) => page.evaluate((sel, ERR, RETRY) => {
  const b = document.querySelector(sel);
  if (!b) return null;
  const t = b.innerText || '';
  return { state: b.getAttribute('data-state'), for: b.getAttribute('data-for'), part: b.getAttribute('data-part'),
    errs: t.split(ERR).length - 1, retries: [...b.querySelectorAll('.crl-retry')].filter((x) => x.textContent === RETRY).length,
    text: t.replace(/\s+/g, ' ').trim().slice(0, 300), html: b.outerHTML };
}, sel, ERR, RETRY);
const CMP = (kind) => `#cr [data-view="compare"] .crl[data-live="${kind}"]`;
/* 比較の画面の cmp- の欄（見えているもの）の種類 */
const cmpKinds = (page) => page.evaluate(() => [...document.querySelectorAll('#cr [data-view="compare"] .crl[data-live^="cmp-"]')]
  .filter((b) => b.getClientRects().length).map((b) => b.getAttribute('data-live')));
/* 見えている欄が全部、その2社について読み終わった（SETTLED：待ちの顔でも、まだ何もしていない顔でもない） */
const settled = (page, want, ms = 8000) => page.waitForFunction((want) => {
  const all = [...document.querySelectorAll('#cr [data-view="compare"] .crl[data-live^="cmp-"]')].filter((b) => b.getClientRects().length);
  return all.length > 0 && all.every((b) => b.getAttribute('data-for') === want && !['idle', 'loading'].includes(b.getAttribute('data-state')));
}, { timeout: ms, polling: 100 }, want).then(() => true, () => false);
/* 評価の欄の左右（社名・点数・評価件数） */
const starsLR = (page) => page.evaluate((sel) => {
  const b = document.querySelector(sel);
  const cells = b ? [...b.querySelectorAll('.crl-cmp-row .crl-cmp-c')] : [];
  return cells.map((c) => ({ co: (c.querySelector('.crl-sr') || {}).textContent || '', avg: (c.querySelector('.crl-avg') || {}).textContent || '',
    cnt: (c.querySelector('.crl-cnt') || {}).textContent || '' }));
}, CMP('cmp-stars'));
/* 会社ページの評価スコアのカードの欄 */
const CARD = (kind) => `#pvg-score .crl[data-live="${kind}"]`;
const CARD_KINDS = ['score', 'summary', 'reviews'];

/* ══ stall ══════════════════════════════════════════════════════ */
scene('stall', '返事の来ない読みは上限で「いま読み出せません」・本当に止める・自動では聞き直さない・遅れた返事は画面を変えない・「やり直す」で埋まる', async () => {
  ok(Number.isFinite(LIMIT) && LIMIT >= 1000 && LIMIT <= 60000, `1本の通信の上限が career-live.js から読める（REQ_LIMIT_MS = ${LIMIT}）`);
  if (!(Number.isFinite(LIMIT) && LIMIT >= 1000)) return;

  /* 比較：JAL の口コミと JAL の月の勤務だけ、返事を止める（ANA は答える） */
  const cmp = { pv_reviews: (p) => (names(p, 'jal') ? 'hold' : reviewsBy(ROWS)(p)),
    pv_work_view: (p) => (p && p.airline === 'jal' ? 'hold' : workBy(WORK)(p)) };
  /* 会社ページ：JAL の口コミと要約の返事を止める（評価スコアのカードの3つの欄と、社名の横の星） */
  const card = { pv_reviews: (p) => (names(p, 'jal') ? 'hold' : reviewsBy(ROWS)(p)),
    pv_review_summary: (p) => (p && p.airline === 'jal' ? 'hold' : { status: 200, body: { ok: true, state: 'few' } }) };
  const t0 = Date.now();
  const [A, B] = await Promise.all([
    open('pc', { url: PAIR('jal', 'ana'), before: ABORTS, stub: cmp }),
    open('pc', { url: '/airlines/jal.html', before: ABORTS, stub: card }),
  ]);
  const endA = ends(A.page), endB = ends(B.page);

  /* ただ1つの本当の待ち（上限 ＋ 10秒まで）。上限の2秒前に一度だけ数を控える（まだ待っている・要求の数）→ 欄が「読み込み中」を抜けるまで */
  await new Promise((r) => setTimeout(r, Math.max(0, t0 + LIMIT - 2000 - Date.now())));
  const loadingAt = (page, sels) => page.evaluate((sels) => sels.every((s) => {
    const b = document.querySelector(s);
    return !!b && b.getAttribute('data-state') === 'loading';
  }), sels);
  const pre = { cmp: await loadingAt(A.page, [CMP('cmp-stars'), CMP('cmp-work')]), card: await loadingAt(B.page, CARD_KINDS.map(CARD)),
    revB: callsOf(B.st, 'pv_reviews', 'jal'), sumB: callsOf(B.st, 'pv_review_summary', 'jal') };
  const LONG = LIMIT + 10000;
  const leftA = A.page.waitForFunction((sels) => sels.every((s) => {
    const b = document.querySelector(s);
    return !!b && b.getAttribute('data-for') === 'jal|ana' && !['idle', 'loading'].includes(b.getAttribute('data-state'));
  }), { timeout: LONG, polling: 200 }, [CMP('cmp-stars'), CMP('cmp-work')]).then(() => Date.now() - t0, () => -1);
  const leftB = B.page.waitForFunction((sels) => sels.every((s) => {
    const b = document.querySelector(s);
    return !!b && !['idle', 'loading'].includes(b.getAttribute('data-state'));
  }), { timeout: LONG, polling: 200 }, CARD_KINDS.map(CARD)).then(() => Date.now() - t0, () => -1);
  const [tookA, tookB] = await Promise.all([leftA, leftB]);

  /* ── 比較の画面 ── */
  ok(tookA > 0, `比較：口コミと月の勤務の欄が、${LONG / 1000}秒のうちに「読み込み中」を抜けた`, `${tookA}ms`);
  ok(pre.cmp && tookA >= LIMIT - 1000, `比較：抜けたのは上限を待ったあと（上限の2秒前はまだ「読み込み中」・${tookA}ms ≥ ${LIMIT - 1000}ms）── 返事の来ない読みを上限より前に見切らない`,
    J({ loadingBefore: pre.cmp, tookA }));
  const rev = await faceOf(A.page, CMP('cmp-stars')), wk = await faceOf(A.page, CMP('cmp-work'));
  ok(!!rev && rev.errs === 1 && rev.retries === 1 && rev.part === '1' && rev.text.includes('4.5'),
    `比較：口コミの欄は、JAL の側に「${ERR}」が1回・「${RETRY}」が1つ（ANA の側は読めた値のまま）`, J(rev && { ...rev, html: undefined }));
  ok(!!wk && wk.state === 'error' && wk.errs === 1 && wk.retries === 1,
    `比較：月の勤務の欄は「${ERR}」と「${RETRY}」が1つずつ`, J(wk && { ...wk, html: undefined }));
  ok(callsOf(A.st, 'pv_reviews', 'jal') === 1 && callsOf(A.st, 'pv_work_view', 'jal') === 1,
    '比較：自動では聞き直さない ── 上限のあとも JAL の口コミ・月の勤務の要求は1本ずつのまま',
    J({ pv_reviews: callsOf(A.st, 'pv_reviews', 'jal'), pv_work_view: callsOf(A.st, 'pv_work_view', 'jal') }));
  const abA = await abortedOf(A.page);
  ok(abA.some((x) => isCall(x, 'pv_work_view', 'jal')) && !abA.some((x) => x.u.includes('/rest/v1/rpc/pv_reviews')),
    '比較：上限で、JAL の月の勤務の通信を本当に止めた（abort が鳴った）。口コミの行の読み（review-i18n.js の fetchRows）は止める口を持たない ── 待つのをやめるだけ',
    J(abA));
  await shot(A.page, '#cr [data-view="compare"] .cr-cmp-rev', 'compare-fail-rev');
  await shot(A.page, '#cr [data-view="compare"] .cr-cmp-work', 'compare-fail-work');

  /* ── 会社ページ（同じ部品） ── */
  ok(pre.card && tookB > 0 && tookB >= LIMIT - 1000,
    `会社ページ：評価スコアのカードの欄が、上限を待ったあとで「読み込み中」を抜けた（上限の2秒前はまだ「読み込み中」・${tookB}ms ≥ ${LIMIT - 1000}ms）`,
    J({ loadingBefore: pre.card, tookB }));
  const cardFaces = await Promise.all(CARD_KINDS.map((k) => faceOf(B.page, CARD(k))));
  /* 要約の失敗の顔は、点数の欄が失敗している時は畳まれる（pv-glance.css ── 同じカードで同じ1行を重ねない）。欄の状態と「やり直す」は在る */
  ok(cardFaces.every((f, i) => !!f && f.state === 'error' && f.retries === 1 && f.errs === (CARD_KINDS[i] === 'summary' ? 0 : 1)),
    `会社ページ：評価スコアのカードの3つの欄（点数・要約・口コミ）が失敗の顔（点数と口コミに「${ERR}」・どの欄も「${RETRY}」1つ。要約の1行は点数の1行に畳まれる）`,
    J(cardFaces.map((f, i) => f && { k: CARD_KINDS[i], state: f.state, errs: f.errs, retries: f.retries, text: f.text.slice(0, 60) })));
  /* 会社ページでは、口コミの行はページの口コミの部品も別に1本読む ── 数は「上限の前と後で増えない」で見る */
  const revB0 = callsOf(B.st, 'pv_reviews', 'jal'), sumB0 = callsOf(B.st, 'pv_review_summary', 'jal');
  ok(sumB0 === 1 && pre.sumB === 1 && revB0 >= 1 && revB0 === pre.revB,
    `会社ページ：自動では聞き直さない ── JAL の要約は1本のまま・口コミの要求も上限の前と後で同じ数（${pre.revB} → ${revB0}本）`,
    J({ pv_reviews: [pre.revB, revB0], pv_review_summary: [pre.sumB, sumB0] }));
  const abB = await abortedOf(B.page);
  ok(abB.some((x) => isCall(x, 'pv_review_summary', 'jal')) && !abB.some((x) => x.u.includes('/rest/v1/rpc/pv_reviews')),
    '会社ページ：上限で、JAL の要約の通信を本当に止めた。口コミの行の読みは止める口を持たない（待つのをやめるだけ）', J(abB));
  await shot(B.page, '#pvg-score', 'card-fail');

  /* ── 遅れて届いた返事は、画面を変えない ── */
  const beforeA = (await Promise.all(['cmp-stars', 'cmp-work'].map((k) => faceOf(A.page, CMP(k))))).map((f) => f && f.html);
  const beforeB = (await Promise.all(CARD_KINDS.map((k) => faceOf(B.page, CARD(k))))).map((f) => f && f.html);
  A.st.held.pv_work_view = [];                 // 止めた（abort した）要求には答えない
  B.st.held.pv_review_summary = [];
  const late = [...releaseAll(A.st, () => ({ status: 200, body: { ok: true, unlocked: false, rows: ROWS.jal } })),
    ...releaseAll(B.st, () => ({ status: 200, body: { ok: true, unlocked: false, rows: ROWS.jal } }))];
  const fin = await waitFor(() => late.every((r) => endA.has(r) || endB.has(r)));
  await frames(A.page); await frames(B.page);
  const afterA = (await Promise.all(['cmp-stars', 'cmp-work'].map((k) => faceOf(A.page, CMP(k))))).map((f) => f && f.html);
  const afterB = (await Promise.all(CARD_KINDS.map((k) => faceOf(B.page, CARD(k))))).map((f) => f && f.html);
  ok(fin && late.length === 1 + revB0, `遅れて届く返事（比較の口コミ1本・会社ページの口コミ${revB0}本）を流し、届き終わった（${late.length}本）`, J({ fin, n: late.length }));
  ok(J(beforeA) === J(afterA) && J(beforeB) === J(afterB), '遅れて届いた返事は、どの欄も1文字も変えない（届いて2コマたっても同じ）',
    J({ cmp: beforeA.map((h, i) => h === afterA[i]), card: beforeB.map((h, i) => h === afterB[i]) }));

  /* ── 「やり直す」で埋まる（返事は今度は答える） ── */
  A.st.stub.pv_reviews = reviewsBy(ROWS); A.st.stub.pv_work_view = workBy(WORK);
  B.st.stub.pv_reviews = reviewsBy(ROWS); B.st.stub.pv_review_summary = () => ({ status: 200, body: { ok: true, state: 'few' } });
  await A.page.click(`${CMP('cmp-work')} .crl-retry`);
  await B.page.click(`${CARD('score')} .crl-retry`);
  const fillA = await settled(A.page, 'jal|ana');
  const fillB = await B.page.waitForFunction((sels) => sels.every((s) => {
    const b = document.querySelector(s);
    return !!b && !['idle', 'loading', 'error'].includes(b.getAttribute('data-state'));
  }), { timeout: 8000, polling: 100 }, CARD_KINDS.map(CARD)).then(() => true, () => false);
  const lr = await starsLR(A.page), wk2 = await faceOf(A.page, CMP('cmp-work')), sc = await faceOf(B.page, CARD('score'));
  ok(fillA && callsOf(A.st, 'pv_reviews', 'jal') === 2 && callsOf(A.st, 'pv_work_view', 'jal') === 2
    && lr.length === 2 && lr[0].avg === '3.0' && lr[0].cnt === '1件の評価' && lr[1].avg === '4.5'
    && !!wk2 && wk2.state === 'open' && wk2.errs === 0 && wk2.text.includes('70〜80'),
    `比較：「${RETRY}」を押すと1本ずつ聞き直し（JAL の口コミ・月の勤務とも2本目）、JAL の値で埋まる（3.0・1件の評価・乗務時間 70〜80）`,
    J({ fillA, rev: callsOf(A.st, 'pv_reviews', 'jal'), work: callsOf(A.st, 'pv_work_view', 'jal'), lr, wk: wk2 && wk2.text.slice(0, 120) }));
  ok(fillB && callsOf(B.st, 'pv_reviews', 'jal') === revB0 + 1 && callsOf(B.st, 'pv_review_summary', 'jal') === sumB0 + 1
    && !!sc && sc.state === 'open' && sc.text.includes('3.0') && sc.text.includes('1件の評価'),
    `会社ページ：「${RETRY}」を押すと、口コミと要約を1本ずつ聞き直し、評価スコアが JAL の値で埋まる（3.0・1件の評価）`,
    J({ fillB, rev: callsOf(B.st, 'pv_reviews', 'jal'), sum: callsOf(B.st, 'pv_review_summary', 'jal'), sc: sc && sc.text.slice(0, 80) }));
  await shot(A.page, '#cr [data-view="compare"] .cr-cmp-rev', 'compare-filled-rev');
  await shot(B.page, '#pvg-score', 'card-filled');
});

/* ══ race ═══════════════════════════════════════════════════════ */
/* JAL｜キャセイを開き、キャセイの読みを全部止めたまま、2社目をエティハドに選び直して入れ替える（→ エティハド｜JAL）。
   そのあとで、止めておいたキャセイの返事を流す（leg 1 ＝ 印を植えた値／leg 2 ＝ 失敗）。 */
async function raceLeg(leg) {
  const stub = { pv_reviews: reviewsBy(ROWS), pv_work_view: workBy(WORK), pv_contrib_facts: factsOpen };
  const { page, st } = await open('pc', { url: PAIR('jal', CX), stub, holdIf: (name, p) => names(p, CX) });
  const end = ends(page);
  const kinds = await page.waitForFunction(() => document.querySelectorAll('#cr [data-view="compare"] .crl[data-live^="cmp-"]').length > 0,
    { timeout: 8000 }).then(() => cmpKinds(page), () => []);
  /* その日の比較の欄が、全部キャセイを待っている（キャセイの読みが1本も答えられていない） */
  const held = await waitFor(() => ['pv_reviews', 'pv_work_view', 'pv_contrib_facts'].every((n) => (st.held[n] || []).length >= 1));
  const tHeld = Date.now();
  const cxCalls = () => st.calls.filter((c) => names(c.p, CX)).length;
  const heldN = () => Object.values(st.held).reduce((n, q) => n + q.length, 0);
  ok(held && kinds.length >= 3 && cxCalls() === heldN(),
    `${leg}：その日の比較の欄（${kinds.join('・')}）が、キャセイの読みを待っている（キャセイを名指しした読み ${cxCalls()}本 ＝ 止めた ${heldN()}本）`,
    J({ held, kinds, calls: cxCalls(), held: heldN() }));
  for (const k of kinds) await watch(page, k);
  await page.select('#cr-b', 'etihad');
  await page.waitForFunction(() => [...document.querySelectorAll('#cr [data-view="compare"] .crl[data-live^="cmp-"]')]
    .every((b) => b.getAttribute('data-for') === 'jal|etihad'), { timeout: 8000, polling: 50 }).catch(() => {});
  await page.click('#cr-swap');
  const calm = await settled(page, 'etihad|jal');
  ok(calm, `${leg}：選び直して入れ替えたあと、比較の欄が全部エティハド｜JAL で読み終わった`);
  ok(cxCalls() === heldN() && Date.now() - tHeld < LIMIT - 2000,
    `${leg}：（前提）キャセイの返事は、まだ1本も答えていない・上限より前に流す`, J({ calls: cxCalls(), held: heldN(), ms: Date.now() - tHeld }));
  const sent = releaseAll(st, leg === 'leg1' ? CX_REPLY : CX_FAIL);
  const fin = await waitFor(() => sent.every((r) => end.has(r)));
  await frames(page);
  const faces = await Promise.all(kinds.map((k) => faceOf(page, CMP(k))));
  const log = await seen(page);
  const lr = await starsLR(page);
  ok(fin && sent.length >= 3, `${leg}：止めておいたキャセイの返事（${sent.length}本）を${leg === 'leg1' ? '印を植えた値' : '失敗（500）'}で流し、届き終わった`);
  ok(faces.every((f) => !!f && f.for === 'etihad|jal'), `${leg}：どの比較の欄も、エティハド｜JAL の欄のまま（data-for）`,
    J(faces.map((f, i) => f && `${kinds[i]}:${f.for}`)));
  if (leg === 'leg1') {
    const hit = log.filter((s) => CX_SEEN.some((m) => s.includes(m)));
    ok(hit.length === 0, `${leg}：去った会社（キャセイ）の値・抜粋・件数・社名が、入れ替えのあと比較の欄に1文字も出ない（欄が取った顔を全部書き留めて探した）`,
      hit.slice(0, 4).join(' ／ '));
  } else {
    ok(faces.every((f) => !!f && f.state !== 'error' && f.errs === 0), `${leg}：去った会社の失敗で、比較の欄に「${ERR}」が出ない`,
      J(faces.map((f, i) => f && `${kinds[i]}:${f.state}:${f.errs}`)));
  }
  ok(lr.length === 2 && lr[0].co.includes('エティハド') && lr[0].avg === '4.0' && lr[0].cnt === '2件の評価'
    && lr[1].co.includes('JAL') && lr[1].avg === '3.0' && lr[1].cnt === '1件の評価',
    `${leg}：評価の欄は、左がエティハド（4.0・2件の評価）・右が JAL（3.0・1件の評価）`, J(lr));
}
scene('race', '読み込みの途中で選び直し・入れ替えても、去った会社の返事（値も失敗も）は新しい2社の欄に出ない', async () => {
  ok(Number.isFinite(LIMIT) && LIMIT >= 5000, `上限が読める（${LIMIT}ms ── 返事を止めておくあいだに、上限で切れないことの前提）`);
  await raceLeg('leg1');
  await raceLeg('leg2');
});

/* ══ cdn ════════════════════════════════════════════════════════ */
scene('cdn', 'supabase-js の読み込みが返ってこなくても、欄は上限で失敗の顔になり、「やり直す」でもう一度読み込んで埋まる', async () => {
  ok(Number.isFinite(LIMIT) && LIMIT >= 1000 && /^https:\/\/cdn\.jsdelivr\.net\//.test(SB_CDN),
    `上限と supabase-js の住所が career-live.js から読める（${LIMIT}ms・${SB_CDN}）`);
  if (!(Number.isFinite(LIMIT) && SB_CDN)) return;
  const t0 = Date.now();
  const { page, st } = await open('pc', { url: PAIR('jal', 'ana'), stub: { pv_reviews: reviewsBy(ROWS), pv_work_view: workBy(WORK) },
    holdUrl: (u) => u === SB_CDN });
  const kinds = await page.waitForFunction(() => document.querySelectorAll('#cr [data-view="compare"] .crl[data-live^="cmp-"]').length > 0,
    { timeout: 8000 }).then(() => cmpKinds(page), () => []);
  const failed = await page.waitForFunction(() => {
    const all = [...document.querySelectorAll('#cr .crl[data-live]')].filter((b) => b.getClientRects().length);
    return all.length > 0 && all.every((b) => b.getAttribute('data-state') === 'error');
  }, { timeout: LIMIT + 5000, polling: 200 }).then(() => Date.now() - t0, () => -1);
  const faces = await Promise.all(kinds.map((k) => faceOf(page, CMP(k))));
  ok(failed > 0 && st.heldUrl.length === 1 && faces.length >= 3 && faces.every((f) => f && f.errs === 1 && f.retries === 1),
    `部品の読み込みを止めたまま、見えている欄（${kinds.join('・')}）が全部、${(LIMIT + 5000) / 1000}秒のうちに「${ERR}」と「${RETRY}」になった（${failed}ms）`,
    J({ failed, heldUrl: st.heldUrl.length, faces: faces.map((f, i) => f && `${kinds[i]}:${f.state}:${f.errs}:${f.retries}`) }));
  /* 止めるのをやめる（止めていた1本は切る）→「やり直す」 */
  st.holdUrl = null;
  for (const r of st.heldUrl.splice(0)) await r.abort('failed').catch(() => {});
  let again = 0;
  page.on('request', (r) => { if (r.url() === SB_CDN) again++; });
  await page.click(`${CMP('cmp-work')} .crl-retry`);
  const filled = await settled(page, 'jal|ana', 20000);
  const after = await Promise.all(kinds.map((k) => faceOf(page, CMP(k))));
  ok(filled && again === 1 && after.every((f) => !!f && f.state !== 'error' && f.errs === 0),
    `「${RETRY}」を押すと、supabase-js をもう一度読みに行き（2本目 ${again}本）、欄が埋まる`,
    J({ filled, again, after: after.map((f, i) => f && `${kinds[i]}:${f.state}`) }));
});

/* ══ 走らせる ═══════════════════════════════════════════════════ */
const KEYS = Object.keys(SCENES);
const bad = (WANT || []).filter((k) => !KEYS.includes(k));
if (bad.length) { console.error(`知らない場面: ${bad.join(',')}（在るのは ${KEYS.join(',')}）`); process.exit(2); }
const t0 = Date.now();
try {
  for (const s of KEYS.filter((k) => !WANT || WANT.includes(k)).map((k) => SCENES[k])) {
    CUR = { ...s, pages: [] };
    head(`[MOCK] ${s.key} ── ${s.label}`);
    try {
      browser = browser || await H.launch();
      env = env || await H.startLocal();
      await s.fn();
    } catch (e) {
      ok(false, '場面が最後まで走らなかった', String((e && e.stack) || e).slice(0, 500));
    } finally {
      for (const o of CUR.pages) await o.close();
      const sts = CUR.pages.map((o) => o.st);
      const all = (k) => sts.flatMap((x) => x[k]);
      NET.through += all('through').length; NET.supa += all('supa').length; NET.blocked += all('blocked').length;
      /* 門：外へ向かった要求は、止めても赤（通してよいのは手元のサーバーと LIBS だけ） */
      ok(all('blocked').length === 0 && all('supa').length === 0,
        '門：手元のサーバーと部品の配信元（LIBS）のほかへ向かった要求 0（本番の supabase 0）', [...all('supa'), ...all('blocked')].join('・'));
      ok(all('through').length === 0, '門：外へすり抜けた要求 0', all('through').join('・'));
      ok(all('unknown').length === 0, '自分の担当の呼び出しには、全部この検査が返事を作った', all('unknown').join(','));
      const foreign = [...new Set(all('foreign'))];
      if (foreign.length) console.log(`  ・ほかの担当の呼び出し（準備中で返した）: ${foreign.join(', ')}`);
      const errs = [...new Set(all('errs'))];
      if (errs.length) console.log(`  ・ページの中のエラー: ${errs.join(' ／ ')}`);
    }
  }
} finally {
  CUR = null;
  if (browser) await browser.close();
  if (env) await env.stop();
}
const ran = KEYS.filter((k) => !WANT || WANT.includes(k));
console.log(`\n  場面: ${ran.join(', ')}${WANT ? '（--scenes で絞った。緑でも全部を見たことにはならない）' : ''}`);
console.log(`  ★外への通信（localhost と LIBS のほか）: 門が止めた ${NET.blocked}・本番の supabase ${NET.supa}・すり抜け ${NET.through}`);
console.log(`\n══ ${pass} pass / ${fail} fail ══（MOCK。本番は 未確認）  ${Math.round((Date.now() - t0) / 1000)}s`);
process.exit(fail ? 1 : 0);
