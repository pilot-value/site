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
  var L = (d.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('en') === 0 ? 'en' : 'ja';
  var T = {
    ja: {
      sep: ' ・ ',
      maskLock:  '🔒 記録して見る',
      maskAria:  '実際の給与を見る（給与を記録すると解放）',
      maskOpen:  '実際の給与',
      openT:     'モザイクは外れています。',
      openD:     '記録を更新すると、あなたの位置も一緒に新しくなります。',
      openBtn:   '記録を更新する',
      realOpenT: 'この表は、実際に記録された給与から作られています。',
      realOpenD: 'あなたの1件が、この数字の精度を上げます。記録は約30秒、表示は中央値だけです。',
      realLockT: '右の列のモザイクを外すには。',
      realLockD: '給与明細をアップするか、年収を手で入力すると外れます。表示するのは中央値だけです。',
      rating:    '評価 ',
      autoTr:    '自動翻訳',
      emptyT:    'まだ投稿が少ないです',
      emptyD:    'ここには現役・元パイロット本人の投稿だけを載せます。件数を水増ししたり、他サイトの口コミを転載したりはしません。',
      mqMeta: function (years, base) { return '経験 ' + years + ' ・ ' + base; },
      // REAL PAY の節の白いカード（報酬の内訳）の区分名。REAL PAY の行を開いた面と同じ呼び名。
      heroPart: { base: '基本給', variable: '変動給', bonus: '賞与・利益分配' },
      voice: { culture: '企業文化', salary: '給与', benefits: '福利厚生',
               wlb: 'WLB', ops: '運航環境', training: '訓練環境', mgmt: '経営陣への提案' },
    },
    en: {
      sep: ' · ',
      maskLock:  '🔒 Unlock',
      maskAria:  'See the actual pay — unlocks once you add yours',
      maskOpen:  'Actual pay',
      openT:     "You're in. The right-hand column is open.",
      openD:     'Update your record and your position moves with it.',
      openBtn:   'Update my record',
      realOpenT: 'These numbers come from pay pilots actually reported.',
      realOpenD: 'One more entry sharpens them. Takes about 30 seconds, and only the median is ever shown.',
      realLockT: 'To see the right-hand column.',
      realLockD: 'Drop in a payslip, or type your annual pay. Only the median is ever shown.',
      rating:    'Rating ',
      autoTr:    'Machine-translated',
      emptyT:    'Not many posts yet.',
      emptyD:    'Only working and former pilots post here. We never pad the count, and we never repost reviews from other sites.',
      mqMeta: function (years, base) { return years + ' · ' + base; },
      heroPart: { base: 'Base pay', variable: 'Variable (flying)', bonus: 'Bonus & profit share' },
      voice: { culture: 'Culture', salary: 'Pay', benefits: 'Benefits',
               wlb: 'WLB', ops: 'Operations', training: 'Training', mgmt: 'To management' },
    },
  }[L];

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

  /* 投稿フォームが保存するのは言語に依らない符号（captain / 10-15）。
     そのまま出すと日英どちらの画面でも符号が見えるので、ここで言葉に直す。 */
  var POS_LABEL = {
    ja: { captain: '機長', fo: '副操縦士', cadet: '訓練生' },
    en: { captain: 'Captain', fo: 'First Officer', cadet: 'Trainee' },
  }[L];
  var TENURE_LABEL = {
    ja: { '1-5': '1〜5年', '5-10': '5〜10年', '10-15': '10〜15年', '15-20': '15〜20年', '20+': '20年以上' },
    en: { '1-5': '1–5 yrs', '5-10': '5–10 yrs', '10-15': '10–15 yrs', '15-20': '15–20 yrs', '20+': '20+ yrs' },
  }[L];

  /* ══════════════════════════════════════════════════════════════
     ★PV_DEMO — 実在しないサンプル値。2026-08-11 のオーナー判断で、このまま公開する。

     Hero の帯と Actual Pay のモザイクには、本人の実投稿ではなくサンプルを使う。理由：
     ・Actual Pay の中央値は pay_benchmarks が 0件で、そもそも実在しない
     ・Hero に実在する個人の投稿を流す必要はない（＝本人記録は流さない）

     この形は「本人がアップした明細と引き換えに、誰も報告していない数字を見せる」ことになる。
     承知のうえで出す、というのがオーナーの判断（サンプル明示も本物への差し替えも見送り）。
     本物の投稿がたまったら pay_benchmarks 側が自動でここを上書きする（下の fillActualPay）。
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
       6行目は電話の切り口（緑の面の下端）で半分だけ見える＝「まだ下に続く」。
       on ＝ REAL PAY の節の白いカード（行を開いた面の見本）がどの行の内訳か。
       next ＝ そのカードの下端（緑の面の切り口）に半分だけ見える「次の行」。どちらも rows の何番目か。
       detail.parts は [区分, 割合%]。額は on の行の年収をそのまま使う（数字を2か所に持たない）。
       ★割合は帯の長さにだけ使い、数字としては出さない（REAL PAY の開いた面も％を出さない）。
       ★割合の合計は必ず 100。区分の色は lp.css の .lp-c-*（REAL PAY と同じ色）。 */
    hero: {
      rows: [0, 1, 2, 3, 5, 4],
      on: 1,
      next: 3,
      detail: { parts: [['base', 56], ['variable', 26], ['bonus', 18]] },
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

  /* ── 金額の書式（サイト標準の円表記。currency.js がここから変換する）──── */
  function manYen(jpy) {
    var man = Math.round(jpy / 10000);
    return '¥' + man.toLocaleString('en-US') + '万';
  }
  // pay_benchmarks は USD 建て。サイトの表示レート（currency.js の RATES）で円に直す。
  // currency.js より先に走ることがあるので、無ければ同じ既定値に落とす。
  function usdToJpy(usd) {
    var r = (w.PVCurrency && w.PVCurrency.rates && w.PVCurrency.rates.USD) || 158.95;
    return usd * r;
  }

  /* ここは「実額の年収」なので、給与明細を出した人だけに開く。
     pv_salary_unlock_expiry … pay-report.html が profiles.access_until（90日）から立てる。
     口コミの鍵（pv_unlock_expiry）では開かない。口コミは金額を集めていないので、
     それで年収まで見せると、出したものと返るものが釣り合わない。
     鍵は pv-session.js のログアウトで消え、pv-reunlock.js が入れ直す。 */
  function isUnlocked() {
    var v = 0;
    try { v = parseInt(w.localStorage.getItem('pv_salary_unlock_expiry') || '0', 10); } catch (e) { return false; }
    return !!(v && Date.now() < v);
  }

  /* ── ❸ Actual Pay：モザイクの開閉 ＋ pay_benchmarks の実測中央値 ────────
     右列は最初、★PV_DEMO のサンプル値にモザイクが掛かった状態で HTML に入っている。
     ここで（1）解放済みならモザイクを外し、（2）本物の中央値が来ていればセルごと差し替える。 */
  function fillActualPay() {
    var cells = d.querySelectorAll('[data-ap-slug]');
    if (!cells.length) return;

    // （1）解放済み：ぼかしを外して鍵の文言を消す。見た目の切替は CSS の .is-open が持つ。
    if (isUnlocked()) {
      var masks = d.querySelectorAll('#actual-pay .pv-mask');
      masks.forEach(function (a) {
        a.classList.add('is-open');
        a.removeAttribute('href');          // 解放後はリンクにしない（飛び先が同じ記録ページなので）
        a.setAttribute('aria-label', T.maskOpen);
      });
      if (masks.length) evOnce('actual_pay_unlocked', { cells: masks.length });
      var ut = d.querySelector('#actual-pay .pv-fill-t');
      var ud = d.querySelector('#actual-pay .pv-fill-d');
      var ub = d.querySelector('#actual-pay .pv-fill .pv-btn');
      if (ut) ut.textContent = T.openT;
      if (ud) ud.textContent = T.openD;
      // 外れているのにボタンが「モザイクを外す」のままだと文言が食い違う。
      if (ub) ub.textContent = T.openBtn;
    }

    var cols = 'airline,position,fleet,period_year,n,median_usd';
    rest('pay_benchmarks?select=' + cols + '&order=n.desc&limit=500').then(function (rows) {
      // 1件も無ければ HTML の初期表示（★PV_DEMO のサンプル値＋モザイク）のまま。
      // 件数（あと○件）は出せない。pay_benchmarks は having count(*) >= 5 なので
      // 5件未満のコホートは行そのものが返らず、n=2 と n=0 の区別がつかない。
      if (!rows || !rows.length) return;
      var best = {};                        // 会社×職位ごとに、いちばん人数の多いコホートを採る
      rows.forEach(function (r) {
        var k = r.airline + '|' + r.position;
        if (!best[k] || r.n > best[k].n) best[k] = r;
      });

      // 本物が来た欄は、サンプル値を捨てて中央値で置き換える。
      // ただし未解放の人にはモザイクを掛けたままにする。表の上で
      // 「右の列は記録した人だけが見られます」と約束しているので、本物だけ素通しにしない。
      var open = isUnlocked();
      var shown = 0;
      cells.forEach(function (td) {
        var r = best[td.getAttribute('data-ap-slug') + '|' + td.getAttribute('data-ap-role')];
        if (!r || r.median_usd == null) return;
        var val = manYen(usdToJpy(+r.median_usd));
        var badge = ' <span class="pv-badge pv-badge--actual">' +
              (r.fleet ? String(r.fleet).toUpperCase() + ' / ' : '') + 'n=' + r.n + '</span>';
        td.innerHTML = open
          ? '<span class="pv-mask is-open"><span class="pv-mask-v">' + val + '</span></span>' + badge
          : '<a class="pv-mask" href="pay-report.html" data-pv-ev="actual_pay_mask_click"' +
              ' aria-label="' + esc(T.maskAria) + '">' +
              '<span class="pv-mask-v">' + val + '</span>' +
              '<span class="pv-mask-lock" aria-hidden="true">' + esc(T.maskLock) + '</span>' +
            '</a>' + badge;
        shown++;
      });
      // 後から入れた金額も通貨切替に追随させる（MutationObserver でも拾うが、初回のちらつきを避ける）。
      if (shown && w.PVCurrency && typeof w.PVCurrency.scan === 'function') {
        try { w.PVCurrency.scan(d.getElementById('actual-pay')); } catch (e) {}
      }
      if (shown) evOnce('actual_pay_filled', { rows: shown });
      // 全部の欄が本物になったら、表の下の文言も「サンプル前提」から実態に合わせる。
      if (shown === cells.length) {
        var ft = d.querySelector('#actual-pay .pv-fill-t');
        var fd = d.querySelector('#actual-pay .pv-fill-d');
        if (ft) ft.textContent = open ? T.realOpenT : T.realLockT;
        if (fd) fd.textContent = open ? T.realOpenD : T.realLockD;
      }
    });
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
        (translated ? T.sep + '<span style="color:var(--pv-orange-ink)">' + esc(T.autoTr) + '</span>' : '') +
      '</div>' +
    '</article>';
  }

  function emptyVoices(grid) {
    grid.className = 'pv-card';
    grid.innerHTML =
      '<h3 class="pv-h3" style="font-size:.95rem">' + esc(T.emptyT) + '</h3>' +
      '<p class="pv-step-d" style="margin-top:8px">' + esc(T.emptyD) + '</p>';
  }

  function fillVoices() {
    var grid = d.getElementById('voices-grid');
    if (!grid) return;

    /* ★ reviews_v2 を直に読まない。本文の列は DB 側で anon から外してあり
       （db/reviews-gate.sql）、トップの抜粋だけは pv_review_voices() が
       **新しい4件・1欄あたり80字まで**に切って返す。
       ここはオーナーが「今のまま開けておく」と決めた唯一の穴。
       ⚠️ 件数も字数も画面側で広げない（決めているのはサーバの数字1つ）。
          今までは30件ぶんの**全文**が誰にでも返っていたので、穴は今より小さい。 */
    rest('rpc/pv_review_voices').then(function (rows) {
      var cards = [];
      (rows || []).forEach(function (r) {
        if (cards.length >= 4) return;   // §10：デスクトップ1行に収める（6件・2行だと縦に伸びる）
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
          if (!picked) return;
          cat = picked.label; text = picked.text;
        }
        if (!text || text.replace(/\s/g, '').length < 20) return;   // 空カードを出さない
        // DB が持っているのは符号（ana / captain / 10-15）。そのまま出すと符号が画面に見えるので言葉に直す。
        var meta = [r.airline ? airlineName(r.airline, r.airline) : '',
                    POS_LABEL[r.position] || r.position || '',
                    TENURE_LABEL[r.tenure_bucket] || r.tenure_bucket || '',
                    r.created_at ? r.created_at.slice(0, 7).replace('-', '.') : '']
                   .filter(Boolean).join(T.sep);
        cards.push(voiceCard(cat, clip(text, 80), meta, translated, avgScore(r)));   // §10：3〜4行で切る
      });

      if (!cards.length) { emptyVoices(grid); return; }
      // 4列グリッドの見た目が崩れないよう、件数が少ないときは列数を落とす
      grid.className = 'pv-grid ' + (cards.length <= 2 ? 'pv-grid-2' : cards.length === 3 ? 'pv-grid-3' : 'pv-grid-4');
      grid.innerHTML = cards.join('');
      evOnce('pilot_voices_filled', { count: cards.length });
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
    // 112 の電話のレンジ（公開データ。丸めない）。
    var rs = d.querySelectorAll('#lp-airlines .pv-no-cur[data-jpy-lo]');
    for (var j = 0; j < rs.length; j++) {
      rs[j].textContent = rangeAmt(parseInt(rs[j].getAttribute('data-jpy-lo'), 10), parseInt(rs[j].getAttribute('data-jpy-hi'), 10));
    }
  }

  /* 公開年収のレンジ。★見本ではなく SSOT の値なので丸めない（mqAmt の有効数字2桁を使わない）。
     日本語で円のときは「¥2,200万〜3,500万」。それ以外は両端を今の通貨で（salary-leveling.js の
     fmtRange と同じ規約：英語ページは円でも「万」を使わない）。 */
  function rangeAmt(lo, hi) {
    var C = w.PVCurrency;
    if (C && typeof C.fmt === 'function' && (L === 'en' || (typeof C.get === 'function' && C.get() !== 'JPY'))) {
      return C.fmt(lo) + '–' + C.fmt(hi);
    }
    return '¥' + Math.round(lo / 10000).toLocaleString('en-US') + '万〜' + Math.round(hi / 10000).toLocaleString('en-US') + '万';
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
     ★HTML には灰色の棒の行が6本あり、同じ高さ（64px）の行に描き替える＝ガタつかない。
     ★1行＝2段（上：ロゴ・社名・年収／下：職位・機種・経験）。置き場所は lp.css が
       クラスで決める（grid-area）。ここで並べ替えても見た目は変わらない。
     人数だけは本物。pv_pay_rows() の stats.contributors を使う（左の板の「N / 100人」と同じ数）。
     ⚠️ あの関数は未ログインでも伏せた行を返すが、行は使わない・DOM に入れない。 */
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

  function heroRow(r) {
    var slug = r[0], jpy = r[1] * 10000, pos = r[3], fleet = r[4], years = r[5];
    var name = L === 'en' ? airlineName(slug, r[7]) : r[7];
    return '<div class="hero-win-row">' + heroLogo(slug, name) +
      '<span class="hero-win-an">' + esc(name) + '</span>' +
      '<span class="hero-win-amt pv-no-cur" data-jpy="' + jpy + '">' + esc(mqAmt(jpy)) + '</span>' +
      '<span class="hero-win-meta">' + esc(tw(pos) + T.sep + fleet + T.sep + tw(years)) + '</span>' +
    '</div>';
  }

  function fillHero() {
    var H = PV_DEMO.hero;
    var box = d.getElementById('hero-win-rows');
    if (box) {
      box.innerHTML = H.rows.map(function (i) { return heroRow(PV_DEMO.marquee[i]); }).join('');
    }

    // 人数（本物）。取れない・3人未満なら出さない（場所は取ったまま）。0 や推測で埋めない。
    var proof = d.getElementById('hero-proof');
    var num = d.getElementById('hero-proof-n');
    if (!proof || !num) return;
    rest('rpc/pv_pay_rows').then(function (res) {
      var n = res && res.stats ? res.stats.contributors : null;
      if (typeof n !== 'number' || !isFinite(n) || n < 3) return;
      num.textContent = n.toLocaleString('en-US');
      proof.classList.remove('is-wait');
    });
  }

  /* ── ⓫ REAL PAY の節：白いカード（行を開いた面の見本）──────────────────
     ★全部 PV_DEMO（サンプル）。社名は出さない。投稿時期・Verified・錠前も出さない。
     ★割合は帯の長さにだけ使う（数字の％は出さない）。 */
  function fillRealPay() {
    var H = PV_DEMO.hero;
    var on = PV_DEMO.marquee[H.rows[H.on]];
    var jpy = on[1] * 10000;
    var amt = d.getElementById('lp-rp-amt');
    if (!amt) return;
    amt.setAttribute('data-jpy', jpy);
    amt.textContent = mqAmt(jpy);
    var meta = d.getElementById('lp-rp-meta');
    if (meta) meta.textContent = tw(on[3]) + T.sep + on[4] + T.sep + tw(on[5]);
    var parts = H.detail.parts;
    var bar = d.getElementById('lp-rp-bar');
    if (bar) {
      bar.innerHTML = parts.map(function (p) {
        return '<i class="lp-c-' + p[0] + '" style="flex:' + p[1] + ' 1 0"></i>';
      }).join('');
    }
    var leg = d.getElementById('lp-rp-leg');
    if (leg) {
      leg.innerHTML = parts.map(function (p) {
        return '<li><i class="lp-c-' + p[0] + '"></i>' + esc(T.heroPart[p[0]]) + '</li>';
      }).join('');
    }
    var nx = PV_DEMO.marquee[H.rows[H.next]];
    var nm = d.getElementById('lp-rp-next-m');
    var na = d.getElementById('lp-rp-next-a');
    if (nm) nm.textContent = tw(nx[3]) + T.sep + nx[4] + T.sep + tw(nx[5]);
    if (na) { na.setAttribute('data-jpy', nx[1] * 10000); na.textContent = mqAmt(nx[1] * 10000); }
  }

  /* ── ⓬ 112 AIRLINES の節：電話の中の6社（本物の公開データ）──────────────
     ★salary-data.json（SALARY から生成）の cap.lo〜cap.hi。avg は使わない＝「平均」と書かない
       （avg は推計。公開資料が支えるのは lo〜hi だけ・DATA-PROVENANCE.md）。
     ★PVLeveling.load() は1回だけ取りに行って使い回す（下のレベリング図と同じ約束＝通信は増えない）。
     ★同じ JSON の社数で [data-pv-n="airlines"] を上書きする。HTML の「112」は JS を動かさない
       読み手のための控えで、assert-claims.mjs が SALARY の社数と照合している。
     棒は6社共通の目盛り（いちばん低い下限〜いちばん高い上限を 1,000万円で丸めた幅）。 */
  var AIR_SLUGS = ['ana', 'jal', 'emirates', 'delta', 'united', 'singapore-airlines'];

  function fillAirlines() {
    var box = d.getElementById('lp-air-rows');
    var marks = d.querySelectorAll('[data-pv-n="airlines"]');
    if (!box && !marks.length) return;
    if (!w.PVLeveling || typeof w.PVLeveling.load !== 'function') return;   // 灰色の行のまま（数字を推測で埋めない）
    w.PVLeveling.load().then(function (SAL) {
      var all = (SAL && SAL.airlines) || {};
      var n = Object.keys(all).length;
      if (n > 0) for (var k = 0; k < marks.length; k++) marks[k].textContent = String(n);
      if (!box) return;
      var rows = AIR_SLUGS.filter(function (sl) { return all[sl] && all[sl].cap && all[sl].cap.lo && all[sl].cap.hi; });
      if (!rows.length) return;
      var min = Infinity, max = 0;
      rows.forEach(function (sl) { min = Math.min(min, all[sl].cap.lo); max = Math.max(max, all[sl].cap.hi); });
      min = Math.floor(min / 1000) * 1000;
      max = Math.ceil(max / 1000) * 1000;
      var span = Math.max(1, max - min);
      box.innerHTML = rows.map(function (sl) {
        var c = all[sl].cap, lo = c.lo * 10000, hi = c.hi * 10000;
        var name = airlineName(sl, L === 'en' ? all[sl].en : all[sl].ja);
        var left = ((c.lo - min) / span * 100).toFixed(1);
        var wid = ((c.hi - c.lo) / span * 100).toFixed(1);
        return '<a class="lp-air-row" href="airlines/' + esc(sl) + '.html" data-pv-ev="lp_airlines_row">' +
          heroLogo(sl, name) +
          '<span class="lp-air-an">' + esc(name) + '</span>' +
          '<span class="lp-air-rng pv-no-cur" data-jpy-lo="' + lo + '" data-jpy-hi="' + hi + '">' + esc(rangeAmt(lo, hi)) + '</span>' +
          '<span class="lp-air-trk" aria-hidden="true"><i style="left:' + left + '%;width:' + wid + '%"></i></span>' +
        '</a>';
      }).join('');
    }).catch(function () {});
  }

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
    // 金額は pv-no-cur ＝ currency.js の走査から外してある（mqAmt が自分で書く）ので、
    // 通貨の切替はここで受ける（流れるカード・ヒーローの見本・REAL PAY のカード・112 の電話）。currency.js は
    // 「保存された通貨が非JPY」の初期表示でも同じ報せを出すので、戻ってきた人もこれ1本で拾える。
    w.addEventListener('pv-currency-change', repaintMarquee);
    fillActualPay();
    fillVoices();
    mobileCta();
    devProbe();
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
