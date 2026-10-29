/* 主要5社の会社ページの最上部（.pvg）の動き ── 見せる・隠す・切り替えるだけ。
   ⚠️ ここに金額を書かない。額は全部 HTML に在る（通貨切替と check-salary.mjs がそのまま読める）。
   ⚠️ 直したら node gen-airline-glance.mjs（HTML が読む ?v= を付け直す）。
   板の開閉は hidden 属性で行う ＝ career-live.js がそれを見て、見えるようになった実データの欄を取りに行く。

   タブ（#pvg-tabs を持つページだけ）── 見本の6つ。
     ・どの塊がどのタブに出るかは HTML の data-pvg-pane。ここは <body> に pvg-at-<タブ> を1つ付けるだけ
       （隠すのは pv-glance.css）。このファイルが動かなければ印が付かない ＝ 中身は全部出たまま。
     ・選んだタブは住所の # に残す（概要は # なし）。押すたびに履歴を1段積む ＝ 戻る・進む・読み直しで同じタブ。
     ・window.PVGlance = { go(tab, opt), at(), city(), mark() }。airline-reviews-ui.js が古い名前（reviews／salary…）で呼んでくる。
       city() と mark() と go の opt.replace は pv-contrib.js（「情報を追加」の面）が使う。 */
(function (w, d) {
  'use strict';
  var root = d.querySelector('.pvg');
  if (!root) return;
  var calm = !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var HEAD = 72;                                   // 固定ヘッダーの高さ

  function glide(dy) {
    if (!dy) return;
    try { w.scrollBy({ top: dy, behavior: calm ? 'auto' : 'smooth' }); } catch (e) { w.scrollBy(0, dy); }
  }
  /* その場へ置く（滑らせない）。このページは html{scroll-behavior:smooth} なので、素の scrollTo だと滑る。
     面を入れ替えた直後に滑ると、短くなったページの底から頭まで流れて見える（就航地の一覧は100枚ある）。 */
  function put(y) {
    var el = d.documentElement, was = el.style.scrollBehavior;
    el.style.scrollBehavior = 'auto';
    w.scrollTo(0, Math.max(0, y));
    el.style.scrollBehavior = was;
  }

  /* ── 1) 勤務・待遇・暮らしの板（開くのは1つだけ）────────── */
  var mores = [].slice.call(root.querySelectorAll('.pvg-more[aria-controls]'));
  function panelOf(btn) { return d.getElementById(btn.getAttribute('aria-controls')); }
  function set(btn, open) {
    var p = panelOf(btn);
    if (!p) return;
    p.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    var cell = btn.closest('.pvg-cell');
    if (cell) cell.classList.toggle('is-open', open);
  }
  function openOnly(btn) {
    mores.forEach(function (b) { if (b !== btn) set(b, false); });
    set(btn, true);
    /* 板の頭が画面の外なら、見える所まで寄せる（板ぜんぶは追わない。読み始めが見えれば足りる） */
    var p = panelOf(btn);
    if (!p) return;
    var r = p.getBoundingClientRect(), need = Math.min(r.height, 240);
    var room = w.innerHeight - r.top;
    if (room < need) glide(need - room + 16);
    else if (r.top < HEAD) glide(r.top - HEAD - 12);
  }
  function current() {
    for (var i = 0; i < mores.length; i++) if (mores[i].getAttribute('aria-expanded') === 'true') return mores[i];
    return null;
  }

  /* ── 1.2) 暮らし：街のカードを選ぶと、その街の詳細だけが出る ──
     動かなければ hidden が付かない ＝ どの街の詳細も縦に並んだまま（中身は1つも消えない）。 */
  var townBtns = [].slice.call(root.querySelectorAll('[data-pvg-towns] .pvg-town[data-town]'));
  function pickTown(key, move) {
    var hit = null;
    townBtns.forEach(function (b) {
      var on = b.getAttribute('data-town') === key;
      var p = d.getElementById(b.getAttribute('aria-controls'));
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (!p) return;
      p.hidden = !on;
      if (on) hit = p;
    });
    /* 棒の行の印は、行の data-town で付ける（団地ごとの行も、その街の行は全部） */
    if (rentBox) [].forEach.call(rentBox.querySelectorAll('[data-bar]'), function (li) {
      if (li.getAttribute('data-town') === key) li.setAttribute('data-on', ''); else li.removeAttribute('data-on');
    });
    if (!hit || !move) return;
    /* 詳細が画面の下へはみ出すなら、頭が帯の下に隠れない所まで寄せる */
    var r = hit.getBoundingClientRect(), top = HEAD + 68, over = r.bottom - w.innerHeight + 16;
    if (over > 0) glide(Math.min(over, r.top - top));
    else if (r.top < top) glide(r.top - top);
  }
  /* ── 1.3) 暮らし：家賃の間取りを切り替える（見せる・隠すだけ。額は HTML に在る。履歴も保存もしない）──
     動かなければ、どの間取りの棒も縦に並んだまま（切り替えのボタンは CSS が隠す）。 */
  var rentBox = root.querySelector('[data-pvg-rent]');
  var sizeBtns = rentBox ? [].slice.call(rentBox.querySelectorAll('[data-pvg-size]')) : [];
  function pickSize(key) {
    sizeBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-pvg-size') === key ? 'true' : 'false'); });
    [].forEach.call(rentBox.querySelectorAll('[data-size-panel]'), function (g) { g.hidden = g.getAttribute('data-size-panel') !== key; });
  }
  if (sizeBtns.length) {
    rentBox.setAttribute('data-js', '');
    pickSize((sizeBtns.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0] || sizeBtns[0]).getAttribute('data-pvg-size'));
  }
  if (townBtns.length) pickTown(townBtns[0].getAttribute('data-town'), false);

  /* ── 1.5) タブ ────────────────────────────────────────── */
  var bar = d.getElementById('pvg-tabs');
  var links = bar ? [].slice.call(bar.querySelectorAll('[data-pvg-tab]')) : [];
  var TABS = links.map(function (a) { return a.getAttribute('data-pvg-tab'); });
  var OPEN = { pay: 'benefits', work: 'work', life: 'living' };   // そのタブでは、この板が開いたまま本文になる（gen-airline-glance.mjs の CELL_TAB と同じ対）
  var at = '';
  /* 帯が入りきらない幅で、どちらの端に続きが在るかを枠に書く（pv-glance.css が端を薄くして矢印を置く）。
     実際に測る ── 幅や文字数から決め打ちしない（通貨・字の大きさ・言語で変わる）。 */
  var wrap = bar ? (bar.closest('.pvg-tabwrap') || bar) : null;
  function tabEdges() {
    if (!bar) return;
    var max = bar.scrollWidth - bar.clientWidth, x = bar.scrollLeft, m = [];
    if (max > 1) { if (x > 1) m.push('l'); if (x < max - 1) m.push('r'); }
    m = m.join(' ');
    if (!m) wrap.removeAttribute('data-more');
    else if (wrap.getAttribute('data-more') !== m) wrap.setAttribute('data-more', m);
  }
  /* 選んだタブを帯のまんなかへ寄せる（ページは動かさない）。端に在るタブは、寄せられる所まで。
     まんなかへ寄せると、前後のタブが両側に見える ＝ 「まだ在る」と「いまここ」が同時に分かる。 */
  function tabSeat() {
    if (!bar) return;
    var a = bar.querySelector('[aria-current="page"]'), max = bar.scrollWidth - bar.clientWidth;
    if (a && max > 1) {
      var r = a.getBoundingClientRect(), br = bar.getBoundingClientRect();
      bar.scrollLeft = Math.max(0, Math.min(max, Math.round(bar.scrollLeft + r.left + r.width / 2 - br.left - br.width / 2)));
    }
    tabEdges();
  }
  function fire() {
    /* 見えるようになった実データの欄を、career-live.js に取りに行かせる */
    try { d.body.dispatchEvent(new CustomEvent('cr:show', { bubbles: true })); } catch (e) { /* 古いブラウザ */ }
  }
  function show(tab) {
    if (TABS.indexOf(tab) < 0) tab = TABS[0];
    at = tab;
    /* ステイ先を離れたら、開いていた都市を閉じる（閉じないと、概要に出す就航地の一部まで隠れたままになる） */
    if (tab !== 'stay' && cityAt) setCity('');
    TABS.forEach(function (t) { d.body.classList.toggle('pvg-at-' + t, t === tab); });
    links.forEach(function (a) {
      if (a.getAttribute('data-pvg-tab') === tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    mores.forEach(function (b) { set(b, b.getAttribute('aria-controls') === 'pvg-p-' + OPEN[tab]); });
    /* 狭い画面では帯が横に流れる。選んだタブを帯のまんなかへ寄せ、続きの在る端に印を付ける */
    tabSeat();
    fire();
  }
  /* 帯が画面の上に貼り付いているとき（＝ページの途中で押したとき）は、切り替えた面の頭を帯のすぐ下へ持ってくる。
     ページの頭に居るときは動かさない。面の中身が入れ替わるので、滑らせずに置く。 */
  function toTop() {
    var box = bar.closest('.pvg-tabbar') || bar, hero = d.querySelector('.pvg-hero');
    if (!hero) return;
    var y = hero.getBoundingClientRect().bottom + w.pageYOffset - parseFloat(w.getComputedStyle(box).top || 0);
    if (w.pageYOffset > y) put(y);
  }
  /* 住所の # から、開くタブと寄る先を決める。
     # がタブの名前ならそのタブ。ページの中の id なら、その要素が出ているタブ（今のタブに出ていれば今のまま）。 */
  function fromHash() {
    var id = '';
    try { id = decodeURIComponent(String(location.hash || '').replace(/^#/, '')); } catch (e) { id = ''; }
    if (!id) return { tab: TABS[0], el: null, city: '' };
    if (TABS.indexOf(id) >= 0) return { tab: id, el: null, city: '' };
    /* #stay-NRT … ステイ先のタブで、その都市の詳細。一覧に無い3字なら、一覧のまま */
    var m = /^stay-([A-Za-z]{3})$/.exec(id);
    if (m && TABS.indexOf('stay') >= 0) return { tab: 'stay', el: null, city: cityCard(m[1].toUpperCase()) ? m[1].toUpperCase() : '' };
    var el = d.getElementById(id);
    if (!el) return { tab: at || TABS[0], el: null, city: '' };
    var ok = TABS.slice();
    for (var n = el; n && n.getAttribute; n = n.parentNode) {
      var p = n.getAttribute('data-pvg-pane');
      if (p) ok = ok.filter(function (t) { return (' ' + p + ' ').indexOf(' ' + t + ' ') >= 0; });
    }
    return { tab: ok.indexOf(at) >= 0 ? at : ok[0] || TABS[0], el: el, city: '' };
  }
  /* 寄る先が畳んだ箱（<details>）か、その中に在るなら、先に開ける。
     閉じたままだと、寄った先に見出しの1行しか無い（「この数字の出どころ」を押したのに、出どころが見えない）。 */
  function unfold(el) {
    for (var n = el; n && n.nodeName; n = n.parentNode) if (n.nodeName === 'DETAILS') n.open = true;
  }
  function near(el) {
    var box = bar.closest('.pvg-tabbar') || bar;
    unfold(el);
    put(el.getBoundingClientRect().top + w.pageYOffset - HEAD - box.offsetHeight - 12);
  }
  function state(extra) {
    var o = {}, s = w.history.state, k;
    if (s && typeof s === 'object') for (k in s) o[k] = s[k];
    for (k in extra) o[k] = extra[k];
    return o;
  }
  /* いまの段に、いまの位置・タブ・開いている板を書き留める（「戻る」でこの段へ帰ってきたとき、同じ所へ置くため）。
     タブも書くのは、2つのタブに出る節（#pvg-stay）の段だと、住所の # だけでは「どちらのタブで見ていたか」が
     決まらないから（fromHash は「今のタブ」と答える ＝ ステイ先から戻っても、ステイ先のままになる）。
     板も書くのは、閉じたまま位置だけ戻すと、ページが板の分だけ短くなって同じ位置に別の中身が来るから。 */
  function markY() {
    var c = OPEN[at] ? null : current();
    var st = state({ pvgY: w.pageYOffset, pvgAt: at, pvgOpen: c ? c.getAttribute('aria-controls') : '' });
    /* 就航地の一覧の段なら、探す字と地域の札も（「戻る」・読み直しで同じ一覧に戻す。restoreFind）。ほかの段では、その2つに触らない。 */
    if (at === 'stay' && !cityAt) { st.pvgQ = stQ ? stQ.value : ''; st.pvgRg = stRg; }
    try {
      /* ページの中の id の段（#pvg-stay・出所の節 …）は、住所もいまのタブの住所へ直す。
         # に id が残っていると、「戻る」でこの段へ帰ってきたとき、ブラウザが自分でその id の頭へ寄せ直して
         書き留めた位置（その先まで読んでいた所）を上書きする（Chrome で実測。あとから滑って来るので、置いても追い越される）。
         タブと位置は書き留めが持っているので、id は要らない。都市の詳細（#stay-NRT）は id ではないので、そのまま。 */
      if (fromHash().el) w.history.replaceState(st, '', at === TABS[0] ? location.pathname + location.search : '#' + at);
      else w.history.replaceState(st, '');
    } catch (e) { /* 書けなければ、頭へ寄るだけ */ }
  }
  /* 書き留めのある段（＝一度離れて、戻ってきた段）は、書き留めを今に合わせ続ける。
     戻ってきたあとで板を閉じたり読み進めたりして、「進む」やページの中のリンクで離れると go を通らない
     ＝ 古い書き留めが残り、次に戻ったとき閉じたはずの板が開いて前の位置へ飛ぶ。
     書き留めの無い段には何も足さない（新しく開いた段かどうかを、書き留めの有無で見分けている）。 */
  function remark() {
    var s = w.history.state;
    if (s && typeof s === 'object' && typeof s.pvgY === 'number') markY();
  }
  var markT = 0;
  w.addEventListener('scroll', function () {
    if (markT) w.clearTimeout(markT);
    markT = w.setTimeout(function () { markT = 0; remark(); }, 200);
  }, { passive: true });
  /* 人が選んだとき。履歴を1段積む（同じタブを押し直したときは積まない）。
     opt.replace … いまの段を行き先の段に書き換える（積まない）。「情報を追加」の面が自分のために積んだ1段を、
       そのまま行き先のタブの段にするときに使う。段を降りてから積み直すと、降りた先の位置をブラウザが
       あとから置き直して、切り替えたタブが途中から始まることがある。 */
  function go(tab, opt) {
    if (!bar) return false;
    if (!tab) tab = TABS[0];
    if (TABS.indexOf(tab) < 0) return false;
    if (tab !== at || cityAt) {
      var url = tab === TABS[0] ? location.pathname + location.search : '#' + tab;
      try {
        if (opt && opt.replace) w.history.replaceState({ pvg: tab }, '', url);
        else {
          markY();
          w.history.pushState({ pvg: tab }, '', url);
        }
      } catch (e) { /* 履歴に書けなくても、切り替えはする */ }
      if (cityAt) setCity('');                     // 都市を開いたまま「ステイ先」を押したら、一覧へ戻る
      show(tab);
    }
    toTop();
    return true;
  }

  /* ── 1.6) 就航地（ステイ先のタブ）─────────────────────────
     一覧（#pvg-stay）と、都市を選んだ先の詳細（#pvg-city）を入れ替える。住所は #stay-NRT ＝ 戻る・進むで行き来できる。
     ・詳細に出す字と写真は、選んだカードに書いてあるものをそのまま写す（ここに都市の表を持たない）。
     ・ホテルの欄は career-stay.js が埋める。欄の data-stay を書き換えてから cr:show を出す。
       ⚠️ ホテル名・住所・写真は、サーバーが確認済みのパイロットにだけ返す。ここでは1文字も作らない。
     ・探す欄と地域の札は、カードを隠すだけ（並べ替えない ＝ 順位を作らない）。 */
  var stayBox = d.getElementById('pvg-stay'), cityBox = d.getElementById('pvg-city');
  var stList = d.getElementById('pvg-st-list'), stQ = d.getElementById('pvg-st-q');
  var stItems = stList ? [].slice.call(stList.children) : [];
  var stPills = stayBox ? [].slice.call(stayBox.querySelectorAll('[data-pvg-rg]')) : [];
  var stN = stayBox ? stayBox.querySelector('[data-pvg-stn]') : null;
  var stNone = stayBox ? stayBox.querySelector('.pvg-st-none') : null;
  var stRg = '', cityAt = '';
  /* 長い一覧は最初の data-pvg-fold 枚だけ（2026-10-29）。地域か探す字で絞っているあいだは全部・「すべて見る」で開いたら閉じない */
  var stFold = stList ? parseInt(stList.getAttribute('data-pvg-fold') || '0', 10) || 0 : 0;
  var stAll = stayBox ? stayBox.querySelector('.pvg-st-all') : null;
  /* 探す字とカードの鍵（data-q）を同じ形にそろえる：全角・半角、大文字・小文字、欧文の飾り（ü → u）を区別しない。
     ⚠️ gen-airline-glance.mjs の searchKey と同じ式（片方だけ変えると、打った字がカードに当たらなくなる）。
        飾りを外すのは欧文だけ（かなの濁点まで外すと「バリ」と「ハリ」が同じになる）。
        名前の中の区切りの記号（. , ' ・ - かっこ）は落とす（"washington dc"・"xian" のように記号を打たない書き方でも当たる）。 */
  function norm(s) {
    s = String(s || '');
    try {
      if (s.normalize) {
        /* 欧文の飾り（文字のあとに重なる記号の並び）。番号は字で書かず、文字から作る */
        var marks = new RegExp('[' + String.fromCharCode(768) + '-' + String.fromCharCode(879) + ']', 'g');
        s = s.normalize('NFKC').replace(/[A-Za-z\u00C0-\u024F]+/g, function (x) { return x.normalize('NFD').replace(marks, ''); });
      }
    } catch (e) { /* そのまま */ }
    return s.toLowerCase().replace(/[.,'’‘・\-()]/g, '');
  }
  function filterCities() {
    var words = norm(stQ ? stQ.value : '').split(/\s+/).filter(Boolean), n = 0;
    var fold = stFold && !stRg && !words.length ? stFold : 0;
    stItems.forEach(function (li) {
      var q = li.getAttribute('data-q') || '';
      var on = (!stRg || li.getAttribute('data-rg') === stRg) && words.every(function (x) { return q.indexOf(x) >= 0; });
      li.hidden = !on || (fold > 0 && n >= fold);
      if (on) n++;
    });
    if (stAll) stAll.hidden = !(fold > 0 && n > fold);
    if (stN) stN.textContent = String(n);
    if (stNone) stNone.hidden = n > 0;
  }
  function cityCard(code) {
    var c = stList && /^[A-Z]{3}$/.test(code || '') ? stList.querySelector('.pvg-city[data-city="' + code + '"]') : null;
    /* 畳んだ先の街を開いた・そこから戻った：一覧を開いてから返す（隠れたカードには戻れない） */
    if (c && stFold && c.parentNode && c.parentNode.hidden) unfold();
    return c;
  }
  function unfold() {
    stFold = 0;
    if (stAll) { var b = stAll.querySelector('[data-pvg-stall]'); if (b) b.setAttribute('aria-expanded', 'true'); }
    filterCities();
  }
  if (stFold) filterCities();
  function textOf(box, sel) {
    var el = box.querySelector(sel);
    return el ? el.textContent : '';
  }
  function cd(key) { return cityBox.querySelector('[data-cd="' + key + '"]'); }
  function quiet(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }
  /* 一覧 ⇄ 詳細。code が空（か一覧に無い3字）なら一覧。画面を書き換えるだけで、履歴には触らない。 */
  function setCity(code) {
    if (!stayBox || !cityBox) return;
    var card = cityCard(code);
    if (!card) code = '';
    if (code === cityAt) return;
    cityAt = code;
    stayBox.hidden = !!code;
    cityBox.hidden = !code;
    var slot = cityBox.querySelector('.crl[data-live="hotels"]');
    if (!code) {
      if (slot) { slot.setAttribute('data-stay', ''); slot.setAttribute('data-city', ''); }
      return;
    }
    var name = textOf(card, '.pvg-town-n'), en = textOf(card, '.pvg-town-s');
    cd('name').textContent = name;
    cd('en').textContent = en;
    cd('country').textContent = textOf(card, '.pvg-city-k > small');
    cd('iata').textContent = code;
    cd('seasonal').hidden = !card.hasAttribute('data-seasonal');
    cd('maps').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(en + ' ' + code + ' airport');
    /* 写真：カードと同じ台帳の写真を、大きいほうで */
    var ph = cd('ph'), img = card.querySelector('.pvg-town-ph > img'), pic;
    ph.textContent = '';
    ph.classList.toggle('is-none', !img);
    if (img) {
      pic = d.createElement('img');
      pic.alt = img.alt;
      pic.decoding = 'async';
      pic.width = img.width;
      pic.height = img.height;
      /* 幅の決まりは HTML が持つ（ここに数字を書かない） */
      pic.setAttribute('sizes', ph.getAttribute('data-sizes') || '');
      pic.setAttribute('srcset', img.getAttribute('srcset') || '');
      pic.src = img.getAttribute('src');
    } else {
      pic = d.createElement('b');
      pic.setAttribute('aria-hidden', 'true');
      pic.textContent = code;
    }
    ph.appendChild(pic);
    /* 写真のクレジット。作者名とライセンス名を示すことが使う条件の写真だけ、一覧の下の行をそのまま写す */
    var cr = cd('credit'), row = stayBox.querySelector('.pvg-phl > li[data-cr="' + code + '"] > span');
    cr.textContent = '';
    cr.hidden = !row;
    if (row) {
      var copy = row.cloneNode(true);
      cr.appendChild(d.createTextNode(/^en(-|$)/i.test(d.documentElement.getAttribute('lang') || '') ? 'Photo: ' : '写真：'));
      while (copy.firstChild) cr.appendChild(copy.firstChild);
    }
    if (slot) { slot.setAttribute('data-stay', code); slot.setAttribute('data-city', name); }
  }
  /* 人が都市を選んだとき。履歴を1段積む */
  function openCity(code) {
    if (!bar || !cityBox || !cityCard(code)) return false;
    var from = at === 'stay' && !cityAt ? 'list' : '';
    markY();
    try {
      w.history.pushState({ pvg: 'stay', pvgCity: code, pvgFrom: from }, '', '#stay-' + code);
    } catch (e) { /* 履歴に書けなくても、開きはする */ }
    if (at !== 'stay') show('stay');
    setCity(code);
    fire();
    near(cityBox);
    quiet(cd('name'));
    return true;
  }
  /* 「‹ 就航地」。一覧から来たなら履歴を1段戻る（＝元の位置へ）。直接開いた・別のタブから来たなら、一覧に置き換える */
  function closeCity() {
    var s = w.history.state, was = cityAt;
    if (!was) return;
    if (s && typeof s === 'object' && s.pvgCity === was && s.pvgFrom === 'list') { w.history.back(); return; }
    try { w.history.replaceState({ pvg: 'stay' }, '', '#stay'); } catch (e) { /* 画面は戻す */ }
    setCity('');
    fire();
    near(stayBox);
    quiet(cityCard(was));
  }
  /* 探す字と地域の札を、いまの段に書き留める（書き換えるだけ ＝ 打つたびに段を積まない）。
     位置（pvgY）は足さない ── remark が「一度離れた段か」を位置の有無で見分けている。 */
  function noteFind() {
    if (at !== 'stay' || cityAt) return;
    try { w.history.replaceState(state({ pvgQ: stQ ? stQ.value : '', pvgRg: stRg }), ''); } catch (e) { /* 書けなくても探せる */ }
  }
  /* 書き留めた探す字と地域の札を、一覧に戻す（「戻る」・読み直しで帰ってきた一覧）。書き留めが無ければ何もしない（false）。
     札は一覧に在る地域だけ（無い地域なら「すべて」）。 */
  function restoreFind(s) {
    if (!s || typeof s !== 'object' || (typeof s.pvgQ !== 'string' && typeof s.pvgRg !== 'string')) return false;
    if (stQ && typeof s.pvgQ === 'string') stQ.value = s.pvgQ;
    var rg = typeof s.pvgRg === 'string' ? s.pvgRg : '';
    stRg = stPills.some(function (b) { return (b.getAttribute('data-pvg-rg') || '') === rg; }) ? rg : '';
    stPills.forEach(function (b) { b.setAttribute('aria-pressed', (b.getAttribute('data-pvg-rg') || '') === stRg ? 'true' : 'false'); });
    filterCities();
    return true;
  }
  if (stQ) {
    stQ.addEventListener('input', function () { filterCities(); noteFind(); });
    stQ.addEventListener('keydown', function (e) { if (e.key === 'Enter') stQ.blur(); });   // スマホの「検索」で、キーボードを下げる
    if (!restoreFind(w.history.state) && stQ.value) filterCities();   // 書き留めが無く、読み直しで欄に字が残っていたとき
  }
  if (bar) {
    w.PVGlance = { go: go, at: function () { return at; }, city: function () { return cityAt; }, mark: markY };
    var first = fromHash();
    show(first.tab);
    /* 指で送った時・幅が変わった時・字の形が届いた時に、端の印を測り直す */
    bar.addEventListener('scroll', tabEdges, { passive: true });
    if (w.ResizeObserver) new w.ResizeObserver(tabSeat).observe(bar); else w.addEventListener('resize', tabSeat);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(tabSeat);
    /* 開いた時点では全部の節が出ていたので、ブラウザが寄った先はずれている。隠したあとで寄り直す */
    if (first.city) { setCity(first.city); fire(); near(cityBox); }
    else if (first.el) near(first.el);
    w.addEventListener('popstate', function (e) {
      var r = fromHash(), was = cityAt, s = e.state && typeof e.state === 'object' ? e.state : null;
      /* ページの中の id の段：離れるときに書き留めたタブがあれば、それで見ていた（markY） */
      if (r.el && s && TABS.indexOf(s.pvgAt) >= 0) r.tab = s.pvgAt;
      if (r.tab === at && r.city === cityAt) {
        /* 同じタブのまま帰ってきた段（ページの中のリンクで離れて「戻る」）。開いている板が書き留めと違うときだけ、
           板を書き留めに合わせて位置を置く ── 離れた先で板を閉じていると、ページがその分短くなっていて、
           ブラウザが自分で戻す位置には別の中身が来る。板が同じなら何もしない（ブラウザが戻す位置で合っている）。 */
        if (s && typeof s.pvgY === 'number' && !OPEN[at]) {
          var cur = current(), want = s.pvgOpen || '';
          if ((cur ? cur.getAttribute('aria-controls') : '') !== want) {
            mores.forEach(function (b) { set(b, b.getAttribute('aria-controls') === want); });
            put(s.pvgY);
          }
        }
        return;
      }
      if (r.tab !== at) {
        show(r.tab);
        /* 開いていた板を開け直す（show が全部閉じる）。滑らせない ── このあと位置を置く */
        if (!OPEN[at] && s && s.pvgOpen) mores.forEach(function (b) { if (b.getAttribute('aria-controls') === s.pvgOpen) set(b, true); });
      }
      if (r.city !== cityAt) { setCity(r.city); fire(); }
      /* 就航地の一覧の段へ帰ってきた：探す字と地域の札を戻してから位置を置く（一覧の高さは、しぼり方で変わる） */
      if (r.tab === 'stay' && !r.city) restoreFind(s);
      var y = s && typeof s.pvgY === 'number' ? s.pvgY : null;
      if (y !== null) put(y); else if (cityAt) near(cityBox); else toTop();
      /* 詳細から一覧へ戻ったら、選んでいたカードへ焦点を返す（キーボードで続きから読める） */
      if (was && !cityAt && at === 'stay') quiet(cityCard(was));
    });
    /* ページの中の id への移動（別のタブに在る節へのリンク・住所の # を書き換えたとき） */
    w.addEventListener('hashchange', function () {
      var r = fromHash(), s = w.history.state;
      /* 「戻る・進む」で、位置を書き留めてある段へ帰ってきた回（新しく開いた段には何も書いていない）。
         タブと位置は popstate が置き終えている。ここで節へ寄り直すと、その位置を上書きする。 */
      var back = !!(s && typeof s === 'object' && typeof s.pvgY === 'number');
      if (back && r.el && TABS.indexOf(s.pvgAt) >= 0) r.tab = s.pvgAt;
      if (r.tab !== at) show(r.tab);
      if (r.city !== cityAt) { setCity(r.city); fire(); if (cityAt) near(cityBox); }
      if (r.el && !back) near(r.el);
    });
  }

  /* ── 2) タブへ ───────────────────────────────────────────
     その名前のタブが在ればそこへ。無い名前へは切り替えない
     （無いタブへ切り替えると、どの面も選ばれない ＝ ページの中身がぜんぶ消える）。
     ★ 昔は「募集要項」だけ、概要の下に在った古い節へ寄せていた。その節は外して、募集は概要の1枚になった（2026-10-08）。 */
  function toTab(tab) {
    if (bar) return TABS.indexOf(tab) >= 0 ? go(tab) : false;
    var ui = w.PVReviewUI;
    if (!ui || typeof ui.switchTab !== 'function') return false;
    var nav = d.getElementById('airline-tab-nav');
    if (nav && nav.querySelector('.airline-tab-btn[data-tab="' + tab + '"]')) {
      ui.switchTab(tab);
      /* タブの帯は画面の上に貼り付く（sticky）。ページの下のほうで押すと帯はもう貼り付いていて、
         帯の位置を見ても動く量は 0 ＝ 切り替えた面の途中か、その下の何も無い所が出る。
         帯のすぐ下に在る本文の箱の頭を、帯の下へ寄せる。 */
      var body = nav.nextElementSibling;
      glide(body ? body.getBoundingClientRect().top - HEAD - nav.offsetHeight : nav.getBoundingClientRect().top - HEAD);
      return true;
    }
    return false;
  }

  /* ── 3) 「ひとつ教えて」の話題 ─────────────────────────────
     広い箱では全部開いて横に並べる（質問の名前が最初から読める）。狭い箱では畳んだまま。
     開閉は <details> そのもの ＝ ここが動かなくても、押せば開く。境目は pv-glance.css の 640px と同じ。 */
  var askc = root.querySelector('.pvg-askc');
  var topics = [].slice.call(root.querySelectorAll('details.pvg-topic'));
  function flat() {
    if (!askc) return;
    var on = root.getBoundingClientRect().width >= 640;
    if (on === askc.hasAttribute('data-flat')) return;
    if (on) askc.setAttribute('data-flat', ''); else askc.removeAttribute('data-flat');
    topics.forEach(function (t) {
      t.open = on;
      var s = t.querySelector('summary');
      if (!s) return;
      if (on) s.setAttribute('tabindex', '-1'); else s.removeAttribute('tabindex');
    });
  }
  flat();
  if (w.ResizeObserver) new w.ResizeObserver(flat).observe(root);
  else w.addEventListener('resize', flat);

  d.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (askc && askc.hasAttribute('data-flat') && t.closest('.pvg-topic > summary')) { e.preventDefault(); return; }
    /* ページの中の id へのリンク（出所・ホテル・レストラン …）は go を通らずに履歴を1段積む。
       離れる前に、いまの段へ位置と開いている板を書き留める ── 書き留めが無いと、「戻る」で板が閉じたまま、
       板の高さの分だけ別の所が出る（実測：PC で約560px・スマホで約950px）。
       タブのリンクと都市のカードは下で go・openCity が自分で書き留める（二度書いても同じ字）。 */
    var jump = bar && !e.defaultPrevented && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) ? t.closest('a[href^="#"]') : null;
    if (jump) {
      var jid = '';
      try { jid = decodeURIComponent(String(jump.getAttribute('href')).slice(1)); } catch (x) { jid = ''; }
      if (jid && d.getElementById(jid)) markY();
    }
    /* 「ほか◯問」… その話題の残りの質問を出し、出てきた最初の質問へ焦点を移す */
    var am = t.closest('[data-pvg-askmore]');
    if (am && root.contains(am)) {
      var tp = am.closest('.pvg-topic');
      if (tp) {
        var lis = tp.querySelectorAll('.pvg-ask li');
        tp.setAttribute('data-all', '');
        var nx = lis[4] && lis[4].querySelector('a');
        if (nx) nx.focus();
      }
      return;
    }
    var sz = t.closest('[data-pvg-size]');
    if (sz && rentBox && rentBox.contains(sz)) { pickSize(sz.getAttribute('data-pvg-size')); return; }
    var tw = t.closest('.pvg-town[data-town]');
    if (tw && root.contains(tw)) { pickTown(tw.getAttribute('data-town'), true); return; }
    /* 就航地のカード（別のタブで開く押し方は、ブラウザに任せる ＝ #stay-NRT がそのまま開く） */
    var ct = t.closest('.pvg-city[data-city]');
    if (ct && root.contains(ct)) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
      if (openCity(ct.getAttribute('data-city'))) e.preventDefault();
      return;
    }
    if (cityBox && t.closest('[data-pvg-cityback]') && cityBox.contains(t)) { closeCity(); return; }
    var all = t.closest('[data-pvg-stall]');
    if (all && stayBox && stayBox.contains(all)) {
      var first = stItems[stFold] || null;
      unfold();
      /* ボタンは消える ── 開いた最初のカードへ（キーボードで続きから読める） */
      if (first) quiet(first.querySelector('.pvg-city'));
      return;
    }
    var rg = t.closest('[data-pvg-rg]');
    if (rg && stayBox && stayBox.contains(rg)) {
      stRg = rg.getAttribute('data-pvg-rg') || '';
      stPills.forEach(function (b) { b.setAttribute('aria-pressed', b === rg ? 'true' : 'false'); });
      filterCities();
      noteFind();
      return;
    }
    var more = t.closest('.pvg-more[aria-controls]');
    if (more && root.contains(more)) {
      if (more.getAttribute('aria-expanded') === 'true') set(more, false); else openOnly(more);
      remark();
      return;
    }
    var x = t.closest('.pvg-x');
    if (x && root.contains(x) && !OPEN[at]) {
      var p = x.closest('.pvg-panel');
      mores.forEach(function (b) {
        if (panelOf(b) === p) { set(b, false); b.focus(); }
      });
      remark();
      return;
    }
    var tab = t.closest('[data-pvg-tab]');
    if (tab) { if (toTab(tab.getAttribute('data-pvg-tab'))) e.preventDefault(); return; }
    var rev = t.closest('a[href="#reviews"]');
    if (rev && rev.closest('.pvg,.pvg-hero')) {
      var cat = rev.getAttribute('data-pvg-cat') || '';
      var plain = !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);
      if (plain && /^[a-z]{2,12}$/.test(cat) && typeof w.pvSetReviewCat === 'function') {
        /* 要約の点：その分類で口コミを開き、もとの口コミに札を付ける（タブを替えるのは向こうの1回だけ）。 */
        e.preventDefault();
        w.pvSetReviewCat(cat, (rev.getAttribute('data-pvg-ids') || '').split(',').filter(Boolean));
      } else if (plain && toTab('reviews')) e.preventDefault();
    }
  });
  d.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || OPEN[at]) return;
    var b = current();
    if (!b) return;
    set(b, false);
    b.focus();
    remark();
  });

  /* ── 日付を途中で折らない（2026-10-25）────────────────────
     注記の日付が行の終わりにかかると、日付の途中で折れていた（イベリア 1440 で「2025年1月／1日」。英語は「1 January／2025」も起きる）。
     日付の塊を、折らない印（.pvg-nw ── 見た目は pv-glance.css）で包む。字は1文字も変えない（読み上げも通貨切替も同じ字を読む）。
     どの会社のページも・日本語も英語も、この1つの決まり。生きた欄（.crl ── career-live.js が描き直す）には触らない。
     CSS だけでは英語の語の切れ目を止められず、生成する HTML に印を入れると注記の字を読む検査がみな組み直しになるので、ここで包む。 */
  var DATE_RE = /\d{4}年(?:\d{1,2}月(?:\d{1,2}日)?|度)?|(?:\d{1,2} )?(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}/g;
  function keepDates(box) {
    var walk = d.createTreeWalker(box, NodeFilter.SHOW_TEXT, null), hits = [], n;
    while ((n = walk.nextNode())) {
      var up = n.parentNode;
      if (!up || up.closest('.crl, .pvg-nw')) continue;
      DATE_RE.lastIndex = 0;
      if (DATE_RE.test(n.nodeValue)) hits.push(n);
    }
    hits.forEach(function (t) {
      var s = t.nodeValue, frag = d.createDocumentFragment(), from = 0, m;
      DATE_RE.lastIndex = 0;
      while ((m = DATE_RE.exec(s))) {
        if (m.index > from) frag.appendChild(d.createTextNode(s.slice(from, m.index)));
        var nw = d.createElement('span');
        nw.className = 'pvg-nw';
        nw.textContent = m[0];
        frag.appendChild(nw);
        from = m.index + m[0].length;
      }
      if (from < s.length) frag.appendChild(d.createTextNode(s.slice(from)));
      t.parentNode.replaceChild(frag, t);
    });
  }
  [].forEach.call(d.querySelectorAll('.pvg small, .pvg .pvg-note'), keepDates);
})(window, document);
