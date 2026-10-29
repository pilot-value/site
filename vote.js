/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — vote.js（2026-10-29）
   Vote（community.html / en/community.html）の本文。日英で1本（言語は <html lang>）。

   画面の順（オーナーの見本どおり。読む順を作り替えない）
     見出し「Vote」→ 検索 → 最新の口コミ（横に送るカード）→ よく見られている会社
     口コミのカード → 同じ投稿の7項目を引き出し（<dialog>）で読む
     会社のカード → 既存の会社ページ（#reviews / #work）へ直接（2026-10-29 オーナー判断）

   データ（新しいサーバーの関数は作っていない）
     口コミ … PVReviewI18n.fetchRows → pv_reviews()。鍵の無い人に本文は届かない（届いた字だけを出す）。
              ⚠️ reviews_v2 を直接読まない（assert-unlock.mjs が見ている）。
     評価   … 会社ごとに pv_reviews() を引き、career-live.js の realRated() と**同じ本体**で数える
              （会社ページと同じ数になる。写しは assert-vote.mjs が1文字の違いも落とす）。
     月の勤務 … 会社ごとに pv_work_view()。返事の状態（login / locked / give / open）のまま描く。
              値の無い項目は「未取得」で、0 や推定で埋めない。目盛は 0〜240 時間・0〜31 泊で固定。
     人気の並び … vote-popular.json（GA4 の閲覧数から gen-vote-popular.mjs が書く）。
              ⚠️ 評価順・件数順で代用しない。読めなければ「読み出せませんでした」。
     見本の口コミ14件・この端末の投稿 … HTML の SEED_REVIEWS（オーナー判断で残す）。
              会社カードの評価・件数には入れない（会社ページと同じ数にするため）。
   ════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';

  var EN = /^en/i.test(d.documentElement.getAttribute('lang') || '');
  var cs = d.currentScript;
  /* サイトの根（JSON とロゴの置き場）。英語ページは en/ の下にいる。 */
  var ROOT = (cs && cs.src) ? cs.src.replace(/[?#].*$/, '').replace(/[^\/]*$/, '') : (EN ? '../' : '');
  var SB_URL = 'https://vzgmnkrggrwtsrpqndsm.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6Z21ua3JnZ3J3dHNycHFuZHNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzkwOTcsImV4cCI6MjA5MDAxNTA5N30.wE4cJbqeYGCgn5ZvHd80hYWgQuySKvOMJMbsJWOvmtw';

  /* ── 文言（日英） ───────────────────────────────────────────── */
  var TX = {
    ja: {
      latest: '最新の口コミ', seeAll: 'すべての口コミを見る', prev: '前の口コミ', next: '次の口コミ',
      read: 'この投稿を読む',
      tenure: function (t) { return '勤務年数 ' + t; },
      ten: { '1-5': '1〜5年', '5-10': '5〜10年', '10-15': '10〜15年', '15-20': '15〜20年', '20+': '20年以上' },
      pos: { captain: '機長', fo: '副操縦士', cadet: '訓練生', former: '元乗務員' },
      cat: { culture: '企業文化', salary: '給与', benefits: '福利厚生', wlb: 'ワークライフバランス', ops: '運航環境', training: '訓練環境', mgmt: '経営陣への提案' },
      radar: [['企業文化'], ['給与'], ['福利厚生'], ['ワークライフバランス'], ['運航環境'], ['訓練環境']],
      radarTitle: 'パイロットによる6項目の評価', radarNone: '評価データがありません', radarAxis: 'すべての軸は0から5です。',
      lockedBody: '本文は、口コミを1件出した方だけが読めます。',
      unlockBtn: '匿名で口コミを投稿して解放する',
      gateTitle: '全ての口コミを見るには',
      gateText: '口コミを1件投稿すると<br>全社の口コミを<strong>無料で</strong>読めます',
      gateNote: '完全無料・匿名・個人情報不要', gateLogin: 'ログイン（投稿済みの方）',
      noComment: 'この項目へのコメントはありません。',
      loading: '読み込み中…', retry: 'やり直す',
      feedFail: '口コミを読み出せませんでした。', noReviews: 'まだ口コミがありません。',
      noFound: '口コミが見つかりませんでした', noFoundSub: '別のことばで探すか、検索をクリアしてください。', clear: '検索をクリア',
      popular: 'よく見られている会社', popularSub: '会社ごとの評価と、月の勤務から探す',
      matching: '検索に合う会社', matchingSub: '会社名と口コミの字から探した結果',
      popFail: 'よく見られている会社を読み出せませんでした。', noCo: '会社が見つかりませんでした',
      overall: '総合評価', reviewsN: function (n) { return '口コミ ' + n + '件'; },
      starLabel: function (v) { return '5点中' + v; },
      coFail: 'いま読み出せません', off: '準備中',
      workHead: '月の勤務', recent: '直近12か月', roles: { fo: '副操縦士', cap: '機長' },
      work: [
        { k: 'block_hours', label: 'Flight Time', title: '乗務時間（ブロックタイム）', unit: '時間／月', u: '時間', axis: '時間', max: 240 },
        { k: 'duty_hours', label: '勤務時間', title: '勤務・拘束時間', unit: '時間／月', u: '時間', axis: '時間', max: 240 },
        { k: 'stay_nights', label: 'ステイ日数', title: '基地の外で泊まった泊数', unit: '泊／月', u: '泊', axis: '泊', max: 31 }
      ],
      none: '未取得',
      barLabel: function (f, v, over) { return f.title + '、回答のまんなか半分の幅は' + v + f.unit + '。目盛は0から' + f.max + f.axis + (over ? '、一部は目盛の外です' : '') + '。'; },
      loginPayLock: 'ログインと給与の提出で開きます', payLock: '給与の提出で開きます',
      giveLock: function (n) { return '自分の会社に' + n + 'つ答えると開きます'; },
      login: 'ログイン', payGive: '匿名で給与を提出する', giveGo: '匿名で答える',
      coReviews: '会社の口コミを見る',
      drawerHead: '匿名のパイロット投稿', close: '閉じる',
      reviewOf: function (n) { return n + 'の口コミ'; },
      avgNote: '総合評価は6項目の平均です。<br>経営陣への提案は含みません。',
      openCo: '会社ページを開く',
      count: function (n) { return '新着順 · ' + n + '件'; },
      noMatch: '条件に合う口コミがありません', noMatchSub: '絞り込みを変えるか、検索をクリアしてください。',
      allCo: 'すべての航空会社', allCat: 'すべての項目', allRole: 'すべての職位',
      more: 'さらに表示',
      live: function (n) { return n + '件の口コミが見つかりました'; },
      chars: function (n) { return '全 ' + Number(n).toLocaleString('ja-JP') + ' 文字'; },
      info: [
        '会社カードの評価は、その会社に投稿された口コミの6項目（企業文化・給与・福利厚生・ワークライフバランス・運航環境・訓練環境）の平均です。経営陣への提案は含みません。',
        '月の勤務の棒は、直近12か月の回答を1人ずつ月の平均にしてから、人どうしのまんなか半分（25〜75%）の幅を示します。機長と副操縦士は分けて数え、各項目に3人以上の回答が集まったときだけ出します。',
        'Flight Time（乗務時間・ブロックタイム）と勤務時間（勤務・拘束時間）は時間／月で、目盛は0〜240時間。ステイ日数は基地の外で泊まった泊数／月で、目盛は0〜31泊です。時間と泊数は別の目盛です。',
        function (p) { return 'よく見られている会社は、会社ページの閲覧数（直近' + p.days + '日）の多い順です。'; }
      ]
    },
    en: {
      latest: 'Latest reviews', seeAll: 'See all reviews', prev: 'Previous review', next: 'Next review',
      read: 'Read this review',
      tenure: function (t) { return t + ' of service'; },
      ten: { '1-5': '1–5 years', '5-10': '5–10 years', '10-15': '10–15 years', '15-20': '15–20 years', '20+': '20+ years' },
      pos: { captain: 'Captain', fo: 'First Officer', cadet: 'Trainee', former: 'Former crew' },
      cat: { culture: 'Culture', salary: 'Pay', benefits: 'Benefits', wlb: 'Work-life balance', ops: 'Flight operations', training: 'Training', mgmt: 'Suggestions for management' },
      radar: [['Culture'], ['Pay'], ['Benefits'], ['Work-life balance'], ['Operations'], ['Training']],
      radarTitle: 'Pilot ratings on six areas', radarNone: 'No rating data yet', radarAxis: 'Every axis runs from 0 to 5.',
      lockedBody: 'Only pilots who have shared one review can read the full text.',
      unlockBtn: 'Post a review anonymously to unlock',
      gateTitle: 'To see every review',
      gateText: 'Post one review of your own<br>and you can read every airline&rsquo;s reviews <strong>for free</strong>',
      gateNote: 'Completely free · anonymous · no personal details needed', gateLogin: 'Log in (already posted)',
      noComment: 'No comment on this item.',
      loading: 'Loading…', retry: 'Try again',
      feedFail: 'We could not load the reviews.', noReviews: 'No reviews yet.',
      noFound: 'No reviews found', noFoundSub: 'Try other words, or clear the search.', clear: 'Clear search',
      popular: 'Most viewed airlines', popularSub: 'Ratings and monthly duty, airline by airline',
      matching: 'Matching airlines', matchingSub: 'Found by airline name and review text',
      popFail: 'We could not load the most viewed airlines.', noCo: 'No airlines found',
      overall: 'Overall', reviewsN: function (n) { return n + (n === 1 ? ' review' : ' reviews'); },
      starLabel: function (v) { return v + ' out of 5'; },
      coFail: 'We cannot load this right now', off: 'Not available yet',
      workHead: 'Monthly duty', recent: 'Last 12 months', roles: { fo: 'First Officer', cap: 'Captain' },
      work: [
        { k: 'block_hours', label: 'Flight time', title: 'Block hours (flight time)', unit: 'h / month', u: 'h', axis: ' h', max: 240 },
        { k: 'duty_hours', label: 'Duty time', title: 'Duty hours', unit: 'h / month', u: 'h', axis: ' h', max: 240 },
        { k: 'stay_nights', label: 'Layover nights', title: 'Nights away from base', unit: 'nights / month', u: 'nights', axis: ' nights', max: 31 }
      ],
      none: 'Not enough data',
      barLabel: function (f, v, over) { return f.title + ': the middle half of answers is ' + v + ' ' + f.unit + '. Scale 0 to ' + f.max + f.axis + (over ? '; part of it is off the scale' : '') + '.'; },
      loginPayLock: 'Opens when you log in and submit your pay', payLock: 'Opens when you submit your pay',
      giveLock: function (n) { return 'Opens when you answer ' + n + (n === 1 ? ' item' : ' items') + ' about your own airline'; },
      login: 'Log in', payGive: 'Add your pay anonymously', giveGo: 'Answer anonymously',
      coReviews: 'See this airline’s reviews',
      drawerHead: 'Anonymous pilot review', close: 'Close',
      reviewOf: function (n) { return n + ' review'; },
      avgNote: 'The overall rating is the average of six areas.<br>Suggestions for management are not included.',
      openCo: 'Open the airline page',
      count: function (n) { return 'Newest first · ' + n; },
      noMatch: 'No reviews match these filters', noMatchSub: 'Change the filters or clear the search.',
      allCo: 'All airlines', allCat: 'All items', allRole: 'All positions',
      more: 'Show more',
      live: function (n) { return n + (n === 1 ? ' review found' : ' reviews found'); },
      chars: function (n) { return Number(n).toLocaleString('en-US') + ' characters in total'; },
      info: [
        'An airline’s rating is the average of the six rated areas in its reviews (culture, pay, benefits, work-life balance, flight operations and training). Suggestions for management are not included.',
        'Each duty bar takes every respondent’s monthly average over the last 12 months, then shows the middle half (25th–75th percentile) across people. Captains and First Officers are counted separately, and a figure appears only once at least three people have answered it.',
        'Flight time (block hours) and duty time are hours per month on a 0–240 h scale. Layover nights are nights away from base per month on a 0–31 scale. Hours and nights use separate scales.',
        function (p) { return 'Most viewed airlines are ordered by views of each airline page over the last ' + p.days + ' days.'; }
      ]
    }
  };
  var T = TX[EN ? 'en' : 'ja'];
  var KEYS = ['culture', 'salary', 'benefits', 'wlb', 'ops', 'training', 'mgmt'];

  /* ── 会社ページと同じ数え方（career-live.js の写し。assert-vote.mjs が照合する） ── */
  var LEGACY = {
    'cathay-pacific': 'cathay', 'qatar-airways': 'qatar', 'singapore-airlines': 'singapore',
    'spring-japan': 'spring', 'alaska-airlines': 'alaska', 'british-airways': 'british',
    'turkish-airlines': 'turkish'
  };
  var SCORES = ['culture_score', 'salary_score', 'benefits_score', 'wlb_score', 'ops_score', 'training_score'];
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
  var FROM_LEGACY = {};
  Object.keys(LEGACY).forEach(function (k) { FROM_LEGACY[LEGACY[k]] = k; });

  /* ── 小道具 ─────────────────────────────────────────────── */
  function $(id) { return d.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function norm(s) { return String(s == null ? '' : s).normalize('NFKC').toLowerCase().trim(); }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
  function okSlug(s) { return typeof s === 'string' && /^[a-z0-9-]{2,60}$/.test(s); }
  function show1(v) { return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10); }
  var ICO = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
    back: '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
  };
  function ico(n) { return '<svg class="vt-ico" viewBox="0 0 24 24" aria-hidden="true">' + ICO[n] + '</svg>'; }
  function stars(v) {
    var p = Math.max(0, Math.min(100, v / 5 * 100));
    return '<span class="vt-stars" role="img" aria-label="' + esc(T.starLabel(v.toFixed(1))) + '">' +
      '<span class="vt-stars-base" aria-hidden="true">★★★★★</span>' +
      '<span class="vt-stars-fill" style="width:' + p.toFixed(1) + '%" aria-hidden="true">★★★★★</span></span>';
  }
  function isUnlocked() {
    try { var e = localStorage.getItem('pv_unlock_expiry'); return !!e && Date.now() < parseInt(e, 10); } catch (x) { return false; }
  }
  function rescanMoney(el) {
    /* 本文の「¥3,500万」も通貨切替で換算する（currency.js の observer は innerHTML の差し替えを取りこぼす） */
    if (w.PVCurrency && el) { try { w.PVCurrency.scan(el); w.PVCurrency.apply(); } catch (e) {} }
  }
  /* 本文の切れ目が金額トークンの内側に落ちないよう後ろへずらす（community.html から移した。理由は同じ）。 */
  var MONEY_CH = /[0-9０-９,，.．¥￥万億円MK–〜~-]/;
  function safeCut(text, at) {
    var i = at, guard = 0;
    while (i < text.length && guard++ < 60 && MONEY_CH.test(text[i - 1]) && MONEY_CH.test(text[i])) i++;
    return i;
  }

  /* ── 会社の名前・ロゴ・行き先 ───────────────────────────────── */
  var DIR = {};
  function slugOf(code) { var c = String(code || '').toLowerCase(); return FROM_LEGACY[c] || c; }
  function hasPage(slug) { return okSlug(slug) && !!DIR[slug] && DIR[slug].kind === 'airline'; }
  function nameOf(slug, code) {
    var a = DIR[slug];
    if (!a) { var raw = String(code || slug || ''); return { main: raw ? raw.toUpperCase() : '—', sub: '' }; }
    var m;
    if (!EN) {
      m = /^(.*)（(.+)）$/.exec(a.ja || '');
      if (m) return { main: m[2], sub: m[1] };
      return { main: a.en || a.ja, sub: (a.ja && a.ja !== a.en) ? a.ja : '' };
    }
    m = /^(.*) \((.+)\)$/.exec(a.en || '');
    if (m) return { main: m[2], sub: m[1] };
    return { main: a.en || a.ja, sub: '' };
  }
  function mono(s) {
    var t = String(s || '').replace(/[^A-Za-z0-9 ]/g, ' ').trim();
    if (!t) return '✈';
    var p = t.split(/\s+/);
    return (p.length >= 2 ? p[0][0] + p[1][0] : t.slice(0, 2)).toUpperCase();
  }
  /* ロゴは背景の絵で描く（<img> を置かない ── 口コミ欄の <img> の数を assert-unlock.mjs が数えている） */
  function logo(slug, nm) {
    var ext = okSlug(slug) && w.PV_LOGOS && w.PV_LOGOS[slug];
    var inner = (ext === 'svg' || ext === 'png')
      ? '<span class="vt-logo-img" style="background-image:url(\'' + ROOT + 'assets/airline-logos/' + slug + '.' + ext + '\')"></span>'
      : '<span class="vt-mono">' + esc(mono(nm)) + '</span>';
    return '<span class="vt-logo" aria-hidden="true">' + inner + '</span>';
  }
  function coHref(slug, tab) { return 'airlines/' + slug + '.html#' + tab; }
  function loginHref() { return 'login.html?return=' + encodeURIComponent(location.pathname + location.search); }

  /* ── 口コミを1つの形にそろえる ──────────────────────────────── */
  var items = [];
  var feed = { s: 'loading' };
  function ym(s) { var m = /^(\d{4})[-.](\d{2})/.exec(String(s || '')); return m ? { t: m[1] + '.' + m[2], iso: m[1] + '-' + m[2] } : { t: '—', iso: '' }; }
  function tenText(t) { return T.ten[t] || String(t || '—'); }
  function posText(p) { return T.pos[p] || String(p || ''); }
  function fromServer(r, i) {
    var slug = slugOf(r.airline);
    var t = Date.parse(r.created_at || '');
    var key = (r.id != null && String(r.id) !== '')
      ? 'r' + String(r.id).replace(/[^A-Za-z0-9_-]/g, '')
      : (isFinite(t) ? 'c' + t.toString(36) + '-' + slug.replace(/[^a-z0-9-]/g, '') : 'i' + i);
    var b = w.PVReviewI18n.pick(r);
    return { key: key, kind: 'server', slug: slug, code: r.airline || '', pos: r.position || '', ten: tenText(r.tenure_bucket),
             date: ym(r.created_at), row: r, body: b };
  }
  function fromSeed(r) {
    return { key: 's' + String(r.id).replace(/[^A-Za-z0-9_-]/g, ''), kind: 'seed', slug: slugOf(r.airline), code: r.airline || '',
             pos: r.position || '', ten: r.exp || '—', date: ym(r.date), text: String(r.comment || ''), rating: num(Number(r.rating)) };
  }
  function fromLocal(r) {
    var text = [r.payText, r.evalText, r.benefitText, r.scheduleText, r.opsText].filter(Boolean).join('　') || r.comment || '';
    var dt = new Date(Number(r.ts));
    var iso = isFinite(dt) ? dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') : '';
    var rt = r.avgRating ? Math.round(r.avgRating) : (r.rating || null);
    return { key: 'u' + String(r.ts).replace(/[^0-9]/g, ''), kind: 'local', slug: slugOf(r.airline), code: r.airline || '',
             pos: r.position || '', ten: r.years || r.experience || '—', date: ym(iso), text: String(text), rating: num(Number(rt)) };
  }
  function localItems() {
    var out = [];
    try { (JSON.parse(localStorage.getItem('pv_reviews') || '[]') || []).forEach(function (r) { if (r) out.push(fromLocal(r)); }); } catch (e) {}
    return out;
  }
  function seedItems() { return (w.PV_VOTE_SEED || []).map(fromSeed); }
  function rebuild(serverRows) {
    var srv = (serverRows || []).map(fromServer);
    items = localItems().concat(srv, seedItems());   // 並びは今までと同じ：この端末 → サーバー → 見本
  }
  /* 流れるカード（pv_vote_latest・新しい12件・1欄80字・文字数 n）。2026-10-29 オーナー決定。
     届くのは各欄の先頭80字だけ ── 80字より先の本文は端末に1文字も来ない。 */
  var latest = { s: 'loading', items: [] };
  function fromLatest(r, i) {
    var slug = slugOf(r.airline);
    var t = Date.parse(r.created_at || '');
    return { key: 'v' + (isFinite(t) ? t.toString(36) : String(i)) + '-' + slug.replace(/[^a-z0-9-]/g, ''), kind: 'latest',
             slug: slug, code: r.airline || '', pos: r.position || '', ten: tenText(r.tenure_bucket),
             date: ym(r.created_at), row: r, body: w.PVReviewI18n.pick(r), n: num(r.n) };
  }
  function byKey(k) {
    var all = items.concat(latest.items);
    for (var i = 0; i < all.length; i++) if (all[i].key === k) return all[i];
    return null;
  }

  /* 1件の総合評価（6項目のうち点のある分の平均。経営陣への提案は入れない） */
  function rowAvg(r) {
    var s = 0, c = 0;
    SCORES.forEach(function (k) { var v = Number(r && r[k]); if (isFinite(v) && v > 0) { s += Math.min(5, v); c++; } });
    return c ? s / c : null;
  }
  function firstCat(b, want) {
    var list = b.cats || [];
    if (want) { for (var i = 0; i < list.length; i++) if (list[i].k === want) return list[i]; return null; }
    for (var j = 0; j < KEYS.length; j++) for (var m = 0; m < list.length; m++) if (list[m].k === KEYS[j]) return list[m];
    return null;
  }
  function origOf(b, k) { var o = b.origCats || []; for (var i = 0; i < o.length; i++) if (o[i].k === k) return o[i].text; return ''; }
  /* 本文の文字数（7欄の合計）。サーバーの n が正。無い古い返事・見本は手元の字から数える。 */
  function lenOf(it) {
    if (it.n != null) return it.n;
    if (it.row && num(it.row.n) != null) return it.row.n;
    if (it.kind === 'seed' || it.kind === 'local') return it.text.length;
    if (it.kind === 'server' && !it.body.locked) {
      return KEYS.reduce(function (s, k) { return s + String((it.row && it.row[k + '_comment']) || '').trim().length; }, 0);
    }
    return null;
  }
  /* ぼかしの影絵。**字を持たない灰色の行**を blur したもの（本物の字は届いていないので、外しても読めない）。
     行数は残りの字数で1〜3行。 */
  function ghost(rest) {
    if (!(rest > 0)) return '';
    var lines = Math.min(3, Math.ceil(rest / 50)), h = '';
    for (var i = 0; i < lines; i++) h += '<i style="width:' + (i === lines - 1 ? 46 + (rest % 40) : 100) + '%"></i>';
    return '<span class="vt-ghost" aria-hidden="true">' + h + '</span>';
  }

  /* カードに出す1つの欄。本文は書かれたまま（要約・題名・言い換えを足さない）。
     返す shown ＝ 画面に出した字数（ぼかしの行数を決めるため）。 */
  function excerpt(it, want) {
    if (it.kind === 'seed' || it.kind === 'local') {
      var t = it.text;
      if (!isUnlocked()) {
        var v = safeCut(t, Math.max(30, Math.ceil(t.length / 8)));
        if (t.length > v) return { tag: '', html: esc(t.slice(0, v)) + '<span class="vt-blur" aria-hidden="true">' + esc(t.slice(v)) + '</span>', shown: t.length };
      }
      return { tag: '', html: esc(t), shown: t.length };
    }
    var b = it.body;
    if (it.kind === 'server' && b.locked) {
      var cats = (it.row && it.row.cats) || [];
      var k = want || b.clipKey || cats[0] || '';
      var clip = (b.clipText && b.clipKey === k) ? b.clipText : '';
      return { tag: k ? (T.cat[k] || '') : '', html: clip ? esc(clip) : null, shown: clip.replace(/…$/, '').length, locked: true };
    }
    var c = firstCat(b, want);
    if (!c) return { tag: '', html: '', shown: 0 };
    var tr = b.translated && origOf(b, c.k) && origOf(b, c.k) !== c.text;
    var cut = it.kind === 'latest' && /…$/.test(c.text);   // 80字で切ってある欄
    return { tag: T.cat[c.k] || '', html: esc(c.text), tr: tr, shown: c.text.replace(/…$/, '').length, locked: it.kind === 'latest', cut: cut };
  }
  /* 流れるカードの本文：投稿の頭から項目の順（KEYS）に、合わせて80字まで続けて出す。
     2026-10-29 オーナー指摘「80文字までなのに10文字くらいで終わっているカードがある」── 最初の1項目しか出していなかった。
     2つ目からの項目は、文の前に項目名を小さく置く。鍵の無い人に届くのは、サーバーが同じ決まりで切った80字だけ
     （pv_review_fill。ここで切るのは鍵のある人の全文と、古いサーバーの「1欄80字」の返事のとき）。
     返す more ＝ 80字より先に本文が残っている（鍵の無い人には影絵・鍵のある人には「…」）。 */
  var STRIP_CHARS = 80;
  function stripBody(it) {
    var b = it.body, list = b.cats || [], written = (it.row && it.row.cats) || [];
    var room = STRIP_CHARS, html = '', shown = 0, tag = '', tr = false, cut = false, last = -1, i;
    function catOf(k) { for (var m = 0; m < list.length; m++) if (list[m].k === k && list[m].text) return list[m]; return null; }
    for (i = 0; i < KEYS.length; i++) {
      var c = catOf(KEYS[i]);
      if (!c) continue;
      if (room < 8 || cut) break;
      last = i;
      var t = c.text, srv = /…$/.test(t);
      if (srv) t = t.replace(/…$/, '');
      var take = t;
      if (t.length > room - (srv ? 1 : 0)) { take = t.slice(0, safeCut(t, room - 1)); cut = true; }
      else if (srv) cut = true;
      var o = origOf(b, c.k);
      if (b.translated && o && o !== c.text) tr = true;
      if (!html) tag = T.cat[c.k] || '';
      else html += ' <b class="vt-mini-k">' + esc(T.cat[c.k] || '') + '</b>';
      html += esc(take);
      shown += take.length; room -= take.length;
    }
    var more = cut;   // 見せた欄より後ろに、届いた欄か「書かれた」欄（80字に入らず本文の来ていない欄）があれば続きがある
    for (var j = last + 1; !more && j < KEYS.length; j++) if (catOf(KEYS[j]) || written.indexOf(KEYS[j]) >= 0) more = true;
    if (more) html += '…';
    return { tag: tag, html: html, tr: tr, shown: shown, locked: it.kind === 'latest', more: more, strip: true };
  }
  function searchText(it) {
    var n = nameOf(it.slug, it.code);
    var parts = [it.slug, n.main, n.sub, posText(it.pos)];
    if (it.kind === 'seed' || it.kind === 'local') {
      var t = it.text;
      parts.push(isUnlocked() ? t : t.slice(0, safeCut(t, Math.max(30, Math.ceil(t.length / 8)))));
    } else if (it.kind === 'server' && it.body.locked) parts.push(it.body.clipText || '');
    else (it.body.cats || []).forEach(function (c) { parts.push(c.text); });
    return norm(parts.join(' '));
  }
  function matches(it, f) {
    if (f.co && it.slug !== f.co) return false;
    if (f.role && it.pos !== f.role) return false;
    if (f.cat) {
      if (it.kind === 'seed' || it.kind === 'local') return false;   // 見本・端末の投稿は項目に分かれていない
      if (it.kind === 'server' && it.body.locked) { if (((it.row && it.row.cats) || []).indexOf(f.cat) < 0) return false; }
      else if (!firstCat(it.body, f.cat)) return false;
    }
    if (f.q && searchText(it).indexOf(f.q) < 0) return false;
    return true;
  }

  function card(it, want, list) {
    var n = nameOf(it.slug, it.code);
    var ex = excerpt(it, want);
    var meta = esc(posText(it.pos)) + ' · ' + esc(T.tenure(it.ten));
    var avg = (it.kind === 'seed' || it.kind === 'local') ? (it.rating ? Math.min(5, it.rating) : null) : rowAvg(it.row);
    var total = lenOf(it);
    /* 星と項目名は1行にまとめる（カードを低くする・2026-10-29 iPhone で大きすぎ）。 */
    var tags = '';
    if (avg || ex.tag || ex.tr) {
      tags = '<span class="vt-rc-tags">' + (avg ? '<span class="vt-rc-stars">' + stars(avg) + '<b>' + avg.toFixed(1) + '</b></span>' : '') +
        (ex.tag ? '<span class="vt-tag">' + esc(ex.tag) + '</span>' : '') +
        (ex.tr ? w.PVReviewI18n.noteHTML(it.body.from) : '') + '</span>';
    }
    var body = (ex.html === null)
      ? '<p class="vt-rc-ex is-locked">🔒 ' + esc(T.lockedBody) + '</p>'
      : (ex.html ? '<p class="vt-rc-ex' + (ex.locked ? ' is-cut' : '') + '">' + ex.html + '</p>' : '');
    /* 鍵の無い人：見せた字より先が残っていれば、字を持たない影絵を置く */
    if (ex.locked && total != null) body += ghost(total - (ex.shown || 0));
    return '<a class="vt-rc' + (list ? ' is-list' : '') + '" href="#review/' + it.key + '" data-review="' + it.key + '">' +
      '<span class="vt-rc-top">' + logo(it.slug, n.main) +
        '<span class="vt-rc-brand"><span class="vt-rc-name">' + esc(n.main) + '</span><span class="vt-rc-meta">' + meta + '</span></span>' +
        '<time class="vt-rc-date"' + (it.date.iso ? ' datetime="' + it.date.iso + '"' : '') + '>' + esc(it.date.t) + '</time></span>' +
      tags + body +
      '<span class="vt-rc-foot"><span class="vt-rc-read">' + esc(T.read) + ico('arrow') + '</span>' +
        (total ? '<span class="vt-rc-len">' + esc(T.chars(total)) + '</span>' : '') + '</span></a>';
  }

  /* 流れる帯のカード（トップの口コミの帯と同じ大きさ：幅 304px・狭い画面 268px）。
     2026-10-29 オーナー「landing page と同じくらいにしろ」。
     中身の順：項目名・星 → 本文（鍵の無い人は先頭80字＋影絵1行）→ 会社・職位・勤務年数・年月・全 N 文字。 */
  function mini(it) {
    var n = nameOf(it.slug, it.code);
    var full = it.kind === 'latest' || (it.kind === 'server' && !it.body.locked);
    var ex = full ? stripBody(it) : excerpt(it, '');
    var avg = (it.kind === 'seed' || it.kind === 'local') ? (it.rating ? Math.min(5, it.rating) : null) : rowAvg(it.row);
    var total = lenOf(it);
    var head = '<span class="vt-rc-tags">' + (ex.tag ? '<span class="vt-tag">' + esc(ex.tag) + '</span>' : '') +
      (ex.tr ? w.PVReviewI18n.noteHTML(it.body.from) : '') +
      (avg ? '<span class="vt-rc-stars">' + stars(avg) + '<b>' + avg.toFixed(1) + '</b></span>' : '') + '</span>';
    var body = (ex.html === null)
      ? '<span class="vt-rc-ex is-locked">🔒 ' + esc(T.lockedBody) + '</span>'
      : '<span class="vt-rc-ex' + (ex.locked || ex.strip ? ' is-cut' : '') + '">' + ex.html + '</span>';
    if (ex.strip) { if (ex.locked && ex.more) body += ghost(Math.max(20, (total || 0) - ex.shown)); }
    else if (ex.locked && total != null) body += ghost(total - (ex.shown || 0));
    var who = [n.main, posText(it.pos), T.tenure(it.ten), it.date.t].join(' · ');
    return '<a class="vt-rc vt-mini" href="#review/' + it.key + '" data-review="' + it.key + '">' + head + body +
      '<span class="vt-mini-meta"><span class="vt-mini-who">' + esc(who) + '</span>' +
      (total ? '<span class="vt-rc-len">' + esc(T.chars(total)) + '</span>' : '') + '</span></a>';
  }

  /* ── 状態 ───────────────────────────────────────────────── */
  var state = { q: '', raw: '', role: 'fo', f: { co: '', cat: '', role: '' }, limit: 60 };
  var view = null;
  var sb = null;

  /* ── B. 最新の口コミ（流れる帯。トップの .hero-mq と同じ作り）───────────── */
  var FEED_N = 9, STRIP_N = 12;
  /* 帯に出す口コミ。鍵のある人は全文（pv_reviews）から・鍵の無い人は pv_vote_latest（80字）から。
     pv_vote_latest がまだ無い（SQL を貼る前）・読めないときは、今までの並び（9件・先頭の1欄の80字）に戻る。 */
  function stripItems() {
    var open = items.filter(function (it) { return it.kind === 'server' && !it.body.locked; });
    if (open.length) {   // 足切りはサーバー（pv_vote_latest）と同じ：本文が合わせて20字以上（空白を除く）
      return open.filter(function (it) {
        return (it.body.cats || []).map(function (c) { return c.text; }).join('').replace(/\s/g, '').length >= 20;
      }).slice(0, STRIP_N);
    }
    if (latest.s === 'ok' && latest.items.length) return latest.items;
    return items.slice(0, FEED_N);
  }
  function calm() { return !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function renderFeed() {
    var box = $('review-feed'), st = $('vt-feed-status'), mq = $('vt-mq');
    if (!box) return;
    if (feed.s === 'loading' || latest.s === 'loading') {
      box.innerHTML = '<div class="vt-skel"></div><div class="vt-skel"></div><div class="vt-skel"></div>';
      box.setAttribute('aria-busy', 'true');
      flow(false);
      if (st) st.innerHTML = '';
      return;
    }
    box.removeAttribute('aria-busy');
    var list = state.q ? items.concat(latest.items).filter(function (it) { return matches(it, { q: state.q }); }) : stripItems();
    if (state.q) {                                   // 同じ口コミが2つの形で入っているので、検索の答えは1つにまとめる
      var seen = {};
      list = list.filter(function (it) { var k = it.slug + '|' + it.date.t + '|' + it.pos + '|' + it.ten; if (seen[k]) return false; seen[k] = 1; return true; });
    }
    var shown = list.slice(0, STRIP_N);
    if (!shown.length) {
      box.innerHTML = state.q
        ? '<div class="vt-empty"><strong>' + esc(T.noFound) + '</strong>' + esc(T.noFoundSub) +
          '<br><button type="button" class="vt-btn-line" data-clear>' + esc(T.clear) + '</button></div>'
        : '<div class="vt-empty"><strong>' + esc(T.noReviews) + '</strong></div>';
    } else {
      box.innerHTML = shown.map(mini).join('');
    }
    if (st) st.innerHTML = feed.s === 'error'
      ? esc(T.feedFail) + ' <button type="button" class="vt-retry" data-retry="feed">' + esc(T.retry) + '</button>' : '';
    rescanMoney(box);
    if (mq) mq.classList.toggle('is-static', !!state.q || shown.length < 2);
    flow(!state.q && shown.length >= 2);
    if (state.q) say(T.live(list.length));
  }
  /* 流す。トラック ＝ [本物の1組][写し…]。写しは読み上げにもタブ移動にも入れない（aria-hidden・tabindex=-1）。
     前半と後半を同じ幅にして translate3d(-50%) で継ぎ目なく回す（速さは 20px/秒・トップと同じ）。
     ⚠️ 写しは #review-feed の外（兄弟）に置く ── #review-feed の中身は本物の1組だけ（assert-unlock が数えている）。 */
  function flow(on) {
    var track = $('vt-mq-track'), box = $('review-feed'), mq = $('vt-mq');
    if (!track || !box) return;
    Array.prototype.slice.call(track.querySelectorAll('.vt-mq-set[data-clone]')).forEach(function (n) { n.remove(); });
    track.style.animationDuration = '';
    track.classList.remove('is-on');
    if (!on || calm() || !mq) return;
    var one = box.getBoundingClientRect().width;
    if (!(one > 0)) return;
    var reps = Math.max(1, Math.ceil(mq.clientWidth / one));
    for (var i = 0; i < reps * 2 - 1; i++) {
      var c = box.cloneNode(true);
      c.removeAttribute('id');
      c.setAttribute('data-clone', '1');
      c.setAttribute('aria-hidden', 'true');
      Array.prototype.forEach.call(c.querySelectorAll('a,button'), function (a) { a.setAttribute('tabindex', '-1'); });
      track.appendChild(c);
    }
    track.style.animationDuration = Math.max(20, Math.round(one * reps / 20)) + 's';
    track.classList.add('is-on');
  }
  /* 鍵の壁（#gate-panel）と解放中の印（#unlock-badge）。id と出し方は assert-unlock.mjs が見ている。 */
  function syncGate() {
    var b = $('unlock-badge'); if (b) b.style.display = isUnlocked() ? '' : 'none';
    var slot = $('vt-gate-slot'); if (!slot) return;
    var g = $('gate-panel');
    if (isUnlocked()) { if (g) g.remove(); return; }
    if (g) return;
    slot.innerHTML = '<div id="gate-panel" class="vt-gate">' +
      '<div><p class="vt-gate-t">🔒 ' + esc(T.gateTitle) + '</p><p class="vt-gate-p">' + T.gateText + '</p>' +
      '<span class="vt-gate-note">' + esc(T.gateNote) + '</span></div>' +
      '<div class="vt-gate-act"><a class="vt-btn" href="submit-review.html">' + ico('pen') + esc(T.unlockBtn) + '</a>' +
      '<a class="vt-gate-login" href="' + esc(loginHref()) + '">' + esc(T.gateLogin) + '</a></div></div>';
  }

  /* ── C. よく見られている会社 ─────────────────────────────────── */
  var popular = { s: 'loading', slugs: [], days: 28 };
  var CO = {};
  var GIVE = null, GIVE_V;
  function rpc(name, p) {
    return new Promise(function (res) {
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; res({ error: { code: 'timeout' } }); } }, 15000);
      try {
        Promise.resolve(p === undefined ? sb.rpc(name) : sb.rpc(name, { p: p || {} })).then(function (r) { if (!done) { done = true; clearTimeout(t); res(r || { error: {} }); } },
          function (e) { if (!done) { done = true; clearTimeout(t); res({ error: e || {} }); } });
      } catch (e) { done = true; clearTimeout(t); res({ error: e || {} }); }
    });
  }
  function isOff(err) {
    var c = err && String(err.code || '');
    return c === 'PGRST202' || c === 'PGRST205' || c === '42883' || c === '42P01' || (err && err.status === 404);
  }
  function loadCompany(slug) {
    var c = CO[slug] || (CO[slug] = { rev: { s: 'loading' }, work: { s: 'loading' } });
    if (!c.revP) {
      var codes = [slug]; if (LEGACY[slug]) codes.push(LEGACY[slug]);
      c.revP = (sb && w.PVReviewI18n ? w.PVReviewI18n.fetchRows(sb, { airlines: codes, limit: 500 }) : Promise.resolve(null)).then(function (res) {
        c.rev = res ? { s: 'ok', n: res.rows.length, R: realRated(res.rows) } : { s: 'error' };   // 取れなかった ≠ 0件
        paintCo(slug);
      });
    }
    if (!c.workP) {
      c.workP = (sb ? rpc('pv_work_view', { airline: slug }) : Promise.resolve({ error: {} })).then(function (res) {
        var x = res && !res.error ? res.data : null;
        if (!x) c.work = { s: isOff(res && res.error) ? 'off' : 'error' };
        else if (x.ok === true && x.state === 'open' && x.by && typeof x.by === 'object') c.work = { s: 'open', by: x.by };
        else if (x.ok === true && (x.state === 'login' || x.state === 'locked' || x.state === 'give')) c.work = { s: x.state };
        else c.work = { s: 'error' };
        if (c.work.s === 'give') needGive();
        paintCo(slug);
      });
    }
  }
  function needGive() {
    if (GIVE) return;
    GIVE = rpc('pv_contrib_give', {}).then(function (res) {
      var x = res && !res.error ? res.data : null;
      GIVE_V = (x && x.state === 'give' && Number.isInteger(x.need) && x.need > 0 && okSlug(x.airline)) ? { need: x.need, airline: x.airline } : null;
      Object.keys(CO).forEach(paintCo);
    });
  }
  /* 6軸のレーダー（小さい会社カード用・2026-10-29 第2回）。字は図に対して大きめ（小さく出しても 11px 以上）。
     点の無い角は描かない（0 で埋めない）── 6つそろわなければ図の中に「評価データがありません」。 */
  function radarSVG(vals) {
    var cx = 160, cy = 118, R = 62;
    function pt(i, r) { var a = -Math.PI / 2 + i * Math.PI / 3; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }
    function ps(list) { return list.map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(' '); }
    var g = '';
    for (var l = 1; l <= 5; l++) g += '<polygon class="rd-grid" points="' + ps([0, 1, 2, 3, 4, 5].map(function (i) { return pt(i, R * l / 5); })) + '"/>';
    for (var i = 0; i < 6; i++) { var e = pt(i, R); g += '<line class="rd-grid" x1="' + cx + '" y1="' + cy + '" x2="' + e[0].toFixed(2) + '" y2="' + e[1].toFixed(2) + '"/>'; }
    var shape = vals
      ? '<polygon class="rd-shape" points="' + ps(vals.map(function (v, k) { return pt(k, R * Math.min(5, v) / 5); })) + '"/>' +
        vals.map(function (v, k) { var p = pt(k, R * Math.min(5, v) / 5); return '<circle class="rd-dot" cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r="3"/>'; }).join('')
      : '<text class="rd-none" x="' + cx + '" y="' + (cy + 5) + '" text-anchor="middle">' + esc(T.radarNone) + '</text>';
    var POS = [[160, 20, 'middle'], [228, 80, 'start'], [228, 150, 'start'], [160, 204, 'middle'], [92, 150, 'end'], [92, 80, 'end']];
    var labels = POS.map(function (p, k) {
      var lines = T.radar[k];
      var lab = '<text class="rd-label" x="' + p[0] + '" y="' + p[1] + '" text-anchor="' + p[2] + '">' + esc(lines.join('')) + '</text>';
      var val = vals ? vals[k].toFixed(1) : '—';
      return lab + '<text class="rd-val" x="' + p[0] + '" y="' + (p[1] + 18) + '" text-anchor="' + p[2] + '">' + val + '</text>';
    }).join('');
    var desc = T.radar.map(function (l, k) { return l.join('') + ' ' + (vals ? vals[k].toFixed(1) : '—'); }).join(EN ? ', ' : '、') + (EN ? '. ' : '。') + T.radarAxis;
    return '<svg class="vt-radar" viewBox="0 0 320 230" role="img" aria-label="' + esc(T.radarTitle + (EN ? ': ' : '：') + desc) + '" preserveAspectRatio="xMidYMid meet">' +
      '<g aria-hidden="true">' + g + shape + labels + '</g></svg>';
  }
  function sumHTML(slug) {
    var r = CO[slug] && CO[slug].rev;
    if (!r || r.s === 'loading') return '<span class="vt-co-msg">' + esc(T.loading) + '</span>';
    if (r.s === 'error') return '<span class="vt-co-msg">' + esc(T.coFail) + ' <button type="button" class="vt-retry" data-retry="rev:' + slug + '">' + esc(T.retry) + '</button></span>';
    var R = r.R;
    return '<span class="vt-rl">' + esc(T.overall) + '</span>' +
      (R ? '<span class="vt-rn">' + R.avg.toFixed(1) + '</span>' + stars(R.avg) : '<span class="vt-rn">—</span>') +
      '<span class="vt-rc-n">' + esc(T.reviewsN(r.n)) + '</span>';
  }
  function radarHTML(slug) {
    var r = CO[slug] && CO[slug].rev;
    if (!r || r.s !== 'ok') return radarSVG(null).replace(esc(T.radarNone), r && r.s === 'error' ? esc(T.coFail) : esc(T.loading));
    return radarSVG(r.R && r.R.ratings ? r.R.ratings : null);
  }
  /* 月の勤務は1行ずつ：名前・帯・幅（単位つき）。目盛は 時間 0〜240・泊 0〜31 で固定（注に1回だけ書く）。
     値の無い項目は「未取得」で、帯を描かない（0 で埋めない）。 */
  function rowsHTML(by) {
    return T.work.map(function (f) {
      var x = by && by[f.k];
      var lo = num(x && x.lo), hi = num(x && x.hi);
      var lab = '<span class="vt-wl" title="' + esc(f.title) + '">' + esc(f.label) + '</span>';
      if (lo === null || hi === null || lo < 0 || hi < lo) {
        return '<div class="vt-wr is-none" data-work="' + f.k + '">' + lab + '<span class="vt-wv">' + esc(T.none) + '</span></div>';
      }
      var a = Math.max(0, Math.min(lo / f.max * 100, 100)), b = Math.max(0, Math.min(hi / f.max * 100, 100));
      var v = lo === hi ? show1(lo) : show1(lo) + '–' + show1(hi);
      var over = hi > f.max;
      var seg = lo <= f.max
        ? '<span class="vt-fill" style="left:' + a.toFixed(3) + '%;width:' + (b - a).toFixed(3) + '%"></span>' +
          '<span class="vt-cap" style="left:' + a.toFixed(3) + '%"></span><span class="vt-cap" style="left:calc(' + b.toFixed(3) + '% - 2px)"></span>'
        : '';
      return '<div class="vt-wr' + (over ? ' is-over' : '') + '" data-work="' + f.k + '" data-scale="0-' + f.max + '">' + lab +
        '<span class="vt-track" role="img" aria-label="' + esc(T.barLabel(f, v, over)) + '">' + seg + (over ? '<span class="vt-over" aria-hidden="true">›</span>' : '') + '</span>' +
        '<span class="vt-wv">' + v + '<span class="vt-wu">' + esc(f.u) + '</span></span></div>';
    }).join('');
  }
  function workHTML(slug) {
    var wk = CO[slug] && CO[slug].work;
    var head = '<div class="vt-wk-head"><a class="vt-wk-link" href="' + coHref(slug, 'work') + '"><strong>' + esc(T.workHead) + '</strong>' +
      '<span class="vt-wk-role">' + esc(T.roles[state.role]) + '</span>' + ico('right') + '</a><span>' + esc(T.recent) + '</span></div>';
    var body;
    if (!wk || wk.s === 'loading') body = '<p class="vt-wk-lock">' + esc(T.loading) + '</p>';
    else if (wk.s === 'open') body = rowsHTML(wk.by[state.role]);
    else if (wk.s === 'login') body = '<p class="vt-wk-lock">🔒 ' + esc(T.loginPayLock) + '</p><a class="vt-wk-cta" href="' + esc(loginHref()) + '">' + esc(T.login) + '</a>';
    else if (wk.s === 'locked') body = '<p class="vt-wk-lock">🔒 ' + esc(T.payLock) + '</p><a class="vt-wk-cta" href="pay-report.html">' + esc(T.payGive) + '</a>';
    else if (wk.s === 'give') {
      if (GIVE_V) body = '<p class="vt-wk-lock">🔒 ' + esc(T.giveLock(GIVE_V.need)) + '</p><a class="vt-wk-cta" href="' + coHref(GIVE_V.airline, 'work') + '">' + esc(T.giveGo) + '</a>';
      else if (GIVE_V === undefined) body = '<p class="vt-wk-lock">' + esc(T.loading) + '</p>';
      else body = '<p class="vt-wk-lock">' + esc(T.coFail) + '</p>';
    }
    else if (wk.s === 'off') body = '<p class="vt-wk-lock">' + esc(T.off) + '</p>';
    else body = '<p class="vt-wk-lock">' + esc(T.coFail) + ' <button type="button" class="vt-retry" data-retry="work:' + slug + '">' + esc(T.retry) + '</button></p>';
    return head + body;
  }
  function coCard(slug) {
    var n = nameOf(slug, slug);
    return '<article class="vt-co" data-slug="' + slug + '">' +
      '<a class="vt-co-main" href="' + coHref(slug, 'reviews') + '" aria-label="' + esc(n.main + ' — ' + T.coReviews) + '">' +
        '<span class="vt-co-brand">' + logo(slug, n.main) + '<span><span class="vt-co-name">' + esc(n.main) + '</span>' +
        (n.sub ? '<span class="vt-co-full">' + esc(n.sub) + '</span>' : '') + '</span></span></a>' +
      '<div class="vt-co-sum" data-part="sum">' + sumHTML(slug) + '</div>' +
      '<div class="vt-radar-slot" data-part="radar">' + radarHTML(slug) + '</div>' +
      '<div class="vt-co-work" data-part="work">' + workHTML(slug) + '</div>' +
      '<span class="vt-co-foot" aria-hidden="true">' + esc(T.coReviews) + ico('arrow') + '</span></article>';
  }
  function paintCo(slug) {
    Array.prototype.forEach.call(d.querySelectorAll('.vt-co[data-slug="' + slug + '"]'), function (el) {
      var a = el.querySelector('[data-part="sum"]'), b = el.querySelector('[data-part="radar"]'), c = el.querySelector('[data-part="work"]');
      if (a) a.innerHTML = sumHTML(slug);
      if (b) b.innerHTML = radarHTML(slug);
      if (c) c.innerHTML = workHTML(slug);
    });
  }
  function companiesFor(q) {
    var out = [];
    function add(s) { if (out.length < 6 && hasPage(s) && out.indexOf(s) < 0) out.push(s); }
    var all = Object.keys(DIR).filter(hasPage);
    var hit = all.filter(function (s) { var a = DIR[s]; return norm([s, a.ja, a.en].join(' ')).indexOf(q) >= 0; });
    (popular.slugs || []).forEach(function (s) { if (hit.indexOf(s) >= 0) add(s); });
    hit.forEach(add);
    items.forEach(function (it) { if (matches(it, { q: q })) add(it.slug); });
    return out;
  }
  function renderCompanies() {
    var grid = $('vt-co-grid'); if (!grid) return;
    var h = $('vt-co-h'), sub = $('vt-co-sub');
    if (h) h.textContent = state.q ? T.matching : T.popular;
    if (sub) sub.textContent = state.q ? T.matchingSub : T.popularSub;
    var slugs;
    if (state.q) slugs = companiesFor(state.q);
    else if (popular.s === 'ok') slugs = popular.slugs.filter(hasPage);
    else if (popular.s === 'loading') { grid.innerHTML = '<div class="vt-skel"></div><div class="vt-skel"></div><div class="vt-skel"></div>'; return; }
    else { grid.innerHTML = '<div class="vt-empty"><strong>' + esc(T.popFail) + '</strong><button type="button" class="vt-retry" data-retry="popular">' + esc(T.retry) + '</button></div>'; return; }
    if (!slugs.length) { grid.innerHTML = '<div class="vt-empty"><strong>' + esc(T.noCo) + '</strong></div>'; return; }
    grid.innerHTML = slugs.map(coCard).join('');
    slugs.forEach(loadCompany);
  }
  function setRole(r) {
    if (r !== 'fo' && r !== 'cap') return;
    state.role = r;
    Array.prototype.forEach.call(d.querySelectorAll('[data-role]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-role') === r)); });
    Object.keys(CO).forEach(paintCo);
  }

  /* ── E. すべての口コミ ───────────────────────────────────── */
  function fillSelects() {
    var co = $('vt-f-co'), cat = $('vt-f-cat'), role = $('vt-f-role');
    if (!co || !cat || !role) return;
    var seenCo = {}, seenRole = {};
    items.forEach(function (it) { if (it.slug) seenCo[it.slug] = 1; if (it.pos) seenRole[it.pos] = 1; });
    var cos = Object.keys(seenCo).map(function (s) { return [s, nameOf(s, s).main]; })
      .sort(function (a, b) { return a[1].localeCompare(b[1], EN ? 'en' : 'ja'); });
    co.innerHTML = '<option value="">' + esc(T.allCo) + '</option>' + cos.map(function (x) { return '<option value="' + esc(x[0]) + '">' + esc(x[1]) + '</option>'; }).join('');
    cat.innerHTML = '<option value="">' + esc(T.allCat) + '</option>' + KEYS.map(function (k) { return '<option value="' + k + '">' + esc(T.cat[k]) + '</option>'; }).join('');
    var roles = ['captain', 'fo'].concat(Object.keys(seenRole).filter(function (p) { return p !== 'captain' && p !== 'fo'; }));
    role.innerHTML = '<option value="">' + esc(T.allRole) + '</option>' + roles.map(function (p) { return '<option value="' + esc(p) + '">' + esc(posText(p)) + '</option>'; }).join('');
    co.value = state.f.co; cat.value = state.f.cat; role.value = state.f.role;
  }
  function renderAll() {
    var box = $('vt-list'), cnt = $('vt-count'), more = $('vt-more'), post = $('vt-all-post');
    if (!box) return;
    if (post) post.setAttribute('href', 'submit-review.html' + (hasPage(state.f.co) ? '?airline=' + state.f.co : ''));
    if (feed.s === 'loading') { box.innerHTML = '<p class="vt-status">' + esc(T.loading) + '</p>'; if (cnt) cnt.textContent = ''; if (more) more.hidden = true; return; }
    var f = { q: state.q, co: state.f.co, cat: state.f.cat, role: state.f.role };
    var list = items.filter(function (it) { return matches(it, f); });
    if (cnt) cnt.textContent = T.count(list.length);
    if (!list.length) {
      box.innerHTML = '<div class="vt-empty"><strong>' + esc(T.noMatch) + '</strong>' + esc(T.noMatchSub) +
        (state.q ? '<br><button type="button" class="vt-btn-line" data-clear>' + esc(T.clear) + '</button>' : '') + '</div>';
    } else {
      box.innerHTML = list.slice(0, state.limit).map(function (it) { return card(it, f.cat, true); }).join('');
    }
    if (more) more.hidden = list.length <= state.limit;
    var fs = $('vt-feed-status2');
    if (fs) fs.innerHTML = feed.s === 'error' ? esc(T.feedFail) + ' <button type="button" class="vt-retry" data-retry="feed">' + esc(T.retry) + '</button>' : '';
    rescanMoney(box);
    say(T.live(list.length));
  }

  /* ── D. 口コミの引き出し ─────────────────────────────────── */
  var M = { open: false, fromUI: false, ret: '', key: '', pending: '', title: '' };
  function sectionHTML(it, k) {
    var r = it.row, b = it.body;
    var sc = k === 'mgmt' ? null : num(Number(r && r[k + '_score']));
    var score = (sc && sc > 0) ? '<span class="vt-d-score">' + stars(Math.min(5, sc)) + '<span>' + Math.min(5, sc).toFixed(1) + ' / 5</span></span>' : '';
    var p;
    if (it.kind === 'latest') {
      /* 届いているのは投稿の頭から80字だけ。80字に入らなかった欄は、書かれていれば影絵と錠前（cats が名前だけ運ぶ） */
      var lc = firstCat(b, k), wrote = ((r && r.cats) || []).indexOf(k) >= 0;
      if (lc) p = '<p>' + esc(lc.text) + '</p>' + (/…$/.test(lc.text) ? ghost(60) + '<p class="is-locked">🔒 ' + esc(T.lockedBody) + '</p>' : '');
      else if (wrote) p = ghost(60) + '<p class="is-locked">🔒 ' + esc(T.lockedBody) + '</p>';
      else p = '<p class="is-empty">' + esc(T.noComment) + '</p>';
    } else if (b.locked) {
      var written = ((r && r.cats) || []).indexOf(k) >= 0;
      if (!written) p = '<p class="is-empty">' + esc(T.noComment) + '</p>';
      else if (b.clipText && b.clipKey === k) p = '<p>' + esc(b.clipText) + '</p><p class="is-locked">🔒 ' + esc(T.lockedBody) + '</p>';
      else p = '<p class="is-locked">🔒 ' + esc(T.lockedBody) + '</p>';
    } else {
      var c = firstCat(b, k);
      if (!c) p = '<p class="is-empty">' + esc(T.noComment) + '</p>';
      else {
        var o = origOf(b, k), tr = b.translated && o && o !== c.text;
        p = '<p>' + esc(c.text) + '</p>' + (tr ? w.PVReviewI18n.origHTML(o) : '');
        if (tr) score = w.PVReviewI18n.noteHTML(b.from) + score;
      }
    }
    return '<section class="vt-d-sec"><h3><span>' + esc(T.cat[k]) + '</span>' + score + '</h3>' + p + '</section>';
  }
  function drawerHTML(it) {
    var n = nameOf(it.slug, it.code), co = hasPage(it.slug);
    var avg = (it.kind === 'server' || it.kind === 'latest') ? rowAvg(it.row) : (it.rating ? Math.min(5, it.rating) : null);
    var html = '<div class="vt-d-head"><span>' + esc(T.drawerHead) + '</span>' +
      '<button type="button" class="vt-d-close" data-close aria-label="' + esc(T.close) + '">' + ico('close') + '</button></div>' +
      '<div class="vt-d-body"><div class="vt-d-top">' + logo(it.slug, n.main) +
      '<div><h2 id="vt-d-title">' + esc(T.reviewOf(n.main)) + '</h2><p class="vt-d-meta">' +
      esc(posText(it.pos)) + ' · ' + esc(T.tenure(it.ten)) + ' · ' + esc(it.date.t) + '</p></div></div>' +
      '<div class="vt-d-sum">' + (avg ? '<span>' + esc(T.overall) + '</span><b class="vt-rn">' + avg.toFixed(1) + '</b>' + stars(avg) : '') +
      (co ? '<a class="vt-link" href="' + coHref(it.slug, 'reviews') + '">' + esc(T.coReviews) + ico('arrow') + '</a>' : '') + '</div>';
    var locked;
    if (it.kind === 'server' || it.kind === 'latest') {
      html += KEYS.map(function (k) { return sectionHTML(it, k); }).join('');
      locked = it.kind === 'latest' || it.body.locked;
    } else {
      var t = it.text, open = isUnlocked();
      var v = open ? t.length : safeCut(t, Math.max(30, Math.ceil(t.length / 8)));
      html += '<section class="vt-d-sec"><p>' + esc(t.slice(0, v)) + (t.length > v ? '<span class="vt-blur" aria-hidden="true">' + esc(t.slice(v)) + '</span>' : '') + '</p></section>';
      locked = !open && t.length > v;
    }
    if (locked) {
      html += '<div class="vt-d-gate"><p>' + esc(T.lockedBody) + '<br><a class="vt-gate-login" href="' + esc(loginHref()) + '">' + esc(T.gateLogin) + '</a></p>' +
        '<a class="vt-btn" href="submit-review.html' + (co ? '?airline=' + it.slug : '') + '">' + ico('pen') + esc(T.unlockBtn) + '</a></div>';
    }
    html += '<div class="vt-d-foot"><span>' + (it.kind === 'server' || it.kind === 'latest' ? T.avgNote : '') + (lenOf(it) ? '<br>' + esc(T.chars(lenOf(it))) : '') + '</span>' +
      (co ? '<a class="vt-btn-line" href="' + coHref(it.slug, 'reviews') + '">' + esc(T.openCo) + ico('ext') + '</a>' : '') + '</div></div>';
    return html;
  }
  function openReview(key) {
    var dlg = $('vt-dialog'); if (!dlg) return;
    var it = byKey(key);
    if (!it) {
      if (feed.s === 'loading' || latest.s === 'loading') { M.pending = key; return; }
      M.pending = '';
      history.replaceState(null, '', location.pathname + location.search + (M.ret || ''));
      if (M.open) closeDialog();
      return;
    }
    M.pending = ''; M.key = key;
    $('vt-dialog-body').innerHTML = drawerHTML(it);
    rescanMoney($('vt-dialog-body'));
    if (!dlg.open) { try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); } }
    dlg.scrollTop = 0;
    d.documentElement.classList.add('vt-lock');
    if (!M.open) M.title = d.title;
    M.open = true;
    d.title = T.reviewOf(nameOf(it.slug, it.code).main) + ' | Vote';
    var x = dlg.querySelector('[data-close]'); if (x) x.focus({ preventScroll: true });
  }
  function closeDialog() {
    var dlg = $('vt-dialog');
    if (dlg && dlg.open) dlg.close();
    d.documentElement.classList.remove('vt-lock');
    if (M.title) d.title = M.title;
    M.open = false;
    var key = M.key; M.key = '';
    /* 押したカードへフォーカスを戻す（DOM は作り直していない＝スクロールとカルーセルの位置はそのまま） */
    var root = view === 'all' ? $('vt-all') : $('vt-home');
    var el = root && root.querySelector('[data-review="' + key + '"]');
    if (el) w.requestAnimationFrame(function () { el.focus({ preventScroll: true }); });
  }
  function closeReview() {
    if (!M.open) return;
    if (M.fromUI) { M.fromUI = false; history.back(); return; }   // 開いたときに積んだ1段を戻すだけ（履歴を増やさない）
    history.replaceState(null, '', location.pathname + location.search + (M.ret || ''));
    closeDialog();
  }

  /* ── 画面の切り替え（#all ＝ すべての口コミ・#review/… ＝ 引き出し） ─── */
  function showView(v) {
    view = v;
    var home = $('vt-home'), all = $('vt-all');
    if (home) home.hidden = v !== 'home';
    if (all) all.hidden = v !== 'all';
    syncSearch();
    if (v === 'home') { renderFeed(); renderCompanies(); syncGate(); }
    else { fillSelects(); renderAll(); }
  }
  function route() {
    var h = location.hash.replace(/^#/, '');
    var m = /^review\/([A-Za-z0-9_-]{1,80})$/.exec(h);
    if (m) { if (!view) showView('home'); openReview(m[1]); return; }
    if (M.open) closeDialog();
    var v = h === 'all' ? 'all' : 'home';
    if (v !== view) {
      showView(v);
      if (v === 'all') w.scrollTo(0, 0);
    }
    if (h === 'latest' || h === 'companies') { var t = $(h); if (t) t.scrollIntoView(); }
  }

  /* ── 検索 ───────────────────────────────────────────────── */
  var qTimer = 0;
  function syncSearch() {
    Array.prototype.forEach.call(d.querySelectorAll('[data-q]'), function (inp) { if (inp.value !== state.raw) inp.value = state.raw; });
    Array.prototype.forEach.call(d.querySelectorAll('[data-q-clear]'), function (b) { b.classList.toggle('is-on', !!state.raw); });
  }
  function setQuery(raw) {
    state.raw = raw; state.q = norm(raw); state.limit = 60;
    syncSearch();
    if (view === 'all') renderAll(); else { renderFeed(); renderCompanies(); }
  }
  function say(t) { var l = $('vt-live'); if (l) l.textContent = t; }

  /* ── 読み込み ───────────────────────────────────────────── */
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
  }
  function loadFeed() {
    feed = { s: 'loading' };
    if (view === 'home') renderFeed(); else if (view === 'all') renderAll();
    var p = (sb && w.PVReviewI18n) ? w.PVReviewI18n.fetchRows(sb, { limit: 500 }) : Promise.resolve(null);
    return p.then(function (res) {
      if (!res) { feed = { s: 'error' }; rebuild([]); }       // 取れなかった。0件と言わない
      else {
        feed = { s: 'ok' };
        /* サーバが「鍵を持っている」と言ったら端末の写しを合わせる（写しは鍵ではない。勝手に消しもしない）。 */
        if (res.unlocked && !isUnlocked()) {
          var until = (w.PVUnlock && w.PVUnlock.reviewUntil) ? w.PVUnlock.reviewUntil() : Date.now() + 100 * 365 * 24 * 60 * 60 * 1000;
          try { localStorage.setItem('pv_unlock_expiry', String(until)); } catch (e) {}
        }
        rebuild(res.rows);
      }
      syncGate();
      if (view === 'all') { fillSelects(); renderAll(); } else { renderFeed(); renderCompanies(); }
      if (M.pending) openReview(M.pending);
    });
  }
  /* 流れるカード（pv_vote_latest）。無い（SQL を貼る前）・読めないときは今までの並びに戻る（stripItems）。 */
  function loadLatest() {
    latest = { s: 'loading', items: [] };
    return (sb ? rpc('pv_vote_latest') : Promise.resolve({ error: {} })).then(function (res) {
      var rows = res && !res.error && Array.isArray(res.data) ? res.data : null;
      latest = rows ? { s: 'ok', items: rows.map(fromLatest) } : { s: isOff(res && res.error) ? 'off' : 'error', items: [] };
      if (view === 'home') renderFeed();
      if (M.pending) openReview(M.pending);
    });
  }
  function loadPopular() {
    popular = { s: 'loading', slugs: [], days: 28 };
    return getJSON(ROOT + 'vote-popular.json').then(function (j) {
      var s = (j && Array.isArray(j.slugs)) ? j.slugs.filter(okSlug) : [];
      popular = s.length ? { s: 'ok', slugs: s.slice(0, 6), days: Number(j.days) || 28 } : { s: 'error', slugs: [], days: 28 };
    }, function () { popular = { s: 'error', slugs: [], days: 28 }; }).then(function () { if (view === 'home') renderCompanies(); });
  }

  /* ── 操作 ───────────────────────────────────────────────── */
  function bind() {
    d.addEventListener('click', function (e) {
      var t = e.target;
      var a = t.closest && t.closest('a[data-review]');
      if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
        M.fromUI = true; M.ret = location.hash || '';
        return;                                             // 既定のリンクで #review/… を1段積む
      }
      var b = t.closest && t.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-close')) { if (b.closest('#vt-info')) $('vt-info').close(); else closeReview(); }
      else if (b.hasAttribute('data-role')) setRole(b.getAttribute('data-role'));
      else if (b.hasAttribute('data-clear') || b.hasAttribute('data-q-clear')) { setQuery(''); var q = d.querySelector((view === 'all' ? '#vt-all' : '#vt-home') + ' [data-q]'); if (q) q.focus(); }
      else if (b.id === 'vt-more') { state.limit += 60; renderAll(); }
      else if (b.hasAttribute('data-info')) openInfo();
      else if (b.hasAttribute('data-retry')) {
        var r = b.getAttribute('data-retry');
        if (r === 'feed') loadFeed();
        else if (r === 'popular') loadPopular();
        else {
          var m = /^(rev|work):([a-z0-9-]+)$/.exec(r);
          if (m && CO[m[2]]) {
            if (m[1] === 'rev') { CO[m[2]].revP = null; CO[m[2]].rev = { s: 'loading' }; }
            else { CO[m[2]].workP = null; CO[m[2]].work = { s: 'loading' }; }
            paintCo(m[2]); loadCompany(m[2]);
          }
        }
      }
    });
    Array.prototype.forEach.call(d.querySelectorAll('[data-q]'), function (inp) {
      inp.addEventListener('input', function () {
        clearTimeout(qTimer);
        var v = inp.value;
        qTimer = setTimeout(function () { setQuery(v); }, 120);
      });
    });
    ['vt-f-co', 'vt-f-cat', 'vt-f-role'].forEach(function (id) {
      var s = $(id); if (!s) return;
      s.addEventListener('change', function () {
        state.f[id === 'vt-f-co' ? 'co' : id === 'vt-f-cat' ? 'cat' : 'role'] = s.value;
        state.limit = 60; renderAll();
      });
    });
    var raf = 0;
    /* 幅が変わったら写しの数を数え直す（狭い→広いで帯が途切れないように） */
    var lastW = w.innerWidth;
    w.addEventListener('resize', function () {
      if (Math.abs(w.innerWidth - lastW) < 40) return;
      lastW = w.innerWidth; clearTimeout(raf);
      raf = setTimeout(function () { if (view === 'home') renderFeed(); }, 200);
    }, { passive: true });
    var dlg = $('vt-dialog');
    if (dlg) {
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); closeReview(); });   // Esc
      dlg.addEventListener('click', function (e) { if (e.target === dlg) closeReview(); });  // 外側
    }
    w.addEventListener('hashchange', route);
  }
  function openInfo() {
    var dlg = $('vt-info'); if (!dlg) return;
    var body = $('vt-info-body');
    if (body) body.innerHTML = T.info.map(function (p) { return '<p>' + esc(typeof p === 'function' ? p(popular) : p) + '</p>'; }).join('');
    try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); }
  }

  function boot() {
    try { sb = (w.supabase && w.supabase.createClient) ? w.supabase.createClient(SB_URL, SB_KEY) : null; } catch (e) { sb = null; }
    bind();
    rebuild([]);
    route();
    getJSON(ROOT + 'pv-airlines.json').then(function (j) { DIR = (j && j.airlines) || {}; }, function () { DIR = {}; })
      .then(function () {
        if (view === 'home') { renderFeed(); renderCompanies(); }
        loadPopular();
        loadLatest();
        loadFeed();
      });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})(window, document);
