/* ════════════════════════════════════════════════════════════════
   my-globe.js — スケジュールのタブの一番上の「飛んだルート」の地球儀（2026-11-12）
   ★オーナー「勤務の部分に、世界地図を 3D でかっこよく（拡大・縮小できる）。飛んだ軌跡を全部描いて、
     ルートを押すとその便でいくら稼いだかが出る」→ 見本の動画（地球儀・輪と棒のカード・出発地と目的地のカード・便の一覧）に合わせた。
   ★読み込みは my-value.js がスケジュールのタブを開いたときだけ（my-globe.css → pv-airport-geo.js・pv-globe-land.js → これ）。
     外の部品は使わない（地球儀は canvas に自前で描く）。

   守っていること
   ・便の額は pv-report-engine.js の flightPay だけ（ここで計算し直さない）。額の出ない便は理由を書き、数字を作らない。
   ・見せるのは本人の行だけ（my_roster・my_pay_reports・my_report_items）。共有・画像の保存は付けない（日付とルートで本人に絞れる）。
   ・描くのは「今日まで」に飛んだ便（先の予定は描かない）。日ごとの行は24か月で畳まれる＝最長24か月。
   ・字は「目安」。「単価」「料率」と言わない（db/test-flight-pay.mjs が見ている）。
   ・動きは「動きを減らす」設定では止める。隠れている間・画面の外では描かない（電池）。

   window.PVGlobe = { mount(el, ctx), show(), hide(), reload() }
     ctx = { sb, reports（my_pay_reports の行）, items(force) → Promise<{items, maps}>, current() → { airline, other } }
   ════════════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';
  var d = w.document;
  var R = w.PVReport;
  if (!R || !R.flightPay || typeof w.PV_AIRPORT_GEO !== 'function' || typeof w.PV_GLOBE_LAND !== 'function') return;
  var L = (w.PV_BASE === 'en' || d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';
  var ES = w.PV_LANG === 'es';

  var T = {
    ja: {
      title: '飛んだルート', sub: '{p} · {r}ルート · {n}便', aria: '飛んだルートの地球儀',
      perAria: '期間', per3: '3か月', per12: '1年', perAll: '全部',
      p3: '直近3か月', p12: '直近1年', pAll: '直近2年',
      sumT: 'この期間の稼ぎ（目安）', ringL: '乗務', ringA: '勤務時間のうち乗務の割合 {p}',
      legHub: '拠点', legDest: '行き先', legDh: 'DH',
      hint: 'ドラッグで回す・ルートを押す', zin: '拡大', zout: '縮小',
      op: '乗務', dh: 'DH', unk: '区分確認中',
      earn: 'この便の稼ぎ（目安）', fixedL: '時給 × 勤務', flightL: '乗務手当・日当',
      no_payslip: '{m}の明細を足すと出ます', roster_partial: 'この月のスケジュールを全部取り込むと出ます',
      mixed_currency: '通貨の違う明細が混ざる月は出せません', no_duty: '勤務時間が分からない月は出せません',
      no_block: 'この便の時間が分からないため出せません', no_pay: 'この月は額を出せません',
      addPay: '明細を足す',
      listT: '便の一覧', all: 'すべて', allRoutes: '全ルート', more: 'もっと見る', less: '閉じる',
      monT: '月ごとの稼ぎ（目安）', monS: '便の額の合計',
      empty: 'スケジュールを取り込むと、飛んだルートがここに描かれます。',
      none: 'この期間に飛んだ便はありません。',
      err: '地球儀を読み込めませんでした。時間をおいて開き直してください。',
      ymS: '{n}月', dayT: '{n}月{d}日（{w}）', dayS: '{n}/{d}',
      wd: ['月', '火', '水', '木', '金', '土', '日'],
      mon: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
    },
    en: {
      title: 'Routes flown', sub: '{p} · {r} routes · {n} flights', aria: 'Globe of the routes you flew',
      perAria: 'Period', per3: '3M', per12: '1Y', perAll: 'All time',
      p3: 'Last 3 months', p12: 'Last 12 months', pAll: 'Last 24 months',
      sumT: 'Earnings this period (est.)', ringL: 'Flying', ringA: 'Share of duty time spent flying {p}',
      legHub: 'Base', legDest: 'Destination', legDh: 'Deadhead',
      hint: 'Drag to rotate, tap a route', zin: 'Zoom in', zout: 'Zoom out',
      op: 'Operating', dh: 'Deadhead', unk: 'Unclassified',
      earn: 'Earned on this flight (est.)', fixedL: 'Hourly × duty', flightL: 'Flight pay & per diem',
      no_payslip: 'Add your {m} payslip to see this', roster_partial: 'Import the whole month of your roster to see this',
      mixed_currency: 'Not shown for months with payslips in different currencies', no_duty: 'Not shown when the month has no duty times',
      no_block: 'Not shown because this flight has no block time', no_pay: 'Not shown for this month',
      addPay: 'Add payslip',
      listT: 'Flights', all: 'All flights', allRoutes: 'All routes', more: 'Show more', less: 'Show less',
      monT: 'Earnings by month (est.)', monS: 'Sum of flights',
      empty: 'Import your roster and every route you fly will be drawn here.',
      none: 'No flights in this period.',
      err: 'Could not load the globe. Please try again in a moment.',
      ymS: '{M}', dayT: '{w}, {M} {d}', dayS: '{M} {d}',
      wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      mon: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    }, /*PV-MSG:es*/ es: {
      title: 'Rutas voladas', sub: '{p} · {r} rutas · {n} vuelos', aria: 'Globo con las rutas que volaste',
      perAria: 'Período', per3: '3M', per12: '1Y', perAll: 'Todo',
      p3: 'Últimos 3 meses', p12: 'Últimos 12 meses', pAll: 'Últimos 24 meses',
      sumT: 'Ingresos del período (est.)', ringL: 'Vuelo', ringA: 'Parte del tiempo de servicio en vuelo {p}',
      legHub: 'Base', legDest: 'Destino', legDh: 'Deadhead',
      hint: 'Arrastra para girar y toca una ruta', zin: 'Acercar', zout: 'Alejar',
      op: 'Operando', dh: 'Deadhead', unk: 'Sin clasificar',
      earn: 'Ganado en este vuelo (est.)', fixedL: 'Por hora × servicio', flightL: 'Pago de vuelo y viáticos',
      no_payslip: 'Agrega tu recibo de nómina de {m} para verlo', roster_partial: 'Importa el mes completo de tu programación para verlo',
      mixed_currency: 'No se muestra en meses con recibos en distintas monedas', no_duty: 'No se muestra si el mes no tiene horas de servicio',
      no_block: 'No se muestra porque este vuelo no tiene tiempo de bloque', no_pay: 'No se muestra en este mes',
      addPay: 'Agregar recibo',
      listT: 'Vuelos', all: 'Todos', allRoutes: 'Todas las rutas', more: 'Ver más', less: 'Ver menos',
      monT: 'Ingresos por mes (est.)', monS: 'Suma de los vuelos',
      empty: 'Importa tu programación y aquí se dibujará cada ruta que vueles.',
      none: 'No hay vuelos en este período.',
      err: 'No se pudo cargar el globo. Inténtalo de nuevo en un momento.',
      ymS: '{M}', dayT: '{w}, {M} {d}', dayS: '{M} {d}',
      wd: ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'],
      mon: ['ene', 'feb', 'mar', 'abr', 'Mayo', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    } /*/PV-MSG:es*/
  };
  T = (w.PV_T && w.PV_T(T, L)) || T[L];

  /* ── 小道具 ─────────────────────────────────────────────── */
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fill(t, o) { return String(t).replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : ''; }); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function hm(min) { if (!isNum(min)) return '—'; var m = Math.round(min); return Math.floor(m / 60) + ':' + pad2(m % 60); }
  function today() { var t = new Date(); return t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate()); }
  function addDays(date, k) {
    var t = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) + k * 864e5, x = new Date(t);
    return x.getUTCFullYear() + '-' + pad2(x.getUTCMonth() + 1) + '-' + pad2(x.getUTCDate());
  }
  function addMonths(date, k) {
    var y = +date.slice(0, 4), m = +date.slice(5, 7) - 1 + k;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + pad2(m + 1) + date.slice(7);
  }
  function wdOf(date) { return (new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))).getUTCDay() + 6) % 7; }   // 月曜が0
  function dayL(date) { var n = +date.slice(5, 7); return fill(T.dayT, { n: n, M: T.mon[n - 1], d: +date.slice(8, 10), w: T.wd[wdOf(date)] }); }
  function dayS(date) { var n = +date.slice(5, 7); return fill(T.dayS, { n: n, M: T.mon[n - 1], d: +date.slice(8, 10) }); }
  function ymS(ym) { var n = +ym.slice(5, 7); return fill(T.ymS, { n: n, M: T.mon[n - 1] }); }
  function reduced() { try { return w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function stored(k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } }
  function store(k, v) { try { w.localStorage.setItem(k, v); } catch (e) {} }

  /* お金：エンジンは原本通貨の最小単位の整数。見せるときだけ、その通貨のいちばん新しい明細のレートで円にし、表示の通貨へ（分析のタブと同じ） */
  var SYM_ES = { USD: 'US$ ', EUR: '€ ', GBP: '£ ', AUD: 'A$ ', SGD: 'S$ ', AED: 'AED ', CNY: 'CNY ', KRW: '₩ ' };
  function curNow() { var C = w.PVCurrency; return (C && C.get) ? C.get() : 'JPY'; }
  function fxOf(cur) {
    var ms = S.model ? S.model.months : [];
    for (var i = ms.length - 1; i >= 0; i--) if (ms[i].currency === cur && isNum(ms[i].fx_to_jpy)) return ms[i].fx_to_jpy;
    return null;
  }
  function money(minor, cur) {
    var v = R.fromMinor(minor, cur), fx = fxOf(cur);
    if (v == null || fx == null) return '—';
    var C = w.PVCurrency, now = curNow(), rate = (C && C.rates && C.rates[now]) || 1, jpy = v * fx;
    var sym = now === 'JPY' ? '¥' : ES ? (SYM_ES[now] || now + ' ') : ((C && C.symbols && C.symbols[now]) || now + ' ');
    var n = Math.round(now === 'JPY' ? jpy : jpy / rate);
    return (n < 0 ? '−' : '') + sym + Math.abs(n).toLocaleString('en-US');
  }

  /* 空港：位置と街の名前（pv-airport-geo.js）。日本語の名前が無ければ英語 */
  function geo(code) { return w.PV_AIRPORT_GEO(code); }
  function city(g) { return g ? (L === 'ja' && !ES && g.ja ? g.ja : g.en || g.iata) : ''; }

  /* ── 状態 ───────────────────────────────────────────────── */
  var PKEY = 'pv-globe-per';
  var S = {
    el: null, ctx: null, sb: null, model: null, fp: null, legs: [], days: [], err: false, loading: true,
    per: (function () { var v = stored(PKEY); return v === '3' || v === '12' || v === 'all' ? v : '12'; }()),
    filt: 'all', route: null, leg: null, listN: 8, visible: false
  };

  /* ── 読む ───────────────────────────────────────────────── */
  function rosterRange(from, to) {
    var a = S.ctx.current ? S.ctx.current() : null;
    if (!a || !a.airline) return Promise.resolve(null);
    return S.sb.rpc('my_roster', { p_airline: a.airline, p_airline_other: a.other || null, p_from: from, p_to: to })
      .then(function (r) { return r && !r.error && r.data && r.data.ok !== false ? r.data : null; }, function () { return null; });
  }
  function load() {
    S.loading = true; S.err = false;
    render();
    var a = S.ctx.current ? S.ctx.current() : null;
    /* 2回に分けて24か月ぶん（my_roster は1回400日まで）。新しい側は既定の範囲 */
    var t = today(), to1 = addDays(t, 62), from1 = addDays(to1, -399), to2 = addDays(from1, -1), from2 = addDays(to2, -399);
    var items = typeof S.ctx.items === 'function' ? S.ctx.items(false) : Promise.resolve(null);
    return Promise.all([rosterRange(from1, to1), rosterRange(from2, to2), items]).then(function (r) {
      var byDate = {}, prof = null;
      [r[1], r[0]].forEach(function (x) {
        if (!x) return;
        prof = x.profile || prof;
        (Array.isArray(x.days) ? x.days : []).forEach(function (D) { if (D && D.date) byDate[D.date] = D; });
      });
      S.days = Object.keys(byDate).sort().map(function (k) { return byDate[k]; });
      var it = r[2] && typeof r[2] === 'object' ? r[2] : { items: [], maps: [] };
      S.model = R.build({ reports: S.ctx.reports || [], items: it.items || [], maps: it.maps || [],
        roster: { days: S.days, profile: prof }, airline: a && a.airline || undefined, airlineOther: a && a.other || null });
      S.fp = R.flightPay(S.model);
      prepare();
    }).catch(function () { S.err = true; }).then(function () { S.loading = false; render(); });
  }
  function prepare() {
    var t = today();
    S.legs = (S.fp ? S.fp.legs : []).filter(function (l) { return l.date <= t; }).map(function (l) {
      var o = Object.assign({}, l);
      o.ga = geo(l.from); o.gb = geo(l.to);
      o.fleet = l.fleet ? String(l.fleet).toUpperCase() : null;   // 明細の機材（b777 → B777）
      o.id = l.date + '#' + l.seq + '#' + l.from + l.to;
      return o;
    }).filter(function (l) { return l.ga && l.gb && l.ga.iata !== l.gb.iata; })
      .sort(function (p, q) { return p.date < q.date ? 1 : p.date > q.date ? -1 : (q.seq || 0) - (p.seq || 0); });
  }

  /* ── 期間で絞る・ルートに束ねる ────────────────────────────── */
  function cutoff() { var t = today(); return S.per === '3' ? addMonths(t, -3) : S.per === '12' ? addMonths(t, -12) : addMonths(t, -24); }
  function view() {
    var c = cutoff(), legs = S.legs.filter(function (l) { return l.date > c; });
    var routes = {}, port = {}, order = [];
    legs.forEach(function (l) {
      var a = l.ga.iata, b = l.gb.iata, k = a < b ? a + '|' + b : b + '|' + a;
      var r = routes[k];
      if (!r) { r = routes[k] = { k: k, a: a < b ? l.ga : l.gb, b: a < b ? l.gb : l.ga, legs: [], n: 0, dh: 0, sum: 0, cur: null }; order.push(r); }
      r.legs.push(l); r.n++; if (l.kind === 'deadhead') r.dh++;
      if (l.amount != null) { if (r.cur == null) r.cur = l.currency; if (r.cur === l.currency) r.sum += l.amount; }
      port[a] = (port[a] || 0) + 1; port[b] = (port[b] || 0) + 1;
    });
    var hub = Object.keys(port).sort(function (p, q) { return port[q] - port[p] || (p < q ? -1 : 1); })[0] || null;
    /* 勤務時間のうち乗務の割合（区間のある日の勤務 ÷ 勤務ぜんぶ）・期間の稼ぎの合計 */
    var t = today(), fly = 0, all = 0, total = 0, cur = null;
    (S.model && S.model.roster ? S.model.roster.months : []).forEach(function (rm) {
      rm.days.forEach(function (x) {
        if (!x.isDuty || x.date <= c || x.date > t) return;
        var v = x.dutyMin != null ? x.dutyMin : ((x.blockKnown.operating || 0) + (x.blockKnown.deadhead || 0) + (x.blockKnown.unknown || 0)) || null;
        if (v == null) return;
        all += v;
        if (x.legs.some(function (L0) { return L0.from && L0.to && L0.kind !== 'ground'; })) fly += v;
      });
    });
    legs.forEach(function (l) { if (l.amount == null) return; if (cur == null) cur = l.currency; if (cur === l.currency) total += l.amount; });
    var top = order.filter(function (r) { return r.cur === cur && r.sum > 0; }).sort(function (p, q) { return q.sum - p.sum; }).slice(0, 3);
    return { legs: legs, routes: order, hub: hub, ring: all > 0 ? fly / all : null, total: cur == null ? null : total, cur: cur, top: top };
  }

  /* ── 描く（字）──────────────────────────────────────────── */
  var IC_PLANE = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M21 15.5v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V8.5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z" transform="rotate(90 12 12)"/></svg>';
  var IC_HAND = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11.5v-2a1.5 1.5 0 0 1 3 0V12"/><path d="M14 10.5a1.5 1.5 0 0 1 3 0V12"/><path d="M17 11.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.6-2.2L5 16.5a1.6 1.6 0 0 1 2.4-2.1L8 15"/></svg>';
  function kindL(k) { return k === 'deadhead' ? T.dh : k === 'unknown' ? T.unk : T.op; }
  function why(l) {
    if (!l || !l.reason) return '';
    if (l.reason === 'no_payslip') return fill(T.no_payslip, { m: (l.missing || []).map(ymS).join('・') || ymS(l.ym) });
    return T[l.reason] || T.no_pay;
  }
  function shell() {
    S.el.innerHTML =
      '<section class="gl" aria-label="' + esc(T.title) + '">' +
        '<div class="gl-stage">' +
          '<div class="gl-cvbox"><canvas class="gl-cv" role="img" aria-label="' + esc(T.aria) + '"></canvas>' +
            '<div class="gl-zoom"><button type="button" class="gl-zb" data-z="1" aria-label="' + esc(T.zin) + '">+</button>' +
            '<button type="button" class="gl-zb" data-z="-1" aria-label="' + esc(T.zout) + '">−</button></div>' +
            '<div class="gl-msg" hidden></div></div>' +
          '<div class="gl-top"><div class="gl-hd"><h3 class="gl-t">' + esc(T.title) + '</h3><p class="gl-s"></p></div>' +
            '<div class="gl-per" role="group" aria-label="' + esc(T.perAria) + '">' +
              [['3', T.per3], ['12', T.per12], ['all', T.perAll]].map(function (p) {
                return '<button type="button" class="gl-pb" data-per="' + p[0] + '" aria-pressed="false">' + esc(p[1]) + '</button>';
              }).join('') + '</div></div>' +
          '<div class="gl-ov gl-sum" hidden></div>' +
          '<div class="gl-ov gl-flt" hidden></div>' +
          '<div class="gl-foot"><span class="gl-hint">' + IC_HAND + esc(T.hint) + '</span>' +
            '<span class="gl-lg"><span><i class="gl-lg-hub"></i>' + esc(T.legHub) + '</span><span><i class="gl-lg-dst"></i>' + esc(T.legDest) +
            '</span><span><i class="gl-lg-dh"></i>' + esc(T.legDh) + '</span></span></div>' +
        '</div>' +
        '<div class="gl-row"><div class="gl-card gl-list" hidden></div><div class="gl-card gl-mon" hidden></div></div>' +
      '</section>';
    S.root = S.el.querySelector('.gl');
    S.root.addEventListener('click', onClick);
    G.init(S.el.querySelector('.gl-cv'), S.el.querySelector('.gl-cvbox'));
  }
  function render() {
    if (!S.el) return;
    if (!S.root) shell();
    var V = S.loading || S.err ? null : view();
    S.V = V;
    S.root.querySelectorAll('.gl-pb').forEach(function (b) {
      var on = b.getAttribute('data-per') === S.per;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
    });
    var msg = S.root.querySelector('.gl-msg'), sub = S.root.querySelector('.gl-s');
    var sum = S.root.querySelector('.gl-sum'), flt = S.root.querySelector('.gl-flt');
    var list = S.root.querySelector('.gl-list'), mon = S.root.querySelector('.gl-mon');
    var perL = S.per === '3' ? T.p3 : S.per === '12' ? T.p12 : T.pAll;
    if (!V) {
      sub.textContent = S.err ? '' : perL;
      msg.hidden = !S.err; msg.textContent = S.err ? T.err : '';
      sum.hidden = flt.hidden = list.hidden = mon.hidden = true;
      G.setData(null);
      return;
    }
    sub.textContent = fill(T.sub, { p: perL, r: V.routes.length, n: V.legs.length });
    /* 選んでいるルート・便が期間の外に出たら、いちばん新しい便へ */
    if (S.leg && !V.legs.some(function (l) { return l.id === S.leg; })) S.leg = null;
    if (S.route && !V.routes.some(function (r) { return r.k === S.route; })) S.route = null;
    /* 最初に選ぶのは、額の出るいちばん新しい便（無ければいちばん新しい便） */
    if (!S.leg && V.legs.length) { var amt = V.legs.filter(function (l) { return l.amount != null; })[0]; S.leg = (amt || V.legs[0]).id; }
    var leg = V.legs.filter(function (l) { return l.id === S.leg; })[0] || null;
    if (!S.route && leg) S.route = routeKey(leg);
    var empty = !S.legs.length;
    msg.hidden = !(empty || !V.legs.length);
    msg.textContent = empty ? T.empty : !V.legs.length ? T.none : '';
    sum.hidden = !V.legs.length; flt.hidden = !leg;
    list.hidden = !V.legs.length; mon.hidden = !V.legs.length;
    if (V.legs.length) { sum.innerHTML = sumHTML(V); list.innerHTML = listHTML(V); mon.innerHTML = monHTML(V, leg); }
    if (leg) flt.innerHTML = fltHTML(leg);
    G.setData(V, S.route, leg);
  }
  function routeKey(l) { var a = l.ga.iata, b = l.gb.iata; return a < b ? a + '|' + b : b + '|' + a; }
  function sumHTML(V) {
    var p = V.ring == null ? null : Math.round(V.ring * 1000) / 10;
    var C = 2 * Math.PI * 30, off = p == null ? C : C * (1 - p / 100);
    var max = V.top.length ? V.top[0].sum : 0;
    return '<div class="gl-sum-h"><span class="gl-ov-t">' + esc(T.sumT) + '</span>' +
        '<span class="gl-chip">' + esc(V.total == null ? '—' : money(V.total, V.cur)) + '</span></div>' +
      '<div class="gl-sum-b">' +
        '<div class="gl-ring" role="img" aria-label="' + esc(fill(T.ringA, { p: p == null ? '—' : p + '%' })) + '">' +
          '<svg viewBox="0 0 76 76" width="76" height="76" aria-hidden="true"><defs><linearGradient id="glRg" x1="0" y1="1" x2="1" y2="0">' +
          '<stop offset="0" stop-color="#7fe0c6"/><stop offset="1" stop-color="#f2c35b"/></linearGradient></defs>' +
          '<circle cx="38" cy="38" r="30" class="gl-ring-tr"/>' +
          '<circle cx="38" cy="38" r="30" class="gl-ring-v" stroke="url(#glRg)" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 38 38)"/></svg>' +
          '<span class="gl-ring-n">' + (p == null ? '—' : p.toFixed(1) + '%') + '<small>' + esc(T.ringL) + '</small></span></div>' +
        '<div class="gl-bars">' + V.top.map(function (r, i) {
          return '<button type="button" class="gl-bar' + (r.k === S.route ? ' on' : '') + '" data-route="' + esc(r.k) + '">' +
            '<span class="gl-bar-l">' + esc(r.a.iata + ' ⇄ ' + r.b.iata) + '</span><span class="gl-bar-v">' + esc(money(r.sum, r.cur)) + '</span>' +
            '<i class="gl-bar-t"><i class="gl-bar-f' + (i === 0 ? ' is-1' : '') + '" style="transform:scaleX(' + (max > 0 ? (r.sum / max).toFixed(3) : 0) + ')"></i></i></button>';
        }).join('') + '</div>' +
      '</div>';
  }
  function fltHTML(l) {
    var head = esc(dayL(l.date)) + (l.fleet ? '<span class="gl-flt-fl">' + esc(l.fleet) + '</span>' : '');
    var chip = '<span class="gl-chip gl-chip-k is-' + esc(l.kind) + '"><i></i>' + esc(kindL(l.kind)) + '</span>';
    var t1 = l.out ? ', ' + l.out : '', t2 = l.in ? ', ' + l.in + (l.inDay ? ' +' + l.inDay : '') : '';
    var stats = l.amount != null
      ? '<div class="gl-st"><span>' + esc(T.earn) + '</span><b>' + esc(money(l.amount, l.currency)) + '</b></div>' +
        '<div class="gl-st"><span>' + esc(T.fixedL) + '</span><b>' + esc(money(Math.round(l.ratePerHour), l.currency)) + ' × ' + esc(hm(l.dutyMin)) + '</b></div>' +
        (l.basis === 'split' ? '<div class="gl-st"><span>' + esc(T.flightL) + '</span><b>' + esc(money(l.flight, l.currency)) + '</b></div>' : '')
      : '<div class="gl-why">' + esc(why(l)) + (l.reason === 'no_payslip' ? ' <a class="gl-add" href="pay-report.html#ps">' + esc(T.addPay) + ' →</a>' : '') + '</div>';
    return '<div class="gl-flt-h"><span class="gl-flt-d">' + head + '</span>' + chip + '</div>' +
      '<div class="gl-flt-r"><div class="gl-ap"><b>' + esc(l.ga.iata) + '</b><span>' + esc(city(l.ga) + t1) + '</span></div>' +
        '<div class="gl-flt-m"><i class="gl-flt-ln"></i><span class="gl-flt-pl">' + IC_PLANE + '</span><i class="gl-flt-ln is-r"></i><span class="gl-flt-bt">' + esc(hm(l.blockMin)) + '</span></div>' +
        '<div class="gl-ap is-r"><b>' + esc(l.gb.iata) + '</b><span>' + esc(city(l.gb) + t2) + '</span></div></div>' +
      '<div class="gl-sts">' + stats + '</div>';
  }
  function listHTML(V) {
    var legs = V.legs.filter(function (l) { return !S.route || routeKey(l) === S.route; });
    var n = { all: legs.length, operating: 0, deadhead: 0 };
    legs.forEach(function (l) { if (l.kind === 'deadhead') n.deadhead++; else n.operating++; });
    if (S.filt !== 'all' && !n[S.filt]) S.filt = 'all';
    var shown = legs.filter(function (l) { return S.filt === 'all' || (S.filt === 'deadhead' ? l.kind === 'deadhead' : l.kind !== 'deadhead'); });
    var r = S.route ? V.routes.filter(function (x) { return x.k === S.route; })[0] : null;
    var chips = [['all', T.all], ['operating', T.op], ['deadhead', T.dh]].filter(function (c) { return c[0] === 'all' || n[c[0]]; });
    return '<div class="gl-card-h"><div><h4 class="gl-card-t">' + esc(T.listT) + '</h4><p class="gl-card-s">' +
        esc(r ? r.a.iata + ' ⇄ ' + r.b.iata + ' · ' + city(r.a) + ' / ' + city(r.b) : T.allRoutes) + '</p></div>' +
        (S.route ? '<button type="button" class="gl-x" data-route="" aria-label="' + esc(T.allRoutes) + '">' + esc(T.allRoutes) + '</button>' : '') + '</div>' +
      '<div class="gl-fl" role="group">' + chips.map(function (c) {
        return '<button type="button" class="gl-fb' + (S.filt === c[0] ? ' on' : '') + '" data-filt="' + c[0] + '" aria-pressed="' + (S.filt === c[0]) + '">' +
          esc(c[1]) + ' <b>' + n[c[0]] + '</b></button>';
      }).join('') + '</div>' +
      '<ol class="gl-rows">' + shown.slice(0, S.listN).map(function (l) {
        return '<li><button type="button" class="gl-r' + (l.id === S.leg ? ' on' : '') + '" data-leg="' + esc(l.id) + '">' +
          '<span class="gl-r-d"><b>' + esc(dayS(l.date)) + '</b><small>' + esc(l.fleet || '') + '</small></span>' +
          '<span class="gl-r-m"><span class="gl-r-ap">' + esc(l.ga.iata) + '</span><i class="gl-r-ln' + (l.kind === 'deadhead' ? ' is-dh' : '') + '"><i></i></i>' +
            '<span class="gl-r-ap">' + esc(l.gb.iata) + '</span>' +
            '<small>' + esc((l.out && l.in ? l.out + ' → ' + l.in + ' · ' : '') + hm(l.blockMin)) + '</small></span>' +
          '<span class="gl-r-v"><b>' + esc(l.amount != null ? money(l.amount, l.currency) : '—') + '</b>' +
            '<small class="gl-r-k is-' + esc(l.kind) + '">' + esc(kindL(l.kind)) + '</small></span></button></li>';
      }).join('') + '</ol>' +
      (shown.length > 8 ? '<button type="button" class="gl-more" data-more="1">' + esc(S.listN < shown.length ? T.more : T.less) + '</button>' : '');
  }
  function monHTML(V, leg) {
    var by = {}, yms = [];
    V.legs.forEach(function (l) {
      if (!by[l.ym]) { by[l.ym] = { sum: 0, n: 0, known: 0, cur: null }; yms.push(l.ym); }
      var m = by[l.ym]; m.n++;
      if (l.amount != null && (m.cur == null || m.cur === l.currency)) { m.cur = l.currency; m.sum += l.amount; m.known++; }
    });
    yms.sort();
    var max = 0; yms.forEach(function (ym) { if (by[ym].known) max = Math.max(max, by[ym].sum); });
    var selYm = leg ? leg.ym : null, top = yms.filter(function (ym) { return by[ym].known && by[ym].sum === max; })[0];
    return '<div class="gl-card-h"><div><h4 class="gl-card-t">' + esc(T.monT) + '</h4><p class="gl-card-s">' + esc(T.monS) + '</p></div>' +
        (top ? '<span class="gl-card-big">' + esc(money(by[top].sum, by[top].cur)) + '<small>' + esc(ymS(top)) + '</small></span>' : '') + '</div>' +
      '<div class="gl-mb" style="--n:' + yms.length + '">' + yms.map(function (ym) {
        var m = by[ym], h = m.known && max > 0 ? m.sum / max : 0;
        var tip = ymS(ym) + ' · ' + (m.known ? money(m.sum, m.cur) : '—');
        return '<span class="gl-mb-c' + (ym === selYm ? ' on' : '') + (m.known ? '' : ' is-none') + '" title="' + esc(tip) + '">' +
          '<i style="transform:scaleY(' + Math.max(m.known ? 0.04 : 0, h).toFixed(3) + ')"></i><small>' + esc(String(+ym.slice(5, 7))) + '</small></span>';
      }).join('') + '</div>';
  }

  /* ── 押す ───────────────────────────────────────────────── */
  function onClick(e) {
    var t = e.target.closest ? e.target.closest('button,a') : null;
    if (!t || !S.root.contains(t)) return;
    if (t.hasAttribute('data-per')) { S.per = t.getAttribute('data-per'); store(PKEY, S.per); S.listN = 8; S.leg = null; S.route = null; render(); G.focusRoute(true); return; }
    if (t.hasAttribute('data-route')) { pickRoute(t.getAttribute('data-route') || null); return; }
    if (t.hasAttribute('data-leg')) { S.leg = t.getAttribute('data-leg'); var l = S.V.legs.filter(function (x) { return x.id === S.leg; })[0]; if (l) S.route = routeKey(l); render(); G.focusRoute(); return; }
    if (t.hasAttribute('data-filt')) { S.filt = t.getAttribute('data-filt'); S.listN = 8; render(); return; }
    if (t.hasAttribute('data-more')) { S.listN = S.listN > 8 ? 8 : 999; render(); return; }
    if (t.hasAttribute('data-z')) { G.zoomBy(+t.getAttribute('data-z') > 0 ? 1.35 : 1 / 1.35); return; }
  }
  function pickRoute(k) {
    S.route = k; S.listN = 8; S.filt = 'all';
    if (k) { var l = S.V.legs.filter(function (x) { return routeKey(x) === k; })[0]; S.leg = l ? l.id : S.leg; }
    render(); G.focusRoute();
  }

  /* ════ 地球儀（canvas 2D・正射図法）═══════════════════════════
     陸は点（pv-globe-land.js）・空港は小さな丸・飛んだルートは大圏の弧を地表から浮かせて描く。
     ドラッグで回す・ボタン／ピンチ／Ctrl＋ホイール（トラックパッドのピンチ）で拡大縮小。ふつうのホイールはページを送る。 */
  var G = (function () {
    var cv, box, cx2, W = 0, H = 0, dpr = 1, raf = 0, last = 0;
    var lam = 0, phi = 0.35, k = 1, vlam = 0, vphi = 0, idleAt = 0, tween = null;
    var land = null, V = null, selRoute = null, selLeg = null, arcs = [], hub = null, ports = [];
    var drag = null, pts = {}, pinch = null, seen = false, inView = false;
    var RM = reduced();
    var PLANE = null;

    function vec(lat, lon) { var a = lat * Math.PI / 180, b = lon * Math.PI / 180; return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)]; }
    function rot(v, out) {
      var cl = Math.cos(lam), sl = Math.sin(lam), cp = Math.cos(phi), sp = Math.sin(phi);
      var x1 = v[0] * cl - v[2] * sl, z1 = v[0] * sl + v[2] * cl;
      out[0] = x1; out[1] = v[1] * cp - z1 * sp; out[2] = v[1] * sp + z1 * cp;
      return out;
    }
    function geom() {
      var narrow = W < 560;
      var cx = narrow ? W / 2 : W * 0.6, cy = narrow ? H * 0.52 : H * 0.53;
      var r0 = narrow ? Math.min(W, H) * 0.4 : Math.min(H * 0.43, W * 0.36);
      return { cx: cx, cy: cy, R: r0 * k };
    }
    function init(canvas, host) {
      cv = canvas; box = host; cx2 = cv.getContext('2d');
      PLANE = typeof Path2D === 'function' ? new Path2D('M7 0 L-5 -4.6 L-2.6 0 L-5 4.6 Z') : null;
      var L0 = w.PV_GLOBE_LAND(), n = L0.length / 2;
      land = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) { var v = vec(L0[i * 2], L0[i * 2 + 1]); land[i * 3] = v[0]; land[i * 3 + 1] = v[1]; land[i * 3 + 2] = v[2]; }
      size();
      if (typeof ResizeObserver === 'function') new ResizeObserver(function () { size(); draw(); }).observe(box);
      if (typeof IntersectionObserver === 'function') {
        new IntersectionObserver(function (es) { inView = es[0].isIntersecting; kick(); }, { threshold: 0.05 }).observe(box);
      } else inView = true;
      d.addEventListener('visibilitychange', kick);
      cv.addEventListener('pointerdown', down);
      cv.addEventListener('pointermove', move);
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', wheel, { passive: false });
    }
    function size() {
      var r = box.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      dpr = Math.min(2, w.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    /* 大圏の弧：地表から浮かせる高さは距離に合わせる（短い便は低く・長い便は高く） */
    function arcOf(a, b) {
      var A = vec(a.lat, a.lon), B = vec(b.lat, b.lon);
      var dot = Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])), om = Math.acos(dot);
      var n = Math.max(16, Math.min(96, Math.ceil(om * 48))), out = [], hmax = Math.min(0.32, 0.04 + om * 0.16);
      for (var i = 0; i <= n; i++) {
        var t = i / n, s1 = om > 1e-6 ? Math.sin((1 - t) * om) / Math.sin(om) : 1 - t, s2 = om > 1e-6 ? Math.sin(t * om) / Math.sin(om) : t;
        var h = 1 + hmax * Math.sin(Math.PI * t);
        out.push([(A[0] * s1 + B[0] * s2) * h, (A[1] * s1 + B[1] * s2) * h, (A[2] * s1 + B[2] * s2) * h]);
      }
      return out;
    }
    function setData(v, route, leg) {
      V = v; selRoute = route || null; selLeg = leg || null;
      arcs = []; ports = []; hub = null;
      if (V) {
        var seenP = {};
        V.routes.forEach(function (r, i) {
          arcs.push({ k: r.k, n: r.n, dh: r.dh === r.n, pts: arcOf(r.a, r.b), off: (i * 0.37) % 1, scr: [] });
          [r.a, r.b].forEach(function (g) { if (!seenP[g.iata]) { seenP[g.iata] = 1; ports.push({ g: g, v: vec(g.lat, g.lon) }); } });
        });
        hub = V.hub;
        if (!seen && V.legs.length) { seen = true; center(true); }
      }
      kick(); draw();
    }
    /* 正面に向ける：選んだルートの真ん中（無ければ拠点と行き先の重心） */
    function target() {
      var vs = [];
      if (selRoute) { var a = arcs.filter(function (x) { return x.k === selRoute; })[0]; if (a) vs.push(a.pts[Math.floor(a.pts.length / 2)]); }
      if (!vs.length) ports.forEach(function (p) { vs.push(p.v); });
      if (!vs.length) return null;
      var x = 0, y = 0, z = 0; vs.forEach(function (v) { x += v[0]; y += v[1]; z += v[2]; });
      var m = Math.sqrt(x * x + y * y + z * z) || 1;
      return { lam: Math.atan2(x / m, z / m), phi: Math.max(-1.2, Math.min(1.2, Math.asin(y / m))) };
    }
    function center(now) {
      var t = target();
      if (!t) return;
      if (now || RM) { lam = t.lam; phi = t.phi * 0.8 + 0.12; draw(); return; }
      var dl = t.lam - lam; while (dl > Math.PI) dl -= 2 * Math.PI; while (dl < -Math.PI) dl += 2 * Math.PI;
      tween = { t0: performance.now(), l0: lam, p0: phi, dl: dl, dp: (t.phi * 0.8 + 0.12) - phi, dur: 900 };
      kick();
    }
    function focusRoute(soft) { center(!!soft && RM); idleAt = performance.now(); }
    function zoomBy(f) { k = Math.max(0.7, Math.min(3.2, k * f)); idleAt = performance.now(); draw(); }

    function hid() { return d.hidden || !inView || !S.visible; }
    function animating() { return !RM && !hid(); }
    function kick() { if (!raf && animating()) { last = performance.now(); raf = w.requestAnimationFrame(frame); } }
    function frame(now) {
      raf = 0;
      if (hid()) return;
      var dt = Math.min(64, now - last); last = now;
      if (tween) {
        var p = Math.min(1, (now - tween.t0) / tween.dur), e = 1 - Math.pow(1 - p, 3);
        lam = tween.l0 + tween.dl * e; phi = tween.p0 + tween.dp * e;
        if (p >= 1) tween = null;
      } else if (!drag && !pinch) {
        if (Math.abs(vlam) > 1e-5 || Math.abs(vphi) > 1e-5) { lam += vlam * dt; phi = clampP(phi + vphi * dt); vlam *= 0.92; vphi *= 0.92; }
        else if (now - idleAt > 6000) lam -= 0.000022 * dt;    // 触っていない間はゆっくり自転
      }
      draw(now);
      if (!RM) raf = w.requestAnimationFrame(frame);
    }
    function clampP(p) { return Math.max(-1.35, Math.min(1.35, p)); }

    /* ── 描く ── */
    function draw(now) {
      if (!cx2 || !W) return;
      now = now || performance.now();
      var g = geom(), cx = g.cx, cy = g.cy, R = g.R, c = cx2, tmp = [0, 0, 0];
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      /* 外の光 */
      var halo = c.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.28);
      halo.addColorStop(0, 'rgba(150,255,226,.16)'); halo.addColorStop(1, 'rgba(150,255,226,0)');
      c.fillStyle = halo; c.beginPath(); c.arc(cx, cy, R * 1.28, 0, Math.PI * 2); c.fill();
      /* 球 */
      var body = c.createRadialGradient(cx - R * 0.35, cy - R * 0.42, R * 0.05, cx, cy, R * 1.05);
      body.addColorStop(0, 'rgba(140,240,210,.26)'); body.addColorStop(0.55, 'rgba(40,150,128,.14)'); body.addColorStop(1, 'rgba(2,30,26,.38)');
      c.fillStyle = body; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
      /* 経緯線（うすく） */
      c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.06)';
      for (var lo = -180; lo < 180; lo += 30) line(function (t) { return vec(-80 + 160 * t, lo); });
      for (var la = -60; la <= 60; la += 30) line(function (t) { return vec(la, -180 + 360 * t); });
      function line(f) {
        c.beginPath(); var on = false;
        for (var i = 0; i <= 72; i++) {
          var p = rot(f(i / 72), tmp);
          if (p[2] < 0) { on = false; continue; }
          var x = cx + R * p[0], y = cy - R * p[1];
          if (on) c.lineTo(x, y); else c.moveTo(x, y);
          on = true;
        }
        c.stroke();
      }
      /* 陸の点：手前ほど大きく・明るく（明るさの段ごとにまとめて塗る） */
      var n = land.length / 3, step = Math.max(1.1, R * 0.0068), buckets = [[], [], [], [], []];
      var cl = Math.cos(lam), sl = Math.sin(lam), cp = Math.cos(phi), sp = Math.sin(phi);
      for (var i = 0; i < n; i++) {
        var x0 = land[i * 3], y0 = land[i * 3 + 1], z0 = land[i * 3 + 2];
        var x1 = x0 * cl - z0 * sl, z1 = x0 * sl + z0 * cl, y2 = y0 * cp - z1 * sp, z2 = y0 * sp + z1 * cp;
        if (z2 <= 0.02) continue;
        buckets[Math.min(4, Math.floor(z2 * 5))].push(cx + R * x1, cy - R * y2, z2);
      }
      for (var bI = 0; bI < 5; bI++) {
        var B = buckets[bI];
        c.fillStyle = 'rgba(214,255,243,' + (0.22 + bI * 0.17).toFixed(2) + ')';
        for (var j = 0; j < B.length; j += 3) { var s = step * (0.62 + 0.5 * B[j + 2]); c.fillRect(B[j] - s / 2, B[j + 1] - s / 2, s, s); }
      }
      /* 縁の光 */
      c.lineWidth = 1.2; c.strokeStyle = 'rgba(200,255,240,.32)'; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
      var rim = c.createRadialGradient(cx, cy, R * 0.8, cx, cy, R);
      rim.addColorStop(0, 'rgba(180,255,235,0)'); rim.addColorStop(1, 'rgba(180,255,235,.12)');
      c.fillStyle = rim; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();

      /* 弧：裏側（球に隠れる所）は描かない。選んだルートは最後に金色で */
      var t = now / 1000, sel = null;
      arcs.forEach(function (a) {
        a.scr = [];
        var vis = [];
        a.pts.forEach(function (v) {
          var p = rot(v, [0, 0, 0]), r2 = p[0] * p[0] + p[1] * p[1];
          var shown = p[2] > 0 || r2 > 1.0005;
          vis.push(shown ? [cx + R * p[0], cy - R * p[1]] : null);
        });
        a.scr = vis;
        if (a.k === selRoute) { sel = a; return; }
        stroke(a, 'rgba(255,255,255,' + (a.dh ? '.42' : '.62') + ')', Math.min(2.4, 1 + Math.log(a.n) * 0.35), a.dh);
      });
      if (sel) {
        c.save(); c.shadowColor = 'rgba(242,184,75,.7)'; c.shadowBlur = 10;
        stroke(sel, '#f2b84b', 2.4, false); c.restore();
      }
      function stroke(a, col, lw, dash) {
        c.strokeStyle = col; c.lineWidth = lw; c.setLineDash(dash ? [3, 4] : []);
        c.beginPath(); var on = false;
        a.scr.forEach(function (p) { if (!p) { on = false; return; } if (on) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); on = true; });
        c.stroke(); c.setLineDash([]);
      }
      /* 飛んでいる飛行機（ルートごとに1機）。動きを減らす設定では止めて、弧の真ん中に置く */
      arcs.forEach(function (a) {
        var per = 5 + a.pts.length * 0.09, u = RM ? 0.5 : ((t / per + a.off) % 1);
        var pos = at(a, u);
        if (!pos) return;
        plane(pos, a.k === selRoute ? '#f2b84b' : 'rgba(255,255,255,.92)', a.k === selRoute ? 1.15 : 0.9);
        if (a.k === selRoute) sel.planeAt = pos;
      });
      /* 空港 */
      c.font = '600 10px Inter, "Noto Sans JP", system-ui, sans-serif'; c.textBaseline = 'middle';
      ports.forEach(function (p) {
        var q = rot(p.v, [0, 0, 0]);
        if (q[2] <= 0.03) return;
        var x = cx + R * q[0], y = cy - R * q[1], isHub = p.g.iata === hub;
        var onSel = selRoute && selRoute.split('|').indexOf(p.g.iata) >= 0;
        c.lineWidth = 1.4;
        if (isHub) { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, 3.6, 0, Math.PI * 2); c.fill(); }
        else { c.strokeStyle = onSel ? '#f2b84b' : 'rgba(255,255,255,.9)'; c.fillStyle = 'rgba(6,60,52,.85)'; c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill(); c.stroke(); }
        c.fillStyle = onSel ? '#ffe2a6' : 'rgba(255,255,255,.82)';
        c.fillText(p.g.iata, x + 6, y + 0.5);
      });
      /* 選んだ便の札（額。出ない便は区間） */
      if (sel && sel.planeAt && selLeg) {
        var label = selLeg.amount != null ? money(selLeg.amount, selLeg.currency) : selLeg.ga.iata + '–' + selLeg.gb.iata;
        c.font = '700 10.5px Inter, "Noto Sans JP", system-ui, sans-serif';
        var tw = c.measureText(label).width + 16, px = sel.planeAt.x - tw / 2, py = sel.planeAt.y - 26;
        c.fillStyle = 'rgba(255,255,255,.95)'; rr(px, py, tw, 18, 9); c.fill();
        c.fillStyle = '#0b3d36'; c.textAlign = 'center'; c.fillText(label, sel.planeAt.x, py + 9.5); c.textAlign = 'left';
      }
      function rr(x, y, w0, h0, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w0, y, x + w0, y + h0, r); c.arcTo(x + w0, y + h0, x, y + h0, r); c.arcTo(x, y + h0, x, y, r); c.arcTo(x, y, x + w0, y, r); c.closePath(); }
      function at(a, u) {
        var f = u * (a.scr.length - 1), i = Math.floor(f), p = a.scr[i], q = a.scr[Math.min(a.scr.length - 1, i + 1)];
        if (!p || !q) return null;
        var r = f - i;
        return { x: p[0] + (q[0] - p[0]) * r, y: p[1] + (q[1] - p[1]) * r, ang: Math.atan2(q[1] - p[1], q[0] - p[0]) };
      }
      function plane(pos, col, s) {
        c.save(); c.translate(pos.x, pos.y); c.rotate(pos.ang); c.scale(s, s); c.fillStyle = col;
        if (PLANE) c.fill(PLANE); else { c.beginPath(); c.arc(0, 0, 3, 0, Math.PI * 2); c.fill(); }
        c.restore();
      }
    }

    /* ── 触る ── */
    function down(e) {
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      var ids = Object.keys(pts);
      if (ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: k }; drag = null; return; }
      drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: 0 };
      tween = null; vlam = vphi = 0; idleAt = performance.now();
    }
    function move(e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (pinch) {
        var ids = Object.keys(pts); if (ids.length < 2) return;
        var a = pts[ids[0]], b = pts[ids[1]], dd = Math.hypot(a.x - b.x, a.y - b.y);
        k = Math.max(0.7, Math.min(3.2, pinch.k * dd / (pinch.d || 1))); draw(); return;
      }
      if (!drag) return;
      var R = geom().R, dx = e.clientX - drag.x, dy = e.clientY - drag.y, nt = performance.now(), dt = Math.max(8, nt - drag.t);
      drag.moved += Math.abs(dx) + Math.abs(dy);
      lam -= dx / R; phi = clampP(phi + dy / R);
      vlam = -dx / R / dt; vphi = dy / R / dt;
      drag.x = e.clientX; drag.y = e.clientY; drag.t = nt; idleAt = nt;
      if (RM || hid()) draw(); else kick();
    }
    function up(e) {
      var wasPinch = !!pinch;
      delete pts[e.pointerId];
      if (Object.keys(pts).length < 2) pinch = null;
      if (!drag || wasPinch) { drag = null; return; }
      var tap = drag.moved < 6, r = cv.getBoundingClientRect();
      drag = null;
      if (RM) vlam = vphi = 0;
      if (tap) hit(e.clientX - r.left, e.clientY - r.top);
    }
    function wheel(e) {
      if (!e.ctrlKey) return;                     // ふつうのホイールはページを送る。Ctrl＋ホイール（トラックパッドのピンチ）だけ拡大縮小
      e.preventDefault();
      k = Math.max(0.7, Math.min(3.2, k * Math.exp(-e.deltaY * 0.01))); idleAt = performance.now(); draw();
    }
    /* 押した所にいちばん近い弧（12px 以内） */
    function hit(x, y) {
      var best = null, bd = 12;
      arcs.forEach(function (a) {
        for (var i = 1; i < a.scr.length; i++) {
          var p = a.scr[i - 1], q = a.scr[i];
          if (!p || !q) continue;
          var dx = q[0] - p[0], dy = q[1] - p[1], L2 = dx * dx + dy * dy || 1;
          var u = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / L2));
          var dd = Math.hypot(x - (p[0] + u * dx), y - (p[1] + u * dy));
          if (dd < bd) { bd = dd; best = a; }
        }
      });
      if (best) pickRoute(best.k);
    }
    return { init: init, setData: setData, focusRoute: focusRoute, zoomBy: zoomBy, kick: kick, draw: draw };
  }());

  /* ── 外から ─────────────────────────────────────────────── */
  function mount(el, ctx) {
    S.el = el; S.ctx = ctx || {}; S.sb = S.ctx.sb;
    render();
    load();
    w.addEventListener('pv-roster-change', function () { S.leg = null; S.route = null; load(); });
    w.addEventListener('pv-currency-change', function () { render(); });
  }
  function show() { S.visible = true; G.kick(); G.draw(); }
  function hide() { S.visible = false; }
  w.PVGlobe = { mount: mount, show: show, hide: hide, reload: load };
}(window));
