/* ════════════════════════════════════════════════════════════════
   pv-report-engine.js — マイレポートの計算（画面も文言も DOM も持たない）
   2026-11-09。ロスター（勤務月）と明細（支給月）をつないだ本人用の分析の土台。

   window.PVReport = {
     minorDigits(cur) → 0|2|3                 通貨の最小単位の桁
     toMinor(v, cur) → 整数|null              金額を最小単位の整数へ（文字列の10進で丸める）
     fromMinor(n, cur) → 数|null
     linesOf(row) → 支給月1枚ぶん { ym, currency, d, gross, grossBasis, anchor, net, deductions,
                                    lines[], known, outside, absence, unexplained, overGross, qty, roleQty, flags }
     rosterMonths(days, profile) → [{ ym, dutyMin, blockMin{operating,deadhead,ground,unknown}, sectors, dhLegs,
                                     dutyDays, vacDays, offDays, complete, partial{…}, gaps{…}, days[] }]
     mergePages(pages) → { days[], issues[], period, hints }   分割スクショの重なり・切れを1日1回に
                         空欄の日は { date, blank: true } で残す（中身のある写りがあれば負ける・月の集計に数えない）。
                         記号を読めなかった日は unread: true（時刻・区間があれば、それは使う・数える）。
                         日の種類 cat（parse-roster の10語）は、記号を採った写りの読めた種類を優先して運ぶ（無ければ null）
     alignCandidates(months|rows, rosterMonths, {tolerance, kinds}) → [{ ym, slipBlockMin, compare[], candidate, ambiguous, reason }]
     build({ reports, items, maps, roster, airline, airlineOther }) → model
     summary(model, sel) / cardA / cardB / cardC / checks(model)
     ruleFit = { dailyExcess, monthlyExcess, guarantee, fitRate, holdout, evaluate, candidate, compare }
     CATEGORIES, KINDS, helpers
   }

   守っていること
   ・金額は通貨の最小単位の整数（JPY 0 桁・KWD/BHD/OMR/JOD/TND/LYD/IQD 3 桁・ほか 2 桁。ISO で 0 桁の KRW/VND/CLP/ISK なども 0）。
     時間は整数の分。表示用に丸めた値から計算しない。null と 0 を混ぜない。分母が不明・0 なら比を出さない。
   ・支給月の分析（収入の構成・増減）と、勤務月の分析（単位あたり）を混ぜない。
     勤務月が分からない行は単位あたりから外す（収入の構成には入る）。月をそろえるのは pv_line_map の確認だけ。
   ・「総支給の中か外か」の規則は pay-viz.js（segments / grossOrig / unionOutsideJpy / perdiemOutsideJpy / absenceJpy）と同じ。
     サーバの判定（union_outside_gross / perdiem_outside_gross / absence_total）が行に在ればそれを読む。
     無いとき（my_report_items だけの行）は pay_items から同じ式で作る（db/pay-reports.sql の pv_union_outside_gross ほか）。
   ・総支給（gross）は PVViz.grossOrig の答え＝ my-value.js の「総支給」と同じ額。pay-viz.js を先に読むこと。
   ・Date.now も乱数も使わない。同じ入力なら同じ答え。
   ════════════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';
  var VERSION = 1;

  /* ── 小道具 ─────────────────────────────────────────────── */
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function num(v) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }
  function obj(v) {
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    if (typeof v === 'string' && v) {
      try { var o = JSON.parse(v); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : null; } catch (e) { return null; }
    }
    return null;
  }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function viz() {
    var V = w.PVViz;
    if (!V || !V.grossOrig) throw new Error('PVReport: pay-viz.js を先に読んでください');
    return V;
  }

  /* ── 年月 ───────────────────────────────────────────────── */
  function ymOf(y, m) { return (y && m) ? y + '-' + pad2(m) : null; }
  function ymIdx(ym) { var p = /^(\d{4})-(\d{2})$/.exec(ym || ''); return p ? (+p[1]) * 12 + (+p[2] - 1) : null; }
  function ymFromIdx(i) { return Math.floor(i / 12) + '-' + pad2((i % 12) + 1); }
  function ymAdd(ym, k) { var i = ymIdx(ym); return (i == null || !isNum(k)) ? null : ymFromIdx(i + k); }
  function daysIn(ym) { var i = ymIdx(ym); if (i == null) return null; var y = Math.floor(i / 12), m = i % 12; return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }
  function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function ymRange(a, b) { var i = ymIdx(a), j = ymIdx(b), out = []; if (i == null || j == null) return out; for (; i <= j; i++) out.push(ymFromIdx(i)); return out; }

  /* ── 時刻と時間 ─────────────────────────────────────────── */
  /* 'HH:MM'（'HH:MM:SS' も）→ その日の分 */
  function clockMin(s) {
    var m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(s == null ? '' : s).trim());
    if (!m) return null;
    var h = +m[1], mi = +m[2];
    if (mi > 59 || h > 24 || (h === 24 && mi > 0)) return null;
    return h * 60 + mi;
  }
  function hhmm(min) { return pad2(Math.floor(min / 60)) + ':' + pad2(min % 60); }
  /* 印字の長さ 'H:MM' → 分。整数（block_min）もそのまま */
  function durMin(s) {
    if (isNum(s)) return (s >= 0 && s === Math.floor(s)) ? s : null;
    var m = /^(\d{1,3}):(\d{2})$/.exec(String(s == null ? '' : s).trim());
    if (!m || +m[2] > 59) return null;
    return (+m[1]) * 60 + (+m[2]);
  }
  function hoursToMin(h) { h = num(h); return h == null ? null : Math.round(h * 60); }

  /* 時刻帯（IANA）。Intl だけを使う＝通信なし・Date.now なし */
  var DTF = {};
  function validTz(tz) {
    if (!tz || typeof tz !== 'string' || tz.length > 40) return null;
    try { if (!DTF[tz]) DTF[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); return tz; }
    catch (e) { return null; }
  }
  function tzOffsetMin(ms, tz) {
    var p = {};
    DTF[tz].formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    var asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
    return Math.round((asUtc - ms) / 60000);
  }
  /* その地の壁時計（date の 0 時から min 分後）→ UTC のミリ秒 */
  function wallToUtcMs(date, min, tz) {
    var y = +date.slice(0, 4), mo = +date.slice(5, 7), d = +date.slice(8, 10);
    var guess = Date.UTC(y, mo - 1, d) + min * 60000;
    var o1 = tzOffsetMin(guess, tz), t = guess - o1 * 60000, o2 = tzOffsetMin(t, tz);
    return o2 === o1 ? t : guess - o2 * 60000;
  }
  /* 経過時間。確認した時刻帯で数える：utc → そのまま／local＋tz → 夏時間込み／それ以外 → 時計の差（basis:'clock'＝未確認） */
  function elapsed(date, onMin, endWall, profile) {
    if (onMin == null || endWall == null) return { min: null, basis: null };
    var ref = profile && profile.time_ref, tz = validTz(profile && profile.tz), v, basis;
    if (ref === 'utc') { v = endWall - onMin; basis = 'utc'; }
    else if (ref === 'local' && tz && isDate(date)) { v = Math.round((wallToUtcMs(date, endWall, tz) - wallToUtcMs(date, onMin, tz)) / 60000); basis = 'tz'; }
    else { v = endWall - onMin; basis = 'clock'; }
    if (!(v > 0) || v > 3 * 1440) return { min: null, basis: basis, invalid: true };
    return { min: v, basis: basis };
  }

  /* ── 通貨の最小単位 ─────────────────────────────────────── */
  var ZERO = { JPY: 1, KRW: 1, VND: 1, CLP: 1, ISK: 1, PYG: 1, UGX: 1, XAF: 1, XOF: 1, XPF: 1, KMF: 1, RWF: 1, DJF: 1, GNF: 1, BIF: 1, VUV: 1 };
  var THREE = { KWD: 1, BHD: 1, OMR: 1, JOD: 1, TND: 1, LYD: 1, IQD: 1 };
  function minorDigits(cur) { var c = String(cur || '').toUpperCase(); return ZERO[c] ? 0 : THREE[c] ? 3 : 2; }
  /* 10進の文字列のまま桁を寄せる（1.005 × 100 のような2進の誤差を通さない）。端数は四捨五入（0 から遠い側） */
  function toMinor(v, cur) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
    var d = minorDigits(cur);
    var s = typeof v === 'string' ? v.trim() : (isNum(v) ? String(v) : null);
    if (s == null || s === '') return null;
    var m = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(s);
    var z;
    if (!m) {
      var n = Number(s);
      if (!isFinite(n)) return null;
      z = Math.round(Math.abs(n) * Math.pow(10, d));
      return z === 0 ? 0 : (n < 0 ? -z : z);
    }
    var frac = m[3] || '';
    z = Number(m[2] + (frac + '000').slice(0, d));
    if (frac.length > d && +frac.charAt(d) >= 5) z += 1;
    return (z === 0) ? 0 : (m[1] === '-' ? -z : z);
  }
  function fromMinor(n, cur) { return isNum(n) ? n / Math.pow(10, minorDigits(cur)) : null; }

  /* 項目名の鍵：小文字・前後の空白を落とす・空白をつめる（80字まで＝pv_line_map の label_key） */
  function labelKey(s) {
    if (s == null) return null;
    var k = String(s).replace(/\s+/g, function () { return ' '; }).trim().toLowerCase();
    return k ? k.slice(0, 80) : null;
  }
  function mapKey(ym, key) { return (ym + '|' + key).slice(0, 80); }

  /* ── 項目の種類と区分（データで持つ。順番＝構成の並び）──────────
     seg は pay-viz.js の SEG の鍵（色・突き合わせ用）。col は pay_reports の列。 */
  var KINDS = {
    base:        { cat: 'fixed',       seg: 'base',       col: 'base_pay' },
    guarantee:   { cat: 'fixed',       seg: 'guarantee',  col: 'guarantee_pay' },
    command:     { cat: 'fixed',       seg: 'command',    col: 'command_pay' },
    housing:     { cat: 'fixed',       seg: 'housing',    col: 'housing_amount' },
    instructor:  { cat: 'role',        seg: 'instructor', col: 'instructor_pay' },
    examiner:    { cat: 'role',        seg: 'examiner',   col: 'examiner_pay' },
    union:       { cat: 'role',        seg: 'union',      col: 'union_pay' },
    management:  { cat: 'role',        seg: 'management', col: 'management_pay' },
    nonline:     { cat: 'role',        seg: 'nonline',    col: 'nonline_pay' },
    flight:      { cat: 'variable',    seg: 'flight',     col: 'flight_variable_pay' },
    other:       { cat: 'allowance',   seg: 'other',      col: 'other_allowance' },
    transport:   { cat: 'allowance',   seg: 'transport',  col: 'transport' },
    perdiem:     { cat: 'allowance',   seg: 'perdiem',    col: 'per_diem' },
    bonus_month: { cat: 'bonus',       seg: 'bonus',      col: 'bonus_month' },
    profit:      { cat: 'bonus',       seg: null,         col: null },          // 明細に印字されたプロフィットシェア（列は年額なので行だけ）
    notional:    { cat: 'noncash',     seg: null,         col: null },          // 現物給与の課税評価（航空券課税など）
    absence:     { cat: 'adjustment',  seg: null,         col: 'absence_total' }, // 不就労減額（マイナス）
    unexplained: { cat: 'unexplained', seg: 'rest',       col: null }           // 総支給 − 分かっている分
  };
  var KIND_ORDER = Object.keys(KINDS);
  var LAG_CAT = { variable: 1, role: 1, allowance: 1 };   // スケジュールの「明細に出る月」で結ぶ区分（分析の「いつの勤務の分？」と同じ）
  var CAT_ORDER = ['fixed', 'role', 'variable', 'allowance', 'bonus', 'noncash', 'adjustment', 'unexplained'];
  var CATEGORIES = CAT_ORDER.map(function (c) {
    return { k: c, kinds: KIND_ORDER.filter(function (k) { return KINDS[k].cat === c; }) };
  });
  /* segments() の known に入る種類（総支給の欄がある行の「分かっている分」） */
  var KNOWN_KINDS = ['base', 'guarantee', 'command', 'instructor', 'examiner', 'union', 'management', 'nonline', 'flight', 'other', 'housing', 'transport', 'perdiem', 'bonus_month'];
  /* 明細の読み取り（payslip_detail.earnings）の kind → こちらの種類（payslip.js の KIND_FIELD と同じ行き先） */
  var DETAIL_KIND = { base: 'base', guarantee: 'guarantee', command: 'command', housing: 'housing', per_diem: 'perdiem', transport: 'transport', instructor: 'instructor', examiner: 'examiner', flight_variable: 'flight', other: 'other', bonus: 'other' };
  /* 変動給の種類 → 同じ明細の数量（my-year.js の BASIS_Q と同じ対応。片方だけ直さない） */
  var BASIS_QTY = { block: 'block', duty: 'duty', night: 'night', sector: 'sectors' };
  var QTY_UNIT = { block: 'min', duty: 'min', night: 'min', credit: 'min', guarantee: 'min', sectors: 'count', dutyDays: 'day', stay: 'night', daysOff: 'day' };

  /* ── サーバの判定の写し（行に無いときだけ使う）────────────── */
  function unionOutside(items) { var u = items && obj(items.union); return !!(u && u.extra === 'yes' && u.source === 'union'); }
  function perdiemOutside(items) { return !!(items && items.per_diem_src === 'outside'); }
  function absenceRows(items) {
    return arr(items && items.absence).filter(function (e) { return e && /^-?[0-9]+(\.[0-9]+)?$/.test(String(e.amount)); });
  }

  /* ════ 明細1枚 → 行 ═════════════════════════════════════════ */
  function linesOf(r) {
    r = r || {};
    var V = viz();
    var cur = String(r.currency || '').toUpperCase() || null;
    var d = minorDigits(cur);
    var M = function (v) { return toMinor(v, cur); };
    var items = obj(r.pay_items) || {}, detail = obj(r.payslip_detail) || {};
    var y = num(r.period_year), mo = num(r.period_month), ym = ymOf(y, mo);
    var uo = (typeof r.union_outside_gross === 'boolean') ? r.union_outside_gross : unionOutside(items);
    var po = (typeof r.perdiem_outside_gross === 'boolean') ? r.perdiem_outside_gross : perdiemOutside(items);
    var absRows = absenceRows(items);
    var absMinor = num(r.absence_total) != null ? Math.abs(M(r.absence_total))
      : sum(absRows.map(function (e) { return Math.abs(M(e.amount)); }));

    var gm = M(r.gross_monthly), net = M(r.net_pay_actual), ded = M(r.deduction_total);
    var anchor = gm != null ? gm : (net != null && ded != null ? net + ded : null);
    var anchorBasis = gm != null ? 'gross_monthly' : anchor != null ? 'net+deductions' : null;
    var g = V.grossOrig(r);
    var gross = g == null ? null : M(g);
    var grossBasis = (num(r.net_pay_actual) != null && num(r.deduction_total) != null) ? 'net+deductions'
      : (gm != null ? 'gross_monthly' : (gross != null ? 'derived' : null));

    var lines = [], seq = 0, flags = {};
    function push(o) {
      var kd = KINDS[o.kind];
      var l = {
        id: (ym || '?') + '#' + (seq++), ym: ym, kind: o.kind, cat: kd.cat,
        labelKey: o.labelKey, label: o.label == null ? null : String(o.label),
        basis: o.basis || null, amount: o.amount, source: o.source,
        remainder: !!o.remainder,
        cash: o.cash !== false, outsideGross: !!o.outsideGross,
        inGross: o.inGross != null ? o.inGross : !o.outsideGross,
        counted: o.counted !== false,
        workYm: null, offset: null, mapStatus: null, mapKey: null, ownPeriod: false, qtyKind: null
      };
      if (!l.counted) l.inGross = false;
      lines.push(l);
      return l;
    }
    /* 列の額を、明細の行（項目名つき）で割る。合計を超える組は使わない。足りない分は列の行（'k:'+種類）で残す */
    function column(kind, c, cands, extra) {
      extra = extra || {};
      var tried = false;
      for (var i = 0; i < cands.length; i++) {
        var S = cands[i];
        if (!S || !S.length) continue;
        tried = true;
        var s = sum(S.map(function (x) { return x.amount; }));
        var same = S.every(function (x) { return c >= 0 ? x.amount >= 0 : x.amount <= 0; });
        if (same && (c >= 0 ? s <= c : s >= c)) {
          S.forEach(function (x) {
            push({ kind: kind, labelKey: labelKey(x.label) || ('k:' + kind), label: x.label, basis: x.basis, amount: x.amount,
                   source: x.source, outsideGross: extra.outsideGross });
          });
          if (c - s !== 0) push({ kind: kind, labelKey: 'k:' + kind, amount: c - s, source: 'remainder', remainder: true, outsideGross: extra.outsideGross });
          return;
        }
      }
      var l = push({ kind: kind, labelKey: 'k:' + kind, amount: c, source: 'column', outsideGross: extra.outsideGross });
      if (tried) { l.detailMismatch = true; flags.detailMismatch = true; }
    }
    function detailOf(kinds) {
      return arr(detail.earnings).filter(function (e) { return e && kinds.indexOf(e.kind) >= 0 && M(e.amount) != null && e.label; })
        .map(function (e) { return { label: e.label, amount: M(e.amount), source: 'payslip_detail' }; });
    }
    function itemRows(k) {
      return arr(items[k]).filter(function (x) { return x && M(x.amount) != null; })
        .map(function (x) { return { label: x.label || null, basis: x.basis || null, amount: M(x.amount), source: 'pay_items' }; });
    }

    /* 変動給は「その他」の内訳（segments と同じ割り方。逆転していたら割らない） */
    var oth = num(r.other_allowance), fv = num(r.flight_variable_pay);
    var split = (fv || 0) > 0 && (fv || 0) <= (oth || 0);
    if (fv != null && fv > 0 && !split) flags.fvUnsplit = true;
    var col = {
      base: M(r.base_pay), guarantee: M(r.guarantee_pay), command: M(r.command_pay),
      housing: r.housing_type === 'allowance' ? M(r.housing_amount) : null,
      instructor: M(r.instructor_pay), examiner: M(r.examiner_pay), union: M(r.union_pay),
      management: M(r.management_pay), nonline: M(r.nonline_pay),
      flight: split ? M(fv) : (fv === 0 ? 0 : null),
      other: oth != null ? M(oth) - (split ? M(fv) : 0) : null,
      transport: M(r.transport), perdiem: M(r.per_diem),
      bonus_month: anchor != null ? M(r.bonus_month) : null
    };
    var varRows = itemRows('variable');
    var othRows = itemRows('other');
    var othDet = detailOf(['other', 'bonus']).filter(function (e) {
      return !othRows.some(function (o) { return labelKey(o.label) === labelKey(e.label) && Math.round(fromMinor(o.amount, cur)) === Math.round(fromMinor(e.amount, cur)); });
    });
    var CANDS = {
      flight: [varRows.length ? varRows : detailOf(['flight_variable'])],
      other: [othRows.concat(othDet), othRows]
    };
    KNOWN_KINDS.forEach(function (k) {
      var c = col[k];
      if (c == null) return;
      var cands = CANDS[k] || [detailOf(Object.keys(DETAIL_KIND).filter(function (dk) { return DETAIL_KIND[dk] === k && dk !== 'bonus'; }))];
      column(k, c, cands, { outsideGross: (k === 'union' && uo) || (k === 'perdiem' && po) });
    });

    var known = sum(KNOWN_KINDS.map(function (k) { return col[k] || 0; }));
    var outside = sum(lines.filter(function (l) { return l.outsideGross; }).map(function (l) { return l.amount; }));
    var unexplained = null, overGross = null, carved = 0;

    if (anchor != null) {
      if (absMinor > 0) {
        column('absence', -absMinor, [absRows.map(function (e) { return { label: e.label || null, amount: -Math.abs(M(e.amount)), source: 'pay_items' }; })]);
      }
      /* segments の rest と同じ式：総支給 ＋ 総支給の外 ＋ 不就労減額 − 分かっている分 */
      var rest = anchor + outside + absMinor - known;
      if (rest < 0) { overGross = -rest; flags.overGross = true; }
      else {
        /* 印字の総支給に入っているはずの非現金・年額の行を、残りに収まるときだけ切り出す（二重に数えない） */
        ['notional', 'profit'].forEach(function (k) {
          detailOf([k]).forEach(function (e) {
            if (e.amount > 0 && e.amount <= rest) {
              push({ kind: k, labelKey: labelKey(e.label), label: e.label, amount: e.amount, source: 'payslip_detail', cash: k !== 'notional' }).carve = true;
              rest -= e.amount; carved += e.amount;
            } else if (e.amount !== 0) {
              push({ kind: k, labelKey: labelKey(e.label), label: e.label, amount: e.amount, source: 'payslip_detail', cash: k !== 'notional', counted: false });
            }
          });
        });
        unexplained = rest;
        if (rest > 0) push({ kind: 'unexplained', labelKey: 'k:unexplained', amount: rest, source: 'remainder', remainder: true });
      }
    } else {
      /* 総支給の欄が無い行：比べる相手が無い＝残りは出さない。非現金・年額の行は数えずに見せるだけ */
      ['notional', 'profit'].forEach(function (k) {
        detailOf([k]).forEach(function (e) {
          if (e.amount !== 0) push({ kind: k, labelKey: labelKey(e.label), label: e.label, amount: e.amount, source: 'payslip_detail', cash: k !== 'notional', counted: false });
        });
      });
    }

    /* 同じ明細に印字された数量（分・回・日）。列が先、無ければ明細の読み取り */
    var qty = {}, qtySrc = {};
    var HOUR_COL = { block: 'block_hours', duty: 'duty_hours', night: 'night_hours', credit: 'credit_hours', guarantee: 'guaranteed_hours' };
    var CNT_COL = { sectors: 'sectors', dutyDays: 'duty_days', stay: 'stay_nights', daysOff: 'days_off' };
    Object.keys(HOUR_COL).forEach(function (k) {
      var v = hoursToMin(r[HOUR_COL[k]]);
      if (v != null) { qty[k] = v; qtySrc[k] = 'column'; return; }
      var h = arr(detail.hours).filter(function (x) { return x && x.kind === k && num(x.value) != null; });
      if (h.length === 1) { qty[k] = hoursToMin(h[0].value); qtySrc[k] = 'payslip_detail'; }
      else qty[k] = null;
    });
    Object.keys(CNT_COL).forEach(function (k) { var v = num(r[CNT_COL[k]]); qty[k] = v == null ? null : Math.round(v); if (v != null) qtySrc[k] = 'column'; });
    /* 役割の数量（pay_items の役割の札） */
    var roleQty = {};
    [['instructor', 'qty'], ['examiner', 'qty'], ['union', 'days'], ['management', 'days'], ['nonline', 'days']].forEach(function (p) {
      var o = obj(items[p[0]]), v = o ? num(o[p[1]]) : null;
      if (v != null) roleQty[p[0]] = { value: v, unit: p[1] === 'days' ? 'day' : (o.method ? String(o.method) : 'count') };
    });

    return {
      ym: ym, y: y, m: mo, idx: ymIdx(ym), currency: cur, d: d, fx_to_jpy: num(r.fx_to_jpy),
      gross: gross, grossBasis: grossBasis, anchor: anchor, anchorBasis: anchorBasis,
      net: net, deductions: ded, lines: lines, known: known, outside: outside, absence: absMinor,
      unexplained: unexplained, overGross: overGross, carved: carved,
      received: gross != null ? gross + outside : null,
      qty: qty, qtySrc: qtySrc, roleQty: roleQty,
      bonusAnnual: M(r.bonus_annual), profitAnnual: M(r.profit_share_annual),
      flags: flags
    };
  }

  /* ════ ロスター ════════════════════════════════════════════ */
  var LEG_KINDS = ['operating', 'deadhead', 'ground', 'unknown'];
  var CLASSES = { off: 1, vac: 1, duty: 1, standby: 1, training: 1, ground: 1, other: 1, unknown: 1 };
  /* parse-roster の日の種類（DAY_CATS の写し）。'blank'・'unclear' は「分からない」。 */
  var DAY_CATS = ['off', 'leave', 'standby', 'training', 'ground', 'sick', 'duty', 'other', 'blank', 'unclear'];
  function catKnown(c) { return DAY_CATS.indexOf(c) >= 0 && c !== 'blank' && c !== 'unclear'; }
  function up(s) { return (s == null || s === '') ? null : String(s).trim().toUpperCase() || null; }
  /* 勤務コード。英字の記号は大文字に。辞書に無い言葉の札（'#'＋小文字16桁・parse-roster の TOKEN_RE）は小文字のまま
     （大文字にすると別の札になる＝本人が教えた意味と結べない）。ほかの記号と同じに扱う（profile.codes で意味を引く・
     意味が無ければ unclassifiedCodes に出して1回だけ聞く）。 */
  var TOKEN_RX = /^#[0-9a-f]{16}$/i;
  function codeUp(s) {
    if (s == null || s === '') return null;
    var t = String(s).trim();
    return TOKEN_RX.test(t) ? t.toLowerCase() : (t.toUpperCase() || null);
  }
  function normCodes(c) {
    var o = obj(c) || {}, out = {};
    Object.keys(o).forEach(function (k) { var kk = codeUp(k); if (kk && CLASSES[o[k]]) out[kk] = o[k]; });
    return out;
  }
  /* ★2026-11-11 オーナー「Local タイムでも計算されるようにしてよ」── 時刻が現地時刻のときは、出発地と到着地の
       タイムゾーン（pv-airport-tz.js・IATA → IANA）でそれぞれ UTC に直して引く。夏時間も Intl が持つ。
       空港のどちらかが表に無い・日付が無いときは出さない（推測しない）。 */
  var tzFmt = {};
  function tzOff(tz, ms) {                       // その瞬間の tz の UTC からのずれ（分）
    var f = tzFmt[tz];
    if (!f) {
      try { f = tzFmt[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }); }
      catch (e) { return null; }
    }
    var p = {};
    f.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - ms) / 60000);
  }
  function localMs(date, min, tz) {              // その日の現地の min 分 → UTC のミリ秒
    var g = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) + min * 60000;
    var o = tzOff(tz, g);
    if (o == null) return null;
    var t = g - o * 60000, o2 = tzOff(tz, t);
    return o2 != null && o2 !== o ? g - o2 * 60000 : t;
  }
  function airTz(code) { var f = w.PV_AIRPORT_TZ; return code && typeof f === 'function' ? f(code) : null; }
  function legOf(L, profile, date) {
    var out = L.out != null ? L.out : L.t_out, inn = L.in != null ? L.in : L.t_in;
    var o = clockMin(out), i = clockMin(inn), inDay = num(L.in_day) || 0;
    var printed = L.block != null ? durMin(L.block) : (L.block_min != null ? durMin(num(L.block_min)) : null);
    var b = printed, src = printed != null ? 'printed' : null;
    /* 印字が無いときだけ時刻から。UTC と答えてあればそのまま引く */
    if (b == null && o != null && i != null && profile && profile.time_ref === 'utc') {
      var v = inDay * 1440 + i - o;
      if (v > 0 && v < 1440) { b = v; src = 'times'; }
    }
    /* 現地時刻（と答えた・まだ答えていない）：両方の空港のタイムゾーンが分かれば UTC に直して引く。
       ★答えていないときは、出発地と到着地が同じタイムゾーンの便だけ（UTC でも現地でも差は同じ＝取り違えても狂わない） */
    if (b == null && o != null && i != null && isDate(date) && !(profile && profile.time_ref === 'utc')) {
      var tf = airTz(up(L.from != null ? L.from : L.orig)), tt = airTz(up(L.to != null ? L.to : L.dest));
      if (tf && tt && ((profile && profile.time_ref === 'local') || tf === tt)) {
        var a0 = localMs(date, o, tf), a1 = localMs(date, inDay * 1440 + i, tt);
        if (a0 != null && a1 != null) {
          var v2 = Math.round((a1 - a0) / 60000);
          if (v2 > 0 && v2 < 1440) { b = v2; src = 'local'; }
        }
      }
    }
    var kind = LEG_KINDS.indexOf(L.kind) >= 0 ? L.kind : 'unknown';
    return {
      seq: num(L.seq), flight: up(L.flight), from: up(L.from != null ? L.from : L.orig), to: up(L.to != null ? L.to : L.dest),
      loc: up(L.loc), out: o == null ? null : hhmm(o), in: i == null ? null : hhmm(i), inDay: inDay,
      blockMin: b, blockSrc: src, kind: kind,
      page: num(L.page), row: num(L.row)
    };
  }
  function dayOf(D, profile, codes) {
    if (!D || !isDate(D.date)) return null;
    var code = codeUp(D.code), cls = code ? (codes[code] || null) : null;
    var on = clockMin(D.d_on), off = clockMin(D.d_off), offDay = num(D.d_off_day) || 0;
    var el = elapsed(D.date, on, off == null ? null : offDay * 1440 + off, profile);
    var legs = arr(D.legs).map(function (L) { return legOf(L || {}, profile, D.date); })
      .sort(function (a, b) { return (a.seq == null ? 1e9 : a.seq) - (b.seq == null ? 1e9 : b.seq); });
    var block = {}, blockKnown = {}, blockGaps = {}, n = {};
    LEG_KINDS.forEach(function (k) {
      var ls = legs.filter(function (l) { return l.kind === k; });
      n[k] = ls.length;
      var known = ls.filter(function (l) { return l.blockMin != null; });
      blockKnown[k] = sum(known.map(function (l) { return l.blockMin; }));
      blockGaps[k] = ls.length - known.length;
      block[k] = blockGaps[k] ? null : blockKnown[k];
    });
    var hasDuty = (on != null && off != null) || legs.length > 0;
    var isDuty = hasDuty && cls !== 'off' && cls !== 'vac';
    return {
      date: D.date, ym: D.date.slice(0, 7), code: code, cls: cls, dOn: on == null ? null : hhmm(on), dOff: off == null ? null : hhmm(off), dOffDay: offDay,
      dutyMin: isDuty ? el.min : null, elapsedBasis: el.basis, invalidTimes: !!el.invalid,
      legs: legs, blockMin: block, blockKnown: blockKnown, blockGaps: blockGaps,
      sectors: n.operating, dhLegs: n.deadhead, groundLegs: n.ground, unknownLegs: n.unknown,
      isDuty: isDuty, hasDh: n.deadhead > 0, docId: D.doc_id || null, page: num(D.page), row: num(D.row)
    };
  }
  /* その日（その写り）に中身があるか ── 勤務コード・D-ON/OFF・中身のある区間のどれか（2026-11-09）。
     日付だけが印字されていて何も読めなかった日（空欄）は、データではない＝覆った日に数えない */
  var LEG_HAS = ['flight', 'from', 'to', 'orig', 'dest', 'loc', 'out', 'in', 't_out', 't_in', 'block', 'block_min'];
  function legHas(L) {
    L = L || {};
    for (var i = 0; i < LEG_HAS.length; i++) { var v = L[LEG_HAS[i]]; if (v != null && v !== '') return true; }
    return false;
  }
  function dayHas(D) {
    return !!(D && (codeUp(D.code) || clockMin(D.d_on) != null || clockMin(D.d_off) != null || arr(D.legs).some(legHas)));
  }
  /* 空欄（blank）・中身の無い日は数えない（保存もしない）。
     ★読めなかった日（unread＝勤務コードだけ読めなかった）でも、区間か D-ON/OFF があれば空ではない（2026-11-11。
       読めなかった日がまるごと空欄で残っていた）。記号が無いことは、日の時刻・区間を捨てる理由にならない。 */
  function dayEmpty(D) { return !D || D.blank === true || !dayHas(D); }

  /* 暦の月ごと。勤務は D-ON の日（勤務日）の月に数える（日付をまたいでも分けない）。
     値は「その月を全部覆い、欠けも無い」ときだけ出す。欠けがあれば null、分かった分は partial に */
  function rosterMonths(days, profile) {
    profile = profile || {};
    var codes = normCodes(profile.codes), byDate = {};
    arr(days).forEach(function (D) { if (dayEmpty(D)) return; var x = dayOf(D, profile, codes); if (x) byDate[x.date] = x; });
    var dates = Object.keys(byDate).sort(), byYm = {}, order = [];
    dates.forEach(function (dt) { var x = byDate[dt]; if (!byYm[x.ym]) { byYm[x.ym] = []; order.push(x.ym); } byYm[x.ym].push(x); });
    return order.map(function (ym) {
      var ds = byYm[ym], dim = daysIn(ym), complete = ds.length === dim;
      var duty = ds.filter(function (x) { return x.isDuty; });
      var dutyKnown = sum(duty.filter(function (x) { return x.dutyMin != null; }).map(function (x) { return x.dutyMin; }));
      var dutyGaps = duty.filter(function (x) { return x.dutyMin == null; }).length;
      var bK = {}, bG = {}, bS = {};
      LEG_KINDS.forEach(function (k) {
        bK[k] = sum(ds.map(function (x) { return x.blockKnown[k]; }));
        bG[k] = sum(ds.map(function (x) { return x.blockGaps[k]; }));
        bS[k] = (complete && !bG[k]) ? bK[k] : null;
      });
      var cnt = function (f) { return ds.filter(f).length; };
      var classCounts = {}, unclassified = [];
      ds.forEach(function (x) {
        var c = x.cls || (x.code ? 'unclassified' : 'none');
        classCounts[c] = (classCounts[c] || 0) + 1;
        if (x.code && !x.cls && unclassified.indexOf(x.code) < 0) unclassified.push(x.code);
      });
      var partial = {
        dutyMin: dutyKnown, blockMin: bK,
        sectors: sum(ds.map(function (x) { return x.sectors; })), dhLegs: sum(ds.map(function (x) { return x.dhLegs; })),
        groundLegs: sum(ds.map(function (x) { return x.groundLegs; })), unknownLegs: sum(ds.map(function (x) { return x.unknownLegs; })),
        dutyDays: duty.length, vacDays: cnt(function (x) { return x.cls === 'vac'; }), offDays: cnt(function (x) { return x.cls === 'off'; })
      };
      var basis = {};
      duty.forEach(function (x) { if (x.elapsedBasis) basis[x.elapsedBasis] = (basis[x.elapsedBasis] || 0) + 1; });
      var S = function (v) { return complete ? v : null; };
      return {
        ym: ym, daysInMonth: dim, coveredDays: ds.length, complete: complete,
        dutyMin: (complete && !dutyGaps) ? dutyKnown : null,
        blockMin: bS,
        sectors: S(partial.sectors), dhLegs: S(partial.dhLegs), groundLegs: S(partial.groundLegs), unknownLegs: S(partial.unknownLegs),
        dutyDays: S(partial.dutyDays), vacDays: S(partial.vacDays), offDays: S(partial.offDays),
        partial: partial, gaps: { duty: dutyGaps, block: bG },
        classCounts: classCounts, unclassifiedCodes: unclassified,
        timeRef: profile.time_ref || null, elapsedBasis: basis,
        days: ds
      };
    });
  }

  /* ════ 分割スクショをつなぐ ════════════════════════════════
     pages は本人が並べた順。同じ日は1回だけ。値がぶつかったら「切れていない写り → 区間の多い写り → 先の写り」を採り、
     issues に残す（画面が本人に聞く）。時刻も区間も作らない。 */
  var ID_F = ['flight', 'from', 'to', 'loc', 'out'];
  function normLegP(L) {
    var o = clockMin(L.out), i = clockMin(L.in), b = durMin(L.block);
    return {
      seq: num(L.seq), flight: up(L.flight), from: up(L.from), to: up(L.to), loc: up(L.loc),
      out: o == null ? null : hhmm(o), in: i == null ? null : hhmm(i), in_day: num(L.in_day) || 0,
      block: b == null ? null : Math.floor(b / 60) + ':' + pad2(b % 60),
      kind: LEG_KINDS.indexOf(L.kind) >= 0 ? L.kind : 'unknown',
      partial: L.partial === true, page: num(L.page), row: num(L.row)
    };
  }
  function legEmpty(l) { return !l.flight && !l.from && !l.to && !l.loc && !l.out && !l.in && !l.block; }
  function legMatch(a, b) {
    var eq = 0;
    for (var i = 0; i < ID_F.length; i++) {
      var f = ID_F[i];
      if (a[f] != null && b[f] != null) { if (a[f] !== b[f]) return -1; eq++; }
    }
    if ((a.kind === 'ground') !== (b.kind === 'ground') && a.kind !== 'unknown' && b.kind !== 'unknown') return -1;
    if (!eq && a.in != null && b.in != null && a.in === b.in && a.in_day === b.in_day) eq = 1;   // 同じ印が1つも無いときだけ着時刻で
    return eq;
  }
  function mergePages(pages) {
    var occ = {}, dates = [], issues = [];
    arr(pages).forEach(function (p, pi) {
      arr(p && p.days).forEach(function (d, di) {
        if (!d || !isDate(d.date)) return;
        if (!occ[d.date]) { occ[d.date] = []; dates.push(d.date); }
        /* empty：空欄の写り（記号・時刻・区間のどれも無い）。中身のある写りがあれば、そちらだけでつなぐ（「何も無い」と値はぶつけない）。
           ★記号だけ読めなかった写り（unread）でも、時刻・区間があれば中身のある写り（2026-11-11） */
        occ[d.date].push({ pi: pi, di: di, d: d, empty: !dayHas(d) });
      });
    });
    dates.sort();
    var cutOf = function (o) { var c = o.d.cut; return (c === 'top' || c === 'bottom' || c === 'both') ? c : null; };
    var days = dates.map(function (date) {
      var all = occ[date], real = all.filter(function (o) { return !o.empty; });
      var os = real.length ? real : all;
      var pref = os.slice().sort(function (x, y) {
        return ((cutOf(x) ? 1 : 0) - (cutOf(y) ? 1 : 0)) || (arr(y.d.legs).length - arr(x.d.legs).length) || (x.pi - y.pi) || (x.di - y.di);
      });
      var out = { date: date };
      function field(name, val) {
        var seen = [], chosen = null;
        os.forEach(function (o) { var v = val(o.d); if (v != null && seen.indexOf(v) < 0) seen.push(v); });
        for (var i = 0; i < pref.length; i++) { var v = val(pref[i].d); if (v != null) { chosen = v; break; } }
        if (seen.length > 1) issues.push({ date: date, type: 'conflict', field: name, values: seen });
        return chosen;
      }
      out.code = field('code', function (d) { return codeUp(d.code); });
      /* 日の種類：記号を採った写りの読めた種類 → つなぐ写りの読めた種類（採る順）→ ほかの写り → unclear → blank → null */
      var catSrc = null, cat = null;
      if (out.code) for (var ci = 0; ci < pref.length; ci++) if (codeUp(pref[ci].d.code) === out.code) { catSrc = pref[ci]; break; }
      if (catSrc && catKnown(catSrc.d.cat)) cat = catSrc.d.cat;
      [pref, all].forEach(function (list) { list.forEach(function (o) { if (!cat && catKnown(o.d.cat)) cat = o.d.cat; }); });
      if (!cat) cat = all.some(function (o) { return o.d.cat === 'unclear'; }) ? 'unclear' : all.some(function (o) { return o.d.cat === 'blank'; }) ? 'blank' : null;
      out.cat = cat;
      var on = field('d_on', function (d) { var m = clockMin(d.d_on); return m == null ? null : hhmm(m); });
      var offK = field('d_off', function (d) { var m = clockMin(d.d_off); return m == null ? null : hhmm(m) + '+' + (num(d.d_off_day) || 0); });
      out.d_on = on;
      out.d_off = offK ? offK.split('+')[0] : null;
      out.d_off_day = offK ? +offK.split('+')[1] : 0;
      /* 切れ：どの写りにも上（下）が無いときだけ欠けたまま */
      var noTop = os.every(function (o) { var c = cutOf(o); return c === 'top' || c === 'both'; });
      var noBot = os.every(function (o) { var c = cutOf(o); return c === 'bottom' || c === 'both'; });
      out.cut = noTop && noBot ? 'both' : noTop ? 'top' : noBot ? 'bottom' : null;
      if (out.cut) issues.push({ date: date, type: 'incomplete', cut: out.cut });
      var start = os.filter(function (o) { var c = cutOf(o); return c !== 'top' && c !== 'both'; })[0] || os[0];
      out.page = num(start.d.page); out.row = num(start.d.row);
      /* 区間：写りをまたいで和集合。欠けた欄は他の写りから埋める。発時刻が違えば別の区間 */
      var merged = [];
      pref.forEach(function (o, oi) {
        var prev = null;
        arr(o.d.legs).slice().sort(function (a, b) { return (num(a.seq) || 0) - (num(b.seq) || 0); }).forEach(function (L) {
          var nl = normLegP(L || {});
          if (legEmpty(nl)) return;
          var best = null, bestEq = 0, tie = false;
          merged.forEach(function (m) {
            if (m.occ[oi]) return;
            var e = legMatch(m.leg, nl);
            if (e > bestEq) { best = m; bestEq = e; tie = false; } else if (e > 0 && e === bestEq) tie = true;
          });
          if (best && tie) issues.push({ date: date, type: 'ambiguous_leg', flight: nl.flight, out: nl.out });
          if (best) {
            var m = best.leg;
            ['flight', 'from', 'to', 'loc', 'out', 'block'].forEach(function (f) {
              if (m[f] == null && nl[f] != null) m[f] = nl[f];
              else if (m[f] != null && nl[f] != null && m[f] !== nl[f]) issues.push({ date: date, type: 'conflict', field: 'leg.' + f, leg: { flight: m.flight, out: m.out }, values: [m[f], nl[f]] });
            });
            if (m.in == null && nl.in != null) { m.in = nl.in; m.in_day = nl.in_day; }
            else if (m.in != null && nl.in != null && (m.in !== nl.in || m.in_day !== nl.in_day)) issues.push({ date: date, type: 'conflict', field: 'leg.in', leg: { flight: m.flight, out: m.out }, values: [m.in + '+' + m.in_day, nl.in + '+' + nl.in_day] });
            if (m.kind === 'unknown' && nl.kind !== 'unknown') m.kind = nl.kind;
            else if (m.kind !== 'unknown' && nl.kind !== 'unknown' && m.kind !== nl.kind) issues.push({ date: date, type: 'conflict', field: 'leg.kind', leg: { flight: m.flight, out: m.out }, values: [m.kind, nl.kind] });
            best.occ[oi] = 1;
            best.allPartial = best.allPartial && nl.partial;
            prev = best;
          } else {
            var ent = { leg: nl, occ: {}, allPartial: nl.partial, after: prev, n: merged.length };
            ent.occ[oi] = 1;
            merged.push(ent);
            prev = ent;
          }
        });
      });
      /* 並べ直し：発時刻（D-ON より前の時刻は翌日）→ 無ければ着時刻 − 区間時間 → 無ければ前の区間の直後 */
      var dOn = clockMin(on);
      merged.forEach(function (e) {
        var l = e.leg, t = null, o = clockMin(l.out), i = clockMin(l.in), b = durMin(l.block);
        if (o != null) t = (dOn != null && o < dOn) ? o + 1440 : o;
        else if (i != null) t = i + 1440 * (l.in_day || 0) - (b || 0);
        if (t != null && dOn == null && e.after && e.after.key != null) { while (t < e.after.key) t += 1440; }
        if (t == null) t = (e.after && e.after.key != null) ? e.after.key + 0.5 : -1;
        e.key = t;
      });
      merged.sort(function (a, b) { return (a.key - b.key) || (a.n - b.n); });
      out.legs = merged.map(function (e, i) {
        var l = e.leg;
        /* 切れた写りどうしでも、埋め合わせて発・着・区間時間がそろえば欠けではない */
        var whole = l.out != null && l.in != null && (l.block != null || l.kind === 'ground');
        var partial = e.allPartial && !whole;
        if (partial) issues.push({ date: date, type: 'partial_leg', seq: i + 1 });
        return { seq: i + 1, flight: l.flight, from: l.from, to: l.to, loc: l.loc, out: l.out, in: l.in, in_day: l.in_day,
                 block: l.block, kind: l.kind, partial: partial, page: l.page, row: l.row };
      });
      /* 記号を読めなかった日（どれかの写りが unread と言い、どの写りからも記号が採れなかった）：時刻・区間は残して印を付ける。
         どの写りにも中身が無い日は、日付だけ残して印を付ける（データではない・保存しない・本人に聞く） */
      if (!out.code && all.some(function (o) { return o.d.unread === true; })) out.unread = true;
      if (!dayHas(out)) out.blank = true;
      return out;
    });
    /* 期間と印（全部の写りで同じときだけ） */
    var froms = [], tos = [], hints = { kind: null, time_ref: null };
    arr(pages).forEach(function (p) { var pr = p && obj(p.period); if (pr && isDate(pr.from)) froms.push(pr.from); if (pr && isDate(pr.to)) tos.push(pr.to); });
    ['kind', 'time_ref'].forEach(function (k) {
      var vs = [];
      arr(pages).forEach(function (p) { var h = p && obj(p.hints), v = h ? h[k] : null; if (v != null && vs.indexOf(v) < 0) vs.push(v); });
      if (vs.length === 1) hints[k] = vs[0];
      else if (vs.length > 1) issues.push({ type: 'conflict', field: 'hints.' + k, values: vs });
    });
    froms.sort(); tos.sort();
    return { days: days, issues: issues, hints: hints, period: froms.length && tos.length ? { from: froms[0], to: tos[tos.length - 1] } : null };
  }

  /* ════ 明細の乗務時間 ⇄ ロスター：同じ月か前の月か ═══════════════
     ぴったり（既定 0 分・tolerance で広げられる）のときだけ候補。両方そろえば ambiguous。作らない。 */
  function rmIndex(rms) {
    if (rms && !Array.isArray(rms)) return rms;
    var o = {}; arr(rms).forEach(function (m) { if (m && m.ym) o[m.ym] = m; }); return o;
  }
  function alignCandidates(payRows, rms, opts) {
    opts = opts || {};
    var tol = isNum(opts.tolerance) ? Math.max(0, opts.tolerance) : 0;
    var kinds = arr(opts.kinds).length ? opts.kinds : ['operating'];
    var by = rmIndex(rms);
    return arr(payRows).map(function (p) {
      var ym = p.ym || ymOf(num(p.period_year), num(p.period_month));
      var slip = p.qty ? p.qty.block : hoursToMin(p.block_hours);
      var compare = [0, -1, -2].map(function (off) {      // ★2026-11-11 翌々月払いもある（同じ月・前の月・前々月）
        var wy = ymAdd(ym, off), rm = by[wy], v = null;
        if (rm) { v = 0; kinds.forEach(function (k) { var x = rm.blockMin && rm.blockMin[k]; v = (v == null || x == null) ? null : v + x; }); }
        var diff = (slip != null && v != null) ? slip - v : null;
        return { offset: off, ym: wy, rosterBlockMin: v, complete: !!(rm && rm.complete), diffMin: diff, equal: diff != null && Math.abs(diff) <= tol };
      });
      var eq = compare.filter(function (c) { return c.equal; });
      return {
        ym: ym, slipBlockMin: slip, compare: compare,
        candidate: eq.length === 1 ? eq[0].offset : null, ambiguous: eq.length > 1,
        reason: slip == null ? 'no_slip_block' : !compare.some(function (c) { return c.rosterBlockMin != null; }) ? 'no_roster' : eq.length ? null : 'no_match'
      };
    });
  }

  /* ════ 模型 ═══════════════════════════════════════════════
     reports = my_pay_reports() の行、items = my_report_items() の行（pay_items / payslip_detail）、
     maps = my_report_items().maps、roster = { days, profile }（my_roster）。
     会社は1つにしぼる（契約が違う月を比べない）。既定は最新の支給月の会社。 */
  function rowKey(r) { return (r.airline || '') + '|' + String(r.airline_other || '').toLowerCase() + '|' + num(r.period_year) + '|' + num(r.period_month); }
  function coKey(r) { return (r.airline || '') + '|' + String(r.airline_other || '').toLowerCase(); }
  function lookupMap(dict, ym, l) {
    var keys = [mapKey(ym, l.labelKey), l.labelKey, mapKey(ym, 'k:' + l.kind), 'k:' + l.kind];
    for (var i = 0; i < keys.length; i++) if (dict[keys[i]]) return { key: keys[i], m: dict[keys[i]] };
    return null;
  }
  function build(input) {
    input = input || {};
    var byKey = {}, order = [];
    arr(input.reports).forEach(function (r) { if (!r) return; var k = rowKey(r); if (!byKey[k]) order.push(k); byKey[k] = Object.assign({}, r); });
    arr(input.items).forEach(function (it) {
      if (!it) return;
      var k = rowKey(it);
      if (!byKey[k]) { order.push(k); byKey[k] = {}; }
      var t = byKey[k];
      Object.keys(it).forEach(function (f) { if (t[f] == null || f === 'pay_items' || f === 'payslip_detail') t[f] = it[f]; });
    });
    var rows = order.map(function (k) { return byKey[k]; }).filter(function (r) { return num(r.period_year) && num(r.period_month); });
    rows.forEach(function (r) {
      var items = obj(r.pay_items);
      if (typeof r.union_outside_gross !== 'boolean') r.union_outside_gross = unionOutside(items);
      if (typeof r.perdiem_outside_gross !== 'boolean') r.perdiem_outside_gross = perdiemOutside(items);
      if (num(r.absence_total) == null && items) r.absence_total = sum(absenceRows(items).map(function (e) { return Math.abs(num(e.amount)); }));
    });
    var cos = {};
    rows.forEach(function (r) {
      var k = coKey(r), i = ymIdx(ymOf(num(r.period_year), num(r.period_month)));
      if (!cos[k]) cos[k] = { airline: r.airline || null, airline_other: r.airline_other || null, months: 0, last: -1 };
      cos[k].months++; if (i > cos[k].last) cos[k].last = i;
    });
    var coList = Object.keys(cos).map(function (k) { return cos[k]; }).sort(function (a, b) { return b.last - a.last; });
    var want = input.airline != null ? coKey({ airline: input.airline, airline_other: input.airlineOther }) : (coList[0] ? coKey(coList[0]) : null);
    var sel = cos[want] || null;

    var months = rows.filter(function (r) { return coKey(r) === want; }).map(function (r) { var x = linesOf(r); x.row = r; return x; })
      .sort(function (a, b) { return a.idx - b.idx; });

    var dict = {};
    arr(input.maps).forEach(function (m) {
      if (!m || coKey(m) !== want || !m.label_key) return;
      var st = m.status === 'confirmed' || m.status === 'unknown' || m.status === 'other' ? m.status : null;
      if (!st) return;
      dict[String(m.label_key).slice(0, 80)] = { offset: isNum(m.offset) ? m.offset : num(m.offset), status: st, qtyKind: m.qty_kind || null };
    });
    var offsets = {};
    months.forEach(function (mo) {
      mo.lines.forEach(function (l) {
        var hit = lookupMap(dict, mo.ym, l);
        if (!hit) return;
        l.mapKey = hit.key; l.mapStatus = hit.m.status; l.qtyKind = hit.m.qtyKind;
        if ((hit.m.status === 'confirmed' || hit.m.status === 'other') && hit.m.offset != null) {
          l.offset = hit.m.offset; l.workYm = ymAdd(mo.ym, hit.m.offset);
          /* 「まだ届いていない明細」を数えるのは、月を問わない確認済みの対応だけ（その月だけの調整・別の期間は除く） */
          if (hit.m.status === 'confirmed' && hit.key.indexOf('|') < 0) offsets[hit.m.offset] = 1;
        } else if (hit.m.status === 'other') l.ownPeriod = true;
      });
    });
    /* ★2026-11-11 スケジュールの取り込みで聞いた「飛んだ分は何か月あとの給与明細に出るか」（読み方の pay_lag：0〜2）。
         手当ごとの答え（上の dict）が無い 変動給・役割・手当 の行は、この答えで勤務の月に結ぶ。手当ごとの答えが優先。
         -1（わからない）と null（まだ聞いていない）は何もしない＝今までどおり手当ごとに聞く。 */
    var prof = input.roster && input.roster.profile, lag = prof && isNum(prof.pay_lag) && prof.pay_lag >= 0 && prof.pay_lag <= 2 ? prof.pay_lag : null;
    if (lag != null) {
      months.forEach(function (mo) {
        mo.lines.forEach(function (l) {
          var k = KINDS[l.kind];
          if (l.mapStatus || !k || !LAG_CAT[k.cat]) return;
          l.mapStatus = 'profile'; l.offset = -lag; l.workYm = ymAdd(mo.ym, -lag);
          offsets[-lag] = 1;
        });
      });
    }

    var R = input.roster || {};
    var rms = Array.isArray(R.months) ? R.months : rosterMonths(R.days, R.profile);
    var rIdx = rmIndex(rms);

    /* 勤務月ごと：その月に対応すると確認できた行だけ */
    var have = {}; months.forEach(function (m) { have[m.ym] = 1; });
    var work = {};
    months.forEach(function (mo) {
      mo.lines.forEach(function (l) {
        if (!l.workYm || !l.counted) return;
        var W = work[l.workYm] || (work[l.workYm] = { ym: l.workYm, lines: [], byCurrency: {}, fromPayMonths: [] });
        W.lines.push(l);
        var c = W.byCurrency[mo.currency] || (W.byCurrency[mo.currency] = { inGross: 0, outside: 0, cash: 0 });
        if (l.inGross) c.inGross += l.amount;
        if (l.outsideGross) c.outside += l.amount;
        if (l.cash) c.cash += l.amount;
        if (W.fromPayMonths.indexOf(mo.ym) < 0) W.fromPayMonths.push(mo.ym);
      });
    });
    var offs = Object.keys(offsets).map(Number);
    var workList = Object.keys(work).sort().map(function (k) {
      var W = work[k];
      W.fromPayMonths.sort();
      W.missingPayMonths = offs.map(function (o) { return ymAdd(k, -o); }).filter(function (p) { return !have[p]; }).sort();
      W.currencies = Object.keys(W.byCurrency);
      W.roster = rIdx[k] || null;
      return W;
    });

    var first = months[0], last = months[months.length - 1];
    var gaps = first ? ymRange(first.ym, last.ym).filter(function (ym) { return !have[ym]; }) : [];
    var currencies = []; months.forEach(function (m) { if (m.currency && currencies.indexOf(m.currency) < 0) currencies.push(m.currency); });

    return {
      v: VERSION,
      airline: sel ? sel.airline : null, airlineOther: sel ? sel.airline_other : null,
      airlines: coList.map(function (c) { return { airline: c.airline, airline_other: c.airline_other, months: c.months, last: c.last >= 0 ? ymFromIdx(c.last) : null }; }),
      currencies: currencies, currency: currencies.length === 1 ? currencies[0] : null,
      months: months, gaps: gaps, maps: dict,
      roster: { months: rms, byYm: rIdx, profile: R.profile || null },
      align: alignCandidates(months, rIdx),
      work: workList
    };
  }

  /* ════ 選び方 ═══════════════════════════════════════════════ */
  function monthAt(model, ym) { for (var i = 0; i < model.months.length; i++) if (model.months[i].ym === ym) return model.months[i]; return null; }
  function choose(model, sel) {
    sel = sel || {};
    var ms = model.months;
    if (!ms.length) return { list: [], a: null, b: null, from: null, to: null };
    var from = sel.from || ms[0].ym, to = sel.to || ms[ms.length - 1].ym;
    var list = ms.filter(function (m) { return m.ym >= from && m.ym <= to; });
    var b = sel.b ? monthAt(model, sel.b) : list[list.length - 1] || null;
    var a = null;
    if (sel.a) a = monthAt(model, sel.a);
    else if (b) for (var i = list.length - 1; i >= 0; i--) if (list[i].ym < b.ym && list[i].currency === b.currency) { a = list[i]; break; }
    return { list: list, a: a, b: b, from: from, to: to };
  }
  function delta(a, b) { return (a == null || b == null) ? null : b - a; }
  function rate(a, b) { return (a != null && b != null && a > 0) ? (b - a) / a : null; }
  function cmp(a, b, money, sameCur) {
    var ok = !money || sameCur;
    return { a: a, b: b, delta: ok ? delta(a, b) : null, rate: ok ? rate(a, b) : null };
  }
  function itemKey(l, by) { return by === 'label' ? l.labelKey : l.kind; }
  function itemsOf(m, by, filter) {
    var o = {};
    if (!m) return o;
    m.lines.forEach(function (l) {
      if (!l.counted || !filter(l)) return;
      var k = itemKey(l, by);
      if (!o[k]) o[k] = { key: k, kind: l.kind, cat: l.cat, label: by === 'label' ? l.label : null, amount: 0 };
      o[k].amount += l.amount;
    });
    return o;
  }
  function catSums(m) {
    var o = {};
    CAT_ORDER.forEach(function (c) { o[c] = null; });
    if (!m) return o;
    m.lines.forEach(function (l) { if (!l.counted) return; o[l.cat] = (o[l.cat] || 0) + l.amount; });
    return o;
  }
  function inGross(l) { return l.inGross; }

  /* 2つの支給月の増減（同じ通貨だけ）。総支給の中の項目だけを足すと Δ総支給になる */
  function waterfall(a, b, by) {
    if (!a || !b) return null;
    if (a.currency !== b.currency) return { sameCurrency: false, items: [], outside: [], sum: null, deltaGross: null, ok: null };
    var A = itemsOf(a, by, inGross), B = itemsOf(b, by, inGross);
    var keys = Object.keys(A).concat(Object.keys(B).filter(function (k) { return !A[k]; }));
    keys.sort(function (x, y) {
      var kx = (A[x] || B[x]).kind, ky = (A[y] || B[y]).kind;
      return (KIND_ORDER.indexOf(kx) - KIND_ORDER.indexOf(ky)) || (x < y ? -1 : x > y ? 1 : 0);
    });
    var items = keys.map(function (k) {
      var x = A[k] || B[k], va = A[k] ? A[k].amount : null, vb = B[k] ? B[k].amount : null;
      return { key: k, kind: x.kind, cat: x.cat, label: x.label, a: va, b: vb, delta: (vb || 0) - (va || 0), added: va == null, removed: vb == null };
    });
    var OA = itemsOf(a, by, function (l) { return l.outsideGross; }), OB = itemsOf(b, by, function (l) { return l.outsideGross; });
    var okeys = Object.keys(OA).concat(Object.keys(OB).filter(function (k) { return !OA[k]; }));
    var outside = okeys.map(function (k) { var va = OA[k] ? OA[k].amount : null, vb = OB[k] ? OB[k].amount : null; return { key: k, kind: (OA[k] || OB[k]).kind, a: va, b: vb, delta: (vb || 0) - (va || 0) }; });
    var s = sum(items.map(function (i) { return i.delta; }));
    var dg = delta(a.gross, b.gross);
    var comparable = a.anchor != null && b.anchor != null && a.grossBasis !== 'derived' && b.grossBasis !== 'derived';
    return { sameCurrency: true, currency: b.currency, items: items, outside: outside, sum: s, deltaGross: dg, ok: (comparable && dg != null) ? s === dg : null };
  }

  function totalsOf(list) {
    var byCur = {};
    list.forEach(function (m) {
      var c = byCur[m.currency] || (byCur[m.currency] = { gross: 0, net: 0, deductions: 0, received: 0, monthsGross: 0, monthsNet: 0, deductPrinted: 0, monthsDeductPrinted: 0 });
      if (m.gross != null) { c.gross += m.gross; c.received += m.received; c.monthsGross++; }
      if (m.gross != null && m.net != null) { c.net += m.net; c.deductions += m.gross - m.net; c.monthsNet++; }
      if (m.deductions != null) { c.deductPrinted += m.deductions; c.monthsDeductPrinted++; }
    });
    Object.keys(byCur).forEach(function (k) {
      var c = byCur[k];
      if (!c.monthsGross) { c.gross = null; c.received = null; }
      if (!c.monthsNet) { c.net = null; c.deductions = null; }
      if (!c.monthsDeductPrinted) c.deductPrinted = null;
    });
    var jg = 0, jn = 0, ng = 0, nn = 0;
    list.forEach(function (m) {
      if (m.fx_to_jpy == null) return;
      if (m.gross != null) { jg += fromMinor(m.gross, m.currency) * m.fx_to_jpy; ng++; }
      if (m.gross != null && m.net != null) { jn += fromMinor(m.net, m.currency) * m.fx_to_jpy; nn++; }
    });
    var cs = Object.keys(byCur), one = cs.length === 1 ? byCur[cs[0]] : null;
    return {
      months: list.length, currency: cs.length === 1 ? cs[0] : null, byCurrency: byCur,
      gross: one ? one.gross : null, net: one ? one.net : null, deductions: one ? one.deductions : null,
      received: one ? one.received : null, monthsGross: one ? one.monthsGross : null, monthsNet: one ? one.monthsNet : null,
      jpy: { gross: ng ? jg : null, net: nn ? jn : null, monthsGross: ng, monthsNet: nn }
    };
  }

  /* ════ 給与サマリー ═════════════════════════════════════════
     sel = { from, to, a, b, by:'kind'|'label' } （年月は 'YYYY-MM'） */
  function summary(model, sel) {
    sel = sel || {};
    var c = choose(model, sel), a = c.a, b = c.b, by = sel.by === 'label' ? 'label' : 'kind';
    var same = !!(a && b && a.currency === b.currency);
    var kpi = b ? {
      ym: b.ym, prevYm: a ? a.ym : null, currency: b.currency, sameCurrency: same,
      gross: cmp(a ? a.gross : null, b.gross, true, same),
      net: cmp(a ? a.net : null, b.net, true, same),
      blockMin: cmp(a ? a.qty.block : null, b.qty.block, false),
      dutyMin: cmp(a ? a.qty.duty : null, b.qty.duty, false)
    } : null;
    var list = c.list;
    var gaps = c.from ? ymRange(c.from, c.to).filter(function (ym) { return !monthAt(model, ym); }) : [];
    var totals = totalsOf(list);
    totals.gaps = gaps;
    /* 年のまとまり：提出済みの合計・12か月連続の実績・年換算（推計）・申告の賞与（足さない）を分けて持つ */
    var years = {};
    list.forEach(function (m) { (years[m.y] || (years[m.y] = [])).push(m); });
    var yearList = Object.keys(years).sort().map(function (y) {
      var ms = years[y], t = totalsOf(ms);
      var decl = null;
      for (var i = ms.length - 1; i >= 0; i--) if (ms[i].bonusAnnual != null) { decl = { amount: ms[i].bonusAnnual, currency: ms[i].currency, ym: ms[i].ym }; break; }
      var paidBonus = sum(ms.map(function (m) { return sum(m.lines.filter(function (l) { return l.counted && l.cat === 'bonus'; }).map(function (l) { return l.amount; })); }));
      return { year: +y, months: ms.length, yms: ms.map(function (m) { return m.ym; }), full: ms.length === 12, totals: t,
               annualized: (t.currency && t.monthsGross) ? { gross: Math.round(t.gross / t.monthsGross * 12), fromMonths: t.monthsGross, estimate: true } : null,
               bonusDeclared: decl, bonusPaid: t.currency ? paidBonus : null };
    });
    var trailing12 = null;
    if (c.to) {
      var yms = ymRange(ymAdd(c.to, -11), c.to), ms12 = yms.map(function (ym) { return monthAt(model, ym); });
      if (ms12.every(Boolean)) { var t12 = totalsOf(ms12); if (t12.currency && t12.monthsGross === 12) trailing12 = { from: yms[0], to: c.to, gross: t12.gross, net: t12.monthsNet === 12 ? t12.net : null, currency: t12.currency }; }
    }
    /* 構成（区分ごと・同じ通貨の範囲だけ） */
    var composition = null;
    if (totals.currency) {
      var cats = {};
      CAT_ORDER.forEach(function (k) { cats[k] = null; });
      list.forEach(function (m) { var s = catSums(m); CAT_ORDER.forEach(function (k) { if (s[k] != null) cats[k] = (cats[k] || 0) + s[k]; }); });
      var tot = sum(CAT_ORDER.filter(function (k) { return k !== 'adjustment' && cats[k] > 0; }).map(function (k) { return cats[k]; }));
      composition = { currency: totals.currency, total: tot, cats: CAT_ORDER.map(function (k) { return { cat: k, amount: cats[k], share: (cats[k] != null && tot > 0 && k !== 'adjustment') ? cats[k] / tot : null }; }),
                      months: list.map(function (m) { return { ym: m.ym, cats: catSums(m) }; }) };
    }
    var wf = waterfall(a, b, by);
    var netChange = (a && b) ? {
      sameCurrency: same,
      a: { gross: a.gross, deductions: a.deductions, net: a.net }, b: { gross: b.gross, deductions: b.deductions, net: b.net },
      delta: same ? { gross: delta(a.gross, b.gross), deductions: delta(a.deductions, b.deductions), net: delta(a.net, b.net) } : null
    } : null;
    if (netChange && netChange.delta) {
      var D = netChange.delta;
      netChange.consistent = (D.gross != null && D.deductions != null && D.net != null) ? (D.gross - D.deductions === D.net) : null;
    }
    /* 内訳の表：金額の表と数量の表を分ける（同じ列に混ぜない） */
    var rowsO = {}, keyOrder = [];
    list.forEach(function (m, i) {
      var it = itemsOf(m, by, function () { return true; });
      Object.keys(it).forEach(function (k) {
        if (!rowsO[k]) { rowsO[k] = { key: k, kind: it[k].kind, cat: it[k].cat, label: it[k].label, inGross: true, amounts: list.map(function () { return null; }) }; keyOrder.push(k); }
        rowsO[k].amounts[i] = it[k].amount;
      });
      m.lines.forEach(function (l) { if (l.counted && !l.inGross && rowsO[itemKey(l, by)]) rowsO[itemKey(l, by)].inGross = false; });
    });
    keyOrder.sort(function (x, y) { return (KIND_ORDER.indexOf(rowsO[x].kind) - KIND_ORDER.indexOf(rowsO[y].kind)) || (x < y ? -1 : x > y ? 1 : 0); });
    var qk = Object.keys(QTY_UNIT);
    var breakdown = {
      yms: list.map(function (m) { return m.ym; }), currencies: list.map(function (m) { return m.currency; }),
      rows: keyOrder.map(function (k) { return rowsO[k]; }),
      gross: list.map(function (m) { return m.gross; }), net: list.map(function (m) { return m.net; }), deductions: list.map(function (m) { return m.deductions; }),
      qty: qk.map(function (k) { return { k: k, unit: QTY_UNIT[k], values: list.map(function (m) { return m.qty[k]; }) }; })
        .filter(function (r) { return r.values.some(function (v) { return v != null; }); })
    };
    return { from: c.from, to: c.to, a: a ? a.ym : null, b: b ? b.ym : null, kpi: kpi, totals: totals, years: yearList, trailing12: trailing12,
             composition: composition, waterfall: wf, netChange: netChange, breakdown: breakdown };
  }

  /* ════ A. 収入と勤務量の変化 ═══════════════════════════════ */
  function cardA(model, sel) {
    var c = choose(model, sel), a = c.a, b = c.b, same = !!(a && b && a.currency === b.currency);
    var Q = function (m, k) { return m ? m.qty[k] : null; };
    var metrics = [
      { k: 'gross', unit: 'money' }, { k: 'net', unit: 'money' },
      { k: 'block', unit: 'min' }, { k: 'duty', unit: 'min' }, { k: 'dutyDays', unit: 'day' }, { k: 'sectors', unit: 'count' }
    ].map(function (x) {
      var va = x.unit === 'money' ? (a ? a[x.k] : null) : Q(a, x.k), vb = x.unit === 'money' ? (b ? b[x.k] : null) : Q(b, x.k);
      var r = cmp(va, vb, x.unit === 'money', same);
      r.k = x.k; r.unit = x.unit; return r;
    });
    var share = function (m) {
      if (!m) return null;
      var s = catSums(m), tot = sum(CAT_ORDER.filter(function (k) { return k !== 'adjustment' && s[k] > 0; }).map(function (k) { return s[k]; }));
      return CAT_ORDER.map(function (k) { return { cat: k, amount: s[k], share: (s[k] != null && tot > 0 && k !== 'adjustment') ? s[k] / tot : null }; });
    };
    var compA = share(a), compB = share(b), moved = null;
    if (same && compA && compB) {
      moved = CAT_ORDER.map(function (k, i) { return { cat: k, delta: (compB[i].amount || 0) - (compA[i].amount || 0) }; })
        .filter(function (x) { return x.delta !== 0; })
        .sort(function (x, y) { return Math.abs(y.delta) - Math.abs(x.delta) || (CAT_ORDER.indexOf(x.cat) - CAT_ORDER.indexOf(y.cat)); });
    }
    return {
      a: a ? a.ym : null, b: b ? b.ym : null, sameCurrency: same, currency: b ? b.currency : null,
      metrics: metrics, composition: { a: compA, b: compB }, moved: moved,
      series: c.list.map(function (m) { return { ym: m.ym, currency: m.currency, gross: m.gross, net: m.net, cats: catSums(m), block: m.qty.block, duty: m.qty.duty }; })
    };
  }

  /* ════ B. 働き方と報酬効率 ═════════════════════════════════
     sel = { num:'gross'|'net', den:'duty'|'block'|'dutyDays'|'sectors', basis:'payslip'|'roster', exclude:[kind|cat…], from, to }
     payslip：同じ明細の数量で割る（同じ書類＝対応づけ不要）。roster：勤務月に対応づけた行 ÷ その月のロスター。 */
  var DEN = { duty: { slip: 'duty', roster: 'dutyMin', unit: 'min' }, block: { slip: 'block', roster: 'block', unit: 'min' },
              dutyDays: { slip: 'dutyDays', roster: 'dutyDays', unit: 'day' }, sectors: { slip: 'sectors', roster: 'sectors', unit: 'count' } };
  function per(numer, den, unit) {
    if (numer == null || den == null || !(den > 0)) return null;
    return unit === 'min' ? numer * 60 / den : numer / den;     // 分は「1時間あたり」に
  }
  function cardB(model, sel) {
    sel = sel || {};
    var numK = sel.num === 'net' ? 'net' : 'gross', denK = DEN[sel.den] ? sel.den : 'duty', D = DEN[denK];
    var basis = sel.basis === 'roster' ? 'roster' : 'payslip', ex = arr(sel.exclude);
    var c = choose(model, sel), points = [];
    if (basis === 'payslip') {
      points = c.list.map(function (m) {
        var n = m[numK], d = m.qty[D.slip];
        return { ym: m.ym, basis: 'payslip', currency: m.currency, numerator: n, denominator: d, unit: D.unit, value: per(n, d, D.unit) };
      });
    } else {
      var inRange = function (W) { return W.fromPayMonths.some(function (p) { return (!c.from || p >= c.from) && (!c.to || p <= c.to); }); };
      points = model.work.filter(inRange).map(function (W) {
        var rm = W.roster, d = null;
        if (rm) d = D.roster === 'block' ? (rm.blockMin ? rm.blockMin.operating : null) : rm[D.roster];
        var out = { ym: W.ym, basis: 'roster', fromPayMonths: W.fromPayMonths, missingPayMonths: W.missingPayMonths,
                    currency: W.currencies.length === 1 ? W.currencies[0] : null, numerator: null, denominator: d, unit: D.unit, value: null, reason: null };
        if (numK === 'net') { out.reason = 'net_not_itemized'; return out; }
        if (W.currencies.length !== 1) { out.reason = 'mixed_currency'; return out; }
        var ls = W.lines.filter(function (l) { return l.inGross && ex.indexOf(l.kind) < 0 && ex.indexOf(l.cat) < 0; });
        out.numerator = sum(ls.map(function (l) { return l.amount; }));
        if (!rm) out.reason = 'no_roster'; else if (d == null) out.reason = rm.complete ? 'roster_gaps' : 'roster_incomplete';
        out.value = per(out.numerator, d, D.unit);
        return out;
      });
    }
    /* 日ごと（散布図）と勤務時間の分布（60分刻み） */
    /* どの勤務月の日を出すか：sel.work で名指し／roster は対応づけた勤務月／payslip は範囲の前月から */
    var wanted = arr(sel.work).length ? sel.work : basis === 'roster' ? points.map(function (p) { return p.ym; }) : null;
    var rmsList = arr(model.roster.months).filter(function (rm) {
      return wanted ? wanted.indexOf(rm.ym) >= 0 : ((!c.from || rm.ym >= ymAdd(c.from, -1)) && (!c.to || rm.ym <= c.to));
    });
    var days = [];
    rmsList.forEach(function (rm) {
      rm.days.forEach(function (x) {
        if (!x.isDuty) return;
        days.push({ date: x.date, ym: x.ym, dutyMin: x.dutyMin, blockMin: x.blockMin.operating, sectors: x.sectors, dhLegs: x.dhLegs, code: x.code, cls: x.cls, hasDh: x.hasDh });
      });
    });
    var bins = {};
    days.forEach(function (x) { if (x.dutyMin == null) return; var b = Math.floor(x.dutyMin / 60); bins[b] = (bins[b] || 0) + 1; });
    var dist = Object.keys(bins).map(Number).sort(function (p, q) { return p - q; }).map(function (b) { return { fromMin: b * 60, toMin: b * 60 + 60, n: bins[b] }; });
    return { num: numK, den: denK, basis: basis, unit: D.unit, points: points, days: days, dist: dist, daysNoDuty: days.filter(function (x) { return x.dutyMin == null; }).length };
  }

  /* ════ C. 手当別の掘り下げ ═════════════════════════════════
     sel = { item:'k:flight'（種類ごと）| 項目名の鍵, a, b, from, to }
     参考値（額 ÷ 数量）は契約単価ではない。差は「数量の差 × 前の参考値」と「残り」に分けるだけ。 */
  function lineQty(l, m, model) {
    var qk = l.qtyKind;
    if (qk === 'none') return null;
    if (qk && qk.indexOf('roster:') === 0) {
      var rm = l.workYm ? model.roster.byYm[l.workYm] : null, f = qk.slice(7);
      if (!rm) return null;
      var v = f === 'operating' || f === 'deadhead' || f === 'ground' ? (rm.blockMin ? rm.blockMin[f] : null)
        : f === 'duty' ? rm.dutyMin : rm[f];
      var unit = (f === 'operating' || f === 'deadhead' || f === 'ground' || f === 'duty') ? 'min' : (f === 'dutyDays' ? 'day' : 'count');
      return v == null ? null : { kind: qk, value: v, unit: unit, source: 'roster', workYm: l.workYm };
    }
    if (qk === 'role' || (!qk && m.roleQty[l.kind])) {
      var rq = m.roleQty[l.kind];
      return rq ? { kind: 'role', value: rq.value, unit: rq.unit, source: 'pay_items' } : null;
    }
    var k = qk || (l.kind === 'flight' ? BASIS_QTY[l.basis] : l.kind === 'perdiem' ? 'stay' : null);
    if (!k || !QTY_UNIT[k]) return null;      // 週末・祝日などは数量を決めない（日数で勝手に割らない）
    var val = m.qty[k];
    return val == null ? null : { kind: k, value: val, unit: QTY_UNIT[k], source: 'payslip' };
  }
  function cardC(model, sel) {
    sel = sel || {};
    var item = sel.item || 'k:flight';
    var byKind = item.indexOf('k:') === 0 && KINDS[item.slice(2)] ? item.slice(2) : null;
    var c = choose(model, sel);
    var match = function (l) { return l.counted && (byKind ? l.kind === byKind : l.labelKey === item); };
    var series = c.list.map(function (m) {
      var ls = m.lines.filter(match);
      var amt = ls.length ? sum(ls.map(function (l) { return l.amount; })) : null;
      /* 数量：行どうしで同じ数量なら1つ。違う数量が混ざれば出さない */
      var qs = ls.map(function (l) { return lineQty(l, m, model); }), q = null;
      if (qs.length && qs.every(function (x) { return x && x.kind === qs[0].kind && x.value === qs[0].value; })) q = qs[0];
      var works = []; ls.forEach(function (l) { var wy = l.workYm || null; if (works.indexOf(wy) < 0) works.push(wy); });
      return { ym: m.ym, currency: m.currency, amount: amt, qty: q, ref: q ? per(amt, q.value, q.unit) : null, refUnit: q ? (q.unit === 'min' ? 'hour' : q.unit) : null,
               workYms: works, lines: ls.map(function (l) { return l.id; }) };
    });
    function decompose(x, y) {
      if (!x || !y) return null;
      var out = { a: x.ym, b: y.ym, delta: null, qtyEffect: null, residual: null, reason: null };
      if (x.currency !== y.currency) { out.reason = 'currency'; return out; }
      if (x.amount == null || y.amount == null) { out.reason = 'no_amount'; return out; }
      out.delta = y.amount - x.amount;
      if (!x.qty || !y.qty || x.qty.kind !== y.qty.kind || x.qty.unit !== y.qty.unit) { out.reason = 'no_quantity'; return out; }
      if (!(x.qty.value > 0)) { out.reason = 'zero_quantity'; return out; }
      /* 数量の差 × 前の月の参考値（最小単位へ丸める）。残りはその差し引き＝足すと実際の差にぴったり */
      var q = (y.qty.value - x.qty.value) * x.amount / x.qty.value;
      out.qtyEffect = q < 0 ? -Math.round(-q) : Math.round(q);
      out.residual = out.delta - out.qtyEffect;
      return out;
    }
    var A = sel.a ? series.filter(function (s) { return s.ym === sel.a; })[0] : null;
    var B = sel.b ? series.filter(function (s) { return s.ym === sel.b; })[0] : null;
    var withAmt = series.filter(function (s) { return s.amount != null; });
    if (!B) B = withAmt[withAmt.length - 1] || null;
    if (!A && B) for (var i = withAmt.length - 1; i >= 0; i--) if (withAmt[i].ym < B.ym && withAmt[i].currency === B.currency) { A = withAmt[i]; break; }
    var pairs = [];
    for (var j = 1; j < withAmt.length; j++) pairs.push(decompose(withAmt[j - 1], withAmt[j]));
    /* 選べる項目（種類ごと → 項目名ごと） */
    var opts = {}, optOrder = [];
    c.list.forEach(function (m) {
      m.lines.forEach(function (l) {
        if (!l.counted) return;
        [['k:' + l.kind, null, l.kind], [l.labelKey, l.label, l.kind]].forEach(function (p) {
          if (!opts[p[0]]) { opts[p[0]] = { key: p[0], label: p[1], kind: p[2], months: 0, _seen: {} }; optOrder.push(p[0]); }
          if (!opts[p[0]]._seen[m.ym]) { opts[p[0]]._seen[m.ym] = 1; opts[p[0]].months++; }
        });
      });
    });
    var options = optOrder.map(function (k) { var o = opts[k]; return { key: o.key, label: o.label, kind: o.kind, months: o.months, byKind: o.key === 'k:' + o.kind }; });
    return { item: item, byKind: byKind, series: series, a: A ? A.ym : null, b: B ? B.ym : null, decomposition: decompose(A, B), pairs: pairs, options: options };
  }

  /* ════ 検算 ═══════════════════════════════════════════════
     sumToGross：内訳（減額・残りを含む総支給の中の行）＝ 総支給。内訳が総支給を超える月は false。
     grossMinusDeductEqNet：本人が書いた総支給 − 控除 ＝ 手取り（総支給を手取り＋控除から作った月は null＝独立に確かめられない）。
     waterfallEqDelta：増減の合計 ＝ Δ総支給（同じ通貨の隣り合う提出月）。 */
  function checks(model, opts) {
    opts = opts || {};
    var months = model.months.map(function (m) {
      var s = null;
      if (m.anchor != null) {
        var inG = sum(m.lines.filter(function (l) { return l.inGross; }).map(function (l) { return l.amount; }));
        s = (m.overGross == null) && inG === m.anchor;
      }
      var g = null, gm = m.row ? toMinor(m.row.gross_monthly, m.currency) : (m.anchorBasis === 'gross_monthly' ? m.anchor : null);
      if (gm != null && m.deductions != null && m.net != null) g = Math.abs(gm - m.deductions - m.net) <= (opts.tolerance || 0);
      return { ym: m.ym, sumToGross: s, grossMinusDeductEqNet: g, unexplained: m.unexplained, overGross: m.overGross };
    });
    var pairs = [];
    for (var i = 1; i < model.months.length; i++) {
      var a = model.months[i - 1], b = model.months[i], wf = waterfall(a, b, 'kind');
      pairs.push({ a: a.ym, b: b.ym, waterfallEqDelta: wf ? wf.ok : null, sum: wf ? wf.sum : null, deltaGross: wf ? wf.deltaGross : null });
    }
    return { months: months, pairs: pairs };
  }

  /* ════ D. 給与ルールの計算候補（試作の口）══════════════════════
     日ごとに超過を判定して足す式と、月の合計に閾値を当てる式は別物。保証は max(数量, 保証)。
     単価は原点を通る最小二乗。当てはめた月と、当てはめに使っていない月（検証）を分けて誤差を返す。
     確度の％は作らない。少ない月に合っても「確定」にしない（status は常に 'exploration'）。 */
  var ruleFit = {
    dailyExcess: function (days, thresholdMin, opts) {
      opts = opts || {};
      var q = opts.qty === 'block' ? function (x) { return x.blockMin ? x.blockMin.operating : null; } : function (x) { return x.dutyMin; };
      var perDay = [], missing = 0;
      arr(days).forEach(function (x) {
        if (!x || !x.isDuty) return;
        var v = q(x);
        if (v == null) { missing++; return; }
        perDay.push({ date: x.date, ym: x.ym, qtyMin: v, excessMin: Math.max(0, v - thresholdMin) });
      });
      var known = sum(perDay.map(function (p) { return p.excessMin; }));
      return { thresholdMin: thresholdMin, total: missing ? null : known, totalKnown: known, missing: missing,
               count: perDay.filter(function (p) { return p.excessMin > 0; }).length, perDay: perDay };
    },
    monthlyExcess: function (totalMin, thresholdMin) { return totalMin == null ? null : Math.max(0, totalMin - thresholdMin); },
    guarantee: function (qtyMin, guaranteeMin) { return qtyMin == null ? null : (guaranteeMin == null ? qtyMin : Math.max(qtyMin, guaranteeMin)); },
    fitRate: function (points) {
      var P = arr(points).filter(function (p) { return p && p.x != null && p.y != null; });
      var sxx = sum(P.map(function (p) { return p.x * p.x; })), sxy = sum(P.map(function (p) { return p.x * p.y; }));
      return { rate: sxx > 0 ? sxy / sxx : null, n: P.length, sxx: sxx };
    },
    /* 検証に回す月：既定は最新の1か月（validate:k で k か月、validate:['YYYY-MM',…] で名指し）。当てはめが2か月未満なら検証なし */
    holdout: function (yms, opts) {
      opts = opts || {};
      var list = arr(yms).slice().sort(), val;
      if (Array.isArray(opts.validate)) val = list.filter(function (y) { return opts.validate.indexOf(y) >= 0; });
      else { var k = isNum(opts.validate) ? opts.validate : 1; val = list.length - k >= 2 ? list.slice(list.length - k) : []; }
      return { fit: list.filter(function (y) { return val.indexOf(y) < 0; }), validate: val };
    },
    evaluate: function (rows, split) {
      rows = arr(rows); split = split || ruleFit.holdout(rows.map(function (r) { return r.ym; }));
      var fitRows = rows.filter(function (r) { return split.fit.indexOf(r.ym) >= 0; });
      var f = ruleFit.fitRate(fitRows);
      var out = rows.map(function (r) {
        var pred = (f.rate != null && r.x != null) ? Math.round(r.x * f.rate) : null;
        return { ym: r.ym, workYm: r.workYm || null, x: r.x, actual: r.y, predicted: pred, error: (pred != null && r.y != null) ? pred - r.y : null,
                 role: split.fit.indexOf(r.ym) >= 0 ? 'fit' : split.validate.indexOf(r.ym) >= 0 ? 'validate' : 'unused' };
      });
      var errs = function (role) { return out.filter(function (r) { return r.role === role && r.error != null; }).map(function (r) { return Math.abs(r.error); }); };
      var ef = errs('fit'), ev = errs('validate');
      return { rate: f.rate, fitMonths: split.fit, validationMonths: split.validate, rows: out,
               fit: { n: ef.length, maxAbsError: ef.length ? Math.max.apply(null, ef) : null, sse: sum(out.filter(function (r) { return r.role === 'fit' && r.error != null; }).map(function (r) { return r.error * r.error; })) },
               validation: { n: ev.length, maxAbsError: ev.length ? Math.max.apply(null, ev) : null },
               status: 'exploration' };
    },
    /* spec = { item:'k:flight'|鍵, kind:'daily'|'monthly'|'guarantee', qty:'duty'|'block', thresholdMin, guaranteeMin, validate }
       x は「その行に対応づけた勤務月」のロスターから作る（勤務月が分からない月は使わない） */
    candidate: function (model, spec) {
      spec = spec || {};
      var item = spec.item || 'k:flight', byKind = item.indexOf('k:') === 0 ? item.slice(2) : null;
      var T = isNum(spec.thresholdMin) ? spec.thresholdMin : 0, rows = [], skipped = [], contrib = [];
      model.months.forEach(function (m) {
        var ls = m.lines.filter(function (l) { return l.counted && (byKind ? l.kind === byKind : l.labelKey === item); });
        if (!ls.length) return;
        var works = []; ls.forEach(function (l) { if (works.indexOf(l.workYm) < 0) works.push(l.workYm); });
        if (works.length !== 1 || !works[0]) { skipped.push({ ym: m.ym, reason: 'work_month_unknown' }); return; }
        var rm = model.roster.byYm[works[0]];
        if (!rm || !rm.complete) { skipped.push({ ym: m.ym, reason: 'roster_incomplete' }); return; }
        var total = spec.qty === 'block' ? rm.blockMin.operating : rm.dutyMin, x = null;
        if (spec.kind === 'daily') { var de = ruleFit.dailyExcess(rm.days, T, { qty: spec.qty }); x = de.total; de.perDay.forEach(function (p) { if (p.excessMin > 0) contrib.push({ payYm: m.ym, workYm: works[0], date: p.date, excessMin: p.excessMin }); }); }
        else if (spec.kind === 'guarantee') x = ruleFit.guarantee(total, isNum(spec.guaranteeMin) ? spec.guaranteeMin : null);
        else x = ruleFit.monthlyExcess(total, T);
        if (x == null) { skipped.push({ ym: m.ym, reason: 'quantity_unknown' }); return; }
        rows.push({ ym: m.ym, workYm: works[0], x: x, y: sum(ls.map(function (l) { return l.amount; })) });
      });
      var split = ruleFit.holdout(rows.map(function (r) { return r.ym; }), { validate: spec.validate });
      var ev = ruleFit.evaluate(rows, split);
      ev.spec = { item: item, kind: spec.kind || 'monthly', qty: spec.qty === 'block' ? 'block' : 'duty', thresholdMin: T, guaranteeMin: isNum(spec.guaranteeMin) ? spec.guaranteeMin : null };
      ev.unit = 'minute'; ev.ratePerHour = ev.rate == null ? null : ev.rate * 60;
      ev.skipped = skipped; ev.contributions = contrib;
      return ev;
    },
    /* 当てはめた月の予測が全部同じ候補どうしは区別できない（indistinguishable）として束ねる */
    compare: function (results) {
      var groups = [];
      arr(results).forEach(function (r, i) {
        var sig = r.rows.filter(function (x) { return x.role === 'fit'; }).map(function (x) { return x.ym + ':' + x.predicted; }).join(',');
        var g = groups.filter(function (gg) { return gg.sig === sig; })[0];
        if (g) g.members.push(i); else groups.push({ sig: sig, members: [i] });
      });
      return groups.filter(function (g) { return g.members.length > 1; }).map(function (g) { return g.members; });
    }
  };

  /* ════ 便ごとの稼ぎ（目安）═══════════════════════════════════
     2026-11-12 オーナー「ルートを押すと、その便でいくら稼いだか」→ 決め方は「時給＋手当」（オーナー回答）。
     総支給 ÷ 飛んだ時間だと、地上勤務の多い人ほど便の額が膨らむ（オーナー指摘）。なので働いた月 m ごとに2つに分けて割り振る：
     ・手当の分（乗務手当 flight・日当 perdiem）… m の乗務のブロックタイムで按分 → その便のブロックタイムぶん
     ・基本給の分（それ以外の毎月のお金）… 時給 ＝ 額 ÷ m の勤務時間ぜんぶ（乗務・地上勤務・スタンバイで時刻のある日）
       → その便の勤務時間ぶん（その日の勤務を、その日の区間のブロックタイムで按分）
     便乗は基本給の分だけ。区分の分からない便（unknown）は乗務と同じに数える（空港のある区間の大半は乗務）。
     入れないもの：賞与（月の賞与・利益配分）・現物（課税評価）・組合から総支給の外で出た分・別の期間の行（ownPeriod）。
     行の「働いた月」は build() の決まりのまま（pv_line_map → スケジュールの pay_lag）。決まっていない行は明細の月。
     約束：m の便の額と、便の無い勤務の額を全部足すと、m に割り当てたお金（手当の分＋基本給の分）にぴったり戻る。
     ★2026-11-12 オーナー回答「近い月の明細で出す」：m の明細がまだ無いとき、基本給などの決まった額は、いちばん近い月の明細の額を使う（fixedFrom にその月）。
       乗務手当・日当は月ごとに違うので借りない ＝ それを載せている明細（飛んだ分が何か月あとの明細に出るか＝pay_lag・項目ごとの対応）が無ければ額を出さない。
       pay_lag をまだ答えていないときは「同じ月の明細」として数える（lagAsked=false を返す＝画面がその場で聞く）。
     額を出さない（reason）：no_payslip（m の分の明細が足りない・missing に月）・
       mixed_currency・no_duty（勤務時間ぜんぶが0・補えない勤務日がある）・no_block（その便の時間が分からない）・no_pay（額が負）。
     ★2026-11-13 勤務時間の数え方の穴を塞いだ（オーナーの相談 → ChatGPT と点検。決め方＝「時給＋手当」は変えていない）。
       勤務日：いままで勤務日だった日（休み・有給以外で、出頭・解散の時刻か便がある日）はそのまま全部。そこへ2つ足す ──
         ① 勤務・スタンバイ・訓練・地上業務の勤務コードだけの日（時刻も便も無い）／② 休み・有給のコードでも便がある日。
         ①を落とすと勤務時間が減って時給が2倍になり（37,500 → 62,500）、②を落とすとその便に額が出ず、手当が月の合計から消えていた。
         ⚠️ いまより狭くしない（勤務コードが未分類・便なしで、出頭・解散だけ印字された日も勤務日のまま）。
       勤務時間：出頭・解散の印字があれば、その実際の時刻（休みのコードで便のある日も）。無い日は、本人の「時刻の印字がある日」だけを材料に補う ──
         便のある日 ＝ その日のブロックタイム × 本人の「勤務 ÷ ブロック」（材料が1日も無ければ、今までどおりブロックタイムそのまま）／
         便の無い日 ＝ 同じ勤務コード → 同じ種類 → 勤務日ぜんぶ の平均（どれも 同じ月 → 全部の月）。
         ⚠️ 補った値を、次の補いの材料にしない。⚠️ 最後まで補えない勤務日がある月は、0時間のまま配り切らない＝額を出さない（no_duty）。
         何を根拠に補ったかは dutyEst（月）と dutyByDate（日）に返す。地球儀の輪は dutyByDate を読む（写しを持たせない）。
       スタンバイの手当（連動先が reserve の行）は便に載せない（offLeg.reserve）。
       月の検算 check：対象の額（元の行から1度ずつ積む）と、配った先（便・便の無い勤務・取り込んでいない日の分・スタンバイの手当）を
         別々に積んで比べる。⚠️ 引き算で帳尻を合わせない（行き先の無いお金は diff に出て、ok が偽になる）。
         basis：actual＝実際の明細どおり／borrowed＝決まった額を近い月の明細から借りた月／partial＝スケジュールが月の一部。 */
  var FP_FLIGHT = { flight: 1, perdiem: 1 };
  var FP_SKIP_CAT = { bonus: 1, noncash: 1 };
  var FP_LEG = { operating: 1, deadhead: 1, unknown: 1 };
  var FP_WORK_CLS = { duty: 1, standby: 1, training: 1, ground: 1 };
  var FP_REST_CLS = { off: 1, vac: 1 };
  function fpLegBlock(x) { return (x.blockKnown.operating || 0) + (x.blockKnown.deadhead || 0) + (x.blockKnown.unknown || 0); }
  /* 日ごとの勤務時間（分）と出どころ。勤務日でない日は入れない。
     src：times＝印字の時刻／ratio＝ブロックタイム × 本人の比／block＝ブロックタイムそのまま／code・cls・all＝同じ勤務コード・同じ種類・勤務日ぜんぶの平均／null＝補えない */
  function fpDutyMap(months, profile) {
    var days = [], map = {};
    arr(months).forEach(function (rm) { rm.days.forEach(function (x) { days.push(x); }); });
    days.forEach(function (x) {
      var rest = !!FP_REST_CLS[x.cls];
      var hasLeg = x.legs.some(function (L) { return FP_LEG[L.kind] && L.from && L.to; });
      var isWork = x.isDuty || (!rest && !!FP_WORK_CLS[x.cls]) || (rest && hasLeg);
      if (!isWork) return;
      var min = x.dutyMin;
      if (min == null && rest) {                 // 休み・有給のコードで便のある日：出頭・解散の印字があれば実際の時刻
        var on = clockMin(x.dOn), off = clockMin(x.dOff);
        min = elapsed(x.date, on, off == null ? null : (x.dOffDay || 0) * 1440 + off, profile).min;
      }
      map[x.date] = { min: min, src: min != null ? 'times' : null };
    });
    function timed(y) { return !!map[y.date] && map[y.date].src === 'times'; }    // 材料は時刻の印字がある日だけ（補った値は使わない）
    function near(x, f) {                        // 同じ月 → 全部の月
      var L = days.filter(function (y) { return timed(y) && y.ym === x.ym && f(y); });
      return L.length ? L : days.filter(function (y) { return timed(y) && f(y); });
    }
    function mean(L) { return L.length ? Math.round(sum(L.map(function (y) { return map[y.date].min; })) / L.length) : null; }
    days.forEach(function (x) {
      var e = map[x.date];
      if (!e || e.min != null) return;
      var b = fpLegBlock(x), v = null, src = null;
      if (b > 0) {
        var L = near(x, function (y) { return fpLegBlock(y) > 0; }), lb = sum(L.map(fpLegBlock));
        if (lb > 0) { v = Math.round(b * sum(L.map(function (y) { return map[y.date].min; })) / lb); src = 'ratio'; }
        else { v = b; src = 'block'; }           // 時刻のある便の日が1日も無い：その日の便の時間で代える（今までどおり）
      } else {
        if (x.code) { v = mean(near(x, function (y) { return y.code === x.code; })); if (v != null) src = 'code'; }
        if (v == null && x.cls) { v = mean(near(x, function (y) { return y.cls === x.cls; })); if (v != null) src = 'cls'; }
        if (v == null) { v = mean(near(x, function () { return true; })); if (v != null) src = 'all'; }
      }
      e.min = v; e.src = src;
    });
    return map;
  }
  function flightPay(model) {
    var res = { months: [], byYm: {}, legs: [] };
    if (!model || !model.roster) return res;
    var have = {}, flOffs = {}, own = {};
    /* 乗務手当・日当の行が「何か月まえの勤務の分」か（offset）。行に結びつけが無ければ同じ月（0） */
    arr(model.months).forEach(function (mo) {
      have[mo.ym] = mo;
      var s0 = 0;
      mo.lines.forEach(function (l) {
        if (!l.counted || !l.cash || l.ownPeriod || FP_SKIP_CAT[l.cat]) return;
        if (l.kind === 'union' && l.outsideGross) return;
        if (FP_FLIGHT[l.kind]) { flOffs[l.workYm ? (ymIdx(l.workYm) - ymIdx(mo.ym)) : 0] = 1; return; }
        if (!l.workYm || l.workYm === mo.ym) s0 += l.amount;          // その明細の月の決まった額（よその月へ移した行は除く）
      });
      own[mo.ym] = { cur: mo.currency, amt: s0 };
    });
    /* スケジュールの取り込みで答えた「飛んだ分は何か月あとの明細」も数える（その月の手当の行がまだ1つも無くても） */
    var lagP = model.roster.profile && model.roster.profile.pay_lag;
    var lagKnown = isNum(lagP) && lagP >= 0 && lagP <= 2;
    if (lagKnown) flOffs[-lagP] = 1;
    if (!Object.keys(flOffs).length) flOffs[0] = 1;
    var payYms = Object.keys(have).sort();
    function nearest(ym) {
      var i = ymIdx(ym), best = null, bd = Infinity;
      payYms.forEach(function (p) { var dd = Math.abs(ymIdx(p) - i); if (dd < bd || (dd === bd && p > best)) { bd = dd; best = p; } });
      return best;
    }
    res.lagAsked = lagKnown || lagP === -1;
    var dmap = fpDutyMap(model.roster.months, model.roster.profile);
    res.dutyByDate = dmap;
    /* 入れ物：fl＝便へ配る手当／ot＝時給の分／rs＝スタンバイの手当（便に載せない）／tg＝検算の「対象の額」（元の行から1度ずつ）／bw＝近い月から借りた額 */
    var pools = {};
    arr(model.months).forEach(function (mo) {
      mo.lines.forEach(function (l) {
        if (!l.counted || !l.cash || l.ownPeriod || FP_SKIP_CAT[l.cat]) return;
        if (l.kind === 'union' && l.outsideGross) return;
        var ym = l.workYm || mo.ym;
        var P = pools[ym] || (pools[ym] = {});
        var c = P[mo.currency] || (P[mo.currency] = { fl: 0, ot: 0, rs: 0, tg: 0, bw: 0 });
        c.tg += l.amount;
        if (l.kind === 'flight' && l.basis === 'reserve') c.rs += l.amount;
        else if (FP_FLIGHT[l.kind]) c.fl += l.amount; else c.ot += l.amount;
      });
    });
    arr(model.roster.months).forEach(function (rm) {
      var ym = rm.ym, M = { ym: ym, currency: null, fleet: null, flMinor: null, otMinor: null, opBlockMin: null, dutyMin: null,
                            ratePerHour: null, basis: null, reason: null, missing: [], fixedFrom: null, partial: null,
                            dutyEst: null, offLeg: null, check: null };
      /* 乗務手当・日当を載せている明細（飛んだ分が出る月）。無ければ額を出さない（借りない） */
      var flNeed = Object.keys(flOffs).map(function (o) { return ymAdd(ym, -Number(o)); });
      flNeed.forEach(function (p) { if (p && !have[p] && M.missing.indexOf(p) < 0) M.missing.push(p); });
      M.missing.sort();
      /* 決まった額：その月の明細が無ければ、いちばん近い月の明細から（乗務手当がその月の明細に載る人は上で止まる） */
      var fb = !have[ym] && !M.missing.length ? nearest(ym) : null;
      if (fb) M.fixedFrom = fb;
      var src = have[ym] || (fb ? have[fb] : null);
      var fleet = src && src.row ? String(src.row.fleet || '').trim() : '';
      M.fleet = fleet || null;
      if (fb) {
        var P0 = pools[ym] || (pools[ym] = {});
        var c0 = P0[own[fb].cur] || (P0[own[fb].cur] = { fl: 0, ot: 0, rs: 0, tg: 0, bw: 0 });
        c0.ot += own[fb].amt; c0.tg += own[fb].amt; c0.bw += own[fb].amt;
      }
      var curs = Object.keys(pools[ym] || {});
      var legs = [];
      rm.days.forEach(function (x) {
        x.legs.forEach(function (L) { if (FP_LEG[L.kind] && L.from && L.to) legs.push({ day: x, leg: L }); });
      });
      var opBlock = 0, duty = 0, est = { days: 0, min: 0, by: {}, unresolved: 0 };
      legs.forEach(function (p) { if (p.leg.kind !== 'deadhead' && p.leg.blockMin != null) opBlock += p.leg.blockMin; });
      rm.days.forEach(function (x) {
        var e = dmap[x.date];
        if (!e) return;
        if (e.min == null) { est.unresolved++; return; }
        duty += e.min;
        if (e.src !== 'times') { est.days++; est.min += e.min; est.by[e.src] = (est.by[e.src] || 0) + 1; }
      });
      var dutyCov = duty, opCov = opBlock;       // 取り込んだ日の分（欠けた日を補う前）
      /* ★2026-11-12 オーナー回答「欠けた日を補って出す」：スケジュールが月の一部だけでも額を出す。
           勤務時間ぜんぶは「取り込んだ日の勤務 × 月の日数 ÷ 取り込んだ日数」。乗務のブロックタイムは、乗務手当を載せた明細に
           乗務時間が印字されていればそれ、無ければ同じく日数で補う。partial に取り込んだ日数と欠けた日（[から, まで] の日）を返す */
      if (!rm.complete && rm.coveredDays > 0) {
        var dim = rm.daysInMonth, cov = rm.coveredDays, got = {}, gaps = [], g0 = null;
        rm.days.forEach(function (x) { got[+x.date.slice(8, 10)] = 1; });
        for (var dd = 1; dd <= dim + 1; dd++) {
          if (dd <= dim && !got[dd]) { if (g0 == null) g0 = dd; }
          else if (g0 != null) { gaps.push([g0, dd - 1]); g0 = null; }
        }
        duty = duty * dim / cov;
        var slip = null;
        flNeed.forEach(function (p) { if (slip == null && have[p] && have[p].qty && isNum(have[p].qty.block) && have[p].qty.block > 0) slip = have[p].qty.block; });
        opBlock = slip != null ? slip : opBlock * dim / cov;
        M.partial = { covered: cov, days: dim, gaps: gaps, blockFrom: slip != null ? 'payslip' : 'scaled' };
      }
      M.opBlockMin = opBlock; M.dutyMin = duty;
      M.dutyEst = est.days || est.unresolved ? est : null;
      if (M.missing.length) M.reason = 'no_payslip';
      else if (curs.length !== 1) M.reason = curs.length ? 'mixed_currency' : 'no_payslip';
      else if (!(duty > 0)) M.reason = 'no_duty';
      else if (est.unresolved) M.reason = 'no_duty';
      var c = curs.length === 1 ? pools[ym][curs[0]] : null;
      if (c) {
        M.currency = curs[0];
        M.offLeg = { reserve: c.rs };
        var fl = c.fl, ot = c.ot;
        if (fl > 0 && !(opBlock > 0)) { ot += fl; fl = 0; }    // 乗務の便が無い月の乗務手当は、勤務時間で割り振る
        M.flMinor = fl; M.otMinor = ot;
        M.basis = fl > 0 ? 'split' : 'gross';
        if (!M.reason && (fl < 0 || ot < 0)) M.reason = 'no_pay';
        if (!M.reason) M.ratePerHour = ot * 60 / duty;
      }
      res.months.push(M); res.byYm[ym] = M;
      var paid = 0, nPaid = 0, legMin = 0;       // 便に配った額・額の出た便の数・便に配った勤務時間
      legs.forEach(function (p) {
        var x = p.day, L = p.leg;
        var dayBlock = 0;
        x.legs.forEach(function (y) { if (FP_LEG[y.kind] && y.from && y.to && y.blockMin != null) dayBlock += y.blockMin; });
        var dd = dmap[x.date] ? dmap[x.date].min : null;
        var share = L.blockMin != null && dayBlock > 0 && dd != null ? dd * L.blockMin / dayBlock : null;
        var o = { date: x.date, ym: ym, seq: L.seq, from: L.from, to: L.to, kind: L.kind, out: L.out, in: L.in, inDay: L.inDay,
                  blockMin: L.blockMin, dutyMin: share == null ? null : Math.round(share), currency: M.currency, fleet: M.fleet,
                  amount: null, fixed: null, flight: null, ratePerHour: M.ratePerHour, basis: M.basis, reason: M.reason, missing: M.missing, fixedFrom: M.fixedFrom, partial: M.partial };
        if (!o.reason && share == null) o.reason = 'no_block';
        if (!o.reason) {
          var fx = (M.otMinor / duty) * share;
          var fv = L.kind === 'deadhead' || !(opBlock > 0) ? 0 : M.flMinor * L.blockMin / opBlock;
          o.fixed = Math.round(fx); o.flight = Math.round(fv); o.amount = o.fixed + o.flight;   // 内訳の2行を足すと合計（1円もずれない）
          paid += o.amount; nPaid++; legMin += share;
        }
        res.legs.push(o);
      });
      if (c && !M.reason) {
        var onGround = M.otMinor * (dutyCov - legMin) / duty;       // 便の無い勤務（地上業務・訓練・スタンバイ・額の出ない便の日）
        var notIn = M.otMinor * (duty - dutyCov) / duty + (opBlock > 0 ? M.flMinor * (opBlock - opCov) / opBlock : 0);   // 取り込んでいない日の分
        var diff = c.tg - (paid + onGround + notIn + c.rs);
        M.check = { target: c.tg, legs: paid, nonFlight: Math.round(onGround), uncovered: Math.round(notIn), reserve: c.rs,
                    diff: Math.round(diff), ok: Math.abs(diff) <= nPaid + 1,
                    basis: fb ? 'borrowed' : (M.partial ? 'partial' : 'actual'), borrowed: c.bw };
      }
    });
    return res;
  }

  w.PVReport = {
    VERSION: VERSION, CATEGORIES: CATEGORIES, KINDS: KINDS, KIND_ORDER: KIND_ORDER, QTY_UNIT: QTY_UNIT,
    flightPay: flightPay,
    minorDigits: minorDigits, toMinor: toMinor, fromMinor: fromMinor,
    linesOf: linesOf, rosterMonths: rosterMonths, mergePages: mergePages, alignCandidates: alignCandidates,
    build: build, summary: summary, cardA: cardA, cardB: cardB, cardC: cardC, checks: checks, waterfall: waterfall,
    ruleFit: ruleFit,
    helpers: { ymOf: ymOf, ymAdd: ymAdd, ymIdx: ymIdx, ymRange: ymRange, clockMin: clockMin, durMin: durMin, hoursToMin: hoursToMin, labelKey: labelKey, mapKey: mapKey, elapsed: elapsed, dayEmpty: dayEmpty }
  };
}(window));
