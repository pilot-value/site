/* ════════════════════════════════════════════════════════════════
   pv-proof-offer.js — パイロットであることの確認の「申請」ポップアップ（2026-10-16）

   オーナー指示（2026-10-16）
     「会員が画像を出す入口…マイページに1か所で、いいよ。でも今後必要になるページがたくさん出て
       くるかもしれないから、ポップアップでパイロットである認証が必要になるだろうから、それを作って
       (この間アカウント停止の人に作ったやつでいいと思う)」

   ★止めない。いつでも閉じられる（×・ESC・外側を押す）。出しても REAL PAY・DEEP PAY・口コミ本文・
     ホテルの追加のどれも止まらない（決めているのはサーバ ── db/proof-offer.sql と db/stays.sql 10-c）。
   ★見た目と画像の作り（canvas で JPEG に焼き直す・800KB に収める・JPEG か PNG だけ）は、止まった会員の板
     （pv-proof.js）のものを使う。▼ と ▲ のあいだは pv-proof.js の切り出しそのまま（クラス名の頭 pvpf- を
     pvpo- に替えただけ）。assert-proof-offer.mjs が1文字ずつ見ている ── 片方だけ直さない。
   ★送るのは pv_stay_apply の1本だけ（{p:{image}}）。pv_proof_submit・pv_proof_state は呼ばない。
     止まった会員の板の写し（localStorage の pv_proof）も読まない・書かない。
   ★画面に出すのは決まった文言だけ。サーバの返事の字はそのまま出さない。画像はどこにも保存しない。
   使い方
     マイページ   … <div id="pv-proof-slot"></div> を置いてこのファイルを読む（その場所に入口のカードを描く）
     ほかのページ … <button type="button" data-pv-proof-open>…</button> を置いてこのファイルを読む
                    （または PVProofOffer.open({ client: sb })）
     ★そのページのクライアント（sb）を借りる。無いページでは送れない（「送信できませんでした」）。
   ⚠️ ホテルの追加からは開かない（オーナー指示：名前 → 送信1回・ログインも申請もいらない）。
   ⚠️ 会員を名指しで書かない（公開リポジトリ）。文言に「確認後の画像の扱い」を書かない（pv-proof.js と同じ）。
════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';

  if (w.PVProofOffer) return;
  var L = (d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';

  /* 文言。★印の付いていないものは pv-proof.js（止まった会員の板）と同じ字。
     ★NEW の4つ（lead2・okT・eUnavail・slotS）は pv-proof.js に無い字。
       日本語の lead2・slotS・okT はオーナーの言葉（2026-10-16「Only VERIFIED PILOT」「VERIFIED PILOT です」）。
       ホテルの欄の鍵の1行（career-stay.js）と同じ字 ── 片方だけ直さない（大文字は O だけ）。 */
  var T = {
    ja: {
      t:        'パイロットであることの確認をお願いします',
      lead:     'パイロットであることが分かる画像を1枚ご提出ください。',
      lead2:    'Only VERIFIED PILOT',                                                        // NEW
      exT:      '提出できる画像の例',
      ex:       ['肩章', 'ウィングバッジ', '事業用操縦士の免許証', '勤務表'],
      etc:      'など',
      pick:     '画像を選んで提出する',
      pickedS:  'この画像を提出します。よろしければ下のボタンを押してください。',
      send:     'この画像を提出する',
      sending:  '送信しています…',
      repick:   '選び直す',
      doneT:    '画像を受け取りました',
      doneS:    '運営が確認するまでお待ちください。',
      redo:     '別の画像を出し直す',
      alt:      '提出する画像',
      close:    '閉じる',
      okT:      'VERIFIED PILOT です',                                                         // NEW
      slotS:    'Only VERIFIED PILOT',                                                        // NEW
      eType:    'この画像は読み込めませんでした。JPEG か PNG の画像を選んでください。',
      eBig:     '画像が大きすぎます。別の画像を選んでください。',
      eNet:     '送信できませんでした。通信状況を確かめて、もう一度お試しください。',
      eMany:    '提出の回数が上限に達しました。お問い合わせからご連絡ください。',
      eUnavail: 'いまは受け付けられません。お問い合わせからご連絡ください。'                          // NEW
    },
    en: {
      t:        'Please confirm that you are a pilot',
      lead:     'Please submit one image showing that you are a pilot.',
      lead2:    'Once we have confirmed it, you will also be able to see what only confirmed pilots can see.',   // NEW
      exT:      'Examples of what you can submit',
      ex:       ['Epaulettes', 'Wing badge', 'Commercial pilot licence', 'Roster'],
      etc:      'etc.',
      pick:     'Choose an image to submit',
      pickedS:  'This image will be submitted. If it looks right, press the button below.',
      send:     'Submit this image',
      sending:  'Sending…',
      repick:   'Choose another',
      doneT:    'We have received your image',
      doneS:    'Please wait while we review it.',
      redo:     'Submit a different image',
      alt:      'The image you are submitting',
      close:    'Close',
      okT:      'You are a confirmed pilot',                                                   // NEW
      slotS:    'Some information can only be seen by confirmed pilots.',                      // NEW
      eType:    'This image could not be read. Please choose a JPEG or PNG image.',
      eBig:     'This image is too large. Please choose a different one.',
      eNet:     'It could not be sent. Please check your connection and try again.',
      eMany:    'You have reached the submission limit. Please get in touch via the contact page.',
      eUnavail: 'We cannot accept it right now. Please get in touch via the contact page.'      // NEW
    }
  }[L];

  /* ▼ pv-proof.js の切り出しそのまま（K1：板の見た目）── 直さない。assert-proof-offer.mjs が1文字ずつ見ている */
  var CSS = [
    /* ★スクロールを止めるのは class で（body の style を直に書かない）。
       ほかの部品（search.js の引き出し・app-nav.js）が閉じるときに
       body.style.overflow を空に戻すので、直に書いた分は ESC 1回で外れる。 */
    'html.pvpo-lock,html.pvpo-lock body{overflow:hidden!important}',
    '.pvpo-back{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;',
      'justify-content:center;padding:16px;',
      'background:radial-gradient(120% 70% at 50% 0%,rgba(46,58,82,.5),rgba(46,58,82,0) 62%),',
      'rgba(6,10,16,.95);opacity:0;transition:opacity .3s var(--pv-ease,ease)}',
    '.pvpo-back.is-in{opacity:1}',
    '.pvpo-card{box-sizing:border-box;position:relative;width:100%;max-width:480px;',
      'max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow-y:auto;',
      '-webkit-overflow-scrolling:touch;margin:0;padding:28px 26px 18px;text-align:left;',
      'background:var(--pv-surface,#fff);color:var(--pv-ink,#0f172a);',
      'border:1px solid var(--pv-line,rgba(15,23,42,.12));',
      'border-top:3px solid var(--pv-gold-ink,#92600a);border-radius:var(--pv-r,14px);',
      'box-shadow:0 1px 2px rgba(6,10,16,.24),0 14px 30px -12px rgba(6,10,16,.55),',
      '0 40px 90px -30px rgba(6,10,16,.75);',
      'opacity:0;transform:translateY(10px) scale(.985);',
      'transition:opacity .36s var(--pv-ease,ease),transform .36s cubic-bezier(.34,1.3,.64,1)}',
    '.pvpo-back.is-in .pvpo-card{opacity:1;transform:none}',
    '.pvpo-card:focus{outline:none}',
    '@media (prefers-reduced-motion:reduce){',
      '.pvpo-back,.pvpo-card{opacity:1;transform:none;transition:none}}',
    /* 見出しは行の長さをそろえて折る（狭い画面で末尾の1文字だけが次の行に落ちない） */
    '.pvpo-t{margin:0;font-size:1.12rem;font-weight:800;letter-spacing:-.03em;line-height:1.4;',
      'color:var(--pv-ink,#0f172a);text-wrap:balance;line-break:strict;word-break:auto-phrase}',
    '.pvpo-s{margin:10px 0 0;font-size:.84rem;line-height:1.75;color:var(--pv-ink-2,#334155);',
      'line-break:strict;word-break:auto-phrase}',
    '.pvpo-exT{margin:18px 0 0;font-size:.72rem;font-weight:700;letter-spacing:.02em;',
      'color:var(--pv-ink-3,#64748b)}',
    '.pvpo-ex{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0 0;padding:0;',
      'list-style:none}',
    '.pvpo-ex li{padding:5px 11px;border-radius:999px;font-size:.76rem;font-weight:700;',
      'line-height:1.5;background:var(--pv-gold-soft,#fdf6e3);',
      'border:1px solid var(--pv-gold-line,rgba(146,96,10,.28));color:var(--pv-gold-ink,#92600a)}',
    '.pvpo-ex li.pvpo-etc{padding:5px 2px;background:none;border-color:transparent;',
      'font-weight:600;color:var(--pv-ink-3,#64748b)}',
    '.pvpo-prev{margin:16px 0 0;border:1px solid var(--pv-line,rgba(15,23,42,.12));',
      'border-radius:10px;overflow:hidden;background:var(--pv-line-soft,#f1f5f9)}',
    '.pvpo-prev img{display:block;width:100%;max-height:240px;object-fit:contain}',
    '.pvpo-err{margin:14px 0 0;font-size:.78rem;font-weight:600;line-height:1.7;',
      'color:var(--pv-orange-ink,#c2410c)}',
    '.pvpo-b{display:flex;flex-direction:column;align-items:stretch;gap:4px;margin:20px 0 0}',
    '.pvpo-go{display:flex;align-items:center;justify-content:center;width:100%;margin:0;',
      'padding:13px 20px;border:0;border-radius:999px;background:var(--pv-orange,#f97316);',
      'color:#fff;font:inherit;font-size:.88rem;font-weight:700;cursor:pointer;',
      'box-shadow:0 1px 1px rgba(194,65,12,.3),0 10px 22px -12px rgba(249,115,22,.9);',
      'transition:opacity .18s var(--pv-ease,ease),box-shadow .18s var(--pv-ease,ease),',
      'transform .18s cubic-bezier(.34,1.3,.64,1)}',
    '.pvpo-go:hover{opacity:.92;box-shadow:0 1px 1px rgba(194,65,12,.3),',
      '0 12px 26px -12px rgba(249,115,22,.85)}',
    '.pvpo-go:focus-visible{outline:2px solid var(--pv-orange,#f97316);outline-offset:3px}',
    '.pvpo-go:active{transform:scale(.98)}',
    '.pvpo-go[disabled]{opacity:.6;cursor:default;transform:none}',
    '.pvpo-re,.pvpo-foot button,.pvpo-foot a{margin:0;padding:9px 10px;background:none;border:0;',
      'border-radius:8px;font:inherit;font-size:.78rem;color:var(--pv-ink-3,#64748b);',
      'text-decoration:underline;text-underline-offset:3px;cursor:pointer;',
      'transition:color .18s var(--pv-ease,ease)}',
    '.pvpo-re{align-self:center}',
    '.pvpo-re:hover,.pvpo-foot button:hover,.pvpo-foot a:hover{color:var(--pv-ink,#0f172a)}',
    '.pvpo-re:focus-visible,.pvpo-foot button:focus-visible,.pvpo-foot a:focus-visible{',
      'outline:2px solid var(--pv-orange,#f97316);outline-offset:2px}',
    '.pvpo-re:active,.pvpo-foot button:active,.pvpo-foot a:active{opacity:.7}',
    '.pvpo-re[disabled]{opacity:.5;cursor:default}',
    '.pvpo-foot{display:flex;justify-content:center;gap:14px;margin:16px 0 0;padding:10px 0 0;',
      'border-top:1px solid var(--pv-line,rgba(15,23,42,.12))}',
    '@media (max-width:420px){.pvpo-card{padding:24px 20px 14px}.pvpo-t{font-size:1.04rem}}'
  ].join('');
  /* ▲ */

  /* 板に足すもの（閉じるボタン・マイページのカードの間隔）。★止まった会員の板には無いもの */
  var CSS_MORE = [
    '.pvpo-x{position:absolute;top:10px;right:10px;width:36px;height:36px;display:flex;align-items:center;',
      'justify-content:center;margin:0;padding:0;border:0;border-radius:999px;background:none;cursor:pointer;',
      'color:var(--pv-ink-3,#64748b);font:inherit;font-size:1.2rem;line-height:1;',
      'transition:color .18s var(--pv-ease,ease),transform .18s cubic-bezier(.34,1.3,.64,1)}',
    '.pvpo-x:hover{color:var(--pv-ink,#0f172a)}',
    '.pvpo-x:focus-visible{outline:2px solid var(--pv-orange,#f97316);outline-offset:2px}',
    '.pvpo-x:active{transform:scale(.94)}',
    '.pvpo-slot-card{margin-top:20px}'
  ].join('');

  /* ▼ pv-proof.js の切り出しそのまま（K2：字の逃がし方）── 直さない。assert-proof-offer.mjs が1文字ずつ見ている */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
  }
  /* ▲ */

  /* ▼ pv-proof.js の切り出しそのまま（K3：そのページのクライアントを借りる）── 直さない。assert-proof-offer.mjs が1文字ずつ見ている */
  function borrowed() {
    try {
      /* eslint-disable-next-line no-undef */
      return (typeof sb !== 'undefined' && sb && typeof sb.rpc === 'function') ? sb : null;
    } catch (e) { return null; }
  }
  function viaClient(c, name, args) {
    return c.rpc(name, args || {}).then(function (r) {
      if (r && r.error) throw r.error;
      return r ? r.data : null;
    });
  }
  /* ▲ */

  var given = null;
  function rpc(name, args) {
    var c = given || borrowed();
    if (!c) return Promise.reject(new Error('no-auth'));
    /* ★同期の throw も「then だけの箱」も、ふつうの Promise にそろえる（ページによって sb の作りが違う） */
    return Promise.resolve().then(function () { return viaClient(c, name, args); });
  }

  /* ▼ pv-proof.js の切り出しそのまま（K4：画像を JPEG に焼き直す）── 直さない。assert-proof-offer.mjs が1文字ずつ見ている */
  /* ── 画像を小さくして JPEG に焼き直す（roadmap.js の shrinkImage と同じ作り）──
     ★上限は SQL の pv_proof_images_len_ck（900000）より小さくしてある。
     ★収まるまで画質を1段ずつ落とし、それでも収まらなければ一回り小さくして
       もう一度だけ試す。勝手に諦めない・勝手に巨大なものを送らない。 */
  var IMG_MAX  = 800000;
  var IMG_EDGE = [1800, 1280];
  var IMG_Q    = [0.86, 0.76, 0.66, 0.56, 0.46, 0.36];

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

  function encodeAt(cv, i) {
    return new Promise(function (done, fail) {
      cv.toBlob(function (b) {
        if (!b) { fail(new Error('type')); return; }
        if (b.size <= IMG_MAX || i >= IMG_Q.length - 1) { done(b); return; }
        encodeAt(cv, i + 1).then(done, fail);
      }, 'image/jpeg', IMG_Q[i]);
    });
  }

  function drawAt(im, edge) {
    var iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    if (!iw || !ih) throw new Error('type');
    var k  = Math.min(1, edge / Math.max(iw, ih));
    var cw = Math.max(1, Math.round(iw * k)), ch = Math.max(1, Math.round(ih * k));
    var cv = d.createElement('canvas');
    cv.width = cw; cv.height = ch;
    var cx = cv.getContext ? cv.getContext('2d') : null;
    if (!cx) throw new Error('type');
    /* ★先に白で塗る。透過の PNG をそのまま JPEG にすると、抜けた所が黒く潰れる。 */
    cx.fillStyle = 'white';
    cx.fillRect(0, 0, cw, ch);
    cx.drawImage(im, 0, 0, cw, ch);
    return cv;
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
        var step = function (n) {
          return encodeAt(drawAt(im, IMG_EDGE[n]), 0).then(function (b) {
            if (b.size <= IMG_MAX) return b;
            if (n >= IMG_EDGE.length - 1) throw new Error('big');
            return step(n + 1);
          });
        };
        Promise.resolve().then(function () { return step(0); }).then(function (b) {
          return toB64(b).then(function (b64) {
            if (!b64) throw new Error('type');
            done({ b64: b64, blob: b });
          });
        }).then(null, fail);
      };
      im.src = url;
    });
  }
  /* ▲ */

  /* ── ポップアップ ─────────────────────────────────────────── */
  var back = null, card = null, file = null, opener = null, onDone = null;
  var picked = null, busy = false, errText = '', done = false;
  var inerted = [], watch = null;

  /* ▼ pv-proof.js の切り出しそのまま（K5：開いているあいだ下の画面に触らせない）── 直さない。assert-proof-offer.mjs が1文字ずつ見ている */
  function hush(el) {
    if (!el || el === back || el.nodeType !== 1) return;
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') return;
    if (el.hasAttribute('inert')) return;
    el.setAttribute('inert', '');
    inerted.push(el);
  }

  function lock() {
    d.documentElement.classList.add('pvpo-lock');
    Array.prototype.forEach.call(d.body.children, hush);
    /* あとから body に足されるもの（ほかの板・トースト）も下に置いたままにする */
    if (typeof w.MutationObserver === 'function') {
      watch = new w.MutationObserver(function (ms) {
        ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, hush); });
      });
      watch.observe(d.body, { childList: true });
    }
  }

  function unlock() {
    if (watch) { watch.disconnect(); watch = null; }
    inerted.forEach(function (el) { el.removeAttribute('inert'); });
    inerted = [];
    d.documentElement.classList.remove('pvpo-lock');
  }
  /* ▲ */

  function xBtn() {
    return '<button type="button" class="pvpo-x" data-act="close" aria-label="' + esc(T.close) + '">×</button>';
  }

  function html() {
    var err = errText ? '<p class="pvpo-err" role="alert">' + esc(errText) + '</p>' : '';
    var dis = busy ? ' disabled' : '';
    if (done) {
      return xBtn()
           + '<h2 class="pvpo-t" id="pvpo-t">' + esc(T.doneT) + '</h2>'
           + '<p class="pvpo-s">' + esc(T.doneS) + '</p>'
           + '<div class="pvpo-b"><button type="button" class="pvpo-go" data-act="close">' + esc(T.close) + '</button></div>';
    }
    if (picked) {
      return xBtn()
           + '<h2 class="pvpo-t" id="pvpo-t">' + esc(T.t) + '</h2>'
           + '<p class="pvpo-s">' + esc(T.pickedS) + '</p>'
           + '<div class="pvpo-prev"><img src="' + esc(picked.url) + '" alt="' + esc(T.alt) + '"></div>'
           + err
           + '<div class="pvpo-b">'
           +   '<button type="button" class="pvpo-go" data-act="send"' + dis + '>' + esc(busy ? T.sending : T.send) + '</button>'
           +   '<button type="button" class="pvpo-re" data-act="pick"' + dis + '>' + esc(T.repick) + '</button>'
           + '</div>';
    }
    return xBtn()
         + '<h2 class="pvpo-t" id="pvpo-t">' + esc(T.t) + '</h2>'
         + '<p class="pvpo-s">' + esc(T.lead) + esc(T.lead2) + '</p>'
         + '<p class="pvpo-exT">' + esc(T.exT) + '</p>'
         + '<ul class="pvpo-ex">'
         +   T.ex.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('')
         +   '<li class="pvpo-etc">' + esc(T.etc) + '</li>'
         + '</ul>'
         + err
         + '<div class="pvpo-b"><button type="button" class="pvpo-go" data-act="pick">' + esc(T.pick) + '</button></div>';
  }

  function render(keepFocus) {
    if (!card) return;
    card.innerHTML = html();
    if (keepFocus) return;
    var f = card.querySelector('.pvpo-go:not([disabled])') || card.querySelector('.pvpo-x') || card;
    try { f.focus({ preventScroll: true }); } catch (e) {}
  }

  function dropPicked() {
    if (picked && picked.url) { try { w.URL.revokeObjectURL(picked.url); } catch (e) {} }
    picked = null;
  }

  function onPick() {
    if (busy || !file) return;
    file.value = '';
    file.click();
  }

  function onFile() {
    var f = file && file.files && file.files[0];
    if (!f) return;
    errText = '';
    shrinkImage(f).then(function (r) {
      if (!back) return;
      dropPicked();
      picked = { b64: r.b64, url: w.URL.createObjectURL(r.blob) };
      render();
    }, function (e) {
      if (!back) return;
      errText = (e && e.message === 'big') ? T.eBig : T.eType;
      render();
    });
  }

  function onSend() {
    if (busy || !picked) return;
    busy = true; errText = '';
    render();
    rpc('pv_stay_apply', { p: { image: picked.b64 } }).then(function (v) {
      busy = false;
      if (!back) return;
      if (v && v.ok === true && (v.state === 'offered' || v.state === 'approved')) {
        dropPicked(); done = true; render();
        if (typeof onDone === 'function') { try { onDone(v.state); } catch (e) {} }
        return;
      }
      var st = v && v.status;
      errText = st === 'too_many' ? T.eMany
              : st === 'image_too_big' ? T.eBig
              : st === 'image_bad' ? T.eType
              : (st === 'unavailable' || st === 'closed' || st === 'login') ? T.eUnavail : T.eNet;
      if (st === 'image_too_big' || st === 'image_bad') dropPicked();
      render();
    }, function () {
      busy = false;
      if (!back) return;
      errText = T.eNet; render();
    });
  }

  function onClick(e) {
    if (e.target === back) { close(); return; }          // 外側を押すと閉じる
    var t = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t || !card || !card.contains(t)) return;
    var a = t.getAttribute('data-act');
    if (a === 'pick') onPick();
    else if (a === 'send') onSend();
    else if (a === 'close') close();
  }

  /* ESC で閉じる。開いているあいだ、フォーカスはポップアップの中だけを回る。 */
  function onKey(e) {
    if (!back) return;
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    var list = card.querySelectorAll('button:not([disabled]), a[href]');
    if (!list.length) { e.preventDefault(); return; }
    var first = list[0], last = list[list.length - 1], at = d.activeElement;
    if (!card.contains(at)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
  }

  function open(opts) {
    opts = opts || {};
    if (back || !d.body) return;
    if (opts.client) given = opts.client;
    onDone = opts.onDone || null;
    opener = d.activeElement;
    picked = null; busy = false; errText = ''; done = false;
    if (!d.getElementById('pvpo-css')) {
      var st = d.createElement('style');
      st.id = 'pvpo-css';
      st.textContent = CSS + CSS_MORE;
      (d.head || d.documentElement).appendChild(st);
    }
    back = d.createElement('div');
    back.className = 'pvpo-back';
    back.id = 'pvpo-back';
    back.innerHTML = '<div class="pvpo-card" role="dialog" aria-modal="true" aria-labelledby="pvpo-t" tabindex="-1"></div>'
                   + '<input type="file" accept="image/*" hidden>';
    card = back.firstChild;
    file = back.lastChild;
    file.addEventListener('change', onFile);
    back.addEventListener('click', onClick);
    d.addEventListener('keydown', onKey, true);
    d.body.appendChild(back);
    lock();
    render(true);
    try { card.focus({ preventScroll: true }); } catch (e) {}
    (w.requestAnimationFrame || w.setTimeout)(function () { if (back) back.classList.add('is-in'); });
  }

  function close() {
    if (!back) return;
    d.removeEventListener('keydown', onKey, true);
    dropPicked();
    unlock();
    if (back.parentNode) back.parentNode.removeChild(back);
    back = card = file = null;
    busy = false; errText = '';
    var o = opener; opener = null;
    if (o && typeof o.focus === 'function' && d.contains(o)) { try { o.focus({ preventScroll: true }); } catch (e) {} }
  }

  /* ── マイページの入口（いつもある1か所）──────────────────────
     返事が none → 「画像を選んで提出する」／offered → 「別の画像を出し直す」／approved → 確認済みの1行だけ。
     それ以外（未ログイン・オーナー・まだ受け付けていない・読めない）は何も描かない。
     ★字は textContent で入れる。サーバの返事の字はそのまま出さない。 */
  function mount(slot, opts) {
    opts = opts || {};
    if (!slot) return Promise.resolve(null);
    if (opts.client) given = opts.client;
    return rpc('pv_stay_apply', { p: {} }).then(function (v) {
      var st = v && v.ok === true ? v.state : '';
      draw(slot, st);
      return st || null;
    }, function () { draw(slot, ''); return null; });
  }

  function draw(slot, st) {
    while (slot.firstChild) slot.removeChild(slot.firstChild);
    if (st !== 'none' && st !== 'offered' && st !== 'approved') return;
    if (!d.getElementById('pvpo-css')) {
      var cs = d.createElement('style');
      cs.id = 'pvpo-css';
      cs.textContent = CSS + CSS_MORE;
      (d.head || d.documentElement).appendChild(cs);
    }
    var box = d.createElement('div');
    box.className = 'glass mp-row pvpo-slot-card';
    box.setAttribute('data-pvpo-state', st);
    var b = d.createElement('div'); b.className = 'mp-row-b';
    var t = d.createElement('div'); t.className = 'mp-row-t';
    var s = d.createElement('div'); s.className = 'mp-row-s';
    t.textContent = st === 'approved' ? T.okT : st === 'offered' ? T.doneT : T.t;
    s.textContent = st === 'approved' ? T.slotS : st === 'offered' ? T.doneS : T.lead;
    b.appendChild(t); b.appendChild(s); box.appendChild(b);
    if (st !== 'approved') {
      var btn = d.createElement('button');
      btn.type = 'button';
      btn.className = 'mp-cta';
      btn.textContent = st === 'offered' ? T.redo : T.pick;
      btn.addEventListener('click', function () {
        open({ onDone: function () { mount(slot); } });
      });
      box.appendChild(btn);
    }
    slot.appendChild(box);
  }

  w.PVProofOffer = { open: open, close: close, mount: mount };

  function boot() {
    var slot = d.getElementById('pv-proof-slot');
    if (slot) mount(slot);
    d.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-pv-proof-open]') : null;
      if (t) { e.preventDefault(); open(); }
    });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
