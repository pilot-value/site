/* ════════════════════════════════════════════════════════════════
   pay-viz.js — 明細1行から図を作る。文言もDOMも持たない。

   pay-tracker.js（マイページの明細トラッカー）から切り出した。
   my-value.html（市場価値レポート）が同じ図を出すので、共有できる形にした。

   ── なぜモジュールに出すか（複製の禁止）────────────────────────
   ★ calc() は **絶対に複製しない**。時給の分子（年額 − 賞与 ÷12 − パーディアム）が
     2箇所にあると、片方だけ直したときに画面とDBの定義が静かにずれる。
     db/test-form-contract.mjs が見張っているのは、まさにこの事故。
   ★ .pt-* の見た目は pay-viz.css。読み込まないと素のHTMLが出る。

   ── 持たないもの ──────────────────────────────────────────────
   ・文言：呼ぶ側が渡す（JA/EN の2言語ぶんは各ページの T が持っている）
   ・DOM ：root も document も見ない。文字列を返すだけ
   ・幅   ：chart() は実測しない。呼ぶ側が widthOf() で測って渡す
     （viewBox を伸縮させると文字まで拡大縮小されてスマホで読めなくなるので、
       コンテナの実寸で組む。だから測る主体は DOM を持っている側）

   ── 数字の作り方（勝手に良く見せない）──────────────────────────
   ・時給の分子は annual_total_orig から賞与を抜いた月額。サーバが
     pv_annual_total() で計算した値をそのまま使う＝画面とDBがずれない。
   ・パーディアムは分子から抜く（非課税の実費補填。payslip.js と同じ扱い）。
   ・分母は block（飛んでいた時間）と duty（待機・地上を含む拘束時間）の2本。
     同じ明細で倍ちがうので、片方だけ出すと必ず誤解される。
   ・flight_variable_pay は other_allowance の**内訳**（payslip.js の
     KIND_FIELD が f-other に足し込む）。足すと二重計上になるので割って描く。
   ・現物支給の社宅は現金ではないので内訳に入れない（housing_type を見る）。
   ・累計（totals）は「出した明細ぶんだけ」の足し算。出していない月は入らないので、
     呼ぶ側は必ず枚数と対象期間を一緒に出すこと。生涯年収ではない。

   ── 通貨 ──────────────────────────────────────────────────────
   金額は必ず fmt() を通す＝通貨切替に載る。currency.js の自動スキャンは
   text を span で包むので SVG の中では使えない。呼ぶ側はカードに pv-no-cur を
   付けて、切替時に 'pv-currency-change' で描き直すこと。
   ════════════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';

  /* 内訳の色（salary-leveling.js の内訳色を踏襲）。名前は呼ぶ側が持つ。 */
  var SEG = [
    { k: 'base',      c: '#34d399' },
    /* ★保証給（2026-08-26）。基本給の隣だが、緑と紛れない黄緑にする。
       同じ緑の濃淡にすると、ドーナツで境目が読めない。 */
    { k: 'guarantee', c: '#a3e635' },
    { k: 'command',   c: '#5fb0ff' },
    /* ★教官・訓練の手当（2026-08-26）。職位手当（水色）の隣に置くが、
       色は空いている赤に振る。緑・黄緑・水色・金・紫・橙・灰・桃・シアンが
       すでに埋まっていて、細いドーナツの弧で見分けられるのは赤だけだった。 */
    { k: 'instructor', c: '#e8604c' },
    /* ★審査・査察の手当（2026-08-26 その4）。教官の隣に置く。
       赤・緑・黄緑・水色・金・紫・橙・灰・桃・シアンが埋まっているので、
       残るのは濃い青緑。ブランドの --pv-teal をそのまま使う（色を発明しない）。 */
    { k: 'examiner',  c: '#0f766e' },
    /* ★組合・乗員代表の手当（2026-08-26 その5）。審査の隣に置く。
       残っていた空きは赤紫。左隣の青緑（#0f766e）とも、右隣の金（#f5c842）とも
       色相が離れていて、その他の紫（#a78bfa）とは明るさで割れる。 */
    { k: 'union',     c: '#7c4a8d' },
    /* ★管理・マネジメントの手当（2026-08-26 その6）。組合の隣に置く。
       残っていた空きはブロンズ（暖色の暗い側）。左隣の赤紫（#7c4a8d）とは色相で、
       右隣の金（#f5c842）と橙（#fb923c）とは明るさで、赤（#e8604c）とは彩度で割れる。 */
    { k: 'management', c: '#8a5a2b' },
    /* ★その他の兼務・配属の手当（2026-08-27 その7）。管理職の隣に置く。
       残っていた空きは濃紺。左隣のブロンズ（#8a5a2b）とも右隣の金（#f5c842）とも
       色相が離れ、職位手当の水色（#5fb0ff）とは明るさで割れる（弧は4切れ離れている）。 */
    { k: 'nonline',   c: '#2f5fa8' },
    { k: 'flight',    c: '#f5c842' },
    { k: 'other',     c: '#a78bfa' },
    { k: 'housing',   c: '#fb923c' },
    { k: 'transport', c: '#94a3b8' },
    { k: 'perdiem',   c: '#f472b6' },
    /* ★下の2つは segments() の「総支給1本」の枝でしか出ない。
       その枝には基本給（緑）も機長手当（水色）も出ないので、水色系を選んでも紛れない。 */
    { k: 'bonus',     c: '#22d3ee' },
    { k: 'rest',      c: '#5c6675' }   // 交通費の #94a3b8 より濁らせる＝「まだ埋まっていない」
  ];
  var LINE = '#f5c842';

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var num = function (v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  };
  var fmt = function (v) {
    if (v == null) return '—';
    if (w.PVCurrency && w.PVCurrency.fmt) return w.PVCurrency.fmt(v);
    return '¥' + Math.round(v).toLocaleString('en-US');
  };

  /* サーバが数えた月額（原本通貨）。db/pay-reports.sql の pv_annual_total が
     「年額 = 12 × 月額 + 年間ボーナス + 利益分配」で作った年額を、そのまま逆算する
     ＝ここで新しい数字を作っていない。
     ★ 内訳（基本給・手当…）で入れた行は総支給の欄そのものが空なので、
       その月の額はここからしか出せない。calc() と grossOrig() の両方が使うため、
       式は必ずここ1つに置く。
     ★ かんたん入力の行では「総支給 − その月のボーナス」になる＝総支給ではない。
       grossOrig() が総支給の欄を先に見るのはそのため。 */
  function monthlyOrig(r) {
    var ann = num(r.annual_total_orig);
    if (ann == null) return null;
    var bonus = (num(r.bonus_annual) || 0) + (num(r.profit_share_annual) || 0);
    return (ann - bonus) / 12;
  }

  /* ── 1行ぶんの数字を作る ───────────────────────────────────
     分子は「サーバが数えた年額 − 賞与」÷12。画面で足し直さないので、
     DB の集計（pay_benchmarks）と定義がずれない。
     ★時間あたりの分子だけは「飛んだことへの対価」に絞る（2026-09-02）。
       パーディアム（実費）に加えて、組合が総支給の外で払った分も抜く。
       あれは乗務の対価ではなく、むしろ組合活動で**飛べていない**月に出るので、
       抜かないと「時間あたりが倍」という嘘の数字になる。
       サーバ側の pv_block_hour_usd（db/pay-reports.sql）と同じ抜き方。 */
  function calc(r) {
    var fx = num(r.fx_to_jpy);
    var monthly = monthlyOrig(r);                                      // 原本通貨・月額
    var pd = num(r.per_diem) || 0;
    var uo = r.union_outside_gross ? (num(r.union_pay) || 0) : 0;      // 総支給の外の組合分
    var numer = (monthly != null) ? Math.max(0, monthly - pd - uo) : null;
    var bh = num(r.block_hours), dh = num(r.duty_hours);
    var jpy = function (v) { return (v != null && fx != null) ? v * fx : null; };
    return {
      hourlyBlock: (numer != null && bh > 0) ? jpy(numer / bh) : null,
      hourlyDuty:  (numer != null && dh > 0) ? jpy(numer / dh) : null,
      annual: num(r.annual_total_jpy),
      net:    jpy(num(r.net_pay_actual)),
      blockH: bh, dutyH: dh
    };
  }

  function metricOf(r, key) {
    var c = calc(r);
    return key === 'annual' ? c.annual : key === 'net' ? c.net : c.hourlyBlock;
  }

  /* ── 総支給（額面）───────────────────────────────────────────
     ★ pay_reports に総支給の列は無いので、3通りの道で作る。上から順に試す
       （VERIFIED-PILOT 3-4。控除の内訳は持たないので、合計だけが手に入る）。
     ★ 原本通貨のまま返す。円に直してから引き算する側（月どうしの増減）で
       為替の動きが「昇給」に化けるため、換算は呼ぶ側の最後にやらせる。
     ★ この式をここ以外に書かない。my-value.js の §4（額面と手取り）・
       §6（前回との差）・§7b（累計）の3箇所が同じ「総支給」を名乗るので、
       複製すると同じページの中で違う額面が並ぶ。
       db/test-form-contract.mjs が置き場所を1つに固定している。 */
  function grossOrig(r) {
    var n = num(r.net_pay_actual), d = num(r.deduction_total);
    if (n != null && d != null) return n + d;   // 1. 明細に印字されていた実額
    var g = num(r.gross_monthly);
    if (g != null) return g;                    // 2. 本人が書いた総支給（かんたん入力）
    /* 3. 内訳で入れた行。総支給の欄そのものを送らないので、上の2つでは出ない。
          サーバが内訳から数えた月額を使う（明細を出していない人の累計・今月が
          まるごと空になっていた。2026-08-18）。
       ★ 0 は返さない。何も入っていない行の年額は null ではなく 0 で来るため、
         そのまま通すと「今月の総支給 ¥0」になる。 */
    var m = monthlyOrig(r);
    return (m != null && m > 0) ? m : null;
  }

  /* ── 総支給の外で払われた組合の分（円）──────────────────────
     支給元が組合のときだけ、その額は会社の明細に印字されない＝本人が書いた
     総支給の中に無い。**年収は足すが、支給構成の円には入れない。**
     ★ 判定を書き写さない。サーバが付けてくる union_outside_gross を読む
       （db/pay-reports.sql の pv_union_outside_gross が唯一の判定）。
     ★ 円に直して返す（呼ぶ側が「> 0 のときだけ出す」で分岐できる）。
       ここを 0 のまま画面に出さないと、総支給と年換算の掛け算が合わなくなる。 */
  function unionOutsideJpy(r) {
    var fx = num(r.fx_to_jpy);
    if (fx == null || !r.union_outside_gross) return 0;
    return (num(r.union_pay) || 0) * fx;
  }

  /* ── これまでの累計 ──────────────────────────────────────────
     記録した月の支給額を積み上げる。1回出すごとに増える数字。

     ★ ここは月をまたぐ計算だが、**会社では絞らない**。
       §6 の差・§7 の線は「比較」なので同じ会社の中だけに閉じるが、
       これは「これまでに受け取った額の足し算」で、会社が変わっても
       受け取った事実は変わらない。転職前の月も入れる。
     ★ 各月を **その月の fx_to_jpy** で円に直してから足す（＝受け取った時点の
       円価値）。最新レートで全月を換算し直すと、為替が動いただけで
       過去の給料が増えたり減ったりする。
     ★ 額面は **総支給が分かる月ぜんぶ**、手取りは **手取りも書いてある月だけ**
       を数える（2026-08-18）。以前は片方欠けた月を丸ごと捨てていたが、それだと
       内訳だけで入れた月が累計から消えていた。
       控除合計は「手取りを数えた月の額面」から引く＝画面の
       「額面 − 手取り = 控除」は、その部分集合の中で必ず一致する。
       枚数が違うときは monthsNet を添えて、どの範囲の合計かを画面に出す。
     ★ 1行も無いときは 0 ではなく null。0円と言うと「稼いでいない」に読める。
       実際は「まだ読み取れていない」。

     戻り: { gross, unionOut, net, deduct, months, monthsNet, skipped, total, from, to, series }
       gross          … 円。総支給が分かる月の合計（＋総支給の外で組合が払った分）
       unionOut       … 円。そのうち組合が総支給の外で払った分（gross の内数）
       net / deduct   … 円。手取りも書いてある月だけの合計（deduct は同じ月の額面 − 手取り）
       months         … 額面を足せた枚数 / monthsNet … 手取りを足せた枚数
       total          … 手元にある全枚数 / skipped … 総支給が出せず落とした枚数
       from / to      … 足せた月のうち最初と最後の行（対象期間の表示用）
       series         … [{ r, gross, net }] の running total（折れ線用） */
  function totals(rows) {
    var list = (rows || []).slice().sort(function (a, b) {
      return (a.period_year * 12 + a.period_month) - (b.period_year * 12 + b.period_month);
    });
    var counted = [], series = [], skipped = 0, gross = 0, unionOut = 0;
    var netMonths = 0, net = 0, netGross = 0;   // 手取りを書いた月だけの合計

    list.forEach(function (r) {
      var g = grossOrig(r), n = num(r.net_pay_actual), fx = num(r.fx_to_jpy);
      if (g == null || fx == null) { skipped++; return; }
      /* ★組合が総支給の外で払った分も足す（2026-09-02）。
         ここは「受け取った額の足し算」で、支給構成の円（明細の中の分かれ方）とは
         別の問いに答えている。会社の明細に印字されないだけで、本人は受け取っている。
         足さないと、乗員代表の累計が受け取った額の半分で止まる（本番で1件）。 */
      var uo = unionOutsideJpy(r);
      unionOut += uo;
      gross += g * fx + uo;
      /* ★控除の分母（netGross）には足さない。組合の分は会社の明細の外にあり、
         そこから引かれた控除が1円も無い。足すと画面の
         「額面 − 手取り ＝ 控除」が組合の額ぶんズレる。 */
      if (n != null) { net += n * fx; netGross += g * fx; netMonths++; }
      counted.push(r);
      series.push({ r: r, gross: gross, net: net });
    });

    return {
      gross:     counted.length ? gross : null,
      unionOut:  unionOut,                            // 上の gross に含まれている（内数）
      net:       netMonths ? net : null,
      deduct:    netMonths ? netGross - net : null,   // 同じ月の額面から引く＝必ず一致する
      months:    counted.length,
      monthsNet: netMonths,
      skipped:   skipped,
      total:     list.length,
      from:      counted.length ? counted[0] : null,
      to:        counted.length ? counted[counted.length - 1] : null,
      series:    series
    };
  }

  /* ── 内訳の内訳（円換算・0 は落とす）────────────────────────
     donut() の中で計算していたぶんを外に出した。他社比較の棒グラフでも
     同じ分け方を使うので、ここが唯一の定義。 */
  function segments(r) {
    var fx = num(r.fx_to_jpy);
    if (fx == null) return null;
    var other = num(r.other_allowance) || 0;
    var fv = num(r.flight_variable_pay) || 0;
    // flight_variable は other の内訳。足すと二重計上なので割る。
    // 逆転しているとき（別欄に入れた人）は分けずに other のままにする。
    var split = (fv > 0 && fv <= other);
    var vals = {
      base:      (num(r.base_pay) || 0) * fx,
      /* ★足し忘れると、保証給を入れた人のぶんが下の rest（灰色）に落ちる
         ＝「どの項目にも入れていない分」と表示されて、入れた本人に嘘をつく。 */
      guarantee: (num(r.guarantee_pay) || 0) * fx,
      command:   (num(r.command_pay) || 0) * fx,
      /* ★教官・訓練の手当。other_allowance にも flight_variable_pay にも
         入っていない（フォームが別の入れ物へ送る）ので、ここで独立に読む。
         足し忘れると、入れた人のぶんが下の rest（灰色＝どの項目にも入れていない分）
         に落ちて、入れた本人に嘘をつく。 */
      instructor: (num(r.instructor_pay) || 0) * fx,
      /* ★審査・査察の手当。教官と同じく独立した列で、other_allowance にも
         flight_variable_pay にも入っていない。足し忘れると rest（灰色）に落ちる。 */
      examiner:  (num(r.examiner_pay) || 0) * fx,
      /* ★組合・乗員代表の手当。教官・審査と同じく独立した列。
         足し忘れると rest（灰色）に落ちて、入れた本人に嘘をつく。
         ⚠️ 支給元が組合のときは、この額が総支給の**外**にある（会社の明細に
            印字されない）。それでも**円には入れる**（2026-09-02）── この円は
            「受け取った額がどう分かれているか」で、乗員代表のように半分が組合から
            出ている人の円を、会社ぶんだけで描くと本人の実感と合わない。
            この円ぜんぶが「受け取った額」で、年収（pv_annual_total）も
            DEEP PAY の支給構成（cash_m）も同じ数え方をしている。
            ⚠️ 「基本給が総支給に占める割合」の分母もこれ。引き算はしない
               （2026-09-02 に一度引いたが、年収の定義と食い違うので戻した）。 */
      union:     (num(r.union_pay) || 0) * fx,
      /* ★管理・マネジメントの手当。教官・審査・組合と同じく独立した列。
         足し忘れると rest（灰色）に落ちて、入れた本人に嘘をつく。
         ⚠️ 組合と違い、この額は会社が払う＝総支給の中にある。 */
      management: (num(r.management_pay) || 0) * fx,
      /* ★その他の兼務・配属の手当。教官・審査・組合・管理職と同じく独立した列。
         足し忘れると rest（灰色）に落ちて、入れた本人に嘘をつく。
         ⚠️ 出向の場合、その額を出向先が払っていて会社の明細に載っていないことがある。
            そのとき合計が総支給を超えうるが、その行は下の rest < -1 で図ごと降りる。 */
      nonline:   (num(r.nonline_pay) || 0) * fx,
      flight:    (split ? fv : 0) * fx,
      other:     (split ? other - fv : other) * fx,
      // 現物支給の社宅は現金ではない（pv_annual_total も足していない）
      housing:   (r.housing_type === 'allowance' ? (num(r.housing_amount) || 0) : 0) * fx,
      transport: (num(r.transport) || 0) * fx,
      perdiem:   (num(r.per_diem) || 0) * fx,
      /* ★下の2つは「総支給が入っている行」の枝でしか値が入らない。
           総支給の無い古い行では 0 のまま＝スライスが生えない。 */
      bonus:     0,
      rest:      0
    };

    /* ── 総支給が入っている行 ──────────────────────────────
       2026-08-13 からパーディアムと住宅手当は全員に聞く欄なので、素直に描くと
       「パーディアムと住宅手当で100%」という嘘のドーナツになる。そこで
       **総支給を円ぜんぶ**とし、分かっている手当だけ色を付けて、説明できない
       残りを rest（どの項目にも入れていない分）に置く。基本給を 0 と刷らない。
       ★今月の賞与はこの枝でだけスライスにする。総支給に含まれていて、かつ
         入力画面で全員に聞いている＝本人が入れた数字なので、灰色に混ぜると
         「入れていない」と言うことになる。内訳の行の合計にはボーナスが
         入っていないので、あちらで足すと円の合計が総支給を超える。 */
    var partial = false;
    /* 総支給1本だけで、色の付く手当が1つも無い行（＝かんたん入力で出した人・
       明細の読み取りに失敗した人）。円は描くが、灰色1色になる。 */
    var noBreakdown = false;
    var gross = num(r.gross_monthly);
    // 総支給の外で組合が払った分（円）。上の union に含まれている＝円ぜんぶにも足す
    var outsideGross = unionOutsideJpy(r);
    if (gross != null) {
      /* ★2026-08-26、総支給と内訳が両立するようになった（フォームの作り直し）。
         partial は「総支給がある」ではなく **「基本給が分かっていない」** の意味。
         ここを true 固定に戻すと、内訳を書いた人のレポートから
         「基本給の割合」の1行が黙って消える。 */
      partial = (num(r.base_pay) == null);
      vals.bonus = (num(r.bonus_month) || 0) * fx;
      var known = 0;
      for (var k in vals) if (k !== 'rest') known += vals[k];
      /* ★円ぜんぶ＝**総支給 ＋ 総支給の外で組合が払った分**（2026-09-02）。
         足さないと、上の union を known に数えたぶんだけ known が円を超え、
         rest < -1 で**図が丸ごと消える**。実際、乗員代表の1件がそうなっていた
         （本人が書いた組合の額が総支給の91%だったため）。
         ⚠️ ここを触ったら「基本給が総支給に占める割合」の分母（呼ぶ側は
            この total をそのまま使う）も必ず一緒に確かめる。 */
      var rest = gross * fx + outsideGross - known;
      /* ★色の付く分が1つも無い行でも円を出す（2026-09-02・オーナー指示）。
         前はここで図ごと降ろし、呼ぶ側が**他人の割合の見本**をぼかして出していた。
         給与を出してくれた人の画面に、自分の数字が1つも無い図が並ぶほうが悪い。
         灰色1色でも、真ん中には本人のその月の額が出て、「まだ分かれていない」と
         いう事実を言っている。
         ⚠️ 呼ぶ側は noBreakdown を見て「手当ごとに入れると分かれる」の1行を
            必ず添えること（灰色1色を置きっぱなしにしない）。 */
      noBreakdown = (known <= 0);
      // 手当の合計が総支給を超える行（別建て支給・入力違い）は正しい図を描けない
      if (rest < -1) return null;
      // ★1円の遊び。各値は原本通貨 × fx なので端数が出る。ぴったり説明しきった
      //   行に、丸め誤差ぶんの灰色を生やさない。
      if (rest > 1) vals.rest = rest;
    }

    var segs = SEG.filter(function (s) { return vals[s.k] > 0; })
                  .map(function (s) { return { k: s.k, c: s.c, v: vals[s.k] }; });
    var total = segs.reduce(function (a, s) { return a + s.v; }, 0);
    // partial＝基本給が分かっていない。呼ぶ側は「基本給の割合」を刷ってはいけない
    /* outsideGross は**返さない**。割合を出す側は total をそのまま分母に使う
       （2026-09-02、いったん引き算のために返していたのをやめた）。
       断りを出すための額が要るときは notes 側の unionOutsideJpy を呼ぶ。 */
    return (total > 0)
      ? { segs: segs, total: total, vals: vals, partial: partial,
          noBreakdown: noBreakdown }
      : null;
  }

  /* ── ドーナツ（salary-leveling.js の stroke-dasharray 実装を流用）──
     o.title  見出し
     o.name   {base:'基本給', command:…, flight:…, other:…, housing:…, transport:…, perdiem:…}
     o.notes  {data:'※実額です', perDiem:'※パーディアムは…', housing:'※社宅は…',
               noBreakdown:'※手当ごとに入れると分かれます…'} */
  function donut(r, o) {
    o = o || {};
    var notes = o.notes || {};
    var s = segments(r);
    if (!s) return '';

    /* どの但し書きを出すかは明細（r）を見ないと決まらない。
       絵そのものは donutFromSegs に任せる（割合だけの comp からも同じ絵を描くため）。 */
    var ns = [];
    if (notes.data) ns.push(notes.data);
    if (s.vals.perdiem > 0 && notes.perDiem) ns.push(notes.perDiem);
    /* ★組合が総支給の外で払った分は、会社の明細に印字されない（2026-09-02）。
       円には受け取った額として入れてあるので、「明細と足し算が合わない」と
       読まれないように、その1点だけ断る。 */
    if (unionOutsideJpy(r) > 0 && notes.unionOut) ns.push(notes.unionOut);
    if (r.housing_type && r.housing_type !== 'allowance' && num(r.housing_amount) && notes.housing)
      ns.push(notes.housing);
    /* ★灰色1色の円（総支給1本だけの行）。何が足りないのかをここで1行だけ言う。
       言わないと「これで全部だ」と読まれる。 */
    if (s.noBreakdown && notes.noBreakdown) ns.push(notes.noBreakdown);

    return donutFromSegs(s, { title: o.title, name: o.name, notes: ns });
  }

  /* ── 材料（segs）から絵を作る ────────────────────────────────
     donut() と、割合だけの comp（他人の行）の両方がここを通る。
     ★絵の実体はここ1か所だけ。増やさないこと。
     o.title   見出し
     o.name    {キー: 表示名}
     o.notes   但し書きの配列（呼ぶ側が決める）
     o.amounts false にすると凡例から金額を落とす（金額を持っていないとき）
     o.center  真ん中の文字。省くと合計の金額 */
  function donutFromSegs(s, o) {
    o = o || {};
    if (!s || !(s.total > 0)) return '';
    var nm = o.name || {}, showAmt = o.amounts !== false;

    var R = 52, SW = 20, C = 2 * Math.PI * R, acc = 0;
    var arcs = '', legend = '';
    s.segs.forEach(function (seg) {
      var v = seg.v, len = (v / s.total) * C;
      arcs += '<circle cx="66" cy="66" r="' + R + '" fill="none" stroke="' + seg.c +
        '" stroke-width="' + SW + '" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) +
        '" stroke-dashoffset="' + (-acc).toFixed(2) + '" transform="rotate(-90 66 66)"></circle>';
      acc += len;
      legend += '<div class="pt-leg"><i style="background:' + seg.c + '"></i>' +
        '<span class="nm">' + esc(nm[seg.k]) + '</span>' +
        (showAmt ? '<span class="amt">' + esc(fmt(v)) + '</span>' : '') +
        '<span class="pct">' + Math.round(v / s.total * 100) + '%</span></div>';
    });

    var out = '';
    (o.notes || []).forEach(function (t) {
      if (t) out += '<div class="pt-note">' + esc(t) + '</div>';
    });

    return '<div class="pt-sec"><div class="pt-h">' + esc(o.title) + '</div>' +
      '<div class="pt-donut-wrap">' +
        '<div class="pt-donut"><svg viewBox="0 0 132 132" width="132" height="132" aria-hidden="true">' +
          '<circle cx="66" cy="66" r="' + R + '" fill="none" stroke="rgba(128,140,160,.12)" stroke-width="' + SW + '"></circle>' +
          arcs + '</svg>' +
          '<div class="pt-donut-c"><b>' + esc(o.center != null ? o.center : fmt(s.total)) + '</b></div></div>' +
        '<div class="pt-legend">' + legend + '</div>' +
      '</div>' + out + '</div>';
  }

  /* ── 他人の行の内訳（割合だけ）────────────────────────────────
     サーバ（pv_pay_rows）が返す comp = {m,b,d,h,o} は**整数パーセント**で、
     金額を1つも持っていない。だから凡例に金額は出せない（出してはいけない）。
     色は上の SEG と揃える：月々の支給＝基本給の緑、賞与＝水色、
     パーディアム＝桃、住宅手当＝橙、その他の手当＝紫。
     ★合計は 100。segs の総和をそのまま total にするので、
       サーバが 99 を返しても図は破綻しない（割合の分母がずれるだけ）。 */
  var COMP = [
    { k: 'm', c: '#34d399' },
    { k: 'b', c: '#22d3ee' },
    { k: 'd', c: '#f472b6' },
    { k: 'h', c: '#fb923c' },
    { k: 'o', c: '#a78bfa' }
  ];

  function compSegs(comp) {
    if (!comp) return null;
    var segs = [], total = 0;
    COMP.forEach(function (s) {
      var v = num(comp[s.k]);
      if (v == null || !(v > 0)) return;
      segs.push({ k: s.k, c: s.c, v: v });
      total += v;
    });
    return total > 0 ? { segs: segs, total: total, vals: comp, partial: false } : null;
  }

  /* 折れ線の幅。viewBox を伸縮させると文字まで拡大縮小されてスマホで読めなくなるので、
     コンテナの実寸で組む（呼ぶ側が resize で組み直す）。 */
  function widthOf(box, fallbackEl) {
    return Math.max(260, (box ? box.clientWidth : 0) ||
      (fallbackEl ? fallbackEl.clientWidth - 56 : 0) || 560);
  }

  /* グラデーションの id は呼ぶたびに変える。1ページに図が2つ以上あると
     url(#pt-fill) が先に出てきた方だけを指して、片方の塗りが消える。 */
  var gid = 0;

  /* ── 折れ線 ────────────────────────────────────────────────
     o.width     実測した px（widthOf() で測る）
     o.labelOf   function(row) → 横軸のラベル（'6月' / 'Jun'）
     o.aria      SVG の aria-label
     o.onePoint  点が1つのときの注記
     o.noMetric  使える月が無いときの文言
     o.valueAt   function(row, i) → その点の値。渡すと key の代わりに使う
                 （累計の running total のように、1行だけでは決まらない値を描くため）
     o.h         折れ線の高さ（px）。既定 168。100 未満は無視する
                 （目盛りの文字が実寸なので、潰すと値札と重なる）
     o.color     線・点・最新値の色。既定は LINE（DEEP PAY の金）。
                 ★ CSS 変数を文字列で渡さない。線と点は presentation attribute
                   （stroke="…"）で塗っているので var(--pv-orange) は効かず、
                   線が黒か透明になる。getComputedStyle で解いた実際の値を渡すこと。
     o.fmtVal    function(v) → 最新値のラベル。既定は fmt（金額）。
                 金額でないもの（人数など）を描くときに渡す

     ★ この引数を valueOf という名前にしてはいけない。オブジェクトリテラルに
       valueOf を書かなくても Object.prototype.valueOf が継承されるので
       typeof o.valueOf === 'function' が常に真になり、既存の呼び出しが全部
       そちらへ落ちて線が消える。 */
  function chart(rows, key, o) {
    o = o || {};
    var label = o.labelOf || function () { return ''; };
    /* ★ 既定は今までどおり。渡されたときだけ差し替える
       （この関数は6ページが共有している。既定を動かすと全部の絵が変わる）。 */
    var COL = o.color || LINE;
    var lab = (typeof o.fmtVal === 'function') ? o.fmtVal : fmt;
    var pick = (typeof o.valueAt === 'function') ? o.valueAt
                                                 : function (r) { return metricOf(r, key); };
    var pts = (rows || []).map(function (r, i) { return { r: r, v: pick(r, i) }; })
                          .filter(function (p) { return p.v != null && p.v > 0; });
    if (!pts.length) return '<div class="pt-empty">' + esc(o.noMetric) + '</div>';

    var W = (typeof o.width === 'number' && o.width > 0) ? o.width : 560;
    // 点が1つのときは線が引けない＝縦を使う意味が無いので低くする（空白が目立つ）
    /* 高さ。既定は 168（点が1つのときは線が引けないので低くする）。
       ★ o.h は「その枠に収めたい」ときだけ渡す。目盛りの文字は実寸なので、
         100 を下回らせない（下回ると上下の目盛りと値札が重なる）。 */
    var H = pts.length === 1 ? 104
          : (typeof o.h === 'number' && o.h >= 100) ? o.h : 168;
    var PL = 8, PR = 8, PT = 24, PB = 26;
    var iw = W - PL - PR, ih = H - PT - PB;

    var vs = pts.map(function (p) { return p.v; });
    var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
    // 平坦なときに線が枠の外へ張り付かないよう、上下に余白を作る
    if (hi === lo) { hi = lo * 1.12 || 1; lo = lo * 0.88; }
    var x = function (i) { return PL + (pts.length === 1 ? iw / 2 : iw * i / (pts.length - 1)); };
    var y = function (v) { return PT + ih - (v - lo) / (hi - lo) * ih; };

    var fid = 'pt-fill-' + (++gid);
    var g = '';
    // 目盛り（上下2本だけ。線が主役なので格子は敷かない）
    [hi, lo].forEach(function (v) {
      g += '<line x1="' + PL + '" y1="' + y(v).toFixed(1) + '" x2="' + (W - PR) + '" y2="' + y(v).toFixed(1) +
           '" stroke="currentColor" stroke-opacity=".12" stroke-dasharray="3 4"/>';
    });

    if (pts.length > 1) {
      var dPath = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1); }).join(' ');
      var area = dPath + ' L' + x(pts.length - 1).toFixed(1) + ' ' + (PT + ih) + ' L' + x(0).toFixed(1) + ' ' + (PT + ih) + ' Z';
      g += '<path d="' + area + '" fill="url(#' + fid + ')"/>';
      g += '<path d="' + dPath + '" fill="none" stroke="' + COL + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    }
    pts.forEach(function (p, i) {
      var last = i === pts.length - 1;
      // 未選択の点は背景色で抜く。ライト/ダークで色が違うので CSS 変数を使う
      // （presentation attribute では var() が効かないので style で渡す）。
      g += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '" r="' + (last ? 5 : 3.5) +
           '" style="fill:' + (last ? COL : 'var(--pt-dot)') + '" stroke="' + COL + '" stroke-width="2"/>';
      // 両端のラベルは middle だと枠の外へはみ出す（EN の "Jun" が切れていた）
      var ta = (pts.length > 1 && i === 0) ? 'start'
             : (pts.length > 1 && last) ? 'end' : 'middle';
      g += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="' + ta + '" font-size="10.5" ' +
           'fill="currentColor" fill-opacity=".55">' + esc(label(p.r)) + '</text>';
    });
    // 最新値だけ数字を出す（全部出すと重なる）
    var lastP = pts[pts.length - 1];
    var lx = x(pts.length - 1), anchor = 'end', dx = -8;
    if (pts.length === 1) { anchor = 'middle'; dx = 0; }
    g += '<text x="' + (lx + dx).toFixed(1) + '" y="' + Math.max(14, y(lastP.v) - 12).toFixed(1) + '" text-anchor="' + anchor +
         '" font-size="13" font-weight="800" fill="' + COL + '">' + esc(lab(lastP.v)) + '</text>';

    var note = (pts.length === 1 && o.onePoint) ? '<div class="pt-note">' + esc(o.onePoint) + '</div>' : '';
    return '<svg class="pt-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" ' +
      'aria-label="' + esc(o.aria) + '">' +
      '<defs><linearGradient id="' + fid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + COL + '" stop-opacity=".22"/>' +
        '<stop offset="100%" stop-color="' + COL + '" stop-opacity="0"/>' +
      '</linearGradient></defs>' + g + '</svg>' + note;
  }

  w.PVViz = {
    SEG: SEG, LINE: LINE, COMP: COMP,
    esc: esc, num: num, fmt: fmt,
    calc: calc, metricOf: metricOf, segments: segments,
    grossOrig: grossOrig, unionOutsideJpy: unionOutsideJpy, totals: totals,
    donut: donut, donutFromSegs: donutFromSegs, compSegs: compSegs,
    chart: chart, widthOf: widthOf
  };
}(window));
