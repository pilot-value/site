/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — pv-claim-pending.js  v1.0
   匿名で出した給与データを、アカウントが出来た瞬間に本人のものへ移す。

   ── なぜ1本に切り出したか ──────────────────────────────────────
   2026-08-22、本番を調べたら **登録まで済ませたのにデータが消えた人が2人**いた
   （8/21 シンガポール航空2件・8/18 ANA と ZIPAIR）。

   原因はひとつ。ログイン用メールには「リンク」と「6桁コード」の両方が載っていて、
   **リンクを押すとメールアプリの中の別のブラウザが開く**。給与データの預かり証
   （pv_pay_claim）は提出したブラウザの localStorage にしか無いので、そこには何も無い。
   下書き（pv_pay_pending）も置き去りなので、フォームすら空で戻ってくる。

   直し方は3枚重ね。
     1. メールからリンクを消して6桁コードだけにする（Supabase のテンプレート＝別作業）
     2. 戻り先URLに預かり証を載せる（?claim=…）＝ 万一離れても持って行ける
     3. **マイページでも拾う** ＝ 同じブラウザでどこからログインしても必ず紐付く

   3 のために、pay-report.html の日英2枚に同じ物が書いてあった預かり証まわりを
   ここへ寄せた。profile.html からも同じ実体を呼ぶ。**2か所に増やさない。**

   ── 使い方 ────────────────────────────────────────────────────
     <script src="pv-claim-pending.js"></script>   （supabase-js の後）

     PVClaimPending.remember(token)        預かり証を端末に残す
     PVClaimPending.latest()               戻り先URLに載せる1枚（無ければ ''）
     PVClaimPending.sweep(sb)              ?claim= を拾って全部を紐付ける
                                           → 移せた最後の1件（無ければ null）

   ⚠️ ここは「移す」だけ。移したあと何を描くかはページ側の仕事
      （pay-report.html はレポート、profile.html は一覧の描き直し）。
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ★配列で持つ。1枚出して登録せずに離れ、後日もう1枚出す人がいる。
     1本で上書きすると先の1枚が永久に宙に浮く。
     ★サーバ側も30日で移さなくなるので、同じ期限でこちらも捨てる。 */
  var CLAIM_KEY = 'pv_pay_claim';
  var CLAIM_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

  // 預かり証は encode(gen_random_bytes(24),'hex') ＝ 16進48文字（db/pay-report-pending.sql:173）
  var TOKEN_RE = /^[0-9a-f]{48}$/i;

  /* 送るのは段の名前と短い理由だけ。メールアドレス・金額・社名・預かり証そのものは
     送らない（pay-report.html の track() と同じ方針）。 */
  function track(name, params) {
    try {
      if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
    } catch (e) { /* 計測で紐付けを止めない */ }
  }

  function read() {
    var a = null;
    try { a = JSON.parse(localStorage.getItem(CLAIM_KEY) || '[]'); } catch (e) {}
    if (!Array.isArray(a)) return [];
    return a.filter(function (x) {
      return x && typeof x.t === 'string' && Date.now() - Number(x.ts || 0) < CLAIM_MAX_AGE;
    });
  }

  function write(a) {
    try {
      if (a.length) localStorage.setItem(CLAIM_KEY, JSON.stringify(a.slice(-5)));
      else localStorage.removeItem(CLAIM_KEY);
    } catch (e) {}
  }

  function remember(tok) {
    if (!TOKEN_RE.test(String(tok || ''))) return '';
    var a = read().filter(function (x) { return x.t !== tok; });
    a.push({ t: tok, ts: Date.now() });
    write(a);
    return tok;
  }

  /* 「この預かり分は、登録の箱でもうクラッカーを鳴らした」印。
     ★端末に残す必要がある。Google はここでページを離れるので、変数に持つと
       戻ってきた時に消えていて、結果カードで二度目が鳴る。
     ★預かり証の行にそのまま足す。read() は t と ts しか見ないので素通りする。 */
  function markPopped(tok) {
    var a = read();
    for (var i = 0; i < a.length; i++) if (a[i].t === tok) { a[i].pop = 1; write(a); return; }
  }

  function has() { return read().length > 0; }

  // 戻り先URLに載せる1枚。いちばん新しいものを渡す。
  function latest() {
    var a = read();
    return a.length ? a[a.length - 1].t : '';
  }

  /* ── ?claim= を拾う ────────────────────────────────────────────
     メール内のリンク・Google の往復で**別のブラウザ**に着地した人は、端末に
     預かり証を持っていない。戻り先URLに載せた1枚がその人にとって唯一の綱になる。
     ★拾ったら URL から消す。残すと、あとで誰かに URL を見せたときにそのまま渡る。 */
  function takeFromUrl() {
    var tok = '';
    try {
      var q = new URLSearchParams(location.search);
      tok = String(q.get('claim') || '');
      if (!tok) return '';
      if (!TOKEN_RE.test(tok)) tok = '';
      q.delete('claim');
      var s = q.toString();
      history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash);
    } catch (e) { return ''; }
    return tok ? remember(tok) : '';
  }

  /* ── 預けたぶんを、いま入ったアカウントのものにする ────────────
     ★消すのは「サーバが答えを返した」ものだけ。通信で落ちた預かり証は残す
       （消すと、まだサーバに眠っている行を二度と取りに行けなくなる）。
     ★サーバが「無い・もう済んでいる」と答えたものは消す。残すと開くたびに同じ問い合わせを繰り返す。
     返り値＝移せた中の最後の1件（popped 付き）。そのままレポートを描ける。 */
  async function claim(sb) {
    var list = read();
    if (!list.length) return null;
    var keep = [];
    var won = null;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      try {
        var r = await sb.rpc('claim_pending_report', { p_token: it.t });
        if (r.error) throw r.error;
        var data = r.data;
        if (data && data.ok) {
          data.popped = !!it.pop;
          won = data;
          track('pay_report_claimed');
        } else {
          track('pay_report_claim_fail', { reason: String((data && data.reason) || 'not_found').slice(0, 40) });
        }
      } catch (e) {
        console.error(e);
        keep.push(it);
        track('pay_report_claim_fail', { reason: String((e && (e.code || e.name)) || 'error').slice(0, 40) });
      }
    }
    write(keep);
    return won;
  }

  // ?claim= を拾ってから全部を紐付ける。ページ側はこれ1回で済む。
  async function sweep(sb) {
    takeFromUrl();
    return claim(sb);
  }

  window.PVClaimPending = {
    CLAIM_KEY: CLAIM_KEY,
    CLAIM_MAX_AGE: CLAIM_MAX_AGE,
    read: read, write: write,
    remember: remember, markPopped: markPopped,
    has: has, latest: latest,
    takeFromUrl: takeFromUrl, claim: claim, sweep: sweep,
  };
})();
