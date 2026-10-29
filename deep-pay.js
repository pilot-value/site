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
   ★守りは「人数の壁に届かない区分は出さない」だけ（壁は db/deep-pay.sql の
     定数 v_min の1か所。2026-10-11 から2人）。
   ★選べる値は語彙（pv_airlines / pv_positions / pv_fleets）の中だけで、
     **手で選んだ区分ははしごを登らない**。壁に届かなければ level:'none' が
     返るだけで、広い区分の数字がその見出しのまま出ることは無い。
   ⚠️ この壁は SQL にしか無い。画面側で人数を数えたり伏せたりしないこと
     ── 2か所に置くと、片方だけ直した日に静かに緩む。

   ── 人数は画面のどこにも出さない（2026-10-11・オーナー判断）────
   ★その区分に何人いるかも、壁が何人かも書かない。サーバも区分の人数を
     返さなくなった（cohort.n / head.detailed_n / head.verified_n / comp.n は無い）。
     代わりに来るのは信頼度の段（cohort.trust ＝ high / mid / low）だけ。
   ⚠️ 古いサーバが n を返してきても**読まない**。このファイルに人数の鍵を
     読む行を足し戻さないこと（assert-deep-pay.mjs が毒入りの答えで見ている）。
   ★たった1つの例外は錠前の板の「…100人に達すること（いま N人）」。あれは
     サイト全体の数（gate.contributors / gate.goal）で、区分の人数ではない。

   ── 見る資格（2026-10-11・オーナー判断）────────────────────────
   ★DEEP PAY は、自分に当てはまる項目を**ぜんぶ**答えた人に開く。門はサーバ
     （db/deep-pay.sql の pv_deep_missing。gate.ready がその答え）で、この画面は
     門を持たない。画面がするのは、閉じているときの板に「まだ答えていない項目」
     （gate.todo）を**給与フォームと同じ名前で**並べ、フォームへ送ることだけ。
   ★同じ日にもう1つ ── **公開より前に**内訳の3つ（基本給・保証手当／職務手当・変動給）に
     答えていた人は、ぜんぶ答えていなくても開いたまま（オーナー判断。サーバの v_old）。
     その人にも gate.ready は true で来る ── **どの道で通ったかは返ってこない**ので、
     画面は2つを見分けない（見分ける行を足さない）。
   ★給与フォームは変えていない。入力もこの画面に置かない（板の入口はボタン1本）。
   ⚠️ 前の門（内訳が1つでもあるか＝gate.detailed）は、サーバが名前ごと外した。
      読む行を足し戻さない（いちばん外の give.detailed は別物 ── pv_my_give の答え。
      load() が今も PVGates.setProgress へ渡すが、あちらは 2026-10-11 から受け取るだけで
      何もしない ── 3段の表の DEEP PAY の札を外したため）。

   ── 閉じているときの見た目（2026-10-11・オーナー判断）────────────
   ★「まだ開かない人には給与詳細を提出させる。背景にはぼかした DEEP PAY を表示させる。」
     板の後ろに、この画面の**形だけ**の影絵をぼかして置く（lockStage / ghostShapes）。
   ⚠️ 影絵は字も数字も持たない固定の絵。本物の値を描いてからぼかす形にしない ──
      ぼかしは開発者ツールで外せる。鍵の無い人へは、サーバが数字を返していないまま。
      開いた画面には影絵そのものが無い。

   ── ログインしていない人（2026-10-11・オーナー判断）──────────────
   ★DEEP PAY には公開の入口が在る（REAL PAY の見出しのタブ。あちらは未ログインの人にも
     見える）。前は、ログインしていない人がここへ来るとログイン画面へ送っていた。
     いまは送らない ── **会員で、まだ開いていない人と同じ画面**（影絵＋板）を出す
     （REAL PAY が未ログインの人に、ログインの壁ではなく伏せた一覧を見せるのと同じ）。
   ★板は新しく書いていない。「鍵が無く、答えきってもいない」会員の門と同じ形の入れ物
     （anonGate）を、同じ lockStage へ通すだけ。字も行き先も、会員のその板と同じ。
   ⚠️ ログインしていない人のために**サーバへ1本も聞かない**（pv_deep_pay() は未ログイン
      だと必ず落ちる）。端末にも何も書かない（クラッカーの印・門の鍵のどちらも）。
   ★セッションは端末に残っているのに、サーバが「ログインしていない」と答えた回
     （authLost ＝ 42501 か HTTP 401）も同じ板。ほかの失敗は今までどおり
     「読み込めませんでした」。
   ⚠️ 誰がログインしているかを決めるのは pv-session.js とページの PV_SESSION。
      ここでは決めない（端末のログインの控えにも触らない）。

   ── 誰を数えるか・賞与の見積もり（2026-10-12・オーナー判断）──────
   ★サーバ（db/deep-pay.sql）が母集団を2つに分けた。画面は**来た形をそのまま出すだけ**。
     ・年収・Pay / Block Hour・月換算・働き方 … 有効な年収を出した人ぜんぶの**中央値**
       （内訳を書いたかは見ない）。
     ・給与構成（割合と月額）・固定・保証給比率・変動給の中身 … 内訳を書いた人だけの
       **平均**。金額を先に平均し、割合はその平均から出ている（金額の鍵は avg_usd。
       前の med_usd は中央値だった頃の名前で、サーバはもう返さない）。
     ★だから「年収は出ているのに comp が null」は、壊れた答えではない（総支給だけの人が
       集まった区分）。年収・Pay / Block Hour・働き方・選ぶ欄はそのまま出し、給与構成の
       カードは今までの「まだ出せません」の板、固定・保証給比率のカードは出さない
       （0 で埋めない）。
   ★賞与 … サーバが「同じ会社・同じ役職で申告された賞与の平均」を、その区分の全員に
     割り振って年収と Pay / Block Hour を出す（使うのは PILOT VALUE に蓄積された申告だけ）。
     画面に来るのは目印2つ（head.bonus_est / head.bonus_gap ＝ 真偽）で、額も人数も来ない。
     `=== true` のときだけ、札（年収と Pay / Block Hour のカード）と注記（KPI の下）を出す。
     ⚠️ 札は淡い札で、注意の色にしない（見積もりは不具合ではない）。
   ⚠️ **月換算（賞与ぬき）は head.month_usd をそのまま出す。画面で作らない** ──
      年収を 12 で割らない・賞与の割合を掛けない。年収（全員・賞与の平均込み）と賞与の割合
      （内訳を書いた人だけ）は母集団が違うので、掛けると、どちらの数字でもない額になる。
      来なければ行ごと出さない（assert-deep-pay.mjs が、毒入りの答えで見ている）。
   ⚠️ **給与構成のカードに「賞与・利益分配 ◯%」の行を戻さない**（comp.bonus は読まない）。
      サーバの割合は、内訳を書いた人のうち賞与を答えていない人を 0 として数えた比 ＝ 低く出る。
      上の「平均賞与を使った推計」と同じ画面に並ぶと、2つが食い違って見える。
   ★SQL を貼る前の古い答え（金額の鍵が med_usd・month_usd が無い）でも、壊さない・作らない
     ── 月額の欄は「—」・月換算の行は出ない・札も注記も出ない。

   ── ここで守っている約束 ──────────────────────────────────────
   ★「時給」と書かない。出すのは Pay / Block Hour で、Block Hours から
     割った指標。時給と書いた瞬間に、待機も地上も含んだ拘束時間で割った
     数字だと読まれる（分母が違う）。
   ★0 を印字しない。人数が足りない列・区分は**行ごと出さない**。
     0 と描くと「その会社は払っていない」という別の意味になる。
   ★「上位○%」を書かない。この画面は序列ではない。
   ★根拠のない精度（「98% 正確」など）を作らない。出せるのは信頼度の段だけ。
   ★賞与はドーナツに入れない（オーナー確定 2026-08-29）。月々の現金と
     年1回の賞与を同じ円に混ぜると、円の意味が「月」でも「年」でもなくなる。
   ★Night / Weekend / Holiday を1行にまとめない。まとめれば人数の壁を
     通りやすくなる＝将来「整理」したくなる場所なので、ここに禁止を書いておく。

   ── 絵は借りる（複製の禁止）────────────────────────────────────
   ★ドーナツは PVViz.donutFromSegs（pay-viz.js）。**実体はあちら1か所だけ。**
     stroke-dasharray も 2πr もこのファイルに持たない。
   ⚠️ PVViz.compSegs は使わない。あちらは pv_pay_rows() が返す5バケツ
     {m,b,d,h,o}（年額・賞与込み・COMP の色）に固定されている。
     こちらは8区分・月額・賞与抜きで、分母も分子も違う。
     「再利用できそう」に見えるので、使わない理由をここに書いておく。

   ── 通貨 ──────────────────────────────────────────────────────
   金額は USD で来る。丸め方は2通り（2026-10-11・オーナー判断）──
   ・見出しの2つ（年収の中央値・Pay / Block Hour）は、サーバが刻み
     （$50・$0.5）で返す。画面は**表示通貨へ換算してから**もう一度刻みに寄せる
     （stepIn。actual-pay.js:disp と同じ考え方）── 円なら 1万円・100円、
     それ以外の通貨なら 1,000・1。省くと、通貨を切り替えた瞬間だけ端数の
     残った数字が出て「本当は1円単位まで持っているのでは」と読める。
   ・それ以外の金額（給与構成の月額・月換算）は今までどおり有効数字2桁
     （moneyExact / moneyAbout）。サーバも2桁のまま返している。**こちらは細かく
     していない。** ただし2桁に寄せるのは**表示通貨へ換算してから**（sigIn。
     2026-10-11）── 円で寄せてから換算すると、ドルでは $4,781 のように
     持っていない桁が並ぶ。円の表示は今までと1文字も変わらない。
   ★#dp-root に pv-no-cur が付いている（currency.js の自動走査を止める）。
     切替は 'pv-currency-change' を購読して**描き直すだけ**。
     ⚠️ 描き直しで pv_deep_pay() を引き直さない。データは S に持つ。
   ════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';
  if (!w || !d) return;

  /* ══ ★★DEEP PAY は閉じている（2026-10-29・オーナー指示「deep pay は一時会員には見せない。
       閉鎖するからみんなのページから消して」）══
     2026-10-12 に公開した画面を、一時的に閉じた。会社比較（deep-pay-compare.js の COMPARE_OPEN）と同じ形 ──
     ・DEEP_OPEN が false のあいだ、このファイルは下の closedBoard() を1回呼んで**そこで終わる**。
       セッションを待たない・pv_deep_pay() を1回も呼ばない・保存領域を読まない／書かない・
       影絵もクラッカーも出さない・試験用の入口（PVDeepPay）も生やさない。
       ログインしていない人・会員・運営 ── 誰が来ても、同じ板が1枚出るだけ。
     ・入口も全部外した（REAL PAY の見出しのタブ・行の面のボタン・3段の表の段・ロードマップの2行）。
     ・本体（この下ぜんぶ）とサーバ（db/deep-pay.sql）には1文字も手を入れていない。
     ★開け直す日 ── この定数を true に／入口を戻す（git の 2026-10-29 の直前の版から：
       actual-pay.html の日英のタブ・actual-pay.js の面のボタン・pv-gates.js の段・
       roadmap-config.js の2行）／2本の検査（assert-deep-pay*.mjs）の「閉じている」の節を書き換える／
       ?v= を付け替える。
     ⚠️ これは門ではない。数字を守っているのは今までどおりサーバだけ。
        ここは「いま見せない画面を描かない」だけ。 */
  var DEEP_OPEN = false;
  /* ★試験用の口。**手元の確認用サーバ（localhost / 127.0.0.1）で開いたときだけ**、検査と撮影の道具が
       先に置いた印（window.__PV_DEEP_OPEN = true）で本体を動かせる（閉じているあいだも腐らせないため）。
     ⚠️ 本番の住所では、印が在っても**必ず false**。住所の後ろの字・保存領域・Cookie では開かない。
        条件を足さない・緩めない（compareOpen() と同じ形）。 */
  function deepOpen() {
    if (DEEP_OPEN) return true;
    try {
      return w.__PV_DEEP_OPEN === true &&
        /^(?:localhost|127\.0\.0\.1)$/.test(w.location.hostname);
    } catch (e) { return false; }
  }
  /* 閉じているあいだの板。題とリンクの2つの字だけ（会社比較の板と同じ形。**文を足さない**）。
     ★器（#dp-root）の中身を、この板1枚に置き換える ── タブ・選ぶ欄・カードの器ごと無くなる。
     ★行き先は REAL PAY（相対のまま。/en/ から踏めば /en/actual-pay.html に解ける）。
     ⚠️ ここは下の T / esc より**前**に走る。字も絵もこの関数の中に直に持つ。 */
  function closedBoard() {
    var en = d.documentElement.getAttribute('lang') === 'en';
    var root = d.getElementById('dp-root');
    if (!root) return;
    root.innerHTML = '<div class="dp-msg dp-closed">' +
      '<h1 class="dp-msg-t">' +
        (en ? 'DEEP PAY is coming soon' : 'DEEP PAY は準備中です') + '</h1>' +
      '<a class="dp-more-b dp-more-b--on dp-closed-go" href="actual-pay.html">' +
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" ' +
        'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M15 5 8 12l7 7"/></svg>' +
        (en ? 'Back to REAL PAY' : 'REAL PAY に戻る') + '</a>' +
      '</div>';
  }
  if (!deepOpen()) {
    /* ★後ろで読まれる出し直しのお願い（pv-pay-fix.js）にも本人を渡さない（会社比較と同じ）。
         閉じているあいだ、この画面は誰に対しても同じ1枚 ── 会員向けの通信も控えも起こさない。 */
    w.PV_SESSION = Promise.resolve(null);
    closedBoard();
    return;
  }

  var V = w.PVViz;
  if (!V) return;                       // pay-viz.js が先に要る（HTML の順序）
  var esc = V.esc, num = V.num, fmt = V.fmt;

  /* ★ページ相対で書くと /en/ から /en/pv-airlines.json を見に行って 404 になる
       （actual-pay.js:77 と同じ理由）。 */
  // ★社名の辞書は pv-airlines.json（2026-09-13 に salary-data.json から移した）。
  //   あちらは年収の帯を持つ112社だけで、チャーター/ビジネスジェットの社が入っていない。
  var AIR_URL = 'pv-airlines.json', VOCAB_URL = 'pv-vocab.json';
  try {
    var _self = (d.currentScript && d.currentScript.src) || '';
    if (_self) {
      AIR_URL = new URL('pv-airlines.json', _self).href;
      VOCAB_URL = new URL('pv-vocab.json', _self).href;
    }
  } catch (e) {}

  var L = (d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';

  /* ★★会社比較は、まだ出さない（2026-10-12・オーナー判断「会社比較はまだ出さないでよ」）。
       この画面から会社比較（あちらの HTML）へ行く入口は、下のほうの more() が描く
       「もっと深く見る／会社比較を見る」のカード1枚だけ。COMPARE_OPEN が false のあいだ、
       そのカードを**枠ごと出さない**（空の箱も残さない。段は左の「何をすると給与が
       増えるか」が幅いっぱいになる ── deep-pay.css の .dp-row--var）。
       あちらの画面そのものも、deep-pay-compare.js の同じ名前の定数で閉じてある。
     ★出す日にこのファイルで替えるのは、この1行だけ（true にする）。カードの字も
       描き方も消していない。2つの JS の定数は**必ず一緒に**替える（片方だけだと、
       入口の先が「準備中」の板になるか、入口の無い画面が開いたままになる）。 */
  var COMPARE_OPEN = false;
  /* ★試験用の口。**手元の確認用サーバ（localhost / 127.0.0.1）で開いたときだけ**、検査と
       撮影の道具が先に置いた印で、閉じている側の描き手を動かせる（腐らせないため）。
     ⚠️ 本番の住所では、印が在っても**必ず false**。条件を足さない・緩めない。
     ★deep-pay-compare.js と**同じ本体**（注はあちらに1回だけ書いてある。ずれは
       assert-deep-pay-compare.mjs の「写した関数」が見張る）。 */
  function compareOpen() {
    if (COMPARE_OPEN) return true;
    try {
      return w.__PV_COMPARE_OPEN === true &&
        /^(?:localhost|127\.0\.0\.1)$/.test(w.location.hostname);
    } catch (e) { return false; }
  }

  // ── 文言 ───────────────────────────────────────────────────────
  var T = {
    ja: {
      /* ★見出しの字（DEEP PAY）はここに無い。HTML のタブが持つ（2026-10-11）。 */
      now: '表示中:',
      months: '直近24か月',
      /* ★「◯人」「うち明細あり ◯人」の語はここから消した（2026-10-11）。
         人数を出す場所が無くなったので、単位の語ごと持たない。 */
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
      askNoneS: 'データが十分にそろった区分ができると、会社・役職・機材で選べるようになります。',
      rg: { japan: '日本', mideast: '中東', asia: 'アジア', europe: '欧州',
            us: '北米', latam: '中南米', oceania: 'オセアニア', africa: 'アフリカ' },

      trust: '信頼度',
      hi: '高', mid: '中', lo: '低',

      /* ★月換算の添え字は k1nb の1つだけ（2026-10-12）。前は「月換算 約」（k1n）も在った ──
           画面が年収から月換算を作っていた頃、賞与の割合が来ない区分で「賞与ぬき」と名乗らない
           ための言い分け。いまはサーバの month_usd（いつも賞与ぬき）をそのまま出すので要らない。 */
      k1: '年収（中央値）',     k1nb: '月換算（賞与ぬき）約 ',
      k2: '固定・保証給比率',   k2n: '乗務量に左右されにくい報酬 ／ 変動給比率 ',
      k3: 'Pay / Block Hour',   k3n: '1人ずつ 年収÷12÷Block Hours ／ その中央値',
      /* ★賞与の見積もり（2026-10-12・オーナー判断）。字はオーナーと決めたもの。
           estTag  … 年収と Pay / Block Hour のカードの札。head.bonus_est が true のときだけ
           footEst … そのとき KPI の下に足す1行
           footGap … head.bonus_gap が true のときだけ足す1行（数えた回答の**一部**に、賞与を
                      答えていなくて、平均も作れなかったものが在る ＝ その回答の年収にだけ
                      賞与が入っていない）
         ⚠️ footGap を「この区分の回答は賞与を含まない」と読める文にしない ── 賞与を申告した人の
            回答には入っている。指すのは、当てはまる回答だけ（同じ日に字を直した）。
         ⚠️ 何人ぶんの平均か・賞与がいくらかを書き足さない（サーバも返していない）。 */
      estTag: '平均賞与を使った推計',
      footEst: '※ 賞与は、PILOT VALUE に集まった同じ会社・同じ役職の申告の平均を使った推計です。',
      footGap: '※ 賞与未回答で平均も出せない回答は、賞与を含まず集計しています。',

      compT: '給与構成',
      compS: '月々の現金・賞与ぬき',
      /* ★給与構成は**平均**（2026-10-12。前は項目ごとの中央値だった）。年収の見出し（k1）と
           働き方（workS）は中央値のまま ── 母集団も出し方も別なので、語をそろえない。 */
      center: '構成比\n（平均）',
      thK: '構成要素', thP: '構成比', thA: '月額（平均）',
      compNote: '※ 金額ではなく構成比を表示しています。',
      restNote: '※「その他・未分類」には、データが足りず個別に出せなかった項目を含みます。',
      /* ★ここに在った「賞与・利益分配／年収に占める割合」の2つは 2026-10-12 に外した
           （行ごと出さなくなった。理由はファイル冒頭の「賞与の見積もり」）。 */
      compNone: 'この区分では、給与構成をまだ出せません。',
      compNoneS: '内訳まで書いた明細が集まると、ここに構成が出ます。',

      workT: '働き方と報酬',
      workS: '中央値 / 月',
      hintT: '時給ではなく、働き方の前提とセットで報酬を見ます。',
      hintS: '同じ年収でも、飛ぶ時間と拘束される時間は会社ごとに倍ちがいます。',

      varT: '何をすると給与が増えるか',
      varS: '変動給の内訳',
      varNote: '※ 合計は四捨五入のため100%にならない場合があります。',
      varLead: ['変動給の ', ' は「', '」に連動しています。'],

      /* ★「データの見方」の板5枚はオーナー判断で削除（2026-08-31・じゃま）。
         残したのはこの1行だけ ── 人数の壁は約束、時給と呼ばないのは仕様。
         カードにせず、給与構成の下に淡い1行で置く。
         ★2026-10-11、壁が何人かを書くのをやめた（オーナー判断）。壁が在ること
           だけを言う。⚠️ ここに人数を足し戻さない。 */
      foot: '※ データが十分にそろった区分だけを出します。足りない項目は 0 ではなく行ごと出しません。',
      /* ★年収が何を含むかは、これまで画面のどこにも書いていなかった（2026-09-01 に追加）。
         中身は db/pay-reports.sql の pv_annual_total と対。あちらを変えたらここも直す。 */
      footA: '※ 年収＝住宅手当・パーディアム・交通費・賞与・利益分配を含む現金の年換算。現物の社宅は含みません。',

      moreT: 'もっと深く見る',
      moreS: '別の切り口で見る。',
      more1: '会社比較を見る',

      /* ★2026-10-11 オーナー指示で題を替えた（「まだ開いていません」ではなく、何をすれば開くか）。
           lockTWait は、本人の条件はそろっていて人数の条件だけで止まっているときの題。
           そこで「提出で開きます」と言うと嘘になるので、前の題を残してある。 */
      lockT: '給与詳細提出で開きます',
      lockTWait: 'DEEP PAY はまだ開いていません',
      lockKey: '給与を1件出すと、90日ぶん開きます。',
      /* ★本人の側の門（2026-10-11・オーナー判断）。「内訳を1件出すと開く」をやめて、
           自分に当てはまる項目を**ぜんぶ**答えた人に開く（線は db/deep-pay.sql の
           pv_deep_missing。gate.ready がその答え）。前の lockDet はこの行に置き換えた。
           （公開より前に内訳の3つに答えていた人も ready が true で来る ── サーバの v_old。
             その人にこの行は出ない。）
         ★給与フォームは変えていない。足りない分は、板のボタンからフォームで足してもらう。
         ★lockTodoH の {ym} は対象月（todoMonth()）。lockWarn は、この行が出ているとき
           **だけ**ボタンの上に添える断り（出す・出さないは lockHtml() が決める）。
         ⚠️ この3つは deep-pay-compare.js にも同じ字で在る。片方だけ直さない
            （2つの画面の §2b が、同じ表で字そのものを見ている）。 */
      lockReady: '給与の項目をすべて答えると開きます。',
      lockTodoH: 'まだ答えていない項目（{ym}）',
      lockWarn: '虚偽の情報や不正確な情報を提出した場合、利用規約に基づきアカウントを停止することがあります。',
      /* ★人数が足りなくて閉じているときの3行目（2026-09-01）。
         数字は返ってきた gate から入れる。ここで数え直さない。
         ★この画面で人数が出てよいのは**この1行だけ**（サイト全体の数で、
           区分の人数ではない）。出すかどうかは lockLines() が決める。 */
      lockGoal: '給与を出したパイロットが{goal}人に達すること（いま{n}人）。',
      lockCta: '匿名で給与を出す',
      /* ★2026-10-11 オーナー指定の文言（板のボタンだけ）。1文字も変えない・「匿名で」を足さない
           （トップの「Give & Get 全ての待遇データを解放する」と同じ扱い）。
         ★同じ日にオーナーが字を1つ直した ── 末尾の語を、トップと同じ「解放」に
           そろえた（前は別の字だった）。英語の字は変えていない。 */
      lockGo: 'Give & Get 詳細を入力して解放する',

      thinT: 'この区分は、まだ人数が足りません',
      thinS: 'データがそろった区分から順に出ます。',
      err: '読み込めませんでした。少し待ってから開き直してください。'
    },
    en: {
      now: 'Showing:',
      months: 'last 24 months',
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
      askNoneS: 'Once a group has enough data, you can pick an airline, seat or fleet.',
      rg: { japan: 'Japan', mideast: 'Middle East', asia: 'Asia', europe: 'Europe',
            us: 'North America', latam: 'Latin America', oceania: 'Oceania', africa: 'Africa' },

      trust: 'Confidence',
      hi: 'High', mid: 'Medium', lo: 'Low',

      k1: 'Annual pay (median)',   k1nb: 'About (bonus excluded) ',
      k2: 'Fixed & guaranteed share', k2n: 'Not tied much to flying / Variable share ',
      k3: 'Pay / Block Hour',      k3n: 'Per-pilot annual÷12÷block hours, median',
      estTag: 'Estimate using average bonus',
      footEst: '※ The bonus is an estimate: the average of bonuses reported on PILOT VALUE for the same airline and rank.',
      footGap: '※ Reports without a bonus answer are counted without a bonus when too few peers reported one.',

      compT: 'What the pay is made of',
      compS: 'Monthly cash, bonus excluded',
      center: 'Share\n(average)',
      thK: 'Component', thP: 'Share', thA: 'Monthly (average)',
      compNote: 'Shares, not amounts, are what this chart shows.',
      restNote: '“Other / unclassified” includes items held back because there was not enough data to show them separately.',
      compNone: 'Not enough to show the pay mix for this group yet.',
      compNoneS: 'It appears once enough pilots have reported a full breakdown.',

      workT: 'The flying behind the pay',
      workS: 'Median / month',
      hintT: 'Pay is read together with the flying, not as an hourly rate.',
      hintS: 'The same annual pay can hide twice the block hours at another airline.',

      varT: 'What makes the pay go up',
      varS: 'Inside the variable pay',
      varNote: 'Shares are rounded, so they may not add up to 100%.',
      varLead: ['', ' of variable pay moves with ', '.'],

      foot: 'Only groups with enough data are shown; anything short of that is left out, not shown as zero.',
      footA: 'Annual pay = cash incl. housing allowance, per diem, transport, bonus and profit share; housing in kind is not counted.',

      moreT: 'Go deeper',
      moreS: 'More detailed cuts of the same data.',
      more1: 'Compare airlines',

      lockT: 'Opens when you submit your pay details',
      lockTWait: 'DEEP PAY is not open yet',
      lockKey: 'Share one pay report and it opens for 90 days.',
      lockReady: 'It opens once every item on your pay report is answered.',
      lockTodoH: 'Still unanswered ({ym})',
      lockWarn: 'Submitting false or inaccurate information may result in suspension of your account under our Terms of Service.',
      lockGoal: 'It opens once {goal} pilots have shared their pay (currently {n}).',
      lockCta: 'Share your pay anonymously',
      lockGo: 'Give & Get / Enter your details to unlock',

      thinT: 'Not enough pilots in this group yet',
      thinS: 'Groups appear once enough pilots have reported.',
      err: 'Could not load. Please try again in a moment.'
    }
  }[L];

  /* 給与構成の名前。★区分は9つで固定（db/deep-pay.sql の cseg と同じ順・同じ鍵）。
     ★2026-09-15、fixed を base と guarantee に割った（オーナー指示）。フォームでは
     基本給と保証手当が別々の欄なのに、図では同じ緑の1本に見えていたため。 */
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
  /* 有効数字2桁（actual-pay.js:sig2）。
     ★使うのは給与構成の月額（moneyExact）と月換算（moneyAbout）だけで、
       どちらも下の sigIn を通して**表示通貨の値**に掛ける。
       見出しの2つ（年収・Pay / Block Hour）は 2026-10-11 から下の stepIn。 */
  function sig2(v) {
    v = Number(v);
    if (!isFinite(v) || v <= 0) return 0;
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10) - 1);
    return Math.round(v / p) * p;
  }
  /* ── 有効数字2桁を、表示通貨の中で掛ける（2026-10-11）──────────────
     前は円に直した値を2桁に寄せてから、表示通貨へ換算していた。円では正しいが、
     ほかの通貨では換算のあとに端数が戻る ── サーバの $4,800 が ¥760,000 を経て
     $4,781 と出て、1ドル単位まで持っているように読める（持っているのは2桁だけ）。
     だから下の stepIn と同じ順にした：**換算してから寄せ、円に戻して整形へ渡す。**
     ★返すのは**円**（整形は exact / fmt の1か所のまま）。
     ★円のときはレートが 1 ＝ sig2 そのもの。円の表示は1文字も変わらない。
     ⚠️ 桁を増やさない。2桁はサーバが返している細かさそのもの（項目ごとに人数の
        壁を掛け直した数なので、見出しの2つより粗いままにしてある）。 */
  function sigIn(jpy) {
    var C = w.PVCurrency;
    var cur = (C && C.get) ? C.get() : 'JPY';
    var rate = (C && C.rates && C.rates[cur]) || 1;
    return sig2(jpy / rate) * rate;
  }
  /* ── 見出しの2つだけ、表示通貨の中で「刻み」に寄せる（2026-10-11・オーナー判断）──
     年収の中央値と Pay / Block Hour は、サーバが刻み（$50・$0.5）で返すように
     なった（db/deep-pay.sql の pv_deep_step）。ここで有効数字2桁に丸め直すと、
     その細かさを画面が捨てる（$119,700 が ¥1,900万 になる）。
     だから**表示通貨の値**を刻みに寄せる ── 換算してから丸め、円に戻して整形へ渡す
     （actual-pay.js:disp と同じ考え方。丸めてから換算すると、通貨を切り替えた
       瞬間だけ端数の残った数字が出る）。
       円のとき   … yenStep（年収 1万円 ／ Pay / Block Hour 100円）
       それ以外   … curStep（年収 1,000 ／ Pay / Block Hour 1）
     ★返すのは**円**。万・K/M・記号を付けるのは fmt / exact（整形は1か所のまま）。
     ★1e-9 は「掛けて割り戻す」誤差の手当て。$102.5 を円にしてドルへ戻すと
       102.4999… になる値があり、同じ半端が $102 と $103 に割れる。半端はいつも上へ。
     ⚠️ 給与構成の月額には使わない。あちらは項目ごとに人数の壁を掛け直している
        細かい数で、サーバも有効数字2桁のまま返している（moneyExact）。
     ⚠️ 刻みをここで細かくしない。細かくできるのはサーバが返す細かさまでで、
        それより細かく刷ると、持っていない精度を名乗ることになる。 */
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
  /* 月換算（賞与ぬき）。サーバが出した月額 USD（head.month_usd）→ 表示通貨。
     ★2026-10-12、ここは**換算して整形するだけ**になった。前の道具（moneyMonth）は、
       年収に「1 − 賞与の割合」を掛けて月数で割っていた。サーバが母集団を分けたので、
       それはもう成り立たない ── 年収は全員（賞与の平均込み）・賞与の割合は内訳を書いた人
       だけの数字で、掛けると、どちらの集団のものでもない額が出る。月換算はサーバが、
       保存してある申告だけから中央値で出す（db/deep-pay.sql の hagg の mon）。
     ★「約」なので有効数字2桁のまま（サーバも2桁で返す）。寄せるのは表示通貨の中（sigIn）・
       整形は年収と同じ fmt（万・K/M に畳む）。
     ⚠️ ここで年収を読まない・割り算も掛け算も足さない。来ない値（null・SQL を貼る前の
        古い答え）と 0 以下は null ＝ 呼ぶ側が行ごと出さない（0 を印字しない）。 */
  function moneyAbout(usd) {
    var n = num(usd);
    if (n == null || !(n > 0)) return null;
    return fmt(sigIn(usdToJpy(n)));
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
  /* mode は5つ ── load（最初の答えを待っている）／open（開いている）／locked（会員で、
     まだ開いていない）／error（読み込めなかった）／anon（ログインしていない。2026-10-11）。
     ★anon だけは**サーバに聞かずに**決まる（boot）。聞いたあとで anon になるのは、
       サーバが「ログインしていない」と答えた回だけ（load の authLost）。 */
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
            client: null, busy: false,
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

  // ── 見出しと条件バー ───────────────────────────────────────────
  /* ★信頼度の段は**サーバが決めて返す**（cohort.trust ＝ high / mid / low。2026-10-11）。
     前はここに式が在った（人数の段と、区分の広さの上限の、低いほうを採る）。
     人数を画面へ渡さなくなったので、式ごと db/deep-pay.sql の trust へ移した。
     ⚠️ ここで段を作り直さない ── 作るには人数が要り、人数はもう来ない。
     ★段が来ないとき（古いサーバ・壁に届かない区分＝null・知らない値）は
       **札そのものを出さない**。「低」で埋めると、段が分からないだけの区分を
       あてにならないと言ったことになる。 */
  var TRUST = { high: { k: T.hi,  m: '' },
                mid:  { k: T.mid, m: ' dp-trust--mid' },
                low:  { k: T.lo,  m: ' dp-trust--low' } };
  function trustTag(c) {
    var t = c && c.trust;
    return (typeof t === 'string' && TRUST.hasOwnProperty(t)) ? TRUST[t] : null;
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
     ★守りは足さない。人数の壁に満たない区分は db/deep-pay.sql が level:'none' を返し、
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
       （どの区分を選んでも答えは同じなので、押せる欄を出すのは嘘になる）。
       ログインしていない人の画面（anon）も同じ ── 選んでも聞く先が無い。 */
    box.hidden = !(S.mode === 'open' || S.mode === 'load');
  }

  /* ★見出し（REAL PAY ⇄ DEEP PAY のタブ）は HTML に静的に在る（2026-10-11）。
       ここで書くのは、その後ろの「いま見ている区分」の1行（.dp-cond）だけ。
     ⚠️ box.innerHTML を丸ごと書き換えない ── タブ（＝ REAL PAY へ戻る道と <h1>）ごと消える。
        前の1行を外して、新しい1行を後ろへ足す。 */
  function head() {
    var box = el('dp-hd');
    if (!box) return;
    var old = box.querySelector('.dp-cond');
    if (old) box.removeChild(old);
    var h = '';
    var c = S.data && S.data.cohort;
    /* ★picked() が要る。無いとクリアした後も前の区分の条件バーが
       空のページの上に残り、「この数字はまだ出ている」と読まれる。 */
    if (S.mode === 'open' && picked() && c && c.level !== 'none') {
      var parts = cohortWords(c);
      /* ★ここに在った「◯人」「うち明細あり ◯人」は 2026-10-11 に外した（オーナー判断）。
         区分の人数は画面のどこにも出さない。サーバも返さなくなったが、
         ⚠️ 返ってきても読まないこと（鍵を読む行を足し戻さない）。
         人数の代わりに出すのは、右端の信頼度の札だけ。 */
      /* ★「直近24か月」は db/deep-pay.sql の sane の写し。数えているのは
         **投稿した日ではなく、その報酬がいつの月のものか**（period_year /
         period_month）。当月を含めて暦で24か月ちょうど。あちらを変えたらここも直す。 */
      parts.push(T.months);
      var t = trustTag(c);
      h += '<div class="dp-cond"><span class="dp-cond-l">' +
        '<span class="dp-cond-k">' + esc(T.now) + '</span>' +
        parts.map(function (x, i) {
          return (i ? '<span class="dp-cond-s">/</span>' : '') + '<span>' + esc(x) + '</span>';
        }).join('') + '</span>' +
        (t ? '<span class="dp-trust' + t.m + '">' +
               IC.info.replace('24" height="24', '12" height="12') +
               esc(T.trust) + ' ' + esc(t.k) + '</span>' : '') + '</div>';
    }
    if (h) box.insertAdjacentHTML('beforeend', h);
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
  /* ★o.tag ＝ 見出しの横の淡い札（2026-10-12。いま使うのは「平均賞与を使った推計」だけ）。
       入るのは見出しの行（.dp-kpi-k）の中。幅が足りないカードでは札だけ次の行へ落ちる
       （deep-pay.css の .dp-kpi-k が折り返す ── 英語の字は長く、320px では必ず落ちる）。
       空なら要素ごと出さない。⚠️ 札に数字を入れない（額も人数も、サーバは返していない）。 */
  function kpi(o) {
    var lng = vwidth(String(o.v)) >= 10 ? ' dp-kpi-v--long' : '';
    return '<div class="dp-kpi' + (o.green ? ' dp-kpi--green' : '') + '">' +
      '<span class="dp-kpi-ic' + (o.ic ? ' dp-kpi-ic--' + o.ic : '') + '">' + o.svg + '</span>' +
      '<span class="dp-kpi-b"><span class="dp-kpi-k">' + esc(o.k) +
      (o.tag ? '<span class="dp-kpi-tag">' + esc(o.tag) + '</span>' : '') + '</span>' +
      '<b class="dp-kpi-v' + lng + '">' + esc(o.v) +
      (o.u ? '<span class="dp-kpi-u">' + esc(o.u) + '</span>' : '') + '</b>' +
      (o.n ? '<span class="dp-kpi-n">' + esc(o.n) + '</span>' : '') + '</span></div>';
  }
  /* ★3枚作って .filter(Boolean)。数字の無いカードは**落とす**（0 を置かない）。
     初日は年収の1枚しか出ない。それが正しい出力。
     ★「詳細投稿数」の4枚目は 2026-08-31 に外した。中身は**人数**なのに単位が
       「件」だった（db/deep-pay.sql の person が proof_hash で1行＝1人に潰している）。
       2026-10-11 からは人数そのものを出さない。⚠️ 4枚目を人数で足し戻さない。 */
  function kpis() {
    var box = el('dp-kpi');
    if (!box) return;
    var h = (S.data && S.data.head) || {};
    /* ★月換算（賞与ぬき）は、サーバの head.month_usd をそのまま出す（2026-10-12）。
       ⚠️ 年収から作らない（moneyAbout の注）。来なければ添え字ごと出さない。 */
    var a = money(h.annual_usd), am = moneyAbout(h.month_usd);
    /* ★賞与の目印（2026-10-12）。サーバが返す真偽2つを `=== true` で読む ── 値が無い古い答えを
       「見積もりあり」へ倒さない。est ＝ 年収と Pay / Block Hour のどちらにも同じ札
       （サーバは2つに同じ差し替えを掛けている）。固定・保証給比率には付けない
       （あちらは内訳を書いた人の平均で、賞与の見積もりに触れていない）。 */
    var est = h.bonus_est === true, gap = h.bonus_gap === true;
    /* ★Pay / Block Hour は moneyRate（刻み）。moneyExact（2桁）に戻すと、サーバが
       $0.5 刻みで返している細かさを画面が捨てる（¥16,300 が ¥16,000 になる）。 */
    var fx = num(h.fixed_pct), pb = moneyRate(h.per_block_usd);
    /* ★変動給比率は「100 − 固定・保証給比率」ではない。db/deep-pay.sql の fixed_pct は
       基本給＋保証手当＋職位＋役割で、残りにはパーディアム・住宅・その他・未分類も入っている。
       引き算だとそれを全部「変動給」と呼んでしまう。無い区分は行ごと出さない。 */
    var vp = segPct((S.data && S.data.comp && S.data.comp.segs) || [], 'variable');
    var cards = [
      a == null ? null : kpi({ k: T.k1, v: a, tag: est ? T.estTag : '',
                               n: am ? T.k1nb + am : '',
                               ic: 'org', svg: IC.money }),
      fx == null ? null : kpi({ k: T.k2, v: Math.round(fx), u: '%', green: true, ic: 'grn',
                                svg: IC.pie, n: vp == null ? '' : T.k2n + Math.round(vp) + '%' }),
      pb == null ? null : kpi({ k: T.k3, v: pb, n: T.k3n, tag: est ? T.estTag : '',
                                ic: 'tea', svg: IC.clock })
    ].filter(Boolean);
    /* ★注記は、いつも出るのは**この1行だけ**（2026-09-01 にここへ集めた）。
       - 人数の壁（T.foot）── 給与構成のカードの中に置いていた。あの壁は円グラフだけの
         話ではなく画面全体の約束なので、数字の真下のここが正しい。
       - 年収の中身（T.footA）── これまで画面のどこにも書いていなかった。
       ★1つの `<p>` にまとめている。ここは全幅（約1160px）なので2文でも1行に収まる。
         2つの `<p>` に分けると、行が増えるぶんだけ画面が下へ伸びて 1512×980 に収まらない。
       ⚠️ 年収のカードが出ていないとき（a == null）は年収の定義を書かない（定義だけ浮く）。
       ★2026-10-12、賞与の目印が立った区分でだけ、その下に1行ずつ足す（footEst / footGap）。
         行が増えるぶんは、給与構成のカードから「賞与・利益分配」の行を外したぶんで相殺して
         ある（あの行は約38px・注記は1行 約17px）。⚠️ 目印が無い区分では1行も足さない。
         ⚠️ どちらも年収と Pay / Block Hour の話なので、その2枚が1枚も出ていないときは
            書かない（札の無い注記だけが浮く。上の年収の定義と同じ理由）。 */
    var hasPay = (a != null || pb != null);
    var fo = cards.length
      ? '<p class="dp-foot">' + esc(T.foot) + (a == null ? '' : ' ' + esc(T.footA)) + '</p>' +
        (hasPay && est ? '<p class="dp-foot">' + esc(T.footEst) + '</p>' : '') +
        (hasPay && gap ? '<p class="dp-foot">' + esc(T.footGap) + '</p>' : '')
      : '';
    box.innerHTML = cards.length ? '<div class="dp-kpis">' + cards.join('') + '</div>' + fo : '';
    box.hidden = !cards.length;
  }

  // ── ② 給与構成 ────────────────────────────────────────────────
  /* 絵は PVViz.donutFromSegs に任せる。ここでするのは
     「モックの3列の表に見えるように、金額の列を足して見出し行を挿す」だけ。
     ★amounts:false で呼ぶ。あちらの凡例の金額は fmt(v) ＝ **割合を金額として**
       刷ってしまう（渡している v が pct だから）。金額は自分で足す。
     ★2026-10-12 から、ここに来る割合と月額は**内訳を書いた人の平均**（サーバが金額を先に
       平均して、割合をその平均から出している）。見出しの字も「平均」（T.center / T.thA）。
     ★comp が null ＝ 内訳を書いた人が足りない区分。年収が出ていても、ここは今までの
       「まだ出せません」の板（下の最初の枝。文言は足していない）。
     ★★**項目の数で伏せない**（2026-10-12）。前は「未分類を除いて3項目に満たなければ、
       カードごと『まだ出せません』」だった。サーバが正しい平均を2行で返すことがある ──
       基本給＋変動給の2つだけの区分・基本給＋「その他・未分類」（ほかは持つ人が足りず
       畳まれた）。それを画面が自分の決まりで隠していた。
       出せるかどうか（内訳を書いた人の壁・項目ごとの壁・畳み方）は、**サーバがもう決めて
       いる**（db/deep-pay.sql の cthin / cnorm）。画面は来た行をそのまま描く ── 1行でも、
       未分類だけでも。「まだ出せません」にするのは、comp が無いか、割合が正の行が
       1つも無いときだけ。
       ⚠️ ここへ「◯項目以上」の決まりを足し戻さない（壁を2か所に置くと、片方だけ直した日に
          静かに食い違う。隠す側に倒れるので、どこも赤くならない）。 */
  function comp() {
    var box = el('dp-comp');
    if (!box) return;
    var c = S.data && S.data.comp;
    var segs = (c && Array.isArray(c.segs)) ? c.segs : [];
    var s = { total: 0, segs: [] };
    segs.forEach(function (x) {
      var p = x ? num(x.pct) : null;
      if (p == null || !(p > 0)) return;
      s.segs.push({ k: x.k, c: COL[x.k] || COL.rest, v: p });
      s.total += p;
    });
    if (!c || !s.segs.length) {
      box.innerHTML = sec(T.compT, empty(T.compNone) +
        '<p class="dp-cta-n">' + esc(T.compNoneS) + '</p>' +
        '<a class="dp-cta" href="pay-report.html">' + esc(T.lockCta) + '</a>', T.compS);
      box.hidden = false;
      return;
    }

    var body = V.donutFromSegs(s, {
      title: '', name: CN, amounts: false, center: T.center
    });

    /* ★ここに在った「賞与・利益分配 ◯%（年収に占める割合）」の1行は 2026-10-12 に外した。
         サーバの割合（comp.bonus）は、内訳を書いた人のうち賞与を答えていない人を 0 として
         数えた比なので、低く出る。すぐ上の年収は「平均賞与を使った推計」── 同じ画面に
         並べると食い違って見える。⚠️ comp.bonus を読む行を足し戻さない（円にも入れない ──
         賞与は年1回で、月々の現金の100%を壊す。オーナー確定 2026-08-29）。 */
    body += note(esc(T.compNote));
    /* 断りは、未分類の行が**実際に描かれている**ときだけ（s.segs ＝ 割合が正の行）。 */
    if (s.segs.some(function (x) { return x.k === 'rest'; })) body += note(esc(T.restNote));
    /* ⚠️ ここに `.dp-foot` を戻さない（人数の壁も年収の定義も kpis() の全幅の行に移した）。
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
  /* その項目の月額（USD）。★鍵は avg_usd（2026-10-12。内訳を書いた人の平均）。
     ⚠️ 前の鍵（中央値だった頃の名前）へ読み替えない ── SQL を貼る前の古い答えは金額が
        中央値で、見出しは「平均」。読み替えると、中央値を平均と名乗って出すことになる。
        鍵が無ければ undefined ＝ 欄は「—」（来ていないものを作らない）。
     ★rest（その他・未分類）にも金額が来ることがある。ほかの項目と同じに出す。 */
  function segByKey(segs, k) {
    for (var i = 0; i < segs.length; i++) if (segs[i].k === k) return segs[i].avg_usd;
    return null;
  }
  /* ★無い区分は null を返す。0 を返さない ── 0% と書けば「その手当が無い会社」に見えるが、
     実際は「人数の壁に届かず出せない」だけのことがある。 */
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
     ★night / weekend / holiday はサーバが3つのまま返す。ここで束ねない。
     ★2026-10-12 から、鍵に rest が来ることがある ── 人数の壁に届かず、単独では並べられ
       なかった連動先を、サーバが1つに畳んだ分（前は配列ごと落として、残りを100に直していた）。
       名前は給与構成と同じ「その他・未分類」（CN.rest）・棒は同じ灰色（COL.rest）。
       連動先ではないので、橙（変動給の色）で塗らない・頭の1文で名指ししない。
     ★var は3通り ── null（区分が出ていない／内訳を書いた人が足りない）・空の配列
       （変動給の内訳がそろった人が足りない）・割合の配列。前の2つは、今までどおり節ごと出さない。 */
  function vari() {
    var box = el('dp-var');
    if (!box) return;
    var v = (S.data && S.data['var']) || [];
    if (!v || v.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
    var top = v.reduce(function (a, x) { return Math.max(a, num(x.pct) || 0); }, 0) || 1;
    var rows = v.map(function (x) {
      var p = num(x.pct);
      if (p == null || !(p > 0)) return null;
      var rest = x.k === 'rest';
      var nm = rest ? [CN.rest, ''] : (VN[x.k] || [x.k, '']);
      return li({ t: nm[0], s: nm[1], v: Math.round(p) + '%', w: p / top * 100,
                  c: rest ? COL.rest : COL.variable, svg: IC.layer });
    }).filter(Boolean);
    if (rows.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
    /* ★一番大きい区分を1文にする。**2区分以上あるときだけ**（1つしか無いと
       必ず「100%」になり、読んでも何も分からない行が1本増えるだけ）。
       値は既に画面に出ている var[0].pct をそのまま使う ── 表の数字と1桁も違わない。
       ★畳んだ分（rest）は選ばない ──「変動給の ◯% は「その他・未分類」に連動しています」は
         文にならない。名前の在る連動先のうち、いちばん大きいものを言う。 */
    var lead = '';
    var t0 = v.filter(function (x) { return num(x.pct) > 0 && x.k !== 'rest'; })
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
       役割別ができたら ln() をもう1本足すだけでよい。
     ★★2026-10-12（オーナー判断「会社比較はまだ出さないでよ」）── 会社比較が閉じている
       あいだ、このカードは**枠ごと出さない**。いま入口は会社比較の1本しか無いので、
       それを消すとカードには押せるものが1つも残らない（題と説明だけの箱を置かない）。
       ⚠️ 下の住所の字（'deep-pay-compare.html'）は、このファイルでここ1か所だけ。
          assert-deep-pay.mjs の ① が「この関数の中に在る・閉じている枝より後ろに在る」
          ことを見ている ── ほかの関数から会社比較へ繋がない。 */
  function more() {
    var box = el('dp-more');
    if (!box) return;
    if (!compareOpen()) { box.innerHTML = ''; box.hidden = true; return; }
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
  /* ── 錠前の板に「どの行を出すか」（2026-10-11）──────────────────
     ★決めるのは**この関数1つ**。deep-pay.js と deep-pay-compare.js に同じ本体を
       置いてある（ビルドが無いので共有できない。ずれは assert-deep-pay-compare.mjs
       の「写した関数」が見張る）。前は2つの画面が別々に組んでいて、比較の側だけ
       「100人に届いていない」の行を持っていなかった ── 鍵も内訳もそろった人に
       「内訳を出すと開きます」と出ていた（その人を止めているのは人数なのに）。
     閉じている理由は3つで、**当てはまるものを全部**出す：
       鍵が無い              → lockKey
       本人が答えきっていない → lockReady（gate.ready が true で**ない**とき）
       みんなの側が未達      → lockGoal（gate.crowd が false のときだけ）
     ★2つめは 2026-10-11 に入れ替えた（オーナー判断）。前は「内訳が1つでもあるか」
       （gate.detailed → lockDet）だった。サーバはその鍵を名前ごと外し、代わりに
       ready（自分に当てはまる項目をぜんぶ答えた月が1つ在るか。公開より前に内訳の
       3つに答えていた人も true ── サーバの v_old）を返す。
       ⚠️ `=== true` で読む。ready を返さない古いサーバ（db/deep-pay.sql を貼る前）の
          答えは「答えきっていない・残りの一覧は無い」として扱う ── 値が無いのを
          開いている側へ倒さない（門そのものはサーバに在る。ここは板の文だけ）。
     ★3つめは gate.crowd を読む。contributors と goal を比べて自分で決めない。
       門は「100人以上 または 手動の公開フラグ」なので、フラグで開けた日
       （99人のまま開いている）に比べると、鍵の無い人へ「100人に届いたら開く」が
       出てしまう ── その人を止めているのは人数ではない。
     ⚠️ 当てはまる行が無いときに、別の行で埋めない（crowd を返さない古いサーバで、
        鍵も答えもそろった人がここに来る）。理由を画面で推し量ると、間違った
        頼みごとをすることになる。行は出さず、板の見出しだけにする。
     ★{goal}・{n} はサイト全体の数。**区分の人数ではない**（この画面で人数が
       出てよいのはこの1行だけ）。数が欠けていたら行ごと出さない（0 で埋めない）。 */
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
                                        開いて出す」住所。actual-pay.js の DETAIL_URL と同じ）
       鍵も答えもそろっている        → フォームの頭（止めているのは人数。今までどおり）
     ★足りない項目はこの画面では聞かない。給与フォームで足してもらう
       （2026-10-11 オーナー判断。板の中に入力は置かない ── 板の入口はこのボタン1本）。
     ★相対のまま書く。/en/ の画面からは /en/pay-report.html に解ける。
     ★ここから下の6つ（lockHref / todoNames / todoMonth / lockTodo / lockHtml / lockBoard）は
       deep-pay-compare.js と**同じ本体**（ずれは assert-deep-pay-compare.mjs の
       「写した関数」が見張る）。 */
  function lockHref(gate) {
    var g = gate || {}, rdy = g.ready === true;
    if (g.key) return rdy ? 'pay-report.html' : 'pay-report.html#pay-detail';
    return rdy ? 'pay-report.html#ps' : 'pay-report.html';
  }
  /* ── まだ答えていない項目の名前（2026-10-11）──────────────────────
     サーバ（gate.todo.items）が返すのは**コードだけ**。画面がここで言葉に直す。
     ★名前は**給与フォームの欄の見出しと1文字も違えない**（pay-report.html /
       en/pay-report.html の <label> の字。「必須」「任意」の札は除く）。板で読んだ
       言葉を、フォームでそのまま探せるようにするため。CN（給与構成の凡例）の
       言い方とはわざと違う ──「住宅手当」ではなく、フォームの問いの「住居」。
       ⚠️ フォームの見出しを変えたら、ここも直す。assert-deep-pay.mjs の ⑫ が
          フォームの HTML から見出しを切り出して、この表と突き合わせている。
     ★item … 欄の見出しそのまま。役職・区分（roles）もここ。
       role … 役職・区分の箱（チェックボックス）の字。板には sfx を足して
              「教官・訓練担当の手当」と出す（その役割の「別に支給されているか」の
              問いと金額が残っている、という意味）。
     ⚠️ コードの集合と並びは db/deep-pay.sql の pv_deep_missing が正。並べるのは
        サーバで、ここは引くだけ。**表に無いコードは出さない**（lockTodo の注）。
     ⚠️ 関数にしてあるのは、2つの JS に同じ本体を置いて機械で突き合わせるため
        （T は画面ごとに中身が違うので、表を T に入れると見張れない）。 */
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
  /* 対象月の言い方。★pv-pay-fix.js（出し直しのお願い）の month と同じ形
     ──「2026年9月分」／「September 2026」。あちらは IIFE に閉じていて借りられない。 */
  function todoMonth(y, m) {
    var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
               'August', 'September', 'October', 'November', 'December'];
    return L === 'en' ? MON[m - 1] + ' ' + y : y + '年' + m + '月分';
  }
  /* 板の中の「まだ答えていない項目」の一覧。答えきっていない行のすぐ下に入る。
     ★並びは**届いた順**（サーバが固定の並びで返す）。ここで並べ替えない。
     ★表に無いコードは**行ごと出さない**。コードをそのまま画面に出さない ──
       サーバが項目を1つ足して、画面がまだ古い日に「duty_x」のような字が出るより、
       その1つが黙って抜けるほうがまし（線そのものはサーバに在るので、門は緩まない）。
     ★サーバから来た字は1文字も HTML に入れない。コードは表を引く鍵にしか使わず
       （字でないものは読まない・hasOwnProperty で引く ── constructor のような名前を
       拾わない）、年と月は数に直して範囲を見てから出す。出る字は全部この表の字で、
       それも esc を通す。
     ⚠️ 一覧が無い・空・月が読めないときは**空文字を返す**（見出しだけの箱を出さない）。
        窓の中に自分の行が無い人と、古いサーバの答えがこの形。 */
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
  /* 錠前の板そのもの。2つの画面が**同じ板**を出す（前は shut() の中に別々に書いていた）。
     ★どの行を出すかは lockLines() が決める。ここで足したり埋めたりしない。
     ★一覧（lockTodo）は「答えきっていない」の行の**すぐ下**。その行が無ければ出ない。
     ★断り（lockWarn）は、その行が出ているとき**だけ**出す（文と条件はオーナー指定
       2026-10-11）。鍵だけ・人数だけが理由の人には出さない ── その人は「答え方」を
       頼まれていない。置き場所はボタンのすぐ上（指定は「すぐ上か下」。押す前に
       目に入る側にした）。静かな1行で、警告の箱にはしない。
     ★入口はボタン1本（行き先は lockHref）。板の中に入力もリンクも足さない。 */
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
     「DEEP PAY でまだ開かない人には給与詳細を提出させる。背景にはぼかした DEEP PAY を
       表示させる。」── 閉じているときは、板の後ろにこの画面の**形だけ**を置いてぼかす。
     ★★影絵は絵であって、データではない。**字も数字も1つも持たない。**
       ・下の gh* と ghostShapes() は、引数も外の値も読まずに固定の文字列を返す
         （サーバの答え・S・保存領域・計算した値・乱数のどれにも触らない）。
       ・中身は空の要素だけ ── カードの枠・円・棒の地と伸び・灰色の線。金額・社名・
         区分名はもちろん「それらしい数字」も置かない（置けば作り物のデータになる）。
       ・色だけは PVViz.SEG の実物（ghostTint。円と棒が本物と同じ色に見えるように）。
       ・棒の長さ・円の割り方は CSS に在る飾りの寸法（deep-pay.css の .dp-ghost の節）。
         だからこの一式の字面には**数字が1文字も出てこない**（assert-deep-pay.mjs の ② が、
         この一式の字面と、組み上がった HTML の両方を見ている）。
     ⚠️ ぼかしは隠す道具ではない（開発者ツールで誰でも外せる）。だから、外されて困る
        ものを影絵に入れない ── **本物の値を描いてからぼかす形にしない。**
        鍵の無い人へは、サーバが今までどおり数字を返していない（picks / cohort / head /
        comp / work / var は null）。影絵のために何かを足して引くこともしない。
     ⚠️ 開いた画面には影絵そのものが DOM に無い（lockStage を通るのは shut() の2本だけ ──
        会員の閉じた板 'lock' と、ログインしていない人の板 'anon'。どちらも数字が
        1つも来ていない画面）。
     ★aria-hidden と inert を必ず付ける（lockStage）。読み上げにもキーボードにも、
       在るのは板だけ。
     ★ghBar / ghBars / ghField / ghHead / ghostTint / lockStage の6つは
       deep-pay-compare.js と**同じ本体**（ずれは assert-deep-pay-compare.mjs の
       「写した関数」が見張る）。ghostShapes() だけは画面ごとに別（写す画面の形が違う）。 */
  function ghBar(mod) { return '<span class="dp-gh-ln dp-gh-ln--' + mod + '"></span>'; }
  function ghBars(mods) { return mods.split(' ').map(ghBar).join(''); }
  function ghField() {
    return '<span class="dp-gh-fld">' + ghBar('xs') + '<span class="dp-gh-box"></span></span>';
  }
  function ghHead() { return '<div class="dp-gh-h">' + ghBar('t') + ghBar('s') + '</div>'; }
  /* 影絵の色。★PVViz.SEG から引いた COL（区分 → 色）を、CSS の変数として渡すだけ。
     値は色で、数量ではない。CSS の側が var(--gh-base) のように名前で引く。 */
  function ghostTint() {
    return Object.keys(COL).filter(function (k) { return !!COL[k]; })
      .map(function (k) { return '--gh-' + k + ':' + COL[k]; }).join(';');
  }
  /* この画面の形 ── 上から 選ぶ欄 ／ KPI のカード3枚 ／ 給与構成（円と凡例）｜働き方 ／
     何をすると増えるか（棒）｜もっと深く見る。骨組みは本物と同じクラスで組んである
     ＝ 幅で畳まれ方が変わるのも本物と同じ。
     ★2026-10-12、会社比較を閉じた。開いた画面の「もっと深く見る」のカードはいま出ないが、
       **影絵には残してある** ── 影絵は外の値を1つも読まない固定の絵で（定数も読ませない。
       検査がこの関数だけを取り出して実行している）、ぼかした形が右下に1枚多いだけ。
       出す日に戻す物を、ここに増やさない。
     ⚠️ .dp-kpi は使わない（影絵のカードは .dp-gh-kpi）。検査も撮影の道具も、KPI の
        カードが出たかどうかを .dp-kpi で数えている。
     ⚠️ 行や枚数を増やすときも、**数字を書かずに**並べる（'a b c' を割って数える）。 */
  function ghostShapes() {
    var kpi = function (mod, ic) {
      return '<div class="dp-gh-kpi' + mod + '"><span class="dp-kpi-ic' + ic + '"></span>' +
        '<span class="dp-gh-col">' + ghBars('s xl m') + '</span></div>';
    };
    var row = function (inner) {
      return '<div class="dp-li"><span class="dp-li-ic"></span>' + inner + '</div>';
    };
    var leg = ['base', 'variable', 'command', 'perdiem', 'housing', 'other'].map(function (k) {
      return '<div class="pt-leg"><i style="background:var(--gh-' + k + ')"></i>' +
        ghBars('m xs s') + '</div>';
    }).join('');
    var duty = 'a b c d'.split(' ').map(function () {
      return row('<span class="dp-li-l">' + ghBars('m s') + '</span>' + ghBar('s'));
    }).join('');
    var vari = 'a b c d e f'.split(' ').map(function () {
      return row('<span class="dp-li-l">' + ghBars('l m') + '</span>' +
        '<span class="dp-li-b"><i class="dp-li-f"></i></span>' + ghBar('xs'));
    }).join('');
    return '<div class="dp-pick">' + ghField() + ghField() + ghField() + '</div>' +
      '<div class="dp-kpis">' + kpi('', ' dp-kpi-ic--org') +
        kpi(' dp-gh-kpi--green', ' dp-kpi-ic--grn') + kpi('', ' dp-kpi-ic--tea') + '</div>' +
      '<div class="dp-row">' +
        '<div class="dp-gh-wide mr-card">' + ghHead() +
          '<div class="pt-donut-wrap"><div class="pt-donut"><span class="dp-gh-ring"></span></div>' +
          '<div class="pt-legend">' + leg + '</div></div></div>' +
        '<div class="mr-card">' + ghHead() +
          '<div class="dp-list dp-list--work">' + duty + '</div>' +
          '<div class="dp-hint"><span class="dp-gh-col">' + ghBars('l w') + '</span></div></div>' +
      '</div>' +
      '<div class="dp-row dp-row--var">' +
        '<div class="mr-card">' + ghHead() + ghBar('w') +
          '<div class="dp-list dp-list--var">' + vari + '</div></div>' +
        '<div class="mr-card"><div class="dp-more"><div class="dp-more-l">' +
          '<span class="dp-more-ic"></span><span class="dp-gh-col">' + ghBars('m l') + '</span></div>' +
          '<span class="dp-gh-pill"></span></div></div>' +
      '</div>';
  }
  /* 閉じているときの画面まるごと ＝ 影絵（後ろ）＋ 板（手前）。
     ★gate を渡すのは板（lockHtml）に**だけ**。影絵の側は引数なしで呼ぶ。
     ★器（.dp-stage）が1つの子として #dp-kpi に入る ── lockBoard の「中身が同じなら
       組み直さない」は、この器ごとに効く（影絵は固定なので、変わるのは板だけ）。 */
  function lockStage(gate) {
    return '<div class="dp-stage">' +
      '<div class="dp-ghost" aria-hidden="true" inert style="' + esc(ghostTint()) + '">' +
        ghostShapes() + '</div>' +
      lockHtml(gate) + '</div>';
  }
  /* 板を組むのは、中身が変わった回だけ。render() は何度も走る（社名の辞書があとから
     届く・通貨の切替）── 毎回組み直すと、Tab でボタンまで来た人の焦点が外れる。
     ★印（pvSig）は器（.dp-stage ＝ 影絵＋板）に持たせる。ほかの描き手（ask / thin / KPI）が
       #dp-kpi を書き替えれば器ごと消えるので、古い印で「同じ」と読み違えない。 */
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
     DEEP PAY には公開の入口が在る（REAL PAY の見出しのタブ。あちらは未ログインの人にも
     見える）。前は、ログインしていない人がここへ来るとログイン画面へ送っていた。
     いまは**会員で、まだ開いていない人と同じ画面**を出す ── ぼかした影絵の手前に板。
     ★板は新しく書かない。「鍵が無く、答えきってもいない」会員の門と**同じ形の入れ物**を
       作って、同じ lockStage（→ lockHtml → lockLines / lockHref）へ通す。題・行・断り・
       ボタンの字と行き先（給与フォームの頭 ── あちらはログインなしで出せる）は、
       会員のその板と1文字も違わない。**字をここに書かない・文もリンクも足さない。**
         todo:null  … 残りの一覧は出ない（会員が居ないので、答えた項目も無い）
         crowd:true … 100人の行を出さない（サーバに聞いていないので、数を知らない。
                      知らない数を 0 や仮の数で埋めない）
     ⚠️ サーバには**聞かない**。pv_deep_pay() は未ログインだと必ず落ちる（auth.uid() が
        null なら 42501。anon には実行の権限も無い）。この入れ物は答えではなく、
        聞かずに描くための固定の値 ── 引数も外の値も読まない。
     ⚠️ これで開くものは無い。門はサーバに在り、ここは板の字を選ぶだけ。
     ★anonGate / authLost の2つは deep-pay-compare.js と**同じ本体**
       （ずれは assert-deep-pay-compare.mjs の「写した関数」が見張る）。 */
  function anonGate() { return { key: false, ready: false, todo: null, crowd: true }; }
  /* サーバが「ログインしていない」と答えたか。★セッションは端末に残っているのに、
     サーバの側では切れていた回（期限が切れた・別のタブでログアウトした）。
     見分けるのは2つだけ ── pv_deep_pay() が未ログインのときに投げる 42501 と、
     HTTP 401（鍵が無効・期限切れ）。supabase-js の答えは { error:{ code }, status }。
     ⚠️ ほかの失敗（通信が切れた・サーバが落ちた・知らないエラー）は false のまま
        ＝ 今までどおり「読み込めませんでした」。全部をこちらへ倒すと、通信が悪いだけの
        会員に「給与を出してください」と頼むことになる。
     ⚠️ 誰がログインしているかを決めるのは pv-session.js とページの PV_SESSION。
        ここは答えを読むだけで、端末のログインの控えには触らない（消さない・書かない）。 */
  function authLost(res) {
    var e = res && res.error;
    return !!e && (String(e.code) === '42501' || Number(res.status) === 401);
  }
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
    /* ★ログインしていない人（kind === 'anon'。2026-10-11）。同じ器（影絵＋板）を、
         作り物の門 anonGate() で組む ── サーバの答え（S.data）は読まない（聞いていない）。
       ⚠️ ここで戻る ＝ 下の partyMark() を**通らない**。印は「閉じた板を見た会員」の
          控えで、この板は会員の門を見て出したものではない（ログインが切れただけの会員には
          指紋が在る ── 印を置くと、前から開いていた人がログインし直した日に鳴ってしまう）。
          端末には何も書かない。 */
    if (kind === 'anon') { lockBoard(box, lockStage(anonGate())); return; }
    /* ★板の中身（行・残りの一覧・断り・ボタンの行き先）は lockHtml() が決める（上の注）。
         ここで足したり埋めたりしない。置くのは lockBoard()（中身が変わった回だけ）。
       ★2026-10-11 から、板は「ぼかした影絵の手前」に出す（lockStage ＝ 影絵＋板）。
         影絵は字も数字も持たない固定の絵で、S.data からは gate しか使わない
         （鍵の無い人の答えに head / comp が紛れて来ても、ここからは描かれない）。 */
    lockBoard(box, lockStage((S.data && S.data.gate) || {}));
    /* ★「この会員は閉じた板を見た」と端末に控える（開いた日のクラッカー用。下の節）。
         書くだけで、ここでは何も読まない ── 板の中身にも門にも関係しない。 */
    partyMark();
  }

  /* ★選んだ区分が人数の壁に届かなかったとき。**広い区分の数字で埋めない。**
     「あと1人」とも、壁が何人かとも書かない ── 書いた瞬間、その区分の人数が
     1人単位で読める。 */
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
       （★2026-10-12 から会社比較は閉じている ── あちらは板を出して終わり、印を読みも
         消しもしない。いま鳴るのはこの画面だけ。決まりは出す日のためにそのまま。）
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
    picker(); head();
    if (S.mode === 'error') { shut('error'); return; }
    /* ★ログインしていない人（2026-10-11）。会員の閉じた板と同じ器を、サーバに聞かずに出す。
         ⚠️ この行は「開いている」枝より前 ＝ partyPop() を通らない（鳴らさない）。 */
    if (S.mode === 'anon')  { shut('anon');  return; }
    /* ★最初の答えが来るまでは、HTML に置いてある骨組みのまま待つ（2026-10-11）。
         前はここを素通りして shut('lock') に落ちていた ── 社名の辞書が RPC より先に
         届くと、**開いている人にも**「DEEP PAY はまだ開いていません」の板が一瞬出ていた
         （実測：RPC を 2.5 秒遅らせると、そのあいだずっと出ている）。板の後ろに影絵を
         置いたいま、同じことが起きると画面まるごとが霞んで見えてから開くことになる。
         会社比較（deep-pay-compare.js）は前からこの形（load のあいだは骨組み）。 */
    if (S.mode === 'load')  return;
    if (S.mode !== 'open')  { shut('lock');  return; }
    /* ★ここまで来た ＝ 開いている。閉じた板を見たことのある会員なら、1回だけ
         クラッカーを鳴らす（鳴らすかどうかは partyPop() の中。返り値は使わない ──
         この下の描き分けは、鳴っても鳴らなくても1文字も変わらない）。 */
    partyPop();
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
      /* ★失敗は2つに分ける（2026-10-11）。サーバが「ログインしていない」と答えた回
           （authLost ＝ 端末にはセッションが残っているのに、サーバの側では切れていた）は、
           ログインしていない人と同じ板。それ以外は今までどおり「読み込めませんでした」。
         ⚠️ どちらもここで戻る ＝ 下の PVGates.mark() を通らない（答えが無いのに、
            左メニューの錠前の控えを書き換えない）。 */
      if (res && res.error) { S.mode = authLost(res) ? 'anon' : 'error'; render(); return; }
      var v = res && res.data;
      S.data = v || null;
      S.mode = (v && v.state === 'open') ? 'open' : (v ? 'locked' : 'error');
      /* ★一度届いた一覧は消さない。区分を選び直すたびに引き直すので、
           1回でも欠けた答えが来ると選択欄がまるごと消えてちらつく。 */
      setPicks(v && v.picks);
      /* 左メニューの錠前（REAL PAY の段）は localStorage の写しで暫定的に出ている。
         サーバの答えで上書きする。★DEEP PAY 自身が開いているかは別の話で、左メニューには
         出さない（閉じている人には、この画面の板が理由を見せる）。
         ★その下の setProgress は、2026-10-11 から受け取るだけで何もしない（pv-gates.js）。 */
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
