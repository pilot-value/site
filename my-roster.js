/* ════════════════════════════════════════════════════════════════
   my-roster.js — マイレポート（MY PAGE の ③ YOUR PAY）の「勤務ロスター」のタブ（2026-11-09）
   ★オーナー「給与サマリー｜勤務ロスター｜分析」。読み込みは my-value.js がこのタブを開いたときだけ
     （my-roster.css と pv-report-engine.js が先に届いてから）。

   画面の並び（承認済みの見本 pc-roster / mobile-roster の構造）
     見出し（月の切り替え・追加） → その月の数字 → 月のカレンダー｜選んだ日の便と勤務
       → 日別の勤務時間の図 → 提出資料
   ロスターがまだ無い人には、大きな「ロスターをアップロード」のボタンと1行だけ。

   守っていること
   ・数字は本人の勤務表の行だけ（my_roster / my_roster_docs。どちらも本人の鍵の行しか返さない）。
     時間・日数の数え方は pv-report-engine.js の rosterMonths だけ（ここで数え直さない）。
     月の値が出ない（月の一部しか取り込んでいない）ときは、分かった分を「N日ぶん」と断って出す。0 で埋めない。
   ・空港は原本の表記のまま（HND→KIX）。地上の業務に空港を作らない（場所 loc だけ）。便の種類の分からない便は「区分確認中」。
     便の乗務の区分（CAP など）は持たない（2026-11-10・勤務表に並ぶのはほかの乗員の区分だった）。
   ・読み取りの印（'#'＋小文字16進16字＝辞書に無い言葉）は画面に出さない。「勤務表の言葉 A」か、意味が分かればその意味で出す。
   ・お金は1つも出さない（通貨の切り替えは関係しない）。
   ・タブを移っても、選んだ月・日はそのまま。隠れているあいだは図を描かない（見えたときに描き直す）。
   ・取り込み（画像・PDF → 読み取り → 確かめる → 保存）は roster-upload.js（押したときだけ読む）。
   ・保存したあとに1日を直す・入れる・消す画面も roster-upload.js の editDay（日の板の「この日を直す」・保存は edit_roster_day）。
   ・分からない値を 0 で出さない（便の時間が1つも分からない月は「—」と「便の時間が無い便 N」）。空欄の日は記録の無い日として出す。

   window.PVRoster = { mount(el, ctx), show(), hide(), redraw(), open(o), current(), _（取り込みの画面が借りる道具） }
     ctx = { sb, reports（my_pay_reports の行）, urls: { upload, airlines } }
     open({ date:'YYYY-MM-DD' }) … その日を選んだ画面にする（分析のタブの点から来る。読み込み中なら届いてから）
     open({ upload:true })       … 取り込みの画面を開く（分析のタブの「ロスターを足す」から来る）
     current() → { airline, other } いま見ている会社（分析のタブも同じ会社で数える）
     会社を替えた・保存した・消したときは 'pv-roster-change'（detail = current()）を飛ばす
   ════════════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';
  var d = w.document;
  var R = w.PVReport;
  if (!R || !R.rosterMonths) return;            // 計算の部品が無ければ黙って出さない（my-value.js がエラーの板を出す）
  var L = (w.PV_BASE === 'en' || d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';

  var T = {
    ja: {
      eyebrow: 'YOUR SCHEDULE',
      monthT: '{y}年{n}月', monthDuty: '{t}の勤務',
      mon: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      monS: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      wd: ['月', '火', '水', '木', '金', '土', '日'],
      dayT: '{n}月{d}日（{w}）',
      prev: '前の月', next: '次の月', monthSel: '表示する月',
      add: 'スケジュールを追加',
      upT: 'スケジュールをアップロード',
      upS: 'スクリーンショット・PDF を何枚でも。重なっていても1日1回に数えます。',
      upF: 'PDF · PNG · JPG · WebP',
      emptyS: '勤務の時間と便が月ごとにまとまり、給与と並べて見られるようになります。',
      airline: '会社', airlinePick: '会社を選んでください', airlineOther: '一覧にない会社', airlineOtherPh: '会社名',
      airlineChange: '会社を変える',
      kDuty: '勤務時間', kBlock: 'ブロック時間', kFlight: '飛行時間', kTime: '便の時間',
      kDays: '勤務日', kSectors: '便数', kDh: 'DH', kOff: '休日', kVac: '有休',
      uDays: '日', uLegs: '便',
      partialOf: '{c}日ぶん（この月は{n}日）',
      gapsOf: '時刻が読めない日（{n}日）を除く',
      calH: '{t}',
      calHint: '日付を選ぶと、その日の便と勤務が出ます',
      lgDuty: '勤務', lgVac: 'VAC 有休',
      dOn: 'D-ON', dOff: 'D-OFF',
      dDuty: '勤務時間', dLegsT: '便の時間の合計', dLegsN: '便・業務', inclDh: 'DH 含む',
      legsH: '便・業務', asPrinted: '空港コードは原本の表記',
      nItems: '{n}件',
      kindDh: 'DH', kindGround: '地上業務', kindUnknown: '区分確認中',
      groundS: '地上',
      cls: { off: '休日', vac: '有給休暇', duty: '勤務', standby: 'スタンバイ', training: '訓練', ground: '地上業務', unknown: '区分確認中' },
      clsS: { off: '休日', vac: '有休', duty: '勤務', standby: '待機', training: '訓練', ground: '地上', unknown: '' },
      noRec: 'この日の記録はありません。',
      noDuty: '勤務の時刻は書かれていません。',
      reselect: '日付を選び直す',
      chartEy: 'DUTY & BLOCK TIME', chartH: '日別の勤務時間',
      chartS: '原本に書かれた時刻から',
      tipDuty: '勤務', tipDh: 'DH',
      kindActual: '実績のスケジュール', kindPlanned: '予定のスケジュール',
      docsH: '提出資料',
      docPages: '{n}ページ', docUse: 'いま使っている日 {o} / {n}日', docAdded: '{d} に追加',
      del: '削除', delQ: 'この資料と、この資料から入った {n}日ぶんの勤務を消します。', delYes: '消す', delNo: 'やめる',
      delDone: '消しました。', delErr: '消せませんでした。時間をおいてもう一度お試しください。',
      docsNote: '画像は保存していません。残っているのは読み取った日付・空港・時刻だけ（便名は残しません）で、見られるのはあなただけです。2年たった日は月の合計だけになります。',
      saved: '{n}日ぶんの勤務を保存しました。', savedDup: 'この資料はもう取り込み済みです。',
      notReady: 'スケジュールはまだ使えません。準備ができしだい、ここから取り込めます。',
      err: 'スケジュールを読み込めませんでした。時間をおいて開き直してください。',
      upErr: '取り込みの画面を読み込めませんでした。時間をおいてもう一度お試しください。',
      noMonth: 'この月の記録はありません。',
      /* CSV と印刷（表示中の月だけ） */
      csvA: 'CSVで保存（{t}）', print: '印刷', printA: '{t}の勤務を印刷', csvRange: '範囲', csvRoster: 'スケジュール {m}',
      /* 保存したあとに直す（2026-11-09） */
      editDay: 'この日を直す', addDay: 'この日を入れる', editLimit: '今日はこれ以上直せません。明日また続きをどうぞ。', editOld: '2年より前の日は直せません。', docManual: '手で入れた日', kNoTime: '便の時間が無い便 {n}',
      editDone: 'この日を直しました。', delDayDone: 'この日を消しました。',
      editLogin: 'ログインが切れました。ページを開き直してログインしてください。', editBad: '入力の形が正しくありません。',
      editNotReady: 'まだ使えません。', editErr: '保存できませんでした。時間をおいてもう一度お試しください。',
      tokL: '勤務表の言葉 {k}'
    },
    en: {
      eyebrow: 'YOUR ROSTER',
      monthT: '{M} {y}', monthDuty: 'Duty in {t}',
      mon: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      monS: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      dayT: '{w}, {s} {d}',
      prev: 'Previous month', next: 'Next month', monthSel: 'Month to show',
      add: 'Add roster',
      upT: 'Upload your roster',
      upS: 'Any number of screenshots or PDFs. Overlaps are counted once per day.',
      upF: 'PDF · PNG · JPG · WebP',
      emptyS: 'Your duty and flights add up month by month, ready to set against your pay.',
      airline: 'Airline', airlinePick: 'Choose your airline', airlineOther: 'Airline not listed', airlineOtherPh: 'Airline name',
      airlineChange: 'Change airline',
      kDuty: 'Duty time', kBlock: 'Block time', kFlight: 'Flight time', kTime: 'Leg time',
      kDays: 'Duty days', kSectors: 'Sectors', kDh: 'DH', kOff: 'Days off', kVac: 'Leave',
      uDays: '', uLegs: '',
      partialOf: '{c} of {n} days',
      gapsOf: 'excl. {n} days without readable times',
      calH: '{t}',
      calHint: 'Pick a date to see its flights and duty',
      lgDuty: 'Duty', lgVac: 'VAC leave',
      dOn: 'D-ON', dOff: 'D-OFF',
      dDuty: 'Duty time', dLegsT: 'Total leg time', dLegsN: 'Legs & duties', inclDh: 'incl. DH',
      legsH: 'Legs & duties', asPrinted: 'Airport codes as printed',
      nItems: '{n}',
      kindDh: 'DH', kindGround: 'Ground duty', kindUnknown: 'Type to confirm',
      groundS: 'Ground',
      cls: { off: 'Day off', vac: 'Annual leave', duty: 'Duty', standby: 'Standby', training: 'Training', ground: 'Ground duty', unknown: 'Type to confirm' },
      clsS: { off: 'Off', vac: 'Leave', duty: 'Duty', standby: 'SBY', training: 'Training', ground: 'Ground', unknown: '' },
      noRec: 'Nothing recorded for this day.',
      noDuty: 'No duty times on this day.',
      reselect: 'Pick another date',
      chartEy: 'DUTY & BLOCK TIME', chartH: 'Daily duty time',
      chartS: 'From the times printed on your roster',
      tipDuty: 'Duty', tipDh: 'DH',
      kindActual: 'Actual roster', kindPlanned: 'Planned roster',
      docsH: 'Uploaded rosters',
      docPages: '{n} pages', docUse: 'Days in use {o} / {n}', docAdded: 'Added {d}',
      del: 'Delete', delQ: 'This removes the file record and the {n} days of duty that came from it.', delYes: 'Delete', delNo: 'Cancel',
      delDone: 'Deleted.', delErr: 'Could not delete. Please try again in a moment.',
      docsNote: 'Images are not stored. Only the dates, airports and times read from them are kept (no flight numbers), and only you can see them. After two years, days are reduced to monthly totals.',
      saved: 'Saved {n} days of duty.', savedDup: 'This roster was already imported.',
      notReady: 'Roster import is not available yet. Once it is ready, you can import from here.',
      err: 'Could not load your roster. Please try again in a moment.',
      upErr: 'Could not load the import screen. Please try again in a moment.',
      noMonth: 'Nothing recorded for this month.',
      csvA: 'Save {t} as CSV', print: 'Print', printA: 'Print duty in {t}', csvRange: 'Range', csvRoster: 'roster month {m}',
      editDay: 'Edit this day', addDay: 'Add this day', editLimit: 'You can’t make more edits today. Please continue tomorrow.', editOld: 'Days older than two years can’t be edited.', docManual: 'Days you entered', kNoTime: '{n} flights without a time',
      editDone: 'Day updated.', delDayDone: 'Day deleted.',
      editLogin: 'Your login has expired. Reload the page and log in again.', editBad: 'The entry is not in a valid shape.',
      editNotReady: 'Not available yet.', editErr: 'Could not save. Please try again in a moment.',
      tokL: 'Roster word {k}'
    }, /*PV-MSG:es*/ es: {
      eyebrow: 'TU PROGRAMACIÓN',
      monthT: '{M} {y}', monthDuty: 'Servicios · {t}',
      mon: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
      monS: ['ene', 'feb', 'mar', 'abr', 'Mayo', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
      wd: ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'],
      dayT: '{w}, {s} {d}',
      prev: 'Mes anterior', next: 'Mes siguiente', monthSel: 'Mes que se muestra',
      add: 'Agregar programación',
      upT: 'Sube tu programación',
      upS: 'Todas las capturas de pantalla o PDF que quieras. Lo que se repite se cuenta una sola vez por día.',
      upF: 'PDF · PNG · JPG · WebP',
      emptyS: 'Tus servicios y vuelos se suman mes a mes, listos para compararlos con tu remuneración.',
      airline: 'Aerolínea', airlinePick: 'Elige tu aerolínea', airlineOther: 'Aerolínea no incluida en la lista', airlineOtherPh: 'Nombre de la aerolínea',
      airlineChange: 'Cambiar de aerolínea',
      kDuty: 'Tiempo de servicio', kBlock: 'Tiempo block', kFlight: 'Tiempo de vuelo', kTime: 'Tiempo del tramo',
      kDays: 'Días de servicio', kSectors: 'Sectores', kDh: 'DH', kOff: 'Días libres', kVac: 'Vacaciones',
      uDays: '', uLegs: '',
      partialOf: '{c} de {n} días',
      gapsOf: 'excluye {n} días sin horas legibles',
      calH: '{t}',
      calHint: 'Elige una fecha para ver sus vuelos y servicios',
      lgDuty: 'Servicio', lgVac: 'VAC vacaciones',
      dOn: 'D-ON', dOff: 'D-OFF',
      dDuty: 'Tiempo de servicio', dLegsT: 'Tiempo total de tramos', dLegsN: 'Tramos y actividades', inclDh: 'incl. DH',
      legsH: 'Tramos y actividades', asPrinted: 'Códigos de aeropuerto tal como aparecen',
      nItems: '{n}',
      kindDh: 'DH', kindGround: 'Actividad en tierra', kindUnknown: 'Tipo por confirmar',
      groundS: 'Tierra',
      cls: { off: 'Día libre', vac: 'Vacaciones anuales', duty: 'Servicio', standby: 'Standby', training: 'Entrenamiento', ground: 'Actividad en tierra', unknown: 'Tipo por confirmar' },
      clsS: { off: 'Libre', vac: 'Vacaciones', duty: 'Servicio', standby: 'SBY', training: 'Entrenamiento', ground: 'Tierra', unknown: '' },
      noRec: 'No hay nada registrado para este día.',
      noDuty: 'Este día no tiene horas de servicio.',
      reselect: 'Elegir otra fecha',
      chartEy: 'SERVICIO Y TIEMPO BLOCK', chartH: 'Tiempo de servicio por día',
      chartS: 'Según las horas impresas en tu programación',
      tipDuty: 'Servicio', tipDh: 'DH',
      kindActual: 'Programación real', kindPlanned: 'Programación planificada',
      docsH: 'Programaciones subidas',
      docPages: '{n} páginas', docUse: 'Días en uso {o} / {n}', docAdded: 'Agregada el {d}',
      del: 'Eliminar', delQ: 'Esto elimina el registro del archivo y los {n} días de servicio que provienen de él.', delYes: 'Eliminar', delNo: 'Cancelar',
      delDone: 'Eliminado.', delErr: 'No se pudo eliminar. Inténtalo de nuevo en un momento.',
      docsNote: 'Las imágenes no se guardan. Solo se conservan las fechas, los aeropuertos y las horas leídas (sin números de vuelo), y solo tú puedes verlos. Después de dos años, los días quedan solo como totales mensuales.',
      saved: 'Se guardaron {n} días de servicio.', savedDup: 'Esta programación ya se había importado.',
      notReady: 'La importación de programaciones aún no está disponible. Cuando esté lista, podrás importar desde aquí.',
      err: 'No se pudo cargar tu programación. Inténtalo de nuevo en un momento.',
      upErr: 'No se pudo cargar la pantalla de importación. Inténtalo de nuevo en un momento.',
      noMonth: 'No hay nada registrado para este mes.',
      csvA: 'Guardar {t} como CSV', print: 'Imprimir', printA: 'Imprimir los servicios de {t}', csvRange: 'Rango', csvRoster: 'mes de programación {m}',
      editDay: 'Corregir este día', addDay: 'Agregar este día', editLimit: 'Hoy ya no puedes hacer más correcciones. Continúa mañana.', editOld: 'Los días de hace más de dos años no se pueden corregir.', docManual: 'Días que ingresaste', kNoTime: '{n} vuelos sin tiempo',
      editDone: 'Día actualizado.', delDayDone: 'Día eliminado.',
      editLogin: 'Tu sesión expiró. Vuelve a cargar la página e inicia sesión de nuevo.', editBad: 'Los datos no tienen un formato válido.',
      editNotReady: 'Aún no está disponible.', editErr: 'No se pudo guardar. Inténtalo de nuevo en un momento.',
      tokL: 'Palabra de la programación {k}'
    } /*/PV-MSG:es*/
  };
  var T_ALL = T;
  T = (w.PV_T && w.PV_T(T, L)) || T[L];
  /* 足したばかりの文言が es の辞書にまだ無いあいだは英語で出す（gen-msg.mjs が埋めるまで） */
  if (T === T_ALL.es) Object.keys(T_ALL.en).forEach(function (k) { if (T[k] == null) T[k] = T_ALL.en[k]; });

  /* ── 小道具 ─────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fill(f, o) { return String(f).replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? String(o[k]) : ''; }); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function hm(min) { return (min == null || !isFinite(min)) ? '—' : Math.floor(min / 60) + ':' + pad2(Math.round(min) % 60); }
  function ymd(date) { return { y: +date.slice(0, 4), m: +date.slice(5, 7), d: +date.slice(8, 10) }; }
  function daysIn(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function wdIdx(y, m, dd) { return (new Date(Date.UTC(y, m - 1, dd)).getUTCDay() + 6) % 7; }   // 月曜 = 0
  function monthTitle(ym) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7);
    return fill(T.monthT, { y: y, n: m, M: T.mon[m - 1], s: T.monS[m - 1] });
  }
  function dayTitle(date) {
    var p = ymd(date);
    return fill(T.dayT, { y: p.y, n: p.m, d: p.d, M: T.mon[p.m - 1], s: T.monS[p.m - 1], w: T.wd[wdIdx(p.y, p.m, p.d)] });
  }
  function ymAdd(ym, k) {
    var i = (+ym.slice(0, 4)) * 12 + (+ym.slice(5, 7) - 1) + k;
    return Math.floor(i / 12) + '-' + pad2(i % 12 + 1);
  }
  function nowYm() { var t = new Date(); return t.getFullYear() + '-' + pad2(t.getMonth() + 1); }
  function store(k, v) { try { if (v == null) w.localStorage.removeItem(k); else w.localStorage.setItem(k, v); } catch (e) {} }
  function stored(k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } }
  function reduced() { try { return w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

  /* 読み取りの印（辞書に無い言葉・'#'＋小文字16進16字）。★大文字にしない（大文字にすると別の印になり、本人の答えと結べない） */
  var TOK = /^#[0-9a-f]{16}$/i;
  function isTok(c) { return TOK.test(String(c == null ? '' : c).trim()); }
  function canon(c) { var t = String(c == null ? '' : c).trim(); return TOK.test(t) ? t.toLowerCase() : t.toUpperCase(); }
  function letter(i) { var a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; return i < 26 ? a[i] : a[(Math.floor(i / 26) - 1) % 26] + a[i % 26]; }
  /* 印 → 「勤務表の言葉 A」（map：印 → 字。無ければ字なし） */
  function tokName(c, map) { return fill(T.tokL, { k: (map && map[canon(c)]) || '' }).trim(); }
  function codeText(c) { return isTok(c) ? tokName(c, S.tok) : (c || ''); }

  /* 便の時間の呼び名（本人が答えた TIME の意味） */
  function timeLabel(p) {
    var m = p && p.time_meaning;
    return m === 'block' ? T.kBlock : m === 'flight' ? T.kFlight : T.kTime;
  }
  /* 1日の便の時間（DH を含む・地上は含まない）。欠けがあれば分かった分だけ・全部欠けなら null */
  function legsTime(x) {
    var s = 0, n = 0;
    (x.legs || []).forEach(function (l) { if (l.kind !== 'ground' && l.blockMin != null) { s += l.blockMin; n++; } });
    return n ? s : null;
  }
  function routeOf(x) {
    var ls = (x.legs || []).filter(function (l) { return l.from && l.to; });
    if (ls.length) return { r: ls[0].from + '→' + ls[0].to, from: ls[0].from, to: ls[0].to, more: ls.length - 1 };
    var g = (x.legs || []).filter(function (l) { return l.kind === 'ground'; })[0];
    if (g) return { r: g.loc || T.groundS, more: 0 };
    return null;
  }

  /* ── カレンダー（取り込みの確認画面も借りる）──────────────────
     byDate: 日付 → rosterMonths の日の記録。o = { sel, interactive, mini, edit, ask, flag, askLabel }
       edit … 押すと直す画面へ（選ぶ札ではないので aria-pressed を付けない）
       ask  … 日付 → 1：読めなかった日（点線に「?」）／flag … 日付 → 1：確かめてほしいところがある日（琥珀の点） */
  function cellParts(x) {
    if (!x) return { k: 'is-none', main: '', sub: '' };
    var c = x.cls, rt = routeOf(x), tok = isTok(x.code), cd = tok ? '' : (x.code || '');   // 升は狭いので、印は意味（無ければ •）で出す
    if (x.isDuty) {
      return {
        k: 'is-duty' + (c === 'standby' ? ' is-sby' : '') + ((c === 'training' || c === 'ground') ? ' is-gnd' : ''),
        main: x.dOn || cd || '•',
        sub: rt ? rt.r : (x.dOn && cd ? cd : (c ? T.clsS[c] : '')), more: rt && rt.more > 0 ? rt.more : 0,
        subH: rt && rt.from ? esc(rt.from) + '<i class="rs-c-ar">→</i>' + esc(rt.to) : null
      };
    }
    if (c === 'vac') return { k: 'is-vac', main: cd, sub: T.clsS.vac };
    if (c === 'off') return { k: 'is-off', main: cd || (tok ? T.clsS.off : ''), sub: '' };
    return { k: 'is-code', main: cd || (tok ? '•' : ''), sub: c ? T.clsS[c] : '' };
  }
  function calHTML(ym, byDate, o) {
    o = o || {};
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7), dim = daysIn(y, m), lead = wdIdx(y, m, 1);
    var h = '<div class="rs-cal-g' + (o.mini ? ' is-mini' : '') + '"' + (o.interactive ? ' role="group" aria-label="' + esc(monthTitle(ym)) + '"' : ' aria-hidden="true"') + '>';
    T.wd.forEach(function (x) { h += '<span class="rs-cal-w">' + esc(x) + '</span>'; });
    for (var i = 0; i < lead; i++) h += '<span class="rs-cell is-pad"></span>';
    for (var dd = 1; dd <= dim; dd++) {
      var date = ym + '-' + pad2(dd), x = byDate[date], p = cellParts(x), sel = o.sel === date, ask = !x && !!(o.ask && o.ask[date]);
      if (ask) p = { k: 'is-none is-ask', main: '?', sub: '' };
      var k = p.k + (o.flag && o.flag[date] ? ' has-iss' : '');
      var inner = '<span class="rs-c-d">' + dd + '</span>' +
        (p.main ? '<span class="rs-c-m">' + esc(p.main) + '</span>' : '') +
        (p.sub && !o.mini ? '<span class="rs-c-s">' + (p.subH || esc(p.sub)) + (p.more ? '<span class="rs-c-x"> +' + p.more + '</span>' : '') + '</span>' : '');
      if (o.interactive) {
        var lab = ask ? dayTitle(date) + (o.askLabel ? ' · ' + o.askLabel : '')
          : dayTitle(date) + (p.main ? ' · ' + p.main : '') + (p.sub ? ' · ' + p.sub + (p.more ? ' +' + p.more : '') : '');
        h += '<button type="button" class="rs-cell ' + k + (sel ? ' is-sel' : '') + '" data-date="' + date + '"' + (o.edit ? '' : ' aria-pressed="' + sel + '"') +
          ' tabindex="' + ((sel || (!o.sel && dd === 1)) ? 0 : -1) + '" aria-label="' + esc(lab) + '">' + inner + '</button>';
      } else {
        h += '<span class="rs-cell ' + k + '">' + inner + '</span>';
      }
    }
    return h + '</div>';
  }

  /* ── 状態（タブを移っても残る）──────────────────────────────── */
  var S = {
    el: null, sb: null, ctx: null, visible: false, mounted: false,
    airline: null, other: null, choices: [], names: null, picking: false,
    loading: false, err: null, days: [], profile: null, docs: [], months: [], byYm: {}, yms: [],
    ym: null, date: null, view: 'roster', flash: null, confirmDel: null, busy: false,
    want: null, wantUpload: false,    // 分析のタブから頼まれた日・取り込み（読み込みが終わってから効かせる）
    tok: {}, fixes: {}                // 印の字（A・B…）／この回に直した日（運営に知らせる要約の元：日付 → { b: 直す前, a: 直した後 }）
  };
  var AKEY = 'pv_roster_airline';   // 給与を出していない人が選んだ会社（この端末だけの便利・無くても動く）

  function airlineName(code, other) {
    if (code === 'other') return other || T.airlineOther;
    var n = S.names && S.names[code];
    return n ? (n[L] || n.en || code) : String(code || '').toUpperCase();
  }
  /* 会社：最新の給与の会社（my_pay_reports の行）→ この端末で選んだ会社 → 選んでもらう */
  function pickAirline() {
    var seen = {}, list = [];
    var rows = (S.ctx.reports || []).slice();
    for (var i = rows.length - 1; i >= 0; i--) {
      var r = rows[i], a = String(r.airline || '').trim(), o = a === 'other' ? String(r.airline_other || '').trim() : '';
      if (!a || (a === 'other' && !o)) continue;
      var k = a + '|' + o.toLowerCase();
      if (seen[k]) continue;
      seen[k] = 1;
      list.push({ a: a, o: o || null });
    }
    S.choices = list;
    if (list.length) { S.airline = list[0].a; S.other = list[0].o; return; }
    try {
      var s = JSON.parse(stored(AKEY) || 'null');
      if (s && typeof s.a === 'string' && s.a) { S.airline = s.a; S.other = s.o || null; }
    } catch (e) {}
  }
  function loadNames() {
    if (!S.ctx.urls || !S.ctx.urls.airlines) return Promise.resolve();
    return fetch(S.ctx.urls.airlines).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { S.names = (j && j.airlines) || null; }, function () {});
  }

  /* ── 読む ───────────────────────────────────────────────── */
  function missingFn(e) {
    var c = e && e.code, m = String((e && e.message) || '');
    return c === 'PGRST202' || c === '42883' || c === 'PGRST205' || /could not find the function/i.test(m);
  }
  function load() {
    if (!S.airline) { S.loading = false; render(); return Promise.resolve(); }
    S.loading = true; S.err = null;
    render();
    var a = { p_airline: S.airline, p_airline_other: S.other };
    return Promise.all([
      S.sb.rpc('my_roster', { p_airline: S.airline, p_airline_other: S.other, p_from: null, p_to: null }),
      S.sb.rpc('my_roster_docs', a)
    ]).then(function (r) {
      var e = (r[0] && r[0].error) || (r[1] && r[1].error);
      if (e || !r[0].data || !r[1].data) { S.err = missingFn(e) ? 'notReady' : 'err'; return; }
      S.days = Array.isArray(r[0].data.days) ? r[0].data.days : [];
      S.profile = r[0].data.profile || null;
      S.docs = Array.isArray(r[1].data.docs) ? r[1].data.docs : [];
      compute();
    }, function () { S.err = 'err'; })
      .then(function () { S.loading = false; render(); useWant(); });
  }
  function compute() {
    S.tok = {};
    S.days.slice().sort(function (a, b) { return a && b && a.date < b.date ? -1 : 1; }).forEach(function (x) {
      if (x && isTok(x.code) && !(canon(x.code) in S.tok)) S.tok[canon(x.code)] = letter(Object.keys(S.tok).length);
    });
    S.months = R.rosterMonths(S.days, S.profile || {});
    S.byYm = {}; S.yms = [];
    S.months.forEach(function (m) { S.byYm[m.ym] = m; S.yms.push(m.ym); });
    if (!S.ym || !S.byYm[S.ym]) {
      var cur = nowYm(), past = S.yms.filter(function (y) { return y <= cur; });
      S.ym = past.length ? past[past.length - 1] : (S.yms[0] || null);
      S.date = null;
    }
    if (S.ym && (!S.date || S.date.slice(0, 7) !== S.ym)) S.date = defaultDate(S.ym);
  }
  function byDateOf(m) { var o = {}; (m ? m.days : []).forEach(function (x) { o[x.date] = x; }); return o; }
  function defaultDate(ym) {
    var m = S.byYm[ym];
    if (!m) return null;
    var t = new Date(), today = t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate());
    var hit = m.days.filter(function (x) { return x.date === today; })[0];
    if (hit) return hit.date;
    var duty = m.days.filter(function (x) { return x.isDuty; })[0];
    return (duty || m.days[0] || {}).date || null;
  }

  /* ── 描く ───────────────────────────────────────────────── */
  var ICON_UP = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M3 9h18"/><path d="M8 2.5v3"/><path d="M16 2.5v3"/><path d="M12 18v-6"/><path d="m9.5 14.5 2.5-2.5 2.5 2.5"/></svg>';
  var ICON_DOC = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';
  var ICON_DL = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>';
  var ICON_PR = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>';
  var ICON_EDIT = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  var ICON_PLUS = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

  function entryHTML(disabled) {
    return '<button type="button" class="rs-entry" data-act="upload"' + (disabled ? ' disabled' : '') + '>' +
      '<span class="rs-entry-t"><span class="rs-entry-i" aria-hidden="true">' + ICON_UP + '</span>' + esc(T.upT) + '</span>' +
      '<span class="rs-entry-s">' + esc(T.upS) + '</span>' +
      '<span class="rs-entry-f">' + esc(T.upF) + '</span></button>';
  }
  function airlinePicker() {
    var opts = '';
    if (S.names) {
      var ks = Object.keys(S.names).filter(function (k) { return S.names[k].kind !== 'retired'; });
      ks.sort(function (a, b) { return airlineName(a).localeCompare(airlineName(b)); });
      opts = ks.map(function (k) { return '<option value="' + esc(k) + '">' + esc(airlineName(k)) + '</option>'; }).join('');
    }
    return '<div class="rs-pick">' +
      '<label class="rs-lab" for="rs-air">' + esc(T.airlinePick) + '</label>' +
      '<div class="rs-pick-r"><select id="rs-air" class="rs-sel" data-act="air">' +
        '<option value="">—</option>' + opts + '<option value="other">' + esc(T.airlineOther) + '</option></select>' +
        '<input id="rs-air-o" class="rs-in" type="text" maxlength="80" placeholder="' + esc(T.airlineOtherPh) + '" autocomplete="organization" hidden>' +
      '</div></div>';
  }
  function flashHTML() {
    if (!S.flash || S.loading) return '';           // 読み直しの途中で使い切らない（届いた後の画面に出す）
    var f = S.flash; S.flash = null;
    return '<p class="rs-flash' + (f.bad ? ' is-bad' : '') + '" role="status">' + esc(f.t) + '</p>';
  }
  function headHTML(m) {
    var i = S.yms.indexOf(S.ym);
    var sel = '<select class="rs-sel rs-msel" data-act="month" aria-label="' + esc(T.monthSel) + '">' +
      S.yms.slice().reverse().map(function (y) { return '<option value="' + y + '"' + (y === S.ym ? ' selected' : '') + '>' + esc(monthTitle(y)) + '</option>'; }).join('') + '</select>';
    var air = S.choices.length > 1
      ? '<select class="rs-sel rs-asel" data-act="switch" aria-label="' + esc(T.airline) + '">' + S.choices.map(function (c, k) {
          return '<option value="' + k + '"' + (c.a === S.airline && (c.o || null) === (S.other || null) ? ' selected' : '') + '>' + esc(airlineName(c.a, c.o)) + '</option>';
        }).join('') + '</select>'
      : '<span class="rs-air">' + esc(airlineName(S.airline, S.other)) + '</span>' +
        (!S.choices.length ? '<button type="button" class="rs-link" data-act="change">' + esc(T.airlineChange) + '</button>' : '');
    return '<div class="rs-hd">' +
      '<div class="rs-hd-l"><p class="rs-ey">' + esc(T.eyebrow) + ' · ' + air + '</p>' +
        '<h2 class="rs-h">' + esc(fill(T.monthDuty, { t: monthTitle(S.ym) })) + '</h2></div>' +
      '<div class="rs-hd-r">' +
        '<div class="rs-mnav">' +
          '<button type="button" class="rs-ib" data-act="prev" aria-label="' + esc(T.prev) + '"' + (i <= 0 ? ' disabled' : '') + '><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>' +
          sel +
          '<button type="button" class="rs-ib" data-act="next" aria-label="' + esc(T.next) + '"' + (i >= S.yms.length - 1 ? ' disabled' : '') + '><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>' +
        '</div>' +
        '<button type="button" class="rs-btn" data-act="upload">' + ICON_PLUS + esc(T.add) + '</button>' +
        '<button type="button" class="rs-btn is-ghost is-sm rs-tool" data-act="csv" aria-label="' + esc(fill(T.csvA, { t: monthTitle(S.ym) })) + '">' + ICON_DL + 'CSV</button>' +
        '<button type="button" class="rs-btn is-ghost is-sm rs-tool" data-act="print" aria-label="' + esc(fill(T.printA, { t: monthTitle(S.ym) })) + '">' + ICON_PR + esc(T.print) + '</button>' +
      '</div></div>';
  }
  /* その月の数字。月の全部がそろっていれば月の値、欠けていれば分かった分を「N日ぶん」と断って出す */
  /* ★分からない値を 0:00 にしない（2026-11-09 オーナー「便の時間が 0:00」── 全部の便の時間が null だった）。
       時間の分かる便が1つも無ければ「—」、一部だけなら分かった分の合計。どちらも「便の時間が無い便 N」を添える */
  function kpiHTML(m) {
    var P = m.partial, part = !m.complete;
    var v = function (full, known) { return full != null ? full : known; };
    var g = m.gaps || {}, gb = g.block || {};
    var opN = P.sectors || 0, dhN = P.dhLegs || 0, opGap = gb.operating || 0, dhGap = gb.deadhead || 0;
    var op = (opN && opGap >= opN) ? null : v(m.blockMin.operating, P.blockMin.operating);
    var dh = (dhN && dhGap >= dhN) ? null : v(m.blockMin.deadhead, P.blockMin.deadhead);
    var dutyN = P.dutyDays || 0, duty = (dutyN && (g.duty || 0) >= dutyN) ? null : v(m.dutyMin, P.dutyMin);
    var noTime = opGap + dhGap;
    var tiles = [
      { k: T.kDuty, b: hm(duty), main: true },
      { k: timeLabel(S.profile), b: hm(op), s: dhN ? T.kDh + ' ' + hm(dh) : '', n: noTime ? fill(T.kNoTime, { n: noTime }) : '' },
      { k: T.kDays, b: String(v(m.dutyDays, P.dutyDays)), u: T.uDays },
      { k: T.kSectors, b: String(v(m.sectors, P.sectors)), u: T.uLegs, s: v(m.dhLegs, P.dhLegs) ? T.kDh + ' ' + v(m.dhLegs, P.dhLegs) : '' },
      { k: T.kOff + ' / ' + T.kVac, b: v(m.offDays, P.offDays) + ' / ' + v(m.vacDays, P.vacDays), u: T.uDays }
    ];
    var note = part ? fill(T.partialOf, { c: m.coveredDays, n: m.daysInMonth })
      : (m.gaps && m.gaps.duty ? fill(T.gapsOf, { n: m.gaps.duty }) : '');
    return '<div class="rs-kpis">' + tiles.map(function (t) {
      return '<div class="rs-kpi' + (t.main ? ' is-main' : '') + '"><span class="rs-kpi-k">' + esc(t.k) + '</span>' +
        '<b class="rs-kpi-v">' + esc(t.b) + (t.u ? '<small>' + esc(t.u) + '</small>' : '') + '</b>' +
        (t.s ? '<span class="rs-kpi-s">' + esc(t.s) + '</span>' : '') +
        (t.n ? '<span class="rs-kpi-s is-miss">' + esc(t.n) + '</span>' : '') + '</div>';
    }).join('') + (note ? '<p class="rs-kpi-n">' + esc(note) + '</p>' : '') + '</div>';
  }
  function legHTML(l) {
    var tag = '';
    if (l.kind === 'ground') tag = '<span class="rs-tag is-gnd">' + esc(T.kindGround) + '</span>';
    else if (l.kind === 'deadhead') tag = '<span class="rs-tag is-dh">' + esc(T.kindDh) + '</span>';
    if (l.kind === 'unknown') tag += '<span class="rs-tag is-unk">' + esc(T.kindUnknown) + '</span>';
    var where = l.kind === 'ground'
      ? '<b>' + esc(l.loc || '—') + '</b>'
      : (l.from || l.to)
        ? '<b>' + esc(l.from || '—') + '</b><i aria-hidden="true">→</i><b>' + esc(l.to || '—') + '</b>'
        : '<b>' + esc(l.loc || '—') + '</b>';
    var tm = (l.out || l.in)
      ? esc(l.out || '—') + ' – ' + esc(l.in || '—') + (l.inDay ? '<sup>+' + l.inDay + '</sup>' : '') : '';
    return '<li class="rs-leg' + (l.kind === 'deadhead' ? ' is-dh' : l.kind === 'ground' ? ' is-gnd' : '') + '">' +
      '<div class="rs-leg-a"><span class="rs-leg-r">' + where + '</span><span class="rs-leg-tags">' + tag + '</span></div>' +
      '<div class="rs-leg-b"><span class="rs-leg-t">' + tm + '</span>' +
        '<b class="rs-leg-h">' + (l.kind === 'ground' ? '' : esc(hm(l.blockMin))) + '</b></div></li>';
  }
  function dayHTML(date) {
    if (!date) return '<p class="rs-muted">' + esc(T.noMonth) + '</p>';
    var m = S.byYm[date.slice(0, 7)], x = m ? byDateOf(m)[date] : null;
    var kindPill = S.profile && S.profile.kind ? '<span class="rs-pill">' + esc(S.profile.kind === 'actual' ? T.kindActual : T.kindPlanned) + '</span>' : '';
    var n = x ? (x.legs || []).length : 0;
    var h = '<div class="rs-day-hd"><div><h3 class="rs-day-t">' + esc(dayTitle(date)) + '</h3>' +
      (n ? '<p class="rs-day-s">' + esc(fill(T.nItems, { n: n }) + ' · ' + T.asPrinted) + '</p>' : '') + '</div>' + kindPill + '</div>';
    if (!x) return h + '<p class="rs-muted">' + esc(T.noRec) + '</p>' + editBtn(date, false) + reselect();
    var codeLine = x.code ? '<p class="rs-day-code"><span class="rs-tag">' + esc(codeText(x.code)) + '</span>' + (x.cls ? '<span>' + esc(T.cls[x.cls]) + '</span>' : '') + '</p>' : '';
    if (x.dOn || x.dOff) {
      h += '<div class="rs-don"><div><b class="rs-big">' + esc(x.dOn || '—') + '</b><span>' + esc(T.dOn) + '</span></div>' +
        '<i class="rs-don-l" aria-hidden="true"></i>' +
        '<div class="r"><b class="rs-big">' + esc(x.dOff || '—') + (x.dOffDay ? '<sup>+' + x.dOffDay + '</sup>' : '') + '</b><span>' + esc(T.dOff) + '</span></div></div>';
      var lt = legsTime(x);
      h += '<div class="rs-dstats">' +
        '<div><span>' + esc(T.dDuty) + '</span><b>' + esc(hm(x.dutyMin)) + '</b></div>' +
        '<div><span>' + esc(T.dLegsT) + '</span><b>' + esc(hm(lt)) + '</b>' + (x.dhLegs ? '<small>' + esc(T.inclDh) + '</small>' : '') + '</div>' +
        '<div><span>' + esc(T.dLegsN) + '</span><b>' + n + '</b></div></div>';
    }
    h += codeLine;
    if (n) {
      h += '<div class="rs-legs-hd"><h4>' + esc(T.legsH) + '</h4><span>' + esc(timeLabel(S.profile)) + '</span></div>' +
        '<ol class="rs-legs">' + x.legs.map(legHTML).join('') + '</ol>';
    } else if (!x.dOn && !x.dOff && !x.code) {
      h += '<p class="rs-muted">' + esc(T.noDuty) + '</p>';
    }
    return h + editBtn(date, true) + reselect();
  }
  /* 読み取りは完璧にならない ── 保存したあとも1日ずつ直せる（記録の無い日は入れられる） */
  function editBtn(date, has) {
    return '<button type="button" class="rs-btn is-ghost is-sm rs-edit" data-act="edit" data-id="' + esc(date) + '">' + ICON_EDIT + esc(has ? T.editDay : T.addDay) + '</button>';
  }
  function reselect() { return '<button type="button" class="rs-link rs-resel" data-act="reselect">' + esc(T.reselect) + '</button>'; }

  function docsHTML() {
    if (!S.docs.length) return '';
    var rows = S.docs.map(function (dc) {
      var nw = function (t) { return '<span class="rs-nw">' + esc(t) + '</span>'; };
      var range = dc.date_from === dc.date_to ? nw(dc.date_from) : nw(dc.date_from) + ' – ' + nw(dc.date_to);
      var conf = S.confirmDel === dc.id
        ? '<div class="rs-doc-q" role="group"><p>' + esc(fill(T.delQ, { n: dc.days_owned })) + '</p>' +
            '<button type="button" class="rs-btn is-bad" data-act="del-yes" data-id="' + esc(dc.id) + '">' + esc(T.delYes) + '</button>' +
            '<button type="button" class="rs-btn is-ghost" data-act="del-no">' + esc(T.delNo) + '</button></div>'
        : '';
      return '<li class="rs-doc"><span class="rs-doc-i" aria-hidden="true">' + ICON_DOC + '</span>' +
        '<div class="rs-doc-b"><b>' + range + '</b><span>' + esc((dc.manual ? T.docManual : fill(T.docPages, { n: dc.pages })) + ' · ' +
          fill(T.docUse, { o: dc.days_owned, n: dc.days }) + ' · ' + fill(T.docAdded, { d: String(dc.created_at || '').slice(0, 10) })) + '</span></div>' +
        (S.confirmDel === dc.id ? '' : '<button type="button" class="rs-btn is-ghost is-sm" data-act="del" data-id="' + esc(dc.id) + '">' + esc(T.del) + '</button>') +
        conf + '</li>';
    }).join('');
    return '<section class="rs-card rs-docs"><div class="rs-card-h"><h3 class="rs-card-t">' + esc(T.docsH) + '</h3>' +
      '<span class="rs-card-s">' + esc(fill(T.nItems, { n: S.docs.length })) + '</span></div><ul class="rs-doc-l">' + rows + '</ul>' +
      '<p class="rs-note">' + esc(T.docsNote) + '</p></section>';
  }

  function render() {
    if (!S.el) return;
    if (S.view !== 'roster') return;            // 取り込み・直す画面のあいだは触らない
    var main = S.el.querySelector('.rs-main');
    var h = '';
    if (S.loading && !S.days.length && !S.docs.length) {
      h = '<div class="mr-skel" style="height:220px"></div>';
    } else if (S.err) {
      h = '<div class="rs-card rs-msg"><p>' + esc(S.err === 'notReady' ? T.notReady : T.err) + '</p></div>';
    } else if (!S.airline || S.picking) {
      h = flashHTML() + '<div class="rs-empty">' + airlinePicker() + entryHTML(true) + '<p class="rs-empty-s">' + esc(T.emptyS) + '</p></div>';
    } else if (!S.days.length && !S.docs.length) {
      h = flashHTML() + '<div class="rs-empty"><p class="rs-ey">' + esc(T.eyebrow) + ' · <span class="rs-air">' + esc(airlineName(S.airline, S.other)) + '</span>' +
        (!S.choices.length ? ' <button type="button" class="rs-link" data-act="change">' + esc(T.airlineChange) + '</button>' : '') + '</p>' +
        entryHTML(false) + '<p class="rs-empty-s">' + esc(T.emptyS) + '</p></div>';
    } else if (!S.ym) {
      h = flashHTML() + headless() + docsHTML();
    } else {
      var m = S.byYm[S.ym];
      h = flashHTML() + headHTML(m) + kpiHTML(m) +
        '<div class="rs-grid">' +
          '<section class="rs-card rs-cal"><div class="rs-card-h"><h3 class="rs-card-t">' + esc(monthTitle(S.ym)) + '</h3>' +
            '<span class="rs-lg"><i class="is-duty"></i>' + esc(T.lgDuty) + '<i class="is-vac"></i>' + esc(T.lgVac) + '</span></div>' +
            calHTML(S.ym, byDateOf(m), { sel: S.date, interactive: true }) +
            '<p class="rs-hint">' + esc(T.calHint) + '</p></section>' +
          '<section class="rs-card rs-day" aria-live="polite">' + dayHTML(S.date) + '</section>' +
        '</div>' +
        '<section class="rs-card rs-ch"><div class="rs-card-h"><div><p class="rs-ey">' + esc(T.chartEy) + '</p><h3 class="rs-card-t">' + esc(T.chartH) + '</h3></div>' +
          '<span class="rs-lg"><i class="is-duty"></i>D-ON〜D-OFF<i class="is-blk"></i>' + esc(timeLabel(S.profile)) + '<i class="is-dh"></i>' + esc(T.kDh) + '<i class="is-vac"></i>VAC</span></div>' +
          '<div class="rs-ch-box"><svg class="rs-ch-svg" tabindex="0" role="img" aria-label="' + esc(T.chartH + ' · ' + monthTitle(S.ym)) + '"></svg><div class="rs-tip" hidden></div></div>' +
          '<p class="rs-note">' + esc(T.chartS) + '</p></section>' +
        docsHTML();
    }
    main.innerHTML = '<div class="rs">' + h + '</div>';
    if (S.picking || !S.airline) bindPicker();
    drawChart();
  }
  /* 書類はあるが日が残っていない（後の提出に全部入れ替わった）とき */
  function headless() {
    return '<div class="rs-empty">' + entryHTML(false) + '</div>';
  }

  function bindPicker() {
    var sel = S.el.querySelector('#rs-air'), inp = S.el.querySelector('#rs-air-o'), btn = S.el.querySelector('.rs-entry');
    if (!sel) return;
    var sync = function () {
      inp.hidden = sel.value !== 'other';
      btn.disabled = !sel.value || (sel.value === 'other' && !inp.value.trim());
    };
    sel.addEventListener('change', sync);
    inp.addEventListener('input', sync);
  }

  /* ── 日を選ぶ・月を替える ────────────────────────────────── */
  function select(date, focus, scroll) {
    S.date = date;
    S.el.querySelectorAll('.rs-cell[data-date]').forEach(function (b) {
      var on = b.getAttribute('data-date') === date;
      b.classList.toggle('is-sel', on);
      b.setAttribute('aria-pressed', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    var p = S.el.querySelector('.rs-day');
    if (p) p.innerHTML = dayHTML(date);
    drawChart();
    /* 狭い画面では、選んだ日の板がカレンダーの下にある。押したら見えるところまで送る */
    if (scroll && p && w.innerWidth < 760) {
      var r = p.getBoundingClientRect();
      if (r.top > w.innerHeight - 80) p.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    }
  }
  function setMonth(ym, focusAct) {
    if (!S.byYm[ym]) return;
    S.ym = ym;
    S.date = defaultDate(ym);
    render();
    if (focusAct) { var f = S.el.querySelector('[data-act="' + focusAct + '"]'); if (f && !f.disabled) f.focus(); }
  }

  /* ── 日別の勤務時間の図（見えているときだけ描く）───────────── */
  var NS = 'http://www.w3.org/2000/svg';
  function drawChart() {
    if (!S.visible || !S.ym) return;
    var box = S.el.querySelector('.rs-ch-box'), svg = box && box.querySelector('svg');
    if (!svg) return;
    var W = box.clientWidth;
    if (W < 40) return;
    var m = S.byYm[S.ym], bd = byDateOf(m), y = +S.ym.slice(0, 4), mo = +S.ym.slice(5, 7), n = daysIn(y, mo);
    var narrow = W < 520, H = narrow ? 176 : 228, pl = 34, pr = 6, pt = 18, pb = 24;
    var cw = (W - pl - pr) / n, bw = Math.max(2, Math.min(11, cw * 0.32));
    var max = 0;
    for (var i = 1; i <= n; i++) {
      var x0 = bd[S.ym + '-' + pad2(i)];
      if (x0) max = Math.max(max, x0.dutyMin || 0, (x0.blockKnown.operating || 0) + (x0.blockKnown.deadhead || 0));
    }
    var step = max > 16 * 60 ? 6 : 4, top = Math.max(8, Math.ceil((max / 60 + 0.75) / step) * step);   // いちばん長い日の上に少し余白
    var yOf = function (min) { return pt + (H - pt - pb) * (1 - min / (top * 60)); };
    var h = '';
    for (var t = 0; t <= top; t += step) {
      var yy = yOf(t * 60).toFixed(1);
      h += '<line class="rs-g" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '"/>' +
        '<text class="rs-ax" x="' + (pl - 6) + '" y="' + yy + '" dy="3.5" text-anchor="end">' + t + 'h</text>';
    }
    for (var dd = 1; dd <= n; dd++) {
      var date = S.ym + '-' + pad2(dd), x = bd[date], cx = pl + cw * (dd - 0.5), base = yOf(0);
      if (date === S.date) h += '<rect class="rs-selband" x="' + (cx - cw / 2 + 1).toFixed(1) + '" y="' + pt + '" width="' + Math.max(1, cw - 2).toFixed(1) + '" height="' + (H - pt - pb) + '" rx="4"/>';
      if (x) {
        if (x.dutyMin) {
          var yd = yOf(x.dutyMin);
          h += '<rect class="rs-b-duty" x="' + (cx - bw - 0.5).toFixed(1) + '" y="' + yd.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (base - yd).toFixed(1) + '" rx="1.5"/>';
          if (date === S.date && !narrow) h += '<text class="rs-val" x="' + (cx - bw / 2).toFixed(1) + '" y="' + (yd - 5).toFixed(1) + '" text-anchor="middle">' + hm(x.dutyMin) + '</text>';
        }
        var op = x.blockKnown.operating || 0, dh = x.blockKnown.deadhead || 0;
        if (op) { var yo = yOf(op); h += '<rect class="rs-b-blk" x="' + (cx + 0.5).toFixed(1) + '" y="' + yo.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (base - yo).toFixed(1) + '" rx="1.5"/>'; }
        if (dh) { var y1 = yOf(op), y2 = yOf(op + dh); h += '<rect class="rs-b-dh" x="' + (cx + 0.5).toFixed(1) + '" y="' + y2.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (y1 - y2).toFixed(1) + '" rx="1.5"/>'; }
        if (x.cls === 'vac') h += '<rect class="rs-b-vac" x="' + (cx - 3.5).toFixed(1) + '" y="' + (base - 9).toFixed(1) + '" width="7" height="7" transform="rotate(45 ' + cx.toFixed(1) + ' ' + (base - 5.5).toFixed(1) + ')"/>';
      }
      if (dd === 1 || dd % 5 === 0 || (dd === n && n % 5 > 2)) h += '<text class="rs-ax" x="' + cx.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + dd + '</text>';
      h += '<rect class="rs-hit" data-date="' + date + '" x="' + (cx - cw / 2).toFixed(1) + '" y="' + pt + '" width="' + cw.toFixed(1) + '" height="' + (H - pt - pb) + '"/>';
    }
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.innerHTML = h;
  }
  function tipFor(date, ev) {
    var box = S.el.querySelector('.rs-ch-box'), tip = box && box.querySelector('.rs-tip');
    if (!tip) return;
    if (!date) { tip.hidden = true; return; }
    var m = S.byYm[S.ym], x = byDateOf(m)[date];
    var rows = '<b>' + esc(dayTitle(date)) + '</b>';
    if (!x) rows += '<span>' + esc(T.noRec) + '</span>';
    else {
      if (x.dOn || x.dOff) rows += '<span>' + esc((x.dOn || '—') + ' – ' + (x.dOff || '—') + (x.dOffDay ? ' +' + x.dOffDay : '')) + '</span>';
      if (x.dutyMin != null) rows += '<span>' + esc(T.tipDuty) + ' <b>' + hm(x.dutyMin) + '</b></span>';
      if (x.blockKnown.operating) rows += '<span>' + esc(timeLabel(S.profile)) + ' <b>' + hm(x.blockKnown.operating) + '</b></span>';
      if (x.blockKnown.deadhead) rows += '<span>' + esc(T.tipDh) + ' <b>' + hm(x.blockKnown.deadhead) + '</b></span>';
      if (x.code) rows += '<span>' + esc(codeText(x.code) + (x.cls ? ' · ' + T.cls[x.cls] : '')) + '</span>';
    }
    tip.innerHTML = rows;
    tip.hidden = false;
    var bw = box.clientWidth, n = daysIn(+S.ym.slice(0, 4), +S.ym.slice(5, 7)), dd = +date.slice(8, 10);
    var cx = 34 + (bw - 40) / n * (dd - 0.5), tw = tip.offsetWidth;
    tip.style.left = Math.max(0, Math.min(bw - tw, cx - tw / 2)) + 'px';
  }

  /* ── 操作 ───────────────────────────────────────────────── */
  function onClick(e) {
    var t = e.target.closest ? e.target.closest('[data-act],[data-date]') : null;
    if (!t || !S.el.contains(t)) return;
    if (t.classList.contains('rs-cell') && t.hasAttribute('data-date')) { select(t.getAttribute('data-date'), false, true); return; }
    if (t.classList.contains('rs-hit')) { select(t.getAttribute('data-date')); tipFor(t.getAttribute('data-date')); return; }
    var act = t.getAttribute('data-act');
    if (act === 'prev') setMonth(S.yms[S.yms.indexOf(S.ym) - 1], 'prev');
    else if (act === 'next') setMonth(S.yms[S.yms.indexOf(S.ym) + 1], 'next');
    else if (act === 'upload') openUpload();
    else if (act === 'csv') { var cv = csvOf(S.ym); if (cv && S.ctx && typeof S.ctx.csv === 'function') S.ctx.csv(cv.name, cv.rows); }
    else if (act === 'print') { tipFor(null); if (S.ctx && typeof S.ctx.print === 'function') S.ctx.print(fill(T.monthDuty, { t: monthTitle(S.ym) })); }
    else if (act === 'change') { S.picking = true; render(); var s = S.el.querySelector('#rs-air'); if (s) s.focus(); }
    else if (act === 'reselect') {
      var c = S.el.querySelector('.rs-cell.is-sel') || S.el.querySelector('.rs-cell[data-date]');
      if (c) { c.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' }); c.focus({ preventScroll: true }); }
    }
    else if (act === 'del') { S.confirmDel = t.getAttribute('data-id'); render(); var y = S.el.querySelector('[data-act="del-no"]'); if (y) y.focus(); }
    else if (act === 'del-no') { var id0 = S.confirmDel; S.confirmDel = null; render(); var b = S.el.querySelector('[data-act="del"][data-id="' + id0 + '"]'); if (b) b.focus(); }
    else if (act === 'del-yes') delDoc(t.getAttribute('data-id'));
    else if (act === 'edit') openEdit(t.getAttribute('data-id'));
  }
  function onChange(e) {
    var t = e.target, act = t.getAttribute && t.getAttribute('data-act');
    if (act === 'month') setMonth(t.value, 'month');
    else if (act === 'switch') {
      var c = S.choices[+t.value];
      if (!c) return;
      S.airline = c.a; S.other = c.o; S.ym = null; S.date = null; S.days = []; S.docs = []; S.fixes = {};
      load().then(announce);
    }
  }
  /* カレンダーは矢印で日を動かす（左右 ±1日・上下 ±1週・Home/End で月の端） */
  function onKey(e) {
    var t = e.target;
    if (t.classList && t.classList.contains('rs-cell') && t.hasAttribute('data-date')) {
      var cur = +t.getAttribute('data-date').slice(8, 10), n = daysIn(+S.ym.slice(0, 4), +S.ym.slice(5, 7)), to = null;
      if (e.key === 'ArrowRight') to = cur + 1; else if (e.key === 'ArrowLeft') to = cur - 1;
      else if (e.key === 'ArrowDown') to = cur + 7; else if (e.key === 'ArrowUp') to = cur - 7;
      else if (e.key === 'Home') to = 1; else if (e.key === 'End') to = n;
      if (to == null) return;
      e.preventDefault();
      select(S.ym + '-' + pad2(Math.max(1, Math.min(n, to))), true);
      return;
    }
    if (t.classList && t.classList.contains('rs-ch-svg') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      var nn = daysIn(+S.ym.slice(0, 4), +S.ym.slice(5, 7)), c0 = S.date ? +S.date.slice(8, 10) : 0;
      var k = Math.max(1, Math.min(nn, c0 + (e.key === 'ArrowRight' ? 1 : -1)));
      select(S.ym + '-' + pad2(k));
      tipFor(S.date);
    }
  }
  function onMove(e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains('rs-hit')) tipFor(t.getAttribute('data-date'));
  }
  function onLeave(e) {
    if (e.target && e.target.classList && e.target.classList.contains('rs-ch-svg')) tipFor(null);
  }

  function delDoc(id) {
    if (S.busy) return;
    S.busy = true;
    S.sb.rpc('delete_roster_doc', { p_doc_id: id, p_airline: S.airline, p_airline_other: S.other })
      .then(function (r) {
        S.confirmDel = null;
        S.flash = (r && !r.error && r.data && r.data.ok) ? { t: T.delDone } : { t: T.delErr, bad: true };
        return load();
      }, function () { S.confirmDel = null; S.flash = { t: T.delErr, bad: true }; render(); })
      .then(function () { S.busy = false; announce(); });
  }
  function announce() {
    try { S.el.dispatchEvent(new CustomEvent('pv-roster-change', { bubbles: true, detail: { airline: S.airline, other: S.other } })); } catch (e) {}
  }

  /* ── 取り込み（roster-upload.js を押したときだけ読む）──────────── */
  var upLoading = null;
  function loadUpload() {
    if (w.PVRosterUpload) return Promise.resolve(true);
    if (!upLoading) {
      upLoading = new Promise(function (ok) {
        var el = d.createElement('script');
        el.src = S.ctx.urls.upload;
        el.onload = function () { ok(!!w.PVRosterUpload); };
        el.onerror = function () { upLoading = null; ok(false); };
        d.head.appendChild(el);
      });
    }
    return upLoading;
  }
  function openUpload() {
    var pre = null;
    if (S.picking || !S.airline) {
      var sel = S.el.querySelector('#rs-air'), inp = S.el.querySelector('#rs-air-o');
      if (!sel || !sel.value) return;
      var o = sel.value === 'other' ? inp.value.trim() : null;
      if (sel.value === 'other' && !o) return;
      S.airline = sel.value; S.other = o; S.picking = false;
      store(AKEY, JSON.stringify({ a: S.airline, o: S.other }));
      S.days = []; S.docs = []; S.ym = null; S.fixes = {};
      pre = load();                     // その会社の読み方（profile）が届いてから開く＝聞き直さない
    }
    var learned = learnedCodes();         // 読み取りが終わるまでに届けばよい（待たずに開く）
    Promise.all([pre, loadUpload()]).then(function (r) { return r[1]; }).then(function (ok) {
      if (S.err) return;
      if (!ok) { S.flash = { t: T.upErr, bad: true }; render(); return; }
      S.view = 'upload';
      var main = S.el.querySelector('.rs-main'), box = S.el.querySelector('.rs-upbox');
      main.hidden = true; box.hidden = false;
      var ctx = { sb: S.sb, airline: S.airline, other: S.other, airlineLabel: airlineName(S.airline, S.other),
                  profile: S.profile, learned: null, done: closeUpload };
      learned.then(function (j) { ctx.learned = j; });
      w.PVRosterUpload.open(box, ctx);
      var f = box.querySelector('h2, button');
      if (f) { box.scrollIntoView({ behavior: 'auto', block: 'start' }); }
    });
  }
  /* 会社の辞書（同じ会社の3人以上がそろえた答え）。関数がまだ無い・失敗・6秒で返らない → null（黙って聞く側に回す） */
  function learnedCodes() {
    var p;
    try { p = S.sb.rpc('my_roster_airline_codes', { p_airline: S.airline, p_airline_other: S.other }); } catch (e) { return Promise.resolve(null); }
    return new Promise(function (ok) {
      var t = setTimeout(function () { ok(null); }, 6000);
      Promise.resolve(p).then(function (r) { clearTimeout(t); ok(r && !r.error && r.data && r.data.ok === true ? r.data : null); },
        function () { clearTimeout(t); ok(null); });
    });
  }
  /* res = { saved, dup, days, ym } ／ null（やめた） */
  function closeUpload(res) {
    S.view = 'roster';
    var main = S.el.querySelector('.rs-main'), box = S.el.querySelector('.rs-upbox');
    box.hidden = true; box.innerHTML = '';
    main.hidden = false;
    if (res && (res.saved || res.dup)) {
      S.flash = { t: res.dup ? T.savedDup : fill(T.saved, { n: res.days }) };
      if (res.ym) { S.ym = res.ym; S.date = null; }
      load().then(function () {
        /* ★もう一度描かない（load の終わりの描画で「保存しました」を出したところ。描き直すと知らせが消える）。
             S.ym は load の前に入れてあり、その月があれば compute() が残す。日だけその月の既定の日にそろえる */
        if (res.ym && S.byYm[res.ym] && S.ym === res.ym && !S.date) { S.date = defaultDate(res.ym); select(S.date); }
        announce();
      });
    } else {
      render();
    }
    main.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  /* ── 保存したあとに1日を直す（2026-11-09 オーナー「読み取りは完璧にならない。保存の前も後も直す画面を」）──
     画面は roster-upload.js の editDay（押したときだけ読む・取り込みの確認と同じ部品）。保存は edit_roster_day の1本：
       { p_airline, p_airline_other, p: { date, day: { code, d_on, d_off, d_off_day, legs:[{ seq, from, to, loc, out, in, in_day, block, kind }] } | null } }
     day: null はその日を消す。うまくいったら読み直して 'pv-roster-change'（delDoc と同じ流れ）。
     ★直した日は S.fixes に覚える（直す前は、この回で最初に直す前の行）── 直す画面の「読み取りの間違いを運営に知らせる」の要約の元。 */
  function rawDay(date) { return S.days.filter(function (x) { return x && x.date === date; })[0] || null; }
  function clone(x) { return x == null ? null : JSON.parse(JSON.stringify(x)); }
  /* 運営に知らせる要約の元：この回に直した日（いま開いている日は、直している最中の内容 cur で） */
  function fixPairs(date, cur) {
    var out = [];
    Object.keys(S.fixes).forEach(function (dt) { if (dt !== date) out.push(S.fixes[dt]); });
    var f = S.fixes[date];
    if (f || cur !== undefined) out.push({ b: f ? f.b : rawDay(date), a: cur !== undefined ? cur : f.a });
    return out;
  }
  function rosterCodes() {
    var n = {};
    S.days.forEach(function (x) { if (x && x.code) n[x.code] = (n[x.code] || 0) + 1; });
    return Object.keys(n).sort(function (a, b) { return (n[b] - n[a]) || (a < b ? -1 : 1); }).slice(0, 8);
  }
  function editErr(e) {
    var c = e && e.code;
    if (c === '42501') return T.editLogin;
    if (c === '54000') return T.editLimit;                          // 1日200回まで
    if (c === '22023' && /2年/.test(String((e && e.message) || ''))) return T.editOld;   // 2年より前の日（月の合計にまとめた後）
    if (c === '22023') return T.editBad;
    if (missingFn(e)) return T.editNotReady;
    return T.editErr;
  }
  function editRpc(date, day) {
    var p = { date: date, day: day ? {
      code: day.code || null, d_on: day.d_on || null, d_off: day.d_off || null, d_off_day: day.d_off_day || 0,
      legs: (day.legs || []).map(function (l) {
        return { seq: l.seq, from: l.from || null, to: l.to || null, loc: l.loc || null, out: l.out || null, in: l.in || null,
                 in_day: l.in_day || 0, block: l.block || null, kind: l.kind || 'unknown' };
      }) } : null };
    return new Promise(function (ok, ng) {
      Promise.resolve(S.sb.rpc('edit_roster_day', { p_airline: S.airline, p_airline_other: S.other, p: p })).then(function (r) {
        if (r && !r.error && r.data && r.data.ok) {
          var f = S.fixes[date];
          S.fixes[date] = { b: f ? f.b : clone(rawDay(date)), a: day ? clone(day) : null };
          ok();
          S.flash = { t: day ? T.editDone : T.delDayDone };
          closeEdit(date, true);
          return;
        }
        ng(editErr(r && r.error));
      }, function (e) { ng(editErr(e)); });
    });
  }
  function openEdit(date) {
    if (S.busy || !S.airline || !date || S.view !== 'roster') return;
    loadUpload().then(function (ok) {
      if (!ok || !w.PVRosterUpload || !w.PVRosterUpload.editDay) { S.flash = { t: T.upErr, bad: true }; render(); return; }
      if (S.view !== 'roster') return;
      var raw = rawDay(date), main = S.el.querySelector('.rs-main'), box = S.el.querySelector('.rs-upbox');
      S.view = 'edit';
      main.hidden = true; box.hidden = false;
      w.PVRosterUpload.editDay(box, raw ? JSON.parse(JSON.stringify(raw)) : { date: date, code: null, d_on: null, d_off: null, d_off_day: 0, legs: [] }, {
        mode: 'saved', codes: rosterCodes(), codeLabel: codeText,
        report: { sb: S.sb, airline: airlineName(S.airline, S.other), pairs: function (cur) { return fixPairs(date, cur); } },
        onSave: function (day) { return editRpc(date, day); },
        onDelete: raw ? function () { return editRpc(date, null); } : null,
        onCancel: function () { closeEdit(date, false); }
      });
      box.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
  }
  function closeEdit(date, saved) {
    S.view = 'roster';
    var main = S.el.querySelector('.rs-main'), box = S.el.querySelector('.rs-upbox'), ym = date.slice(0, 7);
    box.hidden = true; box.innerHTML = '';
    main.hidden = false;
    var back = function () {
      var b = S.el.querySelector('[data-act="edit"][data-id="' + date + '"]') || S.el.querySelector('.rs-day');
      if (b) { if (b.classList.contains('rs-day')) b.tabIndex = -1; b.focus({ preventScroll: true }); b.scrollIntoView({ behavior: 'auto', block: 'center' }); }
    };
    if (!saved) { render(); back(); return; }
    S.ym = ym; S.date = date;              // 読み直しの compute() はこの月・この日を残す（もう一度描くと、知らせの1行が消える）
    load().then(function () {
      announce();
      back();
    });
  }

  /* ── CSV：表示中の月だけ（1日の行 ＋ その日の便・業務の行）──────────────
     ★画面の日の板に出しているものだけ（日付・勤務コード・D-ON/OFF・勤務時間・空港・場所・時刻・便の時間・便の種類。便名は保存していないので無い）。名前・自由記述は持っていない。
       読み取りの印は「勤務表の言葉 A」で書く（印そのものは書かない）。
       空港は原本の表記のまま・地上の業務は場所だけ（空港の欄は空）。字の包み方と BOM は my-value.js の saveCsv。 */
  function hmc(min) { return (min == null || !isFinite(min)) ? '' : hm(min); }
  function csvOf(ym) {
    var m = ym && S.byYm[ym];
    if (!m) return null;
    var rows = [[T.csvRange, fill(T.csvRoster, { m: ym })],
      ['date', 'row', 'code', 'class', 'd_on', 'd_off', 'd_off_day', 'duty_hm', 'duty_min', 'seq', 'from', 'to', 'loc', 'out', 'in', 'in_day', 'time_hm', 'time_min', 'kind']];
    m.days.forEach(function (x) {
      var on = x.dOn || x.dOff;
      rows.push([x.date, 'day', codeText(x.code), x.cls || '', x.dOn || '', x.dOff || '', on ? x.dOffDay : '', hmc(x.dutyMin), x.dutyMin == null ? '' : x.dutyMin,
        '', '', '', '', '', '', '', '', '', '']);              // 1日の行も見出しと同じ列の数（表計算で列がずれない）
      (x.legs || []).forEach(function (l) {
        var gnd = l.kind === 'ground';
        rows.push([x.date, 'leg', '', '', '', '', '', '', '', l.seq, gnd ? '' : (l.from || ''), gnd ? '' : (l.to || ''), l.loc || '',
          l.out || '', l.in || '', (l.out || l.in) ? l.inDay : '', hmc(l.blockMin), l.blockMin == null ? '' : l.blockMin, l.kind]);
      });
    });
    return { name: 'pilot-value-roster_' + ym, rows: rows };
  }

  /* ── 外から呼ぶ口 ─────────────────────────────────────────── */
  function mount(el, ctx) {
    S.el = el; S.ctx = ctx || {}; S.sb = S.ctx.sb; S.mounted = true;
    el.innerHTML = '<div class="rs-main"></div><div class="rs-upbox" hidden></div>';
    el.addEventListener('click', onClick);
    el.addEventListener('change', onChange);
    el.addEventListener('keydown', onKey);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave, true);
    pickAirline();
    loadNames().then(function () { render(); });
    load();
  }
  function show() { S.visible = true; drawChart(); }
  function hide() { S.visible = false; }
  /* 分析のタブから「この日を見る」「ロスターを足す」（2026-11-09）。読み込み中なら load() の終わりで効かせる */
  function open(o) {
    o = o || {};
    if (o.upload) S.wantUpload = true;
    else if (typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date)) S.want = o.date;
    if (!S.loading && S.mounted) useWant();
  }
  function useWant() {
    if (S.view !== 'roster') { S.want = null; S.wantUpload = false; return; }
    if (S.wantUpload) { S.wantUpload = false; S.want = null; openUpload(); return; }
    var dt = S.want;
    if (!dt) return;
    S.want = null;
    if (!S.byYm[dt.slice(0, 7)]) return;
    S.ym = dt.slice(0, 7); S.date = dt;
    render();
    var p = S.el.querySelector('.rs-day'), c = S.el.querySelector('.rs-cell.is-sel');
    if (c) c.focus({ preventScroll: true });
    if (p) p.scrollIntoView({ behavior: 'auto', block: w.innerWidth < 760 ? 'start' : 'center' });
  }
  function current() { return { airline: S.airline, other: S.other }; }

  w.PVRoster = {
    mount: mount, show: show, hide: hide, redraw: drawChart, open: open, current: current,
    _: { T: T, L: L, S: S, csvOf: csvOf, compute: compute, esc: esc, fill: fill, hm: hm, pad2: pad2, monthTitle: monthTitle, dayTitle: dayTitle, ymAdd: ymAdd, nowYm: nowYm,
         calHTML: calHTML, timeLabel: timeLabel, entryIcon: ICON_UP, legHTML: legHTML, cellParts: cellParts,
         kpiHTML: kpiHTML, docsHTML: docsHTML, dayHTML: dayHTML, isTok: isTok, canon: canon, letter: letter, tokName: tokName, codeText: codeText, fixPairs: fixPairs }
  };
}(window));
