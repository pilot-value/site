/* ════════════════════════════════════════════════════════════════
   actual-pay.js — 「他のパイロットの実給与を見る」
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
     航空会社コード / 職位 / 機材 / 年収(USD) / 検証済みか
   の5つだけ。基地・在籍年数・年代・投稿月・原本の通貨・契約形態・国籍・
   本人を指す識別子は**1つも返ってこない**（db/pay-rows.sql が出さない）。
   だからこのファイルにも、それらを受け取る場所は無い。

   ★自由入力の社名の人は airline が 'other' で返る（打ち込まれた文字列は来ない）。
     画面は固定の札（「その他の航空会社」）に置き換える。

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

   ── 図（2026-08-24 追加）──────────────────────────────────────
   表の上に2枚並べる。左＝支給の内訳（ドーナツ）、右＝年収の分布（棒）。
   ★モックは右に鎧戸を置く形だったが、この画面の本体は 988px しかない。
     右へ 340px 取ると表が 630px になって6列が潰れるので、表の上に置いた。
   ★左は既定で「あなたの支給構成」。my_pay_reports() は本人の行しか返さない。
     表の行を押すと、その人の内訳に切り替わる。
     ★他人の内訳に金額は1つも無い。サーバ（pv_pay_rows）が返すのは
       整数パーセント5本（comp）だけで、金額を持っていない＝凡例に出せない。
       真ん中に置くのは表の同じ行に出ている年収そのもの＝新しい数字を作っていない。
     ★comp が無い行を選んでも壊れない（黙って「内訳を出せません」になる）。
       サーバが comp を返すのをやめれば、この図は自動で消える
       （db/pay-rows.sql 冒頭の「やめるとき」）。
   ★右の棒に人数の数字は書かない。棒の高さで目分量に読めるところまで。
   ★どちらも通貨を切り替えたら描き直すが、pv_pay_rows() は引き直さない。
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
      hd: '他のパイロットの実給与',
      badge: '本人記録',
      hs: 'いままでに給与を出した人を、1行ずつそのまま並べています。1行が1人で、'
        + '同じ人が何ヶ月ぶん出していても1行になります。'
        + '金額は有効数字2桁に丸めた額で、並び順に意味はありません。',
      all: 'すべて',
      thAir: '航空会社', thPos: '職位', thFleet: '機材',
      thAmt: '年収（丸め）', thMon: '月あたり', thVf: '出典',
      othAir: 'その他の航空会社',
      vfNo: '本人記録',
      foot: 'この一覧は、給与を出したパイロットだけが読めます。'
          + '載っているのは会社・職位・機材・丸めた金額と、支給の内訳の割合だけです'
          + '（月あたりはその金額を12で割った数字です。'
          + '内訳は割合だけで、金額は入っていません）。'
          + '基地・年代・在籍年数・投稿した月は誰の行にも入っていません。',
      /* 表の上の図。★「金額は持っていない」と言い切る（実際に持っていない）。 */
      vizHd: '支給の内訳',
      vizMine: 'あなたの支給構成（1か月ぶん）',
      vizHint: '表の行を押すと、その人の内訳に切り替わります。',
      vizBack: '自分に戻す',
      vizPct: '※ 割合だけを出しています。金額は持っていません。',
      vizNo: 'この行は内訳を出せません。',
      vizNoMine: '給与明細を1枚出すと、ここにあなたの支給構成が出ます。',
      vizDist: '年収の分布',
      vizDistS: 'いま表に出ている行を、表示中の通貨で刻んだものです。',
      vizYou: 'あなた',
      cM: '月々の支給', cB: '年1回の賞与', cD: 'パーディアム',
      cH: '住宅手当', cO: 'その他の手当',
      segBase: '基本給', segCommand: '機長・役職手当', segFlight: '乗務変動手当',
      segOther: 'その他手当', segHousing: '住宅手当', segTransport: '交通費',
      segPerDiem: 'パーディアム', segBonus: '今月の賞与', segRest: '内訳を入れていない分',
      housingNote: '※ 社宅（現物支給）は現金ではないので内訳に入れていません。',
      pgPrev: '前へ', pgNext: '次へ', pgOf: '{a} / {b} ページ',
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
      hd: 'What other pilots actually earn',
      badge: 'Pilot-recorded',
      hs: 'Everyone who has submitted their pay, one row each. Several months from the same '
        + 'pilot fold into a single row. Figures are rounded to two significant digits, '
        + 'and the order means nothing.',
      all: 'All',
      thAir: 'Airline', thPos: 'Position', thFleet: 'Fleet',
      thAmt: 'Annual (rounded)', thMon: 'Per month', thVf: 'Source',
      othAir: 'Other airline',
      vfNo: 'Pilot-recorded',
      foot: 'This list is readable only by pilots who have submitted their own pay. '
          + 'A row carries the airline, the position, the fleet, a rounded figure and '
          + 'the shares that make the pay up '
          + '(the monthly column is that figure divided by twelve; the breakdown is '
          + 'shares only, and carries no amounts). '
          + 'Base, age, years of service and the month submitted appear on no row.',
      vizHd: 'How the pay is made up',
      vizMine: 'How your own pay is made up (one month)',
      vizHint: 'Select a row in the table to see how that pilot is paid.',
      vizBack: 'Back to yours',
      vizPct: '※ Shares only. No amounts are carried here.',
      vizNo: 'No breakdown for this row.',
      vizNoMine: 'Submit one payslip and your own breakdown appears here.',
      vizDist: 'How annual pay is spread',
      vizDistS: 'The rows currently listed, bucketed in the currency shown.',
      vizYou: 'You',
      cM: 'Monthly pay', cB: 'Annual bonus', cD: 'Per diem',
      cH: 'Housing allowance', cO: 'Other allowances',
      segBase: 'Base pay', segCommand: 'Command / position', segFlight: 'Flight variable',
      segOther: 'Other allowances', segHousing: 'Housing', segTransport: 'Transport',
      segPerDiem: 'Per diem', segBonus: 'Bonus this month', segRest: 'Not broken down yet',
      housingNote: '※ Company-provided housing is not cash, so it is left out of the breakdown.',
      pgPrev: 'Previous', pgNext: 'Next', pgOf: 'Page {a} of {b}',
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
    fleet: {},        // 機材コード → 表示名
    pos: {},          // 職位コード → 表示名
    rows: null,       // pv_pay_rows() の行（そのまま持つ）
    mode: '',         // 'locked' | 'open' | 'error'
    fAir: '', fPos: '', fFleet: '',
    page: 1,          // 1始まり。絞り込みを変えたら1に戻す（行き止まりを作らない）
    /* ★選んでいる行の番号。S.rows の並び順そのもので、本人を指す識別子ではない
         （サーバはそれを1つも返さない）。null なら自分の内訳を出す。 */
    sel: null,
    mine: null,       // 自分の最新の明細（内訳のドーナツの材料）
    mineAll: null     // 自分の明細ぜんぶ（分布の「あなた」の位置に使う）
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
  /* ★'other' は固定の札にする。打ち込まれた社名はサーバから来ないので、
       ここで何を書いても本人の入力は出ない。 */
  function airName(code) {
    if (code === 'other') return T.othAir;
    return S.air[code] || code;
  }
  function posName(code) { return S.pos[code] || code; }
  function fleetName(code) { return S.fleet[code] || code; }

  /* 社ロゴ。airline-logos.js（window.PV_LOGOS）が「コード → 拡張子」を持っている。
     ★salary-leveling.js の logoHtml は流用しない。あちらはブランド色（a.color）を
       前提にしていて、salary-data.json はその色を持っていない（レベリング図が
       自前の表から引いている）。ここは色を使わない小さい版を持つ。
     ★alt="" にする。社名はすぐ隣に必ず文字で出るので、読み上げが二重になる。
       画像が落ちても行は読める。
     ★ロゴが無い社と「一覧にない会社」は、社名の頭2文字をグレーの札にする。
       ここで出るのは**画面が持っている辞書の社名**で、本人が打ち込んだ文字列ではない
       （'other' の名前は固定の札。サーバは打ち込まれた社名を返さない）。 */
  function logoHtml(code) {
    var ext = (w.PV_LOGOS || {})[code];
    if (code !== 'other' && ext) {
      return '<img class="ap-logo" src="' + esc(LOGO_BASE + code + '.' + ext) + '"'
           + ' alt="" loading="lazy" decoding="async" width="30" height="30"/>';
    }
    var name = String(airName(code) || '');
    var ini = name.replace(/[^0-9A-Za-z\u3040-\u30ff\u4e00-\u9fff]/g, '').slice(0, 2).toUpperCase();
    return '<span class="ap-logo ap-logo--mono" aria-hidden="true">' + esc(ini || '·') + '</span>';
  }

  // ── 表 ─────────────────────────────────────────────────────────
  function visibleRows() {
    if (!S.rows) return [];
    return S.rows.filter(function (r) {
      if (S.fAir && r.airline !== S.fAir) return false;
      if (S.fPos && r.pos !== S.fPos) return false;
      if (S.fFleet && r.fleet !== S.fFleet) return false;
      return true;
    });
  }

  function renderRows() {
    var box = el('ap-rows');
    if (!box) return;

    /* ★まだ pv_pay_rows() を引けていない。骨組みのまま待つ。
       ここで描くと、辞書（社名・職位・機材）が届いた時の描き直しで
       「まだありません」が一瞬出てから行が現れる。 */
    if (!S.mode) return;

    if (S.mode === 'locked') {
      /* ★ここに金額を1文字も出さない。鍵の無い人に数字を見せない、が
           この画面の一番外側の約束。 */
      box.innerHTML = msg('lock', T.lockT, T.lockS, T.lockC);
      renderFilters();
      return;
    }
    if (S.mode === 'error') {
      box.innerHTML = msg('', T.errT, T.errS, '');
      renderFilters();
      return;
    }

    renderFilters();
    var rows = visibleRows();
    if (!rows.length) {
      /* 絞り込みのせいで空なのか、そもそも1行も無いのかで言うことが違う。
         同じ文言にすると「まだ誰も出していない」と読める（嘘になる）。 */
      var filtered = !!(S.fAir || S.fPos || S.fFleet);
      box.innerHTML = filtered ? msg('', T.fEmptyT, T.fEmptyS, '')
                               : msg('', T.emptyT, T.emptyS, T.emptyC);
      return;
    }

    /* ★ページを直す位置はここ1か所だけ。絞り込みで行が減ったあとも必ず
         「行のあるページ」に居る＝押した先が空、という行き止まりが作れない。 */
    var pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
    if (S.page > pages) S.page = pages;
    if (S.page < 1) S.page = 1;
    var from = (S.page - 1) * PER_PAGE;
    var page = rows.slice(from, from + PER_PAGE);

    var h = '<div class="ap-tw"><div class="ap-tscroll"><table class="ap-tbl">'
          + '<thead><tr><th>' + esc(T.thAir) + '</th><th>' + esc(T.thPos) + '</th>'
          + '<th>' + esc(T.thFleet) + '</th><th class="ap-num">' + esc(T.thAmt) + '</th>'
          + '<th class="ap-num">' + esc(T.thMon) + '</th>'
          + '<th>' + esc(T.thVf) + '</th></tr></thead><tbody>';
    for (var i = 0; i < page.length; i++) {
      var r = page[i];
      /* ★行は押せる（左のドーナツがその人に切り替わる）。
           閉じ方は3つ：もう一度押す／カードの「自分に戻す」／ESC。
         ★aria-selected は使わない。あれは grid の中でしか正しく効かない。
           aria-current はどの要素にも置けて、意味も「今これ」で合っている。 */
      var on = (S.sel === r._i);
      h += '<tr data-ap-row="' + r._i + '" tabindex="0"'
         + (on ? ' class="is-sel" aria-current="true"' : '') + '>'
         + '<td><span class="ap-cell-air">' + logoHtml(r.airline)
         +   '<span class="ap-air">' + esc(airName(r.airline)) + '</span></span></td>'
         + '<td>' + esc(posName(r.pos)) + '</td>'
         + '<td>' + esc(fleetName(r.fleet)) + '</td>'
         + '<td class="ap-num"><span class="ap-amt">' + esc(money(r.annual_usd)) + '</span></td>'
         /* ★月あたりは画面の年収を12で割っただけ。新しい情報は1つも増えていない。 */
         + '<td class="ap-num"><span class="ap-mon">' + esc(moneyMonth(r.annual_usd)) + '</span></td>'
         + '<td>' + (r.verified ? vfMark() : '<span class="ap-vf-no">' + esc(T.vfNo) + '</span>') + '</td>'
         + '</tr>';
    }
    h += '</tbody></table></div>' + pager(pages) + '</div>';
    /* ★図は表の上。この画面の本体は 988px しかなく、右に鎧戸を足すと6列が潰れる。 */
    box.innerHTML = renderViz(rows) + h + '<p class="ap-foot">' + esc(T.foot) + '</p>';
  }

  /* ページ送り。★件数は出さない（会員規模そのものが漏れる）。
     出すのは「何ページ目か」だけで、これは今めくっている場所の話。 */
  function pager(pages) {
    if (pages < 2) return '';
    var lbl = T.pgOf.replace('{a}', String(S.page)).replace('{b}', String(pages));
    return '<div class="ap-pager">'
         + '<button type="button" class="ap-pg" data-ap-page="' + (S.page - 1) + '"'
         + (S.page <= 1 ? ' disabled' : '') + '>' + esc(T.pgPrev) + '</button>'
         + '<span class="ap-pg-n">' + esc(lbl) + '</span>'
         + '<button type="button" class="ap-pg" data-ap-page="' + (S.page + 1) + '"'
         + (S.page >= pages ? ' disabled' : '') + '>' + esc(T.pgNext) + '</button>'
         + '</div>';
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

  // ── 図（ドーナツ・分布）─────────────────────────────────────────
  /* 名前の集合が2つある。左の図は「自分」と「他人」で材料が違うため。
       自分 … my_pay_reports() の細かい内訳（金額つき。my-value.html と同じ呼び方）
       他人 … pv_pay_rows() の割合5本（金額を1つも持っていない） */
  var SEGNAME = {
    base: T.segBase, command: T.segCommand, flight: T.segFlight,
    other: T.segOther, housing: T.segHousing, transport: T.segTransport,
    perdiem: T.segPerDiem, bonus: T.segBonus, rest: T.segRest
  };
  var COMPNAME = { m: T.cM, b: T.cB, d: T.cD, h: T.cH, o: T.cO };

  function card(title, head, body) {
    return '<section class="ap-vcard"><div class="ap-vhd">'
         + '<h2 class="ap-vt">' + esc(title) + '</h2>'
         + (head || '') + '</div>' + body + '</section>';
  }

  /* いま選ばれている行。★絞り込みで消えた行は黙って外す
       （消えた行のドーナツが残ると、表と図が食い違う）。 */
  function selRow(rows) {
    if (S.sel == null) return null;
    for (var i = 0; i < rows.length; i++) if (rows[i]._i === S.sel) return rows[i];
    return null;
  }

  /* 自分の年収。★サーバと同じ畳み方（複数月は中央値）にする。
     「最新の1ヶ月」にすると、分布の目印だけが表の自分の行とずれる。 */
  function myAnnual() {
    var v = (S.mineAll || []).map(function (r) { return Number(r.annual_total_usd); })
      .filter(function (x) { return isFinite(x) && x > 0; })
      .sort(function (a, b) { return a - b; });
    if (!v.length) return null;
    var m = Math.floor(v.length / 2);
    return (v.length % 2) ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  /* 左＝支給の内訳。行を選んでいなければ自分、選んでいればその人。 */
  function vizComp(rows) {
    var V = w.PVViz;
    if (!V) return '';                       // pay-viz.js を読んでいないページ
    var r = selRow(rows);
    if (r) {
      /* ★凡例に金額を出さない（amounts:false）。サーバは割合しか返していないので、
           ここで金額を書くには自分で作るしかない＝作らない。
         ★真ん中は表の同じ行に出ている年収そのもの。新しい数字は増えていない。 */
      var s = V.compSegs(r.comp);
      var body = s ? V.donutFromSegs(s, {
        title: airName(r.airline) + ' / ' + posName(r.pos) + ' / ' + fleetName(r.fleet),
        name: COMPNAME, amounts: false,
        center: money(r.annual_usd), notes: [T.vizPct]
      }) : '<div class="pt-empty">' + esc(T.vizNo) + '</div>';
      var back = '<button type="button" class="ap-unsel" data-ap-unsel="1">'
               + esc(T.vizBack) + '</button>';
      return card(T.vizHd, back, body);
    }
    var dn = S.mine ? V.donut(S.mine, {
      title: T.vizMine, name: SEGNAME, notes: { housing: T.housingNote }
    }) : '';
    if (!dn) dn = '<div class="pt-empty">' + esc(T.vizNoMine) + '</div>';
    return card(T.vizHd, '', dn + '<p class="ap-vhint">' + esc(T.vizHint) + '</p>');
  }

  var BINS = 8;

  /* 右＝年収の分布。★人数の数字は書かない（棒の高さで目分量に読めるところまで）。
     刻むのは「画面に出ている金額」＝表示通貨の有効数字2桁。だから通貨を
     切り替えると刻み目も変わる。それでよい（新しい数字は1つも増えていない）。 */
  function vizDist(rows) {
    var vals = [];
    rows.forEach(function (r) {
      var v = disp(r.annual_usd);
      if (v != null && v > 0) vals.push(v);
    });
    if (vals.length < 2) return '';          // 棒1本は分布ではない
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (!(hi > lo)) return '';               // 全員おなじ額（丸めの後）
    var n = Math.max(3, Math.min(BINS, vals.length)), i;
    var wd = (hi - lo) / n, cnt = [];
    for (i = 0; i < n; i++) cnt.push(0);
    vals.forEach(function (v) {
      var k = Math.floor((v - lo) / wd);
      cnt[k < 0 ? 0 : (k >= n ? n - 1 : k)]++;   // 上端はいちばん右の箱に入れる
    });
    var mx = Math.max.apply(null, cnt), bars = '';
    for (i = 0; i < n; i++) {
      bars += '<div class="ap-bw"><div class="ap-bar" style="height:'
            + (mx > 0 ? Math.round(cnt[i] / mx * 100) : 0) + '%"></div></div>';
    }
    /* 「あなた」の位置。★自分の年収がこの絞り込みの外なら出さない
         （軸の外に破線を置くと、軸の目盛りが嘘に見える）。 */
    var you = '', my = myAnnual(), mv = (my == null) ? null : disp(my);
    if (mv != null && mv >= lo && mv <= hi) {
      var p = ((mv - lo) / (hi - lo)) * 100;
      /* ★右端に寄ると札がカードからはみ出す。72% を越えたら左向きに出す。 */
      you = '<div class="ap-you' + (p > 72 ? ' is-r' : '') + '" style="left:'
          + p.toFixed(1) + '%"><span>' + esc(T.vizYou) + '</span></div>';
    }
    return card(T.vizDist, '',
      '<p class="ap-vsub">' + esc(T.vizDistS) + '</p>'
      + '<div class="ap-plot">' + bars + you + '</div>'
      + '<div class="ap-ax"><span>' + esc(fmtDisp(lo)) + '</span>'
      + '<span>' + esc(fmtDisp(hi)) + '</span></div>');
  }

  function renderViz(rows) {
    var a = vizComp(rows), b = vizDist(rows);
    return (a || b) ? '<div class="ap-viz">' + a + b + '</div>' : '';
  }

  /* 行を選ぶ／外す。★同じ行をもう一度押したら外れる。 */
  function pick(i) {
    var prev = S.sel;
    S.sel = (i == null || S.sel === i) ? null : i;
    render();
    /* 描き直すと焦点が消える。キーボードで選んだ人を同じ行へ戻す。 */
    var k = (S.sel == null) ? prev : S.sel;
    var f = (k == null) ? null : d.querySelector('[data-ap-row="' + k + '"]');
    if (f && f.focus) f.focus();
  }

  // ── 絞り込み ───────────────────────────────────────────────────
  function opt(v, label, cur) {
    return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>'
         + esc(label) + '</option>';
  }

  /* 選べるのは**実際に行がある区分だけ**。語彙を丸ごと並べない。
     無いものを並べると「選んだのに何も出ない」が「隠されている」に見えるし、
     112社のプルダウンは8行の表には大きすぎる。

     ★段を下るほど絞る（会社 → 職位 → 機材）。上の段は絞らない
       ＝ 会社を選んだあとでも、別の会社に移れる。 */
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
    if (!has) { S.fAir = ''; S.fPos = ''; S.fFleet = ''; return; }

    fill('ap-air', listOf('airline', airName, function () { return true; }), S.fAir);
    fill('ap-pos', listOf('pos', posName, function (r) {
      return !S.fAir || r.airline === S.fAir;
    }), S.fPos);
    var fw = el('ap-fleet-wrap');
    var fl = listOf('fleet', fleetName, function (r) {
      return (!S.fAir || r.airline === S.fAir) && (!S.fPos || r.pos === S.fPos);
    });
    if (fw) fw.hidden = fl.length < 2;   // 1つしか無い機材は選ばせる意味が無い
    fill('ap-fleet', fl, S.fFleet);
  }

  function render() { renderRows(); }

  /* 別の <script> が宣言した const sb を読む。宣言前に呼ばれると
     ReferenceError になるので、必ず try で包んだ側から呼ぶ。 */
  function sb0() { return sb; }

  // ── 起動 ───────────────────────────────────────────────────────
  function boot() {
    var head = el('ap-hd');
    if (head) {
      /* ★札は見出しの行に置く。①（公開情報＝推定）が無くなったので、
         「本人記録」だけの節を別に立てると見出しが2つ並んで同じことを言う。 */
      head.innerHTML = '<h1 class="mr-hd-t">' + esc(T.hd)
                     + ' <span class="ap-badge ap-badge--actual">' + esc(T.badge) + '</span></h1>'
                     + '<p class="mr-hd-s">' + esc(T.hs) + '</p>';
    }
    ['ap-air', 'ap-pos', 'ap-fleet'].forEach(function (id) {
      var s = el(id);
      if (!s) return;
      s.addEventListener('change', function () {
        /* 上の段を変えたら下の段は落とす（残すと「選んだのに0件」になる）。 */
        if (id === 'ap-air') { S.fAir = s.value; S.fPos = ''; S.fFleet = ''; }
        else if (id === 'ap-pos') { S.fPos = s.value; S.fFleet = ''; }
        else S.fFleet = s.value;
        S.page = 1;
        S.sel = null;      // 選んだ行が消えることがある。図も自分に戻す
        render();
      });
    });
    var clr = el('ap-clear');
    if (clr) clr.addEventListener('click', function () {
      S.fAir = ''; S.fPos = ''; S.fFleet = ''; S.page = 1; S.sel = null;
      render();
    });

    /* ページ送りも行の選択も、描き直すたびに作り直される。入れ物の側で受ける。 */
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
      if (q('[data-ap-unsel]')) { pick(null); return; }         // 閉じ方1：「自分に戻す」
      var tr = q('[data-ap-row]');
      if (tr) pick(Number(tr.getAttribute('data-ap-row')));      // 閉じ方2：もう一度押す
    });

    /* 行はキーボードでも押せる（tabindex を付けた以上、Enter と Space が要る）。 */
    if (box) box.addEventListener('keydown', function (ev) {
      var tr = ev.target && ev.target.closest ? ev.target.closest('[data-ap-row]') : null;
      if (!tr) return;
      if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
      ev.preventDefault();                    // Space でページが飛ぶのを止める
      pick(Number(tr.getAttribute('data-ap-row')));
    });

    /* 閉じ方3：ESC。★ここはモーダルではない。スクロールも止めないし、
       下のページも生きたまま。閉じ込めを作らない（assert-referral と同じ考え方）。 */
    d.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' && ev.key !== 'Esc') return;
      if (S.sel == null) return;
      pick(null);
    });

    /* ★通貨の切替は描き直すだけ。pv_pay_rows() を引き直さない。 */
    w.addEventListener('pv-currency-change', function () { render(); });

    fetch(VOCAB_URL).then(function (r) { return r.json(); }).then(function (v) {
      (v.fleets || []).forEach(function (f) { S.fleet[f.code] = f[L] || f.ja; });
      (v.positions || []).forEach(function (p) { S.pos[p.code] = p[L] || p.ja; });
    }).catch(function () {}).then(function () {
      return fetch(AIR_URL).then(function (r) { return r.json(); });
    }).then(function (j) {
      var a = (j && j.airlines) || {};
      Object.keys(a).forEach(function (c) { S.air[c] = a[c][L] || a[c].ja || c; });
      /* ★辞書が後から届いても描き直す。RPC のほうが先に返ると、
           行はコードのまま（ana / cap / b787）で固まる。 */
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
        /* ★行の番号。選択の目印にだけ使う。サーバは本人を指す識別子を1つも
             返さないので、ここで作る番号も「今この画面に並んでいる順」以上の
             意味を持たない（描き直しても並びは変わらない＝番号も動かない）。 */
        S.rows.forEach(function (r, i) { r._i = i; });
        renderRows();
        if (S.mode === 'open') loadMine(client);
      }).catch(function () { S.mode = 'error'; renderRows(); });
    });
  }

  /* 自分の支給構成。★本人の行しか返さない関数（my_pay_reports）を、この画面では
     ここ1回だけ引く。落ちても表は止めない＝左の図が案内文になるだけ。
     ★通貨を切り替えても引き直さない（pv_pay_rows と同じ約束）。 */
  function loadMine(client) {
    Promise.resolve(client.rpc('my_pay_reports')).then(function (res) {
      var rs = (res && !res.error && res.data && res.data.reports) || [];
      if (!rs.length) return;
      S.mineAll = rs;
      S.mine = rs[rs.length - 1];      // 内訳は最新の1枚（my-value.html と同じ）
      render();
    }).catch(function () {});
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
