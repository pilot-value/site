/* ════════════════════════════════════════════════════════════════
   合成の給与明細を作る（日本3様式・湾岸1・米国1）

   ★このリポジトリは PUBLIC。実物の明細も、実物から起こした金額も
     絶対に置かない。ここにあるのは全部でたらめな数字。
     使うのは「項目名と並び順」だけ。

   data-pii を付けた要素の座標を測って payslips.json に書き出す。
   これが「ここが隠れていなければ事故」という正解データになり、
   db/test-payslip-redact.mjs がそれで自動黒塗りの命中率を数える。

   実行: node db/fixtures/make-payslips.mjs
   ════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
mkdirSync(DIR, { recursive: true });

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{background:#fff;color:#111;font-family:'Hiragino Sans','Yu Gothic','Noto Sans JP',system-ui,sans-serif;font-size:13px;padding:26px 30px}
.mono{font-family:'SF Mono','Menlo','Courier New',monospace}
.t{width:100%;border-collapse:collapse}
.t td,.t th{padding:5px 8px;border:1px solid #999}
.t th{background:#eee;font-weight:700;text-align:left;font-size:12px}
.r{text-align:right;font-variant-numeric:tabular-nums}
.rule{border:0;border-top:2px solid #111;margin:12px 0}
.rule-thin{border:0;border-top:1px solid #bbb;margin:10px 0}
h1{font-size:17px;font-weight:700;letter-spacing:.04em}
.sub{font-size:11px;color:#555}
.sec{font-size:12px;font-weight:700;margin:14px 0 6px;letter-spacing:.06em}
.kv{display:flex;gap:6px}
.kv b{font-weight:400;color:#555}
/* ★簡体字とハングルの様式だけ、その言語の本文フォントを先に当てる。
   既定の並び（Hiragino Sans → Yu Gothic → Noto Sans JP）でも大半は出るが、
   出ない字が1つでも豆腐（□）になると、測っているのが「読み取りの誤り」ではなく
   **絵の失敗**になる。何を測っているのか分からない検査を作らないための1行。 */
.sc{font-family:'PingFang SC','Hiragino Sans GB','Noto Sans SC','Hiragino Sans',sans-serif}
.kr{font-family:'Apple SD Gothic Neo','Noto Sans KR','Hiragino Sans',sans-serif}
`;

/* ── ① 日本・大手（罫線あり・表形式）───────────────────────── */
const JP1 = `
<div style="display:flex;justify-content:space-between;align-items:flex-end">
  <h1>給 与 支 給 明 細 書</h1>
  <div class="sub">2026年 7月分　（支給日 2026/07/25）</div>
</div>
<div style="display:flex;gap:30px;margin-top:10px;font-size:12px">
  <div class="kv"><b>社員番号</b><span data-pii class="mono">1207-88431</span></div>
  <div class="kv"><b>氏名</b><span data-pii>山田　太郎　様</span></div>
  <div class="kv"><b>所属</b><span>運航本部 B777 乗員部</span></div>
</div>
<div style="margin-top:6px;font-size:12px" class="kv"><b>振込口座</b><span data-pii class="mono">◯◯銀行 羽田支店 普通 3348271</span></div>
<hr class="rule">
<div class="sec">支給</div>
<table class="t">
  <tr><td>基本給</td><td class="r">420,000</td><td>職務手当</td><td class="r">185,000</td></tr>
  <tr><td>変動付加乗務手当</td><td class="r">148,200</td><td>深夜割増</td><td class="r">23,400</td></tr>
  <tr><td>乗務回数手当</td><td class="r">14,900</td><td>住宅手当</td><td class="r">60,000</td></tr>
  <tr><td>通勤手当</td><td class="r">18,000</td><td>日当（非課税）</td><td class="r">42,000</td></tr>
  <tr><th>支給合計</th><th class="r">911,500</th><th></th><th></th></tr>
</table>
<div class="sec">控除</div>
<table class="t">
  <tr><td>健康保険</td><td class="r">41,200</td><td>厚生年金</td><td class="r">59,475</td></tr>
  <tr><td>雇用保険</td><td class="r">5,469</td><td>所得税</td><td class="r">62,310</td></tr>
  <tr><td>住民税</td><td class="r">48,700</td><td>組合費</td><td class="r">4,200</td></tr>
  <tr><th>控除合計</th><th class="r">221,354</th><th>差引支給額</th><th class="r">690,146</th></tr>
</table>
<div class="sec">勤怠実績</div>
<!-- ★data-keep＝**塗ってもいけないし、枠で切り落としてもいけない**ところ。
     2026-08-14 の実測で、送る枠の下端がこの表の1行上で切れていて、
     168.5／78.2／12.0 が**そもそも送られていなかった**ことが分かった（時間 0/3）。
     枠の手がかりが「3桁区切りの金額」と「120H30 形式の時刻」しか見ておらず、
     小数の勤務時間はどちらにも当たらなかったため。
     印が無かったので 631件のテストは全部緑のままだった。**同じ落ち方を二度させない印。** -->
<table class="t">
  <tr><td>総勤務時間</td><td class="r" data-keep>168.5</td><td>乗務時間</td><td class="r" data-keep>78.2</td>
      <td>深夜時間</td><td class="r" data-keep>12.0</td><td>乗務日数</td><td class="r">14</td></tr>
</table>`;

/* ── ② 日本・LCC（氏名が右上・罫線が薄い）───────────────── */
const JP2 = `
<div style="display:flex;justify-content:space-between">
  <div>
    <h1>2026年7月　給与明細</h1>
    <div class="sub" style="margin-top:4px">株式会社◯◯エアラインズ</div>
  </div>
  <div style="text-align:right;font-size:12px;line-height:1.9">
    <div data-pii>佐藤　健一</div>
    <div data-pii class="mono">EMP-40218</div>
    <div>FO / A320</div>
  </div>
</div>
<hr class="rule-thin">
<div style="margin-top:18px"></div>
<table class="t">
  <tr><th colspan="2">支給</th></tr>
  <tr><td>基本給</td><td class="r">318,000</td></tr>
  <tr><td>乗務手当</td><td class="r">142,800</td></tr>
  <tr><td>深夜手当</td><td class="r">18,600</td></tr>
  <tr><td>住宅補助</td><td class="r">35,000</td></tr>
  <tr><td>通勤費</td><td class="r">12,400</td></tr>
  <tr><td>ステイ日当</td><td class="r">31,500</td></tr>
  <tr><th>支給合計</th><th class="r">558,300</th></tr>
</table>
<table class="t" style="margin-top:12px">
  <tr><th colspan="2">控除</th></tr>
  <tr><td>社会保険料計</td><td class="r">78,420</td></tr>
  <tr><td>税金計</td><td class="r">51,900</td></tr>
  <tr><th>控除合計</th><th class="r">130,320</th></tr>
  <tr><th>差引支給額</th><th class="r">427,980</th></tr>
</table>
<table class="t" style="margin-top:12px">
  <tr><th colspan="4">実績</th></tr>
  <tr><td>乗務時間</td><td class="r">71.4</td><td>総拘束時間</td><td class="r">152.0</td></tr>
</table>`;

/* ── ③ 日本・左右2段組み（支給と控除が横並び）─────────────── */
const JP3 = `
<div style="text-align:center"><h1>給与支払明細書</h1>
<div class="sub" style="margin-top:4px">令和8年7月分</div></div>
<table class="t" style="margin-top:12px">
  <tr><th style="width:16%">氏名</th><td data-pii style="width:34%">鈴木　一郎</td>
      <th style="width:16%">社員コード</th><td data-pii class="mono" style="width:34%">A-2211-77</td></tr>
  <tr><th>住所</th><td data-pii colspan="3">東京都大田区羽田空港◯-◯-◯ ◯◯マンション 402</td></tr>
</table>
<hr class="rule">
<div style="display:flex;gap:14px">
  <table class="t" style="flex:1">
    <tr><th colspan="2">支給項目</th></tr>
    <tr><td>本給</td><td class="r">465,000</td></tr>
    <tr><td>機長手当</td><td class="r">210,000</td></tr>
    <tr><td>変動乗務手当</td><td class="r">198,700</td></tr>
    <tr><td>深夜乗務割増</td><td class="r">31,200</td></tr>
    <tr><td>住宅手当</td><td class="r">72,000</td></tr>
    <tr><td>パーディアム</td><td class="r">58,400</td></tr>
    <tr><th>合計</th><th class="r">1,035,300</th></tr>
  </table>
  <table class="t" style="flex:1">
    <tr><th colspan="2">控除項目</th></tr>
    <tr><td>健康保険料</td><td class="r">48,900</td></tr>
    <tr><td>厚生年金保険料</td><td class="r">59,475</td></tr>
    <tr><td>所得税</td><td class="r">84,120</td></tr>
    <tr><td>住民税</td><td class="r">61,300</td></tr>
    <tr><td>財形貯蓄</td><td class="r">30,000</td></tr>
    <tr><th>合計</th><th class="r">283,795</th></tr>
    <tr><th>差引支給額</th><th class="r">751,505</th></tr>
  </table>
</div>
<table class="t" style="margin-top:12px">
  <tr><th>総勤務時間</th><td class="r">181.0</td><th>乗務時間</th><td class="r">84.6</td>
      <th>深夜時間</th><td class="r">16.5</td></tr>
</table>`;

/* ── ④ 湾岸（英語・Staff No / IBAN）───────────────────────── */
const GULF = `
<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div><h1 style="letter-spacing:.08em">SALARY STATEMENT</h1>
  <div class="sub" style="margin-top:4px">Period: July 2026 &nbsp;|&nbsp; Flight Operations</div></div>
  <div style="text-align:right;font-size:12px;line-height:1.9">
    <div><span style="color:#555">Name</span> <b data-pii>J. A. WILLIAMS</b></div>
    <div><span style="color:#555">Staff No</span> <span data-pii class="mono">418822</span></div>
    <div><span style="color:#555">Rank / Fleet</span> CPT / B777</div>
  </div>
</div>
<div style="margin-top:6px;font-size:12px"><span style="color:#555">IBAN</span>
  <span data-pii class="mono">AE07 0331 2345 6789 0123 456</span></div>
<hr class="rule">
<table class="t">
  <tr><th colspan="2">EARNINGS (AED)</th></tr>
  <tr><td>Basic Salary</td><td class="r">32,110.00</td></tr>
  <tr><td>Housing Allowance</td><td class="r">15,700.00</td></tr>
  <tr><td>Flying Pay (78:12 @ 210.00)</td><td class="r">16,422.00</td></tr>
  <tr><td>Per Diem</td><td class="r">6,240.00</td></tr>
  <tr><td>Education Allowance</td><td class="r">3,800.00</td></tr>
  <tr><td>Profit Share</td><td class="r">0.00</td></tr>
  <tr><th>Gross Pay</th><th class="r">74,272.00</th></tr>
</table>
<table class="t" style="margin-top:12px">
  <tr><th colspan="2">DEDUCTIONS (AED)</th></tr>
  <tr><td>Provident Fund</td><td class="r">1,605.50</td></tr>
  <tr><td>Company Accommodation Recovery</td><td class="r">0.00</td></tr>
  <tr><th>Total Deductions</th><th class="r">1,605.50</th></tr>
  <tr><th>Net Pay</th><th class="r">72,666.50</th></tr>
</table>
<table class="t" style="margin-top:12px">
  <tr><th colspan="6">DUTY SUMMARY</th></tr>
  <tr><td>Block Hours</td><td class="r">78:12</td><td>Duty Hours</td><td class="r">164:30</td>
      <td>Night Hours</td><td class="r">11:00</td></tr>
</table>`;

/* ── ⑤ 米国（プレーンテキスト・罫線なし・CREDIT HRS）──────── */
const US = `
<pre class="mono" style="font-size:12.5px;line-height:1.65">
                    PILOT PAY STATEMENT   -   JUL 2026

EMPLOYEE: <span data-pii>SMITH, R. A.</span>          FILE #: <span data-pii>0442817</span>
BASE: ATL   SEAT: CA   EQUIP: 76A          SSN: <span data-pii>XXX-XX-4417</span>

EARNINGS                     HOURS        RATE        AMOUNT
  CREDIT HOURS                84.55      302.11     25,543.40
  OVERRIDE - INTL             84.55        6.50        549.58
  HOLDING PAY                  1.20      302.11        362.53
  PER DIEM                   214.00        2.90        620.60
  VACATION                     0.00        0.00          0.00
                                                  ------------
GROSS EARNINGS                                       27,076.11

DEDUCTIONS
  FEDERAL TAX / STATE TAX / FICA / 401K / DUES
TOTAL DEDUCTIONS                                      8,914.22
NET PAY                                              18,161.89

TIME SUMMARY
  BLOCK HOURS  76.30      CREDIT HOURS  84.55
  DUTY HOURS  158.40      GUARANTEE     73.00
</pre>`;

/* ── ⑥ 日本・大手（実物の様式に寄せたもの）─────────────────────
   ★金額は1つ残らずでたらめ。使ったのは「項目名と並び順」だけ。
     実物の数字はこのリポジトリにも、この生成器にも、一度も入れていない。

   この様式が他の5つと違って効くのは、次の4つが同時に起きるから：
     ・時間が 60進の「120H30」表記（10進の 120.30 ではない）
     ・支給欄にマイナス行が立つ（不就労減額）
     ・同じ項目が支給と控除に同額で立つ（航空券課税＝現物給与の課税処理）
     ・基本給が2行に割れている（本給A／本給B）                              */
const JP4 = `
<div style="display:flex;justify-content:space-between;align-items:flex-end">
  <h1>給 与 明 細 書</h1>
  <div class="sub">2026年7月分</div>
</div>
<div style="display:flex;gap:26px;margin-top:8px;font-size:12px">
  <div class="kv"><b>社員番号</b><span data-pii class="mono">41-207356</span></div>
  <div class="kv"><b>氏名</b><span data-pii>田中　三郎</span></div>
  <div class="kv"><b>所属</b><span>運航部　乗員二課</span></div>
</div>
<hr class="rule">
<table class="t">
  <tr><th colspan="2" style="text-align:center;background:#d9f0f2">支　給　内　訳</th></tr>
  <tr><td>本給A</td><td class="r">150,000</td></tr>
  <tr><td>本給B</td><td class="r">210,000</td></tr>
  <tr><td>住宅手当</td><td class="r">8,000</td></tr>
  <tr><td>不就労減額</td><td class="r">-18,000</td></tr>
  <tr><td>職務手当</td><td class="r">460,000</td></tr>
  <tr><td>変動付加乗務時間</td><td class="r">160,000</td></tr>
  <tr><td>深夜変動付加割増</td><td class="r">2,000</td></tr>
  <tr><td>変動付加乗務回数</td><td class="r">11,000</td></tr>
  <tr><td>深夜勤務割増手当</td><td class="r">6,000</td></tr>
  <tr><td>土日祝出勤手当</td><td class="r">5,000</td></tr>
  <tr><td>特別勤務割増手当</td><td class="r">40,000</td></tr>
  <tr><td>航空券課税</td><td class="r">9,000</td></tr>
  <tr><td>株式積立奨励金</td><td class="r">2,000</td></tr>
  <tr><th style="background:#d9f0f2">支　給　合　計</th><th class="r">1,045,000</th></tr>
</table>
<table class="t" style="margin-top:12px">
  <tr><th colspan="2" style="text-align:center;background:#d9f0f2">控　除　内　訳</th></tr>
  <tr><td>所得税</td><td class="r">140,000</td></tr>
  <tr><td>地方税</td><td class="r">70,000</td></tr>
  <tr><td>健康保険料</td><td class="r">45,000</td></tr>
  <tr><td>子供子育て支援金</td><td class="r">1,300</td></tr>
  <tr><td>厚生年金保険料</td><td class="r">59,475</td></tr>
  <tr><td>雇用保険料</td><td class="r">5,200</td></tr>
  <tr><td>株式積立金積立額</td><td class="r">10,000</td></tr>
  <tr><td>共済会費</td><td class="r">1,800</td></tr>
  <tr><td>組合費（乗組）</td><td class="r">33,000</td></tr>
  <tr><td>航空券課税</td><td class="r">9,000</td></tr>
  <tr><td>旅客施設使用料</td><td class="r">500</td></tr>
  <tr><th style="background:#d9f0f2">控　除　合　計</th><th class="r">375,275</th></tr>
</table>
<table class="t" style="margin-top:12px">
  <tr><th>勤務時間</th><td class="r">120H30</td><th>時間外A</th><td class="r"></td>
      <th>時間外B</th><td class="r"></td><th>時間外割増</th><td class="r"></td></tr>
  <tr><th>休日時間</th><td class="r"></td><th>深夜時間</th><td class="r">4H12</td>
      <th>乗務時間</th><td class="r">60H00</td><th>不就労時間</th><td class="r">4H</td></tr>
</table>
<table class="t" style="margin-top:12px">
  <tr><th>課税対象額</th><td class="r">940,000 円</td>
      <th>累積課税支給額</th><td class="r">5,400,000 円</td></tr>
</table>`;

/* ── ⑦ 日本・振込先が最下部（★上端の帯の外に PII がある）───────
   最初の6様式は PII が全部 y≤0.129＝画像の上端13%以内にあり、
   「上端に帯を1枚置く」だけの実装でも必ず覆えてしまった。
   つまり test-payslip-redact.mjs は、黒塗りが本当に効いているかを
   一度も試していなかった。これはその穴を塞ぐための様式。
   日本の明細で振込先が末尾に来るのは実在する並び。                     */
const JP5 = `
<div style="display:flex;justify-content:space-between;align-items:flex-end">
  <h1>給 与 明 細 書</h1>
  <div class="sub">2026年 7月分　（支給日 2026/07/25）</div>
</div>
<div style="margin-top:8px;font-size:12px" class="kv"><b>所属</b><span>運航部 A350 乗員グループ</span></div>
<hr class="rule">
<div class="sec">支給</div>
<table class="t">
  <tr><td>基本給</td><td class="r">446,000</td><td>職務手当</td><td class="r">192,000</td></tr>
  <tr><td>変動付加乗務手当</td><td class="r">163,700</td><td>深夜割増</td><td class="r">21,900</td></tr>
  <tr><td>通勤手当</td><td class="r">16,400</td><td>日当（非課税）</td><td class="r">38,500</td></tr>
  <tr><th>支給合計</th><th class="r">878,500</th><th></th><th></th></tr>
</table>
<div class="sec">控除</div>
<table class="t">
  <tr><td>健康保険</td><td class="r">39,800</td><td>厚生年金</td><td class="r">59,475</td></tr>
  <tr><td>所得税</td><td class="r">58,900</td><td>住民税</td><td class="r">46,200</td></tr>
  <tr><th>控除合計</th><th class="r">204,375</th><th>差引支給額</th><th class="r">674,125</th></tr>
</table>
<div class="sec">勤怠実績</div>
<table class="t">
  <tr><td>総勤務時間</td><td class="r">171.0</td><td>乗務時間</td><td class="r">81.4</td>
      <td>深夜時間</td><td class="r">10.5</td><td>乗務日数</td><td class="r">15</td></tr>
</table>
<hr class="rule" style="margin-top:22px">
<div class="sec">振込先</div>
<table class="t">
  <tr><th style="width:120px">氏名</th><td data-pii>川口　誠　様</td>
      <th style="width:120px">社員番号</th><td data-pii class="mono">2208-51749</td></tr>
  <tr><th>振込口座</th><td colspan="3" data-pii class="mono">◯◯銀行 成田支店 普通 7719204</td></tr>
</table>`;

/* ── ⑧ 湾岸・個人情報が右の縦帯（★上端の帯の外・横位置も右端）──
   支給表が左を占め、氏名・社員番号・IBAN が右側の枠に縦に並ぶ。
   上端に帯を置く実装では y でも x でも当たらない。                       */
const GULF2 = `
<div style="display:flex;justify-content:space-between;align-items:flex-end">
  <h1>SALARY STATEMENT</h1>
  <div class="sub">JULY 2026</div>
</div>
<hr class="rule">
<div style="display:flex;gap:22px;align-items:flex-start;margin-top:6px">
  <table class="t" style="flex:1">
    <tr><th colspan="2">EARNINGS</th></tr>
    <tr><td>Basic Salary</td><td class="r">31,400</td></tr>
    <tr><td>Position Allowance</td><td class="r">12,000</td></tr>
    <tr><td>Housing Allowance</td><td class="r">16,500</td></tr>
    <tr><td>Transport Allowance</td><td class="r">2,100</td></tr>
    <tr><td>Flying Pay</td><td class="r">14,860</td></tr>
    <tr><td>Layover Allowance</td><td class="r">4,320</td></tr>
    <tr><th>TOTAL EARNINGS</th><th class="r">81,180</th></tr>
    <tr><th colspan="2">DEDUCTIONS</th></tr>
    <tr><td>Total Deductions</td><td class="r">3,240</td></tr>
    <tr><th>NET PAY</th><th class="r">77,940</th></tr>
  </table>
  <table class="t" style="width:300px">
    <tr><th colspan="2">PAYEE DETAILS</th></tr>
    <tr><th style="width:96px">Crew Name</th><td data-pii>K. R. HAMMOND</td></tr>
    <tr><th>Staff No</th><td data-pii class="mono">507331</td></tr>
    <tr><th>Bank</th><td>◯◯ NATIONAL BANK</td></tr>
    <tr><th>IBAN</th><td data-pii class="mono">AE44 0872 6610 4453</td></tr>
  </table>
</div>
<table class="t" style="margin-top:14px">
  <tr><td>Block Hours</td><td class="r">80:24</td><td>Duty Hours</td><td class="r">171:00</td>
      <td>Night Hours</td><td class="r">9:30</td></tr>
</table>`;

/* ── ⑩ 日本・大手（現実の組み方に寄せた密な様式）★不具合の再現用 ─────
   2026-08-05、現実の日本の明細では**1つも見つからなかった**。
   合成8様式はすべて緑だったので、fixture が現実を写していなかったということ。
   現実と合成の差は見た目ではなく、次の4つだった：

     ① 画像が大きい。合成は 760〜940px。現実のスクショや PDF 書き出しは
        2000px を超える。送信用に長辺 1568px へ縮めた絵を OCR に渡していたので、
        本文が 8px 前後まで潰れてから拡大され、ラベルが1語も読めなかった。
     ② ラベルの字間が空いている。「氏　名」「銀　行」「支　店」「口　座　番　号」。
        枠の幅に合わせる印刷屋の作法で、日本の明細はほぼこれ。
        tesseract は空白で語を切るので、語単位の照合では永久に一致しない。
     ③ 左に個人情報・右に勤務時間表が横並び。ラベルの行を画像の右端まで塗ると
        時間の列ごと潰れて、時給が出せなくなる（data-keep で「塗ってはいけない」を測る）。
     ④ 振込先が「見出しの行の下に値の行」。見出しだけ塗っても口座番号は出ていく。

   ★金額・口座・氏名はすべてでたらめ。実物の数字は一度もここに入れていない。 */
const JP6 = `
<div style="font-size:11px">
<div style="display:flex;justify-content:space-between;align-items:flex-end">
  <h1 style="font-size:15px">給 与 支 給 明 細 書</h1>
  <div class="sub">2026年 7月分　（支給日 2026/07/25）　株式会社◯◯◯◯</div>
</div>
<hr class="rule-thin">
<div style="display:flex;gap:14px;align-items:flex-start;margin-top:6px">
  <table class="t" style="width:33%">
    <tr><th style="width:42%">地　区</th><td>東京</td></tr>
    <tr><th>所　属</th><td>運航部　乗員二課</td></tr>
    <tr><th>役職員番号</th><td data-pii class="mono">41-207356</td></tr>
    <tr><th>氏　名</th><td data-pii>田中　三郎</td></tr>
  </table>
  <table class="t" style="flex:1">
    <tr><th>等級号俸</th><th>勤務時間</th><th>時間外A</th><th>時間外B</th><th>時間外割増</th></tr>
    <tr><td class="r">08-14</td><td class="r" data-keep>120H30</td><td class="r"></td><td class="r"></td><td class="r"></td></tr>
    <!-- ★この見出し行は、左の表の「役職員番号 41-207356」と同じ高さに並ぶ。
         OCR は左右を1行として読むので、社員番号の帯を右へ伸ばすと見出しごと消える。
         値だけ残って何の時間か分からなくなる＝時給が出せない。だから残す側で測る。 -->
    <tr><th>休日時間</th><th data-keep>深夜時間</th><th data-keep>乗務時間</th><th>不就労時間</th><th>乗務日数</th></tr>
    <tr><td class="r"></td><td class="r">4H12</td><td class="r" data-keep>60H00</td><td class="r">4H</td><td class="r">13</td></tr>
  </table>
</div>
<div style="display:flex;gap:14px;margin-top:10px">
  <table class="t" style="flex:1">
    <tr><th colspan="2" style="text-align:center;background:#d9f0f2">支　給　内　訳</th></tr>
    <tr><td>本給A</td><td class="r">150,000</td></tr>
    <tr><td>本給B</td><td class="r">210,000</td></tr>
    <tr><td>住宅手当</td><td class="r">8,000</td></tr>
    <tr><td>不就労減額</td><td class="r">-18,000</td></tr>
    <tr><td>職務手当</td><td class="r">460,000</td></tr>
    <tr><td>変動付加乗務時間</td><td class="r">160,000</td></tr>
    <tr><td>深夜変動付加割増</td><td class="r">2,000</td></tr>
    <tr><td>変動付加乗務回数</td><td class="r">11,000</td></tr>
    <tr><td>深夜勤務割増手当</td><td class="r">6,000</td></tr>
    <tr><td>土日祝出勤手当</td><td class="r">5,000</td></tr>
    <tr><td>特別勤務割増手当</td><td class="r">40,000</td></tr>
    <tr><td>航空券課税</td><td class="r">9,000</td></tr>
    <tr><th style="background:#d9f0f2">支　給　合　計</th><th class="r">1,043,000</th></tr>
  </table>
  <table class="t" style="flex:1">
    <tr><th colspan="2" style="text-align:center;background:#d9f0f2">控　除　内　訳</th></tr>
    <tr><td>所得税</td><td class="r">140,000</td></tr>
    <tr><td>地方税</td><td class="r">70,000</td></tr>
    <tr><td>健康保険料</td><td class="r">45,000</td></tr>
    <tr><td>子供子育て支援金</td><td class="r">1,300</td></tr>
    <tr><td>厚生年金保険料</td><td class="r">59,475</td></tr>
    <tr><td>雇用保険料</td><td class="r">5,200</td></tr>
    <tr><td>株式積立金積立額</td><td class="r">10,000</td></tr>
    <tr><td>共済会費</td><td class="r">1,800</td></tr>
    <tr><td>旅客施設使用料</td><td class="r">500</td></tr>
    <tr><td>航空券課税</td><td class="r">9,000</td></tr>
    <tr><th style="background:#d9f0f2">控　除　合　計</th><th class="r">342,275</th></tr>
    <tr><th style="background:#d9f0f2">差　引　支　給　額</th><th class="r">700,725</th></tr>
  </table>
</div>
<div class="sec" style="margin-top:12px">振　込　先</div>
<table class="t">
  <tr><th style="width:12%">銀　行</th><th style="width:12%">支　店</th>
      <th style="width:20%">口　座　番　号</th><th style="width:18%">振　込　金　額</th><th></th></tr>
  <tr><td data-pii class="mono">0009</td><td data-pii class="mono">200</td>
      <td data-pii class="mono">3100343</td><td class="r mono">700,725</td><td></td></tr>
</table>
</div>`;

/* ── ⑨ 左が「枠なしの ラベル：　値」＋上に長い文章 ────────────
   現実の様式にこの形があり、社員番号だけ塗り残した。⑧（jp-dense）との違いは3つ：
     ・左の3行に**罫線が無い**（表ではなく、ただ並んでいるだけ）
     ・区切りが全角コロン。値との間が全角空きで大きく開く
     ・上に長い日本語の文章の枠があり、tesseract の領域分割の結果が変わる
   そして肝心なのは**ラベルが「役職員番号」＝ 手がかり表の「職員番号」の前に1字ある**こと。
   語が1文字ずつに割れたときの照合が先頭一致だけだと、ここで永久に外れる。 */
const JP7 = `
<div style="font-size:11px">
<div style="display:flex;justify-content:space-between;align-items:flex-end">
  <h1 style="font-size:15px">給 与 支 給 明 細 書</h1>
  <div class="sub">2026年 7月分　（支給日 2026/07/25）　◯◯◯◯株式会社</div>
</div>
<hr class="rule-thin">
<div style="display:flex;gap:18px;align-items:flex-start">
  <div style="width:31%">
    <div style="border:1px solid #999;padding:8px 10px;font-size:10px;line-height:1.65;color:#333">
      本明細は当月の支給内容をお知らせするものです。記載内容にご不明な点がある場合は、
      支給日から一か月以内に給与担当までお問い合わせください。住所・扶養等に変更が
      あった場合は、速やかに所定の様式で届け出をお願いいたします。各種控除の内訳は
      控除内訳欄をご確認ください。年末調整に関する書類は別途送付いたします。
    </div>
    <div style="margin-top:22px;line-height:2.4">
      <div>事業所：　　本　社</div>
      <div>所　属：　　運航二部</div>
      <div>役職員番号：　<span data-pii class="mono">509143k</span></div>
      <!-- 値に数字が1つも無い＝**形では絶対に拾えない**。ラベルを読めたときだけ塗れる。 -->
      <div>氏　名：　　<span data-pii>佐藤　健一</span></div>
    </div>
    <div style="margin-top:26px;font-size:20px;letter-spacing:.22em;color:#1b3a6b">◯◯◯</div>
  </div>
  <div style="flex:1">
    <div style="display:flex;gap:14px">
      <table class="t" style="flex:1">
        <tr><th colspan="2" style="text-align:center;background:#d9f0f2">支　給　内　訳</th></tr>
        <tr><td>本給A</td><td class="r">152,000</td></tr>
        <tr><td>本給B</td><td class="r">214,000</td></tr>
        <tr><td>住宅手当</td><td class="r">8,000</td></tr>
        <tr><td>職務手当</td><td class="r">455,000</td></tr>
        <tr><td>変動付加乗務時間</td><td class="r">163,000</td></tr>
        <tr><td>深夜変動付加割増</td><td class="r">2,400</td></tr>
        <tr><td>変動付加乗務回数</td><td class="r">12,000</td></tr>
        <tr><td>特別勤務割増手当</td><td class="r">38,000</td></tr>
        <tr><th style="background:#d9f0f2">支　給　合　計</th><th class="r">1,044,400</th></tr>
      </table>
      <table class="t" style="flex:1">
        <tr><th colspan="2" style="text-align:center;background:#d9f0f2">控　除　内　訳</th></tr>
        <tr><td>所得税</td><td class="r">141,000</td></tr>
        <tr><td>地方税</td><td class="r">72,000</td></tr>
        <tr><td>健康保険料</td><td class="r">45,000</td></tr>
        <tr><td>厚生年金保険料</td><td class="r">59,475</td></tr>
        <tr><td>雇用保険料</td><td class="r">5,200</td></tr>
        <tr><td>共済会費</td><td class="r">1,800</td></tr>
        <tr><th style="background:#d9f0f2">控　除　合　計</th><th class="r">324,475</th></tr>
        <tr><th style="background:#d9f0f2">差　引　支　給　額</th><th class="r">719,925</th></tr>
      </table>
    </div>
    <table class="t" style="margin-top:10px">
      <tr><th>等級号俸</th><th>勤務時間</th><th>時間外A</th><th>時間外B</th><th>時間外割増</th></tr>
      <tr><td class="r">08-14</td><td class="r" data-keep>118H45</td><td class="r"></td><td class="r"></td><td class="r"></td></tr>
      <tr><th>休日時間</th><th data-keep>深夜時間</th><th data-keep>乗務時間</th><th>不就労時間</th><th>乗務日数</th></tr>
      <tr><td class="r"></td><td class="r">3H24</td><td class="r" data-keep>57H00</td><td class="r">5H</td><td class="r">12</td></tr>
    </table>
    <div class="sec" style="margin-top:10px">振　込　先</div>
    <table class="t">
      <tr><th style="width:12%">銀　行</th><th style="width:12%">支　店</th>
          <th style="width:20%">口　座　番　号</th><th style="width:18%">振　込　金　額</th><th></th></tr>
      <tr><td data-pii class="mono">0021</td><td data-pii class="mono">318</td>
          <td data-pii class="mono">4820917</td><td class="r mono">719,925</td><td></td></tr>
    </table>
  </div>
</div>
</div>`;

/* ── ⑪ 現実の紙面構成（金額表は上・最下部に振込先・間は空の諸表）─────
   2026-08-05、現実の日本の明細で3回目の確認をした。氏名と役職員番号は黒くなったが
   **最下部の 銀行／支店／口座番号 の行が塗られなかった**。合成13様式はすべて緑だった。

   jp-prose-left（JP7）との違いは1つだけで、そこが全部だった：
     JP7 は振込先の表を**金額表のすぐ下**に置いている。現実の紙面は違う。
     現実は金額表が紙の上半分に集まり、その下に**中身がほとんど空の表**が
     何段も続き、**紙のいちばん下**に振込先が来る。
     本文に対して字が小さく、OCR が最も苦しい位置。

   この配置は、これから入れる「送る枠」の検査そのものでもある：
     ・枠は 支給内訳／控除内訳／差引支給額／勤務時間／累積課税支給額 を**含む**
     ・枠は 最下部の振込先と、左段の人事ブロックを**含まない**
   ＝口座番号は「黒く塗られる」のではなく**画像ごと切り落とされる**のが正解。

   ★ロゴ・氏名・番号・金額・所属はすべて合成。現実の明細の値は1つも入れていない。 */
const JP8 = `
<div style="font-size:10px">
<div style="display:flex;justify-content:space-between;align-items:flex-end">
  <h1 style="font-size:14px">給 与 支 給 明 細 書</h1>
  <div class="sub">2026年 7月分　（支給日 2026/07/25）　氏　名：　<span data-pii>山本　悠</span>　様</div>
</div>
<hr class="rule-thin">
<div style="display:flex;gap:10px;align-items:flex-start">
  <div style="width:27%">
    <div style="border:1px solid #999;padding:7px 8px;font-size:8.5px;line-height:1.62;color:#333">
      本明細は当月の支給内容をお知らせするものです。記載内容にご不明な点がある
      場合は、支給日から一か月以内に給与担当までお問い合わせください。
      ＜お知らせ＞当月より社会保険料率の改定分を反映しています。
    </div>
    <div style="border:1px solid #999;padding:7px 8px;margin-top:8px;font-size:8.5px;line-height:1.62;color:#333">
      住所・扶養等に変更があった場合は、速やかに所定の様式で届け出をお願いいたします。
      各種控除の内訳は控除内訳欄をご確認ください。年末調整の書類は別途送付します。
      明細の再発行をご希望の場合は所定の申請が必要です。＜給与担当より＞
    </div>
    <div style="margin-top:24px;line-height:2.5">
      <div>事業所：　　本　社</div>
      <div>所　属：　　運航二部</div>
      <div>役職員番号：　<span data-pii class="mono">509143k</span></div>
    </div>
    <div style="margin-top:26px;font-size:18px;letter-spacing:.22em;color:#1b3a6b">◯◯◯</div>
  </div>
  <table class="t" style="width:25%">
    <tr><th colspan="2" style="text-align:center;background:#d9f0f2">支　給　内　訳</th></tr>
    <tr><td>本給A</td><td class="r">152,000</td></tr>
    <tr><td>本給B</td><td class="r">214,000</td></tr>
    <tr><td>住宅手当</td><td class="r">8,000</td></tr>
    <tr><td>不就労減額</td><td class="r">-19,000</td></tr>
    <tr><td>職務手当</td><td class="r">455,000</td></tr>
    <tr><td>変動付加乗務時間</td><td class="r">163,000</td></tr>
    <tr><td>変動付加乗務回数</td><td class="r">12,000</td></tr>
    <tr><td>深夜変動付加割増</td><td class="r">2,400</td></tr>
    <tr><td>深夜勤務割増手当</td><td class="r">6,300</td></tr>
    <tr><td>土日祝出勤手当</td><td class="r">5,100</td></tr>
    <tr><td>特別勤務割増手当</td><td class="r">38,000</td></tr>
    <tr><td>航空券課税</td><td class="r">9,000</td></tr>
    <tr><td>株式積立奨励金</td><td class="r">1,000</td></tr>
    <tr><th style="background:#d9f0f2">支　給　合　計</th><th class="r">1,046,800</th></tr>
  </table>
  <table class="t" style="width:25%">
    <tr><th colspan="2" style="text-align:center;background:#d9f0f2">控　除　内　訳</th></tr>
    <tr><td>所得税</td><td class="r">141,000</td></tr>
    <tr><td>地方税</td><td class="r">72,000</td></tr>
    <tr><td>健康保険料</td><td class="r">45,000</td></tr>
    <tr><td>子供子育て支援金</td><td class="r">1,300</td></tr>
    <tr><td>厚生年金保険料</td><td class="r">59,475</td></tr>
    <tr><td>雇用保険料</td><td class="r">5,200</td></tr>
    <tr><td>株式積立金積立額</td><td class="r">10,000</td></tr>
    <tr><td>共済会費</td><td class="r">1,800</td></tr>
    <tr><td>航空券課税</td><td class="r">9,000</td></tr>
    <tr><td>旅客施設使用料</td><td class="r">450</td></tr>
    <tr><th style="background:#d9f0f2">控　除　合　計</th><th class="r">345,225</th></tr>
    <tr><th style="background:#d9f0f2">差　引　支　給　額</th><th class="r">701,575</th></tr>
  </table>
</div>
<!-- ここから下は、実物では**ほとんど空**の表が何段も続く。
     金額表と振込先の間を物理的に離しているのがこの帯で、
     枠の自動配置が「孤立した1行」を拾わないことの検査になる。 -->
<div style="display:flex;gap:10px;margin-top:8px">
  <table class="t" style="width:52%">
    <tr><th>等級号俸</th><th>勤務時間</th><th>時間外A</th><th>時間外B</th><th>時間外割増</th></tr>
    <tr><td class="r">08-14</td><td class="r" data-keep>118H45</td><td class="r"></td><td class="r"></td><td class="r"></td></tr>
    <tr><th>休日時間</th><th data-keep>深夜時間</th><th data-keep>乗務時間</th><th>不就労時間</th><th>乗務日数</th></tr>
    <tr><td class="r"></td><td class="r">3H24</td><td class="r" data-keep>57H00</td><td class="r">5H</td><td class="r">12</td></tr>
  </table>
  <table class="t" style="flex:1">
    <tr><th>貸　付　金</th><th>残　高</th><th></th></tr>
    <tr><td class="r"></td><td class="r"></td><td></td></tr>
  </table>
</div>
<table class="t" style="margin-top:8px">
  <tr><th style="width:14%">課税対象額</th><td class="r" style="width:16%">946,000 円</td>
      <th style="width:14%">一時金税率</th><td class="r" style="width:8%"></td>
      <th style="width:12%">出勤日数</th><td class="r" style="width:6%">12</td>
      <th style="width:12%">欠勤日数</th><td class="r" style="width:6%">0</td>
      <th style="width:16%" data-keep>累積課税支給額</th><td class="r" data-keep>5,914,300 円</td></tr>
</table>
<div style="display:flex;gap:10px;margin-top:8px">
  <table class="t" style="width:40%">
    <tr><th colspan="3">財　形　・　積　立　欄</th></tr>
    <tr><td style="height:16px"></td><td>一般財形</td><td class="r"></td></tr>
    <tr><td></td><td>住宅財形</td><td class="r"></td></tr>
    <tr><td>計</td><td>年金財形</td><td class="r"></td></tr>
  </table>
  <table class="t" style="width:22%">
    <tr><th colspan="3">扶　養　情　報</th></tr>
    <tr><td>配偶者</td><td class="r"></td><td>人</td></tr>
    <tr><td>扶　養</td><td class="r"></td><td>人</td></tr>
    <tr><td>控除割合</td><td class="r"></td><td>％</td></tr>
  </table>
  <table class="t" style="flex:1">
    <tr><th>（備　考）</th></tr>
    <tr><td style="height:52px"></td></tr>
  </table>
</div>
<!-- ★紙のいちばん下。本文より小さく、金額表からいちばん遠い。
     見出しの下に値が来るので、見出しだけ塗っても口座番号は出ていく。 -->
<table class="t" style="margin-top:8px;width:52%;font-size:9px">
  <tr><th style="width:16%">銀　行</th><th style="width:14%">支　店</th>
      <th style="width:26%">口　座　番　号</th><th style="width:26%">振　込　金　額</th><th></th></tr>
  <tr><td data-pii class="mono">0037</td><td data-pii class="mono">412</td>
      <td data-pii class="mono">5207164</td><td class="r mono">701,575</td><td></td></tr>
</table>
</div>`;

/* ── ⑫ 振込先が「金額表のすぐ下」に来る様式（3つ）──────────────
   JP8（現実の紙面）は、金額表と振込先の間に空の表が何段も挟まる。
   現実にはもう一方の並びもあって、そちらのほうが枠にとって難しい：
   **表の直下、行送り2つぶんだけ空けて**振込先が来る形。
   離れていれば「孤立した行」として枠から落ちるが、近いと frameFrom の
   拾い直しが表の続きと見なして枠の中へ入れてしまう＝口座番号がそのまま外へ出る。

   口座を守る道は3本あって、**どれか1本でも通れば守れる**。
   3つに割るのは、その3本を別々に測るため（1つの様式に混ぜると、
   どれが効いて緑になったのか分からなくなり、1本折れても気づけない）：
     row     … 見出しが読めた日   → 4-b（銀行系の帯だけ行の右端まで塗る）
     noword  … 見出しが1文字も無い → 4-a（値だけの行を行ごと塗る）
     misread … 見出しが誤読された  → 4-c（「ロ座番号」を手がかり表に持つ）
   どの様式も、黒塗りで守っても枠の切り落としで守ってもよい。
   検査は「枠の外か黒塗りか」しか見ない＝実装の自由を残す。

   ★金額・番号・氏名はすべて合成。実物の値は1つも入れていない。 */
const XFER = (block) => `
<div style="font-size:11px">
<div style="display:flex;justify-content:space-between;align-items:flex-end">
  <h1 style="font-size:15px">給 与 支 給 明 細 書</h1>
  <div class="sub">2026年 7月分　（支給日 2026/07/25）　氏　名：　<span data-pii>川口　彩</span>　様</div>
</div>
<hr class="rule-thin">
<div style="display:flex;gap:10px;align-items:flex-start">
  <table class="t" style="width:34%">
    <tr><th colspan="2" style="text-align:center;background:#d9f0f2">支　給　内　訳</th></tr>
    <tr><td>本給A</td><td class="r">168,000</td></tr>
    <tr><td>本給B</td><td class="r">203,000</td></tr>
    <tr><td>職務手当</td><td class="r">441,000</td></tr>
    <tr><td>変動付加乗務時間</td><td class="r">157,000</td></tr>
    <tr><td>深夜勤務割増手当</td><td class="r">6,300</td></tr>
    <tr><td>住宅手当</td><td class="r">8,000</td></tr>
    <tr><th style="background:#d9f0f2">支　給　合　計</th><th class="r">983,300</th></tr>
  </table>
  <table class="t" style="width:34%">
    <tr><th colspan="2" style="text-align:center;background:#d9f0f2">控　除　内　訳</th></tr>
    <tr><td>所得税</td><td class="r">138,000</td></tr>
    <tr><td>地方税</td><td class="r">69,000</td></tr>
    <tr><td>健康保険料</td><td class="r">44,000</td></tr>
    <tr><td>厚生年金保険料</td><td class="r">59,475</td></tr>
    <tr><td>雇用保険料</td><td class="r">5,200</td></tr>
    <tr><td>共済会費</td><td class="r">1,800</td></tr>
    <tr><th style="background:#d9f0f2">控　除　合　計</th><th class="r">281,725</th></tr>
    <tr><th style="background:#d9f0f2">差　引　支　給　額</th><th class="r">701,575</th></tr>
  </table>
  <div style="width:28%;line-height:2.6;font-size:10px">
    <div>事業所：　　本　社</div>
    <div>所　属：　　運航二部</div>
    <div>役職員番号：　<span data-pii class="mono">509143k</span></div>
  </div>
</div>
<table class="t" style="margin-top:8px;width:62%">
  <tr><th>等級号俸</th><th>勤務時間</th><th data-keep>深夜時間</th><th data-keep>乗務時間</th><th>乗務日数</th></tr>
  <tr><td class="r">08-14</td><td class="r" data-keep>118H45</td><td class="r">3H24</td>
      <td class="r" data-keep>57H00</td><td class="r">12</td></tr>
</table>
<!-- ★行送り2つぶんだけ空ける。ここが要点で、これ以上離すと「孤立した行」として
     枠が勝手に落としてしまい、4-a〜4-d を1つも通らないまま緑になる。 -->
<div style="height:26px"></div>
${block}
</div>`;

/* ⑫-1 見出しが読める（4-b：銀行系の帯だけ行の右端まで塗る） */
const XFER_ROW = XFER(`
<table class="t" style="width:52%;font-size:9px">
  <tr><th style="width:16%">銀　行</th><th style="width:14%">支　店</th>
      <th style="width:26%">口　座　番　号</th><th style="width:26%">振　込　金　額</th><th></th></tr>
  <tr><td data-pii class="mono">0037</td><td data-pii class="mono">412</td>
      <td data-pii class="mono">5207164</td><td class="r mono">701,575</td><td></td></tr>
</table>`);

/* ⑫-2 見出しが1文字も無い（4-a：値だけの行を行ごと塗る）
   ★実物でこうなる筋は2つある。もともと見出しを刷っていない様式と、
     見出しの字だけが小さすぎて OCR に1文字も返ってこない場合。
     どちらでも、値の行の**形**（項目名が1つも無く、数字が6桁以上続く）は変わらない。 */
const XFER_NOWORD = XFER(`
<table class="t" style="width:52%;font-size:9px">
  <tr><td data-pii class="mono">0037</td><td data-pii class="mono">412</td>
      <td data-pii class="mono">5207164</td><td class="r mono">701,575</td><td></td></tr>
</table>`);

/* ⑫-3 見出しが誤読された形（4-c：手がかり表に誤読形を持つ）
   「口　座　番　号」は全角空きで組まれていて、OCR が「ロロ座番号」と返す（実測）。
   その返り値をそのまま刷って、手がかり表の側だけで当てられることを見る。 */
const XFER_MISREAD = XFER(`
<table class="t" style="width:52%;font-size:9px">
  <tr><th style="width:16%">銀　行</th><th style="width:14%">支　店</th>
      <th style="width:26%">ロ座番号</th><th style="width:26%">振込金額</th><th></th></tr>
  <tr><td data-pii class="mono">0037</td><td data-pii class="mono">412</td>
      <td data-pii class="mono">5207164</td><td class="r mono">701,575</td><td></td></tr>
</table>`);

/* ── ⑩ ページ全体のスクリーンショット（明細はその一部）─────────
   給与ポータルのページごと撮った画像は not_a_payslip で弾かれ、
   明細の部分だけを切り出すと全項目正しく入った。
   ＝関数が「大きなページの中から明細を探す」ことを知らなかった。
   その修正（systemPrompt の1段落）が効いているかを実測するための1枚。

   ★これは payslips.json に入れない＝黒塗りテストの採点対象にしない。
     この画像で測りたいのは**関数が明細を見つけられるか**であって、
     黒塗りの命中率ではない。混ぜると、どちらが落ちたのか分からなくなる。 */
const PORTAL = `
<div style="background:#1b3a6b;color:#fff;padding:14px 22px;display:flex;justify-content:space-between;align-items:center">
  <b style="font-size:15px;letter-spacing:.08em">CREW PORTAL</b>
  <span style="font-size:12px">ホーム　勤務　給与　申請　設定　ログアウト</span>
</div>
<div style="padding:22px 26px;background:#f4f6f9">
  <h1 style="font-size:20px;margin-bottom:6px">給与明細の照会</h1>
  <p class="sub" style="margin-bottom:4px">最新の明細を表示しています。過去24か月分をダウンロードできます。</p>
  <p class="sub">ご不明な点は人事部給与課までお問い合わせください（内線 2231）。</p>
  <div style="margin-top:14px;padding:10px 12px;background:#fffbe6;border:1px solid #e6d48a;font-size:12px">
    お知らせ：システム更新のため、8月10日 2:00〜5:00 は照会をご利用いただけません。
  </div>
  <div style="margin-top:16px;background:#fff;border:1px solid #ccd3dd;padding:22px 24px">
    ${JP1}
  </div>
  <div style="margin-top:16px;font-size:12px;color:#555">
    <b>利用者の声</b><br>
    「明細をその場で確認できるようになって助かっています。」— 運航乗務員 A<br>
    「過去分のダウンロードが早くなりました。」— 客室乗務員 B
  </div>
  <div style="margin-top:18px;padding-top:10px;border-top:1px solid #ccd3dd;font-size:11px;color:#777">
    © CREW PORTAL　利用規約　プライバシーポリシー　ヘルプ
  </div>
</div>`;

/* ── PDF の2ページ目（送られてはいけない側）──────────────────
   data-pii ではなく data-pii2。採点対象にしない＝「ここが黒いこと」は求めない。
   求めるのは**そもそも送る画像に入っていないこと**なので、測るのは1ページ目だけ。 */
const PAGE2 = `
<h1 style="font-size:16px">SALARY STATEMENT &mdash; page 2 of 2</h1>
<div class="sub" style="margin-top:4px">Continued from the previous page</div>
<hr class="rule">
<div style="font-size:12px;line-height:2">
  <div><span style="color:#555">Name</span> <b data-pii2>M. K. OKONKWO</b></div>
  <div><span style="color:#555">Staff No</span> <span data-pii2 class="mono">903477</span></div>
  <div><span style="color:#555">IBAN</span> <span data-pii2 class="mono">AE33 0221 9988 7766 5544 332</span></div>
</div>
<table class="t" style="margin-top:14px">
  <tr><th colspan="2">YEAR TO DATE (AED)</th></tr>
  <tr><td>Gross Pay</td><td class="r">519,904.00</td></tr>
  <tr><td>Total Deductions</td><td class="r">11,238.50</td></tr>
</table>`;

/* ════════════════════════════════════════════════════════════════
   ⑬〜⑯ 欧州・中国・韓国（2026-08-14 追加）

   なぜ足すか: それまで測っていたのは 日本4／湾岸3／米国1 の8枚だけで、
   欧州・中国・韓国は**1枚も無かった**。「海外もほぼ対応できる」と言う根拠が無い。

   ★1枚に1つ、**実際に金額が変わる罠**を持たせる。「言語が違うだけ」の様式は足さない。
     測る値打ちがあるのは、外したときに年収が桁ごと変わる所だけ。

     eu-de  小数点がコンマ・桁区切りがピリオド（8.450,00）
     eu-fr  桁区切りが空白（7 980,00）＋ 年間累計（Cumul）の列が横に並ぶ
     cn     CNY なのに ¥ で印字（JPY と読むと年収が20分の1）
     kr     桁が大きい（8,400,000원）

   ★eu-de の罠が今回いちばん重い。index.ts の numOr() は [^0-9.] を捨てるので、
     モデルが "8.450,00" を**文字列のまま**返すと 8.45 になる。
     しかも支給の各行も印字された支給合計も同じ倍率でずれるため、
     こちら側の検算（Σ earnings ≒ gross_total／gross − deductions ≒ net）が
     **両方とも成立してしまう**。confidence も high のまま。
     ＝年収が1000分の1になって、何も警告が出ない。
     この形は欧州の様式を1枚入れるまで永久に見えない。

   数字は1つ残らず作り話。氏名も架空。実物はこのリポジトリに一度も入れていない。
   ════════════════════════════════════════════════════════════════ */

/* ── ⑬ ドイツ（EUR・独語・小数点がコンマ）───────────────────── */
const EU_DE = `
<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div><h1>Gehaltsabrechnung</h1>
  <div class="sub" style="margin-top:4px">Abrechnungsmonat 07/2026 &nbsp;|&nbsp; Flugbetrieb</div></div>
  <div style="text-align:right;font-size:12px;line-height:1.9">
    <div><span style="color:#555">Name</span> <b data-pii>T. WEGENER</b></div>
    <div><span style="color:#555">Personalnummer</span> <span data-pii class="mono">4471928</span></div>
    <div><span style="color:#555">Funktion / Muster</span> Kapitän / A320</div>
  </div>
</div>
<div style="margin-top:6px;font-size:12px"><span style="color:#555">IBAN</span>
  <span data-pii class="mono">DE44 5001 0517 0093 2081 76</span></div>
<hr class="rule">
<table class="t">
  <tr><th colspan="2">Bezüge (EUR)</th></tr>
  <tr><td>Grundvergütung</td><td class="r">8.450,00</td></tr>
  <tr><td>Funktionszulage</td><td class="r">2.100,00</td></tr>
  <tr><td>Flugstundenvergütung</td><td class="r">3.286,40</td></tr>
  <tr><td>Nachtflugzulage</td><td class="r">412,50</td></tr>
  <tr><td>Spesen (steuerfrei)</td><td class="r">968,00</td></tr>
  <tr><th>Gesamtbrutto</th><th class="r">15.216,90</th></tr>
</table>
<table class="t" style="margin-top:12px">
  <tr><th colspan="2">Abzüge (EUR)</th></tr>
  <tr><td>Gesetzliche Abzüge</td><td class="r">6.104,22</td></tr>
  <tr><th>Auszahlungsbetrag</th><th class="r">9.112,68</th></tr>
</table>
<table class="t" style="margin-top:12px">
  <tr><th colspan="6">Zeiten</th></tr>
  <tr><td>Blockstunden</td><td class="r" data-keep>78,2</td>
      <td>Dienststunden</td><td class="r" data-keep>164,5</td>
      <td>Nachtstunden</td><td class="r">11,0</td></tr>
</table>`;

/* ── ⑭ フランス（EUR・仏語・桁区切りが空白＋年間累計の列）──────
   ★Cumul（年間累計）が右に並ぶのはフランスの様式では標準。
     P0-3 でプロンプトに入れた「今月の列を読め」が、英語以外でも効くかを見る。
   ★2026-08-14 の実測で通貨が null で返った。原因はモデルではなくこの紙で、
     € も EUR も**どこにも印字していなかった**（言語だけで EUR と決めさせるのは
     「推測するな」に反するので、null は正しい答えだった）。
     実物の bulletin de paie は金額の列見出しに € を出すので、そう直した。
     ここが測りたいのは通貨ではなく「空白の桁区切り」と「年間累計の列」。 */
const EU_FR = `
<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div><h1>Bulletin de paie</h1>
  <div class="sub" style="margin-top:4px">Période : Juillet 2026 &nbsp;|&nbsp; Personnel navigant technique</div></div>
  <div style="text-align:right;font-size:12px;line-height:1.9">
    <div><span style="color:#555">Nom</span> <b data-pii>C. LAVOIE</b></div>
    <div><span style="color:#555">Matricule</span> <span data-pii class="mono">82214</span></div>
    <div><span style="color:#555">Fonction</span> Commandant de bord / A350</div>
  </div>
</div>
<div style="margin-top:6px;font-size:12px"><span style="color:#555">IBAN</span>
  <span data-pii class="mono">FR76 3000 4008 2800 0123 4567 890</span></div>
<hr class="rule">
<table class="t">
  <tr><th>Éléments de rémunération</th><th class="r" style="width:130px">Mois (€)</th>
      <th class="r" style="width:130px">Cumul annuel (€)</th></tr>
  <tr><td>Salaire de base</td><td class="r">7 980,00</td><td class="r">55 860,00</td></tr>
  <tr><td>Prime de commandement</td><td class="r">1 850,00</td><td class="r">12 950,00</td></tr>
  <tr><td>Indemnité de vol</td><td class="r">3 142,60</td><td class="r">21 998,20</td></tr>
  <tr><td>Prime de nuit</td><td class="r">386,00</td><td class="r">2 702,00</td></tr>
  <tr><td>Indemnités de séjour</td><td class="r">1 024,00</td><td class="r">7 168,00</td></tr>
  <tr><th>TOTAL BRUT</th><th class="r">14 382,60</th><th class="r">100 678,20</th></tr>
  <tr><td>Total des retenues</td><td class="r">5 613,45</td><td class="r">39 294,15</td></tr>
  <tr><th>NET À PAYER</th><th class="r">8 769,15</th><th class="r">61 384,05</th></tr>
</table>
<table class="t" style="margin-top:12px">
  <tr><th colspan="6">Temps de vol</th></tr>
  <tr><td>Heures de vol</td><td class="r" data-keep>80,4</td>
      <td>Heures de service</td><td class="r" data-keep>171,0</td>
      <td>Heures de nuit</td><td class="r">12,5</td></tr>
</table>`;

/* ── ⑮ 中国（CNY・簡体字。★通貨記号が ¥）────────────────────
   人民元は ¥ でも印字される。日本円と同じ記号なので、記号だけで通貨を決めると
   45,000元 が 45,000円 になる＝年収が20分の1。国・言語から判断させたい。 */
const CN = `
<div class="sc">
<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div><h1>工资单</h1>
  <div class="sub" style="margin-top:4px">2026年7月 &nbsp;|&nbsp; 飞行部</div></div>
  <div style="text-align:right;font-size:12px;line-height:1.9">
    <div><span style="color:#555">姓名</span> <b data-pii>陈 一鸣</b></div>
    <div><span style="color:#555">工号</span> <span data-pii class="mono">20194417</span></div>
    <div><span style="color:#555">职务 / 机型</span> 机长 / B737</div>
  </div>
</div>
<div style="margin-top:6px;font-size:12px"><span style="color:#555">开户行</span> 某某银行
  &nbsp;<span style="color:#555">账号</span> <span data-pii class="mono">6222 0212 3456 7890</span></div>
<hr class="rule">
<table class="t">
  <tr><th colspan="2">应发项目</th></tr>
  <tr><td>基本工资</td><td class="r">¥38,500</td></tr>
  <tr><td>职务津贴</td><td class="r">¥12,000</td></tr>
  <tr><td>飞行小时费</td><td class="r">¥26,480</td></tr>
  <tr><td>夜航补贴</td><td class="r">¥3,200</td></tr>
  <tr><td>过夜补贴</td><td class="r">¥5,600</td></tr>
  <tr><td>住房补贴</td><td class="r">¥6,000</td></tr>
  <tr><th>应发合计</th><th class="r">¥91,780</th></tr>
</table>
<table class="t" style="margin-top:12px">
  <tr><th colspan="2">扣款项目</th></tr>
  <tr><td>扣款合计</td><td class="r">¥18,942</td></tr>
  <tr><th>实发工资</th><th class="r">¥72,838</th></tr>
</table>
<table class="t" style="margin-top:12px">
  <tr><th colspan="6">考勤</th></tr>
  <tr><td>飞行小时</td><td class="r" data-keep>76.5</td>
      <td>值勤小时</td><td class="r" data-keep>158.0</td>
      <td>夜航小时</td><td class="r">9.5</td></tr>
</table>
</div>`;

/* ── ⑯ 韓国（KRW・ハングル。★桁が大きい）───────────────────
   ウォンは百万の桁が普通。0を1つ落とすと年収が10分の1になるが、
   支給合計との検算では拾えない（全部同じ倍率でずれるため）。 */
const KR = `
<div class="kr">
<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div><h1>급여명세서</h1>
  <div class="sub" style="margin-top:4px">2026년 7월 &nbsp;|&nbsp; 운항승무팀</div></div>
  <div style="text-align:right;font-size:12px;line-height:1.9">
    <div><span style="color:#555">성명</span> <b data-pii>정 시우</b></div>
    <div><span style="color:#555">사번</span> <span data-pii class="mono">91-4417</span></div>
    <div><span style="color:#555">직책 / 기종</span> 기장 / B787</div>
  </div>
</div>
<div style="margin-top:6px;font-size:12px"><span style="color:#555">은행</span> ○○은행
  &nbsp;<span style="color:#555">계좌번호</span> <span data-pii class="mono">110-482-771903</span></div>
<hr class="rule">
<table class="t">
  <tr><th colspan="2">지급 항목 (KRW)</th></tr>
  <tr><td>기본급</td><td class="r">8,400,000</td></tr>
  <tr><td>직책수당</td><td class="r">2,100,000</td></tr>
  <tr><td>비행수당</td><td class="r">5,880,000</td></tr>
  <tr><td>야간비행수당</td><td class="r">640,000</td></tr>
  <tr><td>체재비</td><td class="r">920,000</td></tr>
  <tr><td>주택수당</td><td class="r">1,200,000</td></tr>
  <tr><th>지급총액</th><th class="r">19,140,000</th></tr>
</table>
<table class="t" style="margin-top:12px">
  <tr><th colspan="2">공제 항목 (KRW)</th></tr>
  <tr><td>공제총액</td><td class="r">4,231,500</td></tr>
  <tr><th>실지급액</th><th class="r">14,908,500</th></tr>
</table>
<table class="t" style="margin-top:12px">
  <tr><th colspan="6">근태</th></tr>
  <tr><td>비행시간</td><td class="r" data-keep>79.8</td>
      <td>근무시간</td><td class="r" data-keep>166.0</td>
      <td>야간시간</td><td class="r">10.2</td></tr>
</table>
</div>`;

/* ── ⑰ 豪州（AUD・英語。★通貨記号が $ だけ／手当の名前が語彙に無い）──────
   実務で使われている言い方をそのまま載せてある：
     Flight Productivity Pay / Sector Pay / FDP Allowance / Flying Allowance
   4行とも「飛行に紐づく変動給」だが、どれも語彙（EARNING_KINDS）には無い名前。
   ★この1枚が、2026-08-14 の作り直し（分類できなくても金額は数える）が
     本当に効くかを end-to-end で測る枚になる。落ちれば年収の3割が消える。
   ★通貨は $ としか印字しない。USD と読むと年収が約1.5倍。
     記号だけで決めさせないための根拠語として PAYG Tax / Salary Sacrifice /
     Superannuation を紙面に置く（豪州にしか無い言い方）。中国の ¥ と同じ考え方。*/
const AU = `
<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div><h1 style="letter-spacing:.06em">PAYSLIP</h1>
  <div class="sub" style="margin-top:4px">Pay period ending 31 Jul 2026 &nbsp;|&nbsp; Flight Crew</div></div>
  <div style="text-align:right;font-size:12px;line-height:1.9">
    <div><span style="color:#555">Employee</span> <b data-pii>K. WHITFIELD</b></div>
    <div><span style="color:#555">Employee No</span> <span data-pii class="mono">30714</span></div>
    <div><span style="color:#555">Rank / Fleet</span> Captain / A330</div>
  </div>
</div>
<div style="margin-top:6px;font-size:12px"><span style="color:#555">BSB / Account</span>
  <span data-pii class="mono">062-000 &nbsp;1145 8827</span></div>
<hr class="rule">
<table class="t">
  <tr><th colspan="2">EARNINGS ($)</th></tr>
  <tr><td>Base Salary</td><td class="r">9,420.00</td></tr>
  <tr><td>Command Allowance</td><td class="r">1,850.00</td></tr>
  <tr><td>Flight Productivity Pay</td><td class="r">3,240.00</td></tr>
  <tr><td>Sector Pay</td><td class="r">1,485.00</td></tr>
  <tr><td>FDP Allowance</td><td class="r">962.50</td></tr>
  <tr><td>Flying Allowance</td><td class="r">1,120.00</td></tr>
  <tr><td>Meal &amp; Incidentals</td><td class="r">684.00</td></tr>
  <tr><th>Gross Earnings</th><th class="r">18,761.50</th></tr>
</table>
<table class="t" style="margin-top:12px">
  <tr><th colspan="2">DEDUCTIONS ($)</th></tr>
  <tr><td>PAYG Tax</td><td class="r">5,208.00</td></tr>
  <tr><td>Salary Sacrifice</td><td class="r">2,061.77</td></tr>
  <tr><th>Total Deductions</th><th class="r">7,269.77</th></tr>
  <tr><th>Net Pay</th><th class="r">11,491.73</th></tr>
</table>
<div style="margin-top:8px;font-size:12px;color:#555">
  Superannuation (employer, not included in gross) &nbsp; 1,032.77</div>
<table class="t" style="margin-top:12px">
  <tr><th colspan="6">FLIGHT &amp; DUTY</th></tr>
  <tr><td>Block Hours</td><td class="r" data-keep>74.6</td>
      <td>Duty Hours</td><td class="r" data-keep>152.4</td>
      <td>Night Hours</td><td class="r">8.9</td></tr>
</table>`;

/* ── ⑱ ブラジル（BRL・ポルトガル語。★ピリオドが桁区切り・コンマが小数点）──
   14.280,00 を英語式に読むと 14.28 ＝ **年収が1000分の1**。
   しかも支給の合計・控除・手取りが全部同じ倍率でずれるので、
   検算（支給−控除＝手取り）は素通りする。★数字の読み方は検算では守れない。 */
const BR = `
<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div><h1>Demonstrativo de Pagamento</h1>
  <div class="sub" style="margin-top:4px">Competência: Julho/2026 &nbsp;|&nbsp; Tripulação Técnica</div></div>
  <div style="text-align:right;font-size:12px;line-height:1.9">
    <div><span style="color:#555">Nome</span> <b data-pii>R. F. ALMEIDA</b></div>
    <div><span style="color:#555">Matrícula</span> <span data-pii class="mono">55218</span></div>
    <div><span style="color:#555">Função / Frota</span> Comandante / B737</div>
  </div>
</div>
<div style="margin-top:6px;font-size:12px"><span style="color:#555">Banco / Conta</span>
  <span data-pii class="mono">341 &nbsp;01234-5 &nbsp;88217-0</span></div>
<hr class="rule">
<table class="t">
  <tr><th colspan="2">Proventos (R$)</th></tr>
  <tr><td>Salário base</td><td class="r">14.280,00</td></tr>
  <tr><td>Adicional de comando</td><td class="r">3.560,00</td></tr>
  <tr><td>Adicional de voo</td><td class="r">6.842,50</td></tr>
  <tr><td>Adicional noturno</td><td class="r">918,40</td></tr>
  <tr><td>Diárias</td><td class="r">2.140,00</td></tr>
  <tr><td>Auxílio moradia</td><td class="r">1.900,00</td></tr>
  <tr><th>Total de proventos</th><th class="r">29.640,90</th></tr>
</table>
<table class="t" style="margin-top:12px">
  <tr><th colspan="2">Descontos (R$)</th></tr>
  <!-- ★data-keep：この金額は塗ってはいけない。実測で、手がかり語 'conto' が
       「descontos」に当たって行ごと黒くなり、控除合計が読めなくなった。 -->
  <tr><td>Total de descontos</td><td class="r" data-keep>8.412,36</td></tr>
  <tr><th>Líquido a receber</th><th class="r">21.228,54</th></tr>
</table>
<table class="t" style="margin-top:12px">
  <tr><th colspan="6">Horas</th></tr>
  <tr><td>Horas de voo</td><td class="r" data-keep>77,4</td>
      <td>Horas de serviço</td><td class="r" data-keep>161,2</td>
      <td>Horas noturnas</td><td class="r">10,6</td></tr>
</table>`;

/* ── ⑲ インドネシア（IDR・インドネシア語。★桁が極端に大きく小数点が無い）──
   62.400.000 を「62.4」と読むと **年収が100万分の1**。
   韓国（百万の桁）を1段きつくした形で、桁を落としても紙面の中では
   つじつまが合ってしまう。★ここも検算では守れない。 */
const ID_ = `
<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div><h1>Slip Gaji</h1>
  <div class="sub" style="margin-top:4px">Periode: Juli 2026 &nbsp;|&nbsp; Awak Pesawat</div></div>
  <div style="text-align:right;font-size:12px;line-height:1.9">
    <div><span style="color:#555">Nama</span> <b data-pii>B. PRASETYA</b></div>
    <div><span style="color:#555">NIK</span> <span data-pii class="mono">88213</span></div>
    <div><span style="color:#555">Jabatan / Armada</span> Kapten / B737</div>
  </div>
</div>
<div style="margin-top:6px;font-size:12px"><span style="color:#555">Bank / Rekening</span>
  <span data-pii class="mono">009 &nbsp;1420 5583 71</span></div>
<hr class="rule">
<table class="t">
  <tr><th colspan="2">Penghasilan (Rp)</th></tr>
  <tr><td>Gaji pokok</td><td class="r">Rp 62.400.000</td></tr>
  <tr><td>Tunjangan jabatan</td><td class="r">Rp 14.800.000</td></tr>
  <tr><td>Tunjangan terbang</td><td class="r">Rp 28.650.000</td></tr>
  <tr><td>Tunjangan malam</td><td class="r">Rp 3.720.000</td></tr>
  <tr><td>Uang saku</td><td class="r">Rp 6.480.000</td></tr>
  <tr><td>Tunjangan perumahan</td><td class="r">Rp 9.200.000</td></tr>
  <tr><th>Total penghasilan</th><th class="r">Rp 125.250.000</th></tr>
</table>
<table class="t" style="margin-top:12px">
  <tr><th colspan="2">Potongan (Rp)</th></tr>
  <tr><td>Total potongan</td><td class="r">Rp 21.930.000</td></tr>
  <tr><th>Gaji bersih</th><th class="r">Rp 103.320.000</th></tr>
</table>
<table class="t" style="margin-top:12px">
  <tr><th colspan="6">Jam Terbang</th></tr>
  <tr><td>Jam blok</td><td class="r" data-keep>75,8</td>
      <td>Jam tugas</td><td class="r" data-keep>159,4</td>
      <td>Jam malam</td><td class="r">9,7</td></tr>
</table>`;

/* ── ⑯ 米国・保証給と役割手当（2026-08-27 追加。★必ず末尾に足す）──────
   読み取り側が 8-26/8-27 のフォームに追いついたので、その4つを実際に印字した1枚。
   いまある15枚のどれにも1行も無い印字だけを集めてある：
     ・MIN MONTHLY GUARANTEE … 飛んだ時間（61.20）が契約の下限（73.00）を割った月。
       ★下限そのものを埋める額なので「基本給」ではない（must_not が見張る）
     ・SECTOR PAY           … 変動給。回数に連動する＝画面の10択の sector
     ・INSTRUCTOR PAY - LINE / CHECK AIRMAN OVERRIDE
                           … 役割に対する手当。専用の列（instructor_pay / examiner_pay）へ行く
     ・TIME SUMMARY の MIN MONTHLY GUARANTEE 73.00 … 保証フライトタイム（時間の側）

   ★金額・氏名・便名は1つ残らず作り話。使ったのは「項目名と並び順」だけ。
     Σ支給 = 24,085.43／支給 − 控除 = 手取り まで合わせてある
     （こちら側の検算をすり抜ける読み違いだけが must_not の仕事になるように）。 */
const US_GUAR = `
<pre class="mono" style="font-size:12.5px;line-height:1.65">
                    PILOT PAY STATEMENT   -   JUL 2026

EMPLOYEE: <span data-pii>AVERY, T. R.</span>          FILE #: <span data-pii>0517933</span>
BASE: DFW   SEAT: CA   EQUIP: 32N          SSN: <span data-pii>XXX-XX-2086</span>

EARNINGS                     HOURS        RATE        AMOUNT
  MIN MONTHLY GUARANTEE       73.00      302.11     22,054.03
  SECTOR PAY                  12.00       31.00        372.00
  INSTRUCTOR PAY - LINE        6.00       45.00        270.00
  CHECK AIRMAN OVERRIDE                                850.00
  PER DIEM                   186.00        2.90        539.40
  VACATION                     0.00        0.00          0.00
                                                  ------------
GROSS EARNINGS                                       24,085.43

DEDUCTIONS
  FEDERAL TAX / STATE TAX / FICA / 401K / DUES
TOTAL DEDUCTIONS                                      7,905.61
NET PAY                                              16,179.82

TIME SUMMARY
  BLOCK HOURS  61.20      CREDIT HOURS  68.40
  DUTY HOURS  132.10      MIN MONTHLY GUARANTEE  73.00
</pre>`;

const PAGES = [
  { id: 'jp-major', w: 900, body: JP1 },
  { id: 'jp-lcc', w: 860, body: JP2 },
  { id: 'jp-twocol', w: 940, body: JP3 },
  { id: 'jp-compact', w: 760, body: JP4 },
  { id: 'gulf', w: 900, body: GULF },
  { id: 'us', w: 820, body: US },
  { id: 'jp-footer', w: 900, body: JP5 },
  { id: 'gulf-side', w: 900, body: GULF2 },
  // ★現実に近い密度。幅を大きく取るのが要点（縮小してから OCR する経路を通す）
  { id: 'jp-dense', w: 1800, h: 300, body: JP6 },
  // ★左が罫線なしの「ラベル：　値」。現実の様式で社員番号を塗り残した形
  { id: 'jp-prose-left', w: 1500, h: 300, body: JP7 },
  /* ★現実の紙面配置そのもの。金額表は上半分、下半分は中身が空の表が続き、
     **いちばん下に振込先**。現実の明細で口座が塗り残った配置。
     幅を広く取るのは飾りではなく、最下部の表を本文に対して小さくするため
     ＝OCR がいちばん苦しむ条件を再現している。 */
  { id: 'jp-full', w: 1700, h: 300, body: JP8 },
  /* ★同じ紙面を、**画素だけ粗く**したもの（0.62倍＝最下部の値が 9px→5.6px）。
     jp-full が緑で jp-full-small が赤なら、現実で口座が塗り残る原因は
     「様式の理解」ではなく**元画像の細かさ**だと確定する。
     ここを分けておかないと、次に同じ報告が来たとき、また当てずっぽうに戻る。 */
  { id: 'jp-full-small', w: 1700, h: 300, body: JP8, dsf: 0.62 },
  /* ── PDF（海外の明細はメールで届く PDF がふつう）──────────────
     同じ中身を PDF でも作る。PDF には**文字が文字として**入っているので、
     読み取りではなく**そのまま読む**経路を通る＝OCR の読み違いが起きない。
     ★同じ様式の PNG と対にしてあるのが要点。片方だけ緑になったら、
       壊れているのが「様式の理解」なのか「PDF の経路」なのかが即分かる。 */
  { id: 'pdf-jp', w: 1500, h: 300, body: JP7, pdf: true },
  { id: 'pdf-gulf', w: 900, body: GULF, pdf: true },
  // ★実物配置の PDF 版。PNG と対＝落ちたときに「配置の理解」か「経路」かが即分かる
  { id: 'pdf-jp-full', w: 1700, h: 300, body: JP8, pdf: true },
  /* ★2ページの PDF。規約に「2ページ目以降は送られません」と**保証として**書いた以上、
     2ページ目に別人の氏名・口座を置いて、それが送る画像に入らないことを実測で固定する。
     1ページ目とまったく違う中身にしてあるので、混ざれば縦横比ですぐ分かる。 */
  { id: 'pdf-2page', w: 900, h: 900, body: GULF, body2: PAGE2, pdf: true },
  /* ★振込先が金額表のすぐ下に来る並び。口座を守る道3本を別々に測る。
     幅を広く取るのは飾りではなく、最下部の行を本文に対して小さくするため
     ＝OCR がいちばん苦しい条件で 4-a〜4-d を試す。 */
  { id: 'jp-transfer-row', w: 1400, h: 300, body: XFER_ROW },
  { id: 'jp-transfer-noword', w: 1400, h: 300, body: XFER_NOWORD },
  { id: 'jp-transfer-misread', w: 1400, h: 300, body: XFER_MISREAD },
  /* ── 欧州・中国・韓国（2026-08-14 追加。★必ず末尾に足す）──────────
     先頭が jp-major のままでないと、test-payslip-redact.mjs の
     フォーム検査（fixtures[0] を1枚だけ本物のフォームに落とす）が
     別の様式を指してしまう。並びは PAGES の順がそのまま payslips.json の順。

     locale＝**その国のパイロットの端末**を再現するための印。
     payslip.js:994 の SCRIPT_PACK は端末の言語を見て OCR の言語を1つだけ足す
     （zh→chi_sim / ko→kor）。検査のブラウザは en-US なので、これが無いと
     中国・韓国の様式だけ手がかりが取れず、**実際には起きない落ち方**を測ることになる。
     独仏はラテン文字＝既定の eng で読めるので、locale は通貨・様式の記録として持つ。 */
  { id: 'eu-de', w: 900, locale: 'de-DE', body: EU_DE },
  { id: 'eu-fr', w: 940, locale: 'fr-FR', body: EU_FR },
  { id: 'cn',    w: 900, locale: 'zh-CN', body: CN },
  { id: 'kr',    w: 900, locale: 'ko-KR', body: KR },
  /* ── 豪州・中南米・東南アジア（2026-08-14 追加。★ここも末尾に足す）────────
     3枚ともラテン文字なので OCR の言語は既定の eng で足りる。
     locale は通貨・様式の記録として持つ（読む側が端末の言語を差し替える）。 */
  { id: 'oceania', w: 900, locale: 'en-AU', body: AU },
  { id: 'latam',   w: 940, locale: 'pt-BR', body: BR },
  { id: 'sea',     w: 900, locale: 'id-ID', body: ID_ },
  /* ★保証給・変動給の種類・教官・審査を印字した1枚（2026-08-27）。
     読み取り側を直した所を、実際に採点できるようにするための見本。 */
  { id: 'us-guarantee', w: 820, body: US_GUAR },
  // ★ noScore＝payslips.json に入れない（黒塗りの採点はしない。上の説明を参照）
  { id: 'page-shot', w: 1280, body: PORTAL, noScore: true },
];

/* 引数で id を指定すると、その様式だけ描き直す（既存 PNG を1バイトも動かさない）。
   引数なしなら全部。payslips.json は読んでから該当 id だけ差し替える。 */
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const targets = only.length ? PAGES.filter((p) => only.includes(p.id)) : PAGES;
if (only.length && targets.length !== only.length) {
  throw new Error(`知らない id: ${only.filter((o) => !PAGES.some((p) => p.id === o)).join(', ')}`);
}

// headless:'new' はこの環境で起動しない（'shell' だけが動く）。test 側と揃える。
const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const out = [];

for (const p of targets) {
  const page = await browser.newPage();
  // h は「これ以上は縦に余白を作らない」下限。fullPage なので中身が長ければ伸びる。
  /* dsf＝画素の細かさ。1未満にすると**組版はそのまま・画素だけ粗く**なる。
     正解データは割合で持っているので、粗くしても座標は有効なまま。
     実物の明細は「紙の作りは同じなのに字が潰れている」ことが多く（メールの添付・
     画面の切り取り・写真）、そこだけを切り離して再現するための目盛り。 */
  await page.setViewport({ width: p.w, height: p.h || 900, deviceScaleFactor: p.dsf || 1 });
  /* 2ページものは、1ページぶんの高さの箱を2つ並べて作る。
     紙の高さも同じにする＝**折り返しの位置が確実に箱の境目に来る**。
     ここが1pxでもずれると、下で測る割合の分母（1ページの高さ）と実物が食い違い、
     正解データが静かに無効になる。 */
  const html = p.body2
    ? `<div style="height:${p.h}px;overflow:hidden">${p.body}</div>`
      + `<div style="break-before:page;page-break-before:always;height:${p.h}px;overflow:hidden">${p.body2}</div>`
    : p.body;
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${CSS}</style><body>${html}</body>`,
    { waitUntil: 'load' });
  /* PDF は印刷の組版で出るので、**測るのも印刷の組版で**測る。
     画面の組版で測った座標を PDF に当てると、印刷側だけ改行位置が違ったときに
     正解データが静かにずれる＝テストが嘘をつく。 */
  if (p.pdf) await page.emulateMediaType('print');
  await new Promise((r) => setTimeout(r, 150));

  const doc = await page.evaluate(() => ({
    w: document.documentElement.scrollWidth,
    h: document.documentElement.scrollHeight,
  }));
  /* ★割合の分母は「紙1枚」。2ページものは中身の全長ではなく1ページの高さで割る。
     1ページ目の要素は文書の先頭から測っているので、これでそのまま紙の中の割合になる。 */
  const size = p.body2 ? { w: doc.w, h: p.h } : doc;
  /* 正解データ＝隠れていないと事故になる領域。画像に対する割合で持つ。
     ★測るのは要素の枠ではなく**文字そのもの**（Range で測る）。
       印を <td> に付けた様式では要素の枠＝セル全体になり、
       文字の右にある空白のセル余白まで「黒くなっていること」を要求してしまう。
       それは個人情報の保護とは関係がなく、
       実装に「行の右端まで塗る」以外の選択肢を与えない＝勤務時間の列を潰す実装しか
       通らなくなる。守るべきは「文字が読めないこと」なので、文字を測る。 */
  const boxes = (sel) => page.evaluate((s, sel) => {
    return [...document.querySelectorAll(sel)].map((e) => {
      const g = document.createRange();
      g.selectNodeContents(e);
      const r = g.getBoundingClientRect();
      g.detach && g.detach();
      const b = r.width && r.height ? r : e.getBoundingClientRect();
      return {
        text: e.textContent.trim().slice(0, 24),
        x: b.left / s.w, y: b.top / s.h, w: b.width / s.w, h: b.height / s.h,
      };
    });
  }, size, sel);

  const pii = await boxes('[data-pii]');

  /* data-keep＝**塗ってはいけない**ところ。黒塗りは多めに倒すのが正しいが、
     倒しすぎると勤務時間の列まで潰れて時給が出せなくなる。
     「隠す」だけを測っていると、この失敗は永久に見えない。 */
  const keep = await boxes('[data-keep]');

  const file = `payslip-${p.id}.${p.pdf ? 'pdf' : 'png'}`;
  if (p.pdf) {
    /* 紙の大きさを中身ちょうどにする＝**1ページに収める**。
       ここがずれて2ページ目に溢れると、上で測った割合の分母（紙の高さ）と
       実際の紙が食い違い、正解データが丸ごと無効になる。 */
    await page.pdf({
      path: path.join(DIR, file),
      width: `${size.w}px`, height: `${size.h}px`,
      printBackground: true, pageRanges: p.body2 ? '1-2' : '1',
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  } else {
    await page.screenshot({ path: path.join(DIR, file), fullPage: true });
  }
  await page.close();

  if (!pii.length) throw new Error(`${p.id}: data-pii が1つも無い`);
  if (p.noScore) {
    console.log(`✅ ${file}  ${size.w}×${size.h}  （採点対象外：関数が明細を見つけられるかの実測用）`);
    continue;
  }
  /* ★width/height は **CSS の大きさ**であって画素数ではない。
     dsf を下げた様式（jp-full-small）では、ファイルの実画素はこれより小さい。
     ここに入っている座標はすべて割合なので分母が CSS でも正しいが、
     「送られた画像が何画素か」をこの値から出してはいけない
     （テストは実画素を診断の「元 W×H」から読む）。 */
  const rec = { id: p.id, file, width: size.w, height: size.h, pii };
  // ★端末の言語。読む側（eval / redact テスト）がブラウザの言語を差し替えるのに使う
  if (p.locale) rec.locale = p.locale;
  if (keep.length) rec.keep = keep;
  if (p.body2) rec.pages = 2;                      // 2ページ目が送られないことを見る印
  out.push(rec);
  console.log(`✅ ${file}  ${size.w}×${size.h}`
    + (p.dsf ? `（実画素 ${Math.round(size.w * p.dsf)}×${Math.round(size.h * p.dsf)}）` : '')
    + `  PII ${pii.length} 箇所`
    + (keep.length ? ` / 残す ${keep.length} 箇所` : ''));
}

await browser.close();

/* 部分生成のときは、描き直した id だけ差し替える（他の様式の座標は触らない）。
   並びは PAGES の順に揃える＝テストの出力順が引数によって変わらない。 */
let all = out;
if (only.length) {
  const prev = JSON.parse(readFileSync(path.join(DIR, 'payslips.json'), 'utf8'));
  const merged = new Map(prev.map((e) => [e.id, e]));
  for (const e of out) merged.set(e.id, e);
  all = PAGES.map((p) => merged.get(p.id)).filter(Boolean);
}
writeFileSync(path.join(DIR, 'payslips.json'), JSON.stringify(all, null, 2) + '\n');
console.log(`\n📄 payslips.json（${all.length} 様式・すべて合成／実在の明細ではない）`);
