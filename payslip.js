/* ════════════════════════════════════════════════════════════════
   payslip.js — 明細を落とすと、時給が出る

   pay-report.html / en/pay-report.html の #ps に載る。
   ページ側の inline script より **後**に読むこと（$ / num / annualTotal /
   updateSteps / openOpt / recalc / _sb / LANG を借りている）。

   ── この順番だけは崩さない ──────────────────────────────────
     ① 端末の中で読む   … 画像はまだどこにも送られていない
     ② 端末の中で黒塗り … 自動で置く。落ちても「塗らない」には落ちない
     ③ 本人が見る       … プレビュー＝これから送られる画像そのもの
     ④ 送る             … canvas を再エンコードしたものだけ。元ファイルは出ない
     ⑤ フォームに下書き … ★自動で投稿しない。送信は本人が押す

   ④で送るのは合成後の canvas なので、黒塗りは「上に黒い div を重ねた見た目」
   ではなく **画素そのもの**。JPEG の 8×8/16×16 ブロックが境界をまたいで
   にじむのを避けるため、塗る矩形は外側へ16px単位で切り上げてから塗る。
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root = document.getElementById('ps');
  if (!root) return;
  if (typeof _sb === 'undefined') return;                 // Supabase が落ちていたら出さない

  var L = (typeof LANG !== 'undefined' && LANG === 'en') ? 'en' : 'ja';

  // ── 文言 ──────────────────────────────────────────────────
  var T = {
    ja: {
      reading: '明細を読んでいます…',
      sending: '読み取っています（15秒ほど）…',
      redacted: '氏名・社員番号・口座番号を、この端末の中で探して黒く塗ります。',
      scanning: '探しています…（初回だけ、読み取り用のデータを取りに行くので少し待ちます）',
      scanDone: function (n) { return '自動で ' + n + ' か所を塗りました。抜けがあれば足してください。'; },
      /* ★層Aを廃止したので「上の帯だけを塗っています」は事実でなくなった。
         塗れなかったときは、塗れていないことをそのまま言う。 */
      scanNone: '⚠ 自動では氏名・社員番号・口座を見つけられませんでした。塗りつぶしは1つもありません。写っているところは、送る枠を狭めるか、塗りつぶしを足してください。',
      scanFail: '⚠ 自動の探索ができませんでした。塗りつぶしは1つもありません。写っているところは、送る枠を狭めるか、塗りつぶしを足してください。',
      redactNone: '⚠ 塗りつぶしが1つもありません。氏名・社員番号が写っていないか、もう一度見てください。',
      confirm: '枠の中に、氏名・社員番号・口座番号が残っていないことを確認しました',
      confirmWait: '探し終わるまでお待ちください。',
      /* ★探している間に出す。明細そのものは出さない（②-F を参照）。 */
      waitTitle: '明細を読んで、黒く塗る場所を探しています…',
      waitNote: '塗り終わるまで明細は表示しません。塗る前の明細を、出来上がったものと見まちがえて送ってしまわないためです。',
      preview: 'これが、これから送られる画像です。',
      addRect: '+ 塗りつぶしを追加',
      reset: '自動配置に戻す',
      cancel: 'やめる',
      send: 'この画像を送る',
      del: '消す',
      hint: '塗る場所はドラッグで動かせます。右下をつまむと大きさが変わります。',
      frameTag: '⤧ 送る枠',
      frameLead: '送られるのは<b>明るい枠の中だけ</b>です。暗くなっている外側は、送る前に画像ごと切り落とされます。',
      frameHint: '枠は左上の「送る枠」をつまむと動きます。四隅で大きさが変わります。',
      frameOff: '⚠ いまの枠は<b>画像ぜんぶ</b>を覆っています。このままだと画像がすべて送られます。四隅をつまんで、<b>給与の表だけ</b>を囲ってください。',
      frameAll: '枠を画像全体に広げる',
      diagCopy: '診断をコピー',
      diagDone: '診断をコピーしました',
      note: '枠の外は端末から出ません（送る前に画像ごと切り落としています）。送るのは枠の中だけで、解析にだけ使い、保存しません。塗った部分は画素ごと黒になっているので、送っても復元できません。',
      badImage: 'このファイルは読めませんでした。PDF・JPEG・PNG・WebP のどれかにしてください。',
      tooLarge: 'ファイルが大きすぎます。画像は6MB、PDF は20MB までにしてください。',
      pdfReading: 'PDF を開いています…（初回だけ、読み込み用のデータを取りに行きます）',
      pdfText: 'PDF の文字をそのまま読めました。',
      pdfPages: function (n) { return '（' + n + 'ページのうち1ページ目だけを読み込んでいます）'; },
      pdfLocked: 'この PDF はパスワードで保護されています。パスワードを外して保存し直すか、開いた画面のスクリーンショットを落としてください。',
      pdf: 'PDF を開けませんでした。開いた画面のスクリーンショットを撮って落としてください。',
      errNet: '送れませんでした。通信を確かめて、もう一度試してください。',
      /* ★読み取りに失敗したときは、必ず「このまま手で入力できます」で終える。
         下の doSend が同時に入力フォームを開くので、文章と画面が一致する。
         ここで行き止まりにすると、いちばん濃い見込み客がそのまま離脱する。 */
      errRead: '明細として読み取れませんでした。<b>このまま手で入力できます</b>（下のフォームを開きました）。撮り直す場合は、明るいところで明細全体が入るようにしてください。',
      errNotSlip: '給与明細に見えませんでした。<b>このまま手で入力できます</b>（下のフォームを開きました）。読み取りをやり直す場合は、明細の部分だけを切り取った画像でお試しください。',
      errQuota: '今日の自動読み取りの上限に達しました。<b>このまま手で入力できます</b>（下のフォームを開きました）。自動読み取りは明日また使えます。',
      /* ★全体の天井に当たったとき。本人のせいではないので言い方を変える。
           サーバ側で本人の回数は戻してあるので、残り回数の一文は本当のこと。 */
      errQuotaGlobal: 'いま自動読み取りが混み合っていて、今日はこれ以上お受けできません。<b>このまま手で入力できます</b>（下のフォームを開きました）。あなたの残り回数は減っていません。',
      errServer: 'いま自動読み取りが使えません。<b>このまま手で入力できます</b>（下のフォームを開きました）。',
      resultTitle: '読み取りました',
      resultLead: 'AIが読んだ値です。<b>明細と見比べて</b>、違うところは直してください。<b>この時点ではまだ投稿されていません。</b>',
      col1: '明細の項目', col2: '入れた欄', col3: '金額',
      askBlockT: '乗務時間（block hours）が読み取れませんでした',
      askBlockOkT: '乗務時間（block hours）',
      askBlockL: '1つ入れるだけで「乗務時間あたりの時給」が出ます。明細の block / 乗務時間の欄です。',
      askBlockF: '明細から拾いました。合っていれば、このままで大丈夫です。',
      editHint: '金額はこの表で直せます。直すと下のフォームと時給に反映されます。',
      foldTitle: '読み取った明細の内訳を見る（{n}行）',
      foldTitleNoN: '読み取った明細の内訳を見る',
      nextT: 'あと{n}つで送信できます',
      nextL: '会社・職位・機材は明細に書いていないので、ここだけ選んでください。',
      nextB: '会社と職位を選ぶ →',
      nextOkT: '送信できます',
      nextOkL: '内容を確かめてから送ってください。押すまで投稿されません。',
      nextOkB: '送信ボタンへ →',
      days: '乗務日数',
      /* ★2026-08-14 まで、分類できなかった行はここに「これはどれですか？」と出すだけで、
           金額はどの欄にも入っていなかった＝年収から黙って欠けていた。いまは
           「その他手当（未分類）」として数え、答えるかどうかは本人に任せる。 */
      uncTag: '（未分類）',
      askT: function (n) { return n === 1 ? 'あと1項目、確認できます' : 'あと' + n + '項目、確認できます'; },
      askL: '答えなくてもレポートは完成しています。金額は「その他手当」に入れてあります。',
      askQ: 'これは何に近いですか？',
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
      chkNet: function (d) {
        return '※ <b>支給合計 − 控除合計</b>と、読み取った<b>差引支給額</b>が合いません（差 ' + d +
               '）。どちらかを読み違えています。手取りの欄を明細と見比べてください。';
      },
      fieldMissing: '（欄なし・表示のみ）',
      rate: 'あなたの時給',
      perBlock: '乗務時間あたり',
      perDuty: '総勤務時間あたり',
      perMin: '分給',
      pdOn: 'パーディアムを含める',
      needDuty: '総勤務時間が明細から読めませんでした。',
      deduct: '控除合計', net: '差引支給額', dutyH: '総勤務時間', nightH: '深夜時間', blockH: '乗務時間', creditH: 'クレジットアワー',
      notionalTag: '（収入に数えていません）',
      notionalNote: '※ 控除欄に同額が立つ現物給与の課税処理（航空券課税など）です。手取りが動かないので、時給の計算には入れていません。',
      aiMark: 'AIが読んだ値',
      ahaT: 'この明細だと、年収はいくらのペースか',
      ahaPace: '年間ペース',
      ahaPaceH: '明細の月額 ×12（入力したボーナス・プロフィットシェアを足しています）',
      ahaPick: '会社と職位を選ぶと、公開レンジとの比較が出ます。',
      ahaPickB: '会社と職位を選ぶ →',
      ahaNoAirline: '「その他」の会社は公開レンジを持っていないので、比較は出せません。',
      ahaNoBand: '訓練生の公開レンジはまだありません。副操縦士から比較が出ます。',
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
      reading: 'Reading your payslip…',
      sending: 'Reading it (about 15 seconds)…',
      redacted: 'We look for your name, staff number and account number and black them out right here on your device.',
      scanning: 'Looking for them… (the first time, this fetches the reading data, so it takes a moment)',
      scanDone: function (n) { return n + ' area' + (n === 1 ? '' : 's') + ' blacked out automatically. Add more if anything was missed.'; },
      scanNone: '⚠ Your name, staff number and account could not be found automatically. Nothing is blacked out. Please shrink the frame, or add blocks yourself, over anything still visible.',
      scanFail: '⚠ The automatic search could not run. Nothing is blacked out. Please shrink the frame, or add blocks yourself, over anything still visible.',
      redactNone: '⚠ Nothing is blacked out. Check again that no name or staff number is visible.',
      confirm: 'I have checked that no name, staff number or account number is left inside the frame',
      confirmWait: 'Please wait until the search finishes.',
      waitTitle: 'Reading your payslip and looking for what to black out…',
      waitNote: 'Your payslip stays hidden until this finishes, so you cannot mistake the un-redacted image for the finished one and send it.',
      preview: 'This is the image that will be sent.',
      addRect: '+ Add a block',
      reset: 'Reset to auto',
      cancel: 'Cancel',
      send: 'Send this image',
      del: 'Remove',
      hint: 'Drag to move a block. Grab the bottom-right corner to resize it.',
      frameTag: '⤧ Sent area',
      frameLead: 'Only what is <b>inside the bright frame</b> is sent. Everything in the darkened area is cropped away before sending.',
      frameHint: 'Grab the “Sent area” tab to move the frame. The four corners resize it.',
      frameOff: '⚠ The frame currently covers <b>the whole image</b>, which means the whole image would be sent. Please grab the corners and put the frame around <b>the pay tables only</b>.',
      frameAll: 'Expand frame to whole image',
      diagCopy: 'Copy diagnostics',
      diagDone: 'Diagnostics copied',
      note: 'Nothing outside the frame leaves your device — it is cropped away before sending. Only what is inside the frame is sent; it is used only to read the figures and is never stored. Blacked-out areas are black in the pixels themselves, so they cannot be recovered.',
      badImage: 'That file could not be read. Please use a PDF, JPEG, PNG or WebP.',
      tooLarge: 'That file is too large. Please keep images under 6MB, PDFs under 20MB.',
      pdfReading: 'Opening the PDF… (the reader is downloaded the first time only)',
      pdfText: 'Read the text directly from the PDF.',
      pdfPages: function (n) { return ' (page 1 of ' + n + ' only)'; },
      pdfLocked: 'This PDF is password-protected. Save a copy without the password, or drop a screenshot of it instead.',
      pdf: 'That PDF could not be opened. Open it and drop a screenshot instead.',
      errNet: 'Could not send it. Check your connection and try again.',
      /* ★A failed read must always end with “you can type it in”. doSend opens the
         form at the same moment, so the words match what is on screen. A dead end
         here loses the most motivated person on the page. */
      errRead: 'The payslip could not be read. <b>You can type it in below</b> — the form is now open. To try reading again, retake the photo in good light with the whole slip in frame.',
      errNotSlip: 'That does not look like a payslip. <b>You can type it in below</b> — the form is now open. To try reading again, use an image cropped to just the payslip.',
      errQuota: 'You have used today’s automatic reads. <b>You can type it in below</b> — the form is now open. Automatic reading is available again tomorrow.',
      errQuotaGlobal: 'Automatic reading is busy right now and we cannot take any more today. <b>You can type it in below</b> — the form is now open. This did not use one of your reads.',
      errServer: 'Automatic reading is unavailable right now. <b>You can type it in below</b> — the form is now open.',
      resultTitle: 'Here is what we read',
      resultLead: 'These are the figures the AI read. <b>Check them against your slip</b> and fix anything wrong. <b>Nothing has been submitted yet.</b>',
      col1: 'Line on your slip', col2: 'Goes into', col3: 'Amount',
      askBlockT: 'Block hours could not be read',
      askBlockOkT: 'Block hours',
      askBlockL: 'Add this one number and you get pay per block hour. It is the block / flight time line on your slip.',
      askBlockF: 'Picked up from your slip. Leave it if it looks right.',
      editHint: 'You can fix the amounts right here. Edits flow into the form below and into your hourly pay.',
      foldTitle: 'See what we read off your payslip ({n} lines)',
      foldTitleNoN: 'See what we read off your payslip',
      nextT: '{n} more to go',
      nextL: 'Airline, seat and fleet are not on the slip, so pick those yourself.',
      nextB: 'Pick airline and seat →',
      nextOkT: 'Ready to send',
      nextOkL: 'Check it over first. Nothing is posted until you press send.',
      nextOkB: 'Go to send →',
      days: 'Flight days',
      uncTag: ' (unclassified)',
      askT: function (n) { return n === 1 ? 'One line you can confirm' : n + ' lines you can confirm'; },
      askL: 'Your report is already complete without this. The amount is counted under “Other allowances”.',
      askQ: 'What is this closest to?',
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
      chkNet: function (d) {
        return '※ <b>Gross − deductions</b> does not match the <b>net pay</b> we read (off by ' + d +
               '). One of them was misread. Please check the take-home figure against your payslip.';
      },
      fieldMissing: '(no field yet — shown only)',
      rate: 'Your hourly pay',
      perBlock: 'per block hour',
      perDuty: 'per duty hour',
      perMin: 'per minute',
      pdOn: 'Include per diem',
      needDuty: 'Duty hours were not readable from your slip.',
      deduct: 'Total deductions', net: 'Net pay', dutyH: 'Duty hours', nightH: 'Night hours', blockH: 'Block hours', creditH: 'Credit hours',
      notionalTag: ' (not counted as income)',
      notionalNote: '※ Imputed income that is taken straight back in the deductions column by the same amount (e.g. taxable staff travel). Your take-home does not change, so it is left out of the hourly figures.',
      aiMark: 'read by AI',
      ahaT: 'What this slip puts you on for the year',
      ahaPace: 'Annual pace',
      ahaPaceH: 'Monthly total × 12, plus any bonus and profit share you entered',
      ahaPick: 'Pick your airline and seat and you get the comparison against the published ranges.',
      ahaPickB: 'Pick airline and seat →',
      ahaNoAirline: '“Other” has no published range, so there is nothing to compare against.',
      ahaNoBand: 'There is no published range for cadets yet. Comparison starts at first officer.',
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
    },
  }[L];

  // ── 定数 ──────────────────────────────────────────────────
  var MAX_EDGE = 1568;        // Anthropic のビジョンが内部で縮める上限に合わせる
  var MAX_BYTES = 6 * 1024 * 1024;
  /* PDF は端末の中で画像に描き直してから送るので、元の大きさは送る量と関係がない。
     スキャンした明細の PDF は10MBを超えることがあり、6MBで弾くと
     **いちばん確実に読める入り口**を自分で塞ぐことになる。 */
  var MAX_PDF_BYTES = 20 * 1024 * 1024;
  var JPEG_Q = 0.86;
  var BLOCK = 16;             // JPEG のブロック境界。塗る矩形はこの倍数へ外側に丸める

  /* ── OCR（層B）の定数 ────────────────────────────────────
     版は固定する。黒塗り前の画像を見るのはこのスクリプトだけなので、
     「@5」のような可動タグにして勝手に中身が変わる状態にはしない。
     ※ tesseract.js は自身で worker と wasm を CDN から引く。SRI は掛からない。
       自前配信（vendor/）へ移す判断は積み残し。 */
  var OCR_JS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  var OCR_LANGS = ['jpn', 'eng'];   // JP の明細も数字はラテン。両方要る
  var OCR_W = 2800;           // 本文の字が 20〜30px になる幅。これ未満だと表組みが崩れる
  var OCR_MAXPX = 10e6;       // 高解像度の写真でメモリを飛ばさない上限
  /* ★原寸を読むようにした（下の findPii を参照）ぶん、実物の明細では
     15 秒に収まらないことがある。ここで諦めると帯だけになって、
     氏名が塗られないまま「見つかりませんでした」に落ちる。長めに待つ。 */
  var OCR_MS = 40000;         // これを過ぎたら諦めて帯だけで進む
  var OCR_MINCONF = 30;       // 自信のない読みは手がかりにしない

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
    /* 不就労減額などのマイナス行。同じ「その他手当」に、符号のまま足し込む。
       （sums は加算なので、マイナスはそのまま引かれる＝支給合計と勘定が合う） */
    absence: 'f-other',
    other: 'f-other',
    /* ★明細に印字されているのは「その月に出た額」。年間ボーナス(f-bonus)へ入れると、
       1ヶ月ぶんが年額として年収に丸ごと乗る（2026-08-13 に f-bonus-mo へ変更）。 */
    bonus: 'f-bonus-mo',
    profit: 'f-profit',
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
    { field: 'f-bonus-mo', kind: 'bonus',           asked: 'bonus' },
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
    'f-bonus-mo': { ja: '今月出たボーナス', en: 'Bonus paid this month' },
    'f-bonus': { ja: '年間ボーナス', en: 'Annual bonus' },
    'f-profit': { ja: 'プロフィットシェア（年）', en: 'Profit share (annual)' },
    'f-block': { ja: 'フライトタイム', en: 'Flight time' },
    'f-netpay': { ja: '手取り額', en: 'Net pay' },
    'f-duty-h': { ja: '勤務時間', en: 'Duty time' },
    'f-currency': { ja: '通貨', en: 'Currency' },
    'f-year': { ja: '対象月', en: 'Period' },
    /* ★欄ではなく「行」に入るもの（2026-08-27）。id ではないので getElementById には
       渡らない。確認の表に行き先として出すためだけの名前。 */
    'pd-var': { ja: '変動給', en: 'Variable pay' },
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
  var work = null;     // 縮小済みの元画像（黒塗りなし）
  var W = 0, H = 0;
  var rects = [];      // {x,y,w,h} 画像ピクセル
  var autoRects = [];
  /* ★送る枠。work と同じピクセル座標で持つ＝画面の表示と送る画素が同じ座標系になる。
     src は**原寸**の元画像。枠は原寸から切り出す（work から切ると解像度が落ちる）。 */
  var src = null;
  var frame = null;
  var autoFrame = null;
  var frameAuto = false;   // 自動で置けたか。置けなかったら画面で大きく知らせる
  var lastHours = null;
  var busy = false;
  var ocrState = 'idle';   // idle | running | done | none | failed
  var ocrFound = 0;
  /* 見つからなかったときに、何が起きたのかを本人が読み上げられるようにする。
     ★出すのは寸法・語数・秒数だけ。**読み取った文字も画像も一切出さない。**
       ここに文字列を混ぜた瞬間、氏名がスクリーンショット経由で外へ出る。
     URL に ?psdebug=1 が付いているときだけ表示する。 */
  var ocrDiag = null;
  var OCR_DEBUG = /[?&]psdebug=1\b/.test(location.search);
  /* 診断の材料。frameFrom が「なぜその枠にしたか」を、findPii が「何を読んだか」を置く。
     どちらも本文は入らない形で持つ（下の diagText を参照）。 */
  var frameDiag = null;
  var lineDiag = null;

  // ── DOM ───────────────────────────────────────────────────
  var fileInput = document.getElementById('ps-file');
  var dropBtn = document.getElementById('ps-drop');
  var panel = document.getElementById('ps-panel');
  if (!fileInput || !dropBtn || !panel) return;

  /* ★ここからログイン画面へ送らない（2026-08-14）。読み取りの回数は
     ログインしてもしなくても同じになったので、誘う理由が無くなった。
     失敗したときは下の doSend が入力フォームを開く。 */
  function say(kind, msg) {
    panel.innerHTML = '';
    panel.appendChild(el('div', 'ps-msg ps-msg-' + kind, msg));
  }
  function clearPanel() { panel.innerHTML = ''; }

  // ════════════════════════════════════════════════════════
  // ① 受け取る
  // ════════════════════════════════════════════════════════
  dropBtn.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) take(fileInput.files[0]);
    fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach(function (ev) {
    root.addEventListener(ev, function (e) { e.preventDefault(); dropBtn.classList.add('is-over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    root.addEventListener(ev, function (e) { e.preventDefault(); dropBtn.classList.remove('is-over'); });
  });
  root.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) take(f);
  });

  function take(file) {
    if (busy) return;
    var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    /* ★ここで弾かれた人は「明細を出そうとしたのに1歩も進めなかった人」。
       黙って戻ると、選びもしなかった人と同じ数に見えてしまう。 */
    if (file.size > (isPdf ? MAX_PDF_BYTES : MAX_BYTES)) {
      track('payslip_reject', { reason: 'too_large' });
      return say('warn', T.tooLarge);
    }
    if (!isPdf && !/^image\//.test(file.type)) {
      track('payslip_reject', { reason: 'bad_type' });
      return say('warn', T.badImage);
    }
    track('payslip_loaded', { kind: isPdf ? 'pdf' : 'image' });
    if (isPdf) {
      say('busy', T.pdfReading);
      renderPdf(file).then(function (r) {
        /* 何ページ目を読んだかは、探索の結果と同じ場所に添える。
           別の場所に出すと、次の表示（探しています…）で消えてしまう。 */
        /* ★ここで言えるのは「何ページ目を読んだか」だけ。
           「文字をそのまま読めた」かどうかは**実際に通った経路**が決めるので、
           下の updateGate() が診断を見て自分で足す。ここで書いてしまうと、
           経路が OCR に落ちた日でも同じ文が出る＝画面が嘘をつく。 */
        srcNote = r.pages > 1 ? T.pdfPages(r.pages) : '';
        beginEdit(r.canvas, r.words);
      }).catch(function (e) {
        var locked = e && (e.name === 'PasswordException' || /password/i.test(String(e.message || '')));
        track('payslip_reject', { reason: locked ? 'pdf_locked' : 'pdf_broken' });
        say('warn', locked ? T.pdfLocked : T.pdf);
      });
      return;
    }
    say('busy', T.reading);
    srcNote = '';
    loadImage(file).then(function (bmp) { beginEdit(bmp, null); })
      .catch(function () {
        track('payslip_reject', { reason: 'image_decode' });
        say('warn', T.badImage);
      });
  }

  /* 画像でも PDF の1ページ目でも、ここから先は同じ道を通す。
     words は PDF の文字の層（あれば）。無ければ OCR に落ちる。 */
  function beginEdit(bmp, words) {
    src = bmp;                                 // ★閉じない。切り出しの元はここ
    buildWork(bmp);
    /* 枠の初期値は**画像全体**。狭めるのは手がかりが取れたときだけ＝
       探索が失敗した日に、黙って明細の一部だけを送る状態へ倒れない。 */
    frame = fullFrame();
    autoFrame = fullFrame();
    frameAuto = false;
    /* ★塗りつぶしは**探して当たったものだけ**。上端の帯（層A）は廃止した。
       当てずっぽうの黒を最初から置かないので、ここが空のまま残った画面は
       「まだ何も隠せていない」という本当のことを映している。 */
    rects = [];
    autoRects = [];
    /* ★renderEditor() より**先に**「探している」にしておく。あとで scanPii() が
       同じ値を入れ直すが、そこまでの一瞬でも 'idle' のまま描くと、塗る前の明細が
       画面に出てしまう。ここで先に立てておけば、最初の描画から隠れた状態で始まる。 */
    ocrState = 'running';
    renderEditor();
    scanPii(bmp, words);   // ★原寸のまま渡す。中で OCR 用に描き写してから閉じる
  }

  // ════════════════════════════════════════════════════════
  // ①-b PDF（海外の明細はメールで届く PDF がふつう）
  //
  //    写真より綺麗、というだけではない。PDF には**文字が文字として**
  //    入っていることが多く、そのときは位置まで正確に分かる。
  //    ＝OCR の読み違いが最初から無い。だから2段構えにする：
  //      ① 1ページ目を画像に描き出す（黒塗りを焼き込む先はこの画素）
  //      ② 文字の層があれば、その位置をそのまま手がかりに使う（OCR を動かさない）
  //      ③ スキャンした PDF＝文字の層が空のときだけ、①の画像を OCR にかける
  //    pdf.js は tesseract と同じで、**落とされたときにだけ**取りに行く。
  // ════════════════════════════════════════════════════════
  var PDF_JS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.min.js';
  var PDF_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js';
  var PDF_W = 2400;          // 描き出す横幅。OCR に落ちたときでも字が潰れない大きさ
  var PDF_MAXPX = 12e6;
  var srcNote = '';

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

  function renderPdf(file) {
    var L = null;
    return loadPdf().then(function (lib) {
      L = lib;
      L.GlobalWorkerOptions.workerSrc = PDF_WORKER;
      return file.arrayBuffer ? file.arrayBuffer() : new Response(file).arrayBuffer();
    }).then(function (buf) {
      /* isEvalSupported:false＝PDF の中の JavaScript を動かさない。
         他人が作った PDF を開くので、こちらから実行の道を開けない。 */
      return L.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
    }).then(function (doc) {
      var pages = doc.numPages;
      return doc.getPage(1).then(function (page) {
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
        return page.render({ canvasContext: cx, viewport: vp }).promise
          .then(function () { return page.getTextContent(); })
          .then(function (tc) { return { canvas: c, pages: pages, words: pdfWords(L, tc, vp, c) }; })
          .catch(function () { return { canvas: c, pages: pages, words: [] }; });
      });
    });
  }

  /* 文字の層を、OCR の返り値と**同じ形**（画像に対する割合の矩形）に均す。
     ここを揃えておけば、この先の照合も帯の作り方も1本で済む
     ＝片方の経路だけが直る／壊れる、が起きない。

     PDF の座標は下が原点。viewport の変換を通すと画面の向きになる。
     1つの item に語がいくつも入ることがあるので空白で割り、
     文字数で幅を按分する（厳密ではないが、帯は語の**塊**に置くので足りる）。 */
  function pdfWords(L, tc, vp, c) {
    var out = [];
    (tc && tc.items || []).forEach(function (it) {
      var s = String(it.str || '');
      if (!s.trim() || !it.transform) return;
      var m = L.Util.transform(vp.transform, it.transform);
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

  /* 語を行に束ねる。OCR は行を返してくれるが、文字の層は返さないので
     縦の重なりで束ねる。左右2段の様式でも同じ高さのものは1行として扱う
     ＝OCR 経路と見え方を揃える（帯の右端の決め方が変わらない）。 */
  function groupLines(ws) {
    var sorted = ws.slice().sort(function (a, b) { return (a.y0 + a.y1) - (b.y0 + b.y1); });
    var out = [], cur = null, mid = 0;
    sorted.forEach(function (w2) {
      var m = (w2.y0 + w2.y1) / 2;
      if (cur && Math.abs(m - mid) <= Math.max(0.004, (w2.y1 - w2.y0) * 0.6)) { cur.w.push(w2); return; }
      cur = { bx1: 1, w: [w2] };
      mid = m;
      out.push(cur);
    });
    out.forEach(function (ln) { ln.w.sort(function (a, b) { return a.x0 - b.x0; }); });
    return out;
  }

  /* ★探している間は明細を出さない（.ps-edit.is-wait／②-F）。以前はここで
     層A の帯を先に描いて画面を埋めていたが、帯は廃止した。代わりに待機の箱を出す。
     探している間は確認チェックを押せない＝**確認したのは最終形**を保証する。
     途中で「やめる」を押されたり、別の画像を落とされたら token が変わって捨てる。 */
  var ocrToken = 0;
  function scanPii(bmp, words) {
    var mine = ++ocrToken;
    ocrState = 'running';
    /* ★探索が終わるまで確認チェックも送信ボタンも画面に出ない（updateGate）。
       つまりここに来るまでは、本人には「送る」という選択肢すら無い。
       ここが待ち時間の実測値で、諦める人がいるとすればまずこの手前。 */
    var t0 = (window.performance && performance.now) ? performance.now() : 0;
    var done = function (state) {
      track('payslip_ready', {
        state: state,
        ms: Math.round(((window.performance && performance.now) ? performance.now() : 0) - t0),
      });
    };
    updateGate();
    findPii(bmp, words).then(function (found) {
      if (mine !== ocrToken || !work) return;               // 別の画像に移った・やめた
      if (!found) { ocrState = 'failed'; done('failed'); return updateGate(); }
      /* ★枠は黒塗りと**別に**受け取る。手がかりが1つも無くても枠は置けることがあり、
         逆に黒塗りが取れても枠が置けないことがある。片方の失敗でもう片方を捨てない。 */
      if (found.frame) {
        frame = found.frame;
        autoFrame = { x: frame.x, y: frame.y, w: frame.w, h: frame.h };
        frameAuto = true;
      }
      var got = found.rects || [];
      ocrState = got.length ? 'done' : 'none';
      ocrFound = got.length;
      got.forEach(function (r) {
        rects.push(r);
        autoRects.push({ x: r.x, y: r.y, w: r.w, h: r.h });  // 「自動配置に戻す」でも消えない
      });
      paint();
      done(ocrState);
      updateGate();
    });
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

  /* ★bmp をここで閉じない。閉じるのは OCR 用に描き写したあと（findPii）。
     work は「送る画像」＝長辺 1568px へ縮めた絵で、これを OCR に食わせると
     実物の明細では字が 7〜9px まで潰れる。あとから 2800px へ引き伸ばしても
     そこで消えた画数は戻らない＝ラベルが1語も読めない。
     合成 fixture は元が 760〜940px でこの縮小自体が起きないので、
     8様式すべて緑のまま、この経路の欠陥が一度も現れなかった。 */
  function buildWork(bmp) {
    var iw = bmp.width || bmp.naturalWidth, ih = bmp.height || bmp.naturalHeight;
    if (!iw || !ih) throw new Error('size');
    var s = Math.min(1, MAX_EDGE / Math.max(iw, ih));
    W = Math.max(1, Math.round(iw * s));
    H = Math.max(1, Math.round(ih * s));
    work = document.createElement('canvas');
    work.width = W; work.height = H;
    work.getContext('2d').drawImage(bmp, 0, 0, W, H);
  }

  /* ── 層A（上端の帯）は 2026-08-06 に**廃止**した ───────────────
     以前はここに rowDarkness()／detectAuto() があり、OCR を使わずに
     「最初の太い罫線まで」を無条件で黒く塗っていた。方針判断で削除。
     理由は2つある。
       ① 実物では明細の上2〜4割を覆うだけで、本当に隠したいもの（最下部の
          振込先）には届かない。当てずっぽうに広く塗るので**邪魔**。
       ② もっと悪いことに、帯が層B（ラベル探索）の失敗を隠していた。
          氏名が帯の下にある様式では層Bが外していても画面上は黒く見え、
          テストも緑のままになる。**塗れていないことが見えるほうが安全。**
     代わりの歯止めは3つ：枠が紙ぜんぶのときの赤い警告／redactNone の⚠／
     送信前の確認チェック。★ここに帯を戻さないこと（回帰で固定してある）。 */

  // ════════════════════════════════════════════════════════
  // ②-B 氏名・社員番号・口座を実際に探して塗る（層B：ラベルOCR）
  //
  //    ★氏名そのものは読ませない。印字された**ラベル**を読む。
  //      ラベルは様式ごとに決まっていて、人名の字形より遥かに安定して取れる。
  //      ラベルが取れたら、その行を右端まで塗る（値はラベルの右か下にある）。
  //
  //    層A（上端の帯）は消さない。**足すだけ**。OCR が落ちても後退しない。
  //
  //    ── 実測して決めたこと（db/fixtures の8様式で確認）──────
  //      ・PSM は 3（自動）。tesseract の既定は 6（単一ブロック）で、
  //        明細のような表組みでは領域分割が破綻してほぼ全語がゴミになる。
  //        これに気づかないと「OCR を入れたのに何も見つからない」で終わる。
  //      ・原寸のままだと字が小さすぎて読めない。幅 2600px 相当まで拡大する。
  //      ・jpn 単独では数字が落ち、eng 単独では日本語が落ちる。両方載せる。
  // ════════════════════════════════════════════════════════
  /* ── 手がかりの語彙（多言語）──────────────────────────────
     ★ラテン文字の言語は**学習データを増やさずに**対応が広がる。
       西・葡・仏・独・伊・蘭・土・尼・越・波・羅・北欧・チェコの明細は
       字形が eng と同じなので、ここに語を足すだけで当たるようになる。
     ★ハングル・アラビア文字・キリル文字・タイ文字・デーヴァナーガリー・
       ギリシャ文字・ヘブライ文字は**字形そのものが読めない**ので、
       語を足すだけでは足りない。下の extraLang() が学習データを1つだけ足す。
     ★漢字は jpn の学習データにかなり含まれるので、中国語のラベルは部分的に読める。

     比べる前に norm() で揺れを潰す（小文字・全角→半角・アクセント除去・区切り除去）
     ので、ここは**その正規化後の形**で書く（prénom ではなく prenom）。 */
  var LABELS = [
    // ── 日本語
    '氏名', '名前', '姓名', '社員番号', '社員コード', '社員no', '従業員番号', '乗員番号',
    '職員番号', '個人番号', '整理番号', '受給者番号', 'マイナンバー',
    '振込先', '振込口座', '口座', '銀行', '支店', '普通', '当座', '住所', '生年月日',
    /* ★実物の OCR がこう読んだ、という形をそのまま足す。norm() を触ると
       他の一致まで一緒に動くので、直すのは手がかり表の側だけにする。
       「口座番号」は全角空きで組まれていて「ロロ座番号」と返ってくる（実測）。
       ロ（カタカナ）・囗（くにがまえ）・坐 は、口 の代表的な読み違え。 */
    'ロ座', 'ロ座番号', '囗座', '口坐',
    // 振込先のブロックに実際に印字される語（見出しが読めた日はこちらで当てる）
    '振込金額', '預金種別', '口座名義', '銀行名', '支店名', '普通預金', '金融機関',
    // ── 中国語（簡体・繁体）
    '工号', '员工编号', '員工編號', '职工号', '職工號', '雇员编号',
    '账号', '帐号', '帳號', '账户', '帳戶', '开户行', '開戶行', '银行',
    '身份证', '身份證', '地址', '卡号', '卡號',
    // ── 韓国語
    '성명', '이름', '사번', '사원번호', '직원번호', '사원코드',
    '계좌', '계좌번호', '은행', '주소', '주민등록번호',
    // ── 英語・湾岸・米国・英連邦
    'name', 'surname', 'forename', 'firstname', 'lastname', 'fullname',
    'employee', 'emp', 'empno', 'staff', 'crew', 'payee', 'personnel',
    'payrollno', 'payrollnumber', 'employeeid', 'employeeno',
    'account', 'accountno', 'accountnumber', 'acctno', 'accno', 'acno',  // A/C No. の綴り揺れ
    'iban', 'swift', 'sortcode', 'bank', 'branch',
    'ssn', 'socialsecurity', 'address', 'dateofbirth', 'nationalid', 'passport', 'nino',
    // ── スペイン語
    'nombre', 'apellido', 'empleado', 'trabajador', 'cuenta', 'banco', 'sucursal',
    'domicilio', 'curp', 'rfc', 'nomina',
    // ── ポルトガル語
    'nome', 'sobrenome', 'funcionario', 'matricula', 'conta', 'agencia', 'endereco', 'cpf',
    // ── フランス語
    'nom', 'prenom', 'salarie', 'matricule', 'compte', 'banque', 'agence', 'adresse',
    'securitesociale',
    // ── ドイツ語
    'vorname', 'nachname', 'mitarbeiter', 'personalnummer', 'personalnr',
    'konto', 'kontonummer', 'anschrift', 'sozialversicherung',
    // ── イタリア語
    'cognome', 'dipendente', 'matricola', 'conto', 'banca', 'indirizzo', 'codicefiscale',
    // ── オランダ語
    'naam', 'medewerker', 'personeelsnummer', 'rekening', 'rekeningnummer', 'adres',
    'burgerservicenummer',
    // ── トルコ語
    'adsoyad', 'soyad', 'sicil', 'sicilno', 'hesap', 'hesapno', 'banka', 'tckimlik',
    // ── インドネシア語・マレー語
    /* ★'nik'（Nomor Induk Karyawan）は実測で足した語。インドネシアの明細は
       社員番号の見出しをこの3文字だけで印字する（"NIK 88213"）。
       'karyawan' は当たっても、見出しに出るのは略語のほうなので届かない。
       3文字なので labelHit は**先頭一致だけ**に落ちる＝他の語の途中には当たらない。 */
    'nama', 'nik', 'karyawan', 'pegawai', 'alamat', 'npwp',
    // ── ベトナム語（ラテン。アクセントは norm() で落ちる）
    'hoten', 'nhanvien', 'taikhoan', 'sotaikhoan', 'diachi',
    // ── ポーランド語・チェコ語・ルーマニア語
    'imie', 'nazwisko', 'pracownik', 'rachunek', 'pesel',
    'jmeno', 'prijmeni', 'zamestnanec', 'ucet',
    'nume', 'prenume', 'angajat', 'adresa',
    // ── 北欧
    'namn', 'navn', 'ansatt', 'anstalld', 'personnummer', 'henkilotunnus', 'tilinumero',
    // ── ロシア語ほかキリル文字
    'фамилия', 'имя', 'отчество', 'табельный', 'счет', 'банк', 'адрес', 'снилс',
    // ── アラビア語
    'الاسم', 'اسم', 'الموظف', 'الحساب', 'البنك', 'المصرف', 'العنوان',
    // ── タイ語・ヒンディー語・ギリシャ語・ヘブライ語
    'ชื่อ', 'รหัสพนักงาน', 'บัญชี', 'ธนาคาร', 'ที่อยู่',
    'नाम', 'कर्मचारी', 'खाता', 'बैंक', 'पता',
    'ονομα', 'επωνυμο', 'υπαλληλος', 'λογαριασμος', 'τραπεζα', 'διευθυνση',
    'שם', 'עובד', 'חשבון', 'בנק', 'כתובת',
  ];

  /* ラベルが読めなかったときの保険。値の**形**で拾う。
     金額と衝突しないよう、桁区切りのコンマ・小数点を含む語は先に外す。 */
  var PAT = [
    /^[A-Z]{2}\d{2}$/,                  // IBAN の先頭（AE44 0872 … の 1語目）
    /^x{2,}[-\s]?x{2,}[-\s]?\d{2,}$/i,  // 伏字の社会保障番号 XXX-XX-4417
    /^[A-Z]{0,4}-?\d{2,}-\d{3,}$/,      // 1207-88431 / EMP-40218 / A-2211-77
    /^\d{7,}$/,                         // 口座番号のような裸の長い数字
    /* 数字の並びに英字が1〜2字だけ付く社員番号（509143k / A0483321）。
       勤務時間の 118H45 と衝突しないよう、英字は**端にしか許さない**。 */
    /^\d{5,}[A-Za-z]{1,2}$/,
    /^[A-Za-z]{1,2}\d{5,}$/,
  ];

  /* 手がかり語を比べる前に、見た目の揺れを潰す。
     小文字化／全角→半角／**アクセント記号を外す**／区切り記号と空白を落とす。
     ★アクセントを外すのは多言語のためだけではない。OCR は é を e、ı を i と
       読み違える。外しておけば読み違えがそのまま当たりに変わる。 */
  function norm(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    s = s.replace(/[！-～]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); });
    s = s.toLowerCase();
    /* NFKD で分解 → 結合記号（アクセント）だけ落とす → **NFC で組み直す**。
       最後の組み直しが要る：ハングルは分解でチャモになり、
       そのままだと合成済みで書いた手がかり表と一致しなくなる（사원번호 が外れる）。

       ★互換の分解（NFKD）でないと駄目だった理由が実測で出た。
         PDF から取り出した「氏名」「銀行」「口座番号」は、字が
         **康熙部首**（⽒ ⾏ ⼝＝U+2F00 台）で入っていることがある。
         見た目は同じでも符号が違うので、素の比較では永久に外れる。
         PDF を作った側のフォントの都合で、こちらから直せない。
         互換の分解を通すと 氏 行 口 に戻る。全角の英数字・合字（ﬁ）・
         アラビア文字の表示形も同時に片付く＝多言語ぶんの穴がまとめて塞がる。 */
    if (s.normalize) s = s.normalize('NFKD').replace(/[̀-ͯ]/g, '').normalize('NFC');
    return s.replace(/[\s.,:;'"’`·・‐‑–—_\-()（）[\]{}/|]/g, '');
  }
  /* 手がかり表も**同じ norm() を通してから**使う。表の側だけ書き方が違って
     一致しない、という壊れ方を根から無くす。 */
  for (var li = 0; li < LABELS.length; li++) LABELS[li] = norm(LABELS[li]);

  /* ★途中一致を許す範囲が要。実在の日本の様式には「役職員番号」があり、
     手がかり表の「職員番号」より**前に1字ある**。先頭一致だけだと永久に外れる。
     いっぽうラテン文字の短い語を途中一致で見ると事故る
     （'emp' が 'exemption' に、'cont' が 'contribution' に当たる）。
     そこで**ラテン文字は先頭一致まで**にする（'kontonummer' の konto は当たる）。
     ★語の途中に埋もれた一致は、4字以上でも事故のほうが多い。実測：
       イタリア語の 'conto'（口座）がポルトガル語の 'descontos'（控除）に当たり、
       控除合計の行が丸ごと黒く塗られて、金額が読み取れず null になった
       （latam・2026-08-14）。黒塗りの誤爆は「個人情報が残る」より静かで、
       しかも本人が要る数字のほうを消す。語尾だけ許しても 'desconto' が残る。
     漢字・ハングル・アラビア文字などは2字でも十分に珍しいので途中一致でよい。 */
  function labelHit(low) {
    if (!low) return false;
    for (var i = 0; i < LABELS.length; i++) {
      var l = LABELS[i];
      if (low === l || low.indexOf(l) === 0) return true;
      /* 途中一致はラテン文字以外だけ（「役職員番号」の中の「職員番号」） */
      if (low.indexOf(l) > 0 && l.length >= 2 && !/[a-z]/.test(l)) return true;
    }
    return false;
  }

  function anchorKind(raw) {
    var s = String(raw || '').trim();
    if (!s) return null;
    if (/[,.]/.test(s)) return null;                        // 金額は手がかりにしない
    if (labelHit(norm(s))) return 'label';
    var half = s.replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); });
    for (var j = 0; j < PAT.length; j++) if (PAT[j].test(half)) return 'pattern';
    return null;
  }

  /* ★日本の明細は、2文字のラベルを全角空きで組む。「氏　名」「銀　行」「支　店」
     「口　座　番　号」——枠の幅に合わせるための、印刷屋の作法。
     tesseract は空白で語を切るので、これらは**1文字ずつ別の語**になって返る。
     語単位で LABELS と突き合わせている限り、'氏名' はどの語とも一致しない
     ＝日本の明細では永久に見つからない。実際にこれで外していた。
     隣り合う短い語をつなぎながら見る。つなぐのは3文字までの
     仮名・漢字・ハングルに絞る（英数字までつなぐと、金額の並びがラベルに化ける）。 */
  /* ★見るのは norm() を通したあとの字。生の字で見ると、PDF から来た
     康熙部首の「⾏」や、後ろに全角コロンが付いた「名：」で止まってしまい、
     そこから先が繋がらない＝氏名の行が丸ごと塗られないまま外へ出る。 */
  function isTiny(t) {
    return /^[぀-ヿ一-鿿豈-﫿가-힣]{1,3}$/.test(norm(t));
  }
  /* ★振込先のブロックだけに効かせる手がかり ────────────────────
     氏名の行では「値の終わりで止める」のが正しい（右に勤務時間の表が来る様式があり、
     行の右端まで塗ると時給が出せなくなる）。だが**振込先の行だけは違う**。
     紙の最下部で1本の帯を占めていて、その右にこのサイトが要るものは何も無い。
     だから銀行系のときだけ、止め方と枠の切り方を変える。表は LABELS の部分集合。 */
  var BANKY = [
    '口座', '振込', '銀行', '支店', '普通', '当座', '預金', '名義',
    'account', 'acctno', 'accno', 'acno', 'iban', 'swift', 'sortcode', 'bank', 'branch',
    '账号', '帐号', '帳號', '账户', '帳戶', '开户行', '開戶行', '银行',
    '계좌', '은행',
    'cuenta', 'banco', 'sucursal', 'conta', 'agencia', 'compte', 'banque', 'agence',
    'konto', 'kontonummer', 'banca', 'rekening', 'rekeningnummer', 'hesap', 'banka',
    'taikhoan', 'sotaikhoan', 'rachunek', 'ucet', 'tilinumero',
    'счет', 'банк', 'الحساب', 'البنك', 'المصرف', 'بنك',
    'บัญชี', 'ธนาคาร', 'खाता', 'बैंक', 'λογαριασμος', 'τραπεζα', 'חשבון', 'בנק',
  ];
  for (var bi = 0; bi < BANKY.length; bi++) BANKY[bi] = norm(BANKY[bi]);
  function bankish(raw) {
    var low = norm(raw);
    if (!low) return false;
    for (var i = 0; i < BANKY.length; i++) {
      var l = BANKY[i];
      if (low === l || low.indexOf(l) === 0) return true;
      if (low.indexOf(l) > 0 && (l.length >= 4 || (l.length >= 2 && !/[a-z]/.test(l)))) return true;
    }
    return false;
  }

  /* ★「用語のまわり」で塗る語かどうか。ここが表を守る歯止めになっている ────
     口座番号・支店番号・銀行コードは**桁区切りを持たない3桁以上の数字**。
     いっぽう表の金額（983,300）は必ず桁区切りを持ち、勤務時間（118H45・164:30）は
     必ず時刻の形をしている。だから外す条件を2つ置くだけで、
     「まわりの数字を塗る」を表の中で暴発させずに済む。
       ・振込金額（762,981）は桁区切りを持つので残る。同じ額を差引支給額として
         送っている以上、隠す意味が無い
       ・3桁未満を見ないのは、勤務日数の 12 や等級の 08-14 を残すため */
  function numish(t) {
    var s = String(t || '').replace(/[０-９]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
    });
    if (!/\d{3,}/.test(s)) return false;
    if (MONEY_SEP.test(s)) return false;                     // 表の金額
    if (TIMEH.test(s)) return false;                         // 勤務時間＝このサイトの中心
    return true;
  }

  /* ★用語の「まわり」の広さ。下と右に寄せてある ──────────────────
     振込先の値はラベルの**右**か**一段下**に来る。上と左には来ない。
       下 2.6 行 … OCR がこのブロックを2行3行に割ることがあるので、
                   「一段下」だけでは足りない
       右 0.50   … 銀行｜支店｜口座番号｜振込金額 が横一列に並ぶ様式で、
                   ラベルから4列右の値まで届く幅
     BN_MAX は暴走止め。用語1つにつき12語まで。 */
  var BN_DOWN = 2.6, BN_UP = 0.6, BN_RIGHT = 0.50, BN_LEFT = 0.06, BN_MAX = 12;
  function nearBox(ay0, ay1, ax0, ax1, pitch) {
    return {
      top: ay0 - pitch * BN_UP, bot: ay1 + pitch * BN_DOWN,
      lft: ax0 - BN_LEFT, rgt: ax1 + BN_RIGHT,
    };
  }

  /* ★「値だけの行」＝振込先の値の行。ラベルが1文字も読めなくても当たる ────
       0037   412   5207164   701,575     ← 項目名が1つも無い。数字だけ
     どの様式でもこの形をしている。frameFrom は前からこれを知っていて（数字しか無い
     行は枠の手がかりにしない）、その判定をここに括り出した。両方が同じ1つの規則を
     見るので、「枠は外したのに黒塗りは外す」というちぐはぐが起きない。

     3つを**すべて**みたすときだけ当てる。1つでも緩めると誤爆する：
       ① 項目名（数字と記号以外の字）が1語も無い
       ② 桁区切りの無い数字の連なりが6桁以上で、その中に3桁以上の語がある
          ＝OCR が「520 7164」と割っても、隣り合う数字語を足して見るので当たる。
          金額（701,575）は桁区切りを持つので、ここでは数えない
       ③ 紙の下半分にある。上半分の「2026 07 15」のような日付の行を巻き込まない */
  function valueOnlyRow(ws) {
    if (!ws || !ws.length) return false;
    var top = 1, run = 0, big = false;
    for (var i = 0; i < ws.length; i++) {
      var t = String(ws[i].t || '');
      if (/[^\d\s.,:\-\/()]/.test(t)) return false;           // ① 項目名がある＝表の行
      if (ws[i].y0 < top) top = ws[i].y0;
    }
    if (top <= 0.45) return false;                            // ③ 紙の上半分は見ない
    for (var k = 0; k < ws.length; k++) {
      var s = String(ws[k].t || '')
        .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); });
      if (MONEY_SEP.test(s)) { run = 0; big = false; continue; }   // ② 金額は数えない
      var d = (s.match(/\d/g) || []).length;
      if (!d) { run = 0; big = false; continue; }
      run += d;
      if (d >= 3) big = true;
      if (run >= 6 && big) return true;
    }
    return false;
  }

  /* ★PDF の文字の層は、合字（ﬀ ﬁ ﬂ）のところで語を割って返す。実測（gulf の PDF）：
       [Sta][ff][No] 418822 ／ [Pro][fi][t] Share
     印刷では1語なので、割れ目には**空白が無い**（前の語の右端＝次の語の左端）。
     だから空白の無い切れ目だけを継ぐ。空白のある切れ目まで広げると、隣の語を
     飲み込んで手がかりが水増しされる。ラテン文字に絞るのは、これがラテン字形の
     フォントの都合だからで、仮名・漢字の側は上の isTiny が受け持つ。

     これを入れるまで、gulf の PDF は 'Sta' も 'ff' も手がかりに当たらず、
     右隣の社員番号 418822 がそのまま外へ出ていた（PNG では合字が起きないので
     同じ紙なのに PDF だけ落ちる、という気づきにくい壊れ方をしていた）。 */
  var GLUE_GAP = 0.0015;          // 紙の幅に対する割合。空白1つは実測で 0.004 以上ある
  function glueHit(ws, i) {
    if (!/^[A-Za-z]+$/.test(ws[i].t)) return -1;
    var s = ws[i].t;
    for (var j = i + 1; j < ws.length && j - i < 4; j++) {
      if (ws[j].c < OCR_MINCONF) break;
      if (!/^[A-Za-z]+$/.test(ws[j].t)) break;
      if (ws[j].x0 - ws[j - 1].x1 > GLUE_GAP) break;       // ここに空白がある＝別の語
      s += ws[j].t;
      if (labelHit(norm(s))) return j;
    }
    return -1;
  }

  function lineAnchors(ws) {
    var out = [];
    for (var i = 0; i < ws.length; i++) {
      if (ws[i].c < OCR_MINCONF) continue;
      var k = anchorKind(ws[i].t);
      if (k) { out.push({ i: i, j: i, kind: k }); continue; }
      var g = glueHit(ws, i);
      if (g > i) { out.push({ i: i, j: g, kind: 'label' }); i = g; continue; }
      if (!isTiny(ws[i].t)) continue;
      var s = ws[i].t;
      for (var j = i + 1; j < ws.length && j - i < 5; j++) {
        if (!isTiny(ws[j].t)) break;
        s += ws[j].t;
        if (labelHit(norm(s))) {
          out.push({ i: i, j: j, kind: 'label' });
          /* ★当たった語の**内側から**もう一度拾わない。
             「銀 行 支 店」で '行支店' が '支店' を含んで二重に当たると、
             手がかりの数が水増しされて見出し行の判定（下の isHdr）が狂う。 */
          i = j;
          break;
        }
      }
    }
    return out;
  }

  /* 字形の学習データは**そのぶん重い**ので、要る人にだけ足す。
     ラテン文字（西・葡・仏・独・伊・蘭・土・尼・越・波…）は eng で読めるので追加なし。
     読めない字形のときだけ、閲覧者の言語から1つだけ選ぶ
     （3つを超えると遅くなり、既存の日本語・英語の読みもむしろ落ちる）。 */
  var SCRIPT_PACK = [
    [/^zh[-_]?(tw|hk|mo)/, 'chi_tra'], [/^zh/, 'chi_sim'], [/^ko/, 'kor'],
    [/^(ar|fa|ur|ps)/, 'ara'], [/^(ru|uk|be|bg|sr|kk|ky|mn)/, 'rus'],
    [/^th/, 'tha'], [/^(hi|mr|ne)/, 'hin'], [/^el/, 'ell'], [/^(he|iw)/, 'heb'],
  ];
  function extraLang() {
    var want = [];
    try {
      want = (navigator.languages || [navigator.language || '']).slice(0, 4).concat(
        document.documentElement.getAttribute('lang') || []);
    } catch (e) { return null; }
    for (var i = 0; i < want.length; i++) {
      var t = String(want[i] || '').toLowerCase();
      for (var j = 0; j < SCRIPT_PACK.length; j++) {
        if (SCRIPT_PACK[j][0].test(t)) return SCRIPT_PACK[j][1];
      }
    }
    return null;
  }

  /* OCR の結果を「行」に均す。行は語の集まりで、どのブロック（＝段・列）に
     属していたかを持つ。帯の右端をブロックの右端で止めるのに使う。
     blocks が取れない版に落ちたときは、語1つを1行として扱う（＝従来どおり）。 */
  function readLines(r, cw, ch) {
    var out = [];
    var mk = function (w2) {
      var t = String(w2.text || '').trim();
      if (!t || !w2.bbox) return null;
      return {
        t: t, c: typeof w2.confidence === 'number' ? w2.confidence : 100,
        x0: w2.bbox.x0 / cw, y0: w2.bbox.y0 / ch,
        x1: w2.bbox.x1 / cw, y1: w2.bbox.y1 / ch,
      };
    };
    (r.data.blocks || []).forEach(function (b) {
      var bx1 = b.bbox ? b.bbox.x1 / cw : 1;
      (b.paragraphs || []).forEach(function (p) {
        (p.lines || []).forEach(function (l) {
          var ws = [];
          (l.words || []).forEach(function (w2) { var n = mk(w2); if (n) ws.push(n); });
          if (ws.length) out.push({ bx1: bx1, w: ws });
        });
      });
    });
    if (!out.length) {
      (r.data.words || []).forEach(function (w2) {
        var n = mk(w2);
        if (n) out.push({ bx1: 1, w: [n] });
      });
    }
    return out;
  }

  var ocrLib = null;
  function loadOcr() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (ocrLib) return ocrLib;
    ocrLib = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = OCR_JS;
      s.onload = function () { window.Tesseract ? res(window.Tesseract) : rej(new Error('ocr')); };
      s.onerror = function () { ocrLib = null; rej(new Error('cdn')); };
      document.head.appendChild(s);
    });
    return ocrLib;
  }

  /* 行の間隔を測る。帯の高さをこれで決める。
     文字のインクの高さで決めると、表のセルの余白まで届かず値がはみ出す。 */
  function linePitch(ws) {
    var tops = ws.map(function (w) { return (w.y0 + w.y1) / 2; }).sort(function (a, b) { return a - b; });
    var gaps = [];
    for (var i = 1; i < tops.length; i++) {
      var g = tops[i] - tops[i - 1];
      if (g > 0.004) gaps.push(g);                          // 同じ行の語どうしは数えない
    }
    if (!gaps.length) return 0.03;
    gaps.sort(function (a, b) { return a - b; });
    return gaps[Math.floor(gaps.length / 2)];
  }

  /* 行の集まりから黒塗りの矩形を作る。
     ★OCR の読みでも、PDF の文字の層でも、**同じここを通す**。
       経路ごとに作り方を分けると、片方だけ直って片方だけ壊れるようになる。 */
  function buildRects(lines) {
    var allWords = [];
    lines.forEach(function (ln) { allWords = allWords.concat(ln.w); });
    if (!allWords.length) return [];
    var pitch = linePitch(allWords);

    /* 行の外枠だけを先に控える。見出し行の帯を「一段下」まで伸ばすのに使う。 */
    var boxes = lines.map(function (ln) {
      var b = { y0: 1, y1: 0, x0: 1, x1: 0 };
      ln.w.forEach(function (w2) {
        if (w2.y0 < b.y0) b.y0 = w2.y0;
        if (w2.y1 > b.y1) b.y1 = w2.y1;
        if (w2.x0 < b.x0) b.x0 = w2.x0;
        if (w2.x1 > b.x1) b.x1 = w2.x1;
      });
      return b;
    });
    /* ★どこまで下へ伸ばすかを、ページ全体の行送りの中央値から見積もると足りない。
       同じ様式でも紙の縦横比が変われば中央値は動くのに、値の行の位置は動かない。
       見積もらずに**次の行が実際どこにあるか**を見て、その行の下端まで塗る。
       横に重なる行だけを見る＝隣の段の行に引っぱられない。 */
    function nextBottom(ly1, x, right) {
      var bot = 0, top = 2;
      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i];
        if (b.y0 <= ly1 || b.y0 - ly1 > pitch * 3) continue;
        if (b.x1 < x || b.x0 > right) continue;
        if (b.y0 < top) { top = b.y0; bot = b.y1; }
      }
      return bot;
    }
    var padY = Math.min(0.05, Math.max(0.012, pitch * 0.5));
    var out = [];
    lines.forEach(function (ln) {
      var an = lineAnchors(ln.w);

      var ly0 = 1, ly1 = 0, lx0 = 1, lx1 = 0;
      ln.w.forEach(function (w2) {
        if (w2.y0 < ly0) ly0 = w2.y0;
        if (w2.y1 > ly1) ly1 = w2.y1;
        if (w2.x0 < lx0) lx0 = w2.x0;
        if (w2.x1 > lx1) lx1 = w2.x1;
      });
      if (ly1 - ly0 > 0.12) return;                       // 誤検出の巨大な行

      /* ★4-a「値だけの行」は、手がかりが1つも無くても行ごと塗る。
         見出し（銀行｜支店｜口座番号｜振込金額）が1文字も読めなかった日でも、
         値の行そのものの**形**は変わらない。ラベルの読みに賭けない道をもう1本持つ。
         右端まで塗るのは、この行の右にこのサイトが要るものが無いから
         （項目名が1語も無い＝表の行ではない、と ① で確かめたうえでの話）。 */
      if (valueOnlyRow(ln.w)) {
        var vx = Math.max(0, lx0 - 0.01);
        out.push({
          x: Math.round(vx * W), y: Math.round(Math.max(0, ly0 - padY) * H),
          w: Math.round((1 - vx) * W), h: Math.round((Math.min(1, ly1 + padY) - Math.max(0, ly0 - padY)) * H),
        });
        return;                                           // 数字だけの行に手がかりは無い
      }
      if (!an.length) return;

      /* ★表の見出し行は、値が右ではなく**一段下**にある。
         日本の明細の最下部にある振込先の表がまさにこれ：
           銀 行 ｜ 支 店 ｜ 口 座 番 号 ｜ 振 込 金 額     ← 見出し
           0009  ｜ 200  ｜ 3100343    ｜ 762,981        ← 値（これが口座番号）
         見出しの行だけ塗っても、口座番号はそのまま外へ出る。

         見分け方は「ラベルらしさの割合」ではなく**数字が1つも無いこと**。
         割合で見ると落ちる：上の見出しは OCR が1文字ずつに割るので12語になり、
         そのうち語として繋がるのは「銀行」「支店」の4語だけ（口座番号は
         「ロロ座番号」と読まれて繋がらない）＝33%。それでも見出しには違いない。
         値のある行は必ず数字を持つので、そちらを見るほうが確実で崩れにくい。 */
      var hasNum = ln.w.some(function (w2) { return /\d{2,}/.test(w2.t); });
      var isHdr = an.length >= 2 && !hasNum;

      /* ★4-e 身元のかたまり ────────────────────────────────
         紙の頭では、氏名・社員番号・所属・職位が**縦に接して**並ぶ。
         実測（jp-lcc）：右上に「佐藤　健一 ／ EMP-40218 ／ FO / A320」の3行。
         このうち OCR が読めたのは EMP-40218 だけで、氏名は1文字も返ってこない
         （12px・罫線なし・右寄せ）。読めない行に手がかりは立たないので、
         行ごとに見ているかぎり氏名は永久に塗られない。以前は上端の帯が
         偶然それを覆っていた。帯を廃止したので、ここを名指しで塗る。

         当たった行の**すぐ上**へ一段ぶん広げる。広げてよいと言える条件を3つ置く：
           ① 紙の上から2割の中にある（表の中では起きない）
           ② その行の語が5つ以下＝身元のかたまりの行。表の行はもっと語が多い
           ③ 桁区切りの金額を持たない＝支給の行ではない
         横は当たった手がかりの幅のままなので、帯にはならない（左の年月・
         会社名には届かない）。上に伸ばすだけにするのは、氏名が社員番号の
         **上**に来る並びが圧倒的に多いのと、下へ広げると解析に要る値
         （keep で固定してある勤務時間の欄）へ届きうるから。 */
      var headBlock = ly0 < 0.2 && ln.w.length <= 5
        && !ln.w.some(function (w2) { return MONEY_SEP.test(w2.t); });

      /* 語と語の隙間が、この幅を超えたら「別の列」とみなす。
         固定値では決められない。**その行にある隙間の大きさに合わせる**。
           Position Allowance 12,000 ┊ Staff No · 507331
         左右2段の様式では、段と段の隙間（┊）がいちばん大きく、
         ラベルと値の隙間（·）はそれより小さい。固定のしきい値だと後者でも切れて、
         社員番号が塗られないまま外へ出る。行の最大の隙間を基準に測れば、
         「段の切れ目」だけで止まり「ラベルと値の間」では止まらない。
         字送りは行の高さに比例するので下限だけそこから取る
         （x と y は割る辺が違うので、px に戻してから W で割り直す）。 */
      var lineH = (ly1 - ly0) * H;
      var maxGap = 0;
      for (var g = 1; g < ln.w.length; g++) {
        var gp = ln.w[g].x0 - ln.w[g - 1].x1;
        if (gp > maxGap) maxGap = gp;
      }
      var colGap = Math.max(0.02, 1.2 * lineH / W, maxGap * 0.6);

      an.forEach(function (a) {
        var x = Math.max(0, ln.w[a.i].x0 - 0.01);
        /* 右端は**値の終わりまで**。行の右端でも画像の右端でもない。
           行の右端まで塗ると、左に氏名・右に勤務時間表という実在の様式で
           時間の列ごと潰れ、時給（このサイトの中心）が出せなくなる。
           ラベルの右の語を順に足していき、列の切れ目（大きな隙間）で止める。
           ただし**値を1つも取り込む前の隙間では止めない**。
           「氏名」のセルが広くて名前がずっと右にある様式があり、
           そこで止めると名前が塗られないまま外へ出る＝失敗の向きが逆で重い。 */
        /* 形で拾った手がかり（7桁の数字・IBAN 等）は**それ自体が値**なので、
           右へ伸ばす必要がない。伸ばすと、実在の密な様式で
             役職員番号 12-345678 ┊ 休日時間 深夜時間 乗務時間 不就労時間
           の見出しごと潰れ、値は残るのに何の時間か分からなくなる。
           ただし IBAN のように**数字が空白で分かち書きされる**ことがあるので、
           数字を含む語が続く間だけは拾う。 */
        var isPat = a.kind === 'pattern';
        /* ★4-b 銀行系のときだけ、列の切れ目で止めずに**行の右端まで**塗る。
           振込先は紙の最下部で1本の帯を占めていて、
             銀 行 ｜ 支 店 ｜ 口 座 番 号 ｜ 振 込 金 額
           のように4つの列が並ぶ。列の切れ目で止めると「銀行」の欄しか塗られず、
           口座番号は2つ隣の列にあるのでそのまま外へ出る（実測でこれが起きていた）。
           他のラベル（氏名・社員番号）で同じことをしてはいけない：右に勤務時間の
           表が来る様式があり、潰すと時給が出せなくなる。だからここだけ。 */
        var atext = '';
        for (var ai = a.i; ai <= a.j; ai++) atext += ln.w[ai].t;
        var isBank = a.kind === 'label' && bankish(atext);
        var right = ln.w[a.j].x1;
        var took = 0;
        for (var k = a.j + 1; k < ln.w.length; k++) {
          if (isPat && !/\d/.test(ln.w[k].t)) break;
          if (!isBank && (took || isPat) && ln.w[k].x0 - ln.w[k - 1].x1 > colGap) {
            /* 列の境目は**隙間の真ん中**に置く。インクの右端で止めると、
               語の後ろの余白（全角空き・セルの余裕）に値の一部が残る。 */
            right = (ln.w[k - 1].x1 + ln.w[k].x0) / 2;
            took = -1;                                        // 境目で止めた印
            break;
          }
          right = ln.w[k].x1;
          took++;
        }
        if (took >= 0) right = Math.min(1, right + 0.02);      // 行の終わりまで来た
        if (isBank) right = 1;                                 // 4-b：振込先の帯は右端まで
        /* ラベルの右に語が1つも無かったときだけ最低幅を持たせる
           ＝値が読めなかった場合の保険。形で拾ったときは値そのものなので要らない。 */
        if (!isPat && !took && right < x + 0.28) right = Math.min(1, x + 0.28);
        if (right > 0.92) right = 1;                           // 端の枠線・余白の取りこぼし
        var top = Math.max(0, ly0 - padY);
        if (headBlock) top = Math.max(0, Math.min(top, ly0 - pitch * 2));
        var bot = ly1 + padY;
        if (isHdr) {
          var nb = nextBottom(ly1, x, right);
          bot = Math.max(bot, nb ? nb + padY : ly1 + padY + pitch * 1.4);
        }
        bot = Math.min(1, bot);
        out.push({
          x: Math.round(x * W), y: Math.round(top * H),
          w: Math.round((right - x) * W), h: Math.round((bot - top) * H),
        });
      });
    });

    /* ★用語の「まわりの数字」を塗る ────────────────────────────────
       上の処理は**行に縛られている**。銀行系の語に当たっても、塗るのは
       その語と同じ行だけ。だが振込先はこう組まれる：

         銀 行 ｜ 支 店 ｜ 口 座 番 号 ｜ 振 込 金 額     ← 見出し
         0009  ｜ 200  ｜ 3100343    ｜ 762,981        ← 値（これが口座番号）

       **値は別の行にある。** 一段下まで伸ばす isHdr は「数字が1つも無い行」の
       ときしか効かないので、見出しに支店番号や西暦が混じった瞬間に外れる。
       OCR がこのブロックを2つ3つの行に割ることもあり、そのたびに外れる。

       だから行のまとまりを離れて、**用語のまわりを直接見る**。
       値が一段下にあっても・4列右にあっても・行が割れていても、
       「用語のまわり」であることは変わらない。
       口座番号が 5207164 → 520 7164 と割れて読まれても、1語ずつ塗るので両方消える
       ＝割れた数字をつなぎ直す処理は要らない。

       ★表を巻き込まないための歯止めは numish（桁区切り・時刻を外す）。
       広さは nearBox。 */
    /* ★当たった語は**印を付けるだけ**にして、塗るのは最後に1回。
       「銀行」「支店」「口座番号」「振込金額」は隣り合っているので、
       素直に塗ると同じ数字を4回ずつ塗ることになる。画素は同じでも、
       画面には黒い四角が4枚重なり、消す✕も4つ並ぶ＝人の確認をむしろ邪魔する。 */
    var near = {};
    lines.forEach(function (ln) {
      lineAnchors(ln.w).forEach(function (a) {
        if (a.kind !== 'label') return;
        var s = '', ay0 = 1, ay1 = 0;
        for (var q = a.i; q <= a.j; q++) {
          s += ln.w[q].t;
          if (ln.w[q].y0 < ay0) ay0 = ln.w[q].y0;
          if (ln.w[q].y1 > ay1) ay1 = ln.w[q].y1;
        }
        if (!bankish(s)) return;
        var b = nearBox(ay0, ay1, ln.w[a.i].x0, ln.w[a.j].x1, pitch);
        var n = 0;
        for (var k = 0; k < allWords.length && n < BN_MAX; k++) {   // BN_MAX＝暴走止め
          var w2 = allWords[k];
          if (w2.y1 < b.top || w2.y0 > b.bot) continue;
          if (w2.x1 < b.lft || w2.x0 > b.rgt) continue;
          if (!numish(w2.t)) continue;                      // 塗るのは桁区切りの無い3桁以上だけ
          n++;
          near[k] = 1;
        }
      });
    });
    Object.keys(near).forEach(function (k) {
      var w2 = allWords[k];
      var ry0 = Math.max(0, w2.y0 - padY), ry1 = Math.min(1, w2.y1 + padY);
      var rx0 = Math.max(0, w2.x0 - 0.006), rx1 = Math.min(1, w2.x1 + 0.006);
      out.push({
        x: Math.round(rx0 * W), y: Math.round(ry0 * H),
        w: Math.round((rx1 - rx0) * W), h: Math.round((ry1 - ry0) * H),
      });
    });
    return out;
  }

  // ════════════════════════════════════════════════════════
  // ②-C 送る枠（keep-frame）＝ 問題を有界にする
  //
  //    これまでは「個人情報を見つけて黒く塗る」だった。それは**終わらない問題**で、
  //    様式が1つ増えるたびに必ずどこかが漏れる。しかも漏れは黙って起きる。
  //
  //    実測（db/fixtures の jp-full と jp-full-small）：
  //      紙の作りが1バイトも同じでも、元画像の画素を 0.62 倍にするだけで
  //      最下部の「銀行／支店／口座番号」が1文字も読めなくなり、そのまま外へ出た。
  //      OCR は内部で 2800px まで引き伸ばしているが、**引き伸ばしても情報は増えない**。
  //      ＝検出をどれだけ賢くしても直らない。物理的な限界。
  //
  //    そこで向きを反転する。**解析に要るところだけを枠で囲い、外は切り落とす。**
  //    切り落とされたものは、検出できていようがいまいが端末から出ない。
  //    人間に求める判断も「全部の個人情報を見つけられたか？」ではなく
  //    「枠の位置は合っているか？」になる＝一目で確実にできる判断に変わる。
  //
  //    枠の中はこれまで通り黒く塗る（左に氏名・右に支給内訳という様式があるため）。
  // ════════════════════════════════════════════════════════
  /* 3桁区切りの数字（区切りは , . と各種の空白）か、4桁以上の数字。
     区切りの空白は見えない字なので、混同しないよう番号で書く。 */
  var MONEY = /\d{1,3}(?:[.,\u00a0\u2009 ]\d{3})+|\d{4,}/;
  /* ★桁区切りのある金額だけを見る狭いほう。ただの4桁の数字（西暦・社員番号・
     支店番号）と、表の金額とを分けるのに使う。区切りは , . と各種の空白。 */
  var MONEY_SEP = /\d{1,3}(?:[.,\u00a0\u2009 ]\d{3})+/;
  var TIMEH = /\d{1,3}\s*[hH:：時]\s*\d{2}/;
  /* ★小数で書かれた時間（168.5／78.2／12.0）。2026-08-14 の実測で足した。
     それまで枠の手がかりは「3桁区切りの金額」と「120H30 形式の時刻」だけで、
     **小数の勤務時間はどちらにも当たらなかった**。
     結果 jp-major では枠の下端が勤怠表の1行上で切れ、
     総勤務時間 168.5／乗務時間 78.2／深夜時間 12.0 が**そもそも送られていなかった**。
     モデルが読み違えたのではなく、絵に入っていない。時給が出せない＝この道具の中心が消える。

     小数点以下は1〜2桁まで。金額（1,043,000）は MONEY_SEP が拾うのでここでは要らず、
     両端を留めてあるので欧州式の金額（8.450,00）もこの形には当たらない。
     ★これ単体では手がかりにしない。**同じ行に項目名がある**ことを併せて見る。
       数字しか無い行を手がかりにすると、振込先の値の行（0037 412 5207164 701,575）で
       枠が紙の下端まで伸びて口座番号を連れて行く。金額の行とまったく同じ扱いにしている。 */
  var TIMEDEC = /^\d{1,3}[.,]\d{1,2}$/;

  function fullFrame() { return { x: 0, y: 0, w: W, h: H }; }
  /* 枠が実質「紙ぜんぶ」か。警告を出すかどうかはこれ1つで決める。 */
  function frameIsWhole() {
    var f = frame || fullFrame();
    return (f.w / W) * (f.h / H) > 0.995;
  }

  /* 手がかりの行から枠を決める。取れなければ null（呼ぶ側が画像全体へ倒す）。
     ★buildRects と同じ lines を食べる＝OCR でも PDF でも同じ規則で置かれる。 */
  function frameFrom(lines) {
    frameDiag = { pitch: 0, sig: 0, runs: [], why: '', cut: 0 };
    var all = [];
    lines.forEach(function (ln) { all = all.concat(ln.w); });
    if (all.length < 8) { frameDiag.why = '語が8未満'; return null; }
    var pitch = linePitch(all);
    frameDiag.pitch = pitch;

    /* 枠の手がかりは「金額の行」と「時間の行」だけ。解析に要るのもそこだけ。
       ★金額の行は「3桁区切りの数字がある」では足りない。**数字しか無い行**は
         振込先の値の行（0037 412 5207164 701,575）そのもので、これを手がかりに
         すると枠が紙の下端まで伸びて口座番号を連れて行く。
         項目名（数字でない語）と金額が同じ行に並ぶのが明細の表の形なので、そこで見る。 */
    var sig = [], cell = [];
    lines.forEach(function (ln) {
      var money = false, time = false, word = false, sep = false, dec = false;
      ln.w.forEach(function (w2) {
        var t = w2.t || '';
        if (MONEY.test(t)) money = true;
        if (MONEY_SEP.test(t)) sep = true;
        if (TIMEH.test(t)) time = true;
        if (TIMEDEC.test(t)) dec = true;
        if (/[^\d\s.,:\-\/()]/.test(t)) word = true;
      });
      /* 小数の時間は「項目名と並んでいる」ときだけ強い。金額の行と同じ条件。 */
      var b = { y0: 1, y1: 0, x0: 1, x1: 0, strong: sep || time || (dec && word) };
      ln.w.forEach(function (w2) {
        if (w2.y0 < b.y0) b.y0 = w2.y0;
        if (w2.y1 > b.y1) b.y1 = w2.y1;
        if (w2.x0 < b.x0) b.x0 = w2.x0;
        if (w2.x1 > b.x1) b.x1 = w2.x1;
      });
      if (b.y1 - b.y0 > 0.12) return;                     // 誤検出の巨大な行
      if ((money && word) || time || (dec && word)) { sig.push(b); return; }
      if (sep) cell.push(b);
    });
    /* ★数字だけの行を、**すでに手がかりになった行と縦に重なるとき**だけ拾う。
       PDF の文字の層では「5,914,300」と「円」が別々の行として入っていることがあり、
       どちらも上の規則を通らない（片方に項目名が無く、片方に金額が無い）。
       そのままだと累積課税支給額の**値の列だけ**が枠の右外に落ちる。
       縦に重なることを条件にしているので、紙の下端にぽつんとある振込先の行
       （0037 412 5207164 701,575）は拾わない。重なる手がかりの行がそこには無い。
       重なりを見るのは**この時点の** sig だけ＝拾ったものから芋づるに広がらない。 */
    var base = sig.slice();
    cell.forEach(function (b) {
      for (var k = 0; k < base.length; k++) {
        if (b.y0 < base[k].y1 && base[k].y0 < b.y1) { sig.push(b); return; }
      }
    });
    frameDiag.sig = sig.length;
    if (sig.length < 4) { frameDiag.why = '候補行が4未満'; return null; }
    sig.sort(function (a, b) { return a.y0 - b.y0; });

    /* ★縦に続いているものだけを束にする。まず**4行以上の束**だけを土台にして、
       孤立した行はいったん全部捨てる。枠を有界にしているのはここ。
       紙の下端にぽつんとある振込先の表が枠に入らないのは、金額らしく見えても
       4行の束にならず、下の「拾い直し」の2条件にも当たらないから。 */
    var runs = [], cur = [sig[0]];
    for (var i = 1; i < sig.length; i++) {
      if (sig[i].y0 - cur[cur.length - 1].y0 <= pitch * 3) cur.push(sig[i]);
      else { runs.push(cur); cur = [sig[i]]; }
    }
    runs.push(cur);
    var agg = runs.map(function (r) {
      var d = { n: r.length, y0: 1, y1: 0, x0: 1, x1: 0, strong: false, kept: r.length >= 4, add: false };
      r.forEach(function (b2) {
        if (b2.y0 < d.y0) d.y0 = b2.y0;
        if (b2.y1 > d.y1) d.y1 = b2.y1;
        if (b2.x0 < d.x0) d.x0 = b2.x0;
        if (b2.x1 > d.x1) d.x1 = b2.x1;
        if (b2.strong) d.strong = true;
      });
      return d;
    });
    frameDiag.runs = agg;
    var keep = agg.filter(function (d) { return d.kept; });
    if (!keep.length) { frameDiag.why = '4行以上の束が無い'; return null; }

    /* 残った束は**すべて**囲う。いちばん大きい束だけを採ると、支給内訳から
       少し離れた勤務時間の表が枠の外に落ちて時給が出せなくなる。
       枠は狭いほど個人情報は減るが、**推測で狭めない**のが安全側
       （狭めすぎの失敗は「読めない」で済むが、広すぎの失敗は本人が直せる）。 */
    var box = { x0: 1, y0: 1, x1: 0, y1: 0 };
    function absorb(d) {
      if (d.x0 < box.x0) box.x0 = d.x0;
      if (d.y0 < box.y0) box.y0 = d.y0;
      if (d.x1 > box.x1) box.x1 = d.x1;
      if (d.y1 > box.y1) box.y1 = d.y1;
    }
    keep.forEach(absorb);

    /* ★束にならなかった1〜3行を、表の続きとして拾い直す。
       勤務時間の表（118H45／深夜時間／乗務時間／57H00）と累積課税支給額の行は、
       明細では**数行しかない**ので「4行以上の束」には決してならない。
       落としたままだと時給が出せない＝この道具の中心の値が枠の外で消える。

       拾うのは2つを**両方**みたす束だけ：
         ① 表の行らしいこと＝桁区切りのある金額か時刻の形を持つ（強）。
            これで、西暦しか持たない見出しの行（氏名が載っている）と、
            最下部の人事ブロックが落ちる。実測：jp-footer の
            「氏名／社員番号／◯◯銀行 …」の束は弱、jp-twocol の見出しも弱。
         ② すでに決まった枠から**行送り5つ**より離れていないこと。
       しきい値は勘で決めていない。要る側の最遠が pdf-jp の勤務時間表で
       4.4行ぶん、落としたい側の最近が jp-footer の人事ブロックで4.8行ぶん
       （こちらは①で先に落ちる）。あいだを取って5。
       拾ったぶんからさらに伸ばせるので、表→勤務時間→課税額と数珠つなぎに届く。 */
    var grew = true;
    while (grew) {
      grew = false;
      agg.forEach(function (d) {
        if (d.kept || !d.strong) return;
        if (d.y0 - box.y1 > pitch * 5 || box.y0 - d.y1 > pitch * 5) return;
        d.kept = true; d.add = true; absorb(d); grew = true;
      });
    }

    // 行送りの1.5倍だけ外へ広げる（罫線と見出しの1行ぶん）。x と y は割る辺が違う
    var padY = pitch * 1.5, padX = padY * H / W;
    var x0 = Math.max(0, box.x0 - padX), x1 = Math.min(1, box.x1 + padX);
    var y0 = Math.max(0, box.y0 - padY), y1 = Math.min(1, box.y1 + padY);

    /* ★行を**半分だけ**切らない ─────────────────────────────────
       下端が1行の途中に落ちると、その行の値だけが送る画像から消える。
       実測（eu-de）：勤務時間の行「Blockstunden 78,2 / Dienststunden 164,5」は
       見出し「Zeiten」と1行に混ざって信頼0で返り、数字として読めていない。
       読めていない以上その行は候補にならず、下端はその行の**真ん中**で止まり、
       時間だけが枠の外に落ちていた（＝時給が出せない）。
       読めた行の**上端が枠の中にある**なら、その行は最後まで入れる。
       伸ばす量は行送り1.5個ぶんまで＝1行を通す幅で、下に別の行があっても届かない。
       ★これは4-d（振込先の行の上で切る）より**先**に置く。伸ばした先が
         振込先の行なら、4-d がそのまま上へ切り戻す（緩める方向には働かない）。 */
    lines.forEach(function (ln) {
      if (!ln.w.length) return;
      var t0 = 1, t1 = 0;
      ln.w.forEach(function (w2) {
        if (w2.y0 < t0) t0 = w2.y0;
        if (w2.y1 > t1) t1 = w2.y1;
      });
      if (t1 - t0 > 0.12) return;                        // 誤検出の巨大な行
      if (t0 <= y0 || t0 >= y1 || t1 <= y1) return;      // 途中で切れていない行は触らない
      if (t1 - y1 > padY) return;                        // 1行ぶんより遠くへは伸ばさない
      y1 = Math.min(1, t1);
    });

    /* ★4-d 枠の下端を、振込先の行の**上**で切る ────────────────────
       ここが本命。**切り落としは黒塗りより強い**：composite() は枠で切ってから
       黒を焼くので、枠の外は塗れていようがいまいが端末を出ない。
       黒塗り（4-a・4-b・4-c）は読めた日にしか効かないが、こちらは
       「口座の行がそこにある」と分かれば、中身が1文字も読めなくても効く。

       枠に振込先が入ってしまう筋は2つあって、どちらも上で通ってくる：
         ・拾い直し（while (grew)）が、振込金額の桁区切りを見て表の続きと判断する
         ・padY = pitch*1.5 の余白が、すぐ下の1行を巻き込む
       ここで最後に落とす。見るのは**採用した束（box.y1）より下**の行だけなので、
       表そのものはこの規則では絶対に切れない。 */
    var cutTop = 2;
    lines.forEach(function (ln) {
      if (!ln.w.length) return;
      var t0 = 1, hasBank = false;
      ln.w.forEach(function (w2) { if (w2.y0 < t0) t0 = w2.y0; });
      if (t0 <= box.y1 || t0 >= y1) return;               // 表の中／枠の外は見ない
      lineAnchors(ln.w).forEach(function (a) {
        if (a.kind !== 'label') return;
        var s = '';
        for (var q = a.i; q <= a.j; q++) s += ln.w[q].t;
        if (bankish(s)) hasBank = true;
      });
      if (!hasBank && !valueOnlyRow(ln.w)) return;
      if (t0 < cutTop) cutTop = t0;
    });
    if (cutTop < 2) {
      /* 表の下端より上には決して上げない（上げると明細そのものが切れて読めなくなる）。 */
      y1 = Math.max(box.y1, Math.min(y1, cutTop - pitch * 0.3));
      frameDiag.cut = 1;
    }

    /* 面積が1/4を切ったら「読み違いで縮んだ」とみなして採らない。
       明細の中身まで切り落とすと読み取りそのものが失敗する。 */
    if ((x1 - x0) * (y1 - y0) < 0.25) { frameDiag.why = '面積が1/4未満'; return null; }

    return {
      x: Math.round(x0 * W), y: Math.round(y0 * H),
      w: Math.round((x1 - x0) * W), h: Math.round((y1 - y0) * H),
    };
  }

  // ════════════════════════════════════════════════════════
  // ②-D 診断（?psdebug=1）
  //
  //    実物でしか出ない不具合は、これからも必ず出る。そのとき返ってくるのが
  //    「口座が塗られない」の一言だと、こちらは推測で直すしかなく、往復が終わらない。
  //    **何を読んで、何に当たって、なぜその枠になったか**をそのまま送れるようにする。
  //
  //    ★個人情報が**構造上**入らない形にしてある：
  //      ・語の字をそのまま出すのは、手がかり表（LABELS）に当たった語だけ。
  //        当たるのは「基本給」「口座番号」のような**様式の語**で、値ではない。
  //      ・当たらなかった語は「字の種類×長さ」だけ（漢字×3／latin×8／digit×7）。
  //      ＝氏名も社員番号も口座番号も、書きようが無い。画像も一切入らない。
  // ════════════════════════════════════════════════════════
  function charKind(s) {
    if (!s) return '空';
    if (/^\d+$/.test(s)) return 'digit';
    if (/^[a-z]+$/i.test(s)) return 'latin';
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(s)) return '漢字';
    if (/[\u3040-\u30ff]/.test(s)) return 'かな';
    if (/[\uac00-\ud7af]/.test(s)) return 'ハングル';
    if (/[\u0600-\u06ff]/.test(s)) return 'アラビア';
    if (/^[\d\s.,:;\-\/]+$/.test(s)) return '数記号';
    return 'その他';
  }
  function diagWord(w2) {
    var raw = String(w2.t || '');
    var low = norm(raw);
    if (low && labelHit(low)) return low;                   // 様式の語だけそのまま
    return charKind(raw) + '×' + raw.replace(/\s/g, '').length;
  }
  function f3(v) { return (Math.round(v * 1000) / 1000).toFixed(3); }

  /* 送れる形の文字列にする。呼ぶ側（画面のボタン・テスト）はこれを使う。 */
  function diagText() {
    var L = [];
    L.push('PILOT VALUE 明細診断（個人情報は構造上含みません）');
    if (ocrDiag) {
      L.push('元 ' + ocrDiag.src + ' → 読み ' + ocrDiag.ocr + '／' + (ocrDiag.lang || '?')
        + '／語 ' + ocrDiag.words + '（信頼 ' + ocrDiag.conf + '）／行 ' + ocrDiag.lines
        + '／手がかり ' + ocrDiag.hit + '／' + ocrDiag.ms + 'ms');
    }
    var f = frame || fullFrame();
    L.push('枠 ' + (frameAuto ? '自動' : '自動で置けず＝画像全体')
      + ' x ' + f3(f.x / W) + '..' + f3((f.x + f.w) / W)
      + ' y ' + f3(f.y / H) + '..' + f3((f.y + f.h) / H));
    if (frameDiag) {
      L.push('枠の内訳 行送り ' + f3(frameDiag.pitch) + '／候補行 ' + frameDiag.sig
        + '／束 ' + frameDiag.runs.length
        + (frameDiag.why ? '／採らなかった理由 ' + frameDiag.why : ''));
      frameDiag.runs.forEach(function (r, i) {
        L.push('  束' + (i + 1) + ' ' + (r.add ? '拾い直し' : r.kept ? '採用' : '不採用') + ' ' + r.n + '行'
          + (r.strong ? '・強' : '・弱') + ' y ' + f3(r.y0) + '..' + f3(r.y1)
          + ' x ' + f3(r.x0) + '..' + f3(r.x1));
      });
    }
    L.push('黒塗り ' + rects.length + ' 箇所');
    rects.forEach(function (r) {
      L.push('  x ' + f3(r.x / W) + '..' + f3((r.x + r.w) / W)
        + ' y ' + f3(r.y / H) + '..' + f3((r.y + r.h) / H));
    });
    L.push('読んだ行 ' + ((lineDiag && lineDiag.length) || 0));
    (lineDiag || []).forEach(function (ln) {
      L.push('  y ' + f3(ln.y0) + '..' + f3(ln.y1) + ' x ' + f3(ln.x0) + '..' + f3(ln.x1)
        + ' 信頼' + ln.c + '  ' + ln.w.join(' / '));
    });
    return L.join('\n');
  }

  /* 行を診断の形にして覚える。OCR でも PDF でも同じ場所を通る。 */
  function keepLineDiag(lines) {
    lineDiag = lines.map(function (ln) {
      var b = { x0: 1, y0: 1, x1: 0, y1: 0, c: 100 };
      ln.w.forEach(function (w2) {
        if (w2.x0 < b.x0) b.x0 = w2.x0;
        if (w2.y0 < b.y0) b.y0 = w2.y0;
        if (w2.x1 > b.x1) b.x1 = w2.x1;
        if (w2.y1 > b.y1) b.y1 = w2.y1;
        if (typeof w2.c === 'number' && w2.c < b.c) b.c = w2.c;
      });
      b.c = Math.round(b.c);
      b.w = ln.w.map(diagWord);
      return b;
    });
  }
  /* テストと、手元で確かめたい人のための口。中身は上と同じ＝画面と食い違わない。 */
  window.__psdiag = diagText;

  /* 黒塗り前の画像から手がかりを探す。返すのは work のピクセル座標の
     {rects:[矩形], frame:枠|null}。
     失敗・タイムアウトでは投げず、null を返す（呼ぶ側が文言を切り替える）。 */
  function findPii(bmp, pre) {
    var iw = (bmp && (bmp.width || bmp.naturalWidth)) || W;
    var ih = (bmp && (bmp.height || bmp.naturalHeight)) || H;

    /* ★PDF に文字の層があったときは、OCR を**一度も動かさない**。
       字を絵から推し量るのと、書いてある字をそのまま読むのとでは確かさが違う。
       読み違いが原理的に起きないので、社員番号を塗り残す余地もここでは無くなる。
       通す先（buildRects）は OCR と同じ＝経路が増えても塗り方の規則は1つのまま。 */
    if (pre && pre.length) {
      var plines = groupLines(pre);
      ocrDiag = {
        src: iw + '×' + ih, ocr: 'pdf(text)', words: pre.length,
        conf: pre.length, lines: plines.length, hit: 0, ms: 0, lang: 'pdf',
      };
      var pout = buildRects(plines);
      ocrDiag.hit = pout.length;
      keepLineDiag(plines);
      return Promise.resolve({ rects: pout, frame: frameFrom(plines) });
    }

    /* ★元画像から直接描き写す。work（1568px）からではない。
       拡大は3倍まで（4倍・5倍は実測で jpn がむしろ落ちた）。
       総画素の上限は縮小側にも効かせる＝スマホの4000px写真でメモリを飛ばさない。 */
    var scale = Math.min(Math.max(1, OCR_W / iw), Math.sqrt(OCR_MAXPX / (iw * ih)), 3);
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(iw * scale));
    c.height = Math.max(1, Math.round(ih * scale));
    var cx = c.getContext('2d');
    cx.imageSmoothingQuality = 'high';
    try { cx.drawImage(bmp || work, 0, 0, c.width, c.height); }
    finally { if (bmp && bmp.close) bmp.close(); }   // ImageBitmap まで落ちたときだけ効く
    ocrDiag = { src: iw + '×' + ih, ocr: c.width + '×' + c.height, words: 0, conf: 0, lines: 0, hit: 0, ms: 0 };
    var t0 = (window.performance && performance.now) ? performance.now() : 0;

    var worker = null;
    var langs = OCR_LANGS.concat(extraLang() || []);
    ocrDiag.lang = langs.join('+');
    var run = loadOcr().then(function (T2) {
      return T2.createWorker(langs).catch(function () {
        /* 足した字形の学習データが落ちてこないことがある。基本の2つで続ける
           ＝多言語のための追加で、既存の日本語・英語を道連れにしない。 */
        langs = OCR_LANGS;
        ocrDiag.lang = langs.join('+') + '(fallback)';
        return T2.createWorker(OCR_LANGS);
      });
    }).then(function (w) {
      worker = w;
      return w.setParameters({ tessedit_pageseg_mode: '3' });
    }).then(function () {
      return worker.recognize(c, {}, { blocks: true });
    }).then(function (r) {
      var lines = readLines(r, c.width, c.height);
      var allWords = [];
      lines.forEach(function (ln) { allWords = allWords.concat(ln.w); });
      ocrDiag.ms = Math.round(((window.performance && performance.now) ? performance.now() : 0) - t0);
      ocrDiag.words = allWords.length;
      ocrDiag.lines = lines.length;
      ocrDiag.conf = allWords.filter(function (w2) { return w2.c >= OCR_MINCONF; }).length;
      var out = buildRects(lines);
      ocrDiag.hit = out.length;
      keepLineDiag(lines);
      return { rects: out, frame: frameFrom(lines) };
    });

    return Promise.race([
      run,
      new Promise(function (res) { setTimeout(function () { res(null); }, OCR_MS); }),
    ]).then(function (v) {
      if (worker) worker.terminate();
      return v;
    }).catch(function () {
      if (worker) worker.terminate();
      return null;
    });
  }

  // ════════════════════════════════════════════════════════
  // ③ 本人が見る（プレビュー＝送られる画像）
  // ════════════════════════════════════════════════════════
  var stage, cv;

  /* ── 「原寸で確認する」の別窓は 2026-08-06 に**廃止**した ──────────
     方針判断（「原寸で確認するのボタンいらない」）。
     もともと必要だったのは、確認画面が本文の段組み（約640px）に閉じ込められて
     字が読めなかったからで、そちらは .ps-edit を段組みの外へ広げて直してある
     （約608px → 1320px）。読める大きさが確認画面そのものに戻ったので、
     もう一枚の窓は要らなくなった。★段組みへ戻す変更をするなら、
     「読めないまま確認のチェックが付く」が復活することになる（回帰で固定してある）。 */

  function renderEditor() {
    clearPanel();
    var box = el('div', 'ps-edit');

    box.appendChild(el('p', 'ps-lead', esc2(T.redacted)));
    box.appendChild(el('p', 'ps-lead ps-lead-sm', T.frameLead));

    /* 探索の状況。「探しています → n か所塗りました／見つかりませんでした」を
       ここ1か所だけで言う。塗った数を出さないと、本人は何を確認すればよいか分からない。 */
    var scan = el('p', 'ps-scan');
    scan.id = 'ps-scan';
    box.appendChild(scan);

    /* ②-F 探している間の代わりの画面 ───────────────────────────
       明細の代わりにここを出す。CSS の .ps-edit.is-wait が入れ替えを持っていて、
       付け外しは updateGate() 1か所（ocrState === 'running' を見る）。
       ★縦横比を明細に合わせる。合わせないと、探し終わった瞬間にページの高さが
         飛んで、読んでいた場所を見失う。max-width は明細の実寸まで（それ以上に
         広げても canvas は実寸で止まるので、箱だけ大きい画面になってしまう）。 */
    var wait = el('div', 'ps-wait',
      '<b>' + esc2(T.waitTitle) + '</b><span>' + esc2(T.waitNote) + '</span>');
    wait.id = 'ps-wait';
    wait.style.aspectRatio = W + ' / ' + H;
    wait.style.maxWidth = W + 'px';
    box.appendChild(wait);

    stage = el('div', 'ps-stage');
    cv = el('canvas', 'ps-cv');
    stage.appendChild(cv);
    box.appendChild(stage);

    /* ★「これが送られる画像です」は画像のすぐ下に置く。
       送るボタンの下だと、押したあとにしか目に入らない＝確認画面の意味が無い。 */
    box.appendChild(el('p', 'ps-lead ps-lead-sm', esc2(T.preview)));

    /* ★枠が自動で置けなかったことは、**静かに**知らせてはいけない。
       いまの画面はどちらの場合も「自動で n か所を塗りました」としか言わず、
       手がかりが1つしか取れていない日でも成功したように見えていた。
       置けなかった＝画像が丸ごと送られる状態なので、警告の色で本人に渡す。 */
    var fw = el('p', 'ps-frwarn', T.frameOff);
    fw.id = 'ps-frwarn';
    fw.style.display = 'none';
    box.appendChild(fw);

    box.appendChild(el('p', 'ps-hint', esc2(T.hint) + ' ' + esc2(T.frameHint)));

    var bar = el('div', 'ps-bar');
    var add = el('button', 'ps-btn ps-btn-ghost', esc2(T.addRect));
    add.type = 'button';
    add.addEventListener('click', function () {
      rects.push({ x: Math.round(W * 0.2), y: Math.round(H * 0.4), w: Math.round(W * 0.6), h: Math.round(H * 0.08) });
      paint();
    });
    var rst = el('button', 'ps-btn ps-btn-ghost', esc2(T.reset));
    rst.type = 'button';
    rst.addEventListener('click', function () {
      rects = autoRects.map(function (r) { return { x: r.x, y: r.y, w: r.w, h: r.h }; });
      if (autoFrame) frame = { x: autoFrame.x, y: autoFrame.y, w: autoFrame.w, h: autoFrame.h };
      paint();
      updateGate();
    });
    /* 枠が明細を切ってしまったときの逃げ道。1クリックで元の「全部送る」に戻せる
       ＝枠のせいで読み取りが失敗したまま詰む、が起きない。 */
    var all = el('button', 'ps-btn ps-btn-ghost', esc2(T.frameAll));
    all.type = 'button';
    all.addEventListener('click', function () { frame = fullFrame(); paint(); updateGate(); });
    var cancel = el('button', 'ps-btn ps-btn-ghost', esc2(T.cancel));
    cancel.type = 'button';
    cancel.addEventListener('click', function () {
      work = null; src = null; rects = []; frame = null; autoFrame = null; frameAuto = false;
      clearPanel();
    });
    bar.appendChild(add); bar.appendChild(all); bar.appendChild(rst); bar.appendChild(cancel);

    /* ?psdebug=1 のときだけ。実物でしか出ない不具合を1往復で確定させるための口。
       中身は diagText()＝個人情報が構造上入らない形（②-D を参照）。 */
    if (OCR_DEBUG) {
      var dg = el('button', 'ps-btn ps-btn-ghost', esc2(T.diagCopy));
      dg.type = 'button';
      dg.id = 'ps-diag';
      dg.addEventListener('click', function () {
        var t = diagText();
        var done = function () { dg.textContent = T.diagDone; };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(t).then(done, function () { window.prompt(T.diagCopy, t); });
        } else window.prompt(T.diagCopy, t);
      });
      bar.appendChild(dg);
    }
    box.appendChild(bar);

    var warn = el('p', 'ps-warn', esc2(T.redactNone));
    warn.id = 'ps-nowarn';
    box.appendChild(warn);

    /* ★送る前の確認。増やすのはこの1クリックだけ。
       規約に「本人が確認したうえで送る」と書く以上、ここが無いとその記載が嘘になる。
       自動検出は取りこぼしうるので、最後に見るのは必ず人間。 */
    var cw = el('label', 'ps-confirm');
    var cb = el('input');
    cb.type = 'checkbox';
    cb.id = 'ps-confirm';
    cb.addEventListener('change', updateGate);
    cw.appendChild(cb);
    cw.appendChild(el('span', null, esc2(T.confirm)));
    box.appendChild(cw);

    var send = el('button', 'ps-btn ps-btn-go', esc2(T.send));
    send.type = 'button';
    send.id = 'ps-send';
    send.addEventListener('click', doSend);
    box.appendChild(send);

    box.appendChild(el('p', 'ps-note', esc2(T.note)));
    panel.appendChild(box);

    cv.width = W; cv.height = H;
    paint();
    updateGate();
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* 探索の状況表示と、送信ボタンの可否を1か所で決める。
     探している最中は確認させない（＝確認後に矩形が増える、を起こさない）。 */
  function updateGate() {
    var scan = document.getElementById('ps-scan');
    if (scan) {
      var msg = ocrState === 'running' ? T.scanning
        : ocrState === 'done' ? T.scanDone(ocrFound)
          : ocrState === 'none' ? T.scanNone
            : ocrState === 'failed' ? T.scanFail : '';
      if (OCR_DEBUG && ocrDiag && ocrState !== 'running') {
        msg += '　[' + ocrDiag.src + ' → ' + ocrDiag.ocr + '／語 ' + ocrDiag.words
          + '（信頼 ' + ocrDiag.conf + '）／行 ' + ocrDiag.lines
          + '／手がかり ' + ocrDiag.hit + '／' + ocrDiag.ms + 'ms]';
      }
      /* PDF から来たときだけの一言（何ページ目を読んだか／文字をそのまま読めたか）は
         探索の結果と**同じ場所に**添える。別の行に出すと、次の表示で上書きされて消える。
         「そのまま読めた」は診断から作る＝OCR に落ちた日には**出せない**。 */
      var note = [srcNote, (ocrDiag && ocrDiag.lang === 'pdf') ? T.pdfText : '']
        .filter(Boolean).join('　');
      if (msg && note) msg += '　' + note;
      scan.textContent = msg;
      scan.className = 'ps-scan' + (ocrState === 'none' || ocrState === 'failed' ? ' is-warn' : '')
        + (ocrState === 'running' ? ' is-busy' : '');
      scan.style.display = msg ? '' : 'none';
    }
    /* 探し終わってから出す。探している最中に出すと、置けたのに一瞬警告が光る。
       ★見るのは「自動で置けたか」ではなく**いま枠が紙の全部を覆っているか**。
         自動でも全体になることはあるし、本人が「全体に広げる」を押すこともある。
         どの道で全体になっても「これは紙ぜんぶを送ります」と言わなければ、
         画面が嘘をつく＝いちばん重い壊れ方（黙って全部出る）に戻ってしまう。 */
    var fw = document.getElementById('ps-frwarn');
    if (fw) fw.style.display = (ocrState !== 'running' && frameIsWhole()) ? '' : 'none';

    var cb = document.getElementById('ps-confirm');
    var send = document.getElementById('ps-send');
    if (!cb || !send) return;
    var waiting = ocrState === 'running';
    /* ★探している間は明細も送信の口も**画面から消す**。
       disabled にはしてあったが、disabled のボタンは目に入らない。
       塗る前の明細が数秒見えていると、それを完成品だと思って押しにくる。
       付け外しはここ1か所だけ（ocrState を知っているのはこの関数だけ）。 */
    var edit = cb.closest ? cb.closest('.ps-edit') : null;
    if (edit) edit.classList.toggle('is-wait', waiting);
    cb.disabled = waiting;
    if (waiting) cb.checked = false;
    var wrap = cb.parentNode;
    if (wrap) wrap.classList.toggle('is-off', waiting);
    send.disabled = busy || waiting || !cb.checked;
    send.title = waiting ? T.confirmWait : (cb.checked ? '' : T.confirm);
  }

  /* canvas には元画像だけを描き、黒塗りは上に重ねた div で見せる。
     ★送るときだけ composite() で画素に焼く。「見えているもの＝送るもの」を
       保つため、div の位置と焼く位置は同じ矩形から作る。 */
  function paint() {
    cv.getContext('2d').drawImage(work, 0, 0);
    var old = stage.querySelectorAll('.ps-rect, .ps-frame');
    for (var i = 0; i < old.length; i++) old[i].remove();
    if (frame) stage.appendChild(frameNode());
    rects.forEach(function (r, idx) { stage.appendChild(rectNode(r, idx)); });
    var w = document.getElementById('ps-nowarn');
    if (w) w.style.display = rects.length ? 'none' : '';
  }

  /* 送る枠。外側を暗くするのは box-shadow を画面いっぱいに広げるだけ＝要素は1つ。
     枠の本体は pointer-events を通さない＝中の黒塗りをこれまで通りつまめる。
     動かせるのは左上の札と四隅のつまみだけにしてある。 */
  function frameNode() {
    var n = el('div', 'ps-frame');
    var put = function () {
      n.style.left = pct(frame.x, W); n.style.top = pct(frame.y, H);
      n.style.width = pct(frame.w, W); n.style.height = pct(frame.h, H);
      /* 動かした先が紙ぜんぶなら、その場で警告に切り替える＝画面と実物がずれない */
      updateGate();
    };
    put();

    var tag = el('span', 'ps-frame-tag', esc2(T.frameTag));
    n.appendChild(tag);
    drag(tag, function (dx, dy) {
      frame.x = clamp(frame.x + dx, 0, W - frame.w);
      frame.y = clamp(frame.y + dy, 0, H - frame.h);
      put();
    });

    var minW = Math.max(1, Math.round(W * 0.2)), minH = Math.max(1, Math.round(H * 0.12));
    [['nw', -1, -1], ['ne', 1, -1], ['sw', -1, 1], ['se', 1, 1]].forEach(function (c) {
      var g = el('span', 'ps-frame-grip is-' + c[0]);
      n.appendChild(g);
      drag(g, function (dx, dy) {
        if (c[1] < 0) {
          var nx = clamp(frame.x + dx, 0, frame.x + frame.w - minW);
          frame.w += frame.x - nx; frame.x = nx;
        } else frame.w = clamp(frame.w + dx, minW, W - frame.x);
        if (c[2] < 0) {
          var ny = clamp(frame.y + dy, 0, frame.y + frame.h - minH);
          frame.h += frame.y - ny; frame.y = ny;
        } else frame.h = clamp(frame.h + dy, minH, H - frame.y);
        put();
      });
    });
    return n;
  }

  function pct(v, total) { return (v / total * 100) + '%'; }

  function rectNode(r, idx) {
    var n = el('div', 'ps-rect');
    n.style.left = pct(r.x, W); n.style.top = pct(r.y, H);
    n.style.width = pct(r.w, W); n.style.height = pct(r.h, H);
    n.tabIndex = 0;
    n.setAttribute('role', 'group');
    n.setAttribute('aria-label', T.del);

    var del = el('button', 'ps-rect-del', '&times;');
    del.type = 'button';
    del.title = T.del;
    del.setAttribute('aria-label', T.del);
    del.addEventListener('click', function (e) { e.stopPropagation(); rects.splice(idx, 1); paint(); });
    n.appendChild(del);

    var grip = el('span', 'ps-rect-grip');
    n.appendChild(grip);

    drag(n, function (dx, dy) {
      r.x = clamp(r.x + dx, 0, W - r.w);
      r.y = clamp(r.y + dy, 0, H - r.h);
      n.style.left = pct(r.x, W); n.style.top = pct(r.y, H);
    });
    drag(grip, function (dx, dy) {
      r.w = clamp(r.w + dx, Math.round(W * 0.04), W - r.x);
      r.h = clamp(r.h + dy, Math.round(H * 0.02), H - r.y);
      n.style.width = pct(r.w, W); n.style.height = pct(r.h, H);
    });

    // キーボードでも動かせる（矢印=移動 / Shift+矢印=大きさ）
    n.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 0 : Math.round(H * 0.01) || 1;
      var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d) { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); rects.splice(idx, 1); paint(); } return; }
      e.preventDefault();
      var k = Math.round(H * 0.01) || 1;
      if (e.shiftKey) {
        r.w = clamp(r.w + d[0] * k, Math.round(W * 0.04), W - r.x);
        r.h = clamp(r.h + d[1] * k, Math.round(H * 0.02), H - r.y);
        n.style.width = pct(r.w, W); n.style.height = pct(r.h, H);
      } else {
        r.x = clamp(r.x + d[0] * step, 0, W - r.w);
        r.y = clamp(r.y + d[1] * step, 0, H - r.h);
        n.style.left = pct(r.x, W); n.style.top = pct(r.y, H);
      }
    });
    return n;
  }

  function clamp(v, lo, hi) { return Math.round(Math.max(lo, Math.min(hi, v))); }

  function drag(node, onMove) {
    node.addEventListener('pointerdown', function (e) {
      if (e.target.classList.contains('ps-rect-del')) return;
      e.preventDefault(); e.stopPropagation();
      node.setPointerCapture(e.pointerId);
      var sx = e.clientX, sy = e.clientY;
      var scale = W / stage.clientWidth;                   // CSS px → 画像 px
      function move(ev) {
        var dx = (ev.clientX - sx) * scale, dy = (ev.clientY - sy) * scale;
        sx = ev.clientX; sy = ev.clientY;
        onMove(dx, dy);
      }
      function up(ev) {
        node.releasePointerCapture(ev.pointerId);
        node.removeEventListener('pointermove', move);
        node.removeEventListener('pointerup', up);
        node.removeEventListener('pointercancel', up);
      }
      node.addEventListener('pointermove', move);
      node.addEventListener('pointerup', up);
      node.addEventListener('pointercancel', up);
    });
  }

  // ════════════════════════════════════════════════════════
  // ④ 送る（黒塗りを画素に焼いてから）
  // ════════════════════════════════════════════════════════
  /* ★送る画素を作る唯一の場所。ここが1つだから「見えているもの＝送るもの」が保てる。
     やることは2つ：**枠の中だけを原寸から切り出す**、**残った黒塗りを焼く**。
     切り出す元が work（長辺1568に縮めた表示用）ではなく src（原寸）なのが要点で、
     work から切ると枠が狭いぶんだけ解像度が落ちる。原寸から切って 1568 に描き直せば、
     枠が狭いほど字は**大きく**なる＝金額表の読み取りはむしろ良くなる。 */
  function composite() {
    var f = frame || fullFrame();
    var iw = (src && (src.width || src.naturalWidth)) || W;
    var ih = (src && (src.height || src.naturalHeight)) || H;
    var kx = iw / W, ky = ih / H;                      // work 座標 → 原寸座標

    var sx = Math.max(0, Math.min(iw - 1, Math.round(f.x * kx)));
    var sy = Math.max(0, Math.min(ih - 1, Math.round(f.y * ky)));
    var sw = Math.max(1, Math.min(iw - sx, Math.round(f.w * kx)));
    var sh = Math.max(1, Math.min(ih - sy, Math.round(f.h * ky)));

    // 引き伸ばしはしない（無い画素は作れない）。縮めるのは 1568 まで
    var g = Math.min(1, MAX_EDGE / Math.max(sw, sh));
    var ow = Math.max(1, Math.round(sw * g));
    var oh = Math.max(1, Math.round(sh * g));

    var out = document.createElement('canvas');
    out.width = ow; out.height = oh;
    var c = out.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(src || work, sx, sy, sw, sh, 0, 0, ow, oh);

    /* 黒塗りは枠の座標系へ移してから焼く。枠の外へはみ出すぶんは自然に切れる。
       ★16px 単位の丸めは**出力の座標系**で行う。JPEG は 8×8（色差は 16×16）の
         ブロックで圧縮するので、境界をまたぐブロックがあると塗った内側に元の内容が
         にじんで残りうる。ブロックがあるのは出力側なので、切り出す前の座標で
         丸めても境界は合わない。 */
    var mx = ow / f.w, my = oh / f.h;
    c.fillStyle = '#000';
    rects.forEach(function (r) {
      var x1 = Math.max(0, Math.floor(((r.x - f.x) * mx) / BLOCK) * BLOCK);
      var y1 = Math.max(0, Math.floor(((r.y - f.y) * my) / BLOCK) * BLOCK);
      var x2 = Math.min(ow, Math.ceil(((r.x + r.w - f.x) * mx) / BLOCK) * BLOCK);
      var y2 = Math.min(oh, Math.ceil(((r.y + r.h - f.y) * my) / BLOCK) * BLOCK);
      if (x2 > x1 && y2 > y1) c.fillRect(x1, y1, x2 - x1, y2 - y1);
    });
    return out;
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

  var ERR = {
    rate_limited: 'errQuota',
    rate_limited_global: 'errQuotaGlobal',
    read_failed: 'errRead', not_a_payslip: 'errNotSlip',
    image_too_large: 'tooLarge', bad_mime: 'badImage',
    server_misconfigured: 'errServer', quota_unavailable: 'errServer',
  };

  function doSend() {
    if (busy || !work) return;
    /* ★ボタンの disabled だけに頼らない。ここでも止める。
       「本人が確認してから送る」は規約に書く保証なので、経路は1本にする。 */
    var cb = document.getElementById('ps-confirm');
    if (ocrState === 'running' || !cb || !cb.checked) return;
    busy = true;
    track('payslip_sent');
    var btn = document.getElementById('ps-send');
    if (btn) { btn.disabled = true; btn.textContent = T.sending; }

    /* ★読み取りと同時に辞書を取りに行く。読み取りは15秒かかるので、
       待ち時間は1ミリ秒も増えない。 */
    var hints = loadHints();

    toB64(composite())
      .then(function (b64) {
        return _sb.functions.invoke('parse-payslip', {
          body: { image_b64: b64, mime: 'image/jpeg', lang: L },
        });
      })
      .then(function (r) {
        if (r.error) {
          return (r.error.context && typeof r.error.context.json === 'function')
            ? r.error.context.json().catch(function () { return null; })
            : null;
        }
        return r.data;
      })
      .then(function (out) {
        busy = false;
        /* ★ここが「読めたか」を知っている唯一の場所。理由まで残さないと、
           鍵が死んでいる（read_failed が1〜2秒で返る）のか、上限に当たっているのか、
           明細でない画像を送られているのかを、あとから区別できない。 */
        if (!out) { track('payslip_read_ng', { reason: 'network' }); return say('warn', T.errNet); }
        if (!out.ok) {
          track('payslip_read_ng', { reason: String(out.reason || 'unknown') });
          say('warn', T[ERR[out.reason] || 'errRead']);
          /* ★行き止まりにしない。読めなかった人ほど、明細を手元に開いたまま
             見ている。ここでフォームを開けばそのまま入力に移れる。
             明細のカードは細い帯に縮んで上に残り、押せば落とし直せる
             （.ps.is-slim .ps-drop は display:none にならない）。
             ★ファイルを間違えただけの人（tooLarge / badImage）はここに来ない。
               送る前に弾いているので、落とし直しの動線を邪魔しない。 */
          if (typeof window.PVEnterMode === 'function') window.PVEnterMode('manual');
          return;
        }
        track('payslip_read_ok');
        /* 辞書が来てから下書きする。読み取りのほうが桁違いに遅いので、
           ここで待つことはまず無い（先に終わっていれば即座に進む）。
           ★辞書が取れなくても apply は必ず動く（loadHints は失敗しても解決する）。 */
        return hints.then(function () { apply(out.result); });
      })
      .catch(function () {
        busy = false;
        track('payslip_read_ng', { reason: 'network' });
        say('warn', T.errNet);
      });
  }

  // ════════════════════════════════════════════════════════
  // ⑤ フォームに下書きする（★投稿はしない）
  // ════════════════════════════════════════════════════════
  function setField(id, value) {
    var e2 = document.getElementById(id);
    if (!e2) return false;
    if (e2.tagName === 'SELECT') {
      var ok = Array.prototype.some.call(e2.options, function (o) { return o.value === String(value); });
      if (!ok) return false;
    }
    e2.value = String(value);
    e2.classList.add('ai-filled');
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
  function canRows() {
    return typeof pdAdd === 'function' && typeof pdSync === 'function' &&
           !!document.getElementById('tpl-pd-var');
  }
  var seededRows = [];         // 前回この明細から生やした行（落とし直したら消す）
  function seedVarRows(seed) {
    /* ★明細を落とし直したら、前に生やした行は必ず消す。足すだけにすると
       2回落とした人の変動給が2倍になる（欄なら上書きで済んでいた所）。
       本人が自分で足した行には触らない（こちらが作った行だけを覚えている）。 */
    seededRows.forEach(function (r) { if (r && r.parentNode) r.parentNode.removeChild(r); });
    seededRows = [];
    if (!seed || !seed.length || !canRows()) { if (typeof pdSync === 'function') pdSync(); return; }
    if (typeof openOpt === 'function') openOpt('pd-var', true);   // 節そのものを開ける
    seed.forEach(function (t) {
      var row = pdAdd('var', true);
      if (!row) return;
      t.row = row;
      seededRows.push(row);
      var set = function (sel, v) {
        var e2 = row.querySelector(sel);
        if (!e2 || v == null || v === '') return;
        e2.value = String(v);
        /* 行の中の欄にも「AIが入れた」印を付ける（本人が触ったら外れる）。 */
        e2.classList.add('ai-filled');
        e2.addEventListener('input', unmark);
        e2.addEventListener('change', unmark);
      };
      /* ★basis は必ず入れる。空のままだと必須（req-tag）に引っかかって、
         明細から入った人だけが送信できなくなる。分からない行は 'unknown'。 */
      set('.pd-basis', t.basis || 'unknown');
      set('.pd-amt', String(Math.round(t.amount || 0)));
      set('.pd-label', t.label);
    });
    var det = document.getElementById('pay-detail');
    if (det) det.open = true;
    pdSync();                        // f-var-sum と f-payitems を組み直す（中で recalc）
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
    lastHours = {};
    (res.hours || []).forEach(function (h) { lastHours[h.kind] = h.value; });

    // 手当を欄ごとに足し合わせる（同じ欄に行く行が複数あることがある）
    var sums = {}, trace = [], notional = [], counts = [];
    var roleLabel = {};        // 教官・審査の「明細上の名称」（最初に読めた1つだけ）
    var varSeed = [];          // 変動給。欄ではなく「行」に載せる（下で pdAdd する）
    var rowsOK = canRows();
    (res.earnings || []).forEach(function (e2) {
      /* 相殺項目（航空券課税など）。控除欄に同額が立つので手取りは1円も動かない。
         収入に足すと時給が水増しになるので分子から外す。ただし黙って消さず、
         「読めたが数えていない」と画面に出す（unmapped に落として本人に聞くのも違う。
          何の項目かは分かっていて、数えないと決めているだけなので）。 */
      if (e2.kind === 'notional') { notional.push(e2); return; }
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
      sums['f-other'] = (sums['f-other'] || 0) + amt;
      trace.push({ label: u.label, field: 'f-other', amount: amt, kind: 'unclassified', unc: true, asked: null });
    });

    res._notional = notional;
    res._counts = counts;

    if (res.currency) setField('f-currency', res.currency);
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

    seedVarRows(varSeed);

    writeExtras(res, trace);

    /* ★入口で「明細から自動入力」を選んだ人は、まだフォームが出ていない
       （ステップ 1/2）。読めたのでここで出す＝ステップ 2/2。
       関数が無い＝入口の2択を持たない古い HTML でも落ちないようにする。 */
    if (typeof window.PVEnterMode === 'function') window.PVEnterMode('manual');

    if (typeof updateSteps === 'function') updateSteps(true);
    if (typeof recalc === 'function') recalc();

    renderResult(res, trace);
    renderRate();
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
    if (gh != null) setField('f-guar', gh);
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
       ★「f-other から抜けばいい」ではない。pay-tracker の donut は flight_variable_pay を
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
        if (a) { a.value = String(Math.round(t.amount || 0)); a.classList.remove('ai-filled'); }
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

  function missingForSubmit() {
    var need = [];
    ['f-airline', 'f-position', 'f-fleet'].forEach(function (id) {
      var e2 = document.getElementById(id);
      if (e2 && !String(e2.value).trim()) need.push(id);
    });
    return need;
  }

  function renderResult(res, trace) {
    lastTrace = trace;
    lastRes = res;
    askSkipped = false;                 // 明細を落とし直したら、また聞いてよい
    clearPanel();
    /* ★通貨は「明細に書いてあった通貨」をそのまま出す。ここで換算しない。
       換算した数字を明細の隣に並べると、どちらが実額か分からなくなる。 */
    var cur = res.currency ? esc2(res.currency) + ' ' : '';
    var box = el('div', 'ps-res');
    box.appendChild(el('div', 'ps-res-title', esc2(T.resultTitle)));
    box.appendChild(el('p', 'ps-res-lead', T.resultLead));
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
    if (chkMsg.length) {
      chkMsg.forEach(function (m) { box.appendChild(el('p', 'ps-warn', m)); });
    } else if (res.confidence === 'low') {
      box.appendChild(el('p', 'ps-warn', esc2(T.lowConf)));
    }

    /* ★時給を表より先に出す。明細を落とした人が見たいのはこれ1つ。
       前は送信ブロックの中（2,800px 下）に入れていたので誰も見なかった。 */
    box.appendChild(rateCard(guessBlock(res)));
    /* 時給の直後に「で、年収はいくらのペースか」を置く。
       n=0（他人の投稿ゼロ）でも公開レンジと突き合わせられるので、初日から成立する。 */
    box.appendChild(ahaCard());

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
               '<input class="ps-amt-in" type="number" step="any" inputmode="decimal" data-i="' + i +
               '" value="' + Math.round(t.amount) + '"></td></tr>';
      }).join('');
      var tbl = el('table', 'ps-tbl ps-tbl-edit',
        '<thead><tr><th>' + esc2(T.col1) + '</th><th>' + esc2(T.col2) + '</th><th>' + esc2(T.col3) +
        '</th></tr></thead><tbody>' + rows + '</tbody>');
      tbl.addEventListener('input', function (ev) {
        var t2 = ev.target;
        if (!t2.classList.contains('ps-amt-in')) return;
        var i = Number(t2.getAttribute('data-i'));
        if (!lastTrace[i]) return;
        lastTrace[i].amount = Number(t2.value) || 0;
        pushTrace();
      });
      box.appendChild(tbl);
      box.appendChild(el('p', 'ps-note', esc2(T.editHint)));
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
       ★送信ボタンへ連れて行く nextCard より前。ここが「レポートの最後」。 */
    box.appendChild(askWrap);
    renderAsk();

    box.appendChild(nextCard());

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
    var cur = (lastRes && lastRes.currency) ? esc2(lastRes.currency) + ' ' : '';
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
    t.field = c.field;
    /* 表の「入れた欄」を書き換える。表は作り直さない（金額を打ちかけの
       入力欄があると、作り直した瞬間にフォーカスと打ちかけの値が飛ぶ）。 */
    var td = panel.querySelector('.ps-to[data-to="' + i + '"]');
    if (td) td.textContent = lbl(c.field);
    pushTrace();                    // 欄・専用列・内訳JSON・年収・時給をまとめて直す
    renderAsk();                    // 次の1件へ（無ければカードごと消える）
  }

  /* ── 次の行動 ───────────────────────────────────────────
     「読み取りました」で止めない。送信ボタンはページのいちばん下にあるので、
     ここから連れて行く。会社・職位・機材は明細に書いていないので人が選ぶ。 */
  function nextCard() {
    var need = missingForSubmit();
    var card = el('div', 'ps-next');
    var ok = need.length === 0;
    card.innerHTML =
      '<div class="ps-next-t">' + esc2(ok ? T.nextOkT : T.nextT.replace('{n}', need.length)) + '</div>' +
      '<p class="ps-next-l">' + esc2(ok ? T.nextOkL : T.nextL) + '</p>';
    var b = el('button', 'btn-orange', esc2(ok ? T.nextOkB : T.nextB));
    b.type = 'button';
    b.addEventListener('click', function () {
      var target = document.getElementById(need[0] || 'submit-block') ||
                   document.getElementById('submit-block');
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (need[0] && target.focus) setTimeout(function () { target.focus(); }, 400);
    });
    card.appendChild(b);
    return card;
  }

  // ════════════════════════════════════════════════════════
  // 時給 ── 商品そのもの
  //   ★煽らない。パーディアムは非課税の実費補填なので既定では分子に入れない。
  //   ★乗務時間あたりと総勤務時間あたりを両方出す。差そのものが発見。
  // ════════════════════════════════════════════════════════
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
    var card = el('div', 'ps-rate');
    card.id = 'ps-rate';
    card.innerHTML =
      '<div class="ps-rate-t">' + esc2(T.rate) + '</div>' +
      '<div id="ps-rate-body"></div>' +
      '<div class="ps-ask" id="ps-ask" hidden>' +
        '<div class="ps-ask-t" id="ps-ask-t">' + esc2(T.askBlockT) + '</div>' +
        '<p class="ps-ask-l" id="ps-ask-l">' + esc2(T.askBlockL) + '</p>' +
        '<div class="ps-ask-in"><input type="number" step="any" min="0" max="200" ' +
          'inputmode="decimal" id="ps-ask-block" placeholder="78.5"><span>h</span></div>' +
        '<p class="ps-note" id="ps-ask-f" hidden>' + esc2(T.askBlockF) + '</p>' +
      '</div>' +
      '<label class="ps-pd"><input type="checkbox" id="ps-pd"><span>' + esc2(T.pdOn) + '</span></label>';

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
    var cb = card.querySelector('#ps-pd');
    cb.checked = pdOn;
    cb.addEventListener('change', function () { pdOn = cb.checked; renderRate(); });

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

    var big = function (v, hours, key) {
      if (!hours) return '';
      var per = v / hours;
      return '<div class="ps-rate-row"><div class="ps-rate-k">' + esc2(T[key]) + '</div>' +
        '<div class="ps-rate-v">' + esc2(cur) + ' ' + nf.format(Math.round(per)) +
        '<span class="ps-rate-min">' + esc2(T.perMin) + ' ' + nf1.format(per / 60) + '</span></div></div>';
    };

    body.innerHTML =
      big(m, block, 'perBlock') +
      big(m, duty, 'perDuty') +
      (duty ? '' : '<p class="ps-note">' + esc2(T.needDuty) + '</p>');
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
  var BAND_LABEL = { fo: { ja: '副操縦士', en: 'First Officer' }, cap: { ja: '機長', en: 'Captain' } };

  /* 円 → 表示。サイト全体の通貨切替に載せる（PVCurrency.fmt 経由）。
     カードは pv-no-cur で自動スキャンから外し、pv-currency-change で描き直す
     ＝salary-leveling.js / pay-tracker.js と同じ作り。 */
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
     同じ文言のボタンを nextCard が出すので、2つ並ぶ（2026-08-12にそれで1つ消した）。 */
  function ahaMsg(msg, withBtn) {
    return ahaShell('<p class="ps-aha-msg">' + esc2(msg) + '</p>' +
      (withBtn ? '<button type="button" class="btn-orange ps-aha-b" id="ps-aha-go">' + esc2(T.ahaPickB) + '</button>' : ''));
  }

  function renderAha() {
    var host = document.getElementById('ps-aha');
    if (!host || typeof num !== 'function' || typeof annualTotal !== 'function') return;

    var yrOrig = annualTotal();                       // 原本通貨・年額（ボーナス／PS 込み）
    if (!(yrOrig > 0)) { host.innerHTML = ''; return; }

    var air = (document.getElementById('f-airline')  || {}).value || '';
    var pos = (document.getElementById('f-position') || {}).value || '';
    var cur = (document.getElementById('f-currency') || {}).value || 'JPY';

    var jpy = toJpy(yrOrig, cur);
    if (jpy === null)     { host.innerHTML = ahaMsg(T.ahaNoFx(cur)); return; }

    /* ── ① 年間ペース ──────────────────────────────
       ★これは明細だけで出せる（会社も職位も要らない）。だから何より先に出す。
       前は会社と職位を選ぶまで数字が1つも出ず、「年収はいくらのペースか」という
       見出しの下が空の依頼文だけになっていた（実測）。 */
    var out = '<div class="ps-aha-t">' + esc2(T.ahaT) + '</div>' +
      '<div class="ps-aha-pace"><div class="ps-aha-pk">' + esc2(T.ahaPace) + '</div>' +
      '<div class="ps-aha-pv">' + esc2(money(jpy)) + '</div></div>' +
      '<p class="ps-aha-h">' + esc2(T.ahaPaceH) + '</p>';

    /* 会社・職位はまだ選ばれていないのが普通（明細に書いていない）。
       ★ボタンはここに置かない。同じ文言・同じ行き先のボタンを nextCard が出しており、
         内訳を畳んだ（2026-08-12）ことで両者が40pxしか離れていない。
         押す場所が2つあると、どちらが「次」なのか分からなくなる。 */
    if (!air || !pos) {
      host.innerHTML = out + '<p class="ps-aha-msg">' + esc2(T.ahaPick) + '</p>';
      return;
    }
    if (air === 'other')  { host.innerHTML = out + '<p class="ps-aha-msg">' + esc2(T.ahaNoAirline) + '</p>'; return; }
    if (!BAND[pos])       { host.innerHTML = out + '<p class="ps-aha-msg">' + esc2(T.ahaNoBand) + '</p>';    return; }

    if (!SAL) { loadSalary(); host.innerHTML = out; return; }
    var me = SAL[air], band = BAND[pos], r = me && me[band];
    if (!r || !(r.hi > r.lo)) { host.innerHTML = out; return; }

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

    out += '<div class="ps-aha-sec">' + esc2(T.ahaRangeT(nameOf(me), BAND_LABEL[band][L])) + '</div>' +
      '<div class="ps-aha-bar' + cls + '">' +
        '<i class="ps-aha-avg" style="left:' + avgX.toFixed(1) + '%" title="' + esc2(T.ahaAvgTick) + '"></i>' +
        '<i class="ps-aha-dot" style="left:' + dot.toFixed(1) + '%"></i></div>' +
      /* ★平均のラベルは目盛りの真下に置く。ends の真ん中に入れていたときは、
         目盛りが 20% の位置なのにラベルが 50% に立っていて、どの線の説明か読めなかった
         （エミレーツ機長は lo 3,350／平均 3,700／hi 5,050＝平均が下から2割）。
         端まで行くと lo/hi と重なるので 9〜91% に収める。 */
      '<div class="ps-aha-avgl"><span style="left:' + Math.max(9, Math.min(91, avgX)).toFixed(1) + '%">' +
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

  // 手で直したら時給もついてくる
  document.getElementById('form-wrap').addEventListener('input', function () {
    if (document.getElementById('ps-rate')) renderRate();
    if (document.getElementById('ps-aha')) renderAha();
  });
})();
