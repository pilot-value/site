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
          + '載っているのは会社・職位・機材・丸めた金額だけです'
          + '（月あたりはその金額を12で割った数字です）。'
          + '基地・年代・在籍年数・投稿した月は誰の行にも入っていません。',
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
          + 'A row carries the airline, the position, the fleet and a rounded figure '
          + '(the monthly column is that figure divided by twelve). '
          + 'Base, age, years of service and the month submitted appear on no row.',
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

  /* USD → 表示通貨。整形はサイト共通の PVCurrency.fmt に任せる
     （「万」を出すか出さないかの判断が日英で違うので、ここで持たない）。 */
  function money(usd) {
    var C = w.PVCurrency, n = disp(usd);
    return n === null ? '' : C.fmt(n * (C.rates[C.get()] || 1));
  }

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
      h += '<tr>'
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
    box.innerHTML = h + '<p class="ap-foot">' + esc(T.foot) + '</p>';
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
        render();
      });
    });
    var clr = el('ap-clear');
    if (clr) clr.addEventListener('click', function () {
      S.fAir = ''; S.fPos = ''; S.fFleet = ''; S.page = 1;
      render();
    });

    /* ページ送りは描き直すたびに作り直されるので、入れ物の側で受ける。 */
    var box = el('ap-rows');
    if (box) box.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-ap-page]') : null;
      if (!b || b.disabled) return;
      S.page = Number(b.getAttribute('data-ap-page')) || 1;
      render();
      var tw = el('ap-rows');
      if (tw && tw.scrollIntoView) tw.scrollIntoView({ block: 'start', behavior: 'smooth' });
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
        renderRows();
      }).catch(function () { S.mode = 'error'; renderRows(); });
    });
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
