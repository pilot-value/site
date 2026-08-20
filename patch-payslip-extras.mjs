/* patch-payslip-extras.mjs — 明細から読めているのに送っていなかった7列＋出所を送る。

   背景：db/pay-reports.sql は net_pay_actual / ytd_taxable / flight_variable_pay /
   deduction_total / duty_hours / night_hours / credit_hours を最初から持ち、
   submit_pay_report も受け取れる。しかしフォームの payload に無く、一度も
   保存されていなかった（＝Duty Hour単価・Gross/Net・年初来累計が出せない直接原因）。
   明細画像は保存しない設計なので、送らなかったぶんは後から復元できない。

   入れるのは3点だけ：隠しフィールド8本・ALL_IDS・payload。
   既存の欄・既存のキーは1つも書き換えない。
   実行: node patch-payslip-extras.mjs */
import { readFileSync, writeFileSync } from 'fs';

/* ★ .step の外に置く。updateSteps() が step を隠しても存在が消えないようにする。
   ★ f-duty は「乗務日数(duty_days)」で既に使用済み。勤務時間は f-duty-h。
   ★ PRESET_IDS には入れない（下の ALL_IDS だけに足す）。年初来累計や source を
     端末プリセットとして翌月のフォームに持ち越すと、静かに壊れる。 */
const FIELDS = `
      <!-- ── 明細から読めた値のうち、フォームに欄が無いもの ─────────────
           payslip.js が入れて、そのまま submit_pay_report へ送る。
           人は触らないので hidden。空なら val() が null を返して列も NULL。
           ★f-duty（乗務日数）とは別物。勤務時間は f-duty-h。 -->
      <input type="hidden" id="f-netpay">
      <input type="hidden" id="f-ytd">
      <input type="hidden" id="f-flightvar">
      <input type="hidden" id="f-deduct">
      <input type="hidden" id="f-duty-h">
      <input type="hidden" id="f-night-h">
      <input type="hidden" id="f-credit-h">
      <input type="hidden" id="f-source">
`;

/* ALL_IDS だけに足す理由：未ログインで送信を押すと snapshot() が
   localStorage.pv_pay_pending に退避され、ログイン後にそのまま送られる。
   ここに無いと、その経路でだけ静かに欠ける。 */
const ALL_IDS_FROM = `const ALL_IDS = PRESET_IDS.concat(['f-year','f-month','f-block','f-duty']);`;
const ALL_IDS_TO = `const ALL_IDS = PRESET_IDS.concat(['f-year','f-month','f-block','f-duty',
  /* ★明細由来。PRESET_IDS には入れない（翌月のフォームに持ち越すと壊れる）。 */
  'f-netpay','f-ytd','f-flightvar','f-deduct','f-duty-h','f-night-h','f-credit-h','f-source']);`;

const PAYLOAD_FROM = `    seniority_years:     val('f-seniority'),`;
const PAYLOAD_TO = `    seniority_years:     val('f-seniority'),

    /* ── 明細から読めた値（フォームに欄が無いもの）──────────────────
       列も RPC も前からあるのに、ここが送っていなかったので一度も入っていない。
       ★source は「出所ラベル」でしかない。クライアント申告なので、Verified 付与・
         解放日数・verify_level のどれもこれで分岐させてはいけない
         （VERIFIED-PILOT 3-2 A-1：明細を1枚も出さずに 'payslip' と送れてしまう）。 */
    net_pay_actual:      val('f-netpay'),
    ytd_taxable:         val('f-ytd'),
    flight_variable_pay: val('f-flightvar'),
    deduction_total:     val('f-deduct'),
    duty_hours:          val('f-duty-h'),
    night_hours:         val('f-night-h'),
    credit_hours:        val('f-credit-h'),
    source:              val('f-source') || 'web',`;

const SUBMIT_ANCHOR = `      <div class="step" id="submit-block" hidden>`;

const FILES = ['pay-report.html', 'en/pay-report.html'];

const once = (s, needle, what, f) => {
  const n = s.split(needle).length - 1;
  if (n !== 1) throw new Error(`${what} anchor not unique (${n}): ${f}`);
};

let n = 0;
for (const f of FILES) {
  let s = readFileSync(f, 'utf8');
  const before = s;

  // 二重適用よけ
  if (s.includes('f-duty-h')) { console.log(`skip (already patched): ${f}`); continue; }

  // ① 隠しフィールド（.step の外・送信ブロックの直前）
  once(s, SUBMIT_ANCHOR, 'hidden fields', f);
  s = s.replace(SUBMIT_ANCHOR, FIELDS.replace(/^\n/, '') + '\n' + SUBMIT_ANCHOR);

  // ② ログイン後の再送に載せる
  once(s, ALL_IDS_FROM, 'ALL_IDS', f);
  s = s.replace(ALL_IDS_FROM, ALL_IDS_TO);

  // ③ payload
  once(s, PAYLOAD_FROM, 'payload', f);
  s = s.replace(PAYLOAD_FROM, PAYLOAD_TO);

  if (s === before) throw new Error(`no change: ${f}`);
  writeFileSync(f, s);
  n++;
  console.log(`patched: ${f}`);
}
console.log(`\n${n} file(s) patched`);
if (n !== 2 && n !== 0) throw new Error(`expected 2 files, got ${n}`);
