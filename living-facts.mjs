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
 *   東京 … アットホームの駅ごとの「家賃相場」（1LDK・2LDK・3LDK それぞれ。しぼり込みは、ページを開いたままの表示（先頭の「すべて」））。
 *          区の SUUMO の数字は refs（「出典」の中だけ）
 *          アットホームの3行の quote は、2026年10月11日に2人が読んで書き取った記録（ページを開き直さない決まり）。ページの字の並びそのものではない
 *   香港 … 28Hse に載っている募集の額の**幅**（1つの団地・寝室の数ごと・その日の掲載分）
 *   台北 … 591租屋網の募集家賃の**中央値**（直近3か月・部屋の型ごと）
 *   アブダビ（別の台帳）… Bayut の募集家賃の**平均**・**年額**
 *   → 街どうしを同じ表の同じ列に並べない。出すときは、何の額かと時点を必ず一緒に出す。
 * ・value は列ごとの額。列（cols）は街ごとに違う（出どころの区分のまま）。
 *   幅は [下, 上]。**検査は、額がその行の引用に字のまま在ることを見る**（打ち間違いを通さない）。
 * ・per は額の単位。東京の出どころ（アットホーム・区の SUUMO）は表に期間の字が無いので null。
 *   日本の賃料の相場は月額なので、画面では「月」と出す（読み口 pv-airline-view.mjs）。
 * ・**地区を選んだのは、こちら。** pick_ja がその理由（空港がある区・市／都心の区の例）。
 *   出どころは空港にも乗員にも触れていない。**乗員がそこに住んでいる、とは言っていない。**
 *   pick_ja の無い行は検査で落ちる（理由を書かずに地区を足せない）。
 *   新しい行の pick_ja は、確かめられる事実を1つ（出どころ・引用・確かめた日つき）。
 * ・lead: true は、最初の1画面に出す1行（街に1つ）。lead_col はそのとき出す列。
 * ・台北の「更新至9/28」には年が書いていない。開いた日（2026-10-04）から 2026年と読んだ。
 * ・香港の Caribbean Coast と Queen's Terrace は、28Hse の地区ごとの団地一覧で
 *   いちばん上に出る団地（並びは 28Hse の既定「Popular Estate」）。地区の統計ではない。
 *
 * ── 空港までの足（commute）──
 * ・時間は Google マップが表示した目安（via: 'gmaps'。出発地・着く場所・手段・「すぐに出発」・見た日時・経路の住所・表示の字つき）。
 *   運賃は、運営会社のページに書いてある額だけ。運営会社の時間は2つめの出どころ（「出典」）で、Google の数字と足さない・混ぜない
 * ・出発地と着く場所は行の名前のとおり（駅・街の代表の地点・ターミナルの建物・駅）。家の玄関からの時間ではない
 * ・運賃と特急料金が別建てのもの（スカイライナー）は、足さずに2つのまま持つ（合計はページに無い）。
 *
 * 書いていないもの（確かめられなかった・入れなかった）:
 *   成約した家賃／管理費を含むかどうか／広さ／JR（成田エクスプレス）の運賃と時間（ページが開けない）／
 *   学費・物価（調べは在るが、この欄では出さない）／
 *   乗員がどこに住んでいるか。
 *
 * 見るもの: node living-facts.mjs --check
 *           node living-facts.mjs --list   （全項目を出どころと引用つきで並べる）
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { man } from './salary-basis.mjs';
import { squash, atText, FACTS as EYF } from './career-facts.mjs';

/** 出どころの種類。会社の台帳の「会社の公表」は航空会社のことなので、ここには無い。報道も無い。 */
export const SRC_KINDS = {
  portal:   '不動産ポータルの公表',
  gov:      '政府の公表',
  operator: '鉄道・空港の運営会社の公表',
  maps: 'Google マップの経路の表示',
};

/* 種類ごとの、出どころの置き場。ここに無い URL は検査で落ちる。 */
const HOSTS = {
  portal: [
    /^https:\/\/suumo\.jp\//,
    /^https:\/\/www\.28hse\.com\//,
    /^https:\/\/rent\.591\.com\.tw\//,
    /^https:\/\/www\.athome\.co\.jp\//,
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
    /^https:\/\/www\.limousinebus\.co\.jp\//,
    /^https:\/\/www\.keikyu\.co\.jp\//,
  ],
  maps: [/^https:\/\/www\.google\.com\/maps\/dir\//],
};

/** どの会社がどの街か（エティハドは career-facts.mjs）。 */
export const CITY_OF = { jal: 'tokyo', ana: 'tokyo', 'cathay-pacific': 'hongkong', 'eva-air': 'taipei' };
/** 通勤の行の手段。画面では「電車」「タクシー」の札になる（札の字は画面を作る側が持つ）。 */
export const MODES = ['train', 'taxi', 'bus', 'car'];
/** 行の出どころの形。gmaps ＝ Google マップが表示した目安／operator ＝ 運営会社・政府のページ（今までの行）。 */
export const VIAS = ['gmaps', 'operator'];
/** カードに出す1行の、手段の組（1つの都市の中では、どの街も同じ組）。 */
export const FAMILY = { train: 'transit', bus: 'transit', car: 'car', taxi: 'car' };
/** 経路が着く場所の種類。terminal ＝ 旅客ターミナルの建物／station ＝ 駅（建物とは言わない）／airport ＝ 空港の代表の地点（ターミナルは言えない）。 */
export const END_KINDS = ['terminal', 'station', 'airport'];
/** Google マップの行の、時間の種類。3つは別のもの ＝ 名前を変えない・足さない・引かない。
    walk_total ＝ 歩く区間を含むことを画面で確かめた合計／shown_total ＝ 経路の合計として表示された時間（歩く区間の内訳は見えていない）／
    drive ＝ 運転の時間（降りたあとは含まない）。 */
export const TIME_KINDS = ['walk_total', 'shown_total', 'drive'];
/* 家賃の出どころ。棒の1組 ＝ 1つの出どころ・1つの条件・1つの日付。街の家賃の行（rents）は、その都市の site の置き場のページだけ。
   別の出どころの数字は refs（「出典」の中だけに出る）へ置く。stat ＝ その出どころの数字の種類。棒にできるのは BAR_STATS だけ。 */
export const SITES = {
  suumo: { name: 'SUUMO',     host: /^https:\/\/suumo\.jp\/chintai\/soba\//,           stat: 'index' },
  hse:   { name: '28Hse',     host: /^https:\/\/www\.28hse\.com\//,                    stat: 'range' },
  r591:  { name: '591租屋網', host: /^https:\/\/rent\.591\.com\.tw\/market\//,         stat: 'median' },
  bayut: { name: 'Bayut',     host: /^https:\/\/www\.bayut\.com\//,                    stat: 'mean' },
  athome: { name: 'アットホーム', host: /^https:\/\/www\.athome\.co\.jp\/chintai\/souba\//, stat: 'mean' },
};
export const BAR_STATS = ['mean', 'median', 'index', 'calc_mean'];
/* 引用に名前の無い、今までの行（名前の検査を足す前に読んだもの）。行が台帳から出たら、ここからも消す（残っていたら落ちる）。 */
const LEGACY_NAME = new Set(['caribbean_coast', 'queens_terrace', 'taoyuan', 'dayuan', 'luzhu', 'taipei', 'daan']);
/* 選んだ理由に出どころの無い、今までの行。同じ決まり。 */
const LEGACY_PICK = new Set(['caribbean_coast', 'queens_terrace', 'taoyuan', 'dayuan', 'luzhu', 'taipei', 'daan']);

const D4 = '2026-10-04';
const D5 = '2026-10-05';
const OPENED = '2026年10月に開いた時点の表示';
/* 東京の街を選んだ理由の出どころ（京急・東京空港交通）と、運営会社の運賃表を開いて読んだ日。アットホームの日（D_ATHOME）とは別。 */
const D_PICK = '2026-10-15';

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
  athomeShinagawa: { name: 'アットホーム「品川駅の家賃相場」', kind: 'portal',
    url: 'https://www.athome.co.jp/chintai/souba/tokyo/shinagawa-st/' },
  athomeToyosu: { name: 'アットホーム「豊洲駅の家賃相場」', kind: 'portal',
    url: 'https://www.athome.co.jp/chintai/souba/tokyo/toyosu-st/' },
  athomeYokohama: { name: 'アットホーム「横浜駅の家賃相場」', kind: 'portal',
    url: 'https://www.athome.co.jp/chintai/souba/kanagawa/yokohama-st/' },
  limousineOdaiba: { name: '東京空港交通「お台場・有明エリア ⇔ 羽田空港」', kind: 'operator',
    url: 'https://www.limousinebus.co.jp/ja/line/detail/Haneda-AriakeDaibaBigSight/' },
  keikyuFareShinagawa: { name: '京急電鉄「発駅 品川 から」', kind: 'operator',
    url: 'https://www.keikyu.co.jp/ride/kakueki/pdf/KK01.pdf' },
  keikyuFareYokohama: { name: '京急電鉄「発駅 横浜 から」', kind: 'operator',
    url: 'https://www.keikyu.co.jp/ride/kakueki/pdf/KK37.pdf' },

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

/* アットホームの駅の家賃相場（2026年10月11日に2人が読んだ記録。ページは開き直さない）。 */
const D_ATHOME = '2026-10-11';
const ATHOME_AT = { at: D_ATHOME.slice(0, 7), at_ja: '2026年10月11日に開いた時点の表示' };     // ページに日付が無い
const ATHOME_COND = 'アットホームに載った直近3か月の物件の平均家賃をもとにした、相場の目安。成約した家賃ではない。物件種別・駅からの徒歩・築年数は、ページを開いたままの表示（先頭の「すべて」）。管理費を含むか・広さ・更新の日付は、ページに書いていない';
const man4 = s => Math.round(parseFloat(s) * 10000);
/** p = ページに書いてある万円の字を、1LDK・2LDK・3LDK の順に（'22.02'）。ページに額の無い間取り（「-」）は null。 */
const athome = (key, ja, src, p, quote, more = {}) => {
  const seen = ['ldk1', 'ldk2', 'ldk3'].map((k, i) => [k, p[i]]).filter(([, s]) => s != null);
  return { key, ja, value: Object.fromEntries(seen.map(([k, s]) => [k, man4(s)])), print: Object.fromEntries(seen),
    cur: 'JPY', per: null, ...ATHOME_AT, as_of: D_ATHOME, src, cond_ja: ATHOME_COND, quote, ...more };
};

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

/* Google マップの経路の行。調べた人が 2026-10-11 に見た表示を、渡された記録のとおりに写す（開き直さない）。 */
const GM_COND = 'Google マップが表示した目安の時間（「すぐに出発」で調べた時点の表示）。出発地と着く場所は行の名前のとおりで、家の玄関からの時間ではない。「徒歩込み」は、歩く区間を含むことを画面で確かめた合計。「経路の合計」は、経路の合計として表示された時間で、歩く区間を含むかは表示から確かめられていない。車は運転の時間で、降りたあとは含まない。時間帯・交通の状況・運行の時刻で変わる';
/** 見た日時の字。'2026-10-11T15:31' → 「2026年10月11日 15:31 に見た表示」／日だけなら 「2026年10月11日に見た表示」。
    tz = 'jst' ＝ 日本の外の街（時刻は日本時間で記録してある）→ 「2026年10月11日 15:31（日本時間）に見た表示」／'day' ＝ 日だけ。 */
const seenJa = (s, tz = '') => s.replace(/^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?$/, (m, y, mo, d, h, mi) =>
  `${y}年${+mo}月${+d}日${h && tz !== 'day' ? ` ${h}:${mi}${tz === 'jst' ? '（日本時間）' : ' '}` : ''}に見た表示`);
/** Google マップの経路の1行。modes ＝ 乗りものを順に（1つめが mode）。o = { from_ja, to_ja, line?, value: { walk_total | shown_total | drive: 分 },
    ride?, legs?, warn?, seen: 'YYYY-MM-DD' か 'YYYY-MM-DDTHH:MM'（日本時間）, url, quote } */
const gm = (town, end, modes, o, tz = '') => ({
  key: `gm_${town}_${end}_${modes[0]}`, town, end, iata: end.slice(0, 3).toUpperCase(), mode: modes[0], modes, via: 'gmaps',
  ja: `${o.line ? o.line + '：' : ''}${o.from_ja} → ${o.to_ja}`, from_ja: o.from_ja, to_ja: o.to_ja, line: o.line || '',
  value: o.value, ...(o.ride != null ? { ride: o.ride } : {}), ...(o.legs ? { legs: o.legs } : {}), ...(o.warn ? { warn: o.warn } : {}),
  unit: '分', depart: 'now', seen: o.seen, at: o.seen.slice(0, 10), as_of: o.seen.slice(0, 10), at_ja: seenJa(o.seen, tz),
  src: { name: 'Google マップの経路の表示', kind: 'maps', url: o.url }, cond_ja: GM_COND, quote: o.quote,
});

export const LIVING = {

  /* ════════ 東京（JAL・ANA）════════ */
  tokyo: {
    city_ja: '東京', country_ja: '日本',
    measure_ja: '家賃相場',
    cols: [['ldk1', '1LDK'], ['ldk2', '2LDK'], ['ldk3', '3LDK']],
    lead_col: 'ldk1',
    airports: [['HND', '羽田空港'], ['NRT', '成田空港']],
    /* 経路が着く場所（Google マップがその場所に決めたとおり。駅は駅、建物は建物）。 */
    ends: {
      hnd_t1: { iata: 'HND', ja: '羽田空港 第1ターミナル', kind: 'terminal' },
      hnd_t2: { iata: 'HND', ja: '羽田空港 第2ターミナル', kind: 'terminal' },
      hnd_t3: { iata: 'HND', ja: '羽田空港 第3ターミナル', kind: 'terminal' },
      hnd_t12s: { iata: 'HND', ja: '羽田空港第1・第2ターミナル駅', kind: 'station' },
      hnd_t2s: { iata: 'HND', ja: '羽田空港第2ターミナル駅', kind: 'station' },
    },
    site: 'athome', stat: 'mean', beside_ja: '条件をしぼっていない（物件種別・駅徒歩・築年数は「すべて」）', by_town: true, card_family: 'transit',
    bars: ['ldk1', 'ldk2', 'ldk3'], words: { ldk1: '1LDK', ldk2: '2LDK', ldk3: '3LDK' },
    /* 街の家賃（アットホームの駅のページ）。quote は 2026年10月11日に2人が読んで書き取った記録の行（quote_kind: 'record'）。 */
    rents: [
      athome('shinagawa', '品川', S.athomeShinagawa, ['22.02', '34.43', '41.93'], '品川 すべて 19.53 1LDK 22.02 2LDK 34.43 3LDK 41.93',
        { lead: true, sub_ja: '東京都港区', name_quote: '品川駅の家賃相場・賃料相場を調べる', quote_kind: 'record',
          pick_ja: '京急が羽田空港までの所要時間を案内している駅', pick_src: S.keikyu, pick_quote: 'Shinagawa Station 11 minutes 14 minutes', pick_as_of: D_PICK }),
      athome('toyosu', '豊洲', S.athomeToyosu, ['19.24', '25.87', '29.06'], '豊洲 すべて 22.02 1LDK 19.24 2LDK 25.87 3LDK 29.06',
        { sub_ja: '東京都江東区', quote_kind: 'record',
          pick_ja: '羽田空港行きのリムジンバスが停まる駅', pick_src: S.limousineOdaiba, pick_quote: '豊洲駅 この停留所の詳しい情報を見る', pick_as_of: D_PICK }),
      athome('yokohama', '横浜', S.athomeYokohama, ['13.57', '18.26', '21.7'], '横浜 すべて 9.17 1LDK 13.57 2LDK 18.26 3LDK 21.7',
        { sub_ja: '神奈川県横浜市西区', quote_kind: 'record',
          pick_ja: '京急が羽田空港までの所要時間を案内している駅', pick_src: S.keikyu, pick_quote: 'Yokohama Station 23 minutes 28 minutes', pick_as_of: D_PICK }),
    ],
    rent_basis: [
      { key: 'what', ja: '何の額か',
        value: 'アットホームに載っている物件の平均家賃をもとに、アットホームが出した相場の目安',
        ...ATHOME_AT, as_of: D_ATHOME, src: S.athomeShinagawa,
        quote: '掲載物件の平均家賃から、品川駅での相場の目安がわかる！' },
      { key: 'period', ja: 'いつの・どの数字か', value: '直近3か月に掲載された物件',
        ...ATHOME_AT, as_of: D_ATHOME, src: S.athomeShinagawa,
        quote: '※当サイトに掲載した直近3ヶ月の物件情報をもとに相場を算出しています' },
      { key: 'caveat', ja: '出どころの断り',
        value: '物件が少ないときは相場を出せないことがあり、相場のしぼり込み条件は物件の検索条件と一致しないことがある',
        ...ATHOME_AT, as_of: D_ATHOME, src: S.athomeShinagawa,
        quote: '※物件数が少ないときは、相場の算出ができない場合があります ※相場の絞り込み条件は、物件の検索条件と一致しない場合があります' },
      { key: 'cols', ja: '列の分け方', value: '1LDK・2LDK・3LDK をそれぞれ単独で。物件種別・駅徒歩・築年数は「すべて」',
        ...ATHOME_AT, as_of: D_ATHOME, src: S.athomeShinagawa, quote_kind: 'record',
        quote: '物件種別 すべて / マンション / アパート / 一戸建て | 駅徒歩 すべて / 〜3分 / 3〜5分 / 5〜7分 / 7〜10分 / 10〜15分 / 15〜20分 / 20分〜 | 築年数 すべて / 新築（築1年未満） / 1〜3年 / 3〜5年 / 5〜10年 / 10〜15年 / 15〜20年 / 20年〜' },
    ],
    /* 区・市の SUUMO の家賃相場（もとの3行。値と日付はそのまま）。「出典」の中の「参考」にだけ出る。 */
    refs: [{ key: 'suumo_wards', ja: '区・市ごとの家賃相場', site: 'suumo', measure_ja: '家賃相場',
      cols: [['oneroom', 'ワンルーム'], ['k1', '1K・1DK'], ['ldk1', '1LDK・2K・2DK'], ['ldk2', '2LDK・3K・3DK'], ['ldk3', '3LDK・4K〜']],
      rows: [
        suumo('ota', '大田区', '羽田空港がある区', S.suumoTokyo, [72000, 85000, 125000, 172000, 209000],
          '大田区 7.2万円 8.5万円 12.5万円 17.2万円 20.9万円'),
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
    }],
    commute: [
      /* Google マップの表示（2026-10-11 に調べた人が見たもの・取り直していない）。街ごと・着く場所ごと・手段ごとに1行。 */
      gm('shinagawa', 'hnd_t1', ['train'], { from_ja: '品川駅',
        to_ja: '羽田空港 第1ターミナル',
        line: '京急',
        value: { walk_total: 26 },
        legs: [10, 12],
        seen: '2026-10-11T15:31',
        url: 'https://www.google.com/maps/dir/品川駅、〒108-0074+東京都港区高輪３丁目２６−２７/羽田空港第1ターミナル、〒144-0041+東京都大田区３丁目/@35.5967596,139.6734108,12z/am=t/data=!3m1!4b1!4m14!4m13!1m5!1m1!1s0x60188a5a6e148775:0x9a45c347f706db70!2m2!1d139.7387597!2d35.6284713!1m5!1m1!1s0x601863f7525776fb:0x41debdc74bd24ad8!2m2!1d139.784319!2d35.5495351!3e3?entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D',
        quote: '15:34 - 16:00 （26 分） ; 10 分（3 駅乗車） ; 12 分（6 駅乗車）' }),
      gm('shinagawa', 'hnd_t1', ['car'], { from_ja: '品川駅',
        to_ja: '羽田空港 第1ターミナル',
        value: { drive: 19 },
        seen: '2026-10-11T15:28',
        url: 'https://www.google.com/maps/dir/品川駅、〒108-0074+東京都港区高輪３丁目２６−２７/羽田空港第1ターミナル、〒144-0041+東京都大田区３丁目/@35.5967596,139.6734108,12z/am=t/data=!3m1!4b1!4m14!4m13!1m5!1m1!1s0x60188a5a6e148775:0x9a45c347f706db70!2m2!1d139.7387597!2d35.6284713!1m5!1m1!1s0x601863f7525776fb:0x41debdc74bd24ad8!2m2!1d139.784319!2d35.5495351!3e3?entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D',
        quote: '運転 19 分' }),
      gm('shinagawa', 'hnd_t2s', ['train'], { from_ja: '品川駅',
        to_ja: '羽田空港第2ターミナル駅',
        line: '京急',
        value: { walk_total: 25 },
        seen: '2026-10-11T15:51',
        url: 'https://www.google.com/maps/dir/品川駅、〒108-0074+東京都港区高輪３丁目２６−２７/羽田空港第2ターミナル駅、〒144-0041+東京都大田区羽田空港３丁目４−２/@35.5967596,139.6736964,12z/data=!3m1!4b1!4m14!4m13!1m5!1m1!1s0x60188a5a6e148775:0x9a45c347f706db70!2m2!1d139.7387597!2d35.6284713!1m5!1m1!1s0x601863f69cf14f7b:0x4ec695ea34e14d41!2m2!1d139.7879961!2d35.5507002!3e3?entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D',
        quote: '公共交通機関 25 分 15:54 - 16:19 ; 徒歩 3 分' }),
      gm('shinagawa', 'hnd_t2s', ['car'], { from_ja: '品川駅',
        to_ja: '羽田空港第2ターミナル駅',
        value: { drive: 17 },
        seen: '2026-10-11T15:51',
        url: 'https://www.google.com/maps/dir/品川駅、〒108-0074+東京都港区高輪３丁目２６−２７/羽田空港第2ターミナル駅、〒144-0041+東京都大田区羽田空港３丁目４−２/@35.5967596,139.6736964,12z/data=!3m1!4b1!4m14!4m13!1m5!1m1!1s0x60188a5a6e148775:0x9a45c347f706db70!2m2!1d139.7387597!2d35.6284713!1m5!1m1!1s0x601863f69cf14f7b:0x4ec695ea34e14d41!2m2!1d139.7879961!2d35.5507002!3e3?entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D',
        quote: '運転 17 分' }),
      gm('shinagawa', 'hnd_t3', ['train'], { from_ja: '品川駅',
        to_ja: '羽田空港 第3ターミナル',
        line: '京急',
        value: { shown_total: 19 },
        seen: '2026-10-11T15:56',
        url: 'https://www.google.com/maps/dir/品川駅、〒108-0074+東京都港区高輪３丁目２６−２７/〒144-0041+東京都大田区羽田空港２丁目６−５+第3ターミナル/@35.5867819,139.7050744,13z/data=!3m1!4b1!4m14!4m13!1m5!1m1!1s0x60188a5a6e148775:0x9a45c347f706db70!2m2!1d139.7387597!2d35.6284713!1m5!1m1!1s0x601861543aa93813:0x72022ae3c2d4eddf!2m2!1d139.7687222!2d35.5454613!3e3?entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D',
        quote: '公共交通機関 19 分 15:54 - 16:13' }),
      gm('shinagawa', 'hnd_t3', ['car'], { from_ja: '品川駅',
        to_ja: '羽田空港 第3ターミナル',
        value: { drive: 24 },
        seen: '2026-10-11T15:56',
        url: 'https://www.google.com/maps/dir/品川駅、〒108-0074+東京都港区高輪３丁目２６−２７/〒144-0041+東京都大田区羽田空港２丁目６−５+第3ターミナル/@35.5867819,139.7050744,13z/data=!3m1!4b1!4m14!4m13!1m5!1m1!1s0x60188a5a6e148775:0x9a45c347f706db70!2m2!1d139.7387597!2d35.6284713!1m5!1m1!1s0x601861543aa93813:0x72022ae3c2d4eddf!2m2!1d139.7687222!2d35.5454613!3e3?entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D',
        quote: '運転 24 分' }),
      gm('toyosu', 'hnd_t1', ['bus'], { from_ja: '豊洲駅',
        to_ja: '羽田空港 第1ターミナル',
        line: 'リムジンバス',
        value: { walk_total: 32 },
        seen: '2026-10-11T15:58',
        url: 'https://www.google.com/maps/dir/豊洲駅、〒135-0061+東京都江東区豊洲２丁目２/羽田空港第1ターミナル、〒144-0041+東京都大田区３丁目/@35.6069539,139.6776488,12z/data=!4m14!4m13!1m5!1m1!1s0x601889a3ae75de69:0x6dd78cf9446d8774!2m2!1d139.7954412!2d35.6537595!1m5!1m1!1s0x601863f7525776fb:0x41debdc74bd24ad8!2m2!1d139.784319!2d35.5495351!3e3?entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D',
        quote: '公共交通機関 32 分 16:11 - 16:43 ; 徒歩 7 分' }),
      gm('toyosu', 'hnd_t1', ['car'], { from_ja: '豊洲駅',
        to_ja: '羽田空港 第1ターミナル',
        value: { drive: 17 },
        seen: '2026-10-11T15:58',
        url: 'https://www.google.com/maps/dir/豊洲駅、〒135-0061+東京都江東区豊洲２丁目２/羽田空港第1ターミナル、〒144-0041+東京都大田区３丁目/@35.6069539,139.6776488,12z/data=!4m14!4m13!1m5!1m1!1s0x601889a3ae75de69:0x6dd78cf9446d8774!2m2!1d139.7954412!2d35.6537595!1m5!1m1!1s0x601863f7525776fb:0x41debdc74bd24ad8!2m2!1d139.784319!2d35.5495351!3e3?entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D',
        quote: '運転 17 分' }),
      gm('toyosu', 'hnd_t2', ['train', 'bus'], { from_ja: '豊洲駅',
        to_ja: '羽田空港 第2ターミナル',
        line: 'ゆりかもめ → リムジンバス羽田空港線',
        value: { walk_total: 31 },
        seen: '2026-10-11T16:13',
        url: 'https://www.google.com/maps/dir/%E8%B1%8A%E6%B4%B2%E9%A7%85%E3%80%81%E3%80%92135-0061+%E6%9D%B1%E4%BA%AC%E9%83%BD%E6%B1%9F%E6%9D%B1%E5%8C%BA%E8%B1%8A%E6%B4%B2%EF%BC%92%E4%B8%81%E7%9B%AE%EF%BC%92/%E3%80%92144-0041+%E6%9D%B1%E4%BA%AC%E9%83%BD%E5%A4%A7%E7%94%B0%E5%8C%BA%E7%BE%BD%E7%94%B0%E7%A9%BA%E6%B8%AF%EF%BC%93%E4%B8%81%E7%9B%AE%EF%BC%94%E2%88%92%EF%BC%92+%E7%BE%BD%E7%94%B0%E7%A9%BA%E6%B8%AF+%E7%AC%AC2%E6%97%85%E5%AE%A2%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB/@35.6069539,139.6776488,12z/data=!3m1!4b1!4m14!4m13!1m5!1m1!1s0x601889a3ae75de69:0x6dd78cf9446d8774!2m2!1d139.7954412!2d35.6537595!1m5!1m1!1s0x601863f448b65a53:0xc07c9fbbc99f5109!2m2!1d139.7885688!2d35.5508616!3e3?entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D',
        quote: '公共交通機関 31 分 ; 16:14 - 16:45 ; ゆりかもめ ; リムジンバス羽田空港線 ; 徒歩 5 分' }),
      gm('toyosu', 'hnd_t2', ['car'], { from_ja: '豊洲駅',
        to_ja: '羽田空港 第2ターミナル',
        value: { drive: 16 },
        seen: '2026-10-11T16:13',
        url: 'https://www.google.com/maps/dir/%E8%B1%8A%E6%B4%B2%E9%A7%85%E3%80%81%E3%80%92135-0061+%E6%9D%B1%E4%BA%AC%E9%83%BD%E6%B1%9F%E6%9D%B1%E5%8C%BA%E8%B1%8A%E6%B4%B2%EF%BC%92%E4%B8%81%E7%9B%AE%EF%BC%92/%E3%80%92144-0041+%E6%9D%B1%E4%BA%AC%E9%83%BD%E5%A4%A7%E7%94%B0%E5%8C%BA%E7%BE%BD%E7%94%B0%E7%A9%BA%E6%B8%AF%EF%BC%93%E4%B8%81%E7%9B%AE%EF%BC%94%E2%88%92%EF%BC%92+%E7%BE%BD%E7%94%B0%E7%A9%BA%E6%B8%AF+%E7%AC%AC2%E6%97%85%E5%AE%A2%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB/@35.6069539,139.6776488,12z/data=!3m1!4b1!4m14!4m13!1m5!1m1!1s0x601889a3ae75de69:0x6dd78cf9446d8774!2m2!1d139.7954412!2d35.6537595!1m5!1m1!1s0x601863f448b65a53:0xc07c9fbbc99f5109!2m2!1d139.7885688!2d35.5508616!3e3?entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D',
        quote: '運転 16 分' }),
      gm('toyosu', 'hnd_t3', ['train', 'bus'], { from_ja: '豊洲駅',
        to_ja: '羽田空港 第3ターミナル',
        line: 'ゆりかもめ → リムジンバス羽田空港線',
        value: { walk_total: 45 },
        seen: '2026-10-11T16:15',
        url: 'https://www.google.com/maps/dir/%E8%B1%8A%E6%B4%B2%E9%A7%85%E3%80%81%E3%80%92135-0061+%E6%9D%B1%E4%BA%AC%E9%83%BD%E6%B1%9F%E6%9D%B1%E5%8C%BA%E8%B1%8A%E6%B4%B2%EF%BC%92%E4%B8%81%E7%9B%AE%EF%BC%92/%E3%80%92144-0041+%E6%9D%B1%E4%BA%AC%E9%83%BD%E5%A4%A7%E7%94%B0%E5%8C%BA%E7%BE%BD%E7%94%B0%E7%A9%BA%E6%B8%AF%EF%BC%92%E4%B8%81%E7%9B%AE%EF%BC%96%E2%88%92%EF%BC%95+%E7%AC%AC3%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB/@35.609764,139.6776488,12z/data=!3m1!4b1!4m14!4m13!1m5!1m1!1s0x601889a3ae75de69:0x6dd78cf9446d8774!2m2!1d139.7954412!2d35.6537595!1m5!1m1!1s0x601861543aa93813:0x72022ae3c2d4eddf!2m2!1d139.7687222!2d35.5454613!3e3?entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D',
        quote: '公共交通機関 45 分 ; 16:30 - 17:15 ; ゆりかもめ ; リムジンバス羽田空港線 ; 徒歩 4 分' }),
      gm('toyosu', 'hnd_t3', ['car'], { from_ja: '豊洲駅',
        to_ja: '羽田空港 第3ターミナル',
        value: { drive: 23 },
        seen: '2026-10-11T16:15',
        url: 'https://www.google.com/maps/dir/%E8%B1%8A%E6%B4%B2%E9%A7%85%E3%80%81%E3%80%92135-0061+%E6%9D%B1%E4%BA%AC%E9%83%BD%E6%B1%9F%E6%9D%B1%E5%8C%BA%E8%B1%8A%E6%B4%B2%EF%BC%92%E4%B8%81%E7%9B%AE%EF%BC%92/%E3%80%92144-0041+%E6%9D%B1%E4%BA%AC%E9%83%BD%E5%A4%A7%E7%94%B0%E5%8C%BA%E7%BE%BD%E7%94%B0%E7%A9%BA%E6%B8%AF%EF%BC%92%E4%B8%81%E7%9B%AE%EF%BC%96%E2%88%92%EF%BC%95+%E7%AC%AC3%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB/@35.609764,139.6776488,12z/data=!3m1!4b1!4m14!4m13!1m5!1m1!1s0x601889a3ae75de69:0x6dd78cf9446d8774!2m2!1d139.7954412!2d35.6537595!1m5!1m1!1s0x601861543aa93813:0x72022ae3c2d4eddf!2m2!1d139.7687222!2d35.5454613!3e3?entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D',
        quote: '運転 23 分' }),
      gm('yokohama', 'hnd_t12s', ['train'], { from_ja: '横浜駅',
        to_ja: '羽田空港第1・第2ターミナル駅',
        line: '京急',
        value: { shown_total: 28 },
        legs: [15, 12],
        seen: '2026-10-11T15:32',
        url: 'https://www.google.com/maps/dir/%E6%A8%AA%E6%B5%9C%E9%A7%85%E3%80%81%E3%80%92220-0011+%E7%A5%9E%E5%A5%88%E5%B7%9D%E7%9C%8C%E6%A8%AA%E6%B5%9C%E5%B8%82%E8%A5%BF%E5%8C%BA%E9%AB%98%E5%B3%B6%EF%BC%92%E4%B8%81%E7%9B%AE/%E7%BE%BD%E7%94%B0%E7%A9%BA%E6%B8%AF%E7%AC%AC%EF%BC%91%E3%83%BB%E7%AC%AC%EF%BC%92%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB%E9%A7%85%E3%80%81%E3%80%92144-0041+%E6%9D%B1%E4%BA%AC%E9%83%BD%E5%A4%A7%E7%94%B0%E5%8C%BA%E7%BE%BD%E7%94%B0%E7%A9%BA%E6%B8%AF%EF%BC%93%E4%B8%81%E7%9B%AE%EF%BC%93%E2%88%92%EF%BC%94/@35.5467452,139.5395112,11z/am=t/data=!3m1!4b1!4m14!4m13!1m5!1m1!1s0x60185c0df6cfd2f1:0xbbbca6f36b5235f5!2m2!1d139.622062!2d35.4659811!1m5!1m1!1s0x601863f6ef952c63:0x2b7266cf7b50f5b!2m2!1d139.786427!2d35.5499709!3e3?hl=ja&entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D',
        quote: '15:38 - 16:06 （28 分） ; 15 分（5 駅乗車） ; 直通 ; 12 分（6 駅乗車）' }),
      gm('yokohama', 'hnd_t3', ['train'], { from_ja: '横浜駅',
        to_ja: '羽田空港 第3ターミナル',
        line: '京急本線',
        value: { shown_total: 24 },
        seen: '2026-10-11T15:53',
        url: 'https://www.google.com/maps/dir/%E6%A8%AA%E6%B5%9C%E9%A7%85%E3%80%81%E3%80%92220-0011+%E7%A5%9E%E5%A5%88%E5%B7%9D%E7%9C%8C%E6%A8%AA%E6%B5%9C%E5%B8%82%E8%A5%BF%E5%8C%BA%E9%AB%98%E5%B3%B6%EF%BC%92%E4%B8%81%E7%9B%AE/%E3%80%92144-0041+%E6%9D%B1%E4%BA%AC%E9%83%BD%E5%A4%A7%E7%94%B0%E5%8C%BA%E7%BE%BD%E7%94%B0%E7%A9%BA%E6%B8%AF%EF%BC%92%E4%B8%81%E7%9B%AE%EF%BC%96%E2%88%92%EF%BC%95+%E7%AC%AC3%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB/@35.5139032,139.612991,12z/data=!3m1!4b1!4m14!4m13!1m5!1m1!1s0x60185c0df6cfd2f1:0xbbbca6f36b5235f5!2m2!1d139.622062!2d35.4659811!1m5!1m1!1s0x601861543aa93813:0x72022ae3c2d4eddf!2m2!1d139.7687222!2d35.5454613!3e3?hl=ja&entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D',
        quote: '24 分 ; 15:58 - 16:22 ; 京急本線' }),
      gm('yokohama', 'hnd_t1', ['car'], { from_ja: '横浜駅',
        to_ja: '羽田空港 第1ターミナル',
        value: { drive: 22 },
        seen: '2026-10-11T15:58',
        url: 'https://www.google.com/maps/dir/%E6%A8%AA%E6%B5%9C%E9%A7%85%E3%80%81%E3%80%92220-0011+%E7%A5%9E%E5%A5%88%E5%B7%9D%E7%9C%8C%E6%A8%AA%E6%B5%9C%E5%B8%82%E8%A5%BF%E5%8C%BA%E9%AB%98%E5%B3%B6%EF%BC%92%E4%B8%81%E7%9B%AE/%E7%BE%BD%E7%94%B0%E7%A9%BA%E6%B8%AF%E7%AC%AC1%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB%E3%80%81%E3%80%92144-0041+%E6%9D%B1%E4%BA%AC%E9%83%BD%E5%A4%A7%E7%94%B0%E5%8C%BA%EF%BC%93%E4%B8%81%E7%9B%AE/@35.4933951,139.5407795,11z/data=!3m1!4b1!4m14!4m13!1m5!1m1!1s0x60185c0df6cfd2f1:0xbbbca6f36b5235f5!2m2!1d139.622062!2d35.4659811!1m5!1m1!1s0x601863f7525776fb:0x41debdc74bd24ad8!2m2!1d139.784319!2d35.5495351!3e0?hl=ja&entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D',
        quote: '22 分 ; 25.5 km ; 最速ルート（通常の交通量）' }),
      gm('yokohama', 'hnd_t2', ['car'], { from_ja: '横浜駅',
        to_ja: '羽田空港 第2ターミナル',
        value: { drive: 24 },
        seen: '2026-10-11T16:01',
        url: 'https://www.google.com/maps/dir/%E6%A8%AA%E6%B5%9C%E9%A7%85%E3%80%81%E3%80%92220-0011+%E7%A5%9E%E5%A5%88%E5%B7%9D%E7%9C%8C%E6%A8%AA%E6%B5%9C%E5%B8%82%E8%A5%BF%E5%8C%BA%E9%AB%98%E5%B3%B6%EF%BC%92%E4%B8%81%E7%9B%AE/%E3%80%92144-0041+%E6%9D%B1%E4%BA%AC%E9%83%BD%E5%A4%A7%E7%94%B0%E5%8C%BA%E7%BE%BD%E7%94%B0%E7%A9%BA%E6%B8%AF%EF%BC%93%E4%B8%81%E7%9B%AE%EF%BC%94%E2%88%92%EF%BC%92+%E7%BE%BD%E7%94%B0%E7%A9%BA%E6%B8%AF+%E7%AC%AC2%E6%97%85%E5%AE%A2%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB/@35.4964756,139.5407795,11z/data=!3m1!4b1!4m14!4m13!1m5!1m1!1s0x60185c0df6cfd2f1:0xbbbca6f36b5235f5!2m2!1d139.622062!2d35.4659811!1m5!1m1!1s0x601863f448b65a53:0xc07c9fbbc99f5109!2m2!1d139.7885688!2d35.5508616!3e0?hl=ja&entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D',
        quote: '24 分 ; 26.9 km ; 最速ルート（通常の交通量）' }),
      gm('yokohama', 'hnd_t3', ['car'], { from_ja: '横浜駅',
        to_ja: '羽田空港 第3ターミナル',
        value: { drive: 28 },
        seen: '2026-10-11T16:03',
        url: 'https://www.google.com/maps/dir/%E6%A8%AA%E6%B5%9C%E9%A7%85%E3%80%81%E3%80%92220-0011+%E7%A5%9E%E5%A5%88%E5%B7%9D%E7%9C%8C%E6%A8%AA%E6%B5%9C%E5%B8%82%E8%A5%BF%E5%8C%BA%E9%AB%98%E5%B3%B6%EF%BC%92%E4%B8%81%E7%9B%AE/%E3%80%92144-0041+%E6%9D%B1%E4%BA%AC%E9%83%BD%E5%A4%A7%E7%94%B0%E5%8C%BA%E7%BE%BD%E7%94%B0%E7%A9%BA%E6%B8%AF%EF%BC%92%E4%B8%81%E7%9B%AE%EF%BC%96%E2%88%92%EF%BC%95+%E7%AC%AC3%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB/@35.494533,139.5407795,11z/data=!3m1!4b1!4m14!4m13!1m5!1m1!1s0x60185c0df6cfd2f1:0xbbbca6f36b5235f5!2m2!1d139.622062!2d35.4659811!1m5!1m1!1s0x601861543aa93813:0x72022ae3c2d4eddf!2m2!1d139.7687222!2d35.5454613!3e0?hl=ja&entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D',
        quote: '28 分 ; 27.7 km ; 現時点の最速ルート（首都高速神奈川1号横羽線上、事故を回避）' }),
      /* 運営会社の運賃（2026-10-15 に運賃表を開いて読んだ）。行の名前は、運賃表のとおり駅まで。 */
      { key: 'hnd_keikyu_fare_shinagawa_t12', town: 'shinagawa', iata: 'HND', mode: 'train', ja: '京急：品川駅 → 羽田空港第1・第2ターミナル駅',
        value: 330, cur: 'JPY',
        at: '2026-10', at_ja: OPENED, as_of: D_PICK, src: S.keikyuFareShinagawa,
        cond_ja: 'おとな・片道・きっぷの運賃（IC カードは¥327）',
        quote: '羽田空港第1・ 第2ターミナル 14.5 330 327 12,790 36,460 69,080 4,040 11,520 21,820' },
      { key: 'hnd_keikyu_fare_shinagawa_t3', town: 'shinagawa', iata: 'HND', mode: 'train', ja: '京急：品川駅 → 羽田空港第3ターミナル駅',
        value: 330, cur: 'JPY',
        at: '2026-10', at_ja: OPENED, as_of: D_PICK, src: S.keikyuFareShinagawa,
        cond_ja: 'おとな・片道・きっぷの運賃（IC カードは¥327）',
        quote: '羽田空港 第3ターミナル 12.5 330 327 12,110 34,520 65,410 3,810 10,860 20,580' },
      { key: 'hnd_limousine_fare_toyosu', town: 'toyosu', iata: 'HND', mode: 'bus', ja: 'リムジンバス：豊洲駅 → 羽田空港',
        value: 1000, cur: 'JPY',
        at: '2026-10', at_ja: OPENED, as_of: D_PICK, src: S.limousineOdaiba,
        cond_ja: 'おとな・片道・1人。豊洲駅から羽田空港までの直通バスの運賃で、ゆりかもめと乗り継ぐ経路の合計ではない',
        quote: '運賃（1名） 大人 1,000円' },
      { key: 'hnd_keikyu_fare_yokohama_t12', town: 'yokohama', iata: 'HND', mode: 'train', ja: '京急：横浜駅 → 羽田空港第1・第2ターミナル駅',
        value: 400, cur: 'JPY',
        at: '2026-10', at_ja: OPENED, as_of: D_PICK, src: S.keikyuFareYokohama,
        cond_ja: 'おとな・片道・きっぷの運賃（IC カードは¥397）',
        quote: '羽田空港第1・ 第2ターミナル 20.7 400 397 14,680 41,850 79,280 4,620 13,170 24,950' },
      { key: 'hnd_keikyu_fare_yokohama_t3', town: 'yokohama', iata: 'HND', mode: 'train', ja: '京急：横浜駅 → 羽田空港第3ターミナル駅',
        value: 370, cur: 'JPY',
        at: '2026-10', at_ja: OPENED, as_of: D_PICK, src: S.keikyuFareYokohama,
        cond_ja: 'おとな・片道・きっぷの運賃（IC カードは¥363）',
        quote: '羽田空港 第3ターミナル 18.7 370 363 14,060 40,080 75,940 4,440 12,660 23,980' },
      /* 運営会社が案内している時間（品川は Google の行が在るので「出典」だけ）と、街の鍵の無い行（「出典」だけ）。 */
      { key: 'hnd_keikyu_shinagawa', town: 'shinagawa', iata: 'HND', mode: 'train', ja: '京急：品川駅 ⇄ 羽田空港',
        value: { t3: 11, t12: 14 }, unit: '分',
        at: '2026-10', at_ja: OPENED, as_of: D4, src: S.keikyu,
        cond_ja: '京急が示す目安。1つ目が第3ターミナル駅・2つ目が第1・第2ターミナル駅。列車の種別と時間帯は書いていない',
        quote: 'Shinagawa Station 11 minutes 14 minutes' },
      { key: 'hnd_to_stations', iata: 'HND', mode: 'train', ja: '羽田空港から主な駅まで（電車・モノレール）',
        value: '品川駅 約15分・浜松町駅 約20分・東京駅 約30分',
        at: '2026-10', at_ja: OPENED, as_of: D4, src: S.hndTerminal,
        cond_ja: '目安の時間。どのターミナルから・どの路線か・乗り換えの時間を含むかは表に書いていない',
        quote: '東京駅 約30分 浜松町駅 約20分 品川駅 約15分' },
      { key: 'hnd_monorail_fare', iata: 'HND', mode: 'train', ja: '東京モノレール：浜松町駅 → 羽田空港の各ターミナル駅',
        value: 520, cur: 'JPY',
        at: '2026-10', at_ja: OPENED, as_of: D4, src: S.monorail,
        cond_ja: 'おとな・片道・きっぷの運賃（IC カードは¥519）。浜松町駅から。所要時間はこの表に無い',
        quote: '天空橋 羽田空港第3ターミナル 新整備場 羽田空港第1ターミナル 羽田空港第2ターミナル おとな 460 520 520 520 520' },
      { key: 'nrt_skyliner_time', iata: 'NRT', mode: 'train', ja: '京成スカイライナー：日暮里駅 → 空港第2ビル駅',
        value: 36, unit: '分',
        at: '2026-10', at_ja: OPENED, as_of: D4, src: S.skyliner,
        cond_ja: '最短の時間（いつもこの時間という意味ではない）。日暮里駅から空港第2ビル駅まで',
        quote: '成田スカイアクセス線を経由し、在来線最速の時速160㎞で走行することで、日暮里駅から空港第2ビル駅までを最短36分(※1)で結びます。' },
      { key: 'nrt_skyliner_fare', iata: 'NRT', mode: 'train', ja: '京成スカイライナー：京成上野・日暮里 〜 空港第2ビル・成田空港',
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
    airports: [['HKG', '香港国際空港']], ends: {}, site: 'hse', stat: 'range',
    bars: [], words: {}, refs: [],
    rents: [
      hse('caribbean_coast', '東涌（Caribbean Coast）', '空港のとなりの新市街（東涌）。28Hse の東涌の団地一覧でいちばん上に出る団地',
        S.hseCaribbean, { bed2: [15800, 18500], bed3: [18000, 28000] },
        '2 Bedrooms ( 51 ) $15,800 - $18,500/month 3 Bedrooms ( 61 ) $18,000 - $28,000/month', { lead: true, iata: 'HKG' }),
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
      { key: 'hkg_ael_time', iata: 'HKG', mode: 'train', ja: 'エアポート・エクスプレス：空港駅 ⇄ 香港駅',
        value: 24, unit: '分',
        at: '2025-09', as_of: D5, src: S.tlbRail, lead: true,
        cond_ja: '平均でおよその時間。駅から駅まで',
        quote: 'An average journey between the Airport Station and the Hong Kong Station takes about 24 minutes.' },
      { key: 'hkg_ael_fare', iata: 'HKG', mode: 'train', ja: 'エアポート・エクスプレス：香港駅 ⇄ 空港',
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
    airports: [['TPE', '桃園国際空港']], ends: {}, site: 'r591', stat: 'median',
    bars: ['bed1', 'bed2', 'bed3'], words: { bed1: '1房', bed2: '2房', bed3: '3房' }, refs: [],
    rents: [
      r591('taoyuan', '桃園市', '桃園国際空港がある市', S.r591Taoyuan, [9500, 16000, 22000, 25000],
        '獨立套房 9,500 元/月 比去年 +5.6% 1房 16,000 元/月 比去年 +4.2% 2房 22,000 元/月 比去年 持平 3房 25,000 元/月 比去年 持平', { lead: true, iata: 'TPE' }),
      r591('dayuan', '桃園市 大園區', '空港の駅（A12 機場第一航廈）の住所がある区', S.r591Dayuan, [9000, 18250, 22500, 24800],
        '獨立套房 9,000 元/月 比去年 -5.3% 1房 18,250 元/月 比去年 +7.4% 2房 22,500 元/月 比去年 +12.5% 3房 24,800 元/月 比去年 -0.8%', { iata: 'TPE' }),
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
      { key: 'tpe_mrt_express_time', iata: 'TPE', mode: 'train', ja: '桃園機場捷運（直達車）：台北車站 → 空港',
        value: { t1: 35, t2: 39 }, unit: '分',
        at: '2026-10', at_ja: OPENED, as_of: D4, src: S.tycgMrt, lead: true,
        cond_ja: '直達車の、駅から駅までの時間。1つ目が第1ターミナル駅・2つ目が第2ターミナル駅。待ち時間は含まない',
        quote: 'From Taipei Main Station to Taiwan Taoyuan International Airport Terminal 1 Station, it only takes 35 minutes by Express Train, and takes 39 minutes to Terminal 2 Station.' },
      { key: 'tpe_mrt_commuter_time', iata: 'TPE', mode: 'train', ja: '桃園機場捷運（普通車）：台北車站 → 空港 第1ターミナル駅',
        value: 49, unit: '分',
        at: '2026-10', at_ja: OPENED, as_of: D4, src: S.tycgMrt,
        cond_ja: '各駅停車の、駅から駅までの時間。待ち時間は含まない',
        quote: 'Frequency Every 15 minutes Duration from A1~A12 takes 49 minutes and from A1~A21 takes 82 minutes' },
      { key: 'tpe_mrt_fare', iata: 'TPE', mode: 'train', ja: '桃園機場捷運：台北車站 〜 空港の駅',
        value: 160, cur: 'TWD',
        at: '2026-10', at_ja: OPENED, as_of: D4, src: S.tymFare,
        cond_ja: '片道・1人。運賃表は駅の組ごとに数字が1つあるだけで、通貨の字も、直達車と普通車の区別も無い。第2ターミナル駅も同じ額',
        quote: '160 140 115 115 115 80 60 60 60 25 25' },
    ],
  },
};

/* アブダビ。家賃の行は career-facts.mjs のまま（ここへ写さない）。ここに在るのは、空港までの移動と、棒にする間取りだけ。
   街の鍵は career-facts.mjs の rents の key。bars・words は読み口（pv-airline-view.mjs）がここから読む。 */
export const ABUDHABI = { airports: [['AUH', 'ザーイド国際空港']], ends: {}, site: 'bayut', stat: 'mean',
  bars: ['bed1', 'bed2'], words: { bed1: '1-Bed', bed2: '2-Bed' }, commute: [] };

/* ════════════ 読むための関数 ════════════ */

/** その街の全項目を [在りか, 項目, 種類] で順に返す（検査と --list が同じ並びを歩く）。
    団地ごとの家賃（estates）は、その街の行のすぐあとに 'estate' として。refs の組の行は 'ref'・前提は 'ref_basis'（組ごとに別の種類）。 */
export function* allItems(city) {
  const c = city === 'abudhabi' ? ABUDHABI : LIVING[city];
  if (!c) return;
  for (const k of ['rents', 'rent_basis', 'commute'])
    for (const [i, x] of (c[k] || []).entries()) {
      yield [`${k}[${i}]`, x, k];
      if (k === 'rents') for (const [j, e] of (x.estates || []).entries()) yield [`rents[${i}].estates[${j}]`, e, 'estate'];
    }
  for (const [j, g] of (c.refs || []).entries()) {
    for (const [i, x] of (g.rows || []).entries()) yield [`refs[${j}].rows[${i}]`, x, 'ref'];
    for (const [i, x] of (g.rent_basis || []).entries()) yield [`refs[${j}].rent_basis[${i}]`, x, 'ref_basis'];
  }
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
/* 分の数字が引用に在るか。60分からは、表示の形（1 時間 15 分）でもよい。 */
const minInQuote = (q, n) => { const s = q.replace(/\s+/g, ''); return s.includes(`${n}分`) || (n >= 60 && s.includes(`${Math.floor(n / 60)}時間${n % 60}分`)); };
/* 額が引用の中でどう書かれているか（街の出どころの書き方） */
const inQuote = (x, v) => {
  const q = x.quote;
  if (x.via === 'gmaps') return minInQuote(q, v);            // 分の数字は、表示の字のまま引用に在る
  if (x.print) return Object.values(x.print).some(s => man4(s) === v && q.includes(s));     // 額は、ページの字のまま引用に在る
  if (x.cur === 'JPY' && x.src.kind === 'portal') return q.includes((v / 10000).toFixed(1) + '万円');
  return q.includes(v.toLocaleString('en-US')) || q.includes(String(v));
};

/* 街の行に書かない字（R9）。人気・順位の言葉と、職位の字（check-salary.mjs は 社名 → 職位 → 額 と読む）。 */
const RANK_WORDS = /人気|多く住|おすすめ|ランキング|機長|副操縦士/;
/* 1つの棒の組の中で、行ごとに同じでなければならない6つ（R6）。 */
const ONE_MEASURE = ['cur', 'per', 'at', 'at_ja', 'as_of', 'cond_ja'];
/* 名前の検査に使う名前（R7）。rent_area_ja が在ればそれ、無ければ ja の末尾の（…）を外したもの（「成田市（千葉県）」→「成田市」）。 */
const nameOf = x => x.rent_area_ja || String(x.ja || '').replace(/（[^（）]*）$/, '');

export function check() {
  const bad = [];
  const fail = (where, msg) => bad.push(`${where}: ${msg}`);
  let n = 0;

  for (const [slug, city] of Object.entries(CITY_OF)) if (!LIVING[city]) fail(`CITY_OF.${slug}`, `街が無い（${city}）`);
  if ('etihad' in CITY_OF) fail('CITY_OF', 'エティハドは career-facts.mjs（ここに足さない）');

  /* R7: LEGACY_… の鍵は、まだ街の行（rents）か refs の行に在るものだけ（行が出たら、ここからも消す）。 */
  const carried = new Set(Object.values(LIVING).flatMap(c => [...(c.rents || []), ...(c.refs || []).flatMap(g => g.rows || [])]).map(x => x.key));
  for (const [name, set] of [['LEGACY_NAME', LEGACY_NAME], ['LEGACY_PICK', LEGACY_PICK]])
    for (const k of set) if (!carried.has(k)) fail(name, `LEGACY_… に、台帳に無い鍵が残っている（${k}）`);

  /* own ＝ 家賃の行をこの台帳が持つ街。アブダビ（家賃は career-facts.mjs）は、家賃の街の決まり（R2〜R11・R15・R18）と
     「lead が1つ・前提の行が在る」を飛ばし、R1 と R12〜R14 と項目ごとの決まりを、空港までの移動の行に当てる。 */
  const CITIES = [...Object.entries(LIVING).map(([k, c]) => [k, c, (c.rents || []).map(r => r.key), true]),
                  ['abudhabi', ABUDHABI, EYF.etihad.living.rents.map(r => r.key), false]];
  for (const [city, c, T, own] of CITIES) {
    const towns = new Set(T);

    /* R1 空港と、経路が着く場所 */
    const air = Array.isArray(c.airports) ? c.airports : [];
    if (!air.length || !air.every(a => Array.isArray(a) && a.length === 2 && /^[A-Z]{3}$/.test(String(a[0])) && String(a[1] || '').trim()))
      fail(`${city}.airports`, 'airports が無い（[空港の3字, 名前] の並び）');
    const IATA = new Set(air.map(a => a && a[0]));
    const ends = c.ends && typeof c.ends === 'object' && !Array.isArray(c.ends) ? c.ends : null;
    if (!ends) fail(`${city}.ends`, '着く場所（ends）の iata・名前・種類のどれかが違う');
    for (const [k, e] of Object.entries(ends || {}))
      if (!e || !IATA.has(e.iata) || !String(e.ja || '').trim() || !END_KINDS.includes(e.kind) || !k.startsWith(String(e.iata).toLowerCase()))
        fail(`${city}.ends.${k}`, '着く場所（ends）の iata・名前・種類のどれかが違う');

    const cols = new Set((c.cols || []).map(([k]) => k));
    const site = c.site;
    const rentQuotes = [...(c.rents || []), ...(c.rents || []).flatMap(r => r.estates || []), ...(c.rent_basis || [])].map(x => x.quote || '');
    const basisQuotes = (c.rent_basis || []).map(x => x.quote || '');
    if (own) {
      if (!c.city_ja || !c.country_ja || (site !== null && !c.measure_ja)) fail(city, 'city_ja / country_ja / measure_ja が無い');
      /* R2 */
      if (!(site === null || Object.hasOwn(SITES, site)) || c.stat !== (site ? SITES[site].stat : null)) fail(city, 'site / stat が、出どころの表（SITES）と合わない');
      const bars = Array.isArray(c.bars) ? c.bars : [];
      /* 額を持つ行 ＝ 自分の額を持つ街の行と、すべての団地の行（1つの都市で、1つの物差し）。 */
      const priced = [...(c.rents || []).filter(r => !r.estates && r.value !== undefined), ...(c.rents || []).flatMap(r => r.estates || [])];
      if (site !== null) {
        /* R4: 今までの決まり（物差し・列・先頭の列・前提の行）＋ 棒の列 */
        if (!cols.size) fail(city, 'cols が無い');
        if (!cols.has(c.lead_col)) fail(city, `lead_col（${c.lead_col}）が cols に無い`);
        if (!(c.rent_basis || []).length) fail(`${city}.rent_basis`, '何の額かの行が無い');
        const said = c.words_src || c.words || {};
        for (const k of bars) {
          if (!cols.has(k)) fail(`${city}.bars`, `棒の列（${k}）が cols に無い`);
          if (!String((c.words || {})[k] || '').trim() || !String(said[k] || '').trim() || !rentQuotes.some(q => q.includes(said[k])))
            fail(`${city}.words.${k}`, '棒の列の、出どころの呼び名（words）が、どの引用にも無い');
        }
        if (bars.length && !bars.includes(c.lead_col)) fail(`${city}.bars`, `先頭の列（${c.lead_col}）が、棒の列に無い`);
        if (bars.length && !BAR_STATS.includes(c.stat)) fail(`${city}.bars`, '幅の数字は棒にしない');
        /* R6 1つの物差し: 置き場は site の1つ・6つの字は全部の行で同じ */
        const host = SITES[site] && SITES[site].host;
        for (const r of priced)
          if (!host || !host.test(String((r.src || {}).url || ''))) fail(`${city}.rents.${r.key}`, '出どころの URL が、この街の棒の組の出どころ（site）の置き場に無い（物差しを混ぜない）');
        if (priced.some(r => ONE_MEASURE.some(f => r[f] !== priced[0][f])))
          fail(`${city}.rents`, '条件・時点・確かめた日・通貨・単位が行ごとに違う（1つの棒の組は、1つの出どころ・1つの条件・1つの日付）');
        /* R8・R8b 数字の種類の言葉 */
        const measure = String(c.measure_ja || '');
        if (/平均/.test(measure) && !['mean', 'calc_mean'].includes(c.stat)) fail(city, '物差しの名前に「平均」と書けるのは、出どころが平均と言っている数字だけ');
        if (c.stat === 'mean' && !basisQuotes.some(q => /平均|[Aa]verage|Avg/.test(q))) fail(city, '物差しの名前に「平均」と書けるのは、出どころが平均と言っている数字だけ');
        if (/中央値/.test(measure) && c.stat !== 'median') fail(city, '物差しの名前に「中央値」と書けるのは、出どころが中央値と言っている数字だけ');
        if (c.stat === 'median' && !basisQuotes.some(q => /中位數|[Mm]edian/.test(q))) fail(city, '物差しの名前に「中央値」と書けるのは、出どころが中央値と言っている数字だけ');
        if (c.stat === 'calc_mean' && !measure.includes('当サイトが計算')) fail(city, '当サイトが計算した平均は、物差しの名前に「当サイトが計算」と書く');
        /* R18 棒の横の条件 */
        if (c.beside_ja !== undefined) {
          const b = String(c.beside_ja);
          if (!b.trim() || [...b].length > 40) fail(`${city}.beside_ja`, '棒の横の条件（beside_ja）は、空でなく40字まで');
          if ([...b.matchAll(/「([^「」]*)」/g)].some(m => !basisQuotes.some(q => q.includes(m[1])))) fail(`${city}.beside_ja`, '棒の横の条件（beside_ja）のかぎかっこの字が、前提の引用に無い');
        }
      } else {
        /* R3 出どころの無い街 */
        if (c.measure_ja != null || cols.size || bars.length || c.lead_col != null || (c.rent_basis || []).length || c.beside_ja !== undefined || priced.length)
          fail(city, '出どころの無い街に、家賃の列・物差し・前提・額が残っている');
      }
      /* R15 参考の表（refs）: 組ごとに1つの物差し。名前は R7（項目ごとの検査）、列は組の cols。 */
      for (const [j, g] of (c.refs || []).entries()) {
        const at = `${city}.refs[${j}]`;
        if (!g || !g.key || !g.ja || !g.measure_ja || !Array.isArray(g.cols) || !g.cols.length || !Object.hasOwn(SITES, g.site) || !Array.isArray(g.rows) || !Array.isArray(g.rent_basis)) {
          fail(at, 'refs の組に、key・ja・measure_ja・cols・site・rows・rent_basis のどれかが無い');
          continue;
        }
        for (const r of g.rows) {
          if (towns.has(r.key)) fail(`${at}.rows.${r.key}`, 'refs の行の鍵が、街の鍵と重なっている');
          if (!SITES[g.site].host.test(String((r.src || {}).url || ''))) fail(`${at}.rows.${r.key}`, '出どころの URL が、この街の棒の組の出どころ（site）の置き場に無い（物差しを混ぜない）');
        }
        if (g.rows.some(r => ONE_MEASURE.some(f => r[f] !== g.rows[0][f])))
          fail(`${at}.rows`, '条件・時点・確かめた日・通貨・単位が行ごとに違う（1つの棒の組は、1つの出どころ・1つの条件・1つの日付）');
      }
    }

    /* R10（家賃）と、今までの「移動の lead が1つ」（by_town の都市は R14）。アブダビは飛ばす。 */
    for (const g of own ? ['rents', ...(c.by_town === true ? [] : ['commute'])] : []) {
      const k = (c[g] || []).filter(x => x.lead).length;
      if (k !== 1) fail(`${city}.${g}`, `最初の1画面に出す1行（lead）が ${k} 個（1つだけ）`);
    }
    /* R14 カードに出す手段の組 */
    if (c.by_town !== undefined && c.by_town !== true) fail(city, 'by_town は true だけ');
    if (c.by_town === true) {
      if (!['transit', 'car'].includes(c.card_family)) fail(city, 'カードに出す手段の組（card_family）が無い');
      if ((c.commute || []).some(x => x.lead)) fail(`${city}.commute`, 'by_town の都市では、移動の行に lead を付けない');
    } else if (c.card_family !== undefined) fail(city, 'カードに出す手段の組（card_family）は、by_town の都市だけ');

    /* R12・R13・R13c 空港までの移動の行 */
    const startOf = new Map();
    for (const [i, x] of (c.commute || []).entries()) {
      const where = `${city}.commute[${i}]`;
      if (x.town !== undefined && !towns.has(x.town)) fail(where, '街（town）が、この都市の街の鍵に無い');
      if (x.town !== undefined && c.by_town !== true) fail(where, '街の鍵を持つ行は、by_town の都市だけ');
      if (x.via !== undefined && !VIAS.includes(x.via)) fail(where, `出どころの形（via）が ${VIAS.join('・')} のどれでもない`);
      if (!IATA.has(x.iata)) fail(where, '空港（iata）が、この都市の airports に無い');
      if (x.via !== 'gmaps') continue;
      const e = (ends || {})[x.end];
      const url = String((x.src || {}).url || '');
      if ((x.src || {}).kind !== 'maps' || !x.town || !e || !String(x.from_ja || '').trim() || x.depart !== 'now'
          || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(String(x.seen || '')) || !/^https:\/\//.test(url))
        fail(where, 'Google マップの行に、出発地・着く場所・「すぐに出発」・見た日時・経路の住所のどれかが無い');
      if (e && (x.to_ja !== e.ja || x.iata !== e.iata)) fail(where, '着く場所の名前が、ends の名前と違う（駅を、ターミナルの建物と書かない）');
      const modes = Array.isArray(x.modes) ? x.modes : [];
      const fam = new Set(modes.map(m => FAMILY[m]));
      if (!modes.length || !modes.every(m => ['train', 'bus', 'car'].includes(m)) || x.mode !== modes[0] || fam.size !== 1)
        fail(where, '乗りもの（modes）は train・bus・car の並びで、1つめが mode・全部が同じ組（FAMILY）');
      const ks = Object.keys(x.value && typeof x.value === 'object' ? x.value : {});
      const total = ks.length === 1 ? x.value[ks[0]] : undefined;
      if (ks.length !== 1 || !TIME_KINDS.includes(ks[0]) || !(Number.isInteger(total) && total > 0))
        fail(where, '時間の種類は1つだけ（walk_total・shown_total・drive）。足した数・引いた数を入れない');
      const car = fam.has('car');
      if (ks.length === 1 && (ks[0] === 'drive') !== car) fail(where, '運転の時間（drive）は車の行だけ・車の行は drive だけ');
      if (x.ride !== undefined && (!(Number.isInteger(x.ride) && x.ride > 0 && Number.isInteger(total) && x.ride <= total) || x.legs !== undefined || car))
        fail(where, '乗車の分（ride）は、合計より大きくない正の整数で、legs と並べず、車の行に付けない');
      if (x.legs !== undefined && !(Array.isArray(x.legs) && x.legs.length >= 2 && x.legs.every(v => Number.isInteger(v) && v > 0)))
        fail(where, '区間の分（legs）は、2つ以上の正の整数');
      for (const v of [total, x.ride, ...(Array.isArray(x.legs) ? x.legs : [])])
        if (Number.isInteger(v) && v > 0 && !minInQuote(String(x.quote || ''), v)) fail(where, `乗車・区間の分の数字（${v}）が引用に無い`);
      if (x.warn !== undefined && (!String(x.warn).trim() || !String(x.quote || '').includes(x.warn))) fail(where, '注意の字（warn）が引用に無い');
      if (x.unit !== '分') fail(where, "Google マップの行の unit は '分'");
      if (x.town) {
        if (!startOf.has(x.town)) startOf.set(x.town, x.from_ja);
        else if (startOf.get(x.town) !== x.from_ja) fail(where, '同じ街の行の出発地が、行ごとに違う');
      }
    }

    /* ── 項目ごと ── */
    const seen = {};
    const townJa = new Set();
    const estKeys = new Set();
    /* 鍵の重なりは、種類と置き場ごと（rents・rent_basis・commute・refs の組ごとの行と前提・街ごとの団地）。 */
    const keyed = (where, x, bucket) => {
      if (!x.key || !x.ja) fail(where, 'key か ja が無い');
      seen[bucket] = seen[bucket] || new Set();
      if (seen[bucket].has(x.key)) fail(where, `key が重なっている（${x.key}）`);
      seen[bucket].add(x.key);
    };
    /* 名前が引用に在る（R7）。LEGACY_NAME の鍵は飛ばす。name_quote は同じページの2つめの字（見出し）。継ぎはぎの引用は書かない。 */
    const named = (where, x) => {
      if (x.name_quote !== undefined && (!x.name_quote || x.name_quote !== squash(x.name_quote))) fail(where, '見出しの引用（name_quote）が空・空白がそろっていない');
      if (LEGACY_NAME.has(x.key)) return;
      const name = nameOf(x);
      if (!name || !(String(x.quote || '').includes(name) || String(x.name_quote || '').includes(name)))
        fail(where, `街の名前（${name}）が引用に無い（別の地域の数字に、名前だけ付けていないか）`);
    };
    /* 街の行の決まり（R1b・R9）。額の有る行・額の無い行・団地を持つ行のどれも。 */
    const townRules = (where, x) => {
      if (!/^[a-z_]+$/.test(String(x.key || ''))) fail(where, `街の鍵（${x.key}）は英小文字と _ だけ`);
      if (townJa.has(x.ja)) fail(where, '街の名前が重なっている');
      townJa.add(x.ja);
      /* 名前に（…）を許すのは、今までの街の行（LEGACY_PICK）だけ。 */
      if (!LEGACY_PICK.has(x.key) && /（[^（）]*）/.test(String(x.ja || ''))) fail(where, '街の名前に（…）を付けない');
      if (!String(x.pick_ja || '').trim()) fail(where, 'その地区を選んだ理由（pick_ja）が無い');
      else if (!LEGACY_PICK.has(x.key)) {
        const p = x.pick_src;
        if (!p || !p.name || !SRC_KINDS[p.kind] || !HOSTS[p.kind].some(re => re.test(String(p.url || '')))
            || !x.pick_quote || x.pick_quote !== squash(x.pick_quote) || !ISO.test(String(x.pick_as_of || '')))
          fail(where, '選んだ理由（pick_ja）に、出どころ・引用・確かめた日が無い');
      }
      if ([x.ja, x.sub_ja, x.pick_ja].some(t => RANK_WORDS.test(String(t || '')))) fail(where, '街の行に、人気・順位の言葉や 機長・副操縦士 の字を書かない');
    };
    const iataRule = (where, x) => {
      /* 空港の街だと言えるのは、選んだ理由にそう書いてある行だけ（iata を足すなら pick_ja に「空港」の字が要る）。 */
      if (x.iata !== undefined && !(/^[A-Z]{3}$/.test(String(x.iata)) && /空港/.test(String(x.pick_ja)))) fail(where, '空港（iata）を付けるなら、英大文字3字で、選んだ理由に「空港」と書く');
    };
    /* 家賃の額が無い街の行。出どころの在る都市では落ちる（当サイトが計算する都市だけ、5件にそろわない街を許す）。 */
    const noRent = (where, x, bucket) => {
      keyed(where, x, bucket);
      townRules(where, x);
      if (c.site !== null && c.stat !== 'calc_mean') fail(where, '家賃の額が無い（出どころの在る都市では、街の行に額が要る）');
      if (x.lead && c.site !== null) fail(where, `最初の1画面に出す行に、出す列（${c.lead_col}）が無い`);
    };
    /* 団地ごとの家賃を持つ街の行（R19）。出どころ・日付・引用・額の決まりは、団地の行（'estate'）が受ける。 */
    const estateTown = (where, x, bucket) => {
      keyed(where, x, bucket);
      townRules(where, x);
      iataRule(where, x);
      if (x.value !== undefined || x.src !== undefined || x.quote !== undefined || x.cur !== undefined)
        fail(where, '団地ごとの家賃（estates）を持つ街の行に、自分の額・出どころ・引用・通貨を置かない');
      const es = Array.isArray(x.estates) ? x.estates : [];
      if (!es.length) fail(where, '団地ごとの家賃（estates）が空');
      const from = es.find(e => e.key === x.rent_from);
      if (!from) fail(where, `rent_from（${x.rent_from}）が、この街の団地（estates）に無い`);
      else if (x.lead && (from.value || {})[c.lead_col] === undefined) fail(where, `最初の1画面に出す行に、出す列（${c.lead_col}）が無い`);
    };

    for (const [where0, x, type] of allItems(city)) {
      const where = `${city}.${where0}`;
      const bucket = `${type}@${where0.replace(/\[\d+\]$/, '')}`;
      if (type === 'rents' && x.estates) { n++; estateTown(where, x, bucket); continue; }
      if (type === 'rents' && x.value === undefined) { n++; noRent(where, x, bucket); continue; }
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
      /* quote_kind 'record' ＝ 2人が読んで書き取った記録（ページの字の並びそのものではない）。アットホームの街と、当サイトが計算する街だけ。 */
      if (x.quote_kind !== undefined && !(x.quote_kind === 'record' && (c.site === 'athome' || c.stat === 'calc_mean')))
        fail(where, "quote_kind は 'record' だけで、アットホームの街か、当サイトが計算する街の行だけ");
      keyed(where, x, bucket);
      if (x.value === undefined || x.value === '') fail(where, 'value が無い');
      if (x.lead !== undefined && x.lead !== true) fail(where, 'lead は true だけ');
      if (x.lead && !['rents', 'commute'].includes(type)) fail(where, 'lead は rents と commute だけ');

      /* 額: 正の数・円に直せる通貨・条件つき・引用に字のまま在る（当サイトが計算した団地の平均は、どのページにも無いので探さない） */
      const nums = amounts(x.value);
      if (x.cur) {
        if (!nums.length) fail(where, '額が無い');
        for (const v of nums) {
          if (!(v > 0)) fail(where, `額が正の数でない（${v}）`);
          else if (!Number.isFinite(man(x.cur, v))) fail(where, `円に直せない通貨（${x.cur}）`);
        }
        if (!String(x.cond_ja || '').trim()) fail(where, '金額に条件（cond_ja）が無い');
      } else if (nums.length && !x.unit) fail(where, '数字に unit も cur も無い');
      if (x.quote && s && !(type === 'estate' && c.stat === 'calc_mean')) for (const v of nums) if (!inQuote(x, v)) fail(where, `額（${v}）が引用に無い`);

      if (type === 'rents' || type === 'ref') {
        /* 列は、街の行なら都市の cols・refs の行ならその組の cols */
        const g = type === 'ref' ? (c.refs || [])[+/^refs\[(\d+)\]/.exec(where0)[1]] : null;
        const cs = g ? new Set((g.cols || []).map(([k]) => k)) : cols;
        if (!x.cur) fail(where, '家賃に通貨（cur）が無い');
        if (x.per !== null && x.per !== 'month') fail(where, `per は 'month' か null（${x.per}）`);
        if (type === 'rents') townRules(where, x);
        iataRule(where, x);
        named(where, x);
        const ks = Object.keys(x.value || {});
        if (!ks.length) fail(where, '列が1つも無い');
        for (const k of ks) {
          if (!cs.has(k)) fail(where, `列（${k}）が、その街の cols に無い`);
          const v = x.value[k];
          if (Array.isArray(v) && !(v.length === 2 && v[0] <= v[1])) fail(where, `幅が [下, 上] の形でない（${k}）`);
        }
        if (type === 'rents' && x.lead && x.value[c.lead_col] === undefined) fail(where, `最初の1画面に出す行に、出す列（${c.lead_col}）が無い`);
      }
      if (type === 'estate') {
        /* R19 団地の行: 鍵・名前・列・100の倍数・件数（5件から） */
        if (!/^est_[a-z_]+$/.test(String(x.key || '')) || estKeys.has(x.key) || towns.has(x.key))
          fail(where, `団地の鍵（${x.key}）は est_ で始まる英小文字で、都市の中で1つだけ（街の鍵と重ねない）`);
        estKeys.add(x.key);
        named(where, x);
        const ks = Object.keys(x.value && typeof x.value === 'object' ? x.value : {});
        if (!ks.length) fail(where, '列が1つも無い');
        for (const k of ks) {
          if (!cols.has(k)) fail(where, `列（${k}）が、その街の cols に無い`);
          if (!(Number.isInteger(x.value[k]) && x.value[k] > 0 && x.value[k] % 100 === 0)) fail(where, `団地の額（${k}）は、100の倍数の正の数`);
        }
        const nn = x.n && typeof x.n === 'object' ? x.n : {};
        if (Object.keys(nn).length !== ks.length || !ks.every(k => Number.isInteger(nn[k]) && nn[k] >= 5))
          fail(where, '団地の件数（n）は、額と同じ列に、5以上の整数（5件にそろわない間取りは出さない）');
      }
      if (type === 'commute') {
        if (!/^[A-Z]{3}$/.test(String(x.iata || ''))) fail(where, '空港（iata）が英大文字3字でない');
        if (!MODES.includes(x.mode)) fail(where, `手段（mode）が ${MODES.join('・')} のどれでもない`);
        if (!String(x.cond_ja || '').trim()) fail(where, '条件（cond_ja）が無い（駅から駅まで・目安、など）');
      }
    }
  }
  return { n, bad };
}

/* ════════════ コマンド ════════════ */

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] || '--check';
  if (mode === '--list') {
    for (const city of [...Object.keys(LIVING), 'abudhabi']) {
      for (const [where, x] of allItems(city)) {
        console.log(`■ ${city}.${where}  ${x.key}  ${x.ja}${x.lead ? ' ★最初の1画面' : ''}`);
        if (x.estates) { console.log(`   （家賃は団地ごとの行: ${x.estates.map(e => e.key).join('・')} ／ カードの額は ${x.rent_from}）\n`); continue; }
        if (!x.src) { console.log('   （家賃の出どころ無し ── 名前と選んだ理由だけ）\n'); continue; }
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
    const per = [...Object.keys(LIVING), 'abudhabi'].map(c => `${c} ${[...allItems(c)].length}`).join('・');
    console.log(`✅ living-facts: ${n}項目（${per}／出どころ・確かめた日・時点・引用・種類の白リスト・額が引用に字のまま在る・金額には条件・地区を選んだ理由・最初の1画面に出す1行が家賃と足に1つずつ／街の家賃は1つの出どころ・1つの条件・1つの日付／名前が引用に在る／移動は街ごと・着く場所ごと・時間の種類は1つ）`);
  }
}
