/* ═══════════════════════════════════════════════════════════════════
   pv-contrib.js ── 会社ページの上で開く「情報を追加」の面

   会社ページから離れずに、情報を1つ足せるようにする。
   見た目は pv-contrib.css（どの規則も .pvc で始まる）。

   ■ ページとの約束
     window.PVContrib = { open({ topic }), close() }
       topic ＝ ''／'list'（項目の一覧）・'work'（月の勤務）・'taxi'（通勤・タクシー）
     data-pvc-open="<topic>" を持つ要素を押すと開く（このファイルが自分で聞く）。
     住所に ?add=<topic> が付いていたら、それを開いて住所から外す。
     会社は <body data-airline> と data-pvc-name（無ければ .hero-airline h1）から読む。
       ＝ もう一度会社を選ばせない。
     保存できたら document に 'pvc:saved'（detail = { topic, slug }）を流す。

   ■ 絶対に崩さないこと
     ・「空欄」は未回答＝ null で送る。「0」は 0 で送る。0 で埋めない・0 を消さない。
     ・「あなたの投稿 N件」は、ログインしている本人についてサーバが返した行数だけ。
       質問の数を答えの数として出さない。未ログインには件数を1つも出さない。
     ・サーバやユーザーから来た文字は textContent でしか入れない
       （innerHTML・insertAdjacentHTML・document.write を使わない）。
     ・このファイルに金額を書かない。
     ・勤務を保存しても REAL PAY は開かない。開くとも言わない。
     ・開くと履歴を1段だけ積む（住所は同じ）。「戻る」で閉じる。
       開いたまま読み直した人を、1段取り残さない（boot の settle）。

   ■ 保存先（どちらも既存の関数。引数は p の1つだけ）
     月の勤務       → submit_work_month ／ 読むのは my_work_months
     通勤・タクシー → submit_airline_conditions ／ 読むのは my_airline_conditions
                      質問と選択肢は pv-conditions.json をその場で読む（写しを持たない）。
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
    skipPop: false, onSkip: null, queue: null, tok: 0, hideT: 0, taken: {}
  };
  /* 本人の投稿。k ＝ idle／loading／ok／anon／off／fail */
  var M = { seq: 0, p: null, work: { k: 'idle', rows: [] }, cond: { k: 'idle', answers: [] } };
  var W = { ym: '', bufs: {}, own: false, notice: null, err: null, last: null, busy: false, els: {} };
  var T = { vals: {}, dirty: {}, note: '', noteDirty: false, fold: false, own: false, notice: null, last: null, busy: false, els: {} };

  var TOPIC_NAME = { work: '月の勤務', taxi: '通勤・タクシー' };
  function topicOf(v) { v = trim(v); return v === 'work' || v === 'taxi' ? v : 'list'; }

  /* ── 下書きと、送れなかった1件 ──────────────────────────── */
  function draftOf(topic) {
    if (topic === 'work') return { ym: W.ym, bufs: W.bufs, own: W.own };
    return { vals: T.vals, dirty: T.dirty, note: T.note, noteDirty: T.noteDirty, fold: T.fold, own: T.own };
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
    if (str(j.uid) !== uid()) return null;            // 別の人の分は出さない
    return j;
  }
  function keepOutbox(topic) {
    lset(OUTBOX, JSON.stringify({ v: 1, slug: slug(), topic: topic, uid: uid(), at: Date.now(), draft: draftOf(topic) }));
  }
  function dropOutbox(topic) {
    var o = outbox();
    if (o && (!topic || o.topic === topic)) ldel(OUTBOX);
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
      T.vals = dr.vals && typeof dr.vals === 'object' ? dr.vals : {};
      T.dirty = dr.dirty && typeof dr.dirty === 'object' ? dr.dirty : {};
      T.note = str(dr.note); T.noteDirty = !!dr.noteDirty; T.fold = !!dr.fold; T.own = !!dr.own;
      T.notice = got.why === 'fail' ? failNote('taxi') : (fresh ? backNote() : null);
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
        { id: 'retry', label: 'もう一度送る', on: function () { if (topic === 'work') sendWork(); else sendTaxi(); } },
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
    else { T.vals = {}; T.dirty = {}; T.note = ''; T.noteDirty = false; T.own = false; T.notice = null; }
    show(S.view === 'list' ? 'list' : topic);
  }

  /* ── 本人の投稿を読む ───────────────────────────────────── */
  function loadMine(force) {
    if (!hasToken()) {
      M.seq++; M.p = null;
      M.work = { k: 'anon', rows: [] }; M.cond = { k: 'anon', answers: [] };
      return Promise.resolve();
    }
    if (M.p && !force) return M.p;
    var seq = ++M.seq, s = slug(), was = { work: M.work, cond: M.cond };
    if (M.work.k !== 'ok') M.work = { k: 'loading', rows: [] };
    if (M.cond.k !== 'ok') M.cond = { k: 'loading', answers: [] };
    function bad(r) { return r.kind === 'login' ? 'anon' : (r.kind === 'off' ? 'off' : 'fail'); }
    var a = rpc('my_work_months', { airline: s }, 9000).then(function (r) {
      if (seq !== M.seq) return;
      M.work = r.kind === 'ok' && Array.isArray(r.data.rows)
        ? { k: 'ok', rows: r.data.rows.filter(function (x) { return x && typeof x === 'object'; }) }
        : { k: bad(r), rows: [] };
    });
    var b = rpc('my_airline_conditions', { airline: s }, 9000).then(function (r) {
      if (seq !== M.seq) return;
      M.cond = r.kind === 'ok' && Array.isArray(r.data.answers)
        ? { k: 'ok', answers: r.data.answers.filter(function (x) { return x && x.question_id && (!x.airline || x.airline === s); }) }
        : { k: bad(r), answers: [] };
    });
    var p = Promise.all([a, b, conds().then(null, function () { return null; })]).then(function () {
      if (seq !== M.seq) return;
      var changed = !(was.work.k === 'ok' && was.cond.k === 'ok' && same(was.work, M.work) && same(was.cond, M.cond));
      onMine(changed);
    });
    M.p = p;
    return p;
  }
  function onMine(changed) {
    if (!S.open) return;
    if (S.view === 'list') { paintCounts(); return; }
    if (!changed) return;
    /* 打っている最中の面は作り直さない（作り直すと、入力している欄から焦点が外れる）。
       読み込みを待って止めてあった面だけは、必ず作り直して入力できるようにする。 */
    if (S.view === 'work') {
      if (!W.els.loading && W.bufs[W.ym] && W.bufs[W.ym].dirty) { if (W.els.sync) W.els.sync(); return; }
      Object.keys(W.bufs).forEach(function (k) { if (!W.bufs[k].dirty) delete W.bufs[k]; });
      renderWork();
    } else if (S.view === 'taxi') {
      if (!T.els.loading && (T.noteDirty || Object.keys(T.dirty).length)) return;
      renderTaxi();
    }
  }
  function rowFor(ym) {
    if (M.work.k !== 'ok') return null;
    var p = ym.split('-'), y = +p[0], m = +p[1], i, r;
    for (i = 0; i < M.work.rows.length; i++) { r = M.work.rows[i]; if (+r.year === y && +r.month === m) return r; }
    return null;
  }
  function savedMap() {
    var o = {};
    if (M.cond.k === 'ok') M.cond.answers.forEach(function (a) { o[a.question_id] = a; });
    return o;
  }
  function qTopic(id) {
    var i, q = V.conds ? V.conds.questions : [];
    for (i = 0; i < q.length; i++) if (q[i].id === id) return q[i].topic || '';
    return '';
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
    if (view !== 'list' && S.view === 'list') S.viaList = true;
    S.view = view;
    S.main.scrollTop = 0;
    if (view === 'list') renderList();
    else if (view === 'work') renderWork();
    else if (view === 'taxi') renderTaxi();
    else if (view === 'work-saved') renderWorkSaved();
    else if (view === 'taxi-saved') renderTaxiSaved();
    mark(view.split('-')[0]);
    try { S.title.focus({ preventScroll: true }); } catch (e) { /* 古いブラウザ */ }
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
     動かすのは面の中だけ（ページは動かさない）。ほかの知らせは、出した側が自分で見える所へ送っている。 */
  function revealNotice(box, o) {
    var n = o && (o.kind === 'back' || o.kind === 'fail') && box ? box.firstChild : null;
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
    cb.addEventListener('change', function () { st.own = cb.checked; onSend(); });
    act.appendChild(own); act.appendChild(send);
    return { act: act, cb: cb, send: send };
  }

  /* ── 項目の一覧 ─────────────────────────────────────────── */
  var TILES = [
    { k: 'work', t: '勤務', q: '最近の勤務で、良かったこと・変わったことは？', view: 'work' },
    { k: 'taxi', t: '通勤・タクシー', q: 'いつ、どこまで、誰の負担で使えますか？', view: 'taxi' },
    { k: 'staff_travel', t: 'Staff Travel', q: '本人・家族の範囲、回数、自己負担は？', href: 'airline-conditions.html?airline={s}&q=staff_travel' },
    { k: 'upgrade', t: '機長昇格', q: '昇格までの年数と、選考・訓練の条件は？', href: 'airline-conditions.html?airline={s}&q=upgrade_years' },
    { k: 'stay', t: 'ホテル・ステイ', q: 'パイロット限定', href: 'career.html?airline={s}&tab=life' }
  ];
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
    S.main.appendChild(el('p', 'pvc-under', 'ひとつの項目から追加できます。'));
    paintCounts();
  }
  /* 件数は、サーバが返した本人の行だけから作る。取れていないものは数にしない。 */
  function counts() {
    var c = {};
    if (M.work.k === 'ok') c.work = M.work.rows.length;
    if (M.cond.k === 'ok' && V.conds) {
      c.taxi = 0; c.staff_travel = 0; c.upgrade = 0;
      M.cond.answers.forEach(function (a) {
        var t = qTopic(a.question_id);
        if (Object.prototype.hasOwnProperty.call(c, t) && t !== 'work') c[t]++;
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
  function workBuf(ym) {
    var b = W.bufs[ym];
    if (b) return b;
    var row = rowFor(ym), last = M.work.k === 'ok' && M.work.rows.length ? M.work.rows[0] : null;
    var cur = W.bufs[W.ym] && W.ym !== ym ? W.bufs[W.ym] : null;
    b = { dirty: false };
    if (row) {
      b.position = str(row.position); b.fleet = str(row.fleet); b.base_iata = str(row.base_iata);
      NUMS.forEach(function (n) { b[n.k] = row[n.k] == null ? '' : String(row[n.k]); });
      b.duty_hours_basis = str(row.duty_hours_basis); b.commute_included = str(row.commute_included); b.note = str(row.note);
    } else {
      b.position = cur ? cur.position : (last ? str(last.position) : '');
      b.fleet = cur ? cur.fleet : (last ? str(last.fleet) : '');
      b.base_iata = cur ? str(cur.base_iata) : (last ? str(last.base_iata) : '');
      NUMS.forEach(function (n) { b[n.k] = ''; });
      b.duty_hours_basis = ''; b.commute_included = ''; b.note = '';
    }
    W.bufs[ym] = b;
    return b;
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
    var loading = logged && (M.work.k === 'loading' || M.work.k === 'idle');
    var b = workBuf(W.ym), row = rowFor(W.ym), E = W.els = {};
    clear(S.main);

    var f = el('form', 'pvc-form', null, { novalidate: '', autocomplete: 'off', 'data-pvc-form': 'work' });
    f.addEventListener('submit', function (e) { e.preventDefault(); sendWork(); });

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
    function touch() { b.dirty = true; }
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
    fl.sel.addEventListener('change', function () { b.fleet = fl.sel.value; touch(); });
    fd.appendChild(fl.wrap); g.appendChild(fd);

    var po = [['', '選択してください']];
    V.vocab.positions.forEach(function (x) { if (!x.retired || x.code === b.position) po.push([x.code, tailless(x.ja)]); });
    var pd = el('div', 'pvc-field');
    pd.appendChild(el('label', 'pvc-label', 'その月の職位は？', { 'for': 'pvc-f-position' }));
    var ps = select('position', po, b.position);
    ps.sel.addEventListener('change', function () { b.position = ps.sel.value; touch(); line(); clearErr('position'); });
    pd.appendChild(ps.wrap); E.ctl.position = ps.sel; E.err.position = errBox(pd, 'position'); g.appendChild(pd);

    NUMS.forEach(function (n) {
      var d1 = el('div', 'pvc-field');
      d1.appendChild(el('label', 'pvc-label', n.label, { 'for': 'pvc-f-' + n.k }));
      var i = el('input', 'pvc-input', null, {
        type: 'text', name: n.k, id: 'pvc-f-' + n.k, inputmode: n.mode, autocomplete: 'off',
        placeholder: row && row[n.k] == null ? NONE : n.ph, maxlength: '12'
      });
      i.value = str(b[n.k]);
      i.addEventListener('input', function () { b[n.k] = i.value; touch(); clearErr(n.k); });
      d1.appendChild(i); E.ctl[n.k] = i; E.err[n.k] = errBox(d1, n.k); g.appendChild(d1);
    });

    var bd = el('div', 'pvc-field pvc-wide');
    bd.appendChild(el('label', 'pvc-label', '勤務・拘束時間をどう数えましたか？（任意）', { 'for': 'pvc-f-duty_hours_basis' }));
    var bs = select('duty_hours_basis', BASIS, b.duty_hours_basis);
    bs.sel.addEventListener('change', function () { b.duty_hours_basis = bs.sel.value; touch(); });
    bd.appendChild(bs.wrap); g.appendChild(bd);

    var cd = el('div', 'pvc-field pvc-wide');
    cd.appendChild(el('label', 'pvc-label', '通勤時間は含めていますか？（任意）', { 'for': 'pvc-f-commute_included' }));
    var cs = select('commute_included', COMMUTE, b.commute_included);
    cs.sel.addEventListener('change', function () { b.commute_included = cs.sel.value; touch(); });
    cd.appendChild(cs.wrap); g.appendChild(cd);

    var nd = el('div', 'pvc-field pvc-wide');
    nd.appendChild(el('label', 'pvc-label', 'ほかに伝えたいこと（任意）', { 'for': 'pvc-f-note' }));
    var ta = el('textarea', 'pvc-area', null, {
      name: 'note', id: 'pvc-f-note', rows: '3', maxlength: String(NOTE_MAX),
      placeholder: '具体的な条件以外に、伝えたいことがあれば'
    });
    ta.value = str(b.note);
    ta.addEventListener('input', function () { b.note = ta.value; touch(); clearErr('note'); });
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
      tag.hidden = !rowFor(W.ym);
      E.send.disabled = !W.own || W.busy || loading;
      E.send.textContent = W.busy ? '送っています…' : (rowFor(W.ym) ? '匿名で更新する' : '匿名で追加する');
      var t = '';
      if (loading) t = 'これまでの投稿を確認しています…';
      else if (!logged) t = '送るときにログインが必要です。入力した内容は、ログインのあともこの画面に残ります。';
      else if (M.work.k === 'fail') t = 'これまでの投稿を読み込めませんでした。このまま送れます（同じ月の投稿があれば、今回の内容に置き換わります）。';
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
  function setBusy(st, on) { st.busy = on; if (st.els && st.els.sync) st.els.sync(); }
  function sendWork() {
    if (W.busy || S.view !== 'work') return;
    var pl = workPayload();
    if (!pl.position) return workSay({ kind: 'said', title: '保存できませんでした', text: '職位を選んでください。' }, 'position');
    if (!NUMS.some(function (n) { return pl[n.k] !== null; })) {
      return workSay({ kind: 'said', title: '保存できませんでした', text: '勤務の項目を1つ以上入れてください（分かるものだけで大丈夫です）。' }, NUMS[0].k);
    }
    if (!hasToken()) return toLogin('work');
    W.notice = null; W.err = null; paintWorkNotice();
    setBusy(W, true);
    rpc('submit_work_month', pl).then(function (r) {
      setBusy(W, false);
      if (r.kind === 'ok' && r.data.ok) return workSaved(pl, r.data);
      if (r.kind === 'login') return toLogin('work');
      if (r.kind === 'said') return workSay({ kind: 'said', title: '保存できませんでした', text: r.msg }, fieldOf(r.msg));
      if (r.kind === 'off') return workSay(offNote());
      keepOutbox('work');
      workSay(failNote('work'));
    });
  }
  function workSaved(pl, data) {
    var ym = W.ym, row = {
      year: pl.year, month: pl.month, position: pl.position, fleet: pl.fleet, base_iata: pl.base_iata,
      duty_hours_basis: pl.duty_hours_basis, commute_included: pl.commute_included, note: pl.note
    };
    NUMS.forEach(function (n) { row[n.k] = pl[n.k]; });
    /* サーバが「保存した」と返した1行を、手元の一覧にも入れる（このあと取り直して確かめる） */
    if (M.work.k === 'ok') {
      M.work.rows = M.work.rows.filter(function (r) { return !(+r.year === row.year && +r.month === row.month); });
      M.work.rows.push(row);
      M.work.rows.sort(function (a, b2) { return (b2.year - a.year) || (b2.month - a.month); });
    }
    W.last = { ym: ym, row: row, replaced: !!data.replaced };
    delete W.bufs[ym];
    W.own = false; W.notice = null; W.err = null;
    dropDraft('work'); dropOutbox('work');
    track('contrib_saved', 'work');
    try { d.dispatchEvent(new CustomEvent('pvc:saved', { detail: { topic: 'work', slug: slug() } })); } catch (e) { /* 古いブラウザ */ }
    show('work-saved');
    loadMine(true);
  }
  function sumRow(dl, key, k, v, long) {
    var r = el('div', 'pvc-sum-r' + (long ? ' is-long' : ''), null, { 'data-k': key });
    r.appendChild(el('dt', 'pvc-sum-k', k));
    var none = v == null || v === '';
    r.appendChild(el('dd', 'pvc-sum-v' + (none ? ' is-none' : ''), none ? NONE : v));
    dl.appendChild(r);
  }
  function savedShell(titleText, subText, fill, onEdit) {
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
    c.appendChild(dl);
    var a = el('div', 'pvc-saved-a');
    var e1 = el('button', 'pvc-ghost', '修正する', { type: 'button', 'data-pvc-act': 'edit' });
    e1.addEventListener('click', onEdit);
    var e2 = el('button', 'pvc-send', '別の項目を追加', { type: 'button', 'data-pvc-act': 'more' });
    e2.addEventListener('click', function () { S.viaList = true; show('list'); });
    a.appendChild(e1); a.appendChild(e2);
    c.appendChild(a);
    S.main.appendChild(c);
  }
  function renderWorkSaved() {
    var L = W.last;
    if (!L) return renderWork();
    setHead(TOPIC_NAME.work);
    var r = L.row, parts = [coName()], pl = posLabel(r.position);
    if (pl) parts.push(pl);
    parts.push(ymText(L.ym));
    savedShell(L.replaced ? '更新しました' : '保存しました', parts.join(' · '), function (dl) {
      sumRow(dl, 'fleet', '乗務した機種', fleetLabel(r.fleet));
      NUMS.forEach(function (n) { sumRow(dl, n.k, n.short, r[n.k] == null ? null : String(r[n.k]) + n.unit); });
      sumRow(dl, 'duty_hours_basis', '勤務・拘束時間の数え方', pick(BASIS, str(r.duty_hours_basis)) && r.duty_hours_basis ? pick(BASIS, r.duty_hours_basis) : null);
      sumRow(dl, 'commute_included', '通勤時間', r.commute_included ? pick(COMMUTE, r.commute_included) : null);
      sumRow(dl, 'note', 'ほかに伝えたいこと', r.note, !!r.note);
    }, function () { W.ym = L.ym; show('work'); });
  }

  /* ── 通勤・タクシー ─────────────────────────────────────── */
  /* 並びは見本どおり：どの制度 → いつ → どこまで →（上限）→ 誰の負担。
     質問の文と選択肢は pv-conditions.json のもの（ここに写しを持たない）。 */
  var TAXI_ORDER = ['commuting_transport', 'commuting_transport_method', 'commuting_taxi_when', 'commuting_bus_when',
    'commuting_taxi_where', 'commuting_taxi_cap', 'commuting_taxi_cost', 'commuting_bus_cost'];
  var UNK = 'unknown';
  var WHY = {
    unknown_question: 'この質問はいま受け付けていません。',
    rate_limited: '1日に送れる件数の上限に達しました。明日また続きをどうぞ。',
    parent_missing: '上の質問の答えと合わないため、保存されませんでした。',
    missing_code: '選択肢を選び直してください。',
    bad_code: '選択肢を選び直してください。',
    too_long: '補足が長すぎます。短くして送り直してください。',
    text_too_long: '補足が長すぎます。短くして送り直してください。'
  };
  function taxiQs() {
    var all = V.conds ? V.conds.questions : [], by = {}, out = [];
    all.forEach(function (q) { if (q.topic === 'taxi') by[q.id] = q; });
    TAXI_ORDER.forEach(function (id) { if (by[id]) { out.push(by[id]); delete by[id]; } });
    Object.keys(by).forEach(function (id) { out.push(by[id]); });       // 知らない質問が増えていても落とさない
    return out;
  }
  function qById(id) {
    var i, q = V.conds ? V.conds.questions : [];
    for (i = 0; i < q.length; i++) if (q[i].id === id) return q[i];
    return null;
  }
  function unkCode() { return (V.conds && V.conds.unknown) || UNK; }
  function fromSaved(q, a) {
    if (!a) return q.kind === 'multi' ? [] : '';
    if (q.kind === 'multi') return Array.isArray(a.codes) && a.codes.length ? a.codes.slice() : (a.code ? [a.code] : []);
    return str(a.code);
  }
  function cur(q, sm) {
    if (T.dirty[q.id]) return q.kind === 'multi' ? (Array.isArray(T.vals[q.id]) ? T.vals[q.id] : []) : str(T.vals[q.id]);
    return fromSaved(q, sm[q.id]);
  }
  function curNote(sm) {
    if (T.noteDirty) return T.note;
    var a = sm.commuting_taxi_cap;
    return a ? str(a.text) : '';
  }
  function visible(q, sm) {
    if (!q.parent) return true;
    var p = qById(q.parent);
    if (!p || !visible(p, sm)) return false;
    var v = cur(p, sm), list = Array.isArray(v) ? v : (v ? [v] : []);
    if (!list.length) return false;
    if (!Array.isArray(q.parentWhen) || !q.parentWhen.length) return true;
    return list.some(function (c) { return q.parentWhen.indexOf(c) >= 0; });
  }
  function choiceText(q, code) {
    var i;
    for (i = 0; i < q.choices.length; i++) if (q.choices[i].code === code) return str(q.choices[i].ja);
    return code === unkCode() ? 'わからない' : '';
  }
  function answerText(q, v) {
    if (Array.isArray(v)) return v.map(function (c) { return choiceText(q, c); }).filter(Boolean).join('、');
    return choiceText(q, v);
  }
  function sameAnswer(q, v, a, text) {
    if (!a) return false;
    var s = fromSaved(q, a);
    if (q.kind === 'multi') { if (s.slice().sort().join('|') !== v.slice().sort().join('|')) return false; }
    else if (s !== v) return false;
    return !q.note || trim(a.text) === text;
  }

  function renderTaxi() {
    setHead(TOPIC_NAME.taxi);
    if (!V.conds || !V.vocab) {
      waiting('読み込んでいます…');
      Promise.all([conds(), vocab()]).then(function () { if (S.open && S.view === 'taxi') renderTaxi(); },
        function () { if (S.open && S.view === 'taxi') loadFailed(renderTaxi); });
      return;
    }
    restore('taxi');
    var logged = hasToken();
    var loading = logged && (M.cond.k === 'loading' || M.cond.k === 'idle');
    var sm = savedMap(), qs = taxiQs(), E = T.els = { f: {}, loading: loading };
    clear(S.main);

    var f = el('form', 'pvc-form', null, { novalidate: '', autocomplete: 'off', 'data-pvc-form': 'taxi' });
    f.addEventListener('submit', function (e) { e.preventDefault(); sendTaxi(); });

    var ctx = el('div', 'pvc-ctx');
    var n = new Date(), parts = [coName()];
    var lastRow = M.work.k === 'ok' && M.work.rows.length ? M.work.rows[0] : null;
    if (lastRow && posLabel(lastRow.position)) parts.push(posLabel(lastRow.position));
    parts.push(n.getFullYear() + '年' + (n.getMonth() + 1) + '月');
    ctx.appendChild(el('p', 'pvc-ctx-line', parts.join(' · ')));
    f.appendChild(ctx);

    var set = el('fieldset', 'pvc-set');
    set.disabled = loading;
    var g = el('div', 'pvc-grid');

    function change(q, v) { T.vals[q.id] = v; T.dirty[q.id] = true; sync(); }
    function fieldFor(q) {
      var a = sm[q.id], v = cur(q, sm), fd = el('div', 'pvc-field pvc-wide', null, { 'data-q': q.id });
      var lid = 'pvc-l-' + q.id;
      var lb = el(q.kind === 'multi' ? 'div' : 'label', 'pvc-label', null, { id: lid });
      if (q.kind !== 'multi') lb.setAttribute('for', 'pvc-f-' + q.id);
      lb.appendChild(el('span', '', q.ja.label));
      if (a) lb.appendChild(el('span', 'pvc-mine', 'あなたの投稿'));
      fd.appendChild(lb);
      if (q.kind === 'multi') fd.appendChild(el('p', 'pvc-tip', '当てはまるものをすべて選んでください。'));
      else if (!q.parent && q.ja.help) fd.appendChild(el('p', 'pvc-tip', q.ja.help));
      if (q.kind === 'multi') {
        var box = el('div', 'pvc-chips', null, { role: 'group', 'aria-labelledby': lid }), inputs = [];
        var list = q.choices.map(function (c) { return [c.code, str(c.ja)]; });
        if (!q.choices.some(function (c) { return c.code === unkCode(); })) list.push([unkCode(), 'わからない']);
        list.forEach(function (c) {
          var lab = el('label', 'pvc-chip');
          var cb = el('input', '', null, { type: 'checkbox', name: q.id, value: c[0] });
          cb.checked = v.indexOf(c[0]) >= 0;
          cb.addEventListener('change', function () {
            /* 「わからない」は、ほかの答えと一緒には選べない */
            if (cb.checked) inputs.forEach(function (o) { if (o !== cb && (cb.value === unkCode() || o.value === unkCode())) o.checked = false; });
            change(q, inputs.filter(function (o) { return o.checked; }).map(function (o) { return o.value; }));
          });
          inputs.push(cb);
          lab.appendChild(cb); lab.appendChild(el('span', 'pvc-chip-f', c[1]));
          box.appendChild(lab);
        });
        fd.appendChild(box);
      } else {
        var opts = a ? [] : [['', '回答しない']];
        q.choices.forEach(function (c) { opts.push([c.code, str(c.ja)]); });
        if (!q.choices.some(function (c) { return c.code === unkCode(); })) opts.push([unkCode(), 'わからない']);
        if (a && v === '') opts.unshift(['', '選択してください']);
        var s = select(q.id, opts, v);
        s.sel.addEventListener('change', function () { change(q, s.sel.value); });
        fd.appendChild(s.wrap);
      }
      E.f[q.id] = fd;
      return fd;
    }

    qs.forEach(function (q) {
      if (!q.note) { g.appendChild(fieldFor(q)); return; }
      /* 上限だけは畳んで出す。補足を残せるのはこの質問だけ（サーバが残す自由記述はここの1つ） */
      var fold = el('div', 'pvc-fold pvc-wide', null, { 'data-q-fold': q.id });
      var a = sm[q.id];
      var bt = el('button', 'pvc-fold-b', null, { type: 'button', 'aria-expanded': T.fold ? 'true' : 'false', 'aria-controls': 'pvc-fold-p' });
      bt.appendChild(el('span', '', '回数・金額の上限を追加'));
      if (a) bt.appendChild(el('span', 'pvc-mine', 'あなたの投稿'));
      var panel = el('div', 'pvc-fold-p', null, { id: 'pvc-fold-p' });
      panel.hidden = !T.fold;
      bt.addEventListener('click', function () {
        T.fold = !T.fold;
        bt.setAttribute('aria-expanded', T.fold ? 'true' : 'false');
        panel.hidden = !T.fold;
      });
      var inner = fieldFor(q);
      inner.className = 'pvc-field';
      if (q.ja.help) inner.insertBefore(el('p', 'pvc-tip', q.ja.help), inner.children[1] || null);
      panel.appendChild(inner);
      var max = (V.conds.limits && V.conds.limits.textMax) || 300;
      var nf = el('div', 'pvc-field');
      nf.appendChild(el('label', 'pvc-label', '上限についての補足（任意）', { 'for': 'pvc-f-cap-note' }));
      var ta = el('textarea', 'pvc-area', null, {
        name: q.id + '_note', id: 'pvc-f-cap-note', rows: '3', maxlength: String(max),
        placeholder: '回数の上限や、決まりごとがあれば'
      });
      ta.value = curNote(sm);
      ta.addEventListener('input', function () { T.note = ta.value; T.noteDirty = true; });
      nf.appendChild(ta);
      panel.appendChild(nf);
      fold.appendChild(bt); fold.appendChild(panel);
      E.fold = fold; E.foldQ = q;
      g.appendChild(fold);
    });

    set.appendChild(g);
    f.appendChild(set);
    E.msg = el('div'); f.appendChild(E.msg);
    if (T.notice) E.msg.appendChild(note(T.notice));
    var o = ownRow(T, '匿名で追加する', sync);
    E.send = o.send;
    f.appendChild(o.act);
    E.wait = el('p', 'pvc-wait', '', { 'data-pvc-wait': '' });
    f.appendChild(E.wait);
    S.main.appendChild(f);

    function sync() {
      qs.forEach(function (q) {
        var on = visible(q, sm);
        if (q.note && E.fold) E.fold.hidden = !on;
        else if (E.f[q.id]) E.f[q.id].hidden = !on;
      });
      E.send.disabled = !T.own || T.busy || loading;
      E.send.textContent = T.busy ? '送っています…' : (M.cond.k === 'ok' && qs.some(function (q) { return sm[q.id]; }) ? '匿名で更新する' : '匿名で追加する');
      var t = '';
      if (loading) t = 'これまでの投稿を確認しています…';
      else if (!logged) t = '送るときにログインが必要です。入力した内容は、ログインのあともこの画面に残ります。';
      else if (M.cond.k === 'fail') t = 'これまでの投稿を読み込めませんでした。このまま送れます（同じ質問の答えがあれば、今回の内容に置き換わります）。';
      E.wait.textContent = t; E.wait.hidden = !t;
    }
    E.sync = sync;
    sync();
    revealNotice(E.msg, T.notice);
  }
  function taxiSay(o) {
    T.notice = o;
    var E = T.els;
    if (!E.msg) return;
    clear(E.msg);
    if (o) {
      E.msg.appendChild(note(o));
      if (E.msg.scrollIntoView) { try { E.msg.scrollIntoView({ block: 'center' }); } catch (e) { E.msg.scrollIntoView(); } }
    }
  }
  function sendTaxi() {
    if (T.busy || S.view !== 'taxi') return;
    var sm = savedMap(), qs = taxiQs(), known = M.cond.k === 'ok';
    var answers = [], had = 0, text = trim(curNote(sm)), stop = '';
    qs.forEach(function (q) {
      if (stop || !visible(q, sm)) return;
      var v = cur(q, sm), a = sm[q.id], one = null, t = q.note ? text : '';
      if (q.kind === 'multi') {
        if (v.length) one = v.length === 1 && v[0] === unkCode() ? { question_id: q.id, code: unkCode() } : { question_id: q.id, codes: v.slice() };
        else if (a) stop = '「' + q.ja.label + '」は、答えを空に戻せません。当てはまるものか「わからない」を選んでください。';
      } else if (v) one = { question_id: q.id, code: v };
      if (q.note && t && !one) stop = '補足を残すには、「' + q.ja.label + '」の答えを選んでください。';
      if (!one) return;
      had++;
      if (q.note && t) one.text = t;
      if (!known || !sameAnswer(q, v, a, t)) answers.push(one);
    });
    if (stop) return taxiSay({ kind: 'said', title: '保存できませんでした', text: stop });
    if (!had) return taxiSay({ kind: 'said', title: '保存できませんでした', text: '1つ以上答えてください（分かるものだけで大丈夫です）。' });
    if (!answers.length) return taxiSay({ kind: 'same', tone: 'calm', title: '保存済みの内容と同じです', text: '変えたい項目を選び直してから送ってください。' });
    if (!hasToken()) return toLogin('taxi');

    var pl = { airline: slug(), lang: 'ja', answers: answers };
    var lastRow = M.work.k === 'ok' && M.work.rows.length ? M.work.rows[0] : null;
    if (lastRow && lastRow.position) pl.position = lastRow.position;
    if (lastRow && lastRow.fleet) pl.fleet = lastRow.fleet;
    taxiSay(null);
    setBusy(T, true);
    rpc('submit_airline_conditions', pl).then(function (r) {
      setBusy(T, false);
      if (r.kind === 'ok' && r.data.ok) return taxiSaved(answers, r.data);
      if (r.kind === 'login') return toLogin('taxi');
      if (r.kind === 'said') return taxiSay({ kind: 'said', title: '保存できませんでした', text: r.msg });
      if (r.kind === 'off') return taxiSay(offNote());
      keepOutbox('taxi');
      taxiSay(failNote('taxi'));
    });
  }
  function taxiSaved(sent, data) {
    var rej = Array.isArray(data.rejected) ? data.rejected : [], bad = {}, kept = 0;
    rej.forEach(function (x) { if (x && x.question_id) bad[x.question_id] = str(x.reason); });
    /* サーバが受けた答えを、手元の一覧にも入れる（このあと取り直して確かめる） */
    var list = M.cond.k === 'ok' ? M.cond.answers.slice() : [];
    sent.forEach(function (a) {
      if (Object.prototype.hasOwnProperty.call(bad, a.question_id)) return;
      kept++;
      list = list.filter(function (x) { return x.question_id !== a.question_id; });
      list.push({ airline: slug(), question_id: a.question_id, code: a.code || null, codes: a.codes || null, text: a.text || null });
      delete T.dirty[a.question_id]; delete T.vals[a.question_id];
      if (a.question_id === 'commuting_taxi_cap') { T.noteDirty = false; T.note = ''; }
    });
    if (kept && M.cond.k === 'ok') M.cond.answers = list;
    dropDraft('taxi'); dropOutbox('taxi');
    if (kept) {
      track('contrib_saved', 'taxi');
      try { d.dispatchEvent(new CustomEvent('pvc:saved', { detail: { topic: 'taxi', slug: slug() } })); } catch (e) { /* 古いブラウザ */ }
    }
    if (rej.length) {
      T.notice = {
        kind: 'rej', title: '保存できなかった項目があります',
        text: kept ? 'ほかの' + kept + '件は保存しました。' : '',
        list: rej.map(function (x) {
          var q = qById(x.question_id);
          return (q ? '「' + q.ja.label + '」' : 'この項目') + '：' + (WHY[x.reason] || '保存できませんでした。');
        })
      };
      renderTaxi();
      if (T.els.msg && T.els.msg.scrollIntoView) { try { T.els.msg.scrollIntoView({ block: 'center' }); } catch (e) { T.els.msg.scrollIntoView(); } }
      loadMine(true);
      return;
    }
    T.own = false; T.notice = null; T.last = { n: kept };
    show('taxi-saved');
    loadMine(true);
  }
  function renderTaxiSaved() {
    if (!T.last || !V.conds) return renderTaxi();
    setHead(TOPIC_NAME.taxi);
    var sm = savedMap(), qs = taxiQs();
    savedShell('保存しました', coName(), function (dl) {
      qs.forEach(function (q) {
        var a = sm[q.id];
        if (!a) return;
        var txt = answerText(q, fromSaved(q, a));
        sumRow(dl, q.id, q.ja.label, txt, true);
        if (q.note && trim(a.text)) sumRow(dl, q.id + '_note', '上限についての補足', trim(a.text), true);
      });
    }, function () { show('taxi'); });
  }

  /* ── ログインへ ─────────────────────────────────────────── */
  /* 入れた内容を下書きに残して、戻り先に ?add= を付けて行く。
     いま居るのは面のために積んだ1段なので、置き換えて行く（戻ったときに面の殻だけが残らない）。 */
  function toLogin(topic) {
    keepDraft(topic, 'login');
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
    var t = topicOf(o && o.topic);
    if (!slug() || !d.body) return false;
    if (S.skipPop) { S.queue = function () { openSheet(o); }; return true; }
    build();
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
      try { history.pushState({ pvc: 1, t: t }, '', location.href); S.pushed = true; } catch (e) { S.pushed = false; }
    }
    loadMine(true);
    show(t);
    void S.root.offsetWidth;                // ここで一度描かせてから、滑り込む
    S.root.classList.add('is-in');
    track('contrib_open', t);
    return true;
  }
  function close(viaPop) {
    if (!S.open) return;
    S.open = false;
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
    openSheet({ topic: t.getAttribute('data-pvc-open'), from: t });
  }
  function takeAdd() {
    var q;
    try { q = new URLSearchParams(location.search); } catch (e) { return null; }
    if (!q.has('add')) return null;
    var t = topicOf(q.get('add')), s;
    q.delete('add');
    s = q.toString();
    try { history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash); } catch (e) { /* 住所はそのまま */ }
    return t;
  }
  function boot() {
    d.addEventListener('click', onClick, false);
    w.addEventListener('popstate', onPop, false);
    w.addEventListener('keydown', onKey, true);
    d.addEventListener('focusin', onFocusIn, true);
    function go() { var t = takeAdd(); if (t) openSheet({ topic: t }); }
    var st = null;
    try { st = history.state; } catch (e) { st = null; }
    /* 面を開いたまま読み直すと、面のために積んだ1段の上に居る。
       その段を降りておく（降りないと、読み直した人だけ「戻る」が1回ぶん足りなくなる）。 */
    if (st && st.pvc) stepBack(go); else go();
  }

  w.PVContrib = {
    open: function (o) { return openSheet({ topic: o && o.topic }); },
    close: function () { close(); }
  };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
