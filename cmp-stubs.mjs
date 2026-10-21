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
     startLocal（SQL をそのまま流せる exec を持つ）・MOCK の門と open・slot / until / watch / seen・otherTab / loginIn / logoutIn。

   使い方（assert-career-live.mjs が手本）
     const env = await H.startLocal();                                   // { local, url, q, exec, tmp, stop }
     const browser = await H.launch();
     const { page, st, close } = await H.open(browser, env.local, 'pc', { stub: { pv_reviews: (p) => ({ status: 200, body: { ok: true, rows: [] } }) } });
     await H.until(page, () => document.querySelector('.crl[data-live="cmp-stars"][data-state="empty"]'));
     await close(); await browser.close(); await env.stop();
*/
import fs from 'node:fs';
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
   st   = { mode, stub, calls: [{ name, p, auth }], unknown, foreign, supa, blocked, through, held, inflight, errs } */
export async function open(browser, local, sizeKey, { who = null, mode = 'mock', stub = {}, url = '/career.html?view=compare&a=jal&b=ana' } = {}) {
  const size = SIZES[sizeKey];
  if (!size) throw new Error('知らない大きさ: ' + sizeKey);
  const [w, h, touch] = size;
  const origin = new URL(local.url).origin;
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const st = { mode, stub: { ...BASE_STUB, ...stub }, calls: [], unknown: [], foreign: [], supa: [], blocked: [], through: [],
    held: {}, inflight: new Map(), errs: [] };
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
