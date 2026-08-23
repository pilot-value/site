/* ════════════════════════════════════════════════════════════════
   pv-founding.js — FOUNDING PILOT 100（創設メンバー）の板

   日英で1本。<html lang> を見て文言を切り替える＝2ファイルに散らさない。

   ── これは実績バッジではない ────────────────────────────────
   何も無い時期に、見返りの保証も無いまま一次データを出してくれた人が居る。
   その人たちに、あとから追いつけない印を1つ渡す。それだけのもの。
   ★数を競わせない。「あと何件で次の段」も「何位」も出さない。
     番号は増えないし減らない。一度渡したら一生変わらない。

   ── 出さないもの（ここを足すと約束が壊れる）──────────────
   ・会員数・貢献者数・残り枠数。my_founding が返すのは自分の番号だけで、
     総数はそもそもサーバから出てこない（db/founding.sql:4）。
     「残り86枠」を出すと、そこから会員の規模が読める。
   ・他人の番号・一覧・「あなたは何番目に早かった」。
   ・番号を持っていない人への煽り。板は沈んだ姿で出て、
     「給与か口コミをひとつ出すと、この称号が入ります。」とだけ言う。急かさない。

   ── 置き場所は1つだけ ────────────────────────────────────────
   マイページ（profile.html / en/profile.html）の <main> のいちばん上。
   ★口コミカードや給与レポートには出さない。いま番号を持つのは十数人で、
     投稿の横に番号が出ると、それだけで書いた人が絞り込める。

   ── 待遇モーダル（pv-conditions.js）とぶつからない理由 ──────
   ★このファイルは position:fixed も role="dialog" も aria-modal も
     body.style.overflow も1つも書かない。ただページに流れる1枚の板で、
     スクロールも止めない。assert-founding.mjs がソースを grep して、
     あとから誰かが本物のモーダルにするのを禁じている。

   ── 見た目の決まり ──────────────────────────────────────────
   ★テーマは [data-theme] 属性だけで決まる（このリポジトリに
     prefers-color-scheme は1つも無い）。既定が暗い側で、
     [data-theme="light"] で明るい側に上書きする＝profile.html と同じ向き。
   ★金は暗い側が #f5c842、明るい側が #a07200。#f5c842 を白地に置くと
     コントラスト比 1.65 で読めない。明るい側で金色を文字に使わない。
   ★字は2書体。ワードマークはサンセリフ（本文と同じ Inter）を太く広く、
     番号はセリフ＋等幅数字。追加のフォントは読み込まない
     （板1枚のためにネットワーク要求を増やさない）。
   ★動くのは transform と opacity だけ。transition-all は使わない。
   ════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';
  if (!w || !d) return;

  var L = (d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';

  var T = (L === 'en') ? {
    logo:   'FOUNDING PILOT 100',
    sub:    'Founding Member',
    /* ★持っている人に添える一文は無い。称号だけを出す（オーナー判断）。
       英語は語の間で折れるので、そのまま1つの文字列で渡す。 */
    /* ★件数も残り枠も書かない。「あと◯人」と書きたくなるが、
       それは会員数を漏らすのと同じこと。 */
    none:   'Share one pay report or one review, and this becomes yours.',
    aria:   'Founding pilot badge'
  } : {
    logo:   'FOUNDING PILOT 100',
    sub:    '創設メンバー',
    /* ★配列は「ここでは折らない」塊。日本語はどこでも折れるので、
       390px で「口コミをひと／つ出すと」のように語の途中で切れる（実際に切れた）。
       塊ごとに white-space:nowrap を掛けて、折れる場所をこちらで決める。 */
    /* ★ここに算用数字を書かない。「1件」でも意味は同じだが、
       数字を1文字でも許すと「残り86枠」を足す道が開く。
       assert-founding.mjs は板の数字が0文字であることを見ている。 */
    none:   ['給与か口コミをひとつ出すと、', 'この称号が入ります。'],
    aria:   '創設メンバーの称号'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* 文字列ならそのまま、配列なら塊ごとに折れないようにして繋ぐ。 */
  function note(v) {
    if (Object.prototype.toString.call(v) !== '[object Array]') return esc(v);
    var out = '';
    for (var i = 0; i < v.length; i++) out += '<span class="pvf-nb">' + esc(v[i]) + '</span>';
    return out;
  }

  // ══════════════════════════════════════════════════════════════
  // 見た目
  // ══════════════════════════════════════════════════════════════
  /* 粒子感。SVG のノイズを data URI で敷く（外部ファイルを増やさない）。
     金のグラデーションだけだと、暗い側でのっぺりして安っぽく見える。 */
  var NOISE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.42'/%3E%3C/svg%3E\")";

  var CSS = [
    /* ★中身の幅まで縮める（inline-block）。番号を外したので全幅にすると
       右が半分以上まっさらになり、見出しの帯のように見えてしまう。
       称号は「札」なので、下のプロフィールカードより狭くて構わない。
       vertical-align:top は inline 要素の下に行の余白が付くのを防ぐ。 */
    '.pvf{display:inline-block;vertical-align:top;max-width:100%;',
      'position:relative;overflow:hidden;border-radius:16px;padding:20px 26px;margin-bottom:18px;',
      'border:1px solid rgba(245,200,66,.30);',
      /* 放射グラデーションを重ねる（左上から金、右下へ橙をわずかに） */
      'background:',
        'radial-gradient(ellipse 60% 120% at 8% 0%,rgba(245,200,66,.16) 0%,transparent 62%),',
        'radial-gradient(ellipse 50% 130% at 100% 100%,rgba(249,115,22,.11) 0%,transparent 60%),',
        'linear-gradient(135deg,rgba(28,24,14,.92),rgba(17,22,32,.86));',
      /* 影は3層。内側の金のハイライト → 橙みの落ち影 → 黒で締める */
      'box-shadow:inset 0 1px 0 rgba(245,200,66,.24),',
        '0 16px 38px -20px rgba(249,115,22,.50),',
        '0 2px 10px -4px rgba(0,0,0,.62);',
      'opacity:0;transform:translateY(7px);',
      'transition:opacity .42s cubic-bezier(.16,1,.3,1),transform .42s cubic-bezier(.16,1,.3,1)}',
    '.pvf.is-in{opacity:1;transform:none}',
    '@media (prefers-reduced-motion:reduce){.pvf{opacity:1;transform:none;transition:none}}',
    /* 粒子。板の上に薄くかける（文字より下） */
    '.pvf::after{content:"";position:absolute;inset:0;pointer-events:none;',
      'background-image:' + NOISE + ';background-size:140px 140px;opacity:.05;mix-blend-mode:overlay}',

    /* ★flex-start で上に揃える。center のままだと星が2行目（創設メンバー）の
       横に来て、題名から離れて見える。 */
    '.pvf-in{position:relative;z-index:1;display:flex;align-items:flex-start;gap:16px}',
    '.pvf-mark{flex-shrink:0;color:#f5c842;line-height:0;margin-top:2px;',
      'filter:drop-shadow(0 2px 6px rgba(245,200,66,.35))}',
    '.pvf-body{flex:1;min-width:0}',
    /* ワードマーク。全角に見えるまで字間を開ける（詰めると小さな大文字は潰れる） */
    '.pvf-logo{font-family:Inter,"Noto Sans JP",sans-serif;font-size:1.16rem;font-weight:900;',
      'letter-spacing:.13em;line-height:1.15;color:#f5c842;',
      'text-shadow:0 1px 12px rgba(245,200,66,.28)}',
    '.pvf-sub{font-size:.74rem;font-weight:700;letter-spacing:.06em;line-height:1.5;',
      'margin-top:7px;color:rgba(245,200,66,.78)}',
    '.pvf-note{font-size:.76rem;line-height:1.7;margin-top:6px;color:#93a5b8}',
    '.pvf-nb{white-space:nowrap}',

    /* まだ持っていない人。同じ板を沈める（別の姿を作らない＝何が入るか分かる） */
    '.pvf.is-locked{border-color:rgba(245,200,66,.13);',
      'background:',
        'radial-gradient(ellipse 60% 120% at 8% 0%,rgba(245,200,66,.05) 0%,transparent 62%),',
        'linear-gradient(135deg,rgba(22,25,32,.86),rgba(17,22,32,.80));',
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 2px 10px -4px rgba(0,0,0,.5)}',
    '.pvf.is-locked .pvf-mark{color:#6b7d93;filter:none}',
    '.pvf.is-locked .pvf-logo{color:#8d9bab;text-shadow:none}',
    '.pvf.is-locked .pvf-sub{color:#6b7d93}',

    /* ── 明るい側。金色は文字に使わない（白地で読めない）────────── */
    '[data-theme="light"] .pvf{border-color:rgba(160,114,0,.34);',
      'background:',
        'radial-gradient(ellipse 60% 120% at 8% 0%,rgba(245,200,66,.20) 0%,transparent 62%),',
        'radial-gradient(ellipse 50% 130% at 100% 100%,rgba(249,115,22,.09) 0%,transparent 60%),',
        'linear-gradient(135deg,#fffdf5,#ffffff);',
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.9),',
        '0 12px 28px -18px rgba(160,114,0,.42),',
        '0 2px 8px -4px rgba(15,23,42,.10)}',
    '[data-theme="light"] .pvf::after{opacity:.035;mix-blend-mode:multiply}',
    '[data-theme="light"] .pvf-mark{color:#a07200;filter:none}',
    '[data-theme="light"] .pvf-logo{color:#8a6100;text-shadow:none}',
    '[data-theme="light"] .pvf-sub{color:#a07200}',
    '[data-theme="light"] .pvf-note{color:#5b6b7d}',
    '[data-theme="light"] .pvf.is-locked{border-color:rgba(15,23,42,.10);',
      'background:linear-gradient(135deg,#f7f8fa,#fff);box-shadow:0 2px 8px -4px rgba(15,23,42,.09)}',
    '[data-theme="light"] .pvf.is-locked .pvf-mark{color:#94a3b8}',
    '[data-theme="light"] .pvf.is-locked .pvf-logo{color:#64748b}',
    '[data-theme="light"] .pvf.is-locked .pvf-sub{color:#7c8b9c}',

    /* 狭い画面。★FOUNDING PILOT 100 は 390px で1行に収まりにくいので、
       字間を詰めたうえで少し小さくする（2行に折ると称号に見えない）。 */
    '@media (max-width:430px){',
      /* 狭い画面では縮めても全幅と変わらない。block に戻して端を揃える。 */
      '.pvf{display:block;padding:17px 18px}',
      '.pvf-in{gap:12px}',
      '.pvf-logo{font-size:.94rem;letter-spacing:.07em}}'
  ].join('');

  function ensureStyle() {
    if (d.getElementById('pvf-style')) return;
    var s = d.createElement('style');
    s.id = 'pvf-style';
    s.textContent = CSS;
    (d.head || d.documentElement).appendChild(s);
  }

  /* 四芒星。文字の ✦ にしないのは、環境によって絵文字に化けるため。 */
  var MARK = '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
    + '<path d="M12 1.6c.9 4.9 2.9 7.9 9 10.4-6.1 2.5-8.1 5.5-9 10.4-.9-4.9-2.9-7.9-9-10.4 6.1-2.5 8.1-5.5 9-10.4z"/>'
    + '</svg>';

  // ══════════════════════════════════════════════════════════════
  // my_founding() — 1ページ1回だけ引く
  // ══════════════════════════════════════════════════════════════
  var _p = null;
  function fetchNo(sb) {
    if (_p) return _p;
    if (!sb || !sb.rpc) return Promise.resolve(null);
    /* ★Promise.resolve で包む。supabase-js の rpc() が返すのは Promise では
       なく「then だけを持つ箱」で、.catch を直接は持たない。 */
    _p = Promise.resolve(sb.rpc('my_founding'))
      .then(function (res) {
        if (!res || res.error || !res.data) return null;
        return res.data;
      })
      .catch(function () { return null; });
    return _p;
  }

  // ══════════════════════════════════════════════════════════════
  // 描く
  // ══════════════════════════════════════════════════════════════
  /* no は「持っているか」を決めるためだけに使う。★画面には出さない。
     通し番号は、100人で締めるためにサーバー側が持っている道具であって、
     本人に見せるものではない（オーナー判断 2026-08-23）。
     持っている人には称号だけを出す。説明の一文も付けない。 */
  function paint(el, no) {
    var has = (no !== null && no !== undefined && Number(no) > 0);
    ensureStyle();
    el.setAttribute('data-pvf', has ? 'has' : 'none');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', T.aria);
    el.className = 'pvf' + (has ? '' : ' is-locked');
    el.innerHTML =
      '<div class="pvf-in">' +
        '<div class="pvf-mark">' + MARK + '</div>' +
        '<div class="pvf-body">' +
          '<div class="pvf-logo">' + esc(T.logo) + '</div>' +
          '<div class="pvf-sub">' + esc(T.sub) + '</div>' +
          /* 一文が付くのは、まだ持っていない人の側だけ。 */
          (has ? '' : '<div class="pvf-note">' + note(T.none) + '</div>') +
        '</div>' +
      '</div>';
    requestAnimationFrame(function () { el.classList.add('is-in'); });
  }

  /* 呼び出し側は落ちても止まらないよう try で囲っている（profile.html）。
     こちらでも、答えが取れなければ**何も描かない**。
     取れないときに沈んだ板を出すと、番号を持っている人に
     「まだ持っていません」と見せてしまう。それがいちばん失礼。 */
  function mount(el, opts) {
    if (!el || el.getAttribute('data-pvf')) return;
    var o = opts || {};
    return fetchNo(o.sb).then(function (r) {
      if (!r || r.ok !== true) return;
      paint(el, r.no);
    }).catch(function () {});
  }

  w.PVFounding = { mount: mount, _T: T };
})(typeof window !== 'undefined' ? window : null,
   typeof document !== 'undefined' ? document : null);
