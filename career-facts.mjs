/* 会社ごとの公開情報の台帳（2026-10-04）。いまはエティハド航空だけ。
 *
 * 概要と2社比較の1枚（career.html）が、年収のほかに出す事実の置き場。
 * 年収の額と出どころは salary-basis.mjs・salary-sources.mjs が正で、ここには写さない。
 *
 * ・**出どころのページを自分で開いて、原文で確かめた事実だけを置く。**
 *   出どころが報道だけの事実は入れない（kind は company / gov / portal の3つしか無い。
 *   出どころの URL も、種類ごとに決めた置き場のものしか通らない ── 下の HOSTS）。
 *   確かめられなかったものは**行を作らない**（「公表なし」「未取得」は画面を作る側が出す）。
 * ・どの項目も { key, ja, value, unit?, as_of, src:{ name, url, kind }, quote }。
 *   - as_of ＝ **出どころを開いて確かめた日**。
 *   - at    ＝ その事実がいつの話か（発表の日・月末・年・求人の掲載日）。
 *     ⚠️ 画面に「◯◯時点」と書くのは **at** のほう。salary-basis.mjs の as_of（資料の時点）とは
 *     意味が逆なので、取り違えない。
 *   - quote ＝ 原文の短い引用。出どころのページに出ている字のまま（’ などの記号も）。
 *     **空白だけはそろえてある** ── タグを外し、改行しない空白（nbsp）も含めて、
 *     続いた空白を普通の空白1つにした字面。原文は数字のあとに nbsp を置くことがあるので
 *     （「128 aircraft」）、突き合わせるときは本文の側も下の squash() を通す。
 *     quote_more は、同じページからの追加の引用。
 *   - cond_ja / cond_quote ＝ 原文がその数字に付けている条件（含むもの・除くもの・上限）。
 *     **条件つきの数字を、条件なしで出さない。**
 *   - value が文字のもの（「400人近く」など）は、原文が概数で書いている。丸めて数字にしない。
 * ・**既にある台帳に在る事実は写さない。** 在りかを ref で指す
 *   （'salary-basis.mjs#BASIS.etihad.…'。読むときは下の resolveRef）。
 *   機長・副操縦士の求人の URL と掲載日は BASIS.etihad.src から引いている。
 *   年収の上限と応募資格は pay_ref / req_ref が指す先を読む。
 * ・金額は**元の通貨と額**（cur と value）。円は画面を作る側が salary-basis.mjs の man() で出す。
 *   ここに換算の率を持たない。
 * ・destinations で言えるのは**「就航地」まで**。乗員が泊まる街かどうかは確かめていない。
 *   IATA は、公式の就航地ページの写真のファイル名（NRT.jpg）から取った。画面の字には出ていない。
 *   region はそのページのタブの分け方。
 *   ⚠️ 札に書いてあるのは街の名（city_en）だけ。city_ja はそれを日本語にした呼び名、
 *   country_ja はその街の国（地理の呼び名で、会社の公表ではない。札に国の名は書いていない）。
 * ・scope: 'instructor' は教官の求人だけに書いてある項目。会社どうしの比較に入れない。
 * ・jobs は、国籍の条件が付いていない求人。国籍の条件が付く求人は jobs_restricted に
 *   分けてある（同じ並びに出さない）。
 * ・living.rents は Bayut に載った**募集家賃**の平均で、成約した額ではない（living.rent_basis）。
 *   部屋数の組は地区ごとに違う（表に在る組だけ持っている）。
 *   ⚠️ 2026年上半期の表には、通貨の字も「年額」の字も無い（見出しは「Avg. Rent」だけ）。
 *   通貨は同じページの本文、年額は同じ Bayut の2025年版の表の見出しが根拠
 *   （rent_basis の currency と per。画面に単位を出すなら、この2つを一緒に読む）。
 *
 * ・intro は、概要のいちばん上に出す**短い紹介文**（歴史と規模）。字を書くのではなく、
 *   上の項目を {鍵} で指す ── {鍵} は値、{鍵:at} は時点、{鍵:cond} は条件、{鍵:city} は街。
 *   **数字と日付を手で打てない**（打つと検査で落ちる）ので、台帳より先のことを言えない。
 *   ⚠️ 紹介文に使った項目は、画面の数字の札には出さない（同じ数字を2回言わない）。
 *   ⚠️ 所有の移り変わり（owner_*）は紹介文に入れない。発表の日付と一緒に、出どころの面で出す
 *   （2026年の分は「決議」で、終わった事実として言えない）。
 *
 * 書いていないもの（会社の公表が見つからない・確かめられなかった）:
 *   設立の年月／パイロットの総数／従業員数（報道だけ）／787 の -9・-10 の内訳／
 *   機種ごとの年収（額が書いてあるのは A320 の上限だけ）／機長昇格までの年数／
 *   社員航空券の条件／マスダール・シティの家賃／空港までの所要時間・学費。
 *
 * 見るもの: node career-facts.mjs --check
 *           node career-facts.mjs --list   （全項目を出どころと引用つきで並べる）
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASIS, man } from './salary-basis.mjs';

/** 出どころの種類。報道は入れない（＝種類そのものが無い）。 */
export const SRC_KINDS = { company: '会社の公表', gov: '政府の公表', portal: '不動産ポータルの公表' };

/* 種類ごとの、出どころの置き場。ここに無い URL は検査で落ちる
   （報道の URL に company の札を付けて通す、ができない）。会社を足したらここにも足す。 */
const HOSTS = {
  company: [
    /^https:\/\/www\.etihad\.com\//,
    /^https:\/\/careers\.etihad\.com\//,
    /^https:\/\/jobs\.smartrecruiters\.com\/EtihadAirways5\//,
  ],
  gov:    [/^https:\/\/www\.mediaoffice\.abudhabi\//],
  portal: [/^https:\/\/www\.bayut\.com\//],
};

/** 就航地の地域（公式の就航地ページのタブ）。dir は写真の置き場の名前。 */
export const REGIONS = {
  'asia-australia':      { ja: 'アジア・オーストラリア', en: 'Asia and Australia',  dir: 'asia-and-australia' },
  'indian-subcontinent': { ja: 'インド亜大陸',           en: 'Indian Subcontinent', dir: 'indian-subcontinent' },
  'europe':              { ja: 'ヨーロッパ',             en: 'Europe',              dir: 'europe' },
  'north-america':       { ja: '北米',                   en: 'North America',       dir: 'north-america' },
};

/** 下の出どころを全部、この日に開いて確かめた。 */
export const CHECKED = '2026-10-04';

/* ── 既にある台帳から引くもの（写さない） ── */
const basisSrc = re => ((BASIS.etihad && BASIS.etihad.src) || []).find(s => re.test(String(s.url || ''))) || null;
const dateIn = s => (String((s && s.as_of) || '').match(/\d{4}-\d{2}-\d{2}/) || [null])[0];
const CAP_POST = basisSrc(/-captain$/);
const FO_POST  = basisSrc(/-first-officer$/);
const POSTED   = dateIn(CAP_POST);   // 求人の掲載日

/* ── 出どころ ── */
const NEWS  = 'https://www.etihad.com/en/news/';
const GOV   = 'https://www.mediaoffice.abudhabi/en/economy/';
const JOBS  = 'https://jobs.smartrecruiters.com/EtihadAirways5/';
const BAYUT = 'https://www.bayut.com/mybayut/';

const S = {
  first:  { name: 'エティハド航空の発表「Burj Khalifa lights up for Etihad’s 20th Anniversary」', kind: 'company', published: '2023-11-12',
            url: NEWS + 'burj-khalifa-lights-up-for-etihads-20th-anniversary' },
  zayed:  { name: 'エティハド航空の発表「Etihad Airways celebrates Zayed International Airport」', kind: 'company', published: '2024-02-09',
            url: NEWS + 'etihad-airways-celebrates-zayed-international-airport' },
  stats:  { name: 'エティハド航空の発表「Etihad reports February 2026 Traffic Statistics」', kind: 'company', published: '2026-03-13',
            url: NEWS + 'etihad-reports-february-2026-traffic-statistics' },
  pax:    { name: 'エティハド航空の発表「Etihad Airways delivers record passenger numbers and growth in 2025」', kind: 'company', published: '2026-01-12',
            url: NEWS + 'etihad-airways-delivers-record-passenger-numbers-and-growth-in-2025' },
  result: { name: 'エティハド航空の発表「Etihad Airways Delivers Record AED 2.6 Billion (U.S $ 698 Million) Profit in 2025」', kind: 'company', published: '2026-02-24',
            url: NEWS + 'etihad-airways-delivers-record-aed-26-billion-us--698-million-profit-in-2025-marking-strongest-performance-in-the-airlines-history' },
  terms:  { name: 'エティハド航空「Terms and Conditions」', kind: 'company',
            url: 'https://www.etihad.com/en/legal/terms-and-conditions' },
  dest:   { name: 'エティハド航空「Our Destinations」', kind: 'company',
            url: 'https://www.etihad.com/en/destinations' },
  pilots: { name: 'エティハド航空の採用サイト「Etihad Pilot Careers」', kind: 'company',
            url: 'https://careers.etihad.com/teams/pilots' },
  adq:    { name: 'アブダビ政府メディアオフィス「Etihad Aviation Group Transferred to ADQ’s Portfolio」', kind: 'gov', published: '2022-10-18',
            url: GOV + 'abu-dhabi-supreme-council-for-financial-and-economic-affairs-issues-a-decision-to-transfer-etihad-aviation-group-to-adq/' },
  limad:  { name: 'アブダビ政府メディアオフィス「Supreme Council for Financial and Economic Affairs Issues Resolution to Consolidate the Assets and Investments of L’IMAD Holding and Abu Dhabi Developmental Holding Group」', kind: 'gov', published: '2026-01-30',
            url: GOV + 'supreme-council-for-financial-and-economic-affairs-issues-resolution-to-consolidate-the-assets-and-investments-of-limad-holding-and-abu-dhabi-developmental-holding-group/' },
  capJob: { name: 'エティハド航空の求人「Captain」（SmartRecruiters）', kind: 'company', published: POSTED,
            url: CAP_POST ? CAP_POST.url : null },
  foJob:  { name: 'エティハド航空の求人「First Officer」（SmartRecruiters）', kind: 'company', published: dateIn(FO_POST),
            url: FO_POST ? FO_POST.url : null },
  instJob:  { name: 'エティハド航空の求人「Captain A320 - Instructor」（SmartRecruiters）', kind: 'company', published: '2026-07-31',
              url: JOBS + '744000140889738-captain-a320-instructor' },
  cadetJob: { name: 'エティハド航空の求人「Cadet Pilot Programme」（SmartRecruiters）', kind: 'company', published: '2026-05-06',
              url: JOBS + '744000124828215-cadet-pilot-programme' },
  bayutH1: { name: 'Bayut「Abu Dhabi Rental Market Report H1 2026」', kind: 'portal', updated: '2026-09-22',
             url: BAYUT + 'abu-dhabi-rental-market-report-h1-2026/' },
  bayut25: { name: 'Bayut「Abu Dhabi Rental Market Report for 2025」', kind: 'portal', updated: '2026-08-26',
             url: BAYUT + 'abu-dhabi-rental-market-report-2025/' },
};

/* ── 行を作る小さな関数（同じ出どころ・同じ時点を何度も書かないため） ── */
const STATS_AT = '2026-02-28';   // 「at the end of February」
const stat = o => ({ at: STATS_AT, as_of: CHECKED, src: S.stats, ...o });

const FLEET_Q = 'The fleet comprises 48 B787, 20 A320, 15 A321, 11 A321LR, 10 A350, 9 B777, 7 A380, 2 A330 and 6 B777F.';
const plane = (key, ja, value, more) => stat({ key, ja, value, unit: '機', quote: FLEET_Q, ...more });

/* 待遇は、機長・副操縦士・教官の求人3件に同じ中身で書いてある（出どころは機長の求人で代表）。 */
const perk  = o => ({ scope: 'all', at: POSTED, as_of: CHECKED, src: S.capJob, ...o });
const iperk = o => ({ scope: 'instructor', at: '2026-07-31', as_of: CHECKED, src: S.instJob, ...o });

const DEST_AT = CHECKED;   // 就航地のページは、開いた日の一覧
const dest = (iata, city_ja, country_ja, region, city_en, more) => ({
  iata, city_ja, country_ja, region, city_en,
  img: `${REGIONS[region].dir}/${iata}.jpg`,
  at: DEST_AT, as_of: CHECKED, src: S.dest, ...more,
});

const RENT_AT = '2026-H1';
const rent = (key, ja, en, segment, value, quote) => ({
  key, ja, en, segment, value, cur: 'AED', per: 'year', unit: 'AED/年',
  at: RENT_AT, as_of: CHECKED, src: S.bayutH1, quote,
});

export const FACTS = {
  etihad: {

    /* ── 紹介文（概要のいちばん上・歴史と規模）──
       字は下の項目から組み立てる（読むのは introText）。ここに数字・日付を打たない。
       飾りの形容を足さない。年収の話を入れない（すぐ下に本物の数字がある）。 */
    intro: [
      { ja: '最初の商業便は{first_flight}。{national_airline}で、拠点は{home_airport:city}の{home_airport}。',
        uses: ['first_flight', 'national_airline', 'home_airport'] },
      { ja: '{fleet_total:at}時点の運航機材は、{fleet_total:cond}{fleet_total}。{passengers_year:at}の旅客は{passengers_year}。',
        uses: ['fleet_total', 'passengers_year'] },
    ],

    /* ── 歴史・所有 ── 設立の年月は会社の公表に無い（書かない）。 */
    profile: [
      { key: 'first_flight', ja: '最初の商業便', value: '2003年11月12日（ベイルート行き）',
        at: '2003-11-12', as_of: CHECKED, src: S.first,
        quote: 'first commercial flight to Beirut took off on 12 November 2003' },
      { key: 'legal_form', ja: '会社の形', value: '公開株式会社（PJSC）。首長令で設立された、アブダビ首長国の法人',
        as_of: CHECKED, src: S.terms,
        quote: 'a Public Joint Stock Company established by Emiri Decree and is incorporated in the Emirate of Abu Dhabi, United Arab Emirates' },
      { key: 'national_airline', ja: '位置づけ', value: 'UAE のナショナル・エアライン',
        at: '2024-02-09', as_of: CHECKED, src: S.zayed,
        quote: 'Etihad Airways, the national airline of the UAE' },
      { key: 'owner_2022', ja: '所有（2022年10月の発表）',
        value: 'エティハド・アビエーション・グループの所有のすべてが、アブダビの投資・持株会社 ADQ へ移された',
        at: '2022-10-18', as_of: CHECKED, src: S.adq,
        quote: 'has transferred full ownership of Etihad Aviation Group (EAG) to ADQ' },
      { key: 'owner_2026', ja: '所有（2026年1月の発表）',
        value: '持株会社 L’IMAD と ADQ の資産と投資を、L’IMAD の傘下へまとめる決議。L’IMAD の投資先の1つにエティハド航空の名が挙がっている',
        at: '2026-01-30', as_of: CHECKED, src: S.limad,
        quote: 'Among these companies are TAQA, a major player in the power and water sector; Modon Properties; Etihad Airways',
        quote_more: ['under the umbrella of L’IMAD'] },
    ],

    /* ── 拠点 ── */
    base: {
      key: 'home_airport', ja: '拠点の空港', value: 'ザーイド国際空港',
      iata: 'AUH', city_ja: 'アブダビ', country_ja: 'アラブ首長国連邦',
      at: '2024-02-09', as_of: CHECKED, src: S.zayed,
      quote: 'celebrating the renaming of its home airport to Zayed International Airport today',
      iata_src: { as_of: CHECKED, src: S.terms, quote: 'At Zayed International Airport (AUH)' },
    },

    /* ── 規模 ──
       ⚠️ network_destinations（110・2月末・数え方つき）と network_headline（120以上・
       開いた日の見出し・数え方なし）は、別の時点の別の数え方。同じ画面に並べない。
       月次の発表は2026年2月分がいちばん新しい（それより後の機数・就航地数は見つからない）。 */
    scale: [
      stat({ key: 'fleet_total', ja: '運航している機材', value: 128, unit: '機',
        quote: 'The operating fleet stood at 128 aircraft at the end of February',
        cond_ja: '短期の借り受け（ACMI）と貨物機を含む',
        cond_quote: 'Including short-term aircraft, crew, maintenance and insurance ("ACMI") leases. Operating fleet includes freighters.' }),
      stat({ key: 'fleet_avg_age', ja: '機材の平均の機齢', value: 8.3, unit: '年',
        quote: 'The average fleet age is 8.3 years',
        cond_ja: 'ACMI の借り受けを除く',
        cond_quote: 'Average fleet age computed excluding ACMI leases.' }),
      stat({ key: 'network_destinations', ja: '就航地（ネットワーク）', value: 110, unit: 'か所',
        quote: 'with a global network of 110 destinations',
        cond_ja: '季節便・貨物の路線と、12か月以内に始まる予定の先を含む',
        cond_quote: 'Including seasonal and cargo routes, as well as destinations scheduled to begin operation within the next 12 months.' }),
      stat({ key: 'destinations_operated', ja: 'その月に実際に運航した就航地', value: 92, unit: 'か所', at: '2026-02',
        quote: 'Of these, 92 were operated in the month of February.' }),
      { key: 'passengers_year', ja: '1年間の旅客', value: 2240, unit: '万人',
        at: '2025', as_of: CHECKED, src: S.pax,
        quote: 'Etihad Airways carried 22.4 million passengers in 2025' },
      { key: 'pilots_joined_year', ja: 'その年に入社したパイロット', value: '400人近く',
        at: '2025', as_of: CHECKED, src: S.result,
        quote: 'around 1,600 cabin crew and almost 400 pilots joining the airline in 2025' },
      { key: 'pilot_promotions_year', ja: 'その年のパイロットの昇格', value: '150件近く',
        at: '2025', as_of: CHECKED, src: S.result,
        quote: 'nearly 150 pilot promotions during the year' },
      { key: 'network_headline', ja: '就航地の案内ページの見出し', value: '120以上の就航地・40以上の国',
        at: CHECKED, as_of: CHECKED, src: S.dest,
        quote: 'Connecting you to Abu Dhabi and 120+ destinations across 40+ countries.' },
    ],

    /* ── 機材の内訳（2026年2月末・合計は scale の fleet_total と同じ128）──
       key は発表の書き方のまま。787 の -9・-10 の内訳は発表に無い。 */
    fleet: [
      plane('B787',   'ボーイング787',   48),
      plane('A320',   'エアバスA320',    20),
      plane('A321',   'エアバスA321',    15),
      plane('A321LR', 'エアバスA321LR',  11),
      plane('A350',   'エアバスA350',    10),
      plane('B777',   'ボーイング777',    9),
      plane('A380',   'エアバスA380',     7),
      plane('A330',   'エアバスA330',     2),
      plane('B777F',  'ボーイング777F（貨物機）', 6, { freighter: true }),
    ],

    /* ── 待遇（求人に書いてあるもの）──
       教育手当は「up to」＝上限。1年あたりかどうかは原文に書いていない（期間を足さない）。
       教官の項目（scope: 'instructor'）は額が小さい。man() は万円に丸めるので、
       円で出すなら丸まり方を見る（AED 300 は約1万円になる）。 */
    benefits: [
      perk({ key: 'annual_leave', ja: '年次休暇', value: 42, unit: '日',
        quote: '42 days of annual leave' }),
      perk({ key: 'education_primary', ja: '教育手当（初等）', value: 40000, cur: 'AED',
        cond_ja: '上限。子1人あたり・子3人まで',
        ref: 'salary-basis.mjs#BASIS.etihad.notes[2]',
        quote: 'Education allowance of up to AED 40,000 for primary and AED 55,000 for secondary per child, for up to three children' }),
      perk({ key: 'education_secondary', ja: '教育手当（中等）', value: 55000, cur: 'AED',
        cond_ja: '上限。子1人あたり・子3人まで',
        ref: 'salary-basis.mjs#BASIS.etihad.notes[2]',
        quote: 'Education allowance of up to AED 40,000 for primary and AED 55,000 for secondary per child, for up to three children' }),
      perk({ key: 'housing', ja: '住宅', value: '住宅手当（年間パッケージの内訳の1つ）',
        ref: 'salary-basis.mjs#BASIS.etihad.notes[1]',
        quote: 'Your annual package includes basic salary, flying pay, housing allowance, and layover and meal allowances' }),
      perk({ key: 'staff_travel', ja: '社員航空券（Staff Travel）', value: '有り（条件の記載なし）',
        quote: 'Industry-leading staff travel benefits' }),
      perk({ key: 'annual_increment', ja: '昇給', value: '実績に応じた年次の昇給',
        quote: 'Your salary includes performance-based annual increments' }),
      perk({ key: 'income_protection', ja: '所得補償', value: '所得補償の制度',
        quote: 'Income protection scheme' }),
      perk({ key: 'insurance', ja: '保険', value: '傷害保険・生命保険',
        quote: 'Accidental and life insurance coverage' }),
      perk({ key: 'end_of_service', ja: '退職時', value: '退職時の給付',
        quote: 'End-of-service benefits' }),
      perk({ key: 'relocation', ja: '引越し', value: 'コンテナ輸送の手当・着任時の支援・家族の渡航',
        quote: 'a shipping container allowance, settling-in support, and family travel benefits' }),
      /* 求人が書いているのは「tax-free package」まで。ref の先（BASIS.etihad.tax）の
         かっこ書き「UAE に個人所得税なし」は、この求人には書いていない（この引用を根拠にしない）。 */
      perk({ key: 'tax', ja: '税', value: '非課税のパッケージ',
        ref: 'salary-basis.mjs#BASIS.etihad.tax',
        quote: 'Etihad provides a competitive, tax-free package' }),
      { key: 'command_path', ja: '機長昇格', value: '年数の目安の記載なし', scope: 'all',
        at: CHECKED, as_of: CHECKED, src: S.pilots,
        quote: 'opportunities to fast track to command' },

      /* 教官の求人だけに在る行。引用は原文の1行をまるごと（途中で切らない）。
         Travel allowance が1年あたりか1回かは、原文に書いていない（期間を足さない）。 */
      iperk({ key: 'instructor_travel', ja: '旅行手当（Travel allowance・教官）', value: 10000, cur: 'USD',
        cond_ja: '本人と対象の家族。1年あたりか1回かは書いていない',
        quote: 'USD 10,000 Travel allowance for self and eligible dependents' }),
      iperk({ key: 'instructor_fstd_tri', ja: '模擬機の訓練1回（4時間）・TRI', value: 1300, cur: 'AED',
        quote: 'FSTD 4-hour session (FFS/FTD): AED 1,300 for a TRI, AED 1,600 for a TRE' }),
      iperk({ key: 'instructor_fstd_tre', ja: '模擬機の訓練1回（4時間）・TRE', value: 1600, cur: 'AED',
        quote: 'FSTD 4-hour session (FFS/FTD): AED 1,300 for a TRI, AED 1,600 for a TRE' }),
      iperk({ key: 'instructor_line_rotation', ja: '路線での訓練・審査（1ローテーションあたり）', value: 800, cur: 'AED',
        cond_ja: '1区間あたりの額と、乗務時間の手当が加わる',
        quote: 'LIFUS or Line Evaluation of Competence: cumulative AED 800 per rotation + AED 300 per sector + Flying Hours Pay for all TRI/TRE' }),
      iperk({ key: 'instructor_line_sector', ja: '路線での訓練・審査（1区間あたり）', value: 300, cur: 'AED',
        cond_ja: '1ローテーションあたりの額に加わる',
        quote: 'LIFUS or Line Evaluation of Competence: cumulative AED 800 per rotation + AED 300 per sector + Flying Hours Pay for all TRI/TRE' }),
    ],

    /* ── いま出ている求人（2026-10-04 に3件とも開けた・応募のボタンが出ていた）──
       value は求人の題（原文）。posted は掲載日。3件とも A320・アブダビ勤務・常勤。
       pay_ref / req_ref の先（年収の上限・応募資格）は salary-basis.mjs が正。
       ⚠️ req_more の relief_hours は**応募資格の飛行時間の数え方**。給与の話ではない
       （BASIS.etihad.notes[3] と同じ原文。年収の前提として出さない）。 */
    jobs: [
      { key: 'cap-a320', ja: '機長（A320）', value: 'Captain', rank: 'cap', aircraft: 'A320', place_ja: 'アブダビ',
        url: S.capJob.url, posted: POSTED, at: POSTED, as_of: CHECKED, src: S.capJob,
        quote: 'To be considered for the role of Captain A320, you must meet the criteria below',
        pay_ref: 'salary-basis.mjs#BASIS.etihad.cap.groups[0].max_y',
        pay_quote: 'with the potential to earn up to AED 674,029 (USD 181,589)',
        req_ref: 'salary-basis.mjs#BASIS.etihad.cap.groups[0].req',
        req_more: [
          { key: 'relief_hours', ja: '交代要員つきの便で積んだ飛行時間の数え方（応募資格）',
            value: 'その時間の75%を、必要な飛行時間に数える',
            ref: 'salary-basis.mjs#BASIS.etihad.notes[3]',
            as_of: CHECKED, src: S.capJob,
            quote: 'In case of hours accumulated on flights with inflight relief, 75% of the total hours shall be counted towards the required minimum' },
        ] },
      { key: 'fo-a320', ja: '副操縦士（A320）', value: 'First Officer', rank: 'fo', aircraft: 'A320', place_ja: 'アブダビ',
        url: S.foJob.url, posted: dateIn(FO_POST), at: dateIn(FO_POST), as_of: CHECKED, src: S.foJob,
        quote: 'To be considered for the role of A320 First Officer',
        pay_ref: 'salary-basis.mjs#BASIS.etihad.fo.groups[0].max_y',
        pay_quote: 'AED 513,732 (USD 138,318)',
        req_ref: 'salary-basis.mjs#BASIS.etihad.fo.groups[0].req' },
      { key: 'cap-a320-instructor', ja: '機長・教官（A320）', value: 'Captain A320 - Instructor', rank: 'cap', role: 'instructor',
        aircraft: 'A320', place_ja: 'アブダビ', ref_no: '81149',
        url: S.instJob.url, posted: '2026-07-31', at: '2026-07-31', as_of: CHECKED, src: S.instJob,
        quote: 'To be considered for the role of Captain A320, you must meet the criteria below',
        pay_ref: 'salary-basis.mjs#BASIS.etihad.cap.groups[0].max_y',
        pay_quote: 'with the potential to earn up to AED 674,029 (USD 181,589)',
        req_ref: 'salary-basis.mjs#BASIS.etihad.cap.groups[0].req',
        req_more: [
          { key: 'instructor_years', ja: '教官・審査員の経験', value: 'A320 の教官または審査員（TRI／TRE）として3年',
            as_of: CHECKED, src: S.instJob,
            quote: '3 years as an A320 Instructor and/or Examiner (TRI/TRE)' },
          { key: 'instructor_fstd_hours', ja: '模擬機での訓練の経験', value: '1,000時間',
            as_of: CHECKED, src: S.instJob,
            quote: '1000 hours of FSTD training' },
          { key: 'instructor_line_hours', ja: '路線での訓練（LIFUS／IOE）の経験', value: '1,000時間',
            as_of: CHECKED, src: S.instJob,
            quote: '1000 hours of LIFUS/IOE experience' },
          { key: 'relief_hours', ja: '交代要員つきの便で積んだ飛行時間の数え方（応募資格）',
            value: 'その時間の75%を、必要な飛行時間に数える',
            ref: 'salary-basis.mjs#BASIS.etihad.notes[3]',
            as_of: CHECKED, src: S.instJob,
            quote: 'In case of hours accumulated on flights with inflight relief, 75% of the total hours shall be counted towards the required minimum' },
        ] },
    ],

    /* ── 国籍の条件が付く求人（jobs と同じ並びに出さない）── 訓練中の給与の額は持たない。 */
    jobs_restricted: [
      { key: 'cadet-uae', ja: '訓練生（UAE 国籍の人だけ）', value: 'Cadet Pilot Programme', rank: 'cadet', aircraft: null,
        place_ja: 'アブダビ', ref_no: '79246', cond_ja: 'UAE 国籍・18〜29歳',
        url: S.cadetJob.url, posted: '2026-05-06', at: '2026-05-06', as_of: CHECKED, src: S.cadetJob,
        quote: 'Are a UAE National',
        quote_more: ['Are aged 18-29', 'UAE National Cadet Pilot Programme'] },
    ],

    /* ── 就航地（公式の就航地ページに、街の札として出ているもの）──
       候補の30空港は全部在った。季節便の札（「Seasonal flights」）が付いているのは KIX だけ。
       ⚠️ 一覧に在る ＝ 就航地。その日に飛んでいるか・乗員が泊まるかは、このページからは分からない。 */
    destinations: [
      dest('NRT', '東京',           '日本',           'asia-australia', 'Tokyo'),
      dest('KIX', '大阪',           '日本',           'asia-australia', 'Osaka',
        { seasonal: true, seasonal_quote: 'Seasonal flights', img: 'seasonal/KIX.jpg' }),
      dest('TPE', '台北',           '台湾',           'asia-australia', 'Taipei'),
      dest('HKG', '香港',           '香港',           'asia-australia', 'Hong Kong'),
      dest('ICN', 'ソウル',         '韓国',           'asia-australia', 'Seoul'),
      dest('BKK', 'バンコク',       'タイ',           'asia-australia', 'Bangkok'),
      dest('SIN', 'シンガポール',   'シンガポール',   'asia-australia', 'Singapore'),
      dest('KUL', 'クアラルンプール', 'マレーシア',   'asia-australia', 'Kuala Lumpur'),
      dest('CGK', 'ジャカルタ',     'インドネシア',   'asia-australia', 'Jakarta'),
      dest('MNL', 'マニラ',         'フィリピン',     'asia-australia', 'Manila'),
      dest('SYD', 'シドニー',       'オーストラリア', 'asia-australia', 'Sydney'),
      dest('MEL', 'メルボルン',     'オーストラリア', 'asia-australia', 'Melbourne'),

      dest('DEL', 'ニューデリー',   'インド', 'indian-subcontinent', 'New Delhi'),
      dest('BOM', 'ムンバイ',       'インド', 'indian-subcontinent', 'Mumbai'),
      dest('BLR', 'ベンガルール',   'インド', 'indian-subcontinent', 'Bengaluru'),

      dest('LHR', 'ロンドン',       'イギリス', 'europe', 'London'),
      dest('CDG', 'パリ',           'フランス', 'europe', 'Paris'),
      dest('FRA', 'フランクフルト', 'ドイツ',   'europe', 'Frankfurt'),
      dest('MUC', 'ミュンヘン',     'ドイツ',   'europe', 'Munich'),
      dest('AMS', 'アムステルダム', 'オランダ', 'europe', 'Amsterdam'),
      dest('MXP', 'ミラノ',         'イタリア', 'europe', 'Milan'),
      dest('FCO', 'ローマ',         'イタリア', 'europe', 'Rome'),
      dest('ZRH', 'チューリッヒ',   'スイス',   'europe', 'Zurich'),
      dest('MAD', 'マドリード',     'スペイン', 'europe', 'Madrid'),
      dest('BCN', 'バルセロナ',     'スペイン', 'europe', 'Barcelona'),

      dest('JFK', 'ニューヨーク',   'アメリカ', 'north-america', 'New York'),
      dest('IAD', 'ワシントン',     'アメリカ', 'north-america', 'Washington'),
      dest('ORD', 'シカゴ',         'アメリカ', 'north-america', 'Chicago'),
      dest('BOS', 'ボストン',       'アメリカ', 'north-america', 'Boston'),
      dest('YYZ', 'トロント',       'カナダ',   'north-america', 'Toronto'),
    ],

    /* ── アブダビの暮らし ──
       rents の key は街の写真の台帳（place-photos.mjs）と同じ名前。
       value は部屋数ごとの額（studio＝ワンルーム・bed1〜bed3＝寝室の数）。
       表の「Avg. Rent」（どの広さを含む平均かが書いていない）は持たない。
       ⚠️ 並べて比べられるのは、4地区とも在る bed1 と bed2 だけ。
       マスダール・シティはこの資料に無い（行を作らない）。 */
    living: {
      city_ja: 'アブダビ',
      rents: [
        rent('khalifa', 'ハリファ・シティ',   'Khalifa City',   'affordable', { studio: 39000, bed1: 59000, bed2: 104000 },
          'Khalifa City Avg. Rent 57,000 Studio 39,000 1-Bed 59,000 2-Bed 104,000'),
        rent('reem',    'アル・リーム島',     'Al Reem Island', 'mid-tier',   { studio: 70000, bed1: 94000, bed2: 128000 },
          'Al Reem Island Avg. Rent 121,000 Studio 70,000 1-Bed 94,000 2-Bed 128,000'),
        rent('alraha',  'アル・ラハ・ビーチ', 'Al Raha Beach',  'luxury',     { bed1: 111000, bed2: 146000, bed3: 187000 },
          'Al Raha Beach Avg. Rent 141,000 1-Bed 111,000 2-Bed 146,000 3-Bed 187,000'),
        rent('yas',     'ヤス島',             'Yas Island',     'luxury',     { bed1: 113000, bed2: 176000, bed3: 235000 },
          'Yas Island Avg. Rent 141,000 1-Bed 113,000 2-Bed 176,000 3-Bed 235,000'),
      ],
      rent_basis: [
        { key: 'what', ja: '何の額か',
          value: 'Bayut に不動産会社が載せた、入居できる集合住宅の募集家賃の平均（ルームシェアを除く）。成約した額ではない',
          at: RENT_AT, as_of: CHECKED, src: S.bayutH1,
          quote: 'is based on prices for ready properties advertised by real estate agencies on behalf of their clients on Bayut.com (excluding room share), and is not representative of actual real estate transactions conducted in Abu Dhabi' },
        { key: 'period', ja: 'いつの額か', value: '2026年1〜6月',
          at: RENT_AT, as_of: CHECKED, src: S.bayutH1,
          quote: 'our data analysts have compared average asking rents in H1 2026 with those observed in H2 2025' },
        { key: 'currency', ja: '通貨', value: 'AED',
          cond_ja: '表そのものに通貨の字は無い。ハリファ・シティと同じ表のアル・シャムハの平均（表では 63,000）を、同じページの本文が「AED 63k」と書いている',
          at: RENT_AT, as_of: CHECKED, src: S.bayutH1,
          quote: 'Al Shamkha reported a slight adjustment, with average rent rounding up to AED 63k.',
          quote_more: ['Al Shamkha Avg. Rent 63,000'] },
        { key: 'per', ja: '額の単位', value: '1年あたり',
          cond_ja: '2026年上半期の表の見出しは「Avg. Rent」だけで、「年額」とは書いていない。「年額」と書いてあるのは、同じ Bayut の2025年版の同じ形の表の見出し',
          at: '2025', as_of: CHECKED, src: S.bayut25,
          quote: 'Avg. Yearly Rent' },
      ],
    },
  },
};

/* ════════════ 読むための関数 ════════════ */

/** 空白のそろえ方（引用と、出どころの本文の両方に使う）。nbsp も普通の空白1つにする。 */
export const squash = s => String(s ?? '').replace(/\s+/g, ' ').trim();
/** タグを外した本文に、その引用が在るか。 */
export const quoted = (pageText, quote) => squash(pageText).includes(squash(quote));

/** ref（'salary-basis.mjs#BASIS.etihad.notes[2]'）が指す値。無ければ undefined。 */
export function resolveRef(ref) {
  const [file, p] = String(ref || '').split('#');
  if (file !== 'salary-basis.mjs' || !p || !p.startsWith('BASIS.')) return undefined;
  let cur = BASIS;
  for (const t of p.slice('BASIS.'.length).match(/[^.[\]]+/g) || []) {
    if (cur == null) return undefined;
    cur = cur[t];
  }
  return cur;
}

/** その社の全項目を [在りか, 項目, 種類] で順に返す（検査と --list が同じ並びを歩く）。 */
export function* allItems(slug) {
  const a = FACTS[slug];
  if (!a) return;
  for (const k of ['profile', 'scale', 'fleet', 'benefits', 'jobs', 'jobs_restricted']) {
    for (const [i, x] of (a[k] || []).entries()) {
      yield [`${k}[${i}]`, x, k];
      for (const [j, y] of (x.req_more || []).entries()) yield [`${k}[${i}].req_more[${j}]`, y, 'req_more'];
    }
  }
  if (a.base) {
    yield ['base', a.base, 'base'];
    if (a.base.iata_src) yield ['base.iata_src', a.base.iata_src, 'part'];
  }
  for (const [i, x] of (a.destinations || []).entries()) yield [`destinations[${i}]`, x, 'destinations'];
  const l = a.living || {};
  for (const [i, x] of (l.rents || []).entries()) yield [`living.rents[${i}]`, x, 'rents'];
  for (const [i, x] of (l.rent_basis || []).entries()) yield [`living.rent_basis[${i}]`, x, 'rent_basis'];
}

/** IATA からその社の就航地の行。無ければ null（＝確かめられていない先）。 */
export const destination = (slug, iata) =>
  ((FACTS[slug] || {}).destinations || []).find(d => d.iata === String(iata || '').toUpperCase()) || null;

/* ── 紹介文（intro）── 字は台帳の項目から組み立てる ── */
const INTRO_SLOT = /\{([a-z0-9_]+)(?::(at|cond|city))?\}/g;

/** 鍵からその社の項目（歴史・拠点・規模の中から）。無ければ null。 */
export function factByKey(slug, key) {
  const a = FACTS[slug] || {};
  if (a.base && a.base.key === key) return a.base;
  return [...(a.profile || []), ...(a.scale || [])].find(x => x.key === key) || null;
}

/** at（いつの話か）を画面の字に。'2026-02-28' → 2026年2月28日／'2025' → 2025年／'2026-H1' → 2026年上半期。 */
export function atText(at) {
  const m = String(at ?? '').match(/^(\d{4})(?:-(?:(\d{2})(?:-(\d{2}))?|H([12])))?$/);
  if (!m) return '';
  if (m[4]) return `${m[1]}年${m[4] === '1' ? '上半期' : '下半期'}`;
  return `${m[1]}年` + (m[2] ? `${Number(m[2])}月` : '') + (m[3] ? `${Number(m[3])}日` : '');
}

/** 値を画面の字に（数字はけた区切り＋単位。概数の字はそのまま）。金額（cur つき）には使わない。 */
export const valueText = x =>
  typeof x.value === 'number' ? `${x.value.toLocaleString('en-US')}${x.unit || ''}` : String(x.value ?? '');

/** 紹介文を [{ text, uses }] で返す。組み立てられない文は text が null（画面に出さない）。 */
export function introText(slug) {
  return ((FACTS[slug] || {}).intro || []).map(s => {
    let ok = true;
    const text = String(s.ja).replace(INTRO_SLOT, (_, key, part) => {
      const x = factByKey(slug, key);
      const v = !x ? '' : part === 'at' ? atText(x.at) : part === 'cond' ? (x.cond_ja || '')
        : part === 'city' ? (x.city_ja || '') : valueText(x);
      if (!v) ok = false;
      return v;
    });
    return { text: ok ? text : null, uses: [...(s.uses || [])] };
  });
}

export default FACTS;

/* ════════════ 自己検査（node career-facts.mjs --check）════════════ */

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const AT  = /^\d{4}(-(\d{2}(-\d{2})?|H[12]))?$/;
/* 書かないと決めた項目（従業員数は報道だけ／設立の年月・パイロットの総数は公表が見つからない）。 */
const BANNED_KEYS = ['employees', 'employee_count', 'founded', 'founding', 'pilots_total', 'pilot_count'];
const NEEDS_AT = new Set(['scale', 'fleet', 'benefits', 'jobs', 'jobs_restricted', 'destinations', 'rents', 'rent_basis']);
/* 紹介文に入れない項目（見出しの「120以上」は数え方が無い／所有は発表の日付と一緒に別の面で出す）。 */
const INTRO_NOT = ['network_headline', 'owner_2022', 'owner_2026'];
/* 台帳が言っていない言い方（飾りの形容・原文に無い断定）。 */
const INTRO_BANNED = /国営|政府系|アブダビ発|世界最大|世界有数|最大級|屈指|急成長|名門|一流|年収|給与/;
const INTRO_MAX = 140;   // 全部の文を合わせた字数

export function check() {
  const bad = [];
  const fail = (where, msg) => bad.push(`${where}: ${msg}`);
  let n = 0;

  for (const slug of Object.keys(FACTS)) {
    const a = FACTS[slug];
    const seen = {};

    for (const [where0, x, type] of allItems(slug)) {
      const where = `${slug}.${where0}`;
      n++;

      /* 出どころと確かめた日（全項目） */
      const s = x.src;
      if (!s || typeof s !== 'object') { fail(where, 'src が無い'); continue; }
      if (!s.name) fail(where, 'src.name が無い');
      if (typeof s.url !== 'string' || !/^https:\/\/\S+$/.test(s.url)) fail(where, `src.url が無い・https でない（${s.url}）`);
      if (!Object.prototype.hasOwnProperty.call(SRC_KINDS, s.kind)) fail(where, `src.kind が白リストに無い（${s.kind}）`);
      else if (typeof s.url === 'string' && !HOSTS[s.kind].some(re => re.test(s.url))) fail(where, `src.url が ${s.kind} の置き場ではない（${s.url}）`);
      if (!ISO.test(String(x.as_of || ''))) fail(where, `as_of が日付でない（${x.as_of}）`);
      if (x.at != null && !AT.test(String(x.at))) fail(where, `at の形が違う（${x.at}）`);
      if (NEEDS_AT.has(type) && x.at == null) fail(where, 'at（いつの話か）が無い');

      /* 就航地は形が別 */
      if (type === 'destinations') {
        if (!/^[A-Z]{3}$/.test(String(x.iata || ''))) fail(where, `IATA が英大文字3字でない（${x.iata}）`);
        if (!x.city_ja || !x.country_ja || !x.city_en) fail(where, 'city_ja / country_ja / city_en が無い');
        if (!REGIONS[x.region]) fail(where, `region が白リストに無い（${x.region}）`);
        if (!String(x.img || '').endsWith(`/${x.iata}.jpg`)) fail(where, `img が IATA と合わない（${x.img}）`);
        if (x.seasonal !== undefined && x.seasonal !== true) fail(where, 'seasonal は true か、書かないか');
        if (x.seasonal && !x.seasonal_quote) fail(where, '季節便の印に原文の引用が無い');
        if (x.seasonal && x.seasonal_quote !== squash(x.seasonal_quote)) fail(where, '季節便の引用の空白がそろっていない');
        continue;
      }

      /* 引用（全項目）。空白はそろえた形で持つ（nbsp や二重の空白が混ざると、突き合わせで黙って外れる） */
      if (typeof x.quote !== 'string' || !x.quote.trim()) fail(where, 'quote が無い');
      for (const q of x.quote_more || []) if (typeof q !== 'string' || !q.trim()) fail(where, 'quote_more に空がある');
      if (x.cond_quote !== undefined && !x.cond_ja) fail(where, 'cond_quote に日本語の条件（cond_ja）が無い');
      for (const q of [x.quote, ...(x.quote_more || []), x.cond_quote, x.pay_quote]) {
        if (typeof q === 'string' && q !== squash(q)) fail(where, `引用の空白がそろっていない（${JSON.stringify(q)}）`);
      }
      if (type === 'part') continue;

      /* 名前と中身 */
      if (!x.key || !x.ja) fail(where, 'key / ja が無い');
      if (BANNED_KEYS.includes(x.key)) fail(where, `書かないと決めた項目（${x.key}）`);
      const list = where0.replace(/\[\d+\]$/, '');
      seen[list] = seen[list] || new Set();
      if (seen[list].has(x.key)) fail(where, `key が重なっている（${x.key}）`);
      seen[list].add(x.key);
      if (x.value === undefined && !x.ref) fail(where, 'value も ref も無い');
      if (typeof x.value === 'number' && !x.unit && !x.cur) fail(where, '数字に unit も cur も無い');

      /* 金額は元の通貨と額。円に直せる通貨か（率そのものはここに持たない） */
      if (x.cur) {
        const amounts = type === 'rents' ? Object.values(x.value || {}) : [x.value];
        if (!amounts.length) fail(where, '額が無い');
        for (const v of amounts) {
          if (typeof v !== 'number' || !(v > 0)) fail(where, `額が正の数でない（${v}）`);
          else if (!Number.isFinite(man(x.cur, v))) fail(where, `円に直せない通貨（${x.cur}）`);
        }
      }

      /* 台帳を指す矢印は、指した先が在る */
      for (const k of ['ref', 'pay_ref', 'req_ref']) {
        if (x[k] !== undefined && resolveRef(x[k]) === undefined) fail(where, `${k} の先が無い（${x[k]}）`);
      }
      /* 求人: URL・掲載日・引いてきた年収の上限と、求人の原文が同じ額か */
      if (type === 'jobs' || type === 'jobs_restricted') {
        if (x.url !== s.url) fail(where, 'url と src.url が違う');
        if (!ISO.test(String(x.posted || ''))) fail(where, `posted（掲載日）が日付でない（${x.posted}）`);
        if (x.pay_ref) {
          const max = resolveRef(x.pay_ref);
          if (typeof max === 'number' && !String(x.pay_quote || '').includes(max.toLocaleString('en-US')))
            fail(where, `台帳の上限（${max}）が求人の引用（pay_quote）に無い`);
        }
      }
    }

    /* 就航地: IATA の重なり・拠点が混ざっていない・「就航地」より先を言っていない */
    const ds = a.destinations || [];
    const codes = ds.map(d => d.iata);
    for (const c of new Set(codes)) if (codes.filter(v => v === c).length > 1) fail(`${slug}.destinations`, `IATA が重なっている（${c}）`);
    if (a.base && codes.includes(a.base.iata)) fail(`${slug}.destinations`, `拠点（${a.base.iata}）が就航地に入っている`);
    if (a.base && !/^[A-Z]{3}$/.test(String(a.base.iata || ''))) fail(`${slug}.base`, 'IATA が英大文字3字でない');
    if (/ステイ|宿泊|ホテル|\bstay|hotel|layover/i.test(JSON.stringify(ds.map(({ src, ...d }) => d))))
      fail(`${slug}.destinations`, '就航地の行に、泊まる話の語がある（言えるのは「就航地」まで）');

    /* 機材: 内訳の合計が、同じ発表の総数と合う */
    const total = (a.scale || []).find(x => x.key === 'fleet_total');
    if (total && (a.fleet || []).length) {
      const sum = a.fleet.reduce((t, x) => t + x.value, 0);
      if (sum !== total.value) fail(`${slug}.fleet`, `内訳の合計 ${sum} が総数 ${total.value} と合わない`);
    }

    /* 紹介文: 字が台帳の項目だけでできている
       （手で打った数字が無い／条件つきの数字に条件が付いている／規模の数字に時点が付いている／同じ項目を2回言わない） */
    const intro = a.intro || [];
    if (intro.length > 3) fail(`${slug}.intro`, `文が多い（${intro.length}。3つまで）`);
    const built = introText(slug);
    const usedAll = [];
    for (const [i, s] of intro.entries()) {
      const where = `${slug}.intro[${i}]`;
      if (typeof s.ja !== 'string' || !s.ja.trim()) { fail(where, 'ja が無い'); continue; }
      const slots = [...s.ja.matchAll(INTRO_SLOT)].map(m => ({ key: m[1], part: m[2] || 'value' }));
      const keys = [...new Set(slots.map(t => t.key))];
      if (JSON.stringify(keys) !== JSON.stringify(s.uses || [])) fail(where, `uses が、文の中の鍵と合わない（文の中: ${keys.join(', ')}）`);
      const bare = s.ja.replace(INTRO_SLOT, () => '');
      if (/[{}]/.test(bare)) fail(where, '読めない {…} が残っている');
      if (/[0-9０-９〇一二三四五六七八九十百千]/.test(bare)) fail(where, '数字を手で打っている（数字と日付は台帳の項目から入れる）');
      const word = bare.match(INTRO_BANNED);
      if (word) fail(where, `紹介文に書かない言い方（${word[0]}）`);
      for (const key of keys) {
        if (INTRO_NOT.includes(key)) { fail(where, `紹介文に入れない項目（${key}）`); continue; }
        const x = factByKey(slug, key);
        if (!x) { fail(where, `台帳に無い鍵（${key}）`); continue; }
        const has = part => slots.some(t => t.key === key && t.part === part);
        if (has('at') && !atText(x.at)) fail(where, `時点（at）が無い項目に :at を使っている（${key}）`);
        if (has('cond') && !x.cond_ja) fail(where, `条件（cond_ja）が無い項目に :cond を使っている（${key}）`);
        if (has('city') && !x.city_ja) fail(where, `街（city_ja）が無い項目に :city を使っている（${key}）`);
        if (has('value') && x.cond_ja && !has('cond')) fail(where, `条件つきの数字を、条件なしで出している（${key}）`);
        if (has('value') && (a.scale || []).includes(x) && !has('at')) fail(where, `規模の数字に時点が付いていない（${key}）`);
        if (usedAll.includes(key)) fail(where, `同じ項目を2つの文で使っている（${key}）`);
        usedAll.push(key);
      }
      if (!built[i].text) fail(where, '文を組み立てられない');
    }
    const whole = built.map(b => b.text || '').join('');
    if (whole.length > INTRO_MAX) fail(`${slug}.intro`, `長い（${whole.length}字。${INTRO_MAX}字まで）`);
  }

  /* 既にある台帳との食い違い（同じ事実が2か所で別の値になっていないか） */
  const e = FACTS.etihad;
  const note = String(resolveRef('salary-basis.mjs#BASIS.etihad.notes[2]') || '');
  for (const x of e.benefits.filter(b => /^education_/.test(b.key))) {
    if (!note.includes(`${x.cur} ${x.value.toLocaleString('en-US')}`))
      fail(`etihad.benefits.${x.key}`, `salary-basis.mjs の注記の額と合わない（${x.cur} ${x.value}）`);
  }
  if (!CAP_POST || !FO_POST) fail('etihad.jobs', 'salary-basis.mjs の BASIS.etihad.src に機長・副操縦士の求人が見つからない');

  return { n, bad };
}

function list() {
  for (const slug of Object.keys(FACTS)) {
    for (const [i, b] of introText(slug).entries()) {
      console.log(`■ ${slug}.intro[${i}]  紹介文（${b.uses.join(' ＋ ')}）`);
      console.log(`   ${b.text ?? '（組み立てられない）'}`);
    }
    for (const [where, x] of allItems(slug)) {
      const v = x.iata && x.city_en ? `${x.iata} ${x.city_ja}（${x.country_ja}）${x.seasonal ? '・季節便' : ''}`
        : x.value === undefined ? `→ ${x.ref}`
        : typeof x.value === 'object' ? JSON.stringify(x.value)
        : `${x.cur ? x.cur + ' ' : ''}${x.value}${x.unit && !x.cur ? x.unit : ''}`;
      console.log(`■ ${slug}.${where}  ${x.key || ''}  ${x.ja || ''}`);
      console.log(`   値: ${v}${x.cond_ja ? `（${x.cond_ja}）` : ''}`);
      console.log(`   時点: ${x.at ?? '—'} ／ 確かめた日: ${x.as_of}`);
      console.log(`   出どころ: [${x.src.kind}] ${x.src.url}`);
      const quotes = x.city_en ? [x.city_en, x.img, x.seasonal_quote] : [x.quote, ...(x.quote_more || []), x.cond_quote, x.pay_quote];
      for (const q of quotes.filter(Boolean)) console.log(`   引用: ${q}`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--list')) list();
  if (args.includes('--check') || !args.includes('--list')) {
    const { n, bad } = check();
    if (bad.length) {
      for (const b of bad) console.log(`❌ ${b}`);
      console.log(`\n❌ career-facts: ${bad.length}件`);
      process.exit(1);
    }
    const e = FACTS.etihad;
    console.log(`✅ career-facts: ${n}項目（出どころ・確かめた日・引用・種類の白リスト・IATA ${e.destinations.length}件が3字で重なりなし・台帳との食い違いなし・紹介文 ${introText('etihad').length}文は台帳の項目だけ）`);
  }
}
