/* ══════════════════════════════════════════════════════════════════════
   就航地の台帳 ── 会社ページの「ステイ先」に並べる空港（先行5社）

   ■ 何を載せるか
     会社の公式の就航地・路線・時刻表で、**その会社が自社で飛ばしている**と確かめられた空港だけ。
     運休中・まだ始まっていない・グループ会社だけ・コードシェアだけ・貨物便だけ・確かめられなかった空港は
     `held` に理由つきで置き、画面には出さない（消さない＝次に確かめる人が同じ所から始められる）。

   ■ 何を言わないか
     ここに在る ＝「会社がその空港へ飛ばしている」まで。
     **「その機種で飛ぶ」「そのベースから飛ぶ」「泊まる」とは言っていない。**
     泊まった実績はパイロットの投稿（db/stays.sql）からしか出ない。画面でも2つを混ぜない。

   ■ 手で足すとき
     PLACES に空港（3字 → [都市の日本語, 英語, 国, 地域]）を足し、NETWORK の list に3字を足す。
     同じ空港は、どの会社のページでも同じ呼び名で出る（呼び名はここの1か所だけ）。
     確かめた資料の原本は sources-raw/（リポジトリに入れない）。
     季節運航は seasonal にも3字を書く（画面に「季節運航」と出る）。

   ■ 確かめる
     node airline-destinations.mjs          形の検査（重複・未登録の3字・地域の白リストなど）
     node airline-destinations.mjs --list   会社ごとの数と、出していない空港の理由
   ══════════════════════════════════════════════════════════════════════ */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* 画面の絞り込みに出す順。その会社に1つも無い地域は、画面に出さない。 */
export const REGIONS = [
  ['japan', '日本'], ['asia', 'アジア'], ['oceania', 'オセアニア'], ['north-america', '北米'],
  ['latin-america', '中南米'], ['europe', 'ヨーロッパ'], ['middle-east-africa', '中東・アフリカ'],
];

/* 空港の3字 → [都市（日本語）, 都市（英語）, 国, 地域] */
export const PLACES = {
  /* japan */
  AKJ: ['旭川', 'Asahikawa', '日本', 'japan'],
  AOJ: ['青森', 'Aomori', '日本', 'japan'],
  ASJ: ['奄美大島', 'Amami Oshima', '日本', 'japan'],
  AXJ: ['天草', 'Amakusa', '日本', 'japan'],
  AXT: ['秋田', 'Akita', '日本', 'japan'],
  CTS: ['札幌（新千歳）', 'Sapporo New Chitose', '日本', 'japan'],
  FKS: ['福島', 'Fukushima', '日本', 'japan'],
  FSZ: ['静岡', 'Shizuoka', '日本', 'japan'],
  FUJ: ['五島福江', 'Goto Fukue', '日本', 'japan'],
  FUK: ['福岡', 'Fukuoka', '日本', 'japan'],
  GAJ: ['山形', 'Yamagata', '日本', 'japan'],
  HAC: ['八丈島', 'Hachijojima', '日本', 'japan'],
  HIJ: ['広島', 'Hiroshima', '日本', 'japan'],
  HKD: ['函館', 'Hakodate', '日本', 'japan'],
  HNA: ['花巻', 'Hanamaki', '日本', 'japan'],
  HND: ['東京（羽田）', 'Tokyo Haneda', '日本', 'japan'],
  HSG: ['佐賀', 'Saga', '日本', 'japan'],
  IKI: ['壱岐', 'Iki', '日本', 'japan'],
  ISG: ['石垣', 'Ishigaki', '日本', 'japan'],
  ITM: ['大阪（伊丹）', 'Osaka Itami', '日本', 'japan'],
  IWJ: ['萩・石見', 'Hagi-Iwami', '日本', 'japan'],
  IWK: ['岩国', 'Iwakuni', '日本', 'japan'],
  IZO: ['出雲', 'Izumo', '日本', 'japan'],
  KCZ: ['高知', 'Kochi', '日本', 'japan'],
  KIJ: ['新潟', 'Niigata', '日本', 'japan'],
  KIX: ['大阪（関西）', 'Osaka Kansai', '日本', 'japan'],
  KKJ: ['北九州', 'Kitakyushu', '日本', 'japan'],
  KKX: ['喜界島', 'Kikai', '日本', 'japan'],
  KMI: ['宮崎', 'Miyazaki', '日本', 'japan'],
  KMJ: ['熊本', 'Kumamoto', '日本', 'japan'],
  KMQ: ['小松', 'Komatsu', '日本', 'japan'],
  KOJ: ['鹿児島', 'Kagoshima', '日本', 'japan'],
  KTD: ['北大東', 'Kitadaito', '日本', 'japan'],
  KUH: ['釧路', 'Kushiro', '日本', 'japan'],
  KUM: ['屋久島', 'Yakushima', '日本', 'japan'],
  MBE: ['オホーツク紋別', 'Okhotsk Monbetsu', '日本', 'japan'],
  MMB: ['女満別', 'Memanbetsu', '日本', 'japan'],
  MMD: ['南大東', 'Minamidaito', '日本', 'japan'],
  MMJ: ['松本', 'Matsumoto', '日本', 'japan'],
  MMY: ['宮古', 'Miyako', '日本', 'japan'],
  MSJ: ['三沢', 'Misawa', '日本', 'japan'],
  MYJ: ['松山', 'Matsuyama', '日本', 'japan'],
  NGO: ['名古屋（中部）', 'Nagoya Chubu', '日本', 'japan'],
  NGS: ['長崎', 'Nagasaki', '日本', 'japan'],
  NKM: ['名古屋（小牧）', 'Nagoya Komaki', '日本', 'japan'],
  NRT: ['東京（成田）', 'Tokyo Narita', '日本', 'japan'],
  NTQ: ['能登', 'Noto', '日本', 'japan'],
  OBO: ['帯広', 'Obihiro', '日本', 'japan'],
  OGN: ['与那国', 'Yonaguni', '日本', 'japan'],
  OIR: ['奥尻', 'Okushiri', '日本', 'japan'],
  OIT: ['大分', 'Oita', '日本', 'japan'],
  OKA: ['沖縄（那覇）', 'Okinawa Naha', '日本', 'japan'],
  OKD: ['札幌（丘珠）', 'Sapporo Okadama', '日本', 'japan'],
  OKE: ['沖永良部', 'Okinoerabu', '日本', 'japan'],
  OKI: ['隠岐', 'Oki', '日本', 'japan'],
  OKJ: ['岡山', 'Okayama', '日本', 'japan'],
  ONJ: ['大館能代', 'Odate Noshiro', '日本', 'japan'],
  RIS: ['利尻', 'Rishiri', '日本', 'japan'],
  RNJ: ['与論', 'Yoron', '日本', 'japan'],
  SDJ: ['仙台', 'Sendai', '日本', 'japan'],
  SHB: ['中標津', 'Nakashibetsu', '日本', 'japan'],
  SHM: ['南紀白浜', 'Nanki-Shirahama', '日本', 'japan'],
  SYO: ['庄内', 'Shonai', '日本', 'japan'],
  TAK: ['高松', 'Takamatsu', '日本', 'japan'],
  TJH: ['但馬', 'Tajima', '日本', 'japan'],
  TKN: ['徳之島', 'Tokunoshima', '日本', 'japan'],
  TKS: ['徳島', 'Tokushima', '日本', 'japan'],
  TNE: ['種子島', 'Tanegashima', '日本', 'japan'],
  TOY: ['富山', 'Toyama', '日本', 'japan'],
  TRA: ['多良間', 'Tarama', '日本', 'japan'],
  TSJ: ['対馬', 'Tsushima', '日本', 'japan'],
  TTJ: ['鳥取', 'Tottori', '日本', 'japan'],
  UBJ: ['山口宇部', 'Yamaguchi Ube', '日本', 'japan'],
  UEO: ['久米島', 'Kumejima', '日本', 'japan'],
  UKB: ['神戸', 'Kobe', '日本', 'japan'],
  WKJ: ['稚内', 'Wakkanai', '日本', 'japan'],
  YGJ: ['米子', 'Yonago', '日本', 'japan'],
  /* asia */
  KBL: ['カブール', 'Kabul', 'アフガニスタン', 'asia'],
  AMD: ['アーメダバード', 'Ahmedabad', 'インド', 'asia'],
  BLR: ['ベンガルール', 'Bengaluru', 'インド', 'asia'],
  BOM: ['ムンバイ', 'Mumbai', 'インド', 'asia'],
  CCJ: ['コーリコード', 'Kozhikode', 'インド', 'asia'],
  CCU: ['コルカタ', 'Kolkata', 'インド', 'asia'],
  COK: ['コーチ', 'Kochi', 'インド', 'asia'],
  DEL: ['デリー', 'Delhi', 'インド', 'asia'],
  HYD: ['ハイデラバード', 'Hyderabad', 'インド', 'asia'],
  JAI: ['ジャイプール', 'Jaipur', 'インド', 'asia'],
  MAA: ['チェンナイ', 'Chennai', 'インド', 'asia'],
  TRV: ['ティルヴァナンタプラム', 'Thiruvananthapuram', 'インド', 'asia'],
  CGK: ['ジャカルタ', 'Jakarta', 'インドネシア', 'asia'],
  DPS: ['デンパサール（バリ島）', 'Denpasar Bali', 'インドネシア', 'asia'],
  SUB: ['スラバヤ', 'Surabaya', 'インドネシア', 'asia'],
  TAS: ['タシケント', 'Tashkent', 'ウズベキスタン', 'asia'],
  ALA: ['アルマトイ', 'Almaty', 'カザフスタン', 'asia'],
  KTI: ['プノンペン', 'Phnom Penh', 'カンボジア', 'asia'],
  SIN: ['シンガポール', 'Singapore', 'シンガポール', 'asia'],
  CMB: ['コロンボ', 'Colombo', 'スリランカ', 'asia'],
  BKK: ['バンコク', 'Bangkok', 'タイ', 'asia'],
  CNX: ['チェンマイ', 'Chiang Mai', 'タイ', 'asia'],
  HKT: ['プーケット', 'Phuket', 'タイ', 'asia'],
  KBV: ['クラビ', 'Krabi', 'タイ', 'asia'],
  KTM: ['カトマンズ', 'Kathmandu', 'ネパール', 'asia'],
  ISB: ['イスラマバード', 'Islamabad', 'パキスタン', 'asia'],
  KHI: ['カラチ', 'Karachi', 'パキスタン', 'asia'],
  LHE: ['ラホール', 'Lahore', 'パキスタン', 'asia'],
  PEW: ['ペシャワール', 'Peshawar', 'パキスタン', 'asia'],
  DAC: ['ダッカ', 'Dhaka', 'バングラデシュ', 'asia'],
  CEB: ['セブ', 'Cebu', 'フィリピン', 'asia'],
  CRK: ['クラーク', 'Clark', 'フィリピン', 'asia'],
  MNL: ['マニラ', 'Manila', 'フィリピン', 'asia'],
  DAD: ['ダナン', 'Da Nang', 'ベトナム', 'asia'],
  HAN: ['ハノイ', 'Hanoi', 'ベトナム', 'asia'],
  SGN: ['ホーチミン', 'Ho Chi Minh City', 'ベトナム', 'asia'],
  MFM: ['マカオ', 'Macau', 'マカオ', 'asia'],
  KUL: ['クアラルンプール', 'Kuala Lumpur', 'マレーシア', 'asia'],
  PEN: ['ペナン', 'Penang', 'マレーシア', 'asia'],
  RGN: ['ヤンゴン', 'Yangon', 'ミャンマー', 'asia'],
  MLE: ['マレ', 'Malé', 'モルディブ', 'asia'],
  GMP: ['ソウル（金浦）', 'Seoul Gimpo', '韓国', 'asia'],
  ICN: ['ソウル（仁川）', 'Seoul Incheon', '韓国', 'asia'],
  PUS: ['釜山', 'Busan', '韓国', 'asia'],
  HKG: ['香港', 'Hong Kong', '香港', 'asia'],
  KHH: ['高雄', 'Kaohsiung', '台湾', 'asia'],
  TPE: ['台北（桃園）', 'Taipei Taoyuan', '台湾', 'asia'],
  TSA: ['台北（松山）', 'Taipei Songshan', '台湾', 'asia'],
  CAN: ['広州', 'Guangzhou', '中国', 'asia'],
  CGO: ['鄭州', 'Zhengzhou', '中国', 'asia'],
  CKG: ['重慶', 'Chongqing', '中国', 'asia'],
  CSX: ['長沙', 'Changsha', '中国', 'asia'],
  CTU: ['成都（双流）', 'Chengdu Shuangliu', '中国', 'asia'],
  DLC: ['大連', 'Dalian', '中国', 'asia'],
  FOC: ['福州', 'Fuzhou', '中国', 'asia'],
  HAK: ['海口', 'Haikou', '中国', 'asia'],
  HGH: ['杭州', 'Hangzhou', '中国', 'asia'],
  NGB: ['寧波', 'Ningbo', '中国', 'asia'],
  NKG: ['南京', 'Nanjing', '中国', 'asia'],
  PEK: ['北京（首都）', 'Beijing Capital', '中国', 'asia'],
  PKX: ['北京（大興）', 'Beijing Daxing', '中国', 'asia'],
  PVG: ['上海（浦東）', 'Shanghai Pudong', '中国', 'asia'],
  SHA: ['上海（虹橋）', 'Shanghai Hongqiao', '中国', 'asia'],
  SHE: ['瀋陽', 'Shenyang', '中国', 'asia'],
  SZX: ['深圳', 'Shenzhen', '中国', 'asia'],
  TAO: ['青島', 'Qingdao', '中国', 'asia'],
  TFU: ['成都（天府）', 'Chengdu Tianfu', '中国', 'asia'],
  TSN: ['天津', 'Tianjin', '中国', 'asia'],
  URC: ['ウルムチ', 'Urumqi', '中国', 'asia'],
  WNZ: ['温州', 'Wenzhou', '中国', 'asia'],
  WUH: ['武漢', 'Wuhan', '中国', 'asia'],
  XIY: ['西安', 'Xi\'an', '中国', 'asia'],
  XMN: ['厦門（アモイ）', 'Xiamen', '中国', 'asia'],
  /* oceania */
  ADL: ['アデレード', 'Adelaide', 'オーストラリア', 'oceania'],
  BNE: ['ブリスベン', 'Brisbane', 'オーストラリア', 'oceania'],
  MEL: ['メルボルン', 'Melbourne', 'オーストラリア', 'oceania'],
  PER: ['パース', 'Perth', 'オーストラリア', 'oceania'],
  SYD: ['シドニー', 'Sydney', 'オーストラリア', 'oceania'],
  GUM: ['グアム', 'Guam', 'グアム', 'oceania'],
  AKL: ['オークランド', 'Auckland', 'ニュージーランド', 'oceania'],
  CHC: ['クライストチャーチ', 'Christchurch', 'ニュージーランド', 'oceania'],
  /* north-america */
  ATL: ['アトランタ', 'Atlanta', 'アメリカ', 'north-america'],
  BOS: ['ボストン', 'Boston', 'アメリカ', 'north-america'],
  CLT: ['シャーロット', 'Charlotte', 'アメリカ', 'north-america'],
  DFW: ['ダラス', 'Dallas', 'アメリカ', 'north-america'],
  HNL: ['ホノルル', 'Honolulu', 'アメリカ', 'north-america'],
  IAD: ['ワシントンD.C.', 'Washington, D.C.', 'アメリカ', 'north-america'],
  IAH: ['ヒューストン', 'Houston', 'アメリカ', 'north-america'],
  JFK: ['ニューヨーク', 'New York', 'アメリカ', 'north-america'],
  LAX: ['ロサンゼルス', 'Los Angeles', 'アメリカ', 'north-america'],
  ORD: ['シカゴ', 'Chicago', 'アメリカ', 'north-america'],
  SAN: ['サンディエゴ', 'San Diego', 'アメリカ', 'north-america'],
  SEA: ['シアトル', 'Seattle', 'アメリカ', 'north-america'],
  SFO: ['サンフランシスコ', 'San Francisco', 'アメリカ', 'north-america'],
  SJC: ['サンノゼ', 'San Jose', 'アメリカ', 'north-america'],
  YVR: ['バンクーバー', 'Vancouver', 'カナダ', 'north-america'],
  YYC: ['カルガリー', 'Calgary', 'カナダ', 'north-america'],
  YYZ: ['トロント', 'Toronto', 'カナダ', 'north-america'],
  /* latin-america */
  MEX: ['メキシコシティ', 'Mexico City', 'メキシコ', 'latin-america'],
  /* europe */
  DUB: ['ダブリン', 'Dublin', 'アイルランド', 'europe'],
  LHR: ['ロンドン', 'London', 'イギリス', 'europe'],
  MAN: ['マンチェスター', 'Manchester', 'イギリス', 'europe'],
  FCO: ['ローマ', 'Rome', 'イタリア', 'europe'],
  MXP: ['ミラノ', 'Milan', 'イタリア', 'europe'],
  VIE: ['ウィーン', 'Vienna', 'オーストリア', 'europe'],
  AMS: ['アムステルダム', 'Amsterdam', 'オランダ', 'europe'],
  ATH: ['アテネ', 'Athens', 'ギリシャ', 'europe'],
  JMK: ['ミコノス', 'Mykonos', 'ギリシャ', 'europe'],
  JTR: ['サントリーニ', 'Santorini', 'ギリシャ', 'europe'],
  GVA: ['ジュネーブ', 'Geneva', 'スイス', 'europe'],
  ZRH: ['チューリッヒ', 'Zurich', 'スイス', 'europe'],
  ARN: ['ストックホルム', 'Stockholm', 'スウェーデン', 'europe'],
  GOT: ['ヨーテボリ', 'Gothenburg', 'スウェーデン', 'europe'],
  AGP: ['マラガ', 'Malaga', 'スペイン', 'europe'],
  BCN: ['バルセロナ', 'Barcelona', 'スペイン', 'europe'],
  MAD: ['マドリード', 'Madrid', 'スペイン', 'europe'],
  PMI: ['パルマ・デ・マヨルカ', 'Palma de Mallorca', 'スペイン', 'europe'],
  PRG: ['プラハ', 'Prague', 'チェコ', 'europe'],
  CPH: ['コペンハーゲン', 'Copenhagen', 'デンマーク', 'europe'],
  DUS: ['デュッセルドルフ', 'Düsseldorf', 'ドイツ', 'europe'],
  FRA: ['フランクフルト', 'Frankfurt', 'ドイツ', 'europe'],
  MUC: ['ミュンヘン', 'Munich', 'ドイツ', 'europe'],
  IST: ['イスタンブール', 'Istanbul', 'トルコ', 'europe'],
  HEL: ['ヘルシンキ', 'Helsinki', 'フィンランド', 'europe'],
  CDG: ['パリ', 'Paris', 'フランス', 'europe'],
  NCE: ['ニース', 'Nice', 'フランス', 'europe'],
  BRU: ['ブリュッセル', 'Brussels', 'ベルギー', 'europe'],
  KRK: ['クラクフ', 'Krakow', 'ポーランド', 'europe'],
  WAW: ['ワルシャワ', 'Warsaw', 'ポーランド', 'europe'],
  LIS: ['リスボン', 'Lisbon', 'ポルトガル', 'europe'],
  OTP: ['ブカレスト', 'Bucharest', 'ルーマニア', 'europe'],
  LUX: ['ルクセンブルク', 'Luxembourg', 'ルクセンブルク', 'europe'],
  AER: ['ソチ', 'Sochi', 'ロシア', 'europe'],
  DME: ['モスクワ', 'Moscow', 'ロシア', 'europe'],
  KZN: ['カザン', 'Kazan', 'ロシア', 'europe'],
  LED: ['サンクトペテルブルク', 'Saint Petersburg', 'ロシア', 'europe'],
  SVO: ['モスクワ', 'Moscow', 'ロシア', 'europe'],
  VVO: ['ウラジオストク', 'Vladivostok', 'ロシア', 'europe'],
  /* middle-east-africa */
  AUH: ['アブダビ', 'Abu Dhabi', 'アラブ首長国連邦', 'middle-east-africa'],
  DXB: ['ドバイ', 'Dubai', 'アラブ首長国連邦', 'middle-east-africa'],
  TLV: ['テルアビブ', 'Tel Aviv', 'イスラエル', 'middle-east-africa'],
  CAI: ['カイロ', 'Cairo', 'エジプト', 'middle-east-africa'],
  DBB: ['エル・アラメイン', 'Al Alamein', 'エジプト', 'middle-east-africa'],
  ADD: ['アディスアベバ', 'Addis Ababa', 'エチオピア', 'middle-east-africa'],
  ASM: ['アスマラ', 'Asmara', 'エリトリア', 'middle-east-africa'],
  MCT: ['マスカット', 'Muscat', 'オマーン', 'middle-east-africa'],
  SLL: ['サラーラ', 'Salalah', 'オマーン', 'middle-east-africa'],
  ACC: ['アクラ', 'Accra', 'ガーナ', 'middle-east-africa'],
  DOH: ['ドーハ', 'Doha', 'カタール', 'middle-east-africa'],
  KWI: ['クウェート', 'Kuwait', 'クウェート', 'middle-east-africa'],
  NBO: ['ナイロビ', 'Nairobi', 'ケニア', 'middle-east-africa'],
  FBM: ['ルブンバシ', 'Lubumbashi', 'コンゴ民主共和国', 'middle-east-africa'],
  FIH: ['キンシャサ', 'Kinshasa', 'コンゴ民主共和国', 'middle-east-africa'],
  DMM: ['ダンマーム', 'Dammam', 'サウジアラビア', 'middle-east-africa'],
  ELQ: ['アル・カシム', 'Al Qassim', 'サウジアラビア', 'middle-east-africa'],
  JED: ['ジェッダ', 'Jeddah', 'サウジアラビア', 'middle-east-africa'],
  MED: ['メディナ', 'Medina', 'サウジアラビア', 'middle-east-africa'],
  RSI: ['紅海（レッドシー）', 'The Red Sea', 'サウジアラビア', 'middle-east-africa'],
  RUH: ['リヤド', 'Riyadh', 'サウジアラビア', 'middle-east-africa'],
  DAM: ['ダマスカス', 'Damascus', 'シリア', 'middle-east-africa'],
  HRE: ['ハラレ', 'Harare', 'ジンバブエ', 'middle-east-africa'],
  SEZ: ['セーシェル（マヘ島）', 'Seychelles', 'セーシェル', 'middle-east-africa'],
  ZNZ: ['ザンジバル', 'Zanzibar', 'タンザニア', 'middle-east-africa'],
  TUN: ['チュニス', 'Tunis', 'チュニジア', 'middle-east-africa'],
  LOS: ['ラゴス', 'Lagos', 'ナイジェリア', 'middle-east-africa'],
  BAH: ['バーレーン', 'Bahrain', 'バーレーン', 'middle-east-africa'],
  CMN: ['カサブランカ', 'Casablanca', 'モロッコ', 'middle-east-africa'],
  AMM: ['アンマン', 'Amman', 'ヨルダン', 'middle-east-africa'],
  BEY: ['ベイルート', 'Beirut', 'レバノン', 'middle-east-africa'],
  JNB: ['ヨハネスブルグ', 'Johannesburg', '南アフリカ', 'middle-east-africa'],
};

/* 会社ごとの就航地。
   home     本拠地の空港（一覧には出さない）
   at       公式の資料を確かめた日
   src      確かめた公式ページ
   basis    何を数えたか（画面の「出典」を開くと出る）
   list     出す空港（地域ごとに1行）
   seasonal そのうち季節運航のもの
   held     出さない空港と理由 ── [3字 または 都市の名前, 理由] */
export const NETWORK = {
  jal: {
    home: ['HND', 'NRT'], at: '2026-10-08',
    src: [
      { name: 'JAL公式「国際線運航情報」', url: 'https://www.jal.co.jp/jp/ja/info/2020/other/flysafe/flights-service/' },
      { name: 'JAL公式「国内線 時刻表」', url: 'https://www.jal.co.jp/jp/ja/dom/route/time/' },
    ],
    basis: '日本航空が自社で飛ばしている便の行き先（国際線は公式の運航計画、国内線は公式の時刻表）。グループ会社だけが飛ばす空港、コードシェアだけの空港、運休中の空港は入れていません。',
    list: [
      'CTS MMB AKJ KUH OBO HKD AOJ MSJ KMQ NGO KIX ITM SHM OKJ IZO HIJ TKS TAK KCZ MYJ FUK KKJ OIT NGS KMJ KMI KOJ ASJ OKA',
      'BKK SIN KUL CGK HAN SGN MNL DEL BLR PEK SHA PVG CAN DLC TSN HKG TSA TPE GMP',
      'GUM SYD MEL',
      'JFK BOS ORD DFW SFO LAX SAN SEA YVR HNL',
      'LHR CDG FRA HEL',
    ].join(' ').split(' '),
    held: [
      ['DOH', '運休中（2027-03-27まで）'],
      ['SVO', '運休中（再開の計画が公表されていない）'],
      ['VVO', '運休中（再開の計画が公表されていない）'],
      ['OKD', 'グループ会社（HAC）と提携会社（FDA）だけが運航'],
      ['RIS', 'グループ会社（HAC）だけが運航'],
      ['SHB', 'グループ会社（HAC）だけが運航'],
      ['OIR', 'グループ会社（HAC）だけが運航'],
      ['AXT', 'グループ会社（J-AIR・HAC）だけが運航'],
      ['HNA', 'グループ会社（J-AIR）と提携会社（FDA）だけが運航'],
      ['GAJ', 'グループ会社（J-AIR）と提携会社（FDA）だけが運航'],
      ['SDJ', 'グループ会社（J-AIR）と提携会社（FDA）だけが運航'],
      ['KIJ', 'グループ会社（J-AIR）と提携会社（FDA）だけが運航'],
      ['MMJ', '提携会社（FDA）のコードシェア便だけ'],
      ['FSZ', '提携会社（FDA）のコードシェア便だけ'],
      ['NKM', '提携会社（FDA）のコードシェア便だけ'],
      ['UKB', '提携会社（FDA）のコードシェア便だけ'],
      ['TJH', 'グループ会社（JAC）だけが運航'],
      ['OKI', 'グループ会社（J-AIR・JAC）だけが運航'],
      ['UBJ', 'グループ会社（J-AIR）だけが運航'],
      ['TSJ', '提携会社（ORC）のコードシェア便だけ'],
      ['IKI', '提携会社（ORC）のコードシェア便だけ'],
      ['FUJ', '提携会社（ORC）のコードシェア便だけ'],
      ['AXJ', '提携会社（AMX）のコードシェア便だけ'],
      ['TNE', 'グループ会社（JAC）だけが運航'],
      ['KUM', 'グループ会社（JAC）だけが運航'],
      ['KKX', 'グループ会社（JAC）だけが運航'],
      ['TKN', 'グループ会社（J-AIR・JAC）だけが運航'],
      ['OKE', 'グループ会社（JAC）だけが運航'],
      ['RNJ', 'グループ会社（JAC・RAC）だけが運航'],
      ['KTD', 'グループ会社（RAC）だけが運航'],
      ['MMD', 'グループ会社（RAC）だけが運航'],
      ['UEO', 'グループ会社（JTA・RAC）だけが運航'],
      ['MMY', 'JALが自社で飛ばす便は 2026-10-24 まで（そのあとはグループ会社の便だけ）'],
      ['TRA', 'グループ会社（RAC）だけが運航'],
      ['ISG', 'JALが自社で飛ばす便は 2026-10-24 まで（そのあとはグループ会社の便だけ）'],
      ['OGN', 'グループ会社（RAC）だけが運航'],
    ],
  },
  ana: {
    home: ['HND', 'NRT'], at: '2026-10-08',
    src: [
      { name: 'ANA公式「運航開始・再開・休止路線のご案内（国際線）」', url: 'https://www.ana.co.jp/ja/jp/guide/plan/airinfo/int-routeinfo/' },
      { name: 'ANA公式「時刻表（国内線）」', url: 'https://www.ana.co.jp/ja/jp/guide/plan/airinfo/dom-timetable/' },
    ],
    basis: 'ANAが自社で飛ばしている便の行き先（国際線は公式の路線案内、国内線は公式の時刻表）。ANAウイングスだけが飛ばす空港、コードシェアだけの空港、運休中の空港は入れていません。',
    list: [
      'ITM KIX UKB CTS NGO FUK OKA KOJ KMI NGS SDJ KMJ MYJ HIJ OIT ISG MMY AXT KCZ KIJ HKD IWK TAK HSG OKJ UBJ KMQ TTJ YGJ SYO KUH TOY TKS SHB NTQ HAC IWJ WKJ ONJ',
      'DEL BOM BKK HAN SGN KUL SIN CGK MNL PEK DLC TAO PVG SHA HGH CAN SZX HKG TSA GMP',
      'SYD PER',
      'LAX SFO SEA IAD JFK IAH ORD YVR HNL',
      'MEX',
      'LHR CDG FRA MUC BRU VIE MXP ARN IST',
    ].join(' ').split(' '),
    held: [
      ['DUS', '運休中'],
      ['VVO', '運休中'],
      ['MAA', '運休中'],
      ['プノンペン', '運休中・空港を公式ページで特定できない'],
      ['RGN', '運休中'],
      ['SHE', '運休中'],
      ['WUH', '運休中'],
      ['成都', '運休中・空港を公式ページで特定できない'],
      ['XMN', '運休中'],
      ['TPE', '運休中'],
      ['SJC', '就航を延期'],
      ['DME', '就航を延期'],
      ['TSJ', 'グループ会社（ANAウイングス）だけが運航'],
      ['FUJ', 'グループ会社（ANAウイングス）だけが運航'],
      ['MMB', 'グループ会社（ANAウイングス）だけが運航'],
      ['AOJ', 'グループ会社（ANAウイングス）だけが運航'],
      ['AKJ', 'グループ会社（ANAウイングス）だけが運航・期間限定'],
      ['FKS', 'グループ会社（ANAウイングス）だけが運航'],
      ['FSZ', 'グループ会社（ANAウイングス）だけが運航・冬の時刻表に無い'],
      ['MBE', 'グループ会社（ANAウイングス）だけが運航'],
      ['RIS', 'グループ会社（ANAウイングス）だけが運航・冬の時刻表に無い'],
      ['KKJ', '提携会社のコードシェア便だけ'],
      ['ASJ', '提携会社のコードシェア便だけ'],
      ['KUM', '提携会社のコードシェア便だけ'],
      ['KKX', '提携会社のコードシェア便だけ'],
      ['TKN', '提携会社のコードシェア便だけ'],
      ['OKE', '提携会社のコードシェア便だけ'],
      ['AXJ', '提携会社のコードシェア便だけ'],
      ['TNE', '提携会社のコードシェア便だけ'],
      ['OBO', '提携会社のコードシェア便だけ'],
      ['RNJ', '提携会社のコードシェア便だけ'],
      ['IKI', '提携会社のコードシェア便だけ'],
    ],
  },
  'eva-air': {
    home: ['TPE'], at: '2026-10-08',
    src: [
      { name: 'EVA Air 公式「Worldwide Airports」', url: 'https://www.evaair.com/en-global/fly-prepare/at-the-airport/worldwide-airports/' },
    ],
    basis: 'エバー航空が自社で飛ばしている便の行き先（公式の空港一覧と時刻表）。立栄航空（UNI Air）だけが飛ばす都市、貨物便だけの空港は入れていません。',
    list: [
      'NRT HND KIX UKB FUK CTS SDJ KMQ OKA AOJ MYJ',
      'TSA KHH HKG MFM PEK PVG SHA CAN HGH CTU ICN GMP PUS BKK CNX HAN SGN DAD SIN KUL CGK DPS MNL CEB CRK KTI',
      'BNE',
      'LAX SFO SEA JFK ORD IAH DFW IAD YVR YYZ',
      'LHR CDG AMS VIE MUC MXP',
    ].join(' ').split(' '),
    held: [
      ['DEL', 'まだ運航が始まっていない（2026-12から）'],
      ['重慶', '立栄航空（UNI Air）の便だけ'],
      ['大連', '立栄航空（UNI Air）の便だけ'],
      ['福州', '立栄航空（UNI Air）の便だけ'],
      ['南京', '立栄航空（UNI Air）の便だけ'],
      ['青島', '立栄航空（UNI Air）の便だけ'],
      ['瀋陽', '立栄航空（UNI Air）の便だけ'],
      ['深圳', '立栄航空（UNI Air）の便だけ'],
      ['無錫', '立栄航空（UNI Air）の便だけ'],
      ['厦門', '立栄航空（UNI Air）の便だけ'],
      ['西安', '立栄航空（UNI Air）の便だけ'],
      ['イスタンブール', '提携会社のコードシェア便だけ'],
      ['オークランド', '提携会社のコードシェア便だけ'],
      ['ペナン', '貨物便だけ'],
      ['アンカレッジ', '貨物便だけ'],
      ['アトランタ', '貨物便だけ'],
      ['台中', '公式の一覧にあるが、時刻表に便が無い'],
      ['桂林', '空港と運航する会社を公式の資料で確かめられなかった'],
      ['済南', '空港と運航する会社を公式の資料で確かめられなかった'],
      ['天津', '空港と運航する会社を公式の資料で確かめられなかった'],
      ['鄭州', '空港と運航する会社を公式の資料で確かめられなかった'],
      ['寧波', '空港と運航する会社を公式の資料で確かめられなかった'],
    ],
  },
  'cathay-pacific': {
    home: ['HKG'], at: '2026-10-08',
    src: [
      { name: 'Cathay Pacific 公式「Our global network」', url: 'https://flights.cathaypacific.com/en_HK/book-flights/global-network.html' },
    ],
    basis: 'キャセイパシフィックが自社で飛ばしている香港発着の便の行き先（公式の路線網のページと時刻表）。香港エクスプレスだけが飛ばす都市、運休中の空港は入れていません。',
    list: [
      'FUK NGO KIX CTS HND NRT',
      'BLR MAA DEL HYD BOM DPS CGK SUB KTI SIN CMB BKK HKT KTM DAC CEB MNL HAN SGN KUL PEN PEK CSX CTU CKG FOC CAN HAK HGH NKG NGB TAO PVG SHA URC WNZ WUH XIY XMN CGO KHH TPE ICN',
      'ADL BNE MEL PER SYD AKL CHC',
      'BOS ORD DFW LAX JFK SFO SEA YYZ YVR',
      'LHR MAN MXP FCO AMS ZRH BCN MAD FRA MUC CDG BRU',
      'JNB',
    ].join(' ').split(' '),
    seasonal: 'ADL CHC FCO BCN'.split(' '),
    held: [
      ['ALA', 'まだ運航が始まっていない（2027-01から）'],
      ['DXB', '運休中'],
      ['RUH', '運休中'],
      ['コタキナバル', '香港エクスプレスの便だけ'],
      ['済州', '香港エクスプレスの便だけ'],
      ['CNX', '香港エクスプレスの便だけ'],
      ['CRK', '香港エクスプレスの便だけ'],
      ['常州', '香港エクスプレスの便だけ'],
      ['HIJ', '香港エクスプレスの便だけ'],
      ['ISG', '香港エクスプレスの便だけ'],
      ['KMQ', '香港エクスプレスの便だけ'],
      ['OKA', '香港エクスプレスの便だけ'],
      ['フーコック', '香港エクスプレスの便だけ'],
      ['PUS', '香港エクスプレスの便だけ'],
      ['台中', '香港エクスプレスの便だけ'],
      ['SDJ', '香港エクスプレスの便だけ'],
      ['三亜', '香港エクスプレスの便だけ'],
      ['大邱', '香港エクスプレスの便だけ'],
      ['TAK', '香港エクスプレスの便だけ'],
      ['無錫', '香港エクスプレスの便だけ'],
      ['義烏', '香港エクスプレスの便だけ'],
      ['DAD', '香港エクスプレスの便だけ'],
      ['ケアンズ', '今の公式の資料で確かめられなかった'],
      ['PKX', '提携会社の便だけ'],
      ['TFU', '提携会社の便だけ'],
    ],
  },
  etihad: {
    home: ['AUH'], at: '2026-10-08',
    src: [
      { name: 'Etihad Airways 公式「Destinations」', url: 'https://www.etihad.com/en/destinations' },
    ],
    basis: 'エティハド航空の公式の就航地の一覧に載っている都市。まだ運航が始まっていない都市は入れていません。',
    list: [
      'KIX NRT',
      'AMD BLR MAA CMB DAC HYD ISB JAI KHI COK CCU CCJ LHE MLE BOM DEL PEW TRV DPS BKK PKX HAN HKG CGK KBL KBV KUL MNL KTI HKT ICN PVG SIN TPE TAS',
      'MEL SYD',
      'ATL BOS CLT ORD JFK YYZ IAD',
      'AMS ATH BCN BRU CPH DUB DUS FRA GVA IST KZN KRK LIS LHR MAD AGP MAN MXP SVO MUC JMK NCE PMI CDG PRG FCO LED JTR AER VIE WAW ZRH',
      'ADD DBB ELQ AMM BAH BEY CAI CMN DAM DMM DOH JED JNB KWI MED MCT NBO RUH SLL SEZ TLV RSI TUN ZNZ',
    ].join(' ').split(' '),
    seasonal: 'KBV KIX KZN KRK AGP JMK NCE PMI LED JTR DBB RSI ZNZ'.split(' '),
    held: [
      ['TFU', 'まだ運航が始まっていない（2027-03-05から）'],
      ['CAN', 'まだ運航が始まっていない（2027-03-04から）'],
      ['HGH', 'まだ運航が始まっていない（2027-03-04から）'],
      ['SZX', 'まだ運航が始まっていない（2027-03-07から）'],
      ['OTP', 'まだ運航が始まっていない（2026-12-17から）'],
      ['GOT', 'まだ運航が始まっていない（2026-12-17から）'],
      ['LUX', 'まだ運航が始まっていない（2026-10-29から）'],
      ['ACC', 'まだ運航が始まっていない（2027-03-17から）'],
      ['ASM', 'まだ運航が始まっていない（2026-11-07から）'],
      ['HRE', 'まだ運航が始まっていない（2027-03-24から）'],
      ['FIH', 'まだ運航が始まっていない（2027-03-18から）'],
      ['LOS', 'まだ運航が始まっていない（2027-03-18から）'],
      ['FBM', 'まだ運航が始まっていない（2027-03-24から）'],
      ['YYC', 'まだ運航が始まっていない（2026-10-25から）'],
      ['CNX', '運航しているかを公式の資料で確かめられなかった'],
      ['ベルリン', '提携会社（コンドル）の便'],
      ['アルジェ・メダン・アルマトイ・バクー・トビリシ・エレバン・アンタルヤ', '過去に発表されたが、公式の就航地の一覧に無い'],
    ],
  },
};

/* 画面に渡す形（会社ページを作る側はこれだけ呼ぶ）。台帳に無い会社は null。 */
export function networkOf(slug) {
  const n = NETWORK[slug];
  if (!n) return null;
  const seasonal = new Set(n.seasonal || []);
  const order = Object.fromEntries(REGIONS.map(([k], i) => [k, i]));
  const list = n.list.map(iata => {
    const [city, en, country, region] = PLACES[iata];
    return { iata, city, en, country, region, seasonal: seasonal.has(iata) };
  }).sort((a, b) => order[a.region] - order[b.region]);
  const regions = REGIONS.filter(([k]) => list.some(d => d.region === k)).map(([key, label]) => ({ key, label, n: list.filter(d => d.region === key).length }));
  return { home: n.home, at: n.at, src: n.src, basis: n.basis, list, regions, held: n.held.map(([key, why]) => ({ key, name: PLACES[key] ? PLACES[key][0] : key, why })) };
}

export function check() {
  const bad = [], regs = new Set(REGIONS.map(r => r[0]));
  for (const [k, v] of Object.entries(PLACES)) {
    if (!/^[A-Z]{3}$/.test(k)) bad.push(`PLACES.${k}: 3字ではない`);
    if (!Array.isArray(v) || v.length !== 4 || v.some(x => !x || typeof x !== 'string')) bad.push(`PLACES.${k}: [都市, 英語, 国, 地域] の4つがそろっていない`);
    else if (!regs.has(v[3])) bad.push(`PLACES.${k}: 地域「${v[3]}」が REGIONS に無い`);
  }
  for (const [slug, n] of Object.entries(NETWORK)) {
    const at = `NETWORK.${slug}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(n.at)) bad.push(`${at}: 確かめた日が無い`);
    if (!n.src.length || n.src.some(s => !s.name || !/^https:\/\//.test(s.url))) bad.push(`${at}: 公式ページの名前と https の住所が要る`);
    if (!n.basis) bad.push(`${at}: 何を数えたか（basis）が無い`);
    const seen = new Set();
    for (const k of n.list) {
      if (!PLACES[k]) bad.push(`${at}: ${k} が PLACES に無い`);
      if (seen.has(k)) bad.push(`${at}: ${k} が2回ある`);
      if (n.home.includes(k)) bad.push(`${at}: 本拠地 ${k} が一覧に入っている`);
      seen.add(k);
    }
    for (const k of n.home) if (!PLACES[k]) bad.push(`${at}: 本拠地 ${k} が PLACES に無い`);
    for (const k of n.seasonal || []) if (!seen.has(k)) bad.push(`${at}: 季節運航の ${k} が一覧に無い`);
    for (const [k, why] of n.held) {
      if (!why) bad.push(`${at}: 出さない空港 ${k} に理由が無い`);
      if (seen.has(k)) bad.push(`${at}: ${k} が「出す」と「出さない」の両方に在る`);
      if (/^[A-Z]{3}$/.test(k) && !PLACES[k]) bad.push(`${at}: 出さない空港 ${k} が PLACES に無い`);
    }
  }
  return bad;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bad = check();
  if (bad.length) {
    for (const b of bad) console.log('❌ ' + b);
    console.log(`\n❌ airline-destinations: ${bad.length}件`);
    process.exit(1);
  }
  if (process.argv[2] === '--list') {
    for (const slug of Object.keys(NETWORK)) {
      const v = networkOf(slug);
      console.log(`■ ${slug}  ${v.list.length}空港（${v.regions.map(r => `${r.label} ${r.n}`).join('・')}）  確かめた日 ${v.at}`);
      console.log(`   出していない ${v.held.length}: ${v.held.map(h => `${h.name}＝${h.why}`).join(' ／ ')}\n`);
    }
  }
  console.log(`✅ airline-destinations: ${Object.keys(NETWORK).map(s => `${s} ${NETWORK[s].list.length}`).join('・')}（空港 ${Object.keys(PLACES).length}／重複なし・3字は全部台帳に在る・本拠地は一覧に入れない・出さない空港には理由）`);
}
