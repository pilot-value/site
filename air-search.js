/* ════════════════════════════════════════════════════════════════
   口コミフォームの「会社名で探す」（2026-11-19 オーナー指示「航空会社が検索しづらいから、給与投稿と同じ形にして」）
   読むのは submit-review.html（日英西）。見た目は air-search.css。

   ★動きは給与フォーム（pay-report.html の「会社を名前で探す」の airQ*）と同じ。片方を直したら、もう片方も直す。
   ★候補の元は <select id="f-airline"> の <option> そのもの（value ／ 表示名 ／ data-alias ／ 親 optgroup の label）
     ＋ search.js の window.PV_DB（年収のある会社が 'ANA' / 'NH' / '全日空' を既に持つ）。社名を新しく書かない。
   ★検索は任意。触らなければ今までどおり一覧から選べる。<select> は消しも隠しもしない（送る値はこれ）。
   ★押したら一覧を選び直して change を飛ばすだけ（「その他」の欄の開け閉めは、ページの toggleOtherAirline が今までどおりやる）。
   ★0件でも投稿は止めない。候補があってもなくても、最後に必ず「一覧にない会社として送る」の行を出す
     （給与フォームで 2026-09-13 にオーナーが指摘した逃げ道。条件つきに戻さない）。
   ════════════════════════════════════════════════════════════════ */
(function (d, w) {
  'use strict';
  var sel = d.getElementById('f-airline'), qbox = d.getElementById('f-airline-q');
  var hits = d.getElementById('f-airline-hits'), qnote = d.getElementById('f-airline-qn');
  var other = d.getElementById('f-airline-other');
  if (!sel || !qbox || !hits || !qnote) return;

  var LANG = String(d.documentElement.getAttribute('lang') || 'ja').slice(0, 2).toLowerCase();
  var TX = {
    ja: { hits: function (k) { return '候補 ' + k + '件'; },
          other: '一覧にない会社として送る', zero: '候補が見つかりません。この名前のまま送れます。' },
    en: { hits: function (k) { return k + (k === 1 ? ' match' : ' matches'); },
          other: 'Submit as a company not on the list', zero: 'No match — you can still submit under this name.' },
    es: { hits: function (k) { return k + (k === 1 ? ' coincidencia' : ' coincidencias'); },
          other: 'Enviar como empresa que no está en la lista', zero: 'Sin coincidencias — aún puedes enviar con este nombre.' }
  };
  var T = TX[LANG] || TX.en;
  var MAX = 8;

  /* 突き合わせ用の正規化。空白・中黒・長音・括弧・記号を落として小文字に潰すだけ（給与フォームの airQnorm と同じ）。 */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[\s　ー・･'".,\/_()（）\[\]-]+/g, '');
  }
  var IDX = null;
  /* 候補の索引。<option> を1度だけ舐めて作る（作り直さないので毎打鍵が軽い）。 */
  function index() {
    if (IDX) return IDX;
    var extra = {}, db = w.PV_DB;
    if (db && db.length) for (var i = 0; i < db.length; i++) {
      var row = db[i], m = /airlines\/([a-z0-9-]+)\.html/.exec(row.f || '');
      if (m) extra[m[1]] = (row.t || []).concat([row.n || '', row.e || '']);
    }
    IDX = [];
    for (var j = 0; j < sel.options.length; j++) {
      var o = sel.options[j];
      if (!o.value || o.value === 'other') continue;
      var alias = (o.getAttribute('data-alias') || '').split('|').filter(Boolean);
      var keys = [o.value, o.textContent].concat(alias, extra[o.value] || []);
      IDX.push({
        v: o.value,
        t: (o.textContent || '').trim(),
        g: (o.parentNode && o.parentNode.label) || '',
        k: keys.map(norm).filter(Boolean)
      });
    }
    return IDX;
  }
  /* 頭から一致したものを先に、途中で一致したものを後に。上位8件だけ返す。 */
  function find(q) {
    var nq = norm(q);
    if (!nq) return [];
    var head = [], tail = [], all = index();
    for (var i = 0; i < all.length; i++) {
      var a = all[i], at = -1;
      for (var k = 0; k < a.k.length; k++) { var p = a.k[k].indexOf(nq); if (p >= 0 && (at < 0 || p < at)) at = p; }
      if (at === 0) head.push(a);
      else if (at > 0) tail.push(a);
    }
    return head.concat(tail).slice(0, MAX);
  }
  function clear() {
    hits.textContent = '';
    hits.hidden = true;
    qnote.textContent = '';
  }
  /* ★textContent で入れる。名前には本人が打ち込んだ文字列が混ざる。 */
  function row(code, name, side, cls) {
    var b = d.createElement('button');
    b.type = 'button';
    b.className = 'air-hit' + cls;
    b.setAttribute('data-v', code);
    var n = d.createElement('span');
    n.className = 'ah-n';
    n.textContent = name;
    var g = d.createElement('span');
    g.className = 'ah-g';
    g.textContent = side;
    b.appendChild(n);
    b.appendChild(g);
    hits.appendChild(b);
  }
  function render() {
    var q = (qbox.value || '').trim();
    hits.textContent = '';
    if (!q) { clear(); return; }
    var list = find(q);
    for (var i = 0; i < list.length; i++) row(list[i].v, list[i].t, list[i].g, '');
    /* 逃げ道は候補があっても必ず最後に（緑の行は候補ではないので、件数には数えない）。 */
    row('other', q.slice(0, 80), T.other, ' air-hit--other');
    hits.hidden = false;
    qnote.textContent = list.length ? T.hits(list.length) : T.zero;
  }
  function pick(code, typed) {
    var isOther = code === 'other';
    /* 会社名の欄の長さに合わせて切る（口コミは40字・給与は80字）。 */
    if (isOther && other) other.value = typed.slice(0, other.maxLength > 0 ? other.maxLength : 80);
    sel.value = code;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    qbox.value = '';
    clear();
    /* 「一覧にない会社」は会社名の欄へカーソルを移して、打った字を選択状態に（検索語は途中までのことが多い）。 */
    if (isOther && other) {
      other.focus();
      if (other.setSelectionRange) other.setSelectionRange(0, other.value.length);
    } else sel.focus();
  }

  var timer = 0;
  qbox.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(render, 250);
  });
  qbox.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { qbox.value = ''; clear(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'Enter') return;
    e.preventDefault();
    clearTimeout(timer);
    render();
    var first = hits.querySelector('.air-hit');
    if (first) first.focus();
  });
  hits.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.air-hit');
    if (b) pick(b.getAttribute('data-v'), (qbox.value || '').trim());
  });
  hits.addEventListener('keydown', function (e) {
    var b = e.target.closest && e.target.closest('.air-hit');
    if (!b) return;
    if (e.key === 'Escape') { qbox.focus(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    var all = [].slice.call(hits.querySelectorAll('.air-hit'));
    var at = all.indexOf(b) + (e.key === 'ArrowDown' ? 1 : -1);
    if (at < 0) qbox.focus();
    else if (all[at]) all[at].focus();
  });
  /* 一覧から直接選んだら、打ちかけの検索語を片づける（残ると「いま何を選んでいるのか」が2か所に見える）。 */
  sel.addEventListener('change', function () { if (qbox.value) { qbox.value = ''; clear(); } });
})(document, window);
