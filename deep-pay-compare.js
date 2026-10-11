/* deep-pay-compare.js — DEEP PAY / 会社を比べる
   ─────────────────────────────────────────────────────────────────
   2社を横に並べる画面。**新しい SQL は無い。**
   db/deep-pay.sql の pv_deep_pay(jsonb) を、会社を入れ替えて2回呼ぶだけ。
   ＝ 人数の壁（v_min）・金額の丸め・準識別子の抑制が SQL の1か所に残ったまま再利用される。

   ⚠️ 守る約束（deep-pay.js と同じ。破ると匿名性か信用のどちらかが落ちる）
   1. **JS で人数を数えない・比べない。** 人数の壁は db/deep-pay.sql の1か所だけ
      （定数 v_min。2026-10-11 から2人）。薄い区分の合図は `cohort.level === 'none'` ただ1つ。
      ★2026-10-11 から、**人数は画面のどこにも出さない**（オーナー判断）── その区分に
        何人いるかも、壁が何人かも。サーバも区分の人数を返さなくなり、代わりに
        信頼度の段（cohort.trust）だけが来る。⚠️ 古いサーバが n を返しても読まない。
        例外は錠前の板の「…100人に達すること（いま N人）」の1行だけ（サイト全体の数）。
   2. **無い数字を 0 と書かない。** 片側でも欠けている行は、表から行ごと落とす。
      0% と書くと「その手当が無い会社」に見えるが、実際は「人数の壁に届かず出せない」だけ。
   3. **変動給比率を「100 − 固定・保証給比率」で出さない。** db/deep-pay.sql の fixed_pct は
      固定＋職位＋役割で、残りにはパーディアム・住宅・その他・未分類も入っている。
   4. **順位・パーセンタイル・勝ち負けを書かない。** 差を**割合**で書かない
      （中央値どうしで「+18%」は嘘の精度）。書くのは画面に出ている2つの数の
      引き算だけ（delta() の注）。▲▼も勝ち色も付けない。
   5. **「時給」と呼ばない。** Pay / Block Hour は Block Hours から出した指標。
   6. **個人の明細を出さない。** ここに出るのは中央値と割合だけ。

   ★金額の細かさ（2026-10-11・オーナー判断）── deep-pay.js と同じ。
     年収の中央値と Pay / Block Hour だけ、表示通貨の中で刻みに寄せる
     （円なら 1万円・100円／それ以外は 1,000・1。stepIn）。パーディアム・住宅手当の
     月額は今までどおり有効数字2桁（moneyExact）── 2桁に寄せるのも表示通貨の中
     （sigIn。円の表示は変わらない）。丸める道具は deep-pay.js から
     本体ごと写してある（ずれは assert が見張る）。

   ★見る資格（2026-10-11・オーナー判断）── deep-pay.js と同じ。自分に当てはまる
     項目をぜんぶ答えた人にだけ開く（門はサーバ。gate.ready）。閉じているときの板は
     deep-pay.js と**同じ本体**が組む ── まだ答えていない項目（gate.todo）を給与
     フォームと同じ名前で並べ、フォームへ送る。入力はこの画面に置かない。

   ★閉じているときの見た目（2026-10-11・オーナー判断）── 板の後ろに、この画面の
     **形だけ**の影絵をぼかして置く（lockStage / ghostShapes）。
     ⚠️ 影絵は字も数字も持たない固定の絵。本物の値を描いてからぼかす形にしない ──
        ぼかしは開発者ツールで外せる。開いた画面には影絵そのものが無い。

   ★ログインしていない人（2026-10-11・オーナー判断）── deep-pay.js と同じ。前はログイン
     画面へ送っていたが、いまは送らない。**会員で、まだ開いていない人と同じ画面**
     （影絵＋板）を出す。板は「鍵が無く、答えきってもいない」会員の門と同じ形の入れ物
     （anonGate）を同じ lockStage へ通すだけで、字も行き先も新しく書いていない。
     ⚠️ ログインしていない人のために**サーバへ1本も聞かない**（pv_deep_pay() は未ログイン
        だと必ず落ちる）。端末にも何も書かない（クラッカーの印・門の鍵のどちらも）。
     ★セッションは端末に残っているのに、サーバが「ログインしていない」と答えた回
       （authLost ＝ 42501 か HTTP 401。入口の1回でも、2社を引く回でも）も同じ板。
       ほかの失敗は今までどおり「読み込めませんでした」。

   ★モックから意図的に外したもの（後から足されないよう理由を残す）
   - 国の絞り込み ── pv_deep_pay に国の facet が無い。無い絞り込みを出すのは嘘になる。
   - 「直近12か月」 ── db/deep-pay.sql の窓は24か月。
   - ピルの「件」 ── 件数も人数も出さない（上の1）。ピルに出すのは信頼度の段。
   - 棒の中の「賞与」 ── 賞与は年額。月々の現金の100%に混ぜると分母が壊れる。
     表には行として残す。**モックの凡例のほうが誤り。**
*/
(function (w, d) {
  'use strict';

  var V = w.PVViz;
  if (!V) return;                       // pay-viz.js が先に要る（HTML の順序）
  var esc = V.esc, num = V.num, fmt = V.fmt;

  /* ★ページ相対で書くと /en/ から /en/pv-airlines.json を見に行って 404 になる
       （actual-pay.js:77 と同じ理由）。絶対パスは公開リポジトリなので書けない。 */
  // ★社名の辞書は pv-airlines.json（2026-09-13 に salary-data.json から移した）。
  //   あちらは年収の帯を持つ112社だけで、チャーター/ビジネスジェットの社が入っていない。
  var AIR_URL = 'pv-airlines.json', VOCAB_URL = 'pv-vocab.json';
  var LOGO_BASE = 'assets/airline-logos/';
  try {
    var _self = (d.currentScript && d.currentScript.src) || '';
    if (_self) {
      AIR_URL = new URL('pv-airlines.json', _self).href;
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
      now: '表示中:', months: '直近24か月',
      /* ★「◯人 vs ◯人」の語（人・vs）は 2026-10-11 に消した。人数を出す場所が
         無くなったので、単位の語ごと持たない。代わりは会社ごとの信頼度の札。
         文言は deep-pay.js の trust / hi / mid / lo と同じ。 */
      trust: '信頼度', hi: '高', mid: '中', lo: '低',
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
      fewS: 'データがそろった会社から順に出ます。',
      thinT: 'まだ出せません',
      thinS: 'データがそろった区分から順に出ます。',
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
      mixNote: '※ データが足りない項目は棒に入れていません。棒の合計が100%にならないことがあります。',
      tradeT: 'トレードオフ', tradeS: '同じ側が2つとも上回ったときだけ',
      tr1: '{n} ── 年収の中央値 {x}、Block Hours {y}。',
      tr2: '{n} ── 年収の中央値 {x}、ステイの泊数 {y}。',
      tr3: '{n} ── Pay / Block Hour {x}、Block Hours {y}。',
      trEnd: 'どちらが良いかではなく、何を重視するかで見方が変わります。',
      /* ★「データの見方」の板5枚はオーナー判断で削除（2026-08-31・じゃま）。
         残したのはこの1行だけ ── 人数の壁は約束、時給と呼ばないのは仕様。
         カードにせず、表の下に淡い1行で置く（賞与の扱いは mixS が言っている）。
         ★2026-10-11、壁が何人かを書くのをやめた（オーナー判断）。壁が在ること
           だけを言う。「1人ずつ」は人数ではなく計算の仕方なので残す。 */
      foot: '※ データが十分にそろった区分だけを出しています。Pay / Block Hour は、1人ずつ「年収 ÷ 12 ÷ Block Hours」を出した中央値です。時給ではありません。',
      /* ★年収が何を含むかは、これまで画面のどこにも書いていなかった（2026-09-01 に追加）。
         中身は db/pay-reports.sql の pv_annual_total と対。deep-pay.js の footA と同じ文。 */
      footA: '※ 年収＝住宅手当・パーディアム・交通費・賞与・利益分配を含む現金の年換算。現物の社宅は含みません。',
      ctaT: 'もっと深く見る', ctaS: '別の切り口でも読めます。',
      cta1: '別の会社と比べる', cta3: 'DEEP PAY に戻る',
      /* ★2026-10-11 オーナー指示で題を替えた（「まだ開いていません」ではなく、何をすれば開くか）。
           lockTWait は、本人の条件はそろっていて人数の条件だけで止まっているときの題。
           そこで「提出で開きます」と言うと嘘になるので、前の題を残してある。 */
      lockT: '給与詳細提出で開きます',
      lockTWait: 'DEEP PAY はまだ開いていません',
      lockKey: '給与を1件出すと、90日ぶん開きます。',
      /* ★本人の側の門（2026-10-11・オーナー判断）。「内訳を1件出すと開く」をやめて、
           自分に当てはまる項目を**ぜんぶ**答えた人にだけ開く（gate.ready）。
           前の lockDet はこの行に置き換えた。lockTodoH の {ym} は対象月、lockWarn は
           この行が出ているとき**だけ**ボタンの上に添える断り（lockHtml() が決める）。
         ⚠️ この3つは deep-pay.js と同じ字。片方だけ直さない（経緯はあちらの注）。 */
      lockReady: '給与の項目をすべて答えると開きます。',
      lockTodoH: 'まだ答えていない項目（{ym}）',
      lockWarn: '虚偽の情報や不正確な情報を提出した場合、利用規約に基づきアカウントを停止することがあります。',
      /* ★人数が足りなくて閉じているときの行（2026-10-11 にこの画面へ足した）。
         deep-pay.js の lockGoal と同じ文。前はこの画面だけ持っておらず、鍵も内訳も
         そろった人に「内訳を出すと開きます」と出ていた。出すかどうかは lockLines()。
         ★この画面で人数が出てよいのは**この1行だけ**（サイト全体の数）。 */
      lockGoal: '給与を出したパイロットが{goal}人に達すること（いま{n}人）。',
      lockCta: '匿名で給与を出す',
      /* ★2026-10-11 オーナー指定の文言（板のボタンだけ）。1文字も変えない・「匿名で」を足さない
           （トップの「Give & Get 全ての待遇データを解放する」と同じ扱い）。
         ★同じ日にオーナーが字を1つ直した ── 末尾の語を、トップと同じ「解放」に
           そろえた（前は別の字だった）。英語の字は変えていない。 */
      lockGo: 'Give & Get 詳細を入力して解放する',
      err: '読み込めませんでした。少し待ってから開き直してください。'
    },
    en: {
      hd: 'Compare airlines',
      hdS: 'Two airlines side by side, read on the same scale. No ranking.',
      now: 'Showing:', months: 'last 24 months',
      trust: 'Confidence', hi: 'High', mid: 'Medium', lo: 'Low',
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
      fewS: 'Airlines appear once enough pilots have reported.',
      thinT: 'Not available yet',
      thinS: 'Groups appear once enough pilots have reported.',
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
      mixNote: 'Items without enough data are left out of the bar, so a bar may not reach 100%.',
      tradeT: 'Trade-offs', tradeS: 'Only when the same side leads both',
      tr1: '{n} — median annual pay {x}, block hours {y}.',
      tr2: '{n} — median annual pay {x}, layover nights {y}.',
      tr3: '{n} — pay per block hour {x}, block hours {y}.',
      trEnd: 'It is not about which is better, but about what you value.',
      foot: 'Only groups with enough data are shown. Pay / Block Hour is the median of each pilot’s annual pay ÷ 12 ÷ block hours. It is not an hourly wage.',
      footA: 'Annual pay = cash incl. housing allowance, per diem, transport, bonus and profit share; housing in kind is not counted.',
      ctaT: 'Go deeper', ctaS: 'There are other ways to read this.',
      cta1: 'Compare other airlines', cta3: 'Back to DEEP PAY',
      lockT: 'Opens when you submit your pay details',
      lockTWait: 'DEEP PAY is not open yet',
      lockKey: 'Share one pay report and it opens for 90 days.',
      lockReady: 'It opens once every item on your pay report is answered.',
      lockTodoH: 'Still unanswered ({ym})',
      lockWarn: 'Submitting false or inaccurate information may result in suspension of your account under our Terms of Service.',
      lockGoal: 'It opens once {goal} pilots have shared their pay (currently {n}).',
      lockCta: 'Share your pay anonymously',
      lockGo: 'Give & Get / Enter your details to unlock',
      err: 'Could not load. Please try again in a moment.'
    }
  }[L];

  /* 給与構成の9区分。順は db/deep-pay.sql の cseg と同じ。
     ★bonus はここに無い（年額なので月々の現金の100%に混ぜられない）。
     ★2026-09-15、fixed を base と guarantee に割った（オーナー指示）。 */
  var SEGK = ['base', 'guarantee', 'variable', 'command', 'role',
              'perdiem', 'housing', 'other', 'rest'];
  var CN = {
    ja: { base: '基本給', guarantee: '保証手当・職務手当',
          variable: '変動給', command: '職位手当',
          role: '役割手当', perdiem: 'パーディアム', housing: '住宅手当',
          other: 'その他の現金', rest: 'その他・未分類' },
    en: { base: 'Base pay', guarantee: 'Guarantee / duty pay',
          variable: 'Variable (flying)', command: 'Rank pay',
          role: 'Role pay', perdiem: 'Per diem', housing: 'Housing allowance',
          other: 'Other cash', rest: 'Other / unclassified' }
  }[L];

  /* 色は PVViz.SEG（配列）から引く。deep-pay.js と同じ組み立て方
     ＝ 同じ項目がマイレポート・Overview・この画面で同じ色になる。 */
  var SEGCOL = {};
  (V.SEG || []).forEach(function (s) { SEGCOL[s.k] = s.c; });
  var COL = {
    base:     SEGCOL.base,
    guarantee: SEGCOL.guarantee,
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
  /* ★有効数字2桁も、表示通貨の中で掛ける（2026-10-11。なぜそうするかは deep-pay.js の
     sigIn の注 ── 円で寄せてから換算すると、ドルでは $629 のように持っていない桁が並ぶ）。
     円のときは sig2 そのもの＝円の表示は1文字も変わらない。 */
  function sigIn(jpy) {
    var C = w.PVCurrency;
    var cur = (C && C.get) ? C.get() : 'JPY';
    var rate = (C && C.rates && C.rates[cur]) || 1;
    return sig2(jpy / rate) * rate;
  }
  /* ★見出しの2つ（年収・Pay / Block Hour）だけ、表示通貨の中で刻みに寄せる
     （2026-10-11。なぜそうするか・1e-9 の理由は deep-pay.js の stepIn の注）。
     ⚠️ 下の4つ（stepIn / money / moneyRate / moneyExact）と sig2 / sigIn は deep-pay.js と
        **1文字も違えない**。違うと、同じ会社の同じ数字が2つの画面で別の額になる。 */
  function stepIn(jpy, yenStep, curStep) {
    var C = w.PVCurrency;
    var cur = (C && C.get) ? C.get() : 'JPY';
    var rate = (C && C.rates && C.rates[cur]) || 1;
    var st = (cur === 'JPY') ? yenStep : curStep;
    return Math.round(jpy / rate / st + 1e-9) * st * rate;
  }
  function money(usd) {                     // 年収。USD → 表示通貨（刻み 1万円／1,000・K/M 圧縮あり）
    var n = num(usd);
    if (n == null) return null;
    return fmt(stepIn(usdToJpy(n), 1e4, 1e3));
  }
  function moneyRate(usd) {                 // Pay / Block Hour。USD → 表示通貨（刻み 100円／1・圧縮なし）
    var n = num(usd);
    if (n == null) return null;
    return exact(stepIn(usdToJpy(n), 100, 1));
  }
  function moneyExact(usd) {                // 給与構成の月額。USD → 表示通貨（その通貨の中で2桁・圧縮なし）
    var n = num(usd);
    if (n == null) return null;
    return exact(sigIn(usdToJpy(n)));
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
  /* mode は5つ ── load（入口の答えを待っている）／open（開いている）／locked（会員で、
     まだ開いていない）／error（読み込めなかった）／anon（ログインしていない。2026-10-11）。
     ★anon だけは**サーバに聞かずに**決まる（boot）。聞いたあとで anon になるのは、
       サーバが「ログインしていない」と答えた回だけ（load / pair の authLost）。
     boot は入口の1回ぶん（state / gate / give / stats だけ使う）。
     side は左右それぞれの答え。★役職は左右共通・機材は左右別（fltA / fltB）。
     picks は選べる組み合わせ。形は db/deep-pay.sql の avail と同じ
     { air:[…], pos:{ '会社': […] }, flt:{ '会社|役職': […] } }。
     pkv は「中身が変わった回数」＝ picker() の組み直しの合図。 */
  var S = { mode: 'load', boot: null, air: {}, pos: {}, airs: [], poss: [], flts: [],
            picks: null, pkj: '', pkv: 0,
            sel: { a: '', b: '', pos: '', fltA: '', fltB: '' },
            side: { a: null, b: null }, client: null, busy: false, seq: 0,
            /* クラッカー用（2026-10-11。下の「開いた瞬間のクラッカー」の節）。
               who ＝ いまの会員の指紋（uid そのものではない）／popped ＝ この表示で
               もう鳴らしたか。⚠️ どちらも飾りにしか使わない。門はこれを読まない。 */
            who: '', popped: false };

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
     pv-airlines.json は色を持っていないので、色付きの版は使えない。 */
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
     実際は「人数の壁に届かず出せない」だけのことがある。 */
  function segPct(segs, k) {
    for (var i = 0; i < segs.length; i++) if (segs[i].k === k) return num(segs[i].pct);
    return null;
  }
  /* 区分ごとの月額中央値（USD）。db/deep-pay.sql の cseg が、人数の壁を越えた区分にだけ
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
       （db/deep-pay.sql の fixed_pct は基本給＋保証手当＋職位＋役割で、
         残りにはパーディアム・住宅・その他・未分類も入っている）。 */
  var MET = {
    annual:   { lab: T.mAnnual, f: money,
                get: function (x) { return num(x.head && x.head.annual_usd); } },
    /* ★Pay / Block Hour は moneyRate（刻み）。moneyExact（2桁）に戻すと、
       同じ区分が DEEP PAY の画面と違う額になる（あちらも moneyRate）。 */
    pbh:      { lab: T.mPbh,    f: moneyRate,
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
       ログインしていない人の画面（anon）も同じ ── 選んでも聞く先が無い。
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
  /* ── 信頼度の札（2026-10-11）── 人数のピルの代わり ────────────────
     前は会社ごとに「◯人」のピルを出していた。人数は画面のどこにも出さないことに
     なったので（オーナー判断）、同じ場所にサーバが返した信頼度の段を出す。
     ★段はサーバが決める（cohort.trust ＝ high / mid / low。式は db/deep-pay.sql の
       trust）。ここで作り直さない ── 作るには人数が要り、人数はもう来ない。
     ★薄い側・段が来ない側（古いサーバ・null・知らない値）は**札ごと出さない**。
       前は「—」を置いていたが、置くと「何かが欠けている」ことだけが読める。
     ★色は付けない（.dc-side-c の淡い1色のまま）。左右で緑と灰色に分かれると、
       それだけで勝ち負けに見える（この画面は順位を付けない）。 */
  var TRUSTW = { high: T.hi, mid: T.mid, low: T.lo };
  function trustChip(x) {
    var t = sideThin(x) ? null : (x.cohort && x.cohort.trust);
    if (typeof t !== 'string' || !TRUSTW.hasOwnProperty(t)) return '';
    return '<span class="dc-side-c">' + esc(T.trust) + ' ' + esc(TRUSTW[t]) + '</span>';
  }
  function cond() {
    var box = el('dc-cond');
    if (!box) return;
    if (S.mode !== 'open' || !pairReady() || (!S.side.a && !S.side.b)) {
      box.innerHTML = '';
      return;
    }
    var parts = [];
    if (S.sel.pos) parts.push(posName(S.sel.pos));
    /* ★機材はここに書かない（2026-09-01）。左右で別の機材を選べるようになった
       ので、1つにまとめると片方が嘘になる。**会社の見出しの側**に添える
       （sideCard の dc-side-f と diff の th）。 */
    /* ★ここに在った「◯人 vs ◯人」は 2026-10-11 に外した（オーナー判断）。
       ⚠️ 人数を足し戻さない。サーバが n を返してきても読まないこと。 */
    parts.push(T.months);
    /* ★deep-pay.js の head() と同じ形。ラベルもピルも dp-cond-l の**中**に入れる。
       外に出すと dp-cond-l の flex:1 1 auto が伸びて、
       「表示中:」だけ左端・中身が右端という離れた並びになる（実測で 363..847 と 859..1321）。
       信頼度の札はこのバーには付けない ── 段が左右で2つあり、1つに丸めると片方が
       嘘になる。会社ごとの見出しの側に1つずつ出す（trustChip）。 */
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
    var h = '<div class="dc-side-h">' + logoHtml(code) +
      '<span class="dc-side-n">' + esc(airName(code)) + '</span>' + fltTag(key) +
      trustChip(x) + '</div>';
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
       ロゴ・社名・信頼度の札は diff() の見出し行が受け持つ。
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
       丸めた後に同じ表示になる値を「違う」と書くと、同じ数字が2つ並んでいるのに
       差が出ているように見える。
       ★2026-10-11 に年収と Pay / Block Hour の刻みが細かくなった（1万円・100円／
         1,000・1）。同じ表示になる幅もそのぶん狭くなったが、**判定の仕方は変えて
         いない** ── 同じ字なら同じ・違う字なら違う。丸める前の値では比べない。
       ⚠️ 表示通貨で答えが変わることがある。それで正しい ── サーバの $119,700 と
          $119,750 は、円ではどちらも ¥1,903万・ドルではどちらも $120K（＝同じ）、
          ユーロでは €102K と €103K（＝違う）。刻みの境目をまたぐ組だけが入れ替わる。
          どの通貨でも「画面の2つの字と、その差」は辻褄が合っている。 */
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
     金額も時間も、丸めてから画面に出ている ── 年収と Pay / Block Hour は刻み
     （円なら 1万円・100円／それ以外は 1,000・1。stepIn）、パーディアム・住宅手当の
     月額は有効数字2桁、時間は小数1桁。丸める前の値で引くと、読み手が自分で
     引き算した答えと合わない数が出る。
     文字列どうしで引けば、**画面の3つの数字はいつでも辻褄が合う**し、
     差が**画面に出ている刻みより細かい精度を主張しない**
     （¥1,903万 と ¥2,035万 の差は +¥132万。刻みの1つぶん＝¥1万 より細かい差は出ようがない）。
     ★2026-10-11 に年収と Pay / Block Hour の刻みが細かくなったので、差も細かく出る
       （前は ¥1,900万 と ¥2,000万 で +¥100万 だった）。差に下限は置いていない＝
       刻み1つぶんの差（+¥1万）もそのまま出る。下限を置くと「同じ字でないのに
       差が出ない行」ができ、上の「辻褄が合う」が崩れる。
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
       ロゴ・社名・信頼度の札をここに入れたので、両方読めるときはカード2枚を出さない。
       class は .dc-side-n / .dc-side-c のまま ── 場所が変わっただけで意味は同じ
       （.dc-side-c の中身は 2026-10-11 に人数から信頼度の段へ替わった。trustChip）。 */
    /* ⚠️ 機材をここに入れ忘れない。両側とも読めるときカード2枚は出ない
       （cards() の注記）ので、**この見出しに無いと機材がどこにも出ない画面**になる。 */
    var th = function (cls, key) {
      var code = S.sel[key];
      return '<span class="' + cls + '">' + logoHtml(code) +
        '<span class="dc-side-n">' + esc(airName(code)) + '</span>' + fltTag(key) +
        trustChip(S.side[key]) + '</span>';
    };
    var head = '<div class="dc-tr dc-th"><span class="dc-c1">' + esc(T.thItem) + '</span>' +
      th('dc-c2', 'a') + th('dc-c3', 'b') + '</div>';
    /* ★狭い画面では「項目 → 2社の値」の2段に畳むので、値の側にも会社名を持たせる
       （行が縦に並ぶと、頭の見出し行はすぐ画面の外へ流れる）。
       広い画面では .dc-c-a が display:none になり、見出し行が受け持つ。
       ★見出し行そのものは狭い画面でも出す（2026-10-11。前は CSS で消していた）──
         機材の札と信頼度の札はこの行にしか無い。deep-pay-compare.css の「狭い画面」。 */
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
    /* ★人数の壁・「時給ではない」・年収の中身の説明はここの2行だけ。板5枚（データの見方）は
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
  /* ── 錠前の板に「どの行を出すか」（2026-10-11）──────────────────
     ★決めるのは**この関数1つ**。deep-pay.js の lockLines() と**同じ本体**
       （ずれは assert-deep-pay-compare.mjs の「写した関数」が見張る）。
       閉じている理由は3つ（鍵が無い／本人が答えきっていない／みんなの側が未達）で、
       当てはまるものを全部出す。2つめは gate.ready が true で**ない**とき
       （ready を返さない古いサーバの答えも「答えきっていない」に入る）、
       3つめは gate.crowd が false のときだけ。
       なぜ contributors と goal を比べないか・なぜ埋めないかは deep-pay.js の注。
     ★2つめは 2026-10-11 に入れ替えた（オーナー判断）。前は「内訳が1つでもあるか」
       （gate.detailed → lockDet）。いまは、自分に当てはまる項目をぜんぶ答えた人にだけ開く。
     ★ここに在った `if (!lines.length) lines.push(T.lockDet)` は**実際の不具合**だった。
       この画面は「100人に届いていない」の行を持っていなかったので、鍵も内訳も
       そろった人（止めているのは人数だけ）に「内訳を出すと開きます」と出ていた。
       ⚠️ 当てはまる行が無いときに、別の行で埋めない。 */
  function lockLines(gate) {
    var g = gate || {}, out = [];
    if (!g.key) out.push(T.lockKey);
    if (g.ready !== true) out.push(T.lockReady);
    if (g.crowd === false && g.contributors != null && g.goal != null)
      out.push(T.lockGoal.replace('{goal}', function () { return String(g.goal); })
                         .replace('{n}',    function () { return String(g.contributors); }));
    return out;
  }
  /* 板のボタンの行き先。★給与フォームの「どこから始めるか」を、足りない物に合わせる。
       鍵が無く、答えきってもいない  → フォームの頭（1件まるごと出してもらう）
       鍵だけ切れた（答えきっている）→ #ps（明細からの入口。新しい月を出せば鍵が戻る）
       鍵は在るが答えきっていない    → #pay-detail（フォームに前から在る「内訳の節を
                                        開いて出す」住所。actual-pay.js の DETAIL_URL と同じ。
                                        ★前は pv-gates.js が同じ住所を持っていた ── 公開前の
                                          説明の「給与内訳を追加する」。2026-10-11 に、3段の表の
                                          DEEP PAY の札と一緒に説明ごと外したので、あちらにはもう無い）
       鍵も答えもそろっている        → フォームの頭（止めているのは人数。今までどおり）
     ★足りない項目はこの画面では聞かない。給与フォームで足してもらう
       （2026-10-11 オーナー判断。板の中に入力は置かない ── 板の入口はこのボタン1本）。
     ★ここから下の6つ（lockHref / todoNames / todoMonth / lockTodo / lockHtml / lockBoard）は
       deep-pay.js と**同じ本体**（ずれは assert-deep-pay-compare.mjs の「写した関数」が
       見張る）。なぜそうなっているかの注は、あちらに1回だけ書いてある。 */
  function lockHref(gate) {
    var g = gate || {}, rdy = g.ready === true;
    if (g.key) return rdy ? 'pay-report.html' : 'pay-report.html#pay-detail';
    return rdy ? 'pay-report.html#ps' : 'pay-report.html';
  }
  /* まだ答えていない項目の名前。サーバ（gate.todo.items）が返すのはコードだけで、
     画面がここで言葉に直す。★名前は**給与フォームの欄の見出しと1文字も違えない**
     （板で読んだ言葉を、フォームでそのまま探せるように）。フォームの見出しを変えたら
     ここと deep-pay.js の両方を直す（assert-deep-pay.mjs の ⑫ がフォームと突き合わせる）。 */
  function todoNames() {
    return {
      ja: {
        item: { base: '基本給', guarantee: 'Flight time 保証手当 / 職務手当',
                variable: '変動給', command: '職位手当',
                perdiem: 'パーディアム（その月の合計）', housing: '住居',
                bonus: '年間ボーナス', profit: 'プロフィットシェア（年額）',
                block: 'フライトタイム', duty_h: '勤務時間（Duty time）',
                duty_days: '乗務日数（月）', stay: 'ステイ日数', roles: '役職・区分' },
        role: { instructor: '教官・訓練担当', examiner: '審査・査察担当',
                union: '組合・乗員代表', management: '管理・マネジメント',
                nonline: 'その他の兼務・配属' },
        sfx: 'の手当'
      },
      en: {
        item: { base: 'Base pay', guarantee: 'Flight time guarantee / Duty allowance',
                variable: 'Variable pay', command: 'Rank / position allowance',
                perdiem: 'Per diem (total for the month)', housing: 'Housing',
                bonus: 'Annual bonus', profit: 'Profit share (annual)',
                block: 'Flight time', duty_h: 'Duty time',
                duty_days: 'Duty days (month)', stay: 'Layover nights', roles: 'Role' },
        role: { instructor: 'Instructor / Training', examiner: 'Examiner / Check',
                union: 'Union / Pilot representative', management: 'Management / Leadership',
                nonline: 'Other / Non-Line Assignment' },
        sfx: ' allowance'
      }
    }[L];
  }
  /* 対象月の言い方（「2026年9月分」／「September 2026」。pv-pay-fix.js の month と同じ形）。 */
  function todoMonth(y, m) {
    var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
               'August', 'September', 'October', 'November', 'December'];
    return L === 'en' ? MON[m - 1] + ' ' + y : y + '年' + m + '月分';
  }
  /* 板の中の「まだ答えていない項目」の一覧。並びは届いた順。**表に無いコードは出さない**
     （コードをそのまま画面に出さない）。サーバから来た字は1文字も HTML に入れない ──
     コードは表を引く鍵にしか使わず、年と月は数に直して範囲を見てから出す。
     一覧が無い・空・月が読めないときは空文字（見出しだけの箱を出さない）。 */
  function lockTodo(gate) {
    var td = (gate || {}).todo, N = todoNames(), own = Object.prototype.hasOwnProperty;
    var seen = {}, li = [];
    if (!td || !Array.isArray(td.items)) return '';
    var y = Number(td.year), m = Number(td.month);
    if (!(y % 1 === 0 && m % 1 === 0 && y >= 1000 && y <= 9999 && m >= 1 && m <= 12)) return '';
    td.items.forEach(function (k) {
      var nm = '';
      if (typeof k !== 'string' || own.call(seen, k)) return;
      if (own.call(N.item, k)) nm = N.item[k];
      else if (own.call(N.role, k)) nm = N.role[k] + N.sfx;
      if (!nm) return;
      seen[k] = 1;
      li.push('<li class="dp-todo-i">' + esc(nm) + '</li>');
    });
    if (!li.length) return '';
    return '<div class="dp-todo"><p class="dp-todo-h">' +
      esc(T.lockTodoH.replace('{ym}', function () { return todoMonth(y, m); })) + '</p>' +
      '<ul class="dp-todo-l">' + li.join('') + '</ul></div>';
  }
  /* 錠前の板そのもの。deep-pay.js と**同じ板**を出す（前は shut() の中に別々に書いていた）。
     一覧は「答えきっていない」の行のすぐ下、断り（lockWarn）はその行が出ているとき
     **だけ**ボタンのすぐ上。入口はボタン1本（板の中に入力もリンクも足さない）。 */
  function lockHtml(gate) {
    var lines = lockLines(gate), todo = lockTodo(gate);
    var warn = lines.indexOf(T.lockReady) >= 0;
    // 本人が出せば開く（鍵が無い／答えきっていない）ときだけ、題とボタンを「出せば開く」の言い方にする
    var give = warn || lines.indexOf(T.lockKey) >= 0;
    return '<div class="dp-msg dp-msg--lock">' +
      '<div class="dp-msg-t">' + IC.lock.replace('24" height="24', '18" height="18') +
        esc(give ? T.lockT : T.lockTWait) + '</div>' +
      lines.map(function (t) {
        return '<p class="dp-msg-s">' + esc(t) + '</p>' + (t === T.lockReady ? todo : '');
      }).join('') +
      (warn ? '<p class="dp-msg-w">' + esc(T.lockWarn) + '</p>' : '') +
      '<a class="dp-cta" href="' + lockHref(gate) + '">' + esc(give ? T.lockGo : T.lockCta) + '</a>' +
      '</div>';
  }
  /* ── 板の後ろに置く、ぼかした影絵（2026-10-11・オーナー判断）──────────────
     「まだ開かない人には給与詳細を提出させる。背景にはぼかした DEEP PAY を表示させる。」
     閉じているときは、板の後ろにこの画面の**形だけ**を置いてぼかす。なぜそうするか・
     何を入れてはいけないかの注は deep-pay.js に1回だけ書いてある。要点は3つ ──
     ★★影絵は絵であって、データではない。**字も数字も1つも持たない**（空の要素だけ。
       サーバの答え・S・保存領域・計算した値・乱数のどれにも触らない固定の文字列）。
     ⚠️ ぼかしは隠す道具ではない（開発者ツールで外せる）。**本物の値を描いてから
        ぼかす形にしない。** 鍵の無い人へは、サーバが今までどおり数字を返していない。
     ⚠️ 開いた画面には影絵そのものが DOM に無い（lockStage を通るのは shut() の2本だけ ──
        会員の閉じた板 'lock' と、ログインしていない人の板 'anon'。どちらも数字が
        1つも来ていない画面）。
     ★ghBar / ghBars / ghField / ghHead / ghostTint / lockStage の6つは deep-pay.js と
       **同じ本体**（ずれは assert-deep-pay-compare.mjs の「写した関数」が見張る）。
       ghostShapes() だけは画面ごとに別（写す画面の形が違う）。 */
  function ghBar(mod) { return '<span class="dp-gh-ln dp-gh-ln--' + mod + '"></span>'; }
  function ghBars(mods) { return mods.split(' ').map(ghBar).join(''); }
  function ghField() {
    return '<span class="dp-gh-fld">' + ghBar('xs') + '<span class="dp-gh-box"></span></span>';
  }
  function ghHead() { return '<div class="dp-gh-h">' + ghBar('t') + ghBar('s') + '</div>'; }
  /* 影絵の色。PVViz.SEG から引いた COL（区分 → 色）を、CSS の変数として渡すだけ。 */
  function ghostTint() {
    return Object.keys(COL).filter(function (k) { return !!COL[k]; })
      .map(function (k) { return '--gh-' + k + ':' + COL[k]; }).join(';');
  }
  /* この画面の形 ── 上から 選ぶ欄（5つ）／ 差がつくポイントの表（見出し＋9行・2社の列）｜
     給与構成の棒2本 と トレードオフ。骨組みは本物と同じクラスで組んである
     ＝ 幅で畳まれ方が変わるのも本物と同じ。足りない寸法は deep-pay-compare.css の .dc-gh-*。
     ⚠️ .dc-side / .dc-side-n / .dc-kv-* は使わない。検査が「会社のカードや数字が
        出たかどうか」をそのクラスで数えている。
     ⚠️ 表のマスは本物のクラス（項目・左の会社・右の会社の3つ）を使わず、.dc-gh-k（項目）と
        .dc-gh-v（値）にしてある ── 本物のクラスは名前に数字が入っていて、この一式の
        「字面に数字が1文字も無い」（検査が見ている）と両立しない。
     ⚠️ 行や欄を増やすときも、**数字を書かずに**並べる（'a b c' を割って数える）。 */
  function ghostShapes() {
    var cell = function (cls, mods) {
      return '<span class="' + cls + '">' + ghBars(mods) + '</span>';
    };
    var rows = 'a b c d e f g h i'.split(' ').map(function () {
      return '<div class="dc-tr">' + cell('dc-gh-k', 'l') + cell('dc-gh-v', 'm') +
        cell('dc-gh-v', 'm') + '</div>';
    }).join('');
    var segs = ['base', 'variable', 'perdiem', 'housing', 'other'].map(function (k) {
      return '<i class="dc-seg" style="background:var(--gh-' + k + ')"></i>';
    }).join('');
    var bar = '<div class="dc-bar-row"><div class="dc-bar-h">' +
      '<span class="dc-logo dc-logo--mono"></span>' + ghBar('l') + '</div>' +
      '<div class="dc-bar dc-gh-bar">' + segs + '</div></div>';
    var tip = '<div class="dc-to-li"><span class="dp-gh-col">' + ghBars('w l') + '</span></div>';
    return '<div class="dp-pick dc-gh-pick">' +
        'a b c d e'.split(' ').map(ghField).join('') + '</div>' +
      '<div class="dp-row dc-main">' +
        '<div class="dp-gh-wide mr-card dc-gh-diff">' + ghHead() + '<div class="dc-tbl">' +
          '<div class="dc-tr dc-th">' + cell('dc-gh-k', 's') + cell('dc-gh-v', 'l s') +
            cell('dc-gh-v', 'l s') + '</div>' + rows + '</div></div>' +
        '<div class="dc-col">' +
          '<div class="mr-card">' + ghHead() + '<div class="dc-mix">' + bar + bar + '</div></div>' +
          '<div class="mr-card">' + ghHead() + '<div class="dc-to">' + tip + tip + '</div></div>' +
        '</div>' +
      '</div>';
  }
  /* 閉じているときの画面まるごと ＝ 影絵（後ろ）＋ 板（手前）。
     ★gate を渡すのは板（lockHtml）に**だけ**。影絵の側は引数なしで呼ぶ。 */
  function lockStage(gate) {
    return '<div class="dp-stage">' +
      '<div class="dp-ghost" aria-hidden="true" inert style="' + esc(ghostTint()) + '">' +
        ghostShapes() + '</div>' +
      lockHtml(gate) + '</div>';
  }
  /* 板を組むのは、中身が変わった回だけ。render() は何度も走る（社名の辞書があとから
     届く・通貨の切替）── 毎回組み直すと、Tab でボタンまで来た人の焦点が外れる。
     ★印（pvSig）は器（.dp-stage ＝ 影絵＋板）に持たせる。ほかの描き手（only() を通る
       ask / dup / few / 骨組み）が #dc-sides を書き替えれば器ごと消えるので、
       古い印で「同じ」と読み違えない。 */
  function lockBoard(box, html) {
    var m = box.firstElementChild;
    if (!m || m.pvSig !== html || box.children.length !== 1) {
      box.innerHTML = html;
      m = box.firstElementChild;
      if (m) m.pvSig = html;
    }
    box.hidden = false;
  }
  /* ── ログインしていない人の板（2026-10-11・オーナー判断）────────────────
     前は、ログインしていない人がここへ来るとログイン画面へ送っていた。いまは
     **会員で、まだ開いていない人と同じ画面**を出す ── ぼかした影絵の手前に板。
     なぜそうするか・何を足してはいけないかの注は deep-pay.js に1回だけ書いてある。要点 ──
     ★板は新しく書かない。「鍵が無く、答えきってもいない」会員の門と**同じ形の入れ物**を
       同じ lockStage へ通す（todo:null ＝ 残りの一覧は出ない／crowd:true ＝ 100人の行を
       出さない ── サーバに聞いていないので数を知らない）。字も文もリンクも足さない。
     ⚠️ サーバには**聞かない**（pv_deep_pay() は未ログインだと必ず落ちる）。この入れ物は
        答えではなく、聞かずに描くための固定の値。これで開くものは無い。
     ★anonGate / authLost の2つは deep-pay.js と**同じ本体**
       （ずれは assert-deep-pay-compare.mjs の「写した関数」が見張る）。 */
  function anonGate() { return { key: false, ready: false, todo: null, crowd: true }; }
  /* サーバが「ログインしていない」と答えたか（端末にはセッションが残っているのに、
     サーバの側では切れていた回）。見分けるのは2つだけ ── pv_deep_pay() が未ログインの
     ときに投げる 42501 と、HTTP 401。supabase-js の答えは { error:{ code }, status }。
     ⚠️ ほかの失敗（通信が切れた・サーバが落ちた）は false のまま ＝ 今までどおり
        「読み込めませんでした」。端末のログインの控えには触らない。 */
  function authLost(res) {
    var e = res && res.error;
    return !!e && (String(e.code) === '42501' || Number(res.status) === 401);
  }
  function shut(kind) {
    if (kind === 'error') { only('<div class="dp-msg">' + empty(T.err) + '</div>'); return; }
    /* ★板の中身（行・残りの一覧・断り・ボタンの行き先）は lockHtml() が決める。
         ここで足したり埋めたりしない。置くのは lockBoard()（中身が変わった回だけ）。
       ⚠️ ここだけ only() を通さない。あちらは毎回 innerHTML を書き替えるので、
          焦点の在るボタンごと作り直してしまう（lockBoard の注）。
          下の4枚を畳むところ（clearLow）までは only() と同じ。
       ★2026-10-11 から、板は「ぼかした影絵の手前」に出す（lockStage ＝ 影絵＋板）。
         影絵は字も数字も持たない固定の絵で、S.boot からは gate しか使わない
         （鍵の無い人の答えに head / comp が紛れて来ても、ここからは描かれない）。 */
    clearLow();
    var box = el('dc-sides');
    if (!box) return;
    /* ★ログインしていない人（kind === 'anon'。2026-10-11）。同じ器（影絵＋板）を、
         作り物の門 anonGate() で組む ── サーバの答え（S.boot）は読まない（聞いていない）。
       ⚠️ ここで戻る ＝ 下の partyMark() を**通らない**。印は「閉じた板を見た会員」の
          控えで、この板は会員の門を見て出したものではない（ログインが切れただけの会員には
          指紋が在る ── 印を置くと、前から開いていた人がログインし直した日に鳴ってしまう）。
          端末には何も書かない。 */
    if (kind === 'anon') { lockBoard(box, lockStage(anonGate())); return; }
    lockBoard(box, lockStage((S.boot && S.boot.gate) || {}));
    /* ★「この会員は閉じた板を見た」と端末に控える（開いた日のクラッカー用。下の節）。
         書くだけで、ここでは何も読まない ── 板の中身にも門にも関係しない。 */
    partyMark();
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
      '</div>');
  }

  // ── 開いた瞬間のクラッカー（2026-10-11・オーナー指示）──────────────
  /* オーナーの頼み ── 閉じた板を見ていた会員が給与の詳細を出して、この画面が開いたら
     「クラッカーならしてね」。紙吹雪を**1回だけ**飛ばす。

     ── いつ鳴らすか（partyMark / partyDue）──
     ★閉じた板を描いたとき、端末に印を1つ置く（localStorage の partyKey()）。中身は
       会員の**指紋**（PVPayLocal.fp ＝ pv-session.js に1本だけ在る畳み方。給与フォームの
       下書きの押印と同じもの）で、uid そのものは置かない。指紋が取れない回は置かない。
     ★開いた画面を描くとき、その印が在って自分のものなら鳴らす。印は**鳴らす前に**消す
       （再読み込みで2度鳴らない。消せなかった回は鳴らさない）。別の会員の印・自分の
       指紋が取れない回の印は、消すだけ。
     ★指紋は秘密ではない（短く畳んだだけ）。「この端末の中で同じ人か」を見分けるための
       もので、ログアウトしても印は残る ── 同じ会員が次に開いた日に鳴り、別の会員なら消える。
     ★2つの画面（DEEP PAY・会社比較）で同じ印を使う ── 先に開いたほうで鳴り、もう片方は
       印が無いので鳴らない。同じ表示の中でも1回まで（S.popped）。
     ★鳴らないもの：板を1度も見ていない会員（印が無い）／閉じた画面・読み込めなかった
       画面・読み込み中（partyPop は render() の「開いている」枝からしか呼ばれない）。
     ⚠️ この印は**飾り**。門ではない。見られるかどうかを決めるのはサーバ（gate）だけで、
        板の行・ボタンの行き先・左メニューの錠前のどれも、この印を読まない。
        ここから門の鍵（pv-gates.js / pv-session.js が読む鍵）へは**1つも書かない**
        ── 書くのは partyKey() の1つだけ。印を手で書き足しても、紙吹雪が出るだけで
        数字は1つも開かない。
     ⚠️ 保存領域は投げることがある（プライベートモード・容量切れ）。読む・書く・消すは
        必ず try の中。投げた回は「印が無い」と同じ ＝ 鳴らさないだけで、画面は描ける。

     ── どう鳴らすか（partyPop / partyFire / partySpec / partyHtml）──
     ★音は出さない。ブラウザは、操作なしで始まる音を止める（鳴ったり鳴らなかったりする）。
       出すのは絵だけ。
     ★本文の上の左右の角から、紙吹雪を内向きに1発ずつ（左右 42 枚ずつ。狭い画面は
       30 枚ずつ）。約 2.2〜2.8 秒で落ちながら消え、終わったら器ごと DOM から外す。
     ★扇の形は画面に合わせる ── 横へは本文の幅の6割まで・下へは画面の高さの4割ほどまで。
       横長の画面では浅く広く、縦長のスマホでは深く開く（幅だけで決めると、スマホでは
       見出しの上に固まった帯になる）。
     ★動かすのは transform と opacity **だけ**（Web Animations API）。1枚は3重の入れ子で、
       外から 落ちる（下へ・だんだん速く）／飛ぶ（向きを回して前へ・だんだん遅く）／
       舞う（紙の回転）。向きは rotate に任せるので、三角関数も円周率も持たない。
     ★乱数を使わない。向き・距離・落ち幅・長さ・出だしのずれ・回転・大きさは、**何枚目か**
       だけから決める（partyBit ＝ 番号 × 定数の小数部分。むらなく散って、毎回同じ絵）。
       形と色は番号の余りで回す。
     ★色はこの画面の色だけ ── 給与構成の色（COL ＝ PVViz.SEG。影絵と同じ --gh-*）と
       --pv-accent。灰色（rest）は使わない。色の値をここに書かない。
     ★器（.dp-pop）は position:fixed・pointer-events:none・aria-hidden。字も数字も入れない。
       下のボタンや欄は、紙吹雪が重なっていても今までどおり押せる。画面の外へ出た紙は
       器が切る（横スクロールを作らない）。
     ★寸法を読むのは、器を置く前の1か所だけ（本文の箱と窓の大きさ）。置いたあとは
       書くだけ ── 読み書きを交互にしない。
     ★「動きを減らす」設定の人には器ごと作らない（印は消す）。Web Animations API の無い
       ブラウザでも作らない。裏のタブで開いた回は、表に出たときに鳴らす。
     ⚠️ ぼかし・filter は使わない（この画面でぼかしてよいのは影絵だけ）。値をここで
        描かない ── 紙吹雪はサーバの答えを1つも読まない。
     ★この節の9つ（partyKey / partyWho / partyMark / partyDue / partyBit / partySpec /
       partyHtml / partyFire / partyPop）は、2つの JS（deep-pay.js / deep-pay-compare.js）に
       **同じ本体**で置いてある（ずれは assert-deep-pay-compare.mjs の「写した関数」が見張る）。 */
  function partyKey() { return 'pv_deep_was_locked'; }
  /* 会員の指紋。★畳み方は pv-session.js の1本を借りる（2つ目を作らない）。 */
  function partyWho(session) {
    var id = session && session.user && session.user.id, P = w.PVPayLocal;
    try { return (id && P && typeof P.fp === 'function') ? String(P.fp(id) || '') : ''; }
    catch (e) { return ''; }
  }
  /* 閉じた板を描いたときに呼ぶ。書くだけ（何も返さない・何も読まない）。 */
  function partyMark() {
    if (!S.who) return;
    try { w.localStorage.setItem(partyKey(), S.who); } catch (e) {}
  }
  /* 鳴らしてよいか。★印は、答えを出す前にここで消す（在れば必ず）。 */
  function partyDue() {
    var k = partyKey(), v = null;
    try {
      v = w.localStorage.getItem(k);
      if (v == null) return false;
      w.localStorage.removeItem(k);
    } catch (e) { return false; }
    if (!S.who || v !== S.who || S.popped) return false;
    S.popped = true;
    return true;
  }
  /* 0〜1 の、番号だけで決まる値。k を変えると別の並びになる。 */
  function partyBit(n, k) { var x = (n + 1) * k; return x - Math.floor(x); }
  /* n 枚目の飛び方。half より前は左の角・後ろは右の角。rx / ry ＝ 横・下へ飛ぶ距離の
     上限、drop ＝ 落ちる幅の上限（どれも px）。★同じ引数には、いつも同じ答え。
     ★遠さは平方根で散らす（面でむらなく ── 素のままだと角の近くに固まる）。 */
  function partySpec(n, half, rx, ry, drop) {
    var right = n >= half;
    var ang = -8 + 96 * partyBit(n, 0.7549);       // 0 ＝ 真横（内向き）・90 ＝ 真下
    var lim = rx + (ry - rx) * Math.max(ang, 0) / 90;    // 横は rx・下は ry（あいだは均す）
    return {
      ang: Math.round(right ? 180 - ang : ang),
      far: Math.round(lim * (0.18 + 0.82 * Math.sqrt(partyBit(n, 0.5698)))),
      fall: Math.round(drop * (0.5 + 0.5 * partyBit(n, 0.618))),
      dur: 2200 + Math.round(400 * partyBit(n, 0.4142)),
      wait: Math.round(140 * partyBit(n, 0.3247)),
      turn: Math.round((right ? -1 : 1) * (200 + 520 * partyBit(n, 0.2451))),
      flip: 540 + Math.round(900 * partyBit(n, 0.8192)),
      size: Math.round((0.8 + 0.65 * partyBit(n, 0.9346)) * 100) / 100
    };
  }
  /* from〜to 枚目の紙。★空の <i> だけ（字・数字・押せるものを入れない）。 */
  function partyHtml(from, to, hues) {
    var kinds = 'a a b c d'.split(' '), out = '', n;
    for (n = from; n < to; n++) {
      out += '<i class="dp-pop-f"><i class="dp-pop-a"><i class="dp-pop-p dp-pop-p--' +
        kinds[(n * 7 + 3) % kinds.length] + '" style="background:' +
        hues[(n * 5 + 2) % hues.length] + '"></i></i></i>';
    }
    return out;
  }
  function partyFire() {
    var main = d.querySelector('.mr-main');
    /* ★寸法を読むのは、この2行だけ（器を置く前）。 */
    var box = main ? main.getBoundingClientRect() : null;
    var vw = d.documentElement.clientWidth, vh = w.innerHeight;
    var x0 = Math.max(box ? box.left : 0, 0), x1 = Math.min(box ? box.right : vw, vw);
    var y0 = Math.min(Math.max(box ? box.top : 0, 0), vh);
    var wide = x1 - x0, drop = vh * 0.86;
    var rx = Math.min(Math.max(wide * 0.6, 210), 700), ry = Math.min(vh * 0.42, 420);
    var count = wide < 640 ? 60 : 84, half = count / 2, last = 0;
    var hues = Object.keys(COL).filter(function (k) { return !!COL[k] && k !== 'rest'; })
      .map(function (k) { return 'var(--gh-' + k + ')'; }).concat(['var(--pv-accent)']);
    var at = function (x) {
      return '<div class="dp-pop-o" style="left:' + Math.round(x) + 'px;top:' +
        Math.round(y0 + 6) + 'px">';
    };
    var lay = d.createElement('div');
    var gone = function () { if (lay.parentNode) lay.parentNode.removeChild(lay); };
    lay.className = 'dp-pop';
    lay.setAttribute('aria-hidden', 'true');
    lay.setAttribute('style', ghostTint());
    lay.innerHTML = at(x0 + 8) + partyHtml(0, half, hues) + '</div>' +
      at(x1 - 8) + partyHtml(half, count, hues) + '</div>';
    d.body.appendChild(lay);
    try {
      Array.prototype.forEach.call(lay.querySelectorAll('.dp-pop-f'), function (f, n) {
        var s = partySpec(n, half, rx, ry, drop), a = f.firstChild, p = a.firstChild;
        var t = { duration: s.dur, delay: s.wait, fill: 'both' };
        f.animate([
          { transform: 'translateY(0px)', opacity: 0, easing: 'cubic-bezier(.4,0,.8,.5)' },
          { opacity: 1, offset: 0.04 }, { opacity: 1, offset: 0.7 },
          { transform: 'translateY(' + s.fall + 'px)', opacity: 0 }], t);
        a.animate([
          { transform: 'rotate(' + s.ang + 'deg) translateX(0px)',
            easing: 'cubic-bezier(.1,.76,.22,1)' },
          { transform: 'rotate(' + s.ang + 'deg) translateX(' + s.far + 'px)' }], t);
        p.animate([
          { transform: 'rotate(0deg) rotateX(0deg) scale(' + s.size + ')' },
          { transform: 'rotate(' + s.turn + 'deg) rotateX(' + s.flip + 'deg) scale(' +
            s.size + ')' }], t);
        last = Math.max(last, s.dur + s.wait);
      });
    } catch (e) { gone(); return; }    /* 途中で止まった紙を、角に残さない */
    w.setTimeout(gone, last + 80);
  }
  function partyPop() {
    if (!partyDue()) return;
    var calm = true;
    try { calm = !!w.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { calm = true; }
    if (calm || !d.body || typeof d.body.animate !== 'function') return;
    if (!d.hidden) { partyFire(); return; }
    d.addEventListener('visibilitychange', function seen() {
      if (d.hidden) return;
      d.removeEventListener('visibilitychange', seen);
      partyFire();
    });
  }

  // ── 描く ───────────────────────────────────────────────────────
  function render() {
    picker(); hdr(); cond();
    if (S.mode === 'error') { shut('error'); return; }
    /* ★ログインしていない人（2026-10-11）。会員の閉じた板と同じ器を、サーバに聞かずに出す。
         ⚠️ この行は「開いている」枝より前 ＝ partyPop() を通らない（鳴らさない）。 */
    if (S.mode === 'anon')  { shut('anon');  return; }
    if (S.mode === 'load')  { skel();        return; }
    if (S.mode !== 'open')  { shut('lock');  return; }
    /* ★ここまで来た ＝ 開いている。閉じた板を見たことのある会員なら、1回だけ
         クラッカーを鳴らす（鳴らすかどうかは partyPop() の中。返り値は使わない ──
         この下の描き分けは、鳴っても鳴らなくても1文字も変わらない）。 */
    partyPop();
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
  /* 会社を入れて1社ぶん引く。★役職は左右共通・**機材は左右別**（2026-09-01）。
     ★返すのは3通り（2026-10-11）── その会社の答え／null（引けなかった）／LOST
       （サーバが「ログインしていない」と答えた。authLost の注）。LOST は中身の無い
       目印で、pair() が「読み込めませんでした」と見分けるためだけに在る。 */
  var LOST = {};
  function one(client, code, flt) {
    return Promise.resolve(client.rpc('pv_deep_pay', {
      p: { airline: code, position: S.sel.pos || null, fleet: flt || null }
    })).then(function (res) {
      if (!res || res.error) return authLost(res) ? LOST : null;
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
      /* ★見ている途中でログインが切れた回（片方でも LOST）は、ログインしていない人と
           同じ板。⚠️ 下の「引けなかった」より**前**に見る（LOST は空でない値なので、
           後ろに置くと、中身の無い答えのまま開いた画面を描きに行く）。 */
      if (r[0] === LOST || r[1] === LOST) { S.mode = 'anon'; render(); return; }
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
      /* ★失敗は2つに分ける（2026-10-11）。サーバが「ログインしていない」と答えた回
           （authLost）は、ログインしていない人と同じ板。それ以外は今までどおり
           「読み込めませんでした」。
         ⚠️ どちらもここで戻る ＝ 下の PVGates.mark() を通らない（答えが無いのに、
            左メニューの錠前の控えを書き換えない）。 */
      if (res && res.error) { S.mode = authLost(res) ? 'anon' : 'error'; render(); return; }
      var v = res && res.data;
      S.boot = v || null;
      S.mode = (v && v.state === 'open') ? 'open' : (v ? 'locked' : 'error');
      /* ★選べる組み合わせ。**無いときは null のまま**＝選ばせない（few）。
           db/deep-pay.sql を貼る前の本番はこの形で返ってくる。 */
      setPicks(v && v.picks);
      /* 左メニューの錠前（REAL PAY の段）を、サーバの答えで上書きする（deep-pay.js と同じ）。
         ★その下の setProgress は、2026-10-11 から受け取るだけで何もしない（pv-gates.js が
           3段の表の DEEP PAY の札を外したため。呼ぶ側が残っているので名前だけ在る）。 */
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
      /* ★ログインしていない人（2026-10-11・オーナー判断）。前はページ側がログイン画面へ
           送っていて、ここは何もせずに戻るだけだった。いまは送らない ── 閉じた画面
           （影絵＋板）を描いて終わる。板の出どころは anonGate() の注。
         ⚠️ この先へ進めない ── pv_deep_pay() も、預かり証の引き取り（sweep）も
            **呼ばない**（どちらも未ログインでは必ず落ちる通信）。指紋も取らない
            （会員が居ない ＝ クラッカーの印も置かれない）。 */
      if (!session) { S.mode = 'anon'; render(); return; }
      /* クラッカー用に、いまの会員の指紋を持っておく（uid そのものは持たない。
         取れなければ空のまま ＝ 印も書かず、鳴らしもしない）。 */
      S.who = partyWho(session);
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
     **作り物のデータを既定で描かせない**ため、呼ばれたときだけ S を差し替えて描き直す。
     ・render … 開いた画面を、渡した2社ぶんの答えで描き直す。
     ・lock   … 閉じた画面を、渡した入口の答え（gate を持つ入れ物）で描き直す
                （2026-10-11。影絵と板を、門の組み合わせ × 幅 × 明暗で測るため ──
                  1通りごとにページを開き直すと、この Mac では混んで嘘の赤が出る）。
                ★閉じる側にしか倒せない（mode は 'locked' 固定）。これで何かが開くことは無い。 */
  w.PVDeepPayCompare = {
    render: function (a, b, sel) {
      if (sel) S.sel = { a: sel.a || '', b: sel.b || '', pos: sel.pos || '',
                         fltA: sel.fltA || '', fltB: sel.fltB || '' };
      S.side = { a: a || null, b: b || null };
      S.mode = 'open';
      render();
    },
    lock: function (boot) {
      S.boot = boot || null;
      S.mode = 'locked';
      render();
    }
  };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
