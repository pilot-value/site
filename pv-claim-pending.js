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

     PVClaimPending.setOwner(fp)           この画面を見ている人を教える
                                           （匿名で置いたぶんはここで本人の印になる）
     PVClaimPending.remember(token)        預かり証を端末に残す（押印つき）
     PVClaimPending.latest()               戻り先URLに載せる1枚（無ければ ''）
     PVClaimPending.sweep(sb)              ?claim= を拾って全部を紐付ける
                                           → 移せた最後の1件（無ければ null）
     PVClaimPending.sweepDetail(sb)        同じことをして
                                           { won, already, gone, failed } を返す
                                           ★「通信で落ちた」を見分けたい側はこちら

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

  /* ── この預かり証は誰のものか（2026-09-11）──────────────────────
     預かり証には持ち主が書かれていなかった。共有端末で、A が匿名で出して
     帰ったあと、B がログインすると **A の給与レポートが B のものになる**。
     B の画面には身に覚えのない年収が出て、A の行は二度と本人へ渡らない。
     どちらの画面も壊れていないので、目でも検査でも気づけない。

     ★押印の実体は pv-session.js の PVPayLocal（下書き・前回の内容と同じ印）。
       ここで2つ目の指紋を作らない。
     ★匿名で出した人が、その場で登録して受け取る道は塞がない。
       引き継ぐ条件は「同じタブの続き」か「作ってから60分以内」。 */
  function local() {
    return (typeof window !== 'undefined' && window.PVPayLocal) || null;
  }
  function fpOf(uid) { var P = local(); return P ? P.fp(uid) : String(uid || ''); }
  function owns(own, me, ts) {
    var P = local();
    if (P) return P.owns(own, me, ts);
    return !own || own === 'anon' || own === me;
  }
  var _own = null;                    // 今この画面を見ている人の指紋（未確定は null）

  /* ★押印が「無い」ものは 2026-09-11 より前に置いた預かり証。歳で切らずに通す
       （切ると、匿名で出して数日後に登録した人の1件がその場で行方不明になる）。
       最長30日で自然に消える。 */
  function isMine(it, me) {
    if (!it || !('own' in it)) return true;
    return owns(it.own, me || 'anon', it.ts);
  }

  /* ログインの結果が分かった時点で呼ぶ。匿名のまま置いてある引き継げるぶんは、
     ここで本人の印を押す（以後その人だけのものになる）。 */
  function setOwner(me) {
    _own = me || 'anon';
    if (_own === 'anon') return _own;
    var a = read(), hit = false;
    for (var i = 0; i < a.length; i++) {
      if (a[i].own && a[i].own !== 'anon') continue;
      if (!isMine(a[i], _own)) continue;
      a[i].own = _own; hit = true;
    }
    if (hit) write(a);
    return _own;
  }

  async function resolveOwn(sb) {
    if (_own) return _own;
    try {
      var r = await sb.auth.getSession();
      var u = r && r.data && r.data.session && r.data.session.user;
      if (u && u.id) return setOwner(fpOf(u.id));
    } catch (e) {}
    return 'anon';
  }

  // 今の人が触ってよいぶんだけ。
  function mine() {
    var me = _own || 'anon';
    return read().filter(function (x) { return isMine(x, me); });
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

  /* 第2引数は「どの会社・どの月のぶんか」の印（社|その他社名|年|月）。省略できる。
     ★金額は入れない。二度押しを止めるのに要らないので、端末に置く情報量を増やさない。
     ★read() は t と ts しか見ないので k は素通りする（markPopped の pop と同じ手）。 */
  function remember(tok, key) {
    if (!TOKEN_RE.test(String(tok || ''))) return '';
    var a = read().filter(function (x) { return x.t !== tok; });
    /* ★押印して残す。未ログインなら 'anon'（引き継げる印）。
       ★同時にこのタブに印を付ける ── 登録に1時間かかった人が、同じタブで
         続けているかぎり自分のぶんを受け取れるようにするため。 */
    var P = local(); if (P) P.markTab();
    var row = { t: tok, ts: Date.now(), own: _own || 'anon' };
    if (key) row.k = String(key);
    a.push(row);
    write(a);
    return tok;
  }

  /* 同じ会社・同じ月を、この端末からもう預けてあるか。
     2026-09-01、英語版から出した人が12秒差で同じものを2回送り、置き場に2行できた。
     送信ボタンは成功後も有効なまま（そのすぐ上に登録の箱が出るので押せてしまう）。
     ★サーバ側にも同じ判定がある（db/pay-report-pending.sql）。こちらは無駄な往復を
       減らすためのもので、別タブ・別端末はサーバ側が受け持つ。 */
  var DUP_MAX_AGE = 24 * 60 * 60 * 1000;
  function findKey(key) {
    if (!key) return '';
    /* ★今の人のぶんだけ数える。ここを read() のままにすると、共有端末で
       前の人が同じ会社・同じ月を出していたとき、次の人の送信が
       「もう預かってある」と黙って握り潰される（その人の入力は消える）。 */
    var a = mine();
    for (var i = a.length - 1; i >= 0; i--) {
      if (a[i].k === String(key) && Date.now() - Number(a[i].ts || 0) < DUP_MAX_AGE) return a[i].t;
    }
    return '';
  }

  /* 「この預かり分は、登録の箱でもうクラッカーを鳴らした」印。
     ★端末に残す必要がある。Google はここでページを離れるので、変数に持つと
       戻ってきた時に消えていて、結果カードで二度目が鳴る。
     ★預かり証の行にそのまま足す。read() は t と ts しか見ないので素通りする。
     ⚠️ 2026-09-09 以降、これを呼ぶページは1枚も無い（預かりの時点で祝うのを
        やめ、祝いを会員登録の後の結果カード1か所に寄せたため）。
        消さずに残しているのは、それ以前に pop:1 を書き込まれた預かり証が
        まだ端末に最大30日ぶん残っていて、下の sweep がその印を読むから。
        新しく呼び出しを足さない。 */
  function markPopped(tok) {
    var a = read();
    for (var i = 0; i < a.length; i++) if (a[i].t === tok) { a[i].pop = 1; write(a); return; }
  }

  function has() { return mine().length > 0; }

  // 戻り先URLに載せる1枚。いちばん新しいものを渡す。
  function latest() {
    var a = mine();
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
     ★2026-09-11 から**3つを分けて返す**（claimDetail）。それまでは
       「預かりが無い」と「通信で落ちた」が同じ null で、給与フォームは後者を
       前者と読んで新規保存へ流れ、祝ってしまっていた。預かり行は未引き取りのまま
       残るので、同じ人が REAL PAY に2行・人数に2重に載る（最大24か月ぶん）。
         won     … 移せた1件（popped 付き）。そのままレポートを描ける
         already … サーバが「もう移してある」と答えた数（保存し直さない）
         gone    … サーバが「そんな預かりは無い／切れた」と答えた数
         failed  … 答えが返らなかった数。**預かり証は残る＝もう一度取りに行ける** */
  async function claimDetail(sb) {
    var out = { won: null, gone: 0, already: 0, failed: 0, total: 0, other: 0 };
    var all = read();
    if (!all.length) return out;
    /* ★誰として取りに行くのかを先に決める。ここを飛ばすと、共有端末で
       次に入った人が前の人の給与レポートを自分のものにしてしまう。 */
    var me = await resolveOwn(sb);
    var list = [], keep = [];
    for (var j = 0; j < all.length; j++) {
      if (isMine(all[j], me)) list.push(all[j]);
      else { keep.push(all[j]); out.other++; }   // 人のぶん。消さずに置いておく
    }
    out.total = list.length;
    if (!list.length) { write(keep); return out; }
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      try {
        var r = await sb.rpc('claim_pending_report', { p_token: it.t });
        if (r.error) throw r.error;
        var data = r.data;
        if (data && data.ok) {
          data.popped = !!it.pop;
          out.won = data;
          track('pay_report_claimed');
        } else {
          var why = String((data && data.reason) || 'not_found');
          if (why === 'already_claimed') out.already++; else out.gone++;
          track('pay_report_claim_fail', { reason: why.slice(0, 40) });
        }
      } catch (e) {
        console.error(e);
        keep.push(it);
        out.failed++;
        track('pay_report_claim_fail', { reason: String((e && (e.code || e.name)) || 'error').slice(0, 40) });
      }
    }
    write(keep);
    return out;
  }

  // 今までの呼び出し6か所はこちら。「移せた1件」だけが要る側。
  async function claim(sb) { return (await claimDetail(sb)).won; }

  // ?claim= を拾ってから全部を紐付ける。ページ側はこれ1回で済む。
  async function sweep(sb) {
    takeFromUrl();
    return claim(sb);
  }

  // 失敗を見分けたい側（給与フォーム）はこちら。
  async function sweepDetail(sb) {
    takeFromUrl();
    return claimDetail(sb);
  }

  window.PVClaimPending = {
    CLAIM_KEY: CLAIM_KEY,
    CLAIM_MAX_AGE: CLAIM_MAX_AGE,
    read: read, write: write,
    remember: remember, markPopped: markPopped,
    has: has, latest: latest, findKey: findKey,
    takeFromUrl: takeFromUrl, claim: claim, sweep: sweep,
    setOwner: setOwner, isMine: isMine, mine: mine,
    claimDetail: claimDetail, sweepDetail: sweepDetail,
  };
})();
