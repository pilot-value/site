/* pv-hotel-suggest.js — ホテルの名前の欄に、打ったそばから Google マップの候補を出す（2026-10-18 オーナー V7・P12.61）。
 *
 * ・使うのは2か所：就航地のホテルの「追加」の面（career-stay.js）と、管理ページの「追加」のホテル（admin-queue.js）。
 *   どちらも PVHotelSuggest.attach(名前の欄, { … }) を呼ぶだけ。候補の出し方・選び方は、ここの1か所だけ。
 * ・問い合わせ先は、このサイトの Supabase の Edge Function（hotel-suggest）だけ。Google の鍵はブラウザに来ない。
 *   ★名もなしで送る（2026-10-19 P12.74）：見出しは公開の鍵（anon）だけ。ログインの鍵・会員の番号・書きかけの印は1つも付けない
 *     （打ったホテルの名前が、誰が打ったかと結びつかない）。送る中身は { q: 名前, lang, near: 都市 } だけ。
 *   ★先に ping（打った字を含まない）で「いま候補を出せるか」を聞く。on が真のときだけ、打った名前を送る。
 *     止まっている・つながっていない・数え札が答えない・ping が失敗した ── どのときも、打った字は1文字も出ていかない。
 *   送るのは名前の欄の字だけ。住所・地図・補足・ほかの欄の字は、「追加する」を押すまでどこへも出ない。
 *   月 10,000 回の天井はサーバーが数える（db/hotel-suggest.sql）。ここは回数を節約するだけ
 *   （打つのが止まってから送る・短すぎる字は送らない・同じ字は2回送らない）。
 * ・候補を出せない（止まっている・つながっていない・失敗した・遅い）ときは、何も言わずに今までどおりの「ただの入力欄」。
 *   一度そうなったら、このページでは2度と送らない（止まった口を叩き続けない）。打った字も送信も、何も変わらない。
 *   ★入力欄の印（role など）も、最初に候補が出るまで1つも付けない（出せないあいだは、欄はいまと1文字も違わない）。
 * ・選ぶと、名前の欄に候補の名前、地図の欄（渡されたときだけ）に place ID つきの Google マップのリンクを入れる。
 *   住所の欄には入れない（2026-10-18 の設計：名前と地図のリンクだけ）。地図の欄に本人が打った字があれば上書きしない。
 *   入れたあとは input を知らせる（書きかけの決まり ── 打った字と同じく残る）。
 * ・取ってきた字は全部 textContent。候補の一覧の下に「Google Maps」（Google の決まり：地図の無い画面で候補を出すときの帰属表示）。
 */
(function (w, d) {
  'use strict';
  if (w.PVHotelSuggest) return;

  var FN = 'hotel-suggest';   // supabase/functions/hotel-suggest
  var PAUSE = 400;            // 打つのが止まってから送るまで（ミリ秒）
  var LIMIT = 5000;           // 返事を待つ上限（来なければ、このページでは候補をやめる）
  var BY = 'Google Maps';     // Google の帰属表示（訳さない・Google の決まりの字）
  var CJK = /[぀-ヿ㐀-鿿豈-﫿가-힯]/;
  var OFF = false;            // このページでは、もう送らない
  var READY = null;           // ping の答え（このページで1回）。true のときだけ、打った名前を送る
  var N = 0;

  function clean(v) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').replace(/^ | $/g, ''); }
  function cps(s) { return Array.from ? Array.from(s) : s.split(''); }
  /* 送ってよい字（サーバーの cleanQuery と同じ決まり）：日本語・中国語・韓国語の字が在れば2字から、無ければ3字から。80字まで。 */
  function query(v) {
    var s = clean(v), n = cps(s).length;
    return n <= 80 && n >= (CJK.test(s) ? 2 : 3) ? s : '';
  }
  /* place ID → Google マップのリンク（https://www.google.com/maps/search/?api=1&query=…&query_place_id=…）。
     サイトの地図のリンクの決まり（db/stays.sql の pv_stay_maps_url）に通る形だけ返す。通らなければ ''（地図の欄に入れない）。 */
  function link(it) {
    var id = typeof it.place_id === 'string' ? it.place_id : '';
    if (!/^[A-Za-z0-9_-]{10,300}$/.test(id)) return '';
    var name = cps(clean(it.name).replace(/\.{2,}/g, '.'));
    while (name.length) {
      var u = 'https://www.google.com/maps/search/?api=1&query=' +
              encodeURIComponent(name.join('')).replace(/[!'()*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); }) +
              '&query_place_id=' + id;
      if (u.length <= 500) return /\.\.|%2e/i.test(u) ? '' : u;
      name.pop();
    }
    return '';
  }
  function within(p, ms) {
    return new Promise(function (done) {
      var t = w.setTimeout(function () { done(null); }, ms);
      Promise.resolve(p).then(function (v) { w.clearTimeout(t); done(v); }, function () { w.clearTimeout(t); done(null); });
    });
  }
  /* 送り先：このページの Supabase の Edge Function（client が向いている住所の /functions/v1/hotel-suggest）。ほかの住所へは送らない */
  function fnUrl(c) {
    var u = '';
    try {
      u = c && c.functionsUrl ? String(c.functionsUrl.href || c.functionsUrl)
        : (c && typeof c.supabaseUrl === 'string' ? c.supabaseUrl.replace(/\/+$/, '') + '/functions/v1' : '');
    } catch (e) { u = ''; }
    u = u.replace(/\/+$/, '');
    return /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?\/functions\/v1$/.test(u) ? u + '/' + FN : '';
  }
  /* 名もなしで1本送る（公開の鍵だけ。ログインの鍵は付けない・クッキーも付けない）。答えが無い・読めない → null */
  function post(c, body) {
    var url = fnUrl(c), key = c && typeof c.supabaseKey === 'string' ? c.supabaseKey : '';
    if (!url || !key || typeof w.fetch !== 'function') return Promise.resolve(null);
    return within(w.fetch(url, {
      method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: 'Bearer ' + key },
      body: JSON.stringify(body)
    }).then(function (r) { return r && r.ok ? r.json() : null; }), LIMIT);
  }
  /* いま候補を出せるか（ping。打った字は含まない）。このページで1回だけ聞く */
  function ready(o) {
    if (OFF) return Promise.resolve(false);
    if (!READY) {
      READY = Promise.resolve().then(o.client).then(function (c) { return post(c, { ping: 1 }); })
        .then(function (v) { return !!v && v.ok === true && v.on === true; }, function () { return false; });
    }
    return READY;
  }
  function el(tag, cls, text) {
    var n = d.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }

  /* o = { client: () => Promise<supabase の client>, lang: 'ja'|'en', host: 一覧を置く箱（position のある祖先）,
           maps: 地図の欄（無ければ null）, near: () => 都市の名前（任意）, active: () => 今は候補を出してよいか（任意） } */
  function attach(input, o) {
    if (!input || input.__pvhs || !o || typeof o.client !== 'function' || !o.host) return;
    input.__pvhs = true;
    var id = 'pvhs-' + (++N), box = null, ul = null, items = [], at = -1, timer = 0, seq = 0, last = '', filling = false;
    var mine = { name: null, maps: null };
    var active = typeof o.active === 'function' ? o.active : function () { return true; };

    function opened() { return !!box && !box.hidden; }
    function close() {
      if (!box) return;
      box.hidden = true; at = -1;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }
    /* もう候補は出さない。欄の印も外す（ただの入力欄に戻る） */
    function stop() {
      OFF = true;
      w.clearTimeout(timer);
      if (box && box.parentNode) box.parentNode.removeChild(box);
      box = null; ul = null; items = []; at = -1;
      ['role', 'aria-autocomplete', 'aria-controls', 'aria-expanded', 'aria-activedescendant'].forEach(function (a) { input.removeAttribute(a); });
    }
    function place() {
      /* 一覧は箱の枠の内側から測る（getBoundingClientRect は枠の外から ── 枠の太さを引かないと 1px ずれる） */
      var hr = o.host.getBoundingClientRect(), ir = input.getBoundingClientRect();
      box.style.top = Math.round(ir.bottom - hr.top - o.host.clientTop + o.host.scrollTop + 4) + 'px';
      box.style.left = Math.round(ir.left - hr.left - o.host.clientLeft + o.host.scrollLeft) + 'px';
      box.style.width = Math.round(ir.width) + 'px';
    }
    function mark(i) {
      at = i;
      [].forEach.call(ul.children, function (li, k) { li.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
      if (i >= 0) {
        input.setAttribute('aria-activedescendant', id + '-' + i);
        var li = ul.children[i];
        if (li && li.scrollIntoView) { try { li.scrollIntoView({ block: 'nearest' }); } catch (e) { /* 動かせなくても選べる */ } }
      } else input.removeAttribute('aria-activedescendant');
    }
    function fire(node) {
      filling = true;
      try { node.dispatchEvent(new Event('input', { bubbles: true })); } finally { filling = false; }
    }
    function choose(i) {
      var it = items[i];
      if (!it) return;
      var max = input.maxLength > 0 ? input.maxLength : 80;
      input.value = cps(it.name).slice(0, max).join('');
      mine.name = input.value;
      last = query(input.value);
      fire(input);
      var u = o.maps ? link(it) : '';
      if (u && (!clean(o.maps.value) || o.maps.value === mine.maps)) {
        o.maps.value = u;
        mine.maps = u;
        fire(o.maps);
      }
      close();
    }
    function draw(list) {
      items = list;
      if (!items.length || d.activeElement !== input || !active()) { close(); return; }
      if (!box) {
        box = el('div', 'pvhs');
        box.hidden = true;
        ul = el('ul', 'pvhs-l');
        ul.id = id;
        ul.setAttribute('role', 'listbox');
        box.appendChild(ul);
        box.appendChild(el('p', 'pvhs-by', BY));
        /* 押しても欄から焦点が外れないように（外れると一覧が閉じる）。指でも同じ */
        box.addEventListener('pointerdown', function (e) { e.preventDefault(); });
        box.addEventListener('mousedown', function (e) { e.preventDefault(); });
        box.addEventListener('click', function (e) {
          var li = e.target.closest ? e.target.closest('.pvhs-o') : null;
          if (li && ul.contains(li)) choose(Number(li.getAttribute('data-i')));
        });
        o.host.appendChild(box);
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-controls', id);
      }
      while (ul.firstChild) ul.removeChild(ul.firstChild);
      items.forEach(function (it, i) {
        var li = el('li', 'pvhs-o');
        li.id = id + '-' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        li.setAttribute('data-i', String(i));
        li.appendChild(el('span', 'pvhs-n', it.name));
        if (it.address) li.appendChild(el('span', 'pvhs-a', it.address));
        ul.appendChild(li);
      });
      at = -1;
      input.removeAttribute('aria-activedescendant');
      place();
      box.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }
    function ask(q) {
      var my = ++seq;
      last = q;
      var near = '';
      /* 都市の名前は括弧の中を外して足す（「札幌（新千歳）」→「札幌」） */
      try { near = typeof o.near === 'function' ? clean(String(o.near() || '').replace(/[（(][^）)]*[）)]/g, ' ')) : ''; } catch (e) { near = ''; }
      var body = { q: q, lang: o.lang === 'en' ? 'en' : 'ja' };
      if (near && cps(near).length <= 40) body.near = near;
      Promise.resolve().then(o.client).then(function (c) { return post(c, body); }).then(function (v) {
        var good = !!v && v.ok === true && Array.isArray(v.items);
        if (!good) { stop(); return; }
        if (OFF || my !== seq || query(input.value) !== q) return;   /* もっと新しい字を打っている（古い返事は描かない） */
        var list = v.items.filter(function (x) {
          return x && typeof x.name === 'string' && clean(x.name) && typeof x.place_id === 'string';
        }).slice(0, 5).map(function (x) {
          return { name: clean(x.name), address: typeof x.address === 'string' ? clean(x.address) : '', place_id: x.place_id };
        });
        draw(list);
      }, function () { stop(); });
    }

    /* 日本語の変換の途中（未確定の字）は送らない。確定したところで、打ったのと同じに扱う */
    var composing = false;
    input.addEventListener('compositionstart', function () { composing = true; w.clearTimeout(timer); });
    input.addEventListener('compositionend', function () { composing = false; typed(); });
    input.addEventListener('input', function (e) { if (!(e && e.isComposing) && !composing) typed(); });
    function typed() {
      if (filling || OFF) return;
      w.clearTimeout(timer);
      var q = query(input.value);
      if (!q || !active()) { close(); return; }
      if (q === last) return;
      timer = w.setTimeout(function () {
        if (OFF || composing || d.activeElement !== input || !active()) return;
        /* 先に ping の答えを待つ（on でなければ、打った字は1文字も送らずに、ただの欄に戻る） */
        ready(o).then(function (on) {
          if (!on) { stop(); return; }
          if (OFF || composing || d.activeElement !== input || !active()) return;
          var now = query(input.value);
          if (now && now !== last) ask(now);
        });
      }, PAUSE);
    }
    /* 欄に入ったら（種類がホテルのときだけ）、先に ping を済ませておく（最初の候補が遅れないように） */
    input.addEventListener('focus', function () {
      if (OFF || !active()) return;
      ready(o).then(function (on) { if (!on) stop(); });
    });
    input.addEventListener('keydown', function (e) {
      if (composing || e.isComposing || e.keyCode === 229 || !opened() || !items.length) return;   /* 変換中の Enter は変換の確定 */
      var k = e.key;
      if (k === 'ArrowDown' || k === 'Down') { e.preventDefault(); mark(at + 1 >= items.length ? 0 : at + 1); }
      else if (k === 'ArrowUp' || k === 'Up') { e.preventDefault(); mark(at <= 0 ? items.length - 1 : at - 1); }
      else if (k === 'Enter' && at >= 0) { e.preventDefault(); choose(at); }
      else if (k === 'Escape' || k === 'Esc') { e.preventDefault(); close(); }
      else if (k === 'Tab') close();
    });
    input.addEventListener('blur', close);
    /* 種類を「ホテル」以外にした：一覧を閉じる */
    o.host.addEventListener('change', function () { if (!active()) close(); });
    w.addEventListener('resize', function () { if (opened()) place(); });
  }

  w.PVHotelSuggest = { attach: attach };
})(window, document);
