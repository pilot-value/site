/* ════════════════════════════════════════════════════════════════
   roadmap.js — ROADMAP & REQUESTS（roadmap.html / en/roadmap.html）

   このファイルがやること
     ① roadmap-config.js の設定を、通信を待たずに描く
        （Mission / Vision・目標の段のレール・運営が進めていること・更新履歴）
     ② サーバに4つだけ聞く
        pv_give_progress()  … 給与を出したパイロットの人数（＝現在地）
        pv_give_growth()    … 週ごとの累計人数（＝折れ線）
        pv_requests_list()  … みんなからの要望と、その総数
        pv_is_admin()       … 管理用の操作を出すかどうか
     ③ 要望を出す・♡ を押す

   ★1画面に収める（2026-09-04 のオーナー指示「文字多すぎ・グラフで見せて」）。
     説明文を足したくなったら、まず何かを消す。縦に伸ばさない。

   ★このファイルは数を作らない。画面に出る数は全部サーバが返したもの。
     人数も件数も ♡ の数も、ここで足し引きして表示を作らない
     （♡ だけは押した瞬間に見た目を先に動かすが、サーバの戻りで必ず上書きし、
       失敗したら元に戻す）。

   ★文言は T に集める。HTML 側にはフォームの札しか置かない
     （assert-roadmap.mjs が T.ja と T.en の鍵が完全に同じかを見張る）。
     Mission / Vision と段・タスクの文言だけは roadmap-config.js にある。

   ★色は --pv-* トークンだけ。hex を1つも書かない。
     ダークは [data-theme="dark"] が勝手に効く。
     ⚠️ prefers-color-scheme はこのリポジトリのどこにも無い。持ち込まない
        （テーマは localStorage['pv-theme'] が唯一の正）。
     ⚠️ SVG の presentation attribute（stroke="…" / fill="…"）では var() が
        効かない。図の色は style="stroke:var(--pv-…)" で渡すか、
        getComputedStyle で解いた実際の値を渡す（ink() を見ること）。

   ⚠️ 本文（利用者が書いた文字）は必ず textContent で入れる。
      innerHTML に混ぜない。ここが1か所でも崩れると要望欄が XSS の口になる。
      要望の本文は「一覧」と「要望の人気（横棒）」の2か所に出る。両方 textContent。

   ⚠️ どの RPC も data が null で返り得る前提で書く。
      assert-header.mjs の偽セッションは sb.rpc に {data:null,error:null} を返させる。
      ここで例外を投げると、ヘッダー検査が真っ白なページを測って**通ってしまう**。
════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';
  if (!w || !d) return;

  var LANG = (d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';
  var CFG  = w.PVRoadmap || {};
  var MILE = (CFG.milestones && CFG.milestones.length) ? CFG.milestones.slice()
                                                       : [100, 500, 1000, 2000, 5000];
  /* 右カラムの一覧は縦に長くできない（左の図と高さを揃えて1画面に収める）。
     ★全件はブラウザへ投げない。足りなければ「さらに読む」で継ぎ足す。 */
  var PAGE = 4;
  var TOPN = 5;                        // 横棒に出す「人気の要望」の本数

  /* 区分と状態は db/requests.sql の白リストと1対1。
     ★片方だけ増やさない。増やすときは SQL の check 制約と同時に。 */
  var CATS   = ['feature', 'data', 'ui', 'bug', 'other'];
  var STATES = ['new', 'considering', 'planned', 'building', 'done', 'declined'];
  /* ★SQL の visibility の白リストと同じ綴り。assert-roadmap.mjs が突き合わせる
     （綴りがずれると、運営だけの行に札が出ないまま普通に並ぶ）。 */
  var VIS = ['public', 'private'];
  /* ★SQL の image_state の白リストと同じ綴り。assert-roadmap.mjs が突き合わせる
     （綴りがずれると、確認待ちの絵が誰の目にも触れないまま黙って溜まる）。 */
  var IMGST = ['none', 'pending', 'public', 'rejected'];
  /* コメントの名乗り。★SQL の case が返す3つと同じ綴り（assert-roadmap.mjs が突き合わせる）。
     ずれると全員が「匿名」に落ち、運営の返信と投稿者本人の返信が見分けられなくなる。 */
  var WHO = ['anon', 'author', 'staff'];

  // ══ 文言 ═══════════════════════════════════════════════════
  var DICT = {
    ja: {
      missionK: 'MISSION',
      visionK: 'VISION',

      countK: '給与を出したパイロット',
      countUnit: function (n) { return n + '人'; },
      countPending: '確認中',
      countNote: '登録者数ではありません。',
      nextK: function (g) { return '次の目標 ' + fmt(g) + '人'; },
      nextLeft: function (left) { return 'あと ' + fmt(left) + '人'; },
      allDone: 'すべての目標に届きました。',
      barLabel: function (n, g) { return g + '人のうち ' + n + '人'; },

      unknown: '—',
      retry: 'もう一度読み込む',

      growthH: 'コミュニティの伸び',
      growthS: '週ごとの累計',
      growthAria: '給与を出したパイロットの、週ごとの累計人数',
      growthOne: 'まだ1週ぶんです。来週から線になります。',
      growthErr: '伸びを読み込めませんでした。',

      wantH: '要望の人気',
      wantS: '賛成の多い順',

      tasksH: '運営が進めていること',
      tasksS: function (b, dn) { return '開発中 ' + b + '・完了 ' + dn; },
      stDone: '完了', stBuilding: '開発中', stPlanned: '予定', stConsidering: '検討中',
      fromCommunity: 'みんなの要望から',

      mlH: '5,000人までの道のり',
      mlNote: '予定は変わることがあります',

      formH: '匿名で要望を送る',
      formS: 'あなたのアイデアが、次の機能になります。',
      sent: 'ありがとうございます。要望を受け取りました。',
      errShort: 'もう少し詳しく書いてください（4文字以上）。',
      errLong: '500文字までです。',
      errFast: '少し時間をおいてから、もう一度お願いします。',
      errLimit: '今日はここまでにしてください（1日5件まで）。明日また受け取ります。',
      errDup: '同じ内容の要望を、すでに受け取っています。',
      errSend: '送れませんでした。通信を確かめて、もう一度お試しください。',
      sending: '送信中…',

      listH: 'みんなからのリクエスト',
      listS: function (n) { return fmt(n) + '件'; },
      sortPop: '人気順',
      sortNew: '新着順',
      listEmpty: 'まだリクエストはありません。最初のアイデアを送ってみませんか？',
      listErr: 'リクエストを読み込めませんでした。',
      listMore: 'さらに読む',
      likeLabel: function (n, on) {
        return (on ? 'この要望への賛成を取り消す' : 'この要望に賛成する') + '（現在 ' + n + '件）';
      },
      likeErr: '賛成を記録できませんでした。もう一度お試しください。',
      openMore: '全文を読む',
      openLess: '閉じる',

      shipH: '最近のアップデート',
      shipEmpty: 'アップデート履歴はこれから追加されます。',
      shipMore: 'これまでのアップデートをすべて見る',

      /* ★「運営にも誰かわからない」とは書かない（ハッシュは運営側で照合できる）。
         公開されるものだけを1文で言う。 */
      privacy: '公開されるのは本文・区分・賛成の数・状態・時期だけ。'
             + '航空会社・職位・給与・氏名とは結びつけません。',

      tagPrivate: '運営だけ',
      imgAdd: '画像を添付する',
      imgChange: '画像を選び直す',
      imgDrop: '外す',
      imgReading: '画像を読み込んでいます…',
      imgReady: function (kb) { return '添付します（' + kb + 'KB）'; },
      imgWait: '運営の確認待ち',
      imgWaitNote: 'この画像はまだほかのパイロットには出ていません。',
      imgAlt: '要望に添えられた画像',
      imgErrType: '画像として読めませんでした。別の画像を選んでください。',
      imgErrBig: '画像が大きすぎます。別の画像を選んでください。',
      imgOpen: '画像を公開する',
      imgReject: '画像を見送る',
      imgShown: '公開しています',
      adminH: '管理',
      adminHide: '伏せる',
      adminShow: '戻す',
      adminHidden: '伏せています',
      adminErr: '変更できませんでした。',

      cLabel: function (n) { return 'コメント ' + fmt(n) + '件'; },
      cLoading: '読み込んでいます…',
      cEmpty: 'まだコメントはありません。',
      cErr: 'コメントを読み込めませんでした。',
      cPh: 'この要望について書く',
      cSend: '送る',
      cSent: 'コメントを送りました。',
      cAuthor: '投稿者',
      cStaff: '運営',
      cAnon: function (n) { return '匿名' + n; },
      cMine: 'あなた',
      cNeed: '給与を1件出すと、コメントできます。',
      cNeedCta: '匿名で給与を出す',
      cErrShort: 'コメントを書いてください。',
      cErrMany: '今日はここまでにしてください。明日また受け取ります。',
      cErrDup: '同じ内容のコメントを、すでに受け取っています。',

      cat: { feature: '機能', data: 'データ', ui: '使いやすさ', bug: '不具合', other: 'その他' },
      st:  { 'new': '受付済み', considering: '検討中', planned: '予定',
             building: '開発中', done: '完了', declined: '見送り' },
      ym: function (y, m) { return y + '年' + m + '月'; },
      md: function (m, dd) { return m + '/' + dd; }
    },

    en: {
      missionK: 'MISSION',
      visionK: 'VISION',

      countK: 'Pilots who shared their pay',
      countUnit: function (n) { return n; },
      countPending: 'Checking',
      countNote: 'Not sign-ups.',
      nextK: function (g) { return 'Next milestone: ' + fmt(g); },
      nextLeft: function (left) { return fmt(left) + ' to go'; },
      allDone: 'Every milestone reached.',
      barLabel: function (n, g) { return n + ' of ' + g; },

      unknown: '—',
      retry: 'Load again',

      growthH: 'Community growth',
      growthS: 'Cumulative, weekly',
      growthAria: 'Cumulative number of pilots who shared their pay, by week',
      growthOne: 'One week so far. The line starts next week.',
      growthErr: 'Could not load the growth line.',

      wantH: 'Most wanted',
      wantS: 'By votes',

      tasksH: 'What we are working on',
      tasksS: function (b, dn) { return 'Building ' + b + ' · Shipped ' + dn; },
      stDone: 'Shipped', stBuilding: 'Building', stPlanned: 'Planned', stConsidering: 'Considering',
      fromCommunity: 'From a community request',

      mlH: 'Road to 5,000 pilots',
      mlNote: 'Plans may change',

      formH: 'Send a request anonymously',
      formS: 'Your idea could be the next feature.',
      sent: 'Thank you — your request has been received.',
      errShort: 'Please add a little more detail (4 characters or more).',
      errLong: '500 characters maximum.',
      errFast: 'Please wait a moment and try again.',
      errLimit: 'That is enough for today (5 per day). We will take more tomorrow.',
      errDup: 'We have already received a request with the same wording.',
      errSend: 'Could not send. Check your connection and try again.',
      sending: 'Sending…',

      listH: 'Requests from pilots',
      listS: function (n) { return fmt(n) + (n === 1 ? ' request' : ' requests'); },
      sortPop: 'Most wanted',
      sortNew: 'Newest',
      listEmpty: 'No requests yet. Would you like to send the first idea?',
      listErr: 'Could not load the requests.',
      listMore: 'Load more',
      likeLabel: function (n, on) {
        return (on ? 'Remove your vote for this request' : 'Vote for this request')
             + ' (' + n + ' now)';
      },
      likeErr: 'Could not record your vote. Please try again.',
      openMore: 'Read all',
      openLess: 'Close',

      shipH: 'Recent updates',
      shipEmpty: 'Updates will be listed here.',
      shipMore: 'See every update so far',

      privacy: 'Only the text, category, votes, status and date are shown — '
             + 'never your airline, rank, pay or name.',

      tagPrivate: 'Team only',
      imgAdd: 'Attach an image',
      imgChange: 'Choose another image',
      imgDrop: 'Remove',
      imgReading: 'Reading the image…',
      imgReady: function (kb) { return 'Attached (' + kb + 'KB)'; },
      imgWait: 'Waiting for review',
      imgWaitNote: 'Other pilots cannot see this image yet.',
      imgAlt: 'Image attached to the request',
      imgErrType: 'That file could not be read as an image. Please choose another one.',
      imgErrBig: 'That image is too large. Please choose another one.',
      imgOpen: 'Publish image',
      imgReject: 'Reject image',
      imgShown: 'Published',
      adminH: 'Admin',
      adminHide: 'Hide',
      adminShow: 'Unhide',
      adminHidden: 'Hidden',
      adminErr: 'Could not apply the change.',

      cLabel: function (n) { return n === 1 ? '1 comment' : fmt(n) + ' comments'; },
      cLoading: 'Loading…',
      cEmpty: 'No comments yet.',
      cErr: 'Could not load the comments.',
      cPh: 'Write about this request',
      cSend: 'Post',
      cSent: 'Your comment is posted.',
      cAuthor: 'Author',
      cStaff: 'PILOT VALUE',
      cAnon: function (n) { return 'Anonymous ' + n; },
      cMine: 'you',
      cNeed: 'Share one pay report and you can comment here.',
      cNeedCta: 'Share pay anonymously',
      cErrShort: 'Please write your comment.',
      cErrMany: 'That is enough for today. We will take more tomorrow.',
      cErrDup: 'We have already received the same comment.',

      cat: { feature: 'Feature', data: 'Data', ui: 'Usability', bug: 'Bug', other: 'Other' },
      st:  { 'new': 'Received', considering: 'Considering', planned: 'Planned',
             building: 'Building', done: 'Shipped', declined: 'Not planned' },
      /* ★3文字で書く。'September 2026' は日付の列（5.6em）に収まらず2行に折れ、
         履歴の題名の左端が行ごとにずれる。 */
      ym: function (y, m) {
        return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul',
                'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1] + ' ' + y;
      },
      md: function (m, dd) { return m + '/' + dd; }
    }
  };
  var T = DICT[LANG];

  // ══ 小道具 ═════════════════════════════════════════════════
  function fmt(n) {
    try { return Number(n).toLocaleString(LANG === 'en' ? 'en-US' : 'ja-JP'); }
    catch (e) { return String(n); }
  }
  /* ★これは**設定ファイルの文字**にだけ使う。利用者が書いた本文には使わない
     （本文は textContent で入れる。下の reqNode と paintWant を見ること）。 */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function txt(o) { return (o && o[LANG]) ? o[LANG] : {}; }
  function $(id) { return d.getElementById(id); }
  function say(msg) { var n = $('rm-live'); if (n) n.textContent = msg || ''; }
  function ym(iso) {
    var t = new Date(iso);
    if (isNaN(t.getTime())) return '';
    return T.ym(t.getFullYear(), t.getMonth() + 1);
  }
  /* 週の日付は 'YYYY-MM-DD' の文字列で来る。★new Date で解かない
     （UTC 深夜と解釈されるので、西半球では1日前の札が出る）。 */
  function md(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso == null ? '' : iso));
    return m ? T.md(Number(m[2]), Number(m[3])) : '';
  }
  /* 図の線に渡す色。★'var(--pv-orange)' を文字列のまま渡さない
     （SVG の stroke="…" では var() が効かず、線が黒か透明になる）。 */
  function ink(name) {
    try {
      var v = w.getComputedStyle(d.documentElement).getPropertyValue(name);
      v = String(v == null ? '' : v).replace(/^\s+|\s+$/g, '');
      return v || 'currentColor';
    } catch (e) { return 'currentColor'; }
  }
  var REDUCED = false;
  try { REDUCED = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { REDUCED = false; }

  // ══ ページ固有の CSS ═══════════════════════════════════════
  /* ★my-value.css を触らない。あれは14ページが共有していて、1行足すと
     画面検査（7分半）が必ず要る。このページでしか使わない見た目はここに置く。

     ★ページ固有の CSS を .rm-x .mr-y（詳細度 0,2,0）で書かない。
       my-value.css の @media 側（0,1,0）に勝ってしまい、**狭いときの
       折り返しだけが黙って効かなくなる**。ここでは共有クラスを上書きせず、
       .rm-* だけで完結させてある。 */
  var CSS = [
    /* ── 外の2カラム。左が図、右が「送る」と「みんなの声」───────
       ★メディアクエリで切らない。この段の左右にサイドバーが有るか無いかで
         使える幅が変わる（1000px でサイドバーが畳まれて逆に広くなる）ので、
         画面幅で分けると 1001px だけ極端に細い2列になる。
         flex-basis で書けば、どんな幅でも正しい側に倒れる。 */
    '.rm-grid>.rm-l{flex:2 1 560px}',
    '.rm-grid>.rm-r{flex:1 1 320px}',
    '.rm-row{display:flex;flex-wrap:wrap;gap:16px;align-items:stretch}',
    '.rm-row>*{min-width:0}',
    '.rm-row>.rm-hero{flex:1.7 1 320px}',
    '.rm-row>.rm-prog{flex:1 1 210px}',
    '.rm-row>.rm-growth{flex:1.35 1 300px}',
    '.rm-row>.rm-want{flex:1 1 250px}',
    '.rm-row>.rm-tasks{flex:1.45 1 300px}',
    '.rm-row>.rm-ship-c{flex:1 1 250px}',

    /* ── Mission / Vision（紺のカード。ここに置く文は2つだけ）──── */
    '.rm-hero{display:flex;flex-direction:column;justify-content:center;gap:16px}',
    '.rm-eyebrow{display:block;font-size:.66rem;font-weight:800;letter-spacing:.16em;',
    '  color:var(--pv-ink-3)}',
    '.rm-mission{margin-top:7px;font-size:clamp(1.1rem,2.3vw,1.36rem);font-weight:800;',
    '  letter-spacing:-.03em;line-height:1.5;color:var(--pv-ink)}',
    '.rm-vision{margin-top:7px;font-size:clamp(.78rem,1.4vw,.85rem);font-weight:600;',
    '  line-height:1.7;color:var(--pv-ink-2)}',
    '.rm-mv-2{padding-top:15px;border-top:1px solid var(--pv-line)}',

    /* ── 現在地のリング ───────────────────────────────── */
    '.rm-prog{display:flex;flex-direction:column;align-items:center;text-align:center;gap:2px}',
    '.rm-cnt-k{display:block;font-size:.69rem;font-weight:700;letter-spacing:.02em;',
    '  color:var(--pv-ink-3);line-height:1.5}',
    '.rm-ring{margin-top:10px;line-height:0}',
    '.rm-ring-s{display:block}',
    '.rm-ring-v{font-size:26px;font-weight:900;letter-spacing:-.03em;fill:var(--pv-ink);',
    '  font-variant-numeric:tabular-nums}',
    '.rm-ring-p{font-size:10px;font-weight:800;letter-spacing:.04em;fill:var(--pv-ink-3)}',
    '.rm-next{margin-top:12px;font-size:.72rem;font-weight:700;line-height:1.6;',
    '  color:var(--pv-ink-2)}',
    '.rm-next b{display:block;margin-top:3px;font-weight:800;color:var(--pv-orange-ink);',
    '  font-variant-numeric:tabular-nums}',
    '.rm-cnt-n{display:block;margin-top:9px;font-size:.65rem;line-height:1.6;color:var(--pv-ink-3)}',

    /* ── 折れ線 ────────────────────────────────────────
       ★--pt-dot は pay-viz.js が「通過点」の抜き色に使う。カードの地の色を
         渡す約束（既定は白 or 黒）。渡さないとライトの紺以外で点が浮く。 */
    '.rm-growth{--pt-dot:var(--pv-surface)}',
    '.rm-chart{min-height:134px}',

    /* ── 要望の人気（横棒）──────────────────────────────
       ★縦棒にしない。日本語の要望文は縦棒の下で2〜3行に折れ、390px で必ず崩れる。 */
    '.rm-wbars{list-style:none;display:flex;flex-direction:column;gap:9px}',
    '.rm-wbars li{min-width:0}',
    '.rm-wr{display:flex;align-items:baseline;gap:8px}',
    '.rm-wt{flex:1 1 auto;min-width:0;font-size:.73rem;font-weight:600;line-height:1.5;',
    '  color:var(--pv-ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.rm-wn{flex:none;font-size:.72rem;font-weight:800;color:var(--pv-orange-ink);',
    '  font-variant-numeric:tabular-nums}',
    '.rm-wb{display:block;height:6px;margin-top:5px;border-radius:999px;',
    '  background:var(--pv-line-soft);overflow:hidden}',
    '.rm-wb i{display:block;height:100%;border-radius:999px;background:var(--pv-orange)}',

    /* ── 目標の段（横一列のレール）───────────────────────
       ★到達は色だけで伝えない。丸の塗り＋数字の前の ✓ ＋色の3つで示す。 */
    '.rm-rail{list-style:none;display:flex;gap:0;margin-top:2px}',
    '.rm-rail li{flex:1 1 0;min-width:0;position:relative;padding:24px 3px 0;text-align:center}',
    '.rm-rail li::before{content:"";position:absolute;left:0;right:0;top:7px;height:2px;',
    '  background:var(--pv-line)}',
    '.rm-rail li:first-child::before{left:50%}',
    '.rm-rail li:last-child::before{right:50%}',
    '.rm-rail li.is-on::before{background:var(--pv-orange)}',
    '.rm-rail .rm-dot{position:absolute;left:50%;top:0;width:16px;height:16px;margin-left:-8px;',
    '  border-radius:999px;border:2px solid var(--pv-line);background:var(--pv-surface)}',
    '.rm-rail li.is-on .rm-dot{border-color:var(--pv-orange);background:var(--pv-orange)}',
    '.rm-rail li.is-next .rm-dot{border-color:var(--pv-orange);border-width:3px}',
    '.rm-rail li b{display:block;font-size:.72rem;font-weight:800;line-height:1.4;',
    '  color:var(--pv-ink-3);font-variant-numeric:tabular-nums}',
    '.rm-rail li.is-on b{color:var(--pv-orange-ink)}',
    '.rm-rail li.is-next b{color:var(--pv-ink)}',
    '.rm-rail li span{display:block;margin-top:3px;font-size:.62rem;font-weight:600;',
    '  line-height:1.45;color:var(--pv-ink-3)}',
    '.rm-rail li.is-next span{color:var(--pv-ink-2)}',
    '@media(max-width:560px){.rm-rail li b{font-size:.66rem}',
    '  .rm-rail li span{font-size:.55rem}}',
    '.rm-ml-d{margin-top:11px;font-size:.72rem;line-height:1.7;color:var(--pv-ink-2)}',

    /* 状態の札。★色だけで区別しない。記号＋語＋色の3つで区別する。 */
    '.rm-tag{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;',
    '  font-size:.66rem;font-weight:800;white-space:nowrap;border:1px solid transparent}',
    '.rm-tag.is-done{background:var(--pv-green-soft);color:var(--pv-green-ink);',
    '  border-color:var(--pv-green-line)}',
    '.rm-tag.is-building{background:var(--pv-orange-soft);color:var(--pv-orange-ink);',
    '  border-color:var(--pv-orange)}',
    '.rm-tag.is-planned{background:var(--pv-blue-soft);color:var(--pv-blue-ink);',
    '  border-color:var(--pv-blue-line)}',
    '.rm-tag.is-considering{background:var(--pv-line-soft);color:var(--pv-ink-3);',
    '  border-color:var(--pv-line)}',
    '.rm-tag.is-new{background:var(--pv-line-soft);color:var(--pv-ink-2);border-color:var(--pv-line)}',
    '.rm-tag.is-declined{background:var(--pv-line-soft);color:var(--pv-ink-3);',
    '  border-color:var(--pv-line);text-decoration:line-through}',
    /* 運営だけに見せる要望。★色だけで区別しない ── 破線の囲みと語で分かる。 */
    '.rm-tag.is-private{background:var(--pv-surface-2);color:var(--pv-ink-2);',
    '  border-color:var(--pv-ink-3);border-style:dashed}',

    /* ── 運営が進めていること（札を左、題名と1行の説明を右）──── */
    '.rm-list{list-style:none;display:flex;flex-direction:column;gap:9px}',
    '.rm-task{display:flex;gap:10px;align-items:flex-start}',
    '.rm-task .rm-tag{flex:none;margin-top:1px}',
    '.rm-task-b{flex:1 1 auto;min-width:0}',
    '.rm-task-t{font-size:.79rem;font-weight:800;letter-spacing:-.015em;line-height:1.5;',
    '  color:var(--pv-ink)}',
    '.rm-task-d{margin-top:2px;font-size:.69rem;line-height:1.6;color:var(--pv-ink-3)}',
    '.rm-chipc{display:inline-flex;align-items:center;margin-left:6px;padding:2px 7px;',
    '  border-radius:999px;background:var(--pv-gold-soft);color:var(--pv-gold-ink);',
    '  border:1px solid var(--pv-gold-line);font-size:.62rem;font-weight:800;white-space:nowrap}',

    '.rm-ship{list-style:none;display:flex;flex-direction:column;gap:0}',
    '.rm-ship li{display:flex;gap:10px;padding:7px 0;border-top:1px solid var(--pv-line-soft)}',
    '.rm-ship li:first-child{border-top:0;padding-top:0}',
    /* ★日付の列は固定幅。auto にすると行ごとに幅が変わって題名の左端が揃わない。
       日英とも 5.6em に収まる形（「2026年9月」/「Sep 2026」）で書くこと ── T.ym を
       長い月名に戻すと、ここは何も言わずに2行へ折れる。 */
    '.rm-ship .ymd{flex:none;width:5.6em;font-size:.67rem;font-weight:700;line-height:1.7;',
    '  color:var(--pv-ink-3);font-variant-numeric:tabular-nums}',
    '.rm-ship .t{flex:1 1 auto;min-width:0;font-size:.74rem;font-weight:700;line-height:1.7;',
    '  color:var(--pv-ink)}',
    '.rm-ship .ck{flex:none;color:var(--pv-green-ink);font-size:.72rem;font-weight:900;',
    '  line-height:1.7}',

    '.rm-tabs{display:flex;gap:6px}',
    '.rm-tab{min-height:44px;padding:9px 14px;border-radius:999px;border:1px solid var(--pv-line);',
    '  background:var(--pv-surface);color:var(--pv-ink-2);font:inherit;font-size:.74rem;',
    '  font-weight:700;cursor:pointer;',
    '  transition:background-color .18s var(--pv-ease),color .18s var(--pv-ease),',
    '             border-color .18s var(--pv-ease)}',
    '.rm-tab:hover{background:var(--pv-line-soft);color:var(--pv-ink)}',
    '.rm-tab:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',
    '.rm-tab:active{background:var(--pv-line)}',
    '.rm-tab[aria-pressed="true"]{background:var(--pv-orange-soft);color:var(--pv-orange-ink);',
    '  border-color:var(--pv-orange)}',

    '.rm-req{display:flex;gap:11px;padding:11px 12px;border-radius:var(--pv-r);',
    '  background:var(--pv-surface-2);border:1px solid var(--pv-line-soft)}',
    '.rm-req.is-new{border-color:var(--pv-orange);background:var(--pv-orange-soft)}',
    '.rm-req.is-hidden{opacity:.55}',
    /* ★align-self を止めないと、行の高さいっぱいに縦長の ♡ が伸びる
       （コメントを開いた行で700pxの帯になった）。 */
    '.rm-like{flex:none;align-self:flex-start;display:flex;flex-direction:column;align-items:center;',
    '  justify-content:center;gap:2px;min-width:46px;min-height:46px;padding:5px 6px;',
    '  border-radius:var(--pv-r-sm);border:1px solid var(--pv-line);background:var(--pv-surface);',
    '  color:var(--pv-ink-3);font:inherit;cursor:pointer;',
    '  transition:background-color .18s var(--pv-ease),color .18s var(--pv-ease),',
    '             border-color .18s var(--pv-ease),transform .18s var(--pv-ease)}',
    '.rm-like:hover{border-color:var(--pv-orange);color:var(--pv-orange-ink)}',
    '.rm-like:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',
    '.rm-like:active{transform:scale(.94)}',
    '.rm-like[aria-pressed="true"]{background:var(--pv-orange-soft);color:var(--pv-orange-ink);',
    '  border-color:var(--pv-orange)}',
    '.rm-like svg{flex:none}',
    '.rm-like b{font-size:.72rem;font-weight:800;font-variant-numeric:tabular-nums;line-height:1}',
    '.rm-req-b{flex:1 1 auto;min-width:0}',
    /* ★長い要望で右カラムが縦に伸びないよう3行で畳む。全文は下のボタンで開く
       （切り捨てない。500文字まで書けると約束している以上、読めなくしない）。 */
    '.rm-req-t{font-size:.75rem;line-height:1.75;color:var(--pv-ink);',
    '  overflow-wrap:anywhere;white-space:pre-wrap;overflow:hidden;',
    '  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}',
    '.rm-req-t.is-open{display:block;overflow:visible}',
    '.rm-open{margin-top:5px;padding:2px 0;border:0;background:none;font:inherit;',
    '  font-size:.67rem;font-weight:700;color:var(--pv-orange-ink);cursor:pointer;',
    '  text-decoration:underline;text-underline-offset:3px}',
    '.rm-open:hover{color:var(--pv-ink)}',
    '.rm-open:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',
    '.rm-open:active{opacity:.7}',
    '.rm-req-m{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:7px}',
    '.rm-req-m .ymd{font-size:.65rem;font-weight:600;color:var(--pv-ink-3)}',

    '.rm-admin{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:10px;',
    '  padding-top:9px;border-top:1px dashed var(--pv-line)}',
    '.rm-admin-k{font-size:.65rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;',
    '  color:var(--pv-ink-3)}',
    '.rm-admin select{font:inherit;font-size:16px;padding:6px 8px;border-radius:var(--pv-r-sm);',
    '  border:1px solid var(--pv-line);background:var(--pv-surface);color:var(--pv-ink)}',
    '.rm-admin button{min-height:36px;padding:6px 12px;border-radius:var(--pv-r-sm);',
    '  border:1px solid var(--pv-line);background:var(--pv-surface);color:var(--pv-ink-2);',
    '  font:inherit;font-size:.72rem;font-weight:700;cursor:pointer}',
    '.rm-admin button:hover{background:var(--pv-line-soft);color:var(--pv-ink)}',
    '.rm-admin button:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',
    '.rm-admin select:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',

    '.rm-empty{padding:18px 14px;border-radius:var(--pv-r);background:var(--pv-surface-2);',
    '  border:1px dashed var(--pv-line);font-size:.74rem;line-height:1.75;color:var(--pv-ink-2);',
    '  text-align:center}',
    /* 取れなかったときの読み直し。★ここに 0 を書かない（本当に0件だと読める）。 */
    '.rm-retry{display:inline-block;margin-top:6px;padding:0;border:0;background:none;',
    '  font:inherit;font-size:.68rem;font-weight:700;color:var(--pv-orange-ink);',
    '  cursor:pointer;text-decoration:underline;text-underline-offset:3px}',
    '.rm-retry:hover{color:var(--pv-ink)}',
    '.rm-retry:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',
    '.rm-retry:active{opacity:.7}',
    '.rm-more-btn{display:block;width:100%;min-height:44px;margin-top:12px;padding:11px 16px;',
    '  border-radius:var(--pv-r-sm);border:1px solid var(--pv-line);background:var(--pv-surface);',
    '  color:var(--pv-ink-2);font:inherit;font-size:.76rem;font-weight:700;cursor:pointer;',
    '  transition:background-color .18s var(--pv-ease),color .18s var(--pv-ease)}',
    '.rm-more-btn:hover{background:var(--pv-line-soft);color:var(--pv-ink)}',
    '.rm-more-btn:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',
    '.rm-more-btn:active{background:var(--pv-line)}',

    '.rm-live{margin-top:16px;font-size:.75rem;line-height:1.7;color:var(--pv-orange-ink);',
    '  min-height:1.2em}',
    '.rm-note{margin-top:10px;font-size:.66rem;line-height:1.7;color:var(--pv-ink-3)}',

    /* 送信フォーム。iOS が拡大しないよう入力欄は 16px を切らない。
       ★書く欄は書いた分だけ伸びる（高さは growTa が入れる）。resize:none にするのは、
         掴んで広げた高さが次の1文字で JS に消されるため。高さに transition は付けない
         （1文字ごとに欄が揺れる）。 */
    '.rm-f-l{display:block;font-size:.75rem;font-weight:700;color:var(--pv-ink-2);line-height:1.6}',
    '.rm-f-t{display:block;width:100%;margin-top:8px;padding:11px 12px;border-radius:var(--pv-r-sm);',
    '  border:1px solid var(--pv-line);background:var(--pv-surface-2);color:var(--pv-ink);',
    '  font:inherit;font-size:16px;line-height:1.7;min-height:84px;',
    '  resize:none;overflow-y:hidden}',
    '.rm-f-t:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',
    '.rm-f-s{display:block;width:100%;margin-top:8px;padding:10px 12px;border-radius:var(--pv-r-sm);',
    '  border:1px solid var(--pv-line);background:var(--pv-surface-2);color:var(--pv-ink);',
    '  font:inherit;font-size:16px}',
    '.rm-f-s:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',
    /* 添付の絵。★押せる所はボタン側で作る（file 入力そのものは見せない）。 */
    '.rm-f-img{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:13px}',
    '.rm-f-att{flex:none;min-height:40px;padding:9px 14px;border-radius:var(--pv-r-sm);',
    '  border:1px dashed var(--pv-line);background:var(--pv-surface-2);color:var(--pv-ink-2);',
    '  font:inherit;font-size:.75rem;font-weight:700;cursor:pointer;',
    '  transition:background-color .18s var(--pv-ease),border-color .18s var(--pv-ease),',
    '  color .18s var(--pv-ease)}',
    '.rm-f-att:hover{background:var(--pv-line-soft);border-color:var(--pv-ink-3);color:var(--pv-ink)}',
    '.rm-f-att:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',
    '.rm-f-att:active{background:var(--pv-line-soft);border-style:solid}',
    '.rm-f-att-n{font-size:.7rem;font-weight:600;color:var(--pv-ink-3);line-height:1.6}',
    /* 選んだ絵の下見。★高さを先に取らないと、読み終わった瞬間に下が飛び跳ねる。 */
    '.rm-f-prev{position:relative;margin-top:10px}',
    '.rm-f-prev img{display:block;width:100%;height:auto;max-height:200px;',
    '  object-fit:contain;',
    '  border-radius:var(--pv-r-sm);border:1px solid var(--pv-line);background:var(--pv-surface-2)}',
    '.rm-f-x{position:absolute;top:7px;right:7px;min-width:34px;min-height:34px;',
    '  border-radius:999px;border:1px solid var(--pv-line);background:var(--pv-surface);',
    '  color:var(--pv-ink-2);font:inherit;font-size:.7rem;font-weight:700;cursor:pointer;',
    '  transition:background-color .18s var(--pv-ease),color .18s var(--pv-ease)}',
    '.rm-f-x:hover{background:var(--pv-ink);color:var(--pv-surface)}',
    '.rm-f-x:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',
    '.rm-f-x:active{background:var(--pv-ink-2);color:var(--pv-surface)}',
    /* 一覧の行に出る絵。★幅は行に合わせる。横スクロールを作らない。 */
    '.rm-req-img{margin-top:9px}',
    '.rm-req-img img{display:block;width:100%;height:auto;max-height:190px;',
    '  object-fit:contain;',
    '  border-radius:var(--pv-r-sm);border:1px solid var(--pv-line);background:var(--pv-surface-2)}',
    '.rm-req-img .rm-img-w{display:block;margin-top:5px;font-size:.66rem;font-weight:600;',
    '  color:var(--pv-ink-3);line-height:1.6}',
    /* 「運営だけに見せる」。★触る所を44px確保する（checkbox 単体では小さすぎる）。 */
    '.rm-f-p{display:flex;align-items:flex-start;gap:9px;margin-top:13px;padding:7px 9px;',
    '  min-height:44px;border-radius:var(--pv-r-sm);border:1px solid transparent;',
    '  font-size:.72rem;font-weight:700;color:var(--pv-ink-2);line-height:1.6;cursor:pointer}',
    '.rm-f-p b{display:block;font-size:.66rem;font-weight:600;color:var(--pv-ink-3);',
    '  line-height:1.7;margin-top:2px}',
    '.rm-f-p input{flex:none;width:18px;height:18px;margin-top:2px;accent-color:var(--pv-orange)}',
    '.rm-f-p:hover{background:var(--pv-line-soft);border-color:var(--pv-line)}',
    '.rm-f-p:active{background:var(--pv-line-soft);border-color:var(--pv-ink-3)}',
    '.rm-f-p:focus-within{background:var(--pv-line-soft);border-color:var(--pv-line)}',
    '.rm-f-p input:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',
    '.rm-f-r{display:flex;align-items:center;justify-content:space-between;gap:10px;',
    '  flex-wrap:wrap;margin-top:13px}',
    '.rm-f-c{font-size:.7rem;font-weight:700;color:var(--pv-ink-3);font-variant-numeric:tabular-nums}',
    '.rm-f-c.is-over{color:var(--pv-orange-ink)}',
    '.rm-f-b{min-height:44px;padding:12px 20px;border-radius:999px;border:0;',
    '  background:var(--pv-orange);color:var(--pv-bg);font:inherit;font-size:.78rem;',
    '  font-weight:800;letter-spacing:-.01em;cursor:pointer;',
    '  transition:opacity .18s var(--pv-ease),transform .18s var(--pv-ease)}',
    '.rm-f-b:hover{opacity:.9}',
    '.rm-f-b:focus-visible{outline:2px solid var(--pv-orange);outline-offset:3px}',
    '.rm-f-b:active{transform:scale(.97)}',
    '.rm-f-b[disabled]{opacity:.55;cursor:default;transform:none}',
    '.rm-f-msg{margin-top:11px;font-size:.74rem;line-height:1.75;color:var(--pv-orange-ink)}',
    '.rm-f-msg.is-ok{color:var(--pv-green-ink)}',

    /* コメント。★新しい部品を作らない ── 既存の --pv-* と .rm-* の中で組む。
       畳んでいる間は .rm-c を hidden にするので、初期の1画面は1pxも変わらない。 */
    '.rm-cbtn{display:inline-flex;align-items:center;gap:5px;min-height:30px;padding:4px 10px;',
    '  border-radius:999px;border:1px solid var(--pv-line);background:var(--pv-surface);',
    '  color:var(--pv-ink-3);font:inherit;font-size:.66rem;font-weight:700;cursor:pointer;',
    '  transition:background-color .18s var(--pv-ease),color .18s var(--pv-ease),',
    '  border-color .18s var(--pv-ease)}',
    '.rm-cbtn svg{flex:none}',
    '.rm-cbtn b{font-weight:800;font-variant-numeric:tabular-nums}',
    '.rm-cbtn:hover{border-color:var(--pv-ink-3);color:var(--pv-ink)}',
    '.rm-cbtn:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',
    '.rm-cbtn:active{background:var(--pv-line-soft)}',
    '.rm-cbtn[aria-expanded="true"]{border-color:var(--pv-orange);color:var(--pv-orange-ink);',
    '  background:var(--pv-orange-soft)}',
    '.rm-c{margin-top:11px;padding-top:10px;border-top:1px dashed var(--pv-line)}',
    '.rm-c-note{font-size:.68rem;line-height:1.7;color:var(--pv-ink-3)}',
    '.rm-c-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}',
    '.rm-c-i{padding:8px 10px;border-radius:var(--pv-r-sm);background:var(--pv-surface);',
    '  border:1px solid var(--pv-line-soft)}',
    '.rm-c-i.is-hidden{opacity:.5}',
    '.rm-c-h{display:flex;align-items:center;gap:7px;flex-wrap:wrap}',
    /* 名乗り。★出るのは 投稿者 / 運営 / 匿名N だけ。誰かに辿れる語を足さない。 */
    '.rm-c-w{font-size:.63rem;font-weight:800;letter-spacing:.01em;padding:2px 8px;',
    '  border-radius:999px;background:var(--pv-line-soft);color:var(--pv-ink-2)}',
    '.rm-c-w.is-author{background:var(--pv-orange-soft);color:var(--pv-orange-ink)}',
    '.rm-c-w.is-staff{background:var(--pv-ink);color:var(--pv-surface)}',
    '.rm-c-me{font-size:.62rem;font-weight:700;color:var(--pv-ink-3)}',
    '.rm-c-h .ymd{font-size:.63rem;font-weight:600;color:var(--pv-ink-3)}',
    '.rm-c-t{margin-top:5px;font-size:.72rem;line-height:1.75;color:var(--pv-ink);',
    '  white-space:pre-wrap;overflow-wrap:anywhere}',
    '.rm-c-x{margin-top:6px;padding:2px 0;border:0;background:none;font:inherit;',
    '  font-size:.64rem;font-weight:700;color:var(--pv-ink-3);cursor:pointer;',
    '  text-decoration:underline;text-underline-offset:3px;',
    '  transition:color .18s var(--pv-ease)}',
    '.rm-c-x:hover{color:var(--pv-ink)}',
    '.rm-c-x:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',
    '.rm-c-x:active{opacity:.7}',
    /* 書く欄。★16px を手で書く。この欄は開いたときに作るので、読み込み時の DOM しか
       見ない assert-header.mjs の目に入らない＝検査の穴。下げると iOS が触った瞬間に
       ページごと拡大して戻らない。高さに transition は付けない（1文字ごとに揺れる）。 */
    '.rm-c-f{margin-top:11px}',
    '.rm-c-ta{display:block;width:100%;padding:9px 11px;border-radius:var(--pv-r-sm);',
    '  border:1px solid var(--pv-line);background:var(--pv-surface-2);color:var(--pv-ink);',
    '  font:inherit;font-size:16px;line-height:1.7;min-height:52px;',
    '  resize:none;overflow-y:hidden}',
    '.rm-c-ta:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',
    '.rm-c-b{margin-top:8px;min-height:40px;padding:10px 18px;border-radius:999px;border:0;',
    '  background:var(--pv-orange);color:var(--pv-bg);font:inherit;font-size:.74rem;',
    '  font-weight:800;letter-spacing:-.01em;cursor:pointer;',
    '  transition:opacity .18s var(--pv-ease),transform .18s var(--pv-ease)}',
    '.rm-c-b:hover{opacity:.9}',
    '.rm-c-b:focus-visible{outline:2px solid var(--pv-orange);outline-offset:3px}',
    '.rm-c-b:active{transform:scale(.97)}',
    '.rm-c-b[disabled]{opacity:.55;cursor:default;transform:none}',
    '.rm-c-msg{margin-top:7px;font-size:.68rem;line-height:1.75;color:var(--pv-orange-ink)}',
    '.rm-c-msg.is-ok{color:var(--pv-green-ink)}',
    /* まだ給与を1件も出していない人に出る門。★責めない。道を1本だけ置く。 */
    '.rm-c-gate{margin-top:11px;padding:9px 11px;border-radius:var(--pv-r-sm);',
    '  background:var(--pv-surface);border:1px dashed var(--pv-line);',
    '  font-size:.68rem;line-height:1.75;color:var(--pv-ink-2)}',
    '.rm-c-cta{display:inline-block;margin-top:3px;font-weight:800;',
    '  color:var(--pv-orange-ink);text-decoration:underline;text-underline-offset:3px;',
    '  transition:color .18s var(--pv-ease)}',
    '.rm-c-cta:hover{color:var(--pv-ink)}',
    '.rm-c-cta:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',
    '.rm-c-cta:active{opacity:.7}',

    '@media(prefers-reduced-motion:reduce){',
    '  .rm-tab,.rm-like,.rm-f-b,.rm-more-btn,.rm-cbtn,.rm-c-b{transition-duration:.01ms}',
    '  .rm-like:active,.rm-f-b:active,.rm-c-b:active{transform:none}}'
  ].join('\n');

  (function injectCSS() {
    var s = d.createElement('style');
    s.setAttribute('data-rm', '1');
    s.textContent = CSS;          // ★textContent。innerHTML は使わない
    d.head.appendChild(s);
  }());

  // ══ 設定から描く（通信を待たない）══════════════════════════
  function heroHTML() {
    var m = CFG.mission || {}, v = CFG.vision || {};
    return '<section class="mr-card is-hero rm-hero">' +
      '<div>' +
        '<span class="rm-eyebrow">' + esc(T.missionK) + '</span>' +
        '<p class="rm-mission">' + esc(m[LANG] || '') + '</p>' +
      '</div>' +
      '<div class="rm-mv-2">' +
        '<span class="rm-eyebrow">' + esc(T.visionK) + '</span>' +
        '<p class="rm-vision">' + esc(v[LANG] || '') + '</p>' +
      '</div>' +
    '</section>';
  }

  /* 現在地のリング。★人数が来るまでは輪だけ（0% を描いて埋めない）。 */
  function ringHTML(n, goal) {
    var R = 33, C = 2 * Math.PI * R;
    var has = (typeof n === 'number') && (typeof goal === 'number') && goal > 0;
    var pct = has ? Math.max(0, Math.min(100, n / goal * 100)) : 0;
    var on = C * pct / 100;
    var mid = has ? fmt(n) : '…';
    return '<svg class="rm-ring-s" viewBox="0 0 86 86" width="86" height="86" role="img" ' +
      'aria-label="' + esc(has ? T.barLabel(fmt(n), fmt(goal)) : T.countPending) + '">' +
      '<circle cx="43" cy="43" r="' + R + '" fill="none" stroke-width="8" ' +
        'style="stroke:var(--pv-line-soft)"/>' +
      (has ? '<circle cx="43" cy="43" r="' + R + '" fill="none" stroke-width="8" ' +
        'stroke-linecap="round" transform="rotate(-90 43 43)" ' +
        'stroke-dasharray="' + on.toFixed(1) + ' ' + (C - on).toFixed(1) + '" ' +
        'style="stroke:var(--pv-orange)"/>' : '') +
      '<text class="rm-ring-v" x="43" y="' + (has ? 40 : 43) + '" text-anchor="middle" ' +
        'dominant-baseline="central">' + esc(mid) + '</text>' +
      (has ? '<text class="rm-ring-p" x="43" y="56" text-anchor="middle" ' +
        'dominant-baseline="central">' + esc(Math.round(pct) + '%') + '</text>' : '') +
    '</svg>';
  }

  function progHTML() {
    return '<section class="mr-card rm-prog">' +
      '<span class="rm-cnt-k">' + esc(T.countK) + '</span>' +
      '<div class="rm-ring" id="rm-ring">' + ringHTML(null, null) + '</div>' +
      '<div id="rm-count-next"></div>' +
      '<span class="rm-cnt-n">' + esc(T.countNote) + '</span>' +
    '</section>';
  }

  function growthHTML() {
    return '<section class="mr-card rm-growth">' +
      '<div class="mr-card-h"><h2 class="mr-card-t">' + esc(T.growthH) + '</h2>' +
      '<span class="mr-card-s">' + esc(T.growthS) + '</span></div>' +
      '<div class="rm-chart" id="rm-chart">' +
        '<div class="mr-skel" style="height:134px"></div></div>' +
    '</section>';
  }

  function wantHTML() {
    return '<section class="mr-card rm-want">' +
      '<div class="mr-card-h"><h2 class="mr-card-t">' + esc(T.wantH) + '</h2>' +
      '<span class="mr-card-s">' + esc(T.wantS) + '</span></div>' +
      '<div id="rm-want"><div class="mr-skel" style="height:150px"></div></div>' +
    '</section>';
  }

  /* 目標の段。★現在地はサーバの人数が来てから入れる（0 を置いて埋めない）。 */
  function railHTML() {
    var lis = MILE.map(function (g) {
      var v = txt(findGoal(g) || {});
      return '<li data-rm-goal="' + g + '">' +
        '<i class="rm-dot" aria-hidden="true"></i>' +
        '<b>' + fmt(g) + '</b><span>' + esc(v.t || '') + '</span></li>';
    }).join('');
    return '<section class="mr-card">' +
      '<div class="mr-card-h"><h2 class="mr-card-t">' + esc(T.mlH) + '</h2>' +
      '<span class="mr-card-s">' + esc(T.mlNote) + '</span></div>' +
      '<ol class="rm-rail" id="rm-ml-g">' + lis + '</ol>' +
      '<p class="rm-ml-d" id="rm-ml-d"></p>' +
    '</section>';
  }

  function findGoal(n) {
    var g = CFG.goals || [];
    for (var i = 0; i < g.length; i++) if (g[i].n === n) return g[i];
    return null;
  }
  function tasksBy(state2) {
    return (CFG.tasks || []).filter(function (t) { return t.state === state2; });
  }

  var ORDER = { building: 0, planned: 1, considering: 2 };
  /* ★ ORDER[x] || 9 と書かない。building は 0 で falsy なので 9 に化け、
     開発中が一番下に落ちる（画面は普通に出たまま並びだけ逆になる）。 */
  function rank(s) { return Object.prototype.hasOwnProperty.call(ORDER, s) ? ORDER[s] : 9; }

  function tasksHTML() {
    var live = (CFG.tasks || []).filter(function (t) { return t.state !== 'done'; })
      .sort(function (a, b) { return rank(a.state) - rank(b.state); });
    var body = live.length ? '<ul class="rm-list">' + live.map(function (t) {
      var v = txt(t), st = t.state;
      var lab = st === 'building' ? T.stBuilding : st === 'planned' ? T.stPlanned : T.stConsidering;
      var sym = st === 'building' ? '●' : st === 'planned' ? '○' : '?';
      return '<li class="rm-task">' +
        '<span class="rm-tag is-' + st + '"><span aria-hidden="true">' + sym + '</span>' +
        esc(lab) + '</span>' +
        '<div class="rm-task-b">' +
          '<p class="rm-task-t">' + esc(v.t || '') +
          (t.community ? '<span class="rm-chipc">' + esc(T.fromCommunity) + '</span>' : '') + '</p>' +
          (v.d ? '<p class="rm-task-d">' + esc(v.d) + '</p>' : '') +
        '</div>' +
      '</li>';
    }).join('') + '</ul>' : '<p class="rm-empty">' + esc(T.shipEmpty) + '</p>';

    return '<section class="mr-card rm-tasks">' +
      '<div class="mr-card-h"><h2 class="mr-card-t">' + esc(T.tasksH) + '</h2>' +
      '<span class="mr-card-s">' +
        esc(T.tasksS(fmt(tasksBy('building').length), fmt(tasksBy('done').length))) +
      '</span></div>' + body + '</section>';
  }

  function shipHTML() {
    var done = tasksBy('done').slice().sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
    if (!done.length) {
      return '<section class="mr-card rm-ship-c">' +
        '<div class="mr-card-h"><h2 class="mr-card-t">' + esc(T.shipH) + '</h2></div>' +
        '<p class="rm-empty">' + esc(T.shipEmpty) + '</p></section>';
    }
    function row(t) {
      var v = txt(t);
      return '<li><span class="ymd">' + esc(ym(t.date)) + '</span>' +
             '<span class="ck" aria-hidden="true">✓</span>' +
             '<span class="t">' + esc(v.t || '') + '</span></li>';
    }
    var head = done.slice(0, 5).map(row).join('');
    var rest = done.slice(5);
    return '<section class="mr-card rm-ship-c">' +
      '<div class="mr-card-h"><h2 class="mr-card-t">' + esc(T.shipH) + '</h2></div>' +
      '<ul class="rm-ship">' + head + '</ul>' +
      (rest.length ? '<details class="mr-more"><summary>' + esc(T.shipMore) + '</summary>' +
        '<ul class="rm-ship" style="margin-top:10px">' + rest.map(row).join('') + '</ul>' +
       '</details>' : '') +
    '</section>';
  }

  function leftHTML() {
    return '<div class="rm-row">' + heroHTML() + progHTML() + '</div>' +
           '<div class="rm-row">' + growthHTML() + wantHTML() + '</div>' +
           railHTML() +
           '<div class="rm-row">' + tasksHTML() + shipHTML() + '</div>';
  }

  // ══ 人数と段の現在地 ═══════════════════════════════════════
  function nextMilestone(n) {
    for (var i = 0; i < MILE.length; i++) if (n < MILE[i]) return MILE[i];
    return null;
  }

  /* 人数が届いたときだけ呼ぶ。★届かなければ「確認中」のまま。0 を置いて埋めない。 */
  function paintCount(n) {
    /* ★分母は「次の段」。累計分母にすると「あと77人」が画面の数字から
       検算できなくなる（真下にレールが描いてあるので、段が上がって％が
       戻って見えても読める）。 */
    var goal = nextMilestone(n);
    var ring = $('rm-ring');
    if (ring) ring.innerHTML = ringHTML(n, goal === null ? MILE[MILE.length - 1] : goal);

    var box = $('rm-count-next');
    if (box) {
      box.innerHTML = (goal === null)
        ? '<p class="rm-next"><span>' + esc(T.allDone) + '</span></p>'
        : '<p class="rm-next"><span>' + esc(T.nextK(goal)) + '</span>' +
          '<b>' + esc(T.nextLeft(goal - n)) + '</b></p>';
    }

    var g = $('rm-ml-g');
    if (g) {
      Array.prototype.forEach.call(g.children, function (li) {
        var at = Number(li.getAttribute('data-rm-goal'));
        li.className = (n >= at) ? 'is-on' : (at === goal ? 'is-next' : '');
        var b = li.querySelector('b');
        if (b && n >= at && b.textContent.charAt(0) !== '✓') b.textContent = '✓ ' + b.textContent;
      });
    }
    var dsc = $('rm-ml-d');
    if (dsc) {
      var target = findGoal(goal === null ? MILE[MILE.length - 1] : goal);
      dsc.textContent = target ? (txt(target).d || '') : '';
    }
  }

  // ══ 折れ線 ═════════════════════════════════════════════════
  /* サーバが返すのは [{d:'2026-08-10', n:12}, …] だけ（会社も職位も金額も来ない）。
     ★数え方は pv_deep_contributors() と同じ実人物（2社に出した人も1人）。
       proof_hash で数えると、右端の数字がリングの人数と食い違う。 */
  function paintGrowth() {
    var box = $('rm-chart');
    if (!box || !w.PVViz || !state.growth) return;
    var pts = state.growth.filter(function (r) { return r && typeof r.n === 'number' && r.n > 0; });
    if (!pts.length) { growthError(); return; }
    /* ★札は両端だけ。pay-viz.js の chart() は**全部の点**に <text> を描くので、
       12週ぶん全部に日付を入れると重なって読めなくなる。 */
    pts.forEach(function (r, i) { r.lab = (i === 0 || i === pts.length - 1) ? md(r.d) : ''; });
    box.innerHTML = w.PVViz.chart(pts, null, {
      width: w.PVViz.widthOf(box, box.parentNode),
      valueAt: function (r) { return r.n; },
      labelOf: function (r) { return r.lab || ''; },
      h: 134,
      color: ink('--pv-orange'),
      fmtVal: function (x) { return T.countUnit(fmt(x)); },
      aria: T.growthAria,
      onePoint: T.growthOne,
      noMetric: T.unknown
    });
  }

  function growthError() {
    var box = $('rm-chart');
    if (!box) return;
    box.innerHTML = '';
    box.appendChild(retryP(T.growthErr, loadGrowth));
  }

  function loadGrowth() {
    return rpc('pv_give_growth').then(function (v) {
      if (!v || v.__err || !v.length) { growthError(); return; }
      state.growth = v;
      paintGrowth();
    });
  }

  // ══ 要望の人気（横棒）═════════════════════════════════════
  /* ★並べ替えのタブで作り直さない。人気順で1回だけ取った並びを持ち、
     ♡ が動いたら数と幅だけ書き換える（棒が指の下で並び替わらない）。 */
  function paintWant() {
    var box = $('rm-want');
    if (!box) return;
    var top = state.top || [];
    box.innerHTML = '';
    if (!top.length) {
      var e = d.createElement('p');
      e.className = 'rm-empty';
      e.textContent = T.listEmpty;
      box.appendChild(e);
      return;
    }
    var max = 0;
    top.forEach(function (it) { if (it.like_count > max) max = it.like_count; });
    var ul = d.createElement('ul');
    ul.className = 'rm-wbars';
    top.forEach(function (it) {
      var li = d.createElement('li');
      var r = d.createElement('div');
      r.className = 'rm-wr';
      var t = d.createElement('span');
      t.className = 'rm-wt';
      t.textContent = it.body || '';        // ★ここも textContent
      var n = d.createElement('span');
      n.className = 'rm-wn';
      n.textContent = fmt(it.like_count);
      r.appendChild(t);
      r.appendChild(n);
      var bar = d.createElement('span');
      bar.className = 'rm-wb';
      var i = d.createElement('i');
      i.style.width = (max > 0 ? Math.max(5, Math.round(it.like_count / max * 100)) : 5) + '%';
      bar.appendChild(i);
      li.appendChild(r);
      li.appendChild(bar);
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  // ══ 要望の一覧 ═════════════════════════════════════════════
  var HEART =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>';

  var BUBBLE =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    + 'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-2.8-.4L3 21l1.6-4.8A8.2 8.2 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"/></svg>';

  var state = { sort: 'popular', offset: 0, total: null, admin: false,
                items: [], top: null, growth: null, img: null };

  /* 1件ぶんの DOM を組む。
     ★本文だけは textContent。ここが崩れると要望欄が XSS の口になる。 */
  function reqNode(it) {
    var li = d.createElement('li');
    li.className = 'rm-req' + (it.is_hidden ? ' is-hidden' : '');
    li.setAttribute('data-rm-id', it.id);

    var btn = d.createElement('button');
    btn.type = 'button';
    btn.className = 'rm-like';
    btn.setAttribute('data-rm-like', it.id);
    btn.setAttribute('aria-pressed', it.liked_by_me ? 'true' : 'false');
    btn.setAttribute('aria-label', T.likeLabel(it.like_count, !!it.liked_by_me));
    btn.innerHTML = HEART + '<b>' + fmt(it.like_count) + '</b>';

    var body = d.createElement('div');
    body.className = 'rm-req-b';

    var p = d.createElement('p');
    p.className = 'rm-req-t';
    p.textContent = it.body || '';        // ★ここ
    body.appendChild(p);

    /* 長いものは3行で畳んである。★切り捨てない ── 開けば全文が読める。 */
    if (String(it.body || '').length > 52) {
      var tg = d.createElement('button');
      tg.type = 'button';
      tg.className = 'rm-open';
      tg.textContent = T.openMore;
      tg.setAttribute('aria-expanded', 'false');
      tg.addEventListener('click', function () {
        var on = !p.classList.contains('is-open');
        p.classList.toggle('is-open', on);
        tg.setAttribute('aria-expanded', on ? 'true' : 'false');
        tg.textContent = on ? T.openLess : T.openMore;
      });
      body.appendChild(tg);
    }

    var meta = d.createElement('div');
    meta.className = 'rm-req-m';
    var cat = d.createElement('span');
    cat.className = 'rm-tag is-considering';
    cat.textContent = (T.cat[it.category] || T.cat.other);
    meta.appendChild(cat);

    var st = d.createElement('span');
    st.className = 'rm-tag is-' + (STATES.indexOf(it.status) >= 0 ? it.status : 'new');
    st.textContent = (T.st[it.status] || T.st['new']);
    meta.appendChild(st);

    var when = d.createElement('span');
    when.className = 'ymd';
    when.textContent = ym(it.created_at);
    meta.appendChild(when);

    /* ★この行がそもそも返ってきているのは、自分の行か運営のときだけ
       （見えるかの判定はサーバの pv_req_visible ただ1つ）。だから札も自然にそこだけ出る。 */
    if (it.visibility === 'private') {
      var pv = d.createElement('span');
      pv.className = 'rm-tag is-private';
      pv.textContent = T.tagPrivate;
      meta.appendChild(pv);
    }

    if (it.is_hidden) {
      var h = d.createElement('span');
      h.className = 'rm-tag is-declined';
      h.textContent = T.adminHidden;
      meta.appendChild(h);
    }
    body.appendChild(meta);

    /* 添付の絵。★確認前のものは第三者に「あることすら」出さない
       （サーバが image:'none' を返すので、ここへ来た時点でその心配は無い）。 */
    if (it.image === 'public' || it.image === 'pending') attachImage(body, it);

    /* コメント。★入口だけを札の列に置き、中身は押されるまで作らない。
       畳んでいる間の高さは 0（.rm-c は hidden）＝1画面の見た目は変わらない。 */
    var cbox = d.createElement('div');
    cbox.className = 'rm-c';
    cbox.hidden = true;
    meta.appendChild(commentChip(cbox, it));
    body.appendChild(cbox);

    /* ★管理用の操作は、管理者のときだけ DOM に足す。
       一般ユーザーの画面には要素として存在させない（隠すのではなく作らない）。 */
    if (state.admin) body.appendChild(adminNode(it));

    li.appendChild(btn);
    li.appendChild(body);
    return li;
  }

  /* ══ コメント ══════════════════════════════════════════════
     ★一覧には本文が来ていない。開いた1行のぶんだけ取りにいく
       （「一覧を全件ブラウザへ投げない」の約束はコメントにも掛かる）。
     ★名乗りは who と n だけ。author_hash はサーバの返り値にそもそも入っていない。
     ★本文は必ず textContent。ここが1か所崩れると、要望欄と同じ口が開く。 */
  function commentChip(box, it) {
    var b = d.createElement('button');
    b.type = 'button';
    b.className = 'rm-cbtn';
    b.setAttribute('aria-expanded', 'false');
    b.innerHTML = BUBBLE + '<b></b>';        // ★定数だけ。利用者の文字は入れない
    var num = b.querySelector('b');
    var loaded = false;
    function relabel() {
      var n = it.comment_count || 0;
      num.textContent = fmt(n);
      b.setAttribute('aria-label', T.cLabel(n));
    }
    relabel();
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', on ? 'true' : 'false');
      box.hidden = !on;
      if (!on || loaded) return;
      loaded = true;
      loadComments(box, it, relabel);
    });
    return b;
  }

  function loadComments(box, it, relabel) {
    box.textContent = '';
    var wait = d.createElement('p');
    wait.className = 'rm-c-note';
    wait.textContent = T.cLoading;
    box.appendChild(wait);
    rpc('pv_request_comments_list', { p_id: it.id }).then(function (v) {
      if (!v || v.__err || v.ok !== true || !v.items) { wait.textContent = T.cErr; return; }
      /* ★件数はサーバが数えたものに置き換える。ここで足し引きして作らない。 */
      if (typeof v.total === 'number') it.comment_count = v.total;
      relabel();
      paintComments(box, it, v, relabel);
    });
  }

  function paintComments(box, it, v, relabel) {
    box.textContent = '';
    var none = d.createElement('p');
    none.className = 'rm-c-note';
    none.textContent = T.cEmpty;
    if (!v.items.length) box.appendChild(none);

    var ul = d.createElement('ul');
    ul.className = 'rm-c-list';
    v.items.forEach(function (c) { ul.appendChild(commentNode(c)); });
    box.appendChild(ul);

    /* 書けるかはサーバが決める（pv_my_give の basic）。
       ★書けない人には欄そのものを作らない。出すのは道1本だけ。 */
    if (v.can_write) {
      box.appendChild(commentForm(it, function (c) {
        if (none.parentNode) none.parentNode.removeChild(none);
        ul.appendChild(commentNode(c));
        it.comment_count = (it.comment_count || 0) + 1;
        relabel();
      }));
    } else {
      box.appendChild(commentGate());
    }
  }

  function commentNode(c) {
    var li = d.createElement('li');
    li.className = 'rm-c-i' + (c.is_hidden ? ' is-hidden' : '');

    var h = d.createElement('div');
    h.className = 'rm-c-h';
    var who = d.createElement('span');
    var kind = (WHO.indexOf(c.who) >= 0) ? c.who : 'anon';
    who.className = 'rm-c-w is-' + kind;
    who.textContent = kind === 'author' ? T.cAuthor
                    : kind === 'staff' ? T.cStaff
                    : T.cAnon(c.n || 0);
    h.appendChild(who);
    if (c.mine) {
      var me = d.createElement('span');
      me.className = 'rm-c-me';
      me.textContent = T.cMine;
      h.appendChild(me);
    }
    var when = d.createElement('span');
    when.className = 'ymd';
    when.textContent = ym(c.created_at);
    h.appendChild(when);
    li.appendChild(h);

    var p = d.createElement('p');
    p.className = 'rm-c-t';
    p.textContent = c.body || '';        // ★ここ
    li.appendChild(p);

    /* ★管理用の操作は管理者のときだけ DOM に足す（隠すのではなく作らない）。
       消す口は作らない ── 伏せるだけ（サーバにも delete は無い）。 */
    if (state.admin) {
      var x = d.createElement('button');
      x.type = 'button';
      x.className = 'rm-c-x';
      x.textContent = c.is_hidden ? T.adminShow : T.adminHide;
      x.addEventListener('click', function () {
        var next = !c.is_hidden;
        x.disabled = true;
        rpc('pv_request_comment_set_hidden', { p_id: c.id, p_hidden: next })
          .then(function (v) {
            x.disabled = false;
            if (!v || v.__err || v.ok !== true) { say(T.adminErr); return; }
            c.is_hidden = next;
            li.classList.toggle('is-hidden', next);
            x.textContent = next ? T.adminShow : T.adminHide;
          });
      });
      li.appendChild(x);
    }
    return li;
  }

  /* 給与を1件も出していない人に出る門。Give → Get をここでも同じ形で守る。 */
  function commentGate() {
    var p = d.createElement('p');
    p.className = 'rm-c-gate';
    p.textContent = T.cNeed + ' ';
    var a = d.createElement('a');
    a.className = 'rm-c-cta';
    a.href = 'pay-report.html';       /* ★日英とも同じ階層に居る。相対で足りる */
    a.textContent = T.cNeedCta;
    p.appendChild(a);
    return p;
  }

  function commentForm(it, onAdd) {
    var f = d.createElement('form');
    f.className = 'rm-c-f';

    var ta = d.createElement('textarea');
    ta.className = 'rm-c-ta';
    ta.rows = 2;
    ta.maxLength = 500;
    ta.placeholder = T.cPh;
    ta.setAttribute('aria-label', T.cPh);
    ta.addEventListener('input', function () { growEl(ta); });
    f.appendChild(ta);

    var b = d.createElement('button');
    b.type = 'submit';
    b.className = 'rm-c-b';
    b.textContent = T.cSend;
    f.appendChild(b);

    var msg = d.createElement('p');
    msg.className = 'rm-c-msg';
    f.appendChild(msg);
    function show(text, okFlag) {
      msg.className = 'rm-c-msg' + (okFlag ? ' is-ok' : '');
      msg.textContent = text;
      say(text);
    }

    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var body = String(ta.value || '').trim();
      if (body.length < 2) { show(T.cErrShort, false); return; }
      if (body.length > 500) { show(T.errLong, false); return; }
      b.disabled = true;
      show(T.sending, false);
      rpc('pv_request_comment_add', { p_id: it.id, p_body: body }).then(function (v) {
        b.disabled = false;
        if (!v || v.__err) { show(T.errSend, false); return; }
        if (v.ok !== true) {
          show(v.status === 'need_give' ? T.cNeed
             : v.status === 'too_fast' ? T.errFast
             : v.status === 'rate_limited' ? T.cErrMany
             : v.status === 'duplicate' ? T.cErrDup : T.errSend, false);
          return;
        }
        ta.value = '';
        growEl(ta);
        show(T.cSent, true);
        if (v.item) onAdd(v.item);
      });
    });
    return f;
  }

  function adminNode(it) {
    var wrap = d.createElement('div');
    wrap.className = 'rm-admin';
    var k = d.createElement('span');
    k.className = 'rm-admin-k';
    k.textContent = T.adminH;
    wrap.appendChild(k);

    var sel = d.createElement('select');
    sel.setAttribute('aria-label', T.adminH);
    STATES.forEach(function (s) {
      var o = d.createElement('option');
      o.value = s;
      o.textContent = T.st[s];
      if (s === it.status) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () { setStatus(it, sel, sel.value); });
    wrap.appendChild(sel);

    var hide = d.createElement('button');
    hide.type = 'button';
    hide.textContent = it.is_hidden ? T.adminShow : T.adminHide;
    hide.addEventListener('click', function () { setHidden(it, !it.is_hidden); });
    wrap.appendChild(hide);

    /* 絵の門。★ここだけが 'public' にできる（サーバも pv_is_admin() で同じ門を持つ）。
       'rejected' にすると画素そのものが消える＝承認後のすり替えの道も残らない。 */
    if (it.image === 'pending' || it.image === 'public') {
      if (it.image === 'public') {
        var sh = d.createElement('span');
        sh.className = 'rm-admin-k';
        sh.textContent = T.imgShown;
        wrap.appendChild(sh);
      } else {
        var yes = d.createElement('button');
        yes.type = 'button';
        yes.textContent = T.imgOpen;
        yes.addEventListener('click', function () { setImage(it, 'public'); });
        wrap.appendChild(yes);
      }
      var no = d.createElement('button');
      no.type = 'button';
      no.textContent = T.imgReject;
      no.addEventListener('click', function () { setImage(it, 'rejected'); });
      wrap.appendChild(no);
    }
    return wrap;
  }

  function paintList() {
    var ul = $('rm-req-list');
    if (!ul) return;
    ul.innerHTML = '';
    if (!state.items.length) {
      var p = d.createElement('p');
      p.className = 'rm-empty';
      p.textContent = T.listEmpty;
      ul.appendChild(p);
    } else {
      state.items.forEach(function (it) { ul.appendChild(reqNode(it)); });
    }
    var more = $('rm-more');
    if (more) {
      var left = (state.total || 0) - state.items.length;
      more.style.display = left > 0 ? 'block' : 'none';
      more.textContent = T.listMore + (left > 0
        ? (LANG === 'en' ? ' (' + fmt(left) + ')' : '（' + fmt(left) + '）') : '');
    }
  }

  function paintTotal() {
    var k = $('rm-list-n');
    if (k) k.textContent = (state.total === null) ? T.unknown : T.listS(state.total);
  }

  // ══ 通信 ═══════════════════════════════════════════════════
  function client() {
    /* 他の画面と同じく、別の <script> が宣言した const sb を try で拾う。 */
    var c = null;
    try { c = sb; } catch (e) { c = null; }
    return (c && typeof c.rpc === 'function') ? c : null;
  }

  function rpc(name, args) {
    var c = client();
    if (!c) return Promise.resolve(null);
    var q;
    try { q = args ? c.rpc(name, args) : c.rpc(name); } catch (e) { return Promise.resolve(null); }
    if (!q || typeof q.then !== 'function') return Promise.resolve(null);
    return q.then(function (r) {
      if (!r) return null;
      if (r.error) return { __err: r.error };
      return r.data == null ? null : r.data;    // ★null で落ちない
    }, function (e) { return { __err: e }; });
  }

  function loadCount() {
    return rpc('pv_give_progress').then(function (v) {
      if (!v || v.__err || typeof v.contributors !== 'number') return;
      paintCount(v.contributors);
      /* ★左メニューの DEEP PAY にも同じ数を渡す。渡さないと、あちらが
         押されたときにもう一度同じ RPC を投げ、しかもリングと違う数を
         出しうる（間に投稿があれば実際に食い違う）。 */
      if (w.PVGates && typeof w.PVGates.setProgress === 'function') {
        w.PVGates.setProgress({
          n: v.contributors,
          detailed: (v.give && typeof v.give.detailed === 'boolean') ? v.give.detailed : null
        });
      }
    });
  }

  function loadList(append) {
    var ul = $('rm-req-list');
    if (!append && ul) {
      ul.innerHTML = '<div class="mr-skel" style="height:74px"></div>'
                   + '<div class="mr-skel" style="height:74px;margin-top:10px"></div>';
    }
    return rpc('pv_requests_list',
               { p_sort: state.sort, p_limit: PAGE, p_offset: append ? state.offset : 0 })
      .then(function (v) {
        if (!v || v.__err || !v.items) {
          if (!append) listError();
          return;
        }
        state.total  = (typeof v.total === 'number') ? v.total : state.total;
        state.items  = append ? state.items.concat(v.items) : v.items.slice();
        state.offset = state.items.length;
        /* 横棒は「人気順で最初に取った並び」だけを持つ。
           ★新着順に切り替えたときに作り直さない（人気の棒ではなくなる）。 */
        if (!append && state.sort === 'popular') {
          state.top = state.items.slice(0, TOPN);
          paintWant();
        }
        paintTotal();
        paintList();
      });
  }

  /* 取れなかったときは「—」と読み直し。★0 と書かない（本当に0件だと読める）。 */
  function retryP(msg, again) {
    var p = d.createElement('p');
    p.className = 'rm-empty';
    p.textContent = T.unknown + ' ' + msg + ' ';
    var b = d.createElement('button');
    b.type = 'button';
    b.className = 'rm-retry';
    b.textContent = T.retry;
    b.addEventListener('click', again);
    p.appendChild(b);
    return p;
  }

  function listError() {
    var again = function () { state.offset = 0; loadList(false); };
    var ul = $('rm-req-list');
    if (ul) { ul.innerHTML = ''; ul.appendChild(retryP(T.listErr, again)); }
    var wb = $('rm-want');
    if (wb && !state.top) { wb.innerHTML = ''; wb.appendChild(retryP(T.listErr, again)); }
    paintTotal();
  }

  // ══ ♡ ═════════════════════════════════════════════════════
  function onLike(btn) {
    if (btn.getAttribute('data-busy') === '1') return;
    var id = btn.getAttribute('data-rm-like');
    var it = null;
    for (var i = 0; i < state.items.length; i++) if (state.items[i].id === id) it = state.items[i];
    if (!it) return;

    var wasOn = !!it.liked_by_me, wasN = it.like_count;
    btn.setAttribute('data-busy', '1');

    /* 見た目だけ先に動かす。
       ★並べ替えはしない。人気順で行が指の下で動くと、次の指が別の要望を押す。 */
    applyLike(btn, it, wasOn ? wasN - 1 : wasN + 1, !wasOn);

    rpc('pv_request_like_toggle', { p_id: id }).then(function (v) {
      btn.removeAttribute('data-busy');
      if (!v || v.__err || typeof v.like_count !== 'number') {
        applyLike(btn, it, wasN, wasOn);          // ★失敗したら元に戻す
        say(T.likeErr);
        return;
      }
      applyLike(btn, it, v.like_count, !!v.liked_by_me);   // サーバの実数で上書き
      say(T.likeLabel(v.like_count, !!v.liked_by_me));
    });
  }

  function applyLike(btn, it, n, on) {
    it.like_count = n;
    it.liked_by_me = on;
    var b = btn.querySelector('b');
    if (b) b.textContent = fmt(n);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', T.likeLabel(n, on));
    syncWant(it);
  }

  /* 横棒に同じ要望が出ていたら、数と幅も同じ値にする。
     ★棒の並びは変えない（人気順で並べ直すと読んでいる棒が動く）。 */
  function syncWant(it) {
    var top = state.top;
    if (!top) return;
    var hit = false;
    for (var i = 0; i < top.length; i++) {
      if (top[i].id === it.id) { top[i].like_count = it.like_count; hit = true; }
    }
    if (hit) paintWant();
  }

  // ══ 管理者の操作 ═══════════════════════════════════════════
  function setStatus(it, sel, next) {
    var before = it.status;
    rpc('pv_request_set_status', { p_id: it.id, p_status: next }).then(function (v) {
      if (!v || v.__err) { sel.value = before; say(T.adminErr); return; }
      it.status = next;
      paintList();
      say(T.st[next]);
    });
  }
  function setHidden(it, next) {
    rpc('pv_request_set_hidden', { p_id: it.id, p_hidden: next }).then(function (v) {
      if (!v || v.__err) { say(T.adminErr); return; }
      it.is_hidden = next;
      paintList();
      say(next ? T.adminHidden : T.adminShow);
    });
  }

  function setImage(it, next) {
    if (IMGST.indexOf(next) < 0) return;   /* 白リストの外は投げない */
    rpc('pv_request_set_image_state', { p_id: it.id, p_state: next }).then(function (v) {
      if (!v || v.__err || v.ok !== true) { say(T.adminErr); return; }
      it.image = next;
      it.imgSrc = null;          /* ★見送ったら手元の写しも捨てる */
      paintList();
      say(next === 'public' ? T.imgShown : T.imgReject);
    });
  }

  // ══ 添付の絵 ═══════════════════════════════════════════════
  /* 端末の中で JPEG に焼き直してから送る。★EXIF の位置情報が落ちるのは、この
     描き直しの副作用であって専用のコードは無い（payslip.js と同じ理屈）。
     同時に、出てくるのが必ず JPEG になるので、SVG のような「絵の顔をした HTML」が
     原理的に入らない。
     ⚠️ 画素に写り込んだ氏名・社員番号・会社名・金額は落ちない。だから運営が1回見る。
     この門を外すと、この機能はサイトの土台（匿名性）に反する。 */
  var IMG_MAX  = 500000;                        // ★SQL の pv_request_images_len_ck と同じ数
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

  /* 上限に収まるまで画質を1段ずつ落とす。★勝手に諦めない・勝手に巨大なものを送らない。 */
  function encodeAt(cv, i) {
    return new Promise(function (done, fail) {
      cv.toBlob(function (b) {
        if (!b) { fail(new Error('type')); return; }
        if (b.size <= IMG_MAX || i >= IMG_Q.length - 1) { done(b); return; }
        encodeAt(cv, i + 1).then(done, fail);
      }, 'image/jpeg', IMG_Q[i]);
    });
  }

  function shrinkImage(file) {
    return new Promise(function (done, fail) {
      if (!file || String(file.type || '').indexOf('image/') !== 0) {
        fail(new Error('type')); return;
      }
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
        /* ★先に白で塗る。透過の PNG をそのまま JPEG にすると、抜けた所が黒く潰れる。 */
        cx.fillStyle = 'white';
        cx.fillRect(0, 0, cw, ch);
        cx.drawImage(im, 0, 0, cw, ch);
        encodeAt(cv, 0).then(function (b) {
          if (b.size > IMG_MAX) throw new Error('big');
          return toB64(b).then(function (b64) {
            if (!b64) throw new Error('type');
            done({ b64: b64, w: cw, h: ch, kb: Math.round(b.size / 1024) });
          });
        }).then(null, fail);
      };
      im.src = url;
    });
  }

  function clearImage() {
    state.img = null;
    var f = $('rm-img'), n = $('rm-img-n'), p = $('rm-img-p'), b = $('rm-img-b');
    if (f) f.value = '';
    if (n) n.textContent = '';
    if (b) b.textContent = T.imgAdd;
    if (p) { p.innerHTML = ''; p.hidden = true; }
  }

  function wireImage() {
    var f = $('rm-img'), b = $('rm-img-b'), n = $('rm-img-n'), p = $('rm-img-p');
    if (!f || !b) return;
    /* ★file 入力そのものは見せない（OS ごとに見た目が違い、触る所も小さい）。 */
    b.addEventListener('click', function () { f.click(); });
    f.addEventListener('change', function () {
      var file = f.files && f.files[0];
      if (!file) { clearImage(); return; }
      if (n) n.textContent = T.imgReading;
      shrinkImage(file).then(function (r) {
        state.img = { b64: r.b64, w: r.w, h: r.h };
        if (n) n.textContent = T.imgReady(r.kb);
        b.textContent = T.imgChange;
        if (!p) return;
        p.innerHTML = '';
        p.hidden = false;
        var im = d.createElement('img');
        im.alt = T.imgAlt;
        im.src = 'data:image/jpeg;base64,' + r.b64;
        p.appendChild(im);
        var x = d.createElement('button');
        x.type = 'button';
        x.className = 'rm-f-x';
        x.textContent = T.imgDrop;
        x.addEventListener('click', function () { clearImage(); b.focus(); });
        p.appendChild(x);
        say(T.imgReady(r.kb));
      }, function (e) {
        clearImage();
        var text = (e && e.message === 'big') ? T.imgErrBig : T.imgErrType;
        var m = $('rm-msg');
        if (m) { m.textContent = text; m.className = 'rm-f-msg'; }
        say(text);
      });
    });
  }

  /* 一覧の絵は、行ごとに後から取る。★一覧の返事に画素を載せない
     （「一覧を全件ブラウザへ投げない」の約束は、絵でこそ効く）。 */
  function attachImage(body, it) {
    var box = d.createElement('div');
    box.className = 'rm-req-img';
    body.appendChild(box);

    if (it.image === 'pending') {
      var note = d.createElement('span');
      note.className = 'rm-img-w';
      note.textContent = T.imgWait + '　' + T.imgWaitNote;
      box.appendChild(note);
    }
    if (it.imgSrc) { putImg(box, it); return; }

    rpc('pv_request_image', { p_id: it.id }).then(function (v) {
      if (!v || v.__err || v.ok !== true || !v.b64) {
        if (box.parentNode) box.parentNode.removeChild(box);
        return;
      }
      it.imgSrc = 'data:' + (v.mime || 'image/jpeg') + ';base64,' + v.b64;
      it.imgW = v.w; it.imgH = v.h;
      /* 取っている間に ♡ などで描き直されているかもしれない。★今ある箱に描く。 */
      var live = d.querySelector('[data-rm-id="' + String(it.id).replace(/"/g, '') +
                                 '"] .rm-req-img');
      putImg(live || box, it);
    });
  }

  function putImg(box, it) {
    if (!box || box.querySelector('img')) return;
    var im = d.createElement('img');
    im.alt = T.imgAlt;
    /* ★loading='lazy' は付けない。中身はもう data: で手元にあり、遅らせる得が無い
       ぶん、画面の下のほうの絵が空の枠のままになる形だけが残る。 */
    /* 縦横を先に入れておく。★読み終わった瞬間に下の行が飛び跳ねない。 */
    if (it.imgW && it.imgH) { im.width = it.imgW; im.height = it.imgH; }
    im.src = it.imgSrc;
    box.insertBefore(im, box.firstChild);
  }

  // ══ 送信 ═══════════════════════════════════════════════════
  function wireForm() {
    var form = $('rm-form'), ta = $('rm-body'), cat = $('rm-cat'),
        btn  = $('rm-send'), cnt = $('rm-count-c'), msg = $('rm-msg'),
        priv = $('rm-priv');
    if (!form || !ta || !btn) return;

    function count() {
      var n = ta.value.length;
      if (cnt) {
        cnt.textContent = n + ' / 500';
        cnt.className = 'rm-f-c' + (n > 500 ? ' is-over' : '');
      }
    }
    function onType() { count(); growTa(); }
    ta.addEventListener('input', onType);
    onType();

    function show(text, okFlag) {
      if (!msg) return;
      msg.textContent = text;
      msg.className = 'rm-f-msg' + (okFlag ? ' is-ok' : '');
      say(text);
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var body = ta.value.replace(/^\s+|\s+$/g, '');
      if (body.length < 4) { show(T.errShort, false); ta.focus(); return; }
      if (body.length > 500) { show(T.errLong, false); ta.focus(); return; }

      btn.disabled = true;
      show(T.sending, false);

      /* ★絵は「送るときの1回」だけ渡す。あとから差し替える口はサーバに無い。 */
      var img = state.img;
      rpc('pv_request_submit', { p_body: body,
                                 p_category: (cat && cat.value) || 'other',
                                 p_private: !!(priv && priv.checked),
                                 p_image_b64: img ? img.b64 : null,
                                 p_w: img ? img.w : null,
                                 p_h: img ? img.h : null })
        .then(function (v) {
          btn.disabled = false;
          if (!v || v.__err) { show(T.errSend, false); return; }
          if (v.ok !== true) {
            show(v.status === 'too_fast' ? T.errFast
               : v.status === 'rate_limited' ? T.errLimit
               : v.status === 'image_bad' ? T.imgErrType
               : v.status === 'image_too_big' ? T.imgErrBig
               : v.status === 'duplicate' ? T.errDup : T.errSend, false);
            return;   // ★本文は消さない（書き直せるように残す）
          }
          ta.value = '';
          /* ★次の1件が黙って「運営だけ」にならないよう、必ず戻す。 */
          if (priv) priv.checked = false;
          clearImage();
          count();
          growTa();
          show(T.sent, true);
          if (v.item) {
            state.items.unshift(v.item);
            state.offset = state.items.length;
            if (typeof state.total === 'number') state.total += 1;
            paintTotal();
            paintList();
            highlight(v.item.id);
          }
        });
    });
  }

  /* 出したものが一覧のどこに入ったかを見せる。
     ★動きを減らす設定のときは、その場で色を付けるだけにする（要素は消さない）。 */
  function highlight(id) {
    var node = d.querySelector('[data-rm-id="' + String(id).replace(/"/g, '') + '"]');
    if (!node) return;
    try { node.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' }); }
    catch (e) { node.scrollIntoView(); }
    node.classList.add('is-new');
    w.setTimeout(function () { node.classList.remove('is-new'); }, 2200);
  }

  /* 書く欄を中身の高さに合わせる。★「常に全文見れるように」（オーナー）。
     scrollHeight は枠線を含まない（* に box-sizing:border-box が効いている）ので、
     offsetHeight - clientHeight ＝ 上下の枠線ぶんを足す。足さないと1文字打つたびに
     2px ずつ足りず、最後の行が半分隠れる。 */
  function growEl(el) {
    if (!el) return;
    var edge = el.offsetHeight - el.clientHeight;
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight + edge) + 'px';
  }
  function growTa() { growEl($('rm-body')); }

  // ══ 並べ替えのタブ ═════════════════════════════════════════
  function wireTabs() {
    var box = $('rm-tabs');
    if (!box) return;
    box.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-rm-sort]') : null;
      if (!b) return;
      var s = b.getAttribute('data-rm-sort');
      if (s === state.sort) return;
      state.sort = s;
      Array.prototype.forEach.call(box.querySelectorAll('[data-rm-sort]'), function (x) {
        x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
      });
      state.offset = 0;
      loadList(false);
    });
  }

  /* 折れ線だけは実寸で組んである（viewBox を伸縮させると文字まで拡大縮小されて
     スマホで読めなくなる）。幅が変わったら組み直す。 */
  function wireResize() {
    var tid = 0, last = 0;
    w.addEventListener('resize', function () {
      growTa();   /* ★折れ線の有無に関わらず、書く欄は必ず取り直す */
      var box = $('rm-chart');
      if (!box || !state.growth) return;
      if (box.clientWidth === last) return;
      last = box.clientWidth;
      w.clearTimeout(tid);
      tid = w.setTimeout(paintGrowth, 180);
    });
  }

  // ══ 起動 ═══════════════════════════════════════════════════
  function boot() {
    var L = $('rm-left');
    if (L) L.innerHTML = leftHTML();

    /* 匿名の説明。★「運営にも誰かわからない」とは書かない
       （ハッシュは運営側で照合できる＝実装と食い違う文言は書かない）。 */
    var pv = $('rm-privacy');
    if (pv) pv.textContent = T.privacy;

    wireForm();
    wireImage();
    wireTabs();
    wireResize();

    var ul = $('rm-req-list');
    if (ul) ul.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-rm-like]') : null;
      if (b) onLike(b);
    });
    var more = $('rm-more');
    if (more) more.addEventListener('click', function () { loadList(true); });

    loadCount();
    loadGrowth();
    /* 管理者かどうかを先に確かめてから一覧を描く。
       あとから分かると、一度描いた行に操作を足すことになり順番が読みにくい。 */
    rpc('pv_is_admin').then(function (v) {
      state.admin = (v === true);
      return loadList(false);
    });
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();

}(window, document));
