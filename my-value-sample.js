/* my-value-sample.js — マイレポートの見本（運営だけが読む）
   ★2026-11-08 オーナー「info@ にも市場レポート出せるようにして。みえないから」。
     運営のアカウントは給与を出していない＝レポートが空になる。偽の給与を本番に入れずに
     同じ画面を見られるよう、ここで作った行を my-value.js がそのまま描く。
   ★読み込むのは my-value.js が pv_is_admin() で運営と確かめたときだけ。会員には届かない。
   ★数字は全部作り物（実在の人の明細ではない）。形は my_pay_reports() が返す行と同じで、
     年換算はサーバの pv_annual_total と同じ組み方（総支給 − その月の賞与）× 12 ＋ 年間の賞与。
   使い方: window.PV_VALUE_SAMPLE('many' | 'one' | 'hand') → 行の配列（古い月 → 新しい月）。 */
(function (w) {
  'use strict';
  var FX_JPY = 43.28, FX_USD = 0.2723;          // AED（fx-rates.mjs の 2026 年のレートに近い作り物）

  /* 直近の n か月（先月まで）。年をまたいでも壊れないように月の通し番号で数える。 */
  function months(n) {
    var now = new Date(), t = now.getFullYear() * 12 + now.getMonth() - 1, out = [];
    for (var i = n - 1; i >= 0; i--) out.push({ y: Math.floor((t - i) / 12), m: (t - i) % 12 + 1 });
    return out;
  }

  function finish(r) {
    var bonus = (r.bonus_annual || 0) + (r.profit_share_annual || 0);
    r.annual_total_orig = Math.round((r.gross_monthly - (r.bonus_month || 0)) * 12 + bonus);
    r.annual_total_jpy = Math.round(r.annual_total_orig * r.fx_to_jpy);
    r.annual_total_usd = Math.round(r.annual_total_orig * r.fx_to_usd);
    r.usd_per_block_hour = r.block_hours
      ? +(((r.annual_total_orig - bonus) / 12 - (r.per_diem || 0)) * r.fx_to_usd / r.block_hours).toFixed(2) : null;
    return r;
  }

  function base(ym, i) {
    return {
      airline: 'emirates', airline_other: null, position: 'cap', fleet: 'b777', job_role: null, base_iata: 'DXB',
      period_year: ym.y, period_month: ym.m, period_ym: ym.y * 12 + ym.m,
      currency: 'AED', fx_to_jpy: FX_JPY, fx_to_usd: FX_USD,
      source: 'payslip', verify_level: 1, guaranteed_hours: 75,
      bonus_annual: 0, profit_share_annual: 0, bonus_month: 0,
      created_at: (ym.m === 12 ? ym.y + 1 : ym.y) + '-' + String(ym.m === 12 ? 1 : ym.m + 1).padStart(2, '0') + '-05T00:00:00Z',
      _i: i
    };
  }

  /* 明細から入れた月：総支給＋内訳＋手取り・控除＋時間。乗務時間で変動給が動く。 */
  function slipMonth(ym, i, bh) {
    var r = base(ym, i);
    var fv = Math.round(bh * 68);                         // 変動給（乗務時間 × 単価の作り物）
    r.base_pay = 25500; r.command_pay = 11000; r.guarantee_pay = null;
    r.housing_type = 'allowance'; r.housing_amount = 12000;
    r.transport = 1500; r.per_diem = Math.round(bh * 48);
    r.flight_variable_pay = fv; r.other_allowance = fv + 2400;   // その他 ＝ 変動給 ＋ ほかの手当（pay-viz の入れ子）
    r.gross_monthly = r.base_pay + r.command_pay + r.housing_amount + r.transport + r.per_diem + r.other_allowance + 450;
    r.deduction_total = 640;
    r.net_pay_actual = r.gross_monthly - r.deduction_total;
    r.ytd_taxable = null;                                 // UAE は課税が無い＝明細に年初来の課税額が無い
    r.block_hours = bh; r.duty_hours = +(bh * 1.82).toFixed(1);
    r.duty_days = 17; r.stay_nights = 9;
    r.profit_share_annual = 42000;                        // 年間の利益配分（入れた人の年換算は賞与込みになる）
    return finish(r);
  }

  /* 手で入れた月：総支給と手取りだけ（内訳なし）。 */
  function handMonth(ym, i) {
    var r = base(ym, i);
    r.source = 'web'; r.verify_level = 0;
    r.gross_monthly = 63800; r.net_pay_actual = 63150; r.deduction_total = null;
    r.housing_type = 'allowance'; r.housing_amount = 12000; r.per_diem = 4100;
    r.block_hours = 84.0; r.duty_hours = null;
    return finish(r);
  }

  var BH = [78.4, 91.2, 72.5, 86.0, 88.6, 82.3];
  w.PV_VALUE_SAMPLE = function (key) {
    if (key === 'one') return [slipMonth(months(1)[0], 0, 86.5)];
    if (key === 'hand') return [handMonth(months(1)[0], 0)];
    return months(6).map(function (ym, i) { return slipMonth(ym, i, BH[i]); });
  };
}(window));
