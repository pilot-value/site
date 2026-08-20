/* ═══════════════════════════════════════════════════
   PILOT VALUE — Shared Header Toggles (theme button + light theme)
   テーマ切替が未実装の補助ページ用。テーマボタンを注入・バインドし、
   汎用のライトモードCSSを供給する。lang-toggle.js と併用。
   既に #theme-toggle がある（独自実装済み）ページには読み込まない。
   ═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── 保存テーマを適用（FOUC対策の補強） ── */
  var theme = 'light';
  try { theme = localStorage.getItem('pv-theme') || 'light'; } catch (e) {}
  document.documentElement.setAttribute('data-theme', theme);

  var SUN  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  var MOON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  /* ── トグル用CSS＋汎用ライトモードCSSを注入 ── */
  function injectCSS() {
    if (document.getElementById('pv-toggles-style')) return;
    var s = document.createElement('style');
    s.id = 'pv-toggles-style';
    s.textContent = [
      '.theme-toggle,.lang-toggle{display:inline-flex;align-items:center;justify-content:center;height:38px;border-radius:10px;background:rgba(255,255,255,.07);color:#e8edf2;border:1px solid rgba(255,255,255,.12);cursor:pointer;transition:background .2s,color .2s,border-color .2s;flex-shrink:0}',
      '.theme-toggle{width:38px}',
      '.lang-toggle{gap:4px;padding:0 10px;font-size:.75rem;font-weight:700;letter-spacing:.04em;white-space:nowrap}',
      '.theme-toggle:hover,.lang-toggle:hover{background:rgba(255,255,255,.14)}',
      '.pv-toggle-wrap{display:inline-flex;align-items:center;gap:8px;margin-right:8px}',
      /* generic light mode */
      '[data-theme="light"] body{background-color:#f3f5f8!important;color:#0f172a!important}',
      '[data-theme="light"] body::before{opacity:.03}',
      '[data-theme="light"] nav#main-nav{background:rgba(243,245,248,.96)!important;border-bottom:1px solid rgba(0,0,0,.07)!important;backdrop-filter:blur(16px)!important}',
      '[data-theme="light"] nav#main-nav.scrolled{background:rgba(243,245,248,.99)!important}',
      '[data-theme="light"] .nav-link{color:rgba(15,23,42,.62)!important}',
      '[data-theme="light"] .nav-link:hover{color:#0f172a!important}',
      '[data-theme="light"] .btn-ghost{background:rgba(0,0,0,.06)!important;color:#0f172a!important;border-color:rgba(0,0,0,.12)!important}',
      '[data-theme="light"] .btn-ghost:hover{background:rgba(0,0,0,.1)!important}',
      '[data-theme="light"] .btn-primary{box-shadow:0 6px 22px rgba(61,155,255,.25)}',
      '[data-theme="light"] .glass{background:rgba(255,255,255,.92)!important;border-color:rgba(0,0,0,.08)!important;box-shadow:0 2px 14px rgba(0,0,0,.06)!important}',
      '[data-theme="light"] .glass-raised{background:#fff!important;border-color:rgba(0,0,0,.1)!important;box-shadow:0 4px 24px rgba(0,0,0,.08)!important}',
      '[data-theme="light"] .info-card,[data-theme="light"] .stat-card{background:#fff!important;border-color:rgba(0,0,0,.08)!important}',
      '[data-theme="light"] footer{background:#e4e8f0!important;border-top-color:rgba(0,0,0,.08)!important}',
      '[data-theme="light"] .theme-toggle,[data-theme="light"] .lang-toggle{background:rgba(0,0,0,.06);color:#0f172a;border-color:rgba(0,0,0,.13)}',
      '[data-theme="light"] .theme-toggle:hover,[data-theme="light"] .lang-toggle:hover{background:rgba(0,0,0,.11)}',
      '[data-theme="light"] h1,[data-theme="light"] h2,[data-theme="light"] h3,[data-theme="light"] h4{color:#0f172a}',
      '[data-theme="light"] .text-muted{color:#64748b!important}',
      '[data-theme="light"] [style*="color:#6b7d93"]{color:#64748b!important}',
      '[data-theme="light"] [style*="color:#8899aa"]{color:#475569!important}',
      '[data-theme="light"] [style*="color:#9daec4"]{color:#4a6080!important}',
      '[data-theme="light"] [style*="color:#b0c0d4"],[data-theme="light"] [style*="color:#c8d4e0"]{color:#334155!important}',
      '[data-theme="light"] [style*="color:#e8edf2"]{color:#0f172a!important}',
      '[data-theme="light"] [style*="color:rgba(255,255,255"]{color:rgba(15,23,42,.7)!important}',
      /* policy.html / en/policy.html だけが持つ節のクラス。既定テーマが light なので、
         ここが無いと見出しが薄青の帯に白文字＝読めない（2026-08-20 に発見） */
      '[data-theme="light"] .policy-heading{color:#0f172a!important;background:rgba(61,155,255,.10)!important}',
      '[data-theme="light"] .policy-body{background:#fff!important;border-color:rgba(0,0,0,.08)!important}',
      '[data-theme="light"] .policy-body p,[data-theme="light"] .policy-body ol li,[data-theme="light"] .highlight-box p{color:#475569!important}',
      '[data-theme="light"] .policy-body strong{color:#0f172a!important}',
      '[data-theme="light"] .policy-body ol li strong{color:#8a6000!important}',
      '[data-theme="light"] .sub-heading{color:#1f6fd4!important}',
      '[data-theme="light"] .highlight-box{background:rgba(61,155,255,.08)!important;border-color:rgba(61,155,255,.28)!important}',
      '[data-theme="light"] .policy-link{color:#1f6fd4!important;border-bottom-color:rgba(31,111,212,.35)!important}',
      '[data-theme="light"] .policy-link:hover{color:#0b4fa0!important;border-bottom-color:rgba(11,79,160,.6)!important}',
      '[data-theme="light"] .policy-link:active{color:#8a6000!important;border-bottom-color:rgba(138,96,0,.6)!important}',
      '[data-theme="light"] ::-webkit-scrollbar-track{background:#f3f5f8}',
      '[data-theme="light"] ::-webkit-scrollbar-thumb{background:#c4cfdf}',
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ── ナビが無いページ用：右上に浮かせるラッパー ──
     404 / unsubscribe のような単体ページはヘッダーを持たない。ナビを新設すると
     ページのデザインが変わってしまうので、トグル2つだけを右上に固定配置する。 */
  function floatWrap() {
    var w = document.getElementById('pv-toggle-float');
    if (w) return w;
    w = document.createElement('div');
    w.id = 'pv-toggle-float';
    w.style.cssText = 'position:fixed;top:16px;right:16px;z-index:60;display:flex;align-items:center;gap:8px';
    document.body.appendChild(w);
    return w;
  }

  /* ── テーマボタンの注入＋バインド ── */
  function injectThemeBtn() {
    /* data-skin="off" を付けた <script> から読まれた場合、汎用ライトモードCSSは注入しない。
       ページ側が既に完成したライトテーマを持っている（airline-base.css 等）ケース用。
       トグルの見た目自体は lang-toggle.js の injectSkin() が全ページに供給する。 */
    var self = document.querySelector('script[src*="pv-toggles.js"]');
    if (!self || self.getAttribute('data-skin') !== 'off') injectCSS();
    // 既に独自実装の #theme-toggle があれば何もしない（二重バインド防止）
    if (document.getElementById('theme-toggle')) return;

    var btn = document.createElement('button');
    btn.id = 'theme-toggle';
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'ダーク/ライト切替');
    btn.innerHTML = (document.documentElement.getAttribute('data-theme') === 'light') ? MOON : SUN;

    var nav = document.getElementById('main-nav');
    if (nav) {
      // ナビ右端（最後の要素＝「← トップへ」等）の手前にラッパーで差し込む
      var row = nav.querySelector(':scope > div') || nav;
      var wrap = document.createElement('span');
      wrap.className = 'pv-toggle-wrap';
      wrap.appendChild(btn);
      if (row.lastElementChild) row.insertBefore(wrap, row.lastElementChild);
      else row.appendChild(wrap);
    } else {
      // ナビが無い単体ページ（404 / unsubscribe 等）は右上に浮かせる。
      // lang-toggle.js は #theme-toggle の直後に言語ボタンを挿すので、
      // このラッパーに入れておけば2つ並んで出る。
      floatWrap().appendChild(btn);
    }

    btn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', cur);
      try { localStorage.setItem('pv-theme', cur); } catch (e) {}
      btn.innerHTML = cur === 'dark' ? SUN : MOON;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectThemeBtn);
  } else {
    injectThemeBtn();
  }
})();
