/* airline-display.mjs ── 先行5社ではない会社のページに、調べの台帳（research-ledger.mjs）の行を出すときの「画面の字」の1か所
 * （全社へ広げる c・2026-10-21 リードの決め L1）。
 *
 * ★ 調べた側の字（label_ja・cond_ja・注・調べた側が書いた値の字、英語の切れ端、「SH協約」「CPT/FO」「basecode」のような内輪の略語）は、
 *   カードの字にしない。
 * ★ カードの字は2つの道からだけ作る。
 *     ITEM   … 項目ごとの言い方の表（1項目に1つ）。行の決まった欄（項目・値・単位・期間・通貨・日付・使い方）だけで言えるときに使う
 *              ── 数（日数・時間・機数・額）と日付だけ。字の値（調べた側が書いた文）はここを通らない。
 *     LINES  … 欄だけでは言えない行の字（行の ID ごと）。ここで書いた短い日本語。どの行も、その行の h（台帳の中身の指紋）を持つ。
 *              台帳の行の中身が変わる（h が変わる）と、その字は古い ── 画面に出さず（stale）、check() と assert-rollout.mjs が赤くする
 *              （書き直して h を付け直すまで）。
 *   どちらでも言えない行は出さない（airline-rollout.mjs が「画面の言い方がまだ無い」と数える）。
 * ★ 資料の名前（出どころのリンクの字）は SOURCES（資料の ID ごと）。資料自身の題（英語のページ名など）は、資料の言葉として
 *   かぎかっこの中にだけ置く。
 * ★ 過去の行は「過去」の札と日付つき・参考の行は「参考」の札つきでだけ出す（TAG）。どちらもカードの1行めにしない
 *   （その決まりは gen-airline-glance.mjs の workCell・benCell・companyCard）。
 * ★ 就航地（NET）と暮らしの街（CITY）も、ここに書いた字があるときだけ出す（無い会社は今までの「確認できていません」の形）。
 *   NET と CITY の h は、まとめた行ぜんぶの指紋（digest）── 行が1つ変わる・増える・減ると古くなる。
 *
 * ★ 英語の対（2026-10-22 全社へ広げる d2 ＝ 英語の EN-2・P12.92）：ここで書く字には、どれも英語の対を同じ場所に持つ
 *   （ITEM の label_en・LINES の en・SOURCES_EN・AGREEMENTS の name_en／cond_en・NET の basis_en・CITY の *_en・TAG_EN）。
 *   say(r, 'en') が英語の字を返す（対の無い行は英語では言わない ＝ null）。日本語の字（say(r)）は1文字も変えない。
 *   行の h は日本語と英語の両方の指紋 ── 台帳の行が変わると、両方とも古い（stale）。対の欠け・対の中の日本語の字は check() が赤くする。
 *
 *   node airline-display.mjs --check   古い字・名前の無い資料・英語の対の欠けを数える（赤なら exit 1）
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLACES } from './airline-destinations.mjs';
import { COUNTRIES } from './airline-countries.mjs';
import { UPLOAD_HOSTS } from './import-research-pack.mjs';

/* 使い方の札。条件つき・募集は札なし（募集は募集の1枚に置くこと自体が言い方）。 */
export const TAG = Object.freeze({ 過去: '過去', 参考: '参考' });
export const TAG_EN = Object.freeze({ 過去: 'Past', 参考: 'Reference' });
/* 募集の札（2026-10-21 リード d2）── 今の公表が無い勤務・待遇のカードに、会社自身の募集の行を出すときだけ（airline-rollout.mjs）。
   募集の1枚の中では付けない（募集の1枚に置くこと自体が言い方）。 */
export const AD_TAG = '募集';
export const AD_TAG_EN = 'Job ad';

/* ── 項目ごとの言い方（ITEM）──────────────────────────────────────
   label … 画面の名前（先行5社の台帳と同じ言葉を使う）
   say   … 'count'（数＋単位）／'money'（通貨つきの額）／'date'（日付）／'iata'（空港の3字）／
           'country'（国 ── サイトの国の表 airline-countries.mjs の COUNTRIES の名前だけ）／
           'city'（街 ── 空港の呼び名の表 airline-destinations.mjs の PLACES の街の名前だけ）。
           これ以外の形の値は、この表では言わない（LINES が要る）。国・街の字は調べた側の字ではなく、サイトの表の字
   per   … true ＝ 期間（年・月）が言えない行は言わない（「休日 123日」のように、何日あたりか分からない数を出さない）
   ★年金（pension）・ロスターの型（roster_pattern）・訓練費の返還（training_bond）は、ここに置かない（2026-10-21 a2）── 値は
     調べた側が書いた文か、誰の・何に対する率かが欄だけでは言えない数。行ごとの字（LINES）ができるまで画面に出ない。 */
export const ITEM = Object.freeze({
  annual_leave: { label: '年次休暇', label_en: 'Annual leave', say: 'count' },
  sick_leave: { label: '有給の病気休暇', label_en: 'Paid sick leave', say: 'count' },
  days_off: { label: '休日', label_en: 'Days off', say: 'count' },
  annual_days_off: { label: '休日', label_en: 'Days off', say: 'count', per: true },
  headquarters_country: { label: '本社', label_en: 'Headquarters', say: 'country' },
  headquarters_city: { label: '本社', label_en: 'Headquarters', say: 'city' },
  pilot_base_city: { label: '拠点', label_en: 'Base', say: 'city' },
  working_time: { label: '勤務時間', label_en: 'Working hours', say: 'count' },
  medical: { label: '医療の補助', label_en: 'Medical allowance', say: 'money' },
  commuting: { label: '通勤の補助', label_en: 'Commuting allowance', say: 'money' },
  housing: { label: '住宅の補助', label_en: 'Housing allowance', say: 'money' },
  founded: { label: '設立', label_en: 'Founded', say: 'date' },
  first_flight: { label: '最初の便', label_en: 'First flight', say: 'date' },
  fleet_total: { label: '運航している機材', label_en: 'Aircraft in service', say: 'count' },
  pilot_base: { label: '拠点', label_en: 'Base', say: 'iata' },
});
/* 単位の言い方（台帳の単位の字 → 画面の字）。表に無い単位の行は言わない。 */
const UNIT = Object.freeze({
  days: '日', day: '日', '日': '日', 'days/year': '日', 'days per year': '日',
  'calendar days': '日（暦日）', calendar_days: '日（暦日）', 'calendar days per year': '日（暦日）',
  weeks: '週間', 'weeks per year': '週間', hours: '時間', '時間': '時間', '機': '機', aircraft: '機',
});
const PER = Object.freeze({ year: '年', month: '月' });
const perOf = r => PER[r.per] || (/per year|\/year/.test(String(r.unit || '')) ? '年' : '');
/* 英語の単位（1 のときは単数）と期間。表に無い単位の行は英語でも言わない */
const UNIT_EN = Object.freeze({
  days: ['day', 'days'], day: ['day', 'days'], '日': ['day', 'days'], 'days/year': ['day', 'days'], 'days per year': ['day', 'days'],
  'calendar days': ['calendar day', 'calendar days'], calendar_days: ['calendar day', 'calendar days'], 'calendar days per year': ['calendar day', 'calendar days'],
  weeks: ['week', 'weeks'], 'weeks per year': ['week', 'weeks'], hours: ['hour', 'hours'], '時間': ['hour', 'hours'], '機': ['aircraft', 'aircraft'], aircraft: ['aircraft', 'aircraft'],
});
const PER_EN = Object.freeze({ 年: 'year', 月: 'month' });
const MONTH_EN = Object.freeze(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);
const DATE_JA = /^(\d{4})年(?:(\d{1,2})月(?:(\d{1,2})日)?)?$/;
const DATE_ISO = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
/* 和暦（2026-10-21 全社へ広げる d1）。会社概要の設立日は「平成20年6月24日」「1990年(平成2年)6月29日」「昭和44（1969）年7月」の形で
   載っている。元号の年を西暦に直し、西暦と元号の両方が書いてあれば2つが合うときだけ読む（合わなければ言わない ── 推して埋めない）。 */
const ERA = Object.freeze({ 明治: 1867, 大正: 1911, 昭和: 1925, 平成: 1988, 令和: 2018 });
const z2h = s => String(s).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\s+/g, '');
function eraIso(s) {
  s = z2h(s);
  /* 西暦のあとの（元号N年）・元号N（西暦）年 */
  let m = /^(\d{4})年?[（(](明治|大正|昭和|平成|令和)(\d{1,2}|元)年?[）)]年?(.*)$/.exec(s);
  if (m) { const e = ERA[m[2]] + (m[3] === '元' ? 1 : +m[3]); return e === +m[1] ? `${m[1]}年${m[4]}` : ''; }
  m = /^(明治|大正|昭和|平成|令和)(\d{1,2}|元)[（(](\d{4})[）)]年(.*)$/.exec(s);
  if (m) { const e = ERA[m[1]] + (m[2] === '元' ? 1 : +m[2]); return e === +m[3] ? `${m[3]}年${m[4]}` : ''; }
  m = /^(明治|大正|昭和|平成|令和)(\d{1,2}|元)年(.*)$/.exec(s);
  if (m) return `${ERA[m[1]] + (m[2] === '元' ? 1 : +m[2])}年${m[3]}`;
  return s;
}
const dateJa = s => {
  const v = eraIso(s);
  const m = DATE_JA.exec(v) || DATE_ISO.exec(v);
  return m ? `${m[1]}年${m[2] ? `${+m[2]}月` : ''}${m[3] ? `${+m[3]}日` : ''}` : '';
};
/** 英語の日付（「24 June 2008」「June 2008」「2008」）。読み方は dateJa と同じ（和暦も同じ決まり） */
export const dateEn = s => {
  const v = eraIso(s);
  const m = DATE_JA.exec(v) || DATE_ISO.exec(v);
  if (!m || (m[2] && !(+m[2] >= 1 && +m[2] <= 12))) return '';
  return [m[3] ? String(+m[3]) : '', m[2] ? MONTH_EN[+m[2] - 1] : '', m[1]].filter(Boolean).join(' ');
};

/* ── 誰の条件か（2026-10-21 全社へ広げる d1・リード「勤務の行は、誰の条件かを言う」）──
   項目の言い方の表（ITEM）で言う勤務・待遇の行は、行の職位（rank）が機長・副操縦士・訓練生なら、名前の頭にそれを付ける
   （「機長の休日 年120日」）。機長の募集・訓練生の募集の数を、どのパイロットにも当てはまるように読ませない。
   運航乗務員ぜんたい（crew）・職位の無い行は付けない。行ごとの字（LINES）は、その字が誰の条件かを言う（cond）。
   ★訓練生の行は、勤務・待遇のカードの1行め（lead）にしない（airline-rollout.mjs）。 */
export const RANK_JA = Object.freeze({ cap: '機長', fo: '副操縦士', trainee: '訓練生' });
export const RANK_EN = Object.freeze({ cap: 'Captain', fo: 'First Officer', trainee: 'Cadet' });
export const rankOf = r => r.rank || (r.applies_to && r.applies_to.rank) || '';
const WHOSE_DOMAINS = ['work', 'benefits'];

/* ── 労働協約（2026-10-21 リードの決め d・P12.86-6）──
   政府の機関に登録された・政府や組合が公表した労働協約は、その会社の条件の一次資料。画面では「労働協約」の札と、
   その協約の名前で出す（「会社が公表している条件」とは言わない・「確認できていません」にもしない）。
   ★ここに書くのは、協約の本文か承認の決定そのものの資料だけ（資料の ID ごと）。報告・報道・掲示板・協約の要約の投稿は書かない
     （資料の種類の欄が union_cba でも、組合のお知らせ・ニュースの記事なら入れない ── 字の表で1件ずつ決める）。
   name … 出どころのリンクの字（資料自身の題は「」の中）／cond … その協約が誰の条件か（カードの前提の1行。LINES の cond が在ればそちら）
   url / date … 台帳のその資料の住所と日付（発行・掲載の日。台帳に無ければ null）。★登録は台帳の資料そのもの ── 住所が台帳と違う・
     発行元が政府か組合でない・利用者がアップロードした写しの置き場（import-research-pack.mjs の UPLOAD_HOSTS）の資料は、
     assert-rollout.mjs の「労働協約の登録」が赤くする（2026-10-22 全社へ広げる e）。
   ★登録しなかった資料（協約の本文・承認の決定ではないもの）：組合のお知らせ・ニュース（AFAP の承認のお知らせ・Teamsters の批准の記事・
     APA の基本合意・ACDAC の声明）・仮合意の文書（Allegiant の Tentative Agreement）・組合の手引き（Delta の Scheduling Reference
     Handbook・Frontier の PBS Handbook）・組合の要約のページ（ALPA の Air Canada・Breeze・Alaska・Porter のページ）・組合の求人
     （ASPA の募集）・年金基金と訓練校の案内（KLM）・労使合同委員会の解釈（TAP の BTE 3/2026）。 */
export const AGREEMENTS = Object.freeze({
  'src-qantas-sh-ea9-approved': { name: 'オーストラリア公正労働委員会「[2025] FWCA 1554」（カンタス航空 短距離線パイロットの労働協約 EBA9 の承認と本文）', cond: '短距離線のパイロットの労働協約', name_en: 'Fair Work Commission of Australia “[2025] FWCA 1554” (approval and text of the Qantas short-haul pilots’ enterprise agreement EBA9)', cond_en: 'Short-haul pilots’ collective agreement',
    url: 'https://d15k2d11r6t6rl.cloudfront.net/pub/dw7a/z1swde28/zi1/yde/auy/20250509%20-%20SH%20EA%20Approval.pdf', date: '2025-05-09' },
  /* 同じ PDF（同じ住所）を、ROUND5 の別の資料の ID で引いている行がある（2026-10-21 a3） */
  'src-qantas-r8-ea9': { name: 'オーストラリア公正労働委員会「[2025] FWCA 1554」（カンタス航空 短距離線パイロットの労働協約 EBA9 の承認と本文）', cond: '短距離線のパイロットの労働協約', name_en: 'Fair Work Commission of Australia “[2025] FWCA 1554” (approval and text of the Qantas short-haul pilots’ enterprise agreement EBA9)', cond_en: 'Short-haul pilots’ collective agreement',
    url: 'https://d15k2d11r6t6rl.cloudfront.net/pub/dw7a/z1swde28/zi1/yde/auy/20250509%20-%20SH%20EA%20Approval.pdf', date: '2025-05-09' },
  /* ── 全社へ広げる e（2026-10-22）：d2 の会社の労働協約（政府の機関が公表した協約・組合が公表した協約の本文）── */
  'src-air-france-r9-nao2026-primary': { name: 'フランス政府の法令の公開サイト Légifrance「Protocole d\'accord sur les mesures salariales Air France 2026」（エールフランスの2026年の給与の協約）', cond: 'フランス本土・海外県で働くエールフランスの社員（パイロットを含む）の2026年の協約',
    name_en: 'Légifrance (French government) “Protocole d\'accord sur les mesures salariales Air France 2026” (Air France’s 2026 pay agreement)', cond_en: 'Air France’s 2026 agreement for staff (pilots included) working in mainland France and the overseas departments',
    url: 'https://www.legifrance.gouv.fr/acco/id/ACCOTEXT000053556613', date: '2026-02-24' },
  'src-air-france-r10-health-extension2026': { name: 'フランス政府の法令の公開サイト Légifrance「Avenant n°1 à l\'accord d\'entreprise du 9 décembre 2022 relatif au régime complémentaire frais de santé」（エールフランスの補完医療の協約の改定）', cond: 'エールフランスの社員（パイロットを含む）の補完医療の協約',
    name_en: 'Légifrance (French government) “Avenant n°1 à l\'accord d\'entreprise du 9 décembre 2022 relatif au régime complémentaire frais de santé” (amendment to Air France’s supplementary health agreement)', cond_en: 'Air France’s supplementary health agreement for staff (pilots included)',
    url: 'https://www.legifrance.gouv.fr/acco/id/ACCOTEXT000052837307', date: '2025-11-25' },
  /* 同じ協約（BOE-A-2026-19041）を、2つの資料の ID（2つの住所）で引いている */
  'src-easyjet-spain-cba-2026': { name: 'スペイン官報（BOE）「III Convenio colectivo de pilotos de easyJet Airline Company Limited, sucursal en España」（BOE-A-2026-19041・イージージェットのスペインのパイロットの労働協約）', cond: 'スペインで働くイージージェットのパイロットの労働協約',
    name_en: 'Spain’s Official State Gazette (BOE) “III Convenio colectivo de pilotos de easyJet Airline Company Limited, sucursal en España” (BOE-A-2026-19041, easyJet’s collective agreement for pilots in Spain)', cond_en: 'Collective agreement for easyJet pilots in Spain',
    url: 'https://www.boe.es/eli/es/res/2026/08/28/(1)', date: '2026-09-11' },
  'src-easyjet-r10-boe2026-pilot-cba': { name: 'スペイン官報（BOE）「III Convenio colectivo de pilotos de easyJet Airline Company Limited, sucursal en España」（BOE-A-2026-19041・イージージェットのスペインのパイロットの労働協約）', cond: 'スペインで働くイージージェットのパイロットの労働協約',
    name_en: 'Spain’s Official State Gazette (BOE) “III Convenio colectivo de pilotos de easyJet Airline Company Limited, sucursal en España” (BOE-A-2026-19041, easyJet’s collective agreement for pilots in Spain)', cond_en: 'Collective agreement for easyJet pilots in Spain',
    url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2026-19041', date: '2026-09-11' },
  'src-eurowings-r10-spain-benefits-cba2026': { name: 'スペイン官報（BOE）「Convenio colectivo de Pilotos de Eurowings Europe Limited en España」（BOE-A-2026-18628・ユーロウイングスのスペインのパイロットの労働協約）', cond: 'スペインで働くユーロウイングス（Eurowings Europe）のパイロットの労働協約',
    name_en: 'Spain’s Official State Gazette (BOE) “Convenio colectivo de Pilotos de Eurowings Europe Limited en España” (BOE-A-2026-18628, Eurowings’ collective agreement for pilots in Spain)', cond_en: 'Collective agreement for Eurowings (Eurowings Europe) pilots in Spain',
    url: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-18628', date: '2026-09-04' },
  'src-iberia-cba-base-2022': { name: 'スペイン官報（BOE）の BOE-A-2022-23017（イベリア航空とパイロットの第10次の労働協約）', cond: 'イベリア航空のパイロットの労働協約（第10次）',
    name_en: 'Spain’s Official State Gazette (BOE) BOE-A-2022-23017 (the 10th collective agreement between Iberia and its pilots)', cond_en: 'Iberia pilots’ collective agreement (10th)',
    url: 'https://www.boe.es/eli/es/res/2022/12/15/(6)', date: '2022-12-28' },
  'src-iberia-cba-amendment-2024': { name: 'スペイン官報（BOE）の BOE-A-2024-25500（イベリア航空とパイロットの第10次の労働協約の改定）', cond: 'イベリア航空のパイロットの労働協約の改定（2024年）',
    name_en: 'Spain’s Official State Gazette (BOE) BOE-A-2024-25500 (amendment to the 10th collective agreement between Iberia and its pilots)', cond_en: 'Amendment to the Iberia pilots’ collective agreement (2024)',
    url: 'https://www.boe.es/eli/es/res/2024/11/26/(1)', date: '2024-12-06' },
  'src-ita-airways-r4-signed-second-level2026': { name: '組合 FAST-Confsal「Accordo integrativo di secondo livello ITA, firmato 22 luglio 2026」（ITAエアウェイズと組合の会社の協約・2026年7月22日の署名）', cond: 'ITAエアウェイズの乗員（パイロットを含む）の会社の協約（2026年9月から2028年12月まで）',
    name_en: 'FAST-Confsal (trade union) “Accordo integrativo di secondo livello ITA, firmato 22 luglio 2026” (ITA Airways’ company agreement with the unions, signed 22 July 2026)', cond_en: 'ITA Airways’ company agreement for flight crew (pilots included), September 2026 to December 2028',
    url: 'https://sindacatofast.it/areacon/compartoaereo/sites/default/files/FAST%20-%20Accordo%202%C2%B0%20Livello%20-%2022.07.2026%20-%20fir_compresse%20d%20%281%29.pdf', date: '2026-07-23' },
  'src-jetstar-r8-fwc': { name: 'オーストラリア公正労働委員会「Jetstar Airways Pilots Enterprise Agreement 2026」（ジェットスター航空のパイロットの労働協約・承認された本文）', cond: 'ジェットスター航空のパイロットの労働協約（2026年）',
    name_en: 'Fair Work Commission of Australia “Jetstar Airways Pilots Enterprise Agreement 2026” (the approved text of Jetstar’s pilots’ enterprise agreement)', cond_en: 'Jetstar pilots’ enterprise agreement (2026)',
    url: 'https://www.fwc.gov.au/documents/agreements/approved/ae533389.pdf', date: '2026-07-15' },
  'src-latam-resume-brazil-act2527': { name: '組合 SNA（Sindicato Nacional dos Aeronautas）「ACT Aeronautas Pilotos 2025–2027」（LATAM ブラジル（TAM）とパイロットの労働協約・組合の公開版）', cond: 'LATAM ブラジル（TAM）のパイロットの労働協約（2025〜2027年）',
    name_en: 'SNA (Sindicato Nacional dos Aeronautas, trade union) “ACT Aeronautas Pilotos 2025–2027” (collective agreement between LATAM Brasil (TAM) and its pilots, the union’s published copy)', cond_en: 'Collective agreement for LATAM Brasil (TAM) pilots (2025–2027)',
    url: 'https://aeronautas.org.br/wp-content/uploads/2025/12/20251209-ACT-Aeronautas-Pilotos-25-27_v13-site.pdf', date: null },
  'src-norwegian-spain-cba': { name: 'スペイン官報（BOE）の BOE-A-2024-24738（Norwegian Air Resources Spain とパイロットの第2次の労働協約）', cond: 'スペインで働くノルウェー・エアシャトル（Norwegian Air Resources Spain）のパイロットの労働協約',
    name_en: 'Spain’s Official State Gazette (BOE) BOE-A-2024-24738 (the 2nd collective agreement between Norwegian Air Resources Spain and its pilots)', cond_en: 'Collective agreement for Norwegian (Norwegian Air Resources Spain) pilots in Spain',
    url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2024-24738', date: '2024-11-27' },
  /* 同じ協約（BOE-A-2023-15123・同じ住所）を、2つの資料の ID で引いている */
  'src-ryanair-spain-cba': { name: 'スペイン官報（BOE）「Convenio colectivo de Pilotos de Ryanair DAC en España」（BOE-A-2023-15123・ライアンエアーのスペインのパイロットの労働協約）', cond: 'スペインで働くライアンエアー（Ryanair DAC）のパイロットの労働協約',
    name_en: 'Spain’s Official State Gazette (BOE) “Convenio colectivo de Pilotos de Ryanair DAC en España” (BOE-A-2023-15123, Ryanair’s collective agreement for pilots in Spain)', cond_en: 'Collective agreement for Ryanair (Ryanair DAC) pilots in Spain',
    url: 'https://www.boe.es/eli/es/res/2023/06/09/(7)', date: '2023-06-28' },
  'src-ryanair-r8-boe-pilot-cba': { name: 'スペイン官報（BOE）「Convenio colectivo de Pilotos de Ryanair DAC en España」（BOE-A-2023-15123・ライアンエアーのスペインのパイロットの労働協約）', cond: 'スペインで働くライアンエアー（Ryanair DAC）のパイロットの労働協約',
    name_en: 'Spain’s Official State Gazette (BOE) “Convenio colectivo de Pilotos de Ryanair DAC en España” (BOE-A-2023-15123, Ryanair’s collective agreement for pilots in Spain)', cond_en: 'Collective agreement for Ryanair (Ryanair DAC) pilots in Spain',
    url: 'https://www.boe.es/eli/es/res/2023/06/09/(7)', date: '2023-06-28' },
  /* 同じ官報（BTE 2023年29号・同じ住所）を、2つの資料の ID で引いている */
  'src-tap-pub-tap-spac-signed2023': { name: 'ポルトガル労働省（GEP）の労働の官報 BTE 2023年29号（TAPポルトガル航空とパイロットの組合 SPAC の会社協約）', cond: 'TAPポルトガル航空のパイロットの労働協約（2023年）',
    name_en: 'Portuguese Ministry of Labour (GEP) Labour Bulletin BTE no. 29/2023 (the company agreement between TAP Air Portugal and the pilots’ union SPAC)', cond_en: 'TAP Air Portugal pilots’ collective agreement (2023)',
    url: 'https://bte.gep.msess.gov.pt/completos/2023/bte29_2023.pdf', date: '2023-08-08' },
  'src-tap-r8-cbe-rbo2023': { name: 'ポルトガル労働省（GEP）の労働の官報 BTE 2023年29号（TAPポルトガル航空とパイロットの組合 SPAC の会社協約）', cond: 'TAPポルトガル航空のパイロットの労働協約（2023年）',
    name_en: 'Portuguese Ministry of Labour (GEP) Labour Bulletin BTE no. 29/2023 (the company agreement between TAP Air Portugal and the pilots’ union SPAC)', cond_en: 'TAP Air Portugal pilots’ collective agreement (2023)',
    url: 'https://bte.gep.msess.gov.pt/completos/2023/bte29_2023.pdf', date: '2023-08-08' },
  /* その協約の第1次の部分改定（BTE 2024年16号）。台帳では TAP の4つの行の2つめの資料（改定で変えた条項のほかは、協約がそのまま効いている根拠）
     ── 行の出どころは1つめの資料（BTE 2023年29号）なので、画面の字は変わらない（2026-10-23） */
  'src-tap-r8-cbe-amendment2024': { name: 'ポルトガル労働省（GEP）の労働の官報 BTE 2024年16号（TAPポルトガル航空とパイロットの組合 SPAC の会社協約の第1次の部分改定）', cond: 'TAPポルトガル航空のパイロットの労働協約の改定（2024年）',
    name_en: 'Portuguese Ministry of Labour (GEP) Labour Bulletin BTE no. 16/2024 (the first partial revision of the company agreement between TAP Air Portugal and the pilots’ union SPAC)', cond_en: 'Amendment to the TAP Air Portugal pilots’ collective agreement (2024)',
    url: 'https://bte.gep.msess.gov.pt/completos/2024/bte16_2024.pdf', date: '2024-04-29' },
  /* 同じ PDF（同じ住所）を、2つの資料の ID で引いている */
  'src-turkish-airlines-pub-cba29-full': { name: '組合 Hava-İş「THY A.O. 29. Dönem Toplu İş Sözleşmesi 01.01.2026–31.12.2027」（ターキッシュ エアラインズの第29期の労働協約）', cond: 'ターキッシュ エアラインズの社員の労働協約（第29期・2026〜2027年。組合員が対象で、パイロットの条項を含む）',
    name_en: 'Hava-İş (trade union) “THY A.O. 29. Dönem Toplu İş Sözleşmesi 01.01.2026–31.12.2027” (Turkish Airlines’ 29th-term collective agreement)', cond_en: 'Turkish Airlines’ collective agreement for staff (29th term, 2026–2027; covers union members and includes pilot clauses)',
    url: 'https://www.havais.org.tr/uploaded/thy-ao-29-donem-tis-01012026-31122027-1773664884.pdf', date: '2026-03-06' },
  'src-turkish-airlines-r8-cba29': { name: '組合 Hava-İş「THY A.O. 29. Dönem Toplu İş Sözleşmesi 01.01.2026–31.12.2027」（ターキッシュ エアラインズの第29期の労働協約）', cond: 'ターキッシュ エアラインズの社員の労働協約（第29期・2026〜2027年。組合員が対象で、パイロットの条項を含む）',
    name_en: 'Hava-İş (trade union) “THY A.O. 29. Dönem Toplu İş Sözleşmesi 01.01.2026–31.12.2027” (Turkish Airlines’ 29th-term collective agreement)', cond_en: 'Turkish Airlines’ collective agreement for staff (29th term, 2026–2027; covers union members and includes pilot clauses)',
    url: 'https://www.havais.org.tr/uploaded/thy-ao-29-donem-tis-01012026-31122027-1773664884.pdf', date: null },
  /* 同じ PDF（署名版・同じ住所）を、2つの資料の ID で引いている */
  'src-united-r8-upa23': { name: 'ユナイテッド航空とパイロットの組合 ALPA「United Pilot Agreement 2023」（パイロットの労働協約・署名版）', cond: 'ユナイテッド航空のパイロットの労働協約（2023年）',
    name_en: 'United Airlines and the pilots’ union ALPA “United Pilot Agreement 2023” (the signed pilots’ collective agreement)', cond_en: 'United Airlines pilots’ collective agreement (2023)',
    url: 'https://d2r1lrrqctgamh.cloudfront.net/UAL/TA/upa23-2023-09-29.pdf', date: '2023-09-29' },
  'src-united-signed-upa23': { name: 'ユナイテッド航空とパイロットの組合 ALPA「United Pilot Agreement 2023」（パイロットの労働協約・署名版）', cond: 'ユナイテッド航空のパイロットの労働協約（2023年）',
    name_en: 'United Airlines and the pilots’ union ALPA “United Pilot Agreement 2023” (the signed pilots’ collective agreement)', cond_en: 'United Airlines pilots’ collective agreement (2023)',
    url: 'https://d2r1lrrqctgamh.cloudfront.net/UAL/TA/upa23-2023-09-29.pdf', date: '2023-09-29' },
  /* 同じ協約（BOE-A-2026-5693）を、2つの資料の ID（2つの住所）で引いている */
  'src-vueling-pilot-cba': { name: 'スペイン官報（BOE）「IV Convenio colectivo de Vueling Airlines SA y sus tripulantes pilotos」（BOE-A-2026-5693・ブエリング航空のパイロットの労働協約）', cond: 'スペインの契約で働くブエリング航空のパイロットの労働協約',
    name_en: 'Spain’s Official State Gazette (BOE) “IV Convenio colectivo de Vueling Airlines SA y sus tripulantes pilotos” (BOE-A-2026-5693, Vueling’s pilots’ collective agreement)', cond_en: 'Collective agreement for Vueling pilots on Spanish contracts',
    url: 'https://www.boe.es/eli/es/res/2026/02/25/(6)', date: '2026-03-11' },
  'src-vueling-r8-pilot-cba2026': { name: 'スペイン官報（BOE）「IV Convenio colectivo de Vueling Airlines SA y sus tripulantes pilotos」（BOE-A-2026-5693・ブエリング航空のパイロットの労働協約）', cond: 'スペインの契約で働くブエリング航空のパイロットの労働協約',
    name_en: 'Spain’s Official State Gazette (BOE) “IV Convenio colectivo de Vueling Airlines SA y sus tripulantes pilotos” (BOE-A-2026-5693, Vueling’s pilots’ collective agreement)', cond_en: 'Collective agreement for Vueling pilots on Spanish contracts',
    url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2026-5693', date: '2026-03-11' },
  /* カナダ政府の労働協約の公開庫に登録された協約。台帳の行（拠点）は過去の協約の話で、拠点には過去の行を使わない ＝ 画面に出る行は無い */
  'src-westjet-r3na-cba1-2019': { name: 'カナダ政府の労働協約の公開庫 Negotech「WestJet Collective Agreement No.1」（ウェストジェット航空とパイロットの組合 ALPA の第1次の労働協約・2019〜2022年）', cond: 'ウェストジェット航空のパイロットの第1次の労働協約（2019〜2022年）',
    name_en: 'Government of Canada collective agreements repository (Negotech) “WestJet Collective Agreement No.1” (the 1st collective agreement between WestJet and the pilots’ union ALPA, 2019–2022)', cond_en: 'WestJet pilots’ 1st collective agreement (2019–2022)',
    url: 'https://negotech.service.canada.ca/eng/agreements/15/1523801a.pdf', date: null },
});
export const agreementOf = s => (s && AGREEMENTS[s.source_id]) || null;

/* ── 機材の型式（2026-10-21 全社へ広げる d1）── 機材の行の値（型式の書き方）か、値が機数のときは行の項目の名前から、
   サイトの型式の字（「ボーイング 787-9」「エアバス A321neo」）を作る。型式の書き方として読めないもの（文・日付・複数の型式・
   「返還」「計画」「発注」の行）は言わない ── 型式の数・機数は作らない。読めない行は LINES の fleet か、出さない。 */
const FLEET_KEY = Object.freeze({ a332: 'A330-200', a333: 'A330-300', b738: '737-800', b38m: '737 MAX 8', a320ceo: 'A320ceo' });
const FLEET_EXACT = Object.freeze({
  crj700: 'CRJ700', arj21: 'COMAC ARJ21', c919: 'COMAC C919', q400: 'Q400', q300: 'Q300', 'dhc-8-400': 'DHC-8-400', 'dhc-8-200': 'DHC-8-200', 'dhc8-400': 'DHC-8-400',
  'de havilland canada dhc-8-400': 'DHC-8-400', 'de havilland canada dhc-8-200': 'DHC-8-200', 'viking dhc-6-400': 'DHC-6-400', dhc6: 'DHC-6',
  'dornier 228-212': 'ドルニエ 228-212', 'cessna 172p': 'セスナ 172P', cessna172: 'セスナ 172',
  'gulfstream g450': 'ガルフストリーム G450', 'gulfstream g550': 'ガルフストリーム G550', 'gulfstream gv': 'ガルフストリーム GV',
  as350: 'AS350', as355: 'AS355', as365n2: 'AS365N2', aw139: 'AW139', aw189: 'AW189', ec135t2: 'EC135T2', ec155b: 'EC155B', s76: 'S-76', bk117: 'BK117',
  b412ep: 'ベル 412EP', atr42: 'ATR 42', atr72: 'ATR 72',
});
const FLEET_NOT = /return|deliver|order|plan|entry|programme|program|combined|count|combi|connect|link|neo-combined/i;
export function fleetJa(r) {
  const raw = typeof r.value === 'string' ? r.value : (typeof r.value === 'number' && !FLEET_NOT.test(String(r.key)) ? String(r.key).replace(/_/g, '-') : '');
  if (!raw || FLEET_NOT.test(String(r.key))) return '';
  const k = String(r.key).toLowerCase();
  if (typeof r.value === 'number' && FLEET_KEY[k]) return /^7/.test(FLEET_KEY[k]) ? `ボーイング ${FLEET_KEY[k]}` : `エアバス ${FLEET_KEY[k]}`;
  const s = raw.replace(/[０-９Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/(?:型機|型|シリーズ)$/, '').trim();
  if (/[\/、。+]|\bor\b|\band\b|\d{4}-\d{2}|[ぁ-ゖ]/.test(s)) return '';
  const low = s.toLowerCase().replace(/\s+/g, ' ');
  if (FLEET_EXACT[low]) return FLEET_EXACT[low];
  let m = /^(?:boeing|ボーイング)?\s*b?\s*-?\s*(7[1-8]7)\s*-?\s*(\d{1,3})?\s*(er|lr|f|i)?\s*(?:ng)?\s*(max)?\s*-?\s*(\d{1,2})?\s*(?:max)?\s*(?:dreamliner)?$/i.exec(s);
  if (m && /^(?:boeing|ボーイング|b|7)/i.test(s)) {
    const max = /max/i.test(s), sub = m[2] || '', n2 = m[5] || '';
    if (max) return `ボーイング ${m[1]} MAX${(n2 || sub) ? ` ${n2 || sub}` : ''}`;
    if (n2) return '';
    const suf = m[3] ? (m[3].toLowerCase() === 'i' ? 'i' : m[3].toUpperCase()) : '';
    const ng = !sub && /\bng\b|ng$/i.test(s) ? ' NG' : '';
    return `ボーイング ${m[1]}${sub ? `-${sub}` : ''}${suf}${ng}`;
  }
  m = /^(?:airbus|エアバス|ab)?\s*-?\s*a?\s*(220|3[1-8]\d)\s*-?\s*(\d{3,4})?\s*-?\s*(neo|ceo)?\s*(xlr|lr)?\s*(?:\((lr)\))?\s*-?\s*(family|ファミリー)?$/i.exec(s);
  if (m && /^(?:airbus|エアバス|ab|a)/i.test(s)) {
    const neo = m[3] ? m[3].toLowerCase() : '', lr = (m[4] || m[5] || '').toUpperCase();
    return `エアバス A${m[1]}${m[2] ? `-${m[2]}` : ''}${neo}${lr}${m[6] ? 'ファミリー' : ''}`;
  }
  m = /^(?:embraer|エンブラエル)?\s*-?\s*(e)?\s*(1[79]\d)\s*(?:-?\s*(e2))?$/i.exec(s);
  if (m && (m[1] || /^(?:embraer|エンブラエル)/i.test(s))) return `エンブラエル ${m[2]}${m[3] ? '-E2' : ''}`;
  m = /^atr\s*-?\s*(42|72)\s*-?\s*(600|500)?$/i.exec(s);
  if (m) return `ATR ${m[1]}${m[2] ? `-${m[2]}` : ''}`;
  return '';
}

/** 機材の型式の英語（fleetJa の字のメーカーの名前を英語に。型式の書き方そのものは同じ） */
const MAKER_EN = Object.freeze([['ボーイング ', 'Boeing '], ['エアバス ', 'Airbus '], ['エンブラエル ', 'Embraer '], ['ドルニエ ', 'Dornier '], ['セスナ ', 'Cessna '],
  ['ガルフストリーム ', 'Gulfstream '], ['ベル ', 'Bell '], ['ファミリー', ' family']]);
export const fleetEn = ja => { let t = String(ja || ''); for (const [a, b] of MAKER_EN) t = t.split(a).join(b); return /[ぁ-んァ-ヶ一-龥]/.test(t) ? '' : t; };

/* ── 欄だけでは言えない行の字（LINES）── 行の ID ごと。h はその行の台帳の指紋（変わると古い）。
   label … 画面の名前／value … 値（無ければ ITEM の言い方で値を作る）／cond … 前提の短い1行（無ければ出さない）
   lead  … その欄（勤務・待遇）のカードの1行めにする行（条件つきの行だけ）
   fleet … 機材の型式（会社の資料に載っている型式。機数は書かない）
   same  … 同じ話を言う、同じ会社のほかの行の ID（2026-10-23）。その行が同じ欄に出ているときは、この行を出さない
           （同じ話を2行で言わない ── 資料の強い・中身の細かい行を残す）。その行が出ない日は、この行が出る（airline-rollout.mjs） */
export const LINES = Object.freeze({
  /* ── カンタス航空 ── */
  'qantas.work.resume-training-facilities': { h: '7a56db8de960d3ad', label: '訓練の場所', value: 'ブリスベン・メルボルン・シドニー', cond: '会社の主な訓練の拠点', en: { label: 'Training locations', value: 'Brisbane, Melbourne and Sydney', cond: 'The company’s main training bases' } },
  'qantas.jobs.resume-academy-no-job-guarantee': { h: '803243cfa4d8fe32', label: '養成校を修了したあとの採用', value: '約束されていない', cond: 'Qantas Group Pilot Academy の案内（会社の答え）', en: { label: 'Hiring after the academy', value: 'Not guaranteed', cond: 'Qantas Group Pilot Academy guidance (the company’s answer)' } },
  'qantas.fleet.a380': { h: '39a559c3f4fa478d', fleet: 'エアバス A380', en: { fleet: 'Airbus A380' } },
  'qantas.fleet.b787': { h: '4003af454c0a0e8b', fleet: 'ボーイング 787-9', en: { fleet: 'Boeing 787-9' } },
  'qantas.fleet.pub-a321xlr-fleet': { h: '1d174874da2021c5', fleet: 'エアバス A321XLR', en: { fleet: 'Airbus A321XLR' } },
  'qantas.fleet.pub-a330-200-fleet': { h: '065e9da3e34dcc6a', fleet: 'エアバス A330-200', en: { fleet: 'Airbus A330-200' } },
  'qantas.fleet.pub-a330-300-fleet': { h: '9feeb0c044449c33', fleet: 'エアバス A330-300', en: { fleet: 'Airbus A330-300' } },
  'qantas.fleet.pub-b737-800-fleet': { h: '92188b925b40cf33', fleet: 'ボーイング 737-800', en: { fleet: 'Boeing 737-800' } },
  /* ── スカイマーク ── */
  'skymark.benefits.staff-travel': { h: 'e04f095532e3c2cf', label: '社員の航空券', value: '自社便の優待搭乗制度', cond: '自社養成パイロット訓練生の募集要項', lead: true, en: { label: 'Staff travel', value: 'Discounted travel on the company’s own flights', cond: 'Recruitment terms for company-sponsored cadets' } },
  'skymark.benefits.missing-annual-leave': { h: '2074a5e046a83080', label: '休暇', value: '年次有給休暇と、慶弔・育児・介護などの休暇', cond: '経験者の機長候補の募集要項。日数は書かれていない', en: { label: 'Leave', value: 'Paid annual leave, plus leave for family events, childcare and nursing care', cond: 'Recruitment terms for experienced captain candidates. The number of days is not stated' } },
  'skymark.benefits.missing-commuting': { h: 'ec79978e22358264', label: '通勤', value: '公共交通か車。早朝・深夜などはタクシーを使える', cond: '経験者の機長候補の募集要項', en: { label: 'Commuting', value: 'Public transport or car; taxis may be used for early-morning and late-night duties', cond: 'Recruitment terms for experienced captain candidates' } },
  'skymark.benefits.missing-medical': { h: '17a9a4b06151cd60', label: '保険', value: '社会保険・健康保険組合・団体長期障害所得補償保険', cond: '経験者の機長候補の募集要項', en: { label: 'Insurance', value: 'Social insurance, health insurance society and group long-term disability insurance', cond: 'Recruitment terms for experienced captain candidates' } },
  'skymark.jobs.cont-cadet-start': { h: '50fc5c46f7e86d6f', label: '自社養成の入社予定日', value: '2027年4月1日（または会社が指定する時期）', cond: '予定', en: { label: 'Cadet start date', value: '1 April 2027 (or a date the company sets)', cond: 'Planned' } },
  /* 2026-10-21 a2：年間休日の行（値の字は ITEM の言い方「年123日」・誰の条件かを1行） */
  'skymark.work.pub-experienced-days-off': { h: 'cf622b302915dfeb', label: '休日', cond: '経験者の機長候補の募集要項', en: { label: 'Days off', cond: 'Recruitment terms for experienced captain candidates' } },
  'skymark.work.cadet-hours': { h: '2873589c181b47d4', label: '訓練生の勤務時間', value: '週平均37.5時間以内（1か月単位の変形労働時間制）', cond: '自社養成パイロット訓練生の募集要項', en: { label: 'Cadet working hours', value: 'Within 37.5 hours a week on average (variable working hours on a monthly basis)', cond: 'Recruitment terms for company-sponsored cadets' } },
  /* 2026-10-21 d1：a2 の置き場の行（年金・勤務の組み方） */
  'skymark.benefits.missing-pension': { h: '8674c4d517d43ea1', label: '年金', value: '確定拠出年金', cond: '経験者の機長候補の募集要項', en: { label: 'Pension', value: 'Defined-contribution pension', cond: 'Recruitment terms for experienced captain candidates' } },
  'skymark.work.missing-roster-pattern': { h: '2957d27bf35b9c85', label: '勤務の形', value: '1か月単位の変形労働時間制（1日平均7.5時間・週平均37.5時間）', cond: '経験者の機長候補の募集要項', en: { label: 'Working pattern', value: 'Variable working hours on a monthly basis (7.5 hours a day and 37.5 hours a week on average)', cond: 'Recruitment terms for experienced captain candidates' } },
  'skymark.fleet.missing-fleet-types': { h: 'b9931e917624f38f', fleet: 'ボーイング 737-800', en: { fleet: 'Boeing 737-800' } },
  'skymark.fleet.pub-fleet-b737-8': { h: 'b930b2ada55bf942', fleet: 'ボーイング 737-8', en: { fleet: 'Boeing 737-8' } },
  /* ── 全社へ広げる d1（2026-10-21）：日本の会社。字は行の値と引用から（調べた側の字は使わない）。cond ＝ 誰の・どの資料の条件か ── */
  /* ZIPAIR（運航乗務員（機長要員・副操縦士要員）募集要項） */
  'zipair.benefits.cont-pilot-commuting': { h: '83a94a43b544047e', label: '通勤', value: '通勤手当', cond: '機長要員・副操縦士要員の募集要項', en: { label: 'Commuting', value: 'Commuting allowance', cond: 'Recruitment terms for captain and first officer candidates' } },
  'zipair.benefits.cont-pilot-disability': { h: '2dd45b2519cde5ee', label: '保険', value: '団体長期障害所得補償保険', cond: '機長要員・副操縦士要員の募集要項', en: { label: 'Insurance', value: 'Group long-term disability insurance', cond: 'Recruitment terms for captain and first officer candidates' } },
  'zipair.benefits.cont-pilot-pension': { h: '69c630f746663a17', label: '年金', value: '確定拠出年金', cond: '機長要員・副操縦士要員の募集要項', en: { label: 'Pension', value: 'Defined-contribution pension', cond: 'Recruitment terms for captain and first officer candidates' } },
  'zipair.benefits.missing-annual-leave': { h: '6324f8d0657f49f6', label: '休暇', value: '年次有給休暇・慶弔などの特別休暇', cond: '機長要員・副操縦士要員の募集要項。日数は書かれていない', en: { label: 'Leave', value: 'Paid annual leave and special leave for family events', cond: 'Recruitment terms for captain and first officer candidates. The number of days is not stated' } },
  'zipair.jobs.cont-pilot-contract': { h: 'bec953244c9acd1d', label: '雇用の形', value: '訓練中は有期契約、機長・副操縦士に発令後は正社員（60〜65歳は契約社員）', cond: '機長要員・副操縦士要員の募集要項', en: { label: 'Employment', value: 'Fixed-term contract during training; permanent employee once appointed captain or first officer (contract employee from 60 to 65)', cond: 'Recruitment terms for captain and first officer candidates' } },
  'zipair.jobs.cont-pilot-entry': { h: 'f7ccb16c9ea6a0e7', label: '募集の受付', value: '機長要員・副操縦士要員を募集中（締切の日付は無い）', cond: '会社の募集ページ（2026年10月19日に確認）', en: { label: 'Applications', value: 'Captain and first officer candidates are being recruited (no closing date)', cond: 'The company’s recruitment page (checked 19 October 2026)' } },
  'zipair.work.cont-pilot-roster': { h: 'c93c4987074ed36c', label: '勤務の形', value: '乗務・地上勤務に応じたシフト勤務（変形労働時間制）', cond: '機長要員・副操縦士要員の募集要項。土日祝日・深夜の勤務あり', en: { label: 'Working pattern', value: 'Shift work for flying and ground duties (variable working hours)', cond: 'Recruitment terms for captain and first officer candidates. Includes weekends, public holidays and night duties' } },
  'zipair.work.cont-pilot-training': { h: '768e708c073c766b', label: '訓練の場所', value: '国内か海外の訓練施設', cond: '機長要員・副操縦士要員の募集要項', en: { label: 'Training location', value: 'Training facilities in Japan or overseas', cond: 'Recruitment terms for captain and first officer candidates' } },
  /* ジェットスター・ジャパン（2026年の運航乗務員候補者 募集要項 ── 訓練生の募集。応募は2026年4月12日に締切）。
     待遇の3行は、名前が「訓練生の…」（訓練生の行は、名前が訓練の話でないと待遇のカードの1行めにならない ── 1行めが無いと、
     カードが「確認できていません」と言いながら開いた板に今の公表を並べてしまう。2026-10-21 d1 の続き） */
  'jetstar-japan.benefits.cont-foug-commuting': { h: '8f9f9ab64cf3f175', label: '訓練生の通勤', value: '通勤費（会社の規定による）', cond: '2026年の運航乗務員候補者（訓練生）の募集要項', en: { label: 'Cadet commuting', value: 'Commuting costs (under company rules)', cond: 'Recruitment terms for 2026 flight crew candidates (cadets)' } },
  'jetstar-japan.benefits.cont-foug-leave': { h: '11384d774359f6e5', label: '訓練生の休暇', value: '年次有給休暇・傷病休暇・慶弔などの特別休暇', cond: '2026年の運航乗務員候補者（訓練生）の募集要項。日数は書かれていない', en: { label: 'Cadet leave', value: 'Paid annual leave, sick leave and special leave for family events', cond: 'Recruitment terms for 2026 flight crew candidates (cadets). The number of days is not stated' } },
  'jetstar-japan.benefits.missing-medical': { h: '937efdd6df4733c1', label: '訓練生の保険', value: '社会保険', cond: '2026年の運航乗務員候補者（訓練生）の募集要項', en: { label: 'Cadet insurance', value: 'Social insurance', cond: 'Recruitment terms for 2026 flight crew candidates (cadets)' } },
  'jetstar-japan.jobs.cont-foug-employment': { h: 'e147a5cbad7fd9bb', label: '雇用の形', value: '契約社員。所定の訓練を終えると正社員に登用', cond: '2026年の運航乗務員候補者（訓練生）の募集要項', en: { label: 'Employment', value: 'Contract employee; becomes a permanent employee after completing the set training', cond: 'Recruitment terms for 2026 flight crew candidates (cadets)' } },
  'jetstar-japan.jobs.foug-closed': { h: '347b3c3340b595da', label: '募集の受付', value: '締め切った（2026年4月12日必着）', cond: '2026年の運航乗務員候補者（訓練生）の募集要項', en: { label: 'Applications', value: 'Closed (applications had to arrive by 12 April 2026)', cond: 'Recruitment terms for 2026 flight crew candidates (cadets)' } },
  'jetstar-japan.work.missing-roster-pattern': { h: '74f6affe32599982', label: '訓練生の勤務の形', value: '変則勤務（土日祝日も勤務）', cond: '2026年の運航乗務員候補者（訓練生）の募集要項', en: { label: 'Cadet working pattern', value: 'Irregular shifts (including weekends and public holidays)', cond: 'Recruitment terms for 2026 flight crew candidates (cadets)' } },
  'jetstar-japan.work.training-locations': { h: '1b7b2ea16dc12ee1', label: '訓練の場所', value: '日本国内と、ソウル・クアラルンプールなど海外の訓練施設', cond: '2026年の運航乗務員候補者（訓練生）の募集要項', en: { label: 'Training locations', value: 'Japan, and training facilities abroad such as Seoul and Kuala Lumpur', cond: 'Recruitment terms for 2026 flight crew candidates (cadets)' } },
  /* Peach（運航乗務員の募集一覧 ── 機長の募集） */
  'peach.benefits.cont-captain-insurance': { h: 'd5565aac8b2ee008', label: '保険', value: '社会保険・団体長期障害所得補償保険など', cond: '機長の募集要項', en: { label: 'Insurance', value: 'Social insurance, group long-term disability insurance and more', cond: 'Captain recruitment terms' } },
  'peach.benefits.cont-captain-pension': { h: '773ddd9316056c15', label: '年金', value: '選択制の確定拠出年金', cond: '機長の募集要項', en: { label: 'Pension', value: 'Optional defined-contribution pension', cond: 'Captain recruitment terms' } },
  'peach.benefits.cont-captain-travel': { h: '9db39abbc45d61e3', label: '社員の航空券', value: '社員優待搭乗制度', cond: '機長の募集要項', en: { label: 'Staff travel', value: 'Staff discounted travel', cond: 'Captain recruitment terms' } },
  'peach.benefits.missing-annual-leave': { h: '5ac9aa60678a44c3', label: '休暇', value: '年次有給休暇（法定どおり）・リフレッシュ休暇・特別休暇', cond: '機長の募集要項。日数は書かれていない', en: { label: 'Leave', value: 'Paid annual leave (as the law sets), refresh leave and special leave', cond: 'Captain recruitment terms. The number of days is not stated' } },
  'peach.jobs.cont-captain-contract': { h: 'cc802213220bfcff', label: '雇用の形', value: '初期訓練中は有期、機長に発令後は65歳まで無期、65歳からは1年ごとの契約で68歳まで', cond: '機長の募集要項', en: { label: 'Employment', value: 'Fixed-term during initial training; open-ended to 65 once appointed captain, then one-year contracts up to 68', cond: 'Captain recruitment terms' } },
  'peach.jobs.cont-challenge-closed': { h: 'a9119d9f8e97a872', label: '募集の受付', value: 'パイロットチャレンジ生（プレエントリー）は受付終了', cond: '会社の募集一覧（2026年10月19日に確認）', en: { label: 'Applications', value: 'Pilot Challenge (pre-entry) applications have closed', cond: 'The company’s recruitment list (checked 19 October 2026)' } },
  'peach.jobs.missing-entry-open': { h: '01d059fb79a3c2bc', label: '募集の受付', value: '機長の募集は、定員に達し次第締め切り', cond: '会社の募集一覧（2026年10月19日に確認）', en: { label: 'Applications', value: 'Captain recruitment closes once places are filled', cond: 'The company’s recruitment list (checked 19 October 2026)' } },
  'peach.work.cont-captain-roster': { h: '72f647d31b6e2e3f', label: '勤務の形', value: '乗務・地上勤務に応じたシフト勤務（変形労働時間制）', cond: '機長の募集要項。土日祝日・深夜・早朝の勤務あり', en: { label: 'Working pattern', value: 'Shift work for flying and ground duties (variable working hours)', cond: 'Captain recruitment terms. Includes weekends, public holidays, night and early-morning duties' } },
  'peach.work.missing-training-location': { h: '4d0c1adb3d60e03b', label: '訓練の場所', value: '訓練の委託先と、会社が決める場所', cond: '機長の募集要項', en: { label: 'Training location', value: 'The contracted training provider and places the company decides', cond: 'Captain recruitment terms' } },
  /* ソラシドエア（中途採用 運航乗務員（機長要員）） */
  'solaseed.benefits.missing-annual-leave': { h: '142e40e977e7ddbf', label: '休暇', value: '年次有給休暇・季節休暇・赴任休暇・慶弔などの特別休暇', cond: '機長要員の募集要項。日数は書かれていない', en: { label: 'Leave', value: 'Paid annual leave, seasonal leave, relocation leave and special leave for family events', cond: 'Recruitment terms for captain candidates. The number of days is not stated' } },
  'solaseed.benefits.missing-medical': { h: '1dfbca0f00c5c205', label: '保険', value: '社会保険・メンタルヘルスケア・休業時の所得補償保険', cond: '機長要員の募集要項', en: { label: 'Insurance', value: 'Social insurance, mental health care and income protection insurance for time off work', cond: 'Recruitment terms for captain candidates' } },
  'solaseed.benefits.missing-pension': { h: 'b5001bbdee4ecea9', label: '年金', value: '厚生年金と企業型確定拠出年金', cond: '機長要員の募集要項', en: { label: 'Pension', value: 'Employees’ pension and a corporate defined-contribution pension', cond: 'Recruitment terms for captain candidates' } },
  'solaseed.benefits.missing-staff-travel': { h: 'abe848e6f69c9471', label: '社員の航空券', value: '自社便の社員優待搭乗制度', cond: '機長要員の募集要項', en: { label: 'Staff travel', value: 'Staff discounted travel on the company’s own flights', cond: 'Recruitment terms for captain candidates' } },
  'solaseed.jobs.missing-entry-open': { h: '95404671724bf6cb', label: '募集の受付', value: '書類が届き次第選考（締切の日付は無い）', cond: '機長要員の募集（2026年10月19日に確認）', en: { label: 'Applications', value: 'Selection starts as applications arrive (no closing date)', cond: 'Captain candidate recruitment (checked 19 October 2026)' } },
  'solaseed.work.missing-roster-pattern': { h: 'a361bdf94d501c74', label: '勤務の形', value: '土日祝日を含む変則勤務（早朝・深夜あり）', cond: '機長要員の募集要項', en: { label: 'Working pattern', value: 'Irregular shifts including weekends and public holidays (early-morning and late-night duties)', cond: 'Recruitment terms for captain candidates' } },
  /* AIRDO */
  'airdo.benefits.travel': { h: 'e464d301fbaaaacc', label: '社員の航空券', value: '自社便と他社便の優待搭乗制度', cond: '運航乗務員（機長）の募集要項', lead: true, en: { label: 'Staff travel', value: 'Discounted travel on the company’s own and other airlines’ flights', cond: 'Recruitment terms for flight crew (captains)' } },
  'airdo.jobs.cont-experienced-closed': { h: '777842bf7a1b01c5', label: '募集の受付', value: '経験者の機長・副操縦士の募集は2026年9月1日から停止', cond: '運航乗務員採用のお知らせ', en: { label: 'Applications', value: 'Recruitment of experienced captains and first officers stopped on 1 September 2026', cond: 'Flight crew recruitment notice' } },
  /* スターフライヤー（運航乗務員の募集要項 ── 機長・副操縦士） */
  'starflyer.benefits.missing-annual-leave': { h: 'ef4bbe7d664f359f', label: '休暇', value: '年次有給休暇・産前産後休暇・育児休暇・介護休暇', cond: '機長・副操縦士の募集要項。日数は書かれていない', en: { label: 'Leave', value: 'Paid annual leave, maternity leave, childcare leave and nursing-care leave', cond: 'Recruitment terms for captains and first officers. The number of days is not stated' } },
  'starflyer.benefits.missing-medical': { h: 'fe07b19ec0766210', label: '保険', value: '社会保険・定期健康診断・団体長期障害所得補償保険', cond: '機長・副操縦士の募集要項', en: { label: 'Insurance', value: 'Social insurance, regular health checks and group long-term disability insurance', cond: 'Recruitment terms for captains and first officers' } },
  'starflyer.benefits.missing-pension': { h: '460c7eabcf691755', label: '年金', value: '確定拠出年金', cond: '機長・副操縦士の募集要項', en: { label: 'Pension', value: 'Defined-contribution pension', cond: 'Recruitment terms for captains and first officers' } },
  'starflyer.benefits.missing-staff-travel': { h: 'f65dc04a42aea643', label: '社員の航空券', value: '自社便とANA便の社員優待搭乗', cond: '機長・副操縦士の募集要項', en: { label: 'Staff travel', value: 'Staff discounted travel on the company’s own and ANA flights', cond: 'Recruitment terms for captains and first officers' } },
  'starflyer.jobs.cont-cap-contract': { h: '2713040cc6d1ac95', label: '雇用の形', value: '60歳未満は無期。60歳からは2027年3月31日までの契約（更新することがあり、68歳まで）', cond: '機長の募集要項', en: { label: 'Employment', value: 'Open-ended under 60; from 60, contracts to 31 March 2027 (may be renewed, up to 68)', cond: 'Captain recruitment terms' } },
  'starflyer.jobs.cont-current-pilot-jobs': { h: 'c6039bf1d57208ba', label: '募集の受付', value: 'A320の限定を持つ副操縦士候補と、機長候補を募集中', cond: '中途採用・現在募集中の職種（2026年10月19日に確認）', en: { label: 'Applications', value: 'First officer candidates with an A320 type rating and captain candidates are being recruited', cond: 'Current mid-career openings (checked 19 October 2026)' } },
  'starflyer.work.cont-co-pilot-hours': { h: 'e4e8d07a812ba8cd', label: '副操縦士の勤務時間', value: '1か月単位の変形労働時間制（月平均で週40時間以内）', cond: '副操縦士の募集要項', en: { label: 'First officer working hours', value: 'Variable working hours on a monthly basis (within 40 hours a week on a monthly average)', cond: 'First officer recruitment terms' } },
  'starflyer.work.cont-pilot-hours': { h: '4fe2550d3a88bf31', label: '機長の勤務時間', value: '1か月単位の変形労働時間制（月平均で週40時間以内）', cond: '機長の募集要項', en: { label: 'Captain working hours', value: 'Variable working hours on a monthly basis (within 40 hours a week on a monthly average)', cond: 'Captain recruitment terms' } },
  'starflyer.work.missing-roster-pattern': { h: 'b5c5ba58198ea84c', label: '勤務の形', value: 'シフト勤務（1か月単位の変形労働時間制）', cond: '機長・副操縦士の募集要項', en: { label: 'Working pattern', value: 'Shift work (variable working hours on a monthly basis)', cond: 'Recruitment terms for captains and first officers' } },
  'starflyer.work.missing-training-location': { h: '696321482118038b', label: '訓練の場所', value: '北九州空港の施設', cond: '機長・副操縦士の募集要項', en: { label: 'Training location', value: 'Facilities at Kitakyushu Airport', cond: 'Recruitment terms for captains and first officers' } },
  /* フジドリームエアラインズ（採用サイトの福利厚生 ＝ 全職種／他社経験者の機長候補の求人） */
  'fda.benefits.cont-general-family-travel': { h: '243e130ca5fd0c24', label: '社員の航空券', value: '社員と家族の自社便の優待', cond: '採用サイトの福利厚生（全職種）', en: { label: 'Staff travel', value: 'Discounted travel on the company’s own flights for staff and family', cond: 'Benefits on the recruitment site (all roles)' } },
  'fda.benefits.cont-general-housing': { h: '990e053fd590a1c8', label: '住宅の補助', value: '住宅手当', cond: '採用サイトの福利厚生（全職種）。パイロットへの適用と額は書かれていない', en: { label: 'Housing allowance', value: 'Housing allowance', cond: 'Benefits on the recruitment site (all roles). Whether it applies to pilots, and the amount, are not stated' } },
  'fda.benefits.missing-annual-leave': { h: '5483daad32c9124f', label: '休暇', value: '有給休暇・リフレッシュ休暇・育児休暇', cond: '採用サイトの福利厚生（全職種）。日数は書かれていない', en: { label: 'Leave', value: 'Paid leave, refresh leave and childcare leave', cond: 'Benefits on the recruitment site (all roles). The number of days is not stated' } },
  'fda.benefits.missing-medical': { h: '24587dd210cab51c', label: '保険', value: '健康保険', cond: '他社経験者の機長候補の求人', en: { label: 'Insurance', value: 'Health insurance', cond: 'Vacancy for captain candidates with experience at another airline' } },
  'fda.benefits.missing-pension': { h: '6f6ae266e09b3385', label: '年金', value: '選択制の確定拠出年金（月給の中から月2万円までを積み立て。選ばない分は毎月支給）', cond: '他社経験者の機長候補の求人', en: { label: 'Pension', value: 'Optional defined-contribution pension (up to ¥20,000 a month from salary; any part not chosen is paid each month)', cond: 'Vacancy for captain candidates with experience at another airline' } },
  'fda.jobs.missing-entry-open': { h: '19bbdaaafd7ac456', label: '募集の受付', value: '他社経験者の機長候補と副操縦士候補の2件を募集中', cond: '会社の採用サイトの一覧（2026年10月19日に確認）', en: { label: 'Applications', value: 'Two openings: captain candidates and first officer candidates with experience at another airline', cond: 'The company’s recruitment site list (checked 19 October 2026)' } },
  /* AirJapan（海外に住む機長・副操縦士の、派遣会社を通した募集） */
  'airjapan.benefits.missing-commuting': { h: 'c525d4964c6ca435', label: '通勤', value: '通勤の手当と、会社が手配する航空券（他社便のエコノミーかANA運航便のビジネス）', cond: '海外に住む機長・副操縦士の、派遣会社を通した募集', en: { label: 'Commuting', value: 'A commuting allowance and tickets the company arranges (economy on other airlines or business on ANA-operated flights)', cond: 'Recruitment of captains and first officers living abroad, through an agency' } },
  'airjapan.jobs.overseas-agency': { h: 'e08827f3e3183ff4', label: '雇用の形', value: '海外に住む人は直接雇わず、派遣会社を通して契約', cond: '海外に住む機長・副操縦士の、派遣会社を通した募集', en: { label: 'Employment', value: 'People living abroad are not hired directly; they are contracted through an agency', cond: 'Recruitment of captains and first officers living abroad, through an agency' } },
  'airjapan.work.cont-agency-roster': { h: '8a28213b554193a3', label: '勤務の形', value: '月に連続10日の休みと、通勤の2日', cond: '海外に住む機長・副操縦士の、派遣会社を通した募集', en: { label: 'Working pattern', value: '10 consecutive days off a month, plus 2 days for commuting', cond: 'Recruitment of captains and first officers living abroad, through an agency' } },
  /* 天草エアライン（運航乗務員（機長）の募集要項） */
  'amx.benefits.missing-annual-leave': { h: 'cb3f1165aa75d3f0', label: '休暇', value: '有給休暇・慶弔などの特別休暇', cond: '運航乗務員（機長）の募集要項。日数は書かれていない', en: { label: 'Leave', value: 'Paid leave and special leave for family events', cond: 'Recruitment terms for flight crew (captains). The number of days is not stated' } },
  'amx.benefits.missing-medical': { h: '2db9019158031dbf', label: '保険', value: '各種社会保険', cond: '運航乗務員（機長）の募集要項', en: { label: 'Insurance', value: 'Social insurance', cond: 'Recruitment terms for flight crew (captains)' } },
  'amx.benefits.pension': { h: '968a4e2f3d55dcae', label: '退職金', value: '退職金制度', cond: '運航乗務員（機長）の募集要項', en: { label: 'Retirement allowance', value: 'Retirement allowance scheme', cond: 'Recruitment terms for flight crew (captains)' } },
  'amx.jobs.cont-captain-contract': { h: 'b99c036f035babed', label: '雇用の形', value: '正社員（60歳からは嘱託）。機長任用の訓練中は契約社員', cond: '運航乗務員（機長）の募集要項', en: { label: 'Employment', value: 'Permanent employee (re-employed on contract from 60); contract employee during captain upgrade training', cond: 'Recruitment terms for flight crew (captains)' } },
  'amx.jobs.missing-entry-open': { h: '9e67e48abc087a20', label: '募集の受付', value: '機長の募集要項を掲載中（締切と募集の年は書かれていない）', cond: '会社の採用ページ', en: { label: 'Applications', value: 'Captain recruitment terms are posted (no closing date or year stated)', cond: 'The company’s recruitment page' } },
  /* ANAウイングス（2027年度入社 自社養成パイロットの募集要項／会社の福利厚生の案内） */
  'ana-wings.benefits.missing-commuting': { h: 'dd6c65164b4cfaac', label: '通勤', value: '通勤補助費（会社の規定による）', cond: '2027年度入社の自社養成パイロットの募集要項', en: { label: 'Commuting', value: 'Commuting allowance (under company rules)', cond: 'Recruitment terms for company-sponsored pilots joining in fiscal 2027' } },
  'ana-wings.benefits.missing-housing': { h: '3e3f4a7569db353b', label: '住宅の補助', value: '社宅・寮か住宅手当（職種によって違う）', cond: '会社の福利厚生の案内（全職種）', en: { label: 'Housing allowance', value: 'Company housing or dormitory, or a housing allowance (varies by role)', cond: 'The company’s benefits guide (all roles)' } },
  'ana-wings.benefits.missing-medical': { h: '581ef4a70882d3ae', label: '保険', value: '社会保険', cond: '2027年度入社の自社養成パイロットの募集要項', en: { label: 'Insurance', value: 'Social insurance', cond: 'Recruitment terms for company-sponsored pilots joining in fiscal 2027' } },
  'ana-wings.benefits.missing-pension': { h: '4c8b56e79f7e1d97', label: '年金', value: '確定拠出年金', cond: '会社の福利厚生の案内（全職種）', en: { label: 'Pension', value: 'Defined-contribution pension', cond: 'The company’s benefits guide (all roles)' } },
  'ana-wings.benefits.travel': { h: '0092f1a496ec055c', label: '社員の航空券', value: '国内線・国際線の優待搭乗制度', cond: '2027年度入社の自社養成パイロットの募集要項', en: { label: 'Staff travel', value: 'Discounted travel on domestic and international flights', cond: 'Recruitment terms for company-sponsored pilots joining in fiscal 2027' } },
  'ana-wings.jobs.captain-planned': { h: 'e2b33245fd948773', label: '募集の受付', value: '経験者の機長の本エントリーは11月末に始まる予定', cond: 'パイロット経験者採用のお知らせ', en: { label: 'Applications', value: 'Full entry for experienced captains is planned to open at the end of November', cond: 'Experienced pilot recruitment notice' } },
  'ana-wings.jobs.cont-cadet-contract': { h: '323537440d67b4f6', label: '雇用の形', value: '期間の定めのない正社員（試用期間は原則3か月）', cond: '2027年度入社の自社養成パイロットの募集要項', en: { label: 'Employment', value: 'Permanent employee with no fixed term (probation normally 3 months)', cond: 'Recruitment terms for company-sponsored pilots joining in fiscal 2027' } },
  'ana-wings.jobs.entry-2027-closed': { h: '4b49edcc4597a881', label: '募集の受付', value: '2027年度入社の自社養成の受付は終了', cond: '2027年度入社の自社養成パイロットの募集要項', en: { label: 'Applications', value: 'Company-sponsored applications for fiscal 2027 have closed', cond: 'Recruitment terms for company-sponsored pilots joining in fiscal 2027' } },
  'ana-wings.work.cont-cadet-training': { h: '49791e43406fec88', label: '訓練の流れ', value: 'ほかの職種の研修（約1年）→ 海外か国内で基礎訓練 → 型式・路線の訓練 → 副操縦士の審査', cond: '2027年度入社の自社養成パイロットの募集要項', en: { label: 'Training path', value: 'Training in other roles (about a year) → basic training abroad or in Japan → type and line training → first officer check', cond: 'Recruitment terms for company-sponsored pilots joining in fiscal 2027' } },
  'ana-wings.work.roster': { h: '649772b8b29975b7', label: '勤務の形', value: 'シフト勤務（乗務に合わせて組む。土日祝日・早朝・深夜・宿泊を伴う勤務あり）', cond: '2027年度入社の自社養成パイロットの募集要項', en: { label: 'Working pattern', value: 'Shift work built around flying (includes weekends, public holidays, early-morning and late-night duties and overnight stays)', cond: 'Recruitment terms for company-sponsored pilots joining in fiscal 2027' } },
  /* 第一航空 */
  'daiichi-air.jobs.cont-fixed-jobs': { h: 'b463ca30ea6485d1', label: '募集の受付', value: '固定翼の事業用操縦士以上（運航管理も兼務）を募集中（入社時期は相談）', cond: '会社の採用情報', en: { label: 'Applications', value: 'Fixed-wing commercial pilots and above (also handling flight dispatch) are being recruited (start date negotiable)', cond: 'The company’s recruitment information' } },
  /* 北海道エアシステム */
  'hac.jobs.cont-pilot-job-closed': { h: '37d6de22fc648dec', label: '募集の受付', value: '運航乗務員は今は募集していない', cond: '会社の採用情報（2026年10月19日に確認）', en: { label: 'Applications', value: 'Flight crew are not being recruited now', cond: 'The company’s recruitment information (checked 19 October 2026)' } },
  'hac.work.missing-roster-pattern': { h: '2e3a6222a86635dc', label: '副操縦士の勤務の例', value: '遅番の1日：12:40に出社、丘珠発着で函館・釧路の5便、20:30に勤務終了', cond: '会社の採用情報に載っている1日の例', en: { label: 'A first officer’s day (example)', value: 'Late shift: report at 12:40, five flights from Okadama to Hakodate and Kushiro, duty ends at 20:30', cond: 'An example day in the company’s recruitment information' } },
  /* IBEXエアラインズ（副操縦士要員（未経験者）の募集要項／採用サイトの制度の案内 ＝ 全職種） */
  'ibex.benefits.cont-fo-leave': { h: 'c9006d82b1d025db', label: '休暇', value: '年次有給休暇・フレックス休暇（年3日）・慶弔・育児・介護・傷病の休暇', cond: '副操縦士要員（未経験者）の募集要項', en: { label: 'Leave', value: 'Paid annual leave, flex leave (3 days a year) and leave for family events, childcare, nursing care and illness', cond: 'Recruitment terms for first officer candidates (no experience)' } },
  'ibex.benefits.missing-housing': { h: '2c91bbb1bcc25025', label: '住宅の補助', value: '住宅手当', cond: '採用サイトの制度の案内（全職種）', en: { label: 'Housing allowance', value: 'Housing allowance', cond: 'Schemes on the recruitment site (all roles)' } },
  'ibex.benefits.missing-medical': { h: '9a4905819d2c92b0', label: '保険', value: '社会保険・予防接種の費用の補助・定期健康診断', cond: '採用サイトの制度の案内（全職種）', en: { label: 'Insurance', value: 'Social insurance, help with vaccination costs and regular health checks', cond: 'Schemes on the recruitment site (all roles)' } },
  'ibex.benefits.missing-pension': { h: '5401c4f07f5d449c', label: '年金', value: '厚生年金', cond: '採用サイトの制度の案内（全職種）', en: { label: 'Pension', value: 'Employees’ pension', cond: 'Schemes on the recruitment site (all roles)' } },
  'ibex.benefits.missing-staff-travel': { h: '2a96c2269b6fd568', label: '社員の航空券', value: '社員優待搭乗', cond: '採用サイトの制度の案内（全職種）', en: { label: 'Staff travel', value: 'Staff discounted travel', cond: 'Schemes on the recruitment site (all roles)' } },
  'ibex.jobs.cont-fo-contract': { h: 'fb815d35f108369b', label: '雇用の形', value: '副操縦士任用の訓練が終わるまでは有期、副操縦士に発令後は正社員', cond: '副操縦士要員（未経験者）の募集要項', en: { label: 'Employment', value: 'Fixed-term until first officer upgrade training ends; permanent employee once appointed first officer', cond: 'Recruitment terms for first officer candidates (no experience)' } },
  'ibex.jobs.cont-fo-open': { h: 'd6e3732f71b31c90', label: '募集の受付', value: '2026年10月30日必着（入社は2027年4月1日以降の予定）', cond: '副操縦士要員（未経験者）の募集要項', en: { label: 'Applications', value: 'Must arrive by 30 October 2026 (joining planned from 1 April 2027)', cond: 'Recruitment terms for first officer candidates (no experience)' } },
  'ibex.work.cont-fo-work': { h: 'a69e13f80bf49544', label: '訓練生の勤務の形', value: '変形労働時間制（1か月単位）', cond: '副操縦士要員（未経験者）の募集要項', en: { label: 'Cadet working pattern', value: 'Variable working hours (on a monthly basis)', cond: 'Recruitment terms for first officer candidates (no experience)' } },
  /* ジェイエア */
  'j-air.jobs.cadet-closed': { h: '0bcfc3110e1e3640', label: '募集の受付', value: '自社養成の募集は終了（前回の要項を参考に掲載）', cond: '運航乗務員の募集要項', en: { label: 'Applications', value: 'Company-sponsored recruitment has closed (the last terms are shown for reference)', cond: 'Flight crew recruitment terms' } },
  /* 日本エアコミューター（運航乗務員（副操縦士要員）の募集要項。今年度の募集は終了） */
  'jac.benefits.housing-none': { h: 'a1a65c8221cbe657', label: '社宅・寮', value: '会社が持つ社宅・寮は無い', cond: '運航乗務員の募集要項', en: { label: 'Company housing', value: 'The company has no housing or dormitories of its own', cond: 'Flight crew recruitment terms' } },
  'jac.benefits.missing-annual-leave': { h: '76a1ac49b58d54df', label: '休暇', value: '年次有給休暇と特別休暇', cond: '運航乗務員の募集要項（今年度の募集は終了）。日数は書かれていない', en: { label: 'Leave', value: 'Paid annual leave and special leave', cond: 'Flight crew recruitment terms (this year’s recruitment has closed). The number of days is not stated' } },
  'jac.benefits.missing-medical': { h: 'c6cc31e1a2f59b15', label: '保険', value: '日本航空健康保険組合・厚生年金・雇用保険・労災保険', cond: '運航乗務員の募集要項（今年度の募集は終了）', en: { label: 'Insurance', value: 'Japan Airlines Health Insurance Society, employees’ pension, employment insurance and workers’ accident insurance', cond: 'Flight crew recruitment terms (this year’s recruitment has closed)' } },
  'jac.jobs.cont-fo-closed': { h: 'f706389a0616cf73', label: '募集の受付', value: '今年度の募集は終了（前回の要項を参考に掲載）', cond: '運航乗務員の募集要項', en: { label: 'Applications', value: 'This year’s recruitment has closed (the last terms are shown for reference)', cond: 'Flight crew recruitment terms' } },
  'jac.work.training-kagoshima': { h: 'b6f311b5c2799e66', label: '訓練の場所', value: '鹿児島', cond: '運航乗務員の募集要項', en: { label: 'Training location', value: 'Kagoshima', cond: 'Flight crew recruitment terms' } },
  /* 日本トランスオーシャン航空（2026年度 機長候補者の募集要項。受付は2026年9月30日に終了） */
  'jta.benefits.missing-annual-leave': { h: '87fb70f6e5a794c5', label: '休暇', value: '年次有給休暇・夏季休暇・慶弔などの特別休暇', cond: '2026年度の機長候補者の募集要項（受付は終了）。日数は書かれていない', en: { label: 'Leave', value: 'Paid annual leave, summer leave and special leave for family events', cond: 'Recruitment terms for fiscal 2026 captain candidates (closed). The number of days is not stated' } },
  'jta.benefits.missing-medical': { h: '66ba9922a26dfcc8', label: '保険', value: '各種社会保険・日本航空健康保険組合・LOL制度', cond: '2026年度の機長候補者の募集要項（受付は終了）', en: { label: 'Insurance', value: 'Social insurance, Japan Airlines Health Insurance Society and loss-of-licence (LOL) cover', cond: 'Recruitment terms for fiscal 2026 captain candidates (closed)' } },
  'jta.benefits.missing-staff-travel': { h: 'e4b3858321ecfbcd', label: '社員の航空券', value: 'JALレジャートラベル制度', cond: '2026年度の機長候補者の募集要項（受付は終了）', en: { label: 'Staff travel', value: 'JAL leisure travel scheme', cond: 'Recruitment terms for fiscal 2026 captain candidates (closed)' } },
  'jta.jobs.captain-deadline': { h: '6a5da642eb844b68', label: '募集の受付', value: '2026年9月30日に締め切った', cond: '2026年度の機長候補者の募集要項', en: { label: 'Applications', value: 'Closed on 30 September 2026', cond: 'Recruitment terms for fiscal 2026 captain candidates' } },
  'jta.work.missing-roster-pattern': { h: 'c98a2e09b19a1068', label: '勤務の形', value: '土日祝日を含む変則勤務', cond: '2026年度の機長候補者の募集要項（受付は終了）', en: { label: 'Working pattern', value: 'Irregular shifts including weekends and public holidays', cond: 'Recruitment terms for fiscal 2026 captain candidates (closed)' } },
  /* オリエンタルエアブリッジ */
  'orc.jobs.cont-rotor-job': { h: 'eed0f858ce645ae6', label: '募集の受付', value: '回転翼の操縦士（機長）を募集', cond: '会社の採用情報', en: { label: 'Applications', value: 'Rotary-wing pilots (captains) are being recruited', cond: 'The company’s recruitment information' } },
  /* 琉球エアーコミューター */
  'rac.jobs.cont-current-job-closed': { h: '696368088857df24', label: '募集の受付', value: '今は募集していない', cond: '会社の求人情報（2026年10月19日に確認）', en: { label: 'Applications', value: 'Not recruiting now', cond: 'The company’s job information (checked 19 October 2026)' } },
  'rac.jobs.cont-trainee-deadline': { h: '98eeb73e0ec43eeb', label: '訓練生の募集', value: '2026年5月15日に締め切った（入社は7月1日以降の予定）', cond: '2026年度の訓練生の募集（事業用・多発・計器の資格を持つ人）', en: { label: 'Cadet applications', value: 'Closed on 15 May 2026 (joining planned from 1 July)', cond: 'Fiscal 2026 cadet recruitment (holders of commercial, multi-engine and instrument ratings)' } },
  'rac.work.cont-scholarship-bond': { h: '34a277f4bf3c6f6b', label: '奨学金の返還', value: '資格を取ってパイロットとして入社し、一定の期間勤めると、自己負担分を除いて返還を免除', cond: '2026年度の奨学金の募集（沖縄県内の大学などの学生）', en: { label: 'Scholarship repayment', value: 'Repayment is waived, except the student’s own share, for those who qualify, join as a pilot and serve a set period', cond: 'Fiscal 2026 scholarship recruitment (university and other students in Okinawa)' } },
  'rac.work.missing-roster-pattern': { h: 'b332de5c421364c9', label: '1日の乗務', value: '1日に4〜6便を担当', cond: '運航乗員部門の紹介', en: { label: 'Flights in a day', value: '4 to 6 flights a day', cond: 'Introduction of the flight crew department' } },
  'rac.work.missing-upgrade-years': { h: '4c0ad3fe6eb56a9b', label: '機長への昇格の例', value: '副操縦士に発令後5〜6年で機長になった人もいる', cond: '人事担当のQ&A（例であり、決まった年数ではない）', en: { label: 'Upgrade to captain (example)', value: 'Some became captain 5 to 6 years after being appointed first officer', cond: 'Q&A by the HR team (an example, not a set number of years)' } },
  /* 新中央航空（セスナ172P型機の機長・操縦訓練教官の募集 ── 竜ヶ崎飛行場の事業所。応募は2026年10月15日に締切） */
  'shin-central.benefits.r2-c172-retirement': { h: 'db69a1c87a91133d', label: '退職金', value: '退職金制度', cond: 'セスナ172P型機の機長・操縦訓練教官の募集（竜ヶ崎）', en: { label: 'Retirement allowance', value: 'Retirement allowance scheme', cond: 'Recruitment of Cessna 172P captains and flight instructors (Ryugasaki)' } },
  'shin-central.benefits.r2-c172-social-insurance': { h: 'c054c022692e6b9a', label: '保険', value: '各種の社会保険（健康保険、厚生年金、雇用保険、労災保険）', cond: 'セスナ172P型機の機長・操縦訓練教官の募集（竜ヶ崎）', en: { label: 'Insurance', value: 'Social insurance (health insurance, employees’ pension, employment insurance and workers’ accident insurance)', cond: 'Recruitment of Cessna 172P captains and flight instructors (Ryugasaki)' } },
  'shin-central.work.r2-c172-holidays': { h: '39ca502e76b255c4', label: '機長の休日', value: '月9日（年間休日118日以上）', cond: 'セスナ172P型機の機長・操縦訓練教官の募集（竜ヶ崎）', en: { label: 'Captain days off', value: '9 days a month (118 or more days off a year)', cond: 'Recruitment of Cessna 172P captains and flight instructors (Ryugasaki)' } },
  /* 新日本航空 */
  'shin-nihon.jobs.cont-instructor-closed': { h: '8450e4e74c129159', label: '募集の受付', value: '事業用操縦士（教官）の募集は終了', cond: '鹿児島本社運航所の採用情報', en: { label: 'Applications', value: 'Recruitment of commercial pilots (instructors) has closed', cond: 'Recruitment information of the Kagoshima head-office operations base' } },
  /* 東邦航空（中途採用の操縦士募集） */
  'toho-air.jobs.cont-pilot-current-job': { h: 'be4196383f468ed3', label: '募集の受付', value: '操縦士を若干名（採用が決まり次第終了）', cond: '中途採用の操縦士募集', en: { label: 'Applications', value: 'A few pilots (closes once hired)', cond: 'Mid-career pilot recruitment' } },
  'toho-air.work.cont-pilot-training': { h: '8f93c3d3464118ac', label: '訓練', value: '機体のライセンスを取り、OJTで技能を身につける', cond: '中途採用の操縦士募集', en: { label: 'Training', value: 'Obtain the aircraft licence and build skills through on-the-job training', cond: 'Mid-career pilot recruitment' } },
  'toho-air.work.cont-pilot-work': { h: '8879f351157450c6', label: '勤務時間', value: '担当する事業によって変わる', cond: '中途採用の操縦士募集', en: { label: 'Working hours', value: 'Depend on the operation flown', cond: 'Mid-career pilot recruitment' } },
  /* トキエア（運航乗務員候補（機長）の募集要項） */
  'toki-air.benefits.cont-captain-commuting': { h: '8bb30366ad046167', label: '通勤', value: '通勤費の規程と、コミューティング制度', cond: '機長候補の募集要項', en: { label: 'Commuting', value: 'Commuting cost rules and a commuting scheme', cond: 'Recruitment terms for captain candidates' } },
  'toki-air.benefits.cont-captain-housing': { h: '9ae3205beb43ea8d', label: '住宅の補助', value: '住宅手当', cond: '機長候補の募集要項', en: { label: 'Housing allowance', value: 'Housing allowance', cond: 'Recruitment terms for captain candidates' } },
  'toki-air.benefits.missing-annual-leave': { h: '20802573dd0a7872', label: '休暇', value: '年次有給休暇・年末年始・傷病・結婚・忌引・転勤などの特別休暇', cond: '機長候補の募集要項。日数は書かれていない', en: { label: 'Leave', value: 'Paid annual leave, year-end leave and special leave for illness, marriage, bereavement and transfers', cond: 'Recruitment terms for captain candidates. The number of days is not stated' } },
  'toki-air.benefits.missing-pension': { h: '9a7484b31049b5c2', label: '年金', value: '厚生年金', cond: '機長候補の募集要項', en: { label: 'Pension', value: 'Employees’ pension', cond: 'Recruitment terms for captain candidates' } },
  'toki-air.jobs.cont-captain-contract': { h: '94bc7101a4e745c0', label: '雇用の形', value: '入社時は契約社員。所定の訓練・機長の発令・試用期間のあと正社員', cond: '機長候補の募集要項', en: { label: 'Employment', value: 'Contract employee on joining; permanent employee after the set training, captain appointment and probation', cond: 'Recruitment terms for captain candidates' } },
  'toki-air.jobs.cont-captain-open': { h: '766eafc3da871760', label: '募集の受付', value: '機長候補を募集中（書類が届き次第、順に選考）', cond: '機長候補の募集要項（2026年10月19日に確認）', en: { label: 'Applications', value: 'Captain candidates are being recruited (selection in the order applications arrive)', cond: 'Recruitment terms for captain candidates (checked 19 October 2026)' } },
  'toki-air.work.cont-captain-days': { h: '5602b14b0b525c0c', label: '機長の休日', value: '年120日程度', cond: '機長候補の募集要項', en: { label: 'Captain days off', value: 'About 120 days a year', cond: 'Recruitment terms for captain candidates' } },
  'toki-air.work.missing-training-location': { h: 'a958ab3e559fad72', label: '訓練の場所', value: '国内と海外の訓練施設', cond: '機長候補の募集要項', en: { label: 'Training location', value: 'Training facilities in Japan and abroad', cond: 'Recruitment terms for captain candidates' } },
  /* ── 全社へ広げる d1 の続き（2026-10-21）：アジアの会社。字は行の値と引用から（調べた側の字は使わない）。cond ＝ 誰の・どの資料の条件か。
     同じ資料の同じことを言う2つめの行は字を書かない（大韓航空の訓練センター・バンブーの締切・フィリピン航空とベトジェットの求人の表示）── */
  /* シンガポール航空（パイロットの採用案内・求人） */
  'singapore-airlines.benefits.free-travel': { h: '7db8494bca816cbf', label: '社員の航空券', value: '年に1回の無料の旅行', cond: 'パイロットの採用案内', en: { label: 'Staff travel', value: 'One free trip a year', cond: 'Pilot recruitment guide' } },
  'singapore-airlines.benefits.medical': { h: '2870d4f88971e193', label: '保険', value: '医療と歯科の保障、保険', cond: 'パイロットの採用案内', en: { label: 'Insurance', value: 'Medical and dental cover, and insurance', cond: 'Pilot recruitment guide' } },
  'singapore-airlines.benefits.p26-family-travel': { h: 'af876bc873321fc2', label: '家族の航空券', value: '本人と対象の家族は、自社と提携会社の便を回数の制限なく割引で', cond: 'パイロットの採用案内。対象の家族の範囲は書かれていない', en: { label: 'Family travel', value: 'Discounted travel for the employee and eligible family on the company’s and partners’ flights, with no limit on trips', cond: 'Pilot recruitment guide. Which family members are eligible is not stated' } },
  'singapore-airlines.jobs.missing-entry-open': { h: '57619cda77d0ee38', label: '募集の受付', value: '訓練生（Ab Initio Cadet Pilot）を募集中', cond: '会社の求人ページ', en: { label: 'Applications', value: 'Cadets (Ab Initio Cadet Pilot) are being recruited', cond: 'The company’s vacancy page' } },
  'singapore-airlines.jobs.r7-a350-a380-contract-term': { h: 'cfaff568e36114b4', label: '雇用の形', value: 'A350・A380の経験者の副操縦士・機長は、最長12か月の有期契約', cond: '経験者の副操縦士・機長（契約）の求人（2026年10月2日に掲載）', en: { label: 'Employment', value: 'Experienced A350 and A380 first officers and captains: fixed-term contracts of up to 12 months', cond: 'Vacancy for experienced first officers and captains on contract (posted 2 October 2026)' } },
  'singapore-airlines.jobs.r7-second-officer-current-closed': { h: 'b3e13278c95b2c97', label: '募集の受付', value: '経験者のセカンドオフィサーの応募は、いまは受け付けていない', cond: '会社のパイロット採用のページ（2026年10月20日に確認）', en: { label: 'Applications', value: 'Applications from experienced second officers are not being accepted now', cond: 'The company’s pilot recruitment page (checked 20 October 2026)' } },
  'singapore-airlines.work.bond': { h: 'e43e45cc413336a3', label: '勤続の約束', value: '訓練の期間と、副操縦士になってから7年', cond: '訓練生（自社養成）の採用案内。返す額は書かれていない', en: { label: 'Service commitment', value: 'The training period plus 7 years after becoming a first officer', cond: 'Company-sponsored cadet recruitment guide. The amount to repay is not stated' } },
  'singapore-airlines.work.training': { h: 'f64aec0a0a5a7b7a', label: '訓練の場所', value: 'Singapore Flying College', cond: '訓練生（自社養成）の採用案内', en: { label: 'Training location', value: 'Singapore Flying College', cond: 'Company-sponsored cadet recruitment guide' } },
  /* 大韓航空（民間の飛行経歴を持つ新人操縦士の募集／会社のニュース） */
  'korean-air.jobs.followup-agent-f26-application-window': { h: '9bdd81116f8b2748', label: '募集の受付', value: '2026年7月1日から2027年6月30日まで', cond: '民間の飛行経歴を持つ新人操縦士の募集', en: { label: 'Applications', value: '1 July 2026 to 30 June 2027', cond: 'Recruitment of new pilots with civil flying experience' } },
  'korean-air.jobs.followup-agent-f26-selection-trigger': { h: 'c238e5c92e273d38', label: '選考の始まり', value: '応募が決まった人数に達してから選考を始め、本人に知らせる', cond: '民間の飛行経歴を持つ新人操縦士の募集', en: { label: 'Start of selection', value: 'Selection starts once applications reach a set number; applicants are notified', cond: 'Recruitment of new pilots with civil flying experience' } },
  'korean-air.jobs.followup-agent-f26-training-employment-status': { h: '2beccdbbfd05ddd7', label: '雇用の形', value: '教育のあいだは契約職。試用の操縦士に任命されると正規職', cond: '民間の飛行経歴を持つ新人操縦士の募集', en: { label: 'Employment', value: 'Contract position during training; regular position once appointed a probationary pilot', cond: 'Recruitment of new pilots with civil flying experience' } },
  'korean-air.profile.country': { h: '7356bc4640cc6910', label: '本社', value: '韓国', en: { label: 'Headquarters', value: 'South Korea' } },
  'korean-air.work.missing-training-location': { h: 'd87f23378f9bf5c1', label: '訓練の施設', value: '済州の飛行訓練院・金浦の本社・仁川 永宗島の運航訓練センター', cond: '会社のニュース（2026年5月8日）', en: { label: 'Training facilities', value: 'Flight training centre in Jeju, the Gimpo head office and the flight training centre on Yeongjong Island, Incheon', cond: 'Company news (8 May 2026)' } },
  /* スターラックス航空（2025年の年次報告書・採用サイト） */
  'starlux.benefits.medical': { h: '6ee9b3e010ee03f1', label: '保険', value: '団体保険と健康診断', cond: '2025年の年次報告書（全社員）', en: { label: 'Insurance', value: 'Group insurance and health checks', cond: '2025 annual report (all employees)' } },
  'starlux.benefits.missing-annual-leave': { h: '636a9d60032a95e9', label: '休暇', value: '有給休暇と祝日の休み', cond: '採用サイトの職場の案内（全職種）。日数は書かれていない', en: { label: 'Leave', value: 'Paid leave and public holidays off', cond: 'Workplace guide on the recruitment site (all roles). The number of days is not stated' } },
  'starlux.benefits.pension': { h: 'd9354066e89570d5', label: '年金', value: '法定の年金の積立', cond: '2025年の年次報告書（全社員）', en: { label: 'Pension', value: 'Statutory pension contributions', cond: '2025 annual report (all employees)' } },
  'starlux.benefits.staff-travel': { h: '61320ff6dac86577', label: '社員の航空券', value: '勤めて6か月から、無料と割引の航空券', cond: '2025年の年次報告書（全社員）', en: { label: 'Staff travel', value: 'Free and discounted tickets from 6 months of service', cond: '2025 annual report (all employees)' } },
  'starlux.jobs.followup-agent-f26-cadet-job-city': { h: '757f8bdb50e72dcf', label: '勤務地（訓練生の採用）', value: '桃園', cond: '訓練生の求人', en: { label: 'Work location (cadet hiring)', value: 'Taoyuan', cond: 'Cadet vacancy' } },
  'starlux.jobs.followup-agent-f26-cpl-job-city': { h: '77b68a9c5b8d893d', label: '勤務地（事業用操縦士の資格を持つ人の採用）', value: '台北', cond: '事業用操縦士の資格を持つ人の求人', en: { label: 'Work location (hiring of commercial licence holders)', value: 'Taipei', cond: 'Vacancy for commercial pilot licence holders' } },
  'starlux.jobs.followup-agent-f26-experienced-flighttime': { h: '225764b053a601a8', label: '応募に要る飛行時間', value: '機長は総飛行3,500時間（うち機長として700時間）、副操縦士は1,500時間（外国の人）・1,000時間（国内の人）', cond: '経験者の機長・副操縦士の募集', en: { label: 'Flight hours required', value: 'Captains: 3,500 hours total (700 as captain); first officers: 1,500 hours (foreign nationals) or 1,000 hours (Taiwanese nationals)', cond: 'Recruitment of experienced captains and first officers' } },
  'starlux.jobs.missing-entry-open': { h: '83e5b7a4ada1b584', label: '募集の受付', value: '事業用操縦士の資格を持つ人の採用は、いつでも応募できる', cond: '事業用操縦士の資格を持つ人の採用の案内', en: { label: 'Applications', value: 'Commercial pilot licence holders can apply at any time', cond: 'Hiring guide for commercial pilot licence holders' } },
  'starlux.work.p26-cadet-training': { h: '4d29ccf109a1ad24', label: '訓練の場所', value: '米国かオーストラリア', cond: '訓練生（Cadet）の採用の案内', en: { label: 'Training location', value: 'United States or Australia', cond: 'Cadet hiring guide' } },
  /* チャイナエアライン（会社のCSRの職場の案内・2026年の機師募集の発表） */
  'china-airlines.benefits.missing-annual-leave': { h: 'f0911e48afd449d9', label: '休暇', value: '特別休暇の制度', cond: '会社のCSRの職場の案内（全社員）。日数は書かれていない', en: { label: 'Leave', value: 'Special leave scheme', cond: 'The company’s CSR workplace guide (all employees). The number of days is not stated' } },
  'china-airlines.benefits.missing-commuting': { h: 'ad03a540cd93300b', label: '通勤', value: '通勤の交通の制度', cond: '会社のCSRの職場の案内（全社員）。額は書かれていない', en: { label: 'Commuting', value: 'Commuting transport scheme', cond: 'The company’s CSR workplace guide (all employees). The amount is not stated' } },
  'china-airlines.benefits.missing-medical': { h: '7168cb2f360deb7b', label: '保険', value: '団体健康保険', cond: '会社のCSRの職場の案内（全社員）', en: { label: 'Insurance', value: 'Group health insurance', cond: 'The company’s CSR workplace guide (all employees)' } },
  'china-airlines.benefits.missing-pension': { h: '7a1401350da89187', label: '年金', value: '退職金の積立（新しい制度は6%・古い制度は15%）', cond: '会社のCSRの職場の案内（全社員）', en: { label: 'Pension', value: 'Retirement contributions (6% under the new scheme, 15% under the old)', cond: 'The company’s CSR workplace guide (all employees)' } },
  'china-airlines.benefits.missing-staff-travel': { h: '8ec825d593a978b6', label: '社員の航空券', value: '優待の航空券の制度', cond: '会社のCSRの職場の案内（全社員）', en: { label: 'Staff travel', value: 'Discounted ticket scheme', cond: 'The company’s CSR workplace guide (all employees)' } },
  'china-airlines.jobs.c26-pilot-plan': { h: '9bc6b6f12c2f0dbe', label: '採用の予定', value: '2026年に160人を超える機師を採用する予定', cond: '会社の発表（2026年3月7日）', en: { label: 'Hiring plan', value: 'Plans to hire more than 160 pilots in 2026', cond: 'Company announcement (7 March 2026)' } },
  'china-airlines.jobs.missing-entry-open': { h: '9cae31a0017e9efd', label: '募集の受付', value: '培訓機師（訓練生）の募集は1年中受け付けている', cond: '会社の発表（2026年3月7日）', en: { label: 'Applications', value: 'Cadet pilot applications are accepted all year', cond: 'Company announcement (7 March 2026)' } },
  'china-airlines.profile.registered-city': { h: '04819c2b32fc467f', label: '本社', value: '桃園市', cond: '台湾 経済部の会社登記の所在地', en: { label: 'Headquarters', value: 'Taoyuan', cond: 'Registered address in Taiwan’s Ministry of Economic Affairs company register' } },
  'china-airlines.work.c26-pilot-training': { h: 'dd0459d86f1f236f', label: '訓練の流れ', value: '社内で業務を見習い、提携の飛行学校で訓練', cond: '培訓機師の募集（2026年3月7日の発表）', en: { label: 'Training path', value: 'Job shadowing within the company, then training at partner flight schools', cond: 'Cadet pilot recruitment (announced 7 March 2026)' } },
  'china-airlines.work.followup-agent-f26-cadet-training-countries': { h: 'ce9d0320e37b541b', label: '訓練の場所', value: 'いまは米国・オーストラリア', cond: '機師募集のQ&A', en: { label: 'Training location', value: 'Currently the United States and Australia', cond: 'Pilot recruitment Q&A' } },
  /* タイ国際航空（2025年の年次報告書・2026年の募集） */
  'thai-airways.benefits.missing-medical': { h: '5c0b57f764faf3dc', label: '保険', value: '団体の健康保険・生命保険・事故保険（2026年7月14日までの契約）', cond: '2025年の年次報告書（タイで社員として働く人）', en: { label: 'Insurance', value: 'Group health, life and accident insurance (contract to 14 July 2026)', cond: '2025 annual report (employees working in Thailand)' } },
  'thai-airways.benefits.missing-pension': { h: 'de385d4e53be006f', label: '年金', value: '積立の退職制度（会社は給与の9%、勤続20年からは10%。本人は2〜15%）', cond: '2025年の年次報告書（全社員）', en: { label: 'Pension', value: 'Provident fund (company 9% of salary, 10% from 20 years of service; employee 2–15%)', cond: '2025 annual report (all employees)' } },
  'thai-airways.benefits.missing-staff-travel': { h: 'ab570f92d1095efd', label: '社員の航空券', value: '社員と家族（配偶者・子・親）に、席の確約された券と空席待ちの券', cond: '2025年の年次報告書（全社員）', en: { label: 'Staff travel', value: 'Confirmed and standby tickets for employees and family (spouse, children, parents)', cond: '2025 annual report (all employees)' } },
  'thai-airways.jobs.c26-qualified-degree': { h: '6068cfeebca920d4', label: '応募の条件（学歴）', value: '学士以上（専攻は問わない）', cond: '有資格パイロットの募集（Qualified Pilot 2026）', en: { label: 'Requirement (education)', value: 'Bachelor’s degree or higher (any subject)', cond: 'Qualified pilot recruitment (Qualified Pilot 2026)' } },
  'thai-airways.jobs.missing-entry-open': { h: '9936c8794abb9325', label: '募集の受付', value: '選考（2026年4月20日の書類の確認・5月9日の筆記試験）は延期。新しい日程は追って案内', cond: '有資格パイロットの募集（Qualified Pilot 2026）', en: { label: 'Applications', value: 'Selection (document check on 20 April 2026, written test on 9 May) postponed; new dates to follow', cond: 'Qualified pilot recruitment (Qualified Pilot 2026)' } },
  'thai-airways.jobs.p26-sp-close': { h: 'afc610ce247e3ab7', label: '訓練生の募集の受付', value: '2026年3月9日〜31日（締め切った）', cond: '訓練生の募集（Student Pilot 2026）', en: { label: 'Cadet applications', value: '9–31 March 2026 (closed)', cond: 'Cadet recruitment (Student Pilot 2026)' } },
  /* 中国国際航空（2026年の飛行学生の募集要項） */
  'air-china.jobs.followup-agent-cadet-assignment-after-study': { h: '5066727c1873a57d', label: '卒業のあとの配属', value: '飛行の条件を満たした人を、本社か支社・子会社に配属', cond: '2026年の飛行学生の募集要項（2025年11月4日）', en: { label: 'Assignment after graduation', value: 'Those who meet the flying requirements are assigned to the head office or a branch or subsidiary', cond: '2026 flight student recruitment terms (4 November 2025)' } },
  'air-china.work.p26-schools': { h: '5fce05084cbecfcc', label: '養成の大学', value: '北京航空航天大学・南京航空航天大学・中国民用航空飛行学院・中国民航大学', cond: '2026年の飛行学生の募集要項（2025年11月4日）', en: { label: 'Training universities', value: 'Beihang University, Nanjing University of Aeronautics and Astronautics, Civil Aviation Flight University of China and Civil Aviation University of China', cond: '2026 flight student recruitment terms (4 November 2025)' } },
  /* 中国東方航空（第二期の飛行人材の募集・会社概要） */
  'china-eastern.jobs.missing-entry-open': { h: '74e5310d176f0400', label: '募集の受付', value: '2026年9月28日から12月31日 23時59分（中国の時刻）まで', cond: '大学卒業者の飛行人材の募集（第二期）', en: { label: 'Applications', value: '28 September 2026 to 23:59 on 31 December (China time)', cond: 'Recruitment of university graduates for flying careers (second round)' } },
  'china-eastern.profile.alliance': { h: '15204ba65b8789ad', label: '航空連合', value: 'スカイチーム', en: { label: 'Alliance', value: 'SkyTeam' } },
  'china-eastern.work.p26-training': { h: '5075261b73338412', label: '訓練の場所', value: '国内の飛行学校か海外の飛行学校', cond: '大学卒業者の飛行人材の募集（第二期）', en: { label: 'Training location', value: 'Flight schools in China or abroad', cond: 'Recruitment of university graduates for flying careers (second round)' } },
  /* 中国南方航空（2024年の社会責任報告書・深圳支社の調達の公告） */
  'china-southern.benefits.missing-annual-leave': { h: '15534a98da76079a', label: '休暇', value: '有給休暇・帰省の休暇・誕生日の休暇', cond: '2024年の社会責任報告書（全社員）。日数は書かれていない', en: { label: 'Leave', value: 'Paid leave, home leave and birthday leave', cond: '2024 social responsibility report (all employees). The number of days is not stated' } },
  'china-southern.benefits.missing-medical': { h: '09eb42bc3e4a7f64', label: '保険', value: '基本と補充の医療保険、乗務員の傷害保険、パイロットの保険', cond: '2024年の社会責任報告書', en: { label: 'Insurance', value: 'Basic and supplementary medical insurance, crew accident insurance and pilot insurance', cond: '2024 social responsibility report' } },
  'china-southern.benefits.missing-pension': { h: '07ef8618865b6e14', label: '年金', value: '基本の養老保険と企業年金', cond: '2024年の社会責任報告書（全社員）', en: { label: 'Pension', value: 'Basic pension insurance and an enterprise annuity', cond: '2024 social responsibility report (all employees)' } },
  'china-southern.benefits.r2-crew-bus-szx-procurement': { h: '8bd4e96b8a8c6528', label: '乗務員の送迎バス', value: '深圳の市内の停留所から空港のターミナルまで', cond: '深圳支社のバスの調達の公告（2026年3月6日）', en: { label: 'Crew shuttle bus', value: 'From stops in Shenzhen city to the airport terminal', cond: 'Shenzhen branch bus procurement notice (6 March 2026)' } },
  /* 海南航空（2025年の持続可能性報告書） */
  'hainan-airlines.benefits.missing-medical': { h: '001083aa43213e5e', label: '保険', value: '社員の補充の医療保険と、家族の医療費の補助', cond: '2025年の持続可能性報告書（グループ全体）', en: { label: 'Insurance', value: 'Supplementary medical insurance for employees and help with family medical costs', cond: '2025 sustainability report (the whole group)' } },
  'hainan-airlines.benefits.missing-staff-travel': { h: 'c03b757fa03c7364', label: '社員の航空券', value: '社員の割引の航空券と、乗務員・海外に派遣された社員などの帰省の航空券', cond: '2025年の持続可能性報告書（グループ全体）', en: { label: 'Staff travel', value: 'Discounted tickets for employees, and home-leave tickets for crew and staff posted abroad', cond: '2025 sustainability report (the whole group)' } },
  /* エア・インディア（パイロットの採用案内・訓練生の募集） */
  'air-india.benefits.c26-relocation': { h: 'bdf7f03e923b9725', label: '引っ越しの支援', value: '家財の運送・ホテル・子どもの入学の支援と、1回の転居手当', cond: 'パイロットの採用案内。額は書かれていない', en: { label: 'Relocation support', value: 'Help with moving household goods, hotels and school places for children, plus a one-off relocation allowance', cond: 'Pilot recruitment guide. The amount is not stated' } },
  'air-india.benefits.medical': { h: '6f9db1242cfcd1b6', label: '保険', value: '医療保険・ライセンスを失ったときの保障・団体生命保険・傷害の保障', cond: 'パイロットの採用案内', en: { label: 'Insurance', value: 'Medical insurance, loss-of-licence cover, group life insurance and accident cover', cond: 'Pilot recruitment guide' } },
  'air-india.benefits.travel': { h: 'efbcb1f9f8884b02', label: '社員の航空券', value: '年に1回の航空券と、回数の制限のない優待の航空券', cond: 'パイロットの採用案内', en: { label: 'Staff travel', value: 'One ticket a year, plus discounted tickets with no limit on trips', cond: 'Pilot recruitment guide' } },
  'air-india.jobs.missing-entry-open': { h: '2ad27d34039fe5af', label: '募集の受付', value: '訓練生の募集のページは次の案内を待つ表示（日程は出ていない）', cond: '訓練生の募集のページ', en: { label: 'Applications', value: 'The cadet recruitment page says to wait for the next notice (no dates given)', cond: 'Cadet recruitment page' } },
  'air-india.work.c26-cadet-school': { h: 'eaf8019d55e158d3', label: '事業用操縦士の訓練の場所', value: 'アムラバティ（インド）の自社の飛行学校か、米国の提携校2校', cond: '訓練生の募集のページ', en: { label: 'Commercial pilot training location', value: 'The company’s own flying school in Amravati (India) or two partner schools in the United States', cond: 'Cadet recruitment page' } },
  'air-india.work.p26-cadet-locations': { h: '33077bf218b7b5a8', label: '飛行訓練の提携校', value: 'フェニックス（AeroGuard）・サンフォード（L3Harris）。地上の訓練はインド', cond: '訓練生のコースの案内', en: { label: 'Partner flight schools', value: 'Phoenix (AeroGuard) and Sanford (L3Harris); ground training in India', cond: 'Cadet course guide' } },
  /* エアアジア（グループの採用案内） */
  'airasia.benefits.c26-group-travel': { h: '322814d07c50ffb3', label: '社員の航空券', value: '本人・家族・友人の無料と割引の航空券（会社によって違う）', cond: 'グループの採用案内（全職種）', en: { label: 'Staff travel', value: 'Free and discounted tickets for the employee, family and friends (varies by company)', cond: 'Group recruitment guide (all roles)' } },
  /* バンブー・エアウェイズ（2025年のA320パイロットの求人・2026年の訓練の覚書） */
  'bamboo-airways.jobs.c26-a320-qualification': { h: '43f209db718d1f53', label: '機長の応募の条件', value: '総飛行4,500時間以上（うちA320で1,500時間）、多人数機の機長1,500時間以上（うちA320で500時間）、定期運送用操縦士', cond: '2025年のA320機長の求人', en: { label: 'Captain requirements', value: '4,500 hours total (1,500 on the A320), 1,500 hours as captain on multi-crew aircraft (500 on the A320), airline transport pilot licence', cond: '2025 A320 captain vacancy' } },
  'bamboo-airways.jobs.location': { h: 'd055d42380a164e1', label: '勤務地', value: 'ハノイ（ノイバイ空港）', cond: '2025年のA320パイロットの求人', en: { label: 'Work location', value: 'Hanoi (Noi Bai Airport)', cond: '2025 A320 pilot vacancy' } },
  'bamboo-airways.jobs.missing-entry-open': { h: 'c74312b4d6250a39', label: '募集の受付', value: '2025年10月1日〜15日（締め切った）', cond: '2025年のA320機長の求人', en: { label: 'Applications', value: '1–15 October 2025 (closed)', cond: '2025 A320 captain vacancy' } },
  'bamboo-airways.work.p26-mpl-plan': { h: '65ad63b61bca27f7', label: '訓練の計画', value: 'BAA Training Vietnam と協力し、MPLの訓練の大部分をベトナムで行う予定', cond: '会社の発表（2026年の覚書）。次の募集は当局の承認のあと', en: { label: 'Training plan', value: 'Plans to run most MPL training in Vietnam with BAA Training Vietnam', cond: 'Company announcement (2026 memorandum). The next recruitment follows the authority’s approval' } },
  /* ガルーダ・インドネシア航空（2025年の年次報告書・採用サイト） */
  'garuda-indonesia.benefits.c26-pilot-retirement': { h: 'f6703106e7108a66', label: '退職の給付', value: '操縦士の退職時の給付の制度', cond: '2025年の年次報告書。率と額は書かれていない', en: { label: 'Retirement benefit', value: 'A retirement benefit scheme for pilots', cond: '2025 annual report. Rates and amounts are not stated' } },
  'garuda-indonesia.jobs.followup-agent-public-jobs-snapshot': { h: 'a95f557cd11c5185', label: '募集の受付', value: '会社の求人の一覧に、いま空いている求人は無い', cond: '会社の採用サイトの一覧（2026年10月19日に確認）', en: { label: 'Applications', value: 'No open vacancies on the company’s job list now', cond: 'The company’s recruitment site list (checked 19 October 2026)' } },
  /* 香港エクスプレス（パイロットの採用案内・セカンドオフィサーの求人） */
  'hong-kong-express.benefits.c26-relocation': { h: 'c88e05f8bc80c804', label: '引っ越しの支援', value: '転居の支援', cond: 'パイロットの採用案内。額は書かれていない', en: { label: 'Relocation support', value: 'Relocation support', cond: 'Pilot recruitment guide. The amount is not stated' } },
  'hong-kong-express.benefits.medical': { h: '081047822fd7fbcd', label: '保険', value: '医療保険', cond: 'パイロットの採用案内', en: { label: 'Insurance', value: 'Medical insurance', cond: 'Pilot recruitment guide' } },
  'hong-kong-express.benefits.travel': { h: '779ecfa1750305f3', label: '社員の航空券', value: '自社・キャセイパシフィック航空・提携会社の便の優待', cond: 'パイロットの採用案内', en: { label: 'Staff travel', value: 'Discounted travel on the company’s, Cathay Pacific’s and partners’ flights', cond: 'Pilot recruitment guide' } },
  'hong-kong-express.jobs.followup-agent-f26-secondofficer-job-city': { h: '4bc6e1ec0899b749', label: '勤務地', value: '香港', cond: 'セカンドオフィサーの求人（2025年9月3日に掲載）', en: { label: 'Work location', value: 'Hong Kong', cond: 'Second officer vacancy (posted 3 September 2025)' } },
  'hong-kong-express.jobs.missing-entry-open': { h: '98afa8b043a6421a', label: '募集の受付', value: 'セカンドオフィサーの求人を掲載中（締切の日付は無い）', cond: '会社の求人（2025年9月3日に掲載）', en: { label: 'Applications', value: 'A second officer vacancy is posted (no closing date)', cond: 'The company’s vacancy (posted 3 September 2025)' } },
  'hong-kong-express.jobs.p26-so-qual': { h: '5e4ef5c02bcb57de', label: '応募の条件', value: '多発機の事業用操縦士と計器飛行の資格（250時間以上）か、認められた一貫コースの事業用操縦士。第1種の身体検査', cond: 'セカンドオフィサーの求人', en: { label: 'Requirements', value: 'Multi-engine commercial licence with instrument rating (250 hours or more), or a commercial licence from an approved integrated course; Class 1 medical', cond: 'Second officer vacancy' } },
  /* インディゴ（会社の職場の案内） */
  'indigo.benefits.c26-staff-standby': { h: '8f4dce4d9d003b9d', label: '社員の航空券', value: '自社の国内線・国際線の割引の空席待ちの券（回数の制限なし）', cond: '会社の職場の案内（全社員）', en: { label: 'Staff travel', value: 'Discounted standby tickets on the company’s domestic and international flights (no limit on trips)', cond: 'The company’s workplace guide (all employees)' } },
  'indigo.benefits.medical': { h: '2beadf5d923304e6', label: '保険', value: '医療保険（本人と家族）', cond: '会社の職場の案内（全社員）', en: { label: 'Insurance', value: 'Medical insurance (the employee and family)', cond: 'The company’s workplace guide (all employees)' } },
  'indigo.jobs.pilot-family': { h: '31ec903196fd96b3', label: '社員の家族の採用の道', value: '社員の近親者で、事業用操縦士の資格と型式の限定を持つ人の採用（FamilyFLY）', cond: '会社の職場の案内', en: { label: 'Route for employees’ family', value: 'Hiring of employees’ close relatives who hold a commercial licence and a type rating (FamilyFLY)', cond: 'The company’s workplace guide' } },
  'indigo.jobs.pilot-internal': { h: '314b67baa1027d09', label: '社員からパイロットへの道', value: '社内の選考で、副操縦士の候補・訓練生を目指す制度（Fly High）', cond: '会社の職場の案内', en: { label: 'Route from staff to pilot', value: 'A scheme where employees aim to become first officer candidates or cadets through internal selection (Fly High)', cond: 'The company’s workplace guide' } },
  /* マレーシア航空（グループの採用ページ） */
  'malaysia-airlines.jobs.c26-application-channel': { h: '74b3e2cbd96f0bdc', label: '応募の方法', value: 'オンラインだけ（求人の検索から職種を選ぶ。求人の無い応募は受け付けない）', cond: 'グループの採用ページ', en: { label: 'How to apply', value: 'Online only (choose a role from the job search; applications without a vacancy are not accepted)', cond: 'Group recruitment page' } },
  /* フィリピン航空（採用サイト・社内誌・会社の発表） */
  'philippine-airlines.jobs.followup-agent-pilot-cabin-portal-snapshot': { h: '14332111fca9f984', label: '募集の受付', value: '採用サイトの「パイロットと客室乗務員」の分類に、いま空いている求人は無い', cond: '会社の採用サイト（2026年10月19日に確認）', en: { label: 'Applications', value: 'No open vacancies in the “Pilots and cabin crew” category of the recruitment site now', cond: 'The company’s recruitment site (checked 19 October 2026)' } },
  'philippine-airlines.jobs.p26-ao2026-students': { h: '48fb57bdc029eca0', label: '訓練生の人数（2026年Aクラス）', value: '21人', cond: '社内誌 The PALiner', en: { label: 'Cadets (2026 Class A)', value: '21', cond: 'Company magazine The PALiner' } },
  'philippine-airlines.work.p26-ao2026-location': { h: 'cc6813e95eae2456', label: '訓練の場所', value: 'オーストラリア クイーンズランド州アーチャーフィールドの Airways Aviation の施設（18か月の課程）', cond: '社内誌 The PALiner（2026年Aクラス）', en: { label: 'Training location', value: 'Airways Aviation facilities at Archerfield, Queensland, Australia (an 18-month course)', cond: 'Company magazine The PALiner (2026 Class A)' } },
  'philippine-airlines.work.training-location': { h: '5fa24ee76a8dcac5', label: '訓練の流れ', value: 'フィリピンで基礎の課程、そのあとオーストラリアの施設', cond: '会社の発表（2025年8月1日・飛行学校の再開）', en: { label: 'Training path', value: 'Basic course in the Philippines, then facilities in Australia', cond: 'Company announcement (1 August 2025, the flying school reopening)' } },
  /* スクート（B787機長（経験者）の募集） */
  'scoot.work.r2d-b787-type-training-bond': { h: 'cb074c0aff4c8d57', label: '型式の訓練の費用', value: '会社が型式の訓練を行う人は、費用の一部を負担し、訓練の拘束（ボンド）を結ぶ', cond: 'B787機長（経験者）の募集（2026年4月30日）。額と年数は書かれていない', en: { label: 'Type training costs', value: 'Those the company type-trains pay part of the cost and sign a training bond', cond: 'Experienced B787 captain recruitment (30 April 2026). The amount and years are not stated' } },
  'scoot.work.r2d-b787-variable-roster': { h: '75211335199c1ba0', label: '勤務の形', value: '決まった型の無いロスター（会社と規則の要件で組む）', cond: 'B787機長（経験者）の募集（2026年4月30日）', en: { label: 'Working pattern', value: 'A roster with no fixed pattern (built on company and regulatory requirements)', cond: 'Experienced B787 captain recruitment (30 April 2026)' } },
  /* ベトジェット（採用サイト） */
  'vietjet.jobs.c26-past-careerday': { h: 'df4d9cf08ea678af', label: '採用イベントの募集', value: 'A320・A321の機長・副操縦士（2025年2月14日〜17日の受付）', cond: '会社の求人（2025年のパイロットの採用イベント）', en: { label: 'Recruitment event', value: 'A320 and A321 captains and first officers (applications 14–17 February 2025)', cond: 'The company’s vacancy (2025 pilot recruitment event)' } },
  'vietjet.jobs.followup-agent-pilot-category-snapshot': { h: 'c52ed3201b5ac1a2', label: '募集の受付', value: '採用サイトのパイロットの分類に、いま求人は無い', cond: '会社の採用サイト（2026年10月19日に確認）', en: { label: 'Applications', value: 'No vacancies in the pilot category of the recruitment site now', cond: 'The company’s recruitment site (checked 19 October 2026)' } },
  /* ベトナム航空（2025年の年次報告書・2019年の記事） */
  'vietnam-airlines.benefits.c26-supplemental-retirement': { h: 'd54fda182680498b', label: '年金', value: '2020年から止めていた補完の退職保険への加入を再開', cond: '2025年の年次報告書（全社員）', en: { label: 'Pension', value: 'Resumed the supplementary retirement insurance that had been suspended since 2020', cond: '2025 annual report (all employees)' } },
  'vietnam-airlines.benefits.historical-travel': { h: '8fe628f9e2fb92c5', label: '社員の航空券', value: '自社のID券と、スカイチームの他社の便', cond: '2019年の会社の記事（パイロットの新しい給与の制度）', en: { label: 'Staff travel', value: 'The company’s ID tickets and other SkyTeam airlines’ flights', cond: '2019 company article (the new pilot pay scheme)' } },
  /* ロイヤルブルネイ航空（A320機長の求人・会社の連絡先） */
  'royal-brunei.base.c26-base': { h: '5ec450ce4e30a428', label: '拠点', value: 'バンダルスリブガワン', cond: 'A320機長の求人', en: { label: 'Base', value: 'Bandar Seri Begawan', cond: 'A320 captain vacancy' } },
  'royal-brunei.benefits.housing': { h: '57ebd1360d625628', label: '住宅の補助', value: '住宅手当', cond: 'A320機長の求人。額は書かれていない', en: { label: 'Housing allowance', value: 'Housing allowance', cond: 'A320 captain vacancy. The amount is not stated' } },
  'royal-brunei.benefits.medical': { h: '8c5c90af319567e7', label: '医療の補助', value: '外来の医療費の請求', cond: 'A320機長の求人', en: { label: 'Medical allowance', value: 'Claims for outpatient medical costs', cond: 'A320 captain vacancy' } },
  'royal-brunei.benefits.travel': { h: 'b3c5aa52eaa89f23', label: '社員の航空券', value: '自社の就航地へのビジネスクラスの航空券', cond: 'A320機長の求人', en: { label: 'Staff travel', value: 'Business-class tickets to the company’s destinations', cond: 'A320 captain vacancy' } },
  'royal-brunei.jobs.missing-entry-open': { h: '7722bfc21a2f6217', label: '募集の受付', value: '2026年に入社できるA320機長を募集（すぐに入社できる人が有利）', cond: 'A320機長の求人', en: { label: 'Applications', value: 'A320 captains able to join in 2026 are being recruited (those able to join at once are preferred)', cond: 'A320 captain vacancy' } },
  'royal-brunei.profile.missing-headquarters-country': { h: '88044241f129f6ae', label: '本社', value: 'ブルネイ', en: { label: 'Headquarters', value: 'Brunei' } },
  'royal-brunei.work.c26-average-hours': { h: '2f62afb6bc50ece9', label: '機長の飛行時間', value: '月に平均60〜70時間', cond: 'A320機長の求人', en: { label: 'Captain flying hours', value: '60–70 hours a month on average', cond: 'A320 captain vacancy' } },
  'royal-brunei.work.c26-noncommuting': { h: '9e2d217415e900f5', label: '勤務の形', value: '拠点に住んで勤める形（遠くから通う形ではない）', cond: 'A320機長の求人', en: { label: 'Working pattern', value: 'Living at the base (not commuting from afar)', cond: 'A320 captain vacancy' } },
  /* ── 全社へ広げる d1 の続き（2026-10-21）：中東・アフリカの会社（エティハド航空は先行5社）。同じ求人の同じことを言う2つめの行と、
     会社の機材の紹介の行で同じ型式が出ている復帰の行は字を書かない。エミレーツの訓練費の拘束の額は、サイトの通貨の表示を通す道がまだ無いので書かない ── */
  /* エミレーツ航空（副操縦士の給与と待遇の案内・パイロット採用のQ&A） */
  'emirates.benefits.housing-provided': { h: '0fe9281e04b2ff21', label: '住まい', value: '会社が用意する住まい（無料）', cond: '副操縦士の給与と待遇の案内', en: { label: 'Housing', value: 'Accommodation the company provides (free)', cond: 'First officer pay and benefits guide' } },
  'emirates.benefits.medical-family': { h: 'cc0359ff926bd240', label: '家族の医療', value: '本人と対象の家族（家族は月に少しの負担）', cond: 'パイロット採用のQ&A', en: { label: 'Family medical', value: 'The employee and eligible family (a small monthly contribution for family)', cond: 'Pilot recruitment Q&A' } },
  'emirates.benefits.provident-employee': { h: '4e3e2e75136cd63d', label: '積立の年金（本人）', value: '月の基本給の5%', cond: '副操縦士の給与と待遇の案内', en: { label: 'Provident fund (employee)', value: '5% of monthly basic salary', cond: 'First officer pay and benefits guide' } },
  'emirates.benefits.provident-employer': { h: '9ca7a0948e56bb7f', label: '積立の年金（会社）', value: '月の基本給の12%（最初の10年）', cond: '副操縦士の給与と待遇の案内', en: { label: 'Provident fund (company)', value: '12% of monthly basic salary (first 10 years)', cond: 'First officer pay and benefits guide' } },
  'emirates.benefits.provident-later': { h: '805ac83b270aad61', label: '積立の年金（会社・勤続10年から）', value: '月の基本給の15%', cond: 'パイロット採用のQ&A', en: { label: 'Provident fund (company, from 10 years of service)', value: '15% of monthly basic salary', cond: 'Pilot recruitment Q&A' } },
  'emirates.benefits.resume-provident-vesting': { h: 'ad69f6906f2f4137', label: '会社の積立の受け取り', value: '加入3年以上5年未満で75%、5年で100%', cond: 'パイロット採用のQ&A', en: { label: 'Vesting of company contributions', value: '75% after 3 to under 5 years of membership; 100% at 5 years', cond: 'Pilot recruitment Q&A' } },
  'emirates.benefits.staff-family': { h: '2d2dd317adeec714', label: '社員の航空券', value: '本人と家族に年1回、席の確約された休暇の往復の航空券と、優待の航空券', cond: 'パイロット採用のQ&A', en: { label: 'Staff travel', value: 'A confirmed return leave ticket a year for the employee and family, plus discounted tickets', cond: 'Pilot recruitment Q&A' } },
  'emirates.benefits.transport-provided': { h: '0f318b895a8c499b', label: '通勤', value: '会社の送迎（ドバイの中）', cond: 'パイロット採用のQ&A', en: { label: 'Commuting', value: 'Company transport (within Dubai)', cond: 'Pilot recruitment Q&A' } },
  'emirates.work.roster-days-off': { h: 'e86dd1d142c058c3', label: '休日', value: '連続28日で7日以上、連続30日で8日以上（3つの期間の平均）', cond: 'パイロット採用のQ&A', en: { label: 'Days off', value: 'At least 7 in any 28 consecutive days and 8 in any 30 (averaged over three periods)', cond: 'Pilot recruitment Q&A' } },
  'emirates.work.training-city': { h: 'c8b7819889de4c2d', label: '訓練の場所', value: 'ドバイ', cond: 'パイロット採用のQ&A（入社の訓練）', en: { label: 'Training location', value: 'Dubai', cond: 'Pilot recruitment Q&A (joining training)' } },
  /* カタール航空（ボーイングの型式を持つ副操縦士の求人・訓練生の採用案内） */
  'qatar-airways.jobs.followup-boeing-jobcity': { h: 'db13a56e62f9616b', label: '勤務地', value: 'ドーハ', cond: 'ボーイングの型式を持つ副操縦士の求人', en: { label: 'Work location', value: 'Doha', cond: 'Vacancy for first officers with a Boeing type rating' } },
  'qatar-airways.jobs.missing-entry-open': { h: 'a7aa74bde6cff272', label: '募集の受付', value: 'ボーイングの型式を持つ副操縦士を募集中（2027年1月31日締切）', cond: '会社の求人（2026年10月19日に確認）', en: { label: 'Applications', value: 'First officers with a Boeing type rating are being recruited (closes 31 January 2027)', cond: 'The company’s vacancy (checked 19 October 2026)' } },
  'qatar-airways.jobs.publication-boeing-fo-requirements': { h: 'e45fdb812aff2d7a', label: '応募の条件', value: '多人数で操縦するジェット旅客機で1,000時間以上（うち指定のボーイング機で500時間以上）、直近12か月にその型式で乗務、定期運送用操縦士の資格と計器飛行、第1種の身体検査', cond: 'ボーイングの型式を持つ副操縦士の求人', en: { label: 'Requirements', value: '1,000 hours or more on multi-crew jet airliners (500 or more on the specified Boeing types), flying that type in the last 12 months, airline transport pilot licence with instrument rating, Class 1 medical', cond: 'Vacancy for first officers with a Boeing type rating' } },
  'qatar-airways.work.r2-cadet-guarantor-repayment': { h: '4d83d0b401f7b15e', label: '奨学金の保証人', value: 'カタール国籍の保証人が要る。不合格・辞退・決まった勤務の前の退職では、奨学金の費用を返す', cond: 'カタール国籍の人の訓練生（Cadet）の奨学金の案内', en: { label: 'Scholarship guarantor', value: 'A Qatari guarantor is required. Scholarship costs are repaid on failure, withdrawal or leaving before the set service', cond: 'Scholarship guide for Qatari cadets' } },
  'qatar-airways.work.resume-cadet-service': { h: '1dff41f6cb6ddc3f', label: '勤続の約束', value: '副操縦士になってから5年以上', cond: '訓練生（Cadet）の採用の案内', en: { label: 'Service commitment', value: '5 years or more after becoming a first officer', cond: 'Cadet hiring guide' } },
  /* ガルフ・エア（A320の型式を持つ副操縦士の求人） */
  'gulf-air.benefits.missing-medical': { h: '0e6bb63c8b18a1e0', label: '保険', value: '本人と対象の家族の医療保険', cond: 'A320の型式を持つ副操縦士の求人（GF1972）', en: { label: 'Insurance', value: 'Medical insurance for the employee and eligible family', cond: 'Vacancy for first officers with an A320 type rating (GF1972)' } },
  'gulf-air.benefits.missing-staff-travel': { h: '48775484eb6a9b04', label: '社員の航空券', value: '旅行の優待', cond: 'A320の型式を持つ副操縦士の求人（GF1972）。内容は書かれていない', en: { label: 'Staff travel', value: 'Travel concessions', cond: 'Vacancy for first officers with an A320 type rating (GF1972). Details are not stated' } },
  'gulf-air.jobs.followup-gf1972-hours': { h: 'b6349d0b6a4fac83', label: '応募に要る飛行時間', value: '総飛行1,500時間（うちA320で250時間・多人数のジェット機で500時間）か、総飛行700時間（うちA320で500時間）', cond: 'A320の型式を持つ副操縦士の求人（GF1972）', en: { label: 'Flight hours required', value: '1,500 hours total (250 on the A320 and 500 on multi-crew jets), or 700 hours total (500 on the A320)', cond: 'Vacancy for first officers with an A320 type rating (GF1972)' } },
  'gulf-air.jobs.missing-entry-open': { h: '98dd88ac25992497', label: '募集の受付', value: 'A320の型式を持つ副操縦士を募集中（2026年12月31日締切）', cond: '会社の求人（2026年10月19日に確認）', en: { label: 'Applications', value: 'First officers with an A320 type rating are being recruited (closes 31 December 2026)', cond: 'The company’s vacancy (checked 19 October 2026)' } },
  'gulf-air.jobs.publication-gf1853-history': { h: '848d00be3d30c1c3', label: '前の募集', value: 'A320の型式を持つ副操縦士（GF1853・2026年1月1日に締め切った）', cond: '会社の求人', en: { label: 'Previous vacancy', value: 'First officers with an A320 type rating (GF1853, closed on 1 January 2026)', cond: 'The company’s vacancy' } },
  /* クウェート航空（会社の採用ページ） */
  'kuwait-airways.jobs.r2-openings-none': { h: 'ccf913ede5e78358', label: '募集の受付', value: '会社の採用の一覧に、いま空いている求人は無い', cond: '会社の採用ページ（2026年10月19日に確認）', en: { label: 'Applications', value: 'No open vacancies on the company’s recruitment list now', cond: 'The company’s recruitment page (checked 19 October 2026)' } },
  /* オマーン航空（会社の採用ページ） */
  'oman-air.benefits.resume-medical-family': { h: 'd1edcc5d7abb50c6', label: '保険', value: '社員と家族の医療・生命・障害・視力の保険', cond: '会社の採用ページ（全社員）', en: { label: 'Insurance', value: 'Medical, life, disability and vision insurance for employees and family', cond: 'The company’s recruitment page (all employees)' } },
  'oman-air.benefits.resume-staff-travel': { h: '0a35d15b9d1d9bcb', label: '社員の航空券', value: '社員と家族の旅行の優待', cond: '会社の採用ページ（全社員）', en: { label: 'Staff travel', value: 'Travel concessions for employees and family', cond: 'The company’s recruitment page (all employees)' } },
  'oman-air.jobs.resume-pilot-pathways': { h: '9a3507c64fbcc3ee', label: '採用の道', value: '訓練生（Cadet）と、経験者の機長', cond: '会社の採用ページ', en: { label: 'Hiring routes', value: 'Cadets and experienced captains', cond: 'The company’s recruitment page' } },
  /* リヤド航空（B787の経験者の機長の求人） */
  'riyadh-air.jobs.missing-entry-open': { h: 'd9f8ea1fa645c833', label: '募集の受付', value: 'B787の経験者の機長を募集中', cond: '会社の求人（2026年10月19日に確認）', en: { label: 'Applications', value: 'Experienced B787 captains are being recruited', cond: 'The company’s vacancy (checked 19 October 2026)' } },
  'riyadh-air.jobs.resume-dec-minimum': { h: 'c6ff3ee1a296e18f', label: '機長の応募の条件', value: '多人数・多発機で6,000時間以上（うちワイドボディ機の機長で2,000時間）、直近12か月に機長で150時間', cond: 'B787の経験者の機長の求人', en: { label: 'Captain requirements', value: '6,000 hours or more on multi-crew, multi-engine aircraft (2,000 as widebody captain) and 150 hours as captain in the last 12 months', cond: 'Vacancy for experienced B787 captains' } },
  'riyadh-air.work.resume-dec-roster': { h: '6b87ee39bafe1d01', label: '機長の勤務の形', value: 'フルタイムのほか、条件を満たせば暮らしに合わせたロスターも選べる', cond: 'B787の経験者の機長の求人（リヤド拠点）', en: { label: 'Captain working pattern', value: 'Full time, or a lifestyle roster for those who meet the conditions', cond: 'Vacancy for experienced B787 captains (Riyadh base)' } },
  /* ロイヤル・ヨルダン航空（A320機長の求人・訓練生の採用案内） */
  'royal-jordanian.jobs.r3-a320-cap-open-5496790': { h: '36c1d6275eaeeb04', label: '募集の受付', value: 'A320の型式を持つ機長を募集中（2026年12月18日締切）', cond: '会社の求人（2026年10月19日に掲載）', en: { label: 'Applications', value: 'Captains with an A320 type rating are being recruited (closes 18 December 2026)', cond: 'The company’s vacancy (posted 19 October 2026)' } },
  'royal-jordanian.jobs.resume-cadet-eligibility': { h: 'f77caa8badbaa543', label: '訓練生の応募の条件', value: 'ヨルダン国籍、事業用操縦士と計器飛行・定期運送用操縦士の学科・MCC', cond: '訓練生（Cadet）の採用の案内', en: { label: 'Cadet requirements', value: 'Jordanian nationality, commercial licence with instrument rating, ATPL theory and MCC', cond: 'Cadet hiring guide' } },
  'royal-jordanian.jobs.resume-campaign-timing': { h: '2f5663f114cda701', label: '訓練生の選考', value: '会社の必要に応じて、選考の回を取りやめたり日程を変えたりする', cond: '訓練生（Cadet）の採用の案内', en: { label: 'Cadet selection', value: 'The company may cancel or reschedule selection rounds as it needs', cond: 'Cadet hiring guide' } },
  /* サウディア（訓練生の求人） */
  'saudia.jobs.cadet-hours': { h: 'da307ce490bf7b45', label: '訓練生の応募に要る飛行時間', value: '240時間以上（うち多発機で25時間）', cond: '訓練生（Cadet Program）の求人（2026年10月17日）', en: { label: 'Cadet flight hours required', value: '240 hours or more (25 on multi-engine aircraft)', cond: 'Cadet Program vacancy (17 October 2026)' } },
  'saudia.jobs.resume-cadet-now': { h: '860b9ca5da21a733', label: '募集の受付', value: '訓練生（Cadet Program）を募集中（サウジアラビア国籍の人だけ）', cond: '会社の求人（2026年10月17日に掲載）', en: { label: 'Applications', value: 'Cadets (Cadet Program) are being recruited (Saudi nationals only)', cond: 'The company’s vacancy (posted 17 October 2026)' } },
  /* エジプト航空（訓練中のパイロットの求人・訓練施設の案内） */
  'egyptair.benefits.missing-commuting': { h: 'cecbe952ce8f9145', label: '通勤', value: '無料の送迎', cond: '訓練中のパイロットの求人（A-31/2026）', en: { label: 'Commuting', value: 'Free transport', cond: 'Vacancy for pilots in training (A-31/2026)' } },
  'egyptair.benefits.missing-medical': { h: '3d591c7d3e978b56', label: '保険', value: '本人と家族の医療保険', cond: '訓練中のパイロットの求人（A-31/2026）', en: { label: 'Insurance', value: 'Medical insurance for the employee and family', cond: 'Vacancy for pilots in training (A-31/2026)' } },
  'egyptair.jobs.followup-a31-qualification': { h: '32dfc155ffc12c40', label: '応募の条件', value: 'エジプト国籍、2026年8月30日に30歳以下、エジプト民間航空局が認める事業用操縦士か定期運送用操縦士、英語の能力（ICAO 5）', cond: '訓練中のパイロットの求人（A-31/2026）', en: { label: 'Requirements', value: 'Egyptian nationality, aged 30 or under on 30 August 2026, a commercial or airline transport licence recognised by the Egyptian Civil Aviation Authority, English proficiency (ICAO 5)', cond: 'Vacancy for pilots in training (A-31/2026)' } },
  'egyptair.jobs.missing-entry-open': { h: '8bbaedda444933cd', label: '募集の受付', value: '訓練中のパイロット（A-31/2026）を募集中（2026年11月1日締切）', cond: '会社の求人（2026年9月15日に掲載）', en: { label: 'Applications', value: 'Pilots in training (A-31/2026) are being recruited (closes 1 November 2026)', cond: 'The company’s vacancy (posted 15 September 2026)' } },
  'egyptair.work.missing-training-location': { h: '051301f950ae39ba', label: '訓練の場所', value: 'カイロ国際空港の EGYPTAIR Training Academy', cond: '訓練施設の案内', en: { label: 'Training location', value: 'EGYPTAIR Training Academy at Cairo International Airport', cond: 'Training facility guide' } },
  /* エチオピア航空（外国人の機長の募集・訓練施設の案内） */
  'ethiopian-airlines.benefits.resume-annual-leave': { h: '2ac45b037baa17f7', label: '休暇', value: '有給の年次休暇', cond: '外国人の機長の募集。日数は書かれていない', en: { label: 'Leave', value: 'Paid annual leave', cond: 'Recruitment of expatriate captains. The number of days is not stated' } },
  'ethiopian-airlines.benefits.resume-bonus': { h: '4385c6ce18b1e297', label: '賞与', value: '年1回の賞与', cond: '外国人の機長の募集。額は書かれていない', en: { label: 'Bonus', value: 'An annual bonus', cond: 'Recruitment of expatriate captains. The amount is not stated' } },
  'ethiopian-airlines.benefits.resume-housing': { h: 'ddadfaf105a23822', label: '住宅の補助', value: '住宅手当', cond: '外国人の機長の募集。額は書かれていない', en: { label: 'Housing allowance', value: 'Housing allowance', cond: 'Recruitment of expatriate captains. The amount is not stated' } },
  'ethiopian-airlines.benefits.resume-insurance': { h: 'ddf84871cd310a46', label: '保険', value: '医療保険と傷害保険', cond: '外国人の機長の募集', en: { label: 'Insurance', value: 'Medical and accident insurance', cond: 'Recruitment of expatriate captains' } },
  'ethiopian-airlines.benefits.resume-tickets': { h: 'f8b61264b7d2915a', label: '社員の航空券', value: 'ビジネスクラスの航空券', cond: '外国人の機長の募集。回数は書かれていない', en: { label: 'Staff travel', value: 'Business-class tickets', cond: 'Recruitment of expatriate captains. The number of tickets is not stated' } },
  'ethiopian-airlines.benefits.resume-transport': { h: 'b874da8ec78338b5', label: '通勤', value: '無料の送迎', cond: '外国人の機長の募集', en: { label: 'Commuting', value: 'Free transport', cond: 'Recruitment of expatriate captains' } },
  'ethiopian-airlines.jobs.resume-captain-open': { h: '6157377566ce624e', label: '募集の受付', value: '外国人の機長を募集中（3つの機材のグループ）', cond: '会社の募集のページ', en: { label: 'Applications', value: 'Expatriate captains are being recruited (three fleet groups)', cond: 'The company’s recruitment page' } },
  'ethiopian-airlines.work.missing-training-location': { h: '6cee23024281fb5c', label: '訓練の場所', value: 'アディスアベバのボレ国際空港の Ethiopian Aviation Academy', cond: '訓練施設の案内', en: { label: 'Training location', value: 'Ethiopian Aviation Academy at Bole International Airport, Addis Ababa', cond: 'Training facility guide' } },
  /* ケニア航空（2024年の報告書） */
  'kenya-airways.benefits.publication-general-dc': { h: '6b3fea2f5933e002', label: '年金', value: '社員の積立の年金（確定拠出。正社員は加入）', cond: '2024年の報告書（全社員）', en: { label: 'Pension', value: 'Staff provident pension (defined contribution; permanent employees join)', cond: '2024 report (all employees)' } },
  'kenya-airways.benefits.publication-general-medical': { h: 'c6b90ff974e1972f', label: '保険', value: '医療の制度と育児の休暇', cond: '2024年の報告書（全社員）', en: { label: 'Insurance', value: 'Medical scheme and parental leave', cond: '2024 report (all employees)' } },
  /* 南アフリカ航空（パイロット採用の案内） */
  'south-african-airways.jobs.resume-pilot-qualification': { h: '2a5e9ade9a5dc290', label: '応募の条件', value: '南アフリカの定期運送用操縦士（学科合格を含む）、多発機の計器飛行、第1種の身体検査、1,500時間以上（うち多発機で200時間）', cond: '会社のパイロット採用の案内', en: { label: 'Requirements', value: 'South African airline transport pilot licence (including theory passes), multi-engine instrument rating, Class 1 medical, 1,500 hours or more (200 on multi-engine aircraft)', cond: 'The company’s pilot recruitment guide' } },
  /* ── 全社へ広げる a3（2026-10-21・ROUND5 で入った行）：字は行の値と引用から（調べた側の字は使わない）。cond ＝ 誰の・どの資料の条件か。
     書かなかった行（出ない）：インディゴの業務の移動の手配（パイロットの管理担当の求人の職務の説明で、パイロットの待遇の公表ではない）・
     南アフリカ航空の航空券（2025年3月の会社の「最終提案」の説明 ── 結ばれた条件ではない）。ほかは資料の種類で出ない行
     （エチオピア航空の労働組合の告知・カンタスの組合の案内が先の行・スカイマークの採用会社の求人）── 書いても出ないので書かない ── */
  'airdo.benefits.r8-chitose-residence': { h: 'e860b2489393de0f', label: '居住地の制度', value: '千歳地区居住地制度', cond: 'B737機長要員の募集要項', en: { label: 'Residence scheme', value: 'Chitose-area residence scheme', cond: 'Recruitment terms for B737 captain candidates' } },
  'fda.benefits.r10-jpc-fo-commute-existence': { h: '2eb5d9cbe52258cf', label: '通勤', value: '通勤手当', cond: '他社経験者の副操縦士候補の求人。額は書かれていない', en: { label: 'Commuting', value: 'Commuting allowance', cond: 'Vacancy for first officer candidates with experience at another airline. The amount is not stated' } },
  'jetstar-japan.benefits.r9-jpben-jcab-captain-staff-travel': { h: '706ca6dcbf3193b5', label: '社員の航空券', value: 'カンタス・グループのスタッフトラベルの割引（本人と、指定した同伴者）', cond: '日本の航空局の資格を持つ A320/A321 機長の求人（2025年4月7日の掲載）', en: { label: 'Staff travel', value: 'Qantas Group staff travel discounts (the employee and nominated travel companions)', cond: 'Vacancy for A320/A321 captains holding a Japanese licence (posted 7 April 2025)' } },
  /* カンタスの待遇のカードの1行めは、今までどおり労働協約の年次休暇（パイロットの条件）。字は ITEM の言い方と協約の cond のまま（lead だけ） */
  'qantas.benefits.resume-sh-leave': { h: 'a995498e6f46de67', label: '年次休暇', lead: true, en: { label: 'Annual leave' } },
  'qantas.benefits.r10-permanent-employee-travel': { h: '882b7aeb6266f27f', label: '社員の航空券', value: '旅行の優待（本人と、指定した同伴者など）', cond: '2026年の年次報告（正社員ぜんたいの制度。パイロットの条件は書かれていない）', en: { label: 'Staff travel', value: 'Travel concessions (the employee, nominated travel companions and others)', cond: '2026 annual report (a scheme for all permanent employees; pilots’ terms are not stated)' } },
  'qantas.benefits.r8-redundancy-staff-travel': { h: 'aa9dde9dced278f3', label: '社員の航空券（人員整理のとき）', value: '会社のスタッフトラベルの規程による', cond: '短距離線のパイロットの労働協約（人員整理の条項）', en: { label: 'Staff travel (on redundancy)', value: 'Under the company’s staff travel policy', cond: 'Short-haul pilots’ collective agreement (redundancy clause)' } },
  'solaseed.benefits.r8-local-residence': { h: 'f8d55fb37c8abbd6', label: '居住地の制度', value: '地方居住制度', cond: '機長要員の募集要項', en: { label: 'Residence scheme', value: 'Regional residence scheme', cond: 'Recruitment terms for captain candidates' } },
  /* ── 全社へ広げる d2（2026-10-22）：ヨーロッパ・アメリカ大陸・オセアニアの会社。字は行の値と引用から（調べた側の字は使わない）。
     cond ＝ 誰の・どの資料の条件か。英語の対は同じ行に（EN-2）。外国の通貨の額は書かない（サイトの通貨の切り替えを通らないため）。
     書かなかった行（出ない）：同じ資料の同じ中身の行（アラスカ航空 r10・ジェットブルー航空の古い四半期と同じ求人の2行め）・
     選考を受けるときの費用（オーストリア航空・ヴァージン）・求人の事務所の住所（エールフランス）・これから入る機材の計画（アビアンカ）・
     空港の3字でない拠点の行（オーストリア航空）・労働協約のポルトの基地の条項（TAP ── 拠点がポルトだけと読める） ── */
  /* ユナイテッド航空 */
  /* 同じ話（保険）を労働協約の行（united.benefits.missing-medical）が言うので、そちらが出ているあいだは出さない（2026-10-23） */
  'united.benefits.resume-pilot-health': { h: '97012361f5f32cff', label: '保険', value: '医療・歯科・眼科・生命・事故・障害の保険', cond: '副操縦士の採用ページ（United Pilot Agreement による）', same: 'united.benefits.missing-medical', en: { label: 'Insurance', value: 'Medical, dental, vision, life, accident and disability insurance', cond: 'First officer recruitment page (under the United Pilot Agreement)' } },
  'united.benefits.travel': { h: '39ee0dc890014b50', label: '社員の航空券', value: '航空券の特典', cond: '副操縦士の採用ページ（United Pilot Agreement による）', en: { label: 'Staff travel', value: 'Travel privileges', cond: 'First officer recruitment page (under the United Pilot Agreement)' } },
  'united.jobs.entry-ongoing': { h: '4d640e17bf73f72f', label: '募集の受付', value: '副操縦士を通年で募集（締切の日付は無い）', cond: '副操縦士の採用ページ', en: { label: 'Recruitment', value: 'First officers are hired on an ongoing basis (no closing date)', cond: 'First officer recruitment page' } },
  'united.jobs.total-time-min': { h: '7ff05434cd7575c1', label: '応募の条件', value: '総飛行時間1,500時間以上', cond: '副操縦士の採用ページ', en: { label: 'Requirements', value: 'At least 1,500 hours total time', cond: 'First officer recruitment page' } },
  'united.work.training-denver': { h: 'd3bceaed827f46ec', label: '訓練の場所', value: 'デンバーの Flight Training Center', cond: '副操縦士の採用ページ', en: { label: 'Training locations', value: 'Flight Training Center in Denver', cond: 'First officer recruitment page' } },
  /* デルタ航空 */
  'delta.benefits.publication-newhire-hotel': { h: '0fd412c2a6f3a143', label: '訓練の間の宿泊（新人）', value: '会社負担のホテル（制服も会社が用意）', cond: 'パイロットの採用のQ&A', en: { label: 'Hotel during training (new hires)', value: 'A company-paid hotel (uniforms are also provided)', cond: 'Pilot recruitment FAQs' } },
  'delta.benefits.resume-general-travel': { h: '23477d774365b96f', label: '社員の航空券', value: '回数の制限の無い空席待ちと、確定席の割引', cond: '社員ぜんたいの特典の案内（パイロットの条件は書かれていない）', en: { label: 'Staff travel', value: 'Unlimited standby travel and discounted confirmed fares', cond: 'Benefits overview for all employees (pilots’ terms are not stated)' } },
  'delta.benefits.retirement': { h: '6826978abe85f16b', label: '年金', value: '401(k) の拠出', cond: 'パイロットの採用ページ', en: { label: 'Pension', value: '401(k) contributions', cond: 'Pilot recruitment page' } },
  'delta.work.resume-slc-training': { h: '835444eed1e023c8', label: '訓練の場所', value: 'ソルトレイクシティ国際空港の近くのパイロットの訓練施設（2024年12月に開所）', cond: '会社の発表（2024年12月4日）', en: { label: 'Training locations', value: 'A pilot training facility near Salt Lake City International Airport (opened December 2024)', cond: 'Company announcement (4 December 2024)' } },
  /* アメリカン航空 */
  'american.benefits.r10-pilot-commuter-pretax': { h: '689d6e3f6a63a860', label: '通勤', value: '通勤の公共交通の費用に使える、税引き前の給与からの積み立て（本人の拠出）', cond: 'パイロット向けの福利厚生のページ', en: { label: 'Commuting', value: 'Pre-tax payroll contributions (your own) that can be spent on commuting by public transport', cond: 'Pilots’ benefits pages' } },
  'american.benefits.r10-pilot-travel-existence': { h: '41816be5d2c483be', label: '社員の航空券', value: '社員と家族などの航空券の特典（細かい条件は別の資料）', cond: 'パイロット向けの福利厚生のページ', en: { label: 'Staff travel', value: 'Travel privileges for eligible employees and family (details are in a separate document)', cond: 'Pilots’ benefits pages' } },
  'american.work.training-dfw-clt': { h: 'f9243d02903125d8', label: '訓練の場所', value: 'ダラス・フォートワース（DFW Flight Academy）とシャーロット（CLT Training Center）', cond: '会社の概要', en: { label: 'Training locations', value: 'Dallas/Fort Worth (DFW Flight Academy) and Charlotte (CLT Training Center)', cond: 'Company overview' } },
  /* サウスウエスト航空 */
  'southwest.benefits.missing-medical': { h: '941d18abab494770', label: '保険', value: '入社の日から、本人と家族の医療・歯科・生命保険', cond: 'パイロットの採用ページ', en: { label: 'Insurance', value: 'Medical, dental and life insurance for you and eligible dependants from day one', cond: 'Pilot recruitment page' } },
  'southwest.benefits.missing-staff-travel': { h: '5dbfde5a02ff855d', label: '社員の航空券', value: '入社の日から本人と家族が対象。他社の操縦室の補助席に乗れる取り決めもある', cond: 'パイロットの採用ページ', en: { label: 'Staff travel', value: 'Travel benefits for you and eligible dependants from day one, plus jumpseat agreements with other airlines', cond: 'Pilot recruitment page' } },
  'southwest.benefits.resume-pilot-parking': { h: '132254f8b153029c', label: '駐車場', value: '指定の社員駐車場は会社負担（ほかの駐車場は年の上限まで払い戻し）', cond: 'パイロットの採用ページ', en: { label: 'Parking', value: 'Designated employee parking is paid by the company (other parking is reimbursed up to a yearly cap)', cond: 'Pilot recruitment page' } },
  'southwest.benefits.retirement-2026': { h: 'c8131d5560f29b45', label: '年金', value: '会社の拠出18%と、市場に連動するキャッシュバランス2%（2026年）', cond: 'パイロットの採用ページ', en: { label: 'Pension', value: '18% company contributions plus a 2% market-based cash balance (2026)', cond: 'Pilot recruitment page' } },
  'southwest.jobs.entry-closed': { h: 'c112e24dbd384495', label: '募集の受付', value: '副操縦士の受付はいま締め切っている（2026年10月19日に確認）', cond: 'パイロットの採用ページ', en: { label: 'Recruitment', value: 'First officer applications are currently closed (checked on 19 October 2026)', cond: 'Pilot recruitment page' } },
  'southwest.work.resume-roster-flex': { h: '397a452c1f6e8200', label: '勤務の希望', value: '勤務表を見てから希望を出す方式（PBS ではない）。乗務の交換ができる', cond: 'パイロットの採用ページ', en: { label: 'Schedule bidding', value: 'You see the schedule before you bid (no PBS), and trips can be traded', cond: 'Pilot recruitment page' } },
  'southwest.work.training-dallas': { h: 'b040032d3f383ba3', label: '訓練の場所', value: 'ダラスの LEAD Center（初期の訓練）', cond: 'パイロットの採用ページ', en: { label: 'Training locations', value: 'LEAD Center in Dallas (initial training)', cond: 'Pilot recruitment page' } },
  /* KLMオランダ航空 */
  'klm.benefits.c-isa-discounts': { h: '022ba696b33e4afb', label: '社員の航空券', value: '社員向けの航空券（ISA）と、ホテル・レンタカーの割引', cond: 'パイロットの採用案内（雇用の条件）。家族の範囲・料金は書かれていない', en: { label: 'Staff travel', value: 'Staff tickets (ISA) and hotel and car-rental discounts', cond: 'Pilot recruitment guide (employment conditions). Family eligibility and fares are not stated' } },
  'klm.benefits.pub-kfa-campus-housing': { h: '7e43b98796407bd5', label: '訓練生の住まい', value: 'エールデの訓練校の部屋を借りられる（費用は訓練費の融資に含められる）', cond: 'KLM フライトアカデミーの案内。無料の社宅ではない', en: { label: 'Cadet accommodation', value: 'Rooms can be rented on the Eelde campus (the cost can be included in the training loan)', cond: 'KLM Flight Academy guide. Not free company housing' } },
  'klm.benefits.r8-cockpit-parking-local-ov': { h: '2b801d5b50c21013', label: '通勤', value: 'スキポール空港の駐車カード（自己負担あり）と、空港と周辺の公共交通の無料利用', cond: 'パイロット（コックピット）向けの採用ページ', lead: true, en: { label: 'Commuting', value: 'A Schiphol parking card (with a personal contribution) and free use of public transport at and around the airport', cond: 'Recruitment page for pilots (cockpit)' } },
  'klm.work.pub-kfa-deduction2026': { h: 'c0421ae04ae39fda', label: '訓練費の返済（訓練生）', value: '入社後10年間、給与から月々差し引く方式か、一括での返済を選ぶ', cond: 'KLM フライトアカデミーの費用と融資の案内（2026年）', en: { label: 'Training cost repayment (cadets)', value: 'Monthly deductions from salary over 10 years after joining, or repayment in one sum', cond: 'KLM Flight Academy costs and financing (2026)' } },
  'klm.work.pub-kfa-training-location': { h: '58063bc8564a1b2f', label: '訓練の場所', value: 'エールデ（学科・単発機・多発機）とスキポール（MCC・型式）', cond: 'KLM フライトアカデミーの課程の案内', en: { label: 'Training locations', value: 'Eelde (theory, single-engine and multi-engine) and Schiphol (MCC and type rating)', cond: 'KLM Flight Academy course guide' } },
  'klm.work.roster': { h: 'e3c941da62d17e09', label: '勤務の形', value: '4週間ごとの勤務表', cond: 'パイロットの採用ページ', en: { label: 'Working pattern', value: 'Rosters in four-week blocks', cond: 'Pilot recruitment page' } },
  /* エールフランス */
  'air-france.benefits.c-cadet-housing': { h: 'c44dee7badf1b612', label: '訓練生の住まい', value: '学校での初期訓練の間は、住まいが用意される', cond: '養成コース（cadet）のQ&A', en: { label: 'Cadet accommodation', value: 'Accommodation is provided throughout the initial school training', cond: 'Cadet programme FAQs' } },
  /* 養成コースの訓練の期間中の休暇（行に職位が無く、行き先が cadet）── 名前が訓練生の条件だと言う。値は ITEM の言い方（年5週間）（2026-10-23） */
  'air-france.benefits.c-cadet-leave': { h: '1f0ea47acf79fa7b', label: '訓練生の年次休暇', cond: '養成コース（cadet）のQ&A', en: { label: 'Cadet annual leave', cond: 'Cadet programme FAQs' } },
  'air-france.jobs.c-cadet-alert': { h: 'e86bc714a9075521', label: '養成コースの募集', value: '次の募集のお知らせを受け取る登録を案内（いま受付中とは書かれていない）', cond: '養成コース（cadet）のQ&A', en: { label: 'Cadet recruitment', value: 'Sign-up for alerts about the next intake (not stated as open now)', cond: 'Cadet programme FAQs' } },
  'air-france.jobs.c-selection-languages': { h: 'c3869e17820bb522', label: '応募の条件（言語）', value: '英語の語学能力レベル5以上と TOEIC 850点以上（2年以内）。フランス語が母語でない人はフランス語の語学能力レベル6', cond: '経験者（professional）の選考の案内', en: { label: 'Requirements (language)', value: 'English proficiency level 5 or above and TOEIC 850 or above (within 2 years); non-native French speakers need French proficiency level 6', cond: 'Selection guide for experienced (professional) pilots' } },
  'air-france.work.c-cadet-failure': { h: '56bc04a463fda70b', label: '訓練費の返済（訓練生）', value: '訓練で不合格となって契約が終わるとき、受けた訓練の費用の返済は求められない', cond: '養成コース（cadet）のQ&A。自分から辞めるときは書かれていない', en: { label: 'Training cost repayment (cadets)', value: 'No repayment of training already received if the contract ends because training is not passed', cond: 'Cadet programme FAQs. Resignation is not covered' } },
  'air-france.work.pub-cadet-fulltime': { h: 'c150101ba64efe64', label: '訓練の期間', value: '24か月のフルタイムの課程（ほかの仕事との掛け持ちはできない）', cond: '養成コース（cadet）のQ&A', en: { label: 'Training duration', value: 'A 24-month full-time course (no other job alongside)', cond: 'Cadet programme FAQs' } },
  /* エア・カナダ */
  'air-canada.benefits.r10-fr38766-staff-travel': { h: '988b3485ac2954f3', label: '社員の航空券', value: '本人・家族・友人の特別運賃と旅行パス、他社との相互の特典', cond: 'パイロットの求人（Air Canada Express 以外から応募する人）', en: { label: 'Staff travel', value: 'Special fares and travel passes for you, family and friends, plus reciprocal benefits with other airlines', cond: 'Pilot vacancy (for applicants not coming from Air Canada Express)' } },
  'air-canada.benefits.r10-fr38766-uby-support': { h: '25921939e66a4b4b', label: '心と体の相談', value: 'UBY（カウンセラー・セラピストにつながる支援）', cond: 'パイロットの求人（Air Canada Express 以外から応募する人）', en: { label: 'Wellbeing support', value: 'UBY (access to a network of counsellors and therapists)', cond: 'Pilot vacancy (for applicants not coming from Air Canada Express)' } },
  'air-canada.fleet.a321xlr-entry': { h: 'a5c198de0cf97d05', fleet: 'エアバス A321XLR', en: { fleet: 'Airbus A321XLR' } },
  /* ブリティッシュ・エアウェイズ */
  'british-airways.benefits.c-heathrow-express-discount': { h: '678a29b3d629607c', label: '通勤', value: 'ヒースロー・エクスプレスの割引（75%）', cond: '社員ぜんたいの特典の案内（パイロットの条件は書かれていない）', en: { label: 'Commuting', value: 'Heathrow Express discount (75%)', cond: 'Benefits overview for all employees (pilots’ terms are not stated)' } },
  'british-airways.benefits.default-pension-on-job-page': { h: 'b9c7eb51d1dab476', label: '年金', value: '確定拠出年金（本人2%・会社7%から。拠出を増やす選択肢あり）', cond: 'A320 型式限定を持つ経験者の求人（福利厚生の欄）', en: { label: 'Pension', value: 'Defined-contribution pension (from 2% employee and 7% employer, with options to increase)', cond: 'Vacancy for A320 type-rated pilots (benefits section)' } },
  'british-airways.benefits.pension': { h: 'af21d836d31f6743', label: '年金（会社の拠出の上限）', value: '会社の拠出は最大15%', cond: 'A320 型式限定を持つ経験者の求人', en: { label: 'Pension (employer contribution cap)', value: 'Employer contributions of up to 15%', cond: 'Vacancy for A320 type-rated pilots' } },
  'british-airways.benefits.pub-medical-posting': { h: '5b693f54915ba05e', label: '保険', value: '民間の医療保険', cond: 'A320 型式限定を持つ経験者の求人', en: { label: 'Insurance', value: 'Private medical cover', cond: 'Vacancy for A320 type-rated pilots' } },
  'british-airways.benefits.pub-staff-travel-job': { h: 'aca2e49d80bcdd6d', label: '社員の航空券', value: '入社の日から、空席待ちの航空券と確定席の割引運賃（最大30回分）。本人・友人・家族', cond: 'A320 型式限定を持つ経験者の求人', en: { label: 'Staff travel', value: 'Standby tickets and up to 30 confirmed discounted fares from the day you join, for you, friends and family', cond: 'Vacancy for A320 type-rated pilots' } },
  'british-airways.benefits.r6-pension-bapp': { h: '506f7bf410ebf5ca', label: '年金', value: '本人が6%を拠出すると、会社が15%を拠出（British Airways Pension Plan）', cond: '経験者の上級副操縦士（SFO）の採用案内（2026年）', lead: true, en: { label: 'Pension', value: 'If you contribute 6%, the company contributes 15% (British Airways Pension Plan)', cond: 'Recruitment pack for experienced senior first officers (2026)' } },
  'british-airways.benefits.r6-staff-travel-firstday': { h: '04ff37a331f8bfc3', label: '社員の航空券（入社の日から）', value: '空席待ちの航空券（ID90）と確定席の割引（Hotline）', cond: '経験者の上級副操縦士（SFO）の採用案内（2026年）。契約ではなく会社の裁量の特典', en: { label: 'Staff travel (from day one)', value: 'Standby tickets (ID90) and confirmed-seat discounts (Hotline)', cond: 'Recruitment pack for experienced senior first officers (2026). A discretionary, non-contractual benefit' } },
  'british-airways.benefits.r6-staff-travel-id100': { h: '385835654839002b', label: '社員の航空券（6か月後から）', value: '年2枚の予約できる航空券（ID100）。副操縦士はビジネスクラス、上級副操縦士と機長はファーストクラス', cond: '経験者の上級副操縦士（SFO）の採用案内（2026年）。契約ではなく会社の裁量の特典', en: { label: 'Staff travel (after six months)', value: 'Two annual bookable tickets (ID100): Business class for first officers, First class for senior first officers and captains', cond: 'Recruitment pack for experienced senior first officers (2026). A discretionary, non-contractual benefit' } },
  'british-airways.benefits.r6-staff-travel-nominees': { h: 'e973124635db96ba', label: '社員の航空券の対象', value: '友人・親族3人か、友人・親族2人と同じ世帯の24歳未満の子。3か月ごとに変えられる', cond: '経験者の上級副操縦士（SFO）の採用案内（2026年）', en: { label: 'Who staff travel covers', value: 'Three friends or relatives, or two friends or relatives plus children under 24 in the same household; changes every three months', cond: 'Recruitment pack for experienced senior first officers (2026)' } },
  'british-airways.benefits.speedbird-training-housing': { h: '3a7e272f29263afa', label: '訓練生の住まい', value: '飛行学校での訓練の間は、会社が宿泊を用意して費用を負担', cond: 'Speedbird Pilot Academy のQ&A（2026年4月14日時点）。入社後に拠点の空港で型式訓練を受けるときの宿泊は自分で手配', en: { label: 'Cadet accommodation', value: 'During flight school training the company arranges and pays for accommodation', cond: 'Speedbird Pilot Academy FAQs (as of 14 April 2026). For type training at the base airport after joining, you arrange your own accommodation' } },
  'british-airways.jobs.a320-open': { h: '799805e560fb4514', label: '募集の受付', value: 'A320 型式限定を持つ経験者の求人（2026年10月25日締切）', cond: 'A320 型式限定を持つ経験者の求人（英国の免許）', en: { label: 'Recruitment', value: 'Vacancy for A320 type-rated pilots (closing 25 October 2026)', cond: 'Vacancy for A320 type-rated pilots (UK licence)' } },
  'british-airways.jobs.academy-2026-closed': { h: 'caf24edf57bc4b87', label: '養成コースの募集', value: '2026年の募集は締め切った', cond: 'Future Pilots（Speedbird Pilot Academy）の案内', en: { label: 'Cadet recruitment', value: 'Applications for 2026 have closed', cond: 'Future Pilots (Speedbird Pilot Academy) guide' } },
  'british-airways.work.bond': { h: 'd55f88efdaad9322', label: '訓練費の拘束', value: '移行訓練・型式訓練は会社負担で、拘束（ボンド）は無い', cond: 'A320 型式限定を持つ経験者の求人', en: { label: 'Training bond', value: 'Conversion and type training are paid by the company, with no bond', cond: 'Vacancy for A320 type-rated pilots' } },
  'british-airways.work.speedbird-training-schools': { h: '9c06a4ca178f9a94', label: '訓練の場所', value: 'FTEJerez か Skyborne（希望は聞くが、配属は約束されない）', cond: 'Speedbird Pilot Academy のQ&A（2026年4月14日時点）', en: { label: 'Training locations', value: 'FTEJerez or Skyborne (preferences are asked but not guaranteed)', cond: 'Speedbird Pilot Academy FAQs (as of 14 April 2026)' } },
  /* エアX・チャーター */
  'airx-charter.jobs.c-a340-fo-listing': { h: '28a1459954a19696', label: '募集の受付', value: 'A340 の副操縦士の募集を掲載（締切と条件の全文は確認できていない）', cond: '会社の採用ページ', en: { label: 'Recruitment', value: 'An A340 first officer vacancy is listed (the closing date and full terms could not be confirmed)', cond: 'Company careers page' } },
  'airx-charter.jobs.c-cl604-instructors': { h: '816269708c341dd9', label: '募集している職種', value: 'チャレンジャー CL604/605 の型式の教官・審査官（TRI/TRE）', cond: '会社の採用ページ', en: { label: 'Roles being hired', value: 'Challenger CL604/605 type rating instructors and examiners (TRI/TRE)', cond: 'Company careers page' } },
  /* イーグルジェット・インターナショナル */
  'eagle-jet.work.pub-programme-provider': { h: '6b53e060c1ac7c2d', label: '訓練の場所', value: '欧州の提携訓練機関（ATO）で型式訓練、そのあと提携先の航空会社で OCC と300・500時間のプログラム', cond: 'EASA A320 副操縦士プログラムの案内（提携先の名前は書かれていない）', en: { label: 'Training locations', value: 'Type training at a partner training organisation (ATO) in Europe, then OCC and a 300- or 500-hour programme with a partner airline', cond: 'EASA A320 first officer programme guide (partners are not named)' } },
  /* ソレイラス・アビエーション */
  'solairus.benefits.missing-medical': { h: '943d4c456b1747bf', label: '保険', value: '健康とウェルネスの制度', cond: 'G450・G550 の機長の求人（オースティン）', en: { label: 'Insurance', value: 'Health and wellness benefits', cond: 'G450 and G550 captain vacancy (Austin)' } },
  'solairus.benefits.missing-pension': { h: 'aade4647e9148f84', label: '年金', value: '401(k) のマッチング', cond: 'G450・G550 の機長の求人（オースティン）', en: { label: 'Pension', value: '401(k) matching', cond: 'G450 and G550 captain vacancy (Austin)' } },
  'solairus.benefits.r10-pc24-commutable-2002': { h: '5fd1980f39c4d708', label: '通勤（PC-24 の機長）', value: '通勤できる形の募集。大きな空港から車で2時間以内に住むか、引っ越せること', cond: 'PC-24 の機長の求人（2026-2002）', en: { label: 'Commuting (PC-24 captains)', value: 'A commutable vacancy: live within a two-hour drive of a major commercial airport, or be willing to relocate', cond: 'PC-24 captain vacancy (2026-2002)' } },
  'solairus.jobs.gv-job': { h: 'a8fa95e63b8faeaf', label: '募集の受付', value: 'ヴァンナイズのガルフストリーム GV の機長（常勤）', cond: '会社の求人', en: { label: 'Recruitment', value: 'Gulfstream GV captain at Van Nuys (full-time)', cond: 'Company vacancy' } },
  'solairus.jobs.missing-entry-open': { h: '9bfae6aad1c56865', label: '募集の受付', value: '公開の求人一覧に GV の機長と G450・G550 の機長の求人（2026年10月19日に確認）', cond: '会社の求人一覧', en: { label: 'Recruitment', value: 'GV captain and G450/G550 captain vacancies in the public job list (checked on 19 October 2026)', cond: 'Company job list' } },
  'solairus.profile.hq': { h: '1d3def018ac12620', label: '本社', value: 'サンフランシスコ・ベイエリア', en: { label: 'Headquarters', value: 'San Francisco Bay Area' } },
  'solairus.work.missing-roster-pattern': { h: '198f4e01c5f1a222', label: '勤務の形', value: '呼び出し（オンコール）を含む、決まっていない勤務', cond: 'G450・G550 の機長の求人（オースティン）', en: { label: 'Working pattern', value: 'Irregular duty, including on-call', cond: 'G450 and G550 captain vacancy (Austin)' } },
  /* ターキッシュ エアラインズ */
  'turkish-airlines.benefits.pub-general-family-travel': { h: '605cd96686c2ea53', label: '社員の航空券', value: 'Pass・ZED は勤続1年を超えてから、CED は3か月を超えてから。配偶者と子も対象', cond: '社員ぜんたいの制度の案内（国ごとの法律で違いがある）', en: { label: 'Staff travel', value: 'Pass and ZED tickets after more than one year of service, CED after more than three months; spouses and children are included', cond: 'Benefits overview for all employees (varies with each country’s law)' } },
  'turkish-airlines.fleet.a319': { h: '11a172fb4289f78f', fleet: 'エアバス A319', en: { fleet: 'Airbus A319' } },
  'turkish-airlines.profile.country': { h: '1f35a69060e4b9c7', label: '本社', value: 'トルコ', en: { label: 'Headquarters', value: 'Turkey' } },
  'turkish-airlines.work.c-roster-publication': { h: '24d3c954ad0ff544', label: '勤務表の公表', value: '翌月の勤務表は、31日の月は24日、30日の月は23日に公表', cond: '採用ページのQ&A（いつの版かは書かれていない）', en: { label: 'Roster publication', value: 'Next month’s roster is published on the 24th in 31-day months and on the 23rd in 30-day months', cond: 'Recruitment FAQs (the date of the version is not stated)' } },
  /* エーゲ航空 */
  'aegean.benefits.c-medical': { h: '1624ea3ff8c41dd8', label: '保険', value: '民間の医療保険', cond: '型式限定を持たない副操縦士（A320・ATR42/72）の募集（エーゲ航空とオリンピック航空）', en: { label: 'Insurance', value: 'Private health insurance', cond: 'Vacancy for non-type-rated first officers (A320 and ATR42/72) at Aegean and Olympic Air' } },
  'aegean.benefits.c-pension': { h: 'e2df0a83e8fcb264', label: '年金', value: '年金の制度（拠出の率は書かれていない）', cond: '型式限定を持たない副操縦士（A320・ATR42/72）の募集（エーゲ航空とオリンピック航空）', en: { label: 'Pension', value: 'A pension scheme (contribution rates are not stated)', cond: 'Vacancy for non-type-rated first officers (A320 and ATR42/72) at Aegean and Olympic Air' } },
  'aegean.benefits.c-travel': { h: '78ba8aaac18550ed', label: '社員の航空券', value: '世界の航空券の優待', cond: '型式限定を持たない副操縦士（A320・ATR42/72）の募集（エーゲ航空とオリンピック航空）', en: { label: 'Staff travel', value: 'Worldwide staff travel benefits', cond: 'Vacancy for non-type-rated first officers (A320 and ATR42/72) at Aegean and Olympic Air' } },
  'aegean.benefits.extra-cap-profitability-bonus': { h: '175561d57ad9317c', label: '業績に応じた賞与', value: '会社の業績に応じた年1回の利益賞与の対象になる（額と率は書かれていない）', cond: 'A320 型式限定を持つ機長の募集', en: { label: 'Profit-related bonus', value: 'Eligible for an annual profitability bonus based on company performance (amount and rate are not stated)', cond: 'Vacancy for A320 type-rated captains' } },
  'aegean.jobs.c-fo-open': { h: '3abff29ec70369f7', label: '募集の受付', value: '型式限定を持たない副操縦士（A320・ATR42/72）を募集（2026年12月31日締切）', cond: '会社の募集ページ', en: { label: 'Recruitment', value: 'Hiring non-type-rated first officers for the A320 and ATR42/72 (closing 31 December 2026)', cond: 'Company vacancy page' } },
  'aegean.jobs.followup-agent-followup-ntr-fo-employment-location': { h: '0728ee855cc4a82d', label: '勤務地', value: 'アテネ国際空港（スパタ）', cond: '型式限定を持たない副操縦士（A320・ATR42/72）の募集', en: { label: 'Place of work', value: 'Athens International Airport (Spata)', cond: 'Vacancy for non-type-rated first officers (A320 and ATR42/72)' } },
  'aegean.jobs.pub-scholarship-deadline': { h: '15ae50804b14edb5', label: '奨学金の募集の締切', value: '2026年10月16日（2027年1月に訓練を始める回）', cond: '2026年の奨学金の募集の案内', en: { label: 'Scholarship closing date', value: '16 October 2026 (for training starting in January 2027)', cond: '2026 scholarship intake notice' } },
  'aegean.work.pub-scholarship-schools': { h: '7b1689e0bc7bc4ba', label: '訓練の場所（奨学金）', value: 'アテネの Global Aviation Academy と、カヴァラの Egnatia Aviation Academy', cond: 'ギリシャ・キプロスの人向けの奨学金の案内', en: { label: 'Training locations (scholarship)', value: 'Global Aviation Academy in Athens and Egnatia Aviation Academy in Kavala', cond: 'Scholarship programme for Greek and Cypriot applicants' } },
  /* エア・リンガス */
  'aer-lingus.jobs.c-cadet-campaign-end': { h: 'a8ec9cf26f671718', label: '養成コースの募集', value: '2025年2月10日で締め切った', cond: 'Future Pilot Programme の募集の発表', en: { label: 'Cadet recruitment', value: 'Closed on 10 February 2025', cond: 'Future Pilot Programme announcement' } },
  'aer-lingus.work.c-historical-roster': { h: '3e30897d8e623e23', label: '勤務の形（例）', value: '5日勤務・3日休みの決まった形', cond: '2019年の会社のインタビュー（副操縦士1人の例）', en: { label: 'Working pattern (example)', value: 'A fixed pattern of five days on, three days off', cond: '2019 company interview (one first officer’s example)' } },
  'aer-lingus.work.training-place': { h: 'dbb53b2dcca19969', label: '訓練の場所', value: 'ダブリンの Aer Lingus Training Academy（訓練の後半）', cond: 'Future Pilot Programme の案内（2025年）', en: { label: 'Training locations', value: 'Aer Lingus Training Academy in Dublin (later phase of training)', cond: 'Future Pilot Programme guide (2025)' } },
  /* オーストリア航空 */
  'austrian.jobs.c-ready-entry-language': { h: 'e672098673f0fda4', label: '応募の条件（言語）', value: '選考はドイツ語。ドイツ語と英語の十分な力が要る', cond: 'Ready Entry（経験者）の選考の案内', en: { label: 'Requirements (language)', value: 'Selection is in German; good German and English are required', cond: 'Ready Entry (experienced pilots) selection guide' } },
  'austrian.work.c-ready-entry-bond': { h: '8b8ee2aff5a76c88', label: '訓練の拘束', value: '3年', cond: 'Ready Entry（経験者）の案内。返す額や減り方は書かれていない', en: { label: 'Training bond', value: '3 years', cond: 'Ready Entry (experienced pilots) guide. Repayment amounts and reductions are not stated' } },
  /* イージージェット */
  'easyjet.benefits.followup-agent-followup-gatwick-captain-travel2027': { h: 'f65fa373738e1788', label: '社員の航空券', value: '航空券の割引', cond: 'ロンドン・ガトウィックの機長（型式限定なし）の2027年の求人', en: { label: 'Staff travel', value: 'Staff travel discounts', cond: 'London Gatwick vacancy for non-type-rated captains (2027)' } },
  'easyjet.jobs.c-southend-2027': { h: 'c5145aa01fe24f80', label: '募集の受付', value: 'A320 型式限定を持つ機長を、2027年に始まる常勤の契約で募集（締切は書かれていない）', cond: 'ロンドン・サウスエンドの求人', en: { label: 'Recruitment', value: 'Hiring A320 type-rated captains on permanent contracts starting in 2027 (no closing date is stated)', cond: 'London Southend vacancy' } },
  'easyjet.jobs.copilot-requirement': { h: '93d9a603840a2520', label: '応募の条件（型式限定のある副操縦士）', value: 'A320 の飛行時間500時間以上', cond: 'パイロットの採用ページ', en: { label: 'Requirements (type-rated first officers)', value: 'At least 500 hours on the A320', cond: 'Pilot recruitment page' } },
  'easyjet.jobs.followup-agent-followup-gatwick-captain-job-base2027': { h: 'c8d4341bd29378a1', label: '勤務地', value: 'ロンドン・ガトウィック（この求人だけ）', cond: 'ロンドン・ガトウィックの機長（型式限定なし）の2027年の求人', en: { label: 'Place of work', value: 'London Gatwick (this vacancy only)', cond: 'London Gatwick vacancy for non-type-rated captains (2027)' } },
  'easyjet.work.roster': { h: '73607d59ed394c89', label: '勤務の形', value: '勤務表は数週間前に分かり、泊まりの勤務は少ない', cond: 'パイロットの採用ページ', en: { label: 'Working pattern', value: 'Rosters are known weeks in advance and night stops are rare', cond: 'Pilot recruitment page' } },
  /* ユーロウイングス */
  'eurowings.benefits.c-parking': { h: '41fb2a405fcdbbe7', label: '通勤', value: '無料の駐車場', cond: 'パイロットの採用ページ（ブランドぜんたいの紹介）', en: { label: 'Commuting', value: 'Free parking', cond: 'Pilot recruitment page (brand-wide overview)' } },
  'eurowings.benefits.c-travel': { h: '9745ae2fcf9562c4', label: '社員の航空券', value: '航空券の優待と、年1回の休暇の旅行便', cond: 'パイロットの採用ページ（ブランドぜんたいの紹介）', en: { label: 'Staff travel', value: 'Travel discounts and an annual holiday flight', cond: 'Pilot recruitment page (brand-wide overview)' } },
  'eurowings.jobs.fo-open': { h: 'ff1dfc31e7ebe33d', label: '募集の受付', value: '副操縦士（型式限定あり・なし）の募集を掲載', cond: '会社の求人一覧', en: { label: 'Recruitment', value: 'First officer vacancies (type-rated and non-type-rated) are listed', cond: 'Company vacancy list' } },
  'eurowings.work.c-type': { h: '553cd290a5d9afef', label: '型式の訓練の費用', value: '無料（会社負担）', cond: 'パイロットの採用ページ（ブランドぜんたいの紹介）', en: { label: 'Type rating cost', value: 'Free (paid by the company)', cond: 'Pilot recruitment page (brand-wide overview)' } },
  /* フィンエアー */
  'finnair.benefits.pub-mpl-housing': { h: '3cfd2db593dc54b4', label: '訓練生の住まい', value: 'フィンランドでもデンマークでも本人の負担（提携校の安い寮の案内あり）', cond: 'MPL（自社養成）のQ&A', en: { label: 'Cadet accommodation', value: 'Paid by the cadet in both Finland and Denmark (partner schools point to low-cost dorms)', cond: 'MPL (cadet) programme FAQs' } },
  'finnair.benefits.pub-mpl-travel': { h: 'a7e521191e11c40c', label: '訓練生の移動', value: '始めのデンマーク行きと、海外の課程を終えて戻る便は会社が手配。ほかの往復は本人', cond: 'MPL（自社養成）のQ&A', en: { label: 'Cadet travel', value: 'The company arranges the first trip to Denmark and the flight home after the training abroad; other trips are the cadet’s own', cond: 'MPL (cadet) programme FAQs' } },
  'finnair.jobs.c-mpl-hiring-priority': { h: '91e43a726214b29f', label: '養成コース修了者の採用', value: '修了から5年間、A320 の副操縦士の採用で優先される（すぐの採用の約束ではない）', cond: '2026年の会社の記事（MPL の修了者の話）', en: { label: 'Hiring after the cadet programme', value: 'Priority in A320 first officer hiring for five years after graduation (not a promise of immediate hiring)', cond: '2026 company article (an MPL graduate’s story)' } },
  'finnair.jobs.languages': { h: 'e7f1d8f0ed823946', label: '応募の条件（言語）', value: 'フィンランド語と英語', cond: 'パイロットの採用ページ', en: { label: 'Requirements (language)', value: 'Finnish and English', cond: 'Pilot recruitment page' } },
  'finnair.jobs.pub-mpl-applications-closed': { h: 'b9828772ae3a2379', label: '養成コースの募集', value: '受付は締め切った', cond: 'MPL（自社養成）のページの表示（確認した時点）', en: { label: 'Cadet recruitment', value: 'The application period has closed', cond: 'MPL (cadet) programme page (when checked)' } },
  'finnair.work.pub-mpl-facility': { h: '69d4744b8e01a0ea', label: '訓練の場所', value: '最初の18〜20か月はロスキレの CenterAir、最後の A320 のシミュレーターはヴァンターの Finnair Flight Academy', cond: 'MPL（自社養成）のQ&A', en: { label: 'Training locations', value: 'CenterAir in Roskilde for the first 18–20 months, and the final A320 simulator phase at Finnair Flight Academy in Vantaa', cond: 'MPL (cadet) programme FAQs' } },
  'finnair.work.training-place': { h: '1e92fbb3deb6f384', label: '訓練の場所', value: 'ポリの Finnish Aviation Academy（基礎の訓練）', cond: 'パイロットの採用ページ', en: { label: 'Training locations', value: 'Finnish Aviation Academy in Pori (basic training)', cond: 'Pilot recruitment page' } },
  /* イベリア航空 */
  'iberia.jobs.c-job2025-unavailable': { h: 'b8ebaff319deafd0', label: '募集の受付', value: '2025年の新人パイロットの求人は、いまは表示されない', cond: '2025年の新人パイロットの求人のページ', en: { label: 'Recruitment', value: 'The 2025 vacancy for new-entry pilots is no longer available', cond: '2025 new-entry pilot vacancy page' } },
  /* ITAエアウェイズ */
  'ita-airways.jobs.c-application-channels': { h: '0a59e7e70e648c18', label: '応募の方法', value: '会社の「Work with Us」のページと、会社の LinkedIn の求人', cond: '会社の採用ページ', en: { label: 'How to apply', value: 'The company’s “Work with Us” page and the job offers on its LinkedIn page', cond: 'Company careers page' } },
  /* LOTポーランド航空 */
  'lot.benefits.r3-general-medical': { h: 'eb05ed10636eb38c', label: '医療', value: 'LUX MED の医療パッケージ（年齢や必要に応じて）', cond: '社員ぜんたいの福利厚生の案内（パイロットの契約に当てはまるかは書かれていない）', en: { label: 'Medical', value: 'LUX MED medical packages (by age and need)', cond: 'Benefits overview for all employees (whether it applies to pilots’ contracts is not stated)' } },
  'lot.benefits.r3-general-stafftravel': { h: '59196a8618f724b1', label: '社員の航空券', value: '本人と近親者の航空券の割引', cond: '社員ぜんたいの福利厚生の案内（パイロットの契約に当てはまるかは書かれていない）', en: { label: 'Staff travel', value: 'Flight discounts for employees and their close family', cond: 'Benefits overview for all employees (whether it applies to pilots’ contracts is not stated)' } },
  'lot.jobs.c-a220-fo-post': { h: '3b80bce2329da996', label: '募集の受付', value: 'A220 型式限定を持つ副操縦士の募集を掲載（締切と人数は書かれていない）', cond: 'LOT Crew（LOT の乗員の会社）の求人', en: { label: 'Recruitment', value: 'A vacancy for A220 type-rated first officers is listed (no closing date or numbers are stated)', cond: 'Vacancy at LOT Crew (LOT’s crew company)' } },
  'lot.work.c-two-week-roster': { h: 'ecf176433783f0ad', label: '勤務表の公表', value: '翌月が始まる2週間前に、月の勤務表を公表', cond: 'A220 の副操縦士の求人（LOT Crew）', en: { label: 'Roster publication', value: 'The monthly roster is published two weeks before the month starts', cond: 'A220 first officer vacancy (LOT Crew)' } },
  /* ノルウェー・エアシャトル */
  'norwegian.jobs.followup-agent-followup-helsinki-airport-pilot-employment-2025': { h: 'f370c812a6b3054c', label: '採用の勤務地（2025年）', value: 'ヘルシンキ・ヴァンター空港', cond: '2025年9月15日の会社の発表（パイロットの採用）', en: { label: 'Place of work in 2025 hiring', value: 'Helsinki-Vantaa Airport', cond: 'Company announcement of 15 September 2025 (pilot hiring)' } },
  'norwegian.jobs.open': { h: 'cc35c298e5970ad9', label: '募集の受付', value: 'パイロットの求人は無い（2026年10月19日の表示）', cond: '会社のパイロットの採用ページ', en: { label: 'Recruitment', value: 'No open pilot positions (as shown on 19 October 2026)', cond: 'Company pilot recruitment page' } },
  /* ライアンエアー */
  'ryanair.jobs.followup-agent-followup-uk-dac-cadet-assessment-fee': { h: '31f79ee0498630aa', label: '選考の費用（訓練生）', value: '選考の前のオンライン試験の費用は本人が払う（試験の会社へ直接）', cond: '英国・EASA の訓練生の募集', en: { label: 'Selection cost (cadets)', value: 'Candidates pay for the online pre-assessment directly to the testing company', cond: 'UK and EASA cadet recruitment' } },
  'ryanair.work.c-no-planned-overnights': { h: 'b91b56021984dbb4', label: '泊まりの勤務', value: '計画された泊まりの勤務は無い', cond: 'グループの経験者の採用案内', en: { label: 'Overnights', value: 'No planned overnights', cond: 'Group recruitment guide for experienced pilots' } },
  'ryanair.work.c-roster-notice': { h: 'd562189317481df7', label: '勤務表の公表', value: '4週間前', cond: 'グループの経験者の採用案内', en: { label: 'Roster publication', value: 'Four weeks in advance', cond: 'Group recruitment guide for experienced pilots' } },
  'ryanair.work.roster-advertised': { h: '335d6a9b1fcb1c8f', label: '勤務の形', value: '5日勤務・4日休みの決まった形', cond: 'グループの経験者の採用案内', en: { label: 'Working pattern', value: 'A fixed pattern of five days on, four days off', cond: 'Group recruitment guide for experienced pilots' } },
  /* スカンジナビア航空 */
  'sas.benefits.c-layover-hotels': { h: '731248e24fdd240a', label: '滞在先のホテル', value: '泊まりの勤務では、ホテルと移動を会社が用意', cond: 'SAS のパイロットの仕事の案内', en: { label: 'Layover hotels', value: 'On layovers the company provides the hotel and transport', cond: 'SAS guide to life as a pilot' } },
  'sas.benefits.pub-faq-medical': { h: '0d1b7b608cd010ce', label: '医療', value: '医療の保障（内容は書かれていない）', cond: 'パイロットのQ&A（雇用と条件）', en: { label: 'Medical', value: 'Healthcare coverage (details are not stated)', cond: 'Pilot FAQs (employment and conditions)' } },
  'sas.benefits.pub-faq-pension': { h: '05f384bbac25fc64', label: '年金', value: '年金の制度と拠出（率は書かれていない）', cond: 'パイロットのQ&A（雇用と条件）', en: { label: 'Pension', value: 'Pension schemes and contributions (rates are not stated)', cond: 'Pilot FAQs (employment and conditions)' } },
  'sas.benefits.pub-faq-travel': { h: 'de1b41fc7eba574a', label: '社員の航空券', value: '社員の航空券の特典（個人の ID チケット）', cond: 'パイロットのQ&A（雇用と条件）', en: { label: 'Staff travel', value: 'Staff travel privileges (personal ID travel)', cond: 'Pilot FAQs (employment and conditions)' } },
  'sas.fleet.pub-connect-a320neo': { h: '0a8260aaa450cd25', fleet: 'エアバス A320neo', en: { fleet: 'Airbus A320neo' } },
  'sas.fleet.pub-link-e195': { h: 'bac0f0e8af71bf3a', fleet: 'エンブラエル E195', en: { fleet: 'Embraer E195' } },
  'sas.jobs.c-e195-job-current': { h: '5c87140191e01241', label: '募集の受付', value: 'E195 の機長（型式限定あり・なし）を募集。通年で受け付け、早く締め切ることがある', cond: 'E195 の機長の求人（全基地）', en: { label: 'Recruitment', value: 'Hiring E195 captains (type-rated and non-type-rated) year-round; the vacancy may close early', cond: 'E195 captain vacancy (all bases)' } },
  'sas.work.c-training-bond': { h: '680a2f2ecb4a6b6c', label: '訓練の拘束', value: '36か月（入社後に会社が訓練費を負担）', cond: 'パイロットのQ&A。返す額や免除は書かれていない', en: { label: 'Training bond', value: '36 months (the company pays for training after you join)', cond: 'Pilot FAQs. Repayment amounts and waivers are not stated' } },
  'sas.work.c-variable-group': { h: '5c27861fca22f82e', label: '勤務の形（新しく入った人）', value: 'Variable Group。月に11日以上の休み。週末や追加の2日の休みを希望できる', cond: 'SAS のパイロットの仕事の案内', en: { label: 'Working pattern (new joiners)', value: 'Variable Group: at least 11 days off a month, with bids for weekends or two extra days off', cond: 'SAS guide to life as a pilot' } },
  /* スイス インターナショナル エアラインズ */
  'swiss.benefits.c-school-housing-scope': { h: 'b0a13ea256b71a0a', label: '訓練生の住まい', value: 'フェニックス・グレンヒェンの実技の訓練は宿泊つき。チューリッヒの学科（12か月）は宿泊を含まない', cond: '自社養成の訓練費の案内', en: { label: 'Cadet accommodation', value: 'Practical training in Phoenix and Grenchen includes accommodation; the 12-month theory phase in Zurich does not', cond: 'Cadet training cost guide' } },
  'swiss.benefits.r10-eub3-cockpit-occupational-medicine': { h: 'dba488f71c4e6ccf', label: '航空医学のサービス', value: '会社の医療部門（SWISS Medical Services）が、パイロットの航空身体検査と、乗員の予防・旅行医学の相談を行う', cond: '会社の医療部門の案内', en: { label: 'Aviation medicine', value: 'The company’s medical department (SWISS Medical Services) provides pilots’ aeromedical examinations and prevention and travel-medicine advice for crew', cond: 'Company medical department guide' } },
  'swiss.benefits.r13-general-employee-commuting': { h: 'c329577c92c53f83', label: '通勤', value: '公共交通の割引切符・補助のあるバス路線・補助のある駐車場', cond: '社員ぜんたいの特典の案内', en: { label: 'Commuting', value: 'Reduced public transport tickets, subsidised bus lines and subsidised parking', cond: 'Offers for all employees' } },
  'swiss.benefits.r13-general-employee-medical': { h: 'e988b5e2d8b952ab', label: '保険', value: '追加の医療保険の割引', cond: '社員ぜんたいの特典の案内', en: { label: 'Insurance', value: 'Discounts on additional health insurance', cond: 'Offers for all employees' } },
  'swiss.benefits.staff-travel': { h: '94dde833305f6fb3', label: '社員の航空券', value: '本人と大切な人の航空券の優待', cond: 'パイロットの採用ページ', lead: true, en: { label: 'Staff travel', value: 'Travel benefits for you and your loved ones', cond: 'Pilot recruitment page' } },
  'swiss.jobs.c-employment-final-decision': { h: '844957919b5b3d83', label: '養成コース修了者の採用', value: '訓練を終えたあと、会社があらためて採用を決める（訓練を始めた時点の採用の約束ではない）', cond: 'パイロットの採用ページ', en: { label: 'Hiring after the cadet programme', value: 'After training the company reviews and makes the final hiring decision (no guarantee when training starts)', cond: 'Pilot recruitment page' } },
  'swiss.jobs.followup-agent-followup-a320fo-job-location': { h: '53f3f324668b7e4e', label: '勤務地', value: 'チューリッヒ空港', cond: 'A320 の経験者の副操縦士の求人', en: { label: 'Place of work', value: 'Zurich Airport', cond: 'Vacancy for experienced A320 first officers' } },
  'swiss.jobs.followup-agent-followup-a320fo-minimum-experience': { h: '6228036c87eebda4', label: '応募の条件', value: 'A320 ファミリーの飛行経験800時間以上', cond: 'A320 の経験者の副操縦士の求人', en: { label: 'Requirements', value: 'At least 800 hours on the A320 family', cond: 'Vacancy for experienced A320 first officers' } },
  'swiss.work.training-location': { h: '6b1e8ed8035bdfee', label: '訓練の場所', value: 'グレンヒェン（スイス）とフェニックス（米国）（実技の訓練）', cond: 'パイロットの採用ページ', en: { label: 'Training locations', value: 'Grenchen (Switzerland) and Phoenix (USA) for practical training', cond: 'Pilot recruitment page' } },
  /* TAPポルトガル航空 */
  'tap.jobs.c-pilot-category-empty': { h: '2bc4d9d208bb255a', label: '募集の受付', value: 'パイロットの求人は無く、自分から送る応募も受け付けていない（確認した時点）', cond: '会社の採用ページ', en: { label: 'Recruitment', value: 'No pilot vacancies, and unsolicited applications are not accepted (when checked)', cond: 'Company careers page' } },
  /* ヴァージン・アトランティック航空 */
  'virgin-atlantic.benefits.c-pilot-medical': { h: '7ffa0c53ff658405', label: '医療', value: '民間の医療保険（英国に住む人）', cond: 'パイロットの採用ページ', en: { label: 'Medical', value: 'Private medical insurance (for UK residents)', cond: 'Pilot recruitment page' } },
  'virgin-atlantic.benefits.c-pilot-pension': { h: '886e2e4f8a050178', label: '年金', value: '本人6%・会社15%', cond: 'パイロットの採用ページ（契約ではない特典は変わることがある）', lead: true, en: { label: 'Pension', value: '6% employee and 15% employer', cond: 'Pilot recruitment page (non-contractual benefits may change)' } },
  'virgin-atlantic.benefits.pub-paid-leave-existence': { h: '4b22ab66e7ef009f', label: '休暇', value: '有給の年次休暇（日数は書かれていない）', cond: 'パイロットの採用ページ', en: { label: 'Leave', value: 'Paid annual leave (the number of days is not stated)', cond: 'Pilot recruitment page' } },
  'virgin-atlantic.benefits.pub-pilot-travel': { h: 'c77f012aa68c83a2', label: '社員の航空券', value: '自社と一部の他社の航空券の特典', cond: 'パイロットの採用ページ', en: { label: 'Staff travel', value: 'Staff travel on the company’s own and selected other airlines', cond: 'Pilot recruitment page' } },
  'virgin-atlantic.jobs.c-future-flyers-paused': { h: '73b8846d3b5a30cd', label: '養成コースの募集', value: '作り直しのため、いまは休止', cond: 'パイロットのQ&A', en: { label: 'Cadet recruitment', value: 'Currently paused while it is being redesigned', cond: 'Pilot FAQs' } },
  'virgin-atlantic.work.c-trip-nights': { h: '72b349497e8cb194', label: '泊まりの勤務', value: 'ふつう1回の乗務で少なくとも1泊、2〜3泊のこともある', cond: 'パイロットのQ&A', en: { label: 'Overnights', value: 'A typical trip includes at least one night away, sometimes two or three', cond: 'Pilot FAQs' } },
  'virgin-atlantic.work.command-time': { h: '22c1f02ed7e788c7', label: '機長への昇格の目安', value: '8〜10年（運航の必要に応じて）', cond: 'パイロットの採用ページ（約束された年数ではない）', en: { label: 'Time to command', value: '8–10 years (subject to operational needs)', cond: 'Pilot recruitment page (not a guaranteed timeline)' } },
  /* ブエリング航空 */
  'vueling.jobs.pilot-open': { h: '8bb6dc0a16b7924b', label: '募集の受付', value: '「採用中」の見出しはあるが、該当する求人は無い（確認した時点）', cond: '会社のパイロットの採用ページ', en: { label: 'Recruitment', value: 'A “We are hiring” heading, but no matching jobs (when checked)', cond: 'Company pilot recruitment page' } },
  /* ウィズ・エアー */
  'wizz-air.benefits.r2b-commuter-free-twice-month': { h: '40c2ee0ecb5baa81', label: '通勤（14/7 の通勤の勤務）', value: 'Wizz Air の便で月2回の無料の通勤（ほとんどの基地）', cond: 'パイロットの採用ページ（14/7 の通勤の勤務を選んだ人）', en: { label: 'Commuting (14/7 commuter roster)', value: 'Free commuting on the Wizz Air network twice a month (most bases)', cond: 'Pilot recruitment page (for those choosing the 14/7 commuter roster)' } },
  'wizz-air.benefits.r2b-floating-duty-accommodation': { h: 'a64f9cea63980985', label: '滞在先のホテル（20/10 の勤務）', value: '20日の勤務の間はホテルと宿泊つき（一部の基地）', cond: 'パイロットの採用ページ（20/10 の勤務を選んだ人）', en: { label: 'Hotels (20/10 roster)', value: 'Hotel and accommodation included during the 20 days on (selected bases)', cond: 'Pilot recruitment page (for those choosing the 20/10 floating roster)' } },
  'wizz-air.benefits.r2b-floating-duty-allowance': { h: '54e1622032f35ce7', label: '日当（20/10 の勤務）', value: '勤務の間、会社の規定の日当（額は書かれていない）', cond: 'パイロットの採用ページ（20/10 の勤務を選んだ人）', en: { label: 'Daily allowance (20/10 roster)', value: 'A daily allowance under company policy during the duty period (the amount is not stated)', cond: 'Pilot recruitment page (for those choosing the 20/10 floating roster)' } },
  'wizz-air.jobs.uk-license': { h: 'a6f6d4a7c18d1fd8', label: '免許（英国の会社）', value: '英国 CAA の ATPL か CPL', cond: 'パイロットの採用ページ（Wizz Air UK）', en: { label: 'Licence (UK company)', value: 'UK CAA ATPL or CPL', cond: 'Pilot recruitment page (Wizz Air UK)' } },
  'wizz-air.jobs.uk-medical': { h: '8d8fd5eec42d0caa', label: '身体検査（英国の会社）', value: '英国 CAA の第1種の航空身体検査', cond: 'パイロットの採用ページ（Wizz Air UK）', en: { label: 'Medical (UK company)', value: 'UK CAA Class 1 medical certificate', cond: 'Pilot recruitment page (Wizz Air UK)' } },
  'wizz-air.jobs.uk-right-to-work': { h: '7136583101a09f58', label: '働く資格（英国の会社）', value: '英国に制限なく住み、働ける権利', cond: 'パイロットの採用ページ（Wizz Air UK）', en: { label: 'Right to work (UK company)', value: 'Unrestricted right to live and work in the United Kingdom', cond: 'Pilot recruitment page (Wizz Air UK)' } },
  'wizz-air.work.c-uk-roster': { h: 'ab72aeb7df7583a4', label: '勤務の形（英国の会社）', value: 'ガトウィックとルートンで5日勤務・4日休み、地元のフレックス、機長の14日勤務・14日休み（希望で、割り当ての約束ではない）', cond: 'パイロットの採用ページ（Wizz Air UK）', en: { label: 'Working pattern (UK company)', value: '5 on / 4 off at Gatwick and Luton, flexible local rosters, and 14 on / 14 off for captains (requests, not guaranteed)', cond: 'Pilot recruitment page (Wizz Air UK)' } },
  /* ニュージーランド航空 */
  'air-new-zealand.benefits.r10-atr-instructor-annual-leave': { h: '02f1e5d6b0008b28', label: '休暇の買い足し（教官）', value: '年に最大4週間の休暇を買い足せる（FlexiLeave）', cond: 'ATR のシミュレーターの教官の募集', en: { label: 'Buying extra leave (instructors)', value: 'Up to four extra weeks of leave can be purchased each year (FlexiLeave)', cond: 'ATR flight simulator instructor vacancy' } },
  'air-new-zealand.benefits.r10-atr-instructor-staff-travel': { h: 'eb56432aa162fbd0', label: '社員の航空券（教官）', value: '本人と家族（whānau）の割引航空券と、他の航空会社の空席待ち', cond: 'ATR のシミュレーターの教官の募集', en: { label: 'Staff travel (instructors)', value: 'Discounted flights for you and your whānau, and standby travel on other international airlines', cond: 'ATR flight simulator instructor vacancy' } },
  'air-new-zealand.benefits.resume-jet-health': { h: '4b16284c5bbfbad4', label: '保険と病気休暇', value: '保険・病気休暇・疲れへの対策', cond: 'ジェット機のパイロットの募集（関心の登録）', en: { label: 'Insurance and sick leave', value: 'Insurance, sick leave and fatigue support', cond: 'Jet fleet pilot expression of interest' } },
  'air-new-zealand.jobs.resume-assessment': { h: 'b542b088e3d55b34', label: '選考', value: 'オークランドで2日間', cond: 'ジェット機のパイロットの募集（関心の登録）', en: { label: 'Selection', value: 'Two days in Auckland', cond: 'Jet fleet pilot expression of interest' } },
  'air-new-zealand.jobs.resume-jet-eligibility': { h: '62d23d5f867ff1ba', label: '応募の条件', value: '総飛行時間1,500時間、ニュージーランドの ATPL（か CPL と ATPL の学科）、第1種の身体検査、英語レベル6。ニュージーランドかオーストラリアの市民・永住者など', cond: 'ジェット機のパイロットの募集（関心の登録）', en: { label: 'Requirements', value: '1,500 hours total time, NZ ATPL (or CPL with ATPL theory), Class 1 medical, English level 6; New Zealand or Australian citizens, permanent residents and similar', cond: 'Jet fleet pilot expression of interest' } },
  'air-new-zealand.jobs.resume-jet-entry': { h: '94f4e30ad96a018b', label: '募集の受付', value: '関心の登録（Expression of Interest）で応募できる。B777・B787 はセカンドオフィサー、A320・A321 は副操縦士から', cond: 'ジェット機のパイロットの募集', en: { label: 'Recruitment', value: 'Applications through an expression of interest: second officer on the B777 and B787, first officer on the A320 and A321', cond: 'Jet fleet pilot recruitment' } },
  'air-new-zealand.work.resume-jet-flex': { h: '91f83f4b5f267b4c', label: '働き方の制度', value: 'パートタイムと、長い休み（サバティカル）の申請', cond: 'ジェット機のパイロットの募集（関心の登録）', en: { label: 'Flexible working', value: 'Part-time options and sabbatical applications', cond: 'Jet fleet pilot expression of interest' } },
  /* アラスカ航空 */
  'alaska-airlines.benefits.r8-fo-holiday-pto': { h: '0436b804d2e7f313', label: '休暇', value: '休日と有給休暇（日数は書かれていない）', cond: '副操縦士の求人（Req2026-21163）', en: { label: 'Leave', value: 'Holidays and paid time off (the number of days is not stated)', cond: 'First officer vacancy (Req2026-21163)' } },
  'alaska-airlines.benefits.r8-fo-medical': { h: 'b465b9ef115e56a8', label: '保険', value: '医療・歯科・眼科', cond: '副操縦士の求人（Req2026-21163）', en: { label: 'Insurance', value: 'Medical, dental and vision', cond: 'First officer vacancy (Req2026-21163)' } },
  'alaska-airlines.benefits.r8-fo-standby-travel': { h: 'd3d621447d7c5241', label: '社員の航空券', value: 'アラスカ航空・ハワイアン航空・ホライゾン航空の空席待ちの航空券（無料）', cond: '副操縦士の求人（Req2026-21163）', en: { label: 'Staff travel', value: 'Free standby travel on Alaska Airlines, Hawaiian Airlines and Horizon Air', cond: 'First officer vacancy (Req2026-21163)' } },
  /* アレジアント航空 */
  'allegiant.jobs.fo-closed': { h: '1f59682dfec3321b', label: '募集の受付', value: '副操縦士の受付は締め切っている（2026年10月19日の表示）', cond: 'パイロットの採用ページ', en: { label: 'Recruitment', value: 'The first officer application window is closed (as shown on 19 October 2026)', cond: 'Pilot recruitment page' } },
  'allegiant.jobs.resume-cadet-pathway': { h: '7c9ee69fb0ad30b9', label: '養成コースの募集', value: '提携大学の学生の受け入れ（Accelerate）は受付中', cond: 'パイロットの採用ページ', en: { label: 'Cadet recruitment', value: 'Accepting cadets from partner universities (Accelerate)', cond: 'Pilot recruitment page' } },
  'allegiant.work.resume-roster-return': { h: 'fe7ceac0f7b47333', label: '勤務の形', value: 'ほとんどの乗務は日帰り（自宅に戻る）', cond: 'パイロットの採用ページ', en: { label: 'Working pattern', value: 'Most trips are turns (you return home the same day)', cond: 'Pilot recruitment page' } },
  'allegiant.work.training-cities': { h: '37e8c6e152e050d9', label: '訓練の場所', value: 'ネバダ州ラスベガスとフロリダ州サンフォード', cond: 'パイロットの採用ページ', en: { label: 'Training locations', value: 'Las Vegas, Nevada and Sanford, Florida', cond: 'Pilot recruitment page' } },
  /* アビアンカ航空 */
  'avianca.jobs.resume-pilot-category-status': { h: 'c739e3c095f70671', label: '募集の受付', value: 'パイロットの求人は無い（2026年10月19日の表示）', cond: '会社の採用ページ', en: { label: 'Recruitment', value: 'No pilot vacancies (as shown on 19 October 2026)', cond: 'Company careers page' } },
  /* ブリーズ・エアウェイズ */
  'breeze-airways.benefits.r2-a220-cap-annual-leave': { h: 'a476ce58c2963c33', label: '休暇', value: '有給の休み（PTO。日数は書かれていない）', cond: 'A220 の機長（経験者）の求人（JR100027）', en: { label: 'Leave', value: 'Paid time off (PTO; the number of days is not stated)', cond: 'A220 direct-entry captain vacancy (JR100027)' } },
  'breeze-airways.benefits.r2-a220-cap-medical': { h: '90bcb3eb7c9921ba', label: '保険', value: '医療・眼科・歯科', cond: 'A220 の機長（経験者）の求人（JR100027）', en: { label: 'Insurance', value: 'Health, vision and dental', cond: 'A220 direct-entry captain vacancy (JR100027)' } },
  'breeze-airways.benefits.r2-a220-cap-pension': { h: '2024f38088e93ddf', label: '年金', value: '401(k)（会社のマッチングあり）', cond: 'A220 の機長（経験者）の求人（JR100027）', en: { label: 'Pension', value: '401(k) with an employer match', cond: 'A220 direct-entry captain vacancy (JR100027)' } },
  'breeze-airways.benefits.r2-a220-cap-staff-travel': { h: '31252733d8213305', label: '社員の航空券', value: 'ブリーズと他社の航空券の特典', cond: 'A220 の機長（経験者）の求人（JR100027）', en: { label: 'Staff travel', value: 'Travel on Breeze and other airlines', cond: 'A220 direct-entry captain vacancy (JR100027)' } },
  /* コパ航空 */
  'copa-airlines.base.pub-pilot-city-panama': { h: '4f55c3a111511e85', label: '拠点', value: 'パナマシティ', cond: '副操縦士の採用の投稿（アルゼンチンの応募者向け）', en: { label: 'Base', value: 'Panama City', cond: 'First officer recruitment post (for applicants from Argentina)' } },
  'copa-airlines.benefits.pub-fo-health-offer': { h: 'b0740d7761de15ac', label: '保険', value: '医療保険', cond: 'B737 の副操縦士の求人', en: { label: 'Insurance', value: 'Health insurance', cond: 'B737 first officer vacancy' } },
  'copa-airlines.benefits.pub-fo-stafftravel-offer': { h: '5634bea33943082b', label: '社員の航空券', value: '社員と家族の航空券の特典', cond: 'B737 の副操縦士の求人', en: { label: 'Staff travel', value: 'Travel benefits for employees and their families', cond: 'B737 first officer vacancy' } },
  'copa-airlines.benefits.pub-panama-seniority-premium': { h: 'e6d445aa261b753f', label: '勤続の手当（パナマの法律）', value: '勤続1年につき1週間分の給与を一時金で（パナマの社員ぜんたい）', cond: '2025年の年次報告（Form 20-F）', en: { label: 'Seniority premium (Panamanian law)', value: 'One week’s pay per year of service, paid as a lump sum (all employees in Panama)', cond: '2025 annual report (Form 20-F)' } },
  'copa-airlines.jobs.pub-captain-public-apply': { h: 'b01bbeaee1fa458c', label: '応募の条件（機長）', value: 'ATP・第1種の身体検査、総飛行時間5,000時間・機長として1,000時間、ICAO レベル5（パナマ勤務）', cond: 'B737 の機長の求人', en: { label: 'Requirements (captains)', value: 'ATP and Class 1 medical, 5,000 hours total and 1,000 hours as pilot in command, ICAO level 5 (based in Panama)', cond: 'B737 captain vacancy' } },
  'copa-airlines.jobs.pub-fo-entry-hours': { h: '22623bb020a9d920', label: '応募の条件（副操縦士）', value: 'パナマ国籍は固定翼250時間、外国籍は1,000時間。事業用免許・多発の計器飛行・第1種の身体検査・ICAO レベル5・米国の観光ビザ', cond: 'B737 の副操縦士の求人', en: { label: 'Requirements (first officers)', value: '250 fixed-wing hours for Panamanian nationals and 1,000 for foreign nationals; commercial licence, multi-engine instrument rating, Class 1 medical, ICAO level 5 and a US tourist visa', cond: 'B737 first officer vacancy' } },
  'copa-airlines.jobs.pub-fo-public-apply': { h: '0c265933fafeb1b4', label: '募集の受付', value: 'B737 の副操縦士の求人で応募を受付（LinkedIn の認証が要る）', cond: 'B737 の副操縦士の求人（2026年10月19日に確認）', en: { label: 'Recruitment', value: 'Applications open for the B737 first officer vacancy (LinkedIn sign-in required)', cond: 'B737 first officer vacancy (checked on 19 October 2026)' } },
  'copa-airlines.work.pub-training-panama-cityknowledge': { h: '3f89471bef760cf6', label: '訓練の場所', value: 'パナマシティの「知識の街（Ciudad del Saber）」の訓練施設（フルフライトシミュレーター）', cond: '2025年の年次報告（Form 20-F）', en: { label: 'Training locations', value: 'The training centre with full-motion simulators at the City of Knowledge (Ciudad del Saber), Panama City', cond: '2025 annual report (Form 20-F)' } },
  /* フィジー・エアウェイズ */
  'fiji-airways.jobs.application-channel': { h: '3c2a760f8985765c', label: '応募の方法', value: 'オンラインで応募（全職種）', cond: '会社の採用ページ', en: { label: 'How to apply', value: 'Online applications (all roles)', cond: 'Company careers page' } },
  'fiji-airways.jobs.missing-entry-open': { h: '10b7f7a2d76e7ee7', label: '募集の受付', value: '公開の求人一覧（6件）にパイロットの求人は無い（2026年10月19日）', cond: '会社の公開の求人一覧', en: { label: 'Recruitment', value: 'No pilot vacancy among the 6 public listings (19 October 2026)', cond: 'Company public job list' } },
  'fiji-airways.work.resume-a350-training': { h: 'b54bbb49949bbb33', label: '訓練の場所', value: 'Fiji Airways Aviation Academy で A350 の型式訓練（2024年12月までに41人）', cond: '2024年の年次報告（フィジー議会に提出）', en: { label: 'Training locations', value: 'A350 type rating training at Fiji Airways Aviation Academy (41 trained by December 2024)', cond: '2024 annual report (tabled in the Parliament of Fiji)' } },
  /* フロンティア航空 */
  'frontier.benefits.missing-medical': { h: 'f8c8890c3b8f76b6', label: '保険', value: '健康の制度', cond: 'パイロットの採用ページ', en: { label: 'Insurance', value: 'Health benefits', cond: 'Pilot recruitment page' } },
  'frontier.benefits.missing-staff-travel': { h: 'e01ae3e5befdfa9e', label: '社員の航空券', value: '航空券の特典', cond: 'パイロットの採用ページ', en: { label: 'Staff travel', value: 'Travel benefits', cond: 'Pilot recruitment page' } },
  'frontier.benefits.retirement': { h: '230aff2efd8510b0', label: '年金', value: '退職給付への会社の追加の拠出15%', cond: 'パイロットの採用ページ', lead: true, en: { label: 'Pension', value: 'An additional 15% company contribution to retirement benefits', cond: 'Pilot recruitment page' } },
  'frontier.jobs.fo-window': { h: '0d48951310dd57e3', label: '募集の受付', value: '副操縦士・大学の経路の受付は開いている（2026年10月19日に確認）', cond: 'パイロットの採用ページ', en: { label: 'Recruitment', value: 'First officer and university applications are open (checked on 19 October 2026)', cond: 'Pilot recruitment page' } },
  'frontier.jobs.resume-eligibility': { h: 'a35331bcb2aa2207', label: '応募の条件', value: 'ATP、米国で働く資格、総飛行時間1,500時間', cond: 'パイロットの採用ページ', en: { label: 'Requirements', value: 'ATP, US work authorisation and 1,500 hours total time', cond: 'Pilot recruitment page' } },
  'frontier.work.resume-roster-flex': { h: 'bec1eb8bc22cc721', label: '待機（リザーブ）', value: '空港に詰める待機は無い', cond: 'パイロットの採用ページ', en: { label: 'Reserve', value: 'No on-premises ready reserve', cond: 'Pilot recruitment page' } },
  'frontier.work.resume-upgrade-promotion': { h: 'e979433472a00af8', label: '機長への昇格の見込み', value: '2〜3年（会社の採用案内の見込み。約束ではない）', cond: 'パイロットの採用ページ', en: { label: 'Upgrade outlook', value: '2–3 years (the company’s recruitment estimate, not a promise)', cond: 'Pilot recruitment page' } },
  /* ジェットブルー航空 */
  'jetblue.benefits.missing-housing': { h: 'ee15e6fe4d7759f5', label: '訓練の間の宿泊', value: 'オーランドの施設「The Lodge」を訓練の間の宿泊に使う', cond: '2025年の年次報告（Form 10-K）', en: { label: 'Accommodation during training', value: 'The Lodge in Orlando is used for accommodation during training', cond: '2025 annual report (Form 10-K)' } },
  'jetblue.benefits.pub-pension-q2-confirmation': { h: 'a1b5e9891e718f01', label: '年金', value: '会社の拠出17%（対象となる給与に対して・3年で権利が確定）', cond: '2026年の第2四半期の報告（Form 10-Q）', lead: true, en: { label: 'Pension', value: '17% company contributions (on eligible compensation; vesting after three years)', cond: 'Second-quarter 2026 report (Form 10-Q)' } },
  'jetblue.benefits.r8-green-option-2026': { h: '57a9891a3ceeb04e', label: '保険', value: 'パイロット（労働協約の対象）だけが選べる医療保険（Green Option）', cond: '2026年の福利厚生の案内', en: { label: 'Insurance', value: 'A medical plan option only for eligible pilots under the collective agreement (Green Option)', cond: '2026 benefits enrolment guide' } },
  'jetblue.jobs.resume-fo-open': { h: 'ed416d682ec31d4e', label: '募集の受付', value: '副操縦士を募集（求人 58773・応募の受付中）', cond: '会社の求人', en: { label: 'Recruitment', value: 'Hiring first officers (vacancy 58773, applications open)', cond: 'Company vacancy' } },
  'jetblue.jobs.sponsor': { h: 'b4002e3a5193af5d', label: '働く資格', value: '就労ビザの支援は無い（米国で働く資格が要る）', cond: '副操縦士の求人（58773）', en: { label: 'Right to work', value: 'No visa sponsorship (US work authorisation required)', cond: 'First officer vacancy (58773)' } },
  'jetblue.profile.pub-hq-city': { h: '298ae8fbe6584035', label: '本社', value: 'ニューヨークのロングアイランドシティ', en: { label: 'Headquarters', value: 'Long Island City, New York' } },
  'jetblue.work.missing-training-location': { h: 'a381c71b1cea9ff8', label: '訓練の場所', value: 'オーランドの JetBlue University', cond: '2025年の年次報告（Form 10-K）', en: { label: 'Training locations', value: 'JetBlue University in Orlando', cond: '2025 annual report (Form 10-K)' } },
  'jetblue.work.resume-fo-schedule': { h: '6dcaf1d4807bed4e', label: '勤務の形', value: '待機や不規則な勤務があり、最長6日つづけて家を離れる', cond: '副操縦士の求人（58773）', en: { label: 'Working pattern', value: 'Reserve and irregular schedules, with up to six days away from home', cond: 'First officer vacancy (58773)' } },
  /* ポーター航空 */
  'porter.benefits.missing-annual-leave': { h: '67fe1a2abd09b6e6', label: '休暇', value: '有給休暇と個人の休み', cond: '社員ぜんたいの特典の案内（パイロットの条件は書かれていない）', en: { label: 'Leave', value: 'Paid vacation and personal days', cond: 'Perks for all employees (pilots’ terms are not stated)' } },
  'porter.benefits.missing-medical': { h: '2b8710d94640be3c', label: '保険', value: '健康・眼科・歯科、障害、有給の病気休暇など', cond: '社員ぜんたいの特典の案内（パイロットの条件は書かれていない）', en: { label: 'Insurance', value: 'Health, vision and dental, disability, paid sick days and more', cond: 'Perks for all employees (pilots’ terms are not stated)' } },
  'porter.benefits.missing-pension': { h: '2349220df104b86a', label: '年金', value: 'RRSP・DPSP（会社のマッチングあり）', cond: '社員ぜんたいの特典の案内（パイロットの条件は書かれていない）', en: { label: 'Pension', value: 'RRSP and DPSP with employer-matched contributions', cond: 'Perks for all employees (pilots’ terms are not stated)' } },
  'porter.benefits.missing-staff-travel': { h: 'f2c12eabd82a5a6a', label: '社員の航空券', value: '本人・友人・家族の航空券の特典', cond: '社員ぜんたいの特典の案内（パイロットの条件は書かれていない）', en: { label: 'Staff travel', value: 'Travel privileges for you, friends and family', cond: 'Perks for all employees (pilots’ terms are not stated)' } },
  /* ウェストジェット航空 */
  'westjet.benefits.mainline-pension': { h: 'b9ac80409ad179b5', label: '年金', value: '会社が対象の給与の10%を拠出（本人の1%が条件）', cond: 'パイロットの採用ページ（ウエストジェット本体のパイロット）', lead: true, en: { label: 'Pension', value: 'The company contributes 10% of eligible earnings (with a 1% employee contribution)', cond: 'Pilot recruitment page (WestJet mainline pilots)' } },
  'westjet.benefits.resume-health-day1': { h: 'cf6c7fb29f3479dd', label: '保険', value: '入社の日から対象', cond: '福利厚生の案内（パイロットと一部の職種）', en: { label: 'Insurance', value: 'Coverage from day one', cond: 'Benefits guide (pilots and some specialty roles)' } },
  'westjet.benefits.resume-travel': { h: 'c842873f06cb3e4a', label: '社員の航空券', value: '空席待ちの航空券（運賃は無料・税は別）。6か月後から提携社の割引も', cond: '福利厚生の案内（社員ぜんたい）', en: { label: 'Staff travel', value: 'Standby travel (no base fare; taxes extra), plus partner-airline discounts after six months', cond: 'Benefits guide (all employees)' } },
  'westjet.work.days-mainline': { h: '3c9e7e84dbac9053', label: '月の勤務の日数', value: 'ふつうのラインで月16日まで、待機のラインで18日まで', cond: 'パイロットの採用ページ（ウエストジェット本体）', en: { label: 'Duty days per month', value: 'Up to 16 days on a regular line and 18 on a reserve line', cond: 'Pilot recruitment page (WestJet mainline)' } },
  'westjet.work.resume-bidding': { h: 'f200d39efa25ca70', label: '勤務の希望', value: '勤務の希望は先任順ではない方式で割り当てる', cond: 'パイロットの採用ページ', en: { label: 'Schedule bidding', value: 'Scheduling bids are not awarded by seniority', cond: 'Pilot recruitment page' } },
  /* ── 全社へ広げる e（2026-10-22）：d2 の会社の労働協約の行（AGREEMENTS に登録した協約）。cond は、どの協約の・誰の条件か。
     字に外貨の額を書かない（額は money: true ＝ 台帳の数・通貨・期間のまま、円の目安つき）。
     書かなかった行：TAP のポルトの拠点（ほかの拠点の無い1行だけで、唯一の拠点と読まれる）・TAP の旅行の優待（「社内の規程による」だけで中身が無い）・
     ブエリング航空の自分で選んだ別の住まいのタクシー（その人だけの条件で、通勤の欄ではだれでもと読まれる）・
     ユナイテッド航空の給与の時間の保証（給与の計算の時間で、乗務の時間と読み違えやすい） ── */
  /* エールフランス */
  'air-france.benefits.r10-collective-health-pnt-presence2026': { h: '988b340c79cb0619', label: '補完の医療保険', value: '現役のパイロット（PNT）も加入する団体の補完医療。協約は2026年12月31日まで延長', cond: '社員ぜんたいの補完医療の協約の改定。給付の中身・会社の負担の率は書かれていない', lead: true, en: { label: 'Supplementary health cover', value: 'A group supplementary health scheme that active pilots (PNT) also join; the agreement is extended to 31 December 2026', cond: 'Amendment to the company-wide supplementary health agreement. Benefits and the employer’s share are not stated' } },
  'air-france.benefits.r9-fmd-bicycle': { h: 'f2a929089f1fa04f', label: '自転車の通勤の補助（上限）', cond: 'フランス本土・海外県で働く社員（パイロットを含む）の2026年の協約。払い戻しの上限で、ほかの通勤の補助とは併用できない', en: { label: 'Cycling commute allowance (cap)', cond: 'Air France’s 2026 agreement for staff (pilots included) in mainland France and the overseas departments. A cap on reimbursement; cannot be combined with the other commuting allowances' } },
  'air-france.benefits.r9-fmd-carshare': { h: 'b09bfd3804a77826', label: '低排出の車の相乗りの通勤の補助（上限）', cond: 'フランス本土・海外県で働く社員（パイロットを含む）の2026年の協約。実際に払った費用の上限で、ほかの通勤の補助とは併用できない', en: { label: 'Low-emission car-sharing commute allowance (cap)', cond: 'Air France’s 2026 agreement for staff (pilots included) in mainland France and the overseas departments. A cap on costs actually paid; cannot be combined with the other commuting allowances' } },
  'air-france.benefits.r9-fmd-public-transport': { h: 'cf23dadef3c7f93a', label: '公共交通の1回券の通勤の補助（上限）', cond: 'フランス本土・海外県で働く社員（パイロットを含む）の2026年の協約。実費の払い戻しの上限で、ほかの通勤の補助とは併用できない', en: { label: 'Public-transport single-ticket commute allowance (cap)', cond: 'Air France’s 2026 agreement for staff (pilots included) in mainland France and the overseas departments. A cap on reimbursed costs; cannot be combined with the other commuting allowances' } },
  'air-france.benefits.r9-ikv-rate': { h: 'e1803ab91b420a3f', label: '車の通勤の払い戻し', value: '自宅と職場の距離（km）ごとの額で払い戻す（2026年も同じ率）', cond: 'フランス本土・海外県で働く社員（パイロットを含む）の2026年の協約。距離の上限・条件は別に決まっている', en: { label: 'Car commute reimbursement', value: 'Reimbursed at a rate per kilometre between home and work (the same rate in 2026)', cond: 'Air France’s 2026 agreement for staff (pilots included) in mainland France and the overseas departments. Distance limits and conditions are set separately' } },
  'air-france.benefits.r9-sncf-liberte': { h: '97ca5817ce12405c', label: 'SNCF の割引カード（Liberté）', value: '会社が購入の額の50%を負担', cond: 'フランス本土・海外県で働く社員（パイロットを含む）の2026年の協約。名前の入った領収書による', en: { label: 'SNCF discount card (Liberté)', value: 'The company pays 50% of the purchase price', cond: 'Air France’s 2026 agreement for staff (pilots included) in mainland France and the overseas departments. Against a named invoice' } },
  'air-france.benefits.r9-train-cap': { h: '792b37c75b58e675', label: '電車の通勤の払い戻し', value: '電車の通勤の実費を払い戻す（上限あり。2026年7月から）', cond: 'フランス本土・海外県で働く社員（パイロットを含む）の2026年の協約。決まった額を支給するものではない', en: { label: 'Rail commute reimbursement', value: 'Actual rail commuting costs are reimbursed (up to a cap, from July 2026)', cond: 'Air France’s 2026 agreement for staff (pilots included) in mainland France and the overseas departments. Not a fixed payment' } },
  /* イージージェット（スペインの協約） */
  'easyjet.benefits.c-spain-pension-alternative': { h: '8df676c355f90206', label: '企業年金と選べる報酬', value: '企業年金（Loreto Mutua）への会社の拠出と、選べる報酬の制度は、どちらか1つ', cond: 'スペインで働くイージージェットのパイロットの労働協約', en: { label: 'Company pension or flexible pay', value: 'Either the company’s contribution to the company pension (Loreto Mutua) or the flexible remuneration plan, not both', cond: 'Collective agreement for easyJet pilots in Spain' } },
  'easyjet.benefits.pub-base-parking': { h: 'd198f0abd1f01758', label: '拠点の駐車場', value: 'パイロットの拠点の車の駐車場は無料（給与の一部ではなく、なくなることもある）', cond: 'スペインで働くイージージェットのパイロットの労働協約。変えるときは組合（SEPLA）と話し合う', en: { label: 'Parking at the base', value: 'Car parking at the pilot base is free (not part of pay, and it may be withdrawn)', cond: 'Collective agreement for easyJet pilots in Spain. Changes are discussed with the union (SEPLA)' } },
  'easyjet.benefits.pub-training-lodging': { h: '5a3f8b7def4fa94e', label: '入社の訓練のあいだの宿', value: '型式の訓練のあいだは、基本給・宿・朝と夕の食事を会社が負担', cond: 'スペインで働くイージージェットのパイロットの労働協約（入社の訓練）', en: { label: 'Accommodation during initial training', value: 'During type-rating training the company pays basic salary, accommodation and breakfast and dinner', cond: 'Collective agreement for easyJet pilots in Spain (initial training)' } },
  'easyjet.benefits.r10-spain-private-medical-option': { h: '2af94bc35cca1dd2', label: '民間の医療保険', value: '選べる報酬の制度から、民間の医療保険を選べる', cond: 'スペインの法で雇われ、スペインで乗務するイージージェットのパイロットの労働協約。保険料と本人の負担は書かれていない', en: { label: 'Private medical insurance', value: 'Private medical insurance can be chosen through the flexible remuneration plan', cond: 'Collective agreement for easyJet pilots employed under Spanish law and flying in Spain. Premiums and the pilot’s share are not stated' } },
  'easyjet.work.c-spain-54': { h: '82e944befc7d5558', label: '勤務の形（5勤4休を選ぶとき）', value: '5日勤務・4日休みの決まった形を選べる（基本給は8%少なく、待機の期間は無い）', cond: 'スペインで働くイージージェットのパイロットの労働協約。全員の標準の形ではない', en: { label: 'Work pattern (if 5-on/4-off is chosen)', value: 'A fixed pattern of 5 days on and 4 days off can be chosen (basic salary is 8% lower; no reserve periods)', cond: 'Collective agreement for easyJet pilots in Spain. Not everyone’s standard pattern' } },
  'easyjet.work.pub-frv-days-off': { h: '456702b7a05313f4', label: '休日', value: '年144日以上（月12日以上・2月は11日以上）', cond: 'スペインで通年・フルタイムで働くイージージェットのパイロットの労働協約（標準の勤務の形）', lead: true, en: { label: 'Days off', value: 'At least 144 a year (at least 12 a month; 11 in February)', cond: 'Collective agreement for full-time, year-round easyJet pilots in Spain (standard roster pattern)' } },
  'easyjet.work.pub-occ-bond': { h: '3b4d45fbff73c03e', label: '訓練費の返還', value: '入社の訓練（OCC）の費用は、辞めた時期により全額から段階的に減り、2年を過ぎると返さない', cond: 'スペインで働くイージージェットのパイロットの労働協約。本人の都合で辞めたときなど', en: { label: 'Training cost repayment', value: 'The cost of initial training (OCC) falls in steps from the full amount depending on when you leave, and nothing is repaid after two years', cond: 'Collective agreement for easyJet pilots in Spain. Applies when leaving at your own request and in similar cases' } },
  /* ユーロウイングス（スペインの協約） */
  'eurowings.benefits.r10-spain-annual-leave': { h: '5c0ac09f9e825922', label: '年次休暇', value: '年30日以上（暦日）。勤続5年・10年・12年で増え、最大42日', cond: 'スペインで働くユーロウイングス（Eurowings Europe）のパイロットの労働協約', en: { label: 'Annual leave', value: 'At least 30 days a year (calendar days), rising after 5, 10 and 12 years of service to a maximum of 42', cond: 'Collective agreement for Eurowings (Eurowings Europe) pilots in Spain' } },
  'eurowings.benefits.r10-spain-mandatory-base-transfer': { h: 'd56c4410818b4659', label: '会社の命令で拠点が変わるとき', value: '引っ越しの一時金（島への・島からの移動は上乗せ）', cond: 'スペインで働くユーロウイングス（Eurowings Europe）のパイロットの労働協約。移ってから3か月以内に本人の都合で辞めると返す', en: { label: 'Company-ordered base change', value: 'A one-off relocation payment (more for moves to or from the islands)', cond: 'Collective agreement for Eurowings (Eurowings Europe) pilots in Spain. Repaid if you resign within three months of the move' } },
  /* イベリア航空 */
  'iberia.benefits.vacation-base': { h: 'b529ce66f583a148', label: '年次休暇', cond: 'イベリア航空のパイロットの労働協約（第10次）。続けて30日か、15日ずつなどに分けて取る', en: { label: 'Annual leave', cond: 'Iberia pilots’ collective agreement (10th). Taken as 30 consecutive days or split, for example into two blocks of 15' } },
  'iberia.work.monthly-roster-notice': { h: '2663d72e79011483', label: '月の勤務表の発表', value: '月の始まりの14日前まで', cond: 'イベリア航空のパイロットの労働協約の改定（2024年）', en: { label: 'Monthly roster publication', value: 'At least 14 days before the month starts', cond: 'Amendment to the Iberia pilots’ collective agreement (2024)' } },
  /* ITAエアウェイズ */
  'ita-airways.benefits.r8-signed-leave30': { h: '577db638a81db22d', label: '年次休暇', value: '年30日（祝日を含む）', cond: 'ITAエアウェイズの乗員（パイロットを含む）の会社の協約（2026年9月から）。年次休暇の一部は休みの日と相殺される', lead: true, en: { label: 'Annual leave', value: '30 days a year (public holidays included)', cond: 'ITA Airways’ company agreement for flight crew (pilots included), from September 2026. Part of the leave offsets rest days' } },
  'ita-airways.benefits.r8-signed-sanivolo': { h: '17689cfdcfc645f2', label: '補完の医療', value: '加入した乗員は、基金（Sanivolo）で国の医療を補う医療を受けられる（会社の拠出の新しい額は2027年から）', cond: 'ITAエアウェイズの乗員（パイロットを含む）の会社の協約。家族の範囲は書かれていない', en: { label: 'Supplementary health cover', value: 'Enrolled crew get health cover that supplements the national health service through a fund (Sanivolo); the new company contribution applies from 2027', cond: 'ITA Airways’ company agreement for flight crew (pilots included). Family eligibility is not stated' } },
  'ita-airways.benefits.r8-signed-self-commute': { h: '671119bf2fc285ce', label: '通勤', value: 'ふだんの出勤は自分の交通手段。拠点の外で泊まるときのホテルと空港の行き来は会社が手配', cond: 'ITAエアウェイズの乗員（パイロットを含む）の会社の協約（2026年9月から）', en: { label: 'Commuting', value: 'Normal travel to work is by your own means; transport between the hotel and the airport when staying away from base is arranged by the company', cond: 'ITA Airways’ company agreement for flight crew (pilots included), from September 2026' } },
  'ita-airways.benefits.r8-signed-transfer-support': { h: '3db0c7457b3a9e03', label: '会社の命令で転勤するとき', value: '旅費と荷物の運送費。家族と移るときは1か月・1人で移るときは20日の出張の扱い', cond: 'ITAエアウェイズの乗員（パイロットを含む）の会社の協約。移ってから1年以内に本人の都合で辞めると、運送費の一部を返すことがある', en: { label: 'Company-ordered transfer', value: 'Travel and removal costs, plus travel-allowance treatment for one month when moving with family or 20 days when moving alone', cond: 'ITA Airways’ company agreement for flight crew (pilots included). Part of the removal cost may be repaid if you resign within a year of moving' } },
  /* ジェットスター航空 */
  'jetstar.benefits.r8-annual-leave-fulltime': { h: '4672f6720d65ecc0', label: '年次休暇', value: '勤続1年ごとに42日（暦日。土日・祝日を含む）', cond: 'ジェットスター航空のフルタイムのパイロットの労働協約（2026年）', lead: true, en: { label: 'Annual leave', value: '42 days for each year of service (calendar days, weekends and public holidays included)', cond: 'Jetstar full-time pilots’ enterprise agreement (2026)' } },
  'jetstar.benefits.r8-base-parking': { h: 'b8186ef67957d6bd', label: '拠点の駐車場', value: '勤務のときの拠点の空港の駐車場と、駐車場からターミナルまでの送迎を会社が用意', cond: 'ジェットスター航空のパイロットの労働協約（2026年）', en: { label: 'Parking at the base', value: 'The company provides home-base airport parking on duty days and transport between the car park and the terminal where needed', cond: 'Jetstar pilots’ enterprise agreement (2026)' } },
  'jetstar.benefits.r8-company-directed-transfer': { h: 'd4e65184f49b37db', label: '会社の指示で拠点が変わるとき', value: '引っ越しの支援（家財と車の運送・保管・航空券など）を1人ずつ決める', cond: 'ジェットスター航空のパイロットの労働協約（2026年）。自分から望んだ異動は自分の負担', en: { label: 'Company-directed base change', value: 'A relocation package (removal and storage of belongings and a car, flights and more) is set for each person', cond: 'Jetstar pilots’ enterprise agreement (2026). Voluntary transfers are at your own cost' } },
  'jetstar.benefits.r8-duty-travel-medical': { h: 'ce8e98b024ba68fa', label: '業務の移動中の保険', value: '会社の指示の移動中の、緊急の医療・歯科・救援搬送を含む旅行保険', cond: 'ジェットスター航空のパイロットの労働協約（2026年）。ふだんの医療の保険ではない', en: { label: 'Insurance while travelling on duty', value: 'Travel insurance covering emergency medical and dental care and evacuation while travelling at the company’s direction', cond: 'Jetstar pilots’ enterprise agreement (2026). Not everyday health insurance' } },
  /* LATAM航空（ブラジルの協約・行は参考） */
  'latam.benefits.missing-annual-leave': { h: '3e51ae465f41ecc4', label: '年次休暇', value: '希望すれば15日ずつ2回に分けて取れる（時期は会社が決める）', cond: 'LATAM ブラジル（TAM）のパイロットの労働協約（2025〜2027年）', en: { label: 'Annual leave', value: 'Can be split into two blocks of 15 days on request (the company sets the dates)', cond: 'Collective agreement for LATAM Brasil (TAM) pilots (2025–2027)' } },
  'latam.benefits.missing-commuting': { h: '0705ae25f51b9c5c', label: '空港のあいだの移動', value: '契約の拠点と別の空港で始まる・終わる勤務は、会社が空港のあいだを無料で送る', cond: 'LATAM ブラジル（TAM）のパイロットの労働協約（2025〜2027年）。同じ都市圏の空港のあいだ', en: { label: 'Transfers between airports', value: 'When duty starts or ends at an airport other than the contract base, the company provides free transport between the airports', cond: 'Collective agreement for LATAM Brasil (TAM) pilots (2025–2027). Between airports in the same metropolitan area' } },
  'latam.benefits.missing-staff-travel': { h: '4a7b82c0c72416bd', label: '乗務の前後の移動（Passe Livre）', value: '国内線で、乗務の前後の本人の移動', cond: 'LATAM ブラジル（TAM）のパイロットの労働協約（2025〜2027年）。家族の航空券ではない', en: { label: 'Travel before and after duty (Passe Livre)', value: 'Domestic travel for the pilot alone before and after duty', cond: 'Collective agreement for LATAM Brasil (TAM) pilots (2025–2027). Not family travel' } },
  'latam.benefits.publication-health-dependent': { h: '707bb0b6b1c2dceb', label: '扶養の家族の健康保険', value: '会社が家族1人ごとの保険料の30%を負担（2026年12月から40%）', cond: 'LATAM ブラジル（TAM）のパイロットの労働協約（2025〜2027年）', en: { label: 'Dependants’ health insurance', value: 'The company pays 30% of each dependant’s premium (40% from December 2026)', cond: 'Collective agreement for LATAM Brasil (TAM) pilots (2025–2027)' } },
  'latam.work.missing-roster-pattern': { h: 'e524f3591ffb6469', label: '月の勤務表', value: '月の勤務表は5日前までに発表', cond: 'LATAM ブラジル（TAM）のパイロットの労働協約（2025〜2027年）', en: { label: 'Monthly roster', value: 'The monthly roster is published at least five days in advance', cond: 'Collective agreement for LATAM Brasil (TAM) pilots (2025–2027)' } },
  'latam.work.missing-working-time': { h: '0f19f5e39747b80d', label: '勤務と飛行の時間の上限', value: '勤務は週44時間まで。飛行は大型機が28日で100時間・年1,000時間、A320系とエンブラエルが28日で90時間・年900時間まで', cond: 'LATAM ブラジル（TAM）のパイロットの労働協約（2025〜2027年）。上限で、実際の時間や保証ではない', en: { label: 'Duty and flying time limits', value: 'Duty up to 44 hours a week; flying up to 100 hours in 28 days and 1,000 a year on wide-bodies, and 90 hours in 28 days and 900 a year on the A320 family and Embraer', cond: 'Collective agreement for LATAM Brasil (TAM) pilots (2025–2027). Limits, not actual or guaranteed hours' } },
  /* ノルウェー・エアシャトル（スペインの協約） */
  'norwegian.benefits.c-spain-staff-travel': { h: 'e2453a32c8366baa', label: '社員の航空券', value: 'グループの航空券の決まりが当てはまる', cond: 'スペインで働くノルウェー・エアシャトル（Norwegian Air Resources Spain）のパイロットの労働協約。対象の家族・料金は書かれていない', en: { label: 'Staff travel', value: 'The group’s staff travel policy applies', cond: 'Collective agreement for Norwegian (Norwegian Air Resources Spain) pilots in Spain. Family eligibility and fares are not stated' } },
  'norwegian.benefits.pub-spain-duty-hotel': { h: '919a010025c46767', label: '乗務のときのホテル', value: '乗務中のホテルと朝食、ホテルと空港の行き来を会社が手配・負担', cond: 'スペインで働くノルウェー・エアシャトル（Norwegian Air Resources Spain）のパイロットの労働協約', en: { label: 'Hotels on duty', value: 'The company arranges and pays for hotels and breakfast on duty and transport between the hotel and the airport', cond: 'Collective agreement for Norwegian (Norwegian Air Resources Spain) pilots in Spain' } },
  'norwegian.benefits.pub-spain-insurance': { h: '77220812296233c7', label: '保険', value: '病気、業務の事故によるけが・死亡、乗務の資格を失ったときの保険を会社がかける', cond: 'スペインで働くノルウェー・エアシャトル（Norwegian Air Resources Spain）のパイロットの労働協約。中身は会社が選んだ保険による', en: { label: 'Insurance', value: 'The company takes out insurance for sickness, injury or death in work accidents, and loss of licence', cond: 'Collective agreement for Norwegian (Norwegian Air Resources Spain) pilots in Spain. Details follow the policies the company chooses' } },
  'norwegian.benefits.pub-spain-leave-days': { h: 'd7f9a1abbcbdb28b', label: '年次休暇', value: '年25勤務日（30暦日）', cond: 'スペインで働くノルウェー・エアシャトル（Norwegian Air Resources Spain）のパイロットの労働協約。60歳以上は5日多いなど', lead: true, en: { label: 'Annual leave', value: '25 working days a year (30 calendar days)', cond: 'Collective agreement for Norwegian (Norwegian Air Resources Spain) pilots in Spain. Five more days from age 60, among other rules' } },
  'norwegian.benefits.pub-spain-pension-plan': { h: 'f74e838ff1f43cc5', label: '年金', value: '会社の年金の拠出は給与の段（レベル）ごとに決まる（レベル1〜3は無し）', cond: 'スペインで働くノルウェー・エアシャトルの機長と副操縦士の労働協約。月か年かは書かれていない', en: { label: 'Pension', value: 'The company’s pension contribution is set by pay level (none for levels 1–3)', cond: 'Collective agreement for Norwegian captains and first officers in Spain. Whether monthly or yearly is not stated' } },
  'norwegian.work.c-spain-flex-2026': { h: 'b6135e5f18d820b8', label: '勤務できる日（2026年）', value: '年209日（フレキシブルの組。休暇を引く前の日数）', cond: 'スペインで働くノルウェー・エアシャトル（Norwegian Air Resources Spain）のパイロットの労働協約。実際に乗務する日数ではない', en: { label: 'Available work days (2026)', value: '209 a year (flexible group; before leave is deducted)', cond: 'Collective agreement for Norwegian (Norwegian Air Resources Spain) pilots in Spain. Not the number of days actually flown' } },
  'norwegian.work.pub-spain-training-bond': { h: 'd9a2d43ba7edb907', label: '訓練費の返還', value: '型式の訓練を終えて24か月以内に本人の都合で辞めると、残りの月の分を返す', cond: 'スペインで働くノルウェー・エアシャトル（Norwegian Air Resources Spain）のパイロットの労働協約', en: { label: 'Training cost repayment', value: 'If you resign within 24 months of completing type-rating training, you repay the share for the remaining months', cond: 'Collective agreement for Norwegian (Norwegian Air Resources Spain) pilots in Spain' } },
  /* ライアンエアー（スペインの協約） */
  'ryanair.benefits.pension-cap': { h: 'ad06e9b6fc5ceb86', label: '機長の年金（会社の拠出の上限）', money: true, cond: 'スペインで働くライアンエアーのパイロットの労働協約。加入は任意で、本人も同じ額まで拠出する', en: { label: 'Captain’s pension (employer contribution cap)', cond: 'Collective agreement for Ryanair pilots in Spain. Joining is voluntary; the pilot contributes up to the same amount' } },
  'ryanair.benefits.pension-fo': { h: '2f31e8faf1379f35', label: '副操縦士の年金（会社の拠出の上限）', money: true, cond: 'スペインで働くライアンエアーのパイロットの労働協約。加入は任意で、本人も同じ額まで拠出する', en: { label: 'First officer’s pension (employer contribution cap)', cond: 'Collective agreement for Ryanair pilots in Spain. Joining is voluntary; the pilot contributes up to the same amount' } },
  'ryanair.benefits.r8-es-annual-leave29': { h: 'd473f02cc0d097ee', label: '年次休暇', value: '年29勤務日（法定の30暦日を勤務日で数えたもの）', cond: 'スペインで働くライアンエアーのフルタイムのパイロットの労働協約', lead: true, en: { label: 'Annual leave', value: '29 working days a year (the statutory 30 calendar days counted in working days)', cond: 'Collective agreement for full-time Ryanair pilots in Spain' } },
  'ryanair.benefits.r8-es-health-allowance-cap': { h: '9c119dcb672fe14f', label: '機長の健康保険の手当', cond: 'スペインで働くライアンエアーのパイロットの労働協約。パイロットの手当の一部', en: { label: 'Captain’s health insurance allowance', cond: 'Collective agreement for Ryanair pilots in Spain. Part of the pilot allowance' } },
  'ryanair.benefits.r8-es-health-allowance-fo': { h: 'bf059ce855a7a17a', label: '副操縦士の健康保険の手当', cond: 'スペインで働くライアンエアーのパイロットの労働協約。パイロットの手当の一部', en: { label: 'First officer’s health insurance allowance', cond: 'Collective agreement for Ryanair pilots in Spain. Part of the pilot allowance' } },
  'ryanair.benefits.r8-es-parking-allowance': { h: '27c4d4adcbba6d01', label: '駐車の手当', cond: 'スペインで働くライアンエアーのパイロットの労働協約。パイロットの手当の一部で、無料の駐車場の約束ではない', en: { label: 'Parking allowance', cond: 'Collective agreement for Ryanair pilots in Spain. Part of the pilot allowance, not a promise of free parking' } },
  'ryanair.benefits.r8-es-staff-travel-discretionary': { h: '403cd38d5d63bcd7', label: '社員の航空券', value: '会社の裁量の制度（協約は中身を知らせることを決めているだけ）', cond: 'スペインで働くライアンエアーのパイロットの労働協約。枚数・家族・料金は書かれていない', en: { label: 'Staff travel', value: 'A discretionary company scheme (the agreement only provides that its details are communicated)', cond: 'Collective agreement for Ryanair pilots in Spain. Numbers of tickets, family eligibility and fares are not stated' } },
  'ryanair.work.spain-roster-cba': { h: '84e1c809a472b482', label: '勤務と休みの組み方', value: '5日勤務・4日休み（定期の訓練の時期などは別の形）', cond: 'スペインで働くライアンエアーのパイロットの労働協約（2027年3月31日まで）', en: { label: 'Work and rest pattern', value: '5 days on, 4 days off (a different pattern during recurrent training and similar periods)', cond: 'Collective agreement for Ryanair pilots in Spain (until 31 March 2027)' } },
  /* TAPポルトガル航空 */
  'tap.benefits.pub-calendar-leave': { h: '66926ade4a6a7f0a', label: '年次休暇', value: '年42日（暦日）。長い欠勤があると減る（最低30日）', cond: 'TAPポルトガル航空のパイロットの労働協約（2023年）', lead: true, en: { label: 'Annual leave', value: '42 calendar days a year, reduced after long absences (to a minimum of 30)', cond: 'TAP Air Portugal pilots’ collective agreement (2023)' } },
  'tap.benefits.pub-dc-pension': { h: 'db6e20867e55e0e3', label: '確定拠出の年金', value: '基本の報酬の7.5%を年14回。会社が8割・本人が2割を負担', cond: 'TAPポルトガル航空のパイロットの労働協約（2023年）。2007年までに入社した人には別の経過の制度', en: { label: 'Defined-contribution pension', value: '7.5% of basic pay, 14 times a year; the company pays 80% and the pilot 20%', cond: 'TAP Air Portugal pilots’ collective agreement (2023). A separate transitional scheme applies to pilots who joined by 2007' } },
  'tap.benefits.pub-health-risk-insurance': { h: '76e036ad555ed58b', label: '健康保険', value: '地上の社員と同じ条件の団体の健康保険（乗務の仕事のリスクを考えたもの）', cond: 'TAPポルトガル航空のパイロットの労働協約（2023年）。家族・本人の負担は書かれていない', en: { label: 'Health insurance', value: 'Group health insurance on the same terms as ground staff, taking the risks of flying into account', cond: 'TAP Air Portugal pilots’ collective agreement (2023). Family cover and the pilot’s share are not stated' } },
  'tap.benefits.r8-cbe-duty-layover-lodging': { h: '3e605e0111bd0cfd', label: '乗務で泊まるときの宿', value: '会社が適切な宿を用意（なるべく空港から1時間30分以内）', cond: 'TAPポルトガル航空のパイロットの労働協約（2023年）。ふだんの住まいの支援ではない', en: { label: 'Accommodation on duty', value: 'The company provides suitable accommodation (where possible within 1 hour 30 minutes of the airport)', cond: 'TAP Air Portugal pilots’ collective agreement (2023). Not support for everyday housing' } },
  'tap.benefits.r8-cbe-mandatory-relocation': { h: '74c81ad0133d97b2', label: '国内の拠点の縮小でリスボンへ移るとき', value: '引っ越しの実費（上限あり）と、着任時の一時金（再定住費）を出す', cond: 'TAPポルトガル航空のパイロットの労働協約（2023年）。自分から移るとき・昇格や機種の移行で移るときは別', en: { label: 'Move to Lisbon when a domestic base shrinks', value: 'Actual removal costs (up to a cap) and an initial resettlement payment', cond: 'TAP Air Portugal pilots’ collective agreement (2023). Different rules for voluntary moves and moves for promotion or a type change' } },
  'tap.benefits.r8-cbe-mandatory-transfer-temporary-lodging': { h: '068e1aae472e6b24', label: '会社の命令で配置が変わるとき', value: '続けて5日の休みのあいだ、望めば宿も用意', cond: 'TAPポルトガル航空のパイロットの労働協約（2023年）。ふだんの住まいの支援ではない', en: { label: 'Company-ordered reassignment', value: 'Accommodation on request during the five consecutive days off', cond: 'TAP Air Portugal pilots’ collective agreement (2023). Not support for everyday housing' } },
  'tap.benefits.r8-cbe-operational-base-duty-transport': { h: 'c12a7fedc06ab0b3', label: '業務の移動', value: '会社の指示の審査・訓練・身体検査などの移動は、会社が交通・宿・日当を用意', cond: 'TAPポルトガル航空のパイロットの労働協約（2023年）。ふだんの通勤ではない', en: { label: 'Duty travel', value: 'For checks, training, medicals and other travel the company directs, it provides transport, accommodation and a daily allowance', cond: 'TAP Air Portugal pilots’ collective agreement (2023). Not everyday commuting' } },
  'tap.work.pub-annual-off-days': { h: '698eb5336810846f', label: '休日', value: '暦年で111日以上（ふつうの月は10日）', cond: 'TAPポルトガル航空のパイロットの労働協約（2023年）。年次休暇を取った月などは減る', lead: true, en: { label: 'Days off', value: 'At least 111 per calendar year (10 in a normal month)', cond: 'TAP Air Portugal pilots’ collective agreement (2023). Fewer in months with annual leave and similar cases' } },
  'tap.work.pub-training-cost-commitment': { h: '09c6cacb3ce34509', label: '訓練費の約束', value: 'ひとりで乗務できるようになってから3年。途中で辞めると訓練費を返す（2年を過ぎると減る）', cond: 'TAPポルトガル航空のパイロットの労働協約（2023年）', en: { label: 'Training cost commitment', value: 'Three years from your release to the line; if you leave earlier you repay training costs (reduced after two years)', cond: 'TAP Air Portugal pilots’ collective agreement (2023)' } },
  /* ターキッシュ エアラインズ */
  'turkish-airlines.benefits.pub-cba-leave': { h: '7c8cacfd7eaec1a7', label: '年次休暇', value: '勤続1〜5年は20勤務日・5年を超え15年未満は22勤務日・15年以上は30勤務日（1999年6月15日以降に入社した人）', cond: 'ターキッシュ エアラインズの社員の労働協約（第29期・2026〜2027年）。組合員が対象', lead: true, en: { label: 'Annual leave', value: '20 working days for 1–5 years of service, 22 for over 5 and under 15 years, and 30 for 15 years or more (for staff who joined on or after 15 June 1999)', cond: 'Turkish Airlines’ collective agreement for staff (29th term, 2026–2027). Covers union members' } },
  'turkish-airlines.benefits.r8-cba29-health': { h: 'd4b8a50c3b3435a9', label: '医療', value: '本人と扶養の家族は国の制度の医療。会社の命令で海外にいるあいだの病気の費用は会社が負担', cond: 'ターキッシュ エアラインズの社員の労働協約（第29期・2026〜2027年）。組合員が対象', en: { label: 'Health care', value: 'You and your dependants are covered by the national health scheme; medical costs for illness while abroad on company assignment are paid by the company', cond: 'Turkish Airlines’ collective agreement for staff (29th term, 2026–2027). Covers union members' } },
  'turkish-airlines.benefits.r8-cba29-service': { h: '8560af12df969ed6', label: '通勤', value: '会社の送迎（決まった経路）。使えない人には、公共交通の月の定期の額をもとに払う', cond: 'ターキッシュ エアラインズの社員の労働協約（第29期・2026〜2027年）。組合員が対象', en: { label: 'Commuting', value: 'Company transport on set routes; staff who cannot use it are paid based on the price of a monthly public-transport pass', cond: 'Turkish Airlines’ collective agreement for staff (29th term, 2026–2027). Covers union members' } },
  'turkish-airlines.work.pub-cba-monthly-off': { h: '5242f8496d4e8538', label: '休日', value: '月8日（暦日）', cond: 'ターキッシュ エアラインズの乗員の労働協約（第29期・2026〜2027年）。待機の日は休日に数えない', en: { label: 'Days off', value: '8 calendar days a month', cond: 'Turkish Airlines’ collective agreement for crew (29th term, 2026–2027). Standby days do not count as days off' } },
  /* ユナイテッド航空 */
  'united.benefits.r8-annual-leave-1to4': { h: '911a51ec5d9f480c', order: 1, lead: true, label: '年次休暇（勤続1〜4年）', cond: 'ユナイテッド航空のパイロットの労働協約（2023年）。前の休暇の年に積み立てた分を、次の休暇の年に取る', en: { label: 'Annual leave (1–4 years of service)', cond: 'United Airlines pilots’ collective agreement (2023). Leave earned in one vacation year is taken in the next' } },
  'united.benefits.r8-annual-leave-5to10': { h: 'f785a603231dc9a3', order: 2, label: '年次休暇（勤続5〜10年）', cond: 'ユナイテッド航空のパイロットの労働協約（2023年）。前の休暇の年に積み立てた分を、次の休暇の年に取る', en: { label: 'Annual leave (5–10 years of service)', cond: 'United Airlines pilots’ collective agreement (2023). Leave earned in one vacation year is taken in the next' } },
  'united.benefits.r8-annual-leave-11to24': { h: '7d64fab591e14746', order: 3, label: '年次休暇（勤続11〜24年）', cond: 'ユナイテッド航空のパイロットの労働協約（2023年）。前の休暇の年に積み立てた分を、次の休暇の年に取る', en: { label: 'Annual leave (11–24 years of service)', cond: 'United Airlines pilots’ collective agreement (2023). Leave earned in one vacation year is taken in the next' } },
  'united.benefits.r8-annual-leave-25plus': { h: '1eb134e6c6279e51', order: 4, label: '年次休暇（勤続25年以上）', cond: 'ユナイテッド航空のパイロットの労働協約（2023年）。前の休暇の年に積み立てた分を、次の休暇の年に取る', en: { label: 'Annual leave (25 or more years of service)', cond: 'United Airlines pilots’ collective agreement (2023). Leave earned in one vacation year is taken in the next' } },
  'united.benefits.deep-retirement-18': { h: '20f0f55561aabd9b', label: '年金（会社の直接の拠出）', value: '対象の給与の18%（2026年1月の期間から）', cond: 'ユナイテッド航空のパイロットの労働協約（2023年）。入社の日から加入', en: { label: 'Pension (direct company contribution)', value: '18% of eligible earnings (from the January 2026 bid period)', cond: 'United Airlines pilots’ collective agreement (2023). Membership from the date of hire' } },
  'united.benefits.missing-commuting': { h: '7c926ad5edffa2e8', label: '飛行機で通勤するとき', value: '出勤の便を2本（第一と予備）用意する決まり。乗れないときは乗員の勤務の担当へ連絡する', cond: 'ユナイテッド航空のパイロットの労働協約（2023年）。通勤の費用の支給ではない', en: { label: 'Commuting by air', value: 'You must plan two flights to work (a primary and a back-up); if you cannot board, you contact crew scheduling', cond: 'United Airlines pilots’ collective agreement (2023). Not a payment of commuting costs' } },
  'united.benefits.missing-medical': { h: '2df75b2e8a7555cd', label: '保険（医療・歯科など）', value: '医療・歯科・眼科・長期の障害・生命保険など。本人と対象の家族は入社の日から', cond: 'ユナイテッド航空のパイロットの労働協約（2023年）。保険料の額は書かれていない', en: { label: 'Insurance (medical, dental and more)', value: 'Medical, dental, vision, long-term disability, life cover and more; you and eligible dependants from the date of hire', cond: 'United Airlines pilots’ collective agreement (2023). Premiums are not stated' } },
  'united.work.missing-roster-pattern': { h: '71ed8905d66b2c5e', label: '休日', value: 'ラインを持つパイロットは月12日以上。待機（リザーブ）は30日の月が13日・31日の月が14日以上', cond: 'ユナイテッド航空のパイロットの労働協約（2023年）。協約の最低の日数で、実際の平均ではない', en: { label: 'Days off', value: 'At least 12 a month for lineholders; for reserves at least 13 in a 30-day month and 14 in a 31-day month', cond: 'United Airlines pilots’ collective agreement (2023). Contract minimums, not actual averages' } },
  /* ブエリング航空 */
  'vueling.benefits.pension-year4': { h: 'ec7ff35c68d6f459', label: '年金（勤続満4〜5年の会社の拠出）', money: true, cond: 'スペインの契約で働くブエリング航空のパイロットの労働協約。会社が全額を負担', en: { label: 'Pension (company contribution at 4–5 completed years)', cond: 'Collective agreement for Vueling pilots on Spanish contracts. Paid entirely by the company' } },
  'vueling.benefits.pub-cba-travel-conditions': { h: 'e9d342ab14cfdcb6', label: '社員の航空券', value: '本人と指名した人が使える航空券（年の枚数と使い方に決まりあり）', cond: 'スペインの契約で働くブエリング航空のパイロットの労働協約。家族がいつも無料という約束ではない', en: { label: 'Staff travel', value: 'Tickets for you and nominated beneficiaries (with annual limits and rules on use)', cond: 'Collective agreement for Vueling pilots on Spanish contracts. Not a promise of free travel for family at any time' } },
  'vueling.benefits.r8-benefit-basket-medical': { h: 'e914d974d870610d', label: '医療保険', value: '会社の選べる手当の枠から医療保険を選べる（会社が直接払う）', cond: 'スペインの契約で働くブエリング航空のパイロットの労働協約。職位ごとの年の上限の中で', en: { label: 'Medical insurance', value: 'Medical insurance can be chosen from the company’s flexible benefits allowance (paid directly by the company)', cond: 'Collective agreement for Vueling pilots on Spanish contracts. Within each rank’s annual limit' } },
  'vueling.benefits.r8-forced-transfer-hotel': { h: '1bb859e9c25113ce', label: '会社の命令で拠点が変わるとき', value: '朝食と空港の送迎つきのホテルに15日つづけて泊まれる', cond: 'スペインの契約で働くブエリング航空のパイロットの労働協約。自分から望んだ異動は別', en: { label: 'Company-ordered base change', value: 'Fifteen consecutive days in a hotel with breakfast and airport transfers', cond: 'Collective agreement for Vueling pilots on Spanish contracts. Voluntary transfers are different' } },
  /* ── 空港までの移動（暮らしの街の行）。mode ＝ 電車・バスの札 ── */
  'qantas.living.pub-bne-transport': { h: 'a915a8178c8e4f8c', mode: 'train', label: 'Airtrain：ブリスベン中心部（Central 駅）→ 空港', value: '平日 4:31〜21:31・土日祝 5:40〜21:31（15〜30分おき）', en: { label: 'Airtrain: Brisbane city (Central station) → airport', value: 'Weekdays 4:31–21:31, weekends and public holidays 5:40–21:31 (every 15–30 minutes)' } },
  'qantas.living.pub-mel-transport': { h: '353050f3935ac078', mode: 'bus', label: 'SkyBus：サザンクロス駅 ⇄ メルボルン空港', value: '市内と空港を結ぶ City Express を運行', en: { label: 'SkyBus: Southern Cross station ⇄ Melbourne Airport', value: 'Runs the City Express between the city and the airport' } },
  'qantas.living.pub-syd-transport': { h: '9ec22f1f80a46bca', mode: 'train', label: '電車（T8 Airport & South Line）：市内 → シドニー空港', value: '毎日 5時〜24時に運行', en: { label: 'Train (T8 Airport & South Line): city → Sydney Airport', value: 'Runs daily from 5:00 to 24:00' } },
  'qantas.living.pub-syd-transport-n20-bus': { h: '8a24a6f484e2c48e', mode: 'bus', label: '深夜バス N20：市内 → シドニー空港（国際線ターミナル経由）', value: '0時〜4時に運行', en: { label: 'Night bus N20: city → Sydney Airport (via the international terminal)', value: 'Runs from 0:00 to 4:00' } },
  /* 全社へ広げる e（2026-10-22）：d2 の会社の拠点の街（CITY に書いた街）の、拠点の空港までの移動の行。運賃（外貨の額）は字に書かない。
     書かなかった行：同じ道の行の2つめ（ロサンゼルスの FlyAway をまとめた行・ボストンの SL1 のもう1つの行）・運賃の改定の予告だけの行（ロンドンのバス 482） */
  'british-airways.living.c-london-lhr-rail': { h: '8ce76f61b458c346', mode: 'train', label: 'エリザベス線：ロンドン市内 → ヒースロー空港', value: 'ロンドン市内からヒースロー空港へつながる', en: { label: 'Elizabeth line: central London → Heathrow Airport', value: 'Connects central London with Heathrow Airport' } },
  'sas.living.pub-lhr-482': { h: 'f70e5eda18f2b44e', mode: 'bus', label: 'バス 482：ハウンズロー・ウェスト駅 ⇄ ヒースロー空港', value: '第4・第5ターミナルに停まる', en: { label: 'Bus 482: Hounslow West station ⇄ Heathrow Airport', value: 'Stops at Terminals 4 and 5' } },
  'wizz-air.living.pub-ltn-dart': { h: '105d74e9570811b4', mode: 'train', label: 'Luton DART：ルートン・エアポート・パークウェイ駅 → 空港', value: '約4分・24時間運行', en: { label: 'Luton DART: Luton Airport Parkway station → airport', value: 'About 4 minutes, running 24/7' } },
  'eurowings.living.pub-cgn-s19': { h: '5b9c12dcfafb9d90', mode: 'train', label: 'S19：ケルン中央駅 → ケルン・ボン空港', value: '約14分・20分おき', en: { label: 'S19: Cologne Central Station → Cologne Bonn Airport', value: 'About 14 minutes, every 20 minutes' } },
  'sas.living.pub-arn-express': { h: '49ffb06f18e885b9', mode: 'train', label: 'アーランダ・エクスプレス：ストックホルム中央駅 → アーランダ空港', value: '南駅（第2〜4ターミナル）18分・北駅（第5ターミナル）19分・15分おき', en: { label: 'Arlanda Express: Stockholm Central → Arlanda Airport', value: '18 minutes to Arlanda South (Terminals 2–4) and 19 minutes to Arlanda North (Terminal 5), every 15 minutes' } },
  'sas.living.pub-bgo-light-rail': { h: '46eafabfd88506f4', mode: 'train', label: 'ライトレール1号線（Skyss）：ベルゲン中心部 → ベルゲン空港', value: 'ベルゲン中心部と空港を結ぶ', en: { label: 'Light rail Line 1 (Skyss): Bergen city centre → Bergen Airport', value: 'Connects the city centre and the airport' } },
  'solairus.living.na-commute-austin': { h: 'fe1bdc611253b5b6', mode: 'bus', label: 'バス 20番：オースティン空港 → ダウンタウン', value: '約35分（案内）・15〜30分おき', en: { label: 'Bus Route 20: Austin airport → downtown', value: 'About 35 minutes (as stated), every 15–30 minutes' } },
  'southwest.living.publication-city-nashville-commute': { h: 'c901cdb8e0fd161f', mode: 'bus', label: 'バス 18番：ナッシュビル空港 ⇄ WeGo セントラル', value: '急行は約20分・各停は35〜45分', en: { label: 'Bus Route 18: Nashville airport ⇄ WeGo Central', value: 'About 20 minutes express, 35–45 minutes local' } },
  'southwest.living.publication-city-baltimore-commute': { h: 'cb2a4d80f24ed2ee', mode: 'train', label: 'ライトレール：BWI 空港 ⇄ ボルチモア市内', value: '空港とカムデン・コンベンションセンター・レキシントン・マーケットなどの停留所を結ぶ', en: { label: 'Light Rail: BWI airport ⇄ Baltimore', value: 'Connects the airport with stops such as Camden, the Convention Center and Lexington Market' } },
  'frontier.living.pub-city-dallas-commute': { h: 'bc15efe88be7e8e8', mode: 'train', label: 'DART オレンジライン：ダラス中心部 → DFW 空港（ターミナルA）', value: 'アービング経由', en: { label: 'DART Orange Line: downtown Dallas → DFW Airport (Terminal A)', value: 'Via Irving' } },
  'southwest.living.publication-city-houston-commute': { h: 'd300ecfe0468ef9a', mode: 'bus', label: 'バス 40番（METRO）：ホビー空港 → ヒューストン中心部', value: '約1時間', en: { label: 'METRO bus 40: Hobby Airport → downtown Houston', value: 'About 1 hour' } },
  'allegiant.living.missing-commute': { h: 'ba80cf8f33b9985b', mode: 'bus', label: '路線バス（RTC）108番・レッドライン：ラスベガス空港 第1ターミナル', value: '第3ターミナルからは空港のシャトルで第1ターミナルへ', en: { label: 'RTC buses 108 and Red Line: Las Vegas airport Terminal 1', value: 'From Terminal 3, take the terminal shuttle to Terminal 1' } },
  'alaska-airlines.living.pub-city-los-angeles-commute': { h: '453729dc66b699fa', mode: 'bus', label: 'FlyAway：ユニオン駅 → ロサンゼルス国際空港', value: '毎日運行（現金は使えない・先着順）', en: { label: 'FlyAway: Union Station → LAX', value: 'Runs daily (no cash; first come, first served)' } },
  'alaska-airlines.living.pub-city-los-angeles-commute-van-nuys': { h: '5a5db8ae806a236d', mode: 'bus', label: 'FlyAway：バンナイズ → ロサンゼルス国際空港', value: '毎日運行（現金は使えない・先着順）', en: { label: 'FlyAway: Van Nuys → LAX', value: 'Runs daily (no cash; first come, first served)' } },
  'frontier.living.pub-city-orlando-commute': { h: '05546d13b4c2e3ab', mode: 'bus', label: '路線バス（LYNX）：オーランド国際空港', value: '11・42・51・311・407・436S の各系統が空港に乗り入れる', en: { label: 'LYNX buses: Orlando International Airport', value: 'Routes 11, 42, 51, 311, 407 and 436S serve the airport' } },
  'southwest.living.publication-city-chicago-commute': { h: 'a75b40c4d38d8ff3', mode: 'train', label: 'オレンジライン（CTA）：ミッドウェー空港 → シカゴ中心部（ループ）', value: 'ふだんは約20〜25分（夜は運休し、代わりのバス N62）', en: { label: 'CTA Orange Line: Midway Airport → downtown Chicago (the Loop)', value: 'Usually about 20–25 minutes (no service at night; replacement bus N62)' } },
  'southwest.living.publication-city-oakland-commute': { h: 'bdba048e2d795fd3', mode: 'train', label: 'BART：コロシアム駅 → オークランド国際空港', value: 'コロシアム駅で空港への連絡線に乗り換える', en: { label: 'BART: Coliseum station → Oakland International Airport', value: 'Change at Coliseum to the airport connector' } },
  'american.living.publication-city-phoenix-commute': { h: '59d788508ac9b40d', mode: 'train', label: 'スカイトレイン：44th Street 駅 → フェニックス・スカイハーバー空港', value: '44th Street 駅でバレーメトロのライトレール（フェニックス・テンピ・メサ方面）につながる', en: { label: 'PHX Sky Train: 44th Street station → Phoenix Sky Harbor Airport', value: 'Connects at 44th Street with Valley Metro Rail (to Phoenix, Tempe and Mesa)' } },
  'frontier.living.pub-city-cleveland-commute': { h: '63c73b64447de139', mode: 'train', label: 'レッドライン：クリーブランド中心部（タワーシティ）→ クリーブランド空港', value: '30分たらず（毎日4時ごろ〜0時30分ごろ）', en: { label: 'Red Line: downtown Cleveland (Tower City) → Cleveland airport', value: 'Under 30 minutes (daily, from about 4:00 to about 0:30)' } },
  'frontier.living.pub-city-cincinnati-commute': { h: 'ae36ac46e979c6b2', mode: 'bus', label: 'TANK 2X（エアポーター）：シンシナティ中心部 → シンシナティ空港', value: '30分おき', en: { label: 'TANK 2X Airporter: downtown Cincinnati → Cincinnati airport', value: 'Every 30 minutes' } },
  'jetblue.living.pub-city-boston-commute': { h: '013764a15c7f633c', mode: 'bus', label: 'シルバーライン SL1：ボストン空港の各ターミナル → サウス駅', value: '空港から乗るときは無料', en: { label: 'Silver Line SL1: Boston airport terminals → South Station', value: 'Free when boarding at the airport' } },
  'jetblue.living.pub-city-fort-lauderdale-commute': { h: '87fa72a98665d4ef', mode: 'bus', label: 'バス 1番（BCT）：フォートローダーデール空港', value: '空港の停留所はレンタカーセンターの G・毎日運行', en: { label: 'BCT Route 1: Fort Lauderdale airport', value: 'The airport stop is Stop G at the Rental Car Center; runs daily' } },
  'jetblue.living.pub-city-fort-lauderdale-commute-trirail': { h: 'ef1d0faf929f4167', mode: 'train', label: 'トライレール：デーニア・ビーチ駅 ⇄ フォートローダーデール空港', value: '駅と空港のターミナルは無料のシャトルで結ばれる', en: { label: 'Tri-Rail: Dania Beach station ⇄ Fort Lauderdale airport', value: 'A free shuttle connects the station and the terminals' } },
  'american.living.publication-city-new-york-commute': { h: '405656773572a1cb', mode: 'train', label: 'エアトレイン JFK：ジャマイカ駅・ハワードビーチ駅 → JFK 空港', value: 'ジャマイカ駅・ハワードビーチ駅で乗り換える（地下鉄・ロングアイランド鉄道の運賃は別）', en: { label: 'AirTrain JFK: Jamaica and Howard Beach stations → JFK Airport', value: 'Change at Jamaica or Howard Beach (subway and Long Island Rail Road fares are separate)' } },
});

/* ── 資料の名前（出どころのリンクの字）── 資料の ID ごと。資料自身の題は「」の中（資料の言葉）。 */
export const SOURCES = Object.freeze({
  'src-qantas-about': 'カンタス航空「About us」',
  'src-qantas-resume-constitution-hq': 'カンタス航空「Qantas Constitution」（定款）',
  'src-qantas-pub-a321xlr-fleet': 'カンタス航空「Airbus A321XLR」（機材の紹介）',
  'src-qantas-pub-a330-200-fleet': 'カンタス航空「Airbus A330」（機材の紹介）',
  'src-qantas-pub-b737-800-fleet': 'カンタス航空「Boeing 737」（機材の紹介）',
  'src-qantas-resume-academy-faq': 'カンタス航空「Qantas Group Pilot Academy FAQs」',
  'src-qantas-resume-training-facilities': 'カンタス航空「Flight training」',
  'src-qantas-pub-syd-code-company': 'カンタス航空「Flights to Sydney」',
  'src-qantas-pub-brisbane-rent-rta': 'クイーンズランド州 住宅賃貸局（RTA）「Bond statistics」',
  'src-qantas-pub-sydney-rent-government': 'ニューサウスウェールズ州 地域社会・司法省「Rent tables」（2026年6月四半期）',
  'src-qantas-pub-bne-transport': 'Airtrain「Frequency & Hours」',
  'src-qantas-pub-mel-transport': 'SkyBus「Melbourne City Express」',
  'src-qantas-pub-syd-transport': 'ニューサウスウェールズ州交通局「Getting to and from Sydney Airport」',
  'src-skymark-pub-captain-current': 'スカイマーク「B737機長候補者（他社経験者）」',
  'src-skymark-cadet-2027': 'スカイマーク「自社養成パイロット訓練生 募集要項」',
  'src-skymark-pub-fleet-list': 'スカイマーク「航空機のご紹介」',
  'src-skymark-profile': 'スカイマーク「会社概要」',
  'src-skymark-pub-summer-dest': 'スカイマーク「2026年6月1日～10月24日 時刻表」',
  'src-skymark-pub-nilim-airport-codes': '国土交通省 国土技術政策総合研究所「国内空港3レター一覧」',
  /* 全社へ広げる d1（2026-10-21）：調べた側が題に書き足した字（「— 運航路線」「GK rows」「（公式会社情報ページの掲載画像）」）を外した名前 */
  'src-zipair-r2-network-current': '株式会社ZIPAIR Tokyo「ZIPAIRの基本情報」',
  'src-jetstar-japan-pub-fleet': 'ジェットスターの機材の紹介（会社のページ）',
  'src-spring-japan-profile': 'スプリング・ジャパン「会社概要」',
  'src-toho-air-r2-island-timetable': '東邦航空「東京愛らんどシャトル」',
  /* 全社へ広げる d1 の続き（2026-10-21）：アジアの会社。調べた側の書き足し（「追加原資料：… / L0–8」「（公開本文）」「/ 2025 data」・題に付けた説明）を外した名前 */
  'src-garuda-indonesia-followup-agent-1': 'ガルーダ・インドネシア航空の採用サイト「Job Vacancy」',
  'src-philippine-airlines-followup-agent-1': 'フィリピン航空の採用サイト「Pilot And Cabin」',
  'src-china-eastern-p26-pilot2026': 'China Eastern Airlines「第二期远航飞行人才项目招聘」',
  'src-korean-air-p26-hqprivacy': 'Korean Air「Cargo Privacy Policy」',
  'src-korean-air-c26-training2026': '大韓航空のニュース（運航訓練センターのインタビュー・2026年5月8日）',
  'src-china-airlines-c26-workplace': 'China Airlines「幸福職場」（CSRの職場の案内）',
  'src-bamboo-airways-p26-mou2026': 'バンブー・エアウェイズのニュース（BAA Training Vietnam との覚書・2026年）',
  'src-thai-airways-fleet': 'Thai Airways「Our Fleet」（機材の紹介）',
  /* 中東・アフリカの会社（同じ決まり） */
  'src-emirates-resume-legal-hq': 'Emirates「Legal Information」',
  'src-royal-jordanian-resume-fleet-links': 'Royal Jordanian「Sitemap」（機材の項）',
  'src-south-african-airways-followup-negotiation-march18': '南アフリカ航空のニュースルーム（パイロットの給与の交渉についての2025年3月18日の発表）',
  /* 全社へ広げる d2（2026-10-22）：発行元の字を直した名前・調べた側の書き足し（「追加原資料：…」・求人の番号の並び・「via …」）を外した名前 */
  'src-easyjet-followup-agent-1': 'イージージェットの求人（ロンドン・ガトウィックの機長・2027年）',
  'src-norwegian-followup-agent-1': 'ノルウェー・エアシャトルの採用ページ（基地の一覧）',
  'src-norwegian-followup-agent-2': 'ノルウェー・エアシャトルのフィンランドのニュース（パイロットの採用）',
  'src-ryanair-followup-agent-1': 'ライアンエアーの訓練生の募集（英国・EASA）',
  'src-swiss-followup-agent-1': 'スイス インターナショナル エアラインズの求人（A320 の経験者の副操縦士）',
  'src-ryanair-r2-tirana-open-20260401': 'Ryanair「Ryanair Opens 4 Aircraft Tirana Base - Deliver Record Growth in Albania」',
  'src-alaska-airlines-r2-san-20260903': 'Alaska Airlines「40 years in San Diego: Alaska Airlines kicks off anniversary celebration with 50th nonstop destination」',
  'src-breeze-airways-r2-a220-cap-jr100027': 'Breeze Airways「A220 Direct Entry Captain - JR100027」',
  'src-frontier-r2-base-cle-opening': 'Frontier Airlines「Frontier Airlines Opens Crew Base at Cleveland Hopkins International Airport」',
  'src-frontier-r2-base-cvg-opening': 'Frontier Airlines「Frontier Airlines Opens Crew Base at Cincinnati/Northern Kentucky International Airport」',
  'src-frontier-r2-base-dfw-opening': 'Frontier Airlines「Frontier Airlines Opens Crew Base at Dallas Fort Worth International Airport」',
  'src-frontier-r2-phx-opening': 'Frontier Airlines「Frontier Airlines Celebrates Crew Base Opening at Phoenix Sky Harbor International Airport」',
  'src-frontier-r2-base-sju-opening': 'Frontier Airlines「Frontier Airlines Opens Crew Base at Luis Muñoz Marín International Airport」',
  'src-porter-r2-dash8-5320': 'Porter Airlines「First Officer Dash 8 - Req ID 5320」',
  'src-porter-r2-e195-5297': 'Porter Airlines「Direct Entry Captain - Embraer E195-E2 (Toronto) YYZ - Req ID 5297」',
  'src-copa-airlines-pub-own-fo-panama-post': 'コパ航空の LinkedIn の投稿（アルゼンチンでの副操縦士の募集）',
  'src-copa-airlines-pub-fo-publicjob': 'コパ航空の LinkedIn の求人（B737 の副操縦士）',
  'src-copa-airlines-pub-captain-publicjob': 'コパ航空の LinkedIn の求人（B737 の機長）',
  'src-copa-airlines-pub-own-headquarters': 'コパ航空の LinkedIn の会社のページ',
  'src-copa-airlines-pub-2025-form20f': 'Copa Holdings の2025年の年次報告（Form 20-F・米国証券取引委員会に提出）',
  'src-fiji-airways-p26-job-api': 'フィジー・エアウェイズの公開の求人一覧（StaffCV）',
  'src-turkish-airlines-cockpit-current': 'Turkish Airlines「Cockpit Crew」（採用ページのQ&A）',
  'src-iberia-job2025-expired': 'イベリア航空の2025年の新人パイロットの求人のページ',
  'src-delta-resume-general-benefits': 'Delta Air Lines「Benefits & Total Rewards」',
  'src-westjet-resume-benefits': 'WestJet「Benefits」',
  'src-air-france-pilot-current': 'Air France「Pilote de ligne」（養成コースと経験者のQ&A）',
  'src-finnair-pub-mpl-specific': 'Finnair「MPL Program」（Q&A）',
  'src-solairus-r10-pc24-commutable-2002': 'Solairus Aviation「Pilatus PC-24 Captain - Commutable」（求人 2026-2002）',
  'src-air-canada-r10-french-pilot-38766': 'Air Canada「Pilote (pour les candidats qui ne sont pas des pilotes d\'Air Canada Express)」',
  'src-lot-a220-fo-posting': 'LOT Crew（LOT ポーランド航空の乗員の会社）「Type Rated First Officer A220」',
  'src-jetstar-r2-per-2026': 'ジェットスター航空のニュース（パースとクライストチャーチを結ぶ便の発表）',
  'src-eurowings-basic-final': 'Eurowings「General Conditions of Carriage」（2026年8月27日版）',
  'src-united-r7-evidence-2': 'United Airlines Holdings「2025 Form 10-K」',
  /* 全社へ広げる e（2026-10-22）：暮らしの街の家賃・移動の資料。台帳の題が調べた側の書き足し（「部屋型別家賃 Atlanta」「Austin空港交通」
     「… airport public transport」）のものは、資料の題として「」に入れず、どこの何の案内かを書く */
  'src-city-r3-eurostat-isrp-market-rents-2025': 'ISRP/OECD・ユーロスタット「MARKET RENTS 2025」',
  'src-delta-na-rent-atlanta': 'RentCafe（Yardi Matrix）のアトランタの家賃の表',
  'src-solairus-na-rent-austin': 'RentCafe（Yardi Matrix）のオースティンの家賃の表',
  'src-frontier-pub-shared-dallas-dallas': 'RentCafe（Yardi Matrix）のダラスの家賃の表',
  'src-frontier-na-rent-denver': 'RentCafe（Yardi Matrix）のデンバーの家賃の表',
  'src-allegiant-na-rent-las-vegas': 'RentCafe（Yardi Matrix）のラスベガスの家賃の表',
  'src-american-na-rent-chicago': 'RentCafe（Yardi Matrix）のシカゴの家賃の表',
  'src-breeze-airways-pub-rent-orlando': 'RentCafe（Yardi Matrix）のオーランドの家賃の表',
  'src-southwest-publication-city-nashville-22': 'Zumper のナッシュビルの家賃の表',
  'src-southwest-publication-city-baltimore-11': 'Zumper のボルチモアの家賃の表',
  'src-southwest-publication-city-houston-15': 'Zumper のヒューストンの家賃の表',
  'src-alaska-airlines-pub-rent-city-los-angeles': 'Zumper のロサンゼルスの家賃の表',
  'src-southwest-publication-city-oakland-28': 'Zumper のオークランド（カリフォルニア州）の家賃の表',
  'src-american-publication-city-phoenix-30': 'Zumper のフェニックスの家賃の表',
  'src-frontier-pub-rent-city-cleveland': 'Zumper のクリーブランドの家賃の表',
  'src-frontier-pub-rent-city-cincinnati': 'Zumper のシンシナティの家賃の表',
  'src-american-publication-city-boston-15': 'Zumper のボストンの家賃の表',
  'src-jetblue-pub-rent-city-fort-lauderdale': 'Zumper のフォートローダーデールの家賃の表',
  'src-american-publication-city-new-york-26': 'Zumper のニューヨークの家賃の表',
  'src-air-canada-pub-rent-city-toronto': 'Zumper のトロントの家賃の表',
  'src-jetstar-r7-recheck-1': '西オーストラリア州不動産協会（REIWA）のパース都市圏の賃貸の市場データ',
  'src-solairus-na-transport-austin': 'CapMetro（オースティンの交通局）の空港への案内',
  'src-frontier-pub-transit-city-dallas': 'DFW 空港の公共交通の案内',
  'src-southwest-publication-city-nashville-23': 'WeGo（ナッシュビルの交通局）の Q&A（空港への便）',
  'src-southwest-publication-city-baltimore-12': 'メリーランド州交通局（MTA）のライトレールの停留所の一覧',
  'src-southwest-publication-city-houston-16': 'ヒューストン空港局のホビー空港の交通の案内',
  'src-allegiant-pub-transit-city-las-vegas': 'ハリー・リード国際空港（クラーク郡航空局）の路線バスの案内',
  'src-frontier-pub-shared-transit-orlando-21': 'LYNX（オーランドの交通局）の主な行き先の案内',
  'src-southwest-publication-city-chicago-27': 'シカゴ交通局（CTA）の空港への案内',
  'src-southwest-publication-city-oakland-29': 'BART のコロシアム駅の案内',
  'src-frontier-pub-transit-city-cleveland': 'クリーブランド地域交通局（RTA）の空港への便の案内',
  'src-frontier-pub-transit-city-cincinnati': 'TANK（北ケンタッキー交通局）の Q&A',
  'src-jetblue-pub-transit-city-boston': 'マサチューセッツ湾交通局（MBTA）のローガン空港への案内',
  'src-american-publication-city-new-york-27': 'JFK 空港（ニューヨーク・ニュージャージー港湾公社）のエアトレインの案内',
});
/* 英語の名前（SOURCES の対。資料自身の題は “ ” の中 ── 資料の言葉。中国語・日本語の題は、題のあとに英語の説明を（ ）で） */
export const SOURCES_EN = Object.freeze({
  'src-qantas-about': 'Qantas “About us”',
  'src-qantas-resume-constitution-hq': 'Qantas “Qantas Constitution”',
  'src-qantas-pub-a321xlr-fleet': 'Qantas “Airbus A321XLR” (fleet page)',
  'src-qantas-pub-a330-200-fleet': 'Qantas “Airbus A330” (fleet page)',
  'src-qantas-pub-b737-800-fleet': 'Qantas “Boeing 737” (fleet page)',
  'src-qantas-resume-academy-faq': 'Qantas “Qantas Group Pilot Academy FAQs”',
  'src-qantas-resume-training-facilities': 'Qantas “Flight training”',
  'src-qantas-pub-syd-code-company': 'Qantas “Flights to Sydney”',
  'src-qantas-pub-brisbane-rent-rta': 'Queensland Residential Tenancies Authority (RTA) “Bond statistics”',
  'src-qantas-pub-sydney-rent-government': 'NSW Department of Communities and Justice “Rent tables” (June quarter 2026)',
  'src-qantas-pub-bne-transport': 'Airtrain “Frequency & Hours”',
  'src-qantas-pub-mel-transport': 'SkyBus “Melbourne City Express”',
  'src-qantas-pub-syd-transport': 'Transport for NSW “Getting to and from Sydney Airport”',
  'src-skymark-pub-captain-current': 'Skymark “B737 captain candidates (experienced at another airline)”',
  'src-skymark-cadet-2027': 'Skymark “Company-sponsored pilot cadet recruitment terms”',
  'src-skymark-pub-fleet-list': 'Skymark “Our aircraft”',
  'src-skymark-profile': 'Skymark “Company profile”',
  'src-skymark-pub-summer-dest': 'Skymark “Timetable, 1 June – 24 October 2026”',
  'src-skymark-pub-nilim-airport-codes': 'National Institute for Land and Infrastructure Management (MLIT) “Three-letter codes of Japanese airports”',
  'src-zipair-r2-network-current': 'ZIPAIR Tokyo “ZIPAIR basic information”',
  'src-jetstar-japan-pub-fleet': 'Jetstar fleet page (company page)',
  'src-spring-japan-profile': 'Spring Japan “Company profile”',
  'src-toho-air-r2-island-timetable': 'Toho Air Service “Tokyo Islands Shuttle”',
  'src-garuda-indonesia-followup-agent-1': 'Garuda Indonesia recruitment site “Job Vacancy”',
  'src-philippine-airlines-followup-agent-1': 'Philippine Airlines recruitment site “Pilot And Cabin”',
  'src-china-eastern-p26-pilot2026': 'China Eastern Airlines “第二期远航飞行人才项目招聘” (second-round flying talent recruitment)',
  'src-korean-air-p26-hqprivacy': 'Korean Air “Cargo Privacy Policy”',
  'src-korean-air-c26-training2026': 'Korean Air news (interview at the flight training centre, 8 May 2026)',
  'src-china-airlines-c26-workplace': 'China Airlines “幸福職場” (CSR workplace guide)',
  'src-bamboo-airways-p26-mou2026': 'Bamboo Airways news (memorandum with BAA Training Vietnam, 2026)',
  'src-thai-airways-fleet': 'Thai Airways “Our Fleet”',
  'src-emirates-resume-legal-hq': 'Emirates “Legal Information”',
  'src-royal-jordanian-resume-fleet-links': 'Royal Jordanian “Sitemap” (fleet section)',
  'src-south-african-airways-followup-negotiation-march18': 'South African Airways newsroom (statement on pilot pay negotiations, 18 March 2025)',
  /* 全社へ広げる d2（2026-10-22）：発行元の字を直した名前・調べた側の書き足し（「追加原資料：…」・求人の番号の並び・「via …」）を外した名前 */
  'src-easyjet-followup-agent-1': 'easyJet vacancy (London Gatwick captains, 2027)',
  'src-norwegian-followup-agent-1': 'Norwegian careers page (list of bases)',
  'src-norwegian-followup-agent-2': 'Norwegian Finland newsroom (pilot hiring)',
  'src-ryanair-followup-agent-1': 'Ryanair cadet recruitment (UK and EASA)',
  'src-swiss-followup-agent-1': 'SWISS vacancy (experienced A320 first officers)',
  'src-ryanair-r2-tirana-open-20260401': 'Ryanair “Ryanair Opens 4 Aircraft Tirana Base - Deliver Record Growth in Albania”',
  'src-alaska-airlines-r2-san-20260903': 'Alaska Airlines “40 years in San Diego: Alaska Airlines kicks off anniversary celebration with 50th nonstop destination”',
  'src-breeze-airways-r2-a220-cap-jr100027': 'Breeze Airways “A220 Direct Entry Captain - JR100027”',
  'src-frontier-r2-base-cle-opening': 'Frontier Airlines “Frontier Airlines Opens Crew Base at Cleveland Hopkins International Airport”',
  'src-frontier-r2-base-cvg-opening': 'Frontier Airlines “Frontier Airlines Opens Crew Base at Cincinnati/Northern Kentucky International Airport”',
  'src-frontier-r2-base-dfw-opening': 'Frontier Airlines “Frontier Airlines Opens Crew Base at Dallas Fort Worth International Airport”',
  'src-frontier-r2-phx-opening': 'Frontier Airlines “Frontier Airlines Celebrates Crew Base Opening at Phoenix Sky Harbor International Airport”',
  'src-frontier-r2-base-sju-opening': 'Frontier Airlines “Frontier Airlines Opens Crew Base at Luis Muñoz Marín International Airport”',
  'src-porter-r2-dash8-5320': 'Porter Airlines “First Officer Dash 8 - Req ID 5320”',
  'src-porter-r2-e195-5297': 'Porter Airlines “Direct Entry Captain - Embraer E195-E2 (Toronto) YYZ - Req ID 5297”',
  'src-copa-airlines-pub-own-fo-panama-post': 'Copa Airlines LinkedIn post (first officer recruitment in Argentina)',
  'src-copa-airlines-pub-fo-publicjob': 'Copa Airlines LinkedIn vacancy (B737 first officer)',
  'src-copa-airlines-pub-captain-publicjob': 'Copa Airlines LinkedIn vacancy (B737 captain)',
  'src-copa-airlines-pub-own-headquarters': 'Copa Airlines LinkedIn company page',
  'src-copa-airlines-pub-2025-form20f': 'Copa Holdings 2025 annual report (Form 20-F, filed with the US SEC)',
  'src-fiji-airways-p26-job-api': 'Fiji Airways public job list (StaffCV)',
  'src-turkish-airlines-cockpit-current': 'Turkish Airlines “Cockpit Crew” (recruitment Q&A)',
  'src-iberia-job2025-expired': 'Iberia 2025 new-entry pilot vacancy page',
  'src-delta-resume-general-benefits': 'Delta Air Lines “Benefits & Total Rewards”',
  'src-westjet-resume-benefits': 'WestJet “Benefits”',
  'src-air-france-pilot-current': 'Air France “Pilote de ligne” (cadet and professional Q&A)',
  'src-finnair-pub-mpl-specific': 'Finnair “MPL Program” (Q&A)',
  'src-solairus-r10-pc24-commutable-2002': 'Solairus Aviation “Pilatus PC-24 Captain - Commutable” (vacancy 2026-2002)',
  'src-air-canada-r10-french-pilot-38766': 'Air Canada “Pilote (pour les candidats qui ne sont pas des pilotes d\'Air Canada Express)”',
  'src-lot-a220-fo-posting': 'LOT Crew (LOT Polish Airlines’ crew company) “Type Rated First Officer A220”',
  'src-jetstar-r2-per-2026': 'Jetstar Airways news (flights between Perth and Christchurch)',
  'src-eurowings-basic-final': 'Eurowings “General Conditions of Carriage” (version of 27 August 2026)',
  'src-united-r7-evidence-2': 'United Airlines Holdings “2025 Form 10-K”',
  'src-city-r3-eurostat-isrp-market-rents-2025': 'ISRP/OECD and Eurostat “MARKET RENTS 2025”',
  'src-delta-na-rent-atlanta': 'RentCafe (Yardi Matrix) Atlanta rent table',
  'src-solairus-na-rent-austin': 'RentCafe (Yardi Matrix) Austin rent table',
  'src-frontier-pub-shared-dallas-dallas': 'RentCafe (Yardi Matrix) Dallas rent table',
  'src-frontier-na-rent-denver': 'RentCafe (Yardi Matrix) Denver rent table',
  'src-allegiant-na-rent-las-vegas': 'RentCafe (Yardi Matrix) Las Vegas rent table',
  'src-american-na-rent-chicago': 'RentCafe (Yardi Matrix) Chicago rent table',
  'src-breeze-airways-pub-rent-orlando': 'RentCafe (Yardi Matrix) Orlando rent table',
  'src-southwest-publication-city-nashville-22': 'Zumper Nashville rent table',
  'src-southwest-publication-city-baltimore-11': 'Zumper Baltimore rent table',
  'src-southwest-publication-city-houston-15': 'Zumper Houston rent table',
  'src-alaska-airlines-pub-rent-city-los-angeles': 'Zumper Los Angeles rent table',
  'src-southwest-publication-city-oakland-28': 'Zumper Oakland (California) rent table',
  'src-american-publication-city-phoenix-30': 'Zumper Phoenix rent table',
  'src-frontier-pub-rent-city-cleveland': 'Zumper Cleveland rent table',
  'src-frontier-pub-rent-city-cincinnati': 'Zumper Cincinnati rent table',
  'src-american-publication-city-boston-15': 'Zumper Boston rent table',
  'src-jetblue-pub-rent-city-fort-lauderdale': 'Zumper Fort Lauderdale rent table',
  'src-american-publication-city-new-york-26': 'Zumper New York rent table',
  'src-air-canada-pub-rent-city-toronto': 'Zumper Toronto rent table',
  'src-jetstar-r7-recheck-1': 'Real Estate Institute of Western Australia (REIWA) Perth Metro rental market data',
  'src-solairus-na-transport-austin': 'CapMetro (Austin transit) airport information',
  'src-frontier-pub-transit-city-dallas': 'DFW Airport public transit information',
  'src-southwest-publication-city-nashville-23': 'WeGo Public Transit Q&A (airport service)',
  'src-southwest-publication-city-baltimore-12': 'Maryland Transit Administration Light Rail stop list',
  'src-southwest-publication-city-houston-16': 'Houston Airports ground transportation at Hobby',
  'src-allegiant-pub-transit-city-las-vegas': 'Harry Reid International Airport (Clark County Department of Aviation) public bus information',
  'src-frontier-pub-shared-transit-orlando-21': 'LYNX (Orlando transit) popular destinations',
  'src-southwest-publication-city-chicago-27': 'Chicago Transit Authority airport information',
  'src-southwest-publication-city-oakland-29': 'BART Coliseum station information',
  'src-frontier-pub-transit-city-cleveland': 'Greater Cleveland RTA airport service',
  'src-frontier-pub-transit-city-cincinnati': 'TANK (Transit Authority of Northern Kentucky) Q&A',
  'src-jetblue-pub-transit-city-boston': 'MBTA Logan Airport information',
  'src-american-publication-city-new-york-27': 'JFK Airport (Port Authority of New York and New Jersey) AirTrain information',
});
/* 同じ資料（住所）を、会社ごとの台帳の行がちがう題で書いているときの1つの名前（全社へ広げる d1・2026-10-21）。
   国土技術政策総合研究所の空港の一覧は「（名称・3レター対応のみ）」「リンク／」のような調べた側の書き足しで題が割れていた。
   資料の ID ごとの名前（SOURCES）が在ればそちらが先。 */
export const SOURCE_URL = Object.freeze({
  'https://www.ysk.nilim.go.jp/kakubu/kukou/sisetu/links.html': '国土交通省 国土技術政策総合研究所「空港最寄震度観測点一覧」',
});
/* 発行元の英語の名前（日本語の発行元の名前 → サイトの英語の社名 ＝ salary-data.mjs の SALARY の en）。英語の資料の名前（srcName の 'en'）が
   SOURCES_EN に無いときの「発行元 “題”」の発行元に使う（題は資料の言葉のまま）。鍵は「株式会社」・空白・末尾の（ ）を外し、全角の英数を半角にした字 */
export const PUBLISHER_EN = Object.freeze({
  'ZIPAIRTokyo': 'ZIPAIR Tokyo', 'ジェットスター・ジャパン': 'Jetstar Japan', 'PeachAviation': 'Peach Aviation', 'ソラシドエア': 'Solaseed Air',
  'AIRDO': 'AIRDO', 'スターフライヤー': 'StarFlyer', 'フジドリームエアラインズ': 'Fuji Dream Airlines (FDA)', 'エアージャパン': 'AirJapan',
  '天草エアライン': 'Amakusa Airlines', 'ANAウイングス': 'ANA Wings', '第一航空': 'Daiichi Aviation', '北海道エアシステム': 'Hokkaido Air System',
  'IBEXエアラインズ': 'IBEX Airlines', 'アイベックスエアラインズ': 'IBEX Airlines', 'ジェイエア': 'J-AIR', '日本エアコミューター': 'Japan Air Commuter',
  '日本トランスオーシャン航空': 'Japan Transocean Air', 'オリエンタルエアブリッジ': 'Oriental Air Bridge', '琉球エアーコミューター': 'Ryukyu Air Commuter',
  '新中央航空': 'Shin Chuo Airlines', '新日本航空': 'Shin Nihon Airlines', '東邦航空': 'Toho Air Service', 'トキエア': 'Toki Air',
});
const pubKey = p => String(p || '').replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/株式会社/g, '').replace(/[\s　]+/g, '').replace(/[（(][^）)]*[）)]$/, '');
export const publisherEn = p => (/[ぁ-んァ-ヶ一-龥]/.test(String(p || '')) ? PUBLISHER_EN[pubKey(p)] || '' : String(p || ''));
export const SOURCE_URL_EN = Object.freeze({
  'https://www.ysk.nilim.go.jp/kakubu/kukou/sisetu/links.html': 'National Institute for Land and Infrastructure Management (MLIT) “List of seismic stations nearest to airports”',
});

/* ── 就航地（NET）── 調べで確かめた就航地の一覧（会社全体の就航地とは限らない）。
   basis … 何の一覧か（出典の「条件」に出す1行）。h … まとめた行ぜんぶの指紋（digest）。 */
export const NET = Object.freeze({
  /* 2026-10-21 a2：茨城（IBR）・下地島（SHI）の行が入った（空港の呼び名を足したため）── どちらも同じ夏ダイヤの時刻表の行。basis はそのまま正しい */
  skymark: { h: '4862cf7b58b503ef', basis: '2026年夏ダイヤ（6月1日〜10月24日）の時刻表で、スカイマークが自社便を飛ばしている空港。拠点の空港は入れていません。', basis_en: 'Airports where Skymark flies its own flights in the summer 2026 timetable (1 June – 24 October). Base airports are not included.' },
  /* ⚠️ いまの台帳の行は SYD の1つだけで、SYD はカンタスの拠点（本拠地は一覧に入れない）── 画面には就航地の一覧が出ない（2026-10-21）。 */
  qantas: { h: '965d1d7ace2efd6f', basis: 'カンタス航空の機材の紹介（A321XLR）に行き先として載っている空港', basis_en: 'Airports listed as destinations on Qantas’s fleet page (A321XLR)' },
  /* 全社へ広げる d1（2026-10-21）：日本の会社。拠点の分かる会社だけ（拠点の空港を就航地として並べない ── 拠点の行が台帳に無い
     スプリング・ジャパン・北海道エアシステム・ジェイエア・日本トランスオーシャン航空・オリエンタルエアブリッジ・琉球エアーコミューター・
     新中央航空は、拠点が分かるまで一覧を出さない）。 */
  'zipair': { h: 'f251284f4ea688c9', basis: 'ZIPAIR の基本情報（運航路線）に、自社の定期便の行き先として載っている空港。拠点の空港は入れていません。', basis_en: 'Airports listed as scheduled destinations in ZIPAIR’s basic information (routes). Base airports are not included.' },
  'jetstar-japan': { h: 'b44f15f72cb27c79', basis: '2026年夏期の運航スケジュール（2026年1月27日の発表）に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in the summer 2026 schedule (announced 27 January 2026). Base airports are not included.' },
  'peach': { h: '8939c481e9c38f32', basis: 'Peach の路線・時刻表に載っている空港（運休中と書かれた空港は入れていません）。拠点の空港は入れていません。', basis_en: 'Airports in Peach’s routes and timetables (airports marked as suspended are not included). Base airports are not included.' },
  'solaseed': { h: '200dbe001e75a1e2', basis: 'ソラシドエアの時刻表・就航路線に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in Solaseed Air’s timetables and routes. Base airports are not included.' },
  'airdo': { h: 'aef2e57fbcfdca07', basis: 'AIRDO の運航路線・就航地の案内に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in AIRDO’s route and destination guide. Base airports are not included.' },
  'starflyer': { h: 'e04fff1794cdabec', basis: 'スターフライヤーの国内線時刻表に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in StarFlyer’s domestic timetable. Base airports are not included.' },
  'fda': { h: '6860021335ac57a7', basis: 'FDA の路線・時刻表（2026年3月29日〜10月24日）に載っている空港。拠点の街（名古屋・静岡）の空港は入れていません。', basis_en: 'Airports in FDA’s routes and timetable (29 March – 24 October 2026). Airports of the base cities (Nagoya and Shizuoka) are not included.' },
  'amx': { h: '1c8913d248204ef2', basis: '天草エアラインの時刻表の案内に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in Amakusa Airlines’ timetable guide. Base airports are not included.' },
  'ana-wings': { h: '48e6cbd564e73ff5', basis: 'ANAウイングスの機材・路線図に、出発する空港として載っている空港。拠点の空港は入れていません。', basis_en: 'Airports listed as departure airports in ANA Wings’ fleet and route map. Base airports are not included.' },
  'daiichi-air': { h: 'f4461da6ccc8a4e5', basis: '第一航空の沖縄離島便の案内（2026年10月の運航のお知らせ）に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in Daiichi Air’s Okinawa island flights guide (operations notice for October 2026). Base airports are not included.' },
  'ibex': { h: '4f5c0cc345e93aec', basis: 'IBEXエアラインズの路線図（出発・到着の空港の一覧）に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in IBEX Airlines’ route map (departure and arrival airports). Base airports are not included.' },
  'jac': { h: 'd95b587e71d6889a', basis: '日本エアコミューターの運航路線図に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in Japan Air Commuter’s route map. Base airports are not included.' },
  'toho-air': { h: '6aaf482380403988', basis: '東京愛らんどシャトルの週間時刻表に載っている発着地。拠点の街（東京）の空港は入れていません。', basis_en: 'Places in the weekly timetable of the Tokyo Islands Shuttle. Airports of the base city (Tokyo) are not included.' },
  /* 全社へ広げる d1 の続き（2026-10-21）：アジアの会社。拠点の分かる会社だけ（シンガポール航空・アシアナ航空・香港エクスプレス・スクートなどは
     就航地の行が台帳に在っても、拠点の行が無い ── 拠点が分かるまで一覧を出さない）。ロイヤルブルネイ航空は拠点の街（バンダルスリブガワン）は
     分かるが、その街の空港が空港の呼び名の表（PLACES）に無い ＝ 拠点の空港を一覧から外せると確かめられないので、一覧を出さない。 */
  'china-eastern': { h: '4642bffece3e697b', basis: '中部国際空港の国際線の時刻表（2026年10月1日〜24日）に、中国東方航空の便が載っている空港。拠点の街（上海）の空港は入れていません。', basis_en: 'Airports with China Eastern flights in Chubu Centrair’s international timetable (1–24 October 2026). Airports of the base city (Shanghai) are not included.' },
  /* 全社へ広げる d2（2026-10-22）：拠点の空港の行が在り、その会社の資料（路線・空港の案内）で拠点のほかに行き先が残る会社だけ。
     出さない会社：拠点の分からない会社（KLM・エールフランス・ルフトハンザ・アイスランド航空 など）／拠点の行が一部だけで、残る行き先に
     その会社の本当の基地が混ざりうる会社（フロンティア航空・ブエリング航空・アラスカ航空）／1便のニュースや1つの空港の案内だけの会社
     （ブリティッシュ・エアウェイズ・スカンジナビア航空・ヴァージン・アトランティック航空・ジェットスター航空）／行の使い方が「過去」で
     日付の無い行が多い会社（LOT ポーランド航空）。 */
  'austrian': { h: '56091721449bc691', basis: 'オーストリア航空の2026年夏ダイヤの発表に、北米の長距離の行き先として載っている空港。拠点の空港は入れていません。', basis_en: 'Airports listed as North American long-haul destinations in Austrian Airlines’ 2026 summer schedule announcement. Base airports are not included.' },
  'southwest': { h: '584480381c4f2cde', basis: 'サウスウエスト航空の空港の案内に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in Southwest Airlines’ airport information. Base airports are not included.' },
  'jetblue': { h: '29741a984d702e72', basis: 'ジェットブルー航空の空港の案内に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in JetBlue’s airport information. Base airports are not included.' },
});

/* ── 暮らしの街（CITY）── 調べの台帳の街（拠点の空港ごと）。先行5社の台帳に在る街（東京など）はここに書かない（そちらを使う）。
   rents … 家賃の行の ID（間取りの鍵ごと）。h … 家賃と移動の行ぜんぶの指紋（digest）。
   per   … 家賃の期間（資料の表が週あたり ＝ 'week'。台帳の per 欄には週が無いので、ここで言う）。
   measure … 何の額か（カードの見出しに入る短い字）。site … 資料の名前（短く）。
   scope … 数字の範囲の断り（出典の「条件」に出す1行。資料の区域・何の物件か・間取りの数え方）。 */
export const CITY = Object.freeze({
  brisbane: { h: 'fea01c5db19eb55c', ja: 'ブリスベン', en: 'Brisbane', iata: 'BNE', airport: 'ブリスベン空港', airport_en: 'Brisbane Airport',
    measure: '新規契約の家賃の中央値', site: 'クイーンズランド州 住宅賃貸局', per: 'week', measure_en: 'Median rent of new leases', site_en: 'Queensland Residential Tenancies Authority',
    scope: 'ブリスベン市（City of Brisbane）の区域で、新しく結ばれたアパート（flat）の賃貸契約の家賃の中央値。1-Bed・2-Bed は寝室の数',
    scope_en: 'Median rent of new flat leases in the City of Brisbane area. 1-Bed and 2-Bed are the number of bedrooms' },
  melbourne: { h: '0955d463f69ccc37', ja: 'メルボルン', en: 'Melbourne', iata: 'MEL', airport: 'メルボルン空港', airport_en: 'Melbourne Airport' },
  sydney: { h: '0b22d3faad7e3382', ja: 'シドニー', en: 'Sydney', iata: 'SYD', airport: 'シドニー空港', airport_en: 'Sydney Airport',
    measure: '新規契約の家賃の中央値', site: 'ニューサウスウェールズ州 地域社会・司法省', per: 'week', measure_en: 'Median rent of new leases', site_en: 'NSW Department of Communities and Justice',
    scope: 'シドニー市（City of Sydney）の区域で、新しく結ばれたアパート・ユニットの賃貸契約の家賃の中央値（シドニー都市圏ぜんたいの数字ではない）。1-Bed・2-Bed は寝室の数',
    scope_en: 'Median rent of new apartment and unit leases in the City of Sydney area (not a figure for all of Greater Sydney). 1-Bed and 2-Bed are the number of bedrooms' },
  /* 全社へ広げる d1（2026-10-21）：日本の会社の拠点の街（先行5社の台帳の東京ではない街）。どれも LIFULL HOME'S の区・市の家賃相場（1つの街に1つの資料）。
     家賃の行の無い街（石垣・天草）は字だけ（今までの「家賃の資料を確認できていません」）。 */
  izumisano: { h: '5ca9ff1264e569e8', ja: '泉佐野市', en: 'Izumisano', iata: 'KIX', airport: '関西国際空港', airport_en: 'Kansai International Airport',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month', measure_en: 'Market rent', site_en: 'LIFULL HOME’S',
    scope: '泉佐野市の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK',
    scope_en: 'Market rent in Izumisano (LIFULL HOME’S’s own figure from listed properties; excludes management fees and parking; not agreed rents). Studio = 1K, 1-Bed = 1LDK, 2-Bed = 2LDK' },
  kitakyushu: { h: '762e7d1eec0505f9', ja: '北九州市小倉北区', en: 'Kokurakita, Kitakyushu', iata: 'KKJ', airport: '北九州空港', airport_en: 'Kitakyushu Airport',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month', measure_en: 'Market rent', site_en: 'LIFULL HOME’S',
    scope: '北九州市小倉北区の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK・3-Bed は 3LDK',
    scope_en: 'Market rent in Kokurakita ward, Kitakyushu (LIFULL HOME’S’s own figure from listed properties; excludes management fees and parking; not agreed rents). Studio = 1K, 1-Bed = 1LDK, 2-Bed = 2LDK, 3-Bed = 3LDK' },
  nagoya: { h: 'c2c8b21e02b0efc1', ja: '名古屋市中区', en: 'Naka, Nagoya', iata: 'NGO', airport: '中部国際空港', airport_en: 'Chubu Centrair International Airport',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month', measure_en: 'Market rent', site_en: 'LIFULL HOME’S',
    scope: '名古屋市中区の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK・3-Bed は 3LDK',
    scope_en: 'Market rent in Naka ward, Nagoya (LIFULL HOME’S’s own figure from listed properties; excludes management fees and parking; not agreed rents). Studio = 1K, 1-Bed = 1LDK, 2-Bed = 2LDK, 3-Bed = 3LDK' },
  fukuoka: { h: 'e03a883ce7f6f25c', ja: '福岡市博多区', en: 'Hakata, Fukuoka', iata: 'FUK', airport: '福岡空港', airport_en: 'Fukuoka Airport',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month', measure_en: 'Market rent', site_en: 'LIFULL HOME’S',
    scope: '福岡市博多区の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK・3-Bed は 3LDK',
    scope_en: 'Market rent in Hakata ward, Fukuoka (LIFULL HOME’S’s own figure from listed properties; excludes management fees and parking; not agreed rents). Studio = 1K, 1-Bed = 1LDK, 2-Bed = 2LDK, 3-Bed = 3LDK' },
  itami: { h: 'efdd19276bf20ca8', ja: '伊丹市', en: 'Itami', iata: 'ITM', airport: '大阪国際空港（伊丹）', airport_en: 'Osaka International Airport (Itami)',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month', measure_en: 'Market rent', site_en: 'LIFULL HOME’S',
    scope: '伊丹市の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK・3-Bed は 3LDK',
    scope_en: 'Market rent in Itami (LIFULL HOME’S’s own figure from listed properties; excludes management fees and parking; not agreed rents). Studio = 1K, 1-Bed = 1LDK, 2-Bed = 2LDK, 3-Bed = 3LDK' },
  naha: { h: '831abc915bc77d47', ja: '那覇市', en: 'Naha', iata: 'OKA', airport: '那覇空港', airport_en: 'Naha Airport',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month', measure_en: 'Market rent', site_en: 'LIFULL HOME’S',
    scope: '那覇市の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK・3-Bed は 3LDK',
    scope_en: 'Market rent in Naha (LIFULL HOME’S’s own figure from listed properties; excludes management fees and parking; not agreed rents). Studio = 1K, 1-Bed = 1LDK, 2-Bed = 2LDK, 3-Bed = 3LDK' },
  ishigaki: { h: '582a6c7fc9060fcc', ja: '石垣', en: 'Ishigaki', iata: 'ISG', airport: '石垣空港', airport_en: 'Ishigaki Airport' },
  sendai: { h: '99bde90fd1c6cb94', ja: '仙台市宮城野区', en: 'Miyagino, Sendai', iata: 'SDJ', airport: '仙台空港', airport_en: 'Sendai Airport',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month', measure_en: 'Market rent', site_en: 'LIFULL HOME’S',
    scope: '仙台市宮城野区の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK・3-Bed は 3LDK',
    scope_en: 'Market rent in Miyagino ward, Sendai (LIFULL HOME’S’s own figure from listed properties; excludes management fees and parking; not agreed rents). Studio = 1K, 1-Bed = 1LDK, 2-Bed = 2LDK, 3-Bed = 3LDK' },
  kirishima: { h: '779f18916758fbb7', ja: '霧島市', en: 'Kirishima', iata: 'KOJ', airport: '鹿児島空港', airport_en: 'Kagoshima Airport',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month', measure_en: 'Market rent', site_en: 'LIFULL HOME’S',
    scope: '霧島市の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK',
    scope_en: 'Market rent in Kirishima (LIFULL HOME’S’s own figure from listed properties; excludes management fees and parking; not agreed rents). Studio = 1K, 1-Bed = 1LDK, 2-Bed = 2LDK' },
  kobe: { h: 'c881442b4d3c5595', ja: '神戸市中央区', en: 'Chuo, Kobe', iata: 'UKB', airport: '神戸空港', airport_en: 'Kobe Airport',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month', measure_en: 'Market rent', site_en: 'LIFULL HOME’S',
    scope: '神戸市中央区の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK・3-Bed は 3LDK',
    scope_en: 'Market rent in Chuo ward, Kobe (LIFULL HOME’S’s own figure from listed properties; excludes management fees and parking; not agreed rents). Studio = 1K, 1-Bed = 1LDK, 2-Bed = 2LDK, 3-Bed = 3LDK' },
  niigata: { h: 'f3e36e60e36624a8', ja: '新潟市中央区', en: 'Chuo, Niigata', iata: 'KIJ', airport: '新潟空港', airport_en: 'Niigata Airport',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month', measure_en: 'Market rent', site_en: 'LIFULL HOME’S',
    scope: '新潟市中央区の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK・3-Bed は 3LDK',
    scope_en: 'Market rent in Chuo ward, Niigata (LIFULL HOME’S’s own figure from listed properties; excludes management fees and parking; not agreed rents). Studio = 1K, 1-Bed = 1LDK, 2-Bed = 2LDK, 3-Bed = 3LDK' },
  sapporo: { h: 'dec0087a282c5553', ja: '札幌市東区', en: 'Higashi, Sapporo', iata: 'OKD', airport: '札幌丘珠空港', airport_en: 'Sapporo Okadama Airport',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month', measure_en: 'Market rent', site_en: 'LIFULL HOME’S',
    scope: '札幌市東区の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK・3-Bed は 3LDK',
    scope_en: 'Market rent in Higashi ward, Sapporo (LIFULL HOME’S’s own figure from listed properties; excludes management fees and parking; not agreed rents). Studio = 1K, 1-Bed = 1LDK, 2-Bed = 2LDK, 3-Bed = 3LDK' },
  amakusa: { h: '02ffea6efac5f756', ja: '天草', en: 'Amakusa', iata: 'AXJ', airport: '天草空港', airport_en: 'Amakusa Airport' },
  /* 全社へ広げる e（2026-10-22）：d2 の会社の拠点の街（台帳の家賃・移動の行が在る街だけ。1つの街に1つの空港・1つの資料）。
     空港は、その街に台帳の行で結ばれた会社の拠点の空港（台帳の拠点の行）。同じ街に拠点の空港が2つある会社では、家賃の行を持つ会社の拠点の空港
     （ダラス ＝ DFW：家賃の行はフロンティア航空の行。サウスウエスト航空の DAL には、この街の欄は出ない）。
     書かなかった街：オスロ（家賃の行の使い方が「募集」）・コペンハーゲン（家賃の行が物件1つの募集の例）・ティラナ（家賃の通貨 ALL の換算の
     レートがサイトに無い）・デュッセルドルフとサンフアン（家賃の行が無く、移動の行も拠点の空港が決まらない ＝ 出せる行が無い）。 */
  london: { h: '1a0c8c10427e2f8e', ja: 'ロンドン・ヒリンドン区', en: 'Hillingdon, London', iata: 'LHR', airport: 'ヒースロー空港', airport_en: 'Heathrow Airport',
    measure: '民間賃貸の平均家賃', site: '英国統計局（ONS）', per: 'month', measure_en: 'Average private rent', site_en: 'Office for National Statistics (ONS)',
    scope: 'ロンドンの行政区ヒリンドン（Hillingdon）の民間賃貸の平均の月額（英国統計局の Price Index of Private Rents）。ロンドンぜんたいの平均ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly private rent in the London borough of Hillingdon (ONS Price Index of Private Rents). Not an average for all of London. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  luton: { h: '721c0ffb00429a1d', ja: 'ルートン', en: 'Luton', iata: 'LTN', airport: 'ルートン空港', airport_en: 'London Luton Airport',
    measure: '民間賃貸の平均家賃', site: '英国統計局（ONS）', per: 'month', measure_en: 'Average private rent', site_en: 'Office for National Statistics (ONS)',
    scope: 'ルートン（Luton）の行政区域の民間賃貸の平均の月額（英国統計局の Price Index of Private Rents）。空港のまわりの地区の値ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly private rent in the Luton local authority area (ONS Price Index of Private Rents). Not a figure for the area around the airport. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  manchester: { h: '105e4b691749d3e5', ja: 'マンチェスター', en: 'Manchester', iata: 'MAN', airport: 'マンチェスター空港', airport_en: 'Manchester Airport',
    measure: '民間賃貸の平均家賃', site: '英国統計局（ONS）', per: 'month', measure_en: 'Average private rent', site_en: 'Office for National Statistics (ONS)',
    scope: 'マンチェスター（Manchester）の行政区域の民間賃貸の平均の月額（英国統計局の Price Index of Private Rents）。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly private rent in the Manchester local authority area (ONS Price Index of Private Rents). 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  vienna: { h: '7b4ca0f6ef98d4ab', ja: 'ウィーン', en: 'Vienna', iata: 'VIE', airport: 'ウィーン国際空港', airport_en: 'Vienna International Airport',
    measure: '不動産会社の調べの平均家賃', site: 'ISRP/OECD・ユーロスタット', per: 'month', measure_en: 'Average rent from an estate-agency survey', site_en: 'ISRP/OECD and Eurostat',
    scope: 'ウィーンの選ばれた住宅地区の、家具なしのアパート（質の良いもの。豪華な物件は除く）の平均の月額（国際機関の職員の生計費をくらべるための2025年の不動産会社の調べ。光熱費・管理費は含まない）。街ぜんたいの平均ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly rent of unfurnished flats (good quality; luxury excluded) in selected residential districts of Vienna, from the 2025 estate-agency survey used to compare living costs for international civil servants (excludes utilities and service charges). Not a city-wide average. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  berlin: { h: 'f42bf17d47698559', ja: 'ベルリン', en: 'Berlin', iata: 'BER', airport: 'ベルリン・ブランデンブルク空港', airport_en: 'Berlin Brandenburg Airport',
    measure: '不動産会社の調べの平均家賃', site: 'ISRP/OECD・ユーロスタット', per: 'month', measure_en: 'Average rent from an estate-agency survey', site_en: 'ISRP/OECD and Eurostat',
    scope: 'ベルリンの選ばれた住宅地区の、家具なしのアパート（質の良いもの。豪華な物件は除く）の平均の月額（国際機関の職員の生計費をくらべるための2025年の不動産会社の調べ。光熱費・管理費は含まない）。街ぜんたいの平均ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly rent of unfurnished flats (good quality; luxury excluded) in selected residential districts of Berlin, from the 2025 estate-agency survey used to compare living costs for international civil servants (excludes utilities and service charges). Not a city-wide average. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  paris: { h: '38bd4e947404fcc1', ja: 'パリ', en: 'Paris', iata: 'CDG', airport: 'シャルル・ド・ゴール空港', airport_en: 'Paris Charles de Gaulle Airport',
    measure: '不動産会社の調べの平均家賃', site: 'ISRP/OECD・ユーロスタット', per: 'month', measure_en: 'Average rent from an estate-agency survey', site_en: 'ISRP/OECD and Eurostat',
    scope: 'パリの選ばれた住宅地区の、家具なしのアパート（質の良いもの。豪華な物件は除く）の平均の月額（国際機関の職員の生計費をくらべるための2025年の不動産会社の調べ。光熱費・管理費は含まない）。街ぜんたいの平均ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly rent of unfurnished flats (good quality; luxury excluded) in selected residential districts of Paris, from the 2025 estate-agency survey used to compare living costs for international civil servants (excludes utilities and service charges). Not a city-wide average. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  rome: { h: 'a06647bbe19925f2', ja: 'ローマ', en: 'Rome', iata: 'FCO', airport: 'フィウミチーノ空港', airport_en: 'Rome Fiumicino Airport',
    measure: '不動産会社の調べの平均家賃', site: 'ISRP/OECD・ユーロスタット', per: 'month', measure_en: 'Average rent from an estate-agency survey', site_en: 'ISRP/OECD and Eurostat',
    scope: 'ローマの選ばれた住宅地区の、家具なしのアパート（質の良いもの。豪華な物件は除く）の平均の月額（国際機関の職員の生計費をくらべるための2025年の不動産会社の調べ。光熱費・管理費は含まない）。街ぜんたいの平均ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly rent of unfurnished flats (good quality; luxury excluded) in selected residential districts of Rome, from the 2025 estate-agency survey used to compare living costs for international civil servants (excludes utilities and service charges). Not a city-wide average. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  geneva: { h: '4d9cdb4da23d5a8c', ja: 'ジュネーブ', en: 'Geneva', iata: 'GVA', airport: 'ジュネーブ空港', airport_en: 'Geneva Airport',
    measure: '不動産会社の調べの平均家賃', site: 'ISRP/OECD・ユーロスタット', per: 'month', measure_en: 'Average rent from an estate-agency survey', site_en: 'ISRP/OECD and Eurostat',
    scope: 'ジュネーブの選ばれた住宅地区の、家具なしのアパート（質の良いもの。豪華な物件は除く）の平均の月額（国際機関の職員の生計費をくらべるための2025年の不動産会社の調べ。光熱費・管理費は含まない）。街ぜんたいの平均ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly rent of unfurnished flats (good quality; luxury excluded) in selected residential districts of Geneva, from the 2025 estate-agency survey used to compare living costs for international civil servants (excludes utilities and service charges). Not a city-wide average. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  barcelona: { h: '127c825b2f654520', ja: 'バルセロナ', en: 'Barcelona', iata: 'BCN', airport: 'バルセロナ・エル・プラット空港', airport_en: 'Barcelona–El Prat Airport',
    measure: '家具つきの募集家賃の中央値', site: 'HousingAnywhere', per: 'month', measure_en: 'Median asking rent (furnished)', site_en: 'HousingAnywhere',
    scope: 'バルセロナで HousingAnywhere（中期の賃貸の掲載サイト）に載った、家具つきのワンルーム（Studio）の募集家賃の中央値（2026年第3四半期の家賃の指数）。学生などの中期の賃貸が中心で、成約した家賃ではない',
    scope_en: 'Median asking rent of furnished studios listed on HousingAnywhere (a mid-term rental platform) in Barcelona (Q3 2026 rent index). Mostly mid-term lets (for example, students); not agreed rents' },
  milan: { h: '1cdb0c82997ba6ed', ja: 'ミラノ', en: 'Milan', iata: 'MXP', airport: 'ミラノ・マルペンサ空港', airport_en: 'Milan Malpensa Airport',
    measure: '家具つきの募集家賃の中央値', site: 'HousingAnywhere', per: 'month', measure_en: 'Median asking rent (furnished)', site_en: 'HousingAnywhere',
    scope: 'ミラノで HousingAnywhere（中期の賃貸の掲載サイト）に載った、家具つきのワンルーム（Studio）の募集家賃の中央値（2026年第3四半期の家賃の指数）。学生などの中期の賃貸が中心で、成約した家賃ではない',
    scope_en: 'Median asking rent of furnished studios listed on HousingAnywhere (a mid-term rental platform) in Milan (Q3 2026 rent index). Mostly mid-term lets (for example, students); not agreed rents' },
  hamburg: { h: 'c1a23e717b2170d7', ja: 'ハンブルク', en: 'Hamburg', iata: 'HAM', airport: 'ハンブルク空港', airport_en: 'Hamburg Airport',
    measure: '平均家賃（生活費の案内）', site: 'HousingAnywhere', per: 'month', measure_en: 'Average rent (cost-of-living guide)', site_en: 'HousingAnywhere',
    scope: 'HousingAnywhere の生活費の案内（2026年）に載った、ハンブルクのワンルーム（Studio）の平均の月額。集計の期間・件数は書かれていない。成約した家賃ではない',
    scope_en: 'Average monthly rent of a studio in Hamburg from HousingAnywhere’s cost-of-living guide (2026). The period and number of listings are not stated; not agreed rents' },
  lisboa: { h: 'bad47c11babcf6f4', ja: 'リスボン', en: 'Lisbon', iata: 'LIS', airport: 'リスボン空港', airport_en: 'Lisbon Airport',
    measure: '長期賃貸の募集家賃の中央値', site: 'idealista', per: 'month', measure_en: 'Median asking rent (long-term lets)', site_en: 'idealista',
    scope: 'リスボン市で idealista（不動産の掲載サイト）に載った、寝室1つ（T1）の長期賃貸の募集家賃の中央値。成約した家賃ではない。1-Bed は寝室の数',
    scope_en: 'Median asking rent of one-bedroom (T1) long-term lets listed on idealista (a property portal) in the city of Lisbon. Not agreed rents. 1-Bed is the number of bedrooms' },
  porto: { h: '823a94b0f0c9dfb6', ja: 'ポルト', en: 'Porto', iata: 'OPO', airport: 'ポルト空港', airport_en: 'Porto Airport',
    measure: '長期賃貸の募集家賃の中央値', site: 'idealista', per: 'month', measure_en: 'Median asking rent (long-term lets)', site_en: 'idealista',
    scope: 'ポルト市で idealista（不動産の掲載サイト）に載った、寝室1つ（T1）の長期賃貸の募集家賃の中央値。成約した家賃ではない。1-Bed は寝室の数',
    scope_en: 'Median asking rent of one-bedroom (T1) long-term lets listed on idealista (a property portal) in the city of Porto. Not agreed rents. 1-Bed is the number of bedrooms' },
  cologne: { h: '95c685aa66315183', ja: 'ケルン', en: 'Cologne', iata: 'CGN', airport: 'ケルン・ボン空港', airport_en: 'Cologne Bonn Airport' },
  stockholm: { h: '698d8ca8be3003f2', ja: 'ストックホルム', en: 'Stockholm', iata: 'ARN', airport: 'ストックホルム・アーランダ空港', airport_en: 'Stockholm Arlanda Airport' },
  bergen: { h: '7dddf60ca8b5c79c', ja: 'ベルゲン', en: 'Bergen', iata: 'BGO', airport: 'ベルゲン空港', airport_en: 'Bergen Airport' },
  atlanta: { h: '49b7de1ccf1d3c18', ja: 'アトランタ', en: 'Atlanta', iata: 'ATL', airport: 'アトランタ空港', airport_en: 'Atlanta airport',
    measure: '集合住宅の平均家賃', site: 'RentCafe（Yardi Matrix）', per: 'month', measure_en: 'Average apartment rent', site_en: 'RentCafe (Yardi Matrix)',
    scope: 'アトランタの50戸以上の集合住宅の、間取りごとの平均の家賃（RentCafe・Yardi Matrix の表。2026年9月30日の表示）。小さな物件を含む住宅ぜんたいの値ではない・成約した家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type in apartment buildings of 50 or more units in Atlanta (RentCafe / Yardi Matrix table, as shown on 30 September 2026). Not a figure for all housing including small buildings; not agreed rents. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  austin: { h: 'd95000eef201b307', ja: 'オースティン', en: 'Austin', iata: 'AUS', airport: 'オースティン空港', airport_en: 'Austin airport',
    measure: '集合住宅の平均家賃', site: 'RentCafe（Yardi Matrix）', per: 'month', measure_en: 'Average apartment rent', site_en: 'RentCafe (Yardi Matrix)',
    scope: 'オースティンの50戸以上の集合住宅の、間取りごとの平均の家賃（RentCafe・Yardi Matrix の表。2026年9月30日の表示）。小さな物件を含む住宅ぜんたいの値ではない・成約した家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type in apartment buildings of 50 or more units in Austin (RentCafe / Yardi Matrix table, as shown on 30 September 2026). Not a figure for all housing including small buildings; not agreed rents. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  dallas: { h: 'd2e23efaecb44d49', ja: 'ダラス', en: 'Dallas', iata: 'DFW', airport: 'ダラス・フォートワース空港', airport_en: 'Dallas Fort Worth International Airport',
    measure: '集合住宅の平均家賃', site: 'RentCafe（Yardi Matrix）', per: 'month', measure_en: 'Average apartment rent', site_en: 'RentCafe (Yardi Matrix)',
    scope: 'ダラスの50戸以上の集合住宅の、間取りごとの平均の家賃（RentCafe・Yardi Matrix の表。2026年9月30日の表示）。小さな物件を含む住宅ぜんたいの値ではない・成約した家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type in apartment buildings of 50 or more units in Dallas (RentCafe / Yardi Matrix table, as shown on 30 September 2026). Not a figure for all housing including small buildings; not agreed rents. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  denver: { h: '907f7bd424e91784', ja: 'デンバー', en: 'Denver', iata: 'DEN', airport: 'デンバー国際空港', airport_en: 'Denver International Airport',
    measure: '集合住宅の平均家賃', site: 'RentCafe（Yardi Matrix）', per: 'month', measure_en: 'Average apartment rent', site_en: 'RentCafe (Yardi Matrix)',
    scope: 'デンバーの50戸以上の集合住宅の、間取りごとの平均の家賃（RentCafe・Yardi Matrix の表。2026年9月30日の表示）。小さな物件を含む住宅ぜんたいの値ではない・成約した家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type in apartment buildings of 50 or more units in Denver (RentCafe / Yardi Matrix table, as shown on 30 September 2026). Not a figure for all housing including small buildings; not agreed rents. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  'las-vegas': { h: '1318ebd43467c300', ja: 'ラスベガス', en: 'Las Vegas', iata: 'LAS', airport: 'ハリー・リード国際空港', airport_en: 'Harry Reid International Airport',
    measure: '集合住宅の平均家賃', site: 'RentCafe（Yardi Matrix）', per: 'month', measure_en: 'Average apartment rent', site_en: 'RentCafe (Yardi Matrix)',
    scope: 'ラスベガスの50戸以上の集合住宅の、間取りごとの平均の家賃（RentCafe・Yardi Matrix の表。2026年9月30日の表示）。小さな物件を含む住宅ぜんたいの値ではない・成約した家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type in apartment buildings of 50 or more units in Las Vegas (RentCafe / Yardi Matrix table, as shown on 30 September 2026). Not a figure for all housing including small buildings; not agreed rents. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  chicago: { h: '8dc0be7a20ec9864', ja: 'シカゴ', en: 'Chicago', iata: 'MDW', airport: 'シカゴ・ミッドウェー空港', airport_en: 'Chicago Midway International Airport',
    measure: '集合住宅の平均家賃', site: 'RentCafe（Yardi Matrix）', per: 'month', measure_en: 'Average apartment rent', site_en: 'RentCafe (Yardi Matrix)',
    scope: 'シカゴの50戸以上の集合住宅の、間取りごとの平均の家賃（RentCafe・Yardi Matrix の表。2026年9月30日の表示）。小さな物件を含む住宅ぜんたいの値ではない・成約した家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type in apartment buildings of 50 or more units in Chicago (RentCafe / Yardi Matrix table, as shown on 30 September 2026). Not a figure for all housing including small buildings; not agreed rents. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  orlando: { h: '3752f9c3a7c49546', ja: 'オーランド', en: 'Orlando', iata: 'MCO', airport: 'オーランド国際空港', airport_en: 'Orlando International Airport',
    measure: '集合住宅の平均家賃', site: 'RentCafe（Yardi Matrix）', per: 'month', measure_en: 'Average apartment rent', site_en: 'RentCafe (Yardi Matrix)',
    scope: 'オーランドの50戸以上の集合住宅の、間取りごとの平均の家賃（RentCafe・Yardi Matrix の表。2026年9月30日の表示）。小さな物件を含む住宅ぜんたいの値ではない・成約した家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type in apartment buildings of 50 or more units in Orlando (RentCafe / Yardi Matrix table, as shown on 30 September 2026). Not a figure for all housing including small buildings; not agreed rents. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  nashville: { h: '2bc48cee55cb0963', ja: 'ナッシュビル', en: 'Nashville', iata: 'BNA', airport: 'ナッシュビル国際空港', airport_en: 'Nashville International Airport',
    measure: '募集家賃の平均', site: 'Zumper', per: 'month', measure_en: 'Average asking rent', site_en: 'Zumper',
    scope: 'ナッシュビルで Zumper（賃貸の掲載サイト）に過去30日に載った物件の、間取りごとの平均の家賃（2026年10月19日の表示）。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type of listings on Zumper (a rental listings site) in the past 30 days in Nashville (as shown on 19 October 2026). Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  baltimore: { h: '564ac8b5093eea6a', ja: 'ボルチモア', en: 'Baltimore', iata: 'BWI', airport: 'ボルチモア・ワシントン国際空港', airport_en: 'Baltimore/Washington International Airport',
    measure: '募集家賃の平均', site: 'Zumper', per: 'month', measure_en: 'Average asking rent', site_en: 'Zumper',
    scope: 'ボルチモアで Zumper（賃貸の掲載サイト）に過去30日に載った物件の、間取りごとの平均の家賃（2026年10月19日の表示）。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type of listings on Zumper (a rental listings site) in the past 30 days in Baltimore (as shown on 19 October 2026). Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  houston: { h: 'e80203e4e8c9a9e3', ja: 'ヒューストン', en: 'Houston', iata: 'HOU', airport: 'ヒューストン・ホビー空港', airport_en: 'Houston Hobby Airport',
    measure: '募集家賃の平均', site: 'Zumper', per: 'month', measure_en: 'Average asking rent', site_en: 'Zumper',
    scope: 'ヒューストンで Zumper（賃貸の掲載サイト）に過去30日に載った物件の、間取りごとの平均の家賃（2026年10月19日の表示）。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type of listings on Zumper (a rental listings site) in the past 30 days in Houston (as shown on 19 October 2026). Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  'los-angeles': { h: 'aa91c9bfedf1119a', ja: 'ロサンゼルス', en: 'Los Angeles', iata: 'LAX', airport: 'ロサンゼルス国際空港', airport_en: 'Los Angeles International Airport',
    measure: '募集家賃の平均', site: 'Zumper', per: 'month', measure_en: 'Average asking rent', site_en: 'Zumper',
    scope: 'ロサンゼルスで Zumper（賃貸の掲載サイト）に過去30日に載った物件の、間取りごとの平均の家賃（2026年10月19日の表示）。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type of listings on Zumper (a rental listings site) in the past 30 days in Los Angeles (as shown on 19 October 2026). Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  oakland: { h: 'c2d84102dd273ac1', ja: 'オークランド（カリフォルニア州）', en: 'Oakland, California', iata: 'OAK', airport: 'オークランド国際空港', airport_en: 'Oakland International Airport',
    measure: '募集家賃の平均', site: 'Zumper', per: 'month', measure_en: 'Average asking rent', site_en: 'Zumper',
    scope: 'オークランド（カリフォルニア州）で Zumper（賃貸の掲載サイト）に過去30日に載った物件の、間取りごとの平均の家賃（2026年10月19日の表示）。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type of listings on Zumper (a rental listings site) in the past 30 days in Oakland, California (as shown on 19 October 2026). Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  phoenix: { h: 'e54367431213175e', ja: 'フェニックス', en: 'Phoenix', iata: 'PHX', airport: 'フェニックス・スカイハーバー国際空港', airport_en: 'Phoenix Sky Harbor International Airport',
    measure: '募集家賃の平均', site: 'Zumper', per: 'month', measure_en: 'Average asking rent', site_en: 'Zumper',
    scope: 'フェニックスで Zumper（賃貸の掲載サイト）に過去30日に載った物件の、間取りごとの平均の家賃（2026年10月19日の表示）。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type of listings on Zumper (a rental listings site) in the past 30 days in Phoenix (as shown on 19 October 2026). Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  cleveland: { h: '0418a7090af93c69', ja: 'クリーブランド', en: 'Cleveland', iata: 'CLE', airport: 'クリーブランド空港', airport_en: 'Cleveland Hopkins International Airport',
    measure: '募集家賃の平均', site: 'Zumper', per: 'month', measure_en: 'Average asking rent', site_en: 'Zumper',
    scope: 'クリーブランドで Zumper（賃貸の掲載サイト）に過去30日に載った物件の、間取りごとの平均の家賃（2026年10月19日の表示）。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type of listings on Zumper (a rental listings site) in the past 30 days in Cleveland (as shown on 19 October 2026). Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  cincinnati: { h: 'c19fcc031f260127', ja: 'シンシナティ', en: 'Cincinnati', iata: 'CVG', airport: 'シンシナティ・ノーザンケンタッキー空港', airport_en: 'Cincinnati/Northern Kentucky International Airport',
    measure: '募集家賃の平均', site: 'Zumper', per: 'month', measure_en: 'Average asking rent', site_en: 'Zumper',
    scope: 'シンシナティで Zumper（賃貸の掲載サイト）に過去30日に載った物件の、間取りごとの平均の家賃（2026年10月19日の表示）。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type of listings on Zumper (a rental listings site) in the past 30 days in Cincinnati (as shown on 19 October 2026). Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  boston: { h: 'f55f8701c857deed', ja: 'ボストン', en: 'Boston', iata: 'BOS', airport: 'ボストン・ローガン国際空港', airport_en: 'Boston Logan International Airport',
    measure: '募集家賃の平均', site: 'Zumper', per: 'month', measure_en: 'Average asking rent', site_en: 'Zumper',
    scope: 'ボストンで Zumper（賃貸の掲載サイト）に過去30日に載った物件の、間取りごとの平均の家賃（2026年10月19日の表示）。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type of listings on Zumper (a rental listings site) in the past 30 days in Boston (as shown on 19 October 2026). Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  'fort-lauderdale': { h: '0b953500732c90ea', ja: 'フォートローダーデール', en: 'Fort Lauderdale', iata: 'FLL', airport: 'フォートローダーデール空港', airport_en: 'Fort Lauderdale-Hollywood International Airport',
    measure: '募集家賃の平均', site: 'Zumper', per: 'month', measure_en: 'Average asking rent', site_en: 'Zumper',
    scope: 'フォートローダーデールで Zumper（賃貸の掲載サイト）に過去30日に載った物件の、間取りごとの平均の家賃（2026年10月19日の表示）。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type of listings on Zumper (a rental listings site) in the past 30 days in Fort Lauderdale (as shown on 19 October 2026). Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  'new-york': { h: 'ded636f5cf9c06d8', ja: 'ニューヨーク', en: 'New York', iata: 'JFK', airport: 'ジョン・F・ケネディ国際空港', airport_en: 'John F. Kennedy International Airport',
    measure: '募集家賃の平均', site: 'Zumper', per: 'month', measure_en: 'Average asking rent', site_en: 'Zumper',
    scope: 'ニューヨークで Zumper（賃貸の掲載サイト）に過去30日に載った物件の、間取りごとの平均の家賃（2026年10月19日の表示）。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type of listings on Zumper (a rental listings site) in the past 30 days in New York (as shown on 19 October 2026). Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  toronto: { h: '607c7cc9ea240ff7', ja: 'トロント', en: 'Toronto', iata: 'YYZ', airport: 'トロント・ピアソン国際空港', airport_en: 'Toronto Pearson International Airport',
    measure: '募集家賃の平均', site: 'Zumper', per: 'month', measure_en: 'Average asking rent', site_en: 'Zumper',
    scope: 'トロントで Zumper（賃貸の掲載サイト）に過去30日に載った物件の、間取りごとの平均の家賃（2026年10月19日の表示）。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type of listings on Zumper (a rental listings site) in the past 30 days in Toronto (as shown on 19 October 2026). Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  perth: { h: 'a344d124e17f8857', ja: 'パース', en: 'Perth', iata: 'PER', airport: 'パース空港', airport_en: 'Perth Airport',
    measure: 'ユニットの家賃の中央値', site: '西オーストラリア州不動産協会（REIWA）', per: 'week', measure_en: 'Median unit rent', site_en: 'Real Estate Institute of Western Australia (REIWA)',
    scope: 'パース都市圏（Perth Metro）のユニット（集合住宅）の、寝室の数ごとの週の家賃の中央値（3か月の移動の集計）。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Median weekly rent of units (apartments) in Perth Metro by number of bedrooms (rolling three-month figures). 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
});

/** 行の並びの指紋（ID と h。並びに依らない）。NET・CITY の h はこれ。 */
export const digest = rows => crypto.createHash('sha256').update(rows.map(r => `${r.id}:${r.h}`).sort().join('\n')).digest('hex').slice(0, 16);

/** 資料の名前。無ければ台帳の 発行元「題」（引用として）。lang 'en' は英語の名前（無ければ 発行元 “題” ── 資料の言葉のまま）。 */
export function srcName(s, lang = 'ja') {
  if (lang === 'en') {
    if (s && AGREEMENTS[s.source_id]) return AGREEMENTS[s.source_id].name_en || '';
    if (s && SOURCES[s.source_id]) return SOURCES_EN[s.source_id] || '';
    if (s && SOURCE_URL[s.url]) return SOURCE_URL_EN[s.url] || '';
    const pub = s ? publisherEn(s.publisher) : '';
    return s && pub && s.title ? `${pub} “${s.title}”` : pub;
  }
  if (s && AGREEMENTS[s.source_id]) return AGREEMENTS[s.source_id].name;
  if (s && SOURCES[s.source_id]) return SOURCES[s.source_id];
  if (s && SOURCE_URL[s.url]) return SOURCE_URL[s.url];
  return s && s.title ? `${s.publisher}「${s.title}」` : (s && s.publisher) || '';
}

/** その行の LINES が古いか（無ければ false）。 */
export const stale = r => !!(LINES[r.id] && LINES[r.id].h !== r.h);

/* ── 国と街（say: 'country' / 'city'）── 値をサイトの表に当て、表の字を返す。当たらない・2通りに読めるときは ''（言わない）。
   調べた側の書き方（「CANADA」「México」「Taipei City」「Denver, Colorado」）はここで表の字に置き換わり、そのまま画面に出ることはない。 */
const fold = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const toks = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
/** 国の名前（COUNTRIES の ja）。英語の名前・日本語の名前・2字の国コード・「the …」の書き方に当てる。 */
export function countryJa(v) {
  if (typeof v !== 'string' || !v.trim()) return '';
  const f = fold(v.trim().replace(/^the\s+/i, ''));
  const hit = COUNTRIES.filter(c => [c.en, c.ja, c.code, c.enIn, c.enFull].filter(Boolean).some(n => fold(String(n).replace(/^the\s+/i, '')) === f));
  return hit.length === 1 ? hit[0].ja : '';
}
/** 国の英語の名前（COUNTRIES の en）。countryJa と同じ当て方 */
export function countryEn(v) { const ja = countryJa(v); const c = ja && COUNTRIES.find(x => x.ja === ja); return c ? c.en : ''; }
/* 街の名前の表：PLACES の都市の字（「東京（羽田）」→「東京」）と、その英語の名前の語の並び。 */
let CITY_WORDS = null;
const cityWords = () => (CITY_WORDS ??= Object.values(PLACES).map(([ja, en]) => ({ ja: ja.replace(/（.*$/, ''), en: toks(en) })));
function cityHits(t) {
  const ja = t.replace(/[都府県市]$/, ''), w = toks(t);
  return new Set(cityWords().filter(c => c.ja === t || c.ja === ja || (w.length && w.every((x, i) => c.en[i] === x))).map(c => c.ja));
}
/** 街の名前（PLACES の都市の字）。まるごと → かっこを外して → 「 / 」とカンマで分けた1つずつの順に当て、最初に当たったもの。
    1つに決まらなければ ''。「… City」は、まるごとで当たらないときだけ外して見る（Taipei City → 台北・Mexico City はそのまま）。 */
export function cityJa(v) {
  if (typeof v !== 'string' || !v.trim()) return '';
  const tries = [];
  const add = s => { s = String(s || '').trim(); if (s && !tries.includes(s)) tries.push(s); };
  const bare = v.replace(/[（(][^）)]*[）)]/g, '').trim();
  add(v); add(bare);
  for (const part of bare.split(/\s*\/\s*/)) { add(part); for (const c of part.split(',')) add(c); }
  for (const t of tries) for (const x of [t, /\sCity$/i.test(t) ? t.replace(/\s+City$/i, '') : null].filter(Boolean)) {
    const hit = cityHits(x);
    if (hit.size === 1) return [...hit][0];
    if (hit.size > 1) return '';
  }
  return '';
}

/** 街の英語の名前（cityJa が決めた街の、空港の呼び名の表の英語の名前。2通りの英語に分かれる街は言わない） */
export function cityEn(v) {
  const ja = cityJa(v);
  if (!ja) return '';
  const en = new Set(Object.values(PLACES).filter(p => String(p[0]).replace(/（.*$/, '') === ja).map(p => String(p[1])));
  return en.size === 1 ? [...en][0] : '';
}

/* ── 日本の会社の本社の街（2026-10-21 d1「本社 日本」より、台帳に在れば本社の街）──
   日本の会社の本社の国の行は、会社概要の所在地の字（台帳の引用 evidence.quote）を持っている。その字の頭の
   「都道府県＋市区町村」だけを読む（「千葉県成田市…」→「千葉県成田市」・「札幌市東区…」→「札幌市」）。所在地の字として読めなければ
   今までどおり国（「本社 日本」）。番地・建物の名前は出さない。 */
/* 市を先に見る（「大村市」「町田市」の字の中の村・町を、町村の終わりと読まない）。市が無ければ東京の区。町・村だけの所在地は読まない */
const JP_PREF = '(東京都|北海道|京都府|大阪府|[一-龥]{2,3}県)';
const JP_ADDR = [new RegExp(`^${JP_PREF}?([一-龥ぁ-んァ-ヶ]{1,5}?市)`), new RegExp(`^(東京都)([一-龥ぁ-んァ-ヶ]{1,4}?区)`)];
export function jpCityOf(r) {
  for (const e of r.evidence || []) {
    const q = String(e.quote || '').replace(/[\s　]+/g, '');
    for (const re of JP_ADDR) { const m = re.exec(q); if (m) return `${m[1] || ''}${m[2]}`; }
  }
  return '';
}
/* ── その本社の街の英語（2026-10-23 英語の EN-8・リード「スカイマークの英語の本社が Japan ── 日本語と同じ所（Ota City, Tokyo）を」）──
   jpCityOf が読んだ「都道府県＋市区」を、それぞれ下の表の英語にする（東京の区は「Ota City, Tokyo」・ほかは「Narita, Chiba」・
   都道府県の無い所在地は街だけ「Sapporo」）。市区が表に無いときは、都道府県まで（「Osaka Prefecture」── 違う街を言わない・国より細かく）。
   都道府県も街も言えなければ ''（英語では言わない ── 国の「Japan」にすり替えない）。
   ★表に足すのは、台帳の日本の会社の本社の街だけ（assert-rollout.mjs が、日本語のページの本社の街と英語のページの本社を並べて見る）。 */
const JP_PREF_EN = Object.freeze({
  東京都: 'Tokyo', 北海道: 'Hokkaido', 大阪府: 'Osaka', 千葉県: 'Chiba', 宮崎県: 'Miyazaki', 福岡県: 'Fukuoka', 静岡県: 'Shizuoka',
  熊本県: 'Kumamoto', 鹿児島県: 'Kagoshima', 長崎県: 'Nagasaki', 沖縄県: 'Okinawa', 新潟県: 'Niigata',
});
const JP_MUNI_EN = Object.freeze({
  大田区: 'Ota City', 江東区: 'Koto City', 成田市: 'Narita', 泉佐野市: 'Izumisano', 豊中市: 'Toyonaka', 宮崎市: 'Miyazaki',
  札幌市: 'Sapporo', 北九州市: 'Kitakyushu', 静岡市: 'Shizuoka', 天草市: 'Amakusa', 霧島市: 'Kirishima', 那覇市: 'Naha', 大村市: 'Omura',
  新潟市: 'Niigata',
});
/** 日本の所在地の字（jpCityOf の答え「東京都大田区」「札幌市」）の英語。市区が表に無ければ都道府県まで・それも言えなければ '' */
export function jpPlaceEn(ja) {
  for (const re of JP_ADDR) {
    const m = re.exec(String(ja || ''));
    if (!m || `${m[1] || ''}${m[2]}` !== ja) continue;
    const c = JP_MUNI_EN[m[2]], p = m[1] ? JP_PREF_EN[m[1]] : '';
    if (m[1] && !p) return '';
    if (c) return p ? `${c}, ${p}` : c;
    return p ? (/^(?:東京都|北海道)$/.test(m[1]) ? p : `${p} Prefecture`) : '';
  }
  return '';
}

/* ITEM の言い方で値を作る（言えなければ ''）。 */
function itemValue(r) {
  const it = ITEM[r.key];
  if (!it) return '';
  if (r.key === 'headquarters_country' && countryJa(r.value) === '日本') return jpCityOf(r) || '日本';
  if (it.say === 'iata') return typeof r.value === 'string' && /^[A-Z]{3}$/.test(r.value) ? r.value : '';
  if (it.say === 'date') return typeof r.value === 'string' ? dateJa(r.value) : '';
  if (it.say === 'country') return countryJa(r.value);
  if (it.say === 'city') return cityJa(r.value);
  if (it.per && !perOf(r)) return '';
  if (typeof r.value !== 'number' || !(r.value > 0)) return '';
  if (it.say === 'money') return r.currency && !r.unit && PER[r.per] ? { per: PER[r.per], cur: r.currency, n: r.value } : '';
  if (r.currency) return '';
  const u = r.unit ? UNIT[r.unit] : '';
  if (r.unit && !u) return '';
  if (!u) return '';
  const head = it.say === 'count' && u === '機' ? '' : perOf(r);
  return `${head}${r.value.toLocaleString('en-US')}${u}`;
}

/* ITEM の言い方の英語（言えなければ ''）。決まりは itemValue と同じ
   （日本の会社の本社の街は、日本語と同じ街を英語で ── jpPlaceEn。2026-10-23 EN-8 まで「Japan」だった。街の無い所在地は今までどおり国） */
function itemValueEn(r) {
  const it = ITEM[r.key];
  if (!it) return '';
  if (r.key === 'headquarters_country' && countryJa(r.value) === '日本') { const c = jpCityOf(r); return c ? jpPlaceEn(c) : countryEn(r.value); }
  if (it.say === 'iata') return typeof r.value === 'string' && /^[A-Z]{3}$/.test(r.value) ? r.value : '';
  if (it.say === 'date') return typeof r.value === 'string' ? dateEn(r.value) : '';
  if (it.say === 'country') return countryEn(r.value);
  if (it.say === 'city') return cityEn(r.value);
  if (it.per && !perOf(r)) return '';
  if (typeof r.value !== 'number' || !(r.value > 0)) return '';
  if (it.say === 'money') return r.currency && !r.unit && PER[r.per] ? { per: r.per, cur: r.currency, n: r.value } : '';
  if (r.currency) return '';
  const u = r.unit ? UNIT_EN[r.unit] : null;
  if (!u) return '';
  const per = it.say === 'count' && u[0] === 'aircraft' ? '' : PER_EN[perOf(r)] || '';
  return `${r.value.toLocaleString('en-US')} ${r.value === 1 ? u[0] : u[1]}${per ? ` a ${per}` : ''}`;
}

/* 行ごとの字（LINES）の money: true（2026-10-22 全社へ広げる e）── 値の欄（数・通貨・年か月の期間）を、そのまま通貨つきの額として言う
   （画面は「年 EUR 8,000」と円の目安。字の中に外貨の額を書かない）。ITEM に置けない項目（年金など）の額のため。
   数・通貨・年か月がそろわない行（期間の無い額・単位つきの数）は言わない。 */
const moneyOf = (r, en = false) => (typeof r.value === 'number' && r.value > 0 && r.currency && !r.unit && PER[r.per]
  ? { per: en ? r.per : PER[r.per], cur: r.currency, n: r.value } : '');

/** 英語の字（say(r, 'en') の中身）。対の無い LINES の行・英語で言えない行は null。形は say と同じ（per は 'year' か 'month'） */
function sayEn(r) {
  const L = LINES[r.id];
  if (L && L.h !== r.h) return null;
  const tag = TAG_EN[r.use] || '';
  if (L) {
    const E = L.en;
    if (!E) return null;
    if (L.fleet) { const ft = E.fleet || fleetEn(L.fleet); return ft ? { fleet: ft, label: ft, value: '', cond: '', tag, lead: false } : null; }
    const v = E.value || (L.value ? '' : L.money ? moneyOf(r, true) : itemValueEn(r));
    if (!E.label || !v || (L.cond && !E.cond)) return null;
    return typeof v === 'object'
      ? { label: E.label, value: v.n, cur: v.cur, per: v.per, cond: E.cond || '', lead: !!L.lead && !tag, tag, mode: L.mode || '' }
      : { label: E.label, value: v, cond: E.cond || '', lead: !!L.lead && !tag, tag, mode: L.mode || '' };
  }
  if (r.domain === 'fleet') { const ft = fleetEn(fleetJa(r)); return ft ? { fleet: ft, label: ft, value: '', cond: '', tag, lead: false } : null; }
  const it = ITEM[r.key], v = itemValueEn(r);
  if (!it || !v) return null;
  const label = it.label_en + (WHOSE_DOMAINS.includes(r.domain) && RANK_EN[rankOf(r)] ? ` (${RANK_EN[rankOf(r)]})` : '');
  return typeof v === 'object'
    ? { label, value: v.n, cur: v.cur, per: v.per, cond: '', lead: false, tag }
    : { label, value: v, cond: '', lead: false, tag };
}

/**
 * 1行を画面の字にする。言えないとき（ITEM にも LINES にも無い・LINES が古い）は null。
 *   lang 'en' … 英語の字（対の無い行は null ── 日本語の字を英語のページに出さない）
 *   { label, value, cur, cond, lead, tag, fleet, mode }
 *   value が通貨つきの額のときは value ＝ 数・cur ＝ 通貨・per ＝ 月か年（画面は「月 ZAR 4,000」と円の目安）。
 */
export function say(r, lang = 'ja') {
  if (lang === 'en') return sayEn(r);
  const L = LINES[r.id];
  if (L && L.h !== r.h) return null;                       // 古い字は出さない（書き直すまで）
  const tag = TAG[r.use] || '';
  if (L) {
    if (L.fleet) return { fleet: L.fleet, label: L.fleet, value: '', cond: '', tag, lead: false };
    const v = L.value || (L.money ? moneyOf(r) : itemValue(r));
    if (!L.label || !v) return null;
    return typeof v === 'object'
      ? { label: L.label, value: v.n, cur: v.cur, per: v.per, cond: L.cond || '', lead: !!L.lead && !tag, tag, mode: L.mode || '' }
      : { label: L.label, value: v, cond: L.cond || '', lead: !!L.lead && !tag, tag, mode: L.mode || '' };
  }
  /* 機材の行（LINES に字が無い行）は、型式の書き方から（fleetJa。読めなければ言わない） */
  if (r.domain === 'fleet') { const ft = fleetJa(r); return ft ? { fleet: ft, label: ft, value: '', cond: '', tag, lead: false } : null; }
  const it = ITEM[r.key], v = itemValue(r);
  if (!it || !v) return null;
  /* 勤務・待遇の行は、誰の条件かを名前の頭に（機長・副操縦士・訓練生。運航乗務員ぜんたいと職位の無い行は付けない） */
  const label = (WHOSE_DOMAINS.includes(r.domain) && RANK_JA[rankOf(r)] ? `${RANK_JA[rankOf(r)]}の` : '') + it.label;
  return typeof v === 'object'
    ? { label, value: v.n, cur: v.cur, per: v.per, cond: '', lead: false, tag }
    : { label, value: v, cond: '', lead: false, tag };
}

/* ここで書く字に入れてはいけない語。「よくある質問」は gen-faq.mjs がページの FAQ を探す目印 ──
   新しい部品の字に在ると、その位置から下の <details> を FAQ と読み、検索向けの FAQPage を作り違える（2026-10-21 に踏んだ）。 */
export const NEVER = Object.freeze(['よくある質問']);
/**
 * 労働協約の登録（AGREEMENTS）が、台帳の資料そのものか（2026-10-22 全社へ広げる e）。[{ what, id, why }]。
 *   ・台帳にその資料の ID を持つ行が在る（無い資料を登録しない）
 *   ・その資料の発行元の種類は政府（government）か組合（union）だけ（会社・その他・掲載サイトの資料を「労働協約」と呼ばない）
 *   ・登録の住所（url）と日付（date）は、台帳のその資料の住所・発行の日と同じ（別の文書を指さない）
 *   ・住所が利用者のアップロードした写しの置き場（import-research-pack.mjs の UPLOAD_HOSTS）でない（P12.90）
 */
export function agreementCheck(store) {
  const bad = [], seen = new Map();
  const visit = r => { for (const s of (r && r.src) || []) if (s && AGREEMENTS[s.source_id]) { if (!seen.has(s.source_id)) seen.set(s.source_id, []); seen.get(s.source_id).push(s); } };
  for (const F of Object.values(store.FACTS || {})) for (const rows of Object.values(F)) (rows || []).forEach(visit);
  for (const S of Object.values(store.SOURCES || {})) (Array.isArray(S) ? S : []).forEach(visit);
  for (const [id, A] of Object.entries(AGREEMENTS)) {
    const list = seen.get(id) || [], no = why => bad.push({ what: 'AGREEMENTS', id, why });
    if (!list.length) { no('台帳にこの資料の行が無い（台帳に無い協約を登録しない）'); continue; }
    for (const k of new Set(list.map(s => s.publisher_kind))) if (!['government', 'union'].includes(k)) no(`発行元が政府でも組合でもない（${k || '無し'}）`);
    for (const u of new Set(list.map(s => s.url))) if (u !== A.url) no(`住所が台帳と違う（登録 ${A.url} ／ 台帳 ${u}）`);
    for (const d of new Set(list.map(s => s.published || null))) if (d !== (A.date ?? null)) no(`日付が台帳と違う（登録 ${A.date} ／ 台帳 ${d}）`);
    let host = '';
    try { host = new URL(A.url).hostname.toLowerCase(); } catch { /* 住所として読めない */ }
    if (!host || UPLOAD_HOSTS.some(h => host === h || host.endsWith(`.${h}`))) no(`利用者がアップロードした写しの置き場か、住所として読めない（${host || A.url}）`);
  }
  return bad;
}

/** 古い字・名前の無い資料（store ＝ 調べの台帳）。[{ what, id, why }]。 */
export function check(store) {
  const bad = [...agreementCheck(store)];
  const words = [...Object.entries(LINES).flatMap(([id, L]) => [L.label, L.value, L.cond, L.fleet].map(t => [id, t])),
    ...Object.entries(SOURCES), ...Object.entries(SOURCE_URL), ...Object.entries(AGREEMENTS).flatMap(([id, A]) => [[id, A.name], [id, A.cond]]), ...Object.entries(NET).map(([id, N]) => [id, N.basis]),
    ...Object.entries(CITY).flatMap(([id, C]) => [C.ja, C.measure, C.site, C.airport, C.scope].map(t => [id, t])), ...Object.entries(ITEM).map(([id, I]) => [id, I.label])];
  for (const [id, t] of words) for (const w of NEVER) if (typeof t === 'string' && t.includes(w)) bad.push({ what: 'NEVER', id, why: `「${w}」を字に入れない（${t}）` });
  /* 英語の対（2026-10-22 d2 ＝ EN-2）：日本語で書いた字には、どれも英語の対が在る。対の字に日本語の字は無い
     （資料自身の題を “ ” の中に置くときだけ、その題の字のまま ── 資料の言葉） */
  const JA = /[ぁ-んァ-ヶ一-龥]/, en = (what, id, t, ja) => {
    if (ja && !(typeof t === 'string' && t.trim())) bad.push({ what: `${what}（英語）`, id, why: `日本語の字「${String(ja).slice(0, 30)}」に英語の対が無い` });
    else if (typeof t === 'string' && JA.test(t.replace(/“[^”]*”/g, ''))) bad.push({ what: `${what}（英語）`, id, why: `英語の対に日本語の字（${t.slice(0, 40)}）` });
  };
  for (const [id, L] of Object.entries(LINES)) {
    const E = L.en || {};
    if (L.fleet) { en('LINES', id, E.fleet, L.fleet); continue; }
    en('LINES', id, E.label, L.label); en('LINES', id, E.value, L.value); en('LINES', id, E.cond, L.cond);
    if (!L.value && E.value) bad.push({ what: 'LINES（英語）', id, why: '日本語に無い値を英語だけに書いている' });
  }
  for (const [k, I] of Object.entries(ITEM)) en('ITEM', k, I.label_en, I.label);
  for (const [k, v] of Object.entries(SOURCES)) en('SOURCES', k, SOURCES_EN[k], v);
  for (const [k, v] of Object.entries(SOURCE_URL)) en('SOURCE_URL', k, SOURCE_URL_EN[k], v);
  for (const [k, A] of Object.entries(AGREEMENTS)) { en('AGREEMENTS', k, A.name_en, A.name); en('AGREEMENTS', k, A.cond_en, A.cond); }
  for (const [k, N] of Object.entries(NET)) en('NET', k, N.basis_en, N.basis);
  for (const [k, C] of Object.entries(CITY)) for (const f of ['airport', 'measure', 'site', 'scope']) en('CITY', `${k}.${f}`, C[`${f}_en`], C[f]);
  for (const [k, v] of Object.entries(TAG)) en('TAG', k, TAG_EN[k], v);
  const byId = new Map();
  for (const F of Object.values(store.FACTS || {})) for (const rows of Object.values(F)) for (const r of rows || []) byId.set(r.id, r);
  for (const N of Object.values(store.NETWORK || {})) for (const r of N.list || []) byId.set(r.id, r);
  for (const L of Object.values(store.LIVING || {})) for (const k of ['rents', 'commute', 'towns']) for (const r of L[k] || []) byId.set(r.id, r);
  for (const [id, L] of Object.entries(LINES)) {
    const r = byId.get(id);
    if (!r) bad.push({ what: 'LINES', id, why: '台帳に無い行' });
    else if (r.h !== L.h) bad.push({ what: 'LINES', id, why: `台帳の行が変わった（${L.h} → ${r.h}）── 字を書き直して h を付け直す` });
    if (L.same && (L.same === id || !byId.has(L.same) || L.same.split('.')[0] !== id.split('.')[0])) bad.push({ what: 'LINES', id, why: `same が同じ会社の台帳のほかの行を名指していない（${L.same}）` });
  }
  for (const [slug, N] of Object.entries(NET)) {
    const list = ((store.NETWORK || {})[slug] || {}).list || [];
    const d = digest(list);
    if (!list.length) bad.push({ what: 'NET', id: slug, why: '台帳に就航地の行が無い' });
    else if (d !== N.h) bad.push({ what: 'NET', id: slug, why: `就航地の行が変わった（${N.h} → ${d}）── basis を読み直して h を付け直す` });
  }
  for (const [city, C] of Object.entries(CITY)) {
    const L = (store.LIVING || {})[city];
    if (!L) { bad.push({ what: 'CITY', id: city, why: '台帳に街が無い' }); continue; }
    const d = digest([...(L.rents || []), ...(L.commute || [])]);
    if (d !== C.h) bad.push({ what: 'CITY', id: city, why: `街の行が変わった（${C.h} → ${d}）── 字を読み直して h を付け直す` });
  }
  return bad;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--check')) {
  const { readStore } = await import('./import-research-pack.mjs');
  const bad = check(readStore(fileURLToPath(new URL('.', import.meta.url))).store);
  for (const b of bad) console.log(`❌ ${b.what} ${b.id}: ${b.why}`);
  console.log(bad.length ? `❌ airline-display: ${bad.length}件` : `✅ airline-display: LINES ${Object.keys(LINES).length}行・NET ${Object.keys(NET).length}社・CITY ${Object.keys(CITY).length}街・資料の名前 ${Object.keys(SOURCES).length}件（どれも台帳の今の行と合っている・英語の対もそろっている）`);
  process.exit(bad.length ? 1 : 0);
}
