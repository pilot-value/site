/* ════════════════════════════════════════════════════════════════
   gen-new-airline.mjs
   航空会社を1社ぶん、日本語版と英語版のページとして新規に起こす。

     salary-data.mjs（SSOT）──┬─→ airlines/{slug}.html
                              └─→ en/airlines/{slug}.html

   ★ なぜ既存の生成器を使わないか
     gen_europe.mjs / gen_asia.mjs / generate_airlines.mjs は
     (1) 110社を丸ごと上書きする  (2) 年収を SSOT ではなく自前でハードコードしている
     ため、1社足すために流すと更新済みの数値が全社ぶん巻き戻る（CLAUDE.md の禁止リスト）。
     ここでは「1社だけ・SSOT から・既存ファイルには絶対に書かない」を守る。

   ★ 作り
     既存ページ（DONOR）から head・nav・footer・スクリプトの“外枠”だけを借り、
     本文は CONTENT に書いたものへ丸ごと差し替える。
     借り物の本文が1行でも残ると他社の事実が混ざるので、
     最後に DONOR 固有の語が残っていないかを検査して、残っていたら書かずに落とす。

   ★ パイプラインに渡す前提（この順で自動的に埋まる）
     ・<!--PV-FAQ-->   … 日本語は gen-faq.mjs が SSOT から起こす（なのでここでは書かない）。
                          英語は gen-faq.mjs が“足す”だけなので、可視FAQはここで書く。
     ・<!--PV-SEO-->   … seo-normalize.mjs（title/description/canonical/hreflang/og/Occupation）
     ・<!--PV-CLINK--> … link-countries.mjs
     ただし FAQPage の JSON-LD は gen-faq.mjs が「既にある FAQPage の中身を差し替える」
     作りなので、空の FAQPage を最初から置いておく必要がある。

   実行: node gen-new-airline.mjs eurowings
        node gen-new-airline.mjs eurowings --force   （既存ファイルを上書き。通常は使わない）
   ════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { SALARY } from './salary-data.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/%20/g, ' ');
const FORCE = process.argv.includes('--force');
const slug = process.argv[2];

if (!slug || slug.startsWith('--')) {
  console.error('使い方: node gen-new-airline.mjs <slug>');
  process.exit(1);
}
if (!SALARY[slug]) {
  console.error(`✗ salary-data.mjs（SSOT）に居ない: ${slug}\n  先に SSOT へ追加すること。ページだけ作っても数値の出どころが無い。`);
  process.exit(1);
}

/* ── 数値ヘルパ。すべて SSOT 由来。ページに数字を直接書かない ────── */
const A = SALARY[slug];
const man = (v) => `¥${v.toLocaleString('en-US')}万`;          // 日本語: ¥2,770万
/* 範囲は既存110枚と同じ「¥A万〜B万」（¥は先頭だけ・単位を共有）。
   currency.js:84 がこの形を範囲として1トークンで拾う。両端に ¥ を付けると別トークン扱いで
   間違いではないが、幅が広がるうえサイト内で表記が2種類になるので合わせる。 */
const manR = (o) => `${man(o.lo)}〜${o.hi.toLocaleString('en-US')}万`;
/* 英語ページは既存110枚が ¥27M 形式。currency.js の変換対象なので形を揃える。 */
const mm = (v) => `¥${(v / 100).toFixed(1).replace(/\.0$/, '')}M`;
const mmR = (o) => `${mm(o.lo)}–${mm(o.hi)}`;
const pct = (v, max) => Math.round((v / max) * 100);
/* 本文を書く関数（faqEn / payScaleEn.rows）に渡すヘルパ一式。
   ここを経由させることで、CONTENT 側に生の数字を書く手段が無くなる。 */
const H = { A, man, manR, mm, mmR, ana: SALARY.ana, jal: SALARY.jal, SALARY };

/* ════════════════════════════════════════════════════════════════
   本文。1社につきここだけ書く。
   ★ 事実は調べて書く。テンプレの穴埋めで水増ししない。
   ★ 年収は上のヘルパ経由でしか書かない（SSOT とズレる余地を作らない）。
   ★ 会社ごとに違う語は全部ここに置く。テンプレ側（bodyJa/bodyEn）に
     社名・機種・国・制度を1語も書かない。1社目の事実が2社目に混ざるため。
   ════════════════════════════════════════════════════════════════ */
const CONTENT = {
  eurowings: {
    code: 'EW',
    /* 借り元。同じ地域・同じ機材構成のページを選ぶ（外枠だけ借りる）。 */
    donor: 'easyjet',
    /* 借り元にしか出てこない語。1つでも残っていたら他社の事実が混ざっている。 */
    donorTokens: [
      'easyjet', 'easyJet', 'イージージェット', 'FF6600', 'ルートン', 'Luton',
      'GenX', 'ガトウィック', 'Gatwick', '英国最大', "UK's largest",
    ],
    /* ページ内のアクセント色。ブランド色そのもの（#8F174F）ではない。
       #8F174F はダーク背景 #0a0c0f に対してコントラスト 2.2:1 しか無く、見出しが読めない。
       同じ色相（H=332°）のまま明度だけ上げた #D74287 を使う ―― ダーク 4.7:1／ライト 4.2:1 で
       どちらのテーマでも読める。ブランド色を捨てたのではなく、そこから導出している。
       ブランド色そのものは airlines-meta.js（レベリング図・一覧の帯）に置いたまま。
       前例: カタール航空もブランド色 #5C0632 が暗すぎるので、ページでは #f472b6 を使っている。 */
    color: '#D74287',
    flag: '🇩🇪',
    countryJa: 'ドイツ', countryEn: 'Germany',
    tags: { ja: ['LCC', 'ルフトハンザ・グループ', '欧州'], en: ['LCC', 'Lufthansa Group', 'Europe'] },
    subtitleJa: 'Eurowings — ルフトハンザ・グループのポイント・トゥ・ポイント部門',
    subtitleEn: 'Eurowings — the Lufthansa Group’s point-to-point carrier, based in Düsseldorf.',
    statsJa: [['主力機材', 'A320ファミリー'], ['就航都市', '140都市+']],
    statsEn: [['Fleet', 'A320 family'], ['Destinations', '140+']],
    /* 外部リンク。1本目が主ボタン、2本目以降は従ボタン。
       ★ URL は必ず実際に叩いて 200 を確認してから書く。404 の外部リンクは減点材料。 */
    careers: [{ url: 'https://careers.eurowings.com/en/departments/cockpit-crew',
                ja: '採用ページへ（外部サイト）', en: 'Go to the careers page (external)' }],

    /* 年収表の行の添え書きとタグ。制度が社ごとに違うのでここに置く。 */
    rowSubJa: { cap: '欧州短中距離（A320族）', fo: '欧州短中距離' },
    rowSubEn: { cap: 'Short/medium haul, A320 family', fo: 'Short/medium haul' },
    payTag: { ja: 'EUR建て・税引前', en: 'Paid in EUR, pre-tax' },
    stepTag: { ja: '等級制（協約）', en: 'Collective-agreement steps' },
    tableNote: {
      ja: '※ 掲載年収は公開データ・労働協約を基にした参考値です。実際の給与条件は各社採用情報でご確認ください。',
      en: 'Reference values based on public data and the published collective agreement. Confirm exact terms with the airline.',
    },
    /* 構造化データの description の締め。社ごとに売りが違う。 */
    ldTail: {
      ja: '労働協約の等級表・採用条件・型式訓練の費用負担を解説。',
      en: 'Union pay scale, hiring requirements and company-funded type rating explained.',
    },

    /* 年収の根拠。ページの脚注にそのまま出す。推測を混ぜない。 */
    basisJa: '※ 金額は、ドイツの操縦士組合 Vereinigung Cockpit（VC）との労働協約の等級表'
      + '（2024年1月版・7%改定反映）を ¥172/EUR で換算した参考値。副操縦士は €74,090.50（1等級）〜€124,822.64（14等級）、'
      + '機長は €119,784.16（1等級）〜€202,254.79（23等級）。以降の年次改定は等級表の金額が公開されていないため上乗せしていない。',
    basisEn: 'Figures are converted at ¥172/EUR from the Vereinigung Cockpit (VC) collective agreement pay scale '
      + '(January 2024 table, including the 7% increase): first officers €74,090.50 (step 1) to €124,822.64 (step 14); '
      + 'captains €119,784.16 (step 1) to €202,254.79 (step 23). Later annual increases are not added on top, '
      + 'because the updated step values are not published.',

    overviewJa: 'ユーロウイングスはルフトハンザ・グループのポイント・トゥ・ポイント部門で、デュッセルドルフに本社を置く。'
      + 'A320ファミリーで統一したフリートを、ドイツ各地と欧州のベースから短中距離路線に投入する。長距離路線は持たない。'
      + '運賃はLCCの水準だが、コックピットの処遇はドイツの操縦士組合 Vereinigung Cockpit（VC）との労働協約に基づく等級表で決まり、'
      + '個別交渉ではなく等級と勤続で年収が動く。副操縦士は型式限定を持たずに応募でき、'
      + 'A320ファミリーの型式訓練費用は会社が負担する。自己負担型のLCCとはこの点が違う。',
    overviewEn: 'Eurowings is the Lufthansa Group’s point-to-point carrier, headquartered in Düsseldorf. '
      + 'It flies a single-family Airbus A320 fleet on short- and medium-haul routes from bases across Germany and Europe, '
      + 'and operates no long-haul network. Fares are low-cost, but cockpit pay is not individually negotiated: '
      + 'it is set by a collective agreement pay scale with the German pilots’ union Vereinigung Cockpit (VC), '
      + 'so a pilot’s annual figure follows their step and seniority. First officers may apply without a type rating — '
      + 'Eurowings covers the full A320-family type rating, which is what separates it from pay-to-fly low-cost operators.',

    factsJa: [
      ['本社', 'デュッセルドルフ（ドイツ）'],
      ['ベース', 'デュッセルドルフ・ケルン／ボン・ハンブルク・シュトゥットガルト ほか'],
      ['アライアンス', 'なし（ルフトハンザ・グループ）'],
      ['設立', '1993年（2015年に低コスト部門として再編）'],
      ['主力機材', 'エアバス A319 / A320 / A320neo / A321'],
      ['所得税', 'ドイツ（課税国）'],
    ],
    factsEn: [
      ['Headquarters', 'Düsseldorf, Germany'],
      ['Bases', 'Düsseldorf, Cologne/Bonn, Hamburg, Stuttgart and others'],
      ['Alliance', 'None (Lufthansa Group)'],
      ['Founded', '1993 (relaunched as the low-cost arm in 2015)'],
      ['Fleet', 'Airbus A319 / A320 / A320neo / A321'],
      ['Income tax', 'Germany (taxed)'],
    ],

    routesJa: 'デュッセルドルフ・ケルン／ボン・ハンブルク・シュトゥットガルトなどドイツ国内のベースを中心に、'
      + '欧州各地と地中海のレジャー路線へ140以上の都市に就航する。短中距離のポイント・トゥ・ポイント運航で、乗り継ぎ前提の路線網は持たない。',
    routesEn: 'Eurowings serves more than 140 destinations across Europe and the Mediterranean from German bases '
      + 'including Düsseldorf, Cologne/Bonn, Hamburg and Stuttgart. It is a short- and medium-haul point-to-point network, '
      + 'not a connecting hub operation.',
    fleetJa: 'エアバス A319 / A320 / A320neo / A321。単一機種族で統一されているため、機種転換なしで長く乗り続けられる。',
    fleetEn: 'Airbus A319 / A320 / A320neo / A321. A single-family fleet, so pilots can stay on one type for their whole career here.',

    trainingJa: [
      ['型式訓練（会社負担）', '型式限定を持たない副操縦士でも応募でき、A320ファミリーの型式訓練費用は会社が負担する。'],
      ['LIFUS', '型式取得後、教官機長同乗のライン訓練。短距離の多頻度運航なので離着陸回数を早く積める。'],
      ['定期審査（OPC/LPC）', 'EASA 基準に基づく年1〜2回の技能・路線審査。'],
      ['機長昇格', '社内の副操縦士を対象にした Fast Track Upgrade to Captain（A320）の公募がある。'],
    ],
    trainingEn: [
      ['Type rating (company-funded)', 'First officers may apply without a type rating; Eurowings covers the full A320-family type rating.'],
      ['LIFUS', 'Line training under a training captain after the type rating. High-frequency short-haul flying builds sectors quickly.'],
      ['Recurrent checks (OPC/LPC)', 'EASA-standard proficiency and line checks, once or twice a year.'],
      ['Upgrade to captain', 'A Fast Track Upgrade to Captain (A320) is advertised for serving first officers.'],
    ],

    benefitsJa: [
      ['🤝', '労働協約（VC）', '年収はドイツ操縦士組合 Vereinigung Cockpit との協約の等級表で決まる。個別交渉ではない。'],
      ['🎓', '型式訓練の会社負担', '型式限定なしの副操縦士でも、A320ファミリーの型式訓練費用を会社が負担する。'],
      ['📈', '等級による昇給', '副操縦士14等級・機長23等級の刻みがあり、在籍とともに段が上がる。'],
      ['✈️', 'スタッフ割引', 'ルフトハンザ・グループ便の割引搭乗特典。'],
      ['🏠', 'ベース', 'ドイツ各地と欧州のベースがあり、募集はベース単位で出る。'],
      ['📅', '有給休暇', 'EU 指令に基づく最低20日以上。実際の日数は労働協約による。'],
    ],
    benefitsEn: [
      ['🤝', 'Collective agreement (VC)', 'Pay follows the Vereinigung Cockpit agreement’s step table — it is not individually negotiated.'],
      ['🎓', 'Company-funded type rating', 'First officers without a type rating are eligible; the A320-family course is paid for by the airline.'],
      ['📈', 'Step progression', '14 steps for first officers, 23 for captains. Pay moves up with time in seat.'],
      ['✈️', 'Staff travel', 'Discounted travel across Lufthansa Group airlines.'],
      ['🏠', 'Bases', 'Bases across Germany and Europe; vacancies are advertised per base.'],
      ['📅', 'Annual leave', 'At least the EU-mandated 20 days; the actual entitlement is set by the collective agreement.'],
    ],

    hiringStatusJa: '機長・副操縦士とも公募あり（ルフトハンザ・グループの採用ポータル経由）。',
    hiringStatusEn: 'Both captain and first officer vacancies are advertised via the Lufthansa Group career portal.',
    /* 募集の状態。緑（#34d399）は「今まさに募集がある」社だけ。
       募集していない社に緑を付けると、色が事実と食い違う。 */
    hiring: { color: '#34d399', tagClass: 'tag-green', tagJa: '公募あり', tagEn: 'Hiring' },
    job: {
      titleJa: '機長・副操縦士（A320ファミリー）', subJa: '欧州短中距離。ベース単位の募集。',
      titleEn: 'Captain / First Officer — A320 family', subEn: 'Short and medium haul. Vacancies are posted per base.',
    },
    hiringRowsJa: [
      ['必要資格', '機長：EASA ATPL(A)（A320型式保有が望ましい）'],
      ['副操縦士', '型式限定なしでも応募可（型式訓練は会社負担）'],
      ['英語', 'ICAO Level 4 以上'],
      ['機種', 'エアバス A320ファミリー'],
    ],
    hiringRowsEn: [
      ['Captain', 'EASA ATPL(A), A320 type rating preferred'],
      ['First officer', 'May apply without a type rating (training funded by the airline)'],
      ['English', 'ICAO Level 4 or above'],
      ['Type', 'Airbus A320 family'],
    ],
    hiringNoteJa: '※ 応募は採用ポータルからのオンライン申請のみ。募集はベース単位・時期により変わるため、条件は必ず採用ページで確認する。',
    hiringNoteEn: 'Applications are accepted only through the online career portal. Vacancies are posted per base and change over time — confirm the current terms on the airline’s own page.',

    /* 任意。等級表そのものが公開されている社だけ書く。
       推計値しか無い社にこの節を付けると「刻みが公開されている」という嘘になるので、
       その場合は丸ごと省略する（節ごと出ない）。 */
    payScaleEn: {
      note: (h) => `Unlike most airlines on this site, ${h.A.en} pay is published as a union pay scale, `
        + 'so these are scale endpoints rather than estimates. Intermediate steps are not published.',
      tag: 'VC pay scale',
      rows: (h) => [
        ['First Officer — step 1', h.mm(h.A.fo.lo)],
        ['First Officer — step 14 (top)', h.mm(h.A.fo.hi)],
        ['Captain — step 1', h.mm(h.A.cap.lo)],
        ['Captain — step 23 (top)', h.mm(h.A.cap.hi)],
      ],
    },

    faqEn: (h) => [
      [`What is ${h.A.en} captain salary in 2026?`,
       `${h.A.en} captains average about ${h.mm(h.A.cap.avg)} a year (range ${h.mmR(h.A.cap)}), before tax. Pay is set by the Vereinigung Cockpit collective agreement pay scale, which runs to 23 steps for captains, so where a pilot sits in that range depends on their step rather than on individual negotiation.`],
      [`What is ${h.A.en} first officer salary?`,
       `${h.A.en} first officers average about ${h.mm(h.A.fo.avg)} a year (range ${h.mmR(h.A.fo)}), before tax. The first officer scale has 14 steps, and pay moves up with time in seat until upgrade to captain.`],
      [`Does ${h.A.en} pay for the type rating?`,
       `Yes. ${h.A.en} recruits first officers who do not hold a type rating and covers the full Airbus A320-family type rating. That is the main difference from low-cost operators that ask pilots to fund their own type rating.`],
      [`How does ${h.A.en} pay compare with ANA and JAL?`,
       `${h.A.en} captains average ${h.mm(h.A.cap.avg)} against ${h.mm(h.ana.cap.avg)} at ANA and JAL, and first officers ${h.mm(h.A.fo.avg)} against ${h.mm(h.ana.fo.avg)}. All four figures are gross, before income tax; both Germany and Japan tax pilot income.`],
    ],
    compareNoteEn: '* Salary figures are SSOT reference values, pre-tax. ANA / JAL are shown as the Japan baseline. '
      + 'Germany taxes pilot income, so take-home is lower than the headline figure in both columns.',
  },

  asiana: {
    code: 'OZ',
    donor: 'easyjet',
    donorTokens: [
      'easyjet', 'easyJet', 'イージージェット', 'FF6600', 'ルートン', 'Luton',
      'GenX', 'ガトウィック', 'Gatwick', '英国最大', "UK's largest",
    ],
    /* ブランド色そのもの（#E51820 = Asiana Red）。導出していない。
       ダーク背景 #0a0c0f に 4.18:1／ライト背景に 4.68:1 で、
       既に本番に出ている Eurowings のアクセント（4.68/4.18）と同じ水準なのでそのまま使える。
       ※ airlines/airline-base.js の AIRLINE_COLORS に asiana:'#003399' という青が残っているが、
          あのマップは定義だけで参照が無いデッドコード。ブランド色はこちらが正しい。 */
    color: '#E51820',
    flag: '🇰🇷',
    countryJa: '韓国', countryEn: 'South Korea',
    tags: { ja: ['FSC', 'スターアライアンス', '2026年12月に統合'], en: ['FSC', 'Star Alliance', 'Merging Dec 2026'] },
    subtitleJa: 'Asiana Airlines — ソウル・仁川を拠点とする韓国の大手航空会社。2026年12月17日に大韓航空へ統合される。',
    subtitleEn: 'Asiana Airlines — South Korea’s second full-service carrier, merging into Korean Air on 17 December 2026.',
    statsJa: [['主力機材', 'A350 / A330 / B777 ほか'], ['旅客機数', '67機']],
    statsEn: [['Fleet', 'A350 / A330 / B777 and others'], ['Passenger aircraft', '67']],
    /* ★ アシアナの採用サイトは実在しない。
       flyasiana.com/I/KO/RecruitMain.do はトップへリダイレクトし、
       recruit.asiana.com と asiana.com はドメインパーキング（Joken の JWT リダイレクタ）で
       アシアナ航空とは無関係。叩いて 200 を返す“それらしい URL”をそのまま書くと
       パーキング広告へ送ることになる。実在を確認できたのはこの2本だけ。 */
    careers: [
      { url: 'https://flyasiana.com/', ja: 'アシアナ航空 公式サイト（外部サイト）', en: 'Asiana Airlines official site (external)' },
      { url: 'https://recruit.koreanair.co.kr/', ja: '大韓航空 採用ポータル（外部サイト）', en: 'Korean Air recruitment portal (external)' },
    ],

    rowSubJa: { cap: '国際線中心（A350 / A330 / B777）', fo: '国際線・国内線' },
    rowSubEn: { cap: 'Mostly international (A350 / A330 / B777)', fo: 'International and domestic' },
    payTag: { ja: 'ウォン建て・税引前', en: 'Paid in KRW, pre-tax' },
    stepTag: { ja: '按分による推計', en: 'Apportioned estimate' },
    tableNote: {
      ja: '※ 掲載年収は公開データを基にした参考値です。機長／副操縦士の内訳は公表されていないため、'
        + '操縦士全体の平均から下記の仮定で按分した推計値です。実際の給与条件は各社採用情報でご確認ください。',
      en: 'Reference values based on public disclosure. The captain / first officer split is not published, '
        + 'so these are apportioned from a pilot-wide average under the assumptions stated below. Confirm exact terms with the airline.',
    },
    ldTail: {
      ja: '公表された操縦士全体の平均からの按分推計。大韓航空への統合スケジュールも解説。',
      en: 'Figures apportioned from the published pilot-wide average, plus what the Korean Air merger means for pilots.',
    },

    basisJa: '※ 公表されている実数は2023年まで。運航職1,397名・給与総額2,086億ウォン＝1人あたり平均1億4,936万ウォン'
      + '（₩1＝¥0.11換算で約1,640万円）。機長／副操縦士の内訳は公表されていないため、'
      + '人数構成を機長：副操縦士＝50：50、両者の年収比を大韓航空と同じ1.96と仮定して按分した推計値。'
      + '2024年4月に労使が暫定合意した基本給+7.5%は上乗せしていない。出典：에너지경제신문（2024年4月29日）。',
    basisEn: 'The only published figure is airline-wide: in 2023 Asiana had 1,397 flight crew and a total flight-crew payroll of '
      + '₩208.6 billion — ₩149.36 million per pilot, about ¥16.4M at ₩1 = ¥0.11. The captain / first officer split is not published, '
      + 'so the figures above assume a 50:50 headcount split and the same captain-to-first-officer ratio as Korean Air (1.96). '
      + 'The 7.5% base-pay rise provisionally agreed in April 2024 is not added on top. Source: Energy Economy Daily (에너지경제신문), 29 April 2024.',

    overviewJa: 'アシアナ航空は1988年に設立された韓国の大手航空会社で、仁川国際空港を国際線のハブ、金浦空港を国内線の拠点とする。'
      + 'A350・A330・B777 などのワイドボディを中心に旅客機67機を運航し、国際線90路線・国内線14路線を持つ。2003年からスターアライアンスに加盟している。'
      + 'ただし独立した航空会社としての運航は残りわずかで、2024年12月に大韓航空が買収を完了し、2026年12月17日に大韓航空へ統合される。'
      + '前日の12月16日にスターアライアンスを脱退し、統合日にスカイチームへ移る。アシアナクラブも同日で終了する。'
      + '貨物事業は独占規制への対応としてエアインチョンへ売却された。'
      + 'パイロットにとっては「アシアナに入る」ではなく「統合後の大韓航空でどの席に座るか」という話に変わりつつある。',
    overviewEn: 'Asiana Airlines was founded in 1988 and flies from Incheon International Airport for international routes and Gimpo for domestic. '
      + 'Its passenger fleet of 67 aircraft is built around widebodies — A350, A330 and B777 — alongside the A321 family, serving 90 international and 14 domestic routes. '
      + 'It has been a Star Alliance member since 2003. That era is ending: Korean Air completed its acquisition in December 2024, and Asiana merges into Korean Air '
      + 'on 17 December 2026, leaving Star Alliance the day before and joining SkyTeam on the day itself, when the Asiana Club programme also closes. '
      + 'The cargo division was sold to Air Incheon as an antitrust remedy. For a pilot the question is no longer what Asiana pays, '
      + 'but which seat you hold inside the combined Korean Air.',

    factsJa: [
      ['本社', 'ソウル特別市江西区（韓国）'],
      ['拠点', '仁川国際空港（国際線）／金浦空港（国内線）'],
      ['アライアンス', 'スターアライアンス（2026年12月16日に脱退予定）'],
      ['設立', '1988年（同年12月に運航開始）'],
      ['主力機材', 'A321 / A330 / A350 / A380 / B777'],
      ['所得税', '韓国（課税国）'],
    ],
    factsEn: [
      ['Headquarters', 'Gangseo-gu, Seoul, South Korea'],
      ['Hubs', 'Incheon (international) / Gimpo (domestic)'],
      ['Alliance', 'Star Alliance (leaving 16 December 2026)'],
      ['Founded', '1988 (first flight December 1988)'],
      ['Fleet', 'A321 / A330 / A350 / A380 / B777'],
      ['Income tax', 'South Korea (taxed)'],
    ],

    routesJa: '仁川を国際線のハブに、東アジア・東南アジア・北米・欧州・オセアニアへ90路線。国内線は金浦・済州を中心に14路線。'
      + '統合の独占規制への対応として、一部の国際線は既に他社へ移管されている。',
    routesEn: 'Incheon is the international hub, with 90 routes across East and Southeast Asia, North America, Europe and Oceania, '
      + 'plus 14 domestic routes centred on Gimpo and Jeju. Some international routes have already been transferred to other carriers '
      + 'as an antitrust remedy for the merger.',
    fleetJa: 'エアバス A321-200 / A321neo / A330-300 / A350-900 / A380-800、ボーイング 777-200ER の計67機（旅客機）。'
      + 'A380 を運航する数少ないアジアの航空会社の一つ。貨物専用機は貨物事業ごとエアインチョンへ売却された。',
    fleetEn: 'Airbus A321-200, A321neo, A330-300, A350-900 and A380-800, plus the Boeing 777-200ER — 67 passenger aircraft in total. '
      + 'Asiana is one of the few Asian operators still flying the A380. The freighters left with the cargo division, sold to Air Incheon.',

    trainingJa: [
      ['運航インターン（自社養成）', '学士以上・TOEIC 800・TOEIC Speaking 5級以上を要件とする自社養成制度。書類 → 人適性検査 → 1次面接（英語口述を含む）→ 1次・2次健康診断 → 役員面接の順で選考する。'],
      ['型式訓練', 'ワイドボディ中心の機種構成。統合後は大韓航空の訓練体系へ一本化される見込み。'],
      ['定期審査', '韓国 国土交通部（MOLIT）の基準に基づく技能審査・路線審査。'],
      ['機長昇格', '昇格までの年数は公表されていない。統合後はシニョリティ（先任順位）をどう統合するかに左右されるため、現時点で確定的なことは言えない。'],
    ],
    trainingEn: [
      ['Cadet programme (운항인턴)', 'Asiana runs its own ab-initio cadet scheme. Entry requires a bachelor’s degree, TOEIC 800 and TOEIC Speaking level 5 or above; selection runs documents → aptitude test → first interview including an English oral → two medical examinations → executive interview.'],
      ['Type training', 'A mostly widebody fleet. After the merger, training is expected to consolidate into Korean Air’s system.'],
      ['Recurrent checks', 'Proficiency and line checks to the standards of South Korea’s Ministry of Land, Infrastructure and Transport (MOLIT).'],
      ['Upgrade to captain', 'Time to upgrade is not published, and after the merger it depends on how the two seniority lists are combined — so nothing definite can be said today.'],
    ],

    benefitsJa: [
      ['🤝', '操縦士労働組合（APU）', '2024年4月に基本給+7.5%・安全奨励金100%増で労使が暫定合意した。給与表そのものは公開されていない。'],
      ['💴', 'ウォン建て', '給与はウォン建て。韓国は課税国で、非課税の中東系とは手取りの前提が違う。'],
      ['🛫', 'ワイドボディ主体', 'A350・A330・A380・B777 と大型機の比率が高く、長距離の飛行時間を積みやすい。'],
      ['✈️', 'スタッフ割引', 'アライアンス加盟各社を含む割引搭乗特典。統合日にスターアライアンスからスカイチームへ移る。'],
      ['🏢', '統合後の処遇', '2026年12月17日に大韓航空へ統合される。労働条件をどう統合するかは公表されていない。'],
      ['📅', '年次有給休暇', '韓国の勤労基準法に基づく年次有給休暇。日数は勤続年数による。'],
    ],
    benefitsEn: [
      ['🤝', 'Pilots’ union (APU)', 'In April 2024 the union and management provisionally agreed a 7.5% base-pay rise and a doubling of the safety incentive. The pay table itself is not published.'],
      ['💴', 'Paid in KRW', 'Salaries are paid in Korean won. South Korea taxes income, so take-home differs fundamentally from the tax-free Gulf carriers.'],
      ['🛫', 'Widebody-heavy', 'A350, A330, A380 and B777 make up most of the fleet, so long-haul hours build quickly.'],
      ['✈️', 'Staff travel', 'Discounted travel across the alliance. On the merger date this moves from Star Alliance to SkyTeam.'],
      ['🏢', 'After the merger', 'Asiana merges into Korean Air on 17 December 2026. How the two sets of terms will be combined has not been published.'],
      ['📅', 'Annual leave', 'Paid annual leave under the South Korean Labour Standards Act, scaled by length of service.'],
    ],

    /* 募集していない社に緑を付けない。色を付けないので hiring.color は null。 */
    hiringStatusJa: '統合準備期のため、アシアナ航空としての操縦士の定期公募は確認できていない。',
    hiringStatusEn: 'No current Asiana-branded pilot recruitment could be confirmed; hiring is consolidating into Korean Air ahead of the merger.',
    hiring: { color: null, tagClass: 'tag-gray', tagJa: '統合準備中', tagEn: 'Merging' },
    job: {
      titleJa: '操縦士（機長・副操縦士）',
      subJa: '2026年12月17日に大韓航空へ統合。募集は大韓航空側へ一本化される見込み。',
      titleEn: 'Pilots — captain and first officer',
      subEn: 'Merging into Korean Air on 17 December 2026; recruitment is expected to run through Korean Air.',
    },
    hiringRowsJa: [
      ['必要資格', '定期運送用操縦士技能証明（ATPL）'],
      ['英語', 'ICAO Level 4 以上'],
      ['自社養成', '運航インターン：学士以上・TOEIC 800・TOEIC Speaking 5級以上'],
      ['機種', 'A321 / A330 / A350 / A380 / B777'],
    ],
    hiringRowsEn: [
      ['Licence', 'Airline Transport Pilot Licence (ATPL)'],
      ['English', 'ICAO Level 4 or above'],
      ['Cadet entry', 'Bachelor’s degree, TOEIC 800, TOEIC Speaking level 5 or above'],
      ['Types', 'A321 / A330 / A350 / A380 / B777'],
    ],
    hiringNoteJa: '※ 2026年12月17日に大韓航空へ統合され、アシアナ航空は独立した航空会社としての運航を終える。'
      + '操縦士として応募するなら、統合後の受け皿である大韓航空の採用ポータルで最新の条件を確認する。',
    hiringNoteEn: 'Asiana stops operating as an independent airline on 17 December 2026, when it merges into Korean Air. '
      + 'If you are applying as a pilot, check the current terms on Korean Air’s recruitment portal, which is where hiring is consolidating.',

    /* payScaleEn は書かない。等級表が公開されていないので、節ごと出ない。 */

    faqEn: (h) => [
      [`What is ${h.A.en} captain salary in 2026?`,
       `${h.A.en} captains are estimated at about ${h.mm(h.A.cap.avg)} a year (range ${h.mmR(h.A.cap)}), before tax. This is not a published figure: Asiana discloses only a pilot-wide average — ₩149.36 million per head in 2023 across 1,397 flight crew — so the captain figure is apportioned from it, assuming a 50:50 captain/first-officer headcount split and Korean Air's 1.96 pay ratio between the two seats.`],
      [`What is ${h.A.en} first officer salary?`,
       `${h.A.en} first officers are estimated at about ${h.mm(h.A.fo.avg)} a year (range ${h.mmR(h.A.fo)}), before tax, apportioned from the same pilot-wide average. Asiana publishes no rank-by-rank pay scale, and the pilots' union does not publish one either, so treat this as an estimate rather than a rate.`],
      [`What happens to ${h.A.en} pilots after the Korean Air merger?`,
       `${h.A.en} merges into Korean Air on 17 December 2026. It leaves Star Alliance on 16 December, joins SkyTeam on the 17th, and the Asiana Club programme closes the same day. Korean Air completed the acquisition in December 2024; the cargo division was already sold to Air Incheon as an antitrust remedy. How the two seniority lists and the two sets of terms will be combined has not been published, which is the single biggest unknown for anyone joining now.`],
      [`How does ${h.A.en} pay compare with ANA and JAL?`,
       `${h.A.en} captains are estimated at ${h.mm(h.A.cap.avg)} against ${h.mm(h.ana.cap.avg)} at ANA and JAL, and first officers ${h.mm(h.A.fo.avg)} against ${h.mm(h.ana.fo.avg)}. All figures are gross, before income tax, and both South Korea and Japan tax pilot income. The Japanese figures come from published data; the Asiana ones are apportioned estimates, so the gap is indicative rather than exact.`],
    ],
    compareNoteEn: '* Salary figures are SSOT reference values, pre-tax. ANA / JAL are shown as the Japan baseline. '
      + 'The Asiana figures are apportioned estimates, not a published pay scale. Both South Korea and Japan tax pilot income.',
  },
};

const C = CONTENT[slug];
if (!C) {
  console.error(`✗ CONTENT に ${slug} の本文が無い。\n  年収だけ SSOT に足してもページは作れない（テンプレの穴埋めで水増ししないため）。`);
  process.exit(1);
}

/* ── 出力先。既にあるものには絶対に書かない ───────────────────── */
const targets = [
  { rel: `airlines/${slug}.html`, donor: `airlines/${C.donor}.html`, lang: 'ja' },
  { rel: `en/airlines/${slug}.html`, donor: `en/airlines/${C.donor}.html`, lang: 'en' },
];
for (const t of targets) {
  if (fs.existsSync(path.join(ROOT, t.rel)) && !FORCE) {
    console.error(`✗ 既にある: ${t.rel}\n  1社を直したいときはそのページを直接編集する（CLAUDE.md）。`);
    process.exit(1);
  }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const CARD = 'style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)"';

/* ════════════════════════════════════════════════════════════════
   日本語の本文
   ════════════════════════════════════════════════════════════════ */
function bodyJa() {
  const facts = C.factsJa.map(([k, v]) =>
    `<div><div class="text-xs text-muted uppercase tracking-widest mb-1">${esc(k)}</div><div class="font-semibold text-sm">${esc(v)}</div></div>`).join('');
  const train = C.trainingJa.map(([k, v]) =>
    `<div class="info-card"><div class="font-semibold mb-2" style="color:${C.color}">${esc(k)}</div><p class="text-sm text-muted">${esc(v)}</p></div>`).join('');
  const bene = C.benefitsJa.map(([e, k, v]) =>
    `<div class="stat-card"><div class="text-2xl mb-2">${e}</div><div class="font-semibold text-sm mb-1">${esc(k)}</div><p class="text-xs text-muted">${esc(v)}</p></div>`).join('');
  const rows = C.hiringRowsJa.map(([k, v]) =>
    `<div class="text-sm"><span class="text-muted">${esc(k)}：</span><span>${esc(v)}</span></div>`).join('');
  const hcol = C.hiring.color ? ` style="color:${C.hiring.color}"` : '';
  const links = C.careers.map((l, i) =>
    `<a href="${l.url}" target="_blank" rel="noopener" class="${i === 0 ? 'btn-orange' : 'btn-ghost'}">${esc(l.ja)}<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 12L12 2M8 2h4v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></a>`).join(' ');

  return `
<div class="glass p-8 fade-up"><div class="section-badge mb-4">概要</div><h2 class="text-2xl font-bold mb-4">${esc(A.ja)}（${esc(A.en)}）について</h2>
<div class="grid lg:grid-cols-2 gap-8"><p class="text-muted leading-relaxed">${esc(C.overviewJa)}</p>
<div class="grid grid-cols-2 gap-4">${facts}</div></div></div>
<div class="glass p-8 fade-up"><div class="section-badge mb-4">年収データ</div>
<h2 class="text-2xl font-bold mb-2">パイロット年収（2026年・参考値）</h2>
<p class="text-xs text-muted mb-6">${esc(C.tableNote.ja)}</p>
<div class="overflow-x-auto mb-4"><table><thead><tr><th>ポジション</th><th>年収レンジ</th><th>参考中央値</th><th>備考</th></tr></thead><tbody>
<tr><td><span class="font-semibold">機長（Captain）</span><br><span class="text-xs text-muted">${esc(C.rowSubJa.cap)}</span></td>
<td><div class="text-sm">${manR(A.cap)}</div><div class="mt-1 salary-bar-track w-32"><div class="salary-bar-fill" style="background:linear-gradient(90deg,${C.color}88,${C.color})" data-width="100"></div></div></td>
<td><span class="font-bold text-lg" style="color:${C.color}">${man(A.cap.avg)}</span></td>
<td><span class="tag tag-orange">${esc(C.payTag.ja)}</span></td></tr>
<tr><td><span class="font-semibold">副操縦士（First Officer）</span><br><span class="text-xs text-muted">${esc(C.rowSubJa.fo)}</span></td>
<td><div class="text-sm">${manR(A.fo)}</div><div class="mt-1 salary-bar-track w-32"><div class="salary-bar-fill" style="background:linear-gradient(90deg,${C.color}88,${C.color})" data-width="${pct(A.fo.hi, A.cap.hi)}"></div></div></td>
<td><span class="font-bold text-lg" style="color:${C.color}">${man(A.fo.avg)}</span></td>
<td><span class="tag tag-gray">${esc(C.stepTag.ja)}</span></td></tr>
</tbody></table></div>
<p class="text-xs text-muted">${esc(C.basisJa)}</p></div>
<div class="glass p-8 fade-up"><div class="section-badge mb-4">運航環境</div><h2 class="text-2xl font-bold mb-6">路線・機材</h2>
<div class="grid md:grid-cols-2 gap-6">
<div><div class="text-xs text-muted uppercase tracking-widest font-semibold mb-3">就航路線</div><p class="text-muted text-sm leading-relaxed">${esc(C.routesJa)}</p></div>
<div><div class="text-xs text-muted uppercase tracking-widest font-semibold mb-3">保有機材</div><p class="text-muted text-sm leading-relaxed">${esc(C.fleetJa)}</p></div>
</div></div>
<div class="glass p-8 fade-up"><div class="section-badge mb-4">訓練環境</div><h2 class="text-2xl font-bold mb-6">訓練・審査</h2>
<div class="grid md:grid-cols-2 gap-4">${train}</div></div>
<div class="glass p-8 fade-up"><div class="section-badge mb-4">福利厚生</div><h2 class="text-2xl font-bold mb-6">福利厚生</h2>
<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${bene}</div></div>
<div class="glass p-8 fade-up"><div class="section-badge mb-4">募集要項</div><h2 class="text-2xl font-bold mb-2">採用情報</h2>
<p class="text-sm text-muted mb-6">採用状況：<strong${hcol}>${esc(C.hiringStatusJa)}</strong></p>
<div class="space-y-5"><div class="glass-raised p-6" style="border-color:${C.color}25">
<div class="flex items-start justify-between mb-3 flex-wrap gap-2"><div><div class="font-bold text-base mb-0.5">${esc(C.job.titleJa)}</div><div class="text-sm text-muted">${esc(C.job.subJa)}</div></div>
<span class="tag ${C.hiring.tagClass}">${esc(C.hiring.tagJa)}</span></div>
<div class="grid sm:grid-cols-2 gap-3 mb-3">${rows}</div>
<p class="text-xs text-muted mt-2">${esc(C.hiringNoteJa)}</p></div></div>
<div class="mt-6">${links}</div>
</div>
`;
}

/* ════════════════════════════════════════════════════════════════
   英語の本文。英語版は gen-faq.mjs が可視FAQを“起こさない”ので、
   ここで <h2>Frequently Asked Questions</h2> と <details> を書く。
   ════════════════════════════════════════════════════════════════ */
function bodyEn() {
  const facts = C.factsEn.map(([k, v]) =>
    `<div><div class="text-xs text-muted uppercase tracking-widest mb-1">${esc(k)}</div><div class="font-semibold text-sm">${esc(v)}</div></div>`).join('');
  const train = C.trainingEn.map(([k, v]) =>
    `<div class="info-card"><div class="font-semibold mb-2" style="color:${C.color}">${esc(k)}</div><p class="text-sm text-muted">${esc(v)}</p></div>`).join('');
  const bene = C.benefitsEn.map(([e, k, v]) =>
    `<div class="stat-card"><div class="text-2xl mb-2">${e}</div><div class="font-semibold text-sm mb-1">${esc(k)}</div><p class="text-xs text-muted">${esc(v)}</p></div>`).join('');
  const rows = C.hiringRowsEn.map(([k, v]) =>
    `<div class="text-sm"><span class="text-muted">${esc(k)}:</span> <span>${esc(v)}</span></div>`).join('');
  const ana = SALARY.ana;
  const hcol = C.hiring.color ? ` style="color:${C.hiring.color}"` : '';
  const links = C.careers.map((l, i) =>
    `<a href="${l.url}" target="_blank" rel="noopener" class="${i === 0 ? 'btn-orange' : 'btn-ghost'}">${esc(l.en)}<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 12L12 2M8 2h4v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></a>`).join(' ');

  const faqs = C.faqEn(H).map(([q, a]) => `<details class="info-card cursor-pointer">
<summary class="font-semibold">${esc(q)}</summary>
<p class="text-sm text-muted mt-3">${esc(a)}</p>
</details>`).join('\n');

  /* 等級表が公開されている社だけの節。無い社では丸ごと出ない。 */
  const P = C.payScaleEn;
  const ladder = !P ? '' : `
<div class="glass p-8 fade-up">
<div class="section-badge mb-4">Career Ladder</div>
<h2 class="text-2xl font-bold mb-2">Pay Scale by Step</h2>
<p class="text-xs text-muted mb-6">${esc(P.note(H))}</p>
<div class="overflow-x-auto"><table>
<thead><tr><th>Step</th><th>Annual (pre-tax)</th><th>Source</th></tr></thead>
<tbody>
${P.rows(H).map(([k, v]) => `<tr><td><span class="font-semibold">${esc(k)}</span></td><td><div class="text-sm">${v}</div></td><td><span class="tag tag-green">${esc(P.tag)}</span></td></tr>`).join('\n')}
</tbody></table></div>
</div>
`;

  return `
<div class="glass p-8 fade-up">
<div class="section-badge mb-4">Overview</div>
<h2 class="text-2xl font-bold mb-4">About ${esc(A.en)}</h2>
<div class="grid lg:grid-cols-2 gap-8"><p class="text-muted leading-relaxed">${esc(C.overviewEn)}</p>
<div class="grid grid-cols-2 gap-4">${facts}</div></div>
</div>

<div class="glass p-8 fade-up">
<div class="section-badge mb-4">Salary Data</div>
<h2 class="text-2xl font-bold mb-2">Pilot Salary (2026 reference)</h2>
<p class="text-xs text-muted mb-6">${esc(C.tableNote.en)}</p>
<div class="overflow-x-auto mb-4"><table><thead><tr><th>Position</th><th>Annual range</th><th>Reference average</th><th>Notes</th></tr></thead><tbody>
<tr><td><span class="font-semibold">Captain</span><br><span class="text-xs text-muted">${esc(C.rowSubEn.cap)}</span></td>
<td><div class="text-sm">${mmR(A.cap)}</div><div class="mt-1 salary-bar-track w-32"><div class="salary-bar-fill" style="background:linear-gradient(90deg,${C.color}88,${C.color})" data-width="100"></div></div></td>
<td><span class="font-bold text-lg" style="color:${C.color}">${mm(A.cap.avg)}</span></td>
<td><span class="tag tag-orange">${esc(C.payTag.en)}</span></td></tr>
<tr><td><span class="font-semibold">First Officer</span><br><span class="text-xs text-muted">${esc(C.rowSubEn.fo)}</span></td>
<td><div class="text-sm">${mmR(A.fo)}</div><div class="mt-1 salary-bar-track w-32"><div class="salary-bar-fill" style="background:linear-gradient(90deg,${C.color}88,${C.color})" data-width="${pct(A.fo.hi, A.cap.hi)}"></div></div></td>
<td><span class="font-bold text-lg" style="color:${C.color}">${mm(A.fo.avg)}</span></td>
<td><span class="tag tag-gray">${esc(C.stepTag.en)}</span></td></tr>
</tbody></table></div>
<p class="text-xs text-muted">${esc(C.basisEn)}</p>
</div>
${ladder}
<div class="glass p-8 fade-up">
<div class="section-badge mb-4">Operations</div>
<h2 class="text-2xl font-bold mb-6">Routes &amp; Fleet</h2>
<div class="grid md:grid-cols-2 gap-6">
<div><div class="text-xs text-muted uppercase tracking-widest font-semibold mb-3">Network</div><p class="text-muted text-sm leading-relaxed">${esc(C.routesEn)}</p></div>
<div><div class="text-xs text-muted uppercase tracking-widest font-semibold mb-3">Fleet</div><p class="text-muted text-sm leading-relaxed">${esc(C.fleetEn)}</p></div>
</div>
</div>

<div class="glass p-8 fade-up">
<div class="section-badge mb-4">Training</div>
<h2 class="text-2xl font-bold mb-6">Training &amp; Checkrides</h2>
<div class="grid md:grid-cols-2 gap-4">${train}</div>
</div>

<div class="glass p-8 fade-up">
<div class="section-badge mb-4">Benefits</div>
<h2 class="text-2xl font-bold mb-6">Pilot Benefits &amp; Allowances</h2>
<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${bene}</div>
</div>

<div class="glass p-8 fade-up">
<div class="section-badge mb-4">Job Openings</div>
<h2 class="text-2xl font-bold mb-2">Pilot Hiring &amp; Requirements</h2>
<p class="text-sm text-muted mb-6">Status: <strong${hcol}>${esc(C.hiringStatusEn)}</strong></p>
<div class="space-y-5"><div class="glass-raised p-6" style="border-color:${C.color}25">
<div class="flex items-start justify-between mb-3 flex-wrap gap-2"><div><div class="font-bold text-base mb-0.5">${esc(C.job.titleEn)}</div><div class="text-sm text-muted">${esc(C.job.subEn)}</div></div>
<span class="tag ${C.hiring.tagClass}">${esc(C.hiring.tagEn)}</span></div>
<div class="grid sm:grid-cols-2 gap-3 mb-3">${rows}</div>
<p class="text-xs text-muted mt-2">${esc(C.hiringNoteEn)}</p></div></div>
<div class="mt-6">${links}</div>
</div>

<div class="glass p-8 fade-up">
<div class="section-badge mb-4">Comparison</div>
<h2 class="text-2xl font-bold mb-6">${esc(A.en)} vs Japan Majors</h2>
<div class="overflow-x-auto"><table>
<thead><tr><th>Airline</th><th>Captain (range)</th><th>First Officer</th><th>Income Tax</th></tr></thead>
<tbody>
<tr><td><span class="font-bold" style="color:${C.color}">${esc(A.en)} ${C.flag}</span></td><td><span class="font-bold" style="color:${C.color}">${mmR(A.cap)}</span></td><td>${mmR(A.fo)}</td><td>${A.taxFree ? '<span class="tag tag-green">Tax-free</span>' : '<span class="text-muted text-sm">Income tax applies</span>'}</td></tr>
<tr><td><span class="font-semibold">ANA 🇯🇵</span></td><td>${mmR(ana.cap)}</td><td>${mmR(ana.fo)}</td><td><span class="tag tag-gray">~33% (Japan)</span></td></tr>
<tr><td><span class="font-semibold">JAL 🇯🇵</span></td><td>${mmR(SALARY.jal.cap)}</td><td>${mmR(SALARY.jal.fo)}</td><td><span class="tag tag-gray">~33% (Japan)</span></td></tr>
</tbody></table></div>
<p class="text-xs text-muted mt-4">${esc(C.compareNoteEn)}</p>
</div>

<div class="glass p-8 fade-up">
<div class="section-badge mb-4">FAQ</div>
<h2 class="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
<div class="space-y-4">
${faqs}
</div>
</div>
`;
}

/* ── hero ────────────────────────────────────────────────────── */
function heroJa() {
  const tags = [`<span class="tag tag-orange">${C.flag} ${esc(C.countryJa)}</span>`,
    ...C.tags.ja.map((t, i) => `<span class="tag ${i === 0 ? 'tag-orange' : i === 1 ? 'tag-gray' : 'tag-blue'}">${esc(t)}</span>`)].join('');
  const stats = [
    [manR(A.cap), '機長年収（税引前）', C.color],
    [manR(A.fo), 'FO年収（税引前）', C.color],
    ...C.statsJa.map(([label, v]) => [v, label, C.color]),
  ].map(([v, k, col]) => `<div class="stat-card text-center"><div class="text-xl font-extrabold mb-1" style="color:${col}">${v}</div><div class="text-xs text-muted">${esc(k)}</div></div>`).join('');

  return `<div class="hero-airline" style="background:linear-gradient(180deg,${C.color}12 0%,transparent 60%)">
<div class="absolute inset-0" style="background:radial-gradient(ellipse 50% 60% at 20% 40%,${C.color}10 0%,transparent 70%)"></div>
<div class="max-w-7xl mx-auto px-6 relative">
<div class="flex items-start gap-6 mb-8">
<div class="w-20 h-20 rounded-2xl flex items-center justify-center text-xl font-black flex-shrink-0" style="background:${C.color}20;color:${C.color};border:1px solid ${C.color}35">${C.code}</div>
<div><div class="flex flex-wrap items-center gap-3 mb-3">${tags}</div>
<h1 class="text-4xl lg:text-5xl font-extrabold tracking-tight mb-2" style="background:linear-gradient(135deg,#fff,${C.color});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${esc(A.ja)}（${esc(A.en)}）</h1>
<p class="text-muted text-lg">${esc(C.subtitleJa)}</p></div></div>
<div class="grid grid-cols-2 md:grid-cols-4 gap-4">${stats}</div>
</div></div>`;
}

function heroEn() {
  const tags = [`<span class="tag tag-orange">${C.flag} ${esc(C.countryEn)}</span>`,
    ...C.tags.en.map((t, i) => `<span class="tag ${i === 0 ? 'tag-orange' : i === 1 ? 'tag-gray' : 'tag-blue'}">${esc(t)}</span>`)].join('');
  const stats = [
    [mm(A.cap.avg), 'Capt. Avg (pre-tax)', C.color],
    [mm(A.fo.avg), 'FO Avg (pre-tax)', C.color],
    ...C.statsEn.map(([label, v]) => [v, label, C.color]),
  ].map(([v, k, col]) => `<div class="stat-card text-center"><div class="text-xl font-extrabold mb-1" style="color:${col}">${v}</div><div class="text-xs text-muted">${esc(k)}</div></div>`).join('');

  return `<div class="hero-airline" style="background:linear-gradient(180deg,${C.color}12 0%,transparent 60%)">
<div class="absolute inset-0" style="background:radial-gradient(ellipse 50% 60% at 20% 40%,${C.color}10 0%,transparent 70%)"></div>
<div class="max-w-7xl mx-auto px-6 relative">
<div class="flex items-start gap-6 mb-8">
<div class="w-20 h-20 rounded-2xl flex items-center justify-center text-xl font-black flex-shrink-0" style="background:${C.color}22;color:${C.color};border:1px solid ${C.color}44">${C.code}</div>
<div>
<div class="flex flex-wrap items-center gap-3 mb-3">${tags}</div>
<h1 class="text-4xl lg:text-5xl font-extrabold tracking-tight mb-2" style="background:linear-gradient(135deg,#fff,${C.color});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${esc(A.en)}</h1>
<p class="text-muted text-lg">${esc(C.subtitleEn)}</p>
</div>
</div>
<div class="grid grid-cols-2 md:grid-cols-4 gap-4">${stats}</div>
</div>
</div>`;
}

/* ── 構造化データ。FAQPage は空で置く（中身は gen-faq.mjs が入れる）── */
function ldJa() {
  const url = `https://pilot-value.com/airlines/${slug}.html`;
  return JSON.stringify([
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'PILOT VALUE', item: 'https://pilot-value.com' },
      { '@type': 'ListItem', position: 2, name: '世界の航空会社一覧', item: 'https://pilot-value.com/world-airlines.html' },
      { '@type': 'ListItem', position: 3, name: `${A.ja} パイロット年収`, item: url }] },
    { '@context': 'https://schema.org', '@type': 'Article',
      headline: `${A.ja} パイロット年収【2026年最新】機長平均${A.cap.avg.toLocaleString('en-US')}万円（${A.cap.lo.toLocaleString('en-US')}〜${A.cap.hi.toLocaleString('en-US')}万円）・副操縦士年収を解説`,
      description: `${A.ja}のパイロット年収【2026年最新】。機長平均${A.cap.avg.toLocaleString('en-US')}万円、副操縦士平均${A.fo.avg.toLocaleString('en-US')}万円。${C.ldTail.ja}`,
      publisher: { '@type': 'Organization', name: 'PILOT VALUE', url: 'https://pilot-value.com' },
      url, mainEntityOfPage: url },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [] },
  ]);
}

function ldEn() {
  const url = `https://pilot-value.com/en/airlines/${slug}.html`;
  const k = (v) => Math.round(v * 10000 / 160 / 1000);   // 万円 → USD千ドル（currency.js と同じ 160）
  return JSON.stringify([
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'PILOT VALUE', item: 'https://pilot-value.com/en/' },
      { '@type': 'ListItem', position: 2, name: 'World Airlines', item: 'https://pilot-value.com/en/world-airlines.html' },
      { '@type': 'ListItem', position: 3, name: `${A.en} Pilot Salary`, item: url }] },
    { '@context': 'https://schema.org', '@type': 'Article',
      headline: `${A.en} Pilot Salary 2026 — Captain $${k(A.cap.avg)}K, First Officer $${k(A.fo.avg)}K`,
      description: `${A.en} pilot salary 2026: captain avg $${k(A.cap.avg)}K, first officer avg $${k(A.fo.avg)}K, pre-tax. ${C.ldTail.en}`,
      publisher: { '@type': 'Organization', name: 'PILOT VALUE', url: 'https://pilot-value.com' },
      url, mainEntityOfPage: url },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [] },
  ]);
}

/* ════════════════════════════════════════════════════════════════
   組み立て — 借り元から外枠だけ取り、本文を差し替える
   ════════════════════════════════════════════════════════════════ */
const CONTAINER = '<div class="max-w-7xl mx-auto px-6 pb-24 space-y-10">';

function build({ donor, lang }) {
  let html = fs.readFileSync(path.join(ROOT, donor), 'utf8');

  /* 1) 管理ブロックを剥がす。中身はパイプラインが入れ直す。 */
  html = html.replace(/<!--PV-SEO-->[\s\S]*?<!--\/PV-SEO-->[ \t]*\n?/g, '')
             .replace(/<!--PV-CLINK-->[\s\S]*?<!--\/PV-CLINK-->[ \t]*\n?/g, '')
             .replace(/<!--PV-FAQ-->[\s\S]*?<!--\/PV-FAQ-->[ \t]*\n?/g, '')
             .replace(/<!--PV-3P-->[\s\S]*?<!--\/PV-3P-->[ \t]*\n?/g, '');

  /* 2) 残った構造化データを自前のものへ。借り元の年収が1件も残らないようにする。 */
  let ldDone = false;
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, () => {
    if (ldDone) return '';
    ldDone = true;
    return `<script type="application/ld+json">${lang === 'ja' ? ldJa() : ldEn()}</script>`;
  });
  if (!ldDone) throw new Error(`${donor}: ld+json が無い`);

  /* 3) title。seo-normalize.mjs が最終形にするが、生成元として妥当な値を置く。 */
  const title = lang === 'ja'
    ? `${A.ja} パイロット年収 機長${A.cap.avg.toLocaleString('en-US')}万円【2026】 | PILOT VALUE`
    : `${A.en} Pilot Salary 2026 — Captain $${Math.round(A.cap.avg * 10000 / 160 / 1000)}K | PILOT VALUE`;
  if (!/<title[^>]*>/i.test(html)) throw new Error(`${donor}: <title> が無い`);
  html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);

  /* 4) ヒーローと本文を丸ごと差し替える。借り元の段落を1つも残さない。
        差し替える範囲は「</nav> の直後のヒーロー」から「本文の終わり」まで。
        ナビ・フッター・スクリプトだけを借りる。 */
  const heroStart = html.indexOf('<div class="hero-airline"');
  if (heroStart === -1) throw new Error(`${donor}: ヒーローが見つからない`);
  const bodyStart = html.indexOf(CONTAINER, heroStart);
  if (bodyStart === -1) throw new Error(`${donor}: 本文コンテナが見つからない`);
  const tailAnchor = lang === 'ja'
    ? html.indexOf('<div style="background:rgba(249,115,22,.06)', bodyStart)   // 転職CTAバンド
    : html.slice(bodyStart).search(/<footer\b/i) + bodyStart;
  if (tailAnchor <= bodyStart) throw new Error(`${donor}: 本文の終わりが見つからない`);

  const hero = lang === 'ja' ? heroJa() : heroEn();
  const inner = lang === 'ja' ? bodyJa() : bodyEn();
  html = html.slice(0, heroStart) + hero + '\n\n' + CONTAINER + inner + '</div>\n\n' + html.slice(tailAnchor);

  /* 5) 借り元固有のトークンを置き換える（nav・footer・body 属性・canonical 等）*/
  /* 色は #FF6600 / #FF660012 のように末尾へ不透明度が付く。長い方から消せば全部拾える。 */
  html = html.split(C.donor).join(slug).split('#FF6600').join(C.color);
  html = html.replace(/(<html[^>]*lang=")[a-z-]+(")/i, `$1${lang}$2`);

  /* 6) 検査。1つでも残っていたら書かない。 */
  const left = C.donorTokens.filter((t) => html.includes(t));
  if (left.length) throw new Error(`${donor}: 借り元の語が残っている → ${left.join(', ')}`);
  const need = lang === 'ja'
    ? ['<div style="background:rgba(249,115,22,.06)', '"@type":"FAQPage"', '<footer']
    : ['Frequently Asked Questions', '</details>', '"@type":"FAQPage"', '<footer'];
  const miss = need.filter((t) => !html.includes(t));
  if (miss.length) throw new Error(`${donor}: パイプラインが要る目印が無い → ${miss.join(', ')}`);
  if (lang === 'ja' && html.includes('よくある質問')) {
    throw new Error('日本語版に可視FAQを書いてはいけない（gen-faq.mjs が SSOT から起こす）');
  }
  return html;
}

for (const t of targets) {
  const out = build(t);
  fs.writeFileSync(path.join(ROOT, t.rel), out);
  console.log(`✅ ${t.rel}  ${(out.length / 1024).toFixed(1)}KB`);
}

console.log(`
次にこの順で流す（順番を変えない）:
  node gen-airline-codes.mjs && node gen-salary-json.mjs && node patch-site-salaries.mjs
  node gen-countries.mjs && node gen-faq.mjs && node link-countries.mjs && node gen-en-manifest.mjs
  node seo-normalize.mjs && node gen-sitemap.mjs
  node check-salary.mjs && node assert-seo.mjs && node assert-links.mjs`);
