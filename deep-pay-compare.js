/* deep-pay-compare.js — DEEP PAY / 会社を比べる
   ─────────────────────────────────────────────────────────────────
   2社を横に並べる画面。**新しい SQL は無い。**
   db/deep-pay.sql の pv_deep_pay(jsonb) を、会社を入れ替えて2回呼ぶだけ。
   ＝ n≧3 の壁・有効数字2桁・準識別子の抑制が SQL の1か所に残ったまま再利用される。

   ⚠️ 守る約束（deep-pay.js と同じ。破ると匿名性か信用のどちらかが落ちる）
   1. **JS に `n < 3` と書かない。** 人数の壁は db/deep-pay.sql の1か所だけ。
      薄い区分の合図は `cohort.level === 'none'` ただ1つ。
   2. **無い数字を 0 と書かない。** 片側でも欠けている行は、表から行ごと落とす。
      0% と書くと「その手当が無い会社」に見えるが、実際は「3人に届かず出せない」だけ。
   3. **変動給比率を「100 − 固定・保証給比率」で出さない。** db/deep-pay.sql の fixed_pct は
      固定＋職位＋役割で、残りにはパーディアム・住宅・その他・未分類も入っている。
   4. **順位・パーセンタイル・勝ち負けを書かない。** 差の数値も書かない
      （有効数字2桁の数どうしで「+18%」は嘘の精度）。▲▼も勝ち色も付けない。
   5. **「時給」と呼ばない。** Pay / Block Hour は Block Hours から出した指標。
   6. **個人の明細を出さない。** ここに出るのは中央値と割合だけ。

   ★モックから意図的に外したもの（後から足されないよう理由を残す）
   - 国の絞り込み ── pv_deep_pay に国の facet が無い。無い絞り込みを出すのは嘘になる。
   - 「直近12か月」 ── db/deep-pay.sql の窓は24か月。
   - ピルの「件」 ── DEEP PAY は proof_hash で1行＝1人に束ねている。数えるのは人。
   - 棒の中の「賞与」 ── 賞与は年額。月々の現金の100%に混ぜると分母が壊れる。
     表には行として残す。**モックの凡例のほうが誤り。**
*/
(function (w, d) {
  'use strict';

  var V = w.PVViz;
  if (!V) return;                       // pay-viz.js が先に要る（HTML の順序）
  var esc = V.esc, num = V.num, fmt = V.fmt;

  /* ★ページ相対で書くと /en/ から /en/salary-data.json を見に行って 404 になる
       （actual-pay.js:77 と同じ理由）。絶対パスは公開リポジトリなので書けない。 */
  var AIR_URL = 'salary-data.json', VOCAB_URL = 'pv-vocab.json';
  var LOGO_BASE = 'assets/airline-logos/';
  try {
    var _self = (d.currentScript && d.currentScript.src) || '';
    if (_self) {
      AIR_URL = new URL('salary-data.json', _self).href;
      VOCAB_URL = new URL('pv-vocab.json', _self).href;
      LOGO_BASE = new URL('assets/airline-logos/', _self).href;
    }
  } catch (e) {}

  var L = (d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';

  // ── 文言 ───────────────────────────────────────────────────────
  var T = {
    ja: {
      hd: '会社を比べる',
      hdS: '2社を横に並べて、同じ物差しで読みます。順位は付けません。',
      now: '表示中:', months: '直近24か月', people: '人', vs: 'vs',
      pickA: '会社A', pickB: '会社B', pickPos: '役職（両社共通）',
      /* ★機材は左右で別（2026-09-01・オーナー確定）。会社が違えば飛ばす機材も
         違うので、両社共通にすると片方が必ず空振りする。役職は共通のまま
         ── 比べる土台がそこで揃っている。 */
      pickFltA: '機材（会社A）', pickFltB: '機材（会社B）',
      pickAny: '選択する', pickReset: '選択をクリア',
      /* ★選べる欄のすぐ下の断り1行。⚠️ 数字を1文字も入れない
         （入れた瞬間、その区分の人数が読める。招待の画面と同じ約束）。 */
      pickNote: 'データが十分にある条件のみ表示しています',
      allPos: '役職を問わない', allFlt: '機材を問わない',
      rg: { japan: '日本', mideast: '中東', asia: 'アジア', europe: '欧州',
            us: '北米', latam: '中南米', oceania: 'オセアニア', africa: 'アフリカ' },
      askT: '比べる2社を選んでください',
      askS: '会社Aと会社Bを選ぶと、同じ役職の条件で横に並びます。',
      dupT: '別の会社を選んでください',
      dupS: '会社Aと会社Bに同じ会社が入っています。',
      fewT: '比べられる会社が、まだ2社ありません',
      fewS: '3人そろった会社から順に出ます。',
      thinT: 'まだ出せません',
      thinS: '3人そろった区分から順に出ます。',
      mAnnual: '年収（中央値）', mPbh: 'Pay / Block Hour', mFixed: '固定・保証給比率',
      mVar: '変動給比率', mPer: 'パーディアム比率', mHou: '住宅手当比率',
      mPerA: 'パーディアム（月額）', mHouA: '住宅手当（月額）',
      mBonus: '賞与・利益分配', mBlock: 'Block Hours / 月', mStay: 'ステイ / 月',
      nightU: '泊',
      diffT: '差がつくポイント', diffS: '両社で比較できる項目だけ',
      diffNone: 'この条件では、並べられる項目がまだありません。',
      thItem: '項目',
      mixT: '給与構成の比較', mixS: '月々の現金・賞与ぬき',
      mixNone: 'この2社では、給与構成をまだ並べられません。',
      mixNote: '※ 3人に満たない項目は棒に入れていません。棒の合計が100%にならないことがあります。',
      tradeT: 'トレードオフ', tradeS: '同じ側が2つとも上回ったときだけ',
      tr1: '{n} ── 年収の中央値 {x}、Block Hours {y}。',
      tr2: '{n} ── 年収の中央値 {x}、ステイの泊数 {y}。',
      tr3: '{n} ── Pay / Block Hour {x}、Block Hours {y}。',
      trEnd: 'どちらが良いかではなく、何を重視するかで見方が変わります。',
      /* ★「データの見方」の板5枚はオーナー判断で削除（2026-08-31・じゃま）。
         残したのはこの1行だけ ── 3人の壁は約束、時給と呼ばないのは仕様。
         カードにせず、表の下に淡い1行で置く（賞与の扱いは mixS が言っている）。 */
      foot: '※ 3人以上そろった区分だけを出しています。Pay / Block Hour は、1人ずつ「年収 ÷ 12 ÷ Block Hours」を出した中央値です。時給ではありません。',
      /* ★年収が何を含むかは、これまで画面のどこにも書いていなかった（2026-09-01 に追加）。
         中身は db/pay-reports.sql の pv_annual_total と対。deep-pay.js の footA と同じ文。 */
      footA: '※ 年収＝住宅手当・パーディアム・交通費・賞与・利益分配を含む現金の年換算。現物の社宅は含みません。',
      ctaT: 'もっと深く見る', ctaS: '別の切り口でも読めます。',
      cta1: '別の会社と比べる', cta3: 'DEEP PAY に戻る',
      lockT: 'DEEP PAY はまだ開いていません',
      lockKey: '給与を1件出すと、90日ぶん開きます。',
      lockDet: '内訳（基本給・手当）まで書いた明細を1件出すと開きます。',
      lockCta: '匿名で給与を出す',
      lockN: '出した内容は集計にしか使いません。個人の明細は誰にも表示されません。',
      err: '読み込めませんでした。少し待ってから開き直してください。'
    },
    en: {
      hd: 'Compare airlines',
      hdS: 'Two airlines side by side, read on the same scale. No ranking.',
      now: 'Showing:', months: 'last 24 months', people: ' pilots', vs: 'vs',
      pickA: 'Airline A', pickB: 'Airline B',
      /* ★役職・機材は左右で共通。ラベルにそう書く ── 見出しを1段足すと
         1画面（1512×980）の約束を破るので、語だけで解く。 */
      pickPos: 'Seat (both airlines)',
      pickFltA: 'Fleet (A)', pickFltB: 'Fleet (B)',
      pickAny: 'Select', pickReset: 'Clear',
      pickNote: 'Only groups with enough data are listed.',
      allPos: 'Any seat', allFlt: 'Any fleet',
      rg: { japan: 'Japan', mideast: 'Middle East', asia: 'Asia', europe: 'Europe',
            us: 'North America', latam: 'Latin America', oceania: 'Oceania', africa: 'Africa' },
      askT: 'Choose two airlines to compare',
      askS: 'Pick airline A and airline B and they appear side by side, on the same seat.',
      dupT: 'Choose a different airline',
      dupS: 'Airline A and airline B are the same.',
      fewT: 'Not enough airlines to compare yet',
      fewS: 'Airlines appear once 3 pilots have reported.',
      thinT: 'Not available yet',
      thinS: 'Groups appear once 3 pilots have reported.',
      mAnnual: 'Annual pay (median)', mPbh: 'Pay / Block Hour', mFixed: 'Fixed & guaranteed share',
      mVar: 'Variable pay share', mPer: 'Per diem share', mHou: 'Housing share',
      mPerA: 'Per diem (monthly)', mHouA: 'Housing allowance (monthly)',
      mBonus: 'Bonus / profit share', mBlock: 'Block hours / month', mStay: 'Layovers / month',
      nightU: ' nights',
      diffT: 'Where they differ', diffS: 'Only rows both airlines report',
      diffNone: 'Nothing can be lined up for this group yet.',
      thItem: 'Item',
      mixT: 'Pay mix, side by side', mixS: 'Monthly cash, bonus excluded',
      mixNone: 'The pay mix cannot be lined up for these two yet.',
      mixNote: 'Items reported by fewer than 3 pilots are left out of the bar, so a bar may not reach 100%.',
      tradeT: 'Trade-offs', tradeS: 'Only when the same side leads both',
      tr1: '{n} — median annual pay {x}, block hours {y}.',
      tr2: '{n} — median annual pay {x}, layover nights {y}.',
      tr3: '{n} — pay per block hour {x}, block hours {y}.',
      trEnd: 'It is not about which is better, but about what you value.',
      foot: 'Only groups of 3 or more pilots are shown. Pay / Block Hour is the median of each pilot’s annual pay ÷ 12 ÷ block hours. It is not an hourly wage.',
      footA: 'Annual pay = cash incl. housing allowance, per diem, transport, bonus and profit share; housing in kind is not counted.',
      ctaT: 'Go deeper', ctaS: 'There are other ways to read this.',
      cta1: 'Compare other airlines', cta3: 'Back to DEEP PAY',
      lockT: 'DEEP PAY is not open yet',
      lockKey: 'Share one pay report and it opens for 90 days.',
      lockDet: 'Share one report with the breakdown (base pay and allowances) to open it.',
      lockCta: 'Share your pay anonymously',
      lockN: 'What you share is only used in aggregates. No individual payslip is ever shown.',
      err: 'Could not load. Please try again in a moment.'
    }
  }[L];

  /* 給与構成の8区分。順は db/deep-pay.sql の cseg と同じ。
     ★bonus はここに無い（年額なので月々の現金の100%に混ぜられない）。 */
  var SEGK = ['fixed', 'variable', 'command', 'role', 'perdiem', 'housing', 'other', 'rest'];
  var CN = {
    ja: { fixed: '基本給・保証給', variable: '変動給', command: '職位手当',
          role: '役割手当', perdiem: 'パーディアム', housing: '住宅手当',
          other: 'その他の現金', rest: 'その他・未分類' },
    en: { fixed: 'Base & guaranteed', variable: 'Variable (flying)', command: 'Rank pay',
          role: 'Role pay', perdiem: 'Per diem', housing: 'Housing allowance',
          other: 'Other cash', rest: 'Other / unclassified' }
  }[L];

  /* 色は PVViz.SEG（配列）から引く。deep-pay.js と同じ組み立て方
     ＝ 同じ項目がマイレポート・Overview・この画面で同じ色になる。 */
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

  // ── 部品（deep-pay.js から本体ごと写す。ずれは assert が見張る）──
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
  function svg(inner, sz) {
    return '<svg viewBox="0 0 24 24" width="' + (sz || 24) + '" height="' + (sz || 24) +
      '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }
  var IC = {
    lock:  svg('<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
    info:  svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6h.01"/>'),
    eye:   svg('<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.6"/>'),
    layer: svg('<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>'),
    users: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/>' +
               '<path d="M16 5.2a3.2 3.2 0 0 1 0 5.6"/><path d="M18 20a6 6 0 0 0-3-5.2"/>'),
    scale: svg('<path d="M12 4v16"/><path d="M5 8h14"/><path d="m5 8-2 6h4l-2-6Z"/>' +
               '<path d="m19 8-2 6h4l-2-6Z"/>'),
    back:  svg('<path d="M15 5 8 12l7 7"/>'),
    chev:  svg('<path d="m9 5 7 7-7 7"/>')
  };

  // ── 状態 ───────────────────────────────────────────────────────
  /* boot は入口の1回ぶん（state / gate / give / stats だけ使う）。
     side は左右それぞれの答え。★役職は左右共通・機材は左右別（fltA / fltB）。
     picks は選べる組み合わせ。形は db/deep-pay.sql の avail と同じ
     { air:[…], pos:{ '会社': […] }, flt:{ '会社|役職': […] } }。
     pkv は「中身が変わった回数」＝ picker() の組み直しの合図。 */
  var S = { mode: 'load', boot: null, air: {}, pos: {}, airs: [], poss: [], flts: [],
            picks: null, pkj: '', pkv: 0,
            sel: { a: '', b: '', pos: '', fltA: '', fltB: '' },
            side: { a: null, b: null }, client: null, busy: false, seq: 0 };

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
  function fltName(code) {
    for (var i = 0; i < S.flts.length; i++) if (S.flts[i].v === code) return S.flts[i].t;
    return code || '';
  }

  /* ロゴ。★ブランド色を持たない版（actual-pay.js:274）。
     salary-data.json は色を持っていないので、色付きの版は使えない。 */
  function logoHtml(code) {
    var ext = (w.PV_LOGOS || {})[code];
    if (code !== 'other' && ext) {
      return '<img class="dc-logo" src="' + esc(LOGO_BASE + code + '.' + ext) + '"'
           + ' alt="" loading="lazy" decoding="async" width="30" height="30"/>';
    }
    var ini = '·';
    if (code !== 'other') {
      var name = String(airName(code) || '');
      ini = name.replace(/[^0-9A-Za-z\u3040-\u30ff\u4e00-\u9fff]/g, '').slice(0, 2).toUpperCase() || '·';
    }
    return '<span class="dc-logo dc-logo--mono" aria-hidden="true">' + esc(ini) + '</span>';
  }

  // ── 数の取り出し ───────────────────────────────────────────────
  /* ★薄い側の唯一の合図。JS では人数を数えない（壁は db/deep-pay.sql の1か所だけ）。 */
  function sideThin(x) { return !x || !x.cohort || x.cohort.level === 'none'; }
  function segsOf(x) { return (x && x.comp && x.comp.segs) || []; }
  /* ★無い区分は null を返す。0 を返さない ── 0% と書けば「その手当が無い会社」に見えるが、
     実際は「3人に届かず出せない」だけのことがある。 */
  function segPct(segs, k) {
    for (var i = 0; i < segs.length; i++) if (segs[i].k === k) return num(segs[i].pct);
    return null;
  }
  /* 区分ごとの月額中央値（USD）。db/deep-pay.sql の cseg が 3人以上そろった区分にだけ
     載せてくる。無ければ null ── 0 を返さない（segPct と同じ理由）。 */
  function segAmt(segs, k) {
    for (var i = 0; i < segs.length; i++) if (segs[i].k === k) return num(segs[i].med_usd);
    return null;
  }
  function pct(v) { return Math.round(v) + '%'; }
  function hrs(v) { return (Math.round(v * 10) / 10) + 'h'; }
  function nights(v) { return (Math.round(v * 10) / 10) + T.nightU; }

  /* 表に出す9項目。順はモックのまま。
     ★variable は segPct から取る。「100 − 固定・保証給比率」では出さない
       （db/deep-pay.sql の fixed_pct は固定＋職位＋役割＋住宅で、
         残りにはパーディアム・その他・未分類も入っている）。 */
  var MET = {
    annual:   { lab: T.mAnnual, f: money,
                get: function (x) { return num(x.head && x.head.annual_usd); } },
    pbh:      { lab: T.mPbh,    f: moneyExact,
                get: function (x) { return num(x.head && x.head.per_block_usd); } },
    fixed:    { lab: T.mFixed,  f: pct,
                get: function (x) { return num(x.head && x.head.fixed_pct); } },
    variable: { lab: T.mVar,    f: pct,
                get: function (x) { return segPct(segsOf(x), 'variable'); } },
    /* ★パーディアム・住宅手当は**両側に月額がそろったときだけ**金額で並べる。
       片側しか無いときは今までどおり率（率なら必ず両側に在る）。
       0 で埋めない・「—」で埋めない ── どちらも「手当が無い会社」に見えてしまう。 */
    perdiem:  { lab: T.mPer,    labA: T.mPerA, f: pct, fA: moneyExact,
                get: function (x) { return segPct(segsOf(x), 'perdiem'); },
                amt: function (x) { return segAmt(segsOf(x), 'perdiem'); } },
    housing:  { lab: T.mHou,    labA: T.mHouA, f: pct, fA: moneyExact,
                get: function (x) { return segPct(segsOf(x), 'housing'); },
                amt: function (x) { return segAmt(segsOf(x), 'housing'); } },
    bonus:    { lab: T.mBonus,  f: pct,
                get: function (x) { return num(x.comp && x.comp.bonus && x.comp.bonus.pct_of_annual); } },
    block:    { lab: T.mBlock,  f: hrs,
                get: function (x) { return num(x.work && x.work.block_h); } },
    stay:     { lab: T.mStay,   f: nights,
                get: function (x) { return num(x.work && x.work.stay_nights); } }
  };
  var ORDER = ['annual', 'pbh', 'fixed', 'variable', 'perdiem', 'housing', 'bonus', 'block', 'stay'];
  var HEAD  = ['annual', 'pbh', 'fixed', 'block'];

  // ── 選ぶ ───────────────────────────────────────────────────────
  var RGO = ['japan', 'mideast', 'asia', 'europe', 'us', 'latam', 'oceania', 'africa'];
  function optlist(items, cur) {
    return '<option value="">' + esc(T.pickAny) + '</option>' +
      items.map(function (o) {
        return '<option value="' + esc(o.v) + '"' + (o.v === cur ? ' selected' : '') + '>' +
          esc(o.t) + '</option>';
      }).join('');
  }
  /* ── 選べる組み合わせ（2026-09-01・オーナー確定）──────────────
     約束は1つ ── **選べる ＝ 実際に比較が成立する**。
     110社 × 3職位 × 19機材を素で並べると、選んだ先が「まだ出せません」しか
     無い選択肢が大半になる。だからサーバ（db/deep-pay.sql の avail）が配った
     組み合わせだけを並べる。この画面は元から「鍵が掛かっているときは選択欄ごと
     隠す」（下の picker）── 押せる欄を出すのは嘘になる、の一段深いところ。

     ★誰が選べるかを**画面側で数えない。** 一覧は区分の壁（lvl）と同じ数え方で
       出したものをそのまま使う。ここで数え直すと2つがズレたとき
       「選択肢に出ているのに選ぶと空」になり、**画面は普通に動いたまま**なので
       誰も気づけない。
     ★**一覧が無いときの逃げ道を置かない**（自動 fallback 禁止）。
       null なら比べられる会社が無いのと同じ扱いにして、理由を出す（下の few）。
       ⚠️ つまり db/deep-pay.sql を貼る前に push するとこの画面は few になる。順番を守る。 */
  function pk() { var v = S.picks; return (v && Array.isArray(v.air)) ? v : null; }
  /* ★中身が変わった回だけ pkv を進める。毎回進めると、選び直すたびに選択欄を
       組み直すことになり、開いたままの <select> が閉じる。 */
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
  /* 役職は**両社共通**なので、A で出る職位と B で出る職位の**交わり**だけ。
     ★片方しか選んでいない間は、選んでいる側だけで絞る。どちらも未選択なら
       「会社を絞らないとき」の一覧（空文字の鍵）を出す。 */
  function posList() {
    var v = pk();
    if (!v) return [];
    var la = v.pos[S.sel.a], lb = v.pos[S.sel.b], l;
    if (S.sel.a && S.sel.b) {
      la = la || []; lb = lb || [];
      l = la.filter(function (x) { return lb.indexOf(x) >= 0; });
    } else l = (S.sel.a ? la : (S.sel.b ? lb : v.pos[''])) || [];
    return S.poss.filter(function (o) { return l.indexOf(o.v) >= 0; });
  }
  /* 機材は左右別。**その会社 × 共通の役職**で数字が返るものだけ。 */
  function fltList(key) {
    var v = pk();
    if (!v) return [];
    var l = v.flt[(S.sel[key] || '') + '|' + (S.sel.pos || '')] || [];
    return S.flts.filter(function (o) { return l.indexOf(o.v) >= 0; });
  }
  /* ★会社を変えると、いまの役職・機材がその会社に無いことがある。
       **必ずこの順（会社 → 役職 → 機材）で落とす。** 機材から均すと、
       役職を落とした後にもう一度合わなくなる。
     ★行き止まりは構造的に無い ── 一覧に居る会社は「会社だけ」で必ず数字が
       返るので、役職・機材の「選択する」（＝絞らない）はいつでも有効。
       交わりが空でも同じ理由で詰まらない。 */
  function fix() {
    var v = pk();
    if (!v) { S.sel = { a: '', b: '', pos: '', fltA: '', fltB: '' }; return; }
    ['a', 'b'].forEach(function (k) {
      if (S.sel[k] && v.air.indexOf(S.sel[k]) < 0) S.sel[k] = '';
    });
    var pl = posList().map(function (o) { return o.v; });
    if (S.sel.pos && pl.indexOf(S.sel.pos) < 0) S.sel.pos = '';
    [['fltA', 'a'], ['fltB', 'b']].forEach(function (q) {
      var fl = fltList(q[1]).map(function (o) { return o.v; });
      if (S.sel[q[0]] && fl.indexOf(S.sel[q[0]]) < 0) S.sel[q[0]] = '';
    });
  }
  /* 比べるには2社要る。1社以下では選ばせず、理由を出す（下の few）。
     ★S.airs が空の間は判定しない（社名の辞書がまだ届いていないだけ）。 */
  function fewAir() {
    return S.airs.length > 0 && airList().length < 2;
  }

  function airOpts(cur) {
    var by = {}, h = '<option value="">' + esc(T.pickAny) + '</option>';
    airList().forEach(function (a) { (by[a.rg] || (by[a.rg] = [])).push(a); });
    var order = RGO.filter(function (r) { return by[r]; })
      .concat(Object.keys(by).filter(function (r) { return RGO.indexOf(r) < 0; }));
    order.forEach(function (r) {
      h += '<optgroup label="' + esc((T.rg && T.rg[r]) || r) + '">' +
        by[r].sort(function (x, y) { return x.t > y.t ? 1 : -1; })
          .map(function (a) {
            return '<option value="' + esc(a.v) + '"' + (a.v === cur ? ' selected' : '') + '>' +
              esc(a.t) + '</option>';
          }).join('') + '</optgroup>';
    });
    return h;
  }
  function field(id, label, opts) {
    return '<label class="dp-pick-f" for="' + id + '"><span class="dp-pick-l">' +
      esc(label) + '</span><select id="' + id + '" class="dp-pick-s">' + opts + '</select></label>';
  }
  function anyPick() {
    return !!(S.sel.a || S.sel.b || S.sel.pos || S.sel.fltA || S.sel.fltB);
  }
  function pairReady() { return !!(S.sel.a && S.sel.b) && S.sel.a !== S.sel.b; }

  function onPick() {
    S.sel = {
      a:    (el('dc-pk-a')   || {}).value || '',
      b:    (el('dc-pk-b')   || {}).value || '',
      pos:  (el('dc-pk-pos') || {}).value || '',
      fltA: (el('dc-pk-fa')  || {}).value || '',
      fltB: (el('dc-pk-fb')  || {}).value || ''
    };
    fix();      /* ★会社を変えた拍子に、その会社に無い役職・機材が残らないように */
    if (!S.client) return;
    /* ★2社そろって別会社のときだけ引く。片方だけ・同じ会社では答えが要らない。 */
    if (pairReady()) { pair(); return; }
    S.seq++;                     // 走っている対の答えを捨てる
    S.side = { a: null, b: null };
    render();
  }

  function picker() {
    var box = el('dc-pick');
    if (!box) return;
    /* 辞書は RPC より後に届くことがある。中身が変わった回だけ組み直す
       （毎回組み直すと、通貨を切り替えただけで選択が飛ぶ）。
       ★選べる組み合わせ（pkv）も合図に入れる。語彙 JSON と RPC は届く順が
         決まっていないので、後から来た側で組み直せないと欄が空のまま残る。
       ★役職・機材の一覧は選んでいる会社で変わるので、sel の5つも合図に要る。 */
    var sig = L + '|' + S.airs.length + '|' + S.poss.length + '|' + S.flts.length +
      '|' + S.pkv +
      '|' + S.sel.a + '|' + S.sel.b + '|' + S.sel.pos +
      '|' + S.sel.fltA + '|' + S.sel.fltB;
    if (box.getAttribute('data-sig') !== sig) {
      box.setAttribute('data-sig', sig);
      /* ★「2社を選ぶ」の見出しは置かない（2026-08-31）。欄ごとのラベル
         （会社A / 機材（会社A）/ 役職 …）で足りるうえ、見出しだけで1段ぶん
         （約46px）使う。この画面は1画面に収めるのが約束なので、段を増やさない。
         ★並びは 会社A → 機材A → 役職 → 会社B → 機材B。CSS は3列の自動配置に
           任せてあるので、**この順番を変えると画面の配置が変わる**。 */
      /* ★比べられる会社が1社以下なら**欄そのものを作らない**（2026-09-01）。
         器を hidden にするだけだと、中身は DOM に残る＝ [hidden] が
         display:grid に負けた瞬間に「空の欄が5つ」出る（この画面で実際にあった
         壊れ方。下の box.hidden のコメントと対）。理由は #dc-sides 側が1行で出す。 */
      box.innerHTML = fewAir() ? '' :
        field('dc-pk-a', T.pickA, airOpts(S.sel.a)) +
        field('dc-pk-fa', T.pickFltA, optlist(fltList('a'), S.sel.fltA)) +
        field('dc-pk-pos', T.pickPos, optlist(posList(), S.sel.pos)) +
        field('dc-pk-b', T.pickB, airOpts(S.sel.b)) +
        field('dc-pk-fb', T.pickFltB, optlist(fltList('b'), S.sel.fltB)) +
        (anyPick()
          ? '<button type="button" class="dp-pick-r" id="dc-pk-rst">' + esc(T.pickReset) + '</button>'
          : '') +
        '<p class="dp-pick-n">' + esc(T.pickNote) + '</p>';
      ['dc-pk-a', 'dc-pk-fa', 'dc-pk-pos', 'dc-pk-b', 'dc-pk-fb'].forEach(function (id) {
        var e = el(id); if (e) e.addEventListener('change', onPick);
      });
      var r = el('dc-pk-rst');
      if (r) r.addEventListener('click', function () {
        S.sel = { a: '', b: '', pos: '', fltA: '', fltB: '' };
        S.seq++;
        S.side = { a: null, b: null };
        render();   /* ★引き直さない。選んでいない画面は何も出さないので答えが要らない */
      });
    }
    /* 引いている間は触らせない（連打で答えが入れ替わるのを止める）。 */
    ['dc-pk-a', 'dc-pk-fa', 'dc-pk-pos', 'dc-pk-b', 'dc-pk-fb', 'dc-pk-rst']
      .forEach(function (id) {
        var e = el(id); if (e) e.disabled = !!S.busy || !S.client;
      });
    /* 鍵が掛かっている画面・読み込めなかった画面では選ばせない
       （どの区分を選んでも答えは同じなので、押せる欄を出すのは嘘になる）。
       ★比べられる会社が1社以下のときも同じ理由で出さない（2026-09-01）。 */
    box.hidden = !(S.mode === 'open' || S.mode === 'load') || fewAir();
  }

  // ── 見出しと条件バー ───────────────────────────────────────────
  function hdr() {
    var box = el('dc-hd');
    if (!box) return;
    box.innerHTML = '<h1 class="mr-hd-t">' + esc(T.hd) + '</h1>' +
      '<p class="mr-hd-s">' + esc(T.hdS) + '</p>';
  }
  function nOf(x) { return sideThin(x) ? null : num(x.cohort && x.cohort.n); }
  function cond() {
    var box = el('dc-cond');
    if (!box) return;
    if (S.mode !== 'open' || !pairReady() || (!S.side.a && !S.side.b)) {
      box.innerHTML = '';
      return;
    }
    var na = nOf(S.side.a), nb = nOf(S.side.b);
    var parts = [];
    if (S.sel.pos) parts.push(posName(S.sel.pos));
    /* ★機材はここに書かない（2026-09-01）。左右で別の機材を選べるようになった
       ので、1つにまとめると片方が嘘になる。**会社の見出しの側**に添える
       （sideCard の dc-side-f と diff の th）。 */
    parts.push((na == null ? '—' : na + T.people) + ' ' + T.vs + ' ' +
               (nb == null ? '—' : nb + T.people));
    parts.push(T.months);
    /* ★deep-pay.js:497 と同じ形。ラベルもピルも dp-cond-l の**中**に入れる。
       外に出すと dp-cond-l の flex:1 1 auto が伸びて、
       「表示中:」だけ左端・中身が右端という離れた並びになる（実測で 363..847 と 859..1321）。
       信頼度の札はこの画面には付けない ── n が左右で2つあり、1つに丸めると片方が嘘になる。 */
    box.innerHTML = '<div class="dp-cond"><span class="dp-cond-l">' +
      '<span class="dp-cond-k">' + esc(T.now) + '</span>' +
      parts.map(function (p, i) {
        return (i ? '<span class="dp-cond-s">/</span>' : '') + '<span>' + esc(p) + '</span>';
      }).join('') + '</span></div>';
  }

  // ── ① 2社のカード ─────────────────────────────────────────────
  /* ★機材は会社ごとに別なので、社名のすぐ横に添える（2026-09-01）。
       選んでいないときは何も出さない（「機材を問わない」と書くと1行増える）。 */
  function fltTag(key) {
    var f = S.sel[key === 'a' ? 'fltA' : 'fltB'];
    return f ? '<span class="dc-side-f">' + esc(fltName(f)) + '</span>' : '';
  }
  function sideCard(key) {
    var code = S.sel[key], x = S.side[key];
    var n = nOf(x);
    var h = '<div class="dc-side-h">' + logoHtml(code) +
      '<span class="dc-side-n">' + esc(airName(code)) + '</span>' + fltTag(key) +
      '<span class="dc-side-c">' + esc(n == null ? '—' : (n + T.people)) + '</span></div>';
    /* ★薄い側だけを差し替える。もう片側は普通に出る（オーナー確定）。 */
    if (sideThin(x)) {
      return '<section class="mr-card dc-side">' + h + empty(T.thinT) +
        '<p class="dp-cta-n">' + esc(T.thinS) + '</p></section>';
    }
    var rows = HEAD.map(function (k) {
      var m = MET[k], v = m.get(x);
      if (v == null) return '';
      var s = m.f(v);
      if (s == null) return '';
      return '<div class="dc-kv"><span class="dc-kv-k">' + esc(m.lab) + '</span>' +
        '<b class="dc-kv-v">' + esc(s) + '</b></div>';
    }).filter(Boolean).join('');
    /* ★数字の無い行は落とす（0 を置かない）。全部落ちたらカードは薄い扱いに寄せる。 */
    return '<section class="mr-card dc-side">' + h +
      (rows || empty(T.thinT)) + '</section>';
  }
  function cards() {
    var box = el('dc-sides');
    if (!box) return;
    /* ★両側とも読めるときはカードを出さない（2026-08-31・オーナー確定）。
       年収・Pay per BH・固定・保証給比率・Block Hours は**すぐ下の表にも同じ数字が並ぶ**。
       2度出すのをやめて 153px 減らし、1画面に収めている。
       ロゴ・社名・人数は diff() の見出し行が受け持つ。
       ⚠️ この関数ごと消さないこと。**片側だけ薄いときは、読める側の数字がここに
          しか出ない**（rowsOf() が片側でも薄ければ [] を返し、表は丸ごと畳む）。
          「薄いのはその側だけ・もう片側は普通に出る」の約束はこの1枚が持っている。 */
    if (!sideThin(S.side.a) && !sideThin(S.side.b)) {
      box.innerHTML = ''; box.hidden = true; return;
    }
    box.innerHTML = '<div class="dc-sides">' + sideCard('a') + sideCard('b') + '</div>';
    box.hidden = false;
  }

  // ── ② 差がつくポイント ────────────────────────────────────────
  /* 1項目ぶんの左右。表もトレードオフもここだけを見る（2か所で別々に組むと、
     同じ項目で違う数が出る）。 */
  function pairOf(k, A, B) {
    var m = MET[k];
    /* ★金額で出せるのは**両側そろったときだけ**。片側だけ金額にすると
       「¥12万 vs 5%」という並びになり、比べようが無い。 */
    var aa = m.amt ? m.amt(A) : null, ab = m.amt ? m.amt(B) : null;
    var useA = aa != null && ab != null;
    var va = useA ? aa : m.get(A), vb = useA ? ab : m.get(B);
    if (va == null || vb == null) return null;   // ★片側でも無ければ行ごと落とす
    var f = useA ? m.fA : m.f;
    var sa = f(va), sb = f(vb);
    if (sa == null || sb == null) return null;
    /* ★「ほぼ同じ」は画面に出す文字列どうしで判定する。
       有効数字2桁で丸めた後に同じ表示になる値を「違う」と書くと、
       同じ数字が2つ並んでいるのに差が出ているように見える。 */
    return { m: m, lab: (useA && m.labA) ? m.labA : m.lab,
             va: va, vb: vb, sa: sa, sb: sb, same: sa === sb };
  }
  function rowsOf() {
    var A = S.side.a, B = S.side.b, out = [];
    if (sideThin(A) || sideThin(B)) return out;
    ORDER.forEach(function (k) {
      var r = pairOf(k, A, B);
      if (r) out.push(r);
    });
    return out;
  }
  /* ★差は「画面に出ている2つの文字列の引き算そのもの」にする。生の値では引かない。
     金額は有効数字2桁（db/deep-pay.sql の pv_sig2）、時間は小数1桁に丸めてから
     画面に出ている。丸める前の値で引くと、読み手が自分で引き算した答えと合わない数が出る。
     文字列どうしで引けば、**画面の3つの数字はいつでも辻褄が合う**し、
     2桁より細かい精度を主張しない。
     ★良い・悪い・どちらが勝ちは書かない。書くのは数値だけ（オーナー確定 2026-08-31）。 */
  var NUMRE = /[\d,]*\.?\d+/;
  function partsOf(str) {
    var t = String(str), m = NUMRE.exec(t);
    if (!m) return null;
    return { pre: t.slice(0, m.index), suf: t.slice(m.index + m[0].length),
             v: Number(m[0].replace(/,/g, '')),
             dec: (m[0].split('.')[1] || '').length,
             comma: m[0].indexOf(',') >= 0 };
  }
  function delta(r) {
    if (!r || r.same) return '';
    var A = partsOf(r.sa), B = partsOf(r.sb);
    /* 記号や単位が左右で違う形（起きないはずだが、起きたら黙って出さない）。 */
    if (!A || !B || A.pre !== B.pre || A.suf !== B.suf) return '';
    var d = Math.abs(A.v - B.v);
    if (!isFinite(d) || !(d > 0)) return '';
    var dec = Math.max(A.dec, B.dec);
    var body = dec ? d.toFixed(dec) : String(Math.round(d));
    if (A.comma || B.comma || d >= 1000) {
      var sp = body.split('.');
      body = Number(sp[0]).toLocaleString('en-US') + (sp[1] ? '.' + sp[1] : '');
    }
    /* ★割合の差の単位は「pt」。71% と 64% の差は 7 ポイントで 7% ではない
       （7% と書くと「64% の 7%」＝ 4.5 ポイントとも読める）。 */
    return '+' + A.pre + body + (A.suf === '%' ? 'pt' : A.suf);
  }
  function diff() {
    var box = el('dc-diff');
    if (!box) return;
    var rows = rowsOf();
    if (!rows.length) {
      box.innerHTML = sec(T.diffT, empty(T.diffNone), T.diffS);
      box.hidden = false;
      return;
    }
    /* ★見出しの2列が会社カードの代わりを務める（2026-08-31）。
       ロゴ・社名・人数をここに入れたので、両方読めるときはカード2枚を出さない。
       class は .dc-side-n / .dc-side-c のまま ── 場所が変わっただけで意味は同じ。 */
    /* ⚠️ 機材をここに入れ忘れない。両側とも読めるときカード2枚は出ない
       （cards() の注記）ので、**この見出しに無いと機材がどこにも出ない画面**になる。 */
    var th = function (cls, key) {
      var code = S.sel[key], n = nOf(S.side[key]);
      return '<span class="' + cls + '">' + logoHtml(code) +
        '<span class="dc-side-n">' + esc(airName(code)) + '</span>' + fltTag(key) +
        '<span class="dc-side-c">' + esc(n == null ? '—' : (n + T.people)) + '</span></span>';
    };
    var head = '<div class="dc-tr dc-th"><span class="dc-c1">' + esc(T.thItem) + '</span>' +
      th('dc-c2', 'a') + th('dc-c3', 'b') + '</div>';
    /* ★狭い画面では見出し行が畳まれるので、値の側にも会社名を持たせる
       （CSS だけでは「どちらの列がどちらの会社か」を出せない）。
       広い画面では .dc-c-a が display:none になり、見出し行が受け持つ。 */
    var na = esc(airName(S.sel.a)), nb = esc(airName(S.sel.b));
    /* ★差は**高いほうのセルにだけ**添える。どちらの会社かを語で言う代わりに、
       数字の置き場所そのもので示す（オーナー確定 ── 語は書かず数値だけ）。 */
    var body = rows.map(function (r) {
      var d = delta(r), hi = d && r.va > r.vb ? 'a' : (d ? 'b' : '');
      var dl = '<small class="dc-dl">' + esc(d) + '</small>';
      return '<div class="dc-tr"><span class="dc-c1">' + esc(r.lab) + '</span>' +
        '<span class="dc-c2"><small class="dc-c-a">' + na + '</small>' + esc(r.sa) +
          (hi === 'a' ? dl : '') + '</span>' +
        '<span class="dc-c3"><small class="dc-c-a">' + nb + '</small>' + esc(r.sb) +
          (hi === 'b' ? dl : '') + '</span></div>';
    }).join('');
    /* ★3人の壁・「時給ではない」・年収の中身の説明はここの2行だけ。板5枚（データの見方）は
       消したが、これらは約束と仕様なので、Pay / Block Hour の行が在る表に残す。 */
    box.innerHTML = sec(T.diffT, '<div class="dc-tbl">' + head + body + '</div>' +
      '<p class="dp-foot">' + esc(T.foot) + '</p>' +
      '<p class="dp-foot">' + esc(T.footA) + '</p>', T.diffS);
    box.hidden = false;
  }

  // ── ③ 給与構成の比較 ──────────────────────────────────────────
  function barOf(key) {
    var code = S.sel[key], x = S.side[key], segs = segsOf(x), parts = '', used = [];
    SEGK.forEach(function (k) {
      var p = segPct(segs, k);
      if (p == null || p <= 0) return;
      used.push(k);
      parts += '<i class="dc-seg" style="width:' + Math.min(100, p).toFixed(1) +
        '%;background:' + COL[k] + '"></i>';
    });
    var h = '<div class="dc-bar-h">' + logoHtml(code) +
      '<span class="dc-bar-n">' + esc(airName(code)) + '</span></div>';
    var body = parts
      ? '<div class="dc-bar">' + parts + '</div>'
      : '<div class="dc-bar dc-bar--none"><span class="dc-bar-e">' + esc(T.thinT) + '</span></div>';
    return { html: '<div class="dc-bar-row">' + h + body + '</div>', used: used };
  }
  function mix() {
    var box = el('dc-mix');
    if (!box) return;
    var a = barOf('a'), b = barOf('b');
    if (!a.used.length && !b.used.length) {
      box.innerHTML = sec(T.mixT, empty(T.mixNone), T.mixS);
      box.hidden = false;
      return;
    }
    var keys = SEGK.filter(function (k) {
      return a.used.indexOf(k) >= 0 || b.used.indexOf(k) >= 0;
    });
    var leg = '<div class="dc-leg">' + keys.map(function (k) {
      return '<span class="dc-leg-i"><i style="background:' + COL[k] + '"></i>' +
        esc(CN[k]) + '</span>';
    }).join('') + '</div>';
    box.innerHTML = sec(T.mixT,
      '<div class="dc-mix">' + a.html + b.html + '</div>' + leg + note(esc(T.mixNote)), T.mixS);
    box.hidden = false;
  }

  // ── ④ トレードオフ ────────────────────────────────────────────
  /* 対にするのはこの3つだけ。
     ★`固定・保証給比率 × 変動給比率` は同じ円の裏表なので入れない（必ず逆に振れる＝情報が無い）。
     ★`年収 × Pay / Block Hour` も入れない（後者は前者を Block Hours で割ったもので、
       「年収が高くて Pay/BH も高い」はほとんどの場合ただの言い換えになる）。 */
  var TRADE = [
    { x: 'annual', y: 'block', t: T.tr1 },
    { x: 'annual', y: 'stay',  t: T.tr2 },
    { x: 'pbh',    y: 'block', t: T.tr3 }
  ];
  function leadOf(map, k) {
    var r = map[k];
    if (!r || r.same) return '';
    return r.va > r.vb ? 'a' : 'b';
  }
  function trade() {
    var box = el('dc-trade');
    if (!box) return;
    /* rowsOf() は表の見た目のための配列なので、ここでは鍵で引ける形に組み直す。
       ★組み立ては pairOf() 1か所きり。表と別々に計算すると、同じ項目なのに
       表とここで違う数が出る（金額と率が入れ替わる行があるので特に）。 */
    var map = {};
    var A = S.side.a, B = S.side.b;
    if (!sideThin(A) && !sideThin(B)) {
      ORDER.forEach(function (k) {
        var r = pairOf(k, A, B);
        if (r) map[k] = r;
      });
    }
    var ic = IC.scale.replace('24" height="24', '15" height="15');
    var lines = TRADE.map(function (p) {
      var lx = leadOf(map, p.x), ly = leadOf(map, p.y);
      /* ★同じ側が両方で上回ったときだけ出す。片方ずつなら「トレードオフ」ではない。 */
      if (!lx || lx !== ly) return '';
      var dx = delta(map[p.x]), dy = delta(map[p.y]);
      /* 差を数値で出せない形（単位が左右で違う等）なら、その1行は黙って出さない。
         語だけ残すと「高い一方」という勝ち負けの文になってしまう。 */
      if (!dx || !dy) return '';
      var nm = airName(lx === 'a' ? S.sel.a : S.sel.b);
      /* ★replace の「新しい側」に文字列を渡さない（$ が特殊記号として解釈される）。 */
      var tx = esc(p.t).split('{n}').join(esc(nm))
                       .split('{x}').join(esc(dx))
                       .split('{y}').join(esc(dy));
      return '<div class="dc-to-li">' + ic + '<span>' + tx + '</span></div>';
    }).filter(Boolean).slice(0, 2).join('');
    box.innerHTML = sec(T.tradeT,
      (lines ? '<div class="dc-to">' + lines + '</div>' : '') +
      '<p class="dc-to-end">' + esc(T.trEnd) + '</p>', T.tradeS);
    box.hidden = false;
  }

  // ── ⑥ 下の入口 ────────────────────────────────────────────────
  /* ★「準備中」のボタンは置かない（2026-08-31・オーナー確定）。
     押せないボタンは、その場で読み手の時間を1回奪って何も返さない。
     役割別ができたら、そのときリンクを1本足す。 */
  function cta() {
    var box = el('dc-cta');
    if (!box) return;
    box.innerHTML = '<section class="mr-card"><div class="dp-more">' +
      '<div class="dp-more-l"><span class="dp-more-ic">' + IC.eye + '</span>' +
      '<span class="dp-more-tx"><span class="dp-more-t">' + esc(T.ctaT) + '</span>' +
      '<span class="dp-more-s">' + esc(T.ctaS) + '</span></span></div>' +
      '<div class="dp-more-r">' +
        '<button type="button" class="dp-more-b dp-more-b--on" id="dc-again">' +
          IC.layer.replace('24" height="24', '15" height="15') + esc(T.cta1) +
          IC.chev.replace('24" height="24', '15" height="15') + '</button>' +
        '<a class="dp-more-b dp-more-b--on" href="deep-pay.html">' +
          IC.back.replace('24" height="24', '15" height="15') + esc(T.cta3) + '</a>' +
      '</div></div></section>';
    var g = el('dc-again');
    if (g) g.addEventListener('click', function () {
      var e = el('dc-pk-a');
      if (e) { e.focus(); }
    });
    box.hidden = false;
  }

  // ── まだ出せないとき ──────────────────────────────────────────
  var LOW = ['dc-diff', 'dc-mix', 'dc-trade', 'dc-cta'];
  function clearLow() {
    LOW.forEach(function (id) {
      var b = el(id); if (b) { b.innerHTML = ''; b.hidden = true; }
    });
  }
  function only(html) {
    clearLow();
    var box = el('dc-sides');
    if (!box) return;
    box.innerHTML = html;
    box.hidden = false;
  }
  function skel() { only('<div class="mr-skel" style="height:150px"></div>'); }
  function shut(kind) {
    if (kind === 'error') { only('<div class="dp-msg">' + empty(T.err) + '</div>'); return; }
    var g = (S.boot && S.boot.gate) || {};
    var lines = [];
    if (!g.key) lines.push(T.lockKey);
    if (!g.detailed) lines.push(T.lockDet);
    if (!lines.length) lines.push(T.lockDet);
    only('<div class="dp-msg dp-msg--lock">' +
      '<div class="dp-msg-t">' + IC.lock.replace('24" height="24', '18" height="18') +
        esc(T.lockT) + '</div>' +
      '<p class="dp-msg-s">' + lines.map(esc).join('<br>') + '</p>' +
      '<a class="dp-cta" href="pay-report.html">' + esc(T.lockCta) + '</a>' +
      '<p class="dp-cta-n">' + esc(T.lockN) + '</p></div>');
  }
  function ask() {
    only('<div class="dp-msg dp-msg--ask">' +
      '<div class="dp-msg-t">' + IC.info.replace('24" height="24', '18" height="18') +
        esc(T.askT) + '</div>' +
      '<p class="dp-msg-s">' + esc(T.askS) + '</p></div>');
  }
  function dup() {
    only('<div class="dp-msg dp-msg--ask">' +
      '<div class="dp-msg-t">' + IC.info.replace('24" height="24', '18" height="18') +
        esc(T.dupT) + '</div>' +
      '<p class="dp-msg-s">' + esc(T.dupS) + '</p></div>');
  }
  /* 比べられる会社が1社以下。選択欄は picker が隠しているので、
     ここは理由と、増やすための入口だけを出す。
     ★人数を1文字も書かない（「あと◯人」も書かない）。招待の画面と同じ約束。 */
  function few() {
    only('<div class="dp-msg dp-msg--ask">' +
      '<div class="dp-msg-t">' + IC.info.replace('24" height="24', '18" height="18') +
        esc(T.fewT) + '</div>' +
      '<p class="dp-msg-s">' + esc(T.fewS) + '</p>' +
      '<a class="dp-cta" href="pay-report.html">' + esc(T.lockCta) + '</a>' +
      '<p class="dp-cta-n">' + esc(T.lockN) + '</p></div>');
  }

  // ── 描く ───────────────────────────────────────────────────────
  function render() {
    picker(); hdr(); cond();
    if (S.mode === 'error') { shut('error'); return; }
    if (S.mode === 'load')  { skel();        return; }
    if (S.mode !== 'open')  { shut('lock');  return; }
    /* ★この順番が効いている。錠前より前に置くと鍵の画面が出ず、
       「同じ会社」を後ろに置くと、同じ会社を2つ選んだ人に空の表が出る。
       ★「比べられる会社が2社に満たない」は ask より前。後ろに置くと
         「比べる2社を選んでください」と言いながら選択欄が無い画面になる。 */
    if (fewAir())              { few(); return; }
    if (!S.sel.a || !S.sel.b)  { ask(); return; }
    if (S.sel.a === S.sel.b)   { dup(); return; }
    if (!S.side.a || !S.side.b) { skel(); return; }
    cards(); diff(); mix(); trade(); cta();
  }

  // ── 読み込み ───────────────────────────────────────────────────
  /* 会社を入れて1社ぶん引く。★役職は左右共通・**機材は左右別**（2026-09-01）。 */
  function one(client, code, flt) {
    return Promise.resolve(client.rpc('pv_deep_pay', {
      p: { airline: code, position: S.sel.pos || null, fleet: flt || null }
    })).then(function (res) {
      if (!res || res.error) return null;
      return res.data || null;
    });
  }
  function pair() {
    var client = S.client;
    if (!client || !pairReady()) return;
    var seq = ++S.seq;
    S.busy = true;
    S.side = { a: null, b: null };
    render();
    Promise.all([one(client, S.sel.a, S.sel.fltA),
                 one(client, S.sel.b, S.sel.fltB)]).then(function (r) {
      if (seq !== S.seq) return;      /* ★古い対の答えは捨てる（選び直しの追い越し） */
      S.busy = false;
      if (!r[0] || !r[1]) { S.mode = 'error'; render(); return; }
      S.side = { a: r[0], b: r[1] };
      render();
    }).catch(function () {
      if (seq !== S.seq) return;
      S.busy = false; S.mode = 'error'; render();
    });
  }

  function load(client) {
    S.client = client;
    S.busy = true;
    picker();
    /* ★入口の1回は**引数なし**。取りに行くのは state・gate・give・stats **だけ**で、
       cohort / head / comp は捨てる（2社そろうまで数字は1つも出さない）。
       鍵の掛かった人に、押しても答えの変わらないピッカーを出さないためにこの1回が要る。 */
    Promise.resolve(client.rpc('pv_deep_pay')).then(function (res) {
      S.busy = false;
      if (res && res.error) { S.mode = 'error'; render(); return; }
      var v = res && res.data;
      S.boot = v || null;
      S.mode = (v && v.state === 'open') ? 'open' : (v ? 'locked' : 'error');
      /* ★選べる組み合わせ。**無いときは null のまま**＝選ばせない（few）。
           db/deep-pay.sql を貼る前の本番はこの形で返ってくる。 */
      setPicks(v && v.picks);
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

  // ── 起動 ───────────────────────────────────────────────────────
  function boot() {
    var client = null;
    try { client = sb0(); } catch (e) { client = null; }
    if (!client || !client.rpc) { S.mode = 'error'; render(); return; }

    var ready = w.PV_SESSION && typeof w.PV_SESSION.then === 'function'
      ? w.PV_SESSION : { then: function (f) { f(null); return { catch: function () {} }; } };
    ready.then(function (session) {
      if (!session) return;                     // ページ側がログインへ送っている
      var swept = null;
      try { if (w.PVClaimPending) swept = w.PVClaimPending.sweep(client); } catch (e) { swept = null; }
      Promise.resolve(swept).catch(function () { return null; }).then(function () { load(client); });
    });

    /* ★通貨の切替は描き直すだけ。pv_deep_pay() を引き直さない。 */
    w.addEventListener('pv-currency-change', function () { render(); });

    /* 語彙（職位・機材）と社名の辞書。★後から届いても描き直す。 */
    fetch(VOCAB_URL).then(function (r) { return r.json(); }).then(function (v) {
      (v.positions || []).forEach(function (p) {
        S.pos[p.code] = p[L] || p.ja;
        S.poss.push({ v: p.code, t: p[L] || p.ja });
      });
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

  /* ★試験用の入口（assert-deep-pay-compare.mjs が使う）。本番の画面はここを呼ばない。
     **作り物のデータを既定で描かせない**ため、呼ばれたときだけ S を差し替えて描き直す。 */
  w.PVDeepPayCompare = {
    render: function (a, b, sel) {
      if (sel) S.sel = { a: sel.a || '', b: sel.b || '', pos: sel.pos || '',
                         fltA: sel.fltA || '', fltB: sel.fltB || '' };
      S.side = { a: a || null, b: b || null };
      S.mode = 'open';
      render();
    }
  };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
