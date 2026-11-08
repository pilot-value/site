/* my-value-sample.js — マイレポートの見本（運営だけが読む）
   ★2026-11-08 オーナー「info@ にも市場レポート出せるようにして。みえないから」。
     運営のアカウントは給与を出していない＝レポートが空になる。偽の給与を本番に入れずに
     同じ画面を見られるよう、ここで作った行を my-value.js がそのまま描く。
   ★読み込むのは my-value.js が pv_is_admin() で運営と確かめたときだけ。会員には届かない。
   ★数字は全部作り物（実在の人の明細ではない）。形は my_pay_reports() が返す行と同じで、
     年換算はサーバの pv_annual_total と同じ組み方（総支給 − その月の賞与）× 12 ＋ 年間の賞与。
   使い方: window.PV_VALUE_SAMPLE('many'（12か月） | 'one' | 'hand') → 行の配列（古い月 → 新しい月）。 */
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

  /* 明細から入れた月：総支給＋内訳＋手取り・控除＋時間・深夜・セクター・ステイ。
     ★2026-11-08「1年のまとめ」用に、変動給を種類ごと（variable_by_basis）に持たせた。
       乗務時間の変動給は保証 75h までは1時間 60、超えた分は 150（作り物の「単価が変わる点」）。 */
  var DUTY = [1.82, 1.74, 1.93, 1.79, 1.87, 1.76, 1.95, 1.83, 1.71, 1.80, 1.88, 1.77];
  var NIGHT = [0.16, 0.19, 0.14, 0.17, 0.18, 0.15, 0.20, 0.16, 0.18, 0.19, 0.15, 0.17];
  var LEG = [3.1, 3.4, 2.9, 3.2, 3.0, 3.3, 3.5, 3.1, 3.2, 3.3, 2.9, 3.1];
  var STAY = [8, 10, 7, 9, 9, 8, 11, 9, 10, 11, 7, 9];
  var DAYS = [16, 18, 15, 17, 17, 16, 18, 17, 18, 19, 15, 17];
  var OFF = [10, 9, 12, 10, 11, 10, 9, 11, 9, 8, 12, 10];
  function slipMonth(ym, i, bh) {
    var r = base(ym, i), k = i % 12;
    var night = +(bh * NIGHT[k]).toFixed(1), sectors = Math.round(bh / LEG[k]);
    var block = Math.round(Math.min(bh, 75) * 60 + Math.max(0, bh - 75) * 150 + [0, 40, -30, 20, -10, 30, -20, 10, 25, -15, 5, -5][k]);
    var vb = { block: block, night: Math.round(night * 45), sector: sectors * 30 };
    var fv = vb.block + vb.night + vb.sector;
    r.base_pay = 25500; r.command_pay = 11000; r.guarantee_pay = null;
    r.housing_type = 'allowance'; r.housing_amount = 12000;
    r.transport = 1500; r.per_diem = STAY[k] * 450;
    r.flight_variable_pay = fv; r.other_allowance = fv + 2400;   // その他 ＝ 変動給 ＋ ほかの手当（pay-viz の入れ子）
    r.variable_by_basis = vb;
    r.gross_monthly = r.base_pay + r.command_pay + r.housing_amount + r.transport + r.per_diem + r.other_allowance + 450;
    r.deduction_total = 640;
    r.net_pay_actual = r.gross_monthly - r.deduction_total;
    r.ytd_taxable = null;                                 // UAE は課税が無い＝明細に年初来の課税額が無い
    r.block_hours = bh; r.duty_hours = +(bh * DUTY[k]).toFixed(1);
    r.night_hours = night; r.sectors = sectors;
    r.duty_days = DAYS[k]; r.stay_nights = STAY[k]; r.days_off = OFF[k];
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

  var BH = [68.2, 91.2, 72.5, 86.0, 88.6, 73.8, 90.1, 85.7, 92.4, 95.2, 70.4, 82.3];
  w.PV_VALUE_SAMPLE = function (key) {
    if (key === 'one') return [slipMonth(months(1)[0], 0, 86.5)];
    if (key === 'hand') return [handMonth(months(1)[0], 0)];
    return months(12).map(function (ym, i) { return slipMonth(ym, i, BH[i]); });
  };
}(window));
