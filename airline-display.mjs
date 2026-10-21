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
 *   node airline-display.mjs --check   古い字・名前の無い資料を数える（赤なら exit 1）
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLACES } from './airline-destinations.mjs';
import { COUNTRIES } from './airline-countries.mjs';

/* 使い方の札。条件つき・募集は札なし（募集は募集の1枚に置くこと自体が言い方）。 */
export const TAG = Object.freeze({ 過去: '過去', 参考: '参考' });

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
  annual_leave: { label: '年次休暇', say: 'count' },
  sick_leave: { label: '有給の病気休暇', say: 'count' },
  days_off: { label: '休日', say: 'count' },
  annual_days_off: { label: '休日', say: 'count', per: true },
  headquarters_country: { label: '本社', say: 'country' },
  headquarters_city: { label: '本社', say: 'city' },
  pilot_base_city: { label: '拠点', say: 'city' },
  working_time: { label: '勤務時間', say: 'count' },
  medical: { label: '医療の補助', say: 'money' },
  commuting: { label: '通勤の補助', say: 'money' },
  housing: { label: '住宅の補助', say: 'money' },
  founded: { label: '設立', say: 'date' },
  first_flight: { label: '最初の便', say: 'date' },
  fleet_total: { label: '運航している機材', say: 'count' },
  pilot_base: { label: '拠点', say: 'iata' },
});
/* 単位の言い方（台帳の単位の字 → 画面の字）。表に無い単位の行は言わない。 */
const UNIT = Object.freeze({
  days: '日', day: '日', '日': '日', 'days/year': '日', 'days per year': '日',
  'calendar days': '日（暦日）', calendar_days: '日（暦日）', 'calendar days per year': '日（暦日）',
  weeks: '週間', 'weeks per year': '週間', hours: '時間', '時間': '時間', '機': '機', aircraft: '機',
});
const PER = Object.freeze({ year: '年', month: '月' });
const perOf = r => PER[r.per] || (/per year|\/year/.test(String(r.unit || '')) ? '年' : '');
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

/* ── 誰の条件か（2026-10-21 全社へ広げる d1・リード「勤務の行は、誰の条件かを言う」）──
   項目の言い方の表（ITEM）で言う勤務・待遇の行は、行の職位（rank）が機長・副操縦士・訓練生なら、名前の頭にそれを付ける
   （「機長の休日 年120日」）。機長の募集・訓練生の募集の数を、どのパイロットにも当てはまるように読ませない。
   運航乗務員ぜんたい（crew）・職位の無い行は付けない。行ごとの字（LINES）は、その字が誰の条件かを言う（cond）。
   ★訓練生の行は、勤務・待遇のカードの1行め（lead）にしない（airline-rollout.mjs）。 */
export const RANK_JA = Object.freeze({ cap: '機長', fo: '副操縦士', trainee: '訓練生' });
export const rankOf = r => r.rank || (r.applies_to && r.applies_to.rank) || '';
const WHOSE_DOMAINS = ['work', 'benefits'];

/* ── 労働協約（2026-10-21 リードの決め d・P12.86-6）──
   政府の機関に登録された・政府や組合が公表した労働協約は、その会社の条件の一次資料。画面では「労働協約」の札と、
   その協約の名前で出す（「会社が公表している条件」とは言わない・「確認できていません」にもしない）。
   ★ここに書くのは、協約の本文か承認の決定そのものの資料だけ（資料の ID ごと）。報告・報道・掲示板・協約の要約の投稿は書かない
     （資料の種類の欄が union_cba でも、組合のお知らせ・ニュースの記事なら入れない ── 字の表で1件ずつ決める）。
   name … 出どころのリンクの字（資料自身の題は「」の中）／cond … その協約が誰の条件か（カードの前提の1行。LINES の cond が在ればそちら） */
export const AGREEMENTS = Object.freeze({
  'src-qantas-sh-ea9-approved': { name: 'オーストラリア公正労働委員会「[2025] FWCA 1554」（カンタス航空 短距離線パイロットの労働協約 EBA9 の承認と本文）', cond: '短距離線のパイロットの労働協約' },
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

/* ── 欄だけでは言えない行の字（LINES）── 行の ID ごと。h はその行の台帳の指紋（変わると古い）。
   label … 画面の名前／value … 値（無ければ ITEM の言い方で値を作る）／cond … 前提の短い1行（無ければ出さない）
   lead  … その欄（勤務・待遇）のカードの1行めにする行（条件つきの行だけ）
   fleet … 機材の型式（会社の資料に載っている型式。機数は書かない） */
export const LINES = Object.freeze({
  /* ── カンタス航空 ── */
  'qantas.work.resume-training-facilities': { h: '7a56db8de960d3ad', label: '訓練の場所', value: 'ブリスベン・メルボルン・シドニー', cond: '会社の主な訓練の拠点' },
  'qantas.jobs.resume-academy-no-job-guarantee': { h: '803243cfa4d8fe32', label: '養成校を修了したあとの採用', value: '約束されていない', cond: 'Qantas Group Pilot Academy の案内（会社の答え）' },
  'qantas.fleet.a380': { h: '39a559c3f4fa478d', fleet: 'エアバス A380' },
  'qantas.fleet.b787': { h: '4003af454c0a0e8b', fleet: 'ボーイング 787-9' },
  'qantas.fleet.pub-a321xlr-fleet': { h: '1d174874da2021c5', fleet: 'エアバス A321XLR' },
  'qantas.fleet.pub-a330-200-fleet': { h: '065e9da3e34dcc6a', fleet: 'エアバス A330-200' },
  'qantas.fleet.pub-a330-300-fleet': { h: '9feeb0c044449c33', fleet: 'エアバス A330-300' },
  'qantas.fleet.pub-b737-800-fleet': { h: '92188b925b40cf33', fleet: 'ボーイング 737-800' },
  /* ── スカイマーク ── */
  'skymark.benefits.staff-travel': { h: 'e04f095532e3c2cf', label: '社員の航空券', value: '自社便の優待搭乗制度', cond: '自社養成パイロット訓練生の募集要項', lead: true },
  'skymark.benefits.missing-annual-leave': { h: '2074a5e046a83080', label: '休暇', value: '年次有給休暇と、慶弔・育児・介護などの休暇', cond: '経験者の機長候補の募集要項。日数は書かれていない' },
  'skymark.benefits.missing-commuting': { h: 'ec79978e22358264', label: '通勤', value: '公共交通か車。早朝・深夜などはタクシーを使える', cond: '経験者の機長候補の募集要項' },
  'skymark.benefits.missing-medical': { h: '17a9a4b06151cd60', label: '保険', value: '社会保険・健康保険組合・団体長期障害所得補償保険', cond: '経験者の機長候補の募集要項' },
  'skymark.jobs.cont-cadet-start': { h: '50fc5c46f7e86d6f', label: '自社養成の入社予定日', value: '2027年4月1日（または会社が指定する時期）', cond: '予定' },
  /* 2026-10-21 a2：年間休日の行（値の字は ITEM の言い方「年123日」・誰の条件かを1行） */
  'skymark.work.pub-experienced-days-off': { h: 'cf622b302915dfeb', label: '休日', cond: '経験者の機長候補の募集要項' },
  'skymark.work.cadet-hours': { h: '2873589c181b47d4', label: '訓練生の勤務時間', value: '週平均37.5時間以内（1か月単位の変形労働時間制）', cond: '自社養成パイロット訓練生の募集要項' },
  /* 2026-10-21 d1：a2 の置き場の行（年金・勤務の組み方） */
  'skymark.benefits.missing-pension': { h: '8674c4d517d43ea1', label: '年金', value: '確定拠出年金', cond: '経験者の機長候補の募集要項' },
  'skymark.work.missing-roster-pattern': { h: '2957d27bf35b9c85', label: '勤務の形', value: '1か月単位の変形労働時間制（1日平均7.5時間・週平均37.5時間）', cond: '経験者の機長候補の募集要項' },
  'skymark.fleet.missing-fleet-types': { h: 'b9931e917624f38f', fleet: 'ボーイング 737-800' },
  'skymark.fleet.pub-fleet-b737-8': { h: 'b930b2ada55bf942', fleet: 'ボーイング 737-8' },
  /* ── 全社へ広げる d1（2026-10-21）：日本の会社。字は行の値と引用から（調べた側の字は使わない）。cond ＝ 誰の・どの資料の条件か ── */
  /* ZIPAIR（運航乗務員（機長要員・副操縦士要員）募集要項） */
  'zipair.benefits.cont-pilot-commuting': { h: '83a94a43b544047e', label: '通勤', value: '通勤手当', cond: '機長要員・副操縦士要員の募集要項' },
  'zipair.benefits.cont-pilot-disability': { h: '2dd45b2519cde5ee', label: '保険', value: '団体長期障害所得補償保険', cond: '機長要員・副操縦士要員の募集要項' },
  'zipair.benefits.cont-pilot-pension': { h: '69c630f746663a17', label: '年金', value: '確定拠出年金', cond: '機長要員・副操縦士要員の募集要項' },
  'zipair.benefits.missing-annual-leave': { h: '6324f8d0657f49f6', label: '休暇', value: '年次有給休暇・慶弔などの特別休暇', cond: '機長要員・副操縦士要員の募集要項。日数は書かれていない' },
  'zipair.jobs.cont-pilot-contract': { h: 'bec953244c9acd1d', label: '雇用の形', value: '訓練中は有期契約、機長・副操縦士に発令後は正社員（60〜65歳は契約社員）', cond: '機長要員・副操縦士要員の募集要項' },
  'zipair.jobs.cont-pilot-entry': { h: 'f7ccb16c9ea6a0e7', label: '募集の受付', value: '機長要員・副操縦士要員を募集中（締切の日付は無い）', cond: '会社の募集ページ（2026年10月19日に確認）' },
  'zipair.work.cont-pilot-roster': { h: 'c93c4987074ed36c', label: '勤務の形', value: '乗務・地上勤務に応じたシフト勤務（変形労働時間制）', cond: '機長要員・副操縦士要員の募集要項。土日祝日・深夜の勤務あり' },
  'zipair.work.cont-pilot-training': { h: '768e708c073c766b', label: '訓練の場所', value: '国内か海外の訓練施設', cond: '機長要員・副操縦士要員の募集要項' },
  /* ジェットスター・ジャパン（2026年の運航乗務員候補者 募集要項 ── 訓練生の募集。応募は2026年4月12日に締切）。
     待遇の3行は、名前が「訓練生の…」（訓練生の行は、名前が訓練の話でないと待遇のカードの1行めにならない ── 1行めが無いと、
     カードが「確認できていません」と言いながら開いた板に今の公表を並べてしまう。2026-10-21 d1 の続き） */
  'jetstar-japan.benefits.cont-foug-commuting': { h: '8f9f9ab64cf3f175', label: '訓練生の通勤', value: '通勤費（会社の規定による）', cond: '2026年の運航乗務員候補者（訓練生）の募集要項' },
  'jetstar-japan.benefits.cont-foug-leave': { h: '11384d774359f6e5', label: '訓練生の休暇', value: '年次有給休暇・傷病休暇・慶弔などの特別休暇', cond: '2026年の運航乗務員候補者（訓練生）の募集要項。日数は書かれていない' },
  'jetstar-japan.benefits.missing-medical': { h: '937efdd6df4733c1', label: '訓練生の保険', value: '社会保険', cond: '2026年の運航乗務員候補者（訓練生）の募集要項' },
  'jetstar-japan.jobs.cont-foug-employment': { h: 'e147a5cbad7fd9bb', label: '雇用の形', value: '契約社員。所定の訓練を終えると正社員に登用', cond: '2026年の運航乗務員候補者（訓練生）の募集要項' },
  'jetstar-japan.jobs.foug-closed': { h: '347b3c3340b595da', label: '募集の受付', value: '締め切った（2026年4月12日必着）', cond: '2026年の運航乗務員候補者（訓練生）の募集要項' },
  'jetstar-japan.work.missing-roster-pattern': { h: '74f6affe32599982', label: '訓練生の勤務の形', value: '変則勤務（土日祝日も勤務）', cond: '2026年の運航乗務員候補者（訓練生）の募集要項' },
  'jetstar-japan.work.training-locations': { h: '1b7b2ea16dc12ee1', label: '訓練の場所', value: '日本国内と、ソウル・クアラルンプールなど海外の訓練施設', cond: '2026年の運航乗務員候補者（訓練生）の募集要項' },
  /* Peach（運航乗務員の募集一覧 ── 機長の募集） */
  'peach.benefits.cont-captain-insurance': { h: 'd5565aac8b2ee008', label: '保険', value: '社会保険・団体長期障害所得補償保険など', cond: '機長の募集要項' },
  'peach.benefits.cont-captain-pension': { h: '773ddd9316056c15', label: '年金', value: '選択制の確定拠出年金', cond: '機長の募集要項' },
  'peach.benefits.cont-captain-travel': { h: '9db39abbc45d61e3', label: '社員の航空券', value: '社員優待搭乗制度', cond: '機長の募集要項' },
  'peach.benefits.missing-annual-leave': { h: '5ac9aa60678a44c3', label: '休暇', value: '年次有給休暇（法定どおり）・リフレッシュ休暇・特別休暇', cond: '機長の募集要項。日数は書かれていない' },
  'peach.jobs.cont-captain-contract': { h: 'cc802213220bfcff', label: '雇用の形', value: '初期訓練中は有期、機長に発令後は65歳まで無期、65歳からは1年ごとの契約で68歳まで', cond: '機長の募集要項' },
  'peach.jobs.cont-challenge-closed': { h: 'a9119d9f8e97a872', label: '募集の受付', value: 'パイロットチャレンジ生（プレエントリー）は受付終了', cond: '会社の募集一覧（2026年10月19日に確認）' },
  'peach.jobs.missing-entry-open': { h: '01d059fb79a3c2bc', label: '募集の受付', value: '機長の募集は、定員に達し次第締め切り', cond: '会社の募集一覧（2026年10月19日に確認）' },
  'peach.work.cont-captain-roster': { h: '72f647d31b6e2e3f', label: '勤務の形', value: '乗務・地上勤務に応じたシフト勤務（変形労働時間制）', cond: '機長の募集要項。土日祝日・深夜・早朝の勤務あり' },
  'peach.work.missing-training-location': { h: '4d0c1adb3d60e03b', label: '訓練の場所', value: '訓練の委託先と、会社が決める場所', cond: '機長の募集要項' },
  /* ソラシドエア（中途採用 運航乗務員（機長要員）） */
  'solaseed.benefits.missing-annual-leave': { h: '142e40e977e7ddbf', label: '休暇', value: '年次有給休暇・季節休暇・赴任休暇・慶弔などの特別休暇', cond: '機長要員の募集要項。日数は書かれていない' },
  'solaseed.benefits.missing-medical': { h: '1dfbca0f00c5c205', label: '保険', value: '社会保険・メンタルヘルスケア・休業時の所得補償保険', cond: '機長要員の募集要項' },
  'solaseed.benefits.missing-pension': { h: 'b5001bbdee4ecea9', label: '年金', value: '厚生年金と企業型確定拠出年金', cond: '機長要員の募集要項' },
  'solaseed.benefits.missing-staff-travel': { h: 'abe848e6f69c9471', label: '社員の航空券', value: '自社便の社員優待搭乗制度', cond: '機長要員の募集要項' },
  'solaseed.jobs.missing-entry-open': { h: '95404671724bf6cb', label: '募集の受付', value: '書類が届き次第選考（締切の日付は無い）', cond: '機長要員の募集（2026年10月19日に確認）' },
  'solaseed.work.missing-roster-pattern': { h: 'a361bdf94d501c74', label: '勤務の形', value: '土日祝日を含む変則勤務（早朝・深夜あり）', cond: '機長要員の募集要項' },
  /* AIRDO */
  'airdo.benefits.travel': { h: 'e464d301fbaaaacc', label: '社員の航空券', value: '自社便と他社便の優待搭乗制度', cond: '運航乗務員（機長）の募集要項' },
  'airdo.jobs.cont-experienced-closed': { h: '777842bf7a1b01c5', label: '募集の受付', value: '経験者の機長・副操縦士の募集は2026年9月1日から停止', cond: '運航乗務員採用のお知らせ' },
  /* スターフライヤー（運航乗務員の募集要項 ── 機長・副操縦士） */
  'starflyer.benefits.missing-annual-leave': { h: 'ef4bbe7d664f359f', label: '休暇', value: '年次有給休暇・産前産後休暇・育児休暇・介護休暇', cond: '機長・副操縦士の募集要項。日数は書かれていない' },
  'starflyer.benefits.missing-medical': { h: 'fe07b19ec0766210', label: '保険', value: '社会保険・定期健康診断・団体長期障害所得補償保険', cond: '機長・副操縦士の募集要項' },
  'starflyer.benefits.missing-pension': { h: '460c7eabcf691755', label: '年金', value: '確定拠出年金', cond: '機長・副操縦士の募集要項' },
  'starflyer.benefits.missing-staff-travel': { h: 'f65dc04a42aea643', label: '社員の航空券', value: '自社便とANA便の社員優待搭乗', cond: '機長・副操縦士の募集要項' },
  'starflyer.jobs.cont-cap-contract': { h: '2713040cc6d1ac95', label: '雇用の形', value: '60歳未満は無期。60歳からは2027年3月31日までの契約（更新することがあり、68歳まで）', cond: '機長の募集要項' },
  'starflyer.jobs.cont-current-pilot-jobs': { h: 'c6039bf1d57208ba', label: '募集の受付', value: 'A320の限定を持つ副操縦士候補と、機長候補を募集中', cond: '中途採用・現在募集中の職種（2026年10月19日に確認）' },
  'starflyer.work.cont-co-pilot-hours': { h: 'e4e8d07a812ba8cd', label: '副操縦士の勤務時間', value: '1か月単位の変形労働時間制（月平均で週40時間以内）', cond: '副操縦士の募集要項' },
  'starflyer.work.cont-pilot-hours': { h: '4fe2550d3a88bf31', label: '機長の勤務時間', value: '1か月単位の変形労働時間制（月平均で週40時間以内）', cond: '機長の募集要項' },
  'starflyer.work.missing-roster-pattern': { h: 'b5c5ba58198ea84c', label: '勤務の形', value: 'シフト勤務（1か月単位の変形労働時間制）', cond: '機長・副操縦士の募集要項' },
  'starflyer.work.missing-training-location': { h: '696321482118038b', label: '訓練の場所', value: '北九州空港の施設', cond: '機長・副操縦士の募集要項' },
  /* フジドリームエアラインズ（採用サイトの福利厚生 ＝ 全職種／他社経験者の機長候補の求人） */
  'fda.benefits.cont-general-family-travel': { h: '243e130ca5fd0c24', label: '社員の航空券', value: '社員と家族の自社便の優待', cond: '採用サイトの福利厚生（全職種）' },
  'fda.benefits.cont-general-housing': { h: '990e053fd590a1c8', label: '住宅の補助', value: '住宅手当', cond: '採用サイトの福利厚生（全職種）。パイロットへの適用と額は書かれていない' },
  'fda.benefits.missing-annual-leave': { h: '5483daad32c9124f', label: '休暇', value: '有給休暇・リフレッシュ休暇・育児休暇', cond: '採用サイトの福利厚生（全職種）。日数は書かれていない' },
  'fda.benefits.missing-medical': { h: '24587dd210cab51c', label: '保険', value: '健康保険', cond: '他社経験者の機長候補の求人' },
  'fda.benefits.missing-pension': { h: '6f6ae266e09b3385', label: '年金', value: '選択制の確定拠出年金（月給の中から月2万円までを積み立て。選ばない分は毎月支給）', cond: '他社経験者の機長候補の求人' },
  'fda.jobs.missing-entry-open': { h: '19bbdaaafd7ac456', label: '募集の受付', value: '他社経験者の機長候補と副操縦士候補の2件を募集中', cond: '会社の採用サイトの一覧（2026年10月19日に確認）' },
  /* AirJapan（海外に住む機長・副操縦士の、派遣会社を通した募集） */
  'airjapan.benefits.missing-commuting': { h: 'c525d4964c6ca435', label: '通勤', value: '通勤の手当と、会社が手配する航空券（他社便のエコノミーかANA運航便のビジネス）', cond: '海外に住む機長・副操縦士の、派遣会社を通した募集' },
  'airjapan.jobs.overseas-agency': { h: 'e08827f3e3183ff4', label: '雇用の形', value: '海外に住む人は直接雇わず、派遣会社を通して契約', cond: '海外に住む機長・副操縦士の、派遣会社を通した募集' },
  'airjapan.work.cont-agency-roster': { h: '8a28213b554193a3', label: '勤務の形', value: '月に連続10日の休みと、通勤の2日', cond: '海外に住む機長・副操縦士の、派遣会社を通した募集' },
  /* 天草エアライン（運航乗務員（機長）の募集要項） */
  'amx.benefits.missing-annual-leave': { h: 'cb3f1165aa75d3f0', label: '休暇', value: '有給休暇・慶弔などの特別休暇', cond: '運航乗務員（機長）の募集要項。日数は書かれていない' },
  'amx.benefits.missing-medical': { h: '2db9019158031dbf', label: '保険', value: '各種社会保険', cond: '運航乗務員（機長）の募集要項' },
  'amx.benefits.pension': { h: '968a4e2f3d55dcae', label: '退職金', value: '退職金制度', cond: '運航乗務員（機長）の募集要項' },
  'amx.jobs.cont-captain-contract': { h: 'b99c036f035babed', label: '雇用の形', value: '正社員（60歳からは嘱託）。機長任用の訓練中は契約社員', cond: '運航乗務員（機長）の募集要項' },
  'amx.jobs.missing-entry-open': { h: '9e67e48abc087a20', label: '募集の受付', value: '機長の募集要項を掲載中（締切と募集の年は書かれていない）', cond: '会社の採用ページ' },
  /* ANAウイングス（2027年度入社 自社養成パイロットの募集要項／会社の福利厚生の案内） */
  'ana-wings.benefits.missing-commuting': { h: 'dd6c65164b4cfaac', label: '通勤', value: '通勤補助費（会社の規定による）', cond: '2027年度入社の自社養成パイロットの募集要項' },
  'ana-wings.benefits.missing-housing': { h: '3e3f4a7569db353b', label: '住宅の補助', value: '社宅・寮か住宅手当（職種によって違う）', cond: '会社の福利厚生の案内（全職種）' },
  'ana-wings.benefits.missing-medical': { h: '581ef4a70882d3ae', label: '保険', value: '社会保険', cond: '2027年度入社の自社養成パイロットの募集要項' },
  'ana-wings.benefits.missing-pension': { h: '4c8b56e79f7e1d97', label: '年金', value: '確定拠出年金', cond: '会社の福利厚生の案内（全職種）' },
  'ana-wings.benefits.travel': { h: '0092f1a496ec055c', label: '社員の航空券', value: '国内線・国際線の優待搭乗制度', cond: '2027年度入社の自社養成パイロットの募集要項' },
  'ana-wings.jobs.captain-planned': { h: 'e2b33245fd948773', label: '募集の受付', value: '経験者の機長の本エントリーは11月末に始まる予定', cond: 'パイロット経験者採用のお知らせ' },
  'ana-wings.jobs.cont-cadet-contract': { h: '323537440d67b4f6', label: '雇用の形', value: '期間の定めのない正社員（試用期間は原則3か月）', cond: '2027年度入社の自社養成パイロットの募集要項' },
  'ana-wings.jobs.entry-2027-closed': { h: '4b49edcc4597a881', label: '募集の受付', value: '2027年度入社の自社養成の受付は終了', cond: '2027年度入社の自社養成パイロットの募集要項' },
  'ana-wings.work.cont-cadet-training': { h: '49791e43406fec88', label: '訓練の流れ', value: 'ほかの職種の研修（約1年）→ 海外か国内で基礎訓練 → 型式・路線の訓練 → 副操縦士の審査', cond: '2027年度入社の自社養成パイロットの募集要項' },
  'ana-wings.work.roster': { h: '649772b8b29975b7', label: '勤務の形', value: 'シフト勤務（乗務に合わせて組む。土日祝日・早朝・深夜・宿泊を伴う勤務あり）', cond: '2027年度入社の自社養成パイロットの募集要項' },
  /* 第一航空 */
  'daiichi-air.jobs.cont-fixed-jobs': { h: 'b463ca30ea6485d1', label: '募集の受付', value: '固定翼の事業用操縦士以上（運航管理も兼務）を募集中（入社時期は相談）', cond: '会社の採用情報' },
  /* 北海道エアシステム */
  'hac.jobs.cont-pilot-job-closed': { h: '37d6de22fc648dec', label: '募集の受付', value: '運航乗務員は今は募集していない', cond: '会社の採用情報（2026年10月19日に確認）' },
  'hac.work.missing-roster-pattern': { h: '2e3a6222a86635dc', label: '副操縦士の勤務の例', value: '遅番の1日：12:40に出社、丘珠発着で函館・釧路の5便、20:30に勤務終了', cond: '会社の採用情報に載っている1日の例' },
  /* IBEXエアラインズ（副操縦士要員（未経験者）の募集要項／採用サイトの制度の案内 ＝ 全職種） */
  'ibex.benefits.cont-fo-leave': { h: 'c9006d82b1d025db', label: '休暇', value: '年次有給休暇・フレックス休暇（年3日）・慶弔・育児・介護・傷病の休暇', cond: '副操縦士要員（未経験者）の募集要項' },
  'ibex.benefits.missing-housing': { h: '2c91bbb1bcc25025', label: '住宅の補助', value: '住宅手当', cond: '採用サイトの制度の案内（全職種）' },
  'ibex.benefits.missing-medical': { h: '9a4905819d2c92b0', label: '保険', value: '社会保険・予防接種の費用の補助・定期健康診断', cond: '採用サイトの制度の案内（全職種）' },
  'ibex.benefits.missing-pension': { h: '5401c4f07f5d449c', label: '年金', value: '厚生年金', cond: '採用サイトの制度の案内（全職種）' },
  'ibex.benefits.missing-staff-travel': { h: '2a96c2269b6fd568', label: '社員の航空券', value: '社員優待搭乗', cond: '採用サイトの制度の案内（全職種）' },
  'ibex.jobs.cont-fo-contract': { h: 'fb815d35f108369b', label: '雇用の形', value: '副操縦士任用の訓練が終わるまでは有期、副操縦士に発令後は正社員', cond: '副操縦士要員（未経験者）の募集要項' },
  'ibex.jobs.cont-fo-open': { h: 'd6e3732f71b31c90', label: '募集の受付', value: '2026年10月30日必着（入社は2027年4月1日以降の予定）', cond: '副操縦士要員（未経験者）の募集要項' },
  'ibex.work.cont-fo-work': { h: 'a69e13f80bf49544', label: '訓練生の勤務の形', value: '変形労働時間制（1か月単位）', cond: '副操縦士要員（未経験者）の募集要項' },
  /* ジェイエア */
  'j-air.jobs.cadet-closed': { h: '0bcfc3110e1e3640', label: '募集の受付', value: '自社養成の募集は終了（前回の要項を参考に掲載）', cond: '運航乗務員の募集要項' },
  /* 日本エアコミューター（運航乗務員（副操縦士要員）の募集要項。今年度の募集は終了） */
  'jac.benefits.housing-none': { h: 'a1a65c8221cbe657', label: '社宅・寮', value: '会社が持つ社宅・寮は無い', cond: '運航乗務員の募集要項' },
  'jac.benefits.missing-annual-leave': { h: '76a1ac49b58d54df', label: '休暇', value: '年次有給休暇と特別休暇', cond: '運航乗務員の募集要項（今年度の募集は終了）。日数は書かれていない' },
  'jac.benefits.missing-medical': { h: 'c6cc31e1a2f59b15', label: '保険', value: '日本航空健康保険組合・厚生年金・雇用保険・労災保険', cond: '運航乗務員の募集要項（今年度の募集は終了）' },
  'jac.jobs.cont-fo-closed': { h: 'f706389a0616cf73', label: '募集の受付', value: '今年度の募集は終了（前回の要項を参考に掲載）', cond: '運航乗務員の募集要項' },
  'jac.work.training-kagoshima': { h: 'b6f311b5c2799e66', label: '訓練の場所', value: '鹿児島', cond: '運航乗務員の募集要項' },
  /* 日本トランスオーシャン航空（2026年度 機長候補者の募集要項。受付は2026年9月30日に終了） */
  'jta.benefits.missing-annual-leave': { h: '87fb70f6e5a794c5', label: '休暇', value: '年次有給休暇・夏季休暇・慶弔などの特別休暇', cond: '2026年度の機長候補者の募集要項（受付は終了）。日数は書かれていない' },
  'jta.benefits.missing-medical': { h: '66ba9922a26dfcc8', label: '保険', value: '各種社会保険・日本航空健康保険組合・LOL制度', cond: '2026年度の機長候補者の募集要項（受付は終了）' },
  'jta.benefits.missing-staff-travel': { h: 'e4b3858321ecfbcd', label: '社員の航空券', value: 'JALレジャートラベル制度', cond: '2026年度の機長候補者の募集要項（受付は終了）' },
  'jta.jobs.captain-deadline': { h: '6a5da642eb844b68', label: '募集の受付', value: '2026年9月30日に締め切った', cond: '2026年度の機長候補者の募集要項' },
  'jta.work.missing-roster-pattern': { h: 'c98a2e09b19a1068', label: '勤務の形', value: '土日祝日を含む変則勤務', cond: '2026年度の機長候補者の募集要項（受付は終了）' },
  /* オリエンタルエアブリッジ */
  'orc.jobs.cont-rotor-job': { h: 'eed0f858ce645ae6', label: '募集の受付', value: '回転翼の操縦士（機長）を募集', cond: '会社の採用情報' },
  /* 琉球エアーコミューター */
  'rac.jobs.cont-current-job-closed': { h: '696368088857df24', label: '募集の受付', value: '今は募集していない', cond: '会社の求人情報（2026年10月19日に確認）' },
  'rac.jobs.cont-trainee-deadline': { h: '98eeb73e0ec43eeb', label: '訓練生の募集', value: '2026年5月15日に締め切った（入社は7月1日以降の予定）', cond: '2026年度の訓練生の募集（事業用・多発・計器の資格を持つ人）' },
  'rac.work.cont-scholarship-bond': { h: '34a277f4bf3c6f6b', label: '奨学金の返還', value: '資格を取ってパイロットとして入社し、一定の期間勤めると、自己負担分を除いて返還を免除', cond: '2026年度の奨学金の募集（沖縄県内の大学などの学生）' },
  'rac.work.missing-roster-pattern': { h: 'b332de5c421364c9', label: '1日の乗務', value: '1日に4〜6便を担当', cond: '運航乗員部門の紹介' },
  'rac.work.missing-upgrade-years': { h: '4c0ad3fe6eb56a9b', label: '機長への昇格の例', value: '副操縦士に発令後5〜6年で機長になった人もいる', cond: '人事担当のQ&A（例であり、決まった年数ではない）' },
  /* 新中央航空（セスナ172P型機の機長・操縦訓練教官の募集 ── 竜ヶ崎飛行場の事業所。応募は2026年10月15日に締切） */
  'shin-central.benefits.r2-c172-retirement': { h: 'db69a1c87a91133d', label: '退職金', value: '退職金制度', cond: 'セスナ172P型機の機長・操縦訓練教官の募集（竜ヶ崎）' },
  'shin-central.benefits.r2-c172-social-insurance': { h: 'c054c022692e6b9a', label: '保険', value: '各種の社会保険（健康保険、厚生年金、雇用保険、労災保険）', cond: 'セスナ172P型機の機長・操縦訓練教官の募集（竜ヶ崎）' },
  'shin-central.work.r2-c172-holidays': { h: '39ca502e76b255c4', label: '機長の休日', value: '月9日（年間休日118日以上）', cond: 'セスナ172P型機の機長・操縦訓練教官の募集（竜ヶ崎）' },
  /* 新日本航空 */
  'shin-nihon.jobs.cont-instructor-closed': { h: '8450e4e74c129159', label: '募集の受付', value: '事業用操縦士（教官）の募集は終了', cond: '鹿児島本社運航所の採用情報' },
  /* 東邦航空（中途採用の操縦士募集） */
  'toho-air.jobs.cont-pilot-current-job': { h: 'be4196383f468ed3', label: '募集の受付', value: '操縦士を若干名（採用が決まり次第終了）', cond: '中途採用の操縦士募集' },
  'toho-air.work.cont-pilot-training': { h: '8f93c3d3464118ac', label: '訓練', value: '機体のライセンスを取り、OJTで技能を身につける', cond: '中途採用の操縦士募集' },
  'toho-air.work.cont-pilot-work': { h: '8879f351157450c6', label: '勤務時間', value: '担当する事業によって変わる', cond: '中途採用の操縦士募集' },
  /* トキエア（運航乗務員候補（機長）の募集要項） */
  'toki-air.benefits.cont-captain-commuting': { h: '8bb30366ad046167', label: '通勤', value: '通勤費の規程と、コミューティング制度', cond: '機長候補の募集要項' },
  'toki-air.benefits.cont-captain-housing': { h: '9ae3205beb43ea8d', label: '住宅の補助', value: '住宅手当', cond: '機長候補の募集要項' },
  'toki-air.benefits.missing-annual-leave': { h: '20802573dd0a7872', label: '休暇', value: '年次有給休暇・年末年始・傷病・結婚・忌引・転勤などの特別休暇', cond: '機長候補の募集要項。日数は書かれていない' },
  'toki-air.benefits.missing-pension': { h: '9a7484b31049b5c2', label: '年金', value: '厚生年金', cond: '機長候補の募集要項' },
  'toki-air.jobs.cont-captain-contract': { h: '94bc7101a4e745c0', label: '雇用の形', value: '入社時は契約社員。所定の訓練・機長の発令・試用期間のあと正社員', cond: '機長候補の募集要項' },
  'toki-air.jobs.cont-captain-open': { h: '766eafc3da871760', label: '募集の受付', value: '機長候補を募集中（書類が届き次第、順に選考）', cond: '機長候補の募集要項（2026年10月19日に確認）' },
  'toki-air.work.cont-captain-days': { h: '5602b14b0b525c0c', label: '機長の休日', value: '年120日程度', cond: '機長候補の募集要項' },
  'toki-air.work.missing-training-location': { h: 'a958ab3e559fad72', label: '訓練の場所', value: '国内と海外の訓練施設', cond: '機長候補の募集要項' },
  /* ── 全社へ広げる d1 の続き（2026-10-21）：アジアの会社。字は行の値と引用から（調べた側の字は使わない）。cond ＝ 誰の・どの資料の条件か。
     同じ資料の同じことを言う2つめの行は字を書かない（大韓航空の訓練センター・バンブーの締切・フィリピン航空とベトジェットの求人の表示）── */
  /* シンガポール航空（パイロットの採用案内・求人） */
  'singapore-airlines.benefits.free-travel': { h: '7db8494bca816cbf', label: '社員の航空券', value: '年に1回の無料の旅行', cond: 'パイロットの採用案内' },
  'singapore-airlines.benefits.medical': { h: '2870d4f88971e193', label: '保険', value: '医療と歯科の保障、保険', cond: 'パイロットの採用案内' },
  'singapore-airlines.benefits.p26-family-travel': { h: 'af876bc873321fc2', label: '家族の航空券', value: '本人と対象の家族は、自社と提携会社の便を回数の制限なく割引で', cond: 'パイロットの採用案内。対象の家族の範囲は書かれていない' },
  'singapore-airlines.jobs.missing-entry-open': { h: '57619cda77d0ee38', label: '募集の受付', value: '訓練生（Ab Initio Cadet Pilot）を募集中', cond: '会社の求人ページ' },
  'singapore-airlines.jobs.r7-a350-a380-contract-term': { h: 'cfaff568e36114b4', label: '雇用の形', value: 'A350・A380の経験者の副操縦士・機長は、最長12か月の有期契約', cond: '経験者の副操縦士・機長（契約）の求人（2026年10月2日に掲載）' },
  'singapore-airlines.jobs.r7-second-officer-current-closed': { h: 'b3e13278c95b2c97', label: '募集の受付', value: '経験者のセカンドオフィサーの応募は、いまは受け付けていない', cond: '会社のパイロット採用のページ（2026年10月20日に確認）' },
  'singapore-airlines.work.bond': { h: 'e43e45cc413336a3', label: '勤続の約束', value: '訓練の期間と、副操縦士になってから7年', cond: '訓練生（自社養成）の採用案内。返す額は書かれていない' },
  'singapore-airlines.work.training': { h: 'f64aec0a0a5a7b7a', label: '訓練の場所', value: 'Singapore Flying College', cond: '訓練生（自社養成）の採用案内' },
  /* 大韓航空（民間の飛行経歴を持つ新人操縦士の募集／会社のニュース） */
  'korean-air.jobs.followup-agent-f26-application-window': { h: '9bdd81116f8b2748', label: '募集の受付', value: '2026年7月1日から2027年6月30日まで', cond: '民間の飛行経歴を持つ新人操縦士の募集' },
  'korean-air.jobs.followup-agent-f26-selection-trigger': { h: 'c238e5c92e273d38', label: '選考の始まり', value: '応募が決まった人数に達してから選考を始め、本人に知らせる', cond: '民間の飛行経歴を持つ新人操縦士の募集' },
  'korean-air.jobs.followup-agent-f26-training-employment-status': { h: '2beccdbbfd05ddd7', label: '雇用の形', value: '教育のあいだは契約職。試用の操縦士に任命されると正規職', cond: '民間の飛行経歴を持つ新人操縦士の募集' },
  'korean-air.profile.country': { h: '7356bc4640cc6910', label: '本社', value: '韓国' },
  'korean-air.work.missing-training-location': { h: 'd87f23378f9bf5c1', label: '訓練の施設', value: '済州の飛行訓練院・金浦の本社・仁川 永宗島の運航訓練センター', cond: '会社のニュース（2026年5月8日）' },
  /* スターラックス航空（2025年の年次報告書・採用サイト） */
  'starlux.benefits.medical': { h: '6ee9b3e010ee03f1', label: '保険', value: '団体保険と健康診断', cond: '2025年の年次報告書（全社員）' },
  'starlux.benefits.missing-annual-leave': { h: '636a9d60032a95e9', label: '休暇', value: '有給休暇と祝日の休み', cond: '採用サイトの職場の案内（全職種）。日数は書かれていない' },
  'starlux.benefits.pension': { h: 'd9354066e89570d5', label: '年金', value: '法定の年金の積立', cond: '2025年の年次報告書（全社員）' },
  'starlux.benefits.staff-travel': { h: '61320ff6dac86577', label: '社員の航空券', value: '勤めて6か月から、無料と割引の航空券', cond: '2025年の年次報告書（全社員）' },
  'starlux.jobs.followup-agent-f26-cadet-job-city': { h: '757f8bdb50e72dcf', label: '勤務地（訓練生の採用）', value: '桃園', cond: '訓練生の求人' },
  'starlux.jobs.followup-agent-f26-cpl-job-city': { h: '77b68a9c5b8d893d', label: '勤務地（事業用操縦士の資格を持つ人の採用）', value: '台北', cond: '事業用操縦士の資格を持つ人の求人' },
  'starlux.jobs.followup-agent-f26-experienced-flighttime': { h: '225764b053a601a8', label: '応募に要る飛行時間', value: '機長は総飛行3,500時間（うち機長として700時間）、副操縦士は1,500時間（外国の人）・1,000時間（国内の人）', cond: '経験者の機長・副操縦士の募集' },
  'starlux.jobs.missing-entry-open': { h: '83e5b7a4ada1b584', label: '募集の受付', value: '事業用操縦士の資格を持つ人の採用は、いつでも応募できる', cond: '事業用操縦士の資格を持つ人の採用の案内' },
  'starlux.work.p26-cadet-training': { h: '4d29ccf109a1ad24', label: '訓練の場所', value: '米国かオーストラリア', cond: '訓練生（Cadet）の採用の案内' },
  /* チャイナエアライン（会社のCSRの職場の案内・2026年の機師募集の発表） */
  'china-airlines.benefits.missing-annual-leave': { h: 'f0911e48afd449d9', label: '休暇', value: '特別休暇の制度', cond: '会社のCSRの職場の案内（全社員）。日数は書かれていない' },
  'china-airlines.benefits.missing-commuting': { h: 'ad03a540cd93300b', label: '通勤', value: '通勤の交通の制度', cond: '会社のCSRの職場の案内（全社員）。額は書かれていない' },
  'china-airlines.benefits.missing-medical': { h: '7168cb2f360deb7b', label: '保険', value: '団体健康保険', cond: '会社のCSRの職場の案内（全社員）' },
  'china-airlines.benefits.missing-pension': { h: '7a1401350da89187', label: '年金', value: '退職金の積立（新しい制度は6%・古い制度は15%）', cond: '会社のCSRの職場の案内（全社員）' },
  'china-airlines.benefits.missing-staff-travel': { h: '8ec825d593a978b6', label: '社員の航空券', value: '優待の航空券の制度', cond: '会社のCSRの職場の案内（全社員）' },
  'china-airlines.jobs.c26-pilot-plan': { h: '9bc6b6f12c2f0dbe', label: '採用の予定', value: '2026年に160人を超える機師を採用する予定', cond: '会社の発表（2026年3月7日）' },
  'china-airlines.jobs.missing-entry-open': { h: '9cae31a0017e9efd', label: '募集の受付', value: '培訓機師（訓練生）の募集は1年中受け付けている', cond: '会社の発表（2026年3月7日）' },
  'china-airlines.profile.registered-city': { h: '04819c2b32fc467f', label: '本社', value: '桃園市', cond: '台湾 経済部の会社登記の所在地' },
  'china-airlines.work.c26-pilot-training': { h: 'dd0459d86f1f236f', label: '訓練の流れ', value: '社内で業務を見習い、提携の飛行学校で訓練', cond: '培訓機師の募集（2026年3月7日の発表）' },
  'china-airlines.work.followup-agent-f26-cadet-training-countries': { h: 'ce9d0320e37b541b', label: '訓練の場所', value: 'いまは米国・オーストラリア', cond: '機師募集のQ&A' },
  /* タイ国際航空（2025年の年次報告書・2026年の募集） */
  'thai-airways.benefits.missing-medical': { h: '5c0b57f764faf3dc', label: '保険', value: '団体の健康保険・生命保険・事故保険（2026年7月14日までの契約）', cond: '2025年の年次報告書（タイで社員として働く人）' },
  'thai-airways.benefits.missing-pension': { h: 'de385d4e53be006f', label: '年金', value: '積立の退職制度（会社は給与の9%、勤続20年からは10%。本人は2〜15%）', cond: '2025年の年次報告書（全社員）' },
  'thai-airways.benefits.missing-staff-travel': { h: 'ab570f92d1095efd', label: '社員の航空券', value: '社員と家族（配偶者・子・親）に、席の確約された券と空席待ちの券', cond: '2025年の年次報告書（全社員）' },
  'thai-airways.jobs.c26-qualified-degree': { h: '6068cfeebca920d4', label: '応募の条件（学歴）', value: '学士以上（専攻は問わない）', cond: '有資格パイロットの募集（Qualified Pilot 2026）' },
  'thai-airways.jobs.missing-entry-open': { h: '9936c8794abb9325', label: '募集の受付', value: '選考（2026年4月20日の書類の確認・5月9日の筆記試験）は延期。新しい日程は追って案内', cond: '有資格パイロットの募集（Qualified Pilot 2026）' },
  'thai-airways.jobs.p26-sp-close': { h: 'afc610ce247e3ab7', label: '訓練生の募集の受付', value: '2026年3月9日〜31日（締め切った）', cond: '訓練生の募集（Student Pilot 2026）' },
  /* 中国国際航空（2026年の飛行学生の募集要項） */
  'air-china.jobs.followup-agent-cadet-assignment-after-study': { h: '5066727c1873a57d', label: '卒業のあとの配属', value: '飛行の条件を満たした人を、本社か支社・子会社に配属', cond: '2026年の飛行学生の募集要項（2025年11月4日）' },
  'air-china.work.p26-schools': { h: '5fce05084cbecfcc', label: '養成の大学', value: '北京航空航天大学・南京航空航天大学・中国民用航空飛行学院・中国民航大学', cond: '2026年の飛行学生の募集要項（2025年11月4日）' },
  /* 中国東方航空（第二期の飛行人材の募集・会社概要） */
  'china-eastern.jobs.missing-entry-open': { h: '74e5310d176f0400', label: '募集の受付', value: '2026年9月28日から12月31日 23時59分（中国の時刻）まで', cond: '大学卒業者の飛行人材の募集（第二期）' },
  'china-eastern.profile.alliance': { h: '15204ba65b8789ad', label: '航空連合', value: 'スカイチーム' },
  'china-eastern.work.p26-training': { h: '5075261b73338412', label: '訓練の場所', value: '国内の飛行学校か海外の飛行学校', cond: '大学卒業者の飛行人材の募集（第二期）' },
  /* 中国南方航空（2024年の社会責任報告書・深圳支社の調達の公告） */
  'china-southern.benefits.missing-annual-leave': { h: '15534a98da76079a', label: '休暇', value: '有給休暇・帰省の休暇・誕生日の休暇', cond: '2024年の社会責任報告書（全社員）。日数は書かれていない' },
  'china-southern.benefits.missing-medical': { h: '09eb42bc3e4a7f64', label: '保険', value: '基本と補充の医療保険、乗務員の傷害保険、パイロットの保険', cond: '2024年の社会責任報告書' },
  'china-southern.benefits.missing-pension': { h: '07ef8618865b6e14', label: '年金', value: '基本の養老保険と企業年金', cond: '2024年の社会責任報告書（全社員）' },
  'china-southern.benefits.r2-crew-bus-szx-procurement': { h: '8bd4e96b8a8c6528', label: '乗務員の送迎バス', value: '深圳の市内の停留所から空港のターミナルまで', cond: '深圳支社のバスの調達の公告（2026年3月6日）' },
  /* 海南航空（2025年の持続可能性報告書） */
  'hainan-airlines.benefits.missing-medical': { h: '001083aa43213e5e', label: '保険', value: '社員の補充の医療保険と、家族の医療費の補助', cond: '2025年の持続可能性報告書（グループ全体）' },
  'hainan-airlines.benefits.missing-staff-travel': { h: 'c03b757fa03c7364', label: '社員の航空券', value: '社員の割引の航空券と、乗務員・海外に派遣された社員などの帰省の航空券', cond: '2025年の持続可能性報告書（グループ全体）' },
  /* エア・インディア（パイロットの採用案内・訓練生の募集） */
  'air-india.benefits.c26-relocation': { h: 'bdf7f03e923b9725', label: '引っ越しの支援', value: '家財の運送・ホテル・子どもの入学の支援と、1回の転居手当', cond: 'パイロットの採用案内。額は書かれていない' },
  'air-india.benefits.medical': { h: '6f9db1242cfcd1b6', label: '保険', value: '医療保険・ライセンスを失ったときの保障・団体生命保険・傷害の保障', cond: 'パイロットの採用案内' },
  'air-india.benefits.travel': { h: 'efbcb1f9f8884b02', label: '社員の航空券', value: '年に1回の航空券と、回数の制限のない優待の航空券', cond: 'パイロットの採用案内' },
  'air-india.jobs.missing-entry-open': { h: '2ad27d34039fe5af', label: '募集の受付', value: '訓練生の募集のページは次の案内を待つ表示（日程は出ていない）', cond: '訓練生の募集のページ' },
  'air-india.work.c26-cadet-school': { h: 'eaf8019d55e158d3', label: '事業用操縦士の訓練の場所', value: 'アムラバティ（インド）の自社の飛行学校か、米国の提携校2校', cond: '訓練生の募集のページ' },
  'air-india.work.p26-cadet-locations': { h: '33077bf218b7b5a8', label: '飛行訓練の提携校', value: 'フェニックス（AeroGuard）・サンフォード（L3Harris）。地上の訓練はインド', cond: '訓練生のコースの案内' },
  /* エアアジア（グループの採用案内） */
  'airasia.benefits.c26-group-travel': { h: '322814d07c50ffb3', label: '社員の航空券', value: '本人・家族・友人の無料と割引の航空券（会社によって違う）', cond: 'グループの採用案内（全職種）' },
  /* バンブー・エアウェイズ（2025年のA320パイロットの求人・2026年の訓練の覚書） */
  'bamboo-airways.jobs.c26-a320-qualification': { h: '43f209db718d1f53', label: '機長の応募の条件', value: '総飛行4,500時間以上（うちA320で1,500時間）、多人数機の機長1,500時間以上（うちA320で500時間）、定期運送用操縦士', cond: '2025年のA320機長の求人' },
  'bamboo-airways.jobs.location': { h: 'd055d42380a164e1', label: '勤務地', value: 'ハノイ（ノイバイ空港）', cond: '2025年のA320パイロットの求人' },
  'bamboo-airways.jobs.missing-entry-open': { h: 'c74312b4d6250a39', label: '募集の受付', value: '2025年10月1日〜15日（締め切った）', cond: '2025年のA320機長の求人' },
  'bamboo-airways.work.p26-mpl-plan': { h: '65ad63b61bca27f7', label: '訓練の計画', value: 'BAA Training Vietnam と協力し、MPLの訓練の大部分をベトナムで行う予定', cond: '会社の発表（2026年の覚書）。次の募集は当局の承認のあと' },
  /* ガルーダ・インドネシア航空（2025年の年次報告書・採用サイト） */
  'garuda-indonesia.benefits.c26-pilot-retirement': { h: 'f6703106e7108a66', label: '退職の給付', value: '操縦士の退職時の給付の制度', cond: '2025年の年次報告書。率と額は書かれていない' },
  'garuda-indonesia.jobs.followup-agent-public-jobs-snapshot': { h: 'a95f557cd11c5185', label: '募集の受付', value: '会社の求人の一覧に、いま空いている求人は無い', cond: '会社の採用サイトの一覧（2026年10月19日に確認）' },
  /* 香港エクスプレス（パイロットの採用案内・セカンドオフィサーの求人） */
  'hong-kong-express.benefits.c26-relocation': { h: 'c88e05f8bc80c804', label: '引っ越しの支援', value: '転居の支援', cond: 'パイロットの採用案内。額は書かれていない' },
  'hong-kong-express.benefits.medical': { h: '081047822fd7fbcd', label: '保険', value: '医療保険', cond: 'パイロットの採用案内' },
  'hong-kong-express.benefits.travel': { h: '779ecfa1750305f3', label: '社員の航空券', value: '自社・キャセイパシフィック航空・提携会社の便の優待', cond: 'パイロットの採用案内' },
  'hong-kong-express.jobs.followup-agent-f26-secondofficer-job-city': { h: '4bc6e1ec0899b749', label: '勤務地', value: '香港', cond: 'セカンドオフィサーの求人（2025年9月3日に掲載）' },
  'hong-kong-express.jobs.missing-entry-open': { h: '98afa8b043a6421a', label: '募集の受付', value: 'セカンドオフィサーの求人を掲載中（締切の日付は無い）', cond: '会社の求人（2025年9月3日に掲載）' },
  'hong-kong-express.jobs.p26-so-qual': { h: '5e4ef5c02bcb57de', label: '応募の条件', value: '多発機の事業用操縦士と計器飛行の資格（250時間以上）か、認められた一貫コースの事業用操縦士。第1種の身体検査', cond: 'セカンドオフィサーの求人' },
  /* インディゴ（会社の職場の案内） */
  'indigo.benefits.c26-staff-standby': { h: '8f4dce4d9d003b9d', label: '社員の航空券', value: '自社の国内線・国際線の割引の空席待ちの券（回数の制限なし）', cond: '会社の職場の案内（全社員）' },
  'indigo.benefits.medical': { h: '2beadf5d923304e6', label: '保険', value: '医療保険（本人と家族）', cond: '会社の職場の案内（全社員）' },
  'indigo.jobs.pilot-family': { h: '31ec903196fd96b3', label: '社員の家族の採用の道', value: '社員の近親者で、事業用操縦士の資格と型式の限定を持つ人の採用（FamilyFLY）', cond: '会社の職場の案内' },
  'indigo.jobs.pilot-internal': { h: '314b67baa1027d09', label: '社員からパイロットへの道', value: '社内の選考で、副操縦士の候補・訓練生を目指す制度（Fly High）', cond: '会社の職場の案内' },
  /* マレーシア航空（グループの採用ページ） */
  'malaysia-airlines.jobs.c26-application-channel': { h: '74b3e2cbd96f0bdc', label: '応募の方法', value: 'オンラインだけ（求人の検索から職種を選ぶ。求人の無い応募は受け付けない）', cond: 'グループの採用ページ' },
  /* フィリピン航空（採用サイト・社内誌・会社の発表） */
  'philippine-airlines.jobs.followup-agent-pilot-cabin-portal-snapshot': { h: '14332111fca9f984', label: '募集の受付', value: '採用サイトの「パイロットと客室乗務員」の分類に、いま空いている求人は無い', cond: '会社の採用サイト（2026年10月19日に確認）' },
  'philippine-airlines.jobs.p26-ao2026-students': { h: '48fb57bdc029eca0', label: '訓練生の人数（2026年Aクラス）', value: '21人', cond: '社内誌 The PALiner' },
  'philippine-airlines.work.p26-ao2026-location': { h: 'cc6813e95eae2456', label: '訓練の場所', value: 'オーストラリア クイーンズランド州アーチャーフィールドの Airways Aviation の施設（18か月の課程）', cond: '社内誌 The PALiner（2026年Aクラス）' },
  'philippine-airlines.work.training-location': { h: '5fa24ee76a8dcac5', label: '訓練の流れ', value: 'フィリピンで基礎の課程、そのあとオーストラリアの施設', cond: '会社の発表（2025年8月1日・飛行学校の再開）' },
  /* スクート（B787機長（経験者）の募集） */
  'scoot.work.r2d-b787-type-training-bond': { h: 'cb074c0aff4c8d57', label: '型式の訓練の費用', value: '会社が型式の訓練を行う人は、費用の一部を負担し、訓練の拘束（ボンド）を結ぶ', cond: 'B787機長（経験者）の募集（2026年4月30日）。額と年数は書かれていない' },
  'scoot.work.r2d-b787-variable-roster': { h: '75211335199c1ba0', label: '勤務の形', value: '決まった型の無いロスター（会社と規則の要件で組む）', cond: 'B787機長（経験者）の募集（2026年4月30日）' },
  /* ベトジェット（採用サイト） */
  'vietjet.jobs.c26-past-careerday': { h: 'df4d9cf08ea678af', label: '採用イベントの募集', value: 'A320・A321の機長・副操縦士（2025年2月14日〜17日の受付）', cond: '会社の求人（2025年のパイロットの採用イベント）' },
  'vietjet.jobs.followup-agent-pilot-category-snapshot': { h: 'c52ed3201b5ac1a2', label: '募集の受付', value: '採用サイトのパイロットの分類に、いま求人は無い', cond: '会社の採用サイト（2026年10月19日に確認）' },
  /* ベトナム航空（2025年の年次報告書・2019年の記事） */
  'vietnam-airlines.benefits.c26-supplemental-retirement': { h: 'd54fda182680498b', label: '年金', value: '2020年から止めていた補完の退職保険への加入を再開', cond: '2025年の年次報告書（全社員）' },
  'vietnam-airlines.benefits.historical-travel': { h: '8fe628f9e2fb92c5', label: '社員の航空券', value: '自社のID券と、スカイチームの他社の便', cond: '2019年の会社の記事（パイロットの新しい給与の制度）' },
  /* ロイヤルブルネイ航空（A320機長の求人・会社の連絡先） */
  'royal-brunei.base.c26-base': { h: '5ec450ce4e30a428', label: '拠点', value: 'バンダルスリブガワン', cond: 'A320機長の求人' },
  'royal-brunei.benefits.housing': { h: '57ebd1360d625628', label: '住宅の補助', value: '住宅手当', cond: 'A320機長の求人。額は書かれていない' },
  'royal-brunei.benefits.medical': { h: '8c5c90af319567e7', label: '医療の補助', value: '外来の医療費の請求', cond: 'A320機長の求人' },
  'royal-brunei.benefits.travel': { h: 'b3c5aa52eaa89f23', label: '社員の航空券', value: '自社の就航地へのビジネスクラスの航空券', cond: 'A320機長の求人' },
  'royal-brunei.jobs.missing-entry-open': { h: '7722bfc21a2f6217', label: '募集の受付', value: '2026年に入社できるA320機長を募集（すぐに入社できる人が有利）', cond: 'A320機長の求人' },
  'royal-brunei.profile.missing-headquarters-country': { h: '88044241f129f6ae', label: '本社', value: 'ブルネイ' },
  'royal-brunei.work.c26-average-hours': { h: '2f62afb6bc50ece9', label: '機長の飛行時間', value: '月に平均60〜70時間', cond: 'A320機長の求人' },
  'royal-brunei.work.c26-noncommuting': { h: '9e2d217415e900f5', label: '勤務の形', value: '拠点に住んで勤める形（遠くから通う形ではない）', cond: 'A320機長の求人' },
  /* ── 全社へ広げる d1 の続き（2026-10-21）：中東・アフリカの会社（エティハド航空は先行5社）。同じ求人の同じことを言う2つめの行と、
     会社の機材の紹介の行で同じ型式が出ている復帰の行は字を書かない。エミレーツの訓練費の拘束の額は、サイトの通貨の表示を通す道がまだ無いので書かない ── */
  /* エミレーツ航空（副操縦士の給与と待遇の案内・パイロット採用のQ&A） */
  'emirates.benefits.housing-provided': { h: '0fe9281e04b2ff21', label: '住まい', value: '会社が用意する住まい（無料）', cond: '副操縦士の給与と待遇の案内' },
  'emirates.benefits.medical-family': { h: 'cc0359ff926bd240', label: '家族の医療', value: '本人と対象の家族（家族は月に少しの負担）', cond: 'パイロット採用のQ&A' },
  'emirates.benefits.provident-employee': { h: '4e3e2e75136cd63d', label: '積立の年金（本人）', value: '月の基本給の5%', cond: '副操縦士の給与と待遇の案内' },
  'emirates.benefits.provident-employer': { h: '9ca7a0948e56bb7f', label: '積立の年金（会社）', value: '月の基本給の12%（最初の10年）', cond: '副操縦士の給与と待遇の案内' },
  'emirates.benefits.provident-later': { h: '805ac83b270aad61', label: '積立の年金（会社・勤続10年から）', value: '月の基本給の15%', cond: 'パイロット採用のQ&A' },
  'emirates.benefits.resume-provident-vesting': { h: 'ad69f6906f2f4137', label: '会社の積立の受け取り', value: '加入3年以上5年未満で75%、5年で100%', cond: 'パイロット採用のQ&A' },
  'emirates.benefits.staff-family': { h: '2d2dd317adeec714', label: '社員の航空券', value: '本人と家族に年1回、席の確約された休暇の往復の航空券と、優待の航空券', cond: 'パイロット採用のQ&A' },
  'emirates.benefits.transport-provided': { h: '0f318b895a8c499b', label: '通勤', value: '会社の送迎（ドバイの中）', cond: 'パイロット採用のQ&A' },
  'emirates.work.roster-days-off': { h: 'e86dd1d142c058c3', label: '休日', value: '連続28日で7日以上、連続30日で8日以上（3つの期間の平均）', cond: 'パイロット採用のQ&A' },
  'emirates.work.training-city': { h: 'c8b7819889de4c2d', label: '訓練の場所', value: 'ドバイ', cond: 'パイロット採用のQ&A（入社の訓練）' },
  /* カタール航空（ボーイングの型式を持つ副操縦士の求人・訓練生の採用案内） */
  'qatar-airways.jobs.followup-boeing-jobcity': { h: 'db13a56e62f9616b', label: '勤務地', value: 'ドーハ', cond: 'ボーイングの型式を持つ副操縦士の求人' },
  'qatar-airways.jobs.missing-entry-open': { h: 'a7aa74bde6cff272', label: '募集の受付', value: 'ボーイングの型式を持つ副操縦士を募集中（2027年1月31日締切）', cond: '会社の求人（2026年10月19日に確認）' },
  'qatar-airways.jobs.publication-boeing-fo-requirements': { h: 'e45fdb812aff2d7a', label: '応募の条件', value: '多人数で操縦するジェット旅客機で1,000時間以上（うち指定のボーイング機で500時間以上）、直近12か月にその型式で乗務、定期運送用操縦士の資格と計器飛行、第1種の身体検査', cond: 'ボーイングの型式を持つ副操縦士の求人' },
  'qatar-airways.work.r2-cadet-guarantor-repayment': { h: '4d83d0b401f7b15e', label: '奨学金の保証人', value: 'カタール国籍の保証人が要る。不合格・辞退・決まった勤務の前の退職では、奨学金の費用を返す', cond: 'カタール国籍の人の訓練生（Cadet）の奨学金の案内' },
  'qatar-airways.work.resume-cadet-service': { h: '1dff41f6cb6ddc3f', label: '勤続の約束', value: '副操縦士になってから5年以上', cond: '訓練生（Cadet）の採用の案内' },
  /* ガルフ・エア（A320の型式を持つ副操縦士の求人） */
  'gulf-air.benefits.missing-medical': { h: '0e6bb63c8b18a1e0', label: '保険', value: '本人と対象の家族の医療保険', cond: 'A320の型式を持つ副操縦士の求人（GF1972）' },
  'gulf-air.benefits.missing-staff-travel': { h: '48775484eb6a9b04', label: '社員の航空券', value: '旅行の優待', cond: 'A320の型式を持つ副操縦士の求人（GF1972）。内容は書かれていない' },
  'gulf-air.jobs.followup-gf1972-hours': { h: 'b6349d0b6a4fac83', label: '応募に要る飛行時間', value: '総飛行1,500時間（うちA320で250時間・多人数のジェット機で500時間）か、総飛行700時間（うちA320で500時間）', cond: 'A320の型式を持つ副操縦士の求人（GF1972）' },
  'gulf-air.jobs.missing-entry-open': { h: '98dd88ac25992497', label: '募集の受付', value: 'A320の型式を持つ副操縦士を募集中（2026年12月31日締切）', cond: '会社の求人（2026年10月19日に確認）' },
  'gulf-air.jobs.publication-gf1853-history': { h: '848d00be3d30c1c3', label: '前の募集', value: 'A320の型式を持つ副操縦士（GF1853・2026年1月1日に締め切った）', cond: '会社の求人' },
  /* クウェート航空（会社の採用ページ） */
  'kuwait-airways.jobs.r2-openings-none': { h: 'ccf913ede5e78358', label: '募集の受付', value: '会社の採用の一覧に、いま空いている求人は無い', cond: '会社の採用ページ（2026年10月19日に確認）' },
  /* オマーン航空（会社の採用ページ） */
  'oman-air.benefits.resume-medical-family': { h: 'd1edcc5d7abb50c6', label: '保険', value: '社員と家族の医療・生命・障害・視力の保険', cond: '会社の採用ページ（全社員）' },
  'oman-air.benefits.resume-staff-travel': { h: '0a35d15b9d1d9bcb', label: '社員の航空券', value: '社員と家族の旅行の優待', cond: '会社の採用ページ（全社員）' },
  'oman-air.jobs.resume-pilot-pathways': { h: '9a3507c64fbcc3ee', label: '採用の道', value: '訓練生（Cadet）と、経験者の機長', cond: '会社の採用ページ' },
  /* リヤド航空（B787の経験者の機長の求人） */
  'riyadh-air.jobs.missing-entry-open': { h: 'd9f8ea1fa645c833', label: '募集の受付', value: 'B787の経験者の機長を募集中', cond: '会社の求人（2026年10月19日に確認）' },
  'riyadh-air.jobs.resume-dec-minimum': { h: 'c6ff3ee1a296e18f', label: '機長の応募の条件', value: '多人数・多発機で6,000時間以上（うちワイドボディ機の機長で2,000時間）、直近12か月に機長で150時間', cond: 'B787の経験者の機長の求人' },
  'riyadh-air.work.resume-dec-roster': { h: '6b87ee39bafe1d01', label: '機長の勤務の形', value: 'フルタイムのほか、条件を満たせば暮らしに合わせたロスターも選べる', cond: 'B787の経験者の機長の求人（リヤド拠点）' },
  /* ロイヤル・ヨルダン航空（A320機長の求人・訓練生の採用案内） */
  'royal-jordanian.jobs.r3-a320-cap-open-5496790': { h: '36c1d6275eaeeb04', label: '募集の受付', value: 'A320の型式を持つ機長を募集中（2026年12月18日締切）', cond: '会社の求人（2026年10月19日に掲載）' },
  'royal-jordanian.jobs.resume-cadet-eligibility': { h: 'f77caa8badbaa543', label: '訓練生の応募の条件', value: 'ヨルダン国籍、事業用操縦士と計器飛行・定期運送用操縦士の学科・MCC', cond: '訓練生（Cadet）の採用の案内' },
  'royal-jordanian.jobs.resume-campaign-timing': { h: '2f5663f114cda701', label: '訓練生の選考', value: '会社の必要に応じて、選考の回を取りやめたり日程を変えたりする', cond: '訓練生（Cadet）の採用の案内' },
  /* サウディア（訓練生の求人） */
  'saudia.jobs.cadet-hours': { h: 'da307ce490bf7b45', label: '訓練生の応募に要る飛行時間', value: '240時間以上（うち多発機で25時間）', cond: '訓練生（Cadet Program）の求人（2026年10月17日）' },
  'saudia.jobs.resume-cadet-now': { h: '860b9ca5da21a733', label: '募集の受付', value: '訓練生（Cadet Program）を募集中（サウジアラビア国籍の人だけ）', cond: '会社の求人（2026年10月17日に掲載）' },
  /* エジプト航空（訓練中のパイロットの求人・訓練施設の案内） */
  'egyptair.benefits.missing-commuting': { h: 'cecbe952ce8f9145', label: '通勤', value: '無料の送迎', cond: '訓練中のパイロットの求人（A-31/2026）' },
  'egyptair.benefits.missing-medical': { h: '3d591c7d3e978b56', label: '保険', value: '本人と家族の医療保険', cond: '訓練中のパイロットの求人（A-31/2026）' },
  'egyptair.jobs.followup-a31-qualification': { h: '32dfc155ffc12c40', label: '応募の条件', value: 'エジプト国籍、2026年8月30日に30歳以下、エジプト民間航空局が認める事業用操縦士か定期運送用操縦士、英語の能力（ICAO 5）', cond: '訓練中のパイロットの求人（A-31/2026）' },
  'egyptair.jobs.missing-entry-open': { h: '8bbaedda444933cd', label: '募集の受付', value: '訓練中のパイロット（A-31/2026）を募集中（2026年11月1日締切）', cond: '会社の求人（2026年9月15日に掲載）' },
  'egyptair.work.missing-training-location': { h: '051301f950ae39ba', label: '訓練の場所', value: 'カイロ国際空港の EGYPTAIR Training Academy', cond: '訓練施設の案内' },
  /* エチオピア航空（外国人の機長の募集・訓練施設の案内） */
  'ethiopian-airlines.benefits.resume-annual-leave': { h: '2ac45b037baa17f7', label: '休暇', value: '有給の年次休暇', cond: '外国人の機長の募集。日数は書かれていない' },
  'ethiopian-airlines.benefits.resume-bonus': { h: '4385c6ce18b1e297', label: '賞与', value: '年1回の賞与', cond: '外国人の機長の募集。額は書かれていない' },
  'ethiopian-airlines.benefits.resume-housing': { h: 'ddadfaf105a23822', label: '住宅の補助', value: '住宅手当', cond: '外国人の機長の募集。額は書かれていない' },
  'ethiopian-airlines.benefits.resume-insurance': { h: 'ddf84871cd310a46', label: '保険', value: '医療保険と傷害保険', cond: '外国人の機長の募集' },
  'ethiopian-airlines.benefits.resume-tickets': { h: 'f8b61264b7d2915a', label: '社員の航空券', value: 'ビジネスクラスの航空券', cond: '外国人の機長の募集。回数は書かれていない' },
  'ethiopian-airlines.benefits.resume-transport': { h: 'b874da8ec78338b5', label: '通勤', value: '無料の送迎', cond: '外国人の機長の募集' },
  'ethiopian-airlines.jobs.resume-captain-open': { h: '6157377566ce624e', label: '募集の受付', value: '外国人の機長を募集中（3つの機材のグループ）', cond: '会社の募集のページ' },
  'ethiopian-airlines.work.missing-training-location': { h: '6cee23024281fb5c', label: '訓練の場所', value: 'アディスアベバのボレ国際空港の Ethiopian Aviation Academy', cond: '訓練施設の案内' },
  /* ケニア航空（2024年の報告書） */
  'kenya-airways.benefits.publication-general-dc': { h: '6b3fea2f5933e002', label: '年金', value: '社員の積立の年金（確定拠出。正社員は加入）', cond: '2024年の報告書（全社員）' },
  'kenya-airways.benefits.publication-general-medical': { h: 'c6b90ff974e1972f', label: '保険', value: '医療の制度と育児の休暇', cond: '2024年の報告書（全社員）' },
  /* 南アフリカ航空（パイロット採用の案内） */
  'south-african-airways.jobs.resume-pilot-qualification': { h: '2a5e9ade9a5dc290', label: '応募の条件', value: '南アフリカの定期運送用操縦士（学科合格を含む）、多発機の計器飛行、第1種の身体検査、1,500時間以上（うち多発機で200時間）', cond: '会社のパイロット採用の案内' },
  /* ── 空港までの移動（暮らしの街の行）。mode ＝ 電車・バスの札 ── */
  'qantas.living.pub-bne-transport': { h: 'a915a8178c8e4f8c', mode: 'train', label: 'Airtrain：ブリスベン中心部（Central 駅）→ 空港', value: '平日 4:31〜21:31・土日祝 5:40〜21:31（15〜30分おき）' },
  'qantas.living.pub-mel-transport': { h: '353050f3935ac078', mode: 'bus', label: 'SkyBus：サザンクロス駅 ⇄ メルボルン空港', value: '市内と空港を結ぶ City Express を運行' },
  'qantas.living.pub-syd-transport': { h: '9ec22f1f80a46bca', mode: 'train', label: '電車（T8 Airport & South Line）：市内 → シドニー空港', value: '毎日 5時〜24時に運行' },
  'qantas.living.pub-syd-transport-n20-bus': { h: '8a24a6f484e2c48e', mode: 'bus', label: '深夜バス N20：市内 → シドニー空港（国際線ターミナル経由）', value: '0時〜4時に運行' },
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
});
/* 同じ資料（住所）を、会社ごとの台帳の行がちがう題で書いているときの1つの名前（全社へ広げる d1・2026-10-21）。
   国土技術政策総合研究所の空港の一覧は「（名称・3レター対応のみ）」「リンク／」のような調べた側の書き足しで題が割れていた。
   資料の ID ごとの名前（SOURCES）が在ればそちらが先。 */
export const SOURCE_URL = Object.freeze({
  'https://www.ysk.nilim.go.jp/kakubu/kukou/sisetu/links.html': '国土交通省 国土技術政策総合研究所「空港最寄震度観測点一覧」',
});

/* ── 就航地（NET）── 調べで確かめた就航地の一覧（会社全体の就航地とは限らない）。
   basis … 何の一覧か（出典の「条件」に出す1行）。h … まとめた行ぜんぶの指紋（digest）。 */
export const NET = Object.freeze({
  /* 2026-10-21 a2：茨城（IBR）・下地島（SHI）の行が入った（空港の呼び名を足したため）── どちらも同じ夏ダイヤの時刻表の行。basis はそのまま正しい */
  skymark: { h: '4862cf7b58b503ef', basis: '2026年夏ダイヤ（6月1日〜10月24日）の時刻表で、スカイマークが自社便を飛ばしている空港。拠点の空港は入れていません。' },
  /* ⚠️ いまの台帳の行は SYD の1つだけで、SYD はカンタスの拠点（本拠地は一覧に入れない）── 画面には就航地の一覧が出ない（2026-10-21）。 */
  qantas: { h: '965d1d7ace2efd6f', basis: 'カンタス航空の機材の紹介（A321XLR）に行き先として載っている空港' },
  /* 全社へ広げる d1（2026-10-21）：日本の会社。拠点の分かる会社だけ（拠点の空港を就航地として並べない ── 拠点の行が台帳に無い
     スプリング・ジャパン・北海道エアシステム・ジェイエア・日本トランスオーシャン航空・オリエンタルエアブリッジ・琉球エアーコミューター・
     新中央航空は、拠点が分かるまで一覧を出さない）。 */
  'zipair': { h: 'f251284f4ea688c9', basis: 'ZIPAIR の基本情報（運航路線）に、自社の定期便の行き先として載っている空港。拠点の空港は入れていません。' },
  'jetstar-japan': { h: 'b44f15f72cb27c79', basis: '2026年夏期の運航スケジュール（2026年1月27日の発表）に載っている空港。拠点の空港は入れていません。' },
  'peach': { h: '8939c481e9c38f32', basis: 'Peach の路線・時刻表に載っている空港（運休中と書かれた空港は入れていません）。拠点の空港は入れていません。' },
  'solaseed': { h: '200dbe001e75a1e2', basis: 'ソラシドエアの時刻表・就航路線に載っている空港。拠点の空港は入れていません。' },
  'airdo': { h: 'aef2e57fbcfdca07', basis: 'AIRDO の運航路線・就航地の案内に載っている空港。拠点の空港は入れていません。' },
  'starflyer': { h: 'e04fff1794cdabec', basis: 'スターフライヤーの国内線時刻表に載っている空港。拠点の空港は入れていません。' },
  'fda': { h: '6860021335ac57a7', basis: 'FDA の路線・時刻表（2026年3月29日〜10月24日）に載っている空港。拠点の街（名古屋・静岡）の空港は入れていません。' },
  'amx': { h: '1c8913d248204ef2', basis: '天草エアラインの時刻表の案内に載っている空港。拠点の空港は入れていません。' },
  'ana-wings': { h: '48e6cbd564e73ff5', basis: 'ANAウイングスの機材・路線図に、出発する空港として載っている空港。拠点の空港は入れていません。' },
  'daiichi-air': { h: 'f4461da6ccc8a4e5', basis: '第一航空の沖縄離島便の案内（2026年10月の運航のお知らせ）に載っている空港。拠点の空港は入れていません。' },
  'ibex': { h: '4f5c0cc345e93aec', basis: 'IBEXエアラインズの路線図（出発・到着の空港の一覧）に載っている空港。拠点の空港は入れていません。' },
  'jac': { h: 'd95b587e71d6889a', basis: '日本エアコミューターの運航路線図に載っている空港。拠点の空港は入れていません。' },
  'toho-air': { h: '6aaf482380403988', basis: '東京愛らんどシャトルの週間時刻表に載っている発着地。拠点の街（東京）の空港は入れていません。' },
  /* 全社へ広げる d1 の続き（2026-10-21）：アジアの会社。拠点の分かる会社だけ（シンガポール航空・アシアナ航空・香港エクスプレス・スクートなどは
     就航地の行が台帳に在っても、拠点の行が無い ── 拠点が分かるまで一覧を出さない）。ロイヤルブルネイ航空は拠点の街（バンダルスリブガワン）は
     分かるが、その街の空港が空港の呼び名の表（PLACES）に無い ＝ 拠点の空港を一覧から外せると確かめられないので、一覧を出さない。 */
  'china-eastern': { h: '4642bffece3e697b', basis: '中部国際空港の国際線の時刻表（2026年10月1日〜24日）に、中国東方航空の便が載っている空港。拠点の街（上海）の空港は入れていません。' },
});

/* ── 暮らしの街（CITY）── 調べの台帳の街（拠点の空港ごと）。先行5社の台帳に在る街（東京など）はここに書かない（そちらを使う）。
   rents … 家賃の行の ID（間取りの鍵ごと）。h … 家賃と移動の行ぜんぶの指紋（digest）。
   per   … 家賃の期間（資料の表が週あたり ＝ 'week'。台帳の per 欄には週が無いので、ここで言う）。
   measure … 何の額か（カードの見出しに入る短い字）。site … 資料の名前（短く）。
   scope … 数字の範囲の断り（出典の「条件」に出す1行。資料の区域・何の物件か・間取りの数え方）。 */
export const CITY = Object.freeze({
  brisbane: { h: 'fea01c5db19eb55c', ja: 'ブリスベン', en: 'Brisbane', iata: 'BNE', airport: 'ブリスベン空港',
    measure: '新規契約の家賃の中央値', site: 'クイーンズランド州 住宅賃貸局', per: 'week',
    scope: 'ブリスベン市（City of Brisbane）の区域で、新しく結ばれたアパート（flat）の賃貸契約の家賃の中央値。1-Bed・2-Bed は寝室の数' },
  melbourne: { h: '0955d463f69ccc37', ja: 'メルボルン', en: 'Melbourne', iata: 'MEL', airport: 'メルボルン空港' },
  sydney: { h: '0b22d3faad7e3382', ja: 'シドニー', en: 'Sydney', iata: 'SYD', airport: 'シドニー空港',
    measure: '新規契約の家賃の中央値', site: 'ニューサウスウェールズ州 地域社会・司法省', per: 'week',
    scope: 'シドニー市（City of Sydney）の区域で、新しく結ばれたアパート・ユニットの賃貸契約の家賃の中央値（シドニー都市圏ぜんたいの数字ではない）。1-Bed・2-Bed は寝室の数' },
  /* 全社へ広げる d1（2026-10-21）：日本の会社の拠点の街（先行5社の台帳の東京ではない街）。どれも LIFULL HOME'S の区・市の家賃相場（1つの街に1つの資料）。
     家賃の行の無い街（石垣・天草）は字だけ（今までの「家賃の資料を確認できていません」）。 */
  izumisano: { h: '5ca9ff1264e569e8', ja: '泉佐野市', en: 'Izumisano', iata: 'KIX', airport: '関西国際空港',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month',
    scope: '泉佐野市の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK' },
  kitakyushu: { h: '762e7d1eec0505f9', ja: '北九州市小倉北区', en: 'Kokurakita, Kitakyushu', iata: 'KKJ', airport: '北九州空港',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month',
    scope: '北九州市小倉北区の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK・3-Bed は 3LDK' },
  nagoya: { h: 'c2c8b21e02b0efc1', ja: '名古屋市中区', en: 'Naka, Nagoya', iata: 'NGO', airport: '中部国際空港',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month',
    scope: '名古屋市中区の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK・3-Bed は 3LDK' },
  fukuoka: { h: 'e03a883ce7f6f25c', ja: '福岡市博多区', en: 'Hakata, Fukuoka', iata: 'FUK', airport: '福岡空港',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month',
    scope: '福岡市博多区の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK・3-Bed は 3LDK' },
  itami: { h: 'efdd19276bf20ca8', ja: '伊丹市', en: 'Itami', iata: 'ITM', airport: '大阪国際空港（伊丹）',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month',
    scope: '伊丹市の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK・3-Bed は 3LDK' },
  naha: { h: '831abc915bc77d47', ja: '那覇市', en: 'Naha', iata: 'OKA', airport: '那覇空港',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month',
    scope: '那覇市の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK・3-Bed は 3LDK' },
  ishigaki: { h: '582a6c7fc9060fcc', ja: '石垣', en: 'Ishigaki', iata: 'ISG', airport: '石垣空港' },
  sendai: { h: '99bde90fd1c6cb94', ja: '仙台市宮城野区', en: 'Miyagino, Sendai', iata: 'SDJ', airport: '仙台空港',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month',
    scope: '仙台市宮城野区の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK・3-Bed は 3LDK' },
  kirishima: { h: '779f18916758fbb7', ja: '霧島市', en: 'Kirishima', iata: 'KOJ', airport: '鹿児島空港',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month',
    scope: '霧島市の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK' },
  kobe: { h: 'c881442b4d3c5595', ja: '神戸市中央区', en: 'Chuo, Kobe', iata: 'UKB', airport: '神戸空港',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month',
    scope: '神戸市中央区の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK・3-Bed は 3LDK' },
  niigata: { h: 'f3e36e60e36624a8', ja: '新潟市中央区', en: 'Chuo, Niigata', iata: 'KIJ', airport: '新潟空港',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month',
    scope: '新潟市中央区の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK・3-Bed は 3LDK' },
  sapporo: { h: 'dec0087a282c5553', ja: '札幌市東区', en: 'Higashi, Sapporo', iata: 'OKD', airport: '札幌丘珠空港',
    measure: '家賃相場', site: 'LIFULL HOME\'S', per: 'month',
    scope: '札幌市東区の家賃相場（LIFULL HOME\'S が掲載物件のデータから独自に出した額。管理費・駐車場代は含まない。成約した家賃ではない）。Studio は 1K・1-Bed は 1LDK・2-Bed は 2LDK・3-Bed は 3LDK' },
  amakusa: { h: '02ffea6efac5f756', ja: '天草', en: 'Amakusa', iata: 'AXJ', airport: '天草空港' },
});

/** 行の並びの指紋（ID と h。並びに依らない）。NET・CITY の h はこれ。 */
export const digest = rows => crypto.createHash('sha256').update(rows.map(r => `${r.id}:${r.h}`).sort().join('\n')).digest('hex').slice(0, 16);

/** 資料の名前。無ければ台帳の 発行元「題」（引用として）。 */
export function srcName(s) {
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

/**
 * 1行を画面の字にする。言えないとき（ITEM にも LINES にも無い・LINES が古い）は null。
 *   { label, value, cur, cond, lead, tag, fleet, mode }
 *   value が通貨つきの額のときは value ＝ 数・cur ＝ 通貨・per ＝ 月か年（画面は「月 ZAR 4,000」と円の目安）。
 */
export function say(r) {
  const L = LINES[r.id];
  if (L && L.h !== r.h) return null;                       // 古い字は出さない（書き直すまで）
  const tag = TAG[r.use] || '';
  if (L) {
    if (L.fleet) return { fleet: L.fleet, label: L.fleet, value: '', cond: '', tag, lead: false };
    const v = L.value || itemValue(r);
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
/** 古い字・名前の無い資料（store ＝ 調べの台帳）。[{ what, id, why }]。 */
export function check(store) {
  const bad = [];
  const words = [...Object.entries(LINES).flatMap(([id, L]) => [L.label, L.value, L.cond, L.fleet].map(t => [id, t])),
    ...Object.entries(SOURCES), ...Object.entries(SOURCE_URL), ...Object.entries(AGREEMENTS).flatMap(([id, A]) => [[id, A.name], [id, A.cond]]), ...Object.entries(NET).map(([id, N]) => [id, N.basis]),
    ...Object.entries(CITY).flatMap(([id, C]) => [C.ja, C.measure, C.site, C.airport, C.scope].map(t => [id, t])), ...Object.entries(ITEM).map(([id, I]) => [id, I.label])];
  for (const [id, t] of words) for (const w of NEVER) if (typeof t === 'string' && t.includes(w)) bad.push({ what: 'NEVER', id, why: `「${w}」を字に入れない（${t}）` });
  const byId = new Map();
  for (const F of Object.values(store.FACTS || {})) for (const rows of Object.values(F)) for (const r of rows || []) byId.set(r.id, r);
  for (const N of Object.values(store.NETWORK || {})) for (const r of N.list || []) byId.set(r.id, r);
  for (const L of Object.values(store.LIVING || {})) for (const k of ['rents', 'commute', 'towns']) for (const r of L[k] || []) byId.set(r.id, r);
  for (const [id, L] of Object.entries(LINES)) {
    const r = byId.get(id);
    if (!r) bad.push({ what: 'LINES', id, why: '台帳に無い行' });
    else if (r.h !== L.h) bad.push({ what: 'LINES', id, why: `台帳の行が変わった（${L.h} → ${r.h}）── 字を書き直して h を付け直す` });
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
  console.log(bad.length ? `❌ airline-display: ${bad.length}件` : `✅ airline-display: LINES ${Object.keys(LINES).length}行・NET ${Object.keys(NET).length}社・CITY ${Object.keys(CITY).length}街・資料の名前 ${Object.keys(SOURCES).length}件（どれも台帳の今の行と合っている）`);
  process.exit(bad.length ? 1 : 0);
}
