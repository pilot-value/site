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
   3. **変動給比率を「100 − 固定給比率」で出さない。** db/deep-pay.sql の fixed_pct は
      固定＋職位＋役割＋住宅で、残りにはパーディアム・その他・未分類も入っている。
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
      pickA: '会社A', pickB: '会社B', pickPos: '役職', pickFlt: '機材',
      pickAny: '選択する', pickReset: '選択をクリア',
      allPos: '役職を問わない', allFlt: '機材を問わない',
      rg: { japan: '日本', mideast: '中東', asia: 'アジア', europe: '欧州',
            us: '北米', latam: '中南米', oceania: 'オセアニア', africa: 'アフリカ' },
      askT: '比べる2社を選んでください',
      askS: '会社Aと会社Bを選ぶと、同じ役職・機材の条件で横に並びます。',
      dupT: '別の会社を選んでください',
      dupS: '会社Aと会社Bに同じ会社が入っています。',
      thinT: 'まだ出せません',
      thinS: '3人そろった区分から順に出ます。',
      mAnnual: '年収（中央値）', mPbh: 'Pay / Block Hour', mFixed: '固定給比率',
      mVar: '変動給比率', mPer: 'パーディアム比率', mHou: '住宅手当比率',
      mBonus: '賞与・利益分配', mBlock: 'Block Hours / 月', mStay: 'ステイ / 月',
      nightU: '泊',
      diffT: '差がつくポイント', diffS: '両方に数字がある項目だけ',
      diffNone: 'この条件では、並べられる項目がまだありません。',
      thItem: '項目', thSaw: '見えた違い',
      same: 'ほぼ同じ', sideOf: 'の方が',
      wHi: '高い', wLong: '長い', wMany: '多い',
      mixT: '給与構成の比較', mixS: '月々の現金・賞与ぬき',
      mixNone: 'この2社では、給与構成をまだ並べられません。',
      mixNote: '※ 3人に満たない項目は棒に入れていません。棒の合計が100%にならないことがあります。',
      tradeT: 'トレードオフ', tradeS: '同じ側が2つとも上回ったときだけ',
      tr1: '{n}は年収の中央値が高く、Block Hours も長い。',
      tr2: '{n}は年収の中央値が高く、ステイの泊数も多い。',
      tr3: '{n}は Pay / Block Hour が高く、Block Hours も長い。',
      trEnd: 'どちらが良いかではなく、何を重視するかで見方が変わります。',
      /* ★「データの見方」の板5枚はオーナー判断で削除（2026-08-31・じゃま）。
         残したのはこの1行だけ ── 3人の壁は約束、時給と呼ばないのは仕様。
         カードにせず、表の下に淡い1行で置く（賞与の扱いは mixS が言っている）。 */
      foot: '※ 3人以上そろった区分だけを出しています。Pay / Block Hour は金額 ÷ Block Hours で、時給ではありません。',
      ctaT: 'もっと深く見る', ctaS: '別の切り口でも読めます。',
      cta1: '別の会社と比べる', cta2: '役割別の差を見る', cta3: 'DEEP PAY に戻る',
      soon: '準備中',
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
      pickA: 'Airline A', pickB: 'Airline B', pickPos: 'Seat', pickFlt: 'Fleet',
      pickAny: 'Select', pickReset: 'Clear',
      allPos: 'Any seat', allFlt: 'Any fleet',
      rg: { japan: 'Japan', mideast: 'Middle East', asia: 'Asia', europe: 'Europe',
            us: 'North America', latam: 'Latin America', oceania: 'Oceania', africa: 'Africa' },
      askT: 'Choose two airlines to compare',
      askS: 'Pick airline A and airline B and they appear side by side, on the same seat and fleet.',
      dupT: 'Choose a different airline',
      dupS: 'Airline A and airline B are the same.',
      thinT: 'Not available yet',
      thinS: 'Groups appear once 3 pilots have reported.',
      mAnnual: 'Annual pay (median)', mPbh: 'Pay / Block Hour', mFixed: 'Fixed pay share',
      mVar: 'Variable pay share', mPer: 'Per diem share', mHou: 'Housing share',
      mBonus: 'Bonus / profit share', mBlock: 'Block hours / month', mStay: 'Layovers / month',
      nightU: ' nights',
      diffT: 'Where they differ', diffS: 'Only rows both sides report',
      diffNone: 'Nothing can be lined up for this group yet.',
      thItem: 'Item', thSaw: 'What shows',
      same: 'About the same', sideOf: ' ',
      wHi: 'is higher', wLong: 'is longer', wMany: 'has more',
      mixT: 'Pay mix, side by side', mixS: 'Monthly cash, bonus excluded',
      mixNone: 'The pay mix cannot be lined up for these two yet.',
      mixNote: 'Items reported by fewer than 3 pilots are left out of the bar, so a bar may not reach 100%.',
      tradeT: 'Trade-offs', tradeS: 'Only when the same side leads both',
      tr1: '{n} has higher median annual pay and longer block hours.',
      tr2: '{n} has higher median annual pay and more layover nights.',
      tr3: '{n} has a higher pay per block hour and longer block hours.',
      trEnd: 'It is not about which is better, but about what you value.',
      foot: 'Only groups of 3 or more pilots are shown. Pay / Block Hour is pay divided by block hours, not an hourly wage.',
      ctaT: 'Go deeper', ctaS: 'There are other ways to read this.',
      cta1: 'Compare other airlines', cta2: 'Compare roles', cta3: 'Back to DEEP PAY',
      soon: 'Soon',
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
    ja: { fixed: '固定・保証給', variable: '変動給', command: '職位手当',
          role: '役割手当', perdiem: 'パーディアム', housing: '住宅手当',
          other: 'その他の現金', rest: 'その他・未分類' },
    en: { fixed: 'Fixed / guaranteed', variable: 'Variable (flying)', command: 'Rank pay',
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
     side は左右それぞれの答え。sel の役職・機材は左右で共通。 */
  var S = { mode: 'load', boot: null, air: {}, pos: {}, airs: [], poss: [], flts: [],
            sel: { a: '', b: '', pos: '', flt: '' },
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
  function pct(v) { return Math.round(v) + '%'; }
  function hrs(v) { return (Math.round(v * 10) / 10) + 'h'; }
  function nights(v) { return (Math.round(v * 10) / 10) + T.nightU; }

  /* 表に出す9項目。順はモックのまま。
     ★variable は segPct から取る。「100 − 固定給比率」では出さない
       （db/deep-pay.sql の fixed_pct は固定＋職位＋役割＋住宅で、
         残りにはパーディアム・その他・未分類も入っている）。 */
  var MET = {
    annual:   { lab: T.mAnnual, wd: T.wHi,   f: money,
                get: function (x) { return num(x.head && x.head.annual_usd); } },
    pbh:      { lab: T.mPbh,    wd: T.wHi,   f: moneyExact,
                get: function (x) { return num(x.head && x.head.per_block_usd); } },
    fixed:    { lab: T.mFixed,  wd: T.wHi,   f: pct,
                get: function (x) { return num(x.head && x.head.fixed_pct); } },
    variable: { lab: T.mVar,    wd: T.wHi,   f: pct,
                get: function (x) { return segPct(segsOf(x), 'variable'); } },
    perdiem:  { lab: T.mPer,    wd: T.wHi,   f: pct,
                get: function (x) { return segPct(segsOf(x), 'perdiem'); } },
    housing:  { lab: T.mHou,    wd: T.wHi,   f: pct,
                get: function (x) { return segPct(segsOf(x), 'housing'); } },
    bonus:    { lab: T.mBonus,  wd: T.wHi,   f: pct,
                get: function (x) { return num(x.comp && x.comp.bonus && x.comp.bonus.pct_of_annual); } },
    block:    { lab: T.mBlock,  wd: T.wLong, f: hrs,
                get: function (x) { return num(x.work && x.work.block_h); } },
    stay:     { lab: T.mStay,   wd: T.wMany, f: nights,
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
  function airOpts(cur) {
    var by = {}, h = '<option value="">' + esc(T.pickAny) + '</option>';
    S.airs.forEach(function (a) { (by[a.rg] || (by[a.rg] = [])).push(a); });
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
  function anyPick() { return !!(S.sel.a || S.sel.b || S.sel.pos || S.sel.flt); }
  function pairReady() { return !!(S.sel.a && S.sel.b) && S.sel.a !== S.sel.b; }

  function onPick() {
    S.sel = {
      a:   (el('dc-pk-a')   || {}).value || '',
      b:   (el('dc-pk-b')   || {}).value || '',
      pos: (el('dc-pk-pos') || {}).value || '',
      flt: (el('dc-pk-flt') || {}).value || ''
    };
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
       （毎回組み直すと、通貨を切り替えただけで選択が飛ぶ）。 */
    var sig = L + '|' + S.airs.length + '|' + S.poss.length + '|' + S.flts.length +
      '|' + S.sel.a + '|' + S.sel.b + '|' + S.sel.pos + '|' + S.sel.flt;
    if (box.getAttribute('data-sig') !== sig) {
      box.setAttribute('data-sig', sig);
      /* ★「2社を選ぶ」の見出しは置かない（2026-08-31）。欄ごとのラベル
         （会社A / 会社B / 役職 / 機材）で足りるうえ、見出しだけで1段ぶん
         （約46px）使う。この画面は1画面に収めるのが約束なので、段を増やさない。 */
      box.innerHTML =
        field('dc-pk-a', T.pickA, airOpts(S.sel.a)) +
        field('dc-pk-b', T.pickB, airOpts(S.sel.b)) +
        field('dc-pk-pos', T.pickPos, optlist(S.poss, S.sel.pos)) +
        field('dc-pk-flt', T.pickFlt, optlist(S.flts, S.sel.flt)) +
        (anyPick()
          ? '<button type="button" class="dp-pick-r" id="dc-pk-rst">' + esc(T.pickReset) + '</button>'
          : '');
      ['dc-pk-a', 'dc-pk-b', 'dc-pk-pos', 'dc-pk-flt'].forEach(function (id) {
        var e = el(id); if (e) e.addEventListener('change', onPick);
      });
      var r = el('dc-pk-rst');
      if (r) r.addEventListener('click', function () {
        S.sel = { a: '', b: '', pos: '', flt: '' };
        S.seq++;
        S.side = { a: null, b: null };
        render();   /* ★引き直さない。選んでいない画面は何も出さないので答えが要らない */
      });
    }
    /* 引いている間は触らせない（連打で答えが入れ替わるのを止める）。 */
    ['dc-pk-a', 'dc-pk-b', 'dc-pk-pos', 'dc-pk-flt', 'dc-pk-rst'].forEach(function (id) {
      var e = el(id); if (e) e.disabled = !!S.busy || !S.client;
    });
    /* 鍵が掛かっている画面・読み込めなかった画面では選ばせない
       （どの区分を選んでも答えは同じなので、押せる欄を出すのは嘘になる）。 */
    box.hidden = !(S.mode === 'open' || S.mode === 'load');
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
    if (S.sel.flt) parts.push(fltName(S.sel.flt));
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
  function sideCard(key) {
    var code = S.sel[key], x = S.side[key];
    var n = nOf(x);
    var h = '<div class="dc-side-h">' + logoHtml(code) +
      '<span class="dc-side-n">' + esc(airName(code)) + '</span>' +
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
       年収・Pay per BH・固定給比率・Block Hours は**すぐ下の表にも同じ数字が並ぶ**。
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
  function rowsOf() {
    var A = S.side.a, B = S.side.b, out = [];
    if (sideThin(A) || sideThin(B)) return out;
    ORDER.forEach(function (k) {
      var m = MET[k], va = m.get(A), vb = m.get(B);
      if (va == null || vb == null) return;      // ★片側でも無ければ行ごと落とす
      var sa = m.f(va), sb = m.f(vb);
      if (sa == null || sb == null) return;
      /* ★「ほぼ同じ」は画面に出す文字列どうしで判定する。
         有効数字2桁で丸めた後に同じ表示になる値を「違う」と書くと、
         同じ数字が2つ並んでいるのに「◯◯の方が高い」と出る。 */
      out.push({ m: m, va: va, vb: vb, sa: sa, sb: sb, same: sa === sb });
    });
    return out;
  }
  /* ★差の数値は書かない（有効数字2桁に対して「+18%」は嘘の精度）。
     良い・悪いも書かない。書くのは「どちらが高い／長い／多いか」だけ。 */
  function saw(r) {
    if (r.same) return T.same;
    return airName(r.va > r.vb ? S.sel.a : S.sel.b) + T.sideOf + r.m.wd;
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
    var th = function (cls, key) {
      var code = S.sel[key], n = nOf(S.side[key]);
      return '<span class="' + cls + '">' + logoHtml(code) +
        '<span class="dc-side-n">' + esc(airName(code)) + '</span>' +
        '<span class="dc-side-c">' + esc(n == null ? '—' : (n + T.people)) + '</span></span>';
    };
    var head = '<div class="dc-tr dc-th"><span class="dc-c1">' + esc(T.thItem) + '</span>' +
      th('dc-c2', 'a') + th('dc-c3', 'b') +
      '<span class="dc-c4">' + esc(T.thSaw) + '</span></div>';
    /* ★狭い画面では見出し行が畳まれるので、値の側にも会社名を持たせる
       （CSS だけでは「どちらの列がどちらの会社か」を出せない）。
       広い画面では .dc-c-a が display:none になり、見出し行が受け持つ。 */
    var na = esc(airName(S.sel.a)), nb = esc(airName(S.sel.b));
    var body = rows.map(function (r) {
      return '<div class="dc-tr"><span class="dc-c1">' + esc(r.m.lab) + '</span>' +
        '<span class="dc-c2"><small class="dc-c-a">' + na + '</small>' + esc(r.sa) + '</span>' +
        '<span class="dc-c3"><small class="dc-c-a">' + nb + '</small>' + esc(r.sb) + '</span>' +
        '<span class="dc-c4">' + esc(saw(r)) + '</span></div>';
    }).join('');
    /* ★3人の壁と「時給ではない」の説明はここ1行だけ。板5枚（データの見方）は
       消したが、この2つは約束と仕様なので、Pay / Block Hour の行が在る表に残す。 */
    box.innerHTML = sec(T.diffT, '<div class="dc-tbl">' + head + body + '</div>' +
      '<p class="dp-foot">' + esc(T.foot) + '</p>', T.diffS);
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
     ★`固定給比率 × 変動給比率` は同じ円の裏表なので入れない（必ず逆に振れる＝情報が無い）。
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
       ★同じ f() を通しているので「ほぼ同じ」の判定は表と必ず一致する。 */
    var map = {};
    var A = S.side.a, B = S.side.b;
    if (!sideThin(A) && !sideThin(B)) {
      ORDER.forEach(function (k) {
        var m = MET[k], va = m.get(A), vb = m.get(B);
        if (va == null || vb == null) return;
        var sa = m.f(va), sb = m.f(vb);
        if (sa == null || sb == null) return;
        map[k] = { va: va, vb: vb, same: sa === sb };
      });
    }
    var ic = IC.scale.replace('24" height="24', '15" height="15');
    var lines = TRADE.map(function (p) {
      var lx = leadOf(map, p.x), ly = leadOf(map, p.y);
      /* ★同じ側が両方で上回ったときだけ出す。片方ずつなら「トレードオフ」ではない。 */
      if (!lx || lx !== ly) return '';
      var nm = airName(lx === 'a' ? S.sel.a : S.sel.b);
      /* ★replace の「新しい側」に文字列を渡さない（$ が特殊記号として解釈される）。 */
      return '<div class="dc-to-li">' + ic + '<span>' +
        esc(p.t).split('{n}').join(esc(nm)) + '</span></div>';
    }).filter(Boolean).slice(0, 2).join('');
    box.innerHTML = sec(T.tradeT,
      (lines ? '<div class="dc-to">' + lines + '</div>' : '') +
      '<p class="dc-to-end">' + esc(T.trEnd) + '</p>', T.tradeS);
    box.hidden = false;
  }

  // ── ⑥ 下の入口 ────────────────────────────────────────────────
  /* 役割別はまだ無い。無い先へリンクすると assert-links.mjs が404で落とすので
     disabled の <button> のままにして「準備中」と書く。 */
  function cta() {
    var box = el('dc-cta');
    if (!box) return;
    function bn(t, ic) {
      return '<button type="button" class="dp-more-b" disabled>' +
        ic.replace('24" height="24', '15" height="15') + esc(t) +
        '<span class="dp-more-c">' + esc(T.soon) + '</span>' +
        IC.chev.replace('24" height="24', '15" height="15') + '</button>';
    }
    box.innerHTML = '<section class="mr-card"><div class="dp-more">' +
      '<div class="dp-more-l"><span class="dp-more-ic">' + IC.eye + '</span>' +
      '<span class="dp-more-tx"><span class="dp-more-t">' + esc(T.ctaT) + '</span>' +
      '<span class="dp-more-s">' + esc(T.ctaS) + '</span></span></div>' +
      '<div class="dp-more-r">' +
        '<button type="button" class="dp-more-b dp-more-b--on" id="dc-again">' +
          IC.layer.replace('24" height="24', '15" height="15') + esc(T.cta1) +
          IC.chev.replace('24" height="24', '15" height="15') + '</button>' +
        bn(T.cta2, IC.users) +
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

  // ── 描く ───────────────────────────────────────────────────────
  function render() {
    picker(); hdr(); cond();
    if (S.mode === 'error') { shut('error'); return; }
    if (S.mode === 'load')  { skel();        return; }
    if (S.mode !== 'open')  { shut('lock');  return; }
    /* ★この順番が効いている。錠前より前に置くと鍵の画面が出ず、
       「同じ会社」を後ろに置くと、同じ会社を2つ選んだ人に空の表が出る。 */
    if (!S.sel.a || !S.sel.b)  { ask(); return; }
    if (S.sel.a === S.sel.b)   { dup(); return; }
    if (!S.side.a || !S.side.b) { skel(); return; }
    cards(); diff(); mix(); trade(); cta();
  }

  // ── 読み込み ───────────────────────────────────────────────────
  /* 会社を入れて1社ぶん引く。position / fleet は左右で共通。 */
  function one(client, code) {
    return Promise.resolve(client.rpc('pv_deep_pay', {
      p: { airline: code, position: S.sel.pos || null, fleet: S.sel.flt || null }
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
    Promise.all([one(client, S.sel.a), one(client, S.sel.b)]).then(function (r) {
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
      if (sel) S.sel = { a: sel.a || '', b: sel.b || '', pos: sel.pos || '', flt: sel.flt || '' };
      S.side = { a: a || null, b: b || null };
      S.mode = 'open';
      render();
    }
  };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
