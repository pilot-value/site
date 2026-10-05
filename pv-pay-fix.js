/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — pv-pay-fix.js
   提出した給与に「手取り ＞ 総支給」の月がある会員へ、出し直しのお願いを出す

   なぜ要るか（2026-10-05）:
     手取りが総支給の何倍もある月が、フォームもサーバも素通りして入った
     （どこも2つの額を比べていなかった）。入口は同じ日に塞いだが、すでに入った行を
     こちらで書き換えることはしない ── 直せるのは本人だけ。だから本人の画面に、
     直るまで出し続ける（オーナー判断＝メッセージだけ。行も閲覧もそのまま）。

   ★誰かを名指しする仕掛けではない。
     見るのは「ログイン中の本人の提出」だけ（my_pay_reports() は本人の行しか返さない）。
     線を超えた月がある会員には、誰にでも同じ板が出る。
     ⚠️ ここに会員を書き足さない（公開リポジトリ）。

   ★線は1本 ──  手取り ＞ 総支給 × 1.05
     同じ線を持っているのは4か所。1つだけ動かすと
     「画面は通るのにサーバで落ちる」「直したのにお願いが消えない」になる。
       ・給与フォーム    pay-report.html / en/pay-report.html の netOver()
       ・サーバの検品    db/pay-reports.sql の pv_validate_pay_payload()
       ・ここ            isBad()
       ・オーナーの点検  db/usage.mjs の「手取りが総支給より多い」

   ★金額は1文字も出さない。出すのは対象月と社名だけ（MY PAGE の一覧と同じ決まり）。

   ★通信を増やさない
       ・未ログイン …… 何も投げない・何も出さない
       ・MY PAGE ……… ページが既に引いている1回（window.pvMyPayReports）を借りる。
                       ⚠️ ここで直に rpc('my_pay_reports') を呼ばない
                          （assert-my-posts.mjs が「1回だけ」を見ている）
       ・それ以外 …… 「問題なし」だった答えだけを端末に24時間控える（KEY）。
                       控えが新しければ投げない。
                       **問題があった人は控えず、毎回読み直す**
                       ＝ 出し直した次の画面で必ず消える（古い板が残らない）。
                       控えに入るのは会員の ID と時刻だけ。会社も月も金額も入れない。
   ★クライアントはページの `sb` を借りる。2つ目を作らない（actual-pay.js の sb0() と同じ）。
   ★見た目は自分で <style> を入れる。既存の CSS に足すと、古い CSS が残る最大4時間の
     あいだ、下地も罫線も無い素の文字が画面の上に出る（2026-09-15 に同じ形で踏んだ）。
     色は pv-tokens.css の変数。赤だけは変数が無いので、給与フォームの注意（.pd-warn）と
     同じ値をこの板の中だけの変数（--pf-*）に写してある。
════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';
  if (w.PVPayFix) return;

  var EN  = /^\/en\//.test(location.pathname);
  var KEY = 'pv_pay_fix';
  var TTL = 24 * 60 * 60 * 1000;
  /* 並べるのは新しい順に6つまで。7つ目から先は、上を直すと繰り上がって出る。 */
  var MAX = 6;
  /* pv-airlines.json はこのファイルと同じ階層にある。ページからの相対で引くと
     /en/ の下で 404 になるので、自分の置き場所から解く（読み込み時にしか取れない）。 */
  var SELF = (d.currentScript && d.currentScript.src) || '';
  var CLEAN = {};

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];
  var T = EN ? {
    title: 'One of your pay reports needs a second look',
    sub:   'Net pay is higher than gross pay. Submit the same airline and month again and it will replace the earlier report.',
    cta:   'Resubmit this month anonymously',
    other: 'Other',
    month: function (y, m) { return (MONTHS[m - 1] || '') + ' ' + y; }
  } : {
    title: '提出した給与に、確認が必要な月があります',
    sub:   '手取りが総支給より多くなっています。同じ会社・同じ月でもう一度出すと、上書きされます。',
    cta:   'この月を匿名で出し直す',
    other: 'その他',
    month: function (y, m) { return y + '年' + m + '月分'; }
  };

  /* ★線。上の4か所と同じ式。どちらかが無い行は見ない（サーバと同じ）。 */
  function isBad(r) {
    var g = Number(r && r.gross_monthly), n = Number(r && r.net_pay_actual);
    return g > 0 && n > 0 && n > g * 1.05;
  }

  function pick(rows) {
    var seen = {}, out = [];
    rows.forEach(function (r) {
      if (!isBad(r)) return;
      var y = Number(r.period_year), m = Number(r.period_month);
      if (!(y > 2000) || !(m >= 1 && m <= 12)) return;
      var k = [r.airline, String(r.airline_other || '').toLowerCase(), y, m].join('|');
      if (seen[k]) return;
      seen[k] = 1;
      out.push(r);
    });
    out.sort(function (a, b) {
      return (b.period_year * 12 + b.period_month) - (a.period_year * 12 + a.period_month);
    });
    return out.slice(0, MAX);
  }

  /* ページが作ったクライアント。インラインの `const sb` は window には生えないので
     裸の名前で読む（無い画面では ReferenceError になるので包む）。 */
  function client() {
    try { return (typeof sb !== 'undefined' && sb && typeof sb.rpc === 'function') ? sb : null; }
    catch (e) { return null; }
  }

  function cleanCached(uid) {
    try {
      var c = JSON.parse(localStorage.getItem(KEY) || 'null');
      var age = c ? Date.now() - Number(c.t) : -1;
      return !!c && c.u === uid && age >= 0 && age < TTL;
    } catch (e) { return false; }
  }
  function rememberClean(uid) {
    try { localStorage.setItem(KEY, JSON.stringify({ u: uid, t: Date.now() })); } catch (e) {}
  }
  function forget() { try { localStorage.removeItem(KEY); } catch (e) {} }

  async function load(uid) {
    var c = client();
    if (!c) return null;
    /* MY PAGE。pv-reunlock.js の控えを通す＝通信は増えない。 */
    if (typeof w.pvMyPayReports === 'function') return await w.pvMyPayReports(c, uid);
    if (cleanCached(uid)) return CLEAN;
    var res = await c.rpc('my_pay_reports');
    return (res && !res.error && res.data) || null;
  }

  async function airlineNames() {
    try {
      var r = await fetch(SELF ? new URL('pv-airlines.json', SELF).href : 'pv-airlines.json');
      var j = r.ok ? await r.json() : null;
      return (j && j.airlines) || {};
    } catch (e) { return {}; }
  }

  function otherName(r) { return String(r.airline_other || '').trim(); }

  function nameOf(r, names) {
    if (!r.airline || r.airline === 'other') return otherName(r) || T.other;
    var a = names[r.airline];
    return (a && (EN ? a.en : a.ja)) || r.airline;
  }

  /* 上書きされるのは「同じ会社・同じ月」だけ（サーバの鍵が 会社＋自由入力の社名＋年＋月）。
     だから会社と月の両方をフォームへ渡す ── 渡さないとフォームは必ず「前月」で開き、
     月が替わったあとに来た人は別の月へ出して、お願いが消えないままになる。
     一覧に無い会社は社名そのものを渡す（フォームの ?airline= が、一覧に無い値を
     「その他」＋社名の欄へ入れる）。 */
  function hrefOf(r) {
    var a = (r.airline && r.airline !== 'other') ? r.airline : (otherName(r) || 'other');
    var ym = r.period_year + '-' + ('0' + r.period_month).slice(-2);
    return 'pay-report.html?airline=' + encodeURIComponent(a) + '&ym=' + ym + '#ps';
  }

  function track(name, n) {
    try {
      if (typeof w.gtag !== 'function') return;
      var p = { page: (location.pathname.split('/').pop() || '').replace(/\.html$/, ''),
                lang: EN ? 'en' : 'ja' };
      if (n != null) p.months = n;
      w.gtag('event', name, p);
    } catch (e) {}
  }
  /* 「見た」は1回の訪問につき1回だけ数える（画面を移るたびに増やさない）。 */
  function trackShown(n) {
    try {
      if (sessionStorage.getItem(KEY + '_seen')) return;
      sessionStorage.setItem(KEY + '_seen', '1');
    } catch (e) {}
    track('pay_fix_shown', n);
  }

  var CSS = ''
    + '.pv-fix{--pf-ink:#9c3535;--pf-bg:rgba(214,92,92,.08);--pf-line:rgba(214,92,92,.3);'
    +   '--pf-shadow:0 1px 2px rgba(156,53,53,.05),0 10px 26px -16px rgba(156,53,53,.22);'
    +   'min-width:0;margin:0 0 var(--pv-s-3);padding:var(--pv-s-2) 20px;'
    +   'border:1px solid var(--pf-line);border-left:3px solid var(--pf-ink);border-radius:var(--pv-r);'
    +   'background:var(--pf-bg);box-shadow:var(--pf-shadow);color:var(--pv-ink)}'
    + '[data-theme="dark"] .pv-fix{--pf-ink:#f0b8b8;--pf-bg:rgba(214,92,92,.1);--pf-line:rgba(214,92,92,.32);'
    +   '--pf-shadow:0 1px 2px rgba(0,0,0,.3),0 10px 26px -16px rgba(0,0,0,.6)}'
    + '.pv-fix-hd{display:flex;gap:10px;align-items:flex-start}'
    + '.pv-fix-ic{flex:none;width:20px;height:20px;margin-top:1px;color:var(--pf-ink)}'
    + '.pv-fix-t{margin:0;font-size:.95rem;font-weight:800;line-height:1.45;letter-spacing:-.01em;color:var(--pf-ink)}'
    + '.pv-fix-s{margin:6px 0 0;font-size:.82rem;line-height:1.7;color:var(--pv-ink-2)}'
    + '.pv-fix-l{list-style:none;margin:var(--pv-s-2) 0 0;padding:0;display:grid;gap:var(--pv-s-1)}'
    + '.pv-fix-i{display:flex;flex-wrap:wrap;gap:var(--pv-s-1) var(--pv-s-2);align-items:center;justify-content:space-between;'
    +   'padding:10px 12px 10px 16px;border:1px solid var(--pv-line);border-radius:var(--pv-r-sm);background:var(--pv-surface)}'
    + '.pv-fix-w{min-width:0;font-size:.86rem;line-height:1.5;color:var(--pv-ink);overflow-wrap:anywhere}'
    + '.pv-fix-w b{font-weight:800}'
    + '.pv-fix-n{color:var(--pv-ink-2)}'
    + '.pv-fix-n::before{content:"\\00b7";margin:0 .5em;color:var(--pv-ink-3)}'
    + '.pv-fix-b{flex:none;display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;'
    +   'border-radius:999px;font-size:.82rem;font-weight:800;line-height:1.2;text-decoration:none;white-space:nowrap;'
    +   'color:var(--pv-cta-dark-ink);background:var(--pv-cta-dark);'
    +   'transition:transform .18s var(--pv-ease),opacity .18s var(--pv-ease)}'
    + '.pv-fix-b:hover{background:var(--pv-cta-dark-hover);color:var(--pv-cta-dark-ink);transform:translateY(-1px)}'
    + '.pv-fix-b:focus-visible{outline:2px solid var(--pf-ink);outline-offset:3px}'
    + '.pv-fix-b:active{transform:translateY(0) scale(.98);opacity:.88}'
    + '@media (max-width:560px){.pv-fix{padding:var(--pv-s-2)}'
    +   '.pv-fix-i{flex-direction:column;align-items:stretch;padding:12px}'
    +   '.pv-fix-b{white-space:normal;text-align:center}}'
    + '@media (prefers-reduced-motion:reduce){.pv-fix-b{transition:none}}';

  var ICON = '<svg class="pv-fix-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>'
    + '<line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

  function css() {
    if (d.getElementById('pv-pay-fix-css')) return;
    var s = d.createElement('style');
    s.id = 'pv-pay-fix-css';
    s.textContent = CSS;
    d.head.appendChild(s);
  }

  function el(tag, cls, text) {
    var e = d.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* ★社名は textContent で入れる（一覧に無い会社の名前は本人が打った文字列）。 */
  function render(bad, names) {
    var main = d.querySelector('.mr-main');
    if (!main || d.getElementById('pv-pay-fix')) return false;
    css();
    var box = el('section', 'pv-fix pv-no-cur');
    box.id = 'pv-pay-fix';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-labelledby', 'pv-pay-fix-t');

    var hd = el('div', 'pv-fix-hd');
    hd.innerHTML = ICON;                       // 定数の絵だけ。外から来た文字は通さない
    var tx = el('div');
    var t = el('p', 'pv-fix-t', T.title);
    t.id = 'pv-pay-fix-t';
    tx.appendChild(t);
    tx.appendChild(el('p', 'pv-fix-s', T.sub));
    hd.appendChild(tx);
    box.appendChild(hd);

    var ul = el('ul', 'pv-fix-l');
    bad.forEach(function (r) {
      var li = el('li', 'pv-fix-i');
      var what = el('span', 'pv-fix-w');
      what.appendChild(el('b', '', T.month(r.period_year, r.period_month)));
      what.appendChild(el('span', 'pv-fix-n', nameOf(r, names)));
      var a = el('a', 'pv-fix-b', T.cta);
      a.href = hrefOf(r);
      a.addEventListener('click', function () { track('pay_fix_click'); });
      li.appendChild(what);
      li.appendChild(a);
      ul.appendChild(li);
    });
    box.appendChild(ul);

    /* 置き場所は本文のいちばん上。錠前の案内（pv-gates.js の #mr-gate）が
       開いていたら、その下 ── あちらは「いま押した錠前の説明」なので先に読ませる。 */
    var gate = d.getElementById('mr-gate');
    if (gate && gate.parentNode === main) main.insertBefore(box, gate.nextSibling);
    else main.insertBefore(box, main.firstChild);
    return true;
  }

  async function run() {
    var session = null;
    try { session = await w.PV_SESSION; } catch (e) {}
    var uid = session && session.user && session.user.id;
    if (!uid) return 0;

    var data = await load(uid);
    if (data === CLEAN) return 0;
    /* 読めなかったときは出さない・控えない（「問題なし」と決めつけない）。 */
    if (!data || data.ok === false || !Array.isArray(data.reports)) return 0;

    var bad = pick(data.reports);
    if (!bad.length) { rememberClean(uid); return 0; }
    forget();
    if (!render(bad, await airlineNames())) return 0;
    trackShown(bad.length);
    return bad.length;
  }

  /* ready … 板を出し終えた（または出さないと決めた）ときに、出した月の数で決着する。
     検査はこれを待つ（時間で待たない）。 */
  w.PVPayFix = {
    KEY: KEY,
    isBad: isBad,
    ready: run().catch(function () { return 0; })
  };
})(window, document);
