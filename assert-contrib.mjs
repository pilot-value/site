/* assert-contrib.mjs — 会社ページの上で開く「情報を追加」の面（pv-contrib.js / pv-contrib.css）。

   会社ページから離れずに情報を1つ足す面。画面は普通に動いたまま、静かに嘘になる形が
   いくつもあるので、ここで1つずつ押さえる：

     ① 開く・閉じる ── 押して開く／?add= で開く／「戻る」・Esc・暗い所で閉じる。
        開いたまま読み直した人を、履歴の1段ぶん取り残さない。
     ② 会社を選び直させない（会社ページの上で開いているのだから）。
     ③ 月の勤務 ── **空欄は未回答（null）・0 は 0**。0 で埋めない・0 を消さない。
        1項目だけで保存できる。読み直すとその1項目だけが戻り、残りは「未回答」。
        サーバが断った理由はそのまま出し、打った字は1文字も消さない。
     ④ 送れなかったとき ── 「送れていません」と言い、打った内容を残し、
        読み直してももう一度送れる。送れたら控えを消す。
     ⑤ 未ログイン ── ★ログインなしで保存できる（2026-10-07 オーナー指定）。
        保存先はサーバの預かりで、本人のしるしは「サーバが作った推測できない鍵」。
        同じ端末からは読み直して直せる。鍵を持たない端末・ほかの会員には何も返らない。
        ログインすると本人の投稿として引き継がれ、預かりにも鍵にも何も残らない。
        ⚠️ ブラウザの中にだけ置いたものを「保存しました」と言わない。
     ⑥ 通勤・タクシー ── 親と子の答えを1回で送る。読み直すと答えが戻る。上書きできる。
        どの質問にも任意の補足を添えられる。ただし補足は「追加の説明」で、
        選ぶ質問の代わりにしない（8問とも選ぶ形のまま残す）。
     ⑦ 「あなたの投稿 N件」は、サーバが本人について返した行数だけ。
        まだ何も出していない人には1つも出さない。質問の数を答えの数として出さない。
     ⑧ 勤務を保存しても、給与の鍵は1つも動かない（預けても・引き継いでも）。
     ⑨ 3つの大きさ（390×680・768×950・1440×820）で、押せる所が 44px 未満にならない・
        入力欄が 16px 未満にならない・面が横に溢れない。
     ⑩ 本番へ1本も投げない。
     ⑪ 一覧の7つの話題は全部この面の中で開く（質問の分け方は会社ページの入口と同じ）。
        会社ページの質問の名前を押すと、その質問を開いた状態で出る（ほかの画面へ行かない）。

   実行: node assert-contrib.mjs
   ⚠️ 自分で手元の保存先（serve-local.mjs）を空いているポートで起こし、終わったら丸ごと捨てる。
      3000 番（本番の DB につながっている）は使わない。
   ⚠️ 会社ページがまだ pv-contrib を読み込んでいない間は、この検査が自分で差し込む
      （ページ側が読み込むようになったら、そちらをそのまま使う）。
*/
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + ' ' + e)); };
const J = (v) => { try { return JSON.stringify(v).slice(0, 300); } catch { return String(v); } };

const SIZES = {
  phone:  { w: 390,  h: 680, touch: true },
  tablet: { w: 768,  h: 950, touch: true },
  desk:   { w: 1440, h: 820, touch: false },
};
const LIBS = /^(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.tailwindcss\.com)$/;
const NONE = '未回答';
const NUM_KEYS = ['block_hours', 'duty_hours', 'work_days', 'duty_days', 'days_off', 'stay_nights'];

// ═══════════════════════════════════════════════════════════════
// 0. ソースの検査（ブラウザを開かなくても分かること）
// ═══════════════════════════════════════════════════════════════
/* 「出頭から解放まで」は拘束時間の数え方の選択肢（サーバの report_to_release ＝「出頭〜解放」の字）。
   勤務から解かれる意味の「解放」で、年収の鍵の話ではないので、その1語だけ除いてから見る
   （ソースの検査と、保存後の画面の検査の両方で使う）。 */
const DUTY_TERM = /出頭から解放まで/g;

console.log('\n════ ソース ════');
{
  const css = read('pv-contrib.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const js = read('pv-contrib.js');
  const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, (m, a) => a);
  const tokens = read('pv-tokens.css');

  /* どの規則も .pvc で始まる（ページのほかの部品に1つも当たらない） */
  const sels = [];
  {
    const stack = [];
    let buf = '';
    for (const ch of css) {
      if (ch === '{') {
        const pre = buf.trim(); buf = '';
        const at = pre.startsWith('@');
        const inKf = stack.some((s) => /^@(-webkit-)?keyframes/.test(s));
        if (!at && !inKf) {
          let depth = 0, cur = '';
          for (const c of pre) {
            if (c === '(') depth++;
            if (c === ')') depth--;
            if (c === ',' && depth === 0) { sels.push(cur.trim()); cur = ''; } else cur += c;
          }
          if (cur.trim()) sels.push(cur.trim());
        }
        stack.push(pre);
      } else if (ch === '}') { stack.pop(); buf = ''; } else if (ch === ';') buf = ''; else buf += ch;
    }
  }
  const stray = sels.filter((s) => !s.startsWith('.pvc'));
  ok(sels.length > 50 && stray.length === 0, `CSS のどの規則も .pvc で始まる（${sels.length} 個）`, J(stray.slice(0, 5)));
  ok(!/#[0-9a-fA-F]{3,8}\b/.test(css) && !/\b(rgba?|hsla?)\(/.test(css), 'CSS に色の直書き（hex・rgb・hsl）が無い',
    J((css.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\([^)]*\)/g) || []).slice(0, 5)));
  ok(!/prefers-color-scheme/.test(css), 'CSS に prefers-color-scheme が無い（明暗は data-theme で決まる）');
  const used = [...new Set(css.match(/var\(\s*(--pv-[a-z0-9-]+)/g) || [])].map((s) => s.replace(/var\(\s*/, ''));
  const missing = used.filter((t) => !new RegExp(t.replace(/[-]/g, '\\-') + '\\s*:').test(tokens));
  ok(used.length > 5 && missing.length === 0, `使っている色・影の名前は全部 pv-tokens.css に在る（${used.length} 個）`, J(missing));
  const trans = [...css.matchAll(/transition(?:-property)?\s*:\s*([^;}]+)/g)].map((m) => m[1].trim());
  const badTrans = trans.filter((t) => t.split(',').some((p) => !/^(transform|opacity|none)\b/.test(p.trim())));
  ok(trans.length > 0 && badTrans.length === 0 && !/transition-all/.test(css), '動かすのは transform と opacity だけ（transition: all が無い）', J(badTrans.slice(0, 4)));
  const smallFont = [...css.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/g)].map((m) => +m[1]).filter((n) => n < 12);
  ok(smallFont.length === 0, 'CSS に 12px 未満の文字が無い', J(smallFont));
  for (const st of [':hover', ':focus-visible', ':active']) {
    const need = ['.pvc-close', '.pvc-tile', '.pvc-send', '.pvc-ghost', '.pvc-talk', '.pvc-fold-b', '.pvc-prev'];
    const lack = need.filter((n) => !sels.some((s) => s.includes(n + st)));
    ok(lack.length === 0, `押せる部品に ${st} の見た目が在る`, J(lack));
  }

  ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\.write\(/.test(code),
    'JS は innerHTML・insertAdjacentHTML・document.write を使わない（文字は textContent でしか入れない）');
  ok(/textContent/.test(code), 'JS は textContent で文字を入れている');
  ok(!/[¥￥€£＄]|[$]\s?\d|\d\s?(万円|万|円)|\b(JPY|USD|AED|HKD|TWD)\b/.test(code), 'JS に金額が1つも書かれていない',
    J((code.match(/.{0,20}(?:[¥￥€£＄]|[$]\s?\d|\d\s?(?:万円|万|円)|\b(?:JPY|USD|AED|HKD|TWD)\b).{0,20}/g) || []).slice(0, 3)));
  ok(!/supabase\.co/.test(js) && !/\/Users\//.test(js + css), 'JS・CSS に本番の住所も、この Mac の中の場所も書かれていない');
  /* 呼ぶ関数は7つ ── 会員の「出す」「自分の分を読む」が2つずつ、ログインしていない人の
     「預ける」「預けた分を読む」、ログインしたあとの「引き継ぐ」。
     会員の「出す」2つは名前の表（MEMBER_FN）を通して呼ぶので、表の中身も一緒に数える。
     それ以外の形で名前を渡している呼び出しが在れば、ここで見落とすことになるので落とす。 */
  const rpcLit = [...code.matchAll(/rpc\('([a-z_]+)'/g)].map((m) => m[1]);
  const rpcTbl = [...((code.match(/var MEMBER_FN = \{([^}]*)\}/) || [])[1] || '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  const rpcDyn = [...new Set([...code.matchAll(/rpc\(([^'\s][^,)]*)/g)].map((m) => m[1].trim()))].sort();
  const rpcs = [...new Set([...rpcLit, ...rpcTbl])].sort();
  ok(J(rpcs) === J(['claim_contrib', 'my_airline_conditions', 'my_contrib_anon', 'my_work_months',
    'submit_airline_conditions', 'submit_contrib_anon', 'submit_work_month']),
    '呼ぶ関数は7つだけ（会員の「出す」「読む」×2・未ログインの「預ける」「読む」・ログイン後の「引き継ぐ」）', J(rpcs));
  ok(J(rpcDyn) === J(['MEMBER_FN[kind]', 'name']), '名前を表から引いて呼ぶのは、会員の「出す」の1か所だけ（ほかに見えない呼び出しが無い）', J(rpcDyn));
  ok(!/pv_work_view|pv_contrib_notes|pv_pay_rows|pv_reviews/.test(code), '「情報を追加」の面は、ほかの人の回答・給与・口コミを読む口を1つも呼ばない');

  /* サーバの決まりを写している2つの値が、正本と同じか。
     どちらも「見える範囲」や「消える日」を決めているのはサーバで、ここが違っていても
     動きは変わらない ── 変わるのは、書く前に画面が言う断りの文だけ（＝嘘の約束になる）。 */
  const sqlC = read('db/contrib.sql');
  const held = +((code.match(/var HELD_DAYS = (\d+);/) || [])[1] || 0);
  const ttl = +((sqlC.match(/function public\.pv_contrib_ttl\(\)[\s\S]{0,160}?interval '(\d+) days'/) || [])[1] || 0);
  ok(held > 0 && held === ttl, `預かりの日数が、画面の文とサーバで同じ（${held}日 ⇄ ${ttl}日）`);
  const paySecJs = [...((code.match(/var PAY_SECTIONS = \{([^}]*)\}/) || [])[1] || '').matchAll(/([a-z_]+)\s*:/g)].map((m) => m[1]).sort();
  const paySecSql = [...((sqlC.match(/q\.section not in \(([^)]*)\)/) || [])[1] || '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  ok(paySecJs.length > 0 && J(paySecJs) === J(paySecSql), '補足が「給与を提出した会員」にだけ見える区分が、画面の文とサーバで同じ', J({ js: paySecJs, sql: paySecSql }));
  ok(!/REAL PAY|解放|アンロック|unlock/i.test(code.replace(DUTY_TERM, '')), 'JS は「REAL PAY が開く」と1文字も言わない',
    J((code.replace(DUTY_TERM, '').match(/.{0,16}(?:REAL PAY|解放|アンロック|unlock).{0,16}/gi) || []).slice(0, 3)));
  ok(!/機内弁当|住まい・家族/.test(code), '保存先の無い項目（機内弁当・食事／住まい・家族）のタイルを置いていない');
}

// ═══════════════════════════════════════════════════════════════
// 1. 手元の保存先とブラウザ
// ═══════════════════════════════════════════════════════════════
const { start, MEMBERS } = await import('./serve-local.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-contrib-'));
let local = null, browser = null;
const supa = new Set(), blocked = new Set(), pageErrs = [];

async function main() {
  local = await start({ port: 0, dir: tmp, quiet: true });
  const base = local.url;
  const q = (sql, params) => local.locked(() => local.db.query(sql, params));
  const memberOf = (key) => MEMBERS.find((m) => m.key === key);
  browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });

  /* ── 道具 ─────────────────────────────────────────────── */
  function gate(req, st) {
    let u;
    try { u = new URL(req.url()); } catch { return req.continue(); }
    if (u.protocol === 'data:' || u.protocol === 'blob:' || u.protocol === 'about:') return req.continue();
    if (u.origin === base) {
      const m = u.pathname.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/);
      if (m) {
        st.calls.push(m[1]);
        if (st.fake && st.fake.name === m[1]) {
          const f = st.fake; st.fake = null;
          return req.respond({ status: f.status || 200, contentType: 'application/json', body: JSON.stringify(f.body) });
        }
      }
      return req.continue();
    }
    if (LIBS.test(u.hostname)) return req.continue();
    if (/supabase\.(co|in|com)$/.test(u.hostname)) supa.add(`${req.method()} ${u.hostname}${u.pathname}`);
    else blocked.add(`${req.method()} ${u.hostname}`);
    return req.abort();
  }

  /* 1枚開く。who を渡すと手元の会員として入った状態で始める。 */
  async function open(sizeKey, { who = null, theme = null } = {}) {
    const size = SIZES[sizeKey];
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    const st = { calls: [], fake: null, ctx };
    page.setDefaultTimeout(20000);
    await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: 1, isMobile: size.touch, hasTouch: size.touch });
    await page.setRequestInterception(true);
    page.on('request', (req) => gate(req, st));
    page.on('pageerror', (e) => pageErrs.push(String(e.message).slice(0, 160)));
    let seed = null;
    if (who) {
      seed = await (await fetch(`${base}/__local/login?member=${who}`)).json();
      if (!seed || !seed.session) throw new Error(`手元の会員 ${who} で入れない`);
    }
    await page.evaluateOnNewDocument((origin, s, th) => {
      if (location.origin !== origin) return;
      try {
        /* 保存できたときの合図を控える */
        window.__pvcSaved = [];
        document.addEventListener('pvc:saved', (e) => window.__pvcSaved.push(e.detail));
        /* ページがまだ読み込んでいなければ、ここで差し込む（読み込んでいればそのまま使う） */
        const add = () => {
          if (!document.body || !document.body.getAttribute('data-airline')) return;
          if (!document.querySelector('link[href*="pv-contrib.css"]')) {
            const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/pv-contrib.css'; l.setAttribute('data-test-injected', '');
            document.head.appendChild(l);
          }
          if (!document.querySelector('script[src*="pv-contrib.js"]')) {
            const sc = document.createElement('script'); sc.src = '/pv-contrib.js'; sc.setAttribute('data-test-injected', '');
            document.head.appendChild(sc);
          }
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();

        if (localStorage.getItem('pv_local_seeded')) return;
        localStorage.setItem('pv_local_ui', '0');          // 会員を切り替える札は隠す（左下に重なる）
        if (th) localStorage.setItem('pv-theme', th);
        if (s) {
          const now = String(Date.now());
          localStorage.setItem('sb-local-auth-token', JSON.stringify(s.session));
          localStorage.setItem('pv_user', JSON.stringify(s.pv_user));
          localStorage.setItem('pv_last_active', now);
          localStorage.setItem('pv_session_start', now);
          /* Give → Get の板は「さっき見た」ことにする（板ではなく、その上の面を見たい） */
          const at = Date.parse((s.session.user || {}).last_sign_in_at || '');
          localStorage.setItem('pv_give_seen', JSON.stringify({ t: Date.now(), s: String(isNaN(at) ? now : at) }));
        }
        localStorage.setItem('pv_local_seeded', '1');
      } catch (e) { /* 保存領域に触れない画面はそのまま */ }
    }, base, seed, theme);
    return { page, st, size, sizeKey };
  }
  const go = async (p, urlPath) => {
    await p.page.goto(base + urlPath, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (/^\/airlines\//.test(urlPath)) {
      await p.page.waitForFunction(() => !!window.PVContrib
        && [...document.styleSheets].some((s) => s.href && s.href.includes('pv-contrib.css')), { timeout: 30000 });
    }
  };
  /* 面が目当ての画面を出し、入力できる状態になるまで待つ */
  const waitView = (p, what) => p.page.waitForFunction((w) => {
    const r = document.querySelector('.pvc-root');
    if (!r || r.hidden || !r.classList.contains('is-in')) return false;
    const s = r.querySelector('.pvc-sheet').getBoundingClientRect();
    if (Math.abs(s.right - document.documentElement.clientWidth) > 1 || Math.abs(s.bottom - window.innerHeight) > 1) return false;
    if (w === 'list') return !!r.querySelector('.pvc-tiles');
    if (w === 'counted') {
      const st = r.querySelector('[data-pvc-state]');
      return !!st && /^(ok|anon|off|fail) (ok|anon|off|fail)$/.test(st.getAttribute('data-pvc-state'));
    }
    if (w === 'saved') return !!r.querySelector('[data-pvc-saved]');
    const f = r.querySelector('form[data-pvc-form="' + w + '"]');
    const set = f && f.querySelector('fieldset.pvc-set');
    return !!set && !set.disabled;
  }, {}, what);
  const waitClosed = (p) => p.page.waitForFunction(() => {
    const r = document.querySelector('.pvc-root');
    return (!r || !r.classList.contains('is-in')) && !(history.state && history.state.pvc);
  });
  const api = (p, topic) => p.page.evaluate((t) => window.PVContrib.open({ topic: t }), topic);
  const snap = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root');
    const f = r && r.querySelector('form[data-pvc-form]');
    return {
      open: !!(r && !r.hidden && r.classList.contains('is-in')),
      title: r ? r.querySelector('.pvc-title').textContent : '',
      form: f ? f.getAttribute('data-pvc-form') : '',
      saved: !!(r && r.querySelector('[data-pvc-saved]')),
      href: location.pathname + location.search, len: history.length,
      mark: !!(history.state && history.state.pvc),
      lock: getComputedStyle(document.documentElement).overflowY,
      inside: !!(r && r.contains(document.activeElement)),
    };
  });
  /* 押して開く。ページに本物の入口が在ればそれを、無ければ同じ属性の試験用ボタンを押す。 */
  async function press(p, topic) {
    const real = await p.page.evaluate((t) => {
      for (const n of document.querySelectorAll('[data-test-hit]')) n.removeAttribute('data-test-hit');
      const all = [...document.querySelectorAll('[data-pvc-open]')].filter((n) => !n.hasAttribute('data-test-trigger'));
      let n = all.find((x) => (x.getAttribute('data-pvc-open') || '') === t && x.getClientRects().length);
      const found = !!n;
      if (!n) {
        n = document.querySelector('[data-test-trigger="' + t + '"]');
        if (!n) {
          n = document.createElement('button');
          n.type = 'button'; n.textContent = '情報を追加';
          n.setAttribute('data-pvc-open', t); n.setAttribute('data-test-trigger', t);
          n.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9000;min-width:120px;min-height:44px';
          document.body.appendChild(n);
        }
      }
      n.setAttribute('data-test-hit', '1');
      return found;
    }, topic);
    await p.page.click('[data-test-hit="1"]');
    return real;
  }
  const fill = async (p, name, v) => {
    await p.page.$eval(`.pvc-root [name="${name}"]`, (n) => { n.focus(); if (n.select) n.select(); });
    await p.page.keyboard.press('Backspace');
    if (v !== '') await p.page.keyboard.type(String(v));
  };
  const pick = (p, name, v) => p.page.select(`.pvc-root select[name="${name}"]`, v);
  const chip = async (p, qid, code) => {
    const h = await p.page.$(`.pvc-root [data-q="${qid}"] input[value="${code}"]`);
    const lab = await h.evaluateHandle((n) => n.closest('label'));
    await lab.click();
  };
  const tick = async (p) => {
    const on = await p.page.$eval('.pvc-root input[name="own"]', (n) => n.checked);
    if (!on) await p.page.click('.pvc-root label.pvc-own');
  };
  const send = (p) => p.page.click('.pvc-root form .pvc-send[type="submit"]');
  const vals = (p) => p.page.evaluate(() => {
    const o = {};
    for (const n of document.querySelectorAll('.pvc-root form [name]')) {
      if (n.type === 'checkbox') { if (n.name === 'own') o.own = n.checked; else if (n.checked) (o[n.name] = o[n.name] || []).push(n.value); } else o[n.name] = n.value;
    }
    return o;
  });
  const summary = (p) => p.page.evaluate(() => {
    const o = {};
    for (const r of document.querySelectorAll('.pvc-root .pvc-sum-r')) {
      const v = r.querySelector('.pvc-sum-v');
      o[r.getAttribute('data-k')] = { v: v.textContent, none: v.classList.contains('is-none') };
    }
    const h = document.querySelector('.pvc-root .pvc-saved-h');
    return { head: h ? h.textContent : '', rows: o, text: document.querySelector('.pvc-root .pvc-main').innerText };
  });
  const msg = (p, kind) => p.page.evaluate((k) => {
    const n = document.querySelector('.pvc-root .pvc-msg[data-pvc-msg="' + k + '"]');
    return n ? n.innerText : null;
  }, kind);
  const waitMsg = (p, kind) => p.page.waitForSelector(`.pvc-root .pvc-msg[data-pvc-msg="${kind}"]`);
  const outboxOf = (p) => p.page.evaluate(() => localStorage.getItem('pv_contrib_outbox'));
  const failNext = (match, mode, n = 1) => fetch(`${base}/__local/fail?n=${n}&match=${match}${mode ? '&mode=' + mode : ''}`);
  const failOff = () => fetch(`${base}/__local/fail?n=0`);
  const hits = (p, name) => p.st.calls.filter((c) => c === name).length;

  const workRows = async (slug) => (await q(
    `select period_year as y, period_month as m, "position" as pos, fleet, block_hours::float8 as block_hours,
            duty_hours::float8 as duty_hours, work_days, duty_days, days_off, stay_nights,
            duty_hours_basis, commute_included, note
       from public.pv_work_months where airline = $1 order by period_year desc, period_month desc`, [slug])).rows;
  const condRows = async (slug) => {
    const o = {};
    for (const r of (await q(
      `select question_id as q, answer_code as c, answer_codes as cs, answer_text as t
         from public.airline_conditions where airline = $1`, [slug])).rows) {
      (o[r.q] = o[r.q] || []).push({ c: r.c, cs: r.cs ? [...r.cs].sort() : null, t: r.t });
    }
    return o;
  };
  const payKey = async (id) => J((await q(
    `select access_until, pay_report_count, last_pay_report_at, badge, verify_level,
            (select count(*)::int from public.pay_reports) as reports
       from public.profiles where id = $1`, [id])).rows[0]);

  /* 大きさと溢れを測る */
  const measure = (p) => p.page.evaluate(() => {
    const root = document.querySelector('.pvc-root'), sheet = root.querySelector('.pvc-sheet'), main = root.querySelector('.pvc-main');
    const sr = sheet.getBoundingClientRect();
    const out = {
      small: [], tiny: [], font: [], over: [],
      sheet: { x: sr.left, y: sr.top, w: sr.width, h: sr.height },
      vw: document.documentElement.clientWidth, vh: window.innerHeight,
      mainX: main.scrollWidth - main.clientWidth, sheetX: sheet.scrollWidth - sheet.clientWidth,
      docX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
    const name = (n) => n.tagName.toLowerCase() + (n.className && typeof n.className === 'string' ? '.' + n.className.split(' ')[0] : '') + (n.name ? '[' + n.name + ']' : '');
    const vis = (n) => {
      if (n.closest('[hidden]')) return false;
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const r = n.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    for (const n of sheet.querySelectorAll('a[href], button, select, textarea, input:not([type="checkbox"]), label.pvc-chip, label.pvc-own')) {
      if (!vis(n)) continue;
      const r = n.getBoundingClientRect();
      if (r.width < 43.5 || r.height < 43.5) out.small.push(`${name(n)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    for (const n of sheet.querySelectorAll('select, textarea, input:not([type="checkbox"])')) {
      if (!vis(n)) continue;
      const fs = parseFloat(getComputedStyle(n).fontSize);
      if (fs < 16) out.font.push(`${name(n)} ${fs}px`);
    }
    const w = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
    let t;
    while ((t = w.nextNode())) {
      if (!t.nodeValue.trim()) continue;
      const el = t.parentElement;
      if (!el || el.closest('option') || !vis(el)) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 12) out.tiny.push(`${name(el)} ${fs}px「${t.nodeValue.trim().slice(0, 12)}」`);
    }
    for (const n of sheet.querySelectorAll('*')) {
      if (n.closest('svg') && n.tagName.toLowerCase() !== 'svg') continue;
      if (!vis(n)) continue;
      const r = n.getBoundingClientRect();
      if (r.left < sr.left - 0.5 || r.right > sr.right + 0.5) out.over.push(`${name(n)} ${Math.round(r.left)}〜${Math.round(r.right)}`);
    }
    return out;
  });
  function checkSize(m, label) {
    ok(m.small.length === 0, `${label}：押せる所が 44px 未満になっていない`, J(m.small.slice(0, 6)));
    ok(m.font.length === 0, `${label}：入力欄の文字が 16px 以上`, J(m.font.slice(0, 6)));
    ok(m.tiny.length === 0, `${label}：12px 未満の文字が無い`, J(m.tiny.slice(0, 6)));
    ok(m.over.length === 0 && m.mainX <= 0 && m.sheetX <= 0 && m.docX <= 0, `${label}：面が横に溢れていない`,
      J({ over: m.over.slice(0, 5), mainX: m.mainX, sheetX: m.sheetX, docX: m.docX }));
  }
  /* 1つの場面が途中で止まっても、残りの場面は見る */
  async function scene(title, fn) {
    console.log(`\n════ ${title} ════`);
    try { await fn(); } catch (e) { ok(false, `「${title}」が最後まで進んだ`, String(e && e.message || e).split('\n')[0].slice(0, 220)); }
  }

  const A = memberOf('a'), B = memberOf('b');
  const JAL = '/airlines/jal.html', EY = '/airlines/etihad.html';
  const nameOf = (p) => p.page.evaluate(() => (document.body.getAttribute('data-pvc-name') || '').trim()
    || (document.querySelector('.hero-airline h1') || {}).textContent.trim());

  // ═════════════════════════════════════════════════════════════
  // 2. 開く・閉じる・履歴（日本航空・1440×820・会員A）
  // ═════════════════════════════════════════════════════════════
  const a = await open('desk', { who: 'a' });
  let jalName = '';
  await scene('開く・閉じる・履歴', async () => {
    await go(a, '/pv-vocab.json');                       // 「前に居たページ」の役
    await go(a, JAL);
    jalName = await nameOf(a);
    const before = await snap(a);
    const real = await press(a, '');
    console.log(`  （入口：${real ? 'ページに在る data-pvc-open' : 'ページにまだ無いので、同じ属性の試験用ボタン'}）`);
    await waitView(a, 'list');
    let s = await snap(a);
    ok(s.open && s.title === `${jalName}に情報を追加`, '入口を押すと面が開き、見出しが「{会社}に情報を追加」', J(s));
    ok(s.len === before.len + 1 && s.href === before.href && s.mark, '開くと履歴を1段だけ積む（住所は同じ）', J({ before: before.len, after: s.len, href: s.href }));
    ok(s.lock === 'hidden' && s.inside, '開いている間は下のページが動かず、焦点が面の中に在る', J(s));
    const asked = await a.page.evaluate(() => {
      const sh = document.querySelector('.pvc-sheet');
      return { field: !!sh.querySelector('[name="airline"], [name="company"], [name="airline_other"]'), dialog: sh.getAttribute('role') === 'dialog' && sh.getAttribute('aria-modal') === 'true' };
    });
    ok(!asked.field && asked.dialog, '会社を選ぶ欄が無い（会社ページの会社がそのまま使われる）', J(asked));

    let escaped = false;
    for (let i = 0; i < 14; i++) {
      await a.page.keyboard.press('Tab');
      if (!(await a.page.evaluate(() => document.querySelector('.pvc-sheet').contains(document.activeElement)))) escaped = true;
    }
    for (let i = 0; i < 3; i++) {
      await a.page.keyboard.down('Shift'); await a.page.keyboard.press('Tab'); await a.page.keyboard.up('Shift');
      if (!(await a.page.evaluate(() => document.querySelector('.pvc-sheet').contains(document.activeElement)))) escaped = true;
    }
    ok(!escaped, 'Tab を何度押しても、焦点が面の外へ出ない');

    await a.page.keyboard.press('Escape');
    await waitClosed(a);
    s = await snap(a);
    const back = await a.page.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-test-hit'));
    ok(!s.open && !s.mark && s.lock !== 'hidden' && s.href === before.href, 'Esc で閉じる（履歴の印も、ページの固定も残らない）', J(s));
    ok(back, '閉じると、焦点が押した入口へ戻る');

    await press(a, '');
    await waitView(a, 'list');
    await a.page.mouse.click(60, 400);                   // 面の外（暗い所）
    await waitClosed(a);
    ok(!(await snap(a)).open, '暗い所を押すと閉じる');

    await press(a, '');
    await waitView(a, 'list');
    await a.page.click('.pvc-root .pvc-close');
    await waitClosed(a);
    ok(!(await snap(a)).open, '× で閉じる');

    await press(a, '');
    await waitView(a, 'list');
    await a.page.goBack({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
    await waitClosed(a);
    s = await snap(a);
    ok(!s.open && s.href === before.href, '★ブラウザの「戻る」で閉じる（ページからは出ない）', J(s));
    await a.page.goForward({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
    await waitView(a, 'list');
    ok((await snap(a)).open, '「進む」で同じ面へ戻れる');
    await a.page.goBack({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
    await waitClosed(a);

    /* 開いたまま読み直す → 面は閉じていて、「戻る」1回で前のページへ出られる */
    await press(a, '');
    await waitView(a, 'list');
    await a.page.reload({ waitUntil: 'domcontentloaded' });
    await a.page.waitForFunction(() => !!window.PVContrib && !(history.state && history.state.pvc));
    s = await snap(a);
    ok(!s.open && !s.mark, '開いたまま読み直すと、面は閉じていて履歴の印も残っていない', J(s));
    await a.page.goBack({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
    await a.page.waitForFunction(() => location.pathname !== '/airlines/jal.html', { timeout: 8000 }).catch(() => {});
    const where = await a.page.evaluate(() => location.pathname);
    ok(where === '/pv-vocab.json', '★読み直したあと「戻る」1回で前のページへ出る（1段取り残さない）', where);

    /* 住所の ?add= で開く。開いたら住所から外す。 */
    await go(a, JAL + '?add=work');
    await waitView(a, 'work');
    s = await snap(a);
    ok(s.open && s.form === 'work' && s.href === JAL, '?add=work で月の勤務が開き、住所から add が外れる', J(s));
    await a.page.goBack({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
    await waitClosed(a);
    s = await snap(a);
    ok(!s.open && s.href === JAL, '?add= で開いた面も「戻る」で閉じ、add は戻ってこない', J(s));
    await go(a, JAL + '?x=1&add=taxi');
    await waitView(a, 'taxi');
    s = await snap(a);
    ok(s.form === 'taxi' && s.href === JAL + '?x=1', '?add=taxi で通勤・タクシーが開く（ほかの印は残す）', J(s));
  });

  /* ページが自分で読み込むようになっても、検査が差し込んでも、部品は1つだけ。
     何かの拍子に2回読まれても、面も履歴の段も2つにならない。 */
  await scene('部品は1つだけ（2回読み込まれても）', async () => {
    await go(a, JAL);
    const one = await a.page.evaluate(() => ({
      js: document.querySelectorAll('script[src*="pv-contrib.js"]').length,
      css: document.querySelectorAll('link[href*="pv-contrib.css"]').length,
      byPage: !document.querySelector('script[src*="pv-contrib.js"][data-test-injected]'),
    }));
    console.log(`  （部品：${one.byPage ? 'ページが自分で読み込んでいる' : 'ページはまだ読み込んでいないので、検査が差し込んだ'}）`);
    ok(one.js === 1 && one.css === 1, '★pv-contrib.js と pv-contrib.css は1枚に1つずつ（検査が二重に差し込んでいない）', J(one));
    await a.page.evaluate(() => { window.__pvcApi = window.PVContrib; });
    await a.page.addScriptTag({ url: base + '/pv-contrib.js?again=1' });
    const same = await a.page.evaluate(() => window.__pvcApi === window.PVContrib);
    const before = await snap(a);
    await press(a, 'work');
    await waitView(a, 'work');
    const s = await snap(a);
    const roots = await a.page.evaluate(() => document.querySelectorAll('.pvc-root').length);
    ok(same && roots === 1 && s.len === before.len + 1, '★2回読み込まれても、面は1つ・履歴の段も1つ', J({ same, roots, before: before.len, after: s.len }));
    await a.page.keyboard.press('Escape');
    await waitClosed(a);
    const end = await snap(a);
    ok(!end.open && !end.mark && end.href === before.href, '2回読み込まれたあとも、Esc 1回で閉じて履歴の印が残らない', J(end));
  });

  // ═════════════════════════════════════════════════════════════
  // 3. 月の勤務（日本航空・会員A）
  // ═════════════════════════════════════════════════════════════
  let keyBefore = '', lsBefore = null, ym = '';
  await scene('月の勤務 ── 1項目だけ・0 と未回答・直す', async () => {
    keyBefore = await payKey(A.id);
    await go(a, JAL);
    lsBefore = await a.page.evaluate(() => localStorage.getItem('pv_salary_unlock_expiry'));
    await api(a, 'list');
    await waitView(a, 'list');
    await a.page.click('.pvc-root [data-pvc-tile="work"]');
    await waitView(a, 'work');
    const f = await a.page.evaluate(() => {
      const r = document.querySelector('.pvc-root'), sel = r.querySelector('select[name="ym"]');
      const n = new Date(), y = n.getFullYear(), m = n.getMonth();
      const pad = (x) => String(x).padStart(2, '0');
      return {
        title: r.querySelector('.pvc-title').textContent, line: r.querySelector('.pvc-ctx-line').textContent,
        ym: sel.value, last: m === 0 ? `${y - 1}-12` : `${y}-${pad(m)}`, now: `${y}-${pad(m + 1)}`,
        first: sel.options[0].value, tail: sel.options[sel.options.length - 1].value,
        nums: [...r.querySelectorAll('form input.pvc-input')].map((x) => x.name),
        sels: [...r.querySelectorAll('form select')].map((x) => x.name),
        send: r.querySelector('.pvc-send').disabled, sendText: r.querySelector('.pvc-send').textContent,
        prev: !r.querySelector('.pvc-prev').hidden, tag: !r.querySelector('[data-pvc-own-row]').hidden,
        firstOpt: ['duty_hours_basis', 'commute_included', 'fleet'].map((k) => r.querySelector(`select[name="${k}"]`).options[0].textContent),
        fleets: r.querySelector('select[name="fleet"]').options.length - 1,
        noteMax: r.querySelector('textarea[name="note"]').getAttribute('maxlength'),
        own: r.querySelector('.pvc-own').innerText.trim(),
      };
    });
    ym = f.ym;
    const vocab = JSON.parse(read('pv-vocab.json'));
    ok(f.title === '月の勤務' && f.line.includes(jalName) && f.line.includes(`${+ym.slice(0, 4)}年${+ym.slice(5)}月`), '見出しは「月の勤務」。会社と対象月が上に出ている', J(f.line));
    ok(f.ym === f.last && f.first === f.now && f.tail === '2015-01', '対象月は先月が既定。未来の月と 2015年より前は選べない', J({ ym: f.ym, first: f.first, tail: f.tail }));
    ok(J(f.nums) === J(NUM_KEYS), '数字の欄はちょうど6つ（乗務時間・勤務/拘束時間・勤務した日・乗務した日・公休日・ステイ）', J(f.nums));
    ok(J(f.sels) === J(['ym', 'fleet', 'position', 'duty_hours_basis', 'commute_included']), '選ぶ欄は 対象月・機種・職位・数え方・通勤 の5つ（会社は無い）', J(f.sels));
    ok(f.firstOpt.every((t) => t === '回答しない'), '任意の選ぶ欄は、先頭が「回答しない」', J(f.firstOpt));
    ok(f.fleets === vocab.fleets.filter((x) => !x.retired).length, '機種の選択肢はサイトの語彙（pv-vocab.json）と同じ数', `${f.fleets}`);
    ok(f.noteMax === '500' && f.own === '本人が直接経験した内容です', 'ひとことは 500字まで。「本人が直接経験した内容です」の確認が在る', J({ max: f.noteMax, own: f.own }));
    ok(f.send && f.sendText === '匿名で追加する' && !f.tag && f.prev, '確認を入れるまで送れない。ボタンは「匿名で追加する」', J(f));

    await pick(a, 'position', 'cap');
    await tick(a);
    ok(!(await a.page.$eval('.pvc-root .pvc-send', (n) => n.disabled)), '確認を入れると送れるようになる');
    await send(a);
    await waitMsg(a, 'said');
    ok(/1つ以上/.test(await msg(a, 'said')) && hits(a, 'submit_work_month') === 0, '数字が1つも無いまま送ると、その場で言う（サーバへは投げない）', J(await msg(a, 'said')));

    /* ── 1項目だけ ── */
    await fill(a, 'block_hours', '62.5');
    await send(a);
    await waitView(a, 'saved');
    let sm = await summary(a);
    let rows = await workRows('jal');
    ok(sm.head.includes('保存しました') && sm.rows.block_hours.v === '62.5時間' && !sm.rows.block_hours.none, '★1項目だけで保存できる。保存した値がそのまま出る', J(sm.rows.block_hours));
    ok(NUM_KEYS.filter((k) => k !== 'block_hours').every((k) => sm.rows[k].none && sm.rows[k].v === NONE), '★入れていない5項目は「未回答」と出る（0 と出ない）', J(sm.rows));
    ok(rows.length === 1 && rows[0].block_hours === 62.5 && NUM_KEYS.filter((k) => k !== 'block_hours').every((k) => rows[0][k] === null),
      '★保存先でも、入れていない5項目は空（null）のまま ── 0 で埋めていない', J(rows));
    ok(rows.length === 1 && `${rows[0].y}-${String(rows[0].m).padStart(2, '0')}` === ym && rows[0].pos === 'cap' && rows[0].fleet === null && rows[0].note === null,
      '保存された月・職位が画面のとおり。選ばなかった機種・ひとことは空', J(rows[0]));
    const ev = await a.page.evaluate(() => window.__pvcSaved);
    ok(ev.length === 1 && ev[0].topic === 'work' && ev[0].slug === 'jal', "保存できたら 'pvc:saved'（topic・slug）がページに流れる", J(ev));
    ok(!/REAL PAY|解放|アンロック/.test(sm.text.replace(DUTY_TERM, '')), '保存後の画面は「REAL PAY が開く」と言わない');
    ok(await a.page.$('.pvc-root [data-pvc-act="edit"]') && await a.page.$('.pvc-root [data-pvc-act="more"]'), '保存後に「修正する」「別の項目を追加」が在る');

    /* ── 読み直す ── */
    await go(a, JAL);
    await api(a, 'work');
    await waitView(a, 'work');
    let v = await vals(a);
    const ph = await a.page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.pvc-root form input.pvc-input')].map((n) => [n.name, n.placeholder])));
    const meta = await a.page.evaluate(() => ({ tag: !document.querySelector('.pvc-root [data-pvc-own-row]').hidden, send: document.querySelector('.pvc-root .pvc-send').textContent }));
    ok(parseFloat(v.block_hours) === 62.5 && v.position === 'cap' && v.ym === ym, '★読み直すと、保存した1項目が戻っている', J(v));
    ok(NUM_KEYS.filter((k) => k !== 'block_hours').every((k) => v[k] === '' && ph[k] === NONE), '★残りの5項目は空欄で「未回答」と出ている（0 が入っていない）', J({ v, ph }));
    ok(meta.tag && meta.send === '匿名で更新する', '自分の投稿には「あなたの投稿」の札。ボタンは「匿名で更新する」', J(meta));

    /* ── 0 を足す ── */
    await fill(a, 'days_off', '0');
    await tick(a);
    await send(a);
    await waitView(a, 'saved');
    sm = await summary(a);
    rows = await workRows('jal');
    ok(sm.head.includes('更新しました') && sm.rows.days_off.v === '0日' && !sm.rows.days_off.none, '★0 は「0日」と出る（未回答にならない）', J(sm.rows.days_off));
    ok(rows.length === 1 && rows[0].days_off === 0 && rows[0].block_hours === 62.5 && rows[0].stay_nights === null,
      '★保存先でも 0 は 0・未回答は空のまま。同じ月は1行のまま置き換わる', J(rows));
    await a.page.click('.pvc-root [data-pvc-act="edit"]');
    await waitView(a, 'work');
    v = await vals(a);
    ok(v.days_off === '0' && parseFloat(v.block_hours) === 62.5 && v.stay_nights === '', '「修正する」で開き直すと、0 は 0・未回答は空欄で入っている', J(v));

    /* ── 月を変える ── */
    const other = await a.page.evaluate(() => document.querySelector('.pvc-root select[name="ym"]').options[3].value);
    await pick(a, 'ym', other);
    await waitView(a, 'work');
    v = await vals(a);
    const m2 = await a.page.evaluate(() => ({ tag: !document.querySelector('.pvc-root [data-pvc-own-row]').hidden, send: document.querySelector('.pvc-root .pvc-send').textContent }));
    ok(v.ym === other && NUM_KEYS.every((k) => v[k] === '') && v.position === 'cap' && !m2.tag && m2.send === '匿名で追加する',
      '投稿の無い月へ移ると数字は空・札は消える（職位は引き継ぐ）', J({ v, m2 }));
    await pick(a, 'ym', ym);
    await waitView(a, 'work');
    v = await vals(a);
    ok(v.days_off === '0' && parseFloat(v.block_hours) === 62.5, '投稿した月へ戻すと、保存した内容がまた出る', J(v));
  });

  await scene('月の勤務 ── サーバが断ったとき・送れなかったとき', async () => {
    /* ── サーバが断る ── */
    await fill(a, 'block_hours', '250');
    await tick(a);
    let n0 = hits(a, 'submit_work_month');
    await send(a);
    await waitMsg(a, 'said');
    let v = await vals(a);
    let rows = await workRows('jal');
    const m1 = await msg(a, 'said');
    const inv = await a.page.$eval('.pvc-root input[name="block_hours"]', (n) => n.getAttribute('aria-invalid'));
    ok(hits(a, 'submit_work_month') === n0 + 1 && /乗務時間/.test(m1) && /範囲/.test(m1), '★範囲の外の数字は、サーバの言った理由がそのまま出る', J(m1));
    ok(v.block_hours === '250' && v.days_off === '0' && inv === 'true', '★断られても、打った字は1文字も消えない（どの欄かも分かる）', J(v));
    ok(rows.length === 1 && rows[0].block_hours === 62.5, '断られた回は、保存先が1文字も変わっていない', J(rows));

    await fill(a, 'block_hours', '70');
    await fill(a, 'duty_hours', 'abc');
    await send(a);
    await a.page.waitForFunction(() => {
      const n = document.querySelector('.pvc-root .pvc-msg[data-pvc-msg="said"]');
      return !!n && /数字/.test(n.textContent);
    });
    v = await vals(a);
    ok(v.duty_hours === 'abc' && v.block_hours === '70', '数字に読めない字は、こちらで直さずサーバに断らせる（打った字は残る）', J({ m: await msg(a, 'said'), v }));

    await fill(a, 'duty_hours', '');
    await fill(a, 'work_days', '20');
    await fill(a, 'days_off', '20');
    await send(a);
    await a.page.waitForFunction(() => {
      const n = document.querySelector('.pvc-root .pvc-msg[data-pvc-msg="said"]');
      return !!n && /合計/.test(n.textContent);
    });
    ok(true, '欄をまたぐ断り（勤務日数＋公休日数がその月の日数を超える）も、そのまま出る');
    rows = await workRows('jal');
    ok(rows[0].block_hours === 62.5 && rows[0].days_off === 0 && rows[0].work_days === null, '断られ続けても、保存先は元のまま', J(rows));

    /* ── 送れない（サーバが落ちている） ── */
    await fill(a, 'work_days', '');
    await fill(a, 'days_off', '0');
    await failNext('submit_work_month');
    await send(a);
    await waitMsg(a, 'fail');
    const m2 = await msg(a, 'fail');
    v = await vals(a);
    rows = await workRows('jal');
    let ob = await outboxOf(a);
    ok(/送れていません/.test(m2) && /もう一度送る/.test(m2), '★サーバが落ちていたら「送れていません」と言い、「もう一度送る」を出す', J(m2));
    ok(v.block_hours === '70' && v.days_off === '0' && v.work_days === '' && v.position === 'cap', '★送れなかった回も、打った内容がそのまま残っている', J(v));
    ok(!!ob && rows[0].block_hours === 62.5, '送れなかった内容はこの端末に控えてある。保存先は変わっていない（保存したふりをしない）', J({ ob: !!ob, rows }));
    ok(!(await a.page.$('.pvc-root [data-pvc-saved]')), '送れなかった回に「保存しました」の画面を出していない');

    /* ── 読み直しても、もう一度送れる ── */
    await go(a, JAL);
    await api(a, 'list');
    await waitView(a, 'list');
    await waitMsg(a, 'unsent');
    ok(/送れていない回答/.test(await msg(a, 'unsent')), '★読み直しても「送れていない回答があります」と出る', J(await msg(a, 'unsent')));
    await a.page.click('.pvc-root [data-pvc-act="resume"]');
    await waitView(a, 'work');
    await waitMsg(a, 'fail');
    v = await vals(a);
    ok(v.block_hours === '70' && v.days_off === '0' && v.ym === ym && v.own === true, '「続きを開く」で、送れなかった内容がそのまま戻る', J(v));
    await a.page.click('.pvc-root [data-pvc-act="retry"]');
    await waitView(a, 'saved');
    rows = await workRows('jal');
    ob = await outboxOf(a);
    ok(rows.length === 1 && rows[0].block_hours === 70 && rows[0].days_off === 0, '★「もう一度送る」で保存される', J(rows));
    ok(ob === null, '送れたら、端末の控えは消える', String(ob));
    await go(a, JAL);
    await api(a, 'list');
    await waitView(a, 'counted');
    ok((await msg(a, 'unsent')) === null, '送れたあとは「送れていない回答」と言わない');

    /* ── 鍵 ── */
    const keyAfter = await payKey(A.id);
    const lsAfter = await a.page.evaluate(() => localStorage.getItem('pv_salary_unlock_expiry'));
    ok(keyAfter === keyBefore && lsAfter === lsBefore, '★勤務を何度保存しても、給与の鍵は1つも動かない（期限・件数・バッジ・給与の行数）', J({ keyBefore, keyAfter, lsBefore, lsAfter }));
  });

  // ═════════════════════════════════════════════════════════════
  // 4. 通勤・タクシー（日本航空・会員A）
  // ═════════════════════════════════════════════════════════════
  const TAXI = ['commuting_transport', 'commuting_transport_method', 'commuting_taxi_when', 'commuting_taxi_where',
    'commuting_taxi_cost', 'commuting_taxi_cap', 'commuting_bus_when', 'commuting_bus_cost'];
  const shown = (p) => p.page.evaluate(() => {
    const o = {};
    for (const n of document.querySelectorAll('.pvc-root form [data-q]')) o[n.getAttribute('data-q')] = !n.closest('[hidden]');
    const fold = document.querySelector('.pvc-root [data-q-fold]');
    o.fold = !!fold && !fold.hidden;
    o.panel = !!fold && !fold.querySelector('.pvc-fold-p').hidden;
    return o;
  });
  await scene('通勤・タクシー ── 親と子を1回で・読み直す・上書き', async () => {
    const conds = JSON.parse(read('pv-conditions.json'));
    const taxiIds = conds.questions.filter((x) => x.topic === 'taxi').map((x) => x.id);
    ok(J([...taxiIds].sort()) === J([...TAXI].sort()), '通勤・タクシーの質問は、サイトの質問表（pv-conditions.json）の8問', J(taxiIds));

    await go(a, JAL);
    await api(a, 'taxi');
    await waitView(a, 'taxi');
    let sh = await shown(a);
    const shape = await a.page.evaluate(() => {
      const f = document.querySelector('.pvc-root form[data-pvc-form="taxi"]');
      const ta = [...f.querySelectorAll('textarea')];
      return {
        title: document.querySelector('.pvc-root .pvc-title').textContent, line: f.querySelector('.pvc-ctx-line').textContent,
        text: f.querySelectorAll('input[type="text"], input:not([type])').length,
        ta: ta.map((n) => n.name), req: ta.filter((n) => n.required).length,
        /* 補足は必ず、選ぶ質問に付いている（その質問の枠の中か、同じ畳みの中。補足だけが独りで立っていない） */
        owned: ta.every((n) => {
          const q = f.querySelector('[data-q="' + n.name.replace(/_note$/, '') + '"]');
          if (!q || !q.querySelector('select, input[type="checkbox"], input[type="radio"]')) return false;
          const fold = n.closest('.pvc-fold');
          return q.contains(n) || (!!fold && fold === q.closest('.pvc-fold'));
        }),
        choice: [...f.querySelectorAll('[data-q]')].filter((n) => n.querySelector('select, input[type="checkbox"], input[type="radio"]')).map((n) => n.getAttribute('data-q')),
        capInFold: !!f.querySelector('[name="commuting_taxi_cap_note"]').closest('.pvc-fold'),
        fold: f.querySelector('.pvc-fold-b').textContent, exp: f.querySelector('.pvc-fold-b').getAttribute('aria-expanded'),
        send: f.querySelector('.pvc-send').textContent, dis: f.querySelector('.pvc-send').disabled,
        company: !!f.querySelector('[name="airline"], [name="company"]'),
      };
    });
    ok(shape.title === '通勤・タクシー' && shape.line.includes(jalName) && !shape.company, '見出しは「通勤・タクシー」。会社は上に出ていて、選ぶ欄は無い', J(shape));
    ok(sh.commuting_transport && TAXI.slice(1).every((k) => !sh[k]) && !sh.fold, '最初に出るのは親の質問だけ（子は親の答えが決まってから）', J(sh));
    /* 2026-10-07 オーナー指定：選んだ答えに、任意の補足を添えられる。
       ただし自由記述は「追加の説明」で、選ぶ質問の代わりにはしない ── 8問とも選ぶ形のまま残っていること。 */
    ok(J([...shape.choice].sort()) === J([...TAXI].sort()), '★タクシーの具体的な質問は8つとも「選ぶ質問」のまま残っている（自由記述に置き換えていない）', J(shape.choice));
    ok(shape.text === 0 && J([...shape.ta].sort()) === J(TAXI.map((k) => k + '_note').sort()) && shape.owned && shape.req === 0,
      '★自由記述は「質問ごとの補足」だけ。どれも任意で、選ぶ質問の枠の中に在る（何でも受ける独立の欄は無い）', J(shape));
    ok(shape.capInFold, '上限の補足は、今までどおり畳んだ中に在る', J(shape));
    ok(shape.fold.includes('回数・金額の上限を追加') && shape.exp === 'false' && shape.dis && shape.send === '匿名で追加する', '上限は「回数・金額の上限を追加」で畳んである。確認を入れるまで送れない', J(shape));

    await pick(a, 'commuting_transport', 'no');
    sh = await shown(a);
    ok(TAXI.slice(1).every((k) => !sh[k]), '「提供されない」を選ぶと、子の質問は出ない', J(sh));
    await pick(a, 'commuting_transport', 'conditional');
    sh = await shown(a);
    ok(sh.commuting_transport_method && !sh.commuting_taxi_when && !sh.commuting_bus_when && !sh.fold, '条件つきで提供 → 「どの形で」だけが出る', J(sh));
    await chip(a, 'commuting_transport_method', 'company_taxi');
    sh = await shown(a);
    ok(sh.commuting_taxi_when && sh.commuting_taxi_where && sh.commuting_taxi_cost && sh.fold && !sh.commuting_bus_when && !sh.commuting_bus_cost,
      'タクシーを選ぶと タクシーの いつ・どこまで・誰の負担・上限 が出る（バスは出ない）', J(sh));
    await chip(a, 'commuting_transport_method', 'crew_bus');
    sh = await shown(a);
    ok(sh.commuting_bus_when && sh.commuting_bus_cost, 'クルーバスも選ぶと、バスの質問も出る', J(sh));

    await chip(a, 'commuting_taxi_when', 'unknown');
    await chip(a, 'commuting_taxi_when', 'no_public_transport');
    await chip(a, 'commuting_taxi_when', 'standby_callout');
    let v = await vals(a);
    ok(J([...v.commuting_taxi_when].sort()) === J(['no_public_transport', 'standby_callout']), '「わからない」は、ほかの答えと一緒には残らない', J(v.commuting_taxi_when));
    await chip(a, 'commuting_bus_when', 'any_time');
    await pick(a, 'commuting_taxi_where', 'within_area');
    await pick(a, 'commuting_taxi_cost', 'company_full');
    await a.page.click('.pvc-root .pvc-fold-b');
    sh = await shown(a);
    ok(sh.panel && (await a.page.$eval('.pvc-root .pvc-fold-b', (n) => n.getAttribute('aria-expanded'))) === 'true', '「回数・金額の上限を追加」を押すと開く', J(sh));
    await pick(a, 'commuting_taxi_cap', 'per_month');
    await fill(a, 'commuting_taxi_cap_note', '月の回数に上限があります');
    /* バスの費用はわざと答えない（質問は8つ・答えは7つ ＝ 件数が質問の数にならないことを見る） */
    await tick(a);
    const n0 = hits(a, 'submit_airline_conditions');
    await a.page.evaluate(() => { window.__pvcSaved = []; });
    await send(a);
    await waitView(a, 'saved');
    let db = await condRows('jal');
    const sm = await summary(a);
    ok(hits(a, 'submit_airline_conditions') === n0 + 1, '★親と子の答えを、1回の送信でまとめて送る', `${hits(a, 'submit_airline_conditions') - n0} 回`);
    ok(Object.keys(db).length === 7 && Object.values(db).every((x) => x.length === 1) && !db.commuting_bus_cost,
      '★答えた7問がそれぞれ1行ずつ保存された（答えていない1問は入っていない）', J(Object.keys(db)));
    ok(db.commuting_transport[0].c === 'conditional' && J(db.commuting_transport_method[0].cs) === J(['company_taxi', 'crew_bus'])
      && J(db.commuting_taxi_when[0].cs) === J(['no_public_transport', 'standby_callout']) && J(db.commuting_bus_when[0].cs) === J(['any_time'])
      && db.commuting_taxi_where[0].c === 'within_area' && db.commuting_taxi_cost[0].c === 'company_full'
      && db.commuting_taxi_cap[0].c === 'per_month' && db.commuting_taxi_cap[0].t === '月の回数に上限があります',
      '保存された答えが、画面で選んだとおり（上限の補足も）', J(db));
    ok(sm.head.includes('保存しました') && Object.keys(sm.rows).filter((k) => TAXI.includes(k)).length === 7 && !!sm.rows.commuting_taxi_cap_note,
      '保存後の画面に、保存した答えが並ぶ', J(Object.keys(sm.rows)));
    const ev = await a.page.evaluate(() => window.__pvcSaved);
    ok(ev.length === 1 && ev[0].topic === 'taxi' && ev[0].slug === 'jal', "保存できたら 'pvc:saved'（topic: taxi）が流れる", J(ev));

    /* ── 読み直す ── */
    await go(a, JAL + '?add=taxi');
    await waitView(a, 'taxi');
    v = await vals(a);
    const tags = await a.page.evaluate(() => ({
      n: document.querySelectorAll('.pvc-root form [data-q] .pvc-label .pvc-mine').length,
      fold: !!document.querySelector('.pvc-root .pvc-fold-b .pvc-mine'),
      send: document.querySelector('.pvc-root .pvc-send').textContent,
    }));
    ok(v.commuting_transport === 'conditional' && J([...v.commuting_transport_method].sort()) === J(['company_taxi', 'crew_bus'])
      && J([...v.commuting_taxi_when].sort()) === J(['no_public_transport', 'standby_callout']) && v.commuting_taxi_where === 'within_area'
      && v.commuting_taxi_cost === 'company_full' && v.commuting_taxi_cap === 'per_month' && v.commuting_taxi_cap_note === '月の回数に上限があります'
      && v.commuting_bus_cost === '', '★読み直すと、保存した答えが入った状態で開く（答えていない質問は空のまま）', J(v));
    ok(tags.n === 7 && tags.fold && tags.send === '匿名で更新する', '答えた質問には「あなたの投稿」の札。ボタンは「匿名で更新する」', J(tags));

    await tick(a);
    let n1 = hits(a, 'submit_airline_conditions');
    await send(a);
    await waitMsg(a, 'same');
    ok(hits(a, 'submit_airline_conditions') === n1, '何も変えずに送ると「保存済みの内容と同じです」と言う（サーバへは投げない）', J(await msg(a, 'same')));

    /* ── 上書き ── */
    await pick(a, 'commuting_taxi_cost', 'partial');
    await send(a);
    await waitView(a, 'saved');
    db = await condRows('jal');
    ok(db.commuting_taxi_cost.length === 1 && db.commuting_taxi_cost[0].c === 'partial' && Object.keys(db).length === 7 && db.commuting_taxi_where[0].c === 'within_area',
      '★答え直すと上書きされる（行は増えない・ほかの答えはそのまま）', J(db.commuting_taxi_cost));

    /* ── 送れない（通信が切れる） ── */
    await a.page.click('.pvc-root [data-pvc-act="edit"]');
    await waitView(a, 'taxi');
    await pick(a, 'commuting_taxi_where', 'door_to_door');
    await tick(a);
    /* ★1回だけ切ると、この失敗は画面まで届かない ── 使い回していた接続が切れたとき、ブラウザは同じ要求を
         黙ってもう1回だけ送り直す（サーバの記録には「切れた・200」の2本が残り、ページからは1本にしか見えない）。
         なので、切れ続ける状態にしてから送り、「送れていません」が出たところで元へ戻す。 */
    await failNext('submit_airline_conditions', 'drop', 9);
    await send(a);
    await waitMsg(a, 'fail');
    await failOff();
    v = await vals(a);
    db = await condRows('jal');
    ok(/送れていません/.test(await msg(a, 'fail')) && v.commuting_taxi_where === 'door_to_door' && db.commuting_taxi_where[0].c === 'within_area' && !!(await outboxOf(a)),
      '★通信が切れた回は「送れていません」。選んだ答えは残り、保存先は変わらず、端末に控えが在る', J({ v: v.commuting_taxi_where, db: db.commuting_taxi_where }));
    await a.page.click('.pvc-root [data-pvc-act="retry"]');
    await waitView(a, 'saved');
    db = await condRows('jal');
    ok(db.commuting_taxi_where[0].c === 'door_to_door' && (await outboxOf(a)) === null, '「もう一度送る」で保存され、控えが消える', J(db.commuting_taxi_where));

    /* ── サーバが一部だけ断ったとき（返事を試験用に差し替えて、画面の言い方だけを見る） ── */
    await a.page.click('.pvc-root [data-pvc-act="edit"]');
    await waitView(a, 'taxi');
    await pick(a, 'commuting_taxi_where', 'to_set_point');
    await pick(a, 'commuting_taxi_cost', 'self_full');
    await tick(a);
    a.st.fake = { name: 'submit_airline_conditions', body: { ok: true, airline: 'jal', saved: 1, skipped: 0,
      rejected: [{ question_id: 'commuting_taxi_cost', reason: 'parent_missing' }], answered_total: 7, questions_total: 43 } };
    await send(a);
    await waitMsg(a, 'rej');
    const rj = await msg(a, 'rej');
    const label = conds.questions.find((x) => x.id === 'commuting_taxi_cost').ja.label;
    ok(/保存できなかった項目があります/.test(rj) && rj.includes(label) && /上の質問の答えと合わない/.test(rj) && !/parent_missing/.test(rj),
      '★一部だけ断られたら、どの質問がなぜ保存されなかったかを普通の言葉で言う（記号のまま出さない）', J(rj));
    ok(!(await a.page.$('.pvc-root [data-pvc-saved]')) && (await vals(a)).commuting_taxi_cost === 'self_full', '断られた答えは画面に残っていて、「保存しました」とは言わない');
  });

  // ═════════════════════════════════════════════════════════════
  // 5. 件数（サーバが返した本人の行数だけ）
  // ═════════════════════════════════════════════════════════════
  await scene('「あなたの投稿 N件」', async () => {
    await go(a, JAL);
    await api(a, 'list');
    await waitView(a, 'counted');
    const scr = await a.page.evaluate(() => {
      const o = {};
      for (const n of document.querySelectorAll('.pvc-root [data-pvc-count]')) o[n.getAttribute('data-pvc-count')] = n.hidden ? null : n.textContent;
      return { counts: o, state: document.querySelector('.pvc-root [data-pvc-state]').getAttribute('data-pvc-state') };
    });
    const srv = await a.page.evaluate(async () => {
      const sb = await window.PVCareer.client();
      const w = await sb.rpc('my_work_months', { p: { airline: 'jal' } });
      const c = await sb.rpc('my_airline_conditions', { p: { airline: 'jal' } });
      return { work: w.data.rows.length, ids: c.data.answers.filter((x) => !x.airline || x.airline === 'jal').map((x) => x.question_id) };
    });
    const taxiN = srv.ids.filter((id) => TAXI.includes(id)).length;
    ok(scr.state === 'ok ok' && scr.counts.work === `あなたの投稿 ${srv.work}件` && srv.work === (await workRows('jal')).length,
      '★勤務の件数 ＝ サーバが本人について返した行数', J({ scr: scr.counts.work, srv: srv.work }));
    ok(scr.counts.taxi === `あなたの投稿 ${taxiN}件` && taxiN === 7 && TAXI.length === 8,
      '★通勤・タクシーの件数 ＝ 本人の答えの数（7）。質問の数（8）ではない', J({ scr: scr.counts.taxi, taxiN }));
    ok(['staff_travel', 'upgrade', 'roster', 'career', 'benefits', 'stay'].every((k) => scr.counts[k] === null),
      '★答えていない項目には件数を出さない（質問が何問あっても）', J(scr.counts));
  });

  /* 保存の口がまだ無い（関数が貼られていない・呼ぶ権限が無い）ときは「準備中です」。
     保存したふりも、「送れていません（もう一度送る）」もしない。返事は試験用に差し替える。 */
  await scene('まだ用意されていないとき（準備中）', async () => {
    const MISSING = { code: 'PGRST202', message: 'Could not find the function in the schema cache', details: null, hint: null };
    const DENIED = { code: '42501', message: 'permission denied for function', details: null, hint: null };
    const w0 = J(await workRows('jal')), c0 = J(await condRows('jal'));

    await go(a, JAL);
    await api(a, 'work');
    await waitView(a, 'work');
    await fill(a, 'stay_nights', '6');
    await tick(a);
    a.st.fake = { name: 'submit_work_month', status: 404, body: MISSING };
    await send(a);
    await waitMsg(a, 'off');
    let m = await msg(a, 'off');
    let v = await vals(a);
    ok(/準備中/.test(m) && !/もう一度送る/.test(m), '★保存の口がまだ無いときは「準備中です」と言う（「もう一度送る」は出さない）', J(m));
    ok(v.stay_nights === '6' && !(await a.page.$('.pvc-root [data-pvc-saved]')) && (await outboxOf(a)) === null && J(await workRows('jal')) === w0,
      '★準備中の回も、打った字は残る。「保存しました」と言わず、保存先も端末の控えも変わらない', J(v));

    await go(a, JAL);
    await api(a, 'taxi');
    await waitView(a, 'taxi');
    const cur = (await vals(a)).commuting_taxi_where;
    const next = cur === 'within_area' ? 'door_to_door' : 'within_area';
    await pick(a, 'commuting_taxi_where', next);
    await tick(a);
    a.st.fake = { name: 'submit_airline_conditions', status: 403, body: DENIED };
    await send(a);
    await waitMsg(a, 'off');
    m = await msg(a, 'off');
    v = await vals(a);
    ok(/準備中/.test(m) && v.commuting_taxi_where === next && !(await a.page.$('.pvc-root [data-pvc-saved]')) && J(await condRows('jal')) === c0,
      '★通勤・タクシーも同じ（呼ぶ権限が無いとき）。選んだ答えは残り、保存先は変わらない', J({ m, v: v.commuting_taxi_where }));

    /* 読む側の口が無いとき：件数を 0 とも言わず、数も出さない */
    a.st.fake = { name: 'my_work_months', status: 404, body: MISSING };
    await go(a, JAL);
    await api(a, 'list');
    await waitView(a, 'counted');
    const scr = await a.page.evaluate(() => {
      const st = document.querySelector('.pvc-root [data-pvc-state]'), c = document.querySelector('.pvc-root [data-pvc-count="work"]');
      return { state: st.getAttribute('data-pvc-state'), text: st.hidden ? '' : st.textContent, work: c.hidden ? null : c.textContent };
    });
    ok(scr.state === 'off ok' && /準備中/.test(scr.text) && scr.work === null && !/0件|まだありません/.test(scr.text),
      '★読む側の口が無いときは、勤務の件数を出さず「準備中」と言う（0件とも「まだありません」とも言わない）', J(scr));
    a.st.fake = null;
  });

  // ═════════════════════════════════════════════════════════════
  // 6. 未ログイン（エティハド・390×680）
  // ═════════════════════════════════════════════════════════════
  const b = await open('phone');
  let eyName = '';
  await scene('未ログイン ── ログインなしで保存・同じ端末から読み直して直す・ログインで引き継ぐ', async () => {
    const keyB0 = await payKey(B.id);
    await go(b, EY + '?add=list');
    await waitView(b, 'counted');
    eyName = await nameOf(b);
    const L = await b.page.evaluate(() => {
      const r = document.querySelector('.pvc-root');
      const tiles = [...r.querySelectorAll('[data-pvc-tile]')].map((n) => ({
        k: n.getAttribute('data-pvc-tile'), tag: n.tagName, t: n.querySelector('.pvc-tile-t').textContent, d: n.querySelector('.pvc-tile-d').textContent,
        to: n.tagName === 'A' ? new URL(n.href).pathname + new URL(n.href).search : '',
      }));
      const talk = r.querySelector('.pvc-talk');
      return {
        title: r.querySelector('.pvc-title').textContent, cap: r.querySelector('.pvc-cap').textContent, lead: r.querySelector('.pvc-lead').textContent,
        talk: talk.textContent.trim(), talkTo: new URL(talk.href).pathname + new URL(talk.href).search, tiles,
        counts: [...r.querySelectorAll('[data-pvc-count]')].filter((n) => !n.hidden || n.textContent).length,
        state: r.querySelector('[data-pvc-state]').getAttribute('data-pvc-state'), stateShown: !r.querySelector('[data-pvc-state]').hidden,
        held: !r.querySelector('[data-pvc-heldslot]').hidden,
        text: r.querySelector('.pvc-main').innerText, under: r.querySelector('.pvc-under').textContent, href: location.pathname + location.search,
      };
    });
    ok(L.title === `${eyName}に情報を追加` && L.href === EY, '?add=list で項目の一覧が開く（未ログインでも）', J({ t: L.title, href: L.href }));
    ok(L.cap === 'BUILD IT TOGETHER' && L.lead === `${eyName}のこと、ひとつ教えて。` && L.talk === '匿名で話す' && L.talkTo === '/submit-review.html?airline=etihad',
      '見本どおりの入口の箱（BUILD IT TOGETHER／ひとつ教えて。／匿名で話す → 口コミの画面）', J({ cap: L.cap, lead: L.lead, talk: L.talkTo }));
    const by = Object.fromEntries(L.tiles.map((t) => [t.k, t]));
    const INSIDE = ['work', 'taxi', 'staff_travel', 'upgrade', 'roster', 'career', 'benefits'];
    ok(J(L.tiles.map((t) => t.k)) === J([...INSIDE, 'stay']),
      'タイルは 勤務・通勤/タクシー・Staff Travel・機長昇格・勤務スケジュール・訓練/キャリア・休暇/手当・ホテル/ステイ の8つ', J(L.tiles.map((t) => t.t)));
    ok(INSIDE.every((k) => by[k].tag === 'BUTTON') && by.stay.tag === 'A'
      && by.stay.to === '/career.html?airline=etihad&tab=life' && by.stay.d === 'パイロット限定',
      '★答えられる7つは全部、面の中で開く（ほかの画面へ送り出さない＝会社を選び直させない）。ホテル・ステイだけは会社を渡して行く', J(L.tiles));
    ok(L.counts === 0 && L.state === 'anon anon' && !L.stateShown && !L.held && !/\d+\s*件/.test(L.text) && !/あなたの投稿/.test(L.text),
      '★まだ何も出していない人には件数を1つも出さない（「あなたの投稿」の字も、預かりの案内も出ない）', J({ counts: L.counts, state: L.state }));
    ok(hits(b, 'my_work_months') === 0 && hits(b, 'my_airline_conditions') === 0 && hits(b, 'my_contrib_anon') === 0,
      '鍵を持たない端末は、何も読みに行かない（通信ゼロ）', J(b.st.calls));
    ok(/ひとつ/.test(L.under) && /ログインは要りません/.test(L.under), '「ひとつの項目から追加できます。ログインは要りません。」の一言が在る', L.under);
    checkSize(await measure(b), '390×680 一覧（未ログイン・エティハド）');

    /* ── 打つ → 送る → その場で保存（ログインへ行かない） ── */
    await b.page.click('.pvc-root [data-pvc-tile="work"]');
    await waitView(b, 'work');
    const hint = await b.page.$eval('.pvc-root [data-pvc-wait]', (n) => (n.hidden ? '' : n.textContent));
    ok(/ログインなしで保存できます/.test(hint) && /この端末から確認・修正できます/.test(hint), '送る前に「ログインなしで保存できます。この端末から確認・修正できます」と言う', hint);
    const ym2 = (await vals(b)).ym;
    await pick(b, 'position', 'fo');
    await fill(b, 'block_hours', '0');
    await fill(b, 'stay_nights', '3');
    await fill(b, 'note', '夏ダイヤの月');
    checkSize(await measure(b), '390×680 月の勤務（入力中）');
    const cols = await b.page.evaluate(() => {
      const f = [...document.querySelectorAll('.pvc-root form .pvc-grid > .pvc-field')].slice(0, 2).map((n) => n.getBoundingClientRect());
      return { sameRow: Math.abs(f[0].top - f[1].top) < 2, sameLeft: Math.abs(f[0].left - f[1].left) < 2 };
    });
    ok(!cols.sameRow && cols.sameLeft, '390px では入力欄が1列に並ぶ（見本の2列を1列に）', J(cols));
    ok(await b.page.$eval('.pvc-root .pvc-send', (n) => n.disabled), '「本人が直接経験した内容です」を入れるまで送れない（未ログインでも同じ）');
    await tick(b);
    await send(b);
    await waitView(b, 'saved');
    const pend = async () => (await q(`select kind, airline, item_key, payload from public.pv_contrib_pending where airline = 'etihad' order by id`)).rows;
    const keys = async () => (await q(`select key_hash from public.pv_contrib_keys`)).rows.map((r) => r.key_hash);
    const devKey = () => b.page.evaluate(() => localStorage.getItem('pv_contrib_key') || '');
    const held = async (key) => (await (await fetch(`${base}/rest/v1/rpc/my_contrib_anon`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ p: { key, airline: 'etihad' } }),
    })).json());
    let pd = await pend();
    const k1 = await devKey();
    const kh = await keys();
    ok((await snap(b)).href === EY && hits(b, 'submit_contrib_anon') === 1 && hits(b, 'submit_work_month') === 0,
      '★送ってもログインへ行かない。同じ会社ページのまま、預かりの口へ1回だけ送る', J({ href: (await snap(b)).href, calls: b.st.calls }));
    ok(pd.length === 1 && pd[0].kind === 'work' && (await workRows('etihad')).length === 0,
      '★保存先はサーバの預かり（1件）。会員の表にはまだ入らない ＝ 引き継ぐまで会社ごとの集計に入らない', J(pd.map((r) => [r.kind, r.item_key])));
    ok(k1.length >= 32 && kh.length === 1 && kh[0] !== k1 && !J(pd).includes(k1) && !kh.join().includes(k1),
      '★本人のしるしは、サーバが作った推測できない鍵。端末にだけ在り、サーバは鍵そのものを持たない', J({ len: k1.length, keys: kh.length }));
    let mine = await held(k1);
    const r0 = (mine.rows || [])[0] || {};
    ok(mine.ok && mine.known && (mine.rows || []).length === 1 && r0.block_hours === 0 && r0.stay_nights === 3 && r0.duty_hours === null && r0.days_off === null,
      '★乗務時間 0 は 0 のまま・入れていない欄は未回答のまま預かっている', J(r0));
    const sm = await summary(b);
    ok(sm.head.includes('保存しました') && sm.rows.block_hours.v === '0時間' && !sm.rows.block_hours.none && sm.rows.duty_hours.none && sm.rows.stay_nights.v === '3泊',
      '保存後の画面でも「0時間」と「未回答」が別のものとして出る', J(sm.rows));
    ok(/ログインなしで保存しました/.test(sm.text) && /この端末から確認・修正できます/.test(sm.text) && /ログインして引き継いだあと/.test(sm.text) && /90日で消えます/.test(sm.text),
      '★保存後に、どこに残り・いつ集計に入り・いつ消えるかを言う（「サーバに保存した」ことをブラウザ内の保存と混ぜない）', sm.text.replace(/\s+/g, ' ').slice(0, 200));
    ok(await b.page.$('.pvc-root [data-pvc-act="claim"]') && await b.page.$('.pvc-root [data-pvc-act="edit"]') && await b.page.$('.pvc-root [data-pvc-act="more"]'),
      '保存後に「ログインして引き継ぐ」「修正する」「別の項目を追加」が在る');
    checkSize(await measure(b), '390×680 月の勤務（保存後）');
    const geo = await measure(b);
    ok(Math.abs(geo.sheet.w - geo.vw) < 1 && Math.abs(geo.sheet.y + geo.sheet.h - geo.vh) < 1 && geo.sheet.h >= geo.vh * 0.9 && geo.sheet.h < geo.vh,
      '390px では下から上がってくる面（幅いっぱい・高さはほぼ全面）', J(geo.sheet));

    /* ── 読み直す（同じ端末） → 直す ── */
    await go(b, EY + '?add=work');
    await waitView(b, 'work');
    await b.page.waitForFunction(() => { const n = document.querySelector('.pvc-root [name="stay_nights"]'); return !!n && n.value === '3'; });
    let v = await vals(b);
    ok(v.block_hours === '0' && v.stay_nights === '3' && v.position === 'fo' && v.ym === ym2 && v.note === '夏ダイヤの月' && v.duty_hours === '',
      '★読み直すと、預けた内容がサーバから戻っている（0 は 0・空欄は空欄・ひとことも）', J(v));
    ok(hits(b, 'my_contrib_anon') >= 1 && hits(b, 'my_work_months') === 0 && hits(b, 'my_airline_conditions') === 0,
      '読み直しは預かりの口から（会員の口は呼ばない）', J(b.st.calls));
    await fill(b, 'stay_nights', '4');
    await tick(b);
    await send(b);
    await waitView(b, 'saved');
    pd = await pend();
    mine = await held(k1);
    ok(pd.length === 1 && (mine.rows || []).length === 1 && mine.rows[0].stay_nights === 4 && mine.rows[0].block_hours === 0 && (await devKey()) === k1 && (await keys()).length === 1,
      '★本人が直せる（同じ1件が置き換わる。行も鍵も増えない）', J(mine.rows));

    /* ── 通信が切れた回 → もう一度送る ── */
    await b.page.click('.pvc-root [data-pvc-act="edit"]');
    await waitView(b, 'work');
    await fill(b, 'work_days', '18');
    await tick(b);
    await failNext('submit_contrib_anon', 'drop', 9);
    await send(b);
    await waitMsg(b, 'fail');
    await failOff();
    v = await vals(b);
    mine = await held(k1);
    ok(/送れていません/.test(await msg(b, 'fail')) && v.work_days === '18' && mine.rows[0].work_days === null && !!(await outboxOf(b)),
      '★送れなかった回は「送れていません」。入れた字は残り、預かりは変わらず、端末に控えが在る', J({ v: v.work_days, held: mine.rows[0].work_days }));
    await b.page.click('.pvc-root [data-pvc-act="retry"]');
    await waitView(b, 'saved');
    mine = await held(k1);
    ok(mine.rows[0].work_days === 18 && mine.rows[0].stay_nights === 4 && (await outboxOf(b)) === null, '「もう一度送る」で保存され、控えが消える', J(mine.rows[0]));

    /* ── ほかの端末・ほかの人には見えない ── */
    const o = await open('phone');
    await go(o, EY + '?add=list');
    await waitView(o, 'counted');
    const oc = await o.page.evaluate(() => ({
      counts: [...document.querySelectorAll('.pvc-root [data-pvc-count]')].filter((n) => !n.hidden).length,
      held: !document.querySelector('.pvc-root [data-pvc-heldslot]').hidden, key: localStorage.getItem('pv_contrib_key'),
    }));
    await o.page.click('.pvc-root [data-pvc-tile="work"]');
    await waitView(o, 'work');
    const ov = await vals(o);
    ok(oc.counts === 0 && !oc.held && oc.key === null && ov.block_hours === '' && ov.stay_nights === '' && ov.note === '' && hits(o, 'my_contrib_anon') === 0,
      '★鍵を持たないほかの端末には、件数も中身も出ない（読みにも行かない）', J({ oc, ov: [ov.block_hours, ov.stay_nights, ov.note] }));
    await o.st.ctx.close();
    const guess = await held('x'.repeat(k1.length));
    const noKey = await held('');
    const asMember = await (await fetch(`${base}/rest/v1/rpc/my_work_months`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${(await (await fetch(`${base}/__local/login?member=c`)).json()).session.access_token}` },
      body: JSON.stringify({ p: { airline: 'etihad' } }),
    })).json();
    ok(!(guess.rows || []).length && !(guess.answers || []).length && !(noKey.rows || []).length && !((asMember && asMember.rows) || []).length,
      '★当て推量の鍵・鍵なし・ログインしただけの別の会員 ── どれにも預かりの中身は返らない', J({ guess, noKey }).slice(0, 200));

    /* ── ログインして引き継ぐ ── */
    await go(b, EY + '?add=list');
    await waitView(b, 'counted');
    await b.page.waitForFunction(() => { const n = document.querySelector('.pvc-root [data-pvc-count="work"]'); return !!n && !n.hidden; });
    const before = await b.page.evaluate(() => ({
      work: document.querySelector('.pvc-root [data-pvc-count="work"]').textContent,
      held: !document.querySelector('.pvc-root [data-pvc-heldslot]').hidden,
      text: document.querySelector('.pvc-root [data-pvc-heldslot]').innerText.replace(/\s+/g, ' '),
    }));
    ok(before.work === 'あなたの投稿 1件' && before.held && /ログインなしで保存した回答があります/.test(before.text) && /引き継がれ/.test(before.text),
      '読み直した一覧に「あなたの投稿 1件」と、ログインなしで保存した旨・引き継ぎの案内が出る', J(before));
    await b.page.click('.pvc-root [data-pvc-act="claim"]');
    await b.page.waitForFunction(() => location.pathname === '/login.html');
    const ret = await b.page.evaluate(() => new URLSearchParams(location.search).get('return'));
    ok(ret === EY + '?add=list' && (await workRows('etihad')).length === 0 && (await pend()).length === 1 && (await devKey()) === k1,
      '「ログインして引き継ぐ」でログインへ（戻り先は同じ会社ページ）。この時点では何も動かしていない', J(ret));
    await b.page.waitForSelector('#email');
    await b.page.type('#email', B.email);
    await b.page.type('#password', 'local-pass-1');
    await b.page.click('#login-btn');
    await b.page.waitForFunction((p) => location.pathname === p && !!window.PVContrib, { timeout: 30000 }, EY);
    await b.page.waitForFunction(() => (window.__pvcSaved || []).some((x) => x && x.topic === 'claim'), { timeout: 20000 });
    await waitView(b, 'counted');
    await b.page.waitForFunction(() => { const n = document.querySelector('.pvc-root [data-pvc-count="work"]'); return !!n && !n.hidden; });
    const rows = await workRows('etihad');
    const after = await b.page.evaluate(() => ({
      work: document.querySelector('.pvc-root [data-pvc-count="work"]').textContent,
      held: !document.querySelector('.pvc-root [data-pvc-heldslot]').hidden,
      note: (document.querySelector('.pvc-root .pvc-msg[data-pvc-msg="claim"]') || {}).innerText || '',
      key: localStorage.getItem('pv_contrib_key'), board: !!document.querySelector('.pvgf-back'),
    }));
    ok(hits(b, 'claim_contrib') >= 1 && rows.length === 1 && rows[0].block_hours === 0 && rows[0].stay_nights === 4 && rows[0].work_days === 18
      && rows[0].duty_hours === null && rows[0].pos === 'fo' && rows[0].note === '夏ダイヤの月',
      '★ログインすると、預けた回答が本人の投稿として引き継がれる（0 は 0・未回答は未回答・ひとこともそのまま）', J(rows));
    ok((await pend()).length === 0 && (await keys()).length === 0 && after.key === null,
      '★引き継いだあと、預かりにも鍵にも何も残らない（端末の鍵も捨てる）', J({ pend: (await pend()).length, key: after.key }));
    ok(after.work === 'あなたの投稿 1件' && !after.held && /引き継ぎました/.test(after.note),
      '引き継いだ一覧は会員としての投稿から数え、「ログイン前の回答を引き継ぎました」と知らせる（預かりの案内は消える）', J(after));
    ok(!after.board, '登録だけの会員でも、入力の面を開いている間は Give → Get の板が覆わない');
    const keyB1 = await payKey(B.id);
    ok(keyB1 === keyB0 && /"access_until":null/.test(keyB1),
      '★預けても・引き継いでも、給与の鍵は1つも動かない（期限・件数・バッジ・確認済みの印・給与の行数）', J({ keyB0, keyB1 }));
    ok((await workRows('jal')).length === 1, 'ほかの会社・ほかの会員の行は1つも増えていない');
  });

  // ═════════════════════════════════════════════════════════════
  // 6-b. 話題ごとの質問と、会社ページの質問の名前からの入口（日本航空・会員A）
  // ═════════════════════════════════════════════════════════════
  await scene('話題の分け方 ── 会社ページの入口と同じ・質問の名前から直接開く', async () => {
    const { askGroup } = await import('./gen-career.mjs');
    const conds = JSON.parse(read('pv-conditions.json'));
    const GROUPS6 = ['taxi', 'staff_travel', 'upgrade', 'roster', 'career', 'benefits'];
    const want = Object.fromEntries(GROUPS6.map((g) => [g, conds.questions.filter((x) => askGroup(x.id) === g).map((x) => x.id).sort()]));
    const all = conds.questions.filter((x) => !x.retired).map((x) => x.id);
    ok(all.length >= 40 && all.every((id) => GROUPS6.includes(askGroup(id))), `質問表の ${all.length} 問は、どれも6つの話題のどれかに入る（面で答えられない質問が無い）`,
      J(all.filter((id) => !GROUPS6.includes(askGroup(id)))));
    await go(a, JAL);
    const got = {};
    for (const g of GROUPS6) {
      await api(a, g);
      await waitView(a, g);
      got[g] = await a.page.evaluate(() => [...new Set([...document.querySelectorAll('.pvc-root form [data-q]')].map((n) => n.getAttribute('data-q')))].sort());
      await a.page.evaluate(() => window.PVContrib.close());
      await waitClosed(a);
    }
    const diff = GROUPS6.filter((g) => J(got[g]) !== J(want[g]));
    ok(diff.length === 0, '★6つの話題に出る質問が、会社ページの入口の決め方（askGroup）と1問も違わない', J(diff.map((g) => ({ g, got: got[g], want: want[g] }))));
    ok(['commuting_taxi_cap', 'upgrade_order', 'upgrade_min_hours', 'upgrade_min_tenure'].every((id) => Object.values(got).some((l) => l.includes(id))),
      '★これまで答える場所が無かった4問（タクシー代の上限・昇格の3問）も、面の中に在る', J(got.upgrade));

    /* 会社ページの質問の名前 ── 押すとこの面が、その質問を開いた状態で出る（質問の画面へ行かない） */
    const QID = 'upgrade_order';
    const link = await a.page.evaluate((qid) => {
      const n = document.querySelector('.pvg a[data-pvc-q="' + qid + '"]');
      if (!n) return null;
      const o = { href: n.getAttribute('href'), open: n.getAttribute('data-pvc-open') };
      n.click();
      return o;
    }, QID);
    ok(!!link && link.open === askGroup(QID) && link.href === `../airline-conditions.html?airline=jal&q=${QID}`,
      '会社ページの質問の名前は、面を開く入口になっている（部品が読めない時の行き先も同じ会社・同じ質問）', J(link));
    await waitView(a, askGroup(QID));
    const at = await a.page.evaluate((qid) => {
      const ta = document.querySelector('#pvc-n-' + qid), bt = document.querySelector('.pvc-root [data-q-more="' + qid + '"]');
      const box = document.querySelector('.pvc-root form [data-q="' + qid + '"]'), mn = document.querySelector('.pvc-root .pvc-main').getBoundingClientRect();
      const r = box ? box.getBoundingClientRect() : null;
      return {
        href: location.pathname, noteOpen: !!ta && ta.getClientRects().length > 0, moreHidden: !!bt && bt.hidden,
        seen: !!r && r.top < mn.bottom && r.bottom > mn.top, prev: !document.querySelector('.pvc-root .pvc-prev').hidden,
      };
    }, QID);
    ok(at.href === JAL && at.seen && at.noteOpen && at.moreHidden,
      '★押してもページを離れない。その質問が見えていて、補足の欄はもう開いている', J(at));
    await a.page.evaluate(() => window.PVContrib.close());
    await waitClosed(a);
  });

  // ═════════════════════════════════════════════════════════════
  // 7. 3つの大きさ（日本航空・会員A ── 答えが入った状態）
  // ═════════════════════════════════════════════════════════════
  for (const sizeKey of ['phone', 'tablet', 'desk']) {
    const size = SIZES[sizeKey], tag = `${size.w}×${size.h}`;
    await scene(`大きさ ${tag}`, async () => {
      const p = sizeKey === 'desk' ? a : await open(sizeKey, { who: 'a' });
      await go(p, JAL);
      await api(p, 'list');
      await waitView(p, 'counted');
      let m = await measure(p);
      checkSize(m, `${tag} 一覧`);
      if (size.w >= 768) {
        ok(Math.abs(m.sheet.w - 560) < 1 && Math.abs(m.sheet.x + m.sheet.w - m.vw) < 1 && m.sheet.y < 1 && Math.abs(m.sheet.h - m.vh) < 1,
          `${tag}：右から出る面（幅 560px・高さいっぱい）`, J(m.sheet));
      } else {
        ok(Math.abs(m.sheet.w - m.vw) < 1 && Math.abs(m.sheet.y + m.sheet.h - m.vh) < 1 && m.sheet.h >= m.vh * 0.9 && m.sheet.h < m.vh,
          `${tag}：下から出る面（幅いっぱい・高さはほぼ全面）`, J(m.sheet));
      }
      const dim = await p.page.evaluate(() => {
        const s = document.querySelector('.pvc-root .pvc-scrim'), r = s.getBoundingClientRect(), cs = getComputedStyle(s);
        return { cover: r.left <= 0 && r.top <= 0 && r.right >= document.documentElement.clientWidth && r.bottom >= window.innerHeight, bg: cs.backgroundColor, op: cs.opacity };
      });
      ok(dim.cover && !/^rgba?\(0, 0, 0, 0\)$|transparent/.test(dim.bg), `${tag}：下のページが暗くなる`, J(dim));
      const tiles = await p.page.evaluate(() => {
        const t = [...document.querySelectorAll('.pvc-root .pvc-tiles > li')].slice(0, 2).map((n) => n.getBoundingClientRect());
        return Math.abs(t[0].top - t[1].top) < 2;
      });
      ok(tiles === (size.w >= 768), `${tag}：タイルは${size.w >= 768 ? '2列' : '1列'}`);
      /* 見本では「匿名で話す」が見出しの右。社名が長いと見出しが折れるので、折れるのは塊のあいだだけにしてある */
      const head = await p.page.evaluate(() => {
        const h = document.querySelector('.pvc-root .pvc-lead');
        const parts = [...h.querySelectorAll('.pvc-lead-p')];
        const lead = h.getBoundingClientRect();
        const talk = document.querySelector('.pvc-root .pvc-talk').getBoundingClientRect();
        const lh = parseFloat(getComputedStyle(h).lineHeight);
        return {
          parts: parts.map((n) => n.textContent),
          oneLine: parts.map((n) => n.getBoundingClientRect().height <= lh * 1.5),
          right: talk.left >= lead.right - 1 && talk.top < lead.bottom && talk.bottom > lead.top,
        };
      });
      ok(head.parts.length === 2 && head.parts[1] === 'ひとつ教えて。' && head.oneLine.every(Boolean),
        `${tag}：見出しは「…のこと、」と「ひとつ教えて。」のあいだでしか折れない（語の途中で切れない）`, J(head));
      if (size.w >= 768) ok(head.right, `${tag}：「匿名で話す」は見出しの右に並ぶ（見本どおり）`, J(head));

      await p.page.click('.pvc-root [data-pvc-tile="work"]');
      await waitView(p, 'work');
      checkSize(await measure(p), `${tag} 月の勤務`);
      const cols = await p.page.evaluate(() => {
        const f = [...document.querySelectorAll('.pvc-root form .pvc-grid > .pvc-field')].slice(0, 2).map((n) => n.getBoundingClientRect());
        return Math.abs(f[0].top - f[1].top) < 2;
      });
      ok(cols === (size.w >= 768), `${tag}：入力欄は${size.w >= 768 ? '2列' : '1列'}`);
      /* 断りが出た状態（数字を全部消して送る） */
      for (const k of NUM_KEYS) await fill(p, k, '');
      await tick(p);
      await send(p);
      await waitMsg(p, 'said');
      checkSize(await measure(p), `${tag} 月の勤務（断りが出た状態）`);
      /* 断りの文は2か所に出る ── 送るボタンの上の箱と、指された欄のすぐ下（同じ文）。
         面は指された欄へ動くので、長い画面では下の箱は画面の外に残る。見るのは
         「同じ文が、どちらかで丸ごと画面の中に在るか」と「指された欄そのものが見えているか」。 */
      const seen = await p.page.evaluate(() => {
        const mn = document.querySelector('.pvc-root .pvc-main').getBoundingClientRect();
        const top = Math.max(mn.top, 0), bottom = Math.min(mn.bottom, window.innerHeight);
        const whole = (n) => { const r = n.getBoundingClientRect(); return r.height > 0 && r.top >= top - 1 && r.bottom <= bottom + 1; };
        const box = document.querySelector('.pvc-root .pvc-msg[data-pvc-msg="said"]');
        const said = box ? box.innerText.replace(/\s+/g, '') : '';
        const errs = [...document.querySelectorAll('.pvc-root .pvc-err')].filter((n) => !n.hidden && n.textContent.trim());
        const bad = document.querySelector('.pvc-root [aria-invalid="true"]');
        return {
          box: !!box && whole(box),
          inline: errs.some((n) => whole(n) && said.includes(n.textContent.replace(/\s+/g, ''))),
          field: !!bad && whole(bad), focus: !!bad && document.activeElement === bad, n: errs.length,
        };
      });
      ok((seen.box || seen.inline) && seen.field && seen.focus, `${tag}：断りの文が、送ったあと画面の中に見えている（指された欄と、その下の同じ文）`, J(seen));

      await p.page.click('.pvc-root .pvc-prev');
      await waitView(p, 'list');
      await p.page.click('.pvc-root [data-pvc-tile="taxi"]');
      await waitView(p, 'taxi');
      await p.page.click('.pvc-root .pvc-fold-b');
      await p.page.waitForFunction(() => !document.querySelector('.pvc-root .pvc-fold-p').hidden);
      checkSize(await measure(p), `${tag} 通勤・タクシー（上限を開いた状態）`);
      if (p !== a) await p.st.ctx.close();
    });
  }

  await scene('暗い表示', async () => {
    const light = await a.page.evaluate(() => getComputedStyle(document.querySelector('.pvc-root .pvc-sheet')).backgroundColor);
    const d = await open('phone', { who: 'a', theme: 'dark' });
    await go(d, JAL);
    await api(d, 'work');
    await waitView(d, 'work');
    const dk = await d.page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'), cls: document.querySelector('.pvc-root').classList.contains('is-dark'),
      bg: getComputedStyle(document.querySelector('.pvc-root .pvc-sheet')).backgroundColor,
      ink: getComputedStyle(document.querySelector('.pvc-root .pvc-title')).color,
      field: getComputedStyle(document.querySelector('.pvc-root .pvc-input')).backgroundColor,
    }));
    ok(dk.theme === 'dark' && dk.cls && dk.bg !== light && dk.ink !== dk.bg && dk.field !== 'rgb(255, 255, 255)',
      'ページが暗い表示のときは、面も暗い表示になる（白い板が残らない）', J({ light, dk }));
    await d.st.ctx.close();
  });

  console.log('\n════ 通信 ════');
  ok(supa.size === 0, '★本番（*.supabase.co）へ1本も投げていない', J([...supa].slice(0, 5)));
  ok(blocked.size === 0, '手元と書体・部品の配信元のほかへ、1本も投げていない', J([...blocked].slice(0, 5)));
  ok(pageErrs.length === 0, 'ページの中でエラーが1件も出ていない', J([...new Set(pageErrs)].slice(0, 4)));
}

try {
  await main();
} catch (e) {
  ok(false, '検査が最後まで走った', String(e && e.stack || e).split('\n').slice(0, 3).join(' / '));
} finally {
  try { if (browser) await browser.close(); } catch (e) { /* もう閉じている */ }
  try { if (local) await local.close(); } catch (e) { /* もう止まっている */ }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* 消せなくても次の回には関係ない */ }
}
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
