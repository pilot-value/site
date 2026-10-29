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
     ・場面 walk（W-walk・2026-10-24）── 読む人ゲストと c（両方の鍵）× 3組、1440×820。1つのタブで：
         (1) 会社ページ airlines/{a}.html の推定年収（機長・副操縦士）・評価の平均・評価件数・投稿件数を読む
         (2)「他社と比較」→ ?view=compare&a={a}&b=…（JAL は既定の相手キャセイパシフィックから ANA へ選び直す・エバーは JAL へ）
         (3) 比較の {a} の側が (1) と同じ・2社とも保存先（q()）から作り直した数と同じ
         (4) 入れ替え → 住所・並び・比較の欄が全部 b|a・2社のほかの会社の字が無い
         (5) {a} の口コミの「詳しく」→ /airlines/{a}.html#reviews（会社ページは口コミのタブ）
         (6) 戻る（読み込み直す道 ── 離れる前に unload の聞き手を置く）→ 同じ住所・同じ並び・足の位置が出る前と 2px のうち・同じ数
         (7)「カードを保存」→ ?view=card&a={b}&b={a}・材料の2社は [b, a]・推定年収と評価が (3) と同じ・2社の住所と QR が台帳のとおり
         (8) 書き留め役：カードに描いた字にも材料にも、この読む人が読める行（会員の口コミの本文・提出された年収の額）と
             運営が通したホテルの名前が無い
         B6（戻るの2本目・手元から戻る道）── 新しいタブで比較 b|a → {a} の口コミの「詳しく」→ 離れているあいだに {a} へ口コミを1件
             （q()）→ 戻る。手元から戻ったか（離れる前の印・pageshow の persisted）を毎回確かめ、戻らなければ新しいタブで最初から
             （5回まで。5回とも戻らなければ赤「手元から戻らなかった（証明できない）」）。戻った瞬間も、口コミの欄が静かに取り直して
             1件多い数を描いたあとも、足の位置は出る前と 2px のうち。足した1件は終わりに消す（次の組は種のままの数で歩く）。
         ホテル（LC-A5）── ログインしない人の追加（pv_stay_add・画面が送る形）でエティハドの成田に「ZZホテルZZ」を足し、
             運営 op が待ち行列（pv_stay_queue）から通す（pv_stay_moderate）。pilot（承認された人・模擬）として1つの文書で
             career.html の成田の画面にその名前が見える（前提 ── 見えなければ「この場面は落ちることができない」で赤）→ 同じ文書でカードを開き、
             描いた字にも材料にもその名前が無い。ゲストと c は、その読む人の pv_stays の答えが鍵の1行だけ（ホテルが届かない）。
     ・場面 readers（W-readers）── 空の保存先に makeReaders の6人。JAL｜ANA を ゲスト → pilot → a → c → pay → 期限切れの pay の順に：
         欄ごとの顔（data-state と錠の1行）が表のとおり／口コミの本文（会員の投稿の印）は口コミの鍵のある人だけ・ほかの人には
         口コミの Give & Get が1つ／顔 a・b と入口（給与の入口は1つまで・「ログイン」はゲストにだけ）／同じ読む人が会社ページ
         airlines/jal.html と比較で同じ公開の数（推定年収・評価・件数 ＝ q()）。期限切れは場面が最後に q() で作る1回だけ
         （鍵を先へ延ばす書き込みはどこにも無い）。DEEP PAY の欄は1行の知らせだけ（設計済み・別の会話の作業待ち）。
     ・場面 fail（W-fail）── 手元のサーバーに次の pv_reviews を1本だけ 503 にさせ（/__local/fail?n=1&match=pv_reviews）、
         比較を開く → 片方の会社だけ「いま読み出せません」・もう片方は評価を出す・「やり直す」は箱に1つ → 押すと2社とも埋まる。
     ・場面 cur（W-cur）── 会社ページ airlines/jal.html でドル（PVCurrency.set）→「他社と比較」：見えている額に ¥ が無い
         （原貨の字 pv-no-cur のほか）・推定年収は会社ページと同じ字 → 入れ替え → カード：職位の額は比較と同じ字 →
         円に戻す：比較とカードの JAL の額は、最初に会社ページで読んだ円の字と1文字も違わない。
     ・門（どの場面も）── ブラウザを立ち上げる時に置く。要求の差し替え（setRequestInterception）は使わない ── 使うとブラウザが
       「戻る」の手元の置き場（back-forward cache）を使わなくなる。出てよいのは、この場面が起こした手元のサーバーの番号と、
       部品・書体の配信元（LIBS ＝ cmp-stubs.mjs）だけ。ほかの行き先は全部（ほかの localhost の番号も・数字の住所も）、
       この検査が立てた「断る口」（proxy）へ向かわせて断り、書き留め、その場面ごと赤くする。
       網をもう1枚：ブラウザは localhost と LIBS のほかの名前を引けない（cmp-stubs.mjs の NO_NAMES）。
       ★解析タグは serve-local.mjs が配る瞬間に外すので、門が断る要求は普段は1本も無い（0 であることを、場面ごとに確かめる）。
       ★場面 walk だけは、ブラウザが「戻る」で手元の置き場から戻せる形で立ち上げる（headless true・要求は差し替えない・
         サイトのファイルの no-store を GitHub Pages と同じ max-age=600 に替える口 ── cmp-stubs.mjs の pagesFront ── を通して開く）。
         門は同じ（断る口と、名前を引けるのは localhost と LIBS だけ）。その口の番号も、この場面のサーバーの番号として通す。

   実行: node assert-cmp-walk.mjs [--scenes zero,walk,readers,fail,cur] [--via form|call] [--shots <folder>]
     --scenes  場面を選ぶ（zero・walk・readers・fail・cur）。付けなければ全部
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
/* ブラウザ自身の通信（headless true の Chrome が、ページと関係なく自分で出そうとするもの）。
   CHROME_QUIET で止められるもの（入力欄の種類を Google に聞く・時計を合わせる・部品の更新・通信の失敗の報告 ── 部品の配信元が頼む NEL の
   報告を a.nel.cloudflare.com へ送る。2026-10-24 の回に1度だけ出て門を赤くした）は立ち上げる時に止める。止める旗の見つからない3つ
   （アカウントの確かめ accounts.google.com・検索の下準備 www.google.com・プッシュの登録 android.clients.google.com ── どれも CONNECT …:443）は
   断る口が断って書き留める（外へは出ない）。場面 walk（bf）のときだけ、ページがその行き先へ1本も出していなければ門の赤に数えず、
   知らせの行に出す。ページから出た要求と、ほかの行き先へのものは、今までどおり1本でも赤 */
const CHROME_QUIET = ['--disable-features=AutofillServerCommunication,NetworkTimeServiceQuerying,NetworkErrorLogging', '--disable-component-update'];
const CHROME_OWN = /^CONNECT (accounts\.google\.com|www\.google\.com|android\.clients\.google\.com):443$/;
/* 場面の舞台：使い捨ての保存先 → 断る口 → その番号だけを通すブラウザ。
   bf ＝ 「戻る」で手元の置き場から戻せる形（headless true・pagesFront の口を通して開く ── 頭のコメントの ★場面 walk） */
async function stage(opt = {}) {
  const env = await H.startLocal();
  let px = null, browser = null, front = null;
  try {
    px = await refuser();
    if (opt.bf) {
      front = await H.pagesFront(env.url);
      if (['3000', '3100'].includes(new URL(front.base).port)) throw new Error('3000 番・3100 番では口を立てない');
    }
    const own = [new URL(env.url).port, ...(front ? [new URL(front.base).port] : [])];
    browser = await puppeteer.launch({ headless: opt.bf ? true : 'shell', args: ['--no-sandbox', H.NO_NAMES, ...(opt.bf ? CHROME_QUIET : []),
      `--proxy-server=http://localhost:${px.port}`,
      `--proxy-bypass-list=<-loopback>;${own.map((p) => `localhost:${p};127.0.0.1:${p}`).join(';')};${LIB_HOSTS.join(';')}`] });
  } catch (e) {
    if (front) await front.close();
    if (px) await px.close();
    await env.stop();
    throw e;
  }
  return { env, px, browser, front };
}
/* 1枚開く（要求は差し替えない ── 見るだけ）。who ＝ serve-local.mjs の MEMBERS の key（null ＝ ログインしていない人）。
   ログインは cmp-stubs.mjs の open と同じ置き方（ページのどのスクリプトよりも先・Give → Get の板は「さっき見た」・会員の札は隠す）。
   st.out ＝ 手元の番号と LIBS のほかへ向かった要求（断ったものも数える）・st.through ＝ そのうち返事が届いたもの。
   sizeKey ＝ cmp-stubs.mjs の SIZES の名前か [幅, 高さ]。before ＝ ページのどのスクリプトよりも先に流す文（書き留め役など）。
   場面が pagesFront の口を持っていれば（walk）、ページはその口から開く（その口がこのページの手元の番号） */
async function open(sizeKey, { who = null, url = null, before = null } = {}) {
  const size = Array.isArray(sizeKey) ? sizeKey : H.SIZES[sizeKey];
  if (!size) throw new Error('知らない大きさ: ' + sizeKey);
  const [w, h, touch] = size;
  const base = CUR.front ? CUR.front.base : CUR.env.url;
  const origin = new URL(base).origin;
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
  if (before) await page.evaluateOnNewDocument(before);
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
  if (url) await page.goto(base + url, { waitUntil: 'domcontentloaded' });
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
const scene = (key, label, fn, opt = {}) => { SCENES[key] = { key, label, fn, opt }; };

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

/* ══ 歩く・読む人・失敗・通貨（W-walk・W-readers・W-fail・W-cur ── 2026-10-24 段階4 cmp-links-card-8）══════════════════ */
const WALK_SIZE = [1440, 820];
const CMP_LIVE = '#cr [data-view="compare"] .crl[data-live]';
/* 段の y の決まり（assert-cmp-frame.mjs の FLAT_Y と1字も違わない写し ── 場面 walk の最初の行が見ている。assert-career.mjs にも同じ写し）。
   いまの位置から、上の帯の線より上に在る「残さない欄」（誰が見ても同じ字の顔でない欄・片側だけの欄）の高さを引いた数。
   ページで流す（window.__flatY として置いてから呼ぶ） */
const SAME_SHEET = 'locked|login|give|few|empty|off|error';
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
/* 書き留め役（assert-cmp-frame.mjs の RECORDER と1字も違わない写し ── 同じく場面 walk の最初の行が見ている）：キャンバスに描かれた字と絵の元 */
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
/* pageshow の控え（手元から戻ったか ＝ persisted）。ページのどのスクリプトよりも先 */
const PS_LOG = () => { window.__ps = []; window.addEventListener('pageshow', (e) => { window.__ps.push({ p: !!e.persisted, t: Date.now() }); }); };
const WALK_BEFORE = `(${RECORDER})();(${PS_LOG})();`;
/* 5社の名前・住所・QR（career.html の #crc-data ── カードの材料の台帳） */
const AIR = (() => {
  const m = read('career.html').match(/<script[^>]*id="crc-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('career.html の #crc-data が読めない');
  return JSON.parse(m[1]).airlines;
})();
const READ_MARK = /ZZ[a-z]+-[a-z-]+-(salary|wlb)ZZ/;       // cmp-stubs.mjs の readerMark の形（本文の終わり ── 誰にでも見える抜粋の40字より後ろ）
const READ_TEXT = '手元の検査のための口コミです';             // cmp-stubs.mjs の readerText の頭（会員の口コミの本文そのもの）
const HOTEL = 'ZZホテルZZ';                                    // 運営が通すホテルの名前（植えた印）
const STAY_AIR = 'etihad', STAY_AT = 'NRT';                    // career.html に就航地の画面があるのはエティハドだけ（30都市）
const B6_TRIES = 5;
const YEN_AMT = /¥\s?[\d,]+/;
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
const viewStill = (page) => page.evaluate(async () => {
  const v = document.querySelector('#cr .cr-view:not([hidden])');
  if (v) await Promise.all(v.getAnimations().map((a) => a.finished.catch(() => {})));
});
const topOf = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top : null; };
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
const footSel = (s) => `#cr-go-rev-${s}`;                     // その会社の口コミの「詳しく」（比較の口コミの箱の足）
/* 保存先の数から、画面に出るはずの字（評価の平均・「n件の評価」・投稿の数）を作る ── stored() はこの検査の数え方 */
const want = async (slug) => {
  const S = await stored(slug);
  return { avg: S.rate ? S.rate.avg.toFixed(1) : null, cnt: S.rate ? `${S.rate.n}件の評価` : null, posts: String(S.posts) };
};
/* 会社ページ airlines/{slug}.html の公開の数（社名の横の評価の欄が読み終わり、投稿の数が出てから） */
const coRead = async (page, slug) => {
  const done = await page.waitForFunction((slug) => {
    const b = document.querySelector('.pvg-hero .crl[data-live="stars"]'), n = document.querySelector('[data-pvg-n="posts"]');
    return !!b && b.getAttribute('data-for') === slug && !['idle', 'loading'].includes(b.getAttribute('data-state')) && !!n && n.textContent.trim() !== '—';
  }, { timeout: 30000, polling: 100 }, slug).then(() => true, () => false);
  const v = await page.evaluate(() => {
    const tx = (e) => (e ? e.textContent.trim() : null);
    const hero = document.querySelector('.pvg-hero .crl[data-live="stars"]');
    return { est: Object.fromEntries(['cap', 'fo'].map((r) => [r, tx(document.querySelector(`.pvg-rank[data-rank="${r}"] .pvg-big`))])),
      avg: tx(hero && hero.querySelector('.crl-avg')), cnt: tx(hero && hero.querySelector('.crl-cnt')),
      posts: tx(document.querySelector('[data-pvg-n="posts"]')), cur: window.PVCurrency && window.PVCurrency.get ? window.PVCurrency.get() : null };
  });
  return { done, ...v };
};
/* 会社ページは、点数の付いた投稿が無い会社に平均を描かず、評価件数の場所に「評価未取得」と書く（career-live.js の会社ページの星の欄） */
const sameCo = (c, w) => (w.cnt ? c.avg === w.avg && c.cnt === w.cnt : c.avg === null && c.cnt === '評価未取得') && c.posts === w.posts;
/* 比較の口コミの欄：会社の札の順・会社ごとのマス（平均・「n件の評価」・投稿の数・読めない）・1行だけの時の字・「やり直す」・本文の印・口コミの Give & Get・錠の1行 */
const cmpStars = (page) => page.evaluate((re) => {
  const x = document.querySelector('#cr [data-view="compare"] .crl[data-live="cmp-stars"]');
  if (!x) return null;
  const tx = (e) => (e ? e.textContent.trim() : null);
  const vis = (n) => n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden';
  return {
    state: x.getAttribute('data-state'), for: x.getAttribute('data-for'),
    heads: [...x.querySelectorAll('.crl-cmp-head .crl-co-n')].map(tx),
    cells: [...x.querySelectorAll('.crl-cmp-row > .crl-cmp-c')].map((c) => ({ avg: tx(c.querySelector('.crl-avg')), cnt: tx(c.querySelector('.crl-cnt')),
      posts: tx(c.querySelector('.crl-posts')), none: tx(c.querySelector('.crl-none')), err: c.innerText.includes('いま読み出せません') })),
    msg: [...x.children].filter((c) => c.matches('p.crl-msg')).map(tx),
    retry: [...x.querySelectorAll('.crl-retry')].filter(vis).length,
    marks: (x.innerText.match(new RegExp(re, 'g')) || []).length,
    gg: [...x.querySelectorAll('a.pv-gg[href*="submit-review.html"]')].filter(vis).length,
    lock: [...x.querySelectorAll('.crl-lock')].filter(vis).map(tx),
  };
}, READ_MARK.source);
/* その会社のマス（札の名前で引く ── 列の順は並べた順） */
const cellOf = (S, slug) => (S && S.heads.indexOf(AIR[slug].ja) >= 0 ? S.cells[S.heads.indexOf(AIR[slug].ja)] || null : null);
/* マスが保存先の数と同じか（点数の付いた投稿が無い会社は、平均も「n件の評価」も描かない ── 2社とも投稿が無ければマスそのものが無い） */
const sameCell = (c, w) => (w.cnt ? !!c && c.avg === w.avg && c.cnt === w.cnt && c.posts === `会員の投稿 ${w.posts}件`
  : !c || (!c.avg && !c.cnt && (c.posts === null || c.posts === `会員の投稿 ${w.posts}件`)));
/* 比較の推定年収の字（会社と職位で引く） */
const estOf = (F, slug, rk) => { const r = (F.est[rk] || []).find((x) => x.airline === slug); return r ? r.v : null; };
/* 比較の中の、2社のほかの会社（社名の字・data-airline の付いた見える要素）。選ぶ欄（select）の中は数えない */
/* ★答えるカード（.crl-give ── 読む人の自分の会社に5つ答える入口・RULING M4 / P9.4）は、自分の会社の名前を書く。その中だけは
   別に数えて返す（give）── 場面は、自分の会社の名前のほかが無いことを見る */
const outside = (page, a, b) => page.evaluate((a, b, names) => {
  const V = document.querySelector('#cr [data-view="compare"]');
  const vis = (n) => !!n && n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden';
  const w = document.createTreeWalker(V, NodeFilter.SHOW_TEXT);
  let text = '', card = '';
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    const p = t.parentElement;
    if (!p || p.closest('select') || !vis(p)) continue;
    if (p.closest('.crl-give')) card += t.nodeValue + '\n'; else text += t.nodeValue + '\n';
  }
  const hit = Object.entries(names).filter(([s, ja]) => s !== a && s !== b && text.includes(ja)).map(([s]) => s);
  const give = Object.entries(names).filter(([s, ja]) => s !== a && s !== b && card.includes(ja)).map(([s]) => s);
  const els = [...V.querySelectorAll('[data-airline]')].filter((n) => !n.closest('select') && vis(n) && ![a, b].includes(n.getAttribute('data-airline')))
    .map((n) => `${n.getAttribute('data-airline')}:${n.tagName.toLowerCase()}${n.className ? '.' + String(n.className).split(' ')[0] : ''}`);
  return { hit, give, els: [...new Set(els)] };
}, a, b, Object.fromEntries(Object.entries(AIR).map(([s, x]) => [s, x.ja])));
/* 比較の「提出された年収」の欄に見えている額の字（この読む人が読める行の額） */
const payTexts = (page) => page.evaluate(() => {
  const x = document.querySelector('#cr [data-view="compare"] .crl[data-live="cmp-pay"]');
  return x ? [...new Set(x.innerText.match(/¥\s?[\d,]+(?:\.\d+)?万?/g) || [])] : [];
});
/* 足（目印）を上の帯のすぐ下へ動かし、段が書かれるまで待つ（動かす前に段を空にして、動かしたあとに書かれた段だけを見る）。
   段の y の決まりは FLAT_Y（残さない欄の無い人は いまの位置そのもの）。返す { wrote, top0 } */
async function toFoot(page, slug, entry = true) {
  await page.evaluate((s) => {
    const bar = document.querySelector('.mr-top'), e = bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
    history.replaceState(null, '', location.href);
    window.scrollTo(0, Math.round(window.scrollY + document.querySelector(s).getBoundingClientRect().top - e - 4));
  }, footSel(slug));
  let wrote = null;
  if (entry) {
    await page.evaluate(`window.__flatY = ${FLAT_Y};`);
    wrote = await page.waitForFunction((sel, same) => {
      const s = history.state;
      return !!s && s.y === window.__flatY(sel, same) && s.k >= 0 && Array.isArray(s.h) && s.h.length === document.querySelectorAll(sel).length;
    }, { timeout: 8000, polling: 50 }, CMP_LIVE, SAME_SHEET).then(() => true, () => false);
  }
  return { wrote, top0: await steady(page, topOf, footSel(slug)) };
}
/* 会社ページの口コミのタブが開いた（PVGlance.at()） */
const atReviews = (page) => page.waitForFunction(() => !!window.PVGlance && window.PVGlance.at() === 'reviews', { timeout: 20000, polling: 100 })
  .then(() => true, () => false);
/* 戻ったページの pageshow（t より後）が届くまで待ち、手元から戻ったか（persisted）と、戻らなかった時のブラウザの言い分を返す */
async function backShown(page, t) {
  await page.waitForFunction((t) => { const a = window.__ps; return Array.isArray(a) && a.length > 0 && a[a.length - 1].t >= t && document.readyState === 'complete'; },
    { timeout: 30000 }, t);
  const persisted = await page.evaluate(() => window.__ps[window.__ps.length - 1].p === true);
  const why = persisted ? '' : await page.evaluate(() => {
    try {
      const n = performance.getEntriesByType('navigation')[0], r = n && n.notRestoredReasons, w = [];
      const walk = (x) => { if (!x) return; (x.reasons || []).forEach((y) => w.push(y.reason || String(y))); (x.children || []).forEach(walk); };
      walk(r);
      return w.length ? w.join(',') : (n ? n.type : '?');
    } catch (e) { return '?'; }
  }).catch(() => '?');
  return { persisted, why };
}
/* カードが2社（または1社）について描かれ、評価の数を受け取って描き直し終わった（新しい要求は作らない ── 比較が読んだもの） */
async function cardUp(page, slugs) {
  const up = await page.waitForFunction((want) => {
    const m = window.PVCareerCard && window.PVCareerCard.model && window.PVCareerCard.model();
    const r = document.getElementById('crc-root');
    return !!(m && m.cards && m.cards.map((c) => c.slug).join('|') === want && m.layout && r && r.getAttribute('data-drawn'));
  }, { timeout: 60000, polling: 100 }, slugs.join('|')).then(() => true, () => false);   // 書体（LIBS）を読み終えてから描く ── 混んだ回は30秒を超えたことがある
  if (!up) return { up, model: null, drawn: { text: [], img: [] } };
  await page.evaluate(async (slugs) => {
    await Promise.all(slugs.map((s) => Promise.resolve(window.PVCareer.rating(s)).then(() => 0, () => 0)));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (window.PVCareerCard.redraw) await window.PVCareerCard.redraw();
  }, slugs);
  const model = await page.evaluate(() => window.PVCareerCard.model());
  const drawn = await page.evaluate(() => ({ text: ((window.__drawn || {}).text || []).slice(), img: ((window.__drawn || {}).img || []).slice() }));
  return { up, model, drawn };
}
/* 描いた字と材料に、この読む人が読める行の字（会員の口コミの本文・提出された年収の額）とホテルの名前が無いか。
   提出された年収の額のうち、カードが描いてよい公開の額（職位の推定年収）と同じ字のものは数えない（その時は知らせの行に出す） */
function noRows(C, pay) {
  const pub = new Set((C.model ? C.model.cards : []).flatMap((c) => Object.values(c.roles || {}).flatMap((r) => [r.text, r.lim && r.lim.text]).filter(Boolean)));
  const amts = pay.filter((t) => !pub.has(t));
  const all = `${C.drawn.text.join('\n')}\n${J(C.model)}`;
  const bad = [];
  if (READ_MARK.test(all)) bad.push('会員の口コミの本文の印');
  if (all.includes(READ_TEXT)) bad.push('会員の口コミの本文');
  if (all.includes(HOTEL)) bad.push('ホテルの名前');
  for (const t of amts) if (all.includes(t)) bad.push(`提出された年収の額 ${t}`);
  return { bad, amts, same: pay.filter((t) => pub.has(t)), drawn: C.drawn.text.length };
}

/* ── 場面 walk ─────────────────────────────────────────────── */
/* 3組：[a, b]（a の会社ページから入る）。a だけを渡す「他社と比較」の相手は既定の組（career.html の data-a / data-b）のうち a でないほう */
const WALK_PAIRS = [['jal', 'ana'], ['etihad', 'cathay-pacific'], ['eva-air', 'jal']];
const WALK_READERS = [{ key: null, ja: 'ゲスト', own: null }, { key: 'c', ja: '双方あり（c・自分の会社 ANA）', own: 'ana' }];
/* B6 のタブだけ、BroadcastChannel を外す（assert-keep.mjs の KA8 ③④・cmp-stubs.mjs の bfOpen の noBc と同じ）：同じ読む人の会社ページが
   開くとログインの知らせを送り、ブラウザが手元に置いた比較を捨てる（読み込み直す道になる ── そちらは (6) が見ている） */
const B6_NO_BC = 'try { window.BroadcastChannel = undefined; } catch (e) { /* 消せなければそのまま */ }';
const B6_TEXT = (slug) => `手元の検査で足した口コミです（実在の投稿ではありません・${slug}）。`;

/* B6：新しいタブで比較 b|a → a の口コミの「詳しく」→（離れているあいだに a へ点数つきの口コミを1件 ── q()）→ 戻る。
   ★出る前に待つのは口コミの欄（取り直しで描き直す箱）だけ。欄ぜんぶが落ち着くのは待たない（2026-10-23 LEAD AMENDMENT「back-cache」：
     欄ぜんぶを待ったページは、Chromium が手元に置かずに読み込み直すことがあった）。
   手元から戻らなければ、足した1件を消し、新しいタブで最初から（5回まで）。戻ったら、その場の位置・口コミの欄が静かに取り直して1件多い数を
   描いたあとの位置を測り、足した1件を消して返す */
async function b6(R, a, b) {
  const why = [];
  for (let i = 1; i <= B6_TRIES; i++) {
    const o = await open(WALK_SIZE, { who: R.key, url: PAIR(b, a), before: WALK_BEFORE + B6_NO_BC });
    const { page } = o;
    const pre = await page.waitForFunction((w) => { const x = document.querySelector('#cr [data-view="compare"] .crl[data-live="cmp-stars"]');
      return !!x && x.getAttribute('data-for') === w && !['idle', 'loading'].includes(x.getAttribute('data-state')); }, { timeout: 30000, polling: 100 }, `${b}|${a}`)
      .then(() => true, () => false);
    await viewStill(page);
    const { top0 } = await toFoot(page, a, false);
    await page.evaluate(() => { window.__l8 = 'B6'; });
    await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), page.click(footSel(a))]);
    const out = await atReviews(page);
    const id = (await CUR.env.q(`insert into public.reviews_v2 (proof_hash, airline, culture_score, salary_score, benefits_score, wlb_score, ops_score, training_score, salary_comment)
      values (public.pv_review_hash(gen_random_uuid(), $1), $1, 4, 4, 4, 4, 4, 4, $2) returning id`, [a, B6_TEXT(a)])).rows[0].id;
    const t0 = Date.now();
    await page.goBack({ waitUntil: 'load', timeout: 60000 });
    const bk = await backShown(page, t0);
    const kept = await page.evaluate(() => window.__l8 === 'B6').catch(() => false);
    if (!bk.persisted || !kept) {
      why.push(bk.why || 'mark gone');
      await CUR.env.q('delete from public.reviews_v2 where id = $1', [id]);
      await o.ctx.close();
      continue;
    }
    const topAt = await page.evaluate(topOf, footSel(a));
    const w = await want(a);
    const filled = await page.waitForFunction(([w, ja, cnt, posts]) => {
      const x = document.querySelector('#cr [data-view="compare"] .crl[data-live="cmp-stars"]');
      if (!x || x.getAttribute('data-for') !== w || x.getAttribute('data-state') !== 'open') return false;
      const i = [...x.querySelectorAll('.crl-cmp-head .crl-co-n')].map((e) => e.textContent.trim()).indexOf(ja);
      const c = i >= 0 ? x.querySelectorAll('.crl-cmp-row > .crl-cmp-c')[i] : null;
      const t = (s) => { const e = c && c.querySelector(s); return e ? e.textContent.trim() : null; };
      return !!c && t('.crl-cnt') === cnt && t('.crl-posts') === posts;
    }, { timeout: 30000, polling: 100 }, [`${b}|${a}`, AIR[a].ja, w.cnt, `会員の投稿 ${w.posts}件`]).then(() => true, () => false);
    await viewStill(page);
    const top1 = await steady(page, topOf, footSel(a));
    const S = await cmpStars(page);
    await CUR.env.q('delete from public.reviews_v2 where id = $1', [id]);
    await o.ctx.close();
    return { restored: true, tries: i, why, pre, out, top0, topAt, top1, filled, w, cell: cellOf(S, a) };
  }
  return { restored: false, tries: B6_TRIES, why };
}

scene('walk', '会社ページ → 比較 → 切り替え・入れ替え → 詳しく → 戻る（読み込み直す道・手元から戻る道 B6）→ カード（ゲストと c・3組）・カードにホテルの名前が無い（pilot）', async () => {
  const env = CUR.env;
  /* 写した決まりが、元と1字も違わない（段の y の決まり FLAT_Y ── assert-cmp-frame.mjs と assert-career.mjs・書き留め役 RECORDER ── assert-cmp-frame.mjs） */
  const body = (src, name) => { const i = src.indexOf(`const ${name} = `); const j = i < 0 ? -1 : src.indexOf('\n};\n', i); return i < 0 || j < 0 ? null : src.slice(i, j); };
  const me = read('assert-cmp-walk.mjs'), fr = read('assert-cmp-frame.mjs'), ca = read('assert-career.mjs');
  const same = ['FLAT_Y', 'RECORDER'].map((n) => ({ n, me: body(me, n), fr: body(fr, n) }));
  ok(same.every((x) => !!x.me && x.me === x.fr) && body(ca, 'FLAT_Y') === body(me, 'FLAT_Y')
    && [me, fr, ca].every((s) => s.includes(`const SAME_SHEET = '${SAME_SHEET}';`)),
  '写した決まり：段の y（FLAT_Y・顔の一覧 SAME_SHEET）は assert-cmp-frame.mjs と assert-career.mjs、書き留め役（RECORDER）は assert-cmp-frame.mjs と1字も違わない',
  J(same.map((x) => ({ n: x.n, me: !!x.me, same: !!x.me && x.me === x.fr })).concat([{ n: 'FLAT_Y(career)', same: body(ca, 'FLAT_Y') === body(me, 'FLAT_Y') }])));
  const made = await H.makeReaders(env, { via: VIA });
  made.did.forEach((l) => console.log('  ・' + l));

  /* ── ホテル（LC-A5）：ログインしない人が足し、運営が通す → pilot が1つの文書で見る → 同じ文書のカードに名前が無い ── */
  const city = (() => {
    const h = read('career.html'), i = h.indexOf(`data-view="stay" data-airline="${STAY_AIR}" data-stay="${STAY_AT}"`);
    const m = i < 0 ? null : h.slice(i, i + 4000).match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    return m ? m[1].replace(/<([a-z0-9]+)[^>]*>[\s\S]*?<\/\1>/g, '').replace(/\s+/g, ' ').trim() : '';
  })();
  const add = await H.rpcAs(env.url, null, 'pv_stay_add', { airline: STAY_AIR, iata: STAY_AT, kind: 'hotel', name: HOTEL,
    address: null, maps_url: null, note: null, city, stay_hours: null });
  const qq = await H.rpcAs(env.url, 'op', 'pv_stay_queue', {});
  const row = qq.body && qq.body.ok === true && Array.isArray(qq.body.places) ? qq.body.places.find((x) => x.name === HOTEL && x.state === 'pending') : null;
  const mod = row ? await H.rpcAs(env.url, 'op', 'pv_stay_moderate', { target: 'place', id: row.id, state: 'public', rev: row.rev }) : null;
  ok(!!city && !!add.body && add.body.ok === true && !!row && !!mod && !!mod.body && mod.body.ok === true && mod.body.state === 'public',
    `準備（ホテル）：ログインしない人の追加の口 pv_stay_add（画面が送る形 ── 会社・空港・種類・名前・都市「${city}」）で、エティハドの成田に「${HOTEL}」→ 運営 op が待ち行列 pv_stay_queue から pv_stay_moderate で通した`,
    J({ add: add.body, row: row && { state: row.state, rev: !!row.rev }, mod: mod && mod.body }));
  {
    const { page } = await open(WALK_SIZE, { who: 'pilot', url: `/career.html?airline=${STAY_AIR}&stay=${STAY_AT}`, before: WALK_BEFORE });
    const seen = await page.waitForFunction((n) => {
      const x = document.querySelector('#cr .cr-view[data-view="stay"]:not([hidden]) .crl[data-live="hotels"]');
      return !!x && x.getAttribute('data-state') === 'open' && x.innerText.includes(n);
    }, { timeout: 30000, polling: 100 }, HOTEL).then(() => true, () => false);
    ok(seen, seen ? `★ホテル（前提）pilot（承認された人・模擬）：career.html の成田の画面のホテルの欄に「${HOTEL}」が見える（手元の本物の返事）`
      : `★ホテル（前提）この場面は落ちることができない ── pilot の成田の画面に「${HOTEL}」が出ない`,
    J(await page.evaluate(() => { const x = document.querySelector('#cr .crl[data-live="hotels"][data-stay="NRT"]'); return x && { state: x.getAttribute('data-state'), text: x.innerText.slice(0, 200) }; })));
    await page.evaluate((s) => window.PVCareer.go({ view: 'card', a: s }), STAY_AIR);
    const C = await cardUp(page, [STAY_AIR]);
    const N = noRows(C, []);
    const all = `${C.drawn.text.join('\n')}\n${J(C.model)}`;
    ok(seen && C.up && N.drawn > 0 && !all.includes(HOTEL) && N.bad.length === 0,
      `★ホテル pilot：同じ文書でカード（PVCareer.go）→ 描いた字（${N.drawn}）にも材料にも「${HOTEL}」が無い`,
      J({ seen, up: C.up, drawn: N.drawn, bad: N.bad, slugs: C.model && C.model.cards.map((c) => c.slug) }));
  }

  for (const R of WALK_READERS) {
    /* この読む人にはホテルが届かない（その読む人として pv_stays に聞いた答えが鍵の1行だけ ── 植えるものは無い） */
    const sv = await H.rpcAs(env.url, R.key, 'pv_stays', { airline: STAY_AIR, iata: STAY_AT });
    ok(sv.status === 200 && !!sv.body && sv.body.ok === true && sv.body.state === 'locked' && !sv.text.includes(HOTEL),
      `${R.ja}：この読む人にはホテルが届かない（エティハドの成田の pv_stays の答えは locked だけ・名前は無い）`, sv.text.slice(0, 200));
    for (const [a, b] of WALK_PAIRS) {
      const AB = `${R.ja}・${a}→${b}`;
      const tab = await open(WALK_SIZE, { who: R.key, url: `/airlines/${a}.html`, before: WALK_BEFORE });
      const { page } = tab;
      /* (1) 会社ページ */
      const C1 = await coRead(page, a);
      const Wa = await want(a);
      ok(C1.done && !!C1.est.cap && !!C1.est.fo && sameCo(C1, Wa),
        `${AB}（1）会社ページ airlines/${a}.html：推定年収（機長 ${C1.est.cap}・副操縦士 ${C1.est.fo}）・評価 ${C1.avg || 'なし'}・${C1.cnt || '評価件数なし'}・投稿 ${C1.posts}件 ＝ 保存先（q()）`,
        J({ co: C1, want: Wa }));
      /* (2)「他社と比較」 */
      await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), page.click('a.pvg-btn-cmp')]);
      const landed = await page.evaluate(() => location.pathname + location.search);
      const st2 = await page.evaluate(() => window.PVCareer && window.PVCareer.state ? window.PVCareer.state() : {});
      if (st2.b !== b) await H.choose(page, 'b', b);
      const s2 = await settled(page, a, b);
      const q2 = await page.evaluate(() => location.search);
      ok(landed.startsWith(`/career.html?view=compare&a=${a}`) && s2 && q2 === `?view=compare&a=${a}&b=${b}`,
        `${AB}（2）「他社と比較」→ ${landed}${st2.b !== b ? `（相手 ${st2.b} から ${b} へ選び直した）` : '（既定の相手のまま）'} → ?view=compare&a=${a}&b=${b}・欄が全部読み終わった`,
        J({ landed, st2, q2, s2 }));
      /* (3) 比較の a の側が (1) と同じ・2社とも保存先と同じ */
      const F3 = await figures(page), S3 = await cmpStars(page);
      const Wb = await want(b);
      ok(estOf(F3, a, 'cap') === C1.est.cap && estOf(F3, a, 'fo') === C1.est.fo && sameCell(cellOf(S3, a), Wa) && sameCell(cellOf(S3, b), Wb)
        && (Wa.cnt || Wb.cnt ? S3.state === 'open' : S3.state === 'empty' && J(S3.msg) === J([REV_NONE])),
        `${AB}（3）比較の ${a} の側は会社ページと同じ（推定年収の字・評価・件数）・2社とも保存先（q()）と同じ`,
        J({ est: F3.est, stars: S3 && { state: S3.state, heads: S3.heads, cells: S3.cells, msg: S3.msg }, want: { [a]: Wa, [b]: Wb }, co: C1 }));
      /* (4) 入れ替え */
      await page.click('#cr-swap');
      const s4 = await settled(page, b, a);
      const F4 = await figures(page), S4 = await cmpStars(page), O4 = await outside(page, a, b);
      const q4 = await page.evaluate(() => location.search);
      const forAll = await page.evaluate((w) => [...document.querySelectorAll('#cr [data-view="compare"] .crl[data-live^="cmp-"]')].every((x) => x.getAttribute('data-for') === w), `${b}|${a}`);
      ok(s4 && forAll && q4 === `?view=compare&a=${b}&b=${a}` && J(F4.pair) === J([b, a]) && J(S4.heads) === J(S4.heads.length ? [AIR[b].ja, AIR[a].ja] : [])
        && O4.hit.length === 0 && O4.els.length === 0 && O4.give.every((s) => s === R.own) && estOf(F4, a, 'cap') === C1.est.cap && sameCell(cellOf(S4, a), Wa) && sameCell(cellOf(S4, b), Wb),
        `${AB}（4）入れ替え → ?view=compare&a=${b}&b=${a}・並び [${b}, ${a}]・比較の欄が全部 ${b}|${a}・2社のほかの会社の字が無い（答えるカードの自分の会社の名前のほか）・数は同じ`,
        J({ q4, pair: F4.pair, heads: S4.heads, forAll, outside: O4 }));
      /* (5) a の口コミの「詳しく」→ 会社ページの口コミのタブ。離れる前に unload の聞き手を置く（手元に置かせない ＝ 戻ると読み込み直す） */
      const pay = await payTexts(page);
      const P5 = await toFoot(page, a);
      await page.evaluate(() => { window.addEventListener('unload', () => {}); window.__left = 1; });
      await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), page.click(footSel(a))]);
      const at5 = await atReviews(page);
      const loc5 = await page.evaluate(() => location.pathname + location.hash);
      ok(P5.wrote && at5 && loc5 === `/airlines/${a}.html#reviews`,
        `${AB}（5）${a} の口コミの「詳しく」（上の帯のすぐ下・段が書かれた）→ ${loc5}・会社ページは口コミのタブ`, J({ wrote: P5.wrote, at5, loc5 }));
      /* (6) 戻る ── 読み込み直す道 */
      const t6 = Date.now();
      await page.goBack({ waitUntil: 'load', timeout: 60000 });
      const bk6 = await backShown(page, t6);
      const how = (await page.evaluate(() => window.__left === 1)) ? '手元から戻った' : '読み込み直した';
      const s6 = await settled(page, b, a);
      await viewStill(page);
      const top6 = await steady(page, topOf, footSel(a));
      const F6 = await figures(page), S6 = await cmpStars(page), q6 = await page.evaluate(() => location.search);
      ok(how === '読み込み直した' && !bk6.persisted && s6 && q6 === q4 && J(F6.pair) === J([b, a]) && Math.abs(top6 - P5.top0) <= 2
        && J(F6.est) === J(F4.est) && J(F6.slots) === J(F4.slots) && J(S6.cells) === J(S4.cells),
        `${AB}（6）戻る（${how}ページ）→ 同じ住所・同じ並び・欄が全部落ち着いたあと足の位置は出る前と同じ（${Math.round(P5.top0)} → ${Math.round(top6)}・2px のうち）・同じ数`,
        J({ how, bk6, q6, top0: P5.top0, top6, same: { est: J(F6.est) === J(F4.est), slots: J(F6.slots) === J(F4.slots), stars: J(S6.cells) === J(S4.cells) } }));
      /* (7)「カードを保存」 */
      await page.click('#cr-to-card');
      const C7 = await cardUp(page, [b, a]);
      const q7 = await page.evaluate(() => location.search);
      const cards = C7.model ? C7.model.cards : [];
      const role = (s, rk) => { const c = cards.find((x) => x.slug === s); return c && c.roles[rk] ? c.roles[rk].text : null; };
      const rate = (s) => { const c = cards.find((x) => x.slug === s); return c ? c.rating : undefined; };
      const rateOk = (s, w) => (w.cnt ? !!rate(s) && rate(s).avg === w.avg && rate(s).text === w.cnt : rate(s) === null);
      const addr = (s) => { const c = cards.find((x) => x.slug === s); return !!c && c.url === `https://pilot-value.com/airlines/${s}.html` && c.url === AIR[s].url && c.qr.length > 0 && J(c.qr) === J(AIR[s].qr); };
      ok(C7.up && q7 === `?view=card&a=${b}&b=${a}` && J(cards.map((c) => c.slug)) === J([b, a])
        && [a, b].every((s) => ['cap', 'fo'].every((rk) => role(s, rk) === estOf(F3, s, rk))) && rateOk(a, Wa) && rateOk(b, Wb) && addr(a) && addr(b),
        `${AB}（7）「カードを保存」→ ?view=card&a=${b}&b=${a}・材料は [${b}, ${a}]・推定年収と評価は (3) と同じ・2社の住所（pilot-value.com/airlines/…）と QR は台帳のとおり`,
        J({ q7, slugs: cards.map((c) => c.slug), roles: cards.map((c) => [c.slug, role(c.slug, 'cap'), role(c.slug, 'fo')]), rating: cards.map((c) => [c.slug, c.rating]),
          est3: F3.est, want: { [a]: Wa, [b]: Wb }, url: cards.map((c) => c.url) }));
      /* (8) 書き留め役 */
      const N = noRows(C7, pay);
      ok(C7.up && N.drawn > 0 && N.bad.length === 0,
        `${AB}（8）カードに描いた字（${N.drawn}）にも材料にも、この読む人が読める行の字（会員の口コミの本文${N.amts.length ? `・提出された年収の額 ${N.amts.join('・')}` : ''}）と運営が通したホテルの名前が無い`,
        J({ bad: N.bad, amts: N.amts, same: N.same }));
      if (N.same.length) console.log(`  ・（8）提出された年収の額のうち、カードの公開の額と同じ字のもの（数えない）: ${N.same.join('・')}`);
      if (SHOTS) await shot(page, `${R.key || 'guest'}-${a}-${b}-card`);
      await tab.ctx.close();
      /* B6 ── 戻るの2本目：手元から戻る道 */
      const r6 = await b6(R, a, b);
      console.log(`  ・B6 ${AB}：手元から戻るまで ${r6.restored ? r6.tries : 'ー'} 回（読み込み直された回の理由：${r6.why.join(' / ') || 'ー'}）`);
      const lbl = `${AB} B6 戻る（手元から戻る道）：新しいタブの比較 ${b}|${a} → ${a} の口コミの「詳しく」→ 離れているあいだに ${a} へ口コミ1件（q()）→ 戻る`;
      ok(r6.restored && r6.pre && r6.out && Math.abs(r6.topAt - r6.top0) <= 2 && r6.filled && Math.abs(r6.top1 - r6.top0) <= 2 && sameCell(r6.cell, r6.w),
        r6.restored ? `${lbl}：手元から戻った（離れる前の印が残る・pageshow の persisted）・その場の足の位置は出る前と同じ（${Math.round(r6.top0)} → ${Math.round(r6.topAt)}）・`
          + `口コミの欄が静かに取り直して1件多い数（${r6.w.cnt}・会員の投稿 ${r6.w.posts}件）を描いたあとも 2px のうち（→ ${Math.round(r6.top1)}）`
          : `${lbl}：手元から戻らなかった（証明できない）`,
        J(r6));
    }
  }
}, { bf: true });

/* ── 場面 readers ──────────────────────────────────────────── */
/* JAL｜ANA を読む人の順に（比較の設計 W-readers・I-5 の表）。期限切れは pay の給与の鍵を、場面が q() で過去へ ── 最後に1回だけ */
const READ_ORDER = [
  { id: 'guest', key: null, ja: 'ゲスト', rev: false },
  { id: 'pilot', key: 'pilot', ja: '会員 pilot（VERIFIED PILOT（模擬）・給与の鍵も口コミの鍵も無い）', rev: false },
  { id: 'a', key: 'a', ja: '口コミ資格のみ（a）', rev: true },
  { id: 'c', key: 'c', ja: '双方あり（c・自分の会社 ANA）', rev: true },
  { id: 'pay', key: 'pay', ja: '給与資格のみ（pay・自分の会社 JAL）', rev: false },
  { id: 'expired', key: 'pay', ja: '期限切れ（pay の給与の鍵を、場面が q() で過去へ）', rev: false, expire: true },
];
/* 比較の欄の顔（ページの並び：提出された年収・口コミ・要約・月の働き方・すぐ下の回答（静か）・待遇）と、錠の1行。
   字はその欄を持つ区域の表（給与 S1・S2・S3・S5／口コミ・要約・回答の表 C）のまま。要約は保存先に要約が無いので、だれにも「empty」
   （JAL「口コミの要約は、まだありません」・ANA「口コミがまだ少ないため、要約はありません」── サーバーの答え） */
const FACE_OFF = 'cmp-pay:locked cmp-stars:open cmp-summary:empty cmp-work:locked cmp-facts(quiet):locked cmp-facts:locked';
const FACE_ON = 'cmp-pay:open cmp-stars:open cmp-summary:empty cmp-work:open cmp-facts(quiet):open cmp-facts:open';
/* 錠の1行は「会社の札:字」（箱ぜんぶの1行は札なし）。給与の鍵のある人の月の働き方は、自分の会社が開き、もう片方の会社に
   答えるカードの1行（自分の会社に5つ答えると開きます ── 口コミの区域の表 C） */
const PAY_LOCK = '給与の提出で開きます', PAY_GONE = '年収データの解放が切れています', WORK_LOGIN = 'ログインと給与の提出で開きます', REV_LOCK = '口コミの投稿で開きます';
const WORK_GIVE = '自分の会社に5つ答えると開きます';
const READ_FACE = {
  guest:   { face: FACE_OFF, pay: [`:${PAY_LOCK}`], work: [`:${WORK_LOGIN}`], payIn: 1, login: 1 },
  pilot:   { face: FACE_OFF, pay: [`:${PAY_LOCK}`], work: [`:${PAY_LOCK}`], payIn: 1, login: 0 },
  a:       { face: FACE_OFF, pay: [`:${PAY_LOCK}`], work: [`:${PAY_LOCK}`], payIn: 1, login: 0 },
  c:       { face: FACE_ON, pay: [], work: [`jal:${WORK_GIVE}`], payIn: 0, login: 0 },
  pay:     { face: FACE_ON, pay: [], work: [`ana:${WORK_GIVE}`], payIn: 0, login: 0 },
  expired: { face: FACE_OFF, pay: [`:${PAY_GONE}`], work: [`:${PAY_LOCK}`], payIn: 1, login: 0 },
};
const slotFace = (page) => page.evaluate(() => {
  const V = document.querySelector('#cr [data-view="compare"]');
  const vis = (n) => n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden';
  const lock = (k) => { const x = V.querySelector(`.crl[data-live="${k}"]:not([data-quiet])`);
    return x ? [...x.querySelectorAll('.crl-lock')].filter(vis).map((l) => `${(l.closest('.crl [data-airline]') || { getAttribute: () => '' }).getAttribute('data-airline') || ''}:${l.textContent.trim()}`) : null; };
  const pay = V.querySelector('.crl[data-live="cmp-pay"]');
  return { face: [...V.querySelectorAll('.crl[data-live]')].map((x) => `${x.getAttribute('data-live')}${x.getAttribute('data-quiet') ? '(quiet)' : ''}:${x.getAttribute('data-state')}`).join(' '),
    pay: lock('cmp-pay'), work: lock('cmp-work'), payText: pay ? pay.textContent : '' };   // 2026-10-29：1件ずつの額は畳んだ中（押すと出る）── 欄の中の字で見る（錠の顔に額が1つも無いことは、この方が厳しい）
});

scene('readers', '読む人6つ（ゲスト・pilot・a・c・pay・期限切れ）× JAL｜ANA：欄の顔・口コミの本文は口コミの鍵のある人だけ・顔 a・b と入口・会社ページと同じ公開の数', async () => {
  const env = CUR.env;
  const made = await H.makeReaders(env, { via: VIA });
  made.readers.forEach((l) => console.log('  ・' + l));
  const { MEMBERS } = await import('./serve-local.mjs');
  const ID = Object.fromEntries(MEMBERS.map((m) => [m.key, m.id]));
  const W = { jal: await want('jal'), ana: await want('ana') };
  for (const R of READ_ORDER) {
    if (R.expire) await env.q("update public.profiles set access_until = now() - interval '1 day' where id = $1", [ID[R.key]]);
    const keyNow = R.key ? !!(await env.q('select coalesce(access_until > now(), false) as v from public.profiles where id = $1', [ID[R.key]])).rows[0].v : false;
    const E = READ_FACE[R.id];
    /* 会社ページ（同じ読む人） */
    const co = await open('pc', { who: R.key, url: '/airlines/jal.html' });
    const CJ = await coRead(co.page, 'jal');
    await co.ctx.close();
    /* 比較 JAL｜ANA */
    const { page } = await open('pc', { who: R.key, url: PAIR('jal', 'ana') });
    const done = await settled(page, 'jal', 'ana');
    const F = await figures(page), S = await cmpStars(page), X = await slotFace(page), FC = await faces(page);
    const EN = await page.evaluate(() => {
      const V = document.querySelector('#cr [data-view="compare"]');
      const vis = (n) => n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden' && n.getBoundingClientRect().height > 1;
      const where = (a) => { const s = a.closest('.crl[data-live]'); return s ? s.getAttribute('data-live') : 'ページ'; };
      const login = [...V.querySelectorAll('a[href*="login.html"]')].filter(vis);
      const work = V.querySelector('.crl[data-live="cmp-work"]');
      return { pay: [...V.querySelectorAll('a[href*="pay-report.html"]')].filter(vis).map(where), login: login.map(where),
        inRev: login.filter((a) => a.closest('.cr-cmp-rev')).length, stamp: work ? work.getAttribute('data-entry') : null };
    });
    const tag = `${R.ja}`;
    ok(done && X.face === E.face && J(X.pay) === J(E.pay) && J(X.work) === J(E.work) && (E.face === FACE_ON ? YEN_AMT.test(X.payText) : !YEN_AMT.test(X.payText)),
      `${tag}：比較の欄の顔は表のとおり（${E.face === FACE_ON ? '提出された年収・月の働き方・待遇が開く' : '提出された年収・月の働き方・待遇は錠'}）・`
      + `提出された年収の錠の1行 ${E.pay.length ? `「${E.pay[0].slice(1)}」` : 'なし（額が出る）'}・月の働き方 `
      + `${E.face === FACE_ON ? `は自分の会社が開き、${E.work[0].split(':')[0]} に「${E.work[0].split(':')[1]}」` : `「${E.work[0].slice(1)}」`}${E.face === FACE_ON ? '' : '・提出された年収の欄に額が1つも無い'}`,
      J({ face: X.face, pay: X.pay, work: X.work, keyNow, payAmt: YEN_AMT.test(X.payText) }));
    ok(!!S && S.state === 'open' && (R.rev ? S.marks > 0 && S.gg === 0 && !S.lock.includes(REV_LOCK) : S.marks === 0 && S.gg === 1 && S.lock.includes(REV_LOCK)),
      `${tag}：口コミの欄 ── ${R.rev ? `会員の口コミの本文が読める（本文の終わりの印 ${S && S.marks}）・口コミの Give & Get と錠の1行は無い`
        : `会員の口コミの本文は1字も無い（印 0）・「${REV_LOCK}」と口コミの Give & Get が1つ`}`,
      J(S && { state: S.state, marks: S.marks, gg: S.gg, lock: S.lock }));
    ok(FC.a.length === 0 && FC.b.length === 0 && EN.stamp === 'give' && EN.pay.length === E.payIn && (E.payIn ? EN.pay[0] === 'cmp-pay' : true)
      && EN.login.length === E.login && (E.login ? EN.login[0] === 'cmp-pay' : true) && EN.inRev === 0,
      `${tag}：顔 a・b を守る・月の働き方に印 data-entry="give"・給与の入口 ${E.payIn}つ${E.payIn ? '（提出された年収の欄）' : ''}・「ログイン」${E.login ? '1つ（提出された年収の欄）' : 'なし'}`,
      J({ a: FC.a, b: FC.b, entries: EN }));
    const cj = cellOf(S, 'jal'), ca = cellOf(S, 'ana');
    okSql(CJ.done && sameCo(CJ, W.jal) && sameCell(cj, W.jal) && sameCell(ca, W.ana) && estOf(F, 'jal', 'cap') === CJ.est.cap && estOf(F, 'jal', 'fo') === CJ.est.fo,
      `${tag}：会社ページ airlines/jal.html と比較で同じ公開の数 ── JAL の推定年収（${CJ.est.cap}・${CJ.est.fo}）・評価 ${W.jal.avg}・${W.jal.cnt}・投稿 ${W.jal.posts}件／ANA ${W.ana.avg}・${W.ana.cnt}（q() で数えた数）`,
      J({ co: CJ, jal: cj, ana: ca, want: W, est: F.est }));
  }
  console.log('  ・DEEP PAY の欄（GATE-DP）：設計済み・別の会話の作業待ち ── 比較の中の DEEP PAY の階級と機材は、この場面では見ない（1行の知らせだけ）');
});

/* ── 場面 fail ─────────────────────────────────────────────── */
scene('fail', '口コミの読みが1本だけ失敗（手元のサーバーが 503）：片方の会社だけ「いま読み出せません」・もう片方は評価・「やり直す」は1つ → 押すと2社とも埋まる', async () => {
  const env = CUR.env;
  await H.makeReaders(env, { via: VIA });
  const W = { jal: await want('jal'), ana: await want('ana') };
  const fr = await (await fetch(`${env.url}/__local/fail?n=1&match=pv_reviews`)).json().catch(() => null);
  const { page } = await open('pc', { url: PAIR('jal', 'ana') });
  const done = await settled(page, 'jal', 'ana');
  const S = await cmpStars(page);
  const cj = cellOf(S, 'jal'), ca = cellOf(S, 'ana');
  const one = !!cj && !!ca && [cj, ca].filter((c) => c.err).length === 1;
  const other = one ? (cj.err ? ['ana', ca] : ['jal', cj]) : null;
  ok(!!fr && fr.ok === true && done && one && sameCell(other[1], W[other[0]]) && S.retry === 1 && env.local.state.fail.n === 0,
    `口コミの読みが1本だけ 503（/__local/fail?n=1&match=pv_reviews）→ ${one ? (cj.err ? 'JAL' : 'ANA') : '?'} だけ「いま読み出せません」・${other ? other[0] : '?'} は評価（q() と同じ）・「やり直す」は箱に1つ`,
    J({ fr, done, stars: S && { state: S.state, cells: S.cells, retry: S.retry }, left: env.local.state.fail.n }));
  await page.click('#cr [data-view="compare"] .crl[data-live="cmp-stars"] .crl-retry');
  const back = await page.waitForFunction((cnt) => {
    const x = document.querySelector('#cr [data-view="compare"] .crl[data-live="cmp-stars"]');
    return !!x && x.getAttribute('data-state') === 'open' && !x.innerText.includes('いま読み出せません') && x.querySelectorAll('.crl-cnt').length === cnt;
  }, { timeout: 30000, polling: 100 }, [W.jal, W.ana].filter((w) => w.cnt).length).then(() => true, () => false);
  const S2 = await cmpStars(page);
  ok(back && sameCell(cellOf(S2, 'jal'), W.jal) && sameCell(cellOf(S2, 'ana'), W.ana) && S2.retry === 0,
    '「やり直す」を押すと、2社とも評価が埋まる（q() と同じ）・「いま読み出せません」も「やり直す」も消える', J(S2 && { state: S2.state, cells: S2.cells, retry: S2.retry }));
});

/* ── 場面 cur ──────────────────────────────────────────────── */
/* 比較の見えている額のうち、¥ の付いたもの（原貨の字 pv-no-cur の中は数えない） */
const yenSeen = (page) => page.evaluate((re) => {
  const V = document.querySelector('#cr .cr-view:not([hidden])');
  const vis = (n) => !!n && n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden';
  const out = [], w = document.createTreeWalker(V, NodeFilter.SHOW_TEXT), r = new RegExp(re);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    const p = t.parentElement;
    if (p && vis(p) && !p.closest('select, .pv-no-cur') && r.test(t.nodeValue)) out.push(t.nodeValue.trim().slice(0, 40));
  }
  return out;
}, YEN_AMT.source);
scene('cur', '会社ページでドル → 比較（¥ の額が無い・推定年収は会社ページと同じ字）→ 入れ替え → カード（職位の額は比較と同じ字）→ 円に戻すと1文字も違わない', async () => {
  await H.makeReaders(CUR.env, { via: VIA });
  const { page } = await open('pc', { url: '/airlines/jal.html', before: WALK_BEFORE });
  const c0 = await coRead(page, 'jal');
  await page.evaluate(() => window.PVCurrency.set('USD'));
  const moved = await page.waitForFunction((y) => { const e = document.querySelector('.pvg-rank[data-rank="cap"] .pvg-big'); return !!e && e.textContent.trim() !== y && /\$/.test(e.textContent); },
    { timeout: 15000, polling: 100 }, c0.est.cap).then(() => true, () => false);
  const c1 = await coRead(page, 'jal');
  await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), page.click('a.pvg-btn-cmp')]);
  const st = await page.evaluate(() => window.PVCareer.state());
  const s1 = await settled(page, st.a, st.b);
  const F1 = await figures(page), Y1 = await yenSeen(page);
  ok(c0.cur === 'JPY' && moved && c1.cur === 'USD' && s1 && F1.cur === 'USD' && Y1.length === 0
    && estOf(F1, 'jal', 'cap') === c1.est.cap && estOf(F1, 'jal', 'fo') === c1.est.fo,
    `会社ページ airlines/jal.html でドルにして「他社と比較」（${st.a}｜${st.b}）→ 見えている額に ¥ が無い（原貨の字のほか）・JAL の推定年収は会社ページと同じ字（${c1.est.cap}・${c1.est.fo}）`,
    J({ c0: c0.est, c1: c1.est, cur: [c0.cur, c1.cur, F1.cur], yen: Y1, est: F1.est }));
  await page.click('#cr-swap');
  const s2 = await settled(page, st.b, st.a);
  const F2 = await figures(page), Y2 = await yenSeen(page);
  await page.click('#cr-to-card');
  const C = await cardUp(page, [st.b, st.a]);
  const cards = C.model ? C.model.cards : [];
  const role = (s, rk) => { const c = cards.find((x) => x.slug === s); return c && c.roles[rk] ? c.roles[rk].text : null; };
  ok(s2 && Y2.length === 0 && C.up && [st.a, st.b].every((s) => ['cap', 'fo'].every((rk) => !!role(s, rk) && role(s, rk) === estOf(F2, s, rk) && /\$/.test(role(s, rk)))),
    `入れ替えても ¥ の額が無い → カード：職位の額は比較と同じ字（ドル）`, J({ yen: Y2, roles: cards.map((c) => [c.slug, role(c.slug, 'cap'), role(c.slug, 'fo')]), est: F2.est }));
  await page.evaluate(() => window.PVCurrency.set('JPY'));
  const back = await page.waitForFunction((y) => {
    const m = window.PVCareerCard && window.PVCareerCard.model && window.PVCareerCard.model();
    const c = m && m.cards && m.cards.find((x) => x.slug === 'jal');
    return !!c && c.roles.cap && c.roles.cap.text === y;
  }, { timeout: 15000, polling: 100 }, c0.est.cap).then(() => true, () => false);
  const CJ = await page.evaluate(() => { const c = window.PVCareerCard.model().cards.find((x) => x.slug === 'jal'); return { cap: c.roles.cap.text, fo: c.roles.fo.text }; });
  await page.goBack();
  const s3 = await settled(page, st.b, st.a);
  const F3 = await figures(page), Y3 = await yenSeen(page);
  ok(back && s3 && F3.cur === 'JPY' && Y3.length > 0 && CJ.cap === c0.est.cap && CJ.fo === c0.est.fo && estOf(F3, 'jal', 'cap') === c0.est.cap && estOf(F3, 'jal', 'fo') === c0.est.fo,
    `円に戻す → カードと比較の JAL の額は、最初に会社ページで読んだ円の字と1文字も違わない（${c0.est.cap}・${c0.est.fo}）・円の額が見える（¥ を数える目が空振りしていない）`,
    J({ first: c0.est, card: CJ, cmp: F3.est, cur: F3.cur, yen: Y3.length }));
});

/* ══ 走らせる ═══════════════════════════════════════════════════ */
const KEYS = Object.keys(SCENES);
const bad = (WANT || []).filter((k) => !KEYS.includes(k));
if (bad.length) { console.error(`知らない場面: ${bad.join(',')}（在るのは ${KEYS.join(',')}）`); process.exit(2); }
const t0 = Date.now();
const NET = { out: 0, refused: 0, through: 0, chrome: 0 };
for (const s of KEYS.filter((k) => !WANT || WANT.includes(k)).map((k) => SCENES[k])) {
  CUR = { ...s, pages: [], env: null, px: null, browser: null, front: null };
  head(`[REAL LOCAL CONNECTION] via ${VIA} ${s.key} ── ${s.label}`);
  try {
    Object.assign(CUR, await stage(s.opt));
    await s.fn();
  } catch (e) {
    ok(false, '場面が最後まで走らなかった', String((e && e.stack) || e).slice(0, 500));
  } finally {
    for (const o of CUR.pages) { try { await o.ctx.close(); } catch { /* もう閉じている */ } }
    if (CUR.browser) await CUR.browser.close();
    const sts = CUR.pages.map((o) => o.st);
    const all = (k) => sts.flatMap((x) => x[k]);
    const refused = CUR.px ? CUR.px.log.slice() : [];
    NET.out += all('out').length; NET.through += all('through').length;
    /* 門：外へ向かった要求は、断っても赤（出てよいのは、この場面のサーバーの番号と LIBS だけ） */
    const chrome = CUR.front ? refused.filter((x) => CHROME_OWN.test(x) && !all('out').some((o) => o.includes(x.slice(8).split(':')[0]))) : [];
    const refusedBad = refused.filter((x) => !chrome.includes(x));
    NET.refused += refusedBad.length; NET.chrome += chrome.length;
    ok(all('out').length === 0 && refusedBad.length === 0,
      `門：この場面のサーバーと部品の配信元（LIBS）のほかへ向かった要求 0（断る口に来た要求 0${chrome.length ? '・ページからでないブラウザ自身の通信のほか' : ''}）`,
      [...all('out'), ...refusedBad].join('・'));
    if (chrome.length) console.log(`  ・ブラウザ自身の通信（ページからではない・断る口が断った・外へは出ていない）: ${[...new Set(chrome)].map((x) => `${x}×${chrome.filter((y) => y === x).length}`).join('・')}`);
    ok(all('through').length === 0, '門：外へ出て返事が届いた要求 0', all('through').join('・'));
    const errs = [...new Set(all('errs'))];
    if (errs.length) console.log(`  ・ページの中のエラー: ${errs.join(' ／ ')}`);
    if (CUR.px) await CUR.px.close();
    if (CUR.front) await CUR.front.close();
    if (CUR.env) await CUR.env.stop();
  }
}
CUR = null;
const ran = KEYS.filter((k) => !WANT || WANT.includes(k));
console.log(`\n  場面: ${ran.join(', ')}${WANT ? '（--scenes で絞った。緑でも全部を見たことにはならない）' : ''}`);
console.log(`  ★外への通信（この場面のサーバーと LIBS のほか）: ページから ${NET.out}・断る口に来た ${NET.refused}・返事が届いた ${NET.through}`
  + `${NET.chrome ? `（ほかに、ページからでないブラウザ自身の通信 ${NET.chrome} ── 断る口が断った・外へは出ていない）` : ''}`);
console.log(`\n══ ${pass} pass / ${fail} fail ══（REAL LOCAL CONNECTION ＝ 手元の SQL。本番は 未確認）  ${Math.round((Date.now() - t0) / 1000)}s`);
process.exit(fail ? 1 : 0);
