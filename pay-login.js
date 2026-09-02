/* pay-login.js — 明細レポートの「送信して結果を見る」を押した人に、
   ページを離れずにログイン／会員登録してもらう箱。

   2026-08-14 まで、ここは login.html へのリンク1本だった。明細を読ませて
   最後まで入力した人を別ページへ飛ばすので、いちばん濃い見込み客がそこで落ちていた。

   ★入口は1つ。押せるものは Google とコードの2つ、入力欄はメール1つだけ。
     2026-08-22 まで「はじめての方」と「お持ちの方」に分かれていて、押せるものが5つ・
     入力欄が3つあった。signInWithOtp({ shouldCreateUser: true }) → 6桁 verifyOtp は
     新規も既存も同じ1本を通る（新規かどうかは Supabase 側が決める）ので、
     どちらかを選ばせる必要がそもそも無い。パスワードは折りたたみの中。

   ★Supabase クライアントはページ側の物をそのまま受け取る（ここで createClient しない）。
     同じ localStorage を見るクライアントが2つできると認証状態が壊れる。

   使い方（pay-report.html / en/pay-report.html）:
     PVPayLogin({ sb: _sb, lang: 'ja', mount: document.getElementById('pay-login'),
                  saved: true, onSignedIn: function () { afterSignedIn(); },
                  getClaim: function () { return PVClaimPending.latest(); },
                  recap: 'ANA ／ 副操縦士 ／ A320 ／ 2026年7月分' });
   ★getClaim: ページを離れる経路で戻り先URLに載せる預かり証。無ければ '' を返す。
   ★recap: 「受け取りました」の下に出す1行。**金額を入れないこと**（Give to Get の壁）。
   ★saved: 給与データが既にサーバへ預かってあるか。2026-08-17 から、送信を押した
     時点で保存が済むようになったので、既定はこちら（見出しが「受け取りました」になる）。
     false は預かりそこねたときだけ＝ログインできた所からその場で送り直す。
   ★2回呼んでも中身を作り直さない（見出しだけ書き替える）。 */
(function () {
  'use strict';

  var T = {
    ja: {
      title: 'あと一歩でレポートが出ます',
      lead: '入力した内容は<b>この端末に預けてあります</b>。ログインするとそのまま送信され、レポートが出ます。メールアドレスはレポートに含まれません。',
      /* ★預かりが済んでいるときの見出し。上の title/lead は「まだ送れていない」
         ときの言葉なので、預かった後に出すと嘘になる（もうサーバにある）。 */
      savedTitle: '給与データを受け取りました ✓',
      savedLead: '<b>あなた専用レポートを保存する。</b>アカウントを作ると、いま提出していただいた給与データがそのままレポートになり、<b>給与詳細が90日間</b>開きます。メールアドレスはレポートに含まれません。',
      /* ★入口は1つ。2026-08-22 まで「はじめての方」と「お持ちの方」の2ブロックで、
         押せるものが5つ・入力欄が3つあった。signInWithOtp({shouldCreateUser:true}) は
         新規も既存も同じ1本で通るので、どちらかを選ばせる意味がそもそも無い。 */
      google: 'Google で続ける',
      orLine: 'または',
      email: 'メールアドレス',
      password: 'パスワード',
      sendCode: 'コードを送る',
      sending: '送信中…',
      signIn: 'ログイン',
      signingIn: 'ログイン中…',
      passWay: 'パスワードでログイン',
      /* 同意はこの1つの入口に置く。既に「解除した」人には claimOptIn が触らないので
         （下の「解除済みの人」の行）、レポートを見に来ただけの操作で設定は戻らない。 */
      optin: '年収データの更新と、<b>毎月の給与明細リマインド</b>をメールで受け取る',
      optinNote: '（リマインドはご自身の給料日ごろへ月1通。1クリックで解除できます）',
      /* ★6桁の段。宛先を必ず見せる。どこに届くか分からないまま待たせない。 */
      codeHead: function (mail) { return '<b>' + mail + '</b> にメールを送りました。'; },
      /* ★リンクの話をここに書かない。メールからリンクを外した（Supabase のテンプレート）。
         リンクを押すとメールアプリの中の別のブラウザが開き、給与データの預かり証が
         そこには無いので丸ごと消える。2026-08-22 に実際に2人ぶん消えていた。 */
      codeNote: 'この画面に、届いた6桁のコードを入力してください。',
      code: '6桁のコード',
      verify: 'コードで進む',
      verifying: '確認中…',
      resend: 'メールを再送する',
      resendWait: function (sec) { return 'あと ' + sec + ' 秒で再送できます'; },
      back: '← 戻る',
      resent: 'メールを再送しました。',
      done: 'ログインしました。レポートを作っています…',
      badEmail: 'メールアドレスを正しく入力してください。',
      badPass: 'メールアドレスまたはパスワードが正しくありません。',
      badCode: '6桁の数字を入力してください。',
      wrongCode: 'コードが正しくないか、有効期限が切れています。再送してお試しください。',
      tooFast: 'いまメールの送信が混み合っています。少し時間をおいてからお試しください。',
      sendFail: 'メールを送信できませんでした。通信を確かめて、もう一度お試しください。',
    },
    en: {
      title: 'One step left before your report',
      lead: 'What you entered is <b>held on this device</b>. Sign in and it is submitted straight away. Your email address is never part of the report.',
      savedTitle: 'We have your pay data ✓',
      savedLead: '<b>Save your own report.</b> Create an account and what you just submitted becomes your report, unlocking <b>full pay detail for 90 days</b>. Your email address is never part of the report.',
      google: 'Continue with Google',
      orLine: 'or',
      email: 'Email address',
      password: 'Password',
      sendCode: 'Send me a code',
      sending: 'Sending…',
      signIn: 'Sign in',
      signingIn: 'Signing in…',
      passWay: 'Sign in with a password',
      optin: 'Email me pay-data updates and a <b>monthly payslip reminder</b>',
      optinNote: '(about one a month, around your own pay day. One click to stop.)',
      codeHead: function (mail) { return 'We emailed <b>' + mail + '</b>.'; },
      codeNote: 'Type the 6-digit code from that email into this screen.',
      code: '6-digit code',
      verify: 'Continue with code',
      verifying: 'Checking…',
      resend: 'Send the email again',
      resendWait: function (sec) { return 'You can resend in ' + sec + 's'; },
      back: '← Back',
      resent: 'We sent the email again.',
      done: 'Signed in. Building your report…',
      badEmail: 'Please enter a valid email address.',
      badPass: 'That email address or password is not right.',
      badCode: 'Please enter the 6 digits.',
      wrongCode: 'That code is wrong or has expired. Send it again and retry.',
      tooFast: 'Email sending is busy right now. Please wait a moment and try again.',
      sendFail: 'The email could not be sent. Check your connection and try again.',
    },
  };

  var GOOGLE_SVG =
    '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>' +
    '<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>' +
    '<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>' +
    '<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>';

  /* 既存の .form-input / .btn-orange / .btn-ghost はページ側の物をそのまま使う。
     ここで足すのは、この箱にしか無い並べ方だけ。日英で1枚に保つため JS から挿す。 */
  var CSS = [
    '.pl-wrap{text-align:left}',
    '.pl-title{font-size:1.05rem;font-weight:800;letter-spacing:-.01em;color:#e8edf2;margin-bottom:6px}',
    '.pl-lead{font-size:.82rem;line-height:1.7;color:#a8b3c2;margin-bottom:20px}',
    '.pl-block+.pl-block{margin-top:22px;padding-top:22px;border-top:1px solid rgba(255,255,255,.09)}',
    '.pl-head{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#f5c842;margin-bottom:12px}',
    '.pl-row{display:flex;flex-direction:column;gap:10px}',
    '@media (min-width:560px){.pl-row.pl-inline{flex-direction:row}.pl-row.pl-inline .form-input{flex:1}}',
    '.pl-google{width:100%;padding:12px;margin-bottom:12px;background:rgba(255,255,255,.06);color:#e8edf2;',
    'border:1px solid rgba(255,255,255,.11);border-radius:10px;font-weight:600;font-size:.88rem;cursor:pointer;',
    'display:flex;align-items:center;justify-content:center;gap:10px;font-family:inherit;transition:background .2s,border-color .2s}',
    '.pl-google:hover{background:rgba(255,255,255,.11);border-color:rgba(255,255,255,.2)}',
    '.pl-google:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:2px}',
    '.pl-google:active{transform:translateY(1px)}',
    '.pl-link{display:inline-block;margin-top:12px;background:none;border:none;padding:0;cursor:pointer;',
    'font-family:inherit;font-size:.78rem;color:#a8b3c2;text-decoration:underline;text-underline-offset:3px;transition:color .2s}',
    '.pl-link:hover{color:#f5c842}',
    '.pl-link:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:3px;border-radius:4px}',
    '.pl-msg{display:none;margin-top:12px;font-size:.8rem;line-height:1.6;padding:9px 12px;border-radius:9px;',
    'color:#f87171;background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.22)}',
    '.pl-msg.is-ok{color:#4ade80;background:rgba(74,222,128,.08);border-color:rgba(74,222,128,.22)}',
    '.pl-code{letter-spacing:.35em;text-align:center;font-size:1.05rem;font-weight:700}',
    '.pl-or{display:flex;align-items:center;gap:12px;margin:14px 0;font-size:.72rem;color:#6b7d93;',
    'text-transform:uppercase;letter-spacing:.1em}',
    '.pl-or::before,.pl-or::after{content:"";flex:1;height:1px;background:rgba(255,255,255,.09)}',
    /* 受け取った中身の1行。★金額は絶対に入れない（Give to Get の壁） */
    '.pl-recap{display:none;margin:-12px 0 20px;padding:9px 12px;border-radius:9px;font-size:.8rem;',
    'font-weight:600;color:#f5c842;background:rgba(245,200,66,.07);border:1px solid rgba(245,200,66,.18)}',
    '.pl-pass{margin-top:14px}',
    '.pl-pass>summary{list-style:none;cursor:pointer;display:inline-block;font-size:.78rem;color:#a8b3c2;',
    'text-decoration:underline;text-underline-offset:3px;transition:color .2s}',
    '.pl-pass>summary::-webkit-details-marker{display:none}',
    '.pl-pass>summary:hover{color:#f5c842}',
    '.pl-pass>summary:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:3px;border-radius:4px}',
    '.pl-pass[open]>summary{margin-bottom:12px}',
    '.pl-optin{display:flex;gap:10px;align-items:flex-start;cursor:pointer;margin-top:12px;',
    'padding:11px 13px;background:rgba(245,200,66,.06);border:1px solid rgba(245,200,66,.18);border-radius:10px}',
    '.pl-optin input{margin-top:2px;width:16px;height:16px;accent-color:#f5c842;flex:none}',
    '.pl-optin span{font-size:.78rem;line-height:1.65;color:#c6d0dc}',
    '.pl-optin small{display:block;margin-top:3px;font-size:.72rem;color:#8593a5}',
    '.pl-optin:hover{border-color:rgba(245,200,66,.32)}',
    '.pl-optin:focus-within{outline:2px solid rgba(245,200,66,.6);outline-offset:2px}',
    '[data-theme="light"] .pl-title{color:#0f172a}',
    '[data-theme="light"] .pl-lead{color:#475569}',
    '[data-theme="light"] .pl-block+.pl-block{border-top-color:rgba(0,0,0,.1)}',
    '[data-theme="light"] .pl-head{color:#b8860b}',
    '[data-theme="light"] .pl-google{background:rgba(0,0,0,.04);border-color:rgba(0,0,0,.12);color:#0f172a}',
    '[data-theme="light"] .pl-google:hover{background:rgba(0,0,0,.07);border-color:rgba(0,0,0,.22)}',
    '[data-theme="light"] .pl-link{color:#475569}',
    '[data-theme="light"] .pl-link:hover{color:#b8860b}',
    '[data-theme="light"] .pl-msg{color:#b91c1c;background:rgba(220,38,38,.07);border-color:rgba(220,38,38,.3)}',
    '[data-theme="light"] .pl-msg.is-ok{color:#0d8a63;background:rgba(13,138,99,.08);border-color:rgba(13,138,99,.25)}',
    '[data-theme="light"] .pl-optin{background:rgba(184,134,11,.07);border-color:rgba(184,134,11,.24)}',
    '[data-theme="light"] .pl-optin span{color:#334155}',
    '[data-theme="light"] .pl-optin small{color:#64748b}',
    '[data-theme="light"] .pl-or{color:#64748b}',
    '[data-theme="light"] .pl-or::before,[data-theme="light"] .pl-or::after{background:rgba(0,0,0,.1)}',
    '[data-theme="light"] .pl-recap{color:#8a6400;background:rgba(184,134,11,.08);border-color:rgba(184,134,11,.26)}',
    '[data-theme="light"] .pl-pass>summary{color:#475569}',
    '[data-theme="light"] .pl-pass>summary:hover{color:#b8860b}',
    '@media (prefers-reduced-motion:reduce){.pl-google,.pl-link,.pl-pass>summary{transition:none}}',
  ].join('');

  function injectCss() {
    if (document.getElementById('pl-style')) return;
    var s = document.createElement('style');
    s.id = 'pl-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ── 計測 ────────────────────────────────────────────────────
     この箱には長らく計測が1本も無く、「明細を出そうとして詰まった人」と
     「そもそも出す気が無かった人」が区別できなかった（2026-08、明細の読み取り
     17回に対して保存0件）。段の名前だけを送って、どこで消えたかを見えるようにする。

     ★送るのは段の名前と短い理由だけ。メールアドレス・金額・社名・明細の中身・
       エラー本文は送らない（pay-report.html の track() と同じ方針）。 */
  function track(name, params) {
    try {
      if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
    } catch (e) { /* 計測でログインを止めない */ }
  }

  /* ── メールの同意をここで預かる理由 ────────────────────────────
     同意の旗を立てられるのはログイン後（set_mail_optin は authenticated だけ）。
     ところが Google とメール内リンクは**この時点でページを離れる**ので、
     チェックの状態はその場では使えない。入力そのものと同じように端末へ預け、
     戻ってきて送信が通った所で1回だけ適用する（claimOptIn）。

     ★ここを繋がないと、この箱から入った人は会員になってもメールが一通も出せない。
       signup.html を通らない＝同意を聞く画面が一度も出ないため。実際、2026-08-11 の
       時点で mail_optin が true の人は27人中0人だった。 */
  var OPTIN_KEY = 'pv_pay_optin';
  var OPTIN_TTL = 60 * 60 * 1000;   // 1時間。別の日の意思をあとから適用しない

  window.PVPayLogin = function (o) {
    if (!o || !o.sb || !o.mount) return;
    var sb = o.sb;
    var L = o.lang === 'en' ? 'en' : 'ja';
    var t = T[L];
    var mount = o.mount;

    /* 見出しは「もうサーバに預かってあるか」で変わる。
       ★二重初期化は防ぐが、見出しだけは呼ばれるたびに書き替える。
         打ちかけのメールや6桁の段を作り直さずに、状態だけ最新にするため。 */
    var head = o.saved ? t.savedTitle : t.title;
    var body = o.saved ? t.savedLead : t.lead;
    /* ★受け取った中身を1行だけ返す。ここが無いと「届いたのか分からない」ので、
         同じ人が同じ内容をもう一度送る（2026-08-21 20:11 と 20:17 に実際に起きた）。
       ★金額は1つも出さない。年収も比較も出さない＝ Give to Get は崩さない。
       ★文字列はページ側が作る（社名の語彙をここに持たせない）。 */
    var recap = o.saved && typeof o.recap === 'string' ? o.recap : '';
    if (mount.dataset.plReady === '1') {
      var ti = document.getElementById('pl-title');
      var le = document.getElementById('pl-lead');
      var rc = document.getElementById('pl-recap');
      if (ti) ti.textContent = head;
      if (le) le.innerHTML = body;
      if (rc) { rc.textContent = recap; rc.style.display = recap ? 'block' : 'none'; }
      return;
    }
    mount.dataset.plReady = '1';
    injectCss();

    /* ── 戻り先 ──────────────────────────────────────────────
       ★必ず絶対パスで書く。en/ から相対で書くと着地が壊れる。
       ★**預かり証を URL に載せる**。ページを離れる経路（Google・メール内リンク）で
         別のブラウザに着地すると、端末の pv_pay_claim がそこには無い。
         2026-08-22 に本番で2人ぶん消えていたのがこれ。URL に載せた1枚が唯一の綱になる。
       ★マウント時ではなくクリックの瞬間に組む。マウントは提出より前に走ることがあり、
         その時点ではまだ預かり証が存在しない。 */
    var NEXT = L === 'en' ? '/en/pay-report.html' : '/pay-report.html';
    function callbackUrl() {
      var next = NEXT;
      var tok = '';
      try { tok = typeof o.getClaim === 'function' ? String(o.getClaim() || '') : ''; } catch (e) {}
      if (/^[0-9a-f]{48}$/i.test(tok)) next += '?claim=' + tok;
      return 'https://pilot-value.com/auth-callback.html?next=' + encodeURIComponent(next);
    }

    mount.innerHTML =
      '<div class="pl-wrap">' +
        '<div class="pl-title" id="pl-title">' + esc(head) + '</div>' +
        '<p class="pl-lead" id="pl-lead">' + body + '</p>' +

        '<div class="pl-recap" id="pl-recap"' + (recap ? ' style="display:block"' : '') + '>' + esc(recap) + '</div>' +

        /* ★1ブロック。押せるものは Google とコードの2つ、入力欄は1つ。
           パスワードは折りたたみの中（使う人だけが開く）。 */
        '<div id="pl-main">' +
          '<button type="button" class="pl-google" id="pl-g-up">' + GOOGLE_SVG + esc(t.google) + '</button>' +
          '<div class="pl-or">' + esc(t.orLine) + '</div>' +
          '<div class="pl-row pl-inline">' +
            '<input class="form-input" type="email" id="pl-up-mail" autocomplete="email" placeholder="' + esc(t.email) + '">' +
            '<button type="button" class="btn-orange justify-center" id="pl-up-btn">' + esc(t.sendCode) + '</button>' +
          '</div>' +
          '<label class="pl-optin">' +
            '<input type="checkbox" id="pl-optin" checked>' +
            '<span>' + t.optin + '<small>' + esc(t.optinNote) + '</small></span>' +
          '</label>' +
          '<details class="pl-pass">' +
            '<summary>' + esc(t.passWay) + '</summary>' +
            '<div class="pl-row">' +
              '<input class="form-input" type="email" id="pl-in-mail" autocomplete="email" placeholder="' + esc(t.email) + '">' +
              '<input class="form-input" type="password" id="pl-in-pass" autocomplete="current-password" placeholder="' + esc(t.password) + '">' +
              '<button type="button" class="btn-orange justify-center" id="pl-in-btn">' + esc(t.signIn) + '</button>' +
            '</div>' +
          '</details>' +
        '</div>' +

        '<div id="pl-code-step" style="display:none">' +
          '<p class="pl-lead" id="pl-code-note"></p>' +
          '<div class="pl-row">' +
            '<input class="form-input pl-code" type="text" id="pl-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">' +
            '<button type="button" class="btn-orange justify-center" id="pl-verify">' + esc(t.verify) + '</button>' +
          '</div>' +
          '<button type="button" class="pl-link" id="pl-resend">' + esc(t.resend) + '</button>' +
          '<br><button type="button" class="pl-link" id="pl-back">' + esc(t.back) + '</button>' +
        '</div>' +

        '<div class="pl-msg" id="pl-msg"></div>' +
      '</div>';

    var $ = function (id) { return document.getElementById(id); };
    var msg = $('pl-msg');

    /* どの入口から入ったか。done() まで持ち回って、認証が通った経路を残す。
       ★Google とメール内リンクはページを離れ、戻ってきたページ側が直接送信するので
         done() を通らない＝pay_login_done が出ない。start だけあって done が無い分は
         そちらの経路。数える時に「消えた人」と混ぜないこと。 */
    var method = 'unknown';
    function start(m) { method = m; track('pay_login_start', { method: m }); }

    function fail(text) {
      msg.classList.remove('is-ok');
      msg.innerHTML = text;
      msg.style.display = 'block';
    }
    function good(text) {
      msg.classList.add('is-ok');
      msg.innerHTML = text;
      msg.style.display = 'block';
    }
    function clearMsg() { msg.style.display = 'none'; msg.classList.remove('is-ok'); }

    function busy(btn, label) {
      btn.disabled = true;
      btn.dataset.plLabel = btn.innerHTML;
      btn.textContent = label;
    }
    function free(btn) {
      btn.disabled = false;
      if (btn.dataset.plLabel !== undefined) btn.innerHTML = btn.dataset.plLabel;
    }

    /* ログインできた。ページ側に返して、そのまま送信させる。
       ★ヘッダーの表示のために pv_user を入れておく（login.html の afterLogin と同じ形）。
         ここを省くと、送信は通るのにヘッダーだけ未ログインのままになる。 */
    async function done(user) {
      try {
        var r = await sb.from('profiles').select('*').eq('id', user.id).single();
        var p = r && r.data;
        localStorage.setItem('pv_user', JSON.stringify(
          p ? Object.assign({}, p, { email: user.email })
            : { id: user.id, email: user.email, name: String(user.email || '').split('@')[0] }));
        localStorage.setItem('pv_last_active', String(Date.now()));
        localStorage.setItem('pv_session_start', String(Date.now()));
      } catch (e) { /* 表示のための保存なので、失敗しても送信は続ける */ }

      /* 預けた同意をここでも適用する。
         ★元は「明細が保存できたあと」だけで呼んでいたが、それだと**登録はしたが
           提出せず離脱した人**に同意が立たず、あとから一通も送れない。二重に呼んでも
           claimOptIn は OPTIN_KEY を同期で先に消すので1回しか効かず、解除済みの人にも触らない。
         ★await しない。同意の往復2回で送信の開始を遅らせない（失敗しても送信は続く）。 */
      try { window.PVPayLogin.claimOptIn(sb); } catch (e) {}

      track('pay_login_done', { method: method });
      good(esc(t.done));
      if (typeof o.onSignedIn === 'function') o.onSignedIn(user);
    }

    /* 「はじめての方」の側から進んだときだけ、チェックの状態を預ける。
       ログインの側からは呼ばない＝既に決めてある人の設定を書き換えない。 */
    function stashOptIn() {
      var el = $('pl-optin');
      try {
        localStorage.setItem(OPTIN_KEY, JSON.stringify({ on: !!(el && el.checked), at: Date.now() }));
      } catch (e) { /* 保存できない端末では同意は立たない。送信は止めない */ }
    }

    /* ── Google（ページを離れる。入力は端末に預けてあるので戻れば自動送信）──
       ★失敗したときに何も残らないのが一番まずかった。sendCode は理由を GA4 に残すのに
         ここだけ返り値を見ておらず、2026-09-01 に英語版から出した人が登録まで届かなかった
         とき、Google が断ったのか、そもそも呼べていなかったのかが分からなかった。 */
    async function google() {
      var res = await sb.auth.signInWithOAuth({
        provider: 'google', options: { redirectTo: callbackUrl() },
      });
      if (res && res.error) {
        // ★理由は決め打ちの短い語だけ。エラー本文をそのまま送らない
        track('pay_login_google_fail', { reason: res.error.status === 429 ? 'rate_limited' : 'oauth_failed' });
        return fail(esc(t.sendFail));
      }
    }
    /* ★入口が1つになったので、既存の会員もここを通る。同意を預けてよい理由は
       claimOptIn が「一度解除した人」に触らないから（下の「解除済みの人」の行）。 */
    $('pl-g-up').addEventListener('click', function () {
      start('google');
      stashOptIn();
      /* 投げっぱなしにすると、失敗が未処理の rejection になって画面には何も出ない。 */
      google().catch(function (e) {
        console.error(e);
        track('pay_login_google_fail', { reason: 'threw' });
        fail(esc(t.sendFail));
      });
    });

    // ── パスワードでログイン（ページ遷移なし）──
    async function passwordIn() {
      clearMsg();
      var mail = $('pl-in-mail').value.trim().toLowerCase();
      var pass = $('pl-in-pass').value;
      if (!EMAIL_RE.test(mail)) return fail(esc(t.badEmail));
      start('password');
      var btn = $('pl-in-btn');
      busy(btn, t.signingIn);
      var res = await sb.auth.signInWithPassword({ email: mail, password: pass });
      free(btn);
      if (res.error || !res.data || !res.data.user) return fail(esc(t.badPass));
      await done(res.data.user);
    }
    $('pl-in-btn').addEventListener('click', passwordIn);
    $('pl-in-pass').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); passwordIn(); }
    });

    /* ── 6桁コード ────────────────────────────────────────────
       登録側とログイン側の「コードで」は、どちらもここに来る。
       shouldCreateUser: true なので、初めての人はこの1回で会員になる。 */
    var otpMail = '';

    /* ★再送に60秒の間を置く。連打は 429 を呼び、しかも Supabase のメール上限は
         **時間あたり**なので、断られるのはその1回では済まない（次の数分ぶんも落ちる）。
       ★押せない理由を出す。無言で無効にすると人はもっと連打する。 */
    var RESEND_WAIT = 60;
    var resendTimer = null;
    function coolResend() {
      var btn = $('pl-resend');
      if (!btn) return;
      if (resendTimer) { clearInterval(resendTimer); resendTimer = null; }
      var left = RESEND_WAIT;
      btn.disabled = true;
      btn.textContent = t.resendWait(left);
      resendTimer = setInterval(function () {
        left -= 1;
        if (left > 0) { btn.textContent = t.resendWait(left); return; }
        clearInterval(resendTimer); resendTimer = null;
        btn.disabled = false;
        btn.textContent = t.resend;
      }, 1000);
    }

    async function sendCode(mail, btn, isResend) {
      clearMsg();
      if (!EMAIL_RE.test(mail)) {
        track('pay_login_code_fail', { reason: 'bad_email' });
        return fail(esc(t.badEmail));
      }
      busy(btn, t.sending);
      var res = await sb.auth.signInWithOtp({
        email: mail,
        options: { emailRedirectTo: callbackUrl(), shouldCreateUser: true },
      });
      free(btn);
      if (res.error) {
        // ★理由は決め打ちの短い語だけ。エラー本文をそのまま送らない
        track('pay_login_code_fail', { reason: res.error.status === 429 ? 'rate_limited' : 'send_failed' });
        return fail(esc(res.error.status === 429 ? t.tooFast : t.sendFail));
      }
      track('pay_login_code_sent', { resend: isResend ? 1 : 0 });
      otpMail = mail;
      $('pl-code-note').innerHTML = t.codeHead(esc(mail)) + '<br>' + esc(t.codeNote);
      $('pl-main').style.display = 'none';
      $('pl-code-step').style.display = '';
      if (isResend) good(esc(t.resent));
      coolResend();
      $('pl-code').focus();
    }

    $('pl-up-btn').addEventListener('click', function () {
      start('code');
      stashOptIn();
      sendCode($('pl-up-mail').value.trim().toLowerCase(), $('pl-up-btn'), false);
    });
    $('pl-up-mail').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('pl-up-btn').click(); }
    });
    $('pl-resend').addEventListener('click', function () { sendCode(otpMail, $('pl-resend'), true); });
    $('pl-back').addEventListener('click', function () {
      clearMsg();
      $('pl-code-step').style.display = 'none';
      $('pl-main').style.display = '';
    });

    async function verify() {
      clearMsg();
      var token = $('pl-code').value.trim();
      if (!/^\d{6}$/.test(token)) {
        track('pay_login_code_fail', { reason: 'bad_code_format' });
        return fail(esc(t.badCode));
      }
      var btn = $('pl-verify');
      busy(btn, t.verifying);
      var res = await sb.auth.verifyOtp({ email: otpMail, token: token, type: 'email' });
      free(btn);
      if (res.error || !res.data || !res.data.user) {
        track('pay_login_code_fail', { reason: 'wrong_code' });
        return fail(esc(t.wrongCode));
      }
      await done(res.data.user);
    }
    $('pl-verify').addEventListener('click', verify);
    /* 6桁そろったら押さずに確認する（コードを貼った人がボタンを探さない）。
       ★全角の数字を先に半角へ寄せる。\D は全角数字を「数字でない」として丸ごと落とすので、
         メールから全角のまま貼った人の欄が黙って空になる。 */
    $('pl-code').addEventListener('input', function () {
      var v = $('pl-code').value
        .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
        .replace(/\D/g, '').slice(0, 6);
      if (v !== $('pl-code').value) $('pl-code').value = v;
      if (v.length === 6) verify();
    });
    $('pl-code').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); verify(); }
    });
  };

  /* 預けた同意を1回だけ適用する。ページ側が「明細が保存できた」あとに呼ぶ。
     そこで呼ぶのは、どの入口（パスワード／6桁／メール内リンク／Google）を通っても
     必ず最後に通る所がそこ1箇所だからで、経路ごとに書くと必ず1本抜ける。

     ★列を直接書かず set_mail_optin を通す。親（メール全般）と同意日時まで
       サーバ側で揃うため（db/pay-reminder.sql:67）。
     ★一度同意して、そのあと解除した人には触らない。解除がその人の最後の意思で、
       レポートを見に来ただけの操作で送信を再開してはいけない。 */
  window.PVPayLogin.claimOptIn = async function (sb) {
    var raw = null;
    try { raw = localStorage.getItem(OPTIN_KEY); } catch (e) { return; }
    if (!raw) return;
    try { localStorage.removeItem(OPTIN_KEY); } catch (e) {}

    var v = null;
    try { v = JSON.parse(raw); } catch (e) { return; }
    if (!v || !v.on || !(Date.now() - Number(v.at || 0) < OPTIN_TTL)) return;

    try {
      var u = await sb.auth.getUser();
      var uid = u && u.data && u.data.user && u.data.user.id;
      if (!uid) return;
      var r = await sb.from('profiles').select('email_opt_in,email_opt_in_at').eq('id', uid).maybeSingle();
      var p = r && r.data;
      if (p && p.email_opt_in_at && !p.email_opt_in) return;   // 解除済みの人
      await sb.rpc('set_mail_optin', { p_on: true });
    } catch (e) { /* 同意が立たなくても明細の保存は済んでいる。画面を止めない */ }
  };
})();
