/* ════════════════════════════════════════════════════════════════
   pv-gates.js — Give → Get の門（左メニューの錠前と、その説明）

   マイページ系8枚（4画面 × 日英）が読む。やることは2つだけ。
     ① 左メニューの REAL PAY / DEEP PAY / VERIFIED PAY に錠前を出すか決める
     ② 錠前を押されたら「何を出すと何が見られるか」を説明する

   ★このファイルはデータを1バイトも隠さない。
     実給与を止めているのはサーバ（db/pay-rows.sql の pv_pay_rows()）で、
     鍵の無い人には**行そのものが返ってこない**。ここがやるのは絵と言葉だけ。
     ⚠️ ぼかし（filter / blur）で隠す実装をここに足さないこと。
        隠すのではなく、最初から渡さない。それがこの機能の一番外側の約束。

   ── 鍵をどこで見るか ──────────────────────────────────────────
   localStorage['pv_salary_unlock_expiry'] ＝ サーバの profiles.access_until の写し。
     立てる … pay-report.html（給与の保存が通った直後）と pv-reunlock.js（ログイン時）
     消す   … pv-session.js（ログアウト）
     読む   … lp.js が**すでに同じ目的で同じキーを読んでいる**。ここは読み手が1つ増えるだけ。
   ★ここでは書かない。書き手を増やさない（assert-unlock.mjs が見張っている）。
   ★写しは古いことがある（別の端末で初めて開いたときは空）。そこで、確かな値を
     持っている画面が PVGates.mark(true/false) で上書きする：
       actual-pay.js … pv_pay_rows() の state を知っている
       my-value.js   … my_pay_reports() の access_until を知っている
     上書きされない画面（airline-conditions）では錠前が出るだけで、
     押せば普通に REAL PAY へ行ける＝行き止まりにはならない。

   ── DEEP PAY / VERIFIED PAY について ─────────────────────────
   ★この2つは**まだページが無い**。だから「詳しく出すと開きます」とは書かない。
     書くのは「準備中」。今すぐ開くのは REAL PAY だけ。
     ページを作った回に、下の TIERS の state を 'soon' から外す。
   ════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';
  if (!w || !d) return;

  var L = (d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';
  var KEY = 'pv_salary_unlock_expiry';
  var PAY_URL = 'pay-report.html#ps';

  var T = {
    ja: {
      giveHd: 'あなたが出すもの', getHd: '見られるもの',
      now: 'いま開きます', soon: '準備中',
      cta: '匿名で給与を追加する',
      close: '閉じる',
      lockedNote: '（未解放）', soonNote: '（準備中）',
      hint: '押すと説明が出ます',
      panel: {
        real: {
          t: 'REAL PAY はまだ開いていません',
          s: '他のパイロットが実際に提出した給与を1行ずつ見られます。'
           + 'あなたの給与を1件共有すると解放されます。'
        },
        deep: {
          t: 'DEEP PAY は準備中です',
          s: 'その給与が基本給・乗務手当・賞与のどれでできているかを、'
           + '複数の投稿から集計して見られるようにします。まだ作っている途中です。'
        },
        verified: {
          t: 'VERIFIED PAY は準備中です',
          s: '給与明細に裏付けのあるものだけを集めて見られるようにします。'
           + 'まだ作っている途中です。'
        }
      },
      tiers: [
        { give: '給与を1件（手入力でもかまいません）', get: 'REAL PAY' },
        { give: '内訳まで詳しく', get: 'DEEP PAY' },
        { give: '給与明細から', get: 'VERIFIED PAY' }
      ]
    },
    en: {
      giveHd: 'What you share', getHd: 'What you can see',
      now: 'Open now', soon: 'In preparation',
      cta: 'Add your pay anonymously',
      close: 'Close',
      lockedNote: ' (locked)', soonNote: ' (in preparation)',
      hint: 'press for details',
      panel: {
        real: {
          t: 'REAL PAY is not open yet',
          s: 'It shows what other pilots actually get paid, one row per pilot. '
           + 'Share one of your own pay records and it opens.'
        },
        deep: {
          t: 'DEEP PAY is in preparation',
          s: 'It will show what a salary is made of — base, flight pay, bonus — '
           + 'aggregated across several submissions. We are still building it.'
        },
        verified: {
          t: 'VERIFIED PAY is in preparation',
          s: 'It will aggregate only figures backed by a payslip. '
           + 'We are still building it.'
        }
      },
      tiers: [
        { give: 'One pay record (typing it in is fine)', get: 'REAL PAY' },
        { give: 'The full breakdown', get: 'DEEP PAY' },
        { give: 'From a payslip', get: 'VERIFIED PAY' }
      ]
    }
  }[L];

  /* 段の状態。★REAL PAY だけが今日ひらく。残り2つは 'soon'。
     ページを作ったら 'soon' → 'live' に変え、patch-side-nav.mjs の soon も外す。 */
  var TIERS = [
    { key: 'real',     state: 'live' },
    { key: 'deep',     state: 'soon' },
    { key: 'verified', state: 'soon' }
  ];

  var LOCK_SVG = '<svg class="mr-side-lk" width="13" height="13" viewBox="0 0 24 24"'
    + ' fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"'
    + ' stroke-linejoin="round" aria-hidden="true" focusable="false">'
    + '<rect x="4" y="10.5" width="16" height="10.5" rx="2.5"/>'
    + '<path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>';

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ── 鍵を読む（読むだけ）──────────────────────────────────
     返すのは true / false / null。null ＝「まだ分からない」ではなく
     「写しが無い」＝錠前を出す側に倒す（false と同じ扱い）。 */
  function keyOpen() {
    var v = 0;
    try { v = parseInt(w.localStorage.getItem(KEY) || '0', 10); } catch (e) { return false; }
    return !!v && Date.now() < v;
  }

  /* ── Give → Get の3段（ロック画面とパネルで同じものを使う）──────
     ★2か所に書き写さない。actual-pay.js もこの関数を呼ぶ。 */
  function giveGetHTML() {
    var rows = TIERS.map(function (tier, i) {
      var t = T.tiers[i];
      var live = tier.state === 'live';
      return '<li class="pv-give-r' + (live ? ' is-live' : '') + '">'
           + '<span class="pv-give-g">' + esc(t.give) + '</span>'
           + '<span class="pv-give-ar" aria-hidden="true">→</span>'
           + '<span class="pv-give-t">' + esc(t.get) + '</span>'
           + '<span class="pv-give-s"><span class="pv-give-p">'
           + (live ? '✓ ' : '') + esc(live ? T.now : T.soon)
           + '</span></span></li>';
    }).join('');
    return '<div class="pv-give">'
         + '<div class="pv-give-hd"><span>' + esc(T.giveHd) + '</span>'
         + '<span>' + esc(T.getHd) + '</span></div>'
         + '<ul class="pv-give-l">' + rows + '</ul></div>';
  }

  // ── 左メニューに錠前を出す ──────────────────────────────────
  function items() {
    return Array.prototype.slice.call(d.querySelectorAll('[data-mr-gate]'));
  }

  function label(node) {
    var s = node.querySelector('span');
    return s ? s.textContent : (node.textContent || '').trim();
  }

  function setLocked(node, locked, soon) {
    var had = !!node.querySelector('.mr-side-lk');
    if (locked && !had) node.insertAdjacentHTML('beforeend', LOCK_SVG);
    if (!locked && had) node.removeChild(node.querySelector('.mr-side-lk'));
    if (locked) node.classList.add('is-locked');
    else node.classList.remove('is-locked');
    /* ★静的な aria-label（patch-side-nav.mjs が8枚に配ったもの）を上書きしない。
         上書きすると同じ意味の言葉が2通りになり、8枚一致の検査も揺れる。
         こちらが足したものだけ、こちらが外す。 */
    if (locked) {
      if (!node.hasAttribute('aria-label')) {
        node.setAttribute('aria-label',
          label(node) + (soon ? T.soonNote : T.lockedNote) + (L === 'en' ? ' — ' : '・') + T.hint);
        node.setAttribute('data-mr-gate-aria', '1');
      }
    } else if (node.getAttribute('data-mr-gate-aria') === '1') {
      node.removeAttribute('aria-label');
      node.removeAttribute('data-mr-gate-aria');
    }
  }

  /* REAL PAY の錠前だけを付け外しする。DEEP / VERIFIED は
     ページが無いあいだ**誰にとっても**閉じているので、鍵とは関係ない。 */
  function mark(isOpen) {
    items().forEach(function (node) {
      var k = node.getAttribute('data-mr-gate');
      if (k === 'real') setLocked(node, !isOpen, false);
      else setLocked(node, true, true);
    });
  }

  // ── 説明のパネル ────────────────────────────────────────────
  /* ★覆いを作らない。position:fixed も role="dialog" も body.style.overflow も
       書かない。左メニューの説明のために画面を閉じ込めない（招待の着地と同じ考え方）。
     ★閉じ方は3つ ── × ／ パネルの外を押す ／ ESC。 */
  var panel = null, offDoc = null, offKey = null;

  function closePanel() {
    if (!panel) return;
    if (panel.parentNode) panel.parentNode.removeChild(panel);
    panel = null;
    if (offDoc) { d.removeEventListener('mousedown', offDoc, true); offDoc = null; }
    if (offKey) { d.removeEventListener('keydown', offKey, true); offKey = null; }
  }

  function openPanel(kind) {
    closePanel();
    var main = d.querySelector('.mr-main');
    if (!main) return;
    var p = T.panel[kind] || T.panel.real;

    panel = d.createElement('div');
    panel.className = 'mr-gate';
    panel.id = 'mr-gate';
    panel.tabIndex = -1;
    panel.innerHTML =
        '<button type="button" class="mr-gate-x" aria-label="' + esc(T.close) + '">'
      + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
      + ' stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false">'
      + '<path d="M6 6l12 12M18 6L6 18"/></svg></button>'
      + '<div class="mr-gate-t">' + esc(p.t) + '</div>'
      + '<p class="mr-gate-s">' + esc(p.s) + '</p>'
      + giveGetHTML()
      + '<a class="mr-gate-cta" href="' + PAY_URL + '">' + esc(T.cta) + '</a>';

    main.insertBefore(panel, main.firstChild);
    panel.querySelector('.mr-gate-x').addEventListener('click', closePanel);

    offDoc = function (ev) { if (panel && !panel.contains(ev.target)) closePanel(); };
    offKey = function (ev) { if (ev.key === 'Escape' || ev.key === 'Esc') closePanel(); };
    /* 押した本人のクリックで即閉じないよう、次の tick から外側監視を始める */
    w.setTimeout(function () { d.addEventListener('mousedown', offDoc, true); }, 0);
    d.addEventListener('keydown', offKey, true);

    try { panel.focus({ preventScroll: true }); } catch (e) { panel.focus(); }
    if (panel.scrollIntoView) panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function onClick(ev) {
    var node = ev.currentTarget;
    var k = node.getAttribute('data-mr-gate');

    if (k === 'real') {
      /* 開いている人はそのままリンクとして働く。 */
      if (!node.classList.contains('is-locked')) return;
      /* REAL PAY の上で押されたときは、本文にもう出ている説明へ寄せる。
         同じ内容のパネルを重ねて出さない。 */
      var msg = d.querySelector('.ap-msg--lock');
      if (msg) {
        ev.preventDefault();
        closePanel();
        if (msg.scrollIntoView) msg.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      /* 別の画面からなら、リンクとして REAL PAY へ行かせる（そこに説明がある）。 */
      return;
    }
    ev.preventDefault();
    openPanel(k);
  }

  function boot() {
    var list = items();
    if (!list.length) return;
    mark(keyOpen());
    list.forEach(function (n) { n.addEventListener('click', onClick); });
  }

  w.PVGates = {
    /* 確かな値を持っている画面から呼ぶ（actual-pay.js / my-value.js）。 */
    mark: mark,
    /* ロック画面が同じ3段を描くために使う。 */
    giveGetHTML: giveGetHTML,
    close: closePanel
  };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
