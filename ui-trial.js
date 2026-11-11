/* ui-trial.js — すりガラスと動きの試作（2026-11-12・左メニューのある会員の画面4枚・本番に出さない）
   ?ui=glass で html に data-ui="glass" を立て、動きを付ける。?ui=now で戻す。選んだ方は端末に覚えて、ページを移っても続く。
   ★手元の住所（localhost）でだけ効く。本番の住所では ?ui= を付けても1行も動かない。
   ★本物の字・数字は書き換えない。数え上げは「字を透明にして、上に重ねた絵の字だけを数える」。
     ＝ currency.js が読む字は最初から最後まで本物の額のまま。
   ★my-value.js には触らない。タブを押した瞬間を横取りして、View Transitions で包んでから
     もう一度同じボタンを押す（中の処理は今までと1文字も同じ道を通る）。
   ★スクロールの動きは2種類：カードの出入りはスクロールと一緒に進む（戻すと戻る）。
     数字・棒・円はカードが見えたときに1回だけ時間で動く（途中で止めても、棒が本当より短く止まらない）。 */
(function () {
  'use strict';
  var d = document, w = window, root = d.documentElement;
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (!LOCAL) return;
  var q = new URLSearchParams(location.search);
  var KEY = 'pv-ui-trial', ask = q.get('ui'), ui = '';
  try {
    if (ask === 'glass') localStorage.setItem(KEY, 'glass');
    else if (ask === 'now') localStorage.removeItem(KEY);
    ui = ask === 'now' ? '' : (ask === 'glass' || localStorage.getItem(KEY) === 'glass') ? 'glass' : '';
  } catch (e) { ui = ask === 'glass' ? 'glass' : ''; }
  if (ui) root.setAttribute('data-ui', ui);
  var RM = !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var SV = !!(w.CSS && CSS.supports && CSS.supports('animation-timeline: view()'));

  var BAR = '.mp-tabs,.mv-tabs,.pt-tabs';
  var TAB = '.mp-tab,.mv-tab,.pt-tab';
  var COUNT = '.mr-hero-v,.mr-total-v,.mv-ratio>b,.an-big,.ap-st-n';
  /* カードの名前は画面ごとに違う：MY PAY＝.mr-card・.an-card・.rs-card・.ru-card／ROADMAP＝.mr-card／REAL PAY＝.ap-* */
  var CARD = '.mr-card,.an-card,.rs-card,.ru-card,.mv-peek,.ap-filter,.ap-lock-skel,.ap-tw,.ap-st,.ap-msg,.ap-lock-see,main>.pvr';
  var CHART = '.an-svg,.yr-ch svg,.yr-in-g svg';

  /* ── 0) ページをまたぐ切り替えと、左メニューの選んだ印 ─────────────────────
     印（.ut-rail-pill）は選んだ項目の後ろに置く中身の無い板。ページを移るとき、前のページの板の位置から
     新しいページの板の位置へブラウザが滑らせる。最初の描画より前に置かないと滑らない ＝ 読み込みの途中から見張る。 */
  if (ui) {
    var putPill = function () {
      var a = d.querySelector('.mr-side-a.is-on');
      if (a && !a.querySelector('.ut-rail-pill')) {
        var p = d.createElement('i');
        p.className = 'ut-rail-pill';
        p.setAttribute('aria-hidden', 'true');
        a.insertBefore(p, a.firstChild);
      }
      return !!a;
    };
    var pillMo = new MutationObserver(function () { if (putPill()) pillMo.disconnect(); });
    pillMo.observe(root, { childList: true, subtree: true });
    d.addEventListener('DOMContentLoaded', function () { putPill(); pillMo.disconnect(); });
    if (!RM) {
      var st = d.createElement('style');
      st.textContent = '@view-transition{navigation:auto}';
      (d.head || root).appendChild(st);
      /* 名前（ut-page・ut-rail-pill）はページを移る間だけ付ける。タブの切り替え（ut-body）と名前がぶつからないように */
      w.addEventListener('pageswap', function (e) { if (e.viewTransition) root.classList.add('ut-pagevt'); });
      w.addEventListener('pagereveal', function (e) {
        if (!e.viewTransition) return;
        root.classList.add('ut-pagevt');
        e.viewTransition.finished.finally(function () { root.classList.remove('ut-pagevt'); });
      });
    }
  }

  /* ── 試作の切り替え（右下の小さな帯）── ?sw=0 なら出さない（撮影用） */
  function switcher() {
    if (q.get('sw') === '0') return;
    var box = d.createElement('div');
    box.className = 'ut-sw';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', '見た目の試作');
    box.innerHTML = '<span class="ut-sw-l">試作</span>' + [['now', '今'], ['glass', 'ガラス']].map(function (o) {
      return '<button type="button" data-ui="' + o[0] + '" aria-pressed="' + ((ui || 'now') === o[0]) + '">' + o[1] + '</button>';
    }).join('');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var u = new URL(location.href);
      u.searchParams.set('ui', b.getAttribute('data-ui'));
      location.replace(u.href);
    });
    d.body.appendChild(box);
  }

  /* ── 1) 選んだ印が滑る（タブの中・FLIP）────────────────────────────────
     帯ごとに「前に選ばれていたボタンの位置と幅」を覚えておき、選ばれたボタンが替わったら、
     新しいボタンの印を前の位置・幅に置いてから、ばねで今の位置へ戻す。
     帯が描き直されても（今月｜1年は押すたびに作り直される）、帯の中の字で同じ帯と分かる。 */
  var last = {};
  function kind(bar) { return bar.classList.contains('mp-tabs') ? 'mp' : bar.classList.contains('mv-tabs') ? 'mv' : 'pt'; }
  function keyOf(bar) {
    return kind(bar) + '|' + Array.prototype.map.call(bar.querySelectorAll(TAB), function (b) { return b.textContent.trim(); }).join('/');
  }
  function onBtn(bar) { return bar.querySelector('.on,[aria-selected="true"]'); }
  function sync(animate) {
    d.querySelectorAll(BAR).forEach(function (bar) {
      if (!bar.getClientRects().length) return;          // 隠れている帯は覚え直さない
      var b = onBtn(bar);
      if (!b) return;
      var k = keyOf(bar), br = bar.getBoundingClientRect(), r = b.getBoundingClientRect();
      var cur = { label: b.textContent.trim(), x: r.left - br.left, w: r.width };
      var p = last[k];
      if (animate && p && p.label !== cur.label && cur.w > 0 && !RM) flip(b, p.x - cur.x, p.w / cur.w);
      last[k] = cur;
    });
  }
  function flip(b, dx, sx) {
    b.classList.add('ut-snap');
    b.style.setProperty('--ut-dx', dx + 'px');
    b.style.setProperty('--ut-sx', String(sx));
    void b.offsetWidth;                                   // 前の位置で一度描かせる
    b.classList.remove('ut-snap');
    b.style.setProperty('--ut-dx', '0px');
    b.style.setProperty('--ut-sx', '1');
  }
  var syncQueued = false;
  function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(function () { syncQueued = false; sync(true); });
  }

  /* ── 2) 画面に入るとき・スクロールで見えたときの動き ──────────────────────
     最初の1画面にあるカード … 開いたときに順に浮かび（.ut-rise）、中の数字・棒も順に動く（.ut-go）。
     その下のカード … 浮かぶのはスクロールと一緒（.ut-sv・使えないブラウザは見えたときに .ut-rise）。
                      中の数字・棒は、カードが 25% 見えたら1回だけ動く。見えるまでは棒を 0 の長さで待たせる（.ut-wait）。 */
  var io = ('IntersectionObserver' in w) ? new IntersectionObserver(onSee, { threshold: [0, .1, .25, .5] }) : null;
  function topCards(region) {
    return Array.prototype.filter.call(region.querySelectorAll(CARD), function (c) {
      return !(c.parentElement && c.parentElement.closest(CARD)) && c.getClientRects().length;
    });
  }
  /* force … タブを押したとき（前に動いたカードももう一度動かす）。無し … 開いた直後に遅れて出てきたカードだけ動かす */
  function enter(region, force) {
    if (RM || !region) return;
    bars(region);
    var vh = w.innerHeight, i = 0;
    topCards(region).forEach(function (c) {
      if (c._utSeen && !force) return;
      c._utSeen = true;
      if (io) io.unobserve(c);
      c.classList.remove('ut-go', 'ut-rise', 'ut-sv', 'ut-pre');
      clearTimeout(c._utT);
      var r = c.getBoundingClientRect();
      c.classList.add('ut-wait');
      if (r.top < vh * .94 && r.bottom > 0) {
        c.style.setProperty('--ut-i', String(Math.min(i++, 10)));
        void c.offsetWidth;
        c.classList.add('ut-rise');
        go(c);
      } else {
        c.style.setProperty('--ut-i', '0');
        c.classList.add(SV ? 'ut-sv' : 'ut-pre');
        if (io) io.observe(c); else go(c);
      }
    });
    /* 分析・1年の図は開いてから描かれることがあるので、少し遅れてもう一度見る（見た棒は2度触らない） */
    [160, 420, 900].forEach(function (ms) { setTimeout(function () { bars(region); }, ms); });
  }
  function onSee(list) {
    list.forEach(function (en) {
      var c = en.target;
      if (!en.isIntersecting) return;
      if (en.intersectionRatio < .25 && en.intersectionRect.height < w.innerHeight * .3) return;   // 背の高いカードは画面の3割で
      io.unobserve(c);
      if (c.classList.contains('ut-pre')) { c.classList.remove('ut-pre'); c.classList.add('ut-rise'); }
      go(c);
    });
  }
  function go(c) {
    c.querySelectorAll('.mr-cmp-r').forEach(function (li, j) { li.style.setProperty('--ut-j', String(j)); });
    c.querySelectorAll('.mv-bar>i').forEach(function (el, j) { el.style.setProperty('--ut-j', String(j)); });
    bars(c);
    c.classList.remove('ut-wait');
    void c.offsetWidth;
    c.classList.add('ut-go');
    count(c);
    c._utT = setTimeout(function () { c.classList.remove('ut-go', 'ut-rise'); }, 3800);
  }

  /* SVG の図の棒 ── 縦に長い棒は下から、横に長い棒は左から伸ばす（.ut-col / .ut-row）。
     塗りの無い棒（押す所・目盛の帯）と、自分で transform を持つ棒は触らない（CSS の transform が上書きして跳ぶため） */
  function bars(scope) {
    scope.querySelectorAll(CHART).forEach(function (svg) {
      var j = 0;
      svg.querySelectorAll('rect').forEach(function (r) {
        if (r._ut) return;
        r._ut = 1;
        if (r.hasAttribute('transform')) return;
        var cs = getComputedStyle(r), f = cs.fill;
        if (!f || f === 'none' || f === 'transparent' || /,\s*0\)$/.test(f) || parseFloat(cs.fillOpacity) === 0 || parseFloat(cs.opacity) === 0) return;
        var b; try { b = r.getBBox(); } catch (e) { return; }
        if (!b || !b.width || !b.height) return;
        if (b.height > b.width * 1.2) r.classList.add('ut-col');
        else if (b.width > b.height * 2) r.classList.add('ut-row');
        else return;
        r.style.setProperty('--ut-j', String(Math.min(j++, 16)));
      });
    });
  }

  /* 数え上げ ── 字の中の最初の数を見つけ、同じ書式（けた区切り・小数のけた・前後の字）で 0 から数える。
     本物の字は透明にするだけで、数えている字は ::after の絵（data-ut-n）にしか無い。 */
  function count(scope) {
    scope.querySelectorAll(COUNT).forEach(function (el) {
      if (el._utCounting) return;
      var txt = el.textContent, m = txt.match(/\d[\d,]*(\.\d+)?/);
      if (!m) return;
      var raw = m[0], dec = m[1] ? m[1].length - 1 : 0, val = parseFloat(raw.replace(/,/g, ''));
      if (!isFinite(val) || val === 0) return;
      var group = raw.indexOf(',') >= 0, pre = txt.slice(0, m.index), post = txt.slice(m.index + raw.length);
      var fmt = function (v) {
        var s = v.toFixed(dec);
        if (group) { var p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); s = p.join('.'); }
        return pre + s + post;
      };
      var card = el.closest(CARD), i = card ? parseFloat(card.style.getPropertyValue('--ut-i')) || 0 : 0;
      el.style.setProperty('--ut-c', getComputedStyle(el).color);
      el._utCounting = true;
      el.setAttribute('data-ut-n', fmt(0));
      el.classList.add('ut-counting');
      var t0 = null, dur = 1100;
      var step = function (ts) {
        if (t0 == null) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 4);
        el.setAttribute('data-ut-n', fmt(val * e));
        if (k < 1) requestAnimationFrame(step);
        else { el.classList.remove('ut-counting'); el.removeAttribute('data-ut-n'); el._utCounting = false; }
      };
      setTimeout(function () { requestAnimationFrame(step); }, i * 60 + 160);
    });
  }

  /* ── 3) タブを押したときの切り替え（View Transitions）──────────────────── */
  function visible(list) {
    for (var i = 0; i < list.length; i++) if (!list[i].hidden && list[i].getClientRects().length) return list[i];
    return null;
  }
  function regionFor(k, bar) {
    if (k === 'mp') { var main = bar.parentNode; return main ? visible(main.querySelectorAll(':scope > .mp-pane')) : null; }
    return visible(d.querySelectorAll('#pv-value .mv-pane'));
  }
  /* 押したあと中身が描き終わるのを待つ（60ms 何も変わらなければ終わり・最長 320ms） */
  function settle(target) {
    return new Promise(function (res) {
      var done = false, idle, max;
      var fin = function () { if (done) return; done = true; mo.disconnect(); clearTimeout(idle); clearTimeout(max); res(); };
      var mo = new MutationObserver(function () { clearTimeout(idle); idle = setTimeout(fin, 60); });
      mo.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
      idle = setTimeout(fin, 60);
      max = setTimeout(fin, 320);
    });
  }
  var passing = false;
  function onClick(e) {
    if (passing || RM) return;
    var b = e.target.closest ? e.target.closest(TAB) : null;
    if (!b || b.classList.contains('on') || b.getAttribute('aria-selected') === 'true') return;
    var bar = b.closest(BAR);
    if (!bar) return;
    var k = kind(bar);
    if (!d.startViewTransition) {                        // 古いブラウザ：切り替えはそのまま・入る動きだけ
      setTimeout(function () { enter(regionFor(k, bar), true); }, 0);
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    var old = regionFor(k, bar), scope = k === 'mp' ? bar.parentNode : d.getElementById('pv-value') || d.body;
    var named = [];
    var name = function (el, n) { if (el) { el.style.viewTransitionName = n; named.push(el); } };
    name(bar, 'ut-bar');
    name(old, 'ut-body');
    var tr = d.startViewTransition(function () {
      if (old) old.style.viewTransitionName = '';
      if (bar) bar.style.viewTransitionName = '';
      passing = true;
      try { b.click(); } finally { passing = false; }
      return settle(scope).then(function () {
        var nu = regionFor(k, bar.isConnected ? bar : (d.querySelector(k === 'mp' ? '.mp-tabs' : k === 'mv' ? '#pv-value .mv-tabs' : '#pv-value .pt-tabs') || bar));
        var bar2 = bar.isConnected ? bar : (nu && k === 'pt' ? nu.querySelector('.pt-tabs') : d.querySelector(k === 'mp' ? '.mp-tabs' : '#pv-value .mv-tabs'));
        name(nu, 'ut-body');
        name(bar2, 'ut-bar');
        sync(true);
        enter(nu, true);
      });
    });
    tr.finished.finally(function () { named.forEach(function (el) { el.style.viewTransitionName = ''; }); });
  }

  function boot() {
    d.addEventListener('click', onClick, true);
    /* 選ばれたボタンが替わったら印を滑らせる（キーボードの矢印・描き直しも拾う） */
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var t = list[i].target;
        if (list[i].type === 'childList' || (t.matches && t.matches(TAB))) { queueSync(); return; }
      }
    }).observe(d.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-selected'] });
    w.addEventListener('resize', function () { sync(false); });
    /* 最初に中身が出たとき、1回だけ入る動き。MY PAY は描き終わるのを待つ（中身は通信のあとに描かれる） */
    var host = d.getElementById('pv-value');
    var main = d.querySelector('main') || d.body;
    var first = function () {
      if (host && !host.querySelector('.mr-card')) return false;
      if (!host && !main.querySelector(CARD)) return false;
      sync(false);
      enter(host ? (visible(host.querySelectorAll('.mv-pane')) || host) : main);
      return true;
    };
    /* 一覧の行のように、開いたあと少し遅れて出てくるカードも拾う（6秒まで・一度動いたカードは触らない） */
    var done = first();
    var mo = new MutationObserver(function () {
      if (!done) { done = first(); return; }
      clearTimeout(mo._t);
      mo._t = setTimeout(function () { enter(host ? (visible(host.querySelectorAll('.mv-pane')) || host) : main); }, 40);
    });
    mo.observe(host || main, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); }, 6000);
  }

  /* 撮影で動きの途中を撮るための口（試作だけ） */
  w.PVUiTrial = { replay: function () { var h = d.getElementById('pv-value'); w.scrollTo(0, 0); enter(h ? (visible(h.querySelectorAll('.mv-pane')) || h) : (d.querySelector('main') || d.body), true); } };

  var start = function () { switcher(); if (ui) boot(); };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})();
