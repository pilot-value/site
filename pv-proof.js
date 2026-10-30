/* ════════════════════════════════════════════════════════════════
   pv-proof.js — パイロットであることの確認を求められている会員に出す板（2026-10-13）

   オーナー指示
     「パイロットではない会員のアカウントを止める。ログイン後の画面に、
       パイロットであることを示す画像（肩章・ウィングバッジ・事業用操縦士の
       免許証・勤務表など）を出すボタンを置く。出すまでサイトの詳細は見せない。」

   ★**本体はサーバ側。** 止まっている会員には、REAL PAY・DEEP PAY・口コミ本文の
     3つの門が中身を返さない（db/pay-rows.sql 1-e2）。この板は「なぜ見られないのか・
     何を出せばよいのか」を伝えるだけ。消しても中身は1つも出てこない。
   ★読むかどうかを決めるのは pv-session.js の proofDue() の1か所だけ。
     このファイルは、呼ばれたら「聞く（ask）」か「出す（show）」のどちらかをする。
     未ログインの人には読み込まれない＝通信は1本も増えない。
   ★閉じる手段を置かない（×・外を押す・ESC のどれでも閉じない）。出られる道は
     ログアウトとお問い合わせの2つ。運営が承認すると、次に見たときに自分で消える。
   ★画像は必ず canvas で JPEG に焼き直してから送る。撮影地などの付帯情報が落ち、
     SVG のような「絵の顔をした HTML」が原理的に入らない（サーバも JPEG しか受けない）。
   ★見た目は自分で <style> を入れる。既存の CSS に足すと、古い CSS が残る最大4時間のあいだ
     素の文字が画面の上に出る（pv-pay-fix.js と同じ理由）。色は pv-tokens.css の --pv-*
     から取り、tokens を読んでいないページのために控えの値を添えてある。

   ⚠️ **会員を名指しで書かない**（公開リポジトリ）。止める相手は admin.html で決める。
   ⚠️ 文言に「確認後の画像の扱い」を書かない（オーナー指示）。
   ⚠️ 文言を直すときは日英を一緒に。見ているのは assert-proof.mjs。
════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';

  var S = w.PVSession;
  if (!S || typeof S.proofDue !== 'function' || w.__pvProof) return;
  w.__pvProof = true;

  var L = (d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';

  var T = {
    ja: {
      t:       'パイロットであることの確認をお願いします',
      lead:    'このアカウントは現在、ご利用を停止しています。パイロットであることが分かる画像を1枚ご提出ください。確認ができしだい、ご利用いただけるようになります。',
      again:   'ご提出いただいた画像では確認できませんでした。お手数ですが、別の画像をご提出ください。',
      exT:     '提出できる画像の例',
      ex:      ['肩章', 'ウィングバッジ', '事業用操縦士の免許証', '勤務表'],
      etc:     'など',
      pick:    '画像を選んで提出する',
      pickedS: 'この画像を提出します。よろしければ下のボタンを押してください。',
      send:    'この画像を提出する',
      sending: '送信しています…',
      repick:  '選び直す',
      doneT:   '画像を受け取りました',
      doneS:   '運営が確認するまでお待ちください。確認ができしだい、ご利用いただけるようになります。',
      redo:    '別の画像を出し直す',
      out:     'ログアウト',
      contact: 'お問い合わせ',
      alt:     '提出する画像',
      eType:   'この画像は読み込めませんでした。JPEG か PNG の画像を選んでください。',
      eBig:    '画像が大きすぎます。別の画像を選んでください。',
      eNet:    '送信できませんでした。通信状況を確かめて、もう一度お試しください。',
      eMany:   '提出の回数が上限に達しました。お問い合わせからご連絡ください。'
    },
    en: {
      t:       'Please confirm that you are a pilot',
      lead:    'This account is currently suspended. Please submit one image showing that you are a pilot. Access will be restored once we have confirmed it.',
      again:   'We could not confirm it from the image you submitted. Please submit a different one.',
      exT:     'Examples of what you can submit',
      ex:      ['Epaulettes', 'Wing badge', 'Commercial pilot licence', 'Roster'],
      etc:     'etc.',
      pick:    'Choose an image to submit',
      pickedS: 'This image will be submitted. If it looks right, press the button below.',
      send:    'Submit this image',
      sending: 'Sending…',
      repick:  'Choose another',
      doneT:   'We have received your image',
      doneS:   'Please wait while we review it. Access will be restored once we have confirmed it.',
      redo:    'Submit a different image',
      out:     'Log out',
      contact: 'Contact us',
      alt:     'The image you are submitting',
      eType:   'This image could not be read. Please choose a JPEG or PNG image.',
      eBig:    'This image is too large. Please choose a different one.',
      eNet:    'It could not be sent. Please check your connection and try again.',
      eMany:   'You have reached the submission limit. Please get in touch via the contact page.'
    }
  }[L];

  /* ── 見た目 ─────────────────────────────────────────────────── */
  var CSS = [
    /* ★スクロールを止めるのは class で（body の style を直に書かない）。
       ほかの部品（search.js の引き出し・app-nav.js）が閉じるときに
       body.style.overflow を空に戻すので、直に書いた分は ESC 1回で外れる。 */
    'html.pvpf-lock,html.pvpf-lock body{overflow:hidden!important}',
    '.pvpf-back{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;',
      'justify-content:center;padding:16px;',
      'background:radial-gradient(120% 70% at 50% 0%,rgba(46,58,82,.5),rgba(46,58,82,0) 62%),',
      'rgba(6,10,16,.95);opacity:0;transition:opacity .3s var(--pv-ease,ease)}',
    '.pvpf-back.is-in{opacity:1}',
    '.pvpf-card{box-sizing:border-box;position:relative;width:100%;max-width:480px;',
      'max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow-y:auto;',
      '-webkit-overflow-scrolling:touch;margin:0;padding:28px 26px 18px;text-align:left;',
      'background:var(--pv-surface,#fff);color:var(--pv-ink,#0f172a);',
      'border:1px solid var(--pv-line,rgba(15,23,42,.12));',
      'border-top:3px solid var(--pv-gold-ink,#92600a);border-radius:var(--pv-r,14px);',
      'box-shadow:0 1px 2px rgba(6,10,16,.24),0 14px 30px -12px rgba(6,10,16,.55),',
      '0 40px 90px -30px rgba(6,10,16,.75);',
      'opacity:0;transform:translateY(10px) scale(.985);',
      'transition:opacity .36s var(--pv-ease,ease),transform .36s cubic-bezier(.34,1.3,.64,1)}',
    '.pvpf-back.is-in .pvpf-card{opacity:1;transform:none}',
    '.pvpf-card:focus{outline:none}',
    '@media (prefers-reduced-motion:reduce){',
      '.pvpf-back,.pvpf-card{opacity:1;transform:none;transition:none}}',
    /* 見出しは行の長さをそろえて折る（狭い画面で末尾の1文字だけが次の行に落ちない） */
    '.pvpf-t{margin:0;font-size:1.12rem;font-weight:800;letter-spacing:-.03em;line-height:1.4;',
      'color:var(--pv-ink,#0f172a);text-wrap:balance;line-break:strict;word-break:auto-phrase}',
    '.pvpf-s{margin:10px 0 0;font-size:.84rem;line-height:1.75;color:var(--pv-ink-2,#334155);',
      'line-break:strict;word-break:auto-phrase}',
    '.pvpf-exT{margin:18px 0 0;font-size:.72rem;font-weight:700;letter-spacing:.02em;',
      'color:var(--pv-ink-3,#64748b)}',
    '.pvpf-ex{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0 0;padding:0;',
      'list-style:none}',
    '.pvpf-ex li{padding:5px 11px;border-radius:999px;font-size:.76rem;font-weight:700;',
      'line-height:1.5;background:var(--pv-gold-soft,#fdf6e3);',
      'border:1px solid var(--pv-gold-line,rgba(146,96,10,.28));color:var(--pv-gold-ink,#92600a)}',
    '.pvpf-ex li.pvpf-etc{padding:5px 2px;background:none;border-color:transparent;',
      'font-weight:600;color:var(--pv-ink-3,#64748b)}',
    '.pvpf-prev{margin:16px 0 0;border:1px solid var(--pv-line,rgba(15,23,42,.12));',
      'border-radius:10px;overflow:hidden;background:var(--pv-line-soft,#f1f5f9)}',
    '.pvpf-prev img{display:block;width:100%;max-height:240px;object-fit:contain}',
    '.pvpf-err{margin:14px 0 0;font-size:.78rem;font-weight:600;line-height:1.7;',
      'color:var(--pv-orange-ink,#c2410c)}',
    '.pvpf-b{display:flex;flex-direction:column;align-items:stretch;gap:4px;margin:20px 0 0}',
    '.pvpf-go{display:flex;align-items:center;justify-content:center;width:100%;margin:0;',
      'padding:13px 20px;border:0;border-radius:999px;background:var(--pv-orange,#f97316);',
      'color:#fff;font:inherit;font-size:.88rem;font-weight:700;cursor:pointer;',
      'box-shadow:0 1px 1px rgba(194,65,12,.3),0 10px 22px -12px rgba(249,115,22,.9);',
      'transition:opacity .18s var(--pv-ease,ease),box-shadow .18s var(--pv-ease,ease),',
      'transform .18s cubic-bezier(.34,1.3,.64,1)}',
    '.pvpf-go:hover{opacity:.92;box-shadow:0 1px 1px rgba(194,65,12,.3),',
      '0 12px 26px -12px rgba(249,115,22,.85)}',
    '.pvpf-go:focus-visible{outline:2px solid var(--pv-orange,#f97316);outline-offset:3px}',
    '.pvpf-go:active{transform:scale(.98)}',
    '.pvpf-go[disabled]{opacity:.6;cursor:default;transform:none}',
    '.pvpf-re,.pvpf-foot button,.pvpf-foot a{margin:0;padding:9px 10px;background:none;border:0;',
      'border-radius:8px;font:inherit;font-size:.78rem;color:var(--pv-ink-3,#64748b);',
      'text-decoration:underline;text-underline-offset:3px;cursor:pointer;',
      'transition:color .18s var(--pv-ease,ease)}',
    '.pvpf-re{align-self:center}',
    '.pvpf-re:hover,.pvpf-foot button:hover,.pvpf-foot a:hover{color:var(--pv-ink,#0f172a)}',
    '.pvpf-re:focus-visible,.pvpf-foot button:focus-visible,.pvpf-foot a:focus-visible{',
      'outline:2px solid var(--pv-orange,#f97316);outline-offset:2px}',
    '.pvpf-re:active,.pvpf-foot button:active,.pvpf-foot a:active{opacity:.7}',
    '.pvpf-re[disabled]{opacity:.5;cursor:default}',
    '.pvpf-foot{display:flex;justify-content:center;gap:14px;margin:16px 0 0;padding:10px 0 0;',
      'border-top:1px solid var(--pv-line,rgba(15,23,42,.12))}',
    '@media (max-width:420px){.pvpf-card{padding:24px 20px 14px}.pvpf-t{font-size:1.04rem}}'
  ].join('');

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
  }

  /* ── サーバとの行き来 ───────────────────────────────────────────
     本体は pv-session.js の PVSession.rpc（2026-10-30 にここから移した。戻ってきた会員に聞く板
     ── pv-conditions.js の askReturn ── も同じ道を通るため。写しを2つにしない）。
     順に3つ試す：ページの sb を借りる → 生きたトークンで fetch → （lazyOk のときだけ）supabase-js。
     ★lazyOk は「板が出ている会員だけ」。聞くだけの会員にライブラリを1本読み込ませない。
     ⚠️ トークンを自分で更新しない（向こうの注を読む）。 */
  /* 古い pv-session.js がキャッシュに残っている端末では S.rpc が無い。そのときは「聞けなかった」と同じ扱い
     （次のページでもう一度聞く）。ここで落とすと板そのものが動かなくなる。 */
  function rpc(name, args, lazyOk) {
    return typeof S.rpc === 'function' ? S.rpc(name, args, lazyOk) : Promise.reject(new Error('no-rpc'));
  }

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

  /* ── 板 ─────────────────────────────────────────────────────── */
  var back = null, card = null, file = null;
  var cur = { state: 'required', again: false };
  var picked = null;        // {b64, url}
  var busy = false, errText = '';
  var inerted = [], watch = null, lastCheck = 0;

  function footHTML() {
    return '<div class="pvpf-foot">'
         +   '<button type="button" data-act="out">' + esc(T.out) + '</button>'
         +   '<a href="' + esc(S.hrefTo('contact.html')) + '">' + esc(T.contact) + '</a>'
         + '</div>';
  }

  function html() {
    var err = errText ? '<p class="pvpf-err" role="alert">' + esc(errText) + '</p>' : '';
    var dis = busy ? ' disabled' : '';

    if (picked) {
      return '<h2 class="pvpf-t" id="pvpf-t">' + esc(T.t) + '</h2>'
           + '<p class="pvpf-s">' + esc(T.pickedS) + '</p>'
           + '<div class="pvpf-prev"><img src="' + esc(picked.url) + '" alt="' + esc(T.alt) + '"></div>'
           + err
           + '<div class="pvpf-b">'
           +   '<button type="button" class="pvpf-go" data-act="send"' + dis + '>'
           +     esc(busy ? T.sending : T.send) + '</button>'
           +   '<button type="button" class="pvpf-re" data-act="pick"' + dis + '>' + esc(T.repick) + '</button>'
           + '</div>'
           + footHTML();
    }

    if (cur.state === 'submitted') {
      return '<h2 class="pvpf-t" id="pvpf-t">' + esc(T.doneT) + '</h2>'
           + '<p class="pvpf-s">' + esc(T.doneS) + '</p>'
           + err
           + '<div class="pvpf-b">'
           +   '<button type="button" class="pvpf-re" data-act="pick">' + esc(T.redo) + '</button>'
           + '</div>'
           + footHTML();
    }

    return '<h2 class="pvpf-t" id="pvpf-t">' + esc(T.t) + '</h2>'
         + '<p class="pvpf-s">' + esc(cur.again ? T.again : T.lead) + '</p>'
         + '<p class="pvpf-exT">' + esc(T.exT) + '</p>'
         + '<ul class="pvpf-ex">'
         +   T.ex.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('')
         +   '<li class="pvpf-etc">' + esc(T.etc) + '</li>'
         + '</ul>'
         + err
         + '<div class="pvpf-b">'
         +   '<button type="button" class="pvpf-go" data-act="pick">' + esc(T.pick) + '</button>'
         + '</div>'
         + footHTML();
  }

  function render(keepFocus) {
    if (!card) return;
    card.innerHTML = html();
    if (keepFocus) return;
    /* 送信中は押せるものが無いので、板そのものに置く（フォーカスを下のページへ逃がさない） */
    var f = card.querySelector('.pvpf-go:not([disabled])')
         || card.querySelector('.pvpf-re:not([disabled])') || card;
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
      dropPicked();
      picked = { b64: r.b64, url: w.URL.createObjectURL(r.blob) };
      render();
    }, function (e) {
      errText = (e && e.message === 'big') ? T.eBig : T.eType;
      render();
    });
  }

  function onSend() {
    if (busy || !picked) return;
    busy = true; errText = '';
    render();
    rpc('pv_proof_submit', { p_image_b64: picked.b64 }, true).then(function (v) {
      busy = false;
      if (v && v.ok) {
        dropPicked();
        cur = { state: 'submitted', again: false };
        S.proofWrite('submitted', false);
        render();
        return;
      }
      var st = v && v.status;
      if (st === 'not_required') { released(); return; }   // 送る前に運営が承認していた
      errText = st === 'too_many' ? T.eMany
              : st === 'image_too_big' ? T.eBig
              : st === 'image_bad' ? T.eType : T.eNet;
      if (st === 'image_too_big' || st === 'image_bad') dropPicked();
      render();
    }, function () {
      busy = false; errText = T.eNet;
      render();
    });
  }

  function onOut() {
    try { S.wipe(); } catch (e) {}
    /* wipe は「安全のため自動的にログアウトしました」の目印を立てる。
       ここは本人が押したログアウトなので、その目印は置いていかない。 */
    try { w.sessionStorage.removeItem('pv_expired'); } catch (e) {}
    w.location.href = S.hrefTo('index.html');
  }

  function onClick(e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t || !card || !card.contains(t)) return;
    var a = t.getAttribute('data-act');
    if (a === 'pick') onPick();
    else if (a === 'send') onSend();
    else if (a === 'out') onOut();
  }

  /* 板の外へフォーカスを出さない。ESC では閉じない（閉じる手段を置かない）。 */
  function onKey(e) {
    if (!back) return;
    if (e.key === 'Escape') { e.stopPropagation(); return; }
    if (e.key !== 'Tab') return;
    var list = card.querySelectorAll('button:not([disabled]), a[href]');
    if (!list.length) { e.preventDefault(); return; }
    var first = list[0], last = list[list.length - 1], at = d.activeElement;
    if (!card.contains(at)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
  }

  function hush(el) {
    if (!el || el === back || el.nodeType !== 1) return;
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') return;
    if (el.hasAttribute('inert')) return;
    el.setAttribute('inert', '');
    inerted.push(el);
  }

  function lock() {
    d.documentElement.classList.add('pvpf-lock');
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
    d.documentElement.classList.remove('pvpf-lock');
  }

  function open() {
    if (back || !d.body) return;
    var r = S.proofRead();
    cur = { state: r.s === 'submitted' ? 'submitted' : 'required', again: !!r.a };

    if (!d.getElementById('pvpf-css')) {
      var st = d.createElement('style');
      st.id = 'pvpf-css';
      st.textContent = CSS;
      (d.head || d.documentElement).appendChild(st);
    }
    /* Give → Get の板が先に出ていたら下ろす（同じ画面に板を2枚重ねない） */
    var g = d.getElementById('pvgf-back');
    if (g && g.parentNode) g.parentNode.removeChild(g);

    back = d.createElement('div');
    back.className = 'pvpf-back';
    back.id = 'pvpf-back';
    back.innerHTML = '<div class="pvpf-card" role="dialog" aria-modal="true" '
                   + 'aria-labelledby="pvpf-t" tabindex="-1"></div>'
                   + '<input type="file" accept="image/*" hidden>';
    card = back.firstChild;
    file = back.lastChild;
    file.addEventListener('change', onFile);
    back.addEventListener('click', onClick);
    d.addEventListener('keydown', onKey, true);

    d.body.appendChild(back);
    lock();
    /* 最初の1回は板そのものにフォーカスを置く（読み上げは見出しから始まる）。
       ボタンに置くと、まだ何も押していない人の画面にフォーカスの輪が出たままになる。 */
    render(true);
    try { card.focus({ preventScroll: true }); } catch (e) {}
    (w.requestAnimationFrame || w.setTimeout)(function () {
      if (back) back.classList.add('is-in');
    });
  }

  /* 運営が承認した。写しを直して読み直す（閉じていた門の中身を取り直すため）。 */
  function released() {
    S.proofWrite('none', false);
    if (!back) return;
    d.removeEventListener('keydown', onKey, true);
    dropPicked();
    unlock();
    if (back.parentNode) back.parentNode.removeChild(back);
    back = card = file = null;
    try { w.location.reload(); } catch (e) {}
  }

  function apply(v) {
    if (!v || typeof v.state !== 'string') return;
    if (v.state !== 'required' && v.state !== 'submitted') { released(); return; }
    S.proofWrite(v.state, !!v.again);
    if (!back) { open(); return; }
    if (busy || picked) return;                      // 選んでいる途中の画面は差し替えない
    if (cur.state === v.state && cur.again === !!v.again) return;
    cur = { state: v.state, again: !!v.again };
    render();
  }

  /* 板が出ている会員について、サーバの今の答えを取り直す。 */
  function recheck() {
    lastCheck = Date.now();
    rpc('pv_proof_state', {}, true).then(apply, function () {});
  }

  /* 止まっているか分からない会員について、1回だけ聞く。
     ★答えが取れなかった回は何も書かない（次のページでもう一度聞く）。 */
  function ask() {
    rpc('pv_proof_state', {}, false).then(function (v) {
      if (!v || typeof v.state !== 'string') return;
      if (v.state === 'required' || v.state === 'submitted') apply(v);
      else S.proofWrite('none', false);
    }, function () {});
  }

  function boot() {
    var due = S.proofDue();
    if (due === 'show') { open(); recheck(); }
    else if (due === 'ask') ask();
  }

  /* 別のタブから戻ってきたとき（運営が承認したかもしれない）。30秒に1回まで。 */
  d.addEventListener('visibilitychange', function () {
    if (back && d.visibilityState === 'visible' && Date.now() - lastCheck > 30000) recheck();
  });

  /* 写しが「止まっている」なら、本文が出そろうのを待たずに板を出す
     （中身が一瞬見える、を作らない）。サーバへ聞くのは本文が出そろってから ──
     そのページが自分で作るクライアント（sb）は、そのときにならないと在るか分からない。 */
  if (S.proofDue() === 'show' && d.body) open();

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
