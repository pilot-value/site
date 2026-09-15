/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — pv-give-first.js
   登録だけで止まっている人に、Give → Get を1回だけ見せる（2026-09-15）

   オーナー指示（2026-09-15）:
     「会員登録だけの人がログインしたりページに来たら毎回1回はこの画面出して」

   ── 何を出すか ──────────────────────────────────────────────
   signup.html の登録完了画面（#success-screen）と**同じ中身**を、1枚のカードに
   入れて出す。飛行機 → 「あと1ステップです！」→ 2段のステップ →
   「給与を1件出すと…」→ Give → Get の3段 → 匿名で給与を追加する／あとで出す。
   ★3段の表と、そこに書く文言は pv-gates.js の giveGetHTML() から借りる。
     ここに書き写さない（書き写した瞬間、片方だけ直る形で静かに腐る）。

   ── 誰に出すか ──────────────────────────────────────────────
   出すかどうかを決めるのは **pv-session.js の giveFirstDue()** で、ここではない。
   あちらは全 420 枚の <head> に入っている唯一のファイルで、localStorage の
   読み取りだけで判定する＝出さないと決まった人には通信が1本も増えない
   （このファイル自体、出すと決まったときにしか読み込まれない）。

   ── 出さない相手 ────────────────────────────────────────────
   ・ログインしていない人（そもそも会員ではない）
   ・給与の鍵（pv_salary_unlock_expiry）が生きている人＝もう出した人
   ・さっき見た人（同じログインで1回・そのあとは6時間あけて1回）
   ・入力の途中の画面にいる人（給与フォーム・口コミ・登録・ログイン・管理）
   ・REAL PAY / DEEP PAY の錠前画面にいる人 ── あの画面は**同じ3段を本文で出す**。
     上に同じものを重ねない。

   ⚠️ ぼかしを足さない。この板はデータを隠していない（隠すのはサーバの仕事）。
   ⚠️ 年収の鍵をここで書かない。書き手は pay-report.html / pv-reunlock.js /
      premium-auth-lock.js の3つだけ（assert-unlock.mjs が見張っている）。
   ⚠️ 閉じ方を1つにしない。×・カードの外・ESC・「あとで出す」の4つとも閉じる。
      閉じられない板は、次からこの人がサイトを開かない理由になる。
════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';
  if (!w || !d) return;

  /* このファイルの置き場所。pv-gates.js は同じ階層にある。
     ★currentScript は「今まさに走っている <script>」なので、
       トップレベルの今しか取れない（あとで取ると null）。 */
  var SELF = (d.currentScript && d.currentScript.src) || '';

  var L = (d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';

  var T = {
    ja: {
      title:  'あと1ステップです！',
      done:   '✓ 会員登録',
      now:    '② 匿名で給与を追加',
      lead1:  '給与を1件出すと、',
      leadHi: '全社の年収データが90日間解放',
      lead2:  'されます。',
      cta:    '匿名で給与を追加する',
      later:  'あとで出す',
      close:  '閉じる',
      aria:   '給与を出すと何が見られるか'
    },
    en: {
      title:  'One step to go!',
      done:   '✓ Sign up',
      now:    '② Add your pay',
      lead1:  'Share one pay record and ',
      leadHi: 'the pay data for every airline unlocks for 90 days',
      lead2:  '.',
      cta:    'Add your pay anonymously',
      later:  'Later',
      close:  'Close',
      aria:   'What sharing your pay unlocks'
    }
  }[L];

  /* ── 見た目 ──────────────────────────────────────────────────
     ★新しい CSS はできるだけ書かない。カードそのものは my-value.css の
       .mr-gate（面・枠・左の橙の帯・影）と .mr-gate-t / .mr-gate-s /
       .mr-gate-cta / .mr-gate-x をそのまま借りる。my-value.css は
       出しうる 412 枚すべてに入っている（入っていない8枚は元から出さない画面）。
     ★色はすべて pv-tokens.css の --pv-* から取る。hex を直に書かない ──
       ライトとダークの両方に出るので、書いた瞬間どちらかで読めなくなる。 */
  var CSS = [
    '.pvgf-back{position:fixed;inset:0;z-index:9997;display:flex;align-items:center;',
      'justify-content:center;padding:16px;background:rgba(6,10,16,.66);opacity:0;',
      'transition:opacity .3s var(--pv-ease)}',
    '.pvgf-back.is-in{opacity:1}',
    '.pvgf-card{width:100%;max-width:520px;max-height:calc(100vh - 32px);overflow-y:auto;',
      '-webkit-overflow-scrolling:touch;margin:0;padding:26px 24px 22px;text-align:center;',
      'opacity:0;transform:translateY(10px) scale(.985);',
      'transition:opacity .36s var(--pv-ease),transform .36s var(--pv-ease)}',
    '.pvgf-back.is-in .pvgf-card{opacity:1;transform:none}',
    '@media (prefers-reduced-motion:reduce){',
      '.pvgf-back,.pvgf-card{opacity:1;transform:none;transition:none}}',
    '.pvgf-plane{font-size:2.4rem;line-height:1;margin-bottom:12px}',
    /* 見出しは中央。× のぶんの逃げ（padding-right）は要らない */
    '.pvgf-card .mr-gate-t{padding-right:0}',
    '.pvgf-card .mr-gate-s{max-width:none;margin-left:auto;margin-right:auto}',
    '.pvgf-hi{color:var(--pv-gold-ink);font-weight:800}',
    /* 登録はゴールではない、と一目で分かる2段（signup.html の .su-steps と同じ形）。
       あちらはインライン色、こちらはトークン ── 出る面の明暗が場所によって違うため。 */
    '.pvgf-steps{display:flex;align-items:center;justify-content:center;gap:7px;margin:14px 0}',
    '.pvgf-step{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;',
      'border-radius:999px;font-size:.73rem;font-weight:700;white-space:nowrap}',
    '.pvgf-step.is-done{background:var(--pv-line-soft);border:1px solid var(--pv-line);',
      'color:var(--pv-ink-3)}',
    '.pvgf-step.is-now{background:var(--pv-gold-soft);border:1px solid var(--pv-gold-line);',
      'color:var(--pv-gold-ink)}',
    '.pvgf-ar{color:var(--pv-ink-3);font-size:.78rem}',
    /* 3段の表は左揃え（真ん中に寄せると「出すもの → 見られるもの」の列がずれる） */
    '.pvgf-give{margin:16px 0 20px;text-align:left}',
    '.pvgf-give .pv-give{margin-top:0;max-width:none}',
    '.pvgf-b{display:flex;flex-direction:column;align-items:center;gap:6px}',
    '.pvgf-card .mr-gate-cta{margin-top:0}',
    /* 「あとで出す」は小さく下に（2026-09-15 オーナー指示。
       ボタンの形にすると主 CTA と同じ重さに見える） */
    '.pvgf-later{margin:2px 0 0;padding:8px 10px;background:none;border:0;border-radius:8px;',
      'font:inherit;font-size:.78rem;color:var(--pv-ink-3);text-decoration:underline;',
      'text-underline-offset:3px;cursor:pointer;',
      'transition:color .18s var(--pv-ease)}',
    '.pvgf-later:hover{color:var(--pv-ink)}',
    '.pvgf-later:focus-visible{outline:2px solid var(--pv-orange);outline-offset:2px}',
    '@media (max-width:420px){.pvgf-card{padding:22px 18px 18px}',
      '.pvgf-plane{font-size:2rem}}'
  ].join('');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function track(name, params) {
    try { if (typeof w.gtag === 'function') w.gtag('event', name, params || {}); } catch (e) {}
  }

  /* 給与フォームへの相対リンク。深さはページごとに違う
     （/airlines/… と /en/airlines/… は上へ戻る）。数え方は pv-session.js に1本だけ置く。 */
  function payHref() {
    var base = (w.PVSession && typeof w.PVSession.hrefTo === 'function')
      ? w.PVSession.hrefTo('pay-report.html')
      : 'pay-report.html';
    return base + '#ps';
  }

  var back = null, lastFocus = null, offKey = null, prevOverflow = '';

  function close(why) {
    if (!back) return;
    track('give_first', { choice: why || 'close' });
    var node = back;
    back = null;
    node.classList.remove('is-in');
    if (offKey) { d.removeEventListener('keydown', offKey, true); offKey = null; }
    try { d.body.style.overflow = prevOverflow; } catch (e) {}
    w.setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 320);
    try { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch (e) {}
    lastFocus = null;
  }

  function open() {
    if (back) return;
    if (!w.PVGates || typeof w.PVGates.giveGetHTML !== 'function') return;

    var style = d.getElementById('pvgf-css');
    if (!style) {
      style = d.createElement('style');
      style.id = 'pvgf-css';
      style.textContent = CSS;
      (d.head || d.documentElement).appendChild(style);
    }

    lastFocus = d.activeElement;

    back = d.createElement('div');
    back.className = 'pvgf-back';
    back.id = 'pvgf-back';
    back.innerHTML =
        '<div class="mr-gate pvgf-card" role="dialog" aria-modal="true"'
      + ' aria-label="' + esc(T.aria) + '">'
      + '<button type="button" class="mr-gate-x pvgf-x" aria-label="' + esc(T.close) + '">'
      + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
      + ' stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false">'
      + '<path d="M6 6l12 12M18 6L6 18"/></svg></button>'
      + '<div class="pvgf-plane" aria-hidden="true">✈️</div>'
      + '<div class="mr-gate-t">' + esc(T.title) + '</div>'
      + '<div class="pvgf-steps">'
      +   '<span class="pvgf-step is-done">' + esc(T.done) + '</span>'
      +   '<span class="pvgf-ar" aria-hidden="true">→</span>'
      +   '<span class="pvgf-step is-now">' + esc(T.now) + '</span>'
      + '</div>'
      + '<p class="mr-gate-s">' + esc(T.lead1)
      +   '<span class="pvgf-hi">' + esc(T.leadHi) + '</span>' + esc(T.lead2) + '</p>'
      /* ★3段はここで書かない。pv-gates.js の文言をそのまま借りる。
           引数 true（inPanel）＝ DEEP の札を押せるボタンにしない
           （押すと、この板の下にもう1枚パネルが開く）。 */
      + '<div class="pvgf-give">' + w.PVGates.giveGetHTML(true) + '</div>'
      + '<div class="pvgf-b">'
      +   '<a class="mr-gate-cta pvgf-go" href="' + esc(payHref()) + '">' + esc(T.cta) + '</a>'
      +   '<button type="button" class="pvgf-later">' + esc(T.later) + '</button>'
      + '</div>'
      + '</div>';

    d.body.appendChild(back);

    back.querySelector('.pvgf-x').addEventListener('click', function () { close('close'); });
    back.querySelector('.pvgf-later').addEventListener('click', function () { close('later'); });
    /* ★ここで back を捨てない。新しいタブで開かれた（⌘/Ctrl＋クリック）ときは
         この画面が残る。捨てると閉じる手が全部効かなくなり、body の overflow も
         hidden のままになる＝そのページが二度とスクロールできない。 */
    back.querySelector('.pvgf-go').addEventListener('click', function () {
      track('give_first', { choice: 'pay' });
    });
    /* カードの外を押したら閉じる（押し始めと離した先が両方とも外のときだけ。
       カードの中で押して外で離した＝文字の選択では閉じない）。 */
    var node = back;
    node.addEventListener('mousedown', function (ev) {
      if (ev.target === node) node.dataset.pvgfOut = '1';
    });
    node.addEventListener('click', function (ev) {
      var out = node.dataset.pvgfOut === '1';
      delete node.dataset.pvgfOut;
      if (ev.target === node && out) close('close');
    });

    offKey = function (ev) {
      if (ev.key === 'Escape' || ev.key === 'Esc') { ev.stopPropagation(); close('close'); }
    };
    d.addEventListener('keydown', offKey, true);

    try { prevOverflow = d.body.style.overflow; d.body.style.overflow = 'hidden'; } catch (e) {}

    /* 出したことを記録するのは**出せた瞬間だけ**。読み込みに失敗した回を
       「見た」と数えると、その人には二度と出ない。 */
    try {
      if (w.PVSession && typeof w.PVSession.markGiveFirstSeen === 'function') {
        w.PVSession.markGiveFirstSeen();
      }
    } catch (e) {}
    track('give_first_shown', {});

    /* 次のフレームで色を付ける（付けてから足すと動きが出ない）。 */
    w.requestAnimationFrame(function () {
      w.requestAnimationFrame(function () { if (back) back.classList.add('is-in'); });
    });
    try { back.querySelector('.pvgf-go').focus({ preventScroll: true }); } catch (e) {}
  }

  /* pv-gates.js を借りる。
     ⚠️ 左メニューの錠前は描かせない（PV_GATES_TEXT_ONLY）。描かせると、
        頼まれていない 400 枚のナビに錠前が付く（data-mr-gate は全ページにある）。 */
  function withGates(cb) {
    if (w.PVGates && typeof w.PVGates.giveGetHTML === 'function') return cb();
    if (!SELF) return;
    w.PV_GATES_TEXT_ONLY = true;
    var s = d.createElement('script');
    try { s.src = new URL('pv-gates.js', SELF).href; } catch (e) { return; }
    s.onload = cb;
    s.onerror = function () {};      /* 借りられなければ黙って出さない */
    (d.head || d.documentElement).appendChild(s);
  }

  /* 3段の表と板の見た目（pv-give.css）を借りる。
     ⚠️ **my-value.css を借りに行かない。** あちらは 62KB あり、
        .mr-main / .mp-* のようにマイページ専用の規則が混ざっている。
        全ページへ配ると、関係のない画面の作りに手を入れてしまう
        （2026-09-15 に world-airlines.html で実際に確かめた ── my-value.css を
        <link> で読んでいるのは 420枚のうち **18枚だけ**。残りでは板が
        背景も罫線も無い素の文字列になっていた）。
     ★読み終わるのを待ってから開く。待たずに開くと、素の文字列が一瞬見えてから
       板になる（このパネルは画面を覆うので、その一瞬がいちばん目に付く）。 */
  function withCss(cb) {
    if (!SELF) return cb();
    var href;
    try { href = new URL('pv-give.css', SELF).href; } catch (e) { return cb(); }
    var have = Array.prototype.some.call(
      d.querySelectorAll('link[rel="stylesheet"]'),
      function (l) { return l.href === href; });
    if (have) return cb();
    var l = d.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    l.onload = cb;
    l.onerror = cb;                  /* 取れなくても文字は読める。黙って出す */
    (d.head || d.documentElement).appendChild(l);
  }

  function start() {
    /* 画面が描き終わってから。読み込みと同時に覆うと、本文を一度も見せずに塞ぐ。 */
    w.setTimeout(function () { withCss(function () { withGates(open); }); }, 700);
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();

  w.PVGiveFirst = { open: open, close: close };
})(window, document);
