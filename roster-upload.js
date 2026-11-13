/* ════════════════════════════════════════════════════════════════
   roster-upload.js — 勤務ロスターの取り込み（2026-11-09）
   ★「勤務ロスター」のタブで「ロスターをアップロード」を押したときだけ読む（my-roster.js の loadUpload）。

   流れ
     ① 選ぶ … スクリーンショット・PDF を何枚でも（並べ替え・外すができる）。PDF は全ページを端末の中で画像にする。
                どれも長辺 2560px・JPEG（白で塗ってから描く ── payslip.js と同じ作り）。何月のロスターかを選ぶ（既定は先月）。
     ② 読む … 1ページずつ parse-roster へ。会員が選んだ月（hint）と、前のページの最後の2日（prev_tail）を添える。
                ★読んでいるあいだは明細と同じ白い覆いの画面（0〜100% の輪と3つの段・止める）。失敗したら覆いを外し、箱の中に選べる道。
     ③ 聞く … はじめての会社だけ、読み方を別の画面で聞く（実績か予定か・時刻の基準・TIME の意味・知らない勤務コード・
                何も書いていない日）。★本人の答え → 会社の辞書（同じ会社の3人以上がそろえた答え・my_roster_airline_codes）の順で埋め、
                どちらにも無いものだけ聞く。会社の辞書で埋めたものは保存のときに本人の読み方へ入る。
                知らない言葉（'#'＋16進の印）は「勤務表の言葉 A」と出る日付で聞き、その日の見た目（cat）の多い方を選んでおく。
     ④ 確かめて直す … pv-report-engine.js の mergePages で重なり・切れ目を1日1回にまとめる。読めた日と便の時間の数、
                      カレンダー（押すとその日を直す画面 editDay）、読めなかった日（決まった5つ＋このスケジュールのコード・勤務を入力・空欄のまま）。
                      見た目から候補があれば点線で示すだけ（押すか「この内容で決める」まで入れない）。
                      ★空欄・読めなかった日は保存しない（本人が入れた日だけ送る）。便や時刻が読めた日は、コードが無くても送る。
                      いちばん下に「読み取りの間違いを運営に知らせる」（直した所の種類と数だけ・日付も時刻も空港も書かない）。
     ⑤ 保存 … set_roster_profile（足りなかった答えだけ）→ submit_roster。

   守っていること
   ・画像は読み取りのために送るが、保存はしない（関数はメモリの中だけ）。保存するのは読み取った日付・便・時刻だけ。
     ★「画像は送りません」とは書かない（CLAUDE.md「明細の扱いは…1つの言い方」）。
   ・氏名・自由な文字は1文字も扱わない（読み取りの側が欄の形で落とす。ここも欄を決めて組み直して送る）。
   ・同じ日は1回だけ（mergePages）。同じファイルの二度目はサーバが dup で返す（file_sha ＝ 送ったページの JPEG を順につないだ SHA-256）。
   ・自動で送り直さない（向こうで処理が続いているかもしれない）。送り直すのは本人が「もう一度読む」を押したときだけ。
   ・payslip.js は直さない（PDF の部品の取り方だけ同じ形で写した）。

   window.PVRosterUpload = { open(box, ctx), editDay(box, day, opts) }
     ctx = { sb, airline, other, airlineLabel, profile, learned（my_roster_airline_codes の答え・無ければ null）, done(res|null) }
     editDay … 1日を直す画面（保存したあとも my-roster.js が借りる）。opts.onSave(day) / onCancel() / onDelete() /
               codeLabel(c) / report:{ sb, airline, pairs(draftDay|undefined) }（運営に知らせる口・保存したあとの画面だけ）
   ════════════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';
  var d = w.document;
  var R = w.PVReport, P = w.PVRoster && w.PVRoster._;
  if (!R || !P) return;
  var L = P.L, esc = P.esc, fill = P.fill;

  var T = {
    ja: {
      back: 'スケジュールに戻る',
      h: 'スケジュールを取り込む',
      air: '会社',
      pickT: 'スケジュールをアップロード',
      pickS: 'スクリーンショット・PDF を何枚でも選べます。長いスケジュールは、重なっていても切れていても大丈夫です。',
      pickF: 'PDF · PNG · JPG · WebP',
      addT: '画像・PDF を足す',
      listH: '読む順番',
      listS: '上から順に読みます。日付の順に並べてください。',
      up: '上へ', down: '下へ', rm: '外す',
      fPages: '{n}ページ', fPrep: '準備中…', fImg: '画像', fPdf: 'PDF', fCut: 'ほか{n}ページは読みません（上限）',
      fErr: {
        bad_type: '画像か PDF を選んでください', too_large: 'ファイルが大きすぎます', image_decode: '画像を開けませんでした',
        image_blank: '真っ白な画像です', pdf_locked: 'パスワードのかかった PDF は開けません', pdf_broken: 'PDF を開けませんでした',
        pdf_blank: '白紙のページしかありません', pdf_timeout: 'PDF の準備に時間がかかりすぎました',
        image_timeout: '画像の準備に時間がかかりすぎました', prep_failed: '準備できませんでした'
      },
      monthQ: '何月のスケジュールですか',
      monthS: '月をまたぐスケジュールは、始まりの月を選んでください。',
      priv: '画像は読み取りのために送りますが、保存しません。保存するのは読み取った日付・空港・時刻だけで、便名と氏名は保存しません。2年たった日は月の合計だけになります。見られるのはあなただけで、いつでも消せます。',
      read: '読み取る（{n}ページ）',
      tooMany: '一度に読めるのは{n}ページまでです。',
      readH: 'スケジュールを読み取っています',
      stop: '止める',
      stepPrep: '画像を整える', stepRead: '日付と便を読む（{i}/{n}枚目）', stepCal: 'カレンダーにまとめる',
      failH: '{i}ページ目を読めませんでした',
      retry: 'もう一度読む', skip: 'このページを飛ばす', useSoFar: 'ここまでで確かめる',
      why: {
        login_required: 'ログインが切れました。ページを開き直してログインしてください。',
        rate_limited: '今日読める枚数の上限に達しました。明日また続きをどうぞ。',
        rate_limited_global: 'いま読み取りが混み合っています。時間をおいてお試しください。',
        quota_unavailable: 'いま読み取りが混み合っています。時間をおいてお試しください。',
        read_busy: '読み取りが混み合っています。もう一度お試しください。',
        timeout: '時間内に返事がありませんでした。',
        network: '通信できませんでした。電波の良いところでもう一度お試しください。',
        not_a_roster: 'スケジュール（勤務表）に見えませんでした。',
        undated: '日付が読めませんでした。何月のスケジュールかを確かめてください。',
        image_too_large: '画像が大きすぎます。',
        read_truncated: '1枚に情報が多すぎて読み切れませんでした。2枚に分けて撮ってみてください。',
        other: '読み取れませんでした。'
      },
      noneRead: '1ページも読み取れませんでした。',
      confH: '読み取った内容を確かめる',
      found: '{n}日ぶんを読み取りました（{a} – {b}）',
      legsN: '便・業務 {n}件',
      issH: '確かめてほしいところ',
      iCut: '{d}：画像の端で切れています。続きのスクリーンショットを足すか、このまま進んでください。',
      iConf: '{d}：{f}が画像ごとに違います（{v}）。',
      iUse: '{u} を使います。',
      iPart: '{d}：{n}件目の便の一部が切れています。',
      iAmb: '{d}：同じに見える便を見分けられませんでした。',
      iMonth: '選んだ月（{m}）の日が見つかりませんでした。月を確かめてください。',
      iMore: 'ほか {n}件',
      f: {
        code: '勤務コード', d_on: 'D-ON', d_off: 'D-OFF', 'leg.flight': '便名', 'leg.from': '出発地', 'leg.to': '到着地',
        'leg.loc': '場所', 'leg.out': '出発時刻', 'leg.in': '到着時刻', 'leg.block': 'フライトタイム',
        'leg.kind': '便の種類', 'hints.kind': '実績か予定か', 'hints.time_ref': '時刻の基準'
      },
      addMore: 'スクリーンショットを足す',
      qH: 'はじめに教えてください', qS: '同じ会社の次のスケジュールからは、新しいことだけ聞きます。',
      qKind: 'このスケジュールは', qKindA: '実績（飛んだあと）', qKindP: '予定',
      qRef: '時刻は', qRefL: '現地時刻', qRefU: 'UTC',
      qMean: '便の TIME の欄は', qMeanB: 'ブロックタイム（チョックオフ〜チョックオン）', qMeanF: 'フライトタイム（離陸〜着陸）', qMeanO: 'ほかの意味・わからない',
      qCodes: '勤務コードの意味', qCodesS: '答えると、休日と勤務日を正しく数えます。',
      codeOpt: { off: '休日', vac: '有休', duty: '勤務', standby: 'スタンバイ', training: '訓練', ground: '地上業務', other: 'その他', unknown: 'わからない' },
      codePick: '選ぶ',
      printed: '原本の表記から',
      next: '次へ', prevStep: '戻る',
      sumRead: '読めた日 {d}／{m}日', sumTime: 'フライトタイム {b}／{n}便',
      calEdit: '日付を押すと、その日を直せます。', prevNote: '薄い色の日は、前に出したスケジュールです（そのまま残ります）。', prevLab: '前に出した日',
      missH: '読めなかった日', missS: '空欄のままの日は保存しません。',
      missDuty: '勤務を入力', missBlank: '空欄のまま',
      eEdit: 'この日を直す', eAdd: 'この日を入れる',
      eKind: { operating: '乗務', deadhead: '便乗（DH）', ground: '地上', unknown: '不明' },
      eNext: '翌日', eLegs: '便・業務', eLegN: '{n}件目', eAddLeg: '便・業務を足す', eMax: '1日16件までです。',
      eUse: 'この内容にする', eSave: '保存する', eDelDay: 'この日を消す', eDelQ: 'この日の勤務と便・業務を消します。', eDelYes: '消す',
      errCode: '英数字12文字まで（/ + - も使えます）', errTime: '07:35 の形で入れてください', errApt: '英数字3〜4文字です', errLoc: '英数字2〜8文字です',
      errBlock: '1:35 の形で、24時間までです', errEmpty: '勤務コードか時刻を入れてください。', errFix: '直すところがあります。',
      save: 'この内容で保存する（{n}日）',
      saving: '保存しています…',
      cancel: 'やめる',
      errSave: '保存できませんでした。時間をおいてもう一度お試しください。',
      errLimit: '1日に取り込めるスケジュールの上限に達しました。明日また続きをどうぞ。',
      errBad: '読み取った内容の形が正しくありませんでした。読み取りからやり直してください。',
      errLogin: 'ログインが切れました。ページを開き直してログインしてください。',
      errDays: '一度に保存できるのは62日までです。ひと月ずつ取り込んでください。',
      /* 2026-11-10：何も書いていない日・知らない言葉・読めなかった日の候補・運営に知らせる */
      qBlank: '勤務表で何も書いていない日は？', qBlankOff: '休み', qBlankNone: '何も無い日',
      qLag: 'このスケジュールで飛んだ分（乗務手当・パーディアムなど）は、何月の給与明細に出ますか？',
      qLagS: '例：9月に飛んだ分が10月の明細に出るなら「翌月」。',
      qLagAuto: '明細の乗務時間とぴったり合う月を選んでおきました。違えば選び直してください。',
      qLag0: '同じ月', qLag1: '翌月', qLag2: '翌々月', qLagU: 'わからない',
      dlD: '{list}日', dlM: '{n}月{list}日', dlSep: '・', dlGrp: '・',
      chipStd: { OFF: '休み', VAC: '休暇', SBY: '待機', TRN: '訓練', GND: '地上' },
      sugApply: 'この内容で決める（{n}日）', sugA: '候補',
      fixLink: '読み取りの間違いを運営に知らせる',
      fixHead: '【スケジュールの読み取り】', fixAir: '会社：{a}', fixBuild: '読み取りの版：{b}', fixPages: '{n}枚',
      fixDid: '直した所：{l}', fixNone: '直した所：なし', fixSep: '／', fixJoin: '・',
      fixItem: '{f} {n}{u}（{s}）', fixItem2: '{f} {n}{u}', fixLegU: '便', fixDayU: '日',
      fixEmpty: '空だった', fixWrong: '違っていた',
      fixAddDay: '入れた日', fixDelDay: '消した日', fixAddLeg: '足した便・業務', fixDelLeg: '消した便・業務',
      fixNote: '一言（任意・200字まで）', fixNoteReq: '何が違っていたか（200字まで）',
      fixSend: '運営に送る', fixThanks: '運営に送りました。ありがとうございます。',
      fixShort: '何が違っていたかを4文字以上で書いてください。', fixFast: '少し時間をおいてから、もう一度お願いします。',
      fixLimit: '今日はここまでにしてください（1日5件まで）。', fixDup: '同じ内容を、すでに受け取っています。',
      fixErr: '送れませんでした。時間をおいてもう一度お試しください。'
    },
    en: {
      back: 'Back to roster',
      h: 'Import your roster',
      air: 'Airline',
      pickT: 'Upload your roster',
      pickS: 'Choose any number of screenshots or PDFs. Long rosters can overlap or be cut between images.',
      pickF: 'PDF · PNG · JPG · WebP',
      addT: 'Add images or PDFs',
      listH: 'Reading order',
      listS: 'Read from top to bottom. Put them in date order.',
      up: 'Move up', down: 'Move down', rm: 'Remove',
      fPages: '{n} pages', fPrep: 'Preparing…', fImg: 'Image', fPdf: 'PDF', fCut: '{n} more pages not read (limit)',
      fErr: {
        bad_type: 'Choose an image or a PDF', too_large: 'File too large', image_decode: 'Could not open the image',
        image_blank: 'The image is blank', pdf_locked: 'Password-protected PDFs cannot be opened', pdf_broken: 'Could not open the PDF',
        pdf_blank: 'The PDF only has blank pages', pdf_timeout: 'The PDF took too long to prepare',
        image_timeout: 'The image took too long to prepare', prep_failed: 'Could not prepare the file'
      },
      monthQ: 'Which month is this roster?',
      monthS: 'If it spans two months, pick the month it starts in.',
      priv: 'Images are sent to be read and are not stored. Only the dates, airports and times are saved — never flight numbers or names. After two years, only monthly totals are kept. Only you can see them, and you can delete them anytime.',
      read: 'Read ({n} pages)',
      tooMany: 'Up to {n} pages can be read at once.',
      readH: 'Reading your roster',
      stop: 'Stop',
      stepPrep: 'Preparing images', stepRead: 'Reading dates and flights ({i}/{n})', stepCal: 'Building the calendar',
      failH: 'Could not read page {i}',
      retry: 'Read again', skip: 'Skip this page', useSoFar: 'Review what was read',
      why: {
        login_required: 'Your login has expired. Reload the page and log in again.',
        rate_limited: 'You have reached today’s page limit. Please continue tomorrow.',
        rate_limited_global: 'Reading is busy right now. Please try again later.',
        quota_unavailable: 'Reading is busy right now. Please try again later.',
        read_busy: 'Reading is busy. Please try again.',
        timeout: 'No reply in time.',
        network: 'Could not connect. Please try again with a better connection.',
        not_a_roster: 'This does not look like a roster.',
        undated: 'The dates could not be read. Check which month this roster is.',
        image_too_large: 'The image is too large.',
        read_truncated: 'Too much on one image to read it all. Try splitting it into two screenshots.',
        other: 'Could not read this page.'
      },
      noneRead: 'No page could be read.',
      confH: 'Check what was read',
      found: '{n} days read ({a} – {b})',
      legsN: '{n} legs & duties',
      issH: 'Please check',
      iCut: '{d}: cut off at the edge of an image. Add the next screenshot, or continue as it is.',
      iConf: '{d}: {f} differs between images ({v}).',
      iUse: 'Using {u}.',
      iPart: '{d}: leg {n} is partly cut off.',
      iAmb: '{d}: two legs looked the same and could not be told apart.',
      iMonth: 'No days from the month you picked ({m}) were found. Check the month.',
      iMore: '{n} more',
      f: {
        code: 'Duty code', d_on: 'D-ON', d_off: 'D-OFF', 'leg.flight': 'Flight number', 'leg.from': 'Origin', 'leg.to': 'Destination',
        'leg.loc': 'Location', 'leg.out': 'Off-block time', 'leg.in': 'On-block time', 'leg.block': 'Flight time',
        'leg.kind': 'Leg type', 'hints.kind': 'Actual or planned', 'hints.time_ref': 'Time reference'
      },
      addMore: 'Add screenshots',
      qH: 'A few questions first', qS: 'Next time, for this airline, you will only be asked about anything new.',
      qKind: 'This roster shows', qKindA: 'Actual (as flown)', qKindP: 'Planned',
      qRef: 'Times are in', qRefL: 'Local time', qRefU: 'UTC',
      qMean: 'The TIME column on legs is', qMeanB: 'Block time (chocks off to chocks on)', qMeanF: 'Flight time (takeoff to landing)', qMeanO: 'Something else / not sure',
      qCodes: 'What these duty codes mean', qCodesS: 'Your answers let us count days off and duty days correctly.',
      codeOpt: { off: 'Day off', vac: 'Annual leave', duty: 'Duty', standby: 'Standby', training: 'Training', ground: 'Ground duty', other: 'Other', unknown: 'Not sure' },
      codePick: 'Choose',
      printed: 'as printed',
      next: 'Next', prevStep: 'Back',
      sumRead: 'Days read {d}/{m}', sumTime: 'Flight times {b}/{n}',
      calEdit: 'Tap a date to fix that day.', prevNote: 'Faded days are from rosters you added before (they stay as they are).', prevLab: 'Added before',
      missH: 'Days not read', missS: 'Days left blank are not saved.',
      missDuty: 'Enter duty', missBlank: 'Leave blank',
      eEdit: 'Edit this day', eAdd: 'Add this day',
      eKind: { operating: 'Operating', deadhead: 'Deadhead (DH)', ground: 'Ground', unknown: 'Not sure' },
      eNext: 'Next day', eLegs: 'Flights & duties', eLegN: 'Item {n}', eAddLeg: 'Add a flight or duty', eMax: 'Up to 16 per day.',
      eUse: 'Use this', eSave: 'Save', eDelDay: 'Delete this day', eDelQ: 'This deletes the duty and all flights for this day.', eDelYes: 'Delete',
      errCode: 'Up to 12 letters or digits (/ + - allowed)', errTime: 'Enter a time like 07:35', errApt: '3–4 letters or digits', errLoc: '2–8 letters or digits',
      errBlock: 'Like 1:35, up to 24 hours', errEmpty: 'Enter a duty code or times.', errFix: 'Please fix the marked fields.',
      save: 'Save ({n} days)',
      saving: 'Saving…',
      cancel: 'Cancel',
      errSave: 'Could not save. Please try again in a moment.',
      errLimit: 'You have reached today’s roster import limit. Please continue tomorrow.',
      errBad: 'What was read was not in a valid shape. Please read the roster again.',
      errLogin: 'Your login has expired. Reload the page and log in again.',
      errDays: 'Up to 62 days can be saved at once. Please import one month at a time.',
      qBlank: 'Days with nothing printed are…', qBlankOff: 'Day off', qBlankNone: 'Nothing (don’t save)',
      qLag: 'Which month’s payslip pays for the flying on this roster (flight pay, per diem, etc.)?',
      qLagS: 'E.g. if September’s flying is paid on your October payslip, choose “Next month”.',
      qLagAuto: 'We picked the month whose payslip flight hours match exactly. Change it if that’s wrong.',
      qLag0: 'Same month', qLag1: 'Next month', qLag2: 'Two months later', qLagU: 'Not sure',
      dlD: '{s} {list}', dlM: '{s} {list}', dlSep: ', ', dlGrp: '; ',
      chipStd: { OFF: 'Off', VAC: 'Leave', SBY: 'Standby', TRN: 'Training', GND: 'Ground' },
      sugApply: 'Apply these ({n} days)', sugA: 'suggested',
      fixLink: 'Report a reading mistake',
      fixHead: '[Roster reading] ', fixAir: 'Airline: {a}', fixBuild: 'Reader build: {b}', fixPages: 'Pages: {n}',
      fixDid: 'Corrected: {l}', fixNone: 'Corrected: nothing', fixSep: ' / ', fixJoin: ', ',
      fixItem: '{f}: {n} ({s})', fixItem2: '{f}: {n}', fixLegU: '', fixDayU: '',
      fixEmpty: 'was blank', fixWrong: 'was wrong',
      fixAddDay: 'Days added', fixDelDay: 'Days deleted', fixAddLeg: 'Legs & duties added', fixDelLeg: 'Legs & duties removed',
      fixNote: 'Comment (optional, up to 200 characters)', fixNoteReq: 'What was wrong (up to 200 characters)',
      fixSend: 'Send to the team', fixThanks: 'Sent to the team. Thank you.',
      fixShort: 'Please describe what was wrong (at least 4 characters).', fixFast: 'Please wait a moment and try again.',
      fixLimit: 'That is enough for today (5 per day).', fixDup: 'We have already received the same report.',
      fixErr: 'Could not send. Please try again in a moment.'
    }, /*PV-MSG:es*/ es: {
      back: 'Volver a la programación',
      h: 'Importa tu programación',
      air: 'Aerolínea',
      pickT: 'Sube tu programación',
      pickS: 'Elige todas las capturas o PDF que quieras. Las programaciones largas pueden repetirse o cortarse entre imágenes.',
      pickF: 'PDF · PNG · JPG · WebP',
      addT: 'Agregar imágenes o PDF',
      listH: 'Orden de lectura',
      listS: 'Se leen de arriba abajo. Ordénalas por fecha.',
      up: 'Subir', down: 'Bajar', rm: 'Quitar',
      fPages: '{n} páginas', fPrep: 'Preparando…', fImg: 'Imagen', fPdf: 'PDF', fCut: '{n} páginas más no se leen (límite)',
      fErr: {
        bad_type: 'Elige una imagen o un PDF', too_large: 'Archivo demasiado grande', image_decode: 'No se pudo abrir la imagen',
        image_blank: 'La imagen está en blanco', pdf_locked: 'No se pueden abrir PDF protegidos con contraseña', pdf_broken: 'No se pudo abrir el PDF',
        pdf_blank: 'El PDF solo tiene páginas en blanco', pdf_timeout: 'El PDF tardó demasiado en prepararse',
        image_timeout: 'La imagen tardó demasiado en prepararse', prep_failed: 'No se pudo preparar el archivo'
      },
      monthQ: '¿De qué mes es esta programación?',
      monthS: 'Si abarca dos meses, elige el mes en que empieza.',
      priv: 'Las imágenes se envían para leerlas y no se guardan. Solo se guardan las fechas, los aeropuertos y las horas, nunca números de vuelo ni nombres. Después de dos años solo se conservan los totales mensuales. Solo tú puedes verlos y puedes eliminarlos cuando quieras.',
      read: 'Leer ({n} páginas)',
      tooMany: 'Se pueden leer hasta {n} páginas a la vez.',
      readH: 'Leyendo tu programación',
      stop: 'Detener',
      stepPrep: 'Preparando las imágenes', stepRead: 'Leyendo fechas y vuelos ({i}/{n})', stepCal: 'Armando el calendario',
      failH: 'No se pudo leer la página {i}',
      retry: 'Leer de nuevo', skip: 'Omitir esta página', useSoFar: 'Revisar lo leído',
      why: {
        login_required: 'Tu sesión expiró. Vuelve a cargar la página e inicia sesión de nuevo.',
        rate_limited: 'Alcanzaste el límite de páginas de hoy. Continúa mañana.',
        rate_limited_global: 'La lectura está muy ocupada ahora. Inténtalo más tarde.',
        quota_unavailable: 'La lectura está muy ocupada ahora. Inténtalo más tarde.',
        read_busy: 'La lectura está ocupada. Inténtalo de nuevo.',
        timeout: 'No hubo respuesta a tiempo.',
        network: 'No se pudo conectar. Inténtalo de nuevo con una mejor conexión.',
        not_a_roster: 'Esto no parece una programación.',
        undated: 'No se pudieron leer las fechas. Revisa de qué mes es esta programación.',
        image_too_large: 'La imagen es demasiado grande.',
        read_truncated: 'Hay demasiada información en una imagen para leerla completa. Prueba dividirla en dos capturas.',
        other: 'No se pudo leer esta página.'
      },
      noneRead: 'No se pudo leer ninguna página.',
      confH: 'Revisa lo que se leyó',
      found: 'Se leyeron {n} días ({a} – {b})',
      legsN: '{n} tramos y actividades',
      issH: 'Revisa esto',
      iCut: '{d}: quedó cortado en el borde de una imagen. Agrega la siguiente captura o continúa así.',
      iConf: '{d}: {f} es distinto entre imágenes ({v}).',
      iUse: 'Se usa {u}.',
      iPart: '{d}: el tramo {n} está cortado en parte.',
      iAmb: '{d}: dos tramos se veían iguales y no se pudieron distinguir.',
      iMonth: 'No se encontraron días del mes que elegiste ({m}). Revisa el mes.',
      iMore: '{n} más',
      f: {
        code: 'Código de servicio', d_on: 'D-ON', d_off: 'D-OFF', 'leg.flight': 'Número de vuelo', 'leg.from': 'Origen', 'leg.to': 'Destino',
        'leg.loc': 'Lugar', 'leg.out': 'Hora off-block', 'leg.in': 'Hora on-block', 'leg.block': 'Tiempo de vuelo',
        'leg.kind': 'Tipo de tramo', 'hints.kind': 'Real o planificada', 'hints.time_ref': 'Referencia horaria'
      },
      addMore: 'Agregar capturas',
      qH: 'Primero, unas preguntas', qS: 'La próxima vez, para esta aerolínea, solo te preguntaremos lo nuevo.',
      qKind: 'Esta programación muestra', qKindA: 'Real (lo volado)', qKindP: 'Lo planificado',
      qRef: 'Las horas están en', qRefL: 'Hora local', qRefU: 'UTC',
      qMean: 'La columna TIME de los tramos es', qMeanB: 'Tiempo block (de calzos fuera a calzos dentro)', qMeanF: 'Tiempo de vuelo (del despegue al aterrizaje)', qMeanO: 'Otra cosa / no estoy seguro',
      qCodes: 'Qué significan estos códigos de servicio', qCodesS: 'Con tus respuestas contamos bien los días libres y los días de servicio.',
      codeOpt: { off: 'Día libre', vac: 'Vacaciones anuales', duty: 'Servicio', standby: 'Standby', training: 'Entrenamiento', ground: 'Actividad en tierra', other: 'Otro', unknown: 'No estoy seguro' },
      codePick: 'Elegir',
      printed: 'según lo impreso',
      next: 'Siguiente', prevStep: 'Volver',
      sumRead: 'Días leídos {d}/{m}', sumTime: 'Tiempos de vuelo {b}/{n}',
      calEdit: 'Toca una fecha para corregir ese día.', prevNote: 'Los días atenuados son de programaciones que agregaste antes (se mantienen igual).', prevLab: 'Agregado antes',
      missH: 'Días no leídos', missS: 'Los días que quedan en blanco no se guardan.',
      missDuty: 'Ingresar servicio', missBlank: 'Dejar en blanco',
      eEdit: 'Corregir este día', eAdd: 'Agregar este día',
      eKind: { operating: 'Operando', deadhead: 'Deadhead (DH)', ground: 'En tierra', unknown: 'No sé' },
      eNext: 'Día siguiente', eLegs: 'Vuelos y servicios', eLegN: 'Elemento {n}', eAddLeg: 'Agregar un vuelo o servicio', eMax: 'Hasta 16 por día.',
      eUse: 'Usar esto', eSave: 'Guardar', eDelDay: 'Eliminar este día', eDelQ: 'Esto elimina el servicio y todos los vuelos de este día.', eDelYes: 'Eliminar',
      errCode: 'Hasta 12 letras o dígitos (se permiten / + -)', errTime: 'Ingresa una hora como 07:35', errApt: '3–4 letras o dígitos', errLoc: '2–8 letras o dígitos',
      errBlock: 'Como 1:35, hasta 24 horas', errEmpty: 'Ingresa un código de servicio o las horas.', errFix: 'Corrige los campos marcados.',
      save: 'Guardar ({n} días)',
      saving: 'Guardando…',
      cancel: 'Cancelar',
      errSave: 'No se pudo guardar. Inténtalo de nuevo en un momento.',
      errLimit: 'Alcanzaste el límite de importaciones de hoy. Continúa mañana.',
      errBad: 'Lo leído no tiene un formato válido. Vuelve a leer la programación.',
      errLogin: 'Tu sesión expiró. Vuelve a cargar la página e inicia sesión de nuevo.',
      errDays: 'Se pueden guardar hasta 62 días a la vez. Importa un mes a la vez.',
      qBlank: 'Los días sin nada impreso son…', qBlankOff: 'Día libre', qBlankNone: 'Nada (no se guardan)',
      qLag: '¿En la nómina de qué mes se paga lo volado en esta programación (pago por vuelo, viáticos, etc.)?',
      qLagS: 'Por ejemplo, si lo volado en septiembre se paga en la nómina de octubre, elige «Mes siguiente».',
      qLagAuto: 'Elegimos el mes cuyas horas de vuelo coinciden exactamente con la nómina. Cámbialo si no es correcto.',
      qLag0: 'Mismo mes', qLag1: 'Mes siguiente', qLag2: 'Dos meses después', qLagU: 'No lo sé',
      dlD: '{list} {s}', dlM: '{list} {s}', dlSep: ', ', dlGrp: '; ',
      chipStd: { OFF: 'Libre', VAC: 'Vacaciones', SBY: 'Standby', TRN: 'Entrenamiento', GND: 'Tierra' },
      sugApply: 'Aplicar estos ({n} días)', sugA: 'sugerido',
      fixLink: 'Informar un error de lectura',
      fixHead: '[Lectura de la programación] ', fixAir: 'Aerolínea: {a}', fixBuild: 'Versión del lector: {b}', fixPages: 'Páginas: {n}',
      fixDid: 'Corregido: {l}', fixNone: 'Corregido: nada', fixSep: ' / ', fixJoin: ', ',
      fixItem: '{f}: {n} ({s})', fixItem2: '{f}: {n}', fixLegU: '', fixDayU: '',
      fixEmpty: 'estaba vacío', fixWrong: 'estaba mal',
      fixAddDay: 'Días agregados', fixDelDay: 'Días eliminados', fixAddLeg: 'Tramos y actividades agregados', fixDelLeg: 'Tramos y actividades eliminados',
      fixNote: 'Comentario (opcional, hasta 200 caracteres)', fixNoteReq: 'Qué estaba mal (hasta 200 caracteres)',
      fixSend: 'Enviar al equipo', fixThanks: 'Enviado al equipo. Gracias.',
      fixShort: 'Describe qué estaba mal (al menos 4 caracteres).', fixFast: 'Espera un momento e inténtalo de nuevo.',
      fixLimit: 'Es suficiente por hoy (5 por día).', fixDup: 'Ya recibimos el mismo reporte.',
      fixErr: 'No se pudo enviar. Inténtalo de nuevo en un momento.'
    } /*/PV-MSG:es*/
  };
  var T_ALL = T;
  T = (w.PV_T && w.PV_T(T, L)) || T[L];
  /* 足したばかりの文言が es の辞書にまだ無いあいだは英語で出す（gen-msg.mjs が埋めるまで） */
  if (T === T_ALL.es) Object.keys(T_ALL.en).forEach(function (k) { if (T[k] == null) T[k] = T_ALL.en[k]; });

  /* ── 定数（payslip.js と同じ考え方）────────────────────────── */
  var MAX_EDGE = 2560, JPEG_Q = 0.86;
  var MAX_PAGES = 30;                         // 1回に読むページ（関数の上限 60・1日の上限 60 の手前）
  var MAX_IMG_BYTES = 25 * 1024 * 1024, MAX_PDF_BYTES = 30 * 1024 * 1024;
  var PREP_MS = 45000, READ_MS = 90000;
  var MAX_DAYS = 62;
  var PDF_JS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.min.js';
  var PDF_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js';
  var PDF_MAXPX = 12e6;
  var FATAL = { login_required: 1, rate_limited: 1, rate_limited_global: 1, quota_unavailable: 1, server_misconfigured: 1 };

  var U = null, seq = 0;

  /* ── 小道具 ─────────────────────────────────────────────── */
  function tag(code) { var e = new Error(code); e.pvCode = code; return e; }
  function withTimeout(p, ms, code) {
    return new Promise(function (ok, ng) {
      var t = setTimeout(function () { ng(tag(code)); }, ms);
      Promise.resolve(p).then(function (v) { clearTimeout(t); ok(v); }, function (e) { clearTimeout(t); ng(e); });
    });
  }
  function hex(buf) {
    var a = new Uint8Array(buf), s = '';
    for (var i = 0; i < a.length; i++) s += (a[i] < 16 ? '0' : '') + a[i].toString(16);
    return s;
  }
  function sha256(buf) { return w.crypto.subtle.digest('SHA-256', buf).then(hex); }
  function blobBuf(b) { return b.arrayBuffer ? b.arrayBuffer() : new Response(b).arrayBuffer(); }
  function lastMonth() { return P.ymAdd(P.nowYm(), -1); }
  function fmtDate(date) { return date ? P.dayTitle(date) : '—'; }

  /* ── 画像にする（白で塗ってから描く・長辺 2560・JPEG）──────────── */
  function canvasOf(Wd, Ht) {
    var c = d.createElement('canvas');
    c.width = Math.max(1, Math.round(Wd)); c.height = Math.max(1, Math.round(Ht));
    var cx = c.getContext('2d');
    cx.fillStyle = '#fff';
    cx.fillRect(0, 0, c.width, c.height);
    return c;
  }
  function blank(c) {
    try {
      var n = 64, t = d.createElement('canvas');
      t.width = n; t.height = n;
      var x = t.getContext('2d');
      x.drawImage(c, 0, 0, n, n);
      var px = x.getImageData(0, 0, n, n).data, lo = 765, hi = 0;
      for (var i = 0; i < px.length; i += 4) { var v = px[i] + px[i + 1] + px[i + 2]; if (v < lo) lo = v; if (v > hi) hi = v; }
      return hi - lo < 12;
    } catch (e) { return false; }   // 確かめられないときは止めない
  }
  function thumbOf(c) {
    var s = Math.min(1, 120 / Math.max(c.width, c.height)), t = canvasOf(c.width * s, c.height * s);
    t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
    try { return t.toDataURL('image/jpeg', 0.7); } catch (e) { return ''; }
  }
  function pageOf(c) {
    return new Promise(function (ok, ng) {
      c.toBlob(function (b) { b ? ok(b) : ng(tag('prep_failed')); }, 'image/jpeg', JPEG_Q);
    }).then(function (blob) {
      return blobBuf(blob).then(sha256).then(function (h) { return { blob: blob, sha: h, thumb: thumbOf(c) }; });
    });
  }
  function loadImage(file) {
    return new Promise(function (ok, ng) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () { URL.revokeObjectURL(url); ok(img); };
      img.onerror = function () { URL.revokeObjectURL(url); ng(tag('image_decode')); };
      img.src = url;
    });
  }
  function fromImage(file) {
    return loadImage(file).then(function (img) {
      var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      if (!iw || !ih) throw tag('image_decode');
      var s = Math.min(1, MAX_EDGE / Math.max(iw, ih)), c = canvasOf(iw * s, ih * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      if (blank(c)) throw tag('image_blank');
      return pageOf(c).then(function (p) { return { pages: [p], total: 1 }; });
    });
  }
  var pdfLib = null;
  function loadPdf() {
    if (w.pdfjsLib) return Promise.resolve(w.pdfjsLib);
    if (pdfLib) return pdfLib;
    pdfLib = new Promise(function (ok, ng) {
      var s = d.createElement('script');
      s.src = PDF_JS;
      s.onload = function () { w.pdfjsLib ? ok(w.pdfjsLib) : ng(tag('pdf_broken')); };
      s.onerror = function () { pdfLib = null; ng(tag('pdf_broken')); };
      d.head.appendChild(s);
    });
    return pdfLib;
  }
  /* PDF は全ページを画像に（残りの枠 room まで）。白紙のページは飛ばす */
  function fromPdf(file, room) {
    var lib;
    return loadPdf().then(function (l) {
      lib = l;
      lib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
      return blobBuf(file);
    }).then(function (buf) {
      /* isEvalSupported:false ＝ PDF の中の JavaScript を動かさない */
      return lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise
        .catch(function (e) { throw tag(e && e.name === 'PasswordException' ? 'pdf_locked' : 'pdf_broken'); });
    }).then(function (doc) {
      var n = Math.min(doc.numPages, room), out = [], k = 0;
      function step() {
        if (k >= n) return Promise.resolve();
        k++;
        return doc.getPage(k).then(function (page) {
          var base = page.getViewport({ scale: 1 });
          var s = Math.min(MAX_EDGE / Math.max(base.width, base.height), Math.sqrt(PDF_MAXPX / (base.width * base.height)));
          var vp = page.getViewport({ scale: s });
          var c = canvasOf(vp.width, vp.height);
          return page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.then(function () {
            if (blank(c)) return null;
            return pageOf(c);
          });
        }).then(function (p) { if (p) out.push(p); return step(); });
      }
      return step().then(function () {
        if (!out.length) throw tag('pdf_blank');
        return { pages: out, total: doc.numPages, cut: Math.max(0, doc.numPages - n) };
      });
    });
  }
  function isPdf(f) { return f.type === 'application/pdf' || /\.pdf$/i.test(f.name || ''); }
  function isImg(f) { return /^image\//.test(f.type || '') || /\.(png|jpe?g|webp|heic|heif|gif)$/i.test(f.name || ''); }
  function pageCount(except) {
    var n = 0;
    U.items.forEach(function (it) { if (it !== except && it.pages) n += it.pages.length; });
    return n;
  }

  function addFiles(list) {
    Array.prototype.forEach.call(list || [], function (f) {
      var it = { id: 'f' + (++seq), name: String(f.name || '').slice(0, 80), pdf: isPdf(f), file: f, status: 'prep', pages: null, why: null, cut: 0 };
      if (!it.pdf && !isImg(f)) { it.status = 'err'; it.why = 'bad_type'; }
      else if (f.size > (it.pdf ? MAX_PDF_BYTES : MAX_IMG_BYTES)) { it.status = 'err'; it.why = 'too_large'; }
      U.items.push(it);
    });
    render();
    pump();
  }
  /* 準備は1つずつ（大きな PDF を同時に開かない） */
  var pumping = false;
  function pump() {
    if (pumping || !U) return;
    var it = U.items.filter(function (x) { return x.status === 'prep'; })[0];
    if (!it) return;
    pumping = true;
    var me = U, room = Math.max(1, MAX_PAGES - pageCount(it));
    var job = it.pdf ? fromPdf(it.file, room) : fromImage(it.file);
    withTimeout(job, PREP_MS, it.pdf ? 'pdf_timeout' : 'image_timeout').then(function (r) {
      it.pages = r.pages; it.cut = r.cut || 0; it.status = 'ok'; it.file = null;
    }, function (e) {
      it.status = 'err'; it.why = (e && e.pvCode) || 'prep_failed'; it.file = null;
      report(it.why, 'prep');
    }).then(function () {
      pumping = false;
      if (me !== U) return;
      render();
      pump();
    });
  }

  /* 読み取りの側へ、端末で止まった理由だけ知らせる（中身は送らない・失敗しても何もしない） */
  function report(code, stage) {
    try {
      Promise.resolve(U && U.ctx.sb.functions.invoke('parse-roster', { body: { report: { reason: code, stage: stage, kb: 0 } } })).catch(function () {});
    } catch (e) {}
  }

  /* ── 読む ───────────────────────────────────────────────── */
  function allPages() {
    var out = [];
    U.items.forEach(function (it) { if (it.status === 'ok') it.pages.forEach(function (p) { out.push(p); }); });
    return out;
  }
  function hint() { return { year: +U.month.slice(0, 4), month: +U.month.slice(5, 7) }; }
  function renumber(r, page) {
    var c = JSON.parse(JSON.stringify(r));
    (c.days || []).forEach(function (dy) { dy.page = page; (dy.legs || []).forEach(function (l) { l.page = page; }); });
    return c;
  }
  function invoke(b64, page, pages, tail) {
    var body = { image_b64: b64, mime: 'image/jpeg', lang: w.PV_LANG || L, page: page, pages: pages, hint: hint(), prev_tail: tail };
    return withTimeout(U.ctx.sb.functions.invoke('parse-roster', { body: body }), READ_MS, 'timeout').then(function (r) {
      if (!r) return { ok: false, reason: 'network' };
      if (r.error) {
        var cx = r.error.context;
        return (cx && typeof cx.json === 'function')
          ? cx.json().then(function (j) { return j && j.reason ? j : { ok: false, reason: 'network' }; }, function () { return { ok: false, reason: 'network' }; })
          : { ok: false, reason: 'network' };
      }
      return r.data || { ok: false, reason: 'network' };
    }, function (e) { return { ok: false, reason: (e && e.pvCode) === 'timeout' ? 'timeout' : 'network' }; });
  }
  function b64Of(blob) {
    return new Promise(function (ok, ng) {
      var fr = new FileReader();
      fr.onload = function () { ok(String(fr.result).split(',')[1]); };
      fr.onerror = function () { ng(tag('prep_failed')); };
      fr.readAsDataURL(blob);
    });
  }
  /* ── 読み取り中の画面（2026-11-09 オーナー「明細と同じように、別の画面で％を」）──────────────
     payslip.js の loadOpen / ringEl / ringTick / loadStep / loadDone / loadClose と同じ形（見た目は my-roster.css の写し）。
     画面全体を面の色で覆い、0〜100% の輪と3つの段（画像を整える・日付と便を読む・カレンダーにまとめる）だけ。下に小さく「止める」。
     ★％＝（読み終えたページ ＋ いま読んでいるページの時間で伸ばした分）÷ ページ数。前より小さい値は出さない。
       ページの中の進み具合はサーバーから返ってこないので時間で伸ばし、だんだん遅くなって次のページの手前で止まる。
       100 は全部のページが終わったときだけ。
     ★スクロールを止めるのは html の class（ps-load-lock）。body.style.overflow を直に書かない。 */
  var LOAD = null, RING = null;
  var PAGE_TAU = 12, PAGE_CAP = 0.95;          // 1ページの伸び方（秒）と、返事が来るまでの上限（1ページのうち）
  var SVGNS = 'http://www.w3.org/2000/svg';
  function now() { return (w.performance && w.performance.now) ? w.performance.now() : Date.now(); }
  function mk(tagName, cls, html) { var e = d.createElement(tagName); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function ringEl(start) {
    var box = mk('div', 'ps-ring');
    box.setAttribute('role', 'progressbar');
    box.setAttribute('aria-valuemin', '0');
    box.setAttribute('aria-valuemax', '100');
    box.setAttribute('aria-valuenow', String(Math.floor(start)));
    box.setAttribute('aria-label', T.readH);
    var svg = d.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('aria-hidden', 'true');
    var bg = d.createElementNS(SVGNS, 'circle'), fg = d.createElementNS(SVGNS, 'circle');
    [bg, fg].forEach(function (c) { c.setAttribute('cx', '60'); c.setAttribute('cy', '60'); c.setAttribute('r', '52'); });
    bg.setAttribute('class', 'ps-ring-bg');
    fg.setAttribute('class', 'ps-ring-fg');
    fg.setAttribute('pathLength', '100');
    fg.setAttribute('stroke-dasharray', '100');
    fg.setAttribute('stroke-dashoffset', String(100 - start));
    fg.setAttribute('transform', 'rotate(-90 60 60)');      // 12時から時計回り
    svg.appendChild(bg);
    svg.appendChild(fg);
    box.appendChild(svg);
    var n = mk('span', 'ps-ring-n', Math.floor(start) + '<small>%</small>');
    n.setAttribute('aria-hidden', 'true');
    box.appendChild(n);
    RING = { tgt: start, d: start, raf: 0, fg: fg, n: n, box: box, shown: Math.floor(start), done: false };
    return box;
  }
  function ringPaint() {
    if (!RING) return;
    var v = RING.d >= 99.95 ? 100 : Math.floor(RING.d);
    RING.fg.setAttribute('stroke-dashoffset', String(100 - RING.d));
    if (v !== RING.shown) {
      RING.shown = v;
      RING.n.innerHTML = v + '<small>%</small>';
      RING.box.setAttribute('aria-valuenow', String(v));
    }
  }
  /* 読み終えたページ ＋ いまのページの時間で伸ばした分（返事が来るまで 1ページぶんには届かない） */
  function ringWant(run) {
    if (!run || !run.n) return 0;
    if (run.i >= run.n) return 100;
    var t = Math.max(0, (now() - run.t0) / 1000);
    return 100 * (run.i + PAGE_CAP * (1 - Math.exp(-t / PAGE_TAU))) / run.n;
  }
  function ringTick() {
    if (!RING || !LOAD) return;
    var run = LOAD.run;
    RING.tgt = Math.max(RING.tgt, RING.done ? 100 : ringWant(run));
    if (run) run.pct = RING.tgt;                             // 失敗の札から開き直しても下がらない
    RING.d += (RING.tgt - RING.d) * 0.18;                   // ページが変わっても跳ばずに追いつく
    if (RING.tgt - RING.d < 0.05) RING.d = RING.tgt;
    ringPaint();
    RING.raf = w.requestAnimationFrame ? w.requestAnimationFrame(ringTick) : setTimeout(ringTick, 50);
  }
  function ringStop() {
    if (!RING) return;
    if (w.cancelAnimationFrame) w.cancelAnimationFrame(RING.raf); else clearTimeout(RING.raf);
    RING = null;
  }
  function loadOpen(run) {
    if (LOAD) { LOAD.run = run; return; }
    var el = mk('div', 'ps-load ps-state is-busy');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-busy', 'true');
    el.tabIndex = -1;
    var inner = mk('div', 'ps-load-in');
    inner.appendChild(ringEl(run.pct || 0));
    inner.appendChild(mk('p', 'ps-load-t', esc(T.readH)));
    var ol = mk('ol', 'ps-steps');
    [T.stepPrep, T.stepRead, T.stepCal].forEach(function (name) {
      var li = mk('li', '');
      li.appendChild(mk('i', 'ps-step-dot'));
      li.appendChild(mk('span', '', esc(name)));
      li.setAttribute('data-s', 'todo');
      ol.appendChild(li);
    });
    inner.appendChild(ol);
    var stop = mk('button', 'ru-stop', esc(T.stop));
    stop.type = 'button';
    stop.addEventListener('click', stopRead);
    inner.appendChild(stop);
    el.appendChild(inner);
    d.body.appendChild(el);
    d.documentElement.classList.add('ps-load-lock');
    LOAD = { el: el, run: run };
    loadStep(run.i > 0 || run.out.some(Boolean) ? 1 : 0);
    loadLabel(run);
    try { el.focus({ preventScroll: true }); } catch (e) {}  // 覆いの後ろにフォーカスを残さない
    ringTick();
  }
  /* at: いま動いている段（0＝整える・1＝読む・2＝まとめる・3＝全部終わった） */
  function loadStep(at) {
    if (!LOAD) return;
    LOAD.el.className = 'ps-load ps-state ' + (at === 0 ? 'is-busy' : at < 3 ? 'is-read' : 'is-done');
    [].forEach.call(LOAD.el.querySelectorAll('.ps-steps li'), function (li, i) {
      li.setAttribute('data-s', i < at ? 'done' : i === at ? 'active' : 'todo');
    });
  }
  function loadLabel(run) {
    if (!LOAD || !run) return;
    var sp = LOAD.el.querySelectorAll('.ps-steps li span')[1];
    if (sp) sp.textContent = fill(T.stepRead, { i: Math.min(run.i + 1, run.n), n: run.n });
  }
  function loadClose() {
    if (!LOAD) return;
    var n = LOAD.el;
    LOAD = null;
    ringStop();
    d.documentElement.classList.remove('ps-load-lock');
    n.classList.add('is-out');
    setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 260);
  }
  /* 3つそろった ✓ を一拍（650ms）見せてから覆いを外し、次の画面へ。覆いが無ければすぐ。 */
  function loadDone(go) {
    if (!LOAD) { go(); return; }
    loadStep(3);
    if (RING) RING.done = true;
    setTimeout(function () { go(); loadClose(); }, 650);
  }
  function stopRead() {
    if (U && U.run) U.run.stop = true;
    loadClose();
    if (!U) return;
    U.run = null; U.step = 'pick';
    render();
    var b = U.box.querySelector('[data-u="read"]');
    if (b && !b.disabled) b.focus(); else focusHead();
  }

  /* ── 読む（1ページずつ）────────────────────────────────── */
  function startRead() {
    var pages = allPages();
    if (!pages.length || pages.length > MAX_PAGES) return;
    U.err = null;
    U.step = 'read';
    U.run = { i: 0, n: pages.length, pages: pages, out: new Array(pages.length), fail: null, stop: false, t0: now(), pct: 0 };
    render();
    loadOpen(U.run);
    next(U.run);
  }
  function tailBefore(run, k) {
    for (var j = k - 1; j >= 0; j--) if (run.out[j]) return (run.out[j].days || []).slice(-2);
    return [];
  }
  function next(run) {
    if (!U || run !== U.run || run.stop) return;
    if (run.i >= run.n) return finishRead(run);
    var k = run.i, pg = run.pages[k], prev = k ? run.pages[k - 1].sha : '';
    var key = pg.sha + '|' + U.month + '|' + prev;
    run.t0 = now();
    loadLabel(run);
    if (U.cache[key]) {                       // 同じページ・同じ月・同じ並びは読み直さない（足したときの二重の費用を避ける）
      run.out[k] = renumber(U.cache[key], k + 1);
      run.i++;
      loadStep(1);
      return next(run);
    }
    var tail = tailBefore(run, k);
    b64Of(pg.blob).then(function (b64) {
      if (U && run === U.run) loadStep(1);
      return invoke(b64, k + 1, run.n, tail);
    }, function () { return { ok: false, reason: 'prep_failed' }; })
      .then(function (res) {
        if (!U) return;
        if (res && res.ok && res.roster) U.cache[key] = res.roster;   // 止めたあとに届いた答えも取っておく（読み直しの費用を出さない）
        if (res && typeof res.build === 'string' && /^[0-9A-Za-z.\-]{1,20}$/.test(res.build)) U.build = res.build;   // 運営に知らせるときの「読み取りの版」
        if (run !== U.run || run.stop) return;
        if (res && res.ok && res.roster) {
          run.out[k] = res.roster;
          run.i++;
          next(run);
        } else {
          var why = (res && res.reason) || 'other';
          if (why === 'network' || why === 'timeout') report(why, why === 'timeout' ? 'timeout' : 'network');
          run.fail = { k: k, why: why };
          loadClose();                          // 覆いを外して、読み取りの箱の中に選べる道を出す
          render();
          var b = U.box.querySelector('.ru-failc .is-primary');
          if (b) b.focus();
        }
      });
  }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function finishRead(run) {
    var got = run.out.filter(Boolean);
    if (!got.length) { loadClose(); U.step = 'pick'; U.err = T.noneRead; render(); focusHead(); return; }
    loadStep(2);
    prepare(R.mergePages(got), run.n);
    var to = needAsk() ? 'ask' : 'check';
    loadDone(function () {
      if (!U) return;
      if (to === 'ask') markAsked();
      U.step = to;
      render();
      focusHead(true);
    });
  }
  /* 読み取ってまとめた1本（mergePages の答え）を、確かめる画面の状態にする（検査 db/test-roster-ui.mjs もここを通す） */
  function prepare(M, pages) {
    U.merged = M;
    U.pagesSent = pages;
    /* 読めたまま（本人が直す前）を残す：「空欄のまま」で戻す先・読めなかった日の一覧の元・運営に知らせるときの比べる元 */
    U.base = {};
    U.merged.days.forEach(function (x) { U.base[x.date] = clone(x); });
    U.baseIssues = clone(U.merged.issues || []);
    U.merged.issues = U.merged.issues || [];
    /* スクリーンショットを足して読み直しても、本人が直した日はそのまま（本人が入れたものが勝つ） */
    Object.keys(U.edits).forEach(function (dt) { applyEdit(dt, U.edits[dt]); });
    var cv = coverage(Object.keys(U.base).map(function (k) { return U.base[k]; }), U.merged.period);
    U.range = cv.range;
    U.missing = cv.missing;
    /* 知らない言葉の印に A・B…（読み直しても同じ印は同じ字のまま） */
    U.merged.days.forEach(function (x) { if (x && P.isTok(x.code)) tokName(x.code); });
    prefill();
    applyBlank();
  }
  /* 会社の辞書（同じ会社の3人以上がそろえた答え）。形の合わないものは捨てる。届かなければ空（読み取りの途中で届けば、その答えから使う） */
  function learned() {
    var j = U.ctx.learned, o = { codes: {} };
    if (j && typeof j === 'object' && j.ok !== false) {
      if (/^(actual|planned)$/.test(j.kind)) o.kind = j.kind;
      if (/^(local|utc)$/.test(j.time_ref)) o.time_ref = j.time_ref;
      if (/^(block|flight|other)$/.test(j.time_meaning)) o.time_meaning = j.time_meaning;
      if (/^(off|none)$/.test(j.blank)) o.blank = j.blank;
      var c = j.codes && typeof j.codes === 'object' ? j.codes : {};
      Object.keys(c).slice(0, 200).forEach(function (k) {
        var kk = P.canon(k);
        if ((RX_CODE.test(kk) || P.isTok(kk)) && CODE_OPTS.indexOf(c[k]) >= 0 && c[k] !== 'unknown') o.codes[kk] = c[k];
      });
    }
    return o;
  }
  /* 原本に印字があった「実績か予定か」「時刻の基準」と、意味の決まった勤務コードは、選んだ状態で出す（本人は変えられる）。
     ★会社の辞書にある答えは、聞かずにそのまま入れる（保存のときに本人の読み方へ）。
     ★知らないコードは、決まった形（OFF・VAC…）→ その日の見た目（cat）の多い方の順で選んでおく（聞く画面で本人が見る）。
     ★答えはスクリーンショットを足して読み直しても消さない（前は読み直すたびに空に戻っていた）。 */
  function prefill() {
    var h = U.merged.hints || {}, pr = U.ctx.profile || {}, lr = learned(), a = U.answers;
    ['kind', 'time_ref', 'time_meaning', 'blank'].forEach(function (k) { if (!pr[k] && !a[k] && lr[k]) a[k] = lr[k]; });
    if (!pr.kind && !a.kind && h.kind) { a.kind = h.kind; U.printed.kind = true; }
    if (!pr.time_ref && !a.time_ref && h.time_ref) { a.time_ref = h.time_ref; U.printed.time_ref = true; }
    a.codes = a.codes || {};
    unknownCodes().forEach(function (c) {
      if (c in a.codes) return;
      var k = lr.codes[c] || STD_CODE(c) || catGuess(c);
      if (k) a.codes[c] = k;
    });
  }
  /* その日の見た目（parse-roster の cat）→ 勤務コードの意味／読めなかった日に当てる決まったコード */
  var CAT_MEAN = { off: 'off', leave: 'vac', standby: 'standby', training: 'training', ground: 'ground', duty: 'duty' };
  var CAT_CHIP = { off: 'OFF', leave: 'VAC', standby: 'SBY', training: 'TRN', ground: 'GND' };
  var STD_CHIPS = ['OFF', 'VAC', 'SBY', 'TRN', 'GND'];
  /* そのコードの日の見た目でいちばん多いもの（同数なら選ばない）。病欠・その他・空欄・不明は選ばない */
  function catGuess(c) {
    var n = {};
    Object.keys(U.base).forEach(function (dt) {
      var x = U.base[dt];
      if (x && x.code && P.canon(x.code) === c && typeof x.cat === 'string') n[x.cat] = (n[x.cat] || 0) + 1;
    });
    var ks = Object.keys(n).sort(function (a, b) { return n[b] - n[a]; });
    if (!ks.length || (ks.length > 1 && n[ks[0]] === n[ks[1]])) return null;
    return CAT_MEAN[ks[0]] || null;
  }

  /* 決まった勤務コード → 意味（あらかじめ選んでおくだけ・保存は本人が「保存する」を押したとき）。 */
  function STD_CODE(c) {
    c = String(c || '');
    if (/^(OFF\d{0,2}|RDO|DO)$/.test(c)) return 'off';
    if (/^VAC\d{0,2}$/.test(c)) return 'vac';
    if (/^(SBY|STBY)[A-Z0-9]{0,3}$/.test(c)) return 'standby';
    if (/^(TRN|SIM)[A-Z0-9]{0,3}$/.test(c)) return 'training';
    if (c === 'GND') return 'ground';
    return null;
  }

  /* ── 何も書いていない日（日付だけ印字されていた日）────────────────
     本人の読み方の blank（無ければ会社の辞書・この取り込みの答え）が 'off' なら OFF の日として送る。'none' は送らない（今まで通り）。
     ★本人が直した日はそのまま。自動で入れた日には filled の印（直した数にも、知らないコードにも数えない）。 */
  function blankMode() { var pr = U.ctx.profile || {}; return pr.blank || U.answers.blank || null; }
  function isBlankDay(dt) { var b = U.base[dt]; return !!(b && b.cat === 'blank' && empty(b)); }
  function blankDates() {
    return Object.keys(U.base).filter(function (dt) {
      return isBlankDay(dt) && (!U.range || (dt >= U.range.from && dt <= U.range.to));
    }).sort();
  }
  function applyBlank() {
    var M = U.merged, mode = blankMode(), any = false;
    blankDates().forEach(function (dt) {
      if (U.edits[dt]) return;
      var i = M.days.map(function (x) { return x.date; }).indexOf(dt), b = U.base[dt];
      if (mode === 'off') {
        var nd = { date: dt, code: 'OFF', d_on: null, d_off: null, d_off_day: 0, legs: [], cat: 'blank', filled: 'blank', page: b.page || null, row: b.row || null };
        if (i >= 0) M.days[i] = nd; else M.days.push(nd);
        any = true;
      } else if (i >= 0 && M.days[i].filled) M.days[i] = clone(b);
    });
    if (any) {
      var pr = U.ctx.profile || {}, a = U.answers;
      a.codes = a.codes || {};
      if (!(pr.codes || {}).OFF && !a.codes.OFF) a.codes.OFF = 'off';   // 自分で入れた OFF の意味（保存のときに本人の読み方へ）
      M.days.sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; });
    }
  }

  /* ── 確かめる ─────────────────────────────────────────────── */
  function draftProfile() {
    var pr = U.ctx.profile || {}, a = U.answers, codes = {};
    Object.keys(pr.codes || {}).forEach(function (k) { codes[k] = pr.codes[k]; });
    Object.keys(a.codes || {}).forEach(function (k) { if (a.codes[k]) codes[k] = a.codes[k]; });
    return { kind: pr.kind || a.kind || null, time_ref: pr.time_ref || a.time_ref || null, tz: pr.tz || null,
             time_meaning: pr.time_meaning || a.time_meaning || null, blank: blankMode(), codes: codes };
  }
  /* 本人の読み方で意味の決まっていないコード（会社の辞書で埋まるものも含む・印は小文字にそろえる）。
     自動で入れた OFF（何も書いていない日）は数えない */
  function unknownCodes() {
    var pr = U.ctx.profile || {}, days = U.merged.days.filter(function (x) { return !x.filled; });
    var months = R.rosterMonths(days, { codes: pr.codes || {} }), seen = {}, out = [];
    months.forEach(function (m) { (m.unclassifiedCodes || []).forEach(function (c) { c = P.canon(c); if (!seen[c]) { seen[c] = 1; out.push(c); } }); });
    return out.slice(0, 40);
  }
  /* 知らない言葉の印 → 「勤務表の言葉 A」。字は出てきた順に A・B…（印そのもの '#…' は画面に出さない） */
  function tokName(c) {
    var k = P.canon(c);
    if (!(k in U.tok)) U.tok[k] = P.letter(Object.keys(U.tok).length);
    return P.tokName(k, U.tok);
  }
  function codeShow(c) { return P.isTok(c) ? tokName(c) : c; }
  /* 日付の並び（「16・17・24日」・月をまたげば「10月31日・11月1日」）。8日を超えたら … */
  function datesLabel(dates) {
    var ds = dates.slice().sort(), more = ds.length > 8, groups = [], by = {};
    ds.slice(0, 8).forEach(function (dt) {
      var ym = dt.slice(0, 7);
      if (!by[ym]) { by[ym] = []; groups.push(ym); }
      by[ym].push(+dt.slice(8, 10));
    });
    return groups.map(function (ym) {
      var m = +ym.slice(5, 7);
      return fill(groups.length > 1 ? T.dlM : T.dlD, { n: m, s: P.T.monS[m - 1], list: by[ym].join(T.dlSep) });
    }).join(T.dlGrp) + (more ? '…' : '');
  }
  function codeDates(c) {
    return U.merged.days.filter(function (x) { return x.code && !x.filled && P.canon(x.code) === c; }).map(function (x) { return x.date; });
  }
  function showVal(v) { return String(v).replace(/\+0$/, function () { return ''; }).replace(/\+(\d)$/, function (m, n) { return ' (+' + n + ')'; }); }
  function chosenOf(it) {
    var dy = U.merged.days.filter(function (x) { return x.date === it.date; })[0];
    if (!dy || !it.field) return null;
    if (it.field === 'code') return dy.code ? codeShow(dy.code) : null;
    if (it.field === 'd_on') return dy.d_on;
    if (it.field === 'd_off') return dy.d_off ? dy.d_off + (dy.d_off_day ? ' (+' + dy.d_off_day + ')' : '') : null;
    if (it.field.indexOf('leg.') === 0 && it.leg) {
      var f = it.field.slice(4), lg = (dy.legs || []).filter(function (l) { return l.flight === it.leg.flight && l.out === it.leg.out; })[0];
      if (!lg) return null;
      return f === 'in' ? (lg.in ? lg.in + (lg.in_day ? ' (+' + lg.in_day + ')' : '') : null) : lg[f];
    }
    return null;
  }
  function issuesHTML() {
    var M = U.merged, list = [], seen = {};
    if (!M.days.some(function (x) { return !empty(x) && x.date.slice(0, 7) === U.month; })) list.push(fill(T.iMonth, { m: P.monthTitle(U.month) }));
    M.issues.forEach(function (it) {
      var k = [it.date, it.type, it.field, it.seq].join('|');
      if (seen[k]) return;
      seen[k] = 1;
      var dt = it.date ? fmtDate(it.date) : '';
      if (it.type === 'incomplete') list.push(fill(T.iCut, { d: dt }));
      else if (it.type === 'conflict') {
        var u = chosenOf(it);
        var vs = (it.values || []).map(function (v) { return it.field === 'code' && v != null ? codeShow(String(v)) : showVal(v); });
        list.push(fill(T.iConf, { d: dt, f: T.f[it.field] || it.field, v: vs.join(' / ') }) + (u ? ' ' + fill(T.iUse, { u: u }) : ''));
      }
      else if (it.type === 'partial_leg') list.push(fill(T.iPart, { d: dt, n: it.seq }));
      else if (it.type === 'ambiguous_leg') list.push(fill(T.iAmb, { d: dt }));
    });
    if (!list.length) return '';
    var cut = M.issues.some(function (x) { return x.type === 'incomplete'; });
    var shown = list.slice(0, 10);
    return '<section class="ru-card ru-iss"><h3 class="ru-h3">' + esc(T.issH) + '</h3><ul>' +
      shown.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
      (list.length > shown.length ? '<li class="ru-more">' + esc(fill(T.iMore, { n: list.length - shown.length })) + '</li>' : '') + '</ul>' +
      (cut ? '<button type="button" class="rs-btn is-ghost" data-u="more">' + esc(T.addMore) + '</button>' : '') + '</section>';
  }
  /* 中身の無い日。★読めなかった印（unread）・空欄の印（blank）が付いていても、便や時刻が読めていれば中身がある日（コードが無いだけ）。
     中身の決め方は pv-report-engine.js の dayEmpty（印を外して聞く） */
  function empty(x) {
    if (!x) return true;
    if (x.unread || x.blank) { var y = {}; Object.keys(x).forEach(function (k) { if (k !== 'unread' && k !== 'blank') y[k] = x[k]; }); x = y; }
    return R.helpers.dayEmpty(x);
  }
  function dayAt(date) { return U.merged ? U.merged.days.filter(function (x) { return x.date === date; })[0] || null : null; }
  function addDays(date, k) {
    var x = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + k));
    return x.getUTCFullYear() + '-' + P.pad2(x.getUTCMonth() + 1) + '-' + P.pad2(x.getUTCDate());
  }
  function eachDate(a, b, fn) { for (var x = a, k = 0; x <= b && k < 400; x = addDays(x, 1), k++) fn(x); }
  /* 読み取りが覆った日：parse-roster が返した日付（日付だけ・空欄・unread の日も含む）のいちばん前〜いちばん後。
     印字された期間があって、そちらが狭ければ期間に寄せる。62日まで。
     ★選んだ月の残りまで広げない（2026-11-09：1〜21日の2枚で、22〜31日が全部「読めなかった日」に並んでいた）。
       この外の日は「読めなかった日」ではない（そもそも撮っていない）＝「?」も付けず、一覧にも出さない。 */
  function coverOf(dates, period) {
    if (!dates.length) return null;
    var a = dates[0], b = dates[dates.length - 1], p = periodOk(period);
    if (p && p.from <= b && p.to >= a) { if (p.from > a) a = p.from; if (p.to < b) b = p.to; }
    if (addDays(a, MAX_DAYS - 1) < b) b = addDays(a, MAX_DAYS - 1);
    return { from: a, to: b };
  }
  /* 覆った範囲の中で中身の無い日（読めなかった日）と、範囲の日数・読めた日数。days は日の並び（mergePages の days） */
  function coverage(days, period) {
    var by = {}, dates = [], missing = [], read = 0, total = 0;
    (days || []).forEach(function (x) { if (x && x.date && !by[x.date]) { by[x.date] = x; dates.push(x.date); } });
    dates.sort();
    var range = coverOf(dates, period);
    if (range) eachDate(range.from, range.to, function (dt) { total++; if (empty(by[dt])) missing.push(dt); else read++; });
    return { range: range, missing: missing, read: read, total: total };
  }
  /* いま（本人が直したあと）の読めなかった日：読み取ったときの範囲の中だけ */
  function missingNow() {
    var out = [], m = blankMode();
    if (U.range) eachDate(U.range.from, U.range.to, function (dt) { if (empty(dayAt(dt)) && !(m && isBlankDay(dt))) out.push(dt); });
    return out;
  }
  /* 「読めなかった日」の一覧に並べる日：読み取ったときに中身の無かった日（何も書いていない日は、答えがあれば並べない） */
  function missRows() {
    var m = blankMode();
    return U.missing.filter(function (dt) { return !(m && isBlankDay(dt)); });
  }
  /* 当てはめる札：決まった5つ（OFF・VAC・SBY・TRN・GND）＋ このスケジュールのコード（同じものは1つ） */
  function fillChips() {
    var out = STD_CHIPS.slice();
    rosterCodes(true).forEach(function (c) { if (out.indexOf(c) < 0) out.push(c); });
    return out;
  }
  function chipLabel(c) { return STD_CHIPS.indexOf(c) >= 0 ? T.chipStd[c] : codeShow(c); }
  /* その日の見た目からの候補（まだ空の日だけ）。入れるのは本人が押したときだけ */
  function sugOf(dt) {
    var b = U.base[dt];
    return b && empty(dayAt(dt)) && typeof b.cat === 'string' ? (CAT_CHIP[b.cat] || null) : null;
  }
  function sugRows() { return missRows().filter(function (dt) { return !!sugOf(dt); }); }
  /* 札で1日を入れる（決まった5つは意味も分かる＝本人の読み方に足す） */
  function fillCode(dt, c) {
    applyEdit(dt, { date: dt, code: c, d_on: null, d_off: null, d_off_day: 0, legs: [] });
    var std = STD_CHIPS.indexOf(c) >= 0 ? STD_CODE(c) : null, pr = U.ctx.profile || {}, a = U.answers;
    if (std && !(pr.codes || {})[c]) {
      a.codes = a.codes || {};
      if (!a.codes[c]) a.codes[c] = std;
      U.seen[c] = 1;                 // 自分で選んだ札のコードで、聞く画面に戻さない
    }
  }
  /* このスケジュールに出てくる勤務コード（多い順）。codeOnly：時刻も便も無い日のコードだけ（空欄の日に当てはめる候補） */
  function rosterCodes(codeOnly) {
    var n = {};
    Object.keys(U.base).forEach(function (dt) {
      var x = U.base[dt], c = x && x.code;
      if (!c || (codeOnly && (x.d_on || x.d_off || (x.legs || []).length))) return;
      n[c] = (n[c] || 0) + 1;
    });
    return Object.keys(n).sort(function (a, b) { return (n[b] - n[a]) || (a < b ? -1 : 1); }).slice(0, 8);
  }
  /* 本人が直した日を入れる（day = null は「空欄のまま」＝読めたままに戻す）。その日の「確かめてほしいところ」は消す */
  function applyEdit(date, day) {
    var M = U.merged, i = M.days.map(function (x) { return x.date; }).indexOf(date), old = i >= 0 ? M.days[i] : null;
    if (day) {
      var nd = clone(day);
      nd.date = date; nd.edited = true;
      nd.page = (old && old.page) || null; nd.row = (old && old.row) || null;
      delete nd.blank; delete nd.unread; delete nd.cut; delete nd.filled;
      U.edits[date] = clone(nd);
      if (i >= 0) M.days[i] = nd; else M.days.push(nd);
      M.issues = M.issues.filter(function (x) { return x.date !== date; });
    } else {
      delete U.edits[date];
      var b = U.base[date];
      if (b) { if (i >= 0) M.days[i] = clone(b); else M.days.push(clone(b)); }
      else if (i >= 0) M.days.splice(i, 1);
      M.issues = M.issues.filter(function (x) { return x.date !== date; })
        .concat(U.baseIssues.filter(function (x) { return x.date === date; }));
    }
    M.days.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    if (!day && isBlankDay(date)) applyBlank();
  }

  /* ── はじめに聞く（その会社で初めてのときだけ・分からないものだけ）──────── */
  var CODE_OPTS = ['off', 'vac', 'standby', 'training', 'ground', 'duty', 'other', 'unknown'];   // ★2026-11-12 オーナー「わからないの他にその他」
  function asks() {
    var pr = U.ctx.profile || {}, lr = learned();
    return { kind: !pr.kind && !lr.kind, ref: !pr.time_ref && !lr.time_ref, mean: !pr.time_meaning && !lr.time_meaning,
             blank: !pr.blank && !lr.blank && blankDates().length > 0,
             lag: pr.pay_lag == null,                        // ★2026-11-11 明細に出る月（会社ごとに1回・答えは -1〜2）
             codes: unknownCodes().filter(function (c) { return !lr.codes[c]; }) };
  }
  function needAsk() {
    var q = asks();
    if (!q.kind && !q.ref && !q.mean && !q.blank && !q.lag && !q.codes.length) return false;
    if (!U.asked) return true;
    if (q.lag && !U.seen['@lag']) return true;
    if (q.blank && !U.seen['@blank']) return true;               // 足したスクリーンショットで、何も書いていない日が初めて出たとき
    return q.codes.some(function (c) { return !U.seen[c]; });   // 足したスクリーンショットで新しいコードが出たときだけ聞き直す
  }
  function markAsked() {
    var q = asks();
    U.asked = true;
    q.codes.forEach(function (c) { U.seen[c] = 1; });
    if (q.blank) U.seen['@blank'] = 1;
    if (q.lag) U.seen['@lag'] = 1;
  }
  /* ★2026-11-11 オーナー「どの月がどの明細に紐づくかわかんないじゃん？本当は自動でわかるといいけど、そうでない場合は
       勤務表アップロードした時点で最初にユーザーに聞いて」。同じ会社の給与の明細の乗務時間が、このスケジュールの
       同じ月・前の月・前々月のどれか1つとぴったり合えば、その答えを選んでおく（pv-report-engine.js の alignCandidates）。 */
  function lagGuess() {
    try {
      if (!R || !R.alignCandidates || !R.rosterMonths) return null;
      var oth = String(U.ctx.other || '').toLowerCase();
      var reps = (U.ctx.reports || []).filter(function (r) {
        return r && r.airline === U.ctx.airline && (U.ctx.airline !== 'other' || String(r.airline_other || '').toLowerCase() === oth);
      });
      if (!reps.length) return null;
      var c = R.alignCandidates(reps, R.rosterMonths(U.merged.days, U.ctx.profile || {}))
        .filter(function (x) { return x.candidate != null && !x.ambiguous; }).map(function (x) { return -x.candidate; });
      return c.length && c.every(function (v) { return v === c[0]; }) ? c[0] : null;
    } catch (e) { return null; }
  }
  function chipsHTML(q, cur, opts, c) {
    return '<div class="ru-chips">' + opts.map(function (o) {
      var on = cur === o[0];
      return '<button type="button" class="ru-chip' + (on ? ' is-on' : '') + '" data-u="ans" data-q="' + q + '"' +
        (c != null ? ' data-c="' + esc(c) + '"' : '') + ' data-v="' + o[0] + '" aria-pressed="' + on + '">' + esc(o[1]) + '</button>';
    }).join('') + '</div>';
  }
  function qSet(label, body, printed) {
    return '<fieldset class="ru-q"><legend>' + esc(label) + (printed ? ' <span class="ru-printed">' + esc(T.printed) + '</span>' : '') + '</legend>' + body + '</fieldset>';
  }
  function askHTML() {
    var q = asks(), a = U.answers, h = '';
    if (q.kind) h += qSet(T.qKind, chipsHTML('kind', a.kind, [['actual', T.qKindA], ['planned', T.qKindP]]), U.printed.kind);
    if (q.ref) h += qSet(T.qRef, chipsHTML('ref', a.time_ref, [['local', T.qRefL], ['utc', T.qRefU]]), U.printed.time_ref);
    if (q.mean) h += qSet(T.qMean, chipsHTML('mean', a.time_meaning, [['block', T.qMeanB], ['flight', T.qMeanF], ['other', T.qMeanO]]));
    if (q.blank) h += qSet(T.qBlank, '<p class="ru-qs ru-dl">' + esc(datesLabel(blankDates())) + '</p>' +
      chipsHTML('blank', a.blank, [['off', T.qBlankOff], ['none', T.qBlankNone]]));
    if (q.lag) {
      if (a.pay_lag == null && U.lagAuto === undefined) { U.lagAuto = lagGuess(); if (U.lagAuto != null) a.pay_lag = String(U.lagAuto); }
      h += qSet(T.qLag, '<p class="ru-qs ru-dl">' + esc(U.lagAuto != null ? T.qLagAuto : T.qLagS) + '</p>' +
        chipsHTML('lag', a.pay_lag, [['0', T.qLag0], ['1', T.qLag1], ['2', T.qLag2], ['-1', T.qLagU]]));
    }
    if (q.codes.length) {
      var opts = CODE_OPTS.map(function (o) { return [o, T.codeOpt[o]]; });
      h += '<fieldset class="ru-q"><legend>' + esc(T.qCodes) + '</legend><p class="ru-qs">' + esc(T.qCodesS) + '</p><div class="ru-codes">' +
        q.codes.map(function (c) {
          var tok = P.isTok(c), nm = codeShow(c);
          return '<div class="ru-code" role="group" aria-label="' + esc(nm) + '"><div class="ru-code-h"><span class="rs-tag">' + esc(nm) + '</span>' +
            (tok ? '<span class="ru-qs">' + esc(datesLabel(codeDates(c))) + '</span>' : '') + '</div>' +
            chipsHTML('code', (a.codes || {})[c] || '', opts, c) + '</div>';
        }).join('') + '</div></fieldset>';
    }
    return '<section class="ru-card ru-ask"><p class="ru-qs ru-lead">' + esc(T.qS) + '</p>' + h + '</section>' +
      '<div class="ru-act"><button type="button" class="rs-btn is-primary is-lg" data-u="next">' + esc(T.next) + '</button>' +
      '<button type="button" class="rs-btn is-ghost" data-u="cancel">' + esc(T.cancel) + '</button></div>';
  }
  /* 答えた札だけ付け替える（画面は組み直さない＝押した場所から動かない） */
  function answer(t) {
    var q = t.getAttribute('data-q'), v = t.getAttribute('data-v'), a = U.answers;
    if (q === 'kind') { a.kind = v; U.printed.kind = false; }
    else if (q === 'ref') { a.time_ref = v; U.printed.time_ref = false; }
    else if (q === 'mean') a.time_meaning = v;
    else if (q === 'blank') { a.blank = v; applyBlank(); }
    else if (q === 'lag') a.pay_lag = v;
    else if (q === 'code') (a.codes = a.codes || {})[P.canon(t.getAttribute('data-c'))] = v;
    [].forEach.call(t.parentNode.querySelectorAll('.ru-chip'), function (b) {
      var on = b === t;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    if (q === 'kind' || q === 'ref') {
      var fs = t.closest('fieldset'), pn = fs && fs.querySelector('.ru-printed');
      if (pn) pn.parentNode.removeChild(pn);
    }
  }

  /* ── 確かめて直す ──────────────────────────────────────────── */
  function sumHTML() {
    var dn = 0, dm = 0, bn = 0, bm = 0, bk = blankMode();
    if (U.range) eachDate(U.range.from, U.range.to, function (dt) { dm++; if (!empty(dayAt(dt)) || (bk && isBlankDay(dt))) dn++; });
    R.rosterMonths(U.merged.days, draftProfile()).forEach(function (m) {
      m.days.forEach(function (x) { x.legs.forEach(function (l) { if (l.kind !== 'ground') { bm++; if (l.blockMin != null) bn++; } }); });
    });
    var part = function (s, miss) { return '<span' + (miss ? ' class="is-miss"' : '') + '>' + esc(s) + '</span>'; };
    return '<p class="ru-sum">' + part(fill(T.sumRead, { d: dn, m: dm }), dn < dm) +
      (bm ? ' · ' + part(fill(T.sumTime, { b: bn, n: bm }), bn < bm) : '') + '</p>';
  }
  function calsHTML() {
    var months = R.rosterMonths(U.merged.days, draftProfile()), byYm = {}, ask = {}, flag = {};
    months.forEach(function (m) { byYm[m.ym] = m; });
    missingNow().forEach(function (dt) { ask[dt] = 1; });
    U.merged.issues.forEach(function (x) { if (x.date) flag[x.date] = 1; });
    var ds = U.merged.days.map(function (x) { return x.date; }).sort();
    var a = U.range ? U.range.from : ds[0], b = U.range ? U.range.to : ds[ds.length - 1];
    if (ds.length && ds[0] < a) a = ds[0];
    if (ds.length && ds[ds.length - 1] > b) b = ds[ds.length - 1];
    var yms = a && b ? R.helpers.ymRange(a.slice(0, 7), b.slice(0, 7)).slice(0, 3) : [];
    /* ★2026-11-12 オーナー「半月ぶん足したあと、その月に今まで出した分も入れて（区別できるように）」：
         今回の取り込みに無い日付だけ、保存済みの日を薄く出す（保存する日数には入らない・送らない＝前の日はそのまま残る） */
    var sv = (U.ctx.saved || []).filter(function (x) { return x && x.date && yms.indexOf(x.date.slice(0, 7)) >= 0; });
    var svBy = {}, prev = {}, anyPrev = false;
    if (sv.length) R.rosterMonths(sv, draftProfile()).forEach(function (m) { svBy[m.ym] = m; });
    var html = yms.map(function (ym) {
      var bd = {};
      (byYm[ym] ? byYm[ym].days : []).forEach(function (x) { bd[x.date] = x; });
      (svBy[ym] ? svBy[ym].days : []).forEach(function (x) { if (!bd[x.date]) { bd[x.date] = x; prev[x.date] = 1; anyPrev = true; } });
      return '<div class="ru-cal"><p class="ru-prev-t">' + esc(P.monthTitle(ym)) + '</p>' +
        P.calHTML(ym, bd, { interactive: true, edit: true, ask: ask, flag: flag, askLabel: T.missH, prev: prev, prevLabel: T.prevLab }) + '</div>';
    }).join('');
    return '<section class="ru-card ru-cals"><p class="ru-qs ru-lead">' + esc(T.calEdit) + '</p>' +
      (anyPrev ? '<p class="ru-qs ru-prevnote"><i class="ru-prev-k" aria-hidden="true"></i>' + esc(T.prevNote) + '</p>' : '') + html + '</section>';
  }
  function daySum(x) {
    var s = [];
    if (x.d_on || x.d_off) s.push((x.d_on || '—') + '–' + (x.d_off || '—') + (x.d_off_day ? ' (+' + x.d_off_day + ')' : ''));
    if ((x.legs || []).length) s.push(fill(T.legsN, { n: x.legs.length }));
    return (x.code ? codeShow(x.code) + (s.length ? ' · ' : '') : '') + s.join(' · ');
  }
  function missHTML() {
    var list = missRows();
    if (!list.length) return '';
    var codes = fillChips(), nSug = sugRows().length;
    var rows = list.map(function (dt) {
      var x = dayAt(dt), st = empty(x) ? 'blank' : (x.code && !x.d_on && !x.d_off && !(x.legs || []).length && codes.indexOf(x.code) >= 0) ? 'code' : 'duty';
      var sug = st === 'blank' ? sugOf(dt) : null;
      var chip = function (u, label, on, c) {
        var sg = !on && c != null && c === sug;     // 候補：点線で示すだけ（押すまで入れない）
        return '<button type="button" class="ru-chip' + (on ? ' is-on' : sg ? ' is-sug' : '') + '" data-u="' + u + '" data-id="' + dt + '"' + (c ? ' data-c="' + esc(c) + '"' : '') +
          ' aria-pressed="' + on + '"' + (sg ? ' aria-label="' + esc(label + ' · ' + T.sugA) + '"' : '') + '>' + esc(label) + '</button>';
      };
      return '<li class="ru-miss-r"><div class="ru-miss-d"><b>' + esc(fmtDate(dt)) + '</b>' + (st === 'duty' ? '<span>' + esc(daySum(x)) + '</span>' : '') + '</div>' +
        '<div class="ru-chips is-sm" role="group" aria-label="' + esc(fmtDate(dt)) + '">' +
          codes.map(function (c) { return chip('fill', chipLabel(c), st === 'code' && x.code === c, c); }).join('') +
          chip('fillduty', T.missDuty, st === 'duty') + chip('fillblank', T.missBlank, st === 'blank') +
        '</div></li>';
    }).join('');
    return '<section class="ru-card ru-miss"><div class="ru-card-h"><h3 class="ru-h3">' + esc(T.missH) + '</h3><span class="ru-qs">' + esc(T.missS) + '</span></div>' +
      (nSug ? '<button type="button" class="rs-btn ru-sugall" data-u="sugall">' + esc(fill(T.sugApply, { n: nSug })) + '</button>' : '') +
      '<ul class="ru-miss-l">' + rows + '</ul></section>';
  }
  function sendDays() { return U.merged.days.map(stripDay).filter(Boolean); }
  function checkHTML() {
    var M = U.merged, n = sendDays().length, tooMany = n > MAX_DAYS;
    var cut = M.issues.some(function (x) { return x.type === 'incomplete'; }), dis = U.busy ? ' disabled' : '';
    return sumHTML() + calsHTML() + missHTML() + issuesHTML() +
      (tooMany ? '<p class="rs-flash is-bad" role="alert">' + esc(T.errDays) + '</p>' : '') +
      (U.err ? '<p class="rs-flash is-bad" role="alert">' + esc(U.err) + '</p>' : '') +
      '<div class="ru-act">' +
        '<button type="button" class="rs-btn is-primary is-lg" data-u="save"' + (U.busy || tooMany || !n ? ' disabled' : '') + '>' +
          esc(U.busy ? T.saving : fill(T.save, { n: n })) + '</button>' +
        (cut ? '' : '<button type="button" class="rs-btn is-ghost" data-u="more"' + dis + '>' + esc(T.addMore) + '</button>') +   // 切れた日があれば、足すボタンはその説明の横だけ
        '<button type="button" class="rs-btn is-ghost" data-u="cancel"' + dis + '>' + esc(T.cancel) + '</button>' +
        (U.asked ? '<button type="button" class="ru-tbtn" data-u="prev"' + dis + '>' + esc(T.prevStep) + '</button>' : '') +
      '</div>' + fixHTML(U.fix, 'data-u', checkFix());
  }
  /* 運営に知らせる：読めたまま（U.base）と本人が直した日（U.edits）を比べる */
  function checkFix() {
    return fixSummary(Object.keys(U.edits).sort().map(function (dt) { return { b: U.base[dt] || null, a: dayAt(dt) }; }),
      { airline: U.ctx.airlineLabel, build: U.build, pages: U.pagesSent });
  }
  function openEditor(date, from) {
    if (!date || !U.merged) return;
    var x = dayAt(date);
    U.step = 'edit';
    editDay(U.box, x ? clone(x) : { date: date, legs: [] }, {
      mode: 'draft', codes: rosterCodes(false), codeLabel: codeShow,
      onSave: function (day) { applyEdit(date, day); closeEditor(date, from); },
      onCancel: function () { closeEditor(date, from); }
    });
    try { U.box.scrollIntoView({ block: 'start' }); } catch (e) {}
  }
  function closeEditor(date, from) {
    if (!U) return;
    U.step = 'check';
    render();
    var c = from ? U.box.querySelector('[data-u="' + from + '"][data-id="' + date + '"]') : U.box.querySelector('.rs-cell[data-date="' + date + '"]');
    if (!c) return focusHead();
    if (!from) [].forEach.call(c.parentNode.querySelectorAll('.rs-cell[data-date]'), function (b) { b.tabIndex = b === c ? 0 : -1; });
    c.focus({ preventScroll: true });
    try { c.scrollIntoView({ block: 'center' }); } catch (e) {}
  }

  /* ── 読み取りの間違いを運営に知らせる（2026-11-10 オーナー「会員が直してほしいと送れるように」）──────────
     ★送るのは「どの種類を何件直したか」の数だけ＋本人の一言（任意・200字）。日付・時刻・空港・便名・勤務コードの字・
       読み取りの印は1文字も入れない（読み取りの版・会社・ページ数は入れる）。要望の口 pv_request_submit に、運営だけが見る形（p_private）で。
     比べる元は「読み取ったまま」（確認の画面は U.base・保存したあとはこの回で直す前の行）と、本人が直したあと。 */
  var FIX_LEG = ['block', 'out', 'in', 'from', 'to', 'loc', 'kind'];
  var FIX_ORDER = ['day|add', 'day|del', 'code|empty', 'code|wrong', 'd_on|empty', 'd_on|wrong', 'd_off|empty', 'd_off|wrong']
    .concat(FIX_LEG.reduce(function (a, f) { return a.concat(['leg.' + f + '|empty', 'leg.' + f + '|wrong']); }, []), ['leg|add', 'leg|del']);
  function cmpT(v) { if (v == null || v === '') return ''; var n = normTime(String(v)); return n === false ? String(v) : n; }
  function cmpBlk(l) {
    if (l.block_min != null && isFinite(+l.block_min)) return String(+l.block_min);
    var n = normBlock(l.block == null ? '' : String(l.block)), m = n ? /^(\d+):(\d\d)$/.exec(n) : null;
    return n === false ? String(l.block) : m ? String(+m[1] * 60 + +m[2]) : '';
  }
  function cmpLeg(l) {
    l = l || {};
    var gnd = l.kind === 'ground', from = gnd ? '' : upT(l.from), to = gnd ? '' : upT(l.to), inn = cmpT(l.in);
    return { from: from, to: to, loc: (!gnd && (from || to)) ? '' : upT(l.loc), out: cmpT(l.out), in: inn ? inn + (l.in_day ? '+' + l.in_day : '') : '',
             block: cmpBlk(l), kind: KINDS.indexOf(l.kind) >= 0 ? l.kind : 'unknown' };
  }
  function cmpDay(x) {
    if (!x) return null;
    var off = cmpT(x.d_off);
    return { code: x.code ? codeT(x.code) : '', d_on: cmpT(x.d_on), d_off: off ? off + (x.d_off_day ? '+' + x.d_off_day : '') : '',
             legs: (x.legs || []).slice().sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); }).map(cmpLeg)
               .filter(function (l) { return l.from || l.to || l.loc || l.out || l.in || l.block; }) };
  }
  /* 直した前と後の便を突き合わせる：同じ区間 → 同じ出発時刻 → 同じ並び */
  function matchLegs(B, A) {
    var used = [], pairs = [], add = 0;
    var find = function (f) { for (var k = 0; k < B.length; k++) if (!used[k] && f(B[k])) return k; return -1; };
    A.forEach(function (a, i) {
      var j = -1;
      if (a.from && a.to) j = find(function (b) { return b.from === a.from && b.to === a.to; });
      if (j < 0 && a.out) j = find(function (b) { return b.out === a.out; });
      if (j < 0 && i < B.length && !used[i]) j = i;
      if (j < 0) { add++; return; }
      used[j] = true;
      pairs.push([B[j], a]);
    });
    return { pairs: pairs, add: add, del: B.length - pairs.length };
  }
  function fixCounts(pairs) {
    var c = {}, bump = function (k, n) { c[k] = (c[k] || 0) + (n == null ? 1 : n); };
    var has = function (x) { return !!(x && (x.code || x.d_on || x.d_off || x.legs.length)); };
    (pairs || []).forEach(function (p) {
      if (!p) return;
      var B = cmpDay(p.b), A = cmpDay(p.a), hb = has(B), ha = has(A);
      if (!hb && !ha) return;
      if (!p.b) { bump('day|add'); return; }          // 読み取りに無かった日を入れた
      if (!ha) { bump('day|del'); return; }           // 読めた日を消した
      ['code', 'd_on', 'd_off'].forEach(function (f) { if (B[f] !== A[f]) bump(f + '|' + (B[f] ? 'wrong' : 'empty')); });
      var m = matchLegs(B.legs, A.legs);
      m.pairs.forEach(function (pr) {
        FIX_LEG.forEach(function (f) {
          var b = pr[0][f];
          if (b !== pr[1][f]) bump('leg.' + f + '|' + ((b === '' || (f === 'kind' && b === 'unknown')) ? 'empty' : 'wrong'));
        });
      });
      if (m.add) bump('leg|add', m.add);
      if (m.del) bump('leg|del', m.del);
    });
    return c;
  }
  /* → { text（送る要約・280字まで）, n（直した数） } */
  function fixSummary(pairs, meta) {
    meta = meta || {};
    var c = fixCounts(pairs), items = [], n = 0;
    FIX_ORDER.forEach(function (k) {
      if (!c[k]) return;
      n += c[k];
      var f = k.split('|')[0], st = k.split('|')[1], u = f.indexOf('leg') === 0 ? T.fixLegU : T.fixDayU;
      if (f === 'day' || f === 'leg') {
        var nm = f === 'day' ? (st === 'add' ? T.fixAddDay : T.fixDelDay) : (st === 'add' ? T.fixAddLeg : T.fixDelLeg);
        items.push(fill(T.fixItem2, { f: nm, n: c[k], u: u }));
      } else items.push(fill(T.fixItem, { f: T.f[f] || f, n: c[k], u: u, s: st === 'empty' ? T.fixEmpty : T.fixWrong }));
    });
    var head = [fill(T.fixAir, { a: String(meta.airline || '—').replace(/\s+/g, ' ').trim().slice(0, 40) })];
    if (meta.build && /^[0-9A-Za-z.\-]{1,20}$/.test(meta.build)) head.push(fill(T.fixBuild, { b: meta.build }));
    if (meta.pages > 0) head.push(fill(T.fixPages, { n: Math.floor(meta.pages) }));
    var make = function (more) { return T.fixHead + head.concat([items.length ? fill(T.fixDid, { l: items.join(T.fixJoin) + (more ? '…' : '') }) : T.fixNone]).join(T.fixSep); };
    var text = make(false);
    while (text.length > 280 && items.length > 1) { items.pop(); text = make(true); }
    return { text: text.slice(0, 280), n: n };
  }
  function fixBody(sum, comment) {
    var note = String(comment || '').replace(/^\s+|\s+$/g, '').slice(0, 200);
    return (sum.text + (note ? '\n' + note : '')).slice(0, 500);
  }
  /* attr：確認の画面は data-u・直す画面は data-e */
  function fixHTML(F, attr, sum) {
    if (!F) return '';
    if (F.sent) return '<p class="ru-fix-ok" role="status" tabindex="-1" ' + attr + '="fixok">' + esc(T.fixThanks) + '</p>';
    var A = function (v) { return ' ' + attr + '="' + v + '"'; };
    var h = '<div class="ru-fix"><button type="button" class="ru-tbtn ru-fix-l"' + A('fix') + ' aria-expanded="' + !!F.open + '"' +
      (F.open ? ' aria-controls="' + F.id + '"' : '') + '>' + esc(T.fixLink) + '</button>';
    if (F.open) {
      h += '<div class="ru-fix-p" id="' + F.id + '"><p class="ru-fix-s">' + esc(sum.text) + '</p>' +
        '<label class="ru-fix-lab" for="' + F.id + '-c">' + esc(sum.n ? T.fixNote : T.fixNoteReq) + '</label>' +
        '<textarea id="' + F.id + '-c" class="rs-in ru-fix-c"' + A('fixc') + ' maxlength="200" rows="3">' + esc(F.comment || '') + '</textarea>' +
        (F.msg ? '<p class="ru-fix-m" role="alert">' + esc(F.msg) + '</p>' : '') +
        '<button type="button" class="rs-btn ru-fix-b"' + A('fixsend') + (F.busy ? ' disabled' : '') + '>' + esc(T.fixSend) + '</button></div>';
    }
    return h + '</div>';
  }
  /* 送る（運営だけが見る要望・区分 bug）。done(r)：'ok' か 'err' */
  function sendFix(F, sb, sum, redraw) {
    if (F.busy || F.sent) return;
    var note = String(F.comment || '').replace(/^\s+|\s+$/g, '');
    if (!sum.n && note.length < 4) { F.msg = T.fixShort; redraw('err'); return; }
    F.busy = true; F.msg = null;
    var done = function (msg) {
      F.busy = false;
      if (msg) F.msg = msg; else { F.sent = true; F.open = false; }
      redraw(msg ? 'err' : 'ok');
    };
    var p;
    try { p = sb.rpc('pv_request_submit', { p_body: fixBody(sum, note), p_category: 'bug', p_private: true }); } catch (e) { done(T.fixErr); return; }
    Promise.resolve(p).then(function (r) {
      var v = r && !r.error ? r.data : null, code = r && r.error && r.error.code;
      if (v && v.ok === true) return done(null);
      done(code === '42501' ? T.errLogin : !v ? T.fixErr : v.status === 'too_fast' ? T.fixFast
        : v.status === 'rate_limited' ? T.fixLimit : v.status === 'duplicate' ? T.fixDup : T.fixErr);
    }, function () { done(T.fixErr); });
  }

  /* ── 保存 ───────────────────────────────────────────────── */
  function stripDay(x) {
    if (empty(x)) return null;   // ★空欄・読めなかった日は送らない（本人が入れた日は、入れたときに印が外れる）。便や時刻が読めた日はコードが無くても送る
    return {
      date: x.date, code: x.code || null, d_on: x.d_on || null, d_off: x.d_off || null, d_off_day: x.d_off_day || 0,
      page: x.page || null, row: x.row || null,
      legs: (x.legs || []).map(function (l) {
        // ★便名は送らない（サーバーも保存しない。日付と便名がそろうと本人に絞れるため）
        return { seq: l.seq, from: l.from || null, to: l.to || null, loc: l.loc || null,
                 out: l.out || null, in: l.in || null, in_day: l.in_day || 0, block: l.block || null,
                 kind: l.kind || 'unknown', page: l.page || null, row: l.row || null };
      })
    };
  }
  function periodOk(p) {
    if (!p || !p.from || !p.to) return null;
    var a = Date.parse(p.from + 'T00:00:00Z'), b = Date.parse(p.to + 'T00:00:00Z'), now = Date.now(), day = 864e5;
    if (!(b >= a) || b - a > 62 * day || a < now - 399 * day || b > now + 399 * day) return null;
    return { from: p.from, to: p.to };
  }
  function fileSha() {
    return Promise.all(U.run.pages.map(function (p) { return blobBuf(p.blob); })).then(function (bufs) {
      var n = 0; bufs.forEach(function (b) { n += b.byteLength; });
      var all = new Uint8Array(n), at = 0;
      bufs.forEach(function (b) { all.set(new Uint8Array(b), at); at += b.byteLength; });
      return sha256(all.buffer);
    });
  }
  function profilePatch() { return patchOf(U.ctx.profile, U.answers); }
  /* 送る読み方：足りなかった鍵の答えだけ。勤務コードは丸ごと置き換える口なので、前の答えに足して送る */
  function patchOf(pr, a) {
    pr = pr || {}; a = a || {};
    var p = {}, any = false;
    ['kind', 'time_ref', 'time_meaning', 'blank'].forEach(function (k) { if (!pr[k] && a[k]) { p[k] = a[k]; any = true; } });
    if (pr.pay_lag == null && /^(-1|0|1|2)$/.test(String(a.pay_lag))) { p.pay_lag = Number(a.pay_lag); any = true; }   // ★明細に出る月（2026-11-11）
    var add = {};
    Object.keys(a.codes || {}).forEach(function (k) { if (a.codes[k]) add[k] = a.codes[k]; });
    if (Object.keys(add).length) {
      var codes = {};
      Object.keys(pr.codes || {}).forEach(function (k) { codes[k] = pr.codes[k]; });   // ★丸ごと置き換える口なので、前の答えを残して足す
      Object.keys(add).forEach(function (k) { codes[k] = add[k]; });
      p.codes = codes; any = true;
    }
    return any ? p : null;
  }
  function save() {
    if (U.busy) return;
    var days = U.merged.days.map(stripDay);
    days = days.filter(Boolean);
    if (!days.length) return;
    if (days.length > MAX_DAYS) { U.err = T.errDays; render(); return; }
    U.busy = true; U.err = null;
    render();
    var c = U.ctx, a = { p_airline: c.airline, p_airline_other: c.other };
    var ymAfter = days.some(function (x) { return x.date.slice(0, 7) === U.month; }) ? U.month : days[0].date.slice(0, 7);
    fileSha().then(function (sha) {
      var patch = profilePatch();
      var first = patch ? c.sb.rpc('set_roster_profile', { p_airline: a.p_airline, p_airline_other: a.p_airline_other, p: patch }).then(null, function () { return null; }) : Promise.resolve(null);
      return first.then(function () {
        return c.sb.rpc('submit_roster', { p: {
          airline: c.airline, airline_other: c.other, file_sha: sha, pages: U.pagesSent,
          period: periodOk(U.merged.period), days: days
        } });
      });
    }).then(function (r) {
      U.busy = false;
      if (!r || r.error || !r.data || !r.data.ok) {
        var code = r && r.error && r.error.code;
        /* ★保存で止まった理由の語だけを知らせる（運営が気づけるように・2026-11-13）。中身は送らない */
        report(code === '54000' ? 'save_limit' : code === '22023' ? 'save_bad' : code === '42501' ? 'save_login' : 'save_failed', 'save');
        U.err = code === '54000' ? T.errLimit : code === '22023' ? T.errBad : code === '42501' ? T.errLogin : T.errSave;
        render();
        return;
      }
      var done = c.done, res = { saved: !r.data.dup, dup: !!r.data.dup, days: r.data.days || days.length, ym: ymAfter };
      U = null;
      done(res);
    }, function () { report('save_failed', 'save'); U.busy = false; U.err = T.errSave; render(); });
  }

  /* ── 描く ───────────────────────────────────────────────── */
  var I_UP = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>';
  var I_DN = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  var I_X = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  var I_LOCK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2.2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';
  var I_BACK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';

  function monthOptions() {
    var cur = P.nowYm(), out = '';
    for (var k = 2; k >= -14; k--) {
      var ym = P.ymAdd(cur, k);
      out += '<option value="' + ym + '"' + (ym === U.month ? ' selected' : '') + '>' + esc(P.monthTitle(ym)) + '</option>';
    }
    return out;
  }
  function itemHTML(it, i, n) {
    var meta;
    if (it.status === 'prep') meta = '<span class="ru-spin" aria-hidden="true"></span>' + esc(T.fPrep);
    else if (it.status === 'err') meta = esc(T.fErr[it.why] || T.fErr.prep_failed);
    else meta = esc((it.pdf ? T.fPdf : T.fImg) + (it.pages.length > 1 || it.pdf ? ' · ' + fill(T.fPages, { n: it.pages.length }) : '')) +
      (it.cut ? ' · ' + esc(fill(T.fCut, { n: it.cut })) : '');
    var th = it.pages ? it.pages.slice(0, 3).map(function (p) { return p.thumb ? '<img src="' + p.thumb + '" alt="">' : ''; }).join('') : '';
    return '<li class="ru-f' + (it.status === 'err' ? ' is-err' : '') + '">' +
      '<span class="ru-f-n">' + (i + 1) + '</span>' +
      '<span class="ru-thumbs" aria-hidden="true">' + th + '</span>' +
      '<div class="ru-f-b"><b>' + esc(it.name || '—') + '</b><span>' + meta + '</span></div>' +
      '<div class="ru-f-a">' +
        '<button type="button" class="rs-ib" data-u="up" data-id="' + it.id + '" aria-label="' + esc(T.up) + '"' + (i === 0 ? ' disabled' : '') + '>' + I_UP + '</button>' +
        '<button type="button" class="rs-ib" data-u="down" data-id="' + it.id + '" aria-label="' + esc(T.down) + '"' + (i === n - 1 ? ' disabled' : '') + '>' + I_DN + '</button>' +
        '<button type="button" class="rs-ib" data-u="rm" data-id="' + it.id + '" aria-label="' + esc(T.rm) + '">' + I_X + '</button>' +
      '</div></li>';
  }
  function pickHTML() {
    var n = allPages().length, prep = U.items.some(function (x) { return x.status === 'prep'; });
    var has = U.items.length > 0;
    var drop = '<button type="button" class="rs-entry ru-drop' + (has ? ' is-compact' : '') + '" data-u="pick">' +
      '<span class="rs-entry-t"><span class="rs-entry-i" aria-hidden="true">' + P.entryIcon + '</span>' + esc(has ? T.addT : T.pickT) + '</span>' +
      (has ? '' : '<span class="rs-entry-s">' + esc(T.pickS) + '</span>') +
      '<span class="rs-entry-f">' + esc(T.pickF) + '</span></button>';
    var list = has ? '<section class="ru-card"><div class="ru-card-h"><h3 class="ru-h3">' + esc(T.listH) + '</h3><span class="ru-qs">' + esc(T.listS) + '</span></div>' +
      '<ol class="ru-list">' + U.items.map(function (it, i) { return itemHTML(it, i, U.items.length); }).join('') + '</ol></section>' : '';
    var over = n > MAX_PAGES;
    return drop + list +
      '<section class="ru-card ru-month"><label class="ru-h3" for="ru-month">' + esc(T.monthQ) + '</label>' +
        '<select id="ru-month" class="rs-sel" data-u="month">' + monthOptions() + '</select>' +
        '<p class="ru-qs">' + esc(T.monthS) + '</p></section>' +
      '<p class="ru-priv"><span aria-hidden="true">' + I_LOCK + '</span>' + esc(T.priv) + '</p>' +
      (U.err ? '<p class="rs-flash is-bad" role="alert">' + esc(U.err) + '</p>' : '') +
      (over ? '<p class="rs-flash is-bad" role="alert">' + esc(fill(T.tooMany, { n: MAX_PAGES })) + '</p>' : '') +
      '<div class="ru-act"><button type="button" class="rs-btn is-primary is-lg" data-u="read"' + (!n || prep || over ? ' disabled' : '') + '>' +
        esc(fill(T.read, { n: n })) + '</button></div>';
  }
  var I_PLUS = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  /* 読み取りに失敗したページ（覆いを外して、箱の中に出す・payslip.js の失敗の札と同じ形）。
     ★赤で叱らない。いちばん勧める道だけ緑のボタン、ほかは字のボタン。 */
  var RETRY = { network: 1, timeout: 1, read_busy: 1, other: 1, prep_failed: 1 };
  function failHTML(run) {
    var f = run.fail, fatal = !!FATAL[f.why], some = run.out.some(Boolean);
    var prim = (!fatal && RETRY[f.why]) ? 'retry' : (!fatal && run.n > 1) ? 'skip' : some ? 'sofar' : 'cancel';
    var acts = (fatal ? [] : [['retry', T.retry], ['skip', T.skip]]).concat(some ? [['sofar', T.useSoFar]] : [], [['cancel', T.cancel]]);
    acts.sort(function (a, b) { return (b[0] === prim ? 1 : 0) - (a[0] === prim ? 1 : 0); });
    var th = run.pages[f.k] && run.pages[f.k].thumb;
    return '<section class="ru-failc' + (th ? ' has-th' : '') + '" role="alert"><div class="ru-failc-row">' +
      (th ? '<span class="ru-failc-th" aria-hidden="true"><img src="' + th + '" alt=""></span>' : '') +
      '<div class="ru-failc-main"><b class="ru-failc-t">' + esc(fill(T.failH, { i: f.k + 1 })) + '</b>' +
        '<p class="ru-failc-m">' + esc(T.why[f.why] || T.why.other) + '</p></div></div>' +
      '<div class="ru-failc-bar">' + acts.map(function (a) {
        return '<button type="button" class="' + (a[0] === prim ? 'rs-btn is-primary' : 'ru-tbtn') + '" data-u="' + a[0] + '">' + esc(a[1]) + '</button>';
      }).join('') + '</div></section>';
  }
  function readHTML() {
    var run = U.run;
    return run && run.fail ? failHTML(run) : '<div class="ru-wait" aria-hidden="true"></div>';   // 読んでいるあいだは覆いの画面だけ
  }
  function headHTML(title) {
    var n = (U.step === 'ask' || U.step === 'check') && U.asked ? '<span class="ru-stepn">' + (U.step === 'ask' ? 1 : 2) + ' / 2</span>' : '';
    return '<button type="button" class="rs-link ru-back" data-u="cancel">' + I_BACK + esc(T.back) + '</button>' +
      '<div class="ru-hd">' + n + '<h2 class="rs-h">' + esc(title) + '</h2><p class="rs-ey">' + esc(T.air) + ' · <span class="rs-air">' + esc(U.ctx.airlineLabel) + '</span></p></div>';
  }
  function attrSel(k, v) { return v == null ? '' : '[' + k + '="' + String(v).replace(/["\\]/g, function (c) { return '\\' + c; }) + '"]'; }
  function focusHead(scroll) {
    if (!U) return;
    var h = U.box.querySelector('.ru-hd h2');
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
    if (scroll) { try { U.box.scrollIntoView({ block: 'start' }); } catch (e) {} }
  }
  function render() {
    if (!U || U.step === 'edit') return;            // 直す画面のあいだは触らない（editDay が自分で描く）
    var a = d.activeElement, keep = a && U.box.contains(a) && a.getAttribute ? {
      u: a.getAttribute('data-u'), id: a.getAttribute('data-id'), c: a.getAttribute('data-c'), q: a.getAttribute('data-q'),
      v: a.getAttribute('data-v'), date: a.getAttribute('data-date') } : null;
    var body = U.step === 'read' ? readHTML() : U.step === 'ask' ? askHTML() : U.step === 'check' ? checkHTML() : pickHTML();
    var title = U.step === 'read' ? T.readH : U.step === 'ask' ? T.qH : U.step === 'check' ? T.confH : T.h;
    U.box.innerHTML = '<div class="rs ru">' + headHTML(title) + body +
      '<input type="file" class="ru-file" multiple accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf,.pdf" hidden></div>';
    if (keep) {
      var f = null;
      if (keep.u) f = U.box.querySelector('[data-u="' + keep.u + '"]' + attrSel('data-id', keep.id) + attrSel('data-c', keep.c) + attrSel('data-q', keep.q) + attrSel('data-v', keep.v));
      else if (keep.date) f = U.box.querySelector('[data-date="' + keep.date + '"]');
      if (f && f.disabled && keep.id) f = U.box.querySelector('[data-id="' + keep.id + '"]:not([disabled])');   // 端まで動かしたら、同じ行の残りのボタンへ
      if (f && !f.disabled) f.focus(); else focusHead();
    }
  }

  /* ── 操作 ───────────────────────────────────────────────── */
  function move(id, k) {
    var i = U.items.findIndex(function (x) { return x.id === id; }), j = i + k;
    if (i < 0 || j < 0 || j >= U.items.length) return;
    var t = U.items[i]; U.items[i] = U.items[j]; U.items[j] = t;
    render();
  }
  function onClick(e) {
    var t = e.target.closest ? e.target.closest('[data-u],[data-date]') : null;
    if (!U || !t || !U.box.contains(t) || t.disabled || U.step === 'edit') return;
    var u = t.getAttribute('data-u'), id = t.getAttribute('data-id');
    if (!u) { if (U.step === 'check') openEditor(t.getAttribute('data-date')); return; }   // カレンダーの日 → その日を直す
    if (u === 'pick') { var inp = U.box.querySelector('.ru-file'); if (inp) inp.click(); }
    else if (u === 'up') move(id, -1);
    else if (u === 'down') move(id, 1);
    else if (u === 'rm') { U.items = U.items.filter(function (x) { return x.id !== id; }); render(); var nb = U.box.querySelector('[data-u="pick"]'); if (nb) nb.focus(); }
    else if (u === 'read') startRead();
    else if (u === 'stop') stopRead();
    else if (u === 'retry') { var r0 = U.run; r0.fail = null; render(); loadOpen(r0); next(r0); }
    else if (u === 'skip') { var r = U.run; r.fail = null; r.i++; render(); loadOpen(r); next(r); }
    else if (u === 'sofar') { var r2 = U.run; r2.fail = null; finishRead(r2); }
    else if (u === 'more') { U.step = 'pick'; U.err = null; render(); var p = U.box.querySelector('[data-u="pick"]'); if (p) { p.focus(); p.click(); } }
    else if (u === 'ans') answer(t);
    else if (u === 'next') { U.step = 'check'; render(); focusHead(true); }
    else if (u === 'prev') { markAsked(); U.step = 'ask'; render(); focusHead(true); }
    else if (u === 'fill') { fillCode(id, t.getAttribute('data-c')); render(); }
    else if (u === 'sugall') {                     // 候補をまとめて入れる（本人が押したときだけ）
      var sg = sugRows();
      sg.forEach(function (dt) { fillCode(dt, sugOf(dt)); });
      render();
      var f0 = sg.length ? U.box.querySelector('[data-u="fill"][data-id="' + sg[0] + '"].is-on') : null;
      if (f0) f0.focus(); else focusHead();
    }
    else if (u === 'fix') { U.fix.open = !U.fix.open; U.fix.msg = null; render(); var fc = U.box.querySelector(U.fix.open ? '[data-u="fixc"]' : '[data-u="fix"]'); if (fc) fc.focus(); }
    else if (u === 'fixsend') sendFix(U.fix, U.ctx.sb, checkFix(), function (r) {
      if (!U) return;
      render();
      var fe = U.box.querySelector(r === 'ok' ? '[data-u="fixok"]' : '[data-u="fixc"]');
      if (fe) fe.focus();
    });
    else if (u === 'fillblank') { applyEdit(id, null); render(); }
    else if (u === 'fillduty') openEditor(id, 'fillduty');
    else if (u === 'save') save();
    else if (u === 'cancel') { if (U.run) U.run.stop = true; loadClose(); var dn = U.ctx.done; U = null; dn(null); }
  }
  function onInput(e) {
    var t = e.target;
    if (U && t && t.getAttribute && t.getAttribute('data-u') === 'fixc') U.fix.comment = t.value;
  }
  function onChange(e) {
    if (!U) return;
    var t = e.target;
    if (t.classList.contains('ru-file')) { addFiles(t.files); t.value = ''; return; }
    if (t.getAttribute('data-u') === 'month') U.month = t.value;
  }
  /* 確かめる画面のカレンダーは矢印で日を動かす（左右 ±1日・上下 ±1週・Home/End で月の端） */
  function onKey(e) {
    var t = e.target;
    if (!U || U.step !== 'check' || !t.classList || !t.classList.contains('rs-cell') || !t.hasAttribute('data-date')) return;
    var cells = [].slice.call(t.parentNode.querySelectorAll('.rs-cell[data-date]')), i = cells.indexOf(t), j = null;
    if (e.key === 'ArrowRight') j = i + 1; else if (e.key === 'ArrowLeft') j = i - 1;
    else if (e.key === 'ArrowDown') j = i + 7; else if (e.key === 'ArrowUp') j = i - 7;
    else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = cells.length - 1;
    if (j == null) return;
    e.preventDefault();
    j = Math.max(0, Math.min(cells.length - 1, j));
    cells.forEach(function (c, k) { c.tabIndex = k === j ? 0 : -1; });
    cells[j].focus();
  }
  function onDrag(e) {
    if (!U || U.step !== 'pick') return;
    var z = e.target.closest ? e.target.closest('.ru-drop') : null;
    if (!z) return;
    e.preventDefault();
    z.classList.toggle('is-over', e.type === 'dragover' || e.type === 'dragenter');
    if (e.type === 'drop' && e.dataTransfer) addFiles(e.dataTransfer.files);
  }

  /* ════ 1日を直す画面（取り込みの確認と、保存したあとの両方で使う・2026-11-09 オーナー「読み取りは完璧にならない。直す画面を」）
     window.PVRosterUpload.editDay(box, day, opts)
       day  … { date, code, d_on, d_off, d_off_day, legs:[{ seq, from, to, loc, out, in, in_day, block | block_min, kind }] }（my_roster の形）
       opts … { codes:[このスケジュールに出てくる勤務コード], codeLabel(c), mode:'draft'|'saved',
                onSave(day) → 約束（省略可・断られたら文言で reject）, onCancel(), onDelete() → 約束（省略可・無ければ消すボタンを出さない）,
                report:{ sb, airline, pairs(draftDay|undefined) } → 下に「読み取りの間違いを運営に知らせる」（保存したあとの画面だけ） }
     ★検品はサーバー（db/roster.sql）と同じ形：勤務コード ^[A-Z0-9/+\-]{1,12}$（読み取りの印 '#'＋小文字16進16字はそのまま）・
       時刻 HH:MM（"7:05"・"705" は "07:05" に直してから見る）・空港 ^[A-Z0-9]{3,4}$・場所 ^[A-Z0-9]{2,8}$・便の時間 H:MM で 24時間まで・翌日は 0〜2。
     ★便の乗務の区分（CAP など）は持たない（2026-11-10・勤務表に並ぶのはほかの乗員の区分だった）。
     ★地上の業務は空港を持たない（場所 loc だけ）。中身の無い行は落とす。順番は 1..n に振り直す（16件まで）。便名は持たない。 */
  var RX_CODE = /^[A-Z0-9\/+\-]{1,12}$/, RX_HHMM = /^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$/, RX_APT = /^[A-Z0-9]{3,4}$/,
      RX_LOC = /^[A-Z0-9]{2,8}$/, RX_BLOCK = /^[0-9]{1,2}:[0-5][0-9]$/;
  var KINDS = ['operating', 'deadhead', 'ground', 'unknown'], MAX_LEGS = 16;
  function ascii(s) {   // 全角の英数字・記号は半角に（日本語の入力のまま打っても通る）
    return String(s == null ? '' : s).replace(/[\uFF01-\uFF5E]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).trim();
  }
  function upT(s) { return ascii(s).toUpperCase(); }
  /* 勤務コードの欄：読み取りの印（'#'＋小文字16進）は大文字にしない（大文字にすると別の印＝本人の答えと結べない） */
  function codeT(s) { return P.isTok(s) ? P.canon(s) : upT(s); }
  function hmParts(s) { return /^(\d{1,2})[:.hH](\d{2})$/.exec(s) || /^(\d{1,2})(\d{2})$/.exec(s); }
  /* 時刻："7:05"・"705"・"0705" → "07:05"。空は ''、形が合わなければ false */
  function normTime(s) {
    s = ascii(s);
    if (!s) return '';
    var m = hmParts(s);
    if (!m) return false;
    var v = P.pad2(+m[1]) + ':' + m[2];
    return RX_HHMM.test(v) ? v : false;
  }
  /* 便の時間："1:35"・"135"・"01:35" → "1:35"（24時間まで） */
  function normBlock(s) {
    s = ascii(s);
    if (!s) return '';
    var m = hmParts(s);
    if (!m) return false;
    var v = (+m[1]) + ':' + m[2];
    return (RX_BLOCK.test(v) && (+m[1]) * 60 + (+m[2]) <= 1440) ? v : false;
  }
  function day02(v) { v = Math.floor(+v || 0); return v < 0 ? 0 : v > 2 ? 2 : v; }
  function hmOf(min) { return (min == null || !isFinite(min)) ? '' : Math.floor(min / 60) + ':' + P.pad2(min % 60); }
  /* 下書き（入力欄の字のまま）→ 保存する形。{ day | null, errs: { 欄: 文言の鍵 } } */
  function cleanDay(date, dr) {
    dr = dr || {};
    var errs = {}, code = codeT(dr.code), on = normTime(dr.d_on), off = normTime(dr.d_off), legs = [];
    if (code && !RX_CODE.test(code) && !P.isTok(code)) errs.code = 'errCode';
    if (on === false) errs.d_on = 'errTime';
    if (off === false) errs.d_off = 'errTime';
    (dr.legs || []).forEach(function (l, i) {
      l = l || {};
      var kind = KINDS.indexOf(l.kind) >= 0 ? l.kind : 'unknown', gnd = kind === 'ground', p = 'leg' + i + '.';
      var from = gnd ? '' : upT(l.from), to = gnd ? '' : upT(l.to), loc = upT(l.loc);
      var out = normTime(l.out), inn = normTime(l.in), blk = normBlock(l.block);
      if (from && !RX_APT.test(from)) errs[p + 'from'] = 'errApt';
      if (to && !RX_APT.test(to)) errs[p + 'to'] = 'errApt';
      if (gnd && loc && !RX_LOC.test(loc)) errs[p + 'loc'] = 'errLoc';
      if (!gnd && (from || to || !RX_LOC.test(loc))) loc = '';   // 地上でない便の場所は、空港が無いときだけ残す（欄を出していないので、形の合わない値は黙って落とす）
      if (out === false) errs[p + 'out'] = 'errTime';
      if (inn === false) errs[p + 'in'] = 'errTime';
      if (blk === false) errs[p + 'block'] = 'errBlock';
      var leg = { seq: 0, from: from || null, to: to || null, loc: loc || null, out: out || null, in: inn || null,
                  in_day: inn ? day02(l.in_day) : 0, block: blk || null, kind: kind };
      if (!leg.from && !leg.to && !leg.loc && !leg.out && !leg.in && !leg.block && out !== false && inn !== false && blk !== false) return;   // 中身の無い行は落とす
      legs.push(leg);
    });
    if (legs.length > MAX_LEGS) errs.legs = 'eMax';
    legs.forEach(function (l, k) { l.seq = k + 1; });
    var day = { date: date, code: code || null, d_on: on || null, d_off: off || null, d_off_day: off ? day02(dr.d_off_day) : 0, legs: legs };
    var bad = Object.keys(errs).length > 0;
    if (!bad && !day.code && !day.d_on && !day.d_off && !legs.length) { errs.day = 'errEmpty'; bad = true; }
    return { day: bad ? null : day, errs: errs };
  }
  function draftOf(day) {
    day = day || {};
    return {
      code: day.code || '', d_on: day.d_on || '', d_off: day.d_off || '', d_off_day: day02(day.d_off_day),
      legs: (day.legs || []).slice().sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); }).map(function (l) {
        return { kind: KINDS.indexOf(l.kind) >= 0 ? l.kind : 'unknown', from: l.from || '', to: l.to || '', loc: l.loc || '',
                 out: l.out || '', in: l.in || '', in_day: day02(l.in_day), block: l.block || hmOf(l.block_min) };
      })
    };
  }
  function emptyLeg() { return { kind: 'operating', from: '', to: '', loc: '', out: '', in: '', in_day: 0, block: '' }; }
  function edInp(name, label, val, o, err, i) {
    var id = 're-' + name + (i != null ? '-' + i : ''), eid = id + '-e';
    var a = ' id="' + id + '" class="rs-in re-in' + (o.caps ? ' is-caps' : '') + (err ? ' is-bad' : '') + '" type="text" data-e="' + name + '"' +
      (i != null ? ' data-i="' + i + '"' : '') + ' value="' + esc(val) + '" autocomplete="off" spellcheck="false"' +
      (o.time || o.block ? ' inputmode="numeric" maxlength="5" placeholder="' + (o.block ? '1:35' : '07:35') + '"'
                         : ' maxlength="' + o.max + '" autocapitalize="characters"') +
      (err ? ' aria-invalid="true" aria-describedby="' + eid + '"' : '');
    var tog = o.dayE ? '<button type="button" class="ru-chip re-dt' + (o.day ? ' is-on' : '') + '" data-e="' + o.dayE + '"' + (i != null ? ' data-i="' + i + '"' : '') +
      ' aria-pressed="' + !!o.day + '">' + esc(o.day === 2 ? T.eNext + ' +2' : T.eNext) + '</button>' : '';
    return '<div class="re-f re-f-' + name + '"><label for="' + id + '">' + esc(label) + '</label>' +
      (tog ? '<div class="re-tm"><input' + a + '>' + tog + '</div>' : '<input' + a + '>') +
      (err ? '<span class="re-err" id="' + eid + '">' + esc(T[err]) + '</span>' : '') + '</div>';
  }
  function edLeg(l, i, er) {
    var p = 'leg' + i + '.', gnd = l.kind === 'ground', nm = fill(T.eLegN, { n: i + 1 });
    var kinds = '<div class="ru-chips is-sm" role="group" aria-label="' + esc(nm + ' · ' + T.f['leg.kind']) + '">' + KINDS.map(function (k) {
      var on = l.kind === k;
      return '<button type="button" class="ru-chip' + (on ? ' is-on' : '') + '" data-e="kind" data-i="' + i + '" data-v="' + k + '" aria-pressed="' + on + '">' + esc(T.eKind[k]) + '</button>';
    }).join('') + '</div>';
    var where = gnd ? edInp('loc', T.f['leg.loc'], l.loc, { max: 8, caps: true }, er[p + 'loc'], i)
      : edInp('from', T.f['leg.from'], l.from, { max: 4, caps: true }, er[p + 'from'], i) + edInp('to', T.f['leg.to'], l.to, { max: 4, caps: true }, er[p + 'to'], i);
    return '<li class="re-leg"><div class="re-leg-h"><b>' + esc(nm) + '</b>' +
      '<button type="button" class="rs-ib" data-e="delleg" data-i="' + i + '" aria-label="' + esc(T.rm + ' · ' + nm) + '">' + I_X + '</button></div>' +
      kinds + '<div class="re-grid">' + where +
        edInp('out', T.f['leg.out'], l.out, { time: true }, er[p + 'out'], i) +
        edInp('in', T.f['leg.in'], l.in, { time: true, day: l.in_day, dayE: 'in_day' }, er[p + 'in'], i) +
        edInp('block', T.f['leg.block'], l.block, { block: true }, er[p + 'block'], i) +
      '</div></li>';
  }
  function edRender(E) {
    var a = d.activeElement, keep = a && E.root.contains(a) && a.getAttribute ? { e: a.getAttribute('data-e'), i: a.getAttribute('data-i'), v: a.getAttribute('data-v'), c: a.getAttribute('data-c') } : null;
    var dr = E.draft, er = E.errs, codes = E.codes, dis = E.busy ? ' disabled' : '', cur = codeT(dr.code);
    var lab = E.opts.codeLabel || function (c) { return c; };
    var h = '<button type="button" class="rs-link ru-back" data-e="cancel"' + dis + '>' + I_BACK + esc(T.prevStep) + '</button>' +
      '<div class="ru-hd"><p class="rs-ey">' + esc(E.isNew ? T.eAdd : T.eEdit) + '</p><h2 class="rs-h">' + esc(fmtDate(E.date)) + '</h2></div>';
    h += '<section class="ru-card re-day">' + edInp('code', T.f.code, P.isTok(dr.code) ? '' : dr.code, { max: 12, caps: true }, er.code) +
      (codes.length ? '<div class="ru-chips is-sm re-codes" role="group" aria-label="' + esc(T.f.code) + '">' + codes.map(function (c) {
        var on = cur === codeT(c);
        return '<button type="button" class="ru-chip' + (on ? ' is-on' : '') + '" data-e="codechip" data-c="' + esc(c) + '" aria-pressed="' + on + '">' + esc(lab(c)) + '</button>';
      }).join('') + '</div>' : '') +
      '<div class="re-row">' + edInp('d_on', T.f.d_on, dr.d_on, { time: true }, er.d_on) +
        edInp('d_off', T.f.d_off, dr.d_off, { time: true, day: dr.d_off_day, dayE: 'd_off_day' }, er.d_off) + '</div></section>';
    h += '<section class="ru-card re-legs"><div class="ru-card-h"><h3 class="ru-h3">' + esc(T.eLegs) + '</h3></div>' +
      (dr.legs.length ? '<ol class="re-ll">' + dr.legs.map(function (l, i) { return edLeg(l, i, er); }).join('') + '</ol>' : '') +
      '<button type="button" class="rs-btn is-ghost re-add" data-e="addleg"' + (dr.legs.length >= MAX_LEGS ? ' disabled' : dis) + '>' + I_PLUS + esc(T.eAddLeg) + '</button>' +
      (dr.legs.length >= MAX_LEGS || er.legs ? '<p class="ru-qs">' + esc(T.eMax) + '</p>' : '') + '</section>';
    if (E.msg) h += '<p class="rs-flash is-bad" role="alert">' + esc(E.msg) + '</p>';
    h += '<div class="ru-act"><button type="button" class="rs-btn is-primary is-lg" data-e="save"' + dis + '>' +
        esc(E.busy ? T.saving : E.opts.mode === 'saved' ? T.eSave : T.eUse) + '</button>' +
      '<button type="button" class="rs-btn is-ghost" data-e="cancel"' + dis + '>' + esc(T.cancel) + '</button></div>';
    if (E.opts.onDelete) {
      h += E.ask
        ? '<div class="re-delq" role="group"><p>' + esc(T.eDelQ) + '</p><button type="button" class="rs-btn is-bad" data-e="delyes"' + dis + '>' + esc(T.eDelYes) + '</button>' +
          '<button type="button" class="rs-btn is-ghost" data-e="delno"' + dis + '>' + esc(T.cancel) + '</button></div>'
        : '<button type="button" class="ru-tbtn re-del" data-e="del"' + dis + '>' + esc(T.eDelDay) + '</button>';
    }
    if (E.opts.report) h += fixHTML(E.fix, 'data-e', edFix(E));
    E.root.innerHTML = h;
    var f = null;
    if (E.focus) { f = E.root.querySelector(E.focus); E.focus = null; }
    else if (keep && keep.e) f = E.root.querySelector('[data-e="' + keep.e + '"]' + attrSel('data-i', keep.i) + attrSel('data-v', keep.v) + attrSel('data-c', keep.c));
    if (f && !f.disabled) f.focus();
  }
  function edSet(E, k, i, v) { if (i == null) E.draft[k] = v; else if (E.draft.legs[+i]) E.draft.legs[+i][k] = v; }
  function edErrKey(k, i) { return i == null ? k : 'leg' + i + '.' + k; }
  function edShowErr(t, key) {
    var f = t.closest('.re-f');
    if (!f) return;
    var id = t.id + '-e', s = f.querySelector('.re-err');
    t.classList.add('is-bad');
    t.setAttribute('aria-invalid', 'true');
    t.setAttribute('aria-describedby', id);
    if (!s) { s = d.createElement('span'); s.className = 're-err'; s.id = id; f.appendChild(s); }
    s.textContent = T[key];
  }
  function edClearErr(t) {
    t.classList.remove('is-bad');
    t.removeAttribute('aria-invalid');
    t.removeAttribute('aria-describedby');
    var f = t.closest('.re-f'), s = f && f.querySelector('.re-err');
    if (s) s.parentNode.removeChild(s);
  }
  function edSyncCodes(E) {
    var c = codeT(E.draft.code);
    [].forEach.call(E.root.querySelectorAll('[data-e="codechip"]'), function (b) {
      var on = codeT(b.getAttribute('data-c')) === c;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  function edInput(E, e) {
    var t = e.target, k = t.getAttribute && t.getAttribute('data-e');
    if (k === 'fixc') { E.fix.comment = t.value; return; }
    if (!k || t.tagName !== 'INPUT') return;
    var i = t.getAttribute('data-i'), ek = edErrKey(k, i);
    edSet(E, k, i, t.value);
    if (E.errs[ek]) { delete E.errs[ek]; edClearErr(t); }
    if (k === 'code') edSyncCodes(E);
  }
  /* 欄を離れたら字を整える（"735" → "07:35"・小文字 → 大文字）。形が合わなければ、その欄の横に出す */
  function edBlur(E, e) {
    var t = e.target, k = t.getAttribute && t.getAttribute('data-e');
    if (!k || t.tagName !== 'INPUT' || !t.value) return;
    var i = t.getAttribute('data-i'), isT = /^(d_on|d_off|out|in)$/.test(k);
    var v = isT ? normTime(t.value) : k === 'block' ? normBlock(t.value) : upT(t.value), bad = null;
    if (v === false) bad = k === 'block' ? 'errBlock' : 'errTime';
    else {
      if (v !== t.value) { t.value = v; edSet(E, k, i, v); }
      bad = k === 'code' ? (RX_CODE.test(v) ? null : 'errCode') : (k === 'from' || k === 'to') ? (RX_APT.test(v) ? null : 'errApt')
        : k === 'loc' ? (RX_LOC.test(v) ? null : 'errLoc') : null;
    }
    if (bad) { E.errs[edErrKey(k, i)] = bad; edShowErr(t, bad); }
  }
  function edRun(E, fn) {
    var p = fn ? fn() : null;
    if (!p || typeof p.then !== 'function') return;       // その場で終わる（取り込みの確認）
    E.busy = true; E.msg = null;
    edRender(E);
    p.then(function () { E.busy = false; }, function (msg) {
      E.busy = false;
      E.msg = typeof msg === 'string' && msg ? msg : T.errSave;
      if (!E.root.parentNode) return;
      edRender(E);
      var f = E.root.querySelector('[data-e="save"]');
      if (f) f.focus();
    });
  }
  function edSave(E) {
    var r = cleanDay(E.date, E.draft);
    E.errs = r.errs;
    if (!r.day) {
      E.msg = r.errs.day ? T.errEmpty : T.errFix;
      E.focus = r.errs.day ? '[data-e="code"]' : '.re-in.is-bad';
      edRender(E);
      return;
    }
    E.msg = null;
    edRun(E, function () { return E.opts.onSave ? E.opts.onSave(r.day) : null; });
  }
  function edClick(E, e) {
    var t = e.target.closest ? e.target.closest('[data-e]') : null;
    if (!t || !E.root.contains(t) || t.disabled || t.tagName === 'INPUT') return;
    var k = t.getAttribute('data-e'), i = t.getAttribute('data-i'), dr = E.draft, l = i != null ? dr.legs[+i] : null;
    if (k === 'cancel') { if (E.opts.onCancel) E.opts.onCancel(); return; }
    if (k === 'save') return edSave(E);
    if (k === 'delyes') return edRun(E, E.opts.onDelete);
    if (k === 'codechip') {
      dr.code = t.getAttribute('data-c');
      var inp = E.root.querySelector('[data-e="code"]');
      if (inp) { inp.value = P.isTok(dr.code) ? '' : dr.code; if (E.errs.code) { delete E.errs.code; edClearErr(inp); } }
      edSyncCodes(E);
      return;
    }
    if (k === 'fix') {
      E.fix.open = !E.fix.open; E.fix.msg = null;
      E.focus = E.fix.open ? '[data-e="fixc"]' : '[data-e="fix"]';
      return edRender(E);
    }
    if (k === 'fixsend') {
      return sendFix(E.fix, E.opts.report.sb, edFix(E), function (r) {
        if (!E.root.parentNode) return;
        E.focus = r === 'ok' ? '[data-e="fixok"]' : '[data-e="fixc"]';
        edRender(E);
      });
    }
    if (k === 'd_off_day') dr.d_off_day = dr.d_off_day ? 0 : 1;
    else if (k === 'in_day' && l) l.in_day = l.in_day ? 0 : 1;
    else if (k === 'kind' && l) l.kind = t.getAttribute('data-v');
    else if (k === 'addleg') {
      if (dr.legs.length >= MAX_LEGS) return;
      dr.legs.push(emptyLeg());
      E.focus = '[data-e="from"][data-i="' + (dr.legs.length - 1) + '"]';
    }
    else if (k === 'delleg' && l) {
      dr.legs.splice(+i, 1);
      Object.keys(E.errs).forEach(function (x) { if (/^leg\d+\./.test(x)) delete E.errs[x]; });   // 行の番号が動くので、便の欄の印はいったん外す
      E.focus = '[data-e="addleg"]';
    }
    else if (k === 'del') { E.ask = true; E.focus = '[data-e="delno"]'; }
    else if (k === 'delno') { E.ask = false; E.focus = '[data-e="del"]'; }
    else return;
    edRender(E);
  }
  /* 直す画面の「運営に知らせる」：保存したこの回の直し（my-roster.js が覚えている）＋いま直している内容 */
  function edFix(E) {
    var rp = E.opts.report, r = cleanDay(E.date, E.draft);
    return fixSummary(rp.pairs ? rp.pairs(r.day || undefined) : [], { airline: rp.airline });
  }
  function editDay(box, day, opts) {
    opts = opts || {};
    day = day || {};
    var codes = (opts.codes || []).slice();
    if (day.code && codes.indexOf(day.code) < 0) codes.unshift(day.code);   // その日のコード（読み取りの印も）は必ず札に出す
    var E = { opts: opts, date: day.date, draft: draftOf(day), errs: {}, msg: null, busy: false, ask: false, focus: null,
              isNew: R.helpers.dayEmpty(day), codes: codes,
              fix: { id: 're-fix-p', open: false, comment: '', msg: null, busy: false, sent: false } };
    var root = d.createElement('div');
    root.className = 'rs ru re';
    root.addEventListener('click', function (e) { edClick(E, e); });
    root.addEventListener('input', function (e) { edInput(E, e); });
    root.addEventListener('focusout', function (e) { edBlur(E, e); });
    E.root = root;
    box.innerHTML = '';
    box.appendChild(root);
    edRender(E);
    var h = root.querySelector('.ru-hd h2');
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
    return { close: function () { if (root.parentNode) root.parentNode.removeChild(root); } };
  }

  var bound = null;
  function open(box, ctx) {
    loadClose();
    U = { box: box, ctx: ctx, items: [], step: 'pick', month: lastMonth(), run: null, merged: null, answers: {}, printed: {}, cache: {}, err: null, busy: false, pagesSent: 0,
          edits: {}, base: {}, baseIssues: [], range: null, missing: [], asked: false, seen: {}, tok: {}, build: null,
          fix: { id: 'ru-fix-p', open: false, comment: '', msg: null, busy: false, sent: false } };
    if (bound !== box) {
      bound = box;
      box.addEventListener('click', onClick);
      box.addEventListener('change', onChange);
      box.addEventListener('input', onInput);
      box.addEventListener('keydown', onKey);
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function (k) { box.addEventListener(k, onDrag); });
    }
    render();
    focusHead();
  }

  /* _ は検査（db/test-roster-ui.mjs）が呼ぶ。U を通す口は open() のあとだけ効く */
  w.PVRosterUpload = { open: open, editDay: editDay, _: {
    patchOf: patchOf, stripDay: stripDay, cleanDay: cleanDay, normTime: normTime, normBlock: normBlock, draftOf: draftOf, coverage: coverage,
    fixSummary: fixSummary, fixBody: fixBody, sendFix: sendFix, fixHTML: fixHTML,
    prepare: function (M, pages) { prepare(M, pages); }, asks: function () { return asks(); }, answers: function () { return U && U.answers; },
    needAsk: function () { return needAsk(); }, missHTML: function () { return missHTML(); }, askHTML: function () { return askHTML(); },
    sendDays: function () { return sendDays(); }, profilePatch: function () { return profilePatch(); }, checkFix: function () { return checkFix(); },
    setStep: function (s) { if (U) { if (s === 'ask') markAsked(); U.step = s; } }, click: onClick } };
}(window));
