/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — pv-session.js  v1.0
   ログインを永久に持ち越さない。無操作7日 / 最長30日で自動的に切る。

   なぜ要るか
     supabase-js は既定で persistSession:true / autoRefreshToken:true。
     リフレッシュトークンが localStorage に残り、アクセストークンが切れる
     たびに自動更新されるので、一度入ったら実質無期限でログインしたままに
     なる。本サイトは給与明細・年収という機微データを扱う。共有端末や
     盗難端末に無期限で残るのは信用の問題なので、こちらから期限を切る。

   なぜ head で読むか
     ログイン状態の UI 判定は localStorage の pv_user を見ている
     （index.html / community.html / world-airlines.html のナビ更新、
       airlines/airline-reviews-ui.js の口コミゲート、
       airlines/premium-auth-lock.js の錠）。それらは body 内で走るので、
     失効判定はそれより前＝head で終わらせないと「消したのに名前が出る」
     一瞬が生まれる。inject-session.mjs が </head> の直前に差し込む。

   なぜ sb.auth.signOut() を呼ばないか
     2つ目の GoTrueClient を作ると多重インスタンス警告が出る
     （airlines/airline-base.js:20 に既出）。かつ head の時点では
     supabase-js がまだ読み込まれていない。
     サーバ側の失効は /auth/v1/logout を素の fetch で叩いて済ませる。

   ※これはクライアント側の防御。リフレッシュトークンを本当に短命にするには
     Supabase ダッシュボードの Authentication → Sessions で
     Inactivity timeout / Time-box user sessions も設定すること。
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var IDLE_MS  = 7  * 24 * 60 * 60 * 1000;  // 無操作でここまで空いたら切る
  var MAX_MS   = 30 * 24 * 60 * 60 * 1000;  // ログインからここまで経ったら切る
  var TICK_MS  = 60 * 1000;                 // 開きっぱなしのタブを見張る間隔
  var TOUCH_MS = 60 * 1000;                 // last_active を書き戻す最短間隔

  var K_LAST  = 'pv_last_active';
  var K_START = 'pv_session_start';

  // 解放の鍵。口コミ枠と年収枠は別物（口コミ→口コミ／明細→年収）。
  var K_REVIEW = 'pv_unlock_expiry';           // 口コミが読める期限（30日）
  var K_SALARY = 'pv_salary_unlock_expiry';    // 年収が読める期限（明細で90日）
  var K_GRAND  = 'pv_salary_grandfathered';    // 下の引き継ぎを済ませた目印

  // supabase-js v2 の保存キー。プロジェクト参照が入るのでパターンで拾う。
  var AUTH_RE = /^sb-.+-auth-token$/;
  var SB_RE   = /^sb-.+-(auth-token|code-verifier)/;

  // ログインが要るページ。タブを開いたまま期限が来たとき、ここだけは
  // 画面に留めずログインへ送る（公開ページは黙って消すだけでよい）。
  var GUARDED = /(?:^|\/)(profile|my-value|pay-report|submit-review|admin)\.html$/;

  var SB_URL = 'https://vzgmnkrggrwtsrpqndsm.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6Z21ua3JnZ3J3dHNycHFuZHNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzkwOTcsImV4cCI6MjA5MDAxNTA5N30.wE4cJbqeYGCgn5ZvHd80hYWgQuySKvOMJMbsJWOvmtw';

  function ls(fn, dflt) {
    try { return fn(); } catch (e) { return dflt; }   // プライベートモード等で localStorage が投げる
  }
  function keys() {
    return ls(function () { return Object.keys(localStorage); }, []);
  }
  function get(k) {
    return ls(function () { return localStorage.getItem(k); }, null);
  }
  function set(k, v) {
    ls(function () { localStorage.setItem(k, v); return 1; }, 0);
  }
  function del(k) {
    ls(function () { localStorage.removeItem(k); return 1; }, 0);
  }

  /* 保存済みセッションを読む。
     ★supabase-js は v2.4x 以降、値を "base64-<base64>" で入れる。
       素の JSON だけを見ていると全部空振りするので両方扱う。 */
  function readStoredSession() {
    var k = keys().filter(function (x) { return AUTH_RE.test(x); })[0];
    if (!k) return null;
    var raw = get(k);
    if (!raw) return null;
    try {
      if (raw.indexOf('base64-') === 0) {
        raw = decodeURIComponent(escape(atob(raw.slice(7))));   // UTF-8 を戻す
      }
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function isLoggedIn() {
    if (get('pv_user')) return true;
    return keys().some(function (x) { return AUTH_RE.test(x); });
  }

  /* セッションの開始時刻。
     ★保存セッションの user.last_sign_in_at を最優先する。
       pv_session_start を「今」で埋めてしまうと、この機能を入れる前から
       ログインしっぱなしの人全員に30日を新規付与することになる。
       実際のログイン時刻を使えば、そういう人は次のアクセスで正しく切れる。 */
  function sessionStart() {
    var s = readStoredSession();
    var t = s && s.user && s.user.last_sign_in_at ? Date.parse(s.user.last_sign_in_at) : NaN;
    if (!isNaN(t)) return t;

    var stored = parseInt(get(K_START) || '0', 10);
    if (stored) return stored;

    var now = Date.now();
    set(K_START, String(now));
    return now;
  }

  function lastActive() {
    var t = parseInt(get(K_LAST) || '0', 10);
    if (t) return t;
    var now = Date.now();
    set(K_LAST, String(now));
    return now;
  }

  /* サーバ側のリフレッシュトークンも失効させる。
     返事は待たない（消す方を止めない）。失敗しても localStorage は必ず消す。 */
  function revokeRemote(session) {
    if (!session || !session.access_token || typeof fetch !== 'function') return;
    try {
      fetch(SB_URL + '/auth/v1/logout', {
        method: 'POST',
        keepalive: true,
        headers: {
          apikey: SB_KEY,
          Authorization: 'Bearer ' + session.access_token,
          'Content-Type': 'application/json'
        }
      }).catch(function () {});
    } catch (e) {}
  }

  function wipe() {
    revokeRemote(readStoredSession());

    keys().filter(function (k) { return SB_RE.test(k); }).forEach(del);
    del('pv_user');
    del(K_REVIEW);
    del(K_SALARY);   // 年収の鍵も一緒に。共有端末に機微な解放を残さない
    del(K_LAST);
    del(K_START);

    // login.html が「安全のため自動的にログアウトしました」を出すための目印。
    try { sessionStorage.setItem('pv_expired', '1'); } catch (e) {}
  }

  /* ── 一度きりの引き継ぎ（2026-09 以降はこの関数ごと削除してよい）──────
     以前は口コミを1件出すと年収まで見えた。今は「口コミ→口コミ／明細→年収」に
     分けたが、すでに口コミを出して年収が見えている人を、こちらの都合で期限前に
     締め出さない。年収の鍵に「口コミの鍵と同じ期限」を書き写すだけ。
     ★新しく30日／90日を与えない。約束した元の期限日に普通に切れる。
     ★pv-session.js は年収ゲートを読む全ページで lp.js / premium-auth-lock.js /
       salary-leveling.js より先に読まれるので、ここで書けば間に合う。 */
  function grandfatherSalaryUnlock() {
    if (get(K_GRAND)) return;                          // 引き継ぎは1回だけ
    var exp = parseInt(get(K_REVIEW) || '0', 10);
    if (!exp || exp <= Date.now()) return;             // 口コミの鍵が無い／もう切れている
    var cur = parseInt(get(K_SALARY) || '0', 10);
    if (!(cur > Date.now())) set(K_SALARY, String(exp));  // 明細で開いている人の期限は縮めない
    set(K_GRAND, '1');
  }

  function prefix() {
    return /^\/en\//.test(location.pathname) ? '../' : '';
  }

  var booted = false;   // 初回の同期チェックが済んだか

  function check() {
    if (!isLoggedIn()) return false;

    var now  = Date.now();
    var idle = now - lastActive();
    var age  = now - sessionStart();
    if (idle <= IDLE_MS && age <= MAX_MS) return false;

    wipe();

    /* 初回チェック（head での同期実行）で切れた場合は、ページ側の
       getSession() ゲートがこの後リダイレクトしてくれるので何もしない。
       ここで飛ばすのは「タブを開いたまま期限が来た」場合だけ。 */
    if (booted && GUARDED.test(location.pathname)) {
      location.replace(prefix() + 'login.html?expired=1');
    }
    return true;
  }

  var lastTouch = 0;
  function touch() {
    if (!isLoggedIn()) return;
    var now = Date.now();
    if (now - lastTouch < TOUCH_MS) return;   // 書き込み過多を避ける
    lastTouch = now;
    set(K_LAST, String(now));
  }

  // ── 起動：まず同期で判定してから、以降の見張りを仕掛ける ──
  check();
  booted = true;
  grandfatherSalaryUnlock();   // ← check() の後。失効で消した鍵を書き戻さないため
  if (isLoggedIn()) { sessionStart(); touch(); }

  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, touch, { passive: true, capture: true });
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { check(); touch(); }
  });

  setInterval(check, TICK_MS);

  // 別タブでログアウト／失効したらこのタブも追随する。
  window.addEventListener('storage', function (e) {
    if (!e.key || e.key === K_LAST || e.key === 'pv_user' || AUTH_RE.test(e.key)) check();
  });

  window.PVSession = {
    check: check, touch: touch, wipe: wipe,
    readStoredSession: readStoredSession,
    isLoggedIn: isLoggedIn, sessionStart: sessionStart, lastActive: lastActive,
    IDLE_MS: IDLE_MS, MAX_MS: MAX_MS
  };
})();
