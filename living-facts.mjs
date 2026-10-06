/**
 * living-facts.mjs — 拠点の街の「暮らし」の台帳（東京・香港・台北／桃園）
 *
 * 会社ページの最初の1画面の「暮らし」の欄が出す、家賃と空港までの足の置き場。
 * アブダビ（エティハド）は career-facts.mjs の FACTS.etihad.living に在る（こちらへ写さない）。
 * どの会社がどの街かは下の CITY_OF。
 *
 * ── 決まり ──
 * ・**確かめた事実だけ。** 行は、出どころのページを開いて字のまま読めたものだけ。行を作らない。
 * ・項目の形は会社の台帳（airline-facts.mjs）と同じ:
 *     { key, ja, value, cur? | unit?, at, at_ja?, as_of, cond_ja?, src, quote }
 *   at はその数字の時点、as_of はこちらが確かめた日、quote は原文そのまま（空白だけそろえる）。
 *   ページに日付が無いものは at が開いた月で、at_ja に「開いた時点の表示」と書いてある。
 * ・金額は**元の通貨と額**（cur と value）。円は画面を作る側が出す。ここに換算の率を持たない。
 *
 * ── 家賃（rents）──
 * ⚠️ **3つとも「募集」の側の数字で、成約した家賃ではない。しかも街ごとに物差しが違う。**
 *   東京 … SUUMO の「家賃相場」（登録物件の賃料から SUUMO が独自に集計。間取りの組ごと）
 *   香港 … 28Hse に載っている募集の額の**幅**（1つの団地・寝室の数ごと・その日の掲載分）
 *   台北 … 591租屋網の募集家賃の**中央値**（直近3か月・部屋の型ごと）
 *   アブダビ（別の台帳）… Bayut の募集家賃の**平均**・**年額**
 *   → 街どうしを同じ表の同じ列に並べない。出すときは、何の額かと時点を必ず一緒に出す。
 * ・value は列ごとの額。列（cols）は街ごとに違う（出どころの区分のまま）。
 *   幅は [下, 上]。**検査は、額がその行の引用に字のまま在ることを見る**（打ち間違いを通さない）。
 * ・per は額の単位。東京の SUUMO は表に期間の字が無いので null（画面で「月」と書き足さない。
 *   「家賃相場」とだけ言う）。
 * ・**地区を選んだのは、こちら。** pick_ja がその理由（空港がある区・市／都心の区の例）。
 *   出どころは空港にも乗員にも触れていない。**乗員がそこに住んでいる、とは言っていない。**
 *   pick_ja の無い行は検査で落ちる（理由を書かずに地区を足せない）。
 * ・lead: true は、最初の1画面に出す1行（街に1つ）。lead_col はそのとき出す列。
 * ・台北の「更新至9/28」には年が書いていない。開いた日（2026-10-04）から 2026年と読んだ。
 * ・香港の Caribbean Coast と Queen's Terrace は、28Hse の地区ごとの団地一覧で
 *   いちばん上に出る団地（並びは 28Hse の既定「Popular Estate」）。地区の統計ではない。
 *
 * ── 空港までの足（commute）──
 * ・運営会社か政府のページに書いてある運賃と所要時間だけ。乗り換え検索の結果は入れない。
 * ・**駅から駅まで。** 家からの時間でも、乗務の出頭までの時間でもない。
 * ・運賃と特急料金が別建てのもの（スカイライナー）は、足さずに2つのまま持つ（合計はページに無い）。
 *
 * 書いていないもの（確かめられなかった・入れなかった）:
 *   成約した家賃／管理費を含むかどうか／広さ／JR（成田エクスプレス）の運賃と時間（ページが開けない）／
 *   京急の運賃（乗り換え検索の結果しか無い）／学費・物価（調べは在るが、この欄では出さない）／
 *   乗員がどこに住んでいるか。
 *
 * 見るもの: node living-facts.mjs --check
 *           node living-facts.mjs --list   （全項目を出どころと引用つきで並べる）
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { man } from './salary-basis.mjs';
import { squash, atText } from './career-facts.mjs';

/** 出どころの種類。会社の台帳の「会社の公表」は航空会社のことなので、ここには無い。報道も無い。 */
export const SRC_KINDS = {
  portal:   '不動産ポータルの公表',
  gov:      '政府の公表',
  operator: '鉄道・空港の運営会社の公表',
};

/* 種類ごとの、出どころの置き場。ここに無い URL は検査で落ちる。 */
const HOSTS = {
  portal: [
    /^https:\/\/suumo\.jp\//,
    /^https:\/\/www\.28hse\.com\//,
    /^https:\/\/rent\.591\.com\.tw\//,
  ],
  gov: [
    /^https:\/\/www\.tlb\.gov\.hk\//,
    /^https:\/\/travel\.tycg\.gov\.tw\//,
  ],
  operator: [
    /^https:\/\/www\.tokyo-monorail\.co\.jp\//,
    /^https:\/\/tokyo-haneda\.com\//,
    /^https:\/\/www\.haneda-tokyo-access\.com\//,
    /^https:\/\/www\.keisei\.co\.jp\//,
    /^https:\/\/www\.mtr\.com\.hk\//,
    /^https:\/\/www\.tymetro\.com\.tw\//,
  ],
};

/** どの会社がどの街か（エティハドは career-facts.mjs）。 */
export const CITY_OF = { jal: 'tokyo', ana: 'tokyo', 'cathay-pacific': 'hongkong', 'eva-air': 'taipei' };

const D4 = '2026-10-04';
const D5 = '2026-10-05';
const OPENED = '2026年10月に開いた時点の表示';

const S = {
  /* 東京 */
  suumoTokyo: { name: 'SUUMO「東京都の家賃相場情報」', kind: 'portal', published: '2026-07-10',
    url: 'https://suumo.jp/chintai/soba/tokyo/' },
  suumoChiba: { name: 'SUUMO「千葉県の家賃相場情報」', kind: 'portal', published: '2026-07-10',
    url: 'https://suumo.jp/chintai/soba/chiba/' },
  hndTerminal: { name: '羽田空港旅客ターミナル「電車・モノレール」', kind: 'operator',
    url: 'https://tokyo-haneda.com/access/train/index.html' },
  monorail: { name: '東京モノレール「モノレール浜松町駅 運賃表」', kind: 'operator',
    url: 'https://www.tokyo-monorail.co.jp/guidance/pdf/fare_hamamatucho.pdf' },
  keikyu: { name: '京急電鉄の羽田空港アクセス案内「Fare and Time Search」', kind: 'operator',
    url: 'https://www.haneda-tokyo-access.com/en/ride/fares.html' },
  skylinerFare: { name: '京成電鉄「スカイライナー 料金・購入方法」', kind: 'operator',
    url: 'https://www.keisei.co.jp/keisei/tetudou/skyliner/jp/skyliner/ticket.php' },
  skyliner: { name: '京成電鉄「スカイライナーとは」', kind: 'operator',
    url: 'https://www.keisei.co.jp/keisei/tetudou/skyliner/jp/skyliner/' },

  /* 香港 */
  hseCaribbean: { name: '28Hse の団地のページ「Caribbean Coast」', kind: 'portal',
    url: 'https://www.28hse.com/en/estate/detail/caribbean-coast-4710' },
  hseQueens: { name: "28Hse の団地のページ「Queen's Terrace」", kind: 'portal',
    url: 'https://www.28hse.com/en/estate/detail/queen-s-terrace-552' },
  tlbRail: { name: '香港政府 運輸及物流局「Hong Kong: The Facts — Railway Network」', kind: 'gov', published: '2025-09',
    url: 'https://www.tlb.gov.hk/eng/publications/transport/publications/railwaynetworkSep2025.html' },
  mtrFare: { name: 'MTR「Tickets and Fares」', kind: 'operator',
    url: 'https://www.mtr.com.hk/en/customer/tickets/tf_index.html' },

  /* 台北・桃園 */
  r591Taoyuan: { name: '591租屋網「租金行情」桃園市', kind: 'portal',
    url: 'https://rent.591.com.tw/market/region?region_id=6&shape=0' },
  r591Dayuan: { name: '591租屋網「租金行情」桃園市・大園區', kind: 'portal',
    url: 'https://rent.591.com.tw/market/region?region_id=6&section_id=78&shape=0' },
  r591Luzhu: { name: '591租屋網「租金行情」桃園市・蘆竹區', kind: 'portal',
    url: 'https://rent.591.com.tw/market/region?region_id=6&section_id=79&shape=0' },
  r591Taipei: { name: '591租屋網「租金行情」台北市', kind: 'portal',
    url: 'https://rent.591.com.tw/market/region?region_id=1&shape=0' },
  r591Daan: { name: '591租屋網「租金行情」台北市・大安區', kind: 'portal',
    url: 'https://rent.591.com.tw/market/region?region_id=1&section_id=5&shape=0' },
  tymFare: { name: '桃園メトロ「Fares」運賃表', kind: 'operator', published: '2024-10-16',
    url: 'https://www.tymetro.com.tw/tymetro-new/en/_images/document/travel-guide/price.pdf' },
  tycgMrt: { name: '桃園市政府の観光案内「Taoyuan Airport MRT」', kind: 'gov',
    url: 'https://travel.tycg.gov.tw/en/traffic/airportmrt' },
};

/* 家賃の行。東京は万円の字を円に直して持つ（7.2万円 → 72000）。 */
const SUUMO_AT = { at: '2026-07-10', at_ja: '2026年7月10日更新' };
const SUUMO_COND = 'SUUMO に登録された賃貸物件の賃料から、SUUMO が独自に集計した相場。成約した家賃ではない。マンション・間取りの組ごと。管理費を含むかはページに書いていない';
const suumo = (key, ja, pick_ja, src, v, quote, more = {}) => ({
  key, ja, pick_ja,
  value: { oneroom: v[0], k1: v[1], ldk1: v[2], ldk2: v[3], ldk3: v[4] },
  cur: 'JPY', per: null, ...SUUMO_AT, as_of: D4, src, cond_ja: SUUMO_COND, quote, ...more,
});

const HSE_AT = { at: D5, at_ja: '2026年10月5日に開いた時点の掲載分' };
const HSE_COND = '募集の額で、成約した額ではない。1つの団地だけ・平均ではなく幅・月額。管理費や差餉（レーツ）を含むかはページに書いていない。掲載は日々変わる';
const hse = (key, ja, pick_ja, src, value, quote, more = {}) => ({
  key, ja, pick_ja, value, cur: 'HKD', per: 'month', ...HSE_AT, as_of: D5, src, cond_ja: HSE_COND, quote, ...more,
});

const R591_AT = { at: '2026-09-28', at_ja: '2026年9月28日更新（直近3か月）' };
const R591_COND = '募集家賃で、成約した家賃ではない。591 に載った物件の直近3か月の中央値・月額。集計は 591 独自で「僅供參考（参考まで）」。広さと管理費の扱いは書いていない';
const r591 = (key, ja, pick_ja, src, v, quote, more = {}) => ({
  key, ja, pick_ja,
  value: { suite: v[0], bed1: v[1], bed2: v[2], bed3: v[3] },
  cur: 'TWD', per: 'month', ...R591_AT, as_of: D4, src, cond_ja: R591_COND, quote, ...more,
});

export const LIVING = {

  /* ════════ 東京（JAL・ANA）════════ */
  tokyo: {
    city_ja: '東京', country_ja: '日本',
    measure_ja: '家賃相場',
    cols: [['oneroom', 'ワンルーム'], ['k1', '1K・1DK'], ['ldk1', '1LDK・2K・2DK'], ['ldk2', '2LDK・3K・3DK'], ['ldk3', '3LDK・4K〜']],
    lead_col: 'ldk1',
    rents: [
      suumo('ota', '大田区', '羽田空港がある区', S.suumoTokyo, [72000, 85000, 125000, 172000, 209000],
        '大田区 7.2万円 8.5万円 12.5万円 17.2万円 20.9万円', { lead: true }),
      suumo('minato', '港区', '都心の区の例', S.suumoTokyo, [118000, 119000, 234000, 371000, 593000],
        '港区 11.8万円 11.9万円 23.4万円 37.1万円 59.3万円'),
      suumo('narita', '成田市（千葉県）', '成田空港がある市', S.suumoChiba, [57000, 64000, 73000, 80000, 89000],
        '成田市 5.7万円 6.4万円 7.3万円 8.0万円 8.9万円'),
    ],
    rent_basis: [
      { key: 'what', ja: '何の額か',
        value: 'SUUMO に登録されている賃貸物件の賃料をもとに、SUUMO が独自の集計で出した相場',
        ...SUUMO_AT, as_of: D4, src: S.suumoTokyo,
        quote: 'このデータは「SUUMO」に登録されている賃貸物件の賃料を元に独自の集計ロジックによって算出しています。' },
      { key: 'caveat', ja: '出どころの断り',
        value: '載っている物件の平均とは違うことがあり、正確さは保証しない',
        ...SUUMO_AT, as_of: D4, src: S.suumoTokyo,
        quote: '掲載中物件の平均金額とは異なる場合があり、その正確性について保証するものではありません。' },
      { key: 'cols', ja: '列の分け方', value: 'マンションの間取りの組（ワンルーム／1K・1DK／1LDK・2K・2DK／2LDK・3K・3DK／3LDK・4K〜）',
        ...SUUMO_AT, as_of: D4, src: S.suumoTokyo,
        quote: 'ワンルーム 1K/1DK 1LDK/2K/2DK 2LDK/3K/3DK 3LDK/4K～' },
    ],
    commute: [
      { key: 'hnd_to_stations', iata: 'HND', ja: '羽田空港から主な駅まで（電車・モノレール）',
        value: '品川駅 約15分・浜松町駅 約20分・東京駅 約30分',
        at: '2026-10', at_ja: OPENED, as_of: D4, src: S.hndTerminal, lead: true,
        cond_ja: '目安の時間。どのターミナルから・どの路線か・乗り換えの時間を含むかは表に書いていない',
        quote: '東京駅 約30分 浜松町駅 約20分 品川駅 約15分' },
      { key: 'hnd_keikyu_shinagawa', iata: 'HND', ja: '京急：品川駅 ⇄ 羽田空港',
        value: { t3: 11, t12: 14 }, unit: '分',
        at: '2026-10', at_ja: OPENED, as_of: D4, src: S.keikyu,
        cond_ja: '京急が示す目安。1つ目が第3ターミナル駅・2つ目が第1・第2ターミナル駅。列車の種別と時間帯は書いていない',
        quote: 'Shinagawa Station 11 minutes 14 minutes' },
      { key: 'hnd_monorail_fare', iata: 'HND', ja: '東京モノレール：浜松町駅 → 羽田空港の各ターミナル駅',
        value: 520, cur: 'JPY',
        at: '2026-10', at_ja: OPENED, as_of: D4, src: S.monorail,
        cond_ja: 'おとな・片道・きっぷの運賃（IC カードは¥519）。浜松町駅から。所要時間はこの表に無い',
        quote: '天空橋 羽田空港第3ターミナル 新整備場 羽田空港第1ターミナル 羽田空港第2ターミナル おとな 460 520 520 520 520' },
      { key: 'nrt_skyliner_time', iata: 'NRT', ja: '京成スカイライナー：日暮里駅 → 空港第2ビル駅',
        value: 36, unit: '分',
        at: '2026-10', at_ja: OPENED, as_of: D4, src: S.skyliner,
        cond_ja: '最短の時間（いつもこの時間という意味ではない）。日暮里駅から空港第2ビル駅まで',
        quote: '成田スカイアクセス線を経由し、在来線最速の時速160㎞で走行することで、日暮里駅から空港第2ビル駅までを最短36分(※1)で結びます。' },
      { key: 'nrt_skyliner_fare', iata: 'NRT', ja: '京成スカイライナー：京成上野・日暮里 〜 空港第2ビル・成田空港',
        value: { fare: 1280, liner: 1300 }, cur: 'JPY',
        at: '2026-10', at_ja: OPENED, as_of: D4, src: S.skylinerFare,
        cond_ja: 'おとな・片道。運賃（きっぷ。IC は¥1,267）とライナー料金は別建てで、合計はページに書いていない',
        quote: '区間 スカイライナー (京成上野・日暮里～空港第2ビル・成田空港) 運賃 [ＩＣ]大人1,267円／小児633円 [磁気]大人1,280円／小児640円 ライナー料金 大人1,300円／小児650円' },
    ],
  },

  /* ════════ 香港（キャセイパシフィック）════════ */
  hongkong: {
    city_ja: '香港', country_ja: '中国・香港',
    measure_ja: '募集の家賃の幅',
    cols: [['bed1', '1寝室'], ['bed2', '2寝室'], ['bed3', '3寝室']],
    lead_col: 'bed2',
    rents: [
      hse('caribbean_coast', '東涌（Caribbean Coast）', '空港のとなりの新市街（東涌）。28Hse の東涌の団地一覧でいちばん上に出る団地',
        S.hseCaribbean, { bed2: [15800, 18500], bed3: [18000, 28000] },
        '2 Bedrooms ( 51 ) $15,800 - $18,500/month 3 Bedrooms ( 61 ) $18,000 - $28,000/month', { lead: true }),
      hse('queens_terrace', "上環（Queen's Terrace）", '都心の例。28Hse の「Central, Sheung Wan」の団地一覧でいちばん上に出る団地',
        S.hseQueens, { bed1: [22000, 23500], bed2: [22300, 30000], bed3: [32800, 33000] },
        '1 Bedroom ( 7 ) $22,000 - $23,500/month 2 Bedrooms ( 9 ) $22,300 - $30,000/month 3 Bedrooms ( 5 ) $32,800 - $33,000/month'),
    ],
    rent_basis: [
      { key: 'currency', ja: '通貨', value: 'HKD',
        cond_ja: '寝室の数ごとの札には「$」とだけ書いてある。同じページの団地全体の行が「HKD$」と書いている',
        ...HSE_AT, as_of: D5, src: S.hseCaribbean,
        quote: 'Rental Price HKD$15,800 - HKD$60,000 128units' },
    ],
    commute: [
      { key: 'hkg_ael_time', iata: 'HKG', ja: 'エアポート・エクスプレス：空港駅 ⇄ 香港駅',
        value: 24, unit: '分',
        at: '2025-09', as_of: D5, src: S.tlbRail, lead: true,
        cond_ja: '平均でおよその時間。駅から駅まで',
        quote: 'An average journey between the Airport Station and the Hong Kong Station takes about 24 minutes.' },
      { key: 'hkg_ael_fare', iata: 'HKG', ja: 'エアポート・エクスプレス：香港駅 ⇄ 空港',
        value: 120, cur: 'HKD',
        at: '2026-10', at_ja: OPENED, as_of: D5, src: S.mtrFare,
        cond_ja: 'おとな・片道（同じ日の往復も同じ額）。オクトパスなどで払う額で、スマートチケットは HK$130',
        quote: 'Fares to／from the Airport (in HK$) Adult (aged 12 or above) To／From Single Journey／Same Day Return Round Trip Octopus / Contactless Bank Card^ / QR Code Smart Ticket Smart Ticket Hong Kong $120 $130 $215' },
    ],
  },

  /* ════════ 台北・桃園（エバー航空）════════ */
  taipei: {
    city_ja: '台北・桃園', country_ja: '台湾',
    measure_ja: '募集の家賃の中央値',
    cols: [['suite', '独立した1室（獨立套房）'], ['bed1', '1部屋（1房）'], ['bed2', '2部屋（2房）'], ['bed3', '3部屋（3房）']],
    lead_col: 'bed2',
    rents: [
      r591('taoyuan', '桃園市', '桃園国際空港がある市', S.r591Taoyuan, [9500, 16000, 22000, 25000],
        '獨立套房 9,500 元/月 比去年 +5.6% 1房 16,000 元/月 比去年 +4.2% 2房 22,000 元/月 比去年 持平 3房 25,000 元/月 比去年 持平', { lead: true }),
      r591('dayuan', '桃園市 大園區', '空港の駅（A12 機場第一航廈）の住所がある区', S.r591Dayuan, [9000, 18250, 22500, 24800],
        '獨立套房 9,000 元/月 比去年 -5.3% 1房 18,250 元/月 比去年 +7.4% 2房 22,500 元/月 比去年 +12.5% 3房 24,800 元/月 比去年 -0.8%'),
      r591('luzhu', '桃園市 蘆竹區', 'エバー航空の本社の住所がある区', S.r591Luzhu, [10000, 15750, 23000, 26950],
        '獨立套房 10,000 元/月 比去年 -9.1% 1房 15,750 元/月 比去年 -1.6% 2房 23,000 元/月 比去年 +4.5% 3房 26,950 元/月 比去年 +6.9%'),
      r591('taipei', '台北市', '台北の市全体', S.r591Taipei, [15900, 30000, 35000, 44999],
        '獨立套房 15,900 元/月 比去年 +2.6% 1房 30,000 元/月 比去年 +7.1% 2房 35,000 元/月 比去年 +7.7% 3房 44,999 元/月 比去年 +7.1%'),
      r591('daan', '台北市 大安區', '都心の区の例', S.r591Daan, [17650, 35000, 40998, 53000],
        '獨立套房 17,650 元/月 比去年 +0.9% 1房 35,000 元/月 比去年 持平 2房 40,998 元/月 比去年 +2.5% 3房 53,000 元/月 比去年 +1.9%'),
    ],
    rent_basis: [
      { key: 'what', ja: '何の額か',
        value: '591 に載った物件の家賃から、591 が独自の集計で出した額',
        ...R591_AT, as_of: D4, src: S.r591Taoyuan,
        quote: '數據來源：根據591網站刊登的物件租金，使用專有的聚合邏輯計算得出' },
      { key: 'period', ja: 'いつの・どの数字か', value: '直近3か月の中央値（9月28日更新）。参考まで',
        ...R591_AT, as_of: D4, src: S.r591Taoyuan,
        quote: '近3個月 中位數，更新至9/28，僅供參考' },
    ],
    commute: [
      { key: 'tpe_mrt_express_time', iata: 'TPE', ja: '桃園機場捷運（直達車）：台北車站 → 空港',
        value: { t1: 35, t2: 39 }, unit: '分',
        at: '2026-10', at_ja: OPENED, as_of: D4, src: S.tycgMrt, lead: true,
        cond_ja: '直達車の、駅から駅までの時間。1つ目が第1ターミナル駅・2つ目が第2ターミナル駅。待ち時間は含まない',
        quote: 'From Taipei Main Station to Taiwan Taoyuan International Airport Terminal 1 Station, it only takes 35 minutes by Express Train, and takes 39 minutes to Terminal 2 Station.' },
      { key: 'tpe_mrt_commuter_time', iata: 'TPE', ja: '桃園機場捷運（普通車）：台北車站 → 空港 第1ターミナル駅',
        value: 49, unit: '分',
        at: '2026-10', at_ja: OPENED, as_of: D4, src: S.tycgMrt,
        cond_ja: '各駅停車の、駅から駅までの時間。待ち時間は含まない',
        quote: 'Frequency Every 15 minutes Duration from A1~A12 takes 49 minutes and from A1~A21 takes 82 minutes' },
      { key: 'tpe_mrt_fare', iata: 'TPE', ja: '桃園機場捷運：台北車站 〜 空港の駅',
        value: 160, cur: 'TWD',
        at: '2026-10', at_ja: OPENED, as_of: D4, src: S.tymFare,
        cond_ja: '片道・1人。運賃表は駅の組ごとに数字が1つあるだけで、通貨の字も、直達車と普通車の区別も無い。第2ターミナル駅も同じ額',
        quote: '160 140 115 115 115 80 60 60 60 25 25' },
    ],
  },
};

/* ════════════ 読むための関数 ════════════ */

/** その街の全項目を [在りか, 項目, 種類] で順に返す（検査と --list が同じ並びを歩く）。 */
export function* allItems(city) {
  const c = LIVING[city];
  if (!c) return;
  for (const k of ['rents', 'rent_basis', 'commute'])
    for (const [i, x] of (c[k] || []).entries()) yield [`${k}[${i}]`, x, k];
}

/** その会社の街（無ければ null）。エティハドは career-facts.mjs を読む。 */
export const cityOf = slug => LIVING[CITY_OF[slug]] || null;
/** 最初の1画面に出す1行（家賃 or 空港までの足）。 */
export const lead = (city, group) => ((LIVING[city] || {})[group] || []).find(x => x.lead) || null;
/** 時点の言い方（at_ja が在ればそれ）。 */
export const whenText = x => x.at_ja || atText(x.at);
/** 額の一覧（数・幅・列ごと、のどれでも平らにする）。 */
export const amounts = v => (typeof v === 'number' ? [v] : Array.isArray(v) ? v.flatMap(amounts) : v && typeof v === 'object' ? Object.values(v).flatMap(amounts) : []);

export default LIVING;

/* ════════════ 検査 ════════════ */

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const AT = /^\d{4}(-(\d{2}(-\d{2})?|H[12]))?$/;
/* 額が引用の中でどう書かれているか（街の出どころの書き方） */
const inQuote = (x, v) => {
  const q = x.quote;
  if (x.cur === 'JPY' && x.src.kind === 'portal') return q.includes((v / 10000).toFixed(1) + '万円');
  return q.includes(v.toLocaleString('en-US')) || q.includes(String(v));
};

export function check() {
  const bad = [];
  const fail = (where, msg) => bad.push(`${where}: ${msg}`);
  let n = 0;

  for (const [slug, city] of Object.entries(CITY_OF)) if (!LIVING[city]) fail(`CITY_OF.${slug}`, `街が無い（${city}）`);
  if ('etihad' in CITY_OF) fail('CITY_OF', 'エティハドは career-facts.mjs（ここに足さない）');

  for (const [city, c] of Object.entries(LIVING)) {
    if (!c.city_ja || !c.country_ja || !c.measure_ja) fail(city, 'city_ja / country_ja / measure_ja が無い');
    const cols = new Set((c.cols || []).map(([k]) => k));
    if (!cols.size) fail(city, 'cols が無い');
    if (!cols.has(c.lead_col)) fail(city, `lead_col（${c.lead_col}）が cols に無い`);
    const seen = {};

    for (const [where0, x, type] of allItems(city)) {
      const where = `${city}.${where0}`;
      n++;
      const s = x.src;
      if (!s || !s.name || !/^https:\/\//.test(String(s.url || ''))) fail(where, '出どころ（src）の name か url が無い');
      else if (!SRC_KINDS[s.kind]) fail(where, `出どころの種類が白リストに無い（${s.kind}）`);
      else if (!HOSTS[s.kind].some(re => re.test(s.url))) fail(where, `出どころの URL が、その種類の置き場に無い（${s.url}）`);
      if (s && s.published !== undefined && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(s.published)) fail(where, 'src.published が日付でない');
      if (!ISO.test(String(x.as_of || ''))) fail(where, '確かめた日（as_of）が無い');
      if (!AT.test(String(x.at || ''))) fail(where, `時点（at）が無い・形が違う（${x.at}）`);
      if (x.at_ja !== undefined && !String(x.at_ja).trim()) fail(where, 'at_ja が空');
      if (!x.quote || x.quote !== squash(x.quote)) fail(where, '引用（quote）が無い・空白がそろっていない');
      if (!x.key || !x.ja) fail(where, 'key か ja が無い');
      seen[type] = seen[type] || new Set();
      if (seen[type].has(x.key)) fail(where, `key が重なっている（${x.key}）`);
      seen[type].add(x.key);
      if (x.value === undefined || x.value === '') fail(where, 'value が無い');
      if (x.lead !== undefined && x.lead !== true) fail(where, 'lead は true だけ');
      if (x.lead && type === 'rent_basis') fail(where, 'lead は rents と commute だけ');

      /* 額: 正の数・円に直せる通貨・条件つき・引用に字のまま在る */
      const nums = amounts(x.value);
      if (x.cur) {
        if (!nums.length) fail(where, '額が無い');
        for (const v of nums) {
          if (!(v > 0)) fail(where, `額が正の数でない（${v}）`);
          else if (!Number.isFinite(man(x.cur, v))) fail(where, `円に直せない通貨（${x.cur}）`);
        }
        if (!String(x.cond_ja || '').trim()) fail(where, '金額に条件（cond_ja）が無い');
      } else if (nums.length && !x.unit) fail(where, '数字に unit も cur も無い');
      if (x.quote && s) for (const v of nums) if (!inQuote(x, v)) fail(where, `額（${v}）が引用に無い`);

      if (type === 'rents') {
        if (!x.cur) fail(where, '家賃に通貨（cur）が無い');
        if (x.per !== null && x.per !== 'month') fail(where, `per は 'month' か null（${x.per}）`);
        if (!String(x.pick_ja || '').trim()) fail(where, 'その地区を選んだ理由（pick_ja）が無い');
        const ks = Object.keys(x.value || {});
        if (!ks.length) fail(where, '列が1つも無い');
        for (const k of ks) {
          if (!cols.has(k)) fail(where, `列（${k}）が、その街の cols に無い`);
          const v = x.value[k];
          if (Array.isArray(v) && !(v.length === 2 && v[0] <= v[1])) fail(where, `幅が [下, 上] の形でない（${k}）`);
        }
        if (x.lead && x.value[c.lead_col] === undefined) fail(where, `最初の1画面に出す行に、出す列（${c.lead_col}）が無い`);
      }
      if (type === 'commute') {
        if (!/^[A-Z]{3}$/.test(String(x.iata || ''))) fail(where, '空港（iata）が英大文字3字でない');
        if (!String(x.cond_ja || '').trim()) fail(where, '条件（cond_ja）が無い（駅から駅まで・目安、など）');
      }
    }

    for (const g of ['rents', 'commute']) {
      const k = (c[g] || []).filter(x => x.lead).length;
      if (k !== 1) fail(`${city}.${g}`, `最初の1画面に出す1行（lead）が ${k} 個（1つだけ）`);
    }
    if (!(c.rent_basis || []).length) fail(`${city}.rent_basis`, '何の額かの行が無い');
  }
  return { n, bad };
}

/* ════════════ コマンド ════════════ */

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] || '--check';
  if (mode === '--list') {
    for (const city of Object.keys(LIVING)) {
      for (const [where, x] of allItems(city)) {
        console.log(`■ ${city}.${where}  ${x.key}  ${x.ja}${x.lead ? ' ★最初の1画面' : ''}`);
        console.log(`   値: ${JSON.stringify(x.value)}${x.cur ? ' ' + x.cur : ''}${x.unit ? ' ' + x.unit : ''}${x.per ? '／' + x.per : ''}`);
        if (x.pick_ja) console.log(`   選んだ理由: ${x.pick_ja}`);
        if (x.cond_ja) console.log(`   条件: ${x.cond_ja}`);
        console.log(`   時点: ${whenText(x) || '—'}（${x.at}）／ 確かめた日: ${x.as_of}`);
        console.log(`   出どころ: [${SRC_KINDS[x.src.kind]}] ${x.src.name}\n             ${x.src.url}`);
        console.log(`   引用: ${x.quote}\n`);
      }
    }
  } else {
    const { n, bad } = check();
    if (bad.length) {
      for (const b of bad) console.log('❌ ' + b);
      console.log(`\n❌ living-facts: ${bad.length}件`);
      process.exit(1);
    }
    const per = Object.keys(LIVING).map(c => `${c} ${[...allItems(c)].length}`).join('・');
    console.log(`✅ living-facts: ${n}項目（${per}／出どころ・確かめた日・時点・引用・種類の白リスト・額が引用に字のまま在る・金額には条件・地区を選んだ理由・最初の1画面に出す1行が家賃と足に1つずつ）`);
  }
}
