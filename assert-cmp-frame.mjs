/* ══════════════════════════════════════════════════════════════════
   assert-cmp-frame.mjs — 比較の枠（career.html?view=compare と、同じ部品が動く会社ページ）の場面（2026-10-22）

   守っているもの（比較の枠：待ちの上限・切り替えの取り違え・片側の失敗・戻る・カードの評価・画像に入れないもの・顔）
     ・待ちの上限（場面 stall）── 返事の来ない読みは、1本ごとの上限（career-live.js の REQ_LIMIT_MS）で「いま読み出せません」と
       「やり直す」になる。上限で切った通信は本当に止める（abort）。自動では聞き直さない（1本のまま）。遅れて届いた返事は画面を変えない。
       「やり直す」で埋まる。会社ページ（airlines/jal.html の評価スコアのカード）も同じ部品なので同じ。
     ・切り替えの取り違え（場面 race）── 読み込みの途中で会社を選び直し・入れ替えても、去った会社の返事（遅れて届いた値も、失敗も）は
       新しい2社の欄に1文字も出ない。
     ・部品の配信元が止まっても（場面 cdn）── supabase-js の読み込みが返ってこなくても、欄は上限で失敗の顔になり、「やり直す」で読み直す。
     ・戻る（場面 back ── 2026-10-23 段階4 cmp-links-card-6）── 比較から会社ページへ出て「戻る」で帰ると（読み込み直したページ）、
       出る前に画面のいちばん上に在った目印（「ほかの街」）が、欄が埋まったあとも同じ高さに在る（会員 c ＝ どの欄も開いた人・
       ゲスト ＝ 錠とログインの顔）。欄が帰ってきたら長くなっていた・上の畳みが閉じていた、でも同じ。読む人が自分で動かしたら合わせ直さない。
       2社を住所ではなく選び直し・入れ替えで並べたあと（隠れた会社の要素の並びが、読み込み直したページと違う）でも同じ（B1s・2026-10-24）。
       段（history.state）に残す箱の高さは、誰が見ても同じ字の顔（career.js の SAME_FACE）の欄だけ ── 開いた欄の高さは 0（LC-A19）。
       ブラウザのスクロールの自動の合わせ（scroll anchoring）は切って見る（overflow-anchor:none ── ページ自身の合わせだけが働く形）。
       段に書く位置（y・目印 k・その高さ t）も、残さない欄を高さ 0 とみなした寸法（2026-10-23 LEAD AMENDMENT「段の k・t」・場面 leak が見る）。
     ・片側だけ読めない（場面 side ── 2026-10-23 段階4 cmp-links-card-7）── 会社ごとに読む比較の欄（ページから数える）のどれも、JAL の読みだけ
       落ちたら ANA の側はそのまま・JAL の列は「いま読み出せません」1回・「やり直す」1つで JAL だけ聞き直す／JAL の口がまだ無ければ「準備中」
       （やり直すも失敗の色も無い）／両方落ちたら今までの欄ごとの失敗の顔。2社を1本で読む欄（提出された年収）は名前を出して除く。
     ・画像に入れないもの（場面 leak）── 1つの文書で、植えた印（口コミの本文・抜粋・要約・提出された年収の額と中央値・会員の回答）を
       全部画面に出してから、カード（2組・5社・2つのデザイン）を描かせる：描いた字にも材料（PVCareerCard.model()）にも印が1つも無い・
       絵は #crc-data の写真だけ。生きた欄の形の字（.crl の中）を推定年収の前に置いても、カードは推定年収のまま（inLive）。
       開いた欄の高さは段（history.state）に届かない（目印より上の欄が長くなっても・線が欄の中で、その欄が下で長くなっても、段は1文字も同じ）。
     ・顔（場面 faces）── 5つの読む人 × 2組・390：欄は上限のうちに読み終わる・公開の箱（推定年収・家賃・公表額のカード・評価）は開いていて
       錠が無い・開いていない欄に一覧や骨が無い（assert-cmp-walk.mjs の顔 a・b と同じ決まり）・口コミの区域の3つの顔・給与の入口は画面に1つ。
     ・門（どの場面も）── 開く画面は全部1つの門を通る。通してよいのは、この検査が起こした手元のサーバーと、部品・書体の配信元（LIBS）だけ。
       ほかの行き先への要求は止めたうえで、その場面ごと赤くする（本番へは1本も出ない）。
   どの場面も、終わりに確かめる：門が止めた外への要求 0・本番の supabase への要求 0・すり抜け 0・自分の担当の呼び出しに全部返事があった。

   実行: node assert-cmp-frame.mjs [--scenes a,b] [--shots <folder>]
     --scenes  場面を選ぶ（stall・race・cdn・rate・back・side・leak・faces）。付けなければ全部
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
   quiet ＝ data-quiet="1"・after ＝ すぐ前の欄の種類・afterState ＝ すぐ前の欄の状態・shown ＝ 見えている「やり直す」の数・h ＝ 欄の高さ */
const cdnFaces = (page) => page.evaluate((ERR, RETRY) => [...document.querySelectorAll('#cr [data-view="compare"] .crl[data-live^="cmp-"]')]
  .filter((b) => b.getClientRects().length).map((b) => {
    const t = b.innerText || '', prev = b.previousElementSibling;
    const rs = [...b.querySelectorAll('.crl-retry')].filter((x) => x.textContent === RETRY);
    return { kind: b.getAttribute('data-live'), quiet: b.getAttribute('data-quiet') === '1', state: b.getAttribute('data-state'),
      after: (prev && prev.getAttribute('data-live')) || '', afterState: (prev && prev.getAttribute('data-state')) || '',
      errs: t.split(ERR).length - 1, retries: rs.length,
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
  await H.choose(page, 'b', 'etihad');
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
     同じ箱で同じ1行を重ねない。やり直しは月の働き方の「やり直す」が全部を聞き直す）。ほかの欄は、どれも失敗の顔で両方が1つずつ見えている。
     口コミの要約の欄（cmp-summary）も同じ形で、同じ強さで次へ移した（cmp-reviews-4 の LEAD の決め・A）：すぐ前の評価の欄（cmp-stars）が
     失敗の顔のとき、そのすぐ下の要約の欄は畳まれる（高さ 0・見える字も見える「やり直す」も無い。やり直しは評価の欄の「やり直す」が聞き直す）。
     畳まれてよいのはこの2つだけ（回答の欄 1・要約の欄 1）。ほかの欄は今までどおり、どれも失敗の顔で両方が1つずつ見えている */
  const F = await cdnFaces(page), quiet = F.filter((f) => f.quiet);
  const sumFold = F.filter((f) => !f.quiet && f.kind === 'cmp-summary' && f.after === 'cmp-stars' && f.afterState === 'error');
  const folded = [...quiet, ...sumFold], loud = F.filter((f) => !folded.includes(f));
  const wkF = F.find((f) => f.kind === 'cmp-work');
  ok(failed > 0 && st.heldUrl.length === 1 && loud.length >= 3
    && loud.every((f) => f.state === 'error' && f.errs === 1 && f.retries === 1 && f.shown === 1)
    && F.filter((f) => f.kind === 'cmp-facts').length === 2 && loud.some((f) => f.kind === 'cmp-facts')
    && !!wkF && wkF.state === 'error' && quiet.length === 1 && sumFold.length === 1
    && quiet.every((f) => f.kind === 'cmp-facts' && f.after === 'cmp-work')
    && folded.every((f) => f.state === 'error' && f.h === 0 && f.text === '' && f.shown === 0),
    `部品の読み込みを止めたまま、見えている欄（${loud.map((f) => f.kind).join('・')}）が全部、${(LIMIT + 5000) / 1000}秒のうちに「${ERR}」と「${RETRY}」になった（${failed}ms）。月の働き方のすぐ下の回答の欄と、評価のすぐ下の要約の欄は畳まれて、字も「${RETRY}」も重ねない`,
    J({ failed, heldUrl: st.heldUrl.length, faces: F.map((f) => `${f.kind}${f.quiet ? '(quiet)' : ''}${sumFold.includes(f) ? '(fold)' : ''}:${f.state}:${f.errs}:${f.retries}:${f.shown}:h${f.h}`) }));
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

/* ══ back ═══════════════════════════════════════════════════════ */
/* 比較（JAL｜ANA・390×680）→ ANA の家賃の箱の「ほかの街」→ 会社ページの暮らしのタブ →「戻る」。
   出る前：「ほかの街」を上の帯のすぐ下（画面のいちばん上の目印）へ動かし、段（history.state）に位置・箱の高さ・目印が書かれるまで待つ。
   離れる：ページに unload の聞き手を置き（手元に置かせない ＝ 戻ると読み込み直す）、window.__left = 1 の印を付けて、リンクを本当に押す。
   戻る：goBack。どちらが起きたかを先に確かめる ── 印が消えていて pageshow の persisted が false ＝ 読み込み直したページ。
   戻ったページの返事は全部止めておき（欄は「読み込み中」のまま）、画面が出る動き（.cr-view の translateY）が終わってから「すぐ」を測る。
   それから返事を流し、欄が全部落ち着いて（SETTLED）から「あと」を測る。
   ⚠️ どの回も、ブラウザが自分でスクロールを合わせる働き（scroll anchoring）を切る（<html> に overflow-anchor:none ── Safari のように
   自分では合わせないブラウザの形）。ページ自身の合わせ（career.js の restore／align）だけが働くので、それが無いと赤くなる。
   ⚠️ 手元から戻る（back-forward cache）回は、この検査では起きない（要求を横取りすると、ブラウザは手元に置かない ── P12.36）。
   その回は歩く検査（assert-cmp-walk.mjs）の持ち分（LC-A8）。 */
const SAME_SHEET = 'locked|login|give|few|empty|off|error';    // 比較の設計（LC-A19）の一覧。製品の SAME_FACE と1字も違わない
const SAME_RE = new RegExp(`^(${SAME_SHEET})$`);
const SAME_SRC = (read('career.js').match(/\n {4}var SAME_FACE = \/\^\((.+?)\)\$\/;\n/) || [])[1] || null;
const LIVE = '#cr [data-view="compare"] .crl[data-live]';
const BACK_AT = '#cr .cr-rentb[data-airline="ana"] .cr-rentb-go a';         // ANA の「ほかの街」（目印）
const BACK_FOLD = '#cr .cr-rentb[data-airline="jal"] details.cr-more';      // JAL の「前提と出典」（390px では ANA の箱の上）
const BACK_HOLD = [...H.MINE, 'pv_pay_rows', 'pv_company_pay'];
/* 住所ではなく選び直しで JAL｜ANA に着く道（★2026-10-24 段階4 cmp-links-card-8・LEAD'S WORD S1）：キャセイ｜JAL を住所で開き →
   入れ替え（JAL｜キャセイ）→ B に ANA。pair() は選んだ2社の要素を箱の中で動かすので、隠れたキャセイの要素は JAL の前に残る
   （住所で開いた JAL｜ANA ＝ 読み込み直したページでは、HTML の順のまま JAL・ANA の後ろ）。目印を画面の通し番号で覚えると、
   戻ったページで別の要素を指す ── 歩く検査（assert-cmp-walk.mjs）のエバー → JAL で見つけた形 */
const BACK_VIA = {
  url: PAIR(CX, 'jal'),
  go: async (page) => {
    await page.click('#cr-swap');
    await page.waitForFunction(() => location.search === '?view=compare&a=jal&b=cathay-pacific', { timeout: 8000 });
    await H.choose(page, 'b', 'ana');
    return page.waitForFunction(() => location.search === '?view=compare&a=jal&b=ana', { timeout: 8000 }).then(() => true, () => false);
  },
};
/* 家賃の箱の並び（data-airline の順・隠れた会社も）。選び直しの道のりが、読み込み直したページと違う並びを作ったかを見る */
const rentOrder = (page) => page.evaluate(() => [...document.querySelectorAll('#cr [data-view="compare"] .cr-rentbs > [data-airline]')]
  .map((e) => e.getAttribute('data-airline') + (e.getClientRects().length ? '' : '·h')).join(' '));
/* ページのどのスクリプトよりも先：pageshow の控え・この段の history.state の写し（前の文書の pagehide が書いたもの）・自動の合わせを切る */
const BACK_BEFORE = () => {
  if (location.pathname !== '/career.html') return;
  window.__ps = [];
  window.addEventListener('pageshow', (e) => { window.__ps.push(!!e.persisted); });
  try { window.__st0 = history.state ? JSON.parse(JSON.stringify(history.state)) : null; } catch (e) { window.__st0 = 'unreadable'; }
  const off = () => { if (!document.documentElement) return false; document.documentElement.style.overflowAnchor = 'none'; return true; };
  if (!off()) new MutationObserver((m, o) => { if (off()) o.disconnect(); }).observe(document, { childList: true });
};
/* 会員 c（どの欄も開いた人）の返事：口コミは鍵あり・要約・月の勤務・会員の回答（聞かれた質問すべて）・提出された年収と中央値 */
const OPEN_REV = {
  jal: [rated('j1', 4, { salary_comment: '検査の口コミ JAL その一' }), rated('j2', 3, { salary_comment: '検査の口コミ JAL その二' }), rated('j3', 5)],
  ana: [rated('a1', 4, { salary_comment: '検査の口コミ ANA その一' }), rated('a2', 5)],
};
const OPEN_SUM = (co) => ({ ok: true, state: 'open', n: 3, as_of: '2026-10-01',
  good: [{ text: `${co} 良い点その一`, cat: 'training' }, { text: `${co} 良い点その二`, cat: 'wlb' }], concern: [{ text: `${co} 気になる点その一`, cat: 'benefits' }] });
const factsAll = (p) => {
  const keys = p && Array.isArray(p.keys) ? p.keys : [];
  return { status: 200, body: { ok: true, state: 'open', facts: keys.map((k) => ({ question_id: k, kind: 'num', median_num: 12, n: 5 })) } };
};
/* jalRows ＝ JAL の機長の行の数・fo ＝ 副操縦士の行（ANA に1つ・JAL に jalFo）を入れるか（B2 だけ false で始める） */
const backOpen = (jalRows = 2, fo = true, jalFo = 0) => ({
  pv_reviews: (p) => {
    const a = p && Array.isArray(p.airlines) ? p.airlines[0] : '';
    return { status: 200, body: { ok: true, unlocked: true, rows: OPEN_REV[a] || [] } };
  },
  pv_review_summary: (p) => ({ status: 200, body: OPEN_SUM(p && p.airline === 'jal' ? 'JAL' : 'ANA') }),
  pv_work_view: workBy(WORK),
  pv_contrib_facts: factsAll,
  pv_pay_rows: () => ({ status: 200, body: H.payFix.open([...Array.from({ length: jalRows }, () => H.payRowFix('jal')), ...Array.from({ length: jalFo }, () => H.payRowFix('jal', { pos: 'fo' }))],
    fo ? [H.payRowFix('ana'), H.payRowFix('ana', { pos: 'fo' })] : [H.payRowFix('ana')]) }),
  pv_company_pay: () => ({ status: 200, body: { ok: true, state: 'open', period: { from: '2024-10', to: '2026-09' }, floor: 3,
    airlines: { jal: { cap: { s: 'few' }, fo: { s: 'few' } }, ana: { cap: { s: 'few' }, fo: { s: 'few' } } } } }),
});
/* ゲストの返事：口コミ0件・要約／月の勤務／会員の回答はログインの顔・提出された年収は伏せた行（会社・出典・時期だけ） */
const BACK_GUEST = {
  pv_reviews: () => ({ status: 200, body: { ok: true, unlocked: false, rows: [] } }),
  pv_review_summary: () => ({ status: 200, body: { ok: true, state: 'login' } }),
  pv_work_view: () => ({ status: 200, body: { ok: true, state: 'login' } }),
  pv_contrib_facts: () => ({ status: 200, body: { ok: true, state: 'login' } }),
  pv_pay_rows: () => ({ status: 200, body: H.payFix.guest([H.payRowFix('jal')], [H.payRowFix('ana')]) }),
};
const answerBy = (st) => (name, p) => { const s = st.stub[name]; return typeof s === 'function' ? s(p, null) : s; };
/* 段の y の決まり（この検査の言葉・2026-10-23 LEAD AMENDMENT「段の k・t」）：いまの位置から、上の帯の線より上に在る
   「残さない欄」（誰が見ても同じ字の顔でない欄・片側だけの欄）の高さを引いた数（整数）。残さない欄の無い人は、いまの位置そのもの。
   ページで流す（window.__flatY として置いてから呼ぶ） */
const FLAT_Y = (sel, same) => {
  const re = new RegExp(`^(${same})$`), bar = document.querySelector('.mr-top'), e = bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
  let hid = 0;
  for (const b of document.querySelectorAll(sel)) {
    if ((re.test(b.getAttribute('data-state') || '') && !b.hasAttribute('data-part')) || (b.parentElement && b.parentElement.closest('.crl[data-live]'))) continue;
    const r = b.getBoundingClientRect();
    hid += Math.max(0, Math.min(e, r.bottom) - r.top);
  }
  return Math.round(window.scrollY - hid);
};
const boxesOf = (page) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((b) => ({ kind: b.getAttribute('data-live'),
  state: b.getAttribute('data-state'), part: b.hasAttribute('data-part'), h: b.offsetHeight, mh: b.style.minHeight })), LIVE);
const topOf = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top : null; };
const yOf = () => window.scrollY;
/* 2コマ続けて同じ値になるまで読む（測る値が動きの途中でないこと） */
const steady = async (page, fn, arg) => {
  let a = await page.evaluate(fn, arg);
  for (let i = 0; i < 40; i++) {
    await frames(page);
    const b = await page.evaluate(fn, arg);
    if (b === a) return b;
    a = b;
  }
  return a;
};
/* 見ている画面そのものが出る動き（.cr-view の cr-in）が終わるまで。読み込み中の骨組みの明滅は終わらないので、そちらは待たない */
const viewStill = (page) => page.evaluate(async () => {
  const v = document.querySelector('#cr .cr-view:not([hidden])');
  if (v) await Promise.all(v.getAnimations().map((a) => a.finished.catch(() => {})));
});
/* このページが送った関数の呼び出しのうち、まだ終わっていないもの */
function inflight(page) {
  const live = new Set();
  page.on('request', (r) => { if (/\/rest\/v1\/rpc\//.test(r.url())) live.add(r); });
  page.on('requestfinished', (r) => live.delete(r));
  page.on('requestfailed', (r) => live.delete(r));
  return live;
}
/* SETTLED：見えている比較の欄が全部 JAL｜ANA について読み終わり、止めた返事も届いていない呼び出しも無く、画面の動きが終わった */
const calm = async (page, st, live) => {
  const s = await settled(page, 'jal|ana', 15000);
  const q = await waitFor(() => !Object.values(st.held).some((x) => x.length) && live.size === 0, 15000);
  await viewStill(page);
  await frames(page);
  return s && q;
};
async function shotView(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${CUR.key}-${name}.png`) });
}
/* 1回の「出て、戻る」。away ＝ 離れているあいだに返事を変える（B2）・fold ＝ 目印より上の畳みを開いてから離れる（B3）・
   wheel ＝ 戻ったあと、返事を流す前にホイールで動かす（B5）・via ＝ 住所ではなく選び直しで JAL｜ANA に着く（B1s・BACK_VIA）。
   返すのは測った値（判定は場面の側） */
async function backLeg(name, { who = null, stub, away = null, fold = false, wheel = false, shots = false, via = null }) {
  const HOLD = { on: true };
  const { page, st } = await open('sp', { who, url: via ? via.url : PAIR('jal', 'ana'), before: BACK_BEFORE, stub, holdIf: (n) => HOLD.on && BACK_HOLD.includes(n) });
  const live = inflight(page);
  const R = { name };
  /* 1枚目：返事を止めたまま（読み込み中の高さ）→ 流す → 落ち着いた高さ */
  R.loading = await page.waitForFunction((sel) => {
    const all = [...document.querySelectorAll(sel)];
    return all.length > 0 && all.every((b) => ['idle', 'loading'].includes(b.getAttribute('data-state')))
      && all.some((b) => b.getAttribute('data-state') === 'loading');
  }, { timeout: 15000, polling: 50 }, LIVE).then(() => true, () => false);
  R.hLoad = (await boxesOf(page)).reduce((n, b) => n + b.h, 0);
  HOLD.on = false;
  releaseAll(st, answerBy(st));
  if (via) R.via = await via.go(page);
  R.calm1 = await calm(page, st, live);
  R.hFill = (await boxesOf(page)).reduce((n, b) => n + b.h, 0);
  if (fold) {
    const fh = () => page.evaluate((s) => { const d = document.querySelector(s); return d ? d.getBoundingClientRect().height : 0; }, BACK_FOLD);
    const closed = await fh();
    await page.click(`${BACK_FOLD} > summary`);
    await frames(page);
    R.foldOpen = await page.evaluate((s) => { const d = document.querySelector(s); return !!d && d.open; }, BACK_FOLD);
    R.foldH = Math.round((await fh()) - closed);
  }
  /* 目印：「ほかの街」を上の帯のすぐ下へ。段が書かれるまで待つ（動かす前に段を空にして、動かしたあとに書かれた段だけを見る）。
     段の y は、残さない欄（誰が見ても同じ字の顔でない欄）の高さを除いた位置（FLAT_Y ── 2026-10-23 LEAD AMENDMENT「段の k・t」）。
     前の決まり「y ＝ いまの位置」は、同じ強さで次へ移した（X0）：残さない欄の無い人（ゲスト）は今までどおり いまの位置そのもの */
  await page.evaluate((s) => {
    const bar = document.querySelector('.mr-top'), e = bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
    history.replaceState(null, '', location.href);
    window.scrollTo(0, Math.round(window.scrollY + document.querySelector(s).getBoundingClientRect().top - e - 4));
  }, BACK_AT);
  await page.evaluate(`window.__flatY = ${FLAT_Y};`);
  R.wrote = await page.waitForFunction((sel, same) => {
    const s = history.state;
    return !!s && s.y === window.__flatY(sel, same) && s.k >= 0 && Array.isArray(s.h) && s.h.length === document.querySelectorAll(sel).length;
  }, { timeout: 8000, polling: 50 }, LIVE, SAME_SHEET).then(() => true, () => false);
  R.flatGap = await page.evaluate(() => window.scrollY - ((history.state && history.state.y) || 0));
  R.top0 = await steady(page, topOf, BACK_AT);
  R.leave = await boxesOf(page);
  R.order0 = await rentOrder(page);
  if (shots) await shotView(page, `${name}-before`);
  /* 離れる（会社ページの返事は止めない）。離れているあいだに返事を変える場面もある */
  if (away) away(st);
  await page.evaluate(() => { window.addEventListener('unload', () => {}); window.__left = 1; });
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click(BACK_AT)]);
  R.life = await page.waitForFunction(() => !!window.PVGlance && window.PVGlance.at() === 'life', { timeout: 15000 }).then(() => true, () => false);
  R.lifeAt = await page.evaluate(() => location.pathname + location.hash);
  /* 戻る（戻ったページの返事は全部止める） */
  for (const k of Object.keys(st.held)) st.held[k] = [];
  HOLD.on = true;
  await page.goBack({ waitUntil: 'load' });
  /* 2社は札に見えている会社で読む（★2026-10-25 段階5 compare-all-3：選ぶ欄は無くなり、選ぶ面で選ぶ） */
  R.fresh = await page.evaluate(() => {
    const plate = (sd) => { const o = document.querySelector(`#cr .cr-side[data-side="${sd}"] .cr-opt:not([hidden])`); return o ? o.dataset.airline : undefined; };
    return { left: window.__left === undefined ? null : window.__left, ps: (window.__ps || []).slice(), st0: window.__st0,
      search: location.search, a: plate('a'), b: plate('b') };
  });
  R.reloaded = R.fresh.left === null && R.fresh.ps.length > 0 && R.fresh.ps.every((x) => x === false);
  await viewStill(page);
  R.order1 = await rentOrder(page);
  R.now = await boxesOf(page);
  R.stillLoading = R.now.length > 0 && R.now.every((b) => ['idle', 'loading'].includes(b.state));
  R.topNow = await steady(page, topOf, BACK_AT);
  if (shots) await shotView(page, `${name}-loading`);
  if (wheel) {
    await page.mouse.move(195, 420);
    await page.mouse.wheel({ deltaY: 200 });
    R.y1 = await steady(page, yOf);
  }
  HOLD.on = false;
  releaseAll(st, answerBy(st));
  R.calm2 = await calm(page, st, live);
  R.topAfter = await steady(page, topOf, BACK_AT);
  R.yAfter = await steady(page, yOf);
  R.after = await boxesOf(page);
  if (fold) R.foldNow = await page.evaluate((s) => { const d = document.querySelector(s); return !!d && d.open; }, BACK_FOLD);
  if (shots) await shotView(page, `${name}-filled`);
  return R;
}
const px = (v) => (v == null ? 'null' : `${Math.round(v * 10) / 10}`);
const legNote = (R) => J({ wrote: R.wrote, flatGap: R.flatGap, life: R.life, at: R.lifeAt, fresh: R.fresh && { ...R.fresh, st0: undefined }, reloaded: R.reloaded,
  top0: R.top0, topNow: R.topNow, topAfter: R.topAfter, calm: [R.calm1, R.calm2], now: (R.now || []).map((b) => `${b.kind}:${b.state}:${b.mh || '-'}`),
  after: (R.after || []).map((b) => `${b.kind}:${b.state}:${b.h}:${b.mh || '-'}`) });
const sameAddr = (R) => R.wrote && R.life && R.lifeAt === '/airlines/ana.html#life' && R.reloaded
  && R.fresh.search === '?view=compare&a=jal&b=ana' && R.fresh.a === 'jal' && R.fresh.b === 'ana';

scene('back', '比較 →「ほかの街」→ 会社ページ →「戻る」：出る前のいちばん上の目印が、欄が埋まったあとも同じ高さ・段に残す高さは誰が見ても同じ顔の欄だけ', async () => {
  /* ★LC-A19（ファイルの半分）：段に高さを残す顔の一覧は、設計の一覧そのもの。開いた顔・途中の顔は入っていない */
  ok(SAME_SRC === SAME_SHEET && !SAME_RE.test('open') && !SAME_RE.test('idle') && !SAME_RE.test('loading'),
    `★段に高さを残す顔の一覧（career.js の SAME_FACE）は、比較の設計の一覧と1字も違わない（${SAME_SHEET}）── 開いた顔（open）・途中の顔は入っていない`,
    J({ SAME_SRC }));

  /* B1 会員 c（どの欄も開いた人）：前提（埋まると十分長くなる）→ 出て戻る → 落ち着いたあとの目印 */
  const c = await backLeg('c', { who: 'c', stub: backOpen(), shots: true });
  const grow = c.hFill - c.hLoad;
  ok(c.loading && c.calm1 && grow > 100,
    grow > 100 ? `（前提）欄が埋まると、読み込み中より ${grow}px 長い（100px より大きい ── 高さも目印も合わせなければ、この場面は赤くなる）`
      : `（前提）この場面は落ちることができない（欄が埋まっても ${grow}px しか長くならない）`, J({ loading: c.loading, calm1: c.calm1, hLoad: c.hLoad, hFill: c.hFill }));
  if (!(c.loading && c.calm1 && grow > 100)) return;
  ok(sameAddr(c), 'B1 会員 c：「ほかの街」→ 会社ページの暮らしのタブ →「戻る」は、読み込み直したページ（離れる前の印が無い・pageshow の persisted は false）で、同じ住所・同じ2社',
    legNote(c));
  console.log(`  ・B1 会員 c：戻った直後（欄は${c.stillLoading ? '全部読み込み中' : 'もう読み込み中ではない'}・画面の動きのあと）の目印のずれ ${px(c.topNow - c.top0)}px`
    + '（開いた欄の高さは段に残さないので、ここは目印の合わせだけ ── 数を控えるだけ）');
  ok(c.calm2 && Math.abs(c.topAfter - c.top0) <= 2 && c.after.every((b) => !b.mh),
    `B1 会員 c：欄が全部落ち着いたあと、目印（「ほかの街」）は出る前と同じ高さ（ずれ ${px(c.topAfter - c.top0)}px ≤ 2）・どの欄にも控えの高さ（min-height）が残っていない`,
    legNote(c));
  /* ★LC-A19：会員 c が離れたあとの段（戻った文書の最初に写したもの ＝ 前の文書の pagehide が書いたもの） */
  const hs = c.fresh.st0 && c.fresh.st0.h;
  const pin = Array.isArray(hs) && c.leave.length > 0 && hs.length === c.leave.length
    && c.leave.every((b) => !['idle', 'loading'].includes(b.state)) && c.leave.some((b) => b.state === 'open')
    && c.leave.every((b, i) => (SAME_RE.test(b.state) && !b.part) || hs[i] === 0);
  ok(pin, '★LC-A19 会員 c（どの欄も開いた人）が離れたあとの段：誰が見ても同じ字の顔でない欄（開いた・片側だけ）の高さは全部 0 ── 段に残るのは寸法だけで、受け取った人にしか無い行の数を語る高さは残さない',
    J({ h: hs, at: c.leave.map((b) => `${b.kind}:${b.state}${b.part ? '(part)' : ''}:${b.h}`) }));

  /* B1s 会員 c：住所ではなく選び直しで着いた JAL｜ANA（BACK_VIA）。前提：隠れた会社の要素の並びが、出る前と読み込み直したページで違う
     （同じなら、目印を通し番号で覚えても赤くなれない ── この場面は落ちることができない）。そのうえで B1 と同じ判定 */
  const cs = await backLeg('switched', { who: 'c', stub: backOpen(), via: BACK_VIA, shots: true });
  const moved = cs.via === true && !!cs.order0 && !!cs.order1 && cs.order0 !== cs.order1;
  ok(moved,
    moved ? `B1s（前提）キャセイ｜JAL → 入れ替え → B に ANA で着いた JAL｜ANA は、隠れた会社の要素の並びが読み込み直したページと違う（出る前「${cs.order0}」・戻ったあと「${cs.order1}」）`
      : 'B1s（前提）この場面は落ちることができない ── 選び直しの道のりが、読み込み直したページと違う並びを作らない',
    J({ via: cs.via, order0: cs.order0, order1: cs.order1 }));
  ok(moved && sameAddr(cs) && cs.calm2 && Math.abs(cs.topAfter - cs.top0) <= 2 && cs.after.every((b) => !b.mh),
    `B1s 会員 c：選び直しで着いた JAL｜ANA から「ほかの街」→ 会社ページ →「戻る」（読み込み直したページ）でも、欄が全部落ち着いたあと目印は出る前と同じ高さ（ずれ ${px(cs.topAfter - cs.top0)}px ≤ 2）── 目印は画面の通し番号でなく、会社とその会社の中の番号で覚える`,
    legNote(cs));

  /* B2 会員 c：離れているあいだに、目印より上の提出された年収の欄に JAL の行が1つ増える */
  /* ★2026-10-29：1件ずつの行は閉じた畳みの中 ＝ 行が増えても欄は伸びない。伸びるのは「昇格後の年数ごとの図」に職位が1つ増えたとき
     （副操縦士の行が2社とも無い → 離れているあいだに JAL に1つ来た）── 目印より上が長くなる、は同じ */
  const c2 = await backLeg('taller', { who: 'c', stub: backOpen(2, false), away: (st) => { st.stub.pv_pay_rows = backOpen(3, false, 1).pv_pay_rows; } });
  const payH = (L) => ((L || []).find((b) => b.kind === 'cmp-pay') || {}).h;
  ok(sameAddr(c2) && c2.calm2 && payH(c2.after) > payH(c2.leave) && Math.abs(c2.topAfter - c2.top0) <= 2,
    `B2 会員 c：離れているあいだに目印より上の欄（提出された年収）が長くなって帰ってきても（${payH(c2.leave)} → ${payH(c2.after)}px）、落ち着いたあと目印は同じ高さ（ずれ ${px(c2.topAfter - c2.top0)}px ≤ 2）`,
    legNote(c2));

  /* B3 会員 c：目印より上の JAL の「前提と出典」を開いたまま離れる → 戻ると閉じている（上が短い） */
  const c3 = await backLeg('fold', { who: 'c', stub: backOpen(), fold: true });
  console.log(`  ・B3 会員 c：戻った直後（欄は読み込み中）の目印のずれ ${px(c3.topNow - c3.top0)}px（数を控えるだけ）`);
  ok(sameAddr(c3) && c3.foldOpen && c3.foldH > 0 && c3.foldNow === false && c3.calm2 && Math.abs(c3.topAfter - c3.top0) <= 2,
    `B3 会員 c：目印より上の「前提と出典」（JAL の家賃の箱）を開いたまま離れ、戻ると畳みは閉じていて上が ${c3.foldH}px 短い ── 落ち着いたあと目印は同じ高さ（ずれ ${px(c3.topAfter - c3.top0)}px ≤ 2）`,
    J({ foldOpen: c3.foldOpen, foldH: c3.foldH, foldNow: c3.foldNow, note: JSON.parse(legNote(c3)) }));

  /* B5 会員 c：戻ったあと、返事を流す前に読む人がホイールで動かす → もう合わせ直さない */
  const c5 = await backLeg('wheel', { who: 'c', stub: backOpen(), wheel: true });
  ok(sameAddr(c5) && c5.calm2 && c5.yAfter === c5.y1,
    `B5 会員 c：戻ったあと、欄が埋まる前に読む人がホイールで動かすと、ページはもう合わせ直さない（欄が埋まったあとも ${c5.y1} のまま ── 読む人が動かしたら、合わせ直さない）`,
    J({ y1: c5.y1, yAfter: c5.yAfter, note: JSON.parse(legNote(c5)) }));

  /* B1g ゲスト：錠・ログイン・空の顔は、出る前の高さで置かれる（すぐ・あと） */
  const g = await backLeg('guest', { stub: BACK_GUEST, shots: true });
  const gh = g.fresh.st0 && g.fresh.st0.h;
  const kept = Array.isArray(gh) && g.leave.length > 0 && gh.length === g.leave.length
    && g.leave.every((b, i) => ((SAME_RE.test(b.state) && !b.part) ? gh[i] === b.h : gh[i] === 0)) && gh.some((x) => x > 0)
    && g.now.length === gh.length && g.now.every((b, i) => (gh[i] > 0 ? b.mh === `${gh[i]}px` : !b.mh));
  ok(sameAddr(g) && g.stillLoading && kept && Math.abs(g.topNow - g.top0) <= 2,
    `B1g ゲスト：戻った直後（欄は全部読み込み中）── 錠・ログイン・空の顔の欄は出る前の高さで置かれ（min-height ＝ 段の高さ）、目印（「ほかの街」）は出る前と同じ高さ（ずれ ${px(g.topNow - g.top0)}px ≤ 2）`,
    J({ h: gh, leave: g.leave.map((b) => `${b.kind}:${b.state}:${b.h}`), note: JSON.parse(legNote(g)) }));
  ok(g.calm2 && Math.abs(g.topAfter - g.top0) <= 2 && g.after.every((b) => !b.mh),
    `B1g ゲスト：欄が全部落ち着いたあとも、目印は同じ高さ（ずれ ${px(g.topAfter - g.top0)}px ≤ 2）・控えの高さは外れている`, legNote(g));
});

/* ══ side ═══════════════════════════════════════════════════════ */
/* 会員 c（どの欄も開いた人）・JAL｜ANA・1440。会社ごとに読む比較の欄（data-live が cmp- で始まる種類 ── ページから数える）ごとに：
     JAL の読みだけ 500     → B-1 ANA の側は何も起きなかったように描かれる（ANA の値が在り、ANA の列に「いま読み出せません」が無い）
                              B-2 JAL の列は「いま読み出せません」1回だけ ── 数字・「未取得」・「集計なし」・「まだ集計がありません」・
                                  「口コミはまだありません」・「会員からの投稿はまだありません」・錠の1行が無い
                              B-3 欄に「やり直す」が1つ（data-part 1）。押すと JAL だけをもう1回聞き（ANA の要求の数は増えない）、両方が描かれる
     JAL の読みだけ 404 PGRST202（口がまだ無い）→ B-4 JAL の列は「準備中」・「やり直す」なし・失敗の色（.crl-side-err）なし
     両方 500               → B-5 今までの欄ごとの失敗の顔（error・「いま読み出せません」と「やり直す」が1つずつ）
   除く種類は行に名前を出す：2社を1本で読む種類（提出された年収 cmp-pay）と、B-4 だけ除く口コミの評価（cmp-stars ── 行は review-i18n.js の
   fetchRows が読み、どの失敗も「読めない」と答える＝口が無いことを見分けない。pv_reviews は2社で同じ1つの関数）。 */
const SIDE_FACTS = { jal: 37, ana: 64 };                  // 待遇の答え（中央値）。JAL と ANA で違う数
const factsBy = (map) => (p) => {
  const keys = p && Array.isArray(p.keys) ? p.keys : [], v = map[p && p.airline];
  return { status: 200, body: { ok: true, state: 'open', facts: keys.map((k) => ({ question_id: k, kind: 'num', median_num: v, n: 5 })) } };
};
const coOf = (p) => (p && Array.isArray(p.airlines) ? p.airlines[0] : (p && p.airline)) || '';
/* 種類ごと：読む関数・JAL と ANA の値（その列に在るはずの字）・口が無いことを見分けるか */
const SIDE = [
  { kind: 'cmp-stars', fn: 'pv_reviews', jal: ['4.0', '3件の評価'], ana: ['4.5', '2件の評価'], off: false },
  { kind: 'cmp-summary', fn: 'pv_review_summary', jal: ['JAL 良い点その一'], ana: ['ANA 良い点その一'], off: true },
  { kind: 'cmp-work', fn: 'pv_work_view', jal: ['70〜80'], ana: ['50〜55'], off: true },
  { kind: 'cmp-facts', fn: 'pv_contrib_facts', jal: ['37'], ana: ['64'], off: true },
];
const SIDE_EXEMPT = { 'cmp-pay': '提出された年収（pv_pay_rows と pv_company_pay は2社で1本の読み）' };
const ZERO_WORDS = ['未取得', '集計なし', 'まだ集計がありません', '口コミはまだありません', '会員からの投稿はまだありません'];
const OFF = '準備中';
const PGRST202 = (fn) => ({ status: 404, body: { code: 'PGRST202', details: null, hint: null, message: `Could not find the function public.${fn}` } });
const sideStub = (K, mode) => {
  const base = { ...backOpen(), pv_contrib_facts: factsBy(SIDE_FACTS) };
  const good = base[K.fn];
  base[K.fn] = (p, a) => {
    const co = coOf(p);
    if (mode === 'both500' || (mode === 'jal500' && co === 'jal')) return CX_FAIL();
    if (mode === 'jal404' && co === 'jal') return PGRST202(K.fn);
    return good(p, a);
  };
  return base;
};
/* その種類の欄（全部・要素ごと）の顔と、会社ごとの列（2列の格子 ＝ .crl-cmp-row / .crl-cmp-sub のマス・要約 ＝ .crl-sum2-c・
   上下に並べた形 ＝ .crl-split-c[data-airline]）。列の字は見えている字（innerText） */
const sideFaces = (page, kind) => page.evaluate((kind, ERR, RETRY) => [...document.querySelectorAll(`#cr [data-view="compare"] .crl[data-live="${kind}"]`)].map((x) => {
  const els = [[], []];
  const split = [...x.querySelectorAll('.crl-split-c[data-airline]')];
  if (split.length) split.forEach((c) => { const i = ['jal', 'ana'].indexOf(c.getAttribute('data-airline')); if (i >= 0) els[i].push(c); });
  else {
    x.querySelectorAll('.crl-cmp-row, .crl-cmp-sub').forEach((r) => {
      const cs = [...r.children].filter((c) => c.matches('.crl-cmp-c, .crl-cmp-sc'));
      if (cs.length === 2) { els[0].push(cs[0]); els[1].push(cs[1]); }
    });
    x.querySelectorAll('.crl-sum2-c[data-col]').forEach((c) => { const i = Number(c.getAttribute('data-col')) - 1; if (i === 0 || i === 1) els[i].push(c); });
  }
  const col = (list) => {
    const text = list.map((c) => c.innerText).join(' ').replace(/\s+/g, ' ').trim();
    return { n: list.length, text, errs: text.split(ERR).length - 1, locks: list.reduce((n, c) => n + c.querySelectorAll('.crl-lock').length, 0),
      sideErr: list.reduce((n, c) => n + c.querySelectorAll('.crl-side-err').length, 0) };
  };
  const t = x.innerText || '';
  return { quiet: x.getAttribute('data-quiet') === '1', state: x.getAttribute('data-state'), for: x.getAttribute('data-for'), part: x.getAttribute('data-part'),
    shown: x.getClientRects().length > 0 && x.getBoundingClientRect().height > 1, errs: t.split(ERR).length - 1,
    retries: [...x.querySelectorAll('.crl-retry')].filter((b) => b.textContent === RETRY).length, sideErr: x.querySelectorAll('.crl-side-err').length,
    cols: [col(els[0]), col(els[1])], text: t.replace(/\s+/g, ' ').trim().slice(0, 200) };
}), kind, ERR, RETRY);
const has = (text, vals) => vals.every((v) => String(text).includes(v));
const sideNote = (F) => J(F.map((f) => ({ q: f.quiet, state: f.state, part: f.part, errs: f.errs, retries: f.retries, sideErr: f.sideErr,
  jal: f.cols[0].text.slice(0, 90), ana: f.cols[1].text.slice(0, 90) })));

scene('side', '比較の片側だけ読めない：読めた側はそのまま・読めない側は「いま読み出せません」1回・「やり直す」1つで読めない側だけ聞き直す・口が無い側は「準備中」・両方なら欄ごとの失敗の顔', async () => {
  /* その日のページに在る、会社ごとに読む種類（ページから数える）。表に無い種類が増えたら赤（この場面に足す） */
  {
    const { page } = await open('pc', { who: 'c', url: PAIR('jal', 'ana'), stub: sideStub(SIDE[0], 'none') });
    await settled(page, 'jal|ana', 15000);
    const kinds = [...new Set(await cmpKinds(page))];
    const known = [...SIDE.map((K) => K.kind), ...Object.keys(SIDE_EXEMPT)];
    ok(kinds.length > 0 && kinds.every((k) => known.includes(k)) && SIDE.every((K) => kinds.includes(K.kind)),
      `その日の比較の会社ごとの欄（${kinds.join('・')}）を全部見る ── 除くのは ${Object.entries(SIDE_EXEMPT).map(([k, v]) => `${k}（${v}）`).join('・')}`,
      J({ kinds, known }));
  }
  for (const K of SIDE) {
    /* JAL の読みだけ 500 */
    const A = await open('pc', { who: 'c', url: PAIR('jal', 'ana'), stub: sideStub(K, 'jal500') });
    const s1 = await settled(A.page, 'jal|ana', 15000);
    const F1 = (await sideFaces(A.page, K.kind)).filter((f) => f.shown);
    ok(s1 && F1.length >= 1 && F1.every((f) => f.state === 'open' && f.part === '1' && has(f.cols[1].text, K.ana) && f.cols[1].errs === 0 && f.cols[1].sideErr === 0),
      `B-1 ${K.kind}：JAL の読み（${K.fn}）だけ 500 → ANA の側はそのまま描かれる（${K.ana.join('・')}・ANA の列に「${ERR}」なし・見えている欄 ${F1.length}つ）`, sideNote(F1));
    ok(F1.length >= 1 && F1.every((f) => f.cols[0].n > 0 && f.cols[0].errs === 1 && f.errs === 1 && !/\d/.test(f.cols[0].text)
      && !ZERO_WORDS.some((w) => f.cols[0].text.includes(w)) && f.cols[0].locks === 0),
      `B-2 ${K.kind}：JAL の列は「${ERR}」を1回だけ（欄にも1回）── 数字・「未取得」などの「無い」の言葉・錠の1行が無い`, sideNote(F1));
    const before = { jal: callsOf(A.st, K.fn, 'jal'), ana: callsOf(A.st, K.fn, 'ana') };
    const one = F1.length >= 1 && F1.every((f) => f.retries === 1 && f.part === '1');
    A.st.stub[K.fn] = sideStub(K, 'none')[K.fn];
    if (one) await A.page.click(`${CMP(K.kind)}[data-part="1"] .crl-retry`);
    const s3 = one && await settled(A.page, 'jal|ana', 15000);
    const F3 = (await sideFaces(A.page, K.kind)).filter((f) => f.shown);
    const after = { jal: callsOf(A.st, K.fn, 'jal'), ana: callsOf(A.st, K.fn, 'ana') };
    ok(one && s3 && after.jal === before.jal + 1 && after.ana === before.ana && F3.length >= 1
      && F3.every((f) => f.part === null && f.errs === 0 && f.retries === 0 && has(f.cols[0].text, K.jal) && has(f.cols[1].text, K.ana)),
      `B-3 ${K.kind}：欄に「${RETRY}」が1つ（片側だけの印 data-part 1）── 押すと JAL だけをもう1回聞き（JAL ${before.jal} → ${after.jal}本・ANA ${before.ana} → ${after.ana}本）、両方が描かれる`,
      J({ before, after, faces: JSON.parse(sideNote(F3)) }));
    if (K.kind === 'cmp-stars' && SHOTS) {
      await A.page.close();
      for (const size of ['pc', 'sp']) {
        const P = await open(size, { who: 'c', url: PAIR('jal', 'ana'), stub: sideStub(K, 'jal500') });
        await settled(P.page, 'jal|ana', 15000);
        for (const th of ['light', 'dark']) {
          await P.page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), th);
          await frames(P.page);
          await shot(P.page, '#cr [data-view="compare"] .cr-cmp-rev', `stars-jal-fail-${size === 'pc' ? 1440 : 390}-${th}`);
        }
      }
    }

    /* JAL の読みだけ 404 PGRST202（口がまだ無い） */
    if (K.off) {
      const B = await open('pc', { who: 'c', url: PAIR('jal', 'ana'), stub: sideStub(K, 'jal404') });
      const s4 = await settled(B.page, 'jal|ana', 15000);
      const F4 = (await sideFaces(B.page, K.kind)).filter((f) => f.shown);
      ok(s4 && F4.length >= 1 && F4.every((f) => f.cols[0].text.includes(OFF) && f.cols[0].errs === 0 && f.errs === 0 && f.retries === 0
        && f.sideErr === 0 && f.part === null && has(f.cols[1].text, K.ana)),
        `B-4 ${K.kind}：JAL の口（${K.fn}）がまだ無い（404 PGRST202）→ JAL の列は「${OFF}」・「${RETRY}」なし・失敗の色なし（ANA の側はそのまま）`, sideNote(F4));
    } else {
      console.log(`  ・B-4 ${K.kind}：除く ── 口コミの行は review-i18n.js の fetchRows が読み、どの失敗も「読めない」と答える（口が無いことを見分けない。pv_reviews は2社で同じ1つの関数）`);
    }

    /* 両方 500 */
    const C = await open('pc', { who: 'c', url: PAIR('jal', 'ana'), stub: sideStub(K, 'both500') });
    const s5 = await settled(C.page, 'jal|ana', 15000);
    const F5 = (await sideFaces(C.page, K.kind)).filter((f) => f.shown);
    ok(s5 && F5.length >= 1 && F5.every((f) => f.state === 'error' && f.part === null && f.errs === 1 && f.retries === 1),
      `B-5 ${K.kind}：両方 500 → 今までの欄ごとの失敗の顔（「${ERR}」と「${RETRY}」が1つずつ・片側だけの印なし）`, sideNote(F5));
  }
});

/* ══ leak ═══════════════════════════════════════════════════════ */
/* 会員 c。どの読みも「開いた」答えを返し、その答えに印を植える（口コミの本文・抜粋・要約の点・提出された年収の額と中央値・
   会員の回答 ＝ 月の勤務の値と待遇の答え）。1つの文書の中で、エティハドのステイ先の画面1つ・比較 JAL｜ANA とエティハド｜キャセイを
   PVCareer.go で見せる（欄が埋まるのは、その文書で見せた画面だけ）。
   ★2026-10-26 P12.130（WP-compare-all-22 ── 当て直し・同じ強さ）：前は 5社の概要（エティハドは「概要」と「勤務・訓練」のタブ）も見せた。
   会社の概要の画面は無い ── 植えた印は全種類、比較の2組とステイ先で出る（前提の行がそれを確かめる）。カードは全部、比較の行から読む。
   前提：植えた印が全種類、その文書の画面に出た（出なければこの場面は落ちることができない ── 赤で止める）。
   そのあと同じ文書で、カードを JAL｜ANA・エティハド｜キャセイ・5社1社ずつ、2つのデザインで描かせる：
     書き留めた字（fillText / strokeText）に、植えた印・提出された年収の額・中央値・要約や口コミの字・会員の回答の値が1つも無い／
     PVCareerCard.model() にも無い／描いた絵は #crc-data の写真か '(canvas)' だけ。
   inLive：比較の JAL の機長の行の前に、生きた欄の形の行（<div class="crl"><div class="cr-row" data-airline="jal">…ZZ給与ZZ…</div></div>）を
   置いても、カードは推定年収のまま（ZZ を描かない ── ★P12.130 当て直し：前は JAL の概要の推定年収の前に <b data-main="cap">）。
   ★段（history.state）── 2026-10-23 LEAD AMENDMENT「段の k・t」：開いた欄の高さは段に届かない。比較 JAL｜ANA で、
     (a) 目印（ANA の「ほかの街」）より上の開いた欄（提出された年収）が 400px 長くなっても、同じ目印の同じ高さで書かれた段は1文字も同じ
     (b) 上の帯の線が開いた欄（口コミ）の中に在るとき、その欄が線より下で 400px 長くなっても、段は1文字も同じ。
   ホテルの名前は植えない（手元の模擬の返事では、誰がホテルを受け取るかを確かめられない ── LC-A5）。 */
const LEAK = { body: (s) => `ZZ本文-${s}-ZZ`, clip: 'ZZ抜粋-キャセイ-ZZ', sum: (s) => `ZZ要約-${s}-ZZ`, note: 'ZZ補足ZZ', live: 'ZZ給与ZZ' };
const LEAK_WORK = { lo: 83, hi: 89 }, LEAK_WORK_T = '83〜89';
const LEAK_FACT = 41.7, LEAK_FACT_T = '41.7';
/* 提出された年収と中央値に植える額（USD）。画面では有効数字2桁の円（¥6,100万 …）── カードが描く公開の額（推定年収・目盛）と
   同じ字にならない額を選んだ（同じ字だと、描いてよい字と見分けられない。下の行が確かめる） */
const LEAK_PAY = { jal: [383800, 352000], ana: [421500, 396000], etihad: [459300, 478000], 'cathay-pacific': [560000, 434000], 'eva-air': [591400, 522000] };
const LEAK_MED = 528000;
const LEAK_FIVE = ['jal', 'ana', 'cathay-pacific', 'etihad', 'eva-air'];
const LEAK_REV = (s) => (s === CX
  ? [rated('x1', 2, { clip: { k: 'salary', o: LEAK.clip, t: {} } }), rated('x2', 3, { clip: { k: 'salary', o: LEAK.clip, t: {} } })]
  : [rated(s + '1', 4, { salary_comment: `検査の口コミ ${LEAK.body(s)}` }), rated(s + '2', 3, { wlb_comment: `検査の口コミその二 ${LEAK.body(s)}` })]);
const leakStub = () => ({
  pv_reviews: (p) => { const a = coOf(p); return { status: 200, body: { ok: true, unlocked: a !== CX, rows: LEAK_REV(a) } }; },
  pv_review_summary: (p) => ({ status: 200, body: { ok: true, state: 'open', n: 3, as_of: '2026-10-01',
    good: [{ text: `検査の良い点 ${LEAK.sum(coOf(p))}`, cat: 'training' }], concern: [{ text: `検査の気になる点 ${LEAK.sum(coOf(p))}`, cat: 'wlb' }] } }),
  pv_work_view: () => ({ status: 200, body: { ok: true, state: 'open', by: { cap: { block_hours: LEAK_WORK }, fo: { block_hours: LEAK_WORK } } } }),
  pv_contrib_facts: (p) => {
    const keys = p && Array.isArray(p.keys) ? p.keys : [];
    return { status: 200, body: { ok: true, state: 'open', facts: keys.map((k) => ({ question_id: k, kind: 'num', median_num: LEAK_FACT, n: 5 })) } };
  },
  pv_contrib_notes: () => ({ status: 200, body: { ok: true, state: 'open', notes: [{ q: 'staff_travel', text: LEAK.note, mine: false }] } }),
  pv_pay_rows: () => ({ status: 200, body: H.payFix.open(LEAK_FIVE.flatMap((s) => [H.payRowFix(s, { annual_usd: LEAK_PAY[s][0] }),
    H.payRowFix(s, { pos: 'fo', annual_usd: LEAK_PAY[s][1] })]), []) }),
  pv_company_pay: (p) => ({ status: 200, body: { ok: true, state: 'open', period: { from: '2024-10', to: '2026-09' }, floor: 3,
    airlines: Object.fromEntries(((p && p.airlines) || []).map((s) => [s, { cap: { s: 'ok', median_usd: LEAK_MED }, fo: { s: 'few' } }])) } }),
});
/* いま見えている画面に出ている印（見えている字 ＋ 欄の中の額） */
const leakSeen = (page, M) => page.evaluate((M) => {
  const v = document.querySelector('#cr .cr-view:not([hidden])');
  if (!v) return null;
  const vis = (n) => n.getClientRects().length > 0;
  const t = v.innerText || '';
  return {
    view: v.getAttribute('data-view') + (v.getAttribute('data-airline') ? ':' + v.getAttribute('data-airline') : ''),
    body: M.body.filter((x) => t.includes(x)), clip: t.includes(M.clip), sum: M.sum.filter((x) => t.includes(x)),
    work: t.includes(M.work), fact: t.includes(M.fact), note: t.includes(M.note),
    amt: [...v.querySelectorAll('.crl[data-live="cmp-pay"] .crl-amt:not([data-agg]), .crl[data-live="realpay"] .crl-amt')].filter(vis).map((e) => e.textContent.trim()),
    med: [...v.querySelectorAll('.crl[data-live="cmp-pay"] .crl-amt[data-agg]')].filter(vis).map((e) => e.textContent.trim()),
  };
}, M);
/* 見えている画面の生きた欄（ホテルの欄のほか）が全部読み終わるまで */
const viewSettled = (page) => page.waitForFunction(() => {
  const v = document.querySelector('#cr .cr-view:not([hidden])');
  const all = v ? [...v.querySelectorAll('.crl[data-live]:not([data-live="hotels"])')].filter((b) => b.getClientRects().length) : [];
  return !!v && all.every((b) => !['idle', 'loading'].includes(b.getAttribute('data-state')));
}, { timeout: 15000, polling: 100 }).then(() => true, () => false);
const goView = (page, st) => page.evaluate((st) => window.PVCareer.go(st), st);
/* カードの材料がその会社の並びで描かれ、評価の読みも落ち着いた（描き直しまで） */
const cardIs = async (page, slugs) => {
  const up = await page.waitForFunction((want) => {
    const m = window.PVCareerCard && window.PVCareerCard.model && window.PVCareerCard.model();
    const r = document.getElementById('crc-root');
    return !!(m && m.cards && m.cards.map((c) => c.slug).join('|') === want && m.layout && r && r.getAttribute('data-drawn'));
  }, { timeout: 15000, polling: 50 }, slugs.join('|')).then(() => true, () => false);
  await page.evaluate(async (slugs) => {
    await Promise.all(slugs.map((s) => Promise.resolve(window.PVCareer.rating(s)).then(() => 0, () => 0)));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await window.PVCareerCard.redraw();
  }, slugs);
  return up;
};
const themeTo = async (page, word) => {
  const was = await drawnAttr(page);
  const hit = await page.evaluate((w) => {
    const b = [...document.querySelectorAll('#crc-root button')].find((x) => x.textContent.trim() === w);
    if (b) b.click();
    return !!b;
  }, word);
  const moved = hit && await page.waitForFunction((was) => document.getElementById('crc-root').getAttribute('data-drawn') !== was, { timeout: 8000 }, was)
    .then(() => true, () => false);
  await frames(page);
  return moved;
};
/* 段を空にして、目印 sel を上の帯の線から dy の所へ動かし（sel が無ければ動かさない）、新しく書かれた段を待って返す */
const entryAt = async (page, sel, dy) => {
  await page.evaluate((sel, dy) => {
    history.replaceState(null, '', location.href);
    if (sel) {
      const bar = document.querySelector('.mr-top'), e = bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
      window.scrollTo(0, Math.round(window.scrollY + document.querySelector(sel).getBoundingClientRect().top - e - dy));
    }
    window.dispatchEvent(new Event('scroll'));
  }, sel, dy);
  const got = await page.waitForFunction(() => !!history.state && history.state.k >= 0, { timeout: 8000, polling: 50 }).then(() => true, () => false);
  return got ? page.evaluate(() => ({ st: history.state, y: window.scrollY })) : null;
};
const boxAt = (page, kind) => page.evaluate((sel) => { const b = document.querySelector(sel); if (!b) return null; const r = b.getBoundingClientRect();
  return { state: b.getAttribute('data-state'), part: b.hasAttribute('data-part'), top: Math.round(r.top), h: Math.round(r.height) }; }, CMP(kind));
const grow = (page, kind, px) => page.evaluate((sel, px) => {
  const d = document.createElement('div');
  d.setAttribute('data-probe-grow', '');
  d.style.height = px + 'px';
  document.querySelector(sel).appendChild(d);
}, CMP(kind), px);
const unGrow = (page) => page.evaluate(() => { document.querySelectorAll('[data-probe-grow]').forEach((d) => d.remove()); });

scene('leak', 'カードの画像と材料に、生きた欄の中身（口コミの本文・抜粋・要約・提出された年収・会員の回答）が入らない・開いた欄の高さは段（history.state）に届かない', async () => {
  const { page, st } = await open('pc', { who: 'c', url: '/career.html?view=compare&a=jal&b=ana', stub: leakStub(), before: CARD_BEFORE });
  const M = { body: ['jal', 'ana', 'etihad'].map(LEAK.body), clip: LEAK.clip, sum: ['jal', 'ana', 'etihad', CX].map(LEAK.sum), work: LEAK_WORK_T, fact: LEAK_FACT_T, note: LEAK.note };
  const seenAll = { body: new Set(), clip: false, sum: new Set(), work: false, fact: false, note: false, amt: new Set(), med: new Set() };
  const views = [];
  const take = async (label) => {
    const s = await leakSeen(page, M);
    if (!s) return;
    views.push(`${label}${s.body.length || s.clip || s.sum.length || s.work || s.fact || s.amt.length ? '（印あり）' : ''}`);
    s.body.forEach((x) => seenAll.body.add(x)); s.sum.forEach((x) => seenAll.sum.add(x));
    s.amt.forEach((x) => seenAll.amt.add(x)); s.med.forEach((x) => seenAll.med.add(x));
    seenAll.clip = seenAll.clip || s.clip; seenAll.work = seenAll.work || s.work; seenAll.fact = seenAll.fact || s.fact; seenAll.note = seenAll.note || s.note;
  };
  await page.waitForFunction(() => !!(window.PVCareer && window.PVCareer.go), { timeout: 15000 });
  /* エティハドのステイ先 → 比較2組（★P12.130：5社の概要は無い） */
  const stays = await page.evaluate(() => [...document.querySelectorAll('#cr .cr-view[data-view="stay"][data-airline="etihad"]')].map((v) => v.getAttribute('data-stay')));
  if (stays.length) {
    await goView(page, { view: 'stay', airline: 'etihad', stay: stays[0] });
    await viewSettled(page);
    await take(`ステイ先:etihad:${stays[0]}`);
  }
  for (const [a, b] of [['jal', 'ana'], ['etihad', CX]]) {
    await goView(page, { view: 'compare', a, b });
    await settled(page, `${a}|${b}`, 15000);
    await take(`比較:${a}|${b}`);
  }
  const amts = [...seenAll.amt], meds = [...seenAll.med];
  const pre = seenAll.body.size === M.body.length && seenAll.clip && seenAll.sum.size === M.sum.length && seenAll.work && seenAll.fact
    && amts.length > 0 && meds.length > 0 && !!stays.length;
  ok(pre, pre
    ? `（前提）植えた印が全種類、この文書の画面に出た ── 口コミの本文 ${seenAll.body.size}社・抜粋（キャセイ）・要約の点 ${seenAll.sum.size}社・`
      + `提出された年収の額 ${amts.length}種（${amts.join(' ')}）・中央値（${meds.join(' ')}）・会員の回答（月の勤務 ${LEAK_WORK_T}・待遇 ${LEAK_FACT_T}）`
      + `／見せた画面 ${views.length}（${views.join('・')}）`
    : '（前提）この場面は落ちることができない（植えた印が画面に全部は出ていない）',
    J({ body: [...seenAll.body], clip: seenAll.clip, sum: [...seenAll.sum], work: seenAll.work, fact: seenAll.fact, amts, meds, stays, views }));
  console.log('  ・ホテルの名前は W-walk (8) で手元の本物の返事で見る（この場面の模擬の返事にはホテルの印を植えない ── LC-A5）');
  console.log(`  ・会員が書いた補足（自由記述・pv_contrib_notes）は、career.html のどの欄も描かない（data-notes の欄が無い）── 呼ばれた数 ${st.calls.filter((c) => c.name === 'pv_contrib_notes').length}・画面に出た ${seenAll.note ? 'あり' : 'なし'}`);
  if (!pre) return;

  /* カード：2組と5社1社ずつ、2つのデザイン（同じ文書の中で） */
  const models = [], fails = [];
  for (const slugs of [['jal', 'ana'], ['etihad', CX], ...LEAK_FIVE.map((s) => [s])]) {
    await goView(page, { view: 'card', a: slugs[0], b: slugs[1] || null });
    if (!(await cardIs(page, slugs))) { fails.push(`${slugs.join('|')}: 描かれない`); continue; }
    models.push(J(await cardModel(page)));
    for (const w of ['黒×金', 'カラフル']) {
      if (!(await themeTo(page, w))) fails.push(`${slugs.join('|')}: ${w} に替わらない`);
      models.push(J(await cardModel(page)));
    }
  }
  const drawn = await page.evaluate(() => ({ text: (window.__drawn || {}).text.slice(), img: (window.__drawn || {}).img.slice() }));
  const pics = await page.evaluate(() => {
    const out = new Set(['(canvas)']);
    try {
      const D = JSON.parse(document.getElementById('crc-data').textContent);
      for (const a of Object.values(D.airlines || {})) for (const p of a.photos || []) out.add(new URL(p.src, location.href).href);
    } catch (e) { /* 読めなければ写真は0枚 ＝ 下で赤 */ }
    return [...out];
  });
  /* 描いてはいけない字：植えた印（ZZ）・額と中央値の字・要約と口コミの字・会員の回答の値 */
  const words = ['検査の口コミ', '検査の良い点', '検査の気になる点'];
  const bad = (s) => /ZZ/.test(s) || amts.some((a) => s.includes(a)) || meds.some((a) => s.includes(a)) || words.some((w) => s.includes(w))
    || s.includes(LEAK_WORK_T) || s.includes(LEAK_FACT_T);
  const publicFigs = new Set(models.flatMap((j) => (JSON.parse(j).cards || []).flatMap((c) => Object.values(c.roles || {}).map((r) => r.text))));
  ok(!fails.length && models.length === 21 && drawn.text.length > 0 && ![...amts, ...meds].some((a) => publicFigs.has(a)),
    `カードを ${models.length / 3}通り × 2つのデザインで描いた（JAL｜ANA・エティハド｜キャセイ・5社1社ずつ）── 植えた額は、カードの公開の額のどれとも違う字`,
    J({ fails, n: models.length, drawn: drawn.text.length, overlap: [...amts, ...meds].filter((a) => publicFigs.has(a)) }));
  const hitT = drawn.text.filter(bad);
  ok(drawn.text.length > 0 && !hitT.length, `カードに描かれた字（${drawn.text.length}本）に、植えた印・提出された年収の額・中央値・要約と口コミの字・会員の回答の値が1つも無い`,
    hitT.slice(0, 6).join(' ／ '));
  const hitM = models.filter(bad);
  ok(models.length > 0 && !hitM.length, `カードの材料（PVCareerCard.model() を ${models.length}回）にも、どれも無い`, hitM.slice(0, 1).join('').slice(0, 400));
  const badImg = drawn.img.filter((u) => !pics.includes(u));
  ok(drawn.img.length > 0 && !badImg.length, `描いた絵（${drawn.img.length}枚）は #crc-data の写真か '(canvas)' だけ`, badImg.slice(0, 4).join(' ／ '));

  /* inLive：比較の JAL の機長の行（静かな字）の前に、生きた欄の形の ZZ の行を置いても、カードは推定年収のまま
     （★P12.130 当て直し：カードは全社、比較の行を読む ── 前は JAL の概要の推定年収の前に置いた） */
  await goView(page, { view: 'compare', a: 'jal', b: 'ana' });
  const est = await page.evaluate((zz) => {
    const v = document.querySelector('#cr .cr-view[data-view="compare"]');
    const r = v && [...v.querySelectorAll('.cr-pair[data-role="cap"] .cr-row[data-airline="jal"]')].find((x) => !x.closest('.crl'));
    const m = r && r.querySelector('.cr-row-v');
    if (!m) return null;
    const z = document.createElement('div');
    z.className = 'crl';
    const fake = r.cloneNode(true);
    fake.querySelector('.cr-row-v').textContent = zz;
    z.appendChild(fake);
    r.parentElement.insertBefore(z, r);
    return { text: m.textContent.replace(/\s+/g, ' ').trim(), first: v.querySelector('.cr-pair[data-role="cap"] .cr-row[data-airline="jal"] .cr-row-v').textContent };
  }, LEAK.live);
  const n0 = (await page.evaluate(() => window.__drawn.text.length));
  await goView(page, { view: 'card', a: 'jal', b: null });
  const upJ = await cardIs(page, ['jal']);
  const mJ = await cardModel(page);
  const newT = await page.evaluate((n) => window.__drawn.text.slice(n), n0);
  ok(!!est && est.first === LEAK.live && upJ && !!mJ && mJ.cards[0].roles.cap && mJ.cards[0].roles.cap.text === est.text
    && newT.includes(est.text) && !newT.some((s) => s.includes(LEAK.live)) && !J(mJ).includes(LEAK.live),
    `inLive：比較の JAL の機長の行の前に、生きた欄の形（.crl）の行「${LEAK.live}」を置いても、カードは推定年収（${est && est.text}）のまま ── ZZ を描かない・材料にも無い`,
    J({ est, up: upJ, cap: mJ && mJ.cards[0].roles.cap, zz: newT.filter((s) => s.includes('ZZ')) }));

  /* ★段（history.state）：開いた欄の高さは段に届かない（2026-10-23 LEAD AMENDMENT「段の k・t」） */
  await goView(page, { view: 'compare', a: 'jal', b: 'ana' });
  await settled(page, 'jal|ana', 15000);
  await viewStill(page);
  await page.evaluate(() => { const s = document.querySelector('#cr .cr-rentb[data-airline="jal"] details.cr-more'); if (s) s.open = false; });
  /* (a) 目印（ANA の「ほかの街」）より上の、開いた欄（提出された年収）が 400px 長くなる */
  const p0 = await boxAt(page, 'cmp-pay');
  const a1 = await entryAt(page, BACK_AT, 4);
  const t1 = await page.evaluate(topOf, BACK_AT);
  await grow(page, 'cmp-pay', 400);
  const p1 = await boxAt(page, 'cmp-pay');
  const a2 = await entryAt(page, BACK_AT, 4);
  const t2 = await page.evaluate(topOf, BACK_AT);
  await unGrow(page);
  const preA = !!p0 && p0.state === 'open' && !p0.part && !!p1 && p1.h - p0.h === 400 && !!a1 && !!a2 && a2.y - a1.y === 400 && Math.abs(t2 - t1) <= 1;
  ok(preA && J(a1.st) === J(a2.st),
    `★段 (a)：目印（ANA の「ほかの街」）より上の開いた欄（提出された年収）が 400px 長くなっても（いまの位置 ${a1 && a1.y} → ${a2 && a2.y}）、同じ目印の同じ高さで書かれた段は1文字も同じ ── 開いた欄の高さは段に届かない`,
    J({ pre: preA, box: [p0, p1], top: [t1, t2], st: [a1 && a1.st, a2 && a2.st], y: [a1 && a1.y, a2 && a2.y] }));
  /* (b) 上の帯の線が開いた欄（口コミ）の中に在り、その欄が線より下で 400px 長くなる */
  const r0 = await boxAt(page, 'cmp-stars');
  const b1 = await entryAt(page, CMP('cmp-stars'), -120);
  const n1 = await boxAt(page, 'cmp-summary');
  await grow(page, 'cmp-stars', 400);
  const r1 = await boxAt(page, 'cmp-stars');
  const b2 = await entryAt(page, null, 0);
  const n2 = await boxAt(page, 'cmp-summary');
  await unGrow(page);
  const preB = !!r0 && r0.state === 'open' && !r0.part && r0.h > 240 && !!r1 && r1.h - r0.h === 400 && !!b1 && !!b2 && b1.y === b2.y
    && !!n1 && !!n2 && n2.top - n1.top >= 400;
  ok(preB && J(b1.st) === J(b2.st),
    `★段 (b)：上の帯の線が開いた欄（口コミ）の中に在り、その欄が線より下で 400px 長くなっても（すぐ下の欄が ${n1 && n1.top} → ${n2 && n2.top}）、段は1文字も同じ ── 欄の中のどこまで読んでいたかも、欄の高さも段に届かない`,
    J({ pre: preB, box: [r0, r1], next: [n1, n2], st: [b1 && b1.st, b2 && b2.st], y: [b1 && b1.y, b2 && b2.y] }));
});

/* ══ faces ══════════════════════════════════════════════════════ */
/* 読む人5つ（ゲスト・ふつうの会員・給与の鍵が切れた人・空の答えだけの会員 zero・どの読みも落ちる回）× 2組（JAL｜ANA・エティハド｜キャセイ）・390。
   F1 見えている欄は全部、上限 ＋ 5秒のうちに読み終わった顔になる
   F2 公開の箱は開いている：推定年収の行4つ（額あり）・家賃の箱2つ・「会社が公表している金額」のカード2つ（その箱を描く組）・
      評価の点の付いた投稿を返した会社の評価（落ちる回のほか）── どれにも錠の1行が無い
   F3 顔 a・b（assert-cmp-walk.mjs の faces() と1字も違わない写し ── 提出された年収の件数の行の決まり込み）と、口コミの区域の3つの顔
      （data-quiet の欄は字が無ければ場所を取らない・要約の欄の empty は畳むか静かな1行か静かなマスの格子1つ・片側だけの印 data-part は開いた顔のまま）
   F5 入口：月の働き方の欄に印 data-entry="give" が在り、給与の入口（pay-report.html）は画面に1つまで・ログインの入口は口コミの箱の外に1つまで・中に1つまで
   （F4 ＝ 余白と控えの高さは見るだけ。LC-A10 で外した） */
const FACE_REV = { ...ROWS, [CX]: [rated('c1', 4), rated('c2', 2)] };
const word = (state) => () => ({ status: 200, body: { ok: true, state } });
const FACE_PAY = (fix) => () => ({ status: 200, body: fix(LEAK_FIVE.map((s) => H.payRowFix(s))) });
const FACE_READERS = [
  { key: 'guest', ja: 'ゲスト', who: null, rated: true, stub: { pv_reviews: reviewsBy(FACE_REV), pv_review_summary: word('login'),
    pv_work_view: word('login'), pv_contrib_facts: word('login'), pv_pay_rows: FACE_PAY(H.payFix.guest) } },
  { key: 'member', ja: 'ふつうの会員（鍵なし）', who: 'pilot', rated: true, stub: { pv_reviews: reviewsBy(FACE_REV), pv_review_summary: word('locked'),
    pv_work_view: word('locked'), pv_contrib_facts: word('locked'), pv_pay_rows: FACE_PAY(H.payFix.member) } },
  { key: 'expired', ja: '給与の鍵が切れた人', who: 'pay', rated: true, stub: { pv_reviews: reviewsBy(FACE_REV), pv_review_summary: word('locked'),
    pv_work_view: word('locked'), pv_contrib_facts: word('locked'), pv_pay_rows: FACE_PAY(H.payFix.expired) } },
  { key: 'zero', ja: '空の答えだけ（会員 c）', who: 'c', rated: false, stub: {
    pv_reviews: () => ({ status: 200, body: { ok: true, unlocked: true, rows: [] } }), pv_review_summary: word('few'),
    pv_work_view: () => ({ status: 200, body: { ok: true, state: 'open', by: {} } }), pv_contrib_facts: () => ({ status: 200, body: { ok: true, state: 'open', facts: [] } }),
    pv_pay_rows: () => ({ status: 200, body: H.payFix.open([], []) }),
    pv_company_pay: () => ({ status: 200, body: { ok: true, state: 'open', period: { from: '2024-10', to: '2026-09' }, floor: 3, airlines: {} } }) } },
  { key: 'fail', ja: 'どの読みも落ちる（会員 c）', who: 'c', rated: false, fail: true, stub: Object.fromEntries(
    [...H.MINE, 'pv_pay_rows', 'pv_company_pay'].map((n) => [n, CX_FAIL])) },
];
/* 顔 a・b（比較の設計 F3 の決まりの写し ── assert-cmp-walk.mjs の faces() と1字も違わない。直すときは両方を同じに。下の静かな確かめが見ている）。
   破った所を、1つずつ字で返す（空 ＝ 守れている） */
const faces = (page) => page.evaluate(() => {
  const V = document.querySelector('#cr [data-view="compare"]');
  const seen = (n) => {
    if (!n || n.getClientRects().length === 0) return false;
    const r = n.getBoundingClientRect(), s = getComputedStyle(n);
    return s.visibility !== 'hidden' && r.width > 1 && r.height > 1;
  };
  const a = [], b = [];
  /* a：読み終わって、開いていない欄 */
  for (const x of V.querySelectorAll('.crl[data-live]')) {
    const state = x.getAttribute('data-state'), k = x.getAttribute('data-live');
    if (['idle', 'loading', 'open'].includes(state)) continue;
    /* cmp-pay の件数の行（頭のコメントの a の括弧）：行が1つだけで、2つのマスのどちらも .crl-pc[data-airline] の中に
       p.crl-count「n件の提出」（n は 1 から）か p.crl-msg「まだ記録がありません」の1つだけ。ほかの形なら、許さない */
    const cell = (c) => { const pc = c.matches('.crl-cmp-c') && c.children.length === 1 ? c.firstElementChild : null;
      const p = pc && pc.matches('.crl-pc[data-airline]') && pc.children.length === 1 ? pc.firstElementChild : null, t = p ? p.textContent : '';
      return !!p && (p.matches('p.crl-count') ? /^[1-9]\d*件の提出$/.test(t) && p.querySelectorAll('*').length === 1 : p.matches('p.crl-msg') && t === 'まだ記録がありません' && !p.children.length); };
    const rows = x.querySelectorAll('.crl-cmp-row');
    const free = k === 'cmp-pay' && rows.length === 1 && rows[0].children.length === 2 && [...rows[0].children].every(cell) ? rows[0] : null;
    const bad = [...x.querySelectorAll('ul, ol, table, .crl-cmp-row, .crl-rows, .crl-sk')].filter((n) => n !== free).map((n) => n.tagName.toLowerCase() + (n.className ? '.' + n.className : ''));
    if (bad.length) a.push(`${k}(${state}): ${bad.join(' ')}`);
    const per = {};
    for (const l of x.querySelectorAll('.crl-lock')) {
      const co = (l.closest('[data-airline]') || { getAttribute: () => '' }).getAttribute('data-airline') || '';
      per[co] = (per[co] || 0) + 1;
    }
    for (const [co, n] of Object.entries(per)) if (n > 1) a.push(`${k}(${state}): 錠の1行が${co || '会社の札の外'}に ${n}`);
    const give = x.querySelectorAll('.crl-give').length, retry = x.querySelectorAll('.crl-retry').length;
    if (give > 1) a.push(`${k}(${state}): 答えるカード ${give}`);
    if (retry > 1) a.push(`${k}(${state}): やり直す ${retry}`);
  }
  /* b：見えている箱に、見出しと「詳しく」の足のほかの見える字 */
  for (const box of V.querySelectorAll('.cr-panel, .cr-sec, .cr-cards')) {
    if (!seen(box)) continue;
    const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    let has = false;
    for (let t = w.nextNode(); t && !has; t = w.nextNode()) {
      const p = t.parentElement;
      if (!t.nodeValue.trim() || !p || p.closest('h1, h2, h3, h4, h5, h6, .cr-gos')) continue;
      if (seen(p)) has = true;
    }
    if (!has) b.push(`${box.className}：見出しと足のほかに見える字が無い（${box.innerText.trim().replace(/\s+/g, ' ').slice(0, 80)}）`);
  }
  const w = V.querySelector('.cr-cmp-work');
  const locks = w ? [...w.querySelectorAll('.crl-lock')].filter(seen).length : 0;
  if (locks > 1) b.push(`月の働き方の箱の錠の1行 ${locks}`);
  return { a, b };
});
/* 口コミの区域の3つの顔（比較の設計 D10 FACE ── 決まりの一部であって、例外ではない） */
const quietFaces = (page) => page.evaluate(() => {
  const out = [];
  for (const x of document.querySelectorAll('#cr [data-view="compare"] .crl[data-live]')) {
    const k = x.getAttribute('data-live'), state = x.getAttribute('data-state'), h = x.getBoundingClientRect().height, t = (x.innerText || '').trim();
    if (x.getAttribute('data-quiet') === '1' && !t && h > 0.5) out.push(`${k}(quiet,${state}): 字が無いのに ${Math.round(h)}px`);
    if (k === 'cmp-summary' && state === 'empty' && h > 0.5) {
      const kids = [...x.children];
      const one = kids.length === 1 && (kids[0].matches('p.crl-msg[data-why]')
        || (kids[0].matches('.crl-sum2') && [...kids[0].children].length > 0 && [...kids[0].children].every((c) => c.matches('.crl-sum2-c[data-quiet]'))));
      if (!one) out.push(`cmp-summary(empty): 畳まず、静かな1行でも静かなマスの格子1つでもない（${kids.map((c) => c.className).join(' ')}）`);
    }
    if (x.getAttribute('data-part') === '1' && state !== 'open') out.push(`${k}(${state}): 片側だけの印なのに開いた顔ではない`);
  }
  return out;
});
/* 公開の箱（F2） */
const publicBoxes = (page) => page.evaluate(() => {
  const V = document.querySelector('#cr [data-view="compare"]');
  const vis = (n) => !!n && n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden';
  const rows = [...V.querySelectorAll('.cr-panel[data-kind="estimate"] .cr-row')].filter(vis);
  const rent = [...V.querySelectorAll('.cr-rentb')].filter(vis), cards = [...V.querySelectorAll('.cr-card')].filter(vis);
  const rate = [...V.querySelectorAll('.crl[data-live="cmp-stars"] .crl-cmp-row .crl-cmp-c')].map((c) => ({ avg: ((c.querySelector('.crl-avg') || {}).textContent || '').trim(),
    lock: c.querySelectorAll('.crl-lock').length }));
  const locked = [...rows, ...rent, ...cards].filter((n) => n.querySelector('.crl-lock')).length;
  return { rows: rows.map((r) => (r.querySelector('.cr-row-v') || {}).innerText || ''), rent: rent.length, cards: cards.length,
    cardsBox: vis(V.querySelector('.cr-cards')), rate, locked };
});
const entries = (page) => page.evaluate(() => {
  const V = document.querySelector('#cr [data-view="compare"]');
  const vis = (n) => n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden' && n.getBoundingClientRect().height > 1;
  const where = (a) => { const s = a.closest('.crl[data-live]'); return s ? s.getAttribute('data-live') : 'ページ'; };
  const pay = [...V.querySelectorAll('a[href*="pay-report.html"]')].filter(vis).map(where);
  const login = [...V.querySelectorAll('a[href*="login.html"]')].filter(vis);
  const work = V.querySelector('.crl[data-live="cmp-work"]');
  return { pay, inRev: login.filter((a) => a.closest('.cr-cmp-rev')).length, outRev: login.filter((a) => !a.closest('.cr-cmp-rev')).length,
    outAt: login.filter((a) => !a.closest('.cr-cmp-rev')).map(where), stamp: work ? work.getAttribute('data-entry') : null };
});
const FACE_PAIRS = [['jal', 'ana'], ['etihad', CX]];

scene('faces', '比較の顔：5つの読む人で、欄は上限のうちに読み終わる・公開の箱は開いている・開いていない欄に一覧や骨が無い・給与の入口は1つ', async () => {
  /* 顔 a・b は assert-cmp-walk.mjs の faces() の写し ── 1字も違わない */
  const body = (src) => { const i = src.indexOf('const faces = (page) => page.evaluate(() => {'); const j = i < 0 ? -1 : src.indexOf('\n});\n', i); return i < 0 || j < 0 ? null : src.slice(i, j); };
  const mine = body(read('assert-cmp-frame.mjs')), walk = body(read('assert-cmp-walk.mjs'));
  ok(!!mine && mine === walk, '顔 a・b の決まりは assert-cmp-walk.mjs の faces() と1字も違わない（提出された年収の件数の行の決まり込み）', J({ mine: !!mine, walk: !!walk }));
  for (const R of FACE_READERS) {
    for (const [a, b] of FACE_PAIRS) {
      const AB = `${a}|${b}`, t0 = Date.now();
      const { page } = await open('sp', { who: R.who, url: PAIR(a, b), stub: R.stub });
      const done = await settled(page, AB, LIMIT + 5000);
      const took = Date.now() - t0;
      const states = (await cdnFaces(page)).map((f) => `${f.kind}${f.quiet ? '(quiet)' : ''}:${f.state}`);
      ok(done, `F1 ${R.ja}・${AB}（390）：見えている欄が全部、上限 ＋ 5秒のうちに読み終わった顔（${took}ms・${states.join(' ')}）`, J(states));
      await viewStill(page);
      await frames(page);
      const P = await publicBoxes(page);
      const est = P.rows.length === 4 && P.rows.every((v) => /^¥[\d,]+万$/.test(v.trim()));
      const cardsOk = P.cardsBox ? P.cards === 2 : P.cards === 0;
      const stars = R.fail ? true : R.rated ? P.rate.length === 2 && P.rate.every((r) => /^\d\.\d$/.test(r.avg) && !r.lock) : P.rate.every((r) => !r.avg && !r.lock);
      ok(est && P.rent === 2 && cardsOk && stars && P.locked === 0,
        `F2 ${R.ja}・${AB}：公開の箱は開いている ── 推定年収の行4つ（額あり）・家賃の箱2つ・公表額のカード${P.cardsBox ? '2つ' : 'の箱は描かない組（2社とも中身が無い）'}・`
        + `${R.fail ? '評価（落ちる回なので見ない）' : R.rated ? '2社の評価の点' : '評価の点なし（評価の付いた投稿が無い）'} ── どれにも錠の1行が無い`, J(P));
      const FC = await faces(page), Q = await quietFaces(page);
      ok(FC.a.length === 0, `F3 ${R.ja}・${AB}：顔 a ── 開いていない欄に一覧・表・比べる行・待ちの骨が無い（提出された年収の件数の行1つのほか）・錠の1行は会社ごとに1つまで`, FC.a.join(' ／ '));
      ok(FC.b.length === 0, `F3 ${R.ja}・${AB}：顔 b ── 見えている箱には、見出しと足のほかに見える字が在る・月の働き方の錠の1行は1つまで`, FC.b.join(' ／ '));
      ok(Q.length === 0, `F3 ${R.ja}・${AB}：口コミの区域の3つの顔（静かな欄は場所を取らない・要約の空の顔・片側だけの印は開いた顔）`, Q.join(' ／ '));
      const E = await entries(page);
      ok(E.stamp === 'give' && E.pay.length <= 1 && E.outRev <= 1 && E.inRev <= 1,
        `F5 ${R.ja}・${AB}：月の働き方の欄に印（data-entry="give"）が在り、給与の入口は ${E.pay.length}つ（${E.pay.join('・') || 'なし'}）・ログインの入口は口コミの箱の外に ${E.outRev}つ・中に ${E.inRev}つ（どれも1つまで）`,
        J(E));
      if (SHOTS) {
        fs.mkdirSync(SHOTS, { recursive: true });
        for (const th of ['light', 'dark']) {
          await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), th);
          await frames(page);
          await page.screenshot({ path: path.join(SHOTS, `${CUR.key}-${R.key}-${a}-${b}-390-${th}.png`), fullPage: true });
        }
      }
    }
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
