/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — premium-auth-lock.js  v1.1
   "Give to Take" Soft Paywall — NYTimes-style ＋ 2通貨ゲート

   仕組み:
     1. .premium-gate.pv-locked は airline-base.css でブラー済み
     2. data-gate-key で通貨を分岐:
          （既定 / "review"）   口コミ枠   → pv_unlock_expiry     ← 口コミ投稿で解放（期限なし）
          "salary_detail"       給与枠     → pv_salary_unlock_expiry ← 給与明細で90日
        ※出したものと返るものを一致させる。口コミ枠の鍵で給与枠は開かない。
     3. localStorage fast-path（ゲートごとに自分のキーで判定）→ 即アンロック
     4. Supabase session → reviews_v2 proof_hash チェック（投稿済みなら口コミ枠だけ解放）
     5. 未クリアのゲートにだけ通貨に応じたオーバーレイ表示
     6. ja/en 自動判定（URL /en/ プレフィックス）

   使い方: 日本語 <script src="premium-auth-lock.js"></script>
           英語   <script src="../../airlines/premium-auth-lock.js"></script>
           どちらも pv-session.js の直後に置く。
   依存: airline-base.js (Supabase, airline code) より前に読む必要なし

   ★ 給与枠（salary_detail）は日本語112社・英語112社の全ページに入っている。
     置いているのは inject-salary-gate.mjs（冪等）。社を1社足したら流し直す。
     枠の外（ヒーローの4枚組・FAQ・JSON-LD の estimatedSalary）には
     機長／FOの平均とレンジが公開のまま残してある。各国SEOの本体なので隠さない。
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Config ──────────────────────────────────────────── */
  const SB_URL    = 'https://vzgmnkrggrwtsrpqndsm.supabase.co';
  const SB_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6Z21ua3JnZ3J3dHNycHFuZHNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzkwOTcsImV4cCI6MjA5MDAxNTA5N30.wE4cJbqeYGCgn5ZvHd80hYWgQuySKvOMJMbsJWOvmtw';

  /* 通貨キー: gate-key → localStorage キー */
  const KEY_REVIEW = 'pv_unlock_expiry';
  const KEY_SALARY = 'pv_salary_unlock_expiry';
  const GATE_STORAGE = { review: KEY_REVIEW, salary_detail: KEY_SALARY };

  /* ── Context detection ───────────────────────────────── */
  const IS_EN     = /^\/en\//.test(location.pathname);
  /* ★関数にしてある。このファイルは日英224ページのうち222ページで <head> から
       読まれる＝評価時点で document.body がまだ無い。定数で受けると必ず '' になり、
       ④の reviews_v2 照合（口コミの鍵をサーバから復活させる処理）が丸ごと素通りし、
       口コミ枠のリンクからも ?airline= が落ちる。2026-08-22 に発見。
       checkAccess() は DOMContentLoaded 後に走るので、そこで読めば必ず取れる。 */
  const airlineOf = () => (document.body && document.body.dataset.airline) || '';
  const RETURN    = encodeURIComponent(location.pathname + location.search);
  /* airlines/ も en/airlines/ も、それぞれの言語のトップから1階層下にある。
     日本語 /airlines/x.html + '../'    → /
     英語   /en/airlines/x.html + '../' → /en/
     ここを '../../' にすると英語のページから日本語の pay-report.html /
     submit-review.html / login.html へ飛ぶ（英語版が全部ある）。 */
  const BASE_PATH = '../';
  const reviewURL = () => BASE_PATH + 'submit-review.html?airline=' + airlineOf() + '&return=' + RETURN;
  const SALARY_URL = BASE_PATH + 'pay-report.html?return=' + RETURN;
  const LOGIN_URL  = BASE_PATH + 'login.html?return=' + RETURN;

  /* ── i18n strings ────────────────────────────────────── */
  const T = IS_EN ? {
    lock:          '🔒',
    titleAnon:     'Members Only',
    titleLogged:   'One Step to Unlock',
    descAnon:      'Post one anonymous review to unlock every airline\'s reviews — completely free.',
    descLogged:    'Post a review for this airline to unlock every airline\'s reviews.',
    // salary_detail 専用
    salDescAnon:   'Submit one payslip to unlock the detailed pay data (by aircraft & rank) for 90 days — completely free.',
    salDescLogged: 'Submit a payslip to unlock the detailed pay breakdown for 90 days.',
    salCta:        'Submit a Payslip Anonymously & Unlock',
    salFootNote:   'The image never leaves your device · No name required · 90-day access',
    give:          'GIVE',
    take:          'GET',
    ctaPost:       'Post a Review Anonymously & Unlock',
    ctaLogin:      'Log in',
    footNote:      'Anonymous · No name required',
  } : {
    lock:          '🔒',
    titleAnon:     'メンバー限定データ',
    titleLogged:   'あと一歩で解放',
    descAnon:      '匿名の口コミを1件投稿するだけで\n全社の口コミが読めるようになります。',
    descLogged:    'この航空会社の口コミを投稿すると\n全社の口コミが読めるようになります。',
    // salary_detail 専用
    salDescAnon:   '給与明細を1枚出すだけで\n詳細な給与データ（機種別・等級別）が90日間解放されます。',
    salDescLogged: '給与明細を1枚出すと\n詳細な給与データが90日間解放されます。',
    salCta:        '匿名で給与明細を出して解放する',
    salFootNote:   '画像は端末から出ません · 名前不要 · 90日間アクセス',
    give:          'GIVE',
    take:          'GET',
    ctaPost:       '匿名で口コミを投稿して解放する',
    ctaLogin:      'ログイン（投稿済みの方）',
    footNote:      '完全匿名 · 名前不要',
  };

  /* ── Gate helpers ────────────────────────────────────── */
  function gates() {
    return Array.from(document.querySelectorAll('.premium-gate'));
  }
  function keyOf(g) {
    var k = (g.getAttribute('data-gate-key') || (g.dataset && g.dataset.gateKey) || 'review');
    return GATE_STORAGE[k] ? k : 'review';
  }
  function validKey(storageKey) {
    try {
      var e = localStorage.getItem(storageKey);
      return !!(e && Date.now() < parseInt(e, 10));
    } catch (x) { return false; }
  }
  // 出したものと返るものを一致させる。口コミの鍵では給与枠は開かない。
  function isUnlocked(gateKey) {
    return validKey(gateKey === 'salary_detail' ? KEY_SALARY : KEY_REVIEW);
  }

  /* ── Lock / Unlock (single gate) ─────────────────────── */
  function lockGate(g) {
    g.classList.remove('pv-unlocked');
    g.classList.add('pv-locked');
  }
  function unlockGate(g) {
    g.classList.remove('pv-locked');
    g.classList.add('pv-unlocked');
    var ov = g.querySelector('.pv-gate-overlay');
    if (ov) ov.remove();
  }
  // 口コミ枠だけ。給与枠は pay-report.html が access_until から立てる。
  // 口コミの鍵は時間で切れない（pv-session.js の PVUnlock が正）。
  function setReviewExpiry() {
    var until = (window.PVUnlock && window.PVUnlock.reviewUntil)
      ? window.PVUnlock.reviewUntil()
      : Date.now() + 100 * 365 * 24 * 60 * 60 * 1000;   // 読み込み順が崩れたときの保険
    try { localStorage.setItem(KEY_REVIEW, String(until)); } catch (e) {}
  }

  /* ── Overlay HTML（通貨に応じて文言を切替）───────────── */
  function overlayHTML(loggedIn, gateKey) {
    var isSalary = gateKey === 'salary_detail';
    var title = loggedIn ? T.titleLogged : T.titleAnon;
    var desc  = isSalary ? (loggedIn ? T.salDescLogged : T.salDescAnon)
                         : (loggedIn ? T.descLogged    : T.descAnon);
    var cta   = isSalary ? T.salCta : T.ctaPost;
    // 給与枠は給与明細へ、口コミ枠は口コミフォームへ。行き先を取り違えると
    // 「入力したのに開かない」になる（口コミフォームはもう金額を集めない）。
    var href  = isSalary ? SALARY_URL : reviewURL();
    var foot  = isSalary ? T.salFootNote : T.footNote;
    var secondary = loggedIn ? '' :
      '<a href="' + LOGIN_URL + '" class="pv-btn-ghost" data-pv-cta="login">' + T.ctaLogin + '</a>';

    return [
      '<div class="pv-gate-overlay" role="dialog" aria-modal="true">',
        '<div class="pv-gate-card">',
          '<div class="pv-gate-icon">' + T.lock + '</div>',
          '<h3 class="pv-gate-title">' + title + '</h3>',
          '<div class="pv-give-take">',
            '<span class="pv-pill-give">' + T.give + '</span>',
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>',
            '<span class="pv-pill-take">' + T.take + '</span>',
          '</div>',
          '<p class="pv-gate-desc">' + desc.replace(/\n/g, '<br>') + '</p>',
          '<div class="pv-gate-actions">',
            '<a href="' + href + '" class="pv-btn-main" data-pv-cta="' + (isSalary ? 'salary' : 'review') + '">',
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
              cta,
            '</a>',
            secondary,
          '</div>',
          '<p class="pv-gate-footnote">' + foot + '</p>',
        '</div>',
      '</div>',
    ].join('');
  }

  /* ── Render overlays（対象ゲート配列に、通貨別の文言で）── */
  function renderOverlays(list, loggedIn) {
    list.forEach(function (g) {
      if (g.classList.contains('pv-locked') && !g.querySelector('.pv-gate-overlay')) {
        g.insertAdjacentHTML('beforeend', overlayHTML(loggedIn, keyOf(g)));
      }
    });
  }

  /* ── SHA-256 proof hash ──────────────────────────────── */
  function proofHash(userId, airline) {
    var data = new TextEncoder().encode(userId + '::pv_anon::' + airline + '::2026');
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      return Array.from(new Uint8Array(buf))
        .map(function (b) { return b.toString(16).padStart(2, '0'); })
        .join('');
    });
  }

  /* ── Supabase init (reuses window.supabase if loaded by airline-base.js) */
  var _sb = null;
  function getSB() {
    return new Promise(function (resolve) {
      if (_sb)                { resolve(_sb); return; }
      if (window.supabase)    { _sb = window.supabase.createClient(SB_URL, SB_KEY); resolve(_sb); return; }
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload  = function () { _sb = window.supabase.createClient(SB_URL, SB_KEY); resolve(_sb); };
      s.onerror = function () { resolve(null); };
      document.head.appendChild(s);
    });
  }

  /* ── Main access check ───────────────────────────────── */
  async function checkAccess() {
    var all = gates();
    if (!all.length) return;

    /* ① Fast path: ゲートごとに自分の通貨キーで判定 */
    var locked = [];
    all.forEach(function (g) {
      if (isUnlocked(keyOf(g))) { unlockGate(g); }
      else { lockGate(g); locked.push(g); }
    });
    if (!locked.length) return;

    /* ② Get Supabase client */
    var sb = await getSB();
    if (!sb) { renderOverlays(locked, false); return; }

    /* ③ Check session */
    var sessionResult;
    try { sessionResult = await sb.auth.getSession(); } catch (e) { renderOverlays(locked, false); return; }
    var session = sessionResult && sessionResult.data && sessionResult.data.session;
    if (!session) { renderOverlays(locked, false); return; }

    var uid = session.user.id;

    /* ④ 給与枠：サーバの access_until（給与明細で90日延びる）から復活させる。
       localStorage は端末ごとなので、これが無いと別の端末で明細を出した人が締め出される。 */
    if (locked.some(function (g) { return keyOf(g) === 'salary_detail'; })) {
      try {
        var pr = await sb.rpc('my_pay_reports');
        var until = pr && pr.data && pr.data.access_until ? Date.parse(pr.data.access_until) : 0;
        if (until > Date.now()) {
          try { localStorage.setItem(KEY_SALARY, String(until)); } catch (e2) {}
          locked = locked.filter(function (g) {
            if (keyOf(g) !== 'salary_detail') return true;
            unlockGate(g); return false;
          });
          if (!locked.length) return;
        }
      } catch (e) {}
    }

    /* ⑤ Check reviews_v2 (anonymous proof_hash)：投稿済みなら口コミ枠だけ解放 */
    var airline = airlineOf();
    if (airline) {
      try {
        var hash = await proofHash(uid, airline);
        var r2 = await sb.from('reviews_v2').select('id').eq('proof_hash', hash).limit(1);
        if (r2.data && r2.data.length > 0) {
          setReviewExpiry();
          locked = locked.filter(function (g) {
            if (keyOf(g) === 'salary_detail') return true;   // 給与枠は明細でしか開かない
            unlockGate(g); return false;
          });
          if (!locked.length) return;
        }
      } catch (e) {}

      /* 旧 reviews テーブル（user_id ベース）は廃止済みのため照合しない */
    }

    /* Logged in but hasn't given what this gate asks for */
    renderOverlays(locked, true);
  }

  /* ── 計測（GA4。既存の gtag をそのまま使う。新しい業者は入れない）────────
     枠は日英224ページに出ているが、そのボタンが押されているのかが分からなかった。
     押されていないなら明細の画面を直しても意味が無いし、押されているのに
     出す人が0なら直す場所はその先にある。どちらなのかをここで分ける。
     ★オーバーレイは後から差し込まれるので、document 側で受ける（1回で全枠を覆う）。
     ★送るのは行き先の種別だけ。会社名も金額も送らない。 */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('[data-pv-cta]') : null;
    if (!a || typeof window.gtag !== 'function') return;
    try { window.gtag('event', 'gate_cta_click', { kind: a.getAttribute('data-pv-cta') }); } catch (e2) {}
  });

  /* ── Boot ────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAccess);
  } else {
    checkAccess();
  }

})();
