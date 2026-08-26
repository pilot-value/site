// ─────────────────────────────────────────────────────────────────────────
// pv-vocab.mjs — 入力語彙の単一データソース（Single Source of Truth）
//
// 機種 / 職位 / 役職 / 住居 / 契約形態 / 通貨。会社名は salary-data.mjs が正。
//
// なぜ分けるか：これらは口コミフォーム（submit-review.html）と
// 給与レポート（pay-report.html）の両方が使う。片方だけ直すと、
// 同じ意味の値が2つのコードで入り、集計が静かに割れる。
//
// 生成: node gen-vocab.mjs  → pv-vocab.json（ブラウザ用）＋ 各フォームの select
// ─────────────────────────────────────────────────────────────────────────

/* 機種。cat は salary-leveling.js と同じ語彙（r=リージョナル / n=ナローボディ /
   w=ワイドボディ）。既存の 'regional' / 'turboprop' は**残す**——既に投稿された
   行のコードなので、消すと過去データが宙に浮く。細かい機種を足したうえで、
   この2つは「上記以外」の受け皿として意味を狭める。 */
export const FLEETS = [
  // ── ナローボディ ──
  { code:'a320',      cat:'n', ja:'A320ファミリー（A319/320/321）',   en:'A320 family (A319/320/321)' },
  { code:'b737',      cat:'n', ja:'Boeing 737',                        en:'Boeing 737' },
  { code:'a220',      cat:'n', ja:'Airbus A220（旧 CS100/300）',       en:'Airbus A220 (ex-CSeries)' },
  { code:'b757',      cat:'n', ja:'Boeing 757',                        en:'Boeing 757' },
  { code:'e-jet',     cat:'n', ja:'Embraer E-Jet（E170/190）',         en:'Embraer E-Jet (E170/190)' },
  // ── ワイドボディ ──
  { code:'b767',      cat:'w', ja:'Boeing 767',                        en:'Boeing 767' },
  { code:'b777',      cat:'w', ja:'Boeing 777',                        en:'Boeing 777' },
  { code:'b787',      cat:'w', ja:'Boeing 787 Dreamliner',             en:'Boeing 787 Dreamliner' },
  { code:'b747',      cat:'w', ja:'Boeing 747',                        en:'Boeing 747' },
  { code:'a330',      cat:'w', ja:'Airbus A330',                       en:'Airbus A330' },
  { code:'a350',      cat:'w', ja:'Airbus A350',                       en:'Airbus A350' },
  { code:'a380',      cat:'w', ja:'Airbus A380',                       en:'Airbus A380' },
  // ── リージョナル ──
  { code:'crj',       cat:'r', ja:'CRJ シリーズ',                      en:'CRJ series' },
  { code:'atr',       cat:'r', ja:'ATR 42/72',                         en:'ATR 42/72' },
  { code:'dhc8',      cat:'r', ja:'DHC-8（Q400 等）',                   en:'DHC-8 (Q400, etc.)' },
  { code:'regional',  cat:'r', ja:'上記以外のリージョナルジェット',      en:'Other regional jet' },
  { code:'turboprop', cat:'r', ja:'上記以外のターボプロップ',            en:'Other turboprop' },
  // ── その他（ビジネスジェット・貨物専用機など）──
  { code:'bizjet',    cat:'r', ja:'ビジネスジェット（Gulfstream 等）',   en:'Business jet (Gulfstream, etc.)' },
  { code:'other',     cat:null, ja:'その他',                           en:'Other' },
];

/* 職位。給与レポートの正はこの3つ。上から順に select に並ぶので、
   実際に投稿する人がいちばん多い機長を先頭に置く。

   ★SFO と教官機長（TRI/TRE）は 2026-08-18 に選択肢から外した。
     教官・査察は下の JOB_ROLES（役職・区分）が別軸で聞いており、
     「機長 ＋ 教官」で過不足なく言える。SFO も公開年収（salary-data.mjs）が
     機長／副操縦士の2本しか持たない以上、集計は元から副操縦士へ寄せていた。
     消したのは選択肢だけで、過去の投稿のコードは pv_positions に残る
     （db/vocab.generated.sql が active=false にするだけで消さない）。

   口コミフォームは 'captain' / 'fo' / 'cadet' の3チップのまま動いており、
   'captain' だけコードが違う。LEGACY_POSITIONS で寄せてから集計する。 */
export const POSITIONS = [
  { code:'cap',     ja:'機長（CAP）',         en:'Captain (CAP)' },
  { code:'fo',      ja:'副操縦士（FO）',      en:'First Officer (FO)' },
  { code:'cadet',   ja:'訓練生',              en:'Cadet / Trainee' },
];

/* 引退したコードの寄せ先。過去の投稿を数えるときはここを通してから集計する。 */
export const LEGACY_POSITIONS = { captain: 'cap', sfo: 'fo', tri_tre: 'cap' };

/* 役職・区分（職位とは別軸。ラインを飛びながら教官、があるため）。
   ★複数選択できる。1人が「ライン乗務 ＋ 教官 ＋ 組合」は普通にある。
   ⚠️ 並びはオーナー指定の①〜⑥。過去の投稿が持つ4つのコード
      （line / instructor / examiner / management）は付け替えずに残す。
   ⚠️ 2026-08-26、オーナー指示で ⑥安全・運航基準 と ⑦他部署配属・出向 を
      1つ（nonline）に統合した。消えた2つのコードは gen-vocab.mjs が
      active=false にするだけで行は消さないので、過去の投稿は読めるまま。 */
export const JOB_ROLES = [
  { code:'line',       ja:'ライン乗務',         en:'Line pilot' },
  { code:'instructor', ja:'教官・訓練担当',     en:'Instructor / Training' },
  { code:'examiner',   ja:'審査・査察担当',     en:'Examiner / Check' },
  { code:'union',      ja:'組合・乗員代表',     en:'Union / Pilot representative' },
  { code:'management', ja:'管理・マネジメント', en:'Management / Leadership' },
  { code:'nonline',    ja:'その他の兼務・配属', en:'Other / Non-Line Assignment' },
];

/* 年代。年収はどの会社でも年齢とともに上がるので、これが無いと
   「同じ会社の機長」同士を並べても、実は入社3年目と定年間際を比べていることになる。

   ★刻みは10歳。口コミフォーム（submit-review.html の #f-age）は5歳刻みで
     '20-24' … '60+' を集めており、この10歳刻みはそれをちょうど2つずつ足した形になっている。
     コードの書き方（'20-29' / '60+'）も口コミと同じにしてあるので、
     あとから2つのデータを同じ軸で並べられる。片方だけ別の刻みにすると二度と混ぜられない。
   ★「20〜30」ではなく「20〜29歳」と書く。20〜30 と 30〜40 だと、30歳の人が
     どちらを選べばいいのか分からない（実際に上下どちらにも読める）。 */
export const AGE_BUCKETS = [
  { code:'20-29', ja:'20〜29歳', en:'20–29' },
  { code:'30-39', ja:'30〜39歳', en:'30–39' },
  { code:'40-49', ja:'40〜49歳', en:'40–49' },
  { code:'50-59', ja:'50〜59歳', en:'50–59' },
  { code:'60+',   ja:'60歳以上', en:'60 or over' },
];

/* 住居。「社宅」と「住宅手当」は手取りの意味がまったく違うので必ず分ける
   （現物支給は課税・可処分の扱いが国ごとに変わる）。 */
export const HOUSING = [
  { code:'provided',  ja:'社宅・会社支給（現物）', en:'Company-provided (in kind)' },
  { code:'allowance', ja:'住宅手当（現金）',       en:'Housing allowance (cash)' },
  { code:'none',      ja:'なし',                   en:'None' },
];

/* 契約形態。湾岸・欧州LCCでは同じ会社・同じ機材でも待遇がここで割れる。 */
export const CONTRACT_TYPES = [
  { code:'direct', ja:'直接雇用',                 en:'Direct employment' },
  { code:'contract', ja:'契約（有期・自営業含む）', en:'Contract (incl. self-employed)' },
  { code:'agency', ja:'エージェンシー経由',        en:'Via agency' },
];

/* 通貨。110社の母国通貨 ＋ 契約でよく使われる USD / EUR を網羅する。
   dec = 小数桁（JPY/KRW は0、湾岸の KWD/BHD/OMR/JOD は3）。入力の検証と
   表示の丸めに使う。★サイト全体の価格表示は currency.js（7通貨）が担当。
   こちらは「給与明細に書かれている通貨」の一覧であり、役割が違う。 */
export const CURRENCIES = [
  { code:'USD', dec:2, sym:'$',    ja:'米ドル',            en:'US Dollar' },
  { code:'EUR', dec:2, sym:'€',    ja:'ユーロ',            en:'Euro' },
  { code:'JPY', dec:0, sym:'¥',    ja:'日本円',            en:'Japanese Yen' },
  { code:'GBP', dec:2, sym:'£',    ja:'英ポンド',          en:'British Pound' },
  { code:'AED', dec:2, sym:'د.إ',  ja:'UAEディルハム',     en:'UAE Dirham' },
  { code:'QAR', dec:2, sym:'ر.ق',  ja:'カタールリヤル',     en:'Qatari Riyal' },
  { code:'SAR', dec:2, sym:'ر.س',  ja:'サウジリヤル',       en:'Saudi Riyal' },
  { code:'KWD', dec:3, sym:'د.ك',  ja:'クウェートディナール', en:'Kuwaiti Dinar' },
  { code:'BHD', dec:3, sym:'.د.ب', ja:'バーレーンディナール', en:'Bahraini Dinar' },
  { code:'OMR', dec:3, sym:'ر.ع.', ja:'オマーンリアル',      en:'Omani Rial' },
  { code:'JOD', dec:3, sym:'د.ا',  ja:'ヨルダンディナール',   en:'Jordanian Dinar' },
  { code:'TRY', dec:2, sym:'₺',    ja:'トルコリラ',         en:'Turkish Lira' },
  { code:'CHF', dec:2, sym:'CHF',  ja:'スイスフラン',        en:'Swiss Franc' },
  { code:'SEK', dec:2, sym:'kr',   ja:'スウェーデンクローナ', en:'Swedish Krona' },
  { code:'NOK', dec:2, sym:'kr',   ja:'ノルウェークローネ',   en:'Norwegian Krone' },
  { code:'DKK', dec:2, sym:'kr',   ja:'デンマーククローネ',   en:'Danish Krone' },
  { code:'ISK', dec:0, sym:'kr',   ja:'アイスランドクローナ', en:'Icelandic Krona' },
  { code:'PLN', dec:2, sym:'zł',   ja:'ポーランドズロチ',     en:'Polish Zloty' },
  { code:'HUF', dec:0, sym:'Ft',   ja:'ハンガリーフォリント', en:'Hungarian Forint' },
  { code:'CZK', dec:2, sym:'Kč',   ja:'チェココルナ',        en:'Czech Koruna' },
  { code:'RON', dec:2, sym:'lei',  ja:'ルーマニアレウ',      en:'Romanian Leu' },
  { code:'CAD', dec:2, sym:'C$',   ja:'カナダドル',          en:'Canadian Dollar' },
  { code:'AUD', dec:2, sym:'A$',   ja:'豪ドル',              en:'Australian Dollar' },
  { code:'NZD', dec:2, sym:'NZ$',  ja:'ニュージーランドドル', en:'New Zealand Dollar' },
  { code:'FJD', dec:2, sym:'FJ$',  ja:'フィジードル',        en:'Fijian Dollar' },
  { code:'SGD', dec:2, sym:'S$',   ja:'シンガポールドル',     en:'Singapore Dollar' },
  { code:'HKD', dec:2, sym:'HK$',  ja:'香港ドル',            en:'Hong Kong Dollar' },
  { code:'TWD', dec:2, sym:'NT$',  ja:'台湾ドル',            en:'New Taiwan Dollar' },
  { code:'KRW', dec:0, sym:'₩',    ja:'韓国ウォン',          en:'South Korean Won' },
  { code:'CNY', dec:2, sym:'¥',    ja:'中国元',              en:'Chinese Yuan' },
  { code:'THB', dec:2, sym:'฿',    ja:'タイバーツ',          en:'Thai Baht' },
  { code:'MYR', dec:2, sym:'RM',   ja:'マレーシアリンギット', en:'Malaysian Ringgit' },
  { code:'IDR', dec:0, sym:'Rp',   ja:'インドネシアルピア',   en:'Indonesian Rupiah' },
  { code:'PHP', dec:2, sym:'₱',    ja:'フィリピンペソ',      en:'Philippine Peso' },
  { code:'VND', dec:0, sym:'₫',    ja:'ベトナムドン',        en:'Vietnamese Dong' },
  { code:'BND', dec:2, sym:'B$',   ja:'ブルネイドル',        en:'Brunei Dollar' },
  { code:'INR', dec:2, sym:'₹',    ja:'インドルピー',        en:'Indian Rupee' },
  { code:'EGP', dec:2, sym:'E£',   ja:'エジプトポンド',      en:'Egyptian Pound' },
  { code:'ETB', dec:2, sym:'Br',   ja:'エチオピアブル',      en:'Ethiopian Birr' },
  { code:'KES', dec:2, sym:'KSh',  ja:'ケニアシリング',      en:'Kenyan Shilling' },
  { code:'ZAR', dec:2, sym:'R',    ja:'南アフリカランド',     en:'South African Rand' },
  { code:'MXN', dec:2, sym:'MX$',  ja:'メキシコペソ',        en:'Mexican Peso' },
  { code:'BRL', dec:2, sym:'R$',   ja:'ブラジルレアル',      en:'Brazilian Real' },
  { code:'CLP', dec:0, sym:'CLP$', ja:'チリペソ',            en:'Chilean Peso' },
  { code:'COP', dec:2, sym:'COL$', ja:'コロンビアペソ',      en:'Colombian Peso' },
];

/* 居住国・国籍（ISO 3166-1 alpha-2）。
   ★名前は持たない。ブラウザの Intl.DisplayNames が ja/en を出す。
   ここに和名・英名を書くと、2箇所目の SSOT ができて必ず食い違う。
   コードが実在するかは gen-vocab.mjs が node 側で機械的に検品する
   （打ち間違えた 'JN' が利用者に生のまま出るのを防ぐ）。 */
export const COUNTRIES = [
  'AD','AE','AF','AG','AI','AL','AM','AO','AR','AS','AT','AU','AW','AX','AZ',
  'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BW','BY','BZ',
  'CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ',
  'DE','DJ','DK','DM','DO','DZ',
  'EC','EE','EG','EH','ER','ES','ET',
  'FI','FJ','FK','FM','FO','FR',
  'GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GT','GU','GW','GY',
  'HK','HN','HR','HT','HU',
  'ID','IE','IL','IM','IN','IQ','IR','IS','IT',
  'JE','JM','JO','JP',
  'KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ',
  'LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY',
  'MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ',
  'NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ',
  'OM',
  'PA','PE','PF','PG','PH','PK','PL','PM','PR','PS','PT','PW','PY',
  'QA',
  'RE','RO','RS','RU','RW',
  'SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ',
  'TC','TD','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ',
  'UA','UG','US','UY','UZ',
  'VA','VC','VE','VG','VI','VN','VU',
  'WF','WS',
  'YE','YT',
  'ZA','ZM','ZW',
];

/* 居住国の select で「上」に出す国。★244件を五十音順に並べると、実際に
   パイロットが納税している国が全部その他大勢に埋もれる。上に出すのは
   「このサイトを使う人が実際に住んでいる国」。残りは <optgroup>「その他の国」
   に畳むので、どの国の人も選べる（減らすのは並び順であって選択肢ではない）。

   ★中身は ja / en で同じ31か国。違うのは順番だけ。日本語で見ている人には
     日本を先頭に、英語で見ている人には米国・湾岸・シンガポールを先頭にする。 */
const MAIN_JA = [
  'JP',                                       // 日本語で見ている人はまず日本
  'AE','QA','SG','HK',                        // 日本人パイロットの主な移籍先
  'US','AU','GB','NZ','CA',
  'KR','CN','TW','TH','VN','MY','ID','PH','IN',
  'DE','FR','NL','IE','CH','ES','IT','TR',
  'SA','KW','BH','OM',
];
const MAIN_EN = [
  'US',                                       // 英語で見ている人はまず米国
  'AE','QA','SA','KW','BH','OM',              // 中東
  'SG','HK','MY','TH','VN','ID','PH','IN',    // アジア
  'JP','KR','CN','TW',
  'AU','NZ','CA',
  'GB','IE','DE','FR','NL','CH','ES','IT','TR',
];
export const COUNTRIES_MAIN = { ja: MAIN_JA, en: MAIN_EN };

/* 居住国の所得税「既定値」。★自動で決めない。フォームに 0% を差し出すだけで、
   本人が確認・上書きする（送信されるのは本人が確定した値）。
   ここに載せるのは「給与所得に個人所得税が無い」ことが明確な国だけ。
   曖昧な国は載せない——空欄のほうが、それらしい嘘の数字よりはるかに良い。 */
export const TAX_DEFAULT_ZERO = ['AE','QA','KW','BH','OM','SA','BN','KY','BM','BS','MC'];

/* 市民権に基づいて課税する国。居住国が 0% でも 0% にならない。
   ★該当したら必ず画面で警告する（既定値の 0% をそのまま出すと嘘になる）。 */
export const CITIZENSHIP_TAXED = ['US','ER'];

/* ════════════════════════════════════════════════════════════════
   所得税率の自動概算（居住国 × 年収 → だいたいの実効税率）

   ★ここに載せるのは、その国の税務当局が公表している数字だけ。
     出所を src に書けない国は載せない＝欄は空のまま。
     「それらしい数字」を出すくらいなら空欄のほうが良い（DATA-PROVENANCE.md）。

   ★入っていないもの（＝実際より高めに出る方向の誤差）
     社会保険料控除・扶養控除・住宅ローン控除などの個人ごとの控除。
     日本の年収1,200万の例で、実際より5ポイントほど高く出る。
     画面にそう書いて、本人が明細の数字で上書きできるようにしてある。

   ★入っていないもの（＝国によっては足りない方向の誤差）
     米国の州税、英国スコットランドの別税率。これも画面に書く。
   ════════════════════════════════════════════════════════════════ */
export const TAX_TABLE = {
  /* 日本：給与所得控除 → 基礎控除 → 速算表 → 復興特別所得税 → 住民税所得割。
     ★住民税の基礎控除は所得税と別（43万）だが、ここでは所得税側を使い回している。
       差は年収1,200万で 0.13 ポイント。上の社会保険料の誤差に対して無視できる。 */
  JP: {
    cur: 'JPY',
    src: [
      'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm', // 速算表・復興特別所得税
      'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm', // 給与所得控除（令和7年分以降）
      'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1199.htm', // 基礎控除（令和7年分改正後）
      'https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/150790_06.html', // 住民税所得割10%
    ],
    as_of: '2026-08-12',
    // 給与所得控除 [収入金額の上限, 率, 加算額]（null = 上限なし）
    emp: [[1900000, 0, 650000], [3600000, 0.30, 80000], [6600000, 0.20, 440000],
          [8500000, 0.10, 1100000], [null, 0, 1950000]],
    // 基礎控除 [合計所得金額の上限, 控除額]
    basic: [[1320000, 950000], [3360000, 580000], [4890000, 680000], [6550000, 630000],
            [23500000, 580000], [24000000, 480000], [24500000, 320000], [25000000, 160000], [null, 0]],
    // 所得税の速算表 [課税所得金額の上限, 率, 控除額]
    quick: [[1950000, 0.05, 0], [3300000, 0.10, 97500], [6950000, 0.20, 427500],
            [9000000, 0.23, 636000], [18000000, 0.33, 1536000], [40000000, 0.40, 2796000],
            [null, 0.45, 4796000]],
    surtax: 0.021,   // 復興特別所得税（基準所得税額の2.1%）
    local: 0.10,     // 住民税 所得割（道府県民税4% + 市町村民税6%）
  },

  /* 英国：Personal Allowance を引いて累進バンド。10万ポンド超で控除が2ポンドにつき
     1ポンドずつ消える。★イングランド・ウェールズ・北アイルランドの税率。
     スコットランドは別税率なので、当てはまらない人は上書きしてもらう。 */
  GB: {
    cur: 'GBP',
    src: ['https://www.gov.uk/income-tax-rates'],
    as_of: '2026-08-12',
    allow: 12570, taperFrom: 100000, taperRate: 0.5,
    // [課税所得の上限, 率]
    bands: [[37700, 0.20], [125140, 0.40], [null, 0.45]],
    note: 'gb-scotland',
  },

  /* 米国：連邦税のみ・Single。★州税は含まない（カリフォルニアやニューヨークに
     住んでいる人は実際にはこれより高い）。画面にそう書く。 */
  US: {
    cur: 'USD',
    src: ['https://www.irs.gov/filing/federal-income-tax-rates-and-brackets',
          'https://www.irs.gov/publications/p17'],
    as_of: '2026-08-12',
    std: 15750,
    bands: [[11925, 0.10], [48475, 0.12], [103350, 0.22], [197300, 0.24],
            [250525, 0.32], [626350, 0.35], [null, 0.37]],
    note: 'us-state',
  },
};
