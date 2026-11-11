/* my-year.js — マイレポート（MY PAGE の ③ YOUR PAY）の「1年」の画面
   ★2026-11-08 オーナー「1年分のまとめいいね」「乗務時間のグラフとか色々細かく」「カーソルで細かい数字」
     「深夜・変動の時給、分給、宿泊数も」「何時間を超えたら支給額が増えるルールも読み解けない？」。
     置き場所はオーナー決定：YOUR PAY の上の「今月｜1年」の切り替え（my-value.js が描く）。

   読み込みは my-value.js が「1年」を押したときだけ（会員の大多数は通信が増えない）。

   守っていること
   ・数字はすべて本人が出した行の計算だけ。推測で埋めない。書いていない項目は 0 で埋めず、
     そのカード・行・グラフごと出さない。
   ・単価は「同じ月に額と数量の両方がある月」だけで数える（Σ額 ÷ Σ数量）。
   ・「1時間多く飛ぶと」は4か月以上・相関がはっきりしているときだけ。
   ・「単価が変わる点」は折れ目の両側に3か月以上・直線より誤差が半分以下のときだけ。
     ルールとは言わない（記録から見える折れ目）。
   ・金額は各月のレートで円に直してから足す（累計と同じ）。画面の通貨は PVCurrency（fmt）。
   ・対象は最新の会社の月だけ（会社をまたぐと契約が違う。月ごとの推移と同じ）。
   ・色：乗務 #0a8f79／総勤務 #3d9bff（ライトは validate_palette.js で確認）。支給の色は円グラフと同じ（pay-viz.js の segments）。

   window.PVYear = { calc(rows, year) → 数字の模型（画面を持たない・検査が直接呼ぶ）,
                     years(rows), render(box, rows, o) } */
(function (w) {
  'use strict';
  var d = w.document;
  var V = w.PVViz;
  if (!V) return;
  var esc = V.esc, num = V.num, fmt = V.fmt;
  var L = (w.PV_BASE === 'en' || d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var T = {
    ja: {
      title: '1年のまとめ',
      pdf: 'PDF を保存',
      yr: function (y) { return y + '年'; },
      mo: function (m) { return m + '月'; },
      tGross: '総支給の合計', tBlock: '乗務時間の合計', tDays: '勤務日数の合計', tNet: '手取りの合計',
      tGrossB: '総支給の合計（ボーナス込み）', kBonus: 'ボーナス', kProfit: 'プロフィットシェア',
      tYearly: function (k) { return k + '（年）'; },
      insH: 'あなたの記録からわかること',
      iSlopeK: '1時間多く飛ぶと',
      iSlopeP: function (n) { return n + 'か月の乗務時間と総支給から'; },
      iFlyK: '拘束のうち飛んでいる時間',
      iFlyP: function (dh, bh, perDay) { return '総勤務 ' + dh + 'h のうち乗務 ' + bh + 'h' + (perDay ? '・勤務1日あたり ' + perDay + 'h' : ''); },
      iVarK: '月ごとに動く分',
      iVarP: function (lo, hi) { return '変動給とパーディアム' + (lo ? '・月の総支給 ' + lo + '〜' + hi : ''); },
      iGuarK: '保証を超えた月',
      iGuarP: function (g, extra) { return '保証 ' + g + 'h を超えた時間の合計 +' + extra + 'h'; },
      ofMonths: 'か月',
      kinkH: '単価が変わる点',
      kinkK: '変動給が増え始める乗務時間',
      kinkBig: function (t) { return '約 ' + t + 'h から'; },
      kinkBelow: function (t) { return t + 'h まで'; },
      kinkAbove: function (t) { return t + 'h を超えた分'; },
      kinkPer: function (v) { return '1時間 ' + v; },
      kinkSame: function (g) { return '保証 ' + g + 'h と同じ位置'; },
      kinkFrom: function (n, a, b) { return n + 'か月の記録から（超えた月 ' + a + '・超えない月 ' + b + '）'; },
      kinkAxis: '変動給（月）',
      /* 会社の会員の数字（2人以上の組だけ・人数は出さない・db/company-rates.sql） */
      coKinkH: 'この会社の会員の記録では',
      ratesH: '時給・分給と単価',
      /* 会社の会員との差は文で言う（2026-11-09 オーナー「会社の会員がわからない」）。[前, 強める部分, 後] */
      rk: { cap: '機長', fo: '副操縦士' },
      coUp: function (r, m, p) { return ['同じ会社の' + r + 'の中央値 ' + m + ' より ', p + '% 高い', '']; },
      coDn: function (r, m, p) { return ['同じ会社の' + r + 'の中央値 ' + m + ' より ', p + '% 低い', '']; },
      coEq: function (r, m) { return ['同じ会社の' + r + 'の中央値 ' + m + ' とほぼ同じ', '', '']; },
      qHrs: { bh: '時間', dh: '時間', night: '時間' },
      rlYear: function (q, a) { return '1年で ' + q + '・' + a; },
      noRate: function (s) { return '単価が出ない手当（1年）：' + s; },
      rBlock: '乗務1時間あたり', rDuty: '総勤務1時間あたり', rPayExPd: '総支給（パーディアムを除く）',
      b: { block: '乗務時間の変動給', duty: '勤務時間の変動給', night: '深夜手当', sector: '便数・着陸の手当',
           overtime: '時間外・追加勤務', reserve: '待機・スタンバイ', weekend: '週末・日曜勤務', holiday: '祝日勤務',
           other: 'その他の変動給', unknown: '種類の分からない変動給' },
      bSub: { block: '乗務1時間あたり', duty: '総勤務1時間あたり', night: '夜間の乗務1時間あたり', sector: '1回あたり' },
      perDiem: 'パーディアム', perDiemSub: '1泊あたり',
      uH: '/時', uMin: '/分', uSector: '/回', uNight: '/泊',
      qH: 'h', qSector: '回', qNight: '泊', qDay: '日',
      chHours: '乗務時間と総勤務時間', lgBlock: '乗務', lgDuty: '総勤務', lgGuar: function (g) { return '保証 ' + g + 'h'; },
      chPay: '総支給の内訳',
      smSectors: 'セクター数', smOff: '休日', smStay: 'ステイ', smNight: '夜間の乗務',
      smAvg: '月平均',
      smPerSector: function (h) { return '1回あたり乗務 ' + h + 'h'; },
      smStayShare: function (p) { return '勤務日のうち泊まり ' + p + '%'; },
      smNightShare: function (p) { return '乗務のうち ' + p + '%'; },
      tableH: '月ごとの表',
      tMonth: '月', tGrossC: '総支給', tNetC: '手取り', tBlockC: '乗務', tDutyC: '総勤務', tDaysC: '勤務日', tStayC: 'ステイ',
      tipGuar: '保証との差', tipDays: '勤務日数', tipGross: '総支給'
    },
    en: {
      title: 'Your year',
      pdf: 'Save as PDF',
      yr: function (y) { return String(y); },
      mo: function (m) { return MON[m - 1]; },
      tGross: 'Total gross pay', tBlock: 'Total block hours', tDays: 'Total duty days', tNet: 'Total net pay',
      tGrossB: 'Total gross pay incl. bonus', kBonus: 'Bonus', kProfit: 'Profit share',
      tYearly: function (k) { return k + ' (yearly)'; },
      insH: 'What your records show',
      iSlopeK: 'One more block hour adds',
      iSlopeP: function (n) { return 'From ' + n + ' months of block hours and gross pay'; },
      iFlyK: 'Share of duty time spent flying',
      iFlyP: function (dh, bh, perDay) { return bh + 'h block out of ' + dh + 'h duty' + (perDay ? ' · ' + perDay + 'h block per duty day' : ''); },
      iVarK: 'Pay that moves month to month',
      iVarP: function (lo, hi) { return 'Variable pay and per diem' + (lo ? ' · monthly gross ' + lo + '–' + hi : ''); },
      iGuarK: 'Months above guarantee',
      iGuarP: function (g, extra) { return '+' + extra + 'h above the ' + g + 'h guarantee in total'; },
      ofMonths: 'months',
      kinkH: 'Where your rate changes',
      kinkK: 'Block hours where variable pay starts rising faster',
      kinkBig: function (t) { return 'From about ' + t + 'h'; },
      kinkBelow: function (t) { return 'Up to ' + t + 'h'; },
      kinkAbove: function (t) { return 'Above ' + t + 'h'; },
      kinkPer: function (v) { return v + ' per hour'; },
      kinkSame: function (g) { return 'Same point as your ' + g + 'h guarantee'; },
      kinkFrom: function (n, a, b) { return 'From ' + n + ' months of records (' + a + ' above, ' + b + ' below)'; },
      kinkAxis: 'Variable pay (month)',
      coKinkH: 'Across members at your airline',
      ratesH: 'Hourly, per-minute and unit rates',
      rk: { cap: 'Captains', fo: 'First Officers' },
      coUp: function (r, m, p) { return ['', p + '% above', ' the median for ' + r + ' at your airline (' + m + ')']; },
      coDn: function (r, m, p) { return ['', p + '% below', ' the median for ' + r + ' at your airline (' + m + ')']; },
      coEq: function (r, m) { return ['About the same as the median for ' + r + ' at your airline (' + m + ')', '', '']; },
      qHrs: { bh: ' block hours', dh: ' duty hours', night: ' night hours' },
      rlYear: function (q, a) { return q + ' · ' + a + ' in the year'; },
      noRate: function (s) { return 'Pay without a rate (year): ' + s; },
      rBlock: 'Per block hour', rDuty: 'Per duty hour', rPayExPd: 'Gross pay, excluding per diem',
      b: { block: 'Variable pay on block hours', duty: 'Variable pay on duty hours', night: 'Night premium', sector: 'Sector / landing pay',
           overtime: 'Overtime / extra duty', reserve: 'Reserve / standby', weekend: 'Weekend / Sunday premium', holiday: 'Public holiday premium',
           other: 'Other variable pay', unknown: 'Variable pay, type not given' },
      bSub: { block: 'Per block hour', duty: 'Per duty hour', night: 'Per night block hour', sector: 'Per sector' },
      perDiem: 'Per diem', perDiemSub: 'Per layover night',
      uH: '/h', uMin: '/min', uSector: '/sector', uNight: '/night',
      qH: 'h', qSector: ' sectors', qNight: ' nights', qDay: ' days',
      chHours: 'Block and duty hours', lgBlock: 'Block', lgDuty: 'Duty', lgGuar: function (g) { return g + 'h guarantee'; },
      chPay: 'Gross pay breakdown',
      smSectors: 'Sectors', smOff: 'Days off', smStay: 'Layovers', smNight: 'Night flying',
      smAvg: 'Monthly average',
      smPerSector: function (h) { return h + 'h block per sector'; },
      smStayShare: function (p) { return p + '% of duty days away overnight'; },
      smNightShare: function (p) { return p + '% of block hours'; },
      tableH: 'Month by month',
      tMonth: 'Month', tGrossC: 'Gross', tNetC: 'Net', tBlockC: 'Block', tDutyC: 'Duty', tDaysC: 'Duty days', tStayC: 'Layovers',
      tipGuar: 'vs guarantee', tipDays: 'Duty days', tipGross: 'Gross pay'
    }, /*PV-MSG:es*/ es: {
      title: 'Tu año',
      pdf: 'Guardar como PDF',
      yr: function (y) { return String(y); },
      mo: function (m) { return MON[m - 1]; },
      tGross: 'Sueldo bruto total', tBlock: 'Horas block totales', tDays: 'Días de servicio totales', tNet: 'Sueldo neto total',
      tGrossB: 'Sueldo bruto total con bono', kBonus: 'Bono', kProfit: 'Participación en las utilidades',
      tYearly: function (k) { return k + ' (anual)'; },
      insH: 'Lo que muestran tus registros',
      iSlopeK: 'Una hora block más suma',
      iSlopeP: function (n) { return 'A partir de ' + n + ' meses de horas block y sueldo bruto'; },
      iFlyK: 'Parte del tiempo de servicio en vuelo',
      iFlyP: function (dh, bh, perDay) { return bh + ' h block de ' + dh + ' h de servicio' + (perDay ? ' · ' + perDay + ' h block por día de servicio' : ''); },
      iVarK: 'Remuneración que varía de mes a mes',
      iVarP: function (lo, hi) { return 'Pago variable y viáticos' + (lo ? ' · sueldo bruto mensual ' + lo + '–' + hi : ''); },
      iGuarK: 'Meses por encima de la garantía',
      iGuarP: function (g, extra) { return '+' + extra + ' h por encima de la garantía de ' + g + ' h en total'; },
      ofMonths: 'meses',
      kinkH: 'Dónde cambia tu tarifa',
      kinkK: 'Horas block a partir de las que el pago variable sube más rápido',
      kinkBig: function (t) { return 'Desde unas ' + t + ' h'; },
      kinkBelow: function (t) { return 'Hasta ' + t + ' h'; },
      kinkAbove: function (t) { return 'Por encima de ' + t + ' h'; },
      kinkPer: function (v) { return v + ' por hora'; },
      kinkSame: function (g) { return 'El mismo punto que tu garantía de ' + g + ' h'; },
      kinkFrom: function (n, a, b) { return 'A partir de ' + n + ' meses de registros (' + a + ' por encima, ' + b + ' por debajo)'; },
      kinkAxis: 'Pago variable (mes)',
      coKinkH: 'Entre los miembros de tu aerolínea',
      ratesH: 'Tarifas por hora, por minuto y por unidad',
      rk: { cap: 'comandantes', fo: 'primeros oficiales' },
      coUp: function (r, m, p) { return ['', p + '% por encima', ' de la mediana de los ' + r + ' de tu aerolínea (' + m + ')']; },
      coDn: function (r, m, p) { return ['', p + '% por debajo', ' de la mediana de los ' + r + ' de tu aerolínea (' + m + ')']; },
      coEq: function (r, m) { return ['Casi igual a la mediana de los ' + r + ' de tu aerolínea (' + m + ')', '', '']; },
      qHrs: { bh: ' horas block', dh: ' horas de servicio', night: ' horas nocturnas' },
      rlYear: function (q, a) { return q + ' · ' + a + ' en el año'; },
      noRate: function (s) { return 'Pagos sin tarifa (año): ' + s; },
      rBlock: 'Por hora block', rDuty: 'Por hora de servicio', rPayExPd: 'Sueldo bruto, sin viáticos',
      b: { block: 'Pago variable por horas block', duty: 'Pago variable por horas de servicio', night: 'Prima nocturna', sector: 'Pago por sector / aterrizaje', overtime: 'Horas extra / servicio adicional', reserve: 'Reserva / guardia', weekend: 'Prima de fin de semana / domingo', holiday: 'Prima de día feriado',
           other: 'Otro pago variable', unknown: 'Pago variable sin tipo indicado' },
      bSub: { block: 'Por hora block', duty: 'Por hora de servicio', night: 'Por hora block nocturna', sector: 'Por sector' },
      perDiem: 'Viáticos', perDiemSub: 'Por noche de pernocta',
      uH: '/h', uMin: '/min', uSector: '/sector', uNight: '/noche',
      qH: 'h', qSector: ' sectores', qNight: ' noches', qDay: ' días',
      chHours: 'Horas block y de servicio', lgBlock: 'Horas block', lgDuty: 'Servicio', lgGuar: function (g) { return g + ' h de garantía'; },
      chPay: 'Desglose del sueldo bruto',
      smSectors: 'Sectores', smOff: 'Días libres', smStay: 'Pernoctas', smNight: 'Vuelo nocturno',
      smAvg: 'Promedio mensual',
      smPerSector: function (h) { return h + ' h block por sector'; },
      smStayShare: function (p) { return p + '% de los días de servicio con pernocta'; },
      smNightShare: function (p) { return p + '% de las horas block'; },
      tableH: 'Mes a mes',
      tMonth: 'Mes', tGrossC: 'Bruto', tNetC: 'Neto', tBlockC: 'Horas block', tDutyC: 'Servicio', tDaysC: 'Días de servicio', tStayC: 'Pernoctas',
      tipGuar: 'vs garantía', tipDays: 'Días de servicio', tipGross: 'Sueldo bruto'
    } /*/PV-MSG:es*/
  };
  T = (w.PV_T && w.PV_T(T, L)) || T[L];

  /* ══ 計算（画面を持たない） ══════════════════════════════════════ */
  var BASIS_Q = { block: 'bh', duty: 'dh', night: 'night', sector: 'sectors' };   // 単価にできる種類と、その数量
  var BASIS_ORDER = ['block', 'duty', 'night', 'sector', 'overtime', 'reserve', 'weekend', 'holiday', 'other', 'unknown'];
  var PER_HOUR = { bh: true, dh: true, night: true };

  function years(rows) {
    var seen = {};
    (rows || []).forEach(function (r) { var y = num(r.period_year); if (y) seen[y] = 1; });
    return Object.keys(seen).map(Number).sort(function (a, b) { return b - a; });
  }

  function sum(a) { return a.reduce(function (s, v) { return s + v; }, 0); }

  /* 最小二乗の傾きと相関（x, y の組） */
  function fitLine(P) {
    var n = P.length, mx = sum(P.map(function (p) { return p.x; })) / n, my = sum(P.map(function (p) { return p.y; })) / n;
    var sxy = 0, sxx = 0, syy = 0;
    P.forEach(function (p) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) * (p.x - mx); syy += (p.y - my) * (p.y - my); });
    var b = sxx > 0 ? sxy / sxx : 0, a = my - b * mx, e = 0;
    P.forEach(function (p) { e += Math.pow(p.y - a - b * p.x, 2); });
    return { a: a, b: b, e: e, r: (sxx > 0 && syy > 0) ? sxy / Math.sqrt(sxx * syy) : 0, sxx: sxx };
  }
  /* 折れ線：y = a + b1·x + b2·max(0, x − t)。正規方程式（3×3）を解く */
  function fitHinge(P, t) {
    var A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], B = [0, 0, 0];
    P.forEach(function (p) {
      var r = [1, p.x, Math.max(0, p.x - t)];
      for (var i = 0; i < 3; i++) { B[i] += r[i] * p.y; for (var j = 0; j < 3; j++) A[i][j] += r[i] * r[j]; }
    });
    for (var i = 0; i < 3; i++) {
      var piv = A[i][i];
      if (!(Math.abs(piv) > 1e-9)) return null;
      for (var j = i; j < 3; j++) A[i][j] /= piv;
      B[i] /= piv;
      for (var r2 = 0; r2 < 3; r2++) if (r2 !== i) {
        var f = A[r2][i];
        for (var c = i; c < 3; c++) A[r2][c] -= f * A[i][c];
        B[r2] -= f * B[i];
      }
    }
    var e = 0;
    P.forEach(function (p) { e += Math.pow(p.y - (B[0] + B[1] * p.x + B[2] * Math.max(0, p.x - t)), 2); });
    return { a: B[0], b1: B[1], b2: B[2], e: e, t: t };
  }

  /* 単価が変わる点。★出すのは両側3か月以上・直線より誤差が半分以下・超えた側の単価が上がるときだけ
     ⚠️ 会社の会員の折れ目（db/company-rates.sql の pv_company_kink_fit）に同じ条件の写しがある。片方だけ直さない
        （db/test-company-rates.mjs がこのファイルを読んで突き合わせる）。 */
  function findKink(P) {
    if (P.length < 6) return null;
    var lin = fitLine(P);
    if (!(lin.sxx > 0)) return null;
    var xs = P.map(function (p) { return p.x; });
    var lo = Math.floor(Math.min.apply(null, xs)), hi = Math.ceil(Math.max.apply(null, xs)), best = null;
    for (var t = lo; t <= hi; t += 0.5) {
      var nb = P.filter(function (p) { return p.x <= t; }).length, na = P.length - nb;
      if (nb < 3 || na < 3) continue;
      var h = fitHinge(P, t);
      if (h && (!best || h.e < best.e)) best = h;
    }
    if (!best) return null;
    var below = best.b1, above = best.b1 + best.b2;
    if (!(best.e <= lin.e * 0.5)) return null;                       // 直線で十分に説明できる＝折れ目とは言わない
    if (!(above > 0 && above > Math.max(0, below) * 1.2)) return null; // 超えた側で単価が上がっていない
    var nb2 = P.filter(function (p) { return p.x <= best.t; }).length;
    return { t: best.t, below: Math.max(0, below), above: above, n: P.length, nBelow: nb2, nAbove: P.length - nb2, fit: best };
  }

  function calc(rows, year) {
    var list = (rows || []).filter(function (r) { return num(r.period_year) === year; })
      .sort(function (a, b) { return num(a.period_month) - num(b.period_month); });
    var M = list.map(function (r) {
      var fx = num(r.fx_to_jpy), c = V.calc(r), g = V.grossOrig(r), n = num(r.net_pay_actual);
      var vbRaw = (r.variable_by_basis && typeof r.variable_by_basis === 'object') ? r.variable_by_basis : null, vb = null;
      if (vbRaw && fx) {
        vb = {};
        Object.keys(vbRaw).forEach(function (k) { var v = num(vbRaw[k]); if (v > 0) vb[k] = v * fx; });
      }
      var pos = function (v) { v = num(v); return v > 0 ? v : null; };
      return {
        r: r, m: num(r.period_month),
        gross: (g != null && fx) ? g * fx + V.unionOutsideJpy(r) + V.perdiemOutsideJpy(r) : null,
        net: (n != null && fx) ? n * fx : null,
        pd: (num(r.per_diem) > 0 && fx) ? num(r.per_diem) * fx : null,
        fv: (num(r.flight_variable_pay) > 0 && fx) ? num(r.flight_variable_pay) * fx : null,
        vb: vb, perBlock: c.hourlyBlock, perDuty: c.hourlyDuty,
        bh: pos(r.block_hours), dh: pos(r.duty_hours), night: pos(r.night_hours), sectors: pos(r.sectors),
        stay: num(r.stay_nights) != null ? num(r.stay_nights) : null,
        days: pos(r.duty_days), off: num(r.days_off) != null ? num(r.days_off) : null,
        guar: pos(r.guaranteed_hours),
        segs: V.segments(r)
      };
    });
    var all = function (k) { return M.length > 0 && M.every(function (x) { return x[k] != null; }); };
    var tot = function (k) { return sum(M.map(function (x) { return x[k] || 0; })); };

    // 合計4つ（全部の月にある項目だけ）
    var tiles = {
      gross: all('gross') ? tot('gross') : null,
      bh: all('bh') ? tot('bh') : null,
      days: all('days') ? tot('days') : null,
      net: all('net') ? tot('net') : null
    };
    /* ボーナス・プロフィットシェア（年間の申告・2026-11-08 オーナー「ボーナスも合計に入れよう」）。
       ★給与フォームは同じ年間の額を毎月の行に持ち越す＝月ごとに足さない。その年でいちばん新しい申告を1回だけ、
         その行のレートで円にする。0 は「無い」と答えた＝出さない。空の月は飛ばして前の月の申告を見る。 */
    var lastDecl = function (k) {
      for (var i = list.length - 1; i >= 0; i--) {
        var v = num(list[i][k]), fx = num(list[i].fx_to_jpy);
        if (v != null && fx) return v > 0 ? v * fx : null;
      }
      return null;
    };
    tiles.bonus = lastDecl('bonus_annual');
    tiles.profit = lastDecl('profit_share_annual');

    // わかること
    var ins = {};
    var P = M.filter(function (x) { return x.bh != null && x.gross != null; }).map(function (x) { return { x: x.bh, y: x.gross }; });
    if (P.length >= 4) {
      var f = fitLine(P);
      if (f.sxx > 0 && f.b > 0 && f.r >= 0.5) ins.slope = { v: f.b, n: P.length, pts: P, fit: f };
    }
    var BD = M.filter(function (x) { return x.bh != null && x.dh != null; });
    if (BD.length) {
      var sb = sum(BD.map(function (x) { return x.bh; })), sd = sum(BD.map(function (x) { return x.dh; }));
      var BDy = M.filter(function (x) { return x.bh != null && x.days != null; });
      ins.fly = { ratio: sb / sd, bh: sb, dh: sd,
        perDay: BDy.length ? sum(BDy.map(function (x) { return x.bh; })) / sum(BDy.map(function (x) { return x.days; })) : null,
        months: BD.map(function (x) { return { m: x.m, v: x.bh / x.dh }; }) };
    }
    var GV = M.filter(function (x) { return x.gross != null && x.gross > 0; });
    var moving = sum(GV.map(function (x) { return (x.fv || 0) + (x.pd || 0); }));
    if (GV.length && moving > 0) {
      var gs = GV.map(function (x) { return x.gross; });
      ins.vari = { share: moving / sum(gs), lo: GV.length >= 2 ? Math.min.apply(null, gs) : null, hi: GV.length >= 2 ? Math.max.apply(null, gs) : null };
    }
    var GG = M.filter(function (x) { return x.guar != null && x.bh != null; });
    if (GG.length) {
      var g0 = GG[GG.length - 1].guar;
      ins.guar = { g: g0, n: GG.length, over: GG.filter(function (x) { return x.bh > x.guar; }).length,
        extra: sum(GG.map(function (x) { return Math.max(0, x.bh - x.guar); })),
        months: GG.map(function (x) { return { m: x.m, d: x.bh - x.guar }; }) };
    }

    // 単価が変わる点：乗務時間の変動給（種類が分かる人）→ 無ければ変動給の合計
    var KB = M.filter(function (x) { return x.bh != null && x.vb && x.vb.block > 0; });
    var KP = KB.length >= 6 ? KB.map(function (x) { return { x: x.bh, y: x.vb.block }; })
           : M.filter(function (x) { return x.bh != null && x.fv != null; }).map(function (x) { return { x: x.bh, y: x.fv }; });
    var kink = findKink(KP);
    if (kink) {
      kink.pts = KP;
      var gl = M.filter(function (x) { return x.guar != null; });
      if (gl.length && Math.abs(gl[gl.length - 1].guar - kink.t) <= 1) kink.guar = gl[gl.length - 1].guar;
    }

    // 時給・分給と単価（同じ月に額と数量の両方がある月だけ）
    var rates = [];
    function rateRow(key, name, sub, amtOf, qk) {
      var amt = 0, qty = 0, mon = [];
      M.forEach(function (x) {
        var a = amtOf(x), q = x[qk];
        if (a > 0 && q > 0) { amt += a; qty += q; mon.push({ m: x.m, v: a / q }); }
      });
      if (qty > 0) rates.push({ k: key, name: name, sub: sub, rate: amt / qty, amt: amt, qty: qty, q: qk, perHour: !!PER_HOUR[qk], months: mon });
    }
    rateRow('block', T.rBlock, T.rPayExPd, function (x) { return x.perBlock != null && x.bh ? x.perBlock * x.bh : null; }, 'bh');
    rateRow('duty', T.rDuty, T.rPayExPd, function (x) { return x.perDuty != null && x.dh ? x.perDuty * x.dh : null; }, 'dh');
    var amtOnly = [];
    BASIS_ORDER.forEach(function (b) {
      var qk = BASIS_Q[b];
      if (qk) rateRow('vb-' + b, T.b[b], T.bSub[b], function (x) { return x.vb ? x.vb[b] : null; }, qk);
      else {
        var a = sum(M.map(function (x) { return (x.vb && x.vb[b]) || 0; }));
        if (a > 0) amtOnly.push({ k: b, name: T.b[b], amt: a });
      }
    });
    rateRow('perdiem', T.perDiem, T.perDiemSub, function (x) { return x.pd; }, 'stay');

    // 小さなグラフ
    var smalls = [];
    function small(k, name) {
      var have = M.filter(function (x) { return x[k] != null; });
      if (!have.length || !have.some(function (x) { return x[k] > 0; })) return;
      var total = sum(have.map(function (x) { return x[k]; }));
      smalls.push({ k: k, name: name, complete: have.length === M.length, total: total, avg: total / have.length,
        months: have.map(function (x) { return { m: x.m, v: x[k] }; }) });
    }
    small('sectors', T.smSectors); small('off', T.smOff); small('stay', T.smStay); small('night', T.smNight);
    var bhTot = sum(M.filter(function (x) { return x.bh != null; }).map(function (x) { return x.bh; }));
    smalls.forEach(function (s) {
      if (s.k === 'sectors') {
        var S2 = M.filter(function (x) { return x.bh != null && x.sectors > 0; });
        if (S2.length) s.sub = T.smPerSector((sum(S2.map(function (x) { return x.bh; })) / sum(S2.map(function (x) { return x.sectors; }))).toFixed(1));
      }
      if (s.k === 'stay') {
        var S3 = M.filter(function (x) { return x.stay != null && x.days > 0; });
        if (S3.length) s.sub = T.smStayShare(Math.round(sum(S3.map(function (x) { return x.stay; })) / sum(S3.map(function (x) { return x.days; })) * 100));
      }
      if (s.k === 'off' && s.complete) s.sub = T.smAvg + ' ' + s.avg.toFixed(1) + T.qDay;
      if (s.k === 'night' && bhTot > 0) {
        var S4 = M.filter(function (x) { return x.night != null && x.bh != null; });
        if (S4.length) s.sub = T.smNightShare(Math.round(sum(S4.map(function (x) { return x.night; })) / sum(S4.map(function (x) { return x.bh; })) * 100));
      }
    });

    var gLast = M.filter(function (x) { return x.guar != null; });
    return { year: year, months: M, tiles: tiles, ins: ins, kink: kink, rates: rates, amtOnly: amtOnly,
             smalls: smalls, guar: gLast.length ? gLast[gLast.length - 1].guar : null };
  }

  /* ══ 描画 ═══════════════════════════════════════════════════════ */
  var C_BLOCK = '#0a8f79', C_DUTY = '#86c7bc';   // ★2026-11-11 青をやめた：乗務＝緑・総勤務＝薄い緑（スケジュールの日別の棒と同じ）
  var INK3 = 'var(--pv-ink-3)', LINE = 'var(--pv-line-soft)';
  var state = { year: null, box: null, rows: null, o: null, model: null, company: null, coKey: null };
  /* 本人の画面の行 → 会社の表（pv_company_rates）の k */
  var CO_K = { block: 'perBlock', 'vb-block': 'block', 'vb-duty': 'duty', 'vb-night': 'night', 'vb-sector': 'sector', perdiem: 'perdiem' };
  var RANK = { cap: 'cap', tri_tre: 'cap', captain: 'cap', fo: 'fo', sfo: 'fo' };

  function man(v) {                                  // 縦軸の目盛り用の短い額
    if (!v) return '0';
    if (L === 'ja' && !(w.PVCurrency && w.PVCurrency.get && w.PVCurrency.get() !== 'JPY')) return (Math.round(v / 1000) / 10) + '万';
    return fmt(v);
  }
  function hh(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  /* 小さな額（分給など）。円以外の通貨で 10 未満になる額は小数2桁で出す
     （fmt は整数に丸めるので、ドルの分給が「US$ 0」になって 0 と読まれる）。記号は fmt の書き方に合わせる。 */
  function fmtSmall(jpy) {
    var C = w.PVCurrency, cur = C && C.get && C.get(), rate = cur && C.rates && C.rates[cur];
    if (!cur || cur === 'JPY' || !rate) return fmt(jpy);
    var v = jpy / rate;
    if (Math.abs(v) >= 10) return fmt(jpy);
    var sym = (String(fmt(1e9)).match(/^[^0-9]*/) || [''])[0];
    return sym + v.toFixed(2);
  }
  function topRound(x, y0, wd, h, r) {               // 上だけ角丸・下は基線に付ける
    if (!(h > 0)) return '';
    r = Math.min(r, wd / 2, h);
    return '<path d="M' + x + ' ' + y0 + 'V' + (y0 - h + r) + 'Q' + x + ' ' + (y0 - h) + ' ' + (x + r) + ' ' + (y0 - h) +
      'H' + (x + wd - r) + 'Q' + (x + wd) + ' ' + (y0 - h) + ' ' + (x + wd) + ' ' + (y0 - h + r) + 'V' + y0 + 'Z"';
  }
  function niceMax(v) {
    if (!(v > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
    return (m <= 1 ? 1 : m <= 1.5 ? 1.5 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 3 ? 3 : m <= 4 ? 4 : m <= 5 ? 5 : m <= 6 ? 6 : m <= 8 ? 8 : 10) * p;
  }
  function svgOpen(W, H) { return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;overflow:visible" role="img">'; }

  /* 月の列の枠：12か月ぶん・縦軸1本 */
  function monthFrame(W, H, max, ticks, tickFmt, cols) {
    var lab = ticks.map(tickFmt), PL = Math.round(12 + Math.max.apply(null, lab.map(function (s) { return String(s).length; })) * 6.4);
    var PB = 24, PT = 12, ih = H - PT - PB, cw = (W - PL) / 12;
    var y = function (v) { return PT + ih - v / max * ih; }, g = '';
    ticks.forEach(function (t, i) {
      g += '<line x1="' + PL + '" x2="' + W + '" y1="' + y(t) + '" y2="' + y(t) + '" stroke="' + LINE + '"/>' +
           '<text x="' + (PL - 8) + '" y="' + (y(t) + 3.5) + '" text-anchor="end" font-size="10.5" fill="' + INK3 + '">' + esc(lab[i]) + '</text>';
    });
    var have = {};
    cols.forEach(function (c) { have[c.m] = c; });
    for (var m = 1; m <= 12; m++) {
      var x0 = PL + cw * (m - 1), cx = x0 + cw / 2, c = have[m];
      if (c) {
        g += '<g class="yr-mo" data-m="' + m + '" data-ch="' + c.ch + '">' +
             '<rect class="yr-band" x="' + (x0 + 3) + '" y="' + (PT - 6) + '" width="' + (cw - 6) + '" height="' + (ih + 6) + '" rx="8"/>' +
             c.draw(cx, y(0), y, cw) +
             '<text x="' + cx + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10.5" fill="' + INK3 + '">' + esc(T.mo(m)) + '</text>' +
             '<rect class="yr-hit" x="' + x0 + '" y="0" width="' + cw + '" height="' + H + '"/></g>';
      } else {
        g += '<text x="' + cx + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10.5" fill="' + INK3 + '" fill-opacity=".45">' + esc(T.mo(m)) + '</text>';
      }
    }
    return { g: g, y: y, PL: PL, cw: cw };
  }

  function hoursChart(md, W) {
    var M = md.months.filter(function (x) { return x.bh != null || x.dh != null; });
    if (!M.length) return '';
    var mx = Math.max.apply(null, M.map(function (x) { return Math.max(x.bh || 0, x.dh || 0, md.guar || 0); }));
    var max = Math.max(100, Math.ceil(mx / 50) * 50), step = max > 200 ? 100 : 50, ticks = [];
    for (var t = 0; t <= max; t += step) ticks.push(t);
    var H = 220, bw = Math.max(6, Math.min(18, (W / 12 - 14) / 2));
    var fr = monthFrame(W, H, max, ticks, function (v) { return v + 'h'; }, M.map(function (x) {
      return { m: x.m, ch: 'hours', draw: function (cx, base, y) {
        return (x.bh != null ? topRound(cx - bw - 1, base, bw, base - y(x.bh), 4) + ' fill="' + C_BLOCK + '"/>' : '') +
               (x.dh != null ? topRound(cx + 1, base, bw, base - y(x.dh), 4) + ' fill="' + C_DUTY + '"/>' : '');
      } };
    }));
    var g = fr.g;
    if (md.guar) {
      g += '<line x1="' + fr.PL + '" x2="' + W + '" y1="' + fr.y(md.guar) + '" y2="' + fr.y(md.guar) + '" stroke="' + INK3 +
           '" stroke-width="1.5" stroke-dasharray="5 4" pointer-events="none"/>';
    }
    return '<div class="yr-ch"><div class="yr-ch-h"><h3>' + esc(T.chHours) + '</h3><div class="yr-lg">' +
      '<span><em style="background:' + C_BLOCK + '"></em>' + esc(T.lgBlock) + '</span>' +
      '<span><em style="background:' + C_DUTY + '"></em>' + esc(T.lgDuty) + '</span>' +
      (md.guar ? '<span><em class="dash"></em>' + esc(T.lgGuar(md.guar)) + '</span>' : '') +
      '</div></div>' + svgOpen(W, H) + g + '</svg></div>';
  }

  function payChart(md, W, segName) {
    var M = md.months.filter(function (x) { return x.segs && x.segs.segs && x.segs.segs.length; });
    if (!M.length) return '';
    var keys = [], col = {};
    M.forEach(function (x) { x.segs.segs.forEach(function (s) { if (keys.indexOf(s.k) < 0) { keys.push(s.k); col[s.k] = s.c; } }); });
    var order = V.SEG.map(function (s) { return s.k; }).filter(function (k) { return keys.indexOf(k) >= 0; });
    var max = niceMax(Math.max.apply(null, M.map(function (x) { return x.segs.total; })) * 1.05), ticks = [];
    for (var i = 0; i <= 4; i++) ticks.push(max * i / 4);
    var H = 220, bw = Math.max(10, Math.min(36, W / 12 - 20));
    var fr = monthFrame(W, H, max, ticks, man, M.map(function (x) {
      return { m: x.m, ch: 'pay', draw: function (cx, base, y) {
        var acc = 0, g = '', segs = order.map(function (k) { return x.segs.segs.filter(function (s) { return s.k === k; })[0]; }).filter(Boolean);
        segs.forEach(function (s, j) {
          var y0 = y(acc), h = y0 - y(acc + s.v), gap = j ? 2 : 0;
          g += (j === segs.length - 1)
            ? topRound(cx - bw / 2, y0 - gap, bw, h - gap, 4) + ' fill="' + s.c + '"/>'
            : '<rect x="' + (cx - bw / 2) + '" y="' + (y0 - h) + '" width="' + bw + '" height="' + Math.max(0, h - gap) + '" fill="' + s.c + '"/>';
          acc += s.v;
        });
        return g;
      } };
    }));
    return '<div class="yr-ch"><div class="yr-ch-h"><h3>' + esc(T.chPay) + '</h3><div class="yr-lg">' +
      order.map(function (k) { return '<span><em style="background:' + col[k] + '"></em>' + esc(segName[k] || k) + '</span>'; }).join('') +
      '</div></div>' + svgOpen(W, H) + fr.g + '</svg></div>';
  }

  function insights(md) {
    var I = md.ins, out = '';
    function card(k, v, u, p, svg) {
      return '<div class="yr-in' + (svg ? '' : ' no-g') + '"><div><span>' + esc(k) + '</span><b>' + esc(v) + (u ? '<i>' + esc(u) + '</i>' : '') + '</b><p>' + esc(p) + '</p></div>' +
        (svg ? '<div class="yr-in-g">' + svg + '</div>' : '') + '</div>';
    }
    if (I.slope) {
      var P = I.slope.pts, f = I.slope.fit, W = 210, H = 96;
      var x0 = Math.min.apply(null, P.map(function (p) { return p.x; })) - 2, x1 = Math.max.apply(null, P.map(function (p) { return p.x; })) + 2;
      var y0 = Math.min.apply(null, P.map(function (p) { return p.y; })), y1 = Math.max.apply(null, P.map(function (p) { return p.y; }));
      var pad = Math.max((y1 - y0) * 0.15, y1 * 0.01); y0 -= pad; y1 += pad;
      var X = function (v) { return 6 + (v - x0) / (x1 - x0) * (W - 12); }, Y = function (v) { return H - 16 - (v - y0) / (y1 - y0) * (H - 24); };
      var sc = '<line x1="' + X(x0) + '" y1="' + Y(f.a + f.b * x0) + '" x2="' + X(x1) + '" y2="' + Y(f.a + f.b * x1) + '" stroke="' + C_BLOCK + '" stroke-width="2"/>';
      P.forEach(function (p) { sc += '<circle cx="' + X(p.x) + '" cy="' + Y(p.y) + '" r="4" fill="' + C_BLOCK + '" fill-opacity=".3" stroke="' + C_BLOCK + '" stroke-width="1.5"/>'; });
      sc += '<text x="6" y="' + (H - 2) + '" font-size="10" fill="' + INK3 + '">' + Math.round(x0 + 2) + 'h</text>' +
            '<text x="' + (W - 6) + '" y="' + (H - 2) + '" text-anchor="end" font-size="10" fill="' + INK3 + '">' + Math.round(x1 - 2) + 'h</text>';
      out += card(T.iSlopeK, '+' + fmt(I.slope.v), '', T.iSlopeP(I.slope.n), svgOpen(W, H) + sc + '</svg>');
    }
    if (I.fly) {
      /* 月ごとの小さな線は置かない（2026-11-09 オーナー「おたまじゃくし」→ 消す）。数字と文だけ */
      out += card(T.iFlyK, Math.round(I.fly.ratio * 100) + '%', '', T.iFlyP(Math.round(I.fly.dh), Math.round(I.fly.bh), I.fly.perDay ? I.fly.perDay.toFixed(1) : null));
    }
    if (I.vari) {
      var W3 = 210, fx3 = 1 - I.vari.share;
      var bar = '<rect x="0" y="10" width="' + Math.max(0, W3 * fx3 - 1) + '" height="14" rx="4" fill="#34d399"/>' +
                '<rect x="' + (W3 * fx3 + 1) + '" y="10" width="' + Math.max(0, W3 * I.vari.share - 1) + '" height="14" rx="4" fill="#f5c842"/>';
      out += card(T.iVarK, Math.round(I.vari.share * 100) + '%', '', T.iVarP(I.vari.lo != null ? fmt(I.vari.lo) : null, I.vari.hi != null ? fmt(I.vari.hi) : null),
        svgOpen(W3, 30) + bar + '</svg>');
    }
    if (I.guar) {
      var W4 = 210, H4 = 70, mid = 40, cw4 = W4 / 12, bw4 = Math.min(14, cw4 - 4);
      var dm = Math.max.apply(null, I.guar.months.map(function (p) { return Math.abs(p.d); })) || 1;
      var ob = '<line x1="0" x2="' + W4 + '" y1="' + mid + '" y2="' + mid + '" stroke="' + INK3 + '" stroke-dasharray="4 3"/>';
      I.guar.months.forEach(function (p) {
        var h = Math.abs(p.d) / dm * 34, x = cw4 * (p.m - 1) + (cw4 - bw4) / 2;
        ob += p.d >= 0 ? '<rect x="' + x + '" y="' + (mid - h) + '" width="' + bw4 + '" height="' + h + '" rx="3" fill="' + C_BLOCK + '"/>'
                       : '<rect x="' + x + '" y="' + mid + '" width="' + bw4 + '" height="' + h + '" rx="3" fill="' + INK3 + '" fill-opacity=".45"/>';
      });
      out += card(T.iGuarK, I.guar.over + ' / ' + I.guar.n, T.ofMonths, T.iGuarP(I.guar.g, hh(I.guar.extra)), svgOpen(W4, H4) + ob + '</svg>');
    }
    return out ? '<h3 class="yr-h">' + esc(T.insH) + '</h3><div class="yr-ins">' + out + '</div>' : '';
  }

  function coKinkBlock(co) {
    var t = Math.round(co.t);
    return '<div class="yr-co"><span>' + esc(T.coKinkH) + '</span><b class="big">' + esc(T.kinkBig(t)) + '</b>' +
      '<div class="yr-rate2"><div><span>' + esc(T.kinkBelow(t)) + '</span><b>' + esc(T.kinkPer(fmt(co.below))) + '</b></div>' +
      '<div class="up"><span>' + esc(T.kinkAbove(t)) + '</span><b>' + esc(T.kinkPer(fmt(co.above))) + '</b></div></div></div>';
  }
  function kinkCard(md, boxW) {
    var k = md.kink, co = state.company && state.company.kink;
    if (!k && !co) return '';
    if (!k) return '<h3 class="yr-h">' + esc(T.kinkH) + '</h3><div class="yr-kink is-co">' + coKinkBlock(co) + '</div>';
    /* 狭い画面では1列になる＝画面の幅で描く（縮めると字が読めない） */
    var t = Math.round(k.t), W = boxW < 680 ? Math.max(260, boxW - 40) : 520, H = 230, PL = 56, PB = 28, PT = 18;
    var xs = k.pts.map(function (p) { return p.x; }), ys = k.pts.map(function (p) { return p.y; });
    var x0 = Math.floor(Math.min.apply(null, xs) - 3), x1 = Math.ceil(Math.max.apply(null, xs) + 3);
    var ymax = niceMax(Math.max.apply(null, ys) * 1.1);
    var X = function (v) { return PL + (v - x0) / (x1 - x0) * (W - PL - 10); }, Y = function (v) { return PT + (H - PT - PB) - Math.max(0, v) / ymax * (H - PT - PB); };
    var g = '';
    [0, ymax / 2, ymax].forEach(function (v) {
      g += '<line x1="' + PL + '" x2="' + (W - 10) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + LINE + '"/>' +
           '<text x="' + (PL - 8) + '" y="' + (Y(v) + 3.5) + '" text-anchor="end" font-size="10.5" fill="' + INK3 + '">' + esc(man(v)) + '</text>';
    });
    var step = (x1 - x0) > 30 ? 10 : 5;
    for (var v = Math.ceil(x0 / step) * step; v <= x1; v += step) g += '<text x="' + X(v) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10.5" fill="' + INK3 + '">' + v + 'h</text>';
    g += '<line x1="' + X(k.t) + '" x2="' + X(k.t) + '" y1="' + PT + '" y2="' + (H - PB) + '" stroke="' + INK3 + '" stroke-dasharray="5 4" stroke-width="1.5"/>' +
         '<text x="' + (X(k.t) + 6) + '" y="' + (PT + 4) + '" font-size="11" font-weight="800" fill="var(--pv-ink)">' + t + 'h</text>';
    var f = k.fit, F = function (x) { return f.a + f.b1 * x + f.b2 * Math.max(0, x - f.t); };
    g += '<polyline points="' + [x0, k.t, x1].map(function (x) { return X(x).toFixed(1) + ' ' + Y(F(x)).toFixed(1); }).join(' ') + '" fill="none" stroke="' + C_BLOCK + '" stroke-width="2.5" stroke-linejoin="round"/>';
    k.pts.forEach(function (p) { g += '<circle cx="' + X(p.x) + '" cy="' + Y(p.y) + '" r="5" fill="' + C_BLOCK + '" fill-opacity=".3" stroke="' + C_BLOCK + '" stroke-width="1.5"/>'; });
    g += '<text x="' + PL + '" y="' + (PT - 6) + '" font-size="10.5" fill="' + INK3 + '">' + esc(T.kinkAxis) + '</text>';
    return '<h3 class="yr-h">' + esc(T.kinkH) + '</h3><div class="yr-kink"><div>' +
      '<span>' + esc(T.kinkK) + '</span><b class="big">' + esc(T.kinkBig(t)) + '</b>' +
      '<div class="yr-rate2"><div><span>' + esc(T.kinkBelow(t)) + '</span><b>' + esc(T.kinkPer(fmt(k.below))) + '</b></div>' +
      '<div class="up"><span>' + esc(T.kinkAbove(t)) + '</span><b>' + esc(T.kinkPer(fmt(k.above))) + '</b></div></div>' +
      '<p>' + esc((k.guar ? T.kinkSame(k.guar) + '・' : '') + T.kinkFrom(k.n, k.nAbove, k.nBelow)) + '</p>' + (co ? coKinkBlock(co) : '') + '</div>' +
      '<div class="yr-kink-g">' + svgOpen(W, H) + g + '</svg></div></div>';
  }

  /* 時給・分給と単価（2026-11-09 オーナー「数字の格子で読みにくい」「会社の会員がわからない」）。
     ★1行に大きい数字は1つだけ（その単価）。会社の会員との差と1年の量は、その下の1行の文で言う。
       数量の無い手当は行にせず、一覧の下に1行で額だけ。 */
  function ratesList(md) {
    if (!md.rates.length && !md.amtOnly.length) return '';
    var unit = function (x) { return x.perHour ? T.uH : x.q === 'sectors' ? T.uSector : T.uNight; };
    var qtyTx = function (x) { return x.q === 'sectors' ? Math.round(x.qty) + T.qSector : x.q === 'stay' ? Math.round(x.qty) + T.qNight : hh(x.qty) + T.qHrs[x.q]; };
    var co = state.company, CO = co && co.rates, rk = co && T.rk[co.rank];
    /* 会社の会員（同じ会社・同じ職位）の中央値と、本人との差（本人 ÷ 会社 − 1）。無い種類は言わない（0 にしない） */
    var cmp = function (x) {
      var c = CO && CO[CO_K[x.k]];
      if (!(c > 0) || !rk) return '';
      var p = Math.round((x.rate / c - 1) * 100), m = fmtSmall(c);
      var s = p > 0 ? T.coUp(rk, m, p) : p < 0 ? T.coDn(rk, m, -p) : T.coEq(rk, m);
      return '<span>' + esc(s[0]) + (s[1] ? '<em class="' + (p > 0 ? 'up' : 'dn') + '">' + esc(s[1]) + '</em>' : '') + esc(s[2]) + '</span> · ';
    };
    var rows = md.rates.map(function (x) {
      return '<li class="yr-rl-i">' +
        '<div class="yr-rl-n"><b>' + esc(x.name) + '</b>' + (x.sub ? '<small>' + esc(x.sub) + '</small>' : '') + '</div>' +
        '<div class="yr-rl-v"><b>' + esc(fmtSmall(x.rate)) + '<i>' + esc(unit(x)) + '</i></b>' +
          (x.perHour ? '<small>' + esc(fmtSmall(x.rate / 60)) + '<i>' + esc(T.uMin) + '</i></small>' : '') + '</div>' +
        '<p class="yr-rl-c">' + cmp(x) + '<span>' + esc(T.rlYear(qtyTx(x), fmt(x.amt))) + '</span></p></li>';
    }).join('');
    var rest = md.amtOnly.length ? '<p class="yr-rl-x">' +
      esc(T.noRate(md.amtOnly.map(function (x) { return x.name + ' ' + fmt(x.amt); }).join(' · '))) + '</p>' : '';
    return '<h3 class="yr-h">' + esc(T.ratesH) + '</h3><div class="yr-rates">' +
      (rows ? '<ul class="yr-rl" role="list">' + rows + '</ul>' : '') + rest + '</div>';
  }

  function smallsHTML(md) {
    if (!md.smalls.length) return '';
    var U = { sectors: T.qSector, off: T.qDay, stay: T.qNight, night: T.qH };
    return '<div class="yr-sm">' + md.smalls.map(function (s) {
      var W = 230, H = 64, cw = W / 12, bw = Math.min(13, cw - 4), mx = Math.max.apply(null, s.months.map(function (p) { return p.v; })) || 1, g = '';
      s.months.forEach(function (p) {
        var h = p.v / mx * (H - 8), x0 = cw * (p.m - 1);
        g += '<g class="yr-mo" data-m="' + p.m + '" data-ch="sm" data-k="' + s.k + '"><rect class="yr-band" x="' + (x0 + 1) + '" y="0" width="' + (cw - 2) + '" height="' + H + '" rx="4"/>' +
             topRound(x0 + (cw - bw) / 2, H, bw, h, 3) + ' fill="' + C_BLOCK + '" fill-opacity=".75"/>' +
             '<rect class="yr-hit" x="' + x0 + '" y="0" width="' + cw + '" height="' + H + '"/></g>';
      });
      var big = s.complete ? (s.k === 'night' ? hh(s.total) : Math.round(s.total)) : (s.k === 'night' ? hh(s.avg) : s.avg.toFixed(1));
      return '<div class="yr-sm-i"><div class="yr-sm-h"><span>' + esc(s.name) + (s.complete ? '' : '・' + esc(T.smAvg)) + '</span><b>' + esc(String(big)) +
        '<i>' + esc(U[s.k]) + '</i></b></div>' + (s.sub ? '<p>' + esc(s.sub) + '</p>' : '') + svgOpen(W, H) + g + '</svg></div>';
    }).join('') + '</div>';
  }

  function monthTable(md) {
    var M = md.months, cols = [
      ['gross', T.tGrossC, function (x) { return x.gross != null ? fmt(x.gross) : '—'; }],
      ['net', T.tNetC, function (x) { return x.net != null ? fmt(x.net) : '—'; }],
      ['bh', T.tBlockC, function (x) { return x.bh != null ? hh(x.bh) : '—'; }],
      ['dh', T.tDutyC, function (x) { return x.dh != null ? hh(x.dh) : '—'; }],
      ['days', T.tDaysC, function (x) { return x.days != null ? x.days : '—'; }],
      ['stay', T.tStayC, function (x) { return x.stay != null ? x.stay : '—'; }]
    ].filter(function (c) { return M.some(function (x) { return x[c[0]] != null; }); });
    return '<details class="yr-tb"><summary>' + esc(T.tableH) + '</summary><table><thead><tr><th>' + esc(T.tMonth) + '</th>' +
      cols.map(function (c) { return '<th>' + esc(c[1]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      M.map(function (x) { return '<tr><td>' + esc(T.mo(x.m)) + '</td>' + cols.map(function (c) { return '<td>' + esc(String(c[2](x))) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></details>';
  }

  /* 吹き出し（合わせた月の細かい数字） */
  function tipBody(ch, m, k) {
    var md = state.model, x = md.months.filter(function (q) { return q.m === m; })[0];
    if (!x) return '';
    var p = function (a, b, c) { return '<p>' + (c ? '<em style="background:' + c + '"></em>' : '') + esc(a) + '<b>' + esc(b) + '</b></p>'; };
    var h = '<h4>' + esc(T.yr(md.year) + (L === 'ja' ? '' : ' ') + T.mo(m)) + '</h4>';
    if (ch === 'hours') {
      return h + (x.bh != null ? p(T.lgBlock, hh(x.bh) + 'h', C_BLOCK) : '') + (x.dh != null ? p(T.lgDuty, hh(x.dh) + 'h', C_DUTY) : '') +
        (x.guar && x.bh != null ? p(T.tipGuar, (x.bh - x.guar >= 0 ? '+' : '−') + hh(Math.abs(x.bh - x.guar)) + 'h') : '') +
        (x.days != null ? p(T.tipDays, x.days + T.qDay) : '');
    }
    if (ch === 'pay') {
      var names = (state.o && state.o.segName) || {};
      return h + x.segs.segs.map(function (s) { return p(names[s.k] || s.k, fmt(s.v), s.c); }).join('') +
        (x.gross != null ? '<div class="tot">' + p(T.tipGross, fmt(x.gross)) + '</div>' : '');
    }
    var s = md.smalls.filter(function (q) { return q.k === k; })[0];
    var U = { sectors: T.qSector, off: T.qDay, stay: T.qNight, night: T.qH };
    return s ? h + p(s.name, (k === 'night' ? hh(x[k]) : x[k]) + U[k], C_BLOCK) : '';
  }

  function bindHover(box) {
    var tip = box.querySelector('.yr-tip');
    function on(el) {
      var m = el.getAttribute('data-m');
      box.querySelectorAll('.yr-mo').forEach(function (g) { g.classList.toggle('on', g.getAttribute('data-m') === m); });
      tip.innerHTML = tipBody(el.getAttribute('data-ch'), +m, el.getAttribute('data-k'));
      var bb = box.getBoundingClientRect(), hb = el.querySelector('.yr-hit').getBoundingClientRect();
      tip.classList.add('show');
      var x = hb.right - bb.left + 8;
      if (x + tip.offsetWidth > bb.width) x = hb.left - bb.left - 8 - tip.offsetWidth;
      tip.style.left = Math.max(0, x) + 'px';
      tip.style.top = (hb.top - bb.top + 8) + 'px';
    }
    function off() {
      tip.classList.remove('show');
      box.querySelectorAll('.yr-mo.on').forEach(function (g) { g.classList.remove('on'); });
    }
    box.querySelectorAll('.yr-mo').forEach(function (g) {
      g.addEventListener('mouseenter', function () { on(g); });
      g.addEventListener('click', function (e) { e.stopPropagation(); on(g); });   // 指で触れたとき
    });
    box.addEventListener('mouseleave', off);
    d.addEventListener('click', function (e) { if (!box.contains(e.target)) off(); });
  }

  function draw() {
    var box = state.box, rows = state.rows, o = state.o || {};
    if (!box) return;
    var ys = years(rows);
    if (!ys.length) { box.innerHTML = ''; return; }
    if (ys.indexOf(state.year) < 0) state.year = ys[0];
    var md = state.model = calc(rows, state.year);
    /* ★2026-11-11 オーナー「1年はカードが横に長すぎて見づらい」── 中身ごとの狭いカードを2列に並べる（狭い画面は1列）。
         図はカードの中の実寸で描く（横いっぱいの幅で描いて縮めると、字が小さくなる）。 */
    var full = Math.round(box.clientWidth || 1000), two = full >= 880;
    var W = Math.max(280, (two ? Math.floor((full - 16) / 2) : full) - 48);
    var card = function (inner, mod) { return inner ? '<section class="pt-sec mr-card yr-c' + (mod ? ' ' + mod : '') + '">' + inner + '</section>' : ''; };
    var tl = md.tiles, extra = (tl.bonus || 0) + (tl.profit || 0), tiles = [];
    /* 総支給の合計に、年間のボーナス・プロフィットシェアを足して出す（中身は「うち…」の行で見せる）。
       総支給が欠けた月がある年は合計を出さない（今までどおり）ので、そのときはボーナスだけを別に出す。 */
    if (tl.gross != null) {
      tiles.push({ k: extra ? T.tGrossB : T.tGross, v: fmt(tl.gross + extra),
        sub: [[T.kBonus, tl.bonus], [T.kProfit, tl.profit]].filter(function (p) { return p[1]; }).map(function (p) { return [p[0], fmt(p[1])]; }) });
    } else {
      [[T.kBonus, tl.bonus], [T.kProfit, tl.profit]].forEach(function (p) { if (p[1]) tiles.push({ k: T.tYearly(p[0]), v: fmt(p[1]) }); });
    }
    if (tl.bh != null) tiles.push({ k: T.tBlock, v: hh(tl.bh), u: 'h' });
    if (tl.days != null) tiles.push({ k: T.tDays, v: Math.round(tl.days), u: T.qDay });
    if (tl.net != null) tiles.push({ k: T.tNet, v: fmt(tl.net) });
    box.innerHTML =
      '<div class="yr yr-g' + (two ? ' is-two' : '') + '" id="pv-year">' +
        card('<div class="yr-top"><h2 class="mr-card-t">' + esc(T.title) + '<span class="yr-pyr">' + esc(L === 'ja' ? '（' + T.yr(state.year) + '）' : ' (' + T.yr(state.year) + ')') + '</span></h2>' +
          (ys.length > 1 ? '<div class="pt-tabs yr-years">' + ys.map(function (y) {
            return '<button type="button" class="pt-tab' + (y === state.year ? ' on' : '') + '" data-yr="' + y + '">' + esc(T.yr(y)) + '</button>';
          }).join('') + '</div>' : '<span class="yr-one">' + esc(T.yr(state.year)) + '</span>') +
          '<span class="yr-sp"></span><button type="button" class="yr-pdf">' + esc(T.pdf) + '</button></div>' +
        (tiles.length ? '<div class="yr-tiles">' + tiles.map(function (t) {
          return '<div class="yr-tile"><span>' + esc(t.k) + '</span><b>' + esc(String(t.v)) + (t.u ? '<i>' + esc(t.u) + '</i>' : '') + '</b>' +
            (t.sub || []).map(function (x) { return '<small><span>' + esc(x[0]) + '</span> <span>' + esc(x[1]) + '</span></small>'; }).join('') + '</div>';
        }).join('') + '</div>' : ''), 'is-head is-wide') +
        (typeof o.lead === 'function' ? o.lead() : '') +      // 累計報酬（見出しの下・左の列）
        card(insights(md)) + card(kinkCard(md, W)) +
        card(hoursChart(md, W)) + card(payChart(md, W, o.segName || {})) +
        card(ratesList(md)) + card(smallsHTML(md)) + card(monthTable(md), 'is-wide') +
        '<div class="yr-tip" role="status"></div>' +
      '</div>';
    if (typeof o.onDraw === 'function') o.onDraw();
    box.querySelectorAll('[data-yr]').forEach(function (b) {
      b.addEventListener('click', function () { state.year = +b.getAttribute('data-yr'); draw(); });
    });
    var pdf = box.querySelector('.yr-pdf');
    /* PDF は印刷の画面から（ライブラリを使わない）。
       ★「1年」の部分だけを body の直下へ写してから印刷する。ほかを見えなくするだけだと、
         見えない部分の高さが残って空白のページが何枚もできる（実際に6ページになった）。
       月ごとの表も載せるため、写しでは開いておく。印刷が終わったら写しを消す。 */
    if (pdf) pdf.addEventListener('click', function () { printYear(); });
    bindHover(box.querySelector('#pv-year'));
  }

  function printYear() {
    var src = d.getElementById('pv-year');
    if (!src) return;
    var old = d.getElementById('pv-print');
    if (old) old.parentNode.removeChild(old);
    var wrap = d.createElement('div');
    wrap.id = 'pv-print';
    var scope = d.createElement('div');
    scope.id = 'pv-value';                         // 見た目の規則（#pv-value .yr-…）をそのまま効かせる
    scope.className = 'pv-no-cur';
    var cp = src.cloneNode(true);
    cp.querySelectorAll('.mr-card.is-total').forEach(function (x) { x.parentNode.removeChild(x); });   // 累計のカードは PDF に入れない（今までどおり）
    scope.appendChild(cp);
    wrap.appendChild(scope);
    var dt = wrap.querySelector('.yr-tb');
    if (dt) dt.open = true;
    d.body.appendChild(wrap);
    d.documentElement.classList.add('pv-printing');
    var done = function () {
      d.documentElement.classList.remove('pv-printing');
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      w.removeEventListener('afterprint', done);
    };
    w.addEventListener('afterprint', done);
    w.print();
    setTimeout(done, 1000);                        // afterprint を出さない端末でも写しを残さない
  }

  function render(box, rows, o) {
    state.box = box; state.rows = rows || []; state.o = o || {};
    draw();
    var last = state.rows[state.rows.length - 1], air = last && String(last.airline || '').toLowerCase(), rk = last && RANK[last.position];
    if (!air || air === 'other' || !rk || typeof state.o.company !== 'function') return;
    var key = air + '|' + rk + '|' + (state.o.sample ? 's' : '');
    if (state.coKey === key) return;
    state.coKey = key; state.company = null;
    Promise.resolve(state.o.company(air)).then(function (got) {
      if (state.coKey !== key || !got) return;
      var rates = {}, kink = null;
      (got.rates || []).forEach(function (x) { var v = num(x && x.rate_jpy); if (x && x.rank === rk && v > 0) rates[x.k] = v; });
      (got.kink || []).forEach(function (x) { if (x && x.rank === rk && num(x.t) > 0 && num(x.above) > 0) kink = { t: num(x.t), below: num(x.below) || 0, above: num(x.above) }; });
      state.company = { rates: rates, kink: kink, rank: rk };   // rank は単価の文の「機長／副操縦士」
      draw();
    }, function () {});
  }

  w.PVYear = { calc: calc, years: years, render: render, redraw: draw, findKink: findKink, print: printYear };
}(window));
