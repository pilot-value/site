/* cmp-stubs.mjs — 比較（career.html?view=compare）の生きた欄を検査するための部品。検査から読み込む。単体では何もしない（2026-10-22）。

   ★自分で手元の保存先（serve-local.mjs）を空いているポートで起こし、終わったら丸ごと捨てる。3000番・3100番は使わない ＝ 本番へは1本も出ない。
   ★返事を検査が作る場面（MOCK）と、手元の SQL が答える場面（REAL LOCAL）の両方がこの部品を使う。
     MOCK  ＝ ページが手元の口へ投げた関数の呼び出しに、検査が返事を作って返す（手元のサーバーはページとログインだけを配る）。
     local ＝ 呼び出しをそのまま手元のサーバーへ通す（本物の SQL が答える）。
   ★外へは1本も出さない（P12.57）。門（gate）は、手元の口と、書体・部品の配信元（LIBS）だけを通し、ほかの行き先は
     止める前に書き留めて止める（*.supabase.* は st.supa、それ以外は st.blocked）。止めたと数えるのは、門が止めると決めた印があり、
     しかもブラウザの中で「止められた」で終わった要求だけ。それ以外の外への要求は、どう終わっても st.through（すり抜けた）に入る。
     網をもう1枚：ブラウザは localhost と LIBS のほかの名前を引けない（NO_NAMES ── assert-admin.mjs の字の写し）。
   ⚠️ 手元の会員（serve-local.mjs の MEMBERS）は模擬。ここで通ったことは、本番で通った証拠にはならない。

   道具は local-chain.mjs から借りる（LIBS・seedOf・rpcAs・loginAs・open）。ここに在るのは、あちらに無いものだけ：
     startLocal（SQL をそのまま流せる exec を持つ）・MOCK の門と open・slot / until / watch / seen・otherTab / loginIn / logoutIn・
     読む人の作り方 makeReaders（比較の検査の3つの区域で、ただ1つ）・給与の一覧の返事の材料 payFix / payRowFix（同じく、ただ1つ）。

   使い方（assert-career-live.mjs が手本）
     const env = await H.startLocal();                                   // { local, url, q, exec, tmp, stop }
     const browser = await H.launch();
     const { page, st, close } = await H.open(browser, env.local, 'pc', { stub: { pv_reviews: (p) => ({ status: 200, body: { ok: true, rows: [] } }) } });
     await H.until(page, () => document.querySelector('.crl[data-live="cmp-stars"][data-state="empty"]'));
     await close(); await browser.close(); await env.stop();
*/
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { LIBS, seedOf, rpcAs, loginAs, open as openLocal } from './local-chain.mjs';

export { LIBS, seedOf, rpcAs, loginAs, openLocal };
export const ROOT = fileURLToPath(new URL('.', import.meta.url));

/* 画面の大きさ（幅・高さ・指で触る端末か） */
export const SIZES = {
  pc: [1440, 900], side: [1001, 900], tab: [768, 1024], sp: [390, 680, 'touch'], s375: [375, 667, 'touch'],
  s360: [360, 640, 'touch'], xs: [320, 568, 'touch'],
};

/* この区域（比較の口コミ・要約・月の働き方・待遇）が呼ぶ関数。MOCK の場面で返事が用意されていなければ、場面ごと赤くする */
export const MINE = ['pv_reviews', 'pv_review_summary', 'pv_work_view', 'pv_contrib_facts', 'pv_contrib_give', 'pv_contrib_notes'];

/* 欄ではなく、ページの枠（pv-gates.js・pv-session.js など）が呼ぶもの。MOCK でも手元のサーバーに答えさせる。
   2026-10-22 に、この枝の比較の画面（career.html?view=compare&a=jal&b=ana）を、ログインした会員（a・pay・pilot・op）と
   ログインしていない人で開いて、手元の要求の記録（serve-local.mjs の /__local/requests）で数えた：開いただけで呼ばれるのは
   MINE の3つ（pv_reviews・pv_work_view・pv_contrib_facts）だけで、枠からの呼び出しも表の直読みも0。
   枠が呼ぶ関数は pv-gates.js の pv_give_progress の1つ（左メニューの DEEP PAY を押したときに1回だけ ── askProgress）。 */
export const SHELL = ['pv_give_progress'];

/* MINE の落ち着いた既定の返事（name → (p, auth) → { status, body }）。場面は stub で上書きする。
   値を null にすると「返事を用意していない」扱い（その名前が呼ばれたら st.unknown に入る）。 */
const okJson = (body) => ({ status: 200, body });
export const BASE_STUB = {
  pv_reviews: () => okJson({ ok: true, unlocked: false, rows: [] }),
  pv_review_summary: () => okJson({ ok: true, state: 'few' }),
  pv_work_view: () => okJson({ ok: true, state: 'login' }),
  pv_contrib_facts: () => okJson({ ok: true, state: 'login' }),
  pv_contrib_notes: () => okJson({ ok: true, state: 'login' }),
  pv_contrib_give: () => okJson({ ok: true, state: 'login' }),
  /* 給与の区域（cmp-pay）の中央値。鍵の開いた一覧（pv_pay_rows が open）を返した場面でだけ呼ばれる。落ち着いた既定 ＝ 開いていない答え
     （中央値の器は何も描かない）。中央値を見る場面は stub で上書きする。給与の一覧（pv_pay_rows）の既定は置かない ── 用意しない場面では
     ほかの担当の呼び出しとして「準備中」になる（場面ごとに payFix の返事を渡す） */
  pv_company_pay: () => okJson({ ok: true, state: 'locked' }),
  /* ★2026-10-24 本番を合わせたあと：pv-proof.js（パイロットであることの確認）が、ログインした会員について1回だけ聞く。
       返らないと「未完了の呼び出し0」で落ち着いたことを見る場面（back の calm1 など）が時間切れになるので、止まっていない答えを置く。 */
  pv_proof_state: () => okJson({ state: 'none' }),
};

/* 給与の一覧（pv_pay_rows）の返事の材料（比較の給与の設計 I-9）。A・B ＝ 会社ごとの行（payRowFix で作る）。
   額はどれも検査が選んだ印（271828・314159 …）── 本物の額ではない。
     guest   鍵の無いゲスト：開いていない答え・give の鍵そのものが無い・行は「会社・出典・投稿時期」の3つだけ（サーバーが送る形）
     member  ログインした会員・給与を出していない：上と同じ行・give.basic false
     expired 自分の提出は在るのに鍵が開いていない（期限が切れた）：上と同じ行・give.basic true
     open    鍵の開いた人：全部の列の行
   返すのは返事の中身（body）。stub には { status: 200, body: payFix.open(A, B) } の形で渡す。 */
export const payRowFix = (airline, o = {}) => ({ airline, pos: 'cap', fleet: 'b787', ten: 1, tenk: 'r', annual_usd: 271828,
  verified: false, age: 1, far: false, ...o });
const payMask = (r) => ({ airline: r.airline, verified: !!r.verified, age: r.age });
const payGive = (basic) => ({ basic, detailed: false, payslip: false, full: false });
export const payFix = {
  guest: (A = [], B = []) => ({ ok: true, state: 'locked', rows: [...A, ...B].map(payMask) }),
  member: (A = [], B = []) => ({ ok: true, state: 'locked', give: payGive(false), rows: [...A, ...B].map(payMask) }),
  expired: (A = [], B = []) => ({ ok: true, state: 'locked', give: payGive(true), rows: [...A, ...B].map(payMask) }),
  open: (A = [], B = []) => ({ ok: true, state: 'open', give: payGive(true), rows: [...A, ...B] }),
};

/* 網の2枚目。assert-admin.mjs の NO_NAMES と1文字も違わない（assert-career-live.mjs の場面 net が見ている） */
export const NO_NAMES = '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE cdn.jsdelivr.net, '
  + 'EXCLUDE fonts.googleapis.com, EXCLUDE fonts.gstatic.com, EXCLUDE cdn.tailwindcss.com';

/* 使い捨ての保存先を立ち上げる（local-chain.mjs の bring() と同じ決まり：一時フォルダ・3000番は断る・止めたら丸ごと消す）。
   bring() と違うのは exec（SQL の文をそのまま流す ── --sql の場面で、壊したサーバーの写しを試すため）。 */
export async function startLocal() {
  const { start } = await import('./serve-local.mjs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-cmp-'));
  let local;
  try { local = await start({ port: 0, dir: tmp, quiet: true }); }
  catch (e) { fs.rmSync(tmp, { recursive: true, force: true }); throw e; }
  if (local.port === 3000 || local.port === 3100) {
    await local.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new Error(`${local.port} 番では立ち上げない（3000 ＝ 本番の DB につながっているプレビュー、3100 ＝ ほかの作業の番号）`);
  }
  let stopped = false;
  return {
    local, url: local.url, tmp,
    q: (sql, params) => local.locked(() => local.db.query(sql, params)),
    exec: (text) => local.locked(() => local.db.exec(text)),
    stop: async () => {
      if (stopped) return;
      stopped = true;
      try { await local.close(); }
      finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    },
  };
}

export async function launch() {
  return puppeteer.launch({ headless: 'shell', args: ['--no-sandbox', NO_NAMES] });
}

/* 手元の会員として入った時のログイン（{ session, pv_user, token }） */
export async function tokenOf(local, key) {
  const s = await seedOf(local.url, key);
  return { session: s.session, pv_user: s.pv_user, token: s.session.access_token };
}

/* ── 門 ───────────────────────────────────────────────────── */
const STOPPED = new WeakSet();
/* 止められた終わり方：門の abort（スクリプトの読み込みは Chrome が「.Inspector」を付ける）・ページが先に移って取り消した・閉じるまで止まったまま */
const STOP_ENDS = /^(net::ERR_BLOCKED_BY_CLIENT(\.Inspector)?|net::ERR_ABORTED|閉じるまで止まったまま)$/;
const isWeb = (u) => /^(https?|wss?):$/.test(u.protocol);

function replyTo(req, r) {
  return req.respond({
    status: (r && r.status) || 200,
    contentType: 'application/json; charset=utf-8',
    headers: { 'cache-control': 'no-store' },
    body: JSON.stringify(r && r.body !== undefined ? r.body : null),
  });
}
function stopOut(req, u, st) {
  STOPPED.add(req);
  if (/supabase\.(co|in|com)$/.test(u.hostname)) st.supa.push(`${req.method()} ${u.hostname}${u.pathname}`);
  else st.blocked.push(`${req.method()} ${u.host}`);
  return req.abort('blockedbyclient');
}
function rpcGate(req, name, st) {
  let b = null;
  try { b = JSON.parse(req.postData() || 'null'); } catch { b = null; }
  const p = b && typeof b === 'object' && 'p' in b ? b.p : b;
  const auth = req.headers().authorization || null;
  st.calls.push({ name, p, auth });
  /* holdIf（名前と送った p で選ぶ）：どの関数でも、その1本を止めておく（release で答える）。返事の stub より先に見る */
  if (st.holdIf && st.holdIf(name, p)) { (st.held[name] = st.held[name] || []).push(req); return undefined; }
  if (st.mode !== 'mock') return req.continue();
  const s = st.stub[name];
  if (s != null) {
    const r = typeof s === 'function' ? s(p, auth) : s;
    if (r === 'pass') return req.continue();
    if (r === 'hold') { (st.held[name] = st.held[name] || []).push(req); return undefined; }
    if (r === 'abort') return req.abort('failed');
    return replyTo(req, r);
  }
  if (SHELL.includes(name)) return req.continue();
  if (MINE.includes(name)) { st.unknown.push(name); return req.abort('failed'); }
  st.foreign.push(name);                       // ほかの担当の呼び出し：その欄は「準備中」になる（ここでは判定しない）
  return replyTo(req, { status: 404, body: { code: 'PGRST202', details: null, hint: null, message: `Could not find the function public.${name}` } });
}
function gate(req, origin, st) {
  let u;
  try { u = new URL(req.url()); } catch { return req.continue(); }
  if (!isWeb(u)) return req.continue();        // data: blob: about:
  /* holdUrl（住所で選ぶ）：部品の配信元（LIBS）への要求も、答えずに止めておける（st.heldUrl。答えるのは場面の側） */
  if (st.holdUrl && st.holdUrl(u.href)) { st.heldUrl.push(req); return undefined; }
  if (u.origin === origin) {
    const m = u.pathname.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/);
    if (m) return rpcGate(req, m[1], st);
    const t = u.pathname.match(/^\/rest\/v1\/([a-z0-9_]+)$/);
    if (t && st.mode === 'mock' && !SHELL.includes('table:' + t[1])) {
      st.foreign.push('table:' + t[1]);
      return replyTo(req, { status: 404, body: { code: 'PGRST205', details: null, hint: null, message: `Could not find the table public.${t[1]}` } });
    }
    return req.continue();                     // ページ・ログイン（/auth/v1・/__local）・表（local のとき）
  }
  if (LIBS.test(u.hostname)) return req.continue();
  return stopOut(req, u, st);
}
/* 見張り：外（ページの住所でも LIBS でもない行き先）へ向かった要求の結末を見る（読むだけ。止めも通しもしない） */
function watchNet(page, origin, st) {
  const live = st.inflight;
  const end = (r, how) => {
    const x = live.get(r);
    if (x === undefined) return;
    live.delete(r);
    if (!(STOPPED.has(r) && STOP_ENDS.test(how))) st.through.push(`${x}（${how}）`);
  };
  page.on('request', (r) => {
    let u;
    try { u = new URL(r.url()); } catch { return; }
    if (!isWeb(u) || u.origin === origin || LIBS.test(u.hostname)) return;
    live.set(r, `${r.method()} ${u.host}${u.pathname}`);
  });
  page.on('requestfinished', (r) => end(r, '返事が届いた'));
  page.on('requestfailed', (r) => end(r, (r.failure() && r.failure().errorText) || '失敗'));
  page.on('close', () => { for (const r of [...live.keys()]) end(r, '閉じるまで止まったまま'); });
}

/* 1枚開いて、その住所へ移る。
   who  = serve-local.mjs の MEMBERS の key（null ＝ ログインしていない人）。ページのどのスクリプトよりも先にログインを置き、
          Give → Get の板は「さっき見た」ことにする（local-chain.mjs の open と同じ置き方。板ではなく、その下の画面を見る）。
   mode = 'mock'（返事は stub が作る）| 'local'（手元の SQL が答える）
   url  = 手元の住所（/ から。会社のページ・カードの画面も）
   holdIf  = (name, p) → true のとき、その関数の呼び出しを答えずに止めておく（st.held[name]。release で答える）。名前を問わない
   holdUrl = (href) → true のとき、その住所への要求（部品の配信元も）を答えずに止めておく（st.heldUrl。答える・切るのは場面の側）
   before  = ページのどのスクリプトよりも先に流す関数（evaluateOnNewDocument。場面の書き留め役を置く）
   st   = { mode, stub, calls: [{ name, p, auth }], unknown, foreign, supa, blocked, through, held, heldUrl, holdIf, holdUrl,
            inflight, errs } */
export async function open(browser, local, sizeKey, { who = null, mode = 'mock', stub = {}, url = '/career.html?view=compare&a=jal&b=ana',
  holdIf = null, holdUrl = null, before = null } = {}) {
  const size = SIZES[sizeKey];
  if (!size) throw new Error('知らない大きさ: ' + sizeKey);
  const [w, h, touch] = size;
  const origin = new URL(local.url).origin;
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const st = { mode, stub: { ...BASE_STUB, ...stub }, calls: [], unknown: [], foreign: [], supa: [], blocked: [], through: [],
    held: {}, heldUrl: [], holdIf, holdUrl, inflight: new Map(), errs: [] };
  if (before) await page.evaluateOnNewDocument(before);
  page.setDefaultTimeout(20000);
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: !!touch, hasTouch: !!touch });
  watchNet(page, origin, st);
  await page.setRequestInterception(true);
  page.on('request', (req) => gate(req, origin, st));
  page.on('pageerror', (e) => st.errs.push(String(e.message).slice(0, 160)));
  const seed = who ? await seedOf(local.url, who) : null;
  await page.evaluateOnNewDocument((origin, s) => {
    if (location.origin !== origin) return;
    try {
      if (localStorage.getItem('pv_local_seeded')) return;
      localStorage.setItem('pv_local_ui', '0');          // 会員を切り替える札は隠す（左下に重なる）
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
  await page.goto(local.url + url, { waitUntil: 'domcontentloaded' });
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    try { if (!page.isClosed()) await page.close(); } catch { /* もう閉じている */ }
    try { await ctx.close(); } catch { /* もう閉じている */ }
  };
  return { page, ctx, st, close };
}

/* 止めておいた（stub が 'hold' を返した）要求のうち、その名前のいちばん古いものに答える。reply = { status, body } | 'pass' | 'abort' */
export function release(st, name, reply) {
  const q = st.held[name];
  const r = q && q.shift();
  if (!r) return false;
  if (reply === 'pass') r.continue();
  else if (reply === 'abort') r.abort('failed');
  else replyTo(r, reply);
  return true;
}

/* 比較の画面の n 番目のその欄（無ければ null）。why ＝ data-why を持つ最初の要素の値 */
export async function slot(page, kind, nth = 0) {
  return page.evaluate((kind, nth) => {
    const b = document.querySelectorAll(`#cr [data-view="compare"] .crl[data-live="${kind}"]`)[nth];
    if (!b) return null;
    const w = b.matches('[data-why]') ? b : b.querySelector('[data-why]');
    return { state: b.getAttribute('data-state'), why: w ? w.getAttribute('data-why') : null, part: b.getAttribute('data-part'),
      text: b.innerText, html: b.outerHTML, h: b.getBoundingClientRect().height };
  }, kind, nth);
}

/* 条件が満たされるまで待つ（時間では待たない ── CLAUDE.md「時間で待つ検査は、混んだ回に嘘の赤を出す」）。満たされなければ false */
export function until(page, fn, arg) {
  return page.waitForFunction(fn, { timeout: 8000, polling: 100 }, arg).then(() => true, () => false);
}

/* その欄が取った顔を、全部書き留める（"状態|字" の並び）。seen(page) が返す */
export async function watch(page, kind, nth = 0) {
  await page.evaluate((kind, nth) => {
    const b = document.querySelectorAll(`#cr [data-view="compare"] .crl[data-live="${kind}"]`)[nth];
    const list = window.__crlSeen = window.__crlSeen || [];
    if (!b) { list.push(`${kind}#${nth}|（欄が無い）`); return; }
    const note = () => {
      const s = `${b.getAttribute('data-state')}|${b.innerText}`;
      if (list[list.length - 1] !== s) list.push(s);
    };
    note();
    new MutationObserver(note).observe(b, { childList: true, subtree: true, characterData: true, attributes: true });
  }, kind, nth);
}
export async function seen(page) {
  return page.evaluate(() => (window.__crlSeen || []).slice());
}

/* 同じブラウザの、もう1枚のタブ（保存領域は同じ。こちらで書くと、最初のタブに「書かれた」という合図が届く）。
   assert-contrib.mjs の otherTab / loginIn の写し（手元の住所は local.url）。外への行き先は止める。 */
export async function otherTab(ctx, local) {
  const origin = new URL(local.url).origin;
  const first = (await ctx.pages())[0];
  const t = await ctx.newPage();
  await t.setRequestInterception(true);
  t.on('request', (req) => {
    let u;
    try { u = new URL(req.url()); } catch { return req.continue(); }
    if (!isWeb(u) || u.origin === origin || LIBS.test(u.hostname)) return req.continue();
    STOPPED.add(req);
    return req.abort('blockedbyclient');
  });
  await t.goto(local.url + '/pv-vocab.json', { waitUntil: 'domcontentloaded' });
  if (first) await first.bringToFront();             // 最初のタブを前へ戻す（裏のタブでは、描画に合わせた待ちが進まない）
  return t;
}
export async function loginIn(tab, local, key) {
  const s = await seedOf(local.url, key);
  await tab.evaluate((x) => {
    localStorage.setItem('sb-local-auth-token', JSON.stringify(x.session));
    localStorage.setItem('pv_user', JSON.stringify(x.pv_user));
  }, s);
}
export async function logoutIn(tab) {
  await tab.evaluate(() => { localStorage.removeItem('sb-local-auth-token'); localStorage.removeItem('pv_user'); });
}

/* ── ブラウザの「戻る」で、ページが手元から戻る（back-forward cache）検査の道具 ─────────────────────
   assert-keep.mjs の場面 bfcache（KA8）が確かめた3つの置き方でだけ、ブラウザはページを手元に置く（どれか1つ欠けると、戻るたびに読み直す）:
     ① 新しい headless（bfLaunch ── headless: true。'shell' は置かない：BackForwardCacheDisabledForDelegate）
     ② 要求を横取りしない（setRequestInterception を使わない ── 上の open() の門は使えない）。代わりの網は、名前を引けるのが
        localhost と LIBS だけ（NO_NAMES）。外への要求は数える（*.supabase.* は st.supa、名前が引けずに終わったものは st.blocked、
        それ以外の終わり方はどれも st.through ＝ すり抜け）
     ③ サイトのファイルの no-store を GitHub Pages と同じ max-age=600 に替える口（pagesFront）
   pagesFront は assert-keep.mjs の pagesFront の写し（1字も替えていない。あちらは場面の中の関数で、読み込めないため）。 */
export async function pagesFront(base) {
  const to = new URL(base);
  const srv = http.createServer((req, res) => {
    const up = http.request({ host: '127.0.0.1', port: to.port, path: req.url, method: req.method, headers: { ...req.headers, host: to.host } }, (r) => {
      const h = { ...r.headers };
      if (!/^\/(rest|auth|functions|storage|realtime)\/v1(\/|$)|^\/__local\//.test(req.url) && /no-store/.test(h['cache-control'] || '')) h['cache-control'] = 'max-age=600';
      res.writeHead(r.statusCode, h);
      r.pipe(res);
    });
    up.on('error', () => { res.writeHead(502); res.end(); });
    req.pipe(up);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  if (port === 3000) { srv.close(); throw new Error('3000 番は使わない'); }
  return { base: `http://localhost:${port}`, close: () => new Promise((r) => { srv.close(r); srv.closeAllConnections?.(); }) };
}
export async function bfLaunch() {
  return puppeteer.launch({ headless: true, args: ['--no-sandbox', NO_NAMES] });
}
/* 1枚開く（横取りしない）。front ＝ pagesFront の返り（ページはこの口から読む）。local ＝ startLocal() の返りの local
   （ログインを作る相手）。who ＝ serve-local.mjs の MEMBERS の key（null ＝ ログインしていない人。置き方は open() と同じ）。
   ページのどのスクリプトよりも先に、pageshow の控え（window.__ps ＝ [{ p: persisted, t }]）を置く。
   noBc ＝ BroadcastChannel を外す（KA8 ③④ と同じ：ログインの知らせが届くと、ブラウザが手元のページを捨てる）。
   返す { page, ctx, st, close }（st は open() と同じ形 ── 場面の終わりの確かめがそのまま読める） */
export async function bfOpen(browser, front, local, sizeKey, { who = null, url = '/career.html?view=compare&a=jal&b=ana', noBc = false } = {}) {
  const size = SIZES[sizeKey];
  if (!size) throw new Error('知らない大きさ: ' + sizeKey);
  const [w, h, touch] = size;
  const origin = new URL(front.base).origin;
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const st = { mode: 'local', stub: {}, calls: [], unknown: [], foreign: [], supa: [], blocked: [], through: [],
    held: {}, heldUrl: [], holdIf: null, holdUrl: null, inflight: new Map(), errs: [] };
  page.setDefaultTimeout(20000);
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: !!touch, hasTouch: !!touch });
  const out = new Map();
  page.on('request', (r) => {
    let u;
    try { u = new URL(r.url()); } catch { return; }
    if (!isWeb(u) || u.origin === origin || LIBS.test(u.hostname)) return;
    if (/supabase\.(co|in|com)$/.test(u.hostname)) st.supa.push(`${r.method()} ${u.host}${u.pathname}`);
    else out.set(r, `${r.method()} ${u.host}${u.pathname}`);
  });
  const end = (r, how) => {
    const x = out.get(r);
    if (x === undefined) return;
    out.delete(r);
    if (how === 'net::ERR_NAME_NOT_RESOLVED') st.blocked.push(x); else st.through.push(`${x}（${how}）`);
  };
  page.on('requestfinished', (r) => end(r, '返事が届いた'));
  page.on('requestfailed', (r) => end(r, (r.failure() && r.failure().errorText) || '失敗'));
  page.on('pageerror', (e) => st.errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', (x) => { x.accept().catch(() => {}); });
  const seed = who ? await seedOf(local.url, who) : null;
  await page.evaluateOnNewDocument((origin, s, nb) => {
    window.__ps = [];
    window.addEventListener('pageshow', (e) => { window.__ps.push({ p: e.persisted, t: Date.now() }); });
    if (nb) { try { window.BroadcastChannel = undefined; } catch (e) { /* 消せなければそのまま */ } }
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
  }, origin, seed, !!noBc);
  await page.goto(front.base + url, { waitUntil: 'load', timeout: 60000 });
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    for (const r of [...out.keys()]) end(r, '閉じるまで止まったまま');
    try { if (!page.isClosed()) await page.close(); } catch { /* もう閉じている */ }
    try { await ctx.close(); } catch { /* もう閉じている */ }
  };
  return { page, ctx, st, close };
}
/* ページの中のリンクを押して、ほかのページへ移る（人が押すのと同じ、ページから始まる移動）。sel ＝ そのページに在るリンク */
export async function bfLeave(page, sel) {
  await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }),
    page.evaluate((s) => { const a = document.querySelector(s); if (!a) throw new Error('リンクが無い: ' + s); a.click(); }, sel)]);
}
/* 「戻る」を押し、戻ったページの pageshow が届くまで待つ。返す ＝ 手元から戻ったか（pageshow の persisted）と、
   戻らなかった時のブラウザの言い分（読み直したページの notRestoredReasons） */
export async function bfBack(page) {
  const t0 = Date.now();
  await page.goBack({ waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction((t) => {
    const a = window.__ps;
    return Array.isArray(a) && a.length > 0 && a[a.length - 1].t >= t && document.readyState === 'complete';
  }, { timeout: 30000 }, t0);
  const persisted = await page.evaluate(() => window.__ps[window.__ps.length - 1].p === true);
  const why = persisted ? '' : await page.evaluate(() => {
    try {
      const n = performance.getEntriesByType('navigation')[0], r = n && n.notRestoredReasons;
      const w = []; const walk = (x) => { if (!x) return; (x.reasons || []).forEach((y) => w.push(y.reason || String(y))); (x.children || []).forEach(walk); };
      walk(r);
      return w.length ? w.join(',') : (n ? n.type : '?');
    } catch (e) { return '?'; }
  }).catch(() => '?');
  return { persisted, why };
}

/* ── 読む人（完了確認の「ゲスト／給与資格のみ／口コミ資格のみ／双方あり／期限切れ」）──────────────────────────
   makeReaders(local, { via }) ── 比較の検査（口コミ・給与・リンクとカードの3つの区域）が使う、ただ1つの読む人の作り方。
   表は比較の設計の1つ（リンクとカードの I-5 ＝ 口コミの E8.3。'pilot' の行は LC-A5 で直したもの）。会員は serve-local.mjs の MEMBERS。
     ゲスト  ログインしない・何も送らない                                                   鍵なし
     pilot   何も送らない（VERIFIED PILOT（模擬・ホテルを見られる）・給与の鍵も口コミの鍵も無い）   鍵なし
     a       JAL に口コミ：6つの点数 5,4,3,4,5,3・給与とワークライフバランスのひとこと               口コミの鍵だけ
     b       JAL に口コミ 3,3,3,3,3,3 と ANA に口コミ 4,4,4,5,4,4（どちらも同じ2つのひとこと）          2人目（件数を作る）
     c       JAL に口コミ：2つのひとことだけ・点数なし（'call' でしか作れない）／ANA に給与を1件        両方の鍵（自分の会社 ANA）
     pay     JAL に給与を1件・口コミなし                                                          給与の鍵だけ（自分の会社 JAL）
   → JAL：数える投稿 3件（a・b・c）・点数の付いた投稿 2件（4.0 と 3.0 → 3.5）／ANA：1件（b ── 25 ÷ 6）。ほかの会社には何も無い。
   ★書くのはこの表のものだけ。ほかの会員は何も出さない。鍵を手で書かない（期限切れは、使う場面が最後に q() で作る1回だけ。
     先へ延ばす書き込みはどこにも無い）。空でない保存先には作らない（同じ人の2件目が混ざる）。
   ★作り終えたら、6人の鍵をサーバーに聞き直す（口コミ ＝ その会員として rpc pv_has_review_key・給与 ＝ profiles.access_until）。
     表と1つでも違えば投げる（表と違う読む人で場面を歩かない）。
   via 'call'  口コミ ＝ その会員として POST /rest/v1/reviews_v2（投稿の画面 submit-review.html と同じ表・同じ列の名前）。
                 proof_hash はサーバーの式そのもの（public.pv_review_hash を q() で呼ぶ ── db/reviews-gate.sql の
                 「proof_hash = SHA-256(user_id || '::pv_anon::' || 航空会社コード || '::2026')」）。
               給与 ＝ その会員として rpc submit_pay_report。中身は db/test-work-months.mjs の PAY と同じ形（機長・月 17,000 USD）・
                 先月ぶん（月は保存先の時計から取る）。
   via 'form'  まだ無い ── 手元のサーバーで投稿の画面が最後まで送れるかの試し（P5.5・prestudy/PROBE-serve-local.txt）がまだ無いので、
               呼ぶと投げる。結果の行には、いつも via を書く。
   ひとことの字は readerText(会員, 会社, 分類)。最後に印 readerMark(…) が付く ── 誰にでも見える抜粋（先頭40字）より後ろ ＝
   その印が画面に出るのは、本文を受け取った人だけ。
   local  ＝ startLocal() の返り（{ url, q }）か、serve-local.mjs の start() の返り（{ url, db, locked }）。
   返す { via, did, readers }：did ＝ 投稿1件に1行（何を・どの口へ・返事）、readers ＝ 読む人1人に1行（送ったもの・聞き直した鍵）。 */
export const READERS = [
  { key: null,    ja: 'ゲスト',                                                   rev: false, pay: false },
  { key: 'pilot', ja: 'VERIFIED PILOT（模擬・ホテルを見られる）・給与の鍵も口コミの鍵も無い', rev: false, pay: false },
  { key: 'a',     ja: '口コミ資格のみ',                                           rev: true,  pay: false },
  { key: 'b',     ja: '2人目の口コミ（件数を作る）',                              rev: true,  pay: false },
  { key: 'c',     ja: '双方あり（自分の会社 ANA）',                               rev: true,  pay: true },
  { key: 'pay',   ja: '給与資格のみ（自分の会社 JAL）・期限切れは使う場面が最後に作る', rev: false, pay: true },
];
export const READER_POSTS = [
  { key: 'a',   kind: 'review', airline: 'jal', scores: [5, 4, 3, 4, 5, 3] },
  { key: 'b',   kind: 'review', airline: 'jal', scores: [3, 3, 3, 3, 3, 3] },
  { key: 'b',   kind: 'review', airline: 'ana', scores: [4, 4, 4, 5, 4, 4] },
  { key: 'c',   kind: 'review', airline: 'jal', scores: null },
  { key: 'c',   kind: 'pay',    airline: 'ana' },
  { key: 'pay', kind: 'pay',    airline: 'jal' },
];
const READER_SCORES = ['culture_score', 'salary_score', 'benefits_score', 'wlb_score', 'ops_score', 'training_score'];
const READER_CATS = { salary: '給与', wlb: 'ワークライフバランス' };
export const readerMark = (key, slug, cat) => `ZZ${key}-${slug}-${cat}ZZ`;
export const readerText = (key, slug, cat) =>
  `手元の検査のための口コミです（実在の投稿ではありません）。会員${key}が${slug}の${READER_CATS[cat]}について書きました。${readerMark(key, slug, cat)}`;
/* db/test-work-months.mjs の PAY と同じ形（会社・機材・月は makeReaders が足す） */
const READER_PAY = { currency: 'USD', lang: 'en', tax_rate_pct: 0, position: 'cap',
  base_pay: 9000, flight_variable_pay: 4000, other_allowance: 4400, command_pay: 2000, per_diem: 1000, housing_type: 'allowance', housing_amount: 600 };

export async function makeReaders(local, { via = 'call' } = {}) {
  if (via === 'form') {
    throw new Error("via 'form' はまだ無い（手元で投稿の画面が送れるかの試し P5.5 ── prestudy/PROBE-serve-local.txt ── がまだ無い）。--via call で走らせる");
  }
  if (via !== 'call') throw new Error('via は call か form: ' + via);
  const base = local && local.url;
  const q = local && (local.q || (local.db && local.locked ? (sql, p) => local.locked(() => local.db.query(sql, p)) : null));
  if (!base || !q) throw new Error('makeReaders: local は startLocal() か start() の返りを渡す');
  const one = async (sql, p) => (await q(sql, p)).rows[0];
  const had = await one(`select (select count(*) from public.reviews_v2)::int as r, (select count(*) from public.pay_reports)::int as p`);
  if (had.r || had.p) throw new Error(`読む人は空の保存先にだけ作る（口コミ ${had.r} 件・給与 ${had.p} 件が先に在る）`);
  const { MEMBERS } = await import('./serve-local.mjs');
  const M = Object.fromEntries(MEMBERS.map((m) => [m.key, m]));
  const fleet = (await one(`select code from public.pv_fleets where active order by code limit 1`)).code;
  const per = await one(`select extract(year from d)::int as y, extract(month from d)::int as m
                           from (select date_trunc('month', now()) - interval '1 month' as d) x`);
  const did = [];
  for (const P of READER_POSTS) {
    const s = await seedOf(base, P.key);
    if (P.kind === 'review') {
      const h = (await one(`select public.pv_review_hash($1::uuid, $2) as h`, [M[P.key].id, P.airline])).h;
      const row = { proof_hash: h, airline: P.airline, orig_lang: 'ja',
        salary_comment: readerText(P.key, P.airline, 'salary'), wlb_comment: readerText(P.key, P.airline, 'wlb') };
      if (P.scores) READER_SCORES.forEach((k, i) => { row[k] = P.scores[i]; });
      const r = await fetch(`${base}/rest/v1/reviews_v2`, { method: 'POST', body: JSON.stringify(row),
        headers: { 'content-type': 'application/json', authorization: `Bearer ${s.session.access_token}`, prefer: 'return=minimal' } });
      const text = await r.text();
      const n = (await one(`select count(*)::int as n from public.reviews_v2 where proof_hash = $1 and airline = $2`, [h, P.airline])).n;
      if (r.status !== 201 || n !== 1) throw new Error(`${P.key} の口コミ（${P.airline}）が保存されない: ${r.status} ${text.slice(0, 200)}・行 ${n}`);
      did.push(`${P.key}: 口コミ ${P.airline}（点数 ${P.scores ? P.scores.join(',') : 'なし'}・給与とワークライフバランスのひとこと）── `
        + `その会員として POST /rest/v1/reviews_v2 → ${r.status}・保存先に1行（via call）`);
    } else {
      const p = { ...READER_PAY, fleet, airline: P.airline, period_year: per.y, period_month: per.m };
      const r = await rpcAs(base, P.key, 'submit_pay_report', p);
      if (r.status !== 200 || !r.body || r.body.access_until == null) {
        throw new Error(`${P.key} の給与（${P.airline}）が保存されない: ${r.status} ${r.text.slice(0, 200)}`);
      }
      did.push(`${P.key}: 給与 ${P.airline}（${per.y}年${per.m}月・機長・${fleet}・月 17,000 USD）── `
        + `その会員として rpc submit_pay_report → ${r.status}・鍵の期限が返った（via call）`);
    }
  }
  /* 6人の鍵を、サーバーに聞き直す（ゲストはログインが無いので、どちらの鍵も持てない ── 聞く口が無い） */
  const readers = [], bad = [];
  for (const R of READERS) {
    const sent = READER_POSTS.filter((P) => P.key === R.key)
      .map((P) => (P.kind === 'review' ? `口コミ ${P.airline}` : `給与 ${P.airline}`)).join('・') || '何も送っていない';
    if (!R.key) { readers.push(`ゲスト: ログインしない・${sent}（鍵を聞く口が無い ＝ どちらの鍵も無い）`); continue; }
    const s = await seedOf(base, R.key);
    const r = await fetch(`${base}/rest/v1/rpc/pv_has_review_key`, { method: 'POST', body: '{}',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${s.session.access_token}` } });
    const t = await r.text();
    const rev = r.status === 200 ? t.trim() === 'true' : null;
    const pay = !!(await one(`select coalesce(access_until > now(), false) as v from public.profiles where id = $1`, [M[R.key].id])).v;
    if (rev !== R.rev || pay !== R.pay) bad.push(`${R.key}（口コミの鍵 ${rev}・給与の鍵 ${pay}／表では ${R.rev}・${R.pay}）`);
    readers.push(`${R.key}: ${R.ja} ── ${sent}（via call）。サーバーに聞き直した鍵：口コミ ${rev ? 'あり' : 'なし'}・給与 ${pay ? 'あり' : 'なし'}`);
  }
  if (bad.length) throw new Error('表と違う読む人になった: ' + bad.join(' ／ '));
  return { via, did, readers };
}
