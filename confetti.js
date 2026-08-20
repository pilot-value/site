/* PVConfetti — 給与を出した瞬間に1回だけ鳴らすクラッカー。

   なぜ要るか。ここは「他人の数字を見に来た人が、自分の数字を差し出す」場所で、
   出した見返りは今のところ画面の数字だけ。出し終わりが静かだと、
   出した人に何も返っていないように見える。毎月出し直してもらうのが North Star
   なので、出し終わりは気持ちよく終わらせる。

   ・外部ライブラリを読まない（このサイトは素の HTML。1画面の演出のために
     CDN を1本増やすと、遅い回線で本題の表示まで待たされる）。
   ・canvas 1枚。終わったら自分で消える。DOM に何も残さない。
   ・動かすのは transform 相当（canvas の座標）と透明度だけ。
   ・「動きを控える」設定の人には何も出さない。★出さないだけで、
     画面の中身は1つも変わらない（消える要素を作らない）。

   使い方:
     window.PVConfetti()              ← 紙吹雪。引数なし。二重に呼んだら前の1枚を捨てる。
     window.PVConfetti.badge(カード)  ← そのカードの上辺にまたがる丸い 🎉 を1個置く。
                                        紙吹雪とは切り離してある（下の badge のコメント参照）。 */
(function () {
  'use strict';

  /* ★2026-08-18: 「ブランドの色だけ」をやめた（オーナー判断）。紙吹雪が黄〜緑だけだと
     色数が足りず賑やかに見えないため、青・赤も混ぜる。
     ただし新しい色は発明しない。足す2色はサイトに既にある値を持ってくる
     （#5fb0ff = 比較バーの左端、#f87171 = エラーの赤）。
     ★明るいテーマでは白っぽい紙が背景に溶けて「数が半分」に見えるので、
       濃いほうの色に差し替える。同じ配列を使い回さない。 */
  var DARK  = ['#f5c842', '#f7d15e', '#fb923c', '#f97316', '#34d399', '#48c78e', '#5fb0ff', '#3b82f6', '#f87171', '#e8edf2'];
  var LIGHT = ['#f5c842', '#eab308', '#fb923c', '#f97316', '#34d399', '#0d8a63', '#2563eb', '#1e3a8a', '#dc2626', '#a8b3c2'];

  var TAU = Math.PI * 2;
  var live = null;                    // いま出ている canvas（二重起動の始末用）

  function quiet() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  function piece(colors, x, y, angle, speed) {
    var round = Math.random() < 0.22;
    return {
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: round ? 0 : 6 + Math.random() * 5,
      h: round ? 0 : 9 + Math.random() * 7,
      r: round ? 3 + Math.random() * 2 : 0,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * TAU,
      vrot: (Math.random() - 0.5) * 6,
      /* ヒラヒラの正体。横の縮尺を cos で振ると紙が裏返り、
         同じ位相で左右に流すと、落ちながら舞っているように見える。 */
      wob: Math.random() * TAU,
      vwob: 4 + Math.random() * 3,
      sway: 120 + Math.random() * 150,
      /* 落ちる速さの頭打ち。これが無いと重力で一気に落ちて一瞬で終わる。
         紙ごとにばらつかせる＝同じ高さで揃って落ちない。 */
      term: 130 + Math.random() * 130
    };
  }

  /* クラッカー1発ぶん。画面下の隅から内側へ斜め上に打ち上げる。 */
  function burst(list, colors, w, h, side) {
    var x = side < 0 ? w * 0.06 : w * 0.94;
    var y = h * 0.98;
    var base = side < 0 ? -Math.PI / 3 : -Math.PI * 2 / 3;   // 上向き60度
    for (var i = 0; i < 58; i++) {
      var a = base + (Math.random() - 0.5) * 1.0;
      list.push(piece(colors, x, y, a, 1050 + Math.random() * 700));
    }
  }

  window.PVConfetti = function () {
    if (quiet() || document.hidden) return;
    if (live && live.parentNode) live.parentNode.removeChild(live);

    var cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;' +
                       'pointer-events:none;z-index:300';
    document.body.appendChild(cv);
    live = cv;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth, h = window.innerHeight;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    var ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);

    var colors = document.documentElement.getAttribute('data-theme') === 'light' ? LIGHT : DARK;
    var bits = [];
    burst(bits, colors, w, h, -1);
    burst(bits, colors, w, h, 1);
    /* 2発目を少し遅らせる。同時に2発だと1回の爆発に見えて、クラッカーにならない。 */
    var second = setTimeout(function () {
      if (live !== cv) return;
      burst(bits, colors, w, h, -1);
      burst(bits, colors, w, h, 1);
    }, 230);

    var t0 = null, last = null;
    function frame(t) {
      if (live !== cv) return;
      if (t0 === null) { t0 = t; last = t; }
      var dt = Math.min((t - last) / 1000, 0.05);       // タブが戻った瞬間に飛ばない
      last = t;
      var age = t - t0;

      ctx.clearRect(0, 0, w, h);
      var alive = 0;
      for (var i = 0; i < bits.length; i++) {
        var p = bits[i];
        p.vy += 900 * dt;                                // 重力
        if (p.vy > p.term) p.vy = p.term;                // 頭打ち＝ここから先はゆっくり落ちる
        p.vx -= p.vx * 1.6 * dt;                         // 打ち上げの勢いは空気で消える
        p.wob += p.vwob * dt;
        p.x += (p.vx + Math.cos(p.wob) * p.sway) * dt;   // 左右に流れながら
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        if (p.y > h + 60) continue;
        alive++;
        ctx.save();
        ctx.globalAlpha = age > 4200 ? Math.max(0, 1 - (age - 4200) / 1300) : 1;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.r) { ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill(); }
        else { ctx.scale(Math.cos(p.wob), 1); ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
        ctx.restore();
      }

      if (!alive || age > 7000) {
        clearTimeout(second);
        if (cv.parentNode) cv.parentNode.removeChild(cv);
        if (live === cv) live = null;
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  /* ── カードの上辺にまたがる丸い 🎉 ──────────────────────────
     なぜ関数にするか。同じ見た目を4枚（日英 × 給与の受け取り画面・口コミの完了画面）に
     置く。CSS を4回コピーすると片方だけ直る事故になるので、ここに1本だけ持つ
     （pay-login.js が同じやり方で自分の CSS を挿している）。

     ★紙吹雪と切り離してある。紙吹雪は「動きを控える」設定の人と裏タブでは何も出さないが、
       この丸は「あなたのデータは受け取ってある」という画面の中身なので、必ず出す。
       止めるのは animation だけ（結果カードの .res-pop と同じ扱い）。 */
  var BADGE_CSS =
    '.pv-pop-host{position:relative;padding-top:46px}' +
    '.pv-pop{position:absolute;top:-30px;left:50%;transform:translateX(-50%);' +
      'width:60px;height:60px;border-radius:50%;display:grid;place-items:center;' +
      'font-size:1.7rem;line-height:1;background:#f7f9fc;' +
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.9),' +
                 '0 3px 10px -3px rgba(245,200,66,.55),' +
                 '0 18px 34px -14px rgba(8,12,20,.75);' +
      'animation:pvPop .62s cubic-bezier(.2,1.5,.32,1) both}' +
    /* ★transform を2つの役目で使っている。中央寄せの translateX(-50%) を
       keyframes 側にも書く。書き忘れると、はねている間だけ丸が右へ半分ずれる。 */
    '@keyframes pvPop{from{opacity:0;transform:translateX(-50%) scale(.4) rotate(-16deg)}' +
                     'to{opacity:1;transform:translateX(-50%) scale(1) rotate(0)}}' +
    '[data-theme="light"] .pv-pop{background:#fff;' +
      'box-shadow:0 3px 10px -3px rgba(184,134,11,.38),0 16px 30px -14px rgba(15,23,42,.3)}' +
    '@media (prefers-reduced-motion:reduce){.pv-pop{animation:none}}';

  function injectBadgeCss() {
    if (document.getElementById('pv-pop-style')) return;
    var st = document.createElement('style');
    st.id = 'pv-pop-style';
    st.textContent = BADGE_CSS;
    document.head.appendChild(st);
  }

  window.PVConfetti.badge = function (card) {
    if (!card || card.dataset.pvPop === '1') return;    // 二度置かない
    injectBadgeCss();
    card.dataset.pvPop = '1';
    card.classList.add('pv-pop-host');
    var b = document.createElement('div');
    b.className = 'pv-pop';
    b.setAttribute('aria-hidden', 'true');   // 見出しの ✓ が既に同じことを言っている
    b.textContent = '🎉';
    card.insertBefore(b, card.firstChild);
  };
})();
