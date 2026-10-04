/* career.js — career.html の画面の切り替えだけ（入口／会社の概要／2社の比較）。
 *
 * ★金額を1つも持たない。数字は全部 HTML に書いてある（gen-career.mjs が SSOT から書く）。
 *   ここがやるのは「どれを見せるか」だけ ＝ このファイルが落ちても、入口はそのまま読める。
 *   通貨の切り替えは currency.js がいつもどおり HTML の円表記を直す（ここは関わらない）。
 *
 * 住所：
 *   career.html                               入口
 *   career.html?airline={slug}                会社の概要
 *   career.html?view=compare&a={slug}&b={slug}  2社の比較
 * 知らない会社・知らない画面は入口へ戻す。同じ会社を2つは選べない。
 *
 * 戻る・進む：画面を移るたびに履歴へ1段積む。会社の選び直しと入れ替えは積まない
 * （戻るを何度も押さないと出られない画面にしない）。
 * 見ていた位置は、送り終えるたびにその段へ残す（戻っても進んでも同じ場所に出る）。
 */
(function () {
  'use strict';
  var root = document.documentElement;

  function boot() {
    var cr = document.getElementById('cr');
    if (!cr) return;

    var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
    var views = cr.querySelectorAll('.cr-view');
    var slugs = [];
    each(views, function (v) { if (v.dataset.view === 'airline') slugs.push(v.dataset.airline); });
    var known = function (s) { return slugs.indexOf(s) >= 0; };

    var DEF = { a: cr.dataset.a, b: cr.dataset.b };
    var cmp = cr.querySelector('.cr-view[data-view="compare"]');
    var sel = { a: document.getElementById('cr-a'), b: document.getElementById('cr-b') };
    var swap = document.getElementById('cr-swap');

    /* タブの名前の後ろ（" | PILOT VALUE"）は、いま付いているものをそのまま使う。 */
    var cut = document.title.lastIndexOf(' | ');
    var SUFFIX = cut >= 0 ? document.title.slice(cut) : '';

    /* 住所 → 画面。fix は「住所のほうを直す必要がある」の印。 */
    function parse(search) {
      var q = new URLSearchParams(search);
      var air = q.get('airline'), view = q.get('view');
      if (air !== null) return known(air) ? { view: 'airline', airline: air } : { view: 'home', fix: true };
      if (view === 'compare') {
        var qa = q.get('a'), qb = q.get('b');
        var a = known(qa) ? qa : null;
        var b = known(qb) && qb !== a ? qb : null;
        if (!a) a = DEF.a !== b ? DEF.a : DEF.b;
        if (!b) b = DEF.b !== a ? DEF.b : DEF.a;
        return { view: 'compare', a: a, b: b, fix: a !== qa || b !== qb };
      }
      return view !== null ? { view: 'home', fix: true } : { view: 'home' };
    }

    function url(st) {
      var q = '';
      if (st.view === 'airline') q = '?airline=' + encodeURIComponent(st.airline);
      if (st.view === 'compare') q = '?view=compare&a=' + encodeURIComponent(st.a) + '&b=' + encodeURIComponent(st.b);
      return location.pathname + q;
    }

    /* 比較の2社を入れ替える。5社ぶんが全部 HTML に在り、見せる2社を選ぶだけ。 */
    function pair(a, b) {
      sel.a.value = a;
      sel.b.value = b;
      each(sel.a.options, function (o) { o.disabled = o.value === b; });
      each(sel.b.options, function (o) { o.disabled = o.value === a; });
      each(cmp.querySelectorAll('.cr-side'), function (side) {
        var want = side.dataset.side === 'a' ? a : b;
        each(side.querySelectorAll('.cr-opt'), function (o) { o.hidden = o.dataset.airline !== want; });
      });
      each(cmp.querySelectorAll('.cr-row, .cr-taxes .cr-tax, .cr-card, .cr-credit'), function (el) {
        var s = el.dataset.airline;
        el.hidden = s !== a && s !== b;
      });
      /* 並びは置き場所そのものを入れ替える。見た目の順だけ変えると、
         読み上げと Tab の順が画面と食い違う。 */
      each(cmp.querySelectorAll('.cr-pair, .cr-taxes, .cr-cards, .cr-credits'), function (box) {
        var ea = null, eb = null;
        each(box.children, function (el) {
          if (el.dataset.airline === a) ea = el;
          if (el.dataset.airline === b) eb = el;
        });
        if (ea && eb) box.insertBefore(ea, eb);
      });
    }

    var state = null;

    function show(st, focus) {
      state = st;
      var cur = null;
      each(views, function (v) {
        var on = v.dataset.view === st.view && (st.view !== 'airline' || v.dataset.airline === st.airline);
        v.hidden = !on;
        if (on) cur = v;
      });
      if (st.view === 'compare') pair(st.a, st.b);
      var h = cur && cur.querySelector('.cr-h1');
      if (!h) return;
      document.title = h.textContent.replace(/\s+/g, ' ').trim() + SUFFIX;
      if (focus) h.focus({ preventScroll: true });
    }

    var keep = function () {
      try { history.replaceState({ y: window.scrollY }, '', location.href); } catch (e) {}
    };
    /* 位置は、送り終えるたびにいまの段へ残す。ブラウザの「戻る」で出るときは
       残す間が無い（知らせが来たときには、もう次の段に居る）ので、押した時だけでは足りない。 */
    var tick = 0;
    window.addEventListener('scroll', function () {
      clearTimeout(tick);
      tick = setTimeout(keep, 90);
    }, { passive: true });

    cr.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[data-go]') : null;
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var u = new URL(a.href, location.href);
      if (u.origin !== location.origin || u.pathname !== location.pathname) return;
      e.preventDefault();
      var st = parse(u.search);
      keep();                                   // 戻ってきたときの位置を、いまの段に残す
      history.pushState({ y: 0 }, '', url(st));
      show(st, true);
      window.scrollTo(0, 0);
    });

    window.addEventListener('popstate', function (e) {
      clearTimeout(tick);                       // 前の画面の位置を、移った先の段へ書かない
      show(parse(location.search), true);
      window.scrollTo(0, (e.state && e.state.y) || 0);
    });

    function repick(a, b) {
      if (a === b) return;
      state = { view: 'compare', a: a, b: b };
      history.replaceState(history.state, '', url(state));
      pair(a, b);
    }
    sel.a.addEventListener('change', function () { repick(sel.a.value, sel.b.value); });
    sel.b.addEventListener('change', function () { repick(sel.a.value, sel.b.value); });
    swap.addEventListener('click', function () { repick(state.b, state.a); });

    /* 位置は自分で戻す（画面を差し替えるので、ブラウザ任せだと別の画面の高さで戻される）。 */
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.addEventListener('pagehide', keep);

    var first = parse(location.search);
    if (first.fix) history.replaceState(history.state, '', url(first));
    show(first, false);
    var y = history.state && history.state.y;
    if (y) window.scrollTo(0, y);
  }

  try { boot(); }
  finally { root.classList.remove('cr-boot'); }
})();
