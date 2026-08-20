/* ════════════════════════════════════════════════════════════════
   airline-countries.mjs — 航空会社110社 → 国 の対応表と、国別のメタ情報

   なぜ別ファイルか: salary-data.mjs は「年収の唯一の正」であって、
   そこに国名・免許当局・査証といった別種の事実を混ぜると
   年収更新のたびに関係ない行を触ることになる。年収は SSOT、
   国はここ、と役割を分ける。年収は必ず SALARY 側から読むこと。

   用途
     - countries/{slug}.html / en/countries/{slug}.html の生成
     - OGP 画像の国別カード
     - world-airlines.html の国別ナビ

   ★ 国が特定できない2社（欧州チャーター/アジア紹介エージェント）は
     country:null にしてある。推測で国を埋めない（VERIFIED-PILOT の原則）。
════════════════════════════════════════════════════════════════ */

/* ── 会社 → ISO 3166-1 alpha-2 ─────────────────────────────── */
export const AIRLINE_COUNTRY = {
  // 日本
  'ana': 'JP', 'jal': 'JP', 'zipair': 'JP', 'jetstar-japan': 'JP', 'peach': 'JP',
  'solaseed': 'JP', 'spring-japan': 'JP', 'airdo': 'JP', 'starflyer': 'JP',
  'skymark': 'JP', 'fda': 'JP', 'airjapan': 'JP', 'amx': 'JP', 'ana-wings': 'JP',
  'daiichi-air': 'JP', 'hac': 'JP', 'ibex': 'JP', 'j-air': 'JP', 'jac': 'JP',
  'jta': 'JP', 'orc': 'JP', 'rac': 'JP', 'shin-central': 'JP', 'shin-nihon': 'JP',
  'toho-air': 'JP', 'toki-air': 'JP',
  // 中東
  'emirates': 'AE', 'etihad': 'AE', 'qatar-airways': 'QA', 'gulf-air': 'BH',
  'kuwait-airways': 'KW', 'oman-air': 'OM', 'riyadh-air': 'SA', 'saudia': 'SA',
  'royal-jordanian': 'JO',
  // 北米
  'united': 'US', 'delta': 'US', 'american': 'US', 'southwest': 'US',
  'alaska-airlines': 'US', 'allegiant': 'US', 'breeze-airways': 'US',
  'frontier': 'US', 'jetblue': 'US', 'spirit': 'US', 'solairus': 'US',
  'air-canada': 'CA', 'porter': 'CA', 'westjet': 'CA',
  // 欧州
  'british-airways': 'GB', 'easyjet': 'GB', 'virgin-atlantic': 'GB', 'wizz-air': 'GB',
  'klm': 'NL', 'air-france': 'FR', 'lufthansa': 'DE', 'eurowings': 'DE', 'austrian': 'AT',
  'swiss': 'CH', 'aer-lingus': 'IE', 'ryanair': 'IE', 'iberia': 'ES',
  'vueling': 'ES', 'tap': 'PT', 'ita-airways': 'IT', 'aegean': 'GR',
  'finnair': 'FI', 'icelandair': 'IS', 'lot': 'PL', 'norwegian': 'NO',
  'sas': 'SE', 'turkish-airlines': 'TR', 'airx-charter': 'MT',
  // アジア太平洋
  'cathay-pacific': 'HK', 'hong-kong-express': 'HK',
  'singapore-airlines': 'SG', 'scoot': 'SG',
  'korean-air': 'KR', 'asiana': 'KR',
  'starlux': 'TW', 'china-airlines': 'TW', 'eva-air': 'TW',
  'air-china': 'CN', 'china-eastern': 'CN', 'china-southern': 'CN', 'hainan-airlines': 'CN',
  'thai-airways': 'TH', 'air-india': 'IN', 'indigo': 'IN',
  'airasia': 'MY', 'malaysia-airlines': 'MY',
  'garuda-indonesia': 'ID', 'batik-air': 'ID',
  'philippine-airlines': 'PH', 'royal-brunei': 'BN',
  'bamboo-airways': 'VN', 'vietjet': 'VN', 'vietnam-airlines': 'VN',
  'qantas': 'AU', 'jetstar': 'AU', 'air-new-zealand': 'NZ', 'fiji-airways': 'FJ',
  // アフリカ
  'egyptair': 'EG', 'ethiopian-airlines': 'ET', 'kenya-airways': 'KE',
  'south-african-airways': 'ZA',
  // 中南米
  'aeromexico': 'MX', 'avianca': 'CO', 'copa-airlines': 'PA', 'latam': 'CL',
  // 国が特定できない（紹介エージェント / 多国籍チャーター）
  'eagle-jet': null, 'root-aviation': null,
};

/* ── 国のメタ情報 ───────────────────────────────────────────
   slug   … URL（/countries/{slug}.html）
   auth   … 操縦士免許の発給当局。「その国で飛ぶには何のライセンスが要るか」
            は転職検討者が最初に当たる壁で、国別ページの中核の情報。
   tax    … 個人所得税。'none' は給与に個人所得税が課されない国。
            salary-data.mjs の taxFree と一致していること（check で検証）。
   hub    … 国別ページを作る対象か。2社以上、または主要フラッグキャリアを持つ国。
   enIn   … 英語の「文中に置く形」。冠詞と短縮形はここに入れる。
            en をそのまま文に入れると "Pilot Salary in United States" になり、
            英語として壊れている（普通は the USA、the UK、the Netherlands）。
            持たない国（Japan / Singapore / Germany …）は en がそのまま自然。
   enFull … 本文の初出で一度だけ出す正式名。冠詞つき。
            enIn が略称の国だけ意味を持つ。
   ※ 表のセル・チャートのラベル・keywords には冠詞なしの en を使う。
     文ではないところに "the" を付けない。
   ※ 日本語は 日本 / アメリカ / イギリス がそのまま自然なので別名を持たせない。
   ── 免許・税制は 2026-08 時点。制度変更があり得るのでページ側では
      「渡航前に必ず当局の最新情報を確認」と明記する。                     */
export const COUNTRIES = [
  { code:'JP', slug:'japan',          flag:'🇯🇵', ja:'日本',           en:'Japan',          auth:'JCAB', tax:'normal', hub:true },
  { code:'US', slug:'united-states',  flag:'🇺🇸', ja:'アメリカ',       en:'United States',  auth:'FAA',  tax:'normal', hub:true, enIn:'the USA', enFull:'the United States' },
  { code:'AE', slug:'uae',            flag:'🇦🇪', ja:'アラブ首長国連邦', en:'United Arab Emirates', auth:'GCAA', tax:'none', hub:true, enIn:'the UAE', enFull:'the United Arab Emirates' },
  { code:'QA', slug:'qatar',          flag:'🇶🇦', ja:'カタール',       en:'Qatar',          auth:'QCAA', tax:'none',   hub:true },
  { code:'SA', slug:'saudi-arabia',   flag:'🇸🇦', ja:'サウジアラビア', en:'Saudi Arabia',   auth:'GACA', tax:'none',   hub:true },
  { code:'GB', slug:'united-kingdom', flag:'🇬🇧', ja:'イギリス',       en:'United Kingdom', auth:'UK CAA', tax:'normal', hub:true, enIn:'the UK', enFull:'the United Kingdom' },
  { code:'DE', slug:'germany',        flag:'🇩🇪', ja:'ドイツ',         en:'Germany',        auth:'EASA', tax:'normal', hub:true },
  { code:'FR', slug:'france',         flag:'🇫🇷', ja:'フランス',       en:'France',         auth:'EASA', tax:'normal', hub:true },
  { code:'NL', slug:'netherlands',    flag:'🇳🇱', ja:'オランダ',       en:'Netherlands',    auth:'EASA', tax:'normal', hub:true, enIn:'the Netherlands' },
  { code:'IE', slug:'ireland',        flag:'🇮🇪', ja:'アイルランド',   en:'Ireland',        auth:'EASA', tax:'normal', hub:true },
  { code:'ES', slug:'spain',          flag:'🇪🇸', ja:'スペイン',       en:'Spain',          auth:'EASA', tax:'normal', hub:true },
  { code:'CH', slug:'switzerland',    flag:'🇨🇭', ja:'スイス',         en:'Switzerland',    auth:'EASA', tax:'normal', hub:true },
  { code:'TR', slug:'turkey',         flag:'🇹🇷', ja:'トルコ',         en:'Turkey',         auth:'SHGM', tax:'normal', hub:true },
  { code:'SG', slug:'singapore',      flag:'🇸🇬', ja:'シンガポール',   en:'Singapore',      auth:'CAAS', tax:'normal', hub:true },
  { code:'HK', slug:'hong-kong',      flag:'🇭🇰', ja:'香港',           en:'Hong Kong',      auth:'HKCAD', tax:'normal', hub:true },
  { code:'CN', slug:'china',          flag:'🇨🇳', ja:'中国',           en:'China',          auth:'CAAC', tax:'normal', hub:true },
  { code:'TW', slug:'taiwan',         flag:'🇹🇼', ja:'台湾',           en:'Taiwan',         auth:'CAA',  tax:'normal', hub:true },
  { code:'KR', slug:'south-korea',    flag:'🇰🇷', ja:'韓国',           en:'South Korea',    auth:'MOLIT', tax:'normal', hub:true },
  { code:'TH', slug:'thailand',       flag:'🇹🇭', ja:'タイ',           en:'Thailand',       auth:'CAAT', tax:'normal', hub:true },
  { code:'VN', slug:'vietnam',        flag:'🇻🇳', ja:'ベトナム',       en:'Vietnam',        auth:'CAAV', tax:'normal', hub:true },
  { code:'MY', slug:'malaysia',       flag:'🇲🇾', ja:'マレーシア',     en:'Malaysia',       auth:'CAAM', tax:'normal', hub:true },
  { code:'ID', slug:'indonesia',      flag:'🇮🇩', ja:'インドネシア',   en:'Indonesia',      auth:'DGCA', tax:'normal', hub:true },
  { code:'IN', slug:'india',          flag:'🇮🇳', ja:'インド',         en:'India',          auth:'DGCA', tax:'normal', hub:true },
  { code:'PH', slug:'philippines',    flag:'🇵🇭', ja:'フィリピン',     en:'Philippines',    auth:'CAAP', tax:'normal', hub:true, enIn:'the Philippines' },
  { code:'AU', slug:'australia',      flag:'🇦🇺', ja:'オーストラリア', en:'Australia',      auth:'CASA', tax:'normal', hub:true },
  { code:'NZ', slug:'new-zealand',    flag:'🇳🇿', ja:'ニュージーランド', en:'New Zealand',  auth:'CAA NZ', tax:'normal', hub:true },
  { code:'CA', slug:'canada',         flag:'🇨🇦', ja:'カナダ',         en:'Canada',         auth:'Transport Canada', tax:'normal', hub:true },
  // 以下は掲載1社・ページは作らないが国名表示には使う
  { code:'BH', slug:'bahrain',        flag:'🇧🇭', ja:'バーレーン',     en:'Bahrain',        auth:'BCAA', tax:'none',   hub:false },
  { code:'KW', slug:'kuwait',         flag:'🇰🇼', ja:'クウェート',     en:'Kuwait',         auth:'DGCA', tax:'none',   hub:false },
  { code:'OM', slug:'oman',           flag:'🇴🇲', ja:'オマーン',       en:'Oman',           auth:'CAA',  tax:'none',   hub:false },
  { code:'JO', slug:'jordan',         flag:'🇯🇴', ja:'ヨルダン',       en:'Jordan',         auth:'CARC', tax:'normal', hub:false },
  { code:'BN', slug:'brunei',         flag:'🇧🇳', ja:'ブルネイ',       en:'Brunei',         auth:'DCA',  tax:'none',   hub:false },
  { code:'AT', slug:'austria',        flag:'🇦🇹', ja:'オーストリア',   en:'Austria',        auth:'EASA', tax:'normal', hub:false },
  { code:'PT', slug:'portugal',       flag:'🇵🇹', ja:'ポルトガル',     en:'Portugal',       auth:'EASA', tax:'normal', hub:false },
  { code:'IT', slug:'italy',          flag:'🇮🇹', ja:'イタリア',       en:'Italy',          auth:'EASA', tax:'normal', hub:false },
  { code:'GR', slug:'greece',         flag:'🇬🇷', ja:'ギリシャ',       en:'Greece',         auth:'EASA', tax:'normal', hub:false },
  { code:'FI', slug:'finland',        flag:'🇫🇮', ja:'フィンランド',   en:'Finland',        auth:'EASA', tax:'normal', hub:false },
  { code:'IS', slug:'iceland',        flag:'🇮🇸', ja:'アイスランド',   en:'Iceland',        auth:'EASA', tax:'normal', hub:false },
  { code:'PL', slug:'poland',         flag:'🇵🇱', ja:'ポーランド',     en:'Poland',         auth:'EASA', tax:'normal', hub:false },
  { code:'NO', slug:'norway',         flag:'🇳🇴', ja:'ノルウェー',     en:'Norway',         auth:'EASA', tax:'normal', hub:false },
  { code:'SE', slug:'sweden',         flag:'🇸🇪', ja:'スウェーデン',   en:'Sweden',         auth:'EASA', tax:'normal', hub:false },
  { code:'MT', slug:'malta',          flag:'🇲🇹', ja:'マルタ',         en:'Malta',          auth:'EASA', tax:'normal', hub:false },
  { code:'EG', slug:'egypt',          flag:'🇪🇬', ja:'エジプト',       en:'Egypt',          auth:'ECAA', tax:'normal', hub:false },
  { code:'ET', slug:'ethiopia',       flag:'🇪🇹', ja:'エチオピア',     en:'Ethiopia',       auth:'ECAA', tax:'normal', hub:false },
  { code:'KE', slug:'kenya',          flag:'🇰🇪', ja:'ケニア',         en:'Kenya',          auth:'KCAA', tax:'normal', hub:false },
  { code:'ZA', slug:'south-africa',   flag:'🇿🇦', ja:'南アフリカ',     en:'South Africa',   auth:'SACAA', tax:'normal', hub:false },
  { code:'MX', slug:'mexico',         flag:'🇲🇽', ja:'メキシコ',       en:'Mexico',         auth:'AFAC', tax:'normal', hub:false },
  { code:'CO', slug:'colombia',       flag:'🇨🇴', ja:'コロンビア',     en:'Colombia',       auth:'Aerocivil', tax:'normal', hub:false },
  { code:'PA', slug:'panama',         flag:'🇵🇦', ja:'パナマ',         en:'Panama',         auth:'AAC',  tax:'normal', hub:false },
  { code:'CL', slug:'chile',          flag:'🇨🇱', ja:'チリ',           en:'Chile',          auth:'DGAC', tax:'normal', hub:false },
  { code:'FJ', slug:'fiji',           flag:'🇫🇯', ja:'フィジー',       en:'Fiji',           auth:'CAAF', tax:'normal', hub:false },
];

export const BY_CODE = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));
export const HUBS = COUNTRIES.filter((c) => c.hub);

/** 英語の文中に置く国名（"pilot salary in ___" の ___）。冠詞・略称つき。 */
export const nameIn = (c) => c.enIn || c.en;
/** 英語の本文の初出で一度だけ出す正式名。冠詞つき。 */
export const nameFull = (c) => c.enFull || c.enIn || c.en;

/** 国コード → その国の会社 slug 配列（SALARY のキー順を保つ） */
export function airlinesOf(code, SALARY) {
  return Object.keys(SALARY).filter((slug) => AIRLINE_COUNTRY[slug] === code);
}
