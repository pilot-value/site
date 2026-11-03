/* us-housing.mjs ── 米国の会社ページの「暮らし」：拠点の近くの住宅地と、その郵便番号の家賃（2026-11-02）。
 *
 * ★オーナー 2026-11-02「暮らしの部分は…基地の近くの富裕層が住むところのデータなかった？？」「せっかく調べてきた内容を無駄にしないで」。
 *   出どころは ChatGPT の調べ（米国20社・2026-11-02・住宅地の節）。家賃は米国住宅都市開発省（HUD）の
 *   郵便番号ごとの家賃の指標（Small Area Fair Market Rents・FY2027＝2026-10-01から）── その郵便番号の区域の、
 *   ふつうの賃貸住宅の家賃の下から40%の水準（決まった光熱費を含む）。募集の平均・高級物件の家賃ではない。
 *   ⚠️ 郵便番号の区域は街の境と一致しない（「周辺」と書いた街はその分ずれる）。
 *   ⚠️ 画面に「富裕層に人気」と書かない（資料の言葉ではない ── メモリの決まり）。世帯の所得（income）は並べる順にだけ使う。
 *   ⚠️ 手で直さない。資料が新しくなったら、資料から書き直す（数字を1つずつ足し引きしない）。
 *
 * REGIONS   … 住む地域（資料の生活圏 45）。airports ＝ その地域の空港
 * TOWNS     … 街（102）。bed1・bed2・bed3 ＝ 1〜3寝室の月の家賃（USD）。near ＝ 通いやすい空港。offers ＝ 3寝室の戸建ての掲載例（2026-11-02 に見た・成約ではない）
 * COMPANIES … 会社ごとの拠点の空港（資料の並び）と、出す地域の並び（拠点の順）
 */
export const AS_OF = '2026-10-01';
export const SEEN = '2026-11-02';
export const SRC = Object.freeze({
  name: '米国住宅都市開発省（HUD）「Small Area Fair Market Rents（FY2027）」',
  name_en: 'U.S. Department of Housing and Urban Development (HUD), "Small Area Fair Market Rents (FY2027)"',
  url: 'https://www.huduser.gov/portal/datasets/fmr/smallarea/index.html',
});
/* ★2026-11-03 北米追加20社（ChatGPT の調べ・2026-11-02 基準）。カナダの地域（cc: 'CA'）の家賃は、カナダ住宅金融公社（CMHC）の
   賃貸市場調査（2025年10月の調査・2025年12月公表）── 調査区ごとの、民間の賃貸アパートでいま住んでいる人が払っている家賃の平均。
   3寝室（bed3）は3寝室以上。信頼度 d（慎重に扱う）と伏せた値は null（画面は「—」）。カナダの街は zone ＝ 調査区の名前（zip は無い）。
   作り直し：scratchpad の make-na-housing.mjs（リポジトリの外）。 */
export const SRC_CA = Object.freeze({
  name: 'カナダ住宅金融公社（CMHC）「賃貸市場調査（2025年10月）」',
  name_en: 'Canada Mortgage and Housing Corporation (CMHC), "Rental Market Survey (October 2025)"',
  url: 'https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-data/data-tables/rental-market/rental-market-report-data-tables',
});
export const NA20 = Object.freeze({"regions":["CAK","PVD","RSW","VRB","CHS","ORF","BDL","PVU","MSY","HVN","ILG","LAL","USA","STL","HNL","HPN","YYZ","YUL","YVR","YWG","YYC","YEG","YOW"],"towns":["us-green","us-hudson","us-warwick","us-east-greenwich","us-estero","us-bonita-springs","us-vero-beach","us-indian-river-shores","us-summerville","us-mount-pleasant","us-chesapeake-greenbrier","us-virginia-beach","us-windsor-locks","us-glastonbury","us-lehi","us-alpine","us-kenner","us-mandeville","us-branford","us-madison","us-newark-delaware","us-greenville-delaware","us-south-lakeland","us-lake-hollingsworth","us-concord","us-st-charles","us-chesterfield","us-aiea","us-kailua-oahu","us-harrison","us-scarsdale","ca-etobicoke-central","ca-mississauga-northwest","ca-oakville","ca-markham","ca-richmond-hill-vaughan-king","ca-dorval-lachine-saint-pierre","ca-beaconsfield-baie-d-urfe","ca-saint-laurent","ca-mount-royal-outremont","ca-richmond","ca-kitsilano-point-grey","ca-kerrisdale-westside","ca-west-vancouver","ca-north-vancouver-district","ca-st-james","ca-assiniboine-park","ca-fort-garry","ca-st-vital","ca-calgary-northeast","ca-calgary-northwest","ca-calgary-southwest","ca-airdrie-cochrane","ca-leduc","ca-edmonton-southwest","ca-st-albert","ca-strathcona-county","ca-hunt-club-south-keys","ca-nepean","ca-glebe-old-ottawa-south","ca-ottawa"],"companies":["breeze-airways","avelo-airlines","gojet","northern-air-cargo","contour","air-canada","westjet","jazz","porter"]});
export const REGIONS = Object.freeze({
 "ATL": {
  "ja": "アトランタ",
  "en": "Atlanta",
  "airports": [
   "ATL"
  ]
 },
 "BOS": {
  "ja": "ボストン",
  "en": "Boston",
  "airports": [
   "BOS"
  ]
 },
 "DTW": {
  "ja": "デトロイト",
  "en": "Detroit",
  "airports": [
   "DTW"
  ]
 },
 "LAX": {
  "ja": "ロサンゼルス",
  "en": "Los Angeles",
  "airports": [
   "LAX"
  ]
 },
 "MSP": {
  "ja": "ミネアポリス・セントポール",
  "en": "Minneapolis–St. Paul",
  "airports": [
   "MSP"
  ]
 },
 "NYC": {
  "ja": "ニューヨーク・ニュージャージー",
  "en": "New York / New Jersey",
  "airports": [
   "JFK",
   "LGA",
   "EWR"
  ]
 },
 "SLC": {
  "ja": "ソルトレイクシティ",
  "en": "Salt Lake City",
  "airports": [
   "SLC"
  ]
 },
 "SEA": {
  "ja": "シアトル・エバレット",
  "en": "Seattle / Everett",
  "airports": [
   "SEA",
   "PAE"
  ]
 },
 "CHI": {
  "ja": "シカゴ",
  "en": "Chicago",
  "airports": [
   "ORD",
   "MDW"
  ]
 },
 "DEN": {
  "ja": "デンバー",
  "en": "Denver",
  "airports": [
   "DEN"
  ]
 },
 "LAS": {
  "ja": "ラスベガス",
  "en": "Las Vegas",
  "airports": [
   "LAS"
  ]
 },
 "HOU": {
  "ja": "ヒューストン",
  "en": "Houston",
  "airports": [
   "IAH",
   "HOU"
  ]
 },
 "DC": {
  "ja": "ワシントンD.C.",
  "en": "Washington, D.C.",
  "airports": [
   "IAD",
   "DCA"
  ]
 },
 "ORL": {
  "ja": "オーランド・サンフォード",
  "en": "Orlando / Sanford",
  "airports": [
   "MCO",
   "SFB"
  ]
 },
 "DFW": {
  "ja": "ダラス・フォートワース",
  "en": "Dallas–Fort Worth",
  "airports": [
   "DFW",
   "DAL"
  ]
 },
 "CLT": {
  "ja": "シャーロット",
  "en": "Charlotte",
  "airports": [
   "CLT"
  ]
 },
 "MIA": {
  "ja": "マイアミ",
  "en": "Miami",
  "airports": [
   "MIA"
  ]
 },
 "PHL": {
  "ja": "フィラデルフィア",
  "en": "Philadelphia",
  "airports": [
   "PHL"
  ]
 },
 "FLL": {
  "ja": "フォートローダーデール",
  "en": "Fort Lauderdale",
  "airports": [
   "FLL"
  ]
 },
 "PHX": {
  "ja": "フェニックス・メサ",
  "en": "Phoenix / Mesa",
  "airports": [
   "PHX",
   "IWA"
  ]
 },
 "AUS": {
  "ja": "オースティン",
  "en": "Austin",
  "airports": [
   "AUS"
  ]
 },
 "BWI": {
  "ja": "ボルチモア",
  "en": "Baltimore",
  "airports": [
   "BWI"
  ]
 },
 "BNA": {
  "ja": "ナッシュビル",
  "en": "Nashville",
  "airports": [
   "BNA"
  ]
 },
 "BAY": {
  "ja": "サンフランシスコ・ベイエリア",
  "en": "San Francisco Bay Area",
  "airports": [
   "SFO",
   "OAK"
  ]
 },
 "ANC": {
  "ja": "アンカレッジ",
  "en": "Anchorage",
  "airports": [
   "ANC"
  ]
 },
 "PDX": {
  "ja": "ポートランド",
  "en": "Portland",
  "airports": [
   "PDX"
  ]
 },
 "SAN": {
  "ja": "サンディエゴ",
  "en": "San Diego",
  "airports": [
   "SAN"
  ]
 },
 "CVG": {
  "ja": "シンシナティ・北ケンタッキー",
  "en": "Cincinnati / Northern Kentucky",
  "airports": [
   "CVG"
  ]
 },
 "CLE": {
  "ja": "クリーブランド",
  "en": "Cleveland",
  "airports": [
   "CLE"
  ]
 },
 "SJU": {
  "ja": "サンフアン",
  "en": "San Juan",
  "airports": [
   "SJU"
  ]
 },
 "TPA": {
  "ja": "タンパ・セントピーターズバーグ",
  "en": "Tampa / St. Petersburg",
  "airports": [
   "TPA",
   "PIE"
  ]
 },
 "PGD": {
  "ja": "プンタゴルダ",
  "en": "Punta Gorda",
  "airports": [
   "PGD"
  ]
 },
 "MEM": {
  "ja": "メンフィス",
  "en": "Memphis",
  "airports": [
   "MEM"
  ]
 },
 "IND": {
  "ja": "インディアナポリス",
  "en": "Indianapolis",
  "airports": [
   "IND"
  ]
 },
 "SDF": {
  "ja": "ルイビル",
  "en": "Louisville",
  "airports": [
   "SDF"
  ]
 },
 "ONT": {
  "ja": "オンタリオ（インランド・エンパイア）",
  "en": "Ontario (Inland Empire)",
  "airports": [
   "ONT"
  ]
 },
 "CMH": {
  "ja": "コロンバス",
  "en": "Columbus",
  "airports": [
   "CMH"
  ]
 },
 "PIT": {
  "ja": "ピッツバーグ",
  "en": "Pittsburgh",
  "airports": [
   "PIT"
  ]
 },
 "RDU": {
  "ja": "ローリー・ダーラム",
  "en": "Raleigh–Durham",
  "airports": [
   "RDU"
  ]
 },
 "DAY": {
  "ja": "デイトン",
  "en": "Dayton",
  "airports": [
   "DAY"
  ]
 },
 "MDT": {
  "ja": "ハリスバーグ",
  "en": "Harrisburg",
  "airports": [
   "MDT"
  ]
 },
 "BOI": {
  "ja": "ボイシ",
  "en": "Boise",
  "airports": [
   "BOI"
  ]
 },
 "GEG": {
  "ja": "スポケーン",
  "en": "Spokane",
  "airports": [
   "GEG"
  ]
 },
 "ABE": {
  "ja": "リーハイバレー",
  "en": "Lehigh Valley",
  "airports": [
   "ABE"
  ]
 },
 "YIP": {
  "ja": "イプシランティ・アナーバー",
  "en": "Ypsilanti / Ann Arbor",
  "airports": [
   "YIP"
  ]
 },
 "CAK": {
  "ja": "アクロン・カントン",
  "en": "Akron–Canton",
  "airports": [
   "CAK"
  ]
 },
 "PVD": {
  "ja": "プロビデンス",
  "en": "Providence",
  "airports": [
   "PVD"
  ]
 },
 "RSW": {
  "ja": "フォートマイヤーズ",
  "en": "Fort Myers",
  "airports": [
   "RSW"
  ]
 },
 "VRB": {
  "ja": "ベロビーチ",
  "en": "Vero Beach",
  "airports": [
   "VRB"
  ]
 },
 "CHS": {
  "ja": "チャールストン",
  "en": "Charleston",
  "airports": [
   "CHS"
  ]
 },
 "ORF": {
  "ja": "ノーフォーク",
  "en": "Norfolk",
  "airports": [
   "ORF"
  ]
 },
 "BDL": {
  "ja": "ハートフォード",
  "en": "Hartford",
  "airports": [
   "BDL"
  ]
 },
 "PVU": {
  "ja": "プロボ",
  "en": "Provo",
  "airports": [
   "PVU"
  ]
 },
 "MSY": {
  "ja": "ニューオーリンズ",
  "en": "New Orleans",
  "airports": [
   "MSY"
  ]
 },
 "HVN": {
  "ja": "ニューヘイブン",
  "en": "New Haven",
  "airports": [
   "HVN"
  ]
 },
 "ILG": {
  "ja": "ウィルミントン（デラウェア州）",
  "en": "Wilmington, DE",
  "airports": [
   "ILG"
  ]
 },
 "LAL": {
  "ja": "レイクランド",
  "en": "Lakeland",
  "airports": [
   "LAL"
  ]
 },
 "USA": {
  "ja": "コンコード（ノースカロライナ州）",
  "en": "Concord, NC",
  "airports": [
   "USA"
  ]
 },
 "STL": {
  "ja": "セントルイス",
  "en": "St. Louis",
  "airports": [
   "STL"
  ]
 },
 "HNL": {
  "ja": "ホノルル",
  "en": "Honolulu",
  "airports": [
   "HNL"
  ]
 },
 "HPN": {
  "ja": "ウエストチェスター",
  "en": "Westchester",
  "airports": [
   "HPN"
  ]
 },
 "YYZ": {
  "ja": "トロント",
  "en": "Toronto",
  "airports": [
   "YYZ",
   "YTZ"
  ],
  "cc": "CA",
  "cur": "CAD"
 },
 "YUL": {
  "ja": "モントリオール",
  "en": "Montréal",
  "airports": [
   "YUL"
  ],
  "cc": "CA",
  "cur": "CAD"
 },
 "YVR": {
  "ja": "バンクーバー",
  "en": "Vancouver",
  "airports": [
   "YVR"
  ],
  "cc": "CA",
  "cur": "CAD"
 },
 "YWG": {
  "ja": "ウィニペグ",
  "en": "Winnipeg",
  "airports": [
   "YWG"
  ],
  "cc": "CA",
  "cur": "CAD"
 },
 "YYC": {
  "ja": "カルガリー",
  "en": "Calgary",
  "airports": [
   "YYC"
  ],
  "cc": "CA",
  "cur": "CAD"
 },
 "YEG": {
  "ja": "エドモントン",
  "en": "Edmonton",
  "airports": [
   "YEG"
  ],
  "cc": "CA",
  "cur": "CAD"
 },
 "YOW": {
  "ja": "オタワ",
  "en": "Ottawa",
  "airports": [
   "YOW"
  ],
  "cc": "CA",
  "cur": "CAD"
 }
});
export const TOWNS = Object.freeze({
 "us-peachtree-city": {
  "region": "ATL",
  "ja": "ピーチツリーシティ",
  "en": "Peachtree City",
  "state": "GA",
  "zip": "30269",
  "bed1": 1990,
  "bed2": 2170,
  "bed3": 2590,
  "near": [
   "ATL"
  ],
  "income": 113987,
  "incomeTop": false,
  "offers": [
   {
    "rent": 3000,
    "beds": 3,
    "baths": 2.5,
    "sqft": 1900,
    "seen": "2026-11-02"
   },
   {
    "rent": 2195,
    "beds": 3,
    "baths": 2,
    "sqft": 1404,
    "seen": "2026-11-02"
   },
   {
    "rent": 2175,
    "beds": 3,
    "baths": 2.5,
    "sqft": 1400,
    "seen": "2026-11-02"
   }
  ]
 },
 "us-newnan": {
  "region": "ATL",
  "ja": "ニューナン",
  "en": "Newnan",
  "state": "GA",
  "zip": "30265",
  "bed1": 1700,
  "bed2": 1850,
  "bed3": 2200,
  "near": [
   "ATL"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-johns-creek": {
  "region": "ATL",
  "ja": "ジョンズクリーク",
  "en": "Johns Creek",
  "state": "GA",
  "zip": "30097",
  "bed1": 1920,
  "bed2": 2090,
  "bed3": 2490,
  "near": [
   "ATL"
  ],
  "income": 160093,
  "incomeTop": false,
  "offers": []
 },
 "us-braintree": {
  "region": "BOS",
  "ja": "ブレインツリー",
  "en": "Braintree",
  "state": "MA",
  "zip": "02184",
  "bed1": 2390,
  "bed2": 2860,
  "bed3": 3410,
  "near": [
   "BOS"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-wellesley": {
  "region": "BOS",
  "ja": "ウェルズリー",
  "en": "Wellesley",
  "state": "MA",
  "zip": "02481",
  "bed1": 3480,
  "bed2": 4160,
  "bed3": 4960,
  "near": [
   "BOS"
  ],
  "income": 250000,
  "incomeTop": true,
  "offers": []
 },
 "us-plymouth-area": {
  "region": "DTW",
  "ja": "プリマス周辺",
  "en": "Plymouth area",
  "state": "MI",
  "zip": "48170",
  "bed1": 1260,
  "bed2": 1570,
  "bed3": 1910,
  "near": [
   "DTW"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-northville-area": {
  "region": "DTW",
  "ja": "ノースビル周辺",
  "en": "Northville area",
  "state": "MI",
  "zip": "48167",
  "bed1": 1560,
  "bed2": 1950,
  "bed3": 2370,
  "near": [
   "DTW"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-bloomfield-hills-area": {
  "region": "DTW",
  "ja": "ブルームフィールドヒルズ周辺",
  "en": "Bloomfield Hills area",
  "state": "MI",
  "zip": "48304",
  "bed1": 1480,
  "bed2": 1850,
  "bed3": 2250,
  "near": [
   "DTW"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-el-segundo": {
  "region": "LAX",
  "ja": "エルセグンド",
  "en": "El Segundo",
  "state": "CA",
  "zip": "90245",
  "bed1": 3440,
  "bed2": 4250,
  "bed3": 5390,
  "near": [
   "LAX"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-manhattan-beach": {
  "region": "LAX",
  "ja": "マンハッタンビーチ",
  "en": "Manhattan Beach",
  "state": "CA",
  "zip": "90266",
  "bed1": 3610,
  "bed2": 4450,
  "bed3": 5650,
  "near": [
   "LAX"
  ],
  "income": 204306,
  "incomeTop": false,
  "offers": [
   {
    "rent": 7000,
    "beds": 3,
    "baths": 2,
    "sqft": 1080,
    "seen": "2026-11-02"
   },
   {
    "rent": 7900,
    "beds": 3,
    "baths": 2,
    "sqft": 1400,
    "seen": "2026-11-02"
   },
   {
    "rent": 18000,
    "beds": 3,
    "baths": 3.5,
    "sqft": 1831,
    "seen": "2026-11-02"
   }
  ]
 },
 "us-eagan": {
  "region": "MSP",
  "ja": "イーガン",
  "en": "Eagan",
  "state": "MN",
  "zip": "55122",
  "bed1": 1510,
  "bed2": 1840,
  "bed3": 2400,
  "near": [
   "MSP"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-edina": {
  "region": "MSP",
  "ja": "エダイナ",
  "en": "Edina",
  "state": "MN",
  "zip": "55424",
  "bed1": 1880,
  "bed2": 2290,
  "bed3": 2990,
  "near": [
   "MSP"
  ],
  "income": 128767,
  "incomeTop": false,
  "offers": []
 },
 "us-garden-city": {
  "region": "NYC",
  "ja": "ガーデンシティ",
  "en": "Garden City",
  "state": "NY",
  "zip": "11530",
  "bed1": 2730,
  "bed2": 3150,
  "bed3": 4080,
  "near": [
   "JFK",
   "LGA"
  ],
  "income": 244152,
  "incomeTop": false,
  "offers": []
 },
 "us-manhasset": {
  "region": "NYC",
  "ja": "マンハセット",
  "en": "Manhasset",
  "state": "NY",
  "zip": "11030",
  "bed1": 2350,
  "bed2": 2710,
  "bed3": 3510,
  "near": [
   "LGA",
   "JFK"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-chatham": {
  "region": "NYC",
  "ja": "チャタム",
  "en": "Chatham",
  "state": "NJ",
  "zip": "07928",
  "bed1": 2690,
  "bed2": 3250,
  "bed3": 4050,
  "near": [
   "EWR"
  ],
  "income": 241500,
  "incomeTop": false,
  "offers": []
 },
 "us-bountiful": {
  "region": "SLC",
  "ja": "バウンティフル",
  "en": "Bountiful",
  "state": "UT",
  "zip": "84010",
  "bed1": 1290,
  "bed2": 1640,
  "bed3": 2200,
  "near": [
   "SLC"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-park-city": {
  "region": "SLC",
  "ja": "パークシティ",
  "en": "Park City",
  "state": "UT",
  "zip": "84060",
  "bed1": 1880,
  "bed2": 2130,
  "bed3": 2860,
  "near": [
   "SLC"
  ],
  "income": 133558,
  "incomeTop": false,
  "offers": []
 },
 "us-burien": {
  "region": "SEA",
  "ja": "ブリエン",
  "en": "Burien",
  "state": "WA",
  "zip": "98166",
  "bed1": 1920,
  "bed2": 2240,
  "bed3": 2920,
  "near": [
   "SEA"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-mercer-island": {
  "region": "SEA",
  "ja": "マーサーアイランド",
  "en": "Mercer Island",
  "state": "WA",
  "zip": "98040",
  "bed1": 2570,
  "bed2": 3010,
  "bed3": 3920,
  "near": [
   "SEA"
  ],
  "income": 219069,
  "incomeTop": false,
  "offers": [
   {
    "rent": 6600,
    "beds": 3,
    "baths": 3,
    "sqft": 2233,
    "seen": "2026-11-02"
   },
   {
    "rent": 3880,
    "beds": 3,
    "baths": 2,
    "sqft": 1350,
    "seen": "2026-11-02"
   },
   {
    "rent": 4800,
    "beds": 3,
    "baths": 2,
    "sqft": 2120,
    "seen": "2026-11-02"
   }
  ]
 },
 "us-mukilteo": {
  "region": "SEA",
  "ja": "マキルテオ",
  "en": "Mukilteo",
  "state": "WA",
  "zip": "98275",
  "bed1": 2220,
  "bed2": 2600,
  "bed3": 3390,
  "near": [
   "PAE"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-park-ridge": {
  "region": "CHI",
  "ja": "パークリッジ",
  "en": "Park Ridge",
  "state": "IL",
  "zip": "60068",
  "bed1": 1850,
  "bed2": 2090,
  "bed3": 2690,
  "near": [
   "ORD"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-hinsdale": {
  "region": "CHI",
  "ja": "ヒンズデール",
  "en": "Hinsdale",
  "state": "IL",
  "zip": "60521",
  "bed1": 2360,
  "bed2": 2670,
  "bed3": 3430,
  "near": [
   "ORD",
   "MDW"
  ],
  "income": 250000,
  "incomeTop": true,
  "offers": [
   {
    "rent": 3395,
    "beds": 3,
    "baths": 2,
    "sqft": null,
    "seen": "2026-11-02"
   },
   {
    "rent": 6000,
    "beds": 3,
    "baths": 2,
    "sqft": 2120,
    "seen": "2026-11-02"
   },
   {
    "rent": 3200,
    "beds": 3,
    "baths": 2,
    "sqft": 1630,
    "seen": "2026-11-02"
   }
  ]
 },
 "us-oak-lawn": {
  "region": "CHI",
  "ja": "オークローン",
  "en": "Oak Lawn",
  "state": "IL",
  "zip": "60453",
  "bed1": 1640,
  "bed2": 1850,
  "bed3": 2380,
  "near": [
   "MDW"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-reunion-commerce-city-area": {
  "region": "DEN",
  "ja": "コマースシティ（リユニオン）周辺",
  "en": "Reunion, Commerce City area",
  "state": "CO",
  "zip": "80022",
  "bed1": 1600,
  "bed2": 1890,
  "bed3": 2480,
  "near": [
   "DEN"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-greenwood-village": {
  "region": "DEN",
  "ja": "グリーンウッドビレッジ",
  "en": "Greenwood Village",
  "state": "CO",
  "zip": "80111",
  "bed1": 2190,
  "bed2": 2590,
  "bed3": 3400,
  "near": [
   "DEN"
  ],
  "income": 149029,
  "incomeTop": false,
  "offers": []
 },
 "us-summerlin-south-area": {
  "region": "LAS",
  "ja": "サマーリン南部周辺",
  "en": "Summerlin South area",
  "state": "NV",
  "zip": "89135",
  "bed1": 2150,
  "bed2": 2530,
  "bed3": 3480,
  "near": [
   "LAS"
  ],
  "income": 117035,
  "incomeTop": false,
  "offers": []
 },
 "us-anthem-henderson-area": {
  "region": "LAS",
  "ja": "ヘンダーソン（アンセム）周辺",
  "en": "Anthem, Henderson area",
  "state": "NV",
  "zip": "89052",
  "bed1": 1790,
  "bed2": 2100,
  "bed3": 2890,
  "near": [
   "LAS"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-humble-area": {
  "region": "HOU",
  "ja": "ハンブル周辺",
  "en": "Humble area",
  "state": "TX",
  "zip": "77338",
  "bed1": 1240,
  "bed2": 1470,
  "bed3": 1980,
  "near": [
   "IAH"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-the-woodlands": {
  "region": "HOU",
  "ja": "ザ・ウッドランズ",
  "en": "The Woodlands",
  "state": "TX",
  "zip": "77380",
  "bed1": 1610,
  "bed2": 1910,
  "bed3": 2570,
  "near": [
   "IAH"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-west-university-place": {
  "region": "HOU",
  "ja": "ウエストユニバーシティプレイス",
  "en": "West University Place",
  "state": "TX",
  "zip": "77005",
  "bed1": 1880,
  "bed2": 2230,
  "bed3": 3010,
  "near": [
   "HOU",
   "IAH"
  ],
  "income": 250000,
  "incomeTop": true,
  "offers": []
 },
 "us-herndon": {
  "region": "DC",
  "ja": "ハーンドン",
  "en": "Herndon",
  "state": "VA",
  "zip": "20170",
  "bed1": 2460,
  "bed2": 2720,
  "bed3": 3470,
  "near": [
   "IAD"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-vienna": {
  "region": "DC",
  "ja": "ビエナ",
  "en": "Vienna",
  "state": "VA",
  "zip": "22180",
  "bed1": 2560,
  "bed2": 2830,
  "bed3": 3610,
  "near": [
   "IAD",
   "DCA"
  ],
  "income": 216953,
  "incomeTop": false,
  "offers": []
 },
 "us-alexandria": {
  "region": "DC",
  "ja": "アレクサンドリア",
  "en": "Alexandria",
  "state": "VA",
  "zip": "22301",
  "bed1": 2630,
  "bed2": 2910,
  "bed3": 3710,
  "near": [
   "DCA"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-lake-nona-area": {
  "region": "ORL",
  "ja": "レイクノナ周辺",
  "en": "Lake Nona area",
  "state": "FL",
  "zip": "32827",
  "bed1": 2280,
  "bed2": 2590,
  "bed3": 3230,
  "near": [
   "MCO"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-winter-park": {
  "region": "ORL",
  "ja": "ウィンターパーク",
  "en": "Winter Park",
  "state": "FL",
  "zip": "32789",
  "bed1": 1760,
  "bed2": 2000,
  "bed3": 2500,
  "near": [
   "MCO",
   "SFB"
  ],
  "income": 105724,
  "incomeTop": false,
  "offers": []
 },
 "us-lake-mary": {
  "region": "ORL",
  "ja": "レイクメアリー",
  "en": "Lake Mary",
  "state": "FL",
  "zip": "32746",
  "bed1": 2010,
  "bed2": 2280,
  "bed3": 2850,
  "near": [
   "SFB"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-grapevine": {
  "region": "DFW",
  "ja": "グレープバイン",
  "en": "Grapevine",
  "state": "TX",
  "zip": "76051",
  "bed1": 1950,
  "bed2": 2300,
  "bed3": 3010,
  "near": [
   "DFW"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-southlake": {
  "region": "DFW",
  "ja": "サウスレイク",
  "en": "Southlake",
  "state": "TX",
  "zip": "76092",
  "bed1": 1910,
  "bed2": 2250,
  "bed3": 2910,
  "near": [
   "DFW"
  ],
  "income": 250000,
  "incomeTop": true,
  "offers": [
   {
    "rent": 5000,
    "beds": 3,
    "baths": 2.5,
    "sqft": 2628,
    "seen": "2026-11-02"
   },
   {
    "rent": 3100,
    "beds": 3,
    "baths": 2,
    "sqft": 1816,
    "seen": "2026-11-02"
   }
  ]
 },
 "us-highland-park-area": {
  "region": "DFW",
  "ja": "ハイランドパーク周辺",
  "en": "Highland Park area",
  "state": "TX",
  "zip": "75205",
  "bed1": 2300,
  "bed2": 2710,
  "bed3": 3410,
  "near": [
   "DAL"
  ],
  "income": 250000,
  "incomeTop": true,
  "offers": []
 },
 "us-belmont": {
  "region": "CLT",
  "ja": "ベルモント",
  "en": "Belmont",
  "state": "NC",
  "zip": "28012",
  "bed1": 1470,
  "bed2": 1600,
  "bed3": 1950,
  "near": [
   "CLT"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-davidson": {
  "region": "CLT",
  "ja": "デビッドソン",
  "en": "Davidson",
  "state": "NC",
  "zip": "28036",
  "bed1": 1880,
  "bed2": 2040,
  "bed3": 2510,
  "near": [
   "CLT"
  ],
  "income": 166556,
  "incomeTop": false,
  "offers": [
   {
    "rent": 2400,
    "beds": 3,
    "baths": 2,
    "sqft": 2528,
    "seen": "2026-11-02"
   },
   {
    "rent": 2880,
    "beds": 3,
    "baths": 2.5,
    "sqft": 2418,
    "seen": "2026-11-02"
   },
   {
    "rent": 2225,
    "beds": 3,
    "baths": 3.5,
    "sqft": 1935,
    "seen": "2026-11-02"
   }
  ]
 },
 "us-doral": {
  "region": "MIA",
  "ja": "ドラル",
  "en": "Doral",
  "state": "FL",
  "zip": "33178",
  "bed1": 3120,
  "bed2": 3770,
  "bed3": 4820,
  "near": [
   "MIA"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-pinecrest": {
  "region": "MIA",
  "ja": "パインクレスト",
  "en": "Pinecrest",
  "state": "FL",
  "zip": "33156",
  "bed1": 2330,
  "bed2": 2820,
  "bed3": 3600,
  "near": [
   "MIA"
  ],
  "income": 206417,
  "incomeTop": false,
  "offers": [
   {
    "rent": 7150,
    "beds": 3,
    "baths": 2,
    "sqft": 2247,
    "seen": "2026-11-02"
   },
   {
    "rent": 4600,
    "beds": 3,
    "baths": 2,
    "sqft": 1649,
    "seen": "2026-11-02"
   },
   {
    "rent": 6995,
    "beds": 3,
    "baths": 2,
    "sqft": 2403,
    "seen": "2026-11-02"
   }
  ]
 },
 "us-bala-cynwyd-lower-merion-area": {
  "region": "PHL",
  "ja": "ローワーメリオン（バラキンウッド）周辺",
  "en": "Bala Cynwyd, Lower Merion area",
  "state": "PA",
  "zip": "19004",
  "bed1": 1930,
  "bed2": 2300,
  "bed3": 2740,
  "near": [
   "PHL"
  ],
  "income": 176512,
  "incomeTop": false,
  "offers": []
 },
 "us-media-area": {
  "region": "PHL",
  "ja": "メディア周辺",
  "en": "Media area",
  "state": "PA",
  "zip": "19063",
  "bed1": 1630,
  "bed2": 1950,
  "bed3": 2320,
  "near": [
   "PHL"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-davie": {
  "region": "FLL",
  "ja": "デイビー",
  "en": "Davie",
  "state": "FL",
  "zip": "33324",
  "bed1": 2320,
  "bed2": 2830,
  "bed3": 3870,
  "near": [
   "FLL"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-weston": {
  "region": "FLL",
  "ja": "ウェストン",
  "en": "Weston",
  "state": "FL",
  "zip": "33326",
  "bed1": 2510,
  "bed2": 3060,
  "bed3": 4180,
  "near": [
   "FLL"
  ],
  "income": 139825,
  "incomeTop": false,
  "offers": []
 },
 "us-chandler": {
  "region": "PHX",
  "ja": "チャンドラー",
  "en": "Chandler",
  "state": "AZ",
  "zip": "85286",
  "bed1": 1910,
  "bed2": 2220,
  "bed3": 2930,
  "near": [
   "PHX",
   "IWA"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-scottsdale": {
  "region": "PHX",
  "ja": "スコッツデール",
  "en": "Scottsdale",
  "state": "AZ",
  "zip": "85254",
  "bed1": 1860,
  "bed2": 2160,
  "bed3": 2880,
  "near": [
   "PHX"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-paradise-valley": {
  "region": "PHX",
  "ja": "パラダイスバレー",
  "en": "Paradise Valley",
  "state": "AZ",
  "zip": "85253",
  "bed1": 1940,
  "bed2": 2250,
  "bed3": 3030,
  "near": [
   "PHX"
  ],
  "income": 247159,
  "incomeTop": false,
  "offers": []
 },
 "us-buda": {
  "region": "AUS",
  "ja": "ビューダ",
  "en": "Buda",
  "state": "TX",
  "zip": "78610",
  "bed1": 1590,
  "bed2": 1890,
  "bed3": 2380,
  "near": [
   "AUS"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-lakeway": {
  "region": "AUS",
  "ja": "レイクウェイ",
  "en": "Lakeway",
  "state": "TX",
  "zip": "78734",
  "bed1": 1780,
  "bed2": 2110,
  "bed3": 2660,
  "near": [
   "AUS"
  ],
  "income": 190060,
  "incomeTop": false,
  "offers": []
 },
 "us-ellicott-city": {
  "region": "BWI",
  "ja": "エリコットシティ",
  "en": "Ellicott City",
  "state": "MD",
  "zip": "21043",
  "bed1": 2010,
  "bed2": 2480,
  "bed3": 3100,
  "near": [
   "BWI"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-severna-park": {
  "region": "BWI",
  "ja": "セバーナパーク",
  "en": "Severna Park",
  "state": "MD",
  "zip": "21146",
  "bed1": 1850,
  "bed2": 2290,
  "bed3": 2860,
  "near": [
   "BWI"
  ],
  "income": 169953,
  "incomeTop": false,
  "offers": []
 },
 "us-mount-juliet": {
  "region": "BNA",
  "ja": "マウントジュリエット",
  "en": "Mount Juliet",
  "state": "TN",
  "zip": "37122",
  "bed1": 2090,
  "bed2": 2280,
  "bed3": 2930,
  "near": [
   "BNA"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-brentwood": {
  "region": "BNA",
  "ja": "ブレントウッド",
  "en": "Brentwood",
  "state": "TN",
  "zip": "37027",
  "bed1": 2290,
  "bed2": 2500,
  "bed3": 3210,
  "near": [
   "BNA"
  ],
  "income": 182088,
  "incomeTop": false,
  "offers": []
 },
 "us-san-mateo": {
  "region": "BAY",
  "ja": "サンマテオ",
  "en": "San Mateo",
  "state": "CA",
  "zip": "94402",
  "bed1": 3360,
  "bed2": 4070,
  "bed3": 5200,
  "near": [
   "SFO"
  ],
  "income": 153504,
  "incomeTop": false,
  "offers": []
 },
 "us-burlingame": {
  "region": "BAY",
  "ja": "バーリンゲーム",
  "en": "Burlingame",
  "state": "CA",
  "zip": "94010",
  "bed1": 3150,
  "bed2": 3880,
  "bed3": 5070,
  "near": [
   "SFO"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-alameda": {
  "region": "BAY",
  "ja": "アラメダ",
  "en": "Alameda",
  "state": "CA",
  "zip": "94502",
  "bed1": 2520,
  "bed2": 3060,
  "bed3": 3900,
  "near": [
   "OAK"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-south-anchorage-hillside": {
  "region": "ANC",
  "ja": "サウスアンカレッジ・ヒルサイド",
  "en": "South Anchorage Hillside",
  "state": "AK",
  "zip": "99516",
  "bed1": 1420,
  "bed2": 1860,
  "bed3": 2580,
  "near": [
   "ANC"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-eagle-river": {
  "region": "ANC",
  "ja": "イーグルリバー",
  "en": "Eagle River",
  "state": "AK",
  "zip": "99577",
  "bed1": 1400,
  "bed2": 1830,
  "bed3": 2540,
  "near": [
   "ANC"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-vancouver-wa": {
  "region": "PDX",
  "ja": "バンクーバー（ワシントン州）",
  "en": "Vancouver, WA",
  "state": "WA",
  "zip": "98660",
  "bed1": 1510,
  "bed2": 1730,
  "bed3": 2360,
  "near": [
   "PDX"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-lake-oswego": {
  "region": "PDX",
  "ja": "レイクオスウィーゴ",
  "en": "Lake Oswego",
  "state": "OR",
  "zip": "97034",
  "bed1": 1960,
  "bed2": 2250,
  "bed3": 3060,
  "near": [
   "PDX"
  ],
  "income": 141549,
  "incomeTop": false,
  "offers": []
 },
 "us-chula-vista": {
  "region": "SAN",
  "ja": "チュラビスタ",
  "en": "Chula Vista",
  "state": "CA",
  "zip": "91910",
  "bed1": 2140,
  "bed2": 2590,
  "bed3": 3430,
  "near": [
   "SAN"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-coronado": {
  "region": "SAN",
  "ja": "コロナド",
  "en": "Coronado",
  "state": "CA",
  "zip": "92118",
  "bed1": 3500,
  "bed2": 4230,
  "bed3": 5610,
  "near": [
   "SAN"
  ],
  "income": 134534,
  "incomeTop": false,
  "offers": []
 },
 "us-hebron": {
  "region": "CVG",
  "ja": "ヘブロン",
  "en": "Hebron",
  "state": "KY",
  "zip": "41048",
  "bed1": 1430,
  "bed2": 1830,
  "bed3": 2410,
  "near": [
   "CVG"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-fort-mitchell": {
  "region": "CVG",
  "ja": "フォートミッチェル",
  "en": "Fort Mitchell",
  "state": "KY",
  "zip": "41017",
  "bed1": 1030,
  "bed2": 1320,
  "bed3": 1740,
  "near": [
   "CVG"
  ],
  "income": null,
  "incomeTop": false,
  "offers": [
   {
    "rent": 2400,
    "beds": 3,
    "baths": 2,
    "sqft": 2400,
    "seen": "2026-11-02"
   }
  ]
 },
 "us-indian-hill": {
  "region": "CVG",
  "ja": "インディアンヒル",
  "en": "Indian Hill",
  "state": "OH",
  "zip": "45243",
  "bed1": 1690,
  "bed2": 2160,
  "bed3": 2840,
  "near": [
   "CVG"
  ],
  "income": 234821,
  "incomeTop": false,
  "offers": []
 },
 "us-berea": {
  "region": "CLE",
  "ja": "ベリア",
  "en": "Berea",
  "state": "OH",
  "zip": "44017",
  "bed1": 1050,
  "bed2": 1270,
  "bed3": 1620,
  "near": [
   "CLE"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-solon": {
  "region": "CLE",
  "ja": "ソロン",
  "en": "Solon",
  "state": "OH",
  "zip": "44139",
  "bed1": 1520,
  "bed2": 1840,
  "bed3": 2350,
  "near": [
   "CLE"
  ],
  "income": 139089,
  "incomeTop": false,
  "offers": []
 },
 "us-guaynabo-area": {
  "region": "SJU",
  "ja": "グアイナボ周辺",
  "en": "Guaynabo area",
  "state": "PR",
  "zip": "00966",
  "bed1": 910,
  "bed2": 1060,
  "bed3": 1380,
  "near": [
   "SJU"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-dorado-area": {
  "region": "SJU",
  "ja": "ドラド周辺",
  "en": "Dorado area",
  "state": "PR",
  "zip": "00646",
  "bed1": 640,
  "bed2": 750,
  "bed3": 980,
  "near": [
   "SJU"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-westchase-area": {
  "region": "TPA",
  "ja": "ウエストチェイス周辺",
  "en": "Westchase area",
  "state": "FL",
  "zip": "33626",
  "bed1": 2250,
  "bed2": 2620,
  "bed3": 3350,
  "near": [
   "TPA"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-safety-harbor": {
  "region": "TPA",
  "ja": "セーフティハーバー",
  "en": "Safety Harbor",
  "state": "FL",
  "zip": "34695",
  "bed1": 1830,
  "bed2": 2130,
  "bed3": 2720,
  "near": [
   "PIE",
   "TPA"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-punta-gorda-isles-area": {
  "region": "PGD",
  "ja": "プンタゴルダ・アイルズ周辺",
  "en": "Punta Gorda Isles area",
  "state": "FL",
  "zip": "33950",
  "bed1": 1180,
  "bed2": 1540,
  "bed3": 2090,
  "near": [
   "PGD"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-port-charlotte": {
  "region": "PGD",
  "ja": "ポートシャーロット",
  "en": "Port Charlotte",
  "state": "FL",
  "zip": "33952",
  "bed1": 1140,
  "bed2": 1490,
  "bed3": 2020,
  "near": [
   "PGD"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-germantown": {
  "region": "MEM",
  "ja": "ジャーマンタウン",
  "en": "Germantown",
  "state": "TN",
  "zip": "38138",
  "bed1": 1710,
  "bed2": 1870,
  "bed3": 2470,
  "near": [
   "MEM"
  ],
  "income": 149920,
  "incomeTop": false,
  "offers": []
 },
 "us-collierville": {
  "region": "MEM",
  "ja": "コリアービル",
  "en": "Collierville",
  "state": "TN",
  "zip": "38017",
  "bed1": 1520,
  "bed2": 1660,
  "bed3": 2190,
  "near": [
   "MEM"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-plainfield": {
  "region": "IND",
  "ja": "プレインフィールド",
  "en": "Plainfield",
  "state": "IN",
  "zip": "46168",
  "bed1": 1510,
  "bed2": 1740,
  "bed3": 2260,
  "near": [
   "IND"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-carmel": {
  "region": "IND",
  "ja": "カーメル",
  "en": "Carmel",
  "state": "IN",
  "zip": "46032",
  "bed1": 1860,
  "bed2": 2140,
  "bed3": 2770,
  "near": [
   "IND"
  ],
  "income": 141505,
  "incomeTop": false,
  "offers": [
   {
    "rent": 2499,
    "beds": 3,
    "baths": 3,
    "sqft": 1969,
    "seen": "2026-11-02"
   },
   {
    "rent": 2000,
    "beds": 3,
    "baths": 2,
    "sqft": 1124,
    "seen": "2026-11-02"
   },
   {
    "rent": 2360,
    "beds": 3,
    "baths": 2,
    "sqft": 1443,
    "seen": "2026-11-02"
   }
  ]
 },
 "us-middletown-area": {
  "region": "SDF",
  "ja": "ミドルタウン周辺",
  "en": "Middletown area",
  "state": "KY",
  "zip": "40243",
  "bed1": 1230,
  "bed2": 1480,
  "bed3": 1890,
  "near": [
   "SDF"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-prospect-area": {
  "region": "SDF",
  "ja": "プロスペクト周辺",
  "en": "Prospect area",
  "state": "KY",
  "zip": "40059",
  "bed1": 1580,
  "bed2": 1910,
  "bed3": 2440,
  "near": [
   "SDF"
  ],
  "income": null,
  "incomeTop": false,
  "offers": [
   {
    "rent": 2800,
    "beds": 3,
    "baths": 2.5,
    "sqft": 2240,
    "seen": "2026-11-02"
   },
   {
    "rent": 3750,
    "beds": 3,
    "baths": 3.5,
    "sqft": 1799,
    "seen": "2026-11-02"
   }
  ]
 },
 "us-rancho-cucamonga": {
  "region": "ONT",
  "ja": "ランチョクカモンガ",
  "en": "Rancho Cucamonga",
  "state": "CA",
  "zip": "91730",
  "bed1": 2410,
  "bed2": 2970,
  "bed3": 3910,
  "near": [
   "ONT"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-claremont": {
  "region": "ONT",
  "ja": "クレアモント",
  "en": "Claremont",
  "state": "CA",
  "zip": "91711",
  "bed1": 2750,
  "bed2": 3390,
  "bed3": 4300,
  "near": [
   "ONT"
  ],
  "income": 125647,
  "incomeTop": false,
  "offers": []
 },
 "us-gahanna": {
  "region": "CMH",
  "ja": "ガハナ",
  "en": "Gahanna",
  "state": "OH",
  "zip": "43230",
  "bed1": 1650,
  "bed2": 1960,
  "bed3": 2340,
  "near": [
   "CMH"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-dublin-oh": {
  "region": "CMH",
  "ja": "ダブリン（オハイオ州）",
  "en": "Dublin, OH",
  "state": "OH",
  "zip": "43017",
  "bed1": 1650,
  "bed2": 1970,
  "bed3": 2350,
  "near": [
   "CMH"
  ],
  "income": 160296,
  "incomeTop": false,
  "offers": []
 },
 "us-moon-township": {
  "region": "PIT",
  "ja": "ムーンタウンシップ",
  "en": "Moon Township",
  "state": "PA",
  "zip": "15108",
  "bed1": 1250,
  "bed2": 1510,
  "bed3": 1930,
  "near": [
   "PIT"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-upper-st-clair": {
  "region": "PIT",
  "ja": "アッパーセントクレア",
  "en": "Upper St. Clair",
  "state": "PA",
  "zip": "15241",
  "bed1": 1720,
  "bed2": 2080,
  "bed3": 2650,
  "near": [
   "PIT"
  ],
  "income": 163409,
  "incomeTop": false,
  "offers": []
 },
 "us-cary": {
  "region": "RDU",
  "ja": "ケーリー",
  "en": "Cary",
  "state": "NC",
  "zip": "27513",
  "bed1": 1690,
  "bed2": 1840,
  "bed3": 2290,
  "near": [
   "RDU"
  ],
  "income": 134905,
  "incomeTop": false,
  "offers": []
 },
 "us-apex": {
  "region": "RDU",
  "ja": "エイペックス",
  "en": "Apex",
  "state": "NC",
  "zip": "27502",
  "bed1": 1890,
  "bed2": 2060,
  "bed3": 2570,
  "near": [
   "RDU"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-vandalia": {
  "region": "DAY",
  "ja": "バンダリア",
  "en": "Vandalia",
  "state": "OH",
  "zip": "45377",
  "bed1": 870,
  "bed2": 1080,
  "bed3": 1400,
  "near": [
   "DAY"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-oakwood": {
  "region": "DAY",
  "ja": "オークウッド",
  "en": "Oakwood",
  "state": "OH",
  "zip": "45419",
  "bed1": 970,
  "bed2": 1200,
  "bed3": 1560,
  "near": [
   "DAY"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-mechanicsburg-area": {
  "region": "MDT",
  "ja": "メカニクスバーグ周辺",
  "en": "Mechanicsburg area",
  "state": "PA",
  "zip": "17055",
  "bed1": 1440,
  "bed2": 1790,
  "bed3": 2310,
  "near": [
   "MDT"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-hershey": {
  "region": "MDT",
  "ja": "ハーシー",
  "en": "Hershey",
  "state": "PA",
  "zip": "17033",
  "bed1": 1370,
  "bed2": 1710,
  "bed3": 2200,
  "near": [
   "MDT"
  ],
  "income": 78587,
  "incomeTop": false,
  "offers": []
 },
 "us-meridian": {
  "region": "BOI",
  "ja": "メリディアン",
  "en": "Meridian",
  "state": "ID",
  "zip": "83642",
  "bed1": 1400,
  "bed2": 1660,
  "bed3": 2310,
  "near": [
   "BOI"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-eagle": {
  "region": "BOI",
  "ja": "イーグル",
  "en": "Eagle",
  "state": "ID",
  "zip": "83616",
  "bed1": 1680,
  "bed2": 2000,
  "bed3": 2800,
  "near": [
   "BOI"
  ],
  "income": 122894,
  "incomeTop": false,
  "offers": []
 },
 "us-south-hill-spokane-area": {
  "region": "GEG",
  "ja": "スポケーン（サウスヒル）周辺",
  "en": "South Hill, Spokane area",
  "state": "WA",
  "zip": "99203",
  "bed1": 1130,
  "bed2": 1440,
  "bed3": 1970,
  "near": [
   "GEG"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-liberty-lake": {
  "region": "GEG",
  "ja": "リバティレイク",
  "en": "Liberty Lake",
  "state": "WA",
  "zip": "99019",
  "bed1": 1730,
  "bed2": 2200,
  "bed3": 3010,
  "near": [
   "GEG"
  ],
  "income": 118723,
  "incomeTop": false,
  "offers": []
 },
 "us-macungie-area": {
  "region": "ABE",
  "ja": "マカンジー周辺",
  "en": "Macungie area",
  "state": "PA",
  "zip": "18062",
  "bed1": 2100,
  "bed2": 2550,
  "bed3": 3190,
  "near": [
   "ABE"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-center-valley-saucon-valley-area": {
  "region": "ABE",
  "ja": "センターバレー（ソーコンバレー）周辺",
  "en": "Center Valley, Saucon Valley area",
  "state": "PA",
  "zip": "18034",
  "bed1": 2160,
  "bed2": 2610,
  "bed3": 3270,
  "near": [
   "ABE"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-belleville": {
  "region": "YIP",
  "ja": "ベルビル",
  "en": "Belleville",
  "state": "MI",
  "zip": "48111",
  "bed1": 1220,
  "bed2": 1530,
  "bed3": 1860,
  "near": [
   "YIP"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-west-ann-arbor": {
  "region": "YIP",
  "ja": "アナーバー西部",
  "en": "West Ann Arbor",
  "state": "MI",
  "zip": "48103",
  "bed1": 1880,
  "bed2": 2260,
  "bed3": 2710,
  "near": [
   "YIP"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-green": {
  "region": "CAK",
  "ja": "グリーン（オハイオ州）周辺",
  "en": "Green, Ohio area",
  "state": "OH",
  "zip": "44312",
  "bed1": 940,
  "bed2": 1210,
  "bed3": 1450,
  "near": [
   "CAK"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-hudson": {
  "region": "CAK",
  "ja": "ハドソン",
  "en": "Hudson",
  "state": "OH",
  "zip": "44236",
  "bed1": 1430,
  "bed2": 1850,
  "bed3": 2220,
  "near": [
   "CAK"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-warwick": {
  "region": "PVD",
  "ja": "ウォリック",
  "en": "Warwick",
  "state": "RI",
  "zip": "02886",
  "bed1": 1730,
  "bed2": 2150,
  "bed3": 2630,
  "near": [
   "PVD"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-east-greenwich": {
  "region": "PVD",
  "ja": "イーストグリニッジ",
  "en": "East Greenwich",
  "state": "RI",
  "zip": "02818",
  "bed1": 1660,
  "bed2": 2070,
  "bed3": 2540,
  "near": [
   "PVD"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-estero": {
  "region": "RSW",
  "ja": "エステロ",
  "en": "Estero",
  "state": "FL",
  "zip": "33928",
  "bed1": 1930,
  "bed2": 2300,
  "bed3": 3000,
  "near": [
   "RSW"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-bonita-springs": {
  "region": "RSW",
  "ja": "ボニータスプリングス",
  "en": "Bonita Springs",
  "state": "FL",
  "zip": "34135",
  "bed1": 1760,
  "bed2": 2060,
  "bed3": 2660,
  "near": [
   "RSW"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-vero-beach": {
  "region": "VRB",
  "ja": "ベロビーチ内陸側",
  "en": "Vero Beach (mainland)",
  "state": "FL",
  "zip": "32960",
  "bed1": 1100,
  "bed2": 1450,
  "bed3": 1770,
  "near": [
   "VRB"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-indian-river-shores": {
  "region": "VRB",
  "ja": "インディアンリバーショアーズ周辺",
  "en": "Indian River Shores area",
  "state": "FL",
  "zip": "32963",
  "bed1": 1770,
  "bed2": 2310,
  "bed3": 2820,
  "near": [
   "VRB"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-summerville": {
  "region": "CHS",
  "ja": "サマービル",
  "en": "Summerville",
  "state": "SC",
  "zip": "29483",
  "bed1": 1450,
  "bed2": 1580,
  "bed3": 1960,
  "near": [
   "CHS"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-mount-pleasant": {
  "region": "CHS",
  "ja": "マウントプレザント",
  "en": "Mount Pleasant",
  "state": "SC",
  "zip": "29464",
  "bed1": 2230,
  "bed2": 2430,
  "bed3": 3010,
  "near": [
   "CHS"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-chesapeake-greenbrier": {
  "region": "ORF",
  "ja": "チェサピーク・グリーンブライアー周辺",
  "en": "Greenbrier, Chesapeake area",
  "state": "VA",
  "zip": "23320",
  "bed1": 1870,
  "bed2": 2100,
  "bed3": 2890,
  "near": [
   "ORF"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-virginia-beach": {
  "region": "ORF",
  "ja": "バージニアビーチ東側",
  "en": "Virginia Beach (east)",
  "state": "VA",
  "zip": "23454",
  "bed1": 1700,
  "bed2": 1910,
  "bed3": 2630,
  "near": [
   "ORF"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-windsor-locks": {
  "region": "BDL",
  "ja": "ウィンザーロックス",
  "en": "Windsor Locks",
  "state": "CT",
  "zip": "06096",
  "bed1": 1490,
  "bed2": 1870,
  "bed3": 2230,
  "near": [
   "BDL"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-glastonbury": {
  "region": "BDL",
  "ja": "グラストンベリー",
  "en": "Glastonbury",
  "state": "CT",
  "zip": "06033",
  "bed1": 1880,
  "bed2": 2350,
  "bed3": 2800,
  "near": [
   "BDL"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-lehi": {
  "region": "PVU",
  "ja": "リーハイ",
  "en": "Lehi",
  "state": "UT",
  "zip": "84043",
  "bed1": 1490,
  "bed2": 1700,
  "bed3": 2350,
  "near": [
   "PVU"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-alpine": {
  "region": "PVU",
  "ja": "アルパイン",
  "en": "Alpine",
  "state": "UT",
  "zip": "84004",
  "bed1": 1500,
  "bed2": 1720,
  "bed3": 2380,
  "near": [
   "PVU"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-kenner": {
  "region": "MSY",
  "ja": "ケナー",
  "en": "Kenner",
  "state": "LA",
  "zip": "70065",
  "bed1": 1120,
  "bed2": 1350,
  "bed3": 1730,
  "near": [
   "MSY"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-mandeville": {
  "region": "MSY",
  "ja": "マンデビル",
  "en": "Mandeville",
  "state": "LA",
  "zip": "70448",
  "bed1": 1350,
  "bed2": 1570,
  "bed3": 2020,
  "near": [
   "MSY"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-branford": {
  "region": "HVN",
  "ja": "ブランフォード",
  "en": "Branford",
  "state": "CT",
  "zip": "06405",
  "bed1": 1730,
  "bed2": 2080,
  "bed3": 2590,
  "near": [
   "HVN"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-madison": {
  "region": "HVN",
  "ja": "マディソン（コネチカット州）",
  "en": "Madison, Connecticut",
  "state": "CT",
  "zip": "06443",
  "bed1": 2430,
  "bed2": 2910,
  "bed3": 3620,
  "near": [
   "HVN"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-newark-delaware": {
  "region": "ILG",
  "ja": "ニューアーク（デラウェア州）",
  "en": "Newark, Delaware",
  "state": "DE",
  "zip": "19711",
  "bed1": 1590,
  "bed2": 1900,
  "bed3": 2260,
  "near": [
   "ILG"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-greenville-delaware": {
  "region": "ILG",
  "ja": "グリーンビル（デラウェア州）",
  "en": "Greenville, Delaware",
  "state": "DE",
  "zip": "19807",
  "bed1": 1820,
  "bed2": 2170,
  "bed3": 2590,
  "near": [
   "ILG"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-south-lakeland": {
  "region": "LAL",
  "ja": "サウスレイクランド",
  "en": "South Lakeland",
  "state": "FL",
  "zip": "33813",
  "bed1": 1690,
  "bed2": 2030,
  "bed3": 2790,
  "near": [
   "LAL"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-lake-hollingsworth": {
  "region": "LAL",
  "ja": "ホリングスワース湖周辺",
  "en": "Lake Hollingsworth area",
  "state": "FL",
  "zip": "33803",
  "bed1": 1520,
  "bed2": 1830,
  "bed3": 2520,
  "near": [
   "LAL"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-concord": {
  "region": "USA",
  "ja": "コンコード（ノースカロライナ州）",
  "en": "Concord, North Carolina",
  "state": "NC",
  "zip": "28027",
  "bed1": 1640,
  "bed2": 1790,
  "bed3": 2190,
  "near": [
   "USA"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-st-charles": {
  "region": "STL",
  "ja": "セントチャールズ",
  "en": "St. Charles",
  "state": "MO",
  "zip": "63301",
  "bed1": 1150,
  "bed2": 1400,
  "bed3": 1800,
  "near": [
   "STL"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-chesterfield": {
  "region": "STL",
  "ja": "チェスターフィールド",
  "en": "Chesterfield",
  "state": "MO",
  "zip": "63017",
  "bed1": 1580,
  "bed2": 1930,
  "bed3": 2480,
  "near": [
   "STL"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-aiea": {
  "region": "HNL",
  "ja": "アイエア",
  "en": "Aiea",
  "state": "HI",
  "zip": "96701",
  "bed1": 1810,
  "bed2": 2360,
  "bed3": 3270,
  "near": [
   "HNL"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-kailua-oahu": {
  "region": "HNL",
  "ja": "カイルア（オアフ島）",
  "en": "Kailua (Oahu)",
  "state": "HI",
  "zip": "96734",
  "bed1": 2810,
  "bed2": 3660,
  "bed3": 5070,
  "near": [
   "HNL"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-harrison": {
  "region": "HPN",
  "ja": "ハリソン",
  "en": "Harrison",
  "state": "NY",
  "zip": "10528",
  "bed1": 3820,
  "bed2": 4160,
  "bed3": 5260,
  "near": [
   "HPN"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "us-scarsdale": {
  "region": "HPN",
  "ja": "スカースデール",
  "en": "Scarsdale",
  "state": "NY",
  "zip": "10583",
  "bed1": 3550,
  "bed2": 3860,
  "bed3": 4880,
  "near": [
   "HPN"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-etobicoke-central": {
  "region": "YYZ",
  "ja": "エトビコ中部",
  "en": "Central Etobicoke",
  "state": "ON",
  "zip": null,
  "zone": "Zone 6 - Etobicoke (Central)",
  "bed1": 1874,
  "bed2": 2190,
  "bed3": 2497,
  "near": [
   "YYZ",
   "YTZ"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-mississauga-northwest": {
  "region": "YYZ",
  "ja": "ミシサガ北西部",
  "en": "Northwest Mississauga",
  "state": "ON",
  "zip": null,
  "zone": "Zone 19 - Mississauga (Northwest)",
  "bed1": 1987,
  "bed2": 2280,
  "bed3": 2255,
  "near": [
   "YYZ",
   "YTZ"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-oakville": {
  "region": "YYZ",
  "ja": "オークビル",
  "en": "Oakville",
  "state": "ON",
  "zip": null,
  "zone": "Zone 23 - Oakville",
  "bed1": 1915,
  "bed2": 2337,
  "bed3": 2439,
  "near": [
   "YYZ",
   "YTZ"
  ],
  "income": null,
  "incomeTop": false,
  "offers": [
   {
    "rent": 2900,
    "beds": 3,
    "baths": 2,
    "sqft": 2123,
    "seen": "2026-11-02"
   }
  ]
 },
 "ca-markham": {
  "region": "YYZ",
  "ja": "マーカム",
  "en": "Markham",
  "state": "ON",
  "zip": null,
  "zone": "Zone 27 - Markham",
  "bed1": 1885,
  "bed2": 1996,
  "bed3": 1969,
  "near": [
   "YYZ",
   "YTZ"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-richmond-hill-vaughan-king": {
  "region": "YYZ",
  "ja": "リッチモンドヒル・ボーン・キング",
  "en": "Richmond Hill, Vaughan & King",
  "state": "ON",
  "zip": null,
  "zone": "Zone 25 - Richmond Hill/Vaughan/King",
  "bed1": 1583,
  "bed2": 1827,
  "bed3": 2332,
  "near": [
   "YYZ",
   "YTZ"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-dorval-lachine-saint-pierre": {
  "region": "YUL",
  "ja": "ドーバル・ラシーン・サンピエール",
  "en": "Dorval, Lachine & Saint-Pierre",
  "state": "QC",
  "zip": null,
  "zone": "Zone 14 - Dorval/Lachine/Saint-Pierre",
  "bed1": 978,
  "bed2": 1138,
  "bed3": null,
  "near": [
   "YUL"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-beaconsfield-baie-d-urfe": {
  "region": "YUL",
  "ja": "ビーコンズフィールド・ベ・デュルフェ周辺",
  "en": "Beaconsfield & Baie-D'Urfé area",
  "state": "QC",
  "zip": null,
  "zone": "Zone 15 - Baie-d'Urfé/Beaconsfield etc.",
  "bed1": 1451,
  "bed2": 1773,
  "bed3": null,
  "near": [
   "YUL"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-saint-laurent": {
  "region": "YUL",
  "ja": "サンローラン（モントリオール）",
  "en": "Saint-Laurent",
  "state": "QC",
  "zip": null,
  "zone": "Zone 13 - Saint-Laurent",
  "bed1": 1163,
  "bed2": 1365,
  "bed3": 2125,
  "near": [
   "YUL"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-mount-royal-outremont": {
  "region": "YUL",
  "ja": "マウントロイヤル・ウトルモン周辺",
  "en": "Mount Royal & Outremont area",
  "state": "QC",
  "zip": null,
  "zone": "Zone 5 - Ct-des-Neiges/Mt-Royal/Outremont",
  "bed1": 1146,
  "bed2": 1415,
  "bed3": null,
  "near": [
   "YUL"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-richmond": {
  "region": "YVR",
  "ja": "リッチモンド（BC州）",
  "en": "Richmond",
  "state": "BC",
  "zip": null,
  "zone": "Zone 19 - Richmond",
  "bed1": 1676,
  "bed2": 2018,
  "bed3": 2450,
  "near": [
   "YVR"
  ],
  "income": null,
  "incomeTop": false,
  "offers": [
   {
    "rent": 3550,
    "beds": 3,
    "baths": 3,
    "sqft": 1504,
    "seen": "2026-11-02"
   }
  ]
 },
 "ca-kitsilano-point-grey": {
  "region": "YVR",
  "ja": "キツラノ・ポイントグレイ",
  "en": "Kitsilano & Point Grey",
  "state": "BC",
  "zip": null,
  "zone": "Zone 5 - Kitsilano/Point Grey",
  "bed1": 1915,
  "bed2": 2651,
  "bed3": 3733,
  "near": [
   "YVR"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-kerrisdale-westside": {
  "region": "YVR",
  "ja": "ケリスデール・ウェストサイド",
  "en": "Kerrisdale & West Side",
  "state": "BC",
  "zip": null,
  "zone": "Zone 6 - Westside/Kerrisdale",
  "bed1": 1905,
  "bed2": 2957,
  "bed3": 4468,
  "near": [
   "YVR"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-west-vancouver": {
  "region": "YVR",
  "ja": "ウェストバンクーバー",
  "en": "West Vancouver",
  "state": "BC",
  "zip": null,
  "zone": "Zone 18 - West Vancouver",
  "bed1": 2153,
  "bed2": 3252,
  "bed3": null,
  "near": [
   "YVR"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-north-vancouver-district": {
  "region": "YVR",
  "ja": "ノースバンクーバー地区",
  "en": "District of North Vancouver",
  "state": "BC",
  "zip": null,
  "zone": "Zone 17 - North Vancouver DM",
  "bed1": 2359,
  "bed2": 2756,
  "bed3": 2656,
  "near": [
   "YVR"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-st-james": {
  "region": "YWG",
  "ja": "セントジェームズ（ウィニペグ）",
  "en": "St. James",
  "state": "MB",
  "zip": null,
  "zone": "Zone 5 - St. James",
  "bed1": 1182,
  "bed2": 1442,
  "bed3": 1858,
  "near": [
   "YWG"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-assiniboine-park": {
  "region": "YWG",
  "ja": "アシニボイン公園周辺",
  "en": "Assiniboine Park area",
  "state": "MB",
  "zip": null,
  "zone": "Zone 12 - Assiniboine Park",
  "bed1": 1402,
  "bed2": 1809,
  "bed3": 1878,
  "near": [
   "YWG"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-fort-garry": {
  "region": "YWG",
  "ja": "フォートギャリー周辺",
  "en": "Fort Garry area",
  "state": "MB",
  "zip": null,
  "zone": "Zone 11 - Fort Garry",
  "bed1": 1458,
  "bed2": 1731,
  "bed3": 2060,
  "near": [
   "YWG"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-st-vital": {
  "region": "YWG",
  "ja": "セントバイタル",
  "en": "St. Vital",
  "state": "MB",
  "zip": null,
  "zone": "Zone 10 - St. Vital",
  "bed1": 1265,
  "bed2": 1620,
  "bed3": 1882,
  "near": [
   "YWG"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-calgary-northeast": {
  "region": "YYC",
  "ja": "カルガリー北東部",
  "en": "Northeast Calgary",
  "state": "AB",
  "zip": null,
  "zone": "Zone 7 - Northeast",
  "bed1": 1501,
  "bed2": 1762,
  "bed3": 2006,
  "near": [
   "YYC"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-calgary-northwest": {
  "region": "YYC",
  "ja": "カルガリー北西部",
  "en": "Northwest Calgary",
  "state": "AB",
  "zip": null,
  "zone": "Zone 6 - Northwest",
  "bed1": 1648,
  "bed2": 1818,
  "bed3": 2254,
  "near": [
   "YYC"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-calgary-southwest": {
  "region": "YYC",
  "ja": "カルガリー南西部",
  "en": "Southwest Calgary",
  "state": "AB",
  "zip": null,
  "zone": "Zone 4 - Southwest",
  "bed1": 1642,
  "bed2": 2083,
  "bed3": 2318,
  "near": [
   "YYC"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-airdrie-cochrane": {
  "region": "YYC",
  "ja": "エアドリー・コクラン周辺",
  "en": "Airdrie & Cochrane area",
  "state": "AB",
  "zip": null,
  "zone": "Zone 10 - Other Centres",
  "bed1": 1470,
  "bed2": 1805,
  "bed3": 2014,
  "near": [
   "YYC"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-leduc": {
  "region": "YEG",
  "ja": "レダック",
  "en": "Leduc",
  "state": "AB",
  "zip": null,
  "zone": "Zone 16 - Leduc",
  "bed1": 1342,
  "bed2": 1465,
  "bed3": null,
  "near": [
   "YEG"
  ],
  "income": null,
  "incomeTop": false,
  "offers": [
   {
    "rent": 2295,
    "beds": 3,
    "baths": 2.5,
    "sqft": null,
    "seen": "2026-11-02"
   }
  ]
 },
 "ca-edmonton-southwest": {
  "region": "YEG",
  "ja": "エドモントン南西部",
  "en": "Southwest Edmonton",
  "state": "AB",
  "zip": null,
  "zone": "Zone 7 - South West",
  "bed1": 1386,
  "bed2": 1603,
  "bed3": 1833,
  "near": [
   "YEG"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-st-albert": {
  "region": "YEG",
  "ja": "セントアルバート",
  "en": "St. Albert",
  "state": "AB",
  "zip": null,
  "zone": "Zone 13 - St. Albert",
  "bed1": 1659,
  "bed2": 1939,
  "bed3": 1874,
  "near": [
   "YEG"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-strathcona-county": {
  "region": "YEG",
  "ja": "ストラスコーナ郡（シャーウッドパーク）",
  "en": "Strathcona County (Sherwood Park)",
  "state": "AB",
  "zip": null,
  "zone": "Zone 19 - Strathcona County",
  "bed1": 1610,
  "bed2": 1913,
  "bed3": 2213,
  "near": [
   "YEG"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-hunt-club-south-keys": {
  "region": "YOW",
  "ja": "ハントクラブ・サウスキーズ",
  "en": "Hunt Club & South Keys",
  "state": "ON",
  "zip": null,
  "zone": "Zone 9 - Hunt Club/South Keys",
  "bed1": 1440,
  "bed2": 1768,
  "bed3": 1945,
  "near": [
   "YOW"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-nepean": {
  "region": "YOW",
  "ja": "ネピアン",
  "en": "Nepean",
  "state": "ON",
  "zip": null,
  "zone": "Zone 13 - Nepean",
  "bed1": 1581,
  "bed2": 1851,
  "bed3": 2013,
  "near": [
   "YOW"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-glebe-old-ottawa-south": {
  "region": "YOW",
  "ja": "グリーブ・オールドオタワサウス",
  "en": "The Glebe & Old Ottawa South",
  "state": "ON",
  "zip": null,
  "zone": "Zone 3 - Glebe/Old Ottawa South",
  "bed1": 1778,
  "bed2": 2074,
  "bed3": 2143,
  "near": [
   "YOW"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 },
 "ca-ottawa": {
  "region": "YOW",
  "ja": "カナタ周辺（オタワ西部）",
  "en": "Kanata area (west Ottawa)",
  "state": "ON",
  "zip": null,
  "zone": "Zone 14 - Western Ottawa Surrounding Areas",
  "bed1": 2062,
  "bed2": 2495,
  "bed3": null,
  "near": [
   "YOW"
  ],
  "income": null,
  "incomeTop": false,
  "offers": []
 }
});
export const COMPANIES = Object.freeze({
 "delta": {
  "bases": [
   "ATL",
   "BOS",
   "DTW",
   "LAX",
   "MSP",
   "JFK",
   "LGA",
   "SLC",
   "SEA"
  ],
  "regions": [
   "ATL",
   "BOS",
   "DTW",
   "LAX",
   "MSP",
   "NYC",
   "SLC",
   "SEA"
  ],
  "airports": [
   "ATL",
   "BOS",
   "DTW",
   "JFK",
   "LAX",
   "LGA",
   "MSP",
   "SEA",
   "SLC"
  ]
 },
 "united": {
  "bases": [
   "ORD",
   "DEN",
   "IAH",
   "EWR",
   "IAD",
   "LAX",
   "SFO",
   "MCO"
  ],
  "regions": [
   "CHI",
   "DEN",
   "HOU",
   "NYC",
   "DC",
   "LAX",
   "BAY",
   "ORL"
  ],
  "airports": [
   "DEN",
   "EWR",
   "IAD",
   "IAH",
   "LAX",
   "MCO",
   "ORD",
   "SFO"
  ]
 },
 "american": {
  "bases": [
   "DFW",
   "CLT",
   "MIA",
   "PHL",
   "ORD",
   "PHX",
   "LAX",
   "JFK",
   "LGA",
   "DCA"
  ],
  "regions": [
   "DFW",
   "CLT",
   "MIA",
   "PHL",
   "CHI",
   "PHX",
   "LAX",
   "NYC",
   "DC"
  ],
  "airports": [
   "CLT",
   "DCA",
   "DFW",
   "JFK",
   "LAX",
   "LGA",
   "MIA",
   "ORD",
   "PHL",
   "PHX"
  ]
 },
 "southwest": {
  "bases": [
   "ATL",
   "AUS",
   "BWI",
   "DAL",
   "DEN",
   "HOU",
   "LAS",
   "LAX",
   "BNA",
   "MCO",
   "MDW",
   "OAK",
   "PHX"
  ],
  "regions": [
   "ATL",
   "AUS",
   "BWI",
   "DFW",
   "DEN",
   "HOU",
   "LAS",
   "LAX",
   "BNA",
   "ORL",
   "CHI",
   "BAY",
   "PHX"
  ],
  "airports": [
   "ATL",
   "AUS",
   "BNA",
   "BWI",
   "DAL",
   "DEN",
   "HOU",
   "LAS",
   "LAX",
   "MCO",
   "MDW",
   "OAK",
   "PHX"
  ]
 },
 "alaska-airlines": {
  "bases": [
   "SEA",
   "ANC",
   "PDX",
   "LAX",
   "SFO",
   "SAN"
  ],
  "regions": [
   "SEA",
   "ANC",
   "PDX",
   "LAX",
   "BAY",
   "SAN"
  ],
  "airports": [
   "ANC",
   "LAX",
   "PDX",
   "SAN",
   "SEA",
   "SFO"
  ]
 },
 "jetblue": {
  "bases": [
   "BOS",
   "FLL",
   "JFK",
   "LAX",
   "MCO"
  ],
  "regions": [
   "BOS",
   "FLL",
   "NYC",
   "LAX",
   "ORL"
  ],
  "airports": [
   "BOS",
   "FLL",
   "JFK",
   "LAX",
   "MCO"
  ]
 },
 "frontier": {
  "bases": [
   "ATL",
   "ORD",
   "CVG",
   "CLE",
   "DFW",
   "DEN",
   "LAS",
   "MIA",
   "MCO",
   "PHX",
   "SJU",
   "TPA"
  ],
  "regions": [
   "ATL",
   "CHI",
   "CVG",
   "CLE",
   "DFW",
   "DEN",
   "LAS",
   "MIA",
   "ORL",
   "PHX",
   "SJU",
   "TPA"
  ],
  "airports": [
   "ATL",
   "CLE",
   "CVG",
   "DEN",
   "DFW",
   "LAS",
   "MCO",
   "MIA",
   "ORD",
   "PHX",
   "SJU",
   "TPA"
  ]
 },
 "allegiant": {
  "bases": [
   "LAS",
   "SFB",
   "PIE",
   "PGD",
   "IWA",
   "FLL",
   "ABE"
  ],
  "regions": [
   "LAS",
   "ORL",
   "TPA",
   "PGD",
   "PHX",
   "FLL",
   "ABE"
  ],
  "airports": [
   "ABE",
   "FLL",
   "IWA",
   "LAS",
   "PGD",
   "PIE",
   "SFB"
  ]
 },
 "fedex-express": {
  "bases": [
   "MEM",
   "IND",
   "OAK",
   "ANC"
  ],
  "regions": [
   "MEM",
   "IND",
   "BAY",
   "ANC"
  ],
  "airports": [
   "ANC",
   "IND",
   "MEM",
   "OAK"
  ]
 },
 "ups-airlines": {
  "bases": [
   "SDF",
   "ANC",
   "ONT",
   "MIA"
  ],
  "regions": [
   "SDF",
   "ANC",
   "ONT",
   "MIA"
  ],
  "airports": [
   "ANC",
   "MIA",
   "ONT",
   "SDF"
  ]
 },
 "atlas-air": {
  "bases": [
   "ANC",
   "JFK",
   "ORD",
   "LAX",
   "MIA",
   "SEA"
  ],
  "regions": [
   "ANC",
   "NYC",
   "CHI",
   "LAX",
   "MIA",
   "SEA"
  ],
  "airports": [
   "ANC",
   "JFK",
   "LAX",
   "MIA",
   "ORD",
   "SEA"
  ]
 },
 "abx-air": {
  "bases": [
   "CVG"
  ],
  "regions": [
   "CVG"
  ],
  "airports": [
   "CVG"
  ]
 },
 "kalitta-air": {
  "bases": [],
  "regions": [],
  "airports": []
 },
 "breeze-airways": {
  "bases": [
   "CAK",
   "PVD",
   "TPA",
   "RSW",
   "VRB",
   "MCO",
   "CHS",
   "ORF",
   "BDL",
   "PVU",
   "MSY"
  ],
  "regions": [
   "CAK",
   "PVD",
   "TPA",
   "RSW",
   "VRB",
   "ORL",
   "CHS",
   "ORF",
   "BDL",
   "PVU",
   "MSY"
  ],
  "airports": [
   "CAK",
   "PVD",
   "TPA",
   "RSW",
   "VRB",
   "MCO",
   "CHS",
   "ORF",
   "BDL",
   "PVU",
   "MSY"
  ]
 },
 "avelo-airlines": {
  "bases": [
   "HVN",
   "ILG",
   "LAL",
   "USA"
  ],
  "regions": [
   "HVN",
   "ILG",
   "LAL",
   "USA"
  ],
  "airports": [
   "HVN",
   "ILG",
   "LAL",
   "USA"
  ]
 },
 "gojet": {
  "bases": [
   "STL",
   "EWR",
   "IAD",
   "ORD",
   "IAH"
  ],
  "regions": [
   "STL",
   "NYC",
   "DC",
   "CHI"
  ],
  "airports": [
   "STL",
   "EWR",
   "IAD",
   "ORD",
   "IAH"
  ]
 },
 "northern-air-cargo": {
  "bases": [
   "ANC",
   "HNL",
   "MIA"
  ],
  "regions": [
   "ANC",
   "HNL",
   "MIA"
  ],
  "airports": [
   "ANC",
   "HNL",
   "MIA"
  ]
 },
 "contour": {
  "bases": [
   "CLT",
   "PHX",
   "ORD",
   "FLL",
   "HPN"
  ],
  "regions": [
   "CLT",
   "PHX",
   "CHI",
   "FLL",
   "HPN"
  ],
  "airports": [
   "CLT",
   "PHX",
   "ORD",
   "FLL",
   "HPN"
  ]
 },
 "air-canada": {
  "bases": [
   "YUL",
   "YYZ",
   "YWG",
   "YVR"
  ],
  "regions": [
   "YYZ",
   "YUL",
   "YWG",
   "YVR"
  ],
  "airports": [
   "YUL",
   "YYZ",
   "YWG",
   "YVR"
  ]
 },
 "westjet": {
  "bases": [
   "YYC",
   "YEG",
   "YVR",
   "YWG",
   "YYZ",
   "YUL"
  ],
  "regions": [
   "YYC",
   "YEG",
   "YVR",
   "YWG",
   "YYZ",
   "YUL"
  ],
  "airports": [
   "YYC",
   "YEG",
   "YVR",
   "YWG",
   "YYZ",
   "YUL"
  ]
 },
 "jazz": {
  "bases": [
   "YYZ",
   "YUL",
   "YYC",
   "YVR"
  ],
  "regions": [
   "YYZ",
   "YUL",
   "YYC",
   "YVR"
  ],
  "airports": [
   "YYZ",
   "YUL",
   "YYC",
   "YVR"
  ]
 },
 "porter": {
  "bases": [
   "YYZ",
   "YTZ",
   "YOW",
   "YUL",
   "YVR"
  ],
  "regions": [
   "YYZ",
   "YUL",
   "YOW",
   "YVR"
  ],
  "airports": [
   "YYZ",
   "YTZ",
   "YOW",
   "YUL",
   "YVR"
  ]
 }
});
