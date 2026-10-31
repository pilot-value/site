/* career-live.js — 生きた欄（.crl[data-live]）をサーバーの答えで埋める。

   ・読むだけ。書き込む通信を1本も出さない。
   ・金額・待遇の鍵の名前・見本の口コミを、このファイルに書かない
     （鍵は欄の data-keys、答えの名前は #crl-vocab か pv-conditions.json、額はサーバーの答え）。
   ・取ってきた字は textContent で入れる（HTML として流し込む口を持たない）。
   ・REAL PAY はサーバーの資格のまま。鍵の無い人には値が来ない＝出せない。
     ★ 会社ページでは、鍵の無い行をぼかした板で見せる（オーナーのご指示 2026-10-06「ログインしてない人はぼかせ」）。
       板の中は最初から空 ── 置いた数字を霞ませているのではない。板の幅も固定（値や桁数から作らない）。
     機材で絞る口・並び替えを置かない。1行＝1人。
   ・口コミは実投稿だけ（見本を読み込まない）。読めない数に 0 を置かない。
   ・取りに行くのは、その欄が画面に出たとき。同じ答えはページの中で使い回す（pv_pay_rows() は1回）。

   欄の状態（data-state）: idle → loading → open／empty／locked／error／off
     empty ＝ 0件／locked ＝ 鍵が無い／error ＝ 通信が落ちた（やり直せる）／off ＝ サーバーに口がまだ無い
   career.js との約束: #cr の 'cr:show' と PVCareer.state()。まだ無くても、見えている欄から自分で動き出す。 */
(function (w, d) {
  'use strict';

  /* 会社ページ（主要5社）でも同じ欄を動かす。印は <body data-pv-glance="1">（gen-airline-glance.mjs が書く）。
     あちらは airlines/ の下に在るので、行き先だけ1つ上へ向ける（UP）。
     ⚠️ career.html では UP は空 ＝ 行き先の字は1文字も変わらない。 */
  var GL = !!d.body && d.body.getAttribute('data-pv-glance') === '1';
  var root = d.getElementById('cr') || (GL ? d.body : null);
  if (!root) return;
  var UP = GL ? '../' : '';

  var me = d.currentScript;
  var BASE = '';
  try { BASE = new URL('.', (me && me.src) || location.href).href; } catch (e) { BASE = ''; }

  /* actual-pay.html と同じ入口（公開の anon キー）。 */
  var SB_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  var SB_URL = 'https://vzgmnkrggrwtsrpqndsm.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6Z21ua3JnZ3J3dHNycHFuZHNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzkwOTcsImV4cCI6MjA5MDAxNTA5N30.wE4cJbqeYGCgn5ZvHd80hYWgQuySKvOMJMbsJWOvmtw';

  /* 口コミは古いコードでも入っている会社がある（airlines/airline-reviews-ui.js と同じ対）。 */
  var LEGACY = {
    'cathay-pacific': 'cathay', 'qatar-airways': 'qatar', 'singapore-airlines': 'singapore',
    'spring-japan': 'spring', 'alaska-airlines': 'alaska', 'british-airways': 'british',
    'turkish-airlines': 'turkish'
  };
  var SCORES = ['culture_score', 'salary_score', 'benefits_score', 'wlb_score', 'ops_score', 'training_score'];
  var TAIL = /[（(][^）)]*[）)]\s*$/;

  /* 言葉は <html lang> だけで決める（en で始まれば英語 ── pv-contrib.js・career-stay.js と同じ式。2026-10-24 WP-en-5）。
     ・下の日本語の表（T）の今までの字は1文字も変えていない（ほかの検査がその場で読んでいる ── assert-admin.mjs・assert-airline-glance.mjs・assert-career.mjs）。
       足したのは3つだけ：コードの中に直に在った字（並んだ答えの区切り「、」・年月の「年」「月」）を表へ移した list・ym と、数と単位のあいだ unitSp（日本語は空）。
     ・英語は T_EN。鍵も形も T と同じ（assert-career-live.mjs の en-words が見る）。英語のページでだけ、T_EN の下の1行で表を入れ替える。
     ・サーバーへ渡す言葉（口コミの要約の lang）・答えの名前（質問の台帳・職位と機材・会社の名前）も同じ LANG で選ぶ。 */
  var LANG = /^en(-|$)/i.test(d.documentElement.getAttribute('lang') || '') ? 'en' : 'ja';

  var T = {
    loading: '読み込み中',
    err: 'いま読み出せません',
    retry: 'やり直す',
    off: '準備中',
    none: '未取得',
    dash: '〜',
    list: '、',                                       // 並んだ答えの区切り（選べるだけ選ぶ質問で、最多が2つ以上のとき）
    unitSp: '',                                       // 数と単位のあいだ（日本語は詰める）
    ym: function (y, m) { return y + '年' + m + '月'; },

    annual: '年収',
    vfYes: '明細で確認済み',
    vfNo: '本人申告',
    far: '同じ会社・同じ職位の公開年収から大きく外れた金額です。',
    age: ['1ヶ月以内', '3ヶ月以内', '6ヶ月以内', '1年以内', 'それより前'],
    ten: {
      r: ['昇格後5年未満', '昇格後5〜10年', '昇格後10〜15年', '昇格後15〜20年', '昇格後20年以上'],
      s: ['在籍5年未満', '在籍5〜10年', '在籍10〜15年', '在籍15〜20年', '在籍20年以上']
    },
    payEmpty: 'まだ記録がありません',
    payCount: function (n) { return ['', String(n), '件の提出']; },
    payLock: '給与の提出で開きます',
    payExpired: '年収データの解放が切れています',
    payMore: function (n) { return '続きを見る（全' + n + '件）'; },
    payOpen: function (n) { return '提出された数字を見る（' + n + '件）'; },
    /* 年数ごとの年収の図（2026-10-29）。x ＝ 昇格後の年数の5段（行の札 ten.r と同じ区切り）・y ＝ 年収 */
    ydHead: '昇格後の年数ごとの年収',
    ydX: ['〜5年', '5〜10年', '10〜15年', '15〜20年', '20年〜'],
    ydXs: ['0', '5', '10', '15', '20〜'],   // 狭い1社の図だけ：段の区切りの位置に置く目盛（「年」は軸の名前へ ── ydAxisS）
    ydAxis: '昇格後の年数',
    ydAxisS: '昇格後の年数（年）',                         // 狭い1社の図の軸の名前（目盛が短い字のとき）
    ydNote: function (old) { return '1つの点が1件の提出です。' + (old ? '在籍年数しか無い古い提出（' + old + '件）は図に入れていません。' : ''); },
    ydFar: '公開年収から大きく外れた金額',
    /* 会社ページの年数の図に重ねる、その会社・その職位の幅（2026-10-30 オーナー）。額はサーバーの pv_company_pay の中央値・25%・75% */
    ydBand: ['25%', '中央値', '75%'],
    ydSep: ' · ',
    posPick: '職位を選ぶ',
    /* 比較の、会社ごとの年収の幅の棒（25%〜75%・まんなかの印が中央値） */
    rgHead: '年収の幅（25〜75%）',
    /* 月の給与の内訳（平均）。割合と月の平均額はサーバーの pv_company_comp の数のまま（ここで割らない・平均しない）。
       名前は給与フォームの区分の名前の写し（9つ・並びと鍵はサーバーと同じ） */
    dnHead: '月の給与の内訳（平均）',
    dnDef: function (from, to) { return '内訳を書いた給与の提出（給与の月が' + from + '〜' + to + '）から。金額は月の平均です。'; },
    dnSeg: { base: '基本給', guarantee: '保証手当・職務手当', variable: '変動給', command: '職位手当', role: '役割手当',
             perdiem: 'パーディアム', housing: '住宅手当', other: 'その他の現金', rest: 'その他・未分類' },
    payDef: 'REAL PAY と同じ一覧（直近24か月の提出）。月の支給額を年に直した額と、口コミに書かれた年収の両方が入っています。',
    medDef: function (from, to, floor) { return '中央値は、給与を提出した人ごとのまんなかの額から出しています（給与の月が' + from + '〜' + to + 'のもの・' + floor + '人以上の区分だけ）。口コミに書かれた年収と、登録前に預かった提出は入りません。'; },
    payGive: '匿名で給与を提出する',
    gg: 'Give & Get',
    payUnlock: ['全ての', '給与情報を', '解放する'],
    payTerms: '閲覧条件',
    payAll: 'REAL PAY で全部見る',
    login: 'ログイン',
    loginLock: 'ログインが必要です',            // 口コミの要約の欄だけが使う（集計の欄は使わない）
    loginPayLock: 'ログインと給与の提出で開きます',
    /* ログインも給与の提出も済んでいて、自分の会社への回答がまだ足りない人の1行と、答えるカード。
       要る数（need）と答えた数（have）は、サーバーが返した数（ここには書かない）。 */
    giveLock: function (need) { return '自分の会社に' + need + 'つ答えると開きます'; },
    giveHead: function (name) { return name + 'の待遇情報を、足りない情報から埋める'; },
    giveCount: function (have, need) { return 'あなたが答えた項目：' + have + '／' + need; },
    giveGo: '匿名で答える',

    /* 月の勤務の6項目。鍵と並びは db/work-months.sql の pv_work_view が返す形のまま */
    work: [
      { k: 'block_hours', name: '乗務時間', unit: '時間 / 月', u: '時間', fam: 'h' },
      { k: 'duty_hours', name: '勤務・拘束時間', unit: '時間 / 月', u: '時間', fam: 'h' },
      { k: 'work_days', name: '勤務日数', unit: '日 / 月', u: '日', fam: 'd' },
      { k: 'duty_days', name: '乗務日数', unit: '日 / 月', u: '日', fam: 'd' },
      { k: 'days_off', name: '公休日数', unit: '日 / 月', u: '日', fam: 'd' },
      { k: 'stay_nights', name: 'ステイ泊数', unit: '泊 / 月', u: '泊', fam: 'd' }
    ],
    workPos: [['cap', '機長'], ['fo', '副操縦士']],
    workEmpty: 'まだ集計がありません',
    /* 帯の軸の右端（目盛の基準）。時間 ＝ 240（1日8時間 × 30日 という物差し）。日・泊 ＝ 31（月の日数の最大）。会社の決まりを表す数字ではない。
       ★集まった値に合わせて伸び縮みさせない（会社どうしで帯の長さが比べられなくなる）。 */
    workMax: { h: 240, d: 31 },
    workCap: '帯と数字は、回答のまんなか半分の幅',
    workAxis: ['目盛は、時間が 0', '、日と泊が 0'],
    workOver: '目盛の外',
    noteHead: '会員の補足',
    noteWork: '月の勤務',
    noteMine: 'あなたの投稿',
    townHead: '人気の居住地',
    townWait: '確認待ち',
    townNo: '見送り',
    townEdit: '修正',
    townHeld: 'ログインなしで保存した回答があります。',

    revEmpty: '口コミはまだありません',
    revNone: '会員からの投稿はまだありません',       // 会社ページと比較で使う。同じページの「口コミ」のタブは海外の評判なども数えるので、言い分ける
    revNo: '評価未取得',                              // 会社ページ用。点数の付いた投稿がまだ無い（0点ではない）
    revPosts: function (n) { return '会員の投稿 ' + n + '件'; },    // 口コミ件数（点数の有無を問わず、投稿ぜんぶ）。評価件数（revRated）と同じ行に置かない
    revRated: function (n) { return n + '件の評価'; },
    sumHead: '口コミの要約',
    sumOvHead: 'まとめ',                              // 全体の傾向の段落の枠の見出し（2026-10-30）
    sumGood: '良い点',
    sumConcern: '気になる点',
    sumLock: '要約は口コミの投稿で開きます',
    sumAi: 'AI 要約',
    sumFrom: function (n) { return '会員の口コミ ' + n + '件から'; },
    sumWhen: function (d) { return d + ' 更新'; },
    sumFew: '口コミがまだ少ないため、要約はありません',
    sumNone: '口コミの要約は、まだありません',
    sumOff: '準備中',
    sumSrc: 'この要約のもとになった口コミを見る',
    revLock: '口コミの投稿で開きます',
    revGive: '匿名で口コミを書く',
    /* 比較の口コミの入口（口コミの鍵）。会社ページの概要の口コミの入口と同じ言葉（gen-airline-glance.mjs の RV_CTA.overview）。
       給与の入口（payUnlock）と混ぜない ── 開く鍵が別。 */
    revUnlock: ['口コミを', '解放する'],
    revAll: 'この会社の口コミを全部見る',

    factEmpty: 'まだ集計がありません',
    factNone: '集計なし',
    top: '最多',
    median: '中央値',
    split: '回答が分かれています',
    answered: function (n) { return '回答 ' + n + '人'; }
  };

  /* 英語の会社ページの字（2026-10-24 WP-en-5）。鍵・形・並びの長さは T と同じ。字でない値（鍵 k・fam・職位の符号・目盛の右端）も T と同じ。
     ・サイトに英語が在る字は、その写し ── REAL PAY（actual-pay.js の T.en：出典・投稿時期・年数の段・外れた額の1文・「読み出せません」・
       匿名で給与を追加）／ステイ先（career-stay.js の英語：準備中・ログイン・やり直す・あなたの投稿・確認待ち・見送り・修正）／
       「情報を追加」（pv-contrib.js の T.en：月の勤務の6項目の名前・預かりの見出し・年月）／会社ページの生成側（gen-airline-glance.mjs の
       WORDS.en：機長・副操縦士・月の勤務・匿名で答える・「Unlock reviews」・「Member posts」）／トップと会社ページの給与の Give & Get
       （premium-auth-lock.js の ggSalary「Unlock all pay data」）／運営の画面（admin-queue.js の英語：良い点・気になる点・回答の人数）／
       マイページ（en/profile.html：年収データの解放が切れた1行）／質問の部品（pv-conditions.js：匿名で口コミを書く）。
     ・新しい英語の字はオーナーの英語の一覧に載る（P12.86-3）。数は引数で入る（英語の字に数字を手で打たない）。 */
  var MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var T_EN = {
    loading: 'Loading',
    err: 'We cannot load this right now',
    retry: 'Try again',
    off: 'Not available yet',
    none: 'Not enough data',
    dash: '–',
    list: ', ',
    unitSp: ' ',
    ym: function (y, m) { return MONTHS_EN[m - 1] + ' ' + y; },

    annual: 'Annual',
    vfYes: 'Verified',
    vfNo: 'Self-reported',
    far: 'This figure is far outside the published range for this airline and position.',
    age: ['Within 1 month', 'Within 3 months', 'Within 6 months', 'Within a year', 'Over a year ago'],
    ten: {
      r: ['Under 5 yrs in rank', '5–10 yrs in rank', '10–15 yrs in rank', '15–20 yrs in rank', '20+ yrs in rank'],
      s: ['Under 5 yrs at airline', '5–10 yrs at airline', '10–15 yrs at airline', '15–20 yrs at airline', '20+ yrs at airline']
    },
    payEmpty: 'No submissions yet',
    payCount: function (n) { return ['', String(n), n === 1 ? ' submission' : ' submissions']; },
    payLock: 'Opens when you submit your pay',
    payExpired: 'Your pay-data access has ended',
    payMore: function (n) { return 'Show more (' + n + ' in total)'; },
    payOpen: function (n) { return 'See submitted figures (' + n + ')'; },
    ydHead: 'Annual pay by years in rank',
    ydX: ['<5 yrs', '5–10', '10–15', '15–20', '20+'],
    ydXs: ['0', '5', '10', '15', '20+'],
    ydAxis: 'Years in current rank',
    ydAxisS: 'Years in rank',
    ydNote: function (old) { return 'Each dot is one submission.' + (old ? ' ' + old + (old === 1 ? ' older submission' : ' older submissions') + ' with only years at the airline ' + (old === 1 ? 'is' : 'are') + ' not shown.' : ''); },
    ydFar: 'Far from the published pay range',
    ydBand: ['25th', 'Median', '75th'],
    ydSep: ' · ',
    posPick: 'Choose rank',
    rgHead: 'Pay range (25th–75th percentile)',
    dnHead: 'Monthly pay breakdown (average)',
    dnDef: function (from, to) { return 'From pay submissions with a breakdown (pay months ' + from + '–' + to + '). Amounts are monthly averages.'; },
    dnSeg: { base: 'Base pay', guarantee: 'Guarantee / duty pay', variable: 'Variable (flying)', command: 'Rank pay', role: 'Role pay',
             perdiem: 'Per diem', housing: 'Housing allowance', other: 'Other cash', rest: 'Other / unclassified' },
    payDef: 'Same list as REAL PAY (submissions from the last 24 months). It includes monthly pay converted to an annual figure and annual pay reported in reviews.',
    medDef: function (from, to, floor) { return 'The median uses one figure per pilot, that pilot’s own median (pay months ' + from + '–' + to + '; groups of ' + floor + ' or more only). Annual pay reported in reviews and submissions held before sign-up are not included.'; },
    payGive: 'Add your pay anonymously',
    gg: 'Give & Get',
    payUnlock: ['Unlock ', 'all ', 'pay data'],
    payTerms: 'Viewing terms',
    payAll: 'See all in REAL PAY',
    login: 'Log in',
    loginLock: 'You need to log in',
    loginPayLock: 'Opens when you log in and submit your pay',
    giveLock: function (need) { return 'Opens when you answer ' + need + (need === 1 ? ' item' : ' items') + ' about your own airline'; },
    giveHead: function (name) { return 'Fill in the gaps on pay and conditions at ' + name; },
    giveCount: function (have, need) { return 'Items you have answered: ' + have + ' / ' + need; },
    giveGo: 'Answer anonymously',

    work: [
      { k: 'block_hours', name: 'Block hours', unit: 'h / month', u: 'h', fam: 'h' },
      { k: 'duty_hours', name: 'Duty hours', unit: 'h / month', u: 'h', fam: 'h' },
      { k: 'work_days', name: 'Days worked', unit: 'days / month', u: 'days', fam: 'd' },
      { k: 'duty_days', name: 'Flying days', unit: 'days / month', u: 'days', fam: 'd' },
      { k: 'days_off', name: 'Days off', unit: 'days / month', u: 'days', fam: 'd' },
      { k: 'stay_nights', name: 'Layover nights', unit: 'nights / month', u: 'nights', fam: 'd' }
    ],
    workPos: [['cap', 'Captain'], ['fo', 'First Officer']],
    workEmpty: 'No results yet',
    workMax: { h: 240, d: 31 },
    workCap: 'Bars and figures show the middle 50% of answers',
    workAxis: ['Scale: hours 0', ', days and nights 0'],
    workOver: 'Off the scale',
    noteHead: 'Notes from members',
    noteWork: 'Monthly duty',
    noteMine: 'Your post',
    townHead: 'Popular places to live',
    townWait: 'Waiting',
    townNo: 'Declined',
    townEdit: 'Edit',
    townHeld: 'You have answers saved without logging in.',

    revEmpty: 'No reviews yet',
    revNone: 'No posts from members yet',
    revNo: 'Not rated yet',
    revPosts: function (n) { return 'Member posts: ' + n; },
    revRated: function (n) { return n + (n === 1 ? ' rating' : ' ratings'); },
    sumHead: 'Review summary',
    sumOvHead: 'Overview',
    sumGood: 'Good points',
    sumConcern: 'Concerns',
    sumLock: 'The summary opens when you post a review',
    sumAi: 'AI summary',
    sumFrom: function (n) { return 'From ' + n + (n === 1 ? ' member review' : ' member reviews'); },
    /* ★2026-10-26 EN-11c：英語は月の名前で「Updated 1 October 2026」（英語ページのほかの日付と同じ「日 月 年」の形）。
       月の名前は上の MONTHS_EN だけから ── ブラウザの言語の設定（toLocaleDateString など）では作らない。形の違う字はそのまま */
    sumWhen: function (d) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d), mo = m && MONTHS_EN[Number(m[2]) - 1];
      return 'Updated ' + (mo && Number(m[3]) >= 1 && Number(m[3]) <= 31 ? Number(m[3]) + ' ' + mo + ' ' + m[1] : d);
    },
    sumFew: 'Too few reviews yet for a summary',
    sumNone: 'No review summary yet',
    sumOff: 'Not available yet',
    sumSrc: 'See the reviews behind this summary',
    revLock: 'Opens when you post a review',
    revGive: 'Write a review anonymously',
    revUnlock: ['Unlock ', 'reviews'],
    revAll: 'See all reviews for this airline',

    factEmpty: 'No results yet',
    factNone: 'No results',
    top: 'Most common',
    median: 'Median',
    split: 'Answers are split',
    answered: function (n) { return n === 1 ? '1 member' : n + ' members'; }
  };
  if (LANG === 'en') T = T_EN;

  /* ── 小さな道具 ─────────────────────────────────────────── */
  function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function enc(s) { return encodeURIComponent(String(s)); }
  function okSlug(s) { return typeof s === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(s); }

  function el(tag, cls, text) {
    var n = d.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }
  function clear(box) { while (box.firstChild) box.removeChild(box.firstChild); }

  var NS = 'http://www.w3.org/2000/svg';
  var ICON = {
    lock: ['M7 11V7a5 5 0 0 1 10 0v4', 'M5 11h14v10H5z'],
    check: ['M20 6 9 17l-5-5'],
    arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
    down: ['M6 9l6 6 6-6']
  };
  function icon(name, size) {
    var s = d.createElementNS(NS, 'svg');
    s.setAttribute('class', 'crl-ic');
    s.setAttribute('width', String(size || 14));
    s.setAttribute('height', String(size || 14));
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2.2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    ICON[name].forEach(function (p) {
      var e = d.createElementNS(NS, 'path');
      e.setAttribute('d', p);
      s.appendChild(e);
    });
    return s;
  }
  function link(text, href, kind) {
    var a = el('a', kind === 'cta' ? 'crl-cta' : 'crl-link');
    a.href = href;
    a.appendChild(el('span', '', text));
    a.appendChild(icon('arrow', 14));
    return a;
  }
  /* 2行の入口（会社ページ）── 上に「Give & Get」、下に何が開くか。行き先は1行の入口と同じ。
     ★2026-10-08 形はサイト共通の pv-gg.css（トップのいちばん上の黒いボタンと同じ：2行ともまんなか・同じ大きさ・丸い形）。
       評価スコアの1枚・口コミの錠前の入口と1つも違わない。ここで大きさ・色・寄せ方を足さない。 */
  function ggArrow() {
    var s = d.createElementNS(NS, 'svg');
    s.setAttribute('width', '16');
    s.setAttribute('height', '16');
    s.setAttribute('viewBox', '0 0 16 16');
    s.setAttribute('fill', 'none');
    s.setAttribute('aria-hidden', 'true');
    var p = d.createElementNS(NS, 'path');
    p.setAttribute('d', 'M3 8h10M9 4l4 4-4 4');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '1.6');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    s.appendChild(p);
    return s;
  }
  function give2(main, href) {
    var a = el('a', 'pv-gg');
    a.href = href;
    var t = el('span', 'pv-gg-t');
    var k = el('span', 'crl-cta-k', T.gg);
    k.lang = 'en';
    t.appendChild(k);
    /* main は語の切れ目ごとの配列。あいだに <wbr> を置く ＝ 狭い箱ではここでだけ折れる（折り方は pv-gg.css） */
    var m = el('span', 'crl-cta-m');
    main.forEach(function (w, i) {
      if (i) m.appendChild(d.createElement('wbr'));
      m.appendChild(d.createTextNode(w));
    });
    t.appendChild(m);
    a.appendChild(t);
    a.appendChild(ggArrow());
    return a;
  }
  function msg(text) { return el('p', 'crl-msg', text); }
  function lockLine(text) {
    var p = el('p', 'crl-lock');
    p.appendChild(icon('lock', 14));
    p.appendChild(el('span', '', text));
    return p;
  }
  function foot(nodes) {
    var f = el('div', 'crl-foot');
    nodes.forEach(function (n) { if (n) f.appendChild(n); });
    return f;
  }
  function ym(v) {
    if (!v) return '';
    var m = /^(\d{4})-(\d{2})/.exec(String(v));
    return m ? T.ym(m[1], Number(m[2])) : '';
  }
  function view(state, nodes) { return { state: state, nodes: nodes || [] }; }
  function fail(kind) { var e = new Error(kind); e.crl = kind; return e; }
  function sbErr(res) {
    var code = String((res && res.error && res.error.code) || '');
    var off = code === 'PGRST202' || code === 'PGRST205' || code === '42883' || code === '42P01' ||
              (res && res.status === 404);
    return fail(off ? 'off' : 'error');
  }

  /* ── 会社の名前と色（ページに在る島から。無ければ選択肢の字）──────── */
  var CO = null;
  function companies() {
    if (CO) return CO;
    CO = {};
    var isl = d.getElementById('crc-data');
    if (isl) {
      try { CO = (JSON.parse(isl.textContent || '{}') || {}).airlines || {}; } catch (e) { CO = {}; }
    }
    return CO;
  }
  function coName(slug) {
    var c = companies()[slug];
    if (c && c[LANG]) return String(c[LANG]);
    var o = root.querySelector('#cr-a option[value="' + slug + '"]');
    return o ? String(o.textContent || '').trim() : slug;
  }
  /* 社名の札。名前は1つの塊（crl-co-n）── 狭い列で語の途中で折らない（「キャセイパシフィ／ック」にしない）。収まらなければ色の点の下の行へ送る */
  function coTag(slug) {
    var s = el('span', 'crl-co');
    s.appendChild(el('span', 'crl-co-n', coName(slug)));
    var c = companies()[slug];
    if (c && typeof c.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(c.color)) {
      s.style.setProperty('--crl-co', c.color);
    }
    return s;
  }

  /* ── 取ってくる側（同じ答えは使い回す。落ちたものだけ捨てる＝やり直せる）──── */
  /* 1本の通信に上限を置く（数え直しではない。上限で切れたら「いま読み出せません」。自動では聞き直さない）。 */
  var REQ_LIMIT_MS = 15000;
  function limited(build) {
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null, t = 0;
    var p = new Promise(function (res, rej) {
      t = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} rej(fail('error')); }, REQ_LIMIT_MS);
      Promise.resolve(build(ctrl ? ctrl.signal : null)).then(res, rej);
    });
    var done = function () { clearTimeout(t); };
    p.then(done, done);
    return p;
  }
  /* 上限で切るときに、その通信を本当に止める（supabase-js の abortSignal。無い版では、待つのをやめるだけ）。 */
  function cut(q, sig) { return (sig && q && typeof q.abortSignal === 'function') ? q.abortSignal(sig) : q; }
  var cache = {};
  function once(key, fn) {
    if (cache[key]) return cache[key];
    var p;
    p = limited(fn);
    cache[key] = p;
    /* 落ちた答えは持ち越さない（やり直せる）。「口がまだ無い」だけは聞き直しても同じなので持つ。 */
    p.then(null, function (e) { if (cache[key] === p && !(e && e.crl === 'off')) delete cache[key]; });
    return p;
  }
  function drop(prefix) {
    Object.keys(cache).forEach(function (k) { if (k.indexOf(prefix) === 0) delete cache[k]; });
  }
  function loadScript(src) {
    return limited(function () {
      return new Promise(function (res, rej) {
        var s = d.createElement('script');
        s.src = src; s.async = true;
        s.onload = function () { res(); };
        s.onerror = function () { rej(fail('error')); };
        d.head.appendChild(s);
      });
    });
  }
  function json(file) {
    return fetch(BASE + file, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw fail('error');
      return r.json();
    });
  }

  /* supabase-js は欄が出たときに初めて読む。createClient はページに1回。 */
  var sbOnce = null;
  function client() {
    if (sbOnce) return sbOnce;
    /* 会社ページには、口コミの部品（airline-reviews-ui.js）が作ったクライアントが既に在る。
       2つ目を作らない（同じ保存領域を2つが見張ると、ログインの切り替わりを取り合う）。 */
    var shared = GL && w.PVReviewUI && typeof w.PVReviewUI.sb === 'function';
    var p = shared
      ? Promise.resolve(w.PVReviewUI.sb()).then(function (sb) {
        if (!sb) throw fail('error');
        watchAuth(sb);
        return sb;
      })
      : (w.supabase && w.supabase.createClient ? Promise.resolve() : loadScript(SB_CDN))
        .then(function () {
          if (!w.supabase || !w.supabase.createClient) throw fail('error');
          var sb = w.supabase.createClient(SB_URL, SB_KEY);
          watchAuth(sb);
          return sb;
        });
    sbOnce = p;
    p.then(null, function () { if (sbOnce === p) sbOnce = null; });
    return p;
  }

  /* 人が変わった（ログアウトを含む）ときだけ、本物の行を消して取り直す。
     最初の読み出しと、トークンの更新では何もしない。 */
  var uid;                                  // undefined ＝ まだ知らない
  function setUid(v) {
    if (uid === undefined) { uid = v; return; }
    if (uid === v) return;
    uid = v;
    drop('pay'); drop('rev:'); drop('sum:'); drop('wkv:'); drop('note:'); drop('fact:'); drop('give'); drop('town:'); drop('cmed:'); drop('ccomp:');
    reset(['realpay', 'work', 'cmp-work', 'notes', 'reviews', 'stars', 'score', 'summary', 'cmp-stars', 'fact', 'cmp-facts', 'towns', 'cmp-pay', 'cmp-summary']);
    later();
  }
  function watchAuth(sb) {
    try {
      sb.auth.getSession().then(function (r) {
        var u = r && r.data && r.data.session && r.data.session.user;
        setUid(u ? u.id : null);
      }, function () { setUid(null); });
      sb.auth.onAuthStateChange(function (ev, session) {
        var u = session && session.user;
        setUid(u ? u.id : null);
      });
    } catch (e) { /* 読めなくても欄は出す（サーバーが資格を決める） */ }
  }
  /* 別のタブでログイン・ログアウトしたとき（career.html だけ ── 会社ページには pv-contrib.js の合図が届く）。
     このページの supabase-js は、ほかのタブの書き込みを聞かない（2026-10-22 に確かめた：比較を開いたまま別のタブで別の会員が入っても、
     欄は前の人のまま）。ログインを読むのは PVSession の1か所（ここでは読まない・書かない）。読む人が替わった時だけ setUid。
     通信も時計も使わない。同じ確かめを、ブラウザの「戻る」でこのページが手元から戻った時にも使う（下の pageshow）。 */
  function storedReader() {
    var P = w.PVSession;
    if (uid === undefined || !P || typeof P.readStoredSession !== 'function') return;
    var s = P.readStoredSession(), u = s && s.user && typeof s.user.id === 'string' ? s.user.id : null;
    /* 鍵は在るのに読めない形（割って入れる実装など）は、誰か分からない ＝ 何もしない（ログアウトとは読まない） */
    if (!u && typeof P.hasToken === 'function' && P.hasToken()) return;
    setUid(u);
  }
  if (!GL) w.addEventListener('storage', storedReader);

  /* 給与の行。引数なしで1回だけ呼び、会社で絞るのは画面側（現行の REAL PAY と同じ）。
     開いていない答えからは、会社・出典・投稿時期の3つしか受け取らない。 */
  /* 給与の一覧を、いま誰が読んでいるか。サーバーの答え（state と give.basic）だけで決める。
     expired ＝ 自分の提出は在るのに鍵が開いていない（期限が切れた・運営が鍵を直した）。 */
  function payWho(x) {
    if (x.state === 'open') return 'open';
    if (x.give == null) return 'guest';
    return x.give.basic === true ? 'expired' : 'member';
  }
  function payRows() {
    return once('pay', function (sig) {
      return client().then(function (sb) { return cut(sb.rpc('pv_pay_rows'), sig); }).then(function (res) {
        if (!res || res.error) throw sbErr(res);
        var x = res.data;
        if (!x || x.ok === false) throw fail('error');
        var open = x.state === 'open';
        var rows = isArr(x.rows) ? x.rows : [];
        if (!open) {
          rows = rows.map(function (r) {
            return { airline: r && r.airline, verified: !!(r && r.verified), age: r && r.age };
          });
        }
        return { open: open, rows: rows, anon: x.give == null, who: payWho(x) };
      });
    });
  }

  /* 月の勤務の集計（給与とは別の入口で集めた6項目）。見せてよい相手かどうかはサーバーが決める。
     開いていない答えに入っているのは、状態の1語だけ（数字は1つも来ない）。 */
  function workView(slug) {
    return once('wkv:' + slug, function (sig) {
      return client().then(function (sb) { return cut(sb.rpc('pv_work_view', { p: { airline: slug } }), sig); }).then(function (res) {
        if (!res || res.error) throw sbErr(res);
        var x = res.data;
        if (!x || x.ok === false) throw fail('error');
        if (x.state !== 'open') {
          /* 開いていない時の語は3つ。知らない語は、鍵とも0件とも読まない */
          if (x.state !== 'login' && x.state !== 'locked' && x.state !== 'give') throw fail('error');
          return { state: x.state, by: {} };
        }
        return { state: 'open', by: (x.by && typeof x.by === 'object') ? x.by : {} };
      });
    });
  }
  /* 会員が書いた補足。誰に返すかはサーバーが決める（開いていない人には1文字も返らない）。
     開いた答えに付いてきた補足だけを持つ。 */
  function notesOf(slug) {
    return once('note:' + slug, function (sig) {
      return client().then(function (sb) { return cut(sb.rpc('pv_contrib_notes', { p: { airline: slug } }), sig); }).then(function (res) {
        if (!res || res.error) throw sbErr(res);
        var x = res.data;
        if (!x || x.ok === false) throw fail('error');
        return { state: x.state === 'open' ? 'open' : 'locked',
                 notes: (x.state === 'open' && isArr(x.notes)) ? x.notes : [] };
      });
    });
  }

  /* 口コミ。読む口は review-i18n.js の fetchRows の1つだけ（reviews_v2 を直接引かない）。 */
  function i18n() {
    return once('i18n', function () {
      return (w.PVReviewI18n ? Promise.resolve() : loadScript(BASE + 'review-i18n.js')).then(function () {
        if (!w.PVReviewI18n || !w.PVReviewI18n.fetchRows || !w.PVReviewI18n.pick) throw fail('error');
        return w.PVReviewI18n;
      });
    });
  }
  function reviews(slug) {
    return once('rev:' + slug, function () {
      return Promise.all([client(), i18n()]).then(function (a) {
        var codes = [slug];
        if (LEGACY[slug]) codes.push(LEGACY[slug]);
        return a[1].fetchRows(a[0], { airlines: codes, limit: 500 });
      }).then(function (res) {
        if (!res) throw fail('error');          // 取れなかった（0件とは別）
        return res;
      });
    });
  }

  /* 待遇の集計。誰に返すかはサーバーが決める（db/contrib.sql の pv_contrib_facts）。
     開いていない人に返るのは、状態の1語だけ（集計は1件も来ない）。集計のビューは直接読まない（読めない）。
     1社につき1回だけ聞く ── 聞く質問は、このページの集計の欄ぜんぶの分。
     比較の回答の欄（cmp-facts）が持つ鍵も、同じ1回で聞く。 */
  function pageKeys() {
    var seen = {}, out = [];
    var all = root.querySelectorAll('.crl[data-live="fact"][data-keys], .crl[data-live="cmp-facts"][data-keys]');
    for (var i = 0; i < all.length; i++) {
      keysOf(all[i]).forEach(function (k) { if (!seen[k]) { seen[k] = 1; out.push(k); } });
    }
    return out.sort();
  }
  function facts(slug) {
    return once('fact:' + slug, function (sig) {
      var keys = pageKeys(), asked = {};
      keys.forEach(function (k) { asked[k] = 1; });
      return client().then(function (sb) {
        return cut(sb.rpc('pv_contrib_facts', { p: { airline: slug, keys: keys } }), sig);
      }).then(function (res) {
        if (!res || res.error) throw sbErr(res);
        var x = res.data;
        if (!x || x.ok === false) throw fail('error');
        /* 状態の語は4つ。知らない語は、開いているとも0件とも読まない */
        if (x.state !== 'login' && x.state !== 'locked' && x.state !== 'give' && x.state !== 'open') throw fail('error');
        /* 行を持つのは、開いている時の、聞いた質問の分だけ（ほかの状態に行が付いてきても捨てる） */
        var m = {};
        if (x.state === 'open') {
          (isArr(x.facts) ? x.facts : []).forEach(function (r) {
            if (r && typeof r.question_id === 'string' && asked[r.question_id] === 1) m[r.question_id] = r;
          });
        }
        return { state: x.state, map: m, asked: asked };
      });
    });
  }

  /* 答えの名前。ページの島が在ればそれ、無ければ質問の台帳から同じ形に直す。 */
  function vocab() {
    return once('vocab', function () {
      var isl = d.getElementById('crl-vocab');
      if (isl) {
        try {
          var v = JSON.parse(isl.textContent || '');
          if (v && typeof v === 'object') return v;
        } catch (e) { /* 下へ */ }
      }
      /* 名前の鍵は島と同じ ja のまま（中の字はページの言葉 LANG のもの。英語の単位は数と1字あける ── T.unitSp） */
      return json('pv-conditions.json').then(function (c) {
        var out = {};
        ((c && c.questions) || []).forEach(function (q) {
          if (!q || !q.id) return;
          var o = {};
          (q.choices || []).forEach(function (ch) { if (ch && ch.code) o[ch.code] = ch[LANG]; });
          out[q.id] = {
            ja: (q[LANG] && q[LANG].label) || '', kind: q.kind || '',
            options: o, unit: (q.num && q.num[LANG]) ? T.unitSp + q.num[LANG] : ''
          };
        });
        return out;
      });
    });
  }

  /* 職位と機材の名前。 */
  function dict() {
    return once('dict', function () {
      return json('pv-vocab.json').then(function (v) {
        var pos = {}, fleet = {};
        ((v && v.positions) || []).forEach(function (x) { if (x && x.code) pos[x.code] = x[LANG]; });
        var leg = (v && v.legacyPositions) || {};
        Object.keys(leg).forEach(function (k) { if (!pos[k] && pos[leg[k]]) pos[k] = pos[leg[k]]; });
        ((v && v.fleets) || []).forEach(function (x) {
          if (x && x.code) fleet[x.code] = String(x[LANG] || '').replace(TAIL, function () { return ''; });
        });
        return { pos: pos, fleet: fleet };
      });
    });
  }

  /* ── 金額（現行の REAL PAY と同じ作り＝有効数字2桁。表示は PVCurrency）────── */
  function sig2(v) {
    v = Number(v);
    if (!isFinite(v) || v <= 0) return 0;
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10) - 1);
    return Math.round(v / p) * p;
  }
  function money(usd) {
    var C = w.PVCurrency;
    if (!C || !C.rates || usd == null || !isFinite(Number(usd)) || Number(usd) <= 0) return '';
    var rate = C.rates[C.get()] || 1;
    var n = sig2(Number(usd) * (C.rates.USD || 1) / rate);
    return n ? C.fmt(n * rate) : '';
  }

  /* ── REAL PAY ───────────────────────────────────────────── */
  function srcLine(r) {
    var p = el('div', 'crl-row-c');
    var vf = el('span', 'crl-vf');
    if (r.verified) { vf.setAttribute('data-v', '1'); vf.appendChild(icon('check', 12)); }
    vf.appendChild(el('span', '', r.verified ? T.vfYes : T.vfNo));
    p.appendChild(vf);
    var age = (isNum(r.age) && T.age[r.age]) ? T.age[r.age] : '';
    if (age) p.appendChild(el('span', 'crl-age', age));
    return p;
  }
  function payRow(r, D, bare) {
    var li = el('li', 'crl-row');
    var a = el('div', 'crl-row-a');
    if (!bare && D.pos[r.pos]) a.appendChild(el('b', 'crl-pos', D.pos[r.pos]));
    if (r.fleet && D.fleet[r.fleet]) a.appendChild(el('span', 'crl-sub', D.fleet[r.fleet]));
    var ten = isNum(r.ten) ? (T.ten[r.tenk === 's' ? 's' : 'r'][r.ten] || '') : '';
    if (ten) a.appendChild(el('span', 'crl-chip', ten));
    li.appendChild(a);

    var b = el('div', 'crl-row-b');
    b.appendChild(el('span', 'crl-k', T.annual));
    var amt = money(r.annual_usd);
    var v = el('b', 'crl-amt pv-no-cur', amt || '—');
    if (!amt) v.setAttribute('data-none', '');
    b.appendChild(v);
    if (r.far === true) {
      var f = el('span', 'crl-far', '⚠︎');
      f.setAttribute('role', 'img');
      f.setAttribute('aria-label', T.far);
      f.title = T.far;
      b.appendChild(f);
    }
    li.appendChild(b);
    li.appendChild(srcLine(r));
    return li;
  }
  /* 鍵の無い人の行。サーバーが返した3つ（会社・出典・投稿時期）だけで組む。額の箱は作らない。 */
  function maskRow(r, slug) {
    var li = el('li', 'crl-row');
    li.setAttribute('data-mask', '');
    var a = el('div', 'crl-row-a');
    a.appendChild(el('b', 'crl-pos', coName(slug)));
    li.appendChild(a);
    li.appendChild(srcLine(r));
    return li;
  }
  /* 会社ページの、鍵の無い人の行。開いた行と同じ骨組みで、職位・機材・年収の場所にぼかした板を置く。
     会社はページが言っているので、社名を行ごとに繰り返さない。
     ⚠️ 板の中に字を入れない（数字も、それらしい記号も）。サーバーが送ってきたのは出典と投稿時期だけ。 */
  function plate(kind) {
    return el('span', 'crl-plate' + (kind ? ' crl-plate-' + kind : ''));
  }
  function maskLine(r) {
    var li = el('li', 'crl-row');
    li.setAttribute('data-mask', 'line');
    var a = el('div', 'crl-row-a');
    a.setAttribute('aria-hidden', 'true');
    a.appendChild(plate('a'));
    a.appendChild(plate('b'));
    li.appendChild(a);
    var b = el('div', 'crl-row-b');
    b.setAttribute('aria-hidden', 'true');
    b.appendChild(el('span', 'crl-k', T.annual));
    b.appendChild(plate(''));
    li.appendChild(b);
    li.appendChild(srcLine(r));
    return li;
  }
  /* 1件ずつの行の畳み（会社ページ ── 比較の crl-pay-fold と同じ形・同じ字「提出された数字を見る（N件）」。N ＝ 畳みの中の行の数）。
     最初は閉じている。開け閉めは <details> のまま（キーボードでも開ける）・状態は aria-expanded にも写す */
  function payFold(ul, n, open) {
    var dt = el('details', 'crl-pay-fold'), sm = el('summary', 'crl-pay-fold-s');
    sm.appendChild(el('span', '', T.payOpen(n)));
    sm.appendChild(icon('down', 14));
    sm.setAttribute('aria-expanded', open ? 'true' : 'false');
    dt.appendChild(sm);
    dt.appendChild(ul);
    if (open) dt.open = true;
    dt.addEventListener('toggle', function () { sm.setAttribute('aria-expanded', dt.open ? 'true' : 'false'); });
    return dt;
  }
  /* 会社の色を、その箱の --crl-co に（色はページの島の色だけ ── 答えは読まない）。色が無い会社は何もしない（CSS が緑にする） */
  function coTint(node, slug) {
    var c = companies()[slug];
    if (c && typeof c.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(c.color)) node.style.setProperty('--crl-co', c.color);
    return node;
  }
  /* この会社の提出の件数（返ってきた行を数えるだけ。同じ人が2行になることがあるので「人」と呼ばない） */
  function payCount(n) {
    var t = T.payCount(n), p = el('p', 'crl-count');
    if (t[0]) p.appendChild(d.createTextNode(t[0]));
    p.appendChild(el('b', '', t[1]));
    p.appendChild(d.createTextNode(t[2]));
    return p;
  }
  function loginHref() {
    if (GL) return UP + 'login.html?redirect=' + enc(location.pathname.replace(/^.*\/airlines\//, 'airlines/'));
    return 'login.html?redirect=' + enc('career.html' + location.search);
  }
  /* 同じタブへ戻るログインの入口。#work のようなタブの名前だけを通す（ほかの形の # は付けない）。 */
  function backHash() {
    var h = String(location.hash || '');
    return /^#[A-Za-z0-9_-]{1,40}$/.test(h) ? h : '';
  }
  function loginLink() {
    var a = link(T.login, loginHref() + enc(backHash()));
    a.setAttribute('data-crl-login', '1');
    /* 押す時にもう一度決める（描いたあとでタブを移っていても、押した時のタブへ戻す） */
    a.addEventListener('click', function () { a.href = loginHref() + enc(backHash()); }, true);
    return a;
  }
  function payEntry(slug) {
    return link(T.payGive, UP + 'pay-report.html' + (slug ? '?airline=' + enc(slug) : ''), 'cta');
  }
  var NONE = { getAttribute: function () { return '0'; } }, GIVE_ONLY = { getAttribute: function () { return 'give'; } };
  /* 欄がその入口を自分で出してよいか。data-entry が無ければ、状態が要る入口を出す。
     在れば、そこに書いてある語の入口だけ（"0" ＝ どれも出さない。同じ面にもう在る）。 */
  function carries(box, what) {
    var v = box.getAttribute('data-entry');
    return v === null || (' ' + v + ' ').indexOf(' ' + what + ' ') >= 0;
  }
  /* ほかの人の回答が開いていない時の1行。言い方はここ1か所（集計の欄・比較・月の勤務が同じ字になる）。
     who … サーバーが返した状態の1語：'login' ／ 'locked' ／ 'give'
     入口は1つだけ ── 'login' は「ログイン」、'locked' は「匿名で給与を提出する」、'give' は答えるカード。 */
  function lockView(who, slug, box, lead) {
    if (who === 'give') return giveView(lead ? [lead] : [], box);
    var nodes = lead ? [lead] : [];
    nodes.push(lockLine(who === 'login' ? T.loginPayLock : T.payLock));
    if (carries(box, who === 'login' ? 'login' : 'pay')) nodes.push(foot([who === 'login' ? loginLink() : payEntry(slug)]));
    return view('locked', nodes);
  }
  /* 答えるカードの中身 ── 読む人自身の会社（符号と名前）・その会社について答えた数・要る数・次に聞く質問の並び。
     返すのはサーバー（db/contrib.sql の pv_contrib_give）。ほかの人の回答の数は、1つも来ない。
     カードを埋められる答えだけを受け取る：状態が 'give'・会社の符号（一覧に無い会社は 'other'）・名前・0 以上で要る数より小さい、答えた数。
     それ以外（たとえば、別のタブで足りる数まで答えた直後の 'open'）では描かない ＝ 埋められないカードを出さない・要る数をここで決めない。 */
  var ASK_ID = /^[a-z0-9_]{1,64}$/;
  function isInt(v) { return isNum(v) && Math.floor(v) === v; }
  /* 答えるカードに出す社名（押して開く「情報を追加」の面の頭の行にも、この名前が渡る）。どの欄のカードも、ここ1か所で決める。
     段階3の面の社名は、日本の会社は日本語・ほかは英語（オーナー 2026-10-18「日本は日本語、他は英語」）。
     英語の名前は、サイトの生成物 pv-airlines.json（gen-airline-codes.mjs が SALARY と OPS から書く。地域 region を持つ）の en
     ── 新しい綴りは作らない。日本の会社（region 'japan'）・一覧に無い会社（'other' ＝ 本人が書いた名前）・この一覧に無い符号・
     一覧が読めなかった時は、サーバーが返した名前のまま（db/contrib.sql は日本語の名前を返す。サーバーは変えない）。
     一覧は誰が読んでも同じ字なので、読む人が替わっても読み直さない（鍵は 'give' で始めない ＝ drop('give') に消されない）。
     ★英語のページ（LANG 'en'）では、日本の会社も一覧の英語の名前（「日本は日本語」は日本語のページの決まり ── 2026-10-24 WP-en-5）。
       一覧に無い会社・一覧が読めなかった時は、英語のページでもサーバーが返した名前のまま（新しい綴りを作らない）。 */
  function giveSay(code, name) {
    if (code === 'other') return Promise.resolve(name);
    return once('airlines', function () {
      return json('pv-airlines.json').then(function (j) { return (j && j.airlines) || {}; });
    }).then(function (m) {
      var a = m && Object.prototype.hasOwnProperty.call(m, code) ? m[code] : null;
      var en = a && typeof a.en === 'string' ? a.en.replace(/^\s+|\s+$/g, '') : '';
      return a && typeof a.region === 'string' && (LANG === 'en' || a.region !== 'japan') && en ? en : name;
    }, function () { return name; });
  }
  function giveInfo() {
    return once('give', function (sig) {
      return client().then(function (sb) { return cut(sb.rpc('pv_contrib_give', { p: {} }), sig); }).then(function (res) {
        if (!res || res.error) throw sbErr(res);
        var x = res.data;
        if (!x || x.ok === false || x.state !== 'give') throw fail('error');
        var name = typeof x.name === 'string' ? x.name.replace(/^\s+|\s+$/g, '') : '';
        if (!okSlug(x.airline) || !name) throw fail('error');
        if (!isInt(x.have) || !isInt(x.need) || x.have < 0 || x.have >= x.need) throw fail('error');
        var g = {
          airline: x.airline, name: name, have: x.have, need: x.need,
          ask: (isArr(x.ask) ? x.ask : []).filter(function (q) { return typeof q === 'string' && ASK_ID.test(q); })
        };
        return giveSay(g.airline, name).then(function (n) { g.name = n; return g; });
      });
    });
  }
  /* カードの入口の行き先（リンクとして）。一覧に在る会社は、質問の画面の、その会社・最初に聞く質問の所。
     一覧に無い会社（'other'）は、質問の画面そのもの（あちらが、いちばん新しい給与の会社について開く）。 */
  function giveHref(g) {
    if (g.airline === 'other') return UP + 'airline-conditions.html';
    return UP + 'airline-conditions.html?airline=' + enc(g.airline) + (g.ask.length ? '&q=' + enc(g.ask[0]) : '');
  }
  /* 答えるカード。字はどれも textContent（サーバーが返した社名も、字としてしか入れない）。入口は1つ。
     押した時：このページに「情報を追加」の面が在り（PVContrib.openFor）、一覧に在る会社なら、読む人自身の会社について面を開く。
     面が開いた時（true が返った時）だけ、リンクを止める。開かなかった時（ログインしていない・符号の形でない）・面が無いページ・
     一覧に無い会社・別のタブで開く押し方（修飾キー・左のほかのボタン）では、リンクのまま進む。 */
  function giveCard(g) {
    var c = el('div', 'crl-give');
    c.appendChild(el('p', 'crl-give-h', T.giveHead(g.name)));
    c.appendChild(el('p', 'crl-give-n', T.giveCount(g.have, g.need)));
    var a = link(T.giveGo, giveHref(g), 'cta');
    a.setAttribute('data-crl-give', '1');
    a.addEventListener('click', function (e) {
      var C = w.PVContrib;
      if (g.airline === 'other' || !C || typeof C.openFor !== 'function') return;
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (C.openFor({ airline: g.airline, name: g.name, ask: g.ask, from: a }) === true) e.preventDefault();
    });
    c.appendChild(foot([a]));
    return c;
  }
  /* 'give' の欄：1行（要る数はサーバーの数）と、欄の data-entry が許す時だけ、答えるカード。
     カードの中身が読めなければ、この欄は「いま読み出せません」（口がまだ無ければ「準備中」）── 行だけを先に出さない。 */
  function giveView(nodes, box) {
    return giveInfo().then(function (g) {
      nodes.push(lockLine(T.giveLock(g.need)));
      if (carries(box, 'give')) nodes.push(giveCard(g));
      return view('locked', nodes);
    });
  }
  /* 2社を並べる欄で、開いていない側の語。ログイン → 給与の提出 → 答える の順で先のもの。両方開いていれば空。 */
  function shut(a, b) {
    var order = ['login', 'locked', 'give'];
    for (var i = 0; i < order.length; i++) {
      if (a === order[i] || b === order[i]) return order[i];
    }
    return '';
  }
  function ofCo(rows, slug) {
    return rows.filter(function (r) { return r && r.airline === slug; });
  }

  var KIND = {};

  KIND.realpay = function (box, ids) {
    var slug = ids[0];
    return Promise.all([payRows(), dict()]).then(function (a) {
      var pay = a[0], D = a[1];
      var mine = ofCo(pay.rows, slug);
      var all = link(T.payAll, UP + 'actual-pay.html?air=' + enc(slug));
      var ul = el('ul', 'crl-rows');
      /* 何行まで見せるかは置き場が決める（会社ページの給与の1枚は 3 行。指定が無ければ今までどおり） */
      var top = Number(box.getAttribute('data-top')) || (GL ? 6 : 3);
      if (pay.open) {
        if (!mine.length) return view('empty', [msg(T.payEmpty), foot([all])]);
        mine.slice(0, top).forEach(function (r) { ul.appendChild(payRow(r, D)); });
        /* ★2026-10-30 会社ページ（概要と給与・待遇のタブの両方）：件数 → 図（年収の幅・職位の切り替え・年数・内訳のカード）→ 畳んだ行 → 足元。
           ★同日オーナー「年収は一つずつ出すんじゃなくて、pull down で見れるようにすればいい」── 行は比較と同じ畳み（最初は閉じている）。
             通貨を替えて描き直しても、開けた畳みは開けたまま（keep） */
        if (GL) {
          var keep = !!box.querySelector('details.crl-pay-fold[open]');
          return view('open', [payCount(mine.length), payViz(box, slug, mine), payFold(ul, Math.min(top, mine.length), keep), foot([all])]);
        }
        return view('open', [ul, foot([all])]);
      }
      /* ★2026-10-07 会社ページの入口は2行「Give & Get／全ての給与情報を解放する」（オーナーのご指示。前日の
           「匿名で給与を提出する」より新しい）。給与を出して開くのは REAL PAY だけで、ホテルなどは別の資格
           ── だから「待遇データ」ではなく「給与情報」。行き先も開く条件も変えていない。条件は隣の「閲覧条件」から読める。 */
      var feet = foot(GL ? [
        give2(T.payUnlock, UP + 'pay-report.html?airline=' + enc(slug)),
        pay.anon ? link(T.login, loginHref()) : null,
        link(T.payTerms, UP + 'actual-pay.html?air=' + enc(slug))
      ] : [
        link(T.payGive, UP + 'pay-report.html?airline=' + enc(slug), 'cta'),
        pay.anon ? link(T.login, loginHref()) : null,
        all
      ]);
      /* 会社ページで行が1つも無い ＝ この会社の提出がまだ無い（サーバーは鍵の無い人にも同じ行数を返す）。
         開けるものが無いので「提出で開きます」とは書かない */
      if (GL && !mine.length) return view('empty', [msg(T.payEmpty), feet]);
      var nodes = [];
      if (mine.length) {
        if (GL) {
          nodes.push(payCount(mine.length));
          mine.slice(0, top).forEach(function (r) { ul.appendChild(maskLine(r)); });
        } else {
          mine.slice(0, top).forEach(function (r) { ul.appendChild(maskRow(r, slug)); });
        }
        nodes.push(ul);
        /* ★2026-10-30 伏せた行の下に、図の影絵（決まった形・字も数字も無い・開いた人と同じカードの形）。鍵の無い人には中央値も内訳も聞かない。
           点の色だけはページの会社の色（島の色。答えは読まない） */
        if (GL) nodes.push(coTint(ghostPay(), slug));
      }
      nodes.push(lockLine(pay.who === 'expired' ? T.payExpired : T.payLock));
      nodes.push(feet);
      return view('locked', nodes);
    });
  };

  /* ── 勤務（月の勤務の集計）────────────────────────────────
     幅だけを出す。丸めも「3人そろった項目だけ」の壁もサーバー側で、ここは来た形のまま並べる。
     人数も、1人ずつの値も来ない（＝ここで数え直すものが無い）。 */
  function workName(it) {
    var s = el('span', 'crl-wk-k', it.name);
    if (it.unit) s.appendChild(el('small', 'crl-unit', it.unit));
    return s;
  }
  function rangeOf(v) {
    if (!v || !isNum(v.lo) || !isNum(v.hi)) return '';
    return v.lo === v.hi ? String(v.lo) : (String(v.lo) + T.dash + String(v.hi));
  }
  function workAny(by) {
    return T.workPos.some(function (p) {
      var o = by && by[p[0]];
      return !!o && T.work.some(function (it) { return !!rangeOf(o[it.k]); });
    });
  }
  /* 1項目ぶん（機長・副操縦士の2行）。そろっていない側は「未取得」── 0 で埋めない */
  function workCell(by, k) {
    var dl = el('dl', 'crl-wk-v');
    T.workPos.forEach(function (p) {
      var t = rangeOf(by && by[p[0]] && by[p[0]][k]);
      var r = el('div', 'crl-wk-r');
      r.appendChild(el('dt', '', p[1]));
      r.appendChild(el('dd', t ? '' : 'crl-none', t || T.none));
      dl.appendChild(r);
    });
    return dl;
  }
  /* ── 月の勤務を帯で（会社ページの面だけ：data-bars="1"）──
     軸は単位ごとに固定（T.workMax）で 0 から。集まった値で軸を動かさない。
     軸を超えた幅は右端で切って印を付ける。数字は切らずにそのまま書く。そろっていない側には帯を描かない（0 で埋めない）。 */
  function workScale(it, v) {
    var max = T.workMax[it.fam];
    function at(x) { return Math.max(0, Math.min(x, max)) / max * 100; }
    return { max: max, from: at(v.lo), to: at(v.hi), over: v.hi > max, out: v.lo > max };
  }
  /* 1つの職位の1行：職位の名前｜細い軸と帯｜数字｜単位。そろっていない側は「未取得」で、軸そのものを描かない（0 で埋めない） */
  function barRow(it, p, v) {
    var r = el('div', 'crl-wb-r'), t = rangeOf(v);
    r.setAttribute('data-pos', p[0]);
    r.appendChild(el('span', 'crl-wb-p', p[1]));
    if (!t) { r.appendChild(el('span', 'crl-none', T.none)); return r; }
    var s = workScale(it, v), tr = el('span', 'crl-wb-tr' + (s.over ? ' is-over' : ''));
    tr.setAttribute('aria-hidden', 'true');
    if (!s.out) {
      var b = el('i', 'crl-wb-b');
      b.style.setProperty('--f', s.from + '%');
      b.style.setProperty('--w', (s.to - s.from) + '%');
      tr.appendChild(b);
    }
    r.appendChild(tr);
    r.appendChild(el('b', 'crl-wb-n', t));
    r.appendChild(el('span', 'crl-wb-u', it.u));
    if (s.over) r.appendChild(el('small', 'crl-wb-o', T.workOver));
    return r;
  }
  /* 6つの項目の枠（見本の並び ＝ T.work の順）。枠の中に、職位ごとの1行。軸の両端は枠ごとに書かない（面の下の1行が1回だけ言う） */
  function workBars(by) {
    var w = el('div', 'crl-wb');
    T.work.forEach(function (it) {
      var c = el('div', 'crl-wb-c');
      c.setAttribute('data-k', it.k);
      c.setAttribute('data-fam', it.fam);
      c.appendChild(workName(it));
      T.workPos.forEach(function (p) { c.appendChild(barRow(it, p, by && by[p[0]] && by[p[0]][it.k])); });
      w.appendChild(c);
    });
    return w;
  }
  /* 面の下の1行：帯の読み方と、軸の両端（数字は T.workMax から。ここ以外に書かない） */
  function workCapLine() {
    var p = el('p', 'crl-wb-cap'), m = T.workMax;
    p.appendChild(el('span', '', T.workCap));
    p.appendChild(el('span', 'crl-wb-sc', T.workAxis[0] + T.dash + m.h + T.workAxis[1] + T.dash + m.d));
    return p;
  }
  /* 開いていないとき。1行と入口は lockView の1か所（どの入口を自分で出すかは、欄の data-entry が決める） */
  function workLocked(W, slug, box) { return lockView(W.state, slug, box, null); }

  /* 会員の補足（文はそのまま字として入れる。HTML として読ませない） */
  function noteHead() { return el('p', 'crl-note-h', T.noteHead); }
  function noteList(notes, keys, withWork, V) {
    var want = {}, ul = el('ul', 'crl-notes'), n = 0;
    keys.forEach(function (k) { want[k] = 1; });
    notes.forEach(function (x) {
      if (!x || typeof x.text !== 'string' || !x.text) return;
      var isWork = x.topic === 'work' && !x.q;
      if (isWork ? !withWork : !(typeof x.q === 'string' && want[x.q] === 1)) return;
      var li = el('li', 'crl-note');
      var h = el('p', 'crl-note-k');
      h.appendChild(el('span', '', isWork ? T.noteWork : ((V && V[x.q] && V[x.q].ja) || '')));
      if (x.mine === true) h.appendChild(el('span', 'crl-note-me', T.noteMine));
      li.appendChild(h);
      li.appendChild(el('p', 'crl-note-t', x.text));
      ul.appendChild(li);
      n++;
    });
    return n ? ul : null;
  }
  /* 補足が読めなくても、欄の本題（集計）は出す */
  function notesFor(box, slug) {
    return Promise.all([notesOf(slug), vocab()]).then(function (a) {
      return noteList(a[0].notes, keysOf(box), box.hasAttribute('data-work'), a[1]);
    }).then(null, function () { return null; });
  }

  KIND.work = function (box, ids) {
    var slug = ids[0];
    return workView(slug).then(function (W) {
      /* 1社の概要（career.html）では、ログインと給与の入口は欄のすぐ下に在る ＝ ここは1行だけ（答えるカードだけは自分で出す） */
      if (W.state !== 'open') return workLocked(W, slug, GL ? box : GIVE_ONLY);
      return (box.hasAttribute('data-notes') ? notesFor(box, slug) : Promise.resolve(null)).then(function (ul) {
        var any = workAny(W.by), nodes = [];
        if (any && box.getAttribute('data-bars') === '1') {
          nodes.push(workBars(W.by));
          nodes.push(workCapLine());
        } else if (any) {
          var g = el('div', 'crl-work');
          T.work.forEach(function (it) {
            var c = el('div', 'crl-wk');
            c.appendChild(workName(it));
            c.appendChild(workCell(W.by, it.k));
            g.appendChild(c);
          });
          nodes.push(g);
        } else {
          nodes.push(msg(T.workEmpty));
        }
        if (ul) { nodes.push(noteHead()); nodes.push(ul); }
        return view((any || ul) ? 'open' : 'empty', nodes);
      });
    });
  };

  /* 勤務・訓練のほかの話題に付いた補足（待遇・通勤）。読めるものが無ければ、欄ごと出さない。
     未ログインには何も出さない ── サーバーは「在る・無い」も返さないので、在りもしないものに鍵の絵を描かない。 */
  KIND.notes = function (box, ids) {
    return notesFor(box, ids[0]).then(function (ul) {
      return ul ? view('open', [noteHead(), ul]) : view('empty', []);
    });
  };

  /* ── 会員が挙げた街（会社ページの暮らしの板。欄は .crl[data-live="towns"] の1つ）──────────
     読むのは2つ：(1) ほかの人の回答 ＝ pv_town_board（見せてよいかはサーバーの1か所 ＝ pv_contrib_sees。開いていなければ状態の1語だけ）
                  (2) 読む人自身の投稿 ＝ PVContrib.myTowns()（控えの鍵と読み口は pv-contrib.js が持つ。このページの会社のぶん）。
     開いていない時の1行と入口は lockView のまま。自分の投稿は、その上に置く（lead）。
     ★並べ替えない・足さない・数えない・切らない（並びは人数の多い順のサーバーの並び・人数はサーバーの数のまま）。 */
  var TOWN_SAY = ['login', 'locked', 'give', 'open'];
  function townBoard(slug, base) {
    return once('town:' + slug + ':' + base, function (sig) {
      return client().then(function (sb) { return cut(sb.rpc('pv_town_board', { p: { airline: slug, base: base } }), sig); }).then(function (res) {
        if (!res || res.error) throw sbErr(res);
        var x = res.data;
        /* 知らない語は、開いているとも0件とも読まない */
        if (!x || typeof x !== 'object' || x.ok === false || TOWN_SAY.indexOf(x.state) < 0) throw fail('error');
        if (x.state !== 'open') return { state: x.state, towns: [] };
        if (!isArr(x.towns)) throw fail('error');
        /* 名前と、本当の人数（1 以上の整数）を持つ街だけを描く */
        return {
          state: 'open',
          towns: x.towns.filter(function (t) { return t && typeof t.name === 'string' && t.name.replace(/^\s+|\s+$/g, '') && isInt(t.n) && t.n >= 1; })
        };
      });
    });
  }
  /* 自分の投稿（この基地のぶん）。読めない時・面の部品が無い時は null（欄の本題は、ほかの人の回答の側）。投げない。取っておかない。 */
  function townMine(slug, base) {
    function ask() {
      var C = w.PVContrib, p;
      if (!C || typeof C.myTowns !== 'function') return null;
      try { p = C.myTowns(); } catch (e) { return null; }
      return Promise.resolve(p).then(function (r) {
        if (!r || r.k !== 'ok' || !isArr(r.rows)) return null;
        return {
          held: r.held === true,
          rows: r.rows.filter(function (x) { return x && typeof x.town === 'string' && x.town && x.base === base; })
        };
      }, function () { return null; });
    }
    var now = ask();
    if (now || d.readyState !== 'loading') return Promise.resolve(now);
    /* pv-contrib.js は、このファイルのあとに読まれる */
    return new Promise(function (res) {
      d.addEventListener('DOMContentLoaded', function () { res(ask()); });
    });
  }
  /* 自分の行の札。街が確認待ちなら「確認待ち」。
     ★街がもう数に入っている（town_state 'public'）時は、文がまだ確認待ちでも「確認待ち」を付けない（オーナー 2026-10-18「いらない」
       ── 数に入っている街の横の「確認待ち」は、その街がまだ数に入っていないと読める）。文の確認と、誰に何を見せるかは今までどおり（サーバ）。
     ほかは今までどおり：まだ数に入っていない街で文が確認待ちなら「確認待ち」、どちらかが見送りなら「見送り」、ほかは何も付けない。 */
  function townSay(r) {
    if (r.town_state === 'pending' || (r.text_state === 'pending' && r.town_state !== 'public')) return T.townWait;
    if (r.town_state === 'rejected' || r.text_state === 'rejected') return T.townNo;
    return '';
  }
  function ownBlock(M) {
    if (!M || !M.rows.length) return null;
    var me = el('div', 'crl-town-me'), ul = el('ul', 'crl-town-own');
    me.appendChild(el('p', 'crl-note-h', T.noteMine));
    if (M.held) me.appendChild(msg(T.townHeld));
    M.rows.forEach(function (r) {
      var li = el('li'), say = townSay(r), b = el('button', 'crl-link crl-town-ed', T.townEdit);
      li.appendChild(el('span', 'crl-town-n pv-no-cur', r.town));
      if (say) li.appendChild(el('span', 'crl-town-st', say));
      /* 押すと、面（pv-contrib.js）の押し口が、その街の「修正」として開く */
      b.type = 'button';
      b.setAttribute('data-pvc-open', 'town');
      b.setAttribute('data-pvc-ctx', r.town);
      li.appendChild(b);
      ul.appendChild(li);
    });
    me.appendChild(ul);
    return me;
  }
  function townList(towns) {
    var ol = el('ol', 'crl-towns');
    towns.forEach(function (t) {
      var li = el('li', 'crl-town'), k = el('p', 'crl-town-k');
      k.appendChild(el('span', 'crl-town-n pv-no-cur', t.name));
      if (t.mine === true) k.appendChild(el('span', 'crl-note-me', T.noteMine));
      k.appendChild(el('span', 'crl-town-c', T.answered(t.n)));
      li.appendChild(k);
      [['good', T.sumGood], ['concern', T.sumConcern]].forEach(function (g) {
        var xs = (isArr(t[g[0]]) ? t[g[0]] : []).filter(function (x) { return x && typeof x.text === 'string' && x.text; });
        if (!xs.length) return;
        var ul = el('ul', 'crl-town-tx');
        li.appendChild(el('p', 'crl-town-l', g[1]));
        xs.forEach(function (x) {
          var it = el('li', 'crl-town-t pv-no-cur', x.text);
          if (x.mine === true) it.appendChild(el('span', 'crl-note-me', T.noteMine));
          ul.appendChild(it);
        });
        li.appendChild(ul);
      });
      ol.appendChild(li);
    });
    return ol;
  }
  KIND.towns = function (box, ids) {
    var slug = ids[0], base = box.getAttribute('data-base') || '';
    if (!/^[A-Z]{3}$/.test(base)) return Promise.reject(fail('error'));
    return Promise.all([townBoard(slug, base), townMine(slug, base)]).then(function (a) {
      var B = a[0], me = ownBlock(a[1]), nodes;
      if (B.state !== 'open') return lockView(B.state, slug, box, me);
      if (!B.towns.length && !me) return view('empty', []);
      nodes = me ? [me] : [];
      if (B.towns.length) { nodes.push(el('p', 'crl-town-h', T.townHead)); nodes.push(townList(B.towns)); }
      return view('open', nodes);
    });
  };

  /* ── 比較の骨組み（2社を同じ形で並べる。勝ち負けの語も色も付けない）────── */
  function cmpGrid(ids) {
    var g = el('div', 'crl-cmp');
    var h = el('div', 'crl-cmp-head');
    h.appendChild(coTag(ids[0]));
    h.appendChild(coTag(ids[1]));
    g.appendChild(h);
    return g;
  }
  function cmpRow(g, nameNode, cellA, cellB) {
    var r = el('div', 'crl-cmp-row');
    if (nameNode) {
      nameNode.className = (nameNode.className ? nameNode.className + ' ' : '') + 'crl-cmp-k';
      r.appendChild(nameNode);
    }
    var a = el('div', 'crl-cmp-c'); a.appendChild(cellA); r.appendChild(a);
    var b = el('div', 'crl-cmp-c'); b.appendChild(cellB); r.appendChild(b);
    g.appendChild(r);
    return r;
  }
  /* 比較の欄は2社を別々に読む。片方が落ちても、もう片方は出す。
     返る形: [S, S]、S ＝ { ok:true, v }｜{ ok:false, off:真偽 }（off ＝ サーバーに口がまだ無い）。この約束は落ちない。 */
  function both(read, ids) {
    function one(slug) {
      var p;
      try { p = Promise.resolve(read(slug)); } catch (e) { p = Promise.reject(e); }
      return p.then(function (v) { return { ok: true, v: v }; },
                    function (e) { return { ok: false, off: !!(e && e.crl === 'off') }; });
    }
    return Promise.all([one(ids[0]), one(ids[1])]);
  }
  /* 両方落ちたら、欄ごと今までの失敗の顔へ（2社とも「口が無い」なら「準備中」）。 */
  function needOne(S) {
    if (!S[0].ok && !S[1].ok) throw fail(S[0].off && S[1].off ? 'off' : 'error');
    return S;
  }
  /* 読めなかった側の中身。その列で1回だけ言う。「準備中」は失敗の色にしない（やり直しても同じ ＝ ボタンも付かない）。 */
  function sideFail(x) { return el('span', x.off ? 'crl-none' : 'crl-none crl-side-err', x.off ? T.off : T.err); }
  function blankCell() { return el('span', 'crl-blank'); }
  /* 何行もある格子：読めなかった側は、列のいちばん上で1回だけ言う。以降のその列のマスは空（0 も「未取得」も置かない）。 */
  function cmpFailRow(g, S) {
    if (S[0].ok && S[1].ok) return;
    cmpRow(g, null, S[0].ok ? blankCell() : sideFail(S[0]), S[1].ok ? blankCell() : sideFail(S[1]));
  }
  /* 片方だけ読めなかった時の印。run() が「やり直す」を欄に1つ足す（読めた側は出したまま）。 */
  function partial(v, S) { v.retry = S.some(function (x) { return !x.ok && !x.off; }); return v; }

  /* 開いていない会社の中身。言い方と入口は lockView のものをそのまま借りる（ここに写さない）。 */
  function closedNodes(word, box) {
    return Promise.resolve(lockView(word, '', box, null)).then(function (v) { return v.nodes; });
  }
  /* 片方の会社だけ開いている（か、片方が読めなかった）ときの形：2列をやめ、会社ごとに上下へ並べる。
     parts[i] ＝ その会社の中身（節の配列か、その約束）。null の会社は並べない（すぐ上の欄が同じ1行を言っている）。
     ⚠️ 開いていない会社の答えは届いていない（返事は状態の1語だけ）。ここで作る値は無い。 */
  function splitView(ids, parts, S) {
    return Promise.all(parts).then(function (p) {
      var w0 = el('div', 'crl-split');
      p.forEach(function (nodes, i) {
        if (!nodes) return;
        var c = el('div', 'crl-split-c');
        c.setAttribute('data-airline', ids[i]);
        c.appendChild(coTag(ids[i]));
        nodes.forEach(function (n) { if (n) c.appendChild(n); });
        w0.appendChild(c);
      });
      return partial(view('open', [w0]), S);
    });
  }
  /* 1社ぶんの月の勤務（今までの6マス。比較の欄は帯を描かない）。 */
  function workPlain(by) {
    var g = el('div', 'crl-work');
    T.work.forEach(function (it) {
      var c = el('div', 'crl-wk');
      c.appendChild(workName(it));
      c.appendChild(workCell(by, it.k));
      g.appendChild(c);
    });
    return g;
  }
  /* 1社ぶんの回答。行の部品は集計の欄と同じ（answer / answerNode）。 */
  function factList(map, V, keys) {
    var list = el('div', 'crl-facts'), n = 0;
    keys.forEach(function (k) {
      var ans = answer(map[k], V[k]);
      if (!ans) return;
      var r = el('div', 'crl-fact');
      r.appendChild(el('span', 'crl-fact-k', V[k].ja || ''));
      r.appendChild(answerNode(ans));
      list.appendChild(r);
      n++;
    });
    return n ? list : msg(T.factEmpty);
  }
  /* 会社ごとに、サーバーが決めた状態で描く（見せてよいかはサーバーの1か所。ここに決まりを持たない）。
       2社とも開いている → 今までの2列／2社とも開いていない（2社とも読めた）→ 欄に1行（言い方と入口は lockView・語の順は shut）／
       片方だけ開いている・片方が読めなかった → 会社ごとに上下へ（開いている会社はその会社の値、もう片方はその1行と答えるカード） */
  KIND['cmp-work'] = function (box, ids) {
    return both(workView, ids).then(needOne).then(function (S) {
      var st = S.map(function (s) { return s.ok ? s.v.state : 'fail'; });
      var open = [st[0] === 'open', st[1] === 'open'];
      if (open[0] && open[1]) {
        var A = S[0].v, B = S[1].v;
        /* 片方がそろっていなくても、もう片方は普通に出す */
        if (!workAny(A.by) && !workAny(B.by)) return view('empty', [msg(T.workEmpty)]);
        var g = cmpGrid(ids);
        T.work.forEach(function (it) { cmpRow(g, workName(it), workCell(A.by, it.k), workCell(B.by, it.k)); });
        return view('open', [g]);
      }
      /* どちらも開いていない（2社とも読めた）：欄に1行。言い方と入口は lockView のまま */
      if (S[0].ok && S[1].ok && !open[0] && !open[1]) return lockView(shut(st[0], st[1]), '', box, null);
      /* 片方だけ開いている／片方が読めなかった：会社ごとに上下へ */
      return splitView(ids, S.map(function (s, i) {
        if (!s.ok) return [sideFail(s)];
        if (open[i]) return [workAny(s.v.by) ? workPlain(s.v.by) : msg(T.workEmpty)];
        return closedNodes(st[i], box);
      }), S);
    });
  };

  /* ── 比較：提出された年収 ──────────────────────────────────
     REAL PAY と同じ一覧を、2社の列に分けて並べるだけ。ここで足さない・平均しない・並べ替えない・機材で絞らない
     （数えるのは返ってきた行の本数だけ）。中央値はサーバーが出した額をそのまま置く（db/company-pay.sql）。
     会社の名前はここに1つも書かない（どの2社でも同じ道を通る）。 */
  var PAY_TOP = 5;                                  // 6行目からは畳む（オーナーのご指示 2026-10-11）
  /* この面でただ1つの、給与の入口。形はサイト共通の「Give & Get」（pv-gg.css）。 */
  function cmpPayEntry() { return give2(T.payUnlock, UP + 'pay-report.html'); }
  function rankName(pos, D) {
    for (var i = 0; i < T.workPos.length; i++) if (T.workPos[i][0] === pos) return T.workPos[i][1];
    return D.pos[pos] || '';
  }
  function payRanks(a, b) {                         // 機長・副操縦士、そのあと返ってきた順。職位の書いていない行は比較に出さない
    var out = T.workPos.map(function (p) { return p[0]; });
    a.concat(b).forEach(function (r) { var k = r.pos || ''; if (k && out.indexOf(k) < 0) out.push(k); });
    return out;
  }
  function foldsOpen(box) {                         // 描き直す前に開いていた畳み（会社|職位）
    var out = [], all = box.querySelectorAll('.crl-pc > details.crl-more[open]');
    for (var i = 0; i < all.length; i++) {
      var c = all[i].parentNode;
      out.push((c.getAttribute('data-airline') || '') + '|' + (c.getAttribute('data-pos') || ''));
    }
    return out;
  }
  function payCell(list, slug, pos, D, keep) {
    var c = el('div', 'crl-pc');
    c.setAttribute('data-airline', slug);
    if (pos != null) c.setAttribute('data-pos', pos);
    if (!list.length) { c.appendChild(msg(T.payEmpty)); return c; }
    c.appendChild(payCount(list.length));
    if (!D) return c;                               // 開いていない人：本数だけ（行も板も作らない）
    var ul = el('ul', 'crl-rows');
    list.slice(0, PAY_TOP).forEach(function (r) { ul.appendChild(payRow(r, D, true)); });
    c.appendChild(ul);
    if (list.length > PAY_TOP) {
      var dt = el('details', 'crl-more'), sm = el('summary', 'crl-more-s');
      sm.appendChild(el('span', '', T.payMore(list.length)));
      sm.appendChild(icon('down', 14));
      dt.appendChild(sm);
      var rest = el('ul', 'crl-rows');
      list.slice(PAY_TOP).forEach(function (r) { rest.appendChild(payRow(r, D, true)); });
      dt.appendChild(rest);
      if (keep.indexOf(slug + '|' + pos) >= 0) dt.open = true;   // 通貨を替えて描き直しても、開けた畳みは開けたまま
      c.appendChild(dt);
    }
    var name = rankName(pos, D);
    var go = link(T.payAll, UP + 'actual-pay.html?air=' + enc(slug) + (pos ? '&pos=' + enc(pos) : ''));
    go.setAttribute('aria-label', coName(slug) + (name ? ' ' + name : '') + ' ' + T.payAll);
    c.appendChild(foot([go]));
    return c;
  }
  /* 会社 × 職位の中央値。出すのはサーバー（db/company-pay.sql の pv_company_pay）── 誰に返すかも、人数の壁も向こうが決める。
     ここは、開いた答えの中の「その2社（会社ページでは1社）・機長と副操縦士」の額だけを受け取り、ほかは持たない（人数は来ない・出さない）。
     ★2026-10-30 25%・75%（p25_usd・p75_usd ── 人数のそろった区分にだけ来る）も受け取る。2つそろって中央値を挟む時だけ持つ。
       b を渡さなければ1社（会社ページ）── 聞くのは { airlines: [a] }。2社の聞き方・鍵の名前は今までのまま。 */
  function companyMed(a, b) {
    var list = b ? [a, b] : [a];
    return once('cmed:' + (!b ? a : a < b ? a + '|' + b : b + '|' + a), function (sig) {
      return client().then(function (sb) {
        return cut(sb.rpc('pv_company_pay', { p: { airlines: list } }), sig);
      }).then(function (res) {
        if (!res || res.error) throw sbErr(res);
        var x = res.data;
        if (!x || x.ok === false) throw fail('error');
        if (x.state !== 'open') return { st: 'locked', floor: null, from: '', to: '', by: {} };
        var per = x.period || {}, src = x.airlines || {}, by = {};
        if (!isNum(x.floor) || !ym(per.from) || !ym(per.to)) throw fail('error');   // 定義の1行が組めない答えは使わない
        list.forEach(function (slug) {
          var c = src[slug] || {}, o = {};
          T.workPos.forEach(function (p) {
            var k = c[p[0]], v = (k && k.s === 'ok') ? Number(k.median_usd) : NaN;
            var lo = k && k.s === 'ok' ? Number(k.p25_usd) : NaN, hi = k && k.s === 'ok' ? Number(k.p75_usd) : NaN;
            o[p[0]] = (isFinite(v) && v > 0) ? { usd: v } : null;
            if (o[p[0]] && isFinite(lo) && isFinite(hi) && lo > 0 && lo <= v && v <= hi) { o[p[0]].lo = lo; o[p[0]].hi = hi; }
          });
          by[slug] = o;
        });
        return { st: 'open', floor: x.floor, from: ym(per.from), to: ym(per.to), by: by };
      });
    });
  }
  function medCell(c) {
    var m = el('div', 'crl-med');
    if (!c) { m.appendChild(el('span', 'crl-none', T.none)); return m; }
    var v = el('b', 'crl-amt pv-no-cur', money(c.usd) || '—');
    v.setAttribute('data-agg', '');
    m.appendChild(v);
    return m;
  }
  /* 中央値の器。空で隠したまま欄に入れ、答えが来たら「この器にだけ」書く。
     ⚠️ ここから box へ書かない・セレクタで探さない ── 会社を替えたあとに届いた古い答えが、新しい2社の欄へ入る。 */
  function aggBlock() {
    var a = el('div', 'crl-agg');
    a.setAttribute('data-kind', 'aggregate');
    a.hidden = true;
    return a;
  }
  /* 中央値の「やり直す」を押した人の居場所（キーボード）。押したボタンは描き直しで消えるので、答えが来たら、その器の見出し
     「中央値」へ移す（もう一度読めなかったら次の「やり直す」へ・器に何も出ない答えなら欄へ）。動かすのは、押したその1回の
     描き直しの器だけ（box._crlMed ＝ その回の番号）── 通貨の切り替えや会社の選び直しの描き直しでは動かさない。 */
  function medBack(box, tok, agg, t) {
    if (!tok || box._crlMed !== tok || box._crlTok !== tok || !box.contains(agg)) return;
    box._crlMed = 0;
    var at = d.activeElement;
    if (at && at !== d.body && at !== d.documentElement) return;   // 待つあいだに読み手が自分で動いた先からは、引き戻さない
    if (t.tagName !== 'BUTTON') t.setAttribute('tabindex', '-1');
    try { t.focus({ preventScroll: true }); } catch (e) { /* フォーカスを移せないブラウザでは、今までどおり */ }
  }
  function aggFill(agg, ids, box) {
    var tok = box._crlTok;
    companyMed(ids[0], ids[1]).then(function (M) {
      if (M.st !== 'open') return medBack(box, tok, agg, box);   // 開いていない答えからは何も描かない
      var rows = [];
      T.workPos.forEach(function (p) {
        var a = M.by[ids[0]][p[0]], b = M.by[ids[1]][p[0]];
        if (!a && !b) return;                       // 両社とも人数が足りない職位は、行ごと出さない
        rows.push([p, a, b]);
      });
      if (!rows.length) return medBack(box, tok, agg, box);
      var h = el('h3', 'crl-agg-h', T.median);
      agg.appendChild(h);
      rows.forEach(function (x) {
        var row = cmpRow(agg, el('span', '', x[0][1]), medCell(x[1]), medCell(x[2])) || agg.lastChild;
        row.setAttribute('data-med', x[0][0]);
      });
      var def = el('p', 'crl-def', T.medDef(M.from, M.to, M.floor));
      def.setAttribute('data-def', 'median');
      agg.appendChild(def);
      agg.hidden = false;
      medBack(box, tok, agg, h);
    }, function (e) {
      var h = el('h3', 'crl-agg-h', T.median), rb = null;
      agg.appendChild(h);
      if (e && e.crl === 'off') agg.appendChild(msg(T.off));
      else {
        agg.appendChild(msg(T.err));
        /* この欄は「開いた」のまま（retryAll は拾わない）ので、押したらこの欄だけを描き直す。
           形と字は共通の retryBtn() の写し（cloneNode は押した時の動きを持ってこない ＝ 動きはここで1つだけ付ける） */
        rb = retryBtn().cloneNode(true);
        rb.addEventListener('click', function () {
          var back = d.activeElement === rb;
          run(box, 'cmp-pay', box.getAttribute('data-for') || '', true);
          if (back) box._crlMed = box._crlTok;     // run がいま付けた番号 ＝ この描き直し
        });
        agg.appendChild(rb);
      }
      agg.hidden = false;
      medBack(box, tok, agg, rb || h);
    });
  }
  KIND['cmp-pay'] = function (box, ids) {
    var keep = foldsOpen(box), keepAll = !!box.querySelector('details.crl-pay-fold[open]');
    return Promise.all([payRows(), dict()]).then(function (r) {
      var pay = r[0], D = r[1], A = ofCo(pay.rows, ids[0]), B = ofCo(pay.rows, ids[1]);
      var g = cmpGrid(ids), none = !A.length && !B.length;
      if (!pay.open) {
        cmpRow(g, null, payCell(A, ids[0], null, null, keep), payCell(B, ids[1], null, null, keep));
        var feet = foot([cmpPayEntry(), pay.who === 'guest' ? loginLink() : null]);
        if (none) return view('empty', [g, feet]);
        /* ★2026-10-30 件数の下に、図の影絵（決まった形・字も数字も無い ── 額は届いていない） */
        return view('locked', [g, ghostPay(), lockLine(pay.who === 'expired' ? T.payExpired : T.payLock), feet]);
      }
      if (none) {
        cmpRow(g, null, payCell(A, ids[0], null, null, keep), payCell(B, ids[1], null, null, keep));
        return view('empty', [g]);
      }
      var agg = aggBlock();
      g.appendChild(agg);                           // 会社の札の下・図と畳んだ行の上
      /* ★2026-10-30 中央値の下に、会社ごとの年収の幅の棒（同じ目盛）。答えは中央値と同じ1本（companyMed） */
      var rg = rangeBlock();
      g.appendChild(rg);
      var yd = ydBlock(A, B, ids);
      if (yd) g.appendChild(yd);
      /* ★2026-10-30 図の下に、2社の月の給与の内訳（pv_company_comp）。読めない・口が無い時は何も出さない */
      var dn = compBlock();
      g.appendChild(dn);
      /* ★2026-10-29 オーナー「給与の詳細（提出した）数字は押したら出てくる形にして」── 1件ずつの行は畳む（押すと開く）。
         通貨を替えて描き直しても、開けたものは開けたまま（keepAll） */
      var fold = el('details', 'crl-pay-fold'), fs = el('summary', 'crl-pay-fold-s'), rowsG = el('div', 'crl-cmp crl-pay-rows'), shown = 0;
      payRanks(A, B).forEach(function (pos) {
        var a = A.filter(function (x) { return (x.pos || '') === pos; }), b = B.filter(function (x) { return (x.pos || '') === pos; });
        var named = T.workPos.some(function (p) { return p[0] === pos; });
        if (!a.length && !b.length && !named) return;
        shown += a.length + b.length;
        var name = rankName(pos, D);
        if (name) { var h = el('h3', 'crl-pr-h', name); h.setAttribute('data-pos', pos); rowsG.appendChild(h); }
        var row = cmpRow(rowsG, null, payCell(a, ids[0], pos, D, keep), payCell(b, ids[1], pos, D, keep)) || rowsG.lastChild;
        row.setAttribute('data-rows', pos);
      });
      fs.appendChild(el('span', '', T.payOpen(shown)));
      fs.appendChild(icon('down', 14));
      fold.appendChild(fs);
      fold.appendChild(rowsG);
      var def = el('p', 'crl-def', T.payDef);
      def.setAttribute('data-def', 'rows');
      fold.appendChild(def);
      if (keepAll) fold.open = true;
      g.appendChild(fold);
      aggFill(agg, ids, box);                       // 待たない（行はすぐ出る。中央値は答えが来たら器に入る）
      rangeFill(rg, ids);
      compFill(dn, ids, box);
      return view('open', [g]);
    }, function (e) {
      /* 読めなかった時も、給与の入口は残す（この面でただ1つの入口。読み手が誰かは分からないので「ログイン」は出さない） */
      var feet = foot([cmpPayEntry()]);
      if (e && e.crl === 'off') return view('off', [msg(T.off), feet]);
      return view('error', [msg(T.err), retryBtn(), feet]);
    });
  };

  /* ── 昇格後の年数ごとの年収（比較の「提出された年収」の図 ── 2026-10-29 オーナー「CAP,COPの年次ごとの給与分布のグラフを入れたほうが」）──
     材料は、いま開いている読み手に届いた行（pv_pay_rows の open）だけ ＝ 下の「提出された数字」と同じ行・同じ額（有効数字2桁）。新しく聞かない・
     作らない・足さない。閉じた読み手には額が届いていないので、図そのものを作らない（置くのは字も数字も無い決まった影絵 ghostPay だけ）。
     ★x は昇格後の年数の5段（ten・tenk 'r'）だけ。在籍年数しか無い古い行（tenk 's'）は同じ目盛に置かない（「昇格後」と名乗らせない ── 行の札と同じ決まり）。
     ★y は2社・2職位で1本の目盛（0 から・機長と副操縦士で同じ）── 図どうしで高さが比べられる。目盛の字は PVCurrency の表記。
     ★1つの点 ＝ 1件の提出。点を押すと（指はタップ）その額の札が出る。会社の色は札（.crl-co）と同じ。色の近い2社は右の会社が輪（career.css の data-near）。
     ★人数・平均・中央値をここで数えない（中央値はサーバーの pv_company_pay の1か所）。ここでの計算は、点を置く位置と目盛の刻みだけ。
       そのため給与の区画（var PAY_TOP から ── 足さない・並べ替えない・計算しない区画。assert-career.mjs）の外に置いてある。呼ぶのは開いた答えの KIND['cmp-pay'] だけ
     ★2026-10-30 1社（B を渡さない ── 会社ページ）でも同じ道。opt.pos の職位の図を1つだけ・凡例なし・点は会社の色（島が無ければ緑）・横に2列へずらさない。
       opt.band（companyMed の1社・1職位の { usd, lo?, hi? }）があれば、まんなか半分の帯と中央値の線を重ね、右の端に名前を置く（目盛は帯も入れて決める）。
       2社の図は1文字も変えない（assert-career-live.mjs の比較の図の場面）。 */
  var YD_BANDS = 5;
  function ydNice(v) {                              // 目盛の刻み（1・2・2.5・5 × 10^k）
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), m = v / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }
  /* その職位に、図に置ける点があるか（下の ydBlock の点の決まりと同じ） */
  function ydHas(L, pos) {
    return L.some(function (r) {
      return (r.pos || '') === pos && Number(r.annual_usd) > 0 && isNum(r.ten) && r.ten >= 0 && r.ten < YD_BANDS && r.tenk !== 's';
    });
  }
  function ydBlock(A, B, ids, opt) {
    var C = w.PVCurrency;
    if (!C || !C.rates || typeof C.fmt !== 'function') return null;
    var rate = C.rates[C.get()] || 1, usd = C.rates.USD || 1;
    function val(r) { var n = sig2(Number(r.annual_usd) * usd / rate); return n > 0 ? n : 0; }   // 表示の通貨の額（行の額と同じ丸め）
    var one = !B, LS = one ? [A] : [A, B];
    var P = one ? T.workPos.filter(function (p) { return p[0] === (opt && opt.pos); }) : T.workPos;
    var bd = one && opt && opt.band ? bandIn(opt.band, usd, rate) : null;   // 帯（表示の通貨・行の額と同じ丸め）
    var old = 0, sets = {}, top = bd ? (bd.hi || bd.med) : 0;
    P.forEach(function (p) {
      sets[p[0]] = LS.map(function (L) {
        return L.filter(function (r) {
          if ((r.pos || '') !== p[0] || !(Number(r.annual_usd) > 0) || !isNum(r.ten) || r.ten < 0 || r.ten >= YD_BANDS) return false;
          if (r.tenk === 's') { old++; return false; }
          return true;
        }).map(function (r) { var v = val(r); if (v > top) top = v; return { r: r, v: v }; }).filter(function (x) { return x.v > 0; });
      });
    });
    var any = !!bd || P.some(function (p) { return sets[p[0]].some(function (S) { return S.length > 0; }); });
    if (!any || !(top > 0)) return null;
    var step = ydNice(top / 4), max = Math.ceil(top / step) * step;
    if (max <= top) max += step;                    // いちばん上の点が枠の縁に乗らない
    var wrap = el('div', 'crl-yd');
    wrap.setAttribute('data-kind', 'years');
    if (one) wrap.setAttribute('data-n', '1');
    wrap.appendChild(el('h3', 'crl-yd-tt', T.ydHead));   // 中央値の見出し（crl-agg-h）とは別の印 ── 中央値を数える側に混ざらない
    if (!one) {
      var lg = el('div', 'crl-yd-lg');
      lg.setAttribute('aria-hidden', 'true');
      lg.appendChild(coTag(ids[0])); lg.appendChild(coTag(ids[1]));
      wrap.appendChild(lg);
    }
    var figs = el('div', 'crl-yd-figs');
    P.forEach(function (p) {
      var S = sets[p[0]];
      if (!bd && !S.some(function (L) { return L.length > 0; })) return;
      var f = el('figure', 'crl-yd-f');
      f.setAttribute('data-pos', p[0]);
      /* 1社で職位の切り替えが在る時は、図の名前は読み上げだけ（見出しは切り替えのボタンが言っている） */
      f.appendChild(el('figcaption', one && opt.pick ? 'crl-yd-h crl-sr' : 'crl-yd-h', p[1]));
      var plot = el('div', 'crl-yd-plot'), yax = el('div', 'crl-yd-y'), area = el('div', 'crl-yd-a');
      yax.setAttribute('aria-hidden', 'true');
      for (var t = 0; t <= max + step / 2; t += step) {
        var pc = (t / max * 100).toFixed(2) + '%';
        var lb = el('span', 'crl-yd-t pv-no-cur', t ? C.fmt(t * rate) : '0');
        lb.style.bottom = pc; yax.appendChild(lb);
        var gl = el('i', 'crl-yd-g'); gl.style.bottom = pc; area.appendChild(gl);
      }
      for (var k = 1; k < YD_BANDS; k++) { var sep = el('i', 'crl-yd-s'); sep.style.left = (k * 100 / YD_BANDS) + '%'; area.appendChild(sep); }
      if (bd) bandDraw(f, area, bd, max);
      S.forEach(function (L, col) {
        var by = [];                                // 段ごとに額の順（同じ段の点は横に少しずつ並べる ── 並びは決まっていて、乱数は使わない）
        L.forEach(function (x) { (by[x.r.ten] = by[x.r.ten] || []).push(x); });
        by.forEach(function (xs, band) {
          if (!xs) return;
          xs.sort(function (a, b) { return a.v - b.v; });
          xs.forEach(function (x, i) {
            var spread = Math.min(2.2, 6 / Math.max(1, xs.length - 1));
            var left = band * 100 / YD_BANDS + (one ? 10 : col ? 13.5 : 6.5) + (xs.length > 1 ? (i - (xs.length - 1) / 2) * spread : 0);
            var amt = C.fmt(x.v * rate);
            var tip = (one ? '' : coName(ids[col]) + ' · ') + T.ydX[band] + ' · ' + amt + (x.r.verified ? ' · ' + T.vfYes : '') + (x.r.far === true ? ' · ⚠︎ ' + T.ydFar : '');
            var dot = el('button', 'crl-yd-d pv-no-cur');
            dot.type = 'button';
            dot.setAttribute('data-col', String(col + 1));
            /* 札を枠の外へ出さない向き。1社の図は狭い箱にも置くので、端の段だけを寄せる（まんなかの3段は点の上のまんなか） */
            dot.setAttribute('data-edge', one ? (band < 1 ? 'l' : band > 3 ? 'r' : 'c') : band < 2 ? 'l' : band > 2 ? 'r' : 'c');
            dot.setAttribute('data-tip', tip);
            dot.setAttribute('aria-label', tip);
            dot.style.left = left.toFixed(2) + '%';
            dot.style.bottom = (x.v / max * 100).toFixed(2) + '%';
            var c = companies()[ids[col]];
            if (c && typeof c.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(c.color)) dot.style.setProperty('--crl-co', c.color);
            area.appendChild(dot);
          });
        });
      });
      plot.appendChild(yax); plot.appendChild(area);
      if (bd) plot.appendChild(bandSide(bd, max));
      f.appendChild(plot);
      var xs = el('div', 'crl-yd-x');
      xs.setAttribute('aria-hidden', 'true');
      /* 目盛の字は2通り置き、CSS が幅で片方だけ見せる（狭い1社の図では「年」を外して軸の名前へ ── 字が語の途中で折れない） */
      T.ydX.forEach(function (s, i) {
        var x = el('span', '');
        x.appendChild(el('span', 'crl-yd-xl', s));
        x.appendChild(el('span', 'crl-yd-xs', T.ydXs[i]));
        xs.appendChild(x);
      });
      f.appendChild(xs);
      var ax = el('p', 'crl-yd-ax');
      ax.appendChild(el('span', 'crl-yd-axl', T.ydAxis));
      ax.appendChild(el('span', 'crl-yd-axs', T.ydAxisS));
      f.appendChild(ax);
      if (bd) f.appendChild(bandKey(bd, rate));
      figs.appendChild(f);
    });
    wrap.appendChild(figs);
    var note = el('p', 'crl-yd-note', T.ydNote(old));
    wrap.appendChild(note);
    return wrap;
  }
  /* 帯の額を表示の通貨へ（点と同じ丸め ── sig2）。25%・75% は2つそろった時だけ（companyMed がそろえて渡す） */
  function bandIn(c, usd, rate) {
    function v(x) { var n = sig2(Number(x) * usd / rate); return n > 0 ? n : 0; }
    var o = { med: v(c.usd), lo: 0, hi: 0 };
    if (!o.med) return null;
    if (isNum(c.lo) && isNum(c.hi)) { o.lo = v(c.lo); o.hi = v(c.hi); }
    if (!(o.lo && o.hi && o.lo <= o.med && o.med <= o.hi)) { o.lo = 0; o.hi = 0; }
    return o;
  }
  function bandDraw(f, area, bd, max) {
    f.setAttribute('data-band', bd.lo ? 'range' : 'median');
    if (bd.lo) {
      var bx = el('i', 'crl-yd-bd');
      bx.style.bottom = (bd.lo / max * 100).toFixed(2) + '%';
      bx.style.height = ((bd.hi - bd.lo) / max * 100).toFixed(2) + '%';
      area.appendChild(bx);
    }
    var ml = el('i', 'crl-yd-md');
    ml.style.bottom = (bd.med / max * 100).toFixed(2) + '%';
    area.appendChild(ml);
  }
  /* 右の端の名前（25%・中央値・75%）。近すぎる時だけ、字が重ならないように上下へ離す（線の位置は動かさない） */
  function bandSide(bd, max) {
    var side = el('div', 'crl-yd-r');
    side.setAttribute('aria-hidden', 'true');
    var at = bd.lo ? [[0, bd.lo], [1, bd.med], [2, bd.hi]] : [[1, bd.med]], GAP = 9;
    var y = at.map(function (x) { return x[1] / max * 100; });
    for (var i = 1; i < y.length; i++) if (y[i] - y[i - 1] < GAP) y[i] = y[i - 1] + GAP;
    if (y[y.length - 1] > 96) { y[y.length - 1] = 96; for (var j = y.length - 2; j >= 0; j--) if (y[j + 1] - y[j] < GAP) y[j] = y[j + 1] - GAP; }
    at.forEach(function (x, n) {
      var s = el('span', 'crl-yd-rl', T.ydBand[x[0]]);
      s.setAttribute('data-k', ['lo', 'med', 'hi'][x[0]]);
      s.style.bottom = y[n].toFixed(2) + '%';
      side.appendChild(s);
    });
    return side;
  }
  /* 図の下の1行：25% の額 · 中央値の額 · 75% の額（字は PVCurrency の表記） */
  function bandKey(bd, rate) {
    var C = w.PVCurrency, p = el('p', 'crl-yd-key');
    (bd.lo ? [[0, bd.lo], [1, bd.med], [2, bd.hi]] : [[1, bd.med]]).forEach(function (x, i) {
      if (i) p.appendChild(d.createTextNode(T.ydSep));
      var s = el('span', 'crl-yd-kv');
      s.setAttribute('data-k', ['lo', 'med', 'hi'][x[0]]);
      s.appendChild(el('span', 'crl-yd-kk', T.ydBand[x[0]]));
      s.appendChild(d.createTextNode(' '));
      s.appendChild(el('b', 'pv-no-cur', C.fmt(x[1] * rate)));
      p.appendChild(s);
    });
    return p;
  }

  /* ── 月の給与の内訳（ドーナツ）── 2026-10-30 オーナー。サーバーは pv_company_pay と同じ門の pv_company_comp
     （会社 × 職位ごとに、区分の割合 pct と月の平均額 avg_usd ── 人数の壁は向こう）。
     ★割合も平均もここで作らない（サーバーの数のまま。ここでの計算は円の弧の長さと、額を表示の通貨へ直すことだけ）。
     ★読めない・口が無い（PGRST202）・鍵の無い答え・形の合わない区分（割合が整数でない・合計が 100 でない・知らない鍵）は、描かないだけ。
     色は給与の円（pay-viz.js の SEG）と同じ ── 同じ区分を、マイページと同じ色で出す。 */
  var DN_KEYS = ['base', 'guarantee', 'variable', 'command', 'role', 'perdiem', 'housing', 'other', 'rest'];
  var DN_COL = { base: '#34d399', guarantee: '#a3e635', variable: '#f5c842', command: '#5fb0ff', role: '#e8604c',
                 perdiem: '#f472b6', housing: '#fb923c', other: '#a78bfa', rest: '#5c6675' };
  function compCell(c) {
    if (!c || c.s !== 'ok' || !isArr(c.segs)) return null;
    var out = [], sum = 0, seen = {};
    for (var i = 0; i < c.segs.length; i++) {
      var g = c.segs[i] || {};
      if (DN_KEYS.indexOf(g.k) < 0 || seen[g.k] || !isInt(g.pct) || g.pct < 0 || g.pct > 100) return null;
      seen[g.k] = 1;
      sum += g.pct;
      if (g.pct > 0) out.push({ k: g.k, pct: g.pct, usd: isNum(g.avg_usd) && g.avg_usd > 0 ? g.avg_usd : null });
    }
    return sum === 100 && out.length ? { segs: out } : null;
  }
  function companyComp(list) {
    return once('ccomp:' + list.slice().sort().join('|'), function (sig) {
      return client().then(function (sb) {
        return cut(sb.rpc('pv_company_comp', { p: { airlines: list } }), sig);
      }).then(function (res) {
        if (!res || res.error) throw sbErr(res);
        var x = res.data;
        if (!x || x.ok === false) throw fail('error');
        if (x.state !== 'open') return { st: 'locked', from: '', to: '', by: {} };
        var per = x.period || {}, src = x.airlines || {}, by = {};
        list.forEach(function (slug) {
          var c = src[slug] || {}, o = {};
          T.workPos.forEach(function (p) { o[p[0]] = compCell(c[p[0]]); });
          by[slug] = o;
        });
        return { st: 'open', from: ym(per.from), to: ym(per.to), by: by };
      });
    });
  }
  function donut(cell) {
    var box = el('div', 'crl-dn-f');
    var R = 52, SW = 20, CIR = 2 * Math.PI * R, acc = 0;
    var svg = svgEl('svg', 'crl-dn-svg', { viewBox: '0 0 132 132', width: '132', height: '132', focusable: 'false', 'aria-hidden': 'true' });
    svg.appendChild(svgEl('circle', 'crl-dn-bg', { cx: '66', cy: '66', r: String(R), fill: 'none', 'stroke-width': String(SW) }));
    var ul = el('ul', 'crl-dn-lg');
    cell.segs.forEach(function (s) {
      var len = s.pct / 100 * CIR;
      svg.appendChild(svgEl('circle', 'crl-dn-arc', { cx: '66', cy: '66', r: String(R), fill: 'none', stroke: DN_COL[s.k], 'stroke-width': String(SW),
        'stroke-dasharray': len.toFixed(2) + ' ' + (CIR - len).toFixed(2), 'stroke-dashoffset': (-acc).toFixed(2), transform: 'rotate(-90 66 66)', 'data-k': s.k }));
      acc += len;
      var li = el('li', 'crl-dn-li');
      li.setAttribute('data-k', s.k);
      var chip = el('i', 'crl-dn-c');
      chip.style.background = DN_COL[s.k];
      li.appendChild(chip);
      li.appendChild(el('span', 'crl-dn-n', T.dnSeg[s.k]));
      li.appendChild(el('b', 'crl-dn-p', s.pct + '%'));
      var amt = money(s.usd);
      if (amt) li.appendChild(el('span', 'crl-dn-a pv-no-cur', amt));
      ul.appendChild(li);
    });
    box.appendChild(svg);
    box.appendChild(ul);
    return box;
  }
  /* 機長／副操縦士の切り替え（図とドーナツで1つ）。押した時は pick(職位, そのボタンにフォーカスが在ったか) */
  function posPicker(list, cur, pick) {
    var g = el('div', 'crl-pv-pos');
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', T.posPick);
    list.forEach(function (p) {
      var b = el('button', 'crl-pv-pb', p[1]);
      b.type = 'button';
      b.setAttribute('data-pos', p[0]);
      b.setAttribute('aria-pressed', p[0] === cur ? 'true' : 'false');
      b.addEventListener('click', function () { if (p[0] !== cur) pick(p[0], d.activeElement === b); });
      g.appendChild(b);
    });
    return g;
  }
  function pickBack(wrap, pos) {
    var b = wrap.querySelector('.crl-pv-pb[data-pos="' + pos + '"]');
    if (b) { try { b.focus({ preventScroll: true }); } catch (e) { /* フォーカスを移せないブラウザでは、今までどおり */ } }
  }

  /* 会社ページの、給与の鍵の開いた人の図（2026-10-30 オーナー）。呼ぶのは KIND.realpay の開いた答え（GL）だけ。
     年数の図（1社の ydBlock）・その職位の帯（companyMed の1社）・月の給与の内訳（companyComp の1社）。職位の切り替えは1つ。
     行はすぐ出す。帯とドーナツは答えが来たら、この器（pv）にだけ描き直す ── box へ書かない・セレクタで探さない（読む人が替わったあとに届いた
     古い答えが、新しい欄へ入らない）。選んだ職位は box に残す（通貨を替えて描き直しても同じ職位）。両方の答えが済んだら data-pv="done"。 */
  function payViz(box, slug, rows) {
    var pv = el('div', 'crl-pv'), S = { M: null, med: null, comp: null, from: '', to: '' };
    pv.setAttribute('data-pv', 'wait');
    function draw(back) {
      clear(pv);
      var have = T.workPos.filter(function (p) {
        return ydHas(rows, p[0]) || !!(S.med && S.med[p[0]]) || !!(S.comp && S.comp[p[0]]);
      });
      pv.hidden = !have.length;
      if (!have.length) return;
      var pos = box._crlPos;
      if (!have.some(function (p) { return p[0] === pos; })) pos = have[0][0];
      var pick = have.length > 1;
      /* ★2026-10-30 オーナー「棒グラフもだして」── いちばん上に年収の幅のカード（機長・副操縦士の2本を同じ目盛で ── 職位の切り替えに関係なく2本とも）。
         額は companyMed の答え（S.M）だけ（比較の rangeDraw と同じ道・聞き直さない） */
      if (S.M) {
        var rg = rangeBlock();
        if (rangeDraw(rg, S.M, [slug])) { rg.hidden = false; pv.appendChild(rg); }
      }
      if (pick) {
        pv.appendChild(posPicker(have, pos, function (k, f) { box._crlPos = k; draw(f ? k : ''); }));
      }
      /* 年数の図と内訳の円は1つの器（.crl-pv-g）に入れる ── 広い画面（PC・iPad）では左右に並ぶ（2026-10-30 オーナー）。狭い画面は縦 */
      var g = el('div', 'crl-pv-g');
      var yd = ydBlock(rows, null, [slug], { pos: pos, band: S.med && S.med[pos], pick: pick });
      if (yd) g.appendChild(yd);
      var cell = S.comp && S.comp[pos];
      if (cell) {
        var dn = el('div', 'crl-dn');
        dn.setAttribute('data-pos', pos);
        dn.appendChild(el('h3', 'crl-dn-h', T.dnHead + (pick ? '' : ' · ' + have[0][1])));
        dn.appendChild(donut(cell));
        if (S.from && S.to) dn.appendChild(el('p', 'crl-def', T.dnDef(S.from, S.to)));
        g.appendChild(dn);
      }
      if (g.firstChild) pv.appendChild(g);
      if (back) pickBack(pv, back);
    }
    draw('');
    var a = companyMed(slug).then(function (M) { S.M = M; S.med = M.st === 'open' ? M.by[slug] : null; draw(''); }, function () { /* 帯と幅の棒を出さないだけ */ });
    var b = companyComp([slug]).then(function (X) {
      if (X.st === 'open') { S.comp = X.by[slug]; S.from = X.from; S.to = X.to; }
      draw('');
    }, function () { /* ドーナツを出さないだけ（口がまだ無い PGRST202 も同じ） */ });
    Promise.all([a, b]).then(function () { pv.setAttribute('data-pv', 'done'); });
    return pv;
  }

  /* ── 比較：会社ごとの年収の幅（2026-10-30）── 中央値の器のすぐ下。2社で1本の目盛（0 から）。25%〜75% の箱と中央値の印。
     25%・75% の来ない区分（人数が少ない）は中央値の印だけ・人数の足りない区分は行ごと出さない。額は companyMed の答えだけ（聞き直さない）。
     ⚠️ 中央値の額の印（data-agg）は付けない ── 中央値を数える側（中央値の器）と混ぜない。 */
  function rangeBlock() {
    var r = el('div', 'crl-rg');
    r.setAttribute('data-kind', 'range');
    r.hidden = true;
    return r;
  }
  function rangeFill(rg, ids) {
    companyMed(ids[0], ids[1]).then(function (M) {
      if (rangeDraw(rg, M, ids)) rg.hidden = false;
    }, function () { /* 中央値の器が「いま読み出せません」を言っている。ここは何も出さない */ });
  }
  /* 1社（会社ページ ── 社名の札は置かない）でも2社でも同じ形。描けたら true（描けない答え・額の無い答えでは何も書かない） */
  function rangeDraw(rg, M, ids) {
    var one = ids.length === 1;
    {
      var C = w.PVCurrency;
      if (M.st !== 'open' || !C || !C.rates || typeof C.fmt !== 'function') return false;
      var rate = C.rates[C.get()] || 1, usd = C.rates.USD || 1, rows = [], top = 0;
      T.workPos.forEach(function (p) {
        var v = ids.map(function (s) { var c = M.by[s] && M.by[s][p[0]]; return c ? bandIn(c, usd, rate) : null; });
        if (!v[0] && !v[1]) return;
        v.forEach(function (x) { if (x && (x.hi || x.med) > top) top = x.hi || x.med; });
        rows.push([p, v]);
      });
      if (!rows.length || !(top > 0)) return false;
      var step = ydNice(top / 4), max = Math.ceil(top / step) * step;
      if (max <= top) max += step;
      rg.appendChild(el('h3', 'crl-rg-tt', T.rgHead));
      rows.forEach(function (x) {
        var sec = el('div', 'crl-rg-p');
        sec.setAttribute('data-pos', x[0][0]);
        sec.appendChild(el('h4', 'crl-rg-h', x[0][1]));
        x[1].forEach(function (v, i) {
          if (!v) return;
          var row = el('div', 'crl-rg-r');
          row.setAttribute('data-airline', ids[i]);
          row.setAttribute('data-col', String(i + 1));
          if (!one) row.appendChild(coTag(ids[i]));
          var tr = el('div', 'crl-rg-t');
          tr.setAttribute('aria-hidden', 'true');
          var c = companies()[ids[i]];
          if (c && typeof c.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(c.color)) tr.style.setProperty('--crl-co', c.color);
          if (v.lo) {
            var bx = el('i', 'crl-rg-b');
            bx.style.left = (v.lo / max * 100).toFixed(2) + '%';
            bx.style.width = ((v.hi - v.lo) / max * 100).toFixed(2) + '%';
            tr.appendChild(bx);
          }
          var md = el('i', 'crl-rg-m');
          md.style.left = (v.med / max * 100).toFixed(2) + '%';
          tr.appendChild(md);
          row.appendChild(tr);
          row.appendChild(bandKey(v, rate));
          sec.appendChild(row);
        });
        rg.appendChild(sec);
      });
      return true;
    }
  }
  /* ── 比較：2社の月の給与の内訳（2026-10-30）── 2社を左右に。職位の切り替えは1つ（2社とも同じ職位）。どちらの会社にも無い職位は選べない。 */
  function compBlock() {
    var r = el('div', 'crl-dn2');
    r.setAttribute('data-kind', 'comp');
    r.hidden = true;
    return r;
  }
  function compFill(dn, ids, box) {
    companyComp([ids[0], ids[1]]).then(function (X) {
      if (X.st !== 'open') return;
      function draw(back) {
        clear(dn);
        var have = T.workPos.filter(function (p) { return ids.some(function (s) { return !!(X.by[s] && X.by[s][p[0]]); }); });
        dn.hidden = !have.length;
        if (!have.length) return;
        var pos = box._crlDnPos;
        if (!have.some(function (p) { return p[0] === pos; })) pos = have[0][0];
        var pick = have.length > 1;
        dn.appendChild(el('h3', 'crl-dn-h', T.dnHead + (pick ? '' : ' · ' + have[0][1])));
        if (pick) dn.appendChild(posPicker(have, pos, function (k, f) { box._crlDnPos = k; draw(f ? k : ''); }));
        var grid = el('div', 'crl-dn2-g');
        ids.forEach(function (s, i) {
          var c = el('div', 'crl-dn2-c');
          c.setAttribute('data-airline', s);
          c.setAttribute('data-col', String(i + 1));
          c.appendChild(coTag(s));
          var cell = X.by[s] && X.by[s][pos];
          c.appendChild(cell ? donut(cell) : el('span', 'crl-none', T.none));
          grid.appendChild(c);
        });
        dn.appendChild(grid);
        if (X.from && X.to) dn.appendChild(el('p', 'crl-def', T.dnDef(X.from, X.to)));
        if (back) pickBack(dn, back);
      }
      draw('');
    }, function () { /* 読めない・口がまだ無い：何も出さない */ });
  }

  /* ── 影絵（2026-10-30 オーナー「残りはぼかして」）── 鍵の無い人の、要約の欄と給与の図の場所に置く、決まった形。
     ★字も数字も持たない・答えを1つも読まない（本物の文や点をぼかしているのではない ── 何も届いていない）。数も幅も固定（CSS の nth-child）。
     ★ぼかしの規則は career-live.css の .crl .crl-ghost の1つだけ。読み上げない（aria-hidden）・触れない（inert）。 */
  function ghost(kind) {
    var g = el('div', 'crl-ghost crl-ghost-' + kind);
    g.setAttribute('aria-hidden', 'true');
    g.setAttribute('inert', '');
    return g;
  }
  /* 気になる点の影絵（2026-10-30 オーナー「悪いところだけぼかしを入れよう」）。cols ＝ 列の数（会社ページは1・比較は2 ＝ 会社の列にそろえる）。
     1列に3本の帯（決まった形・橙）。見出し「気になる点」は影絵の外の本物の字 */
  function ghostBad(cols) {
    var g = ghost('bad');
    for (var c = 0; c < cols; c++) {
      var col = el('div', 'crl-gh-col');
      for (var k = 0; k < 3; k++) col.appendChild(el('i', 'crl-gh-b'));
      g.appendChild(col);
    }
    return g;
  }
  /* まとめの1文（lead）のすぐ後ろ・同じ枠の中に続く、ぼかした3行（2026-10-30 オーナー「1文だけ囲われているとまとめがそれだけみたい。文を続けないと」）。決まった形 */
  function ghostCont() {
    var g = ghost('cont');
    for (var i = 0; i < 3; i++) g.appendChild(el('i', 'crl-gh-l'));
    return g;
  }
  /* 給与の影絵（2026-10-30 オーナー「カードみたいな形に」「ぼかしは灰色じゃなくて色つけて」）── 開いた人と同じ3枚のカード（年収の幅・年数の図・内訳の円）。
     カードの枠（crl-gh-card）は影絵の外の空の箱、中身だけが影絵。色は CSS のトークン（点は会社の色 ── 外の箱の --crl-co）。数も位置も固定 */
  var GHOST_DOTS = 9;
  function ghostPay() {
    var wrap = el('div', 'crl-pv-lk');
    wrap.setAttribute('aria-hidden', 'true');
    var rg = el('div', 'crl-gh-card'), g1 = ghost('prg');
    for (var j = 0; j < 2; j++) g1.appendChild(el('i', 'crl-gh-rgt'));
    rg.appendChild(g1);
    wrap.appendChild(rg);
    var pg = el('div', 'crl-pv-g');
    var yd = el('div', 'crl-gh-card'), g2 = ghost('pyd'), plot = el('div', 'crl-gh-plot');
    for (var i = 0; i < GHOST_DOTS; i++) plot.appendChild(el('i', 'crl-gh-d'));
    g2.appendChild(plot);
    yd.appendChild(g2);
    pg.appendChild(yd);
    var dn = el('div', 'crl-gh-card'), g3 = ghost('pdn');
    g3.appendChild(el('i', 'crl-gh-dn'));
    for (var k = 0; k < 4; k++) g3.appendChild(el('i', 'crl-gh-lg'));
    dn.appendChild(g3);
    pg.appendChild(dn);
    wrap.appendChild(pg);
    return wrap;
  }
  /* ── 口コミ（実投稿だけ）──────────────────────────────── */

  /* ── 評価スコア（会社ページ）──────────────────────────────
     2026-10-06 オーナーのご指示「パイロットによる評価スコアの部分、企業トップのどこかのカードに残して」。
     ★ 使うのは会員が実際に付けた点数だけ（2026-10-06 夜の修正指示の3）。
       見本の点数を混ぜない・投稿が無い会社に点数を出さない・0件を 0点にしない（出すのは「評価未取得」）。
       ほかの会社のページの帯（airline-reviews-ui.js）は見本の点数を混ぜているので、ここでは呼ばない。
     ★ 点数は誰にでも返る列（本文と訳だけが鍵つき）── 鍵の無い人にも同じ点数が出る。権限は変えていない。
     ★ 6分類の名前だけは会社ページの口コミ欄から借りる（同じ分類を別の言葉で呼ばない）。
     ★ 読めなかった時は点数を出さない（「いま読み出せません」＋やり直す）。0件と通信失敗を同じに見せない。 */
  /* ★6分類の名前は1つの表だけ（2026-10-25）── airlines/airline-reviews-data.js の CAT_FULL（英語は CAT_FULL_EN）。
     会社ページはその表を口コミの部品（PVReviewUI.cats.full）から、比較は同じ表を写した島から読む。図の名前も、口コミの抜粋の札の名前も
     ここから取る（同じ箱の中で「企業カルチャー」と「企業文化」・「ワークライフバランス」と「WLB」を並べない）。
     ⚠️ ここに分類の名前を字で書かない（2つめの表を作らない）。 */
  function catNames() {
    var u = GL && w.PVReviewUI;
    var a = u && u.cats && u.cats.full;
    if (!(isArr(a) && a.length === SCORES.length)) {
      /* 会社ページの部品が居ない画面（比較）では、名前を島から読む（gen-career.mjs が同じ正本から写したもの） */
      var isl = d.getElementById('crl-cats');
      a = null;
      if (isl) { try { a = JSON.parse(isl.textContent || ''); } catch (e) { a = null; } }
    }
    return (isArr(a) && a.length === SCORES.length &&
            a.every(function (s) { return typeof s === 'string' && !!s; })) ? a : null;
  }
  /* 1つの分類の名前（鍵は culture・salary … の6つ）。表に無い分類（経営陣への提案など）と、表を読めない時は、渡された名前のまま */
  function catName(k, fallback) {
    var names = catNames(), i = SCORES.indexOf(k + '_score');
    return names && i >= 0 ? names[i] : fallback;
  }
  /* 名前を描く（札と図の名前の行）。表の名前の「|」は長い名前の折れてよい所（2026-10-25）── そこに <wbr> を置き、字としては出さない
     （画面の字も読み上げも「|」の無い名前。折れるのは CSS の word-break:keep-all と、この <wbr> の所だけ）。 */
  function catSpan(cls, s) {
    var n = el('span', cls), parts = String(s == null ? '' : s).split('|');
    parts.forEach(function (t, i) {
      if (i) n.appendChild(d.createElement('wbr'));
      if (t) n.appendChild(d.createTextNode(t));
    });
    return n;
  }
  /* 口コミの抜粋の区分の札。名前は内側の1つの span に入れる（札が箱より広い時、その span の中で <wbr> の所から折れる） */
  function catChip(s) {
    var c = el('span', 'crl-chip');
    c.appendChild(catSpan('', s));
    return c;
  }
  function realRated(rows) {
    var sum = [], cnt = [], total = 0, n = 0;
    SCORES.forEach(function () { sum.push(0); cnt.push(0); });
    (rows || []).forEach(function (r) {
      var s = 0, c = 0;
      SCORES.forEach(function (key, i) {
        var v = Number(r && r[key]);
        if (!isFinite(v) || v <= 0) return;           // 付けていない分類は数えない（0 を平均に入れない）
        v = Math.min(5, v);
        sum[i] += v; cnt[i]++;
        s += v; c++;
      });
      if (c) { total += s / c; n++; }
    });
    if (!n) return null;                              // 点数の付いた投稿が無い ＝ 評価未取得
    var full = cnt.every(function (c) { return c > 0; });
    return {
      n: n,
      avg: total / n,
      /* 6角形は、6分類ぜんぶに点数があるときだけ（欠けた角を 0 で描くと「0点」に見える） */
      ratings: full ? sum.map(function (v, i) { return v / cnt[i]; }) : null
    };
  }
  function starsEl(avg) {
    var st = el('span', 'crl-stars');
    st.setAttribute('aria-hidden', 'true');
    st.style.setProperty('--crl-fill', (Math.round(avg / 5 * 1000) / 10) + '%');
    return st;
  }
  function noStars() {                                // 輪郭だけの星（形は CSS。字はここに置かない）
    var st = el('span', 'crl-stars');
    st.setAttribute('aria-hidden', 'true');
    st.setAttribute('data-none', '');
    return st;
  }
  /* 評価の1行の中身（星・点数・「n件の評価」）。会社ページ・1社の概要・比較が同じ部品を使う ── 数えるのは realRated() の1つだけ。
     点数の付いた投稿が無ければ「評価未取得」（0 を置かない）。bare ＝ 輪郭の星も置かない（比較：隣の会社の星と並ぶと 0点に見える）。 */
  function rateInto(node, R, bare) {
    if (R) {
      node.appendChild(starsEl(R.avg));
      node.appendChild(el('b', 'crl-avg', R.avg.toFixed(1)));
      node.appendChild(el('span', 'crl-cnt', T.revRated(R.n)));
    } else {
      if (!bare) node.appendChild(noStars());
      node.appendChild(el('span', 'crl-cnt', T.revNo));
    }
    return node;
  }
  /* 口コミ件数（投稿ぜんぶ）。評価件数の隣ではなく、次の行に置く ── 2つの数を同じ数に見せない。 */
  function postsLine(n) { return el('p', 'crl-posts', T.revPosts(n)); }
  function svgEl(tag, cls, attrs) {
    var n = d.createElementNS(NS, tag);
    if (cls) n.setAttribute('class', cls);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  /* 6角形の図。名前と点数は図のまわりに HTML で置く（図の中の字にすると、狭い画面で 12px を割る）。
     6分類の点数を字で出すのはここだけ ＝ 読み上げから外すのは絵だけで、名前と点数は読ませる */
  function radar(vals, names) {
    var box = el('div', 'crl-radar'), n = vals.length, C = 100, R = 92;
    box.setAttribute('role', 'list');
    function xy(i, k) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [(C + R * k * Math.cos(a)).toFixed(1), (C + R * k * Math.sin(a)).toFixed(1)];
    }
    function pts(fn) {
      var s = [];
      for (var i = 0; i < n; i++) s.push(xy(i, fn(i)).join(','));
      return s.join(' ');
    }
    var svg = svgEl('svg', 'crl-radar-svg', { viewBox: '0 0 200 200', focusable: 'false', 'aria-hidden': 'true' });
    [0.2, 0.4, 0.6, 0.8, 1].forEach(function (k) {
      svg.appendChild(svgEl('polygon', 'crl-radar-ring', { points: pts(function () { return k; }) }));
    });
    for (var i = 0; i < n; i++) {
      var e = xy(i, 1);
      svg.appendChild(svgEl('line', 'crl-radar-axis', { x1: C, y1: C, x2: e[0], y2: e[1] }));
    }
    svg.appendChild(svgEl('polygon', 'crl-radar-shape', { points: pts(function (j) { return vals[j] / 5; }) }));
    vals.forEach(function (v, j) {
      var p = xy(j, v / 5);
      svg.appendChild(svgEl('circle', 'crl-radar-dot', { cx: p[0], cy: p[1], r: 3.5 }));
    });
    box.appendChild(svg);
    vals.forEach(function (v, j) {
      var l = el('span', 'crl-radar-l');
      l.setAttribute('role', 'listitem');
      l.setAttribute('data-i', String(j));
      l.appendChild(catSpan('', names[j]));
      l.appendChild(el('b', '', v.toFixed(1)));
      box.appendChild(l);
    });
    return box;
  }
  /* 点数で塗れない会社の図（比較 ── 2026-10-22 オーナー P12.97。会社ページの図と同じ見た目）：3.0 の淡い面（is-ph）と6つの名前だけ。
     ★字に数字を1つも置かない（分類ごとの点・「3.0」・点の丸を描かない ── 作り物の点を数字として見せない）。
     ★中身の無い絵なので読み上げない（何も無いことは、上の評価のマスが言葉で言っている）。
     形は radar() と同じ座標（radar() は直さない）── 3.0 で描いてから、点の丸と数字を外し、面を淡い色にする。 */
  var RADAR_PH = 3;
  function radarPh(names) {
    var f = radar(SCORES.map(function () { return RADAR_PH; }), names);
    var gone = f.querySelectorAll('.crl-radar-dot, .crl-radar-l > b');
    for (var i = 0; i < gone.length; i++) gone[i].parentNode.removeChild(gone[i]);
    var shape = f.querySelector('.crl-radar-shape');
    if (shape) shape.setAttribute('class', 'crl-radar-shape is-ph');
    f.removeAttribute('role');
    f.setAttribute('aria-hidden', 'true');
    f.setAttribute('data-radar', 'ph');
    return f;
  }

  KIND.stars = function (box, ids) {
    var slug = ids[0];
    return reviews(slug).then(function (res) {
      var R = realRated(res.rows);
      if (GL) {
        /* 会社ページ：社名の横と口コミのカードの右上。押すと同じページの「口コミ」のタブが開く。
           点数は下の「評価スコア」の箱と同じ realRated() の答え。 */
        var a = rateInto(el('a', 'crl-score crl-score-a'), R);
        a.setAttribute('href', '#reviews');
        a.appendChild(icon('arrow', 14));
        return view(R ? 'open' : 'empty', [a]);
      }
      /* 1社の概要（career.html）：会社ページと同じ数え方。星の横は評価件数、その下の行が口コミ件数。 */
      if (!res.rows.length) {
        return view('empty', [msg(T.revEmpty),
          foot([link(T.revGive, UP + 'submit-review.html?airline=' + enc(slug))])]);
      }
      return view('open', [rateInto(el('p', 'crl-score'), R), postsLine(res.rows.length)]);
    });
  };

  /* ★2026-10-06 オーナーのご指示「現行みたいにデカデカと評価スコアの部分を入れる必要ないけど、
       パッと見てわかるようにして」「レーダー図はいれて」
     ── 置くのは2つだけ：総合（点数・星・人数）と、6角形の図（まわりに6分類の名前と点数）。
        同じ6つの数字をもう一度並べる棒は置かない（欄が倍の高さになる）。 */
  KIND.score = function (box, ids) {
    var slug = ids[0];
    return reviews(slug).then(function (res) {
      var R = realRated(res.rows);
      if (!R) {
        /* 点数の付いた投稿がまだ無い。0 も見本も置かず、書く入口だけを出す */
        return view('empty', [msg(T.revNone),
          foot([link(T.revGive, UP + 'submit-review.html?airline=' + enc(slug))])]);
      }
      var wrap = el('div', 'crl-sc');
      var sum = el('div', 'crl-sc-sum');
      var big = el('p', 'crl-sc-avg');
      big.appendChild(el('b', '', R.avg.toFixed(1)));
      big.appendChild(el('span', '', '/ 5.0'));
      sum.appendChild(big);
      sum.appendChild(starsEl(R.avg));
      sum.appendChild(el('p', 'crl-sc-cnt', T.revRated(R.n)));
      wrap.appendChild(sum);
      /* 6角形の図は欄の中に HTML で在る（会社ページ ── gen-airline-glance.mjs の radarFrame）。ここは塗る点数を渡すだけ
         （塗るのは paint ── 古い答えで図を塗らない）。★塗るかどうかは社名の行の星と同じ realRated() の答えだけ（2026-10-22
         オーナー P12.97：点数は誰にでも出ている ── 鍵の有無で変えない・2つめの下限を作らない）。点数の無い分類が在る時（ratings が
         null）は渡さない ＝ 3.0 の淡い面のまま（数字は出さない）。図の無いページ（比較など）では、今までどおり radar() を足す。 */
      var out = view('open', [wrap]), fig = frameOf(box);
      if (fig) { if (R.ratings) out.radar = R.ratings; }
      else { var names = catNames(); if (R.ratings && names) wrap.appendChild(radar(R.ratings, names)); }
      return out;
    });
  };

  /* ── 口コミの要約（会社ページ）────────────────────────────
     良い点・気になる点を、会員の口コミから AI がまとめたもの。中身はサーバーが持っていて、
     ★ 本文を読める人にだけ返る（鍵の判定は本文と同じ関数）。ほかの人には状態の1語しか来ない。
     ★ 状態は7つで、言葉を混ぜない ── ログイン／鍵／口コミが少ない／まだ無い／未接続（口が無い）／取得失敗／開いている。
        未接続は PGRST202（関数が無い）のときだけ。ほかの失敗は「やり直す」の出る失敗の形。
     ★ 文は textContent で入れる。点の矢印は data-pvg-cat（分類）と data-pvg-ids（もとの口コミ）を持ち、
        押すと同じページの口コミがその分類で開き、もとの口コミに札が付く（pv-glance.js → airline-reviews-ui.js）。 */
  function summary(slug) {
    return once('sum:' + slug, function (sig) {
      return client().then(function (sb) {
        return cut(sb.rpc('pv_review_summary', { p: { airline: slug, lang: LANG } }), sig);   // 要約はページの言葉のもの（サーバーは会社 × 言葉ごとに持つ）
      }).then(function (res) {
        if (!res || res.error) {
          var code = String((res && res.error && res.error.code) || '');
          throw fail(code === 'PGRST202' ? 'off' : 'error');     // 未接続は「関数が無い」のときだけ
        }
        var x = res.data;
        if (!x || x.ok === false) throw fail('error');
        return x;
      });
    });
  }
  var SUM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  /* 全体の傾向の段落（2026-10-30〜 summarize-reviews が overview として預ける・鍵のある人にだけ届く）。無い・空なら置かない。 */
  function sumOv(x) {
    var t = x && typeof x.overview === 'string' ? x.overview.trim() : '';
    if (!t) return null;
    var box = el('div', 'crl-sum-ovb');                    // ★オーナー「要約のまとめも囲って読みやすく」── 見出し「まとめ」つきの枠
    box.appendChild(el('span', 'crl-sum-ovk', T.sumOvHead));
    box.appendChild(el('p', 'crl-sum-ov', t));
    return box;
  }
  /* 要約の1点は「話題：説明」（2026-10-30〜 summarize-reviews の指示）。「：」の前を太字の見出しにする。
     「：」は消さずに見えなくするだけ（読み上げと文字の並びは元の1行のまま）。形が合わない古い文はそのまま1行で出す。 */
  function sumSplit(text) {
    var m = /^([^：:]{1,12})：(.+)$/.exec(text) || /^([A-Za-z][A-Za-z' &/-]{0,31}): (.+)$/.exec(text);
    return m && m[2].trim() ? { k: m[1], sep: text.slice(m[1].length, text.length - m[2].length), b: m[2] } : null;
  }
  function sumText(text) {
    var t = el('span', 'crl-sum-t'), s = sumSplit(text);
    if (!s) { t.textContent = text; return t; }
    t.appendChild(el('b', 'crl-sum-k', s.k));
    t.appendChild(el('span', 'crl-sum-sep', s.sep));
    t.appendChild(el('span', 'crl-sum-b', s.b));
    return t;
  }
  /* max ＝ 何点まで（会社ページは3・比較は2）。bare ＝ 点の矢印を置かない（矢印は同じページの口コミを開く ── 会社ページにだけ在る） */
  function sumList(title, kind, items, max, bare) {
    var wrap = el('div', 'crl-sum-col');
    wrap.setAttribute('data-kind', kind);
    wrap.appendChild(el('h4', 'crl-sum-h', title));
    var ul = el('ul', 'crl-sum-ul');
    items.slice(0, max || 3).forEach(function (it) {
      var text = it && typeof it.text === 'string' ? it.text : '';
      if (!text) return;
      var li = el('li', 'crl-sum-li');
      li.appendChild(sumText(text));
      var cat = it && typeof it.cat === 'string' && /^[a-z]{2,12}$/.test(it.cat) ? it.cat : '';
      if (cat && !bare) {
        var a = el('a', 'crl-sum-a');
        a.setAttribute('href', '#reviews');
        a.setAttribute('data-pvg-cat', cat);
        a.setAttribute('aria-label', T.sumSrc);
        var src = (it && isArr(it.ids) ? it.ids : []).filter(function (s) { return typeof s === 'string' && SUM_ID.test(s); });
        if (src.length) a.setAttribute('data-pvg-ids', src.join(','));
        a.appendChild(icon('arrow', 14));
        li.appendChild(a);
      }
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    return ul.childNodes.length ? wrap : null;
  }
  function sumNote(text, why) { var p = msg(text); p.setAttribute('data-why', why); return p; }
  /* 要約の足元（AI 要約・もとにした件数・更新日）。件数と日付は、読めたときだけ書く。会社ページと比較が同じ部品を使う。 */
  /* 要約の更新日（2026-10-25）── サーバーが時刻（as_of_at・UTC の15分刻み）を返したら、読む人の時計の日付で出す
     （サーバーの as_of は UTC の日付なので、日本の 0〜9時に預けた要約は前日の日付になっていた）。
     時刻を返さない古いサーバーの答えは、今までどおり as_of の字のまま。どちらも読めなければ書かない。 */
  function sumDay(x) {
    var at = x && typeof x.as_of_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z$/.test(x.as_of_at) ? new Date(x.as_of_at) : null;
    if (at && !isNaN(at.getTime())) {
      var two = function (v) { return (v < 10 ? '0' : '') + v; };
      return at.getFullYear() + '-' + two(at.getMonth() + 1) + '-' + two(at.getDate());
    }
    return x && typeof x.as_of === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.as_of) ? x.as_of : '';
  }
  function sumFoot(x) {
    var by = el('p', 'crl-sum-by');
    by.appendChild(el('span', 'crl-sum-ai', T.sumAi));
    var n = Number(x.n);
    if (isFinite(n) && n > 0) by.appendChild(el('span', 'crl-sum-n', T.sumFrom(n)));     // 件数が読めなければ書かない
    var day = sumDay(x);
    if (day) by.appendChild(el('span', 'crl-sum-d', T.sumWhen(day)));
    return by;
  }
  /* 鍵の無い人の要約の欄（2026-10-30 オーナー「要約は1文じゃなくて60文字にしよう。会社のいいところは全部見せよう。悪いところだけぼかしを入れよう」）。
     ★鍵の無い答えから読むのは state・lead（まとめの段落の先頭 ── 日本語60字・英語120字。切るのはサーバー）・good（text と cat）だけ。
       n・as_of・concern・overview・ids は、届いても読まない（sumGood が text と cat だけの新しい行に作り直す）。
     ★まとめの続きと気になる点は影絵（決まった形 ── 答えを1つも読まない）。lead が無ければ「まとめ」の枠ごと置かない。 */
  function sumGood(x) {
    return (x && isArr(x.good) ? x.good : []).map(function (g) {
      return { text: g && typeof g.text === 'string' ? g.text : '', cat: g && typeof g.cat === 'string' ? g.cat : '' };
    });
  }
  function sumLead(x) {
    var t = x && typeof x.lead === 'string' ? x.lead.trim() : '';
    if (!t) return null;
    var box = el('div', 'crl-sum-ovb');                    // 開いた要約の「まとめ」と同じ枠・同じ見出し
    box.setAttribute('data-lead', '');
    box.appendChild(el('span', 'crl-sum-ovk', T.sumOvHead));
    box.appendChild(el('p', 'crl-sum-ov', t));
    box.appendChild(ghostCont());                          // 文が枠の中で続いている形（字は lead だけ）
    return box;
  }
  /* 気になる点の列：見出し（本物の字）→ 影絵（cols 列）と、影絵の上の板（board ＝ 錠前の1行と入口）。板は影絵の外（ぼかさない） */
  function sumBad(cols, board) {
    var col = el('div', 'crl-sum-col');
    col.setAttribute('data-kind', 'concern');
    col.setAttribute('data-shut', '');
    col.appendChild(el('h4', 'crl-sum-h', T.sumConcern));
    var gw = el('div', 'crl-sum-gw');
    gw.appendChild(ghostBad(cols));
    var bd = el('div', 'crl-board'), inn = el('div', 'crl-board-in');
    board.forEach(function (n) { if (n) inn.appendChild(n); });
    bd.appendChild(inn);
    gw.appendChild(bd);
    col.appendChild(gw);
    return col;
  }
  /* why ＝ 'login'（ログインしていない）／'key'（口コミの鍵が無い）。nodes ＝ 欄に並べるもの。data-why は欄の最初の子（この1つ）に付ける */
  function sumShut(why, nodes) {
    var wrap = el('div', 'crl-sum-lk');
    wrap.setAttribute('data-why', why);
    nodes.forEach(function (n) { if (n) wrap.appendChild(n); });
    return view('locked', [wrap]);
  }
  KIND.summary = function (box, ids) {
    var slug = ids[0];
    return summary(slug).then(function (x) {
      /* ★2026-10-30 オーナー「OpenWork のように、ここに投稿のボタンを」── 要約の欄にも「匿名で口コミを書く」（前はカードの投稿ボタン1つだけだった）。
         ★同日「要約は60文字に・いいところは全部見せよう・悪いところだけぼかし」── まとめの枠（先頭の字＋ぼかした続き）→
           開いた要約と同じ2列（良い点は本物の字・気になる点は見出しだけ字で、中身は影絵と板）→ 足元（AI 要約）。
           ログインしていない人には板に「ログイン」も。良い点が無ければ気になる点の列が全幅 */
      if (x.state === 'login' || x.state === 'locked') {
        var login = x.state === 'login', grid = el('div', 'crl-sum');
        var good = sumList(T.sumGood, 'good', sumGood(x), 3);
        if (good) grid.appendChild(good);
        grid.appendChild(sumBad(1, [lockLine(T.sumLock),
          foot([link(T.revGive, UP + 'submit-review.html?airline=' + enc(slug), 'cta'), login ? loginLink() : null])]));
        return sumShut(login ? 'login' : 'key', [sumLead(x), grid, sumFoot({})]);     // 足元は「AI 要約」だけ（件数・日付は鍵の無い答えに来ない・読まない）
      }
      if (x.state === 'few') return view('empty', [sumNote(T.sumFew, 'few')]);
      if (x.state !== 'open') return view('empty', [sumNote(T.sumNone, 'none')]);
      var good = sumList(T.sumGood, 'good', isArr(x.good) ? x.good : []);
      var bad = sumList(T.sumConcern, 'concern', isArr(x.concern) ? x.concern : []);
      if (!good && !bad) return view('empty', [sumNote(T.sumNone, 'none')]);
      var grid = el('div', 'crl-sum');
      if (good) grid.appendChild(good);
      if (bad) grid.appendChild(bad);
      var by = sumFoot(x), ov = sumOv(x);
      return view('open', ov ? [el('h3', 'crl-sum-title', T.sumHead), ov, grid, by] : [el('h3', 'crl-sum-title', T.sumHead), grid, by]);
    }, function (e) {
      if (e && e.crl === 'off') return view('empty', [sumNote(T.sumOff, 'off')]);   // 口がまだ無い ＝ 未接続（件数も文も作らない）
      throw e;
    });
  };

  /* ── 口コミの要約（比較）──────────────────────────────────
     会社ページと同じ読み口・同じ文。比較では各社 良い点・気になる点を2つまで（頭から。作り直さない・並べ替えない）。
     ★ 読む人についての1行は、枠に1回だけ（会社ごとに鍵の絵を並べない）。ログイン → 鍵 の順。要約の返事2つだけで決める（評価の読み込みを待たない）。
     ★ 開いていない返事から読むのは state・lead・good（text と cat）だけ（concern・overview・n・ids に触れない ── 2026-10-30）。
     ★ 静かな1行（少ない／まだ無い／準備中）を出すかどうかは、ここでは決めない ── すぐ上の評価の欄に点数の付いた投稿が
        描かれているときだけ、CSS が出す（data-rated。会社ページと同じ畳み方）。 */
  var CMP_SUM_MAX = 2;
  function quietNote(st) {
    return st === 'few' ? sumNote(T.sumFew, 'few') : st === 'off' ? sumNote(T.sumOff, 'off') : sumNote(T.sumNone, 'none');
  }
  function sumCell(slug, s, st, col) {
    var c = el('div', 'crl-sum2-c'), body = [], quiet = false;
    c.setAttribute('data-col', String(col));
    if (st === 'fail') body.push(sideFail(s));
    else if (st === 'open') {
      var x = s.v;
      var good = sumList(T.sumGood, 'good', isArr(x.good) ? x.good : [], CMP_SUM_MAX, true);
      var bad = sumList(T.sumConcern, 'concern', isArr(x.concern) ? x.concern : [], CMP_SUM_MAX, true);
      var ov = (good || bad) ? sumOv(x) : null;
      if (ov) body.push(ov);
      if (good) body.push(good);
      if (bad) body.push(bad);
      if (good || bad) body.push(sumFoot(x));
      else { body.push(quietNote('none')); quiet = true; }
    } else { body.push(quietNote(st)); quiet = true; }
    if (quiet) c.setAttribute('data-quiet', '');
    c.appendChild(coTag(slug));
    body.forEach(function (n) { c.appendChild(n); });
    return c;
  }
  KIND['cmp-summary'] = function (box, ids) {
    return both(summary, ids).then(function (S) {
      var st = S.map(function (s) { return s.ok ? String(s.v.state) : (s.off ? 'off' : 'fail'); });
      if (st[0] === 'fail' && st[1] === 'fail') throw fail('error');
      /* ★2026-10-30 会社ごとの列：社名の札 → まとめの枠（先頭の字＋ぼかした続き）→ 良い点（2つまで・矢印なし）。その下に1つ：
         「気になる点」の見出し（本物の字）＋ 会社の列にそろえた2列の影絵 ＋ 板1枚（会社ページと同じ読み方 ── 鍵の無い答えから読むのは state・lead・good だけ）。
         板の1行は枠に1回だけ。入口はすぐ上の評価の欄の、口コミの Give & Get の1つ（ここに足さない）── ゲストには「ログイン」だけ */
      if (st[0] === 'login' || st[1] === 'login' || st[0] === 'locked' || st[1] === 'locked') {
        var lg = el('div', 'crl-sum-leads');
        S.forEach(function (s, i) {
          var shut = s.ok && (s.v.state === 'login' || s.v.state === 'locked');
          var lead = shut ? sumLead(s.v) : null, good = shut ? sumList(T.sumGood, 'good', sumGood(s.v), CMP_SUM_MAX, true) : null;
          if (!lead && !good) return;
          var c = el('div', 'crl-sum-lead');
          c.setAttribute('data-col', String(i + 1));
          c.appendChild(coTag(ids[i]));
          if (lead) c.appendChild(lead);
          if (good) c.appendChild(good);
          lg.appendChild(c);
        });
        var guest = st[0] === 'login' || st[1] === 'login';
        return sumShut(guest ? 'login' : 'key', [lg.childNodes.length ? lg : null,
          sumBad(2, guest ? [lockLine(T.loginLock), loginLink()] : [lockLine(T.sumLock)])]);
      }
      /* 2社とも同じ静かな1行なら、会社ごとに繰り返さない */
      if (st[0] === st[1] && (st[0] === 'few' || st[0] === 'none' || st[0] === 'off')) return view('empty', [quietNote(st[0])]);
      var grid = el('div', 'crl-sum2');
      S.forEach(function (s, i) { grid.appendChild(sumCell(ids[i], s, st[i], i + 1)); });
      var any = !!grid.querySelector('.crl-sum-col');
      var loud = any || st[0] === 'fail' || st[1] === 'fail';
      return partial(view(loud ? 'open' : 'empty', any ? [el('h3', 'crl-sum-title', T.sumHead), grid] : [grid]), S);
    });
  };

  /* 比較の口コミ。数えるのは realRated() の1つだけ ── 星・点数の横は評価件数（点数の付いた投稿）、次の行が口コミ件数（投稿ぜんぶ）。
     ⚠️ 行（rows）から読むのは 6つの点数 と 行数 だけ。ほかの列（昔の口コミに書かれた給与・抜粋・職位）を画面に出さない。
     ⚠️ 投稿が無い・点数が無い・読めなかった を、同じ顔にしない。どれにも 0 も、空の星も置かない。 */
  function sideOf(s) { return s.ok ? { rows: s.v.rows, R: realRated(s.v.rows) } : null; }
  function rateCell(slug, s, o) {
    var c = el('div', 'crl-rate');
    c.appendChild(el('span', 'crl-sr', coName(slug)));
    if (!o) { c.appendChild(sideFail(s)); return c; }
    if (!o.rows.length) { c.appendChild(el('span', 'crl-none', T.revNone)); return c; }
    c.appendChild(rateInto(el('p', 'crl-score'), o.R, true));
    c.appendChild(postsLine(o.rows.length));
    return c;
  }
  /* 評価の格子の続きの行（6角形・口コミの抜粋）。比べる1項目の行（.crl-cmp-row）とは別の印で置く ── 評価の行は2社の評価のマスだけ
     （評価のマスを読む側 ── assert-cmp-frame.mjs・assert-career-live.mjs ── が数えるマスを増やさない）。左右は同じ要素・同じ列の幅。 */
  function subRow(g, cls, cellA, cellB) {
    var r = el('div', 'crl-cmp-sub ' + cls);
    var a = el('div', 'crl-cmp-sc'); a.appendChild(cellA); r.appendChild(a);
    var b = el('div', 'crl-cmp-sc'); b.appendChild(cellB); r.appendChild(b);
    g.appendChild(r);
    return r;
  }
  /* 比較の口コミの抜粋（2026-10-22 オーナー P12.97「比較には口コミの評価と一部内容までだしてね」── 誰にでも）。
     サーバーが新しい順に返した行から、字のある投稿を REV_CMP 件まで。1件の形は会社ページの口コミの箱と同じ（reviewItem）。
     ★鍵の無い人の字は、サーバーが返した抜粋（最初に書かれた1欄の先頭40字）だけ ── 本文はそもそも届かない（db/reviews-gate.sql の
       pv_reviews）。ここで字を切らない・作らない・足さない。点数だけの投稿（字が無い）は飛ばす（日付だけの札を並べない）。 */
  var REV_CMP = 2;                                    // 会社ページの概要の口コミの箱（KIND.reviews）と同じ件数
  /* 抜粋の道は、口コミの鍵が無いと答えた返事の道（鍵のある返事は下の revScroll）。読むのはサーバーの抜粋だけ ──
     本文の列（*_comment・translations）が万一ついて来ても読まない（決めるのはサーバーの1語 unlocked。列の有る無しで決めない） */
  function clipOnly(r) {
    var c = {};
    for (var k in r) {
      if (Object.prototype.hasOwnProperty.call(r, k) && !/_comment$/.test(k) && k !== 'translations') c[k] = r[k];
    }
    return c;
  }
  function clipsOf(o, I) {
    if (!o || !I) return null;
    var ul = el('ul', 'crl-revs'), locked = false;
    for (var i = 0; i < o.rows.length && ul.childNodes.length < REV_CMP; i++) {
      var p = I.pick(clipOnly(o.rows[i]));
      if (!(isArr(p.cats) && p.cats.some(function (c) { return c && c.text; }))) continue;
      if (p.locked) locked = true;
      ul.appendChild(reviewItem(p, o.rows[i]));
    }
    return ul.childNodes.length ? { ul: ul, locked: locked } : null;
  }
  /* 口コミの鍵のある人（2026-10-22 オーナー P12.97「投稿済みの人はそのカードで他の人の投稿スクロール可能にして」）：
     その会社のマスの中で、ほかの人の投稿を新しい順に、本文のまま（会社ページの口コミと同じ字）スクロールして読める。
     ★ 決めるのはサーバーの答えの1語（pv_reviews の unlocked）だけ ── 給与の鍵では開かない（給与の答えをここで見ない）。
       鍵の無い人には、そもそも本文が届かない（上の clipsOf の抜粋だけ）。
     ★ 行はすでに受け取った分（reviews() の1回）から、REV_PAGE 件ずつ描く。続きは「続きを見る（全n件）」── 給与の一覧の畳みと同じ言葉。
       n は、この枠に並ぶ字のある投稿の数（点数だけの投稿は並べない・数えない）。押したら、新しく出た1件目へフォーカスを移す。
     ★ 枠はキーボードで入れる（tabindex 0）・読み上げはその会社の名前の区切り（role region）。保存領域には何も書かない。 */
  var REV_PAGE = 5;
  /* 口コミの抜粋・本文のマスの頭に、その会社の札（★2026-10-25 WP-compare-all-13 F1）。スマホ（〜759px）では口コミのカードを2社の上下に
     全幅で並べるので（career.css）、どちらの会社の投稿かをマスの中で言う。広い画面では2列のまま・札は出さない（列の頭の札が言っている）。
     札の部品は列の頭と同じ coTag（字は社名だけ。新しい言葉は無い）。 */
  function rvCell(slug, node) {
    var f = d.createDocumentFragment(), t = coTag(slug);
    t.className += ' crl-rv-co';
    f.appendChild(t);
    f.appendChild(node);
    return f;
  }
  function revScroll(slug, o, I) {
    if (!o || !I) return null;
    var items = [];
    o.rows.forEach(function (r) {
      var p = I.pick(r);
      if (!p.locked && isArr(p.cats) && p.cats.some(function (c) { return c && c.text; })) items.push([p, r]);
    });
    if (!items.length) return null;
    var wrap = el('div', 'crl-rv-scroll');
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', coName(slug));
    wrap.tabIndex = 0;
    var ul = el('ul', 'crl-revs');
    wrap.appendChild(ul);
    var shown = 0, more = null;
    function next() {
      var first = null;
      items.slice(shown, shown + REV_PAGE).forEach(function (x) {
        var li = reviewItem(x[0], x[1], true);
        if (!first) first = li;
        ul.appendChild(li);
      });
      shown = Math.min(items.length, shown + REV_PAGE);
      return first;
    }
    next();
    if (shown < items.length) {
      more = el('button', 'crl-link crl-rv-more');          // 押せる形は今までの「crl-link」（新しい押せる形を足さない）
      more.type = 'button';
      more.appendChild(el('span', '', T.payMore(items.length)));
      more.appendChild(icon('down', 14));
      more.addEventListener('click', function () {
        var first = next();
        if (shown >= items.length && more.parentNode) more.parentNode.removeChild(more);
        if (first) {
          first.setAttribute('tabindex', '-1');
          try { first.focus(); } catch (e) { /* フォーカスを移せないブラウザでは、そのまま */ }
        }
      });
      wrap.appendChild(more);
    }
    return { ul: wrap, locked: false };
  }
  KIND['cmp-stars'] = function (box, ids) {
    return both(reviews, ids).then(needOne).then(function (S) {
      var O = [sideOf(S[0]), sideOf(S[1])];
      if (O[0] && O[1] && !O[0].rows.length && !O[1].rows.length) {
        /* 2社とも投稿が無い：1つの文（2社それぞれに同じ文を並べない）。その下に、会社ごとの 3.0 の淡い6角形（数字なし）──
           2026-10-22 オーナー「必ず多角形のレーダーの図を載せて」（P12.95／96／97）。会社ページの図と同じ radarPh()。
           どちらの会社の図かは、格子の頭の社名の札が言う。6分類の名前が読めなければ文だけ（名前の無い図を描かない）。 */
        var zn = catNames(), zero = [msg(T.revNone)];
        if (zn) {
          var zg = cmpGrid(ids);
          subRow(zg, 'crl-rate-fig', radarPh(zn), radarPh(zn));
          zero.push(zg);
        }
        return view('empty', zero);
      }
      var g = cmpGrid(ids);
      /* すぐ下の要約の欄（CSS）が読む印：各社に点数の付いた投稿が在るか。1 ＝ 在る／0 ＝ 無い／x ＝ 読めなかった */
      g.setAttribute('data-rated', O.map(function (o) { return !o ? 'x' : o.R ? '1' : '0'; }).join(''));
      cmpRow(g, null, rateCell(ids[0], S[0], O[0]), rateCell(ids[1], S[1], O[1]));
      /* 6角形（P12.97：点数は誰にでも出ている ── 鍵の有無で変えない）。6分類ぜんぶに点数がある会社は、その点数で塗る（realRated の ratings）。
         点数で塗れない会社（点数の付いた投稿が無い・欠けた分類がある・投稿が無い）は、会社ページと同じ 3.0 の淡い面（数字なし）。
         読めなかった会社のマスは空 ── 分からないものを図にしない。 */
      var names = catNames();
      var figs = O.map(function (o, i) {
        if (!names || !o) return null;
        if (!(o.R && o.R.ratings)) return radarPh(names);
        var f = radar(o.R.ratings, names);
        f.setAttribute('aria-label', coName(ids[i]));
        f.setAttribute('data-radar', 'real');
        return f;
      });
      if (figs[0] || figs[1]) subRow(g, 'crl-rate-fig', figs[0] || blankCell(), figs[1] || blankCell());
      /* 評価の下に、新しい投稿の抜粋。続きを読むのは Give & Get（口コミの投稿 ＝ 口コミの鍵。給与の鍵では開かない）── 鍵の無い人にだけ1つ */
      return i18n().then(function (I) { return I; }, function () { return null; }).then(function (I) {
        /* 口コミの鍵のある会社のマスは、ほかの人の投稿をスクロールで読める枠（revScroll）。無い会社は抜粋（clipsOf）のまま */
        var C = O.map(function (o, i) { return S[i].ok && S[i].v.unlocked === true ? revScroll(ids[i], o, I) : clipsOf(o, I); });
        if (C[0] || C[1]) subRow(g, 'crl-rate-rv', C[0] ? rvCell(ids[0], C[0].ul) : blankCell(), C[1] ? rvCell(ids[1], C[1].ul) : blankCell());
        var nodes = [g];
        if ((C[0] && C[0].locked) || (C[1] && C[1].locked)) {
          nodes.push(lockLine(T.revLock), foot([give2(T.revUnlock, UP + 'submit-review.html')]));
        }
        return partial(view('open', nodes), S);
      });
    });
  };

  /* 1件ぶん。鍵のある人には本文、無い人にはサーバーが返した抜粋と区分の名前だけ。
     本文を切るのは見た目（CSS）だけで、字は作らない・足さない。
     full ＝ 本文を全部（比較の、口コミの鍵のある人のスクロールの枠）。書かれた区分を全部、切らずに出す。 */
  function reviewItem(p, row, full) {
    var li = el('li', full && !p.locked ? 'crl-rev crl-rev-full' : 'crl-rev');
    if (p.locked) li.setAttribute('data-mask', '');
    var when = ym(row && row.created_at);
    if (when) li.appendChild(el('p', 'crl-rev-when', when));
    var cats = isArr(p.cats) ? p.cats : [];
    var withText = cats.filter(function (c) { return c && c.text; }).slice(0, p.locked ? 1 : full ? cats.length : 3);
    withText.forEach(function (c) {
      var b = el('div', 'crl-rev-cat');
      b.appendChild(catChip(catName(c.k, c.label)));     // 札の名前は図と同じ表（catNames）から
      b.appendChild(el('p', p.locked ? 'crl-rev-text crl-rev-clip' : 'crl-rev-text', c.text));
      li.appendChild(b);
    });
    var rest = cats.filter(function (c) { return c && c.label && withText.indexOf(c) < 0; });
    if (rest.length) {
      var chips = el('p', 'crl-chips');
      rest.forEach(function (c) { chips.appendChild(catChip(catName(c.k, c.label))); });
      li.appendChild(chips);
    }
    return li;
  }

  KIND.reviews = function (box, ids) {
    var slug = ids[0];
    return Promise.all([reviews(slug), i18n()]).then(function (a) {
      var res = a[0], I = a[1];
      if (!res.rows.length) return view('empty', []);     // 言葉は stars の欄が出す（同じ文を2回出さない）
      var ul = el('ul', 'crl-revs'), anyLocked = false;
      res.rows.slice(0, 2).forEach(function (r) {
        var p = I.pick(r);
        if (p.locked) anyLocked = true;
        ul.appendChild(reviewItem(p, r));
      });
      /* 会社ページでは、同じページの「口コミ」のタブを開く（pv-glance.js が受ける）。 */
      var all = link(T.revAll, GL ? '#reviews' : 'airlines/' + enc(slug) + '.html#reviews');
      if (anyLocked) {
        /* 会社ページの箱は、書く入口を箱の底に1つ持っている（data-give="0"）。同じボタンを2つ並べない */
        var give = box.getAttribute('data-give') === '0' ? null
          : link(T.revGive, UP + 'submit-review.html?airline=' + enc(slug), 'cta');
        return view('locked', [ul, lockLine(T.revLock), foot([give, all])]);
      }
      return view('open', [ul, foot([all])]);
    });
  };

  /* ── 待遇の集計 ─────────────────────────────────────────── */
  function keysOf(box) {
    var s = box.getAttribute('data-keys') || '';
    return s.split(',').map(function (k) { return k.trim(); }).filter(Boolean);
  }
  function numText(v) { return String(Math.round(Number(v) * 10) / 10); }
  /* 出す形は3つだけ。
       数の質問 … 中央値。
       選ぶ質問 … 「最多」と書く答えは、サーバーが決めて返す（行の lead。決め方は db/contrib.sql の pv_contrib_facts の1か所）。
                  lead が1つなら、その名前に「最多」。
                  lead が空なら（いちばん多い答えが並んだ）、答えの名前は出さずに「回答が分かれています」。
                  選べるだけ選ぶ質問で lead が2つ以上なら、どれも最多 ＝ 台帳の並びで全部出す（届いた並びではない）。
     lead の無い行・並びでない行・名前が引けない答えの入った行は出さない。
     ここでは数えない・決めない（答えごとの人数は届かない。ほかの鍵が付いてきても、そこから答えを作らない）。
     人数（n）は、その質問に答えた人の数。 */
  function optName(voc, code) {
    var o = voc.options;
    return (o && Object.prototype.hasOwnProperty.call(o, code) && o[code]) ? String(o[code]) : '';
  }
  function answer(row, voc) {
    if (!row || !voc) return null;
    var text = '', how = '', split = false;
    if ((voc.kind === 'num' || row.kind === 'num') && row.median_num != null && isFinite(Number(row.median_num))) {
      text = numText(row.median_num) + (voc.unit || ''); how = T.median;
    } else {
      var lead = row.lead;
      if (!isArr(lead)) return null;
      if (!lead.length) {
        text = T.split; split = true;
      } else {
        if (lead.length > 1 && voc.kind !== 'multi' && row.kind !== 'multi') return null;
        if (lead.some(function (c) { return !optName(voc, c); })) return null;
        text = Object.keys(voc.options).filter(function (c) { return lead.indexOf(c) >= 0; })
          .map(function (c) { return optName(voc, c); }).join(T.list);
        how = T.top;
      }
    }
    if (!text) return null;
    return { text: text, how: how, split: split, n: (isNum(row.n) && row.n > 0) ? row.n : null, when: ym(row.ym) };
  }
  function answerNode(ans) {
    if (!ans) return el('span', 'crl-none', T.factNone);
    var w0 = el('div', 'crl-ans');
    w0.appendChild(el('b', 'crl-ans-v', ans.text));
    var m = el('span', 'crl-ans-m');
    if (!ans.split) m.appendChild(el('span', 'crl-how', ans.how));
    if (ans.n) m.appendChild(el('span', '', T.answered(ans.n)));
    if (ans.when) m.appendChild(el('span', '', ans.when));
    w0.appendChild(m);
    return w0;
  }

  KIND.fact = function (box, ids) {
    var keys = keysOf(box), slug = ids[0];
    if (!keys.length) return Promise.reject(fail('error'));
    return Promise.all([facts(slug), vocab()]).then(function (a) {
      var F = a[0], V = a[1], list = el('div', 'crl-facts'), n = 0, sub = {}, shown = {};
      (box.getAttribute('data-sub') || '').split(',').forEach(function (s) {
        var c = s.split(':');
        if (c.length === 2 && c[0] && c[1]) sub[c[0]] = c[1];
      });
      /* 親の行が出ていない子には、親の質問の字だけを上に置く（値は書かない。子の字だけでは何の話か分からない） */
      function ctx(k) {
        var p = sub[k];
        if (!p || shown[p] === 1 || !V[p] || !V[p].ja) return;
        ctx(p);
        var c = el('div', sub[p] ? 'crl-fact is-sub is-ctx' : 'crl-fact is-ctx');
        c.appendChild(el('span', 'crl-fact-k', V[p].ja));
        list.appendChild(c);
        shown[p] = 1;
      }
      /* この欄の質問を聞いていない答えでは描かない（0件とも鍵とも言えない） */
      if (keys.some(function (k) { return F.asked[k] !== 1; })) throw fail('error');
      /* 鍵の文を繰り返さない欄（data-quiet）。開いていないとサーバーが言ったとき（未ログイン・給与の鍵が無い・
         自分の会社への回答がまだ足りない）は、何も描かない。同じ文は、同じ板の月の勤務の欄が1回だけ言う
         （入口もカードもそこに1つ）。読めない・準備中の時はここを通らない */
      if (F.state !== 'open' && box.getAttribute('data-quiet') === '1') return view('locked', []);
      if (F.state !== 'open') return lockView(F.state, slug, box, null);
      keys.forEach(function (k) {
        var ans = answer(F.map[k], V[k]);
        if (!ans) return;
        ctx(k);
        var r = el('div', sub[k] ? 'crl-fact is-sub' : 'crl-fact');
        r.appendChild(el('span', 'crl-fact-k', V[k].ja || ''));
        r.appendChild(answerNode(ans));
        list.appendChild(r);
        shown[k] = 1; n++;
      });
      return n ? view('open', [list]) : view('empty', [msg(T.factEmpty)]);
    });
  };

  /* 比較で並べる鍵。欄に書いてあればそれ、無ければページの話題のカードが持つ鍵をそのまま借りる。 */
  function cmpKeys(box) {
    var keys = keysOf(box);
    if (keys.length) return keys;
    var seen = {}, out = [];
    var all = root.querySelectorAll('.crl[data-live="fact"][data-keys]');
    for (var i = 0; i < all.length; i++) {
      keysOf(all[i]).forEach(function (k) { if (!seen[k]) { seen[k] = 1; out.push(k); } });
    }
    return out;
  }

  /* 比較の回答の欄は2つ：「月の働き方」のすぐ下（data-quiet：勤務・訓練のタブの質問）と「待遇」の下（給与・待遇のタブの質問）。
     どちらも会社ごとに、サーバーが決めた状態で描く（月の働き方と同じ3つの形）。入口とカードはここに置かない（月の働き方の欄が持つ）。 */
  KIND['cmp-facts'] = function (box, ids) {
    var keys = cmpKeys(box), quiet = box.getAttribute('data-quiet') === '1';
    if (!keys.length) return Promise.reject(fail('error'));
    return Promise.all([both(facts, ids), vocab()]).then(function (r) {
      var V = r[1];
      /* この欄の質問を聞いていない答えでは描かない（0件とも鍵とも言えない）── その会社は「読めなかった」として扱う */
      var S = needOne(r[0].map(function (s) {
        return (s.ok && keys.some(function (k) { return s.v.asked[k] !== 1; })) ? { ok: false, off: false } : s;
      }));
      var st = S.map(function (s) { return s.ok ? s.v.state : 'fail'; });
      var open = [st[0] === 'open', st[1] === 'open'];
      if (open[0] && open[1]) {
        var g = cmpGrid(ids), n = 0;
        keys.forEach(function (k) {
          var A = answer(S[0].v.map[k], V[k]), B = answer(S[1].v.map[k], V[k]);
          if (!A && !B) return;
          cmpRow(g, el('span', '', V[k].ja || ''), answerNode(A), answerNode(B));
          n++;
        });
        /* 鍵の文を繰り返さない欄（data-quiet）は、並べる行が無いときも黙る（すぐ上の「月の働き方」が箱の話をしている） */
        return n ? view('open', [g]) : view('empty', quiet ? [] : [msg(T.factEmpty)]);
      }
      if (S[0].ok && S[1].ok && !open[0] && !open[1]) {
        if (quiet) return view('locked', []);
        /* 待遇の欄は入口を持たない（NONE は「入口を出さない箱」） */
        return lockView(shut(st[0], st[1]), '', NONE, null);
      }
      return splitView(ids, S.map(function (s, i) {
        if (!s.ok) return [sideFail(s)];
        if (open[i]) return [factList(s.v.map, V, keys)];
        return quiet ? null : closedNodes(st[i], NONE);
      }), S);
    });
  };

  /* ── 評価スコアの図（会社ページ・P12.95／P12.96／P12.97）──────────────
     欄の中の data-crl-keep の図（HTML に在る：枠・6つの名前・3.0 の淡い面）は、欄を塗り直しても残す。
     ★塗るのは paint の中だけ ── その時の答え（v.radar）が在る「開いた」欄のときだけ点数で塗り、ほかの状態（待つ・読めない・0件・
       人が入れ替わった）では必ず HTML のときの形（3.0 の淡い面・数字なし）に戻す。前の人の点数を図に残さない。 */
  function frameOf(box) {
    for (var c = box.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && c.hasAttribute('data-crl-keep')) return c;
    return null;
  }
  /* ★点数の無い淡い面は、比較の図（radarPh）と同じく読み上げない（数字の無い絵 ── 何も無いことは評価の欄が言葉で言う）。
     点数で塗った図は、6分類の名前と点数を読む一覧（role list）に戻す。2026-10-25 まで会社ページの図だけ、淡い面でも一覧のままだった。 */
  function frameMute(fig, mute) {
    if (mute) { fig.removeAttribute('role'); fig.setAttribute('aria-hidden', 'true'); }
    else { fig.setAttribute('role', 'list'); fig.removeAttribute('aria-hidden'); }
  }
  function frameReset(fig) {
    if (!fig._ph) { fig._ph = fig.cloneNode(true); frameMute(fig, true); return; }
    if (fig.getAttribute('data-radar') === 'ph') return;
    clear(fig);
    for (var c = fig._ph.firstChild; c; c = c.nextSibling) fig.appendChild(c.cloneNode(true));
    fig.setAttribute('data-radar', 'ph');
    frameMute(fig, true);
  }
  function frameFill(fig, vals) {
    var shape = fig.querySelector('.crl-radar-shape'), svg = fig.querySelector('svg');
    if (!shape || !svg || !isArr(vals) || vals.length !== 6) return;
    var C = 100, R = 92;
    function xy(i, k) { var a = -Math.PI / 2 + i * 2 * Math.PI / 6; return [(C + R * k * Math.cos(a)).toFixed(1), (C + R * k * Math.sin(a)).toFixed(1)]; }
    var pts = [];
    vals.forEach(function (v, j) { pts.push(xy(j, v / 5).join(',')); });
    shape.setAttribute('points', pts.join(' '));
    shape.setAttribute('class', 'crl-radar-shape');
    vals.forEach(function (v, j) {
      var p = xy(j, v / 5);
      svg.appendChild(svgEl('circle', 'crl-radar-dot', { cx: p[0], cy: p[1], r: 3.5 }));
      var l = fig.querySelector('.crl-radar-l[data-i="' + j + '"]');
      if (l) l.appendChild(el('b', '', v.toFixed(1)));
    });
    fig.setAttribute('data-radar', 'real');
    frameMute(fig, false);
  }

  /* ── 欄を塗る ───────────────────────────────────────────── */
  var seq = 0;
  function paint(box, state, nodes, v) {
    var keep = frameOf(box);
    if (keep) box.removeChild(keep);
    clear(box);
    (nodes || []).forEach(function (n) { if (n) box.appendChild(n); });
    if (keep) {
      frameReset(keep);
      if (state === 'open' && v && v.radar) frameFill(keep, v.radar);
      box.appendChild(keep);
    }
    box.setAttribute('data-state', state);
    box.removeAttribute('aria-busy');
    box.removeAttribute('data-part');
  }
  function paintLoading(box) {
    var sk = el('div', 'crl-sk');
    sk.setAttribute('aria-hidden', 'true');
    sk.appendChild(el('i')); sk.appendChild(el('i')); sk.appendChild(el('i'));
    paint(box, 'loading', [sk, el('span', 'crl-sr', T.loading)]);
    box.setAttribute('aria-busy', 'true');
  }
  function retryBtn() {
    var b = el('button', 'crl-retry', T.retry);
    b.type = 'button';
    b.addEventListener('click', function () {
      /* キーボードで押した人の居場所を失わせない：描き直したあと、この欄へフォーカスを戻す（refocus） */
      if (b.parentNode && d.activeElement === b) b.parentNode._crlBack = 1;
      retryAll();
    });
    return b;
  }
  function paintError(box) { paint(box, 'error', [msg(T.err), retryBtn()]); }
  function refocus(box) {
    if (!box._crlBack) return;
    box._crlBack = 0;
    var at = d.activeElement;
    if (at && at !== d.body && at !== d.documentElement) return;   // 待つあいだに読み手が自分で動いた先からは、引き戻さない
    /* 見えているものだけ（箱に「やり直す」を1つにするため、CSS が隠したボタンがある ── そこへは移せない）。
       欄そのものが畳まれた時（すぐ上の欄が同じ知らせを出している）は、すぐ上の欄の「やり直す」へ */
    var c = box.querySelectorAll('.crl-retry, a[href], button'), t = null, up = box.previousElementSibling;
    if (!box.getBoundingClientRect().height && up) c = up.querySelectorAll('.crl-retry');
    for (var i = 0; i < c.length && !t; i++) if (c[i].getClientRects().length) t = c[i];
    if (!t) { t = box; box.setAttribute('tabindex', '-1'); }
    try { t.focus({ preventScroll: true }); } catch (e) { /* フォーカスを移せないブラウザでは、今までどおり */ }
  }
  function idle(box) {
    box._crlTok = ++seq;
    paint(box, 'idle', [el('span', 'crl-ph', '—')]);
    box.removeAttribute('data-for');
  }
  function slots() { return root.querySelectorAll('.crl[data-live]'); }
  function reset(kinds) {
    var all = slots();
    for (var i = 0; i < all.length; i++) {
      if (kinds.indexOf(all[i].getAttribute('data-live')) >= 0) idle(all[i]);
    }
  }
  function retryAll() {
    var all = slots();
    for (var i = 0; i < all.length; i++) {
      if (KIND[all[i].getAttribute('data-live')] &&
          (all[i].getAttribute('data-state') === 'error' || all[i].getAttribute('data-part') === '1')) idle(all[i]);
    }
    sync();
  }

  function run(box, kind, want, quiet) {
    var tok = box._crlTok = ++seq;
    box.setAttribute('data-for', want);
    if (!quiet) paintLoading(box);
    var out;
    try { out = Promise.resolve(KIND[kind](box, want.split('|'))); } catch (e) { out = Promise.reject(e); }
    out.then(function (v) {
      if (box._crlTok !== tok) return;
      paint(box, v.state, v.nodes, v);
      if (v.retry) { box.setAttribute('data-part', '1'); box.appendChild(retryBtn()); }   // 片方だけ読めなかった：読めた側は出したまま
      refocus(box);
    }, function (e) {
      if (box._crlTok !== tok) return;
      if (e && e.crl === 'off') paint(box, 'off', [msg(T.off)]);
      else paintError(box);
      refocus(box);
    });
  }

  /* ── いつ取りに行くか ─────────────────────────────────── */
  function shown(n) {
    for (var p = n; p && p !== d.documentElement; p = p.parentNode) {
      if (p.nodeType === 1 && p.hasAttribute('hidden')) return false;
    }
    return n.getClientRects().length > 0;
  }
  function pair() {
    var PC = w.PVCareer, st = null, a = '', b = '';
    try { st = (PC && typeof PC.state === 'function') ? PC.state() : null; } catch (e) { st = null; }
    if (st) { a = st.a || ''; b = st.b || ''; }
    var sa = d.getElementById('cr-a'), sb2 = d.getElementById('cr-b');
    if (!a && sa) a = sa.value || '';
    if (!b && sb2) b = sb2.value || '';
    if (!a || !b) {
      var q = new URLSearchParams(location.search);
      a = a || q.get('a') || root.getAttribute('data-a') || '';
      b = b || q.get('b') || root.getAttribute('data-b') || '';
    }
    return (okSlug(a) && okSlug(b) && a !== b) ? (a + '|' + b) : '';
  }
  function wantOf(box, kind) {
    if (kind.indexOf('cmp-') === 0) return pair();
    var s = box.getAttribute('data-airline') || '';
    return okSlug(s) ? s : '';
  }
  function sync() {
    var all = slots();
    for (var i = 0; i < all.length; i++) {
      var box = all[i], kind = box.getAttribute('data-live');
      if (!KIND[kind]) continue;                 // ほかの担当の欄（hotels など）
      if (!shown(box)) continue;
      var want = wantOf(box, kind);
      if (!want) continue;
      if (box.getAttribute('data-for') === want && box.getAttribute('data-state') !== 'idle') continue;
      run(box, kind, want, false);
    }
  }
  var queued = false;
  function later() {
    if (queued) return;
    queued = true;
    setTimeout(function () { queued = false; sync(); }, 0);
  }

  var PC = w.PVCareer = w.PVCareer || {};
  PC.client = client;
  /* 保存カード用：公開の評価（平均と評価件数の2つの数だけ）。口コミの行そのものは渡さない。 */
  PC.rating = function (slug) {
    if (!okSlug(slug)) return Promise.resolve(null);
    return reviews(slug).then(function (res) {
      var R = realRated(res && res.rows);
      return R ? { avg: R.avg, n: R.n } : null;
    });
  };

  root.addEventListener('cr:show', later);
  root.addEventListener('change', function (e) {
    var t = e.target;
    if (t && (t.id === 'cr-a' || t.id === 'cr-b')) later();
  });
  root.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('#cr-swap')) later();
  });
  w.addEventListener('popstate', later);
  /* 戻る・進むで、ブラウザが手元に置いていたこのページがそのまま戻ってきた時（persisted）は、離れているあいだに読む人が
     替わったかもしれない（サイトの「ログアウト」・自動のログアウト・別の会員のログイン）。ログインの部品からは何も届かない
     （手元に置かれていたあいだの知らせは、このページには来ない）ので、ここで確かめる：
     鍵がもう無ければ、読む人が替わった時と同じ（setUid(null)）＝ ログインのあいだに読んだ行をその場で消して、
     ログインしていない人の形で取り直す。右上も「ログイン」に戻す（pv-session.js の repaintAuth ── 死んだログインの時に
     あちらがすることと同じ。あちらの見回りは、名前の控えも消えた後には何もしない）。
     Chrome で実測（2026-10-18）：自動のログアウトをほかのページで迎えて「戻る」と、このページが手元から戻り、
     右上に前の人の名前が出たままだった。supabase-js からも SIGNED_OUT は届かなかった（INITIAL_SESSION だけ）。 */
  /* ブラウザの「戻る」で、前の画面が読み直されずにそのまま戻ってきたとき（persisted）だけ、投稿で変わりうる答えを取り直す。
     出来事でだけ取り直す ── 時間では取り直さない。見えている欄は、今の中身を出したまま取り直す（骨組みに戻すと、
     戻ってきた人の読んでいた位置が動く）。見えていない欄は、次に出たとき取り直す。
     会社ページではやらない：あちらは口コミの一覧と件数を別の部品が持っていて、片方だけ新しくなると同じページの中で数が食い違う。
     上の確かめ（読む人が替わったか）が先。替わっていれば欄はもう空（idle）で、ここでは触らない。
     離れているあいだにほかのタブで別の会員が入った時も同じ（storedReader ── ほかのタブの知らせは、手元に置かれていたページには届かない）：
     前の人の欄を、静かに取り直すのではなく、その場で空にしてから今の人の形で取り直す。
     知らない名前（まだ無い欄・誰も控えていない答え）は飛ばす。 */
  var BACK_DROP = ['rev:', 'sum:', 'fact:', 'wkv:', 'note:', 'give', 'pay', 'cmed:', 'ccomp:'];
  var BACK_KINDS = ['stars', 'reviews', 'cmp-stars', 'cmp-summary', 'fact', 'cmp-facts', 'work', 'cmp-work', 'notes', 'realpay', 'cmp-pay'];
  w.addEventListener('pageshow', function (e) {
    var S = w.PVSession;
    if (e && e.persisted && S && typeof S.hasToken === 'function' && !S.hasToken()) {
      if (typeof uid === 'string') setUid(null);
      if (typeof S.repaintAuth === 'function') S.repaintAuth();
    }
    if (!GL && e && e.persisted) {
      storedReader();
      BACK_DROP.forEach(drop);
      var all = slots();
      for (var i = 0; i < all.length; i++) {
        var box = all[i], kind = box.getAttribute('data-live'), st = box.getAttribute('data-state');
        if (!KIND[kind] || BACK_KINDS.indexOf(kind) < 0 || st === 'idle') continue;
        var want = box.getAttribute('data-for') || '';
        if (want && st !== 'loading' && shown(box)) run(box, kind, want, true);
        else idle(box);
      }
    }
    later();
  });
  if (w.MutationObserver) {
    new MutationObserver(later).observe(root, {
      attributes: true, subtree: true, attributeFilter: ['hidden', 'data-a', 'data-b']
    });
  }
  if (GL) {
    /* 会社ページの欄は、タブの切替と <details> の開閉で出たり隠れたりする（hidden 属性を通らない）。 */
    d.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('.airline-tab-btn,[data-pvg-tab]')) later();
    });
    d.addEventListener('toggle', later, true);
  }
  /* ログインが知らせなく終わった（ほかのタブで鍵が消えた・この画面の中で期限が切れた）。supabase からは何も届かないので、
     「情報を追加」の面（pv-contrib.js）が気づいて流す 'pvc:logout' で受ける。鍵がもう無ければ、読む人が替わった時と同じ（setUid）
     ＝ ログインのあいだに読んだ行を、その場で全部消して、ログインしていない人の形で取り直す。鍵が在れば何もしない。 */
  d.addEventListener('pvc:logout', function () {
    var S = w.PVSession;
    if (typeof uid === 'string' && S && typeof S.hasToken === 'function' && !S.hasToken()) setUid(null);
  });
  /* 読む人が替わった（同じタブで外からログインが書き替わった・ほかのタブで別の会員が入った）。ログインの部品からは何も届かない
     替わり方があるので、「情報を追加」の面（pv-contrib.js）が気づいて流す 'pvc:reader'（detail.uid ＝ 今の人。ログインしていなければ null）
     でも受ける。今までの人と違えば setUid ＝ 鍵の要る欄を全部その場で空にして、今の人の形で取り直す
     （前の人の投稿・前の人にだけ開いていた答えを、画面に残さない）。同じ人なら何もしない。 */
  d.addEventListener('pvc:reader', function (e) {
    var v = e && e.detail ? e.detail.uid : undefined;
    if (typeof v === 'string' || v === null) setUid(v);
  });
  /* 「情報を追加」で保存できたら、その会社の集計と補足を取り直す（古い答えを持ち越さない）。 */
  d.addEventListener('pvc:saved', function (e) {
    drop('wkv:'); drop('note:'); drop('fact:'); drop('give');
    reset(['work', 'cmp-work', 'notes', 'fact', 'cmp-facts']);
    /* 街の欄は、街を保存した時と、ログイン前の預かりを引き継いだ時に取り直す。
       鍵の1行を出している欄は、どの保存のあとでも取り直す（質問に答えて門が開いたのに、鍵の1行と答えるカードを残さない）。
       開いている欄は、月や質問の保存では触らない（見出しがちらつかない） */
    var topic = e && e.detail ? e.detail.topic : '';
    var shut = Array.prototype.some.call(slots(), function (b) {
      return b.getAttribute('data-live') === 'towns' && b.getAttribute('data-state') === 'locked';
    });
    if (topic === 'town' || topic === 'claim' || shut) { drop('town:'); reset(['towns']); }
    later();
  });
  /* 通貨を切り替えたら、額の字だけ描き直す（通信しない）。 */
  w.addEventListener('pv-currency-change', function () {
    var all = slots();
    for (var i = 0; i < all.length; i++) {
      var box = all[i];
      var k = box.getAttribute('data-live');
      if ((k === 'realpay' || k === 'cmp-pay') && box.getAttribute('data-state') === 'open') run(box, k, box.getAttribute('data-for') || '', true);
    }
  });

  /* ── 会員の中央値を、その場で差し替える（★2026-10-31 オーナー「提出のたびにすぐ変える」「中央値を出した航空会社は推定年収じゃなくて中央値に」）──
     会社ページの推定年収の欄（.pvg-rank[data-rule]）を、サーバーが給与・口コミの書き込みのたびに数え直して保存している中央値で差し替える。
     ⚠️ サーバーは保存した表を引くだけ（pv_member_medians）。ページを開くたびに全員分を数え直さない（2026-10-31 に本番が止まった原因）。
     決まり（台帳 salary-basis.mjs → HTML の data-*）：always ＝ いつも中央値（ANA・JAL）／higher ＝ 中央値が base（中央値に替える前の推定）を超えたときだけ。
     返事が無い・失敗したときは何もしない（書き込んである額のまま）。人数はサーバーが返さない（2人以上の組だけ返る）。 */
  var MED_T = LANG === 'en'
    ? { med: '<span class="pvg-vh">, median pay</span>', est: '<span class="pvg-vh">, estimated annual pay</span>',
        byEst: 'Our estimate', byMed: 'Median of pay submitted by members', sep: ' · ',
        mix: function (e, m) { return e + ': our estimate · ' + m + ': median of pay submitted by members'; },
        rank: { cap: 'Captain', fo: 'First Officer' },
        method: 'Median of the annual pay members have submitted (latest entry per person, to the nearest ¥10,000).', asOf: 'As of: latest submission',
        yen: function (man) { return '¥' + (+(man / 100).toFixed(2)) + 'M'; } }
    : { med: 'の中央値', est: 'の推定年収',
        byEst: '当サイトの推定', byMed: '会員が出した年収の中央値', sep: '・',
        mix: function (e, m) { return e + 'は当サイトの推定・' + m + 'は会員が出した年収の中央値'; },
        rank: { cap: '機長', fo: '副操縦士' },
        method: '会員が出した年収の中央値（1人1件・1万円単位）。', asOf: '時点：最新の提出まで',
        yen: function (man) { return '¥' + man.toLocaleString('en-US') + '万'; } };
  function medianRows(slug) {
    return once('med:' + slug, function (sig) {
      return client().then(function (sb) { return cut(sb.rpc('pv_member_medians', { p_airline: slug }), sig); }).then(function (res) {
        if (!res || res.error || !isArr(res.data)) throw sbErr(res);
        var out = {};
        res.data.forEach(function (x) { if (x && (x.rank === 'cap' || x.rank === 'fo') && isNum(x.median_man) && x.median_man > 0) out[x.rank] = Math.round(x.median_man); });
        return out;
      });
    });
  }
  function medianApply(card, med) {
    var C = w.PVCurrency, state = {};
    Array.prototype.forEach.call(card.querySelectorAll('.pvg-rank[data-rule]'), function (r) {
      var rk = r.getAttribute('data-rank'), rule = r.getAttribute('data-rule');
      var base = Number(r.getAttribute('data-base')), top = Number(r.getAttribute('data-top')), m = med[rk];
      var man, isMed;
      if (isNum(m)) { isMed = rule === 'always' || m > base; man = isMed ? m : base; }
      else if (rule === 'always') { state[rk] = r.getAttribute('data-med') === '1'; return; }   // 2人に届かない ＝ 書き込んである額のまま
      else { isMed = false; man = base; }
      state[rk] = isMed;
      if (!(man > 0)) return;
      var big = r.querySelector('.pvg-big');
      if (big && big.getAttribute('data-man') !== String(man)) {
        big.textContent = MED_T.yen(man);
        big.setAttribute('data-man', String(man));
        if (C && typeof C.scan === 'function') C.scan(big);
        if (C && typeof C.apply === 'function') C.apply();
      }
      var bar = r.querySelector('.pvg-bar');
      if (bar && top > 0) bar.style.width = Math.min(100, man / top * 100).toFixed(2) + '%';
      var s = r.querySelector('.pvg-rk-s'); if (s) s.innerHTML = isMed ? MED_T.med : MED_T.est;
      r.setAttribute('data-med', isMed ? '1' : '0');
      /* プルダウン（この金額は誰の・何を含んだ・いつの金額か）の職位の行：中央値なら、作り方と「最新の提出まで」 */
      var row = d.querySelector('.pvg-dl [data-rank="' + rk + '"] dd');
      if (row && isMed) { var sm = row.querySelectorAll('small'); if (sm.length >= 2) { sm[0].textContent = MED_T.method; sm[1].textContent = MED_T.asOf; } }
    });
    var by = card.querySelector('.pvg-estk');
    if (by) {
      var mk = ['cap', 'fo'].filter(function (k) { return state[k] === true; }), ek = ['cap', 'fo'].filter(function (k) { return state[k] === false; });
      var name = function (k) { return MED_T.rank[k]; };
      by.textContent = !mk.length ? MED_T.byEst : !ek.length ? MED_T.byMed : MED_T.mix(ek.map(name).join(MED_T.sep), mk.map(name).join(MED_T.sep));
    }
  }
  function medianBoot() {
    var card = d.querySelector('.pvg-pay');
    var rp = card && card.querySelector('[data-live="realpay"][data-airline]');
    if (!card || !rp || !card.querySelector('.pvg-rank[data-rule]')) return;
    medianRows(rp.getAttribute('data-airline')).then(function (med) { medianApply(card, med); }, function () { /* 書き込んである額のまま */ });
  }
  if (GL) medianBoot();

  sync();
})(window, document);
