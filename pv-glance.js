/* 主要5社の会社ページの最上部（.pvg）の動き ── 見せる・隠す・切り替えるだけ。
   ⚠️ ここに金額を書かない。額は全部 HTML に在る（通貨切替と check-salary.mjs がそのまま読める）。
   ⚠️ 直したら node gen-airline-glance.mjs（HTML が読む ?v= を付け直す）。
   板の開閉は hidden 属性で行う ＝ career-live.js がそれを見て、見えるようになった実データの欄を取りに行く。 */
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

  /* ── 2) タブへ（口コミ・募集要項）────────────────────────
     ⚠️ その名前のタブが無い会社がある（JAL・ANA の募集要項は「企業トップ」の面の下に在る。
        タブは airline-reviews-ui.js が節の札の言葉から作るので、会社ごとに本数が違う）。
        無いタブへ切り替えると、どの面も選ばれない ＝ ページの中身がぜんぶ消える。
        無い時は切り替えず、同じ面の中のその節へ寄る。 */
  var SEC = { jobs: /募集要項|採用情報/ };
  function toTab(tab) {
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
    if (x && root.contains(x)) {
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
    if (e.key !== 'Escape') return;
    var b = current();
    if (!b) return;
    set(b, false);
    b.focus();
  });
})(window, document);
