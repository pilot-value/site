/* ════════════════════════════════════════════════════════════════
   actual-pay.js — REAL PAY（他のパイロットの実給与）
                   （actual-pay.html / en/actual-pay.html が共有）

   この画面は1枚の表でできている。**1行＝1人**。
   給与を出した人は、その全員がここに1行ずつ出る。

   ★2026-08-23 オーナー判断で、次の3つが無くなった。
     ・k≧5 の門（5人そろった区分だけ出す）
     ・30日の遅延
     ・公開情報からの推定レンジの節（青）
   だから今このファイルには、推定の数字を描くところが1つも無い。
   **青（--pv-blue-*）をこの画面に戻さないこと。** 戻すということは、
   推定と実データを同じ画面で並べるということで、そのときは
   「①と②から1つの数を作らない」という約束を作り直すところからやり直す。

   ── サーバから何が返ってくるか ────────────────────────────────
   pv_pay_rows() が1行あたりで返すのは
     航空会社コード / 職位 / 年収(USD) / 検証済みか / 投稿時期の段
     ＋ 機材コード / 在籍の**段**（0〜2）/ 報酬の内訳の**帯** / 勤務の**帯**
   基地・年代・投稿月・原本の通貨・契約形態・国籍・本人を指す識別子は
   **1つも返ってこない**（db/pay-rows.sql が出さない）。
   だからこのファイルにも、それらを受け取る場所は無い。

   ★2026-09-03、オーナー判断で機材・在籍・内訳・勤務を出すことにした。
     2026-08-24 に外したものを、**形を変えて**戻した ── 戻したのは
     「その人の実額」ではなく「幅のある帯」で、帯を作るのは**サーバ**。
     ⚠️ **画面でぼかすのではない。** 生の額をここへ渡して CSS で霞ませる形は
        開発者ツールで1秒で剥がれる。渡っていないものは、隠す必要が無い。
        blur / filter のたぐいを、この画面の CSS に1文字も書かないこと。
     ★機材は出すが、**機材で絞る口は作らない**。絞れると、絞った結果から
       出していない組み合わせが逆算できる（隠したことにならない）。
     ★在籍は「1〜5年」のような段だけ。年そのものはサーバから来ない。

   ★航空会社の欄で「その他」を選んだ人の行も、サーバが**語彙に当ててから**返す
     （db/pay-rows.sql の pv_airline_resolve）。打ち込まれた文字列は来ない。
     ・当たった … 本当の社名のコードで来る＝他の行と同じように社名が出る
     ・当たらない … 'other' で来る＝画面が「一覧にない航空会社」と書く
     2026-08-25 まではここが一律「その他の航空会社」だった（オーナー指示で変更）。

   ★並びはサーバが決める（**新しい順・新しいほうが上**）。画面は受け取った順に描くだけ。
     2026-08-25 にオーナー指示で md5 順から変えた。
     ★並べ替えの口を作らないこと。金額で並べ替えられると、この画面はランキングになる
       （db/pay-rows.sql の契約⑥）。

   ── 金額の出し方 ──────────────────────────────────────────────
   サーバは USD で有効数字2桁に確定させている。画面は表示通貨へ換算したあと
   **もう一度2桁に丸め直す**（$180,000 → ¥2,861万 を ¥2,900万 に）。
   ★ここを省くと、通貨を切り替えた瞬間だけ端数の残った数字が出て、
     「本当は1円単位まで持っているのでは」と読めてしまう。
   ★丸め直しは見た目だけで、開示している中身は増えない。
   ★k≧5 の門もクリップも無くなった今、この丸めがいちばん外側の守り。

   ★ 結果の入れ物には pv-no-cur を付けてある（currency.js の自動走査を止める）。
     通貨の切替は 'pv-currency-change' を購読して描き直す。
     ⚠️ 描き直しで pv_pay_rows() を引き直さない。データは state に持つ。

   ★ ランキングにしない。金額で並べ替える口も、「検証済みだけ」に絞る口も作らない。
     前者はこの画面を序列にする。後者は「絞った行数＝検証済みの人数」という生の数になる。

   ── 図は1つも無い ─────────────────────────────────────────────
   ★2026-08-24、オーナー判断で**図を全部外した**。
     支給の内訳（ドーナツ）も、年収の分布（棒）も、この画面には描かない。
     「この給与は何で構成されているか」「どう散らばっているか」は
     **DEEP PAY** が複数の投稿を集計して見せる。REAL PAY は1行＝1人の一覧だけ。
     ＝ このファイルは PVViz（pay-viz.js）を使わない。HTML も読み込んでいない。
     ＝ my_pay_reports() も引かない（引いていたのは分布の「あなた」の破線のためだけ）。
   ★表は幅いっぱい。2段組（ap-cols / ap-main / ap-side）はもう無い。
     ⚠️ 分布の棒も、割合のドーナツも戻さない。あれは複数の投稿を集計した図で、
        DEEP PAY の担当。ここは1行＝1人の一覧のまま。

   ── 行を押すと出る面（2026-09-03）────────────────────────────
   ★行は押せる。押すと右から**その1人ぶんの面**が出る（ページ遷移しない）。
     出るのは 機材 / 在籍の段 / 報酬の内訳の帯 / 勤務の帯 / 同社同職位の他の記録。
     ⚠️ **サーバへは1本も投げ直さない。** 一覧を引いたときの行に全部入っている。
        ここで引き直す形にすると「どの行を開いたか」がサーバの記録に残る。
     ⚠️ 面は body の直下に**その場で作り**、閉じたら DOM から**消す**。
        閉じている間、他人の帯が1文字も画面に残っていないこと。
     ⚠️ 見出しは h3。この画面の h2 は 0 のままにする（一覧の節は1つだから）。
     ⚠️ **順位（percentile）は出さない**（オーナー判断 2026-09-03）。
        「上位◯%」は集団の話で、この面は1人の話。混ぜると別の画面になる。
     ⚠️ **時間あたりの単価も出さない。** 帯の年収 ÷ 帯の勤務時間は、
        どちらの帯の中の位置も絞り込む足がかりになる。

   ── 投稿の時期（いちばん右の列）────────────────────────────────
   ★2026-08-24 に足した。出すのは**5段の粗い区分の言葉だけ**
     （1ヶ月以内 / 3ヶ月以内 / 6ヶ月以内 / 1年以内 / それより前）。
     日付も年月もサーバから来ない（来るのは 0〜4 の段の番号）。
   ⚠️ **並べ替えの口も絞り込みの口も付けない。**
     並びに投稿の新しさが乗ると「誰が最近出したか」が読める（db/pay-rows.sql の契約⑥）。
   ════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';
  if (!w || !d) return;

  /* ★ページ相対で書くと /en/ から /en/salary-data.json を見に行って 404 になる。
       このスクリプト自身の URL を基準に解く（my-value.js の PUB_URL と同じ）。
       currentScript は同期実行中しか取れないので、ここで確定させる。
     ★salary-data.json はもう金額のためには読まない。**社名の辞書**として読む
       （pv-vocab.json は機材と職位しか持っていない）。 */
  var AIR_URL = 'salary-data.json';
  var VOCAB_URL = 'pv-vocab.json';
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
      hd: 'REAL PAY',
      all: 'すべて',
      thAir: '航空会社', thPos: '職位',
      thAmt: '年収', thMon: '月あたり', thVf: '出典', thAge: '投稿時期',
      othAir: '一覧にない航空会社',
      /* ★「本人申告」── 本人が書いたという意味だけ。Verified（明細の裏付け）とは別。
           ⚠️ この語を変えたら assert-pay-rows.mjs の VF_LABELS も同じコミットで直す。
              あちらは表の文字からこの札を取り除いてから「件」「人」が残っていないかを
              見ているので、直し忘れると**画面は正しいのに検査だけが赤くなる**。 */
      vfNo: '本人申告',
      /* ★投稿時期。段の番号（0〜4）を言葉にするだけ。日付は持っていない。 */
      age: ['1ヶ月以内', '3ヶ月以内', '6ヶ月以内', '1年以内', 'それより前'],
      stRep: '実給与の投稿',       stRepU: '件',
      stAir: '航空会社',           stAirU: '社',
      stMon: '1ヶ月以内の新規投稿', stMonU: '件',
      foot: 'この一覧は、給与を出したパイロットだけが読めます。'
          + '金額はすべて幅のある帯です'
          + '（月あたりは年収を12で割った数字です）。'
          + '基地・年代・国籍・契約形態は誰の行にも入っていません。'
          + 'いつ出されたかは、おおまかな時期だけです。',
      /* ★行を押すと出る面（2026-09-03）。日英そろえて書く。
           ⚠️ ここに「上位◯%」「時給」の語を作らない。出さないと決めたもの。 */
      hintComp: '内訳あり', hintWork: '勤務あり', hintGo: '押すと匿名の詳細',
      dwOpen: '{air}・{pos} の記録を開く',
      dwClose: '閉じる',
      dwYear: '年収', dwMonth: '月あたり',
      dwComp: '報酬の内訳', dwWork: '勤務',
      dwSim: '同じ会社・同じ職位のほかの記録',
      dwOnly: 'この投稿には年収だけが含まれています。',
      dwNoComp: 'この投稿には給与内訳が含まれていません。',
      dwNoWork: 'この投稿には勤務の記録が含まれていません。',
      dwNote: '金額・勤務の数字は、匿名化のため帯で表示しています。'
            + '氏名・社員番号・メールアドレスなどの個人情報は公開しません。',
      /* ★積み上げバーの下に必ず置く1行。バーは帯の中点から出した概算で、
           正確な構成比ではない。数字（％）は1つも出さない。 */
      dwShare: '構成比は匿名化された金額帯から算出した概算です',
      /* 主 ── DEEP PAY。★リンクではなく、左メニューと同じ門（pv-gates.js）を開く。
           ⚠️ ここに deep-pay.html と書かない。DEEP PAY への辺は2本だけと決めてある
              （assert-deep-pay.mjs が root の全 .js を見張っている）。 */
      dwGo: '他社と比較する → DEEP PAY',
      /* 副 ── 出す側へ戻す。消さずに順位だけ下げる。 */
      dwCta: 'あなたの給与情報を匿名で追加',
      /* ★報酬の内訳の門（2026-09-03・オーナー指示）。
           自分の内訳を出した人だけが、他人の内訳を見られる（Give & Get）。
         ⚠️ ここは「ぼかし」ではない。閉じている行には金額そのものが**届いていない**
            （db/pay-rows.sql が pay を返さず paylock という真偽1つだけを返す）。
            だから開発者ツールで CSS を外しても、出てくるものが無い。
         ★「あと◯項目」と書かない。1つ埋めた人には嘘になる。 */
      lockPT: '報酬の内訳は、内訳を出した人どうしで見られます',
      lockPS: '基本給・Flight time 保証手当 / 職務手当・変動給の3つを答えると、'
            + 'ここが開きます。明細に無い項目は「該当なし」を選べます。',
      lockPC: '給与の内訳を入力する',
      /* 在籍の段。★年そのものは持っていない（サーバが 0〜2 の段だけを返す）。 */
      ten: { fo: ['1〜5年', '5年以上'],
             cap: ['1〜10年', '10〜20年', '20年以上'] },
      /* 区分の名前。★deep-pay.js の CN と同じ語（2画面で違う名前を付けない）。
           bonus だけこの画面の新規（DEEP PAY は賞与を月々の棒に入れない）。 */
      seg: { fixed: '基本給・保証給', variable: '変動給', command: '職位手当',
             role: '役割手当', perdiem: 'パーディアム', housing: '住宅手当',
             other: 'その他の現金', rest: 'その他・未分類',
             bonus: '賞与・利益分配' },
      wk: { bh: '乗務時間', dd: '乗務日数', off: '休日' },
      wkU: { bh: '時間 / 月', dd: '日 / 月', off: '日 / 月' },
      dash: '〜', under: '{v} 未満',
      pgPrev: '前へ', pgNext: '次へ', pgRange: '全{n}件中 {a}〜{b}件を表示',
      /* ★「明細を1枚」と書かない。手入力（source='web'）でも解放される。
           明細は VERIFIED PAY の話になったので、ここで要求すると Give を1つ減らす。 */
      lockT: '他のパイロットが実際に提出した給与を見る',
      lockS: 'あなたの給与を1件共有すると解放されます。給与明細でも手入力でもかまいません。'
           + '氏名も社員番号も受け取りません。'
           + '明細を使う場合、画像は端末の中だけで処理され、サーバーには送られません。',
      lockS2: '一覧に出るのは、航空会社・職位・機材と、帯にした年収・月あたりです。'
            + '行を押すと、その人の報酬の内訳と勤務も帯で見られます。',
      lockC: '匿名で給与を追加する',
      lockN: '約50秒・あとで内訳を追加できます',
      skelT: '解放後の一覧イメージ',
      skelL: '給与を1件共有すると一覧が見られます',
      seeT: 'REAL PAY で見えること',
      see: ['航空会社と職位ごとの、実際に受け取っている年収',
            '年収を12で割った、月あたりの金額',
            'その人が乗っている機材',
            '報酬の内訳（固定給・変動給・手当など）を帯で',
            '乗務時間・乗務日数・休日を帯で',
            '給与明細の裏付けがある行に付く Verified の印',
            'その記録がだいたいいつ出されたか'],
      seeN: '金額はすべて帯です。1円単位の数字は誰の行にも出ません。',
      emptyT: 'まだ1行もありません',
      emptyS: '給与を出した人は、その全員がここに1行ずつ出ます。最初の1人になれます。',
      emptyC: '匿名で給与を追加する',
      fEmptyT: 'この絞り込みに当てはまる記録はまだありません',
      fEmptyS: '絞り込みを外すと、ほかの記録が見られます。',
      errT: 'いま読み出せません',
      errS: '時間をおいてもう一度お試しください。'
    },
    en: {
      hd: 'REAL PAY',
      all: 'All',
      thAir: 'Airline', thPos: 'Position',
      thAmt: 'Annual', thMon: 'Per month', thVf: 'Source', thAge: 'Submitted',
      othAir: 'Airline not listed',
      vfNo: 'Self-reported',
      age: ['Within 1 month', 'Within 3 months', 'Within 6 months',
            'Within a year', 'Over a year ago'],
      stRep: 'Pay records',      stRepU: '',
      stAir: 'Airlines',         stAirU: '',
      stMon: 'Added within 1 month', stMonU: '',
      foot: 'This list is readable only by pilots who have submitted their own pay. '
          + 'Every figure is a range '
          + '(the monthly column is the yearly figure divided by twelve). '
          + 'Home base, age, citizenship and contract type appear on no row, '
          + 'and when a row was submitted is shown only as a broad period.',
      hintComp: 'Breakdown', hintWork: 'Work', hintGo: 'Open the anonymous detail',
      dwOpen: 'Open the {pos} record at {air}',
      dwClose: 'Close',
      dwYear: 'Per year', dwMonth: 'Per month',
      dwComp: 'Compensation', dwWork: 'Work',
      dwSim: 'Other records at the same airline and rank',
      dwOnly: 'This submission carries the yearly figure only.',
      dwNoComp: 'This submission does not include a pay breakdown.',
      dwNoWork: 'This submission does not include any work data.',
      dwNote: 'Pay and work figures are shown as ranges so that no one can be identified. '
            + 'Names, staff numbers and email addresses are never published.',
      dwShare: 'Shares are approximate, worked out from the anonymised ranges',
      dwGo: 'Compare with other airlines → DEEP PAY',
      dwCta: 'Add your pay anonymously',
      lockPT: 'Pay breakdowns are shared between the pilots who share their own',
      lockPS: 'Answer three things — base pay, flight time guarantee / duty allowance, '
            + 'and variable pay — and this opens. '
            + 'Anything your payslip does not carry can be marked “not applicable”.',
      lockPC: 'Add your pay breakdown',
      ten: { fo: ['1–5 years', '5+ years'],
             cap: ['1–10 years', '10–20 years', '20+ years'] },
      seg: { fixed: 'Base & guaranteed', variable: 'Variable (flying)', command: 'Rank pay',
             role: 'Role pay', perdiem: 'Per diem', housing: 'Housing allowance',
             other: 'Other cash', rest: 'Other / unclassified',
             bonus: 'Bonus & profit share' },
      wk: { bh: 'Block hours', dd: 'Duty days', off: 'Days off' },
      wkU: { bh: 'h / month', dd: 'days / month', off: 'days / month' },
      dash: '–', under: 'Under {v}',
      pgPrev: 'Previous', pgNext: 'Next', pgRange: 'Showing {a}–{b} of {n}',
      lockT: 'See what other pilots actually get paid',
      lockS: 'Share one of your own pay records and this opens. '
           + 'A payslip is not required — typing it in works too. '
           + 'We never take your name or staff number, '
           + 'and any payslip image is processed on your own device.',
      lockS2: 'A row carries the airline, the rank and the aircraft, '
            + 'with the yearly and monthly figures as ranges. '
            + 'Opening a row shows how that pay breaks down, and the work behind it.',
      lockC: 'Add your pay anonymously',
      lockN: 'About 50 seconds. You can add the breakdown later.',
      skelT: 'What the list looks like once it opens',
      skelL: 'Share one pay record to see the list',
      seeT: 'What REAL PAY shows',
      see: ['What pilots at each airline and rank actually earn in a year',
            'That figure divided by twelve, as a monthly amount',
            'The aircraft each pilot flies',
            'How the pay breaks down — base, variable pay, allowances — as ranges',
            'Block hours, duty days and days off, as ranges',
            'The Verified mark on rows backed by a payslip',
            'Roughly when each record was submitted'],
      seeN: 'Every figure is a range. No exact amount appears on any row.',
      emptyT: 'No rows yet',
      emptyS: 'Everyone who submits their pay gets a row here. You could be the first.',
      emptyC: 'Add your pay anonymously',
      fEmptyT: 'Nothing matches this filter yet',
      fEmptyS: 'Clear the filters to see the other records.',
      errT: 'We cannot load this right now',
      errS: 'Please try again in a little while.'
    }
  }[L];

  var PAY_URL = 'pay-report.html#ps';
  /* ★内訳の欄まで直接。pay-report.html の openDetailFromHash() が
       「くわしく入れる」を開いたところまで進めてくれる（あちらは書き足していない）。
     ★相対のまま。/en/ から踏めば /en/pay-report.html に解ける。 */
  var DETAIL_URL = 'pay-report.html#pay-detail';

  /* 門から給与フォームへ渡す「戻り先」。
     ⚠️ **URL に載せない。** クエリでもハッシュでも、他人の年収がアドレス欄に出て
        そのまま GA4 の画面URLに載る（english-funnel-dead-end-2026-09-02 と同じ理屈）。
        sessionStorage はそのタブの中だけで、閉じれば消える。
     ★持つのは行を引き当てるための3つだけ（会社・職位・年収）。年収は帯にした後の
        数字で、一覧にそのまま出ている。新しく何かを渡してはいない。 */
  var RP_BACK = 'pv_realpay_back';

  // ── 状態 ───────────────────────────────────────────────────────
  var S = {
    air: {},          // 航空会社コード → 表示名
    pos: {},          // 職位コード → 表示名
    flt: {},          // 機材コード → 表示名（2026-09-03）
    rows: null,       // pv_pay_rows() の行（そのまま持つ）
    mode: '',         // 'locked' | 'open' | 'error'
    fAir: '', fPos: '', fQ: '',   // fQ ＝ 社名の打ち込み（絞り込みの1つ）
    stats: null,      // サーバから来る数え上げ { reports, month }。無ければそのカードを出さない
    page: 1           // 1始まり。絞り込みを変えたら1に戻す（行き止まりを作らない）
  };

  var PER_PAGE = 10;

  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  var el = function (id) { return d.getElementById(id); };

  /* 有効数字2桁。db/pay-rows.sql の pv_sig2 と同じ考え方。
     ★こちらは表示通貨の値に対して掛ける（サーバは USD に対して掛けている）。 */
  function sig2(v) {
    v = Number(v);
    if (!isFinite(v) || v <= 0) return 0;
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10) - 1);
    return Math.round(v / p) * p;
  }

  /* USD → 表示通貨に直して有効数字2桁に丸めた「数」。整形はしない。 */
  function disp(usd) {
    var C = w.PVCurrency;
    if (!C || !isFinite(Number(usd))) return null;
    var jpy = Number(usd) * (C.rates.USD || 1);   // サイト内の基準は円
    return sig2(jpy / (C.rates[C.get()] || 1));
  }

  /* 表示通貨の「数」を、サイト共通の整形に通すだけ。
     ★分布の軸は USD を持っていない（刻んだのは表示通貨の値）ので、
       money() ではなくこちらを通す。 */
  function fmtDisp(n) {
    var C = w.PVCurrency;
    return (!C || n == null) ? '' : C.fmt(n * (C.rates[C.get()] || 1));
  }

  /* USD → 表示通貨。整形はサイト共通の PVCurrency.fmt に任せる
     （「万」を出すか出さないかの判断が日英で違うので、ここで持たない）。 */
  function money(usd) { return fmtDisp(disp(usd)); }

  /* 月あたり。★「画面に出ている年収」を12で割る。生の値から割ってはいけない。
     生から割ると、画面の月額 × 12 が画面の年収と合わない数字になる
     （年 $105,000 は「$110K」と出るのに、月は 105000/12 由来の「$8.8K」＝
      年 $105.6K 相当になり、読んだ人が引き算して桁を疑う）。 */
  function moneyMonth(usd) {
    var C = w.PVCurrency, n = disp(usd);
    return n === null ? '' : C.fmt(sig2(n / 12) * (C.rates[C.get()] || 1));
  }

  // ── 名前の引き当て ─────────────────────────────────────────────
  /* ★'other' で来るのは「語彙に当たらなかった」行だけ（サーバが当てて返す）。
       打ち込まれた社名はここまで来ないので、固定の札にする。 */
  function airName(code) {
    if (code === 'other') return T.othAir;
    return S.air[code] || code;
  }
  function posName(code) { return S.pos[code] || code; }

  /* 投稿時期。★サーバが返すのは 0〜4 の段の番号だけで、日付も年月も来ない。
       段の外（古いサーバ・想定外の値）は**空欄**にする。
       ここで「不明」のような札を作らない＝画面に無い情報を語らせない。 */
  function ageName(a) {
    return (typeof a === 'number' && T.age[a]) ? T.age[a] : '';
  }

  /* 機材（2026-09-03）。★語彙の名前はカッコで機種の並びを抱えている
       （「A320ファミリー（A319/320/321）」）。表の2行目には長すぎるので、
       カッコから先を落として頭だけ使う。落とすのは見た目の都合で、
       コードそのものは何も変えていない。
     ★語彙に無いコードはコードのまま出す（作り話の名前を置かない）。 */
  function fleetName(c) {
    if (!c) return '';
    var n = S.flt[c];
    return n ? n : c;
  }

  /* 在籍の段（2026-09-03）。★サーバが返すのは 0〜2 の**段だけ**で、年は来ない。
       段の外（古いサーバ・想定外の値）は**空**にする。
       ここで「不明」の札を作らない ── 「書いていない人」という情報も出さない。 */
  function tenName(r) {
    var a = r ? T.ten[r.pos] : null;
    return (a && typeof r.ten === 'number' && a[r.ten]) ? a[r.ten] : '';
  }

  /* 金額の帯（2026-09-03）。両端をそれぞれ表示通貨へ直し、2桁に丸め直す。
     ★丸め直しで両端が同じ数に潰れることがある（通貨で刻みが変わる）。
       潰れたら**上端だけ1つ上げる** ── $130,000〜$130,000 は帯に見えないし、
       「本当は1つの数を持っているのでは」と読めてしまう。
     ★下端が 0 の帯は、サーバが「2刻み未満だから畳んだ」という合図。
       「0〜◯」ではなく「◯ 未満」と書く（0 を受け取っている人は居ない）。
     ⚠️ replace の新しい側は**必ず関数**で渡す。fmtDisp は '$' を含むので、
        文字列で渡すと $' がマッチより後ろ全体に化ける（CLAUDE.md）。 */
  function rngMoney(lo, hi) {
    var a = disp(lo), b = disp(hi);
    if (a === null || b === null) return '';
    if (b <= a) {
      var p = Math.pow(10, Math.floor(Math.log(a || 1) / Math.LN10) - 1);
      b = a + (p > 0 ? p : 1);
    }
    if (!(a > 0)) return T.under.replace('{v}', function () { return fmtDisp(b); });
    return fmtDisp(a) + T.dash + fmtDisp(b);
  }

  /* 勤務の帯。★通貨ではないので換算も丸め直しもしない。
       刻みはサーバが固定で持っている（10時間 / 2日 / 2日）。 */
  function rngPlain(a) {
    return (a && a.length === 2) ? (String(a[0]) + T.dash + String(a[1])) : '';
  }

  /* 社ロゴ。airline-logos.js（window.PV_LOGOS）が「コード → 拡張子」を持っている。
     ★salary-leveling.js の logoHtml は流用しない。あちらはブランド色（a.color）を
       前提にしていて、salary-data.json はその色を持っていない（レベリング図が
       自前の表から引いている）。ここは色を使わない小さい版を持つ。
     ★alt="" にする。社名はすぐ隣に必ず文字で出るので、読み上げが二重になる。
       画像が落ちても行は読める。
     ★ロゴが無い社は、社名の頭2文字をグレーの札にする。
       ここで出るのは**画面が持っている辞書の社名**で、本人が打ち込んだ文字列ではない
       （サーバは打ち込まれた社名を返さない。語彙に当たらなかった人は 'other' で来る）。
     ★'other' だけは頭2文字を取らない。「一覧にない航空会社」の頭2文字は「一覧」で、
       会社の略称のように見えてしまう。ロゴが無いことを示す点だけを置く。 */
  function logoHtml(code) {
    var ext = (w.PV_LOGOS || {})[code];
    if (code !== 'other' && ext) {
      return '<img class="ap-logo" src="' + esc(LOGO_BASE + code + '.' + ext) + '"'
           + ' alt="" loading="lazy" decoding="async" width="30" height="30"/>';
    }
    var ini = '·';
    if (code !== 'other') {
      var name = String(airName(code) || '');
      ini = name.replace(/[^0-9A-Za-z\u3040-\u30ff\u4e00-\u9fff]/g, '').slice(0, 2).toUpperCase() || '·';
    }
    return '<span class="ap-logo ap-logo--mono" aria-hidden="true">' + esc(ini) + '</span>';
  }

  // ── 表 ─────────────────────────────────────────────────────────
  /* 打ち込みの正規化。大小と全角スペースを潰すだけ。
     ★語彙を舐めない。当たるのは「画面が持っている社名」だけで、
       本人が打ち込んだ社名はサーバから来ないので、ここに当てる相手が居ない。 */
  function norm(s) {
    return String(s == null ? '' : s).replace(/　/g, ' ').trim().toLowerCase();
  }
  function hitQ(code) {
    if (!S.fQ) return true;
    return norm(airName(code)).indexOf(S.fQ) >= 0 || norm(code).indexOf(S.fQ) >= 0;
  }

  function visibleRows() {
    if (!S.rows) return [];
    return S.rows.filter(function (r) {
      if (!hitQ(r.airline)) return false;
      if (S.fAir && r.airline !== S.fAir) return false;
      if (S.fPos && r.pos !== S.fPos) return false;
      return true;
    });
  }

  /* ══ 数え上げ（画面の上に並ぶ数字）═══════════════════════════════
     2026-08-24 オーナー判断で「本当の数字だけ出す」ことにした。
     ★カードは**3枚**（実給与の投稿 / 航空会社 / 1ヶ月以内の新規投稿）。
       ★2026-08-24、オーナー判断で「一覧のパイロット」の枚を外した。
         行数は表の下のページ送り（全N件中…）が言っているので二度言わない。
     ★1枚は rows を数えるだけ（新しく出て行くものはゼロ）。
       残り2枚は pv_pay_rows() の stats から来る。
     ★数が読めないカードは**そのカードごと出さない**。
       サーバがまだ古い（stats を返さない）ときは1枚だけ並ぶ。
       埋めるために 0 を置かない＝画面に嘘の数字を作らない。
     ★絞り込みでは動かさない。ここは「全体で今どれだけ集まっているか」で、
       絞った結果の話は下のページ送り（全N件中…）が持っている。 */

  /* カードの絵。★インラインの線画（currentColor）だけ。外部ファイルも
     アイコンフォントも読まない（この画面は増える読み込みを持たない）。
     色は CSS 側の --pv-orange-* が currentColor として降りてくる。 */
  var ICON = {
    // 書類（＝出された記録）
    rep: '<path d="M6 2.75h7.5L17.25 6.5v10.75a1 1 0 0 1-1 1h-10.25a1 1 0 0 1-1-1V3.75a1 1 0 0 1 1-1Z"/>'
       + '<path d="M13.25 2.75v4h4"/><path d="M8 10.5h5M8 13.5h3.5"/>',
    // 地球（＝航空会社の広がり）
    air: '<circle cx="10" cy="10" r="7.25"/><path d="M2.75 10h14.5"/>'
       + '<path d="M10 2.75c1.9 2 2.9 4.55 2.9 7.25S11.9 15.25 10 17.25C8.1 15.25 7.1 12.7 7.1 10S8.1 4.75 10 2.75Z"/>',
    // 右肩上がり（＝直近1ヶ月の増え方）
    mon: '<path d="M3 15.25 8 10l3 3 5.25-6.25"/><path d="M12.25 6.75h4.25V11"/>'
  };

  function icon(k) {
    return '<span class="ap-st-i" aria-hidden="true">'
         + '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor"'
         + ' stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false">'
         + ICON[k] + '</svg></span>';
  }

  function renderStats() {
    var box = el('ap-stats');
    if (!box) return;
    /* ★2026-08-25 オーナー判断。鍵が無い人にも「いまどれだけ集まっているか」を見せる。
         ⚠️ 見せるのは数だけ。行は1件も返っていないので、社数は自分では数えられない
         ── サーバーの数え上げ（stats.airlines）から取る。
         ★読めなかったカードは、そのカードごと出さない（0 を並べて嘘の数字を作らない）。 */
    var open = (S.mode === 'open' && S.rows && S.rows.length);
    if (!open && S.mode !== 'locked') { box.hidden = true; box.innerHTML = ''; return; }

    var st = S.stats || {};
    var airs;
    if (open) {
      var seen = {}; airs = 0;
      S.rows.forEach(function (r) {
        if (r.airline == null || seen[r.airline]) return;
        seen[r.airline] = 1; airs++;
      });
    } else {
      airs = (typeof st.airlines === 'number') ? st.airlines : null;
    }
    var cards = [
      { n: (typeof st.reports === 'number') ? st.reports : null, l: T.stRep, u: T.stRepU, i: 'rep' },
      { n: airs, l: T.stAir, u: T.stAirU, i: 'air' },
      { n: (typeof st.month === 'number') ? st.month : null, l: T.stMon, u: T.stMonU, i: 'mon' }
    ].filter(function (c) { return c.n != null; });

    if (!cards.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = cards.map(function (c) {
      return '<div class="ap-st">' + icon(c.i) + '<div class="ap-st-b">'
           + '<div class="ap-st-n">' + esc(String(c.n))
           + (c.u ? '<span class="ap-st-u">' + esc(c.u) + '</span>' : '')
           + '</div><div class="ap-st-l">' + esc(c.l) + '</div></div></div>';
    }).join('');
  }

  function renderRows() {
    var box = el('ap-rows');
    if (!box) return;

    /* ★まだ pv_pay_rows() を引けていない。骨組みのまま待つ。
       ここで描くと、辞書（社名・職位）が届いた時の描き直しで
       「まだありません」が一瞬出てから行が現れる。 */
    if (!S.mode) return;

    if (S.mode === 'locked') {
      /* ★ここに金額を1文字も出さない。鍵の無い人に数字を見せない、が
           この画面の一番外側の約束。 */
      box.innerHTML = lockScreen();
      renderFilters();
      renderStats();
      return;
    }
    if (S.mode === 'error') {
      box.innerHTML = msg('', T.errT, T.errS, '');
      renderFilters();
      renderStats();
      return;
    }

    renderFilters();
    var rows = visibleRows();
    if (!rows.length) {
      /* 絞り込みのせいで空なのか、そもそも1行も無いのかで言うことが違う。
         同じ文言にすると「まだ誰も出していない」と読める（嘘になる）。 */
      var filtered = !!(S.fAir || S.fPos || S.fQ);
      box.innerHTML = filtered ? msg('', T.fEmptyT, T.fEmptyS, '')
                               : msg('', T.emptyT, T.emptyS, T.emptyC);
      renderStats();
      return;
    }

    /* ★ページを直す位置はここ1か所だけ。絞り込みで行が減ったあとも必ず
         「行のあるページ」に居る＝押した先が空、という行き止まりが作れない。 */
    var pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
    if (S.page > pages) S.page = pages;
    if (S.page < 1) S.page = 1;
    var from = (S.page - 1) * PER_PAGE;
    var page = rows.slice(from, from + PER_PAGE);

    /* ★列は6つのまま（2026-09-03 に機材を出すことにしたが、7列目は作らない）。
         機材は職位の2行目に置く。列を足すと、横に溢れる幅・狭い画面での畳み方・
         骨組みの見出しの数が同時に動く。
       ★行は押せる（2026-09-03）。押すと右から1人ぶんの面が出る。
         ⚠️ <tr> に tabindex を置かない。読み上げが「表の行」を見失う。
            キーボードの入口は最後のセルの › のボタン1つだけ。
       ★見出しは文字だけ。押せる見出し（＝並べ替え）を作らない。 */
    var h = '<div class="ap-tw"><div class="ap-tscroll"><table class="ap-tbl">'
          + '<thead><tr><th>' + esc(T.thAir) + '</th><th>' + esc(T.thPos) + '</th>'
          + '<th class="ap-num">' + esc(T.thAmt) + '</th>'
          + '<th class="ap-num">' + esc(T.thMon) + '</th>'
          + '<th>' + esc(T.thVf) + '</th>'
          + '<th>' + esc(T.thAge) + '</th></tr></thead><tbody>';
    for (var i = 0; i < page.length; i++) {
      var r = page[i];
      var fl = fleetName(r.fleet);
      h += '<tr class="ap-r" data-ap-row="' + esc(String(r._i)) + '">'
         + '<td><span class="ap-cell-air">' + logoHtml(r.airline)
         +   '<span class="ap-air">' + esc(airName(r.airline)) + '</span></span>'
         +   hintHtml(r)
         + '</td>'
         /* ★機材は職位の2行目。7列目を作らない（上のコメント）。
              語彙に無い行・そもそも機材の無い行（口コミ由来）は、その1行が黙って空く。 */
         + '<td><span class="ap-pos">' + esc(posName(r.pos)) + '</span>'
         +   (fl ? '<span class="ap-flt">' + esc(fl) + '</span>' : '')
         + '</td>'
         + '<td class="ap-num"><span class="ap-amt">' + esc(money(r.annual_usd)) + '</span></td>'
         /* ★月あたりは画面の年収を12で割っただけ。新しい情報は1つも増えていない。 */
         + '<td class="ap-num"><span class="ap-mon">' + esc(moneyMonth(r.annual_usd)) + '</span></td>'
         + '<td>' + (r.verified ? vfMark() : '<span class="ap-vf-no">' + esc(T.vfNo) + '</span>') + '</td>'
         /* ★投稿時期。サーバから来るのは 0〜4 の段の番号だけ。
              段が読めない行（古いサーバ）は空欄にする＝そこだけ黙って空く。
            ★› は**文字**で描く。絵にすると表の中の svg が1つ増えて、
              「棒グラフを描き直した人が居ないか」を見ている検査に当たる。
            ★hover しなくても最初から見えている。押せることが hover でしか
              分からない画面にしない（触る端末には hover が無い）。 */
         + '<td><span class="ap-age">' + esc(ageName(r.age)) + '</span>'
         +   '<button type="button" class="ap-go" aria-label="' + esc(openLabel(r))
         +   '">\u203a</button>'
         + '</td>'
         + '</tr>';
    }
    h += '</tbody></table></div>' + pager(rows.length, pages) + '</div>';

    /* ★表は幅いっぱい。図は無い（2026-08-24 に外した）。
       ★ foot（何が載っていないかの1文）は表の下。あれは説明ではなく約束で、
         消すと「機種はどこ？」に答えるものが画面から無くなる。 */
    box.innerHTML = h + '<p class="ap-foot">' + esc(T.foot) + '</p>';
    renderStats();
  }

  /* hover の1行（2026-09-03。オーナーの §2）。
     ★出すのは**予告だけ** ── 在籍の段と、押した先に何があるか。
       基本給の額も乗務時間の数も、ここには1文字も出さない。
     ★<tr> を増やさない。行数を数えている検査が4か所にあり、2本目の行を
       差し込むとその4本がまとめて落ちる。セルの中で高さ 0 → 1行に開く。
     ★触る端末には hover が無い。だから機材も › も最初から見えていて、
       ここが出なくても押す道は塞がらない。 */
  function hintHtml(r) {
    var b = [], t = tenName(r);
    if (t) b.push(t);
    /* ★閉じている行にも出す。これは一覧の札と同じ情報で、金額は1円も含まない
         （オーナーの §16 ── 予告としてのぼかしは可、実数を DOM に置くのは不可）。 */
    if ((r.pay && r.pay.length) || r.paylock) b.push(T.hintComp);
    if (r.work) b.push(T.hintWork);
    b.push(T.hintGo);
    return '<span class="ap-hint"><span class="ap-hint-i">'
         + esc(b.join(' \u00b7 ')) + '</span></span>';
  }

  /* › のボタンの読み上げ。★社名と職位だけ。金額を読ませない。
     ⚠️ replace の新しい側は関数で渡す（社名に $ が入りうる）。 */
  function openLabel(r) {
    return T.dwOpen
      .replace('{air}', function () { return airName(r.airline); })
      .replace('{pos}', function () { return posName(r.pos); });
  }

  /* ページ番号の並び。多くなったら真ん中を … で畳む（1 2 3 … 13）。 */
  function pageList(cur, n) {
    var out = [], i;
    if (n <= 7) { for (i = 1; i <= n; i++) out.push(i); return out; }
    out.push(1);
    var a = Math.max(2, cur - 1), b = Math.min(n - 1, cur + 1);
    if (cur <= 3) { a = 2; b = 4; }
    if (cur >= n - 2) { a = n - 3; b = n - 1; }
    if (a > 2) out.push('…');
    for (i = a; i <= b; i++) out.push(i);
    if (b < n - 1) out.push('…');
    out.push(n);
    return out;
  }

  /* ページ送り。★2026-08-24、オーナー判断で件数を出すことにした
     （出した人に「今どれだけ集まっているか」が見えないと Give & Get が成立しない）。
     出すのは**絞り込んだ後の行数**で、絞り込みを解いた数＝上のカードが持っている。 */
  function pager(total, pages) {
    var from = (S.page - 1) * PER_PAGE;
    var to = Math.min(total, from + PER_PAGE);
    var lbl = T.pgRange.replace('{n}', () => String(total))
                       .replace('{a}', () => String(from + 1))
                       .replace('{b}', () => String(to));
    var h = '<div class="ap-pager"><span class="ap-pg-n">' + esc(lbl) + '</span>';
    if (pages >= 2) {
      h += '<div class="ap-pgs">'
         + '<button type="button" class="ap-pg" data-ap-page="' + (S.page - 1) + '"'
         + (S.page <= 1 ? ' disabled' : '') + '>' + esc(T.pgPrev) + '</button>';
      pageList(S.page, pages).forEach(function (p) {
        if (p === '…') { h += '<span class="ap-pg-e">…</span>'; return; }
        h += '<button type="button" class="ap-pg ap-pg--n" data-ap-page="' + p + '"'
           + (p === S.page ? ' aria-current="page"' : '') + '>' + p + '</button>';
      });
      h += '<button type="button" class="ap-pg" data-ap-page="' + (S.page + 1) + '"'
         + (S.page >= pages ? ' disabled' : '') + '>' + esc(T.pgNext) + '</button>'
         + '</div>';
    }
    return h + '</div>';
  }

  function vfMark() {
    return '<span class="ap-vf"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"'
         + ' stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"'
         + ' aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>Verified</span>';
  }

  /* ══ 行を押すと出る面（2026-09-03）══════════════════════════════
     骨は pv-conditions.js のモーダルと同じ ── その場で作り、閉じたら消す。
     ⚠️ **サーバへは1本も投げない。** 一覧を引いたときの行に全部入っている。
        ここで引き直すと「誰がどの行を開いたか」がサーバの記録に残る。
     ⚠️ 閉じたら DOM から**消す**。開いていない間、他人の帯が1文字も
        画面に残っていないこと（毒の検査がそのまま生きる）。
     ⚠️ 見出しは h3。この画面の h2 は 0 のままにする。
     ⚠️ ぼかさない。渡っていないものは隠す必要が無い。
     ★クラスは ap-dw* だけを使う。ap-panel / ap-cols / ap-main / ap-side /
       ap-bar / ap-viz は「消したもの」として字で禁じられている。
     ══════════════════════════════════════════════════════════════ */
  var DW = null;      // 開いていれば { back, box, i, prevFocus, prevOverflow, onKey }

  /* 行の番号 → 行。★ページ送りでも絞り込みでも変わらない番号を使う
       （サーバから受け取った順に振ってある）。 */
  function rowOf(i) {
    var rs = S.rows || [];
    for (var k = 0; k < rs.length; k++) if (rs[k]._i === i) return rs[k];
    return null;
  }

  function segName(k) { return (T.seg && T.seg[k]) || k; }

  /* 区分の色を引くクラス。色そのものは actual-pay.css の .ap-dw-c-<鍵>。
     ★色は**並び順ではなく区分そのもの**に付く（2026-09-03 その2・オーナー指示）。
       はじめ橙1色の濃淡にしたが「オレンジだけじゃわかりづらい」。
       多色にすると、行を次々に押したとき同じ項目が必ず同じ色になる利得もある。
     ★色の出どころは pay-viz.js の SEG。DEEP PAY のドーナツ・マイレポートと
       同じ項目が同じ色になる（オーナー確定 2026-08-29）。
       ⚠️ ここからあのファイルを読み込まない。あれはドーナツ一式で、
          この画面に図は戻さないと決めてある。色は CSS に写してあり、
          ズレは assert-pay-rows.mjs が突き合わせて落とす。
     ⚠️ サーバから来た鍵をそのまま class に流さない。T.seg（名前の表）が
        白名簿を兼ねる ── 知らない語が来たら灰（未分類）に落とす。 */
  function segCls(k) {
    return 'ap-dw-c-' + (T.seg && T.seg[k] ? k : 'rest');
  }

  /* 帯の中点。★画面に出ている両端を、出ているとおりに足して2で割るだけ。
       rngMoney と同じ持ち上げ方をするので、「$95K〜$100K」と書かれた行の中点は
       必ず 97.5K になる ── 読んだ人が同じ計算をすれば同じ数が出る。
     ★下端 0 の帯（サーバが畳んだ合図・画面には「◯ 未満」と出る）の中点は上端の半分。 */
  function segMid(p) {
    var a = disp(p.r[0]), b = disp(p.r[1]);
    if (a === null || b === null) return 0;
    if (b <= a) {
      var q = Math.pow(10, Math.floor(Math.log(a || 1) / Math.LN10) - 1);
      b = a + (q > 0 ? q : 1);
    }
    return (a + b) / 2;
  }

  /* 報酬の内訳（2026-09-03 改）。
     ★1本の積み上げバーで「その人の報酬を、どの区分がどれくらい占めているか」を出す。
       前は行ごとに横棒を1本ずつ描いていたが、あれは**帯の下端から上端まで**で、
       長さ＝金額の大小には読めない（説明しないと読めないものは、ここに置かない）。
     ★長さは**画面に出ている帯の中点**から出し、中点の合計で割る。
       中点は両端2つの割り算でしかなく、サーバが返していない数を画面が作ってはいない。
     ⚠️ ％の数字を1つも出さない。帯の刻みでは「68.3%」のような数は作れないし、
        割合を出すと帯の中の本当の位置が逆算できる。だから「おおよその構成」として
        長さだけを見せ、下に必ず概算だと1行置く。
     ⚠️ 長さは % ではなく flex の伸び率で置く（100 倍も % の字も要らない）。
     ★色は区分ごと（segCls）。並び順ではなく項目そのものに付くので、
       行を次々に押しても同じ項目は同じ色のまま。
       ⚠️ 多色にしたが**ドーナツを戻したのではない**。出すのは1本の帯だけ。
     ★0 の区分はサーバが落としている。ここで 0 を足して枠を埋めない。 */
  function payHTML(r) {
    /* ★閉じている行。サーバが返しているのは paylock ── 区分の**名前だけ**
         （区分が1つしか無い行は真偽1つ）。金額は1円も来ていない。 */
    if (r.paylock) return payLockHTML(r.paylock);
    if (!r.pay || !r.pay.length) return '';

    var mid = r.pay.map(segMid), wsum = 0;
    mid.forEach(function (m) { wsum += m; });

    /* 区分が1つだけなら、バーは1色で埋まるだけ＝何も言っていない。出さない。 */
    var bar = '';
    if (r.pay.length > 1 && wsum > 0) {
      bar = '<div class="ap-dw-st" aria-hidden="true">'
          + r.pay.map(function (p, k) {
              return '<span class="ap-dw-sti ' + segCls(p.k)
                   + '" style="flex:' + (mid[k] / wsum).toFixed(4) + ' 1 0"></span>';
            }).join('')
          + '</div>'
          + '<p class="ap-dw-stn">' + esc(T.dwShare) + '</p>';
    }

    /* 一覧。★丸はバーと同じ色・同じ並び。凡例を別に置かないための印。 */
    var li = r.pay.map(function (p) {
      return '<li class="ap-dw-row">'
        + '<span class="ap-dw-k">'
        +   (bar ? '<i class="ap-dw-dot ' + segCls(p.k) + '" aria-hidden="true"></i>' : '')
        +   esc(segName(p.k)) + '</span>'
        + '<span class="ap-dw-v">' + esc(rngMoney(p.r[0], p.r[1])) + '</span></li>';
    }).join('');

    return '<h3 class="ap-dw-h">' + esc(T.dwComp) + '</h3>'
         + bar
         + '<ul class="ap-dw-list">' + li + '</ul>';
  }

  /* 閉じている「報酬の内訳」（2026-09-03 その3・オーナー指示
       「色付きの棒グラフと項目名までは出す。金額だけ隠す」）。

     ★描けるのは **区分の名前だけ**。サーバ（pv_pay_rows）が閉じている行に
       入れているのは paylock ── 名前の配列か、真偽1つのどちらか。
       **金額も帯（下端・上端）も1つも来ていない。** ここで r.pay を読まない。
       rngMoney / segMid をこの関数から呼ばない（呼べる材料が無い）。
     ★幅は**全員同じ**（CSS の :nth-child が持つ）。その人の割合ではない。
       割合を出すと、面に出ている年収と掛け算するだけで金額が戻る。
     ★並びはサーバが組んだ固定順のまま触らない。大きい順に並べ替えると
       「変動給 > 基本給」という順位が、数字を1文字も書かずに漏れる。
     ★区分が1つだけの行（paylock === true）は名前も来ない。
       1つ＝その区分が内訳のほぼ全部で、名前だけで金額が読めてしまうため。
       その行は今までどおりの灰色の骨組みを描く。
     ⚠️ 金額の板（.ap-dw-lk-p2）は**空**。ぼかしは「置いた数字を霞ませる」の
        ではなく、**何も無い板の質感**でしかない。ここに数字を入れない
        （assert-pay-rows.mjs が、毒を仕込んだ行を開いて面に数字が
         1文字も出ないことを実測している）。
     ⚠️ サーバから来た語をそのまま class に流さない。T.seg が白名簿。 */
  function payLockHTML(keys) {
    var ks = [];
    if (keys && keys.length && typeof keys !== 'boolean') {
      for (var n = 0; n < keys.length; n++) {
        if (typeof keys[n] === 'string' && T.seg && T.seg[keys[n]]) ks.push(keys[n]);
      }
    }
    /* 名前が2つに満たなければ骨組みへ落とす（1区分の行・知らない語だけの行）。 */
    var real = ks.length > 1;
    var i, bar = '', li = '';

    if (real) {
      for (i = 0; i < ks.length; i++) {
        bar += '<span class="ap-dw-sti ap-dw-lk-s ' + segCls(ks[i]) + '"></span>';
      }
      for (i = 0; i < ks.length; i++) {
        li += '<li class="ap-dw-row ap-dw-lk-r is-real">'
            + '<span class="ap-dw-k">'
            +   '<i class="ap-dw-dot ' + segCls(ks[i]) + '" aria-hidden="true"></i>'
            +   esc(segName(ks[i])) + '</span>'
            + '<span class="ap-dw-lk-p ap-dw-lk-p2" aria-hidden="true"></span></li>';
      }
    } else {
      for (i = 0; i < 4; i++) bar += '<span class="ap-dw-sti ap-dw-lk-s"></span>';
      for (i = 0; i < 3; i++) {
        li += '<li class="ap-dw-row ap-dw-lk-r">'
            + '<span class="ap-dw-lk-p"></span>'
            + '<span class="ap-dw-lk-p ap-dw-lk-p2"></span></li>';
      }
    }

    return '<h3 class="ap-dw-h">' + esc(T.dwComp) + '</h3>'
      + '<div class="ap-dw-st ap-dw-lk-b' + (real ? ' is-real' : '')
      +   '" aria-hidden="true">' + bar + '</div>'
      + '<ul class="ap-dw-list ap-dw-lk-l"' + (real ? '' : ' aria-hidden="true"')
      +   '>' + li + '</ul>'
      + '<div class="ap-dw-lk">'
      +   '<p class="ap-dw-lk-t">' + esc(T.lockPT) + '</p>'
      +   '<p class="ap-dw-lk-s2">' + esc(T.lockPS) + '</p>'
      +   '<a class="ap-dw-cta ap-dw-lk-c" data-ap-detail="1" href="'
      +     DETAIL_URL + '">' + esc(T.lockPC) + '</a>'
      + '</div>';
  }

  /* 押した行を覚えておく（戻ってきたときに同じ面を開くため）。 */
  function saveBack(r) {
    if (!r) return;
    try {
      w.sessionStorage.setItem(RP_BACK, JSON.stringify(
        { a: r.airline, p: r.pos, v: r.annual_usd }));
    } catch (e) {}
  }

  /* 戻ってきた人の面を1回だけ開き直す。
     ★開けても開けなくても鍵は消す。残すと、次にこの画面へ来ただけで勝手に開く。
     ★行が別のページに居るなら、そのページへ送ってから開く
       （閉じたときに、押した行がその場に無いと迷子になる）。 */
  function reopenBack() {
    var raw = null;
    try { raw = w.sessionStorage.getItem(RP_BACK); } catch (e) { raw = null; }
    if (!raw) return;
    try { w.sessionStorage.removeItem(RP_BACK); } catch (e) {}
    var b = null;
    try { b = JSON.parse(raw); } catch (e) { b = null; }
    if (!b) return;
    var rs = S.rows || [], hit = null, k;
    for (k = 0; k < rs.length; k++) {
      if (rs[k].airline === b.a && rs[k].pos === b.p && rs[k].annual_usd === b.v) {
        hit = rs[k]; break;
      }
    }
    if (!hit) return;
    var vis = visibleRows();
    for (k = 0; k < vis.length; k++) {
      if (vis[k] === hit) {
        var p = Math.floor(k / PER_PAGE) + 1;
        if (p !== S.page) { S.page = p; renderRows(); }
        break;
      }
    }
    openDrawer(hit._i);
  }

  /* 勤務。★3つだけ（乗務時間・乗務日数・休日）。
       便数・ステイ日数・拘束時間を足さない ── 重ねるほど1人に当たる。 */
  function workHTML(r) {
    if (!r.work) return '';
    var li = ['bh', 'dd', 'off'].filter(function (k) { return r.work[k]; })
      .map(function (k) {
        return '<li class="ap-dw-row ap-dw-row--w">'
          + '<span class="ap-dw-k">' + esc(T.wk[k]) + '</span>'
          + '<span class="ap-dw-v">' + esc(rngPlain(r.work[k]))
          + '<span class="ap-dw-u">' + esc(T.wkU[k]) + '</span></span></li>';
      }).join('');
    return li ? ('<h3 class="ap-dw-h">' + esc(T.dwWork) + '</h3>'
               + '<ul class="ap-dw-list">' + li + '</ul>') : '';
  }

  /* 同じ会社・同じ職位のほかの記録。★S.rows から作る（サーバに投げない）。
       0件なら節ごと出さない（空の枠を並べない）。 */
  function simHTML(r) {
    var sim = (S.rows || []).filter(function (x) {
      return x !== r && x.airline === r.airline && x.pos === r.pos;
    }).slice(0, 5);
    if (!sim.length) return '';
    return '<h3 class="ap-dw-h">' + esc(T.dwSim) + '</h3><div class="ap-dw-sims">'
      + sim.map(function (x) {
          var b = [fleetName(x.fleet), tenName(x)].filter(Boolean);
          return '<button type="button" class="ap-dw-sim" data-ap-row="'
            + esc(String(x._i)) + '">'
            + '<span class="ap-dw-simv">' + esc(money(x.annual_usd)) + '</span>'
            + (b.length ? '<span class="ap-dw-simm">' + esc(b.join(' · ')) + '</span>' : '')
            + '</button>';
        }).join('') + '</div>';
  }

  function dwHTML(r) {
    var meta = [posName(r.pos)];
    var fl = fleetName(r.fleet); if (fl) meta.push(fl);
    var tn = tenName(r);         if (tn) meta.push(tn);

    var bd = payHTML(r), work = workHTML(r), miss = '';
    /* ★無いものは節ごと出さない。そのうえで「なぜ空いているのか」を1文で言う
         ── 押した先が黙って短いと、隠されたように読める。
       ★ここで作り話の 0 や「—」を置かない（オーナーの §11）。 */
    if (!bd && !work) miss = T.dwOnly;
    else if (!bd)     miss = T.dwNoComp;
    else if (!work)     miss = T.dwNoWork;

    return '<div class="ap-dw-top">'
      + '<div class="ap-dw-air">' + logoHtml(r.airline)
      +   '<span class="ap-dw-name" id="ap-dw-t">' + esc(airName(r.airline)) + '</span></div>'
      + '<button type="button" class="ap-dw-x" data-ap-close="1" aria-label="'
      +   esc(T.dwClose) + '">×</button>'
      + '</div>'
      + '<p class="ap-dw-meta">' + esc(meta.join(' · ')) + '</p>'
      + '<div class="ap-dw-amt">'
      +   '<div class="ap-dw-a"><span class="ap-dw-al">' + esc(T.dwYear) + '</span>'
      +     '<span class="ap-dw-av">' + esc(money(r.annual_usd)) + '</span></div>'
      +   '<div class="ap-dw-a"><span class="ap-dw-al">' + esc(T.dwMonth) + '</span>'
      +     '<span class="ap-dw-av">' + esc(moneyMonth(r.annual_usd)) + '</span></div>'
      + '</div>'
      + '<p class="ap-dw-src">'
      +   (r.verified ? vfMark() : '<span class="ap-vf-no">' + esc(T.vfNo) + '</span>')
      +   '<span class="ap-dw-age">' + esc(ageName(r.age)) + '</span></p>'
      + bd + work
      + (miss ? '<p class="ap-dw-miss">' + esc(miss) + '</p>' : '')
      + simHTML(r)
      /* ★主 ── 他社と比べる。DEEP PAY はまだ錠前が掛かっているので、リンクではなく
           左メニューと**まったく同じ門**（pv-gates.js の説明パネル）を開く。
           門の部品が読めていなければ**この行ごと出さない** ── 押しても何も起きない
           ボタンを置かない。下の副 CTA は必ず残るので、面が行き止まりにはならない。 */
      + (hasGate()
          ? '<button type="button" class="ap-dw-cta" data-ap-gate="deep">'
            + esc(T.dwGo) + '</button>'
          : '')
      /* ★副 ── 出す側へ戻す。消さずに順位だけ下げる。 */
      + '<a class="ap-dw-cta2" href="' + PAY_URL + '">' + esc(T.dwCta) + '</a>'
      + '<p class="ap-dw-note">' + esc(T.dwNote) + '</p>';
  }

  function hasGate() { return !!(w.PVGates && w.PVGates.open); }

  /* 面を閉じてから門を開く。
     ⚠️ 順番を逆にしない。門のパネルは .mr-main の**先頭**に入るので、面が開いたままだと
        覆いの裏に出る。面のフォーカストラップとも喧嘩する。
     ⚠️ 待つのは面が滑り終わるのと同じ長さ。閉じ終わりに居場所を一覧へ戻す仕掛けが
        動くので、そこへ門が割り込むと開いた直後に焦点を奪われる（だから戻さない指定で閉じる）。 */
  function toDeep() {
    if (!hasGate()) return;
    closeDrawer(true);
    w.setTimeout(function () { if (w.PVGates && w.PVGates.open) w.PVGates.open('deep'); }, 340);
  }

  /* focus を奪うのは「開いたとき」と「類似を押して中身が入れ替わったとき」だけ。
     ⚠️ 通貨を切り替えたときも描き直すので、そこで × に飛ぶと
        ヘッダーの通貨ボタンから指が離れる。だから keepFocus で分ける。 */
  function paintDrawer(keepFocus) {
    if (!DW) return;
    var r = rowOf(DW.i);
    if (!r) { closeDrawer(); return; }
    var sc = DW.box.parentNode;                 // 巻き取るのは .ap-dw のほう
    var y = keepFocus && sc ? sc.scrollTop : 0;
    DW.box.innerHTML = dwHTML(r);
    if (sc) sc.scrollTop = y;
    if (keepFocus) return;
    /* ★居場所は**面そのもの**へ。× に飛ばすと :focus-visible が光って、
         開いた瞬間いちばん目立つのが「閉じる」になる（2026-09-03 に直した）。
       ★tabindex="-1" なので、上の dwTrap の拾い方（-1 は除く）には混ざらない。 */
    try { if (sc && sc.focus) sc.focus({ preventScroll: true }); } catch (e) {
      try { sc.focus(); } catch (e2) {}
    }
  }

  /* フォーカスを面の中から出さない（背後の表へ Tab で抜けない）。 */
  function dwTrap(e) {
    if (!DW) return;
    var f = DW.back.querySelectorAll(
      'button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openDrawer(i, trigger) {
    if (!rowOf(i)) return;
    /* すでに開いているなら**中身だけ差し替える**（開き直さない）。
       類似の記録を押したときに、面が一度閉じてまた開くと居場所を見失う。 */
    if (DW) { DW.i = i; paintDrawer(); return; }

    var back = d.createElement('div');
    back.className = 'ap-dw-back';
    /* ★tabindex="-1" ── 開いたときの居場所をここに置くため。Tab の順番には入らない。 */
    back.innerHTML = '<aside class="ap-dw" role="dialog" aria-modal="true" tabindex="-1"'
                   + ' aria-labelledby="ap-dw-t"><div class="ap-dw-b"></div></aside>';
    DW = { back: back, box: back.querySelector('.ap-dw-b'), i: i, from: i, down: false,
           prevFocus: trigger || d.activeElement,
           prevOverflow: d.body.style.overflow };

    /* 閉じ方は3つ（× ・背景 ・ESC）。
       ★背景は mousedown で印を立て click で二重に確かめる。
         面の中で押して外で指を離したときに閉じない（pv-conditions.js と同じ）。 */
    back.addEventListener('mousedown', function (e) {
      if (DW && e.target === back) DW.down = true;
    });
    back.addEventListener('click', function (e) {
      if (!DW) return;
      if (e.target === back) {
        var was = DW.down; DW.down = false;
        if (was) closeDrawer();
        return;
      }
      DW.down = false;
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('[data-ap-close]')) { closeDrawer(); return; }
      /* ★門のボタン ── 戻り先を置くだけ。**止めない**（そのままリンクが飛ぶ）。
           preventDefault して自分で location を書くと、真ん中クリックや
           「新しいタブで開く」が効かなくなる。 */
      if (t.closest('[data-ap-detail]')) { saveBack(rowOf(DW.i)); return; }
      if (t.closest('[data-ap-gate]')) { toDeep(); return; }
      var sm = t.closest('[data-ap-row]');
      if (sm) { DW.i = Number(sm.getAttribute('data-ap-row')); paintDrawer(); }
      return;
    });
    DW.onKey = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeDrawer(); return; }
      if (e.key === 'Tab') dwTrap(e);
    };
    d.addEventListener('keydown', DW.onKey, true);

    d.body.appendChild(back);
    d.body.style.overflow = 'hidden';
    paintDrawer();
    if (w.requestAnimationFrame) {
      w.requestAnimationFrame(function () { if (DW) DW.back.classList.add('is-in'); });
    } else back.classList.add('is-in');
  }

  /* noFocus ＝ 閉じたあと居場所を一覧へ戻さない。
     ★門を開くときだけ true。戻すと、門が focus を取った直後に一覧へ引き戻される。 */
  function closeDrawer(noFocus) {
    if (!DW) return;
    var x = DW; DW = null;
    d.removeEventListener('keydown', x.onKey, true);
    d.body.style.overflow = x.prevOverflow || '';
    x.back.classList.remove('is-in');
    /* ★消すのは滑り終わってから。**必ず消す** ── 残すと、閉じているのに
         他人の帯が DOM に居座る。 */
    w.setTimeout(function () {
      if (x.back.parentNode) x.back.parentNode.removeChild(x.back);
      if (noFocus) return;
      try {
        var f = x.prevFocus;
        /* ★押したボタンが DOM から居なくなっていることがある ── 面を開いたまま
             通貨を切り替えると、表を作り直すので中のボタンは全部作り直される。
             そのときは**開いたときの行の ›** を探し直す。
             探し直さないと、閉じた瞬間に居場所を失って一覧の先頭へ飛ばされる
             （キーボードだけで読む人には、そこから読み直しになる）。 */
        if (!(f && d.contains(f))) {
          var tr = d.querySelector('#ap-rows [data-ap-row="' + x.from + '"]');
          f = tr ? tr.querySelector('.ap-go') : null;
        }
        if (f && f.focus) f.focus();
      } catch (e) {}
    }, 320);
  }

  function msg(kind, t, s, cta, extra) {
    return '<div class="ap-msg' + (kind === 'lock' ? ' ap-msg--lock' : '') + '">'
         + '<div class="ap-msg-t">' + esc(t) + '</div>'
         + '<p class="ap-msg-s">' + esc(s) + '</p>'
         + (extra || '')
         + (cta ? '<a class="ap-cta" href="' + PAY_URL + '">' + esc(cta) + '</a>' : '')
         + '</div>';
  }

  /* Give → Get の3段。★ここに書き写さない。左メニューの説明パネルと
     まったく同じ部品（pv-gates.js）を借りる。読めていなければ何も出さない
     ＝ 見出し・本文・CTA だけの今までの形に戻るだけで、画面は壊れない。 */
  function giveGet() {
    return (w.PVGates && w.PVGates.giveGetHTML) ? w.PVGates.giveGetHTML() : '';
  }

  /* 錠前の小さな絵。文字の横に置く用。 */
  var LOCK_I =
    '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor"'
    + ' stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'
    + ' aria-hidden="true" focusable="false">'
    + '<rect x="4.25" y="8.6" width="11.5" height="8.15" rx="2.2"/>'
    + '<path d="M7 8.6V6.4a3 3 0 0 1 6 0v2.2"/></svg>';

  /* ロックのときだけ出す飾りの絵。
     ⚠️ これは**分布図ではない**。.ap-viz / .ap-plot / .ap-bar は1つも使わない。
        描いているのはこの画面の形そのもの ── 1行＝1人が並んだ一覧に錠前が掛かっている絵。
     ★インラインの線画（currentColor）。外部ファイルもアイコンフォントも読まない。 */
  var LOCK_ART =
    '<svg class="ap-lock-art" viewBox="0 0 200 168" width="200" height="168" fill="none"'
    + ' stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"'
    + ' aria-hidden="true" focusable="false">'
    + '<rect x="83" y="20" width="34" height="26" rx="7"/>'
    + '<path d="M91 20v-6a9 9 0 0 1 18 0v6"/>'
    + '<path d="M100 30v6"/>'
    + '<rect x="16" y="58" width="168" height="94" rx="16"/>'
    + '<circle cx="42" cy="84" r="8"/><path d="M60 80h46"/><path d="M60 89h28"/>'
    + '<path d="M138 84h30"/>'
    + '<circle cx="42" cy="110" r="8"/><path d="M60 106h38"/><path d="M60 115h22"/>'
    + '<path d="M138 110h30"/>'
    + '<circle cx="42" cy="136" r="8"/><path d="M60 132h50"/><path d="M60 141h30"/>'
    + '<path d="M138 136h30"/>'
    + '</svg>';

  /* 骨組みの1行。★灰色の棒だけ。数字も社名も1文字も入れない。 */
  function skelRow() {
    var out = '<div class="ap-skel-r">';
    for (var i = 0; i < 6; i++) out += '<span class="ap-skel-bar"></span>';
    return out + '</div>';
  }

  /* 鍵が無い人の画面（2026-08-25）。
     ⚠️ 骨組みは**ぼかしではない**。隠しているのではなく、サーバーが行を返していないので
        中身が最初から無い。blur / filter のたぐいは1文字も書かない。
     ★3段の Give → Get は pv-gates.js から借りる。ここに書き写さない。 */
  function lockScreen() {
    var hero =
      '<div class="ap-msg ap-msg--lock ap-lockhero">'
      + '<div class="ap-lockhero-b">'
      +   '<div class="ap-msg-t">' + esc(T.lockT) + '</div>'
      +   '<p class="ap-msg-s">' + esc(T.lockS) + '</p>'
      +   '<p class="ap-msg-s">' + esc(T.lockS2) + '</p>'
      +   giveGet()
      +   '<a class="ap-cta" href="' + PAY_URL + '">' + esc(T.lockC) + '</a>'
      +   '<p class="ap-lock-n">' + esc(T.lockN) + '</p>'
      + '</div>'
      + '<div class="ap-lockhero-a" aria-hidden="true">' + LOCK_ART + '</div>'
      + '</div>';

    /* ★列は実物と同じ6つ。賞与の列は無い（この画面に賞与は無い）。
         見出しの字も実物のまま ── 注記のカッコを足さない。 */
    var ths = [T.thAir, T.thPos, T.thAmt, T.thMon, T.thVf, T.thAge];
    var skel =
      '<section class="ap-lock-skel">'
      + '<h2 class="ap-lock-h">' + esc(T.skelT) + '</h2>'
      + '<div class="ap-skel">'
      +   '<div class="ap-skel-hd" aria-hidden="true">'
      +     ths.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('')
      +   '</div>'
      +   '<div class="ap-skel-body">'
      +     skelRow() + skelRow() + skelRow() + skelRow() + skelRow()
      +     '<p class="ap-skel-lock">' + LOCK_I + '<span>' + esc(T.skelL) + '</span></p>'
      +   '</div>'
      + '</div>'
      + '</section>';

    var see =
      '<section class="ap-lock-see">'
      + '<h2 class="ap-lock-h">' + esc(T.seeT) + '</h2>'
      + '<ul class="ap-see">'
      +   T.see.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('')
      + '</ul>'
      + '<p class="ap-see-n">' + LOCK_I + '<span>' + esc(T.seeN) + '</span></p>'
      + '</section>';

    /* ⚠️ 2段組の目印は .ap-lock-cols / .ap-lock-aside。
         .ap-cols / .ap-main / .ap-side は開いている画面から外したもので、
         assert-pay-rows.mjs が字として禁じている。 */
    return hero
         + '<div class="ap-lock-cols">' + skel
         + '<div class="ap-lock-aside">' + see + '</div></div>';
  }

  // ── 絞り込み ───────────────────────────────────────────────────
  function opt(v, label, cur) {
    return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>'
         + esc(label) + '</option>';
  }

  /* 選べるのは**実際に行がある区分だけ**。語彙を丸ごと並べない。
     無いものを並べると「選んだのに何も出ない」が「隠されている」に見えるし、
     112社のプルダウンは8行の表には大きすぎる。

     ★段を下るほど絞る（会社 → 職位）。上の段は絞らない
       ＝ 会社を選んだあとでも、別の会社に移れる。
     ★機材で絞る口は置かない（列に出していないものを絞れると逆算できる）。 */
  function listOf(key, name, pre) {
    var seen = {}, out = [];
    (S.rows || []).forEach(function (r) {
      if (!pre(r)) return;
      var v = r[key];
      if (v == null || seen[v]) return;
      seen[v] = 1;
      out.push({ v: v, label: name(v) });
    });
    out.sort(function (a, b) { return a.label.localeCompare(b.label, L); });
    return out;
  }

  function fill(id, list, cur) {
    var s = el(id);
    if (!s) return;
    s.innerHTML = opt('', T.all, cur) + list.map(function (o) {
      return opt(o.v, o.label, cur);
    }).join('');
  }

  function renderFilters() {
    var bar = el('ap-filter');
    /* 行が1つも無いとき（鍵が無い・エラー・本当に0件）は帯ごと隠す。
       空のプルダウンが3つ並ぶと、何かを隠しているように見える。 */
    var has = !!(S.rows && S.rows.length);
    if (bar) bar.hidden = !has;
    if (!has) { S.fAir = ''; S.fPos = ''; S.fQ = ''; return; }

    /* ★打ち込みは会社のプルダウンにも効く。打った先に残る会社だけが選択肢になる
         ＝「選べるのに0件」がここでも起きない。 */
    fill('ap-air', listOf('airline', airName, function (r) { return hitQ(r.airline); }), S.fAir);
    fill('ap-pos', listOf('pos', posName, function (r) {
      return hitQ(r.airline) && (!S.fAir || r.airline === S.fAir);
    }), S.fPos);
  }

  function render() { renderRows(); }

  /* 別の <script> が宣言した const sb を読む。宣言前に呼ばれると
     ReferenceError になるので、必ず try で包んだ側から呼ぶ。 */
  function sb0() { return sb; }

  // ── 起動 ───────────────────────────────────────────────────────
  function boot() {
    var head = el('ap-hd');
    if (head) {
      /* ★見出しは社名も説明も札も付けない、ただの1行にする（オーナー判断 2026-08-24）。
         以前ここに「本人記録」の橙の札を置いていたが、**行ごとの出典と食い違う**。
         明細の裏付けがある行は 出典 が ✓ Verified になるので、
         画面の上で「この画面は全部が本人の記録」と言い切ると、そこだけ嘘になる。
         出典は行ごとに 出典 の列が持っている。見出しは重ねて言わない。 */
      head.innerHTML = '<h1 class="mr-hd-t">' + esc(T.hd) + '</h1>';
    }
    /* 会社の打ち込み。★語彙は舐めない（当たるのは今この画面にある社名だけ）。 */
    var q = el('ap-q');
    if (q) {
      q.addEventListener('input', function () {
        S.fQ = norm(q.value);
        /* 打ち込みで選んでいた会社が消えたら、その選択も落とす
           （残すと「選んだのに0件」になる）。 */
        if (S.fAir && !hitQ(S.fAir)) { S.fAir = ''; S.fPos = ''; }
        S.page = 1;
        render();
      });
    }
    ['ap-air', 'ap-pos'].forEach(function (id) {
      var s = el(id);
      if (!s) return;
      s.addEventListener('change', function () {
        /* 上の段を変えたら下の段は落とす（残すと「選んだのに0件」になる）。 */
        if (id === 'ap-air') { S.fAir = s.value; S.fPos = ''; }
        else S.fPos = s.value;
        S.page = 1;
        render();
      });
    });
    var clr = el('ap-clear');
    if (clr) clr.addEventListener('click', function () {
      S.fAir = ''; S.fPos = ''; S.fQ = ''; S.page = 1;
      if (q) q.value = '';
      render();
    });

    /* ページ送りも行も、描き直すたびに作り直される。入れ物の側で受ける。
       ★ページ送りの判定が**先**。› のボタンはページ送りの外にあるので
         ぶつからないが、順番を入れ替えると「次へ」を押した瞬間に面が開く。 */
    var box = el('ap-rows');
    if (box) box.addEventListener('click', function (ev) {
      var t = ev.target;
      var q = (t && t.closest) ? function (sel) { return t.closest(sel); }
                               : function () { return null; };
      var b = q('[data-ap-page]');
      if (b) {
        if (b.disabled) return;
        S.page = Number(b.getAttribute('data-ap-page')) || 1;
        render();
        if (box.scrollIntoView) box.scrollIntoView({ block: 'start', behavior: 'smooth' });
        return;
      }
      /* ★行（2026-09-03）。行のどこを押しても同じところへ行く。
           戻り先は、その行の › のボタン（閉じたときにフォーカスが帰る場所）。 */
      var tr = q('[data-ap-row]');
      if (tr) {
        openDrawer(Number(tr.getAttribute('data-ap-row')),
                   tr.querySelector ? tr.querySelector('.ap-go') : null);
      }
    });

    /* ★通貨の切替は描き直すだけ。pv_pay_rows() を引き直さない。
       ★開いている面も同時に描き直す（開いたまま、帯だけが付いてくる）。 */
    w.addEventListener('pv-currency-change', function () { render(); paintDrawer(true); });

    /* ★語彙から読むのは職位と機材（2026-09-03 に機材を出すことにした）。
         ⚠️ 名前はカッコの中に機種の並びを抱えている。表の2行目には長すぎるので
            カッコから先を落として持つ。コードそのものは何も変えていない。 */
    fetch(VOCAB_URL).then(function (r) { return r.json(); }).then(function (v) {
      (v.positions || []).forEach(function (p) { S.pos[p.code] = p[L] || p.ja; });
      (v.fleets || []).forEach(function (f) {
        S.flt[f.code] = String(f[L] || f.ja || f.code)
          .replace(/[（(][^）)]*[）)]\s*$/, '').trim() || f.code;
      });
    }).catch(function () {}).then(function () {
      return fetch(AIR_URL).then(function (r) { return r.json(); });
    }).then(function (j) {
      var a = (j && j.airlines) || {};
      Object.keys(a).forEach(function (c) { S.air[c] = a[c][L] || a[c].ja || c; });
      /* ★辞書が後から届いても描き直す。RPC のほうが先に返ると、
           行はコードのまま（ana / cap）で固まる。 */
      render();
    }).catch(function () { render(); });

    load();
  }

  function load() {
    /* ページ側のインライン script が作った sb を借りる（my-value.js:48-49 と同じ）。
       ★ここで createClient しない。1ページに2つ作ると getSession が別々に走る。 */
    var client = null;
    try { client = sb0(); } catch (e) { client = null; }
    if (!client || !client.rpc) { S.mode = 'error'; renderRows(); return; }
    var ready = w.PV_SESSION && typeof w.PV_SESSION.then === 'function'
      ? w.PV_SESSION : { then: function (f) { f(null); return { catch: function () {} }; } };
    ready.then(function (session) {
      if (!session) return;                       // ページ側がログインへ送っている
      /* 匿名で出した給与データの預かり証を拾う（最後の網。profile.html:477 と同じ実体）。
         ★pv_pay_rows() より **前**。引き取りに成功すると submit_pay_report が走って
           90日の解放が立つので、直後に引けば1回目から開いた画面になる。
           後ろに置くと、出したばかりの人に1回だけロック画面を見せることになる。
         ★takeFromUrl() を自分で呼ばない ── sweep() が中で先に呼んでいる。
         ★失敗しても画面は止めない（profile.html と同じ扱い）。 */
      var swept = null;
      try { if (w.PVClaimPending) swept = w.PVClaimPending.sweep(client); } catch (e) { swept = null; }
      Promise.resolve(swept).catch(function () { return null; }).then(function () { fetchRows(client); });
    });

    /* 一覧を取りに行く。上の預かりの引き取りが終わってから呼ばれる。 */
    function fetchRows(client) {
      /* ★ rpc() が返すのは「then だけを持つ箱」で Promise ではない。
           Promise.resolve() で包んでから catch を付ける（pv-referral.js:gap と同じ）。 */
      Promise.resolve(client.rpc('pv_pay_rows')).then(function (res) {
        if (res && res.error) { S.mode = 'error'; renderRows(); return; }
        var v = res && res.data;
        S.mode = (v && v.state === 'open') ? 'open' : 'locked';
        /* ★左メニューの錠前は localStorage の写しで暫定的に出ている。
             ここはサーバの答えを持っているので、そちらで上書きする。
             ⚠️ my_pay_reports() は引かない（この画面は本人の明細を読まない）。 */
        if (w.PVGates && w.PVGates.mark) w.PVGates.mark(S.mode === 'open');
        S.rows = (v && v.rows) || [];
        /* ★行に「受け取った順の番号」を振る。押された行を引き当てるのはこれ1つ。
             ページ送りでも絞り込みでも動かない番号でないと、押した行と
             開く行がずれる（並びはサーバが決めているので順番は安定している）。 */
        S.rows.forEach(function (r, k) { r._i = k; });
        /* ★数え上げ。古いサーバ（stats を返さない）でも画面は止めない
             ＝ そのカードだけ出ない（0 を置いて嘘の数字を作らない）。 */
        S.stats = (v && v.stats) || null;
        /* ★DEEP PAY の札（N / 100人）と、本人が内訳を出したかどうか。
             数を作るのはサーバーだけで、pv-gates.js は渡された数を出すだけ。
             来なければ札は「準備中」のまま＝古いサーバでも画面は壊れない。
           ⚠️ renderRows() より前に渡す。3段の表はこの後で描かれる。 */
        if (w.PVGates && w.PVGates.setProgress) {
          w.PVGates.setProgress({
            n: (v && v.stats) ? v.stats.contributors : null,
            detailed: (v && v.give) ? v.give.detailed : null
          });
        }
        renderRows();
        /* ★フォームから戻ってきた人の面を開き直す（オーナーの §8）。
             renderRows() の**後**。中でページを送り直すことがあるので、
             一度描き終わってからでないと居場所がずれる。 */
        if (S.mode === 'open') reopenBack();
      }).catch(function () { S.mode = 'error'; renderRows(); });
    }
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
