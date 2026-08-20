import fs from 'fs';
import path from 'path';

const DIR = './airlines';

// [slug, newTitle, newDescription, newOgTitle, newOgDescription]
const UPDATES = [
  // ANA
  ['ana',
    'ANA機長の手取りは月147万円——多くの人が知らない"税引き後の実態"【2026年最新】 | PILOT VALUE',
    'ANA機長の手取りは月147万円。年収2,700万でも「割に合わない」と言われる理由とは？JAL比較・機種別差・昇格年数まで実態を公開。',
    'ANA機長の手取りは月147万円——税引き後の実態【2026年最新】 | PILOT VALUE',
    'ANA機長の手取りは月147万円。年収2,700万でも割に合わないと言われる理由・JAL比較・機種別差を解説。'],

  // ANA vs JAL
  ['ana-vs-jal',
    'ANA vs JAL、年収は同じ2,700万でも「手取り・昇格・機種」で差が出る理由【2026年最新】 | PILOT VALUE',
    'ANA・JAL両社とも機長平均2,700万円。でも手取り・昇格スピード・機種で"本当の差"がある。全16項目で徹底比較。どちらに入社すべきか解説。',
    'ANA vs JAL 年収は同じでも「手取り・昇格・機種」で差が出る理由【2026年】 | PILOT VALUE',
    'ANA・JALの機長年収は同じ2,700万円。でも手取り・昇格スピード・機種で本当の差がある。全16項目で徹底比較。'],

  // Emirates
  ['emirates',
    'エミレーツ航空パイロットの"非課税4,500万"——ドバイ勤務の実態と日本人が知らない落とし穴【2026年】 | PILOT VALUE',
    'エミレーツ機長の年収4,500万円は「非課税」。ANA比で手取りが約2倍になる仕組みと、ドバイ単身赴任・家族帯同の現実を解説。',
    'エミレーツ航空パイロット"非課税4,500万"の実態——ドバイ勤務の落とし穴【2026年】 | PILOT VALUE',
    'エミレーツ機長の年収4,500万円は非課税。ANA比で手取り約2倍の仕組みとドバイ勤務の現実を解説。'],

  // Singapore Airlines
  ['singapore-airlines',
    'シンガポール航空パイロットの年収3,500万——アジア最高水準の実態と転職のリアル【2026年】 | PILOT VALUE',
    'シンガポール航空機長の年収はANAの約1.3倍。アジア最高水準の給与体系と転職ルート、シンガポール生活の実態を解説。',
    'シンガポール航空パイロット年収3,500万——アジア最高水準の実態【2026年】 | PILOT VALUE',
    'シンガポール航空機長の年収はANAの約1.3倍。アジア最高水準の給与体系と転職ルートを解説。'],

  // Qatar Airways
  ['qatar-airways',
    'カタール航空パイロットの年収3,800万（非課税）——ドーハ勤務の実態と日本人転職者のリアル【2026年】 | PILOT VALUE',
    'カタール航空機長の年収3,800万円は非課税。ANA・JALから転職した日本人パイロットの実態と、ドーハ生活のリアルを解説。',
    'カタール航空パイロット年収3,800万（非課税）——ドーハ勤務の実態【2026年】 | PILOT VALUE',
    'カタール航空機長の年収3,800万円は非課税。日本人パイロットの転職実態とドーハ生活のリアルを解説。'],

  // Cathay Pacific
  ['cathay-pacific',
    'キャセイパシフィック航空パイロットの年収最大4,000万——香港勤務の実態と日本人転職者の現実【2026年】 | PILOT VALUE',
    'キャセイパシフィック機長の年収は最大4,000万円。香港の高コスト生活込みの手取り実態と日本人パイロットの転職リアルを解説。',
    'キャセイパシフィック航空パイロット年収最大4,000万——香港勤務の実態【2026年】 | PILOT VALUE',
    'キャセイパシフィック機長の年収は最大4,000万円。香港生活コスト込みの手取り実態と転職リアルを解説。'],

  // Lufthansa
  ['lufthansa',
    'ルフトハンザ航空パイロットの年収最大5,000万——欧州最高水準の実態とドイツ勤務のリアル【2026年】 | PILOT VALUE',
    'ルフトハンザ機長の年収は最大5,000万円。欧州最高水準の給与体系と、フランクフルト勤務・税金・生活コストの実態を解説。',
    'ルフトハンザ航空パイロット年収最大5,000万——欧州最高水準の実態【2026年】 | PILOT VALUE',
    'ルフトハンザ機長の年収は最大5,000万円。欧州最高水準の給与とフランクフルト勤務の実態を解説。'],

  // Delta
  ['delta',
    'デルタ航空パイロットの年収9,000万——「世界最高水準の給料」の実態とアメリカ勤務のリアル【2026年】 | PILOT VALUE',
    'デルタ航空機長の年収は最大9,000万円。ANA・JALの3倍超になる仕組みと、米国勤務・税金・生活コストの実態を解説。',
    'デルタ航空パイロット年収9,000万——世界最高水準の給料の実態【2026年】 | PILOT VALUE',
    'デルタ航空機長の年収は最大9,000万円。ANAの3倍超になる仕組みと米国勤務の実態を解説。'],

  // United Airlines
  ['united',
    'ユナイテッド航空パイロットの年収8,500万——ANAの3倍の給料、その仕組みと実態【2026年】 | PILOT VALUE',
    'ユナイテッド航空機長の年収は最大8,500万円。ANA・JALの約3倍になる仕組みと米国航空会社への転職実態を解説。',
    'ユナイテッド航空パイロット年収8,500万——ANAの3倍の給料の仕組み【2026年】 | PILOT VALUE',
    'ユナイテッド航空機長の年収は最大8,500万円。ANAの約3倍になる仕組みと米国転職の実態を解説。'],

  // American Airlines
  ['american',
    'アメリカン航空パイロットの年収8,000万——ANAの3倍の給料の理由と実態【2026年】 | PILOT VALUE',
    'アメリカン航空機長の年収は6,500万〜8,000万円。ANAの約3倍になる理由と米国パイロット転職のリアルを解説。',
    'アメリカン航空パイロット年収8,000万——ANAの3倍の給料の理由【2026年】 | PILOT VALUE',
    'アメリカン航空機長の年収は最大8,000万円。ANAの約3倍になる理由と米国転職のリアルを解説。'],

  // Southwest
  ['southwest',
    'サウスウエスト航空パイロットの年収7,000万——LCCなのにANAの2.5倍の謎を解説【2026年】 | PILOT VALUE',
    'サウスウエスト航空機長の年収は5,500万〜7,000万円。LCCなのにANA・JALの2倍以上になる仕組みと実態を解説。',
    'サウスウエスト航空パイロット年収7,000万——LCCなのにANAの2.5倍の謎【2026年】 | PILOT VALUE',
    'サウスウエスト航空機長の年収は最大7,000万円。LCCなのにANAの2倍以上になる仕組みを解説。'],

  // Etihad
  ['etihad',
    'エティハド航空パイロットの年収3,500万（非課税）——アブダビ勤務の実態とエミレーツとの違い【2026年】 | PILOT VALUE',
    'エティハド航空機長の年収3,500万円は非課税。エミレーツ・カタールとの待遇比較とアブダビ勤務の実態を解説。',
    'エティハド航空パイロット年収3,500万（非課税）——アブダビ勤務の実態【2026年】 | PILOT VALUE',
    'エティハド航空機長の年収3,500万円は非課税。エミレーツとの比較とアブダビ勤務の実態を解説。'],
];

let updated = 0;
let notFound = [];

for (const [slug, title, desc, ogTitle, ogDesc] of UPDATES) {
  const fp = path.join(DIR, `${slug}.html`);
  if (!fs.existsSync(fp)) { notFound.push(slug); continue; }

  let html = fs.readFileSync(fp, 'utf8');

  // Replace title
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);

  // Replace meta description
  html = html.replace(
    /<meta name="description" content="[^"]*"/,
    `<meta name="description" content="${desc}"`
  );

  // Replace OG title
  html = html.replace(
    /<meta property="og:title" content="[^"]*"/,
    `<meta property="og:title" content="${ogTitle}"`
  );

  // Replace OG description
  html = html.replace(
    /<meta property="og:description" content="[^"]*"/,
    `<meta property="og:description" content="${ogDesc}"`
  );

  fs.writeFileSync(fp, html, 'utf8');
  console.log(`✓ ${slug}`);
  updated++;
}

console.log(`\n完了: ${updated}ページ更新`);
if (notFound.length) console.log(`見つからず: ${notFound.join(', ')}`);
