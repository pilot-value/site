/* ══════════════════════════════════════════════════════════════
   review-i18n.js — 口コミの日↔英 表示を一本化する共有モジュール

   reviews_v2 の1行は「原文の言語(orig_lang)」と「反対言語の訳文(translations)」を
   持つ。このモジュールは、そのページの言語で読める本文を組み立てて返す。

     ・原文がページと同じ言語  → 原文をそのまま出す
     ・原文がページと違う言語  → translations[ページ言語] があれば訳文を出し、
                                 「自動翻訳」バッジと原文トグルを添える
     ・translations が無い/欠けている → その欄は原文にフォールバックする
       （＝ SQL 未適用でも Edge Function 未デプロイでもページは壊れない）

   利用側: community.html / en/community.html / airlines/airline-base.js /
           en-airline-reviews.js
   ══════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';

  var KEYS = ['culture', 'salary', 'benefits', 'wlb', 'ops', 'training', 'mgmt'];

  var LABELS = {
    ja: { culture:'企業文化', salary:'給与', benefits:'福利厚生', wlb:'WLB',
          ops:'運航環境', training:'訓練環境', mgmt:'経営陣への提案' },
    en: { culture:'Culture', salary:'Pay', benefits:'Benefits', wlb:'WLB',
          ops:'Flight operations', training:'Training', mgmt:'Suggestions for management' },
  };

  // ラベルの囲み方だけ言語で変える（日本語は【】、英語は []）
  var WRAP = {
    ja: function (label, text) { return '【' + label + '】' + text; },
    en: function (label, text) { return '[' + label + '] ' + text; },
  };

  var UI = {
    ja: { note: '自動翻訳', from: function (l) { return (l === 'en' ? '英語' : '日本語') + 'から自動翻訳'; },
          show: '原文を表示', hide: '原文を隠す' },
    en: { note: 'Machine-translated', from: function (l) { return 'Machine-translated from ' + (l === 'ja' ? 'Japanese' : 'English'); },
          show: 'Show original', hide: 'Hide original' },
  };

  function lang() {
    var l = (d.documentElement.getAttribute('lang') || '').toLowerCase();
    return l.indexOf('en') === 0 ? 'en' : 'ja';
  }

  // 口コミは利用者が書いた文字列。innerHTML に入る経路が複数あるので必ずここを通す。
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* 翻訳が改行を「\n」という2文字のまま返してくることがあり、そのまま出すと
     本文に \n が見えてしまう（英語版トップの口コミカードで実際に出た）。
     本物の改行・タブも1枚のカードでは詰めたいので、まとめて空白に均す。
     ⚠️ ここは原文も訳文も必ず通る唯一の口で、口コミを出すページが全部これを呼ぶ。
        直す場所を増やさない。 */
  function flatten(s) {
    if (!s) return s;
    return String(s)
      .replace(/\\[nrt]/g, ' ')        // 文字としての \n \r \t
      .replace(/[\r\n\t]+/g, ' ')      // 本物の改行・タブ
      .replace(/[ \u3000]{2,}/g, ' ')
      .trim();
  }

  /* 1行から表示用テキストを組み立てる。
     戻り値 { lang, from, translated, cats, text, origCats, origText } */
  function pick(row) {
    var to = lang();
    var from = (row && row.orig_lang) || 'ja';
    var tr = (row && row.translations && row.translations[to]) || null;
    var lab = LABELS[to], wrap = WRAP[to];

    var cats = [], origCats = [], usedTranslation = false;
    for (var i = 0; i < KEYS.length; i++) {
      var k = KEYS[i];
      var orig = flatten(row ? row[k + '_comment'] : '');
      var t = flatten(tr && tr[k]);
      // 訳文があるのは from !== to のときだけ。欠けている欄は原文に落とす。
      var show = (from !== to && t) ? t : orig;
      if (!show) continue;
      if (from !== to && t) usedTranslation = true;
      cats.push({ k: k, label: lab[k], text: show });
      if (orig) origCats.push({ k: k, label: lab[k], text: orig });
    }
    // 長い順＝カードの主カテゴリ判定と読み応えのある順に揃える（既存挙動を踏襲）
    cats.sort(function (a, b) { return b.text.length - a.text.length; });
    origCats.sort(function (a, b) { return b.text.length - a.text.length; });

    var join = function (list) {
      return list.map(function (c) { return wrap(c.label, c.text); }).join(' / ');
    };
    return {
      lang: to, from: from, translated: usedTranslation,
      cats: cats, text: join(cats),
      origCats: origCats, origText: usedTranslation ? join(origCats) : '',
    };
  }

  /* orig_lang / translations は後から足す列。DDL 未適用の環境では
     select 全体が 42703 で落ちて口コミが1件も出なくなるので、
     そのときだけ2列を外して1回だけ引き直す。
     run(extra) は「列リスト末尾に extra を足したクエリ」を返す関数。 */
  var EXTRA_COLS = ',orig_lang,translations';
  function fetchWithFallback(run) {
    return Promise.resolve(run(EXTRA_COLS)).then(function (res) {
      if (res && res.error && String(res.error.code) === '42703') return run('');
      return res;
    });
  }

  /* 「自動翻訳」バッジ。訳文を出しているカードにだけ添える。 */
  function noteHTML(from) {
    var u = UI[lang()];
    return '<span class="rv-tr-badge" title="' + esc(u.from(from)) + '">' + esc(u.note) + '</span>';
  }

  /* 原文トグル。原文は消さずに畳んでおく（忠実性の担保）。 */
  function origHTML(origText) {
    if (!origText) return '';
    var u = UI[lang()];
    return '<button type="button" class="rv-tr-toggle" data-show="' + esc(u.show) + '" data-hide="' + esc(u.hide) +
      '" onclick="PVReviewI18n.toggle(this)">' + esc(u.show) + '</button>' +
      '<div class="rv-tr-orig" hidden>' + esc(origText) + '</div>';
  }

  function toggle(btn) {
    var box = btn.nextElementSibling;
    if (!box) return;
    var open = box.hasAttribute('hidden');
    if (open) box.removeAttribute('hidden'); else box.setAttribute('hidden', '');
    btn.textContent = open ? btn.dataset.hide : btn.dataset.show;
  }

  /* バッジ・トグル・原文の最小スタイル。読み込んだページに1回だけ入れる。 */
  function injectCSS() {
    if (d.getElementById('pv-review-i18n-css')) return;
    var st = d.createElement('style');
    st.id = 'pv-review-i18n-css';
    st.textContent =
      '.rv-tr-badge{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;' +
        'font-size:.66rem;font-weight:600;letter-spacing:.02em;vertical-align:middle;' +
        'background:rgba(107,125,147,.14);color:#6b7d93;border:1px solid rgba(107,125,147,.28)}' +
      '.rv-tr-toggle{display:inline-block;margin-top:8px;padding:0;border:0;background:none;cursor:pointer;' +
        'font-size:.72rem;font-weight:600;color:#6b7d93;text-decoration:underline;text-underline-offset:2px;' +
        'transition:color .15s cubic-bezier(.2,.8,.3,1),opacity .15s cubic-bezier(.2,.8,.3,1)}' +
      '.rv-tr-toggle:hover{color:#f5c842}' +
      '.rv-tr-toggle:focus-visible{outline:2px solid #f5c842;outline-offset:3px;border-radius:3px}' +
      '.rv-tr-toggle:active{opacity:.65}' +
      '.rv-tr-orig{margin-top:8px;padding:10px 12px;border-radius:8px;font-size:.82rem;line-height:1.75;' +
        'white-space:pre-wrap;background:rgba(107,125,147,.08);border:1px solid rgba(107,125,147,.18);color:#8fa0b4}' +
      // ライトテーマ。#6b7d93 / #8fa0b4 は白地だとコントラストが足りない。
      // ゴールドは JP 側（airline-base.css）と同じ #7a5800 に寄せる。
      '[data-theme="light"] .rv-tr-badge{background:rgba(15,23,42,.06);color:#475569;border-color:rgba(15,23,42,.16)}' +
      '[data-theme="light"] .rv-tr-toggle{color:#475569}' +
      '[data-theme="light"] .rv-tr-toggle:hover{color:#7a5800}' +
      '[data-theme="light"] .rv-tr-orig{background:rgba(15,23,42,.04);border-color:rgba(15,23,42,.12);color:#334155}';
    (d.head || d.documentElement).appendChild(st);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', injectCSS);
  else injectCSS();

  w.PVReviewI18n = {
    KEYS: KEYS, labels: function () { return LABELS[lang()]; }, lang: lang,
    esc: esc, pick: pick, noteHTML: noteHTML, origHTML: origHTML, toggle: toggle,
    EXTRA_COLS: EXTRA_COLS, fetchWithFallback: fetchWithFallback,
  };
})(window, document);
