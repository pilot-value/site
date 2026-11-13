/* ════════════════════════════════════════════════════════════════
   payslip.js — 明細を落とすと、時給が出る

   pay-report.html / en/pay-report.html の #ps に載る。
   ページ側の inline script より **後**に読むこと（$ / num / annualTotal /
   updateSteps / openOpt / recalc / _sb / LANG を借りている）。

   ── 流れ（2026-11-04 作り直し・オーナー判断）──────────────────
     ① 選ぶ・撮る       … 画像は端末の中で描き直す（向き・位置情報などは落ちる。元ファイルは出ない）
     ② すぐ読み取りへ   … 送るのは描き直したページ全体の JPEG。黒塗りと確認の画面はやめた
                          ── 手間に見合わなかった（選んだ23人のうち送れたのは8人）。
                          氏名・社員番号・口座は「読み取りの対象にしない」で守る
                          （サーバーの答えの形に、それを書く欄が無い）。画像はどこにも保存しない。
     ③ 読み取りのあいだ … 明細に載っていない質問（会社・職位・機材）へ先に進める
     ④ フォームに下書き … 読めた数字だけ入れる。本人が入れた欄は上書きしない。
                          前月の下書きの金額は混ぜない。★自動で投稿しない。保存は本人が押す
     失敗しても行き止まりにしない … もう一度読む／別の明細を選ぶ／手で入力する
     ★自動で送り直さない（時間切れでも向こうでは処理が続いているかもしれない）。
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root = document.getElementById('ps');
  if (!root) return;
  if (typeof _sb === 'undefined') return;                 // Supabase が落ちていたら出さない

  var L = (window.PV_BASE === 'en' || (typeof LANG !== 'undefined' && LANG === 'en')) ? 'en' : 'ja';   // スペイン語のページは英語と同じ動き（pv-session.js）

  // ── 文言 ──────────────────────────────────────────────────
  var T = {
    ja: {
      /* ★2026-11-04 作り直し。黒塗り・送る枠・確認の画面の文言はまとめて外した。
           待つあいだに出すのは**実際の状態だけ**（進み具合の％は出さない）。 */
      prep: '画像を整えています',
      readingNow: '明細を読み取っています',
      stepPrep: '画像を整える',
      stepRead: '金額を読む',
      stepFill: 'フォームに入れる',
      /* ★2026-11-04（その2）。経過の秒数は本物（1秒ごとに数える）。「ふつう◯秒」の約束は書かない。 */
      failT: '読み取れませんでした',
      resultTitleN: function (n) { return '読み取りました · ' + n + '項目を入れました'; },
      retry: 'もう一度読む',
      choose: '別の明細を選ぶ',
      manual: '手で入力する',
      view: '明細を見る',
      viewClose: '閉じる',
      viewHint: '押すと拡大・縮小します',
      viewLabel: '選んだ明細（この端末の中だけで表示しています）',
      badImage: 'このファイルは読めませんでした。PDF・JPEG・PNG・WebP のどれかにしてください。',
      tooLarge: 'ファイルが大きすぎます。画像は6MB、PDF は20MB までにしてください。',
      pdfReading: 'PDF を開いています…（初回だけ、読み込み用のデータを取りに行きます）',
      pdfPages: function (n) { return n + 'ページあるうちの1ページ目を読んでいます。給与の表が別のページにあるときは、そのページだけの画像（スクリーンショット）を選んでください。'; },
      pdfLocked: 'この PDF はパスワードで保護されています。パスワードを外して保存し直すか、開いた画面のスクリーンショットを落としてください。',
      /* ★鍵の付いた PDF は、その場でパスワードを聞いて端末の中で開く（2026-11-13 オーナー「失敗してるぞ」）。 */
      lockT: 'パスワード付きの PDF です',
      lockMsg: 'パスワードを入れると、この端末の中で開いて読みます。',
      lockBad: 'パスワードが違います。もう一度入れてください。',
      lockPh: 'PDF のパスワード',
      lockGo: '開く',
      pdf: 'PDF を開けませんでした。開いた画面のスクリーンショットを撮って落としてください。',
      /* ★「開けた」のに中身が出ない PDF が2種類ある。どちらも以前は真っ白な紙を
         送って「明細として読み取れません」で終わっていた＝本人には原因が分からない。 */
      pdfXfa: 'この PDF は特殊な形式（XFA フォーム）で、この画面では中身を描き出せません。開いた画面のスクリーンショットを撮って落としてください。',
      pdfBlank: 'この PDF の中身を描き出せませんでした（白紙になります）。開いた画面のスクリーンショットを撮って落としてください。',
      errNet: '通信がつながりませんでした。',
      /* ★2026-11-04（その3）文は短く1つだけ（題が「読み取れませんでした」、道は下のボタン）。
           ★それでも行き止まりにしない ──「手で入力する」のボタンは、どの失敗でも必ず出る（showFail）。
         ★（旧）読み取りに失敗したときは、必ず「このまま手で入力できます」で終える。
         読み取りを始めた時点で入力フォームは開いているので、文章と画面が一致する。
         ここで行き止まりにすると、いちばん濃い見込み客がそのまま離脱する。 */
      errRead: '明るいところで、明細全体が入るように撮り直すと読めることがあります。',
      errNotSlip: '給与明細に見えませんでした。',
      errBusy: '混み合っていて、返事が来ませんでした。少し待ってもう一度どうぞ。',
      errPrep: 'この明細を送れる形に整えられませんでした。',
      errBlank: '画像を開けませんでした。スクリーンショットか PDF で選んでください。',
      errApply: '読めましたが、入力欄に入れられませんでした。',
      errQuota: '今日の自動読み取りの上限に達しました。明日また使えます。',
      /* ★全体の天井に当たったとき。本人のせいではないので言い方を変える。
           サーバ側で本人の回数は戻してあるので、残り回数の一文は本当のこと。 */
      errQuotaGlobal: '混み合っていて、今日はこれ以上お受けできません。あなたの残り回数は減っていません。',
      errServer: 'いま自動読み取りが使えません。',
      /* ★食い違いの一覧（2026-09-12 オーナー決定6）。本人が打った値は上書きしない。 */
      cfTitle: 'あなたの入力と、明細の値が違うところ',
      cfLead: '<b>どれも書き換えていません。</b>明細のほうが正しいものだけ押してください。',
      cfMine: 'あなたの入力',
      cfSlip: '明細',
      cfUse: '明細の値にする',
      /* ★明細から読めなかった固定の額（2026-09-12 オーナー決定6）。
         前回の額を勝手に入れない ── 押されたときだけ入る。 */
      cdTitle: '明細から読めなかった欄',
      cdLead: '前回の額を入れることもできます。<b>押さなければ空のまま</b>です。',
      cdUse: function (v) { return '前回の ' + v + ' を使う'; },
      resultTitle: '読み取りました',
      resultLead: '<b>まだ投稿されていません。</b>最後に全部見直せます。',
      col1: '明細の項目', col2: '入れた欄', col3: '金額',
      askBlockT: '乗務時間（block hours）が読み取れませんでした',
      askBlockOkT: '乗務時間（block hours）',
      askBlockL: '1つ入れるだけで「乗務時間あたりの時給」が出ます。明細の block / 乗務時間の欄です。',
      askBlockF: '明細から拾いました。合っていれば、このままで大丈夫です。',
      foldTitle: '読み取った明細の内訳を見る（{n}行）',
      foldTitleNoN: '読み取った明細の内訳を見る',
      days: '乗務日数',
      /* ★2026-08-14 まで、分類できなかった行はここに「これはどれですか？」と出すだけで、
           金額はどの欄にも入っていなかった＝年収から黙って欠けていた。いまは
           「その他手当（未分類）」として数え、答えるかどうかは本人に任せる。 */
      uncTag: '（未分類）',
      /* ★2026-11-04 オーナー「確認して欲しいの？確認可能ですって言ってんの？」── 何をしてほしいかを題で言う。 */
      askT: function (n) { return n === 1 ? '何の手当か分からない行があります' : '何の手当か分からない行が' + n + 'つあります'; },
      askL: '選ばなくても送れます（金額は「その他手当」に入っています）。',
      askQ: 'いちばん近いものを選んでください',
      askSkip: 'スキップ',
      askOpts: ['飛行・勤務手当', '残業・深夜など', '毎月の固定手当', '賞与・一時金', '日当・立替精算', 'その他'],
      unmappedTitle: '金額として数えていない行',
      unmappedLead: '乗務日数のように、金額ではない行です。参考として出しています。',
      notStored: '※ 控除合計・差引支給額・総勤務時間も、送信するとこの記録に<b>一緒に保存します</b>（Duty Hour単価と手取りの計算に使います）。控除の<b>内訳</b>は保存しません。',
      lowConf: '※ 画像が読みにくく、自信がありません。数字は必ず見比べてください。',
      /* ★検算が合わないときは「自信がない」で済ませない。どこが合わないかを言う。
         一般論の警告は読み飛ばされるが、「差 ¥12,300」は見比べる先が分かる。 */
      chkGross: function (d) {
        return '※ 明細に印字された<b>支給合計</b>と、読み取った内訳の合計が合いません（差 ' + d +
               '）。行が抜けているか、金額を読み違えています。下の内訳を明細と見比べて直してください。';
      },
      /* ★桁がずれた／通貨が選べない、も同じ場所で言う。ここは本人が数字を
         見比べる唯一の場所で、say() は次の描画で消えてしまう。 */
      chkCur: function (c) {
        return '※ 明細の通貨（<b>' + c + '</b>）は、まだこのフォームで選べません。' +
               'いちばん近い通貨を選ぶか、金額をその通貨のまま入れて送ってください（数字はそのまま残ります）。';
      },
      chkMoney: '※ 小数点とけた区切りの見分けがつきませんでした。金額が1000倍ずれていないか、明細と見比べてください。',
      chkScale: '※ 読み取った支給合計が、月の金額としては小さすぎます。小数点を読み違えている可能性が高いので、必ず明細と見比べてください。',
      chkSwap: '※ 読み取った<b>控除合計</b>が<b>差引支給額（手取り）</b>より大きくなっています。2つを取り違えている可能性があるので、手取りの欄を明細と見比べてください。',
      chkNet: function (d) {
        return '※ <b>支給合計 − 控除合計</b>と、読み取った<b>差引支給額</b>が合いません（差 ' + d +
               '）。どちらかを読み違えています。手取りの欄を明細と見比べてください。';
      },
      fieldMissing: '（欄なし・表示のみ）',
      rate: 'あなたの時給',
      perBlock: '乗務時間あたり',
      perDuty: '総勤務時間あたり',
      perMin: '分給',
      deduct: '控除合計', net: '差引支給額', dutyH: '総勤務時間', nightH: '深夜時間', blockH: '乗務時間', creditH: 'クレジットアワー',
      notionalTag: '（収入に数えていません）',
      notionalNote: '※ 控除欄に同額が立つ現物給与の課税処理（航空券課税など）です。手取りが動かないので、時給の計算には入れていません。',
      absenceTag: '（減額）',
      absenceNote: '※ 明細に印字されている総支給額は、この減額を引いたあとの金額です。こちらで二重に引くことはしません。項目名と金額はそのまま記録します。',
      aiMark: 'AIが読んだ値',
      ahaT: 'この明細だと、年収はいくらのペースか',
      ahaPace: '年間ペース',
      exT: '明細にないお金',
      exBonus: 'ボーナス',
      exProfit: 'プロフィットシェア',
      perYear: '年',
      exMonthB: 'この明細のボーナス {a}・12倍には入れていません',
      exMonthP: 'この明細のプロフィットシェア {a}・12倍には入れていません',
      exSlip: 'ボーナスの明細 {t}', exRead: 'ボーナスの明細を読む', exRemove: '外す',
      exNone: 'その明細にボーナスの行が見つかりませんでした。',
      exFail: 'ボーナスの明細を読めませんでした。もう一度お試しください。',
      boT: 'これはボーナスの明細でした',
      boS: '年間ボーナスに {a} を入れました。続けて、月の給与の明細を読んでください。',
      boBtn: '月の給与の明細を読む',
      wasBonus: '選んだ明細はボーナスの明細でした。年間ボーナスに入れました。',
      someFail: '読めなかった明細が {n} 枚ありました。',
      ahaPickB: '会社と職位を選ぶ →',
      ahaNoAirline: '「その他」の会社には公開レンジがありません。',
      ahaNoBand: '訓練生の公開レンジはまだありません。副操縦士から比較が出ます。',
      ahaNoRange: 'この会社の公開レンジはまだありません。',
      ahaNoFx: function (c) { return c + ' の為替レートがまだ入っていないので、円に直せません（いま対応：JPY / USD / EUR / GBP / AUD / SGD / AED）。'; },
      ahaRangeT: function (a, p) { return a + '・' + p + 'の公開レンジ'; },
      ahaAvgTick: '公開平均',
      ahaBelow: function (v) { return 'レンジの下より ' + v + ' 低い'; },
      ahaAbove: function (v) { return 'レンジの上より ' + v + ' 高い'; },
      ahaIn: '公開レンジの中',
      ahaDiff: function (v, up) { return '公開平均より ' + v + (up ? ' 高い' : ' 低い'); },
      ahaSame: '公開平均とほぼ同じ',
      ahaRank: function (r, n) { return '同じ職位で公開レンジがある ' + n + '社の中では ' + r + '番目あたり'; },
      ahaUpT: '同じ職位で、公開平均がこれより高い会社',
      ahaNoUp: function (n) { return '同じ職位の ' + n + '社の中に、公開平均があなたより高い会社はありません。'; },
      ahaTaxFree: '無税',
      ahaNote: '※ 会社×職位の公開レンジ（当サイトの推計）との比較です。<b>機材・経験年数・契約形態は入っていません。</b>無税の国は総額が手取りに近いので、税引前どうしで並べたこの表より、実際の差は大きくなります。',
    },
    en: {
      prep: 'Preparing the image',
      readingNow: 'Reading your payslip',
      stepPrep: 'Preparing the image',
      stepRead: 'Reading the amounts',
      stepFill: 'Filling in the form',
      failT: 'Could not read it',
      resultTitleN: function (n) { return 'Read · ' + (n === 1 ? '1 field filled in' : n + ' fields filled in'); },
      retry: 'Read again',
      choose: 'Choose another payslip',
      manual: 'Type it in',
      view: 'View my payslip',
      viewClose: 'Close',
      viewHint: 'Tap to zoom in or out',
      viewLabel: 'Your payslip (shown only on this device)',
      badImage: 'That file could not be read. Please use a PDF, JPEG, PNG or WebP.',
      tooLarge: 'That file is too large. Please keep images under 6MB, PDFs under 20MB.',
      pdfReading: 'Opening the PDF… (the reader is downloaded the first time only)',
      pdfPages: function (n) { return 'Reading page 1 of ' + n + '. If your pay table is on another page, choose an image (screenshot) of that page instead.'; },
      pdfLocked: 'This PDF is password-protected. Save a copy without the password, or drop a screenshot of it instead.',
      lockT: 'This PDF has a password',
      lockMsg: 'Enter it to open the PDF here on your device.',
      lockBad: 'Wrong password. Please try again.',
      lockPh: 'PDF password',
      lockGo: 'Open',
      pdf: 'That PDF could not be opened. Open it and drop a screenshot instead.',
      /* ★Same two cases as above: the file opens but nothing can be drawn from it. */
      pdfXfa: 'This PDF uses a special form format (XFA) that cannot be drawn here. Open it and drop a screenshot instead.',
      pdfBlank: 'Nothing could be drawn from this PDF — it comes out blank. Open it and drop a screenshot instead.',
      errNet: 'Could not connect.',
      /* ★A failed read must always end with “you can type it in”. The form is already
         open once reading starts, so the words match what is on screen. A dead end
         here loses the most motivated person on the page. */
      errRead: 'Retaking the photo in good light, with the whole slip in frame, often helps.',
      errNotSlip: 'That does not look like a payslip.',
      errBusy: 'Reading is busy and no answer came back. Wait a moment and try again.',
      errPrep: 'This payslip could not be prepared for sending.',
      errBlank: 'This image could not be opened. Please choose a screenshot or a PDF.',
      errApply: 'It was read, but the figures could not be placed in the form.',
      errQuota: 'You have used today’s automatic reads. They are available again tomorrow.',
      errQuotaGlobal: 'Automatic reading is busy and we cannot take any more today. This did not use one of your reads.',
      errServer: 'Automatic reading is unavailable right now.',
      /* ★The disagreement list (owner, 2026-09-12, decision 6). What you typed is never overwritten. */
      cfTitle: 'Where your entry and the payslip differ',
      cfLead: '<b>Nothing here was changed.</b> Press only the ones where the payslip is right.',
      cfMine: 'You entered',
      cfSlip: 'Payslip',
      cfUse: 'Use the payslip value',
      /* ★Fixed amounts the payslip did not show (owner, 2026-09-12, decision 6).
         Last month's figure is never filled in on its own — only when pressed. */
      cdTitle: 'Amounts the payslip did not show',
      cdLead: 'You can reuse last month&rsquo;s figure. <b>Leave it alone and the box stays empty.</b>',
      cdUse: function (v) { return 'Use last month&rsquo;s ' + v; },
      resultTitle: 'Here is what we read',
      resultLead: '<b>Nothing has been submitted yet.</b> You review everything at the end.',
      col1: 'Line on your slip', col2: 'Goes into', col3: 'Amount',
      askBlockT: 'Block hours could not be read',
      askBlockOkT: 'Block hours',
      askBlockL: 'Add this one number and you get pay per block hour. It is the block / flight time line on your slip.',
      askBlockF: 'Picked up from your slip. Leave it if it looks right.',
      foldTitle: 'See what we read off your payslip ({n} lines)',
      foldTitleNoN: 'See what we read off your payslip',
      days: 'Flight days',
      uncTag: ' (unclassified)',
      askT: function (n) { return n === 1 ? 'We could not tell what this line is' : 'We could not tell what ' + n + ' lines are'; },
      askL: 'Optional — the amount is already counted under “Other allowances”.',
      askQ: 'Pick the closest match',
      askSkip: 'Skip',
      askOpts: ['Flight / duty pay', 'Overtime or night', 'Fixed monthly allowance', 'Bonus or one-off', 'Per diem / expenses', 'Something else'],
      unmappedTitle: 'Lines not counted as money',
      unmappedLead: 'Lines that are not amounts, such as flight days. Shown for reference.',
      notStored: '※ Total deductions, net pay and duty hours are <b>stored with this report</b> too when you submit (they drive your duty-hour rate and take-home). The <b>breakdown</b> of deductions is never stored.',
      lowConf: '※ The image was hard to read, so confidence is low. Please check every figure.',
      /* ★同上。合わない所を名指しする。差額を出すと、どこを見ればよいか分かる。 */
      chkGross: function (d) {
        return '※ The <b>gross total</b> printed on your payslip does not match the lines we read ' +
               '(off by ' + d + '). A line is missing, or an amount was misread. ' +
               'Please compare the breakdown below with your payslip and correct it.';
      },
      /* ★Same place as the reconcile warnings — this is the one screen where the
         person actually compares figures, and say() is wiped by the next paint. */
      chkCur: function (c) {
        return '※ Your payslip is in <b>' + c + '</b>, which this form cannot select yet. ' +
               'Pick the closest currency, or leave the amounts as they are and send them (the figures are kept).';
      },
      chkMoney: '※ We could not tell the decimal point from the thousands separator. Please check the amounts — they may be off by a factor of 1,000.',
      chkScale: '※ The gross total we read is too small for a monthly figure. A decimal point was probably misread — please compare every amount with your payslip.',
      chkSwap: '※ The <b>total deductions</b> we read are larger than the <b>net pay (take-home)</b>. The two may have been swapped — please check the net pay field against your payslip.',
      chkNet: function (d) {
        return '※ <b>Gross − deductions</b> does not match the <b>net pay</b> we read (off by ' + d +
               '). One of them was misread. Please check the take-home figure against your payslip.';
      },
      fieldMissing: '(no field yet — shown only)',
      rate: 'Your hourly pay',
      perBlock: 'per block hour',
      perDuty: 'per duty hour',
      perMin: 'per minute',
      deduct: 'Total deductions', net: 'Net pay', dutyH: 'Duty hours', nightH: 'Night hours', blockH: 'Block hours', creditH: 'Credit hours',
      notionalTag: ' (not counted as income)',
      notionalNote: '※ Imputed income that is taken straight back in the deductions column by the same amount (e.g. taxable staff travel). Your take-home does not change, so it is left out of the hourly figures.',
      absenceTag: ' (reduction)',
      absenceNote: '※ The gross printed on your slip is already net of this reduction. We do not subtract it a second time. The line name and the amount are recorded as they are.',
      aiMark: 'read by AI',
      ahaT: 'What this slip puts you on for the year',
      ahaPace: 'Annual pace',
      exT: 'Not on your payslip',
      exBonus: 'Bonus',
      exProfit: 'Profit share',
      perYear: 'yr',
      exMonthB: 'Bonus on this payslip {a} · not multiplied by 12',
      exMonthP: 'Profit share on this payslip {a} · not multiplied by 12',
      exSlip: 'Bonus payslip {t}', exRead: 'Read a bonus payslip', exRemove: 'Remove',
      exNone: 'We couldn’t find a bonus line on that payslip.',
      exFail: 'We couldn’t read that bonus payslip. Please try again.',
      boT: 'This is a bonus payslip',
      boS: 'We added {a} to your annual bonus. Next, read your monthly payslip.',
      boBtn: 'Read your monthly payslip',
      wasBonus: 'That was a bonus payslip, so we added it to your annual bonus.',
      someFail: 'We couldn’t read {n} of the payslips.',
      ahaPickB: 'Pick airline and seat →',
      ahaNoAirline: '“Other” has no published range.',
      ahaNoBand: 'There is no published range for cadets yet. Comparison starts at first officer.',
      ahaNoRange: 'No published range for this company yet.',
      ahaNoFx: function (c) { return 'We do not have an FX rate for ' + c + ' yet, so this cannot be converted (supported today: JPY / USD / EUR / GBP / AUD / SGD / AED).'; },
      ahaRangeT: function (a, p) { return 'Published range — ' + a + ', ' + p; },
      ahaAvgTick: 'Published average',
      ahaBelow: function (v) { return v + ' below the bottom of the range'; },
      ahaAbove: function (v) { return v + ' above the top of the range'; },
      ahaIn: 'Inside the published range',
      ahaDiff: function (v, up) { return v + (up ? ' above' : ' below') + ' the published average'; },
      ahaSame: 'Right at the published average',
      ahaRank: function (r, n) { return 'Around #' + r + ' of the ' + n + ' airlines with a published range for this seat'; },
      ahaUpT: 'Airlines whose published average for the same seat is higher',
      ahaNoUp: function (n) { return 'None of the ' + n + ' airlines with a published range for this seat pays more on average.'; },
      ahaTaxFree: 'tax-free',
      ahaNote: '※ Compared against our published range for that airline and seat. <b>It does not account for fleet, years of experience or contract type.</b> In tax-free countries the gross figure is close to take-home, so the real gap is wider than this pre-tax line-up shows.',
    }, /*PV-MSG:es*/ es: {
      prep: 'Preparando la imagen',
      readingNow: 'Leyendo tu recibo de nómina',
      stepPrep: 'Preparando la imagen',
      stepRead: 'Leyendo los importes',
      stepFill: 'Rellenando el formulario',
      failT: 'No se pudo leer',
      resultTitleN: function (n) { return 'Leído · ' + (n === 1 ? '1 campo completado' : n + ' campos completados'); },
      retry: 'Leer de nuevo',
      choose: 'Elegir otro recibo de nómina',
      manual: 'Escribirlo a mano',
      view: 'Ver mi recibo de nómina',
      viewClose: 'Cerrar',
      viewHint: 'Toca para acercar o alejar',
      viewLabel: 'Tu recibo de nómina (solo se muestra en este dispositivo)',
      badImage: 'No se pudo leer el archivo. Usa un PDF, JPEG, PNG o WebP.',
      tooLarge: 'El archivo es demasiado grande. Las imágenes deben pesar menos de 6 MB y los PDF, menos de 20 MB.',
      pdfReading: 'Abriendo el PDF… (el lector solo se descarga la primera vez)',
      pdfPages: function (n) { return 'Leyendo la página 1 de ' + n + '. Si tu tabla de pagos está en otra página, elige una imagen (captura de pantalla) de esa página.'; },
      pdfLocked: 'Este PDF está protegido con contraseña. Guarda una copia sin contraseña o, en su lugar, arrastra aquí una captura de pantalla.',
      lockT: 'Este PDF tiene contraseña',
      lockMsg: 'Escríbela para abrir el PDF aquí, en tu dispositivo.',
      lockBad: 'Contraseña incorrecta. Inténtalo de nuevo.',
      lockPh: 'Contraseña del PDF',
      lockGo: 'Abrir',
      pdf: 'No se pudo abrir el PDF. Ábrelo y, en su lugar, arrastra aquí una captura de pantalla.',
      /* ★Same two cases as above: the file opens but nothing can be drawn from it. */
      pdfXfa: 'Este PDF usa un formato de formulario especial (XFA) que no se puede mostrar aquí. Ábrelo y, en su lugar, arrastra aquí una captura de pantalla.',
      pdfBlank: 'No se pudo mostrar nada de este PDF — sale en blanco. Ábrelo y, en su lugar, arrastra aquí una captura de pantalla.',
      errNet: 'No se pudo conectar.',
      /* ★A failed read must always end with “you can type it in”. The form is already
         open once reading starts, so the words match what is on screen. A dead end
         here loses the most motivated person on the page. */
      errRead: 'Suele ayudar tomar otra foto con buena luz y con todo el recibo de nómina en el encuadre.',
      errNotSlip: 'No parece un recibo de nómina.',
      errBusy: 'La lectura está saturada y no llegó respuesta. Espera un momento y vuelve a intentarlo.',
      errPrep: 'No se pudo preparar este recibo de nómina para enviarlo.',
      errBlank: 'No se pudo abrir esta imagen. Elige una captura de pantalla o un PDF.',
      errApply: 'Se leyó, pero no se pudieron colocar las cifras en el formulario.',
      errQuota: 'Ya usaste las lecturas automáticas de hoy. Mañana vuelven a estar disponibles.',
      errQuotaGlobal: 'La lectura automática está saturada y hoy no podemos aceptar más. Esto no consumió ninguna de tus lecturas.',
      errServer: 'La lectura automática no está disponible en este momento.',
      /* ★The disagreement list (owner, 2026-09-12, decision 6). What you typed is never overwritten. */
      cfTitle: 'Diferencias entre lo que ingresaste y el recibo de nómina',
      cfLead: '<b>No se cambió nada.</b> Presiona solo aquellas en las que el recibo es el correcto.',
      cfMine: 'Lo que ingresaste',
      cfSlip: 'Recibo de nómina',
      cfUse: 'Usar el valor del recibo de nómina',
      /* ★Fixed amounts the payslip did not show (owner, 2026-09-12, decision 6).
         Last month's figure is never filled in on its own — only when pressed. */
      cdTitle: 'Montos que no aparecían en el recibo de nómina',
      cdLead: 'Puedes reutilizar la cifra del mes pasado. <b>Si no haces nada, la casilla queda vacía.</b>',
      cdUse: function (v) { return 'Usar la cifra del mes pasado: ' + v; },
      resultTitle: 'Esto es lo que leímos',
      resultLead: '<b>Todavía no se ha enviado nada.</b> Al final lo revisas todo.',
      col1: 'Concepto en tu recibo de nómina', col2: 'Se registra en', col3: 'Monto',
      askBlockT: 'No se pudieron leer las horas block (calzo a calzo)',
      askBlockOkT: 'Horas block',
      askBlockL: 'Agrega solo este número y obtendrás tu remuneración por hora block. Es la línea de horas block (calzo a calzo) / horas de vuelo de tu recibo.',
      askBlockF: 'Lo tomamos de tu recibo. Si se ve bien, déjalo así.',
      foldTitle: 'Ver lo que leímos de tu recibo de nómina ({n} líneas)',
      foldTitleNoN: 'Ver lo que leímos de tu recibo de nómina',
      days: 'Días de vuelo',
      uncTag: ' (sin clasificar)',
      askT: function (n) { return n === 1 ? 'No pudimos saber qué es esta línea' : 'No pudimos saber qué son ' + n + ' líneas'; },
      askL: 'Opcional: el monto ya se cuenta en “Otras asignaciones”.',
      askQ: 'Elige la opción más parecida',
      askSkip: 'Omitir',
      askOpts: ['Pago por vuelo / servicio', 'Horas extra o nocturnidad', 'Asignación mensual fija', 'Bono o pago único', 'Viáticos / gastos', 'Otro concepto'],
      unmappedTitle: 'Líneas que no se cuentan como monto',
      unmappedLead: 'Líneas que no son montos, como los días de vuelo. Se muestran como referencia.',
      notStored: '※ El total de deducciones, el sueldo neto y el tiempo de servicio también <b>se guardan con este reporte</b> al enviarlo (con ellos se calculan tu remuneración por hora de servicio y lo que recibes en mano). El <b>desglose</b> de las deducciones nunca se guarda.',
      lowConf: '※ La imagen era difícil de leer, así que la lectura es poco confiable. Revisa cada cifra.',
      /* ★同上。合わない所を名指しする。差額を出すと、どこを見ればよいか分かる。 */
      chkGross: function (d) {
        return '※ El <b>total bruto</b> impreso en tu recibo de nómina no coincide con las líneas que leímos ' +
               '(diferencia de ' + d + '). Falta una línea o se leyó mal un monto. ' +
               'Compara el desglose de abajo con tu recibo de nómina y corrígelo.';
      },
      /* ★Same place as the reconcile warnings — this is the one screen where the
         person actually compares figures, and say() is wiped by the next paint. */
      chkCur: function (c) {
        return '※ Tu recibo de nómina está en <b>' + c + '</b>, que este formulario todavía no permite seleccionar. ' +
               'Elige la moneda más cercana, o deja los montos como están y envíalos (las cifras se conservan).';
      },
      chkMoney: '※ No pudimos distinguir el punto decimal del separador de miles. Revisa los montos — podrían estar desfasados por un factor de 1,000.',
      chkScale: '※ El total bruto que leímos es demasiado bajo para una cifra mensual. Probablemente se leyó mal un punto decimal — compara cada monto con tu recibo de nómina.',
      chkSwap: '※ El <b>total de deducciones</b> que leímos es mayor que el <b>salario neto</b>. Puede que se hayan intercambiado: compara el campo del salario neto con tu recibo de nómina.',
      chkNet: function (d) {
        return '※ <b>Bruto − deducciones</b> no coincide con el <b>sueldo neto</b> que leímos (diferencia de ' + d +
               '). Uno de los dos se leyó mal. Compara la cifra de lo que recibes en mano con tu recibo de nómina.';
      },
      fieldMissing: '(aún no hay campo — solo se muestra)',
      rate: 'Tu remuneración por hora',
      perBlock: 'por hora block',
      perDuty: 'por hora de servicio',
      perMin: 'por minuto',
      deduct: 'Total de deducciones', net: 'Sueldo neto', dutyH: 'Tiempo de servicio', nightH: 'Horas nocturnas', blockH: 'Horas block', creditH: 'Horas de crédito',
      notionalTag: ' (no se cuenta como ingreso)',
      notionalNote: '※ Ingreso imputado que se descuenta de inmediato en la columna de deducciones por el mismo monto (p. ej., boletos de empleado gravables). Lo que recibes en mano no cambia, así que se excluye de las cifras por hora.',
      absenceTag: ' (descuento)',
      absenceNote: '※ El bruto impreso en tu recibo ya tiene descontada esta reducción. No la restamos por segunda vez. El nombre del concepto y el monto se registran tal como aparecen.',
      aiMark: 'leído por IA',
      ahaT: 'Tu remuneración anual al ritmo de este recibo',
      ahaPace: 'Ritmo anual',
      exT: 'Fuera de tu recibo de nómina',
      exBonus: 'Bono',
      exProfit: 'Participación en las utilidades',
      perYear: 'año',
      exMonthB: 'Bono en esta nómina {a} · no se multiplica por 12',
      exMonthP: 'Participación en beneficios en esta nómina {a} · no se multiplica por 12',
      exSlip: 'Recibo de bono {t}', exRead: 'Leer un recibo de bono', exRemove: 'Quitar',
      exNone: 'No encontramos una línea de bono en ese recibo.',
      exFail: 'No pudimos leer ese recibo de bono. Inténtalo de nuevo.',
      boT: 'Este es un recibo de bono',
      boS: 'Agregamos {a} a tu bono anual. Ahora lee tu recibo de nómina mensual.',
      boBtn: 'Leer tu recibo de nómina mensual',
      wasBonus: 'Ese era un recibo de bono, así que lo agregamos a tu bono anual.',
      someFail: 'No pudimos leer {n} de los recibos.',
      ahaPickB: 'Elegir aerolínea y puesto →',
      ahaNoAirline: '“Otra” no tiene rango publicado.',
      ahaNoBand: 'Todavía no hay un rango publicado para pilotos en formación. La comparación empieza en primer oficial.',
      ahaNoRange: 'Todavía no hay un rango publicado para esta aerolínea.',
      ahaNoFx: function (c) { return 'Todavía no tenemos tipo de cambio para ' + c + ', así que no se puede convertir (monedas disponibles hoy: JPY / USD / EUR / GBP / AUD / SGD / AED).'; },
      ahaRangeT: function (a, p) { return 'Rango publicado — ' + a + ', ' + p; },
      ahaAvgTick: 'Promedio publicado',
      ahaBelow: function (v) { return v + ' por debajo del límite inferior del rango'; },
      ahaAbove: function (v) { return v + ' por encima del límite superior del rango'; },
      ahaIn: 'Dentro del rango publicado',
      ahaDiff: function (v, up) { return v + (up ? ' por encima del' : ' por debajo del') + ' promedio publicado'; },
      ahaSame: 'Justo en el promedio publicado',
      ahaRank: function (r, n) { return 'Alrededor del lugar #' + r + ' de las ' + n + ' aerolíneas con rango publicado para este puesto'; },
      ahaUpT: 'Aerolíneas con un promedio publicado más alto para el mismo puesto',
      ahaNoUp: function (n) { return 'Ninguna de las ' + n + ' aerolíneas con rango publicado para este puesto paga más en promedio.'; },
      ahaTaxFree: 'libre de impuestos',
      ahaNote: '※ Comparación con nuestro rango publicado para esa aerolínea y ese puesto. <b>No toma en cuenta la flota, los años de experiencia ni el tipo de contrato.</b> En los países sin impuestos el monto bruto es cercano al neto, así que la diferencia real es mayor de lo que muestra esta comparación antes de impuestos.',
    } /*/PV-MSG:es*/,
  };
  T = (window.PV_T && window.PV_T(T, L)) || T[L];   // スペイン語の辞書（gen-msg.mjs が足す）があればそれ

  // ── 定数 ──────────────────────────────────────────────────
  /* ★送る画像の長辺。ページ全体を送るようになったので、細かい字が潰れないよう
     読み取り側の上限（長辺 2576px）の手前まで使う（2026-11-04。前は切り抜きなので 1568）。 */
  var MAX_EDGE = 2560;
  var MAX_BYTES = 6 * 1024 * 1024;
  /* PDF は端末の中で画像に描き直してから送るので、元の大きさは送る量と関係がない。
     スキャンした明細の PDF は10MBを超えることがあり、6MBで弾くと
     **いちばん確実に読める入り口**を自分で塞ぐことになる。 */
  var MAX_PDF_BYTES = 20 * 1024 * 1024;
  var JPEG_Q = 0.86;
  /* ★どの段にも上限（2026-11-04）。返事が来ないまま止まらない。
     サーバーは向こうの返事を60秒で打ち切るので、ブラウザはそれより長く待つ。 */
  var PREP_MS = 30000;        // 画像・PDF を整えるまで（PDF の部品を取りに行く時間を含む）
  var READ_MS = 90000;        // 読み取りの返事まで

  /* ── 計測（GA4。既存の gtag をそのまま使う。新しい業者は入れない）────────
     明細を出す道すじは「載せる → 探索が終わる → 送る → 読める」の4段あるのに、
     いままで記録していたのは最後の「保存できた」だけだった。
     どこで諦めたかが分からないと、画面をどう直しても当てずっぽうになる。
     ★送るのは段の名前と失敗の理由だけ。金額も社名も画像も送らない。
     ★引数名は track。この中では ev をイベント名の変数として使っている箇所がある。 */
  function track(name, params) {
    if (typeof window.gtag !== 'function') return;
    try { window.gtag('event', name, params || {}); } catch (e) {}
  }

  /* ── 運営に知らせる（2026-11-07）──────────────────────────────
     サーバーまで届かない失敗（ファイルが開けない・通信が切れた・入力欄に入れる所で落ちた）を、
     parse-payslip へ { report } で知らせる。受け取った関数が info@ へメールを送る（1日30通まで）。
     ★送るのは固定の理由の語・段・画像の大きさ（KB）だけ。画像も金額もファイル名も送らない。
     ★届かなくても何もしない（返事を待たない・画面を変えない・もう一度送らない）。 */
  function report(reason, stage, bytes) {
    try {
      if (typeof _sb === 'undefined' || !_sb || !_sb.functions) return;
      var kb = (typeof bytes === 'number' && bytes > 0) ? Math.round(bytes / 1024) : 0;
      Promise.resolve(_sb.functions.invoke('parse-payslip', {
        body: { report: { reason: String(reason), stage: String(stage), kb: kb } },
      })).catch(function () {});
    } catch (e) {}
  }

  /* 読み取った kind → 入れる欄。
     ★flight_variable はここに載っているが、行（tpl-pd-var）を作れたときは
       行のほうへ回して f-flightvar を空にする（apply の中。二重計上の境目はそこ1点だけ）。
     ★instructor / examiner はここに載せない。行き先が単純な1欄ではなく、
       役職のチェック → 節を出す → 「別途支給されている」を選ぶ、まで要るので apply() が持つ。 */
  var KIND_FIELD = {
    base: 'f-base',
    /* ★2026-08-27。基本給とは別の列（日本＝基本給が下限、米国＝保証給が下限で意味が違う）。
       混ぜるとレポートの緑の切れが「基本給」と嘘をつく。 */
    guarantee: 'f-guarantee',
    command: 'f-command',
    housing: 'f-housing-amt',
    flight_variable: 'f-other',
    per_diem: 'f-perdiem',
    transport: 'f-transport',
    /* ★absence（不就労減額・欠勤控除）はここに載せない（2026-09-12・指摘2）。
       前は other と同じ隠し欄 f-other に符号のまま足し込んでいた。金額は
       other_allowance に届くが、**項目名がどこにも残らず、画面にも確認画面にも
       1行も出ない**（隠し欄は誰も読まない）＝本人は減額に気づけず直せない。
       しかも印字されている総支給は**すでに減額後**なので、内訳の側でもう一度
       引くことになる ── 支給構成の「その他手当」が greatest(…,0) で 0 に潰れ、
       その人の帯から本物のその他手当が丸ごと消える。
       行き先は res._absence（＝隠し欄 f-absence → pay_items.absence[]）。
       apply() で別扱いにして、金額も符号も項目名もそのまま残す。 */
    other: 'f-other',
    /* ★2026-09-15、フォームから「今月の賞与・ボーナス」の欄が消えた（オーナー決定）。
       行き先だけ f-other（その他の現金・隠し欄）に移す。欄が無い id のままにすると
       setField が黙って落として**金額がどこにも残らない**。
       ⚠️ 分類（kind:'bonus' / asked:'bonus'）は変えない。語彙の正解データであり、
          サーバ側の白リストと Edge Function の語彙に入っている。
       ⚠️ 年間ボーナス(f-bonus)へは入れない。明細に印字されているのは「その月に出た額」
          なので、1ヶ月ぶんが年額として年収に丸ごと乗る（2026-08-13 の事故）。 */
    /* ★2026-11-11 オーナー「ボーナスとか手入力じゃん？明細アップロードから読み取れるようにして」──
       明細に印字されたボーナス・プロフィットシェアは「その月に出た1回分」。見えない欄 f-bonus-paid
       （＝ bonus_month）に入れて、年換算の ×12 から外す（サーバの pv_annual_total と同じ式）。
       年間ボーナス・プロフィットシェアの欄は、空のときだけこの額で埋める（syncBonus）。
       ⚠️ 年間ボーナスを読んだ1回分で上書きしない（本人が書いた年の合計を消す・2026-08-13 の事故の逆向き）。
       ⚠️ 前は profit を年額の欄へ直に入れ、同じ額が総支給 ×12 にも残っていた（二重）。 */
    bonus: 'f-bonus-paid',
    profit: 'f-bonus-paid',
    /* notional（航空券課税などの現物給与）はここに載せない。
       控除欄に同額が立って手取りが1円も動かないので、収入に足すと時給が水増しになる。
       apply() で別扱いにして「数えていません」と画面に出す。 */
  };
  /* 分類できなかった行のうち「金額でない行」（乗務日数・SECTORS など）。
     ★supabase/functions/parse-payslip/index.ts の isCountRow と同じ判定。
       あちらは count:true を付けて返すが、あの関数はダッシュボードで手作業で
       貼り替える＝サイト（push で出る）より古い時期が必ずある。印が付いて
       いない古い応答でも金額でない行を年収に足さないよう、こちらでも判定する。
       ★語だけで決めない。「変動付加乗務回数」のように回数という語を持つ本物の
         手当がある。金額を「回数」と見なして外すと、その額が年収から黙って消える
         （逆に回数を金額として数えても 14 が足されるだけ）。だから両方そろったときだけ。
       ★二重に持っている以上、ずれたら気づけるようにする＝
         db/test-payslip-parse.mjs がこの関数を切り出して向こうと突き合わせる。 */
  function isCountRow(label, amount) {
    var n = (typeof amount === 'number' && isFinite(amount)) ? Math.abs(amount) : 0;
    if (n > 400) return false;
    var s = String(label == null ? '' : label);
    if (/手当|allowance|\bpay\b|給|bonus/i.test(s)) return false;
    return /日数|回数|days|count|sectors|legs/i.test(s);
  }

  /* 「これは何に近いですか？」の6択 → 入れる欄と、内訳に残す分類。
     ★年収が動くのは bonus（×12する前に外す）と per_diem（時給の分子から外す）の2つだけ。
       残り4つは合計を1円も動かさない＝答えないことで損はしない。 */
  var UNC_CHOICES = [
    { field: 'f-other',    kind: 'flight_variable', asked: 'flight_variable' },
    { field: 'f-other',    kind: 'flight_variable', asked: 'night_ot' },
    { field: 'f-command',  kind: 'command',         asked: 'command' },
    { field: 'f-bonus-paid', kind: 'bonus',         asked: 'bonus' },   // ★2026-11-11 ×12 から外す（上の KIND_FIELD と同じ）
    { field: 'f-perdiem',  kind: 'per_diem',        asked: 'per_diem' },
    { field: 'f-other',    kind: 'other',           asked: 'other' },
  ];
  /* 辞書から返ってきた分類を引く表。★ここに無い語は当たらない＝画面側の門。
     辞書は公開ビューなので、SQL 側で語彙を締めてあってもここでもう一度締める
     （片方が緩んだときに、他人の金額の行き先を書き換えられるのを防ぐ）。 */
  var UNC_BY_ASKED = {};
  UNC_CHOICES.forEach(function (c) { UNC_BY_ASKED[c.asked] = c; });

  /* ── ラベル辞書（2026-08-14）─────────────────────────────────
     分類できなかった行を、前の人たちが6択で答えていたら、その答えを使う。
     ＝同じ質問を100人に繰り返さない。3人以上が一致した答えだけが
     public.pv_label_hints に出る（門番の本体は SQL 側。db/pay-reports.sql の 6-b）。

     ★明細を送るのと同時に取りに行く。読み取りに15秒かかるので待ち時間は増えない。
     ★引けなくても読み取りは普通に終わる（辞書が空なら今までどおり6択が出るだけ）。
     ★辞書が入れた行は「票」にしない（detailJson で asked ではなく hint に残す）。
       混ぜると、3人の答えが100人に自動適用されて「103人が確認済み」に化ける。 */
  var HINTS = null;
  function normLabel(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function loadHints() {
    HINTS = {};
    var sel = document.getElementById('f-airline');
    var code = sel ? String(sel.value || '') : '';
    /* 会社は明細に書いていない（黒塗りの前に切り落としている）ので、
       ?airline= で来た人・前回の内容が復元された人だけ会社別の辞書が引ける。
       分からなければ会社をまたいだ辞書だけで引く。 */
    var want = (code && code !== 'other') ? [code, '*'] : ['*'];
    try {
      return _sb.from('pv_label_hints').select('airline,label,asked,scope')
        .in('airline', want)
        .then(function (r) {
          var a = {}, g = {};
          ((r && r.data) || []).forEach(function (h) {
            if (!h || !h.label || !UNC_BY_ASKED[h.asked]) return;
            (h.scope === 'airline' ? a : g)[normLabel(h.label)] = h.asked;
          });
          // 会社ごとの答えが先。会社をまたいだ答えで上書きしない。
          Object.keys(g).forEach(function (k) { if (!(k in a)) a[k] = g[k]; });
          HINTS = a;
        })
        .catch(function () {});
    } catch (e2) { return Promise.resolve(); }
  }

  var FIELD_LABEL = {
    'f-gross': { ja: 'その月の総支給額', en: 'Gross pay for the month' },
    'f-base': { ja: '基本給', en: 'Base pay' },
    'f-guarantee': { ja: 'Flight time 保証手当 / 職務手当',
                     en: 'Flight time guarantee / Duty allowance' },
    'f-guar': { ja: '保証フライトタイム', en: 'Guaranteed flight time' },
    'f-command': { ja: '機長・役職手当', en: 'Command / position pay' },
    /* 役割ごとの手当（2026-08-27）。額は専用の列へ入るので、
       確認リストにも「その他手当」ではなくこの名前で出る。 */
    'f-instructor': { ja: '教官・訓練の支給額', en: 'Instructor / training pay' },
    'f-examiner': { ja: '審査・査察の支給額', en: 'Examiner / check pay' },
    'f-housing-amt': { ja: '住宅手当', en: 'Housing allowance' },
    'f-perdiem': { ja: 'パーディアム', en: 'Per diem' },
    'f-transport': { ja: '交通費', en: 'Transport' },
    'f-other': { ja: 'その他手当', en: 'Other allowances' },
    'f-bonus': { ja: '年間ボーナス', en: 'Annual bonus' },
    'f-profit': { ja: 'プロフィットシェア（年）', en: 'Profit share (annual)' },
    'f-bonus-paid': { ja: 'この月のボーナス（12倍しない）', en: 'Bonus this month (not ×12)' },
    'f-block': { ja: 'フライトタイム', en: 'Flight time' },
    'f-netpay': { ja: '手取り額', en: 'Net pay' },
    'f-duty-h': { ja: '勤務時間', en: 'Duty time' },
    'f-currency': { ja: '通貨', en: 'Currency' },
    'f-year': { ja: '対象月', en: 'Period' },
    /* ★欄ではなく「行」に入るもの（2026-08-27）。id ではないので getElementById には
       渡らない。確認の表に行き先として出すためだけの名前。 */
    'pd-var': { ja: '変動給', en: 'Variable pay' },
    'pd-oth': { ja: 'その他の現金手当', en: 'Other cash allowance' },
  };

  /* 役割ごとの手当 → 専用の列。KIND_FIELD と分けているのは行き先が1欄ではないから
     （役職にチェック → 節を出す → 「別途支給されている」を選ぶ、まで要る）。
     ★組合・管理職・兼務は入れない（オーナー決定 2026-08-27）。組合は「組合名を返さない」
       という規則と唯一ぶつかり、管理職・兼務は明細に決まった印字が無い。 */
  var ROLE_FIELD = { instructor: 'f-instructor', examiner: 'f-examiner' };

  // ── 小道具 ────────────────────────────────────────────────
  var el = function (tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  var esc2 = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
  /* ★検算の差額専用。円なら整数だが、AED / USD の明細は小数第2位まで印字されるので
     そこを丸めると「差 0」と出て何が合わないのか分からなくなる。 */
  var nf2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  var lbl = function (id) { return FIELD_LABEL[id] ? FIELD_LABEL[id][L] : id; };

  // ── 状態 ──────────────────────────────────────────────────
  var work = null;     // 送る画像（端末で描き直した canvas・長辺 MAX_EDGE まで）
  var W = 0, H = 0;
  var lastHours = null;
  var busy = false;    // 読み取り中（連打・二重の読み取りを止める）
  var readToken = 0;   // 読み取りの番号。やめた読み取り・別の明細に移ったあとの返事を捨てる
  var kindNow = '';    // 'pdf' | 'image'（記録用）
  var pageNote = '';   // 「Nページのうち1ページ目を読んでいます」
  var viewUrl = '';    // 明細を見る用（このページのメモリだけ）

  // ── DOM ───────────────────────────────────────────────────
  var fileInput = document.getElementById('ps-file');
  var dropBtn = document.getElementById('ps-drop');
  var panel = document.getElementById('ps-panel');
  if (!fileInput || !dropBtn || !panel) return;

  /* ★ここからログイン画面へ送らない（2026-08-14）。読み取りの回数は
     ログインしてもしなくても同じになったので、誘う理由が無くなった。
     失敗したときも入力フォームは開いている（startRead）。 */
  function say(kind, msg) {
    panel.innerHTML = '';
    panel.appendChild(el('div', 'ps-msg ps-msg-' + kind, msg));
  }
  function clearPanel() { panel.innerHTML = ''; }

  // ════════════════════════════════════════════════════════
  // ① 受け取る
  // ════════════════════════════════════════════════════════
  /* ★読む明細の種類（2026-11-11）。'bonus' ＝「ボーナスの明細を読む」から来た1枚＝月の欄には1つも書かない。
       ファイルを選ばずに閉じたら戻す（次に落とした明細を、黙ってボーナスとして読まない）。 */
  var readMode = 'month', readModeAt = 0;
  fileInput.addEventListener('cancel', function () { readMode = 'month'; });
  function readBonusSlip() { readMode = 'bonus'; readModeAt = Date.now(); bonusMsg = ''; fileInput.click(); }
  dropBtn.addEventListener('click', function () { readMode = 'month'; fileInput.click(); });
  /* ★2026-11-11 オーナー「普通に明細アップロードからボーナスもアップロードできるようにして」──
       何枚でも一緒に選べる（6枚まで）。1枚ずつ順に読み、ボーナスだけの明細は年間ボーナスへ（isBonusOnly）、
       月の給与の明細は月の欄へ（apply）。読めなかった1枚があっても、残りは続けて読む。 */
  var queue = [], batchOk = 0, qFails = 0;
  var MAX_FILES = 6;
  function takeMany(list) {
    list = [].slice.call(list || []).filter(Boolean).slice(0, MAX_FILES);
    if (!list.length) return;
    queue = list.slice(1); batchOk = 0; qFails = 0;
    take(list[0]);
  }
  function nextQueued() {
    if (!queue.length) { readMode = 'month'; return false; }
    var f = queue.shift();
    setTimeout(function () { take(f); }, 250);
    return true;
  }
  function failNote() { return qFails ? T.someFail.replace('{n}', function () { return String(qFails); }) : ''; }
  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files.length) takeMany(fileInput.files);
    fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach(function (ev) {
    root.addEventListener(ev, function (e) { e.preventDefault(); dropBtn.classList.add('is-over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    root.addEventListener(ev, function (e) { e.preventDefault(); dropBtn.classList.remove('is-over'); });
  });
  root.addEventListener('drop', function (e) {
    var fs = e.dataTransfer && e.dataTransfer.files;
    if (fs && fs.length) { if (Date.now() - readModeAt > 60000) readMode = 'month'; takeMany(fs); }
  });

  function take(file, pw) {
    var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    /* ★ここで弾かれた人は「明細を出そうとしたのに1歩も進めなかった人」。
       黙って戻ると、選びもしなかった人と同じ数に見えてしまう。 */
    if (file.size > (isPdf ? MAX_PDF_BYTES : MAX_BYTES)) {
      track('payslip_reject', { reason: 'too_large' });
      report('too_large', 'file', file.size);
      return showFail('too_large');
    }
    if (!isPdf && !/^image\//.test(file.type)) {
      track('payslip_reject', { reason: 'bad_type' });
      report('bad_type', 'file', file.size);
      return showFail('bad_type');
    }
    /* ★読み取りの途中で別の明細を選んだら、前の読み取りの返事は捨てる（番号を進める）。
       向こうの処理は止まらないので、返ってきても画面には入れない。 */
    var mine = ++readToken;
    busy = false;
    /* ★前に選んだ明細の絵と送る画像を捨てる（新しい明細で失敗したとき、前の明細の絵を出さない）。 */
    if (viewUrl) { try { URL.revokeObjectURL(viewUrl); } catch (e) {} viewUrl = ''; }
    work = null;
    kindNow = isPdf ? 'pdf' : 'image';
    pageNote = '';
    if (!pw) track('payslip_loaded', { kind: kindNow });   // パスワードを入れ直した回は数えない（同じ1枚）
    clearPanel();
    loadOpen();
    var t0 = now();
    var p = isPdf ? withTimeout(renderPdf(file, pw), PREP_MS, 'pdf_timeout')
                  : withTimeout(loadImage(file), PREP_MS, 'image_timeout');
    var via = 'img';
    p.then(function (r) {
      if (mine !== readToken) return false;
      var bmp = isPdf ? r.canvas : r;
      /* ★何ページ目を読むかを、読み取り中の表示に添える（初版は1ページ目だけ）。 */
      pageNote = (isPdf && r.pages > 1) ? T.pdfPages(r.pages) : '';
      try { buildWork(bmp); } catch (e) { throw tag('image_decode'); }
      /* ★描き写したら元は閉じてよい。この先は work（送る画像）だけを使う。
         2026-11-04 までは閉じた ImageBitmap を送る段でもう一度描こうとして、
         予備の読み込み方に落ちたときだけ「通信エラー」に化けていた。 */
      if (!isPdf && bmp && typeof bmp.close === 'function') { try { bmp.close(); } catch (e) {} }
      if (isPdf || !blank(work)) return true;
      /* ★描けていない（2026-11-05・iPhone 実機）。別の読み込み方でもう一度だけ描く。
         それでも一色なら送らない ── 読み取りの回数も費用も使わずに、本人に分かる言葉で止める。 */
      via = 'bitmap';
      return withTimeout(altBitmap(file), PREP_MS, 'image_timeout').then(function (b2) {
        if (mine !== readToken) return false;
        try { buildWork(b2); } catch (e) { throw tag('image_blank'); }
        try { if (b2 && b2.close) b2.close(); } catch (e) {}
        if (blank(work)) throw tag('image_blank');
        return true;
      }, function (e) { throw (e && e.pvCode === 'image_timeout') ? e : tag('image_blank'); });
    }).then(function (go) {
      if (!go || mine !== readToken) return;
      makeView();
      track('payslip_prepared', { kind: kindNow, ms: since(t0), via: via });
      startRead();
    }).catch(function (e) {
      if (mine !== readToken) return;
      /* ★PDF の失敗は4つに分ける（パスワード・XFA・白紙・それ以外）。
         pvReason は renderPdf が付ける。付いていない例外だけ、ここで見分ける。 */
      var why = (e && e.pvCode) || (e && e.pvReason && ('pdf_' + e.pvReason)) || (isPdf
        ? ((e && (e.name === 'PasswordException' || /password/i.test(String(e.message || '')))) ? 'pdf_locked' : 'pdf_broken')
        : 'image_decode');
      /* ★PDF の部品の読み込みが止まったら、次の PDF でもう一度取りに行く
         （止まったままの約束を持ち続けると、以後の PDF が全部止まる）。 */
      if (why === 'pdf_timeout') pdfLib = null;
      /* ★1枚だけ選んだときは行き止まりにしない ── パスワードを聞いて、端末の中で開き直す。
         ここではまだ失敗の知らせを送らない（打てば読めるのがふつう）。送るのは諦めて別の道を選んだときだけ（askPassword）。
         まとめて何枚も選んだ途中の1枚は今までどおり（読めなかった1枚として数え、残りへ進む）。 */
      if (why === 'pdf_locked' && !queue.length && !batchOk) {
        track('payslip_pdf_password', { wrong: pw ? 1 : 0 });
        return askPassword(file, !!pw);
      }
      track('payslip_reject', { reason: why });
      report(why, 'file', file.size);
      showFail(why);
    });
  }

  // ════════════════════════════════════════════════════════
  // ② 読み取る（選んだらすぐ・確認の画面は無い）
  // ════════════════════════════════════════════════════════
  /* ★連打・二重の読み取りは busy で止める。返事は番号（readToken）で照合し、
     やめた読み取り・別の明細に移ったあとの返事は1文字も画面に入れない。
     ★自動で送り直さない。時間切れでも向こうでは処理が続いているかもしれず、
       送り直すと二重に読む（回数も費用も2回分）。送り直すのは本人が「もう一度読む」を押したときだけ。 */
  function startRead() {
    if (!work || busy) return;
    busy = true;
    var mine = ++readToken;
    markReading();
    openForm();
    loadOpen();
    loadStep(1);
    var hints = loadHints();
    var t0 = now();
    toB64(work).then(function (b64) {
      if (mine !== readToken) return null;
      /* ★「送信を開始した」＝画像ができて、呼び出しの直前（2026-11-04 に定義を変えた）。 */
      track('payslip_sent', { kind: kindNow });
      return withTimeout(_sb.functions.invoke('parse-payslip', {
        body: { image_b64: b64, mime: 'image/jpeg', lang: L },
      }), READ_MS, 'timeout');
    }, function () { throw tag('prep_failed', 'prep'); })
      .then(function (r) {
        if (!r) return null;
        if (r.error) {
          return (r.error.context && typeof r.error.context.json === 'function')
            ? r.error.context.json().catch(function () { return null; })
            : null;
        }
        return r.data;
      })
      .then(function (out) {
        if (mine !== readToken) return;                     // やめた・別の明細に移った
        /* ★ここが「読めたか」を知っている唯一の場所。理由まで残さないと、
           鍵が死んでいる（read_failed が1〜2秒で返る）のか、上限に当たっているのか、
           明細でない画像を送られているのかを、あとから区別できない。 */
        if (!out) throw tag('network');
        if (!out.ok) throw tag(String(out.reason || 'unknown'), 'server');
        track('payslip_api_ok', { ms: since(t0) });
        loadStep(2);
        /* 辞書が来てから下書きする（loadHints は失敗しても解決する）。 */
        return hints.then(function () {
          if (mine !== readToken) return;
          /* ★入力欄に入れるところで落ちたら「通信エラー」にしない（2026-11-04 まで
             read_ok のあとに read_ng network も記録していた）。 */
          try {
            /* ★ボーナスの明細（2026-11-11）。「ボーナスの明細を読む」から来た1枚か、読んだら支給がボーナスだけだった1枚は、
                 月の欄に1つも書かず、年間ボーナスに足す（月の総支給にボーナスを入れて ×12 しない）。 */
            if (readMode === 'bonus') applyBonus(out.result, false);
            else if (isBonusOnly(out.result)) applyBonus(out.result, true);
            else apply(out.result);
          } catch (e) { throw tag('apply_failed', 'apply'); }
          busy = false;
          batchOk++;
          loadDone();
          nextQueued();                     // ★まとめて選んだ次の1枚へ（無ければ読み方を月に戻す）
          /* ★payslip_read_ok ＝ 読めた数字が入力欄に入った（2026-11-04 に定義を変えた。
             前は「サーバーが答えた」の時点で記録していた。サーバーの答えは payslip_api_ok）。 */
          track('payslip_read_ok', { ms: since(t0) });
        });
      })
      .catch(function (e) {
        if (mine !== readToken) return;
        busy = false;
        var code = (e && e.pvCode) || 'network';
        var stage = (e && e.pvStage) || 'network';
        track('payslip_read_ng', { reason: code, stage: stage });
        /* サーバーで止まった失敗は、サーバーが自分で知らせている（ここからは送らない）。 */
        if (stage !== 'server') report(code, stage, 0);
        showFail(code);
      });
  }

  /* ★読み取りを始める前に「明細を読んでいる」印を立てる（2026-11-04）。
     読み取りのあいだに先の質問へ進めるようにしたので、ウィザードの下書きの復元が
     apply() より**先**に走る。印が無いと、先月の金額がその場で入り、あとから来た明細の
     数字のほうが「本人が入れた値」に負ける（setField は本人の値を上書きしない）。
     印があれば、復元はその月の金額の欄を1つも戻さない（pay-report.html の restoreInto の psIn）。
     ★2枚目以降は控えがすでにある（前の明細が書いた欄）。ここで作り直すと、
       apply() の clearPrevFilled が前の明細の値を消せなくなるので、触らない。 */
  function markReading() {
    if (!filled) filled = new Set(['__ps_reading']);
  }
  function openForm() {
    if (typeof window.PVEnterMode === 'function') {
      try { window.PVEnterMode('manual'); } catch (e) {}
    }
  }

  /* ── 時間の小道具 ── */
  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function since(t0) { return Math.round(now() - t0); }
  function tag(code, stage) { var e = new Error(code); e.pvCode = code; e.pvStage = stage || code; return e; }
  /* ★どの段にも上限を付ける。返事が来ないまま「準備中」「読み取り中」で止まらない。 */
  function withTimeout(p, ms, code) {
    return new Promise(function (res, rej) {
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; rej(tag(code)); } }, ms);
      Promise.resolve(p).then(function (v) { if (!done) { done = true; clearTimeout(t); res(v); } },
                              function (e) { if (!done) { done = true; clearTimeout(t); rej(e); } });
    });
  }

  // ════════════════════════════════════════════════════════
  // ③ 状態を見せる（読み取り中は 0〜100% の輪・2026-11-05 オーナー指示）
  // ════════════════════════════════════════════════════════
  function btn(label, cls, fn, id) {
    var b = el('button', 'ps-btn ' + cls, esc2(label));
    b.type = 'button';
    if (id) b.id = id;
    b.addEventListener('click', fn);
    return b;
  }
  function viewBtn() { return viewUrl ? btn(T.view, 'ps-btn-ghost', openView, 'ps-view-btn') : null; }
  function bar(items) {
    var d = el('div', 'ps-bar');
    items.forEach(function (b) { if (b) d.appendChild(b); });
    return d;
  }
  /* ★2026-11-04（その4）オーナー指示「ローディングの画面になって、
       明細を読み取っています／✓画像を整える／✓金額を読む／✓フォームに入れる　それだけ。他は白い画面でいい」。
     読み取りのあいだは画面全体を白で覆い、出すのは見出しと3つの段だけ。
     段が終わるたびに ✓ が付き、3つそろったら覆いが消えて、数字の入ったフォームが出る。
     ★秒数・見本の絵・×・お知らせ・説明の文を足し戻さない（オーナーが外した）。
     ★止まったままにはならない ── 画像の準備は30秒・読み取りは90秒で打ち切り、失敗の札へ移る（withTimeout）。
     ★2026-11-05 オーナー指示「ぐるぐる回るエフェクトじゃなくて、進むごとに時計回りに緑が回ってく方がいい。
       0-100% 表示にして」。見出しの上に輪を1つ置き、緑が12時から時計回りに伸びる。真ん中に％。
       回る印（psSpin）は外した。段の ✓ はそのまま。
     ★％の決め方（RING）：整える 0→10・読む 10→92・入れる 92→99・終わったら 100。
       読む段の中身の進み具合はサーバーから返ってこないので、返事を待つあいだは時間で伸ばし、
       だんだん遅くなって 92 を超えない（返事が来るまで 100 にしない）。前より小さい値は出さない。 */
  var load = null;
  var RING = [[0, 10, 0.6], [10, 92, 14], [92, 99, 0.35]];   // [始め, 終わり, 伸び方の秒]
  var ring = null;                                           // { at, t0, tgt, d, raf, fg, n, box }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function ringEl() {
    var box = el('div', 'ps-ring');
    box.setAttribute('role', 'progressbar');
    box.setAttribute('aria-valuemin', '0');
    box.setAttribute('aria-valuemax', '100');
    box.setAttribute('aria-valuenow', '0');
    box.setAttribute('aria-label', T.readingNow);
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('aria-hidden', 'true');
    var bg = document.createElementNS(SVGNS, 'circle');
    var fg = document.createElementNS(SVGNS, 'circle');
    [bg, fg].forEach(function (c) { c.setAttribute('cx', '60'); c.setAttribute('cy', '60'); c.setAttribute('r', '52'); });
    bg.setAttribute('class', 'ps-ring-bg');
    fg.setAttribute('class', 'ps-ring-fg');
    fg.setAttribute('pathLength', '100');
    fg.setAttribute('stroke-dasharray', '100');
    fg.setAttribute('stroke-dashoffset', '100');
    fg.setAttribute('transform', 'rotate(-90 60 60)');      // 12時から時計回り
    svg.appendChild(bg);
    svg.appendChild(fg);
    box.appendChild(svg);
    var n = el('span', 'ps-ring-n');
    n.setAttribute('aria-hidden', 'true');
    n.innerHTML = '0<small>%</small>';
    box.appendChild(n);
    ring = { at: 0, t0: now(), tgt: 0, d: 0, raf: 0, fg: fg, n: n, box: box, shown: 0 };
    return box;
  }
  function ringPaint() {
    if (!ring) return;
    var v = ring.d >= 99.95 ? 100 : Math.floor(ring.d);
    ring.fg.setAttribute('stroke-dashoffset', String(100 - ring.d));
    if (v !== ring.shown) {
      ring.shown = v;
      ring.n.innerHTML = v + '<small>%</small>';
      ring.box.setAttribute('aria-valuenow', String(v));
    }
  }
  function ringTick() {
    if (!ring || !load) return;
    var t = (now() - ring.t0) / 1000;
    var want = 100;
    if (ring.at < 3) {
      var r = RING[ring.at];
      want = r[0] + (r[1] - r[0]) * (1 - Math.exp(-t / r[2]));
    }
    ring.tgt = Math.max(ring.tgt, want);
    ring.d += (ring.tgt - ring.d) * 0.18;                   // 段が変わっても跳ばずに追いつく
    if (ring.tgt - ring.d < 0.05) ring.d = ring.tgt;
    ringPaint();
    ring.raf = window.requestAnimationFrame ? window.requestAnimationFrame(ringTick) : setTimeout(ringTick, 50);
  }
  function ringStop() {
    if (!ring) return;
    if (window.cancelAnimationFrame) window.cancelAnimationFrame(ring.raf); else clearTimeout(ring.raf);
    ring = null;
  }
  function loadOpen() {
    if (load) return;
    load = el('div', 'ps-load ps-state is-busy');
    load.setAttribute('role', 'status');
    load.setAttribute('aria-live', 'polite');
    load.setAttribute('aria-busy', 'true');
    var inner = el('div', 'ps-load-in');
    inner.appendChild(ringEl());
    inner.appendChild(el('p', 'ps-load-t', esc2(T.readingNow)));
    var ol = el('ol', 'ps-steps');
    [T.stepPrep, T.stepRead, T.stepFill].forEach(function (name) {
      var li = el('li', '');
      li.appendChild(el('i', 'ps-step-dot'));
      li.appendChild(el('span', '', esc2(name)));
      li.setAttribute('data-s', 'todo');
      ol.appendChild(li);
    });
    inner.appendChild(ol);
    load.appendChild(inner);
    document.body.appendChild(load);
    /* ★スクロールを止めるのは html の class（body.style.overflow を直に書くと、ほかの部品が閉じるときに外れる）。 */
    document.documentElement.classList.add('ps-load-lock');
    loadStep(0);
    ringTick();
  }
  /* at: いま動いている段（0＝整える・1＝読む・2＝入れる・3＝全部終わった） */
  function loadStep(at) {
    if (!load) return;
    load.className = 'ps-load ps-state ' + (at === 0 ? 'is-busy' : at < 3 ? 'is-read' : 'is-done');
    [].forEach.call(load.querySelectorAll('.ps-steps li'), function (li, i) {
      li.setAttribute('data-s', i < at ? 'done' : i === at ? 'active' : 'todo');
    });
    /* 段が進んだら、輪はその段の始めから伸び直す（いまの値より下には戻らない）。 */
    if (ring && at !== ring.at) { ring.at = at; ring.t0 = now(); }
  }
  function loadClose() {
    if (!load) return;
    var n = load;
    load = null;
    ringStop();
    document.documentElement.classList.remove('ps-load-lock');
    n.classList.add('is-out');
    setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 260);
  }
  /* 3つそろった ✓ を一拍見せてから覆いを外し、読めた結果の札へ移る。 */
  function loadDone() {
    loadStep(3);
    setTimeout(function () {
      loadClose();
      try { panel.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { panel.scrollIntoView(); }
    }, 650);
  }
  /* 失敗の札に出す、選んだ明細の小さな見本。押すと拡大して見られる（#ps-view-btn）。 */
  function thumb() {
    var d = btn('', 'ps-thumb', openView, 'ps-view-btn');
    d.className = 'ps-thumb';
    d.setAttribute('aria-label', T.view);
    d.title = T.view;
    var im = document.createElement('img');
    im.id = 'ps-thumb-img';
    im.alt = '';
    im.src = viewUrl;
    d.appendChild(im);
    return d;
  }
  function chooseBtn(cls) { return btn(T.choose, cls || 'ps-btn-ghost', function () { readMode = 'month'; fileInput.click(); }, 'ps-choose'); }
  function retryRead() { track('payslip_retry'); startRead(); }

  /* 読み取りの失敗・ファイルの失敗。★どれでも行き止まりにしない ──
     もう一度読む（直る見込みのあるものだけ）／別の明細を選ぶ／手で入力する、の道を必ず出す。
     ★いちばん勧める道を1つだけ緑の主ボタンにする（同じ画像で直りうる → もう一度読む／ファイルの問題 → 別の明細／それ以外 → 手で入力）。 */
  var ERR = {
    rate_limited: 'errQuota',
    rate_limited_global: 'errQuotaGlobal',
    read_failed: 'errRead', read_bad_format: 'errRead', read_truncated: 'errRead', read_refused: 'errRead',
    not_a_payslip: 'errNotSlip',
    read_busy: 'errBusy', timeout: 'errBusy',
    network: 'errNet',
    prep_failed: 'errPrep', apply_failed: 'errApply',
    image_too_large: 'tooLarge', too_large: 'tooLarge', bad_mime: 'badImage', bad_type: 'badImage',
    image_decode: 'badImage', image_timeout: 'errPrep', image_blank: 'errBlank',
    pdf_locked: 'pdfLocked', pdf_xfa: 'pdfXfa', pdf_blank: 'pdfBlank', pdf_broken: 'pdf', pdf_timeout: 'errPrep',
    server_misconfigured: 'errServer', quota_unavailable: 'errServer',
  };
  /* ★同じ画像のままもう一度読んで直る見込みがあるものだけ。断られた・明細でない・
     上限に達した・入力欄に入れられなかった、は同じ画像では直らない。 */
  var RETRY = { network: 1, timeout: 1, read_busy: 1, read_failed: 1, read_bad_format: 1, read_truncated: 1 };
  var FILE_ERR = { too_large: 1, bad_type: 1, image_decode: 1, image_blank: 1, image_too_large: 1, bad_mime: 1, not_a_payslip: 1,
                   pdf_locked: 1, pdf_xfa: 1, pdf_blank: 1, pdf_broken: 1, image_timeout: 1, pdf_timeout: 1, prep_failed: 1 };
  function showFail(code) {
    /* ★まとめて読んでいる途中（読めた1枚がある・まだ残りがある）：読めた分の画面は消さず、数だけ言って次へ */
    if ((batchOk > 0 || queue.length) && (lastRes || slipParts.length || queue.length)) {
      qFails++; loadClose(); bonusMsg = failNote();
      if (lastRes) renderResult(lastRes, lastTrace);
      else if (slipParts.length) renderBonusOnly(slipPart('bonus') + slipPart('profit'));
      if (nextQueued() || lastRes || slipParts.length) return;
    }
    if (readMode === 'bonus' && lastRes) {          // ★ボーナスの明細だけ読めなかった＝前の明細の結果は消さない
      readMode = 'month'; loadClose(); bonusMsg = T.exFail;
      renderResult(lastRes, lastTrace);
      return;
    }
    readMode = 'month';
    loadClose();
    panel.innerHTML = '';
    var box = el('div', 'ps-live ps-fail');
    box.setAttribute('role', 'alert');
    box.setAttribute('data-code', code);
    var row = el('div', 'ps-live-row');
    if (viewUrl) { row.appendChild(thumb()); box.classList.add('has-thumb'); }
    var main = el('div', 'ps-live-main');
    main.appendChild(el('span', 'ps-state-t ps-live-t', esc2(T.failT)));
    main.appendChild(el('p', 'ps-live-msg', T[ERR[code] || 'errRead']));
    row.appendChild(main);
    box.appendChild(row);
    /* ★いちばん勧める道だけ緑のボタン。ほかは字のボタン（明細を見るは、見本の絵を押す）。 */
    var retry = (work && RETRY[code]) ? btn(T.retry, 'ps-btn-primary', retryRead, 'ps-retry') : null;
    var choose = chooseBtn('ps-btn-link');
    var manual = btn(T.manual, 'ps-btn-link', function () { openForm(); focusForm(); }, 'ps-manual');
    if (!retry) (FILE_ERR[code] ? choose : manual).className = 'ps-btn ps-btn-primary';
    box.appendChild(bar([retry, choose, manual]));
    panel.appendChild(box);
    try { panel.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { panel.scrollIntoView(); }
  }
  /* 鍵の付いた PDF：パスワードを聞くポップアップ（2026-11-13 オーナー「最初からポップアップにしろよ、右上に消すばつも小さく」）。
     打った字は take → renderPdf に渡すだけで、変数にも保存領域にも残さない。
     ★閉じる（× と Esc）も「別の明細を選ぶ」も「諦めた」＝ここで初めて「読めなかった」を1回だけ知らせる。
     ★外側を押しても閉じない（打っている途中に指が外へ出て消えると、打ち直しになる）。
     ★「パスワードは送りません」の1文と「手で入力する」は置かない（2026-11-13 オーナー「これいらない」）。
     ★スクロールを止めるのは html の class（明細を見る画面と同じ ps-view-lock）。 */
  var lockDlg = null;
  function lockClose() {
    if (!lockDlg) return;
    var n = lockDlg;
    lockDlg = null;
    n.remove();
    document.documentElement.classList.remove('ps-view-lock');
  }
  function askPassword(file, wrong) {
    loadClose();
    lockClose();
    var gaveUp = false;
    function giveUp() { if (gaveUp) return; gaveUp = true; track('payslip_reject', { reason: 'pdf_locked' }); report('pdf_locked', 'file', file.size); }
    function dismiss() {
      giveUp();
      lockClose();
      /* ボーナスの明細だけ読めなかった＝前の明細の結果は消さない（showFail と同じ扱い） */
      if (readMode === 'bonus' && lastRes) { readMode = 'month'; bonusMsg = T.exFail; renderResult(lastRes, lastTrace); }
      else readMode = 'month';
      try { dropBtn.focus({ preventScroll: true }); } catch (e) {}
    }
    var dlg = el('div', 'ps-lock');
    dlg.setAttribute('data-code', 'pdf_locked');
    var card = el('div', 'ps-lock-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'ps-lock-t');
    var title = el('h2', 'ps-lock-t', esc2(T.lockT));
    title.id = 'ps-lock-t';
    card.appendChild(title);
    var msg = el('p', 'ps-lock-msg' + (wrong ? ' is-bad' : ''), esc2(wrong ? T.lockBad : T.lockMsg));
    if (wrong) msg.setAttribute('role', 'alert');
    card.appendChild(msg);
    var form = document.createElement('form');
    form.className = 'ps-pw';
    form.noValidate = true;
    var inp = document.createElement('input');
    inp.type = 'password';
    inp.id = 'ps-pw';
    inp.autocomplete = 'off';
    inp.setAttribute('autocapitalize', 'off');
    inp.setAttribute('spellcheck', 'false');
    inp.setAttribute('enterkeyhint', 'go');
    inp.setAttribute('aria-label', T.lockPh);
    inp.placeholder = T.lockPh;
    var go = el('button', 'ps-btn ps-btn-primary', esc2(T.lockGo));
    go.type = 'submit';
    go.id = 'ps-pw-go';
    form.appendChild(inp);
    form.appendChild(go);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = inp.value;
      if (!v) { inp.focus(); return; }
      inp.value = '';
      lockClose();
      take(file, v);
    });
    card.appendChild(form);
    var choose = btn(T.choose, 'ps-btn-link', function () { giveUp(); lockClose(); readMode = 'month'; fileInput.click(); }, 'ps-choose');
    card.appendChild(bar([choose]));
    var x = btn('', 'ps-lock-x', dismiss, 'ps-pw-x');
    x.className = 'ps-lock-x';
    x.setAttribute('aria-label', T.viewClose);
    x.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    card.appendChild(x);
    dlg.appendChild(card);
    /* Esc は × と同じ。Tab はポップアップの中だけを回る。 */
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); dismiss(); return; }
      if (e.key !== 'Tab') return;
      var f = [inp, go, choose, x], i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); x.focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); inp.focus(); }
    });
    document.body.appendChild(dlg);
    lockDlg = dlg;
    document.documentElement.classList.add('ps-view-lock');
    try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); }
  }
  function focusForm() {
    var h = document.querySelector('#form-body:not([hidden]) h2, #form-body:not([hidden]) select, #form-body:not([hidden]) input');
    if (h && typeof h.focus === 'function') { try { h.focus(); } catch (e) {} }
  }

  // ════════════════════════════════════════════════════════
  // ④ 自分の明細を見る（直すとき用・このページのメモリだけ）
  // ════════════════════════════════════════════════════════
  /* ★画像は保存しない。作るのは送る画像（work）から作った blob の URL だけで、
     このページを閉じれば消える。localStorage にもどこにも書かない。 */
  function makeView() {
    if (viewUrl) { try { URL.revokeObjectURL(viewUrl); } catch (e) {} viewUrl = ''; }
    if (!work || !work.toBlob) return;
    work.toBlob(function (b) {
      if (!b) return;
      viewUrl = URL.createObjectURL(b);
      /* blob は少し遅れてできる。読み取り中の札がもう出ていたら、見本の絵をそこに入れる（押すと拡大）。 */
      var im = document.getElementById('ps-thumb-img');
      if (im) { im.src = viewUrl; if (im.parentNode) im.parentNode.classList.remove('is-empty'); }
    }, 'image/jpeg', 0.9);
  }
  var viewer = null;
  var viewBack = null;
  function openView() {
    if (!viewUrl || viewer) return;
    track('payslip_view');
    viewBack = document.activeElement;
    viewer = el('div', 'ps-view');
    viewer.setAttribute('role', 'dialog');
    viewer.setAttribute('aria-modal', 'true');
    viewer.setAttribute('aria-label', T.viewLabel);
    var head = el('div', 'ps-view-head');
    head.appendChild(el('span', 'ps-view-hint', esc2(T.viewHint)));
    var close = btn(T.viewClose, 'ps-btn-ghost ps-view-x', closeView, 'ps-view-close');
    head.appendChild(close);
    var scroller = el('div', 'ps-view-body');
    var img = document.createElement('img');
    img.src = viewUrl;
    img.alt = T.viewLabel;
    img.className = 'ps-view-img';
    img.addEventListener('click', function () { img.classList.toggle('is-zoom'); });
    scroller.appendChild(img);
    viewer.appendChild(head);
    viewer.appendChild(scroller);
    viewer.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeView(); });
    viewer.addEventListener('click', function (e) { if (e.target === viewer) closeView(); });
    document.body.appendChild(viewer);
    /* ★スクロールを止めるのは html の class（body.style.overflow を直に書くと、
       ほかの部品が閉じるときに空へ戻して外れる）。 */
    document.documentElement.classList.add('ps-view-lock');
    close.focus();
  }
  function closeView() {
    if (!viewer) return;
    viewer.remove();
    viewer = null;
    document.documentElement.classList.remove('ps-view-lock');
    if (viewBack && typeof viewBack.focus === 'function') { try { viewBack.focus(); } catch (e) {} }
    viewBack = null;
  }

  // ════════════════════════════════════════════════════════
  // ①-b PDF（海外の明細はメールで届く PDF がふつう）
  //
  //    1ページ目を端末の中で画像に描き出して、それを送る（2026-11-04 から。前は黒塗りの手がかりにも
  //    文字の層を使っていた）。文字の層は、いまは「XFA の案内ページ」と「白紙」を見分けるためだけに読む。
  //    pdf.js は**PDF が選ばれたときにだけ**取りに行く（画像の人には読み込ませない）。
  // ════════════════════════════════════════════════════════
  var PDF_JS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.min.js';
  var PDF_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js';
  var PDF_W = 2400;          // 描き出す横幅。OCR に落ちたときでも字が潰れない大きさ
  var PDF_MAXPX = 12e6;

  var pdfLib = null;
  function loadPdf() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfLib) return pdfLib;
    pdfLib = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = PDF_JS;
      s.onload = function () { window.pdfjsLib ? res(window.pdfjsLib) : rej(new Error('pdf')); };
      s.onerror = function () { pdfLib = null; rej(new Error('cdn')); };
      document.head.appendChild(s);
    });
    return pdfLib;
  }

  /* 動的 XFA の PDF は、中身のかわりに Adobe の案内ページ1枚だけが描かれる。
     真っ白ではないので白紙判定には掛からない。この文面は本物の明細には絶対に出ないので、
     IsXFAPresent と**両方そろったときだけ**見る＝静的 XFA（普通に描ける様式）を巻き込まない。 */
  var XFA_WRAP = /eventually replaced|proper contents of the document|正しい内容に置き|このメッセージが表示/i;
  function isXfaWrapper(words) {
    var s = '';
    for (var i = 0; i < words.length && s.length < 4000; i++) s += (words[i].t || '') + ' ';
    return XFA_WRAP.test(s);
  }

  /* 描き出した1ページ目が「一様な1色」か。縮めてから読む（原寸は数千万画素ある）。
     ★PDF の経路だけで使う。白紙の**画像**を選んだのは本人の選択、
       白紙になった**PDF**はこちらが描けなかった結果で、責任が違う。
     ★読めないときは「白紙ではない」に倒す＝疑わしきは通す（送信を止めない）。 */
  function isBlankCanvas(c) {
    try {
      var w = 64, h = Math.max(1, Math.round(64 * c.height / (c.width || 1)));
      var t = document.createElement('canvas');
      t.width = w; t.height = h;
      var tx = t.getContext('2d');
      tx.fillStyle = '#fff';
      tx.fillRect(0, 0, w, h);
      tx.drawImage(c, 0, 0, w, h);
      var d = tx.getImageData(0, 0, w, h).data;
      var lo = 255, hi = 0;
      for (var i = 0; i < d.length; i += 4) {
        var v = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      return (hi - lo) < 8;
    } catch (e) { return false; }
  }

  function renderPdf(file, pw) {
    /* ★この変数を L と名付けない。ファイル先頭の L（＝言語）を遮蔽してしまい、
       この中で文言を言語で出し分けた瞬間に壊れる。 */
    var lib = null;
    return loadPdf().then(function (l) {
      lib = l;
      lib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
      return file.arrayBuffer ? file.arrayBuffer() : new Response(file).arrayBuffer();
    }).then(function (buf) {
      /* isEvalSupported:false＝PDF の中の JavaScript を動かさない。
         他人が作った PDF を開くので、こちらから実行の道を開けない。 */
      /* ★pw は本人が打ったパスワード。pdf.js が端末の中で鍵を外すのに使うだけで、どこにも送らない・残さない。 */
      var opt = { data: new Uint8Array(buf), isEvalSupported: false };
      if (pw) opt.password = pw;
      return lib.getDocument(opt).promise;
    }).then(function (doc) {
      var pages = doc.numPages;
      /* メタが取れないのは致命ではないので、失敗したら空で進む。 */
      return doc.getMetadata().then(function (m) { return (m && m.info) || {}; },
                                    function () { return {}; })
        .then(function (info) { return doc.getPage(1).then(function (page) {
        var base = page.getViewport({ scale: 1 });
        var s = Math.min(PDF_W / base.width, Math.sqrt(PDF_MAXPX / (base.width * base.height)));
        var vp = page.getViewport({ scale: Math.max(1, s) });
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(vp.width));
        c.height = Math.max(1, Math.round(vp.height));
        var cx = c.getContext('2d');
        /* 先に白で埋める。PDF の背景は透明なので、そのままだと
           黒塗りの判定も、送る JPEG も、透明の扱いで崩れる。 */
        cx.fillStyle = '#fff';
        cx.fillRect(0, 0, c.width, c.height);
        /* ⚠️ ここを1つの catch でまとめない。**描けなかった**ことが
           「白紙の成功」に化け、真っ白な JPEG がそのまま送られていた。
           描画は致命、文字の層は致命ではない（無ければ OCR に落ちればよい）。 */
        return page.render({ canvasContext: cx, viewport: vp }).promise
          .then(function () {
            /* ⚠️ AcroForm（入力欄つき）の PDF では、金額も氏名も widget の中にあり
               getTextContent() に**出てこない**。文字の層があるように見えるので
               （2026-11-04 まで黒塗りの手がかりに使っていた名残。いまは白紙・XFA の
               見分けにだけ使う。文字の層が空なら下の白紙の判定に回る）。
               ⚠️ annotationMode を ENABLE_FORMS(2) にしないこと。既定では widget の
                  見た目がそのまま canvas に描かれるが、2 にすると描画が HTML 側に
                  委ねられ、canvas から**金額が消える**（pdf.js 3.11.174 で実測）。 */
            if (info.IsAcroFormPresent) return [];
            return page.getTextContent().then(
              function (tc) { return pdfWords(lib, tc, vp, c); },
              function () { return []; }
            );
          })
          .then(function (words) {
            var why = words.length
              ? ((info.IsXFAPresent && isXfaWrapper(words)) ? 'xfa' : '')
              : (isBlankCanvas(c) ? (info.IsXFAPresent ? 'xfa' : 'blank') : '');
            if (why) {
              var e = new Error(why);
              e.pvReason = why;                 // take() の catch がこれで文言を選ぶ
              throw e;
            }
            return { canvas: c, pages: pages, words: words };
          });
      }); });
    });
  }

  /* 文字の層を、OCR の返り値と**同じ形**（画像に対する割合の矩形）に均す。
     ここを揃えておけば、この先の照合も帯の作り方も1本で済む
     ＝片方の経路だけが直る／壊れる、が起きない。

     PDF の座標は下が原点。viewport の変換を通すと画面の向きになる。
     1つの item に語がいくつも入ることがあるので空白で割り、
     文字数で幅を按分する（厳密ではないが、帯は語の**塊**に置くので足りる）。 */
  function pdfWords(lib, tc, vp, c) {    // ★L と名付けない（先頭の L＝言語を遮蔽する）
    var out = [];
    (tc && tc.items || []).forEach(function (it) {
      var s = String(it.str || '');
      if (!s.trim() || !it.transform) return;
      var m = lib.Util.transform(vp.transform, it.transform);
      var h = Math.sqrt(m[2] * m[2] + m[3] * m[3]) || (it.height * vp.scale) || 10;
      var w = (it.width || 0) * vp.scale;
      if (!(w > 0)) return;
      var x0 = m[4], y1 = m[5];                      // 変換後はベースラインの左端
      var total = s.length || 1;
      var at = 0;
      s.split(/\s+/).forEach(function (p) {
        if (!p) return;
        var i = s.indexOf(p, at);
        if (i < 0) i = at;
        at = i + p.length;
        out.push({
          t: p, c: 100,
          x0: (x0 + w * (i / total)) / c.width,
          x1: (x0 + w * (at / total)) / c.width,
          y0: (y1 - h) / c.height, y1: y1 / c.height,
        });
      });
    });
    return out;
  }

  /* EXIF の向きはここで潰す。送るのは再エンコード後なので、
     位置情報などのメタも一緒に落ちる。

     ★<img> を先に使う。createImageBitmap ではない。
       同じファイル・同じ寸法・同じ倍率で描き写しても、
       ImageBitmap から拡大したキャンバスは OCR の読み取り語数が半分以下に落ちる
       （合成 fixture で実測：130語 → 62語、91語 → 50語）。
       画素そのものは平均差 0.5／最大 38 でほぼ同じ。目で見ても違いは分からない。
       それでも壊れるのは、tesseract の内部2値化がヒストグラムの僅かな差で反転し、
       灰色で塗った表の中身が丸ごと落ちるため。白地の見出しと脚注だけが読めて、
       表の中＝氏名・社員番号・口座がある場所が読めなくなる。
       resizeQuality:'high' でも段階的な拡大でも直らない。描き元を替えるしかない。
     ★Chrome / Safari / Firefox の <img> は EXIF の向きを既定で適用する
       （image-orientation: from-image が初期値）ので、向きの扱いは変わらない。 */
  function loadImage(file) {
    return new Promise(function (res, rej) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      var ok = function () { URL.revokeObjectURL(url); res(img); };
      var ng = function () { URL.revokeObjectURL(url); rej(new Error('img')); };
      img.onload = ok;
      img.onerror = ng;
      img.src = url;
      if (img.decode) img.decode().then(ok, function () { /* onload に任せる */ });
    }).catch(function () {
      if (typeof createImageBitmap !== 'function') throw new Error('img');
      return createImageBitmap(file, { imageOrientation: 'from-image' })
        .catch(function () { return createImageBitmap(file); });
    });
  }

  /* 予備の読み込み方（<img> で描けなかったとき・W と H は1回目の buildWork が決めた大きさ）。
     縮めながら開ける端末では縮めて開く（大きな写真を原寸で開けない端末のため）。
     ★縦横が入れ替わって返ってきたら（向きを直す前に縮める端末）使わず、原寸で開き直す。 */
  function altBitmap(file) {
    if (typeof createImageBitmap !== 'function') return Promise.reject(tag('image_blank'));
    var want = W / H;
    var plain = function () {
      return createImageBitmap(file, { imageOrientation: 'from-image' })
        .catch(function () { return createImageBitmap(file); });
    };
    return createImageBitmap(file, { imageOrientation: 'from-image', resizeWidth: W, resizeHeight: H, resizeQuality: 'high' })
      .then(function (b) {
        if (b && b.width && b.height && Math.abs(b.width / b.height - want) < 0.02) return b;
        try { if (b && b.close) b.close(); } catch (e) {}
        return plain();
      }, plain);
  }

  /* work ＝ 送る画像。長辺 MAX_EDGE まで縮める（引き伸ばしはしない＝無い画素は作れない）。
     ★先に白で塗ってから描く（2026-11-05・iPhone 実機で真っ黒の画像が届いた）。
       JPEG は透明を持てず、透明な画素は黒になる。PDF から書き出した PNG のような
       背景が透明な明細は、黒い字が黒い地に沈んで「真っ黒」になっていた。
       描けなかったときも塗った白が残るだけ＝送る前に blank() で見つけられる。 */
  function buildWork(bmp) {
    var iw = bmp.width || bmp.naturalWidth, ih = bmp.height || bmp.naturalHeight;
    if (!iw || !ih) throw new Error('size');
    var s = Math.min(1, MAX_EDGE / Math.max(iw, ih));
    W = Math.max(1, Math.round(iw * s));
    H = Math.max(1, Math.round(ih * s));
    work = document.createElement('canvas');
    work.width = W; work.height = H;
    var cx = work.getContext('2d');
    cx.fillStyle = '#fff';
    cx.fillRect(0, 0, W, H);
    cx.drawImage(bmp, 0, 0, W, H);
  }

  /* ★描けたかを、送る前に確かめる（2026-11-05）。一色だけの絵は明細ではありえない ──
     端末が画像を描けなかった（塗った白のまま）か、中身が無い。そのまま送ると、
     読み取りの側が「給与明細に見えません」と返し、本人には何が悪いか分からない。
     確かめられないとき（読み出しが禁じられた端末など）は止めない。 */
  function blank(c) {
    try {
      var n = 96, t = document.createElement('canvas');
      t.width = n; t.height = n;
      var x = t.getContext('2d');
      x.drawImage(c, 0, 0, n, n);
      var d = x.getImageData(0, 0, n, n).data, lo = 765, hi = 0;
      for (var i = 0; i < d.length; i += 4) {
        var v = d[i] + d[i + 1] + d[i + 2];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      return hi - lo < 12;
    } catch (e) { return false; }
  }

  function toB64(canvas) {
    return new Promise(function (res, rej) {
      canvas.toBlob(function (blob) {
        if (!blob) return rej(new Error('blob'));
        var fr = new FileReader();
        fr.onload = function () { res(String(fr.result).split(',')[1]); };
        fr.onerror = function () { rej(new Error('fr')); };
        fr.readAsDataURL(blob);
      }, 'image/jpeg', JPEG_Q);
    });
  }

  // ════════════════════════════════════════════════════════
  // ⑤ フォームに下書きする（★投稿はしない）
  // ════════════════════════════════════════════════════════
  /* ── 明細が入れた欄を覚えておく（2026-09-11）──────────────────────
     ★入口で「明細から自動入力」を選んだ人は、読み取りが終わった瞬間に
       PVEnterMode('manual') でウィザードが走り出し、そこで**先月の下書き**が
       復元される。順番の都合で、いま明細から入れた数字がその場で先月の値へ
       戻っていた（.ai-filled の緑枠は残るので、画面は「明細から読み取りました」と
       言い続ける＝そのままマイページと REAL PAY にも入る）。
     ⚠️ どの欄を守るかを「.ai-filled」で決めてはいけない。writeHidden はあの印を
        付けないので、控除合計・年初来累計・出所など7欄が今までどおり上書きされる
        ＝直したつもりで半分しか直らない。**書いた関数自身に記録させる**ので、
        将来 apply() が新しい欄を埋めても自動で守られる。
     ★null のままなら「明細は何も入れていない」＝復元側は今までどおり全部戻す。 */
  var filled = null;
  function mark(id) { if (filled) filled.add(id); }
  window.PVPayslipFilled = function () { return filled; };

  /* ── 落とし直したとき、前の明細の値を残さない（2026-09-11）─────────────
     1枚目に GUARANTEE 73.00 がある明細、2枚目に無い明細を続けて落とすと、
     f-guar に 73.00 が**緑枠（明細から入った欄です）のまま**残っていた。
     annualTotal() の Math.max(f-block, f-guar) が時給の分母に効くので、
     **画面は普通に動いたまま、時給だけが前の明細の数で出る**。
     sums の欄（f-base / f-command / f-perdiem …）も同じで、2枚目に無い項目は
     1枚目の値がそのまま残り、しかも「明細から読み取りました」と言い続ける。
     ★消すのは「まだ .ai-filled が付いている欄」だけ。本人が触った欄は unmark で
       印が外れているので触らない（せっかく直した値を消さない）。
     ★何を書いたかは filled が知っている（setField も writeHidden も自分で記録する）。
       将来 apply() が新しい欄を埋めても、足し忘れようがない。
     ⚠️ 選択肢の欄は「空の選択肢を持つもの」だけ戻す（通貨・住居）。
        対象年・対象月には空の選択肢が無く、先月が既定で必ず選ばれている
        ＝空にすると必須の欄が選べない状態になるので触らない。
     ⚠️ 役職（f-jobrole）と明細上の名称は残す。あれは本人が選んだものに
        明細の分を足した結果なので、消すと本人の選択まで消える。 */
  var KEEP_ON_RELOAD = { 'f-jobrole': 1, 'f-instr-label': 1, 'f-exam-label': 1, 'f-source': 1 };
  function clearPrevFilled() {
    if (!filled) return;                                  // 1枚目＝消すものが無い
    filled.forEach(function (id) {
      if (KEEP_ON_RELOAD[id]) return;
      var e2 = document.getElementById(id);
      if (!e2) return;
      if (e2.type === 'hidden') { e2.value = ''; return; }        // writeHidden と同じで静かに
      if (!e2.classList.contains('ai-filled')) return;            // 本人が触った欄
      if (e2.tagName === 'SELECT') {
        var blank = Array.prototype.some.call(e2.options, function (o) { return o.value === ''; });
        if (!blank) return;
        e2.value = '';
      } else {
        e2.value = '';
      }
      e2.classList.remove('ai-filled');
      e2.dispatchEvent(new Event('change', { bubbles: true }));
      e2.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  /* ── 本人が打った金額は上書きしない（2026-09-12 オーナー決定6）─────────
     ★ここに来る時点で、前の明細が入れた値は clearPrevFilled() が、
       前回から引き継いだ値は PVPayDropPrevMonth() が、それぞれ空にしている。
       ＝**空でない金額が残っていたら、それは本人がこの月に打った値**。
     ★黙って上書きすると、本人が明細を見ながら直した数字が消える。しかも
       .ai-filled の緑枠が付くので、画面は「明細から読み取りました」と言い続ける。
     ★止めるだけにしない。食い違いは cfRows に積んで、あとで一覧に出す
       （行ごとに「明細の値にする」を置く ── 押されたときだけ入る）。
     ⚠️ 対象は**金額と時間の欄だけ**。通貨・対象月・役職の札は明細のほうが
        その月の事実なので、今までどおり上書きする。 */
  var CONFLICT_IDS = { 'f-gross': 1, 'f-netpay': 1, 'f-base': 1, 'f-guarantee': 1,
    'f-command': 1, 'f-housing-amt': 1, 'f-perdiem': 1,
    'f-instructor': 1, 'f-examiner': 1, 'f-block': 1, 'f-guar': 1, 'f-duty-h': 1 };
  var cfRows = [];
  /* 桁区切り・小数点の書き方だけの違いを「食い違い」と呼ばない。 */
  function sameNum(a, b) {
    var f = function (s) { return String(s).replace(/[^0-9.-]/g, ''); };
    var x = parseFloat(f(a)), y = parseFloat(f(b));
    return isFinite(x) && isFinite(y) && Math.abs(x - y) < 0.005;
  }
  function setField(id, value) {
    var e2 = document.getElementById(id);
    if (!e2) return false;
    if (CONFLICT_IDS[id] && e2.type !== 'hidden' && e2.tagName !== 'SELECT') {
      var have = String(e2.value || '').trim();
      if (have !== '' && !e2.classList.contains('ai-filled')) {
        if (!sameNum(have, value)) cfRows.push({ id: id, mine: have, slip: String(value) });
        return false;                      // ★本人の値を残す
      }
    }
    if (e2.tagName === 'SELECT') {
      var ok = Array.prototype.some.call(e2.options, function (o) { return o.value === String(value); });
      if (!ok) return false;
    }
    e2.value = String(value);
    e2.classList.add('ai-filled');
    mark(id);
    /* ★順番が要る。先に unmark を付けてから dispatch すると、
       いま自分が出したイベントで自分のハイライトを消してしまう。 */
    e2.dispatchEvent(new Event('change', { bubbles: true }));
    e2.dispatchEvent(new Event('input', { bubbles: true }));
    e2.addEventListener('input', unmark);
    e2.addEventListener('change', unmark);
    return true;
  }
  function unmark(e2) { e2.currentTarget.classList.remove('ai-filled'); }

  /* ── 変動給を「行」に載せる（2026-08-27）────────────────────────
     pay-report.html の繰り返し行（tpl-pd-var）は素の <script> の中で定義されていて
     global に居る。無ければ今までどおり隠しの合計へ落ちるだけ＝古い HTML でも壊れない。 */
  function canRows(kind) {
    return typeof pdAdd === 'function' && typeof pdSync === 'function' &&
           !!document.getElementById('tpl-pd-' + (kind || 'var'));
  }
  /* 前回この明細から生やした行（落とし直したら消す）。種類ごとに分けて覚える。 */
  var seededRows = { var: [], oth: [] };
  var SUM_OF = { var: 'f-var-sum', oth: 'f-oth-sum' };
  /* ── 読めた手当を「行」に載せる（2026-08-27 変動給／2026-09-12 その他の現金手当）──
     ★kind='oth' は指摘3 の直し。前は「家族手当」「株式積立奨励金」のような、
       語彙に無い／その他に分類された行が、隠し欄 f-other に**合算**されていた。
       金額は other_allowance に届いていたが、**項目名は診断用の控えの中にしか残らず**、
       本人の画面にも確認画面にも1行も出ない＝見ても直せない。
       手で打つ人と同じ入れ物（pd-oth の行）に載せれば、項目名と金額がそのまま
       pay_items.other[] に入り、確認画面にも出て、本人がその場で直せる。
     ★行に載せた分は f-other に書かない（f-oth-sum が拾う＝二重計上になる）。
     ★必須は1つも増えない（tpl-pd-oth に req-tag は無い）。 */
  function seedRows(kind, seed) {
    /* ★明細を落とし直したら、前に生やした行は必ず消す。足すだけにすると
       2回落とした人の変動給が2倍になる（欄なら上書きで済んでいた所）。
       本人が自分で足した行には触らない（こちらが作った行だけを覚えている）。 */
    seededRows[kind].forEach(function (r) { if (r && r.parentNode) r.parentNode.removeChild(r); });
    seededRows[kind] = [];
    if (!seed || !seed.length || !canRows(kind)) { if (typeof pdSync === 'function') pdSync(); return; }
    /* ★本物の行を載せる前に、空のまま置いてある行を片づける（2026-09-03 その4）。
       pay-report.html が読み込みのときに変動給を1本出している。消さないと
       「空の行のあと明細から入った行」という並びになる（送信は止まらないので
       画面は普通に動いたまま残る）。古い HTML には無い＝あれば呼ぶ。 */
    if (typeof pdDropEmpty === 'function') pdDropEmpty(kind);
    if (typeof openOpt === 'function') openOpt('pd-' + kind, true);   // 節そのものを開ける
    seed.forEach(function (t) {
      var row = pdAdd(kind, true);
      if (!row) return;
      t.row = row;
      seededRows[kind].push(row);
      var set = function (sel, v) {
        var e2 = row.querySelector(sel);
        if (!e2 || v == null || v === '') return;
        e2.value = String(v);
        /* 行の中の欄にも「AIが入れた」印を付ける（本人が触ったら外れる）。 */
        e2.classList.add('ai-filled');
        /* ★setField と同じ順で change → input を出す（2026-09-12）。金額の欄は
           change を受けたときだけ桁区切りに整う（moneySettle）ので、出さないと
           明細から入った行だけ 28000 と素の数字で並ぶ（手で打った欄は 28,000）。
           ★unmark を付けるのは dispatch の後。先に付けると、いま自分が出した
           イベントで自分のハイライトを消す。 */
        e2.dispatchEvent(new Event('change', { bubbles: true }));
        e2.dispatchEvent(new Event('input', { bubbles: true }));
        e2.addEventListener('input', unmark);
        e2.addEventListener('change', unmark);
      };
      /* ★basis は必ず入れる。空のままだと必須（req-tag）に引っかかって、
         明細から入った人だけが送信できなくなる。分からない行は 'unknown'。 */
      if (kind === 'var') set('.pd-basis', t.basis || 'unknown');
      set('.pd-amt', String(Math.round(t.amount || 0)));
      set('.pd-label', t.label);
    });
    var det = document.getElementById('pay-detail');
    if (det) det.open = true;
    pdSync();                        // f-var-sum と f-payitems を組み直す（中で recalc）
    /* ★行を1本でも生やしたら、下書きの復元に f-payitems を触らせない。
       pdRestore は空の行しか片づけないので、明細の行の**後ろ**に下書きの行が足され、
       DOM の行／f-var-sum／f-payitems の三者が食い違う（送信は止まらない）。 */
    if (seededRows[kind].length) { mark('f-payitems'); mark(SUM_OF[kind]); }
  }

  /* ── 教官・審査の節を出して額を入れる（2026-08-27）──────────────
     ①役職にチェックを付ける ②「別途支給されている」を選ぶ ③名称を入れる ④節を開く。
     金額そのものは apply() の sums の書き込みが入れる（この順でないと欄がまだ無い）。
     ★支給単位・数量・担当訓練は入れない。明細から分からないので本人が足す。 */
  function openRoles(sums, roleLabel) {
    var want = [];
    if (sums['f-instructor'] != null) want.push('instructor');
    if (sums['f-examiner'] != null) want.push('examiner');
    if (!want.length) return;
    var jr = document.getElementById('f-jobrole');
    if (!jr || typeof syncRoleBoxes !== 'function') return;       // 役職の欄が無い古い HTML
    var have = String(jr.value || '').split(',').filter(Boolean);
    want.forEach(function (c) { if (have.indexOf(c) < 0) have.push(c); });
    setField('f-jobrole', have.join(','));
    syncRoleBoxes();                                              // 節（s3-instr / s3-exam）が出る
    want.forEach(function (c) {
      var p = c === 'instructor' ? 'instr' : 'exam';
      /* 「別途支給されている」＝金額の欄が出る。これを先に入れないと下が空振りする。 */
      setField('f-' + p + '-extra', 'separate');
      if (roleLabel[c]) setField('f-' + p + '-label', roleLabel[c]);
      var det = document.getElementById(p + '-detail');
      if (det) det.open = true;
    });
  }

  function apply(res) {
    /* ★落とし直した人のために、毎回作り直す（前の明細の分を引きずらない）。
       ★順番が要る。filled を作り直す**前**に、前回書いた欄を空にする。 */
    clearPrevFilled();
    if (typeof window.PVPayDropPrevMonth === 'function') {
      try { window.PVPayDropPrevMonth(); } catch (e) {}
    }
    /* ★「前回の内容」が残した先月の額も、ここで落とす（2026-09-11）。
       上の clearPrevFilled() が消すのは**前の明細**が書いた欄だけで、
       明細を落とす前から画面に入っていた先月の額はそのまま残る。
       明細に載っている手当は下で上書きされるが、明細に載っていない手当
       ── 先月あって今月は出ていない保証給や日当 ── は誰も上書きしない。
       総支給だけ明細の額に入れ替わるので、内訳の合計が総支給を超える。
       超えた行に REAL PAY は支給構成の帯を出さない（本番で実際に１件・
       内訳が総支給の 2.2 倍になり、その人の帯だけが出ていなかった）。
       ★消すのは「戻ったまま本人が一度も触っていない欄」だけ。判定は
         pay-report.html 側の１か所（PVPayDropPrevMonth）に置いてある。
       ★先に呼ぶ。あとで呼ぶと、いま明細が入れた値まで消える。 */
    filled = new Set();
    cfRows = [];                 // ★落とし直したら食い違いの控えも作り直す
    lastHours = {};
    (res.hours || []).forEach(function (h) { lastHours[h.kind] = h.value; });

    // 手当を欄ごとに足し合わせる（同じ欄に行く行が複数あることがある）
    var sums = {}, trace = [], notional = [], counts = [], absence = [];
    var roleLabel = {};        // 教官・審査の「明細上の名称」（最初に読めた1つだけ）
    var varSeed = [];          // 変動給。欄ではなく「行」に載せる（下で pdAdd する）
    var othSeed = [];          // その他の現金手当・未分類。同じく「行」に載せる（2026-09-12）
    var rowsOK = canRows('var');
    var othOK = canRows('oth');
    (res.earnings || []).forEach(function (e2) {
      /* 相殺項目（航空券課税など）。控除欄に同額が立つので手取りは1円も動かない。
         収入に足すと時給が水増しになるので分子から外す。ただし黙って消さず、
         「読めたが数えていない」と画面に出す（unmapped に落として本人に聞くのも違う。
          何の項目かは分かっていて、数えないと決めているだけなので）。 */
      if (e2.kind === 'notional') { notional.push(e2); return; }
      /* ★不就労減額・欠勤控除（2026-09-12・指摘2）。**マイナスの行**なので、
         金額の欄にも「その他の現金手当」の行にも入れない。
         ★捨てているのではない ── 項目名・符号・金額をそのまま res._absence に
           持ち、画面（読み取り結果）と確認画面に1行ずつ出し、
           pay_items.absence[] として保存する。
         ★どの金額の列にも足さない。明細に印字された総支給は**すでに減額後**で、
           年収も支給構成もその総支給から出しているため、ここで引くと二重になる。 */
      if (e2.kind === 'absence') { absence.push(e2); return; }
      /* ★役割ごとの手当（教官・審査）。専用の列があるので、その他手当にも
         職位手当にも1円も足し込まない。受け皿は下の openRoles() が作る。 */
      var rid = ROLE_FIELD[e2.kind];
      if (rid) {
        sums[rid] = (sums[rid] || 0) + e2.amount;
        if (!roleLabel[e2.kind]) roleLabel[e2.kind] = e2.label;
        trace.push({ label: e2.label, field: rid, amount: e2.amount, kind: e2.kind });
        return;
      }
      var id = KIND_FIELD[e2.kind];
      if (!id) { (res.unmapped = res.unmapped || []).push({ label: e2.label, amount: e2.amount }); return; }
      /* ★変動給は欄ではなく「行」に載せる（2026-08-27）。手で打った人と同じ入れ物に
         入れないと、種類（basis）も明細上の名称も残らず、明細を落とした人のほうが
         内訳が薄くなる。DEEP PAY はその内訳のために作っている。
         ★行に載せたら f-flightvar は書かない（sumKind が row 付きを外す）。
           f-var-sum が flight_variable_pay と other_allowance に1回ずつ入るので、
           前の「二重書き」とまったく同じ金額になる。 */
      if (e2.kind === 'flight_variable' && rowsOK) {
        var tv = { label: e2.label, field: 'pd-var', amount: e2.amount, kind: e2.kind,
                   basis: e2.basis || 'unknown' };
        varSeed.push(tv); trace.push(tv);
        return;
      }
      /* ★その他の現金手当も「行」に載せる（2026-09-12・指摘3）。
         隠し欄 f-other に合算すると、金額は other_allowance に届くのに
         **項目名がどこにも残らない**（診断用の控えの中だけ）。本人の画面にも
         確認画面にも出ないので、読み違えていても気づけず直せない。
         ★absence（不就労減額）はここへ回さない ── **マイナスの行**なので、
           「その他の現金手当」に負の金額を並べると読めないうえ、合計の検算も壊れる。
         ★notional（現物給付）は上で既に外してある（収入に数えていない）。 */
      if (e2.kind === 'other' && othOK) {
        var to = { label: e2.label, field: 'pd-oth', amount: e2.amount, kind: e2.kind };
        othSeed.push(to); trace.push(to);
        return;
      }
      sums[id] = (sums[id] || 0) + e2.amount;
      /* kind も持たせる。flight_variable は f-other に他の手当と混ざって入るので、
         欄では分けられない。専用列(flight_variable_pay)は kind で拾う。 */
      trace.push({ label: e2.label, field: id, amount: e2.amount, kind: e2.kind });
    });

    /* ── 分類できなかった行も「未分類の支給」として数える（2026-08-14）──────
       前は unmapped の行をどの欄にも入れず、画面に「これはどれですか？」と出して
       本人に宿題を出していた。海外の変動給は会社ごとに名前が違う
       （Flight Productivity Pay / Sector Pay / FDP Allowance …）ので、
       語彙に無い名前は必ず出る。＝明細を落とした人ほど年収が低く出て、
       赤い警告まで付くという、いちばん逆さまなことが起きていた。

       ★分からないことは隠さない。欄には入れるが、内訳の行き先には
         「その他手当（未分類）」と出し、下で軽く1問だけ聞く。
       ★kind は 'unclassified'。これはこちら側で付ける印で、モデルに返させる
         EARNING_KINDS には足さない（足すとプロンプト・正解表・テストが全部動く）。
       ★金額でない行（乗務日数など）はここで外す。足すと年収に 14 が乗る。 */
    (res.unmapped || []).forEach(function (u) {
      if (!u || !u.label) return;
      var amt = (typeof u.amount === 'number' && isFinite(u.amount)) ? u.amount : 0;
      if (!amt || u.count || isCountRow(u.label, amt)) { counts.push(u); return; }
      /* ★前の人たちが同じラベルに答えていたら、その分類で確定する（2026-08-14）。
         画面には何も出さない＝読み取れた行と同じように静かに欄へ入る。
         入る先は緑枠の入力欄なので、違っていれば本人がその場で直せる。
         asked は null のまま（辞書が入れた行を票にしない）。行き先は hint に残す。 */
      var c = HINTS ? UNC_BY_ASKED[HINTS[normLabel(u.label)]] : null;
      if (c) {
        sums[c.field] = (sums[c.field] || 0) + amt;
        trace.push({ label: u.label, field: c.field, amount: amt, kind: c.kind,
                     unc: true, asked: null, hint: c.asked });
        return;
      }
      /* ★分類できなかった行も「行」に載せる（2026-09-12・指摘3）。名前が分からない
         行こそ、項目名を残さないと二度と正体が分からない。6択はこれまでどおり出る
         （答えると下の answerUnc が行き先を移す）。 */
      if (othOK) {
        var tu = { label: u.label, field: 'pd-oth', amount: amt, kind: 'unclassified',
                   unc: true, asked: null };
        othSeed.push(tu); trace.push(tu);
        return;
      }
      sums['f-other'] = (sums['f-other'] || 0) + amt;
      trace.push({ label: u.label, field: 'f-other', amount: amt, kind: 'unclassified', unc: true, asked: null });
    });

    res._notional = notional;
    res._counts = counts;
    /* ★不就労減額を隠し欄に持たせて、そのまま送信・保存まで運ぶ（2026-09-12・指摘2）。
       ★JSON をそのまま入れる（f-absence は素の hidden なので、桁区切りの解釈に
         触られない）。空なら空文字＝列にも何も入らない。
       ★f-absence は CARRY.never と PAYSLIP_MONTH_IDS の両方に入っている
         ＝翌月へ持ち越さないし、明細を落とし直せば必ず作り直される。 */
    res._absence = absence;
    var absEl = document.getElementById('f-absence');
    if (absEl) {
      absEl.value = absence.length ? JSON.stringify(absence.map(function (a) {
        return { label: a.label || null, amount: -Math.abs(Math.round(a.amount || 0)) };
      })) : '';
      mark('f-absence');
    }

    /* ★45通貨の外（NGN / PKR / RUB …）は setField が false を返して**黙って終わる**。
       通貨欄が空のまま、画面にも診断にも何も残らない ── どの通貨が足りないのかが
       オーナーに永久に届かない。印を置いて renderResult に1行出させ、GA4 にも送る。
       ★金額はそのまま残す。通貨が選べないことと、数字が読めたことは別。 */
    if (res.currency) {
      res._curMissed = setField('f-currency', res.currency) ? '' : String(res.currency);
      if (res._curMissed) track('payslip_currency_missing', { code: res._curMissed });
    }
    /* ★総支給を必ず入れる（2026-08-26）。この日から f-gross は明細から来た人にも
       必須になった。前は「内訳を開いた人には合計を映す」作りだったので、明細から
       来た人の欄は空のままでよかったが、いまは書き戻しが無いので誰も埋めない。
       ★入れるのは明細に**印字されている総支給**であって、読めた手当の合計ではない
         （読めなかった行があるとき、合計は総支給より小さい。小さいほうを総支給として
          送ると年収がそのぶん低く出る）。印字が読めなかったときだけ空のまま
          ＝本人が入れる（必須なので送信前に必ず気づく）。 */
    if (typeof res.gross_total === 'number' && res.gross_total > 0) {
      setField('f-gross', String(Math.round(res.gross_total)));
    }
    if (res.period) { setField('f-year', String(res.period.year)); setField('f-month', String(res.period.month)); }
    if (lastHours.block) setField('f-block', String(lastHours.block));

    /* ★内訳が読めたら「給与の内訳を追加」を開く（2026-08-12）。畳んだままだと、
       いま入れた基本給や手当が入っていることに本人が気づけない。
       ★2026-08-26 から、開いても総支給の欄は何も変わらない（読み取り専用にしない・
         合計で書き換えない・閉じても消さない）。総支給と内訳は排他ではなくなった。
       ★保証時間（f-guar）は §2 に残っている欄で、2026-08-27 から writeExtras() が
         setField で入れる（それまでは語彙に無くて黙って捨てていた）。
         annualTotal() の Math.max(f-block, f-guar) はそのまま効く。 */
    if (Object.keys(sums).length) {
      var det = document.getElementById('pay-detail');
      if (det) det.open = true;
    }

    if (sums['f-housing-amt'] > 0) setField('f-housing', 'allowance');
    /* ★先に受け皿を作る。教官・審査の金額欄は「別途支給されている」を選ぶまで
       画面に無いので、順番を逆にすると setField が空振りする。 */
    openRoles(sums, roleLabel);
    Object.keys(sums).forEach(function (id) {
      if (typeof openOpt === 'function') openOpt(id, true);       // チップの奥にある欄を開けてから入れる
      setField(id, String(Math.round(sums[id])));
    });
    /* 6択に答えると行き先が変わる。そのとき「前は書いたが今は空にすべき欄」を
       知っている必要がある（pushTrace を参照）。 */
    lastFields = Object.keys(sums);
    /* ★行に回したぶんを f-other に残さない（2026-09-12・指摘3）。
       f-other は type="hidden" ＝ payslip.js しか書かない欄。明細を落とし直して、
       前の明細では欄へ入っていた手当が今回は行に載った場合、前の合計が残ったままだと
       f-oth-sum と**二重に**足される（画面は普通に動いたまま年収だけ増える）。 */
    if (othOK && sums['f-other'] === undefined) {
      var eo = document.getElementById('f-other');
      if (eo && eo.value !== '') { eo.value = ''; }
    }

    seedRows('var', varSeed);
    seedRows('oth', othSeed);

    writeExtras(res, trace);

    /* ★入口で「明細から自動入力」を選んだ人は、まだフォームが出ていない
       （ステップ 1/2）。読めたのでここで出す＝ステップ 2/2。
       関数が無い＝入口の2択を持たない古い HTML でも落ちないようにする。 */
    if (typeof window.PVEnterMode === 'function') window.PVEnterMode('manual');

    if (typeof updateSteps === 'function') updateSteps(true);
    if (typeof recalc === 'function') recalc();
    /* ★代入で入れた値では change が出ない＝「超えています」の判定が走らない
       （2026-09-15 に判定を change へ移した）。読み取りの直後だけ手で呼ぶ。 */
    if (typeof settleOver === 'function') settleOver();

    if (sumKind(trace, 'per_diem') > 0) writeField('f-perdiem-src', 'included');
    /* ★明細にパーディアムの行が無ければ、あとで入れる額は明細の総支給の外（2026-11-05）。
       既定を「含まれている」のままにすると、入れた瞬間に「内訳の合計が総支給を超えています」で止まる
       （オーナーが本番で踏んだ）。選択はそのまま出るので、本人が「含まれている」へ直せる。 */
    syncPdSrc(trace);
    bonusMsg = failNote();
    syncBonus(trace);                   // ★2026-11-11 この明細のボーナスで年間の欄を埋める（空のときだけ）
    renderResult(res, trace);
    renderRate();
    /* ★段を「明細にない項目 → 確認」の2つに組み替え、まだ答えていない欄だけを出す（2026-11-05 オーナー指示）。
       関数が無い＝古い HTML・共有 JS が落ちた1枚もの ── そのときは今までどおり。 */
    if (typeof window.PVPayQuick === 'function') { try { window.PVPayQuick(); } catch (e) {} }
  }

  /* ── 欄が無い値を隠しフィールドへ ─────────────────────────────
     控除合計・差引支給額・年初来累計・勤務時間は、明細からは読めるのに
     フォームに欄が無い。列も submit_pay_report も前からあるのに送っていなかった
     ので一度も保存されていなかった（＝Duty Hour単価と手取りが出せない原因）。

     ★setField / writeField は使わない。あれは input を撒いて renderRate() と
       renderAha() を毎回走らせるが、この7つは annualTotal() の材料ではないので
       再計算が要らない（7回書けば7回描き直すことになる）。
     ★原本通貨のまま入れる。fx はサーバと calc() が掛けるので、ここで換算すると二重換算。 */
  function writeHidden(id, v) {
    var e2 = document.getElementById(id);
    if (!e2) return;                                  // 隠し欄の無い古いHTMLでも落ちない
    e2.value = (v === null || v === undefined) ? '' : String(v);
    mark(id);                                         // ★緑枠は付かないが、守る対象ではある
  }

  /* DB の CHECK に触れる値は送らない。制約違反はその列だけ落ちるのではなく
     insert ごと失敗するので、1つの誤読で明細1枚が丸ごと無駄になる。 */
  function okAmount(v) {                              // check: null or >= 0
    return (typeof v === 'number' && isFinite(v) && v >= 0) ? Math.round(v) : null;
  }
  function okHours(v) {                               // check: null or between 0 and 400
    return (typeof v === 'number' && isFinite(v) && v > 0 && v <= 400) ? v : null;
  }

  /* 欄ではなく kind で合計する。「変動付加乗務手当」も「深夜割増」も同じ
     f-other に入るが、専用列に入れてよいのは flight_variable だけ。 */
  function sumKind(rows, kind) {
    var t = 0, seen = false;
    (rows || []).forEach(function (r) {
      /* ★行（tpl-pd-var）に載った分は数えない。あちらは f-var-sum が持っていて、
         f-var-sum は flight_variable_pay と other_allowance の両方に足される。
         ここでも数えると変動給だけが二重になる（二重計上の境目はこの1行）。 */
      if (r && r.kind === kind && !r.row) { t += (r.amount || 0); seen = true; }
    });
    return seen ? t : null;
  }

  /* ── 内訳をそのまま溜める（画面には出さない）───────────────────
     読めているのに、送信の直前で捨てていた。フォームには「その他手当」しか
     欄が無いので、深夜割増がいくらだったか・変動付加乗務手当がいくらだったかは
     合算された時点で消える。ページを閉じれば trace も消える。
     ★一度取り損ねた内訳は、あとから遡って集められない。

     ★kind は増やさない。深夜手当の欄も作らない（方針判断 2026-08-14）。
       ラベルと金額をそのまま残せば、あとで欄を分けたくなった日に、
       過去の投稿ぶんも遡って埋まる。いま分類を触ると、プロンプト・KIND_FIELD・
       正解表12枚・費用ゼロのテストが全部連動して動く。残すだけなら何も壊れない。

     ★控除の内訳は入れない。組合費＝どの組合に属しているかは極めて機微で、
       そもそもモデルに返させていない（プロンプトで禁止・test-payslip-parse が見張る）。
     ★notional（航空券課税など）も入れる。収入には数えない行だが、
       「読めたが数えなかった」ことごと残すのが目的なので、kind を付けて残す。
     ★項目名の検品はサーバ側 sanitize() の lbl() が済ませている
       （5桁以上続く数字は伏せる／40字で切る）。ここで二重にやらない。 */
  function detailJson(res, rows) {
    var d = { v: 1, earnings: [], unmapped: [], hours: [] };
    (rows || []).forEach(function (t) {
      if (!t || !t.label) return;
      /* ★分類できなかった行は unmapped 側に出す（金額は数えているが、分類は
         こちらが付けたものではない）。本人が6択に答えていたら asked に残す。
         ★これが語彙の正解データになる。「Sector Pay を人間は飛行手当だと言った」が
           実データで溜まれば、プロンプトの語彙を推測でなく実績で足せる。 */
      if (t.unc) {
        var row = { label: t.label, amount: Math.round(t.amount || 0), asked: t.asked || null };
        /* ★辞書が入れた行は asked ではなく hint に残す（2026-08-14）。
           混ぜると、3人の答えが100人ぶん自動適用されて「103人が確認済み」に化け、
           最初の3人の間違いが100人の同意に見える。集計ビューは asked しか数えない。
           ★あるときだけ足す（payslip_detail は 8000 字で切られる）。 */
        if (t.hint) row.hint = t.hint;
        d.unmapped.push(row);
        return;
      }
      d.earnings.push({ label: t.label, amount: Math.round(t.amount || 0), kind: t.kind || '' });
    });
    (res._notional || []).forEach(function (e2) {
      if (!e2 || !e2.label) return;
      d.earnings.push({ label: e2.label, amount: Math.round(e2.amount || 0), kind: 'notional' });
    });
    // 金額として数えなかった行（乗務日数など）。読めたことごと残す。
    (res._counts || []).forEach(function (u) {
      if (!u || !u.label) return;
      d.unmapped.push({ label: u.label, amount: Math.round(u.amount || 0), asked: null });
    });
    (res.hours || []).forEach(function (h) {
      if (!h || !h.kind) return;
      d.hours.push({ label: h.label || h.kind, value: h.value, kind: h.kind });
    });
    if (typeof res.gross_total === 'number') d.gross_printed = Math.round(res.gross_total);
    /* 検算の結果ごと残す。これがあると、合成明細では原理的に出せない
       「本物の明細での、黙って外した率」が初めて測れる。 */
    if (res.checks) d.checks = res.checks;
    if (res.currency) d.currency = res.currency;
    if (!d.earnings.length && !d.unmapped.length && !d.hours.length) return '';
    var s = JSON.stringify(d);
    /* RPC 側も 8KB で切るが、そこで落とすと明細1枚が丸ごと無駄になる。
       手前で諦めて、内訳だけを空にする（年収の値は普通に送られる）。 */
    return s.length > 8000 ? '' : s;
  }

  function writeExtras(res, rows) {
    /* ★手取りと勤務時間は 2026-08-13 に画面へ出た（手取りは必須）。表に出た欄は
       setField で入れる＝「AIが入れた」印が付き、人が触ったら外れる。
       writeHidden のままにすると、値は入っているのに段階表示が進まない
       （＝入力済みなのに §4 が出てこない）。 */
    var np = okAmount(res.net_pay);
    if (np != null) setField('f-netpay', np); else writeHidden('f-netpay', null);
    var dh = okHours(lastHours.duty);
    if (dh != null) setField('f-duty-h', dh); else writeHidden('f-duty-h', null);
    /* ★保証フライトタイム（2026-08-27）。§2 の表に出ている欄なので writeHidden ではなく
       setField ＝「AIが入れた」印が付き、段階表示も進む。
       ⚠️ 語彙に無かったころ、時間の行は unmapped にも落ちず黙って捨てられていた。
          米国の明細は前から GUARANTEE 73.00 を印字していて、それが消えていた。
       ★annualTotal() の Math.max(f-block, f-guar) はそのまま効く。時給の分母が
         「飛んだ時間」から「保証時間」に上がるのは意図どおり（下限までは払われている）。 */
    var gh = okHours(lastHours.guarantee);
    if (gh != null) setField('f-guar', gh); else writeHidden('f-guar', null);
    writeHidden('f-ytd',      okAmount(res.ytd_taxable));
    writeHidden('f-deduct',   okAmount(res.deductions_total));
    writeHidden('f-night-h',  okHours(lastHours.night));
    writeHidden('f-credit-h', okHours(lastHours.credit));
    writeHidden('f-source',   'payslip');
    /* ★flight_variable の額は、必ずどちらか片方の道を通る（2026-08-27）：
         行に載った  → f-var-sum（flight_variable_pay と other_allowance の両方に1回ずつ）
         載らなかった → f-flightvar ＋ f-other（今までどおりの二重書き）
       どちらでも金額はまったく同じ。両方に書くと変動給だけが二重になるので、
       sumKind() が row 付きの行を外している。
       ★「f-other から抜けばいい」ではない。支給構成の donut は flight_variable_pay を
         other_allowance の部分集合として扱い、pv_annual_total() は other_allowance しか
         足していない。抜くと年収が丸ごと下がるうえ、annualTotal() と pv_annual_total() が
         対称に下がるので test-form-contract では検出できない。 */
    writeHidden('f-flightvar', okAmount(sumKind(rows, 'flight_variable')));
    writeHidden('f-psdetail', detailJson(res, rows));
  }

  /* 表で直した金額を反映するために、読み取り結果を持っておく。
     同じ欄に行く行が複数ある（変動付加乗務手当・深夜割増・乗務回数手当→その他手当）ので、
     1行直したら、その欄に行く全部を足し直す。 */
  var lastTrace = [];
  var lastRes = null;                                 // 内訳を作り直すのに要る（pushTrace）
  var lastFields = [];                                // 前回 trace から書いた欄（行き先が変わったとき空にする）
  var askSkipped = false;                             // 「スキップ」を押したら、その明細ではもう聞かない

  /* 明細の通貨のまま書く額の頭（確認の画面と同じ決まり：円・ドル・ユーロ・ポンドは記号、ほかは略号＋空白）。 */
  function origPre(code) {
    /* スペイン語のページはドルを必ず US$（中南米で「$」はペソ。currency.js の SYM_ES と同じ・2026-11-06） */
    var S = window.PV_LANG === 'es' ? { JPY: '¥', USD: 'US$ ', EUR: '€ ', GBP: '£ ' } : { JPY: '¥', USD: '$', EUR: '€', GBP: '£' };
    code = String(code || '');
    return S[code] || (code ? esc2(code) + ' ' : '');
  }
  /* 欄に書く整数を、フォームと同じ桁区切りで（113398 → 113,398・2026-11-07）。
     区切るのは 0 以上の整数だけ。負の数と、grp を持たない古い HTML ではそのまま。 */
  function grpInt(n) {
    var r = Math.round(n || 0);
    return (r >= 0 && typeof window.grp === 'function') ? window.grp(String(r)) : String(r);
  }
  function writeField(id, v) {
    var e2 = document.getElementById(id);
    if (!e2) return;
    e2.value = String(v);
    e2.classList.remove('ai-filled');        // 人が触った欄は「AIが入れた」印を外す
    e2.dispatchEvent(new Event('input', { bubbles: true }));
    e2.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function pushTrace() {
    var sums = {}, touchedRow = false;
    lastTrace.forEach(function (t) {
      /* ★行に載った変動給は欄ではなく行そのものへ書き戻す。
         ここを忘れると、表で直した額が行に反映されず、送られるのは古い額のままになる。 */
      if (t.row) {
        var a = t.row.querySelector('.pd-amt');
        if (a) { a.value = grpInt(t.amount); a.classList.remove('ai-filled'); }
        touchedRow = true;
        return;
      }
      if (t.field) sums[t.field] = (sums[t.field] || 0) + (t.amount || 0);
    });
    /* ★6択に答えると行き先が変わる（未分類 → 賞与など）。移った先だけを書いて
       元の欄をそのままにすると、同じ金額が2つの欄に立って二重に数えられる。
       前回書いた欄で今回いなくなったものは、必ず空にする。 */
    var ids = {}, prev = lastFields;
    prev.forEach(function (id) { ids[id] = 1; });
    Object.keys(sums).forEach(function (id) { ids[id] = 1; });
    Object.keys(ids).forEach(function (id) {
      if (sums[id] == null) { writeField(id, ''); return; }
      if (prev.indexOf(id) < 0 && typeof openOpt === 'function') openOpt(id, true);  // 初めて使う欄はチップの奥にある
      writeField(id, Math.round(sums[id]));
    });
    lastFields = Object.keys(sums);
    /* ★6択で「パーディアム」と答えた行も明細の上の行 ＝ 総支給の中。行き先が変わったら受け取り方も合わせる。 */
    syncPdSrc(lastTrace);
    /* 表で金額を直したら専用列も追随させる。直せるのは金額だけで行き先(field)は
       変わらないので、kind で拾えば その他手当と混ざっていても正しく分かれる。 */
    writeHidden('f-flightvar', okAmount(sumKind(lastTrace, 'flight_variable')));
    /* ★本人が表で金額を直したら、溜める内訳も直った側にする。
       ここを忘れると、フォームの合計は本人の訂正・DB の内訳は読み取り直後、
       という食い違った2つが同じ行に入る。 */
    writeHidden('f-psdetail', detailJson(lastRes || {}, lastTrace));
    /* 行を直したら f-var-sum と f-payitems を組み直す（中で recalc も走る）。 */
    if (touchedRow && typeof pdSync === 'function') pdSync();
    if (typeof recalc === 'function') recalc();
    /* ★代入で入れた値では change が出ない＝「超えています」の判定が走らない
       （2026-09-15 に判定を change へ移した）。読み取りの直後だけ手で呼ぶ。 */
    if (typeof settleOver === 'function') settleOver();
    syncBonus(); paintParts();          // ★表で金額を直した・6択で「ボーナス」と答えた → 年間の欄と「この明細のボーナス」の行も直す
    renderRate();
  }

  /* 明細のラベルに「78:12」のような時分表記が混じっていることがある
     （Flying Pay (78:12 @ 210.00) など）。乗務時間が読めなかったときの
     候補として拾う。★勝手に入れない。入力欄に置いて本人に確かめてもらう。 */
  function guessBlock(res) {
    var all = (res.earnings || []).concat(res.unmapped || []);
    for (var i = 0; i < all.length; i++) {
      var m = String(all[i].label || '').match(/(\d{1,3}):([0-5]\d)/);
      if (m) {
        var v = parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
        if (v >= 10 && v <= 150) return Math.round(v * 10) / 10;   // 月間の乗務時間として妥当な範囲だけ
      }
    }
    return 0;
  }

  /* パーディアムの受け取り方の既定（2026-11-05）。明細にパーディアムの行がある ＝ 総支給の中（included）。
     無い ＝ あとで入れる額は明細の外（outside）。既定は data-def に置き、pdSrcShow()（pay-report.html）が読む。
     ★本人が額を入れたあとの選択は、行が無い側では書き換えない（本人が「含まれている」に直したかもしれない）。 */
  function syncPdSrc(trace) {
    var sel = document.getElementById('f-perdiem-src');
    if (!sel || !trace) return;
    var line = sumKind(trace, 'per_diem') > 0;
    sel.dataset.def = line ? 'included' : 'outside';
    if (line) { if (sel.value !== 'included') writeField('f-perdiem-src', 'included'); }
    else if (!(typeof num === 'function' && num('f-perdiem') > 0)) sel.value = 'outside';
  }


  /* ── 食い違いの一覧（2026-09-12 オーナー決定6）───────────────────
     ★出すのは「本人が打った値があって、明細の値と違った」欄だけ。
       setField が上書きを見送った所と1対1（一覧を2つ持たない）。
     ★押されたときだけ明細の値を入れる。押した欄は「本人が入力」のまま
       （.ai-filled を付けない ── 本人が選んだ結果なので）。 */
  function conflictCard() {
    if (!cfRows.length) return null;
    var c = el('div', 'ps-cf');
    c.appendChild(el('div', 'ps-cf-t', esc2(T.cfTitle)));
    c.appendChild(el('p', 'ps-cf-lead', T.cfLead));
    cfRows.forEach(function (r) {
      var row = el('div', 'ps-cf-row');
      row.appendChild(el('span', 'ps-cf-n', esc2(lbl(r.id))));
      row.appendChild(el('span', 'ps-cf-v',
        esc2(T.cfMine) + ' <b>' + esc2(r.mine) + '</b> ／ ' +
        esc2(T.cfSlip) + ' <b>' + esc2(r.slip) + '</b>'));
      var b = el('button', 'ps-cf-b', esc2(T.cfUse));
      b.type = 'button';
      b.addEventListener('click', function () {
        var e2 = document.getElementById(r.id);
        if (!e2) return;
        e2.value = r.slip;
        e2.dispatchEvent(new Event('input', { bubbles: true }));
        e2.dispatchEvent(new Event('change', { bubbles: true }));
        row.remove();
        if (!c.querySelector('.ps-cf-row')) c.remove();
      });
      row.appendChild(b);
      c.appendChild(row);
    });
    return c;
  }

  /* ── 読めなかった固定額の候補（2026-09-12 オーナー決定6）──────────
     ★前回の額は**入れない**。押されたときだけ入る。
     ★いま空の欄だけを出す（明細が読めた欄・本人が打った欄は候補にしない）。 */
  function candidateCard() {
    var src = (typeof window.PVPayCarriedDropped === 'function')
      ? window.PVPayCarriedDropped() : null;
    if (!src) return null;
    var ids = Object.keys(src).filter(function (id) {
      var e2 = document.getElementById(id);
      return e2 && String(e2.value || '').trim() === '' && String(src[id] || '').trim() !== '';
    });
    if (!ids.length) return null;
    var c = el('div', 'ps-cd');
    c.appendChild(el('div', 'ps-cd-t', esc2(T.cdTitle)));
    c.appendChild(el('p', 'ps-cd-lead', T.cdLead));
    ids.forEach(function (id) {
      var row = el('div', 'ps-cd-row');
      row.appendChild(el('span', 'ps-cd-n', esc2(lbl(id))));
      var b = el('button', 'ps-cd-b', T.cdUse(esc2(src[id])));
      b.type = 'button';
      b.addEventListener('click', function () {
        var e2 = document.getElementById(id);
        if (!e2) return;
        if (typeof openOpt === 'function') openOpt(id, true);
        e2.value = src[id];
        e2.dispatchEvent(new Event('input', { bubbles: true }));
        e2.dispatchEvent(new Event('change', { bubbles: true }));
        row.remove();
        if (!c.querySelector('.ps-cd-row')) c.remove();
      });
      row.appendChild(b);
      c.appendChild(row);
    });
    return c;
  }

  function renderResult(res, trace) {
    lastTrace = trace;
    lastRes = res;
    askSkipped = false;                 // 明細を落とし直したら、また聞いてよい
    clearPanel();
    /* ★通貨は「明細に書いてあった通貨」をそのまま出す。ここで換算しない。
       換算した数字を明細の隣に並べると、どちらが実額か分からなくなる。 */
    var cur = origPre(res.currency);
    /* pv-no-cur ＝ 自動の換算から外す（中の額は自分で整えている：年間ペース・時給はヘッダーの通貨、内訳の表は明細の通貨のまま） */
    var box = el('div', 'ps-res pv-no-cur');
    var nIn = trace.length;
    box.appendChild(el('div', 'ps-res-title', esc2(nIn > 0 ? T.resultTitleN(nIn) : T.resultTitle)));
    box.appendChild(el('p', 'ps-res-lead', T.resultLead));
    /* ★直すとき、自分の明細をその場で見比べられるように（2026-11-04）。別の明細を選び直す道もここに置く。
       ★ページ数の注も残す（PDF の2ページ目以降は読んでいない＝足りない欄があるのはそのせい、と分かるように）。 */
    if (pageNote) box.appendChild(el('p', 'ps-res-lead', esc2(pageNote)));
    if (viewUrl || fileInput) box.appendChild(bar([viewBtn(), chooseBtn()]));
    /* ★検算（サーバ側 reconcile()）が外れていたら、一般論の「自信がありません」ではなく
       どこがいくら合わないかを言う。差額まで出さないと見比べる先が分からず読み飛ばされる。
       ★送信は止めない。本人が直せば済むし、止めると一次データが減る。目立つように言うだけ。
       ★checks が無い（＝関数が古いまま本番に残っている）ときは、今までどおり lowConf に落ちる。 */
    var chk = res.checks || {};
    var chkMsg = [];
    if (chk.gross === 'mismatch' && typeof chk.gross_diff === 'number') {
      chkMsg.push(T.chkGross(cur + nf2.format(Math.abs(chk.gross_diff))));
    }
    if (chk.net === 'mismatch' && typeof chk.net_diff === 'number') {
      chkMsg.push(T.chkNet(cur + nf2.format(Math.abs(chk.net_diff))));
    }
    /* ★通貨・小数点・桁の3つも同じ場所で言う（2026-09-11）。
       say() ではなく chkMsg に積むこと ── say() は panel.innerHTML='' で全消しするので、
       この直後の clearPanel() で消える。ここは本人が数字を見比べる唯一の場所。
       ★chkCur に渡す前に esc2 する（el() が innerHTML で入れるため）。
       ★_curMissed は checks が無くても立つ（画面側で拾った印なので、
         関数が古いまま本番に残っていてもこの1行だけは出る）。 */
    if (res._curMissed) chkMsg.push(T.chkCur(esc2(res._curMissed)));
    if (chk.money === 'assumed') chkMsg.push(T.chkMoney);
    if (chk.scale === 'suspect') chkMsg.push(T.chkScale);
    /* ★控除合計と手取りの取り違え（2026-11-04）。足し算は合ってしまうので、検算Bでは出ない。 */
    if (chk.order === 'suspect') chkMsg.push(T.chkSwap);
    if (chkMsg.length) {
      chkMsg.forEach(function (m) { box.appendChild(el('p', 'ps-warn', m)); });
    } else if (res.confidence === 'low') {
      box.appendChild(el('p', 'ps-warn', esc2(T.lowConf)));
    }

    /* ★「あなたの入力と違う」「読めなかった」の2枚は、畳んだ中に入れない。
       どちらも**本人が押さないと何も起きない**ので、見えない所に置くと
       黙って空のまま・黙って古い数字のまま提出される。 */
    var cf = conflictCard();
    if (cf) box.appendChild(cf);
    var cd = candidateCard();
    if (cd) box.appendChild(cd);
    /* ★時給を表より先に出す。明細を落とした人が見たいのはこれ1つ。
       前は送信ブロックの中（2,800px 下）に入れていたので誰も見なかった。 */
    box.appendChild(rateCard(guessBlock(res)));
    /* 時給の直後に「で、年収はいくらのペースか」を置く。
       n=0（他人の投稿ゼロ）でも公開レンジと突き合わせられるので、初日から成立する。 */
    box.appendChild(ahaCard());
    /* ★明細に載らないお金（2026-11-04 オーナー「賞与やパーディアムが入っていないので年額がかなり減る。簡単に足せるように」）。
       年収の段のすぐ下に、欄を最大3つだけ。#ps-aha の中に置かない（入力のたびに作り直され、打った字が消える）。 */
    box.appendChild(extraCard(trace));

    /* ── ここから下は「畳む」（2026-08-12 方針判断）────────────
       読み取り結果の内訳は、明細1枚で10〜20行になる。全部を開いたまま出すと
       時給と年収ペース（この人が見に来た2つ）が画面の外へ押し出され、
       その下にある送信ボタンまで遠くなる。
       ★捨てるのではなく畳む。直したい人は開けば同じ表がそのまま出る。
       ★読み取りの確からしさが低いときだけ最初から開く。こちらが自信の無い
         数字を畳んで隠すのは、確認してもらう機会を奪うことになる。 */
    var fold = el('details', 'ps-fold');
    if (res.confidence === 'low') fold.open = true;
    var foldBody = el('div', 'ps-fold-b');
    var box0 = box;              // 見出し・時給・年収ペース・注意書きはここまで
    box = foldBody;              // ★以降の appendChild は畳んだ中へ入る

    if (trace.length) {
      var rows = trace.map(function (t, i) {
        /* ★行き先に「（未分類）」を必ず出す。金額は数えているが分類は付いていない、
           という状態をここで隠すと、盛った数字を静かに出したのと同じになる。
           ★本人が6択に答えた行（asked）と、辞書で分類が付いた行（hint）は
             行き先が決まっているので付けない。 */
        return '<tr><td>' + esc2(t.label) + '</td><td class="ps-to" data-to="' + i + '">' +
               esc2(lbl(t.field) + (t.unc && !t.asked && !t.hint ? T.uncTag : '')) +
               '</td><td class="ps-amt"><span class="ps-cur">' + cur.trim() + '</span>' +
               '<input class="ps-amt-in money-live" type="text" inputmode="decimal" data-i="' + i +
               '" value="' + grpInt(t.amount) + '"></td></tr>';
      }).join('');
      var tbl = el('table', 'ps-tbl ps-tbl-edit',
        '<thead><tr><th>' + esc2(T.col1) + '</th><th>' + esc2(T.col2) + '</th><th>' + esc2(T.col3) +
        '</th></tr></thead><tbody>' + rows + '</tbody>');
      tbl.addEventListener('input', function (ev) {
        var t2 = ev.target;
        if (!t2.classList.contains('ps-amt-in')) return;
        var i = Number(t2.getAttribute('data-i'));
        if (!lastTrace[i]) return;
        /* ★2026-09-11。ここは type="number" ＋ Number(...)||0 だった。
           欧州式に 1.234,56 と打ち直した人の行が**黙って 0 になり**、
           明細から読めていた額ごと消えていた（画面は普通に動いたまま）。
           読み方はフォーム本体と同じ1本（readMoney）に寄せる。
           ⚠️ 2通りに読める入力は勝手に決めない。その場で二択を出し、
              選ばれるまで額を書き換えない＝出ている数と使う数がずれない。 */
        /* ⚠️ 通貨を渡す（2026-09-15）。readMoney の答えは通貨の小数桁で変わる
              （円に 1.0 は無いので 1.000 を二択で聞かない）。渡し忘れると、
              この表だけが既定の 2 で読んでフォーム本体と食い違う。 */
        var R = window.readMoney
          ? window.readMoney(t2.value, window.curDec ? window.curDec() : undefined)
          : null;
        if (!R) { lastTrace[i].amount = Number(String(t2.value).replace(/,/g, '')) || 0; pushTrace(); return; }
        if (window.clearMoneyAsk) window.clearMoneyAsk(t2);
        if (R.state === 'empty') { lastTrace[i].amount = 0; pushTrace(); return; }
        if (R.state !== 'ok') { if (window.askMoney) window.askMoney(t2, R); return; }
        lastTrace[i].amount = R.n;
        pushTrace();
      });
      box.appendChild(tbl);
      /* 「金額はこの表で直せます」の1文は置かない（欄そのものが直せる形をしている・2026-11-05） */
    }

    // 読めたが保存先がまだ無いもの＝画面に出すだけ。黙って捨てない。
    var extra = [];
    if (res.deductions_total > 0) extra.push([T.deduct, cur + nf.format(Math.round(res.deductions_total))]);
    if (res.net_pay > 0) extra.push([T.net, cur + nf.format(Math.round(res.net_pay))]);
    ['duty', 'night', 'credit'].forEach(function (k) {
      if (lastHours[k]) extra.push([T[k + 'H'], nf1.format(lastHours[k]) + ' h']);
    });
    if (extra.length) {
      box.appendChild(el('table', 'ps-tbl ps-tbl-dim', '<tbody>' + extra.map(function (p) {
        return '<tr><td colspan="2">' + esc2(p[0]) + '</td><td class="ps-amt">' + esc2(p[1]) + '</td></tr>';
      }).join('') + '</tbody>'));
      box.appendChild(el('p', 'ps-note', T.notStored));
    }

    /* 相殺項目。「読んだけれど、わざと収入に数えていない」ことを必ず言う。
       黙って外すと、支給合計と画面の数字が合わずに「壊れている」と読まれる。 */
    if (res._notional && res._notional.length) {
      box.appendChild(el('table', 'ps-tbl ps-tbl-dim', '<tbody>' + res._notional.map(function (n) {
        return '<tr><td colspan="2">' + esc2(n.label) + esc2(T.notionalTag) +
               '</td><td class="ps-amt">' + cur + nf.format(Math.round(n.amount)) + '</td></tr>';
      }).join('') + '</tbody>'));
      box.appendChild(el('p', 'ps-note', esc2(T.notionalNote)));
    }

    /* ★不就労減額（2026-09-12・指摘2）。黙って消さない。額と符号をそのまま出し、
       「総支給からは既に引かれている」＝こちらで二重には引かない、と言い切る。 */
    if (res._absence && res._absence.length) {
      box.appendChild(el('table', 'ps-tbl ps-tbl-dim', '<tbody>' + res._absence.map(function (a) {
        return '<tr><td colspan="2">' + esc2(a.label) + esc2(T.absenceTag) +
               '</td><td class="ps-amt">−' + cur + nf.format(Math.round(Math.abs(a.amount))) + '</td></tr>';
      }).join('') + '</tbody>'));
      box.appendChild(el('p', 'ps-note', esc2(T.absenceNote)));
    }

    /* 金額として数えなかった行（乗務日数など）。読めたことは出すが、聞かない。
       ★通貨記号は付けない。「乗務日数 JPY 14」と出していた時期がある。
         金額でないものに通貨を付けると、読み手はまず「壊れている」と思う。 */
    if (res._counts && res._counts.length) {
      box.appendChild(el('div', 'ps-res-title ps-sm', esc2(T.unmappedTitle)));
      box.appendChild(el('p', 'ps-note', esc2(T.unmappedLead)));
      box.appendChild(el('table', 'ps-tbl ps-tbl-dim', '<tbody>' + res._counts.map(function (u) {
        return '<tr><td colspan="2">' + esc2(u.label) + '</td><td class="ps-amt">' +
               nf.format(Math.round(u.amount || 0)) + '</td></tr>';
      }).join('') + '</tbody>'));
    }

    /* ── 畳んだ中身をここで閉じる ─────────────────────────────
       中身が1つも無いとき（読めた行がゼロ）は、開いても空の箱が出るだけなので
       たたみ札そのものを出さない。 */
    box = box0;
    if (foldBody.childNodes.length) {
      var n = trace.length;
      fold.appendChild(el('summary', 'ps-fold-s',
        '<span class="ps-fold-t">' + esc2(n ? T.foldTitle.replace('{n}', n) : T.foldTitleNoN) + '</span>' +
        '<span class="ps-fold-i" aria-hidden="true"></span>'));
      fold.appendChild(foldBody);
      box.appendChild(fold);
    }

    /* ★確認カードは畳んだ内訳の「外」に置く。中に入れると既定で閉じているので
         誰の目にも触れない（＝聞いていないのと同じ）。
       ★ここが「レポートの最後」。この下にすぐ「明細にない項目」の1枚が並ぶ。
       ★「あと◯項目で送信できます／入力する →」の札は 2026-11-05 に外した（オーナー「このボタンは何のために存在してるの？」
         ── 押すとすぐ下の欄へ動くだけだった）。 */
    box.appendChild(askWrap);
    renderAsk();

    panel.appendChild(box);
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ── 「1項目だけ確認できます」───────────────────────────────
     分類できなかった行は、もう金額として数えてある（apply を参照）。
     ここで聞くのは、答えると分類が良くなる人のためだけ。

     ★答えなくてもレポートは完成している。だから、聞くのは1件ずつ・
       スキップはいつでも出す・答えなくても金額は動かない。
     ★年収が実際に動くのは「賞与・一時金」と「日当・立替精算」の2つだけ
       （賞与は×12する前に外す・日当は時給の分子から外す）。
       残り4つはその他手当の中で分類名が変わるだけ。 */
  var askWrap = el('div', 'ps-q-w');

  function renderAsk() {
    askWrap.innerHTML = '';
    if (askSkipped) return;
    /* ★辞書で分類が付いた行（hint）は聞かない。同じ質問を100人に繰り返さない、
       というのが辞書の目的そのもの。＝全部当たれば、このカードは出ない。 */
    var pend = [];
    lastTrace.forEach(function (t, i) { if (t.unc && !t.asked && !t.hint) pend.push(i); });
    if (!pend.length) return;

    var i = pend[0], t = lastTrace[i];
    var cur = origPre(lastRes && lastRes.currency);
    var card = el('div', 'ps-q');
    card.innerHTML =
      '<div class="ps-q-h"><span class="ps-q-t">' + esc2(T.askT(pend.length)) + '</span></div>' +
      '<p class="ps-q-l">' + esc2(T.askL) + '</p>' +
      '<div class="ps-q-row"><span class="ps-q-lb">' + esc2(t.label) + '</span>' +
        '<span class="ps-q-am">' + cur + nf.format(Math.round(t.amount || 0)) + '</span></div>' +
      '<p class="ps-q-q">' + esc2(T.askQ) + '</p>' +
      '<div class="chips ps-q-c"></div>';

    var skip = el('button', 'ps-q-skip', esc2(T.askSkip));
    skip.type = 'button';
    skip.addEventListener('click', function () { askSkipped = true; renderAsk(); });
    card.querySelector('.ps-q-h').appendChild(skip);

    var chips = card.querySelector('.ps-q-c');
    UNC_CHOICES.forEach(function (c, ci) {
      var b = el('button', 'chip', esc2(T.askOpts[ci]));
      b.type = 'button';
      b.addEventListener('click', function () { answerUnc(i, c); });
      chips.appendChild(b);
    });

    askWrap.appendChild(card);
  }

  function answerUnc(i, c) {
    var t = lastTrace[i];
    if (!t) return;
    t.asked = c.asked;              // ★本人の答えをそのまま残す＝語彙の正解データ
    t.kind = c.kind;
    /* ★行に載っている未分類に答えたら、答えが「その他」でない限り行から出す
       （2026-09-12）。pushTrace は row 付きの行を**行へ書き戻す**ので、
       出さないまま field だけ変えると、本人の答えが1円も反映されない。
       ★「その他」を選んだときは行のまま ── それがこの行の正体だから。 */
    if (t.row && c.asked !== 'other') {
      var k2 = seededRows.oth.indexOf(t.row);
      if (k2 >= 0) seededRows.oth.splice(k2, 1);
      if (t.row.parentNode) t.row.parentNode.removeChild(t.row);
      t.row = null;
      if (typeof pdSync === 'function') pdSync();
    }
    t.field = t.row ? 'pd-oth' : c.field;
    /* 表の「入れた欄」を書き換える。表は作り直さない（金額を打ちかけの
       入力欄があると、作り直した瞬間にフォーカスと打ちかけの値が飛ぶ）。 */
    var td = panel.querySelector('.ps-to[data-to="' + i + '"]');
    if (td) td.textContent = lbl(t.field);
    pushTrace();                    // 欄・専用列・内訳JSON・年収・時給をまとめて直す
    renderAsk();                    // 次の1件へ（無ければカードごと消える）
  }


  // ════════════════════════════════════════════════════════
  // 時給 ── 商品そのもの
  //   ★煽らない。パーディアムは非課税の実費補填なので既定では分子に入れない。
  //   ★乗務時間あたりと総勤務時間あたりを両方出す。差そのものが発見。
  // ════════════════════════════════════════════════════════
  /* ★パーディアムは時給の分子に入れない（非課税の実費補填）。切り替えは 2026-11-05 に外した（文言を減らす）。 */
  var pdOn = false;

  function monthlyCash() {
    if (typeof annualTotal !== 'function' || typeof num !== 'function') return 0;
    var m = (annualTotal() - num('f-bonus') - num('f-profit')) / 12;
    return pdOn ? m : m - num('f-perdiem');
  }

  /* カードの骨組みは1回だけ作る。数字の部分（#ps-rate-body）だけ描き直す。
     ★全部描き直すと、乗務時間の入力中にフォーカスが飛ぶ。
       #ps-panel は #form-wrap の中にあるので、ここで input を出すと
       フォーム側の再描画ハンドラが必ず走る。 */
  function rateCard(guess) {
    /* pv-no-cur ＝ 自動の換算から外す（下の renderRate が自分で現在の通貨に整える） */
    var card = el('div', 'ps-rate pv-no-cur');
    card.id = 'ps-rate';
    card.innerHTML =
      '<div class="ps-rate-t">' + esc2(T.rate) + '</div>' +
      '<div id="ps-rate-body"></div>' +
      '<div class="ps-ask" id="ps-ask" hidden>' +
        '<div class="ps-ask-t" id="ps-ask-t">' + esc2(T.askBlockT) + '</div>' +
        '<p class="ps-ask-l" id="ps-ask-l">' + esc2(T.askBlockL) + '</p>' +
        /* ★type="number" にしない（2026-09-11）。ブラウザが 85,5 のカンマごと値を
           捨てるので、打った人の飛行時間が空になって消える。ここは打った文字を
           そのまま #f-block へ渡し、読み方は向こうの readNum に1本化する
           （上下限 0〜200 も #f-block の data-min / data-max が持っている）。 */
        '<div class="ps-ask-in"><input type="text" ' +
          'inputmode="decimal" id="ps-ask-block" placeholder="78.5"><span>h</span></div>' +
        '<p class="ps-note" id="ps-ask-f" hidden>' + esc2(T.askBlockF) + '</p>' +
      '</div>' +
      '';

    var ask = card.querySelector('#ps-ask-block');
    ask.addEventListener('input', function () {
      writeField('f-block', ask.value);        // f-block に直接入れる＝送信にも乗る
      renderRate();
    });
    if (guess && typeof num === 'function' && !num('f-block')) {
      ask.value = String(guess);
      card.querySelector('#ps-ask-f').hidden = false;
      writeField('f-block', guess);
    }
    setTimeout(renderRate, 0);                 // DOM に入ってから数字を描く
    return card;
  }

  /* ★「値が入ったら質問を消す」にすると、1文字目の "7" を打った瞬間に箱ごと消えて
       残りの "8.5" が行方不明になる（＝打てない）。
       消してよいのは「この入力欄を使わずに乗務時間が入っているとき」だけ。
       打ち始めたあとは、見出しを質問文から欄名に変えて、そのまま残す。 */
  function syncAsk() {
    var box = document.getElementById('ps-ask');
    if (!box) return;
    var inp = document.getElementById('ps-ask-block');
    var typed = inp && String(inp.value).trim() !== '';
    box.hidden = !typed && !!num('f-block');
    box.classList.toggle('is-filled', !!typed);
    document.getElementById('ps-ask-t').textContent = typed ? T.askBlockOkT : T.askBlockT;
    document.getElementById('ps-ask-l').hidden = !!typed;
  }

  /* ★分母から「不就労時間」を引いてはいけない。
       日本の明細では、勤務時間の欄に不就労時間は最初から入っていない。
       引くと二重に差し引くことになり、分母が小さくなって時給が実際より高く出る。
       分子の側も同じで、支給欄の不就労減額はマイナス行として既に効いている。
       ＝分子も分母も「実際に働いたぶん」で揃っている。触らないこと。 */
  function renderRate() {
    var body = document.getElementById('ps-rate-body');
    if (!body || typeof num !== 'function') return;
    var cur = (document.getElementById('f-currency') || {}).value || '';
    var m = monthlyCash();
    var block = Math.max(num('f-block'), num('f-guar'));
    var duty = lastHours && lastHours.duty ? lastHours.duty : 0;

    syncAsk();

    if (m <= 0 || (!block && !duty)) { body.innerHTML = ''; return; }

    /* ★金額は年間ペースと同じ書き方（ヘッダーで選んだ通貨・サイトの表記 ＝ PVCurrency.fmt・2026-11-05 オーナー
         「なんで JPY と ¥1,404万の数え方があるんだ」）。前は明細の通貨の略号つき（JPY 16,712）で、同じ画面に2通りあった。
       ★切替に無い通貨（換算できない）だけ、明細の通貨のまま略号つきで出す。 */
    var cash = function (jpy) {
      return (window.PVCurrency && typeof window.PVCurrency.fmt === 'function')
        ? window.PVCurrency.fmt(Math.round(jpy)) : '¥' + Math.round(jpy).toLocaleString('en-US');
    };
    var big = function (v, hours, key) {
      if (!hours) return '';
      var per = v / hours;
      var jh = toJpy(per, cur);
      var vH = jh != null ? cash(jh) : cur + ' ' + nf.format(Math.round(per));
      var vM = jh != null ? cash(jh / 60) : nf1.format(per / 60);
      return '<div class="ps-rate-row"><div class="ps-rate-k">' + esc2(T[key]) + '</div>' +
        '<div class="ps-rate-v">' + esc2(vH) +
        '<span class="ps-rate-min">' + esc2(T.perMin) + ' ' + esc2(vM) + '</span></div></div>';
    };

    body.innerHTML =
      big(m, block, 'perBlock') +
      big(m, duty, 'perDuty') +
      '';
  }

  // ════════════════════════════════════════════════════════
  // n=0 のアハ ── 公開レンジと突き合わせる
  //   pay_benchmarks は n≥5 でしか開かないので、公開直後はどのみち空。
  //   だが salary-data.mjs（＝110社 × cap/fo × avg/lo/hi）は今日ある。
  //   他のパイロットの投稿が1件も無くても「で、自分は高いのか安いのか」に答える。
  //
  //   ★言えるのは「会社 × 職位」まで。SSOT に機種別の粒度は無い（grep 0件）ので
  //     「同機材の平均より＋◯%」とは絶対に書かない。ここは越えないこと。
  //   ★煽らない。上振れ方向に丸めない。無税国との比較では
  //     「税引前どうしなので実際の差はもっと大きい」と自分から言う（＝過小に振る）。
  // ════════════════════════════════════════════════════════

  /* salary-data.json は生成物（SSOT = salary-data.mjs）。EN ページからは
     ../ になるので、自分の src を基準に解決する（salary-leveling.js と同じ規約）。 */
  var SAL_URL = 'salary-data.json';
  try {
    var _self = (document.currentScript && document.currentScript.src) || '';
    if (_self) SAL_URL = new URL('salary-data.json', _self).href;
  } catch (e) {}

  var SAL = null, salTried = false;
  function loadSalary() {
    if (SAL || salTried) return;
    salTried = true;                       // 落ちたら黙って諦める。比較は付加価値で、明細の読み取りは独立している
    fetch(SAL_URL).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.airlines) { SAL = j.airlines; renderAha(); } })
      .catch(function () {});
  }

  /* f-position は3択（機長・副操縦士・訓練生）で、SSOT が持つ「書かれた数字」も
     cap と fo の2本。つまり寄せは起きない＝どの帯で見たかを断る必要も無い。
     訓練生だけ寄せ先が無いので比較を出さない＝黙って別の帯の数字を出さない。
     ★ここに sfo / tri_tre を戻すなら、寄せたことを画面に書く注記も一緒に戻す
       （黙って寄せると「SFO の公開レンジ」を見たと誤読される）。 */
  var BAND = { fo: 'fo', cap: 'cap' };
  var BAND_LABEL = { fo: { ja: '副操縦士', en: 'First Officer', es: 'primer oficial' }, cap: { ja: '機長', en: 'Captain', es: 'capitán' } };
  var BAND_L = window.PV_LANG === 'es' ? 'es' : L;   // スペイン語のページは L が 'en'（動きは英語と同じ）。字だけスペイン語

  /* 円 → 表示。サイト全体の通貨切替に載せる（PVCurrency.fmt 経由）。
     カードは pv-no-cur で自動スキャンから外し、pv-currency-change で描き直す
     ＝salary-leveling.js / my-value.js と同じ作り。 */
  /* ★万の単位に丸めてから渡す。PVCurrency.fmt は「1万で割り切れる円」しか
     「¥◯◯万」にしないので、38,188,800 をそのまま渡すと ¥38,188,800 と出て、
     同じカードの中の ¥3,350万 と見た目が揃わない（実測）。
     SSOT 自体が万単位なので、万より下の桁は元から意味を持っていない。 */
  function money(jpy) {
    var v = Math.round(Number(jpy) / 10000) * 10000;
    if (window.PVCurrency && typeof window.PVCurrency.fmt === 'function') return window.PVCurrency.fmt(v);
    return '¥' + (v / 10000).toLocaleString('en-US') + '万';
  }
  /* 明細の原本通貨 → 円。レートは currency.js の RATES（fx-rates.mjs から作られる）。
     ここに出せるのは通貨切替に載せている7通貨だけ。DB の fx_rates は45通貨あるので、
     それ以外の通貨で出した人はこの画面では円に直らないが、保存も集計もされる。
     ここで別のレートを使うと、画面の比較と送信後に保存される換算額が食い違う。 */
  function toJpy(v, cur) {
    var R = (window.PVCurrency && window.PVCurrency.rates) || { JPY: 1 };
    return R.hasOwnProperty(cur) ? v * R[cur] : null;
  }
  /* 明細に載らないお金：ボーナス（年）・プロフィットシェア（年）。
     ★値はフォームの欄へそのまま書く（writeField）＝年収の段・下の合計・時給がその場で動く。
     ★パーディアムはここで聞かない（2026-11-05）。必須の欄なので、すぐ下の「明細にない項目」に必ず出る
       ── 2か所に同じ欄を置かない。明細に行が無ければ、そこで入れた額は「明細とは別に受け取っている」が既定
       （syncPdSrc）＝年収に ×12 で入る。
     ★説明の文は置かない（オーナー「文言は最小限に」）。 */
  /* ── ボーナス・プロフィットシェア（2026-11-11 オーナー「ボーナスとか手入力じゃん？明細アップロードから読み取れるようにして」）──
     ・月の明細に印字された分 ＝ lastTrace の f-bonus-paid の行（表で直した額もここに反映される）。
     ・ボーナスの明細から読んだ分 ＝ slipParts（★季節も回数も決めない。四半期・業績・決算・特別・入社時など何枚でも足す・× で外せる・2026-11-11 オーナー「夏冬だけとは限らない」）。
     ・年間ボーナス／プロフィットシェアの欄は、空か、こちらが前に書いた額のときだけ書き直す（本人の年の額は消さない）。 */
  var slipParts = [];
  var bonusMsg = '';
  var autoVal = { bonus: null, profit: null };
  var EX_ID = { bonus: 'f-bonus', profit: 'f-profit' };
  function monthPart(k, tr) {
    return (tr || lastTrace || []).filter(function (t) {
      return t.field === 'f-bonus-paid' && (k === 'profit' ? t.kind === 'profit' : t.kind !== 'profit');
    }).reduce(function (a, t) { return a + (Number(t.amount) || 0); }, 0);
  }
  function slipPart(k) { return slipParts.filter(function (p) { return p.kind === k; }).reduce(function (a, p) { return a + p.amount; }, 0); }
  function syncBonus(tr) {
    ['bonus', 'profit'].forEach(function (k) {
      var f = document.getElementById(EX_ID[k]);
      if (!f) return;
      var want = Math.round(monthPart(k, tr) + slipPart(k));
      var cur = typeof num === 'function' ? num(EX_ID[k]) : (Number(f.value) || 0);
      var ours = !String(f.value || '').trim() || (autoVal[k] != null && Math.round(cur) === autoVal[k]);
      if (!ours || (!want && autoVal[k] == null)) return;
      writeField(EX_ID[k], want || '');
      autoVal[k] = want || null;
      var ex = document.getElementById('ps-ex-' + k);
      if (ex) ex.value = f.value;
    });
  }
  function isBonusOnly(res) {
    var es = ((res && res.earnings) || []).filter(function (e) { return e && e.kind !== 'notional' && e.kind !== 'absence' && Number(e.amount) > 0; });
    var b = es.filter(function (e) { return e.kind === 'bonus' || e.kind === 'profit'; });
    if (!b.length) return false;
    if (b.length === es.length) return true;
    var bs = b.reduce(function (a, e) { return a + Number(e.amount); }, 0), g = Number(res.gross_total) || 0;
    return g > 0 && bs >= g * 0.9;
  }
  function amtTx(v) {
    var sel = document.getElementById('f-currency'), code = sel ? sel.value : '';
    return grpInt(v) + ((L === 'ja' && code === 'JPY') ? '円' : code ? ' ' + code : '');
  }
  function ymTx(y, m) { return !(y && m) ? '' : L === 'ja' ? y + '年' + m + '月' : m + '/' + y; }
  function applyBonus(res, auto) {
    var es = ((res && res.earnings) || []).filter(function (e) { return e && (e.kind === 'bonus' || e.kind === 'profit') && Number(e.amount) > 0; });
    var pr = (res && res.period) || {};
    es.forEach(function (e) {
      slipParts.push({ kind: e.kind === 'profit' ? 'profit' : 'bonus', amount: Math.abs(Number(e.amount)), y: pr.year || null, m: pr.month || null });
    });
    bonusMsg = !es.length ? T.exNone : (auto && lastRes ? T.wasBonus : '');
    var cur = document.getElementById('f-currency');
    if (cur && !cur.value && res && res.currency) setField('f-currency', res.currency);
    syncBonus();
    if (typeof recalc === 'function') recalc();
    track('payslip_bonus_slip', { n: es.length, auto: auto ? 1 : 0 });
    if (lastRes) renderResult(lastRes, lastTrace);
    else renderBonusOnly(slipPart('bonus') + slipPart('profit'));
  }
  /* 最初の1枚がボーナスの明細だった：月の欄は空のまま、年間ボーナスに入れて「月の給与の明細を読む」へ戻す */
  function renderBonusOnly(total) {
    clearPanel();
    var box = el('div', 'ps-res ps-bo pv-no-cur');
    box.appendChild(el('div', 'ps-res-title', esc2(T.boT)));
    box.appendChild(el('p', 'ps-res-lead', esc2(T.boS.replace('{a}', function () { return amtTx(total); }))));
    box.appendChild(extraCard([]));
    box.appendChild(bar([btn(T.boBtn, 'ps-btn-primary', function () { readMode = 'month'; fileInput.click(); }, 'ps-bo-next')]));
    panel.appendChild(box);
  }
  function partsHTML(k) {
    var out = '', mp = monthPart(k);
    if (mp > 0) out += '<li class="ps-ex-p">' + esc2((k === 'bonus' ? T.exMonthB : T.exMonthP).replace('{a}', function () { return amtTx(mp); })) + '</li>';
    slipParts.forEach(function (p, i) {
      if (p.kind !== k) return;
      out += '<li class="ps-ex-p is-slip"><span>' + esc2(T.exSlip.replace('{t}', function () { return ymTx(p.y, p.m); })) + '</span><b>' + esc2(amtTx(p.amount)) + '</b>' +
        '<button type="button" class="ps-ex-x" data-part="' + i + '" aria-label="' + esc2(T.exRemove) + '">×</button></li>';
    });
    return out ? '<ul class="ps-ex-ps">' + out + '</ul>' : '';
  }
  function paintParts() {
    ['bonus', 'profit'].forEach(function (k) {
      var c = panel.querySelector('.ps-ex-parts[data-k="' + k + '"]');
      if (c) c.innerHTML = partsHTML(k);
    });
    var m = panel.querySelector('.ps-ex-msg');
    if (m) { m.textContent = bonusMsg; m.hidden = !bonusMsg; }
  }
  function extraCard(trace) {
    var card = el('div', 'ps-extra');
    card.appendChild(el('div', 'ps-extra-t', esc2(T.exT)));
    var rows = [['f-bonus', T.exBonus, T.perYear], ['f-profit', T.exProfit, T.perYear]];
    rows.forEach(function (r) {
      var id = r[0];
      var lab = el('label', 'ps-extra-row');
      lab.appendChild(el('span', 'ps-extra-k', esc2(r[1])));
      var v = el('span', 'ps-extra-v');
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.inputMode = 'decimal';
      inp.autocomplete = 'off';
      /* ★money-live ＝ 打っている最中に桁区切りを組み直す（2026-11-07 オーナー「1500000 じゃなくて 1,500,000」）。
         組み直すのは pay-report.html の委譲の1か所（fmtMoneyLive）。ここは印を付けるだけ。
         ⚠️ money は付けない ── 送信の検品と読み方の二択に数えられ、本体の #f-bonus と二重になる。 */
      inp.className = 'ps-extra-in money-live';
      inp.id = 'ps-ex-' + id.slice(2);
      inp.placeholder = '';   // ★「0」を置かない（答えた 0 に見える・2026-11-06）
      var cur0 = document.getElementById(id);
      if (cur0 && cur0.value) inp.value = cur0.value;
      inp.addEventListener('input', function () {
        if (id === 'f-profit' && typeof window.openOpt === 'function') { try { window.openOpt('f-profit', true); } catch (e) {} }
        writeField(id, inp.value);
      });
      /* 離れたら、フォームと同じ桁区切りで見せ直す（2000000 → 2,000,000） */
      inp.addEventListener('blur', function () {
        if (typeof window.fmtMoneyAll === 'function') { try { window.fmtMoneyAll(); } catch (e) {} }
        var f2 = document.getElementById(id);
        if (f2 && f2.value && inp.value) inp.value = f2.value;
      });
      v.appendChild(inp);
      var u = el('span', 'ps-extra-u', '');
      u.setAttribute('data-per', r[2]);
      v.appendChild(u);
      lab.appendChild(v);
      card.appendChild(lab);
      var k = id === 'f-bonus' ? 'bonus' : 'profit';
      var parts = el('div', 'ps-ex-parts', partsHTML(k));
      parts.setAttribute('data-k', k);
      card.appendChild(parts);
      if (k === 'bonus') card.appendChild(bar([btn(T.exRead, 'ps-btn-ghost ps-ex-read', readBonusSlip, 'ps-ex-read')]));
    });
    var msg = el('p', 'ps-ex-msg', esc2(bonusMsg));
    msg.setAttribute('role', 'status');
    msg.hidden = !bonusMsg;
    card.appendChild(msg);
    card.addEventListener('click', function (e) {
      var x = e.target.closest ? e.target.closest('.ps-ex-x') : null;
      if (!x) return;
      slipParts.splice(+x.getAttribute('data-part'), 1);
      bonusMsg = '';
      syncBonus();
      if (typeof recalc === 'function') recalc();
      paintParts();
      if (typeof renderAha === 'function') renderAha();
    });
    /* ★欄の下に、年間ペースをもう1行（2026-11-07 オーナー選択「欄の下に合計をもう1つ」）。
       上の大きな数字はカードの頭にあり、ここで打っているあいだは画面の外にある。
       数字は renderAha() が上の数字と同じ瞬間・同じ値で書く（ここで計算しない＝2つが食い違わない）。 */
    var sum = el('div', 'ps-extra-sum');
    sum.hidden = true;
    sum.appendChild(el('span', 'ps-extra-sk', esc2(T.ahaPace)));
    var sv = el('span', 'ps-extra-sv', '');
    sv.id = 'ps-ex-sum';
    sum.appendChild(sv);
    card.appendChild(sum);
    paintUnits(card);
    var curSel = document.getElementById('f-currency');
    if (curSel && !curSel.__psUnits) {
      curSel.__psUnits = true;
      curSel.addEventListener('change', function () { var c = panel.querySelector('.ps-extra'); if (c) paintUnits(c); });
    }
    return card;
  }
  /* 単位＝通貨＋「/年」「/月」。日本語のページの円だけ「円」と書く（ほかは通貨コード）。 */
  function paintUnits(card) {
    var sel = document.getElementById('f-currency');
    var code = sel ? sel.value : '';
    var c = (L === 'ja' && code === 'JPY') ? '円' : code;
    [].forEach.call(card.querySelectorAll('.ps-extra-u'), function (u) {
      u.textContent = (c ? c + '/' : '') + u.getAttribute('data-per');
    });
  }

  function ahaCard() {
    var card = el('div', 'ps-aha pv-no-cur');
    card.id = 'ps-aha';
    setTimeout(renderAha, 0);
    return card;
  }

  function ahaShell(inner) {
    return '<div class="ps-aha-t">' + esc2(T.ahaT) + '</div>' + inner;
  }
  /* ★withBtn は今どこからも true で呼ばれていない。復活させないこと ―
     同じ文言のボタンが2つ並ぶ形になる（2026-08-12にそれで1つ消した）。 */
  function ahaMsg(msg, withBtn) {
    return ahaShell('<p class="ps-aha-msg">' + esc2(msg) + '</p>' +
      (withBtn ? '<button type="button" class="btn-orange ps-aha-b" id="ps-aha-go">' + esc2(T.ahaPickB) + '</button>' : ''));
  }

  /* 「明細にないお金」の下の年間ペース（#ps-ex-sum）。呼ぶのは renderAha だけ。空なら行ごと隠す。 */
  function paintSum(text) {
    var v = document.getElementById('ps-ex-sum');
    if (!v) return;
    v.textContent = text;
    if (v.parentNode) v.parentNode.hidden = !text;
  }

  function renderAha() {
    var host = document.getElementById('ps-aha');
    if (!host || typeof num !== 'function' || typeof annualTotal !== 'function') return;

    var yrOrig = annualTotal();                       // 原本通貨・年額（ボーナス／PS 込み）
    if (!(yrOrig > 0)) { host.innerHTML = ''; paintSum(''); return; }

    var air = (document.getElementById('f-airline')  || {}).value || '';
    var pos = (document.getElementById('f-position') || {}).value || '';
    var cur = (document.getElementById('f-currency') || {}).value || 'JPY';

    var jpy = toJpy(yrOrig, cur);
    if (jpy === null)     { host.innerHTML = ahaMsg(T.ahaNoFx(cur)); paintSum(''); return; }
    paintSum(money(jpy));

    /* ── ① 年間ペース ──────────────────────────────
       ★これは明細だけで出せる（会社も職位も要らない）。だから何より先に出す。
       前は会社と職位を選ぶまで数字が1つも出ず、「年収はいくらのペースか」という
       見出しの下が空の依頼文だけになっていた（実測）。 */
    var out = '<div class="ps-aha-t">' + esc2(T.ahaT) + '</div>' +
      '<div class="ps-aha-pace"><div class="ps-aha-pk">' + esc2(T.ahaPace) + '</div>' +
      '<div class="ps-aha-pv">' + esc2(money(jpy)) + '</div></div>';

    /* 会社・職位はまだ選ばれていないのが普通（明細に書いていない）。
       ★ボタンはここに置かない。会社と職位は、すぐ下の1枚で選ぶ（押す場所を2つにしない）。 */
    if (!air || !pos) {
      host.innerHTML = out;
      return;
    }
    if (air === 'other')  { host.innerHTML = out + '<p class="ps-aha-msg">' + esc2(T.ahaNoAirline) + '</p>'; return; }
    /* ★2026-09-02 以降、この行はフォームからは届かない。BAND は fo / cap の2つで、
       そこに落ちるのは訓練生だけだったが、訓練生を職位の選択肢から外したため
       （pv-vocab.mjs の POSITIONS に retired を立てた）。
       分岐は保険として残す ── 公開レンジの無い職位を将来足したときに、
       ここが無いと下の band が undefined のまま進む。
       ⚠️ 文言（ahaNoBand）は訓練生の話のままにしてある。届かないので誰も読まないが、
          もし別の職位で届かせるなら文言も一緒に書き直すこと。 */
    if (!BAND[pos])       { host.innerHTML = out + '<p class="ps-aha-msg">' + esc2(T.ahaNoBand) + '</p>';    return; }

    if (!SAL) { loadSalary(); host.innerHTML = out; return; }
    var me = SAL[air], band = BAND[pos], r = me && me[band];
    /* ★年収の公開レンジを持たない会社（小規模・チャーター・ビジネスジェット）も
       選べるようにしたので（2026-09-13 / airline-ops.mjs）、ここへ落ちるのが常態になった。
       もとは黙って何も出さなかった＝本人には「入力を間違えたので出ない」ように見える。
       ★比較の1節だけを説明に差し替える。支給内訳・時間あたり・税の節は帯に依らないので、
         今までどおりそのまま出る。 */
    if (!r || !(r.hi > r.lo)) {
      host.innerHTML = out + '<p class="ps-aha-msg">' + esc2(T.ahaNoRange) + '</p>';
      return;
    }

    var man = jpy / 10000;                            // SSOT の単位は万円
    var nameOf = function (a) { return (L === 'en' ? a.en : a.ja) || ''; };

    // ── ② 自社・同職位の公開レンジのどこにいるか ─────────
    var span = r.hi - r.lo;
    var dot  = Math.max(0, Math.min(100, (man - r.lo) / span * 100));
    var avgX = Math.max(0, Math.min(100, (r.avg - r.lo) / span * 100));
    var where, cls;
    /* レンジ外でも点の色は変えない。白にするとライトテーマで淡い帯に溶けて
       「点が無い」ように見えた（実測）。外れたことは真下の文章が言っている。 */
    if (man < r.lo)      { where = T.ahaBelow(money((r.lo - man) * 10000)); cls = ' is-under'; }
    else if (man > r.hi) { where = T.ahaAbove(money((man - r.hi) * 10000)); cls = ' is-over'; }
    /* ★「下寄り／真ん中／上寄り」の3分割はやめた。レンジは平均を中心に対称ではないので
       （エミレーツ機長は lo 3,350／平均 3,700／hi 5,050＝平均が下から2割の位置）、
       平均より上なのに「レンジの下寄り」と出て矛盾して読める（実測）。
       レンジは「中か外か」だけ言い、程度は右側の「平均との差」に任せる。 */
    else                 { where = T.ahaIn; cls = ''; }

    var dAvg = man - r.avg;
    var vsAvg = Math.abs(dAvg) / r.avg < 0.02 ? T.ahaSame
              : T.ahaDiff(money(Math.abs(dAvg) * 10000), dAvg > 0);

    out += '<div class="ps-aha-sec">' + esc2(T.ahaRangeT(nameOf(me), BAND_LABEL[band][BAND_L])) + '</div>' +
      '<div class="ps-aha-bar' + cls + '">' +
        '<i class="ps-aha-avg" style="left:' + avgX.toFixed(1) + '%" title="' + esc2(T.ahaAvgTick) + '"></i>' +
        '<i class="ps-aha-dot" style="left:' + dot.toFixed(1) + '%"></i></div>' +
      /* ★平均のラベルは目盛りの真下に置く。ends の真ん中に入れていたときは、
         目盛りが 20% の位置なのにラベルが 50% に立っていて、どの線の説明か読めなかった
         （エミレーツ機長は lo 3,350／平均 3,700／hi 5,050＝平均が下から2割）。
         端まで行くと lo/hi と重なるので 9〜91% に収める。 */
      /* ★札が帯の外へ出ない（2026-11-06。英語・スペイン語の長い札が左へはみ出し、ページごと横に動いた）。端に寄った目盛りでは札を内側へ寄せる。 */
      '<div class="ps-aha-avgl"><span class="' + (avgX < 30 ? 'is-l' : avgX > 70 ? 'is-r' : '') + '" style="left:' + Math.max(0, Math.min(100, avgX)).toFixed(1) + '%">' +
        esc2(T.ahaAvgTick) + ' ' + esc2(money(r.avg * 10000)) + '</span></div>' +
      '<div class="ps-aha-ends"><span>' + esc2(money(r.lo * 10000)) + '</span>' +
        '<span>' + esc2(money(r.hi * 10000)) + '</span></div>' +
      '<div class="ps-aha-where">' + esc2(where) + '<span>' + esc2(vsAvg) + '</span></div>';

    // ── ③ 同じ職位で、公開平均が上の会社 ──────────────
    var pool = [];
    for (var k in SAL) {
      if (!SAL.hasOwnProperty(k)) continue;
      var a = SAL[k], b = a && a[band];
      if (b && b.avg > 0) pool.push({ key: k, a: a, avg: b.avg });
    }
    pool.sort(function (x, y) { return y.avg - x.avg; });
    var above = 0;
    for (var i = 0; i < pool.length; i++) if (pool[i].avg > man) above++;
    /* ★ 母数で頭打ちにする。全社より低いと above が pool.length になり、
       素直に +1 すると「110社の中では111番目」＝存在しない順位を出す。 */
    var rank = Math.min(pool.length, above + 1);

    /* 差が1万円未満の会社は出さない。「+¥0万」という行になって意味を持たない。 */
    var up = pool.filter(function (p) { return p.key !== air && p.avg - man >= 1; }).slice(0, 5);
    out += '<div class="ps-aha-sec">' + esc2(T.ahaUpT) + '</div>';
    if (!up.length) {
      out += '<p class="ps-aha-msg">' + esc2(T.ahaNoUp(pool.length)) + '</p>';
    } else {
      out += '<div class="ps-aha-list">' + up.map(function (p) {
        return '<div class="ps-aha-row"><span class="ps-aha-name">' + esc2(nameOf(p.a)) +
          (p.a.taxFree ? '<b class="ps-aha-tf">' + esc2(T.ahaTaxFree) + '</b>' : '') + '</span>' +
          '<span class="ps-aha-num">' + esc2(money(p.avg * 10000)) + '</span>' +
          '<span class="ps-aha-gap">+' + esc2(money((p.avg - man) * 10000)) + '</span></div>';
      }).join('') + '</div>';
    }
    // 1位のときは「該当なし」で言い切れている。順位行を足すと同じことを二度言う。
    if (up.length) out += '<div class="ps-aha-rank">' + esc2(T.ahaRank(rank, pool.length)) + '</div>';
    out += '<p class="ps-note">' + T.ahaNote + '</p>';

    host.innerHTML = out;
  }

  // 通貨を切り替えたら描き直す（カードは pv-no-cur ＝自動スキャンの対象外）
  window.addEventListener('pv-currency-change', renderAha);
  window.addEventListener('pv-currency-change', function () { renderRate(); });

  // 手で直したら時給もついてくる
  document.getElementById('form-wrap').addEventListener('input', function () {
    if (document.getElementById('ps-rate')) renderRate();
    if (document.getElementById('ps-aha')) renderAha();
  });
})();
