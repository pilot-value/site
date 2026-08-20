/* ══════════════════════════════════════════════════════════════
   en-airline-reviews.js — EN 航空会社ページの口コミ欄

   JP 側は airlines/airline-base.js が口コミ欄ごと注入するが、EN の
   航空会社ページは airline-base.js も airline-base.css も読んでいない
   （lang-toggle.js と currency.js だけ）。base をまるごと読ませると
   タブ・レーティングバナー・モーダルまで付いてきて EN テンプレを壊すので、
   口コミ欄だけを自己完結で持つ。

   本文の日↔英の出し分けは review-i18n.js に任せる（JP と同じ実装を共有）。
   金額は「1,400万円」形式のまま出す。currency.js の MutationObserver が
   後から包んで通貨切替に追随させる（[[currency-switchable-price-rule]]）。

   前提: <body data-airline="CODE"> ／ supabase-js ／ review-i18n.js
   描画先: <section id="en-airline-reviews">
   ══════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';

  var SB_URL = 'https://vzgmnkrggrwtsrpqndsm.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6Z21ua3JnZ3J3dHNycHFuZHNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzkwOTcsImV4cCI6MjA5MDAxNTA5N30.wE4cJbqeYGCgn5ZvHd80hYWgQuySKvOMJMbsJWOvmtw';

  var CODE = (d.body && d.body.dataset.airline) || '';
  var SCORE_KEYS = ['culture_score','salary_score','benefits_score','wlb_score','ops_score','training_score'];
  var POS = { captain:'Captain', fo:'First Officer', cadet:'Trainee', former:'Former crew' };
  var CATS = [
    { key:'all', label:'All' },
    { key:'culture', label:'Culture' }, { key:'salary', label:'Pay' },
    { key:'benefits', label:'Benefits' }, { key:'wlb', label:'WLB' },
    { key:'ops', label:'Flight operations' }, { key:'training', label:'Training' },
  ];

  var rows = [];        // 取得済みの口コミ（表示用に整形済み）
  var filter = 'all';
  var loaded = false;

  function esc(s) { return w.PVReviewI18n ? PVReviewI18n.esc(s) : String(s == null ? '' : s); }

  // 解錠キーは JP 側（airline-base.js の isUnlocked）と同じものを見る
  function unlocked() {
    try {
      var e = localStorage.getItem('pv_unlock_expiry');
      return !!e && Date.now() < parseInt(e, 10);
    } catch (err) { return false; }
  }

  /* 万円表記。currency.js が拾えるよう桁区切りを必ず入れる。 */
  function man(total) {
    if (!(total > 0)) return '';
    return Math.round(total).toLocaleString('en-US') + '万円';
  }

  function mapRow(r) {
    var scores = SCORE_KEYS.map(function (k) { return r[k]; }).filter(function (s) { return s > 0; });
    var avg = scores.length ? scores.reduce(function (a, b) { return a + b; }, 0) / scores.length : 3;
    var body = PVReviewI18n.pick(r);
    // 総額の優先順位は JP 側 mapV2 と揃える
    var total = r.annual_salary ? r.annual_salary
      : (r.base_annual || r.flight_allowance_annual)
        ? (r.base_annual || 0) + (r.flight_allowance_annual || 0) + (r.bonus || 0)
        : (r.monthly_salary ? r.monthly_salary * 12 + (r.bonus || 0) : 0);
    return {
      pos: r.position || '', exp: r.tenure_bucket || '—',
      rating: Math.max(1, Math.min(5, Math.round(avg))),
      salary: man(total),
      cat: (body.cats[0] || {}).k || '',
      text: body.text, translated: body.translated, origText: body.origText, from: body.from,
      date: r.created_at ? r.created_at.slice(0, 7).replace('-', '.') : '—',
    };
  }

  function cardHTML(r) {
    var stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
    // .info-card はページ側の既存クラス（FAQ 等と同じ面）。配色もライトテーマも向こう持ち。
    return '<div class="info-card enrv-card">' +
      '<div class="enrv-head">' +
        '<span class="enrv-pos">' + esc(POS[r.pos] || r.pos || 'Pilot') + '</span>' +
        '<span class="enrv-stars">' + stars + '</span>' +
        '<span class="enrv-meta">Experience ' + esc(r.exp) + ' · ' + esc(r.date) + '</span>' +
      '</div>' +
      (r.salary ? '<div class="enrv-salary">' + r.salary +
        ' <span class="enrv-meta enrv-salary-note">Annual salary (approx.)</span></div>' : '') +
      '<p class="enrv-body">' + esc(r.text) +
        (r.translated ? PVReviewI18n.noteHTML(r.from) : '') + '</p>' +
      (r.translated ? PVReviewI18n.origHTML(r.origText) : '') +
    '</div>';
  }

  function gateHTML(remaining) {
    return '<div class="enrv-gate">' +
      '<div class="enrv-gate-lock">🔒</div>' +
      '<div class="enrv-gate-title">Members-only data</div>' +
      '<div class="enrv-gate-remain">' + remaining + ' more review' + (remaining === 1 ? '' : 's') + '</div>' +
      '<p class="enrv-gate-desc">Post one anonymous review and every detail<br>unlocks for a full month.</p>' +
      '<a href="../submit-review.html" class="enrv-btn">Post a review anonymously to unlock</a>' +
      '<div class="enrv-gate-fine">Completely free · anonymous · no personal details needed</div>' +
    '</div>';
  }

  function render() {
    var host = d.getElementById('en-airline-reviews');
    if (!host) return;

    var shown = filter === 'all' ? rows : rows.filter(function (r) { return r.cat === filter; });
    var open = unlocked();
    var visible = open ? shown : shown.slice(0, 1);
    var remaining = open ? 0 : Math.max(0, shown.length - 1);

    var chips = CATS.map(function (c) {
      return '<button type="button" class="enrv-chip' + (filter === c.key ? ' active' : '') +
        '" data-cat="' + c.key + '">' + c.label + '</button>';
    }).join('');

    var list = visible.map(cardHTML).join('');
    if (!shown.length) {
      list = '<p class="enrv-empty">' + (loaded
        ? 'No reviews in this category yet. Be the first to post one.'
        : 'Loading reviews…') + '</p>';
    }

    // 見出し・面の作りはページ内の他セクション（.glass p-8 ＋ .section-badge ＋ h2.text-2xl）に合わせる。
    // fade-up は付けない — ページ側の IntersectionObserver は読み込み時に居た要素しか見ておらず、
    // 後から差し込むと .visible が付かず opacity:0 のまま消える。
    host.innerHTML =
      '<div class="glass p-8">' +
        '<div class="section-badge mb-4">Reviews</div>' +
        '<div class="enrv-bar">' +
          '<h2 class="text-2xl font-bold enrv-title">Pilot reviews' +
            (rows.length ? ' <span class="enrv-count">' + rows.length + '</span>' : '') + '</h2>' +
          '<a href="../submit-review.html" class="enrv-btn enrv-btn-sm">＋ Post a review anonymously</a>' +
        '</div>' +
        '<div class="enrv-chips">' + chips + '</div>' +
        list +
        (remaining > 0 ? gateHTML(remaining) : '') +
      '</div>';

    host.querySelectorAll('.enrv-chip').forEach(function (b) {
      b.addEventListener('click', function () { filter = b.dataset.cat; render(); });
    });

    // currency.js の MutationObserver は init() の scan と startObserver の間に
    // 入った描画を取りこぼすことがある（実測で年収が万円のまま残った）。
    // 描画のたびに自分で包み直して通貨切替に確実に追随させる。
    if (w.PVCurrency) { try { PVCurrency.scan(host); PVCurrency.apply(); } catch (e) {} }
  }

  function injectCSS() {
    if (d.getElementById('enrv-css')) return;
    var st = d.createElement('style');
    st.id = 'enrv-css';
    st.textContent = [
      '.enrv-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}',
      '.enrv-title{margin:0}',
      '.enrv-count{display:inline-block;margin-left:6px;padding:1px 9px;border-radius:999px;font-size:.78rem;font-weight:700;background:rgba(245,200,66,.12);color:#f5c842;border:1px solid rgba(245,200,66,.25)}',
      '.enrv-btn{display:inline-flex;align-items:center;gap:8px;padding:12px 24px;border-radius:10px;font-weight:700;font-size:.9rem;background:linear-gradient(135deg,#f97316,#f5c842);color:#000;border:none;cursor:pointer;text-decoration:none;transition:opacity .2s,transform .2s cubic-bezier(.16,1,.3,1)}',
      '.enrv-btn:hover{opacity:.9;transform:translateY(-1px)}',
      '.enrv-btn:focus-visible{outline:2px solid #f5c842;outline-offset:3px}',
      '.enrv-btn:active{transform:translateY(0);opacity:.8}',
      '.enrv-btn-sm{padding:8px 18px;font-size:.8rem}',
      '.enrv-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}',
      '.enrv-chip{padding:6px 14px;border-radius:999px;font-size:.78rem;font-weight:600;color:#6b7d93;background:transparent;border:1px solid rgba(255,255,255,.10);cursor:pointer;transition:color .2s,border-color .2s,background .2s}',
      '.enrv-chip:hover:not(.active){color:#c5d5e8;border-color:rgba(255,255,255,.2)}',
      '.enrv-chip:focus-visible{outline:2px solid #f5c842;outline-offset:2px}',
      '.enrv-chip.active{color:#e8edf2;background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18)}',
      '.enrv-card{margin-bottom:12px;transition:border-color .2s,transform .2s cubic-bezier(.16,1,.3,1)}',
      '.enrv-card:hover{border-color:rgba(255,255,255,.14);transform:translateY(-1px)}',
      '.enrv-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}',
      '.enrv-pos{font-size:.75rem;padding:3px 9px;border-radius:5px;background:rgba(255,255,255,.06);color:#9ca3af}',
      '.enrv-stars{color:#f5c842;font-size:.85rem;letter-spacing:.04em}',
      '.enrv-meta{color:#6b7d93;font-size:.72rem}',
      '.enrv-head .enrv-meta{margin-left:auto}',
      '.enrv-salary{font-size:.85rem;font-weight:700;color:#f5c842;margin-bottom:8px}',
      '.enrv-salary-note{font-weight:400}',
      '.enrv-body{font-size:.87rem;line-height:1.75;margin:0;color:#c3d0e0}',
      '.enrv-empty{font-size:.9rem;color:#6b7d93;padding:20px 0;margin:0}',
      '.enrv-gate{text-align:center;padding:28px 16px;border-radius:14px;background:rgba(24,33,47,.85);border:1px solid rgba(245,200,66,.2)}',
      '.enrv-gate-lock{font-size:1.5rem;margin-bottom:6px}',
      '.enrv-gate-title{font-weight:700;font-size:1.05rem;margin-bottom:4px}',
      '.enrv-gate-remain{font-size:.8rem;color:#f5c842;font-weight:600;margin-bottom:10px}',
      '.enrv-gate-desc{font-size:.85rem;color:#6b7d93;margin:0 0 16px}',
      '.enrv-gate-fine{font-size:.72rem;color:#6b7d93;margin-top:12px}',
      '[data-theme="light"] .enrv-card:hover{border-color:rgba(0,0,0,.14)!important}',
      '[data-theme="light"] .enrv-body{color:#334155!important}',
      '[data-theme="light"] .enrv-meta{color:#475569!important}',
      '[data-theme="light"] .enrv-pos{background:rgba(15,23,42,.06)!important;color:#334155!important}',
      '[data-theme="light"] .enrv-chip{border-color:rgba(0,0,0,.12)!important;color:#64748b!important}',
      '[data-theme="light"] .enrv-chip.active{color:#0f172a!important;background:rgba(0,0,0,.07)!important;border-color:rgba(0,0,0,.18)!important}',
      '[data-theme="light"] .enrv-empty{color:#475569!important}',
      // ライトテーマのゴールドは JP 側（airline-base.css）と同じ #7a5800 系に寄せる。
      // 白面に #f5c842 を置くとほぼ読めず、白面に白のゲートは輪郭が消える。
      '[data-theme="light"] .enrv-count{background:rgba(161,120,0,.10)!important;color:#92690a!important;border-color:rgba(161,120,0,.28)!important}',
      '[data-theme="light"] .enrv-stars{color:#b38000!important}',
      '[data-theme="light"] .enrv-salary{color:#7a5800!important}',
      '[data-theme="light"] .enrv-gate{background:rgba(161,120,0,.05)!important;border-color:rgba(161,120,0,.3)!important}',
      '[data-theme="light"] .enrv-gate-remain{color:#92690a!important}',
      '[data-theme="light"] .enrv-gate-desc,[data-theme="light"] .enrv-gate-fine{color:#475569!important}',
    ].join('');
    (d.head || d.documentElement).appendChild(st);
  }

  async function load() {
    if (!CODE || !w.supabase || !w.PVReviewI18n) return;
    var sb = w.supabase.createClient(SB_URL, SB_ANON);
    // orig_lang/translations がまだ無い環境では2列を外して引き直す
    var COLS = 'id,position,tenure_bucket,annual_salary,base_annual,flight_allowance_annual,monthly_salary,bonus,' +
      SCORE_KEYS.join(',') + ',' + PVReviewI18n.KEYS.map(function (k) { return k + '_comment'; }).join(',') + ',created_at';
    var res = await PVReviewI18n.fetchWithFallback(function (extra) {
      return sb.from('reviews_v2').select(COLS + extra)
        .eq('airline', CODE).order('created_at', { ascending: false }).limit(200);
    });
    // 本文も年収も無い行は情報が無いのでカードにしない（空カード防止）
    rows = (res && res.data ? res.data : []).map(mapRow)
      .filter(function (r) { return r.text || r.salary; });
    loaded = true;
    render();
  }

  function init() {
    if (!d.getElementById('en-airline-reviews')) return;
    injectCSS();
    render();                                   // 先に枠を出す（取得は非同期）
    load().catch(function () { loaded = true; render(); });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init);
  else init();
})(window, document);
