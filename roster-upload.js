/* ════════════════════════════════════════════════════════════════
   roster-upload.js — 勤務ロスターの取り込み（2026-11-09）
   ★「勤務ロスター」のタブで「ロスターをアップロード」を押したときだけ読む（my-roster.js の loadUpload）。

   流れ
     ① 選ぶ … スクリーンショット・PDF を何枚でも（並べ替え・外すができる）。PDF は全ページを端末の中で画像にする。
                どれも長辺 2560px・JPEG（白で塗ってから描く ── payslip.js と同じ作り）。何月のロスターかを選ぶ（既定は先月）。
     ② 読む … 1ページずつ parse-roster へ（「2 / 5」）。会員が選んだ月（hint）と、前のページの最後の2日（prev_tail）を添える。
     ③ 確かめる … pv-report-engine.js の mergePages で重なり・切れ目を1日1回にまとめる。切れた日は「足すか、このまま進むか」。
                   はじめての会社だけ、読み方を聞く（実績か予定か・時刻の基準・TIME の意味・知らない勤務コード）。
     ④ 保存 … set_roster_profile（足りなかった答えだけ）→ submit_roster。

   守っていること
   ・画像は読み取りのために送るが、保存はしない（関数はメモリの中だけ）。保存するのは読み取った日付・便・時刻だけ。
     ★「画像は送りません」とは書かない（CLAUDE.md「明細の扱いは…1つの言い方」）。
   ・氏名・自由な文字は1文字も扱わない（読み取りの側が欄の形で落とす。ここも欄を決めて組み直して送る）。
   ・同じ日は1回だけ（mergePages）。同じファイルの二度目はサーバが dup で返す（file_sha ＝ 送ったページの JPEG を順につないだ SHA-256）。
   ・自動で送り直さない（向こうで処理が続いているかもしれない）。送り直すのは本人が「もう一度読む」を押したときだけ。
   ・payslip.js は直さない（PDF の部品の取り方だけ同じ形で写した）。

   window.PVRosterUpload = { open(box, ctx) }
     ctx = { sb, airline, other, airlineLabel, profile, done(res|null) }
   ════════════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';
  var d = w.document;
  var R = w.PVReport, P = w.PVRoster && w.PVRoster._;
  if (!R || !P) return;
  var L = P.L, esc = P.esc, fill = P.fill;

  var T = {
    ja: {
      back: '勤務ロスターに戻る',
      h: 'ロスターを取り込む',
      air: '会社',
      pickT: 'ロスターをアップロード',
      pickS: 'スクリーンショット・PDF を何枚でも選べます。長いロスターは、重なっていても切れていても大丈夫です。',
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
      monthQ: '何月のロスターですか',
      monthS: '月をまたぐロスターは、始まりの月を選んでください。',
      priv: '画像は読み取りのために送りますが、保存しません。保存するのは読み取った日付・便名・時刻だけで、氏名は保存しません。見られるのはあなただけで、いつでも消せます。',
      read: '読み取る（{n}ページ）',
      tooMany: '一度に読めるのは{n}ページまでです。',
      readH: '読み取っています',
      stop: '止める',
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
        not_a_roster: 'ロスターに見えませんでした。',
        undated: '日付が読めませんでした。何月のロスターかを確かめてください。',
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
        'leg.loc': '場所', 'leg.out': '出発時刻', 'leg.in': '到着時刻', 'leg.block': '便の時間', 'leg.role': '区分',
        'leg.kind': '便の種類', 'hints.kind': '実績か予定か', 'hints.time_ref': '時刻の基準'
      },
      addMore: 'スクリーンショットを足す',
      qH: 'はじめに教えてください', qS: '同じ会社の次のロスターからは、新しいことだけ聞きます。',
      qKind: 'このロスターは', qKindA: '実績（飛んだあと）', qKindP: '予定',
      qRef: '時刻は', qRefL: '現地時刻', qRefU: 'UTC',
      qMean: '便の TIME の欄は', qMeanB: 'ブロック時間（チョック・オフ〜オン）', qMeanF: '飛行時間（離陸〜着陸）', qMeanO: 'ほかの意味・わからない',
      qCodes: '勤務コードの意味', qCodesS: '答えると、休日と勤務日を正しく数えます。',
      codeOpt: { off: '休日', vac: '有給休暇', duty: '勤務', standby: 'スタンバイ', training: '訓練', ground: '地上業務', unknown: 'わからない' },
      codePick: '選ぶ',
      printed: '原本の表記から',
      save: 'この内容で保存する（{n}日）',
      saving: '保存しています…',
      cancel: 'やめる',
      errSave: '保存できませんでした。時間をおいてもう一度お試しください。',
      errLimit: '1日に取り込めるロスターの上限に達しました。明日また続きをどうぞ。',
      errBad: '読み取った内容の形が正しくありませんでした。読み取りからやり直してください。',
      errLogin: 'ログインが切れました。ページを開き直してログインしてください。',
      errDays: '一度に保存できるのは62日までです。ひと月ずつ取り込んでください。'
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
      priv: 'Images are sent to be read and are not stored. Only the dates, flight numbers and times read are saved, never names. Only you can see them, and you can delete them anytime.',
      read: 'Read ({n} pages)',
      tooMany: 'Up to {n} pages can be read at once.',
      readH: 'Reading your roster',
      stop: 'Stop',
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
        'leg.loc': 'Location', 'leg.out': 'Off-block time', 'leg.in': 'On-block time', 'leg.block': 'Leg time', 'leg.role': 'Duty type',
        'leg.kind': 'Leg type', 'hints.kind': 'Actual or planned', 'hints.time_ref': 'Time reference'
      },
      addMore: 'Add screenshots',
      qH: 'A few questions first', qS: 'Next time, for this airline, you will only be asked about anything new.',
      qKind: 'This roster shows', qKindA: 'Actual (as flown)', qKindP: 'Planned',
      qRef: 'Times are in', qRefL: 'Local time', qRefU: 'UTC',
      qMean: 'The TIME column on legs is', qMeanB: 'Block time (chocks off to chocks on)', qMeanF: 'Flight time (takeoff to landing)', qMeanO: 'Something else / not sure',
      qCodes: 'What these duty codes mean', qCodesS: 'Your answers let us count days off and duty days correctly.',
      codeOpt: { off: 'Day off', vac: 'Annual leave', duty: 'Duty', standby: 'Standby', training: 'Training', ground: 'Ground duty', unknown: 'Not sure' },
      codePick: 'Choose',
      printed: 'as printed',
      save: 'Save ({n} days)',
      saving: 'Saving…',
      cancel: 'Cancel',
      errSave: 'Could not save. Please try again in a moment.',
      errLimit: 'You have reached today’s roster import limit. Please continue tomorrow.',
      errBad: 'What was read was not in a valid shape. Please read the roster again.',
      errLogin: 'Your login has expired. Reload the page and log in again.',
      errDays: 'Up to 62 days can be saved at once. Please import one month at a time.'
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
      priv: 'Las imágenes se envían para leerlas y no se guardan. Solo se guardan las fechas, los números de vuelo y las horas leídas, nunca nombres. Solo tú puedes verlos y puedes eliminarlos cuando quieras.',
      read: 'Leer ({n} páginas)',
      tooMany: 'Se pueden leer hasta {n} páginas a la vez.',
      readH: 'Leyendo tu programación',
      stop: 'Detener',
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
        'leg.loc': 'Lugar', 'leg.out': 'Hora off-block', 'leg.in': 'Hora on-block', 'leg.block': 'Tiempo del tramo', 'leg.role': 'Tipo de actividad',
        'leg.kind': 'Tipo de tramo', 'hints.kind': 'Real o planificada', 'hints.time_ref': 'Referencia horaria'
      },
      addMore: 'Agregar capturas',
      qH: 'Primero, unas preguntas', qS: 'La próxima vez, para esta aerolínea, solo te preguntaremos lo nuevo.',
      qKind: 'Esta programación muestra', qKindA: 'Real (lo volado)', qKindP: 'Lo planificado',
      qRef: 'Las horas están en', qRefL: 'Hora local', qRefU: 'UTC',
      qMean: 'La columna TIME de los tramos es', qMeanB: 'Tiempo block (de calzos fuera a calzos dentro)', qMeanF: 'Tiempo de vuelo (del despegue al aterrizaje)', qMeanO: 'Otra cosa / no estoy seguro',
      qCodes: 'Qué significan estos códigos de servicio', qCodesS: 'Con tus respuestas contamos bien los días libres y los días de servicio.',
      codeOpt: { off: 'Día libre', vac: 'Vacaciones anuales', duty: 'Servicio', standby: 'Standby', training: 'Entrenamiento', ground: 'Actividad en tierra', unknown: 'No estoy seguro' },
      codePick: 'Elegir',
      printed: 'según lo impreso',
      save: 'Guardar ({n} días)',
      saving: 'Guardando…',
      cancel: 'Cancelar',
      errSave: 'No se pudo guardar. Inténtalo de nuevo en un momento.',
      errLimit: 'Alcanzaste el límite de importaciones de hoy. Continúa mañana.',
      errBad: 'Lo leído no tiene un formato válido. Vuelve a leer la programación.',
      errLogin: 'Tu sesión expiró. Vuelve a cargar la página e inicia sesión de nuevo.',
      errDays: 'Se pueden guardar hasta 62 días a la vez. Importa un mes a la vez.'
    } /*/PV-MSG:es*/
  };
  T = (w.PV_T && w.PV_T(T, L)) || T[L];

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
  function startRead() {
    var pages = allPages();
    if (!pages.length || pages.length > MAX_PAGES) return;
    U.err = null;
    U.step = 'read';
    U.run = { i: 0, n: pages.length, pages: pages, out: new Array(pages.length), fail: null, stop: false };
    render();
    next(U.run);
  }
  function tailBefore(run, k) {
    for (var j = k - 1; j >= 0; j--) if (run.out[j]) return (run.out[j].days || []).slice(-2);
    return [];
  }
  function next(run) {
    if (!U || run !== U.run) return;
    if (run.stop) { U.step = 'pick'; render(); return; }
    if (run.i >= run.n) return finishRead(run);
    var k = run.i, pg = run.pages[k], prev = k ? run.pages[k - 1].sha : '';
    var key = pg.sha + '|' + U.month + '|' + prev;
    if (U.cache[key]) {                       // 同じページ・同じ月・同じ並びは読み直さない（足したときの二重の費用を避ける）
      run.out[k] = renumber(U.cache[key], k + 1);
      run.i++;
      render();
      return next(run);
    }
    var tail = tailBefore(run, k);
    b64Of(pg.blob).then(function (b64) { return invoke(b64, k + 1, run.n, tail); }, function () { return { ok: false, reason: 'prep_failed' }; })
      .then(function (res) {
        if (!U) return;
        if (res && res.ok && res.roster) U.cache[key] = res.roster;   // 止めたあとに届いた答えも取っておく（読み直しの費用を出さない）
        if (run !== U.run) return;
        if (res && res.ok && res.roster) {
          run.out[k] = res.roster;
          run.i++;
          render();
          next(run);
        } else {
          var why = (res && res.reason) || 'other';
          if (why === 'network' || why === 'timeout') report(why, why === 'timeout' ? 'timeout' : 'network');
          run.fail = { k: k, why: why };
          render();
        }
      });
  }
  function finishRead(run) {
    var got = run.out.filter(Boolean);
    if (!got.length) { U.step = 'pick'; U.err = T.noneRead; render(); return; }
    U.merged = R.mergePages(got);
    U.pagesSent = run.n;
    U.answers = {};
    var h = U.merged.hints || {}, pr = U.ctx.profile || {};
    if (!pr.kind && h.kind) U.answers.kind = h.kind;
    if (!pr.time_ref && h.time_ref) U.answers.time_ref = h.time_ref;
    U.printed = { kind: !!(!pr.kind && h.kind), time_ref: !!(!pr.time_ref && h.time_ref) };
    /* ★意味が決まっている勤務コードは、選んだ状態で出す（本人は変えられる）。聞くのは分からないものだけにする
         （指示書「必要なところだけ本人に確認」）。読み取りが漢字・言葉を英字にそろえた OFF・VAC・SBY・TRN・GND と、
         航空の決まった略語（OFF1・RDO・SIM…）だけ。それ以外は今までどおり「選ぶ」。 */
    unknownCodes().forEach(function (c) {
      var k = STD_CODE(c);
      if (k) { U.answers.codes = U.answers.codes || {}; U.answers.codes[c] = k; }
    });
    U.step = 'confirm';
    render();
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

  /* ── 確かめる ─────────────────────────────────────────────── */
  function draftProfile() {
    var pr = U.ctx.profile || {}, a = U.answers, codes = {};
    Object.keys(pr.codes || {}).forEach(function (k) { codes[k] = pr.codes[k]; });
    Object.keys(a.codes || {}).forEach(function (k) { if (a.codes[k]) codes[k] = a.codes[k]; });
    return { kind: pr.kind || a.kind || null, time_ref: pr.time_ref || a.time_ref || null, tz: pr.tz || null,
             time_meaning: pr.time_meaning || a.time_meaning || null, codes: codes };
  }
  function unknownCodes() {
    var pr = U.ctx.profile || {}, months = R.rosterMonths(U.merged.days, { codes: pr.codes || {} }), seen = {}, out = [];
    months.forEach(function (m) { (m.unclassifiedCodes || []).forEach(function (c) { if (!seen[c]) { seen[c] = 1; out.push(c); } }); });
    return out.slice(0, 40);
  }
  function showVal(v) { return String(v).replace(/\+0$/, function () { return ''; }).replace(/\+(\d)$/, function (m, n) { return ' (+' + n + ')'; }); }
  function chosenOf(it) {
    var dy = U.merged.days.filter(function (x) { return x.date === it.date; })[0];
    if (!dy || !it.field) return null;
    if (it.field === 'code' || it.field === 'd_on') return dy[it.field];
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
    if (!M.days.some(function (x) { return x.date.slice(0, 7) === U.month; })) list.push(fill(T.iMonth, { m: P.monthTitle(U.month) }));
    M.issues.forEach(function (it) {
      var k = [it.date, it.type, it.field, it.seq].join('|');
      if (seen[k]) return;
      seen[k] = 1;
      var dt = it.date ? fmtDate(it.date) : '';
      if (it.type === 'incomplete') list.push(fill(T.iCut, { d: dt }));
      else if (it.type === 'conflict') {
        var u = chosenOf(it);
        list.push(fill(T.iConf, { d: dt, f: T.f[it.field] || it.field, v: (it.values || []).map(showVal).join(' / ') }) + (u ? ' ' + fill(T.iUse, { u: u }) : ''));
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
  function radios(name, cur, opts, printed) {
    return '<div class="ru-radios" role="radiogroup">' + opts.map(function (o) {
      return '<label class="ru-radio"><input type="radio" name="' + name + '" value="' + o[0] + '"' + (cur === o[0] ? ' checked' : '') + '><span>' + esc(o[1]) + '</span></label>';
    }).join('') + (printed ? '<span class="ru-printed">' + esc(T.printed) + '</span>' : '') + '</div>';
  }
  function questionsHTML() {
    var pr = U.ctx.profile || {}, a = U.answers, q = '';
    if (!pr.kind) q += '<fieldset class="ru-q"><legend>' + esc(T.qKind) + '</legend>' + radios('ru-kind', a.kind, [['actual', T.qKindA], ['planned', T.qKindP]], U.printed.kind) + '</fieldset>';
    if (!pr.time_ref) q += '<fieldset class="ru-q"><legend>' + esc(T.qRef) + '</legend>' + radios('ru-ref', a.time_ref, [['local', T.qRefL], ['utc', T.qRefU]], U.printed.time_ref) + '</fieldset>';
    if (!pr.time_meaning) q += '<fieldset class="ru-q"><legend>' + esc(T.qMean) + '</legend>' + radios('ru-mean', a.time_meaning, [['block', T.qMeanB], ['flight', T.qMeanF], ['other', T.qMeanO]]) + '</fieldset>';
    var codes = unknownCodes();
    if (codes.length) {
      var opts = ['off', 'vac', 'duty', 'standby', 'training', 'ground', 'unknown'];
      q += '<fieldset class="ru-q"><legend>' + esc(T.qCodes) + '</legend><p class="ru-qs">' + esc(T.qCodesS) + '</p><div class="ru-codes">' +
        codes.map(function (c) {
          var cur = (a.codes || {})[c] || '';
          return '<label class="ru-code"><span class="rs-tag">' + esc(c) + '</span><select class="rs-sel" data-code="' + esc(c) + '">' +
            '<option value="">' + esc(T.codePick) + '</option>' +
            opts.map(function (o) { return '<option value="' + o + '"' + (cur === o ? ' selected' : '') + '>' + esc(T.codeOpt[o]) + '</option>'; }).join('') +
            '</select></label>';
        }).join('') + '</div></fieldset>';
    }
    if (!q) return '';
    return '<section class="ru-card"><h3 class="ru-h3">' + esc(T.qH) + '</h3><p class="ru-qs">' + esc(T.qS) + '</p>' + q + '</section>';
  }
  function previewHTML() {
    var months = R.rosterMonths(U.merged.days, draftProfile()).slice(0, 3);
    return '<div class="ru-prev">' + months.map(function (m) {
      var bd = {};
      m.days.forEach(function (x) { bd[x.date] = x; });
      return '<div class="ru-prev-m"><p class="ru-prev-t">' + esc(P.monthTitle(m.ym)) + '</p>' + P.calHTML(m.ym, bd, { mini: true }) + '</div>';
    }).join('') + '</div>';
  }

  /* ── 保存 ───────────────────────────────────────────────── */
  function stripDay(x) {
    return {
      date: x.date, code: x.code || null, d_on: x.d_on || null, d_off: x.d_off || null, d_off_day: x.d_off_day || 0,
      page: x.page || null, row: x.row || null,
      legs: (x.legs || []).map(function (l) {
        return { seq: l.seq, flight: l.flight || null, from: l.from || null, to: l.to || null, loc: l.loc || null,
                 out: l.out || null, in: l.in || null, in_day: l.in_day || 0, block: l.block || null, role: l.role || null,
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
    ['kind', 'time_ref', 'time_meaning'].forEach(function (k) { if (!pr[k] && a[k]) { p[k] = a[k]; any = true; } });
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
        U.err = code === '54000' ? T.errLimit : code === '22023' ? T.errBad : code === '42501' ? T.errLogin : T.errSave;
        render();
        return;
      }
      var done = c.done, res = { saved: !r.data.dup, dup: !!r.data.dup, days: r.data.days || days.length, ym: ymAfter };
      U = null;
      done(res);
    }, function () { U.busy = false; U.err = T.errSave; render(); });
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
  function readHTML() {
    var run = U.run, k = run.fail ? run.fail.k : run.i;
    var pct = run.n ? Math.min(1, run.i / run.n) : 0;
    var thumbs = run.pages.map(function (p, i) {
      var st = run.out[i] ? 'is-ok' : (run.fail && run.fail.k === i) ? 'is-ng' : (i === run.i && !run.fail) ? 'is-now' : '';
      return '<li class="ru-pg ' + st + '">' + (p.thumb ? '<img src="' + p.thumb + '" alt="">' : '') + '<span>' + (i + 1) + '</span></li>';
    }).join('');
    var fail = '';
    if (run.fail) {
      var fatal = !!FATAL[run.fail.why], some = run.out.some(Boolean);
      fail = '<div class="ru-fail" role="alert"><b>' + esc(fill(T.failH, { i: run.fail.k + 1 })) + '</b><p>' + esc(T.why[run.fail.why] || T.why.other) + '</p><div class="ru-act">' +
        (fatal ? '' : '<button type="button" class="rs-btn is-primary" data-u="retry">' + esc(T.retry) + '</button>' +
                      '<button type="button" class="rs-btn is-ghost" data-u="skip">' + esc(T.skip) + '</button>') +
        (some ? '<button type="button" class="rs-btn is-ghost" data-u="sofar">' + esc(T.useSoFar) + '</button>' : '') +
        '<button type="button" class="rs-btn is-ghost" data-u="cancel">' + esc(T.cancel) + '</button></div></div>';
    }
    return '<section class="ru-card ru-read" aria-live="polite">' +
      '<div class="ru-prog"><b class="ru-prog-n">' + Math.min(k + 1, run.n) + ' / ' + run.n + '</b>' +
        '<div class="ru-bar"><i style="transform:scaleX(' + pct.toFixed(3) + ')"></i></div></div>' +
      '<ol class="ru-pgs">' + thumbs + '</ol>' + fail +
      (run.fail ? '' : '<div class="ru-act"><button type="button" class="rs-btn is-ghost" data-u="stop">' + esc(T.stop) + '</button></div>') +
      '</section>';
  }
  function confirmHTML() {
    var M = U.merged, days = M.days, nLegs = 0;
    days.forEach(function (x) { nLegs += (x.legs || []).length; });
    var a = days.length ? days[0].date : null, b = days.length ? days[days.length - 1].date : null;
    var tooMany = days.length > MAX_DAYS, cut = M.issues.some(function (x) { return x.type === 'incomplete'; });
    return '<section class="ru-card"><h3 class="ru-h3">' + esc(fill(T.found, { n: days.length, a: fmtDate(a), b: fmtDate(b) })) + '</h3>' +
        '<p class="ru-qs">' + esc(fill(T.legsN, { n: nLegs })) + '</p>' + previewHTML() + '</section>' +
      issuesHTML() + questionsHTML() +
      (tooMany ? '<p class="rs-flash is-bad" role="alert">' + esc(T.errDays) + '</p>' : '') +
      (U.err ? '<p class="rs-flash is-bad" role="alert">' + esc(U.err) + '</p>' : '') +
      '<div class="ru-act">' +
        '<button type="button" class="rs-btn is-primary is-lg" data-u="save"' + (U.busy || tooMany ? ' disabled' : '') + '>' +
          esc(U.busy ? T.saving : fill(T.save, { n: days.length })) + '</button>' +
        (cut ? '' : '<button type="button" class="rs-btn is-ghost" data-u="more"' + (U.busy ? ' disabled' : '') + '>' + esc(T.addMore) + '</button>') +   // 切れた日があれば、足すボタンはその説明の横だけ
        '<button type="button" class="rs-btn is-ghost" data-u="cancel"' + (U.busy ? ' disabled' : '') + '>' + esc(T.cancel) + '</button>' +
      '</div>';
  }
  function render() {
    if (!U) return;
    var a = d.activeElement, keep = a && U.box.contains(a) ? (a.getAttribute('data-u') || '') + '|' + (a.getAttribute('data-id') || '') + '|' + (a.getAttribute('data-code') || '') + '|' + (a.name || '') + '|' + (a.value || '') : null;
    var body = U.step === 'read' ? readHTML() : U.step === 'confirm' ? confirmHTML() : pickHTML();
    var title = U.step === 'read' ? T.readH : U.step === 'confirm' ? T.confH : T.h;
    U.box.innerHTML = '<div class="rs ru">' +
      '<button type="button" class="rs-link ru-back" data-u="cancel">' + I_BACK + esc(T.back) + '</button>' +
      '<div class="ru-hd"><h2 class="rs-h">' + esc(title) + '</h2><p class="rs-ey">' + esc(T.air) + ' · <span class="rs-air">' + esc(U.ctx.airlineLabel) + '</span></p></div>' +
      body + '<input type="file" class="ru-file" multiple accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf,.pdf" hidden></div>';
    if (keep) {
      var parts = keep.split('|'), sel = null;
      if (parts[0]) sel = '[data-u="' + parts[0] + '"]' + (parts[1] ? '[data-id="' + parts[1] + '"]' : '');
      else if (parts[2]) sel = '[data-code="' + parts[2] + '"]';
      else if (parts[3]) sel = 'input[name="' + parts[3] + '"][value="' + parts[4] + '"]';
      var f = sel && U.box.querySelector(sel);
      if (f && f.disabled && parts[1]) f = U.box.querySelector('[data-id="' + parts[1] + '"]:not([disabled])');   // 端まで動かしたら、同じ行の残りのボタンへ
      if (f && !f.disabled) f.focus(); else { var h = U.box.querySelector('.ru-hd h2'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
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
    var t = e.target.closest ? e.target.closest('[data-u]') : null;
    if (!U || !t || !U.box.contains(t) || t.disabled) return;
    var u = t.getAttribute('data-u'), id = t.getAttribute('data-id');
    if (u === 'pick') { var inp = U.box.querySelector('.ru-file'); if (inp) inp.click(); }
    else if (u === 'up') move(id, -1);
    else if (u === 'down') move(id, 1);
    else if (u === 'rm') { U.items = U.items.filter(function (x) { return x.id !== id; }); render(); var nb = U.box.querySelector('[data-u="pick"]'); if (nb) nb.focus(); }
    else if (u === 'read') startRead();
    else if (u === 'stop') { U.run = null; U.step = 'pick'; render(); }
    else if (u === 'retry') { U.run.fail = null; render(); next(U.run); }
    else if (u === 'skip') { var r = U.run; r.fail = null; r.i++; render(); next(r); }
    else if (u === 'sofar') { var r2 = U.run; r2.fail = null; finishRead(r2); }
    else if (u === 'more') { U.step = 'pick'; U.err = null; render(); var p = U.box.querySelector('[data-u="pick"]'); if (p) { p.focus(); p.click(); } }
    else if (u === 'save') save();
    else if (u === 'cancel') { if (U.run) U.run.stop = true; var dn = U.ctx.done; U = null; dn(null); }
  }
  function onChange(e) {
    if (!U) return;
    var t = e.target;
    if (t.classList.contains('ru-file')) { addFiles(t.files); t.value = ''; return; }
    if (t.getAttribute('data-u') === 'month') { U.month = t.value; return; }
    if (t.name === 'ru-kind') U.answers.kind = t.value;
    else if (t.name === 'ru-ref') U.answers.time_ref = t.value;
    else if (t.name === 'ru-mean') U.answers.time_meaning = t.value;
    else if (t.hasAttribute('data-code')) {
      (U.answers.codes = U.answers.codes || {})[t.getAttribute('data-code')] = t.value;
      var pv = U.box.querySelector('.ru-prev');          // 見本のカレンダーだけ描き直す（答えている途中の欄は触らない）
      if (pv) pv.outerHTML = previewHTML();
    }
    if (/^ru-(kind|ref)$/.test(t.name)) {
      U.printed[t.name === 'ru-kind' ? 'kind' : 'time_ref'] = false;
      var fs = t.closest('fieldset'), pn = fs && fs.querySelector('.ru-printed');
      if (pn) pn.parentNode.removeChild(pn);
    }
  }
  function onDrag(e) {
    if (!U || U.step !== 'pick') return;
    var z = e.target.closest ? e.target.closest('.ru-drop') : null;
    if (!z) return;
    e.preventDefault();
    z.classList.toggle('is-over', e.type === 'dragover' || e.type === 'dragenter');
    if (e.type === 'drop' && e.dataTransfer) addFiles(e.dataTransfer.files);
  }

  var bound = null;
  function open(box, ctx) {
    U = { box: box, ctx: ctx, items: [], step: 'pick', month: lastMonth(), run: null, merged: null, answers: {}, printed: {}, cache: {}, err: null, busy: false, pagesSent: 0 };
    if (bound !== box) {
      bound = box;
      box.addEventListener('click', onClick);
      box.addEventListener('change', onChange);
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function (k) { box.addEventListener(k, onDrag); });
    }
    render();
    var h = box.querySelector('.ru-hd h2');
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }

  w.PVRosterUpload = { open: open, _: { patchOf: patchOf, stripDay: stripDay } };   // _ は検査（db/test-roster-ui.mjs）が呼ぶ
}(window));
