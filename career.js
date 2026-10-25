/* career.js — career.html の画面の切り替えだけ
 * （入口／会社の概要とタブ／就航地／数字の詳細／2社の比較／カード保存）。
 *
 * ★金額を1つも持たない。数字は全部 HTML に書いてある（gen-career.mjs が SSOT から書く）。
 *   ここがやるのは「どれを見せるか」だけ ＝ このファイルが落ちても、入口はそのまま読める。
 *   （★2026-10-24 ただ1つの例外：比較を選び直したとき、並べた2社の目盛で棒の長さを決め直す ── 額と目盛の右端は HTML から読む）
 *   通貨の切り替えは currency.js がいつもどおり HTML の表記を直す（ここは関わらない）。
 *
 * 住所：
 *   career.html                                  入口
 *   career.html?airline={slug}                   会社の概要
 *   career.html?airline={slug}&tab={work|life}   概要の中のタブ（タブを持つ会社だけ）
 *   career.html?airline={slug}&stay={IATA}       就航地
 *   career.html?airline={slug}&d={cap-est|fo-est} 数字の詳細（推定年収）
 *   career.html?view=compare&a={slug}&b={slug}   2社の比較
 *   career.html?view=card&a={slug}[&b={slug}]    カード保存
 * どの会社がタブ・就航地・詳細を持つかは、ここに書かない。HTML に在る画面だけを開く
 * （在る画面の一覧 ＝ section.cr-view と div.cr-tabp）。
 * 知らない値は、いちばん近い画面へ落とす（知らない就航地 → 就航地の一覧・知らないタブ → 概要・
 * 知らない会社 → 入口）。同じ会社を2つは選べない。
 *
 * 戻る・進む：画面を移るたびに履歴へ1段積む。同じ画面の中の選び直し（タブ・比較の2社と入れ替え・
 * カードの会社）は積まない（戻るを何度も押さないと出られない画面にしない）。
 * 見ていた位置は、送り終えるたびにその段へ残す（戻っても進んでも同じ場所に出る）。
 *
 * ほかの部品との約束：
 *   画面を出し終えるたびに #cr で cr:show を出す（detail ＝ いまの状態）。
 *   window.PVCareer.state() / go(状態) / replace(状態)。
 *   ⚠️ PVCareer を作り直さない（career-live.js が後から client を足す）。
 */
(function () {
  'use strict';
  var root = document.documentElement;

  function boot() {
    var cr = document.getElementById('cr');
    if (!cr) return;

    var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
    var views = cr.querySelectorAll('.cr-view');

    /* 在る画面の一覧（HTML から拾う）。 */
    var slugs = [], tabs = {}, stays = {}, dets = {};
    each(views, function (v) {
      var d = v.dataset, s = d.airline;
      if (d.view === 'airline') {
        slugs.push(s);
        tabs[s] = [];
        each(v.querySelectorAll('.cr-tabp'), function (p) { tabs[s].push(p.dataset.tab); });
      }
      if (d.view === 'stay') (stays[s] = stays[s] || []).push(d.stay);
      if (d.view === 'detail') (dets[s] = dets[s] || []).push(d.d);
    });
    var has = function (list, x) { return !!list && list.indexOf(x) >= 0; };
    var known = function (s) { return has(slugs, s); };
    /* 比較の行が在る会社 ＝ このページが額を持っている会社。カードはこの会社なら開ける。 */
    var listed = [];
    each(cr.querySelectorAll('.cr-cmp .cr-pair[data-role="cap"] .cr-row'), function (r) { listed.push(r.dataset.airline); });
    var canCard = function (s) { return has(listed, s); };
    var canPair = function (s) { return hasSheet ? !!pkOf[s] : known(s); };   // CA-3a: 選ぶ面に在る会社

    var DEF = { a: cr.dataset.a, b: cr.dataset.b };
    var cmp = cr.querySelector('.cr-view[data-view="compare"]');
    /* 航空会社一覧（pv-directory.js）と同じ検索。下の6つは あちらと同じ字（assert-career.mjs が突き合わせる）。
       直すときは あちらを直して、ここへ写す。⚠️ この囲みの外へ出さない（query という名前が、住所を作る関数と重なる）。
       ⚠️ 囲みの名前は wdFind（find は下の「戻る目印を探す」関数の名前 ── 同じ名前にすると、あとの代入で検索が上書きされる）。 */
    var wdFind = (function () {
      /** 幅・大小・かなをそろえる（全角→半角・小文字・ひらがな→カタカナ） */
      function fold(s) {
        s = String(s == null ? '' : s);
        return (s.normalize ? s.normalize('NFKC') : s).toLowerCase().replace(/[ぁ-ゖ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0x60); });
      }
      /** 区切り（空白 ・ . , ' " ( ) [ ] / - _ & |）を1つの空白に・長音（ー）を消す */
      function spaced(s) {
        return fold(s).replace(/[\s・·.,'’"“”()\[\]\/\-‐‑–—_&|]+/g, function () { return ' '; }).replace(/ー/g, function () { return ''; })
          .replace(/ +/g, function () { return ' '; }).trim();
      }
      /** 空白を詰めた形 */
      function compact(s) { return spaced(s).replace(/ /g, function () { return ''; }); }
      /** 詰めた形の中で、語が始まる位置（先頭の0と、空白1つにつき1つ） */
      function starts(sp) {
        var out = [0], n = 0;
        for (var i = 0; i < sp.length; i++) { if (sp.charAt(i) === ' ') out.push(n); else n++; }
        return out;
      }
      /** 打たれた字を一度だけ読む。na ＝ ASCII でない字を含む・sh ＝ ASCII だけで空白を除いて3字まで（短い） */
      function query(raw) {
        var S = spaced(raw), C = compact(raw), na = /[^\x00-\x7f]/.test(C);
        return { raw: raw, S: S, C: C, na: na, sh: !na && C.length <= 3 };
      }
      /** 0 ＝ 略号か呼び名とぴったり同じ（先頭に並べる）・1 ＝ 当たり・-1 ＝ 外れ */
      function tier(card, Q) {
        var i, j, k, hit = false;
        if (Q.C === '') return 1;
        if (card.codes.indexOf(Q.C) >= 0) return 0;
        for (i = 0; i < card.keys.length; i++) if (card.keys[i].C === Q.C) return 0;
        for (i = 0; i < card.keys.length && !hit; i++) {
          k = card.keys[i];
          if (Q.na) { hit = k.C.indexOf(Q.C) >= 0; continue; }
          if (!Q.sh && k.S.indexOf(Q.S) >= 0) hit = true;
          for (j = 0; j < k.W.length && !hit; j++) if (k.C.startsWith(Q.C, k.W[j])) hit = true;
        }
        return hit ? 1 : -1;
      }
      return { spaced: spaced, compact: compact, starts: starts, query: query, tier: tier };
    })();
    var sheet = document.getElementById('cr-sheet'), sheetL = document.getElementById('cr-sheet-l'), sheetH = document.getElementById('cr-sheet-h');
    var sheetQ = document.getElementById('cr-sheet-q'), sheet0 = document.getElementById('cr-sheet-0');      // CA-3b2 で HTML に入る（無ければ null）
    var openB = { a: document.getElementById('cr-open-a'), b: document.getElementById('cr-open-b') };
    /* 公開から10分のあいだ、端末に残った古い HTML（選ぶ面が無い）がこの新しい部品を読むことがある。そのときは選び直しだけを止める
       （比較そのものは出す）。 */
    var hasSheet = !!(sheet && sheetL && sheetH && openB.a && openB.b);
    /* 会社の引き当ては素の入れ物で（住所の a=constructor などが、ふつうの {} の元から生えている名前に当たらない）。 */
    var PK = [], pkOf = Object.create(null), HOME = [], turn = null;
    if (hasSheet) {
      each(sheetL.children, function (li) { HOME.push(li); });
      each(sheetL.querySelectorAll('.cr-pk'), function (el) {
        var o = { el: el, li: el.parentNode, slug: el.dataset.airline, codes: [], keys: [] };
        /* 検索の鍵は、航空会社一覧のカードと同じ読み方で1回だけそろえる（略号 data-c・呼び名 data-k）。 */
        (el.dataset.c || '').split(' ').forEach(function (c) { if (c) o.codes.push(wdFind.compact(c)); });
        (el.dataset.k || '').split('|').forEach(function (k) { if (k) { var S = wdFind.spaced(k); o.keys.push({ S: S, C: S.replace(/ /g, function () { return ''; }), W: wdFind.starts(S) }); } });
        PK.push(o); pkOf[o.slug] = o;
      });
    }
    var swap = document.getElementById('cr-swap');
    var bar = document.querySelector('.mr-top');

    /* タブの名前の後ろ（" | PILOT VALUE"）は、いま付いているものをそのまま使う。 */
    var cut = document.title.lastIndexOf(' | ');
    var SUFFIX = cut >= 0 ? document.title.slice(cut) : '';

    var KEYS = ['airline', 'view', 'tab', 'stay', 'd', 'a', 'b'];
    var blank = function (view) {
      return { view: view, airline: null, tab: null, stay: null, d: null, a: null, b: null };
    };

    /* 状態 → 住所の ? から後ろ。 */
    function query(st) {
      var e = encodeURIComponent;
      if (st.view === 'airline') return '?airline=' + e(st.airline) + (st.tab && st.tab !== 'top' ? '&tab=' + e(st.tab) : '');
      if (st.view === 'stay') return '?airline=' + e(st.airline) + '&stay=' + e(st.stay);
      if (st.view === 'detail') return '?airline=' + e(st.airline) + '&d=' + e(st.d);
      if (st.view === 'compare') return '?view=compare&a=' + e(st.a) + '&b=' + e(st.b);
      if (st.view === 'card') return '?view=card&a=' + e(st.a) + (st.b ? '&b=' + e(st.b) : '');
      return '';
    }
    function url(st) { return location.pathname + query(st); }
    /* いまの住所を正しい形へ直すときは、ここが知らない引数（ほかの部品のもの）を落とさない。 */
    function mend(st) {
      var out = new URLSearchParams(query(st));
      new URLSearchParams(location.search).forEach(function (v, k) { if (KEYS.indexOf(k) < 0) out.append(k, v); });
      var s = out.toString();
      return location.pathname + (s ? '?' + s : '');
    }

    /* 住所 → 状態。 */
    function read(q) {
      var st, air = q.get('airline'), view = q.get('view');
      if (air !== null) {
        if (!known(air)) return blank('home');
        st = blank('airline');
        st.airline = air;
        var stay = q.get('stay'), d = q.get('d'), tab = q.get('tab');
        if (stay !== null) {
          stay = stay.toUpperCase();
          if (has(stays[air], stay)) { st.view = 'stay'; st.stay = stay; return st; }
          /* 知らない就航地 → 就航地の一覧が在るタブ。 */
          if (stays[air]) tab = 'life';
        } else if (d !== null && has(dets[air], d)) {
          st.view = 'detail'; st.d = d; return st;
        }
        if (tabs[air].length) st.tab = has(tabs[air], tab) ? tab : tabs[air][0];
        return st;
      }
      if (view === 'compare' || view === 'card') {
        var qa = q.get('a'), qb = q.get('b');
        var can = view === 'card' ? canCard : canPair;
        var a = can(qa) ? qa : null;
        var b = can(qb) && qb !== a ? qb : null;
        st = blank(view);
        if (view === 'card') {
          if (!a) return blank('home');
        } else {
          if (!a) a = DEF.a !== b ? DEF.a : DEF.b;
          if (!b) b = DEF.b !== a ? DEF.b : DEF.a;
        }
        st.a = a; st.b = b;
        return st;
      }
      return blank('home');
    }
    /* fix は「住所のほうを直す必要がある」の印（この画面の鍵だけを比べる。ほかの鍵は見ない）。 */
    function parse(search) {
      var q = new URLSearchParams(search), st = read(q);
      var want = new URLSearchParams(query(st)), fix = false;
      KEYS.forEach(function (k) { if (q.get(k) !== want.get(k)) fix = true; });
      st.fix = fix;
      return st;
    }
    /* よそから渡された状態（欠けていてもよい）を、在る画面へ整える。 */
    function tidy(st) {
      st = st || {};
      var q = new URLSearchParams();
      KEYS.forEach(function (k) { if (st[k] != null && st[k] !== '') q.set(k, st[k]); });
      return read(q);
    }

    /* 比較の2社を入れ替える。全社ぶんが全部 HTML に在り、見せる2社を選ぶ（と、2社の目盛で棒の長さを決め直す）だけ。 */
    function pair(a, b) {
      /* 写真の札は先行5社だけ。ほかの会社は、写真の無い会社の札（.cr-opt-x ── 1側に1枚）に、選ぶ面のその会社の社名・色・ロゴを写す。 */
      each(cmp.querySelectorAll('.cr-side'), function (side) {
        var want = side.dataset.side === 'a' ? a : b;
        var hit = false, x = null;
        each(side.querySelectorAll('.cr-opt'), function (o) {
          if (o.classList.contains('cr-opt-x')) { x = o; return; }
          o.hidden = o.dataset.airline !== want;
          if (!o.hidden) hit = true;
        });
        if (x) plate(x, hit ? null : pkOf[want]);
        var p = pkOf[want], n = p && p.el.querySelector('.cr-pk-n'), ob = openB[side.dataset.side];
        if (ob && n) ob.setAttribute('aria-label', ob.dataset.label + ' ' + n.textContent.replace(/\s+/g, ' ').trim());
      });
      /* ★2026-10-25 P12.110（WP-compare-all-11）：写真の無い札が出ているあいだ2枚とも高くする印（.cr-pick の is-x）は外した ── 札の高さは中身なりで、
         2枚は同じ行の高さにそろう（career.css）。 */
      /* ★2026-10-25 WP-compare-all-12：税の行の箱（.cr-taxes）は WP-compare-all-10 で無くなった（税の扱いの字は年収の板の足の .cr-go の中）── 名前を外した。 */
      each(cmp.querySelectorAll('.cr-row, .cr-card, .cr-rentb, .cr-credit, .cr-go'), function (el) {
        var s = el.dataset.airline;
        el.hidden = s !== a && s !== b;
      });
      /* 目盛は並べた2社で1本（★2026-10-24 オーナー P12.104）── 2社の目盛の右端（行の data-scale ＝ その会社の描く額のいちばん大きいものから
         gen-career.mjs が決めた額）の大きいほう。2社は必ず同じ目盛。棒の長さは、行の額（data-man）をその右端で割った割合（％の字にするのは
         ブラウザの数の書き方 ── 小数2けた）。目盛の字と刻みの数は、HTML に右端ごとに置いてある1本から選ぶ（額も刻みの幅もここに持たない）。 */
      var PCT = { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false };
      var top = 0, lab = {};
      each(cmp.querySelectorAll('.cr-pair .cr-row'), function (r) {
        var v = Number(r.dataset.scale);
        if ((r.dataset.airline === a || r.dataset.airline === b) && v > top) top = v;
        if ((r.dataset.airline === a || r.dataset.airline === b) && r.dataset.lab) lab[r.dataset.airline] = r.dataset.lab.split(' ').map(Number);
      });
      /* 色の近い2社（★2026-10-25 オーナー P12.110 ── WP-compare-all-11）：2社の会社の色の座標（機長の行の data-lab ── gen-career.mjs が会社の色を
         OKLab に直して書いた数）の距離が、HTML の data-near-max より小さいときだけ data-near を立てる。立っているあいだ、右の会社（並びの2つ目）の
         点・棒・札の色の線に、色のほかの手がかりが付く（career.css）。色の式も組み合わせの一覧もここに持たない（差を測るだけ）。 */
      var la = lab[a], lb = lab[b], nearMax = Number(cmp.getAttribute('data-near-max')) || 0;
      var near = !!(la && lb && la.length === 3 && lb.length === 3) && Math.sqrt(Math.pow(la[0] - lb[0], 2) + Math.pow(la[1] - lb[1], 2) + Math.pow(la[2] - lb[2], 2)) < nearMax;
      if (near) cmp.setAttribute('data-near', ''); else cmp.removeAttribute('data-near');
      var line = null;
      each(cmp.querySelectorAll('.cr-panel .cr-axis[data-scale]'), function (x) {
        x.hidden = Number(x.dataset.scale) !== top;
        if (!x.hidden) line = x;
      });
      if (line) {
        cmp.style.setProperty('--cr-div', line.dataset.div);
        each(cmp.querySelectorAll('.cr-pair .cr-row'), function (r) {
          if (r.dataset.airline !== a && r.dataset.airline !== b) return;
          var f = r.querySelector('.cr-fill'), m = f ? Number(f.dataset.man) : 0;
          if (m > 0) f.style.setProperty('--w', (m / top).toLocaleString('en-US', PCT));
        });
      }
      /* 並びは置き場所そのものを入れ替える。見た目の順だけ変えると、
         読み上げと Tab の順が画面と食い違う。
         同じ会社の要素が続けて在っても、まとめて順のまま運ぶ。
         家賃の箱（.cr-rentbs）も同じ ── 街ごとの箱を、選んだ順に置き直すだけ。 */
      each(cmp.querySelectorAll('.cr-pair, .cr-cards, .cr-rentbs, .cr-credits, .cr-gos'), function (box) {
        var ea = [], eb = null;
        each(box.children, function (el) {
          if (el.dataset.airline === a) ea.push(el);
          if (el.dataset.airline === b && !eb) eb = el;
        });
        if (eb) ea.forEach(function (el) { box.insertBefore(el, eb); });
        /* 2社とも中身の無い入れ物は、見出しごと出さない。片方だけのときは、その会社の列に置いたままにする（もう片方の列は空ける）。 */
        if (box.matches && box.matches('.cr-cards, .cr-rentbs, .cr-credits')) {
          var n = 0, one = null;
          each(box.children, function (el) { if (el.dataset && el.dataset.airline && !el.hidden) { n++; one = one || el; } });
          box.hidden = n === 0;
          /* 「会社が公表している金額」の箱は、並べた2社のどちらにも一覧（社名の見出しのほかの中身）が無ければ、カードが在っても描かない
             （空の箱を置かない ── 2026-10-22 LEAD AMENDMENT）。片方に在れば、もう片方（先行5社）は社名だけ。 */
          if (n && box.classList.contains('cr-cards')) {
            var any = false;
            each(box.children, function (card) {
              if (card.hidden || !card.dataset.airline) return;
              each(card.children, function (c) { if (!c.classList.contains('cr-card-h')) any = true; });
            });
            box.hidden = !any;
          }
          if (n === 1) box.setAttribute('data-only', one.dataset.airline === a ? 'a' : 'b'); else box.removeAttribute('data-only');
          var wrap = box.closest ? box.closest('[data-wrap]') : null;
          if (wrap) wrap.hidden = n === 0;
        }
      });
      /* カード保存への入口は、いま並べている2社を連れていく（HTML には既定の2社が書いてある）。 */
      var to = document.getElementById('cr-to-card');
      if (to) to.setAttribute('href', to.getAttribute('href').split('?')[0] + query({ view: 'card', a: a, b: b }));
    }

    var state = null, shown = null;
    var copy = function () {
      var o = blank(state.view);
      KEYS.forEach(function (k) { if (k !== 'view') o[k] = state[k] == null ? null : state[k]; });
      return o;
    };

    function show(st, focus) {
      state = st;
      var cur = null;
      each(views, function (v) {
        var d = v.dataset;
        var on = d.view === st.view
          && (!d.airline || d.airline === st.airline)
          && (d.view !== 'stay' || d.stay === st.stay)
          && (d.view !== 'detail' || d.d === st.d);
        v.hidden = !on;
        if (on) cur = v;
      });
      var label = '';
      if (cur && st.view === 'airline' && st.tab) {
        each(cur.querySelectorAll('.cr-tabp'), function (p) { p.hidden = p.dataset.tab !== st.tab; });
        each(cur.querySelectorAll('.cr-tab'), function (t) {
          if (t.dataset.tab === st.tab) {
            t.setAttribute('aria-current', 'page');
            if (st.tab !== 'top') label = ' ' + t.textContent.replace(/\s+/g, ' ').trim();
          } else t.removeAttribute('aria-current');
        });
      }
      if (st.view === 'compare') pair(st.a, st.b);
      var moved = cur !== shown;
      shown = cur;
      var h = cur && cur.querySelector('.cr-h1');
      if (h) {
        document.title = h.textContent.replace(/\s+/g, ' ').trim() + label + SUFFIX;
        /* 画面が替わったときだけ見出しへ。タブの切替では、押したタブに焦点を残す。 */
        if (focus && moved) h.focus({ preventScroll: true });
      }
      try { cr.dispatchEvent(new CustomEvent('cr:show', { detail: copy() })); } catch (e) {}
    }

    /* ── 戻ってきたときの位置（会社ページへ出て、ブラウザの「戻る」で帰ってきたとき）──────────
       帰ってきた直後は、生きた欄がまだ空で、ページが短い。そのまま位置を戻すと別の所に出る。
       (1) 生きた欄を、出る前の高さで置いておく（答えで落ち着いたら外す）。
       (2) 出る前に画面のいちばん上に在った「動かない目印」（見出し・リンク・箱）を覚えておき、
           欄や畳みの高さが変わるたびに、その目印が同じ高さに来るよう合わせ直す。読む人が自分で動かしたら、やめる。
       段に残すのは画面の寸法だけ（箱の高さ・目印の名前（会社と番号）と位置）。額・件数・字は残さない。
       ★高さを残すのは、誰が見ても同じ字の顔（SAME_FACE：錠・ログイン・答えるカード・まだ少ない・空・準備中・読めない）の欄で、
         片側だけの印（data-part）が無いものだけ。開いた欄（open）・途中の欄・知らない状態は 0 ── 開いた欄の高さは、
         見える行の数（受け取った人にしか無い値）を語る。段はログアウトや読む人の交代のあとも、このタブに残る（LC-A19）。 */
    var SAME_FACE = /^(locked|login|give|few|empty|off|error)$/;
    var MARKS = 'h1, h2, h3, a[href], .cr-row, .cr-rentb, .cr-card, .crl[data-live]';
    var liveOf = function () { return shown ? shown.querySelectorAll('.crl[data-live]') : []; };
    var marksOf = function () {
      var out = [];
      if (shown) each(shown.querySelectorAll(MARKS), function (el) {
        var up = el.parentElement;
        if (!(up && up.closest('.crl, #cr-deep'))) out.push(el);    // 部品が後から描く中身は目印にしない（戻った直後には無い）
      });
      return out;
    };
    /* 目印の名前（段の s と k）：その目印が属する会社（いちばん近い data-airline。会社に属さない目印は ''）と、
       その会社の目印の中での番号。画面全体の通し番号にしない ── 比較の2社を選び直すと pair() が箱の中の会社の要素を並べ替え、
       隠れた3社の要素の順は選び直しの道のりで変わる（読み込み直すと HTML の順から並べ直す）ので、同じ通し番号が別の目印を指す
       （エバー → JAL を選んで入れ替えたあと会社ページへ出て戻ると、読み込み直したページで目印を見失い、欄が埋まるとずれた）。
       同じ会社の目印どうしの順は、選び直しでも読み込み直しでも変わらない（pair() は会社の要素をまとめて順のまま運び、箱は動かさない）。
       名前の目印がページに無い・隠れているときは合わせない（位置は段の y のまま ── 隠れた要素へは飛ばない）。 */
    var whose = function (el) { var o = el.closest('[data-airline]'); return o ? o.getAttribute('data-airline') : ''; };
    var nameOf = function (list, i) {
      var s = whose(list[i]), n = 0;
      for (var j = 0; j < i; j++) if (whose(list[j]) === s) n++;
      return { s: s, k: n };
    };
    var find = function (m) {
      if (!m || typeof m.s !== 'string' || !(m.k >= 0)) return null;
      var list = marksOf(), n = 0;
      for (var i = 0; i < list.length; i++) if (whose(list[i]) === m.s && n++ === m.k) return list[i];
      return null;
    };
    var edge = function () { return bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0; };
    /* 画面が出るときの動き（.cr-view の translateY が 0 へ戻る途中）の分。目印の位置からは除く
       （動きの途中で合わせると、動き終わったときにその分だけずれる）。 */
    var lift = function () {
      var m = shown && /^matrix\((.+)\)$/.exec(getComputedStyle(shown).transform || '');
      return m ? Number(m[1].split(',')[5]) || 0 : 0;
    };
    var kept = function (b) { return SAME_FACE.test(b.getAttribute('data-state') || '') && !b.hasAttribute('data-part'); };
    var sizes = function () {
      var out = [];
      each(liveOf(), function (b) { out.push(kept(b) ? b.offsetHeight : 0); });
      return out;
    };
    /* 段に書く位置（y・目印の番号 k・その高さ t）も、残さない欄の高さを語らない（2026-10-23 LEAD AMENDMENT「段の k・t」）：
       残さない欄（kept でない欄）を高さ 0 とみなした寸法で書く。上の帯の線がその欄の中なら、目印はその欄の頭
       （戻るとその欄の頭が帯のすぐ下に来る ── 欄の中のどこまで読んでいたかは、欄の高さを語るので残さない）。
       そうしないと y と t から「目印より上の、開いた欄の高さの合計」が割り戻せる。
       戻ったときに合わせるのは目印の位置 t だけ（目印より上の欄は、その場で測り直す）ので、残さない欄の無い人の段は前と同じ。
       目印の「上」はページの並びで決める（閉じた畳みの中の目印は、画面の高さが流れの中の場所を指さない）。帯の線の「上」は画面の高さで決める。 */
    var flat = function (up) {
      var spans = [];
      each(liveOf(), function (b) {
        if (kept(b) || (b.parentElement && b.parentElement.closest('.crl[data-live]'))) return;
        var r = b.getBoundingClientRect();
        spans.push({ b: b, top: r.top - up, bot: r.bottom - up });
      });
      return {
        line: function (v) {                    // 画面の高さ v（帯の線）より上に在る、残さない欄の高さを除いた v
          var s = 0;
          spans.forEach(function (x) { s += Math.max(0, Math.min(v, x.bot) - x.top); });
          return v - s;
        },
        mark: function (el, v) {                // 目印の高さ v から、ページの並びでその目印より前に在る、残さない欄の高さを除く
          var s = 0;
          spans.forEach(function (x) { if (x.b !== el && (x.b.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) s += x.bot - x.top; });
          return v - s;
        }
      };
    };
    function mark() {
      var list = marksOf(), e = edge(), up = lift();
      for (var i = 0; i < list.length; i++) {
        var r = list[i].getClientRects()[0];
        if (r && r.top - up >= e) { var m = nameOf(list, i); m.t = Math.round(r.top - up); return m; }
      }
      return { s: '', k: -1, t: 0 };
    }
    var waiting = function (b) { var s = b.getAttribute('data-state'); return s === 'idle' || s === 'loading'; };
    var free = function (b) { if (b.style.minHeight) b.style.minHeight = ''; };
    /* 合わせているあいだは、ブラウザ自身のスクロールの合わせ（scroll anchoring）を切る（2026-10-24）。
       あれは欄の高さが変わると、ResizeObserver の合わせより先にスクロールを動かし、その scroll を下の「読む人が動かした」と
       取り違えて合わせをやめていた。そのあとはブラウザが自分の選んだ要素で合わせるので、目印は 2px ほどずれたまま残った
       （比較の「詳しく」「ほかの街」から戻ると 2026 → 2028・1823 → 1825。混んだ回にだけ起きる）。
       合わせるのはページ自身だけにする（assert-cmp-frame.mjs が、切った形 ＝ Safari のように合わせないブラウザで見ている形）。
       やめたら前の値に戻す。見張りは表示中の画面と body の大きさ（画面の外の、上の帯の高さが変わっても合わせ直す）。 */
    var held = null, ro = null, anchorWas = null;    // root は頭の document.documentElement
    function letGo() {
      held = null;
      if (ro) ro.disconnect();
      if (anchorWas !== null) { root.style.overflowAnchor = anchorWas; anchorWas = null; }
    }
    function align() {
      if (!held) return;
      var r = held.el.getClientRects()[0];
      if (!r) return;
      var dy = Math.round(r.top - lift()) - held.t;
      if (dy) window.scrollBy(0, dy);
      held.y = window.scrollY;
    }
    function arm(m) {
      letGo();
      var el = find(m);
      if (!el) return;
      held = { el: el, t: m.t, y: window.scrollY };
      if (window.ResizeObserver && shown) {
        ro = ro || new ResizeObserver(align);
        ro.observe(shown);
        if (document.body) ro.observe(document.body);
        anchorWas = root.style.overflowAnchor || '';
        root.style.overflowAnchor = 'none';
      }
      align();
    }
    function restore(st) {
      letGo();
      each(cr.querySelectorAll('.crl[data-live]'), free);
      var h = st && st.h, list = liveOf();
      if (h && h.length === list.length) each(list, function (b, i) { if (h[i] > 0 && waiting(b)) b.style.minHeight = h[i] + 'px'; });
      window.scrollTo(0, (st && st.y) || 0);
      if (st) arm({ s: st.s, k: st.k, t: st.t });
    }
    if (window.MutationObserver) {
      new MutationObserver(function (recs) {
        recs.forEach(function (r) { if (!waiting(r.target)) free(r.target); });
        align();
      }).observe(cr, { attributes: true, subtree: true, attributeFilter: ['data-state'] });
    }
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (n) {
      window.addEventListener(n, letGo, { capture: true, passive: true });
    });
    /* 生きた欄を動かす部品が届かなかったときは、控えた高さを残さない（空の箱が広がったままになる）。 */
    window.addEventListener('load', function () {
      if (!(window.PVCareer && window.PVCareer.client)) each(cr.querySelectorAll('.crl[data-live]'), free);
    });
    /* ブラウザが前の画面をそのまま戻したとき：いま上に在る目印を覚え直す（取り直しで欄の高さが変わっても、読む場所を動かさない）。 */
    window.addEventListener('pageshow', function (e) { if (e.persisted) arm(mark()); });
    var keep = function () {
      var list = marksOf(), e = edge(), up = lift(), F = flat(up), at = F.line(e), m = { s: '', k: -1 }, t = 0;
      for (var i = 0; i < list.length; i++) {
        var r = list[i].getClientRects()[0], f = r ? F.mark(list[i], r.top - up) : 0;
        if (r && f >= at) { m = nameOf(list, i); t = Math.round(f - at + e); break; }
      }
      try { history.replaceState({ y: Math.round(window.scrollY - e + at), h: sizes(), s: m.s, k: m.k, t: t }, '', location.href); } catch (x) {}
    };
    /* 位置は、送り終えるたびにいまの段へ残す。ブラウザの「戻る」で出るときは
       残す間が無い（知らせが来たときには、もう次の段に居る）ので、押した時だけでは足りない。 */
    var tick = 0;
    window.addEventListener('scroll', function () {
      if (held && Math.abs(window.scrollY - held.y) > 1) letGo();    // 読む人が動かした
      clearTimeout(tick);
      tick = setTimeout(keep, 90);
    }, { passive: true });

    /* 同じ画面の中の選び直しか（履歴を積まない）。 */
    function same(st) {
      if (!state || st.view !== state.view) return false;
      if (st.view === 'airline') return st.airline === state.airline;
      return st.view === 'compare' || st.view === 'card';
    }

    /* 画面を移る（履歴へ1段積んで、頭から見せる）。 */
    function go(st) {
      letGo();
      clearTimeout(tick);
      keep();                                   // 戻ってきたときの位置を、いまの段に残す
      history.pushState({ y: 0 }, '', url(st));
      show(st, true);
      window.scrollTo(0, 0);
    }
    /* 同じ画面の中で選び直す（履歴は積まない・位置は動かさない）。 */
    function swapIn(st) {
      clearTimeout(tick);
      try { history.replaceState({ y: window.scrollY }, '', url(st)); } catch (e) {}
      show(st, true);
    }
    /* タブを替えたあと：写真とタブはそのままの場所に残す。
       タブより下まで読んでいたときだけ、タブの並びを画面の頭へ戻す（新しい中身を頭から読める）。 */
    function settle() {
      var nav = shown && shown.querySelector('.cr-tabs');
      if (!nav) return;
      var edge = (bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0) + 8;
      var top = nav.getBoundingClientRect().top;
      if (top < edge) window.scrollTo(0, Math.max(0, window.scrollY + top - edge));
      keep();
    }

    cr.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[data-go]') : null;
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var u = new URL(a.href, location.href);
      if (u.origin !== location.origin || u.pathname !== location.pathname) return;
      e.preventDefault();
      var st = parse(u.search);
      if (!same(st)) return go(st);
      var tabbed = st.view === 'airline' && st.tab !== state.tab;
      swapIn(st);
      if (tabbed) settle();
    });

    window.addEventListener('popstate', function (e) {
      closeSheet();
      clearTimeout(tick);                       // 前の画面の位置を、移った先の段へ書かない
      show(parse(location.search), true);
      restore(e.state);
    });

    function repick(a, b) {
      if (a === b) return;
      letGo(); each(liveOf(), free);
      var st = blank('compare');
      st.a = a; st.b = b;
      swapIn(st);
    }
    function closeSheet() {
      if (hasSheet && sheet.open) { if (sheet.close) sheet.close(); else sheet.removeAttribute('open'); }
      root.classList.remove('cr-sheeting');
      turn = null;
    }
    function plate(x, o) {                          // x: .cr-opt-x、o: 選ぶ面の1件（無ければ隠す）
      x.hidden = !o;
      x.dataset.airline = o ? o.slug : '';
      if (!o) return;
      var c = o.el.style.getPropertyValue('--cr-co');
      if (c) x.style.setProperty('--cr-co', c); else x.style.removeProperty('--cr-co');
      /* ロゴは選ぶ面の1行のものを写す（名前・色・ロゴだけ。額は写さない）。印（▼）は札に置いたまま（ロゴの段と社名の中 ── 出すのはいつも1つ。
         どちらを出すかは career.css。★WP-compare-all-12：352px からは社名の後ろ・351px まではロゴの右）。社名の字は .cr-opt-t だけを書き換える。 */
      var lg = x.querySelector('.cr-opt-lg'), src = o.el.querySelector('.pvg-logo'), old = lg.querySelector('.pvg-logo');
      if (old) lg.removeChild(old);
      if (src) lg.insertBefore(src.cloneNode(true), lg.firstChild);
      x.querySelector('.cr-opt-t').textContent = o.el.querySelector('.cr-pk-n').textContent;
    }
    /* 検索の欄の字で、選ぶ面の会社を絞る（航空会社一覧と同じ決まり：何も打っていなければ HTML の並び・地域の見出しつき。
       打っていれば見出しを隠し、略号か呼び名とぴったり同じ会社を先頭へ・あとは HTML の並び）。1社も無いときだけ、一覧と同じ1行を出す。 */
    function filter() {
      var Q = wdFind.query(sheetQ ? sheetQ.value : ''), n = 0, front = [];
      PK.forEach(function (o) { var t = wdFind.tier(o, Q); o.li.hidden = t < 0; if (t >= 0) n++; if (t === 0 && Q.C !== '') front.push(o.li); });
      HOME.forEach(function (li) { if (li.classList.contains('cr-pk-gl')) li.hidden = Q.C !== ''; sheetL.appendChild(li); });   // HTML の並びへ戻す
      for (var i = front.length - 1; i >= 0; i--) sheetL.insertBefore(front[i], sheetL.firstChild);                          // ぴったり当たった会社を先頭へ
      if (sheet0) sheet0.hidden = n > 0;
    }
    function shownPk() {                            // いま選べる会社（画面の並びの順）
      var out = [];
      each(sheetL.querySelectorAll('.cr-pk'), function (el) { var o = pkOf[el.dataset.airline]; if (!o.li.hidden && !el.disabled) out.push(o); });
      return out;
    }
    function openSheet(side) {                      // side: 'a' | 'b'
      turn = side;
      sheetH.textContent = openB[side].dataset.label;
      var mine = state[side], other = state[side === 'a' ? 'b' : 'a'];
      PK.forEach(function (o) {
        o.el.disabled = o.slug === other;
        if (o.slug === mine) o.el.setAttribute('aria-current', 'true'); else o.el.removeAttribute('aria-current');
      });
      if (sheetQ) sheetQ.value = '';
      filter();
      /* 幅をとるスクロールバーの画面（Windows など）では、隠れたバーの幅を後ろのページの右に足して、ページを横へずらさない
         （バーの幅がそのまま残るブラウザでは、足すのは 0）。 */
      var bar0 = window.innerWidth - root.clientWidth;
      root.classList.add('cr-sheeting');
      var lost = bar0 - (window.innerWidth - root.clientWidth);
      if (lost > 0) root.style.setProperty('--cr-sb', lost + 'px'); else root.style.removeProperty('--cr-sb');
      if (typeof sheet.showModal === 'function') sheet.showModal(); else sheet.setAttribute('open', '');
      /* 指で使う端末では、開いた瞬間に文字盤で一覧を隠さない（検索欄は一覧のすぐ上に在る）。 */
      var coarse = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
      var cur = pkOf[mine] ? pkOf[mine].el : null;
      (sheetQ && !coarse ? sheetQ : cur || sheetL).focus();
      /* いまの会社を一覧のまんなかへ（一覧の中だけを動かす。後ろのページは動かさない）。 */
      if (cur) { var r = cur.getBoundingClientRect(), L = sheetL.getBoundingClientRect(); sheetL.scrollTop += (r.top - L.top) - (L.height - r.height) / 2; }
    }
    if (hasSheet) {
      openB.a.addEventListener('click', function () { openSheet('a'); });
      openB.b.addEventListener('click', function () { openSheet('b'); });
      document.getElementById('cr-sheet-x').addEventListener('click', closeSheet);
      sheet.addEventListener('close', function () { root.classList.remove('cr-sheeting'); turn = null; });
      /* 面の外（地）を押して閉じるのは、押し始めも離した所も面の外のときだけ（検索欄の横の余白・欄の字をなぞって外で離した、で閉じない）。 */
      var outside = function (e) {
        var r = sheet.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      var downOut = false;
      sheet.addEventListener('pointerdown', function (e) { downOut = e.target === sheet && outside(e); });
      sheet.addEventListener('click', function (e) {
        if (e.target === sheet) { if (downOut && outside(e)) closeSheet(); return; }
        var hit = e.target.closest ? e.target.closest('.cr-pk') : null;
        if (!hit || hit.disabled || !turn) return;
        var side = turn, s = hit.dataset.airline;
        closeSheet();
        repick(side === 'a' ? s : state.a, side === 'b' ? s : state.b);
      });
      sheetL.addEventListener('keydown', function (e) {
        var list = shownPk(), i = -1;
        list.forEach(function (o, k) { if (o.el === document.activeElement) i = k; });
        var to = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : null;
        if (to === null) return;
        e.preventDefault();
        if (to < 0 && sheetQ) return sheetQ.focus();
        var at = list[Math.max(0, Math.min(list.length - 1, to))];
        if (at) at.el.focus();
      });
      /* 検索の欄：打つたびに絞る。↓ で一覧のいちばん上の会社へ・Enter でその会社を選ぶ（選べる会社が無ければ何もしない）。 */
      if (sheetQ) {
        sheetQ.addEventListener('input', filter);
        sheetQ.addEventListener('keydown', function (e) {
          var list = shownPk();
          if (e.key === 'ArrowDown' && list[0]) { e.preventDefault(); list[0].el.focus(); }
          if (e.key === 'Enter' && list[0]) { e.preventDefault(); list[0].el.click(); }
        });
      }
    }
    swap.addEventListener('click', function () { repick(state.b, state.a); });

    /* ほかの部品の入口。⚠️ オブジェクトを作り直さない（後から読まれる部品が口を足す）。 */
    var api = window.PVCareer = window.PVCareer || {};
    api.state = copy;
    api.go = function (st) { go(tidy(st)); };
    api.replace = function (st) { swapIn(tidy(st)); };

    /* 位置は自分で戻す（画面を差し替えるので、ブラウザ任せだと別の画面の高さで戻される）。 */
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.addEventListener('pagehide', keep);

    var first = parse(location.search);
    if (first.fix) history.replaceState(history.state, '', mend(first));
    show(first, false);
    if (history.state) restore(history.state);
  }

  try { boot(); }
  finally { root.classList.remove('cr-boot'); }
})();
