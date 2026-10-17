/* career-stay.js — 就航地の画面の「ホテル」の欄（data-live="hotels"）を埋める。
 *
 * ・開けるかどうかは**サーバーが返した state だけ**で決める（locked／open）。
 *   画面でプロフィール・給与の鍵・ブラウザの保存領域を見て開けない。
 * ・鍵の1行に「ログイン」の入口を添えるかどうかだけは、この端末にログインの鍵が在るかで決める
 *   （鍵が無い人にだけ添える。会員には入口を出さない）。開ける・開けないには使わない。
 *   会員の鍵の1行にも何も添えない。見てよい人になる申し込みの口は、この画面からは呼ばない
 *   （見てよい人はオーナーが決める。ホテルを足しても、申し込みにも承認にもならない）。
 * ・見てよいのは、オーナーと、オーナーが承認した人だけ（db/stays.sql）。給与の提出・ログイン・プロフィールでは開かない
 *   ＝ 鍵の1行の横に、給与の提出への入口を置かない。
 * ・3つの入口（ホテル・レストラン・場所を追加）と追加の面は、欄のすぐ後ろの兄弟（.crs-zone）に置く。
 *   欄の中には、サーバーがこの人に見せてよいものだけを描く。入口は読み出しを始めた時から、どの状態でも在る。
 * ・Supabase の入口は PVCareer.client()（career-live.js が作る）。ここで createClient しない。
 *   まだ無ければ欄に触らず、cr:show のたびに見直す。ページを読み終えても無ければ「読み込めませんでした」にする。
 * ・一覧の読み出しは STAY_WAIT まで待つ（来なければ「読み込めませんでした」＋「もう一度」。自動のやり直しはしない）。
 * ・取ってきた字は全部 textContent。取ってきた行き先のリンクは https の Google マップだけ（ほかは検索のリンクに置き換える）。
 * ・写真は端末でキャンバスに描き直して JPEG にしてから送る（手本は roadmap.js の「添付の絵」）。
 *   幅と高さは**サーバーが返したもの**を使う。返ってきた b64 は Blob にして出し、
 *   使い終わった URL は revokeObjectURL（画面を離れたとき・描き直すとき・ログインが変わったとき）。
 * ・関数の形の正は db/stays.sql。引数はどれも {p:{…}} の1つ。
 */
(function (w, d) {
  'use strict';

  /* career.html は #cr。会社ページ（airlines/…）は career-live.js と同じく body を根にする。 */
  var root = d.getElementById('cr') ||
             (d.body && d.body.getAttribute('data-pv-glance') === '1' ? d.body : null);
  if (!root || !w.Promise || !w.WeakMap) return;

  /* このファイルの置き場（＝サイトの根）。会社ページは1つ下の階層に在るので、
     相対の住所をページから解くと airlines/pv-airlines.json を読みに行ってしまう。 */
  var BASE = (function () {
    var cs = d.currentScript, src = cs && cs.src ? String(cs.src) : '';
    return src ? src.split('#')[0].split('?')[0].replace(/[^\/]*$/, '') : '';
  })();

  /* 会社ページ（airlines/…）は1つ下の階層に在る。career-live.js と同じ決め方。 */
  var GL = !!d.body && d.body.getAttribute('data-pv-glance') === '1';
  var UP = GL ? '../' : '';
  function enc(s) { return encodeURIComponent(String(s)); }
  function loginHref() {
    if (GL) return UP + 'login.html?redirect=' + enc(location.pathname.replace(/^.*\/airlines\//, 'airlines/'));
    return 'login.html?redirect=' + enc('career.html' + location.search);
  }
  function backHash() {
    var h = String(location.hash || '');
    return /^#[A-Za-z0-9_-]{1,40}$/.test(h) ? h : '';
  }
  /* この端末にログインの鍵が在るか。★入口を添えるかどうかを決めるためだけ（開けるかどうかは、いつもサーバーの答え）。
     鍵が在る人（会員・もう使えない鍵が残っている人）には何も添えない。鍵が片づけば、ログインの入口が戻る。 */
  function loggedIn() {
    try { return !!(w.PVSession && typeof w.PVSession.hasToken === 'function' && w.PVSession.hasToken()); }
    catch (e) { return false; }
  }
  /* 鍵の1行に添える、ただ1つの入口（ログインの鍵が無い人だけ）。行き先は押した時にもう一度決める
     （描いたあとで都市やタブを移っていても、押した時の画面へ戻す）。 */
  function entry() {
    var a = el('a', 'crl-link', T.login);
    a.setAttribute('data-crs-entry', 'login');
    a.href = loginHref() + enc(backHash());
    a.addEventListener('click', function () { a.href = loginHref() + enc(backHash()); }, true);
    return a;
  }

  var T = {
    off:        '準備中',
    locked:     'Only VERIFIED PILOT',
    login:      'ログイン',
    err:        '読み込めませんでした',
    retry:      'もう一度',
    none:       'まだ登録がありません',
    emptyT:     '泊まったホテルを、次のパイロットへ。',
    emptyS:     'ホテルの名前だけでも追加できます。確認のあと公開されます。',
    hours:      function (n) { return 'ステイ 約' + n + '時間'; },
    pending:    '確認待ち',
    rejected:   '見送り',
    mine:       'あなたの投稿',
    map:        'Google マップ',
    others:     '同じ空港で他社が使うホテル',
    entHotel:   'ホテルを追加',
    entFood:    'レストランを追加',
    entSpot:    '場所を追加',
    fKind:      '種類',
    fName:      '名前',
    fAddr:      '住所',
    fMap:       'Google マップの URL',
    fNote:      'ひとこと',
    fHours:     'ステイ時間（任意）',
    fHoursU:    '時間',
    fPhoto:     '写真',
    pick:       '写真を選ぶ',
    unpick:     '写真を外す',
    send:       '追加する',
    edit:       '修正',
    editSend:   '修正を送る',
    edited:     '修正しました。確認のあと公開されます。',
    same:       '変更はありませんでした。',
    cancel:     'やめる',
    photoAdd:   '写真を追加',
    pub:        '承認',        /* 管理ページの承認のボタンと同じ字（admin-queue.js の T.ok。P12.53：2つの面で同じ言葉） */
    rej:        '却下',
    del:        '削除',
    delSure:    '削除する',
    close:      '閉じる',
    zoom:       '写真を大きく表示',
    photoErr:   '写真を表示できません',
    sending:    '送信中…',
    added:      '追加しました。確認のあと公開されます。',
    addedBut:   '場所は追加しました。',
    photoDone:  '写真を追加しました。確認のあと公開されます。',
    pubDone:    '公開しました。',
    rejDone:    '却下しました。',
    delDone:    '削除しました。',
    needName:   '名前は2〜80字で入力してください。',
    needKind:   '種類を選んでください。',
    badHours:   'ステイ時間は 1〜240 の整数（時間）で入力してください。空のままでも送れます。',
    badMap:     'Google マップのリンク（https）を入れてください。空のままでも追加できます。'
  };

  /* サーバーの status → 一言。写真の2つ（image_bad／image_too_big）は、ほかの失敗と分けて出す。 */
  var SAY_ADD = {
    bad_airline:  'この就航地には、いま追加できません。',
    bad_iata:     'この就航地には、いま追加できません。',
    bad_kind:     T.needKind,
    bad_name:     T.needName,
    too_long:     '住所は200字、ひとことは500字までです。',
    bad_city:     '都市の名前が長すぎます。',
    bad_hours:    T.badHours,
    too_fast:     '続けて追加するときは、少し時間をあけてください。',
    rate_limited: '追加できる数の上限に達しました。24時間たってからお試しください。',
    duplicate:    '同じ名前を、もう追加しています。',
    exists:       '同じ名前が、もう登録されています。',
    queue_full:   'この就航地には、いま追加できません。'
  };
  /* 直す口（pv_stay_update）だけが返すもの。ほかは足す口と同じ言葉。 */
  var SAY_EDIT = {
    not_found:    'この投稿は、いま修正できません。',
    final:        '見送られた投稿は修正できません。新しく追加してください。',
    rate_limited: '修正できる回数の上限に達しました。24時間たってからお試しください。'
  };
  var SAY_PHOTO = {
    image_bad:     'この写真は読み込めませんでした。別の写真を選んでください。',
    image_too_big: '写真が大きすぎます。別の写真を選んでください。',
    not_found:     'この場所には、いま写真を付けられません。',
    rate_limited:  '写真を追加できる数の上限に達しました。24時間たってからお試しください。',
    full:          '1つの場所に付けられる写真は4枚までです。',
    duplicate:     '同じ写真を、もう付けています。'
  };
  var SAY_MOD = {
    forbidden: '運営だけが操作できます。',
    own_post:  '自分が出したものは、別の運営が確認します。',
    final:     '見送ったものは公開に戻せません。',
    not_found: 'もう表示できないものです。',
    changed:   '出した人が内容を直していました。いまの内容を読み直したので、確認してからもう一度押してください。',
    exists:    '同じ名前が、もう登録されています。'
  };
  var SAY_FAIL = 'うまくいきませんでした。もう一度お試しください。';

  var KINDS = [['hotel', 'ホテル'], ['food', 'レストラン'], ['spot', '場所']];
  /* 欄の外に並べる3つの入口（押した種類を選んだまま、追加の面が開く）。 */
  var ENTS = [['hotel', T.entHotel], ['food', T.entFood], ['spot', T.entSpot]];

  var IC = {
    lock: '<svg class="crs-ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/></svg>',
    out:  '<svg class="crs-ic" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5h10v10M19 5L6 18"/></svg>',
    plus: '<svg class="crs-ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
  };

  // ══ 小さな道具 ═════════════════════════════════════════════
  function el(tag, cls, text) {
    var n = d.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);      /* ★字は必ずここを通る */
    return n;
  }
  /* 決まった絵だけ（この中の定数）。取ってきた字は通さない。 */
  function icon(name) {
    var s = d.createElement('span');
    s.className = 'crs-icw';
    s.innerHTML = IC[name] || '';
    return s;
  }
  function btn(cls, text, act) {
    var b = el('button', cls, text);
    b.type = 'button';
    if (act) b.setAttribute('data-act', act);
    return b;
  }
  function str(v) { return typeof v === 'string' ? v.replace(/^\s+|\s+$/g, '') : ''; }
  function int(v) { var n = Number(v); return (n === Math.floor(n) && n > 0 && n <= 20000) ? n : 0; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function bad(v) { return !v || v.__err || v.ok !== true; }

  // ══ この端末の控え（保存領域。どれも try／catch。使えない端末でも欄は出す）════════════
  var KEY = 'pv_stay_key';          // ログインせずに足した人の控えの鍵（この端末だけ・サーバーが作った英数48字）
  function lget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lrem(k) { try { localStorage.removeItem(k); } catch (e) { /* 消せなくても先へ */ } }
  function devKey() { var k = lget(KEY); return /^[0-9a-f]{48}$/.test(k || '') ? k : ''; }
  /* 誰が足したかで答えが変わる口（読む・足す・直す・消す）にだけ、控えの鍵を添える。写真と運営の口には添えない。 */
  function withKey(o) { var k = devKey(); if (k) o.key = k; return o; }

  // ══ 通信（PVCareer.client() だけを使う）════════════════════
  function hasClient() {
    var P = w.PVCareer;
    return !!(P && typeof P.client === 'function');
  }
  function client() {
    var c;
    try { c = w.PVCareer.client(); } catch (e) { return Promise.reject(e); }
    return Promise.resolve(c).then(function (c) {
      if (!c || typeof c.rpc !== 'function') throw new Error('client');
      watchAuth(c);
      return c;
    });
  }
  var STAY_WAIT = 10000;   // 一覧の返事を待つ上限（ミリ秒）。★1回だけ。自動のやり直しはしない（「もう一度」を押した人だけがやり直す）
  /* p が ms のうちに答えなければ、読めなかったものとして返す（stop で通信も止める）。あとから届いた答えは使わない。 */
  function within(p, ms, stop) {
    return new Promise(function (done) {
      var over = false;
      var t = w.setTimeout(function () {
        over = true;
        if (stop) { try { stop(); } catch (e) { /* 止められなくても、欄は終わらせる */ } }
        done({ __err: { message: 'timeout' } });
      }, ms);
      p.then(function (v) { if (over) return; w.clearTimeout(t); done(v); });
    });
  }
  /* ctl を渡した読み出しだけが止められる（一覧の読み出し）。保存（追加・修正・写真・削除）は渡さない
     ＝ 止めない（止めても、サーバーではもう保存されているかもしれない）。 */
  function rpc(name, args, ctl) {
    return client().then(function (c) {
      var q = c.rpc(name, { p: args });
      if (ctl && w.AbortController && q && typeof q.abortSignal === 'function') {
        var ac = new w.AbortController();
        q = q.abortSignal(ac.signal);
        ctl.abort = function () { ac.abort(); };
      }
      return Promise.resolve(q).then(function (r) {
        if (!r) return { __err: {} };
        if (r.error) return { __err: r.error, __st: r.status };
        return r.data == null ? { __err: {} } : r.data;
      });
    }).then(null, function (e) { return { __err: e || {} }; });
  }
  /* 関数そのものが無い（本番にまだ貼られていない）。ほかの失敗と分ける。 */
  function missing(v) {
    var e = v && v.__err;
    if (!e) return false;
    return e.code === 'PGRST202' || e.code === '42883' || v.__st === 404 ||
           /could not find the function/i.test(String(e.message || ''));
  }

  /* ログインが変わったら、持っている答えと写真を全部捨てて取り直す
     （ログアウトした人の画面に、開いていたときの行を残さない）。 */
  var WATCHED = false, UID;
  var PHOTO_LOCK = false;          // 写真の「見られない」で取り直したか（fetchPhoto。同じ理由で回り続けない）
  function watchAuth(c) {
    if (WATCHED || !c.auth || typeof c.auth.onAuthStateChange !== 'function') return;
    WATCHED = true;
    try {
      c.auth.onAuthStateChange(function (ev, sess) {
        var uid = (sess && sess.user && sess.user.id) || null;
        if (UID === undefined && ev === 'INITIAL_SESSION') { UID = uid; settleDrafts(); LIVE.slice().forEach(restoreDraft); return; }
        if (UID !== undefined && uid === UID) return;
        var was = UID;
        UID = uid;
        if (typeof was === 'string') closeAdds();   /* ログアウト・人の入れ替わり：開いている追加の面は閉じる（打った字を次の人の画面に残さない） */
        else if (uid && slots().some(function (s) { return !!zoneForm(s); })) FORM_IN = true;   /* ログインの前に開いた追加の面も、ここからはログインのあいだの面（ログインが知らせなく消えたら閉じる） */
        /* 書きかけを、いまの相手に合わせる：別の会員に替わったら前の人の分を消す・ログインせずに打った分はログインした人のものにする。
           ログアウトでは消さない（この画面から見れば、ほかのタブでの・知らせの届かないログアウト ＝ 同じ人が戻れば30分のうちは戻る） */
        settleDrafts();
        CACHE = {};
        PHOTO_LOCK = false;
        LIVE.slice().forEach(drop);
        scan();
      });
    } catch (e) { /* 見張れなくても欄は出せる */ }
  }

  // ══ 欄ごとの状態 ═══════════════════════════════════════════
  var ST    = new w.WeakMap();     // 欄 → { key, urls, zoom, pick, busy }
  var LIVE  = [];                  // いま中身が入っている欄
  var CACHE = {};                  // 'etihad|NRT' → サーバーの答え（ページの中で使い回す）

  function slots() {
    return Array.prototype.slice.call(root.querySelectorAll('.crl[data-live="hotels"]'));
  }
  function shown(slot) {
    return !slot.closest('[hidden]') && slot.getClientRects().length > 0;
  }
  function keyOf(slot) {
    return String(slot.getAttribute('data-airline') || '').toLowerCase() + '|' +
           String(slot.getAttribute('data-stay') || '').toUpperCase();
  }
  function revoke(st) {
    if (!st) return;
    if (st.zoom && st.zoom.open && st.zoom.close) { try { st.zoom.close(); } catch (e) {} }
    st.zoom = null;
    if (st.pick && st.pick.url) w.URL.revokeObjectURL(st.pick.url);
    st.pick = null;
    st.urls.forEach(function (u) { w.URL.revokeObjectURL(u); });
    st.urls = [];
  }
  /* 欄に中身を置く。前の中身の写真はここで手放す。 */
  function put(slot, state, node) {
    slot.removeAttribute('data-who');
    while (slot.firstChild) slot.removeChild(slot.firstChild);
    if (node) slot.appendChild(node);
    slot.setAttribute('data-state', state);
    if (state === 'loading') slot.setAttribute('aria-busy', 'true');
    else slot.removeAttribute('aria-busy');
    /* 欄の外の面（入口）は、読み出しを始めた時（loading）から、どの状態でも描く。 */
    if (state !== 'idle') { var zst = ST.get(slot); if (zst) paintZone(slot, zst, state === 'loading' ? null : (CACHE[zst.key] || null)); }
  }
  /* 画面から外れた欄は、出荷時の形（—）に戻す。 */
  function drop(slot) {
    revoke(ST.get(slot));
    ST.delete(slot);
    var i = LIVE.indexOf(slot);
    if (i >= 0) LIVE.splice(i, 1);
    put(slot, 'idle', el('span', 'crl-ph', '—'));
    /* 欄の外の面：自分の投稿の列と一言は空にする（開いている追加の面は、読む人か都市が変わるまで残す）。 */
    var z = zoneIf(slot);
    if (z) {
      var own = z.querySelector('.crs-own');
      if (own) { while (own.firstChild) own.removeChild(own.firstChild); own.hidden = true; }
      var zs = z.querySelector('.crs-zone-say');
      if (zs) zs.textContent = '';
    }
  }

  /* 開いた答えを持ったまま、この端末のログインの鍵が消えていたら、持っている答えを捨てる。
     ふつうは onAuthStateChange が先に来る（watchAuth）。届かない消え方 ── ほかの画面が鍵だけを
     消した・期限が切れた ── でも、開いていたときのホテル名と写真を画面に残さないための2つ目の網。
     ログインして読んだ「自分が足したもの」も同じ（鍵の1行の下の札）。
     ⚠️ 鍵が「在る」ことは何の資格にもしない。見てよいかどうかを決めるのは、いつもサーバーの答えだけ。 */
  function keyGone() {
    try { return !!(w.PVSession && typeof w.PVSession.hasToken === 'function' && !w.PVSession.hasToken()); }
    catch (e) { return false; }
  }
  /* 持っている答えのうち、ログインが消えたら捨てるもの：開いた一覧と、ログインして読んだ「自分が足したもの」。
     ログインせずに（控えの鍵で）読んだ自分の分は数えない ── 鍵の無い人の画面が、1分ごとに読み直しに行かないように。
     ログインしているあいだに開いた追加の面が、まだ開いていることも数える（書きかけを次の人に渡さない）。 */
  function holdsOpen() {
    for (var k in CACHE) {
      var c = CACHE[k];
      if (c && (c.state === 'open' || (c.__in === true && arr(c.own).length))) return true;
    }
    return FORM_IN;
  }
  function forgetIfGone() {
    if (!holdsOpen() || !keyGone()) return false;
    closeAdds();                     /* 書きかけは消さない（ログインが知らせなく切れただけ ＝ 同じ人がログインし直せば、30分のうちは戻る） */
    CACHE = {};
    LIVE.slice().forEach(drop);
    /* 鍵が消えたことは onAuthStateChange には届いていない。覚えている相手も一緒に忘れる
       （忘れないと、同じ人がほかのタブでログインし直したとき「相手は変わっていない」と読んで取り直さない）。 */
    if (UID !== undefined) UID = null;
    return true;
  }

  var LOADED = d.readyState === 'complete';   // ページを読み終えたか（読み終えても口が無ければ、待つのをやめる）
  function scan() {
    forgetIfGone();
    LIVE.slice().forEach(function (s) { if (!shown(s)) drop(s); });
    if (!hasClient()) {
      /* ページを読み終えても口が無い ＝ 読めなかった（「—」のまま黙らない）。やり直しは、同じ道をもう一度通る。 */
      if (LOADED) slots().forEach(function (s) { if (shown(s) && /\|[A-Z]{3}$/.test(keyOf(s)) && !ST.get(s)) load(s, {}); });
      return;
    }
    slots().forEach(function (s) {
      if (!shown(s)) return;
      var st = ST.get(s), key = keyOf(s);
      /* 会社ページは1つの欄を都市ごとに使い回す（data-stay を書き換えてから cr:show が来る）。 */
      if (!/\|[A-Z]{3}$/.test(key)) { if (st) drop(s); return; }   /* 空港がまだ決まっていない */
      if (!st || st.key !== key) load(s, {});
    });
  }

  var HANDED = null;               // ログインした人が、この端末の控えの鍵を引き取っている途中（その約束）
  /* ログインの鍵と控えの鍵の両方が在るときだけ、1回だけ引き取りを頼む。頼めなくても先へ進む（控えの鍵は残る）。 */
  function handOver() {
    var k = devKey();
    if (!k || !loggedIn()) return Promise.resolve();
    if (!HANDED) HANDED = rpc('pv_stay_claim', { key: k }).then(function (v) {
      if (v && v.ok === true) lrem(KEY);      /* 引き取れた：控えの鍵は役目を終えた */
      HANDED = null;
    });
    return HANDED;
  }

  function load(slot, opt) {
    bindOn(slot, slot);
    revoke(ST.get(slot));
    /* 欄の外で開いたままの追加の面：選んであった写真は、いま手放した（revoke）。見本の絵と選んだ口も外す。 */
    var zf = zoneForm(slot);
    if (zf) {
      var zpv = zf.querySelector('.crs-pv'), zfi = zf.querySelector('[data-pick]');
      if (zpv) zpv.parentNode.removeChild(zpv);
      if (zfi) zfi.value = '';
    }
    var st = { key: keyOf(slot), urls: [], zoom: null, pick: null, busy: false };
    ST.set(slot, st);
    /* 送っている途中の印は、前の読み出しのもの（その返事は、もう使わない）。欄の外の面に残すと、入口が押せないままになる。 */
    var zb = zoneIf(slot);
    if (zb) zb.removeAttribute('data-busy');
    if (LIVE.indexOf(slot) < 0) LIVE.push(slot);

    /* 取り直すと決めた回は、前の答えを先に捨てる（取り直しに失敗したあと、出入りで古い答えを描き直さない） */
    if (opt.fresh) delete CACHE[st.key];
    else if (CACHE[st.key]) { paint(slot, st, CACHE[st.key], opt); return; }

    var sk = el('div', 'crs-skel');
    sk.appendChild(el('span', 'crs-skel-a'));
    sk.appendChild(el('span', 'crs-skel-b'));
    put(slot, 'loading', sk);

    var k = st.key.split('|');
    /* 返事が STAY_WAIT のうちに来なければ、読めなかったことにする（待ちの絵のまま止まらない）。やり直しは「もう一度」だけ。 */
    var ctl = {};
    /* 待つ上限は、引き取り（handOver）も含めて1つ。 */
    within(handOver().then(function () { return rpc('pv_stays', withKey({ airline: k[0], iata: k[1] }), ctl); }), STAY_WAIT,
           function () { if (ctl.abort) ctl.abort(); }).then(function (v) {
      /* 「見られない」と返ってきたら、ほかの都市で持っていた開いた答えを全部捨てる
         （見てよいかはサーバーの最新の答えだけが決める。前に開いていた都市を描き直さない）。
         ⚠️ 捨てるのは開いた答えだけ。「見られない」の答えまで捨てると、鍵の無い人（＝ほとんどの人）が
            都市を行き来するたびに、同じ都市を何度も取りに行く（1行のために、待ちの絵が毎回出る）。
         ⚠️ 追い越された答えでも、これだけは聞き捨てない。答えが着く前に一覧へ戻った人の画面では、
            この先の「描く」は要らないが、「もう見られない」は残る ── 聞き捨てると、前に開いた都市が持っていた答えから出る。
         逆向き（「見られる」と返ってきた）も同じ：前の「見られない」を捨てて、聞き直す。 */
      var word = (missing(v) || bad(v)) ? '' : v.state;
      if (word === 'locked' || word === 'open') {
        Object.keys(CACHE).forEach(function (key) {
          var c = CACHE[key] && CACHE[key].state;
          if ((c === 'open' || c === 'locked') && c !== word) delete CACHE[key];
        });
        if (word === 'locked') PHOTO_LOCK = false;
      }
      if (ST.get(slot) !== st) return;        /* 追い越された答えは描かない */
      if (missing(v)) { v = { ok: true, state: 'off' }; }
      else if (v && v.ok === false && (v.status === 'bad_airline' || v.status === 'bad_iata')) {
        /* この会社・この空港は保存先に無い ＝ この会社については、まだつながっていない（読めなかったのでも、0件でもない）。 */
        v = { ok: true, state: 'off' };
      }
      else if (bad(v) || (v.state !== 'locked' && v.state !== 'open')) { paintError(slot); return; }
      /* 「準備中」は覚えない（都市を開き直した時に聞き直す）。覚える答えには、ログインの鍵が在るときに読んだかを添える（holdsOpen）。 */
      if (v.state !== 'off') { v.__in = loggedIn(); CACHE[st.key] = v; }
      paint(slot, st, v, opt);
    });
  }

  // ══ 描く ═══════════════════════════════════════════════════
  function paint(slot, st, v, opt) {
    if (v.state === 'off') { put(slot, 'off', el('p', 'crs-line', T.off)); if (opt && opt.say) zsay(slot, opt.say); return; }
    if (v.state === 'locked') {
      /* ★鍵の印と1行。入口は、ログインの鍵が無い人にだけ「ログイン」の1つ（会員には何も添えない）。
         ほかの人の名前・件数・写真は、そもそも届いていない。 */
      var who = loggedIn() ? 'member' : 'login';
      var lk = el('p', 'crs-line crs-lock');
      lk.appendChild(icon('lock'));
      lk.appendChild(el('span', '', T.locked));
      if (who === 'login') lk.appendChild(entry());
      put(slot, 'locked', lk);
      slot.setAttribute('data-who', who);
      /* 欄の中に一言の置き場は無い（鍵の1行だけ）。足したあとの一言は、欄の外の面に出す。 */
      if (opt && opt.say) zsay(slot, opt.say);
      return;
    }
    paintOpen(slot, st, v, opt);
  }

  function paintError(slot) {
    var box = el('div', 'crs-line crs-err');
    box.appendChild(el('span', '', T.err));
    box.appendChild(btn('crs-act', T.retry, 'retry'));
    put(slot, 'error', box);
  }

  function paintOpen(slot, st, v, opt) {
    var places = arr(v.places), others = arr(v.others);
    var canAdd = v.can_add === true, isOp = v.is_operator === true;
    var city = cityOf(slot);
    var box = el('div', 'crs');
    var h2 = slot.parentNode && slot.parentNode.querySelector ? slot.parentNode.querySelector('.cr-h2') : null;
    var h2t = h2 ? str(h2.textContent) : '';

    KINDS.forEach(function (k) {
      var rows = places.filter(function (it) { return it && it.kind === k[0]; });
      if (!rows.length) return;
      var g = el('div', 'crs-grp');
      /* すぐ上の見出しと同じ字なら、画面では重ねない（読み上げには残す）。 */
      g.appendChild(el('h3', 'crs-h' + (k[1] === h2t ? ' cr-vh' : ''), k[1]));
      var ul = el('ul', 'crs-list');
      rows.forEach(function (it) {
        ul.appendChild(card(slot, st, it, { city: city, canAdd: canAdd, isOp: isOp }));
      });
      g.appendChild(ul);
      box.appendChild(g);
    });

    /* 0件。追加できる人には「ここから足せる」ことを先に言う（押すと、この会社・この空港のまま面が開く）。
       追加できない人には今までどおりの1行。 */
    var empty = null;
    if (!places.length) {
      if (canAdd) {
        empty = el('div', 'crs-empty');
        empty.appendChild(el('p', 'crs-empty-t', T.emptyT));
        empty.appendChild(el('p', 'crs-empty-s', T.emptyS));
        box.appendChild(empty);
      } else {
        box.appendChild(el('p', 'crs-line crs-none', T.none));
      }
    }

    var say = el('p', 'crs-say');
    say.setAttribute('role', 'status');
    say.setAttribute('aria-live', 'polite');
    if (opt && opt.say) say.textContent = opt.say;
    box.appendChild(say);

    if (others.some(function (o) { return o && arr(o.places).length; })) {
      var os = el('div', 'crs-others');
      os.appendChild(el('h3', 'crs-h crs-h-o', T.others));
      others.forEach(function (o) {
        var rows = arr(o && o.places);
        if (!rows.length) return;
        var co = el('div', 'crs-co');
        var code = str(o.airline);
        var hn = el('h4', 'crs-co-n', code);
        airlineName(code).then(function (n) { hn.textContent = n; });
        co.appendChild(hn);
        var ul = el('ul', 'crs-list');
        rows.forEach(function (it) {
          ul.appendChild(card(slot, st, it, { city: city, canAdd: false, isOp: isOp }));
        });
        co.appendChild(ul);
        os.appendChild(co);
      });
      box.appendChild(os);
    }

    put(slot, places.length ? 'open' : 'empty', box);
    pump();
  }

  function card(slot, st, it, o) {
    var li = el('li', 'crs-card');
    var id = str(it.id), name = str(it.name);
    var top = el('div', 'crs-top');
    top.appendChild(el('p', 'crs-name', name));
    /* 自分が足したもの（★サーバーが返した mine）。開いた一覧でも、欄の外の自分の分でも同じ札。 */
    if (it.mine === true) top.appendChild(el('span', 'crs-badge crs-badge-me', T.mine));
    if (it.state === 'pending') top.appendChild(el('span', 'crs-badge', T.pending));
    else if (it.state === 'rejected') top.appendChild(el('span', 'crs-badge crs-badge-no', T.rejected));
    li.appendChild(top);
    if (str(it.address)) li.appendChild(el('p', 'crs-addr', str(it.address)));
    /* ステイ時間はホテルだけ。書いていないホテルには何も出さない（0 で埋めない）。 */
    var hrs = it.kind === 'hotel' ? int(it.stay_hours) : 0;
    if (hrs >= 1 && hrs <= 240) li.appendChild(el('p', 'crs-hours', T.hours(hrs)));
    if (str(it.note)) li.appendChild(el('p', 'crs-note', str(it.note)));

    /* ★欄の外の自分の分（見てよい人ではない人）は、返事に何が入っていても写真を描かない・聞かない
       （聞けば「見られない」が返り、一覧を読み直し、また聞く ── 回り続ける）。 */
    var phs = o.own ? [] : arr(it.photos).filter(function (p) { return p && str(p.id); });
    if (phs.length) {
      var row = el('div', 'crs-photos');
      phs.forEach(function (p) {
        var b = btn('crs-ph', null, 'zoom');
        b.setAttribute('aria-label', T.zoom);
        b.setAttribute('data-ph', 'wait');
        b.disabled = true;
        var im = d.createElement('img');
        im.alt = name;
        im.decoding = 'async';
        b.appendChild(im);
        if (p.state === 'pending') b.appendChild(el('span', 'crs-badge crs-ph-b', T.pending));
        b.__crs = { id: str(p.id), mine: p.mine === true, state: p.state, name: name, isOp: o.isOp };
        row.appendChild(b);
        QUEUE.push({ slot: slot, st: st, id: str(p.id), btn: b, img: im });
      });
      li.appendChild(row);
    }

    var acts = el('div', 'crs-acts');
    var a = el('a', 'crs-map');
    a.href = mapsOk(it.maps_url) || searchUrl(name, o.city);
    a.target = '_blank';
    a.rel = 'noopener';
    a.appendChild(el('span', '', T.map));
    a.appendChild(icon('out'));
    acts.appendChild(a);

    if (o.canAdd && it.state !== 'rejected') {
      var lb = el('label', 'crs-act crs-file');
      lb.appendChild(el('span', '', T.photoAdd));
      var fi = d.createElement('input');
      fi.type = 'file';
      fi.accept = 'image/*';
      fi.className = 'crs-file-in';
      fi.setAttribute('data-place', id);
      lb.appendChild(fi);
      acts.appendChild(lb);
    }
    /* 直せるのは書いた本人だけ（★サーバーが返した mine）。見送られたものは直せない。 */
    if ((o.canAdd || o.own) && it.mine === true && it.state !== 'rejected') {
      var eb = btn('crs-act', T.edit, 'edit');
      eb.setAttribute('aria-expanded', 'false');
      eb.__crsItem = it;
      acts.appendChild(eb);
    }
    modButtons(acts, 'place', id, it, o.isOp);
    li.appendChild(acts);
    return li;
  }

  /* 運営の承認（＝公開）／却下、本人と運営の削除。★出すかどうかはサーバーが返した印（is_operator・mine・state）だけ。
     ★ほかの人の確認待ちには、管理ページの承認の面と同じ2つ（承認・却下）だけを、同じ字で出す。
       管理ページは確認待ちを消す口を持たないので、ここでも確認待ちの他人の分には削除を出さない（P12.53）。 */
  function modButtons(box, target, id, it, isOp) {
    function add(text, act, cls) {
      var b = btn('crs-act' + (cls ? ' ' + cls : ''), text, act);
      b.setAttribute('data-target', target);
      b.setAttribute('data-id', id);
      box.appendChild(b);
      return b;
    }
    if (isOp && it.state === 'pending') {
      /* 自分のものは別の運営が見る。
         ★公開のボタンは「いま見えている中身」の印（rev）を持つ。サーバーは、本人が直したことのある場所を
           印なしでは通さない（＝ 運営が見ていない中身が公開されない）。持たせないと、直された場所は
           何度押しても公開に戻せない。 */
      if (it.mine !== true) {
        var pub = add(T.pub, 'pub', 'crs-act-go');
        if (target === 'place' && typeof it.rev === 'string' && /^[0-9a-f]{8,64}$/.test(it.rev)) pub.setAttribute('data-rev', it.rev);
      }
      add(T.rej, 'rej', 'crs-act-no');
    }
    var waitOther = isOp && it.state === 'pending' && it.mine !== true;
    if (it.mine === true || (isOp && !waitOther)) add(T.del, 'del', 'crs-act-no');
  }

  /* 欄の中に一言の置き場があればそこへ（欄の外の一言は消す）。無ければ（鍵・準備中）欄の外の面へ。 */
  function say(slot, text) {
    var p = slot.querySelector('.crs-say'), z = zoneIf(slot), zs = z ? z.querySelector('.crs-zone-say') : null;
    if (p) { p.textContent = text || ''; if (zs) zs.textContent = ''; }
    else if (zs) zs.textContent = text || '';
  }
  function fsay(form, text) {
    var p = form.querySelector('.crs-form-say');
    if (p) p.textContent = text || '';
  }

  // ══ 地図のリンク ═══════════════════════════════════════════
  /* db/stays.sql の pv_stay_maps_url の写し（https で Google マップのホストだけ）。
     正はサーバー。ここは「届いた字をそのまま href に入れない」ための2本目の錠。 */
  function mapsOk(u) {
    var v = str(u);
    if (v.length < 12 || v.length > 500) return '';
    if (/[\s\u0000-\u001f\u007f"'<>\\`　]/.test(v)) return '';
    if (/\.\./.test(v) || /%2e/i.test(v)) return '';
    var m = /^https:\/\/([A-Za-z0-9.-]+)($|[\/?#].*$)/i.exec(v);
    if (!m) return '';
    var host = m[1].toLowerCase(), rest = m[2] || '';
    if (host === 'www.google.com' || host === 'google.com' || host === 'www.google.co.jp') {
      if (!/^\/maps($|[\/?#])/.test(rest)) return '';
    } else if (host === 'maps.google.com' || host === 'maps.google.co.jp') {
      if (!/^($|[?#]|\/($|[?#])|\/maps($|[\/?#]))/.test(rest)) return '';
    } else if (host === 'maps.app.goo.gl') {
      if (!/^\/[A-Za-z0-9_-]+($|[\/?#])/.test(rest)) return '';
    } else if (host === 'goo.gl') {
      if (!/^\/maps\/[A-Za-z0-9_-]+($|[\/?#])/.test(rest)) return '';
    } else {
      return '';
    }
    return 'https://' + host + rest;
  }
  function searchUrl(name, city) {
    return 'https://www.google.com/maps/search/?api=1&query=' +
           encodeURIComponent((name + ' ' + city).replace(/\s+/g, ' ').replace(/^ | $/g, ''));
  }
  /* 都市の名前は、その画面の見出しに在る字（「東京」）。無ければ3レター。 */
  function cityOf(slot) {
    var own = str(slot.getAttribute('data-city'));
    if (own) return own;                         /* 会社ページは欄が都市の名前を持つ */
    var sec = slot.closest('[data-view="stay"]'), h = sec ? sec.querySelector('h1') : null, s = '';
    if (h) for (var n = h.firstChild; n; n = n.nextSibling) if (n.nodeType === 3) s += n.nodeValue;
    s = s.replace(/\s+/g, ' ').replace(/^ | $/g, '');
    return s || String(slot.getAttribute('data-stay') || '');
  }

  /* 他社の名前。ページに在る5社はそこから、ほかは pv-airlines.json（生成物）を1回だけ読む。 */
  var NAMES_HERE = null, NAMES_ALL = null;
  function airlineName(code) {
    if (!NAMES_HERE) {
      NAMES_HERE = {};
      try {
        var j = JSON.parse(d.getElementById('crc-data').textContent);
        NAMES_HERE = (j && j.airlines) || {};
      } catch (e) { /* 無ければ下へ */ }
    }
    var a = NAMES_HERE[code];
    if (a && str(a.ja)) return Promise.resolve(str(a.ja));
    if (!NAMES_ALL) {
      NAMES_ALL = (w.fetch ? w.fetch(BASE + 'pv-airlines.json') : Promise.reject())
        .then(function (r) { return r && r.ok ? r.json() : {}; })
        .then(function (j) { return (j && j.airlines) || {}; }, function () { return {}; });
    }
    return NAMES_ALL.then(function (m) { return (m[code] && str(m[code].ja)) || code; });
  }

  // ══ 写真を出す ═════════════════════════════════════════════
  /* 一覧には写真の id しか無い。1枚ずつ取りに行く（同時に2本まで）。 */
  var QUEUE = [], RUN = 0;
  function pump() {
    while (RUN < 2 && QUEUE.length) {
      var j = QUEUE.shift();
      if (ST.get(j.slot) !== j.st) continue;       /* もう出ていない欄の写真は取りに行かない */
      RUN++;
      fetchPhoto(j).then(next, next);
    }
  }
  function next() { RUN--; pump(); }

  function b64Blob(s) {
    try {
      var bin = w.atob(String(s).replace(/\s+/g, ''));
      var n = bin.length, u = new Uint8Array(n);
      for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
      if (n < 4 || u[0] !== 0xFF || u[1] !== 0xD8 || u[2] !== 0xFF) return null;   /* JPEG の頭 */
      return new Blob([u], { type: 'image/jpeg' });
    } catch (e) { return null; }
  }

  function fetchPhoto(j) {
    return rpc('pv_stay_photo', { id: j.id }).then(function (v) {
      if (ST.get(j.slot) !== j.st) return;
      /* 写真だけ「見られない」と返ってきた ＝ 一覧を取ったあとで、見てよい人ではなくなった。
         持っている答えを全部捨てて取り直す（ホテル名と住所を、覚えていた答えから描き直さない）。
         取り直してもまだ同じなら、写真が出せない行として扱う（回り続けない）。 */
      if (v && v.status === 'locked' && !PHOTO_LOCK) {
        PHOTO_LOCK = true;
        CACHE = {};
        LIVE.slice().forEach(drop);
        scan();
        return;
      }
      var blob = (!bad(v) && typeof v.b64 === 'string') ? b64Blob(v.b64) : null;
      if (!blob) {
        j.btn.setAttribute('data-ph', 'err');
        j.btn.removeAttribute('aria-label');
        j.btn.appendChild(el('span', 'crs-ph-e', T.photoErr));
        return;
      }
      var url = w.URL.createObjectURL(blob);
      j.st.urls.push(url);
      /* ★幅と高さはサーバーが写真から読んだもの。場所を先に取る（読み込みで行が跳ねない）。 */
      var pw = int(v.w), ph = int(v.h);
      if (pw && ph) {
        j.img.width = pw;
        j.img.height = ph;
        j.btn.style.aspectRatio = pw + ' / ' + ph;
      }
      j.img.src = url;
      j.btn.__crs.url = url;
      j.btn.setAttribute('data-ph', 'ok');
      j.btn.disabled = false;
    });
  }

  /* 大きく見る面。写真ごとの公開／却下／削除はここに置く（小さな写真の列にボタンを並べない）。 */
  function zoom(slot, st, b) {
    var m = b.__crs;
    if (!m || !m.url) return;
    if (st.zoom && st.zoom.parentNode) st.zoom.parentNode.removeChild(st.zoom);
    var dg = el('dialog', 'crs-zoom');
    var im = d.createElement('img');
    im.className = 'crs-zoom-img';
    im.alt = m.name;
    im.src = m.url;                                /* 同じ URL を使う（新しく作らない） */
    dg.appendChild(im);
    var acts = el('div', 'crs-acts crs-zoom-acts');
    modButtons(acts, 'photo', m.id, m, m.isOp);
    acts.appendChild(btn('crs-act crs-zoom-x', T.close, 'unzoom'));
    dg.appendChild(acts);
    dg.addEventListener('click', function (e) { if (e.target === dg) shut(dg); });
    (slot.querySelector('.crs') || slot).appendChild(dg);
    st.zoom = dg;
    if (typeof dg.showModal === 'function') dg.showModal(); else dg.setAttribute('open', '');
  }
  function shut(dg) {
    if (!dg) return;
    if (typeof dg.close === 'function' && dg.open) dg.close(); else dg.removeAttribute('open');
  }

  // ══ 写真を送る前に、端末で描き直す ═══════════════════════════
  /* キャンバスに描いて JPEG に書き出す ＝ 画素だけが残る。サーバーも同じことをもう1回する（二重）。 */
  var IMG_MAX  = 500000;                        // ★db/stays.sql の写真の上限と同じ数
  var IMG_EDGE = 1568;
  var IMG_Q    = [0.86, 0.72, 0.6, 0.48, 0.36];

  function toB64(blob) {
    return new Promise(function (done, fail) {
      var fr = new FileReader();
      fr.onload = function () {
        var s = String(fr.result || ''), i = s.indexOf(',');
        done(i >= 0 ? s.slice(i + 1) : '');     /* data: の頭は落として渡す */
      };
      fr.onerror = function () { fail(new Error('type')); };
      fr.readAsDataURL(blob);
    });
  }
  /* 上限に収まるまで画質を1段ずつ落とす。 */
  function encodeAt(cv, i) {
    return new Promise(function (done, fail) {
      cv.toBlob(function (b) {
        if (!b) { fail(new Error('type')); return; }
        if (b.size <= IMG_MAX || i >= IMG_Q.length - 1) { done(b); return; }
        encodeAt(cv, i + 1).then(done, fail);
      }, 'image/jpeg', IMG_Q[i]);
    });
  }
  /* → { blob, b64, w, h }。読めない＝Error('type')・縮めても大きい＝Error('big')。 */
  function shrink(file) {
    return new Promise(function (done, fail) {
      if (!file || String(file.type || '').indexOf('image/') !== 0) { fail(new Error('type')); return; }
      var url = w.URL.createObjectURL(file);
      var im  = new Image();
      im.onerror = function () { w.URL.revokeObjectURL(url); fail(new Error('type')); };
      im.onload = function () {
        w.URL.revokeObjectURL(url);
        var iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
        if (!iw || !ih) { fail(new Error('type')); return; }
        var k  = Math.min(1, IMG_EDGE / Math.max(iw, ih));
        var cw = Math.max(1, Math.round(iw * k)), ch = Math.max(1, Math.round(ih * k));
        var cv = d.createElement('canvas');
        cv.width = cw; cv.height = ch;
        var cx = cv.getContext ? cv.getContext('2d') : null;
        if (!cx) { fail(new Error('type')); return; }
        cx.fillStyle = 'white';                 /* 透過の絵を JPEG にすると、抜けた所が黒く潰れる */
        cx.fillRect(0, 0, cw, ch);
        cx.drawImage(im, 0, 0, cw, ch);
        encodeAt(cv, 0).then(function (b) {
          if (b.size > IMG_MAX) throw new Error('big');
          return toB64(b).then(function (b64) {
            if (!b64) throw new Error('type');
            done({ blob: b, b64: b64, w: cw, h: ch });
          });
        }).then(null, fail);
      };
      im.src = url;
    });
  }
  function shrinkSay(e) {
    return (e && e.message === 'big') ? SAY_PHOTO.image_too_big : SAY_PHOTO.image_bad;
  }
  function sendPhoto(place, pic) {
    return rpc('pv_stay_photo_add', { place: place, b64: pic.b64, w: pic.w, h: pic.h });
  }

  // ══ 欄の外の面 ═════════════════════════════════════════════
  /* 欄（.crl）は「サーバーがこの人に見せてよいもの」だけ。入口・一言・追加の面は、欄のすぐ後ろの兄弟（.crs-zone）に置く。
     読み出しを始めた時（待ちの絵と同時）に作るので、入口はどの状態でも最初からそこに在る（返事のあとで下に湧かない）。
     欄を描き直しても、開いている追加の面は消えない。 */
  function zoneIf(slot) {
    var z = slot.nextElementSibling;
    return z && z.classList.contains('crs-zone') ? z : null;
  }
  function zoneOf(slot) {
    var z = zoneIf(slot);
    if (z) return z;
    z = el('div', 'crs-zone');
    /* 追加の面の置き場は、自分の分の列より上（P12.54：確認待ちを何件も足した人でも、開いた面が列の下に沈まない）。
       閉じているあいだは空で、場所を取らない（.crs-formbox:empty）── 自分の分・入口・一言の並びは今までどおり。 */
    z.appendChild(el('div', 'crs-formbox'));
    var own = el('ul', 'crs-list crs-own');
    own.hidden = true;
    z.appendChild(own);
    var ents = el('div', 'crs-ents');
    ENTS.forEach(function (k, i) {
      var b = btn((i === 0 ? 'crs-btn' : 'crs-act') + ' crs-ent', null, 'ent');
      b.setAttribute('data-kind', k[0]);
      b.setAttribute('aria-expanded', 'false');
      b.appendChild(icon('plus'));
      b.appendChild(el('span', '', k[1]));
      ents.appendChild(b);
    });
    z.appendChild(ents);
    var zs = el('p', 'crs-say crs-zone-say');
    zs.setAttribute('role', 'status');
    zs.setAttribute('aria-live', 'polite');
    z.appendChild(zs);
    slot.parentNode.insertBefore(z, slot.nextSibling);
    bindOn(z, slot);
    return z;
  }
  function zsay(slot, text) {
    var zs = zoneOf(slot).querySelector('.crs-zone-say');
    if (zs) zs.textContent = text || '';
  }
  /* 欄の外で開いている追加の面（無ければ null）。 */
  function zoneForm(slot) {
    var z = zoneIf(slot);
    return z ? z.querySelector('.crs-formbox > .crs-form') : null;
  }
  /* 欄の状態が変わるたびに呼ぶ（put）。都市が変わったら、開いていた追加の面を閉じ（打った字は下書きに在る）、一言を消す。
     自分が足したもの（見てよい人ではない人への返事の own）は、欄の外の列にだけ描く（欄の中は鍵の1行のまま）。 */
  function paintZone(slot, st, v) {
    var z = zoneOf(slot);
    if (z.getAttribute('data-for') !== st.key) {
      z.setAttribute('data-for', st.key);
      var f = zoneForm(slot);
      if (f) closeForm(slot, st, f, true);
      zsay(slot, '');
    }
    var own = v && v.state === 'locked' ? arr(v.own) : [];
    var ul = z.querySelector('.crs-own');
    if (ul) {
      while (ul.firstChild) ul.removeChild(ul.firstChild);
      own.forEach(function (it) {
        if (it && typeof it === 'object') ul.appendChild(card(slot, st, it, { city: cityOf(slot), canAdd: false, isOp: false, own: true }));
      });
      ul.hidden = !ul.firstChild;
    }
    restoreDraft(slot);
  }
  /* 入口を押した。つながっていない・この会社に足せない時は一言だけ（面は開かない ＝ 保存できないものを打たせない）。 */
  function pressEnt(slot, st, b) {
    var c = CACHE[st.key];
    if (slot.getAttribute('data-state') === 'off') { zsay(slot, T.off); return; }                   /* つながっていない：面は開かない */
    if (c && c.state === 'open' && c.can_add !== true) { zsay(slot, SAY_ADD.bad_airline); return; }   /* この会社には、いま足せない */
    zsay(slot, '');
    openForm(slot, st, b, null, { kind: b.getAttribute('data-kind') });
  }

  // ══ 追加の面 ═══════════════════════════════════════════════
  var SEQ = 0;
  function field(label, node, id) {
    var f = el('div', 'crs-f');
    var lb = el('label', 'crs-lb', label);
    lb.htmlFor = id;
    node.id = id;
    f.appendChild(lb);
    f.appendChild(node);
    return f;
  }
  function input(type, max, extra) {
    var i = d.createElement(type === 'area' ? 'textarea' : 'input');
    if (type !== 'area') i.type = type;
    i.className = 'crs-in';
    i.maxLength = max;
    i.autocomplete = 'off';
    if (extra) Object.keys(extra).forEach(function (k) { i.setAttribute(k, extra[k]); });
    return i;
  }

  /* ステイ時間の欄はホテルのときだけ出す（ほかの種別ではサーバーも読まない）。 */
  function syncKind(form) {
    var kr = form.querySelector('input[type="radio"]:checked');
    var hf = form.querySelector('.crs-hf');
    if (hf) hf.hidden = !(kr && kr.value === 'hotel');
  }

  /* it を渡すと「修正」の面（★本人のものだけ。今の中身を入れて開く。写真はここでは足さない）。
     it が無ければ追加の面（欄の外の面の中に開く）。pre ＝ 選んでおく種類（kind）と、入れておく字（name・address・maps_url・stay_hours・note）。 */
  function openForm(slot, st, opener, it, pre) {
    var zone = it ? null : zoneOf(slot), host = it ? opener.closest('.crs-card') : zone.querySelector('.crs-formbox');
    if (!host || host.querySelector('.crs-form')) return;
    var n = ++SEQ, idp = 'crs-f' + n + '-';
    var form = el('form', 'crs-form');
    form.noValidate = true;
    form.__opener = opener;
    if (it) form.__edit = str(it.id);

    /* 追加の面の頭：どの会社・どの都市・どの空港に足すのか（ここでは選び直させない）。 */
    if (!it) {
      var code = st.key.split('|')[0];
      var cx = el('p', 'crs-ctx'), cn = el('span', '', code);
      airlineName(code).then(function (nm) { cn.textContent = nm; });
      cx.appendChild(cn);
      cx.appendChild(el('span', '', cityOf(slot)));
      cx.appendChild(el('span', 'crs-ctx-code', st.key.split('|')[1]));
      form.appendChild(cx);
    }

    var fs = el('fieldset', 'crs-f crs-kinds');
    fs.appendChild(el('legend', 'crs-lb', T.fKind));
    var seg = el('div', 'crs-seg');
    KINDS.forEach(function (k) {
      var lb = el('label', 'crs-seg-i');
      var r = d.createElement('input');
      r.type = 'radio'; r.name = idp + 'kind'; r.value = k[0];
      if (it ? k[0] === it.kind : k[0] === ((pre && pre.kind) || 'hotel')) r.checked = true;
      lb.appendChild(r);
      lb.appendChild(el('span', '', k[1]));
      seg.appendChild(lb);
    });
    fs.appendChild(seg);
    form.appendChild(fs);

    form.appendChild(field(T.fName, input('text', 80, { 'data-k': 'name', required: '' }), idp + 'name'));
    form.appendChild(field(T.fAddr, input('text', 200, { 'data-k': 'address' }), idp + 'addr'));
    form.appendChild(field(T.fMap, input('url', 500,
      { 'data-k': 'maps_url', inputmode: 'url', placeholder: 'https://maps.app.goo.gl/…' }), idp + 'map'));
    var hf = field(T.fHours, input('text', 3,
      { 'data-k': 'stay_hours', inputmode: 'numeric', pattern: '[0-9]*', 'aria-describedby': idp + 'hours-u' }), idp + 'hours');
    hf.className += ' crs-hf';
    var hu = el('span', 'crs-unit', T.fHoursU);
    hu.id = idp + 'hours-u';
    var hrow = el('div', 'crs-hrow');
    hrow.appendChild(hf.lastChild);
    hrow.appendChild(hu);
    hf.appendChild(hrow);
    form.appendChild(hf);
    form.appendChild(field(T.fNote, input('area', 500, { 'data-k': 'note', rows: '3' }), idp + 'note'));

    var put1 = function (k, v) { var i = form.querySelector('[data-k="' + k + '"]'); if (i) i.value = str(v); };
    var c0 = CACHE[st.key];
    if (it) {
      put1('name', it.name);
      put1('address', it.address);
      put1('maps_url', mapsOk(it.maps_url));
      put1('note', it.note);
      var h0 = it.kind === 'hotel' ? int(it.stay_hours) : 0;
      put1('stay_hours', h0 >= 1 && h0 <= 240 ? String(h0) : '');
    } else {
      /* 入れておく字（字だけ。ほかの形のものは入れない）。 */
      if (pre) ['name', 'address', 'maps_url', 'stay_hours', 'note'].forEach(function (k) {
        if (typeof pre[k] === 'string') { var i = form.querySelector('[data-k="' + k + '"]'); if (i) i.value = pre[k]; }
      });
    }
    /* 写真を足せるのは、見てよい人（オーナーと、オーナーが承認した人）だけ ＝ 一覧が開いていて、足せる会社の時だけ欄を作る。 */
    if (!it && c0 && c0.state === 'open' && c0.can_add === true) {
      var pf = el('div', 'crs-f crs-pf');
      pf.appendChild(el('span', 'crs-lb', T.fPhoto));
      var prow = el('div', 'crs-prow');
      var lb = el('label', 'crs-act crs-file');
      lb.appendChild(el('span', '', T.pick));
      var fi = d.createElement('input');
      fi.type = 'file'; fi.accept = 'image/*'; fi.className = 'crs-file-in';
      fi.setAttribute('data-pick', '1');
      lb.appendChild(fi);
      prow.appendChild(lb);
      pf.appendChild(prow);
      form.appendChild(pf);
    }
    syncKind(form);

    var fsay = el('p', 'crs-say crs-form-say');
    fsay.setAttribute('role', 'status');
    fsay.setAttribute('aria-live', 'polite');
    form.appendChild(fsay);

    var end = el('div', 'crs-end');
    var go = el('button', 'crs-btn', it ? T.editSend : T.send);
    go.type = 'submit';
    end.appendChild(go);
    end.appendChild(btn('crs-act', T.cancel, 'unform'));
    form.appendChild(end);

    host.appendChild(form);
    if (it) {
      opener.setAttribute('aria-expanded', 'true');
      opener.hidden = true;
      say(slot, '');
    } else {
      if (loggedIn()) FORM_IN = true;
      /* 追加の面が開いているあいだ、入口の列は隠す（閉じると戻る）。 */
      zone.querySelector('.crs-ents').hidden = true;
      if (opener) opener.setAttribute('aria-expanded', 'true');
      zsay(slot, '');
    }
    /* 押して開いた時だけ、名前の欄へ移る（下書きから戻した面は、焦点を取らない）。 */
    var first = form.querySelector('[data-k="name"]');
    if (first && opener) first.focus();
  }

  function unpick(st, form) {
    if (st.pick && st.pick.url) w.URL.revokeObjectURL(st.pick.url);
    st.pick = null;
    if (!form) return;
    var pv = form.querySelector('.crs-pv');
    if (pv) pv.parentNode.removeChild(pv);
    var fi = form.querySelector('[data-pick]');
    if (fi) fi.value = '';
  }
  /* quiet ＝ 焦点を入口へ戻さない（都市が変わって閉じる時）。 */
  function closeForm(slot, st, form, quiet) {
    /* 選んだ写真を持っているのは追加の面だけ。修正の面を閉じても、開いたままの追加の面の写真は手放さない。 */
    if (form.querySelector('[data-pick]')) unpick(st, form);
    var host = form.parentNode, zone = host.classList.contains('crs-formbox') ? host.parentNode : null;
    var opener = form.__opener || (zone ? zone.querySelector('.crs-ent') : null);
    host.removeChild(form);
    if (zone) {
      FORM_IN = false;
      var row = zone.querySelector('.crs-ents');
      row.hidden = false;
      [].forEach.call(row.querySelectorAll('.crs-ent'), function (b) { b.setAttribute('aria-expanded', 'false'); });
    } else if (opener) { opener.hidden = false; opener.setAttribute('aria-expanded', 'false'); }
    if (opener && !quiet) opener.focus();
  }

  /* 追加の面で写真を選んだ。描き直したものを見せる（＝送られるのはこの絵）。 */
  function picked(slot, st, fi) {
    var form = fi.closest('.crs-form'), file = fi.files && fi.files[0];
    if (!form || !file) return;
    fsay(form, '');
    shrink(file).then(function (pic) {
      if (ST.get(slot) !== st || !form.parentNode) return;
      unpick(st, form);
      pic.url = w.URL.createObjectURL(pic.blob);
      st.pick = pic;
      var pv = el('div', 'crs-pv');
      var im = d.createElement('img');
      im.alt = '';
      im.width = pic.w; im.height = pic.h;
      im.src = pic.url;
      pv.appendChild(im);
      pv.appendChild(btn('crs-act', T.unpick, 'unpick'));
      form.querySelector('.crs-prow').appendChild(pv);
    }, function (e) {
      if (ST.get(slot) !== st || !form.parentNode) return;
      unpick(st, form);
      fsay(form, shrinkSay(e));
    });
  }

  function busy(slot, st, on) {
    st.busy = on;
    var box = slot.querySelector('.crs');
    if (box) { if (on) box.setAttribute('data-busy', '1'); else box.removeAttribute('data-busy'); }
    var z = zoneIf(slot);
    if (z) { if (on) z.setAttribute('data-busy', '1'); else z.removeAttribute('data-busy'); }
  }

  function submit(slot, st, form) {
    if (st.busy) return;
    function val(k) { var i = form.querySelector('[data-k="' + k + '"]'); return i ? str(i.value) : ''; }
    var kr = form.querySelector('input[type="radio"]:checked');
    var kind = kr ? kr.value : '', name = val('name'), url = val('maps_url');
    if (!kind) { fsay(form, T.needKind); return; }
    if (name.length < 2 || name.length > 80) { fsay(form, T.needName); return; }
    if (url && !mapsOk(url)) { fsay(form, T.badMap); return; }
    /* ステイ時間（任意・ホテルだけ）。★検品の正はサーバー。ここは打ち間違いを送る前に返すだけ。 */
    var hraw = kind === 'hotel' ? val('stay_hours').replace(/[０-９]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
    }) : '';
    var hours = null;
    if (hraw) {
      if (!/^[0-9]{1,3}$/.test(hraw) || +hraw < 1 || +hraw > 240) { fsay(form, T.badHours); return; }
      hours = +hraw;
    }

    var k = st.key.split('|'), pic = form.__edit ? null : st.pick;
    busy(slot, st, true);
    fsay(form, T.sending);

    if (form.__edit) {
      /* 直す。会社と空港は送らない（＝変わらない）。直したら確認待ちへ戻る。 */
      rpc('pv_stay_update', withKey({
        id: form.__edit, kind: kind, name: name,
        address: val('address') || null, maps_url: url || null, note: val('note') || null,
        stay_hours: hours
      })).then(function (v) {
        if (ST.get(slot) !== st) return;
        if (bad(v)) {
          if (v && v.status === 'locked') { load(slot, { fresh: true }); return; }
          busy(slot, st, false);
          fsay(form, (v && (SAY_EDIT[v.status] || SAY_ADD[v.status])) || SAY_FAIL);
          return;
        }
        load(slot, { fresh: true, say: v.changed === true ? T.edited : T.same });
      });
      return;
    }

    rpc('pv_stay_add', withKey({
      airline: k[0], iata: k[1], kind: kind, name: name,
      address: val('address') || null, maps_url: url || null, note: val('note') || null,
      city: cityOf(slot), stay_hours: hours
    })).then(function (v) {
      if (ST.get(slot) !== st) return;
      if (bad(v)) {
        /* 面は欄の外に在って描き直されないので、「送信中…」のまま残さない。 */
        if (v && v.status === 'locked') { busy(slot, st, false); fsay(form, SAY_FAIL); load(slot, { fresh: true }); return; }   /* 資格が変わった */
        busy(slot, st, false);
        fsay(form, (v && SAY_ADD[v.status]) || SAY_FAIL);
        return;
      }
      var id = v.item && str(v.item.id);
      /* ログインせずに足した人には、サーバーが控えの鍵を返す（この端末だけに置く。自分の分を見る・直す・消すのに使う）。 */
      if (typeof v.key === 'string' && /^[0-9a-f]{48}$/.test(v.key)) lset(KEY, v.key);
      /* 面は欄の外に在るので、読み直しでは消えない。閉じて、押した入口へ焦点を戻す（pic は字のまま持っている）。下書きはもう要らない。 */
      busy(slot, st, false);
      dropDraft(st.key);
      closeForm(slot, st, form);
      if (!pic || !id) { load(slot, { fresh: true, say: T.added }); return; }
      return sendPhoto(id, pic).then(function (pv) {
        if (ST.get(slot) !== st) return;
        /* 場所はもう入っている。写真だけ駄目だったときは、そのことを分けて言う。 */
        load(slot, { fresh: true,
          say: bad(pv) ? T.addedBut + ((pv && SAY_PHOTO[pv.status]) || SAY_FAIL) : T.added });
      });
    });
  }

  /* 既に在る場所に写真を足す。 */
  function addPhoto(slot, st, fi) {
    var place = fi.getAttribute('data-place'), file = fi.files && fi.files[0];
    if (!place || !file || st.busy) { fi.value = ''; return; }
    busy(slot, st, true);
    say(slot, T.sending);
    shrink(file).then(function (pic) {
      return sendPhoto(place, pic).then(function (v) {
        if (ST.get(slot) !== st) return;
        if (bad(v)) {
          if (v && v.status === 'locked') { load(slot, { fresh: true }); return; }
          busy(slot, st, false);
          fi.value = '';
          say(slot, (v && SAY_PHOTO[v.status]) || SAY_FAIL);
          return;
        }
        load(slot, { fresh: true, say: T.photoDone });
      });
    }, function (e) {
      if (ST.get(slot) !== st) return;
      busy(slot, st, false);
      fi.value = '';
      say(slot, shrinkSay(e));
    });
  }

  /* 公開のときだけ、ボタンが持っている印（rev）を添える。却下は中身に関係なく通る。 */
  function modArgs(target, id, act, rev) {
    var a = { target: target, id: id, state: act === 'pub' ? 'public' : 'rejected' };
    if (act === 'pub' && target === 'place' && rev) a.rev = rev;
    return a;
  }

  /* 公開／却下／削除。終わったら必ず取り直す（画面で行を書き換えない）。 */
  function moderate(slot, st, b, act) {
    if (st.busy) return;
    var target = b.getAttribute('data-target'), id = b.getAttribute('data-id');
    if ((target !== 'place' && target !== 'photo') || !id) return;
    busy(slot, st, true);
    var q = act === 'del'
      ? rpc('pv_stay_delete', withKey({ target: target, id: id }))
      : rpc('pv_stay_moderate', modArgs(target, id, act, b.getAttribute('data-rev')));
    q.then(function (v) {
      if (ST.get(slot) !== st) return;
      if (bad(v)) {
        if (v && v.status === 'locked') { load(slot, { fresh: true }); return; }
        /* 見ているあいだに本人が直した ＝ 古い中身のまま公開しない。いまの中身を取り直して見せる。 */
        if (v && v.status === 'changed') { shut(st.zoom); load(slot, { fresh: true, say: SAY_MOD.changed }); return; }
        busy(slot, st, false);
        shut(st.zoom);
        say(slot, (v && SAY_MOD[v.status]) || SAY_FAIL);
        return;
      }
      load(slot, { fresh: true, say: act === 'del' ? T.delDone : act === 'pub' ? T.pubDone : T.rejDone });
    });
  }

  /* 削除は2回押す（1回目で「削除する／やめる」に変わる）。 */
  function arm(b) {
    b.setAttribute('data-sure', '1');
    b.textContent = T.delSure;
    var c = btn('crs-act', T.cancel, 'unsure');
    b.parentNode.insertBefore(c, b.nextSibling);
    c.focus();
  }
  function disarm(c) {
    var b = c.previousSibling;
    c.parentNode.removeChild(c);
    if (b && b.getAttribute) { b.removeAttribute('data-sure'); b.textContent = T.del; b.focus(); }
  }

  // ══ 書きかけ（このタブだけ）══════════════════════════════════
  /* ログインの往復（「ログイン」→ 戻る）・戻る・読み直しでも、打った字が消えない（最後に打ってから30分まで）。
     ★書きかけは打った人のもの：打った人の印（u。ログインしていなければ ''）と打った時刻（at）を一緒に置く。
       戻すのは、いまの相手と同じ印のものだけ。別の会員がログインしたら、前の人の分は戻さずに消す。
       ログインが知らせなく切れた（ログインしていない今）だけなら、会員の分は出さずに置いておく（同じ人が戻れば30分のうちは戻る）。
       ログインせずに打った字は、ログインした人のものになる（その印を付け直す ＝ その次の人へは渡らない）。
       30分を過ぎたもの・時刻の無い前の形のものは、ページを開いた時と読む時に消す。サイトの「ログアウト」はこのタブの分を全部消す。 */
  var DRAFT = 'pv_stay_draft:';     // 書きかけ（このタブだけ。打った字と、打った人の印と時刻だけ。サーバーの答えは置かない）
  var DRAFT_MS = 30 * 60 * 1000;    // 書きかけを持つのは、最後に打ってから30分まで
  var FORM_IN = false;              // ログインの鍵が在るあいだに開いた追加の面が、まだ開いている
  var DRAFT_MAX = { name: 80, address: 200, maps_url: 500, stay_hours: 3, note: 500 };   // 欄の maxlength と同じ数
  function sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { sessionStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function sdel(k) { try { sessionStorage.removeItem(k); } catch (e) { /* 消せなくても先へ */ } }
  /* いまの相手。'' ＝ ログインしていない／文字列 ＝ その人／undefined ＝ まだ分からない（鍵は在るが、相手の知らせがまだ）。
     覚えている相手が居ても、この端末にログインの鍵がもう無ければ ''（知らせの届かないログアウト・戻るで戻ってきた画面）。 */
  function me() {
    if (typeof UID === 'string') return loggedIn() ? UID : '';
    return (UID === null || !loggedIn()) ? '' : undefined;
  }
  /* 最後に打ってから30分以内か（時刻の無い前の形は、過ぎたものとして扱う） */
  function fresh(o) { var a = typeof o.at === 'number' ? Date.now() - o.at : NaN; return a >= -60000 && a <= DRAFT_MS; }
  function eachDraft(fn) {
    var keys = [];
    try { for (var i = 0; i < sessionStorage.length; i++) { var k = sessionStorage.key(i); if (k && k.indexOf(DRAFT) === 0) keys.push(k); } }
    catch (e) { return; }
    keys.forEach(function (k) {
      var o = null;
      try { o = JSON.parse(sget(k)); } catch (e) { o = null; }
      if (!o || typeof o !== 'object' || Array.isArray(o) || !fresh(o)) { sdel(k); return; }
      fn(k, o);
    });
  }
  /* いまの相手に合わせる。相手がまだ分からなければ何もしない（false）。 */
  function settleDrafts() {
    var cur = me();
    if (cur === undefined) return false;
    eachDraft(function (k, o) {
      var u = typeof o.u === 'string' ? o.u : '';
      if (u && cur && u !== cur) sdel(k);                             /* ★別の会員が打った字（前の人のもの） */
      else if (!u && cur) { o.u = cur; sset(k, JSON.stringify(o)); }  /* ★ログインせずに打った字は、ログインした人のものになる */
    });
    return true;
  }
  function saveDraft(key, form) {
    function val(k) { var i = form.querySelector('[data-k="' + k + '"]'); return i ? String(i.value || '').slice(0, DRAFT_MAX[k]) : ''; }
    var kr = form.querySelector('input[type="radio"]:checked');
    sset(DRAFT + key, JSON.stringify({ v: 1, u: typeof UID === 'string' ? UID : '', at: Date.now(), kind: kr ? String(kr.value) : '',
      name: val('name'), address: val('address'), maps_url: val('maps_url'), stay_hours: val('stay_hours'), note: val('note') }));
  }
  /* 置いてある字（字だけ）。無い・30分を過ぎた・いまの相手の分でない・字が1つも無ければ null。 */
  function readDraft(key) {
    var o = null;
    try { o = JSON.parse(sget(DRAFT + key)); } catch (e) { o = null; }
    if (!o || typeof o !== 'object') return null;
    if (!fresh(o)) { sdel(DRAFT + key); return null; }
    if (typeof o.u === 'string' && o.u && o.u !== me()) return null;   /* 会員の分を、ログインしていない今は出さない（置いたまま） */
    var d0 = {}, any = false;
    Object.keys(DRAFT_MAX).forEach(function (k) {
      var s = typeof o[k] === 'string' ? o[k].slice(0, DRAFT_MAX[k]) : '';
      d0[k] = s;
      if (/\S/.test(s)) any = true;
    });
    if (!any) return null;
    if (KINDS.some(function (k) { return k[0] === o.kind; })) d0.kind = o.kind;
    return d0;
  }
  function dropDraft(key) { sdel(DRAFT + key); }
  /* 開いている追加の面を全部閉じる（打った字も画面から消える）。 */
  function closeAdds() {
    slots().forEach(function (s) {
      var f = zoneForm(s);
      if (f) closeForm(s, ST.get(s) || { pick: null }, f, true);
    });
    FORM_IN = false;
  }
  /* その都市の書きかけを、追加の面に戻す（焦点は取らない）。都市の答えが決まってから ── 待っているあいだ・
     つながっていない・この会社には足せない時は戻さない（入口を押した時と同じく、保存できないものを打たせない）。 */
  function restoreDraft(slot) {
    var st = ST.get(slot), z = zoneIf(slot);
    if (!st || !z || zoneForm(slot)) return;
    var s = slot.getAttribute('data-state');
    if (s === 'off' || s === 'loading' || s === 'idle') return;
    var c = CACHE[st.key];
    if (c && c.state === 'open' && c.can_add !== true) return;
    if (!settleDrafts()) return;
    var d0 = readDraft(st.key);
    if (d0) openForm(slot, st, null, null, d0);
  }

  // ══ 押されたとき（欄と、欄の外の面に、1回ずつだけ結ぶ）═══════════
  function bindOn(node, slot) {
    if (node.__crsBound) return;
    node.__crsBound = true;
    node.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      var st = ST.get(slot);
      if (!b || !st || !node.contains(b)) return;
      var act = b.getAttribute('data-act');
      if (act === 'retry')       { delete CACHE[st.key]; load(slot, { fresh: true }); }
      else if (act === 'ent')    pressEnt(slot, st, b);
      else if (act === 'edit')   { if (b.__crsItem) openForm(slot, st, b, b.__crsItem); }
      else if (act === 'unform') {
        var uf = b.closest('.crs-form');
        if (uf && !uf.__edit) dropDraft(st.key);   /* 追加の面の「やめる」＝ 書きかけも捨てる */
        closeForm(slot, st, uf);
      }
      else if (act === 'unpick') unpick(st, b.closest('.crs-form'));
      else if (act === 'zoom')   zoom(slot, st, b);
      else if (act === 'unzoom') shut(st.zoom);
      else if (act === 'unsure') disarm(b);
      else if (act === 'del')    { if (b.getAttribute('data-sure')) moderate(slot, st, b, 'del'); else arm(b); }
      else if (act === 'pub' || act === 'rej') moderate(slot, st, b, act);
    });
    node.addEventListener('change', function (e) {
      var fi = e.target, st = ST.get(slot);
      if (fi && fi.type === 'radio' && fi.closest('.crs-form')) { syncKind(fi.closest('.crs-form')); return; }
      if (!st || !fi || fi.type !== 'file') return;
      if (fi.getAttribute('data-pick')) picked(slot, st, fi);
      else if (fi.getAttribute('data-place')) addPhoto(slot, st, fi);
    });
    node.addEventListener('submit', function (e) {
      var st = ST.get(slot);
      e.preventDefault();
      if (st && e.target && e.target.classList.contains('crs-form')) submit(slot, st, e.target);
    });
    /* 欄の外の面だけ：追加の面に打つたびに、書きかけを置く（修正の面は置かない・写真は置かない）。 */
    if (node.classList && node.classList.contains('crs-zone')) {
      var keep = function (e) {
        var t = e.target, f = t && t.closest ? t.closest('.crs-formbox > .crs-form') : null, st = ST.get(slot);
        if (!f || f.__edit || !st || t.type === 'file' || node.getAttribute('data-for') !== st.key) return;
        saveDraft(st.key, f);
      };
      node.addEventListener('input', keep);
      node.addEventListener('change', keep);
    }
  }

  // ══ 始める ═════════════════════════════════════════════════
  /* career.js が画面を出し終えるたびに #cr で cr:show を投げる。
     このファイルより先に1回目が出ていることがあるので、読み込まれた時点でも1回見る。 */
  d.addEventListener('cr:show', function () { scan(); }, true);
  /* 30分を過ぎた・時刻の無い書きかけは、ページを開いた所で消す（誰の分かは、相手が分かった所で settleDrafts が見る）。 */
  eachDraft(function () {});
  /* 読み終えた時に、もう一度だけ見る（口がまだ無い欄を「読み込めませんでした」で終わらせる）。 */
  w.addEventListener('load', function () { LOADED = true; scan(); });
  w.addEventListener('pagehide', function () {
    LIVE.forEach(function (s) { revoke(ST.get(s)); });
  });
  /* 戻る・進むで、手放したあとの画面がそのまま戻ってきたとき（写真の URL はもう無い）。
     離れているあいだにログインが変わっているかもしれないので、持っている答えも使い回さない。 */
  w.addEventListener('pageshow', function (e) {
    if (e.persisted) { CACHE = {}; LIVE.slice().forEach(drop); scan(); }
  });
  /* ほかの画面から戻ってきたとき、鍵が消えていたら取り直す（消えていなければ何もしない＝通信もしない）。 */
  d.addEventListener('visibilitychange', function () {
    if (d.visibilityState === 'visible' && forgetIfGone()) scan();
  });
  /* 画面を出したままのあいだに鍵が消えることもある ── ほかの窓が消した（storage が知らせる）・
     この画面の中で期限が切れた（pv-session.js の見回りが鍵だけを消す。知らせは来ないので、こちらも見回る）。
     開いた答えを持っていなければ何もしない。持っていても、鍵が在るかを読むだけ＝通信はしない。 */
  function recheck() { if (forgetIfGone()) scan(); }
  w.addEventListener('storage', recheck);
  w.setInterval(recheck, 60000);
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', scan);
  else scan();
})(window, document);
