/* ══════════════════════════════════════════════════════════════
   lp.js — トップページ（index.html / en/index.html）の実データ差し込みと計測

   方針
   ・日英で1本。<html lang> を見て T を切り替える＝文言が2ファイルに散らない
     （my-value.js / payslip.js と同じ形）。
   ・実データを先に取りに行き、無いときだけ「まだ出せない」と正直に出す。
     数字の水増しはしない。データが貯まればコードを触らずに本物へ切り替わる。
   ・n≧5 の判定は Postgres 側（pay_benchmarks の having count(*) >= 5）にある。
     ここでは判定しない。画面側で閾値を持つと、いつか片方だけ緩む。
   ・supabase-js のクライアントは作らない。ページ末尾で1個作っているので、
     2個目を作ると GoTrue が同じ localStorage を奪い合う。REST を素の fetch で叩く。
   ・金額は必ず「¥N,NNN万」で書き出す。currency.js の MutationObserver が
     後から拾って通貨切替に追随させる（独自フォーマットで書くと変換から漏れる）。
   ══════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';

  var SB_URL = 'https://vzgmnkrggrwtsrpqndsm.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6Z21ua3JnZ3J3dHNycHFuZHNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzkwOTcsImV4cCI6MjA5MDAxNTA5N30.wE4cJbqeYGCgn5ZvHd80hYWgQuySKvOMJMbsJWOvmtw';

  /* ロゴの置き場は、このスクリプト自身の URL を基準に解く（actual-pay.js と同じ）。
     ページ相対で書くと /en/ から en/assets/… を見に行って 404 になる。
     currentScript は同期実行中しか取れないので、ここで確定させる（defer でも取れる）。 */
  var LOGO_BASE = 'assets/airline-logos/';
  try {
    var _self = (d.currentScript && d.currentScript.src) || '';
    if (_self) LOGO_BASE = new URL('assets/airline-logos/', _self).href;
  } catch (e) {}

  function rest(path) {
    return fetch(SB_URL + '/rest/v1/' + path, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
    }).then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
  }

  /* ══════════════════════════════════════════════════════════════
     日英の文言。<html lang> で切り替える。
     ⚠️ 英語は日本語の直訳にしない。英語として自然な言い方を先に決めて置く。
     ⚠️ 金額の書式（¥N,NNN万）は日英とも同じ。currency.js がこの文字列を拾って
        英語面では USD に変える。ここを英語用に別書式にすると assert-currency.mjs が落ちる。
     ══════════════════════════════════════════════════════════════ */
  var L = (window.PV_BASE === 'en' || (d.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('en') === 0) ? 'en' : 'ja';   // スペイン語のページは英語と同じ動き（pv-session.js）
  var T = {
    ja: {
      sep: ' ・ ',
      rating:    '評価 ',
      autoTr:    '自動翻訳',
      emptyT:    'まだ投稿が少ないです',
      emptyD:    'ここには現役・元パイロット本人の投稿だけを載せます。件数を水増ししたり、他サイトの口コミを転載したりはしません。',
      mqMeta: function (years, base) { return '経験 ' + years + ' ・ ' + base; },
      /* ★ヒーローの電話（REAL PAY の一覧のカード）と REAL PAY の節の白いカード（行を押すと出る面）の語。
         ★2026-11-01、本物の画面と同じ形にしたとき、語も actual-pay.js の辞書から写し直した
         （同じものを2つの言い方で呼ばない）── seg は S.seg、thAmt・dwYear・dwMonth・dwComp・cbMore・dash は T、
         pos は pv-vocab.json の positions、ten は T.ten.r。
         openNote だけは写しではない：本物の T.dwShare は「構成比は匿名化された金額帯から算出した概算です」。
         見本の帯は誰かの投稿を匿名化したものではないので、その部分を言わない短い文にしてある。
         ★actual-pay.js 側の文言は書き換えない。 */
      seg: { base: '基本給', variable: '変動給', bonus: '賞与・利益分配' },
      pos: { '機長': '機長（CAP）', '副操縦士': '副操縦士（FO）' },
      thAmt: '年収',
      dwYear: '年収', dwMonth: '月あたり', dwComp: '報酬の内訳',
      cbMore: 'ほか{n}区分',
      dash: '〜',
      openNote: '構成比は概算です',
      ten: function (y) { return '昇格後' + y; },
      voice: { culture: '企業文化', salary: '給与', benefits: '福利厚生',
               wlb: 'WLB', ops: '運航環境', training: '訓練環境', mgmt: '経営陣への提案' },
    },
    en: {
      sep: ' · ',
      rating:    'Rating ',
      autoTr:    'Machine-translated',
      emptyT:    'Not many posts yet.',
      emptyD:    'Only working and former pilots post here. We never pad the count, and we never repost reviews from other sites.',
      mqMeta: function (years, base) { return years + ' · ' + base; },
      // 日本語側と対（actual-pay.js の英語から写す。openNote だけ短く言い直したもの）
      seg: { base: 'Base pay', variable: 'Variable (flying)', bonus: 'Bonus & profit share' },
      pos: { '機長': 'Captain (CAP)', '副操縦士': 'First Officer (FO)' },
      thAmt: 'Annual',
      dwYear: 'Per year', dwMonth: 'Per month', dwComp: 'Compensation',
      cbMore: '+{n} more',
      dash: '–',
      openNote: 'Shares are approximate',
      ten: function (y) { return y + ' in rank'; },
      voice: { culture: 'Culture', salary: 'Pay', benefits: 'Benefits',
               wlb: 'WLB', ops: 'Operations', training: 'Training', mgmt: 'To management' },
    },
  };
  T = (window.PV_T && window.PV_T(T, L)) || T[L];   // スペイン語の辞書があればそれ

  /* 日本語で書いてある短い語を英語に置き換える1枚の辞書。
     ★PV_DEMO の配列を2本持たないための仕掛け（配列は日本語のまま1本）。
     載っていない語はそのまま返すので、行を足しても英語面が壊れず日本語のまま出る。 */
  var EN_WORD = {
    // 職位
    '機長': 'Captain', '副操縦士': 'First Officer', '訓練生': 'Trainee',
    // 何で構成された額か
    '年俸＋住宅手当（非課税）': 'Salary + housing, tax-free',
    '年俸＋住宅手当': 'Salary + housing',
    '年俸＋年金拠出': 'Salary + pension',
    '年俸（税引前）': 'Annual, before tax',
    '月給＋賞与＋乗務手当': 'Base + bonus + flight pay',
    '月給＋賞与': 'Base + bonus',
    '基本給＋乗務手当': 'Base + flight pay',
    // 経験年数
    '3〜5年': '3–5 yrs', '5〜10年': '5–10 yrs', '10〜15年': '10–15 yrs',
    '15〜20年': '15–20 yrs', '20年以上': '20+ yrs',
    // ベース
    'ドバイ': 'Dubai', 'ドーハ': 'Doha', '羽田': 'Tokyo Haneda', '伊丹': 'Osaka Itami',
    '関西': 'Osaka Kansai', 'アトランタ': 'Atlanta', 'サンフランシスコ': 'San Francisco',
    'シンガポール': 'Singapore', '香港': 'Hong Kong', 'フランクフルト': 'Frankfurt',
    'シドニー': 'Sydney', 'イスタンブール': 'Istanbul',
  };
  function tw(s) { return L === 'en' ? (EN_WORD[s] || s) : s; }

  /* 航空会社の表示名。英語面は airlines-meta.js の en を引く（英語の社名表を二重に持たない）。
     読み込み順で PV_AIRLINES が未定義のことがあるので、そのときは渡された名前をそのまま使う。 */
  var NAME_BY_SLUG = null;
  function airlineName(slug, fallback) {
    if (NAME_BY_SLUG === null) {
      NAME_BY_SLUG = {};
      if (w.PV_AIRLINES && typeof w.PV_slugOf === 'function') {
        w.PV_AIRLINES.forEach(function (a) { NAME_BY_SLUG[w.PV_slugOf(a)] = a; });
      }
    }
    var a = NAME_BY_SLUG[slug];
    if (!a) return fallback || slug;
    return (L === 'en' ? (a.en || a.name) : a.name) || fallback || slug;
  }

  /* 社の札そのもの（ブランド色・国旗）。表は airlineName と同じ1つを使い回す。 */
  function airlineMeta(slug) {
    if (NAME_BY_SLUG === null) airlineName(slug);
    return NAME_BY_SLUG[slug] || null;
  }

  /* 投稿フォームが保存するのは言語に依らない符号（captain / 10-15）。
     そのまま出すと日英どちらの画面でも符号が見えるので、ここで言葉に直す。 */
  var POS_LABEL = (function (D) { return (window.PV_T && window.PV_T(D, L)) || D[L]; })({
    ja: { captain: '機長', fo: '副操縦士', cadet: '訓練生' },
    en: { captain: 'Captain', fo: 'First Officer', cadet: 'Trainee' },
  });
  var TENURE_LABEL = (function (D) { return (window.PV_T && window.PV_T(D, L)) || D[L]; })({
    ja: { '1-5': '1〜5年', '5-10': '5〜10年', '10-15': '10〜15年', '15-20': '15〜20年', '20+': '20年以上' },
    en: { '1-5': '1–5 yrs', '5-10': '5–10 yrs', '10-15': '10–15 yrs', '15-20': '15–20 yrs', '20+': '20+ yrs' },
  });

  /* ══════════════════════════════════════════════════════════════
     ★PV_DEMO — 実在しないサンプル値。2026-08-11 のオーナー判断で、このまま公開する。

     流れるカード・ヒーローの見本の画面・REAL PAY の節のカードには、本人の実投稿ではなくサンプルを使う。
     Hero に実在する個人の投稿を流す必要はない（＝本人記録は流さない）。
     ★2026-09-22 まで、トップの「公開額と実際の額」の表（#actual-pay）のモザイクの下にもこの値を敷いていた。
       表ごとトップから外したので、pay_benchmarks で上書きする処理（fillActualPay）も消した。
     ⚠️ 差し替えるときのために、印は残してある。index.html 側にも同じ印がある。
        grep PV_DEMO で全部出る。

     金額は必ず SSOT（salary-data.mjs の SALARY）のレンジ内に置く。
     ⚠️ check-salary.mjs はこの値を見ていない（見るのは .html だけ。ここは JS が描く）。
        以前ここに「範囲外なら PASS 2 が落ちる」と書いてあったが誤り。値を変えたら
        SALARY のレンジと手で突き合わせる（範囲外でも何も赤くならない）。
     ★2026-09-22 からヒーローの右の見本の画面（fillHero）もここから描く。新しい数字は作らない。
     ★2026-09-16 オーナー指示で 100万円単位（末尾2桁は必ず 00）に丸めてある。
        細かい端数が並んでいると「自分のはこんなにきれいな数字じゃない」と手が止まるため。
        表示側の丸めは mqAmt()。ここの値も同じ粒度で書く（片方だけ細かくしない）。
     並びは固定。Math.random() を使わない（スクショ差分と目視比較のため）。
     ══════════════════════════════════════════════════════════════ */
  var PV_DEMO = {
    // [slug, 年収(万円), 内訳ラベル, 職位, 機種, 経験, ベース, 社名]
    marquee: [
      ['emirates',           4000, '年俸＋住宅手当（非課税）', '機長',   'B777', '10〜15年', 'ドバイ',        'エミレーツ航空'],
      ['ana',                2800, '月給＋賞与＋乗務手当',     '機長',   'B787', '15〜20年', '羽田',          '全日本空輸'],
      ['delta',              6500, '年俸（税引前）',           '機長',   'A350', '20年以上', 'アトランタ',    'デルタ航空'],
      ['jal',                1800, '月給＋賞与＋乗務手当',     '副操縦士', 'B737', '5〜10年',  '羽田',          '日本航空'],
      ['qatar-airways',      3100, '年俸＋住宅手当（非課税）', '機長',   'A350', '10〜15年', 'ドーハ',        'カタール航空'],
      ['singapore-airlines', 1900, '基本給＋乗務手当',         '副操縦士', 'B787', '5〜10年',  'シンガポール',  'シンガポール航空'],
      ['cathay-pacific',     3700, '年俸＋住宅手当',           '機長',   'A330', '15〜20年', '香港',          'キャセイパシフィック航空'],
      ['united',             3300, '年俸（税引前）',           '副操縦士', 'B737', '5〜10年',  'サンフランシスコ', 'ユナイテッド航空'],
      ['ana',                1600, '月給＋賞与',               '副操縦士', 'A320', '3〜5年',   '伊丹',          '全日本空輸'],
      ['lufthansa',          3200, '年俸＋年金拠出',           '機長',   'A320', '10〜15年', 'フランクフルト', 'ルフトハンザ'],
      ['peach',              2400, '月給＋賞与＋乗務手当',     '機長',   'A320', '10〜15年', '関西',          'Peach'],
      ['qantas',             4100, '年俸（税引前）',           '機長',   'B787', '15〜20年', 'シドニー',      'カンタス航空'],
      ['jal',                3200, '月給＋賞与＋乗務手当',     '機長',   'A350', '20年以上', '羽田',          '日本航空'],
      ['turkish-airlines',   1500, '基本給＋乗務手当',         '副操縦士', 'B737', '5〜10年',  'イスタンブール', 'ターキッシュ エアラインズ'],
    ],
    /* ヒーローの右の見本の画面（2026-09-22）。行は上の marquee の何番目を使うか。
       ★2026-11-01 オーナー指示「real pay とか…実際に即していない」で、本物の REAL PAY の
         スマホの一覧（actual-pay.css の @media (max-width:720px) のカード）と同じ形にした。
         1枚 ＝ ロゴ・社名／「年収」・額／職位 · 機材／内訳の棒と、いちばん大きい区分1つ＋「ほか◯区分」／ ›。
         ・行の中に「開いた面」を差し込むのはやめた（本物の一覧には無い。押すと別の面が開く）。
           内訳は各カードの棒で見える。開いた面の見本は REAL PAY の節の白いカード（下の detail）。
         ・本物のカードに無いもの（月あたり・年数）はカードに出さない（月あたりは本物も狭い幅で伏せる）。
         ・見本なので「✓ Verified」「本人申告」「投稿時期」は付けない（オーナー回答「1」＝
           本物の REAL PAY のプレビューの行と同じ扱い。信用の印を作り物に付けない）。
         カードは 76px × 5枚（あいだ 6px・上 6px）＝ 410px。前と同じ中身の高さ ＝ 電話も緑の面も 1px も動かない。
         ⚠️ 本数を変えたら index.html / en/index.html の灰色の骨組みと lp.css の .hero-card の高さも同じ回に直す。
       rp.on ＝ REAL PAY の節の白いカード（行を押すと出る面の見本）がどの行か。
       ⚠️ **marquee の何番目か**（rows の何番目か、ではない）。2026-09-23 まで rows 経由で引いていて、
          rows を短くした瞬間に undefined → 例外で boot() の残りが全部止まる形だった。
       detail ＝ その面の報酬の内訳。parts は [区分, 割合%]（整数・合計は必ず 100 ＝ 本物の shareInts と同じ）、
         band は区分ごとの**金額の帯**（万円）。本物は帯でしか出さないので見本も帯。
         割合は帯の中点から出してある（2,100 ＋ 1,000 ＋ 600 ＝ 3,700 ＝ rp.on の年収）。
       ★2026-11-01 オーナー指示「他社のパイロットはいくら稼いでる？の部分は ANA・JAL 以外の外航にして」──
         キャセイパシフィックの機長（marquee の7番目・¥3,700万 は SSOT の幅 ¥3,000万〜¥7,700万 の中）。
         ⚠️ 値は mqAmt() の有効数字2桁でそのまま出る粒度にしてある（1500→¥1,500万）。
       ★区分の色は lp.css の .lp-c-*（REAL PAY と同じ色）。 */
    hero: {
      /* 行 ＝ marquee の何番目か（i）＋ その行の報酬の内訳（見本）。
         区分が1つだけの行は棒も凡例も出さない（本物の cardCompHTML と同じ）。 */
      rows: [
        { i: 0, parts: [['base', 56], ['variable', 26], ['bonus', 18]] },
        { i: 1, parts: [['base', 62], ['variable', 22], ['bonus', 16]] },
        { i: 2, parts: [['base', 71], ['variable', 29]] },
        { i: 3, parts: [['base', 58], ['variable', 30], ['bonus', 12]] },
        { i: 4, parts: [['base', 60], ['variable', 24], ['bonus', 16]] },
      ],
      rp: { on: 6 },
      detail: {
        parts: [['base', 57], ['variable', 27], ['bonus', 16]],
        band: { base: [2000, 2200], variable: [900, 1100], bonus: [500, 700] },
      },
    },
  };

  /* ── 計測（GA4。既存の gtag をそのまま使う。新しい業者は入れない）──────── */
  var fired = {};
  function ev(name, params) {
    if (typeof w.gtag !== 'function') return;
    try { w.gtag('event', name, params || {}); } catch (e) {}
  }
  function evOnce(name, params) {
    if (fired[name]) return;
    fired[name] = 1;
    ev(name, params);
  }

  function wireEvents() {
    // クリック系：data-pv-ev="イベント名"
    d.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-pv-ev]') : null;
      if (el) ev(el.getAttribute('data-pv-ev'), { link_url: el.getAttribute('href') || '' });
    }, { passive: true });

    // 表示系：data-pv-view="イベント名"（IntersectionObserver は1個を共有する）
    var targets = d.querySelectorAll('[data-pv-view]');
    if (!targets.length) return;
    if (!('IntersectionObserver' in w)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        evOnce(en.target.getAttribute('data-pv-view'));
        io.unobserve(en.target);
      });
    }, { threshold: 0.25 });
    targets.forEach(function (t) { io.observe(t); });
    // Hero の検索欄は廃止した（ヘッダーの検索アイコン search.js #pv-search-btn が担う）。
    // airline_search イベントもそちらに一本化する。
  }

  /* ── ❽ Pilot Voices：reviews_v2 の実データ。本文が空の行は出さない。 ─────
     ふだんの見出しは review-i18n.js が日英で持っている。ここの表は
     review-i18n.js が読めなかったときの控え（同じ語を2か所に書かないため T から引く）。 */
  var VOICE_LABEL = T.voice;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function clip(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  /* 星の平均。式は airlines/airline-reviews-ui.js:631 の mapV2() と同じにする（0と空を除いた平均）。
     ⚠️ mapV2 は空のとき 3 を既定値にするが、ここでは null を返す。
        トップページで「投稿が無いのに★★★」を出さないため。 */
  var V2_CAT_KEYS = ['culture_score', 'salary_score', 'benefits_score',
                     'wlb_score', 'ops_score', 'training_score'];

  function avgScore(r) {
    var s = V2_CAT_KEYS.map(function (k) { return r[k]; })
                       .filter(function (v) { return v > 0; });
    if (!s.length) return null;
    return +(s.reduce(function (a, b) { return a + b; }, 0) / s.length).toFixed(1);
  }

  // 星の文字列も既存と同形（en/airlines/en-airline-reviews.js:72）
  function stars(avg) {
    var n = Math.round(avg);
    if (n < 0) n = 0; if (n > 5) n = 5;
    // 星の並びは読み上げに要らない（「星星星星白星」と読まれる）。数字だけを読ませる。
    return '<span class="pv-voice-stars">' +
             '<i aria-hidden="true">' + '★'.repeat(n) + '☆'.repeat(5 - n) + '</i>' +
             '<b><span class="pv-sr">' + esc(T.rating) + '</span>' + avg.toFixed(1) + '<span class="pv-sr"> / 5</span></b>' +
           '</span>';
  }

  function voiceCard(cat, text, meta, translated, avg) {
    return '<article class="pv-card pv-voice">' +
      '<div class="pv-voice-head">' +
        '<span class="pv-voice-cat">' + esc(cat) + '</span>' +
        // 6項目とも空の投稿には星を出さない（既定値で埋めない）
        (avg == null ? '' : stars(avg)) +
      '</div>' +
      '<p class="pv-voice-body">' + esc(text) + '</p>' +
      '<div class="pv-voice-meta">' + esc(meta) +
        (translated ? T.sep + '<span style="color:var(--pv-accent-ink)">' + esc(T.autoTr) + '</span>' : '') +
      '</div>' +
    '</article>';
  }

  function emptyVoices(grid) {
    grid.className = 'pv-card';
    grid.innerHTML =
      '<h3 class="pv-h3" style="font-size:.95rem">' + esc(T.emptyT) + '</h3>' +
      '<p class="pv-step-d" style="margin-top:8px">' + esc(T.emptyD) + '</p>';
  }

  /* ★ reviews_v2 を直に読まない。本文の列は DB 側で anon から外してあり
     （db/reviews-gate.sql）、トップの抜粋だけは pv_review_voices() が
     **新しい6件・1欄あたり80字まで**に切って返す。
     ここはオーナーが「今のまま開けておく」と決めた唯一の穴。
     ⚠️ 件数も字数も画面側で広げない（決めているのはサーバの数字1つ）。
        今までは30件ぶんの**全文**が誰にでも返っていたので、穴は今より小さい。
     ★2026-09-23：ヒーローの流れる帯（fillReviewMq）と下の節（fillVoices）で**同じ1回**を
       分け合う。ここで Promise を持っておく＝通信は今までと同じ1本のまま。 */
  var VOICES_P = null;
  function voices() {
    if (!VOICES_P) VOICES_P = rest('rpc/pv_review_voices').then(function (rows) { return rows || []; });
    return VOICES_P;
  }

  /* 1件を画面に出す形（区分・抜粋・社名/職位/在籍/投稿年月・星）に直す。出せない行は null。
     ⚠️ 足切り（本文のある欄の最初の1つが、空白を除いて20字以上）は
        db/reviews-gate.sql の pv_review_voices と同じ条件。片方だけ緩めない。 */
  function voiceRow(r) {
    var body = (w.PVReviewI18n && w.PVReviewI18n.pick) ? w.PVReviewI18n.pick(r) : null;
    var cat, text, translated = false;
    if (body && body.cats && body.cats.length) {
      cat = body.cats[0].label;
      text = body.cats[0].text;
      translated = !!body.translated;
    } else {
      // review-i18n.js が無い場合のフォールバック（原文のいちばん長い欄）
      var picked = null;
      Object.keys(VOICE_LABEL).forEach(function (k) {
        var v = r[k + '_comment'];
        if (v && (!picked || v.length > picked.text.length)) picked = { label: VOICE_LABEL[k], text: v };
      });
      if (!picked) return null;
      cat = picked.label; text = picked.text;
    }
    if (!text || text.replace(/\s/g, '').length < 20) return null;   // 空カードを出さない
    // DB が持っているのは符号（ana / captain / 10-15）。そのまま出すと符号が画面に見えるので言葉に直す。
    var meta = [r.airline ? airlineName(r.airline, r.airline) : '',
                POS_LABEL[r.position] || r.position || '',
                TENURE_LABEL[r.tenure_bucket] || r.tenure_bucket || '',
                r.created_at ? r.created_at.slice(0, 7).replace('-', '.') : '']
               .filter(Boolean).join(T.sep);
    return { cat: cat, text: clip(text, 80), meta: meta, translated: translated, avg: avgScore(r) };   // §10：3〜4行で切る
  }

  function fillVoices() {
    var grid = d.getElementById('voices-grid');
    if (!grid) return;

    voices().then(function (rows) {
      var cards = [];
      rows.forEach(function (r) {
        if (cards.length >= 4) return;   // §10：デスクトップ1行に収める（6件・2行だと縦に伸びる）
        var v = voiceRow(r);
        if (v) cards.push(voiceCard(v.cat, v.text, v.meta, v.translated, v.avg));
      });

      if (!cards.length) { emptyVoices(grid); return; }
      // 4列グリッドの見た目が崩れないよう、件数が少ないときは列数を落とす
      grid.className = 'pv-grid ' + (cards.length <= 2 ? 'pv-grid-2' : cards.length === 3 ? 'pv-grid-3' : 'pv-grid-4');
      grid.innerHTML = cards.join('');
      evOnce('pilot_voices_filled', { count: cards.length });
    });
  }

  /* ── ❾-2 ヒーローの口コミの帯（★2026-09-23 オーナー指示「口コミも同じようなカードで
     下に逆回りで流れるようにして」）─────────────────────────────────
     ★中身は本物の投稿。年収の帯（PV_DEMO のサンプル）とは出どころが違う。
     ★古い順に流す＝最初に目に入るカードが、下の #pilot-voices の4枚と別になる。
     ★逆回りは CSS（animation-direction:reverse）。ここではタイマーを持たない。 */
  /* ★2026-09-23 追加指示「カードの口コミには星出して」── 下の #pilot-voices と**同じ star()**
     を呼ぶ（星の形も「4.5 / 5」の読み上げも1か所。ここで書き写さない）。
     ⚠️ 6項目とも空の投稿は avg が null。そのときは星を出さない（既定値の3で埋めない）。
     ⚠️ stars() は <span>/<i>/<b> だけを返す＝<a> の中に入れてよい（<article> や <p> は入れない）。 */
  function rvCard(v, dup) {
    // 2周目は読み上げとタブ移動から外す（同じカードが2回読まれるのを防ぐ）
    var dupAttr = dup ? ' aria-hidden="true" tabindex="-1"' : '';
    /* 飛び先は口コミの一覧（community.html）で固定する。DB の社名の綴りが airlines/ に
       無いことがあり、会社ページへ送ると 404 になる（年収の帯は SSOT の slug なので送れる）。 */
    return '<a class="hero-mq-c hero-rv-c" href="community.html"' + dupAttr + ' data-pv-ev="hero_rv_card">' +
      '<span class="hero-rv-head">' +
        '<span class="pv-voice-cat">' + esc(v.cat) + '</span>' +
        (v.avg == null ? '' : stars(v.avg)) +
      '</span>' +
      '<span class="hero-rv-body">' + esc(v.text) + '</span>' +
      '<span class="hero-rv-meta">' + esc(v.meta) + (v.translated ? T.sep + esc(T.autoTr) : '') + '</span>' +
    '</a>';
  }

  function fillReviewMq() {
    var mq = d.getElementById('hero-rv'), track = d.getElementById('hero-rv-track');
    if (!mq || !track) return;
    voices().then(function (rows) {
      var vs = [];
      rows.forEach(function (r) { var v = voiceRow(r); if (v) vs.push(v); });
      vs.reverse();   // 古い順

      // 投稿がまだ無いとき。空のまま畳むと下が跳ねるので、1枚だけ置いて止める。
      if (!vs.length) {
        track.style.animation = 'none';
        track.innerHTML = '<div class="hero-mq-c hero-rv-c hero-rv-c--empty">' +
          '<span class="hero-rv-t">' + esc(T.emptyT) + '</span>' +
          '<span class="hero-rv-body">' + esc(T.emptyD) + '</span></div>';
        return;
      }

      var one = function (dup) { return vs.map(function (v) { return rvCard(v, dup); }).join(''); };
      /* 1周ぶんが帯の幅に足りないと、流れている途中に何も無い所ができる。足りるまで並びを繰り返す。
         （年収の帯はカードが14枚あって必ず足りるので、この処理を持っていない） */
      track.innerHTML = one(false);
      var pass = track.scrollWidth, reps = 1;
      while (pass > 0 && pass * reps < mq.clientWidth && reps < 8) reps++;
      var html = '', i;
      for (i = 0; i < reps; i++) html += one(false);
      for (i = 0; i < reps; i++) html += one(true);   // 2周目（-50% まで動かすと継ぎ目なく戻る）
      track.innerHTML = html;
      /* 流れる速さは年収の帯と同じ。★2026-09-23 オーナー指示「流れるの早すぎ。いまの速さの
         0.5 倍でいい」で 40px/s → **20px/s**（あちらは14枚 × 210px ÷ 148s ≒ 20px/s）。
         ⚠️ lp.css の .hero-mq-track の秒数を変えたら、この数字も同じ割合で直す。 */
      if (pass > 0) track.style.animationDuration = Math.round(pass * reps / 20) + 's';
      evOnce('hero_reviews_filled', { count: vs.length });
    });
  }

  /* ── ❾ Hero の流れる給与カード（Marit Health 型）─────────────────────
     ★PV_DEMO の中身を横一列に並べ、CSS の @keyframes hero-mq で左へ流す。
     JS はタイマーを持たない（transform を CSS に任せる。タブが裏に回れば止まる）。 */
  /* 帯の金額は「だいたいこのくらい」を出す所なので、どの通貨でも有効数字2桁まで丸める
     （¥4,000万 / $250K / €220K）。細かい端数が出ていると、見た人が自分の額と見比べて
     手を止める ── というのがオーナーの指摘（2026-09-16）。丸めるのは表示だけで、
     data-jpy には元の円をそのまま持たせてある＝通貨を替えても戻ってこられる。
     ⚠️ span に pv-no-cur を付けて currency.js の走査から外してある。外さないと
        あちらが ¥4,000万 を拾い直して $252K と細かく書き戻す。代わりに repaintMarquee()
        が pv-currency-change を受けて書き直す（salary-leveling.js と同じ作り）。 */
  function mqAmt(jpy) {
    if (w.PVCurrency && typeof w.PVCurrency.fmt === 'function') return w.PVCurrency.fmt(jpy, 2);
    return '¥' + Math.round(jpy / 10000).toLocaleString('en-US') + '万';   // currency.js が落ちたとき
  }

  function repaintMarquee() {
    // 流れるカード・ヒーローの見本の画面・REAL PAY の節のカードの金額（どれも pv-no-cur ＋ data-jpy）。
    var els = d.querySelectorAll('#hero-mq-track .hero-mq-amt, #hero-section .pv-no-cur[data-jpy], #lp-realpay .pv-no-cur[data-jpy]');
    for (var i = 0; i < els.length; i++) {
      els[i].textContent = mqAmt(parseInt(els[i].getAttribute('data-jpy'), 10));
    }
    /* ★112 の電話（比較のスライド）の額はここで塗らない。HTML に「¥2,556万」で書いてあり（日本語）・
         英語はドルの span で焼いてある ＝ 走査も塗り直しも currency.js がやる（会社ページ・比較の画面と同じ）。 */
    // ランキングの金額（公開データ。こちらも丸めない）。
    var ks = d.querySelectorAll('#ranking .pv-no-cur[data-jpy]');
    for (var k = 0; k < ks.length; k++) {
      ks[k].textContent = salAmt(parseInt(ks[k].getAttribute('data-jpy'), 10));
    }
  }

  /* 公開年収の1つの値。見本ではないので丸めない（mqAmt の有効数字2桁を使わない）。
     日本語で円のときは「¥2,200万」。それ以外は今の通貨で（英語ページは円でも「万」を使わない）。 */
  function salAmt(jpy) {
    var C = w.PVCurrency;
    if (C && typeof C.fmt === 'function' && (L === 'en' || (typeof C.get === 'function' && C.get() !== 'JPY'))) return C.fmt(jpy);
    return '¥' + Math.round(jpy / 10000).toLocaleString('en-US') + '万';
  }

  function mqCard(row, dup) {
    var slug = row[0], man = row[1], brk = row[2], pos = row[3],
        fleet = row[4], years = row[5], base = row[6], name = row[7];
    var jpy = man * 10000;
    // 2周目は読み上げとタブ移動から外す（同じカードが2回読まれるのを防ぐ）
    var dupAttr = dup ? ' aria-hidden="true" tabindex="-1"' : '';
    /* ★2026-09-22 オーナー指示 ── カードを押したら、その会社のページへ飛ばす。
       2026-09-16〜09-22 のあいだは全カードを REAL PAY（actual-pay.html）へ送っていたが戻した。
       飛び先は日英で同じ相対パス（/ → airlines/、/en/ → en/airlines/ に解決される）。 */
    return '<a class="hero-mq-c" href="airlines/' + esc(slug) + '.html"' + dupAttr +
             ' data-pv-ev="hero_mq_card">' +
      '<span class="hero-mq-amt pv-no-cur" data-jpy="' + jpy + '">' + mqAmt(jpy) + '</span>' +
      '<span class="hero-mq-brk">' + esc(tw(brk)) + '</span>' +
      '<span class="hero-mq-role">' + esc(tw(pos)) + T.sep + esc(fleet) + '</span>' +
      // 日本語は配列が持っている呼び名をそのまま（帯が狭いので「全日本空輸（ANA）」まで要らない）。
      // 英語だけ airlines-meta.js の en を引く＝英語の社名表をここに二重に持たない。
      '<span class="hero-mq-air">' + esc(L === 'en' ? airlineName(slug, name) : name) + '</span>' +
      '<span class="hero-mq-meta">' + esc(T.mqMeta(tw(years), tw(base))) + '</span>' +
    '</a>';
  }

  function fillMarquee() {
    var track = d.getElementById('hero-mq-track');
    if (!track) return;
    var rows = PV_DEMO.marquee;
    // 同じ配列を2周ぶん入れて -50% まで動かす＝継ぎ目なしでループする。
    var html = rows.map(function (r) { return mqCard(r, false); }).join('') +
               rows.map(function (r) { return mqCard(r, true); }).join('');
    track.innerHTML = html;
  }

  /* ── ❿ ヒーローの右：REAL PAY の見本の画面（2026-09-22）──────────────────
     ★全部 PV_DEMO（サンプル）。本物の投稿は1件も読まない・出さない。
       小さい会社で「会社名＋時期」が出ると、書いた本人が推測されるため（オーナー）。
     ★投稿時期・Verified・本人申告の札・錠前は付けない（見本に「確認済み」は嘘になる）。
       ⚠️ ここは 2026-09-23 に中身を厚くしたときも足していない。本物のカードには出るが、
          **信用の印を偽造しない**（index.html の同じ約束）。
     ★HTML には灰色の棒の行が4本あり、同じ高さ（66px）の行に描き替える＝ガタつかない。
     ★1行＝4段（ロゴ／社名・年収／職位・機種・年数／内訳の棒／凡例と月あたり）。
       置き場所は lp.css がクラスで決める（grid-area）。ここで並べ替えても見た目は変わらない。
     ★人数は出さない（2026-09-24 オーナー指示で「多くのパイロットが」に変わった）。
       pv_pay_rows() は呼ばない＝このトップは本物の投稿を1件も読まない。 */
  function heroLogo(slug, name) {   // 112 の電話も同じ見た目のロゴを使う（lp.css が両方の節に当てる）
    var ext = (w.PV_LOGOS || {})[slug];
    if (ext) {
      // alt="" ＝ 社名がすぐ隣に文字で出るので、読み上げが二重にならないように。
      return '<img class="hero-win-logo" src="' + esc(LOGO_BASE + slug + '.' + ext) + '"' +
             ' alt="" width="30" height="30" decoding="async"/>';
    }
    var ini = String(name || '').replace(/[^0-9A-Za-z\u3040-\u30ff\u4e00-\u9fff]/g, '').slice(0, 2).toUpperCase() || '·';
    return '<span class="hero-win-logo hero-win-mono" aria-hidden="true">' + esc(ini) + '</span>';
  }

  /* 色の棒。区分ごとの割合を flex の伸び率で置く（style に % を書かない＝本物と同じ作法）。 */
  function heroBar(cls, parts) {
    return '<span class="' + cls + '" aria-hidden="true">' + parts.map(function (p) {
      return '<i class="lp-c-' + p[0] + '" style="flex:' + p[1] + ' 1 0"></i>';
    }).join('') + '</span>';
  }

  /* 見本の機材の呼び名を、本物の画面の呼び名にする（actual-pay.js の fleetName ＝ pv-vocab.json の fleets の
     カッコより前）。PV_DEMO は短い記号（B777）で持っているので、ここで1回だけ引き直す。載っていない記号はそのまま。 */
  var FLEET = {
    B777: 'Boeing 777', B787: 'Boeing 787 Dreamliner', B737: 'Boeing 737',
    A350: 'Airbus A350', A330: 'Airbus A330', A380: 'Airbus A380',
    A320: L === 'en' ? 'A320 family' : 'A320ファミリー',
  };
  function fleetReal(c) { return FLEET[c] || c; }
  // 職位も本物の呼び名（「機長（CAP）」）。辞書に無い語は今までどおり tw() に任せる。
  function posReal(p) { return T.pos[p] || tw(p); }
  // 本物の画面の区切り（actual-pay.js は日英とも「 · 」）。トップのほかの所（' ・ '）とは別に持つ。
  var DOT = ' · ';

  /* ★カードの下の段（内訳のミニ棒＋凡例）。本物の REAL PAY のカード（actual-pay.js の cardCompHTML）と同じ約束 ──
       ・いちばん大きい区分を**1つだけ**名指しし、残りは「ほか◯区分」と数える
       ・区分が2つ未満のときは棒も凡例も出さない
     ★2026-11-01、月あたりは外した（本物のカードは狭い幅で伏せている。年収 ÷ 12 で新しい情報が無いため）。 */
  function heroComp(parts) {
    if (!parts || parts.length < 2) return '';
    var top = 0;
    for (var k = 1; k < parts.length; k++) { if (parts[k][1] > parts[top][1]) top = k; }
    var rest = parts.length - 1;
    return '<span class="hero-c-vf">' + heroBar('hero-c-cb', parts) +
      '<span class="hero-c-cbl">' +
        '<span class="hero-c-cbi"><i class="lp-c-' + parts[top][0] + '" aria-hidden="true"></i>' +
          esc(T.seg[parts[top][0]]) + ' <b>' + parts[top][1] + '%</b></span>' +
        '<span class="hero-c-cbm">' + esc(T.cbMore.replace('{n}', function () { return String(rest); })) + '</span>' +
      '</span></span>';
  }

  /* ★ヒーローの電話の1枚（2026-11-01・本物の REAL PAY のスマホのカードの形）。
       上の段 ＝ ロゴ・社名 ｜「年収」・額 ｜ ›（2段ぶん）／ 2段目 ＝ 職位 · 機材 ／ 3段目 ＝ 内訳の棒と凡例。
     ★出典の札・投稿時期は出さない（見本。本物のプレビューの行と同じ）。
     ⚠️ 高さは lp.css の .hero-card が 76px で固定している（灰色の骨組みと同じ ＝ 描き替えても跳ねない）。 */
  function heroRow(row) {
    var r = PV_DEMO.marquee[row.i];
    var slug = r[0], jpy = r[1] * 10000;
    var name = airlineName(slug, r[7]);
    return '<div class="hero-card">' +
      '<span class="hero-c-air">' + heroLogo(slug, name) + '<span class="hero-c-an">' + esc(name) + '</span></span>' +
      '<span class="hero-c-amt"><span class="hero-c-cl">' + esc(T.thAmt) + '</span>' +
        '<span class="hero-c-v pv-no-cur" data-jpy="' + jpy + '">' + esc(mqAmt(jpy)) + '</span></span>' +
      '<span class="hero-c-go" aria-hidden="true">›</span>' +
      '<span class="hero-c-pos">' + esc(posReal(r[3])) + '<span class="hero-c-flt">' + esc(fleetReal(r[4])) + '</span></span>' +
      heroComp(row.parts) +
    '</div>';
  }

  function fillHero() {
    var box = d.getElementById('hero-win-rows');
    if (box) box.innerHTML = PV_DEMO.hero.rows.map(heroRow).join('');

    /* ★人数は出さない（2026-09-24 オーナー指示）。ここで pv_pay_rows() を呼んで
       stats.contributors を入れ、is-wait を外していた。文は HTML に書いてあるだけになった。 */
  }

  /* ── ⓫ REAL PAY の節：白いカード（行を押すと出る面の見本）──────────────────
     ★2026-11-01、本物の面（actual-pay.js の dwHTML）と同じ並びにした ──
       ロゴ・社名・「サンプル」の札 ／ 職位 · 機材 · 年数 ／ 年収と月あたりの2つの箱 ／ 報酬の内訳（棒・注記・区分ごとの帯と％）。
     ★全部 PV_DEMO（サンプル）。出典（Verified・本人申告）と投稿時期は出さない（本物のプレビューの面と同じ）。
     ★金額は必ず帯（◯〜◯）で出す。1つの数字にしない ── 本物は匿名化された帯でしか出さない。
       帯は span を**2つ**に分ける（repaintMarquee() は1要素＝1金額で塗り替える）。
     ⚠️ 金額は HTML に書かない（ここで描く）。check-salary.mjs の照合に見本を入れないため。 */
  function fillRealPay() {
    var H = PV_DEMO.hero;
    // ⚠️ marquee を直に引く（rows の長さに巻き込まれない）。無ければ何も描かずに戻る。
    var on = PV_DEMO.marquee[H.rp.on];
    var box = d.getElementById('lp-rp-body');
    if (!on || !box) return;
    var slug = on[0], jpy = on[1] * 10000, mon = Math.round(jpy / 12);
    var name = airlineName(slug, on[7]);
    var parts = H.detail.parts, band = H.detail.band || {};
    var nameEl = d.getElementById('lp-rp-name');
    if (nameEl) nameEl.innerHTML = heroLogo(slug, name) + '<span class="lp-rp-an">' + esc(name) + '</span>';
    box.innerHTML =
      '<p class="lp-rp-meta">' + esc(posReal(on[3]) + DOT + fleetReal(on[4]) + DOT + T.ten(tw(on[5]))) + '</p>' +
      '<div class="lp-rp-amts">' +
        '<div class="lp-rp-a"><span class="lp-rp-al">' + esc(T.dwYear) + '</span>' +
          '<span class="lp-rp-av pv-no-cur" data-jpy="' + jpy + '">' + esc(mqAmt(jpy)) + '</span></div>' +
        '<div class="lp-rp-a"><span class="lp-rp-al">' + esc(T.dwMonth) + '</span>' +
          '<span class="lp-rp-av pv-no-cur" data-jpy="' + mon + '">' + esc(mqAmt(mon)) + '</span></div>' +
      '</div>' +
      '<p class="lp-rp-h">' + esc(T.dwComp) + '</p>' +
      heroBar('lp-rp-bar', parts) +
      '<p class="lp-rp-stn">' + esc(T.openNote) + '</p>' +
      '<ul class="lp-rp-list">' + parts.map(function (p) {
        var b = band[p[0]], lo = b ? b[0] * 10000 : 0, hi = b ? b[1] * 10000 : 0;
        return '<li><span class="lp-rp-k"><i class="lp-c-' + p[0] + '" aria-hidden="true"></i>' + esc(T.seg[p[0]]) + '</span>' +
          // 帯を持たない区分は金額だけ黙って出さない（0 で埋めない）。
          '<span class="lp-rp-v">' + (b ?
            '<span class="pv-no-cur" data-jpy="' + lo + '">' + esc(mqAmt(lo)) + '</span>' + esc(T.dash) +
            '<span class="pv-no-cur" data-jpy="' + hi + '">' + esc(mqAmt(hi)) + '</span>' : '') +
            '<span class="lp-rp-sh">' + p[1] + '%</span></span></li>';
      }).join('') + '</ul>';
  }

  /* ── ⓬ 112 AIRLINES の節：掲載社数の数字と、比較のスライド ─────────────────────
     ★同じ salary-data.json の社数で [data-pv-n="airlines"] を上書きする。HTML の数字は JS を動かさない
       読み手のための控えで、assert-claims.mjs が SALARY の社数と照合している。
       PVLeveling.load() は1回だけ取りに行って使い回す（下のレベリング図と同じ約束＝通信は増えない）。
     ★2026-11-01、電話の中身を「機長の公開年収レンジ」の一覧から、本物の2社比較の画面のスライドに替えた
       （オーナー「比較の画面はスライドできる（クリックしたらその比較画面になる）」）。
       スライドの中身（社名・額・棒・写真・クレジット）は gen-lp-compare.mjs が career.html から写して HTML に書く。
       ここは送るだけ（‹ › と点・いまの組の名前・クレジットの出し分け）。額を JS に持たない。 */
  function fillAirlines() {
    var marks = d.querySelectorAll('[data-pv-n="airlines"]');
    if (!marks.length) return;
    if (!w.PVLeveling || typeof w.PVLeveling.load !== 'function') return;   // 控えの数字のまま（推測で埋めない）
    w.PVLeveling.load().then(function (SAL) {
      var n = Object.keys((SAL && SAL.airlines) || {}).length;
      if (n > 0) for (var k = 0; k < marks.length; k++) marks[k].textContent = String(n);
    }).catch(function () {});
  }

  /* 比較のスライド。★指で横に滑らせる（scroll-snap ── ブラウザがやる）＋ ‹ › と点で送る。勝手には動かさない。
     いま見えている1枚は、横の送り位置から決める（送った・滑らせた・Tab で入ったのどれでも同じ1か所）。
     クレジットは見えている組の写真のぶんだけ出す（写真の条件は「その写真のそばに示す」）。 */
  function wireCompare() {
    var track = d.getElementById('lp-cmp-track');
    if (!track) return;
    var slides = track.querySelectorAll('.lp-cmp-s');
    var n = slides.length;
    if (n < 2) return;
    var dots = d.querySelectorAll('#lp-cmp-nav .lp-cmp-dot');
    var label = d.getElementById('lp-cmp-now');
    var prev = d.getElementById('lp-cmp-prev'), next = d.getElementById('lp-cmp-next');
    var credits = d.querySelectorAll('#lp-cmp-credits [data-slide]');
    var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var cur = -1;
    function at() {
      var wd = track.clientWidth || 1;
      return Math.max(0, Math.min(n - 1, Math.round(track.scrollLeft / wd)));
    }
    function paint(i) {
      if (i === cur) return;
      cur = i;
      for (var k = 0; k < dots.length; k++) {
        if (k === i) dots[k].setAttribute('aria-current', 'true'); else dots[k].removeAttribute('aria-current');
      }
      if (label) label.textContent = slides[i].getAttribute('data-pair') || '';
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === n - 1;
      for (var c = 0; c < credits.length; c++) {
        credits[c].hidden = credits[c].getAttribute('data-slide').split(' ').indexOf(String(i)) < 0;
      }
      var any = false;
      for (var e = 0; e < credits.length; e++) if (!credits[e].hidden) { any = true; break; }
      var box = d.getElementById('lp-cmp-credits');
      if (box) {
        box.hidden = !any;
        // 頭の字（英語は Photo / Photos）は、見えているクレジットの数で選ぶ（字は HTML に2つ在る ── 作らない）。
        var shown = 0;
        for (var g = 0; g < credits.length; g++) if (!credits[g].hidden) shown++;
        var h1 = box.querySelector('[data-n="1"]'), h2 = box.querySelector('[data-n="2"]');
        if (h1) h1.hidden = shown !== 1;
        if (h2) h2.hidden = shown === 1;
      }
    }
    /* ★‹ › で送っている途中は、行き先（aim）を覚えておく。途中の位置で点や名前を塗り直さない・
         続けて押したら行き先から数える（速く2回押すと1枚ずつ確実に進む）。着いたら（または 1.2 秒で）忘れる。 */
    var aim = -1, aimT = 0;
    function go(i) {
      i = Math.max(0, Math.min(n - 1, i));
      aim = i;
      clearTimeout(aimT);
      aimT = setTimeout(function () { aim = -1; paint(at()); }, 1200);
      track.scrollTo({ left: i * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
      paint(i);
    }
    var raf = 0;
    track.addEventListener('scroll', function () {
      if (raf) return;
      raf = (w.requestAnimationFrame || setTimeout)(function () {
        raf = 0;
        if (aim >= 0) {
          if (Math.abs(track.scrollLeft - aim * track.clientWidth) > 2) return;
          aim = -1; clearTimeout(aimT);
        }
        paint(at());
      });
    }, { passive: true });
    function base() { return aim >= 0 ? aim : at(); }
    if (prev) prev.addEventListener('click', function () { go(base() - 1); });
    if (next) next.addEventListener('click', function () { go(base() + 1); });
    for (var k = 0; k < dots.length; k++) {
      (function (i) { dots[i].addEventListener('click', function () { go(i); }); })(k);
    }
    // 幅が変わったら、いまの1枚の頭へ合わせ直す（回転・ウィンドウの幅を変えたとき半端な位置で止めない）。
    w.addEventListener('resize', function () { if (cur >= 0) track.scrollLeft = cur * track.clientWidth; });
    paint(at());
  }

  /* ── ⓭ 航空会社別の年収ランキング（#ranking の棒グラフ）─────────────────
     ★数字の出どころは salary-data.json（SALARY から生成）の cap.avg / fo.avg だけ。
       HTML にも lp.css にも社名と金額を持たない＝SSOT を直せばここも変わる。
       前は index.html に5社ぶんを手書きしてあり、SSOT を更新しても取り残された。
     ⚠️ avg は公開情報からの推計。見出しの「（推定年収・公開情報）」を外さない。
        「平均」と書かない（DATA-PROVENANCE.md）。
     ★棒の色は airlines-meta.js のブランド色。ここで配色を発明しない。
       色を持たない社（SSOT 112 に対し meta は 108）は地の緑のまま出る。
     ★PVLeveling.load() は fillAirlines と同じ1回を使い回す＝通信は増えない。
     ⚠️ 金額は pv-no-cur ＋ data-jpy。currency.js の走査より後に描くので、
        あちらには任せられない（repaintMarquee が塗り直す）。 */
  /* ⚠️ 行数を変えたら lp.css の .lp-rk の min-height（＝先に取っておく高さ）も直す。
     直さないと、行が入った瞬間にカードが伸びて画面が跳ねる。 */
  var RANK_N = 6;

  function rankRows(SAL, key) {
    var all = (SAL && SAL.airlines) || {};
    return Object.keys(all).filter(function (sl) {
      return all[sl] && all[sl][key] && all[sl][key].avg > 0;
    }).sort(function (a, b) {
      return all[b][key].avg - all[a][key].avg;
    }).slice(0, RANK_N).map(function (sl, i) {
      var m = airlineMeta(sl);
      return {
        slug: sl, i: i, man: all[sl][key].avg,
        name: airlineName(sl, L === 'en' ? all[sl].en : all[sl].ja),
        flag: (m && m.flag) || '',
        color: m && /^#[0-9a-fA-F]{6}$/.test(m.color || '') ? m.color : null,
      };
    });
  }

  function rankHTML(rows) {
    if (!rows.length) return '';
    var top = rows[0].man;
    return rows.map(function (r) {
      var jpy = r.man * 10000;
      var pct = Math.max(8, Math.round(r.man / top * 100));
      // 濃い側＝ブランド色そのまま、薄い側＝同じ色の 53%（8桁hex の透明度）。新しい色を作らない。
      var sty = r.color ? ' style="--rk:' + r.color + ';--rk-s:' + r.color + '88"' : '';
      return '<a class="lp-rk-row" href="airlines/' + esc(r.slug) + '.html" data-pv-ev="lp_explore_rank_row"' + sty + '>' +
        '<span class="lp-rk-n' + (r.i < 3 ? ' lp-rk-n' + (r.i + 1) : '') + '">' + (r.i + 1) + '</span>' +
        '<span class="lp-rk-an">' + (r.flag ? '<span aria-hidden="true">' + esc(r.flag) + '</span> ' : '') + esc(r.name) + '</span>' +
        '<span class="lp-rk-amt pv-no-cur" data-jpy="' + jpy + '">' + esc(salAmt(jpy)) + '</span>' +
        '<span class="lp-rk-trk" aria-hidden="true"><i data-pct="' + pct + '"></i></span>' +
      '</a>';
    }).join('');
  }

  function fillRanking() {
    var cap = d.getElementById('rank-captain'), fo = d.getElementById('rank-fo');
    if (!cap || !fo) return;
    if (!w.PVLeveling || typeof w.PVLeveling.load !== 'function') return;   // 空のまま（数字を推測で埋めない）
    w.PVLeveling.load().then(function (SAL) {
      var a = rankHTML(rankRows(SAL, 'cap')), b = rankHTML(rankRows(SAL, 'fo'));
      if (!a || !b) return;
      cap.innerHTML = a;
      fo.innerHTML = b;
      rankAnim('rank-captain');
    }).catch(function () {});
  }

  /* 棒を 0 → 実寸へ。動かすのは transform だけ（幅は動かさない）。
     隠れている面（display:none）は遷移が走らないので、タブを切り替えた側から呼び直す
     ＝ index.html の switchRankTab() が PV_rankAnim を叩く。
     ⚠️ 時間で待たない。2回 rAF を挟んで「最初の描画が済んだ」ことを条件にする。 */
  function rankAnim(id) {
    var box = d.getElementById(id);
    if (!box) return;
    var bars = box.querySelectorAll('.lp-rk-trk i'), i;
    for (i = 0; i < bars.length; i++) { bars[i].style.transitionDelay = ''; bars[i].style.transform = 'scaleX(0)'; }
    var go = function () {
      for (var j = 0; j < bars.length; j++) {
        bars[j].style.transitionDelay = (j * 0.05) + 's';
        bars[j].style.transform = 'scaleX(' + (parseInt(bars[j].getAttribute('data-pct'), 10) / 100) + ')';
      }
    };
    if (typeof w.requestAnimationFrame !== 'function') { go(); return; }
    w.requestAnimationFrame(function () { w.requestAnimationFrame(go); });
  }
  w.PV_rankAnim = rankAnim;

  /* ── 開発時だけ：?pv_demo=live で実データ経路を目視する用のログ ─────────
     localhost 以外では何もしない（本番でURLを叩かれても動かない）。 */
  function devProbe() {
    if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
    if (location.search.indexOf('pv_demo=live') < 0) return;
    Promise.all([
      rest('pay_benchmarks?select=airline,position,fleet,n,median_usd&order=n.desc&limit=20'),
      rest('reviews_v2?select=id,airline,created_at&order=created_at.desc&limit=30'),
    ]).then(function (res) {
      console.log('[lp.js] pay_benchmarks:', res[0].length, res[0]);
      console.log('[lp.js] reviews_v2:', res[1].length);
    });
  }

  /* ── モバイル固定CTA：Hero を抜けたら出し、最後のCTAが見えたら引っ込める ──
     ヘッダーには入れられない（search.js のハンバーガーを押し出すため）。
     常時出しっぱなしにすると、下端のフッターと最後のCTAに被る。 */
  function mobileCta() {
    var bar = d.getElementById('pv-mcta');
    if (!bar || !('IntersectionObserver' in w)) return;
    var hero = d.getElementById('hero-section');
    var end = d.getElementById('final-cta');
    var seen = { hero: !!hero, end: false };

    function apply() {
      var on = !seen.hero && !seen.end;
      bar.classList.toggle('is-on', on);
      bar.setAttribute('aria-hidden', on ? 'false' : 'true');
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.target === hero) seen.hero = e.isIntersecting;
        if (e.target === end) seen.end = e.isIntersecting;
      });
      apply();
    }, { threshold: 0 });
    if (hero) io.observe(hero);
    if (end) io.observe(end);
    apply();
  }

  function boot() {
    wireEvents();
    fillMarquee();
    fillHero();
    fillRealPay();
    fillAirlines();
    wireCompare();
    fillRanking();
    // 金額は pv-no-cur ＝ currency.js の走査から外してある（mqAmt が自分で書く）ので、
    // 通貨の切替はここで受ける（流れるカード・ヒーローの見本・REAL PAY のカード・ランキング）。currency.js は
    // 「保存された通貨が非JPY」の初期表示でも同じ報せを出すので、戻ってきた人もこれ1本で拾える。
    w.addEventListener('pv-currency-change', repaintMarquee);
    fillVoices();
    fillReviewMq();   // ヒーローの口コミの帯。取りに行くのは fillVoices と合わせて1回だけ。
    mobileCta();
    devProbe();
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
