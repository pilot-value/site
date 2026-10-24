/* ══════════════════════════════════════════════════════════════
   airline-reviews-ui.js — 航空会社ページの口コミUI（日英共通の唯一の実装）

   スコアバナー / カテゴリ別グリッド / タブ / 口コミ一覧・ゲートは、
   以前 airline-base.js（JP専用）にだけ存在していた。EN ページは
   airline-base.js を読めない（テーマ・ナビ・モーダルが EN テンプレを壊す）ため
   口コミ欄そのものが存在しなかった。

   同じ描画コードを2本持つと必ず日英がズレるので、描画は「この1本」に集約し、
   文言だけを LANG で差し替える。JP 側の出力HTMLは抽出前とバイト単位で同一。

   前提:
     <body data-airline="CODE">
     airline-reviews-data.js（window.PVReviewData）
     airline-base.css（.hrb-* / .rcg-* / .rv-* / .airline-tab-* の見た目）
       — 読み込まれていなければこのファイルが <head> 先頭に差し込む。
         先頭に入れるのは、ページ自身のインラインCSS（.hero-airline や
         [data-theme=light] .glass など13セレクタが重複）を勝たせるため。
   ══════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';

  // ── 言語判定 ─────────────────────────────────────
  var LANG = ((d.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('en') === 0) ? 'en' : 'ja';

  // ── UI文言（描画コードは共通・ここだけが言語で変わる）──────
  var STR = {
    ja: {
      hrbHeading: function (n) { return 'パイロットによる評価スコア — ' + n; },
      hrbLabel: 'パイロット総合評価',
      respondents: function (n) { return n + '名が回答'; },
      sampleData: 'サンプルデータ',
      postReview: '匿名で口コミを投稿する',
      ctaSub: '匿名・無料',
      rcgHeading: function (c) { return 'カテゴリ別のパイロット口コミ（' + c + '件）'; },
      catCount: function (n) { return n + '件'; },
      tabs: { overview: '企業トップ', reviews: '口コミ', salary: '年収・給与', jobs: '採用情報' },
      reviewsHeading: '口コミ一覧',
      postReviewShort: '＋ 匿名で口コミを投稿する',
      all: '全て',
      empty: 'このカテゴリの口コミはまだありません。<br>最初の口コミを投稿してみましょう。',
      gateTitle: 'メンバー限定データ',
      // 未解放でも全件カードは出る（本文の先頭1/8だけ素で読める）ので「残りN件」ではない。
      gateAll: function (n) { return n + '件の口コミを全文で読む'; },
      lockedCta: '匿名で口コミを投稿して解放する',
      srvLockNote: '本文は、口コミを1件出した方だけが読めます。',
      gateDesc: '匿名の口コミを1件投稿するだけで<br>全社の口コミがまるごと読めます。',
      gateBtn: '匿名で口コミを投稿して解放する',
      gateLogin: 'ログイン（投稿済みの方）',
      sumSrcTag: '要約のもと',
      gateFine: '完全匿名 · 名前不要',
      catFallback: '口コミ',
      pilot: 'パイロット',
      POS: { captain: '機長', fo: '副操縦士', cadet: '訓練生', former: '元乗務員', pilot: 'パイロット' },
      JOIN: { new: '新卒', mid: '中途' },
      joined: function (j) { return j + '入社'; },
      tenure: function (y) { return '在籍' + y + '年目'; },
      postedOn: '口コミ投稿日: ',
      readMore: function (n) { return '続きを見る（全' + n + '文字）'; },
      source: '出典',
      salaryLabels: ['年収', '月給（総額）', '残業代（月）', '賞与（年）'],
      viewReview: '口コミを見る',
      rmTitle: '続きを読むには口コミの投稿が必要です',
      rmDesc: '口コミを1件投稿すると<br>全てのレビュー全文を<strong style="color:#e8edf2">閲覧できます</strong>',
      rmBtn: '匿名で口コミを投稿して解放する',
      rmLogin: '既にアカウントをお持ちの方はログイン',
      rmFine: '完全無料・匿名・個人情報不要',
      vcBadge: '現地パイロットの生の声',
      vcPro: '評価が高い点',
      vcCon: '注意・懸念点',
      vcGateTitle: 'カテゴリ別（企業文化・給与・福利厚生・ワークライフバランス・運航環境・訓練環境）の口コミをすべて閲覧',
      vcGateDesc: '上は代表的な1件ずつのみ。口コミを1件投稿すると、全カテゴリの口コミを<strong style="color:#e8edf2">無料</strong>で閲覧できます。',
      vcGateBtn: '匿名で口コミを投稿して全カテゴリを開放する →',
      vcGateFine: '完全無料・匿名・個人情報不要',
      vcSrcLabel: '口コミ引用元',
      vcRating: function (r) { return '（★' + r.toFixed(1) + '/5）'; },
      vcYear: function (y) { return '・' + y + '年'; },
      // .section-badge の文字からタブを決める。EN ページは badge が英語なので別表。
      // 「年収」だけだと、手取りの内訳や機種別の年収表が企業トップに残ってしまう（11ページ）。
      // 年収の詳細は「年収・給与」タブにまとめて premium-gate の中に入れる（2026-08-16）。
      // 高給の理由 / 選択基準 / 選び方ガイド / 差の仕組み / 各社詳細 / 全項目比較 は
      // 金額の表ではない解説なので、当たらないまま企業トップに残す。
      secSalary: /年収|手取り|機種別|詳細比較|ANA比較/,
      // 求人の掲載を停止した会社は見出しが「応募要件」なので、これも拾わないと
      // タブだけ残って中身が空になる（2026-08-15）。
      secJobs: /募集|採用|求人|応募/,
    },
    en: {
      hrbHeading: function (n) { return 'Pilot Ratings — ' + n; },
      hrbLabel: 'Overall Pilot Rating',
      respondents: function (n) { return n + (n === 1 ? ' response' : ' responses'); },
      sampleData: 'Sample data',
      postReview: 'Post a review anonymously',
      ctaSub: 'Anonymous · Free',
      rcgHeading: function (c) { return 'Pilot Reviews by Category (' + c + ')'; },
      catCount: function (n) { return String(n); },
      tabs: { overview: 'Overview', reviews: 'Reviews', salary: 'Salary', jobs: 'Hiring' },
      reviewsHeading: 'All Reviews',
      postReviewShort: '＋ Post a review anonymously',
      all: 'All',
      empty: 'No reviews in this category yet.<br>Be the first to post one.',
      gateTitle: 'Members-only data',
      gateAll: function (n) { return 'Read all ' + n + (n === 1 ? ' review' : ' reviews') + ' in full'; },
      lockedCta: 'Post a review anonymously to unlock',
      srvLockNote: 'Only pilots who have shared one review can read the full text.',
      gateDesc: 'Post one anonymous review and every airline&rsquo;s<br>reviews open up.',
      gateBtn: 'Post a review anonymously to unlock',
      gateLogin: 'Log in (already posted)',
      sumSrcTag: 'Used in the summary',
      gateFine: 'Completely anonymous · No name required',
      catFallback: 'Review',
      pilot: 'Pilot',
      POS: { captain: 'Captain', fo: 'First Officer', cadet: 'Trainee', former: 'Former crew', pilot: 'Pilot' },
      JOIN: { new: 'New graduate', mid: 'Mid-career' },
      joined: function (j) { return 'Joined: ' + j; },
      tenure: function (y) { return y + ' yrs tenure'; },
      postedOn: 'Posted: ',
      readMore: function (n) { return 'Read more (' + n + ' chars)'; },
      source: 'Source',
      salaryLabels: ['Annual', 'Monthly (gross)', 'Overtime (mo.)', 'Bonus (yr.)'],
      viewReview: 'View review',
      rmTitle: 'Post a review to keep reading',
      rmDesc: 'Post one review of your own<br>to read <strong style="color:#e8edf2">every review in full</strong>',
      rmBtn: 'Post a review anonymously to unlock',
      rmLogin: 'Already have an account? Log in',
      rmFine: 'Free · anonymous · no personal details',
      vcBadge: 'Voices from line pilots',
      vcPro: 'What pilots rate highly',
      vcCon: 'Caveats and concerns',
      vcGateTitle: 'Read every review across all six categories — culture, pay, benefits, work-life balance, operations and training',
      vcGateDesc: 'Only one review per side is shown above. Post one review of your own to read every category <strong style="color:#e8edf2">for free</strong>.',
      vcGateBtn: 'Post a review anonymously to unlock every category →',
      vcGateFine: 'Free · anonymous · no personal details',
      vcSrcLabel: 'Review sources',
      vcRating: function (r) { return ' (★' + r.toFixed(1) + '/5)'; },
      vcYear: function (y) { return ' · ' + y; },
      // Career Ladder は等級別の給与表なので Salary タブが正しい。ここに入れないと
      // overview 扱いになり、年収枠（premium-gate）が Salary Data と Career Ladder を
      // まとめて包んだとき、下の :842 で枠のタブ属性が overview に上書きされて
      // Salary タブが空になる。
      secSalary: /Salary|Career Ladder/,
      secJobs: /Job|Requirement/,
    },
  };
  var L = STR[LANG];

  // ── データ ───────────────────────────────────────
  var _RD = w.PVReviewData || (function () {
    console.error('[airline-reviews-ui] airline-reviews-data.js が読み込まれていません');
    return { RATINGS: {}, DEFAULT_R: [3.5, 3.5, 3.5, 3.5, 3.5, 3.5], SEED: {}, GENERIC: [],
             CAT_SHORT: { ja: [], en: [] }, CAT_FULL: { ja: [], en: [] }, REVIEW_CATS: { ja: [], en: [] },
             forLang: function () { return []; } };
  })();
  var RATINGS   = _RD.RATINGS;
  var DEFAULT_R = _RD.DEFAULT_R;
  var CAT_SHORT = _RD.CAT_SHORT[LANG] || _RD.CAT_SHORT.ja;
  var CAT_FULL  = _RD.CAT_FULL[LANG]  || _RD.CAT_FULL.ja;
  var REVIEW_CATS = _RD.REVIEW_CATS[LANG] || _RD.REVIEW_CATS.ja;
  /* ★区分の名前は1つの表 CAT_FULL（評価スコアの6角形の図と同じ名前）から読む（2026-10-25）。同じ口コミのタブの中で、図が
     「企業カルチャー」・下の一覧が「企業文化」と、同じ区分を別の名前で呼ばない。表の並びは REVIEW_CATS と同じ（鍵だけここから借りる）。
     表を読めない時だけ、今までの名前のまま。名前の中の「|」は折れてよい所 ── HTML に置く時は catHTML() で <wbr> にする。 */
  if (CAT_FULL.length === REVIEW_CATS.length && CAT_FULL.every(function (s) { return typeof s === 'string' && !!s; })) {
    REVIEW_CATS = REVIEW_CATS.map(function (c, i) { return { key: c.key, label: CAT_FULL[i] }; });
  }
  function catHTML(s) { return rvEsc(s).split('|').join('<wbr>'); }

  var AIRLINE_CODE = (d.body && d.body.dataset.airline) || '';

  /* 会社リストを 35→110 社に張り替えたとき、投稿フォーム側だけが SSOT スラッグに
     移り、ページ側の data-airline が旧コードのまま残った社がある。旧コードで
     投稿された行を取りこぼすと「投稿したのに自分の口コミが出ない」になるので、
     取得時だけ新旧の両方を見る（pv-reunlock.js:36 の LEGACY_CODES と同じ考え方）。
     ⚠️ db/migrate-airline-codes.sql が本番に流れていない前提で書いてある。 */
  var LEGACY_OF = {
    'cathay-pacific': 'cathay', 'qatar-airways': 'qatar', 'singapore-airlines': 'singapore',
    'spring-japan': 'spring', 'alaska-airlines': 'alaska',
    'british-airways': 'british', 'turkish-airlines': 'turkish',
  };
  function airlineCodes() {
    var legacy = LEGACY_OF[AIRLINE_CODE];
    return legacy ? [AIRLINE_CODE, legacy] : [AIRLINE_CODE];
  }

  /* 表示言語で出せる口コミだけ。en が無いエントリは英語ページに出さない。 */
  function getSeedReviews() {
    var list = _RD.forLang ? _RD.forLang(AIRLINE_CODE, LANG) : (_RD.SEED[AIRLINE_CODE] || _RD.GENERIC);
    /* 主要5社（<body data-pv-glance="1">）に出すのは、出どころの付いた公開の引用だけ。
       出どころの無い見本の口コミと、会社を問わない穴埋め（GENERIC）は出さない
       ── その会社の誰も書いていない文を、その会社の口コミとして並べない。 */
    if (isTabbed()) {
      return _RD.SEED[AIRLINE_CODE] ? list.filter(function (r) { return !!r.src; }) : [];
    }
    return list;
  }

  // ── Supabase（airline-base.js とクライアントを共有する）────────
  var _SB_URL = 'https://vzgmnkrggrwtsrpqndsm.supabase.co';
  var _SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6Z21ua3JnZ3J3dHNycHFuZHNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzkwOTcsImV4cCI6MjA5MDAxNTA5N30.wE4cJbqeYGCgn5ZvHd80hYWgQuySKvOMJMbsJWOvmtw';
  var _sb = null;
  function _initSB() {
    return new Promise(function (resolve) {
      if (_sb) { resolve(_sb); return; }
      if (w.supabase) { _sb = w.supabase.createClient(_SB_URL, _SB_KEY); resolve(_sb); return; }
      var s = d.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload = function () { _sb = w.supabase.createClient(_SB_URL, _SB_KEY); resolve(_sb); };
      s.onerror = function () { resolve(null); }; // SDKロード失敗でもサイトは動く
      d.head.appendChild(s);
    });
  }

  /* airline-base.css が無いページ（EN 110枚）に自力で供給する。
     head 先頭に置くので、ページ自身のインライン CSS が重複セレクタで勝つ。 */
  function ensureCSS() {
    var links = d.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      if ((links[i].getAttribute('href') || '').indexOf('airline-base.css') !== -1) return;
    }
    var me = d.currentScript || (function () {
      var all = d.querySelectorAll('script[src*="airline-reviews-ui.js"]');
      return all[all.length - 1] || null;
    })();
    var base = me ? (me.getAttribute('src') || '').replace(/airline-reviews-ui\.js.*$/, '') : '';
    var lnk = d.createElement('link');
    lnk.rel = 'stylesheet';
    lnk.href = base + 'airline-base.css';
    d.head.insertBefore(lnk, d.head.firstChild);
  }

  // ── 評価スコア ───────────────────────────────────
  function getAirlineRatings() {
    var seed = RATINGS[AIRLINE_CODE] || DEFAULT_R;
    try {
      var all = JSON.parse(localStorage.getItem('pv_reviews') || '[]');
      var mine = all.filter(function (r) { return r.airline === AIRLINE_CODE && Array.isArray(r.cats); });
      if (!mine.length) return { ratings: seed.slice(), count: 0 };
      var blended = seed.map(function (s, i) {
        var sum = mine.reduce(function (a, r) { return a + (r.cats[i] || 0); }, 0);
        return +((s * 3 + sum) / (3 + mine.length)).toFixed(1);
      });
      return { ratings: blended, count: mine.length };
    } catch (e) { return { ratings: seed.slice(), count: 0 }; }
  }

  // ── Radar Chart SVG ──────────────────────────────
  function buildRadar(ratings) {
    var n = ratings.length, cx = 120, cy = 120, R = 88;
    var angles = Array.from({ length: n }, function (_, i) { return -Math.PI / 2 + i * 2 * Math.PI / n; });

    var rings = [0.2, 0.4, 0.6, 0.8, 1.0].map(function (f) {
      var pts = angles.map(function (a) {
        return (cx + R * f * Math.cos(a)).toFixed(1) + ',' + (cy + R * f * Math.sin(a)).toFixed(1);
      }).join(' ');
      return '<polygon points="' + pts + '" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="1"/>';
    }).join('');

    var axes = angles.map(function (a) {
      return '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + R * Math.cos(a)).toFixed(1) +
        '" y2="' + (cy + R * Math.sin(a)).toFixed(1) + '" stroke="rgba(255,255,255,.07)" stroke-width="1"/>';
    }).join('');

    var dpts = ratings.map(function (v, i) {
      var r = (v / 5) * R;
      return (cx + r * Math.cos(angles[i])).toFixed(1) + ',' + (cy + r * Math.sin(angles[i])).toFixed(1);
    }).join(' ');

    var PAD = 26;
    var lbls = CAT_SHORT.map(function (l, i) {
      var lx = cx + (R + PAD) * Math.cos(angles[i]);
      var ly = cy + (R + PAD) * Math.sin(angles[i]);
      var anchor = lx < cx - 4 ? 'end' : lx > cx + 4 ? 'start' : 'middle';
      var score = ratings[i].toFixed(1);
      return '<text x="' + lx.toFixed(1) + '" y="' + (ly - 7).toFixed(1) + '" text-anchor="' + anchor +
        '" dominant-baseline="middle" font-size="12" fill="rgba(255,255,255,.55)" font-family="Inter,Noto Sans JP,sans-serif">' + l + '</text>' +
        '<text x="' + lx.toFixed(1) + '" y="' + (ly + 8).toFixed(1) + '" text-anchor="' + anchor +
        '" dominant-baseline="middle" font-size="11" fill="#f5c842" font-weight="700" font-family="Inter,sans-serif">' + score + '</text>';
    }).join('');

    var dots = ratings.map(function (v, i) {
      var r = (v / 5) * R;
      return '<circle cx="' + (cx + r * Math.cos(angles[i])).toFixed(1) + '" cy="' +
        (cy + r * Math.sin(angles[i])).toFixed(1) + '" r="4" fill="#f5c842"/>';
    }).join('');

    return '<svg class="radar-svg" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" overflow="visible">\n    ' +
      rings + axes + '\n    <polygon points="' + dpts +
      '" fill="rgba(245,200,66,.15)" stroke="#f5c842" stroke-width="1.8" stroke-linejoin="round"/>\n    ' +
      dots + lbls + '\n  </svg>';
  }

  // ── Hero Rating Banner ───────────────────────────
  function airlineName() {
    var h1 = d.querySelector('.hero-airline h1');
    return h1 ? h1.textContent.trim() : (AIRLINE_CODE || '').toUpperCase();
  }

  function injectHeroRatingBanner() {
    var hero = d.querySelector('.hero-airline');
    if (!hero) return;

    var name = airlineName();
    var res = getAirlineRatings(), ratings = res.ratings, count = res.count;
    var avg = ratings.reduce(function (a, b) { return a + b; }, 0) / ratings.length;
    var avgStr = avg.toFixed(1);
    var starsFilled = Math.round(avg);

    var starsHTML = Array.from({ length: 5 }, function (_, i) {
      return '<span class="hrb-star' + (i >= starsFilled ? ' empty' : '') + '">' + (i < starsFilled ? '★' : '☆') + '</span>';
    }).join('');

    var countLabel = count > 0 ? L.respondents(count) : L.sampleData;

    var barsHTML = CAT_FULL.map(function (label, i) {
      return '\n    <div class="hrb-bar-row">\n      <div class="hrb-bar-label">' + catHTML(label) +
        '</div>\n      <div class="hrb-bar-track"><div class="hrb-bar-fill" data-hrb="' +
        (ratings[i] / 5 * 100).toFixed(0) + '"></div></div>\n      <div class="hrb-bar-score">' +
        ratings[i].toFixed(1) + '</div>\n    </div>';
    }).join('');

    var section = d.createElement('div');
    section.id = 'airline-rating-banner';
    section.innerHTML =
      '\n    <div class="max-w-7xl mx-auto px-6">\n' +
      '      <div class="hrb-heading">' + L.hrbHeading(name) + '</div>\n' +
      '      <div class="hrb-inner">\n' +
      '        <div class="hrb-score-block">\n' +
      '          <div class="hrb-label">' + L.hrbLabel + '</div>\n' +
      '          <div class="hrb-score-row">\n' +
      '            <span class="hrb-avg">' + avgStr + '</span>\n' +
      '            <span class="hrb-max">/ 5.0</span>\n' +
      '          </div>\n' +
      '          <div class="hrb-stars">' + starsHTML + '</div>\n' +
      '          <div class="hrb-count">' + countLabel + '</div>\n' +
      '        </div>\n' +
      '        <div class="hrb-radar">' + buildRadar(ratings) + '</div>\n' +
      '        <div class="hrb-bars">' + barsHTML + '</div>\n' +
      '        <div class="hrb-cta">\n' +
      '          <a href="../community.html" class="btn-review-post">\n' +
      '            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>\n' +
      '            ' + L.postReview + '\n' +
      '          </a>\n' +
      '          <div class="hrb-cta-sub">' + L.ctaSub + '</div>\n' +
      '        </div>\n' +
      '      </div>\n' +
      '    </div>';

    hero.insertAdjacentElement('afterend', section);

    setTimeout(function () {
      section.querySelectorAll('[data-hrb]').forEach(function (b) { b.style.width = b.dataset.hrb + '%'; });
    }, 400);

    // 口コミ件数は fetchV2Rows() の1回の取得を使い回す。
    // ここで別途 count クエリを投げると、同じ数を2回問い合わせたうえに
    // 「バナーの人数」と「タブの件数」が別ロジックになって必ずズレる。
  }

  // ── Update rating banner with real Supabase scores ──
  function updateRatingBanner(ratings, count) {
    var banner = d.getElementById('airline-rating-banner');
    if (!banner) return;
    var avg = ratings.reduce(function (a, b) { return a + b; }, 0) / ratings.length;
    var avgEl = banner.querySelector('.hrb-avg');
    if (avgEl) avgEl.textContent = avg.toFixed(1);
    var countEl = banner.querySelector('.hrb-count');
    if (countEl) countEl.textContent = L.respondents(count);
    var starsFilled = Math.round(avg);
    var starsEl = banner.querySelector('.hrb-stars');
    if (starsEl) starsEl.innerHTML = Array.from({ length: 5 }, function (_, i) {
      return '<span class="hrb-star' + (i >= starsFilled ? ' empty' : '') + '">' + (i < starsFilled ? '★' : '☆') + '</span>';
    }).join('');
    // バー更新
    banner.querySelectorAll('.hrb-bar-row').forEach(function (row, i) {
      if (i >= ratings.length) return;
      var fill = row.querySelector('.hrb-bar-fill');
      var score = row.querySelector('.hrb-bar-score');
      if (fill) fill.style.width = (ratings[i] / 5 * 100).toFixed(0) + '%';
      if (score) score.textContent = ratings[i].toFixed(1);
    });
    // レーダーSVG更新
    var n = ratings.length, cx = 120, cy = 120, R = 88;
    var angles = Array.from({ length: n }, function (_, i) { return -Math.PI / 2 + i * 2 * Math.PI / n; });
    var polygon = banner.querySelector('.radar-svg polygon');
    if (polygon) {
      polygon.setAttribute('points', ratings.map(function (v, i) {
        var r = (v / 5) * R;
        return (cx + r * Math.cos(angles[i])).toFixed(1) + ',' + (cy + r * Math.sin(angles[i])).toFixed(1);
      }).join(' '));
    }
    banner.querySelectorAll('.radar-svg circle').forEach(function (dot, i) {
      if (i >= ratings.length) return;
      var r = (ratings[i] / 5) * R;
      dot.setAttribute('cx', (cx + r * Math.cos(angles[i])).toFixed(1));
      dot.setAttribute('cy', (cy + r * Math.sin(angles[i])).toFixed(1));
    });
    // スコア数値テキスト（奇数インデックスがスコア）
    banner.querySelectorAll('.radar-svg text').forEach(function (t, idx) {
      if (idx % 2 === 1) { var i = Math.floor(idx / 2); if (i < ratings.length) t.textContent = ratings[i].toFixed(1); }
    });
  }

  // ── Review Rendering ─────────────────────────────
  function isUnlocked() {
    var e = localStorage.getItem('pv_unlock_expiry');
    return e && Date.now() < parseInt(e, 10);
  }
  function isLoggedIn() {
    try { return !!JSON.parse(localStorage.getItem('pv_user')); } catch (e) { return false; }
  }

  var TRUNCATE = 120;

  /* 未解放時に素で読ませる文字数。オーナー指定「本文の1/8くらい」。
     短い口コミが1文字も読めなくなるのを避けるため下限 30 文字。
     community.html 側のインライン実装と必ず同じ式にすること。 */
  function previewLen(len) { return Math.max(30, Math.ceil(len / 8)); }

  /* 本文の切れ目が金額トークンの内側に落ちないよう後ろへずらす。
     currency.js は本文中の「¥3,500万」も換算対象にするので、そこで割ると
     「¥3,5」と「00万」が別々のノードとして別々に換算され、"over $0" /
     ",$31K" のような存在しない金額が本文に出る。数字は盛らない。
     community.html 側の pvSafeCut と同じ文字クラスにしてある。 */
  var MONEY_CHAR = /[0-9０-９,，.．¥￥万億円MK–〜~-]/;
  function safeCut(text, at) {
    var i = at, guard = 0;
    while (i < text.length && guard++ < 60 &&
           MONEY_CHAR.test(text.charAt(i - 1)) && MONEY_CHAR.test(text.charAt(i))) i++;
    return i;
  }

  function salaryTableHTML(r, maskPay) {
    // 年収情報が一切なければテーブル自体を出さない（カテゴリ口コミ用）
    if (!(r.salaryTotal > 0 || r.monthly > 0 || r.overtime > 0 || r.bonus > 0)) return '';
    // 「万」表記のまま出す。currency.js の MutationObserver が後から包んで
    // 通貨切替に追随させる（[[currency-switchable-price-rule]]）。
    var fmt = function (v) { return v > 0 ? v + '万' : '—'; };
    var S = L.salaryLabels;
    /* 2件目以降は先頭2桁を隠す（オーナー指定）。
       ★年収だけを隠しても「月給 × 12 + 賞与」で復元できてしまうので、
         4セルすべてを同じ規則で隠す（2026-08-08 オーナー判断で範囲を拡大）。
       ★数字を <span> に割ると currency.js:227 の textContent 総書き換えで
         マスクが消える。外側を1枚包むだけにして
         .rv-sal-mask::before の backdrop-filter で覆う。
       値が無いセル（'—'）は包まない。ぼかす中身が無く帯だけ浮いて見えるため。 */
    var cell = function (v) {
      var s = fmt(v);
      return (maskPay && v > 0) ? '<span class="rv-sal-mask">' + s + '</span>' : s;
    };
    return '<div class="rv-salary-table">\n' +
      '    <div class="rv-sal-cell"><div class="rv-sal-label">' + S[0] + '</div><div class="rv-sal-value">' + cell(r.salaryTotal) + '</div></div>\n' +
      '    <div class="rv-sal-cell"><div class="rv-sal-label">' + S[1] + '</div><div class="rv-sal-value">' + cell(r.monthly) + '</div></div>\n' +
      '    <div class="rv-sal-cell"><div class="rv-sal-label">' + S[2] + '</div><div class="rv-sal-value">' + cell(r.overtime) + '</div></div>\n' +
      '    <div class="rv-sal-cell"><div class="rv-sal-label">' + S[3] + '</div><div class="rv-sal-value">' + cell(r.bonus) + '</div></div>\n' +
      '  </div>';
  }

  /* 未解放時のぼかし帯。本文は DOM に残したまま表示層だけで隠す
     （消すと各国SEOのロングテールが飛ぶ）。帯の中央に投稿CTAを重ねる。
     ★2026-10-08 タブのある会社ページでは、1枚ごとのボタンを置かない（cardCta）。 */
  function lockedTailHTML(tailText) {
    if (!tailText) return '';
    return '\n      <div class="rv-locked-tail">\n' +
      '        <div class="rv-locked-tail-text">' + rvEsc(tailText) + '</div>\n' +
      cardCta(
      '        <div class="rv-locked-cta">\n' +
      '          <button type="button" class="rv-locked-btn" onclick="openReviewModal()">\n' +
      '            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>\n' +
      '            ' + L.lockedCta + '\n' +
      '          </button>\n' +
      '        </div>\n') +
      '      </div>';
  }

  /* ★鍵の無い行に出す「最初に書かれた欄の先頭40字」（2026-09-16 オーナー指示）。
     本文と同じ .rv-comment の中に素の文で置く（preview と同じ形＝新しい CSS は要らない）。
     ⚠️ これを body.text へ入れない ── 錠前の面ごと消えて全文扱いになる。 */
  function snipHTML(t) {
    return t ? rvEsc(t) : '';
  }

  /* 本文がサーバから来ていない行の面。ぼかす本文が手元に無いので、
     書かれたカテゴリの名前だけを出す（REAL PAY の「実数は返さないが
     帯と項目名は出す」と同じ形）。カテゴリを出さないと、未解放の人の
     画面でカテゴリ別の件数が全部 0 になる。 */
  function srvLockHTML(catKeys) {
    var names = (catKeys || []).map(function (k) {
      var c = REVIEW_CATS.filter(function (x) { return x.key === k; })[0];
      return c ? c.label : '';
    }).filter(Boolean);
    return '\n      <div class="rv-srv-lock">\n' +
      (names.length ? '        <div class="rv-cat-row">' + names.map(function (n) {
        return '<span class="rv-cat-chip">' + catHTML(n) + '</span>';
      }).join('') + '</div>\n' : '') +
      '        <p class="rv-srv-note">' + L.srvLockNote + '</p>\n' +
      cardCta(
      '        <div>\n' +
      '          <button type="button" class="rv-locked-btn" onclick="openReviewModal()">\n' +
      '            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>\n' +
      '            ' + L.lockedCta + '\n' +
      '          </button>\n' +
      '        </div>\n') +
      '      </div>';
  }

  // 口コミ本文は利用者が書いた文字列。innerHTML / 属性値に入る前に必ずここを通す。
  // review-i18n.js が読まれていればそちらの実装を共有する。
  function rvEsc(s) {
    if (w.PVReviewI18n) return PVReviewI18n.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* 英語ページでは en を、日本語ページでは comment を本文にする。
     どちらか片方しか無いエントリは forLang() が事前に落としている。 */
  function bodyText(r) {
    if (LANG === 'en') return r.en || r.comment || r.payText || '';
    return r.comment || r.payText || '';
  }

  function reviewCardInnerHTML(r, locked, idx) {
    var comment = bodyText(r);
    // 未解放は「本文の 1/8 だけ素・残りはぼかし帯」。解放済みは従来どおり
    // 120文字プレビュー＋「続きを見る」でその場に全文を展開する。
    var cut = safeCut(comment, locked ? previewLen(comment.length) : TRUNCATE);
    var preview = rvEsc(comment.slice(0, cut));
    var tail = comment.slice(cut);
    var hasMore = tail.length > 0;
    var fullLen = comment.length;
    // 評点が取れていない口コミに 3.0 の星を出すと、投稿者が付けていない評価を
    // でっち上げることになる。値が無いときは星の行ごと出さない。
    var hasScore = typeof r.avgRating === 'number' && r.avgRating > 0;
    /* 主要5社：星は会員の投稿が付けた点だけ。公開情報からの引用は点を付けていない。 */
    if (isTabbed() && r.src) hasScore = false;
    var score  = hasScore ? r.avgRating.toFixed(1) : '';
    var filled = hasScore ? Math.round(r.avgRating) : 0;
    var stars  = hasScore ? Array.from({ length: 5 }, function (_, i) {
      return '<span class="' + (i < filled ? 'rv-stars' : 'rv-star-empty') + '">★</span>';
    }).join('') : '';
    // pos:'pilot' は職位不明の意味なので、頭の「パイロット」と重ねて出さない
    /* 職位・入社の区分・在籍年数は、投稿した人が書いた文字列がそのまま届く。決まった鍵（L.POS / L.JOIN）に
       無い値は、本文と同じく rvEsc を通してから置く（通さないと、書かれたタグがそのまま働く）。 */
    var own   = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k) ? o[k] : ''; };
    var pos   = r.pos === 'pilot' ? '' : (own(L.POS, r.pos) || rvEsc(r.pos) || '—');
    var join  = own(L.JOIN, r.join) || rvEsc(r.join) || '';
    var years = rvEsc(r.years || '');
    var uid   = 'rv_' + Math.random().toString(36).slice(2);
    var catLabel = (REVIEW_CATS.filter(function (c) { return c.key === r.cat; })[0] || { label: L.catFallback }).label;
    return '<div class="detail-review-card">\n' +
      '    <div class="rv-card-head">\n' +
      '      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">\n' +
      '        <span class="rv-card-type">' + catHTML(catLabel) + '</span>\n' +
      '        <span class="rv-reviewer-meta">' + L.pilot +
             (pos ? '<span class="rv-meta-sep"> | </span>' + pos : '') +
             (years ? '<span class="rv-meta-sep"> | </span>' + L.tenure(years) : '') +
             (join ? '<span class="rv-meta-sep"> | </span>' + L.joined(join) : '') + '</span>\n' +
      '      </div>\n' +
      '      <span class="rv-date">' + L.postedOn + (r.date || '') + '</span>\n' +
      '    </div>\n' +
      '    <div class="rv-card-body">\n' +
      '      ' + (hasScore ? '<div class="rv-stars-row">\n' +
      '        <span style="font-size:.95rem;letter-spacing:.04em">' + stars + '</span>\n' +
      '        <span class="rv-score">' + score + '</span>\n' +
      '      </div>' : '') + '\n' +
      '      ' + salaryTableHTML(r, locked && idx >= 1) + '\n' +
      '      <div class="rv-comment" id="' + uid + '_text">' +
             (r.serverLocked ? (snipHTML(r.clipText) + srvLockHTML(r.catKeys))
                             : preview + (hasMore && !locked ? '…' : '') +
                               (locked ? lockedTailHTML(tail) : '')) + '</div>\n' +
      // 未解放で原文トグルを出すと、翻訳元の全文がその場で読めてしまいゲートが素通しになる。
      // 「自動翻訳」バッジだけ残し、トグルは解放済みのときにだけ出す。
      '      ' + (r.translated && !r.serverLocked ? PVReviewI18n.noteHTML(r.from) + (locked ? '' : PVReviewI18n.origHTML(r.origText)) : '') + '\n' +
      '      ' + (hasMore && !locked && !r.serverLocked ? '<button class="rv-read-more" id="' + uid + '_btn" data-full="' + rvEsc(comment) +
             '" onclick="pvReadMore(\'' + uid + '\',this.dataset.full)">' + L.readMore(fullLen) + '</button>' : '') + '\n' +
      '      ' + (r.src ? '<div class="rv-src">' + L.source + ': ' + (r.url
             ? '<a href="' + rvEsc(r.url) + '" target="_blank" rel="nofollow noopener">' + rvEsc(r.src) + '</a>'
             : rvEsc(r.src)) + '</div>' : '') + '\n' +
      '    </div>\n' +
      '  </div>';
  }

  /* カードを丸ごとぼかす旧実装は廃止した。カード全体を隠すと本文が一切読めず、
     何が待っているのか分からないまま投稿を求めることになる（＝投稿されない）。
     いまは本文の先頭1/8だけ素で読ませ、残りをカード内のぼかし帯にする。 */
  function reviewCardHTML(r, locked, idx) {
    var src = !locked && !!r && !!r.id && pvReviewMarks[r.id] === 1;
    return '<div class="rv-card-wrap' + (src ? ' rv-sum-src' : '') + '">' +
      (src ? '<span class="rv-sum-tag">' + L.sumSrcTag + '</span>' : '') +
      reviewCardInnerHTML(r, locked, idx) + '</div>';
  }

  // ── Review Category Filter ───────────────────────
  var pvReviewCatFilter = 'all';
  var pvReviewMarks = {};      // 要約の点から来たときだけ：もとの口コミの id → 1（分類を選び直すと空に戻る）
  var RV_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  w.pvSetReviewCat = function (cat, ids) {
    pvReviewCatFilter = cat;
    pvReviewMarks = {};
    (Array.isArray(ids) ? ids : []).forEach(function (s) { if (typeof s === 'string' && RV_UUID.test(s)) pvReviewMarks[s] = 1; });
    switchTab('reviews');
    if (!isTabbed()) renderReviews();
    else paint();
    setTimeout(function () {
      var el = d.getElementById('airline-review-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  /* カード内の onclick から呼ばれるので window に出す。
     「続きを見る」ボタンは解放済みのときしか描かなくなったので、通常は下の
     isUnlocked() を必ず通る。残した else 側は「ページを開いたままログアウト等で解放が
     消えた」ときの保険（描画済みのボタンから全文が漏れないようにする）。 */
  w.pvReadMore = function pvReadMore(uid, fullText) {
    if (isUnlocked()) {
      var el = d.getElementById(uid + '_text');
      var btn = d.getElementById(uid + '_btn');
      if (el) el.textContent = fullText;
      if (btn) btn.style.display = 'none';
      return;
    }
    showReadMoreGate();
  };

  function showReadMoreGate() {
    var existing = d.getElementById('pv-readmore-gate');
    if (existing) { existing.style.display = 'flex'; rmgIn(existing); return; }
    var modal = d.createElement('div');
    modal.id = 'pv-readmore-gate';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);backdrop-filter:blur(4px)';
    if (ggShape()) {
      modal.className = 'pvg-rmg';
      d.addEventListener('keydown', function (e) {
        if (modal.style.display === 'none') return;
        if (e.key === 'Escape') { modal.style.display = 'none'; rmgOut(); return; }
        /* 小窓が開いているあいだ、Tab は小窓の中だけを回る（幕のうしろのリンクへ出ていかない） */
        if (e.key !== 'Tab') return;
        var f = modal.querySelectorAll('a[href], button:not([disabled])');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1], a = d.activeElement;
        if (!modal.contains(a)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
      });
      /* ✕ と、うしろの幕。閉じるのは今までの仕掛けのまま（ここは、閉じたあと開いた所へ戻すだけ） */
      modal.addEventListener('click', function (e) { if (e.target === modal || (e.target.closest && e.target.closest('.pvg-rmg-x'))) rmgOut(); });
    }
    /* ★2026-10-09 タブの無い会社ページと英語版：板は今までのまま、入口だけ「Give & Get」の黒い丸いボタンに替える。
       この板はページの明暗に関わらず暗い色なので、板に data-theme="dark" を付けて、ボタンを暗い面の色（白い地）で出す
       （付けないと、明るいページでは黒い板に黒いボタンになる）。pv-gg.css を読めなかった時は、今までの橙のボタン。 */
    var rmNew = !ggShape() && ggOld() === 'yes';
    modal.innerHTML = ggShape() ? readMoreGateTabbed() :
      '\n    <div' + (rmNew ? ' data-theme="dark"' : '') + ' style="background:#111620;border:1px solid rgba(245,200,66,.2);border-radius:18px;padding:36px 32px;max-width:380px;width:90%;text-align:center;position:relative">\n' +
      '      <button onclick="document.getElementById(\'pv-readmore-gate\').style.display=\'none\'" style="position:absolute;top:12px;right:14px;background:none;border:none;color:#6b7d93;cursor:pointer;font-size:1.1rem;line-height:1">✕</button>\n' +
      '      <div style="font-size:2.2rem;margin-bottom:12px">🔒</div>\n' +
      '      <div style="font-weight:700;font-size:1rem;margin-bottom:8px;color:#e8edf2">' + L.rmTitle + '</div>\n' +
      '      <p style="font-size:.82rem;color:#6b7d93;line-height:1.65;margin-bottom:22px">' + L.rmDesc + '</p>\n' +
      '      <div style="display:flex;flex-direction:column;' + (rmNew ? 'align-items:center;' : '') + 'gap:10px">\n' +
      (rmNew ? '        ' + ggBtn('all') + '\n' :
      '        <button class="btn-review-post" style="width:100%;justify-content:center" onclick="openReviewModal()">\n' +
      '          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>\n' +
      '          ' + L.rmBtn + '\n' +
      '        </button>\n') +
      '        ' + (!isLoggedIn() ? '<a href="../login.html" style="color:#6b7d93;font-size:.78rem;text-decoration:underline;text-underline-offset:2px">' + L.rmLogin + '</a>' : '') + '\n' +
      '      </div>\n' +
      '      <div style="font-size:.71rem;color:#6b7d93;margin-top:10px">' + L.rmFine + '</div>\n' +
      '    </div>';
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.style.display = 'none'; });
    if (!ggShape()) rmgKeepInk(modal);
    d.body.appendChild(modal);
    rmgIn(modal);
  }
  /* ★2026-10-09 タブの無い会社ページの小窓は、ページの明暗に関わらず暗い板。
     ところが明るいページでは airline-base.css が「style に書いた明るい字の色」を暗い色へ読み替えるので、
     見出しが暗い板の上の暗い字になって読めなかった（日本語ページは明るいのが既定）。
     ここで書いた色を、そのままの色で固定する（色も文言も足さない・変えない）。 */
  function rmgKeepInk(m) {
    var els = m.querySelectorAll('[style*="color:"]');
    for (var i = 0; i < els.length; i++) {
      var c = els[i].style.color;
      if (c) els[i].style.setProperty('color', c, 'important');
    }
  }
  /* タブのある会社ページの小窓：開いたら中のボタンへ移り、閉じたら開いた所へ戻る
     （キーボードや読み上げで使う人が、幕のうしろのページに取り残されない）。ほかの会社と英語版では何もしない。 */
  var rmgFrom = null;
  function rmgIn(m) {
    if (!ggShape()) return;
    rmgFrom = d.activeElement;
    var b = m.querySelector('.pv-gg');
    if (b && b.focus) b.focus();
  }
  function rmgOut() {
    var f = rmgFrom; rmgFrom = null;
    if (f && f !== d.body && f.focus && d.contains(f)) f.focus();
  }
  /* ★2026-10-09 タブのある会社ページの小窓（ページを開いたまま解放の期限が切れたあとに「続きを読む」を押したとき）。
     入口は、ほかの置き場と同じ黒い丸いボタン（pv-gg.css）。ここだけ古い橙のボタンのままだった。
     箱の見た目は pv-glance.css の「.pvg-rmg」（色はページの明暗に合わせる）。
     文言・押した先（投稿の画面）・開く条件は今までと同じ。ほかの会社と英語版は、上の今までの形を1文字も変えない。
     ⚠️ うしろの幕の色だけは上の style に置いたまま（pv-glance.css には色の直書きを置かない決まり）。 */
  function readMoreGateTabbed() {
    var login = '../login.html?return=' + encodeURIComponent(location.pathname + location.search + (isTabbed() ? '#reviews' : ''));
    return '<div class="pvg-rmg-box" role="dialog" aria-modal="true" aria-labelledby="pvg-rmg-t">' +
      '<button type="button" class="pvg-rmg-x" aria-label="' + (LANG === 'en' ? 'Close' : '閉じる') + '" onclick="document.getElementById(\'pv-readmore-gate\').style.display=\'none\'">✕</button>' +
      '<div class="pvg-rmg-ic" aria-hidden="true">🔒</div>' +
      '<p class="pvg-rmg-t" id="pvg-rmg-t">' + L.rmTitle.replace('には', function () { return 'には<wbr>'; }) + '</p>' +
      '<p class="pvg-rmg-d">' + L.rmDesc.replace(/ style="[^"]*"/g, function () { return ''; }) + '</p>' +
      unlockBtn('') +
      (!isLoggedIn() ? '<a class="pvg-rmg-login" href="' + login + '">' + L.rmLogin + '</a>' : '') +
      '<p class="pvg-rmg-fine">' + L.rmFine + '</p>' +
    '</div>';
  }

  // ── 口コミ投稿は専用フォーム(submit-review.html / reviews_v2)に一本化 ──
  w.openReviewModal = function () {
    location.href = '../submit-review.html?airline=' + encodeURIComponent(AIRLINE_CODE || '');
  };

  // ── 海外パイロットの評判（公開情報）を通常口コミと同じ小カードで表示 ──
  /* 海外評判の JSON を用意してある会社の一覧。
     ここを見ずに取りに行くと、用意の無い約51社（日英で112ページ）で毎回 404 が返る。
     壊れはしないが往復が1回むだになり、Cloudflare が「無い」を4時間覚えるので
     後から JSON を足しても最大4時間は画面に出てこない。
     ★手で編集しない。node gen-overseas-rep-list.mjs が overseas-rep/*.json から書き出す。
       JSON を足したら必ず流す（食い違いは assert-links.mjs が知らせる）。 */
  /* PV_OVERSEAS_LIST:BEGIN */
  var PV_OVERSEAS = [
    'aegean', 'aer-lingus', 'aeromexico', 'air-canada', 'air-china', 'air-france', 'air-india', 'air-new-zealand',
    'alaska-airlines', 'allegiant', 'american', 'austrian', 'avianca', 'breeze-airways', 'british-airways', 'cathay-pacific',
    'china-eastern', 'china-southern', 'copa-airlines', 'delta', 'easyjet', 'emirates', 'etihad', 'eva-air',
    'finnair', 'frontier', 'garuda-indonesia', 'gulf-air', 'iberia', 'icelandair', 'indigo', 'ita-airways',
    'jetblue', 'klm', 'korean-air', 'latam', 'lot', 'lufthansa', 'malaysia-airlines', 'norwegian',
    'oman-air', 'porter', 'qantas', 'qatar-airways', 'riyadh-air', 'ryanair', 'sas', 'saudia',
    'singapore-airlines', 'southwest', 'spirit', 'starlux', 'swiss', 'tap', 'thai-airways', 'turkish-airlines',
    'united', 'virgin-atlantic', 'vueling', 'westjet', 'wizz-air'
  ];
  /* PV_OVERSEAS_LIST:END */
  var pvOverseasRec = null, pvOverseasFetched = false;
  function pvLoadOverseas() {
    if (pvOverseasFetched) return;
    pvOverseasFetched = true;
    if (PV_OVERSEAS.indexOf(AIRLINE_CODE || '') < 0) return;   // 用意が無い会社は取りに行かない
    fetch('/overseas-rep/' + (AIRLINE_CODE || '') + '.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        pvOverseasRec = j;
        // 海外評判もオーナー決定で件数に含めるので、届いた時点で数え直す。
        refreshCounts();
        if (activeTab === 'reviews') paint();
      })
      .catch(function () {});
  }
  /* 海外評判も公開情報とはいえ「読める分量」としては投稿口コミと等価なので、
     オーナー判断で同じ 1/8 ルールを適用する。出典リンクは必ず残す（引用の要件）。 */
  function pvOverseasCardsHTML(locked) {
    if (!pvOverseasRec || !pvOverseasRec.cats) return '';
    var IS_EN = LANG === 'en';
    var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    var keys = pvReviewCatFilter === 'all' ? REVIEW_CATS.map(function (c) { return c.key; }) : [pvReviewCatFilter];
    var srcLinks = (pvOverseasRec.sources || []).slice(0, 3)
      .map(function (s) {
        return '<a href="' + esc(s.url) + '" target="_blank" rel="nofollow noopener" style="color:#5fb0ff;text-decoration:none">' +
          esc(s.title || s.url) + '</a>';
      })
      .join(IS_EN ? ' · ' : '　・　');                   // 英語のページは半角の区切り（全角の「　・　」を出さない）
    var meta = IS_EN ? '🌐 Overseas pilots · from public sources' : '🌐 海外パイロットの声・公開情報より';
    var srcLabel = IS_EN ? 'Sources' : '出典';
    return keys.map(function (k) {
      var c = pvOverseasRec.cats[k]; var t = c && (IS_EN ? c.en : c.ja);
      if (!t) return '';
      var label = (REVIEW_CATS.filter(function (x) { return x.key === k; })[0] || { label: L.catFallback }).label;
      var cut = locked ? safeCut(t, previewLen(t.length)) : t.length;
      var body = esc(t.slice(0, cut)) + (locked ? lockedTailHTML(t.slice(cut)) : '');
      return '<div class="rv-card-wrap"><div class="detail-review-card">\n' +
        '      <div class="rv-card-head">\n' +
        '        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">\n' +
        '          <span class="rv-card-type">' + catHTML(label) + '</span>\n' +
        '          <span class="rv-reviewer-meta">' + meta + '</span>\n' +
        '        </div>\n' +
        '      </div>\n' +
        '      <div class="rv-card-body">\n' +
        '        <div class="rv-comment">' + body + '</div>\n' +
        '        ' + (srcLinks ? '<div class="rv-src">' + srcLabel + ': ' + srcLinks + '</div>' : '') + '\n' +
        '      </div>\n' +
        '    </div></div>';
    }).join('');
  }

  var V2_CAT_KEYS = ['culture_score', 'salary_score', 'benefits_score', 'wlb_score', 'ops_score', 'training_score'];

  function mapV2(r) {
    var scores = V2_CAT_KEYS.map(function (k) { return r[k]; }).filter(function (s) { return s > 0; });
    /* 点数の無い投稿を 3.0 にしない（主要5社）。ほかのページは今までどおり。 */
    var avgRating = scores.length ? +(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length).toFixed(1)
      : (isTabbed() ? 0 : 3);
    // 投稿口コミは Webhook→Edge Function で各言語へ翻訳済み。訳が無い欄は原文に落ちる。
    var body = w.PVReviewI18n ? PVReviewI18n.pick(r) : { text: '', cats: [], translated: false, origText: '', from: 'ja' };
    var mainCat = (body.cats[0] || {}).k || '';
    return {
      id: (typeof r.id === 'string' && RV_UUID.test(r.id)) ? r.id : '',
      pos: r.position, years: r.tenure_bucket || '—', join: '',
      avgRating: avgRating,
      comment: body.text, en: body.text,
      translated: body.translated, origText: body.origText, from: body.from,
      // 本文がサーバから来ていない行（鍵を持っていない）。ぼかす本文が手元に無い。
      serverLocked: !!body.locked,
      /* ★鍵の無い行に付く「最初に書かれた欄の先頭40字」（2026-09-16 オーナー指示）。
           本文（comment）とは別の入れ物のまま運ぶ ── 混ぜると錠前の面ごと消える。 */
      clipText: body.clipText || '',
      // 総額の優先順位：総額(annual_salary) ＞ 成分合算(基本給+乗務手当+賞与) ＞ 月給×12+賞与
      // ※1件の自己申告を本人の成分から合算するのは可（円のブレンド禁止は複数人平均への制約）
      salaryTotal: r.annual_salary ? r.annual_salary
        : (r.base_annual || r.flight_allowance_annual)
          ? (r.base_annual || 0) + (r.flight_allowance_annual || 0) + (r.bonus || 0)
          : (r.monthly_salary ? r.monthly_salary * 12 + (r.bonus || 0) : 0),
      monthly: r.monthly_salary || ((r.base_annual || r.flight_allowance_annual)
        ? Math.round(((r.base_annual || 0) + (r.flight_allowance_annual || 0)) / 12) : 0),
      overtime: 0, bonus: r.bonus || 0,
      fleet: r.fleet || '', role: r.job_role || '',
      // reviews_v2 はカテゴリを縦持ちでなく *_comment の横持ち7列で保つので、
      // 1件が複数カテゴリに属しうる。cat は代表1つ（見出しバッジ用）、
      // catKeys は絞り込みと件数集計に使う全カテゴリ。
      cat: mainCat,
      catKeys: body.cats.map(function (c) { return c.k; }),
      date: r.created_at ? new Date(r.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit' }).replace('/', '.').slice(0, 7) : '',
    };
  }

  /* ── 表示リストと件数を1本化する ────────────────────────────
     「タブは3件なのに集約ゲートは残り6件」というズレは、数える対象（シード配列の
     length）と描くリスト（Supabase＋シード＋海外評判）が別物だったのが原因。
     以後、描画も件数も currentReviewList() / overseasCatKeys() だけを見る。 */
  function localReviewsMapped() {
    try {
      return JSON.parse(localStorage.getItem('pv_reviews') || '[]')
        .filter(function (r) { return r.airline === AIRLINE_CODE; })
        .map(function (r) {
          var t = r.payText || r.comment || '';
          return {
            pos: r.position, years: r.years || r.experience || '—', join: r.join || '',
            avgRating: r.avgRating || r.rating || (isTabbed() ? 0 : 3),
            comment: t, en: t,
            salaryTotal: r.salary || 0, monthly: r.monthly || 0, overtime: r.overtime || 0, bonus: r.bonus || 0,
            cat: r.cat || '',
            date: new Date(r.ts).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit' }).replace('/', '.').slice(0, 7),
          };
        });
    } catch (e) { return []; }
  }

  var _v2Rows = null;     // Supabase から取れた行。null = まだ取得していない
  var _v2Promise = null;

  function currentReviewList() {
    // Supabase が返ってきたらそちらが正。返るまでは localStorage の自分の投稿で埋める。
    return (_v2Rows ? _v2Rows.map(mapV2) : localReviewsMapped()).concat(getSeedReviews());
  }

  /* reviews_v2 はカテゴリを *_comment の横持ち7列で持つので1件が複数カテゴリに属しうる。
     絞り込みと件数集計で必ず同じ判定を使う（片方だけ変えると「3件と書いてあるのに
     チップを押すと1件しか出ない」が起きる）。 */
  function reviewCatKeys(r) {
    if (r.catKeys && r.catKeys.length) return r.catKeys;
    return r.cat ? [r.cat] : [];
  }
  function inCat(r, key) { return reviewCatKeys(r).indexOf(key) !== -1; }

  /* 海外評判のうち、この言語で実際に本文が出るカテゴリだけ。件数はこれで数える。 */
  function overseasCatKeys() {
    if (!pvOverseasRec || !pvOverseasRec.cats) return [];
    return REVIEW_CATS.map(function (c) { return c.key; }).filter(function (k) {
      var c = pvOverseasRec.cats[k];
      return !!(c && (LANG === 'en' ? c.en : c.ja));
    });
  }
  function overseasShownKeys() {
    var keys = overseasCatKeys();
    return pvReviewCatFilter === 'all'
      ? keys : keys.filter(function (k) { return k === pvReviewCatFilter; });
  }

  function fetchV2Rows() {
    if (_v2Promise) return _v2Promise;
    _v2Promise = _initSB().then(function (sb) {
      if (!sb) return [];
      /* ★ reviews_v2 を直接読まない。本文の列は DB 側で anon / authenticated から
         外してあり（db/reviews-gate.sql）、鍵を持つ人にだけ本文を返すのは
         pv_reviews() の仕事。画面は「ぼかす側」ではなく「受け取らない側」になる。
         ⚠️ 旧実装の select('*') はもう通らない（テーブル全体の権限が無い）。 */
      return PVReviewI18n.fetchRows(sb, { airlines: airlineCodes(), limit: 500 })
        .then(function (res) {
          if (!res) return [];
          /* サーバが「鍵を持っている」と言ったら端末の写しを合わせる（写しは鍵ではない）。
             ★保険も遠い未来にする ── pv-session.js より先に走った回に短い期限を
               書くと、その端末だけ黙って締め出される（assert-unlock.mjs ②）。 */
          if (res.unlocked && !isUnlocked()) {
            var until = (w.PVUnlock && w.PVUnlock.reviewUntil)
              ? w.PVUnlock.reviewUntil() : Date.now() + 100 * 365 * 24 * 60 * 60 * 1000;
            try { localStorage.setItem('pv_unlock_expiry', String(until)); } catch (e) {}
          }
          return res.rows;
        });
    }).catch(function () { return []; })
      .then(function (rows) {
        _v2Rows = rows;
        refreshCounts();
        applyV2Ratings(rows);
        if (activeTab === 'reviews') paint();
        return rows;
      });
    return _v2Promise;
  }

  /* 6分類の点数の出し方はここ1か所。評点の付いた投稿が1つも無ければ null。
     ⚠️ 主要5社のページ（career-live.js の評価スコアの欄）も ratingsFor() 経由でこれを呼ぶ。
        式を写さない ── 写すと、同じ会社の点数がページによって違う値になる。 */
  function v2Blend(rows) {
    var newRatings = V2_CAT_KEYS.map(function (k) {
      var vals = rows.map(function (r) { return r[k]; }).filter(function (v) { return v > 0; });
      return vals.length ? +(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length).toFixed(1) : null;
    });
    if (!newRatings.some(function (v) { return v !== null; })) return null;
    var seed = RATINGS[AIRLINE_CODE] || DEFAULT_R;
    var n = rows.length;
    return seed.map(function (s, i) {
      return newRatings[i] !== null ? +((s * 2 + newRatings[i] * n) / (2 + n)).toFixed(1) : s;
    });
  }

  function applyV2Ratings(rows) {
    if (!rows.length) return;
    var blended = v2Blend(rows);
    if (blended) {
      updateRatingBanner(blended, rows.length);
    } else {
      // 評点が無い投稿しかなくても「何名が回答したか」は事実なので出す
      var el = d.querySelector('#airline-rating-banner .hrb-count');
      if (el) el.textContent = L.respondents(rows.length);
    }
  }

  /* 取ってきた投稿の束から、画面に出す点数と人数を作る（バナーと同じ答え）。
     count が 0 のときは「サンプルデータ」と出す側。 */
  function ratingsFor(rows) {
    var base = getAirlineRatings();
    if (!rows || !rows.length) return base;
    return { ratings: v2Blend(rows) || base.ratings, count: rows.length };
  }

  function paint() {
    var section = d.getElementById('airline-review-section');
    if (!section) return;
    var locked = !isUnlocked();
    var revList = currentReviewList();
    var filtered = pvReviewCatFilter !== 'all'
      ? revList.filter(function (r) { return inCat(r, pvReviewCatFilter); })
      : revList;
    // 未解放でも全件カードを出す。隠すのは本文の 7/8 と、2件目以降の年収の先頭2文字だけ。
    // 1件しか見せない旧仕様だと、何が待っているのか分からないまま投稿を求めることになる。
    var cardsHTML = filtered.map(function (r, i) { return reviewCardHTML(r, locked, i); }).join('');
    // 海外パイロットの評判（公開情報）も同じ小カード。オーナー判断で 1/8 ルールの対象。
    var overseasHTML = pvOverseasCardsHTML(locked);
    var chipsHTML = [{ key: 'all', label: L.all }].concat(REVIEW_CATS).map(function (c) {
      return '<button class="rcf-chip' + (pvReviewCatFilter === c.key ? ' active' : '') +
        '" onclick="pvSetReviewCat(\'' + c.key + '\')">' + catHTML(c.label) + '</button>';
    }).join('');
    var shown = filtered.length + overseasShownKeys().length;
    var emptyMsg = shown === 0
      ? '<div style="text-align:center;padding:32px 0;color:#6b7d93;font-size:.85rem">' + L.empty + '</div>' : '';
    var loginHref = '../login.html?return=' + encodeURIComponent(location.pathname + location.search + (isTabbed() ? '#reviews' : ''));
    /* ★2026-10-09 手元の鍵の控え（pv_unlock_expiry）が生きていても、サーバが本文を伏せて返した口コミが在れば、下の入口を出す。
       控えは下げる向きには直らない（別の会員でログインした・自分の口コミが消えた・ログインが切れた）。
       カード1枚ごとのボタンを外したので、ここを出さないと、伏せたカードが並ぶのに一覧の中の入口が見出しの投稿ボタンだけになる。 */
    var srvLk = filtered.some(function (r) { return r.serverLocked; });
    var postGate = ((locked || srvLk) && shown > 0) ?
      '\n      <div class="rv-post-gate">\n' +
      '        <div class="rv-gate-lock">🔒</div>\n' +
      '        <div class="rv-gate-title">' + L.gateTitle + '</div>\n' +
      '        <div class="rv-gate-remain">' + L.gateAll(shown) + '</div>\n' +
      '        <p class="rv-gate-desc">' + L.gateDesc + '</p>\n' +
      '        ' + unlockBtn('<button class="btn-review-post" onclick="openReviewModal()">' + L.gateBtn + '</button>') + '\n' +
      '        <a href="' + loginHref + '" class="rv-gate-login">' + L.gateLogin + '</a>\n' +
      '        <div style="font-size:.72rem;color:#6b7d93;margin-top:10px">' + L.gateFine + '</div>\n' +
      '      </div>' : '';
    if (isTabbed()) {
      /* 主要5社：見出しと投稿ボタンはページ側に在る。ここは絞り込みと一覧だけ。
         会員の投稿を先に、公開情報からの引用を後ろに置く。 */
      section.innerHTML =
        '<div class="rcf-chips">' + chipsHTML + '</div>' +
        cardsHTML + overseasHTML + emptyMsg + postGate;
      paintGlanceCount();
    } else {
    section.innerHTML =
      '\n      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">\n' +
      '        <h2 style="font-size:1.2rem;font-weight:700">' + L.reviewsHeading + '</h2>\n' +
      '        <button class="btn-review-post" style="font-size:.8rem;padding:8px 18px" onclick="openReviewModal()">' + L.postReviewShort + '</button>\n' +
      '      </div>\n' +
      '      <div class="rcf-chips">' + chipsHTML + '</div>\n' +
      '      ' + overseasHTML + cardsHTML + emptyMsg + '\n' +
      '      ' + postGate;
    }

    // currency.js は init の scan と observer 起動の間に入った描画を取りこぼすことがある。
    // 描画のたびに包み直して通貨切替に確実に追随させる。
    if (w.PVCurrency) { try { PVCurrency.scan(section); PVCurrency.apply(); } catch (e2) {} }
  }

  function renderReviews() {
    if (!d.getElementById('airline-review-section')) return;
    pvLoadOverseas();
    paint();          // シード（＋localStorage）で即時表示
    fetchV2Rows();    // 取得済みなら何も起きない。返ったら paint() し直す
  }

  // ── Tab System ───────────────────────────────────
  var activeTab = 'overview';

  function assignTabSections() {
    d.querySelectorAll('.glass').forEach(function (el) {
      var badge = el.querySelector('.section-badge');
      if (!badge) return;
      var txt = badge.textContent;
      var sec;
      if (L.secSalary.test(txt))       sec = 'salary';
      else if (L.secJobs.test(txt))    sec = 'jobs';
      else                             sec = 'overview';
      el.dataset.tabSection = sec;
      // premium-gate ラッパー（GIVE/TAKEゲート）も同じタブに連動させ、
      // タブ切替時にラッパーごと隠す（他タブへのオーバーレイはみ出し防止）
      var gate = el.closest('.premium-gate');
      if (gate) gate.dataset.tabSection = sec;
    });
  }

  /* 主要5社：投稿の件数と引用の件数を、ページ側の置き場（[data-pvg-n]）へ別々に書く。
     取れるまでは「—」のまま（0 と書かない）。 */
  function paintGlanceCount() {
    var posts = _v2Rows ? _v2Rows.length : null;
    var quotes = getSeedReviews().length + overseasCatKeys().length;
    d.querySelectorAll('[data-pvg-n="posts"]').forEach(function (el) {
      el.textContent = posts === null ? '—' : String(posts);
    });
    d.querySelectorAll('[data-pvg-n="quotes"]').forEach(function (el) {
      el.textContent = String(quotes);
      var box = el.closest('[data-pvg-quotes]');
      if (box) box.hidden = quotes === 0;
    });
  }

  function switchTab(tab) {
    if (isTabbed()) {
      /* タブはページ側（pv-glance.js）が持つ。古い名前で呼ばれても行き先を合わせる。 */
      var to = { overview: '', reviews: 'reviews', salary: 'pay', jobs: '' }[tab];
      if (w.PVGlance && typeof w.PVGlance.go === 'function') w.PVGlance.go(to == null ? tab : to);
      return;
    }
    activeTab = tab;
    d.querySelectorAll('.airline-tab-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    d.querySelectorAll('[data-tab-section]').forEach(function (el) {
      el.style.display = el.dataset.tabSection === tab ? '' : 'none';
    });
    var rs = d.getElementById('airline-review-section');
    if (rs) {
      rs.style.display = tab === 'reviews' ? 'block' : 'none';
      if (tab === 'reviews') renderReviews();
    }
  }

  /* ── 件数 ────────────────────────────────────────
     オーナー定義は「画面に出ている総数（投稿＋公開情報）」。
     旧実装はシード配列の length しか見ておらず Supabase を無視していたので、
     ANA が実際は7件あるのにタブも見出しも「3件」のままだった。
     数える源は paint() が描く源と完全に同じにする。 */
  function reviewCount() {
    return currentReviewList().length + overseasCatKeys().length;
  }

  function categoryCounts() {
    var counts = {};
    REVIEW_CATS.forEach(function (c) { counts[c.key] = 0; });
    currentReviewList().forEach(function (r) {
      // 1件が複数カテゴリに寄与しうる（reviews_v2 の横持ち7列）。
      // mgmt は6枚のカードに無いので counts に無く、ここで自然に落ちる。
      reviewCatKeys(r).forEach(function (k) {
        if (counts[k] !== undefined) counts[k]++;
      });
    });
    overseasCatKeys().forEach(function (k) { if (counts[k] !== undefined) counts[k]++; });
    return counts;
  }

  /* Supabase / 海外評判は非同期で後から届く。届いた時点で
     タブ badge・見出し・カテゴリ6枚を塗り直す（初回1回きりだと古い数が残る）。 */
  function refreshCounts() {
    if (isTabbed()) paintGlanceCount();
    var cnt = reviewCount();
    var badge = d.querySelector('#airline-tab-nav .atab-count');
    if (badge) badge.textContent = cnt;

    var heading = d.querySelector('#airline-review-cats .rcg-heading');
    if (heading) {
      // 社名の <span class="rcg-airline"> を退避してから本文を差し替える
      // （textContent 代入だと社名ごと消える）。
      var air = heading.querySelector('.rcg-airline');
      heading.textContent = L.rcgHeading(cnt);
      if (air) heading.appendChild(air);
    }

    var counts = categoryCounts();
    var cells = d.querySelectorAll('#airline-review-cats .rcg-count');
    REVIEW_CATS.forEach(function (c, i) {
      if (cells[i]) cells[i].textContent = L.catCount(counts[c.key] || 0);
    });
  }

  // ── Review Category Grid ─────────────────────────
  var CAT_ICONS = {
    salary: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    benefits: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    wlb: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    culture: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    ops: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',
    training: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  };
  var CHEVRON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

  function isGlance() { return !!d.body && d.body.getAttribute('data-pv-glance') === '1'; }
  /* タブのある会社ページ（タブの帯 #pvg-tabs は gen-airline-glance.mjs が書く）。
     口コミの新しい載せ方は、タブのあるページだけ。タブの無い主要4社は今までどおりに動かす。 */
  function isTabbed() { return isGlance() && !!d.getElementById('pvg-tabs'); }
  /* ★2026-10-07 オーナーのご指示：タブのある会社ページの口コミでは、解放の入口の字を2行にする
       「Give & Get」／「全ての口コミデータを解放する」
     変えるのは字だけ ── 行き先（投稿フォーム）も、開く条件も、今までと同じ。
     ★2026-10-08 形はサイト共通の pv-gg.css（トップのいちばん上の黒いボタンと同じ）。
       給与の1枚・評価スコアの1枚の入口と、1つも違わない。ここで大きさや色を足さない。
     ★2026-10-09 オーナー判断「拡げる」：同じ形を、タブの無い会社ページと英語版にも出す（下の ggOld）。
       言葉は置き場で決まる ── 一覧の錠前と「続きを読む」の小窓は all・概要の「生の声」の下は top。 */
  /* ★2026-10-25 タブのある英語の会社ページも同じ形（英語の会社ページにタブが付いたので）。1枚ごとの錠前を並べない・入口は一覧の下と評価スコアの1枚 */
  function ggShape() { return isTabbed(); }
  var GG_WORDS = {
    ja: { all: '全ての<wbr>口コミデータを<wbr>解放する', top: '口コミを<wbr>解放する' },
    en: { all: 'Unlock all reviews', top: 'Unlock reviews' },
  };
  function unlockLabel(kind) {
    var words = GG_WORDS[LANG] || GG_WORDS.ja;
    return '<span class="pv-gg-t"><span class="pvg-gg-k" lang="en">Give &amp; Get</span>' +
           '<span class="pvg-gg-m">' + (words[kind] || words.all) + '</span></span>';
  }
  /* タブの無い会社ページと英語版で、黒い丸いボタンを出してよいか。
       'yes'  pv-gg.css を読めた ＝ 出す
       'no'   読めなかった／読む口（premium-auth-lock.js の window.PVGG）が無い ＝ 今までのボタンを1文字も変えずに出す
       'wait' まだ読んでいる途中 ＝ 今までのボタンを見えない箱に入れて置き、決まったら入れ替える（下の ggSettle）
     形の無い素の字や、橙のボタンから黒いボタンへの入れ替わりを、一瞬でも見せないための段取り。
     タブのある会社ページはページが自分で pv-gg.css を読んでいるので、ここは通らない（'no' ＝ ggShape の側で出す）。 */
  var ggHooked = false;
  function ggOld() {
    if (isTabbed()) return 'no';
    var g = w.PVGG;
    if (!g || typeof g.ready !== 'function' || typeof g.state !== 'function') return 'no';
    var st = g.state();
    if (st === 'yes' || st === 'no') return st;
    if (!ggHooked) {
      ggHooked = true;
      g.ready(ggSettle);
      st = g.state();                                   // その場で決まった時（もう読み終えていた）
      if (st === 'yes' || st === 'no') return st;
    }
    return 'wait';
  }
  function ggSettle(ok) {
    var els = d.querySelectorAll('[data-pvgg-wait]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], kind = el.getAttribute('data-pvgg-wait');
      if (!ok) el.outerHTML = el.innerHTML;                         // 今までのボタンを、そのまま出す
      else if (kind === 'card') el.parentNode.removeChild(el);      // 1枚ごとのボタンは置かない
      else el.outerHTML = ggBtn(kind);
    }
  }
  function ggWait(kind, old) { return '<div data-pvgg-wait="' + kind + '" style="display:none">' + old + '</div>'; }
  var GG_ARROW = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  /* 錠前のボタン。old ＝ 今までのボタン（pv-gg.css を読めなかった時は、これを1文字も変えずに返す）。
     押した先は今までと同じ（openReviewModal ＝ 自分の会社を選んだ投稿の画面）。
     <wbr> は語の切れ目。狭い箱ではここでだけ折れる（「デ／ータ」と語の途中で折らない。折り方は pv-gg.css）。 */
  function ggBtn(kind) {
    return '<button type="button" class="pv-gg" onclick="if(window.openReviewModal)openReviewModal()">' +
           unlockLabel(kind) + GG_ARROW + '</button>';
  }
  function unlockBtn(old, kind) {
    if (ggShape()) return ggBtn('all');
    var st = ggOld();
    return st === 'yes' ? ggBtn(kind || 'all') : st === 'wait' ? ggWait(kind || 'all', old) : old;
  }

  /* ★2026-10-08 口コミ1枚ごとの錠前のボタン。タブのある会社ページでは置かない。
     同じ黒いボタンが口コミの数だけ縦に並んでいた（キャセイで22個。ぼかしの帯の中では上下が切れていた）。
     入口は、評価スコアの1枚と、一覧のいちばん下の「メンバー限定データ」の2つ。
     ★2026-10-09 タブの無い会社ページと英語版も同じ（黒い丸いボタンを出す時は、1枚ごとには置かない。
       入口は一覧の見出しの投稿ボタンと、いちばん下の「メンバー限定データ」── 伏せた口コミが1件でも在れば必ず出る）。
       pv-gg.css を読めなかった時だけ、今までのボタンを1文字も変えずに返す。 */
  function cardCta(old) {
    if (ggShape()) return '';
    var st = ggOld();
    return st === 'yes' ? '' : st === 'wait' ? ggWait('card', old) : old;
  }
  /* 区分の名前の「語の切れ目」は、表 CAT_FULL の名前の中の「|」（catHTML が <wbr> にする）。3列の札では名前を語の途中で折らず、
     そこでだけ折る（折り方は pv-glance.css）。2026-10-25 まで、ここに名前の2つめの表（CAT_WBR）が在った。 */

  function injectReviewCategoryGrid() {
    var banner = d.getElementById('airline-rating-banner');
    /* 主要5社は帯が無いので、概要の中に用意してある置き場（#pvg-revcats）へ入れる */
    var slot = banner ? null : d.getElementById('pvg-revcats');
    if (!banner && !slot) return;

    var h1 = d.querySelector('.hero-airline h1');
    var name = h1 ? h1.textContent.trim() : '';
    var cnt = reviewCount();

    // 初期値。Supabase / 海外評判が届いたら refreshCounts() が塗り直す。
    var catCounts = categoryCounts();

    var cardsHTML = REVIEW_CATS.map(function (c, i) {
      return '\n    <button class="rcg-card" onclick="pvSetReviewCat(\'' + c.key + '\')">\n' +
        '      <span class="rcg-icon">' + (CAT_ICONS[c.key] || '') + '</span>\n' +
        '      <span class="rcg-label">' + catHTML(c.label) + '</span>\n' +
        '      <span class="rcg-count">' + L.catCount(catCounts[c.key] || 0) + '</span>\n' +
        '      <span class="rcg-chevron">' + CHEVRON + '</span>\n' +
        '    </button>';
    }).join('');

    var section = d.createElement('div');
    section.id = 'airline-review-cats';
    section.innerHTML =
      '\n    <div class="max-w-7xl mx-auto px-6 py-6">\n' +
      '      <div class="rcg-heading">' + L.rcgHeading(cnt) + '<span class="rcg-airline"> — ' + name + '</span></div>\n' +
      '      <div class="rcg-grid">' + cardsHTML + '</div>\n' +
      '    </div>';

    if (banner) banner.insertAdjacentElement('afterend', section);
    else slot.appendChild(section);
  }

  // ── 現地パイロットの生の声 ───────────────────────
  /* 従来 JP 14枚に直書きされていたセクション。引用は SEED の hl:'pro'/'con' から
     引くので、日本語ページと英語ページで必ず同じ2本が出る。 */
  function vcAttribution(r) {
    var out = (L.POS[r.pos] || L.pilot);
    if (r.avgRating && !isTabbed()) out += L.vcRating(r.avgRating);
    if (r.date) out += /^\d{4}$/.test(r.date) ? L.vcYear(r.date) : (LANG === 'en' ? ' · ' + r.date : '・' + r.date);
    if (r.src) out += ' — ' + r.src;
    return out;
  }

  function vcQuoteHTML(r, color) {
    var t = rvEsc(bodyText(r));
    return '<blockquote style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07);' +
      'border-left:4px solid ' + color + ';border-radius:14px;padding:20px">' +
      '<p class="text-sm leading-relaxed mb-3">' + (LANG === 'en' ? '“' + t + '”' : '「' + t + '」') + '</p>' +
      // <footer> にすると、各ページが素の footer{} に当てているサイトフッターの
      // 背景色・上境界線を引用の中まで持ち込んでしまう。必ず div で出す。
      '<div class="text-xs text-muted">' + rvEsc(vcAttribution(r)) + '</div></blockquote>';
  }

  function injectVoices() {
    if (!_RD.voicesFor) return;
    var v = _RD.voicesFor(AIRLINE_CODE, LANG);
    if (!v || !v.pro || !v.con) return;

    var col = function (title, color, r) {
      return '<div><h3 class="font-semibold mb-4" style="color:' + color + '">' + title + '</h3>' +
        '<div class="space-y-4">' + vcQuoteHTML(r, color) + '</div></div>';
    };

    var html =
      '<div class="section-badge mb-4">' + L.vcBadge + '</div>' +
      '<h2 class="text-2xl font-bold mb-2">' + rvEsc(v.h2) + '</h2>' +
      '<p class="text-muted text-sm mb-6">' + rvEsc(v.note) + '</p>' +
      '<div class="grid md:grid-cols-2 gap-6">' +
        col(L.vcPro, '#34d399', v.pro) +
        col(L.vcCon, '#fb923c', v.con) +
      '</div>' +
      (v.extra ? '<div class="mt-6 p-4 rounded-xl text-xs" style="background:rgba(44,93,229,.06);' +
        'border:1px solid rgba(44,93,229,.2);color:#8899aa">' + rvEsc(v.extra) + '</div>' : '') +
      '<div class="rv-post-gate" style="margin-top:24px">' +
        '<div style="font-size:.9rem;font-weight:700;margin-bottom:6px">' + L.vcGateTitle + '</div>' +
        '<p style="font-size:.8rem;color:#6b7d93;margin-bottom:14px">' + L.vcGateDesc + '</p>' +
        unlockBtn('<button class="btn-review-post" onclick="if(window.openReviewModal)openReviewModal()">' + L.vcGateBtn + '</button>', 'top') +
        '<div style="font-size:.72rem;color:#6b7d93;margin-top:8px">' + L.vcGateFine + '</div>' +
      '</div>' +
      '<div class="mt-8 pt-4" style="border-top:1px solid rgba(255,255,255,.07)">' +
        '<p class="text-xs text-muted mb-2">' + L.vcSrcLabel + '</p>' +
        '<div class="flex flex-wrap gap-x-5 gap-y-1">' +
          v.src.map(function (s) {
            return '<a href="' + s.url + '" target="_blank" rel="noopener" class="text-xs" ' +
              'style="color:#4b5a6a;text-decoration:none">' + rvEsc(s.label) + '</a>';
          }).join('') +
        '</div>' +
      '</div>';

    var sec = d.createElement('div');
    // fade-up は読み込み時の IntersectionObserver が拾わないので visible を最初から付ける
    sec.className = 'glass p-8 fade-up visible';
    sec.id = 'airline-voices';
    sec.dataset.tabSection = 'overview';
    sec.innerHTML = html;

    // FAQ の直前＝これまで静的セクションが置かれていた位置に差し込む
    var anchor = null;
    d.querySelectorAll('.glass').forEach(function (el) {
      if (anchor) return;
      var b = el.querySelector('.section-badge');
      if (b && /よくある質問|FAQ/i.test(b.textContent)) anchor = el;
    });
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(sec, anchor);
    else {
      var main = d.querySelector('.max-w-7xl.mx-auto.px-6.pb-24');
      if (main) main.appendChild(sec);
    }
  }

  /* 主要5社（<body data-pv-glance="1">）の載せ方。
     タブ・見出し・⭐・評価の図はページ側（gen-airline-glance.mjs／pv-glance.js／career-live.js）が持つ。
     ここがやるのは、口コミのタブの中の置き場へ「分類6枚」と「一覧」を描くことだけ。
     ・本文を節ごとに振り分けない（assignTabSections を呼ばない）── 呼ぶと全部の節に
       display が直書きされ、ページ側のタブと取り合いになる。
     ・「現地パイロットの生の声」の2本は一覧の中に同じ引用が在るので、ここでは重ねて出さない。 */
  function mountGlance() {
    activeTab = 'reviews';                      // 一覧は常に描いておく（隠すのはページ側のタブ）
    var host = d.getElementById('pvg-reviews-host');
    if (host && !d.getElementById('airline-review-section')) {
      var box = d.createElement('div');
      box.id = 'airline-review-section';
      box.style.display = 'block';              // airline-base.css が既定で隠している
      host.appendChild(box);
    }
    injectReviewCategoryGrid();
    renderReviews();
  }

  // ── Mount ────────────────────────────────────────
  var mounted = false;
  function mount() {
    if (mounted) return;
    /* body[data-airline] が無いページは航空会社ページではない。比較ページにも
       .max-w-7xl.mx-auto.px-6.pb-24 があるので、判定が無いとタブが注入され、
       assignTabSections() が本文を data-tab-section で振り分けて display:none に
       する。実際に gaishi-vs-nikkei.html では主役の12社ランキング表が、
       ana-vs-jal.html では年収推移の比較表が初期表示で消えていた。 */
    if (!AIRLINE_CODE) return;
    mounted = true;
    ensureCSS();
    if (isTabbed()) { mountGlance(); return; }
    assignTabSections();

    // Inject tab nav
    var mainDiv = d.querySelector('.max-w-7xl.mx-auto.px-6.pb-24');
    if (mainDiv) {
      var tabNav = d.createElement('div');
      tabNav.id = 'airline-tab-nav';
      var cnt = reviewCount();
      /* 中身が無いタブは出さない。ANA など21枚は採用の節をそもそも持っておらず、
         押すと真っ白になっていた（2026-08-15 に気づいた）。概要と口コミは
         このスクリプトが必ず描くので常に出す。 */
      var hasSec = function (sec) { return !!d.querySelector('[data-tab-section="' + sec + '"]'); };
      tabNav.innerHTML = '<div class="airline-tab-scroll max-w-7xl mx-auto px-6">\n' +
        '      <button class="airline-tab-btn active" data-tab="overview">' + L.tabs.overview + '</button>\n' +
        '      <button class="airline-tab-btn" data-tab="reviews">' + L.tabs.reviews + '<span class="atab-count">' + cnt + '</span></button>\n' +
        (hasSec('salary') ? '      <button class="airline-tab-btn" data-tab="salary">' + L.tabs.salary + '</button>\n' : '') +
        (hasSec('jobs') ? '      <button class="airline-tab-btn" data-tab="jobs">' + L.tabs.jobs + '</button>\n' : '') +
        '    </div>';
      mainDiv.parentNode.insertBefore(tabNav, mainDiv);

      // Insert review section at top of main content
      var reviewDiv = d.createElement('div');
      reviewDiv.id = 'airline-review-section';
      mainDiv.insertBefore(reviewDiv, mainDiv.firstChild);
    }

    // Bind tab buttons
    d.querySelectorAll('.airline-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
    });

    /* 主要5社（<body data-pv-glance="1">）は、見本の点数を混ぜた評価の帯を出さない。
       星と件数は、実際の投稿だけで社名の行が出す（career-live.js）。ほかの会社は今までどおり。 */
    if (!isGlance()) injectHeroRatingBanner();
    injectReviewCategoryGrid();
    injectVoices();

    /* 件数は口コミタブを開く前（概要タブ）から見えている。タブを開いたときに
       初めて取得していると、タブ badge と見出しがシードの数のまま残る。
       ここで先に投げて、届き次第 refreshCounts() が塗り直す。 */
    fetchV2Rows();
    pvLoadOverseas();

    // Auto-open reviews tab if URL has #reviews
    if (location.hash === '#reviews') {
      setTimeout(function () {
        switchTab('reviews');
        var el = d.getElementById('airline-review-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }

    switchTab('overview');
  }

  w.PVReviewUI = {
    LANG: LANG,
    L: L,
    mount: mount,
    sb: _initSB,
    getRatings: getAirlineRatings,
    ratingsFor: ratingsFor,
    cats: { short: CAT_SHORT, full: CAT_FULL },
    reviewCount: reviewCount,
    getSeedReviews: getSeedReviews,
    switchTab: switchTab,
    renderReviews: renderReviews,
  };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', mount);
  else mount();

})(window, document);
