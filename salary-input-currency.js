/* ==========================================================================
   salary-input-currency.js — 年収の「入力欄」をヘッダーの通貨に追随させる
   --------------------------------------------------------------------------
   ・口コミ投稿フォームは入力単位が「万円」で固定されていた。英語ページで
     $ USD を選んでも「万円 / year」のままで、海外のパイロットは自分の給与を
     一度自分で円に直さないと投稿できなかった（＝一次データが減る）。
   ・保存単位は今も万円。reviews_v2 の base_annual / annual_salary 等は
     万円の整数なので、切り替えるのは表示だけで、送信直前に万円へ戻す。
     円がベースの SSOT（salary-data.mjs）には一切触れない。
   ・各入力欄は data-man に「万円の正」を持つ。画面の値は現在通貨へ換算した
     見た目にすぎないので、通貨を往復させても丸めで値が痩せない。
   ・currency.js（window.PVCurrency）が未読込でも JPY として素通しで動く。
   ・非ESモジュール（currency.js / lang-toggle.js と同じ規約）。

   HTML 側の印（数値は全て万円で書く）:
     <input data-money data-money-eg="950" data-money-max="99999">
     <span data-money-unit="year">…</span>      単位ラベルを現在通貨で書き換える
     <textarea data-money-tpl="…{{15}}…">      {{万円}} を現在通貨で埋める

   ページ側は 'pv-money-refresh' を購読して、自前の合計表示を描き直す。
   ========================================================================== */
(function (w, d) {
  'use strict';
  if (w.PVMoney) return;                              // 二重読み込みガード

  var MAN = 10000;                                    // 1万円 = 10,000円

  // currency.js と同じ言語判定（/en/ 配下 or <html lang="en">）
  var LANG = (function () {
    try {
      if (w.location && w.location.pathname.indexOf('/en/') !== -1) return 'en';
      var l = d.documentElement && d.documentElement.getAttribute('lang');
      return (l && l.toLowerCase().indexOf('en') === 0) ? 'en' : 'ja';
    } catch (e) { return 'ja'; }
  })();

  var PERIOD = { year: { ja: '年', en: 'year' }, month: { ja: '月', en: 'month' } };
  var EG     = { ja: '例：', en: 'e.g. ' };

  function cur() {
    try { return (w.PVCurrency && w.PVCurrency.get && w.PVCurrency.get()) || 'JPY'; }
    catch (e) { return 'JPY'; }
  }
  function rate() {
    var c = cur(), r = w.PVCurrency && w.PVCurrency.rates;
    return (r && r[c]) || 1;
  }
  // 万円で入力してもらう画面かどうか。
  // ★ 英語ページでは JPY を選んでも万円にしない。「万＝1万」という位取りは日本語圏の
  //   知識なので、英語の読者に「万円 / year」と出しても自分の給与を書けない。
  //   素の円（17,700,000 JPY）で打ってもらう＝他の通貨と同じ扱いにする。
  //   保存単位は今も万円で、送信直前に戻す（下の toMan）ので DB は何も変わらない。
  function manInput() { return cur() === 'JPY' && LANG !== 'en'; }

  // 入力欄1つ分の単位。万円で入力させる画面だけサイト標準の万円、他は通貨コードそのまま
  // （$59,375 のような素の金額で書いてもらう＝「$5.9万」のような造語を作らない）。
  function unit() { return manInput() ? '万円' : cur(); }

  function fromMan(man) {                             // 万円 → 現在通貨の表示値
    var n = Number(man);
    if (!isFinite(n)) return null;
    return manInput() ? n : n * MAN / rate();
  }
  function toMan(shown) {                             // 表示値 → 万円
    var n = parseFloat(String(shown).replace(/,/g, ''));
    if (!isFinite(n)) return null;
    return manInput() ? n : n * rate() / MAN;
  }
  function group(v) { return Number(v).toLocaleString('en-US'); }

  // 例示（placeholder）は端数を丸めて読みやすくする。JPY は元の例をそのまま使う
  // （「950」が「1,000」に化けると、これまでの画面と別物に見えるため）。
  function nice(v) {
    var a = Math.abs(v);
    var step = a >= 100000 ? 10000 : a >= 10000 ? 1000 : a >= 1000 ? 100 : a >= 100 ? 10 : 1;
    return Math.round(v / step) * step;
  }

  // 万円を「1,770万円/年」「110,625 USD/year」の形に。入力欄の単位と必ず一致させる。
  function label(man, per) {
    var v = fromMan(man);
    if (v == null) return '';
    var head = group(Math.round(v)) + (manInput() ? unit() : ' ' + unit());
    return per && PERIOD[per] ? head + '/' + PERIOD[per][LANG] : head;
  }
  // 万円 → 現在通貨の「数値だけ」（単位は呼び出し側が別要素で持つ合計表示用）
  function shown(man) {
    var v = fromMan(man);
    return v == null ? '' : group(Math.round(v));
  }
  // 単位ラベル（「万円 / 年」「USD / year」）と、合計表示用の詰めた形
  function unitLabel(per) { return unit() + ' / ' + (PERIOD[per] ? PERIOD[per][LANG] : per); }
  function unitTight(per) { return unit() + '/' + (PERIOD[per] ? PERIOD[per][LANG] : per); }
  // 円額を現在通貨の圧縮表記へ（内訳バーの凡例など。currency.js と同じ見た目）
  function fmtJpy(jpy) {
    try { if (w.PVCurrency && w.PVCurrency.fmt) return w.PVCurrency.fmt(jpy); } catch (e) {}
    return '¥' + group(Math.round(jpy / MAN)) + '万';
  }
  // 例文（data-money-tpl）用。JPY は元の文面のまま「15万円」、外貨は圧縮せず素の金額。
  // 「+$938 / +$500 / +$1.3K」と桁ごとに形が変わると例として読みにくいので揃える。
  function fmtTpl(jpy) {
    if (manInput()) return group(Math.round(jpy / MAN)) + '万円';
    // 英語ページの JPY は記号表が持っていない（SYM に JPY が無い）ので ¥ を自分で置く。
    var sym = cur() === 'JPY' ? '¥'
            : (w.PVCurrency && w.PVCurrency.symbols && w.PVCurrency.symbols[cur()]) || (cur() + ' ');
    return sym + group(Math.round(jpy / rate()));
  }

  function el(x) { return typeof x === 'string' ? d.getElementById(x) : x; }

  // ── 入力欄の読み書き（正は万円）────────────────────────────────
  // data-man が data-man-shown（その万円を表示したときの文字列）と食い違っていれば
  // 利用者が打ち直した後なので、画面の値から引き直す。inline の oninput が
  // 先に走っても古い data-man を返さない。
  function man(x) {
    var e = el(x);
    if (!e) return null;
    var raw = String(e.value == null ? '' : e.value).trim();
    if (raw === '') return null;
    var cached = parseFloat(e.dataset.man);
    if (e.dataset.manShown === raw && isFinite(cached)) return cached;
    var m = toMan(raw);
    if (m != null) { e.dataset.man = String(m); e.dataset.manShown = raw; }
    return m;
  }
  function setMan(x, m) {
    var e = el(x);
    if (!e) return;
    if (m == null || !isFinite(m)) { e.value = ''; e.dataset.man = ''; e.dataset.manShown = ''; return; }
    var shown = String(Math.round(fromMan(m)));
    e.value = shown;
    e.dataset.man = String(m);                        // 丸めていない万円を保持＝往復しても痩せない
    e.dataset.manShown = shown;
  }

  // ── 現在通貨を画面へ反映（何度呼んでも同じ結果）────────────────
  function refresh() {
    var asMan = manInput(), i;

    var labs = d.querySelectorAll('[data-money-unit]');
    for (i = 0; i < labs.length; i++) labs[i].textContent = unitLabel(labs[i].getAttribute('data-money-unit'));

    var ins = d.querySelectorAll('input[data-money]');
    for (i = 0; i < ins.length; i++) {
      var e = ins[i];
      var m = man(e);
      if (m != null) setMan(e, m);                    // 入力済みの値を新しい通貨で描き直す
      var eg = parseFloat(e.getAttribute('data-money-eg'));
      if (isFinite(eg)) e.placeholder = EG[LANG] + group(asMan ? eg : nice(fromMan(eg)));
      var mx = parseFloat(e.getAttribute('data-money-max'));
      if (isFinite(mx)) e.max = String(Math.max(1, Math.round(fromMan(mx))));
    }

    var tpls = d.querySelectorAll('[data-money-tpl]');
    for (i = 0; i < tpls.length; i++) {
      var t = tpls[i];
      var s = t.getAttribute('data-money-tpl').replace(/\{\{(\d+(?:\.\d+)?)\}\}/g, function (_, n) {
        return fmtTpl(parseFloat(n) * MAN);
      });
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') t.placeholder = s;
      else t.textContent = s;
    }

    try { w.dispatchEvent(new CustomEvent('pv-money-refresh', { detail: { currency: cur() } })); }
    catch (e2) { var ev = d.createEvent('Event'); ev.initEvent('pv-money-refresh', true, false); w.dispatchEvent(ev); }
  }

  w.PVMoney = {
    man: man,                 // man('f-base') → 万円（未入力は null）
    setMan: setMan,           // setMan('f-annual', 1770) → 現在通貨で表示しつつ万円を保持
    fromMan: fromMan,
    toMan: toMan,
    label: label,             // label(1770, 'year') → '1,770万円/年' / '110,625 USD/year'
    shown: shown,             // shown(1770) → '1,770' / '110,625'（単位なし）
    unit: unit,
    unitLabel: unitLabel,     // '万円 / 年' / 'USD / year'
    unitTight: unitTight,     // '万円/年'  / 'USD/year'
    fmtJpy: fmtJpy,
    lang: LANG,
    currency: cur,
    rate: rate,               // 現在通貨1単位あたりの円（保存時の出所として控える）
    refresh: refresh
  };

  // currency.js の切替と、初期化時の一斉反映（非JPYで復帰した場合）を拾う
  w.addEventListener('pv-currency-change', refresh);
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', refresh);
  else refresh();
})(window, document);
