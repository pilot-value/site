/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — 「ホーム画面に追加」の案内（2026-11-07）

   オーナー採用「スマホのホーム画面に置けるようにする（アプリのように開ける）」。
   置き場はオーナー決定の2か所：MY PAGE（profile.html）と、給与を出し終えた画面（pay-report.html の結果）。
   ページの側は <div data-pv-app="mypage"> か <div data-pv-app="done"> を置くだけ（結果の画面は描いたあと PVApp.mount を呼ぶ）。

   出す・出さない（★出さないのが既定）
     ・PC では出さない。すでにアプリとして開いているときも出さない。
     ・Android の Chrome など、ブラウザが「追加してよい」と言ってきたら（beforeinstallprompt）「追加する」のボタン1つ。
       押すとブラウザの追加の画面が出る。
     ・iPhone・iPad は「共有 → ホーム画面に追加」の1行（Safari にはボタンで出す口が無い）。
     ・それ以外のスマホ（ブラウザが言ってこない）は「メニュー（⋮）→ ホーム画面に追加」の1行。
     ・出し終えた画面は1回だけ（この端末で一度出したら、次からは出さない）。MY PAGE はいつも出す。
   ★説明の文を足さない（オーナー「画面は足すより削る」）。見出し1行と、ボタンか手順の1行だけ。
   ★計測は GA4 の名前だけ（app_hint_view・app_install_click・app_installed）。起動の回数は manifest の
     start_url に付けた utm_source=homescreen で数える（コードは要らない）。
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var d = document;
  var L = (window.PV_BASE === 'en' || d.documentElement.getAttribute('lang') !== 'ja') ? 'en' : 'ja';   // スペイン語のページは英語と同じ動き（pv-session.js）
  var T = {
    ja: {
      title: 'ホーム画面に追加',
      add:   '追加する',
      ios:   '{share} を押して「ホーム画面に追加」',
      menu:  'メニュー（⋮）から「ホーム画面に追加」',
      share: '共有',
    },
    en: {
      title: 'Add to Home Screen',
      add:   'Add',
      ios:   'Tap {share}, then “Add to Home Screen”',
      menu:  'Open the menu (⋮), then “Add to Home screen”',
      share: 'Share',
    }, /*PV-MSG:es*/ es: {
      title: 'Agregar a la pantalla de inicio',
      add:   'Agregar',
      ios:   'Toca {share} y luego «Agregar a inicio»',
      menu:  'Abre el menú (⋮) y luego «Agregar a la pantalla principal»',
      share: 'Compartir',
    } /*/PV-MSG:es*/
  };
  T = (window.PV_T && window.PV_T(T, L)) || T[L];   // スペイン語の辞書（gen-msg.mjs が足す）があればそれ

  var DONE_KEY = 'pv_app_hint_done';
  var prompt = null;          // ブラウザが渡してきた「追加の画面」を出す口（beforeinstallprompt）
  var slots = [];             // [{ el, where }]

  function track(name, params) {
    if (typeof window.gtag !== 'function') return;
    try { window.gtag('event', name, params || {}); } catch (e) {}
  }
  function standalone() {
    try { if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true; } catch (e) {}
    return window.navigator.standalone === true;
  }
  function isIOS() {
    var ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function isPhone() { return isIOS() || /Android/i.test(navigator.userAgent || ''); }
  /* どの形で出すか。'' は出さない。 */
  function mode() {
    if (standalone() || !isPhone()) return '';
    if (prompt) return 'prompt';
    return isIOS() ? 'ios' : 'menu';
  }
  function store(k, v) { try { if (v == null) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; }

  /* アイコンの住所は、そのページの manifest の住所から作る（../manifest-en.webmanifest → ../assets/app-icon-192.png） */
  var mf = d.querySelector('link[rel="manifest"]');
  var ICON = ((mf && mf.getAttribute('href')) || 'manifest.webmanifest').replace(/manifest[^/]*\.webmanifest$/, 'assets/app-icon-192.png');
  var SHARE_SVG = '<svg class="pvapp-share" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
    '<path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  function css() {
    if (d.getElementById('pvapp-css')) return;
    var s = d.createElement('style');
    s.id = 'pvapp-css';
    s.textContent =
      '.pvapp{display:flex;align-items:center;gap:14px}' +
      '.pvapp-ic{width:44px;height:44px;border-radius:11px;flex:none;display:block;box-shadow:0 1px 2px rgba(15,23,42,.12),0 4px 12px rgba(15,23,42,.10)}' +
      '.pvapp-tx{flex:1;min-width:0}' +
      '.pvapp-t{font-weight:700;font-size:.95rem;line-height:1.35}' +
      '.pvapp-how{margin-top:2px;font-size:.82rem;line-height:1.5;color:var(--pv-ink-2,#475569)}' +
      '[data-theme="dark"] .pvapp-how{color:rgba(232,237,242,.72)}' +
      '.pvapp-share{display:inline-block;vertical-align:-3px;margin:0 2px;color:var(--pv-accent-ink,#067563)}' +
      '.pvapp-btn{flex:none;appearance:none;border:0;border-radius:10px;padding:10px 18px;font:inherit;font-weight:700;font-size:.9rem;' +
        'background:var(--pv-accent-dark,#067563);color:#fff;cursor:pointer;' +
        'box-shadow:0 1px 2px rgba(6,117,99,.25),0 6px 16px rgba(6,117,99,.18);transition:transform .18s cubic-bezier(.34,1.56,.64,1),opacity .18s}' +
      '.pvapp-btn:hover{opacity:.92}' +
      '.pvapp-btn:active{transform:scale(.96)}' +
      '.pvapp-btn:focus-visible{outline:3px solid var(--pv-accent-line,#bfe6db);outline-offset:2px}' +
      '.pvapp-done{margin-top:20px;padding:14px 16px;border:1px solid var(--pv-line,#e3e9f0);border-radius:14px}';
    (d.head || d.documentElement).appendChild(s);
  }

  function html(m) {
    var how = m === 'prompt' ? ''
      : '<div class="pvapp-how">' + (m === 'ios'
        ? T.ios.replace('{share}', SHARE_SVG + '<span class="pvapp-sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">' + T.share + '</span>')
        : T.menu) + '</div>';
    return '<div class="pvapp" data-mode="' + m + '">' +
      '<img class="pvapp-ic" src="' + ICON + '" alt="" width="44" height="44"/>' +
      '<div class="pvapp-tx"><div class="pvapp-t">' + T.title + '</div>' + how + '</div>' +
      (m === 'prompt' ? '<button type="button" class="pvapp-btn">' + T.add + '</button>' : '') +
    '</div>';
  }

  function render(slot) {
    var m = mode();
    var el = slot.el;
    if (!m || (slot.where === 'done' && slot.shown == null && store(DONE_KEY) === '1')) {
      el.innerHTML = '';
      el.style.display = 'none';
      return;
    }
    css();
    el.innerHTML = html(m);
    if (slot.where === 'done') el.classList.add('pvapp-done');
    el.style.display = '';
    if (slot.shown !== m) {
      slot.shown = m;
      if (slot.where === 'done') store(DONE_KEY, '1');
      track('app_hint_view', { where: slot.where, mode: m });
    }
    var b = el.querySelector('.pvapp-btn');
    if (b) b.addEventListener('click', function () {
      if (!prompt) return;
      track('app_install_click', { where: slot.where });
      var p = prompt;
      prompt = null;                     // ブラウザの口は1回しか使えない
      try {
        p.prompt();
        Promise.resolve(p.userChoice).then(function () { renderAll(); }, function () { renderAll(); });
      } catch (e) { renderAll(); }
    });
  }
  function renderAll() { for (var i = 0; i < slots.length; i++) render(slots[i]); }

  function mount(el, where) {
    if (!el) return;
    for (var i = 0; i < slots.length; i++) if (slots[i].el === el) { render(slots[i]); return; }
    var slot = { el: el, where: where === 'done' ? 'done' : 'mypage', shown: null };
    slots.push(slot);
    render(slot);
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    try { e.preventDefault(); } catch (x) {}
    prompt = e;
    renderAll();
  });
  window.addEventListener('appinstalled', function () {
    prompt = null;
    track('app_installed', {});
    renderAll();
  });

  function boot() {
    var list = d.querySelectorAll('[data-pv-app]');
    for (var i = 0; i < list.length; i++) mount(list[i], list[i].getAttribute('data-pv-app'));
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();

  window.PVApp = { mount: mount };
})();
