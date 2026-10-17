/* admin-queue.js — 管理ページ（admin.html ／ en/admin.html）の「承認」「追加」。運営だけが見る。

   ★守っているのはここではない。待っているものを返すのも、通すのも、足すのも、サーバーの入口
     （pv_town_queue ・ pv_stay_queue ほか）が名簿を見て初めて答える。この画面は、返ってきたものを字として並べるだけ。
   ★字は textContent でしか入れない。会員が打った街の名前・文・ホテルの名前が、そのまま運営の画面に出るため。
   ★表は直接読まない。呼ぶ入口は、呼ぶ場所に名前をそのまま書く（assert-admin.mjs が名前の組を数える）。
   ★両方の面に pv-no-cur が付いている（admin.html の側）。無いと currency.js が「20万円」を $ に
     書き換え、運営は打たれていない字を見て通すことになる。
   ★件数は、全部の部分が読めたときだけ出す。1つでも読めなければ「—」（半分の数を出さない）。
     一覧が上限まで来ていたら「以上」を付ける（本当の数は分からない）。
   ★時刻・書いた人の印・メールは、サーバーが返さない。ここでも作らない。
   ★ステイ先の待ち行列は「待っているもの」だけ。公開済みのホテルを読む道はここに無い
     （読めるのはオーナーとオーナーが承認した人だけ ── db/stays.sql の門）。
     写真は、承認の面が開いているあいだに1枚ずつ取りにいき、このタブのメモリーにだけ置く。 */
(function () {
  'use strict';

  var EN = /^en/i.test(document.documentElement.lang || '');
  /* 待ち行列の1つの一覧が返す最大の行数（db/towns.sql の2つ・db/stays.sql の2つの limit 200 と同じ数）。 */
  var CAP = 200;
  /* 会社の名簿（ホテルを足す面で、初めて開いたときに1回だけ読む）。ページが en/ でも同じ1枚を読む */
  var SRC = (document.currentScript && document.currentScript.src) || location.href;

  function answered(n) { return '回答 ' + n + '人'; }

  var T = EN ? {
    towns:    'Towns',
    stays:    'Stays',
    ok:       'Approve',
    merge:    'Approve as an existing town',
    rej:      'Reject',
    pending:  'Waiting',
    good:     'Good points',
    concern:  'Points to mind',
    none:     'Nothing is waiting',
    off:      'Not connected yet',
    err:      'Could not load',
    refresh:  'Refresh',
    loading:  'Loading…',
    more:     '+',
    posts:    function (n) { return n + ' members'; },
    kinds:    { hotel: 'Hotel', food: 'Restaurant', spot: 'Place' },
    hours:    function (n) { return n + ' h'; },
    map:      'Google マップ',
    photoErr: 'The photo cannot be shown',
    town:     'Town',
    hotel:    'Hotel',
    scope:    'Airline and base',
    townName: 'Town or station',
    airline:  'Airline',
    iata:     'Airport (3 letters)',
    fName:    'Name',
    fAddr:    'Address',
    fMap:     'Google Maps URL',
    fNote:    'Note',
    add:      'Add',
    added:    'Added.',
    existed:  'It is already a candidate.',
    notAdded: function (s) { return 'Could not add (' + s + ')'; }
  } : {
    towns:    '住みやすい街',
    stays:    'ステイ先',
    ok:       '承認',
    merge:    '同じ街として承認',
    rej:      '却下',
    pending:  '確認待ち',
    good:     '良い点',
    concern:  '気になる点',
    none:     '確認待ちはありません',
    off:      '準備中',
    err:      '読み込めませんでした',
    refresh:  '更新',
    loading:  '読み込み中…',
    more:     '以上',
    posts:    answered,
    kinds:    { hotel: 'ホテル', food: 'レストラン', spot: '場所' },
    hours:    function (n) { return n + '時間'; },
    map:      'Google マップ',
    photoErr: '写真を表示できません',
    town:     '街',
    hotel:    'ホテル',
    scope:    '会社・基地',
    townName: '街・最寄駅',
    airline:  '会社',
    iata:     '空港（3レター）',
    fName:    '名前',
    fAddr:    '住所',
    fMap:     'Google マップの URL',
    fNote:    'ひとこと',
    add:      '追加',
    added:    '追加しました。',
    existed:  'もう候補に入っています。',
    notAdded: function (s) { return '追加できませんでした（' + s + '）'; }
  };

  /* 断られたときの一言（career-stay.js の SAY_MOD ／ SAY_ADD.exists ／ SAY_FAIL と同じ字。assert-admin.mjs が突き合わせる）。 */
  var SAY = EN ? {
    changed:   'The author changed it. The current content was loaded - check it and press again.',
    final:     'A rejected item cannot be published again.',
    own_post:  'Your own item is checked by another operator.',
    not_found: 'This can no longer be shown.',
    forbidden: 'Only the operator can do this.',
    exists:    'The same name is already registered.'
  } : {
    changed:   '出した人が内容を直していました。いまの内容を読み直したので、確認してからもう一度押してください。',
    final:     '見送ったものは公開に戻せません。',
    own_post:  '自分が出したものは、別の運営が確認します。',
    not_found: 'もう表示できないものです。',
    forbidden: '運営だけが操作できます。',
    exists:    '同じ名前が、もう登録されています。'
  };
  var FAIL = EN ? 'Something went wrong. Please try again.' : 'うまくいきませんでした。もう一度お試しください。';

  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var isArr = Array.isArray;
  var str = function (v) { return typeof v === 'string' ? v : ''; };

  function el(tag, cls, text, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = String(text);
    if (attrs) for (var k in attrs) if (has(attrs, k)) e.setAttribute(k, attrs[k]);
    return e;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function $(id) { return document.getElementById(id); }

  /* ── 状態（このタブのメモリーだけ。保存領域には何も書かない）──────────── */
  var EMPTY_TOWN = { k: 'idle', scopes: [], towns: [], texts: [], full: false };
  var EMPTY_STAY = { k: 'idle', places: [], photos: [], full: false };
  var S = {
    sb: null,
    started: false,
    seq: 0,            // いちばん新しい読み込みの番号（古い返事で描き直さない）
    drawn: false,      // 1回でも返事を描いたか
    autoOpened: false, // 「承認」の面を自分で開いたか（ページを開いて1回だけ）
    town: EMPTY_TOWN,
    stay: EMPTY_STAY,
    notes: {},         // 断られた行の一言（読み直したあとも、その行に残す）
    photos: {},        // 写真の id → data: URL（いま待っている写真だけ。このタブのメモリーだけ）
    photoWait: [],     // まだ取りにいっていない写真の枠
    photoBusy: false
  };

  /* 1つの呼び出し → 返事の箱（投げられても止まらない） */
  function call(f) {
    try {
      return Promise.resolve(f()).then(function (r) { return r || {}; },
        function (e) { return { error: e || {}, thrown: true }; });
    } catch (e) { return Promise.resolve({ error: e || {}, thrown: true }); }
  }
  /* 返事 → ok ／ off（入口がまだ無い）／ deny（運営ではない）／ fail（それ以外） */
  function verdict(r) {
    var e = r && r.error;
    if (e) {
      var c = String(e.code || '');
      if (!r.thrown && (c === 'PGRST202' || c === '42883' || c === '42P01' || r.status === 404)) return 'off';
      return 'fail';
    }
    var d = r && r.data;
    if (d && d.ok === true) return 'ok';
    if (d && d.ok === false && d.status === 'forbidden') return 'deny';
    return 'fail';
  }
  function townPart(r) {
    var v = verdict(r), d = r && r.data;
    if (v === 'ok' && !(isArr(d.scopes) && isArr(d.towns) && isArr(d.texts))) v = 'fail';
    if (v !== 'ok') return { k: v, scopes: [], towns: [], texts: [], full: false };
    return { k: 'ok', scopes: d.scopes, towns: d.towns.slice(), texts: d.texts.slice(),
             full: d.towns.length >= CAP || d.texts.length >= CAP };
  }
  function stayPart(r) {
    var v = verdict(r), d = r && r.data;
    if (v === 'ok' && !(isArr(d.places) && isArr(d.photos))) v = 'fail';
    if (v !== 'ok') return { k: v, places: [], photos: [], full: false };
    return { k: 'ok', places: d.places.slice(), photos: d.photos.slice(),
             full: d.places.length >= CAP || d.photos.length >= CAP };
  }

  function parts() { return [S.town, S.stay]; }
  function allOk() { return parts().every(function (p) { return p.k === 'ok'; }); }
  function total() { return S.town.towns.length + S.town.texts.length + S.stay.places.length + S.stay.photos.length; }

  /* ── 数（承認の横）── 決まりは1つだけ ─────────────────────────────── */
  function drawBadge() {
    var n = $('adm-n');
    if (!n) return;
    if (!allOk()) { n.textContent = '—'; n.setAttribute('data-state', 'part'); return; }
    var full = parts().some(function (p) { return p.full; });
    n.textContent = String(total()) + (full ? T.more : '');
    n.setAttribute('data-state', 'ok');
  }

  /* ── 面を開く・閉じる ────────────────────────────────────────────── */
  function isOpen(k) { var p = $('adm-' + k); return !!p && !p.hidden; }
  function setOpen(which) {
    ['q', 'a'].forEach(function (k) {
      var b = $('adm-b-' + k), p = $('adm-' + k);
      if (!b || !p) return;
      var on = k === which;
      b.setAttribute('aria-expanded', on ? 'true' : 'false');
      p.hidden = !on;
    });
    if (which === 'q') pumpPhotos();
    if (which === 'a') drawAdd();
  }
  function wire() {
    ['q', 'a'].forEach(function (k) {
      var b = $('adm-b-' + k), p = $('adm-' + k);
      if (!b || !p) return;
      b.addEventListener('click', function () { setOpen(isOpen(k) ? null : k); });
      p.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        setOpen(null);
        b.focus();
      });
    });
  }

  /* ── 「承認」の面 ────────────────────────────────────────────────── */
  function scopeOf(airline, base) {
    var s = null;
    S.town.scopes.forEach(function (x) { if (!s && x && x.airline === airline && x.base === base) s = x; });
    return s;
  }
  function scopeLine(airline, base) {
    var s = scopeOf(airline, base);
    return (s && s.name ? s.name : String(airline || '')) + ' · ' + String(base || '');
  }
  function kindWord(k) { return has(T.kinds, k) ? T.kinds[k] : String(k || ''); }
  function stayLine(x) { return String(x.airline || '') + ' · ' + String(x.iata || '') + ' · ' + kindWord(x.kind); }
  function say(li, text) {
    var p = li.querySelector('[data-adm="say"]');
    if (!p) return;
    p.textContent = text || '';
    p.hidden = !text;
  }
  function busy(li, on) {
    li.setAttribute('aria-busy', on ? 'true' : 'false');
    Array.prototype.forEach.call(li.querySelectorAll('button, select'), function (b) {
      if (on) b.disabled = true;
      else b.disabled = b.getAttribute('data-act') === 'merge' ? !li.querySelector('select[data-act="into"]').value : false;
    });
  }
  /* 通す・見送る。send は入口を名前のまま呼ぶ関数。断られたら、その行に一言を出して読み直す（一言は読み直したあとも残す）。 */
  function moderate(li, key, send, done) {
    if (li.getAttribute('aria-busy') === 'true') return;
    busy(li, true);
    say(li, '');
    call(send).then(function (r) {
      var d = r && !r.error ? r.data : null;
      if (d && d.ok === true) { done(); return; }
      var st = d && d.ok === false ? String(d.status || '') : '';
      var m = has(SAY, st) ? SAY[st] : FAIL;
      S.notes[key] = m;
      say(li, m);
      load();
    });
  }
  function townMod(p) { return function () { return S.sb.rpc('pv_town_moderate', { p: p }); }; }
  function stayMod(p) { return function () { return S.sb.rpc('pv_stay_moderate', { p: p }); }; }
  function actions(li) { var a = el('div', 'adm-acts'); li.appendChild(a); return a; }
  function sayLine(li) { li.appendChild(el('p', 'adm-say', null, { 'data-adm': 'say', hidden: '' })); }
  function button(cls, text, act) { return el('button', 'adm-act ' + cls, text, { type: 'button', 'data-act': act }); }
  /* 行が片づいた（文・場所・写真）：メモリーの一覧から外し、行を消し、数を描き直す */
  function gone(list, x, li) {
    var part = list === 'texts' ? S.town : S.stay;
    part[list] = part[list].filter(function (y) { return y !== x; });
    if (li.parentNode) li.parentNode.removeChild(li);
    if (allOk() && total() === 0) draw(); else drawBadge();
  }

  function townRow(t) {
    var key = 'town:' + t.id;
    var li = el('li', 'adm-row', null, { 'data-adm': 'town', 'data-id': String(t.id) });
    li.appendChild(el('p', 'adm-row-k', scopeLine(t.airline, t.base)));
    li.appendChild(el('p', 'adm-row-v', t.name));
    if (typeof t.posts === 'number' && isFinite(t.posts) && t.posts >= 1 && Math.floor(t.posts) === t.posts)
      li.appendChild(el('p', 'adm-row-k', T.posts(t.posts)));
    var a = actions(li);
    var ok = button('adm-ok', T.ok, 'ok');
    ok.addEventListener('click', function () {
      moderate(li, key, townMod({ target: 'town', id: t.id, state: 'public' }), function () { load(); });
    });
    a.appendChild(ok);
    /* 在る街の別の書き方として通す。選ぶだけでは何も送らない（閉じた select は矢印キーでも change が出る）。 */
    var sc = scopeOf(t.airline, t.base), into = isArr(sc && sc.towns) ? sc.towns.filter(function (o) { return o && o.id != null; }) : [];
    if (into.length) {
      var sel = el('select', 'adm-in', null, { 'data-act': 'into', 'aria-label': T.merge });
      sel.appendChild(el('option', null, '—', { value: '' }));
      into.forEach(function (o) { sel.appendChild(el('option', null, o.name, { value: String(o.id) })); });
      var mg = el('button', 'adm-act adm-ok', T.merge, { type: 'button', 'data-act': 'merge', disabled: '' });
      sel.addEventListener('change', function () { mg.disabled = !sel.value; });
      mg.addEventListener('click', function () {
        var pick = null;
        into.forEach(function (o) { if (!pick && String(o.id) === sel.value) pick = o; });
        if (!pick) return;
        moderate(li, key, townMod({ target: 'town', id: t.id, state: 'public', into: pick.id }), function () { load(); });
      });
      a.appendChild(sel);
      a.appendChild(mg);
    }
    var no = button('adm-no', T.rej, 'no');
    no.addEventListener('click', function () {
      moderate(li, key, townMod({ target: 'town', id: t.id, state: 'rejected' }), function () { load(); });
    });
    a.appendChild(no);
    sayLine(li);
    return li;
  }

  function textRow(x) {
    var key = 'text:' + x.id, rev = x.rev;   // rev はこの行の横にだけ持つ（画面から読み直さない）
    var li = el('li', 'adm-row', null, { 'data-adm': 'text', 'data-id': String(x.id) });
    var k = el('p', 'adm-row-k', scopeLine(x.airline, x.base) + ' · ' + String(x.town || ''));
    if (x.town_state === 'pending') k.appendChild(el('span', 'adm-tag', T.pending));
    li.appendChild(k);
    if (str(x.good)) {
      li.appendChild(el('p', 'adm-row-k', T.good));
      li.appendChild(el('p', 'adm-row-t', x.good));
    }
    if (str(x.concern)) {
      li.appendChild(el('p', 'adm-row-k', T.concern));
      li.appendChild(el('p', 'adm-row-t', x.concern));
    }
    var a = actions(li);
    var ok = button('adm-ok', T.ok, 'ok');
    ok.addEventListener('click', function () {
      moderate(li, key, townMod({ target: 'text', id: x.id, state: 'public', rev: rev }), function () { gone('texts', x, li); });
    });
    var no = button('adm-no', T.rej, 'no');
    no.addEventListener('click', function () {
      moderate(li, key, townMod({ target: 'text', id: x.id, state: 'rejected' }), function () { gone('texts', x, li); });
    });
    a.appendChild(ok);
    a.appendChild(no);
    sayLine(li);
    return li;
  }

  function placeRow(x) {
    var key = 'place:' + x.id, rev = x.rev;   // rev はこの行の横にだけ持つ
    var li = el('li', 'adm-row', null, { 'data-adm': 'place', 'data-id': String(x.id) });
    li.appendChild(el('p', 'adm-row-k', stayLine(x)));
    li.appendChild(el('p', 'adm-row-v', x.name));
    [x.address, x.note, x.city].forEach(function (v) { if (str(v)) li.appendChild(el('p', 'adm-row-t', v)); });
    if (typeof x.stay_hours === 'number' && isFinite(x.stay_hours) && x.stay_hours >= 1 && Math.floor(x.stay_hours) === x.stay_hours)
      li.appendChild(el('p', 'adm-row-t', T.hours(x.stay_hours)));
    var a = actions(li);
    if (/^https:\/\//.test(str(x.maps_url)))
      a.appendChild(el('a', 'adm-act adm-no', T.map, { href: x.maps_url, target: '_blank', rel: 'noopener' }));
    var ok = button('adm-ok', T.ok, 'ok');
    ok.addEventListener('click', function () {
      moderate(li, key, stayMod({ target: 'place', id: x.id, state: 'public', rev: rev }), function () { gone('places', x, li); });
    });
    /* 場所を見送ると、サーバーはその場所の写真も見送る ── 読み直して、残っている写真の行も合わせる */
    var no = button('adm-no', T.rej, 'no');
    no.addEventListener('click', function () {
      moderate(li, key, stayMod({ target: 'place', id: x.id, state: 'rejected' }), function () { load(); });
    });
    a.appendChild(ok);
    a.appendChild(no);
    sayLine(li);
    return li;
  }

  function photoRow(x) {
    var key = 'photo:' + x.id;
    var li = el('li', 'adm-row', null, { 'data-adm': 'photo', 'data-id': String(x.id) });
    li.appendChild(el('p', 'adm-row-k', stayLine(x)));
    li.appendChild(el('p', 'adm-row-v', x.name));
    var ph = el('div', 'adm-ph', null, { 'data-adm': 'ph' });
    li.appendChild(ph);
    if (has(S.photos, x.id)) showPhoto(ph, x, S.photos[x.id]);
    else S.photoWait.push({ ph: ph, x: x });
    var a = actions(li);
    var ok = button('adm-ok', T.ok, 'ok');
    ok.addEventListener('click', function () {
      moderate(li, key, stayMod({ target: 'photo', id: x.id, state: 'public' }), function () { gone('photos', x, li); });
    });
    var no = button('adm-no', T.rej, 'no');
    no.addEventListener('click', function () {
      moderate(li, key, stayMod({ target: 'photo', id: x.id, state: 'rejected' }), function () { gone('photos', x, li); });
    });
    a.appendChild(ok);
    a.appendChild(no);
    sayLine(li);
    return li;
  }
  function showPhoto(ph, x, url) {
    clear(ph);
    if (url) ph.appendChild(el('img', 'adm-img', null, { src: url, alt: str(x.name) }));
    else ph.appendChild(el('p', 'adm-say', T.photoErr));
  }
  /* 写真は、承認の面が開いているあいだだけ、1枚ずつ取りにいく */
  function pumpPhotos() {
    if (S.photoBusy || !isOpen('q')) return;
    var job = null;
    while (S.photoWait.length && !job) {
      var j = S.photoWait.shift();
      if (j.ph.isConnected) job = j;
    }
    if (!job) return;
    S.photoBusy = true;
    var x = job.x;
    call(function () { return S.sb.rpc('pv_stay_photo', { p: { id: x.id } }); }).then(function (r) {
      var d = r && !r.error ? r.data : null;
      var url = '';
      if (d && d.ok === true && /^image\/(jpeg|png|webp)$/.test(str(d.mime)) && /^[A-Za-z0-9+\/]+=*$/.test(str(d.b64)))
        url = 'data:' + d.mime + ';base64,' + d.b64;
      if (url) S.photos[x.id] = url;
      showPhoto(job.ph, x, url);
      S.photoBusy = false;
      pumpPhotos();
    });
  }

  function drawPart(q, key, title, part, rows) {
    var h = el('h2', 'adm-h', title);
    if (part.k === 'off') h.appendChild(el('span', 'adm-part', T.off));
    else if (part.k === 'fail' || part.k === 'deny') {
      var sp = el('span', 'adm-part', T.err);
      var b = el('button', 'adm-act adm-no', T.refresh, { type: 'button', 'data-act': 'reload' });
      b.addEventListener('click', function () { load(); });
      sp.appendChild(b);
      h.appendChild(sp);
    }
    q.appendChild(h);
    var ul = el('ul', 'adm-rows', null, { 'data-adm-list': key });
    if (part.k === 'ok') rows.forEach(function (li) { ul.appendChild(li); });
    q.appendChild(ul);
  }

  function draw() {
    var q = $('adm-q');
    if (!q) return;
    clear(q);
    S.photoWait = [];
    var town = S.town, stay = S.stay;
    drawPart(q, 'town', T.towns, town, town.k === 'ok' ? town.towns.map(townRow).concat(town.texts.map(textRow)) : []);
    drawPart(q, 'stay', T.stays, stay, stay.k === 'ok' ? stay.places.map(placeRow).concat(stay.photos.map(photoRow)) : []);
    /* 断られた行の一言を、読み直したあとの同じ行へ戻す。行が無くなっていたら面の終わりに1行で残す。 */
    Object.keys(S.notes).forEach(function (key) {
      var i = key.indexOf(':'), adm = key.slice(0, i), id = key.slice(i + 1);
      var li = null;
      Array.prototype.forEach.call(q.querySelectorAll('li.adm-row'), function (x) {
        if (!li && x.getAttribute('data-adm') === adm && x.getAttribute('data-id') === id) li = x;
      });
      if (li) say(li, S.notes[key]);
      else q.appendChild(el('p', 'adm-say', S.notes[key], { 'data-adm': 'note' }));
    });
    S.notes = {};
    if (allOk() && total() === 0) q.appendChild(el('p', 'adm-say', T.none, { 'data-adm': 'none' }));
    drawBadge();
    S.drawn = true;
    if (!S.autoOpened && total() > 0) {
      S.autoOpened = true;
      if (!isOpen('q') && !isOpen('a')) setOpen('q');
    }
    pumpPhotos();
    if (isOpen('a')) drawAdd();
  }

  function load() {
    var my = ++S.seq;
    var q = $('adm-q');
    if (q && !S.drawn) { clear(q); q.appendChild(el('p', 'adm-say', T.loading, { 'data-adm': 'loading' })); }
    /* 読み出しは、この順に始めて、そろって待つ */
    var a = call(function () { return S.sb.rpc('pv_town_queue', { p: {} }); });
    var b = call(function () { return S.sb.rpc('pv_stay_queue', { p: {} }); });
    return Promise.all([a, b]).then(function (r) {
      if (my !== S.seq) return;   // あとから始めた読み込みが描く
      S.town = townPart(r[0]);
      S.stay = stayPart(r[1]);
      /* いま待っていない写真は、メモリーからも外す */
      var keep = {};
      S.stay.photos.forEach(function (x) { if (has(S.photos, x.id)) keep[x.id] = S.photos[x.id]; });
      S.photos = keep;
      draw();
    });
  }

  /* ── 「追加」の面 ── 街（候補として公開）／ホテル（その場で公開）。打った字は面を閉じても残る ── */
  var A = { built: false, kind: 'town', townForm: null, townReady: false, hotelForm: null };

  function field(label, input) {
    var l = el('label', null, label);
    l.appendChild(input);
    return l;
  }
  function addSay(form, text, tag) {
    var p = form.querySelector('[data-adm="add-say"]');
    clear(p);
    p.textContent = text || '';
    if (tag) p.appendChild(el('span', 'adm-tag', tag));
    p.hidden = !text;
  }
  function formBusy(form, on) {
    form.setAttribute('aria-busy', on ? 'true' : 'false');
    var b = form.querySelector('button[type="submit"]');
    if (b) b.disabled = !!on;
  }
  function jaMessage(r) {
    var m = r && r.error ? str(r.error.message) : '';
    return /[぀-ヿ㐀-鿿]/.test(m) ? m : '';
  }

  function townForm() {
    var f = el('form', 'adm-form', null, { 'data-adm': 'add-town', novalidate: '' });
    var sel = el('select', 'adm-in', null, { 'data-k': 'scope', required: '' });
    sel.appendChild(el('option', null, '—', { value: '' }));
    S.town.scopes.forEach(function (s, i) {
      if (s && s.airline && s.base) sel.appendChild(el('option', null, (s.name || s.airline) + ' · ' + s.base, { value: String(i) }));
    });
    var name = el('input', 'adm-in', null, { type: 'text', maxlength: '30', 'data-k': 'name', required: '', autocomplete: 'off' });
    f.appendChild(field(T.scope, sel));
    f.appendChild(field(T.townName, name));
    f.appendChild(el('button', 'adm-act adm-ok', T.add, { type: 'submit' }));
    f.appendChild(el('p', 'adm-say', null, { 'data-adm': 'add-say', role: 'status', hidden: '' }));
    var scopes = S.town.scopes;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (f.getAttribute('aria-busy') === 'true') return;
      var s = sel.value === '' ? null : scopes[Number(sel.value)];
      var v = name.value.trim();
      if (!s) { sel.focus(); sel.reportValidity && sel.reportValidity(); return; }
      if (!v) { name.focus(); name.reportValidity && name.reportValidity(); return; }
      formBusy(f, true);
      addSay(f, '');
      call(function () { return S.sb.rpc('pv_town_admin_add', { p: { airline: s.airline, base: s.base, name: v } }); }).then(function (r) {
        formBusy(f, false);
        var d = r && !r.error ? r.data : null;
        if (d && d.ok === true) {
          addSay(f, d.existed === true ? T.existed : T.added);
          name.value = '';
        } else addSay(f, jaMessage(r) || FAIL);
        load();
      });
    });
    return f;
  }

  function hotelForm() {
    var f = el('form', 'adm-form', null, { 'data-adm': 'add-hotel', novalidate: '' });
    var air = el('select', 'adm-in', null, { 'data-k': 'airline', required: '' });
    air.appendChild(el('option', null, '—', { value: '' }));
    var airL = field(T.airline, air);
    f.appendChild(airL);
    var codes = null;   // 名簿が読めなかったときは、会社のコードを打つ欄に替える
    fetch(new URL('pv-airlines.json', SRC).href, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error('http');
      return res.json();
    }).then(function (j) {
      var m = j && j.airlines;
      if (!m || typeof m !== 'object') throw new Error('shape');
      codes = Object.keys(m).filter(function (c) { return c !== 'other'; });
      codes.forEach(function (c) {
        var n = m[c] && (EN ? m[c].en : m[c].ja);
        air.appendChild(el('option', null, str(n) || c, { value: c }));
      });
    }).catch(function () {
      var code = el('input', 'adm-in', null, { type: 'text', 'data-k': 'airline', required: '', autocomplete: 'off', maxlength: '40' });
      airL.replaceChild(code, air);
      air = code;
    });
    var iata = el('input', 'adm-in', null, { type: 'text', 'data-k': 'iata', required: '', maxlength: '3', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' });
    var name = el('input', 'adm-in', null, { type: 'text', 'data-k': 'name', required: '', maxlength: '80', autocomplete: 'off' });
    var addr = el('input', 'adm-in', null, { type: 'text', 'data-k': 'address', maxlength: '200', autocomplete: 'off' });
    var map = el('input', 'adm-in', null, { type: 'url', 'data-k': 'maps_url', maxlength: '500', autocomplete: 'off', inputmode: 'url' });
    var note = el('textarea', 'adm-in', null, { 'data-k': 'note', maxlength: '500', rows: '3' });
    f.appendChild(field(T.iata, iata));
    f.appendChild(field(T.fName, name));
    f.appendChild(field(T.fAddr, addr));
    f.appendChild(field(T.fMap, map));
    f.appendChild(field(T.fNote, note));
    f.appendChild(el('button', 'adm-act adm-ok', T.add, { type: 'submit' }));
    f.appendChild(el('p', 'adm-say', null, { 'data-adm': 'add-say', role: 'status', hidden: '' }));
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (f.getAttribute('aria-busy') === 'true') return;
      var p = { airline: air.value.trim(), iata: iata.value.trim().toUpperCase(), kind: 'hotel', name: name.value.trim() };
      var miss = !p.airline ? air : !p.iata ? iata : !p.name ? name : null;
      if (miss) { miss.focus(); miss.reportValidity && miss.reportValidity(); return; }
      /* 打っていない欄は送らない */
      if (addr.value.trim()) p.address = addr.value.trim();
      if (map.value.trim()) p.maps_url = map.value.trim();
      if (note.value.trim()) p.note = note.value.trim();
      p.publish = true;
      formBusy(f, true);
      addSay(f, '');
      call(function () { return S.sb.rpc('pv_stay_add', { p: p }); }).then(function (r) {
        formBusy(f, false);
        var d = r && !r.error ? r.data : null;
        if (d && d.ok === true) {
          addSay(f, T.added, d.item && d.item.state === 'pending' ? T.pending : '');
          name.value = ''; addr.value = ''; map.value = ''; note.value = '';
        } else if (d && d.ok === false && d.status === 'exists') addSay(f, SAY.exists);
        else if (d && d.ok === false && d.status) addSay(f, T.notAdded(String(d.status)));
        else addSay(f, FAIL);
        load();
      });
    });
    return f;
  }

  function drawAdd() {
    var a = $('adm-a');
    if (!a) return;
    if (!A.built) {
      A.built = true;
      var pick = el('div', 'adm-acts', null, { role: 'radiogroup', 'aria-labelledby': 'adm-b-a' });
      [['town', T.town], ['hotel', T.hotel]].forEach(function (k) {
        var l = el('label', 'adm-opt');
        var r = el('input', null, null, { type: 'radio', name: 'adm-kind', value: k[0] });
        if (k[0] === A.kind) r.checked = true;
        r.addEventListener('change', function () { if (r.checked) { A.kind = k[0]; drawAdd(); } });
        l.appendChild(r);
        l.appendChild(document.createTextNode(k[1]));
        pick.appendChild(l);
      });
      a.appendChild(pick);
      A.townBox = el('div', null, null, { 'data-adm': 'add-town-box' });
      A.hotelBox = el('div', null, null, { 'data-adm': 'add-hotel-box', hidden: '' });
      a.appendChild(A.townBox);
      a.appendChild(A.hotelBox);
    }
    /* 街の欄は、待ち行列が読めて会社と基地の組が分かってから（それまでは「準備中」だけ） */
    if (S.town.k === 'ok' && !A.townReady) {
      A.townReady = true;
      clear(A.townBox);
      A.townBox.appendChild(townForm());
    } else if (!A.townReady && !A.townBox.firstChild) A.townBox.appendChild(el('p', 'adm-say', T.off));
    if (A.kind === 'hotel' && !A.hotelForm) { A.hotelForm = hotelForm(); A.hotelBox.appendChild(A.hotelForm); }
    A.townBox.hidden = A.kind !== 'town';
    A.hotelBox.hidden = A.kind !== 'hotel';
  }

  function start(sb) {
    if (S.started) return load();
    if (!sb || typeof sb.rpc !== 'function') return Promise.resolve();
    S.started = true;
    S.sb = sb;
    wire();
    return load();
  }

  window.PVAdminQueue = {
    start: start,
    reload: function () { return S.started ? load() : Promise.resolve(); }
  };
})();
