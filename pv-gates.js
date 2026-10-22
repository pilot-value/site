/* ════════════════════════════════════════════════════════════════
   pv-gates.js — Give → Get の門（左メニューの錠前と、その説明）

   マイページ系の画面（日英）が <script> で読み、それ以外の画面では
   pv-give-first.js が3段の表のためだけに借りる。やることは2つだけ。
     ① 左メニューの REAL PAY に錠前を出すか決める
        （DEEP PAY / VERIFIED PAY の段は 2026-09-06 に左メニューから外してある）
     ② 「何を出すと何が見られるか」の3段の表を貸す（giveGetHTML）

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
   ★DEEP PAY は 2026-10-11 に公開した（オーナー判断）。下の TIERS で live。
     ⚠️ **このファイルに DEEP PAY への入口を書かない**（リンクも、押せる札も）。
        入口は REAL PAY と DEEP PAY の見出しのタブ（actual-pay.html / deep-pay.html に
        静的に在る）と、REAL PAY の行を押すと出る面のボタン（actual-pay.js）だけ。
        assert-deep-pay.mjs の ① が、その辺の集合をちょうどで固定している
        ── ここに deep-pay の住所を1つ書くと、あちらが赤くなる。
     ⚠️ **DEEP PAY が開く条件をここで説明しない**（「◯◯すると開きます」と書かない）。
        条件はサーバ（db/deep-pay.sql の門）だけが知っていて、まだ開かない人には
        DEEP PAY の画面そのものが「何が残っているか」を見せる。外の画面が条件を
        言い直すと、門を動かした日にここだけ嘘が残る。
   ★VERIFIED PAY は**まだページが無い**。だから「詳しく出すと開きます」とは書かない。
     ページを作った回に、下の TIERS の state を 'soon' から外す。

   ── 2026-10-11 に外したもの（公開前の案内。戻さない）────────────────
   ・3段の表の DEEP PAY の札（「準備中」／「N / 100人」）と、札を押すと出ていた説明
     （「DEEP PAY はパイロット100人で開きます」「あと◯人…」「✓ あなたの準備は完了しています」
      「給与の内訳を共有すると…」「給与内訳を追加する」「匿名でパイロットを1人招待」）。
     オーナー指示「3段の表の DEEP PAY の札自体もういらない」── 段は**名前だけ**を出す。
   ・人数を聞く仕掛け（pv_give_progress を押されたときに1回だけ引いていた）。
     このファイルは、もう通信を1本も投げない。
   ★PVGates.setProgress() は**受け取って何もしない**。呼ぶ側が4つ残っているので
     名前は消さない（いちばん下の PVGates の注に、呼ぶ側の一覧がある）。
   ════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';
  if (!w || !d) return;

  var L = (d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';
  var KEY = 'pv_salary_unlock_expiry';
  var PAY_URL = 'pay-report.html#ps';
  /* ★DEEP PAY の住所はここに持たない（冒頭の「DEEP PAY / VERIFIED PAY について」）。
       内訳の欄・招待の入口・100人の数も、2026-10-11 に札と一緒に外した。 */

  var T = {
    ja: {
      giveHd: 'あなたが出すもの', getHd: '見られるもの',
      now: '給与提出で解放', soon: '準備中',
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
        /* ★deep の説明は 2026-10-11 に外した（公開したので「準備中」は嘘になる。
             開く条件は DEEP PAY の画面そのものが言う ── ここで言い直さない）。 */
        verified: {
          t: 'VERIFIED PAY は準備中です',
          s: '給与明細に裏付けのあるものだけを集めて見られるようにします。'
           + 'まだ作っている途中です。'
        }
      },
      tiers: [
        { give: '手動入力か明細読み取り', get: 'REAL PAY' },
        /* ★2026-09-13 オーナー指示で「内訳まで詳しく」を消した。
             空のときは矢印も出さない（下の giveGetHTML）。
           ★2026-10-11 オーナー指示で札も外した。この段は**名前だけ**。 */
        { give: '', get: 'DEEP PAY' },
        { give: '給与明細から', get: 'VERIFIED PAY' }
      ]
    },
    en: {
      giveHd: 'What you share', getHd: 'What you can see',
      now: 'Share pay to unlock', soon: 'In preparation',
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
        verified: {
          t: 'VERIFIED PAY is in preparation',
          s: 'It will aggregate only figures backed by a payslip. '
           + 'We are still building it.'
        }
      },
      tiers: [
        { give: 'Manual entry or payslip scan', get: 'REAL PAY' },
        { give: '', get: 'DEEP PAY' },
        { give: 'From a payslip', get: 'VERIFIED PAY' }
      ]
    }
  }[L];

  /* 段の状態。★REAL PAY と DEEP PAY が live（DEEP PAY は 2026-10-11 に公開）。
       VERIFIED PAY だけが 'soon' ── ページを作った回に 'live' へ変える。
     ★live は「ページが在る」という意味で、**見ている人に開いている**という意味ではない。
       開くかどうかはサーバが決める（REAL PAY ＝ pv_pay_rows()・DEEP PAY ＝ pv_deep_pay()）。
     ⚠️ 並びを変えない。文言（T.tiers）と同じ番号で引いている。 */
  var TIERS = [
    { key: 'real',     state: 'live' },
    { key: 'deep',     state: 'live' },
    { key: 'verified', state: 'soon' }
  ];
  function isSoon(key) {
    for (var i = 0; i < TIERS.length; i++) {
      if (TIERS[i].key === key) return TIERS[i].state === 'soon';
    }
    return false;
  }

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

  /* 段ごとの「状態」の札。
     ★2026-09-15 オーナー指示。「いま開きます」は、まだ出していない人には
       もう見られると読めてしまう。開くための条件をそのまま札に書く。
       ✓ も外す（済んだことを表す印なので、条件と並ぶと逆の意味になる）。
     ★DEEP PAY の段は札を持たない（2026-10-11 オーナー指示「3段の表の DEEP PAY の札自体
       もういらない」）。空文字を返す ＝ 札の要素そのものを描かない。
       ⚠️ REAL PAY の札の字（T.now ＝「給与提出で解放」）を DEEP PAY に使い回さない。
          DEEP PAY が開く条件は給与を1件出すことではない ── 条件を言うのは DEEP PAY の
          画面だけ（冒頭の注）。 */
  function pill(tier, live) {
    if (tier.key === 'deep') return '';
    return live ? T.now : T.soon;
  }

  /* ── Give → Get の3段（ロック画面とパネルで同じものを使う）──────
     ★2か所に書き写さない。actual-pay.js もこの関数を呼ぶ。

     ★★**押せる札は1つも無い**（2026-10-11）。
        2026-09-06 から、DEEP PAY の札だけが押せて、公開前の説明（あと◯人・内訳を
        共有すると…）を開いていた。DEEP PAY を公開した日に、札ごと外した。
        ⚠️ この表から DEEP PAY へリンクを張らない。入口は見出しのタブと、REAL PAY の
           行の面のボタンだけ（assert-deep-pay.mjs の ① が辺の集合を固定している）。
           この表は登録完了の画面（signup.html）と、全ページに出る板（pv-give-first.js）
           にも出る ── ここに住所を書くと、入口が約400枚に一度に生える。
     ⚠️ **VERIFIED PAY の札も押さない。** 本人確認の機能がまだ無いので、
        新しいクリック導線も目立たせる見た目も作らない
        （説明パネルのコードは消さない ── 機能ができた日に戻せるようにしておく）。
     ★引数（inPanel）は**もう何も変えない**。前は「パネルの中では DEEP PAY の札を
        押せなくする」ための印だった。呼ぶ側（signup.html・pv-give-first.js・下の
        openPanel）が true を渡し続けているので、受け口だけ残してある。 */
  function giveGetHTML(inPanel) {
    var rows = TIERS.map(function (tier, i) {
      var t = T.tiers[i];
      var live = tier.state === 'live';
      var p = pill(tier, live);
      return '<li class="pv-give-r' + (live ? ' is-live' : '') + '">'
           + '<span class="pv-give-g">' + esc(t.give) + '</span>'
           /* ★出すものが空の段では矢印も出さない（何も指していない矢印になる）。
                升そのものは消さない ── subgrid の列がずれて罫線が食い違う。 */
           + '<span class="pv-give-ar" aria-hidden="true">'
           + (t.give ? '→' : '') + '</span>'
           + '<span class="pv-give-t">' + esc(t.get) + '</span>'
           /* ★札が無い段でも、札の升は置く（同じ理由 ── 列と罫線をそろえる）。 */
           + '<span class="pv-give-s">'
           + (p ? '<span class="pv-give-p">' + esc(p) + '</span>' : '')
           + '</span></li>';
    }).join('');
    return '<div class="pv-give">'
         + '<div class="pv-give-hd"><span>' + esc(T.giveHd) + '</span>'
         + '<span>' + esc(T.getHd) + '</span></div>'
         + '<ul class="pv-give-l">' + rows + '</ul></div>';
  }

  /* ★受け取って何もしない（2026-10-11）。
       前は { n, detailed } を受け取り、DEEP PAY の札を「N / 100人」に描き直していた。
       札そのものを外したので、数を持つ理由が無い。
     ⚠️ 名前は消さない。呼ぶ側が4つ残っている（どれも「在れば呼ぶ」形なので、
        消しても落ちはしないが、このファイルだけ古いものが端末に残る4時間のあいだ、
        新旧どちらの組み合わせでも同じに動くようにしておく）──
          my-value.js（空のマイレポート）／deep-pay.js／deep-pay-compare.js／roadmap.js
        呼ぶ側を片づけた日に、ここも消す。
     ⚠️ ここに数を持ち直さない・ここから通信しない（pv_give_progress はもう引かない）。 */
  function setProgress() {}

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

  /* REAL PAY の錠前だけを付け外しする。
     ★いま左メニューに在る門は REAL PAY の1つだけ（2026-09-06 から）。
       下の2つの枝は、段を足し戻した日のための決まり ──
         'soon' の段（VERIFIED PAY）… ページが無いあいだ**誰にとっても**閉じている
         'live' の段（DEEP PAY）   … 錠前を描かない。開くかどうかを知っているのは
                                      サーバだけで、ここが読む鍵の写しは REAL PAY のもの。
                                      閉じている人には DEEP PAY の画面が理由を見せる。 */
  function mark(isOpen) {
    items().forEach(function (node) {
      var k = node.getAttribute('data-mr-gate');
      if (k === 'real') setLocked(node, !isOpen, false);
      else if (isSoon(k)) setLocked(node, true, true);
      else setLocked(node, false, false);
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

  /* ★開けるのは 'verified' と 'real' だけ。
       'deep' は**何もしない**（2026-10-11）── 前は公開前の説明（100人・内訳）を出していた。
       公開したので言うことが無い。条件は DEEP PAY の画面が言う（冒頭の注）。
     ★いまこの関数へ届く道は PVGates.open() だけで、製品のどこからも呼ばれていない
       （VERIFIED PAY の札は押せない・左メニューの門は REAL PAY だけで、あれは下の
        onClick が本文の案内へ寄せる）。**消さずに残してある** ── VERIFIED PAY の
       機能ができた日に、札を押せるようにするだけで説明が戻る。
       動くことは assert-pay-rows.mjs の A-3 が PVGates.open('verified') で見ている。 */
  function openPanel(kind) {
    if (kind === 'deep') return;
    closePanel();
    var main = d.querySelector('.mr-main');
    if (!main) return;
    var p = T.panel[kind] || T.panel.real;

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
      + giveGetHTML(true)
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
    /* ★止めるのは 'soon' の段だけ（ページが無いので、説明を出す）。
         'live' の段（DEEP PAY）は**止めない** ── 段を足し戻した日に、押しても
         何も起きないリンクにしない（openPanel('deep') は何もしないので）。 */
    if (!isSoon(k)) return;
    ev.preventDefault();
    openPanel(k);
  }

  /* ★3段の表の札を押す聞き手（document の click）は 2026-10-11 に外した。
       押せる札が1つも無い。VERIFIED PAY の札を押せるようにする日は、
       札に data 属性を付けてここで受け直す。 */
  function boot() {
    var list = items();
    if (!list.length) return;
    mark(keyOpen());
    list.forEach(function (n) { n.addEventListener('click', onClick); });
  }

  w.PVGates = {
    /* 確かな値を持っている画面から呼ぶ（actual-pay.js / my-value.js /
       deep-pay.js / deep-pay-compare.js）。 */
    mark: mark,
    /* ★何もしない（上の setProgress の注）。呼ぶ側が残っているので名前だけ在る。 */
    setProgress: setProgress,
    /* ロック画面・空のマイレポート・登録完了・全ページの板が、同じ3段を描くために使う。 */
    giveGetHTML: giveGetHTML,
    /* ★説明のパネルを開く。'verified' と 'real' だけ・'deep' は何もしない（openPanel の注）。
         2026-10-11 まで、REAL PAY の行の面のボタンがここから DEEP PAY の説明を
         開いていた。あのボタンは DEEP PAY へのただのリンクになった（actual-pay.js）。
         いま製品から呼ぶ所は無い ── 検査（assert-pay-rows.mjs の A-3）だけが呼ぶ。 */
    open: openPanel,
    close: closePanel
  };

  /* ★文言だけを借りに来たときは、左メニューの錠前を描かない（2026-09-15）。
       pv-give-first.js は giveGetHTML() の3段のためだけにこのファイルを読み込む。
       そのまま boot() まで走らせると、**頼まれていない 400 枚のナビに錠前が付く**
       （data-mr-gate は全ページの REAL PAY のリンクに付いている）。
     ⚠️ <script> で静的に読んでいる18枚はここを通らない。この印を立てるのは
        pv-give-first.js だけで、あちらは PVGates が既に在れば読み込みもしない。 */
  if (w.PV_GATES_TEXT_ONLY) return;

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
