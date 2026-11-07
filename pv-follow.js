/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — 気になる会社のフォロー（2026-11-07）

   オーナー採用：会社ページで会社をフォローすると、新しい給与・口コミ・待遇の回答が入ったときにメールで知らせる。
   自分の会社（登録の会社）は最初からフォロー済み。1人10社まで。
   決まりは全部サーバー（db/follow.sql の pv_my_follows・pv_follow_set）。ここは押す・見せるだけ。

   置き場
     ・会社ページ：社名の下の行の <button class="pvg-follow" data-pv-follow="{会社コード}">（gen-airline-glance.mjs の hero() が書く）
     ・マイページ：<div data-pv-follow-list>（フォロー中の会社の一覧・外せる）
   ★未ログインはサーバーを1回も呼ばない。押したらログインへ（戻り先つき）。
   ★ログインしている人だけ、ページを開いたときに1回だけ自分のフォローを聞く。
   ★件数・人数は出さない（サーバーも返さない）。計測は GA4 の名前だけ（follow_on・follow_off）。
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var d = document;
  var L = (window.PV_BASE === 'en' || d.documentElement.getAttribute('lang') !== 'ja') ? 'en' : 'ja';   // スペイン語のページは英語と同じ動き（pv-session.js）
  var T = {
    ja: {
      follow: 'フォロー',
      following: 'フォロー中',
      tooMany: '10社までです。マイページで外せます。',
      failed: '保存できませんでした。もう一度お試しください。',
      listTitle: 'フォロー中の会社',
      listLead: '新しい給与・口コミ・待遇の回答が入ると、メールでお知らせします。',
      own: '所属',
      remove: '外す',
      empty: '会社ページの「＋ フォロー」で追加できます。',
    },
    en: {
      follow: 'Follow',
      following: 'Following',
      tooMany: 'You can follow up to 10 airlines. Remove one on My Page.',
      failed: 'Could not save. Please try again.',
      listTitle: 'Airlines you follow',
      listLead: 'We email you when new pay, reviews or working conditions are added.',
      own: 'Your airline',
      remove: 'Remove',
      empty: 'Add airlines with “+ Follow” on an airline page.',
    }, /*PV-MSG:es*/ es: {
      follow: 'Seguir',
      following: 'Siguiendo',
      tooMany: 'Puedes seguir hasta 10 aerolíneas. Quita una en Mi página.',
      failed: 'No se pudo guardar. Inténtalo de nuevo.',
      listTitle: 'Aerolíneas que sigues',
      listLead: 'Te avisamos por correo cuando se agregan remuneraciones, reseñas o condiciones de trabajo nuevas.',
      own: 'Tu aerolínea',
      remove: 'Quitar',
      empty: 'Agrega aerolíneas con «+ Seguir» en la página de una aerolínea.',
    } /*/PV-MSG:es*/
  };
  T = (window.PV_T && window.PV_T(T, L)) || T[L];

  var S = window.PVSession || null;
  function loggedIn() { try { return !!(S && S.isLoggedIn && S.isLoggedIn()); } catch (e) { return false; } }
  function track(name) { if (typeof window.gtag !== 'function') return; try { window.gtag('event', name, {}); } catch (e) {} }
  function rpc(fn, args) {
    if (!S || typeof S.rpc !== 'function') return Promise.reject(new Error('no_rpc'));
    return Promise.resolve(S.rpc(fn, args || {}, true));
  }
  function toLogin() {
    var to = location.pathname + location.search;
    var base = (S && S.hrefTo) ? S.hrefTo('login.html') : 'login.html';
    location.href = base + (base.indexOf('?') < 0 ? '?' : '&') + 'return=' + encodeURIComponent(to);
  }
  function el(tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  var state = null;          // { codes: {code: {own}} , list: [...] }
  var btns = [];
  var lists = [];

  function setState(v) {
    if (!v || v.ok !== true || !Array.isArray(v.list)) return false;
    var m = {};
    v.list.forEach(function (x) { if (x && x.code) m[x.code] = x; });
    state = { codes: m, list: v.list };
    paint();
    return true;
  }

  function paintBtn(b) {
    var code = b.getAttribute('data-pv-follow');
    var on = !!(state && state.codes[code]);
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    var ic = b.querySelector('.pvg-follow-ic'), t = b.querySelector('.pvg-follow-t');
    if (ic) ic.textContent = on ? '✓' : '＋';
    if (t) t.textContent = on ? T.following : T.follow;
  }

  function note(b, msg) {
    var n = b.parentNode && b.parentNode.querySelector('.pvg-follow-note');
    if (!n) { n = el('span', 'pvg-follow-note'); n.setAttribute('role', 'status'); b.parentNode.insertBefore(n, b.nextSibling); }
    n.textContent = msg;
    clearTimeout(n._t);
    n._t = setTimeout(function () { n.textContent = ''; }, 4000);
  }

  function toggle(code, on, b) {
    return rpc('pv_follow_set', { p_airline: code, p_on: on }).then(function (v) {
      if (v && v.ok === false && v.reason === 'login') { toLogin(); return; }
      if (v && v.ok === false && v.reason === 'too_many') { if (b) note(b, T.tooMany); paint(); return; }
      if (!setState(v)) throw new Error('bad');
      track(on ? 'follow_on' : 'follow_off');
    }).catch(function () { if (b) note(b, T.failed); paint(); });
  }

  function paintList(box) {
    box.innerHTML = '';
    if (!state) { box.style.display = 'none'; return; }
    box.style.display = '';
    box.appendChild(el('div', 'pvf-title', T.listTitle));
    box.appendChild(el('div', 'pvf-lead', T.listLead));
    var ul = el('ul', 'pvf-list');
    if (!state.list.length) {
      var li0 = el('li', 'pvf-empty', T.empty);
      ul.appendChild(li0);
    }
    state.list.forEach(function (x) {
      var li = el('li', 'pvf-row');
      var name = (L === 'ja' ? x.ja : x.en) || x.en || x.ja || x.code;
      var nm;
      if (x.page) { nm = el('a', 'pvf-name', name); nm.href = 'airlines/' + x.code + '.html'; }
      else nm = el('span', 'pvf-name', name);
      li.appendChild(nm);
      if (x.own) li.appendChild(el('span', 'pvf-own', T.own));
      var rm = el('button', 'pvf-rm', T.remove);
      rm.type = 'button';
      rm.addEventListener('click', function () { rm.disabled = true; toggle(x.code, false, null); });
      li.appendChild(rm);
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  function paint() {
    btns.forEach(paintBtn);
    lists.forEach(paintList);
  }

  function css() {
    if (d.getElementById('pvf-css')) return;
    var s = d.createElement('style');
    s.id = 'pvf-css';
    s.textContent =
      '.pvf-title{font-size:.92rem;font-weight:700;margin-bottom:4px}' +
      '.pvf-lead{font-size:.76rem;line-height:1.6;color:var(--pv-ink-3,#64748b);margin-bottom:12px}' +
      '.pvf-list{list-style:none;margin:0;padding:0}' +
      '.pvf-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--pv-line,#e3e9f0)}' +
      '.pvf-row:first-child{border-top:0}' +
      '.pvf-name{flex:1;min-width:0;font-weight:600;font-size:.9rem;color:inherit;text-decoration:none}' +
      'a.pvf-name:hover{text-decoration:underline}' +
      'a.pvf-name:focus-visible,.pvf-rm:focus-visible{outline:3px solid var(--pv-accent-line,#bfe6db);outline-offset:2px;border-radius:6px}' +
      '.pvf-own{font-size:.7rem;font-weight:700;color:var(--pv-accent-ink,#067563);background:var(--pv-accent-soft,#e7f5f1);border-radius:999px;padding:2px 8px}' +
      '.pvf-rm{flex:none;appearance:none;border:1px solid var(--pv-line,#e3e9f0);background:transparent;color:inherit;border-radius:8px;padding:5px 12px;font:inherit;font-size:.78rem;cursor:pointer;transition:transform .18s cubic-bezier(.34,1.56,.64,1),opacity .18s}' +
      '.pvf-rm:hover{opacity:.75}.pvf-rm:active{transform:scale(.96)}.pvf-rm:disabled{opacity:.4;cursor:default}' +
      '.pvf-empty{font-size:.82rem;color:var(--pv-ink-3,#64748b);padding:6px 0}';
    (d.head || d.documentElement).appendChild(s);
  }

  function boot() {
    btns = Array.prototype.slice.call(d.querySelectorAll('button[data-pv-follow]'));
    lists = Array.prototype.slice.call(d.querySelectorAll('[data-pv-follow-list]'));
    if (!btns.length && !lists.length) return;
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var code = b.getAttribute('data-pv-follow');
        if (!loggedIn()) { toLogin(); return; }
        if (!state) return;                         // まだ聞いている途中
        var on = !state.codes[code];
        /* 押した瞬間に見た目だけ先に変える（返事で正しい形に描き直す） */
        b.classList.toggle('is-on', on);
        toggle(code, on, b);
      });
    });
    if (lists.length) css();
    if (!loggedIn()) return;                        // ★未ログインはサーバーを呼ばない
    rpc('pv_my_follows', {}).then(function (v) {
      if (v && v.ok === false && v.reason === 'login') return;
      setState(v);
    }).catch(function () {});
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})();
