/* career-live.js — 生きた欄（.crl[data-live]）をサーバーの答えで埋める。

   ・読むだけ。書き込む通信を1本も出さない。
   ・金額・待遇の鍵の名前・見本の口コミを、このファイルに書かない
     （鍵は欄の data-keys、答えの名前は #crl-vocab か pv-conditions.json、額はサーバーの答え）。
   ・取ってきた字は textContent で入れる（HTML として流し込む口を持たない）。
   ・REAL PAY はサーバーの資格のまま。鍵の無い人には値が来ない＝出せない。
     ★ 会社ページでは、鍵の無い行をぼかした板で見せる（オーナーのご指示 2026-10-06「ログインしてない人はぼかせ」）。
       板の中は最初から空 ── 置いた数字を霞ませているのではない。板の幅も固定（値や桁数から作らない）。
     機材で絞る口・並び替えを置かない。1行＝1人。
   ・口コミは実投稿だけ（見本を読み込まない）。読めない数に 0 を置かない。
   ・取りに行くのは、その欄が画面に出たとき。同じ答えはページの中で使い回す（pv_pay_rows() は1回）。

   欄の状態（data-state）: idle → loading → open／empty／locked／error／off
     empty ＝ 0件／locked ＝ 鍵が無い／error ＝ 通信が落ちた（やり直せる）／off ＝ サーバーに口がまだ無い
   career.js との約束: #cr の 'cr:show' と PVCareer.state()。まだ無くても、見えている欄から自分で動き出す。 */
(function (w, d) {
  'use strict';

  /* 会社ページ（主要5社）でも同じ欄を動かす。印は <body data-pv-glance="1">（gen-airline-glance.mjs が書く）。
     あちらは airlines/ の下に在るので、行き先だけ1つ上へ向ける（UP）。
     ⚠️ career.html では UP は空 ＝ 行き先の字は1文字も変わらない。 */
  var GL = !!d.body && d.body.getAttribute('data-pv-glance') === '1';
  var root = d.getElementById('cr') || (GL ? d.body : null);
  if (!root) return;
  var UP = GL ? '../' : '';

  var me = d.currentScript;
  var BASE = '';
  try { BASE = new URL('.', (me && me.src) || location.href).href; } catch (e) { BASE = ''; }

  /* actual-pay.html と同じ入口（公開の anon キー）。 */
  var SB_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  var SB_URL = 'https://vzgmnkrggrwtsrpqndsm.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6Z21ua3JnZ3J3dHNycHFuZHNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzkwOTcsImV4cCI6MjA5MDAxNTA5N30.wE4cJbqeYGCgn5ZvHd80hYWgQuySKvOMJMbsJWOvmtw';

  /* 口コミは古いコードでも入っている会社がある（airlines/airline-reviews-ui.js と同じ対）。 */
  var LEGACY = {
    'cathay-pacific': 'cathay', 'qatar-airways': 'qatar', 'singapore-airlines': 'singapore',
    'spring-japan': 'spring', 'alaska-airlines': 'alaska', 'british-airways': 'british',
    'turkish-airlines': 'turkish'
  };
  var SCORES = ['culture_score', 'salary_score', 'benefits_score', 'wlb_score', 'ops_score', 'training_score'];
  var TAIL = /[（(][^）)]*[）)]\s*$/;

  var T = {
    loading: '読み込み中',
    err: 'いま読み出せません',
    retry: 'やり直す',
    off: '準備中',
    none: '未取得',
    dash: '〜',

    annual: '年収',
    vfYes: '明細で確認済み',
    vfNo: '本人申告',
    far: '同じ会社・同じ職位の公開年収から大きく外れた金額です。',
    age: ['1ヶ月以内', '3ヶ月以内', '6ヶ月以内', '1年以内', 'それより前'],
    ten: {
      r: ['昇格後5年未満', '昇格後5〜10年', '昇格後10〜15年', '昇格後15〜20年', '昇格後20年以上'],
      s: ['在籍5年未満', '在籍5〜10年', '在籍10〜15年', '在籍15〜20年', '在籍20年以上']
    },
    payEmpty: 'まだ記録がありません',
    payCount: function (n) { return ['', String(n), '件の提出']; },
    payLock: '給与の提出で開きます',
    payGive: '匿名で給与を提出する',
    gg: 'Give & Get',
    payUnlock: ['全ての', '給与情報を', '解放する'],
    payTerms: '閲覧条件',
    payAll: 'REAL PAY で全部見る',
    login: 'ログイン',
    loginLock: 'ログインが必要です',            // 口コミの要約の欄だけが使う（集計の欄は使わない）
    loginPayLock: 'ログインと給与の提出で開きます',
    /* ログインも給与の提出も済んでいて、自分の会社への回答がまだ足りない人の1行と、答えるカード。
       要る数（need）と答えた数（have）は、サーバーが返した数（ここには書かない）。 */
    giveLock: function (need) { return '自分の会社に' + need + 'つ答えると開きます'; },
    giveHead: function (name) { return name + 'の待遇情報を、足りない情報から埋める'; },
    giveCount: function (have, need) { return 'あなたが答えた項目：' + have + '／' + need; },
    giveGo: '匿名で答える',

    /* 月の勤務の6項目。鍵と並びは db/work-months.sql の pv_work_view が返す形のまま */
    work: [
      { k: 'block_hours', name: '乗務時間', unit: '時間 / 月', u: '時間', fam: 'h' },
      { k: 'duty_hours', name: '勤務・拘束時間', unit: '時間 / 月', u: '時間', fam: 'h' },
      { k: 'work_days', name: '勤務日数', unit: '日 / 月', u: '日', fam: 'd' },
      { k: 'duty_days', name: '乗務日数', unit: '日 / 月', u: '日', fam: 'd' },
      { k: 'days_off', name: '公休日数', unit: '日 / 月', u: '日', fam: 'd' },
      { k: 'stay_nights', name: 'ステイ泊数', unit: '泊 / 月', u: '泊', fam: 'd' }
    ],
    workPos: [['cap', '機長'], ['fo', '副操縦士']],
    workEmpty: 'まだ集計がありません',
    /* 帯の軸の右端（目盛の基準）。時間 ＝ 240（1日8時間 × 30日 という物差し）。日・泊 ＝ 31（月の日数の最大）。会社の決まりを表す数字ではない。
       ★集まった値に合わせて伸び縮みさせない（会社どうしで帯の長さが比べられなくなる）。 */
    workMax: { h: 240, d: 31 },
    workCap: '帯と数字は、回答のまんなか半分の幅',
    workAxis: ['目盛は、時間が 0', '、日と泊が 0'],
    workOver: '目盛の外',
    noteHead: '会員の補足',
    noteWork: '月の勤務',
    noteMine: 'あなたの投稿',
    townHead: '人気の居住地',
    townWait: '確認待ち',
    townNo: '見送り',
    townEdit: '修正',
    townHeld: 'ログインなしで保存した回答があります。',

    revEmpty: '口コミはまだありません',
    revNone: '会員からの投稿はまだありません',       // 会社ページ用。同じページの「口コミ」のタブは海外の評判なども数えるので、言い分ける
    revNo: '評価未取得',                              // 会社ページ用。点数の付いた投稿がまだ無い（0点ではない）
    revCount: function (n) { return '口コミ ' + n + '件'; },
    revRated: function (n) { return n + '件の評価'; },
    sumHead: '口コミの要約',
    sumGood: '良い点',
    sumConcern: '気になる点',
    sumLock: '要約は口コミの投稿で開きます',
    sumAi: 'AI 要約',
    sumFrom: function (n) { return '会員の口コミ ' + n + '件から'; },
    sumWhen: function (d) { return d + ' 更新'; },
    sumFew: '口コミがまだ少ないため、要約はありません',
    sumNone: '口コミの要約は、まだありません',
    sumOff: '準備中',
    sumSrc: 'この要約のもとになった口コミを見る',
    revLock: '口コミの投稿で開きます',
    revGive: '匿名で口コミを書く',
    revAll: 'この会社の口コミを全部見る',

    factEmpty: 'まだ集計がありません',
    factNone: '集計なし',
    top: '最多',
    median: '中央値',
    split: '回答が分かれています',
    answered: function (n) { return '回答 ' + n + '人'; }
  };

  /* ── 小さな道具 ─────────────────────────────────────────── */
  function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function enc(s) { return encodeURIComponent(String(s)); }
  function okSlug(s) { return typeof s === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(s); }

  function el(tag, cls, text) {
    var n = d.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }
  function clear(box) { while (box.firstChild) box.removeChild(box.firstChild); }

  var NS = 'http://www.w3.org/2000/svg';
  var ICON = {
    lock: ['M7 11V7a5 5 0 0 1 10 0v4', 'M5 11h14v10H5z'],
    check: ['M20 6 9 17l-5-5'],
    arrow: ['M5 12h14', 'M13 6l6 6-6 6']
  };
  function icon(name, size) {
    var s = d.createElementNS(NS, 'svg');
    s.setAttribute('class', 'crl-ic');
    s.setAttribute('width', String(size || 14));
    s.setAttribute('height', String(size || 14));
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2.2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    ICON[name].forEach(function (p) {
      var e = d.createElementNS(NS, 'path');
      e.setAttribute('d', p);
      s.appendChild(e);
    });
    return s;
  }
  function link(text, href, kind) {
    var a = el('a', kind === 'cta' ? 'crl-cta' : 'crl-link');
    a.href = href;
    a.appendChild(el('span', '', text));
    a.appendChild(icon('arrow', 14));
    return a;
  }
  /* 2行の入口（会社ページ）── 上に「Give & Get」、下に何が開くか。行き先は1行の入口と同じ。
     ★2026-10-08 形はサイト共通の pv-gg.css（トップのいちばん上の黒いボタンと同じ：2行ともまんなか・同じ大きさ・丸い形）。
       評価スコアの1枚・口コミの錠前の入口と1つも違わない。ここで大きさ・色・寄せ方を足さない。 */
  function ggArrow() {
    var s = d.createElementNS(NS, 'svg');
    s.setAttribute('width', '16');
    s.setAttribute('height', '16');
    s.setAttribute('viewBox', '0 0 16 16');
    s.setAttribute('fill', 'none');
    s.setAttribute('aria-hidden', 'true');
    var p = d.createElementNS(NS, 'path');
    p.setAttribute('d', 'M3 8h10M9 4l4 4-4 4');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '1.6');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    s.appendChild(p);
    return s;
  }
  function give2(main, href) {
    var a = el('a', 'pv-gg');
    a.href = href;
    var t = el('span', 'pv-gg-t');
    var k = el('span', 'crl-cta-k', T.gg);
    k.lang = 'en';
    t.appendChild(k);
    /* main は語の切れ目ごとの配列。あいだに <wbr> を置く ＝ 狭い箱ではここでだけ折れる（折り方は pv-gg.css） */
    var m = el('span', 'crl-cta-m');
    main.forEach(function (w, i) {
      if (i) m.appendChild(d.createElement('wbr'));
      m.appendChild(d.createTextNode(w));
    });
    t.appendChild(m);
    a.appendChild(t);
    a.appendChild(ggArrow());
    return a;
  }
  function msg(text) { return el('p', 'crl-msg', text); }
  function lockLine(text) {
    var p = el('p', 'crl-lock');
    p.appendChild(icon('lock', 14));
    p.appendChild(el('span', '', text));
    return p;
  }
  function foot(nodes) {
    var f = el('div', 'crl-foot');
    nodes.forEach(function (n) { if (n) f.appendChild(n); });
    return f;
  }
  function ym(v) {
    if (!v) return '';
    var m = /^(\d{4})-(\d{2})/.exec(String(v));
    return m ? (m[1] + '年' + Number(m[2]) + '月') : '';
  }
  function view(state, nodes) { return { state: state, nodes: nodes || [] }; }
  function fail(kind) { var e = new Error(kind); e.crl = kind; return e; }
  function sbErr(res) {
    var code = String((res && res.error && res.error.code) || '');
    var off = code === 'PGRST202' || code === 'PGRST205' || code === '42883' || code === '42P01' ||
              (res && res.status === 404);
    return fail(off ? 'off' : 'error');
  }

  /* ── 会社の名前と色（ページに在る島から。無ければ選択肢の字）──────── */
  var CO = null;
  function companies() {
    if (CO) return CO;
    CO = {};
    var isl = d.getElementById('crc-data');
    if (isl) {
      try { CO = (JSON.parse(isl.textContent || '{}') || {}).airlines || {}; } catch (e) { CO = {}; }
    }
    return CO;
  }
  function coName(slug) {
    var c = companies()[slug];
    if (c && c.ja) return String(c.ja);
    var o = root.querySelector('#cr-a option[value="' + slug + '"]');
    return o ? String(o.textContent || '').trim() : slug;
  }
  function coTag(slug) {
    var s = el('span', 'crl-co', coName(slug));
    var c = companies()[slug];
    if (c && typeof c.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(c.color)) {
      s.style.setProperty('--crl-co', c.color);
    }
    return s;
  }

  /* ── 取ってくる側（同じ答えは使い回す。落ちたものだけ捨てる＝やり直せる）──── */
  var cache = {};
  function once(key, fn) {
    if (cache[key]) return cache[key];
    var p;
    try { p = Promise.resolve(fn()); } catch (e) { p = Promise.reject(e); }
    cache[key] = p;
    /* 落ちた答えは持ち越さない（やり直せる）。「口がまだ無い」だけは聞き直しても同じなので持つ。 */
    p.then(null, function (e) { if (cache[key] === p && !(e && e.crl === 'off')) delete cache[key]; });
    return p;
  }
  function drop(prefix) {
    Object.keys(cache).forEach(function (k) { if (k.indexOf(prefix) === 0) delete cache[k]; });
  }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = d.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { res(); };
      s.onerror = function () { rej(fail('error')); };
      d.head.appendChild(s);
    });
  }
  function json(file) {
    return fetch(BASE + file, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw fail('error');
      return r.json();
    });
  }

  /* supabase-js は欄が出たときに初めて読む。createClient はページに1回。 */
  var sbOnce = null;
  function client() {
    if (sbOnce) return sbOnce;
    /* 会社ページには、口コミの部品（airline-reviews-ui.js）が作ったクライアントが既に在る。
       2つ目を作らない（同じ保存領域を2つが見張ると、ログインの切り替わりを取り合う）。 */
    var shared = GL && w.PVReviewUI && typeof w.PVReviewUI.sb === 'function';
    var p = shared
      ? Promise.resolve(w.PVReviewUI.sb()).then(function (sb) {
        if (!sb) throw fail('error');
        watchAuth(sb);
        return sb;
      })
      : (w.supabase && w.supabase.createClient ? Promise.resolve() : loadScript(SB_CDN))
        .then(function () {
          if (!w.supabase || !w.supabase.createClient) throw fail('error');
          var sb = w.supabase.createClient(SB_URL, SB_KEY);
          watchAuth(sb);
          return sb;
        });
    sbOnce = p;
    p.then(null, function () { if (sbOnce === p) sbOnce = null; });
    return p;
  }

  /* 人が変わった（ログアウトを含む）ときだけ、本物の行を消して取り直す。
     最初の読み出しと、トークンの更新では何もしない。 */
  var uid;                                  // undefined ＝ まだ知らない
  function setUid(v) {
    if (uid === undefined) { uid = v; return; }
    if (uid === v) return;
    uid = v;
    drop('pay'); drop('rev:'); drop('sum:'); drop('wkv:'); drop('note:'); drop('fact:'); drop('give'); drop('town:');
    reset(['realpay', 'work', 'cmp-work', 'notes', 'reviews', 'stars', 'score', 'summary', 'cmp-stars', 'fact', 'cmp-facts', 'towns']);
    later();
  }
  function watchAuth(sb) {
    try {
      sb.auth.getSession().then(function (r) {
        var u = r && r.data && r.data.session && r.data.session.user;
        setUid(u ? u.id : null);
      }, function () { setUid(null); });
      sb.auth.onAuthStateChange(function (ev, session) {
        var u = session && session.user;
        setUid(u ? u.id : null);
      });
    } catch (e) { /* 読めなくても欄は出す（サーバーが資格を決める） */ }
  }

  /* 給与の行。引数なしで1回だけ呼び、会社で絞るのは画面側（現行の REAL PAY と同じ）。
     開いていない答えからは、会社・出典・投稿時期の3つしか受け取らない。 */
  function payRows() {
    return once('pay', function () {
      return client().then(function (sb) { return sb.rpc('pv_pay_rows'); }).then(function (res) {
        if (!res || res.error) throw sbErr(res);
        var x = res.data;
        if (!x || x.ok === false) throw fail('error');
        var open = x.state === 'open';
        var rows = isArr(x.rows) ? x.rows : [];
        if (!open) {
          rows = rows.map(function (r) {
            return { airline: r && r.airline, verified: !!(r && r.verified), age: r && r.age };
          });
        }
        return { open: open, rows: rows, anon: x.give == null };
      });
    });
  }

  /* 月の勤務の集計（給与とは別の入口で集めた6項目）。見せてよい相手かどうかはサーバーが決める。
     開いていない答えに入っているのは、状態の1語だけ（数字は1つも来ない）。 */
  function workView(slug) {
    return once('wkv:' + slug, function () {
      return client().then(function (sb) { return sb.rpc('pv_work_view', { p: { airline: slug } }); }).then(function (res) {
        if (!res || res.error) throw sbErr(res);
        var x = res.data;
        if (!x || x.ok === false) throw fail('error');
        if (x.state !== 'open') {
          /* 開いていない時の語は3つ。知らない語は、鍵とも0件とも読まない */
          if (x.state !== 'login' && x.state !== 'locked' && x.state !== 'give') throw fail('error');
          return { state: x.state, by: {} };
        }
        return { state: 'open', by: (x.by && typeof x.by === 'object') ? x.by : {} };
      });
    });
  }
  /* 会員が書いた補足。誰に返すかはサーバーが決める（開いていない人には1文字も返らない）。
     開いた答えに付いてきた補足だけを持つ。 */
  function notesOf(slug) {
    return once('note:' + slug, function () {
      return client().then(function (sb) { return sb.rpc('pv_contrib_notes', { p: { airline: slug } }); }).then(function (res) {
        if (!res || res.error) throw sbErr(res);
        var x = res.data;
        if (!x || x.ok === false) throw fail('error');
        return { state: x.state === 'open' ? 'open' : 'locked',
                 notes: (x.state === 'open' && isArr(x.notes)) ? x.notes : [] };
      });
    });
  }

  /* 口コミ。読む口は review-i18n.js の fetchRows の1つだけ（reviews_v2 を直接引かない）。 */
  function i18n() {
    return once('i18n', function () {
      return (w.PVReviewI18n ? Promise.resolve() : loadScript(BASE + 'review-i18n.js')).then(function () {
        if (!w.PVReviewI18n || !w.PVReviewI18n.fetchRows || !w.PVReviewI18n.pick) throw fail('error');
        return w.PVReviewI18n;
      });
    });
  }
  function reviews(slug) {
    return once('rev:' + slug, function () {
      return Promise.all([client(), i18n()]).then(function (a) {
        var codes = [slug];
        if (LEGACY[slug]) codes.push(LEGACY[slug]);
        return a[1].fetchRows(a[0], { airlines: codes, limit: 500 });
      }).then(function (res) {
        if (!res) throw fail('error');          // 取れなかった（0件とは別）
        return res;
      });
    });
  }

  /* 待遇の集計。誰に返すかはサーバーが決める（db/contrib.sql の pv_contrib_facts）。
     開いていない人に返るのは、状態の1語だけ（集計は1件も来ない）。集計のビューは直接読まない（読めない）。
     1社につき1回だけ聞く ── 聞く質問は、このページの集計の欄ぜんぶの分。 */
  function pageKeys() {
    var seen = {}, out = [];
    var all = root.querySelectorAll('.crl[data-live="fact"][data-keys]');
    for (var i = 0; i < all.length; i++) {
      keysOf(all[i]).forEach(function (k) { if (!seen[k]) { seen[k] = 1; out.push(k); } });
    }
    return out.sort();
  }
  function facts(slug) {
    return once('fact:' + slug, function () {
      var keys = pageKeys(), asked = {};
      keys.forEach(function (k) { asked[k] = 1; });
      return client().then(function (sb) {
        return sb.rpc('pv_contrib_facts', { p: { airline: slug, keys: keys } });
      }).then(function (res) {
        if (!res || res.error) throw sbErr(res);
        var x = res.data;
        if (!x || x.ok === false) throw fail('error');
        /* 状態の語は4つ。知らない語は、開いているとも0件とも読まない */
        if (x.state !== 'login' && x.state !== 'locked' && x.state !== 'give' && x.state !== 'open') throw fail('error');
        /* 行を持つのは、開いている時の、聞いた質問の分だけ（ほかの状態に行が付いてきても捨てる） */
        var m = {};
        if (x.state === 'open') {
          (isArr(x.facts) ? x.facts : []).forEach(function (r) {
            if (r && typeof r.question_id === 'string' && asked[r.question_id] === 1) m[r.question_id] = r;
          });
        }
        return { state: x.state, map: m, asked: asked };
      });
    });
  }

  /* 答えの名前。ページの島が在ればそれ、無ければ質問の台帳から同じ形に直す。 */
  function vocab() {
    return once('vocab', function () {
      var isl = d.getElementById('crl-vocab');
      if (isl) {
        try {
          var v = JSON.parse(isl.textContent || '');
          if (v && typeof v === 'object') return v;
        } catch (e) { /* 下へ */ }
      }
      return json('pv-conditions.json').then(function (c) {
        var out = {};
        ((c && c.questions) || []).forEach(function (q) {
          if (!q || !q.id) return;
          var o = {};
          (q.choices || []).forEach(function (ch) { if (ch && ch.code) o[ch.code] = ch.ja; });
          out[q.id] = {
            ja: (q.ja && q.ja.label) || '', kind: q.kind || '',
            options: o, unit: (q.num && q.num.ja) || ''
          };
        });
        return out;
      });
    });
  }

  /* 職位と機材の名前。 */
  function dict() {
    return once('dict', function () {
      return json('pv-vocab.json').then(function (v) {
        var pos = {}, fleet = {};
        ((v && v.positions) || []).forEach(function (x) { if (x && x.code) pos[x.code] = x.ja; });
        var leg = (v && v.legacyPositions) || {};
        Object.keys(leg).forEach(function (k) { if (!pos[k] && pos[leg[k]]) pos[k] = pos[leg[k]]; });
        ((v && v.fleets) || []).forEach(function (x) {
          if (x && x.code) fleet[x.code] = String(x.ja || '').replace(TAIL, function () { return ''; });
        });
        return { pos: pos, fleet: fleet };
      });
    });
  }

  /* ── 金額（現行の REAL PAY と同じ作り＝有効数字2桁。表示は PVCurrency）────── */
  function sig2(v) {
    v = Number(v);
    if (!isFinite(v) || v <= 0) return 0;
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10) - 1);
    return Math.round(v / p) * p;
  }
  function money(usd) {
    var C = w.PVCurrency;
    if (!C || !C.rates || usd == null || !isFinite(Number(usd)) || Number(usd) <= 0) return '';
    var rate = C.rates[C.get()] || 1;
    var n = sig2(Number(usd) * (C.rates.USD || 1) / rate);
    return n ? C.fmt(n * rate) : '';
  }

  /* ── REAL PAY ───────────────────────────────────────────── */
  function srcLine(r) {
    var p = el('div', 'crl-row-c');
    var vf = el('span', 'crl-vf');
    if (r.verified) { vf.setAttribute('data-v', '1'); vf.appendChild(icon('check', 12)); }
    vf.appendChild(el('span', '', r.verified ? T.vfYes : T.vfNo));
    p.appendChild(vf);
    var age = (isNum(r.age) && T.age[r.age]) ? T.age[r.age] : '';
    if (age) p.appendChild(el('span', 'crl-age', age));
    return p;
  }
  function payRow(r, D) {
    var li = el('li', 'crl-row');
    var a = el('div', 'crl-row-a');
    if (D.pos[r.pos]) a.appendChild(el('b', 'crl-pos', D.pos[r.pos]));
    if (r.fleet && D.fleet[r.fleet]) a.appendChild(el('span', 'crl-sub', D.fleet[r.fleet]));
    var ten = isNum(r.ten) ? (T.ten[r.tenk === 's' ? 's' : 'r'][r.ten] || '') : '';
    if (ten) a.appendChild(el('span', 'crl-chip', ten));
    li.appendChild(a);

    var b = el('div', 'crl-row-b');
    b.appendChild(el('span', 'crl-k', T.annual));
    var amt = money(r.annual_usd);
    var v = el('b', 'crl-amt pv-no-cur', amt || '—');
    if (!amt) v.setAttribute('data-none', '');
    b.appendChild(v);
    if (r.far === true) {
      var f = el('span', 'crl-far', '⚠︎');
      f.setAttribute('role', 'img');
      f.setAttribute('aria-label', T.far);
      f.title = T.far;
      b.appendChild(f);
    }
    li.appendChild(b);
    li.appendChild(srcLine(r));
    return li;
  }
  /* 鍵の無い人の行。サーバーが返した3つ（会社・出典・投稿時期）だけで組む。額の箱は作らない。 */
  function maskRow(r, slug) {
    var li = el('li', 'crl-row');
    li.setAttribute('data-mask', '');
    var a = el('div', 'crl-row-a');
    a.appendChild(el('b', 'crl-pos', coName(slug)));
    li.appendChild(a);
    li.appendChild(srcLine(r));
    return li;
  }
  /* 会社ページの、鍵の無い人の行。開いた行と同じ骨組みで、職位・機材・年収の場所にぼかした板を置く。
     会社はページが言っているので、社名を行ごとに繰り返さない。
     ⚠️ 板の中に字を入れない（数字も、それらしい記号も）。サーバーが送ってきたのは出典と投稿時期だけ。 */
  function plate(kind) {
    return el('span', 'crl-plate' + (kind ? ' crl-plate-' + kind : ''));
  }
  function maskLine(r) {
    var li = el('li', 'crl-row');
    li.setAttribute('data-mask', 'line');
    var a = el('div', 'crl-row-a');
    a.setAttribute('aria-hidden', 'true');
    a.appendChild(plate('a'));
    a.appendChild(plate('b'));
    li.appendChild(a);
    var b = el('div', 'crl-row-b');
    b.setAttribute('aria-hidden', 'true');
    b.appendChild(el('span', 'crl-k', T.annual));
    b.appendChild(plate(''));
    li.appendChild(b);
    li.appendChild(srcLine(r));
    return li;
  }
  /* この会社の提出の件数（返ってきた行を数えるだけ。同じ人が2行になることがあるので「人」と呼ばない） */
  function payCount(n) {
    var t = T.payCount(n), p = el('p', 'crl-count');
    if (t[0]) p.appendChild(d.createTextNode(t[0]));
    p.appendChild(el('b', '', t[1]));
    p.appendChild(d.createTextNode(t[2]));
    return p;
  }
  function loginHref() {
    if (GL) return UP + 'login.html?redirect=' + enc(location.pathname.replace(/^.*\/airlines\//, 'airlines/'));
    return 'login.html?redirect=' + enc('career.html' + location.search);
  }
  /* 同じタブへ戻るログインの入口。#work のようなタブの名前だけを通す（ほかの形の # は付けない）。 */
  function backHash() {
    var h = String(location.hash || '');
    return /^#[A-Za-z0-9_-]{1,40}$/.test(h) ? h : '';
  }
  function loginLink() {
    var a = link(T.login, loginHref() + enc(backHash()));
    a.setAttribute('data-crl-login', '1');
    /* 押す時にもう一度決める（描いたあとでタブを移っていても、押した時のタブへ戻す） */
    a.addEventListener('click', function () { a.href = loginHref() + enc(backHash()); }, true);
    return a;
  }
  function payEntry(slug) {
    return link(T.payGive, UP + 'pay-report.html' + (slug ? '?airline=' + enc(slug) : ''), 'cta');
  }
  var NONE = { getAttribute: function () { return '0'; } }, GIVE_ONLY = { getAttribute: function () { return 'give'; } };
  /* 欄がその入口を自分で出してよいか。data-entry が無ければ、状態が要る入口を出す。
     在れば、そこに書いてある語の入口だけ（"0" ＝ どれも出さない。同じ面にもう在る）。 */
  function carries(box, what) {
    var v = box.getAttribute('data-entry');
    return v === null || (' ' + v + ' ').indexOf(' ' + what + ' ') >= 0;
  }
  /* ほかの人の回答が開いていない時の1行。言い方はここ1か所（集計の欄・比較・月の勤務が同じ字になる）。
     who … サーバーが返した状態の1語：'login' ／ 'locked' ／ 'give'
     入口は1つだけ ── 'login' は「ログイン」、'locked' は「匿名で給与を提出する」、'give' は答えるカード。 */
  function lockView(who, slug, box, lead) {
    if (who === 'give') return giveView(lead ? [lead] : [], box);
    var nodes = lead ? [lead] : [];
    nodes.push(lockLine(who === 'login' ? T.loginPayLock : T.payLock));
    if (carries(box, who === 'login' ? 'login' : 'pay')) nodes.push(foot([who === 'login' ? loginLink() : payEntry(slug)]));
    return view('locked', nodes);
  }
  /* 答えるカードの中身 ── 読む人自身の会社（符号と名前）・その会社について答えた数・要る数・次に聞く質問の並び。
     返すのはサーバー（db/contrib.sql の pv_contrib_give）。ほかの人の回答の数は、1つも来ない。
     カードを埋められる答えだけを受け取る：状態が 'give'・会社の符号（一覧に無い会社は 'other'）・名前・0 以上で要る数より小さい、答えた数。
     それ以外（たとえば、別のタブで足りる数まで答えた直後の 'open'）では描かない ＝ 埋められないカードを出さない・要る数をここで決めない。 */
  var ASK_ID = /^[a-z0-9_]{1,64}$/;
  function isInt(v) { return isNum(v) && Math.floor(v) === v; }
  function giveInfo() {
    return once('give', function () {
      return client().then(function (sb) { return sb.rpc('pv_contrib_give', { p: {} }); }).then(function (res) {
        if (!res || res.error) throw sbErr(res);
        var x = res.data;
        if (!x || x.ok === false || x.state !== 'give') throw fail('error');
        var name = typeof x.name === 'string' ? x.name.replace(/^\s+|\s+$/g, '') : '';
        if (!okSlug(x.airline) || !name) throw fail('error');
        if (!isInt(x.have) || !isInt(x.need) || x.have < 0 || x.have >= x.need) throw fail('error');
        return {
          airline: x.airline, name: name, have: x.have, need: x.need,
          ask: (isArr(x.ask) ? x.ask : []).filter(function (q) { return typeof q === 'string' && ASK_ID.test(q); })
        };
      });
    });
  }
  /* カードの入口の行き先（リンクとして）。一覧に在る会社は、質問の画面の、その会社・最初に聞く質問の所。
     一覧に無い会社（'other'）は、質問の画面そのもの（あちらが、いちばん新しい給与の会社について開く）。 */
  function giveHref(g) {
    if (g.airline === 'other') return UP + 'airline-conditions.html';
    return UP + 'airline-conditions.html?airline=' + enc(g.airline) + (g.ask.length ? '&q=' + enc(g.ask[0]) : '');
  }
  /* 答えるカード。字はどれも textContent（サーバーが返した社名も、字としてしか入れない）。入口は1つ。
     押した時：このページに「情報を追加」の面が在り（PVContrib.openFor）、一覧に在る会社なら、読む人自身の会社について面を開く。
     面が開いた時（true が返った時）だけ、リンクを止める。開かなかった時（ログインしていない・符号の形でない）・面が無いページ・
     一覧に無い会社・別のタブで開く押し方（修飾キー・左のほかのボタン）では、リンクのまま進む。 */
  function giveCard(g) {
    var c = el('div', 'crl-give');
    c.appendChild(el('p', 'crl-give-h', T.giveHead(g.name)));
    c.appendChild(el('p', 'crl-give-n', T.giveCount(g.have, g.need)));
    var a = link(T.giveGo, giveHref(g), 'cta');
    a.setAttribute('data-crl-give', '1');
    a.addEventListener('click', function (e) {
      var C = w.PVContrib;
      if (g.airline === 'other' || !C || typeof C.openFor !== 'function') return;
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (C.openFor({ airline: g.airline, name: g.name, ask: g.ask, from: a }) === true) e.preventDefault();
    });
    c.appendChild(foot([a]));
    return c;
  }
  /* 'give' の欄：1行（要る数はサーバーの数）と、欄の data-entry が許す時だけ、答えるカード。
     カードの中身が読めなければ、この欄は「いま読み出せません」（口がまだ無ければ「準備中」）── 行だけを先に出さない。 */
  function giveView(nodes, box) {
    return giveInfo().then(function (g) {
      nodes.push(lockLine(T.giveLock(g.need)));
      if (carries(box, 'give')) nodes.push(giveCard(g));
      return view('locked', nodes);
    });
  }
  /* 2社を並べる欄で、開いていない側の語。ログイン → 給与の提出 → 答える の順で先のもの。両方開いていれば空。 */
  function shut(a, b) {
    var order = ['login', 'locked', 'give'];
    for (var i = 0; i < order.length; i++) {
      if (a === order[i] || b === order[i]) return order[i];
    }
    return '';
  }
  function ofCo(rows, slug) {
    return rows.filter(function (r) { return r && r.airline === slug; });
  }

  var KIND = {};

  KIND.realpay = function (box, ids) {
    var slug = ids[0];
    return Promise.all([payRows(), dict()]).then(function (a) {
      var pay = a[0], D = a[1];
      var mine = ofCo(pay.rows, slug);
      var all = link(T.payAll, UP + 'actual-pay.html?air=' + enc(slug));
      var ul = el('ul', 'crl-rows');
      /* 何行まで見せるかは置き場が決める（会社ページの給与の1枚は 3 行。指定が無ければ今までどおり） */
      var top = Number(box.getAttribute('data-top')) || (GL ? 6 : 3);
      if (pay.open) {
        if (!mine.length) return view('empty', [msg(T.payEmpty), foot([all])]);
        mine.slice(0, top).forEach(function (r) { ul.appendChild(payRow(r, D)); });
        return view('open', GL ? [payCount(mine.length), ul, foot([all])] : [ul, foot([all])]);
      }
      /* ★2026-10-07 会社ページの入口は2行「Give & Get／全ての給与情報を解放する」（オーナーのご指示。前日の
           「匿名で給与を提出する」より新しい）。給与を出して開くのは REAL PAY だけで、ホテルなどは別の資格
           ── だから「待遇データ」ではなく「給与情報」。行き先も開く条件も変えていない。条件は隣の「閲覧条件」から読める。 */
      var feet = foot(GL ? [
        give2(T.payUnlock, UP + 'pay-report.html?airline=' + enc(slug)),
        pay.anon ? link(T.login, loginHref()) : null,
        link(T.payTerms, UP + 'actual-pay.html?air=' + enc(slug))
      ] : [
        link(T.payGive, UP + 'pay-report.html?airline=' + enc(slug), 'cta'),
        pay.anon ? link(T.login, loginHref()) : null,
        all
      ]);
      /* 会社ページで行が1つも無い ＝ この会社の提出がまだ無い（サーバーは鍵の無い人にも同じ行数を返す）。
         開けるものが無いので「提出で開きます」とは書かない */
      if (GL && !mine.length) return view('empty', [msg(T.payEmpty), feet]);
      var nodes = [];
      if (mine.length) {
        if (GL) {
          nodes.push(payCount(mine.length));
          mine.slice(0, top).forEach(function (r) { ul.appendChild(maskLine(r)); });
        } else {
          mine.slice(0, top).forEach(function (r) { ul.appendChild(maskRow(r, slug)); });
        }
        nodes.push(ul);
      }
      nodes.push(lockLine(T.payLock));
      nodes.push(feet);
      return view('locked', nodes);
    });
  };

  /* ── 勤務（月の勤務の集計）────────────────────────────────
     幅だけを出す。丸めも「3人そろった項目だけ」の壁もサーバー側で、ここは来た形のまま並べる。
     人数も、1人ずつの値も来ない（＝ここで数え直すものが無い）。 */
  function workName(it) {
    var s = el('span', 'crl-wk-k', it.name);
    if (it.unit) s.appendChild(el('small', 'crl-unit', it.unit));
    return s;
  }
  function rangeOf(v) {
    if (!v || !isNum(v.lo) || !isNum(v.hi)) return '';
    return v.lo === v.hi ? String(v.lo) : (String(v.lo) + T.dash + String(v.hi));
  }
  function workAny(by) {
    return T.workPos.some(function (p) {
      var o = by && by[p[0]];
      return !!o && T.work.some(function (it) { return !!rangeOf(o[it.k]); });
    });
  }
  /* 1項目ぶん（機長・副操縦士の2行）。そろっていない側は「未取得」── 0 で埋めない */
  function workCell(by, k) {
    var dl = el('dl', 'crl-wk-v');
    T.workPos.forEach(function (p) {
      var t = rangeOf(by && by[p[0]] && by[p[0]][k]);
      var r = el('div', 'crl-wk-r');
      r.appendChild(el('dt', '', p[1]));
      r.appendChild(el('dd', t ? '' : 'crl-none', t || T.none));
      dl.appendChild(r);
    });
    return dl;
  }
  /* ── 月の勤務を帯で（会社ページの面だけ：data-bars="1"）──
     軸は単位ごとに固定（T.workMax）で 0 から。集まった値で軸を動かさない。
     軸を超えた幅は右端で切って印を付ける。数字は切らずにそのまま書く。そろっていない側には帯を描かない（0 で埋めない）。 */
  function workScale(it, v) {
    var max = T.workMax[it.fam];
    function at(x) { return Math.max(0, Math.min(x, max)) / max * 100; }
    return { max: max, from: at(v.lo), to: at(v.hi), over: v.hi > max, out: v.lo > max };
  }
  /* 1つの職位の1行：職位の名前｜細い軸と帯｜数字｜単位。そろっていない側は「未取得」で、軸そのものを描かない（0 で埋めない） */
  function barRow(it, p, v) {
    var r = el('div', 'crl-wb-r'), t = rangeOf(v);
    r.setAttribute('data-pos', p[0]);
    r.appendChild(el('span', 'crl-wb-p', p[1]));
    if (!t) { r.appendChild(el('span', 'crl-none', T.none)); return r; }
    var s = workScale(it, v), tr = el('span', 'crl-wb-tr' + (s.over ? ' is-over' : ''));
    tr.setAttribute('aria-hidden', 'true');
    if (!s.out) {
      var b = el('i', 'crl-wb-b');
      b.style.setProperty('--f', s.from + '%');
      b.style.setProperty('--w', (s.to - s.from) + '%');
      tr.appendChild(b);
    }
    r.appendChild(tr);
    r.appendChild(el('b', 'crl-wb-n', t));
    r.appendChild(el('span', 'crl-wb-u', it.u));
    if (s.over) r.appendChild(el('small', 'crl-wb-o', T.workOver));
    return r;
  }
  /* 6つの項目の枠（見本の並び ＝ T.work の順）。枠の中に、職位ごとの1行。軸の両端は枠ごとに書かない（面の下の1行が1回だけ言う） */
  function workBars(by) {
    var w = el('div', 'crl-wb');
    T.work.forEach(function (it) {
      var c = el('div', 'crl-wb-c');
      c.setAttribute('data-k', it.k);
      c.setAttribute('data-fam', it.fam);
      c.appendChild(workName(it));
      T.workPos.forEach(function (p) { c.appendChild(barRow(it, p, by && by[p[0]] && by[p[0]][it.k])); });
      w.appendChild(c);
    });
    return w;
  }
  /* 面の下の1行：帯の読み方と、軸の両端（数字は T.workMax から。ここ以外に書かない） */
  function workCapLine() {
    var p = el('p', 'crl-wb-cap'), m = T.workMax;
    p.appendChild(el('span', '', T.workCap));
    p.appendChild(el('span', 'crl-wb-sc', T.workAxis[0] + T.dash + m.h + T.workAxis[1] + T.dash + m.d));
    return p;
  }
  /* 開いていないとき。1行と入口は lockView の1か所（どの入口を自分で出すかは、欄の data-entry が決める） */
  function workLocked(W, slug, box) { return lockView(W.state, slug, box, null); }

  /* 会員の補足（文はそのまま字として入れる。HTML として読ませない） */
  function noteHead() { return el('p', 'crl-note-h', T.noteHead); }
  function noteList(notes, keys, withWork, V) {
    var want = {}, ul = el('ul', 'crl-notes'), n = 0;
    keys.forEach(function (k) { want[k] = 1; });
    notes.forEach(function (x) {
      if (!x || typeof x.text !== 'string' || !x.text) return;
      var isWork = x.topic === 'work' && !x.q;
      if (isWork ? !withWork : !(typeof x.q === 'string' && want[x.q] === 1)) return;
      var li = el('li', 'crl-note');
      var h = el('p', 'crl-note-k');
      h.appendChild(el('span', '', isWork ? T.noteWork : ((V && V[x.q] && V[x.q].ja) || '')));
      if (x.mine === true) h.appendChild(el('span', 'crl-note-me', T.noteMine));
      li.appendChild(h);
      li.appendChild(el('p', 'crl-note-t', x.text));
      ul.appendChild(li);
      n++;
    });
    return n ? ul : null;
  }
  /* 補足が読めなくても、欄の本題（集計）は出す */
  function notesFor(box, slug) {
    return Promise.all([notesOf(slug), vocab()]).then(function (a) {
      return noteList(a[0].notes, keysOf(box), box.hasAttribute('data-work'), a[1]);
    }).then(null, function () { return null; });
  }

  KIND.work = function (box, ids) {
    var slug = ids[0];
    return workView(slug).then(function (W) {
      /* 1社の概要（career.html）では、ログインと給与の入口は欄のすぐ下に在る ＝ ここは1行だけ（答えるカードだけは自分で出す） */
      if (W.state !== 'open') return workLocked(W, slug, GL ? box : GIVE_ONLY);
      return (box.hasAttribute('data-notes') ? notesFor(box, slug) : Promise.resolve(null)).then(function (ul) {
        var any = workAny(W.by), nodes = [];
        if (any && box.getAttribute('data-bars') === '1') {
          nodes.push(workBars(W.by));
          nodes.push(workCapLine());
        } else if (any) {
          var g = el('div', 'crl-work');
          T.work.forEach(function (it) {
            var c = el('div', 'crl-wk');
            c.appendChild(workName(it));
            c.appendChild(workCell(W.by, it.k));
            g.appendChild(c);
          });
          nodes.push(g);
        } else {
          nodes.push(msg(T.workEmpty));
        }
        if (ul) { nodes.push(noteHead()); nodes.push(ul); }
        return view((any || ul) ? 'open' : 'empty', nodes);
      });
    });
  };

  /* 勤務・訓練のほかの話題に付いた補足（待遇・通勤）。読めるものが無ければ、欄ごと出さない。
     未ログインには何も出さない ── サーバーは「在る・無い」も返さないので、在りもしないものに鍵の絵を描かない。 */
  KIND.notes = function (box, ids) {
    return notesFor(box, ids[0]).then(function (ul) {
      return ul ? view('open', [noteHead(), ul]) : view('empty', []);
    });
  };

  /* ── 会員が挙げた街（会社ページの暮らしの板。欄は .crl[data-live="towns"] の1つ）──────────
     読むのは2つ：(1) ほかの人の回答 ＝ pv_town_board（見せてよいかはサーバーの1か所 ＝ pv_contrib_sees。開いていなければ状態の1語だけ）
                  (2) 読む人自身の投稿 ＝ PVContrib.myTowns()（控えの鍵と読み口は pv-contrib.js が持つ。このページの会社のぶん）。
     開いていない時の1行と入口は lockView のまま。自分の投稿は、その上に置く（lead）。
     ★並べ替えない・足さない・数えない・切らない（並びは人数の多い順のサーバーの並び・人数はサーバーの数のまま）。 */
  var TOWN_SAY = ['login', 'locked', 'give', 'open'];
  function townBoard(slug, base) {
    return once('town:' + slug + ':' + base, function () {
      return client().then(function (sb) { return sb.rpc('pv_town_board', { p: { airline: slug, base: base } }); }).then(function (res) {
        if (!res || res.error) throw sbErr(res);
        var x = res.data;
        /* 知らない語は、開いているとも0件とも読まない */
        if (!x || typeof x !== 'object' || x.ok === false || TOWN_SAY.indexOf(x.state) < 0) throw fail('error');
        if (x.state !== 'open') return { state: x.state, towns: [] };
        if (!isArr(x.towns)) throw fail('error');
        /* 名前と、本当の人数（1 以上の整数）を持つ街だけを描く */
        return {
          state: 'open',
          towns: x.towns.filter(function (t) { return t && typeof t.name === 'string' && t.name.replace(/^\s+|\s+$/g, '') && isInt(t.n) && t.n >= 1; })
        };
      });
    });
  }
  /* 自分の投稿（この基地のぶん）。読めない時・面の部品が無い時は null（欄の本題は、ほかの人の回答の側）。投げない。取っておかない。 */
  function townMine(slug, base) {
    function ask() {
      var C = w.PVContrib, p;
      if (!C || typeof C.myTowns !== 'function') return null;
      try { p = C.myTowns(); } catch (e) { return null; }
      return Promise.resolve(p).then(function (r) {
        if (!r || r.k !== 'ok' || !isArr(r.rows)) return null;
        return {
          held: r.held === true,
          rows: r.rows.filter(function (x) { return x && typeof x.town === 'string' && x.town && x.base === base; })
        };
      }, function () { return null; });
    }
    var now = ask();
    if (now || d.readyState !== 'loading') return Promise.resolve(now);
    /* pv-contrib.js は、このファイルのあとに読まれる */
    return new Promise(function (res) {
      d.addEventListener('DOMContentLoaded', function () { res(ask()); });
    });
  }
  /* 自分の行の札。街か文が確認待ちなら「確認待ち」、どちらかが見送りで確認待ちが無ければ「見送り」、ほかは何も付けない。 */
  function townSay(r) {
    if (r.town_state === 'pending' || r.text_state === 'pending') return T.townWait;
    if (r.town_state === 'rejected' || r.text_state === 'rejected') return T.townNo;
    return '';
  }
  function ownBlock(M) {
    if (!M || !M.rows.length) return null;
    var me = el('div', 'crl-town-me'), ul = el('ul', 'crl-town-own');
    me.appendChild(el('p', 'crl-note-h', T.noteMine));
    if (M.held) me.appendChild(msg(T.townHeld));
    M.rows.forEach(function (r) {
      var li = el('li'), say = townSay(r), b = el('button', 'crl-link crl-town-ed', T.townEdit);
      li.appendChild(el('span', 'crl-town-n pv-no-cur', r.town));
      if (say) li.appendChild(el('span', 'crl-town-st', say));
      /* 押すと、面（pv-contrib.js）の押し口が、その街の「修正」として開く */
      b.type = 'button';
      b.setAttribute('data-pvc-open', 'town');
      b.setAttribute('data-pvc-ctx', r.town);
      li.appendChild(b);
      ul.appendChild(li);
    });
    me.appendChild(ul);
    return me;
  }
  function townList(towns) {
    var ol = el('ol', 'crl-towns');
    towns.forEach(function (t) {
      var li = el('li', 'crl-town'), k = el('p', 'crl-town-k');
      k.appendChild(el('span', 'crl-town-n pv-no-cur', t.name));
      if (t.mine === true) k.appendChild(el('span', 'crl-note-me', T.noteMine));
      k.appendChild(el('span', 'crl-town-c', T.answered(t.n)));
      li.appendChild(k);
      [['good', T.sumGood], ['concern', T.sumConcern]].forEach(function (g) {
        var xs = (isArr(t[g[0]]) ? t[g[0]] : []).filter(function (x) { return x && typeof x.text === 'string' && x.text; });
        if (!xs.length) return;
        var ul = el('ul', 'crl-town-tx');
        li.appendChild(el('p', 'crl-town-l', g[1]));
        xs.forEach(function (x) {
          var it = el('li', 'crl-town-t pv-no-cur', x.text);
          if (x.mine === true) it.appendChild(el('span', 'crl-note-me', T.noteMine));
          ul.appendChild(it);
        });
        li.appendChild(ul);
      });
      ol.appendChild(li);
    });
    return ol;
  }
  KIND.towns = function (box, ids) {
    var slug = ids[0], base = box.getAttribute('data-base') || '';
    if (!/^[A-Z]{3}$/.test(base)) return Promise.reject(fail('error'));
    return Promise.all([townBoard(slug, base), townMine(slug, base)]).then(function (a) {
      var B = a[0], me = ownBlock(a[1]), nodes;
      if (B.state !== 'open') return lockView(B.state, slug, box, me);
      if (!B.towns.length && !me) return view('empty', []);
      nodes = me ? [me] : [];
      if (B.towns.length) { nodes.push(el('p', 'crl-town-h', T.townHead)); nodes.push(townList(B.towns)); }
      return view('open', nodes);
    });
  };

  /* ── 比較の骨組み（2社を同じ形で並べる。勝ち負けの語も色も付けない）────── */
  function cmpGrid(ids) {
    var g = el('div', 'crl-cmp');
    var h = el('div', 'crl-cmp-head');
    h.appendChild(coTag(ids[0]));
    h.appendChild(coTag(ids[1]));
    g.appendChild(h);
    return g;
  }
  function cmpRow(g, nameNode, cellA, cellB) {
    var r = el('div', 'crl-cmp-row');
    if (nameNode) {
      nameNode.className = (nameNode.className ? nameNode.className + ' ' : '') + 'crl-cmp-k';
      r.appendChild(nameNode);
    }
    var a = el('div', 'crl-cmp-c'); a.appendChild(cellA); r.appendChild(a);
    var b = el('div', 'crl-cmp-c'); b.appendChild(cellB); r.appendChild(b);
    g.appendChild(r);
  }

  KIND['cmp-work'] = function (box, ids) {
    return Promise.all([workView(ids[0]), workView(ids[1])]).then(function (a) {
      var A = a[0], B = a[1];
      /* どちらかが開いていなければ、欄に1行だけ（どちらの会社の値も出さない） */
      var who = shut(A.state, B.state);
      if (who) return lockView(who, '', box, null);
      /* 片方がそろっていなくても、もう片方は普通に出す */
      if (!workAny(A.by) && !workAny(B.by)) return view('empty', [msg(T.workEmpty)]);
      var g = cmpGrid(ids);
      T.work.forEach(function (it) {
        cmpRow(g, workName(it), workCell(A.by, it.k), workCell(B.by, it.k));
      });
      return view('open', [g]);
    });
  };

  /* ── 口コミ（実投稿だけ）──────────────────────────────── */
  function score(rows) {
    var sum = 0, k = 0;
    rows.forEach(function (r) {
      var s = 0, c = 0;
      SCORES.forEach(function (key) {
        var v = Number(r && r[key]);
        if (isFinite(v) && v > 0) { s += v; c++; }
      });
      if (c) { sum += s / c; k++; }
    });
    return { n: rows.length, avg: k ? Math.min(5, sum / k) : null };
  }
  function scoreLine(s) {
    var p = el('p', 'crl-score');
    if (s.avg != null) {
      var st = el('span', 'crl-stars');
      st.setAttribute('aria-hidden', 'true');
      st.style.setProperty('--crl-fill', (Math.round(s.avg / 5 * 1000) / 10) + '%');
      p.appendChild(st);
      p.appendChild(el('b', 'crl-avg', s.avg.toFixed(1)));
    }
    p.appendChild(el('span', 'crl-cnt', T.revCount(s.n)));
    return p;
  }

  /* ── 評価スコア（会社ページ）──────────────────────────────
     2026-10-06 オーナーのご指示「パイロットによる評価スコアの部分、企業トップのどこかのカードに残して」。
     ★ 使うのは会員が実際に付けた点数だけ（2026-10-06 夜の修正指示の3）。
       見本の点数を混ぜない・投稿が無い会社に点数を出さない・0件を 0点にしない（出すのは「評価未取得」）。
       ほかの会社のページの帯（airline-reviews-ui.js）は見本の点数を混ぜているので、ここでは呼ばない。
     ★ 点数は誰にでも返る列（本文と訳だけが鍵つき）── 鍵の無い人にも同じ点数が出る。権限は変えていない。
     ★ 6分類の名前だけは会社ページの口コミ欄から借りる（同じ分類を別の言葉で呼ばない）。
     ★ 読めなかった時は点数を出さない（「いま読み出せません」＋やり直す）。0件と通信失敗を同じに見せない。 */
  function catNames() {
    var u = GL && w.PVReviewUI;
    var a = u && u.cats && u.cats.short;
    return (isArr(a) && a.length === SCORES.length) ? a : null;
  }
  function realRated(rows) {
    var sum = [], cnt = [], total = 0, n = 0;
    SCORES.forEach(function () { sum.push(0); cnt.push(0); });
    (rows || []).forEach(function (r) {
      var s = 0, c = 0;
      SCORES.forEach(function (key, i) {
        var v = Number(r && r[key]);
        if (!isFinite(v) || v <= 0) return;           // 付けていない分類は数えない（0 を平均に入れない）
        v = Math.min(5, v);
        sum[i] += v; cnt[i]++;
        s += v; c++;
      });
      if (c) { total += s / c; n++; }
    });
    if (!n) return null;                              // 点数の付いた投稿が無い ＝ 評価未取得
    var full = cnt.every(function (c) { return c > 0; });
    return {
      n: n,
      avg: total / n,
      /* 6角形は、6分類ぜんぶに点数があるときだけ（欠けた角を 0 で描くと「0点」に見える） */
      ratings: full ? sum.map(function (v, i) { return v / cnt[i]; }) : null
    };
  }
  function starsEl(avg) {
    var st = el('span', 'crl-stars');
    st.setAttribute('aria-hidden', 'true');
    st.style.setProperty('--crl-fill', (Math.round(avg / 5 * 1000) / 10) + '%');
    return st;
  }
  function noStars() {                                // 輪郭だけの星（形は CSS。字はここに置かない）
    var st = el('span', 'crl-stars');
    st.setAttribute('aria-hidden', 'true');
    st.setAttribute('data-none', '');
    return st;
  }
  function svgEl(tag, cls, attrs) {
    var n = d.createElementNS(NS, tag);
    if (cls) n.setAttribute('class', cls);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  /* 6角形の図。名前と点数は図のまわりに HTML で置く（図の中の字にすると、狭い画面で 12px を割る）。
     6分類の点数を字で出すのはここだけ ＝ 読み上げから外すのは絵だけで、名前と点数は読ませる */
  function radar(vals, names) {
    var box = el('div', 'crl-radar'), n = vals.length, C = 100, R = 92;
    box.setAttribute('role', 'list');
    function xy(i, k) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [(C + R * k * Math.cos(a)).toFixed(1), (C + R * k * Math.sin(a)).toFixed(1)];
    }
    function pts(fn) {
      var s = [];
      for (var i = 0; i < n; i++) s.push(xy(i, fn(i)).join(','));
      return s.join(' ');
    }
    var svg = svgEl('svg', 'crl-radar-svg', { viewBox: '0 0 200 200', focusable: 'false', 'aria-hidden': 'true' });
    [0.2, 0.4, 0.6, 0.8, 1].forEach(function (k) {
      svg.appendChild(svgEl('polygon', 'crl-radar-ring', { points: pts(function () { return k; }) }));
    });
    for (var i = 0; i < n; i++) {
      var e = xy(i, 1);
      svg.appendChild(svgEl('line', 'crl-radar-axis', { x1: C, y1: C, x2: e[0], y2: e[1] }));
    }
    svg.appendChild(svgEl('polygon', 'crl-radar-shape', { points: pts(function (j) { return vals[j] / 5; }) }));
    vals.forEach(function (v, j) {
      var p = xy(j, v / 5);
      svg.appendChild(svgEl('circle', 'crl-radar-dot', { cx: p[0], cy: p[1], r: 3.5 }));
    });
    box.appendChild(svg);
    vals.forEach(function (v, j) {
      var l = el('span', 'crl-radar-l');
      l.setAttribute('role', 'listitem');
      l.setAttribute('data-i', String(j));
      l.appendChild(el('span', '', names[j]));
      l.appendChild(el('b', '', v.toFixed(1)));
      box.appendChild(l);
    });
    return box;
  }

  KIND.stars = function (box, ids) {
    var slug = ids[0];
    return reviews(slug).then(function (res) {
      if (GL) {
        /* 会社ページ：社名の横と口コミのカードの右上。押すと同じページの「口コミ」のタブが開く。
           点数は下の「評価スコア」の箱と同じ realRated() の答え。 */
        var R = realRated(res.rows);
        var a = el('a', 'crl-score crl-score-a');
        a.setAttribute('href', '#reviews');
        if (R) {
          a.appendChild(starsEl(R.avg));
          a.appendChild(el('b', 'crl-avg', R.avg.toFixed(1)));
          a.appendChild(el('span', 'crl-cnt', T.revRated(R.n)));
        } else {
          a.appendChild(noStars());
          a.appendChild(el('span', 'crl-cnt', T.revNo));
        }
        a.appendChild(icon('arrow', 14));
        return view(R ? 'open' : 'empty', [a]);
      }
      var s = score(res.rows);
      if (!s.n) {
        return view('empty', [msg(GL ? T.revNone : T.revEmpty),
          foot([link(T.revGive, UP + 'submit-review.html?airline=' + enc(slug))])]);
      }
      return view('open', [scoreLine(s)]);
    });
  };

  /* ★2026-10-06 オーナーのご指示「現行みたいにデカデカと評価スコアの部分を入れる必要ないけど、
       パッと見てわかるようにして」「レーダー図はいれて」
     ── 置くのは2つだけ：総合（点数・星・人数）と、6角形の図（まわりに6分類の名前と点数）。
        同じ6つの数字をもう一度並べる棒は置かない（欄が倍の高さになる）。 */
  KIND.score = function (box, ids) {
    var slug = ids[0];
    return reviews(slug).then(function (res) {
      var R = realRated(res.rows);
      if (!R) {
        /* 点数の付いた投稿がまだ無い。0 も見本も置かず、書く入口だけを出す */
        return view('empty', [msg(T.revNone),
          foot([link(T.revGive, UP + 'submit-review.html?airline=' + enc(slug))])]);
      }
      var wrap = el('div', 'crl-sc');
      var sum = el('div', 'crl-sc-sum');
      var big = el('p', 'crl-sc-avg');
      big.appendChild(el('b', '', R.avg.toFixed(1)));
      big.appendChild(el('span', '', '/ 5.0'));
      sum.appendChild(big);
      sum.appendChild(starsEl(R.avg));
      sum.appendChild(el('p', 'crl-sc-cnt', T.revRated(R.n)));
      wrap.appendChild(sum);
      var names = catNames();
      if (R.ratings && names) wrap.appendChild(radar(R.ratings, names));
      return view('open', [wrap]);
    });
  };

  /* ── 口コミの要約（会社ページ）────────────────────────────
     良い点・気になる点を、会員の口コミから AI がまとめたもの。中身はサーバーが持っていて、
     ★ 本文を読める人にだけ返る（鍵の判定は本文と同じ関数）。ほかの人には状態の1語しか来ない。
     ★ 状態は7つで、言葉を混ぜない ── ログイン／鍵／口コミが少ない／まだ無い／未接続（口が無い）／取得失敗／開いている。
        未接続は PGRST202（関数が無い）のときだけ。ほかの失敗は「やり直す」の出る失敗の形。
     ★ 文は textContent で入れる。点の矢印は data-pvg-cat（分類）と data-pvg-ids（もとの口コミ）を持ち、
        押すと同じページの口コミがその分類で開き、もとの口コミに札が付く（pv-glance.js → airline-reviews-ui.js）。 */
  function summary(slug) {
    return once('sum:' + slug, function () {
      return client().then(function (sb) {
        return sb.rpc('pv_review_summary', { p: { airline: slug, lang: 'ja' } });
      }).then(function (res) {
        if (!res || res.error) {
          var code = String((res && res.error && res.error.code) || '');
          throw fail(code === 'PGRST202' ? 'off' : 'error');     // 未接続は「関数が無い」のときだけ
        }
        var x = res.data;
        if (!x || x.ok === false) throw fail('error');
        return x;
      });
    });
  }
  var SUM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  function sumList(title, kind, items) {
    var wrap = el('div', 'crl-sum-col');
    wrap.setAttribute('data-kind', kind);
    wrap.appendChild(el('h4', 'crl-sum-h', title));
    var ul = el('ul', 'crl-sum-ul');
    items.slice(0, 3).forEach(function (it) {
      var text = it && typeof it.text === 'string' ? it.text : '';
      if (!text) return;
      var li = el('li', 'crl-sum-li');
      li.appendChild(el('span', 'crl-sum-t', text));
      var cat = it && typeof it.cat === 'string' && /^[a-z]{2,12}$/.test(it.cat) ? it.cat : '';
      if (cat) {
        var a = el('a', 'crl-sum-a');
        a.setAttribute('href', '#reviews');
        a.setAttribute('data-pvg-cat', cat);
        a.setAttribute('aria-label', T.sumSrc);
        var src = (it && isArr(it.ids) ? it.ids : []).filter(function (s) { return typeof s === 'string' && SUM_ID.test(s); });
        if (src.length) a.setAttribute('data-pvg-ids', src.join(','));
        a.appendChild(icon('arrow', 14));
        li.appendChild(a);
      }
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    return ul.childNodes.length ? wrap : null;
  }
  function sumNote(text, why) { var p = msg(text); p.setAttribute('data-why', why); return p; }
  KIND.summary = function (box, ids) {
    return summary(ids[0]).then(function (x) {
      if (x.state === 'login') {
        var need = lockLine(T.loginLock);
        need.setAttribute('data-why', 'login');
        return view('locked', [need, loginLink()]);
      }
      if (x.state === 'locked') {
        var key = lockLine(T.sumLock);
        key.setAttribute('data-why', 'key');
        return view('locked', [key]);                         // 入口はカードの投稿ボタン1つ（ここに足さない）
      }
      if (x.state === 'few') return view('empty', [sumNote(T.sumFew, 'few')]);
      if (x.state !== 'open') return view('empty', [sumNote(T.sumNone, 'none')]);
      var good = sumList(T.sumGood, 'good', isArr(x.good) ? x.good : []);
      var bad = sumList(T.sumConcern, 'concern', isArr(x.concern) ? x.concern : []);
      if (!good && !bad) return view('empty', [sumNote(T.sumNone, 'none')]);
      var grid = el('div', 'crl-sum');
      if (good) grid.appendChild(good);
      if (bad) grid.appendChild(bad);
      var by = el('p', 'crl-sum-by');
      by.appendChild(el('span', 'crl-sum-ai', T.sumAi));
      var n = Number(x.n);
      if (isFinite(n) && n > 0) by.appendChild(el('span', 'crl-sum-n', T.sumFrom(n)));     // 件数が読めなければ書かない
      if (typeof x.as_of === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.as_of)) by.appendChild(el('span', 'crl-sum-d', T.sumWhen(x.as_of)));
      return view('open', [el('h3', 'crl-sum-title', T.sumHead), grid, by]);
    }, function (e) {
      if (e && e.crl === 'off') return view('empty', [sumNote(T.sumOff, 'off')]);   // 口がまだ無い ＝ 未接続（件数も文も作らない）
      throw e;
    });
  };

  KIND['cmp-stars'] = function (box, ids) {
    return Promise.all([reviews(ids[0]), reviews(ids[1])]).then(function (a) {
      var A = score(a[0].rows), B = score(a[1].rows);
      if (!A.n && !B.n) return view('empty', [msg(T.revEmpty)]);
      var g = cmpGrid(ids);
      cmpRow(g, null,
        A.n ? scoreLine(A) : el('span', 'crl-none', T.revEmpty),
        B.n ? scoreLine(B) : el('span', 'crl-none', T.revEmpty));
      return view('open', [g]);
    });
  };

  /* 1件ぶん。鍵のある人には本文、無い人にはサーバーが返した抜粋と区分の名前だけ。
     本文を切るのは見た目（CSS）だけで、字は作らない・足さない。 */
  function reviewItem(p, row) {
    var li = el('li', 'crl-rev');
    if (p.locked) li.setAttribute('data-mask', '');
    var when = ym(row && row.created_at);
    if (when) li.appendChild(el('p', 'crl-rev-when', when));
    var cats = isArr(p.cats) ? p.cats : [];
    var withText = cats.filter(function (c) { return c && c.text; }).slice(0, p.locked ? 1 : 3);
    withText.forEach(function (c) {
      var b = el('div', 'crl-rev-cat');
      b.appendChild(el('span', 'crl-chip', c.label));
      b.appendChild(el('p', p.locked ? 'crl-rev-text crl-rev-clip' : 'crl-rev-text', c.text));
      li.appendChild(b);
    });
    var rest = cats.filter(function (c) { return c && c.label && withText.indexOf(c) < 0; });
    if (rest.length) {
      var chips = el('p', 'crl-chips');
      rest.forEach(function (c) { chips.appendChild(el('span', 'crl-chip', c.label)); });
      li.appendChild(chips);
    }
    return li;
  }

  KIND.reviews = function (box, ids) {
    var slug = ids[0];
    return Promise.all([reviews(slug), i18n()]).then(function (a) {
      var res = a[0], I = a[1];
      if (!res.rows.length) return view('empty', []);     // 言葉は stars の欄が出す（同じ文を2回出さない）
      var ul = el('ul', 'crl-revs'), anyLocked = false;
      res.rows.slice(0, 2).forEach(function (r) {
        var p = I.pick(r);
        if (p.locked) anyLocked = true;
        ul.appendChild(reviewItem(p, r));
      });
      /* 会社ページでは、同じページの「口コミ」のタブを開く（pv-glance.js が受ける）。 */
      var all = link(T.revAll, GL ? '#reviews' : 'airlines/' + enc(slug) + '.html');
      if (anyLocked) {
        /* 会社ページの箱は、書く入口を箱の底に1つ持っている（data-give="0"）。同じボタンを2つ並べない */
        var give = box.getAttribute('data-give') === '0' ? null
          : link(T.revGive, UP + 'submit-review.html?airline=' + enc(slug), 'cta');
        return view('locked', [ul, lockLine(T.revLock), foot([give, all])]);
      }
      return view('open', [ul, foot([all])]);
    });
  };

  /* ── 待遇の集計 ─────────────────────────────────────────── */
  function keysOf(box) {
    var s = box.getAttribute('data-keys') || '';
    return s.split(',').map(function (k) { return k.trim(); }).filter(Boolean);
  }
  function numText(v) { return String(Math.round(Number(v) * 10) / 10); }
  /* 出す形は3つだけ。
       数の質問 … 中央値。
       選ぶ質問 … 「最多」と書く答えは、サーバーが決めて返す（行の lead。決め方は db/contrib.sql の pv_contrib_facts の1か所）。
                  lead が1つなら、その名前に「最多」。
                  lead が空なら（いちばん多い答えが並んだ）、答えの名前は出さずに「回答が分かれています」。
                  選べるだけ選ぶ質問で lead が2つ以上なら、どれも最多 ＝ 台帳の並びで全部出す（届いた並びではない）。
     lead の無い行・並びでない行・名前が引けない答えの入った行は出さない。
     ここでは数えない・決めない（答えごとの人数は届かない。ほかの鍵が付いてきても、そこから答えを作らない）。
     人数（n）は、その質問に答えた人の数。 */
  function optName(voc, code) {
    var o = voc.options;
    return (o && Object.prototype.hasOwnProperty.call(o, code) && o[code]) ? String(o[code]) : '';
  }
  function answer(row, voc) {
    if (!row || !voc) return null;
    var text = '', how = '', split = false;
    if ((voc.kind === 'num' || row.kind === 'num') && row.median_num != null && isFinite(Number(row.median_num))) {
      text = numText(row.median_num) + (voc.unit || ''); how = T.median;
    } else {
      var lead = row.lead;
      if (!isArr(lead)) return null;
      if (!lead.length) {
        text = T.split; split = true;
      } else {
        if (lead.length > 1 && voc.kind !== 'multi' && row.kind !== 'multi') return null;
        if (lead.some(function (c) { return !optName(voc, c); })) return null;
        text = Object.keys(voc.options).filter(function (c) { return lead.indexOf(c) >= 0; })
          .map(function (c) { return optName(voc, c); }).join('、');
        how = T.top;
      }
    }
    if (!text) return null;
    return { text: text, how: how, split: split, n: (isNum(row.n) && row.n > 0) ? row.n : null, when: ym(row.ym) };
  }
  function answerNode(ans) {
    if (!ans) return el('span', 'crl-none', T.factNone);
    var w0 = el('div', 'crl-ans');
    w0.appendChild(el('b', 'crl-ans-v', ans.text));
    var m = el('span', 'crl-ans-m');
    if (!ans.split) m.appendChild(el('span', 'crl-how', ans.how));
    if (ans.n) m.appendChild(el('span', '', T.answered(ans.n)));
    if (ans.when) m.appendChild(el('span', '', ans.when));
    w0.appendChild(m);
    return w0;
  }

  KIND.fact = function (box, ids) {
    var keys = keysOf(box), slug = ids[0];
    if (!keys.length) return Promise.reject(fail('error'));
    return Promise.all([facts(slug), vocab()]).then(function (a) {
      var F = a[0], V = a[1], list = el('div', 'crl-facts'), n = 0, sub = {}, shown = {};
      (box.getAttribute('data-sub') || '').split(',').forEach(function (s) {
        var c = s.split(':');
        if (c.length === 2 && c[0] && c[1]) sub[c[0]] = c[1];
      });
      /* 親の行が出ていない子には、親の質問の字だけを上に置く（値は書かない。子の字だけでは何の話か分からない） */
      function ctx(k) {
        var p = sub[k];
        if (!p || shown[p] === 1 || !V[p] || !V[p].ja) return;
        ctx(p);
        var c = el('div', sub[p] ? 'crl-fact is-sub is-ctx' : 'crl-fact is-ctx');
        c.appendChild(el('span', 'crl-fact-k', V[p].ja));
        list.appendChild(c);
        shown[p] = 1;
      }
      /* この欄の質問を聞いていない答えでは描かない（0件とも鍵とも言えない） */
      if (keys.some(function (k) { return F.asked[k] !== 1; })) throw fail('error');
      /* 鍵の文を繰り返さない欄（data-quiet）。開いていないとサーバーが言ったとき（未ログイン・給与の鍵が無い・
         自分の会社への回答がまだ足りない）は、何も描かない。同じ文は、同じ板の月の勤務の欄が1回だけ言う
         （入口もカードもそこに1つ）。読めない・準備中の時はここを通らない */
      if (F.state !== 'open' && box.getAttribute('data-quiet') === '1') return view('locked', []);
      if (F.state !== 'open') return lockView(F.state, slug, box, null);
      keys.forEach(function (k) {
        var ans = answer(F.map[k], V[k]);
        if (!ans) return;
        ctx(k);
        var r = el('div', sub[k] ? 'crl-fact is-sub' : 'crl-fact');
        r.appendChild(el('span', 'crl-fact-k', V[k].ja || ''));
        r.appendChild(answerNode(ans));
        list.appendChild(r);
        shown[k] = 1; n++;
      });
      return n ? view('open', [list]) : view('empty', [msg(T.factEmpty)]);
    });
  };

  /* 比較で並べる鍵。欄に書いてあればそれ、無ければページの話題のカードが持つ鍵をそのまま借りる。 */
  function cmpKeys(box) {
    var keys = keysOf(box);
    if (keys.length) return keys;
    var seen = {}, out = [];
    var all = root.querySelectorAll('.crl[data-live="fact"][data-keys]');
    for (var i = 0; i < all.length; i++) {
      keysOf(all[i]).forEach(function (k) { if (!seen[k]) { seen[k] = 1; out.push(k); } });
    }
    return out;
  }

  KIND['cmp-facts'] = function (box, ids) {
    var keys = cmpKeys(box);
    if (!keys.length) return Promise.reject(fail('error'));
    return Promise.all([facts(ids[0]), facts(ids[1]), vocab()]).then(function (a) {
      var FA = a[0], FB = a[1], V = a[2];
      /* 並べる質問を聞いていない答えでは描かない（0件とも鍵とも言えない） */
      if (keys.some(function (k) { return FA.asked[k] !== 1 || FB.asked[k] !== 1; })) throw fail('error');
      /* どちらかが開いていなければ、欄に1行だけ（どちらの会社の値も出さない）。入口はここに置かない（上の欄が持つ） */
      var who = shut(FA.state, FB.state);
      if (who) return lockView(who, '', NONE, null);
      var g = cmpGrid(ids), n = 0;
      keys.forEach(function (k) {
        var A = answer(FA.map[k], V[k]), B = answer(FB.map[k], V[k]);
        if (!A && !B) return;
        cmpRow(g, el('span', '', V[k].ja || ''), answerNode(A), answerNode(B));
        n++;
      });
      return n ? view('open', [g]) : view('empty', [msg(T.factEmpty)]);
    });
  };

  /* ── 欄を塗る ───────────────────────────────────────────── */
  var seq = 0;
  function paint(box, state, nodes) {
    clear(box);
    (nodes || []).forEach(function (n) { if (n) box.appendChild(n); });
    box.setAttribute('data-state', state);
    box.removeAttribute('aria-busy');
  }
  function paintLoading(box) {
    var sk = el('div', 'crl-sk');
    sk.setAttribute('aria-hidden', 'true');
    sk.appendChild(el('i')); sk.appendChild(el('i')); sk.appendChild(el('i'));
    paint(box, 'loading', [sk, el('span', 'crl-sr', T.loading)]);
    box.setAttribute('aria-busy', 'true');
  }
  function paintError(box) {
    var b = el('button', 'crl-retry', T.retry);
    b.type = 'button';
    b.addEventListener('click', retryAll);
    paint(box, 'error', [msg(T.err), b]);
  }
  function idle(box) {
    box._crlTok = ++seq;
    paint(box, 'idle', [el('span', 'crl-ph', '—')]);
    box.removeAttribute('data-for');
  }
  function slots() { return root.querySelectorAll('.crl[data-live]'); }
  function reset(kinds) {
    var all = slots();
    for (var i = 0; i < all.length; i++) {
      if (kinds.indexOf(all[i].getAttribute('data-live')) >= 0) idle(all[i]);
    }
  }
  function retryAll() {
    var all = slots();
    for (var i = 0; i < all.length; i++) {
      if (KIND[all[i].getAttribute('data-live')] && all[i].getAttribute('data-state') === 'error') idle(all[i]);
    }
    sync();
  }

  function run(box, kind, want, quiet) {
    var tok = box._crlTok = ++seq;
    box.setAttribute('data-for', want);
    if (!quiet) paintLoading(box);
    var out;
    try { out = Promise.resolve(KIND[kind](box, want.split('|'))); } catch (e) { out = Promise.reject(e); }
    out.then(function (v) {
      if (box._crlTok !== tok) return;
      paint(box, v.state, v.nodes);
    }, function (e) {
      if (box._crlTok !== tok) return;
      if (e && e.crl === 'off') paint(box, 'off', [msg(T.off)]);
      else paintError(box);
    });
  }

  /* ── いつ取りに行くか ─────────────────────────────────── */
  function shown(n) {
    for (var p = n; p && p !== d.documentElement; p = p.parentNode) {
      if (p.nodeType === 1 && p.hasAttribute('hidden')) return false;
    }
    return n.getClientRects().length > 0;
  }
  function pair() {
    var PC = w.PVCareer, st = null, a = '', b = '';
    try { st = (PC && typeof PC.state === 'function') ? PC.state() : null; } catch (e) { st = null; }
    if (st) { a = st.a || ''; b = st.b || ''; }
    var sa = d.getElementById('cr-a'), sb2 = d.getElementById('cr-b');
    if (!a && sa) a = sa.value || '';
    if (!b && sb2) b = sb2.value || '';
    if (!a || !b) {
      var q = new URLSearchParams(location.search);
      a = a || q.get('a') || root.getAttribute('data-a') || '';
      b = b || q.get('b') || root.getAttribute('data-b') || '';
    }
    return (okSlug(a) && okSlug(b) && a !== b) ? (a + '|' + b) : '';
  }
  function wantOf(box, kind) {
    if (kind.indexOf('cmp-') === 0) return pair();
    var s = box.getAttribute('data-airline') || '';
    return okSlug(s) ? s : '';
  }
  function sync() {
    var all = slots();
    for (var i = 0; i < all.length; i++) {
      var box = all[i], kind = box.getAttribute('data-live');
      if (!KIND[kind]) continue;                 // ほかの担当の欄（hotels など）
      if (!shown(box)) continue;
      var want = wantOf(box, kind);
      if (!want) continue;
      if (box.getAttribute('data-for') === want && box.getAttribute('data-state') !== 'idle') continue;
      run(box, kind, want, false);
    }
  }
  var queued = false;
  function later() {
    if (queued) return;
    queued = true;
    setTimeout(function () { queued = false; sync(); }, 0);
  }

  var PC = w.PVCareer = w.PVCareer || {};
  PC.client = client;

  root.addEventListener('cr:show', later);
  root.addEventListener('change', function (e) {
    var t = e.target;
    if (t && (t.id === 'cr-a' || t.id === 'cr-b')) later();
  });
  root.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('#cr-swap')) later();
  });
  w.addEventListener('popstate', later);
  w.addEventListener('pageshow', later);
  if (w.MutationObserver) {
    new MutationObserver(later).observe(root, {
      attributes: true, subtree: true, attributeFilter: ['hidden', 'data-a', 'data-b']
    });
  }
  if (GL) {
    /* 会社ページの欄は、タブの切替と <details> の開閉で出たり隠れたりする（hidden 属性を通らない）。 */
    d.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('.airline-tab-btn,[data-pvg-tab]')) later();
    });
    d.addEventListener('toggle', later, true);
  }
  /* ログインが知らせなく終わった（ほかのタブで鍵が消えた・この画面の中で期限が切れた）。supabase からは何も届かないので、
     「情報を追加」の面（pv-contrib.js）が気づいて流す 'pvc:logout' で受ける。鍵がもう無ければ、読む人が替わった時と同じ（setUid）
     ＝ ログインのあいだに読んだ行を、その場で全部消して、ログインしていない人の形で取り直す。鍵が在れば何もしない。 */
  d.addEventListener('pvc:logout', function () {
    var S = w.PVSession;
    if (typeof uid === 'string' && S && typeof S.hasToken === 'function' && !S.hasToken()) setUid(null);
  });
  /* 読む人が替わった（同じタブで外からログインが書き替わった・ほかのタブで別の会員が入った）。ログインの部品からは何も届かない
     替わり方があるので、「情報を追加」の面（pv-contrib.js）が気づいて流す 'pvc:reader'（detail.uid ＝ 今の人。ログインしていなければ null）
     でも受ける。今までの人と違えば setUid ＝ 鍵の要る欄を全部その場で空にして、今の人の形で取り直す
     （前の人の投稿・前の人にだけ開いていた答えを、画面に残さない）。同じ人なら何もしない。 */
  d.addEventListener('pvc:reader', function (e) {
    var v = e && e.detail ? e.detail.uid : undefined;
    if (typeof v === 'string' || v === null) setUid(v);
  });
  /* 「情報を追加」で保存できたら、その会社の集計と補足を取り直す（古い答えを持ち越さない）。 */
  d.addEventListener('pvc:saved', function (e) {
    drop('wkv:'); drop('note:'); drop('fact:'); drop('give');
    reset(['work', 'cmp-work', 'notes', 'fact', 'cmp-facts']);
    /* 街の欄は、街を保存した時と、ログイン前の預かりを引き継いだ時に取り直す。
       鍵の1行を出している欄は、どの保存のあとでも取り直す（質問に答えて門が開いたのに、鍵の1行と答えるカードを残さない）。
       開いている欄は、月や質問の保存では触らない（見出しがちらつかない） */
    var topic = e && e.detail ? e.detail.topic : '';
    var shut = Array.prototype.some.call(slots(), function (b) {
      return b.getAttribute('data-live') === 'towns' && b.getAttribute('data-state') === 'locked';
    });
    if (topic === 'town' || topic === 'claim' || shut) { drop('town:'); reset(['towns']); }
    later();
  });
  /* 通貨を切り替えたら、額の字だけ描き直す（通信しない）。 */
  w.addEventListener('pv-currency-change', function () {
    var all = slots();
    for (var i = 0; i < all.length; i++) {
      var box = all[i];
      if (box.getAttribute('data-live') === 'realpay' && box.getAttribute('data-state') === 'open') {
        run(box, 'realpay', box.getAttribute('data-for') || '', true);
      }
    }
  });

  sync();
})(window, document);
