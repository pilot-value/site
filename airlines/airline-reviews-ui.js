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
      gateDesc: '匿名の口コミを1件投稿するだけで<br>全社の口コミがまるごと読めます。',
      gateBtn: '匿名で口コミを投稿して解放する',
      gateLogin: 'ログイン（投稿済みの方）',
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
      gateDesc: 'Post one anonymous review and every airline&rsquo;s<br>reviews open up.',
      gateBtn: 'Post a review anonymously to unlock',
      gateLogin: 'Log in (already posted)',
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
    return _RD.forLang ? _RD.forLang(AIRLINE_CODE, LANG) : (_RD.SEED[AIRLINE_CODE] || _RD.GENERIC);
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
      return '\n    <div class="hrb-bar-row">\n      <div class="hrb-bar-label">' + label +
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
     （消すと各国SEOのロングテールが飛ぶ）。帯の中央に投稿CTAを重ねる。 */
  function lockedTailHTML(tailText) {
    if (!tailText) return '';
    return '\n      <div class="rv-locked-tail">\n' +
      '        <div class="rv-locked-tail-text">' + rvEsc(tailText) + '</div>\n' +
      '        <div class="rv-locked-cta">\n' +
      '          <button type="button" class="rv-locked-btn" onclick="openReviewModal()">\n' +
      '            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>\n' +
      '            ' + L.lockedCta + '\n' +
      '          </button>\n' +
      '        </div>\n' +
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
    var score  = hasScore ? r.avgRating.toFixed(1) : '';
    var filled = hasScore ? Math.round(r.avgRating) : 0;
    var stars  = hasScore ? Array.from({ length: 5 }, function (_, i) {
      return '<span class="' + (i < filled ? 'rv-stars' : 'rv-star-empty') + '">★</span>';
    }).join('') : '';
    // pos:'pilot' は職位不明の意味なので、頭の「パイロット」と重ねて出さない
    var pos   = r.pos === 'pilot' ? '' : (L.POS[r.pos] || r.pos || '—');
    var join  = L.JOIN[r.join] || r.join || '';
    var years = r.years || '';
    var uid   = 'rv_' + Math.random().toString(36).slice(2);
    var catLabel = (REVIEW_CATS.filter(function (c) { return c.key === r.cat; })[0] || { label: L.catFallback }).label;
    return '<div class="detail-review-card">\n' +
      '    <div class="rv-card-head">\n' +
      '      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">\n' +
      '        <span class="rv-card-type">' + catLabel + '</span>\n' +
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
      '      <div class="rv-comment" id="' + uid + '_text">' + preview + (hasMore && !locked ? '…' : '') +
             (locked ? lockedTailHTML(tail) : '') + '</div>\n' +
      // 未解放で原文トグルを出すと、翻訳元の全文がその場で読めてしまいゲートが素通しになる。
      // 「自動翻訳」バッジだけ残し、トグルは解放済みのときにだけ出す。
      '      ' + (r.translated ? PVReviewI18n.noteHTML(r.from) + (locked ? '' : PVReviewI18n.origHTML(r.origText)) : '') + '\n' +
      '      ' + (hasMore && !locked ? '<button class="rv-read-more" id="' + uid + '_btn" data-full="' + rvEsc(comment) +
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
    return '<div class="rv-card-wrap">' + reviewCardInnerHTML(r, locked, idx) + '</div>';
  }

  // ── Review Category Filter ───────────────────────
  var pvReviewCatFilter = 'all';
  w.pvSetReviewCat = function (cat) {
    pvReviewCatFilter = cat;
    switchTab('reviews');
    renderReviews();
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
    if (existing) { existing.style.display = 'flex'; return; }
    var modal = d.createElement('div');
    modal.id = 'pv-readmore-gate';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);backdrop-filter:blur(4px)';
    modal.innerHTML =
      '\n    <div style="background:#111620;border:1px solid rgba(245,200,66,.2);border-radius:18px;padding:36px 32px;max-width:380px;width:90%;text-align:center;position:relative">\n' +
      '      <button onclick="document.getElementById(\'pv-readmore-gate\').style.display=\'none\'" style="position:absolute;top:12px;right:14px;background:none;border:none;color:#6b7d93;cursor:pointer;font-size:1.1rem;line-height:1">✕</button>\n' +
      '      <div style="font-size:2.2rem;margin-bottom:12px">🔒</div>\n' +
      '      <div style="font-weight:700;font-size:1rem;margin-bottom:8px;color:#e8edf2">' + L.rmTitle + '</div>\n' +
      '      <p style="font-size:.82rem;color:#6b7d93;line-height:1.65;margin-bottom:22px">' + L.rmDesc + '</p>\n' +
      '      <div style="display:flex;flex-direction:column;gap:10px">\n' +
      '        <button class="btn-review-post" style="width:100%;justify-content:center" onclick="openReviewModal()">\n' +
      '          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>\n' +
      '          ' + L.rmBtn + '\n' +
      '        </button>\n' +
      '        ' + (!isLoggedIn() ? '<a href="../login.html" style="color:#6b7d93;font-size:.78rem;text-decoration:underline;text-underline-offset:2px">' + L.rmLogin + '</a>' : '') + '\n' +
      '      </div>\n' +
      '      <div style="font-size:.71rem;color:#6b7d93;margin-top:10px">' + L.rmFine + '</div>\n' +
      '    </div>';
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.style.display = 'none'; });
    d.body.appendChild(modal);
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
      .join('　・　');
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
        '          <span class="rv-card-type">' + label + '</span>\n' +
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
    var avgRating = scores.length ? +(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length).toFixed(1) : 3;
    // 投稿口コミは Webhook→Edge Function で各言語へ翻訳済み。訳が無い欄は原文に落ちる。
    var body = w.PVReviewI18n ? PVReviewI18n.pick(r) : { text: '', cats: [], translated: false, origText: '', from: 'ja' };
    var mainCat = (body.cats[0] || {}).k || '';
    return {
      pos: r.position, years: r.tenure_bucket || '—', join: '',
      avgRating: avgRating,
      comment: body.text, en: body.text,
      translated: body.translated, origText: body.origText, from: body.from,
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
            avgRating: r.avgRating || r.rating || 3,
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
      // select('*') は orig_lang / translations も含むので明示列は足さない
      // （足すと列が無い環境で 42703 になる）。
      return sb.from('reviews_v2').select('*').in('airline', airlineCodes())
        .order('created_at', { ascending: false })
        .then(function (res) { return (res && res.data) || []; });
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

  function applyV2Ratings(rows) {
    if (!rows.length) return;
    var newRatings = V2_CAT_KEYS.map(function (k) {
      var vals = rows.map(function (r) { return r[k]; }).filter(function (v) { return v > 0; });
      return vals.length ? +(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length).toFixed(1) : null;
    });
    if (newRatings.some(function (v) { return v !== null; })) {
      var seed = RATINGS[AIRLINE_CODE] || DEFAULT_R;
      var n = rows.length;
      updateRatingBanner(seed.map(function (s, i) {
        return newRatings[i] !== null ? +((s * 2 + newRatings[i] * n) / (2 + n)).toFixed(1) : s;
      }), n);
    } else {
      // 評点が無い投稿しかなくても「何名が回答したか」は事実なので出す
      var el = d.querySelector('#airline-rating-banner .hrb-count');
      if (el) el.textContent = L.respondents(rows.length);
    }
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
        '" onclick="pvSetReviewCat(\'' + c.key + '\')">' + c.label + '</button>';
    }).join('');
    var shown = filtered.length + overseasShownKeys().length;
    var emptyMsg = shown === 0
      ? '<div style="text-align:center;padding:32px 0;color:#6b7d93;font-size:.85rem">' + L.empty + '</div>' : '';
    var loginHref = '../login.html?return=' + encodeURIComponent(location.pathname + location.search);
    var postGate = (locked && shown > 0) ?
      '\n      <div class="rv-post-gate">\n' +
      '        <div class="rv-gate-lock">🔒</div>\n' +
      '        <div class="rv-gate-title">' + L.gateTitle + '</div>\n' +
      '        <div class="rv-gate-remain">' + L.gateAll(shown) + '</div>\n' +
      '        <p class="rv-gate-desc">' + L.gateDesc + '</p>\n' +
      '        <button class="btn-review-post" onclick="openReviewModal()">' + L.gateBtn + '</button>\n' +
      '        <a href="' + loginHref + '" class="rv-gate-login">' + L.gateLogin + '</a>\n' +
      '        <div style="font-size:.72rem;color:#6b7d93;margin-top:10px">' + L.gateFine + '</div>\n' +
      '      </div>' : '';
    section.innerHTML =
      '\n      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">\n' +
      '        <h2 style="font-size:1.2rem;font-weight:700">' + L.reviewsHeading + '</h2>\n' +
      '        <button class="btn-review-post" style="font-size:.8rem;padding:8px 18px" onclick="openReviewModal()">' + L.postReviewShort + '</button>\n' +
      '      </div>\n' +
      '      <div class="rcf-chips">' + chipsHTML + '</div>\n' +
      '      ' + overseasHTML + cardsHTML + emptyMsg + '\n' +
      '      ' + postGate;

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

  function switchTab(tab) {
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
  var CAT_ICONS = [
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.68 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.17h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.27a16 16 0 0 0 5.82 5.82l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  ];
  var CHEVRON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

  function injectReviewCategoryGrid() {
    var banner = d.getElementById('airline-rating-banner');
    if (!banner) return;

    var h1 = d.querySelector('.hero-airline h1');
    var name = h1 ? h1.textContent.trim() : '';
    var cnt = reviewCount();

    // 初期値。Supabase / 海外評判が届いたら refreshCounts() が塗り直す。
    var catCounts = categoryCounts();

    var cardsHTML = REVIEW_CATS.map(function (c, i) {
      return '\n    <button class="rcg-card" onclick="pvSetReviewCat(\'' + c.key + '\')">\n' +
        '      <span class="rcg-icon">' + CAT_ICONS[i] + '</span>\n' +
        '      <span class="rcg-label">' + c.label + '</span>\n' +
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

    banner.insertAdjacentElement('afterend', section);
  }

  // ── 現地パイロットの生の声 ───────────────────────
  /* 従来 JP 14枚に直書きされていたセクション。引用は SEED の hl:'pro'/'con' から
     引くので、日本語ページと英語ページで必ず同じ2本が出る。 */
  function vcAttribution(r) {
    var out = (L.POS[r.pos] || L.pilot);
    if (r.avgRating) out += L.vcRating(r.avgRating);
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
        '<button class="btn-review-post" onclick="if(window.openReviewModal)openReviewModal()">' + L.vcGateBtn + '</button>' +
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

    injectHeroRatingBanner();
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
    reviewCount: reviewCount,
    getSeedReviews: getSeedReviews,
    switchTab: switchTab,
    renderReviews: renderReviews,
  };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', mount);
  else mount();

})(window, document);
