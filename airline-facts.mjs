/* 会社ごとの公開情報の台帳・その2（2026-10-05）。日本航空・ANA・キャセイパシフィック航空・エバー航空。
 *
 * 会社ページの最初の1画面（給与の右に並ぶ「勤務」「待遇」）と、その下の「会社」の節が出す事実の置き場。
 * エティハド航空は career-facts.mjs に在る（形は同じ。ここには写さない）。
 * 年収の額と出どころは salary-basis.mjs・salary-sources.mjs が正で、ここには写さない
 * （キャセイの副操縦士の目標年収・エバー航空の副操縦士の募集の額は、あちらに在る）。
 * 住む街の家賃と空港までの足は living-facts.mjs。
 *
 * ・決まりは career-facts.mjs と同じ。
 *   - **出どころのページを開いて、原文で確かめた事実だけを置く。**
 *     確かめられなかったものは**行を作らない**（「公表なし」は画面を作る側が、中身の分かる入口として出す）。
 *     画像の中にしか無い字・文字として取り出せなかった PDF の数字は、行にしていない。
 *   - どの項目も { key, ja, value, unit?, cur?, at, at_ja?, as_of, cond_ja?, src, quote }。
 *     as_of ＝ 出どころを開いて確かめた日／at ＝ その事実がいつの話か（画面の「◯◯時点」はこちら）。
 *     at_ja ＝ at を字で言い直したもの（「2027年度入社の募集要項」「2024年度の実績」）。在ればこちらを出す。
 *     ⚠️ at が '2026-10' で at_ja が付いている行は、**ページに日付が無い**。at は開いた月で、掲載日ではない。
 *   - quote ＝ 原文の短い引用。空白だけそろえてある（career-facts.mjs の squash）。
 *   - cond_ja ＝ 原文がその数字に付けている条件。**条件つきの数字を、条件なしで出さない。**
 *     金額（cur つき）には必ず条件を書く（誰の・何の額か）。
 *   - 金額は**元の通貨と額**（cur と value）。円は画面を作る側が salary-basis.mjs の man() で出す。
 * ・ここだけの印が2つある。
 *   - lead: true ＝ **最初の1画面に出す1つ**（work と benefits に1つずつ）。
 *     ⚠️ 会社ごとに物差しが違う（月の休日／年次休暇の日数）。横に並べても、同じものの比較としては出さない。
 *   - pilot ＝ パイロットについて書かれた条件か（true）、全社員の制度・数字か（false）。
 *     work・benefits・jobs には必ず書く。false のものを「パイロットの条件」と呼ばない。
 * ・base は「乗務を始めてからの勤務地」。iata は**出どころのページが名前を挙げた空港**の3レター。
 *   - 日本航空 ── 募集要項が「羽田空港、成田空港など」と空港名で書いている（コードの字は無い）。
 *   - ANA ── 募集要項は「東京にて勤務」まで。**空港の名前を挙げていないので、コードは空**。
 *     会社の空港案内に HND・NRT は在るが、あれは旅客向けの一覧で、乗員の所属を言ったものではない。
 *   - キャセイ・エバー航空 ── コードは別のページから取った（iata_src）。
 * ・fleet は、同じ発表の機種ごとの数。合計が scale.fleet_total と合う（検査が見ている）。
 * ・jobs は、いま会社が出している募集について言えること。機長・副操縦士の年収ではない。
 *
 * 書いていないもの（会社の公表が見つからない・確かめられなかった）:
 *   4社とも ── パイロットの定年／月や年の乗務時間の前提／ロスターの型／訓練費の返還の決まり／
 *              住宅の補助の額／賞与の額・月数／機長・副操縦士の給与表。
 *   日本航空 ── 機長と副操縦士それぞれの人数／優待搭乗の中身／年次有給休暇の付与日数。
 *              パイロットの平均年齢（43.1歳）は、表に報告の範囲の注記が無い。
 *              路線数（211）は、画像の代わりの字（alt）にだけ在り、コードシェアを含むかは書かれていない。
 *   ANA ────── 社員の優待搭乗／経験者の募集要項／パイロットの平均年齢（図の中にしか無い）。
 *   キャセイ ── パイロットの人数／機長の募集／月の休日・乗務時間／会社単独の就航地の合計。
 *   エバー航空 ─ パイロットの人数／機長の募集／賞与の月数。
 *
 * 見るもの: node airline-facts.mjs --check
 *           node airline-facts.mjs --list   （全項目を出どころと引用つきで並べる）
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { man } from './salary-basis.mjs';
import { SRC_KINDS, squash, quoted, atText, valueText, fillIntro, checkIntro,
  atTextEn, twinOf, fillIntroEn, checkTwins, checkIntroEn } from './career-facts.mjs';

export { SRC_KINDS, squash, quoted, atText, valueText };

/* 出どころの置き場（種類ごと）。ここに無い場所の URL は検査で落ちる。 */
const HOSTS = {
  company: [
    /^https:\/\/www\.jal\.com\//,
    /^https:\/\/www\.job-jal\.com\//,
    /^https:\/\/press\.jal\.co\.jp\//,
    /^https:\/\/disclosure2dl\.edinet-fsa\.go\.jp\//,   // 有価証券報告書（会社が出した書類の置き場）
    /^https:\/\/www\.ana\.co\.jp\//,
    /^https:\/\/www\.cathaypacific\.com\//,
    /^https:\/\/careers\.cathaypacific\.com\//,
    /^https:\/\/news\.cathaypacific\.com\//,
    /^https:\/\/flights\.cathaypacific\.com\//,
    /^https:\/\/www\.evaair\.com\//,
  ],
  gov: [],
  portal: [],
};

/** 出どころを開いて確かめた日。 */
export const CHECKED = '2026-10-04';
/** そのあとで出どころを開き直して、引用の字が今も在ることを確かめた項目の日（募集の行だけ。日付だけを進めない）。 */
const REREAD = '2026-10-08';

const JAL = {
  outline: { name: '日本航空「会社概要」', kind: 'company',
    url: 'https://www.jal.com/ja-jp/about/outline/' },
  hist: { name: '日本航空「JALの歴史 2000年代」', kind: 'company',
    url: 'https://www.jal.com/ja-jp/about/jal-history-75th/index00s.html' },
  req: { name: '日本航空の採用サイト「職種別募集要項 パイロット（新卒）」', kind: 'company',
    url: 'https://www.job-jal.com/recruit/requirement/new-graduate05.html' },
  fleet: { name: '日本航空「航空機数」', kind: 'company',
    url: 'https://www.jal.com/ja-jp/about/air/aircraft.html' },
  route: { name: '日本航空「運航路線数」', kind: 'company',
    url: 'https://www.jal.com/ja-jp/about/air/route.html' },
  safety: { name: '「JALグループ安全報告書 2025年度」', kind: 'company', published: '2026-07',
    url: 'https://www.jal.com/sites/ja/safety/report/pdf_sites/index_020_ja.pdf' },
  esg: { name: '日本航空「JAL Group ESG Data」', kind: 'company',
    url: 'https://www.jal.com/sites/en/sustainability/esg/pdf_sites/esg.pdf' },
  yuho: { name: '日本航空 有価証券報告書 第77期（2025年4月〜2026年3月）', kind: 'company', published: '2026-06-22',
    url: 'https://disclosure2dl.edinet-fsa.go.jp/searchdocument/pdf/S100YFIO.pdf' },
  jobtype: { name: '日本航空の採用サイト「職種紹介 自社養成パイロット」', kind: 'company',
    url: 'https://www.job-jal.com/work-people/jobtype2/' },
  press: { name: '日本航空の発表「JALグループ、2027年度入社の新卒採用の募集を開始」', kind: 'company', published: '2026-02-27',
    url: 'https://press.jal.co.jp/ja/release/202602/009388.html' },
};

const ANA = {
  history: { name: 'ANA「ANAグループの歩み」', kind: 'company',
    url: 'https://www.ana.co.jp/group/about-us/turning-point/' },
  ir: { name: 'ANAホールディングス「統合報告書 2026」', kind: 'company',
    url: 'https://www.ana.co.jp/group/investors/irdata/annual/pdf/26/26_00_1.pdf' },
  req: { name: 'ANAの採用サイト「2027年度新卒 募集要項（運航乗務職）」', kind: 'company',
    url: 'https://www.ana.co.jp/group/recruit/ana-recruit/occupation/entry/' },
  factbook: { name: 'ANAホールディングス「Fact Book 2026」', kind: 'company',
    url: 'https://www.ana.co.jp/group/investors/irdata/annual/pdf/26f/26_F_01.pdf' },
  safety: { name: '「ANAグループ 安全報告書 2025年度」', kind: 'company', published: '2026-08',
    url: 'https://www.ana.co.jp/group/img/safe/outline/report/safety_report_2025.pdf' },
  pilot: { name: 'ANAの採用サイト「職種紹介（運航乗務職）」', kind: 'company',
    url: 'https://www.ana.co.jp/group/recruit/ana-recruit/occupation/pilot/' },
  welfare: { name: 'ANAの採用サイト「働き方・福利厚生」', kind: 'company',
    url: 'https://www.ana.co.jp/group/recruit/ana-recruit/welfare/' },
};

const CX = {
  interim: { name: 'キャセイパシフィック航空「Interim Report 2026」', kind: 'company', published: '2026-08-05',
    url: 'https://www.cathaypacific.com/content/dam/cx/about-us/investor-relations/interim-annual-reports/en/2026_cx_interim_report_en.pdf' },
  faqBase: { name: 'キャセイパシフィック航空の採用サイトの FAQ「Is it possible to be based in my home country or somewhere other than Hong Kong?」', kind: 'company',
    url: 'https://careers.cathaypacific.com/en/faqs/hong-kong/pilot/firstsecond-officer/is-it-possible-to-be-based-in-my-home-country-or-somewhere-other-than-hong-kong' },
  hkg: { name: 'キャセイパシフィック航空「Flights to Hong Kong」', kind: 'company',
    url: 'https://flights.cathaypacific.com/destinations/en_HK/flights-to-hong-kong' },
  annual: { name: 'キャセイパシフィック航空「Annual Report 2025」', kind: 'company', published: '2026-03-11',
    url: 'https://www.cathaypacific.com/content/dam/cx/about-us/investor-relations/interim-annual-reports/en/2025_cx_annual_report_en.pdf' },
  cadetNews: { name: 'キャセイパシフィック航空の発表「Cathay Pacific celebrates the graduation of its first batch of cadet pilots whose ground theory training was provided by Cathay Academy」', kind: 'company', published: '2025-05-19',
    url: 'https://news.cathaypacific.com/cathay-pacific-celebrates-the-graduation-of-its-first-batch-of-cadet-pilots-whose-ground-theory-training-was-provided-by-cathay-academy' },
  crew: { name: 'キャセイパシフィック航空の採用サイト「Flight Crew」', kind: 'company',
    url: 'https://careers.cathaypacific.com/en/careers/our-teams/pilot/pilot-detail-page' },
  faqCareer: { name: 'キャセイパシフィック航空の採用サイトの FAQ「What career progression opportunities exist after completing the Cadet Pilot Programme?」', kind: 'company',
    url: 'https://careers.cathaypacific.com/en/faqs/hong-kong/pilot/cadet/what-career-progression-opportunities-exist-after-completing-the-cadet-pilot-programme' },
  faqMedical: { name: 'キャセイパシフィック航空の採用サイトの FAQ「Will I receive medical coverage for myself and my family?」', kind: 'company',
    url: 'https://careers.cathaypacific.com/en/faqs/hong-kong/pilot/firstsecond-officer/will-i-receive-medical-coverage-for-myself-and-my-family' },
  faqReloc: { name: 'キャセイパシフィック航空の採用サイトの FAQ「Will Cathay Pacific help with my relocation to Hong Kong?」', kind: 'company',
    url: 'https://careers.cathaypacific.com/en/faqs/hong-kong/pilot/firstsecond-officer/will-cathay-pacific-help-with-my-relocation-to-hong-kong' },
  faqCommute: { name: 'キャセイパシフィック航空の採用サイトの FAQ「What if commuting to work feels far? Will I receive any transport allowance?」', kind: 'company',
    url: 'https://careers.cathaypacific.com/en/faqs/hong-kong/onboarding/what-if-commuting-to-work-feels-far' },
  cadetJob: { name: 'キャセイパシフィック航空の募集「Cadet Pilot Programme」', kind: 'company',
    url: 'https://careers.cathaypacific.com/en/careers/jobs/hong-kong/cadet-pilot-programme-31538' },
};

const BR = {
  chronicle: { name: 'エバー航空「Company Chronicle」', kind: 'company',
    url: 'https://www.evaair.com/en-global/about-eva-air/about-us/company-chronicle/' },
  values: { name: 'エバー航空「EVA Values」', kind: 'company',
    url: 'https://www.evaair.com/en-global/about-eva-air/about-us/eva-values/' },
  jobs: { name: 'エバー航空「Job Openings (Pilots)」', kind: 'company',
    url: 'https://www.evaair.com/en-global/about-eva-air/careers/job-openings/pilots/' },
  airports: { name: 'エバー航空「Worldwide Airports」', kind: 'company',
    url: 'https://www.evaair.com/en-global/fly-prepare/at-the-airport/worldwide-airports/' },
  fleet: { name: 'エバー航空「EVA Air Fleet」', kind: 'company',
    url: 'https://www.evaair.com/en-global/about-eva-air/about-us/market-and-sales-overview/eva-air-fleet/' },
  biz: { name: 'エバー航空「Main Business and Services」', kind: 'company',
    url: 'https://www.evaair.com/en-global/about-eva-air/about-us/market-and-sales-overview/main-business-and-services/' },
  ops: { name: 'エバー航空「Operational Data」', kind: 'company',
    url: 'https://www.evaair.com/en-global/about-eva-air/about-us/market-and-sales-overview/operational-data/' },
  jobsZh: { name: '長榮航空「飛航人員職缺」', kind: 'company',
    url: 'https://www.evaair.com/zh-tw/about-eva-air/careers/job-openings/pilots/' },
};

export const FACTS = {
  /* ════════ jal ════════ */
  jal: {
    /* 紹介文（会社のカードのいちばん上の字）。字は下の項目から組み立てる ── 数字と日付を手で打たない。
       {鍵} ＝ 値／{鍵:at} ＝ いつの話か／{鍵:cond} ＝ 数え方。使えるのは profile・scale・base の項目だけ。
       ⚠️ 「日本第◯位」「最大」のような、台帳に出どころの無い言い方を足さない（検査が落とす）。 */
    intro: [
      { ja: '設立は{founded}。航空連合は{alliance}（{alliance:at}）。', uses: ['founded', 'alliance'] },
      { ja: '{pilots:at}時点の運航乗務員は{pilots}（{pilots:cond}）。乗務を始めてからの勤務地は{pilot_base}。', uses: ['pilots', 'pilot_base'] },
    ],
    profile: [
      { key: 'founded', ja: '設立', value: '1951年8月1日',
        at: '1951-08-01', as_of: CHECKED, src: JAL.outline,
        quote: '設立 1951年8月1日' },
      { key: 'alliance', ja: '航空連合', value: 'ワンワールド',
        at: '2007-04', at_ja: '2007年4月に加盟', as_of: CHECKED, src: JAL.hist,
        quote: '2007年4月グロ－バルアライアンスoneworldへ加盟' },
    ],
    base: {
      key: 'pilot_base', ja: '乗務を始めてからの勤務地', value: '羽田空港、成田空港など', iata: ['HND', 'NRT'], city_ja: '東京', country_ja: '日本',
      at: '2026-10', at_ja: '2027年度入社の募集要項', as_of: CHECKED, src: JAL.req,
      quote: '乗務開始後は羽田空港、成田空港など。',
    },
    scale: [
      { key: 'fleet_total', ja: '運航している機材', value: 234, unit: '機',
        at: '2026-03-31', as_of: CHECKED, src: JAL.fleet,
        cond_ja: 'JALグループの数。ZIPAIR Tokyo とスプリング・ジャパンを含み、ジェットスター・ジャパンは含まない',
        quote: '合計 208 26 234' },
      { key: 'routes', ja: '路線', value: 211, unit: '路線',
        at: '2026-03-31', as_of: CHECKED, src: JAL.route,
        cond_ja: 'JALグループの国内線と国際線の合計',
        quote: '211路線' },
      { key: 'pilots', ja: '運航乗務員', value: 2510, unit: '名',
        at: '2026-03-31', as_of: CHECKED, src: JAL.safety, pilot: true,
        cond_ja: '日本航空の数。休職者は除く',
        quote: '運航乗務員 2,510名' },
      { key: 'pilot_avg_age', ja: '運航乗務員の平均年齢', value: 43.1, unit: '歳',
        at: '2025', at_ja: '2025年度', as_of: CHECKED, src: JAL.esg, pilot: true,
        quote: '運航乗務員/Average age of cockpit crew 年齢/years old 43.6 43.6 43.9 43.1' },
      { key: 'passengers_year', ja: '1年の旅客', value: 46242888, unit: '人',
        at: '2025', at_ja: '2025年度', as_of: CHECKED, src: JAL.yuho,
        cond_ja: 'JALグループのフルサービスキャリアの有償旅客（国際線と国内線の合計）',
        quote: '有償旅客数 （人） 43,712,000 46,242,888 105.8％' },
    ],
    fleet: [
      { key: 'a350_900', ja: 'エアバス A350-900', value: 17, unit: '機', at: '2026-03-31', as_of: CHECKED, src: JAL.fleet,
        quote: 'Airbus A350-900 12 5 17' },
      { key: 'a350_1000', ja: 'エアバス A350-1000', value: 11, unit: '機', at: '2026-03-31', as_of: CHECKED, src: JAL.fleet,
        quote: 'Airbus A350-1000 10 1 11' },
      { key: 'b787_9', ja: 'ボーイング 787-9', value: 22, unit: '機', at: '2026-03-31', as_of: CHECKED, src: JAL.fleet,
        quote: 'Boeing 787-9 19 3 22' },
      { key: 'b787_8', ja: 'ボーイング 787-8', value: 31, unit: '機', at: '2026-03-31', as_of: CHECKED, src: JAL.fleet,
        quote: 'Boeing 787-8 31 0 31' },
      { key: 'b777_300er', ja: 'ボーイング 777-300ER', value: 9, unit: '機', at: '2026-03-31', as_of: CHECKED, src: JAL.fleet,
        quote: 'Boeing 777-300ER 9 0 9' },
      { key: 'b767_300er', ja: 'ボーイング 767-300ER', value: 27, unit: '機', at: '2026-03-31', as_of: CHECKED, src: JAL.fleet,
        quote: 'Boeing 767-300ER 27 0 27' },
      { key: 'b737_800', ja: 'ボーイング 737-800', value: 62, unit: '機', at: '2026-03-31', as_of: CHECKED, src: JAL.fleet,
        quote: 'Boeing 737-800 49 13 62' },
      { key: 'a321ceo', ja: 'エアバス A321ceo（貨物機）', value: 3, unit: '機', at: '2026-03-31', as_of: CHECKED, src: JAL.fleet,
        quote: 'A321ceo 0 3 3' },
      { key: 'e170', ja: 'エンブラエル 170', value: 18, unit: '機', at: '2026-03-31', as_of: CHECKED, src: JAL.fleet,
        quote: 'Embraer 170 18 0 18' },
      { key: 'e190', ja: 'エンブラエル 190', value: 14, unit: '機', at: '2026-03-31', as_of: CHECKED, src: JAL.fleet,
        quote: 'Embraer 190 14 0 14' },
      { key: 'dhc8_400cc', ja: 'DHC-8-400 カーゴコンビ', value: 5, unit: '機', at: '2026-03-31', as_of: CHECKED, src: JAL.fleet,
        quote: 'De Havilland DHC-8-400 Cargo Combi 5 0 5' },
      { key: 'atr42_600', ja: 'ATR 42-600', value: 13, unit: '機', at: '2026-03-31', as_of: CHECKED, src: JAL.fleet,
        quote: 'ATR42-600 12 1 13' },
      { key: 'atr72_600', ja: 'ATR 72-600', value: 2, unit: '機', at: '2026-03-31', as_of: CHECKED, src: JAL.fleet,
        quote: 'ATR72-600 2 0 2' },
    ],
    work: [
      { key: 'days_off', ja: '休日', value: '原則として月間10日',
        at: '2026-10', at_ja: '2027年度入社の募集要項', as_of: CHECKED, src: JAL.req, lead: true, pilot: true,
        cond_ja: '乗務を始めてから',
        quote: '乗務開始後は原則として月間10日' },
      { key: 'working_time', ja: '勤務時間の決め方', value: '乗務に応じた変形労働時間制',
        at: '2026-10', at_ja: '2027年度入社の募集要項', as_of: CHECKED, src: JAL.req, pilot: true,
        cond_ja: '乗務を始めてから',
        quote: '乗務開始後は乗務に応じた変形労働時間制' },
      { key: 'training_location', ja: '訓練の場所', value: '国内と米国アリゾナ州フェニックス',
        at: '2026-10', at_ja: '採用サイトの職種紹介', as_of: CHECKED, src: JAL.jobtype, pilot: true,
        cond_ja: '自社養成の副操縦士になるまでの訓練',
        quote: '地上業務実習終了後、訓練は国内および米国のアリゾナ州フェニックスで行われ、同期全員で副操縦士を目指します。' },
      /* 出どころは同じページの図「目安年次」（字ではなく絵。2026-10-08 に絵を開いて読んだ）。
         並びは 地上業務実習 1年半程度 → 運航乗務員訓練生 2年半程度 → 副操縦士 10年程度 → 機長昇格訓練 → 機長。
         ⚠️ 入社から機長までの合計の年数を、ここから足し算で作らない（会社は合計を言っていない）。 */
      { key: 'upgrade_years', ja: '副操縦士として乗務する期間', value: '10年程度',
        at: '2026-10', at_ja: '採用サイトの職種紹介', as_of: REREAD, src: JAL.jobtype, pilot: true,
        cond_ja: '自社養成パイロットの目安年次。そのあと機長昇格訓練',
        quote: '目安年次 1年半程度 2年半程度 10年程度' },
    ],
    benefits: [
      { key: 'bonus', ja: '賞与', value: '年3回（夏季・年末・年度末）',
        at: '2024', at_ja: '2024年度の実績', as_of: CHECKED, src: JAL.req, lead: true, pilot: true,
        quote: '（8）賞与 年3回（夏季・年末・年度末）※2024年度実績' },
      { key: 'housing', ja: '社宅・寮', value: '社宅・寮制度あり',
        at: '2026-10', at_ja: '2027年度入社の募集要項', as_of: CHECKED, src: JAL.req, pilot: true,
        quote: '（10）社宅・寮 社宅・寮制度あり' },
      { key: 'staff_travel', ja: '社員の航空券', value: '優待搭乗制度',
        at: '2026-10', at_ja: '2027年度入社の募集要項', as_of: CHECKED, src: JAL.req, pilot: true,
        quote: '（14）福利厚生 優待搭乗制度' },
      { key: 'commuting', ja: '通勤費', value: '当社規定により支給',
        at: '2026-10', at_ja: '2027年度入社の募集要項', as_of: CHECKED, src: JAL.req, pilot: true,
        quote: '（9）通勤費 当社規定により支給' },
      { key: 'pay_raise', ja: '昇給', value: '年1回',
        at: '2026-10', at_ja: '2027年度入社の募集要項', as_of: CHECKED, src: JAL.req, pilot: true,
        quote: '（7）昇給 年1回' },
      { key: 'paid_leave_rate', ja: '年次有給休暇の取得率', value: 82.3, unit: '%',
        at: '2025', at_ja: '2025年度', as_of: CHECKED, src: JAL.esg, pilot: false,
        cond_ja: '日本航空の全社員',
        quote: '有給休暇取得率/Ratio of paid holiday taken % 81.0 84.5 80.0 82.3 日本航空株式会社のみ/Japan Airlines Co., Ltd. only' },
    ],
    jobs: [
      { key: 'headcount', ja: '採用予定数', value: '新卒採用およびキャリア採用合計で50名程度',
        at: '2026-10', at_ja: '2027年度入社の募集要項', as_of: CHECKED, src: JAL.req, pilot: true,
        cond_ja: '自社養成パイロット',
        quote: '採用予定数 2027年度入社 新卒採用およびキャリア採用合計で50名程度' },
      { key: 'start_pay', ja: '入社時の給与', value: 263000, cur: 'JPY',
        at: '2026-03-27', as_of: CHECKED, src: JAL.req, pilot: true,
        cond_ja: '自社養成パイロットの新卒。機長・副操縦士の給与ではない',
        quote: '（6）給与 263,000円 ※2026年3月27日時点' },
      { key: 'entry_open', ja: 'エントリーの受付', value: '2026年3月1日10時より順次開始',
        at: '2026-03-01', as_of: CHECKED, src: JAL.press, pilot: false,
        cond_ja: 'JALグループの2027年度入社の採用',
        quote: 'JALグループは、2027年度入社の新卒採用を2026年3月1日（日）10時より順次開始します。' },
      /* ★ 免許を持つ人の話は2行に分ける（2026-10-08）。同じ募集要項に段が2つ在る ──
           自社養成は「免許を持つ人は応募できない」／ライセンス保有者は「訓練生の採用試験を適宜・養成機関へ」。
           1行で「ライセンスを持つ人の採用：適宜実施」と書いていたあいだ、現役のパイロットを採っていると読めた
           （同じページの下の節は「現役パイロット向けの募集は公開されていない」と書いていた ＝ 食い違い）。
           ⚠️ 機長・副操縦士の経験者に向けた募集要項は、採用サイトのキャリア採用にも載っていない（載っているのは自社養成だけ）。
              無いものは引用できないので、行にはせず、下の行の条件（cond_ja）に書いてある。 */
      { key: 'self_training_license', ja: '自社養成パイロットへの応募', value: '事業用操縦士免許を持っている人・過去に取得した人は応募できない',
        at: '2026-10', at_ja: '2027年度入社の募集要項', as_of: REREAD, src: JAL.req, pilot: true,
        quote: '日本をはじめ各国で発行した事業用操縦士免許を現在お持ちの方、または過去に取得されたことのある方はご応募いただけません。' },
      { key: 'license_holders', ja: 'パイロット（ライセンス保有者）の採用', value: '運航乗務員訓練生の採用試験を適宜実施。詳細は在籍中の養成機関へ',
        at: '2026-10', at_ja: '2027年度入社の募集要項', as_of: REREAD, src: JAL.req, pilot: true,
        cond_ja: '事業用操縦士ライセンスを持つ人が対象。機長・副操縦士の経験者に向けた募集要項は、採用サイトに掲載が無い',
        quote: '事業用操縦士ライセンス保有者を対象とした運航乗務員訓練生の採用試験を適宜行っています。詳細は在籍中の各養成機関にお問い合わせください。' },
    ],
  },

  /* ════════ ana ════════ */
  ana: {
    intro: [
      { ja: '始まりは{founded}。航空連合は{alliance}（{alliance:at}）。', uses: ['founded', 'alliance'] },
      { ja: '{pilots:at}時点の運航乗務員は{pilots}（{pilots:cond}）。国際線は{intl_network:at}時点で{intl_network}。', uses: ['pilots', 'intl_network'] },
    ],
    profile: [
      { key: 'founded', ja: '設立', value: '1952年（日本ヘリコプター輸送として設立）',
        at: '1952', as_of: CHECKED, src: ANA.history,
        quote: 'そのわずか2年後、1952年に設立されたのが、日本初の純民間航空会社である日本ヘリコプター輸送─後のANAです。' },
      { key: 'alliance', ja: '航空連合', value: 'スターアライアンス',
        at: '1999-10', at_ja: '1999年10月に加盟', as_of: CHECKED, src: ANA.ir,
        quote: 'ANA は1999年10月に加盟。' },
    ],
    base: {
      key: 'pilot_base', ja: '乗務を始めてからの勤務地', value: '東京', iata: [], city_ja: '東京', country_ja: '日本',
      at: '2026-10', at_ja: '2027年度新卒の募集要項', as_of: CHECKED, src: ANA.req,
      quote: '乗務開始後は東京にて勤務',
    },
    scale: [
      { key: 'fleet_total', ja: '運航している機材', value: 240, unit: '機',
        at: '2026-03-31', as_of: CHECKED, src: ANA.factbook,
        cond_ja: '全日本空輸の数',
        quote: 'ANA total ANA計 249 256 257 265 269 255 239 236 240 240 240 179 61' },
      { key: 'intl_network', ja: '国際線', value: '世界40都市55路線',
        at: '2026-03', as_of: CHECKED, src: ANA.history,
        quote: '就航以来、多くのお客様に支えられ歩みを続けて成長してきた国際線ネットワークは、2024年度に新設したミラノ、ストックホルム、イスタンブールなどの路線を含め、2026年3月現在、世界40都市55路線に就航しています。' },
      { key: 'routes_dom', ja: '国内線', value: 113, unit: '路線',
        at: '2026-03-31', as_of: CHECKED, src: ANA.ir,
        cond_ja: 'コードシェアと重複する路線を除く',
        quote: 'ANA国内線 113路線' },
      { key: 'pilots', ja: '運航乗務員', value: 2250, unit: '名',
        at: '2026-04-01', as_of: CHECKED, src: ANA.safety, pilot: true,
        cond_ja: '全日本空輸の数',
        quote: '総 計 2,250 名' },
      { key: 'captains', ja: '機長', value: 1549, unit: '名',
        at: '2026-04-01', as_of: CHECKED, src: ANA.safety, pilot: true,
        cond_ja: '全日本空輸の数',
        quote: '機 長 1,549 名' },
      { key: 'first_officers', ja: '副操縦士', value: 701, unit: '名',
        at: '2026-04-01', as_of: CHECKED, src: ANA.safety, pilot: true,
        cond_ja: '全日本空輸の数',
        quote: '副操縦士 701 名' },
    ],
    fleet: [
      { key: 'a380_800', ja: 'エアバス A380-800', value: 3, unit: '機', at: '2026-03-31', as_of: CHECKED, src: ANA.factbook,
        quote: 'Airbus A380-800 エアバス A380-800 1 2 2 3 3 3 3 3 3' },
      { key: 'b777_300', ja: 'ボーイング 777-300／-300ER', value: 16, unit: '機', at: '2026-03-31', as_of: CHECKED, src: ANA.factbook,
        quote: 'Boeing 777-300/-300ER ボーイング 777-300/-300ER 29 29 29 29 35 30 20 18 18 18 16 7 9' },
      { key: 'b777_200', ja: 'ボーイング 777-200／-200ER', value: 10, unit: '機', at: '2026-03-31', as_of: CHECKED, src: ANA.factbook,
        quote: 'Boeing 777-200/-200ER ボーイング 777-200/-200ER 28 24 21 20 20 14 10 10 10 10 10 10' },
      { key: 'b777f', ja: 'ボーイング 777F（貨物機）', value: 2, unit: '機', at: '2026-03-31', as_of: CHECKED, src: ANA.factbook,
        quote: 'Boeing 777F ボーイング 777F 2 2 2 2 2 2 2 2' },
      { key: 'b787_10_domestic', ja: 'ボーイング 787-10（国内線仕様）', value: 7, unit: '機', at: '2026-03-31', as_of: CHECKED, src: ANA.factbook,
        quote: 'Boeing 787-10 (for domestic) ボーイング 787-10(国内線仕様) 2 5 7 7' },
      { key: 'b787_10_international', ja: 'ボーイング 787-10（国際線仕様）', value: 3, unit: '機', at: '2026-03-31', as_of: CHECKED, src: ANA.factbook,
        quote: 'Boeing 787-10 (for international) ボーイング 787-10(国際線仕様) 1 2 2 2 3 3 3 3 2 1' },
      { key: 'b787_9', ja: 'ボーイング 787-9', value: 44, unit: '機', at: '2026-03-31', as_of: CHECKED, src: ANA.factbook,
        quote: 'Boeing 787-9 ボーイング 787-9 11 21 28 30 35 36 39 40 43 44 44 38 6' },
      { key: 'b787_8', ja: 'ボーイング 787-8', value: 33, unit: '機', at: '2026-03-31', as_of: CHECKED, src: ANA.factbook,
        quote: 'Boeing 787-8 ボーイング 787-8 35 36 36 36 36 36 36 36 35 34 33 30 3' },
      { key: 'b767_300', ja: 'ボーイング 767-300／-300ER', value: 15, unit: '機', at: '2026-03-31', as_of: CHECKED, src: ANA.factbook,
        quote: 'Boeing 767-300/-300ER ボーイング 767-300/-300ER 38 37 34 29 24 21 18 15 15 15 15 15' },
      { key: 'b767_300f', ja: 'ボーイング 767-300F／-300BCF（貨物機）', value: 6, unit: '機', at: '2026-03-31', as_of: CHECKED, src: ANA.factbook,
        quote: 'Boeing 767-300F/-300BCF ボーイング 767-300F/-300BCF 12 12 12 12 10 9 9 9 9 6 6 3 3' },
      { key: 'a321neo', ja: 'エアバス A321-200neo', value: 22, unit: '機', at: '2026-03-31', as_of: CHECKED, src: ANA.factbook,
        quote: 'Airbus A321-200neo エアバス A321-200neo 2 11 11 17 22 22 22 22 22 22' },
      { key: 'a321', ja: 'エアバス A321-200', value: 4, unit: '機', at: '2026-03-31', as_of: CHECKED, src: ANA.factbook,
        quote: 'Airbus A321-200 エアバス A321-200 4 4 4 4 4 4 4 4 4 4 4' },
      { key: 'a320neo', ja: 'エアバス A320-200neo', value: 11, unit: '機', at: '2026-03-31', as_of: CHECKED, src: ANA.factbook,
        quote: 'Airbus A320-200neo エアバス A320-200neo 2 3 9 11 11 11 11 11 11 11 11' },
      { key: 'b737_800', ja: 'ボーイング 737-800', value: 39, unit: '機', at: '2026-03-31', as_of: CHECKED, src: ANA.factbook,
        quote: 'Boeing 737-800 ボーイング 737-800 36 36 36 40 39 39 39 39 39 39 39 26 13' },
      { key: 'dash8_400', ja: 'DASH 8-400', value: 25, unit: '機', at: '2026-03-31', as_of: CHECKED, src: ANA.factbook,
        quote: 'De Havilland Canada DASH 8-400 デ・ハビランド・カナダ DASH 8-400 21 21 24 24 24 24 24 24 24 24 25 25' },
    ],
    work: [
      { key: 'days_off', ja: '休日', value: '月間10日間程度',
        at: '2026-10', at_ja: '2027年度新卒の募集要項', as_of: CHECKED, src: ANA.req, lead: true, pilot: true,
        cond_ja: '乗務を始めてから',
        quote: '乗務開始後は月間10日間程度' },
      { key: 'working_time', ja: '勤務時間の決め方', value: '乗務に応じたシフト勤務（土・日・祝日勤務あり、早朝・深夜・宿泊を伴う勤務あり）',
        at: '2026-10', at_ja: '2027年度新卒の募集要項', as_of: CHECKED, src: ANA.req, pilot: true,
        cond_ja: '乗務を始めてから',
        quote: '乗務開始後は、乗務に応じたシフト勤務（土・日・祝日勤務あり、早朝・深夜・宿泊を伴う勤務あり）' },
      { key: 'trip_pattern', ja: '乗務のパターン', value: '国内線は日帰りから2泊3日が基本。国際線は渡航先で1〜2日滞在',
        at: '2026-10', at_ja: '採用サイトの職種紹介', as_of: CHECKED, src: ANA.pilot, pilot: true,
        quote: '国内線の場合は、日帰りから2泊3日のパターンを基本とし、国際線の場合には渡航先で1〜2日滞在します。' },
      { key: 'upgrade_years', ja: '副操縦士から機長まで', value: '約10年',
        at: '2026-10', at_ja: '採用サイトの職種紹介', as_of: CHECKED, src: ANA.pilot, pilot: true,
        quote: '副操縦士任用後、機長になるまでには約10年。' },
    ],
    benefits: [
      { key: 'bonus', ja: '賞与', value: '年3回（夏季・年末・期末）',
        at: '2024', at_ja: '2024年度の実績', as_of: CHECKED, src: ANA.req, lead: true, pilot: true,
        quote: '年3回（夏季・年末・期末）2024年度実績' },
      { key: 'housing', ja: '寮・社宅', value: '新卒入社時か異動時に、寮・社宅を利用できる',
        at: '2026-10', at_ja: '採用サイトの「働き方・福利厚生」', as_of: CHECKED, src: ANA.welfare, pilot: true,
        cond_ja: '適用条件あり',
        quote: '新卒入社時、または異動時に入寮、社宅の利用が可能です。※適用条件あり' },
      { key: 'allowances', ja: '諸手当', value: '家族手当、住宅手当、深夜労働手当、土日出勤手当など',
        at: '2026-10', at_ja: '2027年度新卒の募集要項', as_of: CHECKED, src: ANA.req, pilot: true,
        quote: '諸手当 家族手当、住宅手当、深夜労働手当、土日出勤手当など' },
      { key: 'commuting', ja: '通勤補助費', value: '当社規程により支給',
        at: '2026-10', at_ja: '2027年度新卒の募集要項', as_of: CHECKED, src: ANA.req, pilot: true,
        quote: '通勤補助費 当社規程により支給' },
      { key: 'pay_raise', ja: '昇給', value: '年1回（4月）',
        at: '2026-10', at_ja: '2027年度新卒の募集要項', as_of: CHECKED, src: ANA.req, pilot: true,
        quote: '昇給 年1回（4月）' },
      { key: 'annual_leave', ja: '年次有給休暇の付与', value: 20, unit: '日',
        at: '2026-10', at_ja: '採用サイトの「働き方・福利厚生」', as_of: CHECKED, src: ANA.welfare, pilot: false,
        cond_ja: '全社員',
        quote: '年間有給休暇付与日数 全社員 20 日' },
      { key: 'paid_leave_rate', ja: '年次有給休暇の取得率', value: 80, unit: '%',
        at: '2024-03', as_of: CHECKED, src: ANA.welfare, pilot: false,
        cond_ja: '全社員',
        quote: '有給休暇年間平均取得日数 80％（※2024年3月時点）' },
    ],
    jobs: [
      { key: 'headcount', ja: '採用人数', value: '65名程度',
        at: '2026-10', at_ja: '2027年度新卒の募集要項', as_of: CHECKED, src: ANA.req, pilot: true,
        cond_ja: '運航乗務職（自社養成パイロット）の新卒',
        quote: '採用人数 65名程度' },
      { key: 'start_pay', ja: '入社時の月額（大卒・高等専門学校の専攻科卒）', value: 267770, cur: 'JPY',
        at: '2026', at_ja: '2026年度の予定', as_of: CHECKED, src: ANA.req, pilot: true,
        cond_ja: '入社時の月額。機長・副操縦士の給与ではない',
        quote: '大卒・高等専門学校（専攻科）卒 月額267,770円' },
      { key: 'start_pay_grad', ja: '入社時の月額（院卒）', value: 276528, cur: 'JPY',
        at: '2026', at_ja: '2026年度の予定', as_of: CHECKED, src: ANA.req, pilot: true,
        cond_ja: '入社時の月額。機長・副操縦士の給与ではない',
        quote: '院卒 月額276,528円' },
      { key: 'entry_deadline', ja: 'プレエントリーの締切', value: '2026年3月10日 23:59',
        at: '2026-03-10', as_of: CHECKED, src: ANA.req, pilot: true,
        cond_ja: '2027年度新卒',
        quote: 'プレエントリー締切：2026年3月10日（火）23:59' },
      /* ⚠️ 会社は「ライセンサーの採用も行っている」と書いているが、その募集要項は採用サイトに載っていない。
            キャリア採用の一覧にも運航乗務職は無い（2026-10-08 に両方のページを開いて確かめた）。
            「採っている」とだけ書くと応募できると読めるので、条件（cond_ja）に添える。年収の台帳（salary-basis.mjs）と同じ言い方。 */
      { key: 'license_holders', ja: 'ライセンスを持つ人の採用', value: '操縦士資格を取得している人（ライセンサー）の採用も行っている',
        at: '2026-10', at_ja: '採用サイトの職種紹介', as_of: REREAD, src: ANA.pilot, pilot: true,
        cond_ja: 'ライセンサーの募集要項は採用サイトに掲載が無い。キャリア採用の一覧にも運航乗務職は無い',
        quote: 'ANAでは、入社前に操縦士資格を取得している方（ライセンサー）の採用と併せて、未経験の方の中からパイロットとして適性のある人財を見出し、 入社後に一から育成する「自社養成パイロット」の採用を行っています。' },
    ],
  },

  /* ════════ cathay-pacific ════════ */
  'cathay-pacific': {
    intro: [
      { ja: '設立は{founded}。航空連合は{alliance}。パイロットの拠点は{pilot_base}。', uses: ['founded', 'alliance', 'pilot_base'] },
      { ja: '{fleet_total:at}時点の機材は、{fleet_total:cond}で{fleet_total}。', uses: ['fleet_total'] },
    ],
    profile: [
      { key: 'founded', ja: '設立', value: '1946年（香港）',
        at: '1946', as_of: CHECKED, src: CX.interim,
        quote: 'Cathay Pacific Airways Limited (the “Company”) was founded in Hong Kong in 1946.' },
      { key: 'alliance', ja: '航空連合', value: 'ワンワールド（創設メンバー）',
        at: '2026-06-30', as_of: CHECKED, src: CX.interim,
        quote: 'Cathay Pacific is a founding member of the oneworld global alliance, whose combined network serves almost 1,000 destinations worldwide.' },
    ],
    base: {
      key: 'pilot_base', ja: 'パイロットの拠点', value: '香港', iata: ['HKG'], city_ja: '香港', country_ja: '香港',
      at: '2026-10-04', as_of: CHECKED, src: CX.faqBase,
      quote: 'All Cathay Pacific pilots are based in Hong Kong.',
      iata_src: { as_of: CHECKED, src: CX.hkg, quote: 'Book & compare flights to Hong Kong (HKG) with Cathay Pacific' },
    },
    scale: [
      { key: 'fleet_total', ja: '運航している機材', value: 179, unit: '機',
        at: '2026-06-30', as_of: CHECKED, src: CX.interim,
        cond_ja: 'キャセイパシフィック航空（会社単体）の旅客機と貨物機',
        quote: 'The Company had 179 passenger and cargo aircraft as at 30th June 2026.' },
      { key: 'destinations', ja: '旅客便の就航地', value: '100以上',
        at: '2026-06-30', as_of: CHECKED, src: CX.interim,
        cond_ja: 'キャセイパシフィックと香港エクスプレスの合計',
        quote: 'As at 30th June 2026, Cathay Pacific and HK Express combined offered scheduled passenger services to more than 100 destinations worldwide, including 23 in the Chinese Mainland.' },
      { key: 'passengers_year', ja: '1年の旅客', value: 28871, unit: '千人',
        at: '2025', as_of: CHECKED, src: CX.annual,
        cond_ja: 'キャセイパシフィック航空の有償旅客。香港エクスプレスは含まない',
        quote: 'Revenue passengers carried ’000 28,871 22,827 +26.5%' },
      { key: 'cadets_in_training', ja: '訓練中の訓練生', value: '500人以上',
        at: '2025-05', as_of: CHECKED, src: CX.cadetNews, pilot: true,
        quote: 'Currently, there are more than 500 cadet pilots in training as part of the Cadet Pilot Training Programme.' },
    ],
    fleet: [
      { key: 'a321neo', ja: 'エアバス A321neo', value: 16, unit: '機', at: '2026-06-30', as_of: CHECKED, src: CX.interim,
        quote: 'A321neo 5 6 5 16 3.6 3(d) 2(d) 3(d) 8 5' },
      { key: 'a330_300', ja: 'エアバス A330-300', value: 43, unit: '機', at: '2026-06-30', as_of: CHECKED, src: CX.interim,
        quote: 'A330-300 42 1 43 17.8 1' },
      { key: 'a350_900', ja: 'エアバス A350-900', value: 30, unit: '機', at: '2026-06-30', as_of: CHECKED, src: CX.interim,
        quote: 'A350-900 20 8 2 30 8.2 2' },
      { key: 'a350_1000', ja: 'エアバス A350-1000', value: 18, unit: '機', at: '2026-06-30', as_of: CHECKED, src: CX.interim,
        quote: 'A350-1000 11 7 18 6.6' },
      { key: 'b777_300', ja: 'ボーイング 777-300', value: 17, unit: '機', at: '2026-06-30', as_of: CHECKED, src: CX.interim,
        quote: '777-300 17 17 24.7' },
      { key: 'b777_300er', ja: 'ボーイング 777-300ER', value: 35, unit: '機', at: '2026-06-30', as_of: CHECKED, src: CX.interim,
        quote: '777-300ER 26 9 35 13.7 9' },
      { key: 'b747_400erf', ja: 'ボーイング 747-400ERF（貨物機）', value: 6, unit: '機', at: '2026-06-30', as_of: CHECKED, src: CX.interim,
        quote: '747-400ERF 6 6 17.5' },
      { key: 'b747_8f', ja: 'ボーイング 747-8F（貨物機）', value: 14, unit: '機', at: '2026-06-30', as_of: CHECKED, src: CX.interim,
        quote: '747-8F 14 14 13.4' },
    ],
    work: [
      { key: 'annual_leave_fo', ja: '年次休暇（First Officer）', value: 28, unit: '日',
        at: '2026-01', as_of: CHECKED, src: CX.crew, lead: true, pilot: true,
        quote: '28 days Annual leave' },
      { key: 'annual_leave_so', ja: '年次休暇（Second Officer）', value: 21, unit: '日',
        at: '2026-01', as_of: CHECKED, src: CX.crew, pilot: true,
        quote: '21 days Annual Leave' },
      { key: 'upgrade', ja: '昇格の決まり方', value: '飛行経験・評価・空席・先任順で決まる',
        at: '2026-10-04', as_of: CHECKED, src: CX.faqCareer, pilot: true,
        cond_ja: '訓練生の課程を終えたあと',
        quote: 'Your career progression thereafter will depend on your flying experience, performance, available vacancies, and seniority — enabling advancement to the roles of First Officer and eventually Captain.' },
    ],
    benefits: [
      { key: 'staff_travel', ja: '社員の航空券', value: '本人と対象の家族に割引の航空券',
        at: '2026-01', as_of: CHECKED, src: CX.crew, lead: true, pilot: true,
        quote: 'Discounted travel for you and eligible dependents' },
      { key: 'housing', ja: '住宅手当', value: '住宅手当は無い。暮らしの費用を支える月々の手当がある',
        at: '2026-10-04', as_of: CHECKED, src: CX.faqBase, pilot: true,
        quote: 'While there is no housing allowance, pilots receive a monthly allowance to support the cost of living.' },
      { key: 'monthly_allowance_fo', ja: '月々の手当（First Officer）', value: 20000, cur: 'HKD',
        at: '2026-01', as_of: CHECKED, src: CX.crew, pilot: true,
        cond_ja: 'この額から',
        quote: 'From HKD 20,000* Monthly allowance' },
      { key: 'monthly_allowance_so', ja: '月々の手当（Second Officer）', value: 14000, cur: 'HKD',
        at: '2026-01', as_of: CHECKED, src: CX.crew, pilot: true,
        cond_ja: 'この額から',
        quote: 'From HKD 14,000* Monthly Allowance' },
      { key: 'education', ja: '子の教育手当', value: '対象の乗員に、子の教育手当がある',
        at: '2026-01', as_of: CHECKED, src: CX.crew, pilot: true,
        quote: 'Global children\'s education allowance available to eligible officers' },
      { key: 'medical', ja: '医療', value: '本人と対象の家族に、選べる福利厚生の制度がある',
        at: '2026-10-04', as_of: CHECKED, src: CX.faqMedical, pilot: true,
        quote: 'Yes, we offer a flexible benefits scheme for you and your eligible family members.' },
      { key: 'relocation', ja: '引っ越しの支援', value: '海外に住む採用者に、引っ越しの支援がある',
        at: '2026-10-04', as_of: CHECKED, src: CX.faqReloc, pilot: true,
        quote: 'Yes, we provide relocation assistance to successful candidates residing overseas.' },
      { key: 'commuting', ja: '通勤', value: '香港島・九龍・新界の主な住宅地との間にバスがある',
        at: '2026-10-04', as_of: CHECKED, src: CX.faqCommute, pilot: false,
        cond_ja: '香港を拠点とする職種の全体',
        quote: 'For Hong Kong-based roles, we provide bus services to and from most major residential areas covering Hong Kong Island, Kowloon and the New Territories.' },
    ],
    jobs: [
      { key: 'fo_status', ja: 'First Officer の募集', value: '募集していない',
        at: '2026-10-04', as_of: CHECKED, src: CX.crew, pilot: true,
        quote: 'Unfortunately, we are not hiring for this position at this time.' },
      { key: 'so_status', ja: 'Second Officer の募集', value: '募集していない',
        at: '2026-10-04', as_of: CHECKED, src: CX.crew, pilot: true,
        quote: 'Unfortunately, we are not hiring for this position at this time.' },
      { key: 'fo_min_hours', ja: 'First Officer の応募に要る飛行時間', value: '合計1,500時間以上（3,000時間が望ましい）',
        at: '2026-01', as_of: CHECKED, src: CX.crew, pilot: true,
        quote: 'Minimum total flying time of 1,500 hours (3,000 hours preferred) including:' },
      { key: 'cadet', ja: '訓練生の募集', value: '約80週の訓練生課程を、通年で募集',
        at: '2026-10-04', as_of: CHECKED, src: CX.cadetJob, pilot: true,
        quote: 'Applications to the ~80-week Cathay Cadet Pilot Programme are open year-round.' },
    ],
  },

  /* ════════ eva-air ════════ */
  'eva-air': {
    intro: [
      { ja: '設立は{founded}、最初の便は{first_flight}。航空連合は{alliance}（{alliance:at}）。', uses: ['founded', 'first_flight', 'alliance'] },
      { ja: '{fleet_total:at}時点の機材は{fleet_total}。パイロットの勤務地は{pilot_base}。', uses: ['fleet_total', 'pilot_base'] },
    ],
    profile: [
      { key: 'founded', ja: '設立', value: '1989年3月8日',
        at: '1989-03-08', as_of: CHECKED, src: BR.chronicle,
        quote: 'EVA Air was founded on March 8, 1989 by Group Chairman Y. F. Chang and registered on April 7, 1989.' },
      { key: 'first_flight', ja: '最初の便', value: '1991年7月1日',
        at: '1991-07-01', as_of: CHECKED, src: BR.chronicle,
        quote: 'First Flight was launched on July 1, 1991.' },
      { key: 'alliance', ja: '航空連合', value: 'スターアライアンス',
        at: '2013-06', at_ja: '2013年6月に加盟', as_of: CHECKED, src: BR.values,
        quote: 'EVA is proud to have been a Star Alliance member since June 2013.' },
    ],
    base: {
      key: 'pilot_base', ja: 'パイロットの勤務地', value: '台北（台湾）', iata: ['TPE'], city_ja: '台北', country_ja: '台湾',
      at: '2026-10', at_ja: '経験者の副操縦士の募集', as_of: CHECKED, src: BR.jobs,
      quote: 'EVA Air is looking for high proficient pilots to participate the growth and expansion of our company based in Taipei Taiwan.',
      iata_src: { as_of: CHECKED, src: BR.airports, quote: 'Taiwan Taoyuan International Airport(TPE)' },
    },
    scale: [
      { key: 'fleet_total', ja: '運航している機材', value: 89, unit: '機',
        at: '2026-09-01', as_of: CHECKED, src: BR.fleet,
        quote: 'As of Sep. 1, 2026 (Total: 89 Aircraft in service)' },
      { key: 'destinations', ja: '就航地', value: 66, unit: 'か所',
        at: '2026-09-01', as_of: CHECKED, src: BR.biz,
        cond_ja: '貨物便だけの就航地を含む',
        quote: 'Total: 66 destinations' },
      { key: 'passengers_year', ja: '1年の旅客', value: 13326018, unit: '人',
        at: '2025', as_of: CHECKED, src: BR.ops,
        quote: 'Number of Passenger Flown Revenue Passenger Kilometer (RPK)(million) Available Seat Kilometer (ASK)(million) Load Factor Revenue(NT$ million) 13,326,018 52,964 68,082 77.79% 140,344' },
    ],
    fleet: [
      { key: 'b777_300er', ja: 'ボーイング 777-300ER', value: 32, unit: '機', at: '2026-09-01', as_of: CHECKED, src: BR.fleet,
        quote: 'Aircraft Type 777-300ER In Service 32 To Be Delivered 0' },
      { key: 'b787_9', ja: 'ボーイング 787-9', value: 9, unit: '機', at: '2026-09-01', as_of: CHECKED, src: BR.fleet,
        quote: 'Aircraft Type 787-9 In Service 9 To Be Delivered 8' },
      { key: 'b787_10', ja: 'ボーイング 787-10', value: 13, unit: '機', at: '2026-09-01', as_of: CHECKED, src: BR.fleet,
        quote: 'Aircraft Type 787-10 In Service 13 To Be Delivered 4' },
      { key: 'a330_300', ja: 'エアバス A330-300', value: 9, unit: '機', at: '2026-09-01', as_of: CHECKED, src: BR.fleet,
        quote: 'Aircraft Type A330-300 In Service 9 To Be Delivered 0' },
      { key: 'a321_200', ja: 'エアバス A321-200', value: 17, unit: '機', at: '2026-09-01', as_of: CHECKED, src: BR.fleet,
        quote: 'Aircraft Type A321-200 In Service 17 To Be Delivered 0' },
      { key: 'b777f', ja: 'ボーイング 777F（貨物機）', value: 9, unit: '機', at: '2026-09-01', as_of: CHECKED, src: BR.fleet,
        quote: 'Aircraft Type 777F (Freighter) In Service 9 To Be Delivered 0' },
    ],
    work: [
      { key: 'days_off', ja: '休日', value: '月に連続8日',
        at: '2026-10', at_ja: '経験者の副操縦士の募集', as_of: CHECKED, src: BR.jobs, lead: true, pilot: true,
        cond_ja: 'A321・B777・B787 の副操縦士（経験者）の募集の条件',
        quote: '8 consecutive days off per month.' },
      { key: 'annual_leave', ja: '年次休暇', value: '年22日。年数に応じて増え、最高で年42日',
        at: '2026-10', at_ja: '会社の募集ページ', as_of: CHECKED, src: BR.jobsZh, pilot: true,
        cond_ja: '訓練を終えて最初の乗務から3か月たったあと',
        quote: '飛航員自完訓執行首趟任務滿三個月後，得享有每年二十二天特別休假，特別休假隨年資增加，最高每年可達四十二天。' },
      { key: 'sick_leave', ja: '有給の病気休暇', value: '年に最大30日',
        at: '2026-10', at_ja: '経験者の副操縦士の募集', as_of: CHECKED, src: BR.jobs, pilot: true,
        cond_ja: 'A321・B777・B787 の副操縦士（経験者）の募集の条件',
        quote: 'Up to 30 days of paid sick leave per calendar year.' },
    ],
    benefits: [
      { key: 'housing', ja: '住まい', value: '家賃の補助、または会社の住まい',
        at: '2026-10', at_ja: '経験者の副操縦士の募集', as_of: CHECKED, src: BR.jobs, lead: true, pilot: true,
        cond_ja: 'A321・B777・B787 の副操縦士（経験者）の募集の条件',
        quote: 'Housing rental subsidy or company accommodation.' },
      { key: 'bonus', ja: '賞与', value: '会社の売上に応じた年末賞与',
        at: '2026-10', at_ja: '経験者の副操縦士の募集', as_of: CHECKED, src: BR.jobs, pilot: true,
        cond_ja: 'A321・B777・B787 の副操縦士（経験者）の募集の条件',
        quote: 'Annual year-end bonus based on company revenue.' },
      { key: 'staff_travel', ja: '社員の航空券', value: '無料と割引の航空券（対象の家族を含む）',
        at: '2026-10', at_ja: '経験者の副操縦士の募集', as_of: CHECKED, src: BR.jobs, pilot: true,
        cond_ja: 'A321・B777・B787 の副操縦士（経験者）の募集の条件',
        quote: 'Complimentary and discounted travel. (eligible family members included)' },
      { key: 'loss_of_licence', ja: '乗務資格を失ったときの保険', value: '副操縦士は10万米ドル、機長は20万米ドルの保険。保険料は会社が払う',
        at: '2026-10', at_ja: '会社の募集ページ', as_of: CHECKED, src: BR.jobsZh, pilot: true,
        cond_ja: '身体検査で不適合になり、身体検査証を失った場合',
        quote: '投保金額為副機長職級保額美金十萬元、機長職級保額美金二十萬元，由公司為飛航員負擔上述保額之保費' },
    ],
    jobs: [
      { key: 'fo_posting', ja: '募集している職', value: 'A321・B777・B787 の副操縦士（経験者）',
        at: '2026-10', at_ja: '会社の募集ページ', as_of: CHECKED, src: BR.jobs, pilot: true,
        quote: 'EVA Airways requires A321/B777/B787 first officers' },
      { key: 'fo_contract', ja: '契約の期間', value: 4, unit: '年',
        at: '2026-10', at_ja: '経験者の副操縦士の募集', as_of: CHECKED, src: BR.jobs, pilot: true,
        quote: 'Contract period: 4 years' },
      { key: 'fo_total_hours', ja: '応募に要る総飛行時間', value: 2000, unit: '時間',
        at: '2026-10', at_ja: '経験者の副操縦士の募集', as_of: CHECKED, src: BR.jobs, pilot: true,
        quote: '2,000 total flight hours' },
      { key: 'fo_jet_hours', ja: '応募に要るジェット機の飛行時間', value: 500, unit: '時間',
        at: '2026-10', at_ja: '経験者の副操縦士の募集', as_of: CHECKED, src: BR.jobs, pilot: true,
        cond_ja: '最大離陸重量20トン超・多発・複数乗員の商用ジェット機',
        quote: '500 hours in commercial multi-engine, multi-crew jet, MTOW > 20 tons' },
    ],
  },
};

/* ── 英語の対（2026-10-21・英語版の準備）── 画面に出る日本語の字 → 英語。決まりは career-facts.mjs の「英語の対」の節（twinOf）。
   行の字を直したら、ここも直す（直さないと check() が落ちる）。引用は原文のまま（ここに置かない）。
   国の字は airline-countries.mjs の COUNTRIES の en と同じ。数字の単位は UNIT_EN、日付の at は atTextEn が言い直す。
   自社養成パイロット ＝ ab initio cadet（会社が一から育てる訓練生）。 */
export const EN = Object.freeze({
  /* 紹介文の型（{鍵} は日本語の型と同じものだけ） */
  '設立は{founded}。航空連合は{alliance}（{alliance:at}）。': 'Founded {founded}. Alliance: {alliance} ({alliance:at}).',
  '{pilots:at}時点の運航乗務員は{pilots}（{pilots:cond}）。乗務を始めてからの勤務地は{pilot_base}。':
    'Flight crew as of {pilots:at}: {pilots} ({pilots:cond}). Base after training: {pilot_base}.',
  '始まりは{founded}。航空連合は{alliance}（{alliance:at}）。': 'Began in {founded}. Alliance: {alliance} ({alliance:at}).',
  '{pilots:at}時点の運航乗務員は{pilots}（{pilots:cond}）。国際線は{intl_network:at}時点で{intl_network}。':
    'Flight crew as of {pilots:at}: {pilots} ({pilots:cond}). International network as of {intl_network:at}: {intl_network}.',
  '設立は{founded}。航空連合は{alliance}。パイロットの拠点は{pilot_base}。': 'Founded {founded}. Alliance: {alliance}. Pilot base: {pilot_base}.',
  '{fleet_total:at}時点の機材は、{fleet_total:cond}で{fleet_total}。': 'Fleet as of {fleet_total:at}: {fleet_total} ({fleet_total:cond}).',
  '設立は{founded}、最初の便は{first_flight}。航空連合は{alliance}（{alliance:at}）。':
    'Founded {founded}; first flight {first_flight}. Alliance: {alliance} ({alliance:at}).',
  '{fleet_total:at}時点の機材は{fleet_total}。パイロットの勤務地は{pilot_base}。': 'Fleet as of {fleet_total:at}: {fleet_total}. Pilot base: {pilot_base}.',
  /* 項目の名前 */
  '設立': 'Founded',
  '航空連合': 'Alliance',
  '乗務を始めてからの勤務地': 'Base after training',
  '運航している機材': 'Aircraft in service',
  '路線': 'Routes',
  '運航乗務員': 'Flight crew',
  '運航乗務員の平均年齢': 'Average age of flight crew',
  '1年の旅客': 'Annual passengers',
  'エアバス A350-900': 'Airbus A350-900',
  'エアバス A350-1000': 'Airbus A350-1000',
  'ボーイング 787-9': 'Boeing 787-9',
  'ボーイング 787-8': 'Boeing 787-8',
  'ボーイング 777-300ER': 'Boeing 777-300ER',
  'ボーイング 767-300ER': 'Boeing 767-300ER',
  'ボーイング 737-800': 'Boeing 737-800',
  'エアバス A321ceo（貨物機）': 'Airbus A321ceo (freighter)',
  'エンブラエル 170': 'Embraer 170',
  'エンブラエル 190': 'Embraer 190',
  'DHC-8-400 カーゴコンビ': 'DHC-8-400 Cargo Combi',
  '休日': 'Days off',
  '勤務時間の決め方': 'Working hours',
  '訓練の場所': 'Training location',
  '副操縦士として乗務する期間': 'Time as first officer',
  '賞与': 'Bonus',
  '社宅・寮': 'Company housing and dormitories',
  '社員の航空券': 'Staff travel',
  '通勤費': 'Commuting costs',
  '昇給': 'Pay increments',
  '年次有給休暇の取得率': 'Paid leave uptake',
  '採用予定数': 'Planned intake',
  '入社時の給与': 'Starting pay',
  'エントリーの受付': 'Applications open',
  '自社養成パイロットへの応募': 'Applying as an ab initio cadet',
  'パイロット（ライセンス保有者）の採用': 'Licensed pilot hiring',
  '国際線': 'International network',
  '国内線': 'Domestic routes',
  '機長': 'Captains',
  '副操縦士': 'First officers',
  'エアバス A380-800': 'Airbus A380-800',
  'ボーイング 777-300／-300ER': 'Boeing 777-300/-300ER',
  'ボーイング 777-200／-200ER': 'Boeing 777-200/-200ER',
  'ボーイング 777F（貨物機）': 'Boeing 777F (freighter)',
  'ボーイング 787-10（国内線仕様）': 'Boeing 787-10 (domestic configuration)',
  'ボーイング 787-10（国際線仕様）': 'Boeing 787-10 (international configuration)',
  'ボーイング 767-300／-300ER': 'Boeing 767-300/-300ER',
  'ボーイング 767-300F／-300BCF（貨物機）': 'Boeing 767-300F/-300BCF (freighter)',
  'エアバス A321-200neo': 'Airbus A321-200neo',
  'エアバス A321-200': 'Airbus A321-200',
  'エアバス A320-200neo': 'Airbus A320-200neo',
  '乗務のパターン': 'Trip patterns',
  '副操縦士から機長まで': 'Time to command',
  '寮・社宅': 'Dormitories and company housing',
  '諸手当': 'Allowances',
  '通勤補助費': 'Commuting allowance',
  '年次有給休暇の付与': 'Paid annual leave entitlement',
  '採用人数': 'Intake',
  '入社時の月額（大卒・高等専門学校の専攻科卒）': 'Starting monthly pay (university or technical college advanced course graduates)',
  '入社時の月額（院卒）': 'Starting monthly pay (postgraduates)',
  'プレエントリーの締切': 'Pre-entry deadline',
  'ライセンスを持つ人の採用': 'Licensed pilot hiring',
  'パイロットの拠点': 'Pilot base',
  '旅客便の就航地': 'Passenger destinations',
  '訓練中の訓練生': 'Cadets in training',
  'エアバス A321neo': 'Airbus A321neo',
  'エアバス A330-300': 'Airbus A330-300',
  'ボーイング 777-300': 'Boeing 777-300',
  'ボーイング 747-400ERF（貨物機）': 'Boeing 747-400ERF (freighter)',
  'ボーイング 747-8F（貨物機）': 'Boeing 747-8F (freighter)',
  '年次休暇（First Officer）': 'Annual leave (First Officer)',
  '年次休暇（Second Officer）': 'Annual leave (Second Officer)',
  '昇格の決まり方': 'Promotion criteria',
  '住宅手当': 'Housing allowance',
  '月々の手当（First Officer）': 'Monthly allowance (First Officer)',
  '月々の手当（Second Officer）': 'Monthly allowance (Second Officer)',
  '子の教育手当': 'Children’s education allowance',
  '医療': 'Medical',
  '引っ越しの支援': 'Relocation support',
  '通勤': 'Commuting',
  'First Officer の募集': 'First Officer hiring',
  'Second Officer の募集': 'Second Officer hiring',
  'First Officer の応募に要る飛行時間': 'Minimum flying hours (First Officer)',
  '訓練生の募集': 'Cadet hiring',
  '最初の便': 'First flight',
  'パイロットの勤務地': 'Pilot base',
  '就航地': 'Destinations',
  'ボーイング 787-10': 'Boeing 787-10',
  '年次休暇': 'Annual leave',
  '有給の病気休暇': 'Paid sick leave',
  '住まい': 'Housing',
  '乗務資格を失ったときの保険': 'Loss of license insurance',
  '募集している職': 'Open position',
  '契約の期間': 'Contract length',
  '応募に要る総飛行時間': 'Minimum total flight time',
  '応募に要るジェット機の飛行時間': 'Minimum jet time',
  /* 値 */
  '1951年8月1日': '1 August 1951',
  'ワンワールド': 'oneworld',
  '羽田空港、成田空港など': 'Haneda, Narita and other airports',
  '原則として月間10日': '10 a month, as a rule',
  '乗務に応じた変形労働時間制': 'Variable working hours set by the flying schedule',
  '国内と米国アリゾナ州フェニックス': 'Japan, and Phoenix, Arizona, in the United States',
  '10年程度': 'About 10 years',
  '年3回（夏季・年末・年度末）': 'Three times a year (summer, year-end and end of the fiscal year)',
  '社宅・寮制度あり': 'Company housing and dormitory scheme available',
  '優待搭乗制度': 'Staff travel scheme',
  '当社規定により支給': 'Paid under company rules',
  '年1回': 'Once a year',
  '新卒採用およびキャリア採用合計で50名程度': 'About 50 in total, new graduates and mid-career hires combined',
  '2026年3月1日10時より順次開始': 'In stages from 10:00 on 1 March 2026',
  '事業用操縦士免許を持っている人・過去に取得した人は応募できない': 'Not open to anyone who holds, or has ever held, a commercial pilot license',
  '運航乗務員訓練生の採用試験を適宜実施。詳細は在籍中の養成機関へ': 'Selection for flight crew trainees is held from time to time; ask your current flight school for details',
  '1952年（日本ヘリコプター輸送として設立）': '1952 (founded as Japan Helicopter and Aeroplane Transports)',
  'スターアライアンス': 'Star Alliance',
  '東京': 'Tokyo',
  '世界40都市55路線': '55 routes to 40 cities worldwide',
  '月間10日間程度': 'About 10 a month',
  '乗務に応じたシフト勤務（土・日・祝日勤務あり、早朝・深夜・宿泊を伴う勤務あり）':
    'Shifts set by the flying schedule (including weekends and public holidays, early-morning and late-night duties, and overnight trips)',
  '国内線は日帰りから2泊3日が基本。国際線は渡航先で1〜2日滞在': 'Domestic trips: day trips to 3 days (2 nights) as standard. International: layovers of 1–2 days',
  '約10年': 'About 10 years',
  '年3回（夏季・年末・期末）': 'Three times a year (summer, year-end and end of term)',
  '新卒入社時か異動時に、寮・社宅を利用できる': 'Dormitories and company housing can be used when joining as a new graduate or on transfer',
  '家族手当、住宅手当、深夜労働手当、土日出勤手当など': 'Family, housing, late-night work and weekend work allowances, among others',
  '当社規程により支給': 'Paid under company rules',
  '年1回（4月）': 'Once a year (April)',
  '65名程度': 'About 65',
  '2026年3月10日 23:59': '23:59 on 10 March 2026',
  '操縦士資格を取得している人（ライセンサー）の採用も行っている': 'Also hires people who already hold a pilot license',
  '1946年（香港）': '1946 (Hong Kong)',
  'ワンワールド（創設メンバー）': 'oneworld (founding member)',
  '香港': 'Hong Kong',
  '100以上': 'More than 100',
  '500人以上': 'More than 500',
  '飛行経験・評価・空席・先任順で決まる': 'Depends on flying experience, performance, available vacancies and seniority',
  '本人と対象の家族に割引の航空券': 'Discounted travel for you and eligible dependents',
  '住宅手当は無い。暮らしの費用を支える月々の手当がある': 'No housing allowance; a monthly allowance supports the cost of living',
  '対象の乗員に、子の教育手当がある': 'Children’s education allowance for eligible officers',
  '本人と対象の家族に、選べる福利厚生の制度がある': 'A flexible benefits scheme for you and eligible family members',
  '海外に住む採用者に、引っ越しの支援がある': 'Relocation assistance for successful candidates living overseas',
  '香港島・九龍・新界の主な住宅地との間にバスがある': 'Buses to and from most major residential areas on Hong Kong Island, in Kowloon and in the New Territories',
  '募集していない': 'Not hiring',
  '合計1,500時間以上（3,000時間が望ましい）': 'At least 1,500 hours total time (3,000 preferred)',
  '約80週の訓練生課程を、通年で募集': 'Applications to the ~80-week cadet program are open year-round',
  '1989年3月8日': '8 March 1989',
  '1991年7月1日': '1 July 1991',
  '台北（台湾）': 'Taipei (Taiwan)',
  '月に連続8日': '8 consecutive days a month',
  '年22日。年数に応じて増え、最高で年42日': '22 days a year, rising with years of service to up to 42 days a year',
  '年に最大30日': 'Up to 30 days a year',
  '家賃の補助、または会社の住まい': 'Rent subsidy or company accommodation',
  '会社の売上に応じた年末賞与': 'Year-end bonus based on company revenue',
  '無料と割引の航空券（対象の家族を含む）': 'Free and discounted travel (eligible family members included)',
  '副操縦士は10万米ドル、機長は20万米ドルの保険。保険料は会社が払う': 'USD 100,000 cover for first officers and USD 200,000 for captains; the company pays the premium',
  'A321・B777・B787 の副操縦士（経験者）': 'Experienced first officers for the A321, B777 and B787',
  /* 時点の言い直し（at_ja） */
  '2007年4月に加盟': 'joined April 2007',
  '2027年度入社の募集要項': 'requirements for 2027 entry',
  '2025年度': 'FY2025',
  '採用サイトの職種紹介': 'role description on the careers site',
  '2024年度の実績': 'FY2024 actual',
  '1999年10月に加盟': 'joined October 1999',
  '2027年度新卒の募集要項': 'requirements for 2027 graduates',
  '採用サイトの「働き方・福利厚生」': 'careers site, “Working style and benefits”',
  '2026年度の予定': 'planned for FY2026',
  '2013年6月に加盟': 'joined June 2013',
  '経験者の副操縦士の募集': 'experienced first officer posting',
  '会社の募集ページ': 'the company’s recruitment page',
  /* 街と国（拠点。国の字は COUNTRIES の en と同じ ──「香港」は街と国の両方に使う） */
  '台北': 'Taipei',
  '日本': 'Japan',
  '台湾': 'Taiwan',
  /* 条件（cond_ja） */
  'JALグループの数。ZIPAIR Tokyo とスプリング・ジャパンを含み、ジェットスター・ジャパンは含まない': 'JAL Group total, including ZIPAIR Tokyo and Spring Japan but not Jetstar Japan',
  'JALグループの国内線と国際線の合計': 'JAL Group domestic and international routes combined',
  '日本航空の数。休職者は除く': 'Japan Airlines only, excluding those on leave',
  'JALグループのフルサービスキャリアの有償旅客（国際線と国内線の合計）': 'revenue passengers of the JAL Group full-service carrier (international and domestic combined)',
  '乗務を始めてから': 'once on the line',
  '自社養成の副操縦士になるまでの訓練': 'training of ab initio cadets up to first officer',
  '自社養成パイロットの目安年次。そのあと機長昇格訓練': 'indicative timeline for ab initio cadets, followed by command upgrade training',
  '日本航空の全社員': 'all Japan Airlines employees',
  '自社養成パイロット': 'ab initio cadets',
  '自社養成パイロットの新卒。機長・副操縦士の給与ではない': 'new-graduate ab initio cadets; not captain or first officer pay',
  'JALグループの2027年度入社の採用': 'JAL Group recruitment for 2027 entry',
  '事業用操縦士ライセンスを持つ人が対象。機長・副操縦士の経験者に向けた募集要項は、採用サイトに掲載が無い':
    'for commercial pilot license holders; the careers site lists no requirements for experienced captains or first officers',
  '全日本空輸の数': 'All Nippon Airways only',
  'コードシェアと重複する路線を除く': 'excluding codeshare and duplicated routes',
  '適用条件あり': 'conditions apply',
  '全社員': 'all employees',
  '運航乗務職（自社養成パイロット）の新卒': 'new-graduate flight crew (ab initio cadets)',
  '入社時の月額。機長・副操縦士の給与ではない': 'monthly pay on joining; not captain or first officer pay',
  '2027年度新卒': '2027 graduates',
  'ライセンサーの募集要項は採用サイトに掲載が無い。キャリア採用の一覧にも運航乗務職は無い':
    'the careers site lists no requirements for license holders, and flight crew roles are not among the mid-career openings',
  'キャセイパシフィック航空（会社単体）の旅客機と貨物機': 'passenger and cargo aircraft of Cathay Pacific Airways alone',
  'キャセイパシフィックと香港エクスプレスの合計': 'Cathay Pacific and HK Express combined',
  'キャセイパシフィック航空の有償旅客。香港エクスプレスは含まない': 'Cathay Pacific revenue passengers, not including HK Express',
  '訓練生の課程を終えたあと': 'after completing the cadet program',
  'この額から': 'quoted as “from” this amount',
  '香港を拠点とする職種の全体': 'all Hong Kong-based roles',
  '貨物便だけの就航地を含む': 'including cargo-only destinations',
  'A321・B777・B787 の副操縦士（経験者）の募集の条件': 'terms of the posting for experienced A321, B777 and B787 first officers',
  '訓練を終えて最初の乗務から3か月たったあと': 'from three months after the first flight duty following training',
  '身体検査で不適合になり、身体検査証を失った場合': 'if the pilot is found medically unfit and loses their medical certificate',
  '最大離陸重量20トン超・多発・複数乗員の商用ジェット機': 'multi-engine, multi-crew commercial jets with an MTOW above 20 tonnes',
  /* 出どころの名前（題は “…”。日本語の題は英語に言い直し、英語の題は原文のまま） */
  '日本航空「会社概要」': 'Japan Airlines, “Company Overview”',
  '日本航空「JALの歴史 2000年代」': 'Japan Airlines, “JAL History: the 2000s”',
  '日本航空の採用サイト「職種別募集要項 パイロット（新卒）」': 'Japan Airlines careers site, “Requirements by role: Pilot (new graduates)”',
  '日本航空「航空機数」': 'Japan Airlines, “Number of aircraft”',
  '日本航空「運航路線数」': 'Japan Airlines, “Number of routes”',
  '「JALグループ安全報告書 2025年度」': '“JAL Group Safety Report FY2025”',
  '日本航空「JAL Group ESG Data」': 'Japan Airlines, “JAL Group ESG Data”',
  '日本航空 有価証券報告書 第77期（2025年4月〜2026年3月）': 'Japan Airlines, Annual Securities Report for the 77th fiscal year (April 2025 – March 2026)',
  '日本航空の採用サイト「職種紹介 自社養成パイロット」': 'Japan Airlines careers site, “Roles: ab initio cadet pilot”',
  '日本航空の発表「JALグループ、2027年度入社の新卒採用の募集を開始」': 'Japan Airlines news release, “JAL Group opens new-graduate recruitment for 2027 entry”',
  'ANA「ANAグループの歩み」': 'ANA, “History of the ANA Group”',
  'ANAホールディングス「統合報告書 2026」': 'ANA Holdings, “Integrated Report 2026”',
  'ANAの採用サイト「2027年度新卒 募集要項（運航乗務職）」': 'ANA careers site, “Requirements for 2027 graduates (flight crew)”',
  'ANAホールディングス「Fact Book 2026」': 'ANA Holdings, “Fact Book 2026”',
  '「ANAグループ 安全報告書 2025年度」': '“ANA Group Safety Report FY2025”',
  'ANAの採用サイト「職種紹介（運航乗務職）」': 'ANA careers site, “Roles: flight crew”',
  'ANAの採用サイト「働き方・福利厚生」': 'ANA careers site, “Working style and benefits”',
  'キャセイパシフィック航空「Interim Report 2026」': 'Cathay Pacific, “Interim Report 2026”',
  'キャセイパシフィック航空の採用サイトの FAQ「Is it possible to be based in my home country or somewhere other than Hong Kong?」':
    'Cathay Pacific careers FAQ, “Is it possible to be based in my home country or somewhere other than Hong Kong?”',
  'キャセイパシフィック航空「Flights to Hong Kong」': 'Cathay Pacific, “Flights to Hong Kong”',
  'キャセイパシフィック航空「Annual Report 2025」': 'Cathay Pacific, “Annual Report 2025”',
  'キャセイパシフィック航空の発表「Cathay Pacific celebrates the graduation of its first batch of cadet pilots whose ground theory training was provided by Cathay Academy」':
    'Cathay Pacific news release, “Cathay Pacific celebrates the graduation of its first batch of cadet pilots whose ground theory training was provided by Cathay Academy”',
  'キャセイパシフィック航空の採用サイト「Flight Crew」': 'Cathay Pacific careers site, “Flight Crew”',
  'キャセイパシフィック航空の採用サイトの FAQ「What career progression opportunities exist after completing the Cadet Pilot Programme?」':
    'Cathay Pacific careers FAQ, “What career progression opportunities exist after completing the Cadet Pilot Programme?”',
  'キャセイパシフィック航空の採用サイトの FAQ「Will I receive medical coverage for myself and my family?」':
    'Cathay Pacific careers FAQ, “Will I receive medical coverage for myself and my family?”',
  'キャセイパシフィック航空の採用サイトの FAQ「Will Cathay Pacific help with my relocation to Hong Kong?」':
    'Cathay Pacific careers FAQ, “Will Cathay Pacific help with my relocation to Hong Kong?”',
  'キャセイパシフィック航空の採用サイトの FAQ「What if commuting to work feels far? Will I receive any transport allowance?」':
    'Cathay Pacific careers FAQ, “What if commuting to work feels far? Will I receive any transport allowance?”',
  'キャセイパシフィック航空の募集「Cadet Pilot Programme」': 'Cathay Pacific job posting, “Cadet Pilot Programme”',
  'エバー航空「Company Chronicle」': 'EVA Air, “Company Chronicle”',
  'エバー航空「EVA Values」': 'EVA Air, “EVA Values”',
  'エバー航空「Job Openings (Pilots)」': 'EVA Air, “Job Openings (Pilots)”',
  'エバー航空「Worldwide Airports」': 'EVA Air, “Worldwide Airports”',
  'エバー航空「EVA Air Fleet」': 'EVA Air, “EVA Air Fleet”',
  'エバー航空「Main Business and Services」': 'EVA Air, “Main Business and Services”',
  'エバー航空「Operational Data」': 'EVA Air, “Operational Data”',
  '長榮航空「飛航人員職缺」': 'EVA Air, “飛航人員職缺” (pilot job openings)',
});

/* ════════════ 読むための関数 ════════════ */

const LISTS = ['profile', 'scale', 'fleet', 'work', 'benefits', 'jobs'];

/** その社の全項目を [在りか, 項目, 種類] で順に返す（検査と --list が同じ並びを歩く）。 */
export function* allItems(slug) {
  const a = FACTS[slug];
  if (!a) return;
  for (const k of LISTS) for (const [i, x] of (a[k] || []).entries()) yield [`${k}[${i}]`, x, k];
  if (a.base) {
    yield ['base', a.base, 'base'];
    if (a.base.iata_src) yield ['base.iata_src', a.base.iata_src, 'part'];
  }
}

/** 最初の1画面に出す1つ（group は 'work' か 'benefits'）。無ければ null。 */
export const lead = (slug, group) => ((FACTS[slug] || {})[group] || []).find(x => x.lead) || null;

/** 鍵からその社の項目。無ければ null。 */
export function factOf(slug, key) {
  for (const [, x, type] of allItems(slug)) if (type !== 'part' && x.key === key) return x;
  return null;
}

/** 画面に出す「いつの話か」。字で言い直したもの（at_ja）が在ればそれ、無ければ at を字に。 */
export const whenText = x => x.at_ja || atText(x.at);

/** 紹介文に使える項目（歴史・拠点・規模の中から）。無ければ null。 */
export function introFact(slug, key) {
  const a = FACTS[slug] || {};
  if (a.base && a.base.key === key) return a.base;
  return [...(a.profile || []), ...(a.scale || [])].find(x => x.key === key) || null;
}
/** 紹介文を [{ text, uses }] で返す（作り方は career-facts.mjs の fillIntro の1か所）。 */
export const introText = slug => fillIntro((FACTS[slug] || {}).intro, key => introFact(slug, key), whenText);

/* 英語版の準備（2026-10-21）。どの画面もまだ読まない。字は EN と career-facts.mjs の英語の対の決まり。 */
/** 「いつの話か」の英語（at_ja が在ればその英語、無ければ at を英語の日付に）。 */
export const whenTextEn = x => (x.at_ja ? twinOf(EN, x.at_ja) : atTextEn(x.at));
/** 紹介文の英語（fillIntroEn。型は EN、字は英語の対）。 */
export const introTextEn = slug => fillIntroEn(EN, (FACTS[slug] || {}).intro, key => introFact(slug, key), whenTextEn);

export default FACTS;

/* ════════════ 自己検査（node airline-facts.mjs --check）════════════ */

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const AT  = /^\d{4}(-(\d{2}(-\d{2})?|H[12]))?$/;
const PUB = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const SLUGS = ['jal', 'ana', 'cathay-pacific', 'eva-air'];
/* 紹介文に書かない言い方（台帳に出どころの無い順位・飾りの形容・年収の話）。 */
const INTRO_BANNED = /第.位|最大|最古|有数|屈指|フラッグ|国営|政府系|急成長|名門|一流|老舗|年収|給与|定年|退職/;
const INTRO_MAX = 150;   // 全部の文を合わせた字数

export function check() {
  const bad = [];
  const fail = (where, msg) => bad.push(`${where}: ${msg}`);
  let n = 0;

  for (const slug of Object.keys(FACTS)) {
    if (!SLUGS.includes(slug)) fail(slug, 'この台帳に置く会社ではない（エティハド航空は career-facts.mjs）');
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
      if (s.published !== undefined && !PUB.test(String(s.published))) fail(where, `src.published の形が違う（${s.published}）`);
      if (!ISO.test(String(x.as_of || ''))) fail(where, `as_of が日付でない（${x.as_of}）`);

      /* 引用（全項目）。空白はそろえた形で持つ */
      if (typeof x.quote !== 'string' || !x.quote.trim()) fail(where, 'quote が無い');
      else if (x.quote !== squash(x.quote)) fail(where, `引用の空白がそろっていない（${JSON.stringify(x.quote)}）`);
      if (type === 'part') continue;

      /* いつの話か（全項目） */
      if (!AT.test(String(x.at ?? ''))) fail(where, `at（いつの話か）が無い・形が違う（${x.at}）`);
      if (x.at_ja !== undefined && (typeof x.at_ja !== 'string' || !x.at_ja.trim())) fail(where, 'at_ja が空');

      /* 名前と中身 */
      if (!x.key || !x.ja) fail(where, 'key / ja が無い');
      const list = where0.replace(/\[\d+\]$/, '');
      seen[list] = seen[list] || new Set();
      if (seen[list].has(x.key)) fail(where, `key が重なっている（${x.key}）`);
      seen[list].add(x.key);
      if (x.value === undefined || x.value === '') fail(where, 'value が無い');
      if (typeof x.value === 'number' && !x.unit && !x.cur) fail(where, '数字に unit も cur も無い');

      /* 金額は元の通貨と額。誰の・何の額かを必ず添える */
      if (x.cur) {
        if (typeof x.value !== 'number' || !(x.value > 0)) fail(where, `額が正の数でない（${x.value}）`);
        else if (!Number.isFinite(man(x.cur, x.value))) fail(where, `円に直せない通貨（${x.cur}）`);
        if (!x.cond_ja) fail(where, '金額に条件（cond_ja ＝ 誰の・何の額か）が無い');
      }

      /* パイロットの条件か、全社員の制度か */
      if (['work', 'benefits', 'jobs'].includes(type) && typeof x.pilot !== 'boolean') fail(where, 'pilot（パイロットの条件か）が書かれていない');
      if (x.lead !== undefined && (x.lead !== true || !['work', 'benefits'].includes(type))) fail(where, 'lead は work か benefits の1つに true で');
      if (x.lead && x.pilot !== true) fail(where, '最初の1画面に出す1つが、パイロットの条件ではない');
    }

    /* 拠点: 街と国が在る・空港のコードは3字（挙げていなければ空）・別のページから取ったなら引用にその字が在る */
    const b = a.base;
    if (!b) fail(`${slug}.base`, '拠点が無い');
    else {
      if (!b.city_ja || !b.country_ja) fail(`${slug}.base`, 'city_ja / country_ja が無い');
      if (!Array.isArray(b.iata) || b.iata.some(c => !/^[A-Z]{3}$/.test(c))) fail(`${slug}.base`, `iata が英大文字3字の並びでない（${JSON.stringify(b.iata)}）`);
      else if (b.iata_src && !b.iata.some(c => String(b.iata_src.quote || '').includes(c))) fail(`${slug}.base.iata_src`, '引用に空港のコードが無い');
    }

    /* 最初の1画面に出す1つ（勤務・待遇に1つずつ） */
    for (const g of ['work', 'benefits']) {
      const k = (a[g] || []).filter(x => x.lead).length;
      if (k !== 1) fail(`${slug}.${g}`, `最初の1画面に出す1つ（lead）が ${k} 個`);
    }

    /* 紹介文: 字が台帳の項目だけでできている（決まりは career-facts.mjs の checkIntro の1か所）。1文は必ず在る。 */
    if (!(a.intro || []).length) fail(`${slug}.intro`, '紹介文が無い');
    checkIntro(slug, a.intro, fail, { find: key => introFact(slug, key), scale: a.scale, when: whenText, banned: INTRO_BANNED, max: INTRO_MAX });

    /* 機材: 内訳の合計が、同じ発表の総数と合う */
    const total = (a.scale || []).find(x => x.key === 'fleet_total');
    if (!total) fail(`${slug}.scale`, 'fleet_total が無い');
    else if ((a.fleet || []).length) {
      const sum = a.fleet.reduce((t, x) => t + x.value, 0);
      if (sum !== total.value) fail(`${slug}.fleet`, `内訳の合計 ${sum} が総数 ${total.value} と合わない`);
      for (const x of a.fleet) if (x.src !== total.src || x.at !== total.at) fail(`${slug}.fleet.${x.key}`, '総数と同じ発表・同じ時点ではない');
    }
  }
  for (const slug of SLUGS) if (!FACTS[slug]) fail(slug, '台帳に無い');

  /* 英語の対（英語版の準備）: 画面に出る日本語の字に英語が在る・紹介文の英語は日本語と同じ {鍵} だけで組める */
  const en = checkTwins('airline-facts', EN, Object.entries(FACTS), fail);
  for (const slug of Object.keys(FACTS)) checkIntroEn(slug, FACTS[slug].intro, EN, key => introFact(slug, key), whenTextEn, fail);

  return { n, bad, en };
}

function list() {
  for (const slug of Object.keys(FACTS)) {
    for (const [where, x] of allItems(slug)) {
      const v = `${x.cur ? x.cur + ' ' : ''}${x.value ?? ''}${x.unit && !x.cur ? x.unit : ''}${x.iata ? `  [${x.iata.join('・') || 'コードなし'}] ${x.city_ja}（${x.country_ja}）` : ''}`;
      console.log(`■ ${slug}.${where}  ${x.key || ''}  ${x.ja || ''}${x.lead ? '  ★最初の1画面' : ''}${x.pilot === false ? '  （全社員）' : ''}`);
      if (x.key) console.log(`   値: ${v}${x.cond_ja ? `（${x.cond_ja}）` : ''}`);
      if (x.key) console.log(`   時点: ${whenText(x) || '—'}（${x.at}）／ 確かめた日: ${x.as_of}`);
      console.log(`   出どころ: [${x.src.kind}] ${x.src.name}\n             ${x.src.url}`);
      console.log(`   引用: ${x.quote}`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--list')) list();
  if (args.includes('--check') || !args.includes('--list')) {
    const { n, bad, en } = check();
    if (bad.length) {
      for (const b of bad) console.log(`❌ ${b}`);
      console.log(`\n❌ airline-facts: ${bad.length}件`);
      process.exit(1);
    }
    const per = SLUGS.map(s => `${s} ${[...allItems(s)].length}`).join('・');
    console.log(`✅ airline-facts: ${n}項目（${per}／出どころ・確かめた日・時点・引用・種類の白リスト・金額には条件・機材の内訳＝総数・最初の1画面に出す1つが勤務と待遇に1つずつ・英語の対 ${en}字）`);
  }
}
