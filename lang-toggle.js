/* ═══════════════════════════════════════════════════
   PILOT VALUE — Language Toggle (JP / EN)
   Key: pv-lang  |  Values: 'ja' | 'en'
   Pattern-based routing — no manual page map needed.
   ═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── EN 実在スラグ allowlist ────────────────────────────────────
     en/airlines/ に実在する airline ページのみ EN へ写像する（無い社へ飛ばすと 404＋
     保存済み EN 設定での自動リダイレクト罠になる）。Phase 2 で EN ページを増やしたら
     下の EN-AIRLINES ブロックを再生成すること（`node gen-en-manifest.mjs`）。 */
  /* EN-AIRLINES:BEGIN (auto-generated from en/airlines/*.html — do not hand-edit) */
  var EN_AIRLINES = new Set([
    "aegean", "aer-lingus", "aeromexico", "air-canada", "air-china", "air-france",
    "air-india", "air-new-zealand", "airasia", "airdo", "airjapan", "airx-charter",
    "alaska-airlines", "allegiant", "american", "amx", "ana", "ana-vs-emirates",
    "ana-vs-jal", "ana-wings", "asiana", "austrian", "avianca", "bamboo-airways",
    "batik-air", "breeze-airways", "british-airways", "cathay-pacific", "china-airlines", "china-eastern",
    "china-southern", "copa-airlines", "daiichi-air", "delta", "eagle-jet", "easyjet",
    "egyptair", "emirates", "emirates-vs-qatar", "ethiopian-airlines", "etihad", "eurowings",
    "eva-air", "fda", "fiji-airways", "finnair", "frontier", "gaishi-vs-nikkei",
    "garuda-indonesia", "gulf-air", "hac", "hainan-airlines", "hong-kong-express", "iberia",
    "ibex", "icelandair", "indigo", "ita-airways", "j-air", "jac",
    "jal", "jetblue", "jetstar", "jetstar-japan", "jta", "kenya-airways",
    "klm", "korean-air", "kuwait-airways", "latam", "lcc-hikaku", "lot",
    "lufthansa", "malaysia-airlines", "norwegian", "oman-air", "orc", "peach",
    "philippine-airlines", "porter", "qantas", "qatar-airways", "rac", "riyadh-air",
    "root-aviation", "royal-brunei", "royal-jordanian", "ryanair", "sas", "saudia",
    "scoot", "shin-central", "shin-nihon", "singapore-airlines", "skymark", "solairus",
    "solaseed", "south-african-airways", "southwest", "spirit", "spring-japan", "starflyer",
    "starlux", "starlux-tenshoku", "swiss", "tap", "thai-airways", "toho-air",
    "toki-air", "turkish-airlines", "united", "vietjet", "vietnam-airlines", "virgin-atlantic",
    "vueling", "westjet", "wizz-air", "zipair"
  ]);
  /* EN-AIRLINES:END */

  /* ── EN 実在トップ級ページ allowlist ──────────────────────────────
     en/ 直下に実在するページのみ EN へ写像する。airlines と同じく、無い所へ飛ばすと
     404＋保存済み EN 設定での自動リダイレクト罠になる。Phase 2-D で増やしたら
     下の EN-PAGES ブロックを再生成すること（`node gen-en-manifest.mjs`）。 */
  /* EN-PAGES:BEGIN (auto-generated from en/*.html — do not hand-edit) */
  var EN_PAGES = new Set([
    "404.html", "actual-pay.html", "admin.html", "africa-pilot-salary.html",
    "airline-conditions.html", "asia-pilot-salary.html", "auth-callback.html", "community.html",
    "contact.html", "countries.html", "deep-pay-compare.html", "deep-pay.html",
    "europe-pilot-salary.html", "guide.html", "help.html", "latin-america-pilot-salary.html",
    "login.html", "middle-east-pilot-salary.html", "my-value.html", "north-america-pilot-salary.html",
    "oceania-pilot-salary.html", "pay-report.html", "personal-data.html", "pilot-salary-guide.html",
    "pilot-tenshoku.html", "pilot-vs-bengoshi.html", "pilot-vs-isha.html", "pilot-vs-kochin.html",
    "policy.html", "privacy-pilot.html", "privacy.html", "profile.html",
    "signup.html", "sitemap.html", "submit-review.html", "terms.html",
    "unsubscribe.html", "world-airlines.html", "world-jobs.html"
  ]);
  /* EN-PAGES:END */

  /* ── EN 実在の国別ページ allowlist ────────────────────────────────
     en/countries/ に実在する国ページのみ EN へ写像する。airlines と同じ理由。
     増やしたら `node gen-en-manifest.mjs` で再生成すること。 */
  /* EN-COUNTRIES:BEGIN (auto-generated from en/countries/*.html — do not hand-edit) */
  var EN_COUNTRIES = new Set([
    "australia", "austria", "bahrain", "brunei",
    "canada", "chile", "china", "colombia",
    "egypt", "ethiopia", "fiji", "finland",
    "france", "germany", "greece", "hong-kong",
    "iceland", "india", "indonesia", "ireland",
    "italy", "japan", "jordan", "kenya",
    "kuwait", "malaysia", "malta", "mexico",
    "netherlands", "new-zealand", "norway", "oman",
    "panama", "philippines", "poland", "portugal",
    "qatar", "saudi-arabia", "singapore", "south-africa",
    "south-korea", "spain", "sweden", "switzerland",
    "taiwan", "thailand", "turkey", "uae",
    "united-kingdom", "united-states", "vietnam"
  ]);
  /* EN-COUNTRIES:END */

  /* 他モジュール（search.js のドロワー等）が「EN 版が実在するか」を判定するための唯一の正。
     保存済み設定による early return より前で公開しておくこと。 */
  window.PV_EN_PAGES = EN_PAGES;

  /* ── URL mapping helpers ── */
  function jaToEn(path) {
    if (path === '/' || path === '/index.html') return '/en/';
    // /airlines/xxx.html → /en/airlines/xxx.html （EN ページが実在する社のみ）
    var m = path.match(/^\/airlines\/([^/]+)\.html$/);
    if (m) return EN_AIRLINES.has(m[1]) ? '/en' + path : null;
    // /countries/xxx.html → /en/countries/xxx.html （EN ページが実在する国のみ）
    var c = path.match(/^\/countries\/([^/]+)\.html$/);
    if (c) return EN_COUNTRIES.has(c[1]) ? '/en' + path : null;
    // /xxx.html → /en/xxx.html （EN ページが実在するトップ級のみ）
    var t = path.match(/^\/([^/]+\.html)$/);
    if (t) return EN_PAGES.has(t[1]) ? '/en' + path : null;
    return null; // no EN version for other pages
  }

  function enToJa(path) {
    if (path === '/en' || path === '/en/') return '/';
    return path.replace(/^\/en/, '') || '/';
  }

  /* ── Detect current state ── */
  var raw = location.pathname.replace(/\/$/, '') || '/';
  var isEN = raw.indexOf('/en') === 0;

  /* ── Auto-redirect based on saved preference ── */
  var saved = localStorage.getItem('pv-lang');
  if (saved === 'en' && !isEN) {
    var enDest = jaToEn(raw);
    if (enDest) { location.replace(enDest); return; }
  }
  if (saved === 'ja' && isEN) {
    location.replace(enToJa(raw)); return;
  }

  /* ── トグルの見た目を供給する（テーマボタンとセット） ─────────────────
     `lang-toggle.js` は 276/284 ページに届く（JP航空会社116枚には airline-base.js が
     動的に読み込む）ので、ここ1箇所でサイト全体のトグルの見た目を揃えられる。
     値は airlines/airline-base.css:6-13 の確定トーンをそのまま使う。

     <style> は head の「先頭」に挿す。そうするとカスケードがこうなる：
       ・ベース(.theme-toggle / .lang-toggle, 詳細度 0,1,0)
           → 独自定義を持つページではページ側が後勝ち＝既存の見た目を壊さない。
             定義が無いページ（community / login / profile 等18枚）にだけ効く。
       ・ライト([data-theme="light"] .theme-toggle, 詳細度 0,1,1)
           → EN航空会社110枚のインライン .theme-toggle{…}(0,1,0) に詳細度で勝つので、
             110枚を1枚も編集せずに「ライトで白背景に白文字」が解消する。
             既に正しいライト規則を持つページとは同詳細度＝後勝ちでページ側が勝つ。 */
  function injectSkin() {
    if (document.getElementById('pv-toggle-skin')) return;
    var s = document.createElement('style');
    s.id = 'pv-toggle-skin';
    s.textContent = [
      '.theme-toggle{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,.07);color:#e8edf2;border:1px solid rgba(255,255,255,.12);cursor:pointer;transition:background .2s,color .2s,border-color .2s;flex-shrink:0}',
      '.theme-toggle:hover{background:rgba(255,255,255,.13)}',
      '.lang-toggle{display:inline-flex;align-items:center;gap:4px;padding:0 10px;height:38px;border-radius:10px;background:rgba(255,255,255,.07);color:#e8edf2;font-size:.75rem;font-weight:700;letter-spacing:.04em;border:1px solid rgba(255,255,255,.12);cursor:pointer;transition:background .2s,color .2s,border-color .2s;flex-shrink:0;white-space:nowrap}',
      '.lang-toggle:hover{background:rgba(255,255,255,.13)}',
      '.theme-toggle:focus-visible,.lang-toggle:focus-visible{outline:2px solid #3d9bff;outline-offset:2px}',
      '.theme-toggle:active,.lang-toggle:active{transform:translateY(1px)}',
      '[data-theme="light"] .theme-toggle{background:rgba(0,0,0,.06);color:#0f172a;border-color:rgba(0,0,0,.13)}',
      '[data-theme="light"] .theme-toggle:hover{background:rgba(0,0,0,.11)}',
      '[data-theme="light"] .lang-toggle{background:rgba(0,0,0,.06);color:#0f172a;border-color:rgba(0,0,0,.13)}',
      '[data-theme="light"] .lang-toggle:hover{background:rgba(0,0,0,.11)}'
    ].join('\n');
    var head = document.head || document.documentElement;
    head.insertBefore(s, head.firstChild);
  }

  /* ── Inject button after DOM ready ── */
  function injectBtn() {
    injectSkin();
    if (document.getElementById('lang-toggle')) return;
    // JP専用ページ（EN版なし）では言語トグル不要
    if (!isEN && !jaToEn(raw)) return;

    var btn = document.createElement('button');
    btn.id = 'lang-toggle';
    btn.className = 'lang-toggle';
    btn.setAttribute('aria-label', isEN ? 'Switch to Japanese' : 'Switch to English');
    btn.innerHTML = isEN
      ? '<span aria-hidden="true" style="font-size:1.05em">🇺🇸</span> EN'
      : '<span aria-hidden="true" style="font-size:1.05em">🇯🇵</span> JP';

    // Prefer inserting after theme-toggle; fall back to last child in nav
    var themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.parentNode.insertBefore(btn, themeBtn.nextSibling);
    } else {
      var nav = document.getElementById('main-nav');
      if (nav) {
        var inner = nav.querySelector('.max-w-7xl');
        if (inner) inner.appendChild(btn);
        else nav.appendChild(btn);
      } else {
        // ナビが無い単体ページ（404 等）: pv-toggles.js が作る右上フロートに相乗りする
        var float = document.getElementById('pv-toggle-float');
        if (!float) return;
        float.appendChild(btn);
      }
    }

    btn.addEventListener('click', function () {
      if (isEN) {
        localStorage.setItem('pv-lang', 'ja');
        location.href = enToJa(raw);
      } else {
        var enDest = jaToEn(raw);
        if (!enDest) return;
        localStorage.setItem('pv-lang', 'en');
        location.href = enDest;
      }
    });
  }

  /* 見た目だけは DOM 待ちせず即注入する（ライトテーマでボタンが一瞬白飛びするのを防ぐ） */
  injectSkin();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBtn);
  } else {
    injectBtn();
  }
})();
