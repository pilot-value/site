/* ════════════════════════════════════════════════════════════════
   roadmap.js — ROADMAP & REQUESTS（roadmap.html / en/roadmap.html）

   このファイルがやること
     ① roadmap-config.js の設定を、通信を待たずに描く
        （ミッション・3原則・なぜ・運営が進めていること・目標の段の枠・更新履歴）
     ② サーバに3つだけ聞く
        pv_give_progress()  … 給与を出したパイロットの人数（＝現在地）
        pv_requests_list()  … みんなからの要望と、その総数（＝KPIの1つ）
        pv_is_admin()       … 管理用の操作を出すかどうか
     ③ 要望を出す・♡ を押す

   ★このファイルは数を作らない。画面に出る数は全部サーバが返したもの。
     人数も件数も ♡ の数も、ここで足し引きして表示を作らない
     （♡ だけは押した瞬間に見た目を先に動かすが、サーバの戻りで必ず上書きし、
       失敗したら元に戻す）。

   ★文言は T に集める。HTML 側にはフォームの札しか置かない
     （assert-roadmap.mjs が T.ja と T.en の鍵が完全に同じかを見張る）。

   ★色は --pv-* トークンだけ。hex を1つも書かない。
     ダークは [data-theme="dark"] が勝手に効く。
     ⚠️ prefers-color-scheme はこのリポジトリのどこにも無い。持ち込まない
        （テーマは localStorage['pv-theme'] が唯一の正）。

   ⚠️ 本文（利用者が書いた文字）は必ず textContent で入れる。
      innerHTML に混ぜない。ここが1か所でも崩れると要望欄が XSS の口になる。

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
  var PAGE = 20;                       // 1回に取る要望の数（全件は投げない）

  /* 区分と状態は db/requests.sql の白リストと1対1。
     ★片方だけ増やさない。増やすときは SQL の check 制約と同時に。 */
  var CATS   = ['feature', 'data', 'ui', 'bug', 'other'];
  var STATES = ['new', 'considering', 'planned', 'building', 'done', 'declined'];

  // ══ 文言 ═══════════════════════════════════════════════════
  var DICT = {
    ja: {
      eyebrow: 'OUR MISSION',
      mission: 'パイロットの情報格差をなくし、給与透明性を世界標準にする。',
      missionBody: 'これまで見えなかった給与・福利厚生・勤務条件を可視化し、キャリアの選択肢を広げる。'
                 + '待遇の良い会社に人材が集まり、待遇の悪い会社は改善を迫られる。'
                 + 'その市場原理によって、世界のパイロット待遇を継続的に向上させる。',
      builtWith: 'Built with pilots, for pilots.',

      countK: '給与を出したパイロット',
      countUnit: function (n) { return n + '人'; },
      countPending: '確認中',
      countNote: '登録した人数ではなく、実際に給与データを出した人数です。',
      nextK: function (g) { return '次の目標 ' + fmt(g) + '人'; },
      nextLeft: function (left) { return 'あと ' + fmt(left) + '人'; },
      allDone: 'すべての目標に届きました。',
      barLabel: function (n, g) { return g + '人のうち ' + n + '人'; },

      kpiDone: '完了した改善',
      kpiBuilding: '進行中',
      kpiReq: 'コミュニティ要望',
      kpiUnit: '件',
      unknown: '—',
      retry: 'もう一度読み込む',

      whyH: 'なぜ PILOT VALUE をつくっているのか',

      tasksH: '運営が進めていること',
      tasksS: '上から順に、いま手が付いているものです。',
      stDone: '完了', stBuilding: '開発中', stPlanned: '予定', stConsidering: '検討中',
      fromCommunity: 'みんなの要望から',

      mlH: '目標の段',
      mlNote: 'ロードマップはコミュニティからの要望やデータ状況に応じて変更される場合があります。',

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

      shipH: '最近のアップデート',
      shipEmpty: 'アップデート履歴はこれから追加されます。',
      shipMore: 'これまでのアップデートをすべて見る',

      privacy: '匿名で送信されます。氏名・メールアドレスなどの個人情報は公開されません。'
             + '運営上必要な不正防止情報を除き、投稿者を特定する情報は公開されません。',
      privacy2: '公開されるのは、本文・区分・賛成の数・状態・おおよその時期だけです。'
              + '航空会社・職位・給与・メールアドレス・氏名とは結びつけません。',

      adminH: '管理',
      adminHide: '伏せる',
      adminShow: '戻す',
      adminHidden: '伏せています',
      adminErr: '変更できませんでした。',

      cat: { feature: '機能', data: 'データ', ui: '使いやすさ', bug: '不具合', other: 'その他' },
      st:  { 'new': '受付済み', considering: '検討中', planned: '予定',
             building: '開発中', done: '完了', declined: '見送り' },
      ym: function (y, m) { return y + '年' + m + '月'; }
    },

    en: {
      eyebrow: 'OUR MISSION',
      mission: 'Close the information gap for pilots, and make pay transparency the world standard.',
      missionBody: 'Make pay, benefits and working conditions visible so pilots have real choices. '
                 + 'Pilots move toward the airlines that treat them well, and the rest have to improve. '
                 + 'That pressure is how pilot pay rises worldwide.',
      builtWith: 'Built with pilots, for pilots.',

      countK: 'Pilots who shared their pay',
      countUnit: function (n) { return n; },
      countPending: 'Checking',
      countNote: 'Not sign-ups — pilots who actually submitted pay data.',
      nextK: function (g) { return 'Next milestone: ' + fmt(g); },
      nextLeft: function (left) { return fmt(left) + ' to go'; },
      allDone: 'Every milestone reached.',
      barLabel: function (n, g) { return n + ' of ' + g; },

      kpiDone: 'Shipped',
      kpiBuilding: 'In progress',
      kpiReq: 'Community requests',
      kpiUnit: '',
      unknown: '—',
      retry: 'Load again',

      whyH: 'Why we are building PILOT VALUE',

      tasksH: 'What we are working on',
      tasksS: 'Top of the list is what has hands on it right now.',
      stDone: 'Shipped', stBuilding: 'Building', stPlanned: 'Planned', stConsidering: 'Considering',
      fromCommunity: 'From a community request',

      mlH: 'Milestones',
      mlNote: 'This roadmap may change based on community requests and how the data grows.',

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

      shipH: 'Recent updates',
      shipEmpty: 'Updates will be listed here.',
      shipMore: 'See every update so far',

      privacy: 'Sent anonymously. Your name and email address are never published. '
             + 'Apart from what we need internally to prevent abuse, nothing identifying you is made public.',
      privacy2: 'Only the text, the category, the vote count, the status and a rough date are shown. '
              + 'Nothing is linked to your airline, rank, pay, email or name.',

      adminH: 'Admin',
      adminHide: 'Hide',
      adminShow: 'Unhide',
      adminHidden: 'Hidden',
      adminErr: 'Could not apply the change.',

      cat: { feature: 'Feature', data: 'Data', ui: 'Usability', bug: 'Bug', other: 'Other' },
      st:  { 'new': 'Received', considering: 'Considering', planned: 'Planned',
             building: 'Building', done: 'Shipped', declined: 'Not planned' },
      /* ★3文字で書く。'September 2026' は日付の列（5.6em）に収まらず2行に折れ、
         履歴の題名の左端が行ごとにずれる。列を広げると右カラムの3割を
         日付が食う。変更履歴の日付は短いほうが読みやすい。 */
      ym: function (y, m) {
        return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul',
                'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1] + ' ' + y;
      }
    }
  };
  var T = DICT[LANG];

  // ══ 小道具 ═════════════════════════════════════════════════
  function fmt(n) {
    try { return Number(n).toLocaleString(LANG === 'en' ? 'en-US' : 'ja-JP'); }
    catch (e) { return String(n); }
  }
  /* ★これは**設定ファイルの文字**にだけ使う。利用者が書いた本文には使わない
     （本文は textContent で入れる。下の reqNode を見ること）。 */
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
  var REDUCED = false;
  try { REDUCED = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { REDUCED = false; }

  // ══ ページ固有の CSS ═══════════════════════════════════════
  /* ★my-value.css を触らない。あれは12ページが共有していて、1行足すと
     画面検査（7分半）が必ず要る。このページでしか使わない見た目はここに置く。 */
  var CSS = [
    '.rm-hero-in{display:flex;flex-wrap:wrap;gap:26px;align-items:flex-start}',
    '.rm-hero-l{flex:1 1 320px;min-width:0}',
    '.rm-hero-r{flex:1 1 230px;min-width:0;padding:18px;border-radius:var(--pv-r);',
    '  background:var(--pv-surface);border:1px solid var(--pv-line)}',
    '.rm-eyebrow{display:block;font-size:.7rem;font-weight:800;letter-spacing:.14em;',
    '  text-transform:uppercase;color:var(--pv-ink-3)}',
    '.rm-mission{margin-top:12px;font-size:clamp(1.25rem,3vw,1.62rem);font-weight:800;',
    '  letter-spacing:-.03em;line-height:1.42;color:var(--pv-ink)}',
    '.rm-lede{margin-top:14px;font-size:.85rem;line-height:1.85;color:var(--pv-ink-2);max-width:60ch}',
    '.rm-built{display:inline-block;margin-top:16px;padding:5px 12px;border-radius:999px;',
    '  background:var(--pv-orange-soft);color:var(--pv-orange-ink);',
    '  font-size:.72rem;font-weight:800;letter-spacing:.01em}',
    '.rm-tenets{list-style:none;margin-top:18px;display:flex;flex-direction:column;gap:9px}',
    '.rm-tenets li{position:relative;padding-left:22px;font-size:.78rem;line-height:1.7;',
    '  color:var(--pv-ink-2)}',
    '.rm-tenets li::before{content:"";position:absolute;left:2px;top:.62em;width:7px;height:7px;',
    '  border-radius:999px;background:var(--pv-orange)}',

    '.rm-cnt-k{display:block;font-size:.71rem;font-weight:700;letter-spacing:.05em;',
    '  text-transform:uppercase;color:var(--pv-ink-3);line-height:1.5}',
    '.rm-cnt-v{display:block;margin-top:8px;font-size:clamp(2rem,6vw,2.7rem);font-weight:900;',
    '  letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums;color:var(--pv-ink)}',
    '.rm-cnt-n{display:block;margin-top:9px;font-size:.7rem;line-height:1.6;color:var(--pv-ink-3)}',
    '.rm-next{display:flex;align-items:baseline;justify-content:space-between;gap:10px;',
    '  flex-wrap:wrap;margin-top:16px;font-size:.74rem;font-weight:700;color:var(--pv-ink-2)}',
    '.rm-next b{font-weight:800;color:var(--pv-orange-ink);font-variant-numeric:tabular-nums}',
    '.rm-bar{display:flex;height:10px;border-radius:999px;overflow:hidden;margin-top:9px;',
    '  background:var(--pv-line-soft)}',
    '.rm-bar i{display:block;height:100%;background:var(--pv-orange);border-radius:999px}',

    '.rm-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}',
    /* ★見出しの折り返しは行の高さを変える。「コミュニティ要望」も
       'Community requests' も 390px では2行に折れ、3枚のうち1枚だけ数字が
       1行ぶん下へずれる。狭いときは先に2行ぶんの高さを取って高さを揃える
       （.mr-kpi-k は line-height:1.4 なので2行＝2.8em）。 */
    '@media(max-width:560px){.rm-kpis .mr-kpi-k{min-height:2.8em}}',
    '.rm-kpi-v{font-variant-numeric:tabular-nums}',
    '.rm-kpi-r{display:inline-block;margin-top:6px;padding:0;border:0;background:none;',
    '  font:inherit;font-size:.66rem;font-weight:700;color:var(--pv-orange-ink);',
    '  cursor:pointer;text-decoration:underline;text-underline-offset:3px}',
    '.rm-kpi-r:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',

    '.rm-why{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}',
    '@container (max-width:640px){.rm-why{grid-template-columns:1fr}}',
    '.rm-why-c{padding:16px;border-radius:var(--pv-r);background:var(--pv-surface-2);',
    '  border:1px solid var(--pv-line-soft)}',
    '.rm-why-c b{display:block;font-size:.83rem;font-weight:800;letter-spacing:-.015em;line-height:1.5}',
    '.rm-why-c span{display:block;margin-top:8px;font-size:.75rem;line-height:1.8;color:var(--pv-ink-2)}',

    /* 目標の段は5つ。my-value.css の .mr-ml-g は4列なので、ここだけ上書きする。
       ★狭いときの折り返しも自分で書く。my-value.css:806 の
       @media(max-width:420px){.mr-ml-g{…2列…}} は詳細度が 0,1,0 で、
       こちらの .rm-ml5 .mr-ml-g（0,2,0）に負ける＝メディアクエリの中でも
       5列のまま残り、390px で段の文字が1文字ずつ縦に割れる。 */
    '.rm-ml5 .mr-ml-g{grid-template-columns:repeat(5,minmax(0,1fr))}',
    '@media(max-width:640px){.rm-ml5 .mr-ml-g{grid-template-columns:repeat(3,minmax(0,1fr))}}',
    '@media(max-width:420px){.rm-ml5 .mr-ml-g{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '.rm-ml5 .mr-ml-g li{display:flex;flex-direction:column;gap:4px;padding:11px 6px}',
    '.rm-ml5 .mr-ml-g li span{font-size:.63rem;font-weight:600;line-height:1.4;',
    '  color:var(--pv-ink-3);white-space:normal}',
    '.rm-ml5 .mr-ml-g li.is-on span{color:inherit;opacity:.9}',
    '.rm-ml5 .mr-ml-g li.is-next span{color:var(--pv-ink-2)}',
    '.rm-ml-d{margin-top:12px;font-size:.75rem;line-height:1.8;color:var(--pv-ink-2)}',

    /* 状態の札。★色だけで区別しない。記号＋語＋色の3つで区別する。 */
    '.rm-tag{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;',
    '  font-size:.68rem;font-weight:800;white-space:nowrap;border:1px solid transparent}',
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

    '.rm-list{list-style:none;display:flex;flex-direction:column;gap:10px}',
    '.rm-task{padding:14px 16px;border-radius:var(--pv-r);background:var(--pv-surface-2);',
    '  border:1px solid var(--pv-line-soft)}',
    '.rm-task.is-building{border-color:var(--pv-orange);background:var(--pv-orange-soft)}',
    '.rm-task-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.rm-task-t{font-size:.83rem;font-weight:800;letter-spacing:-.015em;line-height:1.5;',
    '  color:var(--pv-ink)}',
    '.rm-task-d{margin-top:7px;font-size:.74rem;line-height:1.8;color:var(--pv-ink-2)}',
    '.rm-chipc{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;',
    '  background:var(--pv-gold-soft);color:var(--pv-gold-ink);border:1px solid var(--pv-gold-line);',
    '  font-size:.66rem;font-weight:800;white-space:nowrap}',

    '.rm-ship{list-style:none;display:flex;flex-direction:column;gap:0}',
    '.rm-ship li{display:flex;gap:12px;padding:11px 0;border-top:1px solid var(--pv-line-soft)}',
    '.rm-ship li:first-child{border-top:0;padding-top:0}',
    /* ★日付の列は固定幅。auto にすると行ごとに幅が変わって題名の左端が揃わない。
       日英とも 5.6em に収まる形（「2026年9月」/「Sep 2026」）で書くこと ── T.ym を
       長い月名に戻すと、ここは何も言わずに2行へ折れる。 */
    '.rm-ship .ymd{flex:none;width:5.6em;font-size:.68rem;font-weight:700;line-height:1.7;',
    '  color:var(--pv-ink-3);font-variant-numeric:tabular-nums}',
    '.rm-ship .t{flex:1 1 auto;min-width:0;font-size:.76rem;font-weight:700;line-height:1.7;',
    '  color:var(--pv-ink)}',

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

    '.rm-req{display:flex;gap:12px;padding:14px 16px;border-radius:var(--pv-r);',
    '  background:var(--pv-surface-2);border:1px solid var(--pv-line-soft)}',
    '.rm-req.is-new{border-color:var(--pv-orange);background:var(--pv-orange-soft)}',
    '.rm-req.is-hidden{opacity:.55}',
    '.rm-like{flex:none;display:flex;flex-direction:column;align-items:center;',
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
    '.rm-req-t{font-size:.79rem;line-height:1.85;color:var(--pv-ink);',
    '  overflow-wrap:anywhere;white-space:pre-wrap}',
    '.rm-req-m{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:9px}',
    '.rm-req-m .ymd{font-size:.67rem;font-weight:600;color:var(--pv-ink-3)}',

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

    '.rm-empty{padding:22px 16px;border-radius:var(--pv-r);background:var(--pv-surface-2);',
    '  border:1px dashed var(--pv-line);font-size:.77rem;line-height:1.8;color:var(--pv-ink-2);',
    '  text-align:center}',
    '.rm-more-btn{display:block;width:100%;min-height:44px;margin-top:12px;padding:11px 16px;',
    '  border-radius:var(--pv-r-sm);border:1px solid var(--pv-line);background:var(--pv-surface);',
    '  color:var(--pv-ink-2);font:inherit;font-size:.76rem;font-weight:700;cursor:pointer;',
    '  transition:background-color .18s var(--pv-ease),color .18s var(--pv-ease)}',
    '.rm-more-btn:hover{background:var(--pv-line-soft);color:var(--pv-ink)}',
    '.rm-more-btn:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',

    '.rm-live{margin-top:16px;font-size:.75rem;line-height:1.7;color:var(--pv-orange-ink);',
    '  min-height:1.2em}',
    '.rm-note{margin-top:12px;font-size:.68rem;line-height:1.8;color:var(--pv-ink-3)}',

    /* 送信フォーム。iOS が拡大しないよう入力欄は 16px を切らない。 */
    '.rm-f-l{display:block;font-size:.76rem;font-weight:700;color:var(--pv-ink-2);line-height:1.6}',
    '.rm-f-t{display:block;width:100%;margin-top:8px;padding:12px 13px;border-radius:var(--pv-r-sm);',
    '  border:1px solid var(--pv-line);background:var(--pv-surface-2);color:var(--pv-ink);',
    '  font:inherit;font-size:16px;line-height:1.8;min-height:132px;resize:vertical}',
    '.rm-f-t:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',
    '.rm-f-s{display:block;width:100%;margin-top:8px;padding:11px 12px;border-radius:var(--pv-r-sm);',
    '  border:1px solid var(--pv-line);background:var(--pv-surface-2);color:var(--pv-ink);',
    '  font:inherit;font-size:16px}',
    '.rm-f-s:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',
    '.rm-f-r{display:flex;align-items:center;justify-content:space-between;gap:10px;',
    '  flex-wrap:wrap;margin-top:14px}',
    '.rm-f-c{font-size:.7rem;font-weight:700;color:var(--pv-ink-3);font-variant-numeric:tabular-nums}',
    '.rm-f-c.is-over{color:var(--pv-orange-ink)}',
    '.rm-f-b{min-height:44px;padding:12px 22px;border-radius:999px;border:0;',
    '  background:var(--pv-orange);color:var(--pv-bg);font:inherit;font-size:.8rem;',
    '  font-weight:800;letter-spacing:-.01em;cursor:pointer;',
    '  transition:opacity .18s var(--pv-ease),transform .18s var(--pv-ease)}',
    '.rm-f-b:hover{opacity:.9}',
    '.rm-f-b:focus-visible{outline:2px solid var(--pv-orange);outline-offset:3px}',
    '.rm-f-b:active{transform:scale(.97)}',
    '.rm-f-b[disabled]{opacity:.55;cursor:default;transform:none}',
    '.rm-f-msg{margin-top:12px;font-size:.75rem;line-height:1.8;color:var(--pv-orange-ink)}',
    '.rm-f-msg.is-ok{color:var(--pv-green-ink)}',

    '@media(prefers-reduced-motion:reduce){',
    '  .rm-tab,.rm-like,.rm-f-b,.rm-more-btn{transition-duration:.01ms}',
    '  .rm-like:active,.rm-f-b:active{transform:none}}'
  ].join('\n');

  (function injectCSS() {
    var s = d.createElement('style');
    s.setAttribute('data-rm', '1');
    s.textContent = CSS;          // ★textContent。innerHTML は使わない
    d.head.appendChild(s);
  }());

  // ══ 設定から描く（通信を待たない）══════════════════════════
  function heroHTML() {
    var tenets = (CFG.tenets || []).map(function (t) {
      return '<li>' + esc(t[LANG] || '') + '</li>';
    }).join('');
    return '<section class="mr-card is-hero">' +
      '<div class="rm-hero-in">' +
        '<div class="rm-hero-l">' +
          '<span class="rm-eyebrow">' + esc(T.eyebrow) + '</span>' +
          '<h2 class="rm-mission">' + esc(T.mission) + '</h2>' +
          '<p class="rm-lede">' + esc(T.missionBody) + '</p>' +
          '<span class="rm-built">' + esc(T.builtWith) + '</span>' +
          '<ul class="rm-tenets">' + tenets + '</ul>' +
        '</div>' +
        '<div class="rm-hero-r" id="rm-count">' +
          '<span class="rm-cnt-k">' + esc(T.countK) + '</span>' +
          '<span class="rm-cnt-v" id="rm-count-v">' + esc(T.countPending) + '</span>' +
          '<span class="rm-cnt-n">' + esc(T.countNote) + '</span>' +
          '<div id="rm-count-next"></div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function kpiHTML() {
    var done = tasksBy('done').length;
    var bld  = tasksBy('building').length;
    function cell(k, v, id) {
      return '<div class="mr-kpi"><span class="mr-kpi-k">' + esc(k) + '</span>' +
             '<span class="mr-kpi-v rm-kpi-v"' + (id ? ' id="' + id + '"' : '') + '>' +
             esc(v) + '</span></div>';
    }
    return '<section class="mr-card"><div class="mr-kpis rm-kpis">' +
      cell(T.kpiDone, fmt(done) + T.kpiUnit) +
      cell(T.kpiBuilding, fmt(bld) + T.kpiUnit) +
      '<div class="mr-kpi"><span class="mr-kpi-k">' + esc(T.kpiReq) + '</span>' +
        '<span class="mr-kpi-v rm-kpi-v" id="rm-kpi-req">' + esc(T.unknown) + '</span>' +
        '<span id="rm-kpi-req-r"></span></div>' +
    '</div></section>';
  }

  function whyHTML() {
    var cards = (CFG.why || []).map(function (c) {
      var v = txt(c);
      return '<div class="rm-why-c"><b>' + esc(v.t || '') + '</b>' +
             '<span>' + esc(v.d || '') + '</span></div>';
    }).join('');
    if (!cards) return '';
    return '<section class="mr-card">' +
      '<div class="mr-card-h"><h2 class="mr-card-t">' + esc(T.whyH) + '</h2></div>' +
      '<div class="rm-why">' + cards + '</div></section>';
  }

  /* 目標の段。★現在地はサーバの人数が来てから入れる（0 を置いて埋めない）。 */
  function mlHTML() {
    var lis = MILE.map(function (g) {
      var goal = findGoal(g), v = txt(goal || {});
      return '<li data-rm-goal="' + g + '"><b>' + fmt(g) + '</b>' +
             '<span>' + esc(v.t || '') + '</span></li>';
    }).join('');
    return '<section class="mr-card">' +
      '<div class="mr-card-h"><h2 class="mr-card-t">' + esc(T.mlH) + '</h2></div>' +
      '<div class="mr-ml rm-ml5" style="margin-top:0">' +
        '<ol class="mr-ml-g" id="rm-ml-g" style="margin-top:0">' + lis + '</ol>' +
        '<p class="rm-ml-d" id="rm-ml-d"></p>' +
      '</div>' +
      '<p class="rm-note">' + esc(T.mlNote) + '</p>' +
    '</section>';
  }

  function findGoal(n) {
    var g = CFG.goals || [];
    for (var i = 0; i < g.length; i++) if (g[i].n === n) return g[i];
    return null;
  }
  function tasksBy(state) {
    return (CFG.tasks || []).filter(function (t) { return t.state === state; });
  }

  var ORDER = { building: 0, planned: 1, considering: 2 };
  /* ★ ORDER[x] || 9 と書かない。building は 0 で falsy なので 9 に化け、
     「上から順に、いま手が付いているもの」と書いてある見出しの真下で
     開発中が一番下に落ちる（画面は普通に出たまま並びだけ逆になる）。 */
  function rank(s) { return Object.prototype.hasOwnProperty.call(ORDER, s) ? ORDER[s] : 9; }
  function tasksHTML() {
    var live = (CFG.tasks || []).filter(function (t) { return t.state !== 'done'; })
      .sort(function (a, b) { return rank(a.state) - rank(b.state); });
    var body = live.length ? '<ul class="rm-list">' + live.map(function (t) {
      var v = txt(t), st = t.state;
      var lab = st === 'building' ? T.stBuilding : st === 'planned' ? T.stPlanned : T.stConsidering;
      var sym = st === 'building' ? '●' : st === 'planned' ? '○' : '?';
      return '<li class="rm-task' + (st === 'building' ? ' is-building' : '') + '">' +
        '<div class="rm-task-h">' +
          '<span class="rm-tag is-' + st + '"><span aria-hidden="true">' + sym + '</span>' +
          esc(lab) + '</span>' +
          (t.community ? '<span class="rm-chipc">' + esc(T.fromCommunity) + '</span>' : '') +
        '</div>' +
        '<p class="rm-task-t" style="margin-top:9px">' + esc(v.t || '') + '</p>' +
        (v.d ? '<p class="rm-task-d">' + esc(v.d) + '</p>' : '') +
      '</li>';
    }).join('') + '</ul>' : '<p class="rm-empty">' + esc(T.shipEmpty) + '</p>';

    return '<section class="mr-card">' +
      '<div class="mr-card-h"><h2 class="mr-card-t">' + esc(T.tasksH) + '</h2>' +
      '<span class="mr-card-s">' + esc(T.tasksS) + '</span></div>' + body + '</section>';
  }

  function shipHTML() {
    var done = tasksBy('done').slice().sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
    if (!done.length) {
      return '<section class="mr-card">' +
        '<div class="mr-card-h"><h2 class="mr-card-t">' + esc(T.shipH) + '</h2></div>' +
        '<p class="rm-empty">' + esc(T.shipEmpty) + '</p></section>';
    }
    function row(t) {
      var v = txt(t);
      return '<li><span class="ymd">' + esc(ym(t.date)) + '</span>' +
             '<span class="t">' + esc(v.t || '') + '</span></li>';
    }
    var head = done.slice(0, 5).map(row).join('');
    var rest = done.slice(5);
    return '<section class="mr-card">' +
      '<div class="mr-card-h"><h2 class="mr-card-t">' + esc(T.shipH) + '</h2></div>' +
      '<ul class="rm-ship">' + head + '</ul>' +
      (rest.length ? '<details class="mr-more"><summary>' + esc(T.shipMore) + '</summary>' +
        '<ul class="rm-ship" style="margin-top:10px">' + rest.map(row).join('') + '</ul>' +
       '</details>' : '') +
    '</section>';
  }

  // ══ 人数と段の現在地 ═══════════════════════════════════════
  function nextMilestone(n) {
    for (var i = 0; i < MILE.length; i++) if (n < MILE[i]) return MILE[i];
    return null;
  }

  /* 人数が届いたときだけ呼ぶ。★届かなければ「確認中」のまま。0 を置いて埋めない。 */
  function paintCount(n) {
    var v = $('rm-count-v');
    if (v) v.textContent = T.countUnit(fmt(n));

    var goal = nextMilestone(n);
    var box = $('rm-count-next');
    if (box) {
      if (goal === null) {
        box.innerHTML = '<p class="rm-next"><span>' + esc(T.allDone) + '</span></p>';
      } else {
        /* ★分母は「次の段」。累計分母にすると「あと27人」が画面の数字から
           検算できなくなる（真下に段が描いてあるので、段が上がって％が
           戻って見えても読める）。 */
        var pct = Math.max(0, Math.min(100, Math.round(n / goal * 100)));
        box.innerHTML =
          '<p class="rm-next"><span>' + esc(T.nextK(goal)) + '</span>' +
          '<b>' + esc(T.nextLeft(goal - n)) + '</b></p>' +
          '<div class="rm-bar" role="img" aria-label="' + esc(T.barLabel(fmt(n), fmt(goal))) + '">' +
          '<i style="width:' + pct + '%"></i></div>';
      }
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

  // ══ 要望の一覧 ═════════════════════════════════════════════
  var HEART =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>';

  var state = { sort: 'popular', offset: 0, total: null, admin: false, items: [] };

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

    if (it.is_hidden) {
      var h = d.createElement('span');
      h.className = 'rm-tag is-declined';
      h.textContent = T.adminHidden;
      meta.appendChild(h);
    }
    body.appendChild(meta);

    /* ★管理用の操作は、管理者のときだけ DOM に足す。
       一般ユーザーの画面には要素として存在させない（隠すのではなく作らない）。 */
    if (state.admin) body.appendChild(adminNode(it));

    li.appendChild(btn);
    li.appendChild(body);
    return li;
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
      more.textContent = T.listMore + (left > 0 ? '（' + fmt(left) + '）' : '');
      if (LANG === 'en') more.textContent = T.listMore + (left > 0 ? ' (' + fmt(left) + ')' : '');
    }
    var cnt = $('rm-list-n');
    if (cnt && state.total !== null) cnt.textContent = T.listS(state.total);
  }

  function paintTotal() {
    var k = $('rm-kpi-req');
    if (k) k.textContent = (state.total === null) ? T.unknown : fmt(state.total) + T.kpiUnit;
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
         押されたときにもう一度同じ RPC を投げ、しかもヒーローと違う数を
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
      ul.innerHTML = '<div class="mr-skel" style="height:78px"></div>'
                   + '<div class="mr-skel" style="height:78px;margin-top:10px"></div>';
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
        paintTotal();
        paintList();
      });
  }

  function listError() {
    var ul = $('rm-req-list');
    if (!ul) return;
    ul.innerHTML = '';
    var p = d.createElement('p');
    p.className = 'rm-empty';
    p.textContent = T.listErr + ' ';
    var b = d.createElement('button');
    b.type = 'button';
    b.className = 'rm-kpi-r';
    b.textContent = T.retry;
    b.addEventListener('click', function () { state.offset = 0; loadList(false); });
    p.appendChild(b);
    ul.appendChild(p);

    /* KPI も「0件」ではなく「—」＋読み直し。0 と書くと本当に0件だと読める。 */
    var slot = $('rm-kpi-req-r');
    if (slot && !slot.firstChild) {
      var r = d.createElement('button');
      r.type = 'button';
      r.className = 'rm-kpi-r';
      r.textContent = T.retry;
      r.addEventListener('click', function () { state.offset = 0; loadList(false); });
      slot.appendChild(r);
    }
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

  // ══ 送信 ═══════════════════════════════════════════════════
  function wireForm() {
    var form = $('rm-form'), ta = $('rm-body'), cat = $('rm-cat'),
        btn  = $('rm-send'), cnt = $('rm-count-c'), msg = $('rm-msg');
    if (!form || !ta || !btn) return;

    function count() {
      var n = ta.value.length;
      if (cnt) {
        cnt.textContent = n + ' / 500';
        cnt.className = 'rm-f-c' + (n > 500 ? ' is-over' : '');
      }
    }
    ta.addEventListener('input', count);
    count();

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

      rpc('pv_request_submit', { p_body: body, p_category: (cat && cat.value) || 'other' })
        .then(function (v) {
          btn.disabled = false;
          if (!v || v.__err) { show(T.errSend, false); return; }
          if (v.ok !== true) {
            show(v.status === 'too_fast' ? T.errFast
               : v.status === 'rate_limited' ? T.errLimit
               : v.status === 'duplicate' ? T.errDup : T.errSend, false);
            return;   // ★本文は消さない（書き直せるように残す）
          }
          ta.value = '';
          count();
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

  // ══ 起動 ═══════════════════════════════════════════════════
  function boot() {
    var top = $('rm-top');
    if (top) top.innerHTML = heroHTML() + kpiHTML() + whyHTML() + mlHTML();
    var tk = $('rm-tasks');
    if (tk) tk.innerHTML = tasksHTML();
    var sp = $('rm-ship');
    if (sp) sp.innerHTML = shipHTML();

    /* 匿名の説明。★「運営にも誰かわからない」とは書かない
       （ハッシュは運営側で照合できる＝実装と食い違う文言は書かない）。 */
    var pv = $('rm-privacy');
    if (pv) { pv.textContent = T.privacy; 
      var pv2 = d.createElement('span');
      pv2.style.display = 'block';
      pv2.style.marginTop = '6px';
      pv2.textContent = T.privacy2;
      pv.appendChild(pv2);
    }

    wireForm();
    wireTabs();

    var ul = $('rm-req-list');
    if (ul) ul.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-rm-like]') : null;
      if (b) onLike(b);
    });
    var more = $('rm-more');
    if (more) more.addEventListener('click', function () { loadList(true); });

    loadCount();
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
