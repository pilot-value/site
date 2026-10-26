/* pv-airline-view.mjs — 新しい会社ページ（主要5社と、airline-rollout.mjs の SWITCH に足した会社）が読む、ただ1つのデータの読み口。
 *
 *   viewOf(slug) … 1社ぶんを、ページがそのまま並べられる形で返す（先行5社 ＝ 下の6つの台帳／ほかの会社 ＝ rolloutView）
 *   scaleOf(slug) … 棒の目盛の右端（万円）。1社に1本・0 から始まる（決まった上限は持たない ── 下の「棒の目盛」）
 *
 * ここは**つなぐだけ**で、数字を持たない。出どころは次の6つ。
 *   年収の正本          salary-data.mjs（SALARY）
 *   年収の根拠の台帳    salary-basis.mjs（BASIS・figures）
 *   会社の事実          airline-facts.mjs（JAL・ANA・キャセイ・エバー）／career-facts.mjs（エティハド）
 *   拠点の街            living-facts.mjs（東京・香港・台北）／career-facts.mjs（アブダビ）
 *   写真                airline-photos.mjs
 *   色と略号            airlines-meta.js
 *
 * ★ 年収の欄を「確認中」にしない。どの職位にも**推定年収を額で出す**。
 *   オーナーのご指示 ── 2026-09-30「確認中じゃなくて推定とかにすりゃいいじゃん」／
 *   2026-10-01「基本全て推定でいいじゃん」／2026-10-06「年収のところ確認中にするなよ」。
 *   2026-10-05 の初稿は、根拠・算出方法・時点の3つがそろわない職位を「確認中」と出していた（＝ 5社10職位のうち9つ）。
 *   それは上のご指示に反していた。⚠️ est を null にする枝を戻さない。
 *
 * ★ 棒にするのは推定年収だけ（2026-10-06「並べるならなぜ同じ基準で並べない？」）。
 *   est      推定年収          … 額は SALARY の avg。どの職位にも必ず在る。棒はこれ1種類
 *                                 backed ＝ 根拠・算出方法・時点の3つが台帳にそろっているか（説明に添えるかどうかだけを決める）
 *   cap      求人の上限        … 棒にしない。「〜」と「上限」の字を必ず一緒に出す
 *   company  会社の公表額      … 棒にしない。対象と時点つき
 *   crew     乗員全体の公表平均 … ★どの会社のページにも出さない（2026-10-21 P12.77 オーナー「機長、副操縦士のわかないと意味ないじゃん」）。
 *                                 crew はいつも空。その額の話をしている注と、その額だけの出どころも外す（CREW_ONLY）
 *   ⚠️ 下の3つを est へ流し込まない／est を下の3つの名前で出さない（種類が違う）。
 *   ⚠️ 幅（lo〜hi）は出さない（2026-09-30 に公開の画面から外した）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SALARY } from './salary-data.mjs';
import { BASIS, figures, man } from './salary-basis.mjs';
import { JPY_PER } from './fx-rates.mjs';
import { FACTS as CO, valueText, whenText, introText as coIntro, EN as CO_EN, introTextEn as coIntroEn } from './airline-facts.mjs';
import { FACTS as EYF, introText as eyIntro, EN as EY_EN, introTextEn as eyIntroEn, twinOf, valueTextEn, atTextEn, UNIT_EN, JA_CHARS } from './career-facts.mjs';
import { LIVING, CITY_OF, ABUDHABI, SITES, FAMILY, MODES, BAR_STATS, EN as LV_EN } from './living-facts.mjs';
import { primary } from './airline-photos.mjs';
import { axisEnd } from './pv-bars.mjs';
import { LEAD, SWITCH, researchFacts, researchNetwork, researchCities } from './airline-rollout.mjs';
import { REGIONS, PLACES, networkOf, placeCountry } from './airline-destinations.mjs';
import { countryEn } from './airline-display.mjs';
import { AIRLINE_COUNTRY, BY_CODE } from './airline-countries.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

/* ── 英語の読み口（2026-10-23 英語の EN-6）──────────────────────────────────
   viewOf(slug, 'en') は、日本語と同じ形・同じ並び・同じ数字で、画面の字だけを英語にして返す（英語の会社ページ en/airlines/ が読む）。
   ★日本語（viewOf(slug) ＝ 'ja'）は1文字も変えない ── 下の tx('ja') は今までの読み方そのもの。
   ★字の英語は、台帳ごとの英語の対（airline-facts.mjs・career-facts.mjs・living-facts.mjs の EN ＝ EN-1）と、ここで持つ英語の対（VIEW_EN ＝
     この読み口が自分で組む字と、年収の根拠の台帳 salary-basis.mjs で英語の欄がまだ無い字）からだけ。対の無い字は英語のページに出さず、止める
     （日本語の字を英語のページへ黙って流さない）。調べの台帳の会社の字は airline-rollout.mjs の researchFacts(…, 'en')（対の無い行は出さない）。
   ★額は日本語と同じ円の字（¥3,700万・22.02万円）のまま返す ── 英語のページでは生成器がドルの span に焼く（cur-core.mjs の bakeText）。
     「約」は英語の字ではないので ≈ に、範囲の「〜」は – にする（どちらも通貨切替が額として読む形）。 */
/* この読み口が組む字と、salary-basis.mjs に英語の欄の無い字の英語（日本語の字 → 英語）。使われない行・対の無い字は check() が赤くする。 */
export const VIEW_EN = Object.freeze({
  /* 職位の推定に添える短い前提（FIG） */
  'A320・月75時間の乗務が前提': 'Assumes an A320 and 75 flying hours a month',
  '目標の飛行時間を飛んだ場合の額（保証額ではありません）': 'What you reach by flying the target hours (not a guaranteed amount)',
  '公表されているのは下限だけ': 'Only the lower bound is published',
  '外から採用する副操縦士（4年契約）の条件。手当・補助は別': 'Terms for first officers hired from outside (four-year contract). Allowances and subsidies are extra',
  /* エティハドの求人・暮らしの字 */
  '機長・副操縦士の求人の待遇欄': 'Benefits section of the captain and first officer vacancies',
  '募集家賃の平均': 'Average asking rent',
  '出どころの表は1年あたりの額。ここでは12で割って、1か月あたりにしている': 'The source table gives yearly amounts; here they are divided by 12 to show a month',
  /* 運営会社の運賃・時間の表の中身の呼び名（PART） */
  '第1ターミナル駅': 'Terminal 1 station', '第2ターミナル駅': 'Terminal 2 station', '第3ターミナル駅': 'Terminal 3 station',
  '第1・第2ターミナル駅': 'Terminal 1 and 2 station', '運賃': 'Fare', 'ライナー料金': 'Liner surcharge',
  /* salary-basis.mjs の税の欄（tax）── 英語の欄がまだ無い */
  '課税（日本）': 'Taxed (Japan)', '課税（香港）': 'Taxed (Hong Kong)', '課税（台湾）': 'Taxed (Taiwan)', '課税（シンガポール）': 'Taxed (Singapore)',
  '課税（韓国・6〜45%）': 'Taxed (South Korea, 6–45%)', '課税（タイ）': 'Taxed (Thailand)', '課税（インド）': 'Taxed (India)', '課税（中国）': 'Taxed (China)',
  '課税（マレーシア）': 'Taxed (Malaysia)',
  '非課税（UAE に個人所得税なし）': 'Tax-free (no personal income tax in the UAE)',
  '非課税（バーレーンに個人所得税なし）': 'Tax-free (no personal income tax in Bahrain)',
  '非課税（カタールに個人所得税なし）': 'Tax-free (no personal income tax in Qatar)',
  '非課税（サウジアラビアに個人所得税なし）': 'Tax-free (no personal income tax in Saudi Arabia)',
  '課税（王令 56/2025。2028年初から課税所得の5%・年 OMR 42,000 が基準額）': 'Taxed (Royal Decree 56/2025: from early 2028, 5% of taxable income above OMR 42,000 a year)',
  /* salary-basis.mjs の出どころの時点（as_of の頭 ── 画面に出る形）*/
  '発行日の記載なし': 'No publication date given',
  '2026年1月時点': 'As of January 2026',
  '2024年1月28日': '28 January 2024', '2024年2月6日': '6 February 2024', '2024年1月30日': '30 January 2024',
  '2005年（著作権表記）・保存 2006-03-16': '2005 (copyright line), archived 16 March 2006',
  '発行日・適用時点の記載なし': 'No publication or effective date given',
  'ページに日付の記載が1つも無い': 'No date anywhere on the page',
  '2026年3月期': 'Fiscal year ended March 2026', '2025年3月期': 'Fiscal year ended March 2025', '2024年3月期': 'Fiscal year ended March 2024',
  '給与欄に「2026年度予定（2026年3月16日更新）」': 'The pay section says “planned for FY2026 (updated 16 March 2026)”',
  '給与欄に「※2026年3月27日時点」': 'The pay section says “as of 27 March 2026”',
  '2025年3月31日現在': 'As of 31 March 2025',
  '掲載時点の記載なし': 'No posting date given',
  'ページ冒頭に「募集は終了しております。前回分を参考までに掲載します。」': 'The page opens by saying the intake has closed and the previous round is shown for reference',
  'ページ冒頭に「2023年度採用選考は終了いたしました。」': 'The page opens by saying the FY2023 selection has closed',
  /* salary-basis.mjs の出どころの資料の名前（日本語の題・英語の欄がまだ無い。資料自身の題は “…” の中で英語に）*/
  'Our teams / Pilot（First Officer パネル）': 'Our teams / Pilot (First Officer panel)',
  'Careers / Job openings / Pilots（en-global 版）': 'Careers / Job openings / Pilots (en-global edition)',
  '労使合意（正駕駛 月13,500元ほかの引き上げ・今周刊の報道で確認）': 'Labour–management agreement (captain pay up NTD 13,500 a month and other rises, confirmed in a Business Today report)',
  '【長榮不罷工內幕2】正機師年薪480萬起跳 長榮華航星宇搶第一': '“【長榮不罷工內幕2】正機師年薪480萬起跳 長榮華航星宇搶第一” (captain pay starts at NTD 4.8 million a year)',
  '18萬旅客解套1／長榮機師底薪落後變老三「不罷工換加薪」': '“18萬旅客解套1／長榮機師底薪落後變老三「不罷工換加薪」” (EVA pilots trade a strike for a pay rise)',
  'A330 / B787 / B777 Captain – China Southern（3ページとも給与表は同一）': 'A330 / B787 / B777 Captain – China Southern (the pay table is the same on all three pages)',
  '飞行员招聘 ／ 薪酬福利（パイロットの報酬と福利のページ）': '“飞行员招聘 ／ 薪酬福利” (pilot pay and benefits page)',
  'China Eastern Airlines - A330 Captains（上海基地・3年契約・更新可）': 'China Eastern Airlines - A330 Captains (Shanghai base, three-year renewable contract)',
  '第76期 有価証券報告書 ５【従業員の状況等】＜参考＞職種別 グループ連結 平均年間給与': '76th annual securities report, “Employees”, reference: average annual pay by job type, group consolidated',
  '2027年度入社 新卒採用 募集要項（運航乗務職／自社養成パイロット）': 'FY2027 graduate recruitment requirements (flight crew / company-trained pilots)',
  '第76期 有価証券報告書 ５【従業員の状況】（参考情報）平均年間給与': '76th annual securities report, “Employees” (reference): average annual pay',
  '第75期 有価証券報告書 ５【従業員の状況】（参考情報）平均年間給与': '75th annual securities report, “Employees” (reference): average annual pay',
  '運航乗務員訓練生（自社養成パイロット）募集要項': 'Flight crew trainee (company-trained pilot) recruitment requirements',
  '第29期 有価証券報告書 【従業員の状況】（1）提出会社の状況': '29th annual securities report, “Employees” (1): the filing company',
  '自社養成パイロット訓練生 募集要項': 'Company-trained pilot trainee recruitment requirements',
  'パイロットチャレンジ制度 応募要領': 'Pilot Challenge programme: how to apply',
  /* salary-basis.mjs の応募の条件（エティハドの求人の req）*/
  '総5,500時間・多人数運航ガラスコックピットの機長時間 2,500時間・A320系の機長時間 1,500時間・直近12か月に A320系・入社日に59歳未満・英語能力証明レベル4以上':
    '5,500 hours total; 2,500 hours in command on multi-crew glass-cockpit aircraft; 1,500 hours in command on the A320 family; A320 family flying in the last 12 months; under 59 on joining; ICAO English level 4 or above',
  'A：総2,000時間かつ多人数運航ガラスコックピット1,500時間かつ同型500時間／B：総1,500時間かつ A320系1,000時間。加えて直近12か月に A320系・入社日に50歳未満・英語能力証明レベル4以上':
    'A: 2,000 hours total with 1,500 hours on multi-crew glass-cockpit aircraft and 500 hours on type; or B: 1,500 hours total with 1,000 hours on the A320 family. Also A320 family flying in the last 12 months, under 50 on joining, and ICAO English level 4 or above',
});
/* 先行5社の就航地（airline-destinations.mjs の NETWORK ── 英語の欄がまだ無い）の字の英語。日付の入る理由は下の heldWhyEn が型で読む */
export const NET_EN = Object.freeze({
  /* 何の一覧か（basis） */
  '日本航空が自社で飛ばしている便の行き先（国際線は公式の運航計画、国内線は公式の時刻表）。グループ会社だけが飛ばす空港、コードシェアだけの空港、運休中の空港は入れていません。':
    'Destinations of Japan Airlines’ own flights (international from the official operating plan, domestic from the official timetable). Airports served only by group airlines, codeshare-only airports and suspended airports are not included.',
  'ANAが自社で飛ばしている便の行き先（国際線は公式の路線案内、国内線は公式の時刻表）。ANAウイングスだけが飛ばす空港、コードシェアだけの空港、運休中の空港は入れていません。':
    'Destinations of ANA’s own flights (international from the official route guide, domestic from the official timetable). Airports served only by ANA Wings, codeshare-only airports and suspended airports are not included.',
  'キャセイパシフィックが自社で飛ばしている香港発着の便の行き先（公式の路線網のページと時刻表）。香港エクスプレスだけが飛ばす都市、運休中の空港は入れていません。':
    'Destinations of Cathay Pacific’s own flights to and from Hong Kong (from the official network page and timetable). Cities served only by HK Express and suspended airports are not included.',
  'エティハド航空の公式の就航地の一覧に載っている都市。まだ運航が始まっていない都市は入れていません。':
    'Cities in Etihad Airways’ official list of destinations. Cities where flights have not started yet are not included.',
  'エバー航空が自社で飛ばしている便の行き先（公式の空港一覧と時刻表）。立栄航空（UNI Air）だけが飛ばす都市、貨物便だけの空港は入れていません。':
    'Destinations of EVA Air’s own flights (from the official airport list and timetable). Cities served only by UNI Air and cargo-only airports are not included.',
  /* 出どころの名前 */
  'JAL公式「国際線運航情報」': 'JAL official, “International flight operations”', 'JAL公式「国内線 時刻表」': 'JAL official, “Domestic timetable”',
  'ANA公式「運航開始・再開・休止路線のご案内（国際線）」': 'ANA official, “Routes starting, resuming and suspended (international)”',
  'ANA公式「時刻表（国内線）」': 'ANA official, “Timetable (domestic)”',
  'Cathay Pacific 公式「Our global network」': 'Cathay Pacific official, “Our global network”',
  'Etihad Airways 公式「Destinations」': 'Etihad Airways official, “Destinations”', 'EVA Air 公式「Worldwide Airports」': 'EVA Air official, “Worldwide Airports”',
  /* 載せていない空港の理由 */
  '運休中（再開の計画が公表されていない）': 'Suspended (no plan to resume has been announced)', '運休中': 'Suspended',
  '運休中・空港を公式ページで特定できない': 'Suspended; the airport cannot be identified on the official page', '就航を延期': 'Launch postponed',
  'グループ会社（HAC）と提携会社（FDA）だけが運航': 'Flown only by a group airline (HAC) and a partner (FDA)',
  'グループ会社（HAC）だけが運航': 'Flown only by a group airline (HAC)', 'グループ会社（JAC）だけが運航': 'Flown only by a group airline (JAC)',
  'グループ会社（J-AIR）だけが運航': 'Flown only by a group airline (J-AIR)', 'グループ会社（RAC）だけが運航': 'Flown only by a group airline (RAC)',
  'グループ会社（J-AIR・HAC）だけが運航': 'Flown only by group airlines (J-AIR, HAC)', 'グループ会社（J-AIR・JAC）だけが運航': 'Flown only by group airlines (J-AIR, JAC)',
  'グループ会社（JAC・RAC）だけが運航': 'Flown only by group airlines (JAC, RAC)', 'グループ会社（JTA・RAC）だけが運航': 'Flown only by group airlines (JTA, RAC)',
  'グループ会社（J-AIR）と提携会社（FDA）だけが運航': 'Flown only by a group airline (J-AIR) and a partner (FDA)',
  '提携会社（FDA）のコードシェア便だけ': 'Codeshare flights by a partner (FDA) only', '提携会社（ORC）のコードシェア便だけ': 'Codeshare flights by a partner (ORC) only',
  '提携会社（AMX）のコードシェア便だけ': 'Codeshare flights by a partner (AMX) only', '提携会社のコードシェア便だけ': 'Partner codeshare flights only',
  'グループ会社（ANAウイングス）だけが運航': 'Flown only by a group airline (ANA Wings)',
  'グループ会社（ANAウイングス）だけが運航・期間限定': 'Flown only by a group airline (ANA Wings), for a limited period',
  'グループ会社（ANAウイングス）だけが運航・冬の時刻表に無い': 'Flown only by a group airline (ANA Wings); not in the winter timetable',
  '香港エクスプレスの便だけ': 'HK Express flights only', '立栄航空（UNI Air）の便だけ': 'UNI Air flights only', '貨物便だけ': 'Cargo flights only',
  '提携会社の便だけ': 'Partner flights only', '提携会社（コンドル）の便': 'Flights by a partner (Condor)',
  '今の公式の資料で確かめられなかった': 'Could not be confirmed in current official sources',
  '運航しているかを公式の資料で確かめられなかった': 'Could not confirm in official sources whether it is served',
  '過去に発表されたが、公式の就航地の一覧に無い': 'Announced in the past, but not in the official list of destinations',
  '公式の一覧にあるが、時刻表に便が無い': 'In the official list, but there are no flights in the timetable',
  '空港と運航する会社を公式の資料で確かめられなかった': 'The airport and the operating airline could not be confirmed in official sources',
  /* 載せていない空港の名前（空港の呼び名の表 PLACES に無い名前） */
  'プノンペン': 'Phnom Penh', '成都': 'Chengdu', 'コタキナバル': 'Kota Kinabalu', '済州': 'Jeju', '常州': 'Changzhou', 'フーコック': 'Phu Quoc',
  '台中': 'Taichung', '三亜': 'Sanya', '大邱': 'Daegu', '無錫': 'Wuxi', '義烏': 'Yiwu', 'ケアンズ': 'Cairns', 'ベルリン': 'Berlin',
  'アルジェ・メダン・アルマトイ・バクー・トビリシ・エレバン・アンタルヤ': 'Algiers, Medan, Almaty, Baku, Tbilisi, Yerevan, Antalya',
  '重慶': 'Chongqing', '大連': 'Dalian', '福州': 'Fuzhou', '南京': 'Nanjing', '青島': 'Qingdao', '瀋陽': 'Shenyang', '深圳': 'Shenzhen',
  '厦門': 'Xiamen', '西安': 'Xi’an', 'イスタンブール': 'Istanbul', 'オークランド': 'Auckland', 'ペナン': 'Penang', 'アンカレッジ': 'Anchorage',
  'アトランタ': 'Atlanta', '桂林': 'Guilin', '済南': 'Jinan', '天津': 'Tianjin', '鄭州': 'Zhengzhou', '寧波': 'Ningbo',
  /* 国の名前（サイトの国の表 airline-countries.mjs に無い国・地域のうち、先行5社の就航地に在るもの）。
     ★米国の州（placeCountry が「アメリカ・カリフォルニア州」と言う空港）は、いまどの一覧にも無い ── 一覧に入れば止まるので、そのとき足す */
  'アフガニスタン': 'Afghanistan', 'ウズベキスタン': 'Uzbekistan', 'カンボジア': 'Cambodia', 'スリランカ': 'Sri Lanka',
  'ネパール': 'Nepal', 'パキスタン': 'Pakistan', 'バングラデシュ': 'Bangladesh', 'マカオ': 'Macau', 'モルディブ': 'Maldives',
  'グアム': 'Guam', 'チェコ': 'Czech Republic', 'デンマーク': 'Denmark', 'ベルギー': 'Belgium',
  'ロシア': 'Russia', 'イスラエル': 'Israel', 'シリア': 'Syria', 'セーシェル': 'Seychelles', 'タンザニア': 'Tanzania', 'チュニジア': 'Tunisia',
  'モロッコ': 'Morocco', 'レバノン': 'Lebanon',
});
/** 地域の英語の名前（airline-destinations.mjs の REGIONS の鍵ごと）。 */
export const REGION_EN = Object.freeze({ japan: 'Japan', asia: 'Asia', oceania: 'Oceania', 'north-america': 'North America',
  'latin-america': 'Latin America', europe: 'Europe', 'middle-east-africa': 'Middle East & Africa' });
/* 英語の字を探す順（この読み口の表 → 台帳ごとの表。同じ日本語の字は、先に在る表の英語） */
const EN_DICTS = [VIEW_EN, NET_EN, CO_EN, EY_EN, LV_EN];
const VIEW_USED = new Set();
/** 日本語の字 s の英語（対が無ければ止める）。空の字は空のまま。日本語の字を含まない字（英語の題・3字）はそのまま。 */
function enOf(s, where = '') {
  const t = String(s ?? '');
  if (!t) return '';
  if (!JA_CHARS.test(t)) return t;
  for (const d of EN_DICTS) { const e = twinOf(d, t); if (typeof e === 'string' && e) { if ((d === VIEW_EN || d === NET_EN) && Object.hasOwn(d, t)) VIEW_USED.add(t); return e; } }
  throw new Error(`英語の会社ページ：英語の対が無い字${where ? `（${where}）` : ''} ── ${t}`);
}
/** 国の英語の名前（サイトの国の表 → NET_EN の国） */
const countryOfEn = ja => (ja ? countryEn(ja) || enOf(ja, '国の名前') : '');
/** 就航地のカード・都市の面の国の字（英語）。米国の州が付く空港は「United States, California」（airline-destinations.mjs の placeCountry と同じ決まり） */
export function placeCountryEn(iata) {
  const [c, st] = String(placeCountry(iata) || '').split('・');
  return [countryOfEn(c), st ? enOf(st, '州の名前') : ''].filter(Boolean).join(', ');
}
/* 載せていない空港の理由（日付の入る2つの型は、日付を英語の日付にして読む） */
function heldWhyEn(t) {
  let m = /^運休中（(\d{4}-\d{2}-\d{2})まで）$/.exec(t);
  if (m) return `Suspended (until ${atTextEn(m[1])})`;
  m = /^まだ運航が始まっていない（(\d{4}-\d{2}(?:-\d{2})?)から）$/.exec(t);
  if (m) return `Not operating yet (from ${atTextEn(m[1])})`;
  m = /^JALが自社で飛ばす便は (\d{4}-\d{2}-\d{2}) まで（そのあとはグループ会社の便だけ）$/.exec(t);
  if (m) return `JAL’s own flights run until ${atTextEn(m[1])} (after that, group airlines only)`;
  return enOf(t, '載せていない空港の理由');
}
/* 就航地の一覧の英語（地域の名前・国の名前・出どころ・何の一覧か・載せていない空港）。都市の名前は空港の呼び名の表の英語（d.en）。 */
function networkEn(n, lead) {
  if (!n) return null;
  const regions = n.regions.map(r => ({ ...r, label: REGION_EN[r.key] || enOf(r.label, '地域の名前') }));
  if (!lead) return { ...n, regions };
  return { ...n, regions, src: n.src.map(x => ({ ...x, name: enOf(x.name, '就航地の出どころ') })), basis: enOf(n.basis, '就航地の一覧の前提'),
    list: n.list.map(d => ({ ...d, city: d.en, country: countryOfEn(d.country) })),
    held: n.held.map(h => ({ ...h, name: PLACES[h.key] ? PLACES[h.key][1] : enOf(h.name, '載せていない空港'), why: heldWhyEn(h.why) })) };
}
/* 台帳の1行の項目 f（'ja'・'cond_ja'・'city_ja' …）。行に英語の欄が在ればそれ（ja → en・◯◯_ja → ◯◯_en）、無ければ表の英語 */
function enField(x, f) {
  const v = x[f];
  if (v == null || v === '') return v ?? '';
  const own = f === 'ja' ? x.en : /_ja$/.test(f) ? x[f.replace(/_ja$/, '_en')] : undefined;
  return typeof own === 'string' && own ? own : enOf(v, `${x.key || ''}.${f}`);
}
const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/* 読み方の組（字の出し方だけが違う）。'ja' は今までの読み方そのもの。 */
const TX_JA = Object.freeze({
  lang: 'ja', t: (x, f) => x[f], s: s => s, when: x => whenText(x), value: x => valueText(x),
  day: iso => String(iso || '').replace(/^(\d{4})-(\d\d)-(\d\d)$/, (m, y, mo, d) => `${y}年${+mo}月${+d}日`),
});
const TX_EN = Object.freeze({
  lang: 'en', t: enField, s: s => enOf(s),
  when: x => (x.at_ja ? enOf(x.at_ja, `${x.key || ''}.at_ja`) : atTextEn(x.at)),
  value: x => {
    if (typeof x.value === 'number') { const e = valueTextEn({}, x); if (e === undefined) throw new Error(`英語の会社ページ：数の単位「${x.unit}」の英語が無い（${x.key}）`); return e; }
    return enOf(x.value, `${x.key || ''}.value`);
  },
  day: iso => atTextEn(String(iso || '').slice(0, 10)),
});
const txOf = lang => (lang === 'en' ? TX_EN : TX_JA);

/* 新しい会社ページを持つ会社（★1か所は airline-rollout.mjs の SWITCH。ここは今までの名前で読めるようにしているだけ）。
   先行5社（LEAD）は手で作った台帳から・ほかの会社は「年収の正本（SALARY）と色・略号」だけで作れる（無い所は今までの「確認できていません」の形）。 */
export const GLANCE = SWITCH;
export { LEAD, SWITCH };
export const RANKS = [['cap', '機長'], ['fo', '副操縦士']];

/* 色と略号は airlines-meta.js（ブラウザ用の即時関数。window を渡して中身だけ借りる）。 */
const META = (() => {
  const win = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'airlines-meta.js'), 'utf8'))(win);
  return win.AIRLINES_META || win.PV_AIRLINES || Object.values(win)[0];
})();
function metaOf(slug) {
  const a = META.find(x => x.file === `airlines/${slug}.html`);
  if (!a) throw new Error(`${slug}: airlines-meta.js に無い`);
  const color = a.color || a.c, code = a.code || a.iata;
  if (!/^#[0-9a-fA-F]{6}$/.test(color || '')) throw new Error(`${slug}: airlines-meta.js に色が無い`);
  if (!/^[A-Z0-9]{2,4}$/.test(code || '')) throw new Error(`${slug}: airlines-meta.js に略号が無い`);
  return { color, code };
}

/* ── 社名の字（段階3の面）─────────────────────────────────────────── */
/* 段階3の面（ステイ先・街）の行に出す社名：日本の会社は日本語・ほかは英語（オーナー 2026-10-18「日本は日本語、他は英語」）。
   字は正本（salary-data.mjs の SALARY）の ja / en を、地域（region 'japan'）で選ぶだけ。ページの見出し・検索向けの字には使わない。
   会社ページ（gen-airline-glance.mjs）と career.html（gen-career.mjs）の両方がここを読む（2026-10-19 P12.65。1つの決まりを2つに写さない）。
   島（#crc-data）の name に書く ＝ career-stay.js と pv-contrib.js（街の面の頭の行）が読む。 */
/* lang 'en'（英語の会社ページ）は、どの会社も英語の社名（V2 は日本語のページの決まり ── 2026-10-23 EN-6）。 */
export const coSay = (slug, lang = 'ja') => (lang === 'en' || SALARY[slug].region !== 'japan' ? SALARY[slug].en : SALARY[slug].ja);
/* 同じ面（暮らしの板・就航地とステイの欄・career.html の家賃の箱）の札や1行に、台帳の字のまま出てくるその会社の名前も、同じ決まり（coSay）で出す
   （街を選んだ理由「エバー航空の事業所がある」・出典の名前「エバー航空「飛航人員福利」」・就航地の条件の1行）。
   入れ替えるのは、正本の日本語の社名（SALARY の ja。すぐ後ろに「航空」が続けばそこまで）が、かぎかっこ「…」の外に在る所だけ
   ── 引用した資料の題（「飛航人員福利」）の中は1字も変えない。台帳（living-facts.mjs・airline-destinations.mjs）の字は変えない。
   日本の会社のページでは何も変わらない。ページの見出し・検索向けの字には使わない。 */
const reEsc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, c => `\\${c}`);
/* lang 'en'：英語の字（台帳の英語の対）はもう英語の社名で書いてある ── そのまま返す。 */
export const coText = (slug, t, lang = 'ja') => {
  const s = String(t ?? ''), ja = SALARY[slug].ja, say = coSay(slug);
  if (lang === 'en' || say === ja) return s;
  const re = new RegExp(`${reEsc(ja)}(?:航空)?`, 'g');
  return s.split(/(「[^」]*」)/).map(p => (p.startsWith('「') ? p : p.replace(re, () => say))).join('');
};

/* ── 金額の字 ───────────────────────────────────────────────────── */
/** 標準の円表記（currency.js が実行時に読める形）。 */
export const yen = m => `¥${m.toLocaleString('en-US')}万`;
/** 外貨の家賃などを円に直した字。100万円より小さい額は小数1けたまで（「約11.0万円」）。 */
/* lang 'en'：「約」は ≈ に（英語のページでは、額そのものは生成器がドルの span に焼く ── 「≈$700」）。 */
export function yenOf(cur, amount, lang = 'ja') {
  if (!(cur in JPY_PER)) throw new Error(`換算レートの無い通貨: ${cur}`);
  const y = amount * JPY_PER[cur], m = y / 10000;
  const about = lang === 'en' ? '≈' : '約';
  /* 1万円に届かない額（電車の運賃など）は、万に直さず円のまま書く（「約0.2万円」としない）。 */
  if (m < 1) return `${about}¥${(Math.round(y / 10) * 10).toLocaleString('en-US')}`;
  return m >= 100 ? `${about}${Math.round(m).toLocaleString('en-US')}万円` : `${about}${m.toFixed(1)}万円`;
}
const money = (cur, n) => (cur !== 'JPY' ? `${cur} ${n.toLocaleString('en-US')}`
  : n < 10000 ? `¥${n.toLocaleString('en-US')}` : yenOf('JPY', n).replace(/^約/, ''));
/** 円の家賃の字。出どころが万円の小数2けたまで書く額（22.02万円）は、そのけたまで出す。1けたで足りる額は今までどおり（12.5万円）。 */
const rentYen = n => { const c = Math.round(n / 100); return n < 10000 ? money('JPY', n) : `${c % 10 ? (c / 100).toFixed(2) : (c / 100).toFixed(1)}万円`; };
/** 分の字。60分からは、Google マップの表示と同じ形（1時間15分）。英語は Google マップの英語の表示の形（1 hr 15 min）。 */
export const minsText = (n, lang = 'ja') => (lang === 'en'
  ? (n < 60 ? `${n} min` : `${Math.floor(n / 60)} hr ${n % 60} min`)
  : (n < 60 ? `${n}分` : `${Math.floor(n / 60)}時間${n % 60}分`));
const dayJa = iso => String(iso || '').replace(/^(\d{4})-(\d\d)-(\d\d)$/, (m, y, mo, d) => `${y}年${+mo}月${+d}日`);

/* ── 年収 ───────────────────────────────────────────────────────── */
/* 金額に付ける短い前提。台帳の注（BASIS[slug].notes）の言い換えなので、
   元の言葉が台帳から消えたら止める（ここだけ古い前提を言い続けないため）。 */
const FIG = {
  'etihad.max_y':             { cond: 'A320・月75時間の乗務が前提',                     needs: ['月75時間'] },
  'cathay-pacific.target_y':  { cond: '目標の飛行時間を飛んだ場合の額（保証額ではありません）', needs: ['保証額ではありません'] },
  'cathay-pacific.allow_m_from': { cond: '公表されているのは下限だけ',                  needs: ['下限'] },
  'eva-air.cash_y_over':      { cond: '外から採用する副操縦士（4年契約）の条件。手当・補助は別', needs: ['4年契約', '手当・補助は別'] },
};
function figNote(slug, f, T = TX_JA) {
  const n = FIG[`${slug}.${f.key}`];
  if (!n) return '';
  const notes = (BASIS[slug].notes || []).join('\n');
  for (const w of n.needs) if (!notes.includes(w)) throw new Error(`${slug}: 台帳の注に「${w}」が無い（pv-airline-view.mjs の FIG を見直す）`);
  return T.s(n.cond);
}
/* 出どころの時点。台帳の as_of の頭（「2026年1月時点（脚注…）」→「2026年1月時点」）。 */
const srcWhen = s => String(s.as_of || '').replace(/（[^（）]*）$/, '').replace(/^(\d{4})-(\d{2})-(\d{2})\s*掲載$/, (m, y, mo, d) => `${y}年${+mo}月${+d}日 掲載`);
/* 英語：台帳の英語の欄（as_of_en）が在ればそれ。日付だけの掲載日は「Posted 31 July 2026」。ほかは VIEW_EN の英語 */
const srcWhenEn = s => {
  if (s.as_of_en) return s.as_of_en;
  const t = String(s.as_of || '').replace(/（[^（）]*）$/, '');
  const m = /^(\d{4}-\d{2}-\d{2})\s*掲載$/.exec(t);
  return m ? `Posted ${atTextEn(m[1])}` : enOf(t, 'salary-basis の出どころの時点');
};
/* checked ＝ その資料を開いて確かめた日（台帳の accessed）。画面は「確認日」として出す。 */
/* エティハドの求人票に書かれている応募の条件（職位ごとに1つ）。無ければ何も書かない */
const reqOf = (rank, T = TX_JA) => { const g = BASIS.etihad?.[rank]?.groups?.[0], r = g && g.req; return !r ? '' : T.lang === 'en' ? `Requirements: ${g.req_en || enOf(r, 'etihad の応募条件')}` : `応募条件：${r}`; };
const srcOf = (slug, T = TX_JA) => (BASIS[slug].src || []).map(s => (T.lang === 'en'
  ? { pub: s.pub_en || enOf(s.pub, `${slug} の出どころの発行元`), name: s.name_en || enOf(s.name, `${slug} の出どころの題`), when: srcWhenEn(s), url: s.url, secondary: !!s.secondary, checked: s.accessed || '', ja: s.name }
  : { pub: s.pub, name: s.name, when: srcWhen(s), url: s.url, secondary: !!s.secondary, checked: s.accessed || '' }));

function payOf(slug, rank, T = TX_JA) {
  const r = BASIS[slug]?.[rank] || {}, s = SALARY[slug]?.[rank];
  if (!s || !(s.avg > 0)) throw new Error(`${slug}.${rank}: 年収の正本（SALARY）に推定の額が無い`);
  const e = r.est;
  const backed = !!(e && e.basis && e.method && e.as_of);
  const en = T.lang === 'en', ef = k => (e[`${k}_en`] || enOf(e[k], `${slug}.${rank}.est.${k}`));
  const est = { man: s.avg, yen: yen(s.avg), backed, basis: backed ? (en ? ef('basis') : e.basis) : '', method: backed ? (en ? ef('method') : e.method) : '', asOf: backed ? (en ? ef('as_of') : e.as_of) : '' };
  const figs = figures(slug, rank).filter(f => !f.training)
    .map(f => ({ ...f, ...(en ? { group: f.group_en || enOf(f.group, `${slug}.${rank} の区分`), kind: f.kind_en } : {}),
      cond: figNote(slug, f, T) || (f.cond ? T.s(f.cond) : '') || '', yen: yen(f.man), orig: `${f.cur} ${f.amount.toLocaleString('en-US')}` }));
  return {
    est,
    cap: figs.filter(f => f.key === 'max_y'),
    company: figs.filter(f => f.key !== 'max_y'),
  };
}
/* 訓練生の入社時の額。機長・副操縦士の欄にも棒にも入れない
   （台帳の注がこの額の話をしているので、説明の中に別の行として出すためだけに返す）。 */
const traineeOf = (slug, T = TX_JA) => figures(slug, 'trainee').map(f => (T.lang === 'en'
  ? { group: f.group_en || enOf(f.group, `${slug}.trainee の区分`), kind: f.kind_en, text: f.text.replace(/^約/, '≈') }
  : { group: f.group, kind: f.kind, text: f.text }));

/* ── 棒の目盛（★2026-10-24 オーナー P12.104「年収はもっと高い人もいるだろうからMAX7000万はおかしい」）──────────
   決まった上限は持たない。目盛の右端は、その画面に描く額のいちばん大きいものを、次の 1,000万 の刻みへ切り上げた額
   （いちばん大きい額より下にはしない）。数えるのは、推定年収（avg）・その幅の上の額（hi）・会社が公表している機長と副操縦士の額。
   提出された年収（会員の額）は、いまはどの画面でも棒にしていない ── 棒にする日は、その額もここへ数える。
     会社ページ … 1枚に1本（scaleOf(その会社)）。機長と副操縦士で同じ。
     比較       … 並べた2社で1本（scaleTop(2社の scaleOf)）── 2社は必ず同じ目盛。選び直すたびに career.js が決め直す。
   ⚠️ 全社で1本の目盛（新しい会社ページを持つ会社ぜんぶの推定のいちばん大きい額から作る）に戻さない ── 推定は入っても、
      幅の上の額（ユナイテッド 機長 ¥8,530万・デルタ ¥8,690万 …）がはみ出す。会社を足すと、ほかの会社の目盛まで動く。 */
export const SCALE_STEP = 1000;
/** 額の並び（万円）→ 目盛の右端（万円）。 */
export const scaleTop = vals => {
  const v = vals.filter(n => typeof n === 'number' && Number.isFinite(n) && n > 0);
  if (!v.length) throw new Error('目盛に入れる額が1つも無い');
  return Math.ceil(Math.max(...v) / SCALE_STEP) * SCALE_STEP;
};
/** 1社ぶんの、目盛に入れる額（万円）── 推定（avg）・幅の上の額（hi）・会社が公表している額（機長・副操縦士。訓練生の額と
    機長と副操縦士を分けない平均は、どの画面にも出さないので入れない）。 */
export const scaleValues = slug => RANKS.flatMap(([r]) => [SALARY[slug][r].avg, SALARY[slug][r].hi,
  ...figures(slug, r).filter(f => !f.training).map(f => f.man)]);
/** 1社の目盛の右端（万円）。 */
export const scaleOf = slug => scaleTop(scaleValues(slug));
/** 棒の長さ（目盛の右端 top に対する％）。右端を超える額は止める（目盛は描く額から作るので、起きたら作り方の誤り）。 */
export const width = (m, top) => {
  if (!(m > 0) || !(m <= top)) throw new Error(`棒の額 ${m} が目盛（0〜${top}）に入らない`);
  return `${((m / top) * 100).toFixed(2)}%`;
};

/* ★ 機長と副操縦士を分けない額（運航乗務員・運航乗務職の全体の平均）は、どの会社のページにも出さない（P12.77・2026-10-21）。
   台帳（BASIS.crew）には残す（社内の見張り ── 機長の推定がこの平均より低ければ怪しい、など）。画面に出す crew はいつも空。
   その額の話をしている注と、その額だけの出どころも一緒に外す（その額が無いのに「これは…の平均です」と言わない）。
   どの注・出どころがその話かは、台帳の字で決める（needs）── 台帳の字が変わって当たらなくなったら止める（黙って別の注を外さない）。
   ここに無い会社で乗員全体の平均を持つ会社は、注を1つも出さない（どれがその話か字から分けられない ── 全社へ広げる b の決まり）。 */
const CREW_ONLY = {
  jal: { notes: ['運航乗務員全体の平均です', 'グループ連結の数字です', '算定方法は会社の注のとおり'], src: ['平均年間給与'] },
  ana: { notes: ['運航乗務職全体の額です', 'エアージャパンをあわせた額です', '訓練生が人数に入るか、賞与と基準外賃金を含むか'], src: ['平均年間給与'] },
  skymark: { notes: ['運航乗務員290名の平均です', '単体（提出会社）の数字', '人材会社からの受入出向', '賞与および基準外賃金を含みます'], src: ['【従業員の状況】'] },
};
const crewIn = slug => { const b = BASIS[slug]; return !!(b && b.crew && b.crew.groups && b.crew.groups.some(g => g.avg_y != null)); };
/* 注と出どころから、乗員全体の平均の話だけを外す。分けられない会社は null。 */
function crewFree(slug, T = TX_JA) {
  const B = BASIS[slug], notes = B.notes || [], src = srcOf(slug, T);
  /* 英語：注は台帳の英語の対（notes_en・同じ並び）。外す注は日本語の字で決める（決め方は1つ） */
  const en = T.lang === 'en', said = (n, i) => (en ? (B.notes_en || [])[i] || enOf(n, `${slug} の年収の注`) : n);
  const jaName = x => (en ? x.ja : x.name);
  if (en && (B.notes_en || []).length !== notes.length) throw new Error(`${slug}: 年収の注の英語（notes_en）の数が日本語と違う`);
  if (!crewIn(slug)) return { notes: notes.map(said), src };
  const C = CREW_ONLY[slug];
  if (!C) return null;
  for (const w of C.notes) if (notes.filter(n => n.includes(w)).length !== 1) throw new Error(`${slug}: 乗員全体の平均の注「${w}」が台帳の注にちょうど1つ無い（pv-airline-view.mjs の CREW_ONLY を見直す）`);
  for (const w of C.src) if (!src.some(x => jaName(x).includes(w))) throw new Error(`${slug}: 乗員全体の平均の出どころ「${w}」が台帳に無い（pv-airline-view.mjs の CREW_ONLY を見直す）`);
  return { notes: notes.map((n, i) => [n, i]).filter(([n]) => !C.notes.some(w => n.includes(w))).map(([n, i]) => said(n, i)), src: src.filter(x => !C.src.some(w => jaName(x).includes(w))) };
}

/* ── 事実の1行 ──────────────────────────────────────────────────── */
/* T ＝ 読み方の組（日本語は今までの読み方 TX_JA ・英語は TX_EN） */
function fact(x, T = TX_JA) {
  const cur = x.cur && typeof x.value === 'number' ? x.cur : '';
  return {
    key: x.key, label: T.t(x, 'ja'),
    /* 円の額は標準の円表記（通貨切替が読める形）。外貨は元の通貨の字のまま。 */
    value: cur === 'JPY' ? `¥${x.value.toLocaleString('en-US')}` : cur ? `${cur} ${x.value.toLocaleString('en-US')}` : T.value(x),
    /* 外貨の額は、元の通貨の字（通貨切替に読ませない）と円の換算を分けて持つ。 */
    orig: cur && cur !== 'JPY', yen: cur && cur !== 'JPY' ? yenOf(cur, x.value, T.lang) : '',
    cond: x.cond_ja ? T.t(x, 'cond_ja') : '', when: T.when(x),
    src: x.src ? { name: T.s(x.src.name), url: x.src.url, kind: x.src.kind } : null,
    /* 出どころを開いて確かめた日（台帳の as_of）。画面は「確認日」として出す。 */
    checked: x.as_of || '',
    /* 会社ぜんたいの決まり（パイロットに限らない）は false。 */
    pilot: x.pilot !== false,
  };
}
const facts = (list, T = TX_JA) => (list || []).map(x => fact(x, T));

/* ── エティハド（career-facts.mjs）を、ほかの4社と同じ形にそろえる ───────── */
function etihad(T = TX_JA) {
  const E = EYF.etihad;
  const ben = E.benefits.filter(x => x.scope === 'all');
  const pick = k => { const x = ben.find(z => z.key === k); if (!x) throw new Error(`etihad: 台帳に ${k} が無い`); return x; };
  /* 会社が「勤務」として公表している項目は無い。求人の待遇欄にある年次休暇を勤務の欄に出す。 */
  const work = [pick('annual_leave')];
  const skip = new Set(['annual_leave', 'tax', 'command_path']);
  const benefits = ben.filter(x => !skip.has(x.key));
  const leadBen = 'education_primary';
  const en = T.lang === 'en';
  return {
    base: E.base,
    work: work.map(x => ({ ...fact(x, T), lead: true, cond: T.s('機長・副操縦士の求人の待遇欄') })),
    benefits: benefits.map(x => ({ ...fact(x, T), lead: x.key === leadBen })).sort((a, b) => b.lead - a.lead),
    profile: facts(E.profile.filter(x => ['first_flight', 'national_airline'].includes(x.key)), T),
    scale: facts(E.scale.filter(x => ['fleet_total', 'destinations_operated', 'passengers_year', 'pilots_joined_year'].includes(x.key)), T),
    fleet: facts(E.fleet, T),
    jobs: E.jobs.filter(j => ['cap', 'fo'].includes(j.rank) && !/instructor/.test(j.key)).map(j => ({
      /* 応募の条件は年収の根拠の台帳に在る（求人票そのものの字。career-facts.mjs の req_ref が指している先）。写しを持たない */
      key: j.key, label: T.t(j, 'ja'), value: `${T.t(j, 'place_ja')}`, cond: reqOf(j.rank, T),
      when: en ? `posted ${atTextEn(j.posted)}` : `${whenText({ at: j.posted })} 掲載`,
      src: { name: T.s(j.src.name), url: j.url, kind: j.src.kind }, checked: j.as_of || '', pilot: true,
    })),
    /* ★ 家賃は1か月あたりで出す（2026-10-06 オーナーのご指示「年間じゃなくて月間の家賃」）。
       出どころ（Bayut）の表は1年あたりなので、12で割って1の位で丸める。台帳（career-facts.mjs）は年額のまま持つ。
       割ったことは、説明の中で1回だけ言う（basis の per_month）。 */
    living: (rows => gate('etihad', {
      cityKey: 'abudhabi', city: T.t(E.living, 'city_ja'), cur: 'AED', per: 'month', measure: T.s('募集家賃の平均'),
      site: ABUDHABI.site, siteName: T.s(SITES[ABUDHABI.site].name), stat: ABUDHABI.stat,
      cols: COLS_EY, bars: ABUDHABI.bars, words: ABUDHABI.words, leadCol: 'bed1', beside: '',
      byTown: !!ABUDHABI.by_town, cardFamily: ABUDHABI.card_family || '',
      airports: ABUDHABI.airports.map(([iata, to]) => ({ iata, to: T.s(to) })), ends: endsOf(ABUDHABI, T),
      /* 額は、この欄の列（COLS_EY）の分だけ渡す（台帳の bed3 は、列が足されるまで画面に出ない＝今日の画面と同じ） */
      rents: withWays(ABUDHABI, E.living.rents.map((r, i) => ({ ...townRow({ ...r, sub_ja: r.en }, only(COLS_EY, perMonth(r)), T), when: T.when(r), cond: '', pick: '', lead: i === 0 })), rows, T),
      estates: [],
      basis: [...E.living.rent_basis.filter(b => b.key !== 'per').map(b => ({ key: b.key, value: T.s(b.value) })),
              { key: 'per_month', value: T.s('出どころの表は1年あたりの額。ここでは12で割って、1か月あたりにしている') }],
      refs: [], commute: rows,
    }, [...E.living.rents, ...E.living.rent_basis].map(x => x.quote || ''), ABUDHABI.words))(ways(ABUDHABI, T)),
  };
}
/* エティハドの家賃の欄の列（1つの定数。列を足すときはここだけ）。名前は、どの街とも同じ1組の間取りの字（living-facts.mjs の決まり・
   オーナー 2026-10-18 V16）。Bayut の表の呼び名（Studio・1-Bed・2-Bed・3-Bed）そのもの。 */
const COLS_EY = [['studio', 'Studio'], ['bed1', '1-Bed'], ['bed2', '2-Bed'], ['bed3', '3-Bed']];
/* 値を、その欄の列だけにする（列に無い鍵は渡さない）。 */
const only = (cols, v) => Object.fromEntries(Object.entries(v).filter(([k]) => cols.some(c => c[0] === k)));

/* 1年あたりで載っている家賃を、1か月あたりにする（12で割って1の位で丸める）。年額と書いていない行が来たら止める。 */
function perMonth(r) {
  if (r.per !== 'year') throw new Error(`${r.key}: 家賃が1年あたりではない（per=${r.per}）`);
  const m = n => (typeof n === 'number' ? Math.round(n / 12) : n);
  return Object.fromEntries(Object.entries(r.value).map(([k, n]) => [k, Array.isArray(n) ? n.map(m) : m(n)]));
}

/* 街の行（台帳 → 画面）。area ＝ 家賃の数字が指す地域（街の名前より広いときだけ）。label ＝ 家賃の額のそばに書く名前。 */
const townRow = (r, value = r.value, T = TX_JA) => (T.lang !== 'en' ? {
  key: r.key, name: r.ja, sub: r.sub_ja || r.en || '', en: r.en || r.sub_ja || '', area: r.rent_area_ja || '',
  label: r.rent_area_ja ? `${r.ja}（${r.rent_area_ja}）` : r.ja, iata: r.iata || '', pick: r.pick_ja || '',
  pickSrc: r.pick_src ? { name: r.pick_src.name, url: r.pick_src.url, kind: r.pick_src.kind } : null,
  value: value || {}, when: r.value ? whenText(r) : '', src: r.src || null, cond: r.cond_ja || '', quote: r.quote || '', lead: !!r.lead, way: null,
} : (() => {
  /* 英語：名前は英語の街の名前。名前の下の1行（区・英語の別名）は英語で、名前と同じなら書かない（Tung Chung を2度言わない） */
  const name = T.t(r, 'ja'), sub0 = r.sub_ja ? T.t(r, 'sub_ja') : '', sub = sub0 && sub0 !== name ? sub0 : '', area = T.t(r, 'rent_area_ja');
  return {
    key: r.key, name, sub, en: sub, area,
    label: area ? `${name} (${area})` : name, iata: r.iata || '', pick: r.pick_ja ? T.t(r, 'pick_ja') : '',
    pickSrc: r.pick_src ? { name: T.s(r.pick_src.name), url: r.pick_src.url, kind: r.pick_src.kind } : null,
    value: value || {}, when: r.value ? T.when(r) : '', src: r.src ? { ...r.src, name: T.s(r.src.name) } : null, cond: r.cond_ja ? T.t(r, 'cond_ja') : '', quote: r.quote || '', lead: !!r.lead, way: null,
  };
})());
/* 団地ごとの家賃を持つ街の行は、カードに出す団地（rent_from）の額・出どころ・時点で読む（街の行そのものは額を持たない）。
   rent_area_ja ＝ その団地の名前（カードと career.html は「東涌（映灣園）」と読む）。団地を持たない街はそのまま。 */
const resolve = r => {
  if (!r.estates) return r;
  const e = r.estates.find(x => x.key === r.rent_from);
  return { ...r, value: e.value, cur: e.cur, per: e.per, at: e.at, at_ja: e.at_ja, as_of: e.as_of, src: e.src, cond_ja: e.cond_ja, quote: e.quote, rent_area_ja: e.ja };
};
/* 団地ごとの家賃の行（団地を持たない都市は []）。town ＝ 団地が在る街の鍵。 */
const estatesOf = (L, T = TX_JA) => (L.rents || []).flatMap(r => (r.estates || []).map(e => (T.lang !== 'en' ? {
  key: e.key, town: r.key, townName: r.ja, name: e.ja, sub: e.sub_ja || '', value: e.value, n: e.n || {}, when: whenText(e),
  src: { name: e.src.name, url: e.src.url, kind: e.src.kind }, cond: e.cond_ja || '', quote: e.quote || '',
} : (() => {
  const name = T.t(e, 'ja'), sub0 = e.sub_ja ? T.t(e, 'sub_ja') : '';
  return { key: e.key, town: r.key, townName: T.t(r, 'ja'), name, sub: sub0 && sub0 !== name ? sub0 : '', value: e.value, n: e.n || {}, when: T.when(e),
    src: { name: T.s(e.src.name), url: e.src.url, kind: e.src.kind }, cond: e.cond_ja ? T.t(e, 'cond_ja') : '', quote: e.quote || '' };
})())));
/* 空港までの移動の行。c ＝ 都市の台帳（LIVING[…] か ABUDHABI）。
   card ＝ その街のカードの1行に入る行（Google の行・注意の付いていない行・都市の手段の組・拠点の空港に着く行）。
   ★ legs（区間ごとの乗車の表示）は渡さない ＝ 画面に出さない・足さない。 */
function ways(c, T = TX_JA) {
  const base = c.airports[0][0], ends = c.ends || {}, en = T.lang === 'en';
  /* 「◯◯に見た表示」の英語は「as shown on …」（living-facts.mjs の英語の対と同じ言い方） */
  const seen = iso => (en ? `as shown on ${T.day(iso)}` : `${dayJa(iso)}に見た表示`);
  return (c.commute || []).map(x => {
    const g = x.via === 'gmaps', kind = g ? Object.keys(x.value)[0] : null, e = g ? ends[x.end] : null;
    if (g && !e) throw new Error(`${x.key}: 着く場所（${x.end}）が ends に無い`);
    return { ...fact(x, T), key: x.key, town: x.town || '', iata: x.iata, end: g ? x.end : '', mode: x.mode, modes: x.modes || [x.mode],
      via: g ? 'gmaps' : 'operator', line: x.line || '', from: x.from_ja ? T.t(x, 'from_ja') : '', to: g ? T.t(e, 'ja') : '',
      kind, mins: g ? x.value[kind] : null, ride: g && x.ride != null ? x.ride : null, warn: (g && x.warn && T.t(x, 'warn')) || '',
      value: g ? minsText(x.value[kind], T.lang) : commuteText(x, T), fare: !g && !!x.cur, day: g ? seen(x.as_of) : '',
      card: g && !x.warn && !!c.by_town && FAMILY[x.mode] === c.card_family && e.iata === base,
      lead: !c.by_town && !!x.lead };
  });
}
/* その街のカードに出す移動の1行。着く場所ごとの数字がそろえば1つ、違えば「いちばん短い〜いちばん長い」（平均しない・足さない）。 */
function cardWay(c, rows, key, T = TX_JA) {
  const m = rows.filter(x => x.town === key && x.card);
  if (!m.length) return null;
  const lo = Math.min(...m.map(x => x.mins)), hi = Math.max(...m.map(x => x.mins)), one = new Set(m.map(x => x.end)).size === 1;
  const en = T.lang === 'en', last = m.map(x => x.checked).sort().pop();
  return { keys: m.map(x => x.key), modes: MODES.filter(k => m.some(x => x.modes.includes(k))), lo, hi,
    text: lo === hi ? minsText(lo, T.lang) : en ? (hi < 60 ? `${lo}–${hi} min` : `${minsText(lo, 'en')} – ${minsText(hi, 'en')}`)
      : hi < 60 ? `${lo}〜${hi}分` : `${minsText(lo)}〜${minsText(hi)}`,
    from: m[0].from, to: one ? m[0].to : T.s(c.airports[0][1]), day: en ? `as shown on ${T.day(last)}` : `${dayJa(last)}に見た表示` };
}
const withWays = (c, rents, rows, T = TX_JA) => rents.map(r => ({ ...r, way: cardWay(c, rows, r.key, T) }));
const endsOf = (c, T = TX_JA) => Object.entries(c.ends || {}).map(([key, e]) => ({ key, iata: e.iata, name: T.t(e, 'ja'), kind: e.kind }));
const refsOf = (L, T = TX_JA) => (L.refs || []).map(g => ({ key: g.key, name: T.t(g, 'ja'), measure: T.t(g, 'measure_ja'), cols: g.cols.map(([k, l]) => [k, T.s(l)]),
  cur: g.rows[0].cur, per: g.rows[0].per || (g.rows[0].cur === 'JPY' ? 'month' : ''), when: T.when(g.rows[0]), cond: g.rows[0].cond_ja ? T.t(g.rows[0], 'cond_ja') : '',
  src: [...new Map(g.rows.map(r => [r.src.url, { name: T.s(r.src.name), url: r.src.url }])).values()],
  basis: (g.rent_basis || []).map(b => ({ key: b.key, value: T.s(b.value) })),          // その出どころ自身の断り（落とさない）
  rows: g.rows.map(r => ({ key: r.key, name: T.t(r, 'ja'), value: r.value })) }));

/* 5社とも通る関所：棒の1組に、出どころ・時点の違う行や、cols に無い列・幅の数字を入れさせない（アブダビは台帳が別なので、ここでも見る）。
   団地ごとの家賃（estates）も同じ1組として見る。said ＝ 棒の列の、出どころの呼び名を引用の中で探すときの字（words_src が在ればそれ）。 */
function gate(slug, L, quotes, said = L.words) {
  const bad = m => { throw new Error(`${slug}: 暮らしの台帳 ── ${m}`); };
  const keys = new Set(L.cols.map(c => c[0]));
  if (!L.airports.length) bad('airports が空');
  for (const k of L.bars) if (!keys.has(k)) bad(`棒の列（${k}）が cols に無い`);
  if (L.leadCol && !keys.has(L.leadCol)) bad(`先頭の列（${L.leadCol}）が cols に無い`);
  if (L.rents.filter(r => r.lead).length !== 1) bad('先頭の街が1つに決まらない');
  const priced = [...L.rents.filter(r => Object.keys(r.value).length), ...L.estates];
  for (const r of priced) for (const k of Object.keys(r.value)) if (!keys.has(k)) bad(`${r.key} の列（${k}）が cols に無い`);
  const host = u => new URL(u).host;
  if (new Set(priced.map(r => host(r.src.url))).size > 1 || new Set(priced.map(r => r.when)).size > 1) bad('棒の1組に、出どころか時点の違う行が混ざっている');
  if (!L.site && priced.length) bad('出どころの無い街に、家賃の額が在る');
  for (const k of L.bars) if (!L.words[k] || !said[k] || !quotes.some(q => q.includes(said[k]))) bad(`棒の列（${k}）の、出どころの呼び名（${said[k] || L.words[k]}）が、どの引用にも無い`);
  for (const k of L.bars) for (const r of priced) if (r.value[k] != null && typeof r.value[k] !== 'number') bad(`${r.key} の棒の列（${k}）に、幅の数字が在る（幅は棒にしない）`);
  for (const c of L.commute) if (c.town && !L.rents.some(r => r.key === c.town)) bad(`移動の行 ${c.key} の街（${c.town}）が無い`);
  /* 家賃の棒の組（都市に1組）。棒にできる数字の種類は台帳の BAR_STATS の1か所。行は、団地ごとの家賃が在れば団地、無ければ街。
     目盛の右端は、全部の間取りの全部の行で1つ（いちばん大きい額から）。 */
  const rows = L.estates.length ? L.estates : L.rents;
  const nums = rows.flatMap(r => L.bars.map(k => r.value[k]).filter(v => typeof v === 'number'));
  L.hasBars = BAR_STATS.includes(L.stat) && nums.length > 0;
  L.axis = L.hasBars ? axisEnd(Math.max(...nums)) : null;
  if (L.hasBars && L.rents.find(r => r.lead).value[L.leadCol] == null) bad('先頭の街に、先頭の列の額が無い');
  return L;
}

function others(slug, T = TX_JA) {
  const F = CO[slug], L = LIVING[CITY_OF[slug]];
  if (!F || !L) throw new Error(`${slug}: 台帳に無い`);
  const lead1st = list => facts(list, T).map((x, i) => ({ ...x, lead: !!list[i].lead })).sort((a, b) => b.lead - a.lead);
  return {
    base: F.base,
    work: lead1st(F.work), benefits: lead1st(F.benefits),
    profile: facts(F.profile, T), scale: facts(F.scale, T), fleet: facts(F.fleet, T),
    jobs: facts(F.jobs, T),
    living: cityLiving(slug, CITY_OF[slug], L, T),
  };
}
/* 先行5社の台帳の街（東京・香港・台北）を、暮らしの板が読む形にする。
   先行5社ではない会社（全社へ広げる c）も、拠点の空港がこの街の空港なら同じ1組を使う（1つの街に1つの資料）。
   そのときは、その会社の拠点の空港の分だけ（空港・着く場所・移動の行をしぼる ── ほかの会社の空港の行を出さない）。 */
function cityLiving(slug, cityKey, L, T = TX_JA) {
  const rents = L.rents.map(resolve);
  const r0 = rents.find(r => r.value), cur = r0 ? r0.cur : '';
  const rows = ways(L, T);
  return gate(slug, {
      /* 東京の出どころ（アットホーム・区の SUUMO）は、表に単位の字が無い（per が空）。日本の賃料の相場は月額なので、画面では「月」と出す。 */
      cityKey, city: T.t(L, 'city_ja'), cur, per: r0 ? (r0.per || (cur === 'JPY' ? 'month' : '')) : 'month',
      measure: L.measure_ja ? T.t(L, 'measure_ja') : '', site: L.site, siteName: L.site ? T.s(SITES[L.site].name) : '', stat: L.stat,
      /* 英語：列の名前・ボタンの字（Studio・1-Bed …）は英語の字のまま。日本語の字の列（区ごとの表など）が来れば英語の対 */
      cols: T.lang === 'en' ? L.cols.map(([k, l]) => [k, T.s(l)]) : L.cols, bars: L.bars,
      words: T.lang === 'en' ? Object.fromEntries(Object.entries(L.words).map(([k, w]) => [k, T.s(w)])) : L.words,
      leadCol: L.lead_col || '', beside: L.beside_ja ? T.t(L, 'beside_ja') : '',
      byTown: !!L.by_town, cardFamily: L.card_family || '',
      airports: L.airports.map(([iata, to]) => ({ iata, to: T.s(to) })), ends: endsOf(L, T),
      rents: withWays(L, rents.map(r => townRow(r, r.value, T)), rows, T),
      estates: estatesOf(L, T),
      basis: (L.rent_basis || []).map(b => ({ key: b.key, value: T.s(b.value) })),
      refs: refsOf(L, T), commute: rows,
    }, [...L.rents, ...L.rents.flatMap(r => r.estates || []), ...(L.rent_basis || [])].map(x => x.quote || ''), L.words_src || L.words);
}
/* 値が {t1:35, t2:39}（ターミナルごとの時間）や {fare:1280, liner:1300}（運賃と料金）の形で入っている行。
   台帳の鍵をそのまま画面に出さない ── 呼び名の無い鍵が来たら止める。 */
const PART = { t1: '第1ターミナル駅', t2: '第2ターミナル駅', t3: '第3ターミナル駅', t12: '第1・第2ターミナル駅', fare: '運賃', liner: 'ライナー料金' };
function commuteText(x, T = TX_JA) {
  const v = x.value, en = T.lang === 'en';
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if (x.cur && x.cur !== 'JPY') throw new Error(`${x.key}: 外貨の内訳の書き方をまだ決めていない`);
    return Object.entries(v).map(([k, n]) => {
      if (!PART[k]) throw new Error(`${x.key}: 値の鍵「${k}」の呼び名が無い（pv-airline-view.mjs の PART）`);
      /* 英語：数＋単位は台帳の英語の並べ方（career-facts.mjs の UNIT_EN） */
      const num = x.cur ? money(x.cur, n) : !en ? `${n}${x.unit || ''}` : !x.unit ? String(n) : UNIT_EN[x.unit] ? UNIT_EN[x.unit](n) : null;
      if (num === null) throw new Error(`英語の会社ページ：数の単位「${x.unit}」の英語が無い（${x.key}）`);
      return `${T.s(PART[k])} ${num}`;
    }).join(en ? ' / ' : ' ／ ');
  }
  if (x.cur && typeof v === 'number') return money(x.cur, v);
  return T.value(x);
}

/** 家賃の1ます。数なら額、[下, 上] なら幅。外貨は「元の通貨」と「円」を分けて返す。
    lang 'en'：幅は「–」・円の目安は「≈」（日本語の字を混ぜない。円の額は英語のページで生成器がドルの span に焼く）。 */
export function rentCell(cur, v, lang = 'ja') {
  const lo = Array.isArray(v) ? v[0] : v, hi = Array.isArray(v) ? v[1] : null;
  if (typeof lo !== 'number') return null;
  const to = lang === 'en' ? '–' : '〜';
  if (cur === 'JPY') return { orig: '', yen: hi ? `${rentYen(lo)}${to}${rentYen(hi)}` : rentYen(lo) };
  const n = x => x.toLocaleString('en-US');
  return {
    orig: hi ? `${cur} ${n(lo)}${to}${n(hi)}` : `${cur} ${n(lo)}`,
    yen: hi ? `${yenOf(cur, lo, lang).replace(/円$/, '')}${to}${yenOf(cur, hi, lang).replace(/^(?:約|≈)/, '')}` : yenOf(cur, lo, lang),
  };
}

/** 1社ぶん。lang 'en' ＝ 英語の会社ページの読み口（形・並び・数字は日本語と同じで、字だけ英語。lang: 'en' を持つ）。 */
export function viewOf(slug, lang = 'ja') {
  if (!SALARY[slug]) throw new Error(`${slug}: 年収の正本（SALARY）に無い`);
  if (!LEAD.includes(slug)) return rolloutView(slug, lang);
  const S = SALARY[slug], B = BASIS[slug], T = txOf(lang), en = lang === 'en';
  const d = slug === 'etihad' ? etihad(T) : others(slug, T);
  const iata = [].concat(d.base.iata || []);
  const free = crewFree(slug, T);
  if (!free) throw new Error(`${slug}: 乗員全体の平均の注を分けられない（pv-airline-view.mjs の CREW_ONLY に足す）`);
  return {
    slug, name: en ? S.en : S.ja, ...metaOf(slug), ...(en ? { lang } : {}),
    base: { city: T.t(d.base, 'city_ja'), country: T.t(d.base, 'country_ja'), iata, text: T.value(d.base), ...fact(d.base, T) },
    pay: {
      cap: payOf(slug, 'cap', T), fo: payOf(slug, 'fo', T),
      crew: [], trainee: traineeOf(slug, T),
      tax: en ? (B.tax_en || enOf(B.tax, `${slug} の税`)) : B.tax, notes: free.notes, src: free.src, cur: B.cur,
    },
    work: d.work, benefits: d.benefits, living: d.living, livings: [d.living],
    company: { profile: d.profile, scale: d.scale, fleet: d.fleet, photo: primary(slug), intro: introOf(slug, lang) },
    jobs: d.jobs,
    /* 英語だけ：先行5社の就航地の一覧（airline-destinations.mjs の networkOf）を英語にして持つ（日本語は生成器が networkOf を直接読む） */
    ...(en ? { network: networkEn(networkOf(slug), true) } : {}),
  };
}

/* ── 先行5社ではない会社（全社へ広げる b・c・2026-10-21）──────────────────────────
   要るのは 年収の正本（SALARY）と 色・略号（airlines-meta.js）だけ。ほかは在る分だけ:
     年収の根拠  salary-basis.mjs（BASIS）が在れば、職位ごとの公表額・訓練生の額・注・出どころ（先行5社と同じ読み口 payOf）。
                 ⚠️ 機長と副操縦士を分けない額（乗員全体の平均）は出さない（P12.77。crew は空）。その額の話の注と出どころも外す
                    （CREW_ONLY に字が在る会社。無い会社は注を1つも出さない ── どの注がその額の話か、字からは分けられない）。
     会社の事実  調べの台帳（research-ledger.mjs）から、airline-rollout.mjs の決まり（why）と、airline-display.mjs の字
                 （項目の言い方の表か、行ごとに書いた字）を通った行だけ。調べた側の字は出さない。過去・参考の行は札（tag）つき。
     機材        型式だけ（会社の資料に載っている型式。機数は作らない）。
     就航地      調べで確かめた就航地（airline-display.mjs の NET に字が在る会社だけ・partial ＝ 会社全体の就航地とは言わない）。
                 拠点の空港（本拠地）は一覧に入れない（先行5社と同じ）。拠点を外して1つも残らなければ、今までの「…確認してから開きます。」。
     暮らし      拠点の空港ごとの街（拠点の並びの順・先頭 ＝ いちばん上の拠点）。拠点の空港が先行5社の台帳の街の空港なら、その街の1組
                 （東京 ＝ アットホーム。その会社の拠点の空港の行だけにしぼる）。そうでなければ調べの台帳の街（CITY に字が在る街だけ）。
                 家賃の行の無い街は、今までの「家賃の資料を確認できていません」。ほかの街の数字で埋めない。
   紹介文（intro）は、台帳に紹介文の型が無いので、このページにもう出ている値だけを決まった型にはめる（下の rowsIntro）。
   作り物の字・0 で埋めない。 */
const ROOM = [['studio', 'studio', 'Studio'], ['1bed', 'bed1', '1-Bed'], ['2bed', 'bed2', '2-Bed'], ['3bed', 'bed3', '3-Bed']];
/* 家賃の対象の期間（2026-07-01〜2026-09-30 → 2026年7〜9月）。月の頭から月の終わりまでの行だけ。ほかは対象の始まりの日付の字。 */
function periodText(r, lang = 'ja') {
  const e = r.effective || {}, f = /^(\d{4})-(\d{2})-01$/.exec(e.from || ''), t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.to || '');
  if (lang === 'en') {
    if (f && t && f[1] === t[1]) return f[2] === t[2] ? `${MONTH_EN[+f[2] - 1]} ${f[1]}` : `${MONTH_EN[+f[2] - 1]}–${MONTH_EN[+t[2] - 1]} ${f[1]}`;
    return atTextEn(e.from || '');
  }
  if (f && t && f[1] === t[1]) return f[2] === t[2] ? `${f[1]}年${+f[2]}月` : `${f[1]}年${+f[2]}〜${+t[2]}月`;
  return whenText({ at: e.from || '' });
}
/* 調べの台帳の街の英語の欄（airline-display.mjs の CITY の ◯◯_en）。日本語の欄が在るのに英語が無ければ止める */
const cityEn = (C, k) => { if (!C[k]) return ''; if (!C[`${k}_en`]) throw new Error(`英語の会社ページ：街（${C.ja}）の ${k}_en が無い（airline-display.mjs の CITY）`); return C[`${k}_en`]; };
/* 調べの台帳の街 → 暮らしの板の形（先行5社の街と同じ形・同じ関所 gate）。家賃は街ぜんたいの1行（街の中の区分けを作らない）。 */
function researchCityLiving(slug, c, lang = 'ja') {
  const C = c.C, value = {}, cols = [], en = lang === 'en';
  const first = c.rents[0], same = c.rents.filter(x => first && x.src.url === first.src.url && periodText(x.r) === periodText(first.r));
  for (const { r } of same) for (const [k, n] of Object.entries(r.value)) {
    const m = ROOM.find(x => x[0] === k);
    if (!m || typeof n !== 'number') continue;
    value[m[1]] = n;
  }
  for (const m of ROOM) if (value[m[1]] != null) cols.push([m[1], m[2]]);
  const priced = cols.length > 0;
  /* 英語：街の名前は英語の名前（名前の下の1行は書かない ── 同じ名前を2度言わない） */
  const town = {
    key: c.city, name: en ? C.en : C.ja, sub: en ? '' : C.en, en: en ? '' : C.en, area: '', label: en ? C.en : C.ja,
    iata: c.iata, pick: '', pickSrc: null, value, when: priced ? periodText(first.r, lang) : '',
    src: priced ? { name: first.src.name, url: first.src.url, kind: first.src.kind } : null, cond: '', quote: '', lead: true, way: null,
  };
  const commute = c.commute.map(({ r, d, src }, i) => ({
    key: r.id, town: '', iata: c.iata, end: '', mode: d.mode || 'train', modes: [d.mode || 'train'], via: 'operator', line: '', from: '', to: '',
    kind: null, mins: null, ride: null, warn: '', label: d.label, value: d.value, orig: false, yen: '', cond: d.cond || '', when: '',
    src: { name: src.name, url: src.url, kind: src.kind }, checked: r.checked_at || '', pilot: true, fare: false, day: '', card: false, lead: i === 0,
  }));
  return gate(slug, {
    cityKey: c.city, city: en ? C.en : C.ja, cur: priced ? first.r.currency : '', per: priced ? C.per || 'month' : 'month',
    measure: priced ? (en ? cityEn(C, 'measure') : C.measure || '') : '',
    site: priced ? c.city : '', siteName: priced ? (en ? cityEn(C, 'site') : C.site || '') : '', stat: priced ? (first.r.amount || {}).stat || '' : '',
    cols, bars: [], words: {}, leadCol: cols.length ? cols[0][0] : '', beside: '', byTown: false, cardFamily: '',
    /* ★2026-10-26 段階5 compare-all-15：空港は、その会社の拠点の空港（c.iata ── 字の表の also の空港のときは、空港の呼び名の表 PLACES の名前） */
    airports: [{ iata: c.iata, to: c.iata !== C.iata ? PLACES[c.iata][en ? 1 : 0] : en ? cityEn(C, 'airport') : C.airport }], ends: [], rents: [town], estates: [],
    basis: priced && C.scope ? [{ key: 'scope', value: en ? cityEn(C, 'scope') : C.scope }] : [], refs: [], commute, research: true,
  }, [], {});
}
/* 先行5社の台帳の街を、その会社の拠点の空港の分だけにしぼって使う。 */
function leadCityFor(slug, key, bases, T = TX_JA) {
  const L = LIVING[key], at = iata => bases.includes(iata);
  return cityLiving(slug, key, { ...L, airports: L.airports.filter(([a]) => at(a)),
    ends: Object.fromEntries(Object.entries(L.ends || {}).filter(([, e]) => at(e.iata))), commute: (L.commute || []).filter(x => at(x.iata)) }, T);
}
/* 拠点の空港の順に、街を1つずつ（同じ街は1回だけ）。 */
function livingsOf(slug, bases, T = TX_JA) {
  const out = [], found = researchCities(slug, bases, undefined, undefined, T.lang);
  for (const code of bases) {
    const key = Object.keys(LIVING).find(k => LIVING[k].airports.some(([a]) => a === code));
    if (key) { if (!out.some(L => L.cityKey === key)) out.push(leadCityFor(slug, key, bases, T)); continue; }
    const c = found.find(x => x.iata === code);
    if (c && !out.some(L => L.cityKey === c.city)) out.push(researchCityLiving(slug, c, T.lang));
  }
  return out;
}
/* 調べの台帳の会社の英語の行は、airline-rollout.mjs の researchFacts(…, 'en') がもう英語の字にしてある（対の無い行は出ない）。
   ここではその字をそのまま運ぶ（もう一度英語の対を探さない ── 英語の題の “…” の中の原文の字を、日本語と読み違えない）。 */
const TX_EN_READY = Object.freeze({
  lang: 'en', t: (x, f) => x[f] ?? '', s: s => s, when: x => atTextEn(x.at),
  value: x => (typeof x.value === 'number' ? x.value.toLocaleString('en-US') : String(x.value ?? '')), day: TX_EN.day,
});
function rolloutView(slug, lang = 'ja') {
  const en = lang === 'en', T = txOf(lang), TR = en ? TX_EN_READY : TX_JA;
  const S = SALARY[slug], B = BASIS[slug], R = researchFacts(slug, undefined, lang);
  const free = B ? crewFree(slug, T) : null;
  /* 額の行（月・年あたりの通貨つきの額）は、期間の字を額の前に置く（「月 ZAR 4,000」）。英語は後ろ（「ZAR 4,000 a month」） */
  const rows = list => list.map(x => { const f = { ...fact(x, TR), lead: !!x.lead, use: x.use, tag: x.tag || '', id: x.id }; if (x.per && x.cur) f.value = en ? `${f.value} a ${x.per}` : `${x.per} ${f.value}`; return f; });
  const base = R.base
    ? { city: R.base.city, country: R.base.country, iata: R.base.iata, text: R.base.city || R.base.iata[0], rows: rows(R.base.rows) }
    : { city: '', country: '', iata: [], text: '', rows: [] };
  const livings = livingsOf(slug, base.iata, T);
  const profile = rows(R.profile), fleet = rows(R.fleet);
  return {
    slug, name: en ? S.en : S.ja, ...metaOf(slug), rollout: true, ...(en ? { lang } : {}),
    base,
    pay: {
      cap: payOf(slug, 'cap', T), fo: payOf(slug, 'fo', T),
      crew: [], trainee: traineeOf(slug, T),
      tax: (B && B.tax && (en ? (B.tax_en || enOf(B.tax, `${slug} の税`)) : B.tax)) || '', notes: free ? free.notes : [],
      src: B ? (free ? free.src : srcOf(slug, T).filter(x => !/平均年間給与|【従業員の状況/.test(en ? x.ja : x.name))) : [], cur: (B && B.cur) || '',
    },
    work: rows(R.work), benefits: rows(R.benefits), living: livings[0] || null, livings,
    /* 拠点の空港は就航地の一覧に入れない。拠点が街だけの会社は、その街の空港（airline-rollout.mjs の base.home）も入れない（2026-10-21 d1） */
    network: (n => (en ? networkEn(n, false) : n))(researchNetwork(slug, REGIONS, [...base.iata, ...((R.base && R.base.home) || [])], lang)),
    company: { profile, scale: rows(R.scale), fleet, photo: primary(slug), intro: rowsIntro(slug, lang, { profile, fleet, base }) },
    jobs: rows(R.jobs),
    held: R.held,
  };
}

/* 会社のカードのいちばん上の字（紹介文）。字は台帳の項目から組み立てたもの ── 手で書いた字ではない
   （型と決まりは career-facts.mjs の fillIntro / checkIntro。エティハドは career-facts、ほかは airline-facts が持つ）。
   uses ＝ その文が使った項目の鍵。カードは、同じ項目を下の一覧の先頭にもう一度並べない。
   英語は台帳の英語の型（introTextEn ＝ EN-1。数字と日付は同じ項目から）。 */
function introOf(slug, lang = 'ja') {
  const list = lang === 'en' ? (slug === 'etihad' ? eyIntroEn(slug) : coIntroEn(slug)) : slug === 'etihad' ? eyIntro(slug) : coIntro(slug);
  if (!list.length) throw new Error(`${slug}: 台帳に紹介文が無い`);
  for (const s of list) if (!s.text) throw new Error(`${slug}: 紹介文が台帳の項目で埋まらない（${s.uses.join('・')}）`);
  return list;
}

/* ── 先行5社ではない会社の、会社のカードのいちばん上の短い紹介（★2026-10-26 段階5 compare-all-20）──────────────
   オーナー「各航空会社ページの会社概要は空白になるくらいなら少しは説明入れたら？簡潔でいい（開いたら詳しく出ればいいけど）」。
   台帳に紹介文の型が無い会社なので、**そのページにもう出ている値だけ**を決まった型にはめる（手で書いた字・作り物の字は入れない）:
     国        airline-countries.mjs（ページの国）。ほかの値が無くても「〈国〉の航空会社。」の1文は必ず在る（国の分からない会社は作らない）
     本社      会社の数字の本社の行（都市か国）。国と同じ字なら「〈国〉に本社を置く」の1文にまとめる
     設立      会社の数字の設立の行（founded）
     航空連合  会社の数字の航空連合の行（alliance）── 台帳に行が在るときだけ。一覧のカードの札（airlines-meta.js）は出どころが無いので使わない
     拠点      ページの拠点（社名の行の拠点・暮らしの街と同じ v.base）。「〜にパイロットの拠点がある」── ここで全部とは言わない（4つめから「など」）
     機材      会社の資料に載っている型式（機数は書かない・4つめから「など」）。字はカードの札と同じ短い形
   過去・参考の札の付いた行は使わない。数字は行の値のほかに書かない。順位・飾り・LCC/FSC の字は書かない（書いたら止める）。
   航空会社ではない会社（airlines-meta.js の種類がチャーター・ビジネスジェット・紹介）は「運航会社」と言う。
   uses ＝ 文が言った会社の数字の鍵（カードの4つの値に、同じ項目を並べ直さない）。rows ＝ この型で組んだ紹介の印
   ⚠️ この紹介は「◯◯について」の古い節の代わりにはならない（gen-airline-glance.mjs の legacyReady.intro は台帳の紹介文だけを数える）。 */
const ROWS_BANNED = /第.位|最大|最古|有数|屈指|フラッグ|国営|政府系|急成長|名門|一流|老舗|年収|給与|定年|退職|大手|人気|格安|LCC|FSC/i;
const ROWS_BANNED_EN = /\b(largest|biggest|oldest|leading|top|No\.\s*1|best|premier|flagship|state-owned|government-owned|fast-growing|prestigious|salary|pay|major|popular|low[- ]cost|budget|legacy|LCC|FSC)\b/i;
/* 機材の札と同じ短い形（gen-airline-glance.mjs の shortType と同じ決まり） */
const typeShort = (s, en) => (en
  ? String(s).replace(/^Boeing\s*/, () => 'B').replace(/^Airbus\s*/, () => '').replace(/^Embraer\s*/, () => 'E')
  : String(s).replace(/^ボーイング\s*/, () => 'B').replace(/^エアバス\s*/, () => '').replace(/^エンブラエル\s*/, () => 'E'));
/* 空港の字：街の名前（空港の呼び名の表 PLACES）＋3字。「東京（羽田）」は「東京・羽田（HND）」（括弧を重ねない）。名前の無い空港は3字だけ */
const portJa = c => (PLACES[c] ? `${String(PLACES[c][0]).replace(/（([^（）]+)）$/, (_, y) => `・${y}`)}（${c}）` : c);
const portEn = c => (PLACES[c] ? `${PLACES[c][1]} (${c})` : c);
/* 日本語の並べ方：機材は「・」、空港は「、」（空港の名前が「東京・羽田」のように「・」を持つので、区切りと見分ける） */
const listJa = (xs, sep = '・') => (xs.length > 3 ? `${xs.slice(0, 3).join(sep)}など` : xs.join(sep));
const listEn = xs => { const a = xs.slice(0, 3); return a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0]; };
export function rowsIntro(slug, lang, { profile, fleet, base }) {
  const en = lang === 'en', C = BY_CODE[AIRLINE_COUNTRY[slug]];
  if (!C) return [];
  const m = META.find(x => x.file === `airlines/${slug}.html`) || {};
  const noun = ['fsc', 'lcc'].includes(m.type) ? (en ? 'Airline' : '航空会社') : (en ? 'Operator' : '運航会社');
  const row = k => profile.find(f => f.key === k && !f.tag && String(f.value ?? '').trim());
  const hq = row('headquarters_city') || row('headquarters_country'), founded = row('founded'), alliance = row('alliance');
  const land = en ? C.en : C.ja, landIn = en ? C.enIn || C.en : C.ja;
  const co = [], uses = [];
  if (hq && String(hq.value) === land) co.push(en ? `${noun} headquartered in ${landIn}.` : `${land}に本社を置く${noun}。`);
  else if (hq) co.push(en ? `${noun} based in ${landIn}. Headquarters: ${hq.value}.` : `${hq.value}に本社を置く${land}の${noun}。`);
  else co.push(en ? `${noun} based in ${landIn}.` : `${land}の${noun}。`);
  if (hq) uses.push(hq.key);
  if (founded) { co.push(en ? `Founded ${founded.value}.` : `設立は${founded.value}。`); uses.push(founded.key); }
  if (alliance) { co.push(en ? `Alliance: ${alliance.value}.` : `航空連合は${alliance.value}。`); uses.push(alliance.key); }
  const ops = [];
  const ports = base.iata.length ? base.iata.map(en ? portEn : portJa) : String(base.city || '').split(en ? ', ' : '・').filter(Boolean);
  if (ports.length) ops.push(en ? (ports.length === 1 ? `Has a pilot base ${base.iata.length ? 'at' : 'in'} ${ports[0]}.` : `Pilot bases include ${listEn(ports)}.`)
    : `${listJa(ports, '、')}にパイロットの拠点がある。`);
  const types = [...new Set(fleet.filter(f => !f.tag).map(f => typeShort(f.label, en)))];
  if (types.length) ops.push(en ? `Fleet includes the ${listEn(types)}.` : `機材には${listJa(types)}がある。`);
  const out = [{ text: co.join(en ? ' ' : ''), uses, rows: true }];
  if (ops.length) out.push({ text: ops.join(en ? ' ' : ''), uses: [], rows: true });
  for (const s of out) {
    const bad = s.text.match(en ? ROWS_BANNED_EN : ROWS_BANNED);
    if (bad) throw new Error(`${slug}: 会社の紹介に書かない言い方（${bad[0]}）── ${s.text}`);
    if (en && JA_CHARS.test(s.text)) throw new Error(`${slug}: 英語の会社の紹介に日本語の字 ── ${s.text}`);
  }
  return out;
}

/** 英語の読み口の検査：SWITCH の全社の英語の読み口が、対の欠けで止まらずに作れる・VIEW_EN の行はどれも使われている。
    返すのは [理由の字…]（空 ＝ 通る）。assert-rollout.mjs が呼ぶ。 */
export function checkViewEn(slugs = SWITCH) {
  const bad = [];
  VIEW_USED.clear();
  for (const s of slugs) {
    try {
      const v = viewOf(s, 'en');
      for (const d of (v.network && v.network.list) || []) placeCountryEn(d.iata);   // カードの国の字（生成器が呼ぶ）も、ここで1回ずつ読む
    } catch (e) { bad.push(`${s}: ${e.message}`); }
  }
  for (const [name, D] of [['VIEW_EN', VIEW_EN], ['NET_EN', NET_EN]]) for (const k of Object.keys(D)) {
    if (!JA_CHARS.test(k)) bad.push(`${name}: 日本語の字ではない行（${k}）`);
    if (JA_CHARS.test(String(D[k]).replace(/“[^”]*”/g, ''))) bad.push(`${name}: 英語の字の “…” の外に日本語の字（${k}）`);
    if (slugs === SWITCH && !VIEW_USED.has(k)) bad.push(`${name}: どの字にも使われていない英語の行（${k}）── 台帳の字が変わったなら、英語も直す`);
  }
  return bad;
}

/* node pv-airline-view.mjs … 5社ぶんを一覧で出す（目で確かめる用）。 */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const s of GLANCE) {
    const v = viewOf(s);
    console.log(`\n目盛の右端 ${scaleOf(s)}万`);
    const lead = l => { const x = l.find(z => z.lead) || l[0]; return x ? `${x.label}＝${x.value}` : '（公表なし）'; };
    const r = v.living.rents.find(x => x.lead), c = v.living.leadCol ? rentCell(v.living.cur, r.value[v.living.leadCol]) : null;
    console.log(`\n${v.name}（${v.code}・${v.base.city} ${v.base.iata.join('・')}）`);
    for (const [k, l] of RANKS) {
      const p = v.pay[k];
      console.log(`  ${l}  推定年収 ${p.est.yen}${p.est.backed ? '（根拠あり）' : ''}`);
      for (const f of [...p.cap, ...p.company]) console.log(`      ${f.kind}  ${f.text}（${f.orig}）`);
    }
    console.log(`  勤務  ${lead(v.work)}\n  待遇  ${lead(v.benefits)}\n  暮らし ${r.name} ${c ? `${c.orig} ${c.yen}` : '（家賃の資料なし）'}${r.way ? ` ／ ${r.way.text}` : ''}`);
  }
}
