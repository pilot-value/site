/* ══════════════════════════════════════════════════════════════
   lp.js — トップページ（index.html / en/index.html）の実データ差し込みと計測

   方針
   ・日英で1本。<html lang> を見て T を切り替える＝文言が2ファイルに散らない
     （my-value.js / payslip.js と同じ形）。
   ・実データを先に取りに行き、無いときだけ「まだ出せない」と正直に出す。
     数字の水増しはしない。データが貯まればコードを触らずに本物へ切り替わる。
   ・n≧5 の判定は Postgres 側（pay_benchmarks の having count(*) >= 5）にある。
     ここでは判定しない。画面側で閾値を持つと、いつか片方だけ緩む。
   ・supabase-js のクライアントは作らない。ページ末尾で1個作っているので、
     2個目を作ると GoTrue が同じ localStorage を奪い合う。REST を素の fetch で叩く。
   ・金額は必ず「¥N,NNN万」で書き出す。currency.js の MutationObserver が
     後から拾って通貨切替に追随させる（独自フォーマットで書くと変換から漏れる）。
   ══════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';

  var SB_URL = 'https://vzgmnkrggrwtsrpqndsm.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6Z21ua3JnZ3J3dHNycHFuZHNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzkwOTcsImV4cCI6MjA5MDAxNTA5N30.wE4cJbqeYGCgn5ZvHd80hYWgQuySKvOMJMbsJWOvmtw';

  /* ロゴの置き場は、このスクリプト自身の URL を基準に解く（actual-pay.js と同じ）。
     ページ相対で書くと /en/ から en/assets/… を見に行って 404 になる。
     currentScript は同期実行中しか取れないので、ここで確定させる（defer でも取れる）。 */
  var LOGO_BASE = 'assets/airline-logos/';
  try {
    var _self = (d.currentScript && d.currentScript.src) || '';
    if (_self) LOGO_BASE = new URL('assets/airline-logos/', _self).href;
  } catch (e) {}

  function rest(path) {
    return fetch(SB_URL + '/rest/v1/' + path, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
    }).then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
  }

  /* ══════════════════════════════════════════════════════════════
     日英の文言。<html lang> で切り替える。
     ⚠️ 英語は日本語の直訳にしない。英語として自然な言い方を先に決めて置く。
     ⚠️ 金額の書式（¥N,NNN万）は日英とも同じ。currency.js がこの文字列を拾って
        英語面では USD に変える。ここを英語用に別書式にすると assert-currency.mjs が落ちる。
     ══════════════════════════════════════════════════════════════ */
  var L = (window.PV_BASE === 'en' || (d.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('en') === 0) ? 'en' : 'ja';   // スペイン語のページは英語と同じ動き（pv-session.js）
  var T = {
    ja: {
      sep: ' ・ ',
      rating:    '評価 ',
      autoTr:    '自動翻訳',
      emptyT:    'まだ投稿が少ないです',
      emptyD:    'ここには現役・元パイロット本人の投稿だけを載せます。件数を水増ししたり、他サイトの口コミを転載したりはしません。',
      mqMeta: function (years, base) { return '経験 ' + years + ' ・ ' + base; },
      /* ★ヒーローの電話（REAL PAY の一覧のカード）と REAL PAY の節の白いカード（行を押すと出る面）の語。
         ★2026-11-01、本物の画面と同じ形にしたとき、語も actual-pay.js の辞書から写し直した
         （同じものを2つの言い方で呼ばない）── seg は S.seg、thAmt・dwYear・dwMonth・dwComp・cbMore・dash は T、
         pos は pv-vocab.json の positions、ten は T.ten.r。
         openNote だけは写しではない：本物の T.dwShare は「構成比は匿名化された金額帯から算出した概算です」。
         見本の帯は誰かの投稿を匿名化したものではないので、その部分を言わない短い文にしてある。
         ★actual-pay.js 側の文言は書き換えない。 */
      seg: { base: '基本給', variable: '変動給', bonus: '賞与・利益分配' },
      pos: { '機長': '機長（CAP）', '副操縦士': '副操縦士（FO）' },
      thAmt: '年収',
      dwYear: '年収', dwMonth: '月あたり', dwComp: '報酬の内訳',
      cbMore: 'ほか{n}区分',
      dash: '〜',
      openNote: '構成比は概算です',
      ten: function (y) { return '昇格後' + y; },
      voice: { culture: '企業文化', salary: '給与', benefits: '福利厚生',
               wlb: 'WLB', ops: '運航環境', training: '訓練環境', mgmt: '経営陣への提案' },
    },
    en: {
      sep: ' · ',
      rating:    'Rating ',
      autoTr:    'Machine-translated',
      emptyT:    'Not many posts yet.',
      emptyD:    'Only working and former pilots post here. We never pad the count, and we never repost reviews from other sites.',
      mqMeta: function (years, base) { return years + ' · ' + base; },
      // 日本語側と対（actual-pay.js の英語から写す。openNote だけ短く言い直したもの）
      seg: { base: 'Base pay', variable: 'Variable (flying)', bonus: 'Bonus & profit share' },
      pos: { '機長': 'Captain (CAP)', '副操縦士': 'First Officer (FO)' },
      thAmt: 'Annual',
      dwYear: 'Per year', dwMonth: 'Per month', dwComp: 'Compensation',
      cbMore: '+{n} more',
      dash: '–',
      openNote: 'Shares are approximate',
      ten: function (y) { return y + ' in rank'; },
      voice: { culture: 'Culture', salary: 'Pay', benefits: 'Benefits',
               wlb: 'WLB', ops: 'Operations', training: 'Training', mgmt: 'To management' },
    }, /*PV-MSG:es*/ es: {
      sep: ' · ',
      rating:    'Calificación ',
      autoTr:    'Traducido automáticamente',
      emptyT:    'Todavía hay pocas publicaciones.',
      emptyD:    'Aquí solo publican pilotos en activo y expilotos. Nunca inflamos la cantidad de publicaciones ni republicamos reseñas de otros sitios.',
      mqMeta: function (years, base) { return years + ' · ' + base; },
      // 日本語側と対（actual-pay.js の英語から写す。openNote だけ短く言い直したもの）
      seg: { base: 'Sueldo base', variable: 'Remuneración variable (vuelo)', bonus: 'Bonos y participación en las utilidades' },
      pos: { '機長': 'Capitán / Comandante (CAP)', '副操縦士': 'Primer oficial / Copiloto (FO)' },
      thAmt: 'Anual',
      dwYear: 'Por año', dwMonth: 'Por mes', dwComp: 'Remuneración',
      cbMore: '+{n} más',
      dash: '–',
      openNote: 'Las proporciones son aproximadas',
      ten: function (y) { return y + ' en el puesto actual'; },
      voice: { culture: 'Cultura', salary: 'Remuneración', benefits: 'Beneficios',
               wlb: 'Equilibrio vida-trabajo', ops: 'Operaciones', training: 'Entrenamiento', mgmt: 'Para la dirección' },
    } /*/PV-MSG:es*/,
  };
  T = (window.PV_T && window.PV_T(T, L)) || T[L];
  /* ★トップの電話がめぐる画面（⓬）の語（2026-11-12）。全部見本。本物の画面の語にそろえる。
     平らな鍵だけ（gen-msg.mjs が値を1つずつスペイン語に訳せるように。入れ子にしない） */
  var TT = {
    ja: {
      airSub: 'ドバイ DXB',
      airMed: '中央値',
      airScore: 'パイロットによる評価スコア',
      airTabs: '概要,給与・待遇,口コミ,勤務・訓練',
      airPayT: '給与',
      airTax: '非課税（UAE）',
      estCap: '機長の推定年収',
      estFo: '副操縦士の推定年収',
      rangeT: '年収の幅（25〜75%）',
      cap: '機長',
      fo: '副操縦士',
      axes: '企業文化,給与,福利厚生,WLB,運航,訓練',
      mySub: '給与,勤務,分析,設定',
      myMeta: 'エミレーツ · B777 · 機長 · ベース DXB',
      myT: '2026年6月の給与',
      myGross: '総支給',
      myYear: '今月ベースの年換算（賞与込み）',
      myHour: '乗務1時間あたり',
      cumT: '累計報酬',
      compT: '支給構成',
      othersT: '他社の機長の年収',
      seg_base: '基本給',
      seg_variable: '乗務変動手当',
      seg_command: '機長・役職手当',
      seg_perdiem: 'パーディアム',
      seg_housing: '住宅手当',
      schT: '11月の勤務',
      schBh: 'ブロックタイム',
      schFt: 'フライトタイム',
      schWd: '月,火,水,木,金,土,日',
      schMons: '6月,7月,8月,9月,10月,11月',
      bhT: '月のブロックタイム',
      dayU: '日',
      key_f: '乗務',
      key_s: 'スタンバイ',
      key_t: '訓練',
      key_o: '休み',
      stk_realpay: 'REAL PAY',
      stks_realpay: '他のパイロットの実際の給与',
      stk_airline: '航空会社ページ',
      stks_airline: '年収・口コミ・勤務',
      stk_mypay: 'MY PAY',
      stks_mypay: 'あなたの給与を分析',
      stk_schedule: 'スケジュール',
      stks_schedule: '月の勤務を一目で',
      open_realpay: 'REAL PAY を開く',
      open_airline: '航空会社のページを開く',
      open_mypay: 'MY PAY を開く',
      open_schedule: 'スケジュールを開く',
      rpFilter: '絞り込み',
      rpAir: '航空会社',
      rpPos: '職位・機材',
      rpYrs: '年数',
      rpAmt: '年収',
      rpComp: '報酬の内訳',
      railAdd: '匿名で給与を追加'
    },
    en: {
      airSub: 'Dubai DXB',
      airMed: 'Median',
      airScore: 'Pilot rating',
      airTabs: 'Overview,Pay & benefits,Reviews,Roster & training',
      airPayT: 'Pay',
      airTax: 'Tax-free (UAE)',
      estCap: 'Captain estimate',
      estFo: 'First Officer estimate',
      rangeT: 'Pay range (25–75%)',
      cap: 'Captain',
      fo: 'First Officer',
      axes: 'Culture,Pay,Benefits,WLB,Ops,Training',
      mySub: 'Pay,Roster,Analysis,Settings',
      myMeta: 'Emirates · B777 · Captain · Base DXB',
      myT: 'June 2026 pay',
      myGross: 'Gross pay',
      myYear: 'Annualized this month (incl. bonus)',
      myHour: 'Per block hour',
      cumT: 'Total earned',
      compT: 'Pay breakdown',
      othersT: 'Captain pay at other airlines',
      seg_base: 'Base pay',
      seg_variable: 'Flying pay',
      seg_command: 'Command pay',
      seg_perdiem: 'Per diem',
      seg_housing: 'Housing',
      schT: 'November roster',
      schBh: 'Block hours',
      schFt: 'Flight time',
      schWd: 'M,T,W,T,F,S,S',
      schMons: 'Jun,Jul,Aug,Sep,Oct,Nov',
      bhT: 'Monthly block hours',
      dayU: ' days',
      key_f: 'Flying',
      key_s: 'Standby',
      key_t: 'Training',
      key_o: 'Off',
      stk_realpay: 'REAL PAY',
      stks_realpay: 'Real pay from other pilots',
      stk_airline: 'Airline pages',
      stks_airline: 'Pay, reviews, rosters',
      stk_mypay: 'MY PAY',
      stks_mypay: 'Your pay, broken down',
      stk_schedule: 'Roster',
      stks_schedule: 'Your month at a glance',
      open_realpay: 'Open REAL PAY',
      open_airline: 'Open the airline page',
      open_mypay: 'Open MY PAY',
      open_schedule: 'Open the roster',
      rpFilter: 'Filter',
      rpAir: 'Airline',
      rpPos: 'Position · Aircraft',
      rpYrs: 'Years',
      rpAmt: 'Annual',
      rpComp: 'Pay breakdown',
      railAdd: 'Add pay anonymously'
    }, /*PV-MSG:es*/ es: {
      airSub: 'Dubái DXB',
      airMed: 'Mediana',
      airScore: 'Valoración de los pilotos',
      airTabs: 'Resumen,Remuneración y beneficios,Reseñas,Programación y entrenamiento',
      airPayT: 'Remuneración',
      airTax: 'Libre de impuestos (EAU)',
      estCap: 'Estimación para capitán',
      estFo: 'Estimación para primer oficial',
      rangeT: 'Rango de remuneración (25–75%)',
      cap: 'Capitán',
      fo: 'Primer oficial',
      axes: 'Cultura,Remuneración,Prestaciones,Conciliación,Operaciones,Entrenamiento',
      mySub: 'Remuneración,Programación,Análisis,Ajustes',
      myMeta: 'Emirates · B777 · Capitán · Base DXB',
      myT: 'Remuneración de junio de 2026',
      myGross: 'Sueldo bruto',
      myYear: 'Anualizado con este mes (incl. bono)',
      myHour: 'Por hora block',
      cumT: 'Total percibido',
      compT: 'Desglose de la remuneración',
      othersT: 'Remuneración de capitanes en otras aerolíneas',
      seg_base: 'Sueldo base',
      seg_variable: 'Pago por vuelo',
      seg_command: 'Prima de mando',
      seg_perdiem: 'Viáticos',
      seg_housing: 'Vivienda',
      schT: 'Programación de noviembre',
      schBh: 'Horas block',
      schFt: 'Tiempo de vuelo',
      schWd: 'M,T,W,T,F,S,S',
      schMons: 'Jun,Jul,Ago,Sep,Oct,Nov',
      bhT: 'Horas block por mes',
      dayU: ' días',
      key_f: 'Vuelo',
      key_s: 'Guardia',
      key_t: 'Entrenamiento',
      key_o: 'Libre',
      stk_realpay: 'REAL PAY',
      stks_realpay: 'Remuneración real de otros pilotos',
      stk_airline: 'Páginas de aerolíneas',
      stks_airline: 'Remuneración, reseñas, programación',
      stk_mypay: 'MI REMUNERACIÓN',
      stks_mypay: 'Tu remuneración, desglosada',
      stk_schedule: 'Programación (rol de vuelo)',
      stks_schedule: 'Tu mes de un vistazo',
      open_realpay: 'Abrir REAL PAY',
      open_airline: 'Abrir la página de la aerolínea',
      open_mypay: 'Abrir MY PAY',
      open_schedule: 'Abrir la programación',
      rpFilter: 'Filtrar',
      rpAir: 'Aerolínea',
      rpPos: 'Cargo · Aeronave',
      rpYrs: 'Años',
      rpAmt: 'Anual',
      rpComp: 'Desglose de la remuneración',
      railAdd: 'Add pay anonymously'
    } /*/PV-MSG:es*/
  };
  TT = (window.PV_T && window.PV_T(TT, L)) || TT[L];
   // スペイン語の辞書があればそれ

  /* 日本語で書いてある短い語を英語に置き換える1枚の辞書。
     ★PV_DEMO の配列を2本持たないための仕掛け（配列は日本語のまま1本）。
     載っていない語はそのまま返すので、行を足しても英語面が壊れず日本語のまま出る。 */
  var EN_WORD = {
    // 職位
    '機長': 'Captain', '副操縦士': 'First Officer', '訓練生': 'Trainee',
    // 何で構成された額か
    '年俸＋住宅手当（非課税）': 'Salary + housing, tax-free',
    '年俸＋住宅手当': 'Salary + housing',
    '年俸＋年金拠出': 'Salary + pension',
    '年俸（税引前）': 'Annual, before tax',
    '月給＋賞与＋乗務手当': 'Base + bonus + flight pay',
    '月給＋賞与': 'Base + bonus',
    '基本給＋乗務手当': 'Base + flight pay',
    // 経験年数
    '3〜5年': '3–5 yrs', '5〜10年': '5–10 yrs', '10〜15年': '10–15 yrs',
    '15〜20年': '15–20 yrs', '20年以上': '20+ yrs',
    // ベース
    'ドバイ': 'Dubai', 'ドーハ': 'Doha', '羽田': 'Tokyo Haneda', '伊丹': 'Osaka Itami',
    '関西': 'Osaka Kansai', 'アトランタ': 'Atlanta', 'サンフランシスコ': 'San Francisco',
    'シンガポール': 'Singapore', '香港': 'Hong Kong', 'フランクフルト': 'Frankfurt',
    'シドニー': 'Sydney', 'イスタンブール': 'Istanbul',
  };
  /*PV-MSG:es*/ var EN_WORD_ES = {
    // 職位
    '機長': 'Capitán', '副操縦士': 'Primer oficial', '訓練生': 'Piloto en formación',
    // 何で構成された額か
    '年俸＋住宅手当（非課税）': 'Sueldo + ayuda para vivienda, libre de impuestos',
    '年俸＋住宅手当': 'Sueldo + ayuda para vivienda',
    '年俸＋年金拠出': 'Sueldo + aportación al plan de pensiones',
    '年俸（税引前）': 'Anual, antes de impuestos',
    '月給＋賞与＋乗務手当': 'Sueldo base + bono + pago por hora de vuelo',
    '月給＋賞与': 'Sueldo base + bono',
    '基本給＋乗務手当': 'Sueldo base + pago por hora de vuelo',
    // 経験年数
    '3〜5年': '3–5 años', '5〜10年': '5–10 años', '10〜15年': '10–15 años',
    '15〜20年': '15–20 años', '20年以上': '20+ años',
    // ベース
    'ドバイ': 'Dubái', 'ドーハ': 'Doha', '羽田': 'Tokio Haneda', '伊丹': 'Osaka Itami',
    '関西': 'Osaka Kansai', 'アトランタ': 'Atlanta', 'サンフランシスコ': 'San Francisco',
    'シンガポール': 'Singapur', '香港': 'Hong Kong', 'フランクフルト': 'Frankfurt',
    'シドニー': 'Sídney', 'イスタンブール': 'Estambul',
  }; /*/PV-MSG:es*/
  function tw(s) {
    if (L !== 'en') return s;
    return (window.PV_LANG === 'es' && typeof EN_WORD_ES !== 'undefined' && EN_WORD_ES[s]) || EN_WORD[s] || s;   // スペイン語の対応表（gen-msg.mjs が書く）
  }

  /* 航空会社の表示名。英語面は airlines-meta.js の en を引く（英語の社名表を二重に持たない）。
     読み込み順で PV_AIRLINES が未定義のことがあるので、そのときは渡された名前をそのまま使う。 */
  var NAME_BY_SLUG = null;
  function airlineName(slug, fallback) {
    if (NAME_BY_SLUG === null) {
      NAME_BY_SLUG = {};
      if (w.PV_AIRLINES && typeof w.PV_slugOf === 'function') {
        w.PV_AIRLINES.forEach(function (a) { NAME_BY_SLUG[w.PV_slugOf(a)] = a; });
      }
    }
    var a = NAME_BY_SLUG[slug];
    if (!a) return fallback || slug;
    return (L === 'en' ? (a.en || a.name) : a.name) || fallback || slug;
  }

  /* 社の札そのもの（ブランド色・国旗）。表は airlineName と同じ1つを使い回す。 */
  function airlineMeta(slug) {
    if (NAME_BY_SLUG === null) airlineName(slug);
    return NAME_BY_SLUG[slug] || null;
  }

  /* 投稿フォームが保存するのは言語に依らない符号（captain / 10-15）。
     そのまま出すと日英どちらの画面でも符号が見えるので、ここで言葉に直す。 */
  var POS_LABEL = (function (D) { return (window.PV_T && window.PV_T(D, L)) || D[L]; })({
    ja: { captain: '機長', fo: '副操縦士', cadet: '訓練生' },
    en: { captain: 'Captain', fo: 'First Officer', cadet: 'Trainee' }, /*PV-MSG:es*/ es: { captain: 'Capitán', fo: 'Primer oficial', cadet: 'Piloto en formación' } /*/PV-MSG:es*/,
  });
  var TENURE_LABEL = (function (D) { return (window.PV_T && window.PV_T(D, L)) || D[L]; })({
    ja: { '1-5': '1〜5年', '5-10': '5〜10年', '10-15': '10〜15年', '15-20': '15〜20年', '20+': '20年以上' },
    en: { '1-5': '1–5 yrs', '5-10': '5–10 yrs', '10-15': '10–15 yrs', '15-20': '15–20 yrs', '20+': '20+ yrs' }, /*PV-MSG:es*/ es: { '1-5': '1–5 años', '5-10': '5–10 años', '10-15': '10–15 años', '15-20': '15–20 años', '20+': '20+ años' } /*/PV-MSG:es*/,
  });

  /* ══════════════════════════════════════════════════════════════
     ★PV_DEMO — 実在しないサンプル値。2026-08-11 のオーナー判断で、このまま公開する。

     流れるカード・ヒーローの見本の画面・REAL PAY の節のカードには、本人の実投稿ではなくサンプルを使う。
     Hero に実在する個人の投稿を流す必要はない（＝本人記録は流さない）。
     ★2026-09-22 まで、トップの「公開額と実際の額」の表（#actual-pay）のモザイクの下にもこの値を敷いていた。
       表ごとトップから外したので、pay_benchmarks で上書きする処理（fillActualPay）も消した。
     ⚠️ 差し替えるときのために、印は残してある。index.html 側にも同じ印がある。
        grep PV_DEMO で全部出る。

     金額は必ず SSOT（salary-data.mjs の SALARY）のレンジ内に置く。
     ⚠️ check-salary.mjs はこの値を見ていない（見るのは .html だけ。ここは JS が描く）。
        以前ここに「範囲外なら PASS 2 が落ちる」と書いてあったが誤り。値を変えたら
        SALARY のレンジと手で突き合わせる（範囲外でも何も赤くならない）。
     ★2026-09-22 からヒーローの右の見本の画面（fillHero）もここから描く。新しい数字は作らない。
     ★2026-09-16 オーナー指示で 100万円単位（末尾2桁は必ず 00）に丸めてある。
        細かい端数が並んでいると「自分のはこんなにきれいな数字じゃない」と手が止まるため。
        表示側の丸めは mqAmt()。ここの値も同じ粒度で書く（片方だけ細かくしない）。
     並びは固定。Math.random() を使わない（スクショ差分と目視比較のため）。
     ══════════════════════════════════════════════════════════════ */
  var PV_DEMO = {
    // [slug, 年収(万円), 内訳ラベル, 職位, 機種, 経験, ベース, 社名]
    marquee: [
      ['emirates',           4000, '年俸＋住宅手当（非課税）', '機長',   'B777', '10〜15年', 'ドバイ',        'エミレーツ航空'],
      ['ana',                2800, '月給＋賞与＋乗務手当',     '機長',   'B787', '15〜20年', '羽田',          '全日本空輸'],
      ['delta',              6500, '年俸（税引前）',           '機長',   'A350', '20年以上', 'アトランタ',    'デルタ航空'],
      ['jal',                1800, '月給＋賞与＋乗務手当',     '副操縦士', 'B737', '5〜10年',  '羽田',          '日本航空'],
      ['qatar-airways',      3100, '年俸＋住宅手当（非課税）', '機長',   'A350', '10〜15年', 'ドーハ',        'カタール航空'],
      ['singapore-airlines', 1900, '基本給＋乗務手当',         '副操縦士', 'B787', '5〜10年',  'シンガポール',  'シンガポール航空'],
      ['cathay-pacific',     3700, '年俸＋住宅手当',           '機長',   'A330', '15〜20年', '香港',          'キャセイパシフィック航空'],
      ['united',             3300, '年俸（税引前）',           '副操縦士', 'B737', '5〜10年',  'サンフランシスコ', 'ユナイテッド航空'],
      ['ana',                1600, '月給＋賞与',               '副操縦士', 'A320', '3〜5年',   '伊丹',          '全日本空輸'],
      ['lufthansa',          3200, '年俸＋年金拠出',           '機長',   'A320', '10〜15年', 'フランクフルト', 'ルフトハンザ'],
      ['peach',              2400, '月給＋賞与＋乗務手当',     '機長',   'A320', '10〜15年', '関西',          'Peach'],
      ['qantas',             4100, '年俸（税引前）',           '機長',   'B787', '15〜20年', 'シドニー',      'カンタス航空'],
      ['jal',                3200, '月給＋賞与＋乗務手当',     '機長',   'A350', '20年以上', '羽田',          '日本航空'],
      ['turkish-airlines',   1500, '基本給＋乗務手当',         '副操縦士', 'B737', '5〜10年',  'イスタンブール', 'ターキッシュ エアラインズ'],
    ],
    /* ヒーローの右の見本の画面（2026-09-22）。行は上の marquee の何番目を使うか。
       ★2026-11-01 オーナー指示「real pay とか…実際に即していない」で、本物の REAL PAY の
         スマホの一覧（actual-pay.css の @media (max-width:720px) のカード）と同じ形にした。
         1枚 ＝ ロゴ・社名／「年収」・額／職位 · 機材／内訳の棒と、いちばん大きい区分1つ＋「ほか◯区分」／ ›。
         ・行の中に「開いた面」を差し込むのはやめた（本物の一覧には無い。押すと別の面が開く）。
           内訳は各カードの棒で見える。開いた面の見本は REAL PAY の節の白いカード（下の detail）。
         ・本物のカードに無いもの（月あたり・年数）はカードに出さない（月あたりは本物も狭い幅で伏せる）。
         ・見本なので「✓ Verified」「本人申告」「投稿時期」は付けない（オーナー回答「1」＝
           本物の REAL PAY のプレビューの行と同じ扱い。信用の印を作り物に付けない）。
         カードは 76px × 5枚（あいだ 6px・上 6px）＝ 410px。前と同じ中身の高さ ＝ 電話も緑の面も 1px も動かない。
         ⚠️ 本数を変えたら index.html / en/index.html の灰色の骨組みと lp.css の .hero-card の高さも同じ回に直す。
       rp.on ＝ REAL PAY の節の白いカード（行を押すと出る面の見本）がどの行か。
       ⚠️ **marquee の何番目か**（rows の何番目か、ではない）。2026-09-23 まで rows 経由で引いていて、
          rows を短くした瞬間に undefined → 例外で boot() の残りが全部止まる形だった。
       detail ＝ その面の報酬の内訳。parts は [区分, 割合%]（整数・合計は必ず 100 ＝ 本物の shareInts と同じ）、
         band は区分ごとの**金額の帯**（万円）。本物は帯でしか出さないので見本も帯。
         割合は帯の中点から出してある（2,100 ＋ 1,000 ＋ 600 ＝ 3,700 ＝ rp.on の年収）。
       ★2026-11-01 オーナー指示「他社のパイロットはいくら稼いでる？の部分は ANA・JAL 以外の外航にして」──
         キャセイパシフィックの機長（marquee の7番目・¥3,700万 は SSOT の幅 ¥3,000万〜¥7,700万 の中）。
         ⚠️ 値は mqAmt() の有効数字2桁でそのまま出る粒度にしてある（1500→¥1,500万）。
       ★区分の色は lp.css の .lp-c-*（REAL PAY と同じ色）。 */
    hero: {
      /* 行 ＝ marquee の何番目か（i）＋ その行の報酬の内訳（見本）。
         区分が1つだけの行は棒も凡例も出さない（本物の cardCompHTML と同じ）。 */
      rows: [
        { i: 0, parts: [['base', 56], ['variable', 26], ['bonus', 18]] },
        { i: 1, parts: [['base', 62], ['variable', 22], ['bonus', 16]] },
        { i: 2, parts: [['base', 71], ['variable', 29]] },
        { i: 3, parts: [['base', 58], ['variable', 30], ['bonus', 12]] },
        { i: 4, parts: [['base', 60], ['variable', 24], ['bonus', 16]] },
      ],
      rp: { on: 6 },
      detail: {
        parts: [['base', 57], ['variable', 27], ['bonus', 16]],
        band: { base: [2000, 2200], variable: [900, 1100], bonus: [500, 700] },
      },
    },
  };

  /* ── 計測（GA4。既存の gtag をそのまま使う。新しい業者は入れない）──────── */
  var fired = {};
  function ev(name, params) {
    if (typeof w.gtag !== 'function') return;
    try { w.gtag('event', name, params || {}); } catch (e) {}
  }
  function evOnce(name, params) {
    if (fired[name]) return;
    fired[name] = 1;
    ev(name, params);
  }

  function wireEvents() {
    // クリック系：data-pv-ev="イベント名"
    d.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-pv-ev]') : null;
      if (el) ev(el.getAttribute('data-pv-ev'), { link_url: el.getAttribute('href') || '' });
    }, { passive: true });

    // 表示系：data-pv-view="イベント名"（IntersectionObserver は1個を共有する）
    var targets = d.querySelectorAll('[data-pv-view]');
    if (!targets.length) return;
    if (!('IntersectionObserver' in w)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        evOnce(en.target.getAttribute('data-pv-view'));
        io.unobserve(en.target);
      });
    }, { threshold: 0.25 });
    targets.forEach(function (t) { io.observe(t); });
    // Hero の検索欄は廃止した（ヘッダーの検索アイコン search.js #pv-search-btn が担う）。
    // airline_search イベントもそちらに一本化する。
  }

  /* ── ❽ Pilot Voices：reviews_v2 の実データ。本文が空の行は出さない。 ─────
     ふだんの見出しは review-i18n.js が日英で持っている。ここの表は
     review-i18n.js が読めなかったときの控え（同じ語を2か所に書かないため T から引く）。 */
  var VOICE_LABEL = T.voice;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function clip(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  /* 星の平均。式は airlines/airline-reviews-ui.js:631 の mapV2() と同じにする（0と空を除いた平均）。
     ⚠️ mapV2 は空のとき 3 を既定値にするが、ここでは null を返す。
        トップページで「投稿が無いのに★★★」を出さないため。 */
  var V2_CAT_KEYS = ['culture_score', 'salary_score', 'benefits_score',
                     'wlb_score', 'ops_score', 'training_score'];

  function avgScore(r) {
    var s = V2_CAT_KEYS.map(function (k) { return r[k]; })
                       .filter(function (v) { return v > 0; });
    if (!s.length) return null;
    return +(s.reduce(function (a, b) { return a + b; }, 0) / s.length).toFixed(1);
  }

  // 星の文字列も既存と同形（en/airlines/en-airline-reviews.js:72）
  function stars(avg) {
    var n = Math.round(avg);
    if (n < 0) n = 0; if (n > 5) n = 5;
    // 星の並びは読み上げに要らない（「星星星星白星」と読まれる）。数字だけを読ませる。
    return '<span class="pv-voice-stars">' +
             '<i aria-hidden="true">' + '★'.repeat(n) + '☆'.repeat(5 - n) + '</i>' +
             '<b><span class="pv-sr">' + esc(T.rating) + '</span>' + avg.toFixed(1) + '<span class="pv-sr"> / 5</span></b>' +
           '</span>';
  }

  function voiceCard(cat, text, meta, translated, avg) {
    return '<article class="pv-card pv-voice">' +
      '<div class="pv-voice-head">' +
        '<span class="pv-voice-cat">' + esc(cat) + '</span>' +
        // 6項目とも空の投稿には星を出さない（既定値で埋めない）
        (avg == null ? '' : stars(avg)) +
      '</div>' +
      '<p class="pv-voice-body">' + esc(text) + '</p>' +
      '<div class="pv-voice-meta">' + esc(meta) +
        (translated ? T.sep + '<span style="color:var(--pv-accent-ink)">' + esc(T.autoTr) + '</span>' : '') +
      '</div>' +
    '</article>';
  }

  function emptyVoices(grid) {
    grid.className = 'pv-card';
    grid.innerHTML =
      '<h3 class="pv-h3" style="font-size:.95rem">' + esc(T.emptyT) + '</h3>' +
      '<p class="pv-step-d" style="margin-top:8px">' + esc(T.emptyD) + '</p>';
  }

  /* ★ reviews_v2 を直に読まない。本文の列は DB 側で anon から外してあり
     （db/reviews-gate.sql）、トップの抜粋だけは pv_review_voices() が
     **新しい6件・1欄あたり80字まで**に切って返す。
     ここはオーナーが「今のまま開けておく」と決めた唯一の穴。
     ⚠️ 件数も字数も画面側で広げない（決めているのはサーバの数字1つ）。
        今までは30件ぶんの**全文**が誰にでも返っていたので、穴は今より小さい。
     ★2026-09-23：ヒーローの流れる帯（fillReviewMq）と下の節（fillVoices）で**同じ1回**を
       分け合う。ここで Promise を持っておく＝通信は今までと同じ1本のまま。 */
  var VOICES_P = null;
  function voices() {
    if (!VOICES_P) VOICES_P = rest('rpc/pv_review_voices').then(function (rows) { return rows || []; });
    return VOICES_P;
  }

  /* 1件を画面に出す形（区分・抜粋・社名/職位/在籍/投稿年月・星）に直す。出せない行は null。
     ⚠️ 足切り（本文のある欄の最初の1つが、空白を除いて20字以上）は
        db/reviews-gate.sql の pv_review_voices と同じ条件。片方だけ緩めない。 */
  function voiceRow(r) {
    var body = (w.PVReviewI18n && w.PVReviewI18n.pick) ? w.PVReviewI18n.pick(r) : null;
    var cat, text, translated = false;
    if (body && body.cats && body.cats.length) {
      cat = body.cats[0].label;
      text = body.cats[0].text;
      translated = !!body.translated;
    } else {
      // review-i18n.js が無い場合のフォールバック（原文のいちばん長い欄）
      var picked = null;
      Object.keys(VOICE_LABEL).forEach(function (k) {
        var v = r[k + '_comment'];
        if (v && (!picked || v.length > picked.text.length)) picked = { label: VOICE_LABEL[k], text: v };
      });
      if (!picked) return null;
      cat = picked.label; text = picked.text;
    }
    if (!text || text.replace(/\s/g, '').length < 20) return null;   // 空カードを出さない
    // DB が持っているのは符号（ana / captain / 10-15）。そのまま出すと符号が画面に見えるので言葉に直す。
    var meta = [r.airline ? airlineName(r.airline, r.airline) : '',
                POS_LABEL[r.position] || r.position || '',
                TENURE_LABEL[r.tenure_bucket] || r.tenure_bucket || '',
                r.created_at ? r.created_at.slice(0, 7).replace('-', '.') : '']
               .filter(Boolean).join(T.sep);
    return { cat: cat, text: clip(text, 80), meta: meta, translated: translated, avg: avgScore(r) };   // §10：3〜4行で切る
  }

  function fillVoices() {
    var grid = d.getElementById('voices-grid');
    if (!grid) return;

    voices().then(function (rows) {
      var cards = [];
      rows.forEach(function (r) {
        if (cards.length >= 4) return;   // §10：デスクトップ1行に収める（6件・2行だと縦に伸びる）
        var v = voiceRow(r);
        if (v) cards.push(voiceCard(v.cat, v.text, v.meta, v.translated, v.avg));
      });

      if (!cards.length) { emptyVoices(grid); return; }
      // 4列グリッドの見た目が崩れないよう、件数が少ないときは列数を落とす
      grid.className = 'pv-grid ' + (cards.length <= 2 ? 'pv-grid-2' : cards.length === 3 ? 'pv-grid-3' : 'pv-grid-4');
      grid.innerHTML = cards.join('');
      evOnce('pilot_voices_filled', { count: cards.length });
    });
  }

  /* ── ❾-2 ヒーローの口コミの帯（★2026-09-23 オーナー指示「口コミも同じようなカードで
     下に逆回りで流れるようにして」）─────────────────────────────────
     ★中身は本物の投稿。年収の帯（PV_DEMO のサンプル）とは出どころが違う。
     ★古い順に流す＝最初に目に入るカードが、下の #pilot-voices の4枚と別になる。
     ★逆回りは CSS（animation-direction:reverse）。ここではタイマーを持たない。 */
  /* ★2026-09-23 追加指示「カードの口コミには星出して」── 下の #pilot-voices と**同じ star()**
     を呼ぶ（星の形も「4.5 / 5」の読み上げも1か所。ここで書き写さない）。
     ⚠️ 6項目とも空の投稿は avg が null。そのときは星を出さない（既定値の3で埋めない）。
     ⚠️ stars() は <span>/<i>/<b> だけを返す＝<a> の中に入れてよい（<article> や <p> は入れない）。 */
  function rvCard(v, dup) {
    // 2周目は読み上げとタブ移動から外す（同じカードが2回読まれるのを防ぐ）
    var dupAttr = dup ? ' aria-hidden="true" tabindex="-1"' : '';
    /* 飛び先は口コミの一覧（community.html）で固定する。DB の社名の綴りが airlines/ に
       無いことがあり、会社ページへ送ると 404 になる（年収の帯は SSOT の slug なので送れる）。 */
    return '<a class="hero-mq-c hero-rv-c" href="community.html"' + dupAttr + ' data-pv-ev="hero_rv_card">' +
      '<span class="hero-rv-head">' +
        '<span class="pv-voice-cat">' + esc(v.cat) + '</span>' +
        (v.avg == null ? '' : stars(v.avg)) +
      '</span>' +
      '<span class="hero-rv-body">' + esc(v.text) + '</span>' +
      '<span class="hero-rv-meta">' + esc(v.meta) + (v.translated ? T.sep + esc(T.autoTr) : '') + '</span>' +
    '</a>';
  }

  function fillReviewMq() {
    var mq = d.getElementById('hero-rv'), track = d.getElementById('hero-rv-track');
    if (!mq || !track) return;
    voices().then(function (rows) {
      var vs = [];
      rows.forEach(function (r) { var v = voiceRow(r); if (v) vs.push(v); });
      vs.reverse();   // 古い順

      // 投稿がまだ無いとき。空のまま畳むと下が跳ねるので、1枚だけ置いて止める。
      if (!vs.length) {
        track.style.animation = 'none';
        track.innerHTML = '<div class="hero-mq-c hero-rv-c hero-rv-c--empty">' +
          '<span class="hero-rv-t">' + esc(T.emptyT) + '</span>' +
          '<span class="hero-rv-body">' + esc(T.emptyD) + '</span></div>';
        return;
      }

      var one = function (dup) { return vs.map(function (v) { return rvCard(v, dup); }).join(''); };
      /* 1周ぶんが帯の幅に足りないと、流れている途中に何も無い所ができる。足りるまで並びを繰り返す。
         （年収の帯はカードが14枚あって必ず足りるので、この処理を持っていない） */
      track.innerHTML = one(false);
      var pass = track.scrollWidth, reps = 1;
      while (pass > 0 && pass * reps < mq.clientWidth && reps < 8) reps++;
      var html = '', i;
      for (i = 0; i < reps; i++) html += one(false);
      for (i = 0; i < reps; i++) html += one(true);   // 2周目（-50% まで動かすと継ぎ目なく戻る）
      track.innerHTML = html;
      /* 流れる速さは年収の帯と同じ。★2026-09-23 オーナー指示「流れるの早すぎ。いまの速さの
         0.5 倍でいい」で 40px/s → **20px/s**（あちらは14枚 × 210px ÷ 148s ≒ 20px/s）。
         ⚠️ lp.css の .hero-mq-track の秒数を変えたら、この数字も同じ割合で直す。 */
      if (pass > 0) track.style.animationDuration = Math.round(pass * reps / 20) + 's';
      evOnce('hero_reviews_filled', { count: vs.length });
    });
  }

  /* ── ❾ Hero の流れる給与カード（Marit Health 型）─────────────────────
     ★PV_DEMO の中身を横一列に並べ、CSS の @keyframes hero-mq で左へ流す。
     JS はタイマーを持たない（transform を CSS に任せる。タブが裏に回れば止まる）。 */
  /* 帯の金額は「だいたいこのくらい」を出す所なので、どの通貨でも有効数字2桁まで丸める
     （¥4,000万 / $250K / €220K）。細かい端数が出ていると、見た人が自分の額と見比べて
     手を止める ── というのがオーナーの指摘（2026-09-16）。丸めるのは表示だけで、
     data-jpy には元の円をそのまま持たせてある＝通貨を替えても戻ってこられる。
     ⚠️ span に pv-no-cur を付けて currency.js の走査から外してある。外さないと
        あちらが ¥4,000万 を拾い直して $252K と細かく書き戻す。代わりに repaintMarquee()
        が pv-currency-change を受けて書き直す（salary-leveling.js と同じ作り）。 */
  function mqAmt(jpy) {
    if (w.PVCurrency && typeof w.PVCurrency.fmt === 'function') return w.PVCurrency.fmt(jpy, 2);
    return '¥' + Math.round(jpy / 10000).toLocaleString('en-US') + '万';   // currency.js が落ちたとき
  }

  function repaintMarquee() {
    // 流れるカード・ヒーローの見本の画面・REAL PAY の節のカードの金額（どれも pv-no-cur ＋ data-jpy）。
    var els = d.querySelectorAll('#hero-mq-track .hero-mq-amt, #hero-section .pv-no-cur[data-jpy]:not(.lt-sal):not(.lt-exact), #lp-realpay .pv-no-cur[data-jpy]');
    /* ヒーローの電話の会社・MY PAY の画面の額（本物の推定年収・MY PAY の見本）は丸めない書き方（salAmt）で塗り直す */
    var sal = d.querySelectorAll('#hero-section .lt-sal[data-jpy]');
    for (var j = 0; j < sal.length; j++) sal[j].textContent = salAmt(parseInt(sal[j].getAttribute('data-jpy'), 10));
    var ex = d.querySelectorAll('#hero-section .lt-exact[data-jpy]');
    for (var x = 0; x < ex.length; x++) ex[x].textContent = exactAmt(parseInt(ex[x].getAttribute('data-jpy'), 10));
    for (var i = 0; i < els.length; i++) {
      els[i].textContent = mqAmt(parseInt(els[i].getAttribute('data-jpy'), 10));
    }
    /* ★112 の電話（比較のスライド）の額はここで塗らない。HTML に「¥2,556万」で書いてあり（日本語）・
         英語はドルの span で焼いてある ＝ 走査も塗り直しも currency.js がやる（会社ページ・比較の画面と同じ）。 */
    // ランキングの金額（公開データ。こちらも丸めない）。
    var ks = d.querySelectorAll('#ranking .pv-no-cur[data-jpy]');
    for (var k = 0; k < ks.length; k++) {
      ks[k].textContent = salAmt(parseInt(ks[k].getAttribute('data-jpy'), 10));
    }
  }

  /* 公開年収の1つの値。見本ではないので丸めない（mqAmt の有効数字2桁を使わない）。
     日本語で円のときは「¥2,200万」。それ以外は今の通貨で（英語ページは円でも「万」を使わない）。 */
  function salAmt(jpy) {
    var C = w.PVCurrency;
    if (C && typeof C.fmt === 'function' && (L === 'en' || (typeof C.get === 'function' && C.get() !== 'JPY'))) return C.fmt(jpy);
    return '¥' + Math.round(jpy / 10000).toLocaleString('en-US') + '万';
  }

  function mqCard(row, dup) {
    var slug = row[0], man = row[1], brk = row[2], pos = row[3],
        fleet = row[4], years = row[5], base = row[6], name = row[7];
    var jpy = man * 10000;
    // 2周目は読み上げとタブ移動から外す（同じカードが2回読まれるのを防ぐ）
    var dupAttr = dup ? ' aria-hidden="true" tabindex="-1"' : '';
    /* ★2026-09-22 オーナー指示 ── カードを押したら、その会社のページへ飛ばす。
       2026-09-16〜09-22 のあいだは全カードを REAL PAY（actual-pay.html）へ送っていたが戻した。
       飛び先は日英で同じ相対パス（/ → airlines/、/en/ → en/airlines/ に解決される）。 */
    return '<a class="hero-mq-c" href="airlines/' + esc(slug) + '.html"' + dupAttr +
             ' data-pv-ev="hero_mq_card">' +
      '<span class="hero-mq-amt pv-no-cur" data-jpy="' + jpy + '">' + mqAmt(jpy) + '</span>' +
      '<span class="hero-mq-brk">' + esc(tw(brk)) + '</span>' +
      '<span class="hero-mq-role">' + esc(tw(pos)) + T.sep + esc(fleet) + '</span>' +
      // 日本語は配列が持っている呼び名をそのまま（帯が狭いので「全日本空輸（ANA）」まで要らない）。
      // 英語だけ airlines-meta.js の en を引く＝英語の社名表をここに二重に持たない。
      '<span class="hero-mq-air">' + esc(L === 'en' ? airlineName(slug, name) : name) + '</span>' +
      '<span class="hero-mq-meta">' + esc(T.mqMeta(tw(years), tw(base))) + '</span>' +
    '</a>';
  }

  function fillMarquee() {
    var track = d.getElementById('hero-mq-track');
    if (!track) return;
    var rows = PV_DEMO.marquee;
    // 同じ配列を2周ぶん入れて -50% まで動かす＝継ぎ目なしでループする。
    var html = rows.map(function (r) { return mqCard(r, false); }).join('') +
               rows.map(function (r) { return mqCard(r, true); }).join('');
    track.innerHTML = html;
  }

  /* ── ❿ ヒーローの右：REAL PAY の見本の画面（2026-09-22）──────────────────
     ★全部 PV_DEMO（サンプル）。本物の投稿は1件も読まない・出さない。
       小さい会社で「会社名＋時期」が出ると、書いた本人が推測されるため（オーナー）。
     ★投稿時期・Verified・本人申告の札・錠前は付けない（見本に「確認済み」は嘘になる）。
       ⚠️ ここは 2026-09-23 に中身を厚くしたときも足していない。本物のカードには出るが、
          **信用の印を偽造しない**（index.html の同じ約束）。
     ★HTML には灰色の棒の行が4本あり、同じ高さ（66px）の行に描き替える＝ガタつかない。
     ★1行＝4段（ロゴ／社名・年収／職位・機種・年数／内訳の棒／凡例と月あたり）。
       置き場所は lp.css がクラスで決める（grid-area）。ここで並べ替えても見た目は変わらない。
     ★人数は出さない（2026-09-24 オーナー指示で「多くのパイロットが」に変わった）。
       pv_pay_rows() は呼ばない＝このトップは本物の投稿を1件も読まない。 */
  function heroLogo(slug, name) {   // 112 の電話も同じ見た目のロゴを使う（lp.css が両方の節に当てる）
    var ext = (w.PV_LOGOS || {})[slug];
    if (ext) {
      // alt="" ＝ 社名がすぐ隣に文字で出るので、読み上げが二重にならないように。
      return '<img class="hero-win-logo" src="' + esc(LOGO_BASE + slug + '.' + ext) + '"' +
             ' alt="" width="30" height="30" decoding="async"/>';
    }
    var ini = String(name || '').replace(/[^0-9A-Za-z\u3040-\u30ff\u4e00-\u9fff]/g, '').slice(0, 2).toUpperCase() || '·';
    return '<span class="hero-win-logo hero-win-mono" aria-hidden="true">' + esc(ini) + '</span>';
  }

  /* 色の棒。区分ごとの割合を flex の伸び率で置く（style に % を書かない＝本物と同じ作法）。 */
  function heroBar(cls, parts) {
    return '<span class="' + cls + '" aria-hidden="true">' + parts.map(function (p) {
      return '<i class="lp-c-' + p[0] + '" style="flex:' + p[1] + ' 1 0"></i>';
    }).join('') + '</span>';
  }

  /* 見本の機材の呼び名を、本物の画面の呼び名にする（actual-pay.js の fleetName ＝ pv-vocab.json の fleets の
     カッコより前）。PV_DEMO は短い記号（B777）で持っているので、ここで1回だけ引き直す。載っていない記号はそのまま。 */
  var FLEET = {
    B777: 'Boeing 777', B787: 'Boeing 787 Dreamliner', B737: 'Boeing 737',
    A350: 'Airbus A350', A330: 'Airbus A330', A380: 'Airbus A380',
    A320: L === 'en' ? 'A320 family' : 'A320ファミリー',
  };
  function fleetReal(c) { return FLEET[c] || c; }
  // 職位も本物の呼び名（「機長（CAP）」）。辞書に無い語は今までどおり tw() に任せる。
  function posReal(p) { return T.pos[p] || tw(p); }
  // 本物の画面の区切り（actual-pay.js は日英とも「 · 」）。トップのほかの所（' ・ '）とは別に持つ。
  var DOT = ' · ';

  /* ★カードの下の段（内訳のミニ棒＋凡例）。本物の REAL PAY のカード（actual-pay.js の cardCompHTML）と同じ約束 ──
       ・いちばん大きい区分を**1つだけ**名指しし、残りは「ほか◯区分」と数える
       ・区分が2つ未満のときは棒も凡例も出さない
     ★2026-11-01、月あたりは外した（本物のカードは狭い幅で伏せている。年収 ÷ 12 で新しい情報が無いため）。 */
  function heroComp(parts) {
    if (!parts || parts.length < 2) return '';
    var top = 0;
    for (var k = 1; k < parts.length; k++) { if (parts[k][1] > parts[top][1]) top = k; }
    var rest = parts.length - 1;
    return '<span class="hero-c-vf">' + heroBar('hero-c-cb', parts) +
      '<span class="hero-c-cbl">' +
        '<span class="hero-c-cbi"><i class="lp-c-' + parts[top][0] + '" aria-hidden="true"></i>' +
          esc(T.seg[parts[top][0]]) + ' <b>' + parts[top][1] + '%</b></span>' +
        '<span class="hero-c-cbm">' + esc(T.cbMore.replace('{n}', function () { return String(rest); })) + '</span>' +
      '</span></span>';
  }

  /* ★ヒーローの電話の1枚（2026-11-01・本物の REAL PAY のスマホのカードの形）。
       上の段 ＝ ロゴ・社名 ｜「年収」・額 ｜ ›（2段ぶん）／ 2段目 ＝ 職位 · 機材 ／ 3段目 ＝ 内訳の棒と凡例。
     ★出典の札・投稿時期は出さない（見本。本物のプレビューの行と同じ）。
     ⚠️ 高さは lp.css の .hero-card が 76px で固定している（灰色の骨組みと同じ ＝ 描き替えても跳ねない）。 */
  function heroRow(row) {
    var r = PV_DEMO.marquee[row.i];
    var slug = r[0], jpy = r[1] * 10000;
    var name = airlineName(slug, r[7]);
    return '<div class="hero-card">' +
      '<span class="hero-c-air">' + heroLogo(slug, name) + '<span class="hero-c-an">' + esc(name) + '</span></span>' +
      '<span class="hero-c-amt"><span class="hero-c-cl">' + esc(T.thAmt) + '</span>' +
        '<span class="hero-c-v pv-no-cur" data-jpy="' + jpy + '">' + esc(mqAmt(jpy)) + '</span></span>' +
      '<span class="hero-c-go" aria-hidden="true">›</span>' +
      '<span class="hero-c-pos">' + esc(posReal(r[3])) + '<span class="hero-c-flt">' + esc(fleetReal(r[4])) + '</span></span>' +
      heroComp(row.parts) +
    '</div>';
  }

  function fillHero() {
    var box = d.getElementById('hero-win-rows');
    if (box) box.innerHTML = PV_DEMO.hero.rows.map(heroRow).join('');

    /* ★人数は出さない（2026-09-24 オーナー指示）。ここで pv_pay_rows() を呼んで
       stats.contributors を入れ、is-wait を外していた。文は HTML に書いてあるだけになった。 */
  }

  /* ── ⓬ ヒーローの PC の画面：4つの画面がめぐる（2026-11-12）──────────────────────────────
     オーナー「REAL PAY と各航空会社ページと MY PAY とスケジュールも見せられるように」→「リアルな画面感を」
     →「ケータイ画面にしないで、緑の部分も含めて PC 画面に」「俺があげたサンプルビデオみたいに」「無駄な拡大エフェクトはいらない」。
     ★緑の面の箱（index.html の #lt-pcbox）がそのまま PC のブラウザの窓。中は本物のサイトの PC 版の小さな写し。
       設計の大きさ（広い幅 960・狭い幅 720）で組み、箱の幅に合わせて scale で縮める（高さは箱に合わせて設計の高さを決める）。
     ★動き（参考動画と同じ控えめ）：約4秒ごとに、矢印のカーソルが左のメニューの次の項目へ動いて押す → 緑の板が滑る →
       本文がぼけて消え、次のカードが順に浮かび、棒が伸び・円が描かれ・数字が数える。スケジュールは MY PAY の「勤務」を押して開く。
       指を乗せている間・キーボードで中にいる間・画面の外・タブを裏にしている間は止まる。
       「動きを減らす」設定と自動の検査（navigator.webdriver）では自分では進まない（メニューを押せば替わる）。
     ★数字は本物の画面と同じ書き方：MY PAY は円の一の位まで・REAL PAY は有効数字2桁（本物も匿名のため丸める）・会社の推定年収は本物（salary-data.json）。
       ほかは全部見本（PV_DEMO と TOUR_DEMO）。金額は HTML に書かない（ここで描く）。Verified・投稿時期は付けない。
     ★画面を押すと、その画面の本物のページへ（GA4 は hero_realpay_ui / hero_airline_ui / hero_mypay_ui / hero_schedule_ui）。 */
  var TOUR = [
    { k: 'realpay', tab: 'realpay', href: 'actual-pay.html', url: 'actual-pay', ev: 'hero_realpay_ui' },
    { k: 'airline', tab: 'airline', href: 'airlines/emirates.html', url: 'airlines/emirates', ev: 'hero_airline_ui' },
    { k: 'mypay', tab: 'mypay', href: 'profile.html#your-pay', url: 'profile#your-pay', ev: 'hero_mypay_ui' },
    { k: 'schedule', tab: 'mypay', href: 'profile.html#your-pay', url: 'profile#roster', ev: 'hero_schedule_ui' }
  ];
  /* 見本の数（でたらめ・本物の投稿ではない）。会社の画面はエミレーツ ── 推定年収は本物・「提出された年収」は流れるカードの見本（marquee の0番）と同じ */
  var TOUR_DEMO = {
    air: 'emirates', airI: 0, code: 'EK', score: [3.6, 4.2, 3.9, 3.2, 3.8, 4.1], scoreAvg: '3.8',
    gross: 2692800, year: 37617600, hour: 29150,
    cum: [2.31, 2.48, 2.39, 2.62, 2.55, 2.69],
    seg: [['base', 30], ['variable', 17], ['housing', 18], ['command', 5], ['perdiem', 30]],
    others: ['delta', 'emirates', 'cathay-pacific', 'ana'],
    /* 2026年11月（1日は日曜）。f 乗務・s スタンバイ・t 訓練・o 休み */
    days: 'oofffoosfffoottfffoosfffooffos', bh: 74, ft: 68, bhs: [61, 70, 66, 78, 72, 74]
  };
  function lvBar(pct, cls) { return '<span class="lt-trk' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><i class="lt-fill" style="--w:' + pct.toFixed(1) + '"></i></span>'; }
  function amt(jpy, cls) { return '<span class="' + (cls || '') + ' pv-no-cur" data-jpy="' + jpy + '">' + esc(mqAmt(jpy)) + '</span>'; }
  /* MY PAY の額は本物の画面と同じく丸めない（日本語・円は ¥2,692,800）。ほかの通貨は今の通貨で */
  function exactAmt(jpy) {
    var C = w.PVCurrency;
    if (C && typeof C.fmt === 'function' && (L === 'en' || (typeof C.get === 'function' && C.get() !== 'JPY'))) return C.fmt(jpy);
    return '¥' + Math.round(jpy).toLocaleString('en-US');
  }
  function exactSpan(jpy, cls) { return '<span class="lt-exact ' + (cls || '') + ' pv-no-cur" data-jpy="' + jpy + '">' + esc(exactAmt(jpy)) + '</span>'; }
  function salAmtSpan(jpy, cls) { return '<span class="lt-sal ' + (cls || '') + ' pv-no-cur" data-jpy="' + jpy + '">' + esc(salAmt(jpy)) + '</span>'; }
  /* 本物の MY PAGE の上の帯（MY PAGE｜MY PAY と 給与・勤務・分析・設定） */
  function tourMyHead(on) {
    var sub = TT.mySub.split(',');
    return '<div class="lt-span lt-r"><div class="lt-myhd"><span class="lt-mp">MY PAGE</span><span class="lt-mp is-on">MY PAY</span></div>' +
      '<div class="lt-sub">' + sub.map(function (s, i) { return '<span' + (i === on ? ' class="is-on"' : '') + (i === 1 ? ' data-sub="roster"' : '') + '>' + esc(s) + '</span>'; }).join('') + '</div>' +
      '<p class="lt-meta">' + esc(TT.myMeta) + '</p></div>';
  }
  /* REAL PAY（本物の PC 版の一覧：社名・職位と機材・年数・年収・報酬の内訳） */
  function tourRealPay() {
    var rows = PV_DEMO.hero.rows.map(function (row, n) {
      var r = PV_DEMO.marquee[row.i], slug = r[0], jpy = r[1] * 10000, name = airlineName(slug, r[7]);
      return '<div class="lt-tr lt-r" style="--i:' + n + '">' +
        '<span class="lt-td lt-td-air">' + heroLogo(slug, name) + '<b>' + esc(name) + '</b></span>' +
        '<span class="lt-td lt-td-pos">' + esc(posReal(r[3])) + '<small>' + esc(fleetReal(r[4])) + '</small></span>' +
        '<span class="lt-td lt-td-yr">' + esc(T.ten(tw(r[5]))) + '</span>' +
        '<span class="lt-td lt-td-amt"><span class="lt-n">' + amt(jpy, 'lt-rp-v') + '</span></span>' +
        '<span class="lt-td lt-td-cb">' + heroBar('hero-c-cb', row.parts) + '</span>' +
      '</div>';
    }).join('');
    return '<div class="lt-in">' +
      '<div class="lt-span lt-r lt-rp-hd"><b class="lt-rp-t">REAL PAY</b><span class="lt-rp-t2">VERIFIED PAY</span>' +
        '<span class="lt-chipf">' + esc(TT.rpFilter) + '</span></div>' +
      '<div class="lt-span lt-tbl"><div class="lt-th lt-r"><span>' + esc(TT.rpAir) + '</span><span>' + esc(TT.rpPos) + '</span><span>' + esc(TT.rpYrs) + '</span>' +
        '<span>' + esc(TT.rpAmt) + '</span><span>' + esc(TT.rpComp) + '</span></div>' + rows + '</div>' +
    '</div>';
  }
  function tourAirline(SAL) {
    var D = TOUR_DEMO, on = PV_DEMO.marquee[D.airI] || PV_DEMO.marquee[0];
    var slug = D.air, name = airlineName(slug, on[7]);
    var a = SAL && SAL.airlines && SAL.airlines[slug];
    var tabs = TT.airTabs.split(',');
    /* 会社の推定年収（本物の数・salary-data.json）。読めなければこの箱ごと出さない（推測で埋めない） */
    var est = '';
    if (a && a.cap && a.fo) {
      var maxv = 8000;
      est = '<div class="lt-card lt-r"><p class="lt-hd"><i class="lt-ico">¥</i>' + esc(TT.airPayT) + '<em>' + esc(TT.airTax) + '</em></p>' +
        '<div class="lt-2">' +
          '<div><p class="lt-cap">' + esc(TT.estCap) + '</p><p class="lt-big lt-n">' + salAmtSpan(a.cap.avg * 10000) + '</p>' + lvBar(a.cap.avg / maxv * 100, 'lt-gold') + '</div>' +
          '<div><p class="lt-cap">' + esc(TT.estFo) + '</p><p class="lt-big lt-n">' + salAmtSpan(a.fo.avg * 10000) + '</p>' + lvBar(a.fo.avg / maxv * 100, 'lt-gold') + '</div>' +
        '</div></div>';
    }
    var med = on[1] * 10000, max = 6e7, pc = function (v) { return (v / max * 100).toFixed(1); };
    var row = function (lab, m) {
      var lo = Math.round(m * 0.9 / 1e6) * 1e6, hi = Math.round(m * 1.08 / 1e6) * 1e6;
      return '<p class="lt-rl">' + esc(lab) + '</p>' +
        '<span class="lt-rg-t" aria-hidden="true"><i class="lt-rg-b" style="left:' + pc(lo) + '%;width:' + (pc(hi) - pc(lo)).toFixed(1) + '%"></i><i class="lt-rg-m" style="left:' + pc(m) + '%"></i></span>' +
        '<p class="lt-rv">25% <b>' + amt(lo) + '</b> · <em>' + esc(TT.airMed) + '</em> <b>' + amt(m, 'lt-n') + '</b> · 75% <b>' + amt(hi) + '</b></p>';
    };
    var pt = function (v, i) { var g = -Math.PI / 2 + i * Math.PI / 3, r = 30 * v / 5; return (50 + r * Math.cos(g)).toFixed(1) + ',' + (50 + r * Math.sin(g)).toFixed(1); };
    var ring = function (v) { return '<polygon class="lt-rdg" points="' + [0, 1, 2, 3, 4, 5].map(function (i) { return pt(v, i); }).join(' ') + '"/>'; };
    var labs = TT.axes.split(','), pos = [[50, 10], [89, 30], [89, 75], [50, 96], [11, 75], [11, 30]];
    var lab = labs.map(function (l, i) { return '<text x="' + pos[i][0] + '" y="' + pos[i][1] + '" text-anchor="middle">' + esc(l) + '</text>'; }).join('');
    return '<div class="lt-in">' +
      '<div class="lt-span lt-r"><div class="lt-air-hd">' + heroLogo(slug, name) + '<span class="lt-air-n"><b>' + esc(name) + '<i class="lt-chip">' + D.code + '</i></b>' +
        '<small>' + esc(TT.airSub) + ' · <span class="lt-st">★★★★<s>★</s></span> <b>' + D.scoreAvg + '</b></small></span></div>' +
        '<div class="lt-tabs2">' + tabs.map(function (t, i) { return '<span' + (i === 1 ? ' class="is-on"' : '') + '>' + esc(t) + '</span>'; }).join('') + '</div></div>' +
      '<div class="lt-col">' + est +
        '<div class="lt-card lt-r"><p class="lt-hd">' + esc(TT.rangeT) + '</p>' + row(TT.cap, med) + row(TT.fo, Math.round(med * 0.52 / 1e6) * 1e6) + '</div></div>' +
      '<div class="lt-col"><div class="lt-card lt-r lt-score"><p class="lt-hd">' + esc(TT.airScore) + '<em class="lt-avg"><b class="lt-n">' + D.scoreAvg + '</b> / 5</em></p>' +
        '<svg class="lt-radar" viewBox="0 0 100 106" aria-hidden="true">' + ring(5) + ring(3.33) + ring(1.67) +
        '<polygon class="lt-rs" points="' + D.score.map(pt).join(' ') + '"/>' + lab + '</svg></div></div>' +
    '</div>';
  }
  function tourMyPay(SAL) {
    var D = TOUR_DEMO, acc = 0;
    var mx = Math.max.apply(null, D.cum), mn = Math.min.apply(null, D.cum) * 0.96;
    var line = D.cum.map(function (v, i) { return (4 + i * 18.4).toFixed(1) + ',' + (34 - (v - mn) / (mx - mn) * 28).toFixed(1); }).join(' ');
    var arcs = D.seg.map(function (sg) {
      var s = '<circle class="lt-arc s-' + sg[0] + '" cx="21" cy="21" r="15.9" pathLength="100" stroke-dasharray="' + sg[1] + ' 100" stroke-dashoffset="' + (-acc) + '" style="--d:' + (acc * 9) + 'ms"/>';
      acc += sg[1]; return s;
    }).join('');
    var leg = D.seg.map(function (sg, i) {
      return '<li style="--i:' + i + '"><i class="s-' + sg[0] + '"></i>' + esc(TT['seg_' + sg[0]]) + '<b>' + sg[1] + '%</b></li>';
    }).join('');
    /* 他社の機長の年収（本物の数・salary-data.json）。読めなければ箱ごと出さない */
    var oth = '', all = SAL && SAL.airlines;
    if (all) {
      var rows = D.others.filter(function (s) { return all[s] && all[s].cap; }).map(function (s) { return [s, all[s].cap.avg]; });
      var top = Math.max.apply(null, rows.map(function (r) { return r[1]; }).concat([1]));
      oth = '<div class="lt-card lt-r"><p class="lt-hd">' + esc(TT.othersT) + '</p>' + rows.map(function (r, i) {
        return '<p class="lt-or" style="--i:' + i + '"><span>' + esc(airlineName(r[0], (all[r[0]] || {})[L] || r[0])) + '</span>' + salAmtSpan(r[1] * 10000, 'lt-ov') + '</p>' +
          lvBar(r[1] / top * 100, 'lt-o' + (i % 4));
      }).join('') + '</div>';
    }
    return '<div class="lt-in">' + tourMyHead(0) +
      '<div class="lt-col"><div class="lt-green lt-r"><p class="lt-cap">' + esc(TT.myT) + '</p><p class="lt-cap2">' + esc(TT.myGross) + '</p>' +
          '<p class="lt-big lt-n">' + exactSpan(D.gross) + '</p>' +
          '<p class="lt-row"><span>' + esc(TT.myYear) + '</span><b class="lt-n">' + exactSpan(D.year) + '</b></p>' +
          '<p class="lt-row"><span>' + esc(TT.myHour) + '</span><b class="lt-n">' + exactSpan(D.hour) + '</b></p></div>' +
        '<div class="lt-card lt-r lt-dn"><p class="lt-hd">' + esc(TT.compT) + '</p><div class="lt-dn2"><svg class="lt-donut" viewBox="0 0 42 42" aria-hidden="true"><circle class="lt-track" cx="21" cy="21" r="15.9"/>' + arcs + '</svg>' +
          '<ul class="lt-leg">' + leg + '</ul></div></div></div>' +
      '<div class="lt-col"><div class="lt-card lt-r"><p class="lt-hd">' + esc(TT.cumT) + '</p><p class="lt-big lt-n">' + exactSpan(Math.round(D.cum.reduce(function (s, v) { return s + v; }, 0) * 1e6)) + '</p>' +
          '<svg class="lt-line" viewBox="0 0 100 38" preserveAspectRatio="none" aria-hidden="true"><polyline class="lt-ln" pathLength="1" points="' + line + '"/></svg></div>' +
        oth + '</div>' +
    '</div>';
  }
  function tourSchedule() {
    var wd = TT.schWd.split(','), D = TOUR_DEMO, cells = '', fly = 0, off = 0;
    for (var b = 0; b < 6; b++) cells += '<i class="lt-d lt-d--x"></i>';   // 2026年11月1日は日曜 ＝ 月曜はじまりで前に6つ空ける
    for (var day = 1; day <= 30; day++) {
      var t = D.days.charAt(day - 1) || 'o';
      if (t === 'f') fly++; if (t === 'o') off++;
      cells += '<i class="lt-d t-' + t + '" style="--i:' + day + '"><span>' + day + '</span></i>';
    }
    var key = ['f', 's', 't', 'o'].map(function (k) { return '<span><i class="t-' + k + '"></i>' + esc(TT['key_' + k]) + '</span>'; }).join('');
    var bmx = Math.max.apply(null, D.bhs), mons = TT.schMons.split(',');
    var bars = D.bhs.map(function (v, i) {
      return '<span class="lt-vb" style="--i:' + i + '"><i style="--h:' + (v / bmx * 100).toFixed(1) + '"></i><small>' + esc(mons[i]) + '</small></span>';
    }).join('');
    var stat = function (lab, v, unit) { return '<p class="lt-kv"><span>' + esc(lab) + '</span><b><span class="lt-n">' + v + '</span>' + esc(unit) + '</b></p>'; };
    return '<div class="lt-in">' + tourMyHead(1) +
      '<div class="lt-col"><div class="lt-card lt-r"><p class="lt-hd">' + esc(TT.schT) + '</p>' +
          stat(TT.key_f, fly, TT.dayU) + stat(TT.schBh, D.bh + '.0', 'h') + stat(TT.schFt, D.ft + '.5', 'h') + stat(TT.key_o, off, TT.dayU) + '</div>' +
        '<div class="lt-card lt-r"><p class="lt-hd">' + esc(TT.bhT) + '</p><div class="lt-vbs">' + bars + '</div></div></div>' +
      '<div class="lt-col"><div class="lt-card lt-r"><div class="lt-cal">' + wd.map(function (x) { return '<i class="lt-wd">' + esc(x) + '</i>'; }).join('') + cells + '</div>' +
        '<p class="lt-key">' + key + '</p></div></div>' +
    '</div>';
  }
  /* 数え上げ：見えている字（本物の額・数）をそのまま目標にして、0 から同じ書式で数える */
  function tourCount(el) {
    var tgt = el.querySelector('[data-jpy]') || el;
    var fin = tgt.hasAttribute('data-jpy') ? (tgt.classList.contains('lt-exact') ? exactAmt : tgt.classList.contains('lt-sal') ? salAmt : mqAmt)(parseInt(tgt.getAttribute('data-jpy'), 10))
                                           : (tgt._ltFin || (tgt._ltFin = tgt.textContent));
    var m = fin.match(/\d[\d,]*(\.\d+)?/);
    if (!m) return;
    var val = parseFloat(m[0].replace(/,/g, '')), dec = m[1] ? m[1].length - 1 : 0, grp = m[0].indexOf(',') >= 0;
    var pre = fin.slice(0, m.index), post = fin.slice(m.index + m[0].length), t0 = null, my = (tgt._ltRun = (tgt._ltRun || 0) + 1);
    var fmt = function (v) { var s = v.toFixed(dec); if (grp) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); return pre + s + post; };
    tgt.textContent = fmt(0);
    var step = function (now) {
      if (my !== tgt._ltRun) return;
      if (t0 == null) t0 = now;
      var k = Math.min(1, (now - t0) / 800), e = 1 - Math.pow(1 - k, 4);
      tgt.textContent = k < 1 ? fmt(val * e) : fin;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function tour() {
    var box = d.getElementById('lt-pcbox'), pc = d.getElementById('lt-pc'), go = d.getElementById('lt-go'), rail = pc && pc.querySelector('.lt-rail');
    if (!box || !pc || !go || !rail) return;
    var RM = !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches) || (!!navigator.webdriver && !w.__pvMotion);
    /* 大きさ：広い幅は 960、狭い幅は 720 の設計で組んで縮める。高さは箱に合わせて決める */
    var fit = function () {
      var bw = box.clientWidth, bh = box.clientHeight;
      if (!bw || !bh) return;
      var W = bw >= 440 ? 880 : 720, s = bw / W;   // 広い幅 880・狭い幅 720 の設計（字が小さくなりすぎない大きさ）
      pc.classList.toggle('is-narrow', W === 720);
      pc.style.width = W + 'px';
      pc.style.height = Math.round(bh / s) + 'px';
      pc.style.transform = 'scale(' + s.toFixed(4) + ')';
    };
    fit();
    if ('ResizeObserver' in w) new ResizeObserver(fit).observe(box); else w.addEventListener('resize', fit);
    var make = { realpay: tourRealPay, airline: tourAirline, mypay: tourMyPay, schedule: tourSchedule };
    var scr = TOUR.map(function (t, i) {
      var s = i === 0 ? go.querySelector('.lt-scr[data-k="realpay"]') : d.createElement('div');
      if (i) { s.className = 'lt-scr'; s.setAttribute('data-k', t.k); s.setAttribute('aria-hidden', 'true'); go.appendChild(s); }
      s.innerHTML = make[t.k](null);
      return s;
    });
    var cur = 0, timers = [], paused = false, waiting = null;
    var later = function (fn, ms) { timers.push(setTimeout(fn, ms)); };
    /* 本物の年収（salary-data.json）が読めたら、会社と MY PAY の画面を描き直す（下のランキングと同じ1回の取り寄せ） */
    if (w.PVLeveling && typeof w.PVLeveling.load === 'function') {
      w.PVLeveling.load().then(function (SAL) {
        ['airline', 'mypay'].forEach(function (k) {
          var s = go.querySelector('.lt-scr[data-k="' + k + '"]');
          if (s) { s.innerHTML = make[k](SAL); if (s.classList.contains('is-on')) play(s); }
        });
      }, function () {});
    }
    var tabs = [].slice.call(rail.querySelectorAll('.lt-tab')), pill = rail.querySelector('.lt-pill');
    var tabOf = function (i) { return rail.querySelector('.lt-tab[data-k="' + TOUR[i].tab + '"]'); };
    var place = function () {
      var t = tabOf(cur); if (!t || !pill) return;
      pill.style.transform = 'translateY(' + t.offsetTop + 'px)';
      pill.style.height = t.offsetHeight + 'px';
      pill.style.width = t.offsetWidth + 'px';
      pill.style.left = t.offsetLeft + 'px';
    };
    /* 本文の中で見えた部品だけ動かす（箱の外は見えない） */
    var io = ('IntersectionObserver' in w) ? new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting || e.target.classList.contains('lt-on')) return;
        var s = e.target.closest('.lt-scr');
        if (!s || !s.classList.contains('is-on')) return;
        e.target.classList.add('lt-on');
        Array.prototype.forEach.call(e.target.querySelectorAll('.lt-n'), tourCount);
        if (e.target.classList.contains('lt-n')) tourCount(e.target);
      });
    }, { root: box, threshold: 0.3 }) : null;
    var play = function (s) {
      Array.prototype.forEach.call(s.querySelectorAll('.lt-r'), function (r) { r.classList.remove('lt-on'); if (io && !RM) { io.unobserve(r); io.observe(r); } });
      var inn = s.querySelector('.lt-in');
      if (inn) { inn.classList.remove('lt-flow'); inn.style.transform = ''; }
      if (RM || !io) { Array.prototype.forEach.call(s.querySelectorAll('.lt-r'), function (r) { r.classList.add('lt-on'); }); return; }
      /* 1.4 秒たったら、はみ出している分だけ本文がすっと下へ流れる（本物の画面をスクロールしている感じ） */
      later(function () {
        if (!inn) return;
        var dist = Math.max(0, Math.round(inn.scrollHeight - go.clientHeight + 8));
        if (dist < 4) return;
        inn.classList.add('lt-flow');
        inn.style.transform = 'translateY(' + (-dist) + 'px)';
      }, 900);
    };
    var show = function (i) {
      if (i === cur || !scr[i]) return;
      var prev = scr[cur], next = scr[i];
      prev.classList.remove('is-on', 'lt-play');
      prev.setAttribute('aria-hidden', 'true');
      if (!RM) { prev.classList.add('is-out'); setTimeout(function () { prev.classList.remove('is-out'); }, 420); }
      next.classList.add('is-on');
      next.removeAttribute('aria-hidden');
      void next.offsetWidth;
      if (!RM) next.classList.add('lt-play');
      cur = i;
      tabs.forEach(function (t) {
        var on = t === tabOf(i);
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      var u = d.getElementById('lt-url'); if (u) u.textContent = TOUR[i].url;
      go.setAttribute('href', TOUR[i].href);
      go.setAttribute('data-pv-ev', TOUR[i].ev);
      go.setAttribute('aria-label', TT['open_' + TOUR[i].k]);
      go.setAttribute('aria-labelledby', 'lt-t-' + TOUR[i].tab);
      place();
      play(next);
    };
    /* メニューを押す（MY PAGE をもう一度押すと勤務 ＝ スケジュール） */
    rail.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('.lt-tab') : null;
      if (!t) return;
      var k = t.getAttribute('data-k'), i = k === 'mypay' && TOUR[cur].k === 'mypay' ? 3 : TOUR.findIndex(function (x) { return x.k === k; });
      timers.forEach(clearTimeout); timers = [];
      show(i);
      ev('hero_tour_tab', { tab: TOUR[i].k });
      if (!RM) loop();
    });
    rail.addEventListener('keydown', function (e) {
      var n = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      if (!n) return;
      e.preventDefault();
      var j = (tabs.indexOf(tabOf(cur)) + n + tabs.length) % tabs.length;
      tabs[j].click(); tabs[j].focus();
    });
    w.addEventListener('resize', place);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(place);
    place();
    if (!RM) scr[0].classList.add('lt-play');
    play(scr[0]);
    if (RM) return;
    /* カーソル：次に押す所（左のメニューの項目、スケジュールは本文の「勤務」）へ動いて、押す */
    var cursor = pc.querySelector('.lt-cursor');
    var aim = function (el) {
      if (!cursor || !el) return;
      var p = pc.getBoundingClientRect(), r = el.getBoundingClientRect(), s = p.width / pc.offsetWidth;
      var x = (r.left - p.left + r.width * 0.55) / s, y = (r.top - p.top + r.height * 0.6) / s;
      cursor.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    };
    var DWELL = 2800;   // オーナー「もっと素早く」（4.2 → 2.8 秒）
    var loop = function () {
      timers.forEach(clearTimeout); timers = [];
      if (paused) { waiting = true; return; }
      later(function () {
        var n = (cur + 1) % TOUR.length;   // カーソルが動き出すのは切り替えの 0.75 秒前
        var target = TOUR[n].k === 'schedule' ? scr[cur].querySelector('[data-sub="roster"]') : tabOf(n);
        aim(target);
        later(function () {
          if (target) { target.classList.add('is-press'); setTimeout(function () { target.classList.remove('is-press'); }, 220); }
          later(function () { show(n); loop(); }, 120);
        }, 520);
      }, DWELL - 650);
    };
    aim(tabOf(0));
    loop();
    var stop = {};
    var sync = function () {
      var p = !!(stop.hover || stop.focus || stop.out || d.hidden);
      if (p === paused) return;
      paused = p;
      if (paused) { timers.forEach(clearTimeout); timers = []; waiting = true; }
      else if (waiting) { waiting = false; loop(); }
    };
    var shot = d.querySelector('#hero-section .hero-shot');
    if (shot) {
      shot.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { stop.hover = 1; sync(); } });
      shot.addEventListener('pointerleave', function () { stop.hover = 0; sync(); });
      shot.addEventListener('focusin', function () { stop.focus = 1; sync(); });
      shot.addEventListener('focusout', function () { stop.focus = 0; sync(); });
      if ('IntersectionObserver' in w) new IntersectionObserver(function (es) { stop.out = !es[0].isIntersecting; sync(); }, { threshold: 0.25 }).observe(shot);
    }
    d.addEventListener('visibilitychange', sync);
  }

  /* ── ⓬-b PC の窓の部品（トップの3か所が共有：ヒーロー・REAL PAY の節・航空会社の比較の節）──────────
     ★箱（.lt-pcbox）の幅に合わせて、中（.lt-pc）を設計の大きさで組んで縮める。高さは箱に合わせて設計の高さを決める。
     ★飾りの左メニュー（押せない）と上の帯は、空の入れ物（data-on）にここで描く ＝ 同じ絵を3か所に書かない。 */
  var RAIL_IC = {
    add: '<path d="M12 5v14M5 12h14"/>',
    home: '<path d="M3 9.5 12 2l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    others: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    vote: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>',
    roadmap: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    airlines: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    invite: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
    settings: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'
  };
  function railHTML(on) {
    var items = [['add', TT.railAdd], ['home', 'HOME'], ['others', 'REAL PAY'], ['vote', 'VOTE'], ['roadmap', 'ROADMAP & REQUESTS'],
                 ['airlines', 'AIRLINES'], ['invite', 'INVITE'], ['settings', 'MY PAGE']];
    return items.map(function (it) {
      return '<span class="lt-ri' + (it[0] === 'add' ? ' lt-add' : '') + (it[0] === on ? ' is-on' : '') + '">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + RAIL_IC[it[0]] + '</svg>' +
        '<em>' + esc(it[1]) + '</em></span>';
    }).join('') + '<i class="lt-pill"></i>';
  }
  function pcFrames() {
    Array.prototype.forEach.call(d.querySelectorAll('.lt-rail[data-on]'), function (r) { r.innerHTML = railHTML(r.getAttribute('data-on')); });
    Array.prototype.forEach.call(d.querySelectorAll('.lt-top[data-fill]'), function (t) {
      t.innerHTML = '<span class="lt-logo">PILOT<br>VALUE</span><span class="lt-tb lt-tb-i"></span><span class="lt-tb lt-tb-i"></span><span class="lt-tb">' + (L === 'en' ? 'EN' : 'JP') + '</span><span class="lt-tb">¥ JPY</span>';
    });
  }
  /* 飾りの左メニューの緑の板を、選んだ項目の位置に置く（動かない） */
  function railPill(rail) {
    var on = rail && rail.querySelector('.lt-ri.is-on'), pill = rail && rail.querySelector('.lt-pill');
    if (!on || !pill) return;
    pill.style.transform = 'translateY(' + on.offsetTop + 'px)';
    pill.style.height = on.offsetHeight + 'px';
    pill.style.width = on.offsetWidth + 'px';
    pill.style.left = on.offsetLeft + 'px';
  }
  function pcFit(box, pc, wide, narrow, cb) {
    var fit = function () {
      var bw = box.clientWidth, bh = box.clientHeight;
      if (!bw || !bh) return;
      var W = bw >= 440 ? wide : narrow, s = bw / W;
      pc.classList.toggle('is-narrow', W === narrow);
      pc.style.width = W + 'px';
      pc.style.height = Math.round(bh / s) + 'px';
      pc.style.transform = 'scale(' + s.toFixed(4) + ')';
      if (cb) cb();
    };
    fit();
    if ('ResizeObserver' in w) new ResizeObserver(fit).observe(box); else w.addEventListener('resize', fit);
  }
  /* カーソルを pc の中の el へ動かす（設計の座標で） */
  function pcAim(pc, cursor, el, fx, fy) {
    if (!cursor || !el) return;
    var p = pc.getBoundingClientRect(), r = el.getBoundingClientRect(), s = p.width / pc.offsetWidth;
    var x = (r.left - p.left + r.width * (fx == null ? 0.55 : fx)) / s, y = (r.top - p.top + r.height * (fy == null ? 0.6 : fy)) / s;
    cursor.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
  }
  var RM_ALL = !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches) || (!!navigator.webdriver && !w.__pvMotion);
  /* 箱が画面に入っている間だけ回す（外・裏のタブでは止める）。run(on) は入った／出たで呼ばれる */
  function whileSeen(el, run) {
    var seen = false, sync = function () { var v = seen && !d.hidden; run(v); };
    if ('IntersectionObserver' in w) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; sync(); }, { threshold: 0.3 }).observe(el);
    d.addEventListener('visibilitychange', sync);
  }

  /* ── ⓬-c REAL PAY の節：PC の窓の中の REAL PAY。カーソルが行を押す → 右から「行を押すと出る面」（今までの白いカード）が滑り込む ──
     ★面の中身は今までどおり fillRealPay() が描く（全部見本・キャセイの機長）。ここは開け閉めと動きだけ。 */
  function realpayDemo() {
    var box = d.getElementById('lt2-box'), pc = d.getElementById('lt2-pc'), go = d.getElementById('lt2-go'), dw = d.getElementById('lt2-dw');
    if (!box || !pc || !go || !dw) return;
    var H = PV_DEMO.hero, idx = [0, H.rp.on, 1, 2, 4];
    var partsOf = function (i) { if (i === H.rp.on) return H.detail.parts; var r = H.rows.filter(function (x) { return x.i === i; })[0]; return r ? r.parts : [['base', 60], ['variable', 26], ['bonus', 14]]; };
    var rows = idx.map(function (i, n) {
      var r = PV_DEMO.marquee[i]; if (!r) return '';
      var slug = r[0], jpy = r[1] * 10000, name = airlineName(slug, r[7]);
      return '<div class="lt-tr lt-r' + (i === H.rp.on ? ' lt-pick' : '') + '" style="--i:' + n + '">' +
        '<span class="lt-td lt-td-air">' + heroLogo(slug, name) + '<b>' + esc(name) + '</b></span>' +
        '<span class="lt-td lt-td-pos">' + esc(posReal(r[3])) + '<small>' + esc(fleetReal(r[4])) + '</small></span>' +
        '<span class="lt-td lt-td-yr">' + esc(T.ten(tw(r[5]))) + '</span>' +
        '<span class="lt-td lt-td-amt"><span class="lt-n">' + amt(jpy, 'lt-rp-v') + '</span></span>' +
        '<span class="lt-td lt-td-cb">' + heroBar('hero-c-cb', partsOf(i)) + '</span></div>';
    }).join('');
    go.innerHTML = '<div class="lt-in">' +
      '<div class="lt-span lt-r lt-rp-hd"><b class="lt-rp-t">REAL PAY</b><span class="lt-rp-t2">VERIFIED PAY</span><span class="lt-chipf">' + esc(TT.rpFilter) + '</span></div>' +
      '<div class="lt-span lt-tbl"><div class="lt-th lt-r"><span>' + esc(TT.rpAir) + '</span><span>' + esc(TT.rpPos) + '</span><span>' + esc(TT.rpYrs) + '</span>' +
        '<span>' + esc(TT.rpAmt) + '</span><span>' + esc(TT.rpComp) + '</span></div>' + rows + '</div></div>';
    var rail = pc.querySelector('.lt-rail');
    pcFit(box, pc, 880, 720, function () { railPill(rail); });
    var all = [].slice.call(go.querySelectorAll('.lt-r'));
    if (RM_ALL) { all.forEach(function (r) { r.classList.add('lt-on'); }); dw.classList.add('is-open'); return; }
    var cursor = pc.querySelector('.lt-cursor'), pick = go.querySelector('.lt-pick'), x = dw.querySelector('.lp-rp-x');
    var timers = [], first = true;
    var later = function (fn, ms) { timers.push(setTimeout(fn, ms)); };
    var openDw = function () {
      pick.classList.add('is-sel');
      dw.classList.remove('is-play'); void dw.offsetWidth;
      dw.classList.add('is-open', 'is-play');
      Array.prototype.forEach.call(dw.querySelectorAll('.lp-rp-av, .lp-rp-v .pv-no-cur'), tourCount);
    };
    var closeDw = function () { dw.classList.remove('is-open'); pick.classList.remove('is-sel'); };
    var cycle = function () {
      if (first) {
        first = false;
        all.forEach(function (r) { r.classList.add('lt-on'); });
        Array.prototype.forEach.call(go.querySelectorAll('.lt-n'), tourCount);
        pcAim(pc, cursor, go.querySelector('.lt-th'), 0.9, 0.5);
      }
      later(function () { pcAim(pc, cursor, pick, 0.5, 0.55); }, 600);
      later(function () { pick.classList.add('is-press'); setTimeout(function () { pick.classList.remove('is-press'); }, 200); }, 1150);
      later(openDw, 1270);
      later(function () { pcAim(pc, cursor, x, 0.5, 0.5); }, 4300);
      later(function () { if (x) { x.classList.add('is-press'); setTimeout(function () { x.classList.remove('is-press'); }, 200); } }, 4850);
      later(closeDw, 4970);
      later(cycle, 5800);
    };
    whileSeen(box, function (on) {
      timers.forEach(clearTimeout); timers = [];
      if (on) cycle();
    });
  }

  /* ── ⓫ REAL PAY の節：白いカード（行を押すと出る面の見本）──────────────────
     ★2026-11-01、本物の面（actual-pay.js の dwHTML）と同じ並びにした ──
       ロゴ・社名・「サンプル」の札 ／ 職位 · 機材 · 年数 ／ 年収と月あたりの2つの箱 ／ 報酬の内訳（棒・注記・区分ごとの帯と％）。
     ★全部 PV_DEMO（サンプル）。出典（Verified・本人申告）と投稿時期は出さない（本物のプレビューの面と同じ）。
     ★金額は必ず帯（◯〜◯）で出す。1つの数字にしない ── 本物は匿名化された帯でしか出さない。
       帯は span を**2つ**に分ける（repaintMarquee() は1要素＝1金額で塗り替える）。
     ⚠️ 金額は HTML に書かない（ここで描く）。check-salary.mjs の照合に見本を入れないため。 */
  function fillRealPay() {
    var H = PV_DEMO.hero;
    // ⚠️ marquee を直に引く（rows の長さに巻き込まれない）。無ければ何も描かずに戻る。
    var on = PV_DEMO.marquee[H.rp.on];
    var box = d.getElementById('lp-rp-body');
    if (!on || !box) return;
    var slug = on[0], jpy = on[1] * 10000, mon = Math.round(jpy / 12);
    var name = airlineName(slug, on[7]);
    var parts = H.detail.parts, band = H.detail.band || {};
    var nameEl = d.getElementById('lp-rp-name');
    if (nameEl) nameEl.innerHTML = heroLogo(slug, name) + '<span class="lp-rp-an">' + esc(name) + '</span>';
    box.innerHTML =
      '<p class="lp-rp-meta">' + esc(posReal(on[3]) + DOT + fleetReal(on[4]) + DOT + T.ten(tw(on[5]))) + '</p>' +
      '<div class="lp-rp-amts">' +
        '<div class="lp-rp-a"><span class="lp-rp-al">' + esc(T.dwYear) + '</span>' +
          '<span class="lp-rp-av pv-no-cur" data-jpy="' + jpy + '">' + esc(mqAmt(jpy)) + '</span></div>' +
        '<div class="lp-rp-a"><span class="lp-rp-al">' + esc(T.dwMonth) + '</span>' +
          '<span class="lp-rp-av pv-no-cur" data-jpy="' + mon + '">' + esc(mqAmt(mon)) + '</span></div>' +
      '</div>' +
      '<p class="lp-rp-h">' + esc(T.dwComp) + '</p>' +
      heroBar('lp-rp-bar', parts) +
      '<p class="lp-rp-stn">' + esc(T.openNote) + '</p>' +
      '<ul class="lp-rp-list">' + parts.map(function (p) {
        var b = band[p[0]], lo = b ? b[0] * 10000 : 0, hi = b ? b[1] * 10000 : 0;
        return '<li><span class="lp-rp-k"><i class="lp-c-' + p[0] + '" aria-hidden="true"></i>' + esc(T.seg[p[0]]) + '</span>' +
          // 帯を持たない区分は金額だけ黙って出さない（0 で埋めない）。
          '<span class="lp-rp-v">' + (b ?
            '<span class="pv-no-cur" data-jpy="' + lo + '">' + esc(mqAmt(lo)) + '</span>' + esc(T.dash) +
            '<span class="pv-no-cur" data-jpy="' + hi + '">' + esc(mqAmt(hi)) + '</span>' : '') +
            '<span class="lp-rp-sh">' + p[1] + '%</span></span></li>';
      }).join('') + '</ul>';
  }

  /* ── ⓬ 112 AIRLINES の節：掲載社数の数字と、比較のスライド ─────────────────────
     ★同じ salary-data.json の社数で [data-pv-n="airlines"] を上書きする。HTML の数字は JS を動かさない
       読み手のための控えで、assert-claims.mjs が SALARY の社数と照合している。
       PVLeveling.load() は1回だけ取りに行って使い回す（下のレベリング図と同じ約束＝通信は増えない）。
     ★2026-11-01、電話の中身を「機長の公開年収レンジ」の一覧から、本物の2社比較の画面のスライドに替えた
       （オーナー「比較の画面はスライドできる（クリックしたらその比較画面になる）」）。
       スライドの中身（社名・額・棒・写真・クレジット）は gen-lp-compare.mjs が career.html から写して HTML に書く。
       ここは送るだけ（‹ › と点・いまの組の名前・クレジットの出し分け）。額を JS に持たない。 */
  function fillAirlines() {
    var marks = d.querySelectorAll('[data-pv-n="airlines"]');
    if (!marks.length) return;
    if (!w.PVLeveling || typeof w.PVLeveling.load !== 'function') return;   // 控えの数字のまま（推測で埋めない）
    w.PVLeveling.load().then(function (SAL) {
      var n = Object.keys((SAL && SAL.airlines) || {}).length;
      if (n > 0) for (var k = 0; k < marks.length; k++) marks[k].textContent = String(n);
    }).catch(function () {});
  }

  /* 比較のスライド。★指で横に滑らせる（scroll-snap ── ブラウザがやる）＋ ‹ › と点で送る。勝手には動かさない。
     いま見えている1枚は、横の送り位置から決める（送った・滑らせた・Tab で入ったのどれでも同じ1か所）。
     クレジットは見えている組の写真のぶんだけ出す（写真の条件は「その写真のそばに示す」）。 */
  function wireCompare() {
    var track = d.getElementById('lp-cmp-track');
    if (!track) return;
    var slides = track.querySelectorAll('.lp-cmp-s');
    var n = slides.length;
    if (n < 2) return;
    var dots = d.querySelectorAll('#lp-cmp-nav .lp-cmp-dot');
    var label = d.getElementById('lp-cmp-now');
    var prev = d.getElementById('lp-cmp-prev'), next = d.getElementById('lp-cmp-next');
    var credits = d.querySelectorAll('#lp-cmp-credits [data-slide]');
    var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var cur = -1;
    function at() {
      var wd = track.clientWidth || 1;
      return Math.max(0, Math.min(n - 1, Math.round(track.scrollLeft / wd)));
    }
    function paint(i) {
      if (i === cur) return;
      cur = i;
      for (var k = 0; k < dots.length; k++) {
        if (k === i) dots[k].setAttribute('aria-current', 'true'); else dots[k].removeAttribute('aria-current');
      }
      for (var q = 0; q < n; q++) slides[q].classList.toggle('is-cur', q === i);   // 見えている1枚だけ棒が伸びる（lp.css）
      if (label) label.textContent = slides[i].getAttribute('data-pair') || '';
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === n - 1;
      for (var c = 0; c < credits.length; c++) {
        credits[c].hidden = credits[c].getAttribute('data-slide').split(' ').indexOf(String(i)) < 0;
      }
      var any = false;
      for (var e = 0; e < credits.length; e++) if (!credits[e].hidden) { any = true; break; }
      var box = d.getElementById('lp-cmp-credits');
      if (box) {
        box.hidden = !any;
        // 頭の字（英語は Photo / Photos）は、見えているクレジットの数で選ぶ（字は HTML に2つ在る ── 作らない）。
        var shown = 0;
        for (var g = 0; g < credits.length; g++) if (!credits[g].hidden) shown++;
        var h1 = box.querySelector('[data-n="1"]'), h2 = box.querySelector('[data-n="2"]');
        if (h1) h1.hidden = shown !== 1;
        if (h2) h2.hidden = shown === 1;
      }
    }
    /* ★‹ › で送っている途中は、行き先（aim）を覚えておく。途中の位置で点や名前を塗り直さない・
         続けて押したら行き先から数える（速く2回押すと1枚ずつ確実に進む）。着いたら（または 1.2 秒で）忘れる。 */
    var aim = -1, aimT = 0;
    function go(i) {
      i = Math.max(0, Math.min(n - 1, i));
      aim = i;
      clearTimeout(aimT);
      aimT = setTimeout(function () { aim = -1; paint(at()); }, 1200);
      track.scrollTo({ left: i * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
      paint(i);
    }
    var raf = 0;
    track.addEventListener('scroll', function () {
      if (raf) return;
      raf = (w.requestAnimationFrame || setTimeout)(function () {
        raf = 0;
        if (aim >= 0) {
          if (Math.abs(track.scrollLeft - aim * track.clientWidth) > 2) return;
          aim = -1; clearTimeout(aimT);
        }
        paint(at());
      });
    }, { passive: true });
    function base() { return aim >= 0 ? aim : at(); }
    if (prev) prev.addEventListener('click', function () { go(base() - 1); });
    if (next) next.addEventListener('click', function () { go(base() + 1); });
    for (var k = 0; k < dots.length; k++) {
      (function (i) { dots[i].addEventListener('click', function () { go(i); }); })(k);
    }
    // 幅が変わったら、いまの1枚の頭へ合わせ直す（回転・ウィンドウの幅を変えたとき半端な位置で止めない）。
    w.addEventListener('resize', function () { if (cur >= 0) track.scrollLeft = cur * track.clientWidth; });
    paint(at());
    /* ★2026-11-12 PC の窓（#lt3-box）に入れた。箱の幅に合わせて縮め、見えている間は 5 秒ごとに次の組へ（最後の次は最初へ）。
         指を乗せている間・「動きを減らす」・自動の検査では送らない。 */
    var box3 = d.getElementById('lt3-box'), pc3 = d.getElementById('lt3-pc');
    if (box3 && pc3) {
      var rail3 = pc3.querySelector('.lt-rail');
      pcFit(box3, pc3, 820, 640, function () { railPill(rail3); if (cur >= 0) track.scrollLeft = cur * track.clientWidth; });
      if (!RM_ALL) {
        var t3 = 0, hover3 = false;
        box3.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hover3 = true; });
        box3.addEventListener('pointerleave', function () { hover3 = false; });
        whileSeen(box3, function (on) {
          clearInterval(t3);
          if (on) t3 = setInterval(function () { if (!hover3) go(base() >= n - 1 ? 0 : base() + 1); }, 3200);
        });
      }
    }
  }

  /* ── ⓭ 航空会社別の年収ランキング（#ranking の棒グラフ）─────────────────
     ★数字の出どころは salary-data.json（SALARY から生成）の cap.avg / fo.avg だけ。
       HTML にも lp.css にも社名と金額を持たない＝SSOT を直せばここも変わる。
       前は index.html に5社ぶんを手書きしてあり、SSOT を更新しても取り残された。
     ⚠️ avg は公開情報からの推計。見出しの「（推定年収・公開情報）」を外さない。
        「平均」と書かない（DATA-PROVENANCE.md）。
     ★棒の色は airlines-meta.js のブランド色。ここで配色を発明しない。
       色を持たない社（SSOT 112 に対し meta は 108）は地の緑のまま出る。
     ★PVLeveling.load() は fillAirlines と同じ1回を使い回す＝通信は増えない。
     ⚠️ 金額は pv-no-cur ＋ data-jpy。currency.js の走査より後に描くので、
        あちらには任せられない（repaintMarquee が塗り直す）。 */
  /* ⚠️ 行数を変えたら lp.css の .lp-rk の min-height（＝先に取っておく高さ）も直す。
     直さないと、行が入った瞬間にカードが伸びて画面が跳ねる。 */
  var RANK_N = 6;

  function rankRows(SAL, key) {
    var all = (SAL && SAL.airlines) || {};
    return Object.keys(all).filter(function (sl) {
      return all[sl] && all[sl][key] && all[sl][key].avg > 0;
    }).sort(function (a, b) {
      return all[b][key].avg - all[a][key].avg;
    }).slice(0, RANK_N).map(function (sl, i) {
      var m = airlineMeta(sl);
      return {
        slug: sl, i: i, man: all[sl][key].avg,
        name: airlineName(sl, L === 'en' ? all[sl].en : all[sl].ja),
        flag: (m && m.flag) || '',
        color: m && /^#[0-9a-fA-F]{6}$/.test(m.color || '') ? m.color : null,
      };
    });
  }

  function rankHTML(rows) {
    if (!rows.length) return '';
    var top = rows[0].man;
    return rows.map(function (r) {
      var jpy = r.man * 10000;
      var pct = Math.max(8, Math.round(r.man / top * 100));
      // 濃い側＝ブランド色そのまま、薄い側＝同じ色の 53%（8桁hex の透明度）。新しい色を作らない。
      var sty = r.color ? ' style="--rk:' + r.color + ';--rk-s:' + r.color + '88"' : '';
      return '<a class="lp-rk-row" href="airlines/' + esc(r.slug) + '.html" data-pv-ev="lp_explore_rank_row"' + sty + '>' +
        '<span class="lp-rk-n' + (r.i < 3 ? ' lp-rk-n' + (r.i + 1) : '') + '">' + (r.i + 1) + '</span>' +
        '<span class="lp-rk-an">' + (r.flag ? '<span aria-hidden="true">' + esc(r.flag) + '</span> ' : '') + esc(r.name) + '</span>' +
        '<span class="lp-rk-amt pv-no-cur" data-jpy="' + jpy + '">' + esc(salAmt(jpy)) + '</span>' +
        '<span class="lp-rk-trk" aria-hidden="true"><i data-pct="' + pct + '"></i></span>' +
      '</a>';
    }).join('');
  }

  function fillRanking() {
    var cap = d.getElementById('rank-captain'), fo = d.getElementById('rank-fo');
    if (!cap || !fo) return;
    if (!w.PVLeveling || typeof w.PVLeveling.load !== 'function') return;   // 空のまま（数字を推測で埋めない）
    w.PVLeveling.load().then(function (SAL) {
      var a = rankHTML(rankRows(SAL, 'cap')), b = rankHTML(rankRows(SAL, 'fo'));
      if (!a || !b) return;
      cap.innerHTML = a;
      fo.innerHTML = b;
      rankAnim('rank-captain');
    }).catch(function () {});
  }

  /* 棒を 0 → 実寸へ。動かすのは transform だけ（幅は動かさない）。
     隠れている面（display:none）は遷移が走らないので、タブを切り替えた側から呼び直す
     ＝ index.html の switchRankTab() が PV_rankAnim を叩く。
     ⚠️ 時間で待たない。2回 rAF を挟んで「最初の描画が済んだ」ことを条件にする。 */
  function rankAnim(id) {
    var box = d.getElementById(id);
    if (!box) return;
    var bars = box.querySelectorAll('.lp-rk-trk i'), i;
    for (i = 0; i < bars.length; i++) { bars[i].style.transitionDelay = ''; bars[i].style.transform = 'scaleX(0)'; }
    var go = function () {
      for (var j = 0; j < bars.length; j++) {
        bars[j].style.transitionDelay = (j * 0.05) + 's';
        bars[j].style.transform = 'scaleX(' + (parseInt(bars[j].getAttribute('data-pct'), 10) / 100) + ')';
      }
    };
    if (typeof w.requestAnimationFrame !== 'function') { go(); return; }
    w.requestAnimationFrame(function () { w.requestAnimationFrame(go); });
  }
  w.PV_rankAnim = rankAnim;

  /* ── 開発時だけ：?pv_demo=live で実データ経路を目視する用のログ ─────────
     localhost 以外では何もしない（本番でURLを叩かれても動かない）。 */
  function devProbe() {
    if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
    if (location.search.indexOf('pv_demo=live') < 0) return;
    Promise.all([
      rest('pay_benchmarks?select=airline,position,fleet,n,median_usd&order=n.desc&limit=20'),
      rest('reviews_v2?select=id,airline,created_at&order=created_at.desc&limit=30'),
    ]).then(function (res) {
      console.log('[lp.js] pay_benchmarks:', res[0].length, res[0]);
      console.log('[lp.js] reviews_v2:', res[1].length);
    });
  }

  /* ── モバイル固定CTA：Hero を抜けたら出し、最後のCTAが見えたら引っ込める ──
     ヘッダーには入れられない（search.js のハンバーガーを押し出すため）。
     常時出しっぱなしにすると、下端のフッターと最後のCTAに被る。 */
  function mobileCta() {
    var bar = d.getElementById('pv-mcta');
    if (!bar || !('IntersectionObserver' in w)) return;
    var hero = d.getElementById('hero-section');
    var end = d.getElementById('final-cta');
    var seen = { hero: !!hero, end: false };

    function apply() {
      var on = !seen.hero && !seen.end;
      bar.classList.toggle('is-on', on);
      bar.setAttribute('aria-hidden', on ? 'false' : 'true');
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.target === hero) seen.hero = e.isIntersecting;
        if (e.target === end) seen.end = e.isIntersecting;
      });
      apply();
    }, { threshold: 0 });
    if (hero) io.observe(hero);
    if (end) io.observe(end);
    apply();
  }

  function boot() {
    wireEvents();
    fillMarquee();
    fillHero();
    pcFrames();
    tour();
    fillRealPay();
    realpayDemo();
    fillAirlines();
    wireCompare();
    fillRanking();
    // 金額は pv-no-cur ＝ currency.js の走査から外してある（mqAmt が自分で書く）ので、
    // 通貨の切替はここで受ける（流れるカード・ヒーローの見本・REAL PAY のカード・ランキング）。currency.js は
    // 「保存された通貨が非JPY」の初期表示でも同じ報せを出すので、戻ってきた人もこれ1本で拾える。
    w.addEventListener('pv-currency-change', repaintMarquee);
    fillVoices();
    fillReviewMq();   // ヒーローの口コミの帯。取りに行くのは fillVoices と合わせて1回だけ。
    mobileCta();
    devProbe();
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
