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
   pv_pay_rows() が返すのは1行あたり
     航空会社コード / 職位 / 年収(USD) / 検証済みか
   の4つだけ。**機材**・基地・在籍年数・年代・投稿月・原本の通貨・契約形態・
   国籍・本人を指す識別子は**1つも返ってこない**（db/pay-rows.sql が出さない）。
   だからこのファイルにも、それらを受け取る場所は無い。

   ★機材は 2026-08-24 に外した（オーナー判断）。「787 の機長」まで分かると
     同じ会社の同僚には1人に絞れてしまうため。
     ★列を消すだけでは足りない。**機材で絞る口も同時に消す**こと。
       絞れると、絞った結果から各行の機材が逆算できる（隠したことにならない）。

   ★航空会社の欄で「その他」を選んだ人の行も、サーバが**語彙に当ててから**返す
     （db/pay-rows.sql の pv_airline_resolve）。打ち込まれた文字列は来ない。
     ・当たった … 本当の社名のコードで来る＝他の行と同じように社名が出る
     ・当たらない … 'other' で来る＝画面が「一覧にない航空会社」と書く
     2026-08-25 まではここが一律「その他の航空会社」だった（オーナー指示で変更）。

   ★並びはサーバが決める（**出した順・古いほうが上**）。画面は受け取った順に描くだけ。
     2026-08-25 にオーナー指示で md5 順から変えた。
     ★並べ替えの口を作らないこと。「新しい順」に切り替えられると、
       いつでも最新の1人を先頭に呼び出せてしまう（db/pay-rows.sql の契約⑥）。

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
   ★行を選ぶ仕掛けも一緒に落ちた（選んで見せるものがもう無い）。
   ★表は幅いっぱい。2段組（ap-cols / ap-main / ap-side）はもう無い。
     ⚠️ 別の図に置き換えない。ここは「消した」であって「差し替えた」ではない。

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
      vfNo: '本人記録',
      /* ★投稿時期。段の番号（0〜4）を言葉にするだけ。日付は持っていない。 */
      age: ['1ヶ月以内', '3ヶ月以内', '6ヶ月以内', '1年以内', 'それより前'],
      stRep: '実給与の投稿',       stRepU: '件',
      stAir: '航空会社',           stAirU: '社',
      stMon: '今月の新規投稿',     stMonU: '件',
      foot: 'この一覧は、給与を出したパイロットだけが読めます。'
          + '載っているのは会社・職位・丸めた金額だけです'
          + '（月あたりはその金額を12で割った数字です）。'
          + '機材・基地・年代・在籍年数は誰の行にも入っていません。'
          + 'いつ出されたかは、おおまかな時期だけです。',
      pgPrev: '前へ', pgNext: '次へ', pgRange: '全{n}件中 {a}〜{b}件を表示',
      lockT: '給与明細を1枚出すと、ここが開きます',
      lockS: '他のパイロットが記録した実給与は、自分も1枚出した人だけが読めます。'
           + '氏名も社員番号も受け取りません。明細の画像は端末の中だけで処理され、サーバーには送られません。',
      lockC: '匿名で給与を追加する',
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
      vfNo: 'Pilot-recorded',
      age: ['Within 1 month', 'Within 3 months', 'Within 6 months',
            'Within a year', 'Over a year ago'],
      stRep: 'Pay records',      stRepU: '',
      stAir: 'Airlines',         stAirU: '',
      stMon: 'Added this month', stMonU: '',
      foot: 'This list is readable only by pilots who have submitted their own pay. '
          + 'A row carries the airline, the position and a rounded figure '
          + '(the monthly column is that figure divided by twelve). '
          + 'Fleet, base, age and years of service appear on no row, '
          + 'and when a row was submitted is shown only as a broad period.',
      pgPrev: 'Previous', pgNext: 'Next', pgRange: 'Showing {a}–{b} of {n}',
      lockT: 'Submit one payslip and this opens',
      lockS: 'Pay recorded by other pilots is readable by people who have recorded theirs too. '
           + 'We never take your name or staff number, and payslip images are processed on your own device.',
      lockC: 'Add your pay anonymously',
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

  // ── 状態 ───────────────────────────────────────────────────────
  var S = {
    air: {},          // 航空会社コード → 表示名
    pos: {},          // 職位コード → 表示名
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
     ★カードは**3枚**（実給与の投稿 / 航空会社 / 今月の新規投稿）。
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
    // 右肩上がり（＝今月の増え方）
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
    var open = (S.mode === 'open' && S.rows && S.rows.length);
    if (!open) { box.hidden = true; box.innerHTML = ''; return; }

    var seen = {}, airs = 0;
    S.rows.forEach(function (r) {
      if (r.airline == null || seen[r.airline]) return;
      seen[r.airline] = 1; airs++;
    });
    var st = S.stats || {};
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
      box.innerHTML = msg('lock', T.lockT, T.lockS, T.lockC);
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

    /* ★列は6つ。行は押せない（押して見せるものが無い）。
         行に tabindex や押せる目印を置かないこと。置くと「何か起きるはず」に見える。
       ★見出しは文字だけ。押せる見出し（＝並べ替え）を作らない。 */
    var h = '<div class="ap-tw"><div class="ap-tscroll"><table class="ap-tbl">'
          + '<thead><tr><th>' + esc(T.thAir) + '</th><th>' + esc(T.thPos) + '</th>'
          + '<th class="ap-num">' + esc(T.thAmt) + '</th>'
          + '<th class="ap-num">' + esc(T.thMon) + '</th>'
          + '<th>' + esc(T.thVf) + '</th>'
          + '<th>' + esc(T.thAge) + '</th></tr></thead><tbody>';
    for (var i = 0; i < page.length; i++) {
      var r = page[i];
      h += '<tr>'
         + '<td><span class="ap-cell-air">' + logoHtml(r.airline)
         +   '<span class="ap-air">' + esc(airName(r.airline)) + '</span></span></td>'
         + '<td>' + esc(posName(r.pos)) + '</td>'
         + '<td class="ap-num"><span class="ap-amt">' + esc(money(r.annual_usd)) + '</span></td>'
         /* ★月あたりは画面の年収を12で割っただけ。新しい情報は1つも増えていない。 */
         + '<td class="ap-num"><span class="ap-mon">' + esc(moneyMonth(r.annual_usd)) + '</span></td>'
         + '<td>' + (r.verified ? vfMark() : '<span class="ap-vf-no">' + esc(T.vfNo) + '</span>') + '</td>'
         /* ★投稿時期。サーバから来るのは 0〜4 の段の番号だけ。
              段が読めない行（古いサーバ）は空欄にする＝そこだけ黙って空く。 */
         + '<td><span class="ap-age">' + esc(ageName(r.age)) + '</span></td>'
         + '</tr>';
    }
    h += '</tbody></table></div>' + pager(rows.length, pages) + '</div>';

    /* ★表は幅いっぱい。図は無い（2026-08-24 に外した）。
       ★ foot（何が載っていないかの1文）は表の下。あれは説明ではなく約束で、
         消すと「機種はどこ？」に答えるものが画面から無くなる。 */
    box.innerHTML = h + '<p class="ap-foot">' + esc(T.foot) + '</p>';
    renderStats();
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

  function msg(kind, t, s, cta) {
    return '<div class="ap-msg' + (kind === 'lock' ? ' ap-msg--lock' : '') + '">'
         + '<div class="ap-msg-t">' + esc(t) + '</div>'
         + '<p class="ap-msg-s">' + esc(s) + '</p>'
         + (cta ? '<a class="ap-cta" href="' + PAY_URL + '">' + esc(cta) + '</a>' : '')
         + '</div>';
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

    /* ページ送りは描き直すたびに作り直される。入れ物の側で受ける。
       ★行そのものは押せない。行に効くハンドラをここへ足さないこと。 */
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
      }
    });

    /* ★通貨の切替は描き直すだけ。pv_pay_rows() を引き直さない。 */
    w.addEventListener('pv-currency-change', function () { render(); });

    /* ★語彙から読むのは職位だけ。機材の辞書はこの画面が持たない
         （持つと「いつでも列に戻せる」形が残る）。 */
    fetch(VOCAB_URL).then(function (r) { return r.json(); }).then(function (v) {
      (v.positions || []).forEach(function (p) { S.pos[p.code] = p[L] || p.ja; });
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
      /* ★ rpc() が返すのは「then だけを持つ箱」で Promise ではない。
           Promise.resolve() で包んでから catch を付ける（pv-referral.js:gap と同じ）。 */
      Promise.resolve(client.rpc('pv_pay_rows')).then(function (res) {
        if (res && res.error) { S.mode = 'error'; renderRows(); return; }
        var v = res && res.data;
        S.mode = (v && v.state === 'open') ? 'open' : 'locked';
        S.rows = (v && v.rows) || [];
        /* ★数え上げ。古いサーバ（stats を返さない）でも画面は止めない
             ＝ そのカードだけ出ない（0 を置いて嘘の数字を作らない）。 */
        S.stats = (v && v.stats) || null;
        renderRows();
      }).catch(function () { S.mode = 'error'; renderRows(); });
    });
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
