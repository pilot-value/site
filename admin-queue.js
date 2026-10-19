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
     写真は、承認の面が開いているあいだに1枚ずつ取りにいき、このタブのメモリーにだけ置く。
   ★断られた理由は、サイトに在る一言で出す（ステイ先の欄と同じ字）。サーバーの status の名前は画面に出さない。
   ★ホテルを「追加」で足せるのは、その会社の就航地だけ（決めるのはサーバー。面の候補は同じ一覧から出す手がかり）。
   ★「追加」の面に打った字は、このタブに30分だけ残す（打った人にだけ戻す。このページの「ログアウト」で消える）。
   ★承認の面の下に、オーナーだけの「申請してきた人」「会員一覧」（WP-towns-13v）。答えるのはサーバーで、
     オーナーでない運営には何も描かない。申請の画像は押したときに1枚だけ取りにいき、閉じたら消す（下の節）。 */
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
    posts:    function (n) { return n === 1 ? '1 member' : n + ' members'; },
    kinds:    { hotel: 'Hotel', food: 'Restaurant', spot: 'Place' },
    hours:    function (n) { return n + ' h'; },
    map:      'Google Maps',
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
    apps:     'Applicants',
    members:  'Members',
    verified: 'verified',
    decline:  'Decline',
    revoke:   'Revoke',
    view:     'View image',
    close:    'Close',
    applied:  'Applied',
    noUsers:  'No users',
    age:      ['Within 1 month', 'Within 3 months', 'Within 6 months', 'Within a year'],
    pos:      { captain: 'Captain', fo: 'First Officer', cadet: 'Trainee' },
    /* owner-only sentences (2026-10-18, P12.60) - the same keys and the same meaning as the Japanese table */
    reapply:  'This person has applied before, so they can be verified only after you see an image. When they send a new image from My Page, they will appear under "Applicants".',
    badIata:  function (code, air) { return code + ' is not on the destination list of ' + air + '. Only airports on the airline\'s destination list can be added here directly.'; },
    pickIata: 'Choose one of the suggested airports in the Airport field.'
  } : {
    towns:    'パイロットに人気の街',          // 会社ページの入口・面の名前と同じ字（オーナー 2026-10-18「パイロットに人気の街を追加」）
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
    /* オーナーだけの部分（WP-towns-13v）。申請してきた人・会員一覧・verified はオーナーの言葉のまま（英語のページも verified）。
       見送り・取り消す・閉じる・ユーザーなし・時期の段・職位はサイトに在る字（assert-admin.mjs が突き合わせる） */
    apps:     '申請してきた人',
    members:  '会員一覧',
    verified: 'verified',
    decline:  '見送り',
    revoke:   '取り消す',
    view:     '画像を見る',
    close:    '閉じる',
    applied:  '申請あり',
    noUsers:  'ユーザーなし',
    age:      ['1ヶ月以内', '3ヶ月以内', '6ヶ月以内', '1年以内'],
    pos:      { captain: '機長', fo: '副操縦士', cadet: '訓練生' },
    /* オーナーだけの文（2026-10-18・P12.60。オーナーに見てもらう字）
       reapply  会員一覧で、画像なしでは verified にできない人の行（Q1。以前に申請したことがあり、いま待っている申請も無い人。
                画像を見て verified にしたあと取り消した人は入らない ── P12.61 Q1 = 2。その行は「verified」で戻せる）
       badIata  運営の「追加」で、その会社の就航地に無い空港を打ったとき（V3。サーバーの bad_iata）。pickIata は候補が出ているときだけ添える */
    reapply:  'この人は以前に申請したことがあるため、画像を見てからでないと verified にできません。本人がマイページから新しい画像を出すと「申請してきた人」に並びます。',
    badIata:  function (code, air) { return code + ' は、' + air + 'の就航地（会社ページのステイ先に並ぶ空港）にありません。ここから直接追加できるのは、その会社の就航地だけです。'; },
    pickIata: '空港の欄の候補から選んでください。'
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
  /* ホテルを足せなかったときの一言（career-stay.js の SAY_ADD と同じ字。ステイ先の欄が同じ理由に出す字）。
     ★サーバーの status の名前は、画面に出さない。ここに無い status は FAIL（ステイ先の欄と同じ決め方）。
       英語のページは、英語の字がサイトに在る exists だけ。ほかは FAIL（英語の字はまだ無い）。 */
  var SAY_ADD = EN ? { exists: SAY.exists } : {
    bad_airline:  'この就航地には、いま追加できません。',
    bad_iata:     'この就航地には、いま追加できません。',
    bad_kind:     '種類を選んでください。',
    bad_name:     '名前は2〜80字で入力してください。',
    too_long:     '住所は200字、ひとことは500字までです。',
    bad_city:     '都市の名前が長すぎます。',
    bad_hours:    'ステイ時間は 1〜240 の整数（時間）で入力してください。空のままでも送れます。',
    too_fast:     '続けて追加するときは、少し時間をあけてください。',
    rate_limited: '追加できる数の上限に達しました。24時間たってからお試しください。',
    duplicate:    '同じ名前を、もう追加しています。',
    exists:       '同じ名前が、もう登録されています。',
    queue_full:   'この就航地には、いま追加できません。'
  };
  /* verified・見送り・取り消すが断られたときの一言。サイトに同じ場合の字が在るのは「もう無い」だけ
     （not_found ＝ その人が居ない／no_image ＝ 申請の画像がもう無い ── 別の窓で決めたあと）。ほかは FAIL。
     ★forbidden に SAY.forbidden（「運営だけが…」）を使わない ── 断られるのは運営なのでその字は当たらない。
     ★会員一覧の verified が断られる use_image（申請が待っている）は FAIL
       （別の窓で状態が変わったあと。読み直すと、行は面を開く「verified」に変わる）。
     ★会員一覧の道（via member）の no_image・applied_denied は T.reapply（2026-10-18・Q1）── 「もう表示できないものです。」は
       その人には当たらない（申請の跡があるので、本人が新しい画像を出すまで画像なしでは決めない ＝ 次にすることを言う）。 */
  var SAY_WHO = { not_found: SAY.not_found, no_image: SAY.not_found };
  var SAY_MEMBER = { no_image: T.reapply, applied_denied: T.reapply };

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

  /* ── 状態（このタブのメモリーだけ。待ち行列から来たものは保存領域に何も書かない。
        保存領域に置くのは「追加」の面に運営が打った字だけ ── 下の「打ちかけ」の決まり）──────────── */
  var EMPTY_TOWN = { k: 'idle', scopes: [], towns: [], texts: [], full: false };
  var EMPTY_STAY = { k: 'idle', places: [], photos: [], full: false };
  var EMPTY_OWNER = { k: 'idle', apps: [], members: [] };
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
    photoBusy: false,
    me: '',            // いま読んでいる人の印（会員の id の指紋。打ちかけを戻してよいかだけに使う。分からなければ ''）
    names: null,       // 会社の名簿（pv-airlines.json）を読む約束。1回だけ読む
    airports: null,    // 運営の「追加」で足せる空港（pv_stay_airports）を読む約束。ホテルの面を初めて出すときに1回だけ
    owner: EMPTY_OWNER, // オーナーだけの部分（申請してきた人・会員一覧）。数（承認の横）には入れない
    ownerSeen: false,  // このタブで、オーナーの2つの一覧が1回でも読めたか（読めた人にだけ、あとの失敗を見出しで出す）
    sheet: null,       // いま開いている申請の画像の面（1つだけ）。閉じたら画像ごと消す
    focus: null        // 決めたあと、描き直した同じ行のボタンへ戻す印（'app:id' ／ 'member:id'）
  };

  /* ── 会社の名前（両方のページで同じ1枚 pv-airlines.json から。英語のページは英語の名前）──
     読めなければ、日本語のページはサーバーの名前、英語のページは会社の符号の大文字（ほかの画面と同じ形）。 */
  function names() {
    if (!S.names) S.names = fetch(new URL('pv-airlines.json', SRC).href, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error('http');
      return res.json();
    }).then(function (j) {
      var m = j && j.airlines;
      if (!m || typeof m !== 'object' || isArr(m)) throw new Error('shape');
      return m;
    }).catch(function () { return null; });
    return S.names;
  }
  var NAMES = null;   // 読めた名簿（読めるまで・読めなければ null）
  function airName(code, serverName) {
    var c = str(code), m = NAMES && has(NAMES, c) ? NAMES[c] : null;
    var n = m ? str(EN ? m.en : m.ja) : '';
    return n || (!EN && str(serverName)) || c.toUpperCase();
  }
  /* 運営の「追加」で足せる空港（サーバーの決まりと同じ1か所 ── db/stays.sql の 3-n）。読めなければ null（候補を出さないだけ。決めるのはサーバー） */
  function airports() {
    if (!S.airports) S.airports = call(function () { return S.sb.rpc('pv_stay_airports', { p: {} }); }).then(function (r) {
      var a = verdict(r) === 'ok' ? r.data.airports : null;
      return a && typeof a === 'object' && !isArr(a) ? a : null;
    });
    return S.airports;
  }

  /* ── 打ちかけ（「追加」の2つの面。このタブだけ）── 給与以外の入力と同じ決まり（WP-keep-1）──
     ・置くのは、面の欄の字と選んだもの・打った人の印（'m:' ＋ 会員の id の指紋。id そのものは置かない）・最後に打った時刻だけ。
       置くのは画面の欄と同じもの（足せたあと、残っている会社と空港も）。欄が全部空なら置かない。
     ・戻すのは、最後に打ってから30分以内で、打った人がいま読んでいる人と同じときだけ（読み直し・戻る・面を開き直す）。
     ・別の人がログインしていたら、前の人の分は戻さずに消す（ページを開いた時・読み出しを始める時）。
     ・ログインが知らせなく切れた（自動のログアウト）だけなら消さない ── 同じ人が戻れば、30分のうちは戻る。
     ・このページの「ログアウト」は、このタブの分を全部消す（admin.html が pv_admin_draft: で始まる鍵を消す）。 */
  var DRAFT = 'pv_admin_draft:';
  var DRAFT_MS = 30 * 60 * 1000;
  var FIELDS = { town: ['scope', 'name'], hotel: ['airline', 'iata', 'name', 'address', 'maps_url', 'note'] };
  function sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* 置けなくても先へ */ } }
  function sdel(k) { try { sessionStorage.removeItem(k); } catch (e) { /* 消せなくても先へ */ } }
  function markOf(uid) {
    var P = window.PVPayLocal;
    return typeof uid === 'string' && uid && P && typeof P.fp === 'function' ? 'm:' + P.fp(uid) : '';
  }
  /* この端末に残っているログイン（supabase の鍵）の人の印。鍵が無ければ ''（誰か分からない ＝ 何も消さない） */
  function storedMark() {
    try {
      var s = window.PVSession && typeof window.PVSession.readStoredSession === 'function' ? window.PVSession.readStoredSession() : null;
      return markOf(s && s.user && s.user.id);
    } catch (e) { return ''; }
  }
  /* 置いてある1件。壊れた・前の形・30分を過ぎたものは、ここで消して null */
  function readDraft(kind) {
    var raw = sget(DRAFT + kind), o = null;
    if (!raw) return null;
    try { o = JSON.parse(raw); } catch (e) { o = null; }
    var age = o && typeof o.at === 'number' ? Date.now() - o.at : NaN;
    if (!o || o.v !== 1 || !(age >= -60000 && age <= DRAFT_MS) || !/^m:./.test(str(o.by)) || !o.f || typeof o.f !== 'object') {
      sdel(DRAFT + kind);
      return null;
    }
    return o;
  }
  /* いまの人に合わせる：別の人の分は消す。いまの人が分からなければ何もしない */
  function settleDrafts(cur) {
    if (!cur) return;
    Object.keys(FIELDS).forEach(function (k) { var o = readDraft(k); if (o && o.by !== cur) sdel(DRAFT + k); });
  }
  settleDrafts(storedMark());
  /* いまの人の打ちかけ（無ければ null） */
  function draftOf(kind) { var o = readDraft(kind); return o && S.me && o.by === S.me ? o : null; }
  /* 面の欄を、そのまま置き直す（get は欄 → 置く字。town の会社・基地は「符号|基地」で置く） */
  function keepDraft(kind, form, get) {
    if (!S.me) return;
    var f = {}, any = false;
    FIELDS[kind].forEach(function (k) {
      var v = get(k);
      f[k] = v;
      if (/\S/.test(v)) any = true;
    });
    if (!any) { sdel(DRAFT + kind); return; }
    sset(DRAFT + kind, JSON.stringify({ v: 1, by: S.me, at: Date.now(), f: f }));
  }
  function fieldValue(form, k) {
    var i = form.querySelector('[data-k="' + k + '"]');
    if (!i) return '';
    var v = String(i.value || ''), mx = Number(i.getAttribute('maxlength'));
    return mx > 0 ? v.slice(0, mx) : v;
  }
  function draftText(o, k) { return o && typeof o.f[k] === 'string' ? o.f[k] : ''; }

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
  /* オーナーだけの2つの一覧。★2つとも ok のときだけ 'ok'（片方だけでは描かない）。
     オーナーでない運営には forbidden（'deny'）が返る ── 見出しも行も数もボタンも出さない。
     id が字でない行は捨てる（押したときに送る id は、この行の id だけ） */
  function ownerPart(ra, rm) {
    var va = verdict(ra), vm = verdict(rm);
    var a = va === 'ok' && isArr(ra.data.rows) ? ra.data.rows : null, m = vm === 'ok' && isArr(rm.data.rows) ? rm.data.rows : null;
    var row = function (x) { return x && typeof x === 'object' && typeof x.id === 'string' && x.id !== ''; };
    if (a && m) return { k: 'ok', apps: a.filter(row), members: m.filter(row) };
    /* どちらかが「運営ではない・オーナーではない」なら deny。入口が無ければ off。それ以外は fail */
    var k = va === 'deny' || vm === 'deny' ? 'deny' : (va === 'off' || vm === 'off') ? 'off' : 'fail';
    return { k: k, apps: [], members: [] };
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
    /* 承認の面を閉じたら、申請の画像も閉じる（見えない所に画像を残さない） */
    if (which !== 'q') closeSheet(false);
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
    return airName(airline, s && s.name) + ' · ' + String(base || '');
  }
  function kindWord(k) { return has(T.kinds, k) ? T.kinds[k] : String(k || ''); }
  function stayLine(x) { return airName(x.airline) + ' · ' + String(x.iata || '') + ' · ' + kindWord(x.kind); }
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
  /* 行が片づいた（文・場所・写真）：メモリーの一覧から外し、行を消し、数を描き直す。
     その部分に待っているものが無くなったら、その見出しの下に「確認待ちはありません」 */
  function gone(list, x, li) {
    var part = list === 'texts' ? S.town : S.stay;
    part[list] = part[list].filter(function (y) { return y !== x; });
    if (li.parentNode) li.parentNode.removeChild(li);
    noneLine(part === S.town ? 'town' : 'stay');
    drawBadge();
  }
  function partRows(key) {
    return key === 'town' ? S.town.towns.length + S.town.texts.length : S.stay.places.length + S.stay.photos.length;
  }
  /* 読めた部分で、待っているものが1つも無いときだけ、その一覧のすぐ下に1行（読めない・準備中の部分には出さない） */
  function noneLine(key) {
    var q = $('adm-q'), part = key === 'town' ? S.town : S.stay;
    var ul = q && q.querySelector('ul[data-adm-list="' + key + '"]');
    if (!ul || part.k !== 'ok' || partRows(key) !== 0 || q.querySelector('[data-adm="none"][data-adm-part="' + key + '"]')) return;
    ul.parentNode.insertBefore(el('p', 'adm-say', T.none, { 'data-adm': 'none', 'data-adm-part': key }), ul.nextSibling);
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

  /* 見出しの横の「読み込めませんでした」「更新」 */
  function failPart() {
    var sp = el('span', 'adm-part', T.err);
    var b = el('button', 'adm-act adm-no', T.refresh, { type: 'button', 'data-act': 'reload' });
    b.addEventListener('click', function () { load(); });
    sp.appendChild(b);
    return sp;
  }
  function drawPart(q, key, title, part, rows) {
    var h = el('h2', 'adm-h', title);
    if (part.k === 'off') h.appendChild(el('span', 'adm-part', T.off));
    else if (part.k === 'fail' || part.k === 'deny') h.appendChild(failPart());
    q.appendChild(h);
    var ul = el('ul', 'adm-rows', null, { 'data-adm-list': key });
    if (part.k === 'ok') rows.forEach(function (li) { ul.appendChild(li); });
    q.appendChild(ul);
    noneLine(key);
  }

  /* ── オーナーだけの部分（申請してきた人・会員一覧）── WP-towns-13v（オーナーの言葉 2026-10-16）──────────
     ★守っているのはサーバー（db/stays.sql 10-c）。設定したオーナーにだけ答え、ほかの運営には forbidden。
       2つの一覧が両方 ok のときだけ描く ── オーナーでない運営には、見出しも行も数もボタンも出さない。
     ★申請の画像は「画像を見る」を押したときに1枚だけ取りにいき、その行の下の面にだけ出す
       （保存領域にもメモリーの一覧にも置かない・リンクにしない）。閉じる・決める・描き直す・承認の面を閉じる・
       ページを離れる、のどれでも src を外して面ごと消す。
     ★「verified」と「見送り」は画像の面の中にだけ置く（画像を見てから決める）。会員一覧は行に「verified」／「取り消す」。
     ★会員一覧は、画像を見ずに通す道にしない（WP-towns-13w・P12.46）：申請が待っている人の「verified」は、その人の行の下に
       同じ画像の面を開くだけ（決めるのは面の中・申請してきた人の道で送る）。画像を見て見送った人の行には「verified」を置かない
       （行に「見送り」の印。本人はマイページからまた申請できる）。一度も申請していない人は今までどおり行の「verified」で決める
       （オーナーの答え P12.47「1よい」）。画像を見て verified にしたあと取り消した人も、行の「verified」で新しい画像なしに戻せる
       （オーナーの答え P12.61 Q1 = 2）。断るのはサーバー（use_image ／ applied_denied ／ no_image）で、ここは押せる所を合わせるだけ。
     ★送るのは {id, state, via} の3つだけ。決めたら2つの一覧を読み直す。数（承認の横）には入れない。 */
  function who(x) { return str(x.name) || str(x.email) || '—'; }
  function personRow(adm, x) {
    var li = el('li', 'adm-row', null, { 'data-adm': adm, 'data-id': x.id });
    li.appendChild(el('p', 'adm-row-v', who(x)));
    if (str(x.name) && str(x.email)) li.appendChild(el('p', 'adm-row-k', x.email));
    var pos = str(x.position);
    var work = [str(x.company), has(T.pos, pos) ? T.pos[pos] : pos].filter(Boolean).join(' · ');
    if (work) li.appendChild(el('p', 'adm-row-k', work));
    return li;
  }
  /* 申請した時期（サーバーの 0〜4 の段 ── db/stays.sql 3-e）。4 は字を出さない：段は暦の月の差で決まるので、
     「それより前（1年より前）」と書くと、11か月あまりの申請にも当たってしまう（本当でないことを書かない） */
  function askedWord(n) { return typeof n === 'number' && n >= 0 && n <= 3 && Math.floor(n) === n ? T.age[n] : ''; }

  function appRow(x) {
    var li = personRow('app', x);
    var k = askedWord(x.asked);
    if (k) li.appendChild(el('p', 'adm-row-k', k));
    var vb = button('adm-no', T.view, 'view');
    vb.setAttribute('aria-expanded', 'false');
    vb.addEventListener('click', function () {
      if (S.sheet && S.sheet.li === li) closeSheet(true);
      else openSheet(li, x, vb);
    });
    actions(li).appendChild(vb);
    sayLine(li);
    return li;
  }
  function memberRow(x) {
    var li = personRow('member', x), v = li.querySelector('.adm-row-v');
    var on = x.state === 'approved', applied = x.applied === true;
    /* 画像を見て見送った人（いまのオーナーが見送った・申請は待っていない）。申請し直していれば「申請あり」の側 */
    var denied = !on && !applied && x.state === 'denied';
    /* 画像なしでは verified にできず、待っている申請も無い人（サーバーの reapply。Q1・2026-10-18）：「verified」を置かず、
       次にすること（本人がマイページから新しい画像を出す）を行に書く。画像を見て見送った人も同じ（「見送り」の印に、この1文を添える）。
       画像を見て verified にしたあと取り消した人は、サーバーが reapply を false で返す（P12.61 Q1 = 2）── 行は押せる「verified」のまま */
    var again = !on && !applied && x.reapply === true;
    if (applied) v.appendChild(el('span', 'adm-tag', T.applied));
    if (on) v.appendChild(el('span', 'adm-tag', T.verified));
    if (denied) v.appendChild(el('span', 'adm-tag', T.decline));
    if (again) li.appendChild(el('p', 'adm-say', T.reapply, { 'data-adm': 'reapply' }));
    var b = null;
    if (on || !applied) {
      if (!denied && !again) {
        b = on ? button('adm-no', T.revoke, 'revoke') : button('adm-ok', T.verified, 'verify');
        b.addEventListener('click', function () {
          decide(li, 'member:' + x.id, { id: x.id, state: on ? 'revoked' : 'approved', via: 'member' });
        });
      }
    } else {
      /* 申請が待っている人：「verified」は画像の面を開くだけ（ここからは何も送らない） */
      b = button('adm-ok', T.verified, 'verify');
      b.setAttribute('aria-expanded', 'false');
      b.addEventListener('click', function () {
        if (S.sheet && S.sheet.li === li) closeSheet(true);
        else openSheet(li, x, b);
      });
    }
    if (b) actions(li).appendChild(b);
    sayLine(li);
    return li;
  }

  /* 申請の画像の面（行の下に1つだけ）。決めるボタンは、画像が読めて描けたあとにだけ出す。
     申請してきた人の行からも、会員一覧の申請が待っている人の行からも、同じ面・同じ決め方（via applicant） */
  function openSheet(li, x, vb) {
    closeSheet(false);
    var key = li.getAttribute('data-adm') + ':' + x.id;
    var box = el('div', 'adm-sheet', null, { 'data-adm': 'sheet', role: 'group', 'aria-label': T.view, tabindex: '-1' });
    box.appendChild(el('p', 'adm-say', T.loading));
    var acts = li.querySelector('.adm-acts');
    li.insertBefore(box, acts ? acts.nextSibling : null);
    var sh = { li: li, box: box, vb: vb };
    S.sheet = sh;
    vb.setAttribute('aria-expanded', 'true');
    /* Escape は画像の面だけを閉じる（承認の面は開いたまま）。フォーカスは「画像を見る」へ戻す */
    box.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      closeSheet(true);
    });
    box.focus();
    var closeBtn = function () {
      var c = button('adm-no', T.close, 'close');
      c.addEventListener('click', function () { closeSheet(true); });
      return c;
    };
    var cannot = function () {
      clear(box);
      box.appendChild(el('p', 'adm-say', T.photoErr));
      actions(box).appendChild(closeBtn());
    };
    call(function () { return S.sb.rpc('pv_stay_applicant_image', { p: { id: x.id } }); }).then(function (r) {
      if (S.sheet !== sh) return;            // 閉じたあとに来た返事は捨てる（画像をどこにも置かない）
      var d = verdict(r) === 'ok' ? r.data : null;
      var b64 = d && d.mime === 'image/jpeg' && typeof d.b64 === 'string' ? d.b64.replace(/\s+/g, '') : '';
      if (!/^[A-Za-z0-9+\/]+=*$/.test(b64)) { cannot(); return; }
      clear(box);
      var img = el('img', 'adm-img', null, { alt: who(x), draggable: 'false' });
      img.addEventListener('load', function () {
        if (S.sheet !== sh) return;
        var a = actions(box);
        var ok = button('adm-ok', T.verified, 'verify');
        ok.addEventListener('click', function () { decide(li, key, { id: x.id, state: 'approved', via: 'applicant' }); });
        var no = button('adm-no', T.decline, 'decline');
        no.addEventListener('click', function () { decide(li, key, { id: x.id, state: 'denied', via: 'applicant' }); });
        a.appendChild(ok);
        a.appendChild(no);
        a.appendChild(closeBtn());
      }, { once: true });
      img.addEventListener('error', function () {
        if (S.sheet !== sh) return;
        img.removeAttribute('src');
        cannot();
      }, { once: true });
      box.appendChild(img);
      img.setAttribute('src', 'data:image/jpeg;base64,' + b64);
    });
  }
  function closeSheet(focusBack) {
    var sh = S.sheet;
    if (!sh) return;
    S.sheet = null;
    Array.prototype.forEach.call(sh.box.querySelectorAll('img'), function (i) { i.removeAttribute('src'); });
    if (sh.box.parentNode) sh.box.parentNode.removeChild(sh.box);
    sh.vb.setAttribute('aria-expanded', 'false');
    if (focusBack && sh.vb.isConnected) sh.vb.focus();
  }

  /* verified ・見送り・取り消す。断られたら、その行に一言を出す。どちらでも2つの一覧を読み直す */
  function decide(li, key, p) {
    if (li.getAttribute('aria-busy') === 'true') return;
    busy(li, true);
    say(li, '');
    call(function () { return S.sb.rpc('pv_stay_viewer_verify', { p: p }); }).then(function (r) {
      var d = r && !r.error ? r.data : null;
      if (!(d && d.ok === true)) {
        var st = d && d.ok === false ? String(d.status || '') : '';
        S.notes[key] = p.via === 'member' && has(SAY_MEMBER, st) ? SAY_MEMBER[st] : has(SAY_WHO, st) ? SAY_WHO[st] : FAIL;
        say(li, S.notes[key]);
      }
      S.focus = key;
      closeSheet(false);
      load();
    });
  }

  function drawOwner(q) {
    var o = S.owner;
    if (o.k === 'ok') S.ownerSeen = true;
    /* ★オーナーと分かる前は何も描かない。このタブで一度読めたオーナーにだけ、あとの失敗を見出しの横に出す */
    else if (!(o.k === 'fail' && S.ownerSeen)) return;
    [['apps', T.apps, o.apps.map(appRow), T.none], ['members', T.members, o.members.map(memberRow), T.noUsers]].forEach(function (s) {
      var h = el('h2', 'adm-h', s[1], { 'data-adm-owner': s[0] });
      if (o.k !== 'ok') h.appendChild(failPart());
      q.appendChild(h);
      var ul = el('ul', 'adm-rows', null, { 'data-adm-list': s[0] });
      s[2].forEach(function (li) { ul.appendChild(li); });
      q.appendChild(ul);
      if (o.k === 'ok' && !s[2].length) q.appendChild(el('p', 'adm-say', s[3], { 'data-adm': 'none', 'data-adm-part': s[0] }));
    });
  }
  /* 決めたあと：描き直した同じ人の行のボタンへフォーカスを戻す（申請の行が消えたら、会員一覧のその人の行へ） */
  function refocus(q) {
    var key = S.focus;
    S.focus = null;
    if (!key) return;
    var i = key.indexOf(':'), id = key.slice(i + 1);
    var find = function (adm) {
      var hit = null;
      Array.prototype.forEach.call(q.querySelectorAll('li.adm-row'), function (x) {
        if (!hit && x.getAttribute('data-adm') === adm && x.getAttribute('data-id') === id) hit = x;
      });
      return hit;
    };
    var li = find(key.slice(0, i)) || find('member');
    var b = li && li.querySelector('.adm-acts button');
    /* ボタンの無い行（画像を見て見送った人）なら、その行そのものへ（行の「見送り」の印が、何が起きたかを言う） */
    if (!b && li) { li.setAttribute('tabindex', '-1'); b = li; }
    if (b) b.focus();
  }

  function draw() {
    var q = $('adm-q');
    if (!q) return;
    closeSheet(false);
    clear(q);
    S.photoWait = [];
    var town = S.town, stay = S.stay;
    drawPart(q, 'town', T.towns, town, town.k === 'ok' ? town.towns.map(townRow).concat(town.texts.map(textRow)) : []);
    drawPart(q, 'stay', T.stays, stay, stay.k === 'ok' ? stay.places.map(placeRow).concat(stay.photos.map(photoRow)) : []);
    drawOwner(q);
    /* 断られた行の一言を、読み直したあとの同じ行へ戻す。行が無くなっていたら面の終わりに1行で残す。 */
    Object.keys(S.notes).forEach(function (key) {
      var i = key.indexOf(':'), adm = key.slice(0, i), id = key.slice(i + 1);
      var li = null;
      Array.prototype.forEach.call(q.querySelectorAll('li.adm-row'), function (x) {
        if (!li && x.getAttribute('data-adm') === adm && x.getAttribute('data-id') === id) li = x;
      });
      /* 読み直した行が、同じ字をもう行に書いている（reapply）なら、一言は重ねない */
      if (li) { if (!(S.notes[key] === T.reapply && li.querySelector('[data-adm="reapply"]'))) say(li, S.notes[key]); }
      else q.appendChild(el('p', 'adm-say', S.notes[key], { 'data-adm': 'note' }));
    });
    S.notes = {};
    refocus(q);
    drawBadge();
    S.drawn = true;
    /* 待っているもの（数に入るもの）か、オーナーへの申請があれば、承認の面を自分で開く（ページを開いて1回だけ） */
    if (!S.autoOpened && (total() > 0 || S.owner.apps.length > 0)) {
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
    /* オーナーだけの2つ（申請してきた人 → 会員一覧）。オーナーでなければ forbidden が返るだけ */
    var c = call(function () { return S.sb.rpc('pv_stay_applicants', { p: {} }); });
    var m = call(function () { return S.sb.rpc('pv_stay_members', { p: {} }); });
    /* 行に出す会社の名前（1回だけ読む。読めなくても待ち行列は描く） */
    return Promise.all([a, b, c, m, names()]).then(function (r) {
      NAMES = r[4];
      if (my !== S.seq) return;   // あとから始めた読み込みが描く
      S.town = townPart(r[0]);
      S.stay = stayPart(r[1]);
      S.owner = ownerPart(r[2], r[3]);
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
  /* サーバーが日本語の文で止めたとき（街の名前の検品）は、その文をそのまま。英語のページには英語の文がまだ無いので FAIL */
  function jaMessage(r) {
    var m = r && r.error ? str(r.error.message) : '';
    return !EN && /[぀-ヿ㐀-鿿]/.test(m) ? m : '';
  }
  /* 欄を打つ・選ぶたびに、その面の打ちかけを置き直す */
  function keepOnInput(form, kind, get) {
    var save = function () { keepDraft(kind, form, get); };
    form.addEventListener('input', save);
    form.addEventListener('change', save);
    return save;
  }

  function townForm() {
    var f = el('form', 'adm-form', null, { 'data-adm': 'add-town', novalidate: '' });
    var sel = el('select', 'adm-in', null, { 'data-k': 'scope', required: '' });
    sel.appendChild(el('option', null, '—', { value: '' }));
    S.town.scopes.forEach(function (s, i) {
      if (s && s.airline && s.base) sel.appendChild(el('option', null, airName(s.airline, s.name) + ' · ' + s.base, { value: String(i) }));
    });
    var name = el('input', 'adm-in', null, { type: 'text', maxlength: '30', 'data-k': 'name', required: '', autocomplete: 'off' });
    f.appendChild(field(T.scope, sel));
    f.appendChild(field(T.townName, name));
    f.appendChild(el('button', 'adm-act adm-ok', T.add, { type: 'submit' }));
    f.appendChild(el('p', 'adm-say', null, { 'data-adm': 'add-say', role: 'status', hidden: '' }));
    var scopes = S.town.scopes;
    /* 打ちかけ：会社・基地は「符号|基地」で置く（読み直すと並びが変わることがある）。戻すのは同じ組が在るときだけ */
    var scopeKey = function (s) { return s ? s.airline + '|' + s.base : ''; };
    var save = keepOnInput(f, 'town', function (k) {
      return k === 'scope' ? (sel.value === '' ? '' : scopeKey(scopes[Number(sel.value)])) : fieldValue(f, k);
    });
    var d0 = draftOf('town');
    if (d0) {
      scopes.forEach(function (s, i) { if (s && s.airline && s.base && scopeKey(s) === draftText(d0, 'scope')) sel.value = String(i); });
      name.value = draftText(d0, 'name').slice(0, 30);
    }
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
          save();
        } else if (d && d.ok === false) addSay(f, has(SAY, str(d.status)) ? SAY[d.status] : FAIL);
        else addSay(f, jaMessage(r) || FAIL);
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
    var iata = el('input', 'adm-in', null, { type: 'text', 'data-k': 'iata', required: '', maxlength: '3', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', list: 'adm-iata-list' });
    /* 空港の候補：選んだ会社の就航地（サーバーが足せる空港と同じ一覧）。候補は手がかりだけ ── 決めるのはサーバー */
    var opts = el('datalist', null, null, { id: 'adm-iata-list' });
    var AP = null;
    var fillIata = function () {
      clear(opts);
      var list = AP && has(AP, air.value.trim().toLowerCase()) ? AP[air.value.trim().toLowerCase()] : [];
      (isArr(list) ? list : []).forEach(function (c) { if (typeof c === 'string') opts.appendChild(el('option', null, null, { value: c })); });
    };
    var d0 = draftOf('hotel');
    /* 会社の欄：名簿と足せる空港がそろってから並べる。足せる空港が読めたら、その会社だけ（ほかの会社は足せない）。
       名簿が読めなかったときは、会社の符号を打つ欄に替える */
    Promise.all([names(), airports()]).then(function (r) {
      var m = r[0];
      AP = r[1];
      if (m) {
        Object.keys(m).filter(function (c) { return c !== 'other' && (!AP || has(AP, c)); }).forEach(function (c) {
          var n = m[c] && (EN ? m[c].en : m[c].ja);
          air.appendChild(el('option', null, str(n) || c.toUpperCase(), { value: c }));
        });
      } else {
        var code = el('input', 'adm-in', null, { type: 'text', 'data-k': 'airline', required: '', autocomplete: 'off', maxlength: '40' });
        airL.replaceChild(code, air);
        air = code;
      }
      air.addEventListener('input', fillIata);
      air.addEventListener('change', fillIata);
      /* 打ちかけの会社は、名簿を並べてから戻す（選べない会社は戻さない） */
      var a0 = draftText(draftOf('hotel'), 'airline');
      if (a0 && (air.tagName !== 'SELECT' || [].some.call(air.options, function (o) { return o.value === a0; }))) air.value = a0;
      fillIata();
    });
    var name = el('input', 'adm-in', null, { type: 'text', 'data-k': 'name', required: '', maxlength: '80', autocomplete: 'off' });
    var addr = el('input', 'adm-in', null, { type: 'text', 'data-k': 'address', maxlength: '200', autocomplete: 'off' });
    var map = el('input', 'adm-in', null, { type: 'url', 'data-k': 'maps_url', maxlength: '500', autocomplete: 'off', inputmode: 'url' });
    var note = el('textarea', 'adm-in', null, { 'data-k': 'note', maxlength: '500', rows: '3' });
    f.appendChild(field(T.iata, iata));
    f.appendChild(opts);
    f.appendChild(field(T.fName, name));
    f.appendChild(field(T.fAddr, addr));
    f.appendChild(field(T.fMap, map));
    f.appendChild(field(T.fNote, note));
    f.appendChild(el('button', 'adm-act adm-ok', T.add, { type: 'submit' }));
    f.appendChild(el('p', 'adm-say', null, { 'data-adm': 'add-say', role: 'status', hidden: '' }));
    /* 会社の欄がまだ並んでいないあいだは、置いてある会社をそのまま運ぶ（並ぶ前に打っても消さない） */
    var save = keepOnInput(f, 'hotel', function (k) {
      if (k === 'airline' && air.tagName === 'SELECT' && air.options.length <= 1) return draftText(draftOf('hotel'), 'airline');
      return fieldValue(f, k);
    });
    if (d0) {
      iata.value = draftText(d0, 'iata').slice(0, 3);
      name.value = draftText(d0, 'name').slice(0, 80);
      addr.value = draftText(d0, 'address').slice(0, 200);
      map.value = draftText(d0, 'maps_url').slice(0, 500);
      note.value = draftText(d0, 'note').slice(0, 500);
    }
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
          save();
        } else if (d && d.ok === false) addSay(f, str(d.status) === 'bad_iata' ? iataSay(p) : has(SAY_ADD, str(d.status)) ? SAY_ADD[d.status] : FAIL);
        else addSay(f, FAIL);
        load();
      });
    });
    /* 就航地に無い空港（サーバーの bad_iata。V3・2026-10-18）：打った空港と会社の名前を入れて、なぜ足せないかと、次にすることを言う
       （ほかの理由はステイ先の欄と同じ字のまま）。その会社の候補が出ていないとき（空港の一覧が読めなかった）は、選ぶ所の1文を付けない */
    function iataSay(p) {
      var a = str(p.airline).toLowerCase(), list = AP && has(AP, a) ? AP[a] : null;
      return T.badIata(str(p.iata), airName(a)) + (isArr(list) && list.length ? (EN ? ' ' : '') + T.pickIata : '');
    }
    return f;
  }

  function drawAdd() {
    var a = $('adm-a');
    if (!a) return;
    if (!A.built) {
      A.built = true;
      /* 打ちかけが在れば、最後に打っていた方の面で開く */
      var dt = draftOf('town'), dh = draftOf('hotel');
      if (dh && (!dt || dh.at > dt.at)) A.kind = 'hotel';
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

  /* いま読んでいる人（打ちかけを戻してよいかだけに使う）。分からなければ ''（戻さない・置かない） */
  function whoami() {
    return call(function () { return S.sb.auth && typeof S.sb.auth.getSession === 'function' ? S.sb.auth.getSession() : null; }).then(function (r) {
      var s = r && r.data && r.data.session;
      S.me = markOf(s && s.user && s.user.id);
      settleDrafts(S.me);
    });
  }

  /* ページを離れるときも申請の画像を閉じる（戻る・進むでページが戻っても、画像は残っていない） */
  window.addEventListener('pagehide', function () { closeSheet(false); });

  function start(sb) {
    if (S.started) return load();
    if (!sb || typeof sb.rpc !== 'function') return Promise.resolve();
    S.started = true;
    S.sb = sb;
    return whoami().then(function () {
      wire();
      return load();
    });
  }

  window.PVAdminQueue = {
    start: start,
    reload: function () { return S.started ? load() : Promise.resolve(); }
  };
})();
