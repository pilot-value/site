/* ════════════════════════════════════════════════════════════════
   deep-pay.js — DEEP PAY（給与の中身）
                 deep-pay.html / en/deep-pay.html が共有

   この画面が答えるのは5つだけ。
     ① この会社・この役職はいくら貰っているのか
     ② そのうち固定はどれだけで、変動はどれだけか
     ③ その報酬は、どれだけ働いた結果なのか
     ④ 変動給は何に連動しているのか
     ⑤ その数字はどれくらい信用してよいのか
   REAL PAY（actual-pay.js）の詳細版ではない。**あちらは1行＝1人の一覧、
   こちらは集計だけ。個人の明細は1件も出さない。**

   ── サーバから来るもの ────────────────────────────────────────
   pv_deep_pay(jsonb)（db/deep-pay.sql）1本だけ。
   何も選ばなければ引数を渡さない ＝ 区分（会社×役職×機材から順に落とすはしご）は
   **サーバが決める**。選んだときは {airline, position, fleet} をそのまま渡す。

   ── 区分を選べるようにした（2026-08-30・オーナー確定）────────────
   ★自分の区分しか見られないのは、REAL PAY（pv_pay_rows）が最初から全社の行を
     返しているのと食い違う。会社・役職・機材の3つとも選べる。
   ★守りは「3人未満は出さない」だけ（待遇アンケート・REAL PAY と同じ線）。
   ★選べる値は語彙（pv_airlines / pv_positions / pv_fleets）の中だけで、
     **手で選んだ区分ははしごを登らない**。3人に届かなければ level:'none' が
     返るだけで、広い区分の数字がその見出しのまま出ることは無い。
   ⚠️ この壁は SQL にしか無い。画面側で人数を数えたり伏せたりしないこと
     ── 2か所に置くと、片方だけ直した日に静かに緩む。

   ── ここで守っている約束 ──────────────────────────────────────
   ★「時給」と書かない。出すのは Pay / Block Hour で、Block Hours から
     割った指標。時給と書いた瞬間に、待機も地上も含んだ拘束時間で割った
     数字だと読まれる（分母が違う）。
   ★0 を印字しない。人数が足りない列・区分は**行ごと出さない**。
     0 と描くと「その会社は払っていない」という別の意味になる。
   ★「上位○%」を書かない。この画面は序列ではない。
   ★根拠のない精度（「98% 正確」など）を作らない。出せるのは n と段だけ。
   ★賞与はドーナツに入れない（オーナー確定 2026-08-29）。月々の現金と
     年1回の賞与を同じ円に混ぜると、円の意味が「月」でも「年」でもなくなる。
   ★Night / Weekend / Holiday を1行にまとめない。まとめれば n≧3 を
     通りやすくなる＝将来「整理」したくなる場所なので、ここに禁止を書いておく。

   ── 絵は借りる（複製の禁止）────────────────────────────────────
   ★ドーナツは PVViz.donutFromSegs（pay-viz.js）。**実体はあちら1か所だけ。**
     stroke-dasharray も 2πr もこのファイルに持たない。
   ⚠️ PVViz.compSegs は使わない。あちらは pv_pay_rows() が返す5バケツ
     {m,b,d,h,o}（年額・賞与込み・COMP の色）に固定されている。
     こちらは8区分・月額・賞与抜きで、分母も分子も違う。
     「再利用できそう」に見えるので、使わない理由をここに書いておく。

   ── 通貨 ──────────────────────────────────────────────────────
   金額は USD で来る。表示通貨へ換算したあと**もう一度2桁に丸め直す**
   （actual-pay.js:disp と同じ）。省くと、通貨を切り替えた瞬間だけ端数の
   残った数字が出て「本当は1円単位まで持っているのでは」と読める。
   ★#dp-root に pv-no-cur が付いている（currency.js の自動走査を止める）。
     切替は 'pv-currency-change' を購読して**描き直すだけ**。
     ⚠️ 描き直しで pv_deep_pay() を引き直さない。データは S に持つ。
   ════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';
  if (!w || !d) return;

  var V = w.PVViz;
  if (!V) return;                       // pay-viz.js が先に要る（HTML の順序）
  var esc = V.esc, num = V.num, fmt = V.fmt;

  /* ★ページ相対で書くと /en/ から /en/salary-data.json を見に行って 404 になる
       （actual-pay.js:77 と同じ理由）。 */
  var AIR_URL = 'salary-data.json', VOCAB_URL = 'pv-vocab.json';
  try {
    var _self = (d.currentScript && d.currentScript.src) || '';
    if (_self) {
      AIR_URL = new URL('salary-data.json', _self).href;
      VOCAB_URL = new URL('pv-vocab.json', _self).href;
    }
  } catch (e) {}

  var L = (d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';

  // ── 文言 ───────────────────────────────────────────────────────
  var T = {
    ja: {
      hd: 'DEEP PAY',
      now: '表示中:',
      months: '直近24か月',
      people: '人',
      verif: 'うち明細あり ',
      allAir: '全社',
      allPos: '全体',
      cat: '同じ機材区分',

      pickAir: '会社', pickPos: '役職', pickFlt: '機材',
      pickAny: '選択する',
      pickReset: '選択をクリア',
      /* ★選べる欄のすぐ下の断り1行。⚠️ 数字を1文字も入れない
         （入れた瞬間、その区分の人数が読める。招待の画面と同じ約束）。 */
      pickNote: 'データが十分にある条件のみ表示しています',
      pickNone: '選べる条件がまだありません。給与が集まると出ます。',
      askT: '見たい区分を選んでください',
      askS: '会社・役職・機材のどれか1つを選ぶと、その区分の数字が出ます。',
      askNoneT: '給与が集まるとここに出ます',
      askNoneS: '3人以上そろった区分ができると、会社・役職・機材で選べるようになります。',
      rg: { japan: '日本', mideast: '中東', asia: 'アジア', europe: '欧州',
            us: '北米', latam: '中南米', oceania: 'オセアニア', africa: 'アフリカ' },

      trust: '信頼度',
      hi: '高', mid: '中', lo: '低',

      k1: '年収（中央値）',     k1n: '月換算 約 ', k1nb: '月換算（賞与ぬき）約 ',
      k2: '固定・保証給比率',   k2n: '乗務量に左右されにくい報酬 ／ 変動給比率 ',
      k3: 'Pay / Block Hour',   k3n: '1人ずつ 年収÷12÷Block Hours ／ その中央値',

      compT: '給与構成',
      compS: '月々の現金・賞与ぬき',
      center: '構成比\n（中央値）',
      thK: '構成要素', thP: '構成比', thA: '月額（中央値）',
      compNote: '※ 金額ではなく構成比を表示しています。',
      restNote: '※「その他・未分類」には、3人に満たず個別に出せなかった項目を含みます。',
      bonusK: '賞与・利益分配',
      bonusS: '年収に占める割合',
      compNone: 'この区分では、給与構成をまだ出せません。',
      compNoneS: '内訳まで書いた明細が3人ぶん集まると、ここに構成が出ます。',

      workT: '働き方と報酬',
      workS: '中央値 / 月',
      hintT: '時給ではなく、働き方の前提とセットで報酬を見ます。',
      hintS: '同じ年収でも、飛ぶ時間と拘束される時間は会社ごとに倍ちがいます。',

      varT: '何をすると給与が増えるか',
      varS: '変動給の内訳',
      varNote: '※ 合計は四捨五入のため100%にならない場合があります。',
      varLead: ['変動給の ', ' は「', '」に連動しています。'],

      /* ★「データの見方」の板5枚はオーナー判断で削除（2026-08-31・じゃま）。
         残したのはこの1行だけ ── 3人の壁は約束、時給と呼ばないのは仕様。
         カードにせず、給与構成の下に淡い1行で置く。 */
      foot: '※ 3人以上そろった区分だけを出します。3人未満は 0 ではなく行ごと出しません。',
      /* ★年収が何を含むかは、これまで画面のどこにも書いていなかった（2026-09-01 に追加）。
         中身は db/pay-reports.sql の pv_annual_total と対。あちらを変えたらここも直す。 */
      footA: '※ 年収＝住宅手当・パーディアム・交通費・賞与・利益分配を含む現金の年換算。現物の社宅は含みません。',

      moreT: 'もっと深く見る',
      moreS: '別の切り口で見る。',
      more1: '会社比較を見る',

      lockT: 'DEEP PAY はまだ開いていません',
      lockKey: '給与を1件出すと、90日ぶん開きます。',
      lockDet: '内訳（基本給・手当）まで書いた明細を1件出すと開きます。',
      /* ★人数が足りなくて閉じているときの3行目（2026-09-01）。
         数字は返ってきた gate から入れる。ここで数え直さない。 */
      lockGoal: '給与を出したパイロットが{goal}人に達すること（いま{n}人）。',
      lockCta: '匿名で給与を出す',
      lockN: '出した内容は集計にしか使いません。個人の明細は誰にも表示されません。',

      thinT: 'この区分は、まだ人数が足りません',
      thinS: '3人そろった区分から順に出ます。',
      err: '読み込めませんでした。少し待ってから開き直してください。'
    },
    en: {
      hd: 'DEEP PAY',
      now: 'Showing:',
      months: 'last 24 months',
      people: ' pilots',
      verif: 'payslip-backed ',
      allAir: 'all airlines',
      allPos: 'everyone',
      cat: 'same fleet category',

      pickAir: 'Airline', pickPos: 'Seat', pickFlt: 'Fleet',
      pickAny: 'Select',
      pickReset: 'Clear',
      pickNote: 'Only groups with enough data are listed.',
      pickNone: 'No groups can be shown yet. They appear as pay reports come in.',
      askT: 'Choose a group to see',
      askS: 'Pick an airline, seat or fleet and the numbers for that group appear.',
      askNoneT: 'Numbers appear as pay reports come in',
      askNoneS: 'Once at least 3 pilots report the same group, you can pick an airline, seat or fleet.',
      rg: { japan: 'Japan', mideast: 'Middle East', asia: 'Asia', europe: 'Europe',
            us: 'North America', latam: 'Latin America', oceania: 'Oceania', africa: 'Africa' },

      trust: 'Confidence',
      hi: 'High', mid: 'Medium', lo: 'Low',

      k1: 'Annual pay (median)',   k1n: 'About ', k1nb: 'About (bonus excluded) ',
      k2: 'Fixed & guaranteed share', k2n: 'Not tied much to flying / Variable share ',
      k3: 'Pay / Block Hour',      k3n: 'Per-pilot annual÷12÷block hours, median',

      compT: 'What the pay is made of',
      compS: 'Monthly cash, bonus excluded',
      center: 'Share\n(median)',
      thK: 'Component', thP: 'Share', thA: 'Monthly (median)',
      compNote: 'Shares, not amounts, are what this chart shows.',
      restNote: '“Other / unclassified” includes items held back because fewer than 3 pilots reported them.',
      bonusK: 'Bonus / profit share',
      bonusS: 'of annual pay',
      compNone: 'Not enough to show the pay mix for this group yet.',
      compNoneS: 'It appears once 3 pilots have reported a full breakdown.',

      workT: 'The flying behind the pay',
      workS: 'Median / month',
      hintT: 'Pay is read together with the flying, not as an hourly rate.',
      hintS: 'The same annual pay can hide twice the block hours at another airline.',

      varT: 'What makes the pay go up',
      varS: 'Inside the variable pay',
      varNote: 'Shares are rounded, so they may not add up to 100%.',
      varLead: ['', ' of variable pay moves with ', '.'],

      foot: 'Groups of 3+ pilots only; fewer than 3 is left out, not zero.',
      footA: 'Annual pay = cash incl. housing allowance, per diem, transport, bonus and profit share; housing in kind is not counted.',

      moreT: 'Go deeper',
      moreS: 'More detailed cuts of the same data.',
      more1: 'Compare airlines',

      lockT: 'DEEP PAY is not open yet',
      lockKey: 'Share one pay report and it opens for 90 days.',
      lockDet: 'Share one report with the breakdown filled in and it opens.',
      lockGoal: 'It opens once {goal} pilots have shared their pay (currently {n}).',
      lockCta: 'Share your pay anonymously',
      lockN: 'What you share is only ever used in aggregate. No individual payslip is shown to anyone.',

      thinT: 'Not enough pilots in this group yet',
      thinS: 'Groups appear once 3 pilots have reported.',
      err: 'Could not load. Please try again in a moment.'
    }
  }[L];

  /* 給与構成の名前。★区分は8つで固定（db/deep-pay.sql の cseg と同じ順・同じ鍵）。 */
  var CN = {
    ja: { fixed: '基本給・保証給', variable: '変動給', command: '職位手当',
          role: '役割手当', perdiem: 'パーディアム', housing: '住宅手当',
          other: 'その他の現金', rest: 'その他・未分類' },
    en: { fixed: 'Base & guaranteed', variable: 'Variable (flying)', command: 'Rank pay',
          role: 'Role pay', perdiem: 'Per diem', housing: 'Housing allowance',
          other: 'Other cash', rest: 'Other / unclassified' }
  }[L];

  /* 変動給の区分。★pay-report.html:1074-1086 の <option> の文言をそのまま使う
     （読み手が「自分が答えた質問」だと分かる）。かっこの中の英語は2段目に置く。
     ⚠️ night / weekend / holiday を1つにまとめない。 */
  var VN = {
    ja: {
      block:    ['飛行・クレジット時間', 'Flight / Block / Credit Hours'],
      duty:     ['勤務・勤務時間',       'Duty / Duty Hours'],
      sector:   ['便数・着陸回数',       'Sector / Landing'],
      overtime: ['時間外・追加勤務',     'Overtime / Extra Duty'],
      reserve:  ['待機・スタンバイ',     'Reserve / Standby'],
      night:    ['深夜・夜間勤務',       'Night Premium'],
      weekend:  ['週末・日曜勤務',       'Weekend / Sunday Premium'],
      holiday:  ['祝日勤務',             'Public Holiday Premium'],
      other:    ['その他', ''],
      unknown:  ['わからない', '']
    },
    en: {
      block:    ['Flight / Block / Credit Hours', ''],
      duty:     ['Duty Hours', ''],
      sector:   ['Sector / Landing', ''],
      overtime: ['Overtime / Extra Duty', ''],
      reserve:  ['Reserve / Standby', ''],
      night:    ['Night Premium', ''],
      weekend:  ['Weekend / Sunday Premium', ''],
      holiday:  ['Public Holiday Premium', ''],
      other:    ['Other', ''],
      unknown:  ['Not sure', '']
    }
  }[L];

  /* 色は PVViz.SEG（配列）から引く。my-value.js:573 と同じ組み立て方。
     ★同じ項目がマイレポートと同じ色になる（オーナー確定 2026-08-29）。 */
  var SEGCOL = {};
  (V.SEG || []).forEach(function (s) { SEGCOL[s.k] = s.c; });
  var COL = {
    fixed:    SEGCOL.base,
    variable: SEGCOL.flight,
    command:  SEGCOL.command,
    role:     SEGCOL.instructor,
    perdiem:  SEGCOL.perdiem,
    housing:  SEGCOL.housing,
    other:    SEGCOL.other,
    rest:     SEGCOL.rest
  };

  // ── 小物（my-value.js から写し。元の行番号を残す）─────────────
  function sec(title, body, sub, mod) {              // my-value.js:520
    return '<section class="pt-sec mr-card' + (mod ? ' ' + mod : '') + '">' +
      '<div class="mr-card-h"><h2 class="mr-card-t">' + esc(title) + '</h2>' +
      (sub ? '<span class="mr-card-s">' + esc(sub) + '</span>' : '') + '</div>' + body + '</section>';
  }
  function note(s) { return '<div class="pt-note">' + s + '</div>'; }   // my-value.js:526（太字を通すので esc しない）
  function empty(s) { return '<div class="pt-empty">' + esc(s) + '</div>'; }   // my-value.js:527
  /* ★ここだけ fmt() の K/M 圧縮を使わない（my-value.js:663）。
     $14,314 → $14,872 が「$14K → $15K」になると、正しい +3.9% が +7% に見える。 */
  function exact(jpy) {
    var C = w.PVCurrency;
    var cur = (C && C.get) ? C.get() : 'JPY';
    var rate = (C && C.rates && C.rates[cur]) || 1;
    var sym = (C && C.symbols && C.symbols[cur]) || '¥';
    return sym + Math.round(jpy / rate).toLocaleString('en-US');
  }
  function usdToJpy(usd) {                            // my-value.js:671
    var r = (w.PVCurrency && w.PVCurrency.rates && w.PVCurrency.rates.USD) || 158.95;
    return usd * r;
  }

  // ── 数字 ───────────────────────────────────────────────────────
  /* 有効数字2桁（actual-pay.js:sig2）。サーバは USD で2桁に確定させているが、
     表示通貨へ換算すると端数が戻るので、換算のあとにもう一度掛ける。 */
  function sig2(v) {
    v = Number(v);
    if (!isFinite(v) || v <= 0) return 0;
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10) - 1);
    return Math.round(v / p) * p;
  }
  function money(usd) {                     // USD → 表示通貨（2桁・K/M 圧縮あり）
    var n = num(usd);
    if (n == null) return null;
    return fmt(sig2(usdToJpy(n)));
  }
  function moneyExact(usd) {                // USD → 表示通貨（2桁・圧縮なし）
    var n = num(usd);
    if (n == null) return null;
    return exact(sig2(usdToJpy(n)));
  }
  /* 年額 USD → 月額の表示。bPct ＝ 年収に占める賞与の割合（%）。
     ★2026-09-01、ここを**賞与ぬき**にした。同じ画面の「給与構成」の月額は
       db/deep-pay.sql の ucm ＝ 年収 ×(1−賞与割合)÷12 で出しているのに、
       ここだけ 年収 ÷ 12 だったので、賞与のぶん**同じ画面に月額が2つ**あった。
     ★割り算の元は **sig2 済みの年収**（画面に出ている額そのもの）。賞与の割合も
       すぐ下に出ているので、読み手が「1,600万 × 0.95 ÷ 12 ≒ 130万」と検算できる。
     ⚠️ 賞与の割合が null のとき（賞与を書いた人が3人に満たず伏せている）は 0 として
        扱い、**ラベルにも「賞与ぬき」と書かない**（k1n のまま）。本当は賞与がある人が
        1〜2人いる場合があり、そこで「賞与ぬき」と名乗ると嘘になる。 */
  function moneyMonth(usd, bPct) {
    var n = num(usd);
    if (n == null) return null;
    var b = num(bPct);
    var keep = b == null ? 1 : Math.max(1 - b / 100, 0);
    return fmt(sig2(sig2(usdToJpy(n)) * keep / 12));
  }

  // ── 図形（アイコンは1か所にまとめる）───────────────────────────
  function svg(inner, sz) {
    return '<svg viewBox="0 0 24 24" width="' + (sz || 24) + '" height="' + (sz || 24) +
      '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }
  var IC = {
    money: svg('<path d="M12 3v18"/><path d="M7 8h10"/><path d="M7 12h10"/>' +
               '<path d="M12 3 8 8"/><path d="m12 3 4 5"/>'),
    lock:  svg('<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
    pie:   svg('<path d="M12 3a9 9 0 1 0 9 9h-9V3Z"/><path d="M15 3.6A9 9 0 0 1 20.4 9H15V3.6Z"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    doc:   svg('<path d="M7 3h7l4 4v14H7V3Z"/><path d="M14 3v4h4"/><path d="M10 13h5"/><path d="M10 17h5"/>'),
    plane: svg('<path d="M10.5 3.5 12 3l1.5.5v6l7 4v2l-7-2v4l2 1.5V21l-3.5-1L8.5 21v-1.9L10.5 18v-4l-7 2v-2l7-4v-6Z"/>'),
    watch: svg('<circle cx="12" cy="12" r="6"/><path d="M9 3h6"/><path d="M9 21h6"/><path d="M12 9v3l2 1"/>'),
    cal:   svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>'),
    bed:   svg('<path d="M3 18v-8"/><path d="M3 13h18v5"/><path d="M21 18v-3"/>' +
               '<path d="M7 13V9h7a4 4 0 0 1 4 4"/>'),
    info:  svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6h.01"/>'),
    eye:   svg('<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.6"/>'),
    layer: svg('<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>'),
    users: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/>' +
               '<path d="M16 5.2a3.2 3.2 0 0 1 0 5.6"/><path d="M18 20a6 6 0 0 0-3-5.2"/>'),
    chev:  svg('<path d="m9 5 7 7-7 7"/>')
  };

  // ── 状態 ───────────────────────────────────────────────────────
  var S = { mode: 'load', data: null, air: {}, pos: {},
            /* 選ぶための材料（辞書が届いてから埋まる）と、いま選んでいる区分。
               ★sel が3つとも空なら「選んでいない」＝ 今までどおり自分の区分。 */
            airs: [], poss: [], flts: [],
            /* 選べる組み合わせ（サーバが決める）。★null は「まだ分からない」＝
               db/deep-pay.sql を貼るまで来ない。そのときは**選択欄を出さない**
               （選べるのに数字が出ない状態を作らないため。自動 fallback は禁止）。
               形は { air:[…], pos:{ '会社': […] }, flt:{ '会社|役職': […] } }。
               空文字の鍵は「そこで絞っていない」の意味。
               pkv は「中身が変わった回数」＝ picker() の組み直しの合図。 */
            picks: null, pkj: '', pkv: 0,
            sel: { airline: '', position: '', fleet: '' },
            client: null, busy: false };
  function el(id) { return d.getElementById(id); }
  /* 別の <script> が宣言した const sb を読む（actual-pay.js:662）。
     宣言前に呼ばれると ReferenceError になるので、必ず try で包んだ側から呼ぶ。 */
  function sb0() { return sb; }

  /* ★'other' で来るのは「語彙に当たらなかった」行だけ（actual-pay.js:250）。 */
  function airName(code) {
    if (!code) return '';
    if (code === 'other') return (L === 'ja') ? '一覧にない航空会社' : 'Airline not in the list';
    return S.air[code] || code;
  }
  function posName(code) { return S.pos[code] || code || ''; }

  // ── 見出しと条件バー ───────────────────────────────────────────
  /* ★信頼度は人数だけでは決まらない。区分が広いほど「自分の給与」から遠い。
     段4（役職のみ・全社）に12人そろっても、それは全社の副操縦士12人であって
     自分の会社の数字ではない。人数の判定と段ごとの上限の、低いほうを採る
     （そうしないと、初日の一番あてにならない状態が「信頼度 高」と出る）。 */
  var TCAP = { airline_pos_fleet: 3, airline_pos_cat: 3, airline_pos: 2, pos: 1, all: 1 };
  function trustOf(n, c) {
    var level = c.level;
    var by  = n >= 10 ? 3 : n >= 5 ? 2 : 1;
    var cap = TCAP[level] != null ? TCAP[level] : 1;
    /* 手で選んだ区分にも、**選んだ絞りの数**で同じ上限を掛ける。
       「役職だけ・全社」を選んだ人に「信頼度 高」と出さないため
       （自動で段4に落ちたときと同じ扱いになる）。 */
    if (level === 'selected') {
      var k = (c.airline ? 1 : 0) + (c.pos ? 1 : 0) + (c.fleet ? 1 : 0);
      cap = k >= 3 ? 3 : k === 2 ? 2 : 1;
    }
    var r   = Math.min(by, cap);
    if (r >= 3) return { k: T.hi,  m: '' };
    if (r === 2) return { k: T.mid, m: ' dp-trust--mid' };
    return { k: T.lo, m: ' dp-trust--low' };
  }
  /* ★区分が落ちた段では会社名を出さない。落ちた元の段の値をサーバも返していない。
     level を隠さないこと ── 隠すと読み手は「自分の会社の数字」だと誤解する。 */
  function cohortWords(c) {
    var air = airName(c.airline), pos = posName(c.pos);
    var fleet = c.fleet ? String(c.fleet).toUpperCase() : '';
    /* 手で選んだとき。選ばなかった面は言わない（会社だけ「全社」と補う）。 */
    if (c.level === 'selected')          return [air || T.allAir, pos, fleet].filter(Boolean);
    if (c.level === 'airline_pos_fleet') return [air, pos, fleet].filter(Boolean);
    if (c.level === 'airline_pos_cat')   return [air, pos, T.cat].filter(Boolean);
    if (c.level === 'airline_pos')       return [air, pos].filter(Boolean);
    if (c.level === 'pos')               return [pos, T.allAir].filter(Boolean);
    return [T.allPos];
  }
  /* ── 区分を選ぶ（2026-08-30）────────────────────────────────────
     ★自分の区分しか見られないのは、REAL PAY（pv_pay_rows）が最初から
       全社の行を返しているのと食い違う。会社・役職・機材の3つを選べる。
     ★守りは足さない。3人に満たない区分は db/deep-pay.sql が level:'none' を返し、
       広い区分に**登らない**（登ると、選んだ会社の見出しのまま全体の数字が出る）。
       だから画面側で人数を数えたり伏せたりしない ── 壁は1か所（SQL）にしか無い。
     ★3つとも空なら引数を渡さない。今までと1バイトも同じ呼び方に戻す。 */
  var RGO = ['japan', 'mideast', 'asia', 'europe', 'us', 'latam', 'oceania', 'africa'];
  function optlist(items, cur) {
    return '<option value="">' + esc(T.pickAny) + '</option>' +
      items.map(function (o) {
        return '<option value="' + esc(o.v) + '"' + (o.v === cur ? ' selected' : '') + '>' +
          esc(o.t) + '</option>';
      }).join('');
  }
  /* ── 選べる組み合わせ（2026-09-01・オーナー確定）────────────────
     約束は1つ ── **選べる ＝ 必ず数字が返る**。
     110社 × 3職位 × 19機材を素で並べると、選んだ先が「まだ出せません」しか無い
     選択肢が大半になる。だからサーバ（db/deep-pay.sql の avail）が配った
     組み合わせだけを並べる。
     ★誰が「出る」かを**画面側で数えない。** 一覧は区分の壁（lvl）と同じ数え方で
       出したものをそのまま使う。ここで数え直すと2つがズレたとき
       「選べるのに選ぶと空」が**画面は普通に動いたまま**起きる。
     ★**一覧が無いときの逃げ道を置かない**（自動 fallback 禁止）。
       null なら選択欄そのものを出さず、理由を1行だけ出す。
       ⚠️ つまり db/deep-pay.sql を貼る前に push すると選択欄が出ない。順番を守る。 */
  function pk() { var v = S.picks; return (v && Array.isArray(v.air)) ? v : null; }
  /* ★中身が変わった回だけ pkv を進める。毎回進めると、区分を選び直すたびに
       選択欄を組み直すことになり、開いたままの <select> が閉じる。 */
  function setPicks(v) {
    if (!v || !Array.isArray(v.air)) return;
    var j = JSON.stringify(v);
    if (j === S.pkj) return;
    S.pkj = j; S.picks = v; S.pkv++;
  }
  function airList() {
    var v = pk();
    return v ? S.airs.filter(function (a) { return v.air.indexOf(a.v) >= 0; }) : [];
  }
  function posList() {
    var v = pk(), l = v && v.pos[S.sel.airline || ''];
    return l ? S.poss.filter(function (o) { return l.indexOf(o.v) >= 0; }) : [];
  }
  function fltList() {
    var v = pk(), l = v && v.flt[(S.sel.airline || '') + '|' + (S.sel.position || '')];
    return l ? S.flts.filter(function (o) { return l.indexOf(o.v) >= 0; }) : [];
  }
  /* ★会社を変えると、いま選んでいる役職・機材がその会社に無いことがある。
       **必ずこの順（会社 → 役職 → 機材）で落とす。** 順番を入れ替えて機材から
       均すと、会社を落とした後にもう一度合わなくなる。
     ★行き止まりは構造的に無い ── 一覧に居る会社は「会社だけ」で必ず数字が返るので、
       役職・機材の「選択する」（＝絞らない）はいつでも有効。 */
  function fix() {
    var v = pk();
    if (!v) { S.sel = { airline: '', position: '', fleet: '' }; return; }
    if (S.sel.airline && v.air.indexOf(S.sel.airline) < 0) S.sel.airline = '';
    var pl = v.pos[S.sel.airline || ''] || [];
    if (S.sel.position && pl.indexOf(S.sel.position) < 0) S.sel.position = '';
    var fl = v.flt[(S.sel.airline || '') + '|' + (S.sel.position || '')] || [];
    if (S.sel.fleet && fl.indexOf(S.sel.fleet) < 0) S.sel.fleet = '';
  }
  function opt(a, cur) {
    return '<option value="' + esc(a.v) + '"' + (a.v === cur ? ' selected' : '') + '>' +
      esc(a.t) + '</option>';
  }
  /* 残った会社を地域ごとにまとめる（並びは今までと同じ）。 */
  function airOpts(cur) {
    var h = '<option value="">' + esc(T.pickAny) + '</option>';
    var by = {};
    airList().forEach(function (a) { (by[a.rg] || (by[a.rg] = [])).push(a); });
    var order = RGO.filter(function (r) { return by[r]; })
      .concat(Object.keys(by).filter(function (r) { return RGO.indexOf(r) < 0; }));
    order.forEach(function (r) {
      h += '<optgroup label="' + esc((T.rg && T.rg[r]) || r) + '">' +
        by[r].sort(function (x, y) { return x.t > y.t ? 1 : -1; })
          .map(function (a) { return opt(a, cur); }).join('') + '</optgroup>';
    });
    return h;
  }
  function field(id, label, opts) {
    return '<label class="dp-pick-f" for="' + id + '"><span class="dp-pick-l">' +
      esc(label) + '</span><select id="' + id + '" class="dp-pick-s">' + opts + '</select></label>';
  }
  function picked() { return !!(S.sel.airline || S.sel.position || S.sel.fleet); }
  function onPick() {
    S.sel = {
      airline:  (el('dp-pk-air') || {}).value || '',
      position: (el('dp-pk-pos') || {}).value || '',
      fleet:    (el('dp-pk-flt') || {}).value || ''
    };
    fix();      /* ★会社を変えた拍子に、その会社に無い役職・機材が残らないように */
    /* ★どれも選んでいない形に戻したら、引き直さずに「選んでください」に戻る
       （捨てるだけの答えを取りに行かない）。 */
    if (!S.client) return;
    if (picked()) load(S.client); else render();
  }
  function picker() {
    var box = el('dp-pick');
    if (!box) return;
    /* 辞書は RPC より後に届くことがある。中身が変わった回だけ組み直す
       （毎回組み直すと、通貨を切り替えただけで選択が飛ぶ）。
       ★選べる組み合わせ（pkv）も合図に入れる。辞書と RPC は届く順が決まって
         いないので、後から来た側で組み直せないと欄が空のまま残る。
       ★役職・機材の一覧は選んでいる会社で変わるので、sel の3つも合図に要る。 */
    var sig = L + '|' + S.airs.length + '|' + S.poss.length + '|' + S.flts.length +
      '|' + S.pkv +
      '|' + S.sel.airline + '|' + S.sel.position + '|' + S.sel.fleet;
    if (box.getAttribute('data-sig') !== sig) {
      box.setAttribute('data-sig', sig);
      /* ★「区分を選ぶ」の見出しは置かない（2026-08-31）。欄ごとのラベル
         （会社 / 役職 / 機材）で足りるうえ、見出しだけで1段ぶん（約49px）
         使う。この画面は1画面に収めるのが約束なので、段を増やさない。 */
      var av = airList();
      box.innerHTML = av.length
        ? (field('dp-pk-air', T.pickAir, airOpts(S.sel.airline)) +
           field('dp-pk-pos', T.pickPos, optlist(posList(), S.sel.position)) +
           field('dp-pk-flt', T.pickFlt, optlist(fltList(), S.sel.fleet)) +
           (picked()
             ? '<button type="button" class="dp-pick-r" id="dp-pk-rst">' + esc(T.pickReset) + '</button>'
             : '') +
           '<p class="dp-pick-n">' + esc(T.pickNote) + '</p>')
        /* ★一覧が届いていない／中身が1つも無いときは**欄を出さない**。
             出すと「選べるのに数字が出ない」が生まれる（自動 fallback 禁止）。 */
        : '<p class="dp-pick-n">' + esc(T.pickNone) + '</p>';
      ['dp-pk-air', 'dp-pk-pos', 'dp-pk-flt'].forEach(function (id) {
        var e = el(id); if (e) e.addEventListener('change', onPick);
      });
      var r = el('dp-pk-rst');
      if (r) r.addEventListener('click', function () {
        S.sel = { airline: '', position: '', fleet: '' };
        render();   /* ★引き直さない。選んでいない画面は何も出さないので答えが要らない */
      });
    }
    /* 引いている間は触らせない（連打で答えが入れ替わるのを止める）。 */
    ['dp-pk-air', 'dp-pk-pos', 'dp-pk-flt', 'dp-pk-rst'].forEach(function (id) {
      var e = el(id); if (e) e.disabled = !!S.busy || !S.client;
    });
    /* 鍵が掛かっている画面・読み込めなかった画面では選ばせない
       （どの区分を選んでも答えは同じなので、押せる欄を出すのは嘘になる）。 */
    box.hidden = !(S.mode === 'open' || S.mode === 'load');
  }

  function head() {
    var box = el('dp-hd');
    if (!box) return;
    var h = '<h1 class="mr-hd-t">' + esc(T.hd) + '</h1>';
    var c = S.data && S.data.cohort;
    /* ★picked() が要る。無いとクリアした後も前の区分の条件バーが
       空のページの上に残り、「この数字はまだ出ている」と読まれる。 */
    if (S.mode === 'open' && picked() && c && c.level !== 'none') {
      var parts = cohortWords(c);
      var n = num(c.n);
      if (n != null) parts.push(n + T.people);
      /* ★明細の裏付けがある人数（db/deep-pay.sql の hagg.vfn）。
         こちらも**人数**で「件」ではない。0 人のときは足さない
         （「うち明細あり 0人」と書くと、信じるなと言っているのと同じ）。 */
      var vn = num(S.data && S.data.head && S.data.head.verified_n);
      if (vn) parts.push(T.verif + vn + T.people);
      /* ★「直近24か月」は db/deep-pay.sql の sane の写し。数えているのは
         **投稿した日ではなく、その報酬がいつの月のものか**（period_year /
         period_month）。当月を含めて暦で24か月ちょうど。あちらを変えたらここも直す。 */
      parts.push(T.months);
      var t = trustOf(n || 0, c);
      h += '<div class="dp-cond"><span class="dp-cond-l">' +
        '<span class="dp-cond-k">' + esc(T.now) + '</span>' +
        parts.map(function (x, i) {
          return (i ? '<span class="dp-cond-s">/</span>' : '') + '<span>' + esc(x) + '</span>';
        }).join('') + '</span>' +
        '<span class="dp-trust' + t.m + '">' + IC.info.replace('24" height="24', '12" height="12') +
        esc(T.trust) + ' ' + esc(t.k) + '</span></div>';
    }
    box.innerHTML = h;
  }

  // ── ① KPI 3枚 ─────────────────────────────────────────────────
  /* 表示上の文字幅。全角は2つぶんで数える（「¥1,700万」は7文字だが幅は8）。 */
  function vwidth(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) n += s.charCodeAt(i) > 0x2e7f ? 2 : 1;
    return n;
  }
  /* ★長い数字は1段小さくする。英語ページの JPY だけ「万」に畳まれず
     「¥17,000,000」（幅11）になり、既定の 1.85rem ではカードに収まらない。
     CSS の overflow:hidden に任せると「¥17,000,0…」と金額が途中で切れて出る。 */
  function kpi(o) {
    var lng = vwidth(String(o.v)) >= 10 ? ' dp-kpi-v--long' : '';
    return '<div class="dp-kpi' + (o.green ? ' dp-kpi--green' : '') + '">' +
      '<span class="dp-kpi-ic' + (o.ic ? ' dp-kpi-ic--' + o.ic : '') + '">' + o.svg + '</span>' +
      '<span class="dp-kpi-b"><span class="dp-kpi-k">' + esc(o.k) + '</span>' +
      '<b class="dp-kpi-v' + lng + '">' + esc(o.v) +
      (o.u ? '<span class="dp-kpi-u">' + esc(o.u) + '</span>' : '') + '</b>' +
      (o.n ? '<span class="dp-kpi-n">' + esc(o.n) + '</span>' : '') + '</span></div>';
  }
  /* ★3枚作って .filter(Boolean)。数字の無いカードは**落とす**（0 を置かない）。
     初日は年収の1枚しか出ない。それが正しい出力。
     ★「詳細投稿数」の4枚目は 2026-08-31 に外した。中身は head.detailed_n ＝ **人数**
       なのに単位が「件」で、しかもすぐ上の条件バーの「◯人」と同じ数だった
       （db/deep-pay.sql の person が proof_hash で1行＝1人に潰している）。 */
  function kpis() {
    var box = el('dp-kpi');
    if (!box) return;
    var h = (S.data && S.data.head) || {};
    /* ★月換算は賞与ぬき（給与構成の月額と同じ土俵）。割合が出ているときだけ
       ラベルを「月換算（賞与ぬき）約」にする。詳しくは moneyMonth のコメント。 */
    var bp = num(S.data && S.data.comp && S.data.comp.bonus && S.data.comp.bonus.pct_of_annual);
    var a = money(h.annual_usd), am = moneyMonth(h.annual_usd, bp);
    var fx = num(h.fixed_pct), pb = moneyExact(h.per_block_usd);
    /* ★変動給比率は「100 − 固定・保証給比率」ではない。db/deep-pay.sql の fixed_pct は
       固定＋職位＋役割で、残りにはパーディアム・住宅・その他・未分類も入っている。
       引き算だとそれを全部「変動給」と呼んでしまう。無い区分は行ごと出さない。 */
    var vp = segPct((S.data && S.data.comp && S.data.comp.segs) || [], 'variable');
    var cards = [
      a == null ? null : kpi({ k: T.k1, v: a,
                               n: am ? (bp == null ? T.k1n : T.k1nb) + am : '',
                               ic: 'org', svg: IC.money }),
      fx == null ? null : kpi({ k: T.k2, v: Math.round(fx), u: '%', green: true, ic: 'grn',
                                svg: IC.pie, n: vp == null ? '' : T.k2n + Math.round(vp) + '%' }),
      pb == null ? null : kpi({ k: T.k3, v: pb, n: T.k3n, ic: 'tea', svg: IC.clock })
    ].filter(Boolean);
    /* ★注記は**この1行だけ**（2026-09-01 にここへ集めた）。
       - 3人の壁（T.foot）── 給与構成のカードの中に置いていた。あの壁は円グラフだけの
         話ではなく画面全体の約束なので、数字の真下のここが正しい。
       - 年収の中身（T.footA）── これまで画面のどこにも書いていなかった。
       ★1つの `<p>` にまとめている。ここは全幅（約1160px）なので2文でも1行に収まる。
         2つの `<p>` に分けると、行が増えるぶんだけ画面が下へ伸びて 1512×980 に収まらない。
       ⚠️ 年収のカードが出ていないとき（a == null）は年収の定義を書かない（定義だけ浮く）。 */
    var fo = cards.length
      ? '<p class="dp-foot">' + esc(T.foot) + (a == null ? '' : ' ' + esc(T.footA)) + '</p>'
      : '';
    box.innerHTML = cards.length ? '<div class="dp-kpis">' + cards.join('') + '</div>' + fo : '';
    box.hidden = !cards.length;
  }

  // ── ② 給与構成 ────────────────────────────────────────────────
  /* 絵は PVViz.donutFromSegs に任せる。ここでするのは
     「モックの3列の表に見えるように、金額の列を足して見出し行を挿す」だけ。
     ★amounts:false で呼ぶ。あちらの凡例の金額は fmt(v) ＝ **割合を金額として**
       刷ってしまう（渡している v が pct だから）。金額は自分で足す。 */
  function comp() {
    var box = el('dp-comp');
    if (!box) return;
    var c = S.data && S.data.comp;
    var segs = (c && c.segs) || [];
    var real = segs.filter(function (s) { return s.k !== 'rest'; });
    if (!c || real.length < 3) {
      box.innerHTML = sec(T.compT, empty(T.compNone) +
        '<p class="dp-cta-n">' + esc(T.compNoneS) + '</p>' +
        '<a class="dp-cta" href="pay-report.html">' + esc(T.lockCta) + '</a>', T.compS);
      box.hidden = false;
      return;
    }

    var s = { total: 0, segs: [] };
    segs.forEach(function (x) {
      var p = num(x.pct);
      if (p == null || !(p > 0)) return;
      s.segs.push({ k: x.k, c: COL[x.k] || COL.rest, v: p });
      s.total += p;
    });
    if (!s.total) { box.hidden = true; return; }

    var body = V.donutFromSegs(s, {
      title: '', name: CN, amounts: false, center: T.center
    });

    // 賞与は円の外（オーナー確定）。3人以上いるときだけ1行。
    var b = c.bonus, bp = b ? num(b.pct_of_annual) : null;
    if (bp != null) {
      body += '<div class="dp-bonus"><span class="dp-bonus-k">' + esc(T.bonusK) +
        '<span class="dp-bonus-s">' + esc(T.bonusS) + '</span></span>' +
        '<span class="dp-bonus-v">' + esc(Math.round(bp) + '%') + '</span></div>';
    }
    body += note(esc(T.compNote));
    if (segs.some(function (x) { return x.k === 'rest'; })) body += note(esc(T.restNote));
    /* ⚠️ ここに `.dp-foot` を戻さない（3人の壁も年収の定義も kpis() の全幅の行に移した）。
       このカードは上の段の高さを決めている側で、幅が狭いぶん1文が2〜3行に折れ、
       折れたぶんだけ画面全体が下へ伸びる（1512×980 の1画面に収まらなくなり、
       実際に assert-deep-pay.mjs の「★1画面に収まる」が落ちた）。 */

    box.innerHTML = sec(T.compT, body, T.compS);
    box.hidden = false;

    /* 凡例に金額の列と見出し行を足す。★DOM で足す（文字列を切り貼りすると
       donutFromSegs の出力の形に依存する）。行の並びは s.segs と同じ順。 */
    var leg = box.querySelector('.pt-legend');
    if (!leg) return;
    var rows = leg.querySelectorAll('.pt-leg');
    for (var i = 0; i < rows.length && i < s.segs.length; i++) {
      var m = moneyExact(segByKey(segs, s.segs[i].k));
      var sp = d.createElement('span');
      sp.className = 'amt';
      sp.textContent = (m == null) ? '—' : m;
      rows[i].appendChild(sp);
    }
    leg.insertAdjacentHTML('afterbegin',
      '<div class="pt-leg dp-th"><i></i><span class="nm">' + esc(T.thK) + '</span>' +
      '<span class="pct">' + esc(T.thP) + '</span>' +
      '<span class="amt">' + esc(T.thA) + '</span></div>');
  }
  function segByKey(segs, k) {
    for (var i = 0; i < segs.length; i++) if (segs[i].k === k) return segs[i].med_usd;
    return null;
  }
  /* ★無い区分は null を返す。0 を返さない ── 0% と書けば「その手当が無い会社」に見えるが、
     実際は「3人に届かず出せない」だけのことがある。 */
  function segPct(segs, k) {
    for (var i = 0; i < segs.length; i++) if (segs[i].k === k) return num(segs[i].pct);
    return null;
  }

  // ── ③ 働き方と報酬 ────────────────────────────────────────────
  function li(o) {
    return '<div class="dp-li"><span class="dp-li-ic">' + o.svg + '</span>' +
      '<span class="dp-li-l"><span class="dp-li-t">' + esc(o.t) + '</span>' +
      (o.s ? '<span class="dp-li-s">' + esc(o.s) + '</span>' : '') + '</span>' +
      (o.w == null ? '' :
        '<span class="dp-li-b"><i class="dp-li-f" style="width:' +
          Math.max(3, Math.min(100, o.w)).toFixed(1) + '%;background:' + o.c + '"></i></span>') +
      '<span class="dp-li-v">' + esc(o.v) +
      (o.u ? '<small>' + esc(o.u) + '</small>' : '') + '</span></div>';
  }
  /* ★null は行ごと飛ばす。2行以上残ったときだけ節を描く。
     ★棒は置かない（2026-08-31）。Block 74h・Duty 141h・勤務 18日・ステイ 9泊は
       単位が3種類あり、時間は「節の中で一番長い行」、日数は「30日」と
       **別々の基準**で伸ばしていた。長さを見比べても意味が無い形だったので、
       数字と単位だけにした。棒が要るのは同じ単位で並ぶ変動給（--var）だけ。 */
  function work() {
    var box = el('dp-work');
    if (!box) return;
    var wk = (S.data && S.data.work) || {};
    var bh = num(wk.block_h), dh = num(wk.duty_h);
    var dd = num(wk.duty_days), sn = num(wk.stay_nights);
    var rows = [
      bh == null ? null : li({ t: 'Block Hours', s: T.workS, v: bh.toFixed(1), u: 'h',
                               svg: IC.plane }),
      dh == null ? null : li({ t: 'Duty Hours', s: T.workS, v: dh.toFixed(1), u: 'h',
                               svg: IC.watch }),
      dd == null ? null : li({ t: (L === 'ja') ? '勤務日数' : 'Duty Days', s: T.workS,
                               v: dd.toFixed(1).replace(/\.0$/, ''),
                               u: (L === 'ja') ? '日' : 'd', svg: IC.cal }),
      sn == null ? null : li({ t: (L === 'ja') ? 'ステイ日数' : 'Stay Nights', s: T.workS,
                               v: sn.toFixed(1).replace(/\.0$/, ''),
                               u: (L === 'ja') ? '泊' : 'n', svg: IC.bed })
    ].filter(Boolean);
    if (rows.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
    box.innerHTML = sec(T.workT,
      '<div class="dp-list dp-list--work">' + rows.join('') + '</div>' +
      '<div class="dp-hint">' + IC.info.replace('24" height="24', '16" height="16') +
        '<p><b>' + esc(T.hintT) + '</b><br>' + esc(T.hintS) + '</p></div>');
    box.hidden = false;
  }

  // ── ④ 変動給の中身 ────────────────────────────────────────────
  /* ★棒は全部同じ色（PVViz.SEG の flight）。区分ごとに色を変えると
     「夜間のほうが得」と読まれる。my-value.js の pct() も同じ立場。
     ★night / weekend / holiday はサーバが3つのまま返す。ここで束ねない。 */
  function vari() {
    var box = el('dp-var');
    if (!box) return;
    var v = (S.data && S.data['var']) || [];
    if (!v || v.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
    var top = v.reduce(function (a, x) { return Math.max(a, num(x.pct) || 0); }, 0) || 1;
    var rows = v.map(function (x) {
      var p = num(x.pct);
      if (p == null || !(p > 0)) return null;
      var nm = VN[x.k] || [x.k, ''];
      return li({ t: nm[0], s: nm[1], v: Math.round(p) + '%', w: p / top * 100,
                  c: COL.variable, svg: IC.layer });
    }).filter(Boolean);
    if (rows.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
    /* ★一番大きい区分を1文にする。**2区分以上あるときだけ**（1つしか無いと
       必ず「100%」になり、読んでも何も分からない行が1本増えるだけ）。
       値は既に画面に出ている var[0].pct をそのまま使う ── 表の数字と1桁も違わない。 */
    var lead = '';
    var t0 = v.filter(function (x) { return num(x.pct) > 0; })
              .sort(function (a, b) { return num(b.pct) - num(a.pct); })[0];
    if (t0 && rows.length >= 2) {
      var ln0 = (VN[t0.k] || [t0.k])[0];
      lead = '<p class="dp-lead">' + esc(T.varLead[0]) +
        '<b>' + Math.round(num(t0.pct)) + '%</b>' + esc(T.varLead[1]) +
        '<b>' + esc(ln0) + '</b>' + esc(T.varLead[2]) + '</p>';
    }
    box.innerHTML = sec(T.varT, lead + '<div class="dp-list dp-list--var">' + rows.join('') + '</div>' +
      note(esc(T.varNote)), T.varS);
    box.hidden = false;
  }

  // ── ⑥ もっと深く見る ──────────────────────────────────────────
  /* 会社比較（deep-pay-compare.html）は在るので本物の <a href>。
     ★2026-08-31、「役割別で見る（準備中）」の押せないボタンを外した。
       押せないものを並べると、押せる1本がどれか分かりにくくなる。
       ⚠️ 無い先へリンクを張らない（assert-links.mjs が404で落とす）。
       役割別ができたら ln() をもう1本足すだけでよい。 */
  function more() {
    var box = el('dp-more');
    if (!box) return;
    function ln(href, t, ic) {
      return '<a class="dp-more-b dp-more-b--on" href="' + esc(href) + '">' +
        ic.replace('24" height="24', '15" height="15') + esc(t) +
        IC.chev.replace('24" height="24', '15" height="15') + '</a>';
    }
    box.innerHTML = '<section class="mr-card"><div class="dp-more">' +
      '<div class="dp-more-l"><span class="dp-more-ic">' + IC.eye + '</span>' +
      '<span class="dp-more-tx"><span class="dp-more-t">' + esc(T.moreT) + '</span>' +
      '<span class="dp-more-s">' + esc(T.moreS) + '</span></span></div>' +
      '<div class="dp-more-r">' + ln('deep-pay-compare.html', T.more1, IC.layer) + '</div>' +
      '</div></section>';
    box.hidden = false;
  }

  // ── 開いていないとき ──────────────────────────────────────────
  function shut(kind) {
    ['dp-comp', 'dp-work', 'dp-var', 'dp-more'].forEach(function (id) {
      var b = el(id); if (b) { b.innerHTML = ''; b.hidden = true; }
    });
    /* ★板は #dp-kpi（全幅・見出しの直下）に出す。2段組の左半分に入れると
       右が白く空いて「読み込みに失敗した」ように見える。 */
    var box = el('dp-kpi');
    if (!box) return;
    if (kind === 'error') {
      box.innerHTML = '<div class="dp-msg">' + empty(T.err) + '</div>';
      box.hidden = false;
      return;
    }
    var g = (S.data && S.data.gate) || {};
    var lines = [];
    if (!g.key) lines.push(T.lockKey);
    if (!g.detailed) lines.push(T.lockDet);
    /* ★100人に届いていないときは、そう書く（2026-09-01）。書かないと
       「明細を1枚出せば開く」だけが出て、出しても開かない人が生まれる。
       ★数字は返ってきた gate から読む。JS で数え直さない（門と同じ数）。 */
    if (g.contributors != null && g.goal != null &&
        Number(g.contributors) < Number(g.goal))
      lines.push(T.lockGoal.replace('{goal}', function () { return String(g.goal); })
                           .replace('{n}',    function () { return String(g.contributors); }));
    if (!lines.length) lines.push(T.lockDet);
    box.innerHTML = '<div class="dp-msg dp-msg--lock">' +
      '<div class="dp-msg-t">' + IC.lock.replace('24" height="24', '18" height="18') +
        esc(T.lockT) + '</div>' +
      '<p class="dp-msg-s">' + lines.map(esc).join('<br>') + '</p>' +
      '<a class="dp-cta" href="pay-report.html">' + esc(T.lockCta) + '</a>' +
      '<p class="dp-cta-n">' + esc(T.lockN) + '</p></div>';
    box.hidden = false;
  }

  /* ★選んだ区分が3人に届かなかったとき。**広い区分の数字で埋めない。**
     「あと1人」とも書かない ── 書いた瞬間、その区分の人数が1人単位で読める。 */
  function thin() {
    ['dp-comp', 'dp-work', 'dp-var', 'dp-more'].forEach(function (id) {
      var b = el(id); if (b) { b.innerHTML = ''; b.hidden = true; }
    });
    var box = el('dp-kpi');
    if (!box) return;
    /* ★選択欄がサーバの一覧どおりなら、ここには**届かないはず**の板。
         それでも残してある ── 一覧を受け取った後にその区分の人が消えた回
         （投稿の削除・24か月の窓から落ちた）に、広い区分の数字で埋めないため。 */
    box.innerHTML = '<div class="dp-msg dp-msg--lock">' +
      '<div class="dp-msg-t">' + IC.info.replace('24" height="24', '18" height="18') +
        esc(T.thinT) + '</div>' +
      '<p class="dp-msg-s">' + esc(T.thinS) + '</p>' +
      '<a class="dp-cta" href="pay-report.html">' + esc(T.lockCta) + '</a></div>';
    box.hidden = false;
  }

  /* ★まだ何も選んでいないとき。**呼んだ本人の区分を勝手に出さない。**
     前は3つとも空なら SQL のはしごが降りて「副操縦士・全社 12人」のような
     別の区分が出ていたが、読み手はそれを自分の会社の数字だと読み違える。
     鍵は掛かっていないので pay-report.html の誘いは出さない。 */
  function ask() {
    ['dp-comp', 'dp-work', 'dp-var', 'dp-more'].forEach(function (id) {
      var b = el(id); if (b) { b.innerHTML = ''; b.hidden = true; }
    });
    var box = el('dp-kpi');
    if (!box) return;
    /* ★選べる会社が1つも無いときに「選んでください」と書かない（2026-09-01）。
         上の欄は消えているので、読み手には**押せるものが画面に無い**。
         同じ画面で「選べる条件がまだありません」と「選んでください」が並ぶと、
         自分の操作が悪いのだと読める。判定は picker() と同じ airList() を使う
         （別々に持つと、片方だけ直したときに文言が食い違う）。 */
    var none = airList().length === 0;
    box.innerHTML = '<div class="dp-msg dp-msg--ask">' +
      '<div class="dp-msg-t">' + IC.info.replace('24" height="24', '18" height="18') +
        esc(none ? T.askNoneT : T.askT) + '</div>' +
      '<p class="dp-msg-s">' + esc(none ? T.askNoneS : T.askS) + '</p></div>';
    box.hidden = false;
  }

  // ── 描く ───────────────────────────────────────────────────────
  function render() {
    picker(); head();
    if (S.mode === 'error') { shut('error'); return; }
    if (S.mode !== 'open')  { shut('lock');  return; }
    /* ★この3行の順番が効いている。錠前より前に置くと鍵の画面が出ず、
       level==='none' より後ろに置くとクリアした直後に
       「人数が足りません」（前の区分の答え）が出る。 */
    if (!picked())          { ask();         return; }
    var c = S.data && S.data.cohort;
    if (c && c.level === 'none') { thin(); return; }
    kpis(); comp(); work(); vari(); more();
  }

  // ── 起動 ───────────────────────────────────────────────────────
  function boot() {
    var client = null;
    try { client = sb0(); } catch (e) { client = null; }
    if (!client || !client.rpc) { S.mode = 'error'; render(); return; }

    var ready = w.PV_SESSION && typeof w.PV_SESSION.then === 'function'
      ? w.PV_SESSION : { then: function (f) { f(null); return { catch: function () {} }; } };
    ready.then(function (session) {
      if (!session) return;                     // ページ側がログインへ送っている
      /* 匿名で出した給与の預かり証を拾う（actual-pay.js と同じ位置・同じ理由）。
         ★pv_deep_pay() より **前**。引き取りに成功すると解放が立つので、
           直後に引けば1回目から開いた画面になる。 */
      var swept = null;
      try { if (w.PVClaimPending) swept = w.PVClaimPending.sweep(client); } catch (e) { swept = null; }
      Promise.resolve(swept).catch(function () { return null; }).then(function () { load(client); });
    });

    /* ★通貨の切替は描き直すだけ。pv_deep_pay() を引き直さない。 */
    w.addEventListener('pv-currency-change', function () { render(); });

    /* 語彙（職位）と社名の辞書。★辞書が後から届いても描き直す
       ＝ RPC のほうが先に返っても、条件バーがコードのまま固まらない。 */
    fetch(VOCAB_URL).then(function (r) { return r.json(); }).then(function (v) {
      (v.positions || []).forEach(function (p) {
        S.pos[p.code] = p[L] || p.ja;
        S.poss.push({ v: p.code, t: p[L] || p.ja });
      });
      /* ★選択肢は語彙そのまま。SQL 側も pv_positions / pv_fleets の中だけを許す
         ＝ 画面に出る選択肢と、通る値が同じ集合になる。 */
      (v.fleets || []).forEach(function (f) { S.flts.push({ v: f.code, t: f[L] || f.ja }); });
    }).catch(function () {}).then(function () {
      return fetch(AIR_URL).then(function (r) { return r.json(); });
    }).then(function (j) {
      var a = (j && j.airlines) || {};
      Object.keys(a).forEach(function (c) {
        S.air[c] = a[c][L] || a[c].ja || c;
        S.airs.push({ v: c, t: S.air[c], rg: a[c].region || '' });
      });
      render();
    }).catch(function () { render(); });
  }

  function load(client) {
    S.client = client;
    S.busy = true;
    picker();
    /* ★3つとも空なら**引数を渡さない**。この1回で取りに行くのは
       state・gate・give・stats **だけ**で、cohort / head / comp は捨てる
       （選ぶまで数字は1つも出さないため）。錠前の画面を描くのにこの1回が要る。
       ⚠️ db/deep-pay.sql の「区分のはしご」（段1〜5・v_man=false）は、これで
          この画面から使われなくなった。SQL は873行あってオーナーが手で貼るので、
          消さずにそのまま残してある。消すときは貼り直しとセットになる。 */
    var args = picked()
      ? [{ p: { airline: S.sel.airline || null,
                position: S.sel.position || null,
                fleet: S.sel.fleet || null } }]
      : [];
    /* ★ rpc() が返すのは「then だけを持つ箱」で Promise ではない
         （actual-pay.js の注記どおり）。Promise.resolve() で包んでから catch を付ける。 */
    Promise.resolve(client.rpc.apply(client, ['pv_deep_pay'].concat(args))).then(function (res) {
      S.busy = false;
      if (res && res.error) { S.mode = 'error'; render(); return; }
      var v = res && res.data;
      S.data = v || null;
      S.mode = (v && v.state === 'open') ? 'open' : (v ? 'locked' : 'error');
      /* ★一度届いた一覧は消さない。区分を選び直すたびに引き直すので、
           1回でも欠けた答えが来ると選択欄がまるごと消えてちらつく。 */
      setPicks(v && v.picks);
      /* 左メニューの錠前は localStorage の写しで暫定的に出ている。
         サーバの答えで上書きする。★DEEP PAY 自身の錠前は別（pv-gates.js の soon）。 */
      if (w.PVGates && w.PVGates.mark) w.PVGates.mark(!!(v && v.gate && v.gate.key));
      if (w.PVGates && w.PVGates.setProgress) {
        w.PVGates.setProgress({
          n: (v && v.stats) ? v.stats.contributors : null,
          detailed: (v && v.give) ? v.give.detailed : null
        });
      }
      render();
    }).catch(function () { S.busy = false; S.mode = 'error'; render(); });
  }

  /* ★試験用の入口（shot-deep.mjs / assert-deep-pay.mjs が使う）。
     本番の画面はここを呼ばない。**作り物のデータを既定で描かせない**ため、
     呼ばれたときだけ S を差し替えて描き直す。 */
  w.PVDeepPay = {
    render: function (data) { S.data = data || null;
                              setPicks(data && data.picks);
                              fix();
                              S.mode = (data && data.state === 'open') ? 'open' : 'locked';
                              render(); }
  };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
