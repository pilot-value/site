/* local-chain.mjs — 手元の保存先（serve-local.mjs）で「保存して・読み直す」検査のための枠（2026-10-16）。

   何のためか
     ブラウザの外からの呼び出し（rpcAs）と、ブラウザの中の画面（open）を、同じ使い捨ての保存先に向けて、
     本物の SQL とつながった画面を最初から最後まで歩くため。ホテル・ステイの検査（assert-stays.mjs）が使い、
     街の検査（assert-towns.mjs）も同じ名前で読む（LIBS・bring・seedOf・rpcAs・loginAs・open）。

   ★本番にも 3000 番にも1回も通信しない。
     保存先は毎回新しい一時フォルダ（stop() で丸ごと消す）。ポートは空いているものを OS に選ばせ、
     3000 番になったら立ち上げない。ブラウザの通信は門（gate）を通る ── 手元の口と、書体・部品の配信元（LIBS）
     だけを通し、*.supabase.* は st.supa に、ほかの行き先は st.blocked に書き留めて止める
     （検査の側は、どちらも空であることを最後に見る）。

   ⚠️ assert-contrib.mjs の道具（gate・open・ログインの仕込み・rpcAs・failNext）を、字として写したもの。
      あちらの道具は main() の中の閉じた関数なので import できない（あちらは直さない）。
   ⚠️ 手元の会員（serve-local.mjs の MEMBERS）は模擬。ここで通ったことは、本番で通った証拠にはならない。

   使い方
     const L = await bring();                         // { base, q, failNext, failOff, stop }
     const { ctx, page, st } = await open(browser, L.base, { who: 'op', w: 1440, h: 820 });
     await page.goto(L.base + '/airlines/jal.html#stay-CTS');
     const r = await rpcAs(L.base, null, 'pv_stays', { airline: 'jal', iata: 'CTS' });   // null ＝ ログインなし
     await L.stop();
*/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { start } from './serve-local.mjs';

/* 通してよい外の行き先（書体と部品の配信元）。assert-contrib.mjs の LIBS と同じ字。 */
export const LIBS = /^(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.tailwindcss\.com)$/;

/* 使い捨ての保存先を立ち上げる。
   q        保存先へ直接（DB の持ち主として）。サーバーの要求と同じ列に並ぶ（locked）。
   failNext 次の n 本の、match を含む要求をわざと失敗させる（mode 'drop' ＝ 通信そのものを切る）。
   stop     サーバーを止め、保存先のフォルダを消す。 */
export async function bring() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-chain-'));
  let local;
  try { local = await start({ port: 0, dir, quiet: true }); }
  catch (e) { fs.rmSync(dir, { recursive: true, force: true }); throw e; }
  if (local.port === 3000) {
    await local.close();
    fs.rmSync(dir, { recursive: true, force: true });
    throw new Error('3000 番では立ち上げない（本番の DB につながっているプレビューの番号）');
  }
  const base = local.url;
  const q = (sql, params) => local.locked(() => local.db.query(sql, params));
  const failNext = (match, mode, n = 1) =>
    fetch(`${base}/__local/fail?n=${n}&match=${encodeURIComponent(match)}${mode ? '&mode=' + mode : ''}`);
  const failOff = () => fetch(`${base}/__local/fail?n=0`);
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    try { await local.close(); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); }
  };
  return { base, q, failNext, failOff, stop };
}

/* 手元の会員として入った時のログインの中身（{ session, pv_user }）。入れなければ投げる。 */
export async function seedOf(base, member) {
  let s = null;
  try { s = await (await fetch(`${base}/__local/login?member=${encodeURIComponent(member)}`)).json(); } catch { s = null; }
  if (!s || !s.session) throw new Error(`手元の会員 ${member} で入れない`);
  return s;
}

/* ブラウザの外から、その会員として関数を呼ぶ（引数は {p} の1つ）。member が null ならログインなし
   （authorization を付けない）。返すのは { status, body（読めた JSON。読めなければ null）, text（返事の字そのまま）}。 */
export async function rpcAs(base, member, fn, p) {
  const headers = { 'content-type': 'application/json' };
  if (member) headers.authorization = `Bearer ${(await seedOf(base, member)).session.access_token}`;
  const r = await fetch(`${base}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify({ p }) });
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = null; }
  return { status: r.status, body, text };
}

/* 開いているページのログインを、その会員のものに入れ替える（場面の側が、そのあと読み直すか移る）。 */
export async function loginAs(page, base, member) {
  const s = await seedOf(base, member);
  await page.evaluate((x) => {
    localStorage.setItem('sb-local-auth-token', JSON.stringify(x.session));
    localStorage.setItem('pv_user', JSON.stringify(x.pv_user));
  }, s);
}

/* 門。手元の口は通す（関数の名前と送った p を書き留める）。LIBS は通す。*.supabase.* は st.supa、
   ほかの行き先は st.blocked に書き留めて止める。 */
function gate(req, origin, st) {
  let u;
  try { u = new URL(req.url()); } catch { return req.continue(); }
  if (u.protocol === 'data:' || u.protocol === 'blob:' || u.protocol === 'about:') return req.continue();
  if (u.origin === origin) {
    const m = u.pathname.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/);
    if (m) {
      st.calls.push(m[1]);
      let p = null;
      try { const b = JSON.parse(req.postData() || 'null'); p = b && typeof b === 'object' && 'p' in b ? b.p : b; } catch { p = null; }
      st.sent.push({ fn: m[1], p });
    }
    return req.continue();
  }
  if (LIBS.test(u.hostname)) return req.continue();
  if (/supabase\.(co|in|com)$/.test(u.hostname)) st.supa.add(`${req.method()} ${u.hostname}${u.pathname}`);
  else st.blocked.add(`${req.method()} ${u.hostname}`);
  return req.abort();
}

/* 1枚開く（まだどこへも移らない。場面の側が page.goto する）。
   o  = { who: null | 会員の key, w, h, touch: false, theme: null, board: false }
   st = { calls: [関数の名前を順に], sent: [{ fn, p }], got: [{ fn, status, text }], blocked: Set, supa: Set, errs: [] }
        got は手元の口（/rest/v1・/auth/v1）の返事の字（関数の返事は fn ＝ 関数の名前、ほかは fn ＝ 道の名前）。
   who を渡すと、ページのどのスクリプトよりも先に、その会員のログインを保存領域へ置く（assert-contrib.mjs と同じ置き方）。
   board:false なら Give → Get の板は「さっき見た」ことにする（板ではなく、その下の画面を見る）。
   board:true なら置かない（訪れた人と同じく、板に出会う）。 */
export async function open(browser, base, o = {}) {
  const { who = null, w = 1440, h = 820, touch = false, theme = null, board = false } = o;
  const origin = new URL(base).origin;
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const st = { calls: [], sent: [], got: [], blocked: new Set(), supa: new Set(), errs: [] };
  page.setDefaultTimeout(20000);
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch });
  await page.setRequestInterception(true);
  page.on('request', (req) => gate(req, origin, st));
  page.on('response', async (res) => {
    let u;
    try { u = new URL(res.url()); } catch { return; }
    if (u.origin !== origin || !/^\/(rest|auth)\/v1\//.test(u.pathname)) return;
    const m = u.pathname.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/);
    let text = '';
    try { text = await res.text(); } catch { text = ''; }
    st.got.push({ fn: m ? m[1] : u.pathname, status: res.status(), text });
  });
  page.on('pageerror', (e) => st.errs.push(String(e.message).slice(0, 160)));
  const seed = who ? await seedOf(base, who) : null;
  await page.evaluateOnNewDocument((origin, s, th, board) => {
    if (location.origin !== origin) return;
    try {
      if (localStorage.getItem('pv_local_seeded')) return;
      localStorage.setItem('pv_local_ui', '0');          // 会員を切り替える札は隠す（左下に重なる）
      if (th) localStorage.setItem('pv-theme', th);
      if (s) {
        const now = String(Date.now());
        localStorage.setItem('sb-local-auth-token', JSON.stringify(s.session));
        localStorage.setItem('pv_user', JSON.stringify(s.pv_user));
        localStorage.setItem('pv_last_active', now);
        localStorage.setItem('pv_session_start', now);
        if (!board) {
          const at = Date.parse((s.session.user || {}).last_sign_in_at || '');
          localStorage.setItem('pv_give_seen', JSON.stringify({ t: Date.now(), s: String(isNaN(at) ? now : at) }));
        }
      }
      localStorage.setItem('pv_local_seeded', '1');
    } catch (e) { /* 保存領域に触れない画面はそのまま */ }
  }, origin, seed, theme, board);
  return { ctx, page, st };
}
