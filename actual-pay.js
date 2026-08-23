/* ════════════════════════════════════════════════════════════════
   actual-pay.js — 「他のパイロットの実給与を見る」
                   （actual-pay.html / en/actual-pay.html が共有）

   この画面は2つの節でできていて、**上下に分かれたまま絶対に混ざらない**。

     ① 公開情報からの推定レンジ（青）… salary-data.json。公式資料・募集要項から
        作った参考値。★ここは必ず中身がある（0件でも画面が空にならない）
     ② パイロット本人が記録した実給与（オレンジ）… pv_pay_rows()。
        1行＝1人。同じ会社・職位・機材に5人そろった区分だけが行になる

   ★①と②から1つの数を作らない。差も平均も割合も出さない。
     「推定」と「実データ」を足した数は、どちらでもない嘘の数になる。

   ── サーバから何が返ってくるか ────────────────────────────────
   pv_pay_rows() が返すのは1行あたり
     航空会社コード / 職位 / 粒度 / 区分 / 年収(USD) / 検証済みか / その区分の中央値
   の7つだけ。基地・在籍年数・年代・投稿月・原本の通貨・契約形態・国籍・
   本人を指す識別子は**1つも返ってこない**（db/pay-rows.sql が出さない）。
   だからこのファイルにも、それらを受け取る場所は無い。

   ── 金額の出し方 ──────────────────────────────────────────────
   サーバは USD で有効数字2桁に確定させている。画面は表示通貨へ換算したあと
   **もう一度2桁に丸め直す**（$180,000 → ¥2,861万 を ¥2,900万 に）。
   ★ここを省くと、通貨を切り替えた瞬間だけ端数の残った数字が出て、
     「本当は1円単位まで持っているのでは」と読めてしまう。
   ★丸め直しは見た目だけで、開示している中身は増えない。

   ★ 結果の入れ物には pv-no-cur を付けてある（currency.js の自動走査を止める）。
     通貨の切替は 'pv-currency-change' を購読して描き直す。
     ⚠️ 描き直しで pv_pay_rows() を引き直さない。データは state に持つ。
   ════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';
  if (!w || !d) return;

  /* ★ページ相対で書くと /en/ から /en/salary-data.json を見に行って 404 になる。
       このスクリプト自身の URL を基準に解く（my-value.js の PUB_URL と同じ）。
       currentScript は同期実行中しか取れないので、ここで確定させる。 */
  var PUB_URL = 'salary-data.json';
  var VOCAB_URL = 'pv-vocab.json';
  try {
    var _self = (d.currentScript && d.currentScript.src) || '';
    if (_self) {
      PUB_URL = new URL('salary-data.json', _self).href;
      VOCAB_URL = new URL('pv-vocab.json', _self).href;
    }
  } catch (e) {}

  var L = (d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';

  // ── 文言 ───────────────────────────────────────────────────────
  var T = {
    ja: {
      hd: '他のパイロットの実給与',
      hs: '公開情報からの推定レンジと、パイロット本人が記録した実給与を、別々に並べます。この2つは足しません。',
      fAir: '航空会社', fPos: '職位', fFleet: '機材', all: 'すべて',
      clear: '絞り込みを解除',
      s1t: '公開情報からの推定レンジ', s1b: '公開情報',
      s1s: '公式資料・募集要項・報道から作った参考レンジです。本人の記録ではありません。',
      s1f: '会社名順に並べています。金額では並べ替えません。訓練生の公開レンジは持っていません。',
      s2t: 'パイロット本人が記録した実給与', s2b: '本人記録',
      s2s: '1行が1人の記録です。同じ会社・職位・機材に5人以上そろった区分だけを、上下の端を寄せて丸めた金額で載せています。',
      cap: '機長', fo: '副操縦士',
      thAir: '航空会社', thPos: '職位', thFleet: '機材', thCat: '機材カテゴリ',
      thAmt: '年収（丸め）', thVf: '検証',
      grainF: '機材別', grainC: '機材をまとめた区分',
      grainFn: '同じ機材に5人以上そろった区分です。',
      grainCn: '機材をまとめて5人以上そろった区分です。上の表に出ている人も含みます。',
      vfNo: '—',
      pTitle: '選んだ区分', pHint: '行を選ぶと、その区分の中央値が出ます。',
      pMed: 'この区分の中央値',
      pNote: '出せるのはこの区分の中央値までです。個人の内訳・提出日・基地・在籍年数は持っていません。',
      lockT: '給与明細を1枚出すと、ここが開きます',
      lockS: '他のパイロットが記録した実給与は、自分も1枚出した人だけが読めます。'
           + '氏名も社員番号も受け取りません。明細の画像は端末の中だけで処理され、サーバーには送られません。',
      lockC: '匿名で給与を追加する',
      emptyT: 'この条件で公開できる記録は、まだありません',
      emptyS: '同じ会社・職位・機材に5人そろうと、ここに行が出ます。'
            + '5人に満たない区分は、誰が書いたか絞れてしまうので出しません。',
      emptyC: '匿名で給与を追加する',
      errT: 'いま読み出せません',
      errS: '時間をおいてもう一度お試しください。',
      loading: '読み込み中…'
    },
    en: {
      hd: 'What other pilots actually earn',
      hs: 'Public estimated ranges and pay recorded by pilots themselves, kept in two separate sections. We never add the two together.',
      fAir: 'Airline', fPos: 'Position', fFleet: 'Fleet', all: 'All',
      clear: 'Clear filters',
      s1t: 'Estimated range from public sources', s1b: 'Public data',
      s1s: 'Reference ranges built from official filings, job postings and press reports. Not recorded by pilots.',
      s1f: 'Sorted by airline name. Never sorted by amount. We hold no public range for cadets.',
      s2t: 'Pay recorded by pilots themselves', s2b: 'Pilot-recorded',
      s2s: 'One row is one pilot. We show a group only once at least five people share the same airline, position and fleet, with the extremes pulled in and the figure rounded.',
      cap: 'Captain', fo: 'First Officer',
      thAir: 'Airline', thPos: 'Position', thFleet: 'Fleet', thCat: 'Fleet category',
      thAmt: 'Annual (rounded)', thVf: 'Verified',
      grainF: 'By fleet', grainC: 'Fleet types grouped together',
      grainFn: 'Groups with five or more people on the same fleet.',
      grainCn: 'Groups with five or more people once fleet types are combined. The people above are included here too.',
      vfNo: '—',
      pTitle: 'Selected group', pHint: 'Pick a row to see that group’s median.',
      pMed: 'Median for this group',
      pNote: 'The median for the group is as far as we go. We hold no individual breakdown, submission date, base or years of service.',
      lockT: 'Submit one payslip and this opens',
      lockS: 'Pay recorded by other pilots is readable by people who have recorded theirs too. '
           + 'We never take your name or staff number, and payslip images are processed on your own device.',
      lockC: 'Add your pay anonymously',
      emptyT: 'Nothing can be shown for this filter yet',
      emptyS: 'Once five people share the same airline, position and fleet, rows appear here. '
            + 'Smaller groups stay hidden because they would narrow down who wrote them.',
      emptyC: 'Add your pay anonymously',
      errT: 'We cannot load this right now',
      errS: 'Please try again in a little while.',
      loading: 'Loading…'
    }
  }[L];

  /* 機材カテゴリの名前。★pv-vocab.json には入っていない（gen-vocab.mjs が
     再生成するので語彙側に足さない）。3語だけここに持つ。 */
  var CAT = {
    ja: { r: 'リージョナル', n: 'ナローボディ', w: 'ワイドボディ' },
    en: { r: 'Regional', n: 'Narrow-body', w: 'Wide-body' }
  }[L];

  var PAY_URL = 'pay-report.html#ps';

  // ── 状態 ───────────────────────────────────────────────────────
  var S = {
    pub: null,        // salary-data.json
    fleet: {},        // 機材コード → 表示名
    pos: {},          // 職位コード → 表示名
    rows: null,       // pv_pay_rows() の行（そのまま持つ）
    mode: '',         // 'locked' | 'open' | 'error'
    fAir: '', fPos: '', fFleet: '',
    sel: null         // 選んでいる行
  };

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

  /* USD → 表示通貨。整形はサイト共通の PVCurrency.fmt に任せる
     （「万」を出すか出さないかの判断が日英で違うので、ここで持たない）。 */
  function money(usd) {
    var C = w.PVCurrency;
    if (!C || !isFinite(Number(usd))) return '';
    var cur = C.get();
    var rate = C.rates[cur] || 1;
    var jpy = Number(usd) * (C.rates.USD || 1);   // サイト内の基準は円
    return C.fmt(sig2(jpy / rate) * rate);
  }

  /* 公開情報（単位は万円）。★こちらは丸め直さない。
     公開されている値をこちらで作り変えると、出典と食い違う。 */
  function manToStr(man) {
    var C = w.PVCurrency;
    if (!C || !isFinite(Number(man))) return '';
    return C.fmt(Number(man) * 10000);
  }

  // ── 名前の引き当て ─────────────────────────────────────────────
  function airName(code) {
    var a = S.pub && S.pub.airlines && S.pub.airlines[code];
    return a ? (a[L] || a.ja || code) : code;
  }
  function posName(code) { return S.pos[code] || code; }
  function bucketName(grain, code) {
    return grain === 'cat' ? (CAT[code] || code) : (S.fleet[code] || code);
  }

  // ══ ① 公開情報 ════════════════════════════════════════════════
  function renderPub() {
    var box = el('ap-pub');
    if (!box) return;
    if (!S.pub) { box.innerHTML = '<p class="ap-none">' + esc(T.loading) + '</p>'; return; }

    var codes = Object.keys(S.pub.airlines || {});
    if (S.fAir) codes = codes.filter(function (c) { return c === S.fAir; });
    codes.sort(function (a, b) { return airName(a).localeCompare(airName(b), L); });

    var showCap = !S.fPos || S.fPos === 'cap';
    var showFo = !S.fPos || S.fPos === 'fo';
    /* 訓練生を選んだときは列が1つも立たない。空の表を出すより、
       持っていないと1行で言うほうが正直。 */
    if (!showCap && !showFo) {
      box.innerHTML = '<p class="ap-none">' + esc(T.s1f) + '</p>';
      return;
    }

    var h = '<div class="ap-tw"><div class="ap-plist"><table class="ap-tbl">'
          + '<thead><tr><th>' + esc(T.thAir) + '</th>'
          + (showCap ? '<th>' + esc(T.cap) + '</th>' : '')
          + (showFo ? '<th>' + esc(T.fo) + '</th>' : '')
          + '</tr></thead><tbody>';
    for (var i = 0; i < codes.length; i++) {
      var a = S.pub.airlines[codes[i]];
      h += '<tr><td><span class="ap-air">' + esc(airName(codes[i])) + '</span></td>';
      if (showCap) h += '<td>' + rangeCell(a.cap) + '</td>';
      if (showFo) h += '<td>' + rangeCell(a.fo) + '</td>';
      h += '</tr>';
    }
    h += '</tbody></table></div></div>';
    box.innerHTML = h;
    wireScrollCue(box);
  }

  /* ★「まだ下がある」の影を出すのは、本当に下があるときだけ。
       112社を 360px に収めているので既定では7社で切れるが、
       1社に絞ると1行しか残らない。いつも影を出すと、そのとき嘘になる。
       いちばん下まで送ったら消す（終わったことも同じ形で伝える）。 */
  function wireScrollCue(box) {
    var l = box.querySelector('.ap-plist');
    if (!l) return;
    var upd = function () {
      l.classList.toggle('is-more', l.scrollHeight - l.clientHeight - l.scrollTop > 2);
    };
    l.addEventListener('scroll', upd, { passive: true });
    w.addEventListener('resize', upd, { passive: true });
    upd();
  }

  function rangeCell(o) {
    if (!o || !isFinite(Number(o.lo)) || !isFinite(Number(o.hi))) {
      return '<span class="ap-none">' + esc(T.vfNo) + '</span>';
    }
    return '<span class="ap-range">' + esc(manToStr(o.lo)) + '〜' + esc(manToStr(o.hi)) + '</span>';
  }

  // ══ ② 実給与 ══════════════════════════════════════════════════
  function visibleRows() {
    if (!S.rows) return [];
    return S.rows.filter(function (r) {
      if (S.fAir && r.airline !== S.fAir) return false;
      if (S.fPos && r.pos !== S.fPos) return false;
      if (S.fFleet && r.bucket !== S.fFleet) return false;
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
      renderFleetSel([]);
      return;
    }
    if (S.mode === 'error') {
      box.innerHTML = msg('', T.errT, T.errS, '');
      renderFleetSel([]);
      return;
    }

    var rows = visibleRows();
    renderFleetSel(S.rows || []);
    if (!rows.length) {
      box.innerHTML = msg('', T.emptyT, T.emptyS, T.emptyC);
      return;
    }

    /* 選んでいた行が絞り込みで消えたら、選択も落とす。 */
    if (S.sel && rows.indexOf(S.sel) === -1) S.sel = null;

    var f = rows.filter(function (r) { return r.grain === 'fleet'; });
    var c = rows.filter(function (r) { return r.grain === 'cat'; });

    var h = '<div class="ap-split"><div class="ap-tcol">';
    if (f.length) h += grainBlock('fleet', T.grainF, T.grainFn, T.thFleet, f);
    if (c.length) h += grainBlock('cat', T.grainC, T.grainCn, T.thCat, c);
    h += '</div>' + panel() + '</div>';
    box.innerHTML = h;
    bindRows(box, rows);
  }

  function grainBlock(grain, title, note, thBucket, rows) {
    var h = '<section><div class="ap-grain-h">' + esc(title) + ' — ' + esc(note) + '</div>'
          + '<div class="ap-tw"><div class="ap-tscroll"><table class="ap-tbl">'
          + '<thead><tr><th>' + esc(T.thAir) + '</th><th>' + esc(T.thPos) + '</th>'
          + '<th>' + esc(thBucket) + '</th><th>' + esc(T.thAmt) + '</th>'
          + '<th>' + esc(T.thVf) + '</th></tr></thead><tbody>';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      h += '<tr class="ap-tr' + (S.sel === r ? ' is-on' : '') + '" tabindex="0" role="button"'
         + ' data-i="' + i + '" data-g="' + esc(grain) + '">'
         + '<td><span class="ap-air">' + esc(airName(r.airline)) + '</span></td>'
         + '<td>' + esc(posName(r.pos)) + '</td>'
         + '<td>' + esc(bucketName(r.grain, r.bucket)) + '</td>'
         + '<td><span class="ap-amt">' + esc(money(r.annual_usd)) + '</span></td>'
         + '<td>' + (r.verified ? vfMark() : '<span class="ap-vf-no">' + esc(T.vfNo) + '</span>') + '</td>'
         + '</tr>';
    }
    return h + '</tbody></table></div></div></section>';
  }

  function vfMark() {
    return '<span class="ap-vf"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"'
         + ' stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"'
         + ' aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>Verified</span>';
  }

  /* 右の詳細。★出すのはその区分の中央値だけ。 */
  function panel() {
    if (!S.sel) {
      return '<aside class="ap-panel"><div class="ap-panel-t">' + esc(T.pTitle) + '</div>'
           + '<p class="ap-panel-s">' + esc(T.pHint) + '</p></aside>';
    }
    var r = S.sel;
    return '<aside class="ap-panel"><div class="ap-panel-t">' + esc(airName(r.airline)) + '</div>'
         + '<p class="ap-panel-s">' + esc(posName(r.pos)) + ' ・ '
         + esc(bucketName(r.grain, r.bucket)) + '</p>'
         + '<div class="ap-kv"><div><div class="ap-k">' + esc(T.pMed) + '</div>'
         + '<div class="ap-v">' + esc(money(r.cohort_median_usd)) + '</div></div></div>'
         + '<p class="ap-panel-note">' + esc(T.pNote) + '</p></aside>';
  }

  function msg(kind, t, s, cta) {
    return '<div class="ap-msg' + (kind === 'lock' ? ' ap-msg--lock' : '') + '">'
         + '<div class="ap-msg-t">' + esc(t) + '</div>'
         + '<p class="ap-msg-s">' + esc(s) + '</p>'
         + (cta ? '<a class="ap-cta" href="' + PAY_URL + '">' + esc(cta) + '</a>' : '')
         + '</div>';
  }

  function bindRows(box, rows) {
    var f = rows.filter(function (r) { return r.grain === 'fleet'; });
    var c = rows.filter(function (r) { return r.grain === 'cat'; });
    box.querySelectorAll('.ap-tr').forEach(function (tr) {
      var list = tr.getAttribute('data-g') === 'cat' ? c : f;
      var r = list[Number(tr.getAttribute('data-i'))];
      var pick = function () { S.sel = (S.sel === r) ? null : r; renderRows(); };
      tr.addEventListener('click', pick);
      tr.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); }
      });
    });
  }

  // ── 絞り込み ───────────────────────────────────────────────────
  function opt(v, label, cur) {
    return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>'
         + esc(label) + '</option>';
  }

  function renderFilters() {
    var sa = el('ap-air'), sp = el('ap-pos');
    if (sa && S.pub) {
      var codes = Object.keys(S.pub.airlines || {})
        .sort(function (a, b) { return airName(a).localeCompare(airName(b), L); });
      sa.innerHTML = opt('', T.all, S.fAir)
        + codes.map(function (c) { return opt(c, airName(c), S.fAir); }).join('');
    }
    if (sp) {
      sp.innerHTML = opt('', T.all, S.fPos)
        + Object.keys(S.pos).map(function (c) { return opt(c, S.pos[c], S.fPos); }).join('');
    }
  }

  /* 機材の絞り込みは②の中に置く（①は機材を持たない）。
     選べるのは実際に行がある区分だけ。無い機材を並べると、
     「選んだのに何も出ない」が「隠されている」に見える。 */
  function renderFleetSel(all) {
    var wrap = el('ap-fleet-wrap'), sel = el('ap-fleet');
    if (!wrap || !sel) return;
    var seen = {}, list = [];
    (all || []).forEach(function (r) {
      if (S.fAir && r.airline !== S.fAir) return;
      if (S.fPos && r.pos !== S.fPos) return;
      var k = r.grain + ':' + r.bucket;
      if (seen[k]) return;
      seen[k] = 1;
      list.push({ v: r.bucket, label: bucketName(r.grain, r.bucket) });
    });
    if (!list.length) { wrap.hidden = true; sel.innerHTML = ''; S.fFleet = ''; return; }
    wrap.hidden = false;
    list.sort(function (a, b) { return a.label.localeCompare(b.label, L); });
    sel.innerHTML = opt('', T.all, S.fFleet)
      + list.map(function (o) { return opt(o.v, o.label, S.fFleet); }).join('');
  }

  function render() { renderPub(); renderRows(); }

  /* 別の <script> が宣言した const sb を読む。宣言前に呼ばれると
     ReferenceError になるので、必ず try で包んだ側から呼ぶ。 */
  function sb0() { return sb; }

  // ── 起動 ───────────────────────────────────────────────────────
  function boot() {
    var head = el('ap-hd');
    if (head) {
      head.innerHTML = '<h1 class="mr-hd-t">' + esc(T.hd) + '</h1>'
                     + '<p class="mr-hd-s">' + esc(T.hs) + '</p>';
    }
    ['ap-air', 'ap-pos', 'ap-fleet'].forEach(function (id) {
      var s = el(id);
      if (!s) return;
      s.addEventListener('change', function () {
        if (id === 'ap-air') { S.fAir = s.value; S.fFleet = ''; }
        else if (id === 'ap-pos') { S.fPos = s.value; S.fFleet = ''; }
        else S.fFleet = s.value;
        S.sel = null;
        if (id !== 'ap-fleet') renderFilters();
        render();
      });
    });
    var clr = el('ap-clear');
    if (clr) clr.addEventListener('click', function () {
      S.fAir = ''; S.fPos = ''; S.fFleet = ''; S.sel = null;
      renderFilters(); render();
    });

    /* ★通貨の切替は描き直すだけ。pv_pay_rows() を引き直さない。 */
    w.addEventListener('pv-currency-change', function () { render(); });

    fetch(VOCAB_URL).then(function (r) { return r.json(); }).then(function (v) {
      (v.fleets || []).forEach(function (f) { S.fleet[f.code] = f[L] || f.ja; });
      (v.positions || []).forEach(function (p) { S.pos[p.code] = p[L] || p.ja; });
    }).catch(function () {}).then(function () {
      return fetch(PUB_URL).then(function (r) { return r.json(); });
    }).then(function (j) {
      S.pub = j;
      renderFilters();
      /* ★renderPub() だけにしない。②の行は社名・職位・機材の表示名を
           この辞書から引く。RPC のほうが先に返ると、名前が届いても
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
        mountRef(client);
      }).catch(function () { S.mode = 'error'; renderRows(); });
    });
  }

  /* 招待（データ密度）カード。★②の中・表（または正直な1行）の直下に置く。
     ①の隣に置くとどちらの話か混ざる。
     ・surface は 'actual_pay'。'my_value' を使い回すと、この画面を開くだけで
       マイレポート側の勧誘の予算（4回で30日休む）が黙って減る
     ・variant は 'card'。bench / profile はダークのハードコードで、
       トークン建てのこの画面では浮く
     ・claim() は呼ばない（招待の着地面ではない）
     ・mountInvite() は置かない（常設の入口はマイページの1か所という約束） */
  function mountRef(sb) {
    try {
      if (w.PVReferral) w.PVReferral.mountCohort(el('ap-ref-slot'), {
        sb: sb, surface: 'actual_pay', variant: 'card' });
    } catch (e) {}
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
