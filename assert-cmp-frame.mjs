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
     --scenes  場面を選ぶ（stall・race・cdn・rate）。付けなければ全部
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
/* 比較の画面の cmp- の欄（getClientRects の在るもの）を、要素ごとに1つずつ（同じ種類が2つあっても、それぞれを読む）。
   quiet ＝ data-quiet="1"・after ＝ すぐ前の欄の種類・shown ＝ 見えている「やり直す」の数・h ＝ 欄の高さ */
const cdnFaces = (page) => page.evaluate((ERR, RETRY) => [...document.querySelectorAll('#cr [data-view="compare"] .crl[data-live^="cmp-"]')]
  .filter((b) => b.getClientRects().length).map((b) => {
    const t = b.innerText || '', prev = b.previousElementSibling;
    const rs = [...b.querySelectorAll('.crl-retry')].filter((x) => x.textContent === RETRY);
    return { kind: b.getAttribute('data-live'), quiet: b.getAttribute('data-quiet') === '1', state: b.getAttribute('data-state'),
      after: (prev && prev.getAttribute('data-live')) || '', errs: t.split(ERR).length - 1, retries: rs.length,
      shown: rs.filter((x) => x.getClientRects().length && x.getBoundingClientRect().height > 1).length,
      h: Math.round(b.getBoundingClientRect().height), text: t.trim() };
  }), ERR, RETRY);
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
  /* 月の勤務の欄は、片方の会社が読めないと会社ごとに上下へ並べる（2026-10-22 cmp-reviews-3 ── 読めた会社の値はそのまま出す）。
     前の決まり「欄は失敗の顔（error）で「いま読み出せません」と「やり直す」が1つずつ」は、同じ強さで次へ移した（LEAD の決め (a)・X0）：
     欄は開いた顔（open）で片側だけの印（data-part 1）・「いま読み出せません」は止めた JAL の列に1回だけ・「やり直す」は1つ・
     ANA の列は読めた値（乗務時間 50〜55）のまま */
  const wkCols = await A.page.evaluate((sel) => {
    const b = document.querySelector(sel);
    const col = (s) => { const c = b && b.querySelector(`.crl-split-c[data-airline="${s}"]`); return c ? c.innerText : null; };
    return { jal: col('jal'), ana: col('ana') };
  }, CMP('cmp-work'));
  ok(!!wk && wk.state === 'open' && wk.part === '1' && wk.errs === 1 && wk.retries === 1 && wk.text.includes('50〜55')
    && wkCols.jal !== null && wkCols.jal.split(ERR).length === 2 && wkCols.ana !== null && wkCols.ana.includes('50〜55') && !wkCols.ana.includes(ERR),
    `比較：月の勤務の欄は、JAL の側に「${ERR}」が1回・「${RETRY}」が1つ（ANA の側は読めた値のまま）`, J(wk && { ...wk, html: undefined, cols: wkCols }));
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
  /* 欄は1つずつ読む（同じ種類の欄が2つある ── cmp-facts は月の働き方のすぐ下と待遇の下）。前の決まり「どの欄も「いま読み出せません」と
     「やり直す」が1つずつ」は、種類の最初の1つを2回読んでいた。同じ強さで次へ移した（LEAD の決め (b)・X0）：
     月の働き方のすぐ下の回答の欄（data-quiet）は、月の働き方が失敗の顔のとき畳まれる（高さ 0・見える字も見える「やり直す」も無い ──
     同じ箱で同じ1行を重ねない。やり直しは月の働き方の「やり直す」が全部を聞き直す）。ほかの欄は、どれも失敗の顔で両方が1つずつ見えている */
  const F = await cdnFaces(page), quiet = F.filter((f) => f.quiet), loud = F.filter((f) => !f.quiet);
  const wkF = F.find((f) => f.kind === 'cmp-work');
  ok(failed > 0 && st.heldUrl.length === 1 && loud.length >= 3
    && loud.every((f) => f.state === 'error' && f.errs === 1 && f.retries === 1 && f.shown === 1)
    && F.filter((f) => f.kind === 'cmp-facts').length === 2 && loud.some((f) => f.kind === 'cmp-facts')
    && !!wkF && wkF.state === 'error' && quiet.length === 1
    && quiet.every((f) => f.kind === 'cmp-facts' && f.after === 'cmp-work' && f.state === 'error' && f.h === 0 && f.text === '' && f.shown === 0),
    `部品の読み込みを止めたまま、見えている欄（${loud.map((f) => f.kind).join('・')}）が全部、${(LIMIT + 5000) / 1000}秒のうちに「${ERR}」と「${RETRY}」になった（${failed}ms）。月の働き方のすぐ下の回答の欄は畳まれて、字も「${RETRY}」も重ねない`,
    J({ failed, heldUrl: st.heldUrl.length, faces: F.map((f) => `${f.kind}${f.quiet ? '(quiet)' : ''}:${f.state}:${f.errs}:${f.retries}:${f.shown}:h${f.h}`) }));
  /* 止めるのをやめる（止めていた1本は切る）→「やり直す」 */
  st.holdUrl = null;
  for (const r of st.heldUrl.splice(0)) await r.abort('failed').catch(() => {});
  let again = 0;
  page.on('request', (r) => { if (r.url() === SB_CDN) again++; });
  await page.click(`${CMP('cmp-work')} .crl-retry`);
  const filled = await settled(page, 'jal|ana', 20000);
  const after = await cdnFaces(page);
  ok(filled && again === 1 && after.length === F.length && after.every((f) => f.state !== 'error' && f.errs === 0),
    `「${RETRY}」を押すと、supabase-js をもう一度読みに行き（2本目 ${again}本）、欄が埋まる（月の働き方のすぐ下の回答の欄も）`,
    J({ filled, again, after: after.map((f) => `${f.kind}${f.quiet ? '(quiet)' : ''}:${f.state}`) }));
});

/* ══ rate ═══════════════════════════════════════════════════════ */
/* 書き留め役（I-4b・1つの文）：キャンバスに描かれた字（fillText / strokeText）と絵（drawImage の元。キャンバスは '(canvas)'）を、
   ページのどのスクリプトよりも先に window.__drawn へ書き留める。assert-career.mjs（T-C3）が同じ文を写して使う ── 直すときは2つを同じに直す。 */
const RECORDER = () => {
  const P = CanvasRenderingContext2D.prototype, D = window.__drawn = { text: [], img: [] };
  const fT = P.fillText, sT = P.strokeText, dI = P.drawImage;
  P.fillText = function (s) { D.text.push(String(s)); return fT.apply(this, arguments); };
  P.strokeText = function (s) { D.text.push(String(s)); return sT.apply(this, arguments); };
  P.drawImage = function (src) {
    D.img.push(typeof HTMLCanvasElement !== 'undefined' && src instanceof HTMLCanvasElement ? '(canvas)' : String((src && (src.currentSrc || src.src)) || ''));
    return dI.apply(this, arguments);
  };
};
/* 保存の受け取り役：「画像を保存」の a.download を押した瞬間に、それまでに描かれた字を控えて、何も書き出さない（ダウンロードを起こさない） */
const CATCHER = () => {
  window.__saved = [];
  const C = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) { window.__saved.push({ name: this.download, blob: /^blob:/.test(this.href), text: ((window.__drawn || {}).text || []).slice() }); return undefined; }
    return C.apply(this, arguments);
  };
};
const CARD_BEFORE = `(${RECORDER})();(${CATCHER})();`;
/* 評価の材料（この場面だけのもの）。植えた印は、ページの外へ渡す答えにも、カードにも出てはいけない */
const RATE_MARK = 'RATE-PLANTED-731';
const planted = (id, v, extra = {}) => rated(id, v, { pros: RATE_MARK, cons: RATE_MARK, clip: { k: 'salary', o: RATE_MARK, t: {} }, author_hash: RATE_MARK, ...extra });
const RATE_ROWS = {
  jal: [planted('j1', 3), planted('j2', 4), planted('j3', null, { salary_score: 4 })],   // 1行ずつの平均 3・4・4 → 3.666… → 「3.7」・「3件の評価」
  ana: [planted('a1', 5), planted('a2', 4)],                                              // → 「4.5」・「2件の評価」
  etihad: [],                                                                               // 投稿が無い
  'eva-air': [planted('v1', null), planted('v2', 0)],                                       // 投稿は在るが、点数が無い
};
const RATE_FAIL = 'cathay-pacific';                                                         // 読めない（500）
const rateStub = (fail = RATE_FAIL) => ({ pv_reviews: (p) => {
  const a = p && Array.isArray(p.airlines) ? p.airlines[0] : '';
  return a === fail ? CX_FAIL() : { status: 200, body: { ok: true, unlocked: false, rows: RATE_ROWS[a] || [] } };
} });
/* 決まりの書き直し（この検査の言葉）：1行の平均は、点数の付いた分類（0 より大きい・5 で頭打ち）だけの平均。
   評価の平均はその行の平均の平均、評価件数は点数の付いた行の数。行が無い・点数が1つも無い → null（0 にしない） */
const expectRate = (rows) => {
  let tot = 0, n = 0;
  for (const r of rows || []) {
    const v = SC.map((k) => Number(r && r[k])).filter((x) => Number.isFinite(x) && x > 0).map((x) => Math.min(5, x));
    if (v.length) { tot += v.reduce((a, b) => a + b, 0) / v.length; n++; }
  }
  return n ? { avg: tot / n, n } : null;
};
/* カードの材料の評価（字・塗る幅・件数）── 平均は小数1けた、塗る幅は 平均 ÷ 5 を 1000 分の1で丸める（会社ページ・比較の星と同じ決め方） */
const cardRate = (r) => (r ? { avg: Math.min(5, r.avg).toFixed(1), fill: Math.round(Math.min(5, r.avg) / 5 * 1000) / 1000, n: r.n, text: `${r.n}件の評価` } : null);
/* カードの画面の道具（材料は career-card.js の PVCareerCard.model()・描いた回の印は #crc-root の data-drawn） */
const SAVE = '#crc-root .crc-act .crc-btn:not(.is-ghost)';
const cardModel = (page) => page.evaluate(() => (window.PVCareerCard && window.PVCareerCard.model ? window.PVCareerCard.model() : null));
const drawnAttr = (page) => page.evaluate(() => { const r = document.getElementById('crc-root'); return r ? r.getAttribute('data-drawn') : null; });
const drawnText = (page) => page.evaluate(() => ((window.__drawn || {}).text || []).slice());
const cardUp = (page, n) => page.waitForFunction((n) => {
  const m = window.PVCareerCard && window.PVCareerCard.model && window.PVCareerCard.model();
  return !!(m && m.cards && m.cards.length === n && m.layout) && !!document.getElementById('crc-root').getAttribute('data-drawn');
}, { timeout: 8000 }, n).then(() => true, () => false);
/* 材料の全部の会社に評価が載るまで待って、その材料を返す（載らなければ null） */
const cardRated = (page, n) => page.waitForFunction((n) => {
  const m = window.PVCareerCard && window.PVCareerCard.model && window.PVCareerCard.model();
  return !!(m && m.cards && m.cards.length === n && m.cards.every((c) => !!c.rating));
}, { timeout: 8000, polling: 50 }, n).then(() => cardModel(page), () => null);
/* 描き直しが落ち着くまで（2コマ ＋ もう1回描かせる）。評価は聞かない（聞くと要求の数が変わる） */
const calmCard = async (page) => { await frames(page); await page.evaluate(() => window.PVCareerCard.redraw()); await frames(page); };

scene('rate', 'カードの評価 ── ページの外へ渡すのは2つの数だけ・比較の欄と同じ字・見本のまま保存・評価の無い会社は描かない・1社1回だけ聞く', async () => {
  /* (e) 渡る値：PVCareer.rating は {avg, n} だけを返す（行・本文・抜粋・植えた印を渡さない）。投稿が無い／点数が無い → null。読めない → 失敗 */
  {
    const { page } = await open('pc', { url: PAIR('jal', 'ana'), stub: rateStub() });
    await page.waitForFunction(() => !!(window.PVCareer && typeof window.PVCareer.rating === 'function'), { timeout: 8000 }).catch(() => {});
    const got = await page.evaluate(async (slugs) => {
      const out = {};
      for (const s of slugs) {
        try { const v = await window.PVCareer.rating(s); out[s] = { ok: true, v, keys: v ? Object.keys(v) : null, json: JSON.stringify(v) }; } catch (e) { out[s] = { ok: false }; }
      }
      return out;
    }, ['jal', 'ana', 'etihad', 'eva-air', RATE_FAIL]);
    const two = ['jal', 'ana'].map((s) => {
      const g = got[s] || {}, want = expectRate(RATE_ROWS[s]);
      return !!g.ok && J(g.keys) === J(['avg', 'n']) && !!want && Math.abs(g.v.avg - want.avg) < 1e-9 && g.v.n === want.n && !g.json.includes(RATE_MARK);
    });
    ok(two.every(Boolean), 'PVCareer.rating が渡すのは2つの数だけ（avg・n）── この検査が行から数え直した値と同じ・行の欄も植えた印も1つも無い（JAL 3件・ANA 2件）',
      J({ jal: got.jal, ana: got.ana }));
    ok(!!got.etihad && got.etihad.ok && got.etihad.v === null && !!got['eva-air'] && got['eva-air'].ok && got['eva-air'].v === null,
      '投稿が無い会社・点数の付いた投稿が無い会社は null（0 にしない）', J({ etihad: got.etihad, eva: got['eva-air'] }));
    ok(!!got[RATE_FAIL] && got[RATE_FAIL].ok === false, '読めなかった会社（500）は失敗として返る（null ＝「評価なし」とは別）', J(got[RATE_FAIL]));
  }

  /* (a) 返事が先・カードが後：比較で JAL｜ANA を読み終えてから「カードを保存」→ カードの評価は、比較の欄の2つの字と同じ */
  {
    const { page } = await open('pc', { url: PAIR('jal', 'ana'), stub: rateStub(), before: CARD_BEFORE });
    const calm = await settled(page, 'jal|ana');
    const lr = await starsLR(page);
    await page.click('#cr-to-card');
    const m = await cardRated(page, 2);
    const drawn = await drawnText(page);
    const want = ['jal', 'ana'].map((s) => cardRate(expectRate(RATE_ROWS[s])));
    const okA = !!m && m.cards.map((c) => c.slug).join('|') === 'jal|ana' && lr.length === 2
      && m.cards.every((c, i) => J(c.rating) === J(want[i]) && c.rating.avg === lr[i].avg && c.rating.text === lr[i].cnt
        && drawn.includes(c.rating.avg) && drawn.includes(c.rating.text));
    ok(calm && okA, 'カードの評価は、比較の欄と同じ字（平均・「n件の評価」）── 材料は、この検査が行から数え直した {avg, fill, n, text}・描かれた字にも在る（比較 →「カードを保存」）',
      J({ calm, lr, card: m && m.cards.map((c) => c.rating), want }));
    await shot(page, '#crc-root canvas', 'card-two-rated');
  }

  /* (b) カードが先・返事が後：カードを直接開き、口コミの返事を止めたまま「画像を保存」→ 見本のまま（評価の行なし）。返事が届けば描き直す */
  {
    const { page, st } = await open('pc', { url: '/career.html?view=card&a=jal&b=ana', stub: { pv_reviews: () => 'hold' }, before: CARD_BEFORE });
    const up = await cardUp(page, 2);
    const held = await waitFor(() => (st.held.pv_reviews || []).length >= 2);
    const m0 = await cardModel(page), d0 = await drawnAttr(page);
    await page.click(SAVE);
    const s1 = await page.waitForFunction(() => (window.__saved || []).length === 1, { timeout: 8000 }).then(() => true, () => false);
    const saved1 = await page.evaluate(() => (window.__saved || [])[0] || null);
    ok(up && held && !!m0 && m0.cards.every((c) => c.rating === null) && !!d0 && s1 && !!saved1 && saved1.blob
      && saved1.text.length > 0 && !saved1.text.some((t) => t.includes('件の評価')),
      'カードを直接開き、口コミの返事を止めたまま：評価なしで描かれ、「画像を保存」はその見本のまま（「件の評価」の字が1つも無い）── 保存は返事を待たない',
      J({ up, held, ratings: m0 && m0.cards.map((c) => c.rating), drawn: d0, saved: saved1 && { n: saved1.text.length, blob: saved1.blob } }));
    releaseAll(st, (name, p) => rateStub().pv_reviews(p));
    const m1 = await cardRated(page, 2), d1 = await drawnAttr(page);
    await page.click(SAVE);
    const s2 = await page.waitForFunction(() => (window.__saved || []).length === 2, { timeout: 8000 }).then(() => true, () => false);
    const saved2 = await page.evaluate(() => (window.__saved || [])[1] || null);
    ok(!!m1 && d1 !== d0 && s2 && !!saved2 && m1.cards.every((c) => saved2.text.includes(c.rating.text)),
      '返事が届くと描き直され（data-drawn が替わる）、次の「画像を保存」には評価の行が入る',
      J({ d0, d1, ratings: m1 && m1.cards.map((c) => c.rating), saved: !!saved2 }));
  }

  /* (c) 点数の付いた投稿が無い会社（エバー航空）は、評価の行を描かない（0 で埋めない）。もう一方（JAL）は描く */
  {
    const { page } = await open('pc', { url: '/career.html?view=card&a=jal&b=eva-air', stub: rateStub(), before: CARD_BEFORE });
    const up = await cardUp(page, 2);
    const one = up && await page.waitForFunction(() => { const m = window.PVCareerCard.model(); return !!(m && m.cards[0].rating); }, { timeout: 8000 })
      .then(() => true, () => false);
    await calmCard(page);
    const m = await cardModel(page), drawn = await drawnText(page);
    const axis = new Set(((m && m.cards) || []).flatMap((c) => c.axis || []));
    const counts = drawn.filter((t) => t.includes('件の評価'));
    const zero = drawn.filter((t) => !axis.has(t) && /^(0|0\.0|0件の評価)$/.test(t));
    ok(one && !!m && m.cards[1].slug === 'eva-air' && m.cards[1].rating === null && !!m.cards[0].rating
      && counts.length > 0 && counts.every((t) => t === m.cards[0].rating.text) && !zero.length,
      '点数の付いた投稿が無い会社（エバー航空）は評価の行を描かない ── 材料は null・描かれた「件の評価」は JAL の1つだけ・「0」「0.0」を描かない（目盛の字のほか）',
      J({ one, ratings: m && m.cards.map((c) => c.rating), counts: [...new Set(counts)], zero }));
    await shot(page, '#crc-root canvas', 'card-one-side');
  }

  /* (d) 口コミが読めない会社（500）：評価なしで描かれ、保存も効く。写真を5回替えても聞き直さない。カードの画面を開き直したら、もう1回だけ聞く */
  {
    const { page, st } = await open('pc', { url: `/career.html?view=card&a=${RATE_FAIL}`, stub: rateStub(), before: CARD_BEFORE });
    const up = await cardUp(page, 1);
    const asked = await waitFor(() => callsOf(st, 'pv_reviews', RATE_FAIL) >= 1);
    await calmCard(page);
    const m = await cardModel(page);
    await page.click(SAVE);
    const s1 = await page.waitForFunction(() => (window.__saved || []).length === 1 && window.__saved[0].blob, { timeout: 8000 }).then(() => true, () => false);
    ok(up && asked && !!m && m.cards[0].rating === null && s1, '口コミが読めない会社（500）：評価なしで描かれ、「画像を保存」も効く',
      J({ up, asked, rating: m && m.cards[0].rating, saved: s1 }));
    let taps = 0;
    for (let k = 0; k < 5; k++) {
      const was = await drawnAttr(page);
      await page.evaluate((k) => { const th = document.querySelectorAll('#crc-root .crc-ph')[0].querySelectorAll('.crc-th'); th[k % th.length].click(); }, k);
      if (await page.waitForFunction((was) => document.getElementById('crc-root').getAttribute('data-drawn') !== was, { timeout: 8000 }, was)
        .then(() => true, () => false)) taps++;
    }
    await frames(page);
    const after5 = callsOf(st, 'pv_reviews', RATE_FAIL);
    ok(taps === 5 && after5 === 1, '写真を5回替えても（描き直し5回）、その会社の口コミの要求は1本のまま（落ちても、開き直すまで聞き直さない）',
      J({ taps, requests: after5 }));
    await page.evaluate(() => window.PVCareer.go({ view: 'compare', a: 'jal', b: 'ana' }));
    await page.evaluate((s) => window.PVCareer.go({ view: 'card', a: s }), RATE_FAIL);
    const again = await waitFor(() => callsOf(st, 'pv_reviews', RATE_FAIL) >= 2);
    await calmCard(page);
    ok(again && callsOf(st, 'pv_reviews', RATE_FAIL) === 2, 'カードの画面を離れて開き直すと、もう1回だけ聞く（2本目）',
      String(callsOf(st, 'pv_reviews', RATE_FAIL)));
  }
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
