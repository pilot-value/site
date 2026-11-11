/* ════════════════════════════════════════════════════════════════
   my-analysis.js — マイレポート（MY PAGE の ③ YOUR PAY）の「分析」のタブ（2026-11-09）
   ★オーナー「給与サマリー｜勤務ロスター｜分析」。読み込みは my-value.js がこのタブを開いたときだけ
     （my-analysis.css と pv-report-engine.js が先に届いてから）。

   画面の並び（承認済みの見本 pc-analysis / mobile-analysis の構造）
     見出し（いちばん新しい明細と、その前の同じ通貨の明細を比べる・期間 3か月｜6か月｜1年｜全部） → 4枚のカード（PC 2列・狭い画面 1列）。
       ★2026-11-09 オーナー「比べる明細を選ばせない」「期間を選べるなら 3か月・6か月・1年・全部」「収入の構成を先に」。
       期間が効くのは図の月（A の構成の縦の棒・B の棒・C の推移）と CSV・印刷だけ。見出しの数字と分け方は、いつも b と a。
       ★2026-11-10 オーナー「不要な文言はいらない」「カードの題名がいちいち AI っぽい」：見出し（LOOK DEEPER・題・比べている月）と
         右上の札を外し、題名を中身そのままに。B の題名は「数量の基準」で選んだものに合わせて変わる。
       A 収入の内訳           … 収入の構成（期間に3か月以上なら月ごとの積み上げ・何が動いたか） ／ 増減率の棒
       B ◯◯あたりの収入     … 分子（総支給・手取り）÷ 分母（勤務1時間・乗務1時間・1勤務日・1便）、明細かロスターか
                               ／ 日別の散布図（点を押すとその日の勤務ロスターへ）／ 勤務時間の分布
       C 手当ごとの推移       … 実額の推移・対象の数量・数量で割った参考値・増減の分け方（数量の差による分と残り）
                               ＋ 勤務月が分からない手当には「{手当の名前}は、いつの勤務の分？」（答えは本人が押したときだけ保存）
       D 手当の計算ルール（推定） … 日ごとの超過／月合計の超過／保証。基準の時間を動かし、当てはめた月と検証の月の差を分けて出す

   守っていること
   ・数字は pv-report-engine.js（window.PVReport）の答えだけ。ここで数え直さない・式を写さない。
     金額は通貨の最小単位の整数で受け取り、見せるときだけ「その通貨のいちばん新しい明細のレート」で円にして
     サイトの通貨（PVCurrency）で出す（同じ図の中の額は同じレート＝足し算が画面で合う）。
   ・月は全部データから（年月も、閾値の範囲も、決め打ちしない）。1か月なら構成と額だけ・比較は2か月目から（1行だけ言う）。
   ・参考値（額 ÷ 数量）を契約の単価と呼ばない。増減の「残り」を単価の変更と呼ばない。
     週末・祝日の手当を、勝手に日数で割らない（数量はエンジンが決めたものだけ）。
   ・計算ルールは推定（題名の「（推定）」で言う）。確度の％は作らない。当てはめた月と検証の月の差を分けて出す。
   ・同じ注意書きを2か所に置かない（参考値の断りは B だけ・候補の断りは D だけ・「2か月目から」は見出しだけ）。
   ・隠れているあいだは図を描かない（幅0の SVG を残さない）。見えたとき・幅が変わったとき・通貨を替えたときに描き直す。
   ・選んだ期間・項目・基準の時間は、タブを移っても残る（このファイルの S に持つ）。

   window.PVAnalysis = { mount(el, ctx), show(), hide(), redraw(), _（検査が借りる部品） }
     ctx = { sb, reports（my_pay_reports の行）, items(force) → Promise<{items, maps, ok}>（my_report_items の写し・給与サマリーと共有）,
             segName（my-value.js の区分の名前）, goto(o)（勤務ロスターのタブへ：{date} か {upload:true}） }
   ════════════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';
  var d = w.document;
  var R = w.PVReport;
  if (!R || !R.build) return;                   // 計算の部品が無ければ黙って出さない（my-value.js がエラーの板を出す）
  var L = (w.PV_BASE === 'en' || d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';
  var ES = w.PV_LANG === 'es';

  var T = {
    ja: {
      perAria: '期間', per3: '3か月', per6: '6か月', per12: '1年', perAll: '全部',
      one: '比較は2か月目の明細から出ます。', noPrev: '同じ通貨の前の明細がないので、比較は出ません。',
      ymT: '{y}年{n}月', ymS: '{n}月', payOf: '{t}明細', workOf: '{t}勤務',
      mon: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      err: '分析を読み込めませんでした。時間をおいて開き直してください。',
      psT: '明細から自動入力', psB: ['匿名', '暗号化＆セキュア', '簡単'],
      noCo: 'この会社の明細はまだありません。',
      /* CSV と印刷（選んでいる範囲をそのまま書く） */
      csvA: 'CSVで保存（{r}）', print: '印刷', printA: '表示中の分析を印刷', prRange: '明細 {r}',
      csvRange: '範囲', csvPay: '支給月 {r}', csvSecPay: '明細（支給月）', csvSecRoster: 'スケジュール（勤務月）',
      // A
      aT: '収入の内訳', aRate: '増減率', aComp: '収入の構成',
      from: '{a}から',
      mGross: '総支給', mNet: '手取り', mBlock: '明細の乗務時間', mDuty: '明細の勤務時間', mDays: '勤務日数', mSectors: '便数',
      aStat: '{m} · {a}から', aNone: '比べられる数字がまだありません。', aShare: '固定給の割合 · {t}',
      aMoved: '動いた区分', curDiff: '通貨が違う月どうしの金額は比べていません。',
      aTot: '合計', aCurEx: '通貨が違う{n}か月は入れていません。',
      cFixed: '固定給', cRole: '役割手当', cVariable: '変動給', cAllowance: '手当', cBonus: '賞与・利益配分',
      cNoncash: '現物給与の評価', cAdjustment: '不就労減額', cUnexplained: '内訳なし',
      // B
      bTDuty: '勤務1時間あたりの収入', bTBlock: '乗務1時間あたりの収入', bTDays: '1勤務日あたりの収入', bTSectors: '1便あたりの収入',
      bNum: '収入の基準', nGross: '総支給', nNet: '手取り',
      bDen: '数量の基準', dDuty: '勤務1時間', dBlock: '乗務1時間', dDays: '1勤務日', dSectors: '1便',
      bBasis: '数量の出どころ', bsSlip: '明細', bsRoster: 'スケジュール',
      vEff: '報酬効率', vDay: '日別', vDist: '分布', bViews: '見方',
      bNote: '支給額 ÷ 数量。追加で飛んだ分の単価ではありません。',
      bNoDen: 'この基準の数量が明細にありません。数量の基準を変えてください。',
      rNoRoster: 'この勤務月のスケジュールがありません', rIncomplete: 'スケジュールが月の一部だけです', rGaps: '時刻が読めない日があります',
      rMixed: '通貨が混ざっています', rNoQty: '明細にこの数量がありません',
      bNoLinked: '勤務月を確かめた明細の行がまだありません。手当ごとの推移で答えると出ます。',
      bMonth: '勤務月', dayX: '勤務時間（D-ON〜D-OFF）', dayY: 'フライトタイム（DH を除く）',
      dayNoTimes: '時刻が読めない{n}日は除いています', dayNone: 'この月の勤務はありません。',
      dayTip: '{d}', dayOpen: '押すとスケジュールで開きます',
      distY: '勤務の回数', distBin: '{a}〜{b}時間', distN: '{n}勤務', distPick: '{b} · {n}勤務',
      needRoster: 'スケジュールを足すと出ます', addRoster: 'スケジュールを足す',
      // C
      cT: '手当ごとの推移', cItem: '支給項目', cTotal: '（合計）',
      cStat: '（{p}）{a}から',
      cQty: '対象の数量', cRef: '数量で割った参考値',
      cDec: '増減の分け方', cQtyEff: '数量の差による分', cResid: '残りの差',
      cDecNote: '前の明細の参考値 × 数量の差と、その残り。',
      cNoQty: '対象の数量が分からないので、実額だけで比べています。',
      cNone: '比べられる支給項目がありません。',
      qBlock: '明細の乗務時間', qDuty: '明細の勤務時間', qNight: '明細の深夜時間', qCredit: '明細のクレジット時間', qGuarantee: '保証時間',
      qSectors: '明細の便数', qDutyDays: '明細の勤務日数', qStay: '明細の宿泊数', qDaysOff: '明細の休日数', qRole: '記入した回数・日数',
      qROperating: 'スケジュールの乗務時間', qRDeadhead: 'スケジュールの DH 時間', qRGround: 'スケジュールの地上業務', qRDuty: 'スケジュールの勤務時間',
      qRDutyDays: 'スケジュールの勤務日数', qRSectors: 'スケジュールの便数', qROther: 'スケジュールの数量',
      uH: '/h', uDay: '/日', uCount: '/回', uNight: '/泊',
      kProfit: 'プロフィットシェア', kNotional: '現物給与の評価', kAbsence: '不就労減額',
      wq: '{item}は、いつの勤務の分？', wSame: '当月', wPrev: '前月', wOther: 'その他', wUnknown: 'わからない',
      wHint: 'この明細の乗務時間は、スケジュールの{t}と一致（{h}）', wCand: '候補',
      wSaved: '{t}の勤務として数えています', wUnknownSaved: '勤務月は未確定', wOwn: '月ごとに別の期間',
      wChange: '変更', wSave: '保存', wErr: '保存できませんでした。時間をおいてもう一度お試しください。',
      wOffN: '{n}か月前の勤務', wNext: '翌月の勤務', wOwnOpt: '月ごとに違う',
      // D
      dT: '手当の計算ルール（推定）',
      dKind: '式', kDaily: '日ごとの超過', kMonthly: '月合計の超過', kGuar: '保証',
      dQty: '数える時間', qDutyR: '勤務時間', qBlockR: '乗務時間',
      dThr: '基準の時間', dThrDay: '1日あたり', dThrMonth: '1か月あたり', dGuar: '保証の時間',
      dRate: '候補の1時間あたり', dFit: '当てはめた月', dVal: '検証の月', dFitErr: '当てはめた月（{n}）の最大差', dValErr: '検証の月（{n}）の最大差',
      dNoVal: '検証に回せる月はまだありません',
      dCurve: '明細との最大差（低いほど近い）', dCurveFit: '当てはめた月', dCurveVal: '検証の月',
      dRowM: '勤務 → 明細', dActual: '実額', dPred: '候補式', dGap: '差', roleFit: '当てはめ', roleVal: '検証', roleUnused: '—',
      dDays: '基準を超えた勤務 · {n}件', dDayTip: '{d} · 超えた時間 {h}',
      dSkip: '使っていない月 {n}（勤務月が未確定 {u}・スケジュール不足 {r}・数量なし {q}）',
      dNone: '勤務月が分かる月がまだありません。手当ごとの推移で「いつの勤務の分？」に答えると使えます。',
      dNote: '原点を通る直線で当てはめています。合う月があっても、会社の規程の確認ではありません。',
      dNoItem: '勤務に結びつく支給項目がまだありません。', dNoRange: '月の全部がそろったスケジュールがまだありません。'
    },
    en: {
      perAria: 'Period', per3: '3 months', per6: '6 months', per12: '1 year', perAll: 'All',
      one: 'Comparisons appear from your second payslip.', noPrev: 'No earlier payslip in the same currency, so there is nothing to compare.',
      ymT: '{M} {y}', ymS: '{M}', payOf: '{t} payslip', workOf: '{t} duty',
      mon: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],   // 二重引用符＝訳の辞書の鍵を勤務ロスターの月名と分ける（西の5月を小文字に）
      err: 'Could not load your analysis. Please try again in a moment.',
      psT: 'Auto-fill from a payslip', psB: ['Anonymous', 'Encrypted & secure', 'Quick'],
      noCo: 'No payslips for this airline yet.',
      csvA: 'Save as CSV ({r})', print: 'Print', printA: 'Print this analysis', prRange: 'Payslips {r}',
      csvRange: 'Range', csvPay: 'pay months {r}', csvSecPay: 'Payslips (pay month)', csvSecRoster: 'Roster (duty month)',
      // A
      aT: 'Pay breakdown', aRate: 'Change', aComp: 'Pay mix',
      from: 'from {a}',
      mGross: 'Gross pay', mNet: 'Net pay', mBlock: 'Block hours (payslip)', mDuty: 'Duty hours (payslip)', mDays: 'Duty days', mSectors: 'Sectors',
      aStat: '{m} · from {a}', aNone: 'Nothing to compare yet.', aShare: 'Fixed pay share · {t}',
      aMoved: 'What moved', curDiff: 'Amounts in different currencies are not compared.',
      aTot: 'Total', aCurEx: 'Months in another currency left out: {n}',
      cFixed: 'Fixed pay', cRole: 'Role pay', cVariable: 'Variable pay', cAllowance: 'Allowances', cBonus: 'Bonus & profit share',
      cNoncash: 'Benefits in kind', cAdjustment: 'Absence deductions', cUnexplained: 'Not itemised',
      // B
      bTDuty: 'Pay per duty hour', bTBlock: 'Pay per block hour', bTDays: 'Pay per duty day', bTSectors: 'Pay per sector',
      bNum: 'Pay', nGross: 'Gross pay', nNet: 'Net pay',
      bDen: 'Per', dDuty: 'duty hour', dBlock: 'block hour', dDays: 'duty day', dSectors: 'sector',
      bBasis: 'Quantities from', bsSlip: 'Payslip', bsRoster: "Roster",
      vEff: 'Per unit', vDay: 'By day', vDist: 'Distribution', bViews: 'View',
      bNote: 'Amount paid ÷ quantity. Not the rate for extra flying.',
      bNoDen: "Your payslips don't have this quantity. Choose another basis.",
      rNoRoster: 'No roster for this duty month', rIncomplete: 'Roster covers only part of the month', rGaps: 'Some days have unreadable times',
      rMixed: 'Mixed currencies', rNoQty: 'Not printed on this payslip',
      bNoLinked: 'No payslip lines are matched to a duty month yet. Answer in Allowances over time.',
      bMonth: 'Duty month', dayX: 'Duty time (D-ON to D-OFF)', dayY: 'Flight time (excl. DH)',
      dayNoTimes: 'Days without readable times left out: {n}', dayNone: 'No duties this month.',
      dayTip: '{d}', dayOpen: 'Opens this day in your roster',
      distY: 'Duties', distBin: '{a}–{b} h', distN: 'Duties: {n}', distPick: '{b} · Duties: {n}',
      needRoster: 'Add your roster to see this', addRoster: 'Add roster',
      // C
      cT: 'Allowances over time', cItem: 'Pay item', cTotal: ' (total)',
      cStat: '({p}) from {a}',
      cQty: 'Quantity', cRef: 'Amount ÷ quantity',
      cDec: 'Splitting the change', cQtyEff: 'From the change in quantity', cResid: 'Remainder',
      cDecNote: 'Previous reference value × change in quantity, and what is left over.',
      cNoQty: 'The quantity is unknown, so only the amounts are compared.',
      cNone: 'No pay items to compare.',
      qBlock: 'Block hours (payslip)', qDuty: 'Duty hours (payslip)', qNight: 'Night hours (payslip)', qCredit: 'Credit hours (payslip)', qGuarantee: 'Guaranteed hours',
      qSectors: 'Sectors (payslip)', qDutyDays: 'Duty days (payslip)', qStay: 'Night stops (payslip)', qDaysOff: 'Days off (payslip)', qRole: 'Count you entered',
      qROperating: 'Block time (roster)', qRDeadhead: 'DH time (roster)', qRGround: 'Ground duty (roster)', qRDuty: 'Duty time (roster)',
      qRDutyDays: 'Duty days (roster)', qRSectors: 'Sectors (roster)', qROther: 'Roster quantity',
      uH: '/h', uDay: '/day', uCount: '/each', uNight: '/night',
      kProfit: 'Profit share', kNotional: 'Benefit in kind', kAbsence: 'Absence deduction',
      wq: 'Which duty month is {item} for?', wSame: 'Same month', wPrev: 'Previous month', wOther: 'Other', wUnknown: 'Not sure',
      wHint: 'The block hours on this payslip match {t} on your roster ({h})', wCand: 'Suggested',
      wSaved: 'Counted as {t} duty', wUnknownSaved: 'Duty month not set', wOwn: 'Its own period each month',
      wChange: 'Edit', wSave: 'Save', wErr: 'Could not save. Please try again in a moment.',
      wOffN: 'Duty {n} months earlier', wNext: 'Duty in the following month', wOwnOpt: 'Varies by month',
      // D
      dT: 'Allowance pay rule (estimated)',
      dKind: 'Rule', kDaily: 'Daily excess', kMonthly: 'Monthly excess', kGuar: 'Guarantee',
      dQty: 'Hours counted', qDutyR: 'Duty time', qBlockR: 'Block time',
      dThr: 'Threshold', dThrDay: 'per day', dThrMonth: 'per month', dGuar: 'Guaranteed time',
      dRate: 'Candidate rate per hour', dFit: 'Fitted months', dVal: 'Check months', dFitErr: 'Largest gap · fitted months ({n})', dValErr: 'Largest gap · check months ({n})',
      dNoVal: 'No months left over to check yet',
      dCurve: 'Largest gap to payslip (lower is closer)', dCurveFit: 'Fitted months', dCurveVal: 'Check months',
      dRowM: 'Duty → payslip', dActual: 'Paid', dPred: 'Candidate', dGap: 'Gap', roleFit: 'fit', roleVal: 'check', roleUnused: '—',
      dDays: 'Duties over the threshold · {n}', dDayTip: '{d} · over by {h}',
      dSkip: 'Months not used: {n} (duty month not set {u} · roster incomplete {r} · no quantity {q})',
      dNone: 'No months with a known duty month yet. Answer the duty month question in Allowances over time.',
      dNote: 'Fitted as a straight line through zero. A close fit does not confirm a company rule.',
      dNoItem: 'No pay item linked to duty yet.', dNoRange: 'No roster covers a full month yet.'
    }, /*PV-MSG:es*/ es: {
      perAria: 'Período', per3: '3 meses', per6: '6 meses', per12: '1 año', perAll: 'Todas',
      one: 'Las comparaciones aparecen a partir de tu segundo recibo de nómina.', noPrev: 'No hay un recibo de nómina anterior en la misma moneda, así que no hay nada que comparar.',
      ymT: '{M} {y}', ymS: '{M}', payOf: 'Recibo de {t}', workOf: 'Servicio de {t}',
      mon: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],   // 二重引用符＝訳の辞書の鍵を勤務ロスターの月名と分ける（西の5月を小文字に）
      err: 'No se pudo cargar tu análisis. Inténtalo de nuevo en un momento.',
      psT: 'Autocompletar desde un recibo de nómina', psB: ['Anónimo', 'Cifrado y seguro', 'Rápido'],
      noCo: 'Todavía no hay recibos de nómina de esta aerolínea.',
      csvA: 'Guardar como CSV ({r})', print: 'Imprimir', printA: 'Imprimir este análisis', prRange: 'Recibos de nómina {r}',
      csvRange: 'Rango', csvPay: 'meses de pago {r}', csvSecPay: 'Recibos de nómina (mes de pago)', csvSecRoster: 'Programación (mes de servicio)',
      // A
      aT: 'Desglose de la remuneración', aRate: 'Variación', aComp: 'Composición',
      from: 'desde {a}',
      mGross: 'Sueldo bruto', mNet: 'Sueldo neto', mBlock: 'Horas block (recibo)', mDuty: 'Horas de servicio (recibo)', mDays: 'Días de servicio', mSectors: 'Sectores',
      aStat: '{m} · desde {a}', aNone: 'Todavía no hay nada que comparar.', aShare: 'Proporción de remuneración fija · {t}',
      aMoved: 'Qué cambió', curDiff: 'No se comparan montos en monedas distintas.',
      aTot: 'Total', aCurEx: 'Meses en otra moneda que no se incluyen: {n}',
      cFixed: 'Remuneración fija', cRole: 'Asignaciones por función', cVariable: 'Remuneración variable', cAllowance: 'Asignaciones', cBonus: 'Bono y participación en las utilidades',
      cNoncash: 'Prestaciones en especie', cAdjustment: 'Descuentos por ausencia', cUnexplained: 'Sin desglosar',
      // B
      bTDuty: 'Remuneración por hora de servicio', bTBlock: 'Remuneración por hora block', bTDays: 'Remuneración por día de servicio', bTSectors: 'Remuneración por sector',
      bNum: 'Remuneración', nGross: 'Sueldo bruto', nNet: 'Sueldo neto',
      bDen: 'Por', dDuty: 'hora de servicio', dBlock: 'hora block', dDays: 'día de servicio', dSectors: 'sector',
      bBasis: 'Cantidades según', bsSlip: 'Recibo de nómina', bsRoster: "Programación",
      vEff: 'Por unidad', vDay: 'Por día', vDist: 'Distribución', bViews: 'Vista',
      bNote: 'Monto pagado ÷ cantidad. No es la tarifa por volar horas adicionales.',
      bNoDen: "Tus recibos de nómina no tienen esta cantidad. Elige otra base.",
      rNoRoster: 'No hay programación para este mes de servicio', rIncomplete: 'La programación cubre solo parte del mes', rGaps: 'Algunos días tienen horas ilegibles',
      rMixed: 'Monedas mezcladas', rNoQty: 'No aparece en este recibo de nómina',
      bNoLinked: 'Todavía no hay conceptos del recibo asociados a un mes de servicio. Respóndelo en Evolución por concepto.',
      bMonth: 'Mes de servicio', dayX: 'Tiempo de servicio (D-ON a D-OFF)', dayY: 'Tiempo de vuelo (sin DH)',
      dayNoTimes: 'Días sin horas legibles excluidos: {n}', dayNone: 'No hay servicios este mes.',
      dayTip: '{d}', dayOpen: 'Abre este día en tu programación',
      distY: 'Servicios', distBin: '{a}–{b} h', distN: 'Servicios: {n}', distPick: '{b} · Servicios: {n}',
      needRoster: 'Agrega tu programación para ver esto', addRoster: 'Agregar programación',
      // C
      cT: 'Evolución por concepto', cItem: 'Concepto de pago', cTotal: ' (total)',
      cStat: '({p}) desde {a}',
      cQty: 'Cantidad', cRef: 'Monto ÷ cantidad',
      cDec: 'Cómo se divide la variación', cQtyEff: 'Por la variación de la cantidad', cResid: 'Resto',
      cDecNote: 'Valor de referencia anterior × variación de la cantidad, y lo que queda.',
      cNoQty: 'No se conoce la cantidad, así que solo se comparan los montos.',
      cNone: 'No hay conceptos de pago para comparar.',
      qBlock: 'Horas block (recibo)', qDuty: 'Horas de servicio (recibo)', qNight: 'Horas nocturnas (recibo)', qCredit: 'Horas de crédito (recibo)', qGuarantee: 'Horas garantizadas',
      qSectors: 'Sectores (recibo)', qDutyDays: 'Días de servicio (recibo)', qStay: 'Pernoctas (recibo)', qDaysOff: 'Días libres (recibo)', qRole: 'Cantidad que ingresaste',
      qROperating: 'Tiempo block (programación)', qRDeadhead: 'Tiempo DH (programación)', qRGround: 'Actividad en tierra (programación)', qRDuty: 'Tiempo de servicio (programación)',
      qRDutyDays: 'Días de servicio (programación)', qRSectors: 'Sectores (programación)', qROther: 'Cantidad de la programación',
      uH: '/h', uDay: '/día', uCount: '/unidad', uNight: '/noche',
      kProfit: 'Participación en las utilidades', kNotional: 'Prestación en especie', kAbsence: 'Descuento por ausencia',
      wq: '¿A qué mes de servicio corresponde {item}?', wSame: 'Mismo mes', wPrev: 'Mes anterior', wOther: 'Otro', wUnknown: 'No lo sé',
      wHint: 'Las horas block de este recibo coinciden con {t} en tu programación ({h})', wCand: 'Sugerido',
      wSaved: 'Se cuenta como servicio de {t}', wUnknownSaved: 'Mes de servicio sin definir', wOwn: 'Un periodo propio cada mes',
      wChange: 'Editar', wSave: 'Guardar', wErr: 'No se pudo guardar. Inténtalo de nuevo en un momento.',
      wOffN: 'Servicio de {n} meses antes', wNext: 'Servicio del mes siguiente', wOwnOpt: 'Varía según el mes',
      // D
      dT: 'Regla de pago de la asignación (estimada)',
      dKind: 'Regla', kDaily: 'Exceso diario', kMonthly: 'Exceso mensual', kGuar: 'Garantía',
      dQty: 'Horas que se cuentan', qDutyR: 'Tiempo de servicio', qBlockR: 'Tiempo block',
      dThr: 'Umbral', dThrDay: 'por día', dThrMonth: 'por mes', dGuar: 'Tiempo garantizado',
      dRate: 'Monto por hora del candidato', dFit: 'Meses ajustados', dVal: 'Meses de verificación', dFitErr: 'Mayor diferencia · meses ajustados ({n})', dValErr: 'Mayor diferencia · meses de verificación ({n})',
      dNoVal: 'Todavía no quedan meses para verificar',
      dCurve: 'Mayor diferencia con el recibo (más bajo = más cercano)', dCurveFit: 'Meses ajustados', dCurveVal: 'Meses de verificación',
      dRowM: 'Servicio → recibo', dActual: 'Pagado', dPred: 'Candidato', dGap: 'Diferencia', roleFit: 'ajuste', roleVal: 'verificación', roleUnused: '—',
      dDays: 'Servicios por encima del umbral · {n}', dDayTip: '{d} · exceso de {h}',
      dSkip: 'Meses sin usar: {n} (mes de servicio sin definir {u} · programación incompleta {r} · sin cantidad {q})',
      dNone: 'Todavía no hay meses con un mes de servicio conocido. Responde la pregunta del mes de servicio en Evolución por concepto.',
      dNote: 'Ajustado como una recta que pasa por cero. Un buen ajuste no confirma una regla de la empresa.',
      dNoItem: 'Todavía no hay conceptos de pago vinculados al servicio.', dNoRange: 'Ninguna programación cubre todavía un mes completo.'
    } /*/PV-MSG:es*/
  };
  T = (w.PV_T && w.PV_T(T, L)) || T[L];

  /* ── 小道具 ─────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fill(f, o) { return String(f).replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? String(o[k]) : ''; }); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  var MINUS = '−';
  function sgn(v) { return v > 0 ? '+' : v < 0 ? MINUS : '±'; }
  function hm(min) {
    if (!isNum(min)) return '—';
    var a = Math.abs(Math.round(min));
    return (min < 0 ? MINUS : '') + Math.floor(a / 60) + ':' + pad2(a % 60);
  }
  function pctS(r) { return isNum(r) ? sgn(Math.round(r * 1000)) + Math.abs(r * 100).toFixed(1) + '%' : '—'; }
  function ymParts(ym) { return { y: +ym.slice(0, 4), n: +ym.slice(5, 7) }; }
  function ymL(ym) { if (!ym) return '—'; var p = ymParts(ym); return fill(T.ymT, { y: p.y, n: p.n, M: T.mon[p.n - 1] }); }
  function ymS(ym) { if (!ym) return '—'; var p = ymParts(ym); return fill(T.ymS, { y: p.y, n: p.n, M: T.mon[p.n - 1] }); }
  function dayL(date) { var p = ymParts(date); return fill(T.ymS, { n: p.n, M: T.mon[p.n - 1] }) + (L === 'ja' && !ES ? '' : ' ') + (+date.slice(8, 10)) + (L === 'ja' && !ES ? '日' : ''); }

  /* お金：エンジンは原本通貨の最小単位の整数。見せるときだけ、その通貨のいちばん新しい明細のレートで円にする */
  var SYM_ES = { USD: 'US$ ', EUR: '€ ', GBP: '£ ', AUD: 'A$ ', SGD: 'S$ ', AED: 'AED ', CNY: 'CNY ', KRW: '₩ ' };
  function curNow() { var C = w.PVCurrency; return (C && C.get) ? C.get() : 'JPY'; }
  function fxOf(cur) {
    var ms = S.model ? S.model.months : [];
    for (var i = ms.length - 1; i >= 0; i--) if (ms[i].currency === cur && isNum(ms[i].fx_to_jpy)) return ms[i].fx_to_jpy;
    return null;
  }
  function jpyOf(minor, cur) {
    var v = R.fromMinor(minor, cur), fx = fxOf(cur);
    return (v == null || fx == null) ? null : v * fx;
  }
  function shown(jpy) {           // 円 → いまの表示通貨の数（と記号）
    var C = w.PVCurrency, cur = curNow(), rate = (C && C.rates && C.rates[cur]) || 1;
    var sym = cur === 'JPY' ? '¥' : ES ? (SYM_ES[cur] || cur + ' ') : ((C && C.symbols && C.symbols[cur]) || cur + ' ');
    return { v: cur === 'JPY' ? jpy : jpy / rate, sym: sym, jpy: cur === 'JPY' };
  }
  function fmtJ(jpy, sign) {
    if (!isNum(jpy)) return '—';
    var s = shown(jpy), n = Math.round(s.v);
    var body = s.sym + Math.abs(n).toLocaleString('en-US');
    return sign ? sgn(n) + body : (n < 0 ? MINUS : '') + body;
  }
  function money(minor, cur, sign) { return fmtJ(jpyOf(minor, cur), sign); }
  /* 目盛の字（短く）：円の日本語は万、それ以外は K / M。v は表示する通貨の数（dispOf で直したもの） */
  function dispOf(jpy) { return isNum(jpy) ? shown(jpy).v : null; }
  function fmtAxis(v) {
    if (!isNum(v)) return '';
    var s = shown(0), a = Math.abs(v), neg = v < 0 ? MINUS : '';
    if (s.jpy && L === 'ja' && !ES && a >= 10000) {
      var man = a / 10000;
      return neg + '¥' + (man >= 100 ? Math.round(man).toLocaleString('en-US') : +man.toFixed(man >= 10 ? 0 : 1)) + '万';
    }
    if (a >= 1e6) return neg + s.sym + +(a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
    if (a >= 1e4) return neg + s.sym + Math.round(a / 1e3) + 'K';
    if (a >= 1e3) return neg + s.sym + +(a / 1e3).toFixed(1) + 'K';
    return neg + s.sym + Math.round(a);
  }
  function unitTx(u) { return u === 'hour' || u === 'min' ? T.uH : u === 'day' ? T.uDay : u === 'night' ? T.uNight : T.uCount; }
  function qtyTx(v, unit) {
    if (!isNum(v)) return '—';
    if (unit === 'min') return hm(v);
    return String(Math.round(v * 10) / 10);
  }

  /* 区分と種類の名前（種類は my-value.js の区分の名前を借りる＝給与サマリーと同じ字） */
  var CAT = { fixed: 'cFixed', role: 'cRole', variable: 'cVariable', allowance: 'cAllowance', bonus: 'cBonus', noncash: 'cNoncash', adjustment: 'cAdjustment', unexplained: 'cUnexplained' };
  function catName(c) { return T[CAT[c]] || c; }
  function kindName(k) {
    var kd = R.KINDS[k], nm = S.ctx && S.ctx.segName;
    if (k === 'profit') return T.kProfit;
    if (k === 'notional') return T.kNotional;
    if (k === 'absence') return T.kAbsence;
    return (kd && kd.seg && nm && nm[kd.seg]) || k;
  }
  var QTYN = { block: 'qBlock', duty: 'qDuty', night: 'qNight', credit: 'qCredit', guarantee: 'qGuarantee', sectors: 'qSectors', dutyDays: 'qDutyDays',
               stay: 'qStay', daysOff: 'qDaysOff', role: 'qRole' };
  var QTYR = { operating: 'qROperating', deadhead: 'qRDeadhead', ground: 'qRGround', duty: 'qRDuty', dutyDays: 'qRDutyDays', sectors: 'qRSectors' };
  function qtyName(q) {
    if (!q) return '';
    if (String(q.kind).indexOf('roster:') === 0) return T[QTYR[q.kind.slice(7)]] || T.qROther;
    return T[QTYN[q.kind]] || q.kind;
  }

  /* ── 状態（タブを移っても残る）──────────────────────────────── */
  var S = {
    el: null, ctx: null, sb: null, visible: false, dirty: true, mounted: false,
    loading: false, err: false, airline: null, other: null,
    items: { items: [], maps: [], ok: false }, roster: null, model: null,
    sel: { a: null, b: null },
    per: '1y',
    A: { view: 'comp' },
    B: { num: 'gross', den: 'duty', denSet: false, basis: 'payslip', view: 'eff', work: null, bin: null },
    C: { item: null, other: false, busy: false, msg: null, edit: false },
    D: { item: null, kind: 'daily', qty: 'duty', thr: {}, grid: {} }
  };
  var AKEY = 'pv_roster_airline';   // 勤務ロスターのタブと同じ（給与を出していない人が選んだ会社）

  function months() { return S.model ? S.model.months : []; }
  function monthAt(ym) { var ms = months(); for (var i = 0; i < ms.length; i++) if (ms[i].ym === ym) return ms[i]; return null; }
  function rosterMonths() { return (S.model && S.model.roster && S.model.roster.months) || []; }
  function prevSame(ym) {
    var b = monthAt(ym), ms = months();
    if (!b) return null;
    for (var i = ms.length - 1; i >= 0; i--) if (ms[i].ym < ym && ms[i].currency === b.currency) return ms[i].ym;
    return null;
  }
  /* 比べるのはいつも「いちばん新しい明細」と「その前の同じ通貨の明細」（選ばせない・月が飛んでいても実際の月の名前で出す） */
  function fixSel() {
    var ms = months();
    if (!ms.length) { S.sel.a = S.sel.b = null; return; }
    S.sel.b = ms[ms.length - 1].ym;
    S.sel.a = prevSame(S.sel.b);
  }
  function two() { return !!(S.sel.a && S.sel.b); }

  /* 期間：いちばん新しい明細の月から暦で数えて戻る（3か月＝b-2〜b）。選べるのは明細が4か月以上のときだけ。
     中身が前の候補と同じになる候補は出さない（3か月はいつも出す）。選べないときは全部（隠れて見えない月を作らない） */
  var PER = { '3m': 3, '6m': 6, '1y': 12, all: 0 }, PER_ORDER = ['3m', '6m', '1y', 'all'];
  var PER_T = { '3m': 'per3', '6m': 'per6', '1y': 'per12', all: 'perAll' };
  function perOn() { return months().length > 3; }
  function perFrom(k) {
    if (k == null) k = perOn() ? S.per : 'all';
    var n = PER[k];
    return n && S.sel.b ? R.helpers.ymAdd(S.sel.b, 1 - n) : null;
  }
  function inPer(ym, k) { var f = perFrom(k); return !!ym && (!f || ym >= f) && (!S.sel.b || ym <= S.sel.b); }
  function perCount(k) { return months().filter(function (m) { return inPer(m.ym, k); }).length; }
  function perList() {
    if (!perOn()) return [];
    var out = [], last = -1;
    PER_ORDER.forEach(function (k) { var c = perCount(k); if (c > last) { out.push({ v: k, c: c }); last = c; } });
    return out;
  }
  function perPressed(list) { var c = perCount(S.per), x = list.filter(function (o) { return o.c === c; })[0]; return x ? x.v : null; }

  /* ── 読む ───────────────────────────────────────────────── */
  function stored(k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } }
  function pickAirline() {
    var P = w.PVRoster && w.PVRoster.current ? w.PVRoster.current() : null;
    if (P && P.airline) { S.airline = P.airline; S.other = P.other || null; return; }
    var rows = (S.ctx.reports || []);
    for (var i = rows.length - 1; i >= 0; i--) {
      var a = String(rows[i].airline || '').trim(), o = a === 'other' ? String(rows[i].airline_other || '').trim() : '';
      if (a && (a !== 'other' || o)) { S.airline = a; S.other = o || null; return; }
    }
    try { var s = JSON.parse(stored(AKEY) || 'null'); if (s && typeof s.a === 'string' && s.a) { S.airline = s.a; S.other = s.o || null; } } catch (e) {}
  }
  function loadRoster() {
    if (!S.airline || !S.sb) return Promise.resolve(null);
    return S.sb.rpc('my_roster', { p_airline: S.airline, p_airline_other: S.other, p_from: null, p_to: null })
      .then(function (r) {
        if (!r || r.error || !r.data || r.data.ok === false) return null;
        return { days: arr(r.data.days), profile: r.data.profile || null };
      }, function () { return null; });
  }
  function loadItems(force) {
    var f = S.ctx.items;
    return (typeof f === 'function' ? f(force) : Promise.resolve(null)).then(function (x) {
      return x && typeof x === 'object' ? { items: arr(x.items), maps: arr(x.maps), ok: !!x.ok } : { items: [], maps: [], ok: false };
    }, function () { return { items: [], maps: [], ok: false }; });
  }
  function build() {
    try {
      S.model = R.build({ reports: S.ctx.reports || [], items: S.items.items, maps: S.items.maps,
        roster: S.roster || { days: [], profile: null }, airline: S.airline || undefined, airlineOther: S.other });
      S.err = false;
    } catch (e) { S.model = null; S.err = true; }
    fixSel();
    S.D.grid = {};
  }
  function load() {
    S.loading = true;
    pickAirline();
    render();
    return Promise.all([loadItems(false), loadRoster()]).then(function (r) {
      S.items = r[0]; S.roster = r[1];
      build();
    }, function () { S.err = true; }).then(function () { S.loading = false; render(); });
  }

  /* ── 見出しと期間 ─────────────────────────────────────────── */
  function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  /* ★2026-11-10 オーナー「不要な文言はいらない」：LOOK DEEPER・題・「◯月を◯月と比べています · 明細 ◯か月 …」は外した。
     残すのは期間の切り替え（左）と CSV・印刷（右）だけ。比べている月は各カードの大きい数字の横（「1月から」）で言う。 */
  function headHTML() {
    var ms = months(), line = '';
    if (ms.length < 2) line = T.one;
    else if (!S.sel.a) line = T.noPrev;
    var pl = perList();
    var per = pl.length ? '<div class="an-per">' + seg('per', pl.map(function (o) { return { v: o.v, t: T[PER_T[o.v]] }; }), perPressed(pl), T.perAria) + '</div>' : '';
    var rg = rangeTx();
    var tools = '<div class="an-tools">' +
      '<button type="button" class="an-tool" data-act="csv" aria-label="' + esc(fill(T.csvA, { r: rg })) + '">' + ICON_DL + 'CSV</button>' +
      '<button type="button" class="an-tool" data-act="print" aria-label="' + esc(T.printA) + '">' + ICON_PR + esc(T.print) + '</button></div>';
    return '<div class="an-hd">' + per + tools + '</div>' +
      (line ? '<p class="an-line">' + esc(line) + '</p>' : '');
  }

  var ICON_DL = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>';
  var ICON_PR = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>';

  /* ── CSV と印刷：いま選んでいる期間の明細の月だけ（期間の中の最初の明細 〜 いちばん新しい明細）─────────────
     ★金額は明細の通貨のまま（通貨の欄つき・最小単位から小数に）。時間は H:MM と分の両方。名前・自由記述は書かない
       （支給項目の名前は本人の明細の字＝画面に出しているもの）。字の包み方と BOM は my-value.js の saveCsv。 */
  function perRange() {
    var b = S.sel.b, list = months().filter(function (m) { return inPer(m.ym); });
    return { a: list.length ? list[0].ym : b, b: b };
  }
  function rangeTx() { var r = perRange(); return r.a === r.b ? r.b : r.a + '→' + r.b; }
  function amt(minor, cur) { var v = R.fromMinor(minor, cur); return v == null ? '' : v.toFixed(R.minorDigits(cur)); }
  function hmc(min) { return isNum(min) ? hm(min) : ''; }
  function csvOf() {
    if (!S.model || !S.sel.b) return null;
    var r = perRange(), rg = rangeTx();
    var list = months().filter(function (m) { return m.ym >= r.a && m.ym <= r.b; });
    var rows = [[T.csvRange, fill(T.csvPay, { r: rg })], [], [T.csvSecPay],
      ['pay_month', 'currency', 'gross', 'net', 'deductions', 'block_hm', 'block_min', 'duty_hm', 'duty_min', 'duty_days', 'sectors']];
    list.forEach(function (m) {
      var q = m.qty;
      rows.push([m.ym, m.currency, amt(m.gross, m.currency), amt(m.net, m.currency), amt(m.deductions, m.currency),
        hmc(q.block), q.block, hmc(q.duty), q.duty, q.dutyDays, q.sectors]);
    });
    var rms = rosterMonths().filter(function (x) { return x.ym >= r.a && x.ym <= r.b; });
    if (rms.length) {
      rows.push([], [T.csvSecRoster], ['duty_month', 'days_covered', 'days_in_month', 'duty_hm', 'duty_min', 'block_hm', 'block_min', 'dh_hm', 'dh_min',
        'duty_days', 'sectors', 'dh_legs', 'off_days', 'vac_days']);
      rms.forEach(function (x) {
        var P = x.complete ? x : x.partial, bm = x.complete ? x.blockMin : x.partial.blockMin;
        rows.push([x.ym, x.coveredDays, x.daysInMonth, hmc(P.dutyMin), P.dutyMin, hmc(bm.operating), bm.operating, hmc(bm.deadhead), bm.deadhead,
          P.dutyDays, P.sectors, P.dhLegs, P.offDays, P.vacDays]);
      });
    }
    var opt0 = optionsC().filter(function (o) { return o.key === S.C.item; })[0];
    if (opt0) {
      var cc = R.cardC(S.model, { item: S.C.item, a: S.sel.a, b: S.sel.b });
      rows.push([], [T.cItem, opt0.label], ['pay_month', 'item', 'currency', 'amount', 'duty_month', 'quantity', 'quantity_hm', 'quantity_value', 'amount_per_quantity', 'per']);
      cc.series.filter(function (x) { return x.ym >= r.a && x.ym <= r.b && x.amount != null; }).forEach(function (x) {
        rows.push([x.ym, opt0.label, x.currency, amt(x.amount, x.currency), x.workYms.filter(Boolean).join(' '),
          x.qty ? qtyName(x.qty) : '', x.qty && x.qty.unit === 'min' ? hmc(x.qty.value) : '', x.qty ? x.qty.value : '',
          isNum(x.ref) ? amt(Math.round(x.ref), x.currency) : '', isNum(x.ref) ? unitTx(x.refUnit) : '']);
      });
    }
    return { name: 'pilot-value-analysis_' + (r.a === r.b ? r.b : r.a + '_' + r.b), rows: rows };
  }

  /* ── 部品 ───────────────────────────────────────────────── */
  /* 題名だけ（右上の札は 2026-11-10 に外した。推定であることは D の題名の「（推定）」で言う） */
  function cardOpen(id, title, mod) {
    return '<section class="an-card' + (mod ? ' ' + mod : '') + '" id="an-' + id + '" aria-labelledby="an-' + id + '-t">' +
      '<div class="an-card-h"><h3 class="an-card-t" id="an-' + id + '-t">' + esc(title) + '</h3></div>';
  }
  function seg(act, list, cur, aria) {
    return '<div class="an-segs" role="group" aria-label="' + esc(aria || '') + '">' + list.map(function (x) {
      return '<button type="button" class="an-segb" data-act="' + act + '" data-v="' + esc(x.v) + '" aria-pressed="' + (x.v === cur) + '"' +
        (x.off ? ' disabled' : '') + '>' + esc(x.t) + '</button>';
    }).join('') + '</div>';
  }
  function field(label, inner) { return '<label class="an-f"><span class="an-f-l">' + esc(label) + '</span>' + inner + '</label>'; }
  function stat(big, cap, cls) {
    return '<div class="an-stat"><b class="an-big' + (cls ? ' ' + cls : '') + '">' + esc(big) + '</b>' + (cap ? '<span class="an-cap">' + esc(cap) + '</span>' : '') + '</div>';
  }
  function tipAttr(lines, label) {
    var t = lines.filter(Boolean).join('\n');
    return ' data-tip="' + esc(t) + '" aria-label="' + esc(label || lines.filter(Boolean).join(' · ')) + '"';
  }
  function entryHTML() {
    return '<div class="an-need"><p>' + esc(T.needRoster) + '</p>' +
      '<button type="button" class="an-btn is-primary" data-act="add-roster">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' +
      esc(T.addRoster) + '</button></div>';
  }
  function niceBound(v, steps) {
    for (var i = 0; i < steps.length; i++) if (v <= steps[i]) return steps[i];
    return steps[steps.length - 1];
  }
  function niceStep(span, n) {
    if (!(span > 0)) return 1;
    var raw = span / n, p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }

  /* ════ A. 収入の内訳 ═══════════════════════════════════ */
  var MET = { gross: 'mGross', net: 'mNet', block: 'mBlock', duty: 'mDuty', dutyDays: 'mDays', sectors: 'mSectors' };
  function metVal(x, v, cur) { return x.unit === 'money' ? money(v, cur) : x.unit === 'min' ? hm(v) : qtyTx(v, x.unit); }
  function cardA() {
    var ca = R.cardA(S.model, { a: S.sel.a, b: S.sel.b }), cur = ca.currency;
    var view = two() ? S.A.view : 'comp';
    var h = cardOpen('a', T.aT);
    if (view === 'change') {
      var rows = ca.metrics.filter(function (x) { return x.rate != null; });
      var lead = rows.filter(function (x) { return x.k === 'gross'; })[0] || rows[0];
      h += lead ? stat(pctS(lead.rate), fill(T.aStat, { m: T[MET[lead.k]], a: ymS(ca.a) })) : stat('—', T.aNone);
    } else {
      var cb = ca.composition.b, fx = cb ? cb.filter(function (x) { return x.cat === 'fixed'; })[0] : null;
      h += stat(fx && fx.share != null ? (fx.share * 100).toFixed(1) + '%' : '—', fill(T.aShare, { t: ymS(ca.b) }));
    }
    if (two()) h += seg('a-view', [{ v: 'comp', t: T.aComp }, { v: 'change', t: T.aRate }], view, T.bViews);
    if (view === 'change') h += rateRows(ca);
    else {
      var cc = compCols();
      h += cc.cols.length >= 3 ? compStack(cc) + movedHTML(ca) : compBars(ca);   // 期間に3か月以上なら月ごとの縦の棒・2か月までは今までの2本
    }
    if (!ca.sameCurrency && two()) h += '<p class="an-note">' + esc(T.curDiff) + '</p>';
    return h + '</section>';
  }
  function rateRows(ca) {
    var rows = ca.metrics.filter(function (x) { return x.rate != null; });
    if (!rows.length) return '<p class="an-muted">' + esc(T.aNone) + '</p>';
    var mx = Math.max.apply(null, rows.map(function (x) { return Math.abs(x.rate) * 100; }));
    var B = niceBound(mx * 1.08, [5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 500, 1000]);
    var pos = function (p) { return (p + B) / (2 * B) * 100; };
    var ticks = [-B, -B / 2, 0, B / 2, B];
    var grid = ticks.map(function (t) { return '<i class="an-rr-g' + (t === 0 ? ' is-0' : '') + '" style="left:' + pos(t).toFixed(2) + '%"></i>'; }).join('');
    var out = '<div class="an-rr-l" role="list">' + rows.map(function (x) {
      var p = x.rate * 100, x0 = pos(0), x1 = pos(p), cls = p > 0 ? 'up' : p < 0 ? 'dn' : 'fl';
      var lab = T[MET[x.k]];
      return '<div class="an-rr" role="listitem" tabindex="0"' +
        tipAttr([lab, ymS(ca.a) + ' ' + metVal(x, x.a, ca.currency) + ' → ' + ymS(ca.b) + ' ' + metVal(x, x.b, ca.currency), pctS(x.rate)]) + '>' +
        '<span class="an-rr-k">' + esc(lab) + '</span><span class="an-rr-t">' + grid +
        '<i class="an-rr-b ' + cls + '" style="left:' + Math.min(x0, x1).toFixed(2) + '%;width:' + Math.max(0.6, Math.abs(x1 - x0)).toFixed(2) + '%"></i></span>' +
        '<b class="an-rr-v">' + esc(pctS(x.rate)) + '</b></div>';
    }).join('') + '</div>';
    out += '<div class="an-rr an-rr-ax" aria-hidden="true"><span></span><span class="an-rr-t">' + ticks.map(function (t) {
      return '<em' + (Math.abs(t) === B / 2 ? ' class="is-half"' : '') + ' style="left:' + pos(t).toFixed(2) + '%">' + (t > 0 ? '+' : t < 0 ? MINUS : '') + Math.abs(t) + '%</em>';
    }).join('') + '</span><span></span></div>';
    return out;
  }
  var CAT_ORDER = R.CATEGORIES.map(function (c) { return c.k; });
  function compBars(ca) {
    var list = [];
    if (ca.a && ca.composition.a && ca.sameCurrency) list.push({ ym: ca.a, c: ca.composition.a });
    if (ca.b && ca.composition.b) list.push({ ym: ca.b, c: ca.composition.b });
    var used = {};
    list.forEach(function (x) { x.c.forEach(function (s) { if (s.share > 0) used[s.cat] = 1; }); });
    var cats = CAT_ORDER.filter(function (c) { return used[c]; });
    var mcur = ca.currency;
    var h = '<ul class="an-lg">' + cats.map(function (c) { return '<li><i class="c-' + c + '"></i>' + esc(catName(c)) + '</li>'; }).join('') + '</ul>';
    h += '<div class="an-comp">' + list.map(function (x) {
      var tot = 0; x.c.forEach(function (s) { if (s.share > 0) tot += s.amount; });
      var segs = x.c.filter(function (s) { return s.share > 0; });
      var aria = ymS(x.ym) + ': ' + segs.map(function (s) { return catName(s.cat) + ' ' + (s.share * 100).toFixed(1) + '%'; }).join(', ');
      return '<div class="an-cb" tabindex="0" aria-label="' + esc(aria) + '"><span class="an-cb-k">' + esc(fill(T.payOf, { t: ymS(x.ym) })) + '</span>' +
        '<span class="an-cb-t">' + segs.map(function (s) {
          var pc = s.share * 100;
          return '<i class="c-' + s.cat + '" style="width:' + pc.toFixed(2) + '%"' + ' data-tip="' + esc(catName(s.cat) + '\n' + money(s.amount, mcur) + ' · ' + pc.toFixed(1) + '%') + '">' +
            (pc >= 14 ? '<em>' + Math.round(pc) + '%</em>' : '') + '</i>';
        }).join('') + '</span><b class="an-cb-v">' + esc(money(tot, mcur)) + '</b></div>';
    }).join('') + '</div>';
    return h + movedHTML(ca);
  }
  /* 動いた区分（いつも b と a） */
  function movedHTML(ca) {
    if (!ca.moved || !ca.moved.length) return '';
    return '<div class="an-moved"><p class="an-sm-h">' + esc(T.aMoved) + '</p><ul>' + ca.moved.slice(0, 4).map(function (x) {
      return '<li><i class="c-' + x.cat + '"></i><span>' + esc(catName(x.cat)) + '</span><b class="' + (x.delta > 0 ? 'up' : 'dn') + '">' + esc(money(x.delta, ca.currency, true)) + '</b></li>';
    }).join('') + '</ul></div>';
  }
  /* 期間の中の明細の月ごとの構成（b と同じ通貨の月だけ）。区分の額と割合はエンジンの答え（その月だけの cardA）のまま */
  function compCols() {
    var b = monthAt(S.sel.b), out = { cols: [], excluded: 0 };
    if (!b) return out;
    months().forEach(function (m) {
      if (!inPer(m.ym)) return;
      if (m.currency !== b.currency) { out.excluded++; return; }
      var cb = R.cardA(S.model, { b: m.ym }).composition.b || [];
      out.cols.push({ ym: m.ym, cur: m.currency, segs: cb.filter(function (s) { return s.share > 0; }) });
    });
    return out;
  }
  function compStack(cc) {
    var used = {};
    cc.cols.forEach(function (x) { x.segs.forEach(function (s) { used[s.cat] = 1; }); });
    var h = '<ul class="an-lg">' + CAT_ORDER.filter(function (c) { return used[c]; }).map(function (c) {
      return '<li><i class="c-' + c + '"></i>' + esc(catName(c)) + '</li>';
    }).join('') + '</ul>';
    h += '<div class="an-ch" data-ch="a-comp"></div>';
    if (cc.excluded) h += '<p class="an-cap2">' + esc(fill(T.aCurEx, { n: cc.excluded })) + '</p>';
    return h;
  }

  /* ════ B. ◯◯あたりの収入（題名は数量の基準に合わせて変わる）═════════════════════════════════════ */
  var DENS = [{ v: 'duty', t: 'dDuty' }, { v: 'block', t: 'dBlock' }, { v: 'dutyDays', t: 'dDays' }, { v: 'sectors', t: 'dSectors' }];
  var REASON = { no_roster: 'rNoRoster', roster_incomplete: 'rIncomplete', roster_gaps: 'rGaps', mixed_currency: 'rMixed' };
  function denName(k) { var x = DENS.filter(function (y) { return y.v === k; })[0]; return x ? T[x.t] : k; }
  var BTITLE = { duty: 'bTDuty', block: 'bTBlock', dutyDays: 'bTDays', sectors: 'bTSectors' };
  function rosterYms() { return rosterMonths().map(function (m) { return m.ym; }); }
  function fixWork() {
    var ys = rosterYms();
    if (!ys.length) { S.B.work = null; return; }
    if (ys.indexOf(S.B.work) < 0) {
      var upTo = ys.filter(function (y) { return !S.sel.b || y <= S.sel.b; });
      S.B.work = upTo.length ? upTo[upTo.length - 1] : ys[ys.length - 1];
      S.B.bin = null;
    }
  }
  function effOf() {
    var cb = R.cardB(S.model, { num: S.B.num, den: S.B.den, basis: S.B.basis });
    var pts = cb.points, pa = null, pb = null;
    pts.forEach(function (p) {
      var ys = p.basis === 'roster' ? arr(p.fromPayMonths) : [p.ym];
      if (ys.indexOf(S.sel.b) >= 0) pb = p;
      if (S.sel.a && ys.indexOf(S.sel.a) >= 0 && p !== pb) pa = p;
    });
    return { cb: cb, pa: pa, pb: pb };
  }
  /* 図の棒は期間の中だけ（エンジンの from/to＝ロスターの側は期間の中の明細に対応づけた勤務月）。見出しの％は effOf の b と a のまま */
  function effBars() {
    return R.cardB(S.model, { num: S.B.num, den: S.B.den, basis: S.B.basis, from: perFrom(), to: S.sel.b }).points;
  }
  /* その数量の基準で、期間の中に数が1つでもあるか（エンジンの答えを見るだけ） */
  function denHas(d) {
    return R.cardB(S.model, { num: S.B.num, den: d, basis: S.B.basis, from: perFrom(), to: S.sel.b }).points.some(function (p) { return isNum(p.value); });
  }
  /* 既定の数量の基準：勤務1時間 → 乗務1時間 → 1勤務日 → 1便 のうち、期間に数がある最初のもの。本人が選んだらそのまま */
  function fixDen() {
    if (S.B.denSet) return;
    var d = DENS.map(function (x) { return x.v; }).filter(denHas)[0];
    S.B.den = d || DENS[0].v;
  }
  function cardB() {
    var hasR = rosterMonths().length > 0;
    if (!hasR) S.B.basis = 'payslip';
    if (S.B.basis === 'roster') S.B.num = 'gross';
    fixDen();
    var h = cardOpen('b', T[BTITLE[S.B.den]] || T.bTDuty);
    var eff = S.B.view === 'eff';
    var noDen = eff && S.B.basis === 'payslip' && !denHas(S.B.den);   // 明細にこの数量が無い：空の図を描かず1行で言う
    if (eff && !noDen) {
      var e = effOf();
      if (e.pa && e.pb && isNum(e.pa.value) && isNum(e.pb.value) && e.pa.currency === e.pb.currency && e.pa.value > 0) {
        h += stat(pctS(e.pb.value / e.pa.value - 1), fill(T.from, { a: ymS(e.pa.ym) }));
      } else if (e.pb && isNum(e.pb.value)) {
        h += stat(money(e.pb.value, e.pb.currency), ymS(e.pb.ym));
      } else h += stat('—');
    }
    h += '<div class="an-ctl">' +
      field(T.bNum, '<select class="an-sel" data-act="b-num">' + opt('gross', T.nGross, S.B.num === 'gross') +
        (S.B.basis === 'roster' ? '' : opt('net', T.nNet, S.B.num === 'net')) + '</select>') +
      field(T.bDen, '<select class="an-sel" data-act="b-den">' + DENS.map(function (x) { return opt(x.v, T[x.t], x.v === S.B.den); }).join('') + '</select>') +
      '</div>';
    var basisSeg = eff && hasR ? seg('b-basis', [{ v: 'payslip', t: T.bsSlip }, { v: 'roster', t: T.bsRoster }], S.B.basis, T.bBasis) : '';
    /* 数の無い基準のときは、見方の切り替え（報酬効率・日別・分布）を出さない。ロスターがあれば明細／ロスターの切り替えは残す（抜け道） */
    if (!noDen) h += '<div class="an-row2">' + seg('b-view', [{ v: 'eff', t: T.vEff }, { v: 'day', t: T.vDay }, { v: 'dist', t: T.vDist }], S.B.view, T.bViews) + basisSeg + '</div>';
    else if (basisSeg) h += '<div class="an-row2">' + basisSeg + '</div>';
    if (noDen) {
      h += '<p class="an-muted">' + esc(T.bNoDen) + '</p>';
    } else if (eff) {
      var e2 = effOf();
      if (S.B.basis === 'roster' && !e2.cb.points.length) h += '<p class="an-muted">' + esc(T.bNoLinked) + '</p>';
      else h += '<div class="an-ch" data-ch="b-eff"></div>';
      h += '<p class="an-note">' + esc(T.bNote) + '</p>';
    } else if (!hasR) {
      h += entryHTML();
    } else {
      fixWork();
      var ys = rosterYms().slice().reverse();
      h += '<div class="an-ctl">' + field(T.bMonth, '<select class="an-sel" data-act="b-work">' +
        ys.map(function (y) { return opt(y, fill(T.workOf, { t: ymL(y) }), y === S.B.work); }).join('') + '</select>') + '</div>';
      var cbd = R.cardB(S.model, { work: [S.B.work] });
      if (!cbd.days.length) h += '<p class="an-muted">' + esc(T.dayNone) + '</p>';
      else {
        h += '<div class="an-ch" data-ch="' + (S.B.view === 'day' ? 'b-day' : 'b-dist') + '"></div>';
        if (S.B.view === 'day') {
          var miss = cbd.days.filter(function (x) { return x.dutyMin == null || x.blockMin == null; }).length;
          if (miss) h += '<p class="an-cap2">' + esc(fill(T.dayNoTimes, { n: miss })) + '</p>';
        } else h += binList(cbd);
      }
    }
    return h + '</section>';
  }
  function binList(cbd) {
    if (S.B.bin == null) return '';
    var list = cbd.days.filter(function (x) { return x.dutyMin != null && Math.floor(x.dutyMin / 60) * 60 === S.B.bin; });
    if (!list.length) return '';
    var lab = fill(T.distBin, { a: S.B.bin / 60, b: S.B.bin / 60 + 1 });
    return '<div class="an-chips"><p class="an-sm-h">' + esc(fill(T.distPick, { b: lab, n: list.length })) + '</p><div>' + list.map(function (x) {
      return '<button type="button" class="an-chip" data-act="day" data-date="' + x.date + '">' + esc(dayL(x.date)) + ' <b>' + esc(hm(x.dutyMin)) + '</b></button>';
    }).join('') + '</div></div>';
  }

  /* ════ C. 手当ごとの推移 ═════════════════════════════════ */
  var ASK_CAT = { variable: 1, role: 1, allowance: 1 };
  function optionsC() {
    var base = R.cardC(S.model, {});
    var hasChild = {};
    base.options.forEach(function (o) { if (!o.byKind) hasChild[o.kind] = 1; });
    return base.options.filter(function (o) { return o.months > 0; }).map(function (o) {
      var kd = R.KINDS[o.kind] || {};
      return { key: o.key, kind: o.kind, cat: kd.cat, byKind: o.byKind,
               label: o.byKind ? kindName(o.kind) + (hasChild[o.kind] ? T.cTotal : '') : (o.label || kindName(o.kind)) };
    });
  }
  /* 既定の項目：勤務に結びつく項目のうち、比べる2か月でいちばん動いたもの（明細の行の名前を、種類の合計より先に） */
  function defaultItem(opts) {
    var best = null, bv = -1, named = opts.filter(function (o) { return ASK_CAT[o.cat] && !o.byKind; });
    (named.length ? named : opts).forEach(function (o) {
      if (!ASK_CAT[o.cat]) return;
      var c = R.cardC(S.model, { item: o.key, a: S.sel.a, b: S.sel.b }), dc = c.decomposition;
      var v = dc && isNum(dc.delta) ? Math.abs(dc.delta) : 0;
      if (v > bv) { bv = v; best = o.key; }
    });
    return best || (opts[0] && opts[0].key) || null;
  }
  function itemSelect(act, opts, cur) {
    var groups = {};
    opts.forEach(function (o) { (groups[o.cat] || (groups[o.cat] = [])).push(o); });
    return '<select class="an-sel" data-act="' + act + '">' + CAT_ORDER.filter(function (c) { return groups[c]; }).map(function (c) {
      return '<optgroup label="' + esc(catName(c)) + '">' + groups[c].map(function (o) { return opt(o.key, o.label, o.key === cur); }).join('') + '</optgroup>';
    }).join('') + '</select>';
  }
  function cardC() {
    var opts = optionsC(), h = cardOpen('c', T.cT);
    if (!opts.length) return h + '<p class="an-muted">' + esc(T.cNone) + '</p></section>';
    if (!opts.some(function (o) { return o.key === S.C.item; })) S.C.item = defaultItem(opts);
    var cc = R.cardC(S.model, { item: S.C.item, a: S.sel.a, b: S.sel.b }), dc = cc.decomposition;
    var sB = cc.series.filter(function (s) { return s.ym === cc.b; })[0], sA = cc.series.filter(function (s) { return s.ym === cc.a; })[0];
    if (dc && isNum(dc.delta)) {
      var rt = sA && isNum(sA.amount) && sA.amount > 0 ? dc.delta / sA.amount : null;
      var fa = ymS(cc.a);
      h += stat(money(dc.delta, sB.currency, true), rt != null ? fill(T.cStat, { p: pctS(rt), a: fa }) : fill(T.from, { a: fa }), dc.delta > 0 ? 'up' : dc.delta < 0 ? 'dn' : '');
    } else if (sB) {
      h += stat(money(sB.amount, sB.currency), ymS(sB.ym));
    }
    h += '<div class="an-ctl">' + field(T.cItem, itemSelect('c-item', opts, S.C.item)) + '</div>';
    h += '<div class="an-ch" data-ch="c-amt"></div>';
    if (dc && dc.qtyEffect != null && sA && sB) {
      h += '<div class="an-pair">' +
        '<div><span>' + esc(T.cQty) + ' · ' + esc(qtyName(sB.qty)) + '</span><b>' + esc(qtyTx(sA.qty.value, sA.qty.unit)) + ' <i>→</i> ' + esc(qtyTx(sB.qty.value, sB.qty.unit)) + '</b></div>' +
        '<div><span>' + esc(T.cRef) + '</span><b>' + esc(money(sA.ref, sA.currency)) + ' <i>→</i> ' + esc(money(sB.ref, sB.currency)) + '<small>' + esc(unitTx(sB.refUnit)) + '</small></b></div></div>';
      h += decRows(dc, sB.currency);
    } else if (sB && sB.qty && isNum(sB.ref)) {
      h += '<div class="an-pair"><div><span>' + esc(T.cQty) + ' · ' + esc(qtyName(sB.qty)) + '</span><b>' + esc(qtyTx(sB.qty.value, sB.qty.unit)) + '</b></div>' +
        '<div><span>' + esc(T.cRef) + '</span><b>' + esc(money(sB.ref, sB.currency)) + '<small>' + esc(unitTx(sB.refUnit)) + '</small></b></div></div>';
    } else if (dc && dc.reason === 'no_quantity') {
      h += '<p class="an-note">' + esc(T.cNoQty) + '</p>';
    }
    h += askHTML(cc, (opts.filter(function (o) { return o.key === S.C.item; })[0] || {}).label);
    return h + '</section>';
  }
  function decRows(dc, cur) {
    var vals = [{ k: T.cQtyEff, v: dc.qtyEffect }, { k: T.cResid, v: dc.residual }];
    var mx = Math.max(Math.abs(dc.qtyEffect), Math.abs(dc.residual), 1);
    var pos = function (v) { return 50 + v / mx * 46; };
    return '<div class="an-dec"><p class="an-sm-h">' + esc(T.cDec) + '</p>' + vals.map(function (x) {
      var x0 = 50, x1 = pos(x.v), cls = x.v > 0 ? 'up' : x.v < 0 ? 'dn' : 'fl';
      return '<div class="an-rr is-dec" tabindex="0"' + tipAttr([x.k, money(x.v, cur, true)]) + '><span class="an-rr-k">' + esc(x.k) + '</span>' +
        '<span class="an-rr-t"><i class="an-rr-g is-0" style="left:50%"></i><i class="an-rr-b ' + cls + '" style="left:' + Math.min(x0, x1).toFixed(2) + '%;width:' +
        Math.max(0.6, Math.abs(x1 - x0)).toFixed(2) + '%"></i></span><b class="an-rr-v">' + esc(money(x.v, cur, true)) + '</b></div>';
    }).join('') + '<p class="an-note">' + esc(T.cDecNote) + '</p></div>';
  }
  /* 勤務月が分からない手当にだけ聞く。答えは押したときだけ保存（候補は印を付けるだけ・自動で保存しない） */
  function askOf(cc) {
    var m = monthAt(cc.b || S.sel.b);
    if (!m || !S.items.ok) return null;
    var byKind = cc.byKind, item = cc.item;
    var ls = m.lines.filter(function (l) { return l.counted && (byKind ? l.kind === byKind : l.labelKey === item); });
    if (!ls.length) return null;
    var keys = []; ls.forEach(function (l) { if (keys.indexOf(l.labelKey) < 0) keys.push(l.labelKey); });
    if (keys.length !== 1 || !ASK_CAT[R.KINDS[ls[0].kind].cat]) return null;
    var l = ls[0];
    var al = (S.model.align || []).filter(function (x) { return x.ym === m.ym; })[0];
    var cand = al && al.candidate != null ? al.compare.filter(function (c) { return c.offset === al.candidate; })[0] : null;
    return { key: keys[0], line: l, m: m, cand: cand };
  }
  function offLabel(o) { return o === 0 ? T.wSame : o === -1 ? T.wPrev : o === 1 ? T.wNext : fill(T.wOffN, { n: -o }); }
  /* ★2026-11-10 オーナー「どの手当か書いていない」：問いに、選んでいる項目の名前（選ぶ欄に出ている字）を入れる */
  function askHTML(cc, name) {
    var q = askOf(cc);
    if (!q) return '';
    var l = q.line;
    var nm = l.label || name || kindName(l.kind);      // 明細の行の名前（無ければ選ぶ欄の字）
    if (l.mapStatus && !S.C.edit) {
      var tx = l.mapStatus === 'unknown' ? T.wUnknownSaved : l.workYm ? fill(T.wSaved, { t: ymS(l.workYm) }) : T.wOwn;
      return '<div class="an-ask is-done"><span>' + esc(tx) + '</span><button type="button" class="an-link" data-act="wq-change">' + esc(T.wChange) + '</button></div>';
    }
    var c = q.cand ? q.cand.offset : null;
    var btn = function (v, t, isC) {
      return '<button type="button" class="an-segb' + (isC ? ' is-cand' : '') + '" data-act="wq" data-v="' + v + '"' + (S.C.busy ? ' disabled' : '') + '>' + esc(t) +
        (isC ? '<small>' + esc(T.wCand) + '</small>' : '') + '</button>';
    };
    var h = '<div class="an-ask" role="group" aria-labelledby="an-ask-t"><p class="an-ask-t" id="an-ask-t">' + esc(fill(T.wq, { item: nm })) + '</p>' +
      (q.cand ? '<p class="an-ask-h">' + esc(fill(T.wHint, { t: ymS(q.cand.ym), h: hm(q.cand.rosterBlockMin) })) + '</p>' : '') +
      '<div class="an-segs is-wrap">' + btn('0', T.wSame, c === 0) + btn('-1', T.wPrev, c === -1) + btn('other', T.wOther, false) + btn('unknown', T.wUnknown, false) + '</div>';
    if (S.C.other) {
      var offs = []; for (var o = -2; o >= -12; o--) offs.push(o);
      offs.push(1);
      h += '<div class="an-ask-o"><select class="an-sel" data-act="wq-off" aria-label="' + esc(T.wOther) + '">' +
        offs.map(function (o) { return opt(String(o), offLabel(o), false); }).join('') + opt('own', T.wOwnOpt, false) + '</select>' +
        '<button type="button" class="an-btn" data-act="wq-save"' + (S.C.busy ? ' disabled' : '') + '>' + esc(T.wSave) + '</button></div>';
    }
    if (S.C.msg) h += '<p class="an-err" role="status">' + esc(S.C.msg) + '</p>';
    return h + '</div>';
  }
  function saveAsk(v) {
    var cc = R.cardC(S.model, { item: S.C.item, a: S.sel.a, b: S.sel.b }), q = askOf(cc);
    if (!q || S.C.busy || !S.sb) return;
    var status, off = null;
    if (v === 'unknown') status = 'unknown';
    else if (v === 'own') status = 'other';
    else if (v === '0' || v === '-1') { status = 'confirmed'; off = +v; }
    else { status = 'confirmed'; off = +v; if (!isNum(off) || off < -12 || off > 1) return; }   // 「その他」で選んだずれも本人が決めた答え
    S.C.busy = true; S.C.msg = null; paint('c');
    S.sb.rpc('set_line_map', { p_airline: S.model.airline, p_airline_other: S.model.airlineOther, p_label_key: q.key,
                               p_offset: off, p_status: status, p_qty_kind: q.line.qtyKind || null })
      .then(function (r) {
        if (!r || r.error || !r.data || !r.data.ok) throw new Error('save');
        return loadItems(true).then(function (x) { S.items = x; build(); S.C.other = false; S.C.edit = false; });
      })
      .then(function () { S.C.busy = false; renderCards(); }, function () { S.C.busy = false; S.C.msg = T.wErr; paint('c'); });
  }

  /* ════ D. 手当の計算ルール（推定）════════════════════════════════ */
  function optionsD() { return optionsC().filter(function (o) { return ASK_CAT[o.cat]; }); }
  function dayQty(x) { return S.D.qty === 'block' ? (x.blockMin ? x.blockMin.operating : null) : x.dutyMin; }
  function rangeD() {
    var vals = [];
    if (S.D.kind === 'daily') {
      rosterMonths().forEach(function (rm) { rm.days.forEach(function (x) { if (x.isDuty) { var v = dayQty(x); if (isNum(v)) vals.push(v); } }); });
      if (!vals.length) return null;
      var lo = Math.floor(Math.min.apply(null, vals) / 15) * 15, hi = Math.ceil(Math.max.apply(null, vals) / 15) * 15;
      if (hi - lo < 60) hi = lo + 60;
      return { min: lo, max: hi, step: 15 };
    }
    rosterMonths().forEach(function (rm) { if (!rm.complete) return; var v = S.D.qty === 'block' ? (rm.blockMin ? rm.blockMin.operating : null) : rm.dutyMin; if (isNum(v)) vals.push(v); });
    if (!vals.length) return null;
    var lo2 = Math.floor(Math.min.apply(null, vals) * 0.5 / 60) * 60, hi2 = Math.ceil(Math.max.apply(null, vals) / 60) * 60;
    if (hi2 - lo2 < 120) hi2 = lo2 + 120;
    return { min: lo2, max: hi2, step: 60 };
  }
  function thrKey() { return S.D.item + '|' + S.D.kind + '|' + S.D.qty; }
  function thrNow(rg) {
    var k = thrKey(), v = S.D.thr[k];
    if (!isNum(v) || v < rg.min || v > rg.max) {
      v = Math.round((rg.min + rg.max) / 2 / rg.step) * rg.step;
      S.D.thr[k] = v;
    }
    return v;
  }
  function specOf(t) {
    return { item: S.D.item, kind: S.D.kind, qty: S.D.qty, thresholdMin: t, guaranteeMin: S.D.kind === 'guarantee' ? t : null };
  }
  function gridOf(rg) {
    var k = thrKey();
    if (S.D.grid[k]) return S.D.grid[k];
    var n = Math.round((rg.max - rg.min) / rg.step), stride = Math.max(1, Math.ceil(n / 36)), out = [];
    for (var i = 0; i <= n; i += stride) {
      var t = rg.min + i * rg.step, ev = R.ruleFit.candidate(S.model, specOf(t));
      out.push({ t: t, fit: ev.fit.maxAbsError, val: ev.validation.maxAbsError });
    }
    return (S.D.grid[k] = out);
  }
  function curOfRows(rows) {
    var cs = []; rows.forEach(function (r) { var m = monthAt(r.ym); if (m && cs.indexOf(m.currency) < 0) cs.push(m.currency); });
    return cs.length === 1 ? cs[0] : null;
  }
  function cardD() {
    var h = cardOpen('d', T.dT);
    if (!rosterMonths().length) return h + entryHTML() + '</section>';
    var opts = optionsD();
    if (!opts.length) return h + '<p class="an-muted">' + esc(T.dNoItem) + '</p></section>';
    if (!opts.some(function (o) { return o.key === S.D.item; })) {
      /* 既定：勤務月が分かっている月がいちばん多い項目（同じなら手当ごとの推移で選んでいる項目） */
      var score = function (o) { return R.ruleFit.candidate(S.model, { item: o.key, kind: 'monthly', qty: S.D.qty, thresholdMin: 0 }).rows.length * 2 + (o.key === S.C.item ? 1 : 0) + (o.byKind ? 0 : 0.5); };
      var bestD = opts[0], bs = -1;
      opts.forEach(function (o) { var v = score(o); if (v > bs) { bs = v; bestD = o; } });
      S.D.item = bestD.key;
    }
    h += '<div class="an-ctl">' + field(T.cItem, itemSelect('d-item', opts, S.D.item)) +
      field(T.dQty, '<select class="an-sel" data-act="d-qty">' + opt('duty', T.qDutyR, S.D.qty === 'duty') + opt('block', T.qBlockR, S.D.qty === 'block') + '</select>') + '</div>';
    h += seg('d-kind', [{ v: 'daily', t: T.kDaily }, { v: 'monthly', t: T.kMonthly }, { v: 'guarantee', t: T.kGuar }], S.D.kind, T.dKind);
    var rg = rangeD();
    if (!rg) return h + '<p class="an-muted">' + esc(T.dNoRange) + '</p></section>';
    var t = thrNow(rg), ev = R.ruleFit.candidate(S.model, specOf(t));
    if (!ev.rows.length) return h + '<p class="an-muted">' + esc(T.dNone) + '</p></section>';
    var lab = S.D.kind === 'guarantee' ? T.dGuar : T.dThr, per = S.D.kind === 'daily' ? T.dThrDay : T.dThrMonth;
    h += '<div class="an-thr"><div class="an-thr-h"><label for="an-thr">' + esc(lab) + ' <small>' + esc(per) + '</small></label><b id="an-thr-v">' + esc(hm(t)) + '</b></div>' +
      '<input id="an-thr" class="an-range" type="range" data-act="d-thr" min="' + rg.min + '" max="' + rg.max + '" step="' + rg.step + '" value="' + t + '"' +
      ' aria-valuetext="' + esc(hm(t)) + '">' +
      '<div class="an-thr-ax" aria-hidden="true"><span>' + esc(hm(rg.min)) + '</span><span>' + esc(hm(rg.max)) + '</span></div></div>';
    h += '<div class="an-dres">' + resultsD(ev) + '</div>';
    return h + '</section>';
  }
  function resultsD(ev) {
    var h = '';
    var cur = curOfRows(ev.rows);
    var sk = ev.skipped || [], cnt = function (r) { return sk.filter(function (x) { return x.reason === r; }).length; };
    if (!ev.rows.length) {
      h += '<p class="an-muted">' + esc(T.dNone) + '</p>';
    } else if (!cur) {
      h += '<p class="an-muted">' + esc(T.curDiff) + '</p>';
    } else {
      h += '<div class="an-pair is-3">' +
        '<div><span>' + esc(T.dRate) + '</span><b>' + esc(ev.ratePerHour == null ? '—' : money(Math.round(ev.ratePerHour), cur)) + '<small>' + esc(T.uH) + '</small></b></div>' +
        '<div><span>' + esc(fill(T.dFitErr, { n: ev.fitMonths.length })) + '</span><b>' + esc(ev.fit.maxAbsError == null ? '—' : money(ev.fit.maxAbsError, cur)) + '</b></div>' +
        (ev.validation.n ? '<div><span>' + esc(fill(T.dValErr, { n: ev.validationMonths.length })) + '</span><b>' + esc(money(ev.validation.maxAbsError, cur)) + '</b></div>'
          : '<div><span>' + esc(T.dVal) + '</span><b class="is-mute">' + esc(T.dNoVal) + '</b></div>') + '</div>';
      h += '<div class="an-ch" data-ch="d-curve"></div><p class="an-cap2">' + esc(T.dCurve) + '</p>';
      h += '<div class="an-tbl-w"><table class="an-tbl"><thead><tr><th scope="col">' + esc(T.dRowM) + '</th><th scope="col">' + esc(T.dActual) + '</th><th scope="col">' + esc(T.dPred) +
        '</th><th scope="col">' + esc(T.dGap) + '</th></tr></thead><tbody>' +
        ev.rows.map(function (r) {
          return '<tr><th scope="row">' + esc(ymS(r.workYm)) + ' → ' + esc(ymS(r.ym)) + ' <span class="an-role is-' + r.role + '">' +
            esc(r.role === 'fit' ? T.roleFit : r.role === 'validate' ? T.roleVal : T.roleUnused) + '</span></th><td>' + esc(money(r.actual, cur)) + '</td><td>' + esc(money(r.predicted, cur)) +
            '</td><td>' + esc(r.error == null ? '—' : money(r.error, cur, true)) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      var cs = (ev.contributions || []).slice().sort(function (x, y) { return y.excessMin - x.excessMin || (x.date < y.date ? -1 : 1); });
      if (S.D.kind === 'daily' && cs.length) {
        var mx = cs[0].excessMin;
        h += '<details class="an-det"><summary>' + esc(fill(T.dDays, { n: cs.length })) + '</summary><div class="an-cl">' + cs.slice(0, 40).map(function (c) {
          return '<button type="button" class="an-cl-r" data-act="day" data-date="' + c.date + '"' + tipAttr([fill(T.dDayTip, { d: dayL(c.date), h: hm(c.excessMin) }), T.dayOpen]) + '>' +
            '<span>' + esc(dayL(c.date)) + '</span><i style="width:' + Math.max(2, c.excessMin / mx * 100).toFixed(1) + '%"></i><b>' + esc(hm(c.excessMin)) + '</b></button>';
        }).join('') + '</div></details>';
      }
    }
    if (sk.length) h += '<p class="an-cap2">' + esc(fill(T.dSkip, { n: sk.length, u: cnt('work_month_unknown'), r: cnt('roster_incomplete'), q: cnt('quantity_unknown') })) + '</p>';
    if (ev.rows.length) h += '<p class="an-note">' + esc(T.dNote) + '</p>';
    return h;
  }

  /* ── SVG の図（実寸で組む）───────────────────────────────────── */
  function txW(s) { return String(s).length * 6.4; }
  function barPath(x, y0, y1, bw) {     // データの端だけ角を丸める（底は四角）
    var r = Math.min(4, bw / 2, Math.abs(y1 - y0)), up = y1 < y0;
    if (Math.abs(y1 - y0) < 0.5) return '';
    if (up) return 'M' + x + ' ' + y0 + 'V' + (y1 + r) + 'Q' + x + ' ' + y1 + ' ' + (x + r) + ' ' + y1 + 'H' + (x + bw - r) + 'Q' + (x + bw) + ' ' + y1 + ' ' + (x + bw) + ' ' + (y1 + r) + 'V' + y0 + 'Z';
    return 'M' + x + ' ' + y0 + 'V' + (y1 - r) + 'Q' + x + ' ' + y1 + ' ' + (x + r) + ' ' + y1 + 'H' + (x + bw - r) + 'Q' + (x + bw) + ' ' + y1 + ' ' + (x + bw) + ' ' + (y1 - r) + 'V' + y0 + 'Z';
  }
  /* 目盛：字が同じになる目盛を描かない（小さい額で ¥1・¥1・¥0 にしない）。数が無い・幅が無いときは目盛を描かない（底の線だけ） */
  function yTicks(lo, hi) {
    if (!(hi > lo)) return { top: lo + 1, bot: lo, ticks: [] };
    var st = niceStep(hi - lo, 3), top = hi, bot = lo;
    for (var k = 0; k < 8; k++) {
      var ticks = [];
      top = Math.ceil(hi / st) * st; bot = Math.floor(lo / st) * st;
      for (var t = bot; t <= top + st / 2; t += st) ticks.push(t);
      var labs = ticks.map(fmtAxis);
      if (ticks.length > 1 && labs.every(function (x, i) { return labs.indexOf(x) === i; })) return { top: top, bot: bot, ticks: ticks };
      st = niceStep(st * 1.01, 1);
    }
    return { top: top, bot: bot, ticks: [] };
  }
  function yGrid(ticks, y, pl, x2) {
    if (!ticks.length) return '<line class="an-g is-0" x1="' + pl + '" x2="' + x2 + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '"/>';
    return ticks.map(function (tv) {
      return '<line class="an-g' + (tv === 0 ? ' is-0' : '') + '" x1="' + pl + '" x2="' + x2 + '" y1="' + y(tv).toFixed(1) + '" y2="' + y(tv).toFixed(1) + '"/>' +
        '<text class="an-ax" x="' + (pl - 6) + '" y="' + (y(tv) + 3.5).toFixed(1) + '" text-anchor="end">' + esc(fmtAxis(tv)) + '</text>';
    }).join('');
  }
  function yPad(ticks) { return (ticks.length ? Math.max.apply(null, ticks.map(function (x) { return txW(fmtAxis(x)); })) : 0) + 10; }
  /* 縦の棒：pts = [{ym, v（円）|null, tip[], cls:'a'|'b'|'', lab}]。高さと目盛は表示する通貨の数で（切りのよい目盛にするため） */
  function columns(box, pts0, o) {
    var W = box.clientWidth;
    if (W < 60) return;
    o = o || {};
    var pts = pts0.map(function (p) { var q = Object.assign({}, p); q.v = dispOf(p.v); return q; });
    var H = o.h || 200, vals = pts.filter(function (p) { return isNum(p.v); }).map(function (p) { return p.v; });
    var lo = Math.min(0, Math.min.apply(null, vals.concat([0]))), hi = Math.max(0, Math.max.apply(null, vals.concat([0])));
    var ax = yTicks(lo, hi), top = ax.top, bot = ax.bot, ticks = ax.ticks;
    var pl = yPad(ticks), pr = 6, pt = 20, pb = 34;
    var iw = W - pl - pr, ih = H - pt - pb, n = pts.length, slot = iw / Math.max(1, n);
    var bw = Math.max(4, Math.min(24, slot * 0.56));
    var y = function (v) { return pt + ih * (top - v) / (top - bot); };
    var g = yGrid(ticks, y, pl, W - pr);
    var every = Math.max(1, Math.ceil(40 / slot));
    var ia = -9, ib = -9;
    pts.forEach(function (p, i) { if (p.cls === 'a') ia = i; if (p.cls === 'b') ib = i; });
    var labA = Math.abs(ib - ia) * slot >= 70;            // 2つの値の字が重なるなら、新しい月の字だけ（前の月は小窓で読める）
    pts.forEach(function (p, i) {
      var cx = pl + slot * (i + 0.5), x = cx - bw / 2;
      if (isNum(p.v)) {
        g += '<path class="an-col' + (p.cls ? ' is-' + p.cls : '') + '" d="' + barPath(+x.toFixed(1), +y(0).toFixed(1), +y(p.v).toFixed(1), +bw.toFixed(1)) + '"/>';
        if (p.lab && (p.cls === 'b' || labA)) {
          var lw = txW(p.lab) * 1.05, lx = Math.min(cx, W - pr - lw / 2), anc = 'middle';
          if (cx - lw / 2 < pl) { lx = pl; anc = 'start'; }
          // 端で字を寄せたとき、字の下に来る隣の棒より上に置く（隣の棒に字が重ならない）
          var mid = anc === 'start' ? lx + lw / 2 : lx, vv = p.v;
          pts.forEach(function (q, j) {
            if (!isNum(q.v) || Math.abs(pl + slot * (j + 0.5) - mid) >= lw / 2 + bw / 2) return;
            vv = p.v >= 0 ? Math.max(vv, q.v) : Math.min(vv, q.v);
          });
          g += '<text class="an-val" x="' + lx.toFixed(1) + '" y="' + (p.v >= 0 ? y(vv) - 6 : y(vv) + 13).toFixed(1) + '" text-anchor="' + anc + '">' + esc(p.lab) + '</text>';
        }
      } else {
        g += '<rect class="an-col-na" x="' + x.toFixed(1) + '" y="' + (y(0) - 4).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="4" rx="2"/>';
      }
      var mo = +p.ym.slice(5, 7);
      if (i % every === 0 || i === n - 1 || p.cls) {
        g += '<text class="an-ax' + (p.cls ? ' is-on' : '') + '" x="' + cx.toFixed(1) + '" y="' + (H - 18) + '" text-anchor="middle">' + esc(ymS(p.ym)) + '</text>';
      }
      if (i === 0 || mo === 1) g += '<text class="an-ax is-y" x="' + cx.toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle">' + p.ym.slice(0, 4) + '</text>';
      g += '<rect class="an-hit" x="' + (cx - slot / 2).toFixed(1) + '" y="' + pt + '" width="' + slot.toFixed(1) + '" height="' + ih + '" tabindex="0" role="img"' + tipAttr(p.tip) + '/>';
    });
    box.innerHTML = '<svg class="an-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="group" aria-label="' + esc(o.aria || '') + '">' + g + '</svg>';
  }
  /* 積み上げの縦の棒（A の収入の構成）：cols = compCols().cols。区分の間は 2px あけて面の色を見せる・いちばん上の区分だけ角を丸める。
     高さと目盛は表示する通貨の数（columns と同じ組み方）。小窓は月・合計・区分ごとの額と割合 */
  function stack(box, cols, o) {
    var W = box.clientWidth;
    if (W < 60) return;
    o = o || {};
    var H = o.h || 210;
    var data = cols.map(function (c) {
      var tot = 0;
      c.segs.forEach(function (s) { tot += s.amount; });
      return { ym: c.ym, cur: c.cur, tot: tot, tv: dispOf(jpyOf(tot, c.cur)),
               segs: c.segs.map(function (s) { return { cat: s.cat, amount: s.amount, share: s.share, v: dispOf(jpyOf(s.amount, c.cur)) }; }) };
    });
    var hi = Math.max.apply(null, data.map(function (c) { return isNum(c.tv) ? c.tv : 0; }).concat([0]));
    var ax = yTicks(0, hi), top = ax.top, ticks = ax.ticks;
    var pl = yPad(ticks), pr = 6, pt = 20, pb = 34;
    var iw = W - pl - pr, ih = H - pt - pb, n = data.length, slot = iw / Math.max(1, n);
    var bw = Math.max(4, Math.min(28, slot * 0.6));
    var y = function (v) { return pt + ih * (top - v) / top; };
    var g = yGrid(ticks, y, pl, W - pr);
    var every = Math.max(1, Math.ceil(40 / slot));
    data.forEach(function (c, i) {
      var cx = pl + slot * (i + 0.5), x = +(cx - bw / 2).toFixed(1), w0 = +bw.toFixed(1), on = c.ym === S.sel.b ? 'b' : c.ym === S.sel.a ? 'a' : '';
      var segs = c.segs.filter(function (s) { return isNum(s.v) && s.v > 0; }), last = segs.length - 1, cum = 0;
      if (!segs.length) g += '<rect class="an-col-na" x="' + x + '" y="' + (y(0) - 4).toFixed(1) + '" width="' + w0 + '" height="4" rx="2"/>';
      segs.forEach(function (s, j) {
        var y0 = y(cum), y1 = y(cum + s.v);
        cum += s.v;
        if (j > 0) y0 -= 1;                    // 区分の間に 2px（下の区分の上 1px ＋ 上の区分の下 1px）
        if (j < last) y1 += 1;
        if (y0 - y1 < 0.5) return;
        y0 = +y0.toFixed(1); y1 = +y1.toFixed(1);
        var d = j === last ? barPath(x, y0, y1, w0) : 'M' + x + ' ' + y0 + 'V' + y1 + 'H' + (x + w0) + 'V' + y0 + 'Z';
        g += '<path class="an-stk c-' + s.cat + '" d="' + d + '"/>';
      });
      if (on === 'b' && isNum(c.tv)) {
        var lab = money(c.tot, c.cur), lw = txW(lab) * 1.05, lx = Math.min(cx, W - pr - lw / 2), anc = 'middle';
        if (cx - lw / 2 < pl) { lx = pl; anc = 'start'; }
        var mid = anc === 'start' ? lx + lw / 2 : lx, tv = c.tv;   // 字の下に来る隣の棒より上に置く（columns と同じ）
        data.forEach(function (q, j) { if (isNum(q.tv) && Math.abs(pl + slot * (j + 0.5) - mid) < lw / 2 + bw / 2) tv = Math.max(tv, q.tv); });
        g += '<text class="an-val" x="' + lx.toFixed(1) + '" y="' + (y(tv) - 6).toFixed(1) + '" text-anchor="' + anc + '">' + esc(lab) + '</text>';
      }
      var mo = +c.ym.slice(5, 7);
      if (i % every === 0 || i === n - 1 || on) {
        g += '<text class="an-ax' + (on ? ' is-on' : '') + '" x="' + cx.toFixed(1) + '" y="' + (H - 18) + '" text-anchor="middle">' + esc(ymS(c.ym)) + '</text>';
      }
      if (i === 0 || mo === 1) g += '<text class="an-ax is-y" x="' + cx.toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle">' + c.ym.slice(0, 4) + '</text>';
      var tip = [fill(T.payOf, { t: ymL(c.ym) }), T.aTot + ' ' + money(c.tot, c.cur)].concat(segs.map(function (s) {
        return catName(s.cat) + ' ' + money(s.amount, c.cur) + ' · ' + (s.share * 100).toFixed(1) + '%';
      }));
      g += '<rect class="an-hit" x="' + (cx - slot / 2).toFixed(1) + '" y="' + pt + '" width="' + slot.toFixed(1) + '" height="' + ih + '" tabindex="0" role="img"' + tipAttr(tip) + '/>';
    });
    box.innerHTML = '<svg class="an-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="group" aria-label="' + esc(o.aria || '') + '">' + g + '</svg>';
  }
  function axisH(min) { return Math.round(min / 60) + 'h'; }
  function scatter(box, days) {
    var W = box.clientWidth;
    if (W < 60) return;
    var H = W < 420 ? 230 : 260, ds = days.filter(function (x) { return isNum(x.dutyMin) && isNum(x.blockMin); });
    var mx = Math.max.apply(null, ds.map(function (x) { return x.dutyMin; }).concat([60])), my = Math.max.apply(null, ds.map(function (x) { return x.blockMin; }).concat([60]));
    var sx = mx > 960 ? 240 : 120, sy = my > 960 ? 240 : 120;
    var tx = Math.ceil(mx / sx) * sx, ty = Math.ceil(my / sy) * sy;
    var pl = 40, pr = 12, pt = 22, pb = 36, iw = W - pl - pr, ih = H - pt - pb;
    var X = function (v) { return pl + iw * v / tx; }, Y = function (v) { return pt + ih * (1 - v / ty); };
    var g = '';
    for (var a = 0; a <= ty; a += sy) g += '<line class="an-g' + (a === 0 ? ' is-0' : '') + '" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(a).toFixed(1) + '" y2="' + Y(a).toFixed(1) + '"/><text class="an-ax" x="' + (pl - 6) + '" y="' + (Y(a) + 3.5).toFixed(1) + '" text-anchor="end">' + axisH(a) + '</text>';
    for (var b = 0; b <= tx; b += sx) g += '<text class="an-ax" x="' + X(b).toFixed(1) + '" y="' + (H - 20) + '" text-anchor="middle">' + axisH(b) + '</text>';
    g += '<text class="an-ax-t" x="' + pl + '" y="11">' + esc(T.dayY) + '</text><text class="an-ax-t" x="' + (W - pr) + '" y="' + (H - 3) + '" text-anchor="end">' + esc(T.dayX) + '</text>';
    ds.forEach(function (x) {
      var r = 4 + Math.min(4, Math.sqrt(x.sectors || 0) * 1.2);
      var lines = [dayL(x.date) + (x.code ? ' · ' + x.code : ''), T.dayX + ' ' + hm(x.dutyMin), T.dayY + ' ' + hm(x.blockMin),
                   (x.sectors ? T.mSectors + ' ' + x.sectors : '') + (x.dhLegs ? ' · DH ' + x.dhLegs : ''), T.dayOpen];
      g += '<g class="an-pt" data-act="day" data-date="' + x.date + '" tabindex="0" role="button"' + tipAttr(lines) + '>' +
        '<circle class="an-pt-h" cx="' + X(x.dutyMin).toFixed(1) + '" cy="' + Y(x.blockMin).toFixed(1) + '" r="' + (r + 6).toFixed(1) + '"/>' +
        '<circle class="an-pt-d' + (x.hasDh ? ' is-dh' : '') + '" cx="' + X(x.dutyMin).toFixed(1) + '" cy="' + Y(x.blockMin).toFixed(1) + '" r="' + r.toFixed(1) + '"/></g>';
    });
    box.innerHTML = '<svg class="an-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="group" aria-label="' + esc(T.vDay + ' · ' + fill(T.workOf, { t: ymL(S.B.work) })) + '">' + g + '</svg>';
  }
  function hist(box, dist0) {
    var W = box.clientWidth;
    if (W < 60 || !dist0.length) return;
    /* 間の時間帯（その長さの勤務が0回）も並べる＝横軸が詰まらない */
    var dist = [], have = {};
    dist0.forEach(function (b) { have[b.fromMin] = b; });
    for (var f = dist0[0].fromMin; f <= dist0[dist0.length - 1].fromMin; f += 60) dist.push(have[f] || { fromMin: f, toMin: f + 60, n: 0 });
    var H = 220, n = dist.length, mx = Math.max.apply(null, dist.map(function (b) { return b.n; }).concat([1]));
    var st = Math.max(1, Math.round(niceStep(mx, 3))), top = Math.max(st, Math.ceil(mx * 1.18 / st) * st);
    var pl = 30, pr = 6, pt = 24, pb = 40, iw = W - pl - pr, ih = H - pt - pb, slot = iw / Math.max(1, n), bw = Math.max(6, Math.min(24, slot * 0.6));
    var Y = function (v) { return pt + ih * (1 - v / top); };
    var g = '';
    for (var t = 0; t <= top; t += st) g += '<line class="an-g' + (t === 0 ? ' is-0' : '') + '" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '"/><text class="an-ax" x="' + (pl - 6) + '" y="' + (Y(t) + 3.5).toFixed(1) + '" text-anchor="end">' + t + '</text>';
    dist.forEach(function (b, i) {
      var cx = pl + slot * (i + 0.5), x = cx - bw / 2, on = S.B.bin === b.fromMin;
      var lab = fill(T.distBin, { a: b.fromMin / 60, b: b.toMin / 60 });
      g += (b.n ? '<path class="an-col' + (on ? ' is-b' : ' is-a') + '" d="' + barPath(+x.toFixed(1), +Y(0).toFixed(1), +Y(b.n).toFixed(1), +bw.toFixed(1)) + '"/>' +
          '<text class="an-val" x="' + cx.toFixed(1) + '" y="' + (Y(b.n) - 6).toFixed(1) + '" text-anchor="middle">' + b.n + '</text>' : '') +
        '<text class="an-ax" x="' + cx.toFixed(1) + '" y="' + (H - 24) + '" text-anchor="middle">' + (b.fromMin / 60) + '–' + (b.toMin / 60) + '</text>' +
        '<rect class="an-hit" data-act="b-bin" data-v="' + b.fromMin + '" x="' + (cx - slot / 2).toFixed(1) + '" y="' + pt + '" width="' + slot.toFixed(1) + '" height="' + ih + '" tabindex="0" role="button"' +
        tipAttr([lab, fill(T.distN, { n: b.n })]) + '/>';
    });
    g += '<text class="an-ax-t" x="' + (W - pr) + '" y="' + (H - 3) + '" text-anchor="end">' + esc(T.dayX) + ' (h)</text><text class="an-ax-t" x="' + pl + '" y="11">' + esc(T.distY) + '</text>';
    box.innerHTML = '<svg class="an-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="group" aria-label="' + esc(T.vDist) + '">' + g + '</svg>';
  }
  function curve(box, grid, cur, now) {
    var W = box.clientWidth;
    if (W < 60) return;
    var pts = grid.filter(function (p) { return isNum(p.fit); }), H = 190;
    if (!pts.length) { box.innerHTML = ''; return; }
    var J = function (v) { return dispOf(jpyOf(v, cur)); };
    var ys = []; pts.forEach(function (p) { ys.push(J(p.fit)); if (isNum(p.val)) ys.push(J(p.val)); });
    var mx = Math.max.apply(null, ys.concat([1])), ax = yTicks(0, mx), top = ax.top;
    var t0 = grid[0].t, t1 = grid[grid.length - 1].t;
    var pl = yPad(ax.ticks), pr = 10, pt = 14, pb = 26, iw = W - pl - pr, ih = H - pt - pb;
    var X = function (t) { return pl + iw * (t - t0) / Math.max(1, t1 - t0); }, Y = function (v) { return pt + ih * (1 - v / top); };
    var g = yGrid(ax.ticks, Y, pl, W - pr);
    var xs = [t0, Math.round((t0 + t1) / 2 / 15) * 15, t1];
    xs.forEach(function (t, i) { g += '<text class="an-ax" x="' + X(t).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === 2 ? 'end' : 'middle') + '">' + hm(t) + '</text>'; });
    g += '<line class="an-now" x1="' + X(now).toFixed(1) + '" x2="' + X(now).toFixed(1) + '" y1="' + pt + '" y2="' + (pt + ih) + '"/>';
    var line = function (key, cls) {
      var ps = pts.filter(function (p) { return isNum(p[key]); });
      if (ps.length < 2) return '';
      return '<polyline class="an-ln ' + cls + '" points="' + ps.map(function (p) { return X(p.t).toFixed(1) + ',' + Y(J(p[key])).toFixed(1); }).join(' ') + '"/>';
    };
    g += line('val', 'is-val') + line('fit', 'is-fit');
    pts.forEach(function (p) {
      var on = p.t === now;
      g += '<g class="an-cv" data-act="d-pt" data-v="' + p.t + '" tabindex="0" role="button"' +
        tipAttr([T.dThr + ' ' + hm(p.t), T.dCurveFit + ' ' + money(p.fit, cur), isNum(p.val) ? T.dCurveVal + ' ' + money(p.val, cur) : '']) + '>' +
        '<circle class="an-pt-h" cx="' + X(p.t).toFixed(1) + '" cy="' + Y(J(p.fit)).toFixed(1) + '" r="9"/>' +
        '<circle class="an-cv-d' + (on ? ' is-on' : '') + '" cx="' + X(p.t).toFixed(1) + '" cy="' + Y(J(p.fit)).toFixed(1) + '" r="' + (on ? 5 : 3) + '"/></g>';
    });
    var hasVal = pts.some(function (p) { return isNum(p.val); });
    box.innerHTML = '<ul class="an-lg is-sm"><li><i class="is-fit"></i>' + esc(T.dCurveFit) + '</li>' + (hasVal ? '<li><i class="is-val"></i>' + esc(T.dCurveVal) + '</li>' : '') + '</ul>' +
      '<svg class="an-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="group" aria-label="' + esc(T.dCurve) + '">' + g + '</svg>';
  }

  /* 図を描く（見えているカードだけ・実寸で） */
  function draw(id) {
    if (!S.visible || !S.el || !S.model) return;
    var root = S.el.querySelector('#an-' + id);
    if (!root) return;
    root.querySelectorAll('.an-ch').forEach(function (box) { drawBox(box, box.getAttribute('data-ch')); });
  }
  /* 1つの図を箱に描く（箱は clientWidth と innerHTML だけを使う） */
  function drawBox(box, k) {
    if (!S.model) return;
    if (k === 'a-comp') {
      stack(box, compCols().cols, { aria: T.aComp });
    } else if (k === 'b-eff') {
      var e = effOf(), u = denName(S.B.den);
      columns(box, effBars().map(function (p) {
        var j = isNum(p.value) ? jpyOf(p.value, p.currency) : null, on = e.pb && p.ym === e.pb.ym ? 'b' : e.pa && p.ym === e.pa.ym ? 'a' : '';
        var lbl = p.basis === 'roster' ? fill(T.workOf, { t: ymL(p.ym) }) : fill(T.payOf, { t: ymL(p.ym) });
        var why = p.reason ? T[REASON[p.reason]] : (p.value == null ? T.rNoQty : '');
        return { ym: p.ym, v: j, cls: on, lab: on && j != null ? fmtJ(j) : null,
                 tip: [lbl, j != null ? fmtJ(j) + ' / ' + u : why,
                   p.numerator != null && p.denominator != null ? money(p.numerator, p.currency) + ' ÷ ' + (p.unit === 'min' ? hm(p.denominator) : p.denominator) : ''] };
      }), { aria: T.vEff });
    } else if (k === 'b-day') {
      scatter(box, R.cardB(S.model, { work: [S.B.work] }).days);
    } else if (k === 'b-dist') {
      hist(box, R.cardB(S.model, { work: [S.B.work] }).dist);
    } else if (k === 'c-amt') {
      var cc = R.cardC(S.model, { item: S.C.item, a: S.sel.a, b: S.sel.b });
      columns(box, cc.series.filter(function (s) { return inPer(s.ym); }).map(function (s) {      // 図は期間の中だけ・分け方は b と a のまま
        var j = isNum(s.amount) ? jpyOf(s.amount, s.currency) : null, on = s.ym === cc.b ? 'b' : s.ym === cc.a ? 'a' : '';
        return { ym: s.ym, v: j, cls: on, lab: on && j != null ? fmtJ(j) : null,
                 tip: [fill(T.payOf, { t: ymL(s.ym) }), j != null ? fmtJ(j) : '—',
                   s.qty ? qtyName(s.qty) + ' ' + qtyTx(s.qty.value, s.qty.unit) : '',
                   isNum(s.ref) ? T.cRef + ' ' + money(s.ref, s.currency) + unitTx(s.refUnit) : ''] };
      }), { aria: T.cT, h: 190 });
    } else if (k === 'd-curve') {
      var rg = rangeD();
      if (!rg) return;
      var ev = R.ruleFit.candidate(S.model, specOf(thrNow(rg)));
      curve(box, gridOf(rg), curOfRows(ev.rows), thrNow(rg));
    }
  }
  function drawAll() { ['a', 'b', 'c', 'd'].forEach(draw); }

  /* ── 組む ───────────────────────────────────────────────── */
  function cardsHTML() { return cardA() + cardB() + cardC() + cardD(); }
  /* まだ給与を出していない人に見せる「出すと見られるもの」（2026-11-11 オーナー「ぼかし入れて、その上からアップロードのボタンでいいだろ」
     「ぼかしのクオリティ低い。ちゃんと作れ」）。
     ★本物のカード（収入の内訳・時間あたりの収入）と同じ部品を見本の数字で組み、強くぼかす。上には給与フォームと同じ「明細から自動入力」だけ。
     ★見本の数字は作り物。読み上げから外し（aria-hidden）、押せず（inert）、通貨の書き換えからも外す（pv-no-cur）。形は my-value.css の .mv-peek。 */
  function peekHTML() {
    var t = new Date(), v = t.getFullYear() * 12 + t.getMonth() - 1, ms = [];
    for (var k = 11; k >= 0; k--) ms.push((v - k) % 12 + 1);
    var W = 400, H = 190, pl = 40, bw = 18, slot = (W - pl - 6) / 12, g = '', g2 = '';
    [0, 1, 2, 3].forEach(function (i) {
      var yy = 150 - i * 40;
      g += '<line class="an-g' + (i ? '' : ' is-0') + '" x1="' + pl + '" x2="' + W + '" y1="' + yy + '" y2="' + yy + '"/><text class="an-ax" x="' + (pl - 6) + '" y="' + (yy + 3.5) + '" text-anchor="end">' + (i * 50) + '</text>';
    });
    g2 = g;
    ms.forEach(function (mo, i) {
      var cx = pl + slot * (i + 0.5), x = (cx - bw / 2).toFixed(1), f = 104 + (i % 3) * 3, a = 14 + ((i * 7) % 5) * 2, r = 82 + ((i * 5) % 7) * 6 + (i > 9 ? 14 : 0);
      g += '<rect class="an-stk c-fixed" x="' + x + '" y="' + (150 - f) + '" width="' + bw + '" height="' + f + '"/>' +
        '<rect class="an-stk c-allowance" x="' + x + '" y="' + (150 - f - 2 - a) + '" width="' + bw + '" height="' + a + '" rx="3"/>' +
        '<text class="an-ax' + (i > 9 ? ' is-on' : '') + '" x="' + cx.toFixed(1) + '" y="170" text-anchor="middle">' + esc(T.mon[mo - 1]) + '</text>';
      g2 += '<rect class="an-col' + (i === 11 ? ' is-b' : i === 10 ? ' is-a' : '') + '" x="' + x + '" y="' + (150 - r) + '" width="' + bw + '" height="' + r + '" rx="3"/>' +
        '<text class="an-ax' + (i > 9 ? ' is-on' : '') + '" x="' + cx.toFixed(1) + '" y="170" text-anchor="middle">' + esc(T.mon[mo - 1]) + '</text>';
    });
    var segs = function (a, b) { return '<div class="an-segs"><span class="an-segb" aria-pressed="true">' + esc(a) + '</span><span class="an-segb">' + esc(b) + '</span></div>'; };
    var A = '<section class="an-card"><div class="an-card-h"><h3 class="an-card-t">' + esc(T.aT) + '</h3></div>' + stat('92.7%', fill(T.aShare, { t: T.mon ? T.mon[ms[11] - 1] : '' })) +
      segs(T.aComp, T.aRate) + '<ul class="an-lg"><li><i class="c-fixed"></i>' + esc(catName('fixed')) + '</li><li><i class="c-allowance"></i>' + esc(catName('allowance')) + '</li></ul>' +
      '<svg class="an-svg" viewBox="0 0 ' + W + ' ' + H + '">' + g + '</svg></section>';
    var B = '<section class="an-card"><div class="an-card-h"><h3 class="an-card-t">' + esc(T.bTBlock) + '</h3></div>' + stat('+7.7%', '') +
      segs(T.vEff, T.vDay) + '<svg class="an-svg" viewBox="0 0 ' + W + ' ' + H + '">' + g2 + '</svg></section>';
    return '<div class="mv-peek"><div class="mv-peek-in pv-no-cur" aria-hidden="true" inert><div class="an-grid">' + A + B + '</div></div>' +
      '<div class="mv-peek-over"><a class="mv-up" href="pay-report.html#ps"><span class="mv-up-t"><span class="mv-up-i">' +
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 17v-6"/><path d="m9.5 13.5 2.5-2.5 2.5 2.5"/></svg>' +
        '</span>' + esc(T.psT) + '</span><span class="mv-up-b">' + T.psB.map(function (x) { return '<span><i aria-hidden="true">✓</i>' + esc(x) + '</span>'; }).join('') + '</span></a></div></div>';
  }
  function render() {
    if (!S.el) return;
    if (!S.visible) { S.dirty = true; return; }
    S.dirty = false;
    var h;
    if (S.loading && !S.model) h = '<div class="an-skel"></div><div class="an-grid"><div class="an-skel is-card"></div><div class="an-skel is-card"></div></div>';
    else if (S.err && !S.model) h = '<div class="an-card an-msg"><p>' + esc(T.err) + '</p></div>';
    else if (!(S.ctx.reports || []).length) h = peekHTML();      // ★2026-11-11 ぼかした本物のカード＋ボタンだけ（オーナー指示）
    else if (!S.model || !S.model.months.length) h = '<div class="an-card an-msg"><p>' + esc(T.noCo) + '</p></div>';
    else h = headHTML() + '<div class="an-grid">' + cardsHTML() + '</div>';
    S.el.innerHTML = '<div class="an pv-no-cur">' + h + '<div class="an-tip" role="tooltip" hidden></div></div>';
    drawAll();
  }
  function renderCards() {
    if (!S.visible) { S.dirty = true; return; }
    var g = S.el.querySelector('.an-grid'), hd = S.el.querySelector('.an-hd');
    if (!g || !S.model || !S.model.months.length) { render(); return; }
    var tmp = d.createElement('div');
    tmp.innerHTML = headHTML();
    var line = S.el.querySelector('.an-line');
    if (line) line.parentNode.removeChild(line);
    hd.parentNode.replaceChild(tmp.firstChild, hd);
    if (tmp.firstChild) g.parentNode.insertBefore(tmp.firstChild, g);
    g.innerHTML = cardsHTML();
    drawAll();
  }
  /* 1枚だけ組み直す（操作したカード）。押していた部品に焦点を戻す */
  function paint(id) {
    if (!S.visible) { S.dirty = true; return; }
    var el = S.el.querySelector('#an-' + id);
    if (!el) { render(); return; }
    var a = d.activeElement, key = a && el.contains(a) ? [a.getAttribute('data-act'), a.getAttribute('data-v'), a.id] : null;
    var tmp = d.createElement('div');
    tmp.innerHTML = ({ a: cardA, b: cardB, c: cardC, d: cardD })[id]();
    el.parentNode.replaceChild(tmp.firstChild, el);
    hideTip();
    draw(id);
    if (key) {
      var q = key[2] ? '#' + key[2] : '[data-act="' + key[0] + '"]' + (key[1] != null ? '[data-v="' + key[1] + '"]' : '');
      var f = S.el.querySelector('#an-' + id + ' ' + q) || S.el.querySelector('#an-' + id + ' [data-act="' + key[0] + '"]');
      if (f && f.focus) f.focus({ preventScroll: true });
    }
  }

  /* ── ホバーの小窓（軸・単位・期間は各図の data-tip が持つ）──────────── */
  function showTip(t) {
    var root = S.el.querySelector('.an'), tip = root && root.querySelector('.an-tip');
    if (!tip) return;
    var s = t.getAttribute('data-tip');
    if (!s) return;
    tip.innerHTML = s.split('\n').filter(Boolean).map(function (x, i) { return i ? '<span>' + esc(x) + '</span>' : '<b>' + esc(x) + '</b>'; }).join('');
    tip.hidden = false;
    var rr = root.getBoundingClientRect(), tr = t.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    var x = tr.left - rr.left + tr.width / 2 - tw / 2, y = tr.top - rr.top - th - 8;
    if (y < 0) y = tr.bottom - rr.top + 8;
    tip.style.left = Math.max(0, Math.min(rr.width - tw, x)) + 'px';
    tip.style.top = y + 'px';
  }
  function hideTip() { var tip = S.el && S.el.querySelector('.an-tip'); if (tip) tip.hidden = true; }

  /* ── 操作 ───────────────────────────────────────────────── */
  function goto(o) { if (S.ctx && typeof S.ctx.goto === 'function') S.ctx.goto(o); }
  function onClick(e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t || !S.el.contains(t) || t.disabled) return;
    var act = t.getAttribute('data-act'), v = t.getAttribute('data-v');
    if (act === 'per') { S.per = v; hideTip(); renderCards(); focusSel('.an-per [aria-pressed="true"]'); }
    else if (act === 'a-view') { S.A.view = v; paint('a'); }
    else if (act === 'b-view') { S.B.view = v; S.B.bin = null; paint('b'); }
    else if (act === 'b-basis') { S.B.basis = v; paint('b'); }
    else if (act === 'b-bin') { S.B.bin = S.B.bin === +v ? null : +v; paint('b'); }
    else if (act === 'day') { hideTip(); goto({ date: t.getAttribute('data-date') }); }
    else if (act === 'add-roster') goto({ upload: true });
    else if (act === 'csv') { var cv = csvOf(); if (cv && S.ctx && typeof S.ctx.csv === 'function') S.ctx.csv(cv.name, cv.rows); }
    else if (act === 'print') {
      hideTip();
      if (S.ctx && typeof S.ctx.print === 'function') { var pr = perRange(); S.ctx.print(fill(T.prRange, { r: pr.a === pr.b ? ymL(pr.b) : ymL(pr.a) + ' → ' + ymL(pr.b) })); }
    }
    else if (act === 'wq') {
      if (v === 'other') { S.C.other = !S.C.other; paint('c'); var s = S.el.querySelector('[data-act="wq-off"]'); if (s) s.focus(); }
      else saveAsk(v);
    }
    else if (act === 'wq-save') { var sel = S.el.querySelector('[data-act="wq-off"]'); if (sel) saveAsk(sel.value); }
    else if (act === 'wq-change') { S.C.edit = true; paint('c'); }
    else if (act === 'd-kind') { S.D.kind = v; paint('d'); }
    else if (act === 'd-pt') { S.D.thr[thrKey()] = +v; paint('d'); }
  }
  function onChange(e) {
    var t = e.target, act = t.getAttribute && t.getAttribute('data-act');
    if (!act) return;
    if (act === 'b-num') { S.B.num = t.value; paint('b'); }
    else if (act === 'b-den') { S.B.den = t.value; S.B.denSet = true; paint('b'); }
    else if (act === 'b-work') { S.B.work = t.value; S.B.bin = null; paint('b'); }
    else if (act === 'c-item') { S.C.item = t.value; S.C.other = false; S.C.edit = false; S.C.msg = null; paint('c'); }
    else if (act === 'd-item') { S.D.item = t.value; paint('d'); }
    else if (act === 'd-qty') { S.D.qty = t.value; paint('d'); }
    else if (act === 'd-thr') { S.D.thr[thrKey()] = +t.value; paint('d'); }
  }
  var raf = 0;
  function onInput(e) {      // スライダーは動かしている間も結果だけ描き直す（つまみは作り直さない＝指が離れない）
    var t = e.target;
    if (!t || t.getAttribute('data-act') !== 'd-thr') return;
    S.D.thr[thrKey()] = +t.value;
    if (raf) return;
    raf = (w.requestAnimationFrame || setTimeout)(function () {
      raf = 0;
      var rg = rangeD();
      if (!rg) return;
      var now = thrNow(rg), ev = R.ruleFit.candidate(S.model, specOf(now));
      var vEl = S.el.querySelector('#an-thr-v'), box = S.el.querySelector('#an-d .an-dres');
      if (vEl) vEl.textContent = hm(now);
      t.setAttribute('aria-valuetext', hm(now));
      if (box) { box.innerHTML = resultsD(ev); draw('d'); }
    });
  }
  function focusSel(q) { var f = S.el.querySelector(q); if (f) f.focus({ preventScroll: true }); }
  function onKey(e) {
    var t = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && t && t.getAttribute && t.getAttribute('role') === 'button' && t.namespaceURI === 'http://www.w3.org/2000/svg') {
      e.preventDefault();
      onClick({ target: t });
    }
    if (e.key === 'Escape') hideTip();
  }
  function onOver(e) { var t = e.target.closest ? e.target.closest('[data-tip]') : null; if (t && S.el.contains(t)) showTip(t); }
  function onOut(e) {
    var t = e.target.closest ? e.target.closest('[data-tip]') : null, to = e.relatedTarget;
    if (t && (!to || !t.contains(to))) hideTip();
  }

  /* ── 外から呼ぶ口 ─────────────────────────────────────────── */
  function mount(el, ctx) {
    S.el = el; S.ctx = ctx || {}; S.sb = S.ctx.sb || null; S.mounted = true;
    el.addEventListener('click', onClick);
    el.addEventListener('change', onChange);
    el.addEventListener('input', onInput);
    el.addEventListener('keydown', onKey);
    el.addEventListener('mouseover', onOver);
    el.addEventListener('mouseout', onOut);
    el.addEventListener('focusin', onOver);
    el.addEventListener('focusout', onOut);
    /* 勤務ロスターで会社を替えた・保存した・消した → ロスターを読み直す（同じ会社で数える） */
    d.addEventListener('pv-roster-change', function (e) {
      var dt = e && e.detail;
      if (dt && dt.airline) { S.airline = dt.airline; S.other = dt.other || null; }
      loadRoster().then(function (r) { S.roster = r; build(); render(); });
    });
    w.addEventListener('pv-currency-change', function () { S.dirty = true; if (S.visible) render(); });
    var rt = null;
    w.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (S.visible) drawAll(); }, 160);
    });
    load();
  }
  function show() { S.visible = true; if (S.dirty) render(); else drawAll(); }
  function hide() { S.visible = false; hideTip(); }

  w.PVAnalysis = {
    mount: mount, show: show, hide: hide, redraw: drawAll,
    _: { T: T, L: L, S: S, fill: fill, hm: hm, pctS: pctS, fmtJ: fmtJ, money: money, build: build,
         cardA: cardA, cardB: cardB, cardC: cardC, cardD: cardD, headHTML: headHTML, askOf: askOf, rangeD: rangeD, optionsC: optionsC, csvOf: csvOf,
         ymL: ymL, ymS: ymS, perList: perList, compCols: compCols, drawBox: drawBox,
         yTicks: yTicks, fmtAxis: fmtAxis,
         set: function (o) { Object.keys(o || {}).forEach(function (k) { S[k] = o[k]; }); } }
  };
}(window));
