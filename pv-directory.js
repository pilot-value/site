/* pv-directory.js ── 航空会社一覧（world-airlines.html・en/world-airlines.html）の台本。見せる・隠す・並べ替えるだけ。
   日英の2枚がこの1本を読む（WP-dd-3 でページの中から移し、WP-dd-5 で検索を約束どおりに作り直した）。
   ⚠️ カード・地域のボタン・社数・金額は gen-directory.mjs がページに書く。ここで作らない
      （check-salary.mjs は HTML を読む。JS が描いた額は誰も照合しない）。
   ⚠️ 直したら node gen-directory.mjs（ページが読む ?v= はこのファイルの中身の指紋。流さないと古い台本が残る）。
   ⚠️ ヘッダーのログインの1行はページの中に残してある（db/test-pay-gate.mjs がページの字を読む）。
   ★ 検索の6つの道具（fold / spaced / compact / starts / query / tier）は自分たちだけで閉じている
     （互いのほかに外の名前を読まない）。全社どうしの比較（career.js）へそのまま貼れるように、
     ¥・万・円の字・3けた以上の数・HTML を組み立てる書き方を入れない。
   ★ 地域のボタンの押した見た目は aria-pressed だけ（CSS の [aria-pressed="true"]）。ここは class も style も書かない。
   ★ 外から読む名前は window.PVDirectory と、変わるたびの 'wd:change'（document に。html.wd-q を付け外ししたあと）。
   ★ 住所（?q=・region・type・view）と「戻る」は WP-dd-6。履歴に触るのは commit() と save() の2つだけ（どちらも replaceState）。
   ★ 比べる印と盆（#wd-tray）は WP-dd-7。印を付ける・外すは history.state だけを書き直す（住所は変えない）。 */
(function (w, d) {
  'use strict';
  var GRID = d.getElementById('airline-grid');
  if (!GRID) return;
  var $ = function (id) { return d.getElementById(id); };
  var all = function (sel) { return Array.prototype.slice.call(d.querySelectorAll(sel)); };
  var FIELD = $('search'), CNT = $('result-count'), RH = $('wd-rh-name'), RHBOX = $('wd-rh'), STRIPBOX = $('region-strip');
  var NOR = $('no-results'), NONE = $('wd-none'), RVIEW = $('range-view'), FBAR = $('filter-bar');
  var STRIP = all('#region-strip .rstrip-btn'), ELSE = all('#wd-else .wd-else-b'), SCOPES = [$('wd-scope'), $('wd-scope-e')].filter(Boolean);
  var CLEARS = all('.wd-clear'), TYPES = all('.ftype-btn'), VIEWS = all('.view-btn');
  /* 打ったら地域を外すか（外さない。外す読み方はこの1つを true にするだけ） */
  var RELEASE_ON_TYPE = false;
  var coarse = function () { try { return w.matchMedia('(pointer:coarse)').matches; } catch (e) { return false; } };

  /* ── 検索の6つの道具（ここから）──────────────────────────────── */
  /** 幅・大小・かなをそろえる（全角→半角・小文字・ひらがな→カタカナ） */
  function fold(s) {
    s = String(s == null ? '' : s);
    return (s.normalize ? s.normalize('NFKC') : s).toLowerCase().replace(/[ぁ-ゖ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0x60); });
  }
  /** 区切り（空白 ・ . , ' " ( ) [ ] / - _ & |）を1つの空白に・長音（ー）を消す */
  function spaced(s) {
    return fold(s).replace(/[\s・·.,'’"“”()\[\]\/\-‐‑–—_&|]+/g, function () { return ' '; }).replace(/ー/g, function () { return ''; })
      .replace(/ +/g, function () { return ' '; }).trim();
  }
  /** 空白を詰めた形 */
  function compact(s) { return spaced(s).replace(/ /g, function () { return ''; }); }
  /** 詰めた形の中で、語が始まる位置（先頭の0と、空白1つにつき1つ） */
  function starts(sp) {
    var out = [0], n = 0;
    for (var i = 0; i < sp.length; i++) { if (sp.charAt(i) === ' ') out.push(n); else n++; }
    return out;
  }
  /** 打たれた字を一度だけ読む。na ＝ ASCII でない字を含む・sh ＝ ASCII だけで空白を除いて3字まで（短い） */
  function query(raw) {
    var S = spaced(raw), C = compact(raw), na = /[^\x00-\x7f]/.test(C);
    return { raw: raw, S: S, C: C, na: na, sh: !na && C.length <= 3 };
  }
  /** 0 ＝ 略号か呼び名とぴったり同じ（先頭に並べる）・1 ＝ 当たり・-1 ＝ 外れ */
  function tier(card, Q) {
    var i, j, k, hit = false;
    if (Q.C === '') return 1;
    if (card.codes.indexOf(Q.C) >= 0) return 0;
    for (i = 0; i < card.keys.length; i++) if (card.keys[i].C === Q.C) return 0;
    for (i = 0; i < card.keys.length && !hit; i++) {
      k = card.keys[i];
      if (Q.na) { hit = k.C.indexOf(Q.C) >= 0; continue; }
      if (!Q.sh && k.S.indexOf(Q.S) >= 0) hit = true;
      for (j = 0; j < k.W.length && !hit; j++) if (k.C.startsWith(Q.C, k.W[j])) hit = true;
    }
    return hit ? 1 : -1;
  }
  /* ── 検索の6つの道具（ここまで）──────────────────────────────── */

  /* カード（ページの並び）。呼び名をそろえるのはここで1回だけ */
  var CARDS = Array.prototype.slice.call(GRID.querySelectorAll('li[data-slug]')).map(function (li, i) {
    var a = function (n) { return li.getAttribute(n) || ''; };
    return {
      li: li, slug: a('data-slug'), region: a('data-region'), type: a('data-type'), tax: a('data-tax') === '1',
      lvl: a('data-lvl') === '1', two: a('data-two') === '1', i: i,
      codes: a('data-c').split(' ').filter(Boolean).map(compact),
      keys: a('data-k').split('|').filter(Boolean).map(function (k) { var S = spaced(k); return { S: S, C: S.replace(/ /g, function () { return ''; }), W: starts(S) }; }),
    };
  });
  var CODES = STRIP.map(function (b) { return b.getAttribute('data-region'); });
  var btnOf = function (code) { for (var i = 0; i < STRIP.length; i++) if (STRIP[i].getAttribute('data-region') === code) return STRIP[i]; return null; };
  var labelOf = function (code) { var b = btnOf(code); return b ? b.getAttribute('data-label') || '' : ''; };
  var total = function (code) { return CARDS.filter(function (c) { return code === 'all' || c.region === code; }).length; };
  /** 社数の字（data-fmt。英語ページの1社だけ data-fmt-one ＝ «1 airline»） */
  function fmt(n) {
    var one = CNT && CNT.getAttribute('data-fmt-one'), f = (n === 1 && one) ? one : ((CNT && CNT.getAttribute('data-fmt')) || '{n}');
    return f.replace('{n}', function () { return String(n); });
  }

  /* ── いまの状態 ─────────────────────────────────────────────── */
  var st = { q: '', region: 'all', type: 'all', view: 'card' };
  var counts = { all: CARDS.length }, lastRegion = st.region;

  function apply() {
    var Q = query(st.q), n = 0, first = [], rest = [];
    counts = {};
    CODES.forEach(function (c) { counts[c] = 0; });
    counts.all = 0;
    CARDS.forEach(function (c) {
      var t = tier(c, Q), typeOk = st.type === 'all' || (st.type === 'taxfree' ? c.tax : c.type === st.type), hit = t >= 0 && typeOk;
      if (hit) { counts.all++; counts[c.region] = (counts[c.region] || 0) + 1; }
      var on = hit && (st.region === 'all' || c.region === st.region);
      if (c.li.hidden === on) c.li.hidden = !on;
      if (on) n++;
      (t === 0 ? first : rest).push(c);
    });
    /* 並び：何も打っていなければページの並び・打っていれば、ぴったり同じものを先に（どちらもページの並び）。違うときだけ並べ直す */
    var want = Q.C === '' ? CARDS : first.concat(rest), now = GRID.querySelectorAll('li[data-slug]'), moved = false;
    for (var i = 0; i < want.length && !moved; i++) if (now[i] !== want[i].li) moved = true;
    if (moved) want.forEach(function (c) { GRID.appendChild(c.li); });
    /* 地域のボタン（押した見た目は aria-pressed だけ）と、その地域の当たりの数 */
    STRIP.forEach(function (b) {
      var code = b.getAttribute('data-region'), p = code === st.region ? 'true' : 'false', el = b.querySelector('.rstrip-n'), v = String(counts[code] || 0);
      if (b.getAttribute('aria-pressed') !== p) b.setAttribute('aria-pressed', p);
      if (el && el.textContent !== v) el.textContent = v;
    });
    TYPES.forEach(function (b) { var on = b.getAttribute('data-type') === st.type; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    VIEWS.forEach(function (b) { var on = b.getAttribute('data-view') === st.view; b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    /* 結果の見出し ＝ 選んでいる地域の名前 ＋ 見えているカードの数（0 のときは数を書かない）＋ 絞り込みを解除 */
    if (RH) RH.textContent = labelOf(st.region);
    if (CNT) CNT.textContent = n ? fmt(n) : '';
    SCOPES.forEach(function (s) { s.hidden = st.region === 'all'; var l = s.querySelector('.wd-scope-l'); if (l) l.textContent = labelOf(st.region); });
    var any = Q.C !== '' || st.region !== 'all' || st.type !== 'all';
    CLEARS.forEach(function (b) { b.hidden = !any; });
    /* 見つからないとき：どの地域にも無い ＝ 文（S5a）・ほかの地域にだけ在る ＝ その地域のボタン（S5b。文は出さない） */
    if (NONE) NONE.hidden = counts.all !== 0;
    ELSE.forEach(function (b) {
      var code = b.getAttribute('data-region'), k = counts[code] || 0, el = b.querySelector('.wd-else-n');
      b.hidden = !(code !== st.region && k > 0);
      if (el && el.textContent !== String(k)) el.textContent = String(k);
    });
    d.documentElement.classList.toggle('wd-q', Q.C !== '');
    if (st.view === 'range') {
      if (FBAR) FBAR.style.display = 'none';
      GRID.style.display = 'none';
      if (NOR) NOR.style.display = 'none';
      if (RVIEW) RVIEW.style.display = 'block';
      mountWALeveling();
    } else {
      if (FBAR) FBAR.style.display = '';
      if (RVIEW) RVIEW.style.display = 'none';
      GRID.style.display = '';
      if (NOR) NOR.style.display = n ? 'none' : 'block';
    }
    /* 地域が変わり、帯が横にスクロールする幅なら、押したボタンを帯のまんなかへ（scrollIntoView は使わない＝ページは動かさない） */
    if (st.region !== lastRegion && STRIPBOX && STRIPBOX.scrollWidth > STRIPBOX.clientWidth) {
      var b = btnOf(st.region);
      if (b) {
        var sr = STRIPBOX.getBoundingClientRect(), br = b.getBoundingClientRect();
        STRIPBOX.scrollLeft = STRIPBOX.scrollLeft + (br.left - sr.left) - (STRIPBOX.clientWidth - b.offsetWidth) / 2;
      }
    }
    lastRegion = st.region;
    sync();
    tray();
    var c2 = {};
    for (var key in counts) if (Object.prototype.hasOwnProperty.call(counts, key)) c2[key] = counts[key];
    var detail = { q: st.q, region: st.region, type: st.type, view: st.view, n: n, counts: c2 };
    try { d.dispatchEvent(new CustomEvent('wd:change', { detail: detail })); } catch (e) {}
  }

  function set(p) {
    if (Object.prototype.hasOwnProperty.call(p, 'q') && p.q !== st.q) {
      if (st.view === 'range' && !Object.prototype.hasOwnProperty.call(p, 'view')) st.view = 'card';
      if (RELEASE_ON_TYPE && !Object.prototype.hasOwnProperty.call(p, 'region')) st.region = 'all';
    }
    for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) st[k] = p[k];
    apply();
  }
  /* ── 住所と「戻る」（WP-dd-6）──────────────────────────────────
     住所の鍵は q・region・type・view の4つ（既定は書かない・知らない値は無視）。開いたときは住所を書き換えない。
     書くのは history.replaceState だけ ＝ 地域や種類を選び直しても履歴を積まない（このファイルは履歴を1段も足さない）。
     書く時：Enter・Escape・欄の消すボタン（search）・欄の change・カードのリンクを押した時・pagehide・beforeunload・地域・種類・表示・解除。
     打つたび・時計・スクロールでは書かない。history.state ＝ {wd:1, y ＝ その時のスクロール, cmp ＝ 比べる印を付けた社}。 */
  var TYPE_CODES = ['fsc', 'lcc', 'taxfree'];
  var cmp = [], LVL = null;
  var cardOf = function (slug) { for (var i = 0; i < CARDS.length; i++) if (CARDS[i].slug === slug) return CARDS[i]; return null; };
  /** history.state の cmp から、このページで印を付けられる社だけを1回ずつ、付けた順に、足せるあいだだけ（canAdd と同じ決まり） */
  function cmpOf(a) {
    var out = [];
    (Array.isArray(a) ? a : []).forEach(function (s) { if (typeof s === 'string' && boxOf(s) && out.indexOf(s) < 0 && fits(out, s)) out.push(s); });
    return out;
  }
  /** 住所から状態を読む（q は 80 字まで・region は地域のボタンの符号・type は fsc / lcc / taxfree・view は range。ほかは既定） */
  function read() {
    var p = null;
    try { p = new URLSearchParams(w.location.search); } catch (e) { p = null; }
    var g = function (k) { return (p && p.get(k)) || ''; }, region = g('region'), type = g('type');
    return {
      q: g('q').slice(0, 80),
      region: CODES.indexOf(region) >= 0 ? region : 'all',
      type: TYPE_CODES.indexOf(type) >= 0 ? type : 'all',
      view: g('view') === 'range' ? 'range' : 'card',
    };
  }
  function same(a, b) { return a.q === b.q && a.region === b.region && a.type === b.type && a.view === b.view; }
  /** 状態を書いた住所（ほかの鍵 ref・utm_* と # はそのまま残す） */
  function url(s) {
    var p = new URLSearchParams(w.location.search);
    ['q', 'region', 'type', 'view'].forEach(function (k) { p.delete(k); });
    if (s.q !== '') p.set('q', s.q);
    if (s.region !== 'all') p.set('region', s.region);
    if (s.type !== 'all') p.set('type', s.type);
    if (s.view !== 'card') p.set('view', s.view);
    var qs = p.toString();
    return w.location.pathname + (qs ? '?' + qs : '') + w.location.hash;
  }
  function hs() { return { wd: 1, y: Math.round(w.scrollY || w.pageYOffset || 0), cmp: cmp.slice() }; }
  /* 住所はそのまま、history.state だけ書き直す */
  function save() { try { w.history.replaceState(hs(), '', w.location.href); } catch (e) {} }
  /* 住所に書く（状態が住所と同じなら住所は触らない） */
  function commit() { try { w.history.replaceState(hs(), '', same(read(), st) ? w.location.href : url(st)); } catch (e) {} }
  /** 戻ってきた時のスクロール。今・DOMContentLoaded のあとの1コマ・load の3回。読む人が押した・回した・触った・打ったら、もう動かさない */
  function restoreY(y) {
    y = Math.round(Number(y) || 0);
    if (!(y > 0)) return;
    var touched = false, stop = function () { touched = true; };
    ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(function (ev) { w.addEventListener(ev, stop, { capture: true, once: true, passive: true }); });
    var go = function () {
      if (touched || Math.abs((w.scrollY || w.pageYOffset || 0) - y) <= 1) return;
      try { w.scrollTo({ top: y, left: 0, behavior: 'instant' }); } catch (e) { w.scrollTo(0, y); }   // html{scroll-behavior:smooth} に流されない
    };
    go();
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { w.requestAnimationFrame(go); }, { once: true });
    else w.requestAnimationFrame(go);
    if (d.readyState !== 'complete') w.addEventListener('load', go, { once: true });
  }
  /** 地域を選ぶ（同じ地域をもう1回 ＝ すべて） */
  function setRegion(code) {
    code = CODES.indexOf(code) >= 0 ? code : 'all';
    set({ region: code !== 'all' && code === st.region ? 'all' : code });
    commit();
  }
  /** 絞り込みを全部外す（検索欄も空に） */
  function clear() {
    if (FIELD) FIELD.value = '';
    set({ q: '', region: 'all', type: 'all' });
    commit();
  }

  /* ── 比べる印と盆（WP-dd-7 ＝ E11 DJ ＋ DK の「2社まで」）────────────────────
     印（.wd-cmp-i。付けるカードは gen-directory.mjs の tickOf が決める）を付けた社を、付けた順に cmp へ。5社まで。
     機種の段（data-lvl）の無い社が入るときは2社まで（T6）。印を付け外ししても住所は変えない（history.state だけ ＝ save()）。
     盆（#wd-tray）＝ 何社目か・付けた社（押すと外れる）・2社とも2社比較で出せる社（data-two）なら「航空会社を比較」（日本語のページだけ在る）・
     どの社も機種の段を持つなら「レベリング比較」（図へは段を持つ社だけを渡す）。
     ★ 盆の社名は createElement ＋ textContent で作る（HTML の字を組み立てない）。 */
  var MAX = 5;
  var TRAY = $('wd-tray'), TRAY_N = $('wd-tray-n'), TRAY_LIST = $('wd-tray-list'), TRAY_TWO = $('wd-tray-two'), TRAY_LVL = $('wd-tray-lvl');
  var TICKS = all('#airline-grid .wd-cmp-i');
  function boxOf(slug) { for (var i = 0; i < TICKS.length; i++) if (TICKS[i].value === slug) return TICKS[i]; return null; }
  function lvl(slug) { var c = cardOf(slug); return !!c && c.lvl; }
  function two(slug) { var c = cardOf(slug); return !!c && c.two; }
  /** list に slug を足せるか（どの社も段を持つなら5社まで・段の無い社が入るなら2社まで） */
  function fits(list, slug) { return list.length < (list.concat([slug]).every(lvl) ? MAX : 2); }
  function limit() { return cmp.every(lvl) ? MAX : 2; }
  function canAdd(slug) { return fits(cmp, slug); }
  /** 印の見た目 ＝ cmp（付いている・もう足せない印は押せない） */
  function sync() {
    TICKS.forEach(function (b) {
      var on = cmp.indexOf(b.value) >= 0, off = !on && !canAdd(b.value);
      if (b.checked !== on) b.checked = on;
      if (b.disabled !== off) b.disabled = off;
    });
  }
  /** 盆（印が1つも無い・レベリング比較を見ているあいだは隠す） */
  function tray() {
    if (!TRAY) return;
    var show = cmp.length > 0 && st.view === 'card';
    if (TRAY.hidden === show) TRAY.hidden = !show;
    if (TRAY_N) {
      var t = (TRAY.getAttribute('data-fmt') || '{n} / {m}').replace('{n}', function () { return String(cmp.length); }).replace('{m}', function () { return String(limit()); });
      if (TRAY_N.textContent !== t) TRAY_N.textContent = t;
    }
    if (TRAY_LIST) {
      var now = Array.prototype.map.call(TRAY_LIST.children, function (b) { return b.getAttribute('data-slug'); });
      if (now.join(' ') !== cmp.join(' ')) {
        while (TRAY_LIST.firstChild) TRAY_LIST.removeChild(TRAY_LIST.firstChild);
        cmp.forEach(function (s) {
          var b = d.createElement('button'), n = $('wn-' + s);
          b.type = 'button';
          b.setAttribute('data-slug', s);
          b.setAttribute('aria-pressed', 'true');
          b.textContent = n ? n.textContent : s;
          TRAY_LIST.appendChild(b);
        });
        if (cmp.length > now.length) TRAY_LIST.scrollLeft = TRAY_LIST.scrollWidth;   // 足した社（いちばん右）が見えるように
      }
    }
    var pair = cmp.length === 2 && two(cmp[0]) && two(cmp[1]);
    if (TRAY_TWO) {
      if (TRAY_TWO.hidden === pair) TRAY_TWO.hidden = !pair;
      if (pair) TRAY_TWO.setAttribute('href', 'career.html?view=compare&a=' + encodeURIComponent(cmp[0]) + '&b=' + encodeURIComponent(cmp[1]));
    }
    TRAY.classList.toggle('is-two', !!TRAY_TWO && pair);
    if (TRAY_LVL) { var lv = cmp.length >= 1 && cmp.every(lvl); if (TRAY_LVL.hidden === lv) TRAY_LVL.hidden = !lv; }
  }

  /* ── 古い地図（#world-svg・ピン・吹き出しを知っているのはここだけ）───────── */
  function oldMap() {
    var tip = $('map-tooltip');
    all('.map-region-group, .pin-group').forEach(function (el) {
      var rid = el.getAttribute('data-region'), btn = btnOf(rid);
      if (!btn) return;
      var rc = btn.getAttribute('data-rc') || '';
      el.addEventListener('mouseenter', function () {
        if (!tip) return;
        tip.textContent = btn.getAttribute('data-emoji') + ' ' + btn.getAttribute('data-label') + '  ' + fmt(total(rid));
        tip.style.color = rc; tip.style.borderColor = rc + '44'; tip.style.opacity = '1';
      });
      el.addEventListener('mousemove', function (e) {
        var svg = $('world-svg');
        if (!tip || !svg) return;
        var r = svg.getBoundingClientRect();
        tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px';
      });
      el.addEventListener('mouseleave', function () { if (tip) tip.style.opacity = '0'; });
      el.addEventListener('click', function () { setRegion(rid); GRID.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    });
    STRIP.forEach(function (b) { var el = $('pc-' + b.getAttribute('data-region')); if (el) el.textContent = fmt(total(b.getAttribute('data-region'))); });
    function paint(id) {
      all('.map-region-group').forEach(function (g) {
        var on = id === 'all' || id === g.getAttribute('data-region');
        Array.prototype.forEach.call(g.querySelectorAll('.rgn'), function (p) { p.classList.toggle('active', on); });
      });
      all('.pin-group').forEach(function (pg) { pg.classList.toggle('active', id === 'all' || id === pg.getAttribute('data-region')); });
    }
    d.addEventListener('wd:change', function (e) { paint(e.detail && e.detail.region || 'all'); });
    all('.rgn').forEach(function (p) { p.classList.add('active'); });
  }

  /* ── Salary leveling grid：index と同一の Levels.fyi 型カラムを共有モジュール PVLeveling にマウント ── */
  var waLvlMounted = false, waLvlWait = false;
  // レンジタブ初回表示時に1回だけマウント（隠れた要素での display:none 初期化差異を回避）。
  // 住所が ?view=range のとき、この台本は salary-leveling.js より先に走る ── まだ PVLeveling が無ければ、
  // DOMContentLoaded（どの台本も走り終わったあと）に1回だけ自分を呼び直す（その時もレベリング比較のままなら）。
  function mountWALeveling(){
    if(!waLvlMounted && typeof PVLeveling==='undefined' && d.readyState==='loading'){
      if(!waLvlWait){ waLvlWait = true; d.addEventListener('DOMContentLoaded', function(){ if(st.view==='range') mountWALeveling(); }, { once: true }); }
      return;
    }
    if(waLvlMounted || typeof PVLeveling==='undefined' || !PVLeveling.mount) return;
    const META = {};
    (window.PV_AIRLINES||[]).forEach(a=>{ META[window.PV_slugOf(a)] = a; });
    LVL = PVLeveling.mount('#lvl-wa-grid', {
      tip:'#lvl-wa-tip', layout:'levels', picker:'#lvl-wa-picker',
      quick:['ana','jal','emirates','delta','united','singapore-airlines'],
      max:5, pool:'all', slugs:['ana','jal','emirates','delta'],
      mode:'all', meta:META
    });
    waLvlMounted = true;
    // 戻ってきた時の比べる印（history.state の cmp）が、どれもレベリングの段を持つ社なら、図にもその社を出す
    if (LVL && LVL.setSlugs && cmp.length && cmp.every(function (s) { var c = cardOf(s); return !!c && c.lvl; })) LVL.setSlugs(cmp.slice());
  }

  /* ── 押したとき・打ったとき ──────────────────────────────────── */
  if (FIELD) {
    FIELD.addEventListener('input', function () { set({ q: FIELD.value }); });
    FIELD.addEventListener('keydown', function (e) {
      if (e.isComposing || e.keyCode === 229) return;   // 変換を決める Enter は検索の Enter ではない
      if (e.key === 'Enter') {
        commit();
        if (RHBOX) w.scrollTo(0, Math.max(0, RHBOX.getBoundingClientRect().top + w.pageYOffset - 86));   // 結果の見出しを、上の帯のすぐ下へ
        if (coarse()) FIELD.blur();                                                                         // スマホは鍵盤を閉じて結果を見せる
      } else if (e.key === 'Escape' && FIELD.value) {
        FIELD.value = '';
        set({ q: '' });
        commit();
      }
    });
    FIELD.addEventListener('search', function () { set({ q: FIELD.value }); commit(); });   // 欄の中の消すボタン（×）
    FIELD.addEventListener('change', function () { commit(); });                           // 打ち終えて欄を離れた（言語のボタンを押す時も、先にここが走る）
  }
  /* カードのリンクを押した時（移る前に住所とスクロールを書いておく ＝「戻る」で同じ一覧の同じ場所へ） */
  GRID.addEventListener('click', function (e) { var t = e.target; if (t && t.closest && t.closest('a.wd-go')) commit(); }, true);
  w.addEventListener('pagehide', function () { commit(); });
  /* 再読み込みでは pagehide の中で書いた history.state が残らない（Chromium で実測）＝ 同じ場所へ戻すため、離れる直前にも書く。
     問いかけは出さない（preventDefault も returnValue も使わない）。 */
  w.addEventListener('beforeunload', function () { commit(); });
  STRIP.forEach(function (b) { b.addEventListener('click', function () { setRegion(b.getAttribute('data-region')); }); });
  SCOPES.forEach(function (s) { s.addEventListener('click', function () { setRegion('all'); }); });
  ELSE.forEach(function (b) {
    b.addEventListener('click', function () { setRegion(b.getAttribute('data-region')); if (RH) RH.focus(); });
  });
  CLEARS.forEach(function (b) {
    b.addEventListener('click', function () { clear(); if (FIELD && !coarse()) FIELD.focus(); });
  });
  TYPES.forEach(function (b) { b.addEventListener('click', function () { set({ type: b.getAttribute('data-type') || 'all' }); commit(); }); });
  VIEWS.forEach(function (b) { b.addEventListener('click', function () { set({ view: b.getAttribute('data-view') === 'range' ? 'range' : 'card' }); commit(); }); });
  /* 比べる印を付ける・外す（足せないときは付けない）。住所は変えない */
  GRID.addEventListener('change', function (e) {
    var b = e.target;
    if (!b || !b.classList || !b.classList.contains('wd-cmp-i')) return;
    var s = b.value, i = cmp.indexOf(s);
    if (b.checked) { if (i < 0 && canAdd(s)) cmp.push(s); else if (i < 0) b.checked = false; }
    else if (i >= 0) cmp.splice(i, 1);
    sync(); tray(); save();
  });
  /* 盆の社名を押す ＝ その社の印を外す（押せる場所は次の社名へ。最後の1社なら、その社の印へ） */
  if (TRAY_LIST) TRAY_LIST.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button[data-slug]') : null;
    if (!b) return;
    var s = b.getAttribute('data-slug'), i = cmp.indexOf(s);
    if (i < 0) return;
    cmp.splice(i, 1);
    sync(); tray(); save();
    var next = TRAY_LIST.children[Math.min(i, TRAY_LIST.children.length - 1)], box = boxOf(s);
    if (next) next.focus();
    else if (box && box.getClientRects().length) box.focus();
  });
  /* 盆の「レベリング比較」＝ 印を付けた社だけの図へ（行きの一方だけ。図の中の会社選びはそのまま使える）。表示の切り替えの帯を画面の上へ */
  if (TRAY_LVL) TRAY_LVL.addEventListener('click', function () {
    var slugs = cmp.slice();
    if (!slugs.length || !slugs.every(lvl)) return;
    set({ view: 'range' });
    commit();
    mountWALeveling();
    if (LVL && LVL.setSlugs) LVL.setSlugs(slugs);
    var vt = d.querySelector('.view-toggle');
    if (vt) { var top = vt.getBoundingClientRect().top; if (top < 0 || top > w.innerHeight) w.scrollTo(0, Math.max(0, top + w.pageYOffset - 86)); }
  });

  /* ── はじめ（古いページが持っていた地域のボタンの直書きの見た目と class active を外す）── */
  STRIP.forEach(function (b) { b.style.removeProperty('background'); b.style.removeProperty('border-color'); b.style.removeProperty('color'); b.classList.remove('active'); });
  /* 住所の状態を先に、そのあとスクロール（開いた時は住所も履歴も書かない） */
  if ('scrollRestoration' in w.history) { try { w.history.scrollRestoration = 'manual'; } catch (e) {} }
  var HS = null;
  try { HS = w.history.state; } catch (e) { HS = null; }
  st = read();
  if (FIELD) FIELD.value = st.q;
  if (HS && HS.wd) cmp = cmpOf(HS.cmp);
  oldMap();
  apply();
  restoreY(HS && HS.wd && HS.y);
  /* ページの中の # の移動（このページの履歴の中を行き来した時）は、住所を読み直す */
  w.addEventListener('popstate', function (e) {
    var s = e.state && e.state.wd ? e.state : null;
    st = read();
    if (s) cmp = cmpOf(s.cmp);
    if (FIELD) FIELD.value = st.q;
    apply();
    if (s) { try { w.scrollTo({ top: s.y || 0, left: 0, behavior: 'instant' }); } catch (x) { w.scrollTo(0, s.y || 0); } }
  });
  /* 戻る（ブラウザの手元に置いてあった時 ＝ pageshow の persisted）は、離れた時のまま ── 何もしない */

  w.PVDirectory = {
    state: function () { return { q: st.q, region: st.region, type: st.type, view: st.view }; },
    setRegion: setRegion,
    clear: clear,
    regions: function () { return STRIP.map(function (b) { var c = b.getAttribute('data-region'); return { code: c, label: b.getAttribute('data-label') || '', n: counts[c] || 0 }; }); },
    count: function (code) { return counts[code] || 0; },
  };

  // ── Nav scroll ─────────────────────────────────────────────────────
  window.addEventListener('scroll',()=>{
    const nav=document.getElementById('main-nav'); if(nav) nav.classList.toggle('scrolled',window.scrollY>40);
  },{passive:true});

  // ── THEME TOGGLE ───────────────────────────────────────────────────
  const SUN_SVG_W  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  const MOON_SVG_W = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  function applyThemeW(t){
    document.documentElement.setAttribute('data-theme',t);
    try { localStorage.setItem('pv-theme',t); } catch (e) {}   // 保存領域を閉じたブラウザでも色は替わる
    const btn=document.getElementById('theme-toggle');
    if(btn) btn.innerHTML=t==='dark'?SUN_SVG_W:MOON_SVG_W;
  }
  const TT=document.getElementById('theme-toggle');
  if(TT) TT.addEventListener('click',function(){
    const next=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
    applyThemeW(next);
  });
  try {
    applyThemeW(localStorage.getItem('pv-theme')||'light');
  } catch (e) { applyThemeW('light'); }   // 保存領域が読めなければ明るい色（何も選んでいない人と同じ）
})(window, document);
