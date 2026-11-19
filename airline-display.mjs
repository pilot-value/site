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
import { TERMS } from './us-terms.mjs';

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
  /* ── 2026-10-29 WP-28d：ChatGPT の追加の調べ（勤務と待遇）の行の資料。イベリア航空と LATAM は上の登録と同じ協約（調べの回で資料の ID と住所の書き方が違う）。
     オーストリア航空の2つは組合 vida が公開する協約（新しく登録） ── */
  'src-boe-es-c2717bf2': { name: 'スペイン官報（BOE）の BOE-A-2024-25500（イベリア航空とパイロットの第10次の労働協約の改定）', cond: 'イベリア航空のパイロットの労働協約の改定（2024年）', name_en: 'Spain’s Official State Gazette (BOE) BOE-A-2024-25500 (amendment to the 10th collective agreement between Iberia and its pilots)', cond_en: 'Amendment to the Iberia pilots’ collective agreement (2024)', url: 'https://boe.es/diario_boe/txt.php?id=BOE-A-2024-25500&lang=es', date: '2024-12-06' },
  'src-aeronautas-org-br-49a74f89': { name: '組合 SNA（Sindicato Nacional dos Aeronautas）「ACT Aeronautas Pilotos 2025–2027」（LATAM ブラジル（TAM）とパイロットの労働協約・組合の公開版）', cond: 'LATAM ブラジル（TAM）のパイロットの労働協約（2025〜2027年）', name_en: 'SNA (Sindicato Nacional dos Aeronautas, trade union) “ACT Aeronautas Pilotos 2025–2027” (collective agreement between LATAM Brasil (TAM) and its pilots, the union’s published copy)', cond_en: 'Collective agreement for LATAM Brasil (TAM) pilots (2025–2027)', url: 'https://www.aeronautas.org.br/wp-content/uploads/2025/12/20251209-ACT-Aeronautas-Pilotos-25-27_v13-site.pdf', date: '2025-12-12' },
  'src-vida-at-788088bd': { name: '組合 vida「PÄKV-2023」（オーストリア航空の乗務員の企業年金の労働協約）', cond: 'オーストリア航空の乗務員の企業年金の労働協約（2023年）', name_en: 'vida (trade union) “PÄKV-2023” (company pension collective agreement for Austrian Airlines flight crew)', cond_en: 'Company pension collective agreement for Austrian Airlines flight crew (2023)', url: 'https://www.vida.at/content/dam/vida/downloads/kv-vertr%C3%A4ge/luft-schiffverkehr/KV-luftfahrt-pensionszusage-AUA-2025.pdf', date: null },
  'src-vida-at-bea29876': { name: '組合 vida「OS-KV-2015 の改定」（オーストリア航空の乗務員の労働協約・2024年10月）', cond: 'オーストリア航空の乗務員の労働協約（2024年の改定）', name_en: 'vida (trade union) “OS-KV-2015 amendment” (collective agreement for Austrian Airlines flight crew, October 2024)', cond_en: 'Collective agreement for Austrian Airlines flight crew (2024 amendment)', url: 'https://www.vida.at/content/dam/vida/downloads/kv-vertr%C3%A4ge/luft-schiffverkehr/alt/KV-luftfahrt-Bord-aenderungen-2025.pdf', date: null },
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
  'skymark.benefits.staff-travel': { h: 'e04f095532e3c2cf', label: '社員の航空券', value: '自社便の優待搭乗制度', cond: '自社養成パイロット訓練生の募集要項', lead: true, en: { label: 'Staff travel', value: 'Discounted travel on the company’s own flights', cond: 'Cadet pilot job posting' } },
  'skymark.benefits.missing-annual-leave': { h: '2074a5e046a83080', label: '休暇', value: '年次有給休暇と、慶弔・育児・介護などの休暇', cond: '経験者の機長候補の募集要項', en: { label: 'Leave', value: 'Paid annual leave, plus leave for family events, childcare and caregiving', cond: 'Job posting for experienced captain candidates' } },
  'skymark.benefits.missing-commuting': { h: 'ec79978e22358264', label: '通勤', value: '公共交通か車。早朝・深夜などはタクシーを使える', cond: '経験者の機長候補の募集要項', en: { label: 'Commuting', value: 'Public transport or car; taxis may be used for early-morning and late-night duties', cond: 'Job posting for experienced captain candidates' } },
  'skymark.benefits.missing-medical': { h: '17a9a4b06151cd60', label: '保険', value: '社会保険・健康保険組合・団体長期障害所得補償保険', cond: '経験者の機長候補の募集要項', en: { label: 'Insurance', value: 'Social insurance, health insurance society and group long-term disability insurance', cond: 'Job posting for experienced captain candidates' } },
  'skymark.jobs.cont-cadet-start': { h: '50fc5c46f7e86d6f', label: '自社養成の入社予定日', value: '2027年4月1日（または会社が指定する時期）', cond: '予定', en: { label: 'Cadet start date', value: '1 April 2027 (or a date the company sets)', cond: 'Planned' } },
  /* 2026-10-21 a2：年間休日の行（値の字は ITEM の言い方「年123日」・誰の条件かを1行） */
  'skymark.work.pub-experienced-days-off': { h: 'cf622b302915dfeb', label: '休日', cond: '経験者の機長候補の募集要項', en: { label: 'Days off', cond: 'Job posting for experienced captain candidates' } },
  'skymark.work.cadet-hours': { h: '2873589c181b47d4', label: '訓練生の勤務時間', value: '週平均37.5時間以内（1か月単位の変形労働時間制）', cond: '自社養成パイロット訓練生の募集要項', en: { label: 'Cadet working hours', value: 'Up to 37.5 hours a week on average, with hours averaged over each month', cond: 'Cadet pilot job posting' } },
  /* 2026-10-21 d1：a2 の置き場の行（年金・勤務の組み方） */
  'skymark.benefits.missing-pension': { h: '8674c4d517d43ea1', label: '年金', value: '確定拠出年金', cond: '経験者の機長候補の募集要項', en: { label: 'Pension', value: 'Defined-contribution pension', cond: 'Job posting for experienced captain candidates' } },
  'skymark.work.missing-roster-pattern': { h: '2957d27bf35b9c85', label: '勤務の形', value: '1か月単位の変形労働時間制（1日平均7.5時間・週平均37.5時間）', cond: '経験者の機長候補の募集要項', en: { label: 'Working hours', value: 'Hours averaged over each month (7.5 hours a day and 37.5 hours a week on average)', cond: 'Job posting for experienced captain candidates' } },
  'skymark.fleet.missing-fleet-types': { h: 'b9931e917624f38f', fleet: 'ボーイング 737-800', en: { fleet: 'Boeing 737-800' } },
  'skymark.fleet.pub-fleet-b737-8': { h: 'b930b2ada55bf942', fleet: 'ボーイング 737-8', en: { fleet: 'Boeing 737-8' } },
  /* ── 全社へ広げる d1（2026-10-21）：日本の会社。字は行の値と引用から（調べた側の字は使わない）。cond ＝ 誰の・どの資料の条件か ── */
  /* ZIPAIR（運航乗務員（機長要員・副操縦士要員）募集要項） */
  'zipair.benefits.cont-pilot-commuting': { h: '83a94a43b544047e', label: '通勤', value: '通勤手当', cond: '機長要員・副操縦士要員の募集要項', en: { label: 'Commuting', value: 'Commuting allowance', cond: 'Job posting for captain and first officer candidates' } },
  'zipair.benefits.cont-pilot-disability': { h: '2dd45b2519cde5ee', label: '保険', value: '団体長期障害所得補償保険', cond: '機長要員・副操縦士要員の募集要項', en: { label: 'Insurance', value: 'Group long-term disability insurance', cond: 'Job posting for captain and first officer candidates' } },
  'zipair.benefits.cont-pilot-pension': { h: '69c630f746663a17', label: '年金', value: '確定拠出年金', cond: '機長要員・副操縦士要員の募集要項', en: { label: 'Pension', value: 'Defined-contribution pension', cond: 'Job posting for captain and first officer candidates' } },
  'zipair.benefits.missing-annual-leave': { h: '6324f8d0657f49f6', label: '休暇', value: '年次有給休暇・慶弔などの特別休暇', cond: '機長要員・副操縦士要員の募集要項', en: { label: 'Leave', value: 'Paid annual leave and special leave for family events', cond: 'Job posting for captain and first officer candidates' } },
  'zipair.jobs.cont-pilot-contract': { h: 'bec953244c9acd1d', label: '雇用の形', value: '訓練中は有期契約、機長・副操縦士に発令後は正社員（60〜65歳は契約社員）', cond: '機長要員・副操縦士要員の募集要項', en: { label: 'Contract type', value: 'Fixed-term contract during training; permanent employee once appointed captain or first officer (fixed-term contract from 60 to 65)', cond: 'Job posting for captain and first officer candidates' } },
  'zipair.jobs.cont-pilot-entry': { h: 'f7ccb16c9ea6a0e7', label: '募集の受付', value: '機長要員・副操縦士要員を募集中（締切の日付は無い）', cond: '会社の募集ページ（2026年10月19日に確認）', en: { label: 'Applications', value: 'Hiring captain and first officer candidates (no closing date)', cond: 'The company’s recruitment page (checked 19 October 2026)' } },
  'zipair.work.cont-pilot-roster': { h: 'c93c4987074ed36c', label: '勤務の形', value: '乗務・地上勤務に応じたシフト勤務（変形労働時間制）', cond: '機長要員・副操縦士要員の募集要項。土日祝日・深夜の勤務あり', en: { label: 'Roster', value: 'Shift work for flying and ground duties (variable working hours)', cond: 'Job posting for captain and first officer candidates. Includes weekends, public holidays and night duties' } },
  'zipair.work.cont-pilot-training': { h: '768e708c073c766b', label: '訓練の場所', value: '国内か海外の訓練施設', cond: '機長要員・副操縦士要員の募集要項', en: { label: 'Training location', value: 'Training facilities in Japan or overseas', cond: 'Job posting for captain and first officer candidates' } },
  /* ジェットスター・ジャパン（2026年の運航乗務員候補者 募集要項 ── 訓練生の募集。応募は2026年4月12日に締切）。
     待遇の3行は、名前が「訓練生の…」（訓練生の行は、名前が訓練の話でないと待遇のカードの1行めにならない ── 1行めが無いと、
     カードが「確認できていません」と言いながら開いた板に今の公表を並べてしまう。2026-10-21 d1 の続き） */
  'jetstar-japan.benefits.cont-foug-commuting': { h: '8f9f9ab64cf3f175', label: '訓練生の通勤', value: '通勤費（会社の規定による）', cond: '2026年の運航乗務員候補者（訓練生）の募集要項', en: { label: 'Cadet commuting', value: 'Commuting costs (under company rules)', cond: 'Job posting for 2026 flight crew candidates (cadets)' } },
  'jetstar-japan.benefits.cont-foug-leave': { h: '11384d774359f6e5', label: '訓練生の休暇', value: '年次有給休暇・傷病休暇・慶弔などの特別休暇', cond: '2026年の運航乗務員候補者（訓練生）の募集要項', en: { label: 'Cadet leave', value: 'Paid annual leave, sick leave and special leave for family events', cond: 'Job posting for 2026 flight crew candidates (cadets)' } },
  'jetstar-japan.benefits.missing-medical': { h: '937efdd6df4733c1', label: '訓練生の保険', value: '社会保険', cond: '2026年の運航乗務員候補者（訓練生）の募集要項', en: { label: 'Cadet insurance', value: 'Social insurance', cond: 'Job posting for 2026 flight crew candidates (cadets)' } },
  'jetstar-japan.jobs.cont-foug-employment': { h: 'e147a5cbad7fd9bb', label: '雇用の形', value: '契約社員。所定の訓練を終えると正社員に登用', cond: '2026年の運航乗務員候補者（訓練生）の募集要項', en: { label: 'Contract type', value: 'Contract employee; made permanent after completing the required training', cond: 'Job posting for 2026 flight crew candidates (cadets)' } },
  'jetstar-japan.jobs.foug-closed': { h: '347b3c3340b595da', label: '募集の受付', value: '締め切った（2026年4月12日必着）', cond: '2026年の運航乗務員候補者（訓練生）の募集要項', en: { label: 'Applications', value: 'Closed (applications had to arrive by 12 April 2026)', cond: 'Job posting for 2026 flight crew candidates (cadets)' } },
  'jetstar-japan.work.missing-roster-pattern': { h: '74f6affe32599982', label: '訓練生の勤務の形', value: '変則勤務（土日祝日も勤務）', cond: '2026年の運航乗務員候補者（訓練生）の募集要項', en: { label: 'Cadet roster', value: 'Irregular shifts (including weekends and public holidays)', cond: 'Job posting for 2026 flight crew candidates (cadets)' } },
  'jetstar-japan.work.training-locations': { h: '1b7b2ea16dc12ee1', label: '訓練の場所', value: '日本国内と、ソウル・クアラルンプールなど海外の訓練施設', cond: '2026年の運航乗務員候補者（訓練生）の募集要項', en: { label: 'Training locations', value: 'Japan, and training facilities abroad such as Seoul and Kuala Lumpur', cond: 'Job posting for 2026 flight crew candidates (cadets)' } },
  /* Peach（運航乗務員の募集一覧 ── 機長の募集） */
  'peach.benefits.cont-captain-insurance': { h: 'd5565aac8b2ee008', label: '保険', value: '社会保険・団体長期障害所得補償保険など', cond: '機長の募集要項', en: { label: 'Insurance', value: 'Social insurance, group long-term disability insurance and more', cond: 'Captain job posting' } },
  'peach.benefits.cont-captain-pension': { h: '773ddd9316056c15', label: '年金', value: '選択制の確定拠出年金', cond: '機長の募集要項', en: { label: 'Pension', value: 'Optional defined-contribution pension', cond: 'Captain job posting' } },
  'peach.benefits.cont-captain-travel': { h: '9db39abbc45d61e3', label: '社員の航空券', value: '社員優待搭乗制度', cond: '機長の募集要項', en: { label: 'Staff travel', value: 'Staff discounted travel', cond: 'Captain job posting' } },
  'peach.benefits.missing-annual-leave': { h: '5ac9aa60678a44c3', label: '休暇', value: '年次有給休暇（法定どおり）・リフレッシュ休暇・特別休暇', cond: '機長の募集要項', en: { label: 'Leave', value: 'Paid annual leave (statutory), refresh leave and special leave', cond: 'Captain job posting' } },
  'peach.jobs.cont-captain-contract': { h: 'cc802213220bfcff', label: '雇用の形', value: '初期訓練中は有期、機長に発令後は65歳まで無期、65歳からは1年ごとの契約で68歳まで', cond: '機長の募集要項', en: { label: 'Contract type', value: 'Fixed-term during initial training; permanent to age 65 once appointed captain, then one-year contracts up to 68', cond: 'Captain job posting' } },
  'peach.jobs.cont-challenge-closed': { h: 'a9119d9f8e97a872', label: '募集の受付', value: 'パイロットチャレンジ生（プレエントリー）は受付終了', cond: '会社の募集一覧（2026年10月19日に確認）', en: { label: 'Applications', value: 'Pilot Challenge (pre-entry) applications have closed', cond: 'The company’s recruitment list (checked 19 October 2026)' } },
  'peach.jobs.missing-entry-open': { h: '01d059fb79a3c2bc', label: '募集の受付', value: '機長の募集は、定員に達し次第締め切り', cond: '会社の募集一覧（2026年10月19日に確認）', en: { label: 'Applications', value: 'Captain hiring closes once all places are filled', cond: 'The company’s recruitment list (checked 19 October 2026)' } },
  'peach.work.cont-captain-roster': { h: '72f647d31b6e2e3f', label: '勤務の形', value: '乗務・地上勤務に応じたシフト勤務（変形労働時間制）', cond: '機長の募集要項。土日祝日・深夜・早朝の勤務あり', en: { label: 'Roster', value: 'Shift work for flying and ground duties (variable working hours)', cond: 'Captain job posting. Includes weekends, public holidays, night and early-morning duties' } },
  'peach.work.missing-training-location': { h: '4d0c1adb3d60e03b', label: '訓練の場所', value: '訓練の委託先と、会社が決める場所', cond: '機長の募集要項', en: { label: 'Training location', value: 'Contracted training providers and other locations set by the company', cond: 'Captain job posting' } },
  /* ソラシドエア（中途採用 運航乗務員（機長要員）） */
  'solaseed.benefits.missing-annual-leave': { h: '142e40e977e7ddbf', label: '休暇', value: '年次有給休暇・季節休暇・赴任休暇・慶弔などの特別休暇', cond: '機長要員の募集要項', en: { label: 'Leave', value: 'Paid annual leave, seasonal leave, relocation leave and special leave for family events', cond: 'Job posting for captain candidates' } },
  'solaseed.benefits.missing-medical': { h: '1dfbca0f00c5c205', label: '保険', value: '社会保険・メンタルヘルスケア・休業時の所得補償保険', cond: '機長要員の募集要項', en: { label: 'Insurance', value: 'Social insurance, mental health support and income protection insurance', cond: 'Job posting for captain candidates' } },
  'solaseed.benefits.missing-pension': { h: 'b5001bbdee4ecea9', label: '年金', value: '厚生年金と企業型確定拠出年金', cond: '機長要員の募集要項', en: { label: 'Pension', value: 'Employees’ Pension Insurance and a corporate defined-contribution plan', cond: 'Job posting for captain candidates' } },
  'solaseed.benefits.missing-staff-travel': { h: 'abe848e6f69c9471', label: '社員の航空券', value: '自社便の社員優待搭乗制度', cond: '機長要員の募集要項', en: { label: 'Staff travel', value: 'Staff discounted travel on the company’s own flights', cond: 'Job posting for captain candidates' } },
  'solaseed.jobs.missing-entry-open': { h: '95404671724bf6cb', label: '募集の受付', value: '書類が届き次第選考（締切の日付は無い）', cond: '機長要員の募集（2026年10月19日に確認）', en: { label: 'Applications', value: 'Rolling selection as applications arrive (no closing date)', cond: 'Captain candidate recruitment (checked 19 October 2026)' } },
  'solaseed.work.missing-roster-pattern': { h: 'a361bdf94d501c74', label: '勤務の形', value: '土日祝日を含む変則勤務（早朝・深夜あり）', cond: '機長要員の募集要項', en: { label: 'Roster', value: 'Irregular shifts including weekends and public holidays (early-morning and late-night duties)', cond: 'Job posting for captain candidates' } },
  /* AIRDO */
  'airdo.benefits.travel': { h: 'e464d301fbaaaacc', label: '社員の航空券', value: '自社便と他社便の優待搭乗制度', cond: '運航乗務員（機長）の募集要項', lead: true, en: { label: 'Staff travel', value: 'Discounted travel on the company’s own and other airlines’ flights', cond: 'Job posting for flight crew (captains)' } },
  'airdo.jobs.cont-experienced-closed': { h: '777842bf7a1b01c5', label: '募集の受付', value: '経験者の機長・副操縦士の募集は2026年9月1日から停止', cond: '運航乗務員採用のお知らせ', en: { label: 'Applications', value: 'Recruitment of experienced captains and first officers stopped on 1 September 2026', cond: 'Flight crew recruitment notice' } },
  /* スターフライヤー（運航乗務員の募集要項 ── 機長・副操縦士） */
  'starflyer.benefits.missing-annual-leave': { h: 'ef4bbe7d664f359f', label: '休暇', value: '年次有給休暇・産前産後休暇・育児休暇・介護休暇', cond: '機長・副操縦士の募集要項', en: { label: 'Leave', value: 'Paid annual leave, maternity leave, childcare leave and caregiving leave', cond: 'Job posting for captains and first officers' } },
  'starflyer.benefits.missing-medical': { h: 'fe07b19ec0766210', label: '保険', value: '社会保険・定期健康診断・団体長期障害所得補償保険', cond: '機長・副操縦士の募集要項', en: { label: 'Insurance', value: 'Social insurance, regular health checks and group long-term disability insurance', cond: 'Job posting for captains and first officers' } },
  'starflyer.benefits.missing-pension': { h: '460c7eabcf691755', label: '年金', value: '確定拠出年金', cond: '機長・副操縦士の募集要項', en: { label: 'Pension', value: 'Defined-contribution pension', cond: 'Job posting for captains and first officers' } },
  'starflyer.benefits.missing-staff-travel': { h: 'f65dc04a42aea643', label: '社員の航空券', value: '自社便とANA便の社員優待搭乗', cond: '機長・副操縦士の募集要項', en: { label: 'Staff travel', value: 'Staff discounted travel on the company’s own and ANA flights', cond: 'Job posting for captains and first officers' } },
  'starflyer.jobs.cont-cap-contract': { h: '2713040cc6d1ac95', label: '雇用の形', value: '60歳未満は無期。60歳からは2027年3月31日までの契約（更新することがあり、68歳まで）', cond: '機長の募集要項', en: { label: 'Contract type', value: 'Permanent until 60; from 60, a contract to 31 March 2027 (renewable up to 68)', cond: 'Captain job posting' } },
  'starflyer.jobs.cont-current-pilot-jobs': { h: 'c6039bf1d57208ba', label: '募集の受付', value: 'A320の限定を持つ副操縦士候補と、機長候補を募集中', cond: '中途採用・現在募集中の職種（2026年10月19日に確認）', en: { label: 'Applications', value: 'Hiring A320 type-rated first officer candidates and captain candidates', cond: 'Current mid-career openings (checked 19 October 2026)' } },
  'starflyer.work.cont-co-pilot-hours': { h: 'e4e8d07a812ba8cd', label: '副操縦士の勤務時間', value: '1か月単位の変形労働時間制（月平均で週40時間以内）', cond: '副操縦士の募集要項', en: { label: 'First officer working hours', value: 'Hours averaged over each month (up to 40 hours a week on average)', cond: 'First officer job posting' } },
  'starflyer.work.cont-pilot-hours': { h: '4fe2550d3a88bf31', label: '機長の勤務時間', value: '1か月単位の変形労働時間制（月平均で週40時間以内）', cond: '機長の募集要項', en: { label: 'Captain working hours', value: 'Hours averaged over each month (up to 40 hours a week on average)', cond: 'Captain job posting' } },
  'starflyer.work.missing-roster-pattern': { h: 'b5c5ba58198ea84c', label: '勤務の形', value: 'シフト勤務（1か月単位の変形労働時間制）', cond: '機長・副操縦士の募集要項', en: { label: 'Roster', value: 'Shift work (hours averaged over each month)', cond: 'Job posting for captains and first officers' } },
  'starflyer.work.missing-training-location': { h: '696321482118038b', label: '訓練の場所', value: '北九州空港の施設', cond: '機長・副操縦士の募集要項', en: { label: 'Training location', value: 'Facilities at Kitakyushu Airport', cond: 'Job posting for captains and first officers' } },
  /* フジドリームエアラインズ（採用サイトの福利厚生 ＝ 全職種／他社経験者の機長候補の求人） */
  'fda.benefits.cont-general-family-travel': { h: '243e130ca5fd0c24', label: '社員の航空券', value: '社員と家族の自社便の優待', cond: '採用サイトの福利厚生（全職種）', en: { label: 'Staff travel', value: 'Discounted travel on the company’s own flights for staff and family', cond: 'Benefits on the recruitment site (all roles)' } },
  'fda.benefits.cont-general-housing': { h: '990e053fd590a1c8', label: '住宅の補助', value: '住宅手当', cond: '採用サイトの福利厚生（全職種）', en: { label: 'Housing allowance', value: 'Housing allowance', cond: 'Benefits on the recruitment site (all roles)' } },
  'fda.benefits.missing-annual-leave': { h: '5483daad32c9124f', label: '休暇', value: '有給休暇・リフレッシュ休暇・育児休暇', cond: '採用サイトの福利厚生（全職種）', en: { label: 'Leave', value: 'Paid leave, refresh leave and childcare leave', cond: 'Benefits on the recruitment site (all roles)' } },
  'fda.benefits.missing-medical': { h: '24587dd210cab51c', label: '保険', value: '健康保険', cond: '他社経験者の機長候補の求人', en: { label: 'Insurance', value: 'Health insurance', cond: 'Vacancy for captain candidates with experience at another airline' } },
  'fda.benefits.missing-pension': { h: '6f6ae266e09b3385', label: '年金', value: '選択制の確定拠出年金（月給の中から月2万円までを積み立て。選ばない分は毎月支給）', cond: '他社経験者の機長候補の求人', en: { label: 'Pension', value: 'Optional defined-contribution pension (up to ¥20,000 a month from salary; any amount not contributed is paid out monthly)', cond: 'Vacancy for captain candidates with experience at another airline' } },
  'fda.jobs.missing-entry-open': { h: '19bbdaaafd7ac456', label: '募集の受付', value: '他社経験者の機長候補と副操縦士候補の2件を募集中', cond: '会社の採用サイトの一覧（2026年10月19日に確認）', en: { label: 'Applications', value: 'Two openings: captain candidates and first officer candidates with experience at another airline', cond: 'The company’s recruitment site list (checked 19 October 2026)' } },
  /* AirJapan（海外に住む機長・副操縦士の、派遣会社を通した募集） */
  'airjapan.benefits.missing-commuting': { h: 'c525d4964c6ca435', label: '通勤', value: '通勤の手当と、会社が手配する航空券（他社便のエコノミーかANA運航便のビジネス）', cond: '海外に住む機長・副操縦士の、派遣会社を通した募集', en: { label: 'Commuting', value: 'A commuting allowance and tickets the company arranges (economy on other airlines or business on ANA-operated flights)', cond: 'Agency recruitment of captains and first officers living abroad' } },
  'airjapan.jobs.overseas-agency': { h: 'e08827f3e3183ff4', label: '雇用の形', value: '海外に住む人は直接雇わず、派遣会社を通して契約', cond: '海外に住む機長・副操縦士の、派遣会社を通した募集', en: { label: 'Contract type', value: 'Pilots living abroad are not hired directly but contracted through an agency', cond: 'Agency recruitment of captains and first officers living abroad' } },
  'airjapan.work.cont-agency-roster': { h: '8a28213b554193a3', label: '勤務の形', value: '月に連続10日の休みと、通勤の2日', cond: '海外に住む機長・副操縦士の、派遣会社を通した募集', en: { label: 'Roster', value: '10 consecutive days off a month, plus 2 days for commuting', cond: 'Agency recruitment of captains and first officers living abroad' } },
  /* 天草エアライン（運航乗務員（機長）の募集要項） */
  'amx.benefits.missing-annual-leave': { h: 'cb3f1165aa75d3f0', label: '休暇', value: '有給休暇・慶弔などの特別休暇', cond: '運航乗務員（機長）の募集要項', en: { label: 'Leave', value: 'Paid leave and special leave for family events', cond: 'Job posting for flight crew (captains)' } },
  'amx.benefits.missing-medical': { h: '2db9019158031dbf', label: '保険', value: '各種社会保険', cond: '運航乗務員（機長）の募集要項', en: { label: 'Insurance', value: 'Social insurance', cond: 'Job posting for flight crew (captains)' } },
  'amx.benefits.pension': { h: '968a4e2f3d55dcae', label: '退職金', value: '退職金制度', cond: '運航乗務員（機長）の募集要項', en: { label: 'Retirement allowance', value: 'Retirement allowance scheme', cond: 'Job posting for flight crew (captains)' } },
  'amx.jobs.cont-captain-contract': { h: 'b99c036f035babed', label: '雇用の形', value: '正社員（60歳からは嘱託）。機長任用の訓練中は契約社員', cond: '運航乗務員（機長）の募集要項', en: { label: 'Contract type', value: 'Permanent employee (re-employed on contract from 60); contract employee during captain training', cond: 'Job posting for flight crew (captains)' } },
  'amx.jobs.missing-entry-open': { h: '9e67e48abc087a20', label: '募集の受付', value: '機長の募集要項を掲載中', cond: '会社の採用ページ', en: { label: 'Applications', value: 'A captain job posting is live', cond: 'The company’s recruitment page' } },
  /* ANAウイングス（2027年度入社 自社養成パイロットの募集要項／会社の福利厚生の案内） */
  'ana-wings.benefits.missing-commuting': { h: 'dd6c65164b4cfaac', label: '通勤', value: '通勤補助費（会社の規定による）', cond: '2027年度入社の自社養成パイロットの募集要項', en: { label: 'Commuting', value: 'Commuting allowance (under company rules)', cond: 'Cadet pilot job posting, FY2027 intake' } },
  'ana-wings.benefits.missing-housing': { h: '3e3f4a7569db353b', label: '住宅の補助', value: '社宅・寮か住宅手当（職種によって違う）', cond: '会社の福利厚生の案内（全職種）', en: { label: 'Housing allowance', value: 'Company housing or dormitory, or a housing allowance (varies by role)', cond: 'The company’s benefits guide (all roles)' } },
  'ana-wings.benefits.missing-medical': { h: '581ef4a70882d3ae', label: '保険', value: '社会保険', cond: '2027年度入社の自社養成パイロットの募集要項', en: { label: 'Insurance', value: 'Social insurance', cond: 'Cadet pilot job posting, FY2027 intake' } },
  'ana-wings.benefits.missing-pension': { h: '4c8b56e79f7e1d97', label: '年金', value: '確定拠出年金', cond: '会社の福利厚生の案内（全職種）', en: { label: 'Pension', value: 'Defined-contribution pension', cond: 'The company’s benefits guide (all roles)' } },
  'ana-wings.benefits.travel': { h: '0092f1a496ec055c', label: '社員の航空券', value: '国内線・国際線の優待搭乗制度', cond: '2027年度入社の自社養成パイロットの募集要項', en: { label: 'Staff travel', value: 'Discounted travel on domestic and international flights', cond: 'Cadet pilot job posting, FY2027 intake' } },
  'ana-wings.jobs.captain-planned': { h: 'e2b33245fd948773', label: '募集の受付', value: '経験者の機長の本エントリーは11月末に始まる予定', cond: 'パイロット経験者採用のお知らせ', en: { label: 'Applications', value: 'Full applications for experienced captains are due to open at the end of November', cond: 'Experienced pilot recruitment notice' } },
  'ana-wings.jobs.cont-cadet-contract': { h: '323537440d67b4f6', label: '雇用の形', value: '期間の定めのない正社員（試用期間は原則3か月）', cond: '2027年度入社の自社養成パイロットの募集要項', en: { label: 'Contract type', value: 'Permanent employee (probation normally 3 months)', cond: 'Cadet pilot job posting, FY2027 intake' } },
  'ana-wings.jobs.entry-2027-closed': { h: '4b49edcc4597a881', label: '募集の受付', value: '2027年度入社の自社養成の受付は終了', cond: '2027年度入社の自社養成パイロットの募集要項', en: { label: 'Applications', value: 'Cadet applications for the FY2027 intake have closed', cond: 'Cadet pilot job posting, FY2027 intake' } },
  'ana-wings.work.cont-cadet-training': { h: '49791e43406fec88', label: '訓練の流れ', value: 'ほかの職種の研修（約1年）→ 海外か国内で基礎訓練 → 型式・路線の訓練 → 副操縦士の審査', cond: '2027年度入社の自社養成パイロットの募集要項', en: { label: 'Training path', value: 'About a year in other roles → basic flight training abroad or in Japan → type rating and line training → first officer check', cond: 'Cadet pilot job posting, FY2027 intake' } },
  'ana-wings.work.roster': { h: '649772b8b29975b7', label: '勤務の形', value: 'シフト勤務（乗務に合わせて組む。土日祝日・早朝・深夜・宿泊を伴う勤務あり）', cond: '2027年度入社の自社養成パイロットの募集要項', en: { label: 'Roster', value: 'Shift work built around the flying schedule (includes weekends, public holidays, early-morning and late-night duties and overnights)', cond: 'Cadet pilot job posting, FY2027 intake' } },
  /* 第一航空 */
  'daiichi-air.jobs.cont-fixed-jobs': { h: 'b463ca30ea6485d1', label: '募集の受付', value: '固定翼の事業用操縦士以上（運航管理も兼務）を募集中（入社時期は相談）', cond: '会社の採用情報', en: { label: 'Applications', value: 'Hiring fixed-wing pilots holding a CPL or higher (also covering flight dispatch); start date negotiable', cond: 'The company’s recruitment information' } },
  /* 北海道エアシステム */
  'hac.jobs.cont-pilot-job-closed': { h: '37d6de22fc648dec', label: '募集の受付', value: '運航乗務員は今は募集していない', cond: '会社の採用情報（2026年10月19日に確認）', en: { label: 'Applications', value: 'Not hiring flight crew at present', cond: 'The company’s recruitment information (checked 19 October 2026)' } },
  'hac.work.missing-roster-pattern': { h: '2e3a6222a86635dc', label: '副操縦士の勤務の例', value: '遅番の1日：12:40に出社、丘珠発着で函館・釧路の5便、20:30に勤務終了', cond: '会社の採用情報に載っている1日の例', en: { label: 'A first officer’s day (example)', value: 'Late duty: report at 12:40, five sectors to and from Okadama (Hakodate and Kushiro), off duty at 20:30', cond: 'An example day in the company’s recruitment information' } },
  /* IBEXエアラインズ（副操縦士要員（未経験者）の募集要項／採用サイトの制度の案内 ＝ 全職種） */
  'ibex.benefits.cont-fo-leave': { h: 'c9006d82b1d025db', label: '休暇', value: '年次有給休暇・フレックス休暇（年3日）・慶弔・育児・介護・傷病の休暇', cond: '副操縦士要員（未経験者）の募集要項', en: { label: 'Leave', value: 'Paid annual leave, flex leave (3 days a year) and leave for family events, childcare, caregiving and illness', cond: 'Job posting for first officer candidates (no prior experience)' } },
  'ibex.benefits.missing-housing': { h: '2c91bbb1bcc25025', label: '住宅の補助', value: '住宅手当', cond: '採用サイトの制度の案内（全職種）', en: { label: 'Housing allowance', value: 'Housing allowance', cond: 'Schemes on the recruitment site (all roles)' } },
  'ibex.benefits.missing-medical': { h: '9a4905819d2c92b0', label: '保険', value: '社会保険・予防接種の費用の補助・定期健康診断', cond: '採用サイトの制度の案内（全職種）', en: { label: 'Insurance', value: 'Social insurance, help with vaccination costs and regular health checks', cond: 'Schemes on the recruitment site (all roles)' } },
  'ibex.benefits.missing-pension': { h: '5401c4f07f5d449c', label: '年金', value: '厚生年金', cond: '採用サイトの制度の案内（全職種）', en: { label: 'Pension', value: 'Employees’ Pension Insurance', cond: 'Schemes on the recruitment site (all roles)' } },
  'ibex.benefits.missing-staff-travel': { h: '2a96c2269b6fd568', label: '社員の航空券', value: '社員優待搭乗', cond: '採用サイトの制度の案内（全職種）', en: { label: 'Staff travel', value: 'Staff discounted travel', cond: 'Schemes on the recruitment site (all roles)' } },
  'ibex.jobs.cont-fo-contract': { h: 'fb815d35f108369b', label: '雇用の形', value: '副操縦士任用の訓練が終わるまでは有期、副操縦士に発令後は正社員', cond: '副操縦士要員（未経験者）の募集要項', en: { label: 'Contract type', value: 'Fixed-term until first officer training is complete; permanent employee once appointed first officer', cond: 'Job posting for first officer candidates (no prior experience)' } },
  'ibex.jobs.cont-fo-open': { h: 'd6e3732f71b31c90', label: '募集の受付', value: '2026年10月30日必着（入社は2027年4月1日以降の予定）', cond: '副操縦士要員（未経験者）の募集要項', en: { label: 'Applications', value: 'Applications must arrive by 30 October 2026 (start date from 1 April 2027)', cond: 'Job posting for first officer candidates (no prior experience)' } },
  'ibex.work.cont-fo-work': { h: 'a69e13f80bf49544', label: '訓練生の勤務の形', value: '変形労働時間制（1か月単位）', cond: '副操縦士要員（未経験者）の募集要項', en: { label: 'Cadet working hours', value: 'Hours averaged over each month', cond: 'Job posting for first officer candidates (no prior experience)' } },
  /* ジェイエア */
  'j-air.jobs.cadet-closed': { h: '0bcfc3110e1e3640', label: '募集の受付', value: '自社養成の募集は終了（前回の要項を参考に掲載）', cond: '運航乗務員の募集要項', en: { label: 'Applications', value: 'Cadet recruitment has closed (the previous posting is shown for reference)', cond: 'Flight crew job posting' } },
  /* 日本エアコミューター（運航乗務員（副操縦士要員）の募集要項。今年度の募集は終了） */
  'jac.benefits.housing-none': { h: 'a1a65c8221cbe657', label: '社宅・寮', value: '会社が持つ社宅・寮は無い', cond: '運航乗務員の募集要項', en: { label: 'Company housing', value: 'The company has no housing or dormitories of its own', cond: 'Flight crew job posting' } },
  'jac.benefits.missing-annual-leave': { h: '76a1ac49b58d54df', label: '休暇', value: '年次有給休暇と特別休暇', cond: '運航乗務員の募集要項（今年度の募集は終了）', en: { label: 'Leave', value: 'Paid annual leave and special leave', cond: 'Flight crew job posting (closed for this year)' } },
  'jac.benefits.missing-medical': { h: 'c6cc31e1a2f59b15', label: '保険', value: '日本航空健康保険組合・厚生年金・雇用保険・労災保険', cond: '運航乗務員の募集要項（今年度の募集は終了）', en: { label: 'Insurance', value: 'Japan Airlines Health Insurance Society, Employees’ Pension Insurance, employment insurance and workers’ accident compensation insurance', cond: 'Flight crew job posting (closed for this year)' } },
  'jac.jobs.cont-fo-closed': { h: 'f706389a0616cf73', label: '募集の受付', value: '今年度の募集は終了（前回の要項を参考に掲載）', cond: '運航乗務員の募集要項', en: { label: 'Applications', value: 'Closed for this year (the previous posting is shown for reference)', cond: 'Flight crew job posting' } },
  'jac.work.training-kagoshima': { h: 'b6f311b5c2799e66', label: '訓練の場所', value: '鹿児島', cond: '運航乗務員の募集要項', en: { label: 'Training location', value: 'Kagoshima', cond: 'Flight crew job posting' } },
  /* 日本トランスオーシャン航空（2026年度 機長候補者の募集要項。受付は2026年9月30日に終了） */
  'jta.benefits.missing-annual-leave': { h: '87fb70f6e5a794c5', label: '休暇', value: '年次有給休暇・夏季休暇・慶弔などの特別休暇', cond: '2026年度の機長候補者の募集要項（受付は終了）', en: { label: 'Leave', value: 'Paid annual leave, summer leave and special leave for family events', cond: 'Job posting for FY2026 captain candidates (closed)' } },
  'jta.benefits.missing-medical': { h: '66ba9922a26dfcc8', label: '保険', value: '各種社会保険・日本航空健康保険組合・LOL制度', cond: '2026年度の機長候補者の募集要項（受付は終了）', en: { label: 'Insurance', value: 'Social insurance, Japan Airlines Health Insurance Society and loss-of-license (LOL) cover', cond: 'Job posting for FY2026 captain candidates (closed)' } },
  'jta.benefits.missing-staff-travel': { h: 'e4b3858321ecfbcd', label: '社員の航空券', value: 'JALレジャートラベル制度', cond: '2026年度の機長候補者の募集要項（受付は終了）', en: { label: 'Staff travel', value: 'JAL leisure travel scheme', cond: 'Job posting for FY2026 captain candidates (closed)' } },
  'jta.jobs.captain-deadline': { h: '6a5da642eb844b68', label: '募集の受付', value: '2026年9月30日に締め切った', cond: '2026年度の機長候補者の募集要項', en: { label: 'Applications', value: 'Closed on 30 September 2026', cond: 'Job posting for FY2026 captain candidates' } },
  'jta.work.missing-roster-pattern': { h: 'c98a2e09b19a1068', label: '勤務の形', value: '土日祝日を含む変則勤務', cond: '2026年度の機長候補者の募集要項（受付は終了）', en: { label: 'Roster', value: 'Irregular shifts including weekends and public holidays', cond: 'Job posting for FY2026 captain candidates (closed)' } },
  /* オリエンタルエアブリッジ */
  'orc.jobs.cont-rotor-job': { h: 'eed0f858ce645ae6', label: '募集の受付', value: '回転翼の操縦士（機長）を募集', cond: '会社の採用情報', en: { label: 'Applications', value: 'Hiring rotary-wing pilots (captains)', cond: 'The company’s recruitment information' } },
  /* 琉球エアーコミューター */
  'rac.jobs.cont-current-job-closed': { h: '696368088857df24', label: '募集の受付', value: '今は募集していない', cond: '会社の求人情報（2026年10月19日に確認）', en: { label: 'Applications', value: 'Not hiring at present', cond: 'The company’s job information (checked 19 October 2026)' } },
  'rac.jobs.cont-trainee-deadline': { h: '98eeb73e0ec43eeb', label: '訓練生の募集', value: '2026年5月15日に締め切った（入社は7月1日以降の予定）', cond: '2026年度の訓練生の募集（事業用・多発・計器の資格を持つ人）', en: { label: 'Cadet applications', value: 'Closed on 15 May 2026 (joining planned from 1 July)', cond: 'FY2026 trainee recruitment (CPL holders with multi-engine and instrument ratings)' } },
  'rac.work.cont-scholarship-bond': { h: '34a277f4bf3c6f6b', label: '奨学金の返還', value: '資格を取ってパイロットとして入社し、一定の期間勤めると、自己負担分を除いて返還を免除', cond: '2026年度の奨学金の募集（沖縄県内の大学などの学生）', en: { label: 'Scholarship repayment', value: 'Repayment is waived (except the student’s own share) for those who qualify, join as a pilot and stay for a set period', cond: 'FY2026 scholarship recruitment (university and other students in Okinawa)' } },
  'rac.work.missing-roster-pattern': { h: 'b332de5c421364c9', label: '1日の乗務', value: '1日に4〜6便を担当', cond: '運航乗員部門の紹介', en: { label: 'Sectors per day', value: '4 to 6 sectors a day', cond: 'Flight crew department profile' } },
  'rac.work.missing-upgrade-years': { h: '4c0ad3fe6eb56a9b', label: '機長への昇格の例', value: '副操縦士に発令後5〜6年で機長になった人もいる', cond: '人事担当のQ&A（例であり、決まった年数ではない）', en: { label: 'Command upgrade (example)', value: 'Some pilots upgraded to captain 5–6 years after being appointed first officer', cond: 'HR team Q&A (an example, not a fixed timeline)' } },
  /* 新中央航空（セスナ172P型機の機長・操縦訓練教官の募集 ── 竜ヶ崎飛行場の事業所。応募は2026年10月15日に締切） */
  'shin-central.benefits.r2-c172-retirement': { h: 'db69a1c87a91133d', label: '退職金', value: '退職金制度', cond: 'セスナ172P型機の機長・操縦訓練教官の募集（竜ヶ崎）', en: { label: 'Retirement allowance', value: 'Retirement allowance scheme', cond: 'Recruitment of Cessna 172P captains and flight instructors (Ryugasaki)' } },
  'shin-central.benefits.r2-c172-social-insurance': { h: 'c054c022692e6b9a', label: '保険', value: '各種の社会保険（健康保険、厚生年金、雇用保険、労災保険）', cond: 'セスナ172P型機の機長・操縦訓練教官の募集（竜ヶ崎）', en: { label: 'Insurance', value: 'Social insurance (health insurance, Employees’ Pension Insurance, employment insurance and workers’ accident compensation insurance)', cond: 'Recruitment of Cessna 172P captains and flight instructors (Ryugasaki)' } },
  'shin-central.work.r2-c172-holidays': { h: '39ca502e76b255c4', label: '機長の休日', value: '月9日（年間休日118日以上）', cond: 'セスナ172P型機の機長・操縦訓練教官の募集（竜ヶ崎）', en: { label: 'Captain days off', value: '9 days a month (118 or more days off a year)', cond: 'Recruitment of Cessna 172P captains and flight instructors (Ryugasaki)' } },
  /* 新日本航空 */
  'shin-nihon.jobs.cont-instructor-closed': { h: '8450e4e74c129159', label: '募集の受付', value: '事業用操縦士（教官）の募集は終了', cond: '鹿児島本社運航所の採用情報', en: { label: 'Applications', value: 'Hiring of commercial pilots (instructors) has closed', cond: 'Recruitment information, Kagoshima head office flight operations' } },
  /* 東邦航空（中途採用の操縦士募集） */
  'toho-air.jobs.cont-pilot-current-job': { h: 'be4196383f468ed3', label: '募集の受付', value: '操縦士を若干名（採用が決まり次第終了）', cond: '中途採用の操縦士募集', en: { label: 'Applications', value: 'A small number of pilots (closes once filled)', cond: 'Mid-career pilot recruitment' } },
  'toho-air.work.cont-pilot-training': { h: '8f93c3d3464118ac', label: '訓練', value: '機体のライセンスを取り、OJTで技能を身につける', cond: '中途採用の操縦士募集', en: { label: 'Training', value: 'Gain the type rating, then build skills through on-the-job training', cond: 'Mid-career pilot recruitment' } },
  'toho-air.work.cont-pilot-work': { h: '8879f351157450c6', label: '勤務時間', value: '担当する事業によって変わる', cond: '中途採用の操縦士募集', en: { label: 'Working hours', value: 'Varies with the type of operation', cond: 'Mid-career pilot recruitment' } },
  /* トキエア（運航乗務員候補（機長）の募集要項） */
  'toki-air.benefits.cont-captain-commuting': { h: '8bb30366ad046167', label: '通勤', value: '通勤費の規程と、コミューティング制度', cond: '機長候補の募集要項', en: { label: 'Commuting', value: 'Commuting expenses policy and a pilot commuter scheme', cond: 'Job posting for captain candidates' } },
  'toki-air.benefits.cont-captain-housing': { h: '9ae3205beb43ea8d', label: '住宅の補助', value: '住宅手当', cond: '機長候補の募集要項', en: { label: 'Housing allowance', value: 'Housing allowance', cond: 'Job posting for captain candidates' } },
  'toki-air.benefits.missing-annual-leave': { h: '20802573dd0a7872', label: '休暇', value: '年次有給休暇・年末年始・傷病・結婚・忌引・転勤などの特別休暇', cond: '機長候補の募集要項', en: { label: 'Leave', value: 'Paid annual leave, year-end and New Year holidays, and special leave for illness, marriage, bereavement and transfers', cond: 'Job posting for captain candidates' } },
  'toki-air.benefits.missing-pension': { h: '9a7484b31049b5c2', label: '年金', value: '厚生年金', cond: '機長候補の募集要項', en: { label: 'Pension', value: 'Employees’ Pension Insurance', cond: 'Job posting for captain candidates' } },
  'toki-air.jobs.cont-captain-contract': { h: '94bc7101a4e745c0', label: '雇用の形', value: '入社時は契約社員。所定の訓練・機長の発令・試用期間のあと正社員', cond: '機長候補の募集要項', en: { label: 'Contract type', value: 'Contract employee on joining; permanent employee after the required training, appointment as captain and probation', cond: 'Job posting for captain candidates' } },
  'toki-air.jobs.cont-captain-open': { h: '766eafc3da871760', label: '募集の受付', value: '機長候補を募集中（書類が届き次第、順に選考）', cond: '機長候補の募集要項（2026年10月19日に確認）', en: { label: 'Applications', value: 'Hiring captain candidates (applications reviewed in order of arrival)', cond: 'Job posting for captain candidates (checked 19 October 2026)' } },
  'toki-air.work.cont-captain-days': { h: '5602b14b0b525c0c', label: '機長の休日', value: '年120日程度', cond: '機長候補の募集要項', en: { label: 'Captain days off', value: 'About 120 days a year', cond: 'Job posting for captain candidates' } },
  'toki-air.work.missing-training-location': { h: 'a958ab3e559fad72', label: '訓練の場所', value: '国内と海外の訓練施設', cond: '機長候補の募集要項', en: { label: 'Training location', value: 'Training facilities in Japan and abroad', cond: 'Job posting for captain candidates' } },
  /* ── 全社へ広げる d1 の続き（2026-10-21）：アジアの会社。字は行の値と引用から（調べた側の字は使わない）。cond ＝ 誰の・どの資料の条件か。
     同じ資料の同じことを言う2つめの行は字を書かない（大韓航空の訓練センター・バンブーの締切・フィリピン航空とベトジェットの求人の表示）── */
  /* シンガポール航空（パイロットの採用案内・求人） */
  'singapore-airlines.benefits.free-travel': { h: '7db8494bca816cbf', label: '社員の航空券', value: '年に1回の無料の旅行', cond: 'パイロットの採用案内', en: { label: 'Staff travel', value: 'One free trip a year', cond: 'Pilot recruitment guide' } },
  'singapore-airlines.benefits.medical': { h: '2870d4f88971e193', label: '保険', value: '医療と歯科の保障、保険', cond: 'パイロットの採用案内', en: { label: 'Insurance', value: 'Medical and dental cover, and insurance', cond: 'Pilot recruitment guide' } },
  'singapore-airlines.benefits.p26-family-travel': { h: 'af876bc873321fc2', label: '家族の航空券', value: '本人と対象の家族は、自社と提携会社の便を回数の制限なく割引で', cond: 'パイロットの採用案内', en: { label: 'Family travel', value: 'Unlimited discounted travel for the employee and eligible family on the company’s and partner airlines’ flights', cond: 'Pilot recruitment guide' } },
  'singapore-airlines.jobs.missing-entry-open': { h: '57619cda77d0ee38', label: '募集の受付', value: '訓練生（Ab Initio Cadet Pilot）を募集中', cond: '会社の求人ページ', en: { label: 'Applications', value: 'Hiring cadets (Ab Initio Cadet Pilot)', cond: 'The company’s vacancy page' } },
  'singapore-airlines.jobs.r7-a350-a380-contract-term': { h: 'cfaff568e36114b4', label: '雇用の形', value: 'A350・A380の経験者の副操縦士・機長は、最長12か月の有期契約', cond: '経験者の副操縦士・機長（契約）の求人（2026年10月2日に掲載）', en: { label: 'Contract type', value: 'Experienced A350 and A380 first officers and captains: fixed-term contracts of up to 12 months', cond: 'Vacancy for experienced first officers and captains on contract (posted 2 October 2026)' } },
  'singapore-airlines.jobs.r7-second-officer-current-closed': { h: 'b3e13278c95b2c97', label: '募集の受付', value: '経験者のセカンドオフィサーの応募は、いまは受け付けていない', cond: '会社のパイロット採用のページ（2026年10月20日に確認）', en: { label: 'Applications', value: 'Not currently accepting applications from experienced second officers', cond: 'The company’s pilot recruitment page (checked 20 October 2026)' } },
  'singapore-airlines.work.bond': { h: 'e43e45cc413336a3', label: '勤続の約束', value: '訓練の期間と、副操縦士になってから7年', cond: '訓練生（自社養成）の採用案内', en: { label: 'Service commitment', value: 'The training period plus 7 years after becoming a first officer', cond: 'Cadet recruitment guide' } },
  'singapore-airlines.work.training': { h: 'f64aec0a0a5a7b7a', label: '訓練の場所', value: 'Singapore Flying College', cond: '訓練生（自社養成）の採用案内', en: { label: 'Training location', value: 'Singapore Flying College', cond: 'Cadet recruitment guide' } },
  /* 大韓航空（民間の飛行経歴を持つ新人操縦士の募集／会社のニュース） */
  'korean-air.jobs.followup-agent-f26-application-window': { h: '9bdd81116f8b2748', label: '募集の受付', value: '2026年7月1日から2027年6月30日まで', cond: '民間の飛行経歴を持つ新人操縦士の募集', en: { label: 'Applications', value: '1 July 2026 to 30 June 2027', cond: 'Recruitment of new pilots with civil flying experience' } },
  'korean-air.jobs.followup-agent-f26-selection-trigger': { h: 'c238e5c92e273d38', label: '選考の始まり', value: '応募が決まった人数に達してから選考を始め、本人に知らせる', cond: '民間の飛行経歴を持つ新人操縦士の募集', en: { label: 'Start of selection', value: 'Selection starts once applications reach a set number; applicants are notified', cond: 'Recruitment of new pilots with civil flying experience' } },
  'korean-air.jobs.followup-agent-f26-training-employment-status': { h: '2beccdbbfd05ddd7', label: '雇用の形', value: '教育のあいだは契約職。試用の操縦士に任命されると正規職', cond: '民間の飛行経歴を持つ新人操縦士の募集', en: { label: 'Contract type', value: 'Contract position during training; permanent once appointed as a probationary pilot', cond: 'Recruitment of new pilots with civil flying experience' } },
  'korean-air.profile.country': { h: '7356bc4640cc6910', label: '本社', value: '韓国', en: { label: 'Headquarters', value: 'South Korea' } },
  'korean-air.work.missing-training-location': { h: 'd87f23378f9bf5c1', label: '訓練の施設', value: '済州の飛行訓練院・金浦の本社・仁川 永宗島の運航訓練センター', cond: '会社のニュース（2026年5月8日）', en: { label: 'Training facilities', value: 'Flight training center in Jeju, the Gimpo head office and the flight training center on Yeongjong Island, Incheon', cond: 'Company news (8 May 2026)' } },
  /* スターラックス航空（2025年の年次報告書・採用サイト） */
  'starlux.benefits.medical': { h: '6ee9b3e010ee03f1', label: '保険', value: '団体保険と健康診断', cond: '2025年の年次報告書（全社員）', en: { label: 'Insurance', value: 'Group insurance and health checks', cond: '2025 annual report (all employees)' } },
  'starlux.benefits.missing-annual-leave': { h: '636a9d60032a95e9', label: '休暇', value: '有給休暇と祝日の休み', cond: '採用サイトの職場の案内（全職種）', en: { label: 'Leave', value: 'Paid leave and public holidays off', cond: 'Workplace guide on the recruitment site (all roles)' } },
  'starlux.benefits.pension': { h: 'd9354066e89570d5', label: '年金', value: '法定の年金の積立', cond: '2025年の年次報告書（全社員）', en: { label: 'Pension', value: 'Statutory pension contributions', cond: '2025 annual report (all employees)' } },
  'starlux.benefits.staff-travel': { h: '61320ff6dac86577', label: '社員の航空券', value: '勤めて6か月から、無料と割引の航空券', cond: '2025年の年次報告書（全社員）', en: { label: 'Staff travel', value: 'Free and discounted tickets after 6 months of service', cond: '2025 annual report (all employees)' } },
  'starlux.jobs.followup-agent-f26-cadet-job-city': { h: '757f8bdb50e72dcf', label: '勤務地（訓練生の採用）', value: '桃園', cond: '訓練生の求人', en: { label: 'Base (cadet hiring)', value: 'Taoyuan', cond: 'Cadet vacancy' } },
  'starlux.jobs.followup-agent-f26-cpl-job-city': { h: '77b68a9c5b8d893d', label: '勤務地（事業用操縦士の資格を持つ人の採用）', value: '台北', cond: '事業用操縦士の資格を持つ人の求人', en: { label: 'Base (commercial license holders)', value: 'Taipei', cond: 'Vacancy for commercial pilot license holders' } },
  'starlux.jobs.followup-agent-f26-experienced-flighttime': { h: '225764b053a601a8', label: '応募に要る飛行時間', value: '機長は総飛行3,500時間（うち機長として700時間）、副操縦士は1,500時間（外国の人）・1,000時間（国内の人）', cond: '経験者の機長・副操縦士の募集', en: { label: 'Flight hours required', value: 'Captains: 3,500 hours total (700 hours PIC); first officers: 1,500 hours (foreign nationals) or 1,000 hours (Taiwanese nationals)', cond: 'Recruitment of experienced captains and first officers' } },
  'starlux.jobs.missing-entry-open': { h: '83e5b7a4ada1b584', label: '募集の受付', value: '事業用操縦士の資格を持つ人の採用は、いつでも応募できる', cond: '事業用操縦士の資格を持つ人の採用の案内', en: { label: 'Applications', value: 'Commercial pilot license holders can apply at any time', cond: 'Hiring guide for commercial pilot license holders' } },
  'starlux.work.p26-cadet-training': { h: '4d29ccf109a1ad24', label: '訓練の場所', value: '米国かオーストラリア', cond: '訓練生（Cadet）の採用の案内', en: { label: 'Training location', value: 'United States or Australia', cond: 'Cadet hiring guide' } },
  /* チャイナエアライン（会社のCSRの職場の案内・2026年の機師募集の発表） */
  'china-airlines.benefits.missing-annual-leave': { h: 'f0911e48afd449d9', label: '休暇', value: '特別休暇の制度', cond: '会社のCSRの職場の案内（全社員）', en: { label: 'Leave', value: 'Special leave scheme', cond: 'The company’s CSR workplace guide (all employees)' } },
  'china-airlines.benefits.missing-commuting': { h: 'ad03a540cd93300b', label: '通勤', value: '通勤の交通の制度', cond: '会社のCSRの職場の案内（全社員）', en: { label: 'Commuting', value: 'Commuting transport scheme', cond: 'The company’s CSR workplace guide (all employees)' } },
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
  'air-china.jobs.followup-agent-cadet-assignment-after-study': { h: '5066727c1873a57d', label: '卒業のあとの配属', value: '飛行の条件を満たした人を、本社か支社・子会社に配属', cond: '2026年の飛行学生の募集要項（2025年11月4日）', en: { label: 'Assignment after graduation', value: 'Graduates who meet the flight requirements are posted to the head office, a branch or a subsidiary', cond: '2026 flight student job posting (4 November 2025)' } },
  'air-china.work.p26-schools': { h: '5fce05084cbecfcc', label: '養成の大学', value: '北京航空航天大学・南京航空航天大学・中国民用航空飛行学院・中国民航大学', cond: '2026年の飛行学生の募集要項（2025年11月4日）', en: { label: 'Training universities', value: 'Beihang University, Nanjing University of Aeronautics and Astronautics, Civil Aviation Flight University of China and Civil Aviation University of China', cond: '2026 flight student job posting (4 November 2025)' } },
  /* 中国東方航空（第二期の飛行人材の募集・会社概要） */
  'china-eastern.jobs.missing-entry-open': { h: '74e5310d176f0400', label: '募集の受付', value: '2026年9月28日から12月31日 23時59分（中国の時刻）まで', cond: '大学卒業者の飛行人材の募集（第二期）', en: { label: 'Applications', value: '28 September 2026 to 23:59 on 31 December (China time)', cond: 'Pilot recruitment for university graduates (second round)' } },
  'china-eastern.profile.alliance': { h: '15204ba65b8789ad', label: '航空連合', value: 'スカイチーム', en: { label: 'Alliance', value: 'SkyTeam' } },
  'china-eastern.work.p26-training': { h: '5075261b73338412', label: '訓練の場所', value: '国内の飛行学校か海外の飛行学校', cond: '大学卒業者の飛行人材の募集（第二期）', en: { label: 'Training location', value: 'Flight schools in China or abroad', cond: 'Pilot recruitment for university graduates (second round)' } },
  /* 中国南方航空（2024年の社会責任報告書・深圳支社の調達の公告） */
  'china-southern.benefits.missing-annual-leave': { h: '15534a98da76079a', label: '休暇', value: '有給休暇・帰省の休暇・誕生日の休暇', cond: '2024年の社会責任報告書（全社員）', en: { label: 'Leave', value: 'Paid leave, home leave and birthday leave', cond: '2024 social responsibility report (all employees)' } },
  'china-southern.benefits.missing-medical': { h: '09eb42bc3e4a7f64', label: '保険', value: '基本と補充の医療保険、乗務員の傷害保険、パイロットの保険', cond: '2024年の社会責任報告書', en: { label: 'Insurance', value: 'Basic and supplementary medical insurance, crew accident insurance and pilot insurance', cond: '2024 social responsibility report' } },
  'china-southern.benefits.missing-pension': { h: '07ef8618865b6e14', label: '年金', value: '基本の養老保険と企業年金', cond: '2024年の社会責任報告書（全社員）', en: { label: 'Pension', value: 'Basic pension insurance and an enterprise annuity', cond: '2024 social responsibility report (all employees)' } },
  'china-southern.benefits.r2-crew-bus-szx-procurement': { h: '8bd4e96b8a8c6528', label: '乗務員の送迎バス', value: '深圳の市内の停留所から空港のターミナルまで', cond: '深圳支社のバスの調達の公告（2026年3月6日）', en: { label: 'Crew shuttle bus', value: 'From stops in Shenzhen city to the airport terminal', cond: 'Shenzhen branch bus procurement notice (6 March 2026)' } },
  /* 海南航空（2025年の持続可能性報告書） */
  'hainan-airlines.benefits.missing-medical': { h: '001083aa43213e5e', label: '保険', value: '社員の補充の医療保険と、家族の医療費の補助', cond: '2025年の持続可能性報告書（グループ全体）', en: { label: 'Insurance', value: 'Supplementary medical insurance for employees and help with family medical costs', cond: '2025 sustainability report (the whole group)' } },
  'hainan-airlines.benefits.missing-staff-travel': { h: 'c03b757fa03c7364', label: '社員の航空券', value: '社員の割引の航空券と、乗務員・海外に派遣された社員などの帰省の航空券', cond: '2025年の持続可能性報告書（グループ全体）', en: { label: 'Staff travel', value: 'Discounted tickets for employees, and home-leave tickets for crew and staff posted abroad', cond: '2025 sustainability report (the whole group)' } },
  /* エア・インディア（パイロットの採用案内・訓練生の募集） */
  'air-india.benefits.c26-relocation': { h: 'bdf7f03e923b9725', label: '引っ越しの支援', value: '家財の運送・ホテル・子どもの入学の支援と、1回の転居手当', cond: 'パイロットの採用案内', en: { label: 'Relocation support', value: 'Help with moving household goods, hotels and school places for children, plus a one-off relocation allowance', cond: 'Pilot recruitment guide' } },
  'air-india.benefits.medical': { h: '6f9db1242cfcd1b6', label: '保険', value: '医療保険・ライセンスを失ったときの保障・団体生命保険・傷害の保障', cond: 'パイロットの採用案内', en: { label: 'Insurance', value: 'Medical insurance, loss-of-license cover, group life insurance and accident cover', cond: 'Pilot recruitment guide' } },
  'air-india.benefits.travel': { h: 'efbcb1f9f8884b02', label: '社員の航空券', value: '年に1回の航空券と、回数の制限のない優待の航空券', cond: 'パイロットの採用案内', en: { label: 'Staff travel', value: 'One ticket a year, plus unlimited discounted tickets', cond: 'Pilot recruitment guide' } },
  'air-india.jobs.missing-entry-open': { h: '2ad27d34039fe5af', label: '募集の受付', value: '訓練生の募集のページは次の案内を待つ表示（日程は出ていない）', cond: '訓練生の募集のページ', en: { label: 'Applications', value: 'The cadet recruitment page asks applicants to wait for the next announcement (no dates given)', cond: 'Cadet recruitment page' } },
  'air-india.work.c26-cadet-school': { h: 'eaf8019d55e158d3', label: '事業用操縦士の訓練の場所', value: 'アムラバティ（インド）の自社の飛行学校か、米国の提携校2校', cond: '訓練生の募集のページ', en: { label: 'CPL training location', value: 'The company’s own flying school in Amravati (India) or two partner schools in the United States', cond: 'Cadet recruitment page' } },
  'air-india.work.p26-cadet-locations': { h: '33077bf218b7b5a8', label: '飛行訓練の提携校', value: 'フェニックス（AeroGuard）・サンフォード（L3Harris）。地上の訓練はインド', cond: '訓練生のコースの案内', en: { label: 'Partner flight schools', value: 'Phoenix (AeroGuard) and Sanford (L3Harris); ground training in India', cond: 'Cadet course guide' } },
  /* エアアジア（グループの採用案内） */
  'airasia.benefits.c26-group-travel': { h: '322814d07c50ffb3', label: '社員の航空券', value: '本人・家族・友人の無料と割引の航空券（会社によって違う）', cond: 'グループの採用案内（全職種）', en: { label: 'Staff travel', value: 'Free and discounted tickets for the employee, family and friends (varies by company)', cond: 'Group recruitment guide (all roles)' } },
  /* バンブー・エアウェイズ（2025年のA320パイロットの求人・2026年の訓練の覚書） */
  'bamboo-airways.jobs.c26-a320-qualification': { h: '43f209db718d1f53', label: '機長の応募の条件', value: '総飛行4,500時間以上（うちA320で1,500時間）、多人数機の機長1,500時間以上（うちA320で500時間）、定期運送用操縦士', cond: '2025年のA320機長の求人', en: { label: 'Captain requirements', value: '4,500 hours total (1,500 on the A320), 1,500 hours PIC on multi-crew aircraft (500 on the A320), ATPL', cond: '2025 A320 captain vacancy' } },
  'bamboo-airways.jobs.location': { h: 'd055d42380a164e1', label: '勤務地', value: 'ハノイ（ノイバイ空港）', cond: '2025年のA320パイロットの求人', en: { label: 'Base', value: 'Hanoi (Noi Bai Airport)', cond: '2025 A320 pilot vacancy' } },
  'bamboo-airways.jobs.missing-entry-open': { h: 'c74312b4d6250a39', label: '募集の受付', value: '2025年10月1日〜15日（締め切った）', cond: '2025年のA320機長の求人', en: { label: 'Applications', value: '1–15 October 2025 (closed)', cond: '2025 A320 captain vacancy' } },
  'bamboo-airways.work.p26-mpl-plan': { h: '65ad63b61bca27f7', label: '訓練の計画', value: 'BAA Training Vietnam と協力し、MPLの訓練の大部分をベトナムで行う予定', cond: '会社の発表（2026年の覚書）。次の募集は当局の承認のあと', en: { label: 'Training plan', value: 'Plans to run most MPL training in Vietnam with BAA Training Vietnam', cond: 'Company announcement (2026 MoU). The next intake follows regulatory approval' } },
  /* ガルーダ・インドネシア航空（2025年の年次報告書・採用サイト） */
  'garuda-indonesia.benefits.c26-pilot-retirement': { h: 'f6703106e7108a66', label: '退職の給付', value: '操縦士の退職時の給付の制度', cond: '2025年の年次報告書', en: { label: 'Retirement benefit', value: 'A retirement benefit scheme for pilots', cond: '2025 annual report' } },
  'garuda-indonesia.jobs.followup-agent-public-jobs-snapshot': { h: 'a95f557cd11c5185', label: '募集の受付', value: '会社の求人の一覧に、いま空いている求人は無い', cond: '会社の採用サイトの一覧（2026年10月19日に確認）', en: { label: 'Applications', value: 'No open vacancies on the company’s job list at present', cond: 'The company’s recruitment site list (checked 19 October 2026)' } },
  /* 香港エクスプレス（パイロットの採用案内・セカンドオフィサーの求人） */
  'hong-kong-express.benefits.c26-relocation': { h: 'c88e05f8bc80c804', label: '引っ越しの支援', value: '転居の支援', cond: 'パイロットの採用案内', en: { label: 'Relocation support', value: 'Relocation support', cond: 'Pilot recruitment guide' } },
  'hong-kong-express.benefits.medical': { h: '081047822fd7fbcd', label: '保険', value: '医療保険', cond: 'パイロットの採用案内', en: { label: 'Insurance', value: 'Medical insurance', cond: 'Pilot recruitment guide' } },
  'hong-kong-express.benefits.travel': { h: '779ecfa1750305f3', label: '社員の航空券', value: '自社・キャセイパシフィック航空・提携会社の便の優待', cond: 'パイロットの採用案内', en: { label: 'Staff travel', value: 'Discounted travel on the company’s, Cathay Pacific’s and partners’ flights', cond: 'Pilot recruitment guide' } },
  'hong-kong-express.jobs.followup-agent-f26-secondofficer-job-city': { h: '4bc6e1ec0899b749', label: '勤務地', value: '香港', cond: 'セカンドオフィサーの求人（2025年9月3日に掲載）', en: { label: 'Base', value: 'Hong Kong', cond: 'Second officer vacancy (posted 3 September 2025)' } },
  'hong-kong-express.jobs.missing-entry-open': { h: '98afa8b043a6421a', label: '募集の受付', value: 'セカンドオフィサーの求人を掲載中（締切の日付は無い）', cond: '会社の求人（2025年9月3日に掲載）', en: { label: 'Applications', value: 'A second officer vacancy is posted (no closing date)', cond: 'The company’s vacancy (posted 3 September 2025)' } },
  'hong-kong-express.jobs.p26-so-qual': { h: '5e4ef5c02bcb57de', label: '応募の条件', value: '多発機の事業用操縦士と計器飛行の資格（250時間以上）か、認められた一貫コースの事業用操縦士。第1種の身体検査', cond: 'セカンドオフィサーの求人', en: { label: 'Requirements', value: 'CPL with multi-engine instrument rating (250 hours or more), or a CPL from an approved integrated course; Class 1 medical', cond: 'Second officer vacancy' } },
  /* インディゴ（会社の職場の案内） */
  'indigo.benefits.c26-staff-standby': { h: '8f4dce4d9d003b9d', label: '社員の航空券', value: '自社の国内線・国際線の割引の空席待ちの券（回数の制限なし）', cond: '会社の職場の案内（全社員）', en: { label: 'Staff travel', value: 'Discounted standby tickets on the company’s domestic and international flights (no limit on trips)', cond: 'The company’s workplace guide (all employees)' } },
  'indigo.benefits.medical': { h: '2beadf5d923304e6', label: '保険', value: '医療保険（本人と家族）', cond: '会社の職場の案内（全社員）', en: { label: 'Insurance', value: 'Medical insurance (the employee and family)', cond: 'The company’s workplace guide (all employees)' } },
  'indigo.jobs.pilot-family': { h: '31ec903196fd96b3', label: '社員の家族の採用の道', value: '社員の近親者で、事業用操縦士の資格と型式の限定を持つ人の採用（FamilyFLY）', cond: '会社の職場の案内', en: { label: 'Pathway for employees’ relatives', value: 'Hiring of employees’ close relatives who hold a commercial license and a type rating (FamilyFLY)', cond: 'The company’s workplace guide' } },
  'indigo.jobs.pilot-internal': { h: '314b67baa1027d09', label: '社員からパイロットへの道', value: '社内の選考で、副操縦士の候補・訓練生を目指す制度（Fly High）', cond: '会社の職場の案内', en: { label: 'Pathway from staff to pilot', value: 'Internal selection for employees to become first officer candidates or cadets (Fly High)', cond: 'The company’s workplace guide' } },
  /* マレーシア航空（グループの採用ページ） */
  'malaysia-airlines.jobs.c26-application-channel': { h: '74b3e2cbd96f0bdc', label: '応募の方法', value: 'オンラインだけ（求人の検索から職種を選ぶ。求人の無い応募は受け付けない）', cond: 'グループの採用ページ', en: { label: 'How to apply', value: 'Online only (choose a role from the job search; applications without a vacancy are not accepted)', cond: 'Group recruitment page' } },
  /* フィリピン航空（採用サイト・社内誌・会社の発表） */
  'philippine-airlines.jobs.followup-agent-pilot-cabin-portal-snapshot': { h: '14332111fca9f984', label: '募集の受付', value: '採用サイトの「パイロットと客室乗務員」の分類に、いま空いている求人は無い', cond: '会社の採用サイト（2026年10月19日に確認）', en: { label: 'Applications', value: 'No open vacancies in the “Pilots and cabin crew” category of the recruitment site at present', cond: 'The company’s recruitment site (checked 19 October 2026)' } },
  'philippine-airlines.jobs.p26-ao2026-students': { h: '48fb57bdc029eca0', label: '訓練生の人数（2026年Aクラス）', value: '21人', cond: '社内誌 The PALiner', en: { label: 'Cadets (2026 Class A)', value: '21', cond: 'Company magazine The PALiner' } },
  'philippine-airlines.work.p26-ao2026-location': { h: 'cc6813e95eae2456', label: '訓練の場所', value: 'オーストラリア クイーンズランド州アーチャーフィールドの Airways Aviation の施設（18か月の課程）', cond: '社内誌 The PALiner（2026年Aクラス）', en: { label: 'Training location', value: 'Airways Aviation facilities at Archerfield, Queensland, Australia (an 18-month course)', cond: 'Company magazine The PALiner (2026 Class A)' } },
  'philippine-airlines.work.training-location': { h: '5fa24ee76a8dcac5', label: '訓練の流れ', value: 'フィリピンで基礎の課程、そのあとオーストラリアの施設', cond: '会社の発表（2025年8月1日・飛行学校の再開）', en: { label: 'Training path', value: 'Basic course in the Philippines, then training at facilities in Australia', cond: 'Company announcement (1 August 2025, the flying school reopening)' } },
  /* スクート（B787機長（経験者）の募集） */
  'scoot.work.r2d-b787-type-training-bond': { h: 'cb074c0aff4c8d57', label: '型式の訓練の費用', value: '会社が型式の訓練を行う人は、費用の一部を負担し、訓練の拘束（ボンド）を結ぶ', cond: 'B787機長（経験者）の募集（2026年4月30日）', en: { label: 'Type rating cost', value: 'Pilots type-rated by the company pay part of the cost and sign a training bond', cond: 'Experienced B787 captain recruitment (30 April 2026)' } },
  'scoot.work.r2d-b787-variable-roster': { h: '75211335199c1ba0', label: '勤務の形', value: '決まった型の無い勤務表（会社と規則の要件で組む）', cond: 'B787機長（経験者）の募集（2026年4月30日）', en: { label: 'Roster', value: 'Variable roster with no fixed pattern, built around company and regulatory requirements', cond: 'Experienced B787 captain recruitment (30 April 2026)' } },
  /* ベトジェット（採用サイト） */
  'vietjet.jobs.c26-past-careerday': { h: 'df4d9cf08ea678af', label: '採用イベントの募集', value: 'A320・A321の機長・副操縦士（2025年2月14日〜17日の受付）', cond: '会社の求人（2025年のパイロットの採用イベント）', en: { label: 'Recruitment event', value: 'A320 and A321 captains and first officers (applications 14–17 February 2025)', cond: 'The company’s vacancy (2025 pilot recruitment event)' } },
  'vietjet.jobs.followup-agent-pilot-category-snapshot': { h: 'c52ed3201b5ac1a2', label: '募集の受付', value: '採用サイトのパイロットの分類に、いま求人は無い', cond: '会社の採用サイト（2026年10月19日に確認）', en: { label: 'Applications', value: 'No vacancies in the pilot category of the recruitment site at present', cond: 'The company’s recruitment site (checked 19 October 2026)' } },
  /* ベトナム航空（2025年の年次報告書・2019年の記事） */
  'vietnam-airlines.benefits.c26-supplemental-retirement': { h: 'd54fda182680498b', label: '年金', value: '2020年から止めていた補完の退職保険への加入を再開', cond: '2025年の年次報告書（全社員）', en: { label: 'Pension', value: 'Resumed the supplementary retirement insurance that had been suspended since 2020', cond: '2025 annual report (all employees)' } },
  'vietnam-airlines.benefits.historical-travel': { h: '8fe628f9e2fb92c5', label: '社員の航空券', value: '自社のID券と、スカイチームの他社の便', cond: '2019年の会社の記事（パイロットの新しい給与の制度）', en: { label: 'Staff travel', value: 'The company’s ID tickets, plus travel on other SkyTeam airlines', cond: '2019 company article (the new pilot pay scheme)' } },
  /* ロイヤルブルネイ航空（A320機長の求人・会社の連絡先） */
  'royal-brunei.base.c26-base': { h: '5ec450ce4e30a428', label: '拠点', value: 'バンダルスリブガワン', cond: 'A320機長の求人', en: { label: 'Base', value: 'Bandar Seri Begawan', cond: 'A320 captain vacancy' } },
  'royal-brunei.benefits.housing': { h: '57ebd1360d625628', label: '住宅の補助', value: '住宅手当', cond: 'A320機長の求人', en: { label: 'Housing allowance', value: 'Housing allowance', cond: 'A320 captain vacancy' } },
  'royal-brunei.benefits.medical': { h: '8c5c90af319567e7', label: '医療の補助', value: '外来の医療費の請求', cond: 'A320機長の求人', en: { label: 'Medical allowance', value: 'Claims for outpatient medical costs', cond: 'A320 captain vacancy' } },
  'royal-brunei.benefits.travel': { h: 'b3c5aa52eaa89f23', label: '社員の航空券', value: '自社の就航地へのビジネスクラスの航空券', cond: 'A320機長の求人', en: { label: 'Staff travel', value: 'Business-class tickets to the company’s destinations', cond: 'A320 captain vacancy' } },
  'royal-brunei.jobs.missing-entry-open': { h: '7722bfc21a2f6217', label: '募集の受付', value: '2026年に入社できるA320機長を募集（すぐに入社できる人が有利）', cond: 'A320機長の求人', en: { label: 'Applications', value: 'Hiring A320 captains able to join in 2026 (immediate availability preferred)', cond: 'A320 captain vacancy' } },
  'royal-brunei.profile.missing-headquarters-country': { h: '88044241f129f6ae', label: '本社', value: 'ブルネイ', en: { label: 'Headquarters', value: 'Brunei' } },
  'royal-brunei.work.c26-average-hours': { h: '2f62afb6bc50ece9', label: '機長の飛行時間', value: '月に平均60〜70時間', cond: 'A320機長の求人', en: { label: 'Captain flying hours', value: '60–70 hours a month on average', cond: 'A320 captain vacancy' } },
  'royal-brunei.work.c26-noncommuting': { h: '9e2d217415e900f5', label: '勤務の形', value: '拠点に住んで勤める形（遠くから通う形ではない）', cond: 'A320機長の求人', en: { label: 'Roster', value: 'Living in base (not a commuting contract)', cond: 'A320 captain vacancy' } },
  /* ── 全社へ広げる d1 の続き（2026-10-21）：中東・アフリカの会社（エティハド航空は先行5社）。同じ求人の同じことを言う2つめの行と、
     会社の機材の紹介の行で同じ型式が出ている復帰の行は字を書かない。エミレーツの訓練費の拘束の額は、サイトの通貨の表示を通す道がまだ無いので書かない ── */
  /* エミレーツ航空（副操縦士の給与と待遇の案内・パイロット採用のQ&A） */
  'emirates.benefits.housing-provided': { h: '0fe9281e04b2ff21', label: '住まい', value: '会社が用意する住まい（無料）', cond: '副操縦士の給与と待遇の案内', en: { label: 'Housing', value: 'Free company-provided accommodation', cond: 'First officer pay and benefits guide' } },
  'emirates.benefits.medical-family': { h: 'cc0359ff926bd240', label: '家族の医療', value: '本人と対象の家族（家族は月に少しの負担）', cond: 'パイロット採用のQ&A', en: { label: 'Family medical', value: 'The employee and eligible family (a small monthly contribution for family)', cond: 'Pilot recruitment Q&A' } },
  'emirates.benefits.provident-employee': { h: '4e3e2e75136cd63d', label: '積立の年金（本人）', value: '月の基本給の5%', cond: '副操縦士の給与と待遇の案内', en: { label: 'Provident fund (employee)', value: '5% of monthly basic salary', cond: 'First officer pay and benefits guide' } },
  'emirates.benefits.provident-employer': { h: '9ca7a0948e56bb7f', label: '積立の年金（会社）', value: '月の基本給の12%（最初の10年）', cond: '副操縦士の給与と待遇の案内', en: { label: 'Provident fund (company)', value: '12% of monthly basic salary (first 10 years)', cond: 'First officer pay and benefits guide' } },
  'emirates.benefits.provident-later': { h: '805ac83b270aad61', label: '積立の年金（会社・勤続10年から）', value: '月の基本給の15%', cond: 'パイロット採用のQ&A', en: { label: 'Provident fund (company, from 10 years of service)', value: '15% of monthly basic salary', cond: 'Pilot recruitment Q&A' } },
  'emirates.benefits.resume-provident-vesting': { h: 'ad69f6906f2f4137', label: '会社の積立の受け取り', value: '加入3年以上5年未満で75%、5年で100%', cond: 'パイロット採用のQ&A', en: { label: 'Vesting of company contributions', value: '75% vested from 3 years of membership, 100% from 5 years', cond: 'Pilot recruitment Q&A' } },
  'emirates.benefits.staff-family': { h: '2d2dd317adeec714', label: '社員の航空券', value: '本人と家族に年1回、席の確約された休暇の往復の航空券と、優待の航空券', cond: 'パイロット採用のQ&A', en: { label: 'Staff travel', value: 'An annual confirmed return leave ticket for the employee and family, plus discounted travel', cond: 'Pilot recruitment Q&A' } },
  'emirates.benefits.transport-provided': { h: '0f318b895a8c499b', label: '通勤', value: '会社の送迎（ドバイの中）', cond: 'パイロット採用のQ&A', en: { label: 'Commuting', value: 'Company transport (within Dubai)', cond: 'Pilot recruitment Q&A' } },
  'emirates.work.roster-days-off': { h: 'e86dd1d142c058c3', label: '休日', value: '連続28日で7日以上、連続30日で8日以上（3つの期間の平均）', cond: 'パイロット採用のQ&A', en: { label: 'Days off', value: 'At least 7 in any 28 consecutive days and 8 in any 30 (averaged over three periods)', cond: 'Pilot recruitment Q&A' } },
  'emirates.work.training-city': { h: 'c8b7819889de4c2d', label: '訓練の場所', value: 'ドバイ', cond: 'パイロット採用のQ&A（入社の訓練）', en: { label: 'Training location', value: 'Dubai', cond: 'Pilot recruitment Q&A (induction training)' } },
  /* カタール航空（ボーイングの型式を持つ副操縦士の求人・訓練生の採用案内） */
  'qatar-airways.jobs.followup-boeing-jobcity': { h: 'db13a56e62f9616b', label: '勤務地', value: 'ドーハ', cond: 'ボーイングの型式を持つ副操縦士の求人', en: { label: 'Base', value: 'Doha', cond: 'Vacancy for first officers with a Boeing type rating' } },
  'qatar-airways.jobs.missing-entry-open': { h: 'a7aa74bde6cff272', label: '募集の受付', value: 'ボーイングの型式を持つ副操縦士を募集中（2027年1月31日締切）', cond: '会社の求人（2026年10月19日に確認）', en: { label: 'Applications', value: 'Hiring Boeing type-rated first officers (closes 31 January 2027)', cond: 'The company’s vacancy (checked 19 October 2026)' } },
  'qatar-airways.jobs.publication-boeing-fo-requirements': { h: 'e45fdb812aff2d7a', label: '応募の条件', value: '多人数で操縦するジェット旅客機で1,000時間以上（うち指定のボーイング機で500時間以上）、直近12か月にその型式で乗務、定期運送用操縦士の資格と計器飛行、第1種の身体検査', cond: 'ボーイングの型式を持つ副操縦士の求人', en: { label: 'Requirements', value: '1,000+ hours on multi-crew jet airliners (500+ on the specified Boeing types), current on type within the last 12 months, ATPL with instrument rating, Class 1 medical', cond: 'Vacancy for first officers with a Boeing type rating' } },
  'qatar-airways.work.r2-cadet-guarantor-repayment': { h: '4d83d0b401f7b15e', label: '奨学金の保証人', value: 'カタール国籍の保証人が要る。不合格・辞退・決まった勤務の前の退職では、奨学金の費用を返す', cond: 'カタール国籍の人の訓練生（Cadet）の奨学金の案内', en: { label: 'Scholarship guarantor', value: 'A Qatari guarantor is required. Scholarship costs are repaid on failure, withdrawal or resignation before completing the required service', cond: 'Scholarship guide for Qatari cadets' } },
  'qatar-airways.work.resume-cadet-service': { h: '1dff41f6cb6ddc3f', label: '勤続の約束', value: '副操縦士になってから5年以上', cond: '訓練生（Cadet）の採用の案内', en: { label: 'Service commitment', value: '5 years or more after becoming a first officer', cond: 'Cadet hiring guide' } },
  /* ガルフ・エア（A320の型式を持つ副操縦士の求人） */
  'gulf-air.benefits.missing-medical': { h: '0e6bb63c8b18a1e0', label: '保険', value: '本人と対象の家族の医療保険', cond: 'A320の型式を持つ副操縦士の求人（GF1972）', en: { label: 'Insurance', value: 'Medical insurance for the employee and eligible family', cond: 'Vacancy for first officers with an A320 type rating (GF1972)' } },
  'gulf-air.benefits.missing-staff-travel': { h: '48775484eb6a9b04', label: '社員の航空券', value: '旅行の優待', cond: 'A320の型式を持つ副操縦士の求人（GF1972）', en: { label: 'Staff travel', value: 'Travel concessions', cond: 'Vacancy for first officers with an A320 type rating (GF1972)' } },
  'gulf-air.jobs.followup-gf1972-hours': { h: 'b6349d0b6a4fac83', label: '応募に要る飛行時間', value: '総飛行1,500時間（うちA320で250時間・多人数のジェット機で500時間）か、総飛行700時間（うちA320で500時間）', cond: 'A320の型式を持つ副操縦士の求人（GF1972）', en: { label: 'Flight hours required', value: '1,500 hours total (250 on the A320 and 500 on multi-crew jets), or 700 hours total (500 on the A320)', cond: 'Vacancy for first officers with an A320 type rating (GF1972)' } },
  'gulf-air.jobs.missing-entry-open': { h: '98dd88ac25992497', label: '募集の受付', value: 'A320の型式を持つ副操縦士を募集中（2026年12月31日締切）', cond: '会社の求人（2026年10月19日に確認）', en: { label: 'Applications', value: 'Hiring A320 type-rated first officers (closes 31 December 2026)', cond: 'The company’s vacancy (checked 19 October 2026)' } },
  'gulf-air.jobs.publication-gf1853-history': { h: '848d00be3d30c1c3', label: '前の募集', value: 'A320の型式を持つ副操縦士（GF1853・2026年1月1日に締め切った）', cond: '会社の求人', en: { label: 'Previous vacancy', value: 'A320 type-rated first officers (GF1853, closed on 1 January 2026)', cond: 'The company’s vacancy' } },
  /* クウェート航空（会社の採用ページ） */
  'kuwait-airways.jobs.r2-openings-none': { h: 'ccf913ede5e78358', label: '募集の受付', value: '会社の採用の一覧に、いま空いている求人は無い', cond: '会社の採用ページ（2026年10月19日に確認）', en: { label: 'Applications', value: 'No open vacancies on the company’s recruitment list at present', cond: 'The company’s recruitment page (checked 19 October 2026)' } },
  /* オマーン航空（会社の採用ページ） */
  'oman-air.benefits.resume-medical-family': { h: 'd1edcc5d7abb50c6', label: '保険', value: '社員と家族の医療・生命・障害・視力の保険', cond: '会社の採用ページ（全社員）', en: { label: 'Insurance', value: 'Medical, life, disability and vision insurance for employees and family', cond: 'The company’s recruitment page (all employees)' } },
  'oman-air.benefits.resume-staff-travel': { h: '0a35d15b9d1d9bcb', label: '社員の航空券', value: '社員と家族の旅行の優待', cond: '会社の採用ページ（全社員）', en: { label: 'Staff travel', value: 'Travel concessions for employees and family', cond: 'The company’s recruitment page (all employees)' } },
  'oman-air.jobs.resume-pilot-pathways': { h: '9a3507c64fbcc3ee', label: '採用の道', value: '訓練生（Cadet）と、経験者の機長', cond: '会社の採用ページ', en: { label: 'Hiring routes', value: 'Cadets and experienced captains', cond: 'The company’s recruitment page' } },
  /* リヤド航空（B787の経験者の機長の求人） */
  'riyadh-air.jobs.missing-entry-open': { h: 'd9f8ea1fa645c833', label: '募集の受付', value: 'B787の経験者の機長を募集中', cond: '会社の求人（2026年10月19日に確認）', en: { label: 'Applications', value: 'Hiring experienced B787 captains', cond: 'The company’s vacancy (checked 19 October 2026)' } },
  'riyadh-air.jobs.resume-dec-minimum': { h: 'c6ff3ee1a296e18f', label: '機長の応募の条件', value: '多人数・多発機で6,000時間以上（うちワイドボディ機の機長で2,000時間）、直近12か月に機長で150時間', cond: 'B787の経験者の機長の求人', en: { label: 'Captain requirements', value: '6,000+ hours on multi-crew, multi-engine aircraft (2,000 as widebody PIC) and 150 hours PIC in the last 12 months', cond: 'Vacancy for experienced B787 captains' } },
  'riyadh-air.work.resume-dec-roster': { h: '6b87ee39bafe1d01', label: '機長の勤務の形', value: 'フルタイムのほか、条件を満たせば暮らしに合わせた勤務の組み方も選べる', cond: 'B787の経験者の機長の求人（リヤド拠点）', en: { label: 'Captain roster', value: 'Full time, or a lifestyle roster for those who meet the conditions', cond: 'Vacancy for experienced B787 captains (Riyadh base)' } },
  /* ロイヤル・ヨルダン航空（A320機長の求人・訓練生の採用案内） */
  'royal-jordanian.jobs.r3-a320-cap-open-5496790': { h: '36c1d6275eaeeb04', label: '募集の受付', value: 'A320の型式を持つ機長を募集中（2026年12月18日締切）', cond: '会社の求人（2026年10月19日に掲載）', en: { label: 'Applications', value: 'Hiring A320 type-rated captains (closes 18 December 2026)', cond: 'The company’s vacancy (posted 19 October 2026)' } },
  'royal-jordanian.jobs.resume-cadet-eligibility': { h: 'f77caa8badbaa543', label: '訓練生の応募の条件', value: 'ヨルダン国籍、事業用操縦士と計器飛行・定期運送用操縦士の学科・MCC', cond: '訓練生（Cadet）の採用の案内', en: { label: 'Cadet requirements', value: 'Jordanian nationality; CPL with instrument rating, ATPL theory and MCC', cond: 'Cadet hiring guide' } },
  'royal-jordanian.jobs.resume-campaign-timing': { h: '2f5663f114cda701', label: '訓練生の選考', value: '会社の必要に応じて、選考の回を取りやめたり日程を変えたりする', cond: '訓練生（Cadet）の採用の案内', en: { label: 'Cadet selection', value: 'The company may cancel or reschedule selection rounds as business needs require', cond: 'Cadet hiring guide' } },
  /* サウディア（訓練生の求人） */
  'saudia.jobs.cadet-hours': { h: 'da307ce490bf7b45', label: '訓練生の応募に要る飛行時間', value: '240時間以上（うち多発機で25時間）', cond: '訓練生（Cadet Program）の求人（2026年10月17日）', en: { label: 'Cadet flight hours required', value: '240 hours or more (25 on multi-engine aircraft)', cond: 'Cadet Program vacancy (17 October 2026)' } },
  'saudia.jobs.resume-cadet-now': { h: '860b9ca5da21a733', label: '募集の受付', value: '訓練生（Cadet Program）を募集中（サウジアラビア国籍の人だけ）', cond: '会社の求人（2026年10月17日に掲載）', en: { label: 'Applications', value: 'Hiring cadets (Cadet Program; Saudi nationals only)', cond: 'The company’s vacancy (posted 17 October 2026)' } },
  /* エジプト航空（訓練中のパイロットの求人・訓練施設の案内） */
  'egyptair.benefits.missing-commuting': { h: 'cecbe952ce8f9145', label: '通勤', value: '無料の送迎', cond: '訓練中のパイロットの求人（A-31/2026）', en: { label: 'Commuting', value: 'Free transport', cond: 'Vacancy for pilots in training (A-31/2026)' } },
  'egyptair.benefits.missing-medical': { h: '3d591c7d3e978b56', label: '保険', value: '本人と家族の医療保険', cond: '訓練中のパイロットの求人（A-31/2026）', en: { label: 'Insurance', value: 'Medical insurance for the employee and family', cond: 'Vacancy for pilots in training (A-31/2026)' } },
  'egyptair.jobs.followup-a31-qualification': { h: '32dfc155ffc12c40', label: '応募の条件', value: 'エジプト国籍、2026年8月30日に30歳以下、エジプト民間航空局が認める事業用操縦士か定期運送用操縦士、英語の能力（ICAO 5）', cond: '訓練中のパイロットの求人（A-31/2026）', en: { label: 'Requirements', value: 'Egyptian nationality, aged 30 or under on 30 August 2026, a CPL or ATPL recognized by the Egyptian Civil Aviation Authority, English proficiency (ICAO Level 5)', cond: 'Vacancy for pilots in training (A-31/2026)' } },
  'egyptair.jobs.missing-entry-open': { h: '8bbaedda444933cd', label: '募集の受付', value: '訓練中のパイロット（A-31/2026）を募集中（2026年11月1日締切）', cond: '会社の求人（2026年9月15日に掲載）', en: { label: 'Applications', value: 'Hiring pilots in training (A-31/2026; closes 1 November 2026)', cond: 'The company’s vacancy (posted 15 September 2026)' } },
  'egyptair.work.missing-training-location': { h: '051301f950ae39ba', label: '訓練の場所', value: 'カイロ国際空港の EGYPTAIR Training Academy', cond: '訓練施設の案内', en: { label: 'Training location', value: 'EGYPTAIR Training Academy at Cairo International Airport', cond: 'Training facility guide' } },
  /* エチオピア航空（外国人の機長の募集・訓練施設の案内） */
  'ethiopian-airlines.benefits.resume-annual-leave': { h: '2ac45b037baa17f7', label: '休暇', value: '有給の年次休暇', cond: '外国人の機長の募集', en: { label: 'Leave', value: 'Paid annual leave', cond: 'Recruitment of expatriate captains' } },
  'ethiopian-airlines.benefits.resume-bonus': { h: '4385c6ce18b1e297', label: '賞与', value: '年1回の賞与', cond: '外国人の機長の募集', en: { label: 'Bonus', value: 'An annual bonus', cond: 'Recruitment of expatriate captains' } },
  'ethiopian-airlines.benefits.resume-housing': { h: 'ddadfaf105a23822', label: '住宅の補助', value: '住宅手当', cond: '外国人の機長の募集', en: { label: 'Housing allowance', value: 'Housing allowance', cond: 'Recruitment of expatriate captains' } },
  'ethiopian-airlines.benefits.resume-insurance': { h: 'ddf84871cd310a46', label: '保険', value: '医療保険と傷害保険', cond: '外国人の機長の募集', en: { label: 'Insurance', value: 'Medical and accident insurance', cond: 'Recruitment of expatriate captains' } },
  'ethiopian-airlines.benefits.resume-tickets': { h: 'f8b61264b7d2915a', label: '社員の航空券', value: 'ビジネスクラスの航空券', cond: '外国人の機長の募集', en: { label: 'Staff travel', value: 'Business-class tickets', cond: 'Recruitment of expatriate captains' } },
  'ethiopian-airlines.benefits.resume-transport': { h: 'b874da8ec78338b5', label: '通勤', value: '無料の送迎', cond: '外国人の機長の募集', en: { label: 'Commuting', value: 'Free transport', cond: 'Recruitment of expatriate captains' } },
  'ethiopian-airlines.jobs.resume-captain-open': { h: '6157377566ce624e', label: '募集の受付', value: '外国人の機長を募集中（3つの機材のグループ）', cond: '会社の募集のページ', en: { label: 'Applications', value: 'Hiring expatriate captains (three fleet groups)', cond: 'The company’s recruitment page' } },
  'ethiopian-airlines.work.missing-training-location': { h: '6cee23024281fb5c', label: '訓練の場所', value: 'アディスアベバのボレ国際空港の Ethiopian Aviation Academy', cond: '訓練施設の案内', en: { label: 'Training location', value: 'Ethiopian Aviation Academy at Bole International Airport, Addis Ababa', cond: 'Training facility guide' } },
  /* ケニア航空（2024年の報告書） */
  'kenya-airways.benefits.publication-general-dc': { h: '6b3fea2f5933e002', label: '年金', value: '社員の積立の年金（確定拠出。正社員は加入）', cond: '2024年の報告書（全社員）', en: { label: 'Pension', value: 'Staff provident pension (defined contribution; permanent staff are members)', cond: '2024 report (all employees)' } },
  'kenya-airways.benefits.publication-general-medical': { h: 'c6b90ff974e1972f', label: '保険', value: '医療の制度と育児の休暇', cond: '2024年の報告書（全社員）', en: { label: 'Insurance', value: 'Medical scheme and parental leave', cond: '2024 report (all employees)' } },
  /* 南アフリカ航空（パイロット採用の案内） */
  'south-african-airways.jobs.resume-pilot-qualification': { h: '2a5e9ade9a5dc290', label: '応募の条件', value: '南アフリカの定期運送用操縦士（学科合格を含む）、多発機の計器飛行、第1種の身体検査、1,500時間以上（うち多発機で200時間）', cond: '会社のパイロット採用の案内', en: { label: 'Requirements', value: 'South African ATPL (or ATPL theory passes), multi-engine instrument rating, Class 1 medical, 1,500+ hours (200 on multi-engine aircraft)', cond: 'The company’s pilot recruitment guide' } },
  /* ── 全社へ広げる a3（2026-10-21・ROUND5 で入った行）：字は行の値と引用から（調べた側の字は使わない）。cond ＝ 誰の・どの資料の条件か。
     書かなかった行（出ない）：インディゴの業務の移動の手配（パイロットの管理担当の求人の職務の説明で、パイロットの待遇の公表ではない）・
     南アフリカ航空の航空券（2025年3月の会社の「最終提案」の説明 ── 結ばれた条件ではない）。ほかは資料の種類で出ない行
     （エチオピア航空の労働組合の告知・カンタスの組合の案内が先の行・スカイマークの採用会社の求人）── 書いても出ないので書かない ── */
  'airdo.benefits.r8-chitose-residence': { h: 'e860b2489393de0f', label: '居住地の制度', value: '千歳地区居住地制度', cond: 'B737機長要員の募集要項', en: { label: 'Residence scheme', value: 'Chitose-area residence scheme', cond: 'Job posting for B737 captain candidates' } },
  'fda.benefits.r10-jpc-fo-commute-existence': { h: '2eb5d9cbe52258cf', label: '通勤', value: '通勤手当', cond: '他社経験者の副操縦士候補の求人', en: { label: 'Commuting', value: 'Commuting allowance', cond: 'Vacancy for first officer candidates with experience at another airline' } },
  'jetstar-japan.benefits.r9-jpben-jcab-captain-staff-travel': { h: '706ca6dcbf3193b5', label: '社員の航空券', value: 'カンタス・グループのスタッフトラベルの割引（本人と、指定した同伴者）', cond: '日本の航空局の資格を持つ A320/A321 機長の求人（2025年4月7日の掲載）', en: { label: 'Staff travel', value: 'Qantas Group staff travel discounts (the employee and nominated travel companions)', cond: 'Vacancy for A320/A321 captains holding a JCAB license (posted 7 April 2025)' } },
  /* カンタスの待遇のカードの1行めは、今までどおり労働協約の年次休暇（パイロットの条件）。字は ITEM の言い方と協約の cond のまま（lead だけ） */
  'qantas.benefits.resume-sh-leave': { h: 'a995498e6f46de67', label: '年次休暇', lead: true, en: { label: 'Annual leave' } },
  'qantas.benefits.r10-permanent-employee-travel': { h: '882b7aeb6266f27f', label: '社員の航空券', value: '旅行の優待（本人と、指定した同伴者など）', cond: '2026年の年次報告（正社員ぜんたいの制度）', en: { label: 'Staff travel', value: 'Travel concessions (the employee, nominated travel companions and others)', cond: '2026 annual report (a scheme for all permanent employees)' } },
  'qantas.benefits.r8-redundancy-staff-travel': { h: 'aa9dde9dced278f3', label: '社員の航空券（人員整理のとき）', value: '会社のスタッフトラベルの規程による', cond: '短距離線のパイロットの労働協約（人員整理の条項）', en: { label: 'Staff travel (on redundancy)', value: 'Under the company’s staff travel policy', cond: 'Short-haul pilots’ collective agreement (redundancy clause)' } },
  'solaseed.benefits.r8-local-residence': { h: 'f8d55fb37c8abbd6', label: '居住地の制度', value: '地方居住制度', cond: '機長要員の募集要項', en: { label: 'Residence scheme', value: 'Regional residence scheme', cond: 'Job posting for captain candidates' } },
  /* ── 全社へ広げる d2（2026-10-22）：ヨーロッパ・アメリカ大陸・オセアニアの会社。字は行の値と引用から（調べた側の字は使わない）。
     cond ＝ 誰の・どの資料の条件か。英語の対は同じ行に（EN-2）。外国の通貨の額は書かない（サイトの通貨の切り替えを通らないため）。
     書かなかった行（出ない）：同じ資料の同じ中身の行（アラスカ航空 r10・ジェットブルー航空の古い四半期と同じ求人の2行め）・
     選考を受けるときの費用（オーストリア航空・ヴァージン）・求人の事務所の住所（エールフランス）・これから入る機材の計画（アビアンカ）・
     空港の3字でない拠点の行（オーストリア航空）・労働協約のポルトの基地の条項（TAP ── 拠点がポルトだけと読める） ── */
  /* ユナイテッド航空 */
  /* 同じ話（保険）を労働協約の行（united.benefits.missing-medical）が言うので、そちらが出ているあいだは出さない（2026-10-23） */
  'united.benefits.resume-pilot-health': { h: '97012361f5f32cff', label: '保険', value: '医療・歯科・眼科・生命・事故・障害の保険', cond: '副操縦士の採用ページ（United Pilot Agreement による）', same: 'united.benefits.missing-medical', en: { label: 'Insurance', value: 'Medical, dental, vision, life, accident and disability insurance', cond: 'First officer recruitment page (under the United Pilot Agreement)' } },
  'united.benefits.travel': { h: '39ee0dc890014b50', label: '社員の航空券', value: '航空券の特典', cond: '副操縦士の採用ページ（United Pilot Agreement による）', en: { label: 'Staff travel', value: 'Travel privileges', cond: 'First officer recruitment page (under the United Pilot Agreement)' } },
  'united.jobs.entry-ongoing': { h: '4d640e17bf73f72f', label: '募集の受付', value: '副操縦士を通年で募集（締切の日付は無い）', cond: '副操縦士の採用ページ', en: { label: 'Applications', value: 'Hiring first officers on a rolling basis (no closing date)', cond: 'First officer recruitment page' } },
  'united.jobs.total-time-min': { h: '7ff05434cd7575c1', label: '応募の条件', value: '総飛行時間1,500時間以上', cond: '副操縦士の採用ページ', en: { label: 'Requirements', value: 'At least 1,500 hours total time', cond: 'First officer recruitment page' } },
  'united.work.training-denver': { h: 'd3bceaed827f46ec', label: '訓練の場所', value: 'デンバーの Flight Training Center', cond: '副操縦士の採用ページ', en: { label: 'Training locations', value: 'Flight Training Center in Denver', cond: 'First officer recruitment page' } },
  /* デルタ航空 */
  'delta.benefits.publication-newhire-hotel': { h: '0fd412c2a6f3a143', label: '訓練の間の宿泊（新人）', value: '会社負担のホテル（制服も会社が用意）', cond: 'パイロットの採用のQ&A', en: { label: 'Hotel during training (new hires)', value: 'A company-paid hotel (uniforms are also provided)', cond: 'Pilot recruitment FAQs' } },
  'delta.benefits.resume-general-travel': { h: '23477d774365b96f', label: '社員の航空券', value: '回数の制限の無い空席待ちと、確定席の割引', cond: '社員ぜんたいの特典の案内', en: { label: 'Staff travel', value: 'Unlimited standby travel and discounted confirmed fares', cond: 'Benefits overview for all employees' } },
  'delta.benefits.retirement': { h: '6826978abe85f16b', label: '年金', value: '401(k) の拠出', cond: 'パイロットの採用ページ', en: { label: 'Pension', value: '401(k) contributions', cond: 'Pilot recruitment page' } },
  /* ★2026-11-03 オーナー「どういう条件でこの値段なのかもよくわからない」── 額だけで出ていた行に、誰の・何の額かを書き添える */
  'delta.benefits.parking-reimbursement': { h: 'a10087488e9b77f3', label: '駐車費の払い戻し', money: true, cond: '会社の駐車場がある拠点から80マイルより遠くに住むパイロット（パイロットの採用のQ&A）', en: { label: 'Parking reimbursement', cond: 'For pilots living more than 80 miles from a base with company parking (pilot hiring FAQ)' } },
  'delta.work.resume-slc-training': { h: '835444eed1e023c8', label: '訓練の場所', value: 'ソルトレイクシティ国際空港の近くのパイロットの訓練施設（2024年12月に開所）', cond: '会社の発表（2024年12月4日）', en: { label: 'Training locations', value: 'A pilot training facility near Salt Lake City International Airport (opened December 2024)', cond: 'Company announcement (4 December 2024)' } },
  /* アメリカン航空 */
  'american.benefits.r10-pilot-commuter-pretax': { h: '689d6e3f6a63a860', label: '通勤', value: '通勤の公共交通の費用に使える、税引き前の給与からの積み立て（本人の拠出）', cond: 'パイロット向けの福利厚生のページ', en: { label: 'Commuting', value: 'Pre-tax payroll deductions (your own money) for public transport commuting costs', cond: 'Pilots’ benefits pages' } },
  'american.benefits.r10-pilot-travel-existence': { h: '41816be5d2c483be', label: '社員の航空券', value: '社員と家族などの航空券の特典（細かい条件は別の資料）', cond: 'パイロット向けの福利厚生のページ', en: { label: 'Staff travel', value: 'Travel privileges for eligible employees and family (details are in a separate document)', cond: 'Pilots’ benefits pages' } },
  'american.work.training-dfw-clt': { h: 'f9243d02903125d8', label: '訓練の場所', value: 'ダラス・フォートワース（DFW Flight Academy）とシャーロット（CLT Training Center）', cond: '会社の概要', en: { label: 'Training locations', value: 'Dallas/Fort Worth (DFW Flight Academy) and Charlotte (CLT Training Center)', cond: 'Company overview' } },
  /* サウスウエスト航空 */
  'southwest.benefits.missing-medical': { h: '941d18abab494770', label: '保険', value: '入社の日から、本人と家族の医療・歯科・生命保険', cond: 'パイロットの採用ページ', en: { label: 'Insurance', value: 'Medical, dental and life insurance for you and eligible dependants from day one', cond: 'Pilot recruitment page' } },
  'southwest.benefits.missing-staff-travel': { h: '5dbfde5a02ff855d', label: '社員の航空券', value: '入社の日から本人と家族が対象。他社の操縦室の補助席に乗れる取り決めもある', cond: 'パイロットの採用ページ', en: { label: 'Staff travel', value: 'Travel benefits for you and eligible dependants from day one, plus jumpseat agreements with other airlines', cond: 'Pilot recruitment page' } },
  'southwest.benefits.resume-pilot-parking': { h: '132254f8b153029c', label: '駐車場', value: '指定の社員駐車場は会社負担（ほかの駐車場は年の上限まで払い戻し）', cond: 'パイロットの採用ページ', en: { label: 'Parking', value: 'Designated employee parking is paid by the company (other parking is reimbursed up to a yearly cap)', cond: 'Pilot recruitment page' } },
  'southwest.benefits.retirement-2026': { h: 'c8131d5560f29b45', label: '年金', value: '会社の拠出18%と、市場に連動するキャッシュバランス2%（2026年）', cond: 'パイロットの採用ページ', en: { label: 'Pension', value: '18% company contributions plus a 2% market-based cash balance (2026)', cond: 'Pilot recruitment page' } },
  'southwest.jobs.entry-closed': { h: 'c112e24dbd384495', label: '募集の受付', value: '副操縦士の受付はいま締め切っている（2026年10月19日に確認）', cond: 'パイロットの採用ページ', en: { label: 'Applications', value: 'First officer applications are currently closed (checked 19 October 2026)', cond: 'Pilot recruitment page' } },
  'southwest.work.resume-roster-flex': { h: '397a452c1f6e8200', label: '勤務の希望', value: '勤務表を見てから希望を出す方式（PBS ではない）。乗務の交換ができる', cond: 'パイロットの採用ページ', en: { label: 'Schedule bidding', value: 'You see the schedule before you bid (no PBS), and trips can be traded', cond: 'Pilot recruitment page' } },
  'southwest.work.training-dallas': { h: 'b040032d3f383ba3', label: '訓練の場所', value: 'ダラスの LEAD Center（初期の訓練）', cond: 'パイロットの採用ページ', en: { label: 'Training locations', value: 'LEAD Center in Dallas (initial training)', cond: 'Pilot recruitment page' } },
  /* KLMオランダ航空 */
  'klm.benefits.c-isa-discounts': { h: '022ba696b33e4afb', label: '社員の航空券', value: '社員向けの航空券（ISA）と、ホテル・レンタカーの割引', cond: 'パイロットの採用案内（雇用の条件）', en: { label: 'Staff travel', value: 'Staff tickets (ISA) and hotel and car-rental discounts', cond: 'Pilot recruitment guide (employment conditions)' } },
  'klm.benefits.pub-kfa-campus-housing': { h: '7e43b98796407bd5', label: '訓練生の住まい', value: 'エールデの訓練校の部屋を借りられる（費用は訓練費の融資に含められる）', cond: 'KLM フライトアカデミーの案内。無料の社宅ではない', en: { label: 'Cadet accommodation', value: 'Rooms can be rented on the Eelde campus (the cost can be included in the training loan)', cond: 'KLM Flight Academy guide. Not free company housing' } },
  'klm.benefits.r8-cockpit-parking-local-ov': { h: '2b801d5b50c21013', label: '通勤', value: 'スキポール空港の駐車カード（自己負担あり）と、空港と周辺の公共交通の無料利用', cond: 'パイロット（コックピット）向けの採用ページ', lead: true, en: { label: 'Commuting', value: 'A Schiphol parking card (with a personal contribution) and free use of public transport at and around the airport', cond: 'Recruitment page for pilots (cockpit)' } },
  'klm.work.pub-kfa-deduction2026': { h: 'c0421ae04ae39fda', label: '訓練費の返済（訓練生）', value: '入社後10年間、給与から月々差し引く方式か、一括での返済を選ぶ', cond: 'KLM フライトアカデミーの費用と融資の案内（2026年）', en: { label: 'Training cost repayment (cadets)', value: 'Monthly deductions from salary over 10 years after joining, or repayment in one sum', cond: 'KLM Flight Academy costs and financing (2026)' } },
  'klm.work.pub-kfa-training-location': { h: '58063bc8564a1b2f', label: '訓練の場所', value: 'エールデ（学科・単発機・多発機）とスキポール（MCC・型式）', cond: 'KLM フライトアカデミーの課程の案内', en: { label: 'Training locations', value: 'Eelde (theory, single-engine and multi-engine) and Schiphol (MCC and type rating)', cond: 'KLM Flight Academy course guide' } },
  'klm.work.roster': { h: 'e3c941da62d17e09', label: '勤務の形', value: '4週間ごとの勤務表', cond: 'パイロットの採用ページ', en: { label: 'Roster', value: 'Four-week roster periods', cond: 'Pilot recruitment page' } },
  /* エールフランス */
  'air-france.benefits.c-cadet-housing': { h: 'c44dee7badf1b612', label: '訓練生の住まい', value: '学校での初期訓練の間は、住まいが用意される', cond: '養成コース（cadet）のQ&A', en: { label: 'Cadet accommodation', value: 'Accommodation is provided throughout the initial school training', cond: 'Cadet program FAQs' } },
  /* 養成コースの訓練の期間中の休暇（行に職位が無く、行き先が cadet）── 名前が訓練生の条件だと言う。値は ITEM の言い方（年5週間）（2026-10-23） */
  'air-france.benefits.c-cadet-leave': { h: '1f0ea47acf79fa7b', label: '訓練生の年次休暇', cond: '養成コース（cadet）のQ&A', en: { label: 'Cadet annual leave', cond: 'Cadet program FAQs' } },
  'air-france.jobs.c-cadet-alert': { h: 'e86bc714a9075521', label: '養成コースの募集', value: '次の募集のお知らせを受け取る登録を案内', cond: '養成コース（cadet）のQ&A', en: { label: 'Cadet recruitment', value: 'Sign-up for alerts on the next intake', cond: 'Cadet program FAQs' } },
  'air-france.jobs.c-selection-languages': { h: 'c3869e17820bb522', label: '応募の条件（言語）', value: '英語の語学能力レベル5以上と TOEIC 850点以上（2年以内）。フランス語が母語でない人はフランス語の語学能力レベル6', cond: '経験者（professional）の選考の案内', en: { label: 'Requirements (language)', value: 'English language proficiency (LPR) level 5 or above and TOEIC 850 or above (within 2 years); non-native French speakers need French LPR level 6', cond: 'Selection guide for experienced (professional) pilots' } },
  'air-france.work.c-cadet-failure': { h: '56bc04a463fda70b', label: '訓練費の返済（訓練生）', value: '訓練で不合格となって契約が終わるとき、受けた訓練の費用の返済は求められない', cond: '養成コース（cadet）のQ&A', en: { label: 'Training cost repayment (cadets)', value: 'No repayment of training costs if the contract ends because the cadet fails training', cond: 'Cadet program FAQs' } },
  'air-france.work.pub-cadet-fulltime': { h: 'c150101ba64efe64', label: '訓練の期間', value: '24か月のフルタイムの課程（ほかの仕事との掛け持ちはできない）', cond: '養成コース（cadet）のQ&A', en: { label: 'Training duration', value: 'A 24-month full-time course (no other job alongside)', cond: 'Cadet program FAQs' } },
  /* エア・カナダ */
  'air-canada.benefits.r10-fr38766-staff-travel': { h: '988b3485ac2954f3', label: '社員の航空券', value: '本人・家族・友人の特別運賃と旅行パス、他社との相互の特典', cond: 'パイロットの求人（Air Canada Express 以外から応募する人）', en: { label: 'Staff travel', value: 'Special fares and travel passes for you, family and friends, plus reciprocal benefits with other airlines', cond: 'Pilot vacancy (for applicants not coming from Air Canada Express)' } },
  'air-canada.benefits.r10-fr38766-uby-support': { h: '25921939e66a4b4b', label: '心と体の相談', value: 'UBY（カウンセラー・セラピストにつながる支援）', cond: 'パイロットの求人（Air Canada Express 以外から応募する人）', en: { label: 'Wellbeing support', value: 'UBY (access to a network of counsellors and therapists)', cond: 'Pilot vacancy (for applicants not coming from Air Canada Express)' } },
  'air-canada.fleet.a321xlr-entry': { h: 'a5c198de0cf97d05', fleet: 'エアバス A321XLR', en: { fleet: 'Airbus A321XLR' } },
  /* ブリティッシュ・エアウェイズ */
  'british-airways.benefits.c-heathrow-express-discount': { h: '678a29b3d629607c', label: '通勤', value: 'ヒースロー・エクスプレスの割引（75%）', cond: '社員ぜんたいの特典の案内', en: { label: 'Commuting', value: 'Heathrow Express discount (75%)', cond: 'Benefits overview for all employees' } },
  'british-airways.benefits.default-pension-on-job-page': { h: 'b9c7eb51d1dab476', label: '年金', value: '確定拠出年金（本人2%・会社7%から。拠出を増やす選択肢あり）', cond: 'A320 型式限定を持つ経験者の求人（福利厚生の欄）', en: { label: 'Pension', value: 'Defined-contribution pension (from 2% employee and 7% employer, with options to increase)', cond: 'Vacancy for A320 type-rated pilots (benefits section)' } },
  'british-airways.benefits.pension': { h: 'af21d836d31f6743', label: '年金（会社の拠出の上限）', value: '会社の拠出は最大15%', cond: 'A320 型式限定を持つ経験者の求人', en: { label: 'Pension (employer contribution cap)', value: 'Employer contributions of up to 15%', cond: 'Vacancy for A320 type-rated pilots' } },
  'british-airways.benefits.pub-medical-posting': { h: '5b693f54915ba05e', label: '保険', value: '民間の医療保険', cond: 'A320 型式限定を持つ経験者の求人', en: { label: 'Insurance', value: 'Private medical cover', cond: 'Vacancy for A320 type-rated pilots' } },
  'british-airways.benefits.pub-staff-travel-job': { h: 'aca2e49d80bcdd6d', label: '社員の航空券', value: '入社の日から、空席待ちの航空券と確定席の割引運賃（最大30回分）。本人・友人・家族', cond: 'A320 型式限定を持つ経験者の求人', en: { label: 'Staff travel', value: 'Standby tickets and up to 30 confirmed discounted fares from the day you join, for you, friends and family', cond: 'Vacancy for A320 type-rated pilots' } },
  'british-airways.benefits.r6-pension-bapp': { h: '506f7bf410ebf5ca', label: '年金', value: '本人が6%を拠出すると、会社が15%を拠出（British Airways Pension Plan）', cond: '経験者の上級副操縦士（SFO）の採用案内（2026年）', lead: true, en: { label: 'Pension', value: 'If you contribute 6%, the company contributes 15% (British Airways Pension Plan)', cond: 'Recruitment pack for experienced senior first officers (2026)' } },
  'british-airways.benefits.r6-staff-travel-firstday': { h: '04ff37a331f8bfc3', label: '社員の航空券（入社の日から）', value: '空席待ちの航空券（ID90）と確定席の割引（Hotline）', cond: '経験者の上級副操縦士（SFO）の採用案内（2026年）。契約ではなく会社の裁量の特典', en: { label: 'Staff travel (from day one)', value: 'Standby tickets (ID90) and confirmed-seat discounts (Hotline)', cond: 'Recruitment pack for experienced senior first officers (2026). A discretionary, non-contractual benefit' } },
  'british-airways.benefits.r6-staff-travel-id100': { h: '385835654839002b', label: '社員の航空券（6か月後から）', value: '年2枚の予約できる航空券（ID100）。副操縦士はビジネスクラス、上級副操縦士と機長はファーストクラス', cond: '経験者の上級副操縦士（SFO）の採用案内（2026年）。契約ではなく会社の裁量の特典', en: { label: 'Staff travel (after six months)', value: 'Two bookable tickets (ID100) a year: business class for first officers, first class for senior first officers and captains', cond: 'Recruitment pack for experienced senior first officers (2026). A discretionary, non-contractual benefit' } },
  'british-airways.benefits.r6-staff-travel-nominees': { h: 'e973124635db96ba', label: '社員の航空券の対象', value: '友人・親族3人か、友人・親族2人と同じ世帯の24歳未満の子。3か月ごとに変えられる', cond: '経験者の上級副操縦士（SFO）の採用案内（2026年）', en: { label: 'Who staff travel covers', value: 'Three friends or relatives, or two friends or relatives plus children under 24 in the same household; changes every three months', cond: 'Recruitment pack for experienced senior first officers (2026)' } },
  'british-airways.benefits.speedbird-training-housing': { h: '3a7e272f29263afa', label: '訓練生の住まい', value: '飛行学校での訓練の間は、会社が宿泊を用意して費用を負担', cond: 'Speedbird Pilot Academy のQ&A（2026年4月14日時点）。入社後に拠点の空港で型式訓練を受けるときの宿泊は自分で手配', en: { label: 'Cadet accommodation', value: 'During flight school training the company arranges and pays for accommodation', cond: 'Speedbird Pilot Academy FAQs (as of 14 April 2026). For type training at the base airport after joining, you arrange your own accommodation' } },
  'british-airways.jobs.a320-open': { h: '799805e560fb4514', label: '募集の受付', value: 'A320 型式限定を持つ経験者の求人（2026年10月25日締切）', cond: 'A320 型式限定を持つ経験者の求人（英国の免許）', en: { label: 'Applications', value: 'Vacancy for A320 type-rated pilots (closing 25 October 2026)', cond: 'Vacancy for A320 type-rated pilots (UK license)' } },
  'british-airways.jobs.academy-2026-closed': { h: 'caf24edf57bc4b87', label: '養成コースの募集', value: '2026年の募集は締め切った', cond: 'Future Pilots（Speedbird Pilot Academy）の案内', en: { label: 'Cadet recruitment', value: 'Applications for 2026 have closed', cond: 'Future Pilots (Speedbird Pilot Academy) guide' } },
  'british-airways.work.bond': { h: 'd55f88efdaad9322', label: '訓練費の拘束', value: '移行訓練・型式訓練は会社負担で、拘束（ボンド）は無い', cond: 'A320 型式限定を持つ経験者の求人', en: { label: 'Training bond', value: 'Conversion and type training are paid by the company, with no bond', cond: 'Vacancy for A320 type-rated pilots' } },
  'british-airways.work.speedbird-training-schools': { h: '9c06a4ca178f9a94', label: '訓練の場所', value: 'FTEJerez か Skyborne（希望は聞くが、配属は約束されない）', cond: 'Speedbird Pilot Academy のQ&A（2026年4月14日時点）', en: { label: 'Training locations', value: 'FTEJerez or Skyborne (preferences are considered but not guaranteed)', cond: 'Speedbird Pilot Academy FAQs (as of 14 April 2026)' } },
  /* エアX・チャーター */
  'airx-charter.jobs.c-a340-fo-listing': { h: '28a1459954a19696', label: '募集の受付', value: 'A340 の副操縦士の募集を掲載（締切と条件の全文は確認できていない）', cond: '会社の採用ページ', en: { label: 'Applications', value: 'An A340 first officer vacancy is listed (the closing date and full terms could not be confirmed)', cond: 'Company careers page' } },
  'airx-charter.jobs.c-cl604-instructors': { h: '816269708c341dd9', label: '募集している職種', value: 'チャレンジャー CL604/605 の型式の教官・審査官（TRI/TRE）', cond: '会社の採用ページ', en: { label: 'Roles being hired', value: 'Challenger CL604/605 type rating instructors and examiners (TRI/TRE)', cond: 'Company careers page' } },
  /* イーグルジェット・インターナショナル */
  'eagle-jet.work.pub-programme-provider': { h: '6b53e060c1ac7c2d', label: '訓練の場所', value: '欧州の提携訓練機関（ATO）で型式訓練、そのあと提携先の航空会社で OCC と300・500時間のプログラム', cond: 'EASA A320 副操縦士プログラムの案内', en: { label: 'Training locations', value: 'Type training at a partner training organization (ATO) in Europe, then OCC and a 300- or 500-hour program with a partner airline', cond: 'EASA A320 first officer program guide' } },
  /* ソレイラス・アビエーション */
  'solairus.benefits.missing-medical': { h: '943d4c456b1747bf', label: '保険', value: '健康とウェルネスの制度', cond: 'G450・G550 の機長の求人（オースティン）', en: { label: 'Insurance', value: 'Health and wellness benefits', cond: 'G450 and G550 captain vacancy (Austin)' } },
  'solairus.benefits.missing-pension': { h: 'aade4647e9148f84', label: '年金', value: '401(k) のマッチング', cond: 'G450・G550 の機長の求人（オースティン）', en: { label: 'Pension', value: '401(k) matching', cond: 'G450 and G550 captain vacancy (Austin)' } },
  'solairus.benefits.r10-pc24-commutable-2002': { h: '5fd1980f39c4d708', label: '通勤（PC-24 の機長）', value: '通勤できる形の募集。大きな空港から車で2時間以内に住むか、引っ越せること', cond: 'PC-24 の機長の求人（2026-2002）', en: { label: 'Commuting (PC-24 captains)', value: 'A commutable vacancy: live within a two-hour drive of a major commercial airport, or be willing to relocate', cond: 'PC-24 captain vacancy (2026-2002)' } },
  'solairus.jobs.gv-job': { h: 'a8fa95e63b8faeaf', label: '募集の受付', value: 'ヴァンナイズのガルフストリーム GV の機長（常勤）', cond: '会社の求人', en: { label: 'Applications', value: 'Gulfstream GV captain at Van Nuys (full-time)', cond: 'Company vacancy' } },
  'solairus.jobs.missing-entry-open': { h: '9bfae6aad1c56865', label: '募集の受付', value: '公開の求人一覧に GV の機長と G450・G550 の機長の求人（2026年10月19日に確認）', cond: '会社の求人一覧', en: { label: 'Applications', value: 'GV captain and G450/G550 captain vacancies in the public job list (checked on 19 October 2026)', cond: 'Company job list' } },
  'solairus.profile.hq': { h: '1d3def018ac12620', label: '本社', value: 'サンフランシスコ・ベイエリア', en: { label: 'Headquarters', value: 'San Francisco Bay Area' } },
  'solairus.work.missing-roster-pattern': { h: '198f4e01c5f1a222', label: '勤務の形', value: '呼び出し（オンコール）を含む、決まっていない勤務', cond: 'G450・G550 の機長の求人（オースティン）', en: { label: 'Roster', value: 'Irregular schedule, including on-call days', cond: 'G450 and G550 captain vacancy (Austin)' } },
  /* ターキッシュ エアラインズ */
  'turkish-airlines.benefits.pub-general-family-travel': { h: '605cd96686c2ea53', label: '社員の航空券', value: 'Pass・ZED は勤続1年を超えてから、CED は3か月を超えてから。配偶者と子も対象', cond: '社員ぜんたいの制度の案内（国ごとの法律で違いがある）', en: { label: 'Staff travel', value: 'Pass and ZED tickets after more than one year of service, CED after more than three months; spouses and children are included', cond: 'Benefits overview for all employees (varies with each country’s law)' } },
  'turkish-airlines.fleet.a319': { h: '11a172fb4289f78f', fleet: 'エアバス A319', en: { fleet: 'Airbus A319' } },
  'turkish-airlines.profile.country': { h: '1f35a69060e4b9c7', label: '本社', value: 'トルコ', en: { label: 'Headquarters', value: 'Turkey' } },
  'turkish-airlines.work.c-roster-publication': { h: '24d3c954ad0ff544', label: '勤務表の公表', value: '翌月の勤務表は、31日の月は24日、30日の月は23日に公表', cond: '採用ページのQ&A', en: { label: 'Roster publication', value: 'Next month’s roster is published on the 24th in 31-day months and on the 23rd in 30-day months', cond: 'Recruitment FAQs' } },
  /* エーゲ航空 */
  'aegean.benefits.c-medical': { h: '1624ea3ff8c41dd8', label: '保険', value: '民間の医療保険', cond: '型式限定を持たない副操縦士（A320・ATR42/72）の募集（エーゲ航空とオリンピック航空）', en: { label: 'Insurance', value: 'Private health insurance', cond: 'Vacancy for non-type-rated first officers (A320 and ATR42/72) at Aegean and Olympic Air' } },
  'aegean.benefits.c-pension': { h: 'e2df0a83e8fcb264', label: '年金', value: 'あり', cond: '型式限定を持たない副操縦士（A320・ATR42/72）の募集（エーゲ航空とオリンピック航空）', en: { label: 'Pension', value: 'Yes', cond: 'Vacancy for non-type-rated first officers (A320 and ATR42/72) at Aegean and Olympic Air' } },
  'aegean.benefits.c-travel': { h: '78ba8aaac18550ed', label: '社員の航空券', value: '世界の航空券の優待', cond: '型式限定を持たない副操縦士（A320・ATR42/72）の募集（エーゲ航空とオリンピック航空）', en: { label: 'Staff travel', value: 'Worldwide staff travel benefits', cond: 'Vacancy for non-type-rated first officers (A320 and ATR42/72) at Aegean and Olympic Air' } },
  'aegean.benefits.extra-cap-profitability-bonus': { h: '175561d57ad9317c', label: '業績に応じた賞与', value: '会社の業績に応じた年1回の利益賞与の対象になる', cond: 'A320 型式限定を持つ機長の募集', en: { label: 'Profit-related bonus', value: 'Eligible for an annual profitability bonus based on company performance', cond: 'Vacancy for A320 type-rated captains' } },
  'aegean.jobs.c-fo-open': { h: '3abff29ec70369f7', label: '募集の受付', value: '型式限定を持たない副操縦士（A320・ATR42/72）を募集（2026年12月31日締切）', cond: '会社の募集ページ', en: { label: 'Applications', value: 'Hiring non-type-rated first officers for the A320 and ATR42/72 (closing 31 December 2026)', cond: 'Company vacancy page' } },
  'aegean.jobs.followup-agent-followup-ntr-fo-employment-location': { h: '0728ee855cc4a82d', label: '勤務地', value: 'アテネ国際空港（スパタ）', cond: '型式限定を持たない副操縦士（A320・ATR42/72）の募集', en: { label: 'Base', value: 'Athens International Airport (Spata)', cond: 'Vacancy for non-type-rated first officers (A320 and ATR42/72)' } },
  'aegean.jobs.pub-scholarship-deadline': { h: '15ae50804b14edb5', label: '奨学金の募集の締切', value: '2026年10月16日（2027年1月に訓練を始める回）', cond: '2026年の奨学金の募集の案内', en: { label: 'Scholarship closing date', value: '16 October 2026 (for training starting in January 2027)', cond: '2026 scholarship intake notice' } },
  'aegean.work.pub-scholarship-schools': { h: '7b1689e0bc7bc4ba', label: '訓練の場所（奨学金）', value: 'アテネの Global Aviation Academy と、カヴァラの Egnatia Aviation Academy', cond: 'ギリシャ・キプロスの人向けの奨学金の案内', en: { label: 'Training locations (scholarship)', value: 'Global Aviation Academy in Athens and Egnatia Aviation Academy in Kavala', cond: 'Scholarship program for Greek and Cypriot applicants' } },
  /* エア・リンガス */
  'aer-lingus.jobs.c-cadet-campaign-end': { h: 'a8ec9cf26f671718', label: '養成コースの募集', value: '2025年2月10日で締め切った', cond: 'Future Pilot Programme の募集の発表', en: { label: 'Cadet recruitment', value: 'Closed on 10 February 2025', cond: 'Future Pilot Programme announcement' } },
  'aer-lingus.work.c-historical-roster': { h: '3e30897d8e623e23', label: '勤務の形（例）', value: '5日勤務・3日休みの決まった形', cond: '2019年の会社のインタビュー（副操縦士1人の例）', en: { label: 'Roster (example)', value: 'A fixed five-on, three-off pattern', cond: '2019 company interview (one first officer’s example)' } },
  'aer-lingus.work.training-place': { h: 'dbb53b2dcca19969', label: '訓練の場所', value: 'ダブリンの Aer Lingus Training Academy（訓練の後半）', cond: 'Future Pilot Programme の案内（2025年）', en: { label: 'Training locations', value: 'Aer Lingus Training Academy in Dublin (later phase of training)', cond: 'Future Pilot Programme guide (2025)' } },
  /* オーストリア航空 */
  'austrian.jobs.c-ready-entry-language': { h: 'e672098673f0fda4', label: '応募の条件（言語）', value: '選考はドイツ語。ドイツ語と英語の十分な力が要る', cond: 'Ready Entry（経験者）の選考の案内', en: { label: 'Requirements (language)', value: 'Selection is in German; good German and English are required', cond: 'Ready Entry (experienced pilots) selection guide' } },
  'austrian.work.c-ready-entry-bond': { h: '8b8ee2aff5a76c88', label: '訓練の拘束', value: '3年', cond: 'Ready Entry（経験者）の案内', en: { label: 'Training bond', value: '3 years', cond: 'Ready Entry (experienced pilots) guide' } },
  /* イージージェット */
  'easyjet.benefits.followup-agent-followup-gatwick-captain-travel2027': { h: 'f65fa373738e1788', label: '社員の航空券', value: '航空券の割引', cond: 'ロンドン・ガトウィックの機長（型式限定なし）の2027年の求人', en: { label: 'Staff travel', value: 'Staff travel discounts', cond: 'London Gatwick vacancy for non-type-rated captains (2027)' } },
  'easyjet.jobs.c-southend-2027': { h: 'c5145aa01fe24f80', label: '募集の受付', value: 'A320 型式限定を持つ機長を、2027年に始まる常勤の契約で募集', cond: 'ロンドン・サウスエンドの求人', en: { label: 'Applications', value: 'Hiring A320 type-rated captains on permanent contracts starting in 2027', cond: 'London Southend vacancy' } },
  'easyjet.jobs.copilot-requirement': { h: '93d9a603840a2520', label: '応募の条件（型式限定のある副操縦士）', value: 'A320 の飛行時間500時間以上', cond: 'パイロットの採用ページ', en: { label: 'Requirements (type-rated first officers)', value: 'At least 500 hours on the A320', cond: 'Pilot recruitment page' } },
  'easyjet.jobs.followup-agent-followup-gatwick-captain-job-base2027': { h: 'c8d4341bd29378a1', label: '勤務地', value: 'ロンドン・ガトウィック（この求人だけ）', cond: 'ロンドン・ガトウィックの機長（型式限定なし）の2027年の求人', en: { label: 'Base', value: 'London Gatwick (this vacancy only)', cond: 'London Gatwick vacancy for non-type-rated captains (2027)' } },
  'easyjet.work.roster': { h: '73607d59ed394c89', label: '勤務の形', value: '勤務表は数週間前に分かり、泊まりの勤務は少ない', cond: 'パイロットの採用ページ', en: { label: 'Roster', value: 'Rosters are known weeks in advance and night stops are rare', cond: 'Pilot recruitment page' } },
  /* ユーロウイングス */
  'eurowings.benefits.c-parking': { h: '41fb2a405fcdbbe7', label: '通勤', value: '無料の駐車場', cond: 'パイロットの採用ページ（ブランドぜんたいの紹介）', en: { label: 'Commuting', value: 'Free parking', cond: 'Pilot recruitment page (brand-wide overview)' } },
  'eurowings.benefits.c-travel': { h: '9745ae2fcf9562c4', label: '社員の航空券', value: '航空券の優待と、年1回の休暇の旅行便', cond: 'パイロットの採用ページ（ブランドぜんたいの紹介）', en: { label: 'Staff travel', value: 'Travel discounts and an annual holiday flight', cond: 'Pilot recruitment page (brand-wide overview)' } },
  'eurowings.jobs.fo-open': { h: 'ff1dfc31e7ebe33d', label: '募集の受付', value: '副操縦士（型式限定あり・なし）の募集を掲載', cond: '会社の求人一覧', en: { label: 'Applications', value: 'First officer vacancies (type-rated and non-type-rated) are listed', cond: 'Company vacancy list' } },
  'eurowings.work.c-type': { h: '553cd290a5d9afef', label: '型式の訓練の費用', value: '無料（会社負担）', cond: 'パイロットの採用ページ（ブランドぜんたいの紹介）', en: { label: 'Type rating cost', value: 'Free (paid by the company)', cond: 'Pilot recruitment page (brand-wide overview)' } },
  /* フィンエアー */
  'finnair.benefits.pub-mpl-housing': { h: '3cfd2db593dc54b4', label: '訓練生の住まい', value: 'フィンランドでもデンマークでも本人の負担（提携校の安い寮の案内あり）', cond: 'MPL（自社養成）のQ&A', en: { label: 'Cadet accommodation', value: 'Paid by the cadet in both Finland and Denmark (partner schools point to low-cost dorms)', cond: 'MPL (cadet) program FAQs' } },
  'finnair.benefits.pub-mpl-travel': { h: 'a7e521191e11c40c', label: '訓練生の移動', value: '始めのデンマーク行きと、海外の課程を終えて戻る便は会社が手配。ほかの往復は本人', cond: 'MPL（自社養成）のQ&A', en: { label: 'Cadet travel', value: 'The company arranges the first trip to Denmark and the flight home after the training abroad; other trips are the cadet’s own', cond: 'MPL (cadet) program FAQs' } },
  'finnair.jobs.c-mpl-hiring-priority': { h: '91e43a726214b29f', label: '養成コース修了者の採用', value: '修了から5年間、A320 の副操縦士の採用で優先される（すぐの採用の約束ではない）', cond: '2026年の会社の記事（MPL の修了者の話）', en: { label: 'Hiring after the cadet program', value: 'Priority in A320 first officer hiring for five years after graduation (not a promise of immediate hiring)', cond: '2026 company article (an MPL graduate’s story)' } },
  'finnair.jobs.languages': { h: 'e7f1d8f0ed823946', label: '応募の条件（言語）', value: 'フィンランド語と英語', cond: 'パイロットの採用ページ', en: { label: 'Requirements (language)', value: 'Finnish and English', cond: 'Pilot recruitment page' } },
  'finnair.jobs.pub-mpl-applications-closed': { h: 'b9828772ae3a2379', label: '養成コースの募集', value: '受付は締め切った', cond: 'MPL（自社養成）のページの表示（確認した時点）', en: { label: 'Cadet recruitment', value: 'The application period has closed', cond: 'MPL (cadet) program page (when checked)' } },
  'finnair.work.pub-mpl-facility': { h: '69d4744b8e01a0ea', label: '訓練の場所', value: '最初の18〜20か月はロスキレの CenterAir、最後の A320 のシミュレーターはヴァンターの Finnair Flight Academy', cond: 'MPL（自社養成）のQ&A', en: { label: 'Training locations', value: 'CenterAir in Roskilde for the first 18–20 months, and the final A320 simulator phase at Finnair Flight Academy in Vantaa', cond: 'MPL (cadet) program FAQs' } },
  'finnair.work.training-place': { h: '1e92fbb3deb6f384', label: '訓練の場所', value: 'ポリの Finnish Aviation Academy（基礎の訓練）', cond: 'パイロットの採用ページ', en: { label: 'Training locations', value: 'Finnish Aviation Academy in Pori (basic training)', cond: 'Pilot recruitment page' } },
  /* イベリア航空 */
  'iberia.jobs.c-job2025-unavailable': { h: 'b8ebaff319deafd0', label: '募集の受付', value: '2025年の新人パイロットの求人は、いまは表示されない', cond: '2025年の新人パイロットの求人のページ', en: { label: 'Applications', value: 'The 2025 vacancy for new-entry pilots is no longer available', cond: '2025 new-entry pilot vacancy page' } },
  /* ITAエアウェイズ */
  'ita-airways.jobs.c-application-channels': { h: '0a59e7e70e648c18', label: '応募の方法', value: '会社の「Work with Us」のページと、会社の LinkedIn の求人', cond: '会社の採用ページ', en: { label: 'How to apply', value: 'The company’s “Work with Us” page and the job offers on its LinkedIn page', cond: 'Company careers page' } },
  /* LOTポーランド航空 */
  'lot.benefits.r3-general-medical': { h: 'eb05ed10636eb38c', label: '医療', value: 'LUX MED の医療パッケージ（年齢や必要に応じて）', cond: '社員ぜんたいの福利厚生の案内', en: { label: 'Medical', value: 'LUX MED medical packages (by age and need)', cond: 'Benefits overview for all employees' } },
  'lot.benefits.r3-general-stafftravel': { h: '59196a8618f724b1', label: '社員の航空券', value: '本人と近親者の航空券の割引', cond: '社員ぜんたいの福利厚生の案内', en: { label: 'Staff travel', value: 'Flight discounts for employees and their close family', cond: 'Benefits overview for all employees' } },
  'lot.jobs.c-a220-fo-post': { h: '3b80bce2329da996', label: '募集の受付', value: 'A220 型式限定を持つ副操縦士の募集を掲載', cond: 'LOT Crew（LOT の乗員の会社）の求人', en: { label: 'Applications', value: 'A vacancy for A220 type-rated first officers is listed', cond: 'Vacancy at LOT Crew (LOT’s crew company)' } },
  'lot.work.c-two-week-roster': { h: 'ecf176433783f0ad', label: '勤務表の公表', value: '翌月が始まる2週間前に、月の勤務表を公表', cond: 'A220 の副操縦士の求人（LOT Crew）', en: { label: 'Roster publication', value: 'The monthly roster is published two weeks before the month starts', cond: 'A220 first officer vacancy (LOT Crew)' } },
  /* ノルウェー・エアシャトル */
  'norwegian.jobs.followup-agent-followup-helsinki-airport-pilot-employment-2025': { h: 'f370c812a6b3054c', label: '採用の勤務地（2025年）', value: 'ヘルシンキ・ヴァンター空港', cond: '2025年9月15日の会社の発表（パイロットの採用）', en: { label: 'Base (2025 hiring)', value: 'Helsinki-Vantaa Airport', cond: 'Company announcement of 15 September 2025 (pilot hiring)' } },
  'norwegian.jobs.open': { h: 'cc35c298e5970ad9', label: '募集の受付', value: 'パイロットの求人は無い（2026年10月19日の表示）', cond: '会社のパイロットの採用ページ', en: { label: 'Applications', value: 'No open pilot positions (as shown on 19 October 2026)', cond: 'Company pilot recruitment page' } },
  /* ライアンエアー */
  'ryanair.jobs.followup-agent-followup-uk-dac-cadet-assessment-fee': { h: '31f79ee0498630aa', label: '選考の費用（訓練生）', value: '選考の前のオンライン試験の費用は本人が払う（試験の会社へ直接）', cond: '英国・EASA の訓練生の募集', en: { label: 'Selection cost (cadets)', value: 'Candidates pay for the online pre-assessment directly to the testing company', cond: 'UK and EASA cadet recruitment' } },
  'ryanair.work.c-no-planned-overnights': { h: 'b91b56021984dbb4', label: '泊まりの勤務', value: '計画された泊まりの勤務は無い', cond: 'グループの経験者の採用案内', en: { label: 'Overnights', value: 'No planned overnights', cond: 'Group recruitment guide for experienced pilots' } },
  'ryanair.work.c-roster-notice': { h: 'd562189317481df7', label: '勤務表の公表', value: '4週間前', cond: 'グループの経験者の採用案内', en: { label: 'Roster publication', value: 'Four weeks in advance', cond: 'Group recruitment guide for experienced pilots' } },
  'ryanair.work.roster-advertised': { h: '335d6a9b1fcb1c8f', label: '勤務の形', value: '5日勤務・4日休みの決まった形', cond: 'グループの経験者の採用案内', en: { label: 'Roster', value: 'A fixed five-on, four-off pattern', cond: 'Group recruitment guide for experienced pilots' } },
  /* スカンジナビア航空 */
  'sas.benefits.c-layover-hotels': { h: '731248e24fdd240a', label: '滞在先のホテル', value: '泊まりの勤務では、ホテルと移動を会社が用意', cond: 'SAS のパイロットの仕事の案内', en: { label: 'Layover hotels', value: 'On layovers the company provides the hotel and transport', cond: 'SAS guide to life as a pilot' } },
  'sas.benefits.pub-faq-medical': { h: '0d1b7b608cd010ce', label: '医療', value: 'あり', cond: 'パイロットのQ&A（雇用と条件）', en: { label: 'Medical', value: 'Yes', cond: 'Pilot FAQs (employment and conditions)' } },
  'sas.benefits.pub-faq-pension': { h: '05f384bbac25fc64', label: '年金', value: '年金の制度と拠出', cond: 'パイロットのQ&A（雇用と条件）', en: { label: 'Pension', value: 'Pension schemes and contributions', cond: 'Pilot FAQs (employment and conditions)' } },
  'sas.benefits.pub-faq-travel': { h: 'de1b41fc7eba574a', label: '社員の航空券', value: '社員の航空券の特典（個人の ID チケット）', cond: 'パイロットのQ&A（雇用と条件）', en: { label: 'Staff travel', value: 'Staff travel privileges (personal ID travel)', cond: 'Pilot FAQs (employment and conditions)' } },
  'sas.fleet.pub-connect-a320neo': { h: '0a8260aaa450cd25', fleet: 'エアバス A320neo', en: { fleet: 'Airbus A320neo' } },
  'sas.fleet.pub-link-e195': { h: 'bac0f0e8af71bf3a', fleet: 'エンブラエル E195', en: { fleet: 'Embraer E195' } },
  'sas.jobs.c-e195-job-current': { h: '5c87140191e01241', label: '募集の受付', value: 'E195 の機長（型式限定あり・なし）を募集。通年で受け付け、早く締め切ることがある', cond: 'E195 の機長の求人（全基地）', en: { label: 'Applications', value: 'Hiring E195 captains (type-rated and non-type-rated) year-round; the vacancy may close early', cond: 'E195 captain vacancy (all bases)' } },
  'sas.work.c-training-bond': { h: '680a2f2ecb4a6b6c', label: '訓練の拘束', value: '36か月（入社後に会社が訓練費を負担）', cond: 'パイロットのQ&A', en: { label: 'Training bond', value: '36 months (the company pays for training after you join)', cond: 'Pilot FAQs' } },
  'sas.work.c-variable-group': { h: '5c27861fca22f82e', label: '勤務の形（新しく入った人）', value: 'Variable Group。月に11日以上の休み。週末や追加の2日の休みを希望できる', cond: 'SAS のパイロットの仕事の案内', en: { label: 'Roster (new joiners)', value: 'Variable Group: at least 11 days off a month, with bids for weekends or two extra days off', cond: 'SAS guide to life as a pilot' } },
  /* スイス インターナショナル エアラインズ */
  'swiss.benefits.c-school-housing-scope': { h: 'b0a13ea256b71a0a', label: '訓練生の住まい', value: 'フェニックス・グレンヒェンの実技の訓練は宿泊つき。チューリッヒの学科（12か月）は宿泊を含まない', cond: '自社養成の訓練費の案内', en: { label: 'Cadet accommodation', value: 'Practical training in Phoenix and Grenchen includes accommodation; the 12-month theory phase in Zurich does not', cond: 'Cadet training cost guide' } },
  'swiss.benefits.r10-eub3-cockpit-occupational-medicine': { h: 'dba488f71c4e6ccf', label: '航空医学のサービス', value: '会社の医療部門（SWISS Medical Services）が、パイロットの航空身体検査と、乗員の予防・旅行医学の相談を行う', cond: '会社の医療部門の案内', en: { label: 'Aviation medicine', value: 'The company’s medical department (SWISS Medical Services) provides pilots’ aeromedical examinations and prevention and travel-medicine advice for crew', cond: 'Company medical department guide' } },
  'swiss.benefits.r13-general-employee-commuting': { h: 'c329577c92c53f83', label: '通勤', value: '公共交通の割引切符・補助のあるバス路線・補助のある駐車場', cond: '社員ぜんたいの特典の案内', en: { label: 'Commuting', value: 'Reduced public transport tickets, subsidised bus lines and subsidised parking', cond: 'Offers for all employees' } },
  'swiss.benefits.r13-general-employee-medical': { h: 'e988b5e2d8b952ab', label: '保険', value: '追加の医療保険の割引', cond: '社員ぜんたいの特典の案内', en: { label: 'Insurance', value: 'Discounts on additional health insurance', cond: 'Offers for all employees' } },
  'swiss.benefits.staff-travel': { h: '94dde833305f6fb3', label: '社員の航空券', value: '本人と大切な人の航空券の優待', cond: 'パイロットの採用ページ', lead: true, en: { label: 'Staff travel', value: 'Travel benefits for you and your loved ones', cond: 'Pilot recruitment page' } },
  'swiss.jobs.c-employment-final-decision': { h: '844957919b5b3d83', label: '養成コース修了者の採用', value: '訓練を終えたあと、会社があらためて採用を決める（訓練を始めた時点の採用の約束ではない）', cond: 'パイロットの採用ページ', en: { label: 'Hiring after the cadet program', value: 'After training the company reviews and makes the final hiring decision (no guarantee when training starts)', cond: 'Pilot recruitment page' } },
  'swiss.jobs.followup-agent-followup-a320fo-job-location': { h: '53f3f324668b7e4e', label: '勤務地', value: 'チューリッヒ空港', cond: 'A320 の経験者の副操縦士の求人', en: { label: 'Base', value: 'Zurich Airport', cond: 'Vacancy for experienced A320 first officers' } },
  'swiss.jobs.followup-agent-followup-a320fo-minimum-experience': { h: '6228036c87eebda4', label: '応募の条件', value: 'A320 ファミリーの飛行経験800時間以上', cond: 'A320 の経験者の副操縦士の求人', en: { label: 'Requirements', value: 'At least 800 hours on the A320 family', cond: 'Vacancy for experienced A320 first officers' } },
  'swiss.work.training-location': { h: '6b1e8ed8035bdfee', label: '訓練の場所', value: 'グレンヒェン（スイス）とフェニックス（米国）（実技の訓練）', cond: 'パイロットの採用ページ', en: { label: 'Training locations', value: 'Grenchen (Switzerland) and Phoenix (USA) for practical training', cond: 'Pilot recruitment page' } },
  /* TAPポルトガル航空 */
  'tap.jobs.c-pilot-category-empty': { h: '2bc4d9d208bb255a', label: '募集の受付', value: 'パイロットの求人は無く、自分から送る応募も受け付けていない（確認した時点）', cond: '会社の採用ページ', en: { label: 'Applications', value: 'No pilot vacancies, and unsolicited applications are not accepted (when checked)', cond: 'Company careers page' } },
  /* ヴァージン・アトランティック航空 */
  'virgin-atlantic.benefits.c-pilot-medical': { h: '7ffa0c53ff658405', label: '医療', value: '民間の医療保険（英国に住む人）', cond: 'パイロットの採用ページ', en: { label: 'Medical', value: 'Private medical insurance (for UK residents)', cond: 'Pilot recruitment page' } },
  'virgin-atlantic.benefits.c-pilot-pension': { h: '886e2e4f8a050178', label: '年金', value: '本人6%・会社15%', cond: 'パイロットの採用ページ（契約ではない特典は変わることがある）', lead: true, en: { label: 'Pension', value: '6% employee and 15% employer', cond: 'Pilot recruitment page (non-contractual benefits may change)' } },
  'virgin-atlantic.benefits.pub-paid-leave-existence': { h: '4b22ab66e7ef009f', label: '休暇', value: '有給の年次休暇', cond: 'パイロットの採用ページ', en: { label: 'Leave', value: 'Paid annual leave', cond: 'Pilot recruitment page' } },
  'virgin-atlantic.benefits.pub-pilot-travel': { h: 'c77f012aa68c83a2', label: '社員の航空券', value: '自社と一部の他社の航空券の特典', cond: 'パイロットの採用ページ', en: { label: 'Staff travel', value: 'Staff travel on the company’s own and selected other airlines', cond: 'Pilot recruitment page' } },
  'virgin-atlantic.jobs.c-future-flyers-paused': { h: '73b8846d3b5a30cd', label: '養成コースの募集', value: '作り直しのため、いまは休止', cond: 'パイロットのQ&A', en: { label: 'Cadet recruitment', value: 'Currently paused while the program is redesigned', cond: 'Pilot FAQs' } },
  'virgin-atlantic.work.c-trip-nights': { h: '72b349497e8cb194', label: '泊まりの勤務', value: '1回の乗務で1泊以上（2〜3泊もある）', cond: 'パイロットのQ&A', en: { label: 'Overnights', value: 'A typical trip includes at least one night away, sometimes two or three', cond: 'Pilot FAQs' } },
  'virgin-atlantic.work.command-time': { h: '22c1f02ed7e788c7', label: '機長への昇格の目安', value: '8〜10年（運航の必要に応じて）', cond: 'パイロットの採用ページ（約束された年数ではない）', en: { label: 'Time to command', value: '8–10 years (subject to operational needs)', cond: 'Pilot recruitment page (not a guaranteed timeline)' } },
  /* ブエリング航空 */
  'vueling.jobs.pilot-open': { h: '8bb6dc0a16b7924b', label: '募集の受付', value: '「採用中」の見出しはあるが、該当する求人は無い（確認した時点）', cond: '会社のパイロットの採用ページ', en: { label: 'Applications', value: 'A “We are hiring” heading, but no matching jobs (when checked)', cond: 'Company pilot recruitment page' } },
  /* ウィズ・エアー */
  'wizz-air.benefits.r2b-commuter-free-twice-month': { h: '40c2ee0ecb5baa81', label: '通勤（14/7 の通勤の勤務）', value: 'Wizz Air の便で月2回の無料の通勤（ほとんどの基地）', cond: 'パイロットの採用ページ（14/7 の通勤の勤務を選んだ人）', en: { label: 'Commuting (14/7 commuter roster)', value: 'Free commuting on the Wizz Air network twice a month (most bases)', cond: 'Pilot recruitment page (for those choosing the 14/7 commuter roster)' } },
  'wizz-air.benefits.r2b-floating-duty-accommodation': { h: 'a64f9cea63980985', label: '滞在先のホテル（20/10 の勤務）', value: '20日の勤務の間はホテルと宿泊つき（一部の基地）', cond: 'パイロットの採用ページ（20/10 の勤務を選んだ人）', en: { label: 'Hotels (20/10 floating roster)', value: 'Hotel accommodation included during the 20 days on (selected bases)', cond: 'Pilot recruitment page (for those choosing the 20/10 floating roster)' } },
  'wizz-air.benefits.r2b-floating-duty-allowance': { h: '54e1622032f35ce7', label: '日当（20/10 の勤務）', value: '勤務の間、会社の規定の日当', cond: 'パイロットの採用ページ（20/10 の勤務を選んだ人）', en: { label: 'Per diem (20/10 roster)', value: 'Per diem under company policy while on duty', cond: 'Pilot recruitment page (for those choosing the 20/10 floating roster)' } },
  'wizz-air.jobs.uk-license': { h: 'a6f6d4a7c18d1fd8', label: '免許（英国の会社）', value: '英国 CAA の ATPL か CPL', cond: 'パイロットの採用ページ（Wizz Air UK）', en: { label: 'License (UK company)', value: 'UK CAA ATPL or CPL', cond: 'Pilot recruitment page (Wizz Air UK)' } },
  'wizz-air.jobs.uk-medical': { h: '8d8fd5eec42d0caa', label: '身体検査（英国の会社）', value: '英国 CAA の第1種の航空身体検査', cond: 'パイロットの採用ページ（Wizz Air UK）', en: { label: 'Medical (UK company)', value: 'UK CAA Class 1 medical certificate', cond: 'Pilot recruitment page (Wizz Air UK)' } },
  'wizz-air.jobs.uk-right-to-work': { h: '7136583101a09f58', label: '働く資格（英国の会社）', value: '英国に制限なく住み、働ける権利', cond: 'パイロットの採用ページ（Wizz Air UK）', en: { label: 'Right to work (UK company)', value: 'Unrestricted right to live and work in the United Kingdom', cond: 'Pilot recruitment page (Wizz Air UK)' } },
  'wizz-air.work.c-uk-roster': { h: 'ab72aeb7df7583a4', label: '勤務の形（英国の会社）', value: 'ガトウィックとルートンで5日勤務・4日休み、地元のフレックス、機長の14日勤務・14日休み（希望で、割り当ての約束ではない）', cond: 'パイロットの採用ページ（Wizz Air UK）', en: { label: 'Roster (UK company)', value: '5 on / 4 off at Gatwick and Luton, flexible local rosters, and 14 on / 14 off for captains (requests, not guaranteed)', cond: 'Pilot recruitment page (Wizz Air UK)' } },
  /* ニュージーランド航空 */
  'air-new-zealand.benefits.r10-atr-instructor-annual-leave': { h: '02f1e5d6b0008b28', label: '休暇の買い足し（教官）', value: '年に最大4週間の休暇を買い足せる（FlexiLeave）', cond: 'ATR のシミュレーターの教官の募集', en: { label: 'Buying extra leave (instructors)', value: 'Up to four extra weeks of leave can be purchased each year (FlexiLeave)', cond: 'ATR flight simulator instructor vacancy' } },
  'air-new-zealand.benefits.r10-atr-instructor-staff-travel': { h: 'eb56432aa162fbd0', label: '社員の航空券（教官）', value: '本人と家族（whānau）の割引航空券と、他の航空会社の空席待ち', cond: 'ATR のシミュレーターの教官の募集', en: { label: 'Staff travel (instructors)', value: 'Discounted flights for you and your whānau, and standby travel on other international airlines', cond: 'ATR flight simulator instructor vacancy' } },
  'air-new-zealand.benefits.resume-jet-health': { h: '4b16284c5bbfbad4', label: '保険と病気休暇', value: '保険・病気休暇・疲れへの対策', cond: 'ジェット機のパイロットの募集（関心の登録）', en: { label: 'Insurance and sick leave', value: 'Insurance, sick leave and fatigue support', cond: 'Jet fleet pilot expression of interest' } },
  'air-new-zealand.jobs.resume-assessment': { h: 'b542b088e3d55b34', label: '選考', value: 'オークランドで2日間', cond: 'ジェット機のパイロットの募集（関心の登録）', en: { label: 'Selection', value: 'Two days in Auckland', cond: 'Jet fleet pilot expression of interest' } },
  'air-new-zealand.jobs.resume-jet-eligibility': { h: '62d23d5f867ff1ba', label: '応募の条件', value: '総飛行時間1,500時間、ニュージーランドの ATPL（か CPL と ATPL の学科）、第1種の身体検査、英語レベル6。ニュージーランドかオーストラリアの市民・永住者など', cond: 'ジェット機のパイロットの募集（関心の登録）', en: { label: 'Requirements', value: '1,500 hours total time, NZ ATPL (or CPL with ATPL theory), Class 1 medical, English level 6; New Zealand or Australian citizens, permanent residents and similar', cond: 'Jet fleet pilot expression of interest' } },
  'air-new-zealand.jobs.resume-jet-entry': { h: '94f4e30ad96a018b', label: '募集の受付', value: '関心の登録（Expression of Interest）で応募できる。B777・B787 はセカンドオフィサー、A320・A321 は副操縦士から', cond: 'ジェット機のパイロットの募集', en: { label: 'Applications', value: 'Applications through an expression of interest: second officer on the B777 and B787, first officer on the A320 and A321', cond: 'Jet fleet pilot recruitment' } },
  'air-new-zealand.work.resume-jet-flex': { h: '91f83f4b5f267b4c', label: '働き方の制度', value: 'パートタイムと、長い休み（サバティカル）の申請', cond: 'ジェット機のパイロットの募集（関心の登録）', en: { label: 'Flexible working', value: 'Part-time options and sabbatical applications', cond: 'Jet fleet pilot expression of interest' } },
  /* アラスカ航空 */
  'alaska-airlines.benefits.r8-fo-holiday-pto': { h: '0436b804d2e7f313', label: '休暇', value: '休日と有給休暇', cond: '副操縦士の求人（Req2026-21163）', en: { label: 'Leave', value: 'Holidays and paid time off', cond: 'First officer vacancy (Req2026-21163)' } },
  'alaska-airlines.benefits.r8-fo-medical': { h: 'b465b9ef115e56a8', label: '保険', value: '医療・歯科・眼科', cond: '副操縦士の求人（Req2026-21163）', en: { label: 'Insurance', value: 'Medical, dental and vision', cond: 'First officer vacancy (Req2026-21163)' } },
  'alaska-airlines.benefits.r8-fo-standby-travel': { h: 'd3d621447d7c5241', label: '社員の航空券', value: 'アラスカ航空・ハワイアン航空・ホライゾン航空の空席待ちの航空券（無料）', cond: '副操縦士の求人（Req2026-21163）', en: { label: 'Staff travel', value: 'Free standby travel on Alaska Airlines, Hawaiian Airlines and Horizon Air', cond: 'First officer vacancy (Req2026-21163)' } },
  /* アレジアント航空 */
  'allegiant.jobs.fo-closed': { h: '1f59682dfec3321b', label: '募集の受付', value: '副操縦士の受付は締め切っている（2026年10月19日の表示）', cond: 'パイロットの採用ページ', en: { label: 'Applications', value: 'The first officer application window is closed (as shown on 19 October 2026)', cond: 'Pilot recruitment page' } },
  'allegiant.jobs.resume-cadet-pathway': { h: '7c9ee69fb0ad30b9', label: '養成コースの募集', value: '提携大学の学生の受け入れ（Accelerate）は受付中', cond: 'パイロットの採用ページ', en: { label: 'Cadet recruitment', value: 'Accepting cadets from partner universities (Accelerate)', cond: 'Pilot recruitment page' } },
  'allegiant.work.resume-roster-return': { h: 'fe7ceac0f7b47333', label: '勤務の形', value: 'ほとんどの乗務は日帰り（自宅に戻る）', cond: 'パイロットの採用ページ', en: { label: 'Roster', value: 'Most trips are turns (you return home the same day)', cond: 'Pilot recruitment page' } },
  'allegiant.work.training-cities': { h: '37e8c6e152e050d9', label: '訓練の場所', value: 'ネバダ州ラスベガスとフロリダ州サンフォード', cond: 'パイロットの採用ページ', en: { label: 'Training locations', value: 'Las Vegas, Nevada and Sanford, Florida', cond: 'Pilot recruitment page' } },
  /* アビアンカ航空 */
  'avianca.jobs.resume-pilot-category-status': { h: 'c739e3c095f70671', label: '募集の受付', value: 'パイロットの求人は無い（2026年10月19日の表示）', cond: '会社の採用ページ', en: { label: 'Applications', value: 'No pilot vacancies (as shown on 19 October 2026)', cond: 'Company careers page' } },
  /* ブリーズ・エアウェイズ */
  'breeze-airways.benefits.r2-a220-cap-annual-leave': { h: 'a476ce58c2963c33', label: '休暇', value: '有給の休み（PTO）', cond: 'A220 の機長（経験者）の求人（JR100027）', en: { label: 'Leave', value: 'Paid time off (PTO)', cond: 'A220 direct-entry captain vacancy (JR100027)' } },
  'breeze-airways.benefits.r2-a220-cap-medical': { h: '90bcb3eb7c9921ba', label: '保険', value: '医療・眼科・歯科', cond: 'A220 の機長（経験者）の求人（JR100027）', en: { label: 'Insurance', value: 'Health, vision and dental', cond: 'A220 direct-entry captain vacancy (JR100027)' } },
  'breeze-airways.benefits.r2-a220-cap-pension': { h: '2024f38088e93ddf', label: '年金', value: '401(k)（会社のマッチングあり）', cond: 'A220 の機長（経験者）の求人（JR100027）', en: { label: 'Pension', value: '401(k) with an employer match', cond: 'A220 direct-entry captain vacancy (JR100027)' } },
  'breeze-airways.benefits.r2-a220-cap-staff-travel': { h: '31252733d8213305', label: '社員の航空券', value: 'ブリーズと他社の航空券の特典', cond: 'A220 の機長（経験者）の求人（JR100027）', en: { label: 'Staff travel', value: 'Travel on Breeze and other airlines', cond: 'A220 direct-entry captain vacancy (JR100027)' } },
  /* コパ航空 */
  'copa-airlines.base.pub-pilot-city-panama': { h: '4f55c3a111511e85', label: '拠点', value: 'パナマシティ', cond: '副操縦士の採用の投稿（アルゼンチンの応募者向け）', en: { label: 'Base', value: 'Panama City', cond: 'First officer recruitment post (for applicants from Argentina)' } },
  'copa-airlines.benefits.pub-fo-health-offer': { h: 'b0740d7761de15ac', label: '保険', value: '医療保険', cond: 'B737 の副操縦士の求人', en: { label: 'Insurance', value: 'Health insurance', cond: 'B737 first officer vacancy' } },
  'copa-airlines.benefits.pub-fo-stafftravel-offer': { h: '5634bea33943082b', label: '社員の航空券', value: '社員と家族の航空券の特典', cond: 'B737 の副操縦士の求人', en: { label: 'Staff travel', value: 'Travel benefits for employees and their families', cond: 'B737 first officer vacancy' } },
  'copa-airlines.benefits.pub-panama-seniority-premium': { h: 'e6d445aa261b753f', label: '勤続の手当（パナマの法律）', value: '勤続1年につき1週間分の給与を一時金で（パナマの社員ぜんたい）', cond: '2025年の年次報告（Form 20-F）', en: { label: 'Seniority premium (Panamanian law)', value: 'One week’s pay per year of service, paid as a lump sum (all employees in Panama)', cond: '2025 annual report (Form 20-F)' } },
  'copa-airlines.jobs.pub-captain-public-apply': { h: 'b01bbeaee1fa458c', label: '応募の条件（機長）', value: 'ATP・第1種の身体検査、総飛行時間5,000時間・機長として1,000時間、ICAO レベル5（パナマ勤務）', cond: 'B737 の機長の求人', en: { label: 'Requirements (captains)', value: 'ATP and Class 1 medical, 5,000 hours total and 1,000 hours as pilot in command, ICAO level 5 (based in Panama)', cond: 'B737 captain vacancy' } },
  'copa-airlines.jobs.pub-fo-entry-hours': { h: '22623bb020a9d920', label: '応募の条件（副操縦士）', value: 'パナマ国籍は固定翼250時間、外国籍は1,000時間。事業用免許・多発の計器飛行・第1種の身体検査・ICAO レベル5・米国の観光ビザ', cond: 'B737 の副操縦士の求人', en: { label: 'Requirements (first officers)', value: '250 fixed-wing hours for Panamanian nationals and 1,000 for foreign nationals; commercial license, multi-engine instrument rating, Class 1 medical, ICAO level 5 and a US tourist visa', cond: 'B737 first officer vacancy' } },
  'copa-airlines.jobs.pub-fo-public-apply': { h: '0c265933fafeb1b4', label: '募集の受付', value: 'B737 の副操縦士の求人で応募を受付（LinkedIn の認証が要る）', cond: 'B737 の副操縦士の求人（2026年10月19日に確認）', en: { label: 'Applications', value: 'Applications open for the B737 first officer vacancy (LinkedIn sign-in required)', cond: 'B737 first officer vacancy (checked on 19 October 2026)' } },
  'copa-airlines.work.pub-training-panama-cityknowledge': { h: '3f89471bef760cf6', label: '訓練の場所', value: 'パナマシティの「知識の街（Ciudad del Saber）」の訓練施設（フルフライトシミュレーター）', cond: '2025年の年次報告（Form 20-F）', en: { label: 'Training locations', value: 'Training center with full flight simulators at the City of Knowledge (Ciudad del Saber), Panama City', cond: '2025 annual report (Form 20-F)' } },
  /* フィジー・エアウェイズ */
  'fiji-airways.jobs.application-channel': { h: '3c2a760f8985765c', label: '応募の方法', value: 'オンラインで応募（全職種）', cond: '会社の採用ページ', en: { label: 'How to apply', value: 'Online applications (all roles)', cond: 'Company careers page' } },
  'fiji-airways.jobs.missing-entry-open': { h: '10b7f7a2d76e7ee7', label: '募集の受付', value: '公開の求人一覧（6件）にパイロットの求人は無い（2026年10月19日）', cond: '会社の公開の求人一覧', en: { label: 'Applications', value: 'No pilot vacancy among the 6 public listings (19 October 2026)', cond: 'Company public job list' } },
  'fiji-airways.work.resume-a350-training': { h: 'b54bbb49949bbb33', label: '訓練の場所', value: 'Fiji Airways Aviation Academy で A350 の型式訓練（2024年12月までに41人）', cond: '2024年の年次報告（フィジー議会に提出）', en: { label: 'Training locations', value: 'A350 type rating training at Fiji Airways Aviation Academy (41 trained by December 2024)', cond: '2024 annual report (tabled in the Parliament of Fiji)' } },
  /* フロンティア航空 */
  'frontier.benefits.missing-medical': { h: 'f8c8890c3b8f76b6', label: '保険', value: '健康の制度', cond: 'パイロットの採用ページ', en: { label: 'Insurance', value: 'Health benefits', cond: 'Pilot recruitment page' } },
  'frontier.benefits.missing-staff-travel': { h: 'e01ae3e5befdfa9e', label: '社員の航空券', value: '航空券の特典', cond: 'パイロットの採用ページ', en: { label: 'Staff travel', value: 'Travel benefits', cond: 'Pilot recruitment page' } },
  'frontier.benefits.retirement': { h: '230aff2efd8510b0', label: '年金', value: '退職給付への会社の追加の拠出15%', cond: 'パイロットの採用ページ', lead: true, en: { label: 'Pension', value: 'An additional 15% company contribution to retirement benefits', cond: 'Pilot recruitment page' } },
  'frontier.jobs.fo-window': { h: '0d48951310dd57e3', label: '募集の受付', value: '副操縦士・大学の経路の受付は開いている（2026年10月19日に確認）', cond: 'パイロットの採用ページ', en: { label: 'Applications', value: 'First officer and university pathway applications are open (checked on 19 October 2026)', cond: 'Pilot recruitment page' } },
  'frontier.jobs.resume-eligibility': { h: 'a35331bcb2aa2207', label: '応募の条件', value: 'ATP、米国で働く資格、総飛行時間1,500時間', cond: 'パイロットの採用ページ', en: { label: 'Requirements', value: 'ATP, US work authorization and 1,500 hours total time', cond: 'Pilot recruitment page' } },
  'frontier.work.resume-roster-flex': { h: 'bec1eb8bc22cc721', label: 'スタンバイ（待機）', value: '空港で待つスタンバイは無い', cond: 'パイロットの採用ページ', en: { label: 'Reserve', value: 'No airport ready reserve', cond: 'Pilot recruitment page' } },
  'frontier.work.resume-upgrade-promotion': { h: 'e979433472a00af8', label: '機長への昇格の見込み', value: '2〜3年（会社の採用案内の見込み。約束ではない）', cond: 'パイロットの採用ページ', en: { label: 'Command upgrade outlook', value: '2–3 years (the company’s recruitment estimate, not a promise)', cond: 'Pilot recruitment page' } },
  /* ジェットブルー航空 */
  'jetblue.benefits.missing-housing': { h: 'ee15e6fe4d7759f5', label: '訓練の間の宿泊', value: 'オーランドの施設「The Lodge」を訓練の間の宿泊に使う', cond: '2025年の年次報告（Form 10-K）', en: { label: 'Accommodation during training', value: 'The Lodge in Orlando is used for accommodation during training', cond: '2025 annual report (Form 10-K)' } },
  'jetblue.benefits.pub-pension-q2-confirmation': { h: 'a1b5e9891e718f01', label: '年金', value: '会社の拠出17%（対象となる給与に対して・3年で権利が確定）', cond: '2026年の第2四半期の報告（Form 10-Q）', lead: true, en: { label: 'Pension', value: '17% company contributions (on eligible compensation; vesting after three years)', cond: 'Second-quarter 2026 report (Form 10-Q)' } },
  'jetblue.benefits.r8-green-option-2026': { h: '57a9891a3ceeb04e', label: '保険', value: 'パイロット（労働協約の対象）だけが選べる医療保険（Green Option）', cond: '2026年の福利厚生の案内', en: { label: 'Insurance', value: 'A medical plan option only for eligible pilots under the collective agreement (Green Option)', cond: '2026 benefits enrolment guide' } },
  'jetblue.jobs.resume-fo-open': { h: 'ed416d682ec31d4e', label: '募集の受付', value: '副操縦士を募集（求人 58773・応募の受付中）', cond: '会社の求人', en: { label: 'Applications', value: 'Hiring first officers (vacancy 58773, applications open)', cond: 'Company vacancy' } },
  'jetblue.jobs.sponsor': { h: 'b4002e3a5193af5d', label: '働く資格', value: '就労ビザの支援は無い（米国で働く資格が要る）', cond: '副操縦士の求人（58773）', en: { label: 'Right to work', value: 'No visa sponsorship (US work authorization required)', cond: 'First officer vacancy (58773)' } },
  'jetblue.profile.pub-hq-city': { h: '298ae8fbe6584035', label: '本社', value: 'ニューヨークのロングアイランドシティ', en: { label: 'Headquarters', value: 'Long Island City, New York' } },
  'jetblue.work.missing-training-location': { h: 'a381c71b1cea9ff8', label: '訓練の場所', value: 'オーランドの JetBlue University', cond: '2025年の年次報告（Form 10-K）', en: { label: 'Training locations', value: 'JetBlue University in Orlando', cond: '2025 annual report (Form 10-K)' } },
  'jetblue.work.resume-fo-schedule': { h: '6dcaf1d4807bed4e', label: '勤務の形', value: '待機や不規則な勤務があり、最長6日つづけて家を離れる', cond: '副操縦士の求人（58773）', en: { label: 'Roster', value: 'Reserve and irregular schedules, with trips of up to six days away from home', cond: 'First officer vacancy (58773)' } },
  /* ポーター航空 */
  'porter.benefits.missing-annual-leave': { h: '67fe1a2abd09b6e6', label: '休暇', value: '有給休暇と個人の休み', cond: '社員ぜんたいの特典の案内', en: { label: 'Leave', value: 'Paid vacation and personal days', cond: 'Perks for all employees' } },
  'porter.benefits.missing-medical': { h: '2b8710d94640be3c', label: '保険', value: '健康・眼科・歯科、障害、有給の病気休暇など', cond: '社員ぜんたいの特典の案内', en: { label: 'Insurance', value: 'Health, vision and dental, disability, paid sick days and more', cond: 'Perks for all employees' } },
  'porter.benefits.missing-pension': { h: '2349220df104b86a', label: '年金', value: 'RRSP・DPSP（会社のマッチングあり）', cond: '社員ぜんたいの特典の案内', en: { label: 'Pension', value: 'RRSP and DPSP with employer-matched contributions', cond: 'Perks for all employees' } },
  'porter.benefits.missing-staff-travel': { h: 'f2c12eabd82a5a6a', label: '社員の航空券', value: '本人・友人・家族の航空券の特典', cond: '社員ぜんたいの特典の案内', en: { label: 'Staff travel', value: 'Travel privileges for you, friends and family', cond: 'Perks for all employees' } },
  /* ウェストジェット航空 */
  'westjet.benefits.mainline-pension': { h: 'b9ac80409ad179b5', label: '年金', value: '会社が対象の給与の10%を拠出（本人の1%が条件）', cond: 'パイロットの採用ページ（ウエストジェット本体のパイロット）', lead: true, en: { label: 'Pension', value: 'The company contributes 10% of eligible earnings (with a 1% employee contribution)', cond: 'Pilot recruitment page (WestJet mainline pilots)' } },
  'westjet.benefits.resume-health-day1': { h: 'cf6c7fb29f3479dd', label: '保険', value: '入社の日から対象', cond: '福利厚生の案内（パイロットと一部の職種）', en: { label: 'Insurance', value: 'Coverage from day one', cond: 'Benefits guide (pilots and some specialty roles)' } },
  'westjet.benefits.resume-travel': { h: 'c842873f06cb3e4a', label: '社員の航空券', value: '空席待ちの航空券（運賃は無料・税は別）。6か月後から提携社の割引も', cond: '福利厚生の案内（社員ぜんたい）', en: { label: 'Staff travel', value: 'Standby travel (no base fare; taxes extra), plus partner-airline discounts after six months', cond: 'Benefits guide (all employees)' } },
  'westjet.work.days-mainline': { h: '3c9e7e84dbac9053', label: '月の勤務の日数', value: '乗務が決まっている月は16日まで、スタンバイ要員の月は18日まで', cond: 'ウエストジェット本体', en: { label: 'Duty days per month', value: 'Up to 16 duty days on a regular line and 18 on a reserve line', cond: 'WestJet mainline' } },
  'westjet.work.resume-bidding': { h: 'f200d39efa25ca70', label: '勤務の希望', value: '勤続の長さの順ではない方式で割り当てる', cond: 'パイロットの採用ページ', en: { label: 'Schedule bidding', value: 'Scheduling bids are not awarded by seniority', cond: 'Pilot recruitment page' } },
  /* ── 全社へ広げる e（2026-10-22）：d2 の会社の労働協約の行（AGREEMENTS に登録した協約）。cond は、どの協約の・誰の条件か。
     字に外貨の額を書かない（額は money: true ＝ 台帳の数・通貨・期間のまま、円の目安つき）。
     書かなかった行：TAP のポルトの拠点（ほかの拠点の無い1行だけで、唯一の拠点と読まれる）・TAP の旅行の優待（「社内の規程による」だけで中身が無い）・
     ブエリング航空の自分で選んだ別の住まいのタクシー（その人だけの条件で、通勤の欄ではだれでもと読まれる）・
     ユナイテッド航空の給与の時間の保証（給与の計算の時間で、乗務の時間と読み違えやすい） ── */
  /* エールフランス */
  'air-france.benefits.r10-collective-health-pnt-presence2026': { h: '988b340c79cb0619', label: '補完の医療保険', value: '現役のパイロット（PNT）も加入する団体の補完医療。協約は2026年12月31日まで延長', cond: '社員ぜんたいの補完医療の協約の改定', lead: true, en: { label: 'Supplementary health cover', value: 'A group supplementary health scheme that active pilots (PNT) also join; the agreement is extended to 31 December 2026', cond: 'Amendment to the company-wide supplementary health agreement' } },
  'air-france.benefits.r9-fmd-bicycle': { h: 'f2a929089f1fa04f', label: '自転車の通勤の補助（上限）', cond: 'フランス本土・海外県で働く社員（パイロットを含む）の2026年の協約。払い戻しの上限で、ほかの通勤の補助とは併用できない', en: { label: 'Cycling commute allowance (cap)', cond: 'Air France’s 2026 agreement for staff (pilots included) in mainland France and the overseas departments. A cap on reimbursement; cannot be combined with the other commuting allowances' } },
  'air-france.benefits.r9-fmd-carshare': { h: 'b09bfd3804a77826', label: '低排出の車の相乗りの通勤の補助（上限）', cond: 'フランス本土・海外県で働く社員（パイロットを含む）の2026年の協約。実際に払った費用の上限で、ほかの通勤の補助とは併用できない', en: { label: 'Low-emission car-sharing commute allowance (cap)', cond: 'Air France’s 2026 agreement for staff (pilots included) in mainland France and the overseas departments. A cap on costs actually paid; cannot be combined with the other commuting allowances' } },
  'air-france.benefits.r9-fmd-public-transport': { h: 'cf23dadef3c7f93a', label: '公共交通の1回券の通勤の補助（上限）', cond: 'フランス本土・海外県で働く社員（パイロットを含む）の2026年の協約。実費の払い戻しの上限で、ほかの通勤の補助とは併用できない', en: { label: 'Public-transport single-ticket commute allowance (cap)', cond: 'Air France’s 2026 agreement for staff (pilots included) in mainland France and the overseas departments. A cap on reimbursed costs; cannot be combined with the other commuting allowances' } },
  'air-france.benefits.r9-ikv-rate': { h: 'e1803ab91b420a3f', label: '車の通勤の払い戻し', value: '自宅と職場の距離（km）ごとの額で払い戻す（2026年も同じ率）', cond: 'フランス本土・海外県で働く社員（パイロットを含む）の2026年の協約。距離の上限・条件は別に決まっている', en: { label: 'Car commute reimbursement', value: 'Reimbursed at a rate per kilometer between home and work (the same rate in 2026)', cond: 'Air France’s 2026 agreement for staff (pilots included) in mainland France and the overseas departments. Distance limits and conditions are set separately' } },
  'air-france.benefits.r9-sncf-liberte': { h: '97ca5817ce12405c', label: 'SNCF の割引カード（Liberté）', value: '会社が購入の額の50%を負担', cond: 'フランス本土・海外県で働く社員（パイロットを含む）の2026年の協約。名前の入った領収書による', en: { label: 'SNCF discount card (Liberté)', value: 'The company pays 50% of the purchase price', cond: 'Air France’s 2026 agreement for staff (pilots included) in mainland France and the overseas departments. Against a named invoice' } },
  'air-france.benefits.r9-train-cap': { h: '792b37c75b58e675', label: '電車の通勤の払い戻し', value: '電車の通勤の実費を払い戻す（上限あり。2026年7月から）', cond: 'フランス本土・海外県で働く社員（パイロットを含む）の2026年の協約。決まった額を支給するものではない', en: { label: 'Rail commute reimbursement', value: 'Actual rail commuting costs are reimbursed (up to a cap, from July 2026)', cond: 'Air France’s 2026 agreement for staff (pilots included) in mainland France and the overseas departments. Not a fixed payment' } },
  /* イージージェット（スペインの協約） */
  'easyjet.benefits.c-spain-pension-alternative': { h: '8df676c355f90206', label: '企業年金と選べる報酬', value: '企業年金（Loreto Mutua）への会社の拠出と、選べる報酬の制度は、どちらか1つ', cond: 'スペインで働くイージージェットのパイロットの労働協約', en: { label: 'Company pension or flexible pay', value: 'Either the company’s contribution to the company pension (Loreto Mutua) or the flexible remuneration plan, not both', cond: 'Collective agreement for easyJet pilots in Spain' } },
  'easyjet.benefits.pub-base-parking': { h: 'd198f0abd1f01758', label: '拠点の駐車場', value: 'パイロットの拠点の車の駐車場は無料（給与の一部ではなく、なくなることもある）', cond: 'スペインで働くイージージェットのパイロットの労働協約。変えるときは組合（SEPLA）と話し合う', en: { label: 'Parking at the base', value: 'Car parking at the pilot base is free (not part of pay, and it may be withdrawn)', cond: 'Collective agreement for easyJet pilots in Spain. Changes are discussed with the union (SEPLA)' } },
  'easyjet.benefits.pub-training-lodging': { h: '5a3f8b7def4fa94e', label: '入社の訓練のあいだの宿', value: '型式の訓練のあいだは、基本給・宿・朝と夕の食事を会社が負担', cond: 'スペインで働くイージージェットのパイロットの労働協約（入社の訓練）', en: { label: 'Accommodation during initial training', value: 'During type rating training the company pays basic salary, accommodation, breakfast and dinner', cond: 'Collective agreement for easyJet pilots in Spain (initial training)' } },
  'easyjet.benefits.r10-spain-private-medical-option': { h: '2af94bc35cca1dd2', label: '民間の医療保険', value: '選べる報酬の制度から、民間の医療保険を選べる', cond: 'スペインの法で雇われ、スペインで乗務するイージージェットのパイロットの労働協約', en: { label: 'Private medical insurance', value: 'Private medical insurance can be chosen through the flexible remuneration plan', cond: 'Collective agreement for easyJet pilots employed under Spanish law and flying in Spain' } },
  'easyjet.work.c-spain-54': { h: '82e944befc7d5558', label: '勤務の形（5勤4休を選ぶとき）', value: '5日勤務・4日休みの決まった形を選べる（基本給は8%少なく、待機の期間は無い）', cond: 'スペインで働くイージージェットのパイロットの労働協約。全員の標準の形ではない', en: { label: 'Roster (if 5 on / 4 off is chosen)', value: 'A fixed 5 on / 4 off pattern can be chosen (basic salary 8% lower; no reserve periods)', cond: 'Collective agreement for easyJet pilots in Spain. Not everyone’s standard pattern' } },
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
  'ita-airways.benefits.r8-signed-sanivolo': { h: '17689cfdcfc645f2', label: '補完の医療', value: '加入した乗員は、基金（Sanivolo）で国の医療を補う医療を受けられる（会社の拠出の新しい額は2027年から）', cond: 'ITAエアウェイズの乗員（パイロットを含む）の会社の協約', en: { label: 'Supplementary health cover', value: 'Enrolled crew get health cover that supplements the national health service through a fund (Sanivolo); the new company contribution applies from 2027', cond: 'ITA Airways’ company agreement for flight crew (pilots included)' } },
  'ita-airways.benefits.r8-signed-self-commute': { h: '671119bf2fc285ce', label: '通勤', value: 'ふだんの出勤は自分の交通手段。拠点の外で泊まるときのホテルと空港の行き来は会社が手配', cond: 'ITAエアウェイズの乗員（パイロットを含む）の会社の協約（2026年9月から）', en: { label: 'Commuting', value: 'You travel to work by your own means; on layovers away from base, hotel–airport transport is arranged by the company', cond: 'ITA Airways’ company agreement for flight crew (pilots included), from September 2026' } },
  'ita-airways.benefits.r8-signed-transfer-support': { h: '3db0c7457b3a9e03', label: '会社の命令で転勤するとき', value: '旅費と荷物の運送費。家族と移るときは1か月・1人で移るときは20日の出張の扱い', cond: 'ITAエアウェイズの乗員（パイロットを含む）の会社の協約。移ってから1年以内に本人の都合で辞めると、運送費の一部を返すことがある', en: { label: 'Company-ordered transfer', value: 'Travel and removal costs, plus travel-allowance treatment for one month when moving with family or 20 days when moving alone', cond: 'ITA Airways’ company agreement for flight crew (pilots included). Part of the removal cost may be repaid if you resign within a year of moving' } },
  /* ジェットスター航空 */
  'jetstar.benefits.r8-annual-leave-fulltime': { h: '4672f6720d65ecc0', label: '年次休暇', value: '勤続1年ごとに42日（暦日。土日・祝日を含む）', cond: 'ジェットスター航空のフルタイムのパイロットの労働協約（2026年）', lead: true, en: { label: 'Annual leave', value: '42 days for each year of service (calendar days, weekends and public holidays included)', cond: 'Jetstar full-time pilots’ enterprise agreement (2026)' } },
  'jetstar.benefits.r8-base-parking': { h: 'b8186ef67957d6bd', label: '拠点の駐車場', value: '勤務のときの拠点の空港の駐車場と、駐車場からターミナルまでの送迎を会社が用意', cond: 'ジェットスター航空のパイロットの労働協約（2026年）', en: { label: 'Parking at the base', value: 'The company provides home-base airport parking on duty days and transport between the car park and the terminal where needed', cond: 'Jetstar pilots’ enterprise agreement (2026)' } },
  'jetstar.benefits.r8-company-directed-transfer': { h: 'd4e65184f49b37db', label: '会社の指示で拠点が変わるとき', value: '引っ越しの支援（家財と車の運送・保管・航空券など）を1人ずつ決める', cond: 'ジェットスター航空のパイロットの労働協約（2026年）。自分から望んだ異動は自分の負担', en: { label: 'Company-directed base change', value: 'A relocation package (removal and storage of belongings and a car, flights and more) is set for each person', cond: 'Jetstar pilots’ enterprise agreement (2026). Voluntary transfers are at your own cost' } },
  'jetstar.benefits.r8-duty-travel-medical': { h: 'ce8e98b024ba68fa', label: '業務の移動中の保険', value: '会社の指示の移動中の、緊急の医療・歯科・救援搬送を含む旅行保険', cond: 'ジェットスター航空のパイロットの労働協約（2026年）。ふだんの医療の保険ではない', en: { label: 'Insurance while traveling on duty', value: 'Travel insurance covering emergency medical and dental care and evacuation while traveling at the company’s direction', cond: 'Jetstar pilots’ enterprise agreement (2026). Not everyday health insurance' } },
  /* LATAM航空（ブラジルの協約・行は参考） */
  'latam.benefits.missing-annual-leave': { h: '3e51ae465f41ecc4', label: '年次休暇', value: '希望すれば15日ずつ2回に分けて取れる（時期は会社が決める）', cond: 'LATAM ブラジル（TAM）のパイロットの労働協約（2025〜2027年）', en: { label: 'Annual leave', value: 'Can be split into two blocks of 15 days on request (the company sets the dates)', cond: 'Collective agreement for LATAM Brasil (TAM) pilots (2025–2027)' } },
  'latam.benefits.missing-commuting': { h: '0705ae25f51b9c5c', label: '空港のあいだの移動', value: '契約の拠点と別の空港で始まる・終わる勤務は、会社が空港のあいだを無料で送る', cond: 'LATAM ブラジル（TAM）のパイロットの労働協約（2025〜2027年）。同じ都市圏の空港のあいだ', en: { label: 'Transfers between airports', value: 'When duty starts or ends at an airport other than the contract base, the company provides free transport between the airports', cond: 'Collective agreement for LATAM Brasil (TAM) pilots (2025–2027). Between airports in the same metropolitan area' } },
  'latam.benefits.missing-staff-travel': { h: '4a7b82c0c72416bd', label: '乗務の前後の移動（Passe Livre）', value: '国内線で、乗務の前後の本人の移動', cond: 'LATAM ブラジル（TAM）のパイロットの労働協約（2025〜2027年）。家族の航空券ではない', en: { label: 'Travel to and from duty (Passe Livre)', value: 'Domestic travel for the pilot only, to and from duty', cond: 'Collective agreement for LATAM Brasil (TAM) pilots (2025–2027). Not family travel' } },
  'latam.benefits.publication-health-dependent': { h: '707bb0b6b1c2dceb', label: '扶養の家族の健康保険', value: '会社が家族1人ごとの保険料の30%を負担（2026年12月から40%）', cond: 'LATAM ブラジル（TAM）のパイロットの労働協約（2025〜2027年）', en: { label: 'Dependants’ health insurance', value: 'The company pays 30% of each dependant’s premium (40% from December 2026)', cond: 'Collective agreement for LATAM Brasil (TAM) pilots (2025–2027)' } },
  'latam.work.missing-roster-pattern': { h: 'e524f3591ffb6469', label: '月の勤務表', value: '月の勤務表は5日前までに発表', cond: 'LATAM ブラジル（TAM）のパイロットの労働協約（2025〜2027年）', en: { label: 'Monthly roster', value: 'The monthly roster is published at least five days in advance', cond: 'Collective agreement for LATAM Brasil (TAM) pilots (2025–2027)' } },
  'latam.work.missing-working-time': { h: '0f19f5e39747b80d', label: '勤務と飛行の時間の上限', value: '勤務は週44時間まで。飛行は大型機が28日で100時間・年1,000時間、A320系とエンブラエルが28日で90時間・年900時間まで', cond: 'LATAM ブラジル（TAM）のパイロットの労働協約（2025〜2027年）。上限で、実際の時間や保証ではない', en: { label: 'Duty and flying time limits', value: 'Duty up to 44 hours a week; flying up to 100 hours in 28 days and 1,000 a year on widebodies, and 90 hours in 28 days and 900 a year on the A320 family and Embraer', cond: 'Collective agreement for LATAM Brasil (TAM) pilots (2025–2027). Limits, not actual or guaranteed hours' } },
  /* ノルウェー・エアシャトル（スペインの協約） */
  'norwegian.benefits.c-spain-staff-travel': { h: 'e2453a32c8366baa', label: '社員の航空券', value: 'グループの航空券の決まりが当てはまる', cond: 'スペインで働くノルウェー・エアシャトル（Norwegian Air Resources Spain）のパイロットの労働協約', en: { label: 'Staff travel', value: 'The group’s staff travel policy applies', cond: 'Collective agreement for Norwegian (Norwegian Air Resources Spain) pilots in Spain' } },
  'norwegian.benefits.pub-spain-duty-hotel': { h: '919a010025c46767', label: '乗務のときのホテル', value: '乗務中のホテルと朝食、ホテルと空港の行き来を会社が手配・負担', cond: 'スペインで働くノルウェー・エアシャトル（Norwegian Air Resources Spain）のパイロットの労働協約', en: { label: 'Layover hotels', value: 'The company arranges and pays for layover hotels with breakfast, and transport between the hotel and the airport', cond: 'Collective agreement for Norwegian (Norwegian Air Resources Spain) pilots in Spain' } },
  'norwegian.benefits.pub-spain-insurance': { h: '77220812296233c7', label: '保険', value: '病気、業務の事故によるけが・死亡、乗務の資格を失ったときの保険を会社がかける', cond: 'スペインで働くノルウェー・エアシャトル（Norwegian Air Resources Spain）のパイロットの労働協約。中身は会社が選んだ保険による', en: { label: 'Insurance', value: 'The company takes out insurance for sickness, injury or death in work accidents, and loss of license', cond: 'Collective agreement for Norwegian (Norwegian Air Resources Spain) pilots in Spain. Details follow the policies the company chooses' } },
  'norwegian.benefits.pub-spain-leave-days': { h: 'd7f9a1abbcbdb28b', label: '年次休暇', value: '年25勤務日（30暦日）', cond: 'スペインで働くノルウェー・エアシャトル（Norwegian Air Resources Spain）のパイロットの労働協約。60歳以上は5日多いなど', lead: true, en: { label: 'Annual leave', value: '25 working days a year (30 calendar days)', cond: 'Collective agreement for Norwegian (Norwegian Air Resources Spain) pilots in Spain. Five more days from age 60, among other rules' } },
  'norwegian.benefits.pub-spain-pension-plan': { h: 'f74e838ff1f43cc5', label: '年金', value: '会社の年金の拠出は給与の段（レベル）ごとに決まる（レベル1〜3は無し）', cond: 'スペインで働くノルウェー・エアシャトルの機長と副操縦士の労働協約', en: { label: 'Pension', value: 'The company’s pension contribution is set by pay level (none for levels 1–3)', cond: 'Collective agreement for Norwegian captains and first officers in Spain' } },
  'norwegian.work.c-spain-flex-2026': { h: 'b6135e5f18d820b8', label: '勤務できる日（2026年）', value: '年209日（フレキシブルの組。休暇を引く前の日数）', cond: 'スペインで働くノルウェー・エアシャトル（Norwegian Air Resources Spain）のパイロットの労働協約。実際に乗務する日数ではない', en: { label: 'Days available for duty (2026)', value: '209 a year (flexible group; before leave is deducted)', cond: 'Collective agreement for Norwegian (Norwegian Air Resources Spain) pilots in Spain. Not the number of days actually flown' } },
  'norwegian.work.pub-spain-training-bond': { h: 'd9a2d43ba7edb907', label: '訓練費の返還', value: '型式の訓練を終えて24か月以内に本人の都合で辞めると、残りの月の分を返す', cond: 'スペインで働くノルウェー・エアシャトル（Norwegian Air Resources Spain）のパイロットの労働協約', en: { label: 'Training cost repayment', value: 'If you resign within 24 months of completing type-rating training, you repay the share for the remaining months', cond: 'Collective agreement for Norwegian (Norwegian Air Resources Spain) pilots in Spain' } },
  /* ライアンエアー（スペインの協約） */
  'ryanair.benefits.pension-cap': { h: 'ad06e9b6fc5ceb86', label: '機長の年金（会社の拠出の上限）', money: true, cond: 'スペインで働くライアンエアーのパイロットの労働協約。加入は任意で、本人も同じ額まで拠出する', en: { label: 'Captain’s pension (employer contribution cap)', cond: 'Collective agreement for Ryanair pilots in Spain. Joining is voluntary; the pilot contributes up to the same amount' } },
  'ryanair.benefits.pension-fo': { h: '2f31e8faf1379f35', label: '副操縦士の年金（会社の拠出の上限）', money: true, cond: 'スペインで働くライアンエアーのパイロットの労働協約。加入は任意で、本人も同じ額まで拠出する', en: { label: 'First officer’s pension (employer contribution cap)', cond: 'Collective agreement for Ryanair pilots in Spain. Joining is voluntary; the pilot contributes up to the same amount' } },
  'ryanair.benefits.r8-es-annual-leave29': { h: 'd473f02cc0d097ee', label: '年次休暇', value: '年29勤務日（法定の30暦日を勤務日で数えたもの）', cond: 'スペインで働くライアンエアーのフルタイムのパイロットの労働協約', lead: true, en: { label: 'Annual leave', value: '29 working days a year (the statutory 30 calendar days counted in working days)', cond: 'Collective agreement for full-time Ryanair pilots in Spain' } },
  'ryanair.benefits.r8-es-health-allowance-cap': { h: '9c119dcb672fe14f', label: '機長の健康保険の手当', cond: 'スペインで働くライアンエアーのパイロットの労働協約。パイロットの手当の一部', en: { label: 'Captain’s health insurance allowance', cond: 'Collective agreement for Ryanair pilots in Spain. Part of the pilot allowance' } },
  'ryanair.benefits.r8-es-health-allowance-fo': { h: 'bf059ce855a7a17a', label: '副操縦士の健康保険の手当', cond: 'スペインで働くライアンエアーのパイロットの労働協約。パイロットの手当の一部', en: { label: 'First officer’s health insurance allowance', cond: 'Collective agreement for Ryanair pilots in Spain. Part of the pilot allowance' } },
  'ryanair.benefits.r8-es-parking-allowance': { h: '27c4d4adcbba6d01', label: '駐車の手当', cond: 'スペインで働くライアンエアーのパイロットの労働協約。パイロットの手当の一部で、無料の駐車場の約束ではない', en: { label: 'Parking allowance', cond: 'Collective agreement for Ryanair pilots in Spain. Part of the pilot allowance, not a promise of free parking' } },
  'ryanair.benefits.r8-es-staff-travel-discretionary': { h: '403cd38d5d63bcd7', label: '社員の航空券', value: '会社の裁量の制度（協約は中身を知らせることを決めているだけ）', cond: 'スペインで働くライアンエアーのパイロットの労働協約', en: { label: 'Staff travel', value: 'A discretionary company scheme (the agreement only provides that its details are communicated)', cond: 'Collective agreement for Ryanair pilots in Spain' } },
  'ryanair.work.spain-roster-cba': { h: '84e1c809a472b482', label: '勤務と休みの組み方', value: '5日勤務・4日休み（定期の訓練の時期などは別の形）', cond: 'スペインで働くライアンエアーのパイロットの労働協約（2027年3月31日まで）', en: { label: 'Roster', value: '5 on / 4 off (a different pattern during recurrent training and similar periods)', cond: 'Collective agreement for Ryanair pilots in Spain (until 31 March 2027)' } },
  /* TAPポルトガル航空 */
  'tap.benefits.pub-calendar-leave': { h: '66926ade4a6a7f0a', label: '年次休暇', value: '年42日（暦日）。長い欠勤があると減る（最低30日）', cond: 'TAPポルトガル航空のパイロットの労働協約（2023年）', lead: true, en: { label: 'Annual leave', value: '42 calendar days a year, reduced after long absences (to a minimum of 30)', cond: 'TAP Air Portugal pilots’ collective agreement (2023)' } },
  'tap.benefits.pub-dc-pension': { h: 'db6e20867e55e0e3', label: '確定拠出の年金', value: '基本の報酬の7.5%を年14回。会社が8割・本人が2割を負担', cond: 'TAPポルトガル航空のパイロットの労働協約（2023年）。2007年までに入社した人には別の経過の制度', en: { label: 'Defined-contribution pension', value: '7.5% of basic pay, 14 times a year; the company pays 80% and the pilot 20%', cond: 'TAP Air Portugal pilots’ collective agreement (2023). A separate transitional scheme applies to pilots who joined by 2007' } },
  'tap.benefits.pub-health-risk-insurance': { h: '76e036ad555ed58b', label: '健康保険', value: '地上の社員と同じ条件の団体の健康保険（乗務の仕事のリスクを考えたもの）', cond: 'TAPポルトガル航空のパイロットの労働協約（2023年）', en: { label: 'Health insurance', value: 'Group health insurance on the same terms as ground staff, taking the risks of flying into account', cond: 'TAP Air Portugal pilots’ collective agreement (2023)' } },
  'tap.benefits.r8-cbe-duty-layover-lodging': { h: '3e605e0111bd0cfd', label: '乗務で泊まるときの宿', value: '会社が適切な宿を用意（なるべく空港から1時間30分以内）', cond: 'TAPポルトガル航空のパイロットの労働協約（2023年）。ふだんの住まいの支援ではない', en: { label: 'Layover accommodation', value: 'The company provides suitable accommodation (where possible within 1 hour 30 minutes of the airport)', cond: 'TAP Air Portugal pilots’ collective agreement (2023). Not support for everyday housing' } },
  'tap.benefits.r8-cbe-mandatory-relocation': { h: '74c81ad0133d97b2', label: '国内の拠点の縮小でリスボンへ移るとき', value: '引っ越しの実費（上限あり）と、着任時の一時金（再定住費）を出す', cond: 'TAPポルトガル航空のパイロットの労働協約（2023年）。自分から移るとき・昇格や機種の移行で移るときは別', en: { label: 'Move to Lisbon when a domestic base shrinks', value: 'Actual removal costs (up to a cap) and an initial resettlement payment', cond: 'TAP Air Portugal pilots’ collective agreement (2023). Different rules for voluntary moves and moves for promotion or a type change' } },
  'tap.benefits.r8-cbe-mandatory-transfer-temporary-lodging': { h: '068e1aae472e6b24', label: '会社の命令で配置が変わるとき', value: '続けて5日の休みのあいだ、望めば宿も用意', cond: 'TAPポルトガル航空のパイロットの労働協約（2023年）。ふだんの住まいの支援ではない', en: { label: 'Company-ordered reassignment', value: 'Accommodation on request during the five consecutive days off', cond: 'TAP Air Portugal pilots’ collective agreement (2023). Not support for everyday housing' } },
  'tap.benefits.r8-cbe-operational-base-duty-transport': { h: 'c12a7fedc06ab0b3', label: '業務の移動', value: '会社の指示の審査・訓練・身体検査などの移動は、会社が交通・宿・日当を用意', cond: 'TAPポルトガル航空のパイロットの労働協約（2023年）。ふだんの通勤ではない', en: { label: 'Duty travel', value: 'For company-directed travel to checks, training, medicals and similar, the company provides transport, accommodation and per diem', cond: 'TAP Air Portugal pilots’ collective agreement (2023). Not everyday commuting' } },
  'tap.work.pub-annual-off-days': { h: '698eb5336810846f', label: '休日', value: '暦年で111日以上（月10日が基本）', cond: 'TAPポルトガル航空のパイロットの労働協約（2023年）。年次休暇を取った月などは減る', lead: true, en: { label: 'Days off', value: 'At least 111 per calendar year (10 in a normal month)', cond: 'TAP Air Portugal pilots’ collective agreement (2023). Fewer in months with annual leave and similar cases' } },
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
  'united.benefits.missing-medical': { h: '2df75b2e8a7555cd', label: '保険（医療・歯科など）', value: '医療・歯科・眼科・長期の障害・生命保険など。本人と対象の家族は入社の日から', cond: 'ユナイテッド航空のパイロットの労働協約（2023年）', en: { label: 'Insurance (medical, dental and more)', value: 'Medical, dental, vision, long-term disability, life cover and more; you and eligible dependants from the date of hire', cond: 'United Airlines pilots’ collective agreement (2023)' } },
  'united.work.missing-roster-pattern': { h: '71ed8905d66b2c5e', label: '休日', value: '乗務が決まっている月は12日以上。スタンバイ要員の月は30日の月で13日・31日の月で14日以上', cond: '2023年の協約の最低の日数', en: { label: 'Days off', value: 'At least 12 a month for lineholders; for reserves at least 13 in a 30-day month and 14 in a 31-day month', cond: 'United Airlines pilots’ collective agreement (2023). Contract minimums, not actual averages' } },
  /* ブエリング航空 */
  'vueling.benefits.pension-year4': { h: 'ec7ff35c68d6f459', label: '年金（勤続満4〜5年の会社の拠出）', money: true, cond: 'スペインの契約で働くブエリング航空のパイロットの労働協約。会社が全額を負担', en: { label: 'Pension (company contribution at 4–5 completed years)', cond: 'Collective agreement for Vueling pilots on Spanish contracts. Paid entirely by the company' } },
  'vueling.benefits.pub-cba-travel-conditions': { h: 'e9d342ab14cfdcb6', label: '社員の航空券', value: '本人と指名した人が使える航空券（年の枚数と使い方に決まりあり）', cond: 'スペインの契約で働くブエリング航空のパイロットの労働協約。家族がいつも無料という約束ではない', en: { label: 'Staff travel', value: 'Tickets for you and nominated beneficiaries (with annual limits and rules on use)', cond: 'Collective agreement for Vueling pilots on Spanish contracts. Not a promise of free travel for family at any time' } },
  'vueling.benefits.r8-benefit-basket-medical': { h: 'e914d974d870610d', label: '医療保険', value: '会社の選べる手当の枠から医療保険を選べる（会社が直接払う）', cond: 'スペインの契約で働くブエリング航空のパイロットの労働協約。職位ごとの年の上限の中で', en: { label: 'Medical insurance', value: 'Medical insurance can be chosen from the company’s flexible benefits allowance (paid directly by the company)', cond: 'Collective agreement for Vueling pilots on Spanish contracts. Within each rank’s annual limit' } },
  'vueling.benefits.r8-forced-transfer-hotel': { h: '1bb859e9c25113ce', label: '会社の命令で拠点が変わるとき', value: '朝食と空港の送迎つきのホテルに15日つづけて泊まれる', cond: 'スペインの契約で働くブエリング航空のパイロットの労働協約。自分から望んだ異動は別', en: { label: 'Company-ordered base change', value: 'Fifteen consecutive days in a hotel with breakfast and airport transfers', cond: 'Collective agreement for Vueling pilots on Spanish contracts. Voluntary transfers are different' } },
  /* ── 米国の追補（2026-10-24）：2026-10-11 に届いた米国の調査（旧形式の台帳）を、いまの形に直して取り込んだ行（パック pvr-20261024-us-…）。
     字は行の値（資料の引用）と条件から。同じ話を言う行が台帳に在るものは書いていない（行は台帳に在るが、画面には出ない） ── */
  /* デルタ航空 */
  'delta.benefits.us1011-ben-15': { h: '0543be285f87c943', label: '社員の航空券（家族）', value: '親などの家族も対象', cond: '社員ぜんたいの案内', en: { label: 'Staff travel (family)', value: 'Covers family members, including parents', cond: 'Overview for all employees' } },
  'delta.jobs.us1011-ch-010': { h: '7c3015938dcd2b8e', label: '募集の受付', value: '副操縦士の求人（28088）で応募を受け付けている（2026年10月11日の表示）', cond: '会社の採用ページ', en: { label: 'Applications', value: 'Accepting first officer applications (vacancy 28088, as shown on 11 October 2026)', cond: 'Company recruitment page' } },
  /* アメリカン航空 */
  'american.benefits.us1011-aa-d-038': { h: 'be9a6dd9212dfc7d', label: '保険（医療など）', value: '医療・処方薬・歯科・眼科などは入社の日から', cond: '社員ぜんたいの採用の案内', en: { label: 'Insurance (medical and more)', value: 'Medical, prescription, dental, vision and more from day one', cond: 'Recruitment overview for all employees' } },
  /* ユナイテッド航空 */
  'united.jobs.us1011-ua-g-003': { h: '9395b9470eb36d81', label: '働く資格', value: 'ビザの支援なしで米国で働ける資格が要る', cond: '副操縦士の採用ページ', en: { label: 'Right to work', value: 'Legal right to work in the US without sponsorship required', cond: 'First officer recruitment page' } },
  /* アラスカ航空 */
  'alaska-airlines.benefits.us1011-as-d-019': { h: '37df8f00ee7050b7', label: '年金', value: '401(k) の会社のマッチング', cond: '社員ぜんたいの採用の案内', en: { label: 'Pension', value: '401(k) with a company match', cond: 'Recruitment overview for all employees' } },
  /* アレジアント航空 */
  'allegiant.jobs.us1011-g4-g-002': { h: '68a2e196346ed8ca', label: '養成コース（Pilot Pathway）の募集', value: '受付は終わっている（2026年10月11日の表示）', cond: 'パイロットの採用ページ', en: { label: 'Pilot Pathway recruitment', value: 'Applications closed (as shown on 11 October 2026)', cond: 'Pilot recruitment page' } },
  'allegiant.work.us1011-g4-c-003': { h: 'bdf109dc67f747e3', label: '勤務の希望の出し方', value: '市販の PBS（希望を出して組む方式）へ早めに移る', cond: '新しい労働協約についての会社の発表（Form 8-K）', en: { label: 'Schedule bidding', value: 'A quick transition to a commercial preferential bidding system (PBS)', cond: 'Company announcement on the new collective agreement (Form 8-K)' } },
  /* フロンティア航空 */
  'frontier.jobs.us1011-f9-g-002': { h: '66c1e79d54177641', label: '望ましい飛行時間', value: '総飛行時間2,500時間（応募の条件は1,500時間）', cond: 'パイロットの採用ページ', en: { label: 'Preferred flight time', value: '2,500 hours total time (the requirement is 1,500 hours)', cond: 'Pilot recruitment page' } },
  'frontier.jobs.us1011-f9-g-006': { h: 'e6589f4a13f758cc', label: '大学の経路の応募の条件', value: '飛行時間250時間以上と事業用操縦士の資格', cond: '大学生向けの求人', en: { label: 'University pathway requirements', value: 'At least 250 hours and a commercial pilot certificate', cond: 'Vacancy for university students' } },
  'frontier.jobs.us1011-f9-g-007': { h: '4110c601859369ee', label: '回転翼からの移行の支援', value: '入社のクラスが始まる前に受けるジェット機への移行コースの費用を会社が出す', cond: '軍のヘリコプターのパイロット向けの求人', en: { label: 'Rotary-to-fixed-wing transition support', value: 'The company funds a jet transition course taken before the new-hire class starts', cond: 'Vacancy for military helicopter pilots' } },
  /* ジェットブルー航空 */
  'jetblue.jobs.us1011-b6-g-011': { h: '7d21645ae516a3a8', label: '応募の条件（飛行時間）', value: '総飛行時間1,500時間以上（うち固定翼の飛行機で500時間以上）', cond: '副操縦士の求人（58773）', en: { label: 'Requirements (flight time)', value: 'At least 1,500 hours total time, including at least 500 hours in fixed-wing airplanes', cond: 'First officer vacancy (58773)' } },
  'jetblue.jobs.us1011-b6-g-013': { h: 'b9689e6a9f6fd72c', label: '旅券', value: '米国の旅券か米国の永住者カードを、いま持っていること', cond: '副操縦士の求人（58773）', en: { label: 'Travel documents', value: 'Must currently hold a US passport or a US permanent resident card', cond: 'First officer vacancy (58773)' } },
  'jetblue.jobs.us1011-b6-g-015': { h: 'ced468b206431649', label: '養成コースの募集', value: 'パイロットの養成コース Gateway Select の募集', cond: 'Gateway Select の求人（58581）。会社は選考の厳しいコースと書いている', en: { label: 'Cadet recruitment', value: 'Recruiting for the Gateway Select pilot pathway', cond: 'Gateway Select vacancy (58581). The company calls it highly selective' } },
  /* ── 調べてあるのに字の無かった行（2026-10-24）：台帳の行の値と引用から。cond ＝ 誰の・どの資料の条件か。英語の対は同じ行に。
     書かなかった行（出ない）は今までの決まりのまま ── 資料の種類で勤務・待遇の欄に出ない行（組合の案内・採用会社の求人・年金基金のページなど）・
     同じ話を、画面に出ている別の行が言う行（ユナイテッド航空・サウスウエスト航空・ジェットブルー航空の米国の追補の行・ZIPAIR の勤務・JAC の年金）・
     「当社規定による」だけの行（トキエア）・給与の改定と利益の分配の式（アメリカン航空） ── */
  /* カンタス航空（短距離線のパイロットの労働協約 EBA9） */
  'qantas.work.pub-sh-minimum-xdays': { h: '4325f1fe18b006eb', label: '休日', value: '28日の勤務期間ごとに10日以上', cond: '短距離線のパイロットの労働協約。休日は原則として拠点で取る（年次休暇などのある期間は日数を按分）', en: { label: 'Days off', value: 'At least 10 days in each 28-day bid period', cond: 'Short-haul pilots’ collective agreement. Days off are normally taken at base (pro rata in periods with annual leave and similar)' } },
  'qantas.work.resume-sh-roster-publication': { h: '576a34e93df3acb9', label: '勤務表の公表', value: '勤務期間が始まる7日前までに', cond: '短距離線のパイロットの労働協約（勤務表の決まりの条項による）', en: { label: 'Roster publication', value: 'No later than 7 days before the bid period starts', cond: 'Short-haul pilots’ collective agreement (subject to its rostering rules)' } },
  'qantas.benefits.pub-sh-duty-hotel': { h: '7f0ed840281f13a8', label: '乗務先での宿泊', value: '拠点の外で夜を越す乗務では、会社が宿泊先と、空港と宿泊先のあいだの移動を用意する', cond: '短距離線のパイロットの労働協約（住宅の補助ではない）', en: { label: 'Layover accommodation', value: 'On duties with a night away from base, the company provides accommodation and transport between the airport and the accommodation', cond: 'Short-haul pilots’ collective agreement (not a housing allowance)' } },
  'qantas.benefits.pub-sh-night-home-transport': { h: '24bb4cb797a153b4', label: '深夜に拠点へ戻るときの移動', value: '最後の乗務が出発地の時刻で1時〜4時59分に2時間を超えてかかり拠点へ戻るとき、会社が自宅と空港のあいだの移動を用意する', cond: '短距離線のパイロットの労働協約。自宅が協約の決めた範囲の中にあるとき（希望すればホテルにもできる）', en: { label: 'Transport home after a late-night return', value: 'When the last duty runs for more than two hours between 1:00 and 4:59 (local time at the point of departure) and ends at base, the company provides transport between home and the airport', cond: 'Short-haul pilots’ collective agreement. Applies when home is within the area set by the agreement (a hotel may be chosen instead)' } },
  'qantas.benefits.resume-sh-super': { h: '79bb84aaaf8cdfe1', label: '年金（スーパーアニュエーション）', value: '法律が決める会社の拠出（スーパーアニュエーション・ギャランティ）以上', cond: '短距離線のパイロットの労働協約。積み立て先の基金は本人が選ぶ', en: { label: 'Superannuation', value: 'At least the statutory superannuation guarantee', cond: 'Short-haul pilots’ collective agreement. The pilot chooses the fund' } },
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
  'sas.living.pub-bgo-light-rail': { h: '46eafabfd88506f4', mode: 'train', label: 'ライトレール1号線（Skyss）：ベルゲン中心部 → ベルゲン空港', value: 'ベルゲン中心部と空港を結ぶ', en: { label: 'Light rail Line 1 (Skyss): Bergen city center → Bergen Airport', value: 'Connects the city center and the airport' } },
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
  /* ── 2026-10-29 WP-28d：ChatGPT の追加の調べ（勤務と待遇）の行。今の欄に同じ話の行が在るもの（LATAM の飛行時間の上限・ケニア航空の積立の年金など）と、
     1つの話を2行で言う行（範囲の下と上・本人と会社の拠出）の片方は書いていない（その行は出ない）── */
  'aer-lingus.benefits.pension.fc605ae3': { h: 'e53c94086edf64c6', label: '年金', value: 'パイロットの年金の制度（Irish Airlines (Pilots) Superannuation Scheme）', cond: '会社の年報（2023年）', en: { label: 'Pension', value: 'Pilots’ pension scheme (Irish Airlines (Pilots) Superannuation Scheme)', cond: 'Company annual report (2023)' } },
  'aeromexico.benefits.pension.873306a5': { h: '3439b1a97ef269c4', label: '勤続の手当', value: '辞めるときに、勤続に応じた手当（社員ぜんたい）', cond: 'グループの年次報告書（2025年度）', en: { label: 'Seniority premium', value: 'A payment based on length of service when leaving (all employees)', cond: 'Group annual report (fiscal 2025)' } },
  'air-canada.benefits.pension.a70fcbfe': { h: 'dec189eb8677ada3', label: '年金', value: '年金の制度がある（社員ぜんたい）', cond: '会社の採用ページの質問と答え', en: { label: 'Pension', value: 'Pension plans (all employees)', cond: 'Company careers FAQ' } },
  'alaska-airlines.work.roster-pattern.5ff7078c': { h: 'b2fbf29c1d72ec0c', label: '勤務の希望', value: '希望を出して勤務を割り当てる仕組み（PBS）', cond: '組合の2022年の労働協約の合意の要約', en: { label: 'Schedule bidding', value: 'Preferential bidding system (PBS)', cond: 'Union summary of the 2022 tentative agreement' } },
  'asiana.benefits.pension.8b3e4a8e': { h: 'a7ae12bad7ceb5b5', label: '年金', value: '確定給付と確定拠出の退職年金（社員ぜんたい）', cond: '会社の2025年の事業報告書', en: { label: 'Pension', value: 'Defined-benefit and defined-contribution retirement pensions (all employees)', cond: 'Company business report (2025)' } },
  'austrian.benefits.pension.28ed4118': { h: 'b8be6b9dbcbaf984', label: '年金', value: '確定拠出の企業年金（2012年7月からの乗務員はすべて）', cond: '組合の年金の協定（2023年）', en: { label: 'Pension', value: 'Defined-contribution company pension (all flight crew since July 2012)', cond: 'Union pension agreement (2023)' } },
  'austrian.work.roster-pattern.9e1f4d25': { h: '8a7554c56c30dfed', label: '勤務の形', value: '長距離の勤務は続けて14日まで（労使の協定で延ばせる）', cond: '乗務員の労働協約（2024年4月の改定）', en: { label: 'Roster', value: 'Long-haul duty periods of up to 14 days in a row (can be extended by works agreement)', cond: 'Flight crew collective agreement (April 2024 amendment)' } },
  'bamboo-airways.benefits.staff-travel.18f6bd97': { h: 'f23dee3038665c19', label: '社員の航空券', value: '自社便の航空券（社員と家族）', cond: '会社の採用ページ（社員ぜんたい）', en: { label: 'Staff travel', value: 'Tickets on the company’s own flights (employees and family)', cond: 'Company careers page (all employees)' } },
  'batik-air.work.roster-pattern.07fb7e03': { h: '2989a9b0d37eac8f', label: '休み', value: '続く7日のうち、続けて24時間以上は勤務から外れる', cond: '2024年の事故調査報告書に載った会社の運航規程', en: { label: 'Rest', value: 'At least 24 hours in a row free of duty in any 7 consecutive days', cond: 'Company operations manual quoted in a 2024 accident investigation report' } },
  'batik-air.work.working-time.f1c208ca': { h: 'c48489891cf9d3d8', label: '飛行時間の上限', value: '続く12か月で1,050時間まで', cond: '2024年の事故調査報告書に載った会社の運航規程', en: { label: 'Flying time limit', value: 'Up to 1,050 hours in any 12 calendar months', cond: 'Company operations manual quoted in a 2024 accident investigation report' } },
  'china-eastern.work.roster-pattern-cap.df43f849': { h: 'e0cb952ec82cc2a9', label: '機長の勤務の形', value: '月に21日続けて勤務', cond: '上海の A350 の機長の募集（2024年5月締切）', en: { label: 'Captain roster', value: '21 consecutive working days a month', cond: 'Shanghai A350 captain recruitment (closed May 2024)' } },
  'china-southern.benefits.staff-travel.7a921a81': { h: 'a35e56170274f08a', label: '社員の航空券', value: '社員の優待の航空券', cond: '会社の2025年の ESG 報告書（社員ぜんたい）', en: { label: 'Staff travel', value: 'Discounted staff tickets', cond: 'Company 2025 ESG report (all employees)' } },
  'fiji-airways.benefits.pension.388dba44': { h: '830fc6da95e816ea', label: '退職の給付', value: '勤続に応じた退職の給付（額は本人の契約か労働協約による）', cond: '会社の年報（2023年）', en: { label: 'Retirement benefit', value: 'Retirement payment based on length of service (amount set by individual contract or collective agreement)', cond: 'Company annual report (2023)' } },
  'garuda-indonesia.benefits.medical.24849ec8': { h: '4cc6b0f7ea14e2c0', label: '保険', value: '社員と家族の健康保険（眼鏡・出産を含む）', cond: '会社の2025年のサステナビリティ報告書', en: { label: 'Insurance', value: 'Health insurance for employees and families (including glasses and maternity)', cond: 'Company 2025 sustainability report' } },
  'garuda-indonesia.benefits.staff-travel.cde5516d': { h: '3d2c51cceb6b2f0c', label: '社員の航空券', value: '社員の割引の航空券（社内の人事のシステムで申し込む）', cond: '会社の2025年の年次報告書', en: { label: 'Staff travel', value: 'Discounted staff tickets (booked through the internal HR system)', cond: 'Company 2025 annual report' } },
  'hac.benefits.annual-leave-fo.2e5e1d42': { h: 'bee721fa16dd044f', label: '年次休暇', value: '年10〜20日', cond: '2023年の副操縦士候補生の募集要項', en: { label: 'Annual leave', value: '10 to 20 days a year', cond: '2023 first officer candidate recruitment' } },
  'hac.benefits.commuting-fo.5b69ff87': { h: '09d32dead4d8be0c', label: '通勤', value: '会社の規程で通勤費を支給', cond: '2023年の副操縦士候補生の募集要項', en: { label: 'Commuting', value: 'Commuting costs paid under company rules', cond: '2023 first officer candidate recruitment' } },
  'hac.benefits.housing-fo.93916fcb': { h: '30b62afccd4c0478', label: '社宅・寮', value: '寮は無い', cond: '2023年の副操縦士候補生の募集要項', en: { label: 'Company housing', value: 'No dormitory', cond: '2023 first officer candidate recruitment' } },
  'hac.benefits.medical-fo.6251d84d': { h: '8df96701dac5c4f3', label: '保険', value: '健康保険組合に加入', cond: '2023年の副操縦士候補生の募集要項', en: { label: 'Insurance', value: 'Member of the company health insurance society', cond: '2023 first officer candidate recruitment' } },
  'hac.benefits.staff-travel-fo.b5b42b86': { h: 'a2ccb00aac99ac35', label: '社員の航空券', value: '社員の優待搭乗の制度', cond: '2023年の副操縦士候補生の募集要項', en: { label: 'Staff travel', value: 'Staff discounted travel scheme', cond: '2023 first officer candidate recruitment' } },
  'hainan-airlines.benefits.housing.d8ef751c': { h: '818b97bdc3b098cc', label: '住宅の積立金', value: '住宅の積立金（住房公积金）に会社が拠出', cond: '会社の2025年の年次報告書', en: { label: 'Housing provident fund', value: 'Company contributions to the housing provident fund', cond: 'Company 2025 annual report' } },
  'hainan-airlines.benefits.pension.ad2e7b11': { h: 'de86242a411c7aa9', label: '年金', value: '国の基本の養老保険に会社が毎月拠出', cond: '会社の2025年の年次報告書', en: { label: 'Pension', value: 'Monthly company contributions to the basic state pension insurance', cond: 'Company 2025 annual report' } },
  'iberia.benefits.pension.6eaa55db': { h: 'f93dc1e92f703d6c', label: '年金', value: '補完の年金の基金に本人1%・会社1%（協約の基準の額に対して）', cond: 'パイロットの労働協約（2024年の改定）', en: { label: 'Pension', value: 'Supplementary pension fund: 1% from the pilot and 1% from the company (of the agreement’s reference amount)', cond: 'Pilots’ collective agreement (2024 amendment)' } },
  'icelandair.benefits.pension.6eb1b3b0': { h: '9e50681a5b3ef35a', label: '年金', value: 'パイロットの年金の基金に本人4%・会社16%（合わせて20%以上）', cond: '組合が案内する年金の基金のページ', en: { label: 'Pension', value: 'Pilots’ pension fund: 4% from the pilot and 16% from the company (at least 20% in total)', cond: 'Pension fund page linked by the pilots’ union' } },
  'indigo.benefits.pension.de1edc0b': { h: 'fb07642a486acc5e', label: '年金', value: '積立の年金（プロビデント・ファンド）と、辞めるときの一時金（グラチュイティ）', cond: '会社の年次報告書（2024〜25年度）', en: { label: 'Pension', value: 'Provident fund and gratuity (a lump sum on leaving)', cond: 'Company annual report (FY2024–25)' } },
  'indigo.benefits.staff-travel.be101714': { h: '10aa74bc0284fb38', label: '社員の航空券', value: '回数の制限の無い、空席待ちの割引の航空券（社員と家族・国内線と国際線）', cond: '会社の採用ページ（社員ぜんたい）', en: { label: 'Staff travel', value: 'Unlimited discounted standby tickets (employees and family, domestic and international)', cond: 'Company careers page (all employees)' } },
  'j-air.benefits.commuting-fo.3f4d31b6': { h: '20c157ab60c3d682', label: '通勤', value: '公共交通の通勤費（直線で20kmまで）か、車の通勤の燃料費と定額の補助（空港から20kmまで）', cond: '2023年の副操縦士候補生の募集要項', en: { label: 'Commuting', value: 'Public transport costs (up to 20 km in a straight line) or fuel costs plus a fixed allowance for driving (within 20 km of the airport)', cond: '2023 first officer candidate recruitment' } },
  'j-air.benefits.medical-fo.2ff23ef6': { h: '0f17c0e0fa34fe9c', label: '保険', value: '日本航空健康保険組合', cond: '2023年の副操縦士候補生の募集要項', en: { label: 'Insurance', value: 'Japan Airlines Health Insurance Society', cond: '2023 first officer candidate recruitment' } },
  'j-air.work.roster-pattern-fo.d4bc4c3e': { h: '0cec5227cec9b243', label: '勤務の形', value: '不規則な勤務（土日祝日・早朝深夜・年末年始を含む。泊まりの勤務あり）', cond: '2023年の副操縦士候補生の募集要項', en: { label: 'Roster', value: 'Irregular duty (including weekends, holidays, early mornings, late nights and New Year; overnight trips)', cond: '2023 first officer candidate recruitment' } },
  'korean-air.benefits.housing.38231e2a': { h: '6bc7e489dd21c36d', label: '住まい', value: '社宅と、住宅資金の融資', cond: '会社の2025年の ESG 報告書（社員ぜんたい）', en: { label: 'Housing', value: 'Company housing and housing loans', cond: 'Company 2025 ESG report (all employees)' } },
  'korean-air.benefits.medical.1729c751': { h: 'c83474c07877fadb', label: '保険', value: '健康保険に加入', cond: '会社の2025年の ESG 報告書（社員ぜんたい）', en: { label: 'Insurance', value: 'Health insurance', cond: 'Company 2025 ESG report (all employees)' } },
  'korean-air.benefits.pension.a3aeaada': { h: '05d92f5c3d72c8dd', label: '個人年金への会社の補助', money: { cur: 'KRW', n: 50000, per: 'month' }, cond: '2025年・社員ぜんたい', en: { label: 'Company contribution to a personal pension', cond: '2025, all employees' } },
  'korean-air.work.sick-leave.574d856a': { h: '63a684c7fb4f25d8', label: '病気休暇', value: '業務外の病気・けがでも、必要に応じて有給で休める', cond: '会社の2025年の ESG 報告書（社員ぜんたい）', en: { label: 'Sick leave', value: 'Paid leave as needed for illness or injury outside work', cond: 'Company 2025 ESG report (all employees)' } },
  'latam.work.sick-leave.7d4fc11e': { h: '385a54d37c3842bc', label: '病気休暇', value: '病気で国の給付を受けるあいだ、固定給との差額の50%を180日まで会社が補う（業務上の病気・けがは100%）', cond: 'パイロットの労働協約（2025〜2027年）', en: { label: 'Sick leave', value: 'While on state sickness benefit, the company tops up 50% of the gap to fixed pay for up to 180 days (100% for work-related illness or injury)', cond: 'Pilots’ collective agreement (2025–2027)' } },
  'lufthansa.benefits.pension.0d9ab1f8': { h: '25b64b2a00bd6b18', label: '年金', value: '本体（Lufthansa Classic）のパイロットに企業年金', cond: '会社の役員のストライキについての発表', en: { label: 'Pension', value: 'Company pension for Lufthansa Classic pilots', cond: 'Company statement by a board member on the pilots’ strike' } },
  'malaysia-airlines.benefits.pension.e9db7b19': { h: '2e693fb80632ed80', label: '早期退職の制度', value: 'グループの社員の早期退職の制度（申し込みの条件あり）', cond: 'グループの2024年のサステナビリティ報告書', en: { label: 'Early retirement', value: 'Group early retirement scheme for employees (eligibility conditions apply)', cond: 'Group 2024 sustainability report' } },
  'orc.benefits.commuting-cap.e55ac772': { h: 'a4add5004c18534b', label: '通勤', value: '通勤手当（額は公表されていない）', cond: '2023年の機長要員の募集要項', en: { label: 'Commuting', value: 'Commuting allowance (amount not published)', cond: '2023 captain candidate recruitment' } },
  'orc.benefits.housing-cap.def7aed8': { h: 'df0c55a5ddd5ab02', label: '住宅の補助', value: '住居手当（額は公表されていない）', cond: '2023年の機長要員の募集要項', en: { label: 'Housing allowance', value: 'Housing allowance (amount not published)', cond: '2023 captain candidate recruitment' } },
  'orc.benefits.pension-cap.8f426328': { h: '514c2bad8f460e04', label: '退職金', value: '中小企業退職金共済に加入', cond: '2023年の機長要員の募集要項', en: { label: 'Retirement allowance', value: 'Enrolled in the national small-business retirement allowance mutual aid scheme', cond: '2023 captain candidate recruitment' } },
  'orc.work.annual-days-off-cap.30d6839a': { h: 'e3254ada9e34d8a7', label: '機長の休日', value: '年114日', cond: '2023年の機長要員の募集要項', en: { label: 'Captain days off', value: '114 days a year', cond: '2023 captain candidate recruitment' } },
  'orc.work.days-off-cap.7ac9cec5': { h: '1613a7d3cd834bfa', label: '機長の休日', value: '月8〜10日', cond: '2023年の機長要員の募集要項', en: { label: 'Captain days off', value: '8 to 10 days a month', cond: '2023 captain candidate recruitment' } },
  'philippine-airlines.benefits.pension.b377669a': { h: 'e24d28634d1a37f4', label: '年金', value: '国の社会保障とは別の退職の基金（条件は会社の方針による）', cond: 'グループの2025年の年次報告書（社員ぜんたい）', en: { label: 'Pension', value: 'Retirement fund in addition to state social security (terms set by company policy)', cond: 'Group 2025 annual report (all employees)' } },
  'philippine-airlines.benefits.staff-travel.f8b03380': { h: '88d7320b857f7658', label: '社員の航空券', value: '社員と扶養の家族の旅行の特典', cond: 'グループの2025年の年次報告書（社員ぜんたい）', en: { label: 'Staff travel', value: 'Travel privileges for employees and eligible dependants', cond: 'Group 2025 annual report (all employees)' } },
  'qatar-airways.benefits.medical.036d62a0': { h: '04790b19472ce695', label: '心と体の相談', value: 'パイロットを含む乗務員の心の支援（ピアサポート）', cond: 'グループの2025/26年の年次報告書', en: { label: 'Wellbeing support', value: 'Peer support for mental wellbeing for crew, including pilots', cond: 'Group annual report 2025/26' } },
  'qatar-airways.benefits.pension.080d4499': { h: '3ad65d8f43f47156', label: '退職金', value: '勤続年数と契約で決まる（湾岸諸国の国籍の社員は国の年金に会社が拠出）', cond: 'グループの2025/26年の決算書', en: { label: 'End-of-service benefit', value: 'Based on length of service and contract (for GCC nationals, the company contributes to the national pension fund)', cond: 'Group financial statements 2025/26' } },
  'saudia.benefits.medical.3140da47': { h: 'ba24da79ac309523', label: '保険', value: '社員・家族・退職者の健康保険（2024年3月から1年の契約）', cond: '保険会社の取引所への開示（2024年1月）', en: { label: 'Insurance', value: 'Health insurance for employees, families and retirees (one-year contract from March 2024)', cond: 'Insurer’s stock exchange announcement (January 2024)' } },
  'scoot.benefits.medical.7ef29c9e': { h: 'bc0a1da6dfb8cd05', label: '心と体の相談', value: '心の健康の相談（カウンセラーにつながる）', cond: 'グループの2024/25年のサステナビリティ報告書（社員ぜんたい）', en: { label: 'Wellbeing support', value: 'Mental health counselling with live counsellors', cond: 'Group sustainability report FY2024/25 (all employees)' } },
  'south-african-airways.benefits.medical.172e8cf9': { h: '7bc1156adee0c3a9', label: '保険', value: '医療の補助か医療保険（社員ぜんたい）', cond: '会社の年次報告書（2025年3月期）', en: { label: 'Insurance', value: 'Medical aid or medical insurance (all employees)', cond: 'Company annual report (year to March 2025)' } },
  'south-african-airways.benefits.pension.ffc6992e': { h: 'b07e5929fc6073d4', label: '年金', value: '確定拠出の年金の基金（Transnet Retirement Fund・社員ぜんたい）', cond: '会社の年次報告書（2025年3月期）', en: { label: 'Pension', value: 'Defined-contribution retirement fund (Transnet Retirement Fund, all employees)', cond: 'Company annual report (year to March 2025)' } },
  'south-african-airways.benefits.staff-travel.6b5eeb52': { h: 'c93011f7b86817c3', label: '社員の航空券', value: '空席待ちの割引の航空券（社員と退職者）', cond: '会社の年次報告書（2025年3月期）', en: { label: 'Staff travel', value: 'Discounted standby tickets (employees and retirees)', cond: 'Company annual report (year to March 2025)' } },
  /* ── 2026-10-29 WP-28e：ChatGPT の追加の調べ（応募要件と募集状況）── 1つの募集の条件を1行にまとめた（手伝いの下書きを、引用に無い字を外して確かめた）。
     同じ募集のほかの行は字を書いていない（出ない）。中身の薄い募集（5つ）と、締切や更新から90日を過ぎた募集・終了と書かれた募集（24行）は書いていない ── */
  'aegean.jobs.fo-license-fo.c8e92203': { h: 'af90f0aa37de8693', label: '応募の条件（副操縦士）', value: 'EASA の ATPL(A)・A320 の型式限定・第1種の身体検査・英語は ICAO レベル4以上・EU に住んで働ける資格', cond: 'A320 の型式限定を持つ副操縦士の募集（2026年12月31日締切）', en: { label: 'Requirements (first officers)', value: 'EASA ATPL(A), A320 type rating, Class 1 medical, ICAO English Level 4, unrestricted right to live and work in the EU', cond: 'Type-rated A320 first officer vacancy (closes 31 December 2026)' } },
  'aegean.jobs.fo-license-fo.05582683': { h: 'd32132c0c263a556', label: '応募の条件（副操縦士）', value: '機長として70時間（飛行機）・EASA の ATPL(A)、または CPL(A) と ATPL の学科修了・第1種の身体検査・英語は ICAO レベル4以上・EU に住んで働ける資格', cond: '型式限定を持たない副操縦士（A320・ATR42/72）の募集（2026年12月31日締切）', en: { label: 'Requirements (first officers)', value: '70 hours PIC on aeroplanes; EASA ATPL(A), or CPL(A) with ATPL theory completed; Class 1 medical; ICAO English Level 4; unrestricted right to live and work in the EU', cond: 'Non-type-rated first officer vacancy, A320 and ATR 42/72 (closes 31 December 2026)' } },
  'aeromexico.jobs.fo-total-hours-fo.356db004': { h: 'c739d067e87c11cd', label: '応募の条件（副操縦士）', value: '総飛行1,800時間・TPI か Piloto Aviador Comercial の免許・出生によるメキシコ国籍・18歳から56歳11か月まで', cond: 'B737 NG/MAX の副操縦士の募集（パイロットの組合 ASPA・2026年10月23〜26日に登録）', en: { label: 'Requirements (first officers)', value: '1,800 hours total, TPI or Piloto Aviador Comercial license, Mexican citizen by birth, aged 18 to 56 years 11 months', cond: 'B737 NG/MAX first officer call by the ASPA pilots’ union (registration 23–26 October 2026)' } },
  'breeze-airways.jobs.fo-total-hours-fo.0fc616d3': { h: 'b4afbdd0075a94cb', label: '応募の条件（副操縦士）', value: '総飛行1,500時間以上（うち固定翼の機長250時間）・FAA の ATP、または多発・計器つきの事業用と ATP の学科合格・FAA の第1種の身体検査・英語の読み書きと会話・米国で働ける資格・23歳以上', cond: 'A220 の副操縦士の求人（JR100367・2026年10月23日に掲載）', en: { label: 'Requirements (first officers)', value: '1,500+ hours total (incl. 250 fixed-wing PIC); FAA ATP, or Commercial with multi-engine and instrument ratings plus the ATP written; FAA first-class medical; able to read, write and speak English; authorised to work in the US; aged 23 or over', cond: 'A220 first officer vacancy JR100367 (posted 23 October 2026)' } },
  'british-airways.jobs.fo-type-rating-fo.35cd0729': { h: '8fbb2aae4e81a26b', label: '応募の条件（副操縦士）', value: '英国 CAA の免許・有効な型式限定', cond: '経験者の上級副操縦士の求人（英国 CAA の免許を持つ人・会社名義の LinkedIn 広告）', en: { label: 'Requirements (first officers)', value: 'UK CAA license; current type rating', cond: 'Direct-entry senior first officer vacancy for UK CAA license holders (company LinkedIn advert)' } },
  'eagle-jet.jobs.fo-license-fo.1e2c9dd5': { h: '7dd701b56e1675e2', label: '応募の条件（副操縦士）', value: '欧州（EASA）の Frozen ATPL・飛行時間の下限なし・型式限定が無くても参加できる', cond: 'EASA の A320 副操縦士プログラムの案内', en: { label: 'Requirements (first officers)', value: 'EASA frozen ATPL, no minimum flight time, non-type-rated pilots accepted', cond: 'EASA A320 first officer program' } },
  'eagle-jet.jobs.fo-right-to-work-fo.bc98c353': { h: '98ed2134e9237f3f', label: '応募の条件（副操縦士）', value: 'EU の旅券を持つ人', cond: '欧州 EASA の A320 副操縦士プログラム（会社のプログラム一覧）', en: { label: 'Requirements (first officers)', value: 'EU passport holders', cond: 'European EASA A320 first officer program (the company’s program list)' } },
  'eurowings.jobs.fo-license-fo.4f1642f9': { h: 'bb1c99af2036f5b0', label: '応募の条件（副操縦士）', value: 'EASA ATPL(A)、または ATPL の学科単位つきの CPL(A)・第1種の身体検査・英語は ICAO レベル4以上・EU の国籍か滞在と就労の許可・型式限定は無くても可', cond: 'A320 ファミリーの副操縦士の求人（ハンブルク・デュッセルドルフ・ケルン・シュトゥットガルト）', en: { label: 'Requirements (first officers)', value: 'EASA ATPL(A), or CPL(A) with ATPL credit; Class 1 medical; ICAO English Level 4; EU citizenship or a residence and work permit; non-type-rated pilots may apply', cond: 'A320 family first officer vacancy (Hamburg, Düsseldorf, Cologne, Stuttgart)' } },
  'fiji-airways.jobs.cap-total-hours-cap.58046d7b': { h: '7e1ca18e7e591791', label: '応募の条件（機長）', value: '総飛行3,500時間（うち B737 NG/MAX の機長500時間）・ICAO の ATPL・B737 NG/MAX の型式限定・第1種の身体検査（免許と同じ当局のもの）', cond: 'B737 MAX の契約機長の募集（採用代行 Pacific Aircrew Services）', en: { label: 'Requirements (captains)', value: '3,500 hours total (incl. 500 PIC on the B737 NG/MAX), ICAO ATPL, B737 NG/MAX type rating, Class 1 medical from the license-issuing authority', cond: 'B737 MAX contract captain vacancy via Pacific Aircrew Services' } },
  'fiji-airways.jobs.fo-license-fo.b461e218': { h: '7abb416fa4589f15', label: '応募の条件（副操縦士）', value: 'ICAO の ATPL・A330 か A350 の型式限定・第1種の身体検査（ATPL と同じ当局のもの）', cond: 'A350/A330 の契約副操縦士の募集（採用代行 Pacific Aircrew Services）', en: { label: 'Requirements (first officers)', value: 'ICAO ATPL, A330 or A350 type rating, Class 1 medical from the same authority as the ATPL', cond: 'A350/A330 contract first officer vacancy via Pacific Aircrew Services' } },
  'ibex.jobs.fo-license-fo.b1e98487': { h: 'd287fa878f07f807', label: '応募の条件（副操縦士）', value: '日本の多発事業用操縦士技能証明・計器飛行証明・無線の資格・第1種の身体検査・TOEIC 600点以上（同じ程度の英語力でも可）', cond: '副操縦士要員（未経験者）の募集要項（2026年10月30日必着）', en: { label: 'Requirements (first officers)', value: 'Japanese commercial pilot license (multi-engine), instrument rating, radio license, Class 1 medical, TOEIC 600 or equivalent English', cond: 'Job posting for first officer candidates (no prior experience), applications by 30 October 2026' } },
  'indigo.jobs.cap-total-hours-cap.8c7413ba': { h: '8a2faaaee10365ab', label: '応募の条件（機長）', value: '総飛行3,000時間・インドの DGCA の ATPL・第1種の身体検査・インド国籍か OCI（インドの海外市民）・60歳まで・A320 の型式限定は無くてよい', cond: 'A320 の機長（型式限定なし）の求人（会社名義の LinkedIn 広告・2026年9月29日に掲載）', en: { label: 'Requirements (captains)', value: '3,000 hours total, DGCA-issued ATPL, Class 1 medical, Indian national or OCI holder, aged 60 or under, no A320 type rating needed', cond: 'Non-type-rated A320 captain vacancy (company LinkedIn advert, posted 29 September 2026)' } },
  'peach.jobs.cap-age-cap.4aeea870': { h: 'b058342a5b78ddb0', label: '応募の条件（機長）', value: '応募の時点で、型式限定ありは60歳未満・型式限定なしは58歳未満', cond: '機長の募集（採用代行 Flight Crew International・2026年9月30日更新）', en: { label: 'Requirements (captains)', value: 'When applying: under 60 if type-rated, under 58 if non-type-rated', cond: 'Captain recruitment via Flight Crew International (updated 30 September 2026)' } },
  'peach.jobs.cap-type-rating-cap.dfd201bf': { h: 'f920edaffc82b2c1', label: '応募の条件（機長）', value: 'A320 か、ほかのジェット機の型式限定（日本の免許を持たない人の場合）', cond: '機長の募集（会社の英語の採用ページ）', en: { label: 'Requirements (captains)', value: 'A320 or another jet type rating (for pilots without a JCAB license)', cond: 'Captain recruitment (the company’s English recruitment page)' } },
  'root-aviation.jobs.cap-total-hours-cap.ebd57df4': { h: 'e8876e77f525e560', label: '応募の条件（機長）', value: '総飛行5,000時間・多発機の機長2,000時間（うち B737NG で1,500時間）・ICAO の ATPL・B737 の型式限定・第1種の身体検査・英語はレベル5以上・56歳未満', cond: '中東の航空会社（名前は伏せてある）の B737NG 機長の募集', en: { label: 'Requirements (captains)', value: '5,000 hours total; 2,000 hours multi-engine PIC (incl. 1,500 on the B737NG); ICAO ATPL; B737 type rating; first-class medical; English Level 5 or higher; under 56', cond: 'B737NG captain vacancy at an unnamed Middle East airline' } },
  'root-aviation.jobs.fo-total-hours-fo.7e620006': { h: 'b2aeae45ea5d595e', label: '応募の条件（副操縦士）', value: '総飛行2,000時間・FAA か EASA の ATPL・有効な B737 の型式限定・英語はレベル5以上・EU の旅券', cond: '中東の航空会社（名前は伏せてある）の B737 副操縦士の募集', en: { label: 'Requirements (first officers)', value: '2,000 hours total, FAA or EASA ATPL, current B737 type rating, English Level 5 or higher, EU passport', cond: 'B737 first officer vacancy at an unnamed Middle East airline' } },
  'sas.jobs.cap-total-hours-cap.262f4fb4': { h: 'eacfea2f0bde8b73', label: '応募の条件（機長）', value: '総飛行4,000時間以上（うち最大離陸重量55トンを超える機体で機長1,000時間以上）', cond: 'A320 の経験者の機長の求人（コペンハーゲン・ストックホルム）', en: { label: 'Requirements (captains)', value: '4,000+ hours total (incl. 1,000+ PIC on aircraft over 55 tonnes MTOW)', cond: 'Direct-entry A320 captain vacancy (Copenhagen and Stockholm)' } },
  'scoot.jobs.cap-total-hours-cap.a898e1b6': { h: '57ec9a2db0807cff', label: '応募の条件（機長）', value: '総飛行5,000時間超（5,700kg 以上の機体）・定期便のマルチクルーのジェット機で機長2,000時間・CAAS の ATPL（外国の ATPL は書き換え）・B787 の型式限定・英語は ICAO レベル4以上', cond: 'B787 の経験者の機長の求人（2026年のシンガポールでの選考会・2026年10月12日に掲載）', en: { label: 'Requirements (captains)', value: 'More than 5,000 hours total on aircraft of 5,700 kg or more; 2,000 hours PIC on multi-crew jets in scheduled service; CAAS ATPL (foreign ATPLs must be converted); B787 type rating; ICAO English Level 4', cond: 'Direct-entry B787 captain vacancy, 2026 Singapore assessment center (posted 12 October 2026)' } },
  'scoot.jobs.cap-total-hours-cap.f70ab370': { h: 'cdd93796c335e620', label: '応募の条件（機長）', value: '総飛行3,500時間超（5,700kg 以上の機体）・定期便のマルチクルーのジェット機で機長1,000時間・CAAS の ATPL（外国の ATPL は書き換え）・A320 の型式限定・英語は ICAO レベル4以上', cond: 'A320 の経験者の機長の求人（2026年のシンガポールでの選考会・2026年10月21日に掲載）', en: { label: 'Requirements (captains)', value: 'More than 3,500 hours total on aircraft of 5,700 kg or more; 1,000 hours PIC on multi-crew jets in scheduled service; CAAS ATPL (foreign ATPLs must be converted); A320 type rating; ICAO English Level 4', cond: 'Direct-entry A320 captain vacancy, 2026 Singapore assessment center (posted 21 October 2026)' } },
  'scoot.jobs.fo-total-hours-fo.d0f6cb1d': { h: '371e0468816a2f61', label: '応募の条件（副操縦士）', value: '固定翼で1,500時間超（5,700kg 以上の機体）・シンガポール（CAAS）の CPL(A) か ATPL(A)（外国の免許は書き換え）・英語は ICAO レベル4以上', cond: '経験者の副操縦士の求人（2026年のシンガポールでの選考会・2026年10月18日に掲載）', en: { label: 'Requirements (first officers)', value: 'More than 1,500 hours fixed-wing on aircraft of 5,700 kg or more; CAAS CPL(A) or ATPL(A) (foreign licenses must be converted); ICAO English Level 4', cond: 'Direct-entry first officer vacancy, 2026 Singapore assessment center (posted 18 October 2026)' } },
  'skymark.jobs.fo-total-hours-fo.02a03e41': { h: '4133e412f3ed1b69', label: '応募の条件（副操縦士）', value: '国内の他社の定期便で総飛行500時間以上・TOEIC 650点以上か英検2級程度', cond: 'B737 の副操縦士候補者（他社経験者）の募集（随時・2027年3月以降の入社）', en: { label: 'Requirements (first officers)', value: '500+ hours total at another Japanese scheduled airline, TOEIC 650 or Eiken Grade 2 level English', cond: 'B737 first officer candidate recruitment for pilots from other airlines (rolling; joining from March 2027)' } },
  'starflyer.jobs.fo-age-fo.9a02086c': { h: '0d304bafe536d1ba', label: '応募の条件（副操縦士）', value: '60歳未満', cond: '副操縦士候補者の中途募集要項（2026年9月18日に募集開始）', en: { label: 'Requirements (first officers)', value: 'Under 60', cond: 'Mid-career first officer candidate posting (opened 18 September 2026)' } },
  'swiss.jobs.fo-license-fo.2c062ac3': { h: 'a6f71ceb8b7b980f', label: '応募の条件（副操縦士）', value: 'EASA の ATPL(A)、ATPL の学科つきの CPL(A)/IR、または MPL・第1種の身体検査・英語は ICAO レベル4以上・スイス国籍か EU-27・EFTA の旅券・56歳まで', cond: 'A320 の経験者の副操縦士の求人（会社名義の LinkedIn 広告）', en: { label: 'Requirements (first officers)', value: 'EASA ATPL(A), CPL(A)/IR with ATPL theory, or MPL; Class 1 medical; ICAO English Level 4; Swiss citizenship or an EU-27 or EFTA passport; aged 56 or under', cond: 'Direct-entry A320 first officer vacancy (company LinkedIn advert)' } },
  'tap.jobs.fo-total-hours-fo.26fdecac': { h: '21b4319cf846cc34', label: '応募の条件（副操縦士）', value: '飛行時間500時間以上・航空英語レベル4以上', cond: '航空ニュース Kiosque da Aviação が伝えた副操縦士の選考（2026年9月）', en: { label: 'Requirements (first officers)', value: '500+ flight hours, aviation English Level 4 or higher', cond: 'First officer selection reported by Kiosque da Aviação (September 2026)' } },
  'tap.jobs.fo-license-fo.2e62f81c': { h: 'cad6f2ba63ccd191', label: '応募の条件（副操縦士）', value: 'EASA の CPL(A)・EASA の第1種の身体検査（どちらも応募から契約の署名まで有効なこと。ポルトガルの ANAC 以外の免許は OPC までに ANAC へ移す）', cond: '副操縦士（Oficiais Piloto）の選考の規程（2026年9月）', en: { label: 'Requirements (first officers)', value: 'EASA CPL(A) and EASA Class 1 medical, both valid from application until the contract is signed (non-ANAC licenses must transfer to Portugal’s ANAC before the OPC)', cond: 'Selection rules for first officers (Oficiais Piloto), September 2026' } },
  'virgin-atlantic.jobs.fo-total-hours-fo.19f47022': { h: '9a3975138bf0bcef', label: '応募の条件（副操縦士）', value: '副操縦士は1,500時間、上級副操縦士は3,000時間（A320・A330・A350・A380 か、ボーイング 737〜787 で）・英国で働く資格が無ければ Skilled Worker ビザ（費用は会社が持つ方針）', cond: '経験者の副操縦士・上級副操縦士の採用ページ', en: { label: 'Requirements (first officers)', value: 'First officers 1,500 hours, senior first officers 3,000 hours (on the A320, A330, A350 or A380, or Boeing 737 to 787); without UK right to work, a Skilled Worker visa, with the company aiming to cover the cost', cond: 'Pilot jobs page for experienced first officers and senior first officers' } },
  /* ── 2026-11-18 ChatGPT の穴の調べ（アジア・中東・11-08 の答え）：字は行の値と引用から。cond ＝ 誰の・どの資料の条件か。
       書いていない行：スクート3行（社員の協約の対象にパイロットが入るか資料から言えない）・エアアジアの A321 P2F（貨物機。旅客便のパイロットの機材ではない）・
       ロイヤルブルネイ航空の Non-commuting（勤務の形の行が同じ話を言っている）・ベトジェットの拠点の街（拠点の空港の行が出ている） ── */
  'air-china.benefits.commuting.e9554e5d': { h: '89e2a2ea7b86fc1d', label: '通勤', value: '乗員の送迎の車は会社が手配する', cond: 'パイロットの寮の調達の公示（2025年4月）', en: { label: 'Commuting', value: 'Crew transport is arranged by Air China', cond: 'Procurement notice for a pilot apartment building (April 2025)' } },
  'air-china.benefits.staff-travel.4614621d': { h: '2cfea6bea14bc2cc', label: '社員の航空券', value: '私用の旅行に使える無料の航空券', cond: '浙江支社の人事業務の委託の公示（2025年7月・社員ぜんたい）', en: { label: 'Staff travel', value: 'Free tickets for personal travel', cond: 'Zhejiang branch HR outsourcing notice (July 2025, all employees)' } },
  'asiana.benefits.commuting.0ac32112': { h: '1cadc2299c60eaba', label: '通勤', value: '決まった路線を走る社員の通勤バス', cond: '会社の2025年の ESG 報告書（社員ぜんたい）', en: { label: 'Commuting', value: 'Staff shuttle buses on set routes', cond: 'Company 2025 ESG report (all employees)' } },
  'asiana.benefits.staff-travel.760efc57': { h: '8ddb71a05371c907', label: '社員の航空券', value: '社員と近い家族の割引の航空券', cond: '会社の2025年の ESG 報告書（社員ぜんたい）', en: { label: 'Staff travel', value: 'Discounted tickets for employees and their immediate family', cond: 'Company 2025 ESG report (all employees)' } },
  'batik-air.jobs.cap-license-cap.b5b994f7': { h: '60f171783213e1dd', label: '応募の条件（機長）', value: 'CPL と ATPL の学科', cond: '機長の求人（会社名義の LinkedIn 広告・締め切った）', en: { label: 'Requirements (captain)', value: 'CPL with ATPL theory', cond: 'Captain vacancy (company LinkedIn posting, closed)' } },
  'flydubai.benefits.commuting.c78378e5': { h: 'e26cf1f2bdd18a1e', label: '通勤', value: '交通の手当', cond: '副操縦士の採用の案内', en: { label: 'Commuting', value: 'Transport allowance', cond: 'First officer careers page' } },
  'flydubai.benefits.housing.33c00c88': { h: '6c59ebea122f2c31', label: '住宅の補助', value: '住宅手当', cond: '副操縦士の採用の案内', en: { label: 'Housing', value: 'Housing allowance', cond: 'First officer careers page' } },
  'flydubai.benefits.medical.d9742648': { h: '534eb3c02075453c', label: '保険', value: '医療保険', cond: '機長の採用の案内', en: { label: 'Insurance', value: 'Medical insurance', cond: 'Captain careers page' } },
  'flydubai.benefits.pension.857c6a74': { h: '39c5ea3e62bbb5bf', label: '退職の給付', value: '勤務を終えるときの給付（end of service benefit）', cond: '副操縦士の採用の案内', en: { label: 'Retirement benefit', value: 'End-of-service benefit', cond: 'First officer careers page' } },
  'flydubai.benefits.staff-travel.d4d24f13': { h: '15e4bd953485bfe6', label: '社員の航空券', value: '家族と友人の割引の航空券', cond: '副操縦士の採用の案内', en: { label: 'Staff travel', value: 'Concession tickets for family and friends', cond: 'First officer careers page' } },
  'flydubai.jobs.cap-license-cap.ccdb6420': { h: '699a77eb81952a8a', label: '応募の条件（機長）', value: 'ICAO の ATPL', cond: '機長の採用の案内（いま求人の一覧に空きは無い）', en: { label: 'Requirements (captain)', value: 'Valid ICAO ATPL', cond: 'Captain careers page (no vacancies listed at present)' } },
  'flydubai.jobs.cap-type-rating-cap.f1865c16': { h: '6999ae945fec0d71', label: '応募の条件（機長）', value: 'B737 の型式限定が無くても応募できる（持っている人の道は別）', cond: '機長の採用の案内', en: { label: 'Requirements (captain)', value: 'Non-type-rated pilots may apply (separate route for B737 type-rated pilots)', cond: 'Captain careers page' } },
  'flydubai.jobs.cap-total-hours-cap.f79128a6': { h: '3fd5f67df489f004', label: '応募の条件（機長）', value: '総飛行5,000時間・55トン超の多発ジェット（グラスコックピットのマルチクルー機・A318 以上）で機長1,500時間', cond: '機長の採用の案内・B737 の型式限定が無い人', en: { label: 'Requirements (captain)', value: '5,000 hours total time and 1,500 hours PIC on modern EFIS multi-crew jets over 55 tonnes (A318 or larger)', cond: 'Captain careers page, non-type-rated route' } },
  'flydubai.jobs.cap-total-hours-cap.93efad69': { h: 'b83fe6de4084d0d0', label: '応募の条件（機長）', value: '総飛行6,000時間・50トン超の多発ジェット（グラスコックピットのマルチクルー機・E190/195 など）で機長1,500時間', cond: '機長の採用の案内・B737 の型式限定が無い人', en: { label: 'Requirements (captain)', value: '6,000 hours total time and 1,500 hours PIC on modern EFIS multi-crew jets over 50 tonnes (such as the E190/195)', cond: 'Captain careers page, non-type-rated route' } },
  'flydubai.jobs.fo-license-fo.00f53374': { h: 'fdbf4bcad8edb726', label: '応募の条件（副操縦士）', value: 'ICAO の ATPL', cond: '副操縦士の採用の案内（いま求人の一覧に空きは無い）', en: { label: 'Requirements (first officer)', value: 'Valid ICAO ATPL', cond: 'First officer careers page (no vacancies listed at present)' } },
  'flydubai.jobs.fo-type-rating-fo.516ddf0f': { h: 'bbe253c52b036723', label: '応募の条件（副操縦士）', value: 'B737 の型式限定が無くても応募できる（持っている人の道は別）', cond: '副操縦士の採用の案内', en: { label: 'Requirements (first officer)', value: 'Non-type-rated pilots may apply (separate route for B737 type-rated pilots)', cond: 'First officer careers page' } },
  'flydubai.work.training-bond.79500b9c': { h: '7d57f6286901b9d1', label: '訓練の拘束（ボンド）', value: '3年', cond: '機長・副操縦士の採用の案内（型式限定の有無を問わない）', en: { label: 'Training bond', value: '3 years', cond: 'Captain and first officer careers pages (type-rated or not)' } },
  'garuda-indonesia.work.roster-pattern.516ecc9d': { h: '7049119a40d76589', label: '勤務の形', value: 'ビッドで希望を出して組む勤務表（休暇や変更の申し込みも同じシステムで、チーフパイロットが確認する）', cond: '会社の2023年の年次報告書（IT の節）', en: { label: 'Roster', value: 'Bid-based rostering (leave and schedule-change requests go through the same system and are reviewed by the chief pilot)', cond: 'Company 2023 annual report (IT section)' } },
  'juneyao-airlines.benefits.commuting.4d4d82ea': { h: '54ef235ee32d8d71', label: '通勤', value: '決まった路線を走る社員の通勤バス', cond: '2026年の新卒採用の案内（職種ぜんたい・大学の就職のページに掲載）', en: { label: 'Commuting', value: 'Staff shuttle buses on set routes', cond: '2026 graduate recruitment brochure (all roles, posted on a university careers site)' } },
  'juneyao-airlines.benefits.housing.2cbe16f6': { h: 'f62944193f678654', label: '住宅の補助', value: '社員寮（入れる人は限られる）', cond: '2026年の新卒採用の案内（職種ぜんたい・大学の就職のページに掲載）', en: { label: 'Housing', value: 'Company apartments (limited eligibility)', cond: '2026 graduate recruitment brochure (all roles, posted on a university careers site)' } },
  'juneyao-airlines.benefits.medical.e090c307': { h: '6d8daa3cd147f0d1', label: '保険', value: '医療保険（社会保険）', cond: '会社の2024年の年次報告書（社員ぜんたい）', en: { label: 'Insurance', value: 'Medical insurance (social insurance)', cond: 'Company 2024 annual report (all employees)' } },
  'juneyao-airlines.benefits.pension.cbf97966': { h: '053fac878b3f921f', label: '年金', value: '国の年金保険（養老保険）に加入', cond: '会社の2024年の年次報告書（社員ぜんたい）', en: { label: 'Pension', value: 'Enrolled in the state pension insurance scheme', cond: 'Company 2024 annual report (all employees)' } },
  'juneyao-airlines.benefits.staff-travel.877a7a69': { h: '6100fcfc39edb6bc', label: '社員の航空券', value: '社員の割引の航空券', cond: '2026年の新卒採用の案内（職種ぜんたい・大学の就職のページに掲載）', en: { label: 'Staff travel', value: 'Discounted staff tickets', cond: '2026 graduate recruitment brochure (all roles, posted on a university careers site)' } },
  'malaysia-airlines.benefits.staff-travel.9a8abac4': { h: '6a381aa356daaf0f', label: '社員の航空券', value: '年1回の無料の席の確約された券・席の確約された券は75%引き・空席待ちの券は90%引き・提携の航空会社の空席待ちの割引の券', cond: 'グループの2025年のサステナビリティ報告書（社員ぜんたい）', en: { label: 'Staff travel', value: 'One free confirmed ticket a year, confirmed tickets at 75% off, standby tickets at 90% off, and discounted standby travel on partner airlines', cond: 'Group 2025 sustainability report (all employees)' } },
  'malaysia-airlines.benefits.staff-travel.f9d92d9f': { h: '55e31b67bb60e91e', label: '社員の航空券', value: '席の確約された券は75%引き', cond: 'グループの2025年のサステナビリティ報告書（社員ぜんたい）', same: 'malaysia-airlines.benefits.staff-travel.9a8abac4', en: { label: 'Staff travel', value: 'Confirmed tickets at 75% off', cond: 'Group 2025 sustainability report (all employees)' } },
  'malaysia-airlines.benefits.staff-travel.c7bde63b': { h: 'c23997b3fd534716', label: '社員の航空券', value: '空席待ちの券は90%引き', cond: 'グループの2025年のサステナビリティ報告書（社員ぜんたい）', same: 'malaysia-airlines.benefits.staff-travel.9a8abac4', en: { label: 'Staff travel', value: 'Standby tickets at 90% off', cond: 'Group 2025 sustainability report (all employees)' } },
  'malaysia-airlines.benefits.staff-travel.3bf940eb': { h: 'd7c462e1258cfa2d', label: '社員の航空券', value: '提携の航空会社の空席待ちの割引の券', cond: 'グループの2025年のサステナビリティ報告書（社員ぜんたい）', same: 'malaysia-airlines.benefits.staff-travel.9a8abac4', en: { label: 'Staff travel', value: 'Discounted standby travel on partner airlines', cond: 'Group 2025 sustainability report (all employees)' } },
  'thai-airways.benefits.commuting.1d2a420a': { h: '15cdc65fa9f5371e', label: '通勤', value: '社員の送迎に電気のシャトルバス（4台）', cond: '会社の持続可能な開発の目標のページ（社員ぜんたい）', en: { label: 'Commuting', value: 'Electric shuttle buses for staff transport (4 buses)', cond: 'Company sustainable development goals page (all employees)' } },
  /* ★2026-11-18 調べの答え6本と、前から台帳に在った第三者の資料の行 ── 比べられる条件の形に直した字（off は出さない理由） */
  'aeromexico.jobs.fo-total-hours-fo.356db004': { h: 'c739d067e87c11cd', label: '応募に要る飛行時間', value: '1,800時間以上', cond: '副操縦士・B737・2026年10月', en: { label: 'Minimum total time', value: '1,800 hours', cond: 'First Officer, B737, October 2026' } },
  'air-india.benefits.commuting.1e0ce858': { h: '2a9cdc51879f3e1d', off: '重複（同じ話を別の行が言っている）' },
  'air-india.benefits.commuting.87fc6cf5': { h: '8482ef0e9a766f5a', off: '中身が無い（乗員の送迎アプリを入れたとだけ）' },
  'air-india.benefits.commuting.c46f7c61': { h: 'bc07129973bf3b99', label: '家からの送迎', value: 'スタンバイで呼ばれたとき会社が送迎（用意できなければ交通費を精算）', lead: true, en: { label: 'Crew transport from home', value: 'Company transport when called out from standby (alternate transport reimbursed)' } },
  'air-india.benefits.commuting.f8c713b2': { h: '05504e402ac88d7b', off: '訓練のときの移動で、通勤の条件ではない' },
  'air-peace.base.pilot-base-city.12c8aee6': { h: '1146cee34d72a3e6', off: '重複（同じ拠点を空港の行が言っている）' },
  'air-peace.benefits.annual-leave.6551cf97': { h: '6063e59cb2fcba0b', label: '年次休暇', value: '年20日（勤務日）', cond: '社員全体', en: { label: 'Annual leave', value: '20 working days a year', cond: 'All staff' } },
  'air-peace.benefits.commuting.3896da43': { h: '58a12a14bdee863c', off: '家からの通勤ではない（本社と空港のあいだの送迎）' },
  'air-peace.benefits.housing.c165c791': { h: '0d02e70e32f2ba40', label: '住宅', value: '会社が用意（家具つき）', cond: '契約のパイロット・2026年', lead: true, en: { label: 'Housing', value: 'Furnished apartment provided', cond: 'Contract pilots, 2026' } },
  'air-peace.benefits.medical.fa694d05': { h: '7ffb42c7afaf88d2', label: '医療保険', value: 'あり（世界で使える・本人負担なし）', cond: '契約のパイロット・2026年', en: { label: 'Medical insurance', value: 'Global coverage, free of charge', cond: 'Contract pilots, 2026' } },
  'air-peace.benefits.pension.470faf2a': { h: '7261ed6279919fdf', off: '国の年金制度への事業主の登録で、パイロットの条件と言えない' },
  'air-peace.benefits.staff-travel.1e521ca4': { h: '3c3b5e8a05421368', label: '社員の航空券', value: 'あり（国内線・地域路線・国際線）', cond: '契約のパイロット・2026年', en: { label: 'Staff travel', value: 'Domestic, regional and international', cond: 'Contract pilots, 2026' } },
  'air-peace.fleet.embraer-erj-145.3296cca3': { h: 'bf4138fa53fae018', fleet: 'エンブラエル ERJ145', en: { fleet: 'Embraer ERJ145' } },
  'air-peace.jobs.cap-license-cap.05d325d6': { h: '2c4c07aefe1fd83b', label: '応募に要る免許', value: 'ATPL・第1種の身体検査・英語レベル4以上', cond: '機長・副操縦士・エンブラエル', en: { label: 'License required', value: 'ATPL, Class 1 medical, ICAO English Level 4+', cond: 'Captains and First Officers, Embraer' } },
  'air-peace.jobs.cap-posting-cap.6e48dfdd': { h: 'ceb766f65a7f70f4', label: '募集', value: '機長・副操縦士を募集中', cond: 'エンブラエル E170〜E195・2026年12月12日締切', en: { label: 'Hiring', value: 'Captains and First Officers', cond: 'Embraer E170–E195, closes December 12, 2026' } },
  'air-peace.jobs.cap-right-to-work-cap.8be804d1': { h: '775050d79ddc4a30', label: '外国籍の応募', value: '可（ビザは会社が手配か費用を精算）', cond: '機長・副操縦士・2026年', en: { label: 'Expat applicants', value: 'Accepted (visa arranged or reimbursed by the company)', cond: 'Captains and First Officers, 2026' } },
  'air-peace.jobs.cap-total-hours-cap.914257d5': { h: 'c10df19226b9fc54', label: '応募に要る飛行時間', value: '5,000時間以上', cond: '機長・エンブラエル・2026年', en: { label: 'Minimum total time', value: '5,000 hours', cond: 'Captain, Embraer, 2026' } },
  'air-peace.jobs.cap-type-rating-cap.120b8e90': { h: '165d33fa599c08ef', label: '型式限定', value: 'エンブラエルの型式限定が必要', cond: '機長・副操縦士・2026年', en: { label: 'Type rating', value: 'Embraer type rating required', cond: 'Captains and First Officers, 2026' } },
  'air-peace.jobs.fo-license-fo.166df7a5': { h: '85bb0a95cb68e2a1', off: '重複（同じ話を別の行が言っている）' },
  'air-peace.jobs.fo-posting-fo.ab3bf94f': { h: '6ec21190d2dbe2de', off: '重複（同じ話を別の行が言っている）' },
  'air-peace.jobs.fo-right-to-work-fo.ea0cc21a': { h: '5e54d2a19e78a4be', off: '重複（同じ話を別の行が言っている）' },
  'air-peace.jobs.fo-total-hours-fo.500c2b67': { h: '43e874b42271d8b9', label: '応募に要る飛行時間', value: '2,000時間以上', cond: '副操縦士・エンブラエル・2026年', en: { label: 'Minimum total time', value: '2,000 hours', cond: 'First Officer, Embraer, 2026' } },
  'air-peace.jobs.fo-type-rating-fo.4d3d83a4': { h: 'c3df69f94e3c8fa8', off: '重複（同じ話を別の行が言っている）' },
  'air-peace.scale.fleet-total.bcdccdd8': { h: '1f39aed4e5616cf1', label: '運航している機材', value: '16機', cond: '2025年6月', en: { label: 'Aircraft in service', value: '16', cond: 'June 2025' } },
  'air-peace.work.days-off.cda9bb8b': { h: 'e616e5c7ee78b9b6', off: '重複（同じ話を別の行が言っている）' },
  'air-peace.work.roster-pattern.04afd6f1': { h: '76f8d3656399259a', label: '勤務の組み方', value: '8週勤務・3週休み', cond: '契約のパイロット・2026年', lead: true, en: { label: 'Work pattern', value: '8 weeks on, 3 weeks off', cond: 'Contract pilots, 2026' } },
  'air-peace.work.training-bond.6d607158': { h: 'cfb26021e8297147', off: '会長の発言で、額は訓練にかかる費用（パイロットの条件として言えない）' },
  'air-peace.work.upgrade-years.73babc20': { h: '49ae17105cc94832', label: '機長への昇格', value: '2年', cond: '自社養成のパイロット', en: { label: 'Upgrade to captain', value: '2 years', cond: 'Cadet-trained pilots' } },
  'air-peace.work.working-time.474487ab': { h: 'd8331eef8b01f2af', label: 'フライトタイムの上限', value: '暦年で900時間', en: { label: 'Flight time limit', value: '900 hours per calendar year' } },
  'airasia.benefits.commuting.8caf0035': { h: 'a2889808f6babf83', off: 'パイロットの条件ではない（地上職の業務の説明）' },
  'airasia.work.roster-pattern.0d43d27f': { h: '5ebebadd16f32a4b', off: '手続きの話（休暇の申請の窓口）' },
  'airasia.work.roster-pattern.3926155e': { h: 'ff415ff4eee6d34a', off: 'パイロットの条件ではない（地上職の業務の説明・スタンバイがあるとだけ）' },
  'airasia.work.training-bond.32cd6e73': { h: '558d0539c4a64ec1', label: '勤続の約束（ボンド）', value: 'あり', cond: '訓練生', en: { label: 'Training bond', value: 'Yes', cond: 'Cadets' } },
  'alaska-airlines.work.days-off.12fb6db9': { h: '2c9bfe56bf18767a', label: '休日', value: '月12日以上（31日の月は13日以上）', cond: 'スタンバイ要員を除く・2025年', lead: true, en: { label: 'Days off', value: 'At least 12 a month (13 in 31-day months)', cond: 'Lineholders, 2025' } },
  'alaska-airlines.work.days-off.c47b0a40': { h: '80ce2626916c0604', off: '重複（同じ話を別の行が言っている）' },
  'alaska-airlines.work.roster-pattern.5ff7078c': { h: 'b2fbf29c1d72ec0c', label: '勤務の希望（ビッド）', value: 'あり（勤続の長い順に割り当て）', cond: '2022年から', en: { label: 'Bidding', value: 'Yes (PBS, awarded by seniority)', cond: 'Since 2022' } },
  'alaska-airlines.work.sick-leave.0a3595bc': { h: 'f5af88996714046a', label: '有給の病気休暇', value: '月5.5時間ずつ積み立て', cond: '2025年', en: { label: 'Paid sick leave', value: 'Accrues 5.5 hours a month', cond: '2025' } },
  'allegiant.base.r2x-bli-closing-november': { h: 'ddc1512f763a16e5', off: '2026年11月に閉じる拠点（今の拠点として出せない）' },
  'allegiant.benefits.r8-annual-leave-1': { h: 'd2fa4fc9ed151c4e', label: '年次休暇', value: '年7日（1年目）〜28日（9年目以上）', lead: true, en: { label: 'Annual leave', value: '7 days (year 1) to 28 days (year 9 and later)' } },
  'allegiant.benefits.r8-annual-leave-2to4': { h: 'e4ca417873711707', off: '重複（同じ話を別の行が言っている）' },
  'allegiant.benefits.r8-annual-leave-5to8': { h: 'f25126bb23044d4c', off: '重複（同じ話を別の行が言っている）' },
  'allegiant.benefits.r8-annual-leave-9plus': { h: '152f21698ab67383', off: '重複（同じ話を別の行が言っている）' },
  'american.base.pilot-base-city.a2ac86f3': { h: 'ae64412b70b0370c', label: '拠点', value: 'ダラス・フォートワース', en: { label: 'Base', value: 'Dallas/Fort Worth' } },
  'asiana.jobs.pilot-license.2e012e86': { h: 'ed50c21954163cb0', label: '応募に要る免許', value: '事業用操縦士・多発限定・計器飛行証明（韓国の免許）', cond: '軍出身の新人パイロット', en: { label: 'License required', value: 'Korean CPL with multi-engine and instrument ratings', cond: 'Ex-military new-hire pilots' } },
  'asiana.jobs.pilot-total-hours.2c5852f8': { h: '8916a8760ddd0867', label: '応募に要る飛行時間', value: '1,000時間以上（固定翼）', cond: '軍出身の新人パイロット', en: { label: 'Minimum total time', value: '1,000 hours fixed-wing', cond: 'Ex-military new-hire pilots' } },
  'bamboo-airways.scale.fleet-total.c715fb75': { h: '4e732f209305cd5f', label: '運航している機材', value: '1機', cond: '2026年9月', en: { label: 'Aircraft in service', value: '1', cond: 'September 2026' } },
  'delta.base.pilot-base.4578a66e': { h: '54a9936455ed0c68', off: '拠点ではない（LAX の拠点に属する発着空港）' },
  'delta.base.pilot-base.5410478a': { h: '154c11a938d60717', off: '拠点ではない（LAX の拠点に属する発着空港）' },
  'delta.base.pilot-base.6d14f81d': { h: '3a7a31a68165e850', off: '拠点ではない（LAX の拠点に属する発着空港）' },
  'delta.base.pilot-base.9887e692': { h: 'c041f13ad230a157', off: '拠点ではない（ニューヨークの拠点に属する発着空港）' },
  'delta.base.pilot-base.bbaf970e': { h: 'c01af5549e4da123', off: '拠点ではない（LAX の拠点に属する発着空港）' },
  'egyptair.base.pilot-base-city.c0a05e96': { h: '0c851c93c1d4b930', off: '重複（同じ拠点を空港の行が言っている）' },
  'egyptair.benefits.annual-leave.bcfc8196': { h: 'cfc4fd45ed7a184b', label: '年次休暇', value: '最大年45日', cond: '勤続の長いパイロット', lead: true, en: { label: 'Annual leave', value: 'Up to 45 days a year', cond: 'Senior pilots' } },
  'egyptair.benefits.staff-travel.fe5befc5': { h: '924e64896fb5927a', label: '社員の航空券', value: '90%割引（ID90）・自社便とスターアライアンス', cond: '本人と家族', en: { label: 'Staff travel', value: 'ID90 on EgyptAir and Star Alliance carriers', cond: 'Pilots and family' } },
  'egyptair.work.days-off.21c11a4d': { h: '7f85502dda1bdb11', label: '休日', value: '4週で6日以上', en: { label: 'Days off', value: 'At least 6 in any 4 weeks' } },
  'egyptair.work.roster-pattern.26939dd7': { h: 'b14579115a8715de', off: '意味が取れない（何の15日か引用でわからない）' },
  'egyptair.work.working-time.c45b711f': { h: 'e0bd29c87acdc32e', label: '月のブロックタイム', value: '月70〜85時間', lead: true, en: { label: 'Monthly block hours', value: '70–85 hours a month' } },
  'ethiopian-airlines.base.pilot-base-city.f899bb06': { h: '84bd9bb417ade2f2', off: '重複（同じ拠点を空港の行が言っている）' },
  'ethiopian-airlines.benefits.r12-cba-firstyear-leave': { h: '0127e5034d86d653', label: '年次休暇', value: '年16日（勤務日）', cond: '勤続1年目', lead: true, en: { label: 'Annual leave', value: '16 working days a year', cond: 'First year of service' } },
  'fiji-airways.jobs.cap-total-hours-cap.58046d7b': { h: '7e1ca18e7e591791', label: '応募に要る飛行時間', value: '3,500時間以上', cond: '契約の機長・B737 MAX', en: { label: 'Minimum total time', value: '3,500 hours', cond: 'Contract captain, B737 MAX' } },
  'fiji-airways.jobs.fo-license-fo.b461e218': { h: '7abb416fa4589f15', label: '応募に要る免許', value: 'ATPL（ICAO）', cond: '契約の副操縦士・A350/A330', en: { label: 'License required', value: 'ICAO ATPL', cond: 'Contract first officer, A350/A330' } },
  'flydubai.base.pilot-base-city.37b1073c': { h: '40918de7630d25b1', off: '重複（同じ拠点を空港の行が言っている）' },
  'garuda-indonesia.benefits.commuting.7f3da718': { h: '547ef5e8e3bbc630', label: '家からの送迎', value: 'あり', cond: '2023年', lead: true, en: { label: 'Crew transport from home', value: 'Yes', cond: '2023' } },
  'gulf-air.base.pilot-base-city.2a110602': { h: 'ce649094313e523d', off: '重複（同じ拠点を空港の行が言っている）' },
  'gulf-air.benefits.commuting.137f3219': { h: 'c4c953651d4787ce', off: 'パイロットの条件ではない（地上職の業務の説明）' },
  'hong-kong-express.benefits.commuting.0f9151cb': { h: '20a0f8221e197e7b', label: '本土からの通勤', value: '深圳・珠海などに住んで通える', cond: '中国本土出身のパイロット', lead: true, en: { label: 'Commuting from mainland China', value: 'May live in Shenzhen, Zhuhai or other Greater Bay Area cities', cond: 'Pilots from mainland China' } },
  'indigo.base.pilot-base-city.58903057': { h: '0b5730bd0cd71743', off: '重複（同じ拠点を空港の行が言っている）' },
  'indigo.benefits.annual-leave-cap.5ea890e7': { h: 'e12249a181a0d82f', label: '年次休暇', value: '年42日', cond: '機長', lead: true, en: { label: 'Annual leave', value: '42 days a year', cond: 'Captain' } },
  'indigo.benefits.annual-leave-fo.22d593b2': { h: '21818b5a544d4fa4', label: '年次休暇', value: '年22日', cond: '副操縦士', en: { label: 'Annual leave', value: '22 days a year', cond: 'First Officer' } },
  'indigo.work.roster-pattern.b0a35365': { h: '313d7f40d87f2b4f', label: '勤務日数', value: '週5〜6日', cond: '自社養成の課程から入るパイロット', en: { label: 'Workdays', value: '5–6 days a week', cond: 'Cadet program graduates' } },
  'indigo.work.roster-pattern.e5bdf44c': { h: 'c9cb5bf2239fc7bf', label: '勤務表の発表', value: '毎月25日（翌月分）', en: { label: 'Roster publication', value: '25th of each month (for the next month)' } },
  'indigo.work.training-bond-fo.5f8141ef': { h: '83cc98a4dc5b4a9c', label: '訓練の保証金（日付なしの小切手）', money: { cur: 'INR', n: 3000000, per: 'once' }, cond: '訓練生・契約に反したときだけ換金', en: { label: 'Training security (undated check)', cond: 'Cadets; cashed only if the contract is breached' } },
  'indigo.work.training-bond-fo.af0f7afc': { h: '1949ecb0bd281fc5', label: '勤続の約束（ボンド）', value: '5年', cond: '訓練生', en: { label: 'Training bond', value: '5 years', cond: 'Cadets' } },
  'indigo.work.upgrade-years-fo.cb3d598e': { h: 'a660c16419cadbe5', label: '機長への昇格', value: '約4年（上級副操縦士から）', lead: true, en: { label: 'Upgrade to captain', value: 'About 4 years from senior first officer' } },
  'kenya-airways.base.pilot-base-city.8e2f7472': { h: '84180e77397ec35a', off: '重複（同じ拠点を空港の行が言っている）' },
  'kenya-airways.benefits.annual-leave.7b9d561c': { h: '6017a220eb257fa3', off: '逸話（休めずにたまった休暇の話）' },
  'kenya-airways.benefits.commuting-fo.f8d02d36': { h: 'a1f62e003f964af5', label: '通勤の手当', money: { cur: 'KES', n: 13949, per: 'month' }, cond: '副操縦士・B767', lead: true, en: { label: 'Transport allowance', cond: 'First Officer, B767' } },
  'kenya-airways.benefits.staff-travel.6150094a': { h: '02a427dd16c7c819', label: '社員の航空券', value: '年2回まで無料（各回4人まで同行可）', cond: '社員全体', en: { label: 'Staff travel', value: '2 free trips a year, each with up to 4 companions', cond: 'All staff' } },
  'kenya-airways.work.days-off-fo.8a7270ef': { h: '5f2af57f480509d9', label: '休日', value: '28日で8日以上', cond: '副操縦士', lead: true, en: { label: 'Days off', value: 'At least 8 in a 28-day roster', cond: 'First Officer' } },
  'kenya-airways.work.roster-pattern-fo.eeec53b2': { h: 'aaa235a0a09ca26f', off: '重複（同じ話を別の行が言っている）' },
  'kenya-airways.work.training-bond-fo.2085d06a': { h: 'd062d7bb7383e719', label: '勤続の約束（ボンド）', value: '2年（型式限定の訓練）', cond: '副操縦士', en: { label: 'Training bond', value: '2 years (type rating course)', cond: 'First Officer' } },
  'kenya-airways.work.upgrade-years.93dc1f55': { h: 'c75b2866ed29d43a', label: '機長への昇格', value: '副操縦士から5〜7年', en: { label: 'Upgrade to captain', value: '5–7 years from first officer' } },
  'kenya-airways.work.working-time-fo.c23f2c6f': { h: '0131130b39532f63', label: '年のフライトタイム', value: '年800〜900時間', cond: '副操縦士', en: { label: 'Annual flight time', value: '800–900 hours a year', cond: 'First Officer' } },
  'korean-air.benefits.commuting.e36b169f': { h: '50d7b85d9075d285', label: '通勤の航空券', value: '自社便で会社が手配（ビジネスクラスが基本）', cond: '外国人契約のパイロット', lead: true, en: { label: 'Commuting tickets', value: 'On Korean Air flights, arranged by the company (typically business class)', cond: 'Expat contract pilots' } },
  'korean-air.work.r2d-tas-captain-sick-days': { h: '84ebf531977c088f', label: '有給の病気休暇', value: '年14日', cond: '外国人契約の機長', lead: true, en: { label: 'Paid sick leave', value: '14 days a year', cond: 'Expat contract captain' } },
  'kuwait-airways.benefits.commuting.cbb162f7': { h: 'dc56b19d3020916e', label: '通勤の手当', value: 'あり', en: { label: 'Transport allowance', value: 'Yes' } },
  'kuwait-airways.benefits.medical.5363d489': { h: 'f54155ffd96bb171', label: '社内の診療', value: 'あり（乗員向けの医療センター）', en: { label: 'In-house medical care', value: 'Yes (in-house aeromedical center)' } },
  'kuwait-airways.benefits.pension.b63d9735': { h: 'f37f085f006fbf90', label: '年金', value: 'あり（パイロットと技術者の年金制度）', cond: '2025年', lead: true, en: { label: 'Pension', value: 'Yes (pilots and engineers pension plan)', cond: '2025' } },
  'kuwait-airways.benefits.staff-travel.703ac675': { h: 'a16b6a64f6eb6fb9', label: '社員の航空券', value: 'あり', cond: '社員全体', en: { label: 'Staff travel', value: 'Yes', cond: 'All staff' } },
  'malaysia-airlines.benefits.annual-leave.8faeba79': { h: 'ce2c2f65f4ffb3ae', label: '年次休暇', value: '年21日', cond: '社員全体・2022年', lead: true, en: { label: 'Annual leave', value: '21 days a year', cond: 'All staff, 2022' } },
  'malaysia-airlines.benefits.commuting.ac6fb4c2': { h: 'c11c5ebeea29d98d', off: 'パイロットの条件ではない（地上職の業務の説明）' },
  'malaysia-airlines.work.roster-pattern.83968f5b': { h: '6ec0f5f14aeea796', off: '手続きの話（臨時の休暇の承認）' },
  'malaysia-airlines.work.roster-pattern.b365c0a4': { h: '00bbcc115f5efa06', off: 'パイロットの条件ではない（地上職の業務の説明・スタンバイがあるとだけ）' },
  'peach.jobs.cap-age-cap.4aeea870': { h: 'b058342a5b78ddb0', label: '応募の年齢', value: '60歳未満', cond: '機長（型式限定あり）', en: { label: 'Age limit', value: 'Under 60', cond: 'Type-rated captain' } },
  'philippine-airlines.work.roster-pattern-fo.dc7bcb83': { h: '0123e043bfe81bc3', off: '口コミの不満で、決まりとして言えない' },
  'philippine-airlines.work.roster-pattern.2998c056': { h: 'fd492e6b187784f2', off: '逸話（祝日の乗務を進んで引き受ける話）' },
  'philippine-airlines.work.roster-pattern.e5ad4d99': { h: '6416ff745f8cc4cf', off: 'パイロットの条件ではない（地上職の業務の説明）' },
  'qatar-airways.benefits.commuting-fo.ac57d116': { h: 'e5f3fe2743851d90', label: '通勤の手当', money: { cur: 'QAR', n: 2000, per: 'month' }, cond: '副操縦士・B777', en: { label: 'Transport allowance', cond: 'First Officer, B777' } },
  'qatar-airways.benefits.commuting.a6f81f07': { h: '98048195838ccf61', label: '海外に住んで通う契約', value: 'なし', en: { label: 'Commuting contract (living abroad)', value: 'Not offered' } },
  'qatar-airways.benefits.staff-travel.2b521215': { h: '1b775ea5eab2c3d9', off: '重複（中身は別の行が具体的に言っている）' },
  'qatar-airways.benefits.staff-travel.481e8986': { h: '3d846423626c3f6a', label: '休暇の航空券', value: '年1回無料（本人・配偶者・子）', en: { label: 'Leave ticket', value: '1 free ticket a year (pilot, spouse and children)' } },
  'qatar-airways.benefits.staff-travel.d7c80cdd': { h: 'b4c178272d75d7e7', label: '友人の航空券', value: '50%割引（ID50）', en: { label: 'Buddy passes', value: 'ID50' } },
  'qatar-airways.work.days-off.3338aa81': { h: 'e1f65def3214fa7c', off: '重複（同じ話を別の行が言っている）' },
  'qatar-airways.work.days-off.694ab833': { h: 'd9159197c45d6e45', label: '休日', value: '月12〜14日', lead: true, en: { label: 'Days off', value: '12–14 a month' } },
  'qatar-airways.work.roster-pattern.173bb842': { h: '57b97a758edcfca0', label: '勤務の希望（ビッド）', value: 'あり', en: { label: 'Bidding', value: 'Yes' } },
  'riyadh-air.benefits.pension-fo.f4e41027': { h: 'b1a23e5c2ad84174', label: '年金', value: '国の社会保険に加入（留学中の訓練も加入期間に入る）', cond: '奨学金で採用された自国籍の訓練生', en: { label: 'Pension', value: 'Enrolled in GOSI social insurance, including training abroad', cond: 'Saudi cadets on scholarship' } },
  'riyadh-air.benefits.staff-travel.38920303': { h: 'b020cda2e6d78a62', off: '手続きの話（予約の方法）' },
  'riyadh-air.benefits.staff-travel.7b6a318d': { h: 'c520768a77b53f6a', off: '手続きの話（搭乗の優先順）' },
  'royal-jordanian.work.training-bond-cap.b9fbb99e': { h: '601b0e95c94beb8d', label: '勤続の約束（ボンド）', value: 'なし（E2 への移行訓練）', cond: 'E190/E195 の型式限定を持つ機長・2026年', lead: true, en: { label: 'Training bond', value: 'None for the E2 transition course', cond: 'Captains rated on the E190/E195, 2026' } },
  'saudia.base.pilot-base-city.239db28f': { h: '7c75a17bf2ffa62c', off: '重複（同じ拠点を空港の行が言っている）' },
  'saudia.base.pilot-base-city.57225b81': { h: '6ad54ae95df1da2a', label: '拠点', value: 'ジェッダ', en: { label: 'Base', value: 'Jeddah' } },
  'saudia.benefits.staff-travel-cap.37febc63': { h: '4c2b0e15d32ba042', off: '口コミで中身が具体でない（閑散期だけという感想）' },
  'saudia.benefits.staff-travel.82511e1f': { h: 'edc08eb7428bdbe4', off: '手続きの細かい話（家族の券のアップグレード）' },
  'saudia.benefits.staff-travel.f8cc66ef': { h: '9bf963aa5ac6de85', off: '手続きの細かい話（家族の券のアップグレード）' },
  'singapore-airlines.base.pilot-base-city.c88e6ed4': { h: 'cadf14cf055abde0', off: '重複（同じ拠点を空港の行が言っている）' },
  'singapore-airlines.benefits.annual-leave-cap.89b95790': { h: '142cb299b0564e1a', label: '年次休暇', value: '年36日', cond: '経験者採用の機長', lead: true, en: { label: 'Annual leave', value: '36 days a year', cond: 'Direct-entry captain' } },
  'singapore-airlines.benefits.annual-leave-fo.b69e73ac': { h: 'a7ad913e3e8cd124', label: '年次休暇', value: '年32日', cond: '経験者採用の副操縦士', en: { label: 'Annual leave', value: '32 days a year', cond: 'Direct-entry first officer' } },
  'singapore-airlines.benefits.commuting.2a35c799': { h: 'd66b2f7fe4cfaa7e', off: '中身が無い（変動の手当の1つとだけ）' },
  'singapore-airlines.work.annual-days-off.7fc658fc': { h: '6dbe5748377bb80c', label: '休日（1年の最低）', value: '自国籍のパイロット106日・外国籍のパイロット104日', cond: '2022〜2025年', lead: true, en: { label: 'Minimum days off a year', value: '106 for local pilots, 104 for expat pilots', cond: '2022–2025' } },
  'singapore-airlines.work.annual-days-off.9ce324c3': { h: '0e094b054f4f5e5a', label: '休日', value: '年104日以上', cond: '外国籍のパイロット・2022〜2025年', same: 'singapore-airlines.work.annual-days-off.7fc658fc', en: { label: 'Days off', value: 'At least 104 a year', cond: 'Expat pilots, 2022–2025' } },
  'singapore-airlines.work.roster-pattern.398e841f': { h: 'ed7fe545fa413b01', off: '手続きの話（休日の連絡の要否）' },
  'singapore-airlines.work.roster-pattern.578361e2': { h: '0d9e7237803c1010', label: '勤務の希望（ビッド）', value: '希望の勤務パターンを申請できる', en: { label: 'Bidding', value: 'Preferred patterns can be requested' } },
  'singapore-airlines.work.roster-pattern.fdb47277': { h: 'c7d07ae967ffdc0a', off: '手続きの話（休日の表示の仕方の試み）' },
  'singapore-airlines.work.working-time.b25f4bea': { h: '505e465abfcaa6be', label: 'フライトタイムの上限', value: '28日で100時間', cond: '2022〜2025年', en: { label: 'Flight time limit', value: '100 hours in any 28 days', cond: '2022–2025' } },
  'singapore-airlines.work.working-time.f285d622': { h: 'f7ad5b30e95faf90', label: '勤務時間の上限', value: '28日で176時間', cond: '2022〜2025年', en: { label: 'Duty time limit', value: '176 hours in any 28 days', cond: '2022–2025' } },
  'skymark.benefits.r10-jpc-housing': { h: '40c5c46bcb71bfc7', label: '住宅手当', money: { cur: 'JPY', n: 300000, per: 'month' }, cond: '契約の機長・B737・2025年', lead: true, en: { label: 'Housing allowance', cond: 'Contract captain, B737, 2025' } },
  'south-african-airways.base.pilot-base-city.bc077461': { h: 'd7c15e1123a0914f', off: '重複（同じ拠点を空港の行が言っている）' },
  'south-african-airways.benefits.commuting.33a7c712': { h: '3c99bf915edc64e1', off: '家からの送迎と言えない（調達の仕様書・決まった乗り場から空港へ）' },
  'south-african-airways.work.training-bond.2da65333': { h: '274582f3b903e7cd', label: '勤続の約束（ボンド）', value: 'あり', cond: '訓練生', en: { label: 'Training bond', value: 'Yes', cond: 'Cadets' } },
  'south-african-airways.work.upgrade-years-fo.42b59552': { h: 'd4833e8d55169aba', label: 'ATPL を取る期限', value: '入社から4年以内', cond: '副操縦士', en: { label: 'ATPL deadline', value: 'Within 4 years of joining', cond: 'First Officer' } },
  'south-african-airways.work.upgrade-years.b96d1cf2': { h: 'ddf8aa84dfd8dc14', off: '一人の体験で一般化できない（昇格までの年数とも言えない）' },
  'starlux.base.pilot-base-city.466cd5ba': { h: '471b8ef1bac5aa1e', off: '重複（同じ拠点を空港の行が言っている）' },
  'starlux.benefits.commuting.9632c29a': { h: 'c7101231a6e360aa', label: '海外に住んで通う契約', value: 'あり', cond: '2025年', lead: true, en: { label: 'Commuting contract (living abroad)', value: 'Offered', cond: '2025' } },
  'tap.jobs.fo-total-hours-fo.26fdecac': { h: '21b4319cf846cc34', label: '応募に要る飛行時間', value: '500時間以上', cond: '副操縦士・2026年9月', en: { label: 'Minimum total time', value: '500 hours', cond: 'First Officer, September 2026' } },
  'thai-airways.work.roster-pattern.0a32d8ce': { h: 'c5fffe5bf9ce5a32', off: 'システムの機能の紹介で、制度として言えない' },
  'thai-airways.work.training-bond.aaa3d6b0': { h: '9d35282a13ee80bd', label: '訓練費の返還', value: '自己都合で辞めたら全額を一括で返す', cond: '訓練生・2024年', en: { label: 'Training cost repayment', value: 'Full repayment in one lump sum if the cadet quits', cond: 'Cadets, 2024' } },
  'vietjet.benefits.commuting-cap.c40eb91a': { h: 'd51952f07a5bcf10', label: '家からの送迎', value: 'あり', cond: '外国人の機長・ハノイ', lead: true, en: { label: 'Crew transport from home', value: 'Yes', cond: 'Expat captain, Hanoi' } },
  'vietjet.work.roster-pattern-cap.17aea365': { h: '585f3de67dae62c8', off: '意味が取れない（6/2 が週か日か引用でわからない）' },
  'vietjet.work.roster-pattern-cap.46322d04': { h: 'e6ccce614e1f7943', label: '勤務の組み方', value: '3週勤務・1週休み', cond: '外国人の機長・A320', lead: true, en: { label: 'Work pattern', value: '3 weeks on, 1 week off', cond: 'Expat captain, A320' } },
  'vietnam-airlines.work.roster-pattern-cap.57bdaa54': { h: '375b913f32850806', label: '海外に住んで通う契約', value: 'あり（勤務と休みの組み方を選べる）', cond: '外国人契約の機長・A320・2026年', lead: true, en: { label: 'Commuting contract (living abroad)', value: 'Offered, with a choice of on/off patterns', cond: 'Expat contract captain, A320, 2026' } },
  'vietnam-airlines.work.roster-pattern-cap.61c6464b': { h: '6a4e1566c238c44d', off: '重複（同じ話を別の行が言っている）' },
  'vietnam-airlines.work.roster-pattern-cap.7251e26c': { h: 'c97e3bcde2e46cf0', off: '重複（同じ話を別の行が言っている）' },
  'vietnam-airlines.work.roster-pattern-cap.a14ec02b': { h: 'bf4f4f2a59ffc638', off: '重複（同じ話を別の行が言っている）' },
  'vietnam-airlines.work.roster-pattern-cap.f3b6ca50': { h: '766c6946852e3f08', off: '重複（同じ話を別の行が言っている）' },
  'vietnam-airlines.work.roster-pattern-fo.ac1c461c': { h: 'ac0265c8853ff486', label: '勤務の組み方', value: '4週勤務・4週休みを選べる', cond: '外国人契約の副操縦士・A350・2026年', en: { label: 'Work pattern', value: 'Option of 4 weeks on, 4 weeks off', cond: 'Expat contract first officer, A350, 2026' } },
  'vietnam-airlines.work.training-bond-cap.aa47e9fc': { h: '144705570a2f5e7f', label: '訓練の保証金', value: 'あり', cond: '外国人契約の機長・A350・2025年', en: { label: 'Security bond', value: 'Yes', cond: 'Expat contract captain, A350, 2025' } },
  /* ★2026-11-19 残りの答え 回A（欧州-2・欧州-3）── 比べられる条件の形に直した字（off は出さない理由） */
  'aegean.benefits.commuting.258b4b3d': { h: '0a48ebf59c0157df', label: '遠くに住んで通う人向けの契約', value: 'なし', lead: true, en: { label: 'Commuting contract', value: 'None' } },
  'aegean.work.days-off.924c30db': { h: 'c96b0d87cc23bf91', label: '休日', value: '月8〜11日', cond: '2024年6月', lead: true, en: { label: 'Days off', value: '8–11 a month', cond: 'June 2024' } },
  'aegean.work.days-off.b851c5d6': { h: '174b43760cdc4f4d', off: '重複（別の行に1行でまとめた）' },
  'aegean.work.roster-pattern.ea83a3d6': { h: '7fdf80459a5c9cb5', off: '掲示板の比べ話の一言で、勤務の組み方の決まりとして言えない' },
  'aegean.work.working-time-cap.996f0297': { h: '3eba9295101e7ea7', label: '年のフライトタイム', value: '平均で年800〜850時間', cond: '機長', en: { label: 'Annual flight time', value: '800–850 hours a year on average', cond: 'Captain' } },
  'aegean.work.working-time-cap.dba76779': { h: '7a28d3050bc9a5cf', off: '重複（別の行に1行でまとめた）' },
  'aer-lingus.base.pilot-base-city.437e548c': { h: 'fd1b3293872571e3', off: '重複（同じ拠点を空港の行が言っている）' },
  'aer-lingus.base.pilot-base-city.7c6fd0f4': { h: '2b17a7a7d5323fd5', label: '拠点', value: 'シャノン', en: { label: 'Base', value: 'Shannon' } },
  'aer-lingus.base.pilot-base-city.ac93727c': { h: 'cc6d4cc6325d5916', off: '重複（同じ拠点を空港の行が言っている）' },
  'aer-lingus.base.pilot-base-city.f0011b86': { h: '9e3b3207f0dd06d4', off: '重複（同じ拠点を空港の行が言っている）' },
  'aer-lingus.base.pilot-base.1fa1129e': { h: '8b03ad2eb93addac', label: '拠点', value: 'MAN', cond: '英国の子会社（エアリンガスUK）', en: { label: 'Base', value: 'MAN', cond: 'Aer Lingus UK' } },
  'aer-lingus.benefits.commuting.8316243e': { h: '1cc8d59c52c656c5', label: '空港の駐車場', value: '無料', cond: 'ダブリン空港', en: { label: 'Airport parking', value: 'Free', cond: 'Dublin Airport' } },
  'aer-lingus.benefits.staff-travel.b416e1a2': { h: '9d0d874919827895', label: '社員の航空券', value: '割引あり・勤続6か月から', cond: '本人と家族', lead: true, en: { label: 'Staff travel', value: 'Discounted, after 6 months of service', cond: 'Pilots and family' } },
  'air-france.benefits.staff-travel.002796a0': { h: '5feb52402996e05c', off: '重複（別の行に1行でまとめた）' },
  'air-france.benefits.staff-travel.15dd5e23': { h: '5ad6814d081b9d30', off: '手続きの細かい話（マイルの積算・25歳以上の子の扱い）' },
  'air-france.benefits.staff-travel.3afef06d': { h: '82c9391eefcd4086', label: '家族の航空券', value: 'あり（空席待ちの割引券）', cond: '配偶者と子', en: { label: 'Family travel', value: 'Discounted standby tickets', cond: 'Spouse and children' } },
  'air-france.benefits.staff-travel.ec96ab29': { h: 'e11fe19bceaaaa9b', label: '社員の航空券', rows: [['乗務員（中距離線・空席待ち）', '無料（空港税のみ負担）'], ['社員全体（座席の予約つき）', '市場の最安値より約30%安い']], lead: true, en: { label: 'Staff travel', rows: [['Flight crew (medium-haul, standby)', 'Free (airport taxes only)'], ['All staff (confirmed seat)', 'About 30% below the lowest market fare']] } },
  'airx-charter.base.pilot-base-city.6ba7878c': { h: '2d5e942727a04455', off: '重複（マルタの空港の町で、同じ拠点を別の行が言っている）' },
  'airx-charter.benefits.annual-leave.0933ef61': { h: '7e84a7241323820e', off: '国の法律の最低基準で、この会社のパイロットの条件と言えない' },
  'airx-charter.benefits.commuting.e1cdfd1a': { h: 'fde978bedf7969c6', off: '家からの通勤ではない（チャーター先での宿と移動の手配）' },
  'airx-charter.benefits.medical.65122850': { h: 'b97c844c3176de32', off: '国の公的医療の制度で、この会社のパイロットの条件と言えない' },
  'airx-charter.benefits.pension.9de15ba8': { h: '387ed6398f1e4d54', off: '国の社会保障の掛け金で、この会社のパイロットの条件と言えない' },
  'airx-charter.work.training-bond-fo.82f21692': { h: '76a4b057b6f0910a', label: '型式限定の訓練', value: '会社が行う（路線訓練まで）', cond: '型式限定のない副操縦士・Challenger 850', lead: true, en: { label: 'Type rating training', value: 'Provided, including line training', cond: 'Non-type-rated first officers, Challenger 850' } },
  'icelandair.base.pilot-base-city.23c6c994': { h: '65afb78fd83d8ace', off: '重複（同じ拠点を空港の行が言っている）' },
  'icelandair.base.pilot-base-city.5d1c44c4': { h: '31e849da0f8fca26', off: '重複（同じ拠点を空港の行が言っている）' },
  'icelandair.base.pilot-base.b6c0e20a': { h: 'c9ae007df1033413', label: '拠点', value: 'RKV', cond: '国内線', en: { label: 'Base', value: 'RKV', cond: 'Domestic flights' } },
  'icelandair.benefits.commuting.2aa8f95e': { h: 'de846352eacc337a', label: '通勤の手当', value: 'あり（車の手当）', lead: true, en: { label: 'Transport allowance', value: 'Yes (car allowance)' } },
  'icelandair.benefits.commuting.c1cd5131': { h: 'c709e5a826496c0a', off: '家からの送迎と言えない（空港で働く人向けの通勤バスで、会社の制度と引用から言えない）' },
  'icelandair.benefits.staff-travel.4ea26815': { h: 'ea6a9ed36f8436d2', off: '他社の社員がこの会社の便に乗るときの手続きで、この会社のパイロットの条件ではない' },
  'icelandair.jobs.fo-license-fo.4c918d9d': { h: '9566df317b08448f', label: '応募に要る免許', value: '事業用操縦士の免許（アイスランドか EASA 加盟国の発行）', cond: '副操縦士・2025年12月', en: { label: 'License required', value: 'CPL issued by Iceland or another EASA member state', cond: 'First Officer, December 2025' } },
  'icelandair.jobs.fo-right-to-work-fo.d336b71e': { h: '37415b784c20403a', label: '応募に要る語学と学歴', rows: [['英語', '十分な力が必須'], ['アイスランド語', 'あれば歓迎'], ['学歴', '高校卒業（大学入学資格）以上']], cond: '副操縦士', en: { label: 'Language and education', rows: [['English', 'Good command required'], ['Icelandic', 'An advantage'], ['Education', 'Upper secondary diploma or equivalent']], cond: 'First Officer' } },
  'icelandair.jobs.fo-total-hours-fo.ee5ae542': { h: '15f799dcf426e8fd', label: '応募に要る飛行時間', value: 'ジェット機で500時間以上', cond: '副操縦士・2025年12月', en: { label: 'Minimum flight time', value: '500 hours on jets', cond: 'First Officer, December 2025' } },
  'icelandair.jobs.fo-type-rating-fo.d108168e': { h: '7cd93bf6138fd671', label: '型式限定', value: '採用後に会社の訓練で取る', cond: '副操縦士', en: { label: 'Type rating', value: 'Trained by the company after selection', cond: 'First Officer' } },
  'icelandair.work.roster-pattern.1ea24d5a': { h: '77312b0ccc466ca1', label: '休日', value: '月9日（うち週末の休みが1回）', lead: true, en: { label: 'Days off', value: '9 a month, including one weekend' } },
  'ita-airways.base.pilot-base-city.49b2d9cf': { h: 'cbca822fdac1d981', off: '重複（同じ拠点を空港の行が言っている）' },
  'ita-airways.base.pilot-base-city.a792eda5': { h: 'e1dbd3964e18f66a', off: '重複（同じ拠点を空港の行が言っている）' },
  'ita-airways.benefits.staff-travel.37f80b89': { h: '19c080c02131cbfe', label: '社員の航空券', rows: [['機長', '休暇用の券2枚'], ['副操縦士', '休暇用の券1枚（勤続5年から2枚）'], ['家族と両親', '予約つき・空席待ちの券あり']], lead: true, en: { label: 'Staff travel', rows: [['Captain', '2 annual-leave tickets'], ['First Officer', '1 annual-leave ticket (2 after 5 years of service)'], ['Family and parents', 'Confirmed and standby tickets']] } },
  'ita-airways.work.training-bond-fo.32d58b1d': { h: '0dc297bfa831e851', label: '訓練費（本人負担・総額）', money: { cur: 'EUR', n: 135000, per: 'once' }, cond: '訓練生（MPL の課程）', lead: true, en: { label: 'Training cost (cadet-funded, total)', cond: 'Cadets, MPL program' } },
  'lot.benefits.commuting.5c96007f': { h: '7f99808f63f5ad0b', label: '勤務表の選択肢', rows: [['遠くに住んで通う人向け', '希望の休日を月4日以上指定できる'], ['短時間勤務（70%・85%）', '勤続2年から']], lead: true, en: { label: 'Roster options', rows: [['Commuter roster', 'At least 4 requested days off a month'], ['Part-time (70% or 85%)', 'After 2 years with the company']] } },
  'lot.work.training-bond.3a616530': { h: 'f68ca35858d7b42d', label: '型式限定の訓練費', value: '本人負担なし', en: { label: 'Type rating cost', value: 'No charge to the pilot' } },
  'lot.work.upgrade-years.436e7e39': { h: '571dab61de024cf9', off: '重複（別の行に1行でまとめた）' },
  'lot.work.upgrade-years.81421f48': { h: '15f85fc7569ddade', label: '機長への昇格', rows: [['ナローボディの機長', '副操縦士から2〜3年'], ['B787 の機長', '5〜8年以上']], lead: true, en: { label: 'Upgrade to captain', rows: [['Narrowbody captain', '2–3 years from first officer'], ['B787 captain', '5–8+ years']] } },
  'norwegian.benefits.commuting.5a5df079': { h: 'bec8cd3583c3d22b', label: '通勤の航空券', value: 'あり（家と拠点のあいだ）', lead: true, en: { label: 'Commuting tickets', value: 'Provided between home and base' } },
  'ryanair.work.training-bond-fo.065ba3aa': { h: '781c64bf7de922f0', label: '型式限定の訓練費（本人負担）', money: { cur: 'EUR', n: 30000, per: 'once' }, cond: '訓練生・前払い（自社の養成課程と英国の枠は除く）', en: { label: 'Type rating fee (paid by the cadet)', cond: 'Cadets, paid upfront (except ab initio, Gateway 1 and UK scheme)' } },
  'ryanair.work.training-bond-fo.73580910': { h: 'ee56cdec4cc5a49b', label: '勤続の約束（ボンド）', rows: [['EU の拠点', '4年'], ['英国の拠点', '5年']], cond: '訓練生', en: { label: 'Training bond', rows: [['EU bases', '4 years'], ['UK bases', '5 years']], cond: 'Cadets' } },
  'ryanair.work.training-bond-fo.cc6b811a': { h: '5381fd56dc2b375d', off: '重複（別の行に1行でまとめた）' },
  'ryanair.work.upgrade-years-fo.2f8c7a46': { h: '3e71e0d8672f7a40', off: '重複（会社が公表している年数を別の行が言っている）' },
  'ryanair.work.upgrade-years-fo.c2f6675c': { h: '5ce88255c93dd070', off: '重複（別の行に1行でまとめた）' },
  'ryanair.work.upgrade-years-fo.db118aea': { h: '4aa93852a1e28494', label: '機長への昇格', value: '最短4〜5年', cond: '訓練生・型式限定の訓練の開始から', lead: true, en: { label: 'Upgrade to captain', value: 'As little as 4–5 years', cond: 'Cadets, from the initial type rating course' } },
  'sas.benefits.commuting.c662e6bb': { h: '0f63f79e8f03661b', off: '家からの通勤ではない（ステイ先の宿と移動の手配）' },
  'turkish-airlines.base.pilot-base-city.a408a15e': { h: 'b34ae82675f7060e', off: '重複（同じ拠点を空港の行が言っている）' },
  'turkish-airlines.jobs.cap-license-cap.bf9863d4': { h: '4fc6b6ff70a17964', label: '応募に要る免許', rows: [['機長', 'ATPL（トルコ・EASA・FAA・ICAO の発行）'], ['副操縦士', 'ATPL か、ATPL の学科に合格した事業用操縦士＋計器飛行証明']], cond: '外国籍のパイロット・2024年11月', en: { label: 'License required', rows: [['Captain', 'ATPL (Turkish DGCA, EASA, FAA or ICAO)'], ['First Officer', 'ATPL, or CPL/IR with ATPL theory credit']], cond: 'Expat pilots, November 2024' } },
  'turkish-airlines.jobs.cap-posting-cap.34960f9c': { h: 'b68a4c97ce7ae6a9', off: '値が無い（募集が見つからなかったという記録）' },
  'turkish-airlines.jobs.cap-right-to-work-cap.895506ae': { h: '7f780558e251e587', label: '外国籍の応募', value: '可', cond: '機長・副操縦士・2024年11月', en: { label: 'Expat applicants', value: 'Accepted', cond: 'Captains and First Officers, November 2024' } },
  'turkish-airlines.jobs.cap-total-hours-cap.e929c4b8': { h: '64c96e8f9495f7f1', label: '応募に要る飛行時間', value: '合計5,500時間以上', rows: [['最大離陸重量27トン超の機', '3,000時間以上'], ['応募機種の機長時間', '1,000時間以上']], cond: '外国籍の機長・2024年11月', en: { label: 'Minimum total time', value: '5,500 hours total', rows: [['Aircraft over 27 t MTOW', '3,000 hours'], ['PIC on the applied type', '1,000 hours']], cond: 'Expat captain, November 2024' } },
  'turkish-airlines.jobs.cap-type-rating-cap.0a7cf8f1': { h: 'bdf3c63fc77f38cd', label: '型式限定', value: '応募機種の型式限定が必要', rows: [['機長（B737）', 'B737 の機長時間500時間以上'], ['副操縦士', '応募機種で500時間以上']], cond: '外国籍のパイロット・2024年11月', en: { label: 'Type rating', value: 'Type rating on the applied type required', rows: [['Captain (B737)', '500 hours PIC on the B737'], ['First Officer', '500 hours on the applied type']], cond: 'Expat pilots, November 2024' } },
  'turkish-airlines.jobs.fo-license-fo.661b0f9e': { h: '25133791789a4399', off: '重複（別の行に1行でまとめた）' },
  'turkish-airlines.jobs.fo-posting-fo.a70569f9': { h: 'ad15636bd2123c2d', off: '値が無い（募集が見つからなかったという記録）' },
  'turkish-airlines.jobs.fo-right-to-work-fo.7c2e3965': { h: '07e327f572d02972', off: '重複（同じ話を別の行が言っている）' },
  'turkish-airlines.jobs.fo-total-hours-fo.299acbcd': { h: 'ccceb7ef3e7ff2ef', label: '応募に要る飛行時間', rows: [['EASA の免許', '最大離陸重量27トン超の機で1,000時間以上'], ['ICAO・FAA の免許', '最大離陸重量27トン超の機で1,500時間以上']], cond: '外国籍の副操縦士・2024年11月', en: { label: 'Minimum flight time', rows: [['EASA license', '1,000 hours on aircraft over 27 t MTOW'], ['ICAO or FAA license', '1,500 hours on aircraft over 27 t MTOW']], cond: 'Expat first officer, November 2024' } },
  'turkish-airlines.jobs.fo-total-hours-fo.6f7ef711': { h: '407f9734a63a53ac', off: '重複（別の行に1行でまとめた）' },
  'turkish-airlines.jobs.fo-type-rating-fo.a3591105': { h: 'f0d65e09ff97d1e5', off: '重複（別の行に1行でまとめた）' },
  'turkish-airlines.work.training-bond.5e14354d': { h: 'd888e629d9ef9b1f', label: '訓練費の返還（10年間の給与天引き）', money: { cur: 'EUR', n: 120000, per: 'once' }, cond: '訓練生・2つある契約の型のうち安いほう', en: { label: 'Training cost repayment (payroll deduction over 10 years)', cond: 'Cadets; the lower of two contract types' } },
  'turkish-airlines.work.training-bond.c99f0400': { h: 'b8aa28440d8e6ef2', label: '訓練費の返還（10年間の給与天引き）', money: { cur: 'EUR', n: 170000, per: 'once' }, cond: '訓練生・2つある契約の型のうち高いほう', en: { label: 'Training cost repayment (payroll deduction over 10 years)', cond: 'Cadets; the higher of two contract types' } },
  'turkish-airlines.work.upgrade-years.ca961b1b': { h: '0bf40b9a2f5488ec', label: '機長への昇格', rows: [['ナローボディの機長', '副操縦士から約8〜12年'], ['ワイドボディの機長', '12〜18年以上']], lead: true, en: { label: 'Upgrade to captain', rows: [['Narrowbody captain', 'About 8–12 years from first officer'], ['Widebody captain', '12–18+ years']] } },
  'turkish-airlines.work.upgrade-years.eaac4ebf': { h: 'abae98f8f05c18c9', off: '重複（別の行に1行でまとめた）' },
  'wizz-air.benefits.staff-travel.69567465': { h: '02f1e829ab3bb7fa', label: '社員の航空券', rows: [['本人', '回数の制限なし・1区間ごとに EUR 25・50・75（距離で3段階）・座席の予約つき（繁忙期を除く）'], ['本人（勤続に応じて）', '無料の券あり'], ['同行者（5人まで）', '会員割引運賃からさらに25%引き']], cond: '2026年', lead: true, en: { label: 'Staff travel', rows: [['Employee', 'Unlimited, EUR 25, 50 or 75 per sector by distance, confirmed seat (except blackout periods)'], ['Employee (by years of service)', 'Free bonus tickets'], ['Travel partners (up to 5)', '25% off the Wizz Discount Club fare']], cond: '2026' } },
  'wizz-air.work.training-bond-fo.23bc2e24': { h: '78761cc95f49cb75', label: '勤続の約束（ボンド）', money: { cur: 'EUR', n: 20000, per: 'once' }, cond: '型式限定のない副操縦士・A320・英国の子会社', en: { label: 'Training bond', cond: 'Non-type-rated first officers, A320, Wizz Air UK' } },
  'wizz-air.work.training-bond-fo.26182338': { h: '36d9446d2803ea0d', label: '訓練費の返還（5年間、毎月の給与から天引き）', money: { cur: 'EUR', n: 25000, per: 'once' }, cond: '訓練生（会社の養成課程）', en: { label: 'Training cost repayment (monthly salary deduction over 5 years)', cond: 'Cadets, Wizz Air Pilot Academy' } },
  'wizz-air.work.training-bond-fo.48a1f478': { h: '15b65c393d894062', label: '勤続の一時金', value: '36か月勤めるとボンドの額の50%（税引き前）', cond: '型式限定のない副操縦士・A320・英国の子会社', en: { label: 'Loyalty bonus', value: '50% of the bond amount (gross) after 36 months', cond: 'Non-type-rated first officers, A320, Wizz Air UK' } },
  'wizz-air.work.upgrade-years-fo.b692bc3f': { h: '671bc97bd55e515f', label: '機長への昇格', rows: [['エアバス（フライ・バイ・ワイヤ）の経験あり', '入社6か月以内に申請できる'], ['それ以外', '入社12か月以内に申請できる']], cond: '換算3,500時間を超える副操縦士・英国の子会社', lead: true, en: { label: 'Upgrade to captain', rows: [['Prior Airbus fly-by-wire experience', 'Eligible to apply within 6 months'], ['Others', 'Eligible to apply within 12 months']], cond: 'First officers with over 3,500 factored hours, Wizz Air UK' } },
  'wizz-air.work.upgrade-years-fo.bb4a14f0': { h: '7d0acd2bcfd459bd', off: '重複（別の行に1行でまとめた）' },
  /* ★2026-11-19 残りの答え 回C（オセアニア・中南米）── 比べられる条件の形に直した字（off は出さない理由） */
  'aeromexico.base.pilot-base-city.31e13293': { h: '08455cd13dd9a347', off: '重複（同じ拠点を空港の行が言っている）' },
  'aeromexico.base.pilot-base-city.9a16b8d9': { h: 'b38b013fe261f0b0', off: '重複（同じ拠点を空港の行が言っている）' },
  'aeromexico.base.pilot-base-city.c82adb53': { h: 'f80d47da21039cfb', off: '重複（同じ拠点を空港の行が言っている）' },
  'aeromexico.benefits.annual-leave.f3c36521': { h: 'cf2216aadd764d11', label: '年次休暇（法律の最低）', value: '年30日（勤続1年ごとに1日増え、最大60日）', lead: true, en: { label: 'Annual leave (legal minimum)', value: '30 days a year, plus 1 day per year of service, up to 60' } },
  'aeromexico.benefits.commuting.d58b072c': { h: '5d6ccb619739d209', label: '日当', value: 'あり（拠点の外に泊まるとき・国内線も国際線も）', cond: '2026年', en: { label: 'Per diem', value: 'Paid for overnights away from base, domestic and international', cond: '2026' } },
  'aeromexico.benefits.staff-travel.4318e586': { h: '7c14abbd3bfe596b', off: '社員の等級1〜8向けの規程で、パイロットに当てはまるか引用から分からない' },
  'aeromexico.work.days-off.938cb558': { h: '4cbe0958f7845f2f', label: '休日', value: '月8日（8日続けてか、2回に分けて取る）', cond: '2024年', lead: true, en: { label: 'Days off', value: '8 a month (one 8-day block or two blocks)', cond: '2024' } },
  'aeromexico.work.roster-pattern.5a0e6ef3': { h: 'b8734860bb03db98', off: '口コミの記事の説明（3〜4泊続くこともある、という話）で、決まりとして言えない' },
  'aeromexico.work.training-bond.5db54163': { h: '3f035f78a444a8db', off: '口コミの記事で、訓練費を誰が持つか言い切れない（募集ごとに違うと同じ文が書いている）' },
  'aeromexico.work.working-time.d54c7cf5': { h: '637d7d8d9474a46b', off: '逸話（労使の対立の報道。14〜15時間は会社が求めた勤務の長さで、上限の決まりではない）' },
  'air-new-zealand.base.pilot-base-city.53984984': { h: '1c0d7774a73f9dac', off: '引用は過去形で、どの会社の拠点か読めない（ターボプロップの歴史の記事）' },
  'air-new-zealand.base.pilot-base-city.90a5ff31': { h: 'f1a430d181a3e65f', off: '引用は過去形で、どの会社の拠点か読めない（ターボプロップの歴史の記事）' },
  'air-new-zealand.base.pilot-base-city.ef877cd3': { h: '7506fcd4840d3c4c', off: '重複（同じ求人の勤務地を前からある行が言っている）' },
  'air-new-zealand.benefits.commuting.da33eb32': { h: 'c553567b54701995', off: '会社全体の通勤の制度（自転車・公共交通の給与天引き）で、パイロットの条件と言えない' },
  'air-new-zealand.work.training-bond.85889b37': { h: 'c74eb00bb65bef0f', off: '訓練校の一般的な説明で、ニュージーランド航空の決まりと言えない（12〜36か月は業界の目安）' },
  'air-new-zealand.work.upgrade-years-cap.917377d2': { h: '309ce709f556a069', off: '重複（まとめて別の行に入れた）' },
  'air-new-zealand.work.upgrade-years-cap.b923a742': { h: 'de2141c8fe4882fc', off: '重複（まとめて別の行に入れた）' },
  'air-new-zealand.work.upgrade-years-cap.bf3ede25': { h: '7e3631819f369217', label: '機長への昇格', rows: [['A320', '入社から約8〜12年'], ['ワイドボディ機', '入社から約22年']], cond: '2024〜2026年', en: { label: 'Upgrade to captain', rows: [['A320', 'About 8–12 years from joining'], ['Widebody', 'About 22 years from joining']], cond: '2024–2026' } },
  'avianca.base.pilot-base-city.06a17b62': { h: '423232a73a3adcc6', off: '重複（同じ拠点を空港の行が言っている）' },
  'avianca.base.pilot-base-city.12d1552c': { h: 'b69bfd7cfc052cd5', label: '拠点', value: 'キト', cond: 'アビアンカ・エクアドル', en: { label: 'Base', value: 'Quito', cond: 'Avianca Ecuador' } },
  'avianca.base.pilot-base-city.2520d550': { h: '856dad7e8baf490f', label: '拠点', value: 'グアテマラシティ', cond: 'アビアンカ・グアテマラ', en: { label: 'Base', value: 'Guatemala City', cond: 'Avianca Guatemala' } },
  'avianca.base.pilot-base-city.64166676': { h: 'b36624990544a723', off: '重複（同じ拠点を空港の行が言っている）' },
  'avianca.base.pilot-base-city.80fd39ee': { h: 'bb44c57ca35830dd', off: '重複（同じ拠点を空港の行が言っている）' },
  'avianca.base.pilot-base.f0f5e5ab': { h: '0c4151893086a7bc', label: '拠点', value: 'SAL', cond: 'アビアンカ・エルサルバドル', en: { label: 'Base', value: 'SAL', cond: 'Avianca El Salvador' } },
  'avianca.benefits.commuting.ef292378': { h: 'bc923028e783dcb8', off: '中身が無い（国によって移動などの補助がある、とだけ）' },
  'avianca.benefits.housing.c9aaa343': { h: 'dfc21a14ed108964', label: '拠点を移るときの補助', value: '住宅の貸付（希望すれば）・家財の引っ越し・日当', cond: '拠点を移るパイロット・2025年', en: { label: 'Base transfer support', value: 'Housing loan on request, household move and per diem', cond: 'Pilots transferred to another base, 2025' } },
  'avianca.benefits.medical.6285d57a': { h: '48987cdbf647fbf3', label: '医療保険', value: 'あり（家族にも広げられる）', cond: '社員全体', en: { label: 'Medical insurance', value: 'Yes, can be extended to family', cond: 'All staff' } },
  'avianca.benefits.pension.7a3302b8': { h: '5979fd6f8e336585', label: '年金', value: '会社が給与の12%、本人が4%を国の年金に積み立てる', cond: 'コロンビアの社員・2026年', lead: true, en: { label: 'Pension', value: 'The company pays 12% of salary and the employee 4% into the national pension system', cond: 'Colombia-based staff, 2026' } },
  'avianca.benefits.staff-travel.ead4bc01': { h: 'f7a9ec55b0cfe123', label: '社員の航空券', value: 'あり', cond: '社員全体', en: { label: 'Staff travel', value: 'Yes', cond: 'All staff' } },
  'avianca.work.training-bond-fo.b0308571': { h: 'a4ddb986a5413c1b', label: '型式限定の訓練', value: 'A320の型式限定と路線訓練を会社が用意（型式限定が無くても応募できる）', cond: '副操縦士・A320・2026年', en: { label: 'Type rating training', value: 'A320 type rating and line training provided by the company (non-type-rated pilots welcome)', cond: 'First Officer, A320, 2026' } },
  'avianca.work.upgrade-years.9c4ee4fc': { h: 'c7bcabb228aac8f4', off: '地域の目安で、アビアンカの数字ではないと資料自身が書いている' },
  'copa-airlines.benefits.annual-leave.f198d708': { h: 'c4deeb25556283d2', label: '年次休暇（法律の最低）', value: '11か月勤務するごとに30日', cond: '全社員', lead: true, en: { label: 'Annual leave (legal minimum)', value: '30 days for every 11 months worked', cond: 'All staff' } },
  'copa-airlines.benefits.commuting.1c61e2f2': { h: 'fc95a4f90c68c5c0', off: '手続きの話（ホテル・送迎・食事の苦情の窓口）' },
  'copa-airlines.work.days-off.b9953c72': { h: '8557cf4449262c3c', label: '休日', value: '月9日', cond: '2025年', lead: true, en: { label: 'Days off', value: '9 a month', cond: '2025' } },
  'copa-airlines.work.roster-pattern.074b3242': { h: '9a5a9dbcd2fee1c0', label: '勤務表の発表', value: '毎月20日ごろに翌月分（希望を出し、勤続の長い順に決まる）', cond: '2026年', en: { label: 'Roster publication', value: 'Around the 20th of each month for the next month (bid-based, awarded by seniority)', cond: '2026' } },
  'copa-airlines.work.working-time.24287fff': { h: '33838966a4036106', label: '最低保証のブロックタイム', value: '月66時間（飛ばなかった分も払う・66時間を超えた分は割増）', cond: '2026年', en: { label: 'Monthly minimum guarantee', value: '66 block hours a month (paid even if not flown; hours above 66 paid at a premium)', cond: '2026' } },
  'fiji-airways.base.pilot-base-city.3fa2863b': { h: '04b7f918e825bb3b', off: '重複（同じ拠点を空港の行が言っている）' },
  'fiji-airways.benefits.annual-leave-cap.0c8cf15f': { h: '1695af94ade22b0e', label: '年次休暇', value: '年24〜35日', rows: [['機長（1〜2年目）', '年24日'], ['機長（3年目から）', '年35日'], ['副操縦士', '年24日']], cond: '契約のパイロット・2024〜2025年', lead: true, en: { label: 'Annual leave', value: '24–35 days a year', rows: [['Captain (years 1–2)', '24 days a year'], ['Captain (year 3 on)', '35 days a year'], ['First Officer', '24 days a year']], cond: 'Contract pilots, 2024–2025' } },
  'fiji-airways.benefits.annual-leave-cap.40b28ad8': { h: '8521a6e8dfc80453', off: '重複（まとめて別の行に入れた）' },
  'fiji-airways.benefits.annual-leave-fo.84a013fe': { h: '5e5ebe1a6dd56383', off: '重複（まとめて別の行に入れた）' },
  'fiji-airways.benefits.commuting-cap.4039675c': { h: '685026b7995b6359', label: '通勤の航空券', value: '連休のたびに契約の拠点と往復（エコノミーの確約席・空いていればビジネスに）', cond: '海外に住んで通う契約の機長・2025年', en: { label: 'Commuting tickets', value: 'Confirmed economy seats to and from the contract base for every block of days off (business class when available)', cond: 'Captains on commuting contracts, 2025' } },
  'fiji-airways.benefits.commuting.9441fb8c': { h: '0d5707efede9eb38', label: '空港への送迎', value: 'あり（会社の車）', cond: '乗員・2024年', en: { label: 'Crew transport to the airport', value: 'Yes, by company vehicles', cond: 'Crew, 2024' } },
  'fiji-airways.benefits.staff-travel.ab672c8f': { h: 'e97ca5b152858c14', label: '社員の航空券', value: '本人・配偶者・扶養家族（入社初日から）', cond: '契約の機長・2024年', en: { label: 'Staff travel', value: 'Pilot, spouse and dependents from day one', cond: 'Contract captains, 2024' } },
  'fiji-airways.work.days-off-cap.4b50c713': { h: '1c1be372aa665443', off: '重複（同じ話を別の行が言っている）' },
  'fiji-airways.work.days-off-fo.cce1188f': { h: '6c764d8a2bfff16c', off: '重複（同じ話を別の行が言っている）' },
  'fiji-airways.work.days-off.033a843c': { h: '7a6b92aef633f040', off: '重複（同じ話を別の行が言っている）' },
  'fiji-airways.work.days-off.5d823c00': { h: 'b63f3de8786aa432', label: '休日（規則の最低）', value: '28日で8日以上', cond: '国際線・2024年', en: { label: 'Days off (regulatory minimum)', value: 'At least 8 in any 28 days', cond: 'International operations, 2024' } },
  'fiji-airways.work.roster-pattern-cap.8628c482': { h: '75dede98727a9d31', label: '勤務の組み方', value: '月20日勤務・10日連休（年次休暇を月2日あてれば18日勤務・12日連休）', cond: '契約のパイロット・2024年', lead: true, en: { label: 'Work pattern', value: '20 days on, 10 days off a month (18 on, 12 off when using 2 days of annual leave a month)', cond: 'Contract pilots, 2024' } },
  'fiji-airways.work.roster-pattern-fo.876c507b': { h: '5964279357b68f57', off: '重複（同じ話を別の行が言っている）' },
  'fiji-airways.work.working-time-cap.e0ff5528': { h: 'd2257fb3cd57da05', label: '超過乗務手当', value: '月のブロックタイムが70時間を超えた分に支給', cond: '契約のパイロット・2024年', en: { label: 'Excess flying pay', value: 'Paid for block hours above 70 a month', cond: 'Contract pilots, 2024' } },
  'fiji-airways.work.working-time-fo.0e311560': { h: '381a42e9892c2eb9', off: '重複（同じ話を別の行が言っている）' },
  'jetstar.benefits.staff-travel.16ff4010': { h: '09dd44539d17178b', label: '社員の航空券', value: '空席待ちの大幅割引の航空券（パートナー・子・友人も使える）', cond: '社員全体（カンタス・グループ）', en: { label: 'Staff travel', value: 'Heavily discounted standby flights, also for partner, children and friends', cond: 'All staff (Qantas Group)' } },
  'jetstar.jobs.cap-license-cap.661f546f': { h: 'a079c4c0d04ecc36', off: '重複（同じ話を別の行が言っている）' },
  'jetstar.jobs.cap-right-to-work-cap.edbd0dd1': { h: '648b8b63b872f7ff', off: '重複（同じ話を別の行が言っている）' },
  'jetstar.jobs.cap-total-hours-cap.66a87e2b': { h: 'cf983ae23a168f79', label: '機長への昇格の条件', value: '総フライトタイム4,000時間・自社の機種（または同等）で1,500時間・ATPL', cond: '社内の昇格・ナローボディ・2025年', en: { label: 'Command requirements', value: '4,000 hours total time, 1,500 hours on company aircraft (or equivalent), ATPL', cond: 'Internal narrowbody upgrade, 2025' } },
  'jetstar.jobs.cap-type-rating-cap.c1b23481': { h: '902f6f5ce0d82ddf', off: '重複（同じ話を別の行が言っている）' },
  'jetstar.jobs.fo-license-fo.f89da036': { h: '312940eb044b5d44', label: '応募に要る免許', value: 'オーストラリアのATPL、またはATPL学科全科目に合格したCPL', cond: '経験者採用の副操縦士・A320', en: { label: 'License required', value: 'Australian ATPL, or Australian CPL with all ATPL theory subjects passed', cond: 'Direct-entry First Officer, A320' } },
  'jetstar.jobs.fo-right-to-work-fo.f3a0e563': { h: '10728ba6ebd4424b', label: '応募に要る就労資格', value: 'オーストラリアの永住権か、制限のない就労資格', cond: '経験者採用の副操縦士', en: { label: 'Right to work', value: 'Australian permanent residency or unrestricted Australian work rights', cond: 'Direct-entry First Officer' } },
  'jetstar.jobs.fo-total-hours-fo.8c46981a': { h: '6c7cf8f46be62b9b', label: '応募に要る飛行時間', value: '500時間以上（固定翼）', cond: '経験者採用の副操縦士・A320', en: { label: 'Minimum total time', value: '500 hours fixed-wing', cond: 'Direct-entry First Officer, A320' } },
  'jetstar.jobs.fo-type-rating-fo.2cd3a2bc': { h: '097e3557735697e5', label: 'マルチクルーの経験', value: '複数操縦士での運航経験、またはMCC課程の修了', cond: '経験者採用の副操縦士・A320', en: { label: 'Multi-crew experience', value: 'Multi-crew operations experience or a completed MCC course', cond: 'Direct-entry First Officer, A320' } },
  'jetstar.work.training-bond.76ce27cb': { h: '97a6e07595136386', off: '重複（まとめて別の行に入れた）' },
  'jetstar.work.training-bond.feebee23': { h: '0b0b054e29d96b6b', off: '日付の無い資料で、新しい協約で変わった可能性がある' },
  'jetstar.work.upgrade-years-cap.4c98eac5': { h: '1d334e3d1ab330ab', off: '質問の文で、答えではない' },
  'jetstar.work.upgrade-years-cap.543cbee3': { h: 'b960c163e3ea68b7', off: 'カンタスの話で、ジェットスターは「ほぼ同じ」とだけ（数字として言えない）' },
  'jetstar.work.upgrade-years-cap.dcb799e3': { h: '307b760ba82eb524', label: '機長への昇格', value: '入社から約12か月', cond: '入社時に昇格の条件を満たす人・2026年', en: { label: 'Upgrade to captain', value: 'About 12 months from joining', cond: 'Pilots meeting command minimums on joining, 2026' } },
  'latam.base.pilot-base-city.8839401e': { h: '7aa2a17677cef6a8', off: '重複（同じ拠点を空港の行が言っている）' },
  'latam.base.pilot-base-city.f0d7472e': { h: '6e4951c39517b3da', off: '重複（同じ拠点を空港の行が言っている）' },
  /* ★2026-11-19 残りの答え 回B-1（北米-1）── 比べられる条件の形に直した字（off は出さない理由） */
  'abx-air.benefits.staff-travel.6e4da0e1': { h: '5b37d62b875c0d20', off: '同じ話が調べた条件のカードにある' },
  'abx-air.benefits.staff-travel.be7b8bf6': { h: 'fe4a03d087b24002', off: '同じ話が調べた条件のカードにある' },
  'abx-air.jobs.fo-license-fo.df7ad6b8': { h: '1aea701fb5b5593a', label: '応募に要る免許', value: 'FAA の定期運送用操縦士（ATP・制限なし）と多発限定・第1種の身体検査・無線の許可（FCC）・英語の能力の記載', cond: '副操縦士・B767・2026年', en: { label: 'License required', value: 'Unrestricted FAA ATP with airplane multi-engine rating, first-class medical, FCC radiotelephone permit, ICAO English proficiency on the certificate', cond: 'First Officer, B767, 2026' } },
  'abx-air.jobs.fo-posting-fo.e3764a0e': { h: 'fc600a14d73e1d05', label: '募集', value: '副操縦士を募集中', cond: 'B767・2026年9月掲載', en: { label: 'Hiring', value: 'First Officers', cond: 'B767, posted September 2026' } },
  'abx-air.jobs.fo-right-to-work-fo.2819be83': { h: '2ddbeed7918de193', label: '就労の資格', value: '世界のどこでも働ける法的な資格・有効期間が1年以上残ったパスポート（海外渡航の制限がないこと）', cond: '副操縦士・2026年', en: { label: 'Right to work', value: 'Legally authorized to work worldwide; passport valid for at least 1 more year with no international travel restrictions', cond: 'First Officer, 2026' } },
  'abx-air.jobs.fo-total-hours-fo.4ae3d27f': { h: '0ef22dc93276cd78', label: '応募に要る飛行時間', value: '1,500時間以上（うち多発機かタービン機で500時間・運送事業（Part 121・135）か軍で機長か副操縦士として1,000時間）', cond: '副操縦士・2026年', en: { label: 'Minimum total time', value: '1,500 hours total, including 500 multi-engine or turbine and 1,000 PIC or SIC under Part 121/135 or military', cond: 'First Officer, 2026' } },
  'abx-air.jobs.fo-type-rating-fo.5ad51d4a': { h: 'f0950962ef8adea1', label: '型式限定', value: '不要（入社後の訓練で B767 の型式限定と ETOPS の資格を取る）', cond: '副操縦士・2026年', en: { label: 'Type rating', value: 'Not required (B767 type rating with ETOPS qualification in company training)', cond: 'First Officer, 2026' } },
  'abx-air.jobs.pilot-posting.ba672b62': { h: '466ef62d4a14caa7', off: 'パイロットの乗務の募集ではない（シミュレーターの教官の非常勤）' },
  'abx-air.jobs.pilot-total-hours.22733f98': { h: '9f1a21675f1ec727', off: '重複（同じ話を別の行が言っている）' },
  'alaska-airlines.work.training-bond-fo.37e50bd5': { h: '4125f31b9d9f4400', label: '勤続の約束（ボンド）', value: '2年（2年いないか、ホライゾン航空に入らなければ、受けた支援金を返す）', cond: 'ホライゾン航空の養成課程の訓練生', en: { label: 'Training bond', value: '2 years (the stipend must be repaid if you leave before 2 years or don’t join Horizon)', cond: 'Cadets in the Horizon Air pilot development program' } },
  'alaska-airlines.work.training-bond-fo.c0115362': { h: '38be7251403490a5', label: '型式限定の訓練', value: '会社が行う（応募のときは要らない）', cond: '副操縦士', en: { label: 'Type rating training', value: 'Provided by the company (not required to apply)', cond: 'First Officer' } },
  'alaska-airlines.work.training-bond-fo.d26bfb7a': { h: '060d4457b25d2c90', label: '訓練費の補助', value: '飛行訓練の費用の最大80%', cond: '提携する4年制大学の学生', en: { label: 'Flight training reimbursement', value: 'Up to 80% of flight lab fees', cond: 'Students at partner four-year universities' } },
  'alaska-airlines.work.upgrade-years-cap.31fa2709': { h: '9fc45275a207a814', off: '古い（2023年の数字。新しい話を別の行が言っている）' },
  'alaska-airlines.work.upgrade-years-cap.32b00d57': { h: '0b83842f4208172f', off: '見込みの話（「6〜7年に落ち着くだろう」）' },
  'alaska-airlines.work.upgrade-years-cap.6bb101ae': { h: '944c52309edc4392', label: '機長への昇格', value: '入社から8〜12年（拠点による）', en: { label: 'Upgrade to captain', value: '8–12 years from hire, depending on base' } },
  'alaska-airlines.work.upgrade-years-cap.a1e06acc': { h: 'db96c4f22f1df300', off: '重複（同じ話を別の行が言っている）' },
  'american.jobs.fo-license-fo.4f3108a1': { h: '6eb5ad1775a0d2fe', off: '重複（同じ話を別の行が言っている）' },
  'american.jobs.fo-license-fo.8862b564': { h: 'efcc963f47dec7f9', label: '応募に要る免許', value: 'FAA の定期運送用操縦士（ATP・制限なし・多発）・第1種の身体検査・無線の許可（FCC）', cond: '副操縦士', en: { label: 'License required', value: 'Unrestricted FAA ATP (multi-engine), first-class medical, FCC radiotelephone permit', cond: 'First Officer' } },
  'american.jobs.fo-posting-fo.017f7faf': { h: '9eb0c49dc3bf901a', off: '締め切った求人（今の募集ではない）' },
  'american.jobs.fo-right-to-work-fo.3696747b': { h: '7ec7105d1c0296f9', label: '就労の資格', value: '米国で働ける資格・パスポートと、国際線のあと米国に入国できる書類', cond: '副操縦士', en: { label: 'Right to work', value: 'Authorized to work in the US; valid passport and documents allowing US entry after international flights', cond: 'First Officer' } },
  'american.jobs.fo-total-hours-fo.f565b4df': { h: 'fa9ca0fd2a7f74a5', label: '応募に要る飛行時間', value: '1,500時間以上', cond: '副操縦士', en: { label: 'Minimum total time', value: '1,500 hours', cond: 'First Officer' } },
  'american.jobs.fo-type-rating-fo.86c9d77a': { h: '742686888e4972f9', label: '型式限定', value: '不要（会社の訓練で取る）', cond: '副操縦士', en: { label: 'Type rating', value: 'Not required (training provided)', cond: 'First Officer' } },
  'american.jobs.pilot-posting.0aadb1f3': { h: '2f257e9b9dc0244c', label: '募集', value: 'パイロットの応募を受け付け中', en: { label: 'Hiring', value: 'Accepting pilot applications' } },
  'american.jobs.pilot-right-to-work.ea6132cf': { h: '19bfad60fe6656d8', off: '重複（同じ話を別の行が言っている）' },
  'atlas-air.fleet.747-400-passenger.68b7a8c9': { h: '8395217879d88164', fleet: 'ボーイング 747-400', en: { fleet: 'Boeing 747-400' } },
  'atlas-air.fleet.747-400f-widebody-cargo.efa2cddd': { h: 'd86eeb011b2ef92b', fleet: 'ボーイング 747-400F', en: { fleet: 'Boeing 747-400F' } },
  'atlas-air.fleet.747-8f-widebody-cargo.922b93f5': { h: '501eafdfffb68605', fleet: 'ボーイング 747-8F', en: { fleet: 'Boeing 747-8F' } },
  'atlas-air.fleet.767-300-passenger.ae06f977': { h: '70a75ed3e815000e', fleet: 'ボーイング 767-300', en: { fleet: 'Boeing 767-300' } },
  'atlas-air.fleet.767-300f-titan-dry-lease.028c1867': { h: 'fb62775f4386f531', off: '他社に貸している機体で、自社のパイロットは飛ばさない（同じ型式は別の行）' },
  'atlas-air.fleet.767-300f-widebody-cargo-operated.62fce64d': { h: '3758c5c316bca85d', fleet: 'ボーイング 767-300F', en: { fleet: 'Boeing 767-300F' } },
  'atlas-air.fleet.777-200f-titan-dry-lease.9814f6af': { h: 'e143a9f760d31243', off: '他社に貸している機体で、自社のパイロットは飛ばさない（同じ型式は別の行）' },
  'atlas-air.fleet.777-200f-widebody-cargo-operated.5da1513f': { h: '08e368e745dff9b9', fleet: 'ボーイング 777-200F', en: { fleet: 'Boeing 777-200F' } },
  'atlas-air.fleet.large-cargo-freighter-lcf-boeing-747-400.73035006': { h: '7b6a68847a9f11f0', fleet: 'ボーイング 747-400LCF（ドリームリフター）', en: { fleet: 'Boeing 747-400LCF Dreamlifter' } },
  'atlas-air.jobs.fo-license-fo.0f983229': { h: '2616dcc1dcc2bde5', label: '応募に要る免許', value: 'FAA の定期運送用操縦士（ATP・制限つきでも可）と多発限定・第1種の身体検査・無線の許可（FCC）・英語の能力の記載', cond: '副操縦士', en: { label: 'License required', value: 'Restricted or unrestricted FAA ATP with airplane multi-engine rating and English proficiency endorsement, first-class medical, FCC radiotelephone permit', cond: 'First Officer' } },
  'atlas-air.jobs.fo-posting-fo.63e5b56e': { h: '91cd14f8a6d7da8d', off: '重複（新しい募集を別の行が言っている）' },
  'atlas-air.jobs.fo-posting-fo.a08169e7': { h: '584be8fa418f8d59', label: '募集', value: '副操縦士を募集中', cond: 'ボーイングのワイドボディ機・マイアミ・2026年11月', en: { label: 'Hiring', value: 'First Officers', cond: 'Boeing widebody fleet, Miami, November 2026' } },
  'atlas-air.jobs.fo-right-to-work-fo.1157d394': { h: '87afb4d0cf76ae8b', label: '就労の資格', value: '米国で働ける資格（市民・永住者・就労許可証など）・有効期間が24か月以上残ったパスポート（海外渡航の制限がないこと）', cond: '副操縦士', en: { label: 'Right to work', value: 'Authorized to work in the US (citizen, green card, EAD or other basis); passport valid for at least 24 more months with no international travel restrictions', cond: 'First Officer' } },
  'atlas-air.jobs.fo-total-hours-fo.60806580': { h: '099ac72ef79f523d', off: '重複（同じ話を別の行が言っている）' },
  'atlas-air.jobs.fo-total-hours-fo.7fa5c2fa': { h: 'd84d7aa856bc7a2e', label: '応募に要る飛行時間', value: '1,500時間以上（うち固定翼機で1,000時間。運送事業（Part 121・135）の経験があれば500時間）', cond: '副操縦士', en: { label: 'Minimum total time', value: '1,500 hours total, including 1,000 fixed-wing (or 500 with a Part 121/135 carrier)', cond: 'First Officer' } },
  'atlas-air.jobs.fo-type-rating-fo.6eb3d458': { h: '96a4876af1ac65f3', label: '型式限定', value: '不要（会社の訓練で取る）', cond: '副操縦士', en: { label: 'Type rating', value: 'Not required (training provided)', cond: 'First Officer' } },
  'atlas-air.work.training-bond-fo.a4b5f552': { h: '79c1c676b421dace', off: '重複（型式限定の話を募集の行が言っている）' },
  'atlas-air.work.upgrade-years-cap.598936fc': { h: '870b4b904f7d92b4', label: '機長への昇格', value: '入社から約6年', en: { label: 'Upgrade to captain', value: 'About 6 years from hire' } },
  'avelo-airlines.benefits.staff-travel.453a409d': { h: '69a563e183bed37a', label: '社員の航空券', value: '他社便の割引の航空券（デルタ・ユナイテッド・アラスカ・ルフトハンザ・カンタスなど）', lead: true, en: { label: 'Staff travel', value: 'Reduced-rate travel on other airlines (Delta, United, Alaska, Lufthansa, Qantas and others)' } },
  'avelo-airlines.benefits.staff-travel.c221fbd8': { h: 'd1f5b2a106f86ad8', label: '家族の航空券', value: '親・子・配偶者が他社便の割引の航空券を使える（配偶者がいなければ友人1人）', en: { label: 'Family travel', value: 'Parents, children and spouse can use ZED fares on partner airlines (one friend if you have no spouse)' } },
  'avelo-airlines.jobs.cap-posting-cap.1cf6b578': { h: 'b2e150bd6168eea1', label: '募集', value: '機長（他社から機長として入社）と副操縦士を募集中', en: { label: 'Hiring', value: 'Direct-entry Captains and First Officers' } },
  'avelo-airlines.jobs.cap-total-hours-cap.18f7d278': { h: '81e702911d29dd10', label: '応募に要る飛行時間', value: '合計5,000時間が望ましい（ほかにタービン機と運送事業の機長時間の条件がある）', cond: '他社から機長として入る人', en: { label: 'Flight time for applicants', value: '5,000 hours total preferred (plus turbine and Part 121 PIC minimums)', cond: 'Direct-entry Captain' } },
  'avelo-airlines.jobs.cap-type-rating-cap.55b8a452': { h: '63ab4d89a65009a3', label: '型式限定', value: 'B737NG の型式限定が必要', cond: '他社から機長として入る人', en: { label: 'Type rating', value: 'B737NG type rating required', cond: 'Direct-entry Captain' } },
  'avelo-airlines.jobs.fo-posting-fo.3e4fdc3c': { h: 'acc3bc19dd73585a', off: '重複（同じ募集を別の行がまとめて言っている）' },
  'avelo-airlines.jobs.fo-total-hours-fo.63626aac': { h: '040e888e7205b565', label: '応募に要る飛行時間', value: '1,500時間以上（例外として航空の学士は1,000時間・準学士は1,250時間）', cond: '副操縦士', en: { label: 'Minimum total time', value: '1,500 hours (exceptionally 1,000 with an aviation bachelor’s degree or 1,250 with an associate degree)', cond: 'First Officer' } },
  'avelo-airlines.jobs.fo-type-rating-fo.2ce6079e': { h: '6a382f0d36aac68f', off: '重複（同じ話を別の行が言っている）' },
  'avelo-airlines.jobs.pilot-license.f1745f05': { h: '4a150a584d2fd134', label: '応募に要る免許', value: 'FAA の定期運送用操縦士（ATP・制限なし・多発）か、軍の経歴による制限つきの ATP・第1種の身体検査', cond: '副操縦士', en: { label: 'License required', value: 'Unrestricted ATP with airplane multi-engine rating or military R-ATP; first-class medical', cond: 'First Officer' } },
  'avelo-airlines.jobs.pilot-right-to-work.e9cd9fc2': { h: '9c7c91fa5074e0e0', label: '国籍', value: '米国の市民（有効期間が6か月以上残った米国のパスポート）', en: { label: 'Citizenship', value: 'US citizen with a US passport valid for at least 6 more months' } },
  'avelo-airlines.jobs.pilot-type-rating.806ede3c': { h: '9f2c79abab67b512', label: '型式限定', value: '不要（B737 の型式限定か、ボーイング機・大型ジェット機の経験があれば優遇）', cond: '副操縦士', en: { label: 'Type rating', value: 'Not required (B737 type rating or heavy jet/Boeing experience preferred)', cond: 'First Officer' } },
  'avelo-airlines.profile.founded.0b62990b': { h: '51e6a89a2d25fb1d', off: '設立と紛れる（ブランドとしての最初の便の日。設立は別の行）' },
  'avelo-airlines.profile.founded.d306d904': { h: '45316a98bd1b027b', label: '設立', value: '1987年7月20日', cond: '前身のカジノ・エクスプレス航空として', en: { label: 'Founded', value: '20 July 1987', cond: 'As predecessor Casino Express Airlines' } },
  'jazz.benefits.commuting.6cdd4ab7': { h: 'a3c42122cbd20e7a', label: '通勤の決まり', value: '空席のある便が2便あれば、乗れずに遅れても責任を問われない（遅いほうがチェックインの30分前までに着く便）', en: { label: 'Commuter policy', value: 'Protected if two flights with open seats were available, the later scheduled to arrive at least 30 minutes before check-in' } },
  'jazz.benefits.commuting.95ff7427': { h: 'c3eb025f44fd11b3', label: '社員の航空券', value: '勤続28週から使える（通勤のためなら訓練の1週目から、エア・カナダと他社の便に空席待ちで乗れる）', lead: true, en: { label: 'Staff travel', value: 'Available after 28 weeks of service (standby on Air Canada and other airlines for commuting from the first week of training)' } },
  'jazz.fleet.crj900.0c98fd16': { h: '611d3764418ba948', fleet: 'CRJ900', en: { fleet: 'CRJ900' } },
  'jazz.fleet.dash-8-400.b6112f35': { h: '1810a0b0601f5ff3', fleet: 'DHC-8-400', en: { fleet: 'DHC-8-400' } },
  'jazz.jobs.fo-license-fo.355d672c': { h: '89191f27e07a5317', label: '応募に要る免許', value: 'カナダの事業用操縦士（CPL）・多発限定・計器飛行証明（グループ1）・第1種の身体検査・ATPL の学科試験の合格（IATRA は24か月以内）。カナダの ATPL を持つ人を優遇', cond: '副操縦士', en: { label: 'License required', value: 'Transport Canada CPL, multi-engine rating, Group 1 instrument rating, Class 1 medical, and IATRA (within 24 months) or ATPL written exams passed; Canadian ATPL preferred', cond: 'First Officer' } },
  'jazz.jobs.fo-posting-fo.a4aa90fe': { h: '4da2e6fa9b120074', label: '募集', value: '副操縦士を募集中', rows: [['一般の応募', '2026年12月18日締切'], ['提携校の卒業生・訓練生', '2026年12月31日締切']], cond: 'トロント・モントリオール・カルガリー・バンクーバー', en: { label: 'Hiring', value: 'First Officers', rows: [['General applications', 'Closes December 18, 2026'], ['Partner-school graduates and cadets', 'Closes December 31, 2026']], cond: 'Toronto, Montreal, Calgary, Vancouver' } },
  'jazz.jobs.fo-posting-fo.ed5e550d': { h: 'bebc4f756eb705a7', off: '重複（同じ募集を別の行がまとめて言っている）' },
  'jazz.jobs.fo-total-hours-fo.42ee43a1': { h: '09295b51237cbe81', label: '応募に要る飛行時間', value: '500時間以上（提携校の卒業生は250時間か ATPL の一貫課程の修了）', cond: '副操縦士', en: { label: 'Minimum total time', value: '500 hours (partner-school graduates: 250 hours or an integrated ATPL program)', cond: 'First Officer' } },
  'jazz.jobs.fo-total-hours-fo.88832d18': { h: '92cece48a740c8f0', off: '重複（同じ話を別の行が言っている）' },
  'jazz.jobs.fo-type-rating-fo.6f97d094': { h: 'd265da2e50fedd66', label: '型式限定', value: '不要（入社後に会社の初期訓練がある）', cond: '副操縦士', en: { label: 'Type rating', value: 'Not required (Jazz initial pilot training after hire)', cond: 'First Officer' } },
  'jazz.jobs.pilot-right-to-work.40303346': { h: '0065e8464e424568', label: '就労の資格', value: 'カナダの市民か永住者（制限なし。永住者は米国の乗員ビザを取れること）・パスポート', en: { label: 'Right to work', value: 'Canadian citizen or permanent resident without restrictions (permanent residents must be able to obtain US crew visa documents); current passport' } },
  'jazz.profile.founded.b92cf5b6': { h: '8d262a3126bdca3f', off: '重複（設立は別の行。2002年はブランドの始まり）' },
  'jazz.scale.fleet-total.c5d97219': { h: 'b63de5364a9dddb4', off: '重複（運航している機材は別の行。103機は親会社が数えた、リースや契約の機体を含む数）' },
  'jazz.work.training-bond.56f7bdcc': { h: '4d5a3cc0b8470a75', label: '勤続の約束（ボンド）', value: 'なし（卒業後いつ辞めてもよい）', cond: 'CAE の養成課程（Jazz Approach）の訓練生', en: { label: 'Training bond', value: 'None (free to leave at any time after graduating)', cond: 'Cadets in the CAE Jazz Approach program' } },
  'porter.work.training-bond.85c13b0e': { h: 'a3f6b251e2685fcd', label: '勤続の約束（ボンド）', value: 'なし（卒業後いつ辞めてもよい）', cond: 'CAE の養成課程（Destination Porter）の訓練生', en: { label: 'Training bond', value: 'None (free to leave at any time after graduating)', cond: 'Cadets in the CAE Destination Porter program' } },
  'porter.work.upgrade-years.bd7b2122': { h: 'ab2c3cd93aaa1c05', off: '宣伝の文句で、昇格までの年数が無い' },
  'westjet.benefits.commuting.473fc047': { h: '8f5115747c59424f', label: '社員の航空券', value: 'ウエストジェットのグループの便に空席待ちで乗れる（乗る順は勤続の長さで決まらない）', lead: true, en: { label: 'Staff travel', value: 'Standby travel on WestJet Group flights (priority not based on seniority)' } },
  'westjet.benefits.commuting.5bfd713e': { h: '2a4e7bfc836d79ae', label: '通勤の費用', value: 'ホテル・食事など、通勤にかかる費用は本人が払う', en: { label: 'Commuting costs', value: 'Paid by the pilot, including hotels and meals' } },
  'westjet.benefits.commuting.e9d76ca2': { h: 'aeeb370eb2ac9489', label: '空港の駐車場', value: '会社が出す（拠点か、自分で選んだ空港。拠点の駐車場の月額まで）', en: { label: 'Airport parking', value: 'Company-paid at your base or an airport of your choice (up to the cost of base parking)' } },
  'westjet.work.upgrade-years.672d6dbe': { h: '1392c7ba2c0afe18', label: '機長への昇格', value: '勤続の長い順（機種の移行も同じ）', cond: 'ウエストジェットのグループ', en: { label: 'Upgrade to captain', value: 'By seniority (fleet moves too)', cond: 'WestJet Group' } },
  /* ★2026-11-19 残りの答え 回B-2（北米-2）── 比べられる条件の形に直した字（off は出さない理由） */
  'breeze-airways.work.training-bond.c3157215': { h: 'de2a098c366112d2', label: '勤続の約束（ボンド）', value: 'なし', cond: '2026年', en: { label: 'Training bond', value: 'None', cond: '2026' } },
  'breeze-airways.work.upgrade-years.3c449ee9': { h: '5436b373e386f0a3', off: '2023年の見込みで、新しい行（勤続の長い順で約2年）と食い違う' },
  'breeze-airways.work.upgrade-years.91c89323': { h: '2e1e443a1d66025b', label: '機長への昇格', value: '約2年（勤続の長い順に昇格）', cond: '2025年12月', en: { label: 'Upgrade to captain', value: 'About 2 years (by seniority)', cond: 'December 2025' } },
  'breeze-airways.work.upgrade-years.e688c508': { h: '7c565283fb3d2082', off: '2023年の見込みで、新しい行（勤続の長い順で約2年）と食い違う' },
  'contour.benefits.commuting.ee3cc917': { h: '1510b96c69dc3734', label: '住む場所の条件', value: '勤務に当たる期間は、呼び出しから120分以内に出社できる所に住む', cond: '機長・副操縦士・2026年', en: { label: 'Residence requirement', value: 'Must be able to report within 120 minutes of a call during assigned duty periods', cond: 'Captains and First Officers, 2026' } },
  'contour.fleet.bombardier-crj-100-200.50d30c1f': { h: '4bae5485735f3cb9', off: '重複（同じ型式の行がほかにある）' },
  'contour.fleet.bombardier-crj200.e4ea8ea7': { h: '2a60cde20556a671', fleet: 'ボンバルディア CRJ200', en: { fleet: 'Bombardier CRJ200' } },
  'contour.fleet.crj200.31f2d215': { h: 'c404e8a940095860', off: '重複（同じ型式の行がほかにある）' },
  'contour.fleet.embraer-erj-135-145.97981068': { h: 'e05f7f0a74b8245f', off: '重複（同じ型式の行がほかにある）' },
  'contour.fleet.embraer-erj-135.65a53805': { h: 'a1acfbdf691e9033', fleet: 'エンブラエル ERJ135', en: { fleet: 'Embraer ERJ135' } },
  'contour.fleet.embraer-erj-140.c2b2a1b7': { h: '569c485a1ee805a2', fleet: 'エンブラエル ERJ140', en: { fleet: 'Embraer ERJ140' } },
  'contour.fleet.embraer-erj-145.77ae1f06': { h: '236a31469d744131', fleet: 'エンブラエル ERJ145', en: { fleet: 'Embraer ERJ145' } },
  'contour.fleet.embraer-legacy-600.4939ca35': { h: '94b865ff08375d2f', fleet: 'エンブラエル レガシー600', en: { fleet: 'Embraer Legacy 600' } },
  'contour.fleet.erj-145.c8edd8e3': { h: '283ae1224f6e805f', off: '重複（同じ型式の行がほかにある）' },
  'contour.jobs.cap-posting-cap.54f007b5': { h: '0dee220e7018cb74', label: '募集', value: '機長を募集中', cond: 'CRJ200・2026年11月', en: { label: 'Hiring', value: 'Captains', cond: 'CRJ200, November 2026' } },
  'contour.jobs.cap-posting-cap.650ba62d': { h: '88a6dce73cc33f47', label: '募集', value: '機長を募集中', cond: 'セスナ サイテーション XLS・2026年11月', en: { label: 'Hiring', value: 'Captains', cond: 'Cessna Citation XLS, November 2026' } },
  'contour.jobs.cap-right-to-work-cap.c913bfaf': { h: '4a86bbd45f615657', label: '働く資格', value: '米国で働く資格・米国を自由に出入りできること・有効な旅券', cond: '機長・副操縦士', en: { label: 'Right to work', value: 'US work authorization, freedom to travel in and out of the US, and a current passport', cond: 'Captains and First Officers' } },
  'contour.jobs.cap-total-hours-cap.339be2cc': { h: '1273e095680a213f', label: '応募に要る飛行時間', value: '3,000時間以上（うち機長時間1,500時間・この型式の機長時間250時間）', cond: '機長・エンブラエル レガシー600', en: { label: 'Minimum total time', value: '3,000 hours, including 1,500 PIC and 250 PIC in type', cond: 'Captain, Embraer Legacy 600' } },
  'contour.jobs.cap-total-hours-cap.4252dbaa': { h: '446a8d307268bd9c', label: '応募に要る飛行時間', value: '1,500時間以上（うち機長時間500時間・多発機500時間）。望ましいのは2,500時間', cond: '機長・CRJ・ERJ', en: { label: 'Minimum total time', value: '1,500 hours, including 500 PIC and 500 multi-engine (2,500 preferred)', cond: 'Captain, CRJ and ERJ' } },
  'contour.jobs.cap-total-hours-cap.6ddfd457': { h: '90fccf3d4fd99d43', label: '応募に要る飛行時間', value: '3,500時間以上（うち機長時間2,000時間・タービン機2,000時間・この型式の機長時間250時間）', cond: '機長・セスナ サイテーション XLS', en: { label: 'Minimum total time', value: '3,500 hours, including 2,000 PIC, 2,000 turbine and 250 PIC in type', cond: 'Captain, Cessna Citation XLS' } },
  'contour.jobs.cap-type-rating-cap.ac245505': { h: '0c2b89a84f0d680d', label: '型式限定', value: '必要（その型式で最近の飛行経験と技量があること）', cond: '機長・エンブラエル レガシー600', en: { label: 'Type rating', value: 'Required; current and proficient in type', cond: 'Captain, Embraer Legacy 600' } },
  'contour.jobs.cap-type-rating-cap.c6b4187c': { h: '2a0859e39fabf985', label: '型式限定', value: 'あると望ましい（その型式の最近の飛行経験も）', cond: '機長・CRJ・ERJ', en: { label: 'Type rating', value: 'Type rating and currency preferred', cond: 'Captain, CRJ and ERJ' } },
  'contour.jobs.fo-posting-fo.3d680b3f': { h: '680ee19c5221831a', off: '過去の求人（会社のページでは2026年11月18日時点で副操縦士の新規募集を止めている）' },
  'contour.jobs.fo-right-to-work-fo.690e6cf5': { h: '8476ccabb93e3754', off: '重複（同じ話を別の行が言っている）' },
  'contour.jobs.fo-total-hours-fo.3c10ebb6': { h: 'c583878282d1063f', label: '応募に要る飛行時間', value: '1,000時間以上（うち機長時間500時間・陸上多発機25時間・計器飛行75時間）', cond: '副操縦士・エンブラエル レガシー600', en: { label: 'Minimum total time', value: '1,000 hours, including 500 PIC, 25 multi-engine land and 75 instrument', cond: 'First Officer, Embraer Legacy 600' } },
  'contour.jobs.fo-total-hours-fo.70cd6b22': { h: '8f9b469be87ad0e7', label: '応募に要る飛行時間', value: '1,200時間以上（うち機長時間250時間・多発機25時間・計器飛行75時間）', cond: '副操縦士・セスナ サイテーション XLS', en: { label: 'Minimum total time', value: '1,200 hours, including 250 PIC, 25 multi-engine and 75 instrument', cond: 'First Officer, Cessna Citation XLS' } },
  'contour.jobs.fo-total-hours-fo.a55c7926': { h: '728a32824a11d62f', label: '応募に要る飛行時間', value: '500時間以上（うち多発機25時間）', cond: '副操縦士・CRJ・ERJ', en: { label: 'Minimum total time', value: '500 hours, including 25 multi-engine', cond: 'First Officer, CRJ and ERJ' } },
  'contour.jobs.fo-type-rating-fo.163896b0': { h: '2a3bb1db4f4fd29f', label: '型式限定', value: '不要（会社が訓練する）', cond: '副操縦士・CRJ・ERJ', en: { label: 'Type rating', value: 'Not required (company training)', cond: 'First Officer, CRJ and ERJ' } },
  'contour.profile.headquarters-city.723d3221': { h: '00e7ccff26e3027d', label: '本社', value: 'スマーナ', en: { label: 'Headquarters', value: 'Smyrna' } },
  'contour.scale.fleet-total.6ad577bd': { h: '6bb565ac8bb5a174', label: '運航している機材', value: '約30機', cond: '2026年', en: { label: 'Aircraft in service', value: 'About 30', cond: '2026' } },
  'contour.scale.fleet-total.8630121b': { h: 'ad5d4ab380396ce3', off: '重複（会社が言う機数の行を残す）' },
  'contour.scale.fleet-total.9387d2df': { h: '8060e50e02bd8935', off: '重複（会社が言う機数の行を残す）' },
  'contour.work.days-off.69533b0f': { h: '328a030187e85ab2', label: '休日', value: '14日で6日', cond: '機長・エンブラエル レガシー600・2026年', same: 'contour.work.roster-pattern-cap.3690cd3d', en: { label: 'Days off', value: '6 in every 14 days', cond: 'Captain, Embraer Legacy 600, 2026' } },
  'contour.work.roster-pattern-cap.3690cd3d': { h: '36bf3172a15ba1c3', label: '勤務の組み方', value: '8日勤務・6日休みの繰り返し（勤務の希望は出せない）', cond: '機長・エンブラエル レガシー600・2026年', lead: true, en: { label: 'Work pattern', value: '8 days on, 6 days off (no schedule requests)', cond: 'Captain, Embraer Legacy 600, 2026' } },
  'contour.work.working-time.704af64c': { h: '88a652c6e4ca982b', off: '同じ話が調べた条件のカードにある' },
  'contour.work.working-time.8e6fab79': { h: 'd99cfcc74a2f1127', label: '月のフライトタイム', value: '月30〜80時間（忙しい時期はそれ以上）', cond: 'CRJ・ERJ・2026年', en: { label: 'Monthly flight time', value: '30–80 hours a month (more in busy periods)', cond: 'CRJ and ERJ, 2026' } },
  'contour.work.working-time.bd51d8e0': { h: 'e48808a081b24983', label: '月のフライトタイム', value: '月30〜80時間（忙しい時期はそれ以上）', cond: 'CRJ・ERJ・2026年', same: 'contour.work.working-time.8e6fab79', en: { label: 'Monthly flight time', value: '30–80 hours a month (more in busy periods)', cond: 'CRJ and ERJ, 2026' } },
  'fedex-express.benefits.commuting.2ed03f9c': { h: '6c2800e19bd91485', off: '手続きの細かい話（便乗の振り替えやホテルの取り消しで貯まる口座の上限）' },
  'fedex-express.benefits.commuting.d73a253f': { h: 'fc962f3ab142c2f7', label: '通勤の保護', value: '決まりどおりに通勤すれば、乗れずに遅れても処分されない', rows: [['他社の航空券での通勤', '代わりの手立てがあれば対象'], ['ジャンプシートでの通勤', '出社の1時間前までに着く便なら対象（以前は1時間30分前）']], cond: '2026年の労働協約', en: { label: 'Commuter protection', value: 'No discipline for a missed commute made within the rules', rows: [['Commuting on a commercial ticket', 'Covered with a backup plan'], ['Commuting on a jumpseat', 'Covered if the flight blocks in 1:00 before show (was 1:30)']], cond: '2026 contract' } },
  'fedex-express.fleet.airbus-a300-600.57348535': { h: 'd37e459a9129c25a', fleet: 'エアバス A300-600', en: { fleet: 'Airbus A300-600' } },
  'fedex-express.fleet.atr-42.29c231f2': { h: 'cccf3902d33b71c6', off: 'FedEx のパイロットが飛ばない機材（提携の会社が運航する小型機）' },
  'fedex-express.fleet.atr-72-600f.362c4c0b': { h: 'eae5b1e48e802f5a', off: 'FedEx のパイロットが飛ばない機材（提携の会社が運航する小型機）' },
  'fedex-express.fleet.atr-72.d2ee387a': { h: '94a7f6707b4f9b65', off: 'FedEx のパイロットが飛ばない機材（提携の会社が運航する小型機）' },
  'fedex-express.fleet.boeing-md11.71c74aaa': { h: 'a8392ae8a02bfb1b', fleet: 'マクドネル・ダグラス MD-11', en: { fleet: 'McDonnell Douglas MD-11' } },
  'fedex-express.fleet.cessna-208b.bcec2f19': { h: '5d92757b5f712549', off: 'FedEx のパイロットが飛ばない機材（提携の会社が運航する小型機）' },
  'fedex-express.fleet.cessna-408-skycourier.f454fe41': { h: 'e17f0f0e7344d3ac', off: 'FedEx のパイロットが飛ばない機材（提携の会社が運航する小型機）' },
  'fedex-express.jobs.fo-license-fo.9bf0a85e': { h: '3c49fde5723aad4a', label: '応募に要る免許', value: 'ATP（制限なし・多発）・第1種の身体検査・FCC の無線の許可', cond: '副操縦士', en: { label: 'License required', value: 'Unrestricted multi-engine ATP, first-class medical and FCC radiotelephone permit', cond: 'First Officer' } },
  'fedex-express.jobs.fo-posting-fo.c4cd4660': { h: '39739bf444614a8e', off: '手続きの話（応募の仕方）' },
  'fedex-express.jobs.fo-right-to-work-fo.3043ef56': { h: '97d921dab9ba38be', label: '働く資格', value: '米国籍か永住権（グリーンカード）。就労ビザの支援は無い', cond: '副操縦士', en: { label: 'Right to work', value: 'US citizenship or a green card; no work visa sponsorship', cond: 'First Officer' } },
  'fedex-express.jobs.fo-total-hours-fo.5bf97f8d': { h: '8d3384762b40ffad', label: '応募に要る飛行時間', value: '1,500時間以上（固定翼）。うちジェット機か多発ターボプロップ機などの機長時間500時間（望ましいのは1,000時間）', cond: '副操縦士', en: { label: 'Minimum total time', value: '1,500 hours fixed-wing, including 500 PIC in jets, multi-engine turboprops or similar (1,000 preferred)', cond: 'First Officer' } },
  'fedex-express.jobs.fo-type-rating-fo.634d7784': { h: 'bb3c2fab07a4f501', label: '型式限定', value: '不要（会社が訓練する）', cond: '副操縦士', en: { label: 'Type rating', value: 'Not required (company training)', cond: 'First Officer' } },
  'fedex-express.scale.fleet-total.2ceeb413': { h: 'a662f0197a194d97', off: '重複（FedEx のパイロットが飛ぶジェット機の数の行を残す。700機は提携の会社が飛ぶ小型機を含む）' },
  'fedex-express.scale.fleet-total.45db90ff': { h: 'de1a62813ecff734', label: '運航している機材', value: '383機', cond: 'ジェット機・2026年5月', en: { label: 'Aircraft in service', value: '383', cond: 'Jets, May 2026' } },
  'fedex-express.work.training-bond.33ccb400': { h: '4ff02d9716297cb6', off: '口コミの意見で、決まりとして言えない' },
  'fedex-express.work.training-bond.9ec34598': { h: '22c6e3e618e547c3', label: '提携会社からの移籍の条件', value: '経路に入ってから、提携の小型機の会社で36か月以上勤め、多発ターボプロップ機の機長時間500時間以上', cond: '提携会社のパイロット（Purple Runway）', en: { label: 'Feeder pathway requirement', value: 'At least 36 months with a feeder operator and 500 hours PIC in multi-engine turboprops after admission', cond: 'Feeder pilots (Purple Runway)' } },
  'fedex-express.work.upgrade-years.2c1bd069': { h: '4b21fc39381f7816', label: '機長への昇格', rows: [['B757 の機長', '7〜8年'], ['ワイドボディ機の機長', '9〜10年']], cond: '新型コロナの前', en: { label: 'Upgrade to captain', rows: [['B757 captain', '7–8 years'], ['Widebody captain', '9–10 years']], cond: 'Before COVID' } },
  'gojet.benefits.annual-leave.63453823': { h: 'e425113289023699', label: '年次休暇', rows: [['勤続1年以上', '年2週間'], ['勤続5年以上', '年3週間']], cond: '2023年', lead: true, en: { label: 'Annual leave', rows: [['After 1 year', '2 weeks a year'], ['After 5 years', '3 weeks a year']], cond: '2023' } },
  'gojet.benefits.commuting.597cb67b': { h: 'c029876c4d6a155f', label: '通勤の手当', rows: [['確定席の通勤の航空券', 'USD 1,000 まで会社が負担'], ['通勤のためのホテル', '月6泊（機長）']], cond: '2025年', en: { label: 'Commuting support', rows: [['Positive-space commuting', 'Up to USD 1,000'], ['Commuter hotels', '6 nights a month (captains)']], cond: '2025' } },
  'gojet.fleet.crj550.41214cdd': { h: '2f4019b366ce2d1e', fleet: 'ボンバルディア CRJ550', en: { fleet: 'Bombardier CRJ550' } },
  'gojet.jobs.cap-license-cap.188f588a': { h: '17e5833b62fd4c8a', label: '応募に要る免許', value: 'ATP（多発）・計器飛行証明・第1種の身体検査・FCC の無線の許可', cond: '機長（直接採用）', en: { label: 'License required', value: 'Multi-engine ATP, instrument rating, first-class medical and FCC radio permit', cond: 'Direct-entry captain' } },
  'gojet.jobs.cap-posting-cap.15df19b3': { h: '5f635b71e4998f0f', label: '募集', value: '機長を直接採用で募集中', cond: 'CRJ550', en: { label: 'Hiring', value: 'Direct-entry captains', cond: 'CRJ550' } },
  'gojet.jobs.cap-right-to-work-cap.da618cef': { h: 'ad3e7a26e08d0123', label: '働く資格', value: '米国で働く資格・米国を自由に出入りできること・有効な旅券', cond: '機長（直接採用）', en: { label: 'Right to work', value: 'US work authorization, freedom to travel in and out of the US, and a valid passport', cond: 'Direct-entry captain' } },
  'gojet.jobs.cap-total-hours-cap.98e3b21f': { h: 'c799a489e3b34210', label: '応募に要る飛行時間', value: '1,750時間以上（固定翼）。うち多発機・航空会社での乗務・タービン機がそれぞれ1,000時間', cond: '機長（直接採用）', en: { label: 'Minimum total time', value: '1,750 hours fixed-wing, including 1,000 hours each of multi-engine, air carrier and turbine time', cond: 'Direct-entry captain' } },
  'gojet.jobs.cap-type-rating-cap.ef6377f7': { h: 'e6c3fe027332ef33', label: '型式限定', value: '入社前は不要（会社が訓練する）', cond: '機長（直接採用）・CRJ', en: { label: 'Type rating', value: 'Not required before hire (company training)', cond: 'Direct-entry captain, CRJ' } },
  'gojet.jobs.fo-license-fo.aa11ee90': { h: '900ddd7714780b1c', label: '応募に要る免許', value: 'ATP か R-ATP、または事業用操縦士（陸上多発）・計器飛行証明・第1種の身体検査・FCC の無線の許可・ATP-CTP の修了証と ATP の学科試験の合格', cond: '副操縦士', en: { label: 'License required', value: 'ATP, R-ATP or commercial multi-engine land certificate, instrument rating, first-class medical, FCC radio permit, and an ATP-CTP certificate with the ATP written passed', cond: 'First Officer' } },
  'gojet.jobs.fo-posting-fo.61864547': { h: '1bdd942ef2a343b6', label: '募集', value: '副操縦士を募集中', cond: 'CRJ550', en: { label: 'Hiring', value: 'First Officers', cond: 'CRJ550' } },
  'gojet.jobs.fo-right-to-work-fo.7bc99e3a': { h: 'b32898155f343ce2', label: '働く資格', value: '米国で働く資格と有効な旅券。オーストラリア国籍の人は E-3 ビザで応募できる', cond: '副操縦士', en: { label: 'Right to work', value: 'US work authorization and a valid passport; Australian citizens can apply on an E-3 visa', cond: 'First Officer' } },
  'gojet.jobs.fo-total-hours-fo.0847fa47': { h: '30d773b93f810555', label: '応募に要る飛行時間', rows: [['ATP', '1,500時間（うち機長時間250時間・多発機25時間）'], ['軍出身（R-ATP）', '750時間'], ['航空の学士（R-ATP）', '1,000時間'], ['航空の準学士（R-ATP）', '1,250時間']], cond: '副操縦士', en: { label: 'Minimum total time', rows: [['ATP', '1,500 hours, including 250 PIC and 25 multi-engine'], ['Military (R-ATP)', '750 hours'], ['Aviation bachelor\'s degree (R-ATP)', '1,000 hours'], ['Aviation associate degree (R-ATP)', '1,250 hours']], cond: 'First Officer' } },
  'gojet.jobs.fo-total-hours-fo.6ce93413': { h: '54a4eceb4bd9013e', off: '重複（同じ話を別の行が言っている）' },
  'gojet.jobs.fo-type-rating-fo.5e1db87f': { h: '79a8722b8b5f2ca9', label: '型式限定', value: '不要（会社が訓練する）', cond: '副操縦士', en: { label: 'Type rating', value: 'Not required (company training)', cond: 'First Officer' } },
  'gojet.scale.fleet-total.297c5622': { h: '8d98cfa67907d01f', label: '運航している機材', value: '56機', cond: '2024年8月', en: { label: 'Aircraft in service', value: '56', cond: 'August 2024' } },
  'gojet.work.days-off.96c2a08a': { h: '653cac78d984a988', label: '月の休日', rows: [['乗務が決まっている月', '12〜18日（勤続の長さと選ぶ乗務による）'], ['スタンバイ要員の月', '11日']], cond: '2025年', same: 'gojet.work.days-off.9f52cb48', en: { label: 'Days off per month', rows: [['Lineholders', '12–18 (depending on seniority and trips bid)'], ['Reserve', '11']], cond: '2025' } },
  'gojet.work.days-off.9f52cb48': { h: 'e490b306d107c846', label: '月の休日', rows: [['乗務が決まっている月', '12〜18日（勤続の長さと選ぶ乗務による）'], ['スタンバイ要員の月', '11日']], cond: '2025年', lead: true, en: { label: 'Days off per month', rows: [['Lineholders', '12–18 (depending on seniority and trips bid)'], ['Reserve', '11']], cond: '2025' } },
  'gojet.work.roster-pattern.0c4ef37f': { h: 'a8cc78d2b598a74a', label: 'スタンバイ', rows: [['呼び出しから出社までの余裕', '12時間（一部の日は2時間に変えられる）'], ['空港での待機', 'なし']], cond: '2025年', en: { label: 'Reserve', rows: [['Callout time', '12 hours (some days can be converted to 2 hours)'], ['Airport reserve', 'None']], cond: '2025' } },
  'gojet.work.working-time.178811c1': { h: 'ca775e60e41ac626', off: '同じ話が調べた条件のカードにある' },
  'kalitta-air.base.pilot-base-city.8523d395': { h: 'f1c0b70cfa0a0ad0', off: '重複（同じ拠点を空港の行が言っている）' },
  'kalitta-air.base.pilot-base-city.b1c17202': { h: 'e1d171c9c4fcbceb', off: '拠点ではない（就航地の例）' },
  'kalitta-air.base.pilot-base-city.dba076eb': { h: '0e24de677a1be3af', off: '拠点ではない（就航地の例）' },
  'kalitta-air.base.pilot-base.6ac8d24e': { h: '9684b84f6e348a7e', off: '同じ話が調べた条件のカードにある' },
  'kalitta-air.base.pilot-base.a8bce7dc': { h: '39c6e7c245382817', off: '同じ話が調べた条件のカードにある' },
  'kalitta-air.benefits.staff-travel.233eb0bf': { h: '8e5222be74fa568e', off: '手続きの細かい話（自社機のジャンプシートの割り当て）' },
  'kalitta-air.benefits.staff-travel.bcd9f998': { h: '6d12a8bde95ddd1a', label: '乗務の行き帰りの航空券のマイル', value: '本人のものになる', cond: '2024年', en: { label: 'Miles on positioning flights', value: 'Pilots keep the airline miles and points', cond: '2024' } },
  'kalitta-air.fleet.boeing-747-400-cargo-jets.47d17fe8': { h: '131dde9ddfb60575', off: '重複（同じ型式の行がほかにある）' },
  'kalitta-air.fleet.boeing-747-400bcf.a03a4a1b': { h: 'cf6cb59a89856779', fleet: 'ボーイング 747-400BCF', en: { fleet: 'Boeing 747-400BCF' } },
  'kalitta-air.fleet.boeing-747-400erf.f3d100dc': { h: '4a8e8589ce21ebfd', fleet: 'ボーイング 747-400ERF', en: { fleet: 'Boeing 747-400ERF' } },
  'kalitta-air.fleet.boeing-777-300ersf.fe93bb66': { h: '67c39235563d6f3f', fleet: 'ボーイング 777-300ERSF', en: { fleet: 'Boeing 777-300ERSF' } },
  'kalitta-air.fleet.boeing-777-factory-built-freighters.00e4798d': { h: '3cafffbc2281379b', off: '重複（同じ型式の行がほかにある）' },
  'kalitta-air.jobs.cap-license-cap.7d85e724': { h: 'b037670ef72c3dc6', label: '応募に要る免許', value: 'ATP・第1種の身体検査・FCC の無線の許可', cond: '副チーフパイロット・B747', en: { label: 'License required', value: 'ATP, first-class medical and FCC radio license', cond: 'Assistant Chief Pilot, B747' } },
  'kalitta-air.jobs.cap-posting-cap.8b312a41': { h: 'eb89d89588fc52c7', label: '募集', value: '副チーフパイロットを募集中', cond: 'B747', en: { label: 'Hiring', value: 'Assistant Chief Pilot', cond: 'B747' } },
  'kalitta-air.jobs.cap-right-to-work-cap.7cb73e26': { h: '730790d45954cd1b', off: '重複（同じ話を別の行が言っている）' },
  'kalitta-air.jobs.cap-total-hours-cap.86d46e02': { h: 'eecfeae8d6b1e671', label: '応募に要る飛行時間', value: '2,500時間以上（うちジェット機1,500時間）。望ましいのは4,000時間', cond: '副チーフパイロット・B747', en: { label: 'Minimum total time', value: '2,500 hours, including 1,500 jet (4,000 preferred)', cond: 'Assistant Chief Pilot, B747' } },
  'kalitta-air.jobs.cap-type-rating-cap.9ef5b2b7': { h: 'bb91b0a221edca68', label: '型式限定', value: '不要（会社の B747 か B777 の機長昇格の訓練を修了できること）', cond: '副チーフパイロット・B747', en: { label: 'Type rating', value: 'Not required; must be able to complete the company\'s B747 or B777 captain upgrade program', cond: 'Assistant Chief Pilot, B747' } },
  'kalitta-air.jobs.fo-license-fo.7553bc61': { h: '3edd21fab325e34a', label: '応募に要る免許', value: 'ATP か R-ATP（多発）・第1種の身体検査・FCC の無線の許可', cond: '副操縦士', en: { label: 'License required', value: 'Multi-engine ATP or R-ATP, first-class medical and FCC radio license', cond: 'First Officer' } },
  'kalitta-air.jobs.fo-posting-fo.0d0fb23c': { h: '9909cfbdd4ca361a', label: '募集', value: '副操縦士を募集中', en: { label: 'Hiring', value: 'First Officers' } },
  'kalitta-air.jobs.fo-right-to-work-fo.323a6e19': { h: '4711763275290692', label: '働く資格', value: '米国で働く資格・米国の旅券・海外への渡航に制限が無いこと', cond: '副操縦士', en: { label: 'Right to work', value: 'Legal to work in the US, a current US passport and no restrictions on international travel', cond: 'First Officer' } },
  'kalitta-air.jobs.fo-total-hours-fo.b55d9591': { h: 'f50d0f391f332138', label: '応募に要る飛行時間', value: '1,500時間以上。望ましいのは2,000時間（うちジェット機1,000時間・ジェット機の機長時間500時間）', cond: '副操縦士', en: { label: 'Minimum total time', value: '1,500 hours (2,000 preferred, including 1,000 jet and 500 jet PIC)', cond: 'First Officer' } },
  'kalitta-air.jobs.fo-type-rating-fo.af67fc89': { h: '9c4c92cea180483b', label: '型式限定', value: '不要（会社が訓練する）', cond: '副操縦士', en: { label: 'Type rating', value: 'Not required (company training)', cond: 'First Officer' } },
  'kalitta-air.profile.headquarters-city.04ccc1a8': { h: 'a22d1c31ff411e68', label: '本社', value: 'イプシランティ', en: { label: 'Headquarters', value: 'Ypsilanti, Michigan' } },
  'kalitta-air.scale.fleet-total.ac469137': { h: '42e65160e76fd606', label: '運航している機材', value: '37機', cond: '2026年6月', en: { label: 'Aircraft in service', value: '37', cond: 'June 2026' } },
  'northern-air-cargo.benefits.annual-leave.b56e144a': { h: '1bacfc013d9799e0', label: '年次休暇', value: '有給休暇と有給の祝日がある', cond: 'フルタイムの社員全体', en: { label: 'Annual leave', value: 'Paid time off and paid holidays', cond: 'All regular full-time staff' } },
  'northern-air-cargo.benefits.commuting.56e34c12': { h: '28be8633d0639d4f', off: '同じ話が調べた条件のカードにある' },
  'northern-air-cargo.fleet.boeing-737-300-sf.43e2fe99': { h: 'f881443ecb3b7408', fleet: 'ボーイング 737-300SF', en: { fleet: 'Boeing 737-300SF' } },
  'northern-air-cargo.fleet.boeing-737-400-sf.fc726913': { h: 'e581085ce874e546', fleet: 'ボーイング 737-400SF', en: { fleet: 'Boeing 737-400SF' } },
  'northern-air-cargo.fleet.boeing-737-800-sf.6c32212e': { h: 'd7d9ce89af06845e', fleet: 'ボーイング 737-800SF', en: { fleet: 'Boeing 737-800SF' } },
  'northern-air-cargo.jobs.cap-total-hours-cap.dfaa9504': { h: '45b2196d4f67491f', off: '過去の管理職の求人で、今の採用の条件と言えない' },
  'northern-air-cargo.jobs.fo-license-fo.7f0e8f5a': { h: 'b9dd73072b4da582', label: '応募に要る免許', value: 'ATP（多発）・第1種の身体検査・FCC の無線の許可', cond: '副操縦士・B737', en: { label: 'License required', value: 'Multi-engine ATP, first-class medical and FCC restricted radiotelephone permit', cond: 'First Officer, B737' } },
  'northern-air-cargo.jobs.fo-posting-fo.8eec387e': { h: '00b0812fc3f066b2', label: '募集', value: '副操縦士を募集中', cond: 'B737・アンカレジ・2026年12月10日まで掲載', en: { label: 'Hiring', value: 'First Officers', cond: 'B737, Anchorage, listed until December 10, 2026' } },
  'northern-air-cargo.jobs.fo-right-to-work-fo.484f511d': { h: '9687dafe49906e38', label: '働く資格', value: '米国籍か永住権・海外へ制限なく渡航できること（ビザの支援なし）', cond: '副操縦士', en: { label: 'Right to work', value: 'US citizenship or a green card and unrestricted international travel; no visa sponsorship', cond: 'First Officer' } },
  'northern-air-cargo.jobs.fo-total-hours-fo.833f346a': { h: 'bc3775e8af22f828', label: '応募に要る飛行時間', value: '1,500時間以上（うち機長時間250時間・野外飛行500時間・夜間飛行100時間・計器飛行75時間）', cond: '副操縦士・B737', en: { label: 'Minimum total time', value: '1,500 hours, including 250 PIC, 500 cross-country, 100 night and 75 instrument', cond: 'First Officer, B737' } },
  'northern-air-cargo.jobs.fo-type-rating-fo.36005737': { h: '62c5ee663f91cf97', label: '型式限定', value: 'B737 の型式限定が要る（ジェット機の経験があると望ましい）', cond: '副操縦士・B737', en: { label: 'Type rating', value: 'B737 type rating required (prior turbojet experience preferred)', cond: 'First Officer, B737' } },
  'northern-air-cargo.scale.fleet-total.2febf652': { h: '74390a3b32c87d3a', label: '運航している機材', value: '5機', cond: '2025年9月', en: { label: 'Aircraft in service', value: '5', cond: 'September 2025' } },
  'northern-air-cargo.work.days-off.70e9f0fd': { h: 'a2ed626a08778df1', label: '月の休日', value: '約13日', cond: '乗務が決まっている月', lead: true, en: { label: 'Days off per month', value: 'About 13', cond: 'Lineholders' } },
  'northern-air-cargo.work.roster-pattern.002eb54d': { h: '3377a25ed58a6e6e', label: '勤務の組み方', value: 'ときどき米本土での乗務があり、そのときは17日続けての出張（行き帰りは拠点からの便乗）', cond: 'B737・2024年', en: { label: 'Work pattern', value: 'Occasional Lower 48 lines of 17-day trips, deadheading to and from base', cond: 'B737, 2024' } },
  'northern-air-cargo.work.training-bond.697ac912': { h: '2dcc067a9f8a0c83', label: '機種の固定期間', value: '2年（その間はほかの機種へ移れない）', en: { label: 'Seat lock', value: '2 years before you can bid another aircraft type' } },
  'northern-air-cargo.work.upgrade-years.c3af265a': { h: '1a5dd2118509cbb4', off: '中身が具体でない（昇格が早いという宣伝だけ）' },
  'northern-air-cargo.work.working-time.460f0076': { h: '98d65a35d79a47f5', off: '同じ話が調べた条件のカードにある' },
  'solairus.benefits.staff-travel.1b1a01c6': { h: '00916d2a7c41d7c1', off: 'パイロットの条件ではない（地上職の業務の説明）' },
  'solairus.work.training-bond.fc5973e8': { h: '9eec7f6092f29a2a', off: 'パイロットの条件ではない（地上職の業務の説明）' },
  'solairus.work.upgrade-years.139a4431': { h: 'b4426995bbedb731', off: '口コミの意見で、決まりとして言えない' },
  'ups-airlines.benefits.commuting.706306f0': { h: 'b2d00754aeb4d085', label: '通勤の保護', rows: [['UPS の機か、買った航空券での通勤', '乗れずに遅れても処分されない（給与は保証されない）'], ['他社機のジャンプシートでの通勤', '保護されない']], cond: '2025年', en: { label: 'Commuter protection', rows: [['UPS aircraft or a purchased ticket', 'No discipline if you miss (no pay protection)'], ['Other airlines\' jumpseats', 'Not protected']], cond: '2025' } },
  'ups-airlines.fleet.airbus-a300-600.4818affc': { h: 'c16c358b0a8c273b', fleet: 'エアバス A300-600', en: { fleet: 'Airbus A300-600' } },
  'ups-airlines.fleet.boeing-747-400bcf.acbed920': { h: '10496c42a39048c1', fleet: 'ボーイング 747-400BCF', en: { fleet: 'Boeing 747-400BCF' } },
  'ups-airlines.fleet.boeing-767-300bcf.3472b66c': { h: '4a36642aadbfb957', fleet: 'ボーイング 767-300BCF', en: { fleet: 'Boeing 767-300BCF' } },
  'ups-airlines.fleet.boeing-767-300bdsf.15763676': { h: '5ca190344f39e32f', fleet: 'ボーイング 767-300BDSF', en: { fleet: 'Boeing 767-300BDSF' } },
  'ups-airlines.jobs.cap-license-cap.7f082de5': { h: '3ce3df0f9e4af7ac', off: '重複（同じ話を別の行が言っている）' },
  'ups-airlines.jobs.cap-posting-cap.046fef2e': { h: '1ecd3f9c59c04cd8', label: '募集', value: '管理職のパイロットを募集中（副チーフパイロット・査察操縦士・日々の運航の管理・訓練）', cond: '2026年11月', en: { label: 'Hiring', value: 'Management pilots (Assistant Chief Pilot, Check Airman, Daily Operations, Training)', cond: 'November 2026' } },
  'ups-airlines.jobs.cap-right-to-work-cap.b6754324': { h: '70e034c0ab0cf96a', off: '重複（同じ話を別の行が言っている）' },
  'ups-airlines.jobs.cap-total-hours-cap.4c73854d': { h: 'cd790cd93a1273f9', label: '応募に要る飛行時間', value: '4,000時間以上（うちジェット機か多発ターボプロップ機の機長時間1,000時間）', cond: '管理職のパイロット', en: { label: 'Minimum total time', value: '4,000 hours, including 1,000 PIC in jets or multi-engine turboprops', cond: 'Management pilots' } },
  'ups-airlines.jobs.cap-type-rating-cap.f6764df7': { h: '03da32f9e1992e53', label: '型式限定', value: '入社後に B747・B757/B767・A300 のどれかで取る（経験に応じて機長か副操縦士）', cond: '管理職のパイロット', en: { label: 'Type rating', value: 'Qualified after hire on the B747, B757/B767 or A300, as captain or first officer depending on experience', cond: 'Management pilots' } },
  'ups-airlines.jobs.fo-license-fo.8f709d48': { h: '7a5ddc2cbee48cc9', label: '応募に要る免許', value: 'ATP（制限なし・多発）と英語の技能の記載・第1種の身体検査・FCC の無線の許可', cond: '副操縦士・管理職のパイロット', en: { label: 'License required', value: 'Unrestricted multi-engine ATP with English proficiency endorsement, first-class medical and FCC restricted radiotelephone permit', cond: 'First Officers and management pilots' } },
  'ups-airlines.jobs.fo-posting-fo.7a562a52': { h: 'bd45e30c834ab4a6', label: '募集', value: '副操縦士を募集中', cond: '2026年11月', en: { label: 'Hiring', value: 'First Officers', cond: 'November 2026' } },
  'ups-airlines.jobs.fo-right-to-work-fo.2f175ff8': { h: '2f0ca7bc49a26464', label: '働く資格', value: '米国で働く資格と、出入国に制限のない旅券（ビザの支援なし）', cond: '副操縦士・管理職のパイロット', en: { label: 'Right to work', value: 'US work authorization and a passport allowing unrestricted entry and exit; no sponsorship', cond: 'First Officers and management pilots' } },
  'ups-airlines.jobs.fo-total-hours-fo.7f5a27e7': { h: '170c08d1d4dd8841', label: '応募に要る飛行時間', value: '1,500時間以上（固定翼）。うちジェット機か多発ターボプロップ機の機長時間1,000時間', cond: '副操縦士', en: { label: 'Minimum total time', value: '1,500 hours fixed-wing, including 1,000 PIC in jets or multi-engine turboprops', cond: 'First Officer' } },
  'ups-airlines.jobs.fo-type-rating-fo.64ac4cb3': { h: '61c55044172cf5bc', label: '型式限定', value: '入社後に会社の訓練で取る（B747・B757/B767・A300）', cond: '副操縦士', en: { label: 'Type rating', value: 'Earned in company training after hire (B747, B757/B767 or A300)', cond: 'First Officer' } },
  'ups-airlines.scale.fleet-total.a6ca181d': { h: '083495a547ab914b', label: '運航している機材', value: '274機', cond: '自社で運航・2026年6月', en: { label: 'Aircraft in service', value: '274', cond: 'Owned and operated, June 2026' } },
  'ups-airlines.work.training-bond.dabe0c87': { h: '7aa4c2bbc74aff8a', label: '機種の固定期間', value: '入社から18か月（同じ機種の中の拠点の移動は対象外）', cond: '新しく入ったパイロット・2026年', en: { label: 'Seat lock', value: '18 months from the first day of indoc (base transfers within the same aircraft type are not locked)', cond: 'New hires, 2026' } },
  'ups-airlines.work.upgrade-years.90adbee5': { h: '6dbb2a6bc7d6398b', label: '機長への昇格', value: '約6年', cond: '2025年', en: { label: 'Upgrade to captain', value: 'About 6 years', cond: '2025' } },
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
  /* ★2026-10-26 段階5 compare-all-15：新しく家賃の行が入った街の資料（同じ書き方。題が長い・題が数字の中身と食い違う資料は、どこの何の表かを書く） */
  'src-porter-pub-rent-city-ottawa': 'Zumper のオタワの家賃の表',
  'src-zumper-san-diego': 'Zumper のサンディエゴの家賃の表',
  'src-zumper-van-nuys': 'Zumper のヴァンナイズ（ロサンゼルス）の家賃の表',
  'src-hud-fy2027-fmr-county-level': '米国住宅都市開発省（HUD）「FY 2027 Fair Market Rents」（郡ごとの表）',
  'src-eurostat-isrp-market-rents-2025': 'ISRP/OECD・ユーロスタット「MARKET RENTS 2025」',
  'src-ssb-09895-bergen-2025': 'ノルウェー統計局（SSB）の賃貸市場調査の表 09895（2025年の平均の月額家賃）',
  'src-athome-souba-amakusa': 'アットホーム「天草市の家賃相場」',
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
  /* 米国の追補（2026-10-24）：旧形式の台帳の資料の名前が、発行元の書き足し・日本語の注・全角の括弧を含んでいた資料 */
  'src-delta-us1011-001': 'Delta Air Lines「First Officer — Ref #28088」（パイロットの採用ページ）',
  'src-delta-us1011-003': 'Delta Air Lines「Form 10-Q」（2026年9月）',
  'src-allegiant-us1011-001': 'Allegiant Travel Company「Form 10-K」（2025年12月期）',
  'src-frontier-us1011-013': 'Frontier Airlines の求人の一覧（airlineapps.com）',
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
  'src-korean-air-c26-training2026': 'Korean Air news (interview at the flight training center, 8 May 2026)',
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
  'src-porter-pub-rent-city-ottawa': 'Zumper Ottawa rent table',
  'src-zumper-san-diego': 'Zumper San Diego rent table',
  'src-zumper-van-nuys': 'Zumper Van Nuys (Los Angeles) rent table',
  'src-hud-fy2027-fmr-county-level': 'U.S. Department of Housing and Urban Development (HUD) “FY 2027 Fair Market Rents” (county-level data)',
  'src-eurostat-isrp-market-rents-2025': 'ISRP/OECD and Eurostat “MARKET RENTS 2025”',
  'src-ssb-09895-bergen-2025': 'Statistics Norway (SSB) rental market survey, table 09895 (average monthly rents, 2025)',
  'src-athome-souba-amakusa': '“Typical rent in Amakusa City” on athome.co.jp',
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
  'src-delta-us1011-001': 'Delta Air Lines “First Officer — Ref #28088” (pilot recruitment portal)',
  'src-delta-us1011-003': 'Delta Air Lines “Form 10-Q” (September 2026)',
  'src-allegiant-us1011-001': 'Allegiant Travel Company “Form 10-K” (fiscal year ended 31 December 2025)',
  'src-frontier-us1011-013': 'Frontier Airlines job listings (airlineapps.com)',
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
  /* ★2026-10-26 段階5 compare-all-15：日本の会社の拠点の街の家賃の資料（LIFULL HOME'S）の発行元。無いと英語のページの出典のリンクの字が空になっていた */
  'LIFULL': 'LIFULL',
  /* ★2026-10-29：富裕層の住む地区の家賃（CHINTAI の駅の相場）の発行元。無いと英語のページの家賃の箱が出ない（出典の字が空になる） */
  'CHINTAI': 'CHINTAI',
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
  skymark: { h: '4862cf7b58b503ef', basis: '2026年夏ダイヤ（6月1日〜10月24日）の時刻表で、スカイマークが自社便を飛ばしている空港。拠点の空港は入れていません。', basis_en: 'Airports Skymark serves with its own flights in the summer 2026 timetable (1 June – 24 October). Base airports are not included.' },
  /* ⚠️ いまの台帳の行は SYD の1つだけで、SYD はカンタスの拠点（本拠地は一覧に入れない）── 画面には就航地の一覧が出なかった（2026-10-21）。
     2026-10-29 に米国発着の国際線の行（BTS）が入り、拠点を外しても6空港が残るので一覧が出るようになった。 */
  /* 2026-10-29 WP-28：ChatGPT の1回目の調べ（2026-10-29）の就航地の行が入った ── 出どころが増えたので basis を書き直して h を付け直した */
  qantas: { h: 'b4a81551e34cb5c2', basis: '米国運輸省（BTS）の2026年7月の運航実績で、カンタス航空の定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports on international segments to and from the US flown by Qantas scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  /* 全社へ広げる d1（2026-10-21）：日本の会社。拠点の分かる会社だけ（拠点の空港を就航地として並べない ── 拠点の行が台帳に無い
     スプリング・ジャパン・北海道エアシステム・ジェイエア・日本トランスオーシャン航空・オリエンタルエアブリッジ・琉球エアーコミューター・
     新中央航空は、拠点が分かるまで一覧を出さない）。 */
  'zipair': { h: 'f251284f4ea688c9', basis: 'ZIPAIR の基本情報（運航路線）に、自社の定期便の行き先として載っている空港。拠点の空港は入れていません。', basis_en: 'Airports listed as scheduled destinations in ZIPAIR’s basic information (routes). Base airports are not included.' },
  'jetstar-japan': { h: 'b44f15f72cb27c79', basis: '2026年夏期の運航スケジュール（2026年1月27日の発表）に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in the summer 2026 schedule (announced 27 January 2026). Base airports are not included.' },
  /* 2026-10-29 WP-28：ChatGPT の1回目の調べ（2026-10-29）の就航地の行が入った ── 出どころが増えたので basis を書き直して h を付け直した */
  'peach': { h: 'd35e3cdb85b29fba', basis: 'Peach の路線・時刻表と、2026年冬ダイヤ（2026年10月25日〜2027年3月27日）の全路線の販売開始のお知らせに載っている空港（運休中と書かれた空港は入れていません）。拠点の空港は入れていません。', basis_en: 'Airports in Peach’s routes and timetables and in its announcement of winter 2026 sales for all routes (25 October 2026 – 27 March 2027); airports marked as suspended are not included. Base airports are not included.' },
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
  /* 2026-10-29 WP-28：ChatGPT の1回目の調べ（2026-10-29）の就航地の行が入った ── 出どころが増えたので basis を書き直して h を付け直した */
  'china-eastern': { h: '87d04dbb4ed3372c', basis: '中部国際空港の国際線の時刻表（2026年10月1日〜24日）に中国東方航空の便が載っている空港と、米国運輸省（BTS）の2026年7月の運航実績で中国東方航空の定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。拠点の街（上海）の空港は入れていません。', basis_en: 'Airports with China Eastern flights in Chubu Centrair’s international timetable (1–24 October 2026), and airports on international segments to and from the US flown by China Eastern scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Airports of the base city (Shanghai) are not included.' },
  /* 全社へ広げる d2（2026-10-22）：拠点の空港の行が在り、その会社の資料（路線・空港の案内）で拠点のほかに行き先が残る会社だけ。
     出さない会社：拠点の分からない会社（KLM・エールフランス・ルフトハンザ・アイスランド航空 など）／拠点の行が一部だけで、残る行き先に
     その会社の本当の基地が混ざりうる会社（フロンティア航空・ブエリング航空・アラスカ航空）／1便のニュースや1つの空港の案内だけの会社
     （ブリティッシュ・エアウェイズ・スカンジナビア航空・ヴァージン・アトランティック航空・ジェットスター航空）／行の使い方が「過去」で
     日付の無い行が多い会社（LOT ポーランド航空）。 */
  /* 2026-10-29 WP-28b：ChatGPT の追加の調べ1で、公式の運航スケジュール（Flightplan）の自社便の行が入った ── basis を書き直して h を付け直した */
  'austrian': { h: 'fc83f82a9434c516', basis: 'オーストリア航空の2026年夏ダイヤの発表に北米の長距離の行き先として載っている空港と、公式の運航スケジュール（2026年10月29日に確認）にオーストリア航空が自社で飛ばす便として載っている空港。拠点の空港は入れていません。', basis_en: 'Airports listed as North American long-haul destinations in Austrian Airlines’ 2026 summer schedule announcement, and airports served by flights Austrian Airlines operates itself in its official flight plan (checked 29 October 2026). Base airports are not included.' },
  /* 2026-10-29 WP-28：ChatGPT の1回目の調べ（2026-10-29）の就航地の行が入った ── 出どころが増えたので basis を書き直して h を付け直した */
  'southwest': { h: '890f7df34860a8b0', basis: 'サウスウエスト航空の空港の案内と、公式の路線図（2026年10月29日に確認）に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in Southwest Airlines’ airport information and official route map (checked 29 October 2026). Base airports are not included.' },
  /* 2026-10-29 WP-28：ChatGPT の1回目の調べ（2026-10-29）の就航地の行が入った ── 出どころが増えたので basis を書き直して h を付け直した */
  'jetblue': { h: 'ca64de5b43a9125f', basis: 'ジェットブルー航空の空港の案内に載っている空港と、米国運輸省（BTS）の2026年7月の運航実績（国内線・国際線）でジェットブルー航空の定期旅客便が飛んだ空港。拠点の空港は入れていません。', basis_en: 'Airports in JetBlue’s airport information, and airports served by JetBlue scheduled passenger flights in the US DOT (BTS) July 2026 traffic data (domestic and international). Base airports are not included.' },
  /* ★2026-10-29 オーナー「就航地を画面に出す会社を広げる」：調べの台帳に就航地の行が在る会社は全部出す（拠点の分からない会社・拠点の行が一部だけの会社も）。
     拠点の分からない会社は拠点の空港を外せない ＝ その会社の basis には「拠点の空港は入れていません」を書かない。
     basis は、画面に出る行の出どころの種類から作った（会社の公式の資料（親会社・グループを含む）／米国運輸省 BTS の運航実績／空港や航空当局の資料／
     ほかの航空会社の資料／そのほか）。空港の3字と名前の対応だけに使った資料（国総研の一覧・BTS の World Airport Codes）は数えない。 */
  aegean: { h: '85a186fb2121baaf', basis: 'エーゲ航空の公式の資料に載っている空港。', basis_en: 'Airports in official materials from Aegean Airlines.' },
  'aer-lingus': { h: 'f0a1abd1f8ef1737', basis: 'エア・リンガスの公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でエア・リンガスの定期旅客便が飛んだ米国発着の国際線の区間と、空港や航空当局の資料と、ほかの航空会社の資料に載っている空港。', basis_en: 'Airports in official materials from Aer Lingus, on international segments to and from the US flown by Aer Lingus scheduled passenger flights in the US DOT (BTS) July 2026 traffic data, in airport and aviation authority materials, and in other airlines’ materials.' },
  aeromexico: { h: 'a19cb9eeccf6e782', basis: 'アエロメヒコ航空の公式の資料に載っている空港。', basis_en: 'Airports in official materials from Aeromexico.' },
  'air-canada': { h: '44826c9c68c3e867', basis: '米国運輸省（BTS）の2026年7月の運航実績でエア・カナダの定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports on international segments to and from the US flown by Air Canada scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  'air-china': { h: '302533ce4660cbe0', basis: '中国国際航空の公式の資料と、米国運輸省（BTS）の2026年7月の運航実績で中国国際航空の定期旅客便が飛んだ米国発着の国際線の区間と、空港や航空当局の資料と、そのほかの資料に載っている空港。', basis_en: 'Airports in official materials from Air China, on international segments to and from the US flown by Air China scheduled passenger flights in the US DOT (BTS) July 2026 traffic data, in airport and aviation authority materials, and in other materials.' },
  'air-france': { h: 'bba22dad51ac98c9', basis: '米国運輸省（BTS）の2026年7月の運航実績でエールフランスの定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports on international segments to and from the US flown by Air France scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  'air-new-zealand': { h: 'bc185e621b741237', basis: 'ニュージーランド航空の公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でニュージーランド航空の定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Air New Zealand and on international segments to and from the US flown by Air New Zealand scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  airasia: { h: '84284d5042315b0b', basis: 'エアアジアの公式の資料に載っている空港。', basis_en: 'Airports in official materials from AirAsia Group.' },
  airjapan: { h: '9fbad92961912c62', basis: 'AirJapanの公式の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from AirJapan. Base airports are not included.' },
  'alaska-airlines': { h: '7ac36b046143a399', basis: 'アラスカ航空の公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でアラスカ航空の定期旅客便が飛んだ区間（国内線・国際線）に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Alaska Airlines and on domestic and international segments flown by Alaska Airlines scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  allegiant: { h: 'f8475153e70f3fac', basis: 'アレジアント航空の公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でアレジアント航空の定期旅客便が飛んだ区間（国内線・国際線）に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Allegiant Air and on domestic and international segments flown by Allegiant Air scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  american: { h: 'aee07f2980fcf23e', basis: '米国運輸省（BTS）の2026年7月の運航実績でアメリカン航空の定期旅客便が飛んだ区間（国内線・国際線）に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports on domestic and international segments flown by American Airlines scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  asiana: { h: '071acd80613f65f0', basis: 'アシアナ航空の公式の資料に載っている空港。', basis_en: 'Airports in official materials from Asiana Airlines.' },
  avianca: { h: '508288006c5be53f', basis: 'アビアンカ航空の公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でアビアンカ航空の定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。', basis_en: 'Airports in official materials from Avianca and on international segments to and from the US flown by Avianca scheduled passenger flights in the US DOT (BTS) July 2026 traffic data.' },
  'batik-air': { h: '98d43d29af5da9e5', basis: 'バティック・エアとそのグループの公式の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Batik Air and its group. Base airports are not included.' },
  'breeze-airways': { h: 'a1c48167293ab732', basis: '米国運輸省（BTS）の2026年7月の運航実績でブリーズ・エアウェイズの定期旅客便が飛んだ区間（国内線・国際線）と、空港や航空当局の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports on domestic and international segments flown by Breeze Airways scheduled passenger flights in the US DOT (BTS) July 2026 traffic data and in airport and aviation authority materials. Base airports are not included.' },
  'british-airways': { h: 'ac6b9a2ced7f4b64', basis: 'ブリティッシュ・エアウェイズの公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でブリティッシュ・エアウェイズの定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from British Airways and on international segments to and from the US flown by British Airways scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  'china-airlines': { h: 'adb37b017cb9f66d', basis: '米国運輸省（BTS）の2026年7月の運航実績でチャイナエアラインの定期旅客便が飛んだ米国発着の国際線の区間と、空港や航空当局の資料と、ほかの航空会社の資料に載っている空港。', basis_en: 'Airports on international segments to and from the US flown by China Airlines scheduled passenger flights in the US DOT (BTS) July 2026 traffic data, in airport and aviation authority materials, and in other airlines’ materials.' },
  'china-southern': { h: '13217ba9ed69ffb6', basis: '中国南方航空とそのグループの公式の資料と、米国運輸省（BTS）の2026年7月の運航実績で中国南方航空の定期旅客便が飛んだ米国発着の国際線の区間と、空港や航空当局の資料と、ほかの航空会社の資料に載っている空港。', basis_en: 'Airports in official materials from China Southern Airlines and its group, on international segments to and from the US flown by China Southern Airlines scheduled passenger flights in the US DOT (BTS) July 2026 traffic data, in airport and aviation authority materials, and in other airlines’ materials.' },
  'copa-airlines': { h: '27ff10d73b477289', basis: 'コパ航空の公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でコパ航空の定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Copa Airlines and on international segments to and from the US flown by Copa Airlines scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  delta: { h: 'eda90fc45878d70b', basis: 'デルタ航空の公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でデルタ航空の定期旅客便が飛んだ区間（国内線・国際線）に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Delta Air Lines and on domestic and international segments flown by Delta Air Lines scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  egyptair: { h: '86219f7028913c6d', basis: 'エジプト航空の公式の資料と、空港や航空当局の資料と、ほかの航空会社の資料に載っている空港。', basis_en: 'Airports in official materials from EgyptAir, in airport and aviation authority materials, and in other airlines’ materials.' },
  emirates: { h: 'b52d7d4041c767e0', basis: 'エミレーツの公式の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Emirates. Base airports are not included.' },
  'ethiopian-airlines': { h: 'd43ce9e289846b05', basis: 'エチオピア航空の公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でエチオピア航空の定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。', basis_en: 'Airports in official materials from Ethiopian Airlines and on international segments to and from the US flown by Ethiopian Airlines scheduled passenger flights in the US DOT (BTS) July 2026 traffic data.' },
  eurowings: { h: '4c02174c6c191832', basis: 'ユーロウイングスの公式の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Eurowings. Base airports are not included.' },
  'fiji-airways': { h: 'e356acca6f85369b', basis: '米国運輸省（BTS）の2026年7月の運航実績でフィジー・エアウェイズの定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports on international segments to and from the US flown by Fiji Airways scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  finnair: { h: 'e96c0c67fb25b08d', basis: 'フィンエアーの公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でフィンエアーの定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Finnair and on international segments to and from the US flown by Finnair scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  frontier: { h: '98a39a0872115642', basis: '米国運輸省（BTS）の2026年7月の運航実績でフロンティア航空の定期旅客便が飛んだ区間（国内線・国際線）と、空港や航空当局の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports on domestic and international segments flown by Frontier Airlines scheduled passenger flights in the US DOT (BTS) July 2026 traffic data and in airport and aviation authority materials. Base airports are not included.' },
  'garuda-indonesia': { h: 'e87897c4f899d39c', basis: '空港や航空当局の資料と、ほかの航空会社の資料に載っている空港。', basis_en: 'Airports in airport and aviation authority materials and in other airlines’ materials.' },
  'gulf-air': { h: '553603d9039d22a9', basis: 'ガルフ・エアの公式の資料と、空港や航空当局の資料に載っている空港。', basis_en: 'Airports in official materials from Gulf Air and in airport and aviation authority materials.' },
  hac: { h: 'ab7cb48e2ef6de54', basis: '北海道エアシステムの公式の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Hokkaido Air System. Base airports are not included.' },
  'hainan-airlines': { h: '2600f49221da28a1', basis: '海南航空とそのグループの公式の資料と、米国運輸省（BTS）の2026年7月の運航実績で海南航空の定期旅客便が飛んだ米国発着の国際線の区間と、空港や航空当局の資料と、そのほかの資料に載っている空港。', basis_en: 'Airports in official materials from Hainan Airlines and its group, on international segments to and from the US flown by Hainan Airlines scheduled passenger flights in the US DOT (BTS) July 2026 traffic data, in airport and aviation authority materials, and in other materials.' },
  'hong-kong-express': { h: '30b82669cc386d9d', basis: '香港エクスプレス航空の公式の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from HK Express. Base airports are not included.' },
  iberia: { h: 'f6b89a58eea400a7', basis: 'イベリア航空の公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でイベリア航空の定期旅客便が飛んだ米国発着の国際線の区間と、ほかの航空会社の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Iberia, on international segments to and from the US flown by Iberia scheduled passenger flights in the US DOT (BTS) July 2026 traffic data, and in other airlines’ materials. Base airports are not included.' },
  icelandair: { h: 'a1639587b8bbad5e', basis: 'アイスランド航空の公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でアイスランド航空の定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。', basis_en: 'Airports in official materials from Icelandair and on international segments to and from the US flown by Icelandair scheduled passenger flights in the US DOT (BTS) July 2026 traffic data.' },
  indigo: { h: '931f3ff8a44f3a42', basis: 'インディゴ航空の公式の資料と、空港や航空当局の資料と、ほかの航空会社の資料に載っている空港。', basis_en: 'Airports in official materials from IndiGo, in airport and aviation authority materials, and in other airlines’ materials.' },
  'ita-airways': { h: 'becb7f3a184c8df9', basis: 'ITAエアウェイズの公式の資料と、空港や航空当局の資料に載っている空港。', basis_en: 'Airports in official materials from ITA Airways and in airport and aviation authority materials.' },
  'j-air': { h: '7ea8d564b685c174', basis: 'ジェイエアの公式の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from J-Air. Base airports are not included.' },
  jetstar: { h: '60a4e3cec50c5109', basis: 'ジェットスター航空の公式の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Jetstar Airways. Base airports are not included.' },
  jta: { h: '62ab10cb0819da16', basis: 'に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports . Base airports are not included.' },
  'kenya-airways': { h: '7b221242a672bdf1', basis: 'ケニア航空の公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でケニア航空の定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Kenya Airways and on international segments to and from the US flown by Kenya Airways scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  klm: { h: 'bbfb76fa5f8492b6', basis: 'KLMオランダ航空の公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でKLMオランダ航空の定期旅客便が飛んだ米国発着の国際線の区間と、ほかの航空会社の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from KLM Royal Dutch Airlines, on international segments to and from the US flown by KLM Royal Dutch Airlines scheduled passenger flights in the US DOT (BTS) July 2026 traffic data, and in other airlines’ materials. Base airports are not included.' },
  'korean-air': { h: 'dc6c297ed8057e59', basis: '米国運輸省（BTS）の2026年7月の運航実績で大韓航空の定期旅客便が飛んだ米国発着の国際線の区間と、空港や航空当局の資料と、ほかの航空会社の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports on international segments to and from the US flown by Korean Air scheduled passenger flights in the US DOT (BTS) July 2026 traffic data, in airport and aviation authority materials, and in other airlines’ materials. Base airports are not included.' },
  'kuwait-airways': { h: 'cf0a6fd577793003', basis: 'クウェート航空の公式の資料と、空港や航空当局の資料と、ほかの航空会社の資料に載っている空港。', basis_en: 'Airports in official materials from Kuwait Airways, in airport and aviation authority materials, and in other airlines’ materials.' },
  latam: { h: '5cbb1c58e44deab4', basis: 'LATAM航空の公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でLATAM航空の定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from LATAM Airlines and on international segments to and from the US flown by LATAM Airlines scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  lot: { h: 'b7adb80d8ff4f390', basis: 'LOTポーランド航空の公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でLOTポーランド航空の定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from LOT Polish Airlines and on international segments to and from the US flown by LOT Polish Airlines scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  lufthansa: { h: 'bd5789d91eed999d', basis: 'ルフトハンザの公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でルフトハンザの定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。', basis_en: 'Airports in official materials from Lufthansa and on international segments to and from the US flown by Lufthansa scheduled passenger flights in the US DOT (BTS) July 2026 traffic data.' },
  'malaysia-airlines': { h: 'dc300012b17e1405', basis: 'マレーシア航空とそのグループの公式の資料と、ほかの航空会社の資料に載っている空港。', basis_en: 'Airports in official materials from Malaysia Airlines and its group and in other airlines’ materials.' },
  norwegian: { h: '00e526196dd3cf18', basis: 'ノルウェー・エアシャトルの公式の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Norwegian Air Shuttle. Base airports are not included.' },
  'oman-air': { h: 'c3d28405c9ce1c6c', basis: 'ほかの航空会社の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in other airlines’ materials. Base airports are not included.' },
  orc: { h: '76115b0b5b1dc338', basis: 'オリエンタルエアブリッジの公式の資料に載っている空港。', basis_en: 'Airports in official materials from Oriental Air Bridge.' },
  'philippine-airlines': { h: '17b5bce2940e233e', basis: '米国運輸省（BTS）の2026年7月の運航実績でフィリピン航空の定期旅客便が飛んだ米国発着の国際線の区間と、空港や航空当局の資料と、ほかの航空会社の資料に載っている空港。', basis_en: 'Airports on international segments to and from the US flown by Philippine Airlines scheduled passenger flights in the US DOT (BTS) July 2026 traffic data, in airport and aviation authority materials, and in other airlines’ materials.' },
  porter: { h: '2bccad635de3158d', basis: 'ポーター航空の公式の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Porter Airlines. Base airports are not included.' },
  'qatar-airways': { h: 'd9760184c413da1f', basis: 'カタール航空の公式の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Qatar Airways. Base airports are not included.' },
  rac: { h: 'b7f277c6d31af32b', basis: '琉球エアーコミューターの公式の資料に載っている空港。', basis_en: 'Airports in official materials from Ryukyu Air Commuter.' },
  'riyadh-air': { h: 'a928919671bf291b', basis: 'リヤド航空の公式の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Riyadh Air. Base airports are not included.' },
  'royal-brunei': { h: '3e0d0e341081a4cf', basis: 'ロイヤル・ブルネイ航空の公式の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Royal Brunei Airlines. Base airports are not included.' },
  'royal-jordanian': { h: '2bdac9b44663948e', basis: '米国運輸省（BTS）の2026年7月の運航実績でロイヤル・ヨルダン航空の定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports on international segments to and from the US flown by Royal Jordanian scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  ryanair: { h: '4c8a81f13d683121', basis: 'ライアンエアーの公式の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Ryanair. Base airports are not included.' },
  sas: { h: 'da5557e6b7c63983', basis: 'スカンジナビア航空の公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でスカンジナビア航空の定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from SAS Scandinavian Airlines and on international segments to and from the US flown by SAS Scandinavian Airlines scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  saudia: { h: '262a336f01e6b519', basis: '米国運輸省（BTS）の2026年7月の運航実績でサウジア航空の定期旅客便が飛んだ米国発着の国際線の区間と、ほかの航空会社の資料に載っている空港。', basis_en: 'Airports on international segments to and from the US flown by Saudia scheduled passenger flights in the US DOT (BTS) July 2026 traffic data and in other airlines’ materials.' },
  scoot: { h: '588d46e581d2579b', basis: 'スクートとそのグループの公式の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Scoot and its group. Base airports are not included.' },
  'shin-central': { h: '45fbe23964df6034', basis: '新中央航空の公式の資料に載っている空港。', basis_en: 'Airports in official materials from Shin Chuo Airlines.' },
  'singapore-airlines': { h: '69fcfb73829e6330', basis: 'シンガポール航空の公式の資料と、空港や航空当局の資料に載っている空港。', basis_en: 'Airports in official materials from Singapore Airlines and in airport and aviation authority materials.' },
  'south-african-airways': { h: '7891076358d185fd', basis: '南アフリカ航空の公式の資料に載っている空港。', basis_en: 'Airports in official materials from South African Airways.' },
  'spring-japan': { h: 'd5b392743dc845c5', basis: 'スプリング・ジャパンの公式の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Spring Japan. Base airports are not included.' },
  starlux: { h: '3b4ac6eab0cc44cc', basis: 'スターラックスの公式の資料に載っている空港。', basis_en: 'Airports in official materials from STARLUX Airlines.' },
  swiss: { h: '5ac0c1965d4877c9', basis: 'スイス インターナショナル エアラインズの公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でスイス インターナショナル エアラインズの定期旅客便が飛んだ米国発着の国際線の区間と、ほかの航空会社の資料に載っている空港。', basis_en: 'Airports in official materials from Swiss International Air Lines, on international segments to and from the US flown by Swiss International Air Lines scheduled passenger flights in the US DOT (BTS) July 2026 traffic data, and in other airlines’ materials.' },
  tap: { h: '53773f47e554ba43', basis: 'TAPポルトガル航空の公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でTAPポルトガル航空の定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from TAP Air Portugal and on international segments to and from the US flown by TAP Air Portugal scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  'thai-airways': { h: 'c82cf94a5d9c637a', basis: 'タイ国際航空の公式の資料と、空港や航空当局の資料と、ほかの航空会社の資料に載っている空港。', basis_en: 'Airports in official materials from Thai Airways International, in airport and aviation authority materials, and in other airlines’ materials.' },
  'turkish-airlines': { h: '48e09c76decd52ce', basis: 'ターキッシュ エアラインズの公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でターキッシュ エアラインズの定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。', basis_en: 'Airports in official materials from Turkish Airlines and on international segments to and from the US flown by Turkish Airlines scheduled passenger flights in the US DOT (BTS) July 2026 traffic data.' },
  united: { h: '41cf9f74090733d1', basis: 'ユナイテッド航空の公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でユナイテッド航空の定期旅客便が飛んだ区間（国内線・国際線）に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from United Airlines and on domestic and international segments flown by United Airlines scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  vietjet: { h: '4a383821b64a4107', basis: 'ベトジェット航空の公式の資料と、空港や航空当局の資料と、ほかの航空会社の資料に載っている空港。', basis_en: 'Airports in official materials from VietJet Air, in airport and aviation authority materials, and in other airlines’ materials.' },
  'vietnam-airlines': { h: '0c5b1d21c5950fc1', basis: 'ベトナム航空の公式の資料と、空港や航空当局の資料と、ほかの航空会社の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Vietnam Airlines, in airport and aviation authority materials, and in other airlines’ materials. Base airports are not included.' },
  'virgin-atlantic': { h: '78a5e4c06d8620c3', basis: 'ヴァージン・アトランティック航空の公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でヴァージン・アトランティック航空の定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Virgin Atlantic and on international segments to and from the US flown by Virgin Atlantic scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
  vueling: { h: 'eba21e0c68a345fc', basis: 'ブエリング航空の公式の資料と、空港や航空当局の資料に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from Vueling Airlines and in airport and aviation authority materials. Base airports are not included.' },
  westjet: { h: 'edee19e040e25b7a', basis: 'ウェストジェット航空の公式の資料と、米国運輸省（BTS）の2026年7月の運航実績でウェストジェット航空の定期旅客便が飛んだ米国発着の国際線の区間に載っている空港。拠点の空港は入れていません。', basis_en: 'Airports in official materials from WestJet Airlines and on international segments to and from the US flown by WestJet Airlines scheduled passenger flights in the US DOT (BTS) July 2026 traffic data. Base airports are not included.' },
});

/* ── 暮らしの街（CITY）── 調べの台帳の街（拠点の空港ごと）。先行5社の台帳に在る街（東京など）はここに書かない（そちらを使う）。
   rents … 家賃の行の ID（間取りの鍵ごと）。h … 家賃と移動の行ぜんぶの指紋（digest）。
   per   … 家賃の期間（資料の表が週あたり ＝ 'week'。台帳の per 欄には週が無いので、ここで言う）。
   measure … 何の額か（カードの見出しに入る短い字）。site … 資料の名前（短く）。
   scope … 数字の範囲の断り（出典の「条件」に出す1行。資料の区域・何の物件か・間取りの数え方）。
   also  … 同じ街のもう1つの空港（その空港が拠点の会社にも、この街を出す。★2026-10-26 段階5 compare-all-15・リードの答え：ダラスの DAL だけ）。
   url   … 出す家賃の資料の住所（★2026-10-29）。1つの街に2つの資料の行が在るとき、画面と比較に出すのはこの資料の行だけ（無ければ台帳の行の順の先頭の資料）。
           家賃は「拠点の近くで富裕層に人気の住宅地」の相場（オーナーの訂正）── 地区の資料を選び、ja/en は地区の名前。前の資料の行は台帳に残る。 */
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
    scope: '泉佐野市の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）',
    scope_en: 'Market rent in Izumisano (LIFULL HOME’S’s own figure from listed properties; excludes management fees and parking; not agreed rents)' },
  kitakyushu: { h: '762e7d1eec0505f9', ja: '北九州市小倉北区', en: 'Kokurakita, Kitakyushu', iata: 'KKJ', airport: '北九州空港', airport_en: 'Kitakyushu Airport',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month', measure_en: 'Market rent', site_en: 'LIFULL HOME’S',
    scope: '北九州市小倉北区の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）',
    scope_en: 'Market rent in Kokurakita ward, Kitakyushu (LIFULL HOME’S’s own figure from listed properties; excludes management fees and parking; not agreed rents)' },
  /* ★2026-10-29 オーナーの訂正「家賃は拠点の近くで富裕層に人気の住宅地」：CHINTAI の覚王山駅の相場に（前の LIFULL HOME'S の行は台帳に残る・出さない） */
  nagoya: { h: 'd8a8187e6b57b358', ja: '覚王山（名古屋市千種区）', en: 'Kakuozan, Chikusa, Nagoya', url: 'https://www.chintai.net/aichi/ensen/000007966/rent/', iata: 'NGO', airport: '中部国際空港', airport_en: 'Chubu Centrair International Airport',
    measure: '募集家賃の平均', site: 'CHINTAI', per: 'month', measure_en: 'Average asking rent', site_en: 'CHINTAI',
    scope: '覚王山駅（名古屋市千種区）から徒歩20分以内の、CHINTAI に掲載中の賃貸物件の平均の月額（2026年10月29日の表示）。管理費・駐車場代は含まない。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly rent of rentals listed on CHINTAI within a 20-minute walk of Kakuozan Station (Chikusa ward, Nagoya), as shown on 29 October 2026. Excludes management fees and parking. Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  /* ★2026-10-29 オーナーの訂正「家賃は拠点の近くで富裕層に人気の住宅地」：CHINTAI の大濠公園駅の相場に（前の LIFULL HOME'S の行は台帳に残る・出さない） */
  fukuoka: { h: 'eeb9155e35319f0f', ja: '大濠公園（福岡市中央区）', en: 'Ohori Park, Chuo, Fukuoka', url: 'https://www.chintai.net/fukuoka/ensen/000008861/rent/', iata: 'FUK', airport: '福岡空港', airport_en: 'Fukuoka Airport',
    measure: '募集家賃の平均', site: 'CHINTAI', per: 'month', measure_en: 'Average asking rent', site_en: 'CHINTAI',
    scope: '大濠公園駅（福岡市中央区）から徒歩20分以内の、CHINTAI に掲載中の賃貸物件の平均の月額（2026年10月29日の表示）。管理費・駐車場代は含まない。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly rent of rentals listed on CHINTAI within a 20-minute walk of Ohori-Koen Station (Chuo ward, Fukuoka), as shown on 29 October 2026. Excludes management fees and parking. Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  /* ★2026-10-29 オーナーの訂正「家賃は拠点の近くで富裕層に人気の住宅地」：CHINTAI の千里中央駅の相場に（前の LIFULL HOME'S の行は台帳に残る・出さない） */
  itami: { h: '38a2d76ddd9e5f0d', ja: '千里中央（豊中市）', en: 'Senri-Chuo, Toyonaka', url: 'https://www.chintai.net/osaka/ensen/000008180/rent/', iata: 'ITM', airport: '大阪国際空港（伊丹）', airport_en: 'Osaka International Airport (Itami)',
    measure: '募集家賃の平均', site: 'CHINTAI', per: 'month', measure_en: 'Average asking rent', site_en: 'CHINTAI',
    scope: '千里中央駅（大阪府豊中市）から徒歩20分以内の、CHINTAI に掲載中の賃貸物件の平均の月額（2026年10月29日の表示）。管理費・駐車場代は含まない。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly rent of rentals listed on CHINTAI within a 20-minute walk of Senri-Chuo Station (Toyonaka, Osaka), as shown on 29 October 2026. Excludes management fees and parking. Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  /* ★2026-10-29 オーナーの訂正「家賃は拠点の近くで富裕層に人気の住宅地」：CHINTAI のおもろまち駅の相場に（前の LIFULL HOME'S の行は台帳に残る・出さない） */
  naha: { h: '033ab6aafdb33dc3', ja: 'おもろまち（那覇市）', en: 'Omoromachi, Naha', url: 'https://www.chintai.net/okinawa/ensen/000010762/rent/', iata: 'OKA', airport: '那覇空港', airport_en: 'Naha Airport',
    measure: '募集家賃の平均', site: 'CHINTAI', per: 'month', measure_en: 'Average asking rent', site_en: 'CHINTAI',
    scope: 'おもろまち駅（那覇市）から徒歩20分以内の、CHINTAI に掲載中の賃貸物件の平均の月額（2026年10月21日の表示）。管理費・駐車場代は含まない。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly rent of rentals listed on CHINTAI within a 20-minute walk of Omoromachi Station (Naha), as shown on 21 October 2026. Excludes management fees and parking. Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  ishigaki: { h: '582a6c7fc9060fcc', ja: '石垣', en: 'Ishigaki', iata: 'ISG', airport: '石垣空港', airport_en: 'Ishigaki Airport' },
  sendai: { h: '99bde90fd1c6cb94', ja: '仙台市宮城野区', en: 'Miyagino, Sendai', iata: 'SDJ', airport: '仙台空港', airport_en: 'Sendai Airport',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month', measure_en: 'Market rent', site_en: 'LIFULL HOME’S',
    scope: '仙台市宮城野区の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）',
    scope_en: 'Market rent in Miyagino ward, Sendai (LIFULL HOME’S’s own figure from listed properties; excludes management fees and parking; not agreed rents)' },
  kirishima: { h: '779f18916758fbb7', ja: '霧島市', en: 'Kirishima', iata: 'KOJ', airport: '鹿児島空港', airport_en: 'Kagoshima Airport',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month', measure_en: 'Market rent', site_en: 'LIFULL HOME’S',
    scope: '霧島市の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）',
    scope_en: 'Market rent in Kirishima (LIFULL HOME’S’s own figure from listed properties; excludes management fees and parking; not agreed rents)' },
  kobe: { h: 'c881442b4d3c5595', ja: '神戸市中央区', en: 'Chuo, Kobe', iata: 'UKB', airport: '神戸空港', airport_en: 'Kobe Airport',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month', measure_en: 'Market rent', site_en: 'LIFULL HOME’S',
    scope: '神戸市中央区の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）',
    scope_en: 'Market rent in Chuo ward, Kobe (LIFULL HOME’S’s own figure from listed properties; excludes management fees and parking; not agreed rents)' },
  niigata: { h: 'f3e36e60e36624a8', ja: '新潟市中央区', en: 'Chuo, Niigata', iata: 'KIJ', airport: '新潟空港', airport_en: 'Niigata Airport',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month', measure_en: 'Market rent', site_en: 'LIFULL HOME’S',
    scope: '新潟市中央区の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）',
    scope_en: 'Market rent in Chuo ward, Niigata (LIFULL HOME’S’s own figure from listed properties; excludes management fees and parking; not agreed rents)' },
  /* ★2026-10-29 オーナーの訂正「家賃は拠点の近くで富裕層に人気の住宅地」：CHINTAI の円山公園駅の相場に（前の LIFULL HOME'S の行は台帳に残る・出さない） */
  sapporo: { h: '0b396135f79ba12a', ja: '円山公園（札幌市中央区）', en: 'Maruyama Park, Chuo, Sapporo', url: 'https://www.chintai.net/hokkaido/ensen/000006661/rent/', iata: 'OKD', airport: '札幌丘珠空港', airport_en: 'Sapporo Okadama Airport',
    measure: '募集家賃の平均', site: 'CHINTAI', per: 'month', measure_en: 'Average asking rent', site_en: 'CHINTAI',
    scope: '円山公園駅（札幌市中央区）から徒歩20分以内の、CHINTAI に掲載中の賃貸物件の平均の月額（2026年10月29日の表示）。管理費・駐車場代は含まない。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly rent of rentals listed on CHINTAI within a 20-minute walk of Maruyama-Koen Station (Chuo ward, Sapporo), as shown on 29 October 2026. Excludes management fees and parking. Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  /* ★2026-10-26 段階5 compare-all-15：家賃の行が入った（アットホームの天草市の家賃相場。相場が出ているのは 3DK だけ） */
  amakusa: { h: '6ec7a46a80ffc3da', ja: '天草', en: 'Amakusa', iata: 'AXJ', airport: '天草空港', airport_en: 'Amakusa Airport',
    measure: '家賃相場', site: 'アットホーム', per: 'month', measure_en: 'Market rent', site_en: 'athome.co.jp',
    scope: '天草市の家賃相場（アットホームが直近3か月に掲載した物件から出した額。平均か中央値かは書かれていない。成約した家賃ではない）。掲載物件が少なく、相場が出ているのは 3-Bed だけ',
    scope_en: 'Market rent in Amakusa City (athome.co.jp’s figure from properties listed in the last three months; whether it is an average or a median is not stated; not agreed rents). Few properties are listed, and only 3-Bed has a figure' },
  /* 全社へ広げる e（2026-10-22）：d2 の会社の拠点の街（台帳の家賃・移動の行が在る街だけ。1つの街に1つの空港・1つの資料）。
     空港は、その街に台帳の行で結ばれた会社の拠点の空港（台帳の拠点の行）。同じ街に拠点の空港が2つある会社では、家賃の行を持つ会社の拠点の空港
     （ダラス ＝ DFW：家賃の行はフロンティア航空の行。サウスウエスト航空の DAL には、この街の欄は出ない）。
     書かなかった街：オスロ（家賃の行の使い方が「募集」）・コペンハーゲン（家賃の行が物件1つの募集の例）・ティラナ（家賃の通貨 ALL の換算の
     レートがサイトに無い）。デュッセルドルフとサンフアンは、家賃の行が入った 2026-10-26 に下の compare-all-15 の節で書いた。 */
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
  paris: { h: '5991c253d125f9d6', ja: 'パリ', en: 'Paris', iata: 'CDG', airport: 'シャルル・ド・ゴール空港', airport_en: 'Paris Charles de Gaulle Airport',
    measure: '不動産会社の調べの平均家賃', site: 'ISRP/OECD・ユーロスタット', per: 'month', measure_en: 'Average rent from an estate-agency survey', site_en: 'ISRP/OECD and Eurostat',
    scope: 'パリの選ばれた住宅地区の、家具なしのアパート（質の良いもの。豪華な物件は除く）の平均の月額（国際機関の職員の生計費をくらべるための2025年の不動産会社の調べ。光熱費・管理費は含まない）。街ぜんたいの平均ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly rent of unfurnished flats (good quality; luxury excluded) in selected residential districts of Paris, from the 2025 estate-agency survey used to compare living costs for international civil servants (excludes utilities and service charges). Not a city-wide average. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  /* 2026-10-29 WP-28：同じ資料（Market Rents 2025）の 2-Bed・3-Bed の行が ITA エアウェイズの調べからも入った（額は今の行と同じ）── 字はそのまま正しい */
  rome: { h: 'd32846d52c4094ed', ja: 'ローマ', en: 'Rome', iata: 'FCO', airport: 'フィウミチーノ空港', airport_en: 'Rome Fiumicino Airport',
    measure: '不動産会社の調べの平均家賃', site: 'ISRP/OECD・ユーロスタット', per: 'month', measure_en: 'Average rent from an estate-agency survey', site_en: 'ISRP/OECD and Eurostat',
    scope: 'ローマの選ばれた住宅地区の、家具なしのアパート（質の良いもの。豪華な物件は除く）の平均の月額（国際機関の職員の生計費をくらべるための2025年の不動産会社の調べ。光熱費・管理費は含まない）。街ぜんたいの平均ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly rent of unfurnished flats (good quality; luxury excluded) in selected residential districts of Rome, from the 2025 estate-agency survey used to compare living costs for international civil servants (excludes utilities and service charges). Not a city-wide average. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  geneva: { h: '4d9cdb4da23d5a8c', ja: 'ジュネーブ', en: 'Geneva', iata: 'GVA', airport: 'ジュネーブ空港', airport_en: 'Geneva Airport',
    measure: '不動産会社の調べの平均家賃', site: 'ISRP/OECD・ユーロスタット', per: 'month', measure_en: 'Average rent from an estate-agency survey', site_en: 'ISRP/OECD and Eurostat',
    scope: 'ジュネーブの選ばれた住宅地区の、家具なしのアパート（質の良いもの。豪華な物件は除く）の平均の月額（国際機関の職員の生計費をくらべるための2025年の不動産会社の調べ。光熱費・管理費は含まない）。街ぜんたいの平均ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly rent of unfurnished flats (good quality; luxury excluded) in selected residential districts of Geneva, from the 2025 estate-agency survey used to compare living costs for international civil servants (excludes utilities and service charges). Not a city-wide average. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  barcelona: { h: '127c825b2f654520', ja: 'バルセロナ', en: 'Barcelona', iata: 'BCN', airport: 'バルセロナ・エル・プラット空港', airport_en: 'Barcelona–El Prat Airport',
    measure: '家具つきの募集家賃の中央値', site: 'HousingAnywhere', per: 'month', measure_en: 'Median asking rent (furnished)', site_en: 'HousingAnywhere',
    scope: 'バルセロナで HousingAnywhere（中期の賃貸の掲載サイト）に載った、家具つきのStudioの募集家賃の中央値（2026年第3四半期の家賃の指数）。学生などの中期の賃貸が中心で、成約した家賃ではない',
    scope_en: 'Median asking rent of furnished studios listed on HousingAnywhere (a mid-term rental platform) in Barcelona (Q3 2026 rent index). Mostly mid-term lets (for example, students); not agreed rents' },
  milan: { h: 'f7bab90bf7fb1ff2', ja: 'ミラノ', en: 'Milan', iata: 'MXP', airport: 'ミラノ・マルペンサ空港', airport_en: 'Milan Malpensa Airport',
    measure: '家具つきの募集家賃の中央値', site: 'HousingAnywhere', per: 'month', measure_en: 'Median asking rent (furnished)', site_en: 'HousingAnywhere',
    scope: 'ミラノで HousingAnywhere（中期の賃貸の掲載サイト）に載った、家具つきのStudioの募集家賃の中央値（2026年第3四半期の家賃の指数）。学生などの中期の賃貸が中心で、成約した家賃ではない',
    scope_en: 'Median asking rent of furnished studios listed on HousingAnywhere (a mid-term rental platform) in Milan (Q3 2026 rent index). Mostly mid-term lets (for example, students); not agreed rents' },
  hamburg: { h: 'c1a23e717b2170d7', ja: 'ハンブルク', en: 'Hamburg', iata: 'HAM', airport: 'ハンブルク空港', airport_en: 'Hamburg Airport',
    measure: '平均家賃（生活費の案内）', site: 'HousingAnywhere', per: 'month', measure_en: 'Average rent (cost-of-living guide)', site_en: 'HousingAnywhere',
    scope: 'HousingAnywhere の生活費の案内（2026年）に載った、ハンブルクのStudioの平均の月額。集計の期間・件数は書かれていない。成約した家賃ではない',
    scope_en: 'Average monthly rent of a Studio in Hamburg from HousingAnywhere’s cost-of-living guide (2026). The period and number of listings are not stated; not agreed rents' },
  lisboa: { h: 'bad47c11babcf6f4', ja: 'リスボン', en: 'Lisbon', iata: 'LIS', airport: 'リスボン空港', airport_en: 'Lisbon Airport',
    measure: '長期賃貸の募集家賃の中央値', site: 'idealista', per: 'month', measure_en: 'Median asking rent (long-term lets)', site_en: 'idealista',
    scope: 'リスボン市で idealista（不動産の掲載サイト）に載った、寝室1つ（T1）の長期賃貸の募集家賃の中央値。成約した家賃ではない。1-Bed は寝室の数',
    scope_en: 'Median asking rent of one-bedroom (T1) long-term lets listed on idealista (a property portal) in the city of Lisbon. Not agreed rents. 1-Bed is the number of bedrooms' },
  porto: { h: '43f564a61eb9db63', ja: 'ポルト', en: 'Porto', iata: 'OPO', airport: 'ポルト空港', airport_en: 'Porto Airport',
    measure: '長期賃貸の募集家賃の中央値', site: 'idealista', per: 'month', measure_en: 'Median asking rent (long-term lets)', site_en: 'idealista',
    scope: 'ポルト市で idealista（不動産の掲載サイト）に載った、寝室1つ（T1）の長期賃貸の募集家賃の中央値。成約した家賃ではない。1-Bed は寝室の数',
    scope_en: 'Median asking rent of one-bedroom (T1) long-term lets listed on idealista (a property portal) in the city of Porto. Not agreed rents. 1-Bed is the number of bedrooms' },
  /* ★2026-10-26 段階5 compare-all-15：ケルン・ストックホルム・ベルゲンに家賃の行が入った（1つの街に1つの資料） */
  cologne: { h: '2feb5146c013ae89', ja: 'ケルン', en: 'Cologne', iata: 'CGN', airport: 'ケルン・ボン空港', airport_en: 'Cologne Bonn Airport',
    measure: '平均家賃（生活費の案内）', site: 'HousingAnywhere', per: 'month', measure_en: 'Average rent (cost-of-living guide)', site_en: 'HousingAnywhere',
    scope: 'HousingAnywhere（中期の賃貸の掲載サイト）の生活費の案内（2026年10月6日更新）に載った、ケルンのStudioと寝室1つ（1-Bed）の平均の月額。家具つきが中心の中期の賃貸で、集計の期間・件数は書かれていない。成約した家賃ではない',
    scope_en: 'Average monthly rent of a Studio and a one-bedroom flat (1-Bed) in Cologne from the cost-of-living guide of HousingAnywhere (a mid-term rental platform; updated 6 October 2026). Mostly furnished mid-term lets; the period and number of listings are not stated; not agreed rents' },
  stockholm: { h: '672453b1c0aa1dff', ja: 'ストックホルム', en: 'Stockholm', iata: 'ARN', airport: 'ストックホルム・アーランダ空港', airport_en: 'Stockholm Arlanda Airport',
    measure: '不動産会社の調べの平均家賃', site: 'ISRP/OECD・ユーロスタット', per: 'month', measure_en: 'Average rent from an estate-agency survey', site_en: 'ISRP/OECD and Eurostat',
    scope: 'ストックホルムの選ばれた住宅地区の、家具なしのアパート（質の良いもの。豪華な物件は除く）の平均の月額（国際機関の職員の生計費をくらべるための2025年の不動産会社の調べ。光熱費・管理費は含まない）。街ぜんたいの平均ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly rent of unfurnished flats (good quality; luxury excluded) in selected residential districts of Stockholm, from the 2025 estate-agency survey used to compare living costs for international civil servants (excludes utilities and service charges). Not a city-wide average. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  bergen: { h: 'da98a4e89fe1c20c', ja: 'ベルゲン', en: 'Bergen', iata: 'BGO', airport: 'ベルゲン空港', airport_en: 'Bergen Airport',
    measure: '賃貸住宅の平均家賃', site: 'ノルウェー統計局（SSB）', per: 'month', measure_en: 'Average rent of rented dwellings', site_en: 'Statistics Norway (SSB)',
    scope: 'ノルウェー統計局の賃貸市場調査（2025年）による、ベルゲン市の部屋が1つの住戸（Studio）の平均の月額。調べた住戸の家賃で、募集の額ではない。部屋が2つ・3つの住戸は寝室の数が分からないので出していない',
    scope_en: 'Average monthly rent of one-room dwellings (Studio) in the municipality of Bergen, from Statistics Norway’s rental market survey (2025). Rents of surveyed dwellings, not asking rents. Two- and three-room dwellings are not shown because the number of bedrooms is not known' },
  atlanta: { h: '49b7de1ccf1d3c18', ja: 'アトランタ', en: 'Atlanta', iata: 'ATL', airport: 'アトランタ空港', airport_en: 'Atlanta airport',
    measure: '集合住宅の平均家賃', site: 'RentCafe（Yardi Matrix）', per: 'month', measure_en: 'Average apartment rent', site_en: 'RentCafe (Yardi Matrix)',
    scope: 'アトランタの50戸以上の集合住宅の、間取りごとの平均の家賃（RentCafe・Yardi Matrix の表。2026年9月30日の表示）。小さな物件を含む住宅ぜんたいの値ではない・成約した家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type in apartment buildings of 50 or more units in Atlanta (RentCafe / Yardi Matrix table, as shown on 30 September 2026). Not a figure for all housing including small buildings; not agreed rents. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  austin: { h: 'd95000eef201b307', ja: 'オースティン', en: 'Austin', iata: 'AUS', airport: 'オースティン空港', airport_en: 'Austin airport',
    measure: '集合住宅の平均家賃', site: 'RentCafe（Yardi Matrix）', per: 'month', measure_en: 'Average apartment rent', site_en: 'RentCafe (Yardi Matrix)',
    scope: 'オースティンの50戸以上の集合住宅の、間取りごとの平均の家賃（RentCafe・Yardi Matrix の表。2026年9月30日の表示）。小さな物件を含む住宅ぜんたいの値ではない・成約した家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type in apartment buildings of 50 or more units in Austin (RentCafe / Yardi Matrix table, as shown on 30 September 2026). Not a figure for all housing including small buildings; not agreed rents. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  /* ★2026-10-26 段階5 compare-all-15：サウスウエスト航空の拠点はダラスの DAL（ラブフィールド）── 同じ街なので also に書く */
  dallas: { h: 'd2e23efaecb44d49', ja: 'ダラス', en: 'Dallas', iata: 'DFW', also: ['DAL'], airport: 'ダラス・フォートワース空港', airport_en: 'Dallas Fort Worth International Airport',
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
  /* ★2026-10-29：ヨークビル地区（Zumper）の行が入ったが、掲載が7件だけ（10件未満は使わない）── 今までどおり街全体の表を出す（url で選ぶ） */
  toronto: { h: '30b819143bc61e2e', ja: 'トロント', en: 'Toronto', url: 'https://www.zumper.com/rent-research/toronto-on', iata: 'YYZ', airport: 'トロント・ピアソン国際空港', airport_en: 'Toronto Pearson International Airport',
    measure: '募集家賃の平均', site: 'Zumper', per: 'month', measure_en: 'Average asking rent', site_en: 'Zumper',
    scope: 'トロントで Zumper（賃貸の掲載サイト）に過去30日に載った物件の、間取りごとの平均の家賃（2026年10月19日の表示）。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type of listings on Zumper (a rental listings site) in the past 30 days in Toronto (as shown on 19 October 2026). Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  perth: { h: 'f6c81efc05cb91a6', ja: 'パース', en: 'Perth', iata: 'PER', airport: 'パース空港', airport_en: 'Perth Airport',
    measure: 'ユニットの家賃の中央値', site: '西オーストラリア州不動産協会（REIWA）', per: 'week', measure_en: 'Median unit rent', site_en: 'Real Estate Institute of Western Australia (REIWA)',
    scope: 'パース都市圏（Perth Metro）のユニット（集合住宅）の、寝室の数ごとの週の家賃の中央値（3か月の移動の集計）。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Median weekly rent of units (apartments) in Perth Metro by number of bedrooms (rolling three-month figures). 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  /* ★2026-10-26 段階5 compare-all-15（P12.123）：拠点の街なのに家賃の行が無かった街の調べ（2つのパック・1つの街に1つの資料）と、家賃の行は
     前から在ったのにこの表に行が無かった街（オタワ・ブリストル・リヨン）。空港は、その街に台帳の行で結ばれた会社の拠点の空港。
     書かなかった街（行が在っても、この表に字を書かない ＝ 会社ページにも比較にも出ない）：
       ニース・ボルドー・ナント（使い方が「参考」── 資料に日付が無い。暮らしの板も比較の箱も「参考」の札を出さない）・
       オスロ（家賃の行の使い方が「募集」）・コペンハーゲン（家賃の行が物件1つの募集の例で、部屋の数は寝室の数ではない）・
       ティラナ（家賃の通貨 ALL の換算のレートがサイトに無い）。
     ブリスベン・シドニー・パースは週あたりの額のまま（1か月あたりに直さない）── 比較の家賃の箱には出ない。 */
  crawley: { h: 'bff8101e99de69da', ja: 'クローリー', en: 'Crawley', iata: 'LGW', airport: 'ロンドン・ガトウィック空港', airport_en: 'London Gatwick Airport',
    measure: '民間賃貸の平均家賃', site: '英国統計局（ONS）', per: 'month', measure_en: 'Average private rent', site_en: 'Office for National Statistics (ONS)',
    scope: 'クローリー（Crawley）の行政区域の民間賃貸の平均の月額（英国統計局の Price Index of Private Rents）。ガトウィック空港が在る行政区で、ロンドンの値ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly private rent in the Crawley local authority area, where Gatwick Airport is (ONS Price Index of Private Rents). Not a London figure. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  belfast: { h: '4083e4ff6b53d9fa', ja: 'ベルファスト', en: 'Belfast', iata: 'BFS', airport: 'ベルファスト国際空港', airport_en: 'Belfast International Airport',
    measure: '民間賃貸の平均家賃', site: '英国統計局（ONS）', per: 'month', measure_en: 'Average private rent', site_en: 'Office for National Statistics (ONS)',
    scope: 'ベルファストの賃貸地域（Belfast rental area）の民間賃貸の平均の月額（英国統計局の Price Index of Private Rents。北アイルランドの値は2026年7月が最新）。空港は市の外に在る。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly private rent in the Belfast rental area (ONS Price Index of Private Rents; July 2026 is the latest figure for Northern Ireland). The airport is outside the city. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  birmingham: { h: 'e97ae123cdea793c', ja: 'バーミンガム', en: 'Birmingham', iata: 'BHX', airport: 'バーミンガム空港', airport_en: 'Birmingham Airport',
    measure: '民間賃貸の平均家賃', site: '英国統計局（ONS）', per: 'month', measure_en: 'Average private rent', site_en: 'Office for National Statistics (ONS)',
    scope: 'バーミンガム（Birmingham）の行政区域の民間賃貸の平均の月額（英国統計局の Price Index of Private Rents）。空港は隣のソリハル（Solihull）に在る。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly private rent in the Birmingham local authority area (ONS Price Index of Private Rents). The airport is in neighboring Solihull. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  edinburgh: { h: '3ae2d06127356656', ja: 'エディンバラ', en: 'Edinburgh', iata: 'EDI', airport: 'エディンバラ空港', airport_en: 'Edinburgh Airport',
    measure: '民間賃貸の平均家賃', site: '英国統計局（ONS）', per: 'month', measure_en: 'Average private rent', site_en: 'Office for National Statistics (ONS)',
    scope: 'エディンバラのページに載った、ロージアン（Lothian。スコットランドの賃貸の地域区分）の民間賃貸の平均の月額（英国統計局の Price Index of Private Rents）。エディンバラ市だけの値ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly private rent in Lothian (a Scottish rental area), as given on the Edinburgh page of the ONS Price Index of Private Rents. Not a figure for the City of Edinburgh alone. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  glasgow: { h: '1dab281338fb3a87', ja: 'グラスゴー', en: 'Glasgow', iata: 'GLA', airport: 'グラスゴー空港', airport_en: 'Glasgow Airport',
    measure: '民間賃貸の平均家賃', site: '英国統計局（ONS）', per: 'month', measure_en: 'Average private rent', site_en: 'Office for National Statistics (ONS)',
    scope: 'グラスゴーのページに載った、グレーター・グラスゴー（Greater Glasgow。スコットランドの賃貸の地域区分）の民間賃貸の平均の月額（英国統計局の Price Index of Private Rents）。グラスゴー市だけの値ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly private rent in Greater Glasgow (a Scottish rental area), as given on the Glasgow page of the ONS Price Index of Private Rents. Not a figure for the City of Glasgow alone. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  liverpool: { h: 'a8f683bbf7cad14f', ja: 'リバプール', en: 'Liverpool', iata: 'LPL', airport: 'リバプール・ジョン・レノン空港', airport_en: 'Liverpool John Lennon Airport',
    measure: '民間賃貸の平均家賃', site: '英国統計局（ONS）', per: 'month', measure_en: 'Average private rent', site_en: 'Office for National Statistics (ONS)',
    scope: 'リバプール（Liverpool）の行政区域の民間賃貸の平均の月額（英国統計局の Price Index of Private Rents）。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly private rent in the Liverpool local authority area (ONS Price Index of Private Rents). 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  'newcastle-upon-tyne': { h: '9a26307464e062e9', ja: 'ニューカッスル', en: 'Newcastle upon Tyne', iata: 'NCL', airport: 'ニューカッスル国際空港', airport_en: 'Newcastle International Airport',
    measure: '民間賃貸の平均家賃', site: '英国統計局（ONS）', per: 'month', measure_en: 'Average private rent', site_en: 'Office for National Statistics (ONS)',
    scope: 'ニューカッスル・アポン・タイン（Newcastle upon Tyne）の行政区域の民間賃貸の平均の月額（英国統計局の Price Index of Private Rents）。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly private rent in the Newcastle upon Tyne local authority area (ONS Price Index of Private Rents). 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  'southend-on-sea': { h: 'f2a3be89bf61b46a', ja: 'サウスエンド・オン・シー', en: 'Southend-on-Sea', iata: 'SEN', airport: 'ロンドン・サウスエンド空港', airport_en: 'London Southend Airport',
    measure: '民間賃貸の平均家賃', site: '英国統計局（ONS）', per: 'month', measure_en: 'Average private rent', site_en: 'Office for National Statistics (ONS)',
    scope: 'サウスエンド・オン・シー（Southend-on-Sea）の行政区域の民間賃貸の平均の月額（英国統計局の Price Index of Private Rents）。ロンドンの値ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly private rent in the Southend-on-Sea local authority area (ONS Price Index of Private Rents). Not a London figure. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  bristol: { h: '4542dacd4f9cf51f', ja: 'ブリストル', en: 'Bristol', iata: 'BRS', airport: 'ブリストル空港', airport_en: 'Bristol Airport',
    measure: '民間賃貸の平均家賃', site: '英国統計局（ONS）', per: 'month', measure_en: 'Average private rent', site_en: 'Office for National Statistics (ONS)',
    scope: 'ブリストル（Bristol）の行政区域の民間賃貸の平均の月額（英国統計局の Price Index of Private Rents）。空港のまわりの地区の値ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly private rent in the Bristol local authority area (ONS Price Index of Private Rents). Not a figure for the area around the airport. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  lyon: { h: '889cebc555483d55', ja: 'リヨン', en: 'Lyon', iata: 'LYS', airport: 'リヨン・サンテグジュペリ空港', airport_en: 'Lyon–Saint Exupéry Airport',
    measure: '不動産会社の調べの平均家賃', site: 'ISRP/OECD・ユーロスタット', per: 'month', measure_en: 'Average rent from an estate-agency survey', site_en: 'ISRP/OECD and Eurostat',
    scope: 'リヨンの選ばれた住宅地区の、家具なしのアパート（質の良いもの。豪華な物件は除く）の平均の月額（国際機関の職員の生計費をくらべるための2025年の不動産会社の調べ。光熱費・管理費は含まない）。街ぜんたいの平均ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average monthly rent of unfurnished flats (good quality; luxury excluded) in selected residential districts of Lyon, from the 2025 estate-agency survey used to compare living costs for international civil servants (excludes utilities and service charges). Not a city-wide average. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  dusseldorf: { h: '2549f711c3291fab', ja: 'デュッセルドルフ', en: 'Düsseldorf', iata: 'DUS', airport: 'デュッセルドルフ空港', airport_en: 'Düsseldorf Airport',
    measure: '平均家賃（生活費の案内）', site: 'HousingAnywhere', per: 'month', measure_en: 'Average rent (cost-of-living guide)', site_en: 'HousingAnywhere',
    scope: 'HousingAnywhere（中期の賃貸の掲載サイト）の生活費の案内（2026年10月6日更新）に載った、デュッセルドルフのStudioの平均の月額。家具つきが中心の中期の賃貸で、集計の期間・件数は書かれていない。成約した家賃ではない',
    scope_en: 'Average monthly rent of a Studio in Düsseldorf from the cost-of-living guide of HousingAnywhere (a mid-term rental platform; updated 6 October 2026). Mostly furnished mid-term lets; the period and number of listings are not stated; not agreed rents' },
  stuttgart: { h: '83d85b0183e6b243', ja: 'シュトゥットガルト', en: 'Stuttgart', iata: 'STR', airport: 'シュトゥットガルト空港', airport_en: 'Stuttgart Airport',
    measure: '平均家賃（生活費の案内）', site: 'HousingAnywhere', per: 'month', measure_en: 'Average rent (cost-of-living guide)', site_en: 'HousingAnywhere',
    scope: 'HousingAnywhere（中期の賃貸の掲載サイト）の生活費の案内（2026年10月6日更新）に載った、シュトゥットガルトのStudioと家具つきの寝室1つ（1-Bed）の平均の月額（光熱費込みと書かれている）。集計の期間・件数は書かれていない。成約した家賃ではない',
    scope_en: 'Average monthly rent of a Studio and a furnished one-bedroom flat (1-Bed) in Stuttgart from the cost-of-living guide of HousingAnywhere (a mid-term rental platform; updated 6 October 2026), stated as including utilities. The period and number of listings are not stated; not agreed rents' },
  amsterdam: { h: '08b2e63ad85faede', ja: 'アムステルダム', en: 'Amsterdam', iata: 'AMS', airport: 'アムステルダム・スキポール空港', airport_en: 'Amsterdam Airport Schiphol',
    measure: '平均家賃（生活費の案内）', site: 'HousingAnywhere', per: 'month', measure_en: 'Average rent (cost-of-living guide)', site_en: 'HousingAnywhere',
    scope: 'HousingAnywhere（中期の賃貸の掲載サイト）の生活費の案内（2026年10月6日更新）に載った、アムステルダムのStudioの平均の月額。家具つきが中心の中期の賃貸で、集計の期間・件数は書かれていない。成約した家賃ではない',
    scope_en: 'Average monthly rent of a Studio in Amsterdam from the cost-of-living guide of HousingAnywhere (a mid-term rental platform; updated 6 October 2026). Mostly furnished mid-term lets; the period and number of listings are not stated; not agreed rents' },
  malaga: { h: '8a0cb667cb51ad7f', ja: 'マラガ', en: 'Málaga', iata: 'AGP', airport: 'マラガ・コスタ・デル・ソル空港', airport_en: 'Málaga–Costa del Sol Airport',
    measure: '家賃の目安（生活費の案内）', site: 'HousingAnywhere', per: 'month', measure_en: 'Typical rent (cost-of-living guide)', site_en: 'HousingAnywhere',
    scope: 'HousingAnywhere（中期の賃貸の掲載サイト）の生活費の案内（2026年10月6日更新）に載った、マラガのStudioの2026年の家賃の目安の月額（平均か中央値かは書かれていない）。家具つきが中心の中期の賃貸。成約した家賃ではない',
    scope_en: 'Typical monthly rent of a Studio in Málaga in 2026 from the cost-of-living guide of HousingAnywhere (a mid-term rental platform; updated 6 October 2026; whether it is an average or a median is not stated). Mostly furnished mid-term lets; not agreed rents' },
  'san-diego': { h: '1e6a60a29ad8ff84', ja: 'サンディエゴ', en: 'San Diego', iata: 'SAN', airport: 'サンディエゴ国際空港', airport_en: 'San Diego International Airport',
    measure: '募集家賃の平均', site: 'Zumper', per: 'month', measure_en: 'Average asking rent', site_en: 'Zumper',
    scope: 'サンディエゴで Zumper（賃貸の掲載サイト）に過去30日に載った物件の、間取りごとの平均の家賃（2026年10月25日の表示）。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type of listings on Zumper (a rental listings site) in the past 30 days in San Diego (as shown on 25 October 2026). Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  'van-nuys': { h: '78ed09f824f662f3', ja: 'ロサンゼルス・ヴァンナイズ', en: 'Van Nuys, Los Angeles', iata: 'VNY', airport: 'ヴァンナイズ空港', airport_en: 'Van Nuys Airport',
    measure: '募集家賃の平均', site: 'Zumper', per: 'month', measure_en: 'Average asking rent', site_en: 'Zumper',
    scope: 'ロサンゼルス市の中の地区ヴァンナイズ（Van Nuys）で Zumper（賃貸の掲載サイト）に過去30日に載った物件の、間取りごとの平均の家賃（2026年10月25日の表示）。ロサンゼルス市ぜんたいの値ではない。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type of listings on Zumper (a rental listings site) in the past 30 days in Van Nuys, a district of the City of Los Angeles (as shown on 25 October 2026). Not a figure for all of Los Angeles; not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  ottawa: { h: '7a316c61ad203b9a', ja: 'オタワ', en: 'Ottawa', iata: 'YOW', airport: 'オタワ国際空港', airport_en: 'Ottawa International Airport',
    measure: '募集家賃の平均', site: 'Zumper', per: 'month', measure_en: 'Average asking rent', site_en: 'Zumper',
    scope: 'オタワで Zumper（賃貸の掲載サイト）に過去30日に載った物件の、間取りごとの平均の家賃（2026年10月19日の表示）。成約した家賃・住んでいる人の家賃ではない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'Average rent by unit type of listings on Zumper (a rental listings site) in the past 30 days in Ottawa (as shown on 19 October 2026). Not agreed rents or what residents pay. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  guam: { h: 'd3785ab90af6e6fa', ja: 'グアム', en: 'Guam', iata: 'GUM', airport: 'グアム国際空港', airport_en: 'Guam International Airport',
    measure: '公正市場家賃（FMR）', site: '米国住宅都市開発省（HUD）', per: 'month', measure_en: 'Fair Market Rent (FMR)', site_en: 'U.S. Department of Housing and Urban Development (HUD)',
    scope: 'グアムぜんたいの、米国住宅都市開発省の2027会計年度の公正市場家賃（Fair Market Rent）。標準的な質の賃貸住宅の、家賃に光熱費を足した額（gross rent）の40パーセンタイルの推計で、平均でも中央値でもない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'HUD Fair Market Rent for fiscal year 2027 for all of Guam: an estimate of the 40th percentile of gross rent (rent plus utilities) for standard-quality rental housing, not an average or a median. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
  'san-juan': { h: 'd48edebca9c72c7a', ja: 'サンフアン', en: 'San Juan', iata: 'SJU', airport: 'ルイス・ムニョス・マリン国際空港', airport_en: 'Luis Muñoz Marín International Airport',
    measure: '公正市場家賃（FMR）', site: '米国住宅都市開発省（HUD）', per: 'month', measure_en: 'Fair Market Rent (FMR)', site_en: 'U.S. Department of Housing and Urban Development (HUD)',
    scope: 'サンフアン（San Juan Municipio）の、米国住宅都市開発省の2027会計年度の公正市場家賃（Fair Market Rent。サンフアン・グアイナボの地域ぜんたいで同じ額）。標準的な質の賃貸住宅の、家賃に光熱費を足した額（gross rent）の40パーセンタイルの推計で、平均でも中央値でもない。1-Bed・2-Bed・3-Bed は寝室の数',
    scope_en: 'HUD Fair Market Rent for fiscal year 2027 for San Juan Municipio (the same amount across the San Juan–Guaynabo area): an estimate of the 40th percentile of gross rent (rent plus utilities) for standard-quality rental housing, not an average or a median. 1-Bed, 2-Bed and 3-Bed are the number of bedrooms' },
});

/* 画面に出す使い方（airline-rollout.mjs の SHOWN と同じ4つ。あちらがこのファイルを読むので、ここでは写しを持つ）と、
   check() の家賃の使い方の決まりの例外の街（上の CITY の ★compare-all-15 の注）。 */
const RENT_USES = Object.freeze(['条件つき', '募集', '過去', '参考']);
const RENT_PAST = Object.freeze(['brisbane', 'sydney']);
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
/* money に { cur, n, per } を書いた行（台帳の通貨の欄が空・単位が「만원」など）── 額は引用の額を通貨の単位に直したもの（2026-11-18）
   per: 'once' は1回きりの額（期間の字を付けない ── 例「訓練の保証金 INR 3,000,000（約◯万円）」） */
const moneyIn = (L, r, en = false) => {
  if (!(L.money && typeof L.money === 'object')) return moneyOf(r, en);
  const m = L.money, once = m.per === 'once';
  return m.n > 0 && /^[A-Z]{3}$/.test(m.cur) && (once || PER[m.per]) ? { per: once ? '' : en ? m.per : PER[m.per], cur: m.cur, n: m.n } : '';
};

/** 英語の字（say(r, 'en') の中身）。対の無い LINES の行・英語で言えない行は null。形は say と同じ（per は 'year' か 'month'） */
function sayEn(r) {
  const L = LINES[r.id];
  if (L && L.h !== r.h) return null;
  const tag = TAG_EN[r.use] || '';
  if (L) {
    const E = L.en;
    if (!E) return null;
    if (L.fleet) { const ft = E.fleet || fleetEn(L.fleet); return ft ? { fleet: ft, label: ft, value: '', cond: '', tag, lead: false } : null; }
    if (L.rows && !(E.rows && E.rows.length === L.rows.length)) return null;
    const v = E.value || (E.rows ? E.rows.map(([k, x]) => `${k} ${x}`).join(' / ') : L.value ? '' : L.money ? moneyIn(L, r, true) : itemValueEn(r));
    if (!E.label || !v || (L.cond && !E.cond)) return null;
    return typeof v === 'object'
      ? { label: E.label, value: v.n, cur: v.cur, per: v.per, cond: E.cond || '', lead: !!L.lead && !tag, tag, mode: L.mode || '' }
      : { label: E.label, value: v, cond: E.cond || '', lead: !!L.lead && !tag, tag, mode: L.mode || '', ...(E.rows ? { rows: E.rows } : {}) };
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
    /* rows ＝ 対象で値が違う行の「対象｜値」（2026-11-19）。value は短いまとめ（無ければ rows をつないだ字）── 画面の一覧は rows を表で出す */
    const v = L.value || (L.rows ? L.rows.map(([k, x]) => `${k} ${x}`).join(' / ') : L.money ? moneyIn(L, r) : itemValue(r));
    if (!L.label || !v) return null;
    return typeof v === 'object'
      ? { label: L.label, value: v.n, cur: v.cur, per: v.per, cond: L.cond || '', lead: !!L.lead && !tag, tag, mode: L.mode || '' }
      : { label: L.label, value: v, cond: L.cond || '', lead: !!L.lead && !tag, tag, mode: L.mode || '', ...(L.rows ? { rows: L.rows } : {}) };
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
/* LINES の名前と値に入れない語（check の注） */
export const NOT_JA = /ロスター|書かれていない|書いていない|記載(?:が)?な|先任|ラインを持つ|の(?:ライン)(?:で|を|は|が)|リザーブ|決まった勤務表|通常勤務の月|スタンバイ勤務の月/;
/* 米国の協約の業界の言い方（日本の読者に通じない）── us-terms.mjs の字に入れない */
export const US_JARGON = /リザーブ|クレジット時間|ALV|デッドヘッド|ロングコール|ショートコール|コンポジット|典型/;
export const HEDGE = /ふつう|普通は|多くの|たいてい|だいたい|試み|という声|とされる|らしい/;
/* 数のすぐ後ろに書いた通貨の名前（「300万ルピー」「13,949ケニア・シリング」「月5万ウォン」）。地名の「フィンランド」「サンフランシスコ」は当たらない */
export const CUR_WORDS = /\d[\d,.]*\s*[万億]?\s*[ァ-ヶー・]*?(?:ルピー|シリング|ナイラ|リヤル|リヤール|ディルハム|ディナール|ウォン|バーツ|リンギット|ペソ|ランド|ルピア|人民元|元|ドル|ユーロ|ポンド|フラン|ラク|クロール)/;
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
  /* ★2026-11-18 オーナーが突き返した字（「ふつう70〜85」「多くのパイロットが少なくとも70日」「月13,949ケニア・シリング」「300万ルピー」）：
     LINES の名前と値に、ぼかし・逸話の語と、字で書いた通貨の名前を入れない。額は money: true（通貨・額・期間は台帳・円の目安つき）。
     off … 画面に出さない行と、その理由（逸話・手続きの細かい話・意味の取れない記号など）。理由は必ず書く */
  for (const [id, L] of Object.entries(LINES)) {
    if ('off' in L) { if (!(typeof L.off === 'string' && L.off.trim())) bad.push({ what: 'LINES', id, why: 'off には出さない理由を書く' }); continue; }
    for (const t of [L.label, L.value, ...(L.rows || []).flat()]) {
      if (typeof t !== 'string') continue;
      const h = HEDGE.exec(t), c = CUR_WORDS.exec(t);
      if (h) bad.push({ what: 'LINES', id, why: `ぼかし・逸話の語「${h[0]}」を字に入れない（${t}）` });
      if (c) bad.push({ what: 'LINES', id, why: `通貨の名前「${c[0]}」を字で書かない ── 額は money: true（${t}）` });
    }
    /* オーナー「日本人にロスターって言ってもわかんねー」「日数は書かれてないっているか？」（2026-11-18）── 名前・値・前提のどれにも */
    if (L.rows && !(L.en && L.en.rows && L.en.rows.length === L.rows.length)) bad.push({ what: 'LINES', id, why: 'rows の英語の対（en.rows・同じ行数）が無い' });
    for (const t of [L.label, L.value, L.cond, ...(L.rows || []).flat()]) { const u = typeof t === 'string' && NOT_JA.exec(t); if (u) bad.push({ what: 'LINES', id, why: `「${u[0]}」を字に入れない（${t}）` }); }
  }
  /* 米国の会社の「勤務の条件（調べ）」のカードの字（us-terms.mjs）も同じ決まり（2026-11-18 オーナー「ライン？なにそれ？」） */
  for (const [slug, T] of Object.entries(TERMS)) for (const rows of Object.values(T)) for (const r of rows || []) for (const t of [r.ja && r.ja.label, r.ja && r.ja.value, r.ja && r.ja.note]) {
    if (typeof t !== 'string') continue;
    const u = NOT_JA.exec(t) || US_JARGON.exec(t) || HEDGE.exec(t);
    if (u) bad.push({ what: 'TERMS', id: `${slug}.${r.key}`, why: `「${u[0]}」を字に入れない（${t.slice(0, 60)}）` });
  }
  /* 対象の違う値を「・」でつないで1つの値に詰めない（rows で「対象｜値」の行にする ── オーナー「どれがどれを対象に言ってるのかわかんない」） */
  for (const [slug, T] of Object.entries(TERMS)) for (const rows of Object.values(T)) for (const r of rows || []) {
    const v = r.ja && r.ja.value;
    if (!r.hide && typeof v === 'string' && (v.match(/・/g) || []).length >= 3) bad.push({ what: 'TERMS', id: `${slug}.${r.key}`, why: `値に「・」が${(v.match(/・/g) || []).length}つ ── 対象ごとの行（rows）にする（${v.slice(0, 50)}）` });
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
    /* ★2026-10-26 段階5 compare-all-15：字を書いた街の、画面に出る家賃の行（読み口 pv-airline-view.mjs と同じ ── 出す使い方の行のうち、
       先頭の行と同じ資料の行）は、使い方が「条件つき」。暮らしの板も比較の家賃の箱も、街の家賃に「参考」「過去」「募集」の札を出さない ──
       そういう行の街（ニース・ボルドー・ナント・オスロ・コペンハーゲン）には字を書かない。
       例外は RENT_PAST の2街だけ（2026-10-21 roll-c の決め b「週あたりのまま」で出している街。行の使い方は「過去」で、板に札が出ていない ──
       比較の箱には出ない（週あたり）。直すかは別の判断）。家賃の行の在る街は、物差し・資料・数字の範囲の断りを持つ（額だけを出さない）。 */
    const vis = (L.rents || []).filter(r => r.value && typeof r.value === 'object' && RENT_USES.includes(r.use) && (!C.url || ((r.src || [])[0] || {}).url === C.url));
    /* ★2026-10-29：url を持つ街は、その資料の行が台帳に在る（字の表で選んだ資料が無いのに、別の資料の行を黙って出さない） */
    if (C.url && !vis.length) bad.push({ what: 'CITY', id: city, why: `選んだ資料（${C.url}）の家賃の行が台帳に無い` });
    const url0 = vis.length ? ((vis[0].src || [])[0] || {}).url : '';
    const odd = vis.filter(r => ((r.src || [])[0] || {}).url === url0 && r.use !== '条件つき').map(r => `${r.id}（${r.use}）`);
    if (odd.length && !RENT_PAST.includes(city)) bad.push({ what: 'CITY', id: city, why: `画面に出る家賃の行の使い方が「条件つき」ではない（${odd.join('・')}）── 札を出さない板に出すことになるので、この街に字を書かない` });
    if (vis.length && !(C.measure && C.site && C.scope)) bad.push({ what: 'CITY', id: city, why: '家賃の行が在るのに、物差し・資料・数字の範囲の断りのどれかが無い' });
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
