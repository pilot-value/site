/* pv-glass.js — すりガラスと動き（2026-11-12 オーナー採用・全ページ）
   オーナーの参考動画（緑・青の Dashboard Animation・Glassy V2）を、今の緑で写したもの。
   試作（ui-trial.js）を4枚で見せて「ガラスの方がいい」「いいね」→「全部のページに広げて」（2026-11-12）。
   読み込みは全ページの head の <!--PV-GLASS--> の塊（inject-glass.mjs が書く・pv-glass.css と対）。
   ★本物の字・数字は書き換えない。数え上げは「字を透明にして、上に重ねた絵の字だけを数える」。
     ＝ currency.js が読む字は最初から最後まで本物の額のまま。見出しを1字ずつに割るのも、動き終わったら元の字に戻す。
   ★my-value.js には触らない。タブを押した瞬間を横取りして、View Transitions で包んでから
     もう一度同じボタンを押す（中の処理は今までと1文字も同じ道を通る）。
   ★スクロールの動きは2種類：カードの出入りはスクロールと一緒に進む（戻すと戻る）。
     数字・棒・円は、それ自身が画面に入ったときに1回だけ時間で動く（途中で止めても、棒が本当より短く止まらない）。
   ★動かさない相手：「動きを減らす」設定の人・検索のロボット・自動の検査（navigator.webdriver）。
     検査は途中の形（長さ 0 の棒・透明にした数字）を測らないように、止まった最後の形だけを見る。
     動きそのものは assert-glass.mjs が window.__pvMotion を立てて確かめる。
   ★手元の住所でだけ ?ui=now で今までの見た目に戻せる（比べる用・端末に覚える。?ui=glass で戻す）。 */
(function () {
  'use strict';
  var d = document, w = window, root = d.documentElement;
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var q = new URLSearchParams(location.search), ui = 'glass';
  if (LOCAL) {
    try {
      if (q.get('ui') === 'now') localStorage.setItem('pv-ui-off', '1');
      else if (q.get('ui') === 'glass') localStorage.removeItem('pv-ui-off');
      if (localStorage.getItem('pv-ui-off') === '1') ui = '';
    } catch (e) { if (q.get('ui') === 'now') ui = ''; }
  }
  if (ui) root.setAttribute('data-ui', ui);
  /* 会社ページは左メニューのどれも選ばれていない ＝ AIRLINES を選んだ形にする（下の putPill） */
  var AIRPAGE = /\/airlines\//.test(location.pathname);
  var BOT = /bot|crawl|spider|slurp|lighthouse|inspectiontool|headlesschrome/i.test(navigator.userAgent || '') && !w.__pvMotion;
  var AUTO = !!navigator.webdriver && !w.__pvMotion;
  var RM = !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches) || BOT || AUTO;
  var SV = !!(w.CSS && CSS.supports && CSS.supports('animation-timeline: view()'));

  var BAR = '.mp-tabs,.mv-tabs,.pt-tabs';
  var TAB = '.mp-tab,.mv-tab,.pt-tab';
  /* 数え上げる数字：MY PAY の大きい額・他社の年収の額・分析の大きい数・REAL PAY の数字の札・ROADMAP の賛成の数 */
  var COUNT = '.mr-hero-v,.mr-total-v,.mv-ratio>b,.an-big,.ap-st-n,.mr-cmp-v,.rm-wn,.pt-donut-c>b,.pvg-big,.crl-sc-avg>b';
  /* 見出し：ページの題（1字ずつ下からせり上がる）と、カードの題（カードが見えたら同じ動きを短く） */
  var TITLE = '.mp-h1,.mp-tab,h1.pv-paytab,.mr-hd-t,main h1,.pvg-name h1';
  var SUBT = '.mr-card-t,.pt-h,.an-card-t,.rs-card-t,.ru-card-t,.ap-msg-t,.pvg-eyebrow,.crl-rg-tt,.crl-yd-tt,.crl-dn-h,.crl-sum-title';
  /* カードの名前は画面ごとに違う：MY PAY＝.mr-card・.an-card・.rs-card・.ru-card／ROADMAP＝.mr-card／REAL PAY＝.ap-* */
  var CARD = '.mr-card,.an-card,.rs-card,.ru-card,.mv-peek,.ap-filter,.ap-lock-skel,.ap-tw,.ap-st,.ap-msg,.ap-lock-see,main>.pvr,.pvg-card';
  /* 会社ページの HTML の図：年数の点（ぽんと出る）・幅の箱の中央値と真ん中の帯（浮かぶ）・月の勤務の棒（左から伸びる） */
  var HDOT = '.crl-yd-d', HFADE = '.crl-yd-bd,.crl-yd-md,.crl-rg-m', HBAR = '.crl-wb-b';

  /* ── 0) ページをまたぐ切り替えと、左メニューの選んだ印 ─────────────────────
     印（.ut-rail-pill）は選んだ項目の後ろに置く中身の無い板。ページを移るとき、前のページの板の位置から
     新しいページの板の位置へブラウザが滑らせる。最初の描画より前に置かないと滑らない ＝ 読み込みの途中から見張る。 */
  if (ui) {
    var putPill = function () {
      var a = d.querySelector('.mr-side-a.is-on');
      /* 会社ページはメニューのどれも選ばれていない ＝ AIRLINES を選んだ形にして、板がそこへ滑るようにする */
      if (!a && AIRPAGE) {
        a = d.querySelector('.mr-side-a[href*="world-airlines"]');
        if (a) { a.classList.add('is-on'); a.setAttribute('aria-current', 'page'); }
      }
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
     カード … 最初の1画面のものは開いたときに順に浮かぶ（.ut-rise）。その下はスクロールと一緒に浮かぶ（.ut-sv。戻すと沈む）。
     図と数字 … 1本・1つずつ見張り、それ自身が画面に入った瞬間に動き出す（.ut-w → .ut-g）。
       ＝ ゆっくりスクロールすると、入ってきた順に棒が1本ずつ伸び、線が描かれ、数字が数え上がる。
       ★動きは時間で最後まで進む（スクロールを途中で止めても、棒が本当より短いまま止まらない）。
       ★まだ見えていない図は 0 の長さで待つ（.ut-w）。動く仕組みが動いてから付ける＝ JS が落ちたら全部ふつうに見える。 */
  var io = ('IntersectionObserver' in w) ? new IntersectionObserver(onSee, { threshold: [0, .1, .25, .5] }) : null;
  var dio = ('IntersectionObserver' in w) ? new IntersectionObserver(onData, { threshold: [0, .3, .6, 1] }) : null;
  function topCards(region) {
    return Array.prototype.filter.call(region.querySelectorAll(CARD), function (c) {
      return !(c.parentElement && c.parentElement.closest(CARD)) && c.getClientRects().length;
    });
  }
  /* force … タブを押したとき（前に動いたものももう一度動かす）。無し … 開いた直後に遅れて出てきたものだけ動かす */
  function enter(region, force) {
    if (RM || !region) return;
    var vh = w.innerHeight, i = 0;
    topCards(region).forEach(function (c) {
      if (c._utSeen && !force) return;
      c._utSeen = true;
      if (io) io.unobserve(c);
      c.classList.remove('ut-rise', 'ut-sv', 'ut-pre');
      clearTimeout(c._utT);
      var r = c.getBoundingClientRect();
      if (r.top < vh * .94 && r.bottom > 0) {
        c.style.setProperty('--ut-i', String(Math.min(i++, 10)));
        c._utRiseAt = Date.now();
        void c.offsetWidth;
        c.classList.add('ut-rise');
        c._utT = setTimeout(function () { c.classList.remove('ut-rise'); }, 2000);
      } else {
        c.style.setProperty('--ut-i', '0');
        c._utRiseAt = 0;
        c.classList.add(SV ? 'ut-sv' : 'ut-pre');
        if (io && !SV) io.observe(c);
      }
    });
    prepData(region, force);
    /* 分析・1年の図は開いてから描かれる（読み込みのあと）。描かれたらすぐ拾う（2秒まで・見た物は2度触らない） */
    if (region._utMo) region._utMo.disconnect();
    var t;
    var mo = region._utMo = new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(function () { prepData(region, false); }, 30);
    });
    mo.observe(region, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); prepData(region, false); }, 2000);
  }
  function onSee(list) {
    list.forEach(function (en) {
      var c = en.target;
      if (!en.isIntersecting) return;
      if (en.intersectionRatio < .25 && en.intersectionRect.height < w.innerHeight * .3) return;   // 背の高いカードは画面の3割で
      io.unobserve(c);
      c.classList.remove('ut-pre');
      c.classList.add('ut-rise');
    });
  }

  /* ── 2-a) 見出しが1字ずつ下からせり上がる（見本の「Campaigns」）──────────────────
     字を1字ずつ小さな窓（.ut-cw）に入れ、窓の下から順に上げる。英語の語は途中で折り返さないように1語ずつまとめる。
     ★動き終わったら元の字に戻す（字の並びを書き換えたまま残さない）。途中で中身が描き直されたら、戻さずに手を引く。
     ★読み上げは見出しの aria-label（元の字）に任せ、1字ずつの窓は aria-hidden。 */
  var CJK = /[　-鿿豈-﫿＀-￯]/;
  function split(el, step) {
    if (el._utSp || RM) return null;
    var tw = d.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), list = [], t;
    while ((t = tw.nextNode())) if (t.nodeValue.trim() && !(t.parentNode && t.parentNode.closest && t.parentNode.closest('svg'))) list.push(t);
    if (!list.length) return null;
    var label = el.textContent.replace(/\s+/g, ' ').trim(), n = 0, pairs = [];
    var ch1 = function (box, ch) {
      var cw = d.createElement('span'), c = d.createElement('span');
      cw.className = 'ut-cw'; c.className = 'ut-ch'; c.textContent = ch;
      c.style.setProperty('--ci', String(n++));
      cw.appendChild(c); box.appendChild(cw);
    };
    list.forEach(function (t) {
      var box = d.createElement('span');
      box.className = 'ut-sp';
      box.setAttribute('aria-hidden', 'true');
      t.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { box.appendChild(d.createTextNode(part)); return; }
        if (CJK.test(part)) { Array.from(part).forEach(function (ch) { ch1(box, ch); }); return; }
        var wd = d.createElement('span');
        wd.className = 'ut-wd';
        Array.from(part).forEach(function (ch) { ch1(wd, ch); });
        box.appendChild(wd);
      });
      t.parentNode.replaceChild(box, t);
      pairs.push([box, t]);
    });
    var al = !el.hasAttribute('aria-label');
    if (al) el.setAttribute('aria-label', label);
    el.style.setProperty('--ut-cs', step + 'ms');
    el.classList.add('ut-split');
    el._utSp = { pairs: pairs, n: n, al: al, step: step };
    return el._utSp;
  }
  function reveal(el, delay) {
    var sp = el._utSp;
    if (!sp) return;
    el.style.setProperty('--ut-d', delay + 'ms');
    void el.offsetWidth;
    el.classList.add('ut-split-go');
    clearTimeout(sp.t);
    sp.t = setTimeout(function () { unsplit(el); }, delay + sp.n * sp.step + 1000);
  }
  function unsplit(el) {
    var sp = el._utSp;
    if (!sp) return;
    clearTimeout(sp.t);
    sp.pairs.forEach(function (p) { if (p[0].parentNode) p[0].parentNode.replaceChild(p[1], p[0]); });
    if (sp.al) el.removeAttribute('aria-label');
    el.classList.remove('ut-split', 'ut-split-go');
    el._utSp = null;
  }
  /* ページの題：読み込んだらすぐ窓の下へ隠し（headsSplit）、中身が出たら1回せり上げる（heads・カードより先に）。
     中身がなかなか出ないページでも3秒で上げる */
  function headsSplit() {
    if (RM) return;
    d.querySelectorAll(TITLE).forEach(function (el) {
      if (el._utHd || el.closest('.mr-side')) return;
      el._utHd = 1;
      split(el, 34);
    });
  }
  function heads() {
    if (RM) return;
    headsSplit();
    var i = 0;
    d.querySelectorAll(TITLE).forEach(function (el) {
      if (!el._utSp || el._utGo) return;
      el._utGo = 1;
      reveal(el, 40 + (i++) * 110);
    });
  }

  /* ── 2-b) すりガラスの図：棒は先を濃く根元を透かす・線に淡い光・円に上からの光 ──────────
     SVG の覆い（mask）と光の色（gradient）は、ページに1つだけ置いた見えない SVG の中に持つ。 */
  function glassDefs() {
    if (d.getElementById('ut-defs')) return;
    var s = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.id = 'ut-defs';
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('width', '0'); s.setAttribute('height', '0');
    s.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    s.innerHTML = '<defs>' +
      '<linearGradient id="utGV" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".8" stop-color="#fff" stop-opacity="1"/></linearGradient>' +
      '<mask id="utMV" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#utGV)"/></mask>' +
      '<linearGradient id="utGH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".8" stop-color="#fff" stop-opacity="1"/></linearGradient>' +
      '<mask id="utMH" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#utGH)"/></mask>' +
      '<linearGradient id="utSheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/>' +
        '<stop offset=".42" stop-color="#fff" stop-opacity=".1"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/>' +
        '<stop offset="1" stop-color="#fff" stop-opacity=".22"/></linearGradient>' +
      '</defs>';
    (d.body || root).appendChild(s);
  }

  /* ── 2-c) 円グラフ：色の区切りが12時から1つずつ順に描かれる（弧の長さを 0 から本当の長さへ）──────
     円の弧は stroke-dasharray（長さ と 残り）で描いてある。区切りの順は stroke-dashoffset（-それまでの長さ）の順。
     ★描き終わったら元の値をそのまま書き戻す（途中の値を残さない）。 */
  function pieSegs(u) {
    return Array.prototype.filter.call(u.querySelectorAll('circle'), function (c) {
      var da = c._utDash || c.getAttribute('stroke-dasharray');
      return !c.classList.contains('ut-sheen') && da && /^\s*[\d.]+[ ,]+[\d.]+\s*$/.test(da);
    }).map(function (c) {
      if (!c._utDash) c._utDash = c.getAttribute('stroke-dasharray');
      var p = c._utDash.split(/[ ,]+/).map(parseFloat);
      return { c: c, on: p[0], C: p[0] + p[1], off: parseFloat(c.getAttribute('stroke-dashoffset') || '0') };
    }).sort(function (a, b) { return b.off - a.off; });
  }
  function pieReset(u) {
    var segs = pieSegs(u);
    segs.forEach(function (s) { s.c.setAttribute('stroke-dasharray', '0 ' + s.C); s.c.style.opacity = '0'; });
    /* 上からの光（区切りと同じ輪の上に、白い光の輪を1本重ねる） */
    if (segs.length > 1 && !u.querySelector('.ut-sheen')) {
      var c0 = segs[0].c, sh = d.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ['cx', 'cy', 'r', 'stroke-width'].forEach(function (a) { if (c0.hasAttribute(a)) sh.setAttribute(a, c0.getAttribute(a)); });
      sh.setAttribute('fill', 'none');
      sh.setAttribute('stroke', 'url(#utSheen)');
      sh.setAttribute('class', 'ut-sheen');
      sh.setAttribute('pointer-events', 'none');
      u.appendChild(sh);
    }
  }
  function pieGo(u, delay) {
    var segs = pieSegs(u);
    if (!segs.length) return;
    var acc = 0;
    segs.forEach(function (s) { s.a = acc; acc += s.on; });
    var S = acc, t0 = null, dur = segs.length > 1 ? 1500 : 1100;
    setTimeout(function () {
      var step = function (ts) {
        if (t0 == null) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 3), s = S * e;
        segs.forEach(function (g) {
          var v = Math.max(0, Math.min(g.on, s - g.a));
          g.c.setAttribute('stroke-dasharray', v.toFixed(2) + ' ' + (g.C - v).toFixed(2));
          g.c.style.opacity = v > 0 ? '' : '0';
        });
        if (k < 1) requestAnimationFrame(step);
        else segs.forEach(function (g) { g.c.setAttribute('stroke-dasharray', g.c._utDash); g.c.style.opacity = ''; });
      };
      requestAnimationFrame(step);
    }, delay);
  }
  /* 円の横の凡例：円が描かれるのに合わせて1行ずつ浮かぶ */
  function legendOf(u) {
    var wrap = u.closest('.pt-donut-wrap,.crl-dn');
    return wrap ? wrap.querySelector('.pt-legend,.crl-dn-lg') : null;
  }

  /* 図の部品に印を付ける。
     SVG の図 … 縦の棒 .ut-col（下から伸びる）・横の棒 .ut-row（左から）・線 .ut-line（左から描かれる）・
                 塗り .ut-area（あとから浮かぶ）・点 .ut-dot（最後にぽんと出る）
     HTML の棒 … 幅を書き込んである細い帯 .ut-hb（左から伸びる）
     ★自分で transform を持つ物・点線（stroke-dasharray を持つ線）・塗りの無い物は触らない。 */
  function marks(scope) {
    scope.querySelectorAll('svg').forEach(function (svg) {
      if (svg._utM || svg.id === 'ut-defs') return;
      if (svg.closest('button,a,.mr-side')) return;
      /* 円グラフ・輪（弧を stroke-dasharray で描いた太い輪）は、棒や線とは別の動き（2-c） */
      var arcs = svg.querySelectorAll('circle[stroke-dasharray]');
      if (arcs.length && Array.prototype.every.call(arcs, function (c) { return parseFloat(c.getAttribute('r')) >= 14; })) {
        svg._utM = 1;
        svg.classList.add('ut-pie');
        return;
      }
      var rd = svg.closest('[data-radar]');
      if (rd && rd.getAttribute('data-radar') !== 'real') return;   // 会社ページのレーダーは、本物の点が入ってから
      var bb = svg.getBoundingClientRect();
      if (bb.width < 60 || bb.height < 30) return;                 // 字の横の小さな絵
      var n = 0, j = 0, k = 0;
      svg.querySelectorAll('rect').forEach(function (r) {
        if (r.hasAttribute('transform')) return;
        var cs = getComputedStyle(r), f = cs.fill;
        if (!f || f === 'none' || f === 'transparent' || /,\s*0\)$/.test(f) || parseFloat(cs.fillOpacity) === 0 || parseFloat(cs.opacity) === 0) return;
        var b; try { b = r.getBBox(); } catch (e) { return; }
        if (!b || !b.width || !b.height) return;
        if (b.height > b.width * 1.2) { r.classList.add('ut-col'); if (!r.hasAttribute('mask')) r.setAttribute('mask', 'url(#utMV)'); }
        else if (b.width > b.height * 2) { r.classList.add('ut-row'); if (!r.hasAttribute('mask')) r.setAttribute('mask', 'url(#utMH)'); }
        else return;
        r.style.setProperty('--ut-j', String(Math.min(j++, 16)));
        n++;
      });
      svg.querySelectorAll('path,polyline').forEach(function (p) {
        if (p.hasAttribute('transform')) return;
        var cs = getComputedStyle(p);
        var stroked = cs.stroke && cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0;
        var unfilled = cs.fill === 'none' || parseFloat(cs.fillOpacity) === 0;
        if (stroked && unfilled) {
          if (cs.strokeDasharray && cs.strokeDasharray !== 'none') return;   // 点線（保証の線など）はそのまま
          p.setAttribute('pathLength', '1');
          p.classList.add('ut-line');
          n++;
        } else if (!unfilled) {
          p.classList.add('ut-area');
          n++;
        }
      });
      svg.querySelectorAll('polygon').forEach(function (pg) {
        var cs = getComputedStyle(pg);
        if (cs.fill === 'none' || parseFloat(cs.fillOpacity) === 0 || pg.hasAttribute('transform')) return;   // 目盛の多角形（塗り無し）はそのまま
        pg.classList.add('ut-rad');
        n++;
      });
      svg.querySelectorAll('circle').forEach(function (c) {
        var r = parseFloat(c.getAttribute('r'));
        if (!r || r > 7 || c.hasAttribute('transform')) return;
        c.classList.add('ut-dot');
        c.style.setProperty('--ut-j', String(Math.min(k++, 16)));
        n++;
      });
      svg._utM = 1;
      if (n) svg.classList.add('ut-chart');
    });
    scope.querySelectorAll(HDOT).forEach(function (e) { if (!e._utM) { e._utM = 1; e.classList.add('ut-hd'); } });
    scope.querySelectorAll(HFADE).forEach(function (e) { if (!e._utM) { e._utM = 1; e.classList.add('ut-hf'); } });
    scope.querySelectorAll(HBAR).forEach(function (e) { if (!e._utM) { e._utM = 1; e.classList.add('ut-hb'); } });
    scope.querySelectorAll('i,span,b,div').forEach(function (e) {
      if (e._utM) return;
      var sw = e.style && e.style.width;
      if (!sw || e.children.length || e.textContent.trim()) return;
      var cs = getComputedStyle(e), h = parseFloat(cs.height);
      if (!(h >= 3 && h <= 16)) return;
      if (cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.backgroundImage === 'none') return;
      e._utM = 1;
      e.classList.add('ut-hb');
      if (cs.backgroundImage === 'none') e.classList.add('ut-hbg');   // 自分の模様を持たない棒だけ、ガラスの光を重ねる
    });
  }
  /* 見張る単位：SVG の図1枚・HTML の棒1本・円グラフ1つ・リング1つ・数字1つ・カードの題1つ */
  function units(scope) {
    return Array.prototype.slice.call(scope.querySelectorAll('svg.ut-chart,svg.ut-pie,.ut-hb,.ut-hd,.ut-hf,' + COUNT + ',' + SUBT));
  }
  function prepData(scope, force) {
    if (RM || !dio) return;
    glassDefs();
    marks(scope);
    units(scope).forEach(function (u) {
      if (u._utDone && !force) return;
      if (u._utWatch && !force) return;
      if (!u.getClientRects().length) return;
      u._utDone = false;
      u._utWatch = true;
      clearTimeout(u._utT);
      u.classList.remove('ut-g');
      if (u.matches(SUBT)) { unsplit(u); split(u, 22); }
      else if (!u.matches(COUNT)) u.classList.add('ut-w');
      if (u.matches('svg.ut-pie')) {
        pieReset(u);
        var lg = legendOf(u);
        if (lg) {
          clearTimeout(lg._utT);
          lg.classList.remove('ut-leg-g');
          lg.classList.add('ut-leg-w');
          Array.prototype.forEach.call(lg.children, function (r, j) { r.style.setProperty('--ut-j', String(Math.min(j, 14))); });
        }
      }
      dio.unobserve(u);
      dio.observe(u);
    });
  }
  function onData(list) {
    var go = list.filter(function (en) {
      return en.isIntersecting && (en.intersectionRatio >= .6 || en.intersectionRect.height >= w.innerHeight * .35);
    }).map(function (en) { return en.target; });
    go.sort(function (a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
    go.forEach(function (u, n) {
      dio.unobserve(u);
      u._utWatch = false;
      if (u._utDone) return;
      u._utDone = true;
      /* 開いたばかりで、そのカードがまだ浮かんでいる途中なら、浮かび終わるのを待つ */
      var card = u.closest(CARD), base = 0;
      if (card && card._utRiseAt) base = Math.max(0, (parseFloat(card.style.getPropertyValue('--ut-i')) || 0) * 60 + 300 - (Date.now() - card._utRiseAt));
      var delay = Math.round(base + n * 55);
      u.style.setProperty('--ut-d', delay + 'ms');
      if (u.matches(COUNT)) { count(u, delay); return; }
      if (u._utSp) { reveal(u, delay); return; }
      if (u.matches(SUBT)) return;
      u.classList.remove('ut-w');
      void u.getBoundingClientRect();
      u.classList.add('ut-g');
      if (u.matches('svg.ut-pie')) {
        pieGo(u, delay);
        var lg = legendOf(u);
        if (lg) {
          lg.style.setProperty('--ut-d', delay + 'ms');
          lg.classList.remove('ut-leg-w');
          lg.classList.add('ut-leg-g');
          lg._utT = setTimeout(function () { lg.classList.remove('ut-leg-g'); }, delay + 2600);
        }
      }
      u._utT = setTimeout(function () { u.classList.remove('ut-g'); }, delay + 2600);
    });
  }

  /* 数え上げ ── 字の中の最初の数を見つけ、同じ書式（けた区切り・小数のけた・前後の字）で 0 から数える。
     本物の字は透明にするだけで、数えている字は ::after の絵（data-ut-n）にしか無い。 */
  function count(el, delay) {
    if (el._utCounting) return;
    /* 数字だけの字に限る。中に別の札（「推定」など）を持つ字は数えない ── 重ねた絵の字が札とずれて重なる。
       英語ページの金額の入れ物（.pv-cur の1つだけ）は数字だけなので数える */
    var kids = el.children;
    if (kids.length > 1 || (kids.length === 1 && !(kids[0].classList.contains('pv-cur') && kids[0].textContent.trim() === el.textContent.trim()))) return;
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
    setTimeout(function () { requestAnimationFrame(step); }, (delay || 0) + 120);
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
    headsSplit();
    setTimeout(heads, 3000);
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
      heads();
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
    /* 会社ページのタブ（概要・給与・待遇・口コミ…）を押したら、出てきたカードと図を動かす */
    d.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-pvg-tab]');
      if (t) setTimeout(function () { heads(); enter(main); }, 80);
    });
  }

  /* 撮影・検査で動きをもう一度最初から見るための口 */
  w.PVUiTrial = { replay: function () { var h = d.getElementById('pv-value'); w.scrollTo(0, 0);
    d.querySelectorAll(TITLE).forEach(function (el) { unsplit(el); el._utHd = 0; el._utGo = 0; }); heads(); enter(h ? (visible(h.querySelectorAll('.mv-pane')) || h) : (d.querySelector('main') || d.body), true); } };

  var start = function () { if (ui) boot(); };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})();
