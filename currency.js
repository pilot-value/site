/* ==========================================================================
   currency.js — PILOT VALUE サイト全体の通貨切替ランタイム（window.PVCurrency）
   --------------------------------------------------------------------------
   ・数値を手編集せず、全ページ共通のこのランタイムが DOM を走査して
     円トークン（¥3,700万 / 3,700万円 / 範囲 1,500万〜1,900万 / ¥37,000,000）
     を <span class="pv-cur" data-jpy="N" data-orig="元表記"> で包む。
   ・既定 JPY は元テキストのまま＝完全ノーオペ（回帰ゼロ）。非JPY選択時のみ表示変換。
   ・為替は固定・概算レート（asOf 明記）。表示専用の換算であり、円がベースの SSOT
     （salary-data.mjs）には一切触れない（「円の数値はブレンドしない」と両立）。
   ・レベリング図は自前で通貨対応（salary-leveling.js の fmtMan → PVCurrency.fmt）ため
     図の内部要素は走査から除外し、pv-currency-change を購読して再描画させる。
   ・非ESモジュール（search.js / lang-toggle.js / salary-leveling.js と同じ規約）。
   ========================================================================== */
(function (w, d) {
  'use strict';
  if (w.PVCurrency) return;                         // 二重読み込みガード

  var STORE_KEY = 'pv-currency';

  // ── 固定・概算 為替レート（JPY / 1通貨単位）。オーナーが1箇所で編集可 ──
  // 概算・2026年時点。表示専用（SSOT の円は不変）。数値は後から1箇所で調整可。
  var RATES = { JPY: 1, USD: 158.95, EUR: 185.69, GBP: 216.76, AUD: 113.88, SGD: 125.24, AED: 43.2825 };
  var ORDER = ['JPY', 'USD', 'EUR', 'GBP', 'AUD', 'SGD', 'AED'];
  var SYM   = { USD: '$', EUR: '€', GBP: '£', AUD: 'A$', SGD: 'S$', AED: 'AED ' };
  // LABEL は記号と通貨コードだけなので言語で変わらない。
  var LABEL = { JPY: '¥ JPY', USD: '$ USD', EUR: '€ EUR', GBP: '£ GBP', AUD: 'A$ AUD', SGD: 'S$ SGD', AED: 'د.إ AED' };

  // ── メニュー内の文言（言語別）─────────────────────────────────
  // 英語ページで「JPY 日本円 / USD 米ドル…」と出ていたのを言語に合わせる。
  // 参照は下の LANG（isENPage() の結果）経由で行う。
  var NAME = {
    ja: { JPY: '日本円', USD: '米ドル', EUR: 'ユーロ', GBP: '英ポンド', AUD: '豪ドル', SGD: 'シンガポールドル', AED: 'UAEディルハム' },
    en: { JPY: 'Japanese Yen', USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', AUD: 'Australian Dollar', SGD: 'Singapore Dollar', AED: 'UAE Dirham' }
  };
  var AS_OF = { ja: '2026年8月時点', en: 'as of Aug 2026' };
  var NOTE  = {
    ja: function (asOf) { return '為替は概算・固定レート（' + asOf + '）。表示は目安です。'; },
    en: function (asOf) { return 'Approximate fixed rates (' + asOf + '). Figures are indicative.'; }
  };
  var ARIA  = { ja: '表示通貨を切り替え', en: 'Change display currency' };

  // ── 状態 ──────────────────────────────────────────────────────
  // 英語ページ（/en/ 配下 or <html lang="en">）は既定 USD、日本語ページは既定 JPY。
  // ユーザーが明示選択した通貨は localStorage に保存され、言語別の既定より優先される。
  function isENPage() {
    try {
      if (w.location && w.location.pathname.indexOf('/en/') !== -1) return true;
      var lang = d.documentElement && d.documentElement.getAttribute('lang');
      return !!(lang && lang.toLowerCase().indexOf('en') === 0);
    } catch (e) { return false; }
  }
  // 既定通貨と同じ判定を、メニュー文言の言語にもそのまま使う。
  var LANG  = isENPage() ? 'en' : 'ja';
  var state = LANG === 'en' ? 'USD' : 'JPY';
  try {
    var saved = w.localStorage && localStorage.getItem(STORE_KEY);
    if (saved && RATES.hasOwnProperty(saved)) state = saved;   // 明示選択を最優先
  } catch (e) {}

  // ── 整形 ──────────────────────────────────────────────────────
  function parseNum(s) { return parseFloat(String(s).replace(/,/g, '')); }
  function trimZero(s) { return String(s).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1'); }

  function compact(v) {
    var a = Math.abs(v);
    if (a >= 1e6)  return trimZero((v / 1e6).toFixed(1)) + 'M';
    if (a >= 1e4)  return Math.round(v / 1e3).toLocaleString('en-US') + 'K';
    if (a >= 1e3)  return trimZero((v / 1e3).toFixed(1)) + 'K';
    return Math.round(v).toLocaleString('en-US');
  }

  // 現在通貨で jpy を整形。JPY はサイト表記（¥…万 / ¥…）、非JPYは記号＋K/M圧縮。
  // ★「万」は日本語ページだけ。英語ページで JPY を選んだ人に「¥36万」と出しても読めない
  //   （万＝1万という位取りは日本語圏の知識）。英語ページでは桁を省略せず ¥360,000 と出す。
  function fmt(jpy) {
    jpy = Number(jpy) || 0;
    if (state === 'JPY') {
      if (LANG !== 'en' && jpy >= 10000 && jpy % 10000 === 0) return '¥' + (jpy / 10000).toLocaleString('en-US') + '万';
      return '¥' + Math.round(jpy).toLocaleString('en-US');
    }
    var rate = RATES[state] || 1;
    return SYM[state] + compact(jpy / rate);
  }

  // span に出す文字。JPY のときは原表記に戻す＝日本語ページは完全ノーオペ（回帰ゼロ）。
  // ★ 英語ページだけは JPY でも原表記に戻さない。ページの中に直接
  //   「¥3,550万」と書いてある所（英語版の航空会社ページなど）が、JPY を選んだ瞬間に
  //   万表記へ戻ってしまうため。英語ページでは JPY も fmt() を通して ¥35,500,000 にする。
  function shown(jpy, orig) {
    return (state === 'JPY' && LANG !== 'en') ? orig : fmt(jpy);
  }

  // ── 円トークン検出 ─────────────────────────────────────────────
  // 0) ¥先頭の範囲 ¥A〜B（単位は共有 ¥33–42M でも端別 ¥150K–170K でも可。低位に単位が無ければ
  //    末尾単位を共有＝生円誤読→$0 を防ぐ。両端に¥が付く範囲 ¥33万〜¥42万 は 2)以降が各自拾う）
  // 1) ¥無しの範囲 A〜B万円 / A億〜B億円。上限に 万/億 が必須で、下限は単位省略可（上限と共有）。
  //    これが無いと「2,200〜3,500万円」の下限だけ素通しになり、英語ページで「2,200〜$219K」になる。
  //    区切りは 〜/~/– のみ（'-' を許すと 2020-2024 を拾うため）。上限が 人/ドル 等に続く場合は除外。
  // 2)数字+億円 ×1e8  3)[¥]数字+億 ×1e8  4)数字+万円 ×1e4  5)[¥]数字+万 ×1e4
  //    （円/人/ドル/㌦/マイル/時間 が続くものは除外）
  // 6)¥数字 million ×1e6  7)¥数字M ×1e6  8)¥数字K ×1e3  9)¥数字（万/億/M/K なし＝生円）
  // ※ M/K/million と ¥先頭の範囲は ¥ 必須＝$232K・B737・15%・2020-2024 等は拾わない。
  function makeRe() {
    // 桁区切りあり(2,700)を優先し、無い場合は素の数字列(1400)も拾う。後者が無いと
    // 「1400万円」の先頭 1 が取り残されて「1$25K」になる（口コミの動的生成が該当）。
    var N = '(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)';
    return new RegExp(
      '¥\\s?' + N + '([MK万億]?)\\s?([–〜~-])\\s?' + N + '([MK万億])'
    + '|' + N + '([万億]?)\\s?([〜~–])\\s?' + N + '([万億])(円?)(?![円人ド㌦マ時])'
    + '|(?:¥\\s?)?' + N + '億円'
    + '|(?:¥\\s?)?' + N + '億(?![円人ド㌦マ時])'
    + '|(?:¥\\s?)?' + N + '万円'
    + '|(?:¥\\s?)?' + N + '万(?![円人ド㌦マ時])'
    + '|¥\\s?' + N + '\\s?[Mm]illion'
    + '|¥\\s?' + N + 'M'
    + '|¥\\s?' + N + 'K'
    + '|¥\\s?(\\d{1,3}(?:,\\d{3})*)(?![\\d万億MK])',
      'g'
    );
  }
  // 万（空文字は呼ばない）
  function sufMul(s) { return s === 'M' ? 1e6 : s === 'K' ? 1e3 : s === '億' ? 1e8 : 10000; }
  // 単一値は {range:false, jpy}、範囲は {range:true, lo,hi,sep,loOrig,hiOrig}
  function matchToParts(m) {
    if (m[1] != null) {                                    // 0) ¥先頭の範囲
      var hiSuf = m[5], loSuf = m[2] || hiSuf;             // 低位に単位が無ければ末尾単位を共有
      return {
        range: true, sep: m[3],
        lo: Math.round(parseNum(m[1]) * sufMul(loSuf)),
        hi: Math.round(parseNum(m[4]) * sufMul(hiSuf)),
        loOrig: '¥' + m[1] + (m[2] || ''),
        hiOrig: m[4] + hiSuf
      };
    }
    if (m[6] != null) {                                    // 1) ¥無しの範囲（上限に単位あり）
      var hiSuf2 = m[10], loSuf2 = m[7] || hiSuf2;
      return {
        range: true, sep: m[8],
        lo: Math.round(parseNum(m[6]) * sufMul(loSuf2)),
        hi: Math.round(parseNum(m[9]) * sufMul(hiSuf2)),
        loOrig: m[6] + (m[7] || ''),
        hiOrig: m[9] + hiSuf2 + (m[11] || '')
      };
    }
    var jpy =
        m[12] != null ? parseNum(m[12]) * 1e8   :          // 億円
        m[13] != null ? parseNum(m[13]) * 1e8   :          // 億
        m[14] != null ? parseNum(m[14]) * 10000 :          // 万円
        m[15] != null ? parseNum(m[15]) * 10000 :          // 万
        m[16] != null ? parseNum(m[16]) * 1e6   :          // ¥N million
        m[17] != null ? parseNum(m[17]) * 1e6   :          // ¥NM
        m[18] != null ? parseNum(m[18]) * 1e3   :          // ¥NK
        m[19] != null ? parseNum(m[19])         : null;    // ¥N（生円）
    if (jpy == null) return null;
    return { range: false, jpy: Math.round(jpy) };
  }

  // ── 走査から除外する祖先（script/style/入力欄・図が自前管理する要素・既に包んだ span）──
  var SKIP_TAG = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, OPTION: 1, NOSCRIPT: 1, SELECT: 1 };
  var SKIP_CLASS = {
    'pv-cur': 1, 'pv-cur-toggle': 1, 'pv-cur-menu': 1, 'pv-no-cur': 1,
    // レベリング図（PVLeveling が fmtMan 経由で自前に通貨対応）
    'lvl-levels': 1, 'lvl-grid': 1, 'lvl-scroll': 1, 'lvl-tip': 1,
    'lvl-picker': 1, 'lvl-modal': 1, 'lvl-modal-backdrop': 1
  };
  function excluded(node) {
    var el = node.parentNode;
    while (el && el.nodeType === 1) {
      if (SKIP_TAG[el.tagName]) return true;
      var cl = el.classList;
      if (cl) { for (var k in SKIP_CLASS) { if (SKIP_CLASS.hasOwnProperty(k) && cl.contains(k)) return true; } }
      el = el.parentNode;
    }
    return false;
  }

  // ── span 生成（原表記は data-orig に保存＝可逆・冪等）──
  function makeSpan(jpy, orig) {
    var span = d.createElement('span');
    span.className = 'pv-cur';
    span.setAttribute('data-jpy', String(jpy));
    span.setAttribute('data-orig', orig);
    span.textContent = shown(jpy, orig);
    if (span.textContent !== orig) span.setAttribute('data-cur-on', state);
    return span;
  }

  // ── 1テキストノードを走査して包む ──
  function wrapNode(node) {
    var text = node.nodeValue;
    if (!text) return;
    var re = makeRe(), m, last = 0, frag = null;
    while ((m = re.exec(text))) {
      var matched = m[0], start = m.index;
      var parts = matchToParts(m);
      if (parts == null) { if (re.lastIndex === start) re.lastIndex++; continue; }
      if (!frag) frag = d.createDocumentFragment();
      if (start > last) frag.appendChild(d.createTextNode(text.slice(last, start)));
      if (parts.range) {   // ¥A〜B を 2 span＋区切り文字に分解（各端が独立に通貨追随・原表記は可逆）
        frag.appendChild(makeSpan(parts.lo, parts.loOrig));
        frag.appendChild(d.createTextNode(parts.sep));
        frag.appendChild(makeSpan(parts.hi, parts.hiOrig));
      } else {
        frag.appendChild(makeSpan(parts.jpy, matched));
      }
      last = start + matched.length;
      if (re.lastIndex === start) re.lastIndex++;
    }
    if (frag) {
      if (last < text.length) frag.appendChild(d.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    }
  }

  function scan(root) {
    root = root || d.body;
    if (!root || !d.createTreeWalker) return;
    var walker = d.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var v = node.nodeValue;
        if (!v || (v.indexOf('万') < 0 && v.indexOf('億') < 0 && v.indexOf('¥') < 0)) return NodeFilter.FILTER_REJECT;
        if (excluded(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);   // 収集後に変換（走査中の DOM 変更を避ける）
    for (var i = 0; i < nodes.length; i++) wrapNode(nodes[i]);
  }

  // ── 既存 span を現在通貨に反映（JPY=原表記へ復元・非JPY=換算）──
  function applyAll() {
    var spans = d.querySelectorAll('span.pv-cur');
    for (var i = 0; i < spans.length; i++) {
      var sp = spans[i], orig = sp.getAttribute('data-orig');
      sp.textContent = shown(parseInt(sp.getAttribute('data-jpy'), 10), orig);
      if (sp.textContent === orig) sp.removeAttribute('data-cur-on');
      else sp.setAttribute('data-cur-on', state);
    }
  }

  function setCurrency(cur) {
    if (!RATES.hasOwnProperty(cur) || cur === state) { closeMenu(); return; }
    state = cur;
    try { localStorage.setItem(STORE_KEY, cur); } catch (e) {}
    applyAll();
    syncUI();
    closeMenu();
    try { w.dispatchEvent(new CustomEvent('pv-currency-change', { detail: { currency: cur } })); }
    catch (e2) { var ev = d.createEvent('Event'); ev.initEvent('pv-currency-change', true, false); w.dispatchEvent(ev); }
  }

  // ── CSS 注入（.theme-toggle / .lang-toggle と同トーンのピル＋ドロップ）──
  function injectCSS() {
    if (d.getElementById('pv-currency-css')) return;
    var css =
    '.pv-cur-wrap{position:relative;display:inline-flex;flex-shrink:0}'
  + '.pv-cur-toggle{display:inline-flex;align-items:center;gap:5px;padding:0 11px;height:38px;border-radius:10px;background:rgba(255,255,255,.07);color:#e8edf2;font-size:.75rem;font-weight:700;letter-spacing:.03em;border:1px solid rgba(255,255,255,.12);cursor:pointer;transition:background .2s,color .2s,border-color .2s;white-space:nowrap;font-family:inherit}'
  + '.pv-cur-toggle:hover{background:rgba(255,255,255,.13)}'
  + '.pv-cur-toggle:focus-visible{outline:2px solid #6ea8ff;outline-offset:2px}'
  + '.pv-cur-caret{font-size:.6em;opacity:.65;transform:translateY(1px)}'
  + '[data-theme=light] .pv-cur-toggle{background:rgba(0,0,0,.06);color:#0f172a;border-color:rgba(0,0,0,.13)}'
  + '[data-theme=light] .pv-cur-toggle:hover{background:rgba(0,0,0,.11)}'
  + '.pv-cur-menu{position:absolute;top:calc(100% + 6px);right:0;z-index:120;min-width:196px;padding:6px;border-radius:12px;background:#141a24;border:1px solid rgba(255,255,255,.12);box-shadow:0 16px 44px -14px rgba(0,0,0,.62),0 4px 12px -6px rgba(0,0,0,.5);display:none;flex-direction:column;gap:2px}'
  + '.pv-cur-menu.open{display:flex}'
  + '[data-theme=light] .pv-cur-menu{background:#fff;border-color:rgba(15,23,42,.12);box-shadow:0 16px 44px -14px rgba(15,23,42,.24),0 4px 12px -6px rgba(15,23,42,.13)}'
  + '.pv-cur-opt{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:8px;background:none;border:0;cursor:pointer;color:#dbe4ee;font-size:.8rem;font-family:inherit;text-align:left;width:100%;transition:background .15s}'
  + '.pv-cur-opt:hover{background:rgba(255,255,255,.08)}'
  + '.pv-cur-opt:focus-visible{outline:2px solid #6ea8ff;outline-offset:-2px}'
  + '.pv-cur-check{width:14px;flex:none;color:#6ea8ff;opacity:0;font-size:.85em}'
  + '.pv-cur-opt[aria-checked=true]{color:#fff}'
  + '.pv-cur-opt[aria-checked=true] .pv-cur-check{opacity:1}'
  + '.pv-cur-code{font-weight:700;letter-spacing:.02em;min-width:34px}'
  + '.pv-cur-name{opacity:.58;font-size:.72rem;font-weight:500}'
  + '[data-theme=light] .pv-cur-opt{color:#334155}'
  + '[data-theme=light] .pv-cur-opt:hover{background:rgba(15,23,42,.06)}'
  + '[data-theme=light] .pv-cur-opt[aria-checked=true]{color:#0f172a}'
  + '.pv-cur-note{margin-top:4px;padding:7px 10px 3px;font-size:.66rem;line-height:1.55;opacity:.6;border-top:1px solid rgba(255,255,255,.09)}'
  + '[data-theme=light] .pv-cur-note{border-top-color:rgba(15,23,42,.1)}';
    var st = d.createElement('style');
    st.id = 'pv-currency-css';
    st.textContent = css;
    (d.head || d.documentElement).appendChild(st);
  }

  // ── トグル UI ─────────────────────────────────────────────────
  var btn, menu, wrap, menuOpen = false;

  function buildOptions() {
    var html = '';
    for (var i = 0; i < ORDER.length; i++) {
      var c = ORDER[i];
      html += '<button type="button" class="pv-cur-opt" role="menuitemradio" data-cur="' + c + '" aria-checked="' + (c === state) + '">'
            +   '<span class="pv-cur-check" aria-hidden="true">✓</span>'
            +   '<span class="pv-cur-code">' + c + '</span>'
            +   '<span class="pv-cur-name">' + NAME[LANG][c] + '</span>'
            + '</button>';
    }
    html += '<div class="pv-no-cur pv-cur-note">' + NOTE[LANG](AS_OF[LANG]) + '</div>';
    return html;
  }

  function openMenu()  { if (menu) { menu.classList.add('open'); menuOpen = true; btn.setAttribute('aria-expanded', 'true'); } }
  function closeMenu() { if (menu) { menu.classList.remove('open'); menuOpen = false; btn.setAttribute('aria-expanded', 'false'); } }
  function toggleMenu(){ menuOpen ? closeMenu() : openMenu(); }

  function syncUI() {
    if (btn) btn.firstChild.nodeValue = LABEL[state] + ' ';
    if (menu) {
      var opts = menu.querySelectorAll('.pv-cur-opt');
      for (var i = 0; i < opts.length; i++) opts[i].setAttribute('aria-checked', String(opts[i].getAttribute('data-cur') === state));
    }
  }

  function injectToggle() {
    if (d.getElementById('pv-cur-toggle')) return;
    injectCSS();

    wrap = d.createElement('span');
    wrap.className = 'pv-cur-wrap pv-no-cur';

    btn = d.createElement('button');
    btn.type = 'button';
    btn.id = 'pv-cur-toggle';
    btn.className = 'pv-cur-toggle';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', ARIA[LANG]);
    btn.appendChild(d.createTextNode(LABEL[state] + ' '));
    var caret = d.createElement('span');
    caret.className = 'pv-cur-caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.textContent = '▾';
    btn.appendChild(caret);

    menu = d.createElement('div');
    menu.className = 'pv-cur-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = buildOptions();

    wrap.appendChild(btn);
    wrap.appendChild(menu);

    // #theme-toggle / #lang-toggle の隣に配置（無ければナビ末尾へ）
    var anchor = d.getElementById('lang-toggle') || d.getElementById('theme-toggle');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    } else {
      var nav = d.getElementById('main-nav');
      var host = nav ? (nav.querySelector('.max-w-7xl') || nav) : d.body;
      host.appendChild(wrap);
    }

    btn.addEventListener('click', function (e) { e.stopPropagation(); toggleMenu(); });
    menu.addEventListener('click', function (e) {
      var o = e.target.closest ? e.target.closest('.pv-cur-opt') : null;
      if (o && o.dataset.cur) { e.stopPropagation(); setCurrency(o.dataset.cur); }
    });
    d.addEventListener('click', function (e) { if (menuOpen && !wrap.contains(e.target)) closeMenu(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuOpen) { closeMenu(); btn.focus(); } });

    syncUI();
  }

  // ── MutationObserver：非同期描画された静的数値も後から包む（図要素は除外）──
  var scanScheduled = false, mutating = false, observer = null;
  function startObserver() {
    if (observer || !w.MutationObserver || !d.body) return;
    observer = new MutationObserver(function (muts) {
      if (mutating) return;
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].type === 'childList' && muts[i].addedNodes.length) { schedule(); return; }
      }
    });
    observer.observe(d.body, { childList: true, subtree: true });
  }
  function schedule() {
    if (scanScheduled) return;
    scanScheduled = true;
    var run = function () { scanScheduled = false; mutating = true; try { scan(d.body); } finally { mutating = false; } };
    if (w.requestAnimationFrame) w.requestAnimationFrame(run); else w.setTimeout(run, 16);
  }

  // ── 初期化 ────────────────────────────────────────────────────
  function init() {
    injectCSS();
    injectToggle();
    scan(d.body);
    if (state !== 'JPY') {
      applyAll();
      // 復帰ユーザーが非JPYを保存済みの場合、初期表示時点で既に描画済みの図
      // （index/world-airlines の即時マウント）も現在通貨へ追随させる。
      try { w.dispatchEvent(new CustomEvent('pv-currency-change', { detail: { currency: state } })); }
      catch (e) { var ev = d.createEvent('Event'); ev.initEvent('pv-currency-change', true, false); w.dispatchEvent(ev); }
    }
    startObserver();
  }

  // ── 公開 API ──────────────────────────────────────────────────
  w.PVCurrency = {
    fmt: fmt,                 // fmt(jpy) → 現在通貨の整形文字列（salary-leveling.js fmtMan が利用）
    scan: scan,               // scan(root) → 円トークンを包む
    apply: applyAll,          // 既存 span を現在通貨へ再反映
    get: function () { return state; },
    set: setCurrency,         // set('USD') 等
    rates: RATES,
    symbols: SYM,
    asOf: AS_OF[LANG]
  };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init);
  else init();
})(window, document);
