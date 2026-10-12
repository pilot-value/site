/* ═══════════════════════════════════════════════════════════════════
   pv-contrib.js ── 会社ページの上で開く「情報を追加」の面

   会社ページから離れずに、情報を1つ足せるようにする。
   見た目は pv-contrib.css（どの規則も .pvc で始まる）。

   ■ ページとの約束
     window.PVContrib = { open({ topic, q }), close(), isOpen() }
       topic ＝ ''／'list'（項目の一覧）・'work'（月の勤務）・質問のまとまり
               （'taxi' 'staff_travel' 'upgrade' 'roster' 'career' 'benefits'）
       q     ＝ そのまとまりの中で、最初に見せたい質問の id（無くてよい）
     data-pvc-open="<topic>"（＋ data-pvc-q="<質問の id>"）を持つ要素を押すと開く。
     住所に ?add=<topic>（＋ &aq=<質問の id>）が付いていたら、それを開いて住所から外す。
     会社は <body data-airline> と data-pvc-name（無ければ .hero-airline h1）から読む。
       ＝ もう一度会社を選ばせない。
     保存できたら document に 'pvc:saved'（detail = { topic, slug }）を流す。

   ■ 絶対に崩さないこと
     ・「空欄」は未回答＝ null で送る。「0」は 0 で送る。0 で埋めない・0 を消さない。
     ・「あなたの投稿 N件」は、本人についてサーバが返した行数だけ。
       質問の数を答えの数として出さない。サーバに何も置いていない人には件数を1つも出さない。
       上の質問を答え直して画面から消えた質問の、前の答えは数えない・出さない（chainSaved）。
     ・サーバやユーザーから来た文字は textContent でしか入れない
       （innerHTML・insertAdjacentHTML・document.write を使わない）。
     ・このファイルに金額を書かない。
     ・勤務や回答を保存しても、REAL PAY も口コミも開かない。開くとも言わない。
     ・開くと履歴を1段だけ積む（住所は同じ）。「戻る」で閉じる。
       開いたまま読み直した人を、1段取り残さない（boot の settle）。

   ■ 保存先（引数は p の1つだけ）
     ログインしている人
       月の勤務     → submit_work_month ／ 読むのは my_work_months
       質問への回答 → submit_airline_conditions ／ 読むのは my_airline_conditions
     ログインしていない人（2026-10-07 オーナー指定「未ログインでも回答・保存できる」）
       どちらも     → submit_contrib_anon ／ 読むのは my_contrib_anon
       サーバが作った「控えの鍵」をこの端末に置く（pv_contrib_key）。鍵を持つ端末だけが
       読めて直せる。**社名や住所からは引けない。** ブラウザに置くのは鍵だけで、回答は
       サーバに在る（＝「この端末に保存しました」と言わない）。
       ログインしたら claim_contrib で本人の投稿へ引き継ぐ（鍵はそこで捨てる）。
     質問と選択肢は pv-conditions.json をその場で読む（写しを持たない）。

   ■ 補足（どの質問にも任意で添えられる）
     この面から送る補足には share を付ける ＝ 資格のある会員に見せてよい、の印。
     だから**送るボタンの上に、誰に見えるかを必ず書いてある**。その1行を消すなら share も外す。
   ═══════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';
  if (w.PVContrib) return;

  var SELF = d.currentScript || d.querySelector('script[src*="pv-contrib.js"]');
  var ROOT = (function () {
    try {
      if (SELF && SELF.src) return new URL('.', SELF.src).href;
      return new URL(/\/airlines\/[^/]*$/.test(location.pathname) ? '../' : './', location.href).href;
    } catch (e) { return '../'; }
  })();

  var OUTBOX = 'pv_contrib_outbox';          // 送れなかった1件（この端末だけ）
  var DRAFT = 'pv_contrib_draft:';           // ログインをまたぐ下書き（このタブだけ）
  var KEY = 'pv_contrib_key';                // ログインせずに保存した回答の「控えの鍵」（この端末だけ）
  var HELD_DAYS = 90;                        // 預かりの期限。正本はサーバの pv_contrib_ttl()（写し）
  var QID = /^[a-z0-9_]{1,60}$/;             // 質問の名前の形（住所や属性から来た字を、そのまま信じない）
  /* 住所に ?add= を持って来た人は、このあと面が開く。開くまでの間も「入力の途中」として扱う
     （登録だけの会員に出す Give → Get の板が、開こうとしている面を覆わないように）。boot が読んだら下ろす。 */
  var COMING = (function () { try { return /[?&]add=/.test(location.search); } catch (e) { return false; } })();
  var NS = 'http://www.w3.org/2000/svg';
  var FIRST_YEAR = 2015;                     // これより前の月は受け付けない（サーバと同じ）
  var MINE_CAP = 24;                         // my_work_months が返す行の上限

  /* ── 小さな道具 ─────────────────────────────────────────── */
  function el(tag, cls, text, attrs) {
    var n = d.createElement(tag), k;
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    if (attrs) for (k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  /* 文を入れる。最後の3文字だけは、折り返しで離れない1つの塊にする
     （「…入れてくださ／い。」のように、1〜2文字だけが次の行へ残らない。text-wrap を知らないブラウザでも同じ）。
     字は足さない・並びも変えない ＝ n.textContent は渡した文と1文字も違わない。読み上げにも何も足さない。
     塊の手前で折ってよいかは、ブラウザの禁則がそのまま決める（塊は nowrap。inline-block にしない）。
     数えるのは文字（サロゲートの対を割らない）。3文字以下の文はそのまま入れる。 */
  function endKept(n, text) {
    var ch = Array.from(str(text));
    if (ch.length <= 3) { n.textContent = ch.join(''); return n; }
    n.appendChild(d.createTextNode(ch.slice(0, -3).join('')));
    n.appendChild(el('span', 'pvc-tail', ch.slice(-3).join('')));
    return n;
  }
  function str(v) { return v == null ? '' : String(v); }
  function trim(v) { return str(v).replace(/^\s+|\s+$/g, ''); }
  function enc(v) { return encodeURIComponent(v); }
  function same(a, b) { try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; } }

  var ICONS = {
    work: ['M4 8h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z', 'M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2', 'M3 13h18'],
    taxi: ['M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z', 'M12 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
    staff_travel: ['M21 3 3 10.5l6.5 2.5L12 20l9-17z', 'M9.5 13 21 3'],
    upgrade: ['M2.5 9.5 12 5l9.5 4.5L12 14 2.5 9.5z', 'M6.5 11.5V16c1.5 1.4 3.4 2 5.5 2s4-.6 5.5-2v-4.5'],
    stay: ['M3 18V6', 'M3 14h18v4', 'M21 14v-2a3 3 0 0 0-3-3h-7v5', 'M7 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z'],
    roster: ['M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
    career: ['M3 20h5v-5h5v-5h5V5h3'],
    benefits: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
    plus: ['M12 5v14', 'M5 12h14'],
    arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
    x: ['M6 6l12 12', 'M18 6 6 18'],
    back: ['M15 5l-7 7 7 7'],
    check: ['M5 12.5l4.5 4.5L19 7.5']
  };
  function icon(name, size) {
    var s = d.createElementNS(NS, 'svg'), a = {
      viewBox: '0 0 24 24', width: size || 20, height: size || 20, fill: 'none', stroke: 'currentColor',
      'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false'
    }, k;
    for (k in a) s.setAttribute(k, a[k]);
    (ICONS[name] || []).forEach(function (p) {
      var e = d.createElementNS(NS, 'path'); e.setAttribute('d', p); s.appendChild(e);
    });
    return s;
  }

  function sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { sessionStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function sdel(k) { try { sessionStorage.removeItem(k); } catch (e) { /* 無くても困らない */ } }
  function lget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function ldel(k) { try { localStorage.removeItem(k); } catch (e) { /* 無くても困らない */ } }

  function track(name, topic) {
    try { if (typeof w.gtag === 'function') w.gtag('event', name, { topic: topic, airline_code: slug() }); } catch (e) { /* 計測は落ちても黙る */ }
  }

  /* ── 会社とログイン ─────────────────────────────────────── */
  function slug() { return trim(d.body && d.body.getAttribute('data-airline')); }
  function coName() {
    var n = trim(d.body && d.body.getAttribute('data-pvc-name'));
    if (n) return n;
    var h = d.querySelector('.hero-airline h1');
    return trim(h && h.textContent) || slug();
  }
  function hasToken() {
    try {
      if (w.PVSession && typeof w.PVSession.hasToken === 'function') return !!w.PVSession.hasToken();
      for (var i = 0; i < localStorage.length; i++) if (/^sb-.+-auth-token(\.\d+)?$/.test(localStorage.key(i))) return true;
    } catch (e) { /* 読めなければ未ログインとして扱う */ }
    return false;
  }
  function uid() {
    try {
      var s = w.PVSession && w.PVSession.readStoredSession && w.PVSession.readStoredSession();
      return s && s.user && s.user.id ? String(s.user.id) : '';
    } catch (e) { return ''; }
  }
  /* ログインは保存されているのに、会員の id が読めない（ログインの控えが割れている・壊れている・id が入っていない）。
     この面には、いま誰が読んでいるのかが分からない ＝ 別の会員に替わっても気づけない。
     このあいだは、保存したものを誰のものとしても扱わない：読まない・数えない・入力に入れない・
     保存後のカードを出さない・預かりを引き継がない（面は「これまでの投稿を読み込めませんでした」の形になる）。
     打った内容は残り、そのまま送れる。ログインしていない人と、id が読める会員は、ここに入らない。 */
  function noWho() { return hasToken() && uid() === ''; }

  /* ── サーバ ─────────────────────────────────────────────── */
  function client() {
    try {
      if (w.PVCareer && typeof w.PVCareer.client === 'function') return Promise.resolve(w.PVCareer.client());
      if (w.PVReviewUI && typeof w.PVReviewUI.sb === 'function') {
        return Promise.resolve(w.PVReviewUI.sb()).then(function (sb) {
          if (!sb) throw new Error('no client');
          return sb;
        });
      }
    } catch (e) { return Promise.reject(e); }
    return Promise.reject(new Error('no client'));
  }
  /* 返すのは必ず { kind }。
       ok    … 返事が来た（data）
       said  … サーバが理由を日本語で言って断った（msg）
       login … ログインが要る／切れている
       off   … まだ用意されていない（関数が無い・呼ぶ権限が無い）
       fail  … 届かなかった・サーバが落ちた ＝ 送れていない */
  function sort(res) {
    var e = res && res.error, st = res && res.status;
    if (!e) return res && res.data && typeof res.data === 'object' ? { kind: 'ok', data: res.data } : { kind: 'fail' };
    var code = str(e.code), msg = str(e.message);
    if (code === 'PGRST202' || code === 'PGRST205' || code === '42883' || code === '42P01' || st === 404) return { kind: 'off' };
    if (st === 401 || code === 'PGRST301' || (code === '42501' && /ログイン/.test(msg))) return { kind: 'login' };
    if (code === '42501' || st === 403) return { kind: 'off' };
    if ((code === '22023' || code === '54000' || code === 'P0001' || code === '23503') && /[ぁ-んァ-ヶ一-龠]/.test(msg)) {
      return { kind: 'said', msg: msg, code: code };
    }
    return { kind: 'fail' };
  }
  function rpc(name, p, ms) {
    return new Promise(function (resolve) {
      var done = false;
      var t = setTimeout(function () { fin({ kind: 'fail' }); }, ms || 15000);
      function fin(r) { if (done) return; done = true; clearTimeout(t); resolve(r); }
      client().then(function (sb) {
        return Promise.resolve(sb.rpc(name, { p: p }));
      }).then(function (res) { fin(sort(res)); }, function () { fin({ kind: 'fail' }); });
    });
  }
  function getJson(file) {
    return fetch(ROOT + file, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('http');
      return r.json();
    });
  }
  var V = { vocab: null, conds: null, vp: null, cp: null };
  function vocab() {
    if (V.vocab) return Promise.resolve(V.vocab);
    if (V.vp) return V.vp;
    var p = getJson('pv-vocab.json').then(function (j) {
      if (!j || !Array.isArray(j.positions) || !Array.isArray(j.fleets)) throw new Error('shape');
      V.vocab = j; return j;
    });
    V.vp = p; p.then(null, function () { if (V.vp === p) V.vp = null; });
    return p;
  }
  function conds() {
    if (V.conds) return Promise.resolve(V.conds);
    if (V.cp) return V.cp;
    var p = getJson('pv-conditions.json').then(function (j) {
      if (!j || !Array.isArray(j.questions)) throw new Error('shape');
      V.conds = j; return j;
    });
    V.cp = p; p.then(null, function () { if (V.cp === p) V.cp = null; });
    return p;
  }

  /* ── 状態 ───────────────────────────────────────────────── */
  var S = {
    root: null, sheet: null, title: null, prev: null, main: null,
    open: false, view: '', from: null, viaList: false, pushed: false,
    skipPop: false, onSkip: null, queue: null, tok: 0, hideT: 0, taken: {},
    focusQ: '', focusT: '',
    ctx: ''                                 // どの街の詳細から開かれたか（暮らしのタブ）。面を開き直すたびに決め直す
  };
  /* 本人の投稿。k ＝ idle／loading／ok／anon／off／fail
     held ＝ いま見えているのは、ログインせずに預けた回答（控えの鍵で読んだもの）
     kept ＝ このページを開いてから、サーバが「保存した」と返した月と答えの写し（メモリの中だけ。読み直すと消える）。
            本人の一覧を読めていないあいだ（k が ok でないあいだ）だけ、rowFor / savedMap がここから出す。
            無いと、保存はできたのに「自分の回答を見る」が空の入力を開き、そこから送るといま保存した行を空で置き換える。
            ★件数には使わない（「あなたの投稿 N件」は、サーバから読めた一覧だけで数える）。
            ★持ち主の印（who）を付けて持つ。読む人が替わったら使わずに捨てる（下の keptNow / keep）。
     who  ＝ 一覧（work・cond）を読んだ人の印。控えの印と同じ式（keptWho）で作る。読む人が替わったら、
            前の人が保存したもの・前の人について読んだものを全部手放す（下の「読む人が替わったら」）。
     soft ＝ 読む人が替わったと気づいて、その場で面を作り直した直後。今の人の分を読み直しているあいだも入力は止めない。 */
  var M = { seq: 0, p: null, held: false, work: { k: 'idle', rows: [] }, cond: { k: 'idle', answers: [] }, kept: { who: null, held: false, rows: {}, ans: {} }, who: null, soft: false };
  /* by ＝ いま送っている分を、誰が送ったか（setBusy が書く。返事が来た時に、読む人が替わっていないかを見る） */
  var W = { ym: '', bufs: {}, own: false, notice: null, err: null, last: null, busy: false, by: '', els: {} };

  /* 質問のまとまり。k は ?add= と data-pvc-open にそのまま出る名前
     （英小文字と _ だけ。- を入れない ── 保存後の面を「<k>-saved」と呼んでいる）。 */
  var GROUPS = [
    { k: 'taxi', t: '通勤・タクシー' },
    { k: 'staff_travel', t: 'Staff Travel' },
    { k: 'upgrade', t: '機長昇格' },
    { k: 'roster', t: '勤務スケジュール' },
    { k: 'career', t: '訓練・キャリア' },
    { k: 'benefits', t: '休暇・手当' }
  ];
  var TOPIC_NAME = { work: '月の勤務' };
  GROUPS.forEach(function (g) { TOPIC_NAME[g.k] = g.t; });
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function isGroup(t) { return t !== 'work' && has(TOPIC_NAME, t); }
  function topicOf(v) { v = trim(v); return has(TOPIC_NAME, v) ? v : 'list'; }
  /* まとまりごとの入力の状態。vals＝選んだ答え／curs＝通貨／notes＝補足（どれも「触った質問だけ」） */
  var G = {};
  function newG() {
    return { vals: {}, dirty: {}, curs: {}, notes: {}, noteDirty: {}, noteOpen: {}, fold: false, own: false, notice: null, last: null, busy: false, by: '', els: {} };
  }
  function gs(topic) { return G[topic] || (G[topic] = newG()); }
  function groupDirty(t) { return Object.keys(t.dirty).length > 0 || Object.keys(t.noteDirty).length > 0 || Object.keys(t.curs).length > 0; }

  /* ── 控えの鍵 ───────────────────────────────────────────── */
  /* ログインせずに預けた回答を、この端末だけが読めて直せるようにする鍵。作るのはサーバ。
     how ＝ 2:この端末に残る／1:このタブを閉じるまで／0:このページを開いている間だけ */
  var K = { mem: '', how: 2 };
  function okKey(v) { return /^[0-9a-f]{48}$/.test(str(v)); }
  function devKey() {
    var v = lget(KEY);
    if (okKey(v)) { K.how = 2; return v; }
    v = sget(KEY);
    if (okKey(v)) { K.how = 1; return v; }
    if (okKey(K.mem)) { K.how = 0; return K.mem; }
    return '';
  }
  function setKey(v) {
    if (!okKey(v)) return;
    K.mem = v;
    if (lset(KEY, v) && lget(KEY) === v) { K.how = 2; return; }
    if (sset(KEY, v) && sget(KEY) === v) { K.how = 1; return; }
    K.how = 0;
  }
  function dropKey() { K.mem = ''; ldel(KEY); sdel(KEY); }

  /* ── 送る ───────────────────────────────────────────────── */
  /* ログインしていない人の分は、サーバの預かりへ。返ってきた新しい鍵は、その場でこの端末に置く。 */
  function anonSend(kind, data) {
    var p = { kind: kind, data: data }, k = devKey();
    if (k) p.key = k;
    return rpc('submit_contrib_anon', p).then(function (r) {
      if (r.kind === 'ok' && r.data.ok) {
        if (okKey(r.data.key)) setKey(r.data.key);
        r.held = true;
      }
      return r;
    });
  }
  var MEMBER_FN = { work: 'submit_work_month', cond: 'submit_airline_conditions' };
  function send(kind, data) {
    if (!hasToken()) return anonSend(kind, data);
    return rpc(MEMBER_FN[kind], data).then(function (r) {
      /* ログインが切れていた人は、ログインしていない人と同じ道へ（入れた内容を捨てさせない） */
      return r.kind === 'login' ? anonSend(kind, data) : r;
    });
  }
  /* 預かりの口がまだ無いサーバでは、今までどおりログインへ送る（入れた内容は下書きに残る） */
  function needLogin(r) { return r.kind === 'login' || (r.kind === 'off' && !hasToken()); }
  function saidNote(r, topic) {
    var o = { kind: 'said', title: '保存できませんでした', text: r.msg };
    if (!hasToken() && /ログイン/.test(r.msg)) {
      o.actions = [{ id: 'login', label: 'ログインして続ける', on: function () { toLogin(topic); } }];
    }
    return o;
  }

  /* ── ログインしたら、預けていた回答を本人の投稿へ引き継ぐ ── */
  /* 鍵を出せるのは、それを受け取った端末だけ。残りが無くなったらサーバが鍵を消すので、こちらも捨てる。
     取れなかった回は鍵を残す（次にページを開いたときにもう一度）。 */
  var C = { p: null, note: null };
  function claim() {
    var k = devKey();
    /* 会員の id が読めないあいだは始めない（鍵は残す ＝ id が読めるログインでページを開いた時に引き継ぐ） */
    if (!k || !hasToken() || noWho()) return Promise.resolve(null);
    if (C.p) return C.p;
    var who = keptWho(false);                // 引き継ぎを始めた人（会員の id）。知らせに付けて持つ
    var p = rpc('claim_contrib', { key: k }, 12000).then(function (r) {
      C.p = null;
      if (r.kind !== 'ok' || !r.data.ok) return null;
      var x = r.data, moved = +x.moved || 0, kept = +x.kept || 0, dropped = +x.dropped || 0, left = +x.left || 0, list = [];
      if (x.known === false || left === 0) dropKey();
      if (moved) list.push(moved + '件を、あなたの投稿として引き継ぎました。');
      if (kept) list.push(kept + '件は、ログインしてから保存した新しい投稿があったため、そちらを残しました。');
      if (dropped) list.push(dropped + '件は、いまの形式では受け取れず、引き継げませんでした。');
      if (left) list.push(left + '件は、まだ引き継げていません。次にこのページを開いたときに続きを引き継ぎます。');
      if (list.length) {
        C.note = { kind: 'claim', tone: 'calm', title: moved ? 'ログイン前の回答を引き継ぎました' : 'ログイン前の回答を確認しました', list: list, who: who };
      }
      if (moved) {
        try { d.dispatchEvent(new CustomEvent('pvc:saved', { detail: { topic: 'claim', slug: slug() } })); } catch (e) { /* 古いブラウザ */ }
      }
      return x;
    });
    C.p = p;
    return p;
  }
  function paintClaim() {
    if (!S.open || !S.main) return;
    var old = S.main.querySelector('[data-pvc-msg="claim"]');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    /* 知らせは、引き継ぎを始めた人のもの。いま読む人が別の人なら、出さずに捨てる
       （返事が届く前に読む人がもう一度替わった／面を閉じたまま引き継いだあとで、別の人が面を開いた）。
       確かめるのは、描くこの1か所だけ ── 返事が届いた所で確かめても、面を閉じたまま引き継いだ回は見えない。 */
    if (C.note && C.note.who !== keptWho(false)) C.note = null;
    if (!C.note || /-saved$/.test(S.view)) return;
    S.main.insertBefore(note(C.note), S.main.firstChild);
  }

  /* ── 下書きと、送れなかった1件 ──────────────────────────── */
  function draftOf(topic) {
    if (topic === 'work') return { ym: W.ym, bufs: W.bufs, own: W.own };
    var t = gs(topic);
    return { vals: t.vals, dirty: t.dirty, curs: t.curs, notes: t.notes, noteDirty: t.noteDirty, noteOpen: t.noteOpen, fold: t.fold, own: t.own };
  }
  function keepDraft(topic, why) {
    sset(DRAFT + slug() + ':' + topic, JSON.stringify({ v: 1, why: why, draft: draftOf(topic) }));
  }
  function dropDraft(topic) { sdel(DRAFT + slug() + ':' + topic); }
  function outbox() {
    var raw = lget(OUTBOX), j = null;
    if (!raw) return null;
    try { j = JSON.parse(raw); } catch (e) { return null; }
    if (!j || j.v !== 1 || j.slug !== slug() || !TOPIC_NAME[j.topic] || !j.draft) return null;
    /* ログインして書いた分は、その人にしか出さない。
       ログインせずに書いた分（uid が空）は、この端末のもの ＝ あとでログインしても続きを開ける。 */
    if (str(j.uid) && str(j.uid) !== uid()) return null;
    return j;
  }
  function keepOutbox(topic) {
    lset(OUTBOX, JSON.stringify({ v: 1, slug: slug(), topic: topic, uid: uid(), at: Date.now(), draft: draftOf(topic) }));
  }
  function dropOutbox(topic) {
    var o = outbox();
    if (o && (!topic || o.topic === topic)) ldel(OUTBOX);
  }
  /* 端末に残した1件が、この項目の、いま出ている入力そのものか（質問の項目）。
     比べるのは、答え・通貨・補足（下書きの vals / dirty / curs / notes / noteDirty）。開いた補足・畳み・確認のチェックは
     入力の中身ではないので見ない。鍵の順も見ない（同じ内容を、別の順に触っただけで「違う」と言わない）。 */
  function unsentIs(topic) {
    var o = outbox(), now = draftOf(topic);
    function flat(v) { v = obj(v); return JSON.stringify(Object.keys(v).sort().map(function (k) { return [k, v[k]]; })); }
    return !!o && o.topic === topic && ['vals', 'dirty', 'curs', 'notes', 'noteDirty'].every(function (k) { return flat(o.draft[k]) === flat(now[k]); });
  }
  /* 読み直し・ログインのあとに、入れていた内容を1回だけ戻す */
  function restore(topic) {
    if (S.taken[topic]) return;
    S.taken[topic] = 1;
    var o = outbox(), got = null, raw, j;
    if (o && o.topic === topic) got = { why: 'fail', draft: o.draft };
    if (!got) {
      raw = sget(DRAFT + slug() + ':' + topic);
      if (raw) { try { j = JSON.parse(raw); if (j && j.v === 1 && j.draft) got = { why: j.why || 'login', draft: j.draft }; } catch (e) { /* 壊れた下書きは捨てる */ } }
    }
    if (!got) return;
    /* 「ログインしました」と言うのは、戻ってきた最初の1回だけ（読み直すたびに言わない） */
    var fresh = got.why === 'login' && hasToken();
    if (fresh) sset(DRAFT + slug() + ':' + topic, JSON.stringify({ v: 1, why: 'kept', draft: got.draft }));
    var dr = got.draft, k;
    if (topic === 'work') {
      if (dr.bufs && typeof dr.bufs === 'object') {
        W.bufs = {};
        for (k in dr.bufs) if (/^\d{4}-\d{2}$/.test(k) && dr.bufs[k]) { W.bufs[k] = dr.bufs[k]; W.bufs[k].dirty = true; }
      }
      if (/^\d{4}-\d{2}$/.test(str(dr.ym))) W.ym = dr.ym;
      W.own = !!dr.own;
      W.notice = got.why === 'fail' ? failNote('work') : (fresh ? backNote() : null);
    } else {
      var t = gs(topic);
      t.vals = obj(dr.vals); t.dirty = obj(dr.dirty); t.curs = obj(dr.curs);
      t.notes = obj(dr.notes); t.noteDirty = obj(dr.noteDirty); t.noteOpen = obj(dr.noteOpen);
      /* 前の形の下書き（補足が「上限」の1つだけだった頃のもの）も、そのまま開けるようにしておく */
      if (typeof dr.note === 'string' && dr.noteDirty === true) {
        t.notes = { commuting_taxi_cap: dr.note }; t.noteDirty = { commuting_taxi_cap: true };
      }
      t.fold = !!dr.fold; t.own = !!dr.own;
      t.notice = got.why === 'fail' ? failNote(topic) : (fresh ? backNote() : null);
    }
  }
  function backNote() {
    return { kind: 'back', tone: 'calm', title: 'ログインしました', text: '入力した内容はそのまま残っています。確かめて送ってください。' };
  }
  function failNote(topic) {
    return {
      kind: 'fail', title: '送れていません',
      text: '通信の状態を確かめて、もう一度送ってください。入力した内容はこの端末に残しています。',
      actions: [
        { id: 'retry', label: 'もう一度送る', on: function () { if (topic === 'work') sendWork(); else sendGroup(topic); } },
        { id: 'drop', label: '破棄する', on: function () { discard(topic); } }
      ]
    };
  }
  function offNote() {
    return { kind: 'off', title: '準備中です', text: 'この項目はまだ保存できません。入力した内容は送られていません。' };
  }
  function discard(topic) {
    dropOutbox(topic); dropDraft(topic);
    if (topic === 'work') { W.bufs = {}; W.own = false; W.notice = null; W.err = null; }
    else G[topic] = newG();
    show(S.view === 'list' ? 'list' : topic);
  }

  /* ── 本人の投稿を読む ───────────────────────────────────── */
  /* ログインしている人 → 会員の読み口。ログインしていない人 → 控えの鍵で預かりを読む。
     鍵もログインも無い人には、サーバへ1本も投げない（置いていないものは読めない）。 */
  function goodRows(v) { return (Array.isArray(v) ? v : []).filter(function (x) { return x && typeof x === 'object'; }); }
  function goodAnswers(v, s) {
    return (Array.isArray(v) ? v : []).filter(function (x) { return x && x.question_id && (!x.airline || x.airline === s); });
  }
  function noMine(k) { M.held = false; M.work = { k: k, rows: [] }; M.cond = { k: k, answers: [] }; }
  /* 会員の id が読めない時の形：読みかけの返事は捨てる・一覧は2つとも「読めなかった」・印はいまの人のもの
     （id が読めるようになった時・ログアウトした時に、替わったと分かる）。 */
  function noWhoMine() { M.seq++; M.p = null; noMine('fail'); M.who = keptWho(false); }
  function readMember(seq, s) {
    var login = false;
    M.who = keptWho(false);                  // 読み始めた時の読む人（会員は id だけで決まる。控えの鍵は見ない）
    function bad(r) { if (r.kind === 'login') login = true; return r.kind === 'login' ? 'anon' : (r.kind === 'off' ? 'off' : 'fail'); }
    var a = rpc('my_work_months', { airline: s }, 9000).then(function (r) {
      if (seq !== M.seq) return;
      M.work = r.kind === 'ok' && Array.isArray(r.data.rows) ? { k: 'ok', rows: goodRows(r.data.rows) } : { k: bad(r), rows: [] };
    });
    var b = rpc('my_airline_conditions', { airline: s }, 9000).then(function (r) {
      if (seq !== M.seq) return;
      M.cond = r.kind === 'ok' && Array.isArray(r.data.answers) ? { k: 'ok', answers: goodAnswers(r.data.answers, s) } : { k: bad(r), answers: [] };
    });
    return Promise.all([a, b]).then(function () {
      if (seq === M.seq) M.held = false;
      return login;
    });
  }
  function readHeld(seq, s) {
    var key = devKey();
    M.who = keptWho(true);                   // 読み始めた時の読む人（預かりは、控えの鍵まで含めて決まる）
    if (!key) { if (seq === M.seq) noMine('anon'); return Promise.resolve(); }
    return rpc('my_contrib_anon', { key: key, airline: s }, 9000).then(function (r) {
      if (seq !== M.seq) return;
      if (r.kind === 'ok' && r.data.ok) {
        /* 期限が過ぎた・引き継ぎ済みの鍵は、持っていても何も引けないので捨てる */
        if (r.data.known === false) { dropKey(); noMine('anon'); return; }
        M.held = true;
        M.work = { k: 'ok', rows: goodRows(r.data.rows) };
        M.cond = { k: 'ok', answers: goodAnswers(r.data.answers, s) };
        return;
      }
      noMine(r.kind === 'off' ? 'off' : 'fail');
    });
  }
  function loadMine(force) {
    /* 読み始める前に確かめる。読む人が替わっていたら、前の人の分を先に手放す
       （手放さずに読むと、新しい印の下に、前の人の入力の写し・チェック・保存後のカードが残る）。 */
    if (!readerSame()) readerReset();
    M.soft = false;
    /* 会員の id が読めないあいだは、サーバへ1本も投げない（誰の分を読むのかが分からない）。引き継ぎも始めない。 */
    if (noWho()) { noWhoMine(); return Promise.resolve(); }
    var key = devKey(), logged = hasToken();
    if (!logged && !key) {
      M.seq++; M.p = null;
      noMine('anon');
      M.who = keptWho(false);                // 読むものが無い人にも印は付ける（このあとログインしたら、替わったと分かる）
      return Promise.resolve();
    }
    if (M.p && !force) return M.p;
    var seq = ++M.seq, s = slug(), was = { work: M.work, cond: M.cond, held: M.held };
    var who = keptWho(false);                // 誰の分を読み始めたか（会員は id。控えの鍵は見ない）。一覧が届いた所で、今の人と比べる
    if (M.work.k !== 'ok') M.work = { k: 'loading', rows: [] };
    if (M.cond.k !== 'ok') M.cond = { k: 'loading', answers: [] };
    var mine = (logged && key ? claim() : Promise.resolve(null)).then(function () {
      if (seq !== M.seq) return null;
      if (!hasToken()) return readHeld(seq, s);
      return readMember(seq, s).then(function (login) {
        return login && seq === M.seq ? readHeld(seq, s) : null;
      });
    });
    var p = Promise.all([mine, conds().then(null, function () { return null; })]).then(function () {
      if (seq !== M.seq) return;
      /* 読んでいるあいだに読む人が替わった ＝ 届いたのは前の人の一覧。出さずに手放して、今の人の分を読み直す。 */
      if (readerTurn()) return redraw();
      /* 読みに行く前の待ち（預けた回答の引き継ぎ／会員の入口に断られたあとの預かり）のあいだに、同じタブのまま読む人が替わった。
         印は、待ちのあとで読み始める時に今の人のものへ付け直されるので、上の確かめには掛からない。
         読み始めた時に控えた人（who）と比べる：違えば、前の人の分（入れてあった確認のチェック・打っていない欄の値）を手放して、
         今の人の分を読み直し、その場で描き直す。
         会員の id が読めなくなった時も、ここで止まる（読み直しは loadMine の頭で止まり、読めなかった時の形になる ＝ 届いた一覧は出さない）。 */
      if (who !== keptWho(false)) { readerReset(); loadMine(true); return redraw(); }
      /* その場で作り直した入力（M.soft）は、空の一覧から描いてある。
         届いた一覧も空（今の人はまだ何も出していない・読めなかった）なら、もう一度は描き直さない ── 知らせの字だけ直す。
         中身が在れば描き直すが、居た欄と位置は変えない。 */
      var soft = M.soft && S.open && (S.view === 'work' || isGroup(S.view)), st = soft ? (S.view === 'work' ? W : gs(S.view)) : null, back = null;
      M.soft = false;
      if (soft && !M.work.rows.length && !M.cond.answers.length) {
        paintClaim();
        if (st.els.sync) st.els.sync();
        return;
      }
      if (soft) back = place();
      var changed = !(was.work.k === 'ok' && was.cond.k === 'ok' && was.held === M.held && same(was.work, M.work) && same(was.cond, M.cond));
      onMine(changed, soft);
      if (back) back();
    });
    M.p = p;
    return p;
  }
  /* soft ＝ この一覧は、読む人が替わってその場で作り直した入力へ届いた（loadMine が、居た欄と位置を戻す） */
  function onMine(changed, soft) {
    if (!S.open) return;
    if (S.view === 'list') { paintCounts(); paintClaim(); return; }
    paintClaim();
    if (!changed) return;
    /* 打っている最中の面は作り直さない（作り直すと、入力している欄から焦点が外れる）。
       読み込みを待って止めてあった面だけは、必ず作り直して入力できるようにする。
       例外は、読む人が替わったあとで打ち始めた入力に、今の人が前に保存したものが届いた時だけ。
       その時は1回だけ、その場で描き直す（居た欄と位置は戻す。打った欄・打った答えには書かない）
       ── 描き直さないと、今の人の保存した値が見えないまま送ることになる。 */
    if (S.view === 'work') {
      var wb = W.bufs[W.ym], back;
      if (!W.els.loading && wb && wb.dirty) {
        /* 月の勤務：出している月の写しが、今の人のその月を知らないまま（bare）で、その月の行が届いた */
        if (wb.bare && rowFor(W.ym)) { back = place(); renderWork(); back(); return; }
        if (W.els.sync) W.els.sync();
        return;
      }
      Object.keys(W.bufs).forEach(function (k) { if (!W.bufs[k].dirty) delete W.bufs[k]; });
      renderWork();
    } else if (isGroup(S.view)) {
      var t = gs(S.view), sm;
      if (!t.els.loading && groupDirty(t)) {
        /* 質問の項目：読む人が替わったあとの入力で、今の人がこの項目の質問に保存した答えを持っている時だけ
           （答えが無ければ同じ入力のまま。読む人が替わっていない時の読み直しでも、今までどおり作り直さない） */
        if (!soft) return;
        sm = savedMap();
        if (!groupQs(S.view).some(function (q) { return hasValue(sm[q.id]); })) return;
      }
      renderGroup(S.view);
    }
  }
  /* 控え（M.kept）の持ち主の印 ＝ 保存したときのログイン（会員の id。ログインなしは空）と、預かりへ入れた回はその控えの鍵。
     読む人が替わったら、控えは使わずに捨てる ── ログインした／ログアウトした（切れた）／
     ログインして預かりを引き継いだ（鍵が消える）／控えの鍵が替わった。
     捨てないと、前の人がこのページで保存した月と答えが、次の人の入力欄に入って出る（そのまま送れば、その人の投稿になる）。 */
  function keptWho(held) { return (hasToken() ? 'm:' + uid() : 'a:') + '|' + (held ? devKey() : ''); }
  /* 捨てるときは、控えから起こしてまだ手を付けていない月の入力の写し（W.bufs）も一緒に捨てる。
     打ちかけの入力は、いま画面の前に居る人のものなので残す。 */
  function bufsDrop() { Object.keys(W.bufs).forEach(function (k) { if (!W.bufs[k].dirty) delete W.bufs[k]; }); }
  function keptDrop() {
    if (M.kept.who !== null) bufsDrop();
    M.kept = { who: null, held: false, rows: {}, ans: {} };
    return M.kept;
  }
  /* 読む側。持ち主がいま読む人と同じときだけ返す。 */
  function keptNow() { return M.kept.who === keptWho(M.kept.held) ? M.kept : keptDrop(); }
  /* 書く側。持ち主が同じなら足し、違えば前の控えを捨ててから置く。 */
  function keep(held) {
    /* 会員の id が読めないあいだは控えない（誰の控えかが分からない）。呼んだ側には、捨てる入れ物を渡す。 */
    if (noWho()) return { rows: {}, ans: {} };
    var c = keptNow(), who = keptWho(held);
    if (c.who !== who || c.held !== !!held) { c = keptDrop(); c.who = who; c.held = !!held; }
    return c;
  }

  /* ── 読む人が替わったら ─────────────────────────────────── */
  /* 面を開いたまま、読む人が替わることがある ── ほかのタブでログアウトした／ログインが切れた／同じブラウザで別の会員が入った。
     このページは読み直されないので、何もしなければ、前の人が保存した答えが、次の人の画面に出て・数えられて・送られる。
     一覧（M.work・M.cond）にも、控えと同じ持ち主の印を付ける（M.who。式は keptWho の1つだけ）。
       付ける時 … 読み始めた時（readMember / readHeld）。
       同じ人   … 会員は、会員の id が同じなら同じ（控えの鍵は見ない）。
                  ログインしていない人は、預かりを読んだ・預けたあとは、控えの鍵が同じなら同じ。
                  はじめて預けて鍵がいま付いた人は、同じ人（鍵の無かった時の印は、鍵を見ない）。
                  鍵が外から替わった（ほかのタブでログインして引き継いだ 等）は、替わった。
       まだ何も読んでいない（印が無い）あいだは、手放すものが無いので「同じ」。 */
  function readerSame() { return M.who === null || M.who === keptWho(false) || M.who === keptWho(true); }
  /* 手放すもの ＝ 前の人が保存した・前の人について読んだもの全部。
     残すもの   ＝ 打って、まだ送っていない入力（打ちかけの入力は、いま画面の前に居る人のものなので残す）。
       M … 一覧2つ・控え・印を空にする。読みかけの返事は seq で捨てる。
       W … 保存した月から起こして手を付けていない入力の写しは捨てる（bufsDrop）。手を付けた写しは、打った欄（by）だけ残す
           ── 打っていない欄に入っているのは、前の人が保存した値か、そこから引き継いだ職位・機種・拠点。
           確認のチェック・知らせ・欄の断り・保存後のカードの記録は消す。選んでいる月（ym）は残す。
       G … 触った質問の答え・通貨・補足（vals / dirty / curs / notes / noteDirty）と、開いた補足・畳み（noteOpen / fold）は残す。
           確認のチェック・知らせ・保存後のカードの記録は消す。
       C … 引き継ぎの知らせは消す。
       S … 面の開閉・履歴・どの面か・下書きを戻したかどうかは、読む人と関係が無いので触らない。
     送っている最中の印（busy・by）は触らない（返事が来た時に下ろす）。 */
  function readerReset() {
    M.seq++; M.p = null; M.who = null;
    noMine('idle');
    keptDrop();
    bufsDrop();
    Object.keys(W.bufs).forEach(function (k) {
      var b = W.bufs[k], by = b.by || {};
      Object.keys(b).forEach(function (f) { if (f !== 'dirty' && f !== 'by' && !by[f]) b[f] = ''; });
      b.bare = true;                         // 今の人の保存した月を知らないままの写し（分かった時に、打っていない欄へ入れる：mend）
    });
    W.own = false; W.notice = null; W.err = null; W.last = null;
    Object.keys(G).forEach(function (k) { G[k].own = false; G[k].notice = null; G[k].last = null; });
    C.note = null;
  }
  /* 読む人が替わっていたら、前の人の分を手放して（loadMine の頭）、今の人の分を読み直す。替わっていなければ何もしない。 */
  function readerTurn() {
    if (readerSame()) return false;
    loadMine(true);
    return true;
  }
  /* 保存の返事が来た時に呼ぶ。送ったあとで読む人が替わっていたら、印を「送った人」に戻す
     ＝ すぐあとの show が気づいて、前の人が保存した内容をカードに出さずに、一覧へ戻す
     （ほかのタブでの切り替えに先に気づいて、今の人の一覧をもう読み始めていた回に要る）。
     同じ人のままなら、印には触らない（はじめて預けて控えの鍵がいま付いた人も、同じ人）。 */
  function savedBy(st) { if (st.by !== keptWho(false)) M.who = st.by; }
  /* いま居る欄と、面の中の位置を覚える。描き直したあとに呼ぶと、同じ欄・同じ位置へ戻す。 */
  function place() {
    var a = d.activeElement, y = S.main.scrollTop, nm = '', val = '';
    if (a && S.main.contains(a)) { nm = str(a.getAttribute('name')); val = a.type === 'checkbox' ? str(a.value) : ''; }
    function find(attr, want) {
      var hit = null;
      Array.prototype.forEach.call(S.main.querySelectorAll('[' + attr + ']'), function (x) {
        if (!hit && x.getAttribute(attr) === want && (attr !== 'name' || !val || x.value === val)) hit = x;
      });
      return hit;
    }
    return function () {
      S.main.scrollTop = y;
      var n = nm ? find('name', nm) : null, more;
      if (!n || d.activeElement === n) return;
      /* 補足の欄は、前の人の補足が入っていたから開いていた。空になって畳まれた欄へ入ろうとしていた人には、開けて渡す。 */
      more = n.closest('[hidden]') && /_note$/.test(nm) ? find('data-q-more', nm.slice(0, -5)) : null;
      if (more) { more.click(); S.main.scrollTop = y; return; }
      try { n.focus({ preventScroll: true }); } catch (e) { /* 古いブラウザ */ }
    };
  }
  /* 開いている面を、その場で描き直す（面の中の位置と、いま居る欄はそのまま）。読む人が替わったと気づいた時に使う。
     今の人がもう欄に入っているので、読み直しを待つあいだも入力は止めない（M.soft）。
     保存後のカードは show へ ── 記録が消えていれば、一覧になる。 */
  function redraw() {
    if (!S.open || !S.view) return;
    if (/-saved$/.test(S.view)) { show(S.view); return; }
    var back = place();
    M.soft = true;
    if (S.view === 'list') renderList();
    else if (S.view === 'work') renderWork();
    else renderGroup(S.view);
    paintClaim();
    back();
  }
  function onReader() { if (S.open && readerTurn()) redraw(); }
  /* 一覧を読めていないあいだは、このページでいま保存できた分だけを控え（M.kept）から出す。
     読めた一覧が在るときは、必ずそちらが正（控えは見ない）。 */
  function rowFor(ym) {
    if (M.work.k !== 'ok') { var c = keptNow(); return has(c.rows, ym) ? c.rows[ym] : null; }
    var p = ym.split('-'), y = +p[0], m = +p[1], i, r;
    for (i = 0; i < M.work.rows.length; i++) { r = M.work.rows[i]; if (+r.year === y && +r.month === m) return r; }
    return null;
  }
  function savedMap() {
    var o = {}, c;
    if (M.cond.k === 'ok') M.cond.answers.forEach(function (a) { o[a.question_id] = a; });
    else { c = keptNow(); Object.keys(c.ans).forEach(function (id) { o[id] = c.ans[id]; }); }
    return o;
  }

  /* ── 面の骨組み ─────────────────────────────────────────── */
  function build() {
    if (S.root) return;
    var root = el('div', 'pvc-root'); root.hidden = true;
    var scrim = el('div', 'pvc-scrim', null, { 'data-pvc-close': '' });
    scrim.addEventListener('click', function () { close(); });
    var sheet = el('section', 'pvc-sheet', null, { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pvc-title', tabindex: '-1' });
    var head = el('header', 'pvc-head');
    var prev = el('button', 'pvc-prev', null, { type: 'button', 'aria-label': '項目の一覧へ戻る' });
    prev.hidden = true; prev.appendChild(icon('back', 22));
    prev.addEventListener('click', function () { show('list'); });
    var title = el('h2', 'pvc-title', '', { id: 'pvc-title', tabindex: '-1' });
    var x = el('button', 'pvc-close', null, { type: 'button', 'aria-label': '閉じる' });
    x.appendChild(icon('x', 22));
    x.addEventListener('click', function () { close(); });
    head.appendChild(prev); head.appendChild(title); head.appendChild(x);
    var main = el('div', 'pvc-main');
    sheet.appendChild(head); sheet.appendChild(main);
    root.appendChild(scrim); root.appendChild(sheet);
    d.body.appendChild(root);
    S.root = root; S.sheet = sheet; S.title = title; S.prev = prev; S.main = main;
  }
  function setHead(text) {
    S.title.textContent = text;
    S.prev.hidden = !(S.view !== 'list' && S.viaList);
  }
  function mark(topic) {
    if (!S.pushed) return;
    try { history.replaceState({ pvc: 1, t: topic }, '', location.href); } catch (e) { /* 履歴に触れなくても面は動く */ }
  }
  function show(view) {
    /* 読む人が替わっていたら、前の人の分を手放してから描く。 */
    readerTurn();
    /* 会員の id が読めないあいだは、保存後のカードを出さない（「あなたの投稿」と言えない）。
       記録を捨てて、同じ項目の入力へ戻し、「保存しました」とだけ知らせる。 */
    var lost = /-saved$/.test(view) && noWho() ? (view === 'work-saved' ? W : gs(view.slice(0, -6))) : null;
    if (lost && lost.last) { lost.last = null; lost.notice = { kind: 'saved', tone: 'calm', title: savedTitle(null) }; view = view.slice(0, -6); }
    /* 保存後のカードは、その記録が在るあいだだけ（読む人が替わると記録ごと消える ＝ 一覧へ）。 */
    if (/-saved$/.test(view) && !(view === 'work-saved' ? W.last : gs(view.slice(0, -6)).last)) view = 'list';
    if (view !== 'list' && S.view === 'list') S.viaList = true;
    S.view = view;
    S.main.scrollTop = 0;
    /* 「この質問から」と開いた入口は、その面を出しているあいだだけ覚えておく */
    if (S.focusT !== view) { S.focusQ = ''; S.focusT = ''; }
    var saved = /-saved$/.test(view), topic = saved ? view.slice(0, -6) : view;
    if (view === 'list') renderList();
    else if (view === 'work') renderWork();
    else if (view === 'work-saved') renderWorkSaved();
    else if (saved) renderGroupSaved(topic);
    else renderGroup(view);
    mark(topic);
    paintClaim();
    /* 保存できたあとは、面の題ではなく「情報を追加しました」の見出しへ移す
       （読み上げが結果を先に読み、Tab ですぐ下の2つのボタンに届く）。 */
    var hd = saved ? S.main.querySelector('.pvc-saved-h') : null;
    try { (hd || S.title).focus({ preventScroll: true }); } catch (e) { /* 古いブラウザ */ }
  }
  function note(o) {
    var b = el('div', 'pvc-msg' + (o.tone === 'calm' ? ' is-calm' : ''), null, {
      role: o.tone === 'calm' ? 'status' : 'alert', 'data-pvc-msg': o.kind || ''
    });
    if (o.title) b.appendChild(el('p', 'pvc-msg-t', o.title));
    if (o.text) b.appendChild(el('p', 'pvc-msg-d', o.text));
    if (o.list && o.list.length) {
      var ul = el('ul', 'pvc-msg-l');
      o.list.forEach(function (t) { ul.appendChild(el('li', '', t)); });
      b.appendChild(ul);
    }
    if (o.actions && o.actions.length) {
      var a = el('div', 'pvc-msg-a');
      o.actions.forEach(function (x) {
        var bt = el('button', 'pvc-ghost', x.label, { type: 'button', 'data-pvc-act': x.id || '' });
        bt.addEventListener('click', x.on);
        a.appendChild(bt);
      });
      b.appendChild(a);
    }
    return b;
  }
  /* ログインから戻った回と、送れなかった回答を開き直した回は、知らせと送るボタンが長いフォームのいちばん下
     ＝画面の外になる（スマホでは必ず）。描き終わったら、その知らせを見えている高さのまんなかへ送る。
     動かすのは面の中だけ（ページは動かさない）。ほかの知らせは、出した側が自分で見える所へ送っている。
     会員の id が読めないあいだの「保存しました」（saved）も同じ ── 保存後のカードの代わりに、入力を頭から描き直して出す。 */
  function revealNotice(box, o) {
    var n = o && (o.kind === 'back' || o.kind === 'fail' || o.kind === 'saved') && box ? box.firstChild : null;
    if (!n || !S.main || !n.getBoundingClientRect) return;
    var m = S.main.getBoundingClientRect(), r = n.getBoundingClientRect();
    if (!m.height || !r.height) return;
    S.main.scrollTop += (r.top + r.height / 2) - (m.top + m.height / 2);
  }
  function waiting(text) {
    clear(S.main);
    S.main.appendChild(el('p', 'pvc-wait', text, { role: 'status' }));
  }
  function loadFailed(again) {
    clear(S.main);
    S.main.appendChild(note({
      kind: 'load', title: '読み込めませんでした',
      text: '選択肢を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      actions: [{ id: 'reload', label: 'もう一度読み込む', on: again }]
    }));
  }
  function select(name, opts, val) {
    var wrap = el('span', 'pvc-selw');
    var s = el('select', 'pvc-select', null, { name: name, id: 'pvc-f-' + name });
    opts.forEach(function (o) { var op = el('option', '', o[1]); op.value = o[0]; s.appendChild(op); });
    s.value = str(val);
    if (s.selectedIndex < 0) s.selectedIndex = 0;
    wrap.appendChild(s);
    return { wrap: wrap, sel: s };
  }
  function ownRow(st, label, onSend) {
    var act = el('div', 'pvc-act');
    var own = el('label', 'pvc-own');
    var cb = el('input', '', null, { type: 'checkbox', name: 'own' });
    cb.checked = !!st.own;
    own.appendChild(cb);
    own.appendChild(el('span', 'pvc-own-f', '本人が直接経験した内容です'));
    var send = el('button', 'pvc-send', label, { type: 'submit' });
    cb.addEventListener('change', function () {
      /* 読む人が替わっていたら、前の人のチェックは消える。いま入れたチェックは今の人のもの ＝ 手放したあとで置く。 */
      var on = cb.checked, turned = readerTurn();
      st.own = on;
      if (turned) redraw(); else onSend();
    });
    act.appendChild(own); act.appendChild(send);
    return { act: act, cb: cb, send: send };
  }

  /* ── 項目の一覧 ─────────────────────────────────────────── */
  var TILES = [
    { k: 'work', t: '勤務', q: '最近の勤務で、良かったこと・変わったことは？', view: 'work' },
    { k: 'taxi', t: '通勤・タクシー', q: 'いつ、どこまで、誰の負担で使えますか？', view: 'taxi' },
    { k: 'staff_travel', t: 'Staff Travel', q: '本人・家族の範囲、回数、自己負担は？', view: 'staff_travel' },
    { k: 'upgrade', t: '機長昇格', q: '昇格までの年数と、選考・訓練の条件は？', view: 'upgrade' },
    { k: 'roster', t: '勤務スケジュール', q: '休みの希望、スタンバイ、スケジュールの出る時期は？', view: 'roster' },
    { k: 'career', t: '訓練・キャリア', q: '訓練費の返還、経験者採用、自社養成の条件は？', view: 'career' },
    { k: 'benefits', t: '休暇・手当', q: '年休、病欠、着陸・地上勤務の手当は？', view: 'benefits' },
    { k: 'stay', t: 'ホテル・ステイ', q: 'パイロット限定', tab: 'stay', href: 'career.html?airline={s}&tab=life' }
  ];
  /* このページが「ステイ先」のタブを持っているか（持っていれば、ほかの画面へ送り出さない） */
  function ownTab(tab) {
    return !!(tab && w.PVGlance && typeof w.PVGlance.go === 'function' && d.getElementById('pvg-' + tab));
  }
  /* ログインせずに預けた回答があるときに出す1枚。ここからログインすると、開いたときに引き継がれる。 */
  function heldBox(title, lines) {
    var b = el('div', 'pvc-held', null, { 'data-pvc-held': '' });
    b.appendChild(el('p', 'pvc-held-t', title));
    lines.forEach(function (t) { b.appendChild(el('p', 'pvc-held-d', t)); });
    /* 控えがこのページを開いている間しか残らない端末では、ログインへ移った時点で鍵が消える。
       引き継げないものを「引き継ぐ」と書いたボタンで渡さない。 */
    if (K.how >= 1) {
      var bt = el('button', 'pvc-ghost', 'ログインして引き継ぐ', { type: 'button', 'data-pvc-act': 'claim' });
      bt.addEventListener('click', function () { toLogin('list', true); });
      b.appendChild(bt);
    }
    return b;
  }
  function renderList() {
    var name = coName(), s = slug();
    clear(S.main);
    setHead(name + 'に情報を追加');
    var ob = outbox();
    if (ob) {
      S.main.appendChild(note({
        kind: 'unsent', title: '送れていない回答があります',
        text: TOPIC_NAME[ob.topic] + 'の回答が、この端末に残っています。',
        actions: [
          { id: 'resume', label: '続きを開く', on: function () { show(ob.topic); } },
          { id: 'drop', label: '破棄する', on: function () { discard(ob.topic); } }
        ]
      }));
    }
    var card = el('section', 'pvc-intro');
    var top = el('div', 'pvc-intro-top'), tx = el('div', 'pvc-intro-tx');
    tx.appendChild(el('p', 'pvc-cap', 'BUILD IT TOGETHER'));
    /* 見出しは2つの塊に分けておく（長い社名で折れるとき、「…ひとつ教え／て。」のように語の途中で切らない） */
    var lead = el('h3', 'pvc-lead');
    lead.appendChild(el('span', 'pvc-lead-p', name + 'のこと、'));
    lead.appendChild(el('span', 'pvc-lead-p', 'ひとつ教えて。'));
    tx.appendChild(lead);
    top.appendChild(tx);
    var talk = el('a', 'pvc-talk', '匿名で話す', { href: ROOT + 'submit-review.html?airline=' + enc(s) });
    talk.appendChild(icon('arrow', 16));
    top.appendChild(talk);
    card.appendChild(top);

    var ul = el('ul', 'pvc-tiles');
    TILES.forEach(function (t) {
      var li = el('li'), n;
      if (t.view) {
        n = el('button', 'pvc-tile', null, { type: 'button', 'data-pvc-tile': t.k });
        n.addEventListener('click', function () { show(t.view); });
      } else if (ownTab(t.tab)) {
        /* 同じページのタブへ。面を閉じて切り替える ＝「戻る」は開く前のタブへ戻る。
           別のタブで開く押し方は、ブラウザに任せる（#stay がそのまま開く）。 */
        n = el('a', 'pvc-tile', null, { href: '#' + t.tab, 'data-pvc-tile': t.k });
        n.addEventListener('click', function (e) {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
          e.preventDefault();
          leaveTo(t.tab);
        });
      } else {
        n = el('a', 'pvc-tile', null, { href: ROOT + t.href.replace('{s}', function () { return enc(s); }), 'data-pvc-tile': t.k });
      }
      var ic = el('span', 'pvc-tile-ic'); ic.appendChild(icon(t.k, 20));
      var body = el('span', 'pvc-tile-tx');
      body.appendChild(el('span', 'pvc-tile-t', t.t));
      body.appendChild(el('span', 'pvc-tile-d', t.q));
      var mine = el('span', 'pvc-mine', '', { 'data-pvc-count': t.k }); mine.hidden = true;
      body.appendChild(mine);
      var go = el('span', 'pvc-tile-go'); go.appendChild(icon(t.view ? 'plus' : 'arrow', 16));
      n.appendChild(ic); n.appendChild(body); n.appendChild(go);
      li.appendChild(n); ul.appendChild(li);
    });
    card.appendChild(ul);
    var st = el('p', 'pvc-state', '', { 'data-pvc-state': '' }); st.hidden = true;
    card.appendChild(st);
    S.main.appendChild(card);
    var held = el('div', '', null, { 'data-pvc-heldslot': '' }); held.hidden = true;
    S.main.appendChild(held);
    S.main.appendChild(el('p', 'pvc-under', 'ひとつの項目から追加できます。ログインは要りません。'));
    paintCounts();
  }
  /* 件数は、サーバが返した本人の行だけから作る。取れていないものは数にしない。 */
  function counts() {
    var c = {};
    if (M.work.k === 'ok') c.work = M.work.rows.length;
    if (M.cond.k === 'ok' && V.conds) {
      GROUPS.forEach(function (g) { c[g.k] = 0; });
      var sm = savedMap();
      M.cond.answers.forEach(function (a) {
        var q = qById(a.question_id);
        if (q && hasValue(a) && chainSaved(q, sm)) c[groupOfQ(q)]++;
      });
    }
    return c;
  }
  function paintCounts() {
    if (S.view !== 'list') return;
    var c = counts(), total = 0, st = S.main.querySelector('[data-pvc-state]');
    Array.prototype.forEach.call(S.main.querySelectorAll('[data-pvc-count]'), function (n) {
      var k = n.getAttribute('data-pvc-count'), v = c[k];
      if (typeof v === 'number' && v > 0) {
        total += v;
        n.textContent = 'あなたの投稿 ' + (k === 'work' && v >= MINE_CAP ? MINE_CAP + '件以上' : v + '件');
        n.hidden = false;
      } else { n.textContent = ''; n.hidden = true; }
    });
    if (!st) return;
    var ks = [M.work.k, M.cond.k], text = '';
    if (ks.indexOf('anon') >= 0 && ks[0] === ks[1]) text = '';
    else if (ks.indexOf('loading') >= 0 || ks.indexOf('idle') >= 0) text = 'あなたの投稿を確認しています…';
    else if (ks.indexOf('fail') >= 0 || (M.cond.k === 'ok' && !V.conds)) text = 'あなたの投稿の件数を取得できませんでした。';
    else if (ks.indexOf('off') >= 0) text = 'あなたの投稿の件数は準備中です。';
    else if (ks[0] === 'ok' && ks[1] === 'ok' && total === 0) text = 'あなたの投稿はまだありません。';
    st.textContent = text;
    st.hidden = !text;
    st.setAttribute('data-pvc-state', ks.join(' '));
    var slot = S.main.querySelector('[data-pvc-heldslot]');
    if (!slot) return;
    clear(slot);
    slot.hidden = !(M.held && total > 0);
    if (!slot.hidden) {
      slot.appendChild(heldBox('ログインなしで保存した回答があります。', [
        howText(),
        'ログインすると、あなたの投稿として引き継がれ、会社ごとの集計に入ります。ログインしないままの回答は' + HELD_DAYS + '日で消えます。'
      ]));
    }
  }
  /* 控えがどこまで残るか。残らないものを「この端末から直せる」と言わない。 */
  function howText() {
    devKey();
    if (K.how >= 2) return 'この端末から確認・修正できます。';
    return 'このブラウザは控えを残せない設定のため、確認・修正できるのは' + (K.how === 1 ? 'このタブ' : 'このページ') + 'を開いている間だけです。';
  }

  /* ── 月の勤務 ───────────────────────────────────────────── */
  /* srv ＝ サーバが断るときに文の頭に置く呼び名（どの欄の話かを当てるのに使う） */
  var NUMS = [
    { k: 'block_hours', label: '乗務時間は何時間でしたか？', short: '乗務時間', unit: '時間', ph: '例：75.5', mode: 'decimal', srv: '乗務時間' },
    { k: 'duty_hours', label: '勤務・拘束時間は何時間でしたか？', short: '勤務・拘束時間', unit: '時間', ph: '例：140', mode: 'decimal', srv: '拘束時間' },
    { k: 'work_days', label: '勤務した日は何日でしたか？', short: '勤務した日', unit: '日', ph: '例：18', mode: 'numeric', srv: '勤務日数' },
    { k: 'duty_days', label: '乗務した日は何日でしたか？', short: '乗務した日', unit: '日', ph: '例：14', mode: 'numeric', srv: '乗務日数' },
    { k: 'days_off', label: '公休日は何日でしたか？', short: '公休日', unit: '日', ph: '例：10', mode: 'numeric', srv: '公休日数' },
    { k: 'stay_nights', label: 'ステイは何泊でしたか？', short: 'ステイ', unit: '泊', ph: '例：8', mode: 'numeric', srv: 'ステイ泊数' }
  ];
  var BASIS = [['', '回答しない'], ['report_to_release', '出頭から解放まで'], ['incl_standby', 'スタンバイも含めて'], ['roster', '勤務表の表示どおり'], ['unknown', '分からない']];
  var COMMUTE = [['', '回答しない'], ['yes', '含めている'], ['no', '含めていない'], ['unknown', '分からない']];
  var NOTE_MAX = 500;
  var NONE = '未回答';

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function ymText(ym) { var p = ym.split('-'); return (+p[0]) + '年' + (+p[1]) + '月'; }
  function lastYm() {
    var n = new Date(), y = n.getFullYear(), m = n.getMonth();          // m ＝ 先月（1始まりに直すと今月−1）
    if (m === 0) { y -= 1; m = 12; }
    return y + '-' + pad2(m);
  }
  function monthOpts(must) {
    var n = new Date(), y = n.getFullYear(), m = n.getMonth() + 1, out = [], has = false, v;
    while (y > FIRST_YEAR || (y === FIRST_YEAR && m >= 1)) {
      v = y + '-' + pad2(m);
      if (v === must) has = true;
      out.push([v, ymText(v)]);
      m -= 1; if (m === 0) { m = 12; y -= 1; }
    }
    if (must && !has) out.unshift([must, ymText(must)]);
    return out;
  }
  function tailless(s) { return str(s).replace(/[（(][^）)]*[）)]\s*$/, ''); }
  function posLabel(code) {
    var i, p = V.vocab ? V.vocab.positions : [];
    for (i = 0; i < p.length; i++) if (p[i].code === code) return tailless(p[i].ja);
    return '';
  }
  function fleetLabel(code) {
    var i, f = V.vocab ? V.vocab.fleets : [];
    for (i = 0; i < f.length; i++) if (f[i].code === code) return str(f[i].ja);
    return '';
  }
  function pick(list, code) {
    for (var i = 0; i < list.length; i++) if (list[i][0] === code) return list[i][1];
    return '';
  }
  /* 空欄＝未回答（null）。数字はそのまま数字（0 は 0）。
     数字に読めないものは、打たれた字のまま送ってサーバに断らせる（こちらで直さない）。 */
  function numOut(v) {
    var t = trim(v).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/．/g, '.');
    if (t === '') return null;
    if (/^\d{1,6}(\.\d{1,4})?$/.test(t)) return Number(t);
    return t;
  }
  /* 保存した月の行を、入力の写しの欄へ写す（行 → 欄の対応は、この1か所だけ）。
     typed に名前の在る欄には書かない（打った欄を残す。新しい写しを作る時は渡さない ＝ 全部の欄に書く）。 */
  function rowInto(b, row, typed) {
    function put(f, v) { if (!typed || !typed[f]) b[f] = v; }
    put('position', str(row.position)); put('fleet', str(row.fleet)); put('base_iata', str(row.base_iata));
    NUMS.forEach(function (n) { put(n.k, row[n.k] == null ? '' : String(row[n.k])); });
    put('duty_hours_basis', str(row.duty_hours_basis)); put('commute_included', str(row.commute_included)); put('note', str(row.note));
  }
  function workBuf(ym) {
    var b = W.bufs[ym];
    if (b) return b;
    var row = rowFor(ym), last = M.work.k === 'ok' && M.work.rows.length ? M.work.rows[0] : null;
    var cur = W.bufs[W.ym] && W.ym !== ym ? W.bufs[W.ym] : null;
    b = { dirty: false };
    if (row) {
      rowInto(b, row, null);
    } else {
      b.position = cur ? cur.position : (last ? str(last.position) : '');
      b.fleet = cur ? cur.fleet : (last ? str(last.fleet) : '');
      b.base_iata = cur ? str(cur.base_iata) : (last ? str(last.base_iata) : '');
      NUMS.forEach(function (n) { b[n.k] = ''; });
      b.duty_hours_basis = ''; b.commute_included = ''; b.note = '';
      /* 読む人が替わって、今の人の分を読み直しているあいだ（M.soft）に作った写しは、今の人の保存した月をまだ知らない */
      if (M.soft) b.bare = true;
    }
    W.bufs[ym] = b;
    return b;
  }
  /* 今の人の保存した月を知らないまま出来た写し（bare）に、その月の行が分かった時点で、打っていない欄へ保存した値を入れる。
     打った欄（by）には書かない。入れないままだと、打った欄だけの写しが「あなたの投稿／匿名で更新する」の下に出て、
     送ると、保存してあったその月の職位・機種・時間・メモが空で置き換わる（月は1か月が1行。保存は全部の欄を入れ替える）。
     行がまだ分からなければ、何もしない（印は残る）。入るのは、いま読む人の行だけ（rowFor）。 */
  function mend(ym) {
    var row = W.bufs[ym] && W.bufs[ym].bare ? rowFor(ym) : null, b = W.bufs[ym];
    if (!row || !b) return;
    rowInto(b, row, b.by || {});
    delete b.bare;
  }
  function workPayload() {
    var b = workBuf(W.ym), p = W.ym.split('-');
    var o = { airline: slug(), year: +p[0], month: +p[1], position: b.position || null, fleet: b.fleet || null, base_iata: b.base_iata || null };
    NUMS.forEach(function (n) { o[n.k] = numOut(b[n.k]); });
    o.duty_hours_basis = b.duty_hours_basis || null;
    o.commute_included = b.commute_included || null;
    o.note = trim(b.note) || null;
    o.lang = 'ja';
    return o;
  }

  function renderWork() {
    setHead(TOPIC_NAME.work);
    if (!V.vocab) {
      waiting('読み込んでいます…');
      vocab().then(function () { if (S.open && S.view === 'work') renderWork(); },
        function () { if (S.open && S.view === 'work') loadFailed(renderWork); });
      return;
    }
    restore('work');
    if (!W.ym) W.ym = lastYm();
    var logged = hasToken();
    /* 読み込み中かどうかは、ログインでは決めない（ログインしていない人も、控えの鍵で自分の分を読む） */
    var loading = (M.work.k === 'loading' || M.work.k === 'idle') && !M.soft;
    mend(W.ym);                              // 今の人の保存した月が分かっていれば、打っていない欄に入れてから描く
    /* 先に rowFor（読む人が替わっていたら、ここで控えと手を付けていない写しが捨てられる）→ それから入力の写し */
    var row = rowFor(W.ym), b = workBuf(W.ym), E = W.els = {};
    clear(S.main);

    var f = el('form', 'pvc-form', null, { novalidate: '', autocomplete: 'off', 'data-pvc-form': 'work' });
    f.addEventListener('submit', function (e) { e.preventDefault(); sendWork(); });
    /* 欄に入った時にも確かめる（下の sync）。読む人が替わっていたら、打ち始める前に入力を作り直す。
       確認のチェックと送るボタンは除く ── 押している最中に作り直すと、その1回の押下が消える
       （どちらも、押したあとに自分で確かめる：チェックは sync・送るボタンは sendWork）。 */
    f.addEventListener('focusin', function (e) { if (e.target !== E.cb && e.target !== E.send) sync(); });

    /* いま何について答えているか（会社は選び直させない） */
    var ctx = el('div', 'pvc-ctx');
    E.line = el('p', 'pvc-ctx-line');
    ctx.appendChild(E.line);
    var cr = el('div', 'pvc-ctx-row');
    cr.appendChild(el('label', 'pvc-ctx-k', '対象月', { 'for': 'pvc-f-ym' }));
    var ym = select('ym', monthOpts(W.ym), W.ym);
    ym.sel.addEventListener('change', function () {
      var next = ym.sel.value;
      workBuf(next);                       // いまの月の職位・機種を引き継いでから移る
      W.ym = next; W.notice = null; W.err = null;
      renderWork();
      var s2 = S.main.querySelector('select[name="ym"]');
      if (s2) s2.focus();
    });
    cr.appendChild(ym.wrap);
    var tag = el('span', 'pvc-mine', 'あなたの投稿', { 'data-pvc-own-row': '' }); tag.hidden = !row;
    cr.appendChild(tag);
    E.loading = loading;
    ctx.appendChild(cr);
    f.appendChild(ctx);

    var set = el('fieldset', 'pvc-set');
    set.disabled = loading;
    var g = el('div', 'pvc-grid');
    /* k ＝ 打った欄。読む人が替わった時に、打った欄だけを残すために控える（readerReset） */
    function touch(k) { b.dirty = true; (b.by = b.by || {})[k] = 1; }
    function line() {
      var parts = [coName()], pl = posLabel(b.position);
      if (pl) parts.push(pl);
      parts.push(ymText(W.ym));
      E.line.textContent = parts.join(' · ');
    }
    function errBox(fd, key) {
      var p = el('p', 'pvc-err', '', { id: 'pvc-e-' + key, role: 'alert' }); p.hidden = true;
      fd.appendChild(p);
      return p;
    }
    E.ctl = {}; E.err = {};

    /* 機種と職位（語彙は pv-vocab.json から。ここに一覧を持たない） */
    var fo = [['', '回答しない']];
    V.vocab.fleets.forEach(function (x) { if (!x.retired || x.code === b.fleet) fo.push([x.code, str(x.ja)]); });
    var fd = el('div', 'pvc-field');
    fd.appendChild(el('label', 'pvc-label', 'その月に乗務した機種は？', { 'for': 'pvc-f-fleet' }));
    var fl = select('fleet', fo, b.fleet);
    fl.sel.addEventListener('change', function () { b.fleet = fl.sel.value; touch('fleet'); });
    fd.appendChild(fl.wrap); g.appendChild(fd);

    var po = [['', '選択してください']];
    V.vocab.positions.forEach(function (x) { if (!x.retired || x.code === b.position) po.push([x.code, tailless(x.ja)]); });
    var pd = el('div', 'pvc-field');
    pd.appendChild(el('label', 'pvc-label', 'その月の職位は？', { 'for': 'pvc-f-position' }));
    var ps = select('position', po, b.position);
    ps.sel.addEventListener('change', function () { b.position = ps.sel.value; touch('position'); line(); clearErr('position'); });
    pd.appendChild(ps.wrap); E.ctl.position = ps.sel; E.err.position = errBox(pd, 'position'); g.appendChild(pd);

    NUMS.forEach(function (n) {
      var d1 = el('div', 'pvc-field');
      d1.appendChild(el('label', 'pvc-label', n.label, { 'for': 'pvc-f-' + n.k }));
      var i = el('input', 'pvc-input', null, {
        type: 'text', name: n.k, id: 'pvc-f-' + n.k, inputmode: n.mode, autocomplete: 'off',
        placeholder: row && row[n.k] == null ? NONE : n.ph, maxlength: '12'
      });
      i.value = str(b[n.k]);
      i.addEventListener('input', function () { b[n.k] = i.value; touch(n.k); clearErr(n.k); });
      d1.appendChild(i); E.ctl[n.k] = i; E.err[n.k] = errBox(d1, n.k); g.appendChild(d1);
    });

    var bd = el('div', 'pvc-field pvc-wide');
    bd.appendChild(el('label', 'pvc-label', '勤務・拘束時間をどう数えましたか？（任意）', { 'for': 'pvc-f-duty_hours_basis' }));
    var bs = select('duty_hours_basis', BASIS, b.duty_hours_basis);
    bs.sel.addEventListener('change', function () { b.duty_hours_basis = bs.sel.value; touch('duty_hours_basis'); });
    bd.appendChild(bs.wrap); g.appendChild(bd);

    var cd = el('div', 'pvc-field pvc-wide');
    cd.appendChild(el('label', 'pvc-label', '通勤時間は含めていますか？（任意）', { 'for': 'pvc-f-commute_included' }));
    var cs = select('commute_included', COMMUTE, b.commute_included);
    cs.sel.addEventListener('change', function () { b.commute_included = cs.sel.value; touch('commute_included'); });
    cd.appendChild(cs.wrap); g.appendChild(cd);

    var nd = el('div', 'pvc-field pvc-wide');
    nd.appendChild(el('label', 'pvc-label', 'ほかに伝えたいこと（任意）', { 'for': 'pvc-f-note' }));
    /* ここに書いた文は、給与を提出した会員の画面に出る（サーバの pv_contrib_notes）。黙って出さない。 */
    nd.appendChild(el('p', 'pvc-tip', '書いた場合は、給与を提出した会員に表示されます（名前は出ません）。'));
    var ta = el('textarea', 'pvc-area', null, {
      name: 'note', id: 'pvc-f-note', rows: '3', maxlength: String(NOTE_MAX),
      placeholder: '具体的な条件以外に、伝えたいことがあれば'
    });
    ta.value = str(b.note);
    ta.addEventListener('input', function () { b.note = ta.value; touch('note'); clearErr('note'); });
    nd.appendChild(ta); E.ctl.note = ta; E.err.note = errBox(nd, 'note'); g.appendChild(nd);

    set.appendChild(g);
    f.appendChild(set);

    E.msg = el('div'); f.appendChild(E.msg);
    var o = ownRow(W, row ? '匿名で更新する' : '匿名で追加する', sync);
    E.send = o.send; E.cb = o.cb;
    f.appendChild(o.act);
    E.wait = el('p', 'pvc-wait', '', { 'data-pvc-wait': '' });
    f.appendChild(E.wait);
    S.main.appendChild(f);

    function sync() {
      /* 読む人が替わっていたら（一覧が読めている・いないに関わらず）、前の人の分を手放して、その場で作り直す */
      if (readerTurn()) return redraw();
      var mine = rowFor(W.ym);
      /* rowFor は、読む人が替わったと気づくと、控えと、控えから起こして手を付けていない入力の写しを捨てる（keptDrop）。
         捨てられたのがいま出している月の写しなら、入力ごと作り直す ── 前の人が保存した値を画面に残さない。
         残すと、このあと打った字は捨てた写しへ入って送られず、職位が出ている画面で「職位を選んでください」と
         止まる（選び直しても進めない）。面の位置と、いま居る欄はそのまま。打ちかけの入力は今までどおり残る。 */
      if (W.bufs[W.ym] !== b) {
        if (!S.open || S.view !== 'work' || W.els !== E) return;   // もう別の面を出している（古い面からの呼び出し）
        var at = d.activeElement, nm = at && f.contains(at) ? at.getAttribute('name') : '', y = S.main.scrollTop;
        renderWork();
        S.main.scrollTop = y;
        at = nm ? S.main.querySelector('[name="' + nm + '"]') : null;
        if (at) { try { at.focus({ preventScroll: true }); } catch (e) { /* 古いブラウザ */ } }
        return;
      }
      tag.hidden = !mine;
      E.send.disabled = !W.own || W.busy || loading;
      E.send.textContent = W.busy ? '送っています…' : (mine ? '匿名で更新する' : '匿名で追加する');
      var t = '';
      if (loading) t = 'これまでの投稿を確認しています…';
      else if (M.work.k === 'fail') t = 'これまでの投稿を読み込めませんでした。このまま送れます（同じ月の投稿があれば、今回の内容に置き換わります）。';
      else if (!logged) t = anonHint();
      E.wait.textContent = t; E.wait.hidden = !t;
    }
    E.sync = sync;
    line(); sync(); paintWorkNotice();
    revealNotice(E.msg, W.notice);
  }
  function clearErr(key) {
    if (!W.err || W.err.key !== key) return;
    W.err = null; paintWorkNotice();
  }
  function paintWorkNotice() {
    var E = W.els, k;
    if (!E.msg) return;
    clear(E.msg);
    if (W.notice) E.msg.appendChild(note(W.notice));
    for (k in E.ctl) {
      E.ctl[k].removeAttribute('aria-invalid'); E.ctl[k].removeAttribute('aria-describedby');
      if (E.err[k]) { E.err[k].textContent = ''; E.err[k].hidden = true; }
    }
    if (W.err && E.ctl[W.err.key]) {
      E.ctl[W.err.key].setAttribute('aria-invalid', 'true');
      E.ctl[W.err.key].setAttribute('aria-describedby', 'pvc-e-' + W.err.key);
      E.err[W.err.key].textContent = W.err.text; E.err[W.err.key].hidden = false;
    }
  }
  function workSay(o, errKey, errText) {
    W.notice = o; W.err = errKey ? { key: errKey, text: errText || o.text } : null;
    paintWorkNotice();
    var E = W.els, n = errKey && E.ctl[errKey] ? E.ctl[errKey] : (E.msg && E.msg.firstChild);
    if (n && n.scrollIntoView) { try { n.scrollIntoView({ block: 'center' }); } catch (e) { n.scrollIntoView(); } }
    if (errKey && E.ctl[errKey]) { try { E.ctl[errKey].focus({ preventScroll: true }); } catch (e) { /* 古いブラウザ */ } }
  }
  /* サーバの断り文から、どの欄の話かを当てる（当たらなければ欄には印を付けない） */
  function fieldOf(msg) {
    var i;
    for (i = 0; i < NUMS.length; i++) if (msg.indexOf(NUMS[i].srv) === 0) return NUMS[i].k;
    if (msg.indexOf('職位') === 0) return 'position';
    if (msg.indexOf('ひとこと') === 0) return 'note';
    return '';
  }
  function setBusy(st, on) { st.busy = on; if (on) st.by = keptWho(false); if (st.els && st.els.sync) st.els.sync(); }
  function sendWork() {
    if (W.busy || S.view !== 'work') return;
    /* 読む人が替わっていたら、前の人の分を手放して入力を作り直し、この1回の押下では何も送らない（下の turned）。 */
    var turned = readerTurn();
    if (turned) redraw();
    /* 送る前にも確かめる。読む人が替わっていたら、ここで入力が作り直される
       ＝ 前の人が保存した値を、手を付けないまま今の人の投稿として送らない。 */
    if (W.els.sync) W.els.sync();
    var pl = workPayload();
    if (!pl.position) return workSay({ kind: 'said', title: '保存できませんでした', text: '職位を選んでください。' }, 'position');
    if (!NUMS.some(function (n) { return pl[n.k] !== null; })) {
      return workSay({ kind: 'said', title: '保存できませんでした', text: '勤務の項目を1つ以上入れてください（分かるものだけで大丈夫です）。' }, NUMS[0].k);
    }
    /* 残った入力（打ちかけの分）だけで送れる形でも、ここでは送らない ── 今の人は、まだ確認のチェックを入れていない。 */
    if (turned) return;
    W.notice = null; W.err = null; paintWorkNotice();
    setBusy(W, true);
    send('work', pl).then(function (r) {
      setBusy(W, false);
      if (r.kind === 'ok' && r.data.ok) return workSaved(pl, r.data, !!r.held);
      if (needLogin(r)) return toLogin('work');
      if (r.kind === 'said') return workSay(saidNote(r, 'work'), fieldOf(r.msg));
      if (r.kind === 'off') return workSay(offNote());
      keepOutbox('work');
      workSay(failNote('work'));
    });
  }
  function workSaved(pl, data, held) {
    savedBy(W);
    var ym = W.ym, row = {
      year: pl.year, month: pl.month, position: pl.position, fleet: pl.fleet, base_iata: pl.base_iata,
      duty_hours_basis: pl.duty_hours_basis, commute_included: pl.commute_included, note: pl.note
    };
    NUMS.forEach(function (n) { row[n.k] = pl[n.k]; });
    /* サーバが「保存した」と返した1行を、手元の一覧にも入れる（このあと取り直して確かめる）。
       はじめて預けた人は、まだ一覧を1度も読めていない（読む鍵がいま届いた）ので、ここで作る。 */
    if ((M.work.k === 'ok' || held) && !noWho()) {
      var rows = (M.work.k === 'ok' ? M.work.rows : []).filter(function (r) { return !(+r.year === row.year && +r.month === row.month); });
      rows.push(row);
      rows.sort(function (a, b2) { return (b2.year - a.year) || (b2.month - a.month); });
      M.work = { k: 'ok', rows: rows };
      if (held) M.held = true;
    }
    /* 一覧を読めなかった人・このあとの取り直しに失敗した人にも、いま保存した月を見せられるように控える */
    keep(held).rows[ym] = row;
    /* 増えたのか・置き換えたのかは、サーバの答え（replaced）だけで決める。返ってこなければ「分からない」のまま。
       送れなかった回の送り直し（端末に残した1件が、この月のもの）も「分からない」── 前の送信がサーバに届いていたかを、
       こちらは知らない（届いていれば、はじめての月でも「置き換えた」と返ってくる）。残した1件は、下の行で消す。 */
    var ob = outbox(), again = !!(ob && ob.topic === 'work' && ob.draft.ym === ym);
    W.last = { ym: ym, row: row, added: again ? null : (data.replaced === false ? true : data.replaced === true ? false : null), held: !!held };
    delete W.bufs[ym];
    W.own = false; W.notice = null; W.err = null;
    dropDraft('work'); dropOutbox('work');
    track('contrib_saved', 'work');
    try { d.dispatchEvent(new CustomEvent('pvc:saved', { detail: { topic: 'work', slug: slug() } })); } catch (e) { /* 古いブラウザ */ }
    show('work-saved'); cue();
    loadMine(true);
  }
  function sumRow(dl, key, k, v, long) {
    var r = el('div', 'pvc-sum-r' + (long ? ' is-long' : ''), null, { 'data-k': key });
    r.appendChild(el('dt', 'pvc-sum-k', k));
    var none = v == null || v === '';
    /* 値は、本人が保存したとおりに出す。pv-no-cur ＝ 通貨の切替（currency.js）が走査から外す印。
       付けないと、ほかの通貨を選んでいる人には、補足に書いた「¥1,500」が「$9」に書き換わって出る
       （すぐ上の額の行は「JPY 1,500」のまま ＝ 自分の答えが、打った字と違う通貨で返ってくる）。 */
    r.appendChild(el('dd', 'pvc-sum-v pv-no-cur' + (none ? ' is-none' : ''), none ? NONE : v));
    dl.appendChild(r);
  }
  /* 見出しは、本当に起きたことだけを言う。
       増えた → 「情報を追加しました」／前の答えを置き換えた → 「情報を更新しました」／
       どちらか分からない → 「保存しました」（増えたと言い切らない）。 */
  function savedTitle(added) {
    return added === true ? '情報を追加しました' : added === false ? '情報を更新しました' : '保存しました';
  }
  /* 保存できた合図（短いクラッカー）。
     ★呼ぶのは show('work-saved') と show(topic + '-saved') の直後の2か所だけ。
       どちらもサーバが「保存した」と返し、弾かれた項目が1つも無いときにしか通らない。
       savedShell の中に置かない（描き直すたびに鳴る）。'pvc:saved' にも掛けない
       （あれは一部が弾かれた回と、ログイン後の引き継ぎでも流れる）。
     動きを減らす設定の人には紙片を出さない。印（quiet）だけ付けて、見出しとチェックの印が完了の表示になる。
     紙片は読み上げから隠し、1.4秒で片づける（動きは 0.9秒）。 */
  function cue() {
    var c = S.main.querySelector('[data-pvc-saved]'), p, i;
    if (!c) return;
    var calm = !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
    c.setAttribute('data-pvc-cue', calm ? 'quiet' : 'pop');
    if (calm) return;
    p = el('div', 'pvc-pop', null, { 'aria-hidden': 'true' });
    for (i = 0; i < 10; i++) p.appendChild(el('i', 'pvc-pop-i'));
    c.appendChild(p);
    setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 1400);
  }
  /* 並びは 見出し → 会社と月 →（ログインなしの断り）→ 2つのボタン → 保存した内容。
     保存した内容が10行あっても、スマホの最初の1画面でボタンに届くように、ボタンを先に置く。 */
  function savedShell(titleText, subText, fill, onEdit, held) {
    clear(S.main);
    var c = el('section', 'pvc-saved', null, { 'data-pvc-saved': '' });
    var h = el('h3', 'pvc-saved-h', null, { tabindex: '-1' });
    h.appendChild(icon('check', 22));
    h.appendChild(d.createTextNode(titleText));
    c.appendChild(h);
    var s = el('p', 'pvc-saved-s');
    s.appendChild(el('span', '', subText));
    s.appendChild(el('span', 'pvc-mine', 'あなたの投稿'));
    c.appendChild(s);
    var dl = el('dl', 'pvc-sum');
    fill(dl);
    /* ログインせずに預けた回は、どこに残り・いつ集計に入り・いつ消えるかを、その場で言う */
    if (held) {
      c.appendChild(heldBox('ログインなしで保存しました。', [
        howText(),
        '会社ごとの集計に入るのは、ログインして引き継いだあとです。ログインしないままの回答は' + HELD_DAYS + '日で消えます。'
      ]));
    }
    /* 「自分の回答を見る」は、同じ会社・同じ項目（勤務なら同じ月）の入力を、保存した値が入った形で開く
       ＝ 直すのもそこ。「もう1項目を答える」は同じ会社の項目の一覧へ。会社を選び直させない。 */
    var a = el('div', 'pvc-saved-a');
    var e1 = el('button', 'pvc-ghost', '自分の回答を見る', { type: 'button', 'data-pvc-act': 'edit' });
    e1.addEventListener('click', onEdit);
    var e2 = el('button', 'pvc-send', 'もう1項目を答える', { type: 'button', 'data-pvc-act': 'more' });
    e2.addEventListener('click', function () { S.viaList = true; show('list'); });
    a.appendChild(e1); a.appendChild(e2);
    c.appendChild(a);
    c.appendChild(dl);
    S.main.appendChild(c);
  }
  function renderWorkSaved() {
    var L = W.last;
    if (!L) return renderWork();
    setHead(TOPIC_NAME.work);
    var r = L.row, parts = [coName()], pl = posLabel(r.position);
    if (pl) parts.push(pl);
    parts.push(ymText(L.ym));
    savedShell(savedTitle(L.added), parts.join(' · '), function (dl) {
      sumRow(dl, 'fleet', '乗務した機種', fleetLabel(r.fleet));
      NUMS.forEach(function (n) { sumRow(dl, n.k, n.short, r[n.k] == null ? null : String(r[n.k]) + n.unit); });
      sumRow(dl, 'duty_hours_basis', '勤務・拘束時間の数え方', pick(BASIS, str(r.duty_hours_basis)) && r.duty_hours_basis ? pick(BASIS, r.duty_hours_basis) : null);
      sumRow(dl, 'commute_included', '通勤時間', r.commute_included ? pick(COMMUTE, r.commute_included) : null);
      sumRow(dl, 'note', 'ほかに伝えたいこと', r.note, !!r.note);
    }, function () { W.ym = L.ym; show('work'); }, L.held);
  }

  /* ── 選んで答える質問（通勤・タクシー／Staff Travel／機長昇格／勤務スケジュール／訓練・キャリア／休暇・手当）── */
  /* 質問の文・選択肢・単位は pv-conditions.json のもの（ここに写しを持たない）。
     通勤・タクシーだけは並びを見本どおりに置く：どの制度 → いつ → どこまで →（上限）→ 誰の負担。 */
  var TAXI_ORDER = ['commuting_transport', 'commuting_transport_method', 'commuting_taxi_when', 'commuting_bus_when',
    'commuting_taxi_where', 'commuting_taxi_cap', 'commuting_taxi_cost', 'commuting_bus_cost'];
  var UNK = 'unknown';
  var WHY = {
    unknown_question: 'この質問はいま受け付けていません。',
    rate_limited: '1日に送れる件数の上限に達しました。明日また続きをどうぞ。',
    parent_missing: '上の質問の答えと合わないため、保存されませんでした。',
    missing_code: '選択肢を選び直してください。',
    bad_code: '選択肢を選び直してください。',
    missing_num: '数字を入れ直してください。',
    bad_number: '数字を入れ直してください。',
    out_of_range: '入れられる範囲の外です。数字を確かめてください。',
    bad_currency: '通貨を選び直してください。',
    /* 低いほう・高いほうの対（台帳の rangeLow）。送る前の確かめ（sendGroup）も、サーバが断った時も、この2つの文で言う */
    range_order: '低いほうの額が、高いほうの額より大きくなっています。',
    range_currency: '低いほうと高いほうは、同じ通貨で入れてください。',
    skip_needs_login: 'この操作はログインしてからできます。',
    too_long: '補足が長すぎます。短くして送り直してください。',
    text_too_long: '補足が長すぎます。短くして送り直してください。'
  };
  /* 控えを残せる端末かどうか。残せない端末で「この端末から直せます」と言わない。 */
  function canKeep() {
    var k = 'pv_contrib_probe';
    if (lset(k, '1') && lget(k) === '1') { ldel(k); return true; }
    return false;
  }
  function anonHint() {
    return 'ログインなしで保存できます。' + (canKeep() ? '保存した内容は、この端末から確認・修正できます。' : '');
  }
  function usable(q) {
    if (!q || !q.id || !q.ja || !q.ja.label) return false;
    if (q.kind === 'choice' || q.kind === 'multi') return Array.isArray(q.choices) && q.choices.length > 0;
    return q.kind === 'num' && !!q.num && typeof q.num === 'object';
  }
  function groupOfQ(q) {
    if (q.topic && isGroup(q.topic)) return q.topic;
    if (q.section === 'roster') return 'roster';
    if (q.section === 'career') return 'career';
    return 'benefits';
  }
  /* 親の質問のすぐ下に子を置く（台帳の並びでは離れていることがある）。知らない質問が増えていても落とさない。 */
  function groupQs(topic) {
    var all = (V.conds ? V.conds.questions : []).filter(function (q) { return usable(q) && groupOfQ(q) === topic; });
    var by = {}, seen = {}, out = [];
    all.forEach(function (q) { by[q.id] = q; });
    function put(q) {
      if (seen[q.id]) return;
      seen[q.id] = true; out.push(q);
      all.forEach(function (c) { if (c.parent === q.id) put(c); });
    }
    if (topic === 'taxi') TAXI_ORDER.forEach(function (id) { if (by[id] && !seen[id]) { seen[id] = true; out.push(by[id]); } });
    all.forEach(function (q) { if (!q.parent || !by[q.parent]) put(q); });
    all.forEach(put);
    return out;
  }
  function qById(id) {
    var i, q = V.conds ? V.conds.questions : [];
    for (i = 0; i < q.length; i++) if (q[i].id === id) return q[i];
    return null;
  }
  function unkCode() { return (V.conds && V.conds.unknown) || UNK; }
  /* 答えが入っているか（補足だけの行は「答えた」に数えない） */
  function hasValue(a) {
    return !!a && (!!a.code || (Array.isArray(a.codes) && a.codes.length > 0) || (a.num != null && a.num !== ''));
  }
  function fromSaved(q, a) {
    if (!a) return q.kind === 'multi' ? [] : '';
    if (q.kind === 'multi') return Array.isArray(a.codes) && a.codes.length ? a.codes.slice() : (a.code ? [a.code] : []);
    if (q.kind === 'num') return a.num != null && a.num !== '' && isFinite(Number(a.num)) ? String(Number(a.num)) : (a.code === unkCode() ? unkCode() : '');
    return str(a.code);
  }
  function cur(t, q, sm) {
    if (t.dirty[q.id]) return q.kind === 'multi' ? (Array.isArray(t.vals[q.id]) ? t.vals[q.id] : []) : str(t.vals[q.id]);
    return fromSaved(q, sm[q.id]);
  }
  function curCur(t, q, sm) {
    if (has(t.curs, q.id)) return str(t.curs[q.id]);
    var own = sm[q.id] ? str(sm[q.id].currency) : '';
    return own || sibCur(t, q, sm);
  }
  /* 通貨は1回選べば足りる。まだ通貨を持っていない額の質問は、同じ親の下の、ほかの額の質問の通貨を借りる
     （着陸手当の「低いほう」で選んだ通貨が「高いほう」にも入る）。
     ★借りるだけで、t.curs には書かない。書くと、額を入れていない質問のせいで
       「まだ送っていない入力がある」（groupDirty）のままになる。
     ★いま画面で選んだ通貨が先・保存してある通貨は後（前に保存した別の枝の通貨が、いまの選択に勝たない）。
     ★保存してある通貨のなかでは、いま出ている質問のものが先（「低いほう」を USD で保存した人の「高いほう」が、
       前に「一定額」で答えたときの JPY を拾わない）。 */
  function sibCur(t, q, sm) {
    if (!q.parent || !V.conds) return '';
    var sibs = V.conds.questions.filter(function (s) { return s !== q && s.parent === q.parent && !!s.currency; }), i, pass, c;
    for (i = 0; i < sibs.length; i++) {
      c = has(t.curs, sibs[i].id) ? str(t.curs[sibs[i].id]) : '';
      if (c) return c;
    }
    for (pass = 0; pass < 2; pass++) {
      for (i = 0; i < sibs.length; i++) {
        if (has(t.curs, sibs[i].id) || visible(t, sibs[i], sm) !== (pass === 0)) continue;
        c = sm[sibs[i].id] ? str(sm[sibs[i].id].currency) : '';
        if (c) return c;
      }
    }
    return '';
  }
  function curNote(t, q, sm) {
    if (t.noteDirty[q.id]) return str(t.notes[q.id]);
    return sm[q.id] ? str(sm[q.id].text) : '';
  }
  function visible(t, q, sm) {
    if (!q.parent) return true;
    var p = qById(q.parent);
    if (!p || !visible(t, p, sm)) return false;
    var v = cur(t, p, sm), list = Array.isArray(v) ? v : (v ? [v] : []);
    if (!list.length) return false;
    if (!Array.isArray(q.parentWhen) || !q.parentWhen.length) return true;
    return list.some(function (c) { return q.parentWhen.indexOf(c) >= 0; });
  }
  /* 保存してある答えだけで見て、いちばん上の親まで条件が続いているか。
     上の質問を答え直すと、その下の質問の前の答えはサーバに残る（消さない ＝ 答え直せば戻る）。
     残っているだけの答えを「あなたの投稿」に数えない・保存した内容として出さない。
     サーバの公開集計も同じ決め方で外している（db/airline-conditions.sql の pv_condition_links）。 */
  function chainSaved(q, sm) { return visible({ dirty: {}, vals: {} }, q, sm); }
  /* 打たれた字を数字に読む。読めないものは null（こちらで勝手に直さない）。
     けた区切りの「,」は、3けたごとに正しく入っているときだけ外す（1,5 を 15 と読まない）。 */
  function qNum(v) {
    var t = trim(v).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/．/g, '.').replace(/，/g, ',');
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
    return /^\d{1,12}(\.\d{1,4})?$/.test(t) ? Number(t) : null;
  }
  function numText(n) {
    var p = String(Number(n)).split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return p.join('.');
  }
  function unitText(q) { return q.num && q.num.ja ? str(q.num.ja) : ''; }
  function choiceText(q, code) {
    var i, c = q.choices || [];
    for (i = 0; i < c.length; i++) if (c[i].code === code) return str(c[i].ja);
    return code === unkCode() ? 'わからない' : '';
  }
  /* 保存された1件を、読める文にする */
  function answerText(q, a) {
    var v = fromSaved(q, a);
    if (q.kind === 'multi') return v.map(function (c) { return choiceText(q, c); }).filter(Boolean).join('、');
    if (q.kind !== 'num') return choiceText(q, v);
    if (v === unkCode()) return 'わからない';
    if (v === '') return '';
    return (q.currency && a.currency ? str(a.currency) + ' ' : '') + numText(v) + unitText(q);
  }
  function sameAnswer(q, v, cc, a, text) {
    if (!a) return false;
    var s = fromSaved(q, a);
    if (q.kind === 'multi') { if (s.slice().sort().join('|') !== v.slice().sort().join('|')) return false; }
    else if (q.kind === 'num') {
      if (s === unkCode() || v === unkCode()) { if (s !== v) return false; }
      else {
        var n = qNum(v);
        if (n === null || s === '' || Number(s) !== n) return false;
        if (q.currency && str(a.currency) !== cc) return false;
      }
    } else if (s !== v) return false;
    return trim(a.text) === text;
  }
  function shareLine(qs) {
    return '補足を書いた場合は、質問の名前と一緒に、給与を提出した会員に表示されます（名前は出ません）。';
  }

  function renderGroup(topic) {
    setHead(TOPIC_NAME[topic]);
    if (!V.conds || !V.vocab) {
      waiting('読み込んでいます…');
      Promise.all([conds(), vocab()]).then(function () { if (S.open && S.view === topic) renderGroup(topic); },
        function () { if (S.open && S.view === topic) loadFailed(function () { renderGroup(topic); }); });
      return;
    }
    restore(topic);
    var t = gs(topic), logged = hasToken();
    /* 読み込み中かどうかは、ログインでは決めない（ログインしていない人も、控えの鍵で自分の分を読む） */
    var loading = (M.cond.k === 'loading' || M.cond.k === 'idle') && !M.soft;
    var sm = savedMap(), qs = groupQs(topic), E = t.els = { f: {}, ctl: {}, loading: loading };
    var max = (V.conds.limits && V.conds.limits.textMax) || 300;
    var unk = unkCode();
    clear(S.main);

    var f = el('form', 'pvc-form', null, { novalidate: '', autocomplete: 'off', 'data-pvc-form': topic });
    f.addEventListener('submit', function (e) { e.preventDefault(); sendGroup(topic); });
    /* 欄に入った時にも確かめる（下の sync）。読む人が替わっていたら、打ち始める前に入力を作り直す（月の勤務と同じ）。
       確認のチェックと送るボタンは除く ── どちらも、押したあとに自分で確かめる（チェックは ownRow・送るボタンは sendGroup）。 */
    f.addEventListener('focusin', function (e) { if (e.target !== E.cb && e.target !== E.send) sync(); });

    var ctx = el('div', 'pvc-ctx');
    var n = new Date(), parts = [coName()];
    var lastRow = M.work.k === 'ok' && M.work.rows.length ? M.work.rows[0] : null;
    if (lastRow && posLabel(lastRow.position)) parts.push(posLabel(lastRow.position));
    var town = topic === 'taxi' ? S.ctx : '';
    if (town) parts.push(town + 'からの通勤');
    parts.push(n.getFullYear() + '年' + (n.getMonth() + 1) + '月');
    ctx.appendChild(el('p', 'pvc-ctx-line', parts.join(' · ')));
    f.appendChild(ctx);

    var set = el('fieldset', 'pvc-set');
    set.disabled = loading;
    var g = el('div', 'pvc-grid');

    function change(q, v) { t.vals[q.id] = v; t.dirty[q.id] = true; sync(); }
    function tips(q, fd, folded) {
      if (topic === 'taxi') {
        if (q.kind === 'multi') fd.appendChild(el('p', 'pvc-tip', '当てはまるものをすべて選んでください。'));
        else if ((!q.parent || folded) && q.ja.help) fd.appendChild(endKept(el('p', 'pvc-tip'), q.ja.help));
        return;
      }
      if (q.ja.help) fd.appendChild(endKept(el('p', 'pvc-tip'), q.ja.help));
      if (q.kind === 'multi' && str(q.ja.help).indexOf('すべて') < 0) fd.appendChild(el('p', 'pvc-tip', '当てはまるものをすべて選んでください。'));
    }
    function fieldFor(q, folded) {
      var a = sm[q.id], v = cur(t, q, sm), fd = el('div', 'pvc-field pvc-wide', null, { 'data-q': q.id });
      var lid = 'pvc-l-' + q.id;
      var lb = el(q.kind === 'multi' ? 'div' : 'label', 'pvc-label', null, { id: lid });
      if (q.kind !== 'multi') lb.setAttribute('for', 'pvc-f-' + q.id);
      lb.appendChild(endKept(el('span', ''), q.ja.label));
      if (hasValue(a)) lb.appendChild(el('span', 'pvc-mine', 'あなたの投稿'));
      fd.appendChild(lb);
      tips(q, fd, folded);
      if (q.kind === 'multi') {
        var box = el('div', 'pvc-chips', null, { role: 'group', 'aria-labelledby': lid }), inputs = [];
        var list = q.choices.map(function (c) { return [c.code, str(c.ja)]; });
        if (!q.choices.some(function (c) { return c.code === unk; })) list.push([unk, 'わからない']);
        list.forEach(function (c) {
          var lab = el('label', 'pvc-chip');
          var cb = el('input', '', null, { type: 'checkbox', name: q.id, value: c[0] });
          cb.checked = v.indexOf(c[0]) >= 0;
          cb.addEventListener('change', function () {
            /* 「わからない」は、ほかの答えと一緒には選べない */
            if (cb.checked) inputs.forEach(function (o) { if (o !== cb && (cb.value === unk || o.value === unk)) o.checked = false; });
            change(q, inputs.filter(function (o) { return o.checked; }).map(function (o) { return o.value; }));
          });
          inputs.push(cb);
          lab.appendChild(cb); lab.appendChild(el('span', 'pvc-chip-f', c[1]));
          box.appendChild(lab);
        });
        fd.appendChild(box);
        E.ctl[q.id] = inputs[0];
      } else if (q.kind === 'num') {
        var row = el('div', 'pvc-numrow');
        if (q.currency) {
          var co = [['', '通貨を選ぶ']], cc = curCur(t, q, sm);
          (V.vocab.currencies || []).forEach(function (c) { co.push([c.code, str(c.code) + (c.ja ? '（' + str(c.ja) + '）' : '')]); });
          var cs = select(q.id + '_cur', co, cc);
          cs.sel.setAttribute('aria-label', q.ja.label + 'の通貨');
          cs.sel.addEventListener('change', function () {
            t.curs[q.id] = cs.sel.value;
            /* 同じ親の下の、まだ通貨を持っていない額の質問にも同じ通貨を見せる（送るときに借りる通貨と
               画面の表示をそろえる）。書くのは見た目だけ ＝ t.curs は選んだ本人の分しか持たない。 */
            qs.forEach(function (o) {
              var os = E.ctl[o.id + '_cur'];
              if (o === q || o.parent !== q.parent || !o.currency || !os) return;
              if (has(t.curs, o.id) || (sm[o.id] && str(sm[o.id].currency))) return;
              os.value = curCur(t, o, sm);
            });
            sync();
          });
          row.appendChild(cs.wrap);
          E.ctl[q.id + '_cur'] = cs.sel;
        }
        var isUnk = v === unk;
        var at = {
          type: 'text', name: q.id, id: 'pvc-f-' + q.id, autocomplete: 'off', maxlength: '14',
          inputmode: Number(q.num.step) > 0 && Number(q.num.step) < 1 ? 'decimal' : 'numeric'
        };
        if (!q.currency && q.num.min != null && q.num.max != null) at.placeholder = q.num.min + '〜' + q.num.max;
        var inp = el('input', 'pvc-input', null, at);
        inp.value = isUnk ? '' : v;
        inp.disabled = isUnk;
        inp.addEventListener('input', function () { change(q, inp.value); });
        /* 通貨の欄が在る行では、額と単位を1つの組に入れる ＝ 行が折れても、単位だけが額から離れて
           「わからない」の前へ落ちない（折れるのは 通貨｜額＋単位｜わからない のあいだだけ）。
           通貨の無い行は今までの並びのまま（額のすぐ右に、単位が必ず入る幅が在る）。 */
        var u = unitText(q), amt = row;
        if (q.currency && u) { amt = el('span', 'pvc-amt'); row.appendChild(amt); }
        amt.appendChild(inp);
        if (u) amt.appendChild(el('span', 'pvc-unit', u));
        var ul = el('label', 'pvc-chip');
        var ub = el('input', '', null, { type: 'checkbox', name: q.id + '_unk', value: unk });
        ub.checked = isUnk;
        ub.addEventListener('change', function () {
          inp.disabled = ub.checked;
          if (ub.checked) inp.value = '';
          change(q, ub.checked ? unk : '');
        });
        ul.appendChild(ub); ul.appendChild(el('span', 'pvc-chip-f', 'わからない'));
        row.appendChild(ul);
        fd.appendChild(row);
        E.ctl[q.id] = inp;
      } else {
        var opts = hasValue(a) ? [] : [['', '回答しない']];
        q.choices.forEach(function (c) { opts.push([c.code, str(c.ja)]); });
        if (!q.choices.some(function (c) { return c.code === unk; })) opts.push([unk, 'わからない']);
        if (hasValue(a) && v === '') opts.unshift(['', '選択してください']);
        var s = select(q.id, opts, v);
        s.sel.addEventListener('change', function () { change(q, s.sel.value); });
        fd.appendChild(s.wrap);
        E.ctl[q.id] = s.sel;
      }
      E.f[q.id] = fd;
      return fd;
    }
    /* どの質問にも、選んだ答えに添える補足を残せる（任意）。答えの代わりにはならない。 */
    function moreFor(q, fd) {
      var tx0 = curNote(t, q, sm);
      var open = !!(t.noteOpen[q.id] || trim(tx0) || q.note);
      var wrap = el('div', 'pvc-more');
      var bt = el('button', 'pvc-more-b', null, {
        type: 'button', 'data-q-more': q.id, 'aria-expanded': open ? 'true' : 'false', 'aria-controls': 'pvc-m-' + q.id
      });
      bt.appendChild(icon('plus', 14));
      bt.appendChild(el('span', '', '補足を足す（任意）'));
      bt.hidden = open;
      var panel = el('div', 'pvc-more-p', null, { id: 'pvc-m-' + q.id });
      panel.hidden = !open;
      panel.appendChild(el('label', 'pvc-more-k', '補足（任意）', { 'for': 'pvc-n-' + q.id }));
      var ta = el('textarea', 'pvc-area pvc-area-s', null, {
        name: q.id + '_note', id: 'pvc-n-' + q.id, rows: '2', maxlength: String(max),
        'aria-label': q.ja.label + 'の補足（任意）',
        placeholder: town ? town + 'から通う場合のことなど、選択肢で言い切れないことがあれば' : '条件や例外など、選択肢で言い切れないことがあれば'
      });
      ta.value = tx0;
      ta.addEventListener('input', function () { t.notes[q.id] = ta.value; t.noteDirty[q.id] = true; });
      panel.appendChild(ta);
      bt.addEventListener('click', function () {
        t.noteOpen[q.id] = true;
        bt.setAttribute('aria-expanded', 'true');
        bt.hidden = true; panel.hidden = false;
        try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
      });
      wrap.appendChild(bt); wrap.appendChild(panel);
      fd.appendChild(wrap);
    }

    qs.forEach(function (q) {
      /* 上の質問の答えで出てくる「続きの質問」には印を付ける（pv-contrib.css の .pvc-kid ＝ 左に線・1段下げる）。
         続きの続きも同じ1段（下げ幅を重ねない）。上の質問がこの項目に無い質問は、いちばん上として出るので付けない。 */
      var kid = !!q.parent && qs.some(function (o) { return o.id === q.parent; });
      if (!(topic === 'taxi' && q.note)) {
        var fd = fieldFor(q, false);
        if (kid) fd.className += ' pvc-kid';
        moreFor(q, fd);
        g.appendChild(fd);
        return;
      }
      /* 通勤・タクシーの「上限」だけは、見本どおり畳んで出す（補足の欄はその中） */
      var fold = el('div', 'pvc-fold pvc-wide' + (kid ? ' pvc-kid' : ''), null, { 'data-q-fold': q.id });
      var a = sm[q.id];
      var bt = el('button', 'pvc-fold-b', null, { type: 'button', 'aria-expanded': t.fold ? 'true' : 'false', 'aria-controls': 'pvc-fold-p' });
      bt.appendChild(el('span', '', '回数・金額の上限を追加'));
      if (hasValue(a)) bt.appendChild(el('span', 'pvc-mine', 'あなたの投稿'));
      var panel = el('div', 'pvc-fold-p', null, { id: 'pvc-fold-p' });
      panel.hidden = !t.fold;
      bt.addEventListener('click', function () {
        t.fold = !t.fold;
        bt.setAttribute('aria-expanded', t.fold ? 'true' : 'false');
        panel.hidden = !t.fold;
      });
      var inner = fieldFor(q, true);
      inner.className = 'pvc-field';
      panel.appendChild(inner);
      var nf = el('div', 'pvc-field');
      nf.appendChild(el('label', 'pvc-label', '上限についての補足（任意）', { 'for': 'pvc-f-cap-note' }));
      var ta = el('textarea', 'pvc-area', null, {
        name: q.id + '_note', id: 'pvc-f-cap-note', rows: '3', maxlength: String(max),
        placeholder: '回数の上限や、決まりごとがあれば'
      });
      ta.value = curNote(t, q, sm);
      ta.addEventListener('input', function () { t.notes[q.id] = ta.value; t.noteDirty[q.id] = true; });
      nf.appendChild(ta);
      panel.appendChild(nf);
      fold.appendChild(bt); fold.appendChild(panel);
      E.fold = fold; E.foldQ = q; E.foldBtn = bt; E.foldPanel = panel;
      g.appendChild(fold);
    });

    set.appendChild(g);
    f.appendChild(set);
    /* 書く前に、誰に見えるかを言う（補足は任意。書かなければ何も出ない） */
    f.appendChild(el('p', 'pvc-share', shareLine(qs), { 'data-pvc-share': '' }));
    E.msg = el('div'); f.appendChild(E.msg);
    if (t.notice) E.msg.appendChild(note(t.notice));
    var o = ownRow(t, '匿名で追加する', sync);
    E.send = o.send; E.cb = o.cb;
    f.appendChild(o.act);
    E.wait = el('p', 'pvc-wait', '', { 'data-pvc-wait': '' });
    f.appendChild(E.wait);
    S.main.appendChild(f);

    function sync() {
      /* 読む人が替わっていたら、前の人の分を手放して、その場で作り直す（触った質問の答えと補足は残る） */
      if (readerTurn()) return redraw();
      qs.forEach(function (q) {
        var on = visible(t, q, sm);
        if (E.fold && E.foldQ === q) E.fold.hidden = !on;
        else if (E.f[q.id]) E.f[q.id].hidden = !on;
      });
      E.send.disabled = !t.own || t.busy || loading;
      E.send.textContent = t.busy ? '送っています…' : (qs.some(function (q) { return hasValue(sm[q.id]); }) ? '匿名で更新する' : '匿名で追加する');
      var tx = '';
      if (loading) tx = 'これまでの投稿を確認しています…';
      else if (M.cond.k === 'fail') tx = 'これまでの投稿を読み込めませんでした。このまま送れます（同じ質問の答えがあれば、今回の内容に置き換わります）。';
      else if (!logged) tx = anonHint();
      E.wait.textContent = tx; E.wait.hidden = !tx;
    }
    E.sync = sync;
    sync();
    revealNotice(E.msg, t.notice);
    if (!loading) focusQuestion(topic);
  }
  /* 「この質問から答える」と開いた入口は、その質問が見える所まで面の中を送る。
     まだ出ていない質問（上の質問の答えで出てくるもの）は、出ているいちばん近い親へ。 */
  function focusQuestion(topic) {
    if (S.focusT !== topic || !S.focusQ) return;
    var t = gs(topic), E = t.els, q = qById(S.focusQ), sm = savedMap(), n = null;
    S.focusQ = ''; S.focusT = '';
    if (t.notice) return;                             // 知らせを出した回は、そちらを見せる
    while (q && groupOfQ(q) === topic) {
      if (visible(t, q, sm)) {
        if (E.fold && E.foldQ === q) {
          if (!t.fold) { t.fold = true; E.foldBtn.setAttribute('aria-expanded', 'true'); E.foldPanel.hidden = false; }
          n = E.fold;
        } else n = E.f[q.id];
        break;
      }
      q = q.parent ? qById(q.parent) : null;
    }
    if (!n || !S.main || !n.getBoundingClientRect) return;
    var m = S.main.getBoundingClientRect(), r = n.getBoundingClientRect();
    if (!m.height || !r.height) return;
    S.main.scrollTop += r.top - m.top - 12;
  }
  function groupSay(topic, o) {
    var t = gs(topic), E = t.els;
    t.notice = o;
    if (!E.msg) return;
    clear(E.msg);
    if (o) {
      E.msg.appendChild(note(o));
      if (E.msg.scrollIntoView) { try { E.msg.scrollIntoView({ block: 'center' }); } catch (e) { E.msg.scrollIntoView(); } }
    }
  }
  /* 欄を、面の見えている高さのまんなかへ送る。動かすのは面の中だけ（うしろのページは動かさない・なめらかには送らない）。 */
  function midOf(n) {
    if (!n || !S.main || !n.getBoundingClientRect) return;
    var m = S.main.getBoundingClientRect(), r = n.getBoundingClientRect();
    if (!m.height || !r.height) return;
    S.main.scrollTop += (r.top + r.height / 2) - (m.top + m.height / 2);
  }
  /* 断りの知らせは、名指しした欄に値が入ったら消す（直したあとも残っていると、もう一度断られたように読める）。
     ・聞くのは面の中身（S.main）の1か所で、欄は name で見分ける ── 入力はその場で描き直されることがあり
       （読む人が替わった時 等）、欄そのものに付けた聞き手は、描き直しで欄ごと消える。
     ・消すのは、付けた時の断りだけ（そのあとに出た別の知らせは消さない）。1度使ったら外す。
     ・新しい断りが出たら、前の聞き手は外す（重ねない）。 */
  var haltOff = null;
  function haltWatch(topic, names, o) {
    if (haltOff) haltOff();
    function off() {
      S.main.removeEventListener('change', on); S.main.removeEventListener('input', on);
      if (haltOff === off) haltOff = null;
    }
    function on(e) {
      var n = e.target;
      if (!n || !n.getAttribute || names.indexOf(n.getAttribute('name')) < 0) return;
      if (n.type === 'checkbox' ? !n.checked : trim(n.value) === '') return;
      off();
      if (gs(topic).notice === o) groupSay(topic, null);
    }
    S.main.addEventListener('change', on); S.main.addEventListener('input', on);
    haltOff = off;
  }
  function sendGroup(topic) {
    var t = gs(topic);
    if (t.busy || S.view !== topic) return;
    /* 読む人が替わっていたら、前の人の分を手放して入力を作り直し、この1回の押下では何も送らない */
    if (readerTurn()) return redraw();
    var sm = savedMap(), qs = groupQs(topic), known = M.cond.k === 'ok', unk = unkCode();
    var answers = [], had = 0, stop = '', stopQ = '';
    var stopToo = '';                        // 断りが対の2つの欄についてのとき、もう一方の欄（どちらを直しても、断りを消す）
    qs.forEach(function (q) {
      if (stop || !visible(t, q, sm)) return;
      var v = cur(t, q, sm), a = sm[q.id], one = null, tx = trim(curNote(t, q, sm)), cc = '', nm = '「' + q.ja.label + '」';
      function halt(text, key) { stop = text; stopQ = key || q.id; }
      if (q.kind === 'multi') {
        if (v.length) one = v.length === 1 && v[0] === unk ? { question_id: q.id, code: unk } : { question_id: q.id, codes: v.slice() };
        else if (hasValue(a)) halt(nm + 'は、答えを空に戻せません。当てはまるものか「わからない」を選んでください。');
      } else if (q.kind === 'num') {
        if (v === unk) one = { question_id: q.id, code: unk };
        else if (trim(v) !== '') {
          var num = qNum(v);
          cc = q.currency ? curCur(t, q, sm) : '';
          if (num === null) halt(nm + 'は、数字で入れてください。');
          else if ((q.num.min != null && num < Number(q.num.min)) || (q.num.max != null && num > Number(q.num.max))) {
            halt(nm + 'は、' + q.num.min + '〜' + q.num.max + ' の範囲で入れてください。');
          } else if (q.currency && !cc) halt(nm + 'は、通貨を選んでください。', q.id + '_cur');
          else { one = { question_id: q.id, num: num }; if (q.currency) one.currency = cc; }
        } else if (hasValue(a)) halt(nm + 'は、答えを空に戻せません。数字を入れるか「わからない」を選んでください。');
      } else if (v) one = { question_id: q.id, code: v };
      if (stop) return;
      if (tx && !one) return halt('補足を残すには、' + nm + 'の答えを選んでください。');
      if (!one) return;
      had++;
      if (tx) {
        one.text = tx;
        /* ★「資格のある会員に見せます」の印は、この画面で書いた・直した補足と、もともと印の付いていた補足にだけ付ける。
           以前の画面から書かれた補足（本人だけに見えるもの）を、答えを直しただけで人に見せない。 */
        if (t.noteDirty[q.id] || (a && a.shared === true)) one.share = true;
      }
      if (!known || !sameAnswer(q, v, cc, a, tx)) answers.push(one);
    });
    /* ★低いほう・高いほうの対（台帳の rangeLow）は、2つの端が「この送信のあと」に持つ額で比べる。
       ・端の額と通貨は、上のループと同じ読み方（cur → qNum・curCur）。触っていない端からは、保存してある額が出てくる
         ── その端は送り直さないが、送ったあとに並ぶ相手はそれ。これから送る answers からは読まない
         （変えていない端は入っていない ＝ 片方だけ直した人の食い違いを見落とす）。
       ・額の無い端（「わからない」・空・いまは出ていない）が在れば、比べない。「わからない」を 0 と読まない。
       ・通貨が先・大小が後（サーバの pv_condition_range_bad と同じ順）。同じ額は通す。数として比べる（字で比べない）。
       ・一覧を読めなかった人が前に保存した端は、ここには無い ＝ そのときに断るのはサーバ（同じ文が rejected で届く）。 */
    function endOf(q) {
      if (!q || q.kind !== 'num' || !visible(t, q, sm)) return null;
      var v = cur(t, q, sm), n = v === unk ? null : qNum(v);
      return n === null ? null : { num: n, cur: q.currency ? curCur(t, q, sm) : '' };
    }
    if (!stop) qs.forEach(function (hi) {
      var lo = !stop && hi.rangeLow ? qById(hi.rangeLow) : null, a = endOf(lo), b = a ? endOf(hi) : null;
      if (!a || !b) return;
      if (a.cur && b.cur && a.cur !== b.cur) { stop = WHY.range_currency; stopQ = hi.id + '_cur'; stopToo = lo.id + '_cur'; }
      else if (a.num > b.num) { stop = WHY.range_order; stopQ = hi.id; stopToo = lo.id; }
    });
    if (stop) {
      var said = { kind: 'said', title: '保存できませんでした', text: stop };
      groupSay(topic, said);
      var c = t.els.ctl && t.els.ctl[stopQ];
      /* 畳んである質問（通勤・タクシーの「上限」）の欄を名指しした時は、先に畳みを開ける（閉じたままでは、その欄へ移れない） */
      if (c && t.els.fold && t.els.foldQ && t.els.foldQ.id === stopQ && !t.fold) {
        t.fold = true; t.els.foldBtn.setAttribute('aria-expanded', 'true'); t.els.foldPanel.hidden = false;
      }
      if (c && !c.disabled) { try { c.focus({ preventScroll: true }); } catch (e) { /* 古いブラウザ */ } }
      /* 名指しした欄を見える所へ送り、その欄に値が入ったら断りを消す（どの断りでも同じ） */
      if (c) { midOf(c); haltWatch(topic, stopToo ? [stopQ, stopToo] : [stopQ], said); }
      return;
    }
    if (!had) return groupSay(topic, { kind: 'said', title: '保存できませんでした', text: '1つ以上答えてください（分かるものだけで大丈夫です）。' });
    /* 端末に残した「送れなかった1件」が、いま送ろうとした入力そのものなら、その1件はもう保存されている
       （返事だけが届かなかった回）＝ 控えを消す。消さないと、一覧が「送れていない回答があります」と言い続ける。
       ⚠️ 入力が同じ時だけ。ほかのタブで開いていた入力や、戻したあとで直した入力から「同じです」になった回に、
          まだ送れていない別の1件を捨てない。 */
    if (!answers.length && unsentIs(topic)) dropOutbox(topic);
    if (!answers.length) return groupSay(topic, { kind: 'same', tone: 'calm', title: '保存済みの内容と同じです', text: '変えたい項目を選び直してから送ってください。' });

    var pl = { airline: slug(), lang: 'ja', answers: answers };
    var lastRow = M.work.k === 'ok' && M.work.rows.length ? M.work.rows[0] : null;
    if (lastRow && lastRow.position) pl.position = lastRow.position;
    if (lastRow && lastRow.fleet) pl.fleet = lastRow.fleet;
    groupSay(topic, null);
    setBusy(t, true);
    send('cond', pl).then(function (r) {
      setBusy(t, false);
      if (r.kind === 'ok' && r.data.ok) return groupSaved(topic, answers, r.data, !!r.held);
      if (needLogin(r)) return toLogin(topic);
      if (r.kind === 'said') return groupSay(topic, saidNote(r, topic));
      if (r.kind === 'off') return groupSay(topic, offNote());
      keepOutbox(topic);
      groupSay(topic, failNote(topic));
    });
  }
  function groupSaved(topic, sent, data, held) {
    var t = gs(topic), rej = Array.isArray(data.rejected) ? data.rejected : [], bad = {}, kept = 0;
    savedBy(t);
    rej.forEach(function (x) { if (x && x.question_id) bad[x.question_id] = str(x.reason); });
    /* サーバが受けた答えを、手元の一覧にも入れる（このあと取り直して確かめる）。
       はじめて預けた人は、まだ一覧を1度も読めていない（読む鍵がいま届いた）ので、ここで作る。 */
    var list = M.cond.k === 'ok' ? M.cond.answers.slice() : [];
    /* 増えたのか・置き換えたのか：サーバは答えごとの印を返さないので、
       さっきサーバから読んだ自分の一覧（下で混ぜる前）に無かった質問を数える。
       一覧を読めていない回は数えない（下の added が「分からない」になる）。 */
    var wasOk = M.cond.k === 'ok', old = wasOk ? savedMap() : {}, fresh = 0;
    sent.forEach(function (a) {
      if (has(bad, a.question_id)) return;
      kept++;
      if (wasOk && !hasValue(old[a.question_id])) fresh++;
      list = list.filter(function (x) { return x.question_id !== a.question_id; });
      var one = {
        airline: slug(), question_id: a.question_id, code: a.code || null, codes: a.codes || null,
        num: a.num == null ? null : a.num, currency: a.currency || null,
        text: a.text || null, shared: !!(a.text && a.share)
      };
      list.push(one);
      /* 一覧を読めなかった人・このあとの取り直しに失敗した人にも、いま保存した答えを見せられるように控える */
      keep(held).ans[a.question_id] = one;
      delete t.dirty[a.question_id]; delete t.vals[a.question_id]; delete t.curs[a.question_id];
      delete t.noteDirty[a.question_id]; delete t.notes[a.question_id];
    });
    if (kept && (M.cond.k === 'ok' || held) && !noWho()) {
      M.cond = { k: 'ok', answers: list };
      if (held) M.held = true;
    }
    /* 送れなかった回の送り直しか（端末に残した1件が、この項目のもの）。すぐ下で消すので、その前に見ておく。 */
    var ob = outbox(), again = !!(ob && ob.topic === topic);
    dropDraft(topic); dropOutbox(topic);
    if (kept) {
      track('contrib_saved', topic);
      try { d.dispatchEvent(new CustomEvent('pvc:saved', { detail: { topic: topic, slug: slug() } })); } catch (e) { /* 古いブラウザ */ }
    }
    if (rej.length) {
      t.notice = {
        kind: 'rej', title: '保存できなかった項目があります',
        text: kept ? 'ほかの' + kept + '件は保存しました。' : '',
        list: rej.map(function (x) {
          var q = qById(x.question_id);
          return (q ? '「' + q.ja.label + '」' : 'この項目') + '：' + (WHY[x.reason] || '保存できませんでした。');
        })
      };
      renderGroup(topic);
      if (t.els.msg && t.els.msg.scrollIntoView) { try { t.els.msg.scrollIntoView({ block: 'center' }); } catch (e) { t.els.msg.scrollIntoView(); } }
      loadMine(true);
      return;
    }
    /* 一覧を読めていないログインなしの回は、サーバがいま鍵を作って返したとき（＝はじめての保存）だけ「増えた」。
       送れなかった回の送り直し（again）は「分からない」── 前の送信がサーバに届いていたかを、こちらは知らない
       （会員でも・ログインなしでも・月の勤務でも、同じ見出し「保存しました」になる）。
       q ＝ この回に送った最初の質問（「自分の回答を見る」が、その質問の所まで送る）。 */
    t.own = false; t.notice = null;
    t.last = { n: kept, q: sent.length ? str(sent[0].question_id) : '', held: !!held,
      added: again ? null : (wasOk ? fresh > 0 : (held && okKey(data.key) ? true : null)) };
    show(topic + '-saved'); cue();
    loadMine(true);
  }
  function renderGroupSaved(topic) {
    var t = gs(topic);
    if (!t.last || !V.conds) return renderGroup(topic);
    setHead(TOPIC_NAME[topic]);
    var sm = savedMap(), qs = groupQs(topic);
    savedShell(savedTitle(t.last.added), coName(), function (dl) {
      qs.forEach(function (q) {
        var a = sm[q.id];
        if (!hasValue(a) || !chainSaved(q, sm)) return;
        sumRow(dl, q.id, q.ja.label, answerText(q, a), true);
        if (trim(a.text)) sumRow(dl, q.id + '_note', topic === 'taxi' && q.note ? '上限についての補足' : '補足', trim(a.text), true);
      });
    }, function () {
      /* 「自分の回答を見る」は、いま保存した質問の所まで送る（長い項目では、保存した答えが最初の1画面の下に在り、
         頭から出すと未回答の質問だけが見えて、保存した答えが消えたように見える）。
         送るのは focusQuestion ── 会社ページの「この質問から答える」と同じ道（指した質問は、1回送ったら忘れる）。 */
      var q = t.last ? t.last.q : '';
      if (q) { S.focusQ = q; S.focusT = topic; }
      show(topic);
    }, t.last.held);
  }

  /* ── ログインへ ─────────────────────────────────────────── */
  /* 入れた内容を下書きに残して、戻り先に ?add= を付けて行く。
     いま居るのは面のために積んだ1段なので、置き換えて行く（戻ったときに面の殻だけが残らない）。
     noDraft … 一覧から「ログインして引き継ぐ」で行くとき（残す入力が無い）。 */
  function toLogin(topic, noDraft) {
    if (!noDraft) keepDraft(topic, 'login');
    var q = null, search;
    try { q = new URLSearchParams(location.search); } catch (e) { q = null; }
    if (q) { q.set('add', topic); search = '?' + q.toString(); } else search = '?add=' + topic;
    var url = ROOT + 'login.html?return=' + enc(location.pathname + search);
    try { location.replace(url); } catch (e) { location.href = url; }
  }

  /* ── 開く・閉じる・履歴 ─────────────────────────────────── */
  function afterSkip() {
    S.skipPop = false;
    var f = S.onSkip, q = S.queue;
    S.onSkip = null; S.queue = null;
    if (f) f();
    if (q) q();
  }
  function stripMark() {
    try { if (history.state && history.state.pvc) history.replaceState(null, '', location.href); } catch (e) { /* 触れなければそのまま */ }
  }
  /* 面のために積んだ1段を降りる。降りたことは popstate で知る（来なければ印だけ外す）。 */
  function stepBack(then) {
    var tok = ++S.tok;
    S.skipPop = true; S.onSkip = then || null;
    setTimeout(function () { if (S.skipPop && S.tok === tok) { stripMark(); afterSkip(); } }, 700);
    try { history.back(); } catch (e) { stripMark(); afterSkip(); }
  }
  function openSheet(o) {
    var t = topicOf(o && o.topic), fq = trim(o && o.q);
    if (!slug() || !d.body) return false;
    if (S.skipPop) { S.queue = function () { openSheet(o); }; return true; }
    build();
    /* 街の詳細から開かれた回は、その街の名前を持って入る（字として見せるだけ。答えには勝手に書き足さない） */
    S.ctx = trim(o && o.ctx).slice(0, 40);
    /* 「この質問から答える」で開かれた回は、その質問の所まで送る（show が別の話題へ移るときに忘れる） */
    if (isGroup(t) && QID.test(fq)) { S.focusQ = fq; S.focusT = t; }
    if (S.open) { show(t); return true; }
    S.open = true; S.viaList = t === 'list'; S.view = '';
    var a = d.activeElement;
    S.from = (o && o.from) || (a && a !== d.body ? a : null);
    clearTimeout(S.hideT);
    S.root.hidden = false;
    S.root.classList.toggle('is-dark', d.documentElement.getAttribute('data-theme') === 'dark');
    d.documentElement.classList.add('pvc-lock');
    if (o && o.adopt) S.pushed = true;
    else {
      /* 開く前の位置を、いまの段に書き留めてから積む（面からほかのタブへ行ったあと「戻る」で同じ所へ帰る） */
      if (w.PVGlance && typeof w.PVGlance.mark === 'function') w.PVGlance.mark();
      try { history.pushState({ pvc: 1, t: t }, '', location.href); S.pushed = true; } catch (e) { S.pushed = false; }
    }
    loadMine(true);
    show(t);
    void S.root.offsetWidth;                // ここで一度描かせてから、滑り込む
    S.root.classList.add('is-in');
    track('contrib_open', t);
    return true;
  }
  /* 面を閉じて、同じページの別のタブへ。
     ⚠️ 積んだ1段を降りてからタブの段を積み直さない。降りるのは時間差で届くので、
        （1）降りた先の位置をブラウザがあとから置き直して、切り替えたタブが途中から始まる
        （2）混んだ回に降りるのが遅れると、積んだタブの段のほうが降ろされる
        の2つが起きる。面のために積んだ1段を、そのまま行き先のタブの段に書き換える（待つものが無い）。
        「戻る」は開く前の段へ ＝ 開く前のタブと位置（openSheet が位置を書き留めている）。 */
  function leaveTo(tab) {
    var G = w.PVGlance, pushed = S.pushed;
    if (!ownTab(tab)) return;
    /* もうそのタブの一覧に居る：行き先が無いので、積んだ1段を降りて閉じるだけ（焦点は開いたボタンへ返す） */
    if (G.at() === tab && !(typeof G.city === 'function' && G.city())) { close(false); return; }
    S.from = null;                          // 行き先は別のタブ。開いたボタンへ焦点を返さない
    close(true);                            // 履歴には触れずに閉じる
    G.go(tab, { replace: pushed });
  }
  function close(viaPop) {
    if (!S.open) return;
    S.open = false;
    C.note = null;                          // 引き継ぎの知らせは、面を1度開いて見せたら終わり
    S.root.classList.remove('is-in');
    d.documentElement.classList.remove('pvc-lock');
    var root = S.root, from = S.from, pushed = S.pushed;
    S.from = null; S.pushed = false;
    clearTimeout(S.hideT);
    S.hideT = setTimeout(function () { if (!S.open) root.hidden = true; }, 380);
    if (from && d.contains(from) && typeof from.focus === 'function') {
      try { from.focus({ preventScroll: true }); } catch (e) { /* 古いブラウザ */ }
    } else if (d.activeElement && root.contains(d.activeElement)) {
      try { d.activeElement.blur(); } catch (e) { /* 古いブラウザ */ }
    }
    if (!viaPop && pushed) stepBack(null);
  }
  function onPop() {
    if (S.skipPop) { S.tok++; afterSkip(); return; }
    var st = null;
    try { st = history.state; } catch (e) { st = null; }
    if (S.open) { if (!(st && st.pvc)) close(true); return; }
    if (st && st.pvc) openSheet({ topic: st.t, adopt: true });     // 「進む」で面の段へ戻ってきた
  }
  function tabbables() {
    var out = [];
    Array.prototype.forEach.call(S.sheet.querySelectorAll('a[href],button,input,select,textarea'), function (n) {
      if (n.matches(':disabled') || n.closest('[hidden]')) return;
      if (!n.getClientRects().length) return;
      out.push(n);
    });
    return out;
  }
  function onKey(e) {
    if (!S.open || e.isComposing) return;
    var k = e.key || '';
    if (k === 'Escape' || k === 'Esc' || e.keyCode === 27) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      close();
      return;
    }
    if (k !== 'Tab' && e.keyCode !== 9) return;
    var f = tabbables(), a = d.activeElement;
    if (!f.length) { e.preventDefault(); S.title.focus(); return; }
    if (!S.sheet.contains(a)) { e.preventDefault(); f[0].focus(); return; }
    if (e.shiftKey && (a === f[0] || a === S.title || a === S.sheet)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && a === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
  function onFocusIn(e) {
    if (!S.open || !S.root || S.root.contains(e.target)) return;
    try { S.title.focus({ preventScroll: true }); } catch (x) { /* 古いブラウザ */ }
  }
  function onClick(e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-pvc-open]') : null;
    if (!t || !slug()) return;
    e.preventDefault();
    openSheet({ topic: t.getAttribute('data-pvc-open'), q: t.getAttribute('data-pvc-q'), ctx: t.getAttribute('data-pvc-ctx'), from: t });
  }
  /* ?add=<話題>&aq=<質問> で来た回。読んだら住所から外す（読み直しのたびに開かない）。 */
  function takeAdd() {
    var q;
    try { q = new URLSearchParams(location.search); } catch (e) { return null; }
    if (!q.has('add')) return null;
    var o = { topic: topicOf(q.get('add')), q: trim(q.get('aq')) }, s;
    q.delete('add'); q.delete('aq');
    s = q.toString();
    try { history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash); } catch (e) { /* 住所はそのまま */ }
    return o;
  }
  function boot() {
    d.addEventListener('click', onClick, false);
    w.addEventListener('popstate', onPop, false);
    w.addEventListener('keydown', onKey, true);
    d.addEventListener('focusin', onFocusIn, true);
    /* ほかのタブでログイン・ログアウトした／控えの鍵が替わった（storage）、タブへ戻った時にログインが切れていた（visibilitychange）：
       面が開いていれば、その場で作り直す。pv-session.js が同じ合図を先に受けて、切れたログインを片づけている。
       ⚠️ visibilitychange は、ページを離れる時（隠れる側）にも流れる。そこで読み直すと、去っていくページが
          預かりの引き継ぎを始めてしまい、次に開いたページは「引き継ぎました」を言えなくなる ＝ 見える側に戻った時だけ受ける。 */
    w.addEventListener('storage', onReader, false);
    d.addEventListener('visibilitychange', function () { if (d.visibilityState === 'visible') onReader(); }, false);
    /* 同じタブのまま、誰も触らないうちにログインが切れた時：pv-session.js は自分の時計で片づけるが、合図は出さない。
       こちらも同じ長さの時計で聞く（pv-session.js の `var TICK_MS  = 60 * 1000;` と同じ）。
       面が閉じている時・読む人が同じ時は、何もしない ＝ 通信は1本も出ない。 */
    setInterval(onReader, 60 * 1000);
    function go() { var a = takeAdd(); COMING = false; if (a) openSheet(a); }
    var st = null;
    try { st = history.state; } catch (e) { st = null; }
    /* 面を開いたまま読み直すと、面のために積んだ1段の上に居る。
       その段を降りておく（降りないと、読み直した人だけ「戻る」が1回ぶん足りなくなる）。 */
    if (st && st.pvc) stepBack(go); else go();
    /* ログインせずに預けた回答があり、いまログインしている人は、面を開かなくても引き継ぐ
       （引き継ぐまで、その回答は会社ごとの集計に入らない）。本人かどうかはサーバが確かめる。 */
    setTimeout(function () { if (!S.open && hasToken() && devKey()) claim(); }, 1500);
  }

  w.PVContrib = {
    open: function (o) { return openSheet({ topic: o && o.topic, q: o && o.q }); },
    close: function () { close(); },
    /* 開いている・これから開く（?add= で来た）。全ページ共通の案内の板が、入力の上に被らないために聞く。 */
    isOpen: function () { return !!(S.open || S.skipPop || S.queue || COMING); }
  };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
