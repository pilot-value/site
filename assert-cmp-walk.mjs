/* ══════════════════════════════════════════════════════════════════
   assert-cmp-walk.mjs — 比較を、手元の保存先で歩く（2026-10-22）

   会社ページ → 比較 → 切り替え・入れ替え → 詳しく → 戻る → カードを、手元の保存先（serve-local.mjs ── 手元の SQL が答える）で歩く。
   読む人は手元の投稿から作る（cmp-stubs.mjs の makeReaders）。結果の行の頭に [REAL LOCAL CONNECTION] と、投稿の出し方（via form / via call）
   を書く。保存先の表を q() で読んで数えただけの行は [REAL LOCAL SQL]。本番については何も言わない（本番は 未確認）。

   守っているもの
     ・場面 zero（W-zero）── 空の保存先・ゲスト・3組（jal|ana・etihad|cathay-pacific・eva-air|jal）。「0件」を 0 と書かない：
         公開の数字（推定年収の4つの額とその札・通貨）が全部在る／鍵の要る欄は、その欄を持つ区域の表のとおりのゲストの顔／
         口コミの欄は「会員からの投稿はまだありません」の1行と、その下の会社ごとの 3.0 の淡い6角形（数字なし）だけ
         （数・星・点数で塗った図・抜粋を置かない ── 図は 2026-10-22 LEAD AMENDMENT (2)）／カードに評価の行が無い。
         保存先の口コミは、この検査が q() で数える（ページに聞かない）。
         顔 a・b（比較の設計 F3 の決まりの写し。同じ決まりは assert-cmp-frame.mjs の場面 faces が持つ予定 ── 直すときは両方を同じに）：
           a 開いていない欄に、一覧・表・比べる行・待ちの骨が無い・錠の1行は会社ごとに1つまで・答えるカードと「やり直す」は1つまで
             （提出された年収の欄 cmp-pay だけは、比べる行を1つ持ってよい ── 2つのマスに、会社ごとの「n件の提出」か「まだ記録がありません」
              の1行だけ。職位の名前・額・2つめの行・一覧が入ったら赤。2026-10-22 の LEAD の決め・WP-cmp-pay-4）
           b 見えている箱（.cr-panel・.cr-sec・.cr-cards）には、見出しと「詳しく」の足（.cr-gos）のほかに、見える字が在る・
             月の働き方の箱の錠の1行は1つまで
         顔 a・b は狭い画面（390）と広い画面（1440）で見る。
     ・門（どの場面も）── ブラウザを立ち上げる時に置く。要求の差し替え（setRequestInterception）は使わない ── 使うとブラウザが
       「戻る」の手元の置き場（back-forward cache）を使わなくなる。出てよいのは、この場面が起こした手元のサーバーの番号と、
       部品・書体の配信元（LIBS ＝ cmp-stubs.mjs）だけ。ほかの行き先は全部（ほかの localhost の番号も・数字の住所も）、
       この検査が立てた「断る口」（proxy）へ向かわせて断り、書き留め、その場面ごと赤くする。
       網をもう1枚：ブラウザは localhost と LIBS のほかの名前を引けない（cmp-stubs.mjs の NO_NAMES）。
       ★解析タグは serve-local.mjs が配る瞬間に外すので、門が断る要求は普段は1本も無い（0 であることを、場面ごとに確かめる）。

   実行: node assert-cmp-walk.mjs [--scenes zero] [--via form|call] [--shots <folder>]
     --scenes  場面を選ぶ（いま在るのは zero。walk・readers・fail・cur は、あとの作業で足す）。付けなければ全部
     --via     読む人の投稿を、画面から入れるか（form）・関数で入れるか（call）。既定は call（form はまだ無い ── makeReaders）
     --shots   場面の終わりの画面を撮って置く（置き場は打った場所。ファイルに書かない）。欄の高さの控え（.json）も同じ所へ
   場面ごとに、手元の保存先を空いているポートで起こし（cmp-stubs.mjs の startLocal ── 一時フォルダ。3000番・3100番は使わない）、
   終わったら丸ごと捨てる。ブラウザも場面ごとに1つ（門に、その場面のサーバーの番号を書くため）。
   ⚠️ 手元の会員（serve-local.mjs の MEMBERS）は模擬。ここで通ったことは、本番で通った証拠にはならない。
   check.mjs には入っていない。手で流す（ほかのブラウザの検査と同時に流さない）。
   ══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import puppeteer from 'puppeteer';
import * as H from './cmp-stubs.mjs';

const read = (rel) => fs.readFileSync(path.join(H.ROOT, rel), 'utf8');
const argv = process.argv.slice(2);
const argOf = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const WANT = argOf('--scenes') ? argOf('--scenes').split(',').map((s) => s.trim()).filter(Boolean) : null;
const VIA = argOf('--via') || 'call';
const SHOTS = argOf('--shots');
if (!['form', 'call'].includes(VIA)) { console.error('--via は form か call'); process.exit(2); }

/* ── 数え方と書き方 ─────────────────────────────────────────── */
let pass = 0, fail = 0, CUR = null;
const TAG = { local: '[REAL LOCAL CONNECTION]', sql: '[REAL LOCAL SQL]' };
const say = (kind, cond, label, detail) => {
  const who = CUR ? `${CUR.key}: ` : '';
  if (cond) { pass++; console.log(`${TAG[kind]} via ${VIA} ✓ ${who}${label}`); }
  else { fail++; console.log(`${TAG[kind]} via ${VIA} ✗ ${who}${label}${detail ? `\n      ${String(detail).slice(0, 700)}` : ''}`); }
};
const ok = (cond, label, detail = '') => say('local', cond, label, detail);
const okSql = (cond, label, detail = '') => say('sql', cond, label, detail);
const head = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(4, 44 - t.length))}`);
const J = (v) => JSON.stringify(v);

/* ── 門（ブラウザを立ち上げる時に置く）──────────────────────────── */
/* 通してよい配信元の名前は cmp-stubs.mjs の LIBS から読む（2つ目の表を持たない） */
const LIB_HOSTS = (H.LIBS.source.match(/^\^\((.*)\)\$$/) || [])[1].split('|').map((s) => s.replace(/\\\./g, '.'));
if (!LIB_HOSTS.length || !LIB_HOSTS.every((h) => H.LIBS.test(h))) { console.error('LIBS が読めない: ' + H.LIBS); process.exit(2); }
/* 断る口：来た要求を書き留めて、答えずに切る（どこへもつながない） */
async function refuser() {
  const log = [];
  const srv = http.createServer((req) => { log.push(`${req.method} ${req.url}`); req.socket.destroy(); });
  srv.on('connect', (req, sock) => { log.push(`CONNECT ${req.url}`); sock.destroy(); });
  srv.on('upgrade', (req, sock) => { log.push(`UPGRADE ${req.url}`); sock.destroy(); });
  srv.on('clientError', (e, sock) => { try { sock.destroy(); } catch { /* もう閉じている */ } });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const close = () => new Promise((r) => { srv.close(() => r()); srv.closeAllConnections?.(); });
  if (port === 3000 || port === 3100) { await close(); throw new Error(`${port} 番では断る口を立てない`); }
  return { port, log, close };
}
/* 場面の舞台：使い捨ての保存先 → 断る口 → その番号だけを通すブラウザ */
async function stage() {
  const env = await H.startLocal();
  let px = null, browser = null;
  try {
    px = await refuser();
    const own = new URL(env.url).port;
    browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox', H.NO_NAMES,
      `--proxy-server=http://localhost:${px.port}`,
      `--proxy-bypass-list=<-loopback>;localhost:${own};127.0.0.1:${own};${LIB_HOSTS.join(';')}`] });
  } catch (e) {
    if (px) await px.close();
    await env.stop();
    throw e;
  }
  return { env, px, browser };
}
/* 1枚開く（要求は差し替えない ── 見るだけ）。who ＝ serve-local.mjs の MEMBERS の key（null ＝ ログインしていない人）。
   ログインは cmp-stubs.mjs の open と同じ置き方（ページのどのスクリプトよりも先・Give → Get の板は「さっき見た」・会員の札は隠す）。
   st.out ＝ 手元の番号と LIBS のほかへ向かった要求（断ったものも数える）・st.through ＝ そのうち返事が届いたもの */
async function open(sizeKey, { who = null, url = null } = {}) {
  const size = H.SIZES[sizeKey];
  if (!size) throw new Error('知らない大きさ: ' + sizeKey);
  const [w, h, touch] = size;
  const origin = new URL(CUR.env.url).origin;
  const ctx = await CUR.browser.createBrowserContext();
  const page = await ctx.newPage();
  const st = { out: [], through: [], errs: [] };
  const live = new Map();
  CUR.pages.push({ page, ctx, st });
  page.setDefaultTimeout(30000);
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: !!touch, hasTouch: !!touch });
  page.on('request', (r) => {
    let u;
    try { u = new URL(r.url()); } catch { return; }
    if (!/^(https?|wss?):$/.test(u.protocol) || u.origin === origin || H.LIBS.test(u.hostname)) return;
    const x = `${r.method()} ${u.host}${u.pathname}`;
    st.out.push(x);
    live.set(r, x);
  });
  page.on('requestfinished', (r) => { if (live.has(r)) st.through.push(`${live.get(r)}（返事が届いた）`); live.delete(r); });
  page.on('requestfailed', (r) => { live.delete(r); });
  page.on('pageerror', (e) => st.errs.push(String(e.message).slice(0, 160)));
  const seed = who ? await H.seedOf(CUR.env.url, who) : null;
  await page.evaluateOnNewDocument((origin, s) => {
    if (location.origin !== origin) return;
    try {
      if (localStorage.getItem('pv_local_seeded')) return;
      localStorage.setItem('pv_local_ui', '0');
      if (s) {
        const now = String(Date.now());
        localStorage.setItem('sb-local-auth-token', JSON.stringify(s.session));
        localStorage.setItem('pv_user', JSON.stringify(s.pv_user));
        localStorage.setItem('pv_last_active', now);
        localStorage.setItem('pv_session_start', now);
        const at = Date.parse((s.session.user || {}).last_sign_in_at || '');
        localStorage.setItem('pv_give_seen', JSON.stringify({ t: Date.now(), s: String(isNaN(at) ? now : at) }));
      }
      localStorage.setItem('pv_local_seeded', '1');
    } catch (e) { /* 保存領域に触れない画面はそのまま */ }
  }, origin, seed);
  if (url) await page.goto(CUR.env.url + url, { waitUntil: 'domcontentloaded' });
  return { page, ctx, st };
}
async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${CUR.key}-${name}.png`), fullPage: true });
}

/* ── 比較の画面を読む ───────────────────────────────────────── */
const PAIR = (a, b) => `/career.html?view=compare&a=${a}&b=${b}`;
/* 比較の欄が全部、その2社について読み終わるまで待つ（時間では待たない。上限は検査の側の失敗の印） */
const settled = (page, a, b) => page.waitForFunction((want) => {
  const all = document.querySelectorAll('#cr [data-view="compare"] .crl[data-live^="cmp-"]');
  return all.length > 0 && [...all].every((x) => x.getAttribute('data-for') === want && !['idle', 'loading'].includes(x.getAttribute('data-state')));
}, { timeout: 30000, polling: 100 }, `${a}|${b}`).then(() => true, () => false);
/* figures(page) ── 比較の画面に出ている数と顔（この検査の目）：2社とその並び・通貨・役ごと会社ごとの推定年収とその札・
   口コミの欄の会社ごとの平均・評価件数・投稿件数（開いている時）・比較の欄ぜんぶの状態 */
const figures = (page) => page.evaluate(() => {
  const V = document.querySelector('#cr [data-view="compare"]');
  const vis = (n) => !!n && n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden';
  const txt = (n) => (n ? n.innerText.trim() : null);
  const st = window.PVCareer && window.PVCareer.state ? window.PVCareer.state() : {};
  const est = {};
  for (const p of V.querySelectorAll('.cr-panel[data-kind="estimate"] .cr-pair')) {
    est[p.getAttribute('data-role')] = [...p.querySelectorAll('.cr-row')].filter(vis).map((r) => ({
      airline: r.getAttribute('data-airline'), v: txt(r.querySelector('.cr-row-v')) || '',
      tag: [...r.querySelectorAll('.cr-tag')].filter(vis).map((t) => t.innerText.trim()).join('・') }));
  }
  const rate = [...V.querySelectorAll('.crl[data-live="cmp-stars"] .crl-rate')].map((c) => ({
    avg: txt(c.querySelector('.crl-avg')), cnt: txt(c.querySelector('.crl-cnt')), posts: txt(c.querySelector('.crl-posts')),
    none: txt(c.querySelector('.crl-none')) }));
  const slots = [...V.querySelectorAll('.crl[data-live]')].map((x) => ({ kind: x.getAttribute('data-live'),
    state: x.getAttribute('data-state'), for: x.getAttribute('data-for'), quiet: x.getAttribute('data-quiet') }));
  return { view: st.view, pair: [st.a, st.b], cur: window.PVCurrency && window.PVCurrency.get ? window.PVCurrency.get() : null, est, rate, slots };
});
/* 顔 a・b（比較の設計 F3 の決まりの写し ── assert-cmp-frame.mjs の場面 faces が同じ決まりを持つ予定。直すときは両方を同じに）。
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
/* 欄の高さの控え（--shots の時だけ。見るための数で、ここでは判定しない） */
const heights = (page) => page.evaluate(() => [...document.querySelectorAll('#cr [data-view="compare"] .crl[data-live]')].map((x) => ({
  kind: x.getAttribute('data-live'), state: x.getAttribute('data-state'), minHeight: x.style.minHeight || '', h: Math.round(x.getBoundingClientRect().height) })));

/* ── 保存先を読む（この検査の数え方。ページのコードを呼ばない）──────────── */
/* 会社の符号と、その会社の古い符号（career-live.js の LEGACY ── 会社ページとの同じ集合は assert-career.mjs が見ている）。
   比較の口コミの欄は、この符号の全部の行を1つの会社として数える */
const LEGACY = (() => {
  const m = read('career-live.js').match(/var LEGACY\s*=\s*\{([\s\S]*?)\};/);
  if (!m) throw new Error('career-live.js の LEGACY が読めない');
  return [...m[1].matchAll(/'([a-z0-9-]+)'\s*:\s*'([a-z0-9-]+)'/g)].map((x) => [x[1], x[2]]);
})();
const codesOf = (slug) => [slug, ...LEGACY.filter(([, to]) => to === slug).map(([from]) => from)];
const SC = ['culture_score', 'salary_score', 'benefits_score', 'wlb_score', 'ops_score', 'training_score'];
/* 決まりの書き直し（この検査の言葉）：1行の平均は、点数の付いた分類（0 より大きい・5 で頭打ち）だけの平均。
   評価の平均はその行の平均の平均、評価件数は点数の付いた行の数。行が無い・点数が1つも無い → null（0 にしない） */
async function stored(slug) {
  const rows = (await CUR.env.q(`select ${SC.join(', ')} from public.reviews_v2 where airline = any($1::text[])`, [codesOf(slug)])).rows;
  let tot = 0, n = 0;
  for (const r of rows) {
    const v = SC.map((k) => Number(r[k])).filter((x) => Number.isFinite(x) && x > 0).map((x) => Math.min(5, x));
    if (v.length) { tot += v.reduce((x, y) => x + y, 0) / v.length; n++; }
  }
  return { posts: rows.length, rate: n ? { avg: tot / n, n } : null };
}

/* ── 場面 ─────────────────────────────────────────────────── */
const SCENES = {};
const scene = (key, label, fn) => { SCENES[key] = { key, label, fn }; };

/* 画面の字（P9.7 で決まった、比較と会社ページの「投稿が無い」の1行。ページのコードからは読まない） */
const REV_NONE = '会員からの投稿はまだありません';
/* ゲストが空の保存先で見る顔（data-state）。字の決まりは、その欄を持つ区域の表：
     cmp-stars  口コミの区域の表「2社とも投稿が無い → 1行＋会社ごとの 3.0 の淡い6角形（empty）」
     cmp-work   口コミの区域の表 C の R0 ゲスト → 錠の1行（locked）
     cmp-facts  口コミの区域の表 C の R0 ゲスト → 錠の1行（locked）
   表に無い欄（あとの作業で足される欄）は、読み終わっていて・失敗の顔でないことだけを見る（その区域の表は、その作業が持つ） */
const GUEST_ZERO = { 'cmp-stars': 'empty', 'cmp-work': 'locked', 'cmp-facts': 'locked' };
const ZERO_PAIRS = [['jal', 'ana'], ['etihad', 'cathay-pacific'], ['eva-air', 'jal']];
const YEN = /^¥[\d,]+万$/;

scene('zero', '空の保存先・ゲスト・3組：公開の数字は全部在る・鍵の要る欄はゲストの顔・口コミは「投稿はまだありません」の1行と淡い6角形・カードに評価の行が無い（この場面は投稿を作らない）', async () => {
  for (const [a, b] of ZERO_PAIRS) {
    const AB = `${a}|${b}`;
    /* 保存先の口コミ（q() で数える） */
    const S = { [a]: await stored(a), [b]: await stored(b) };
    okSql(S[a].posts === 0 && S[b].posts === 0 && !S[a].rate && !S[b].rate,
      `${AB} 保存先の口コミ：${a} ${S[a].posts}件・${b} ${S[b].posts}件（q() で数えた。古い符号の行も含む）`, J(S));
    for (const size of ['pc', 'sp']) {
      const { page } = await open(size, { url: PAIR(a, b) });
      const done = await settled(page, a, b);
      const F = await figures(page);
      const W = size === 'pc' ? '1440' : '390';
      ok(done && F.view === 'compare' && F.pair[0] === a && F.pair[1] === b,
        `${AB}（${W}）2社とその並びのまま、比較の欄が全部読み終わった`, J({ done, view: F.view, pair: F.pair, slots: F.slots }));
      if (size === 'pc') {
        /* 公開の数字 */
        const est = ['cap', 'fo'].map((rk) => [a, b].map((s) => ((F.est[rk] || []).find((r) => r.airline === s)) || null));
        const all = est.flat();
        ok(F.cur === 'JPY' && all.length === 4 && all.every((r) => r && YEN.test(r.v) && r.tag)
          && ['cap', 'fo'].every((rk) => (F.est[rk] || []).length === 2),
        `${AB} 公開の数字が全部在る：機長・副操縦士 × 2社の推定年収（円）と、その札`, J({ cur: F.cur, est: F.est }));
        /* 鍵の要る欄のゲストの顔 */
        const wrong = F.slots.filter((x) => x.kind.startsWith('cmp-') && GUEST_ZERO[x.kind] && x.state !== GUEST_ZERO[x.kind]);
        const other = F.slots.filter((x) => x.kind.startsWith('cmp-') && !GUEST_ZERO[x.kind]);
        ok(!wrong.length && Object.keys(GUEST_ZERO).every((k) => F.slots.some((x) => x.kind === k))
          && other.every((x) => !['idle', 'loading', 'error'].includes(x.state)),
        `${AB} 比較の欄はどれもゲストの顔（口コミ empty・月の働き方 locked・待遇 locked${other.length ? '・表に無い欄 ' + other.map((x) => `${x.kind}=${x.state}`).join(' ') : ''}）`,
        J(F.slots));
        /* 口コミの欄は、投稿が無いことの1行と、その下の会社ごとの 3.0 の淡い6角形だけ（2026-10-22 LEAD AMENDMENT (2)・オーナー
           「必ず多角形のレーダーの図を載せて」P12.95／96／97）。前の「svg が 0・欄の字はその1行だけ」は、同じ強さで次へ移した（LEAD の決め (c)）：
           1行が先／社名の札と淡い図を除いた字はその1行だけ／svg は淡い図の中の2つだけ・左右の列に1つずつ／図は数字なし・点の丸なし・読み上げない／
           数・星・点数で塗った図・抜粋・錠の1行・比べる行が無い／欄の字に数字が無い */
        const rv = await H.slot(page, 'cmp-stars');
        const Z = await page.evaluate(() => {
          const x = document.querySelector('#cr [data-view="compare"] .crl[data-live="cmp-stars"]');
          if (!x) return null;
          const rest = x.cloneNode(true);
          for (const n of rest.querySelectorAll('[data-radar="ph"], .crl-cmp-head')) n.remove();
          const col = (f) => { const c = f.closest('.crl-cmp-sc'), r = c && c.parentElement; return r ? [...r.children].indexOf(c) : -1; };
          return {
            first: x.firstElementChild ? x.firstElementChild.className : '',
            heads: x.querySelectorAll('.crl-cmp-head > .crl-co').length,
            extra: x.querySelectorAll('.crl-avg, .crl-cnt, .crl-posts, .crl-score, .crl-rate, .crl-stars, .crl-revs, .crl-lock, .crl-cmp-row').length,
            svg: x.querySelectorAll('svg').length,
            svgOut: [...x.querySelectorAll('svg')].filter((s) => !s.closest('[data-radar="ph"]')).length,
            figs: [...x.querySelectorAll('[data-radar]')].map((f) => ({ k: f.getAttribute('data-radar'), hidden: f.getAttribute('aria-hidden'),
              ph: !!f.querySelector('svg .crl-radar-shape.is-ph'), dots: f.querySelectorAll('.crl-radar-dot').length, b: f.querySelectorAll('b').length, col: col(f) })),
            rest: rest.textContent.trim(),
          };
        });
        ok(!!rv && rv.state === 'empty' && !/\d/.test(rv.text) && !!Z && Z.first === 'crl-msg' && Z.rest === REV_NONE && Z.heads === 2 && Z.extra === 0
          && Z.svg === 2 && Z.svgOut === 0 && Z.figs.length === 2
          && Z.figs.every((f) => f.k === 'ph' && f.hidden === 'true' && f.ph && f.dots === 0 && f.b === 0) && J(Z.figs.map((f) => f.col)) === '[0,1]'
          && S[a].posts === 0 && S[b].posts === 0,
          `${AB} 口コミの欄は「${REV_NONE}」の1行と、その下の会社ごとの 3.0 の淡い6角形（数字なし）だけ（数・星・点数で塗った図・抜粋・錠の1行が無い）`,
          J({ rv: rv && { state: rv.state, text: rv.text }, Z, stored: S }));
      }
      /* 顔 a・b（狭い画面と広い画面） */
      const FC = await faces(page);
      ok(FC.a.length === 0, `${AB}（${W}）顔 a：開いていない欄に一覧・表・待ちの骨が無く、錠の1行は会社ごとに1つまで`, FC.a.join(' ／ '));
      ok(FC.b.length === 0, `${AB}（${W}）顔 b：見えている箱には、見出しと足のほかに見える字が在る・月の働き方の錠の1行は1つまで`, FC.b.join(' ／ '));
      if (SHOTS) {
        await shot(page, `${a}-${b}-${W}`);
        fs.writeFileSync(path.join(SHOTS, `${CUR.key}-${a}-${b}-${W}.json`), J(await heights(page)));
      }
      if (size === 'pc') {
        /* カード：評価の行が無い（材料の rating が null）。読むのは比較が読んだ口コミと同じ（新しい要求は作らない） */
        await page.evaluate((a, b) => window.PVCareer.go({ view: 'card', a, b }), a, b);
        const up = await page.waitForFunction(() => {
          const m = window.PVCareerCard && window.PVCareerCard.model && window.PVCareerCard.model();
          const r = document.getElementById('crc-root');
          return !!(m && m.cards && m.cards.length === 2 && m.layout && r && r.getAttribute('data-drawn'));
        }, { timeout: 30000, polling: 100 }).then(() => true, () => false);
        const R = await page.evaluate(async (a, b) => {
          const got = [];
          for (const s of [a, b]) { try { got.push({ ok: true, v: await window.PVCareer.rating(s) }); } catch (e) { got.push({ ok: false }); } }
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));
          const m = window.PVCareerCard.model();
          return { got, slugs: m.cards.map((c) => c.slug), rating: m.cards.map((c) => c.rating) };
        }, a, b);
        ok(up && R.got.every((g) => g.ok && g.v === null) && R.rating.length === 2 && R.rating.every((x) => x === null),
          `${AB} カード：評価の行が無い（2社とも評価なし ── 0 も「評価未取得」も描かない）`, J(R));
        if (SHOTS) await shot(page, `${a}-${b}-card`);
      }
    }
  }
});

/* ══ 走らせる ═══════════════════════════════════════════════════ */
const KEYS = Object.keys(SCENES);
const bad = (WANT || []).filter((k) => !KEYS.includes(k));
if (bad.length) { console.error(`知らない場面: ${bad.join(',')}（在るのは ${KEYS.join(',')}）`); process.exit(2); }
const t0 = Date.now();
const NET = { out: 0, refused: 0, through: 0 };
for (const s of KEYS.filter((k) => !WANT || WANT.includes(k)).map((k) => SCENES[k])) {
  CUR = { ...s, pages: [], env: null, px: null, browser: null };
  head(`[REAL LOCAL CONNECTION] via ${VIA} ${s.key} ── ${s.label}`);
  try {
    Object.assign(CUR, await stage());
    await s.fn();
  } catch (e) {
    ok(false, '場面が最後まで走らなかった', String((e && e.stack) || e).slice(0, 500));
  } finally {
    for (const o of CUR.pages) { try { await o.ctx.close(); } catch { /* もう閉じている */ } }
    if (CUR.browser) await CUR.browser.close();
    const sts = CUR.pages.map((o) => o.st);
    const all = (k) => sts.flatMap((x) => x[k]);
    const refused = CUR.px ? CUR.px.log.slice() : [];
    NET.out += all('out').length; NET.through += all('through').length; NET.refused += refused.length;
    /* 門：外へ向かった要求は、断っても赤（出てよいのは、この場面のサーバーの番号と LIBS だけ） */
    ok(all('out').length === 0 && refused.length === 0,
      '門：この場面のサーバーと部品の配信元（LIBS）のほかへ向かった要求 0（断る口に来た要求 0）', [...all('out'), ...refused].join('・'));
    ok(all('through').length === 0, '門：外へ出て返事が届いた要求 0', all('through').join('・'));
    const errs = [...new Set(all('errs'))];
    if (errs.length) console.log(`  ・ページの中のエラー: ${errs.join(' ／ ')}`);
    if (CUR.px) await CUR.px.close();
    if (CUR.env) await CUR.env.stop();
  }
}
CUR = null;
const ran = KEYS.filter((k) => !WANT || WANT.includes(k));
console.log(`\n  場面: ${ran.join(', ')}${WANT ? '（--scenes で絞った。緑でも全部を見たことにはならない）' : ''}`);
console.log(`  ★外への通信（この場面のサーバーと LIBS のほか）: ページから ${NET.out}・断る口に来た ${NET.refused}・返事が届いた ${NET.through}`);
console.log(`\n══ ${pass} pass / ${fail} fail ══（REAL LOCAL CONNECTION ＝ 手元の SQL。本番は 未確認）  ${Math.round((Date.now() - t0) / 1000)}s`);
process.exit(fail ? 1 : 0);
