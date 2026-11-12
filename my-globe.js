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
      title: 'ROUTE', sub: '{p} · {r}ルート · {n}便', aria: '飛んだルートの地球儀', noPos: '地図に出せない空港 {c}',
      nFl: '{n}便', nFl1: '1便', partT: '{m}は {g} のスケジュールが無いので、取り込んだ日から補って見積もっています。', gapD: '{a}〜{b}日', gapD1: '{a}日', gapJ: '・',
      addRoster: 'スケジュールを足す',
      perAria: '期間', perD: '日', perM: '月', per3: '3か月', per12: '1年', perAll: '全部',
      p3: '直近3か月', p12: '直近1年', pAll: '直近2年', ymT: '{y}年{n}月',
      prevD: '前の日', nextD: '次の日', prevM: '前の月', nextM: '次の月',
      sumT: 'FLIGHT EARNINGS', est: '目安',
      ringL: 'ブロック', ringA: '勤務時間のうちブロックタイムの割合 {p}',
      legHub: '拠点', legDest: '行き先', legDh: 'DH',
      hint: 'ドラッグで回す・ルートを押す', zin: '拡大', zout: '縮小',
      op: '乗務', dh: 'DH', unk: '区分確認中',
      earn: 'この便の稼ぎ（目安）', fixedL: '時給 × 勤務', flightL: '乗務手当・日当',
      no_payslip: '{m}の明細を足すと出ます', roster_partial: 'この月のスケジュールを全部取り込むと出ます',
      mixed_currency: '通貨の違う明細が混ざる月は出せません', no_duty: '勤務時間が分からない月は出せません',
      no_block: 'この便の時間が分からないため出せません', no_pay: 'この月は額を出せません',
      fixedFrom: '基本給は{m}の明細から', lagQ: '飛んだ分（乗務手当・日当）は、何月の給与明細に出ますか？',
      lag0: '同じ月', lag1: '翌月', lag2: '翌々月', lagU: 'わからない', lagErr: '保存できませんでした。もう一度お試しください。',
      addPay: '明細を足す',
      listT: '便の一覧', all: 'すべて', allRoutes: '全ルート', more: 'もっと見る', less: '閉じる',
      monT: '月ごとの稼ぎ（目安）', monS: '便の額の合計', dayMonT: '日ごとの稼ぎ（目安）', monTip: '押すとその月だけ', dayTip: '押すとその日だけ',
      empty: 'スケジュールを取り込むと、飛んだルートがここに描かれます。',
      none: 'この期間に飛んだ便はありません。',
      err: '地球儀を読み込めませんでした。時間をおいて開き直してください。',
      ymS: '{n}月', dayT: '{n}月{d}日（{w}）', dayS: '{n}/{d}',
      wd: ['月', '火', '水', '木', '金', '土', '日'],
      mon: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
    },
    en: {
      title: 'ROUTE', sub: '{p} · {r} routes · {n} flights', aria: 'Globe of the routes you flew', noPos: 'Not on the map: {c}',
      nFl: '{n} flights', nFl1: '1 flight', partT: 'No roster for {g} {m}, so this is estimated from the days you imported.', gapD: '{a}–{b}', gapD1: '{a}', gapJ: ', ',
      addRoster: 'Add roster',
      perAria: 'Period', perD: '1D', perM: '1M', per3: '3M', per12: '1Y', perAll: 'All time',
      p3: 'Last 3 months', p12: 'Last 12 months', pAll: 'Last 24 months', ymT: '{M} {y}',
      prevD: 'Previous day', nextD: 'Next day', prevM: 'Previous month', nextM: 'Next month',
      sumT: 'FLIGHT EARNINGS', est: 'est.',
      ringL: 'Block', ringA: 'Block time as a share of duty time {p}',
      legHub: 'Base', legDest: 'Destination', legDh: 'Deadhead',
      hint: 'Drag to rotate, tap a route', zin: 'Zoom in', zout: 'Zoom out',
      op: 'Operating', dh: 'Deadhead', unk: 'Unclassified',
      earn: 'Earned on this flight (est.)', fixedL: 'Hourly × duty', flightL: 'Flight pay & per diem',
      no_payslip: 'Add your {m} payslip to see this', roster_partial: 'Import the whole month of your roster to see this',
      mixed_currency: 'Not shown for months with payslips in different currencies', no_duty: 'Not shown when the month has no duty times',
      no_block: 'Not shown because this flight has no block time', no_pay: 'Not shown for this month',
      fixedFrom: 'Base pay from your {m} payslip', lagQ: 'Which month’s payslip pays for your flying (flight pay, per diem)?',
      lag0: 'Same month', lag1: 'Next month', lag2: 'Two months later', lagU: 'Not sure', lagErr: 'Couldn’t save. Please try again.',
      addPay: 'Add payslip',
      listT: 'Flights', all: 'All flights', allRoutes: 'All routes', more: 'Show more', less: 'Show less',
      monT: 'Earnings by month (est.)', monS: 'Sum of flights', dayMonT: 'Earnings by day (est.)', monTip: 'Tap to see only that month', dayTip: 'Tap to see only that day',
      empty: 'Import your roster and every route you fly will be drawn here.',
      none: 'No flights in this period.',
      err: 'Could not load the globe. Please try again in a moment.',
      ymS: '{M}', dayT: '{w}, {M} {d}', dayS: '{M} {d}',
      wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      mon: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    }, /*PV-MSG:es*/ es: {
      title: 'ROUTE', sub: '{p} · {r} rutas · {n} vuelos', aria: 'Globo con las rutas que volaste', noPos: 'Fuera del mapa: {c}',
      nFl: '{n} vuelos', nFl1: '1 vuelo', partT: 'No hay programación para el {g} de {m}, así que se estima con los días que importaste.', gapD: '{a}–{b}', gapD1: '{a}', gapJ: ', ',
      addRoster: 'Agregar programación',
      perAria: 'Período', perD: '1D', perM: '1M', per3: '3M', per12: '1Y', perAll: 'Todo',
      p3: 'Últimos 3 meses', p12: 'Últimos 12 meses', pAll: 'Últimos 24 meses', ymT: '{M} {y}',
      prevD: 'Día anterior', nextD: 'Día siguiente', prevM: 'Mes anterior', nextM: 'Mes siguiente',
      sumT: 'FLIGHT EARNINGS', est: 'estimado',
      ringL: 'Horas block', ringA: 'Tiempo de bloque sobre el tiempo de servicio {p}',
      legHub: 'Base', legDest: 'Destino', legDh: 'Deadhead',
      hint: 'Arrastra para girar y toca una ruta', zin: 'Acercar', zout: 'Alejar',
      op: 'Operando', dh: 'Deadhead', unk: 'Sin clasificar',
      earn: 'Ganado en este vuelo (est.)', fixedL: 'Por hora × servicio', flightL: 'Pago de vuelo y viáticos',
      no_payslip: 'Agrega tu recibo de nómina de {m} para verlo', roster_partial: 'Importa el mes completo de tu programación para verlo',
      mixed_currency: 'No se muestra en meses con recibos en distintas monedas', no_duty: 'No se muestra si el mes no tiene horas de servicio',
      no_block: 'No se muestra porque este vuelo no tiene tiempo de bloque', no_pay: 'No se muestra en este mes',
      fixedFrom: 'Sueldo base de tu recibo de {m}', lagQ: '¿En la nómina de qué mes se paga lo que vuelas (pago por vuelo, viáticos)?',
      lag0: 'Mismo mes', lag1: 'Mes siguiente', lag2: 'Dos meses después', lagU: 'No lo sé', lagErr: 'No se pudo guardar. Inténtalo de nuevo.',
      addPay: 'Agregar recibo',
      listT: 'Vuelos', all: 'Todos', allRoutes: 'Todas las rutas', more: 'Ver más', less: 'Ver menos',
      monT: 'Ingresos por mes (est.)', monS: 'Suma de los vuelos', dayMonT: 'Ingresos por día (est.)', monTip: 'Toca para ver solo ese mes', dayTip: 'Toca para ver solo ese día',
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
  function ymL(ym) { var n = +ym.slice(5, 7); return fill(T.ymT, { y: +ym.slice(0, 4), n: n, M: T.mon[n - 1] }); }
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
    per: (function () { var v = stored(PKEY); return /^(d|m|3|12|all)$/.test(v || '') ? v : '12'; }()),
    day: null, ym: null,
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
      /* 位置の分からない空港（表に無いコード・読み違い）も便としては残す＝稼ぎの合計と一覧に入る。地球儀に描かないだけ */
      o.ga = geo(l.from) || { iata: String(l.from).toUpperCase(), en: '', ja: '', lat: null, lon: null };
      o.gb = geo(l.to) || { iata: String(l.to).toUpperCase(), en: '', ja: '', lat: null, lon: null };
      o.fleet = l.fleet ? String(l.fleet).toUpperCase() : null;   // 明細の機材（b777 → B777）
      o.id = l.date + '#' + l.seq + '#' + l.from + l.to;
      return o;
    }).filter(function (l) { return l.ga.iata !== l.gb.iata; })
      .sort(function (p, q) { return p.date < q.date ? 1 : p.date > q.date ? -1 : (q.seq || 0) - (p.seq || 0); });
  }

  /* ── 期間で絞る・ルートに束ねる ────────────────────────────── */
  function cutoff() { var t = today(); return S.per === '3' ? addMonths(t, -3) : S.per === '12' ? addMonths(t, -12) : addMonths(t, -24); }
  /* 日・月で見るとき：飛んだ日・飛んだ月だけを順に送る（便の無い日・月は飛ばす）。最初はいちばん新しい日・月 */
  function flownDays() { var o = {}; S.legs.forEach(function (l) { o[l.date] = 1; }); return Object.keys(o).sort(); }
  function flownYms() { var o = {}; S.legs.forEach(function (l) { o[l.date.slice(0, 7)] = 1; }); return Object.keys(o).sort(); }
  function anchor() {
    var ds = flownDays(), ys = flownYms();
    if (!S.day || ds.indexOf(S.day) < 0) S.day = ds[ds.length - 1] || null;
    if (!S.ym || ys.indexOf(S.ym) < 0) S.ym = ys[ys.length - 1] || null;
  }
  function inRange(date) {
    if (S.per === 'd') return date === S.day;
    if (S.per === 'm') return date.slice(0, 7) === S.ym;
    return date > cutoff() && date <= today();
  }
  function step(dir) {
    var list = S.per === 'd' ? flownDays() : flownYms(), cur = S.per === 'd' ? S.day : S.ym, i = list.indexOf(cur) + dir;
    if (i < 0 || i >= list.length) return;
    if (S.per === 'd') S.day = list[i]; else S.ym = list[i];
    S.leg = null; S.route = null; S.listN = 8; render(); G.focusRoute();
  }
  function view() {
    anchor();
    var legs = S.legs.filter(function (l) { return inRange(l.date); });
    var routes = {}, port = {}, order = [];
    legs.forEach(function (l) {
      var a = l.ga.iata, b = l.gb.iata, k = a < b ? a + '|' + b : b + '|' + a;
      var r = routes[k];
      if (!r) { r = routes[k] = { k: k, a: a < b ? l.ga : l.gb, b: a < b ? l.gb : l.ga, legs: [], n: 0, dh: 0, sum: 0, cur: null, dirs: {} }; order.push(r); }
      r.legs.push(l); r.n++; if (l.kind === 'deadhead') r.dh++;
      r.dirs[a + '>' + b] = 1;
      if (l.amount != null) { if (r.cur == null) r.cur = l.currency; if (r.cur === l.currency) r.sum += l.amount; }
      port[a] = (port[a] || 0) + 1; port[b] = (port[b] || 0) + 1;
    });
    var hub = Object.keys(port).sort(function (p, q) { return port[q] - port[p] || (p < q ? -1 : 1); })[0] || null;
    /* 勤務時間のうちブロックタイムの割合（乗務の便のブロックタイム ÷ 勤務時間ぜんぶ）。1日でも1年でも同じ式・期間の稼ぎの合計 */
    var t = today(), fly = 0, all = 0, total = 0, cur = null;
    (S.model && S.model.roster ? S.model.roster.months : []).forEach(function (rm) {
      rm.days.forEach(function (x) {
        if (!x.isDuty || x.date > t || !inRange(x.date)) return;
        var v = x.dutyMin != null ? x.dutyMin : ((x.blockKnown.operating || 0) + (x.blockKnown.deadhead || 0) + (x.blockKnown.unknown || 0)) || null;
        if (v != null) all += v;
      });
    });
    legs.forEach(function (l) { if (l.kind !== 'deadhead' && l.blockMin != null) fly += l.blockMin; });
    legs.forEach(function (l) { if (l.amount == null) return; if (cur == null) cur = l.currency; if (cur === l.currency) total += l.amount; });
    var top = order.filter(function (r) { return r.cur === cur && r.sum > 0; }).sort(function (p, q) { return q.sum - p.sum; }).slice(0, 3);
    return { legs: legs, routes: order, hub: hub, ring: all > 0 ? Math.min(1, fly / all) : null, total: cur == null ? null : total, cur: cur, top: top };
  }

  /* ── 描く（字）──────────────────────────────────────────── */
  var IC_PLANE = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M21 15.5v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V8.5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z" transform="rotate(90 12 12)"/></svg>';
  var IC_HAND = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11.5v-2a1.5 1.5 0 0 1 3 0V12"/><path d="M14 10.5a1.5 1.5 0 0 1 3 0V12"/><path d="M17 11.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.6-2.2L5 16.5a1.6 1.6 0 0 1 2.4-2.1L8 15"/></svg>';
  function kindL(k) { return k === 'deadhead' ? T.dh : k === 'unknown' ? T.unk : T.op; }
  /* ★2026-11-12 オーナー「片道なのに矢印が2つ」：期間の中で飛んだ向きが1つだけなら、その向きで「HND → FUK」。両方あれば「HND ⇄ KMJ」 */
  function routeLabel(r) {
    var ks = Object.keys(r.dirs || {});
    if (ks.length === 1) { var p = ks[0].split('>'); return p[0] + ' → ' + p[1]; }
    return r.a.iata + ' ⇄ ' + r.b.iata;
  }
  function nFl(n) { return n === 1 ? T.nFl1 : fill(T.nFl, { n: n }); }
  function gapsL(gs) {
    return (gs || []).map(function (g) { return g[0] === g[1] ? fill(T.gapD1, { a: g[0] }) : fill(T.gapD, { a: g[0], b: g[1] }); }).join(T.gapJ);
  }
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
              [['d', T.perD], ['m', T.perM], ['3', T.per3], ['12', T.per12], ['all', T.perAll]].map(function (p) {
                return '<button type="button" class="gl-pb" data-per="' + p[0] + '" aria-pressed="false">' + esc(p[1]) + '</button>';
              }).join('') + '</div>' +
            '<div class="gl-step" hidden><button type="button" class="gl-sb" data-step="-1">‹</button><span class="gl-sl"></span>' +
              '<button type="button" class="gl-sb" data-step="1">›</button></div></div>' +
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
    if (V && S.per === 'd' && S.day) perL = dayL(S.day);
    if (V && S.per === 'm' && S.ym) perL = ymL(S.ym);
    /* 日・月の送り：端では押せない */
    var stepEl = S.root.querySelector('.gl-step'), dm = !!V && (S.per === 'd' || S.per === 'm') && S.legs.length > 0;
    stepEl.hidden = !dm;
    if (dm) {
      var seq = S.per === 'd' ? flownDays() : flownYms(), at = seq.indexOf(S.per === 'd' ? S.day : S.ym);   // ★名前を list にしない（上の便の一覧の箱と同じ var になる）
      var bs = stepEl.querySelectorAll('.gl-sb');
      bs[0].disabled = at <= 0; bs[1].disabled = at < 0 || at >= seq.length - 1;
      bs[0].setAttribute('aria-label', S.per === 'd' ? T.prevD : T.prevM); bs[1].setAttribute('aria-label', S.per === 'd' ? T.nextD : T.nextM);
      stepEl.querySelector('.gl-sl').textContent = perL;
    }
    if (!V) {
      sub.textContent = S.err ? '' : perL;
      msg.hidden = !S.err; msg.textContent = S.err ? T.err : '';
      sum.hidden = flt.hidden = list.hidden = mon.hidden = true;
      G.setData(null);
      return;
    }
    var nopos = {};
    V.legs.forEach(function (l) { [l.ga, l.gb].forEach(function (g) { if (g.lat == null) nopos[g.iata] = 1; }); });
    var np = Object.keys(nopos).sort();
    sub.textContent = fill(T.sub, { p: perL, r: V.routes.length, n: V.legs.length }) + (np.length ? ' · ' + fill(T.noPos, { c: np.slice(0, 4).join(' ') + (np.length > 4 ? ' …' : '') }) : '');
    /* 選んでいるルート・便が期間の外に出たら、いちばん新しい便へ */
    if (S.leg && !V.legs.some(function (l) { return l.id === S.leg; })) S.leg = null;
    if (S.route && !V.routes.some(function (r) { return r.k === S.route; })) S.route = null;
    /* 最初に選ぶのは、額の出るいちばん新しい便（無ければいちばん新しい便） */
    if (!S.leg && V.legs.length) { var amt = V.legs.filter(function (l) { return l.amount != null; })[0]; S.leg = (amt || V.legs[0]).id; }
    var leg = V.legs.filter(function (l) { return l.id === S.leg; })[0] || null;
    var drawRoute = S.route || (leg ? routeKey(leg) : null);   // ★S.route を便から埋めない（埋めると「全ルート」が押しても戻る）
    S.drawRoute = drawRoute;
    var empty = !S.legs.length;
    msg.hidden = !(empty || !V.legs.length);
    msg.textContent = empty ? T.empty : !V.legs.length ? T.none : '';
    sum.hidden = !V.legs.length; flt.hidden = !leg;
    list.hidden = !V.legs.length; mon.hidden = !V.legs.length;
    if (V.legs.length) { sum.innerHTML = sumHTML(V); list.innerHTML = listHTML(V); mon.innerHTML = monHTML(V, leg); }
    if (leg) flt.innerHTML = fltHTML(leg);
    G.setData(V, drawRoute, leg);
  }
  function routeKey(l) { var a = l.ga.iata, b = l.gb.iata; return a < b ? a + '|' + b : b + '|' + a; }
  function sumHTML(V) {
    var p = V.ring == null ? null : Math.round(V.ring * 1000) / 10;
    var C = 2 * Math.PI * 34, off = p == null ? C : C * (1 - p / 100);
    var max = V.top.length ? V.top[0].sum : 0;
    return '<div class="gl-sum-h"><span class="gl-ov-t">' + esc(T.sumT) + '<small>' + esc(T.est) + '</small></span>' +
        '<span class="gl-chip">' + esc(V.total == null ? '—' : money(V.total, V.cur)) + '</span></div>' +
      '<div class="gl-sum-b">' +
        '<div class="gl-ring" role="img" aria-label="' + esc(fill(T.ringA, { p: p == null ? '—' : p + '%' })) + '">' +
          '<svg viewBox="0 0 84 84" width="84" height="84" aria-hidden="true"><defs><linearGradient id="glRg" x1="0" y1="1" x2="1" y2="0">' +
          '<stop offset="0" stop-color="#9ff0da"/><stop offset=".55" stop-color="#d9f2a8"/><stop offset="1" stop-color="#f5c35a"/></linearGradient></defs>' +
          '<circle cx="42" cy="42" r="34" class="gl-ring-tr"/>' +
          '<circle cx="42" cy="42" r="34" class="gl-ring-v" stroke="url(#glRg)" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 42 42)"/></svg>' +
          '<span class="gl-ring-n">' + (p == null ? '—' : p.toFixed(1) + '%') + '<small>' + esc(T.ringL) + '</small></span></div>' +
        '<div class="gl-bars">' + V.top.map(function (r, i) {
          return '<button type="button" class="gl-bar' + (r.k === S.drawRoute ? ' on' : '') + '" data-route="' + esc(r.k) + '">' +
            '<span class="gl-bar-l">' + esc(routeLabel(r)) + '</span><span class="gl-bar-v">' + esc(money(r.sum, r.cur)) + '</span>' +
            '<i class="gl-bar-t"><i class="gl-bar-f' + (i === 0 ? ' is-1' : '') + '" style="transform:scaleX(' + (max > 0 ? (r.sum / max).toFixed(3) : 0) + ')"></i></i></button>';
        }).join('') + '</div>' +
      '</div>';
  }
  function fltHTML(l) {
    var head = esc(dayL(l.date)) + (l.fleet ? '<span class="gl-flt-fl">' + esc(l.fleet) + '</span>' : '');
    var chip = '<span class="gl-chip gl-chip-k is-' + esc(l.kind) + '"><i></i>' + esc(kindL(l.kind)) + '</span>';
    var stats = l.amount != null
      ? '<div class="gl-st"><span>' + esc(T.earn) + '</span><b>' + esc(money(l.amount, l.currency)) + '</b></div>' +
        '<div class="gl-st"><span>' + esc(T.fixedL) + '</span><b>' + esc(money(Math.round(l.ratePerHour), l.currency)) + ' × ' + esc(hm(l.dutyMin)) + '</b></div>' +
        (l.basis === 'split' ? '<div class="gl-st"><span>' + esc(T.flightL) + '</span><b>' + esc(money(l.flight, l.currency)) + '</b></div>' : '')
      : '<div class="gl-why">' + esc(why(l)) + (l.reason === 'no_payslip' ? ' <a class="gl-add" href="pay-report.html#ps">' + esc(T.addPay) + ' →</a>' : '') + '</div>' + lagAskHTML(l);
    if (l.amount != null && l.fixedFrom) stats += '<p class="gl-from">' + esc(fill(T.fixedFrom, { m: ymS(l.fixedFrom) })) + '</p>';
    if (l.amount != null && l.partial && l.partial.gaps.length) {
      stats += '<div class="gl-part"><p>' + esc(fill(T.partT, { m: ymS(l.ym), g: gapsL(l.partial.gaps) })) + '</p>' +
        '<button type="button" class="gl-lagb" data-roster-up="1">' + esc(T.addRoster) + '</button></div>';
    }
    return '<div class="gl-flt-h"><span class="gl-flt-d">' + head + '</span>' + chip + '</div>' +
      '<div class="gl-flt-r"><div class="gl-ap"><b>' + esc(l.ga.iata) + '</b><span>' + esc(city(l.ga)) + '</span><span class="gl-ap-t">' + esc(l.out || '') + '</span></div>' +
        '<div class="gl-flt-m"><i class="gl-flt-ln"></i><span class="gl-flt-pl">' + IC_PLANE + '</span><i class="gl-flt-ln is-r"></i><span class="gl-flt-bt">' + esc(hm(l.blockMin)) + '</span></div>' +
        '<div class="gl-ap is-r"><b>' + esc(l.gb.iata) + '</b><span>' + esc(city(l.gb)) + '</span><span class="gl-ap-t">' + esc(l.in ? l.in + (l.inDay ? ' +' + l.inDay : '') : '') + '</span></div></div>' +
      '<div class="gl-sts">' + stats + '</div>';
  }
  /* 飛んだ分が何月の明細に出るか（会社ごと・スケジュールの取り込みで聞く・設定で直せる）。まだ答えていない人には、額が出ない便のカードで聞く */
  function lagAskHTML(l) {
    if (!S.fp || S.fp.lagAsked || l.reason !== 'no_payslip') return '';
    return '<div class="gl-lagq"><p>' + esc(T.lagQ) + '</p><div class="gl-lagc">' +
      [[0, T.lag0], [1, T.lag1], [2, T.lag2], [-1, T.lagU]].map(function (o) {
        return '<button type="button" class="gl-lagb" data-lag="' + o[0] + '">' + esc(o[1]) + '</button>';
      }).join('') + '</div>' + (S.lagErr ? '<p class="gl-lage" role="status">' + esc(T.lagErr) + '</p>' : '') + '</div>';
  }
  function setLag(v) {
    var a = S.ctx.current ? S.ctx.current() : null;
    if (!a || !a.airline || S.lagBusy) return;
    S.lagBusy = true; S.lagErr = false;
    Promise.resolve(S.sb.rpc('set_roster_profile', { p_airline: a.airline, p_airline_other: a.other || null, p: { pay_lag: v } })).then(function (r) {
      S.lagBusy = false;
      if (r && !r.error && r.data && r.data.ok) {
        /* スケジュールのタブ（設定の「明細に出る月」）も同じ答えに */
        try { var RS = w.PVRoster && w.PVRoster._ && w.PVRoster._.S; if (RS && r.data.profile) RS.profile = r.data.profile; } catch (e) {}
        load();
      }
      else { S.lagErr = true; render(); }
    }, function () { S.lagBusy = false; S.lagErr = true; render(); });
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
        esc(r ? routeLabel(r) + ' · ' + nFl(r.n) + ' · ' + city(r.a) + ' / ' + city(r.b) : T.allRoutes) + '</p></div>' +
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
    if (S.per === 'd' || S.per === 'm') return dayBarsHTML(leg);
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
        return '<button type="button" class="gl-mb-c' + (ym === selYm ? ' on' : '') + (m.known ? '' : ' is-none') + '" data-goym="' + ym + '" title="' + esc(tip + ' · ' + T.monTip) + '" aria-label="' + esc(tip) + '">' +
          '<i style="transform:scaleY(' + Math.max(m.known ? 0.04 : 0, h).toFixed(3) + ')"></i><small>' + esc(String(+ym.slice(5, 7))) + '</small></button>';
      }).join('') + '</div>';
  }
  function dayBarsHTML(leg) {
    var ym = S.per === 'd' ? (S.day || '').slice(0, 7) : S.ym;
    if (!ym) return '';
    var n = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate(), by = {}, tot = 0, cur = null, max = 0;
    S.legs.forEach(function (l) {
      if (l.date.slice(0, 7) !== ym) return;
      var b = by[l.date] || (by[l.date] = { sum: 0, known: 0, n: 0 });
      b.n++;
      if (l.amount != null && (cur == null || cur === l.currency)) { cur = l.currency; b.sum += l.amount; b.known++; tot += l.amount; }
    });
    Object.keys(by).forEach(function (k) { if (by[k].known) max = Math.max(max, by[k].sum); });
    var sel = S.per === 'd' ? S.day : (leg ? leg.date : null), cells = [];
    for (var i = 1; i <= n; i++) {
      var dt = ym + '-' + pad2(i), b = by[dt];
      if (!b) { cells.push('<span class="gl-mb-c is-off"><i></i><small>' + (i % 5 === 1 || i === n ? i : '') + '</small></span>'); continue; }
      var h = b.known && max > 0 ? b.sum / max : 0, tip = dayS(dt) + ' · ' + (b.known ? money(b.sum, cur) : '—');
      cells.push('<button type="button" class="gl-mb-c' + (dt === sel ? ' on' : '') + (b.known ? '' : ' is-none') + '" data-goday="' + dt + '" title="' + esc(tip + ' · ' + T.dayTip) + '" aria-label="' + esc(tip) + '">' +
        '<i style="transform:scaleY(' + Math.max(b.known ? 0.04 : 0, h).toFixed(3) + ')"></i><small>' + (i % 5 === 1 || i === n || dt === sel ? i : '') + '</small></button>');
    }
    return '<div class="gl-card-h"><div><h4 class="gl-card-t">' + esc(T.dayMonT) + '</h4><p class="gl-card-s">' + esc(ymL(ym)) + '</p></div>' +
        (cur != null ? '<span class="gl-card-big">' + esc(money(tot, cur)) + '<small>' + esc(ymS(ym)) + '</small></span>' : '') + '</div>' +
      '<div class="gl-mb is-days" style="--n:' + n + '">' + cells.join('') + '</div>';
  }

  /* ── 押す ───────────────────────────────────────────────── */
  function onClick(e) {
    var t = e.target.closest ? e.target.closest('button,a') : null;
    if (!t || !S.root.contains(t)) return;
    if (t.hasAttribute('data-per')) { S.per = t.getAttribute('data-per'); store(PKEY, S.per); S.listN = 8; S.leg = null; S.route = null; render(); G.home(); return; }
    if (t.hasAttribute('data-step')) { step(+t.getAttribute('data-step')); return; }
    if (t.hasAttribute('data-lag')) { setLag(+t.getAttribute('data-lag')); return; }
    if (t.hasAttribute('data-roster-up')) { if (w.PVRoster && w.PVRoster.open) w.PVRoster.open({ upload: true }); return; }
    if (t.hasAttribute('data-goym')) { S.per = 'm'; S.ym = t.getAttribute('data-goym'); S.leg = null; S.route = null; S.listN = 8; render(); G.focusRoute(); return; }
    if (t.hasAttribute('data-goday')) { S.per = 'd'; S.day = t.getAttribute('data-goday'); S.leg = null; S.route = null; S.listN = 8; render(); G.focusRoute(); return; }
    if (t.hasAttribute('data-route')) { pickRoute(t.getAttribute('data-route') || null); return; }
    if (t.hasAttribute('data-leg')) { S.leg = t.getAttribute('data-leg'); render(); G.focusRoute(); return; }   // 一覧の絞り方はそのまま
    if (t.hasAttribute('data-filt')) { S.filt = t.getAttribute('data-filt'); S.listN = 8; render(); return; }
    if (t.hasAttribute('data-more')) { S.listN = S.listN > 8 ? 8 : 999; render(); return; }
    if (t.hasAttribute('data-z')) { G.zoomBy(+t.getAttribute('data-z') > 0 ? 1.8 : 1 / 1.8); return; }
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
    var V = null, selRoute = null, selLeg = null, arcs = [], hub = null, ports = [];
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
      var cx = narrow ? W / 2 : W * 0.62, cy = narrow ? H * 0.5 : H * 0.52;
      var r0 = narrow ? Math.min(W * 0.41, H * 0.43) : Math.min(H * 0.41, W * 0.33);
      return { cx: cx, cy: cy, R: r0 * k };
    }
    function init(canvas, host) {
      cv = canvas; box = host; cx2 = cv.getContext('2d');
      /* 上から見た飛行機（機首が右）：胴・主翼・尾翼 */
      PLANE = typeof Path2D === 'function' ? new Path2D('M7 0 C7 -.8 5.6 -1 4.6 -1 L1.6 -1 L-1.6 -6 L-3 -6 L-1.4 -1 L-4.6 -1 L-5.8 -3 L-6.8 -3 L-6 0 L-6.8 3 L-5.8 3 L-4.6 1 L-1.4 1 L-3 6 L-1.6 6 L1.6 1 L4.6 1 C5.6 1 7 .8 7 0 Z') : null;
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
      var n = Math.max(16, Math.min(96, Math.ceil(om * 48))), out = [], hmax = Math.min(0.14, 0.012 + om * 0.06);
      for (var i = 0; i <= n; i++) {
        var t = i / n, s1 = om > 1e-6 ? Math.sin((1 - t) * om) / Math.sin(om) : 1 - t, s2 = om > 1e-6 ? Math.sin(t * om) / Math.sin(om) : t;
        var h = 1 + hmax * Math.sin(Math.PI * t);
        out.push([(A[0] * s1 + B[0] * s2) * h, (A[1] * s1 + B[1] * s2) * h, (A[2] * s1 + B[2] * s2) * h]);
      }
      return out;
    }
    var selT0 = 0;
    function setData(v, route, leg) {
      if ((route || null) !== selRoute || (leg && leg.id) !== (selLeg && selLeg.id)) selT0 = performance.now() / 1000;   // 選び直したら出発地から
      V = v; selRoute = route || null; selLeg = leg || null;
      arcs = []; ports = []; hub = null;
      if (V) {
        var seenP = {};
        V.routes.forEach(function (r, i) {
          if (r.a.lat == null || r.b.lat == null) return;          // 位置の分からない空港の区間は描かない
          var A0 = vec(r.a.lat, r.a.lon), B0 = vec(r.b.lat, r.b.lon);
          var om = Math.acos(Math.max(-1, Math.min(1, A0[0] * B0[0] + A0[1] * B0[1] + A0[2] * B0[2])));
          arcs.push({ k: r.k, n: r.n, dh: r.dh === r.n, pts: arcOf(r.a, r.b), om: om, a: r.a.iata, scr: [] });
          [r.a, r.b].forEach(function (g) { if (!seenP[g.iata]) { seenP[g.iata] = 1; ports.push({ g: g, v: vec(g.lat, g.lon) }); } });
        });
        hub = V.hub;
        if (!seen && V.legs.length) { seen = true; home(true); }
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
    /* 寄り具合：2,200km より短いルートは、画面の中でちょうどよい長さになるまで寄る。長いルートを選んだら引く */
    function fitK() {
      var a = selRoute ? arcs.filter(function (x) { return x.k === selRoute; })[0] : null;
      if (!a) return k;
      /* ★2026-11-12 オーナー「国内線の1便の線がちゃんと見えるまで」：ルートが画面の短い辺の半分くらいの長さになるまで寄る */
      if (a.om < 0.35) { var r0 = geom().R / k; return Math.max(1, Math.min(KMAX, (Math.min(W, H) * 0.5) / (r0 * Math.max(a.om, 0.002)))); }
      return k > 1.4 ? 1 : k;
    }
    function center(now) {
      var t = target();
      if (!t) return;
      var kT = fitK(), pT = t.phi * (1 - 0.2 / kT) + 0.12 / kT;     // 寄るほど真ん中に（引いているときは少し傾けて北が上に見える）
      if (now || RM) { lam = t.lam; phi = pT; k = kT; draw(); return; }
      var dl = t.lam - lam; while (dl > Math.PI) dl -= 2 * Math.PI; while (dl < -Math.PI) dl += 2 * Math.PI;
      tween = { t0: performance.now(), l0: lam, p0: phi, dl: dl, dp: pT - phi, k0: k, dk: kT - k, dur: 1000 };
      kick();
    }
    function focusRoute(soft) { center(!!soft && RM); idleAt = performance.now(); }
    /* ★2026-11-12 オーナー「くるくる回ると見づらい・主基地を中心に止めておく」：主基地（いちばん多く出た空港）を正面に、
         行き先が全部入る大きさで止める（主基地から一番遠い行き先までの角度で寄り具合を決める） */
    function home(now) {
      var hp = ports.filter(function (p) { return p.g.iata === hub; })[0];
      if (!hp) { center(now); return; }
      var far = 0;
      ports.forEach(function (p) { var dt2 = hp.v[0] * p.v[0] + hp.v[1] * p.v[1] + hp.v[2] * p.v[2]; far = Math.max(far, Math.acos(Math.max(-1, Math.min(1, dt2)))); });
      var r0 = geom().R / k;
      var kT = far >= 1.2 || far <= 0 ? 1 : Math.max(1, Math.min(40, (Math.min(W, H) * 0.42) / (r0 * Math.sin(far))));
      var tl = Math.atan2(hp.v[0], hp.v[2]), tp = Math.asin(Math.max(-1, Math.min(1, hp.v[1])));
      var pT = kT > 1.5 ? tp : tp * 0.8 + 0.12;
      if (now || RM) { lam = tl; phi = pT; k = kT; draw(); return; }
      var dl = tl - lam; while (dl > Math.PI) dl -= 2 * Math.PI; while (dl < -Math.PI) dl += 2 * Math.PI;
      tween = { t0: performance.now(), l0: lam, p0: phi, dl: dl, dp: pT - phi, k0: k, dk: kT - k, dur: 1000 };
      kick();
    }
    var KMAX = 200;  // 県くらいまで見えるように（オーナー「もっと拡大。県くらいまで見えるレベルで」＝ 画面の幅が 100〜150km）
    function zoomBy(f) { tween = null; k = Math.max(0.7, Math.min(KMAX, k * f)); idleAt = performance.now(); kick(); draw(); }

    /* ── 0.25° より細かく寄ったとき：陸の縁（pv-globe-coast.js）を読み、緯度の行ごとに「縁と交わる経度」を並べて、画面の上で点を作る ──
       行ごとの交わりは覚えておく（同じ行は2回数えない）。縁は 0.5° 幅の帯ごとに引けるようにしておく */
    var coastState = 0, coast = null, coastRowN = 0;   // 0 まだ・1 読んでいる・2 読めた・3 読めない
    function loadCoast() {
      if (coastState || !S.ctx || !S.ctx.urls || !S.ctx.urls.coast) return;
      coastState = 1;
      var el = d.createElement('script');
      el.src = S.ctx.urls.coast;
      el.onload = function () { coastState = w.PV_GLOBE_COAST ? 2 : 3; draw(); };
      el.onerror = function () { coastState = 3; };
      d.head.appendChild(el);
    }
    function coastReady() {
      if (coast) return true;
      if (!w.PV_GLOBE_COAST) return false;
      var str = w.atob(w.PV_GLOBE_COAST), n = str.length, i = 0, E = [], bands = {};
      var rd = function () { var v = 0, m = 1, ch; do { ch = str.charCodeAt(i++); v += (ch & 127) * m; m *= 128; } while (ch & 128); return v % 2 ? -(v + 1) / 2 : v / 2; };
      while (i < n) {
        var cnt = rd(), px = 0, py = 0, xs = [], ys = [];
        for (var q = 0; q < cnt; q++) { px += rd(); py += rd(); xs.push(px / 100); ys.push(py / 100); }
        for (var a = 0, b = cnt - 1; a < cnt; b = a++) {
          var y1 = ys[b], y2 = ys[a], x1 = xs[b], x2 = xs[a];
          if (y1 === y2) continue;
          if (y1 > y2) { var tt = y1; y1 = y2; y2 = tt; tt = x1; x1 = x2; x2 = tt; }
          var id = E.length / 4; E.push(y1, y2, x1, x2);
          for (var bb = Math.floor(y1 * 2); bb <= Math.floor(y2 * 2); bb++) (bands[bb] || (bands[bb] = [])).push(id);
        }
      }
      coast = { E: new Float64Array(E), bands: bands, rows: {} };
      return true;
    }
    function coastRow(lat) {
      var key = lat.toFixed(6), hit = coast.rows[key];
      if (hit) return hit;
      var ids = coast.bands[Math.floor(lat * 2)] || [], E = coast.E, xs = [];
      for (var q = 0; q < ids.length; q++) { var o = ids[q] * 4; if (E[o] <= lat && E[o + 1] > lat) xs.push(E[o + 2] + (lat - E[o]) / (E[o + 1] - E[o]) * (E[o + 3] - E[o + 2])); }
      xs.sort(function (p, r) { return p - r; });
      if (++coastRowN > 6000) { coast.rows = {}; coastRowN = 0; }
      return (coast.rows[key] = xs);
    }
    function onLand(xs, lon) { var lo = 0, hi = xs.length; while (lo < hi) { var mid = (lo + hi) >> 1; if (xs[mid] < lon) lo = mid + 1; else hi = mid; } return lo % 2 === 1; }
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
        if (tween.dk) k = tween.k0 * Math.pow((tween.k0 + tween.dk) / tween.k0, e);   // 寄るのは倍率で（等速に見える）
        if (p >= 1) tween = null;
      } else if (!drag && !pinch) {
        if (Math.abs(vlam) > 1e-5 || Math.abs(vphi) > 1e-5) { lam += vlam * dt; phi = clampP(phi + vphi * dt); vlam *= 0.92; vphi *= 0.92; }
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
      /* 外の光（大気）：縁のすぐ外で光る。見本と同じく左上ほど強い */
      var halo = c.createRadialGradient(cx + R * 0.08, cy + R * 0.06, R * 0.95, cx, cy, R * 1.24);
      halo.addColorStop(0, 'rgba(120,230,208,.34)'); halo.addColorStop(0.45, 'rgba(90,200,182,.12)'); halo.addColorStop(1, 'rgba(90,200,182,0)');
      /* 大気は球の外側の輪だけ（球の中は下で別に・寄るほど薄く）。★輪の内側まで塗ると、寄ったとき球の中が白っぽく濁る（オーナー「色が薄くなる」） */
      var zf = Math.min(1, Math.max(0, (k - 1) / 3));
      c.fillStyle = halo; c.beginPath(); c.arc(cx, cy, R * 1.24, 0, Math.PI * 2); c.arc(cx, cy, R, 0, Math.PI * 2, true); c.fill('evenodd');
      c.fillStyle = 'rgba(120,230,208,' + (0.34 * (1 - zf)).toFixed(3) + ')'; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
      /* 球：中は暗い青緑（見本 #0e5253）。白で濁らせない */
      /* ★寄ったとき（オーナー「色が薄くなる」）：明るい所は球の左上の一部だけ。寄るほど明るさを抑えて、遠目と同じ濃さに */
      var lightA = (0.62 * (1 - 0.7 * zf)).toFixed(3);
      var body = c.createRadialGradient(cx - R * 0.28, cy - R * 0.36, R * 0.08, cx, cy, R);
      body.addColorStop(0, 'rgba(52,150,138,' + lightA + ')'); body.addColorStop(0.55, 'rgba(18,86,84,' + (0.6 + 0.32 * zf).toFixed(3) + ')'); body.addColorStop(1, 'rgba(6,50,52,' + (0.72 + 0.2 * zf).toFixed(3) + ')');
      /* 寄ると球が画面を覆う＝面の光（CSS）が透けて薄く見える。寄るほど、球の中を見本の濃い青緑（#0e5253）で埋める */
      c.fillStyle = body; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
      /* 縁の内側の光：右下から左上へ、縁に近いほど明るい（見本の左上の光る縁） */
      var lit = c.createRadialGradient(cx + R * 0.22, cy + R * 0.18, R * 0.55, cx, cy, R * 1.02);
      lit.addColorStop(0, 'rgba(110,220,200,0)'); lit.addColorStop(0.75, 'rgba(110,220,200,.10)'); lit.addColorStop(1, 'rgba(150,240,220,.42)');
      c.fillStyle = lit; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
      /* 陸の点：丸い点を同じ間隔で（見本と同じ）。縁へ行くほど少し小さく・薄く。
         ★拡大するほど細かい段（2°→1°→0.5°→0.25°）に替えて、点の間隔が画面でいつも 6〜12px になるように（オーナー「拡大したら点も細かく」）。
         見えている所（正面のまわり）の行と列だけを見る＝細かい段でも重くならない */
      var LV = w.PV_GLOBE_LAND.levels, lvl = 0;
      while (lvl < LV.length - 1 && R * LV[lvl] * Math.PI / 180 > 11) lvl++;
      var cstep = 0;
      if (R * LV[lvl] * Math.PI / 180 > 11) {                     // 点の表のいちばん細かい段でもまだ粗い＝陸の縁から作る
        if (coastReady()) { cstep = LV[lvl]; while (R * cstep * Math.PI / 180 > 11) cstep /= 2; } else loadCoast();
      }
      var LD = cstep ? null : w.PV_GLOBE_LAND(lvl), stepR = (cstep || LD.step) * Math.PI / 180;
      var rad = Math.max(0.8, R * stepR * 0.17), buckets = [[], [], [], []];
      var cl = Math.cos(lam), sl = Math.sin(lam), cp = Math.cos(phi), sp = Math.sin(phi);
      var dMax = Math.max(Math.hypot(cx, cy), Math.hypot(W - cx, cy), Math.hypot(cx, H - cy), Math.hypot(W - cx, H - cy));
      var ang = dMax >= R ? Math.PI / 2 + 0.05 : Math.asin(dMax / R) + 0.03;
      var pole = Math.abs(phi) + ang >= Math.PI / 2 - 0.02;
      if (cstep) {
        var latC = phi * 180 / Math.PI, angD = ang * 180 / Math.PI, nRows = Math.round(180 / cstep);
        var j0 = Math.max(0, Math.floor((latC - angD + 90) / cstep)), j1 = Math.min(nRows - 1, Math.ceil((latC + angD + 90) / cstep));
        for (var jj = j0; jj <= j1; jj++) {
          var latD = -90 + cstep * (jj + 0.5), la2 = latD * Math.PI / 180, cla2 = Math.cos(la2), y02 = Math.sin(la2);
          var nn2 = Math.max(1, Math.round((360 / cstep) * cla2)), xsr = coastRow(latD);
          if (!xsr.length) continue;
          var dl2 = pole || cla2 < 0.02 ? Math.PI : Math.min(Math.PI, ang / cla2 * 1.15 + 0.02);
          var k0 = 0, k1 = nn2 - 1;
          if (dl2 < Math.PI) { k0 = Math.floor((lam - dl2 + Math.PI) / (2 * Math.PI) * nn2); k1 = Math.floor((lam + dl2 + Math.PI) / (2 * Math.PI) * nn2); }
          for (var kk = k0; kk <= k1; kk++) {
            var cj = ((kk % nn2) + nn2) % nn2, lonD = -180 + 360 * (cj + 0.5) / nn2;
            if (!onLand(xsr, lonD)) continue;
            var lo2 = lonD * Math.PI / 180, xa = cla2 * Math.sin(lo2), za = cla2 * Math.cos(lo2);
            var xb = xa * cl - za * sl, zb = xa * sl + za * cl, yb = y02 * cp - zb * sp, zc = y02 * sp + zb * cp;
            if (zc <= 0.02) continue;
            var qx = cx + R * xb, qy = cy - R * yb;
            if (qx < -8 || qx > W + 8 || qy < -8 || qy > H + 8) continue;
            buckets[Math.min(3, Math.floor(zc * 4))].push(qx, qy, zc);
          }
        }
      }
      for (var ri = 0; !cstep && ri < LD.rows.length; ri++) {
        var row = LD.rows[ri], la = row.lat * Math.PI / 180;
        if (Math.abs(la - phi) > ang) continue;
        var cla = Math.cos(la), y0 = Math.sin(la), nn = row.n, bits = row.bits;
        var dl = pole || cla < 0.02 ? Math.PI : Math.min(Math.PI, ang / cla * 1.15 + 0.02);
        var i0 = 0, i1 = nn - 1;
        if (dl < Math.PI) { i0 = Math.floor((lam - dl + Math.PI) / (2 * Math.PI) * nn); i1 = Math.floor((lam + dl + Math.PI) / (2 * Math.PI) * nn); }
        for (var ii = i0; ii <= i1; ii++) {
          var ci = ((ii % nn) + nn) % nn;
          if (!(bits[ci >> 3] & (1 << (ci & 7)))) continue;
          var lo = -Math.PI + 2 * Math.PI * (ci + 0.5) / nn;
          var x0 = cla * Math.sin(lo), z0 = cla * Math.cos(lo);
          var x1 = x0 * cl - z0 * sl, z1 = x0 * sl + z0 * cl, y2 = y0 * cp - z1 * sp, z2 = y0 * sp + z1 * cp;
          if (z2 <= 0.02) continue;
          var px = cx + R * x1, py = cy - R * y2;
          if (px < -8 || px > W + 8 || py < -8 || py > H + 8) continue;
          buckets[Math.min(3, Math.floor(z2 * 4))].push(px, py, z2);
        }
      }
      /* ★寄ったとき（オーナー「地球の丸みが分からない」）：画面の真ん中から離れるほど、点を小さく・暗く（丸い面が向こうへ逃げていくように） */
      var cf = Math.min(1, Math.max(0, (k - 1.6) / 2.5)), vmax = Math.hypot(W, H) * 0.55;
      if (cf > 0) {
        var nb = [[], [], [], []];
        for (var b2 = 0; b2 < 4; b2++) for (var q2 = 0; q2 < buckets[b2].length; q2 += 3) {
          var dd = Math.min(1, Math.hypot(buckets[b2][q2] - cx, buckets[b2][q2 + 1] - cy) / vmax), zz = buckets[b2][q2 + 2] * (1 - cf * 0.62 * dd * dd);
          nb[Math.max(0, Math.min(3, Math.floor(zz * 4)))].push(buckets[b2][q2], buckets[b2][q2 + 1], zz);
        }
        buckets = nb;
      }
      for (var bI = 0; bI < 4; bI++) {
        var B = buckets[bI];
        c.fillStyle = 'rgba(236,255,250,' + [0.4, 0.68, 0.88, 1][bI] + ')';
        c.beginPath();
        for (var j = 0; j < B.length; j += 3) { var s = rad * (0.62 + 0.38 * B[j + 2]); c.moveTo(B[j] + s, B[j + 1]); c.arc(B[j], B[j + 1], s, 0, Math.PI * 2); }
        c.fill();
      }
      if (cf > 0) {
        var vg = c.createRadialGradient(cx, cy, Math.min(W, H) * 0.28, cx, cy, vmax * 1.05);
        vg.addColorStop(0, 'rgba(4,34,38,0)'); vg.addColorStop(1, 'rgba(4,30,34,' + (0.62 * cf).toFixed(3) + ')');
        c.fillStyle = vg; c.fillRect(0, 0, W, H);
      }
      /* 縁：細い明るい線に光をにじませる（ガラスの縁） */
      c.save(); c.shadowColor = 'rgba(140,245,220,.9)'; c.shadowBlur = 14;
      c.lineWidth = 1.4; c.strokeStyle = 'rgba(205,255,242,.72)'; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke(); c.restore();

      /* 弧：裏側（球に隠れる所）は描かない。選んだルートは最後に金色で */
      var t = now / 1000, sel = null;
      arcs.forEach(function (a) {
        a.scr = [];
        var vis = [];
        a.pts.forEach(function (v) {
          var p = rot(v, [0, 0, 0]), r2 = p[0] * p[0] + p[1] * p[1];
          var shown = p[2] > 0 || (r2 > 1.0005 && p[2] > -0.22);   // 裏へ回った弧は、縁から少し浮いた所までだけ（縁に沿って長く伸びない）
          vis.push(shown ? [cx + R * p[0], cy - R * p[1]] : null);
        });
        a.scr = vis;
        if (a.k === selRoute) { sel = a; return; }
        stroke(a, 'rgba(255,255,255,' + (a.dh ? '.38' : '.55') + ')', a.n >= 6 ? 1.35 : 1.05, a.dh);
      });
      if (sel) {
        c.save(); c.shadowColor = 'rgba(245,190,80,.85)'; c.shadowBlur = 14;
        var g0 = sel.scr.filter(Boolean), gr = g0.length > 1 ? c.createLinearGradient(g0[0][0], g0[0][1], g0[g0.length - 1][0], g0[g0.length - 1][1]) : null;
        if (gr) { gr.addColorStop(0, '#fff3cf'); gr.addColorStop(1, '#f2b84b'); }
        stroke(sel, gr || '#f2b84b', 2.6, false); c.restore();
      }
      function stroke(a, col, lw, dash) {
        c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.setLineDash(dash ? [2.5, 4] : []);
        c.beginPath(); var on = false;
        a.scr.forEach(function (p) { if (!p) { on = false; return; } if (on) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); on = true; });
        c.stroke(); c.setLineDash([]);
      }
      /* ★飛行機は選んだルートだけ（オーナー「ルートを選んだら飛ぶように」）。選んだ便の出発地から目的地へ、着いたら少し止まってもう一度。
           動きを減らす設定では止めて、弧の真ん中に置く */
      if (sel) {
        var fwd = !selLeg || !selLeg.ga || selLeg.ga.iata === sel.a;
        var dur = 2.6 + Math.min(3, sel.om * 2.2), cyc = (t - selT0) % (dur + 0.9), u = RM ? 0.5 : Math.min(1, cyc / dur);
        u = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;                 // 出るときと着くときはゆっくり
        var pos = at(sel, fwd ? u : 1 - u);
        if (pos) { if (!fwd) pos.ang += Math.PI; plane(pos, '#f5c35a', 1.1); sel.planeAt = pos; }
      }
      /* 空港：拠点は白い点・行き先は白い輪。名前は重なるものを省く（拠点と選んだルートが先） */
      var FONT = '"Outfit", "Zen Kaku Gothic New", "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif';
      c.font = '500 10.5px ' + FONT; c.textBaseline = 'middle';
      var placed = [], list = [];
      ports.forEach(function (p) {
        var q = rot(p.v, [0, 0, 0]);
        if (q[2] <= 0.03) return;
        var onSel = !!(selRoute && selRoute.split('|').indexOf(p.g.iata) >= 0), isHub = p.g.iata === hub;
        list.push({ p: p, x: cx + R * q[0], y: cy - R * q[1], hub: isHub, sel: onSel, pr: isHub ? 0 : onSel ? 1 : 2 });
      });
      list.sort(function (a, b) { return a.pr - b.pr; });
      list.forEach(function (o) {
        c.lineWidth = 1.3;
        if (o.hub) {
          c.save(); c.shadowColor = 'rgba(255,255,255,.8)'; c.shadowBlur = 8;
          c.fillStyle = '#ffffff'; c.beginPath(); c.arc(o.x, o.y, 3.8, 0, Math.PI * 2); c.fill(); c.restore();
        } else {
          c.strokeStyle = o.sel ? '#f5c35a' : 'rgba(255,255,255,.85)'; c.fillStyle = 'rgba(14,74,68,.9)';
          c.beginPath(); c.arc(o.x, o.y, 3.1, 0, Math.PI * 2); c.fill(); c.stroke();
        }
        var tw = c.measureText(o.p.g.iata).width, box = [o.x + 7, o.y - 7, o.x + 9 + tw, o.y + 7];
        if (o.pr === 2 && placed.some(function (b) { return box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]; })) return;
        placed.push(box);
        c.fillStyle = o.sel ? '#ffe7b0' : o.hub ? '#ffffff' : 'rgba(255,255,255,.78)';
        c.font = (o.hub || o.sel ? '600 ' : '500 ') + '10.5px ' + FONT;
        c.fillText(o.p.g.iata, o.x + 7, o.y + 0.5);
      });
      /* 選んだ便の札（額。出ない便は区間） */
      if (sel && sel.planeAt && selLeg) {
        var label = selLeg.amount != null ? money(selLeg.amount, selLeg.currency) : selLeg.ga.iata + '–' + selLeg.gb.iata;
        c.font = '600 11px ' + FONT;
        var tw = c.measureText(label).width + 18, px = sel.planeAt.x - tw / 2, py = sel.planeAt.y - 30;
        c.save(); c.shadowColor = 'rgba(0,30,26,.28)'; c.shadowBlur = 10; c.shadowOffsetY = 3;
        c.fillStyle = 'rgba(255,255,255,.96)'; rr(px, py, tw, 20, 10); c.fill();
        c.beginPath(); c.moveTo(sel.planeAt.x - 4, py + 20); c.lineTo(sel.planeAt.x + 4, py + 20); c.lineTo(sel.planeAt.x, py + 24); c.closePath(); c.fill(); c.restore();
        c.fillStyle = '#0b3d36'; c.textAlign = 'center'; c.fillText(label, sel.planeAt.x, py + 10.5); c.textAlign = 'left';
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
        k = Math.max(0.7, Math.min(KMAX, pinch.k * dd / (pinch.d || 1))); draw(); return;
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
      tween = null; k = Math.max(0.7, Math.min(KMAX, k * Math.exp(-e.deltaY * 0.01))); idleAt = performance.now(); draw();
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
    return { init: init, setData: setData, focusRoute: focusRoute, home: home, zoomBy: zoomBy, kick: kick, draw: draw };
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
