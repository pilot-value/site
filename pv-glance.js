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

  /* ── 2) 5社の物差し（機長／副操縦士）──────────────────── */
  function rank(rk) {
    [].forEach.call(root.querySelectorAll('[data-pvg-rank]'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-pvg-rank') === rk ? 'true' : 'false');
    });
    [].forEach.call(root.querySelectorAll('.pvg-rows[data-for]'), function (ol) {
      ol.hidden = ol.getAttribute('data-for') !== rk;
    });
  }

  /* ── 3) タブへ（口コミ・募集要項）──────────────────────── */
  function toTab(tab) {
    var ui = w.PVReviewUI;
    if (!ui || typeof ui.switchTab !== 'function') return false;
    ui.switchTab(tab);
    var nav = d.getElementById('airline-tab-nav');
    if (nav) glide(nav.getBoundingClientRect().top - HEAD);
    return true;
  }

  d.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
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
    var seg = t.closest('[data-pvg-rank]');
    if (seg && root.contains(seg)) { rank(seg.getAttribute('data-pvg-rank')); return; }
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
