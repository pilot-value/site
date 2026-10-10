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
  small:  { w: 320,  h: 568, touch: true },   // いちばん狭い画面（保存後のカードだけ、ここでも測る）
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
  /* 上の行が見ているのは transition だけ。保存できた合図の紙片は @keyframes で動くので、その中も同じ決まりで見る
     （left や top を動かすと、面の組み直しが毎コマ走る）。 */
  const frames = [...css.matchAll(/@keyframes\s+[\w-]+\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)]
    .flatMap((m) => [...m[1].matchAll(/([\w-]+)\s*:/g)].map((x) => x[1]));
  ok(frames.length > 0 && frames.every((p) => ['transform', 'opacity'].includes(p)), '@keyframes の中で動かすのも transform と opacity だけ', J([...new Set(frames)]));
  /* 動きを減らす設定の人には、紙片の層そのものを出さない（JS が足さないのが1枚目・ここが2枚目の網） */
  const calmCss = (css.match(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{((?:[^{}]*\{[^{}]*\})*)/) || [])[1] || '';
  ok(/\.pvc-root \.pvc-pop\s*\{\s*display\s*:\s*none\s*\}/.test(calmCss), '動きを減らす設定のときは、保存できた合図の紙片を出さない（CSS 側の網）', calmCss.replace(/\s+/g, ' ').slice(-120));
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

  /* 保存できた合図（cue）を出すのは、保存後の画面を出した直後の2か所だけ。
     保存後の画面を組む所（savedShell）や 'pvc:saved' の合図に掛けると、描き直し・一部だけ保存できた回・
     ログイン後の引き継ぎでも鳴る ＝「保存できた時に1度だけ」が崩れる。名前を渡すだけの形（, cue)）も数える。 */
  const cueUse = (code.match(/(?<![\w-])cue\b/g) || []).length;
  const savedShows = (code.match(/show\((?:'work-saved'|topic \+ '-saved')\);/g) || []).length;
  const savedCued = (code.match(/show\((?:'work-saved'|topic \+ '-saved')\);\s*cue\(\);/g) || []).length;
  ok(cueUse === 3 && savedShows === 2 && savedCued === 2,
    '保存できた合図を出すのは、保存後の画面を出した直後の2か所だけ（ほかのどこからも呼んでいない）', J({ cue: cueUse, shows: savedShows, cued: savedCued }));
  ok(!/['"](?:修正する|別の項目を追加)['"]/.test(code), '保存後のボタンに、前の言い方（「修正する」「別の項目を追加」）が残っていない');
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

  /* 保存できた合図の紙片の層が片づくまでの時間の幅（ミリ秒）。設計は 動き0.9秒・片づけ1.4秒。
     使い方と、遅いほうを長さで決めない理由は、下の popGone に書いてある。 */
  const POP_MIN = 900, POP_MAX = 2500;

  /* 1枚開く。who を渡すと手元の会員として入った状態で始める。
     calm は「動きを減らす」設定の人として開く（保存できた合図が静かな形になるかを見る）。 */
  async function open(sizeKey, { who = null, theme = null, calm = false } = {}) {
    const size = SIZES[sizeKey];
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    const st = { calls: [], fake: null, ctx };
    page.setDefaultTimeout(20000);
    await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: 1, isMobile: size.touch, hasTouch: size.touch });
    if (calm) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setRequestInterception(true);
    page.on('request', (req) => gate(req, st));
    page.on('pageerror', (e) => pageErrs.push(String(e.message).slice(0, 160)));
    let seed = null;
    if (who) {
      seed = await (await fetch(`${base}/__local/login?member=${who}`)).json();
      if (!seed || !seed.session) throw new Error(`手元の会員 ${who} で入れない`);
    }
    await page.evaluateOnNewDocument((origin, s, th, popMax) => {
      if (location.origin !== origin) return;
      try {
        /* 保存できたときの合図を控える */
        window.__pvcSaved = [];
        document.addEventListener('pvc:saved', (e) => window.__pvcSaved.push(e.detail));
        /* 保存できた合図（紙片・静かな完了）が「いつ・何回」出たかを控える。
           紙片は1.4秒で片づくので、あとから画面を見ても数えられない ＝ 出た瞬間に書き留める。
           'pop'／'quiet' ＝ 保存後のカードに印が付いた・'pop:10' ＝ 紙片10枚の層が足された・
           'ins:…' ＝ 印の付いたカードが丸ごと描き直された（＝ 保存していないのに合図が戻った）。 */
        window.__pvcCue = [];
        /* 紙片の層が「足されてから、層だけが外されるまで」の時間（ミリ秒）。ページの中の時計で測る
           ＝ 検査の側の待ち時間が混ざらない。カードごと描き直されて消えた回は数えない（自分で片づいた回だけ）。 */
        window.__pvcPopMs = [];
        /* 「設計から大きく遅れた」は、測った長さでは決めない ── 機械が混んでページが止まると、正しい製品の1.4秒の時計も
           遅れて鳴り、長さだけ見ると製品は正しいのに赤くなる。層が足された時に、同じページの中で popMax の時計を1本かけ、
           それが鳴った時に層がまだ在ったかを控える。同じページの時計は、先に掛けた短いほうが必ず先に鳴る
           ＝ ページが何秒止まっても、製品が正しければ false。片づけがそれより長く掛けてあった回・片づけない回だけが true。
           （この setTimeout は検査が待つための時計ではない。検査は下の popGone で「層が消えた」ことを待つ。） */
        window.__pvcPopLate = [];
        let popAt = 0;
        new MutationObserver((list) => {
          /* カードを置くのと印を付けるのは同じ一息の中 ＝ 知らせが届く頃には、置かれたカードにもう印が付いている。
             その回に印が付いたカードは「描き直し」に数えない（数えると、正しい保存がぜんぶ二重に見える）。 */
          const marked = new Set(list.filter((m) => m.type === 'attributes').map((m) => m.target));
          for (const m of list) {
            if (m.type === 'attributes') { window.__pvcCue.push(m.target.getAttribute('data-pvc-cue')); continue; }
            for (const n of m.addedNodes) {
              if (n.nodeType !== 1) continue;
              if (n.classList.contains('pvc-pop')) {
                window.__pvcCue.push('pop:' + n.children.length); popAt = performance.now();
                const layer = n, at = window.__pvcPopLate.push(null) - 1;
                setTimeout(() => { window.__pvcPopLate[at] = layer.isConnected; }, popMax);
              }
              else if (n.hasAttribute('data-pvc-cue') && !marked.has(n)) window.__pvcCue.push('ins:' + n.getAttribute('data-pvc-cue'));
            }
            for (const n of m.removedNodes) {
              if (n.nodeType === 1 && n.classList.contains('pvc-pop')) window.__pvcPopMs.push(Math.round(performance.now() - popAt));
            }
          }
        }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-pvc-cue'] });
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
    }, base, seed, theme, POP_MAX);
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
  /* 保存できた合図の控え（open が仕掛けたもの）と、いま画面に残っている合図 */
  const cueLog = (p) => p.page.evaluate(() => window.__pvcCue.slice());
  const cueNow = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root');
    const c = r && r.querySelector('[data-pvc-cue]');
    return { mark: c ? c.getAttribute('data-pvc-cue') : null, pop: !!(r && r.querySelector('.pvc-pop')) };
  });
  const POP = ['pop', 'pop:10'];                         // 保存1回ぶんの合図（印が付く → 紙片10枚の層が足される）
  /* 紙片が片づくのを待つ（片づかなくても先へ進み、そこで赤くする ＝ 場面ごと止めない）。
     返すのは ms ＝ 層が足されてから自分で片づくまでの時間（ミリ秒）と、late ＝ ページの中の POP_MAX の時計が
     鳴った時に層がまだ在ったか（どちらも open が仕掛けた、ページの中の時計。検査の側の待ち時間は混ざらない）。
     設計は 動き0.9秒・片づけ1.4秒。「いつか消えればよい」にしない ── 散り終わる前（POP_MIN）に消えても、
     設計から大きく遅れても（POP_MAX）赤くする。前は8秒まで待っていた ＝ 片づけが数倍遅くなっても通っていた。
     ⚠️ 遅いほうを ms の長さで決めない（ms <= POP_MAX と書かない）。機械が混んでページが1秒あまり止まると、
     製品は正しいのに赤くなる。早いほうは長さで決めてよい ── 混んでも、時計が早く鳴ることは無い。
     待つのは「層が消えた」か「POP_MAX の時計が、層が残っていると言った」のどちらか先まで（下の 20秒 は、
     ページごと止まった時に場面を終わらせるための上限で、合否には使わない）。 */
  const popGone = async (p) => {
    await p.page.waitForFunction(() => !document.querySelector('.pvc-root .pvc-pop') || window.__pvcPopLate[window.__pvcPopLate.length - 1] === true, { timeout: 20000 }).catch(() => null);
    return p.page.evaluate(() => {
      const ms = window.__pvcPopMs, late = window.__pvcPopLate;
      return { ms: ms.length ? ms[ms.length - 1] : null, late: late.length ? late[late.length - 1] === true : null };
    });
  };
  /* 紙片がいちばん遠くまで散ったときの位置を測る支度（送る直前に仕掛ける。結果は farOf で読む）。
     紙片は出た瞬間はまだ出発点に重なっていて、0.9秒かけて散る ＝ あとから測ると、もう動いているか消えている。
     なので層が足された瞬間に、1枚ずつ動きを終点まで送って位置を控え、すぐ元の時刻へ戻して続きを走らせる
     （見る側の支度だけ。製品の動きは変えていない）。
     card・sheet … カードの外・面の外へ出た紙片。
     over … 散り終わりの位置で、見出しの字・チェックの印・2つのボタンのどれかに重なった紙片
            （カードの中に収まっていても、字やボタンの上に止まるなら「収まっている」とは言えない）。 */
  const farWatch = (p) => p.page.evaluate(() => {
    window.__pvcFar = null;
    const mo = new MutationObserver(() => {
      const pop = document.querySelector('.pvc-root .pvc-saved .pvc-pop');
      if (!pop) return;
      mo.disconnect();
      const cardEl = pop.parentNode, card = cardEl.getBoundingClientRect(), sheet = document.querySelector('.pvc-root .pvc-sheet').getBoundingClientRect();
      const lay = pop.getBoundingClientRect(), cs = getComputedStyle(pop);
      const out = { n: pop.children.length, still: 0, card: [], sheet: [], over: [], parts: 0, clip: cs.overflowX + ' ' + cs.overflowY, touch: cs.pointerEvents,
        fill: Math.abs(lay.left - card.left) < 1.5 && Math.abs(lay.right - card.right) < 1.5 && Math.abs(lay.top - card.top) < 1.5 && Math.abs(lay.bottom - card.bottom) < 1.5,
        hidden: pop.getAttribute('aria-hidden') };
      /* 見出しの字は、字そのものの範囲で測る（見出しの箱はカードの幅いっぱいなので、箱で測ると右の余白まで「字」になる） */
      const head = cardEl.querySelector('.pvc-saved-h'), words = document.createRange();
      if (head && head.lastChild) words.selectNodeContents(head.lastChild);
      const parts = [
        ['見出しの字', head && head.lastChild ? words.getBoundingClientRect() : null],
        ['チェックの印', head && head.querySelector('svg') ? head.querySelector('svg').getBoundingClientRect() : null],
        ['「自分の回答を見る」', cardEl.querySelector('[data-pvc-act="edit"]') ? cardEl.querySelector('[data-pvc-act="edit"]').getBoundingClientRect() : null],
        ['「もう1項目を答える」', cardEl.querySelector('[data-pvc-act="more"]') ? cardEl.querySelector('[data-pvc-act="more"]').getBoundingClientRect() : null],
      ].filter((x) => x[1] && x[1].width > 0 && x[1].height > 0);
      out.parts = parts.length;
      [...pop.children].forEach((n, i) => {
        const an = n.getAnimations()[0];
        if (!an) { out.still++; return; }
        const t0 = an.currentTime;
        an.pause(); an.currentTime = an.effect.getComputedTiming().endTime;
        const r = n.getBoundingClientRect();
        an.currentTime = t0; an.play();
        const at = `${i + 1}枚目 ${Math.round(r.left - card.left)}〜${Math.round(r.right - card.left)} × ${Math.round(r.top - card.top)}〜${Math.round(r.bottom - card.top)}`;
        if (r.left < card.left - 0.5 || r.right > card.right + 0.5 || r.top < card.top - 0.5 || r.bottom > card.bottom + 0.5) out.card.push(at);
        if (r.left < sheet.left - 0.5 || r.right > sheet.right + 0.5) out.sheet.push(at);
        for (const [name, b] of parts) {
          if (r.left < b.right - 0.5 && r.right > b.left + 0.5 && r.top < b.bottom - 0.5 && r.bottom > b.top + 0.5) out.over.push(`${at} が ${name} の上`);
        }
      });
      out.w = Math.round(card.width); out.h = Math.round(card.height);
      window.__pvcFar = out;
    });
    mo.observe(document.querySelector('.pvc-root .pvc-main'), { childList: true, subtree: true });
  });
  const farOf = (p) => p.page.evaluate(() => window.__pvcFar);
  /* 保存後のカードの2つのボタンが、スクロールしない最初の1画面のどこに在るか */
  const reachOf = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root'), main = r.querySelector('.pvc-main');
    const fold = Math.min(main.getBoundingClientRect().bottom, window.innerHeight);
    const box = (sel) => { const n = r.querySelector(sel); if (!n) return null; const x = n.getBoundingClientRect(); return { top: Math.round(x.top), bottom: Math.round(x.bottom), h: Math.round(x.height) }; };
    return { scroll: main.scrollTop, top: Math.round(main.getBoundingClientRect().top), fold: Math.round(fold),
      edit: box('.pvc-saved [data-pvc-act="edit"]'), more: box('.pvc-saved [data-pvc-act="more"]'), sum: box('.pvc-saved .pvc-sum'),
      held: box('.pvc-saved [data-pvc-held]'), rows: r.querySelectorAll('.pvc-saved .pvc-sum .pvc-sum-r').length };
  });
  const reached = (x) => x.scroll === 0 && !!x.edit && !!x.more && [x.edit, x.more].every((b) => b.top >= x.top && b.bottom <= x.fold && b.h >= 44);
  /* いま焦点が在る所（保存後は見出し。そこから Tab 1回でボタンへ行けるか、を見るのに使う） */
  const focusAt = (p) => p.page.evaluate(() => {
    const n = document.activeElement;
    return { head: !!(n && n.matches && n.matches('.pvc-root .pvc-saved-h')), inCard: !!(n && n.closest && n.closest('.pvc-root .pvc-saved')),
      tag: n ? n.tagName.toLowerCase() : '', text: n ? (n.textContent || '').trim().slice(0, 20) : '' };
  });

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
    ok(sm.head === '情報を追加しました' && sm.rows.block_hours.v === '62.5時間' && !sm.rows.block_hours.none, '★1項目だけで保存できる。見出しは「情報を追加しました」・保存した値がそのまま出る', J({ head: sm.head, v: sm.rows.block_hours }));
    ok(NUM_KEYS.filter((k) => k !== 'block_hours').every((k) => sm.rows[k].none && sm.rows[k].v === NONE), '★入れていない5項目は「未回答」と出る（0 と出ない）', J(sm.rows));
    ok(rows.length === 1 && rows[0].block_hours === 62.5 && NUM_KEYS.filter((k) => k !== 'block_hours').every((k) => rows[0][k] === null),
      '★保存先でも、入れていない5項目は空（null）のまま ── 0 で埋めていない', J(rows));
    ok(rows.length === 1 && `${rows[0].y}-${String(rows[0].m).padStart(2, '0')}` === ym && rows[0].pos === 'cap' && rows[0].fleet === null && rows[0].note === null,
      '保存された月・職位が画面のとおり。選ばなかった機種・ひとことは空', J(rows[0]));
    const ev = await a.page.evaluate(() => window.__pvcSaved);
    ok(ev.length === 1 && ev[0].topic === 'work' && ev[0].slug === 'jal', "保存できたら 'pvc:saved'（topic・slug）がページに流れる", J(ev));
    ok(!/REAL PAY|解放|アンロック/.test(sm.text.replace(DUTY_TERM, '')), '保存後の画面は「REAL PAY が開く」と言わない');
    const acts = await a.page.evaluate(() => [...document.querySelectorAll('.pvc-root .pvc-saved-a button')].map((n) => n.getAttribute('data-pvc-act') + ':' + n.textContent));
    ok(J(acts) === J(['edit:自分の回答を見る', 'more:もう1項目を答える']), '保存後に「自分の回答を見る」「もう1項目を答える」が、この順で在る', J(acts));

    /* ── 保存できた合図（短いクラッカー）── 保存1回につき1度だけ ── */
    let cues = await cueLog(a);
    ok(J(cues) === J(POP), '★保存できたら、合図（紙片10枚）が1度だけ出る', J(cues));
    const f1 = await focusAt(a);
    await a.page.keyboard.press('Tab');
    const f2 = await focusAt(a);
    ok(f1.head && f2.inCard && f2.tag === 'button' && f2.text === '自分の回答を見る',
      '保存後は焦点が「情報を追加しました」の見出しへ移り、Tab 1回で「自分の回答を見る」に届く', J({ f1, f2 }));
    /* 閉じて、同じ項目をもう一度開く ── 出るのは入力の画面で、合図は戻らない（保存していないので） */
    await a.page.evaluate(() => window.PVContrib.close());
    await waitClosed(a);
    await api(a, 'work');
    await waitView(a, 'work');
    cues = await cueLog(a);
    let now = await cueNow(a);
    ok(J(cues) === J(POP) && now.mark === null && !now.pop, '★閉じて同じ項目を開き直しただけでは、合図は鳴らない', J({ cues, now }));

    /* ── 読み直す ── */
    await go(a, JAL);
    await api(a, 'work');
    await waitView(a, 'work');
    cues = await cueLog(a);
    now = await cueNow(a);
    ok(cues.length === 0 && now.mark === null && !now.pop, '★ページを読み直しただけでは、合図は鳴らない', J({ cues, now }));
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
    ok(sm.rows.days_off.v === '0日' && !sm.rows.days_off.none, '★0 は「0日」と出る（未回答にならない）', J(sm.rows.days_off));
    ok(rows.length === 1 && rows[0].days_off === 0 && rows[0].block_hours === 62.5 && rows[0].stay_nights === null,
      '★保存先でも 0 は 0・未回答は空のまま。同じ月は1行のまま置き換わる', J(rows));
    /* 同じ月を置き換えた回 ── 行は増えていないので「追加しました」とは言わない。合図は同じ形で1度 */
    cues = await cueLog(a);
    ok(sm.head === '情報を更新しました' && J(cues) === J(POP), '★置き換えた回の見出しは「情報を更新しました」（「追加しました」と言わない）。合図はこの回も1度だけ', J({ head: sm.head, cues }));
    await a.page.click('.pvc-root [data-pvc-act="edit"]');
    await waitView(a, 'work');
    v = await vals(a);
    ok(v.days_off === '0' && parseFloat(v.block_hours) === 62.5 && v.stay_nights === '', '「自分の回答を見る」で開き直すと、0 は 0・未回答は空欄で入っている', J(v));
    cues = await cueLog(a);
    ok(J(cues) === J(POP), '「自分の回答を見る」で入力の画面へ戻っても、合図は増えない', J(cues));

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
    const cue0 = J(await cueLog(a));                      // ここから先は1度も保存できない ＝ 合図の控えが1つも増えないこと
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
    ok(!(await a.page.$('.pvc-root [data-pvc-saved]')), '送れなかった回に、保存後の画面を出していない');
    ok(J(await cueLog(a)) === cue0 && !(await cueNow(a)).pop, '★断られた回・送れなかった回には、保存できた合図を1度も出していない', J({ before: cue0, after: await cueLog(a) }));

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
    /* 読み直してからここまで、合図は1つも出ていなかった（控えを開いただけ）。送れたこの回に、初めて1度だけ出る */
    ok(J(await cueLog(a)) === J(POP), '★送れなかった控えを開いただけでは鳴らず、「もう一度送る」で保存できた回に1度だけ鳴る', J(await cueLog(a)));
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
    ok(sm.head === '情報を追加しました' && Object.keys(sm.rows).filter((k) => TAXI.includes(k)).length === 7 && !!sm.rows.commuting_taxi_cap_note,
      '保存後の画面に、保存した答えが並ぶ（初めて答えた回の見出しは「情報を追加しました」）', J({ head: sm.head, rows: Object.keys(sm.rows) }));
    const ev = await a.page.evaluate(() => window.__pvcSaved);
    ok(ev.length === 1 && ev[0].topic === 'taxi' && ev[0].slug === 'jal', "保存できたら 'pvc:saved'（topic: taxi）が流れる", J(ev));
    let cues = await cueLog(a);
    const f1 = await focusAt(a);
    await a.page.keyboard.press('Tab');
    const f2 = await focusAt(a);
    ok(J(cues) === J(POP), '★質問に答えて保存できた回も、合図は1度だけ出る', J(cues));
    ok(f1.head && f2.inCard && f2.tag === 'button' && f2.text === '自分の回答を見る', '保存後は焦点が見出しへ移り、Tab 1回で「自分の回答を見る」に届く（質問の項目でも）', J({ f1, f2 }));

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
    cues = await cueLog(a);
    ok(cues.length === 0 && !(await cueNow(a)).pop, '★読み直しただけ・「保存済みの内容と同じ」と言われただけでは、合図は鳴らない', J(cues));

    /* ── 上書き ── */
    await pick(a, 'commuting_taxi_cost', 'partial');
    await send(a);
    await waitView(a, 'saved');
    db = await condRows('jal');
    ok(db.commuting_taxi_cost.length === 1 && db.commuting_taxi_cost[0].c === 'partial' && Object.keys(db).length === 7 && db.commuting_taxi_where[0].c === 'within_area',
      '★答え直すと上書きされる（行は増えない・ほかの答えはそのまま）', J(db.commuting_taxi_cost));
    /* 答えを1つ直しただけ ── 行は増えていないので「追加しました」とは言わない */
    const head2 = (await summary(a)).head;
    cues = await cueLog(a);
    ok(head2 === '情報を更新しました' && J(cues) === J(POP), '★答え直しただけの回の見出しは「情報を更新しました」（「追加しました」と言わない）。合図は1度だけ', J({ head2, cues }));

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
    cues = await cueLog(a);
    ok(J(cues) === J(POP), '★通信が切れた回には、合図を出していない（控えは前の1回ぶんのまま）', J(cues));
    await a.page.click('.pvc-root [data-pvc-act="retry"]');
    await waitView(a, 'saved');
    db = await condRows('jal');
    ok(db.commuting_taxi_where[0].c === 'door_to_door' && (await outboxOf(a)) === null, '「もう一度送る」で保存され、控えが消える', J(db.commuting_taxi_where));
    cues = await cueLog(a);
    ok(J(cues) === J([...POP, ...POP]), '★同じ画面のまま保存を2回 ＝ 合図も2回（保存1回につき1度・多くも少なくもない）', J(cues));

    /* ── サーバが一部だけ断ったとき（返事を試験用に差し替えて、画面の言い方だけを見る） ── */
    await a.page.click('.pvc-root [data-pvc-act="edit"]');
    await waitView(a, 'taxi');
    await pick(a, 'commuting_taxi_where', 'to_set_point');
    await pick(a, 'commuting_taxi_cost', 'self_full');
    await tick(a);
    a.st.fake = { name: 'submit_airline_conditions', body: { ok: true, airline: 'jal', saved: 1, skipped: 0,
      rejected: [{ question_id: 'commuting_taxi_cost', reason: 'parent_missing' }], answered_total: 7, questions_total: 48 } };
    await send(a);
    await waitMsg(a, 'rej');
    const rj = await msg(a, 'rej');
    const label = conds.questions.find((x) => x.id === 'commuting_taxi_cost').ja.label;
    ok(/保存できなかった項目があります/.test(rj) && rj.includes(label) && /上の質問の答えと合わない/.test(rj) && !/parent_missing/.test(rj),
      '★一部だけ断られたら、どの質問がなぜ保存されなかったかを普通の言葉で言う（記号のまま出さない）', J(rj));
    ok(!(await a.page.$('.pvc-root [data-pvc-saved]')) && (await vals(a)).commuting_taxi_cost === 'self_full', '断られた答えは画面に残っていて、保存後の画面は出さない');
    /* 一部は保存できているので 'pvc:saved' は流れる（下のページの数字を取り直すため）。それでも成功の合図にはしない
       ── 目の前に「保存できなかった項目があります」と出ているのに、紙片が散るのは嘘になる。 */
    cues = await cueLog(a);
    ok(J(cues) === J([...POP, ...POP]) && !(await cueNow(a)).pop, '★一部だけ断られた回には、保存できた合図を出さない', J(cues));
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
      '★準備中の回も、打った字は残る。保存後の画面を出さず、保存先も端末の控えも変わらない', J(v));
    ok((await cueLog(a)).length === 0 && !(await cueNow(a)).pop, '★準備中の回（月の勤務）には、保存できた合図を出していない', J(await cueLog(a)));

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
    ok((await cueLog(a)).length === 0 && !(await cueNow(a)).pop, '★準備中の回（通勤・タクシー）にも、保存できた合図を出していない', J(await cueLog(a)));

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

  /* 保存はできたが、「足したのか・置き換えたのか」をサーバが言わなかったとき（その答えを返さない古い版）。
     分からないものを「追加しました」と言い切らない ── 見出しは「保存しました」のまま。保存はできているので合図は同じ形で1度。
     返事は試験用に差し替える（＝ この回は保存先へ届かない。画面の言い方だけを見る）。 */
  await scene('足したのか置き換えたのか、サーバが言わなかったとき', async () => {
    const w0 = J(await workRows('jal'));
    await go(a, JAL);
    await api(a, 'work');
    await waitView(a, 'work');
    await a.page.waitForFunction(() => { const n = document.querySelector('.pvc-root [data-pvc-own-row]'); return !!n && !n.hidden; });
    await fill(a, 'stay_nights', '6');
    await tick(a);
    a.st.fake = { name: 'submit_work_month', body: { ok: true, saved: true, year: +ym.slice(0, 4), month: +ym.slice(5) } };
    await send(a);
    await waitView(a, 'saved');
    const sm = await summary(a);
    const cues = await cueLog(a);
    ok(sm.head === '保存しました' && sm.rows.stay_nights.v === '6泊', '★足したのか置き換えたのか分からない回の見出しは「保存しました」（「追加しました」と言い切らない）', J({ head: sm.head, v: sm.rows.stay_nights }));
    ok(J(cues) === J(POP), '分からない回も保存はできている ＝ 合図は1度だけ出る', J(cues));
    ok(J(await workRows('jal')) === w0, '（差し替えた返事なので、保存先は1文字も変わっていない）');
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
        to: n.tagName === 'A' ? new URL(n.href).pathname + new URL(n.href).search + new URL(n.href).hash : '',
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
      && by.stay.to === EY + '#stay' && by.stay.d === 'パイロット限定',
      '★答えられる7つは全部、面の中で開く（ほかの画面へ送り出さない＝会社を選び直させない）。ホテル・ステイは、このページの「ステイ先」のタブへ行く', J(L.tiles));
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
    await farWatch(b);   // 紙片がいちばん遠くまで散ったときの位置を測る支度
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
    ok(sm.head === '情報を追加しました' && sm.rows.block_hours.v === '0時間' && !sm.rows.block_hours.none && sm.rows.duty_hours.none && sm.rows.stay_nights.v === '3泊',
      '保存後の画面でも「0時間」と「未回答」が別のものとして出る（ログインなしで初めて預けた回も「情報を追加しました」）', J({ head: sm.head, rows: sm.rows }));
    ok(/ログインなしで保存しました/.test(sm.text) && /この端末から確認・修正できます/.test(sm.text) && /ログインして引き継いだあと/.test(sm.text) && /90日で消えます/.test(sm.text),
      '★保存後に、どこに残り・いつ集計に入り・いつ消えるかを言う（「サーバに保存した」ことをブラウザ内の保存と混ぜない）', sm.text.replace(/\s+/g, ' ').slice(0, 200));
    ok(await b.page.$('.pvc-root [data-pvc-act="claim"]') && await b.page.$('.pvc-root [data-pvc-act="edit"]') && await b.page.$('.pvc-root [data-pvc-act="more"]'),
      '保存後に「ログインして引き継ぐ」「自分の回答を見る」「もう1項目を答える」が在る');

    /* ── 保存できた合図（390×680・ログインなし ＝ いちばん狭く、断りの箱も入る回）── */
    let cues = await cueLog(b);
    ok(J(cues) === J(POP), '★ログインなしで保存できた回も、合図は1度だけ出る', J(cues));
    const far = await farOf(b);
    ok(!!far && far.n === 10 && far.still === 0 && far.card.length === 0 && far.sheet.length === 0,
      '★紙片は10枚とも、いちばん遠くまで散ってもカードの中に収まる（見出しの外・面の外へ出ない）', J(far));
    ok(!!far && far.clip === 'hidden hidden' && far.fill && far.touch === 'none' && far.hidden === 'true',
      '紙片の層はカードの形で切り、押せず、読み上げにも出ない（下の見出しとボタンにそのまま触れる）', J(far));
    ok(!!far && far.n === 10 && far.still === 0 && far.parts === 4 && far.over.length === 0,
      '★紙片は10枚とも、散り終わりの位置で見出しの字・チェックの印・2つのボタンのどれにも重ならない（390×680）', J(far && { parts: far.parts, over: far.over }));
    /* 2つのボタンは、保存した内容（10行）より先。スクロールしなくても最初の1画面で両方に届く */
    const reach = await reachOf(b);
    ok(reached(reach),
      '★390×680 では、スクロールしなくても「自分の回答を見る」「もう1項目を答える」の両方に届く（断りの箱が在っても）', J(reach));
    ok(!!reach.sum && reach.rows >= 10 && !!reach.more && !!reach.edit && reach.sum.top >= Math.max(reach.edit.bottom, reach.more.bottom),
      '保存した内容の一覧は、2つのボタンの下に並ぶ（一覧が長くてもボタンを押し下げない）', J(reach));
    /* 紙片は 0.9秒で消え、1.4秒で層ごと片づく。片づいたあとも「保存できた」の印はカードに残る（描き直していない証拠） */
    const gone = await popGone(b);
    const settled = await cueNow(b);
    ok(!settled.pop && settled.mark === 'pop', '★紙片の層は、散り終わったら自分で片づく（画面に残り続けない）', J(settled));
    ok(gone.ms !== null && gone.ms >= POP_MIN && gone.late === false,
      '★片づくのは散り終わったあと・設計の1.4秒から大きく遅れない（0.9秒〜2.5秒のあいだ。「いつか消えればよい」にしない）', J({ ms: gone.ms, late: gone.late, min: POP_MIN, max: POP_MAX }));
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
    cues = await cueLog(b);
    ok(cues.length === 0 && !(await cueNow(b)).pop, '★読み直して預けた内容が戻っただけでは、合図は鳴らない（ログインなしでも）', J(cues));
    await fill(b, 'stay_nights', '4');
    await tick(b);
    await send(b);
    await waitView(b, 'saved');
    pd = await pend();
    mine = await held(k1);
    ok(pd.length === 1 && (mine.rows || []).length === 1 && mine.rows[0].stay_nights === 4 && mine.rows[0].block_hours === 0 && (await devKey()) === k1 && (await keys()).length === 1,
      '★本人が直せる（同じ1件が置き換わる。行も鍵も増えない）', J(mine.rows));
    const head2 = (await summary(b)).head;
    cues = await cueLog(b);
    ok(head2 === '情報を更新しました' && J(cues) === J(POP), '★預けた1件を直した回の見出しは「情報を更新しました」（件数は増えていない）。合図は1度だけ', J({ head2, cues }));

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
    cues = await cueLog(b);
    ok(J(cues) === J(POP), '★送れなかった回には、合図を出していない（控えは前の1回ぶんのまま）', J(cues));
    await b.page.click('.pvc-root [data-pvc-act="retry"]');
    await waitView(b, 'saved');
    mine = await held(k1);
    ok(mine.rows[0].work_days === 18 && mine.rows[0].stay_nights === 4 && (await outboxOf(b)) === null, '「もう一度送る」で保存され、控えが消える', J(mine.rows[0]));
    cues = await cueLog(b);
    ok(J(cues) === J([...POP, ...POP]), '★同じ画面のまま保存を2回 ＝ 合図も2回（ログインなしでも、保存1回につき1度）', J(cues));

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
    /* 引き継ぎでも 'pvc:saved' は流れる（下のページの数字を取り直すため）。ただし、いま新しく保存したものは無い
       ── ログインして戻っただけで紙片が散ると、「保存できた時に1度」の意味が薄まる。 */
    cues = await cueLog(b);
    const back = await cueNow(b);
    ok(cues.length === 0 && back.mark === null && !back.pop, '★ログインして引き継いだだけでは、合図は鳴らない（知らせるのは「引き継ぎました」の一言）', J({ cues, back }));
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

  // ═════════════════════════════════════════════════════════════
  // 7-b. 着陸手当 ── 上の答えで出てくる額・数え方（全日本空輸・会員C ／ キャセイ・未ログイン）
  // ═════════════════════════════════════════════════════════════
  /* 2026-10-09。「着陸回数に応じた手当」に「ある」と答えた人にだけ、その場で額と数え方を聞く。
     見るのは5つ ── 上の答えで出る・消える／通貨は本人に選ばせる（円と決めつけない）／
     会社・職位・機種を聞き直さない（月の勤務で出したものを引き継ぐ）／読み直しても戻る／
     上の質問を「ない」に答え直したら、残っている古い額を「あなたの投稿」に数えない・保存した内容として出さない。
     ⚠️ ここで入れる額と文は検査のための作りもの。どの会社の着陸手当でもない。
     会員Aと日本航空を使わないのは、上の場面が「休暇・手当にはまだ1件も無い」ことを見ているため。 */
  const LAND = ['landing_pay_amount', 'landing_pay_unit', 'landing_pay_from', 'landing_pay_to', 'landing_pay_varies_by'];
  const ANA = '/airlines/ana.html', CX = '/airlines/cathay-pacific.html';
  /* サーバへ送った中身を控える（数えるだけの gate では、何を送ったかが分からない） */
  const tap = (p, name) => {
    const sent = [];
    p.page.on('request', (req) => {
      if (!req.url().endsWith('/rest/v1/rpc/' + name)) return;
      try { sent.push(JSON.parse(req.postData() || '{}').p || {}); } catch (e) { /* 読めない本文は控えない */ }
    });
    return sent;
  };
  const landRows = async (slug) => (await q(
    `select question_id as q, "position" as pos, fleet, answer_num::float8 as num, answer_currency as cur,
            answer_code as c, answer_text as t, text_shared as sh
       from public.airline_conditions where airline = $1 and question_id like 'landing_pay%' order by question_id`, [slug])).rows;
  const benefitsCount = async (p, urlPath) => {
    await go(p, urlPath + '?add=list');
    await waitView(p, 'counted');
    return p.page.evaluate(() => { const n = document.querySelector('.pvc-root [data-pvc-count="benefits"]'); return n.hidden ? null : n.textContent; });
  };
  const famRows = (sm) => Object.keys(sm.rows).filter((k) => /^landing_pay/.test(k)).sort();
  const ids = (pl) => ((pl && pl.answers) || []).map((x) => x.question_id).sort();

  await scene('着陸手当 ── 上の答えで出る・通貨を選ぶ・1回で送る・読み直す・答え直す', async () => {
    const conds = JSON.parse(read('pv-conditions.json'));
    const labelOf = (id) => conds.questions.find((x) => x.id === id).ja.label;
    const c = await open('desk', { who: 'c' });
    const sent = tap(c, 'submit_airline_conditions');

    /* ── まず月の勤務を1件（職位と機種は、ここで出したものを引き継ぐ） ── */
    await go(c, ANA);
    const anaName = await nameOf(c);
    await api(c, 'work');
    await waitView(c, 'work');
    const FLEET = await c.page.$eval('.pvc-root select[name="fleet"]', (n) => n.options[1].value);
    await pick(c, 'position', 'fo');
    await pick(c, 'fleet', FLEET);
    await fill(c, 'block_hours', '60');
    await tick(c);
    await send(c);
    await waitView(c, 'saved');

    /* ── 開く：最初に出るのは上の質問だけ ── */
    await go(c, ANA + '?add=benefits');
    await waitView(c, 'benefits');
    let sh = await shown(c);
    const shape = await c.page.evaluate((fam) => {
      const f = document.querySelector('.pvc-root form[data-pvc-form="benefits"]');
      const order = [...f.querySelectorAll('[data-q]')].map((n) => n.getAttribute('data-q'));
      const at = order.indexOf('landing_pay');
      const cur = f.querySelector('select[name="landing_pay_amount_cur"]');
      return {
        line: f.querySelector('.pvc-ctx-line').textContent,
        again: [...f.querySelectorAll('[name="airline"], [name="company"], [name="position"], [name="fleet"], [name="ym"]')].map((n) => n.name),
        next: order.slice(at + 1, at + 1 + fam.length),
        labels: fam.map((k) => f.querySelector('[data-q="' + k + '"] .pvc-label').textContent),
        cur: cur.value, curFirst: cur.options[0].textContent, curN: cur.options.length - 1,
        curName: cur.getAttribute('aria-label'),
        unit: f.querySelector('[data-q="landing_pay_amount"] .pvc-unit').textContent,
      };
    }, LAND);
    ok(sh.landing_pay && LAND.every((k) => k in sh && !sh[k]), '最初に出るのは「着陸回数に応じた手当はありますか？」だけ（額・数え方はまだ出ない）', J(LAND.map((k) => [k, sh[k]])));
    ok(shape.line.includes(anaName) && shape.line.includes('副操縦士') && shape.again.length === 0,
      '★会社・職位・機種・時期を選び直す欄が無い（会社と職位は上に出ている）', J({ line: shape.line, again: shape.again }));
    ok(J([...shape.next].sort()) === J([...LAND].sort()), '★額・数え方の質問は、着陸手当の質問のすぐ下に並ぶ（離れた所に出ない）', J(shape.next));
    ok(shape.labels.every((t) => t.includes('着陸手当')), '★下の質問は、それだけ読んでも「着陸手当の」額・数え方だと分かる', J(shape.labels));
    ok(shape.cur === '' && shape.curFirst === '通貨を選ぶ' && shape.curN === JSON.parse(read('pv-vocab.json')).currencies.length && shape.curName === labelOf('landing_pay_amount') + 'の通貨',
      '★通貨は最初から何も選ばれていない（円と決めつけない）。選べるのはサイトの通貨の一覧', J({ cur: shape.cur, first: shape.curFirst, n: shape.curN }));
    ok(shape.unit === '（1回あたり）', '額の欄に「（1回あたり）」と出ている', shape.unit);

    /* ── 上の答えで出る・消える（通信しない） ── */
    const calls0 = c.st.calls.length;
    await pick(c, 'landing_pay', 'no');
    sh = await shown(c);
    ok(LAND.every((k) => !sh[k]), '★「ない」を選ぶと、額・数え方は1つも出ない', J(sh));
    await pick(c, 'landing_pay', 'unknown');
    sh = await shown(c);
    ok(LAND.every((k) => !sh[k]), '★「わからない」を選んでも出ない', J(sh));
    await pick(c, 'landing_pay', 'variable');
    sh = await shown(c);
    const noteOpen = await c.page.$eval('.pvc-root textarea[name="landing_pay_varies_by_note"]', (n) => n.getClientRects().length > 0);
    ok(sh.landing_pay_from && sh.landing_pay_to && sh.landing_pay_varies_by && !sh.landing_pay_amount && !sh.landing_pay_unit && noteOpen,
      '★「あり・一定額ではない」→ 低いほう・高いほう・何で変わるか と、その補足の欄がその場に出る（一定額の質問は出ない）', J(sh));
    await pick(c, 'landing_pay', 'fixed');
    sh = await shown(c);
    ok(sh.landing_pay_amount && sh.landing_pay_unit && !sh.landing_pay_from && !sh.landing_pay_to && !sh.landing_pay_varies_by,
      '★「あり・1回あたり一定額」→ 額（通貨つき）と数え方がその場に出る（幅の質問は出ない）', J(sh));
    ok(c.st.calls.length === calls0, '選び直しているあいだは、サーバへ1本も投げない', J(c.st.calls.slice(calls0)));

    /* ── 通貨を選ばずに送る ── */
    await fill(c, 'landing_pay_amount', '1500');
    await tick(c);
    await send(c);
    /* 文が出なくても、ここでは止まらない（下の行を赤くする）。止まると、止めずに送る形に壊れたとき
       「場面が最後まで進まなかった」としか出ず、どの約束が破れたのかが分からない。 */
    await waitMsg(c, 'said').catch(() => null);
    const said = (await msg(c, 'said')) || '';
    const at = await c.page.evaluate(() => document.activeElement && document.activeElement.name);
    ok(said.includes(labelOf('landing_pay_amount')) && /通貨を選んでください/.test(said) && at === 'landing_pay_amount_cur',
      '★額だけ入れて通貨を選ばずに送ると、その場で「通貨を選んでください」と言い、通貨の欄へ移る', J({ said, at }));
    ok(sent.length === 0 && hits(c, 'submit_airline_conditions') === 0 && (await landRows('ana')).length === 0, '   その回は、サーバへ1本も投げていない（通貨の無い額を預けない）', J(sent));

    /* ── 一定額：親・額・数え方を1回で ── */
    await pick(c, 'landing_pay_amount_cur', 'JPY');
    await pick(c, 'landing_pay_unit', 'per_landing');
    await send(c);
    await waitView(c, 'saved');
    let db = await landRows('ana');
    let sm = await summary(c);
    const p1 = sent[0] || {};
    const amt = (p1.answers || []).find((x) => x.question_id === 'landing_pay_amount') || {};
    ok(sent.length === 1 && J(ids(p1)) === J(['landing_pay', 'landing_pay_amount', 'landing_pay_unit']) && amt.num === 1500 && amt.currency === 'JPY',
      '★着陸手当・額（通貨つき）・数え方の3つを、1回の送信でまとめて送る', J(p1.answers));
    ok(p1.airline === 'ana' && p1.position === 'fo' && p1.fleet === FLEET,
      '★その送信に、月の勤務で出した職位と機種が付いている（額と数え方が、親と同じ条件を引き継ぐ）', J({ airline: p1.airline, position: p1.position, fleet: p1.fleet }));
    ok(db.length === 3 && db.every((r) => r.pos === 'fo' && r.fleet === FLEET) && db.find((r) => r.q === 'landing_pay_amount').num === 1500
      && db.find((r) => r.q === 'landing_pay_amount').cur === 'JPY' && db.find((r) => r.q === 'landing_pay_unit').c === 'per_landing',
      '★保存先でも3行とも同じ職位・機種。額と通貨と数え方が、画面で入れたとおり', J(db));
    ok(sm.head === '情報を追加しました' && J(famRows(sm)) === J(['landing_pay', 'landing_pay_amount', 'landing_pay_unit'])
      && sm.rows.landing_pay_amount.v === 'JPY 1,500（1回あたり）' && sm.rows.landing_pay_unit.v === '着陸1回ごと',
      '★保存後の画面に、自分の答えが通貨つきで出る（JPY 1,500（1回あたり）・着陸1回ごと）', J(sm.rows));

    /* ── 読み直す ── */
    await go(c, ANA + '?add=benefits');
    await waitView(c, 'benefits');
    let v = await vals(c);
    let tags = await c.page.evaluate(() => [...document.querySelectorAll('.pvc-root form [data-q]')]
      .filter((n) => n.querySelector('.pvc-label .pvc-mine')).map((n) => n.getAttribute('data-q')).sort());
    sh = await shown(c);
    ok(v.landing_pay === 'fixed' && v.landing_pay_amount === '1500' && v.landing_pay_amount_cur === 'JPY' && v.landing_pay_unit === 'per_landing'
      && sh.landing_pay_amount && sh.landing_pay_unit, '★読み直すと、着陸手当・額・通貨・数え方が入った状態で開く', J(v));
    ok(J(tags) === J(['landing_pay', 'landing_pay_amount', 'landing_pay_unit']), '答えた3つに「あなたの投稿」の札が付いている', J(tags));
    ok((await benefitsCount(c, ANA)) === 'あなたの投稿 3件', '一覧の「休暇・手当」は「あなたの投稿 3件」', '');

    /* ── 額だけ直す ── */
    await c.page.click('.pvc-root [data-pvc-tile="benefits"]');
    await waitView(c, 'benefits');
    await fill(c, 'landing_pay_amount', '1800');
    await tick(c);
    await send(c);
    await waitView(c, 'saved');
    db = await landRows('ana');
    ok(sent.length === 2 && J(ids(sent[1])) === J(['landing_pay_amount']) && db.length === 3
      && db.find((r) => r.q === 'landing_pay_amount').num === 1800 && db.find((r) => r.q === 'landing_pay_amount').cur === 'JPY',
      '★額を直すと、その1件だけが置き換わる（行は増えない・通貨はそのまま）', J({ sent: ids(sent[1]), db: db.map((r) => [r.q, r.num]) }));

    /* ── 「一定額ではない」に答え直す：低いほうだけ入れる ── */
    await c.page.click('.pvc-root [data-pvc-act="edit"]');
    await waitView(c, 'benefits');
    await pick(c, 'landing_pay', 'variable');
    await fill(c, 'landing_pay_from', '10');
    await pick(c, 'landing_pay_from_cur', 'USD');
    v = await vals(c);
    ok(v.landing_pay_from_cur === 'USD' && v.landing_pay_to_cur === 'USD',
      '★通貨は1回選べば足りる ── 低いほうで選んだ通貨が、高いほうにも入っている', J({ from: v.landing_pay_from_cur, to: v.landing_pay_to_cur }));
    await pick(c, 'landing_pay_varies_by', 'airport');
    await fill(c, 'landing_pay_varies_by_note', '空港によって違う');
    await tick(c);
    await send(c);
    await waitView(c, 'saved');
    db = await landRows('ana');
    sm = await summary(c);
    const p3 = sent[2] || {};
    const vb = (p3.answers || []).find((x) => x.question_id === 'landing_pay_varies_by') || {};
    ok(sent.length === 3 && J(ids(p3)) === J(['landing_pay', 'landing_pay_from', 'landing_pay_varies_by']) && vb.text === '空港によって違う' && vb.share === true,
      '★額は片方だけでも送れる（入れていない「高いほう」は送らない ＝ 0 や同じ額で埋めない）。補足も一緒に送る', J(p3.answers));
    ok(J(famRows(sm)) === J(['landing_pay', 'landing_pay_from', 'landing_pay_varies_by', 'landing_pay_varies_by_note'])
      && sm.rows.landing_pay_from.v === 'USD 10（1回あたり）' && sm.rows.landing_pay_varies_by.v === '空港・路線' && sm.rows.landing_pay_varies_by_note.v === '空港によって違う',
      '★答え直したあとの保存後の画面に、前の枝の額（JPY 1,800）と数え方が出ていない', J(sm.rows));
    ok(db.length === 5 && db.find((r) => r.q === 'landing_pay_amount').num === 1800 && db.find((r) => r.q === 'landing_pay_unit').c === 'per_landing',
      '   前の額と数え方の行そのものは、保存先に残っている（消していない ＝ 答え直せば戻せる）', J(db.map((r) => r.q)));
    ok((await benefitsCount(c, ANA)) === 'あなたの投稿 3件', '★「あなたの投稿」は3件のまま（残っている前の2行を数えない。保存先は5行）', '');

    /* ── 高いほうを足す：通貨は借りる ── */
    await c.page.click('.pvc-root [data-pvc-tile="benefits"]');
    await waitView(c, 'benefits');
    v = await vals(c);
    ok(v.landing_pay_from === '10' && v.landing_pay_to === '' && v.landing_pay_to_cur === 'USD',
      '読み直すと、まだ入れていない「高いほう」は空欄のまま（通貨は、保存した「低いほう」と同じものが入っている）', J(v));
    await pick(c, 'landing_pay_from_cur', 'EUR');
    const follow = (await vals(c)).landing_pay_to_cur;
    await pick(c, 'landing_pay_from_cur', 'USD');
    v = await vals(c);
    ok(follow === 'EUR' && v.landing_pay_to_cur === 'USD',
      '★保存したあとも、「高いほう」の通貨は自分で選ぶまで「低いほう」に付いて動く（前に見せただけの通貨が居残っていない）', J({ follow, back: v.landing_pay_to_cur }));
    await fill(c, 'landing_pay_to', '25');
    await tick(c);
    await send(c);
    await waitView(c, 'saved');
    db = await landRows('ana');
    const p4 = sent[3] || {};
    ok(sent.length === 4 && J(p4.answers) === J([{ question_id: 'landing_pay_to', num: 25, currency: 'USD' }]),
      '★「高いほう」は、借りた通貨を付けて送る（通貨を選び直させない）。変えていない答えは送り直さない', J(p4.answers));
    ok(db.find((r) => r.q === 'landing_pay_to').cur === 'USD' && db.find((r) => r.q === 'landing_pay_from').num === 10 && db.find((r) => r.q === 'landing_pay_from').cur === 'USD',
      '   保存先でも「高いほう」は USD。「低いほう」は元のまま', J(db.filter((r) => /_from|_to/.test(r.q))));

    /* ── 「ない」に答え直す ── */
    await c.page.click('.pvc-root [data-pvc-act="edit"]');
    await waitView(c, 'benefits');
    await pick(c, 'landing_pay', 'no');
    await tick(c);
    await send(c);
    await waitView(c, 'saved');
    db = await landRows('ana');
    sm = await summary(c);
    const srv = await c.page.evaluate(async () => {
      const sb = await window.PVCareer.client();
      const r = await sb.rpc('my_airline_conditions', { p: { airline: 'ana' } });
      return r.data.answers.filter((x) => !x.airline || x.airline === 'ana').map((x) => x.question_id).filter((k) => /^landing_pay/.test(k)).sort();
    });
    ok(J(ids(sent[4])) === J(['landing_pay']) && db.length === 6 && db.find((r) => r.q === 'landing_pay').c === 'no' && srv.length === 6,
      '「ない」に直しても、下の5行は保存先に残っていて、サーバは本人に6件とも返す（ここまでが前提）', J({ db: db.map((r) => r.q), srv }));
    ok(J(famRows(sm)) === J(['landing_pay']) && sm.rows.landing_pay.v === 'ない' && !/1,800|USD|JPY|空港/.test(sm.text),
      '★「ない」に直したあとの保存後の画面に、古い額・数え方・補足が1つも出ない', J(sm.rows));
    ok((await benefitsCount(c, ANA)) === 'あなたの投稿 1件', '★「あなたの投稿」は1件（「ない」の答えだけ）── 残っている古い額を数えない', '');
    await c.page.click('.pvc-root [data-pvc-tile="benefits"]');
    await waitView(c, 'benefits');
    sh = await shown(c);
    tags = await c.page.evaluate(() => [...document.querySelectorAll('.pvc-root form [data-q]')]
      .filter((n) => !n.closest('[hidden]') && /^landing_pay/.test(n.getAttribute('data-q')) && n.querySelector('.pvc-label .pvc-mine')).map((n) => n.getAttribute('data-q')));
    ok(LAND.every((k) => !sh[k]) && J(tags) === J(['landing_pay']), '   開き直した画面にも、古い額の欄は出ていない（札は「ない」の1つだけ）', J({ sh: LAND.map((k) => sh[k]), tags }));

    /* ── サーバがまだ下の質問を知らないとき（返事を試験用に差し替えて、画面の言い方だけを見る） ──
       画面を先に出して SQL を貼り忘れると、本番はこの形で返す。親だけ保存され、下の3つは断られる。 */
    await pick(c, 'landing_pay', 'fixed');
    v = await vals(c);
    ok(v.landing_pay_amount === '1800' && v.landing_pay_amount_cur === 'JPY', '「一定額」に戻すと、前に入れた額が入った状態で出る（消していないので打ち直さずに済む）', J(v));
    await fill(c, 'landing_pay_amount', '2000');
    await pick(c, 'landing_pay_unit', 'per_leg');
    await tick(c);
    c.st.fake = { name: 'submit_airline_conditions', body: { ok: true, airline: 'ana', saved: 1, skipped: 0,
      rejected: [{ question_id: 'landing_pay_amount', reason: 'unknown_question' }, { question_id: 'landing_pay_unit', reason: 'unknown_question' }],
      answered_total: 1, questions_total: 48 } };
    await send(c);
    await waitMsg(c, 'rej');
    const rj = await msg(c, 'rej');
    v = await vals(c);
    ok(/保存できなかった項目があります/.test(rj) && rj.includes(labelOf('landing_pay_amount')) && rj.includes(labelOf('landing_pay_unit'))
      && /この質問はいま受け付けていません/.test(rj) && /ほかの1件は保存しました/.test(rj) && !/unknown_question/.test(rj),
      '★下の質問だけ断られたら、どの質問が保存されなかったかを普通の言葉で言い、上の1件は保存したと言う', J(rj));
    ok(!(await c.page.$('.pvc-root [data-pvc-saved]')) && v.landing_pay_amount === '2000' && v.landing_pay_unit === 'per_leg',
      '★断られた額と数え方は画面に残っていて、保存後の画面は出さない', J(v));
    await c.st.ctx.close();
  });

  for (const theme of [null, 'dark']) {
    const tone = theme ? '暗い表示' : '明るい表示';
    await scene(`着陸手当 ── 390×680（${tone}）で欄が切れない`, async () => {
      const p = await open('phone', { who: 'c', theme });
      await go(p, ANA + '?add=benefits');
      await waitView(p, 'benefits');
      if (theme) ok(await p.page.$eval('.pvc-root', (n) => n.classList.contains('is-dark')), '暗い表示で開いている');
      await pick(p, 'landing_pay', 'fixed');
      await p.page.$eval('.pvc-root [data-q="landing_pay_amount"]', (n) => n.scrollIntoView({ block: 'center' }));
      const row = await p.page.evaluate(() => {
        const f = document.querySelector('.pvc-root [data-q="landing_pay_amount"]'), fr = f.getBoundingClientRect();
        const parts = [...f.querySelectorAll('.pvc-numrow > *')].map((n) => n.getBoundingClientRect());
        return { n: parts.length, inside: parts.every((r) => r.width > 0 && r.left >= fr.left - 0.5 && r.right <= fr.right + 0.5) };
      });
      ok(row.n === 4 && row.inside, `390×680（${tone}）：通貨・額・「（1回あたり）」・「わからない」が、額の質問の枠の中に収まっている`, J(row));
      checkSize(await measure(p), `390×680（${tone}） 着陸手当・一定額を選んだ状態`);
      await pick(p, 'landing_pay', 'variable');
      await p.page.$eval('.pvc-root [data-q="landing_pay_varies_by"]', (n) => n.scrollIntoView({ block: 'center' }));
      checkSize(await measure(p), `390×680（${tone}） 着陸手当・一定額ではないを選んだ状態`);
      await p.st.ctx.close();
    });
  }

  await scene('着陸手当 ── ログインなしで預ける・読み直す・「ない」に直す（古い額を数えない）', async () => {
    const n = await open('phone');
    const sent = tap(n, 'submit_contrib_anon');
    const held = async () => (await (await fetch(`${base}/rest/v1/rpc/my_contrib_anon`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ p: { key: await n.page.evaluate(() => localStorage.getItem('pv_contrib_key') || ''), airline: 'cathay-pacific' } }),
    })).json());
    const heldFam = async () => ((await held()).answers || []).map((x) => x.question_id).filter((k) => /^landing_pay/.test(k)).sort();

    await go(n, CX + '?add=benefits');
    await waitView(n, 'benefits');
    await pick(n, 'landing_pay', 'fixed');
    await fill(n, 'landing_pay_amount', '1500');
    await pick(n, 'landing_pay_amount_cur', 'HKD');
    await pick(n, 'landing_pay_unit', 'per_leg');
    await tick(n);
    await send(n);
    await waitView(n, 'saved');
    let sm = await summary(n);
    const d1 = (sent[0] || {}).data || {};
    ok(sent.length === 1 && (sent[0] || {}).kind === 'cond' && d1.airline === 'cathay-pacific' && J(ids(d1)) === J(['landing_pay', 'landing_pay_amount', 'landing_pay_unit'])
      && (await snap(n)).href === CX && hits(n, 'submit_airline_conditions') === 0,
      '★ログインなしでも、着陸手当・額・数え方を1回で預けられる（ログインへ行かない・同じ会社ページのまま）', J({ kind: (sent[0] || {}).kind, ids: ids(d1) }));
    ok(sm.head === '情報を追加しました' && J(famRows(sm)) === J(['landing_pay', 'landing_pay_amount', 'landing_pay_unit'])
      && sm.rows.landing_pay_amount.v === 'HKD 1,500（1回あたり）' && sm.rows.landing_pay_unit.v === 'レグ（区間）1つごと' && /ログインなしで保存しました/.test(sm.text),
      '★保存後の画面に、自分の答えが通貨つきで出る。「ログインなしで保存しました」と言う', J(sm.rows));

    /* ── 読み直す（同じ端末） ── */
    await go(n, CX + '?add=benefits');
    await waitView(n, 'benefits');
    await n.page.waitForFunction(() => { const x = document.querySelector('.pvc-root [name="landing_pay_amount"]'); return !!x && x.value === '1500'; });
    let v = await vals(n);
    const sh = await shown(n);
    ok(v.landing_pay === 'fixed' && v.landing_pay_amount === '1500' && v.landing_pay_amount_cur === 'HKD' && v.landing_pay_unit === 'per_leg' && sh.landing_pay_amount && sh.landing_pay_unit,
      '★読み直すと、預けた額・通貨・数え方がサーバから戻っている', J(v));
    ok((await benefitsCount(n, CX)) === 'あなたの投稿 3件', '一覧の「休暇・手当」は「あなたの投稿 3件」', '');

    /* ── 「ない」に直す ── */
    await n.page.click('.pvc-root [data-pvc-tile="benefits"]');
    await waitView(n, 'benefits');
    await pick(n, 'landing_pay', 'no');
    await tick(n);
    await send(n);
    await waitView(n, 'saved');
    sm = await summary(n);
    const left = await heldFam();
    ok(J(ids((sent[1] || {}).data)) === J(['landing_pay']) && left.length === 3,
      '「ない」に直しても、預かりには額と数え方の行が残っている（ここまでが前提）', J(left));
    ok(J(famRows(sm)) === J(['landing_pay']) && sm.rows.landing_pay.v === 'ない' && !/1,500|HKD/.test(sm.text),
      '★「ない」に直したあとの保存後の画面に、古い額と数え方が出ない（ログインなしでも同じ）', J(sm.rows));
    ok((await benefitsCount(n, CX)) === 'あなたの投稿 1件', '★「あなたの投稿」は1件 ── 預かりに残っている古い額を数えない', '');
    await n.st.ctx.close();
  });

  await scene('ホテル・ステイの入口 ── このページの「ステイ先」のタブへ（ほかの画面へ送り出さない）', async () => {
    const s = await open('phone');
    await go(s, EY);
    await s.page.waitForFunction(() => !!window.PVGlance);
    const before = await s.page.evaluate(() => ({ at: window.PVGlance.at(), len: history.length }));
    await s.page.evaluate(() => window.PVContrib.open({ topic: 'list' }));
    await waitView(s, 'list');
    await s.page.click('.pvc-root [data-pvc-tile="stay"]');
    await s.page.waitForFunction(() => window.PVGlance.at() === 'stay' && !window.PVContrib.isOpen()
      && document.querySelector('.pvc-root').hidden, { timeout: 8000 }).catch(() => {});
    const after = await s.page.evaluate(() => {
      const box = document.getElementById('pvg-stay'), r = box.getBoundingClientRect();
      return {
        at: window.PVGlance.at(), open: window.PVContrib.isOpen(), hidden: document.querySelector('.pvc-root').hidden,
        href: location.pathname + location.search + location.hash, shown: r.width > 0 && r.height > 0,
        list: !!box.querySelector('#pvg-st-list li'), lock: document.documentElement.classList.contains('pvc-lock'), len: history.length,
      };
    });
    ok(before.at !== 'stay' && after.at === 'stay' && after.href === EY + '#stay' && after.shown && after.list,
      '★「ホテル・ステイ」を押すと、同じページの「ステイ先」のタブが開く（会社を選び直させない・別の画面へ行かない）', J({ before, after }));
    ok(!after.open && after.hidden && !after.lock, '面は閉じている（ページが動かせる）', J(after));
    ok(after.len === before.len + 1, '履歴に残るのはタブの1段だけ（面のために積んだ段は降りている）', J({ before: before.len, after: after.len }));
    await s.page.goBack().catch(() => {});
    await s.page.waitForFunction((t) => window.PVGlance.at() === t, { timeout: 8000 }, before.at).catch(() => {});
    const back = await s.page.evaluate(() => ({ at: window.PVGlance.at(), open: window.PVContrib.isOpen(), href: location.pathname + location.search + location.hash }));
    ok(back.at === before.at && !back.open && back.href === EY, '「戻る」1回で、開く前のタブへ戻る（面は開き直さない）', J(back));
    await s.st.ctx.close();
  });

  /* ページの深い所で押したとき。面のために積んだ段を降りてからタブを替えると、降りた先の位置をブラウザが
     あとから置き直して、替えたタブが途中から始まった（100枚ある就航地の一覧のまんなかに出る）。
     いまは、面の段をそのまま行き先のタブの段に書き換える ＝ 降りない。 */
  const tabProbe = (s) => ({
    where: () => s.page.evaluate(() => {
      const bar = document.querySelector('.pvg-tabbar').getBoundingClientRect(), box = document.getElementById('pvg-stay').getBoundingClientRect();
      const more = document.querySelector('.pvg-more[aria-expanded="true"]'), f = document.activeElement;
      return {
        at: window.PVGlance.at(), y: Math.round(scrollY), len: history.length, open: window.PVContrib.isOpen(),
        lock: document.documentElement.classList.contains('pvc-lock'), href: location.pathname + location.search + location.hash,
        bar: Math.round(bar.bottom), head: Math.round(box.top), shown: box.height > 0, vh: innerHeight,
        /* 開いている板（概要で「もっと見る」を押した先）と、いま焦点の在る所 */
        panel: more ? more.getAttribute('aria-controls') : '', focus: f && f !== document.body ? String(f.getAttribute('class') || f.tagName).slice(0, 40) : '',
      };
    }),
    /* 置き直しが落ち着く（3コマ続けて同じ位置）まで待つ。時間では待たない */
    still: () => s.page.evaluate(() => new Promise((res) => {
      const t0 = performance.now(); let last = -1, n = 0;
      const tick = () => { n = scrollY === last ? n + 1 : 0; last = scrollY; if (n >= 3 || performance.now() - t0 > 3000) return res(); requestAnimationFrame(tick); };
      tick();
    })),
    /* 実データの欄（口コミ・REAL PAY …）と字の形が届いて、ページの高さが決まるまで待つ（3コマ続けて同じ高さ）。時間では待たない。
       届く前に測り始めると、あとで欄が縮んだ分だけページが短くなる（スマホのエティハドの概要で約145px）。
       控えた位置がページの底より下になり、「戻る」でブラウザがそこへ置けない ＝ 製品は正しいのに赤くなる。
       2026-10-09、ほかの場面と続けて流した回にだけ実際に踏んだ（この場面だけ流すと緑のままで、気づけない）。
       ⚠️ 字の形は「届いたか」だけでは足りない ── 「頼んだか」まで見る（2026-10-10）。
       字の形の指定（外の CSS）は、あとから当てる書き方で読んでいる（media="print" → 読めたら all）。
       当たる前は、頼んだ字の形が1つも無い ＝ document.fonts.status は何もしなくても 'loaded' と答える。
       そこで「届いた」と数えて測り始めると、面を開いたあとで字の形が届き、うしろのページが 1〜19px 動く
       ＝ 製品は正しいのに赤くなる（外の回線が遅い回にだけ。実際に踏んだ：開く前 1735 → 開いた後 1736）。
       なので、ページの読み込みが終わり（＝ その CSS が届いたか、届かないと決まった）、字の形が指定されているなら
       少なくとも1つは頼み終えている（届いた・届かなかった）ことまで待つ。CSS が届かない回は、字の形の指定が
       1つも無いまま ＝ 今までどおり先へ進む（回線が無い所で流しても、ここで止めない）。 */
    ready: async () => {
      const got = await s.page.evaluate(() => new Promise((res) => {
        const t0 = performance.now(); let last = -1, n = 0;
        const tick = () => {
          const wait = [...document.querySelectorAll('.pvg .crl, .pvg-hero .crl')]
            .filter((b) => b.getClientRects().length && /^(idle|loading)$/.test(b.dataset.state)).map((b) => b.getAttribute('data-live'));
          const fonts = document.fonts.status, h = document.documentElement.scrollHeight;
          const faces = [...document.fonts], asked = faces.filter((f) => f.status === 'loaded' || f.status === 'error').length;
          const shaped = document.readyState === 'complete' && fonts === 'loaded' && (!faces.length || asked > 0);
          n = !wait.length && shaped && h === last ? n + 1 : 0; last = h;
          if (n >= 3 || performance.now() - t0 > 15000) return res({ ok: n >= 3, wait, fonts, h, page: document.readyState, faces: faces.length, asked });
          requestAnimationFrame(tick);
        };
        tick();
      }));
      ok(got.ok, '（前提）測り始める前に、実データの欄と字の形が届いて、ページの高さが決まっている', J(got));
    },
  });
  await scene('ホテル・ステイの入口を、ページの深い所から押す ── 行き先は頭から・戻ると元の深さ・進んでも面は開き直さない', async () => {
    const s = await open('phone');
    await go(s, EY);
    await s.page.waitForFunction(() => !!window.PVGlance);
    const { where, still, ready } = tabProbe(s);
    await ready();
    const headOk = (x) => x.head >= x.bar - 2 && x.head <= x.bar + 120;
    await s.page.evaluate(() => window.scrollTo({ top: Math.round((document.documentElement.scrollHeight - innerHeight) * 0.6), behavior: 'instant' }));
    await s.page.waitForFunction(() => scrollY > 600, { timeout: 8000 }).catch(() => {});
    await still();
    const before = await where();
    await s.page.click('.pvg-tabbar .pvg-add');
    await waitView(s, 'list');
    const opened = await where();
    ok(before.at !== 'stay' && before.y > 600 && opened.y === before.y && opened.open,
      '（前提）概要の深い所で、上に貼り付いた「情報を追加」から一覧を開いた・開いてもページは動かない', J({ before, opened }));
    await s.page.click('.pvc-root [data-pvc-tile="stay"]');
    await s.page.waitForFunction(() => window.PVGlance.at() === 'stay' && !window.PVContrib.isOpen()
      && document.querySelector('.pvc-root').hidden, { timeout: 8000 }).catch(() => {});
    await still();
    const after = await where();
    ok(after.at === 'stay' && after.shown && !after.open && !after.lock && after.href === EY + '#stay',
      '深い所から押しても「ステイ先」のタブが開き、面は閉じている（ページが動かせる）', J(after));
    ok(headOk(after), '★替えたタブは頭から始まる（一覧の頭が、タブの帯のすぐ下に在る。途中から始まらない）', J({ bar: after.bar, head: after.head, y: after.y }));
    ok(after.len === before.len + 1, '履歴に増えるのは、タブの1段だけ', J({ before: before.len, after: after.len }));
    await s.page.goBack().catch(() => {});
    await s.page.waitForFunction((t, y) => window.PVGlance.at() === t && Math.abs(scrollY - y) <= 2, { timeout: 8000 }, before.at, before.y).catch(() => {});
    await still();
    const back = await where();
    ok(back.at === before.at && !back.open && !back.lock && back.href === EY, '「戻る」1回で、開く前のタブへ戻る（面は開き直さない）', J(back));
    ok(Math.abs(back.y - before.y) <= 2, '★戻った先は、押す前と同じ深さ（頭へ飛ばされない）', J({ before: before.y, back: back.y }));
    await s.page.goForward().catch(() => {});
    await s.page.waitForFunction(() => window.PVGlance.at() === 'stay', { timeout: 8000 }).catch(() => {});
    await still();
    const fwd = await where();
    ok(fwd.at === 'stay' && !fwd.open && !fwd.lock && fwd.href === EY + '#stay', '「進む」で「ステイ先」へ・面は開き直さない', J(fwd));
    ok(fwd.shown && fwd.head < fwd.vh && fwd.head >= fwd.bar - 2, '進んだ先でも、一覧の頭が画面の中に在る', J({ bar: fwd.bar, head: fwd.head, y: fwd.y }));
    await s.st.ctx.close();
  });

  /* 概要の「ホテル・レストラン」は、同じページの就航地の欄（#pvg-stay）へ寄るだけの素のリンク。
     この欄は概要にもステイ先にも出るので、住所の # だけでは「どちらのタブで見ていたか」が決まらない。
     そこからホテル・ステイへ行って「戻る」と、ステイ先のタブのまま（概要へ戻れない）だった。
     ⚠️ 寄った所から先まで読んでから離れる。寄った所のままだと、「戻る」でブラウザが自分で節の頭へ
        寄せ直しても数pxしか違わず、読んでいた所を失くしていることが見えない（2026-10-08 に実際にそうだった）。 */
  await scene('概要の「ホテル・レストラン」から寄ったあとでホテル・ステイへ ── 「戻る」は概要の同じ所へ', async () => {
    const s = await open('phone');
    await go(s, EY);
    await s.page.waitForFunction(() => !!window.PVGlance);
    const { where, still, ready } = tabProbe(s);
    await ready();
    /* リンクを押した瞬間の位置を、ページの中で控える（押す道具が先にリンクを画面の中へ寄せるので、外から先に読むとずれる） */
    await s.page.evaluate(() => {
      document.querySelector('.pvg a.pvg-topic-a[href="#pvg-stay"]').addEventListener('click', () => { window.__pvPressedAt = scrollY; }, { capture: true, once: true });
    });
    await s.page.click('.pvg a.pvg-topic-a[href="#pvg-stay"]');
    await s.page.waitForFunction(() => location.hash === '#pvg-stay', { timeout: 8000 }).catch(() => {});
    await still();
    const pressedAt = await s.page.evaluate(() => window.__pvPressedAt);
    const before = await where();
    ok(before.at === 'overview' && before.href === EY + '#pvg-stay' && before.shown && before.head >= before.bar - 2 && before.head < before.vh,
      '（前提）概要のまま、就航地の欄が画面の中へ寄っている', J(before));
    /* 寄った所から、その先まで読む（滑らせずに置く） */
    await s.page.evaluate(() => { const el = document.documentElement, was = el.style.scrollBehavior; el.style.scrollBehavior = 'auto'; window.scrollBy(0, 320); el.style.scrollBehavior = was; });
    await s.page.waitForFunction((y) => scrollY >= y + 300, { timeout: 8000 }, before.y).catch(() => {});
    await still();
    const deep = await where();
    ok(deep.at === 'overview' && deep.y >= before.y + 300, '（前提）寄った所から、その先まで読んでいる', J({ landed: before.y, read: deep.y }));
    await s.page.click('.pvg-tabbar .pvg-add');
    await waitView(s, 'list');
    await s.page.click('.pvc-root [data-pvc-tile="stay"]');
    await s.page.waitForFunction(() => window.PVGlance.at() === 'stay' && !window.PVContrib.isOpen(), { timeout: 8000 }).catch(() => {});
    await still();
    const after = await where();
    ok(after.at === 'stay' && after.href === EY + '#stay' && !after.open, '「ステイ先」のタブへ移る', J(after));
    await s.page.goBack().catch(() => {});
    await s.page.waitForFunction((y) => window.PVGlance.at() === 'overview' && Math.abs(scrollY - y) <= 2, { timeout: 8000 }, deep.y).catch(() => {});
    await still();
    /* ブラウザがあとから寄せ直すなら、ここから滑って動く。動き終わるまで見る（止まって見えるコマが続いても、書き留めが追いつくまで待つ） */
    await s.page.waitForFunction(() => { const h = history.state; return !!h && typeof h.pvgY === 'number' && Math.abs(h.pvgY - scrollY) <= 1; }, { timeout: 8000 }).catch(() => {});
    await still();
    const back = await where();
    ok(back.at === 'overview' && !back.open && !back.lock,
      '★「戻る」で概要へ戻る（同じ欄が2つのタブに出ていても、見ていたタブへ）', J(back));
    ok(Math.abs(back.y - deep.y) <= 2, '★戻った先は、読んでいた深さ（節の頭へ引き戻されない）', J({ landed: before.y, read: deep.y, back: back.y }));
    ok(back.href === EY, '戻った段の住所に、節の id が残っていない（残っていると、ブラウザが節の頭へ寄せ直す）', J({ href: back.href }));
    await s.page.goForward().catch(() => {});
    await s.page.waitForFunction(() => window.PVGlance.at() === 'stay', { timeout: 8000 }).catch(() => {});
    await still();
    const fwd = await where();
    ok(fwd.at === 'stay' && fwd.href === EY + '#stay' && !fwd.open, '「進む」で「ステイ先」へ', J(fwd));
    await s.page.goBack().catch(() => {});
    await s.page.waitForFunction(() => window.PVGlance.at() === 'overview', { timeout: 8000 }).catch(() => {});
    await s.page.goBack().catch(() => {});
    /* リンクを押す前の段には、押した瞬間の位置が書き留めてある（住所はどちらも # なしなので、住所では見分けられない。
       読み進めた深さとは 300px 以上違うので、書き留めの位置で見分ける） */
    await s.page.waitForFunction((y) => { const h = history.state; return location.hash === '' && !!h && typeof h.pvgY === 'number' && Math.abs(h.pvgY - y) <= 2 && Math.abs(scrollY - y) <= 2; }, { timeout: 8000 }, pressedAt).catch(() => {});
    await still();
    const top = await where();
    const topMark = await s.page.evaluate(() => { const h = history.state; return h && typeof h.pvgY === 'number' ? h.pvgY : null; });
    ok(typeof pressedAt === 'number' && Math.abs(pressedAt - deep.y) > 100, '（前提）リンクを押した所と、読み進めた所は別の深さ', J({ pressedAt, read: deep.y }));
    ok(top.at === 'overview' && top.href === EY && !top.open && topMark !== null && Math.abs(topMark - pressedAt) <= 2 && Math.abs(top.y - pressedAt) <= 2,
      'もう1回「戻る」と、リンクを押す前の概要（# の無い住所・リンクを押した所）', J({ pressedAt, mark: topMark, y: top.y, at: top.at, href: top.href }));
    await s.st.ctx.close();
  });

  /* 概要で板（勤務・待遇・暮らしの「もっと見る」）を開いて読んでいる途中から行って戻る。
     位置だけ戻して板を閉じたままにすると、ページが板の分だけ短くなって、同じ位置に別の中身が来る。 */
  await scene('概要で板を開いたままホテル・ステイへ ── 「戻る」と板が開いたまま・同じ深さ', async () => {
    const s = await open('phone');
    await go(s, EY);
    await s.page.waitForFunction(() => !!window.PVGlance);
    const { where, still, ready } = tabProbe(s);
    await ready();
    await s.page.click('.pvg .pvg-more[aria-controls="pvg-p-work"]');
    await s.page.waitForFunction(() => { const p = document.getElementById('pvg-p-work'); return !!p && !p.hidden && p.getBoundingClientRect().height > 200; }, { timeout: 8000 }).catch(() => {});
    await still();
    /* 板の中ほどまで読み進める（板が閉じると、この位置はページの別の所になる） */
    await s.page.evaluate(() => { const r = document.getElementById('pvg-p-work').getBoundingClientRect(); window.scrollTo({ top: Math.round(scrollY + r.top + Math.min(r.height * 0.5, 600) - 160), behavior: 'instant' }); });
    await still();
    const before = await where();
    ok(before.at === 'overview' && before.panel === 'pvg-p-work' && before.y > 300, '（前提）概要で「勤務」の板を開いて、中ほどまで読んでいる', J(before));
    await s.page.click('.pvg-tabbar .pvg-add');
    await waitView(s, 'list');
    await s.page.click('.pvc-root [data-pvc-tile="stay"]');
    await s.page.waitForFunction(() => window.PVGlance.at() === 'stay' && !window.PVContrib.isOpen(), { timeout: 8000 }).catch(() => {});
    await still();
    const after = await where();
    ok(after.at === 'stay' && after.panel === '', '「ステイ先」へ移る（概要の板は閉じる）', J(after));
    await s.page.goBack().catch(() => {});
    await s.page.waitForFunction((y) => window.PVGlance.at() === 'overview' && Math.abs(scrollY - y) <= 2, { timeout: 8000 }, before.y).catch(() => {});
    await still();
    const back = await where();
    ok(back.at === 'overview' && back.panel === 'pvg-p-work', '★「戻る」と、開いていた板が開いたまま', J(back));
    ok(Math.abs(back.y - before.y) <= 2, '★同じ深さ（読んでいた所）へ戻る', J({ before: before.y, back: back.y }));
    /* 戻ってきたあとで板を閉じ、別の所まで読んでから「進む」で離れて、もう一度戻る。
       「進む」はタブの切り替えを通らないので、書き留めが古いままだと、閉じたはずの板が開いて前の位置へ飛ぶ。 */
    await s.page.keyboard.press('Escape');
    await s.page.waitForFunction(() => !document.querySelector('.pvg-more[aria-expanded="true"]'), { timeout: 8000 }).catch(() => {});
    await s.page.evaluate(() => window.scrollTo({ top: 420, behavior: 'instant' }));
    await still();
    /* 書き留めが今の位置に追いつくまで待つ（時間では待たない） */
    await s.page.waitForFunction(() => { const h = history.state; return !!h && h.pvgOpen === '' && typeof h.pvgY === 'number' && Math.abs(h.pvgY - scrollY) < 1; }, { timeout: 8000 }).catch(() => {});
    const mid = await where();
    ok(mid.at === 'overview' && mid.panel === '' && mid.y > 100 && Math.abs(mid.y - before.y) > 50, '（前提）戻ったあと板を閉じて、別の所まで読む', J({ mid, before: before.y }));
    await s.page.goForward().catch(() => {});
    await s.page.waitForFunction(() => window.PVGlance.at() === 'stay', { timeout: 8000 }).catch(() => {});
    await still();
    const fwd = await where();
    ok(fwd.at === 'stay' && !fwd.open, '「進む」で「ステイ先」へ（面は開き直さない）', J(fwd));
    await s.page.goBack().catch(() => {});
    await s.page.waitForFunction((y) => window.PVGlance.at() === 'overview' && Math.abs(scrollY - y) <= 2, { timeout: 8000 }, mid.y).catch(() => {});
    await still();
    const again = await where();
    ok(again.at === 'overview' && again.panel === '', '★もう一度「戻る」と、閉じた板は閉じたまま（古い書き留めで開け直さない）', J(again));
    ok(Math.abs(again.y - mid.y) <= 2, '★最後に読んでいた所へ戻る（前の位置へ飛ばない）', J({ mid: mid.y, again: again.y }));
    await s.st.ctx.close();
  });

  /* もう「ステイ先」の一覧に居るときは、行き先が無い ＝ 面を閉じるだけ。
     焦点は開いたボタンへ返す（返さないと、キーボードの人はページの頭からやり直しになる）。 */
  await scene('「ステイ先」の一覧に居るときに「ホテル・ステイ」を押す ── 面が閉じ、開いたボタンへ焦点が戻る', async () => {
    const s = await open('phone');
    await go(s, EY + '#stay');
    await s.page.waitForFunction(() => !!window.PVGlance && window.PVGlance.at() === 'stay');
    const { where, still, ready } = tabProbe(s);
    await ready();
    await still();
    const before = await where();
    await s.page.focus('.pvg-tabbar .pvg-add');
    await s.page.keyboard.press('Enter');
    await waitView(s, 'list');
    await s.page.click('.pvc-root [data-pvc-tile="stay"]');
    await s.page.waitForFunction(() => !window.PVContrib.isOpen() && document.querySelector('.pvc-root').hidden, { timeout: 8000 }).catch(() => {});
    await still();
    const after = await where();
    ok(after.at === 'stay' && after.href === EY + '#stay' && !after.open && !after.lock, '面が閉じて、「ステイ先」の一覧のまま', J(after));
    ok(/\bpvg-add\b/.test(after.focus), '★焦点は、開いた「情報を追加」のボタンへ戻る（ページの頭へ落ちない）', J({ focus: after.focus }));
    ok(Math.abs(after.y - before.y) <= 2, 'ページは動かない', J({ before: before.y, after: after.y }));
    await s.st.ctx.close();
  });

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

  /* 「動きを減らす」設定の人には、紙片を1枚も出さない。完了は 見出しの字 と チェックの印 で静かに伝える。
     合図そのものを無くすのではない ── カードには「静かな完了」の印（quiet）が付く。 */
  await scene('動きを減らす設定 ── 紙片を出さず、静かな完了表示', async () => {
    const r = await open('phone', { who: 'a', calm: true });
    await go(r, JAL);
    await api(r, 'work');
    await waitView(r, 'work');
    await r.page.waitForFunction(() => { const n = document.querySelector('.pvc-root [data-pvc-own-row]'); return !!n && !n.hidden; });
    const set = await r.page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    await fill(r, 'stay_nights', '2');
    await tick(r);
    await send(r);
    await waitView(r, 'saved');
    const cues = await cueLog(r);
    const now = await cueNow(r);
    const fc = await focusAt(r);
    const done = await r.page.evaluate(() => {
      const h = document.querySelector('.pvc-root .pvc-saved-h'), sv = h && h.querySelector('svg');
      const b = sv ? sv.getBoundingClientRect() : null;
      return { head: h ? h.textContent : '', mark: !!b && b.width >= 16 && b.height >= 16, moving: document.querySelector('.pvc-root .pvc-saved').getAnimations({ subtree: true }).length };
    });
    ok(set && J(cues) === J(['quiet']) && !now.pop && now.mark === 'quiet', '★動きを減らす設定では、紙片の層を1度も足さない（カードに付くのは「静かな完了」の印だけ）', J({ set, cues, now }));
    ok(done.head === '情報を更新しました' && done.mark && done.moving === 0 && fc.head,
      '★静かな完了表示 ── 見出しの字とチェックの印が出て、焦点は見出しに在る。動くものは1つも無い', J({ done, fc }));
    ok(!!(await r.page.$('.pvc-root .pvc-saved [data-pvc-act="edit"]')) && !!(await r.page.$('.pvc-root .pvc-saved [data-pvc-act="more"]')), '静かな完了表示でも、2つのボタンは同じように在る');
    /* 「在る」だけでは足りない ── 紙片を出さない回も、見出しからキーボードで2つのボタンへ進めること
       （見えない・押せない形で在っても、上の検査は通ってしまう）。 */
    await r.page.keyboard.press('Tab');
    const t1 = await focusAt(r);
    await r.page.keyboard.press('Tab');
    const t2 = await focusAt(r);
    ok(fc.head && t1.inCard && t1.tag === 'button' && t1.text === '自分の回答を見る' && t2.inCard && t2.tag === 'button' && t2.text === 'もう1項目を答える',
      '★静かな完了表示でも、見出しから Tab を2回押すと「自分の回答を見る」→「もう1項目を答える」の順に届く', J({ fc, t1, t2 }));
    await r.st.ctx.close();
  });

  // ═════════════════════════════════════════════════════════════
  // 12. 自分の一覧が読めない会員（エバー航空・390×680）
  // ═════════════════════════════════════════════════════════════
  /* 保存の口は生きているのに、「自分のこれまでの投稿」を読む口だけが落ちている会員（サーバの不調・通信の切れ目）。
     保存できた直後の「自分の回答を見る」は、いま送った内容を見せる ── 読めないからといって空の入力に戻さない。
     空で出すと本人には「消えた」に見え、そこから1つ足して送ると、前に入れた欄が空で上書きされる（実際にそうなっていた）。
     ただし、いま送った内容の写しは 件数 には数えない（件数はサーバが返した数だけ）・読む人が替わったら捨てる。
     読む口は、手元のサーバの「わざと落とす」仕掛けで落とす（場面の終わりに必ず戻す）。 */
  const EVA = '/airlines/eva-air.html';
  /* 自分の一覧の読み直しが終わるまで待つ（「確認しています」の字が消えるまで） */
  const settle = (p) => p.page.waitForFunction(() => { const n = document.querySelector('.pvc-root [data-pvc-wait]'); return !n || !/確認しています/.test(n.textContent); });
  const formFace = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root'), tag = r.querySelector('form [data-pvc-own-row]'), w = r.querySelector('[data-pvc-wait]');
    return { btn: (r.querySelector('form .pvc-send[type="submit"]') || {}).textContent || '', tag: tag ? !tag.hidden : null,
      mine: r.querySelectorAll('form .pvc-label .pvc-mine').length, wait: w && !w.hidden ? w.textContent : '' };
  });
  const listFace = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root'), st = r.querySelector('[data-pvc-state]');
    return { state: st.getAttribute('data-pvc-state'), text: st.hidden ? '' : st.textContent,
      counts: [...r.querySelectorAll('[data-pvc-count]')].filter((n) => !n.hidden).map((n) => n.getAttribute('data-pvc-count') + '：' + n.textContent) };
  });
  /* 同じページを開いたまま、ログインだけを別の会員のものに入れ替える */
  const loginAs = async (p, key) => {
    const s = await (await fetch(`${base}/__local/login?member=${key}`)).json();
    await p.page.evaluate((x) => { localStorage.setItem('sb-local-auth-token', JSON.stringify(x.session)); localStorage.setItem('pv_user', JSON.stringify(x.pv_user)); }, s);
  };

  await scene('自分の勤務の一覧が読めない会員 ── 保存 →「自分の回答を見る」→ 1つ足して送る', async () => {
    await failNext('my_work_months', null, 99);
    const u = await open('phone', { who: 'op' });
    try {
      await go(u, EVA);
      await api(u, 'list');
      await waitView(u, 'counted');
      const l0 = await listFace(u);
      await u.page.click('.pvc-root [data-pvc-tile="work"]');
      await waitView(u, 'work');
      await settle(u);
      const f0 = await formFace(u);
      const ymU = (await vals(u)).ym;
      await pick(u, 'position', 'cap');
      await fill(u, 'block_hours', '55');
      await fill(u, 'stay_nights', '4');
      await tick(u);
      await send(u);
      await waitView(u, 'saved');
      const s1 = await summary(u);
      const c1 = await cueLog(u);
      /* 前提：この場面が見ているのは「読む口だけが落ちていて、保存はできた」回。崩れていたら、下は別のものを見ることになる */
      if (l0.state !== 'fail ok' || !/読み込めませんでした/.test(f0.wait) || s1.head !== '情報を追加しました' || J(c1) !== J(POP)) {
        throw new Error('前提が崩れた（読む口だけを落として保存できた回になっていない）: ' + J({ l0, wait: f0.wait, head: s1.head, c1 }));
      }

      await u.page.click('.pvc-root .pvc-saved [data-pvc-act="edit"]');
      await waitView(u, 'work');
      await settle(u);
      const v1 = await vals(u), f1 = await formFace(u);
      ok(v1.ym === ymU && v1.position === 'cap' && v1.block_hours === '55' && v1.stay_nights === '4' && v1.duty_hours === ''
        && f1.tag === true && f1.btn === '匿名で更新する' && /読み込めませんでした/.test(f1.wait),
        '★自分の勤務の一覧が読めない会員が、保存した直後に「自分の回答を見る」を押すと、いま送った内容が入力に入っている（月・職位・乗務時間・ステイ泊数。空の入力に戻さない）',
        J({ ym: v1.ym, position: v1.position, block_hours: v1.block_hours, stay_nights: v1.stay_nights, duty_hours: v1.duty_hours, f1 }));

      /* そこから1つ足して送る。入力が空で出ていた頃は、ここで前の2つ（乗務時間・ステイ泊数）が空で上書きされていた */
      if (!v1.position) await pick(u, 'position', 'cap');   // 入力が空で出た回（＝上が赤い回）も、先へ進めて保存先を見る
      await fill(u, 'duty_hours', '120');
      await tick(u);
      await send(u);
      await waitView(u, 'saved');
      const s2 = await summary(u);
      const c2 = await cueLog(u);
      const rows = await workRows('eva-air');
      const row = rows.find((x) => `${x.y}-${String(x.m).padStart(2, '0')}` === ymU) || {};
      ok(rows.length === 1 && row.pos === 'cap' && row.block_hours === 55 && row.duty_hours === 120 && row.stay_nights === 4,
        '★そこから1つ足して送っても、前に入れた欄は空で上書きされない（保存先の同じ月に 乗務55時間・勤務120時間・ステイ4泊 が揃う）', J(rows));
      ok(s2.head === '情報を更新しました' && s2.rows.block_hours.v === '55時間' && s2.rows.duty_hours.v === '120時間' && s2.rows.stay_nights.v === '4泊' && J(c2) === J([...POP, ...POP]),
        '足して送った回の見出しは「情報を更新しました」。保存した内容に3つとも出て、合図はその保存で1度（合わせて2度）', J({ head: s2.head, block: s2.rows.block_hours, duty: s2.rows.duty_hours, stay: s2.rows.stay_nights, c2 }));

      /* もう一度「自分の回答を見る」（いま送った内容から起こした、手を付けていない入力ができる）→ 一覧へ戻る */
      await u.page.click('.pvc-root .pvc-saved [data-pvc-act="edit"]');
      await waitView(u, 'work');
      await settle(u);
      await u.page.click('.pvc-root .pvc-prev');
      await waitView(u, 'list');
      await waitView(u, 'counted');
      const l1 = await listFace(u);
      ok(l1.state === 'fail ok' && l1.counts.length === 0 && /取得できませんでした/.test(l1.text) && !/\d\s*件/.test(l1.text),
        '★読めなかった一覧の代わりに、いま送った内容を件数に数えない（「あなたの投稿 N件」を出さず「取得できませんでした」のまま。件数はサーバが返した数だけ）', J(l1));

      /* 読む人が替わる：同じページのまま、別の会員のログインに替わる */
      await loginAs(u, 'pilot');
      await u.page.click('.pvc-root [data-pvc-tile="work"]');
      await waitView(u, 'work');
      await settle(u);
      const v3 = await vals(u), f3 = await formFace(u);
      ok(v3.position === '' && v3.block_hours === '' && v3.duty_hours === '' && v3.stay_nights === '' && f3.tag === false && f3.btn === '匿名で追加する',
        '★読む人が替わったら（同じページのまま別の会員のログインに替わる）、前の人が送った内容を入力に出さない（そのまま送れば、その人の投稿になってしまう）',
        J({ position: v3.position, block_hours: v3.block_hours, duty_hours: v3.duty_hours, stay_nights: v3.stay_nights, f3 }));
    } finally {
      await failOff();
      await u.st.ctx.close();
    }
  });

  /* 上の場面の最後は「入力を開き直したら空で出る」まで。ここは、いま送った内容から起こした入力（手を付けていない）が
     画面に出ているまま、読む人が替わる回 ── もう一方のタブでログアウトした・ログインが切れた・別の会員が入った。
     前の人の値を出したままにすると、(1) そのあと打った字が、捨てた写しへ入って送られない
     （職位が見えている画面で「職位を選んでください」と止まり、選び直しても進めなかった）
     (2) 手を付けずに送ると、前の人の内容が今の人の投稿になる。
     なので、今の人が最初に触れた時（確認のチェック・欄に入る・送る）に入力を作り直す。打った字は必ず保存へ届く。 */
  await scene('控えから起こした入力が出ているまま、読む人が替わる ── チェック・欄に入る・送る のどれが先でも', async () => {
    await failNext('my_work_months', null, 99);
    const u = await open('phone', { who: 'op' });
    /* 送ったあと、保存後の画面か、欄の断り（職位を選んでください 等）のどちらかが出るまで待つ */
    const settled = (p) => p.page.waitForFunction(() => {
      const r = document.querySelector('.pvc-root');
      return !!r.querySelector('[data-pvc-saved]') || [...r.querySelectorAll('.pvc-err')].some((n) => !n.hidden && n.textContent.trim());
    }, { timeout: 20000 }).then(() => true, () => false);
    const face = (p) => p.page.evaluate(() => {
      const r = document.querySelector('.pvc-root'), f = r.querySelector('form[data-pvc-form="work"]'), a = document.activeElement;
      const v = (n) => { const x = f && f.querySelector('[name="' + n + '"]'); return x ? x.value : null; };
      return { saved: !!r.querySelector('[data-pvc-saved]'), position: v('position'), block_hours: v('block_hours'), duty_hours: v('duty_hours'),
        own: f ? f.querySelector('[name="own"]').checked : null, at: a && a.getAttribute ? a.getAttribute('name') || a.tagName.toLowerCase() : '',
        errs: [...r.querySelectorAll('.pvc-err')].filter((n) => !n.hidden && n.textContent.trim()).map((n) => n.id.replace('pvc-e-', '') + '：' + n.textContent.trim()) };
    });
    const months = async () => (await workRows('eva-air')).map((x) => ({ ym: `${x.y}-${String(x.m).padStart(2, '0')}`, pos: x.pos, block: x.block_hours, duty: x.duty_hours })).sort((x, y) => (x.pos < y.pos ? -1 : 1));
    const heldRows = async () => (await q('select payload from public.pv_contrib_pending where airline = $1 and kind = $2 order by id', ['eva-air', 'work'])).rows
      .map((x) => ({ pos: x.payload.position, block: x.payload.block_hours == null ? null : Number(x.payload.block_hours), duty: x.payload.duty_hours == null ? null : Number(x.payload.duty_hours) }));
    /* いま送った内容から起こした、手を付けていない入力を出す（保存 →「自分の回答を見る」）。出ていなければ、下は別のものを見ることになる */
    const fromCopy = async (want) => {
      await send(u);
      await waitView(u, 'saved');
      await u.page.click('.pvc-root .pvc-saved [data-pvc-act="edit"]');
      await waitView(u, 'work');
      await settle(u);
      const f = await face(u), w = (await formFace(u)).wait;
      if (f.position !== want.position || f.block_hours !== want.block_hours || f.duty_hours !== want.duty_hours || !/読み込めませんでした/.test(w)) {
        throw new Error('前提が崩れた（読めない一覧の代わりに、いま送った内容から起こした入力が出ていない）: ' + J({ want, f, w }));
      }
    };
    try {
      await go(u, EVA);
      await api(u, 'work');
      await waitView(u, 'work');
      await settle(u);
      const ymU = (await vals(u)).ym;
      const h0 = await heldRows();

      /* ① チェックが先：会員（運営）の入力が出ているまま、別の会員のログインに替わる → 確認のチェックを入れる */
      await pick(u, 'position', 'cap');
      await fill(u, 'block_hours', '55');
      await tick(u);
      await fromCopy({ position: 'cap', block_hours: '55', duty_hours: '' });
      await loginAs(u, 'c');   // この会社へ、ほかの場面で1件も送らない会員（次の場面の会員の件数を動かさない）
      await tick(u);
      const a1 = await face(u), b1 = await formFace(u);
      ok(a1.position === '' && a1.block_hours === '' && a1.own === true && b1.tag === false && b1.btn === '匿名で追加する',
        '★控えから起こした入力が出ているまま読む人が替わったら、確認のチェックを入れた時に入力を作り直す（前の人の職位・乗務時間を残さない。入れたチェックは消さない）', J({ a1, b1 }));
      await fill(u, 'duty_hours', '80');
      await pick(u, 'position', 'fo');
      await send(u);
      await settled(u);
      const a2 = await face(u), m2 = await months();
      ok(a2.saved && J(m2) === J([{ ym: ymU, pos: 'cap', block: 55, duty: null }, { ym: ymU, pos: 'fo', block: null, duty: 80 }]),
        '★作り直したあとに打った内容は、そのまま保存へ届く（捨てた写しへ入って「職位を選んでください」で止まらない）。前の人の行は変わらず、前の人の値は今の人の行に混ざらない', J({ a2, m2 }));

      /* ② 送るが先：チェックを入れたあとで読む人が替わり、何も触らずに送る */
      if (a2.saved) {
        await u.page.click('.pvc-root .pvc-saved [data-pvc-act="edit"]');
        await waitView(u, 'work');
        await settle(u);
      }
      await tick(u);
      const p3 = await face(u);
      if (p3.position !== 'fo' || p3.duty_hours !== '80' || p3.own !== true) throw new Error('前提が崩れた（②：いま送った内容から起こした入力に、チェックだけを入れた形になっていない）: ' + J(p3));
      await loginAs(u, 'op');
      await send(u);
      await settled(u);
      const a3 = await face(u), m3 = await months(), h3 = await heldRows();
      ok(!a3.saved && a3.position === '' && a3.duty_hours === '' && a3.errs.length === 1 && /^position：/.test(a3.errs[0]) && J(m3) === J(m2) && h3.length === h0.length,
        '★読む人が替わったあと、何も触らずに送っても、前の人の内容は今の人の投稿として保存されない（入力を作り直し、空の職位に「職位を選んでください」と出す。保存先は1行も変わらない）', J({ a3, m3, held: h3.length - h0.length }));

      /* ③ 欄に入るのが先：会員（運営）の入力が出ているまま、ログアウトする（ログインが切れる）→ 欄に入って打つ */
      await pick(u, 'position', 'cap');
      await fill(u, 'block_hours', '60');
      await tick(u);
      await fromCopy({ position: 'cap', block_hours: '60', duty_hours: '' });
      await u.page.evaluate(() => { localStorage.removeItem('sb-local-auth-token'); localStorage.removeItem('pv_user'); });
      await fill(u, 'duty_hours', '90');
      const a4 = await face(u), b4 = await formFace(u);
      ok(a4.position === '' && a4.block_hours === '' && a4.duty_hours === '90' && a4.at === 'duty_hours' && b4.tag === false && b4.btn === '匿名で追加する',
        '★読む人が替わったあと、欄に入った時にも入力を作り直す（打ち始める前に前の人の値が消え、打った字は入った欄にそのまま入る）', J({ a4, b4 }));
      await pick(u, 'position', 'cap');
      await tick(u);
      await send(u);
      await settled(u);
      const a5 = await face(u), m5 = await months(), h5 = await heldRows();
      ok(a5.saved && h5.length === h0.length + 1 && J(h5[h5.length - 1]) === J({ pos: 'cap', block: null, duty: 90 })
        && J(m5) === J([{ ym: ymU, pos: 'cap', block: 60, duty: null }, { ym: ymU, pos: 'fo', block: null, duty: 80 }]),
        '★ログアウトしたあとに打って送った内容は、ログインなしの預かりに、打った分だけで入る（前の人の乗務時間が混ざらない。会員2人の行は変わらない）', J({ a5, held: h5.slice(h0.length), m5 }));
      const cues = await cueLog(u);
      ok(J(cues) === J([...POP, ...POP, ...POP, ...POP]),
        '入力を作り直しただけでは合図は出ない（合図は、保存できた4回に1度ずつ）', J(cues));
    } finally {
      await failOff();
      await u.st.ctx.close();
    }
  });

  /* 質問の項目（通勤・タクシー）でも同じ。こちらはサーバが「足したのか・置き換えたのか」を答えごとに返さないので、
     自分の答えの一覧が読めない会員には、足したのかどうかが分からない ── 見出しは「保存しました」のまま（「追加しました」と言い切らない）。
     保存はできているので、合図は同じ形で1度。 */
  await scene('自分の答えの一覧が読めない会員 ── 質問の項目（通勤・タクシー）', async () => {
    const FOUR = ['commuting_taxi_cost', 'commuting_taxi_where', 'commuting_transport', 'commuting_transport_method'];
    await failNext('my_airline_conditions', null, 99);
    const u = await open('phone', { who: 'pilot' });
    try {
      await go(u, EVA);
      await api(u, 'taxi');
      await waitView(u, 'taxi');
      await settle(u);
      const f0 = await formFace(u);
      if (!/読み込めませんでした/.test(f0.wait)) throw new Error('前提が崩れた（自分の答えの一覧を読む口が落ちていない）: ' + J(f0));
      await pick(u, 'commuting_transport', 'conditional');
      await chip(u, 'commuting_transport_method', 'company_taxi');
      await pick(u, 'commuting_taxi_where', 'within_area');
      await pick(u, 'commuting_taxi_cost', 'company_full');
      await tick(u);
      await send(u);
      await waitView(u, 'saved');
      const s1 = await summary(u);
      const c1 = await cueLog(u);
      ok(s1.head === '保存しました' && J(c1) === J(POP),
        '★質問の項目でも、足したのか置き換えたのか分からない回（自分の答えの一覧が読めない会員）の見出しは「保存しました」。合図は1度だけ出る', J({ head: s1.head, c1 }));
      ok(J(Object.keys(s1.rows).sort()) === J(FOUR) && FOUR.every((k) => s1.rows[k].v && !s1.rows[k].none),
        '★自分の答えの一覧が読めなくても、保存後の画面の「保存した内容」に、いま送った4問が出る（空の一覧にしない）', J(s1.rows));

      await u.page.click('.pvc-root .pvc-saved [data-pvc-act="edit"]');
      await waitView(u, 'taxi');
      await settle(u);
      const v1 = await vals(u), f1 = await formFace(u);
      ok(v1.commuting_transport === 'conditional' && J(v1.commuting_transport_method || []) === J(['company_taxi'])
        && v1.commuting_taxi_where === 'within_area' && v1.commuting_taxi_cost === 'company_full' && f1.mine === 4 && f1.btn === '匿名で更新する',
        '★質問の項目でも「自分の回答を見る」を押すと、いま送った4問が答えの入った形で出る（「あなたの投稿」の札が4つ・ボタンは「匿名で更新する」。空の入力に戻さない）',
        J({ transport: v1.commuting_transport, method: v1.commuting_transport_method, where: v1.commuting_taxi_where, cost: v1.commuting_taxi_cost, f1 }));

      /* そこから1問だけ直して送る */
      const filled = !!v1.commuting_taxi_cost;
      if (!filled) {   // 入力が空で出た回（＝上が赤い回）も、答え直して先へ進める
        await pick(u, 'commuting_transport', 'conditional');
        await chip(u, 'commuting_transport_method', 'company_taxi');
        await pick(u, 'commuting_taxi_where', 'within_area');
      }
      await pick(u, 'commuting_taxi_cost', 'partial');
      await tick(u);
      await send(u);
      await waitView(u, 'saved');
      const s2 = await summary(u);
      const d2 = await condRows('eva-air');
      const one = (k) => (d2[k] || []).length === 1 ? d2[k][0] : {};
      ok(filled && J(Object.keys(s2.rows).sort()) === J(FOUR) && !!s2.rows.commuting_taxi_cost && s2.rows.commuting_taxi_cost.v !== s1.rows.commuting_taxi_cost.v
        && one('commuting_taxi_cost').c === 'partial' && one('commuting_taxi_where').c === 'within_area' && one('commuting_transport').c === 'conditional'
        && J(one('commuting_transport_method').cs) === J(['company_taxi']) && Object.keys(d2).length === 4,
        '★そこから1問だけ直して送っても、ほかの3問は消えない（保存した内容に4問・保存先も1問1行で4問。直した1問だけが変わる）', J({ filled, rows: s2.rows, d2 }));

      /* 上の質問を「ない」へ答え直す → 下の質問の前の答えは、保存した内容に出さない */
      await u.page.click('.pvc-root .pvc-saved [data-pvc-act="edit"]');
      await waitView(u, 'taxi');
      await settle(u);
      await pick(u, 'commuting_transport', 'no');
      await tick(u);
      await send(u);
      await waitView(u, 'saved');
      const s3 = await summary(u);
      ok(J(Object.keys(s3.rows)) === J(['commuting_transport']) && s3.rows.commuting_transport.v !== s1.rows.commuting_transport.v,
        '★一覧が読めない会員でも、上の質問を「ない」に答え直すと、下の質問の前の答えは「保存した内容」に出ない（読めたときと同じ見せ方）', J(s3.rows));

      await u.page.click('.pvc-root .pvc-saved [data-pvc-act="more"]');
      await waitView(u, 'list');
      await waitView(u, 'counted');
      const l1 = await listFace(u);
      ok(l1.state === 'ok fail' && l1.counts.length === 0 && /取得できませんでした/.test(l1.text) && !/\d\s*件/.test(l1.text),
        '★質問の項目でも、読めなかった一覧の代わりに いま送った答えを件数に数えない（「あなたの投稿 N件」を出さない）', J(l1));

      /* ログアウトした（ログインが切れた）あと：同じページのまま、前に送った答えを入力に出さない */
      await u.page.evaluate(() => { localStorage.removeItem('sb-local-auth-token'); localStorage.removeItem('pv_user'); });
      await u.page.click('.pvc-root [data-pvc-tile="taxi"]');
      await waitView(u, 'taxi');
      await settle(u);
      const v4 = await vals(u), f4 = await formFace(u);
      ok(v4.commuting_transport === '' && !v4.commuting_transport_method && f4.mine === 0 && f4.btn === '匿名で追加する',
        '★ログアウトしたあと（ログインが切れたあと）は、同じページのままでも、前に送った答えを入力に出さない', J({ transport: v4.commuting_transport, method: v4.commuting_transport_method, f4 }));
    } finally {
      await failOff();
      await u.st.ctx.close();
    }
  });

  // ═════════════════════════════════════════════════════════════
  // 13. いちばん狭い画面（エバー航空・320×568・ログインなし）
  // ═════════════════════════════════════════════════════════════
  /* ログインなしで保存した直後のカードは、「ログインなしで保存しました。」の断りの箱が入るぶん、いちばん高い。
     幅320×高さ568 では、その箱が2つ目のボタン（もう1項目を答える）を最初の1画面の外へ押し出していた。
     390×680 だけを測っていると、ここは見えない（390 では余りが 100px 以上ある）。 */
  await scene('ログインなしで保存した直後 ── 320×568 でも2つのボタンに届く', async () => {
    const s = await open('small');
    try {
      await go(s, EVA);
      await api(s, 'work');
      await waitView(s, 'work');
      await settle(s);
      /* 月が2けた（10〜12月）だと会社名と月の行が折り返し、カードがいちばん高くなる ＝ 選べるならその月で測る */
      const wide = await s.page.$eval('.pvc-root select[name="ym"]', (n) => ([...n.options].find((x) => /-1[0-2]$/.test(x.value)) || {}).value || '');
      if (wide) { await pick(s, 'ym', wide); await waitView(s, 'work'); await settle(s); }
      await pick(s, 'position', 'fo');
      await fill(s, 'block_hours', '61');
      await tick(s);
      await farWatch(s);
      await send(s);
      await waitView(s, 'saved');
      const sm = await summary(s);
      const reach = await reachOf(s);
      const far = await farOf(s);
      const cues = await cueLog(s);
      if (sm.head !== '情報を追加しました' || !reach.held || J(cues) !== J(POP)) {
        throw new Error('前提が崩れた（ログインなしで保存でき、断りの箱が出た回になっていない）: ' + J({ head: sm.head, held: reach.held, cues }));
      }
      ok(reached(reach),
        '★320×568 でも、ログインなしで保存した直後（断りの箱が在る回）に、スクロールしなくても「自分の回答を見る」「もう1項目を答える」の両方に届く', J({ ym: wide || '（既定の月）', reach }));
      ok(!!far && far.n === 10 && far.still === 0 && far.card.length === 0 && far.sheet.length === 0 && far.parts === 4 && far.over.length === 0,
        '★320×568 でも、紙片は10枚ともカードの中に収まり、散り終わりの位置で見出しの字・チェックの印・2つのボタンのどれにも重ならない', J(far));
    } finally {
      await s.st.ctx.close();
    }
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
