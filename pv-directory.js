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
   ★ 住所（?q=・region・view・cmp）と「戻る」は WP-dd-6。履歴に触るのは commit()・save() と、開いた時に古い ?type= を消す cleanType() の3つ
     （どれも replaceState）と、狭い画面の「会社を追加」の板が積む1段（openAdd() の pushState・閉じると戻す）だけ。
   ★ 航空会社の種類（FSC・LCC/ULCC・免税）で絞る口は無い（WP-dmap-7・オーナー P12.114）。カードも種類を持たない。
   ★ 比べる印と比較リスト（#wd-tray）は WP-dd-7 → WP-dmap-10。印を付ける・外すは住所の cmp だけを書き直す（save()）。 */
(function (w, d) {
  'use strict';
  var GRID = d.getElementById('airline-grid');
  if (!GRID) return;
  var $ = function (id) { return d.getElementById(id); };
  var all = function (sel) { return Array.prototype.slice.call(d.querySelectorAll(sel)); };
  var FIELD = $('search'), CNT = $('result-count'), RH = $('wd-rh-name'), RHBOX = $('wd-rh'), STRIPBOX = $('region-strip');
  var NOR = $('no-results'), NONE = $('wd-none'), RVIEW = $('range-view'), FBAR = $('filter-bar');
  var STRIP = all('#region-strip .rstrip-btn'), ELSE = all('#wd-else .wd-else-b'), SCOPES = [$('wd-scope'), $('wd-scope-e')].filter(Boolean);
  var CLEARS = all('.wd-clear'), VIEWS = all('.view-btn');
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
      li: li, slug: a('data-slug'), region: a('data-region'),
      lvl: a('data-lvl') === '1', two: a('data-two') === '1', i: i,
      codes: a('data-c').split(' ').filter(Boolean).map(compact),
      keys: a('data-k').split('|').filter(Boolean).map(function (k) { var S = spaced(k); return { S: S, C: S.replace(/ /g, function () { return ''; }), W: starts(S) }; }),
    };
  });
  var CODES = STRIP.map(function (b) { return b.getAttribute('data-region'); });
  var btnOf = function (code) { for (var i = 0; i < STRIP.length; i++) if (STRIP[i].getAttribute('data-region') === code) return STRIP[i]; return null; };
  var labelOf = function (code) { var b = btnOf(code); return b ? b.getAttribute('data-label') || '' : ''; };
  /** 社数の字（data-fmt。英語ページの1社だけ data-fmt-one ＝ «1 airline»） */
  function fmt(n) {
    var one = CNT && CNT.getAttribute('data-fmt-one'), f = (n === 1 && one) ? one : ((CNT && CNT.getAttribute('data-fmt')) || '{n}');
    return f.replace('{n}', function () { return String(n); });
  }

  /* ── いまの状態 ─────────────────────────────────────────────── */
  var st = { q: '', region: 'all', view: 'card' };
  var counts = { all: CARDS.length }, lastRegion = st.region;

  function apply() {
    var Q = query(st.q), n = 0, first = [], rest = [];
    counts = {};
    CODES.forEach(function (c) { counts[c] = 0; });
    counts.all = 0;
    CARDS.forEach(function (c) {
      var t = tier(c, Q), hit = t >= 0;
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
    VIEWS.forEach(function (b) { var on = b.getAttribute('data-view') === st.view; b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    /* 結果の見出し ＝ 選んでいる地域の名前 ＋ 見えているカードの数（0 のときは数を書かない）＋ 絞り込みを解除 */
    if (RH) RH.textContent = labelOf(st.region);
    if (CNT) CNT.textContent = n ? fmt(n) : '';
    SCOPES.forEach(function (s) { s.hidden = st.region === 'all'; var l = s.querySelector('.wd-scope-l'); if (l) l.textContent = labelOf(st.region); });
    var any = Q.C !== '' || st.region !== 'all';
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
    balance();
    edge(STRIPBOX);
    sync();
    tray();
    var c2 = {};
    for (var key in counts) if (Object.prototype.hasOwnProperty.call(counts, key)) c2[key] = counts[key];
    var detail = { q: st.q, region: st.region, view: st.view, n: n, counts: c2 };
    try { d.dispatchEvent(new CustomEvent('wd:change', { detail: detail })); } catch (e) {}
  }

  /* ── 横にすべる列の端と、折り返す帯の行（WP-dmap-8）──────────────────────────
     横にすべる列は、入りきらなければ続きが在る側を data-edge に書き（l・r・l r。すべらない時は書かない）、CSS がその端をうすく消す（字は足さない）。
     いまはすべる列が無い（地域のボタンは WP-dmap-9 から折り返し、比較リストの行は WP-dmap-10 から縦に並ぶ）が、道具は残してある。
     帯が折り返す幅（821px から）で、そのままでは2行になる時だけ
     is-bal を付ける（CSS が5つ目の後ろで行を変える ＝ 最後の行に1つだけ残らない）。見た目を決めるのは CSS（ここは属性と class を1つずつ書くだけ） */
  function edge(el) {
    if (!el) return;
    var max = el.scrollWidth - el.clientWidth, x = Math.abs(el.scrollLeft), v = '';
    if (max > 1) v = x > 1 && x < max - 1 ? 'l r' : (x > 1 ? 'l' : 'r');
    if ((el.getAttribute('data-edge') || '') !== v) { if (v) el.setAttribute('data-edge', v); else el.removeAttribute('data-edge'); }
  }
  /* WP-dmap-9：地域のボタンはどの幅でも折り返す（820px までも ── オーナー #8「切れないようにして」）。そのままで3行になる幅（スマホ）は
     3つずつ（is-bal3）。どちらも付けたあとで行の数を数え直し、増えたら外す（入りきらない並べ方にしない） */
  function lines() { var t = {}; STRIP.forEach(function (b) { t[b.offsetTop] = 1; }); return Object.keys(t).length; }
  function balance() {
    if (!STRIPBOX) return;
    STRIPBOX.classList.remove('is-bal', 'is-bal3');
    var wrap = false;
    try { wrap = w.getComputedStyle(STRIPBOX).flexWrap === 'wrap'; } catch (e) {}
    if (!wrap || !STRIPBOX.getClientRects().length) return;
    var n = lines(), c = n === 2 ? 'is-bal' : n === 3 ? 'is-bal3' : '';
    if (!c) return;
    STRIPBOX.classList.add(c);
    if (lines() !== n) STRIPBOX.classList.remove(c);
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
     住所の鍵は q・region・view の3つ（既定は書かない・知らない値は無視）。開いたときは住所を書き換えない ── ただ1つの例外は古い ?type=
     （種類の絞り込みの住所。WP-dmap-7 で口ごと外した）：すべてとして開き、住所から type だけを消す（cleanType。ほかの鍵・# と history.state はそのまま）。
     書くのは history.replaceState だけ ＝ 地域を選び直しても履歴を積まない（このファイルは履歴を1段も足さない）。
     書く時：Enter・Escape・欄の消すボタン（search）・欄の change・カードのリンクを押した時・pagehide・beforeunload・地域・表示・解除。
     打つたび・時計・スクロールでは書かない。history.state ＝ {wd:1, y ＝ その時のスクロール, cmp ＝ 比べる印を付けた社}。
     ★ WP-dmap-10：比べる社も住所に書く ── cmp（付けた順・空白区切り ＝ ?cmp=jal+ana）。読み直し・共有した住所で同じリストに戻る。
       印を付け外しした時は住所の cmp だけを書き直す（save()。ほかの鍵はそのまま）。開いた時は今までどおり住所を書き換えない
       （知らない社や重なりがあっても、次に書く時まで直さない）。住所に cmp が無ければ history.state の cmp（前からの読み方）。 */
  var cmp = [], LVL = null;
  var cardOf = function (slug) { for (var i = 0; i < CARDS.length; i++) if (CARDS[i].slug === slug) return CARDS[i]; return null; };
  /** 住所の cmp（slug の並び。鍵が無ければ null） */
  function urlCmp() {
    try { var p = new URLSearchParams(w.location.search); return p.has('cmp') ? String(p.get('cmp') || '').split(' ').filter(Boolean) : null; } catch (e) { return null; }
  }
  /** 住所の cmp が今の cmp と同じか（鍵が無いのは「0社」と同じ） */
  function cmpSame() { var u = urlCmp(); return u ? u.length > 0 && u.join(' ') === cmp.join(' ') : cmp.length === 0; }
  /** 住所（または history.state）の cmp から、このページで印を付けられる社だけを1回ずつ、付けた順に、足せるあいだだけ（canAdd と同じ決まり） */
  function cmpOf(a) {
    var out = [];
    (Array.isArray(a) ? a : []).forEach(function (s) { if (typeof s === 'string' && boxOf(s) && out.indexOf(s) < 0 && fits(out, s)) out.push(s); });
    return out;
  }
  /** 住所から状態を読む（q は 80 字まで・region は地域のボタンの符号・view は range。ほかは既定） */
  function read() {
    var p = null;
    try { p = new URLSearchParams(w.location.search); } catch (e) { p = null; }
    var g = function (k) { return (p && p.get(k)) || ''; }, region = g('region');
    return {
      q: g('q').slice(0, 80),
      region: CODES.indexOf(region) >= 0 ? region : 'all',
      view: g('view') === 'range' ? 'range' : 'card',
    };
  }
  function same(a, b) { return a.q === b.q && a.region === b.region && a.view === b.view; }
  /** 古い住所の ?type=（fsc・lcc・ulcc・taxfree …どの値でも）を消す。すべてとして開き、ほかの鍵と # と history.state はそのまま（WP-dmap-7） */
  function cleanType() {
    try {
      var p = new URLSearchParams(w.location.search);
      if (!p.has('type')) return;
      p.delete('type');
      var qs = p.toString();
      w.history.replaceState(w.history.state, '', w.location.pathname + (qs ? '?' + qs : '') + w.location.hash);
    } catch (e) {}
  }
  /** 状態を書いた住所（ほかの鍵 ref・utm_* と # はそのまま残す。古い type は書かない。比べる社 cmp は最後に） */
  function url(s) {
    var p = new URLSearchParams(w.location.search);
    ['q', 'region', 'type', 'view', 'cmp'].forEach(function (k) { p.delete(k); });
    if (s.q !== '') p.set('q', s.q);
    if (s.region !== 'all') p.set('region', s.region);
    if (s.view !== 'card') p.set('view', s.view);
    if (cmp.length) p.set('cmp', cmp.join(' '));
    var qs = p.toString();
    return w.location.pathname + (qs ? '?' + qs : '') + w.location.hash;
  }
  /** 今の住所の cmp だけを書き直した住所（ほかの鍵と # はそのまま） */
  function urlCmpOnly() {
    var p = new URLSearchParams(w.location.search);
    p.delete('cmp');
    if (cmp.length) p.set('cmp', cmp.join(' '));
    var qs = p.toString();
    return w.location.pathname + (qs ? '?' + qs : '') + w.location.hash;
  }
  /* 地図の全画面（WP-dmap-9）と「会社を追加」の板（WP-dmap-10）が積んだ1段には wamfs・wdadd の印が在る。その段の上で書き直しても印を落とさない
     （落とすと、開いたまま読み直した時に、その段が自分の段だと分からなくなる ＝ 開き直すたびに1段ずつ積み増す） */
  function hs() {
    var s = { wd: 1, y: Math.round(w.scrollY || w.pageYOffset || 0), cmp: cmp.slice() };
    try { var h = w.history.state; if (h && h.wamfs) s.wamfs = 1; if (h && h.wdadd) s.wdadd = 1; } catch (e) {}
    return s;
  }
  /* 比べる社を書く ＝ 住所の cmp だけ（同じなら住所は触らない）と history.state */
  function save() { try { w.history.replaceState(hs(), '', cmpSame() ? w.location.href : urlCmpOnly()); } catch (e) {} }
  /* 住所に書く（状態が住所と同じなら住所は触らない） */
  function commit() { try { w.history.replaceState(hs(), '', same(read(), st) && cmpSame() ? w.location.href : url(st)); } catch (e) {} }
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
    set({ q: '', region: 'all' });
    commit();
  }

  /* ── 比べる印と比較リスト（WP-dd-7 の印と盆を、WP-dmap-10 で作り直した ── オーナー「膨大な量の航空会社がある中で、カードにチェックつけるだけしか
     方法ないのキツくない？何らかの方法でカードを絞れて（検索とか）でチェックをつけた会社は右に会社名がでるとか？」）─────────────
     比べる社は cmp（付けた順）。決まりは今までどおり：5社まで・機種の段（data-lvl）の無い社が入るときは2社まで（T6）。
     足す口は3つ ── カードの「＋ 比較」（button.wd-cmp・aria-pressed。付けるカードは gen-directory.mjs の tickOf が決める）／
     リストの欄（#wd-cl-q。ページの検索と同じ道具 query・tier・同じ鍵。地域では絞らない）／住所の cmp。
     リスト（#wd-tray）＝ 題・何社目か・行（ロゴ・社名・外す ×）・欄・決まりの行・「航空会社を比較」（ちょうど2社で、2社とも data-two）・
     「レベリング比較」（2〜5社で、どの社も機種の段を持つ）。押せない物（足せない印・そろっていないボタン・足せない候補）は灰色にするだけでなく、
     なぜかを持つ（aria-describedby ＝ 決まりの行 #wd-cl-rule・段の無い社の理由 #wd-cl-why ／ title。押すと、その行を強める）。
     広い画面（1001px から）はカードの右に貼りつくリスト（0社でも出る）。狭い画面は画面の下の盆（1社から）で、1行に畳め（次の1手だけ）、
     欄は「＋ 会社を追加」で下から出る板（履歴を1段 ── 戻る・Esc・閉じる・幕を押すで閉じる。足した社はそのまま）。
     ★ リストの行と候補の社名・ロゴは、カードの物を写す（createElement ＋ textContent ＋ cloneNode。HTML の字を組み立てない）。
     ★ 字はページの物だけ（gen-directory.mjs の WORDS・LIST が書く。外すの字 data-rm・付けたの字 data-on）。ここに言葉を書かない。 */
  var MAX = 5;
  var BODY = $('wd-body'), TRAY = $('wd-tray'), TRAY_N = $('wd-tray-n'), TRAY_LIST = $('wd-tray-list'), TRAY_TWO = $('wd-tray-two'), TRAY_LVL = $('wd-tray-lvl');
  var FOLD = $('wd-cl-fold'), SHUT = $('wd-cl-close'), OPEN = $('wd-cl-open'), EMPTY = $('wd-cl-empty'), RULE = $('wd-cl-rule'), WHY = $('wd-cl-why');
  var AQ = $('wd-cl-q'), OPTS = $('wd-cl-opts'), ANONE = $('wd-cl-none');
  var TICKS = all('#airline-grid button.wd-cmp');
  var WIDE = null;
  try { WIDE = w.matchMedia('(min-width:1001px)'); } catch (e) { WIDE = null; }
  function wide() { return !!(WIDE && WIDE.matches); }
  function boxOf(slug) { for (var i = 0; i < TICKS.length; i++) if (TICKS[i].value === slug) return TICKS[i]; return null; }
  function lvl(slug) { var c = cardOf(slug); return !!c && c.lvl; }
  function two(slug) { var c = cardOf(slug); return !!c && c.two; }
  /** list に slug を足せるか（どの社も段を持つなら5社まで・段の無い社が入るなら2社まで） */
  function fits(list, slug) { return list.length < (list.concat([slug]).every(lvl) ? MAX : 2); }
  function limit() { return cmp.every(lvl) ? MAX : 2; }
  function canAdd(slug) { return fits(cmp, slug); }
  /** 足せない理由の行（段の無い社 ＝ その理由と決まり・ほか ＝ 決まり） */
  function whyOf(slug) { return lvl(slug) ? 'wd-cl-rule' : 'wd-cl-why wd-cl-rule'; }
  /** 押せない形（ids ＝ なぜかを書いた行の id。'' ＝ 理由は書かない）／押せる形（ids ＝ null） */
  function offState(el, ids) {
    if (!el) return;
    var put = function (k, v) { if (v == null) { if (el.hasAttribute(k)) el.removeAttribute(k); } else if (el.getAttribute(k) !== v) el.setAttribute(k, v); };
    var t = ids ? ids.split(' ').map(function (id) { var x = $(id); return x ? x.textContent : ''; }).filter(Boolean).join('\n') : '';
    put('aria-disabled', ids == null ? null : 'true');
    put('aria-describedby', ids || null);
    put('title', t || null);
  }
  /** 印の見た目 ＝ cmp（付いている ＝ aria-pressed・もう足せない ＝ 押せない形となぜか） */
  function sync() {
    TICKS.forEach(function (b) {
      var on = cmp.indexOf(b.value) >= 0, p = on ? 'true' : 'false';
      if (b.getAttribute('aria-pressed') !== p) b.setAttribute('aria-pressed', p);
      offState(b, !on && !canAdd(b.value) ? whyOf(b.value) : null);
    });
  }
  /* 押せない物を押した ＝ なぜかを見せる（決まりの行を強める・段の無い社ならその理由の行も出す。狭い画面で畳んでいれば開く）。何か変わると戻る */
  function ping(ids) {
    if (!TRAY || TRAY.hidden) return;
    if (!wide() && !adding) foldTray(true);
    if (RULE) RULE.classList.add('is-ping');
    if (WHY && ids && ids.indexOf('wd-cl-why') >= 0) { WHY.hidden = false; WHY.classList.add('is-ping'); }
  }
  function unping() {
    if (RULE) RULE.classList.remove('is-ping');
    if (WHY) { WHY.hidden = true; WHY.classList.remove('is-ping'); }
  }
  /* 狭い画面の盆の開け閉め（広い画面ではいつも開いた形 ＝ この印は読まない）。⚠️ 名前を fold にしない ── 検索の道具 fold を上書きして検索が止まる */
  var opened = false;
  function foldTray(open) {
    opened = !!open;
    if (TRAY) TRAY.classList.toggle('is-open', opened);
    if (FOLD && FOLD.getAttribute('aria-expanded') !== String(opened)) FOLD.setAttribute('aria-expanded', String(opened));
  }
  /** カードのロゴの札の写し（無ければ空の入れ物）と社名（カードの wn- の字） */
  function logoOf(s) {
    var c = cardOf(s), lg = c ? c.li.querySelector('.wd-logo .pvg-logo') : null, box = d.createElement('span');
    box.className = 'wd-logo wd-cl-logo';
    if (lg) box.appendChild(lg.cloneNode(true));
    return box;
  }
  function nameOf(s) { var n = $('wn-' + s); return n ? n.textContent : s; }
  /** リストの1行（ロゴ・社名・段の無い社ならその理由・外す ×） */
  function row(s) {
    var li = d.createElement('li'), t = d.createElement('span'), name = d.createElement('span'), x = d.createElement('button');
    var rm = (TRAY && TRAY.getAttribute('data-rm')) || '';
    li.className = 'wd-cl-row'; li.setAttribute('data-slug', s);
    t.className = 'wd-cl-t';
    name.className = 'wd-cl-name'; name.textContent = nameOf(s);
    t.appendChild(name);
    if (!lvl(s) && WHY) { var note = d.createElement('span'); note.className = 'wd-cl-note'; note.textContent = WHY.textContent; t.appendChild(note); }
    x.type = 'button'; x.className = 'wd-cl-x'; x.setAttribute('data-slug', s);
    x.setAttribute('aria-label', (rm ? rm + ' ' : '') + name.textContent);
    if (rm) x.title = rm;
    li.appendChild(logoOf(s)); li.appendChild(t); li.appendChild(x);
    return li;
  }
  /** リスト（#wd-tray）の今 ＝ cmp と表示（カード一覧の時だけ・広い画面は0社でも・狭い画面は1社から） */
  function tray() {
    if (!TRAY) return;
    var n = cmp.length, card = st.view === 'card', show = card && (n > 0 || wide());
    if (BODY) BODY.classList.toggle('is-list', card);
    if (!show && adding) shut(true);
    if (TRAY.hidden === show) TRAY.hidden = !show;
    if (!show && opened) foldTray(false);
    if (TRAY_N) {
      var t = (TRAY.getAttribute('data-fmt') || '{n} / {m}').replace('{n}', function () { return String(n); }).replace('{m}', function () { return String(limit()); });
      if (TRAY_N.textContent !== t) TRAY_N.textContent = t;
    }
    if (EMPTY && EMPTY.hidden !== n > 0) EMPTY.hidden = n > 0;
    if (TRAY_LIST) {
      var now = Array.prototype.map.call(TRAY_LIST.children, function (li) { return li.getAttribute('data-slug'); });
      if (now.join(' ') !== cmp.join(' ')) {
        while (TRAY_LIST.firstChild) TRAY_LIST.removeChild(TRAY_LIST.firstChild);
        cmp.forEach(function (s) { TRAY_LIST.appendChild(row(s)); });
      }
    }
    var pair = n === 2 && two(cmp[0]) && two(cmp[1]), lv = n >= 2 && cmp.every(lvl), noLvl = !cmp.every(lvl);
    /* 「航空会社を比較」：2社がそろうまでは行き先を外す（隠れたリンクにも前の2社を残さない ── WP-dd-9 の約束を、外すことで守る） */
    if (TRAY_TWO) {
      var href = pair ? 'career.html?view=compare&a=' + encodeURIComponent(cmp[0]) + '&b=' + encodeURIComponent(cmp[1]) : null;
      if (href) {
        if (TRAY_TWO.getAttribute('href') !== href) TRAY_TWO.setAttribute('href', href);
        if (TRAY_TWO.hasAttribute('role')) TRAY_TWO.removeAttribute('role');
      } else {
        if (TRAY_TWO.hasAttribute('href')) TRAY_TWO.removeAttribute('href');
        if (TRAY_TWO.getAttribute('role') !== 'link') TRAY_TWO.setAttribute('role', 'link');
      }
      offState(TRAY_TWO, pair ? null : (n > 2 ? 'wd-cl-rule' : ''));
    }
    offState(TRAY_LVL, lv ? null : (noLvl ? 'wd-cl-why' : ''));
    TRAY.classList.toggle('is-two', !!TRAY_TWO && pair);
    /* 狭い画面で畳んだ時に出す次の1手（2社がそろえば「航空会社を比較」・レベリング比較ができれば「レベリング比較」・ほかは「＋ 会社を追加」） */
    var main = pair ? TRAY_TWO : (lv ? TRAY_LVL : OPEN);
    [TRAY_TWO, TRAY_LVL, OPEN].forEach(function (x) { if (x) x.classList.toggle('is-main', x === main); });
  }
  function changed() { unping(); sync(); tray(); save(); if (OPTS && !OPTS.hidden) paint(); }

  /* ── リストの欄（ページの検索と同じ道具 query／tier・同じ鍵 ＝ カードの data-c／data-k。並びもページの検索と同じ：ぴったり同じ物を先に・あとはページの
     並び。地域では絞らない ＝ どの地域を見ていても全社から足せる。候補はカードに「＋ 比較」の在る社だけ）── */
  var hits = [], act = -1, adding = false, owned = false, backing = false;
  function find(raw) {
    var Q = query(raw), first = [], rest = [];
    if (Q.C === '') return [];
    CARDS.forEach(function (c) {
      if (!boxOf(c.slug)) return;
      var t = tier(c, Q);
      if (t === 0) first.push(c.slug); else if (t > 0) rest.push(c.slug);
    });
    return first.concat(rest);
  }
  function codeOf(s) { var c = cardOf(s), el = c ? c.li.querySelector('.wd-code') : null; return el ? el.textContent : ''; }
  /** 候補の1行（ロゴ・社名・略号か「付けた」の字） */
  function opt(s) {
    var li = d.createElement('li'), name = d.createElement('span'), tail = d.createElement('span');
    li.id = 'wd-cl-o-' + s; li.className = 'wd-cl-opt'; li.setAttribute('role', 'option'); li.setAttribute('data-slug', s);
    name.className = 'wd-cl-name'; name.textContent = nameOf(s);
    tail.className = 'wd-cl-oc';
    li.appendChild(logoOf(s)); li.appendChild(name); li.appendChild(tail);
    return li;
  }
  /** 候補の今（付けた ＝ 「付けた」の字・押せない形／足せない ＝ 押せない形となぜか／いま選んでいる ＝ aria-selected） */
  function paint() {
    if (!OPTS || !AQ) return;
    var on = (TRAY && TRAY.getAttribute('data-on')) || '';
    Array.prototype.forEach.call(OPTS.children, function (li, k) {
      var s = li.getAttribute('data-slug'), got = cmp.indexOf(s) >= 0, tail = li.lastChild, want = got ? on : codeOf(s), sel = k === act ? 'true' : 'false';
      if (tail && tail.textContent !== want) tail.textContent = want;
      li.classList.toggle('is-on', got);
      offState(li, got ? '' : (canAdd(s) ? null : whyOf(s)));
      if (li.getAttribute('aria-selected') !== sel) li.setAttribute('aria-selected', sel);
    });
    var cur = act >= 0 ? OPTS.children[act] : null;
    if (cur) {
      AQ.setAttribute('aria-activedescendant', cur.id);
      var r = cur.getBoundingClientRect(), b = OPTS.getBoundingClientRect();
      if (r.top < b.top) OPTS.scrollTop -= b.top - r.top; else if (r.bottom > b.bottom) OPTS.scrollTop += r.bottom - b.bottom;
    } else if (AQ.hasAttribute('aria-activedescendant')) AQ.removeAttribute('aria-activedescendant');
  }
  /** 候補を作り直す（字が変わった時）。いま選んでいるのは、足せるいちばん上の候補 */
  function opts() {
    if (!OPTS || !AQ) return;
    var next = find(AQ.value);
    if (next.join(' ') !== hits.join(' ')) {
      hits = next;
      while (OPTS.firstChild) OPTS.removeChild(OPTS.firstChild);
      hits.forEach(function (s) { OPTS.appendChild(opt(s)); });
    }
    act = -1;
    for (var k = 0; k < hits.length; k++) if (cmp.indexOf(hits[k]) < 0 && canAdd(hits[k])) { act = k; break; }
    paint();
  }
  /** 候補を見せる・隠す（打った字があって当たりが無ければ「見つからない」の1行） */
  function setOpen(on) {
    if (!OPTS || !AQ) return;
    var typed = query(AQ.value).C !== '', show = !!on && typed && hits.length > 0, none = !!on && typed && hits.length === 0;
    if (OPTS.hidden === show) OPTS.hidden = !show;
    if (ANONE && ANONE.hidden === none) ANONE.hidden = !none;
    if (AQ.getAttribute('aria-expanded') !== String(show)) AQ.setAttribute('aria-expanded', String(show));
  }
  /** 候補から足す（付けた社・足せない社は足さない ── 足せない時はなぜかを見せる）。欄は空に戻し、フォーカスは欄のまま（続けて足せる） */
  function pick(s) {
    if (!s || cmp.indexOf(s) >= 0) return;
    if (!canAdd(s)) { ping(whyOf(s)); return; }
    cmp.push(s);
    AQ.value = '';
    opts(); setOpen(false);
    changed();
    try { AQ.focus({ preventScroll: true }); } catch (e) { AQ.focus(); }
  }
  /* 狭い画面の「＋ 会社を追加」＝ 下から出る板（地図の全画面と同じ決まり：履歴は1段だけ・読み直しで残った段は使い回す・閉じる・Esc は自分で1回戻す ──
     旗 backing を先に立てるので、戻った知らせはリストを古い段の cmp に戻さない） */
  function openAdd() {
    if (!TRAY || !AQ) return;
    if (wide()) { AQ.focus(); return; }
    if (adding) return;
    try {
      var s0 = w.history.state;
      if (s0 && s0.wdadd) owned = true;
      else { save(); w.history.pushState(Object.assign({}, w.history.state, { wdadd: 1 }), '', w.location.href); owned = true; }
    } catch (e) { owned = false; }
    adding = true;
    TRAY.classList.add('is-adding'); d.documentElement.classList.add('wd-lock');
    TRAY.setAttribute('role', 'dialog'); TRAY.setAttribute('aria-modal', 'true');
    TRAY.setAttribute('aria-label', AQ.getAttribute('aria-label') || ''); TRAY.removeAttribute('aria-labelledby');
    if (SHUT) SHUT.hidden = false;
    AQ.value = ''; opts(); setOpen(false);
    try { AQ.focus({ preventScroll: true }); } catch (e) { AQ.focus(); }
  }
  function shut(quietly) {
    if (!adding) return;
    adding = false;
    TRAY.classList.remove('is-adding'); d.documentElement.classList.remove('wd-lock');
    TRAY.setAttribute('role', 'region'); TRAY.removeAttribute('aria-modal'); TRAY.removeAttribute('aria-label'); TRAY.setAttribute('aria-labelledby', 'wd-cl-h');
    if (SHUT) SHUT.hidden = true;
    setOpen(false);
    if (!quietly && OPEN && OPEN.getClientRects().length) { try { OPEN.focus({ preventScroll: true }); } catch (e) { OPEN.focus(); } }
    if (owned) { owned = false; backing = true; try { w.history.back(); } catch (e) { backing = false; } }
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
        if (RHBOX) {                                                                                        // 結果の見出しを、上の帯（固定のヘッダー）のすぐ下へ
          var rb = RHBOX.getBoundingClientRect(), sb = STRIPBOX && STRIPBOX.getClientRects().length ? STRIPBOX.getBoundingClientRect() : null, ty = rb.top;
          if (sb && sb.top < rb.top && rb.bottom - sb.top <= w.innerHeight - 86) ty = sb.top;               // 真上の地域のボタンも一緒に入るなら、ボタンから（ヘッダーの裏に置かない ── 地図の reveal() と同じ決め方・WP-dmap-7）
          w.scrollTo(0, Math.max(0, ty + w.pageYOffset - 86));
        }
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
  VIEWS.forEach(function (b) { b.addEventListener('click', function () { set({ view: b.getAttribute('data-view') === 'range' ? 'range' : 'card' }); commit(); }); });
  /* カードの「＋ 比較」を押す ＝ 付ける・外す（足せない時は付けず、なぜかを見せる）。住所は cmp だけ書き直す */
  GRID.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button.wd-cmp') : null;
    if (!b || !GRID.contains(b)) return;
    var s = b.value, i = cmp.indexOf(s);
    if (i >= 0) cmp.splice(i, 1);
    else if (canAdd(s)) cmp.push(s);
    else { ping(whyOf(s)); return; }
    changed();
  });
  /* 横にすべる列の端（WP-dmap-8）：すべらせた時・画面の幅が変わった時・書体が届いた時に測り直す */
  if (STRIPBOX) STRIPBOX.addEventListener('scroll', function () { edge(STRIPBOX); }, { passive: true });
  function remeasure() { balance(); edge(STRIPBOX); }
  w.addEventListener('resize', remeasure, { passive: true });
  w.addEventListener('load', remeasure, { once: true });
  try { if (d.fonts && d.fonts.ready) d.fonts.ready.then(remeasure, function () {}); } catch (e) {}
  /* リストの × ＝ その社を外す（押せる場所は次の行の ×。最後の1社なら欄、欄が見えなければその社の印へ） */
  if (TRAY_LIST) TRAY_LIST.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button.wd-cl-x') : null;
    if (!b) return;
    var s = b.getAttribute('data-slug'), i = cmp.indexOf(s);
    if (i < 0) return;
    cmp.splice(i, 1);
    changed();
    var xs = TRAY_LIST.querySelectorAll('button.wd-cl-x'), next = xs[Math.min(i, xs.length - 1)], box = boxOf(s);
    if (next) next.focus();
    else if (AQ && AQ.getClientRects().length) AQ.focus();
    else if (box && box.getClientRects().length) box.focus();
  });
  /* 狭い画面の盆：題の行で開く・畳む／「＋ 会社を追加」で板／板の「閉じる」・幕を押す・Esc で閉じる（Tab は板の中を回る） */
  if (FOLD) FOLD.addEventListener('click', function () { foldTray(!opened); });
  if (OPEN) OPEN.addEventListener('click', openAdd);
  if (SHUT) SHUT.addEventListener('click', function () { shut(); });
  if (TRAY) TRAY.addEventListener('click', function (e) { if (adding && e.target === TRAY && e.clientY < TRAY.getBoundingClientRect().top) shut(); });
  d.addEventListener('keydown', function (e) {
    if (!adding) return;
    if (e.key === 'Escape') { e.preventDefault(); shut(); return; }
    if (e.key !== 'Tab') return;
    var f = Array.prototype.slice.call(TRAY.querySelectorAll('button,input,[role="option"][tabindex]')).filter(function (el) { return !el.hidden && el.getClientRects().length > 0; });
    var i = f.indexOf(d.activeElement);
    if (!f.length) return;
    if (e.shiftKey ? i <= 0 : (i < 0 || i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
  });
  /* 欄：打つたびに候補・↑↓ で選ぶ・Enter で足す・Esc で候補を閉じる（もう1回で字を消す。板の中では板を閉じる）。候補はマウスでも指でも押せる */
  if (AQ && OPTS) {
    AQ.addEventListener('input', function () { opts(); setOpen(true); });
    AQ.addEventListener('focus', function () { if (AQ.value) { opts(); setOpen(true); } });
    AQ.addEventListener('blur', function () { if (!adding) setOpen(false); });
    AQ.addEventListener('keydown', function (e) {
      if (e.isComposing || e.keyCode === 229) return;   // 変換を決める Enter は足す Enter ではない
      var n = hits.length;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!n) return;
        e.preventDefault();
        setOpen(true);
        act = e.key === 'ArrowDown' ? (act + 1) % n : (act <= 0 ? n - 1 : act - 1);
        paint();
      } else if (e.key === 'Enter') {
        if (OPTS.hidden || !n) return;
        e.preventDefault();
        if (act >= 0) { pick(hits[act]); return; }
        for (var k = 0; k < n; k++) if (cmp.indexOf(hits[k]) < 0) { ping(whyOf(hits[k])); return; }   // どの候補も足せない ＝ なぜかを見せる（付けた社だけなら何もしない）
      } else if (e.key === 'Escape') {
        if (adding) return;                                // 板は document の聞き手が閉じる
        if (!OPTS.hidden || (ANONE && !ANONE.hidden)) { e.preventDefault(); setOpen(false); }
        else if (AQ.value) { e.preventDefault(); AQ.value = ''; opts(); }
      }
    });
    OPTS.addEventListener('mousedown', function (e) { e.preventDefault(); });   // 押しても欄からフォーカスを外さない（スマホの鍵盤も閉じない）
    OPTS.addEventListener('click', function (e) {
      var li = e.target && e.target.closest ? e.target.closest('li[data-slug]') : null;
      if (li) pick(li.getAttribute('data-slug'));
    });
  }
  /* 「航空会社を比較」がそろっていない時に押した ＝ なぜかを見せる（行き先が無いので移らない） */
  if (TRAY_TWO) TRAY_TWO.addEventListener('click', function (e) {
    if (TRAY_TWO.getAttribute('aria-disabled') !== 'true') return;
    e.preventDefault();
    ping(TRAY_TWO.getAttribute('aria-describedby') || '');
  });
  /* 画面の幅が広い／狭いをまたいだ（板を開いたまま広くなったら閉じる・広い画面は0社でもリストを出す） */
  if (WIDE) {
    var onWide = function () { if (wide() && adding) shut(true); tray(); };
    try { WIDE.addEventListener('change', onWide); } catch (e) { try { WIDE.addListener(onWide); } catch (x) {} }
  }
  /* 盆の「レベリング比較」＝ 印を付けた社だけの図へ（行きの一方だけ。図の中の会社選びはそのまま使える）。表示の切り替えの帯を画面の上へ */
  /* 盆のボタンを押した直後、押した所の下に図が来ると、ブラウザはマウスが動いていなくても「図の上に来た」と知らせて
     図の吹き出しが開いてしまう。押した点から本当に動くか、キーか指で触れるまで、吹き出しを隠したままにする（WP-dd-9） */
  var TIP = $('lvl-wa-tip');
  function calm(e) {
    if (!TIP) return;
    var x = e && e.clientX, y = e && e.clientY;
    TIP.classList.add('wd-calm');
    function off(ev) {
      if (ev.type === 'mousemove' && Math.abs(ev.clientX - x) < 3 && Math.abs(ev.clientY - y) < 3) return;   // 画面が動いただけ（マウスは同じ所）
      TIP.classList.remove('wd-calm');
      ['mousemove', 'keydown', 'touchstart'].forEach(function (t) { w.removeEventListener(t, off, true); });
    }
    ['mousemove', 'keydown', 'touchstart'].forEach(function (t) { w.addEventListener(t, off, true); });
  }
  if (TRAY_LVL) TRAY_LVL.addEventListener('click', function (e) {
    var slugs = cmp.slice();
    if (slugs.length < 2 || !slugs.every(lvl)) { ping(TRAY_LVL.getAttribute('aria-describedby') || ''); return; }   // 2〜5社・どの社も機種の段
    calm(e);
    set({ view: 'range' });
    commit();
    mountWALeveling();
    if (LVL && LVL.setSlugs) LVL.setSlugs(slugs);
    /* 上の帯（固定のヘッダー）の下に隠れている時も送る（画面の中でも 86px より上はヘッダーの裏 ＝「カード一覧」が押せない ── WP-dd-9） */
    var vt = d.querySelector('.view-toggle');
    if (vt) { var top = vt.getBoundingClientRect().top; if (top < 86 || top > w.innerHeight) w.scrollTo(0, Math.max(0, top + w.pageYOffset - 86)); }
  });

  /* ── はじめ（古いページが持っていた地域のボタンの直書きの見た目と class active を外す）── */
  STRIP.forEach(function (b) { b.style.removeProperty('background'); b.style.removeProperty('border-color'); b.style.removeProperty('color'); b.classList.remove('active'); });
  /* 住所の状態を先に、そのあとスクロール（開いた時は住所も履歴も書かない） */
  if ('scrollRestoration' in w.history) { try { w.history.scrollRestoration = 'manual'; } catch (e) {} }
  var HS = null;
  try { HS = w.history.state; } catch (e) { HS = null; }
  cleanType();
  st = read();
  if (FIELD) FIELD.value = st.q;
  var UC = urlCmp();
  if (UC) cmp = cmpOf(UC);                     // 住所の cmp（共有した住所・読み直し）
  else if (HS && HS.wd) cmp = cmpOf(HS.cmp);   // 前からの読み方（住所に cmp が無い時）
  try { if (HS && HS.wdadd) owned = true; } catch (e) {}   // 「会社を追加」の板を開いたまま読み直した時に残った1段（次に開く時に使い回す ＝ 積み増さない）
  apply();
  restoreY(HS && HS.wd && HS.y);
  /* ページの中の # の移動（このページの履歴の中を行き来した時）は、住所を読み直す。
     ただし「会社を追加」の板の1段が外れた時（閉じる・Esc・戻る）は、リストを今のまま残す（その下の段の cmp は板を開く前の古い物 ──
     読み直さず、今の cmp をその段の住所と history.state に書く） */
  w.addEventListener('popstate', function (e) {
    var s = e.state && e.state.wd ? e.state : null, add = !!(e.state && e.state.wdadd);
    if (backing || (adding && !add)) {
      backing = false;
      if (adding) { owned = false; shut(true); }
      save();
      return;
    }
    if (add && !adding) owned = true;          // 進むで板の段へ来た：次に開く時に使い回す
    st = read();
    var u = urlCmp();
    if (u) cmp = cmpOf(u); else if (s) cmp = cmpOf(s.cmp);
    if (FIELD) FIELD.value = st.q;
    apply();
    if (s) { try { w.scrollTo({ top: s.y || 0, left: 0, behavior: 'instant' }); } catch (x) { w.scrollTo(0, s.y || 0); } }
  });
  /* 戻る（ブラウザの手元に置いてあった時 ＝ pageshow の persisted）は、離れた時のまま ── 何もしない */

  w.PVDirectory = {
    state: function () { return { q: st.q, region: st.region, view: st.view }; },
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

/* ── 地図と地域のまとめ（directory-map）。金額を持たない・通信しない・保存しない・時計を使わない。 ── */
/* 見せる地域 ＝ 指している（マウス）?? 選びかけ（キーボードのフォーカス・地図に指で触れた）?? 選んだ地域（一覧の地域 ＝ 'wd:change'）。
   カードは動かない（9枚を1つの升に重ねてある）。カードの中にフォーカスがある・「条件/出典」が開いているあいだは入れ替えない。
   狭い画面のカードは、選んだ時（と地図に指で触れた時 ── WP-dmap-4）に開き、そのあと閉じない（is-open は足すだけ）。
   ボタンを指・マウスで押して選んだら、結果の見出しを画面に入れる（キーボードで押したときはページを動かさない）。
   「機長｜副操縦士」の切り替え（P12.100）は区域の data-pos だけを書く（履歴にも保存領域にも書かない）。
   地図（.wam-svg）：マウスで指すと見せる・押すと選ぶ（もう1回で外れる）。指で触れると見せるだけで、「この地域の航空会社を見る」が選ぶ（WP-dmap-4）。
   地図は動かせる（WP-dmap-9：拡大・移動・全画面）。動かした・ピンチした指やマウスは選ばない。全画面では押すと見せるだけ（選ぶのはボタン）。 */
(function (w, d) {
  'use strict';
  var sec = d.getElementById('wa-map-sec'); if (!sec) return;          // 古いページ＋新しい台本：何もしない
  var card = d.getElementById('wa-sum'), go = d.getElementById('wa-go'), mount = d.getElementById('pv-rp');
  if (!card || !go || !mount) return;
  var strip = d.getElementById('region-strip'), svg = sec.querySelector('.wam-svg'), root = d.documentElement;
  var each = Array.prototype.forEach, list = Array.prototype.slice;
  var panels = list.call(card.querySelectorAll('.wam-panel'));
  var st = { committed: 'all', hover: null, pick: null, tap: false, key: false, q: false, via: '', press: false };
  /* 動かせる地図（WP-dmap-9）：倍率 k・ずらし x y（箱の単位）・枠のまんなかの地図の点 q・動かしたか moved・つかんでいる drag・指 pin・
     全画面の1段を積んだか owned・全画面を閉じてから選ぶ地域 after・指の一言を出したか hinted */
  var Z = { k: 1, x: 0, y: 0, q: null, moved: false, drag: null, pin: null, owned: false, after: null, hinted: false };
  var reduce = !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion:reduce)').matches);
  function known(c) { return !!c && !!d.getElementById('wam-p-' + c); }                 // (code) -> boolean
  function codeOf(el) {                                                                 // (Element) -> code | null: region controls only
    var n = el && el.closest ? el.closest('.rstrip-btn,.wam-r,.wam-hit') : null, c = n ? n.getAttribute('data-region') : null;
    return n && !card.contains(n) && known(c) ? c : null; }
  function shown() { return st.hover || st.pick || st.committed; }                      // -> code, never null
  function held() { return st.key || !!card.querySelector('details[open]'); }           // -> boolean (D13)
  function closeFolds() { each.call(card.querySelectorAll('details[open]'), function (x) { x.open = false; }); }
  function seen(el) { return el.getClientRects().length > 0 && w.getComputedStyle(el).visibility !== 'hidden'; }
  function mend() {                                                                     // D26 (e): the focus never stays on a hidden element
    var a = d.activeElement; if (!a || a === d.body || !card.contains(a) || seen(a)) return;
    var s = card.querySelector('.wam-panel.is-shown .wam-cond > summary'); if (s) s.focus({ preventScroll: true }); }
  function marks() {                                                                    // -> Element[]: shapes, outlines, names, buttons (A37: '.wam-o' from WP-dmap-4)
    var a = list.call(sec.querySelectorAll('.wam-r,.wam-o,.wam-lbl'));
    return strip ? a.concat(list.call(strip.querySelectorAll('.rstrip-btn'))) : a; }
  function render(force) {                                                              // (boolean) -> void
    if (root.classList.contains('wd-q')) { mount.removeAttribute('data-rp-region'); return; }   // search mode: nothing is displayed, no layout is read
    var p = shown();
    marks().forEach(function (n) { var c = n.getAttribute('data-region');               // the lights always follow the pointing
      n.classList.toggle('is-on', c !== 'all' && c === st.committed);
      n.classList.toggle('is-hot', c !== 'all' && c === p && c !== st.committed); });
    if (st.tap || st.committed !== 'all') sec.classList.add('is-open');                 // D27: a tap or a selection; never removed; focus / hover never open
    if (!force && held()) return;                                                       // the card itself is held (D13)
    panels.forEach(function (x) { x.classList.toggle('is-shown', x.getAttribute('data-region') === p); });
    go.classList.toggle('is-off', !(st.tap && st.pick === p && p !== st.committed));
    var pe = d.getElementById('wam-p-' + p);                                            // N3: a region only while ITS panel has a box
    if (p === 'all' || !pe || !pe.getClientRects().length) mount.removeAttribute('data-rp-region');   // (a closed card on a phone shows only すべて ── WP-dmap-8)
    else if (mount.getAttribute('data-rp-region') !== p) mount.setAttribute('data-rp-region', p);
    mend();
  }
  function reveal() {                                                                   // the result heading into view, once
    var h = d.getElementById('wd-rh'); if (!h) return;
    var b = h.getBoundingClientRect(); if (b.top >= 86 && b.bottom <= w.innerHeight) return;
    var top = w.pageYOffset + b.top - 86, s = strip ? strip.getBoundingClientRect() : null;
    if (s && s.top < b.top && b.bottom - s.top <= w.innerHeight - 86) top = w.pageYOffset + s.top - 86;   // WP-dmap-4: the region buttons stay in view above the results when both fit
    w.scrollTo({ top: top, behavior: reduce ? 'instant' : 'smooth' });
  }
  d.addEventListener('wd:change', function (e) {
    var c = e.detail && e.detail.region; c = known(c) ? c : 'all';
    var q = root.classList.contains('wd-q'), back = st.q && !q; st.q = q;               // back = the section is displayed again
    var moved = c !== st.committed, was = sec.classList.contains('is-open');
    if (moved) { st.committed = c; st.pick = null; st.tap = false; closeFolds(); }
    render(moved || back);
    var a = d.activeElement;                                                            // D26 (e): a card that just opened above a focused button keeps it in view
    if (!was && sec.classList.contains('is-open') && a && strip && strip.contains(a)) a.scrollIntoView({ block: 'nearest', behavior: reduce ? 'instant' : 'auto' });
  });
  function over(e) { if ((e.pointerType && e.pointerType !== 'mouse') || (Z.drag && Z.moved)) return; var c = codeOf(e.target); if (c && c !== st.hover) { st.hover = c; render(false); } }
  function out(e) { if (e.pointerType && e.pointerType !== 'mouse') return; if (st.hover !== null) { st.hover = null; render(false); } }
  if (strip) {
    strip.addEventListener('pointerover', over); strip.addEventListener('pointerleave', out);
    strip.addEventListener('focusin', function (e) { var c = codeOf(e.target); if (c) { st.pick = c; st.tap = false; render(false); } });
    strip.addEventListener('keydown', function (e) {                                    // D26 (b): the preview ends before the focus moves
      if (e.key === 'Tab' && st.pick !== null && !st.tap) { st.pick = null; render(false); } });
    strip.addEventListener('focusout', function (e) { var t = e.relatedTarget;
      if (st.press || (t && (strip.contains(t) || card.contains(t)))) return;          // D26 (c): a press inside the card keeps what it shows, on text too
      if (st.pick !== null && !st.tap) { st.pick = null; render(false); } });
    strip.addEventListener('click', function (e) {                                      // D12 (M2): a POINTER press that selected brings the results into view
      var b = e.target && e.target.closest ? e.target.closest('.rstrip-btn') : null;
      if (!b || e.detail === 0) return;                                                 // detail 0 = Enter / Space: the focus stays where it is
      var c = b.getAttribute('data-region');
      if (c !== 'all' && w.PVDirectory && w.PVDirectory.state && w.PVDirectory.state().region === c) reveal(); });
    each.call(strip.querySelectorAll('.rstrip-btn'), function (b) {
      var c = b.getAttribute('data-region'); if (known(c)) b.setAttribute('aria-describedby', 'wam-f-' + c); });
  }
  card.addEventListener('pointerdown', function () { st.press = true; });              // D26 (c)
  d.addEventListener('pointerup', function () { st.press = false; }, true);
  d.addEventListener('pointerdown', function (e) {                                      // a press elsewhere ends a focus preview
    var t = e.target; if (st.pick === null || st.tap || card.contains(t) || (strip && strip.contains(t))) return;
    st.pick = null; render(false); }, true);
  card.addEventListener('focusin', function (e) { var k = false; try { k = e.target.matches(':focus-visible'); } catch (x) {} st.key = k; });
  card.addEventListener('focusout', function (e) { var t = e.relatedTarget;
    if (t && card.contains(t)) return;
    st.key = false;
    if (t && strip && strip.contains(t)) return;                                        // the strip's own focusin follows
    if (st.pick !== null && !st.tap) st.pick = null;
    render(false); });
  card.addEventListener('toggle', function (e) { if (e.target && e.target.open === false) render(false); }, true);   // 'toggle' does not bubble
  if (svg) {                                                                            // DM5a: the shapes point and select like the buttons
    function toHeading() {                                                              // where the focus goes after the go-button
      var h = d.getElementById('wd-rh-name') || d.getElementById('wd-rh'); if (!h) return;
      if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
    function choose(c) {                                                                // (code) -> void; the directory selects
      closeFolds(); st.pick = null; st.tap = false;
      if (w.PVDirectory && w.PVDirectory.setRegion) {
        w.PVDirectory.setRegion(c);                                                     // answers with 'wd:change', synchronously
        if (w.PVDirectory.state().region === c) reveal();                               // not after a release
      } else { st.committed = c; render(true); reveal(); }
    }
    svg.addEventListener('pointerdown', function (e) { st.via = e.pointerType || 'mouse'; });
    svg.addEventListener('pointerover', over); svg.addEventListener('pointerleave', out);
    svg.addEventListener('click', function (e) {
      var c = codeOf(e.target); if (!c || Z.moved) return;                              // WP-dmap-9: a drag or a pinch never selects
      if (st.via === 'touch' || st.via === 'pen' || isFs()) {                          // 3d: a tap shows, the button selects (full screen: any press)
        closeFolds(); st.hover = null; st.pick = c; st.tap = true; render(true);
        if (card.getBoundingClientRect().bottom > w.innerHeight) card.scrollIntoView({ block: 'nearest', behavior: reduce ? 'instant' : 'smooth' });
        return;
      }
      choose(c);
    });
    go.addEventListener('click', function () {
      var c = st.pick; if (!c) return;
      if (isFs()) { Z.after = c; fsClose(); return; }                                  // full screen closes first; then the region is chosen on the page's own step
      toHeading(); choose(c);
    });
    /* ── 動かせる地図（WP-dmap-9・オーナー「地図はスマホで見ると小さいし、地図自体を自分で動かせるようにしたい（windy みたいに）」）──
       地図の層（点・当たり・光る層）は1つの <g class="wam-z"> の中。動くのはその transform（translate ＋ scale・箱の単位）だけ。
       倍率は 1〜6。動かした地図は枠を空けない（枠より大きい向きは縁まで・小さい向きはまんなか）。
       マウス：つかんで動かす・ホイールは地図を押したあと（フォーカスが地図に在るあいだ）だけ ── ページのスクロールを奪わない
       （ctrl ＋ ホイール ＝ トラックパッドのピンチは、いつも地図）。
       指：ページの中では2本の指（ピンチ・移動）。1本の指はページのスクロールのまま（最初の1回だけ、2本の指で動かせると言う）。
       全画面では1本の指で動かす。押す ＝ 動かさずに離した時だけ（動かした・ピンチした指やマウスは選ばない）。
       キー（地図かそのボタンにフォーカス）：+ − 矢印 0。
       全画面：同じ地図（写しを作らない）が画面いっぱい。履歴を1段だけ積む（もう1回開いても積み増さない）。閉じる・Esc・戻るで閉じる。
       全画面で地図を押すと、その地域のカードを見せる。選ぶのは「この地域の航空会社を見る」── 全画面を閉じてから選ぶ
       （選んだ地域を全画面の段に書くと、閉じた時に消える）。時計・保存領域・通信は使わない。見た目は pv-directory.css */
    var frame = d.getElementById('wa-map'), zg = svg.querySelector('.wam-z');
    var zc = frame ? frame.querySelector('.wam-zc') : null, zx = frame ? frame.querySelector('.wam-zx') : null, zh = frame ? frame.querySelector('.wam-zh') : null;
    var zb = {}, ZMAX = 6, ZSTEP = 2;
    if (zc) each.call(zc.querySelectorAll('.wam-zb'), function (b) { zb[b.getAttribute('data-z')] = b; });
    function isFs() { return sec.classList.contains('is-fs'); }
    function geo() {                                                                    // -> what the frame shows, in the map's units
      var b = svg.getBoundingClientRect(), v = svg.viewBox.baseVal;
      var s = Math.min(b.width / v.width, b.height / v.height) || 1, W = b.width / s, H = b.height / s;
      return { b: b, v: v, s: s, W: W, H: H, x0: v.x - (W - v.width) / 2, y0: v.y - (H - v.height) / 2 };
    }
    function fit(t, k, a, len, a0, W) {                                                 // one axis: no empty edge; smaller than the frame = centred
      return k * len <= W ? a0 + (W - k * len) / 2 - k * a : Math.min(a0 - k * a, Math.max(a0 + W - k * len - k * a, t));
    }
    function r4(v) { return Math.round(v * 1e4) / 1e4; }                              // 4 places: a scale cut to 2 places moved the point under the pointer (2 units at 2x)
    function put(k, x, y, glide, G) {                                                   // (scale, shift x, y) -> void; clamps, then writes the one transform
      G = G || geo();
      k = Math.max(1, Math.min(ZMAX, k));
      Z.k = k; Z.x = fit(x, k, G.v.x, G.v.width, G.x0, G.W); Z.y = fit(y, k, G.v.y, G.v.height, G.y0, G.H);
      Z.q = [(G.x0 + G.W / 2 - Z.x) / k, (G.y0 + G.H / 2 - Z.y) / k];                // the map point at the frame's centre (kept through a resize)
      zg.classList.toggle('is-glide', !!glide && !reduce);
      if (k === 1 && Math.abs(Z.x) < 1e-3 && Math.abs(Z.y) < 1e-3) { Z.x = 0; Z.y = 0; zg.removeAttribute('transform'); }
      else zg.setAttribute('transform', 'translate(' + r4(Z.x) + ' ' + r4(Z.y) + ') scale(' + r4(k) + ')');
      frame.classList.toggle('is-z', k > 1);
      if (zb.reset) {
        if (k === 1 && d.activeElement === zb.reset) frame.focus({ preventScroll: true });   // the focus never stays on a hidden button
        zb.reset.hidden = k === 1;
      }
      if (zb['in']) zb['in'].setAttribute('aria-disabled', String(k >= ZMAX));
      if (zb.out) zb.out.setAttribute('aria-disabled', String(k <= 1));
    }
    function toMap(G, cx, cy) { return [G.x0 + (cx - G.b.left) / G.s, G.y0 + (cy - G.b.top) / G.s]; }
    function zoomAt(k, cx, cy, glide) {                                                 // the map point under (cx, cy) stays under it
      var G = geo(), u = toMap(G, cx, cy), qx = (u[0] - Z.x) / Z.k, qy = (u[1] - Z.y) / Z.k;
      k = Math.max(1, Math.min(ZMAX, k));
      put(k, u[0] - k * qx, u[1] - k * qy, glide, G);
    }
    function zoomMid(f) { var b = svg.getBoundingClientRect(); zoomAt(Z.k * f, b.left + b.width / 2, b.top + b.height / 2, true); }
    function restore() { if (!Z.q) return; var G = geo(); put(Z.k, G.x0 + G.W / 2 - Z.k * Z.q[0], G.y0 + G.H / 2 - Z.k * Z.q[1], false, G); }
    function hint() {                                                                   // once per page, on touch only, in the page only
      if (!zh || Z.hinted || isFs()) return;
      Z.hinted = true; zh.hidden = false; zh.classList.add('is-on');
    }
    /* 全画面（履歴は1段だけ。閉じる・Esc は自分で1回戻す ── 旗を先に落とすので、戻った知らせは何もしない） */
    function later() { var c = Z.after; Z.after = null; if (c) { toHeading(); choose(c); } }
    function fsOpen() {
      if (isFs()) return;
      try {
        var s0 = w.history.state;
        if (s0 && s0.wamfs) Z.owned = true;                                             // the step a reload left behind: use it (never two)
        else {
          if (s0 && s0.wd) w.history.replaceState(Object.assign({}, s0, { y: Math.round(w.pageYOffset || 0) }), '', w.location.href);
          w.history.pushState(Object.assign({}, w.history.state, { wamfs: 1 }), '', w.location.href);
          Z.owned = true;
        }
      } catch (x) { Z.owned = false; }
      sec.classList.add('is-fs'); root.classList.add('wam-lock');
      sec.setAttribute('role', 'dialog'); sec.setAttribute('aria-modal', 'true'); sec.setAttribute('aria-label', zb.fs.getAttribute('aria-label') || '');
      zb.fs.hidden = true; if (zx) zx.hidden = false;
      restore();
      frame.focus({ preventScroll: true });
    }
    function fsClose() {
      if (!isFs()) return;
      sec.classList.remove('is-fs'); root.classList.remove('wam-lock');
      sec.removeAttribute('role'); sec.removeAttribute('aria-modal'); sec.removeAttribute('aria-label');
      zb.fs.hidden = false; if (zx) zx.hidden = true;
      if (!Z.after && st.pick !== null) { st.pick = null; st.tap = false; render(true); }   // a region only looked at in full screen stays there: the page shows what it chose
      restore();
      if (!Z.after) zb.fs.focus({ preventScroll: true });
      if (Z.owned) { Z.owned = false; try { w.history.back(); return; } catch (x) {} }
      later();
    }
    if (frame && zg && zc && zb.fs && zb['in'] && zb.out && zb.reset) {
      frame.setAttribute('tabindex', '-1');                                            // a press on the map gives it the focus (keys, wheel); Tab never stops here
      zc.hidden = false;
      try { if (w.history.state && w.history.state.wamfs) Z.owned = true; } catch (x) {}
      put(1, 0, 0, false);
      zb['in'].addEventListener('click', function () { zoomMid(ZSTEP); });
      zb.out.addEventListener('click', function () { zoomMid(1 / ZSTEP); });
      zb.reset.addEventListener('click', function () { put(1, 0, 0, true); });
      zb.fs.addEventListener('click', fsOpen);
      if (zx) zx.addEventListener('click', fsClose);
      if (zh) zh.addEventListener('animationend', function () { zh.classList.remove('is-on'); zh.hidden = true; });
      /* マウス：つかんで動かす（4px 動くまでは押しただけ ＝ 離せば選ぶ） */
      frame.addEventListener('pointerdown', function (e) {
        Z.moved = false;
        if (e.pointerType !== 'mouse' || e.button !== 0 || (e.target.closest && e.target.closest('button'))) return;
        Z.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, zx: Z.x, zy: Z.y };
      });
      w.addEventListener('pointermove', function (e) {
        var g = Z.drag; if (!g || e.pointerId !== g.id) return;
        var dx = e.clientX - g.x, dy = e.clientY - g.y;
        if (!Z.moved) {
          if (dx * dx + dy * dy < 16) return;
          Z.moved = true; frame.classList.add('is-drag');
          try { frame.setPointerCapture(e.pointerId); } catch (x) {}                    // the drag goes on outside the frame (only after it really moved: a press keeps its target)
          if (st.hover !== null) { st.hover = null; render(false); }
        }
        var G = geo(); put(Z.k, g.zx + dx / G.s, g.zy + dy / G.s, false, G);
      });
      function dragEnd(e) { if (Z.drag && e.pointerId === Z.drag.id) { Z.drag = null; frame.classList.remove('is-drag'); } }
      w.addEventListener('pointerup', dragEnd); w.addEventListener('pointercancel', dragEnd);
      /* 指：ページの中は2本の指だけ・全画面は1本でも */
      var two = function (e) { return [e.touches[0], e.touches[1]]; };
      var pinch = function (t) {
        var G = geo(), m = toMap(G, (t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
        Z.pin = { k: Z.k, d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1, q: [(m[0] - Z.x) / Z.k, (m[1] - Z.y) / Z.k] };
      };
      var pan = function (t, look) { Z.pin = { one: !look, look: look, x: t.clientX, y: t.clientY, zx: Z.x, zy: Z.y }; };
      frame.addEventListener('touchstart', function (e) {
        if (e.target.closest && e.target.closest('button')) { Z.pin = null; return; }
        if (e.touches.length === 1) Z.moved = false;
        if (e.touches.length >= 2) { Z.moved = true; pinch(two(e)); }
        else pan(e.touches[0], !isFs());
      }, { passive: true });
      frame.addEventListener('touchmove', function (e) {
        var p = Z.pin; if (!p) return;
        if (e.touches.length >= 2 && p.d) {
          if (!e.cancelable) return;                                                    // the page already scrolls: leave it to the page
          e.preventDefault();
          var t = two(e), G = geo(), m = toMap(G, (t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
          var k = Math.max(1, Math.min(ZMAX, p.k * (Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1) / p.d));
          put(k, m[0] - k * p.q[0], m[1] - k * p.q[1], false, G);
          return;
        }
        if (e.touches.length !== 1) return;
        var dx = e.touches[0].clientX - p.x, dy = e.touches[0].clientY - p.y;
        if (p.look) { if (dx * dx + dy * dy > 1e2) hint(); return; }
        if (!p.one) return;
        if (e.cancelable) e.preventDefault();
        if (!Z.moved) { if (dx * dx + dy * dy < 64) return; Z.moved = true; }
        var G2 = geo(); put(Z.k, p.zx + dx / G2.s, p.zy + dy / G2.s, false, G2);
      }, { passive: false });
      frame.addEventListener('touchend', function (e) {
        if (e.touches.length >= 2) pinch(two(e));
        else if (e.touches.length === 1 && isFs()) pan(e.touches[0], false);         // one finger left in full screen: it moves on from here
        else Z.pin = null;                                                              // in the page, the page takes the finger that stays
      });
      frame.addEventListener('touchcancel', function () { Z.pin = null; });
      /* ホイール：全画面・ctrl（ピンチ）・地図にフォーカスが在る時だけ。ほかはページのスクロールのまま */
      frame.addEventListener('wheel', function (e) {
        if (!(isFs() || e.ctrlKey || frame.contains(d.activeElement))) return;
        e.preventDefault();
        var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? svg.getBoundingClientRect().height : 1);
        zoomAt(Z.k * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.002)), e.clientX, e.clientY, false);
      }, { passive: false });
      /* キー：+ − 0・矢印（拡大していないときの矢印はページのもの） */
      frame.addEventListener('keydown', function (e) {
        if (e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
        var k = e.key, a = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[k];
        if (k === '+' || k === '=') zoomMid(ZSTEP);
        else if (k === '-' || k === '_') zoomMid(1 / ZSTEP);
        else if (k === '0') put(1, 0, 0, true);
        else if (a && Z.k > 1) { var G = geo(); put(Z.k, Z.x + a[0] * G.W * 0.15, Z.y + a[1] * G.H * 0.15, true, G); }
        else return;
        e.preventDefault();
      });
      /* 全画面のあいだ：Esc で閉じる・Tab は面の中を回る */
      d.addEventListener('keydown', function (e) {
        if (!isFs()) return;
        if (e.key === 'Escape') { e.preventDefault(); fsClose(); return; }
        if (e.key !== 'Tab') return;
        var f = list.call(sec.querySelectorAll('button,summary,a[href]')).filter(seen), i = f.indexOf(d.activeElement);
        if (!f.length) return;
        if (e.shiftKey ? i <= 0 : (i < 0 || i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
      });
      w.addEventListener('popstate', function (e) {                                     // Back: closes full screen; a step it left is reused
        var fs = !!(e.state && e.state.wamfs);
        if (fs && !isFs()) { Z.owned = true; return; }
        if (!fs && isFs()) { Z.owned = false; fsClose(); }
        if (!fs) later();
      });
      if (w.ResizeObserver) new w.ResizeObserver(function () { if (Z.k > 1) restore(); }).observe(frame);
    }
  }
  /* 「機長｜副操縦士」（P12.100）：押した方を区域の data-pos に（カードの行の大きさ・見せる帯・地図の濃さ・凡例 ── どれも CSS が同じ印を読む）。
     切り替えは面の先頭（カードの外）。2つそろっていなければ見せない（押しても何も起きないボタンを出さない） */
  var sw = sec.querySelector('.wam-pos'), pbs = sw ? list.call(sw.querySelectorAll('.wam-pb')) : [];
  function setPos(p) {                                                                  // ('cap' | 'fo') -> void
    if (p !== 'cap' && p !== 'fo') return;
    if (sec.getAttribute('data-pos') !== p) sec.setAttribute('data-pos', p);
    pbs.forEach(function (b) { var on = b.getAttribute('data-pos') === p ? 'true' : 'false'; if (b.getAttribute('aria-pressed') !== on) b.setAttribute('aria-pressed', on); });
  }
  if (sw && pbs.length === 2) {
    pbs.forEach(function (b) { b.addEventListener('click', function () { setPos(b.getAttribute('data-pos')); }); });
    setPos(sec.getAttribute('data-pos') === 'fo' ? 'fo' : 'cap');
    sw.hidden = false;
  }
  var c0 = w.PVDirectory && w.PVDirectory.state ? w.PVDirectory.state().region : 'all';
  st.committed = known(c0) ? c0 : 'all'; st.q = root.classList.contains('wd-q'); render(true);
})(window, document);
