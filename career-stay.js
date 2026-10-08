/* career-stay.js — 就航地の画面の「ホテル」の欄（data-live="hotels"）を埋める。
 *
 * ・開けるかどうかは**サーバーが返した state だけ**で決める（locked／open）。
 *   画面でプロフィール・給与の鍵・ブラウザの保存領域を見て開けない。
 * ・Supabase の入口は PVCareer.client()（career-live.js が作る）。ここで createClient しない。
 *   まだ無ければ欄に触らず、cr:show のたびに見直す（error にしない）。
 * ・取ってきた字は全部 textContent。リンクは https の Google マップだけ（ほかは検索のリンクに置き換える）。
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

  var T = {
    off:        '準備中です',
    locked:     '確認済みのパイロットだけが見られます',
    err:        '読み込めませんでした',
    retry:      'もう一度',
    none:       'まだ登録がありません',
    emptyT:     '泊まったホテルを、次のパイロットへ。',
    emptyS:     'ホテルの名前だけでも追加できます。確認のあと公開されます。',
    hours:      function (n) { return 'ステイ 約' + n + '時間'; },
    pending:    '確認待ち',
    rejected:   '見送り',
    map:        'Google マップ',
    others:     '同じ空港で他社が使うホテル',
    addOpen:    'ホテル・店・場所を追加',
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
    pub:        '公開',
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
    exists:       '同じ名前が、もう登録されています。'
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
    changed:   '出した人が内容を直していました。いまの内容を読み直したので、確認してからもう一度押してください。'
  };
  var SAY_FAIL = 'うまくいきませんでした。もう一度お試しください。';

  var KINDS = [['hotel', 'ホテル'], ['food', 'レストラン'], ['spot', '場所']];

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
  function rpc(name, args) {
    return client().then(function (c) {
      return Promise.resolve(c.rpc(name, { p: args })).then(function (r) {
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
        if (UID === undefined && ev === 'INITIAL_SESSION') { UID = uid; return; }
        if (UID !== undefined && uid === UID) return;
        UID = uid;
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
    while (slot.firstChild) slot.removeChild(slot.firstChild);
    if (node) slot.appendChild(node);
    slot.setAttribute('data-state', state);
    if (state === 'loading') slot.setAttribute('aria-busy', 'true');
    else slot.removeAttribute('aria-busy');
  }
  /* 画面から外れた欄は、出荷時の形（—）に戻す。 */
  function drop(slot) {
    revoke(ST.get(slot));
    ST.delete(slot);
    var i = LIVE.indexOf(slot);
    if (i >= 0) LIVE.splice(i, 1);
    put(slot, 'idle', el('span', 'crl-ph', '—'));
  }

  /* 開いた答えを持ったまま、この端末のログインの鍵が消えていたら、持っている答えを捨てる。
     ふつうは onAuthStateChange が先に来る（watchAuth）。届かない消え方 ── ほかの画面が鍵だけを
     消した・期限が切れた ── でも、開いていたときのホテル名と写真を画面に残さないための2つ目の網。
     ⚠️ 鍵が「在る」ことは何の資格にもしない。見てよいかどうかを決めるのは、いつもサーバーの答えだけ。 */
  function keyGone() {
    try { return !!(w.PVSession && typeof w.PVSession.hasToken === 'function' && !w.PVSession.hasToken()); }
    catch (e) { return false; }
  }
  function holdsOpen() {
    for (var k in CACHE) if (CACHE[k] && CACHE[k].state === 'open') return true;
    return false;
  }
  function forgetIfGone() {
    if (!holdsOpen() || !keyGone()) return false;
    CACHE = {};
    LIVE.slice().forEach(drop);
    /* 鍵が消えたことは onAuthStateChange には届いていない。覚えている相手も一緒に忘れる
       （忘れないと、同じ人がほかのタブでログインし直したとき「相手は変わっていない」と読んで取り直さない）。 */
    if (UID !== undefined) UID = null;
    return true;
  }

  function scan() {
    forgetIfGone();
    LIVE.slice().forEach(function (s) { if (!shown(s)) drop(s); });
    if (!hasClient()) return;                 /* まだ無い。次の cr:show で見直す */
    slots().forEach(function (s) {
      if (!shown(s)) return;
      var st = ST.get(s), key = keyOf(s);
      /* 会社ページは1つの欄を都市ごとに使い回す（data-stay を書き換えてから cr:show が来る）。 */
      if (!/\|[A-Z]{3}$/.test(key)) { if (st) drop(s); return; }   /* 空港がまだ決まっていない */
      if (!st || st.key !== key) load(s, {});
    });
  }

  function load(slot, opt) {
    bind(slot);
    revoke(ST.get(slot));
    var st = { key: keyOf(slot), urls: [], zoom: null, pick: null, busy: false };
    ST.set(slot, st);
    if (LIVE.indexOf(slot) < 0) LIVE.push(slot);

    /* 取り直すと決めた回は、前の答えを先に捨てる（取り直しに失敗したあと、出入りで古い答えを描き直さない） */
    if (opt.fresh) delete CACHE[st.key];
    else if (CACHE[st.key]) { paint(slot, st, CACHE[st.key], opt); return; }

    var sk = el('div', 'crs-skel');
    sk.appendChild(el('span', 'crs-skel-a'));
    sk.appendChild(el('span', 'crs-skel-b'));
    put(slot, 'loading', sk);

    var k = st.key.split('|');
    rpc('pv_stays', { airline: k[0], iata: k[1] }).then(function (v) {
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
      else if (bad(v) || (v.state !== 'locked' && v.state !== 'open')) { paintError(slot); return; }
      CACHE[st.key] = v;
      paint(slot, st, v, opt);
    });
  }

  // ══ 描く ═══════════════════════════════════════════════════
  function paint(slot, st, v, opt) {
    if (v.state === 'off') { put(slot, 'off', el('p', 'crs-line', T.off)); return; }
    if (v.state === 'locked') {
      /* ★鍵の印と1行だけ。名前・件数・写真・追加の入口は、そもそも届いていない。 */
      var lk = el('p', 'crs-line crs-lock');
      lk.appendChild(icon('lock'));
      lk.appendChild(el('span', '', T.locked));
      put(slot, 'locked', lk);
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

    if (canAdd) {
      var add = el('div', 'crs-add');
      var ab = btn('crs-btn crs-add-btn', null, 'form');
      ab.appendChild(icon('plus'));
      ab.appendChild(el('span', '', T.addOpen));
      ab.setAttribute('aria-expanded', 'false');
      add.appendChild(ab);
      (empty || box).appendChild(add);
    }

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
    if (it.state === 'pending') top.appendChild(el('span', 'crs-badge', T.pending));
    else if (it.state === 'rejected') top.appendChild(el('span', 'crs-badge crs-badge-no', T.rejected));
    li.appendChild(top);
    if (str(it.address)) li.appendChild(el('p', 'crs-addr', str(it.address)));
    /* ステイ時間はホテルだけ。書いていないホテルには何も出さない（0 で埋めない）。 */
    var hrs = it.kind === 'hotel' ? int(it.stay_hours) : 0;
    if (hrs >= 1 && hrs <= 240) li.appendChild(el('p', 'crs-hours', T.hours(hrs)));
    if (str(it.note)) li.appendChild(el('p', 'crs-note', str(it.note)));

    var phs = arr(it.photos).filter(function (p) { return p && str(p.id); });
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
    if (o.canAdd && it.mine === true && it.state !== 'rejected') {
      var eb = btn('crs-act', T.edit, 'edit');
      eb.setAttribute('aria-expanded', 'false');
      eb.__crsItem = it;
      acts.appendChild(eb);
    }
    modButtons(acts, 'place', id, it, o.isOp);
    li.appendChild(acts);
    return li;
  }

  /* 運営の公開／却下、本人と運営の削除。★出すかどうかはサーバーが返した印（is_operator・mine・state）だけ。 */
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
    if (it.mine === true || isOp) add(T.del, 'del', 'crs-act-no');
  }

  function say(slot, text) {
    var p = slot.querySelector('.crs-say');
    if (p) p.textContent = text || '';
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

  /* it を渡すと「修正」の面（★本人のものだけ。今の中身を入れて開く。写真はここでは足さない）。 */
  function openForm(slot, st, opener, it) {
    var host = it ? opener.closest('.crs-card') : opener.parentNode;
    if (!host || host.querySelector('.crs-form')) return;
    var n = ++SEQ, pre = 'crs-f' + n + '-';
    var form = el('form', 'crs-form');
    form.noValidate = true;
    form.__opener = opener;
    if (it) form.__edit = str(it.id);

    var fs = el('fieldset', 'crs-f crs-kinds');
    fs.appendChild(el('legend', 'crs-lb', T.fKind));
    var seg = el('div', 'crs-seg');
    KINDS.forEach(function (k, i) {
      var lb = el('label', 'crs-seg-i');
      var r = d.createElement('input');
      r.type = 'radio'; r.name = pre + 'kind'; r.value = k[0];
      if (it ? k[0] === it.kind : i === 0) r.checked = true;
      lb.appendChild(r);
      lb.appendChild(el('span', '', k[1]));
      seg.appendChild(lb);
    });
    fs.appendChild(seg);
    form.appendChild(fs);

    form.appendChild(field(T.fName, input('text', 80, { 'data-k': 'name', required: '' }), pre + 'name'));
    form.appendChild(field(T.fAddr, input('text', 200, { 'data-k': 'address' }), pre + 'addr'));
    form.appendChild(field(T.fMap, input('url', 500,
      { 'data-k': 'maps_url', inputmode: 'url', placeholder: 'https://maps.app.goo.gl/…' }), pre + 'map'));
    var hf = field(T.fHours, input('text', 3,
      { 'data-k': 'stay_hours', inputmode: 'numeric', pattern: '[0-9]*', 'aria-describedby': pre + 'hours-u' }), pre + 'hours');
    hf.className += ' crs-hf';
    var hu = el('span', 'crs-unit', T.fHoursU);
    hu.id = pre + 'hours-u';
    var hrow = el('div', 'crs-hrow');
    hrow.appendChild(hf.lastChild);
    hrow.appendChild(hu);
    hf.appendChild(hrow);
    form.appendChild(hf);
    form.appendChild(field(T.fNote, input('area', 500, { 'data-k': 'note', rows: '3' }), pre + 'note'));

    if (it) {
      var put1 = function (k, v) { var i = form.querySelector('[data-k="' + k + '"]'); if (i) i.value = str(v); };
      put1('name', it.name);
      put1('address', it.address);
      put1('maps_url', mapsOk(it.maps_url));
      put1('note', it.note);
      var h0 = it.kind === 'hotel' ? int(it.stay_hours) : 0;
      put1('stay_hours', h0 >= 1 && h0 <= 240 ? String(h0) : '');
    } else {
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
    opener.setAttribute('aria-expanded', 'true');
    opener.hidden = true;
    say(slot, '');
    var first = form.querySelector('[data-k="name"]');
    if (first) first.focus();
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
  function closeForm(slot, st, form) {
    /* 選んだ写真を持っているのは追加の面だけ。修正の面を閉じても、開いたままの追加の面の写真は手放さない。 */
    if (form.querySelector('[data-pick]')) unpick(st, form);
    var host = form.parentNode, opener = form.__opener || host.querySelector('[data-act="form"]');
    host.removeChild(form);
    if (opener) { opener.hidden = false; opener.setAttribute('aria-expanded', 'false'); opener.focus(); }
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
      rpc('pv_stay_update', {
        id: form.__edit, kind: kind, name: name,
        address: val('address') || null, maps_url: url || null, note: val('note') || null,
        stay_hours: hours
      }).then(function (v) {
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

    rpc('pv_stay_add', {
      airline: k[0], iata: k[1], kind: kind, name: name,
      address: val('address') || null, maps_url: url || null, note: val('note') || null,
      stay_hours: hours
    }).then(function (v) {
      if (ST.get(slot) !== st) return;
      if (bad(v)) {
        if (v && v.status === 'locked') { load(slot, { fresh: true }); return; }   /* 資格が変わった */
        busy(slot, st, false);
        fsay(form, (v && SAY_ADD[v.status]) || SAY_FAIL);
        return;
      }
      var id = v.item && str(v.item.id);
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
      ? rpc('pv_stay_delete', { target: target, id: id })
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

  // ══ 押されたとき（欄ごとに1回だけ結ぶ）═════════════════════
  function bind(slot) {
    if (slot.__crsBound) return;
    slot.__crsBound = true;
    slot.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      var st = ST.get(slot);
      if (!b || !st || !slot.contains(b)) return;
      var act = b.getAttribute('data-act');
      if (act === 'retry')       { delete CACHE[st.key]; load(slot, { fresh: true }); }
      else if (act === 'form')   openForm(slot, st, b);
      else if (act === 'edit')   { if (b.__crsItem) openForm(slot, st, b, b.__crsItem); }
      else if (act === 'unform') closeForm(slot, st, b.closest('.crs-form'));
      else if (act === 'unpick') unpick(st, b.closest('.crs-form'));
      else if (act === 'zoom')   zoom(slot, st, b);
      else if (act === 'unzoom') shut(st.zoom);
      else if (act === 'unsure') disarm(b);
      else if (act === 'del')    { if (b.getAttribute('data-sure')) moderate(slot, st, b, 'del'); else arm(b); }
      else if (act === 'pub' || act === 'rej') moderate(slot, st, b, act);
    });
    slot.addEventListener('change', function (e) {
      var fi = e.target, st = ST.get(slot);
      if (fi && fi.type === 'radio' && fi.closest('.crs-form')) { syncKind(fi.closest('.crs-form')); return; }
      if (!st || !fi || fi.type !== 'file') return;
      if (fi.getAttribute('data-pick')) picked(slot, st, fi);
      else if (fi.getAttribute('data-place')) addPhoto(slot, st, fi);
    });
    slot.addEventListener('submit', function (e) {
      var st = ST.get(slot);
      e.preventDefault();
      if (st && e.target && e.target.classList.contains('crs-form')) submit(slot, st, e.target);
    });
  }

  // ══ 始める ═════════════════════════════════════════════════
  /* career.js が画面を出し終えるたびに #cr で cr:show を投げる。
     このファイルより先に1回目が出ていることがあるので、読み込まれた時点でも1回見る。 */
  d.addEventListener('cr:show', function () { scan(); }, true);
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
