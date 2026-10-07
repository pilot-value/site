/* career.js — career.html の画面の切り替えだけ
 * （入口／会社の概要とタブ／就航地／数字の詳細／2社の比較／カード保存）。
 *
 * ★金額を1つも持たない。数字は全部 HTML に書いてある（gen-career.mjs が SSOT から書く）。
 *   ここがやるのは「どれを見せるか」だけ ＝ このファイルが落ちても、入口はそのまま読める。
 *   通貨の切り替えは currency.js がいつもどおり HTML の表記を直す（ここは関わらない）。
 *
 * 住所：
 *   career.html                                  入口
 *   career.html?airline={slug}                   会社の概要
 *   career.html?airline={slug}&tab={work|life}   概要の中のタブ（タブを持つ会社だけ）
 *   career.html?airline={slug}&stay={IATA}       就航地
 *   career.html?airline={slug}&d={cap-est|fo-est} 数字の詳細（推定年収）
 *   career.html?view=compare&a={slug}&b={slug}   2社の比較
 *   career.html?view=card&a={slug}[&b={slug}]    カード保存
 * どの会社がタブ・就航地・詳細を持つかは、ここに書かない。HTML に在る画面だけを開く
 * （在る画面の一覧 ＝ section.cr-view と div.cr-tabp）。
 * 知らない値は、いちばん近い画面へ落とす（知らない就航地 → 就航地の一覧・知らないタブ → 概要・
 * 知らない会社 → 入口）。同じ会社を2つは選べない。
 *
 * 戻る・進む：画面を移るたびに履歴へ1段積む。同じ画面の中の選び直し（タブ・比較の2社と入れ替え・
 * カードの会社）は積まない（戻るを何度も押さないと出られない画面にしない）。
 * 見ていた位置は、送り終えるたびにその段へ残す（戻っても進んでも同じ場所に出る）。
 *
 * ほかの部品との約束：
 *   画面を出し終えるたびに #cr で cr:show を出す（detail ＝ いまの状態）。
 *   window.PVCareer.state() / go(状態) / replace(状態)。
 *   ⚠️ PVCareer を作り直さない（career-live.js が後から client を足す）。
 */
(function () {
  'use strict';
  var root = document.documentElement;

  function boot() {
    var cr = document.getElementById('cr');
    if (!cr) return;

    var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
    var views = cr.querySelectorAll('.cr-view');

    /* 在る画面の一覧（HTML から拾う）。 */
    var slugs = [], tabs = {}, stays = {}, dets = {};
    each(views, function (v) {
      var d = v.dataset, s = d.airline;
      if (d.view === 'airline') {
        slugs.push(s);
        tabs[s] = [];
        each(v.querySelectorAll('.cr-tabp'), function (p) { tabs[s].push(p.dataset.tab); });
      }
      if (d.view === 'stay') (stays[s] = stays[s] || []).push(d.stay);
      if (d.view === 'detail') (dets[s] = dets[s] || []).push(d.d);
    });
    var has = function (list, x) { return !!list && list.indexOf(x) >= 0; };
    var known = function (s) { return has(slugs, s); };

    var DEF = { a: cr.dataset.a, b: cr.dataset.b };
    var cmp = cr.querySelector('.cr-view[data-view="compare"]');
    var sel = { a: document.getElementById('cr-a'), b: document.getElementById('cr-b') };
    var swap = document.getElementById('cr-swap');
    var bar = document.querySelector('.mr-top');

    /* タブの名前の後ろ（" | PILOT VALUE"）は、いま付いているものをそのまま使う。 */
    var cut = document.title.lastIndexOf(' | ');
    var SUFFIX = cut >= 0 ? document.title.slice(cut) : '';

    var KEYS = ['airline', 'view', 'tab', 'stay', 'd', 'a', 'b'];
    var blank = function (view) {
      return { view: view, airline: null, tab: null, stay: null, d: null, a: null, b: null };
    };

    /* 状態 → 住所の ? から後ろ。 */
    function query(st) {
      var e = encodeURIComponent;
      if (st.view === 'airline') return '?airline=' + e(st.airline) + (st.tab && st.tab !== 'top' ? '&tab=' + e(st.tab) : '');
      if (st.view === 'stay') return '?airline=' + e(st.airline) + '&stay=' + e(st.stay);
      if (st.view === 'detail') return '?airline=' + e(st.airline) + '&d=' + e(st.d);
      if (st.view === 'compare') return '?view=compare&a=' + e(st.a) + '&b=' + e(st.b);
      if (st.view === 'card') return '?view=card&a=' + e(st.a) + (st.b ? '&b=' + e(st.b) : '');
      return '';
    }
    function url(st) { return location.pathname + query(st); }
    /* いまの住所を正しい形へ直すときは、ここが知らない引数（ほかの部品のもの）を落とさない。 */
    function mend(st) {
      var out = new URLSearchParams(query(st));
      new URLSearchParams(location.search).forEach(function (v, k) { if (KEYS.indexOf(k) < 0) out.append(k, v); });
      var s = out.toString();
      return location.pathname + (s ? '?' + s : '');
    }

    /* 住所 → 状態。 */
    function read(q) {
      var st, air = q.get('airline'), view = q.get('view');
      if (air !== null) {
        if (!known(air)) return blank('home');
        st = blank('airline');
        st.airline = air;
        var stay = q.get('stay'), d = q.get('d'), tab = q.get('tab');
        if (stay !== null) {
          stay = stay.toUpperCase();
          if (has(stays[air], stay)) { st.view = 'stay'; st.stay = stay; return st; }
          /* 知らない就航地 → 就航地の一覧が在るタブ。 */
          if (stays[air]) tab = 'life';
        } else if (d !== null && has(dets[air], d)) {
          st.view = 'detail'; st.d = d; return st;
        }
        if (tabs[air].length) st.tab = has(tabs[air], tab) ? tab : tabs[air][0];
        return st;
      }
      if (view === 'compare' || view === 'card') {
        var qa = q.get('a'), qb = q.get('b');
        var a = known(qa) ? qa : null;
        var b = known(qb) && qb !== a ? qb : null;
        st = blank(view);
        if (view === 'card') {
          if (!a) return blank('home');
        } else {
          if (!a) a = DEF.a !== b ? DEF.a : DEF.b;
          if (!b) b = DEF.b !== a ? DEF.b : DEF.a;
        }
        st.a = a; st.b = b;
        return st;
      }
      return blank('home');
    }
    /* fix は「住所のほうを直す必要がある」の印（この画面の鍵だけを比べる。ほかの鍵は見ない）。 */
    function parse(search) {
      var q = new URLSearchParams(search), st = read(q);
      var want = new URLSearchParams(query(st)), fix = false;
      KEYS.forEach(function (k) { if (q.get(k) !== want.get(k)) fix = true; });
      st.fix = fix;
      return st;
    }
    /* よそから渡された状態（欠けていてもよい）を、在る画面へ整える。 */
    function tidy(st) {
      st = st || {};
      var q = new URLSearchParams();
      KEYS.forEach(function (k) { if (st[k] != null && st[k] !== '') q.set(k, st[k]); });
      return read(q);
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
      each(cmp.querySelectorAll('.cr-row, .cr-taxes .cr-tax, .cr-card, .cr-rentb, .cr-credit'), function (el) {
        var s = el.dataset.airline;
        el.hidden = s !== a && s !== b;
      });
      /* 並びは置き場所そのものを入れ替える。見た目の順だけ変えると、
         読み上げと Tab の順が画面と食い違う。
         同じ会社の要素が続けて在っても、まとめて順のまま運ぶ。
         家賃の箱（.cr-rentbs）も同じ ── 街ごとの箱を、選んだ順に置き直すだけ。 */
      each(cmp.querySelectorAll('.cr-pair, .cr-taxes, .cr-cards, .cr-rentbs, .cr-credits'), function (box) {
        var ea = [], eb = null;
        each(box.children, function (el) {
          if (el.dataset.airline === a) ea.push(el);
          if (el.dataset.airline === b && !eb) eb = el;
        });
        if (eb) ea.forEach(function (el) { box.insertBefore(el, eb); });
      });
      /* カード保存への入口は、いま並べている2社を連れていく（HTML には既定の2社が書いてある）。 */
      var to = document.getElementById('cr-to-card');
      if (to) to.setAttribute('href', to.getAttribute('href').split('?')[0] + query({ view: 'card', a: a, b: b }));
    }

    var state = null, shown = null;
    var copy = function () {
      var o = blank(state.view);
      KEYS.forEach(function (k) { if (k !== 'view') o[k] = state[k] == null ? null : state[k]; });
      return o;
    };

    function show(st, focus) {
      state = st;
      var cur = null;
      each(views, function (v) {
        var d = v.dataset;
        var on = d.view === st.view
          && (!d.airline || d.airline === st.airline)
          && (d.view !== 'stay' || d.stay === st.stay)
          && (d.view !== 'detail' || d.d === st.d);
        v.hidden = !on;
        if (on) cur = v;
      });
      var label = '';
      if (cur && st.view === 'airline' && st.tab) {
        each(cur.querySelectorAll('.cr-tabp'), function (p) { p.hidden = p.dataset.tab !== st.tab; });
        each(cur.querySelectorAll('.cr-tab'), function (t) {
          if (t.dataset.tab === st.tab) {
            t.setAttribute('aria-current', 'page');
            if (st.tab !== 'top') label = ' ' + t.textContent.replace(/\s+/g, ' ').trim();
          } else t.removeAttribute('aria-current');
        });
      }
      if (st.view === 'compare') pair(st.a, st.b);
      var moved = cur !== shown;
      shown = cur;
      var h = cur && cur.querySelector('.cr-h1');
      if (h) {
        document.title = h.textContent.replace(/\s+/g, ' ').trim() + label + SUFFIX;
        /* 画面が替わったときだけ見出しへ。タブの切替では、押したタブに焦点を残す。 */
        if (focus && moved) h.focus({ preventScroll: true });
      }
      try { cr.dispatchEvent(new CustomEvent('cr:show', { detail: copy() })); } catch (e) {}
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

    /* 同じ画面の中の選び直しか（履歴を積まない）。 */
    function same(st) {
      if (!state || st.view !== state.view) return false;
      if (st.view === 'airline') return st.airline === state.airline;
      return st.view === 'compare' || st.view === 'card';
    }

    /* 画面を移る（履歴へ1段積んで、頭から見せる）。 */
    function go(st) {
      clearTimeout(tick);
      keep();                                   // 戻ってきたときの位置を、いまの段に残す
      history.pushState({ y: 0 }, '', url(st));
      show(st, true);
      window.scrollTo(0, 0);
    }
    /* 同じ画面の中で選び直す（履歴は積まない・位置は動かさない）。 */
    function swapIn(st) {
      clearTimeout(tick);
      try { history.replaceState({ y: window.scrollY }, '', url(st)); } catch (e) {}
      show(st, true);
    }
    /* タブを替えたあと：写真とタブはそのままの場所に残す。
       タブより下まで読んでいたときだけ、タブの並びを画面の頭へ戻す（新しい中身を頭から読める）。 */
    function settle() {
      var nav = shown && shown.querySelector('.cr-tabs');
      if (!nav) return;
      var edge = (bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0) + 8;
      var top = nav.getBoundingClientRect().top;
      if (top < edge) window.scrollTo(0, Math.max(0, window.scrollY + top - edge));
      keep();
    }

    cr.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[data-go]') : null;
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var u = new URL(a.href, location.href);
      if (u.origin !== location.origin || u.pathname !== location.pathname) return;
      e.preventDefault();
      var st = parse(u.search);
      if (!same(st)) return go(st);
      var tabbed = st.view === 'airline' && st.tab !== state.tab;
      swapIn(st);
      if (tabbed) settle();
    });

    window.addEventListener('popstate', function (e) {
      clearTimeout(tick);                       // 前の画面の位置を、移った先の段へ書かない
      show(parse(location.search), true);
      window.scrollTo(0, (e.state && e.state.y) || 0);
    });

    function repick(a, b) {
      if (a === b) return;
      var st = blank('compare');
      st.a = a; st.b = b;
      swapIn(st);
    }
    sel.a.addEventListener('change', function () { repick(sel.a.value, sel.b.value); });
    sel.b.addEventListener('change', function () { repick(sel.a.value, sel.b.value); });
    swap.addEventListener('click', function () { repick(state.b, state.a); });

    /* ほかの部品の入口。⚠️ オブジェクトを作り直さない（後から読まれる部品が口を足す）。 */
    var api = window.PVCareer = window.PVCareer || {};
    api.state = copy;
    api.go = function (st) { go(tidy(st)); };
    api.replace = function (st) { swapIn(tidy(st)); };

    /* 位置は自分で戻す（画面を差し替えるので、ブラウザ任せだと別の画面の高さで戻される）。 */
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.addEventListener('pagehide', keep);

    var first = parse(location.search);
    if (first.fix) history.replaceState(history.state, '', mend(first));
    show(first, false);
    var y = history.state && history.state.y;
    if (y) window.scrollTo(0, y);
  }

  try { boot(); }
  finally { root.classList.remove('cr-boot'); }
})();
