/* 主要5社の会社ページの最上部（.pvg）の動き ── 見せる・隠す・切り替えるだけ。
   ⚠️ ここに金額を書かない。額は全部 HTML に在る（通貨切替と check-salary.mjs がそのまま読める）。
   ⚠️ 直したら node gen-airline-glance.mjs（HTML が読む ?v= を付け直す）。
   板の開閉は hidden 属性で行う ＝ career-live.js がそれを見て、見えるようになった実データの欄を取りに行く。

   タブ（#pvg-tabs を持つページだけ）── 見本の6つ。
     ・どの塊がどのタブに出るかは HTML の data-pvg-pane。ここは <body> に pvg-at-<タブ> を1つ付けるだけ
       （隠すのは pv-glance.css）。このファイルが動かなければ印が付かない ＝ 中身は全部出たまま。
     ・選んだタブは住所の # に残す（概要は # なし）。押すたびに履歴を1段積む ＝ 戻る・進む・読み直しで同じタブ。
     ・window.PVGlance = { go(tab), at() }。airline-reviews-ui.js が古い名前（reviews／salary…）で呼んでくる。 */
(function (w, d) {
  'use strict';
  var root = d.querySelector('.pvg');
  if (!root) return;
  var calm = !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var HEAD = 72;                                   // 固定ヘッダーの高さ

  function glide(dy) {
    if (!dy) return;
    try { w.scrollBy({ top: dy, behavior: calm ? 'auto' : 'smooth' }); } catch (e) { w.scrollBy(0, dy); }
  }

  /* ── 1) 勤務・待遇・暮らしの板（開くのは1つだけ）────────── */
  var mores = [].slice.call(root.querySelectorAll('.pvg-more[aria-controls]'));
  function panelOf(btn) { return d.getElementById(btn.getAttribute('aria-controls')); }
  function set(btn, open) {
    var p = panelOf(btn);
    if (!p) return;
    p.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    var cell = btn.closest('.pvg-cell');
    if (cell) cell.classList.toggle('is-open', open);
  }
  function openOnly(btn) {
    mores.forEach(function (b) { if (b !== btn) set(b, false); });
    set(btn, true);
    /* 板の頭が画面の外なら、見える所まで寄せる（板ぜんぶは追わない。読み始めが見えれば足りる） */
    var p = panelOf(btn);
    if (!p) return;
    var r = p.getBoundingClientRect(), need = Math.min(r.height, 240);
    var room = w.innerHeight - r.top;
    if (room < need) glide(need - room + 16);
    else if (r.top < HEAD) glide(r.top - HEAD - 12);
  }
  function current() {
    for (var i = 0; i < mores.length; i++) if (mores[i].getAttribute('aria-expanded') === 'true') return mores[i];
    return null;
  }

  /* ── 1.5) タブ ────────────────────────────────────────── */
  var bar = d.getElementById('pvg-tabs');
  var links = bar ? [].slice.call(bar.querySelectorAll('[data-pvg-tab]')) : [];
  var TABS = links.map(function (a) { return a.getAttribute('data-pvg-tab'); });
  var OPEN = { pay: 'benefits', work: 'work', life: 'living' };   // そのタブでは、この板が開いたまま本文になる（gen-airline-glance.mjs の CELL_TAB と同じ対）
  var at = '';
  function fire() {
    /* 見えるようになった実データの欄を、career-live.js に取りに行かせる */
    try { d.body.dispatchEvent(new CustomEvent('cr:show', { bubbles: true })); } catch (e) { /* 古いブラウザ */ }
  }
  function show(tab) {
    if (TABS.indexOf(tab) < 0) tab = TABS[0];
    at = tab;
    TABS.forEach(function (t) { d.body.classList.toggle('pvg-at-' + t, t === tab); });
    links.forEach(function (a) {
      if (a.getAttribute('data-pvg-tab') === tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    mores.forEach(function (b) { set(b, b.getAttribute('aria-controls') === 'pvg-p-' + OPEN[tab]); });
    /* 狭い画面では帯が横に流れる。選んだタブが帯の外に居たら、見える所まで寄せる（ページは動かさない） */
    links.forEach(function (a) {
      if (a.getAttribute('data-pvg-tab') !== tab) return;
      var r = a.getBoundingClientRect(), br = bar.getBoundingClientRect();
      if (r.left < br.left) bar.scrollLeft -= br.left - r.left + 16;
      else if (r.right > br.right) bar.scrollLeft += r.right - br.right + 16;
    });
    fire();
  }
  /* 帯が画面の上に貼り付いているとき（＝ページの途中で押したとき）は、切り替えた面の頭を帯のすぐ下へ持ってくる。
     ページの頭に居るときは動かさない。面の中身が入れ替わるので、滑らせずに置く。 */
  function toTop() {
    var box = bar.closest('.pvg-tabbar') || bar, hero = d.querySelector('.pvg-hero');
    if (!hero) return;
    var y = hero.getBoundingClientRect().bottom + w.pageYOffset - parseFloat(w.getComputedStyle(box).top || 0);
    if (w.pageYOffset > y) w.scrollTo(0, Math.max(0, y));
  }
  /* 住所の # から、開くタブと寄る先を決める。
     # がタブの名前ならそのタブ。ページの中の id なら、その要素が出ているタブ（今のタブに出ていれば今のまま）。 */
  function fromHash() {
    var id = '';
    try { id = decodeURIComponent(String(location.hash || '').replace(/^#/, '')); } catch (e) { id = ''; }
    if (!id) return { tab: TABS[0], el: null };
    if (TABS.indexOf(id) >= 0) return { tab: id, el: null };
    var el = d.getElementById(id);
    if (!el) return { tab: at || TABS[0], el: null };
    var ok = TABS.slice();
    for (var n = el; n && n.getAttribute; n = n.parentNode) {
      var p = n.getAttribute('data-pvg-pane');
      if (p) ok = ok.filter(function (t) { return (' ' + p + ' ').indexOf(' ' + t + ' ') >= 0; });
    }
    return { tab: ok.indexOf(at) >= 0 ? at : ok[0] || TABS[0], el: el };
  }
  function near(el) {
    var box = bar.closest('.pvg-tabbar') || bar;
    w.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + w.pageYOffset - HEAD - box.offsetHeight - 12));
  }
  function state(extra) {
    var o = {}, s = w.history.state, k;
    if (s && typeof s === 'object') for (k in s) o[k] = s[k];
    for (k in extra) o[k] = extra[k];
    return o;
  }
  /* 人が選んだとき。履歴を1段積む（同じタブを押し直したときは積まない）。 */
  function go(tab) {
    if (!bar) return false;
    if (!tab) tab = TABS[0];
    if (TABS.indexOf(tab) < 0) return false;
    if (tab !== at) {
      try {
        w.history.replaceState(state({ pvgY: w.pageYOffset }), '');
        w.history.pushState({ pvg: tab }, '', tab === TABS[0] ? location.pathname + location.search : '#' + tab);
      } catch (e) { /* 履歴に書けなくても、切り替えはする */ }
      show(tab);
    }
    toTop();
    return true;
  }
  if (bar) {
    w.PVGlance = { go: go, at: function () { return at; } };
    var first = fromHash();
    show(first.tab);
    /* 開いた時点では全部の節が出ていたので、ブラウザが寄った先はずれている。隠したあとで寄り直す */
    if (first.el) near(first.el);
    w.addEventListener('popstate', function (e) {
      var r = fromHash();
      if (r.tab === at) return;
      show(r.tab);
      var y = e.state && typeof e.state.pvgY === 'number' ? e.state.pvgY : null;
      if (y !== null) w.scrollTo(0, y); else toTop();
    });
    /* ページの中の id への移動（別のタブに在る節へのリンク） */
    w.addEventListener('hashchange', function () {
      var r = fromHash();
      if (r.tab !== at) show(r.tab);
      if (r.el) near(r.el);
    });
  }

  /* ── 2) タブへ（口コミ・募集要項）────────────────────────
     ⚠️ その名前のタブが無い会社がある（JAL・ANA の募集要項は「企業トップ」の面の下に在る。
        タブは airline-reviews-ui.js が節の札の言葉から作るので、会社ごとに本数が違う）。
        無いタブへ切り替えると、どの面も選ばれない ＝ ページの中身がぜんぶ消える。
        無い時は切り替えず、同じ面の中のその節へ寄る。 */
  var SEC = { jobs: /募集要項|採用情報/ };
  function toTab(tab) {
    /* タブを持つページ：その名前のタブが在ればそこへ。無い名前（募集要項）は、概要の中のその節へ寄る。 */
    if (bar) {
      if (TABS.indexOf(tab) >= 0) return go(tab);
      if (!SEC[tab]) return false;
      go(TABS[0]);
      var hh = d.querySelectorAll('.glass h2');
      for (var j = 0; j < hh.length; j++) {
        if (!SEC[tab].test(hh[j].textContent) || hh[j].closest('.pvg')) continue;
        glide(hh[j].closest('.glass').getBoundingClientRect().top - HEAD - (bar.closest('.pvg-tabbar') || bar).offsetHeight - 12);
        return true;
      }
      return false;
    }
    var ui = w.PVReviewUI;
    if (!ui || typeof ui.switchTab !== 'function') return false;
    var nav = d.getElementById('airline-tab-nav');
    if (nav && nav.querySelector('.airline-tab-btn[data-tab="' + tab + '"]')) {
      ui.switchTab(tab);
      /* タブの帯は画面の上に貼り付く（sticky）。ページの下のほうで押すと帯はもう貼り付いていて、
         帯の位置を見ても動く量は 0 ＝ 切り替えた面の途中か、その下の何も無い所が出る。
         帯のすぐ下に在る本文の箱の頭を、帯の下へ寄せる。 */
      var body = nav.nextElementSibling;
      glide(body ? body.getBoundingClientRect().top - HEAD - nav.offsetHeight : nav.getBoundingClientRect().top - HEAD);
      return true;
    }
    var hs = SEC[tab] ? d.querySelectorAll('.glass h2') : [];
    for (var i = 0; i < hs.length; i++) {
      if (!SEC[tab].test(hs[i].textContent) || hs[i].closest('.pvg')) continue;
      glide(hs[i].closest('.glass').getBoundingClientRect().top - HEAD - 12);
      return true;
    }
    return false;
  }

  /* ── 3) 「ひとつ教えて」の話題 ─────────────────────────────
     広い箱では全部開いて横に並べる（質問の名前が最初から読める）。狭い箱では畳んだまま。
     開閉は <details> そのもの ＝ ここが動かなくても、押せば開く。境目は pv-glance.css の 640px と同じ。 */
  var askc = root.querySelector('.pvg-askc');
  var topics = [].slice.call(root.querySelectorAll('details.pvg-topic'));
  function flat() {
    if (!askc) return;
    var on = root.getBoundingClientRect().width >= 640;
    if (on === askc.hasAttribute('data-flat')) return;
    if (on) askc.setAttribute('data-flat', ''); else askc.removeAttribute('data-flat');
    topics.forEach(function (t) {
      t.open = on;
      var s = t.querySelector('summary');
      if (!s) return;
      if (on) s.setAttribute('tabindex', '-1'); else s.removeAttribute('tabindex');
    });
  }
  flat();
  if (w.ResizeObserver) new w.ResizeObserver(flat).observe(root);
  else w.addEventListener('resize', flat);

  d.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (askc && askc.hasAttribute('data-flat') && t.closest('.pvg-topic > summary')) { e.preventDefault(); return; }
    /* 「ほか◯問」… その話題の残りの質問を出し、出てきた最初の質問へ焦点を移す */
    var am = t.closest('[data-pvg-askmore]');
    if (am && root.contains(am)) {
      var tp = am.closest('.pvg-topic');
      if (tp) {
        var lis = tp.querySelectorAll('.pvg-ask li');
        tp.setAttribute('data-all', '');
        var nx = lis[4] && lis[4].querySelector('a');
        if (nx) nx.focus();
      }
      return;
    }
    var more = t.closest('.pvg-more[aria-controls]');
    if (more && root.contains(more)) {
      if (more.getAttribute('aria-expanded') === 'true') set(more, false); else openOnly(more);
      return;
    }
    var x = t.closest('.pvg-x');
    if (x && root.contains(x) && !OPEN[at]) {
      var p = x.closest('.pvg-panel');
      mores.forEach(function (b) {
        if (panelOf(b) === p) { set(b, false); b.focus(); }
      });
      return;
    }
    var tab = t.closest('[data-pvg-tab]');
    if (tab) { if (toTab(tab.getAttribute('data-pvg-tab'))) e.preventDefault(); return; }
    var rev = t.closest('a[href="#reviews"]');
    if (rev && rev.closest('.pvg,.pvg-hero')) { if (toTab('reviews')) e.preventDefault(); }
  });
  d.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || OPEN[at]) return;
    var b = current();
    if (!b) return;
    set(b, false);
    b.focus();
  });
})(window, document);
