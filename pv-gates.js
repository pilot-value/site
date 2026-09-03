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
     今すぐ開くのは REAL PAY だけ。
     ページを作った回に、下の TIERS の state を 'soon' から外す。

   ★DEEP PAY の解放条件は2つで、どちらも満たしたときだけ（オーナー決定・2026-08-25）。
       ① 給与を出したユニークなパイロットが 100人
          （FOUNDING PILOT 100 と同じ100人。「登録者100人」ではない）
       ② 本人が内訳まで出している（分かる項目だけでよい。全部必須にしない）
     ①と②は**別々に判定する**。100人は Privacy Threshold ではなく、
     「DEEP PAY という機能を正式に開ける区切り」でしかない。
     人数が少ない区分をどう畳むかは、ページを作る回に別で決める。

   ★数はサーバから来る。このファイルは数を作らない・数えない。
     渡されるのは2画面だけ ── actual-pay.js と my-value.js（PVGates.setProgress()）が
     pv_pay_rows() の stats.contributors と give をそのまま渡す。
     ★渡されない画面（設定・待遇アンケート・給与を出した人のマイレポート）では、
       **押されたときに1回だけ** pv_give_progress() に聞く（askProgress）。
       あちらは整数1つと真偽3つしか返さない ── 一覧を引くと、鍵を持つ人に
       要らない行が全部付いてくるので pv_pay_rows() は使わない。
     どちらも届かなければ「準備中」に戻るだけ。0 を置いて埋めない。

   ★先に内訳を出した人が「出し損」に見えないこと。それがこの表示の目的。
     100人に届く前でも内訳は出せるので、出した人には
     「✓ あなたの準備は完了しています」と、あと何人かを見せる。
   ════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';
  if (!w || !d) return;

  var L = (d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';
  var KEY = 'pv_salary_unlock_expiry';
  var PAY_URL = 'pay-report.html#ps';
  var DETAIL_URL = 'pay-report.html#pay-detail';   // 「くわしく入れる」を開いた先
  var INVITE_URL = 'profile.html#pv-invite-slot';  // 招待の常設入口（ここ1つだけ）
  var DEEP_GOAL = 100;                             // ①の人数。FOUNDING PILOT 100 と同じ

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
        /* ★人数がサーバから来たときだけ、こちらを使う（上の文面は数が無いときの控え）。 */
        deepN: {
          t: 'DEEP PAY はパイロット100人で開きます',
          s: '給与を出したパイロットが100人そろったときに開きます。'
           + '内訳まで出してくれている人は、そのときに自動で解放されます。'
        },
        verified: {
          t: 'VERIFIED PAY は準備中です',
          s: '給与明細に裏付けのあるものだけを集めて見られるようにします。'
           + 'まだ作っている途中です。'
        }
      },
      tiers: [
        { give: '給与を1件。手入力でもかまいません', get: 'REAL PAY' },
        { give: '内訳まで詳しく', get: 'DEEP PAY' },
        { give: '給与明細から', get: 'VERIFIED PAY' }
      ],
      unit: 'PILOTS',
      goal: function (n) { return n + ' / ' + DEEP_GOAL + '人'; },
      ready: '✓ あなたの準備は完了しています',
      left: function (k) { return 'あと' + k + '人のパイロットが参加すると自動的に解放されます。'; },
      arrived: '100人に届きました。まもなく開きます。',
      needDetail: '給与の内訳を共有すると、DEEP PAY の準備が整います。',
      ctaDetail: '給与内訳を追加する',
      ctaInvite: '匿名でパイロットを1人招待'
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
        deepN: {
          t: 'DEEP PAY opens at 100 pilots',
          s: 'It opens once 100 pilots have shared their pay. '
           + 'If you have already shared your breakdown, it unlocks for you automatically.'
        },
        verified: {
          t: 'VERIFIED PAY is in preparation',
          s: 'It will aggregate only figures backed by a payslip. '
           + 'We are still building it.'
        }
      },
      tiers: [
        { give: 'One pay record — typing it in is fine', get: 'REAL PAY' },
        { give: 'The full breakdown', get: 'DEEP PAY' },
        { give: 'From a payslip', get: 'VERIFIED PAY' }
      ],
      unit: 'PILOTS',
      goal: function (n) { return n + ' / ' + DEEP_GOAL; },
      ready: '✓ You are already qualified',
      left: function (k) { return k + ' more pilots and it unlocks automatically.'; },
      arrived: '100 pilots reached. Opening soon.',
      needDetail: 'Share your pay breakdown to qualify for DEEP PAY.',
      ctaDetail: 'Add your pay breakdown',
      ctaInvite: 'Invite one pilot anonymously'
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

  /* ── いま何人集まっているか / 本人が何を出したか ────────────────
     ★このファイルは数を作らない。サーバ（pv_pay_rows）から渡されたものを持つだけ。
       渡されないあいだ n は null で、DEEP PAY の札は「準備中」のまま。
       0 を置いて埋めない（REAL PAY の数字カードと同じ決まり）。 */
  var PROG = { n: null, detailed: null };

  function deepN() {
    return (typeof PROG.n === 'number' && PROG.n >= 0) ? PROG.n : null;
  }

  /* 段ごとの「状態」の札。live は今までどおり。
     DEEP PAY だけ、人数が分かっているときに「N / 100人」に変わる。 */
  function pill(tier, live) {
    if (live) return '✓ ' + T.now;
    if (tier.key === 'deep' && deepN() !== null) return T.goal(deepN());
    return T.soon;
  }

  /* ── Give → Get の3段（ロック画面とパネルで同じものを使う）──────
     ★2か所に書き写さない。actual-pay.js もこの関数を呼ぶ。 */
  function giveGetHTML() {
    var rows = TIERS.map(function (tier, i) {
      var t = T.tiers[i];
      var live = tier.state === 'live';
      var goal = (tier.key === 'deep' && !live && deepN() !== null);
      return '<li class="pv-give-r' + (live ? ' is-live' : '')
           + (goal ? ' is-goal' : '') + '">'
           + '<span class="pv-give-g">' + esc(t.give) + '</span>'
           + '<span class="pv-give-ar" aria-hidden="true">→</span>'
           + '<span class="pv-give-t">' + esc(t.get) + '</span>'
           + '<span class="pv-give-s"><span class="pv-give-p">'
           + esc(pill(tier, live))
           + '</span></span></li>';
    }).join('');
    return '<div class="pv-give">'
         + '<div class="pv-give-hd"><span>' + esc(T.giveHd) + '</span>'
         + '<span>' + esc(T.getHd) + '</span></div>'
         + '<ul class="pv-give-l">' + rows + '</ul></div>';
  }

  /* 数が後から届いたとき、すでに描いてある3段を描き直す。
     ★描き直すのはこの3段だけ。まわりの文章には手を触れない。 */
  function refreshGive() {
    Array.prototype.slice.call(d.querySelectorAll('.pv-give')).forEach(function (el) {
      var box = d.createElement('div');
      box.innerHTML = giveGetHTML();
      if (el.parentNode) el.parentNode.replaceChild(box.firstChild, el);
    });
    if (panel && panel.getAttribute('data-kind') === 'deep') openPanel('deep');
  }

  /* actual-pay.js / my-value.js が pv_pay_rows() の返りをそのまま渡す。
       n        … stats.contributors（給与を出したユニークな人数）
       detailed … give.detailed（本人が内訳まで出しているか）
     どちらも分からなければ渡さなくてよい。渡さなければ今までの見た目に戻るだけ。 */
  function setProgress(o) {
    if (!o) return;
    if (typeof o.n === 'number' && isFinite(o.n) && o.n >= 0) PROG.n = Math.floor(o.n);
    if (typeof o.detailed === 'boolean') PROG.detailed = o.detailed;
    refreshGive();
  }

  /* ── 数を渡されない画面のために、押されたら1回だけ聞く ────────────
     左メニューは4画面に同じものが出ていて、DEEP PAY を押すとどこでも同じ説明が開く。
     ところが数を渡してくれるのは pv_pay_rows() を引く2画面だけで、残りは
     「準備中」のままだった＝**同じボタンなのに画面によって答えが違う**（2026-08-25）。

     ★ここでも数えない。pv_give_progress() が返した整数と真偽を、そのまま setProgress へ渡す。
     ★引くのは押されたときだけ・1度きり。ページを開いただけでは1回も投げない
       （設定ページを開くだけで通信が増えない）。
     ★既に渡されている画面（REAL PAY・空のマイレポート）では引かない。
     ★失敗・未ログイン・関数がまだ無い → 黙って「準備中」のまま。0 を置いて埋めない。
     ★クライアントは他画面と同じく、別の <script> が宣言した const sb を try で拾う
       （actual-pay.js と同じ書き方）。押されたときなので読み込み順に左右されない。 */
  var asked = false;

  function askProgress() {
    if (asked || deepN() !== null) return;
    asked = true;
    var client = null;
    try { client = sb; } catch (e) { client = null; }
    if (!client || typeof client.rpc !== 'function') return;
    var q;
    try { q = client.rpc('pv_give_progress'); } catch (e) { return; }
    if (!q || typeof q.then !== 'function') return;
    q.then(function (res) {
      var v = res && res.data;
      if (!v || v.ok !== true || typeof v.contributors !== 'number') return;
      setProgress({ n: v.contributors, detailed: v.give ? v.give.detailed : null });
    }, function () { /* 黙って「準備中」のまま */ });
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

  /* DEEP PAY のときだけ、条件2つの進み具合を出す。
     ★①（100人）と②（本人の内訳）は別々に書く。混ぜると
       「100人そろえば誰でも見られる」とも「内訳を出せば今日見られる」とも読めてしまう。
     ★先に内訳を出した人が出し損に見えないこと。それがこの塊の目的。 */
  function deepBody() {
    var n = deepN();
    if (n === null) return '';
    var left = DEEP_GOAL - n;
    var mine = (PROG.detailed === true)
      ? '<p class="mr-gate-ok">' + esc(T.ready) + '</p>'
      : '<p class="mr-gate-need">' + esc(T.needDetail) + '</p>'
        + '<a class="mr-gate-cta" href="' + DETAIL_URL + '">' + esc(T.ctaDetail) + '</a>';
    return '<div class="mr-gate-goal">'
         + '<span class="mr-gate-goal-k">DEEP PAY</span>'
         + '<span class="mr-gate-goal-n">' + esc(T.goal(n)) + '</span>'
         + '<span class="mr-gate-goal-u">' + esc(T.unit) + '</span></div>'
         + '<p class="mr-gate-left">' + esc(left > 0 ? T.left(left) : T.arrived) + '</p>'
         + mine
         + '<a class="mr-gate-inv" href="' + INVITE_URL + '">' + esc(T.ctaInvite) + '</a>';
  }

  function openPanel(kind) {
    /* ★ここだけが askProgress の入口。押されたときにしか通らない。
         refreshGive() から呼び返されても asked が立っているので二度は投げない。 */
    askProgress();
    closePanel();
    var main = d.querySelector('.mr-main');
    if (!main) return;
    var deep = (kind === 'deep' && deepN() !== null);
    var p = (deep ? T.panel.deepN : T.panel[kind]) || T.panel.real;

    panel = d.createElement('div');
    panel.className = 'mr-gate';
    panel.id = 'mr-gate';
    panel.tabIndex = -1;
    panel.setAttribute('data-kind', kind);
    panel.innerHTML =
        '<button type="button" class="mr-gate-x" aria-label="' + esc(T.close) + '">'
      + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
      + ' stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false">'
      + '<path d="M6 6l12 12M18 6L6 18"/></svg></button>'
      + '<div class="mr-gate-t">' + esc(p.t) + '</div>'
      + '<p class="mr-gate-s">' + esc(p.s) + '</p>'
      + (deep ? deepBody() : '')
      + giveGetHTML()
      + (deep ? '' : '<a class="mr-gate-cta" href="' + PAY_URL + '">' + esc(T.cta) + '</a>');

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
    /* 同じ2つが pv_pay_rows() の stats.contributors と give.detailed を渡す。
       ★呼ばれない画面では、DEEP PAY を押した時に pv_give_progress() へ1回だけ聞く。 */
    setProgress: setProgress,
    /* ロック画面が同じ3段を描くために使う。 */
    giveGetHTML: giveGetHTML,
    /* ★左メニュー以外から同じ門を開くために使う（actual-pay.js の面の主 CTA）。
         ⚠️ これは「DEEP PAY への入口を1つ増やした」のではない。開くのは
            **説明パネル**で、deep-pay.html へは繋がっていない。
            あちらへの辺は deep-pay.js ⇄ deep-pay-compare.js の2本だけ。 */
    open: openPanel,
    close: closePanel
  };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
