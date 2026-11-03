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
     ・国別の箱（<!--PV-CLINK-->）と「パイロット転職を検討中の方へ」の橙の帯は、
       2026-10-08 にオーナー指示で全会社ページから外した。ここでも書かない・借りてこない
       （link-countries.mjs はいまは外すだけ。戻っていないかは assert-basis.mjs の J が見る）。
     ただし FAQPage の JSON-LD は gen-faq.mjs が「既にある FAQPage の中身を差し替える」
     作りなので、空の FAQPage を最初から置いておく必要がある。

   実行: node gen-new-airline.mjs eurowings
        node gen-new-airline.mjs eurowings --force   （既存ファイルを上書き。通常は使わない）
   ════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { SALARY } from './salary-data.mjs';
import { curCore } from './cur-core.mjs';
/* ★借り元のページ（2026-11-02）。古い形のページはスピリット航空の2枚しか残っておらず、スピリット航空をサイトから外したとき
   その2枚を1バイトも変えずに airline-donor-pages.mjs（配信されない .mjs）へ写した。donor にその名前があればそちらを読み、
   無ければ今までどおりリポジトリのページを読む。⚠️ ここへ戻して airlines/spirit.html を置き直さない（住所は 404 のまま）。 */
import { DONOR_PAGES } from './airline-donor-pages.mjs';
/* ★ドルの換算レートを手で持たない（2026-09-18）。
   ここが 160 のまま置き去りになり、currency.js（158.95）が塗る本文と食い違って
   **同じページの中でタイトルが $231K・本文が $233K** になっていた。
   画面では本文だけ見えるので誰も気づかない。焼き込んで初めて並んで見えた。 */
const USD_RATE = (await curCore('USD', 'en')).RATES.USD;

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

/* ── 比較表の相手は「同じ地域の航空会社」────────────────────────────
   2026-09-30 オーナー指摘「なぜサイト全体的に日本から外にでていく目線で描かれてるの？
   海外のパイロットにも普及させるのに。」
   以前はここが ANA・JAL 固定で、見出しも「X vs Japan Majors」・脚注も
   「ANA / JAL shown as the Japan baseline（日本が基準）」だった。
   オーストラリアのパイロットがカンタスのページを開いて比べたいのは ANA ではない。
   ⚠️ ここを ANA・JAL 固定に戻さない。1社足すたびに同じ形が復活する。
   日本の会社は相手が ANA・JAL のままで正しい（同じ地域だから）。 */
const PEERS = {
  japan: ['ana', 'jal', 'zipair'],
  asia: ['singapore-airlines', 'cathay-pacific', 'korean-air', 'thai-airways'],
  mideast: ['emirates', 'qatar-airways', 'etihad', 'gulf-air'],
  oceania: ['qantas', 'air-new-zealand', 'jetstar', 'fiji-airways'],
  us: ['delta', 'united', 'american', 'southwest'],
  europe: ['lufthansa', 'british-airways', 'air-france', 'klm'],
  africa: ['ethiopian-airlines', 'egyptair', 'kenya-airways', 'south-african-airways'],
  latam: ['latam', 'avianca', 'copa-airlines', 'aeromexico'],
};
const REGION_EN = {
  japan: 'Japanese', asia: 'Asian', mideast: 'Middle East', oceania: 'Oceania',
  us: 'North American', europe: 'European', africa: 'African', latam: 'Latin American',
};
const REGION_JA = {
  japan: '日本', asia: 'アジア', mideast: '中東', oceania: 'オセアニア',
  us: '北米', europe: '欧州', africa: 'アフリカ', latam: '中南米',
};
/* そのページの会社を除いて先頭2社。地域が引けない社は日本の2社に落とす（従来の形）。 */
const peerSlugs = (PEERS[A.region] || PEERS.japan).filter((p) => p !== slug && SALARY[p]).slice(0, 2);
const regionEn = REGION_EN[A.region] || REGION_EN.japan;
const regionJa = REGION_JA[A.region] || REGION_JA.japan;
const peerNameEn = (p) => `<a href="${p}.html" class="text-accent">${esc(SALARY[p].en)}</a>`;
const peerNameJa = (p) => `<a href="${p}.html" class="text-accent">${esc(SALARY[p].ja)}</a>`;
const taxCellEn = (p) => (SALARY[p].taxFree
  ? '<span class="tag tag-green">0% (tax-free)</span>'
  : '<span class="tag tag-gray">Income tax applies</span>');
const taxCellJa = (p) => (SALARY[p].taxFree
  ? '<span class="tag tag-green">0%（非課税）</span>'
  : '<span class="tag tag-gray">所得税あり</span>');
/* 比較表の脚注の既定。会社ごとの事情は1文だけ足す（extra）。
   ⚠️ この文言は全110枚と同じもの。ここで言い方を発明すると、このページだけ違うことを言う。
   ⚠️ 「会社は給与を公表していません」と書かない（オーナー指示 2026-09-30）── 当サイトの
      数字が推定であることと、会社が公表していないことは別の主張。無いことの証明にならない。 */
const compareFootEn = (extra = '') => '* The salary figures are our own estimates, worked out from '
  + 'publicly available information — not figures the airlines publish.'
  + (extra ? ` ${extra}` : '')
  + (([slug, ...peerSlugs]).some((p) => SALARY[p].taxFree)
    ? ' Carriers marked tax-free pay out the headline figure in full; where income tax applies, '
      + 'take-home is lower than the headline.'
    : ' Income tax applies in every case here, so the headline figure is not what reaches the bank account.')
  + ' Verify exact figures with each airline.';

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
      ja: '※ 掲載年収は公開情報・労働協約から当サイトが推計した金額です。会社が公表した金額ではありません。実際の給与条件は各社採用情報でご確認ください。',
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
      [`How does ${h.A.en} pay compare with other European carriers?`,
       `${h.A.en} captains are estimated at ${h.mm(h.A.cap.avg)} a year against ${h.mm(h.SALARY.lufthansa.cap.avg)} at Lufthansa, and first officers ${h.mm(h.A.fo.avg)} against ${h.mm(h.SALARY.lufthansa.fo.avg)}. Both sides are our own estimates and both are gross figures: Germany taxes pilot pay, so take-home is lower than the headline in either case.`],
    ],
    compareNoteEn: compareFootEn(),
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
      ja: '※ 掲載年収は公開情報から当サイトが推計した金額です。機長／副操縦士の内訳は公表されていないため、'
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
      [`How does ${h.A.en} pay compare with other Asian carriers?`,
       `${h.A.en} captains are estimated at ${h.mm(h.A.cap.avg)} a year against ${h.mm(h.SALARY['singapore-airlines'].cap.avg)} at Singapore Airlines, and first officers ${h.mm(h.A.fo.avg)} against ${h.mm(h.SALARY['singapore-airlines'].fo.avg)}. Both sides are our own estimates and both are gross of income tax. The Asiana figures are apportioned from an airline-wide average rather than a published pay scale, so treat the gap as indicative rather than exact.`],
    ],
    compareNoteEn: compareFootEn('The Asiana figures are apportioned estimates, not a published pay scale.'),
  },

  /* ★2026-10-31 投稿先だけの一覧（airline-ops.mjs）から道Aへ上げた2社（フライドバイ・エア・ピース）。
     借り元はスピリット航空（年収の正本の会社で、古い形のページが残っているのはここだけ ＝ ヒーローと本文コンテナの目印を持つ）。
     本文は、新しい会社ページ（gen-airline-glance.mjs）にするとき「よくある質問」と h1 以外は外れる。なので短く、確かめた事実だけ。 */
  flydubai: {
    code: 'FZ',
    donor: 'spirit',
    donorColor: '#FFD700',
    donorTokens: [
      'spirit', 'Spirit', 'スピリット', 'FFD700', 'ffd700', '786508', 'ULCC',
      'フォートローダーデール', 'Fort Lauderdale', 'Miramar', 'フロリダ', 'Florida',
    ],
    /* 採用サイト（careers.flydubai.com）の --primary-color。導出していない。 */
    color: '#004B9B',
    flag: '🇦🇪',
    countryJa: 'アラブ首長国連邦', countryEn: 'United Arab Emirates',
    tags: { ja: ['ドバイ拠点', 'B737 単一機材', '非課税'], en: ['Dubai-based', 'All-737 fleet', 'Tax-free'] },
    subtitleJa: 'flydubai — ドバイ国際空港を拠点とする航空会社。機材は Boeing 737 だけ。',
    subtitleEn: 'flydubai — a Dubai International-based airline flying an all-Boeing 737 fleet.',
    statsJa: [['機材', 'B737-800 / MAX 8 / MAX 9'], ['拠点', 'ドバイ国際空港（DXB）']],
    statsEn: [['Fleet', 'B737-800 / MAX 8 / MAX 9'], ['Base', 'Dubai International (DXB)']],
    /* 2026-10-31 に3本とも開いて、flydubai の採用サイトそのものであることを確かめた（ページの下に「@flydubai 2024」）。 */
    careers: [
      { url: 'https://careers.flydubai.com/pilots', ja: 'フライドバイ 操縦士の採用ページ（外部サイト）', en: 'flydubai pilot careers (external)' },
      { url: 'https://careers.flydubai.com/captain', ja: '機長の募集要項（外部サイト）', en: 'Captain requirements (external)' },
      { url: 'https://careers.flydubai.com/first-officer', ja: '副操縦士の募集要項（外部サイト）', en: 'First officer requirements (external)' },
    ],

    rowSubJa: { cap: 'B737（737-800 / 737 MAX）', fo: 'B737（737-800 / 737 MAX）' },
    rowSubEn: { cap: 'B737 (737-800 / 737 MAX)', fo: 'B737 (737-800 / 737 MAX)' },
    payTag: { ja: 'AED建て・非課税', en: 'Paid in AED, tax-free' },
    stepTag: { ja: '採用ページの月額から', en: 'From the careers page' },
    tableNote: {
      ja: '※ 推定年収は、採用ページに書かれた月額（基本給＋住宅手当＋交通手当）と乗務手当の月平均（月70時間）を足して12倍した額です。下の端は乗務手当を除いた固定分です。',
      en: 'The estimate adds the monthly basic salary, housing and transportation allowances on the careers page to the average monthly flying pay (70 hours a month), times 12. The low end is the fixed part without flying pay.',
    },
    ldTail: {
      ja: '採用ページの月額と乗務手当の平均から計算した推定年収と、応募条件。',
      en: 'Estimated from the monthly pay and average flying pay on the airline’s careers page, plus the entry requirements.',
    },

    basisJa: '※ 出典：flydubai の採用ページ「Captain」「First Officer」（2026年10月31日に確認）。'
      + '機長は基本給＋住宅手当＋交通手当が月 AED 50,235、乗務手当が月平均 AED 16,310（月平均70飛行時間）。'
      + '副操縦士は同じく月 AED 37,000 と月平均 AED 11,410。教育補助・退職金・所得補償など額の書かれていないものは入れていない。',
    basisEn: 'Source: flydubai’s careers pages “Captain” and “First Officer” (checked 31 October 2026). '
      + 'Captains: basic salary plus housing and transportation allowances of AED 50,235 a month, and variable flying pay averaging AED 16,310 a month (based on 70 flying hours). '
      + 'First officers: AED 37,000 and AED 11,410 on the same basis. Benefits with no stated amount — education assistance, end-of-service benefit, pilot income protection — are not included.',

    overviewJa: 'flydubai はドバイを本拠とする航空会社で、2009年6月に運航を始めた。ドバイ国際空港（DXB）で2番目に大きい航空会社で、'
      + '採用サイトの会社紹介では、アフリカ・中央アジア・コーカサス・欧州・GCC と中東・インド亜大陸・東南アジアの125を超える就航地（55か国）へ飛ぶ。'
      + '機材は Boeing 737 だけ（737-800 / 737 MAX 8 / 737 MAX 9）。エミレーツとは別の会社。',
    overviewEn: 'flydubai is a Dubai-based airline that started flying in June 2009. It is the second-largest carrier at Dubai International (DXB), '
      + 'and its careers site describes a network of more than 125 destinations in 55 countries across Africa, Central Asia, the Caucasus, Europe, the GCC and the Middle East, the Indian Subcontinent and South-East Asia. '
      + 'The fleet is all Boeing 737 (737-800, 737 MAX 8 and 737 MAX 9). It is a separate company from Emirates.',

    factsJa: [
      ['本拠', 'ドバイ（アラブ首長国連邦）'],
      ['拠点', 'ドバイ国際空港（DXB）'],
      ['運航開始', '2009年6月'],
      ['機材', 'B737-800 / B737 MAX 8 / B737 MAX 9'],
      ['所得税', 'UAE（個人所得税なし）'],
    ],
    factsEn: [
      ['Home', 'Dubai, United Arab Emirates'],
      ['Base', 'Dubai International (DXB)'],
      ['First flights', 'June 2009'],
      ['Fleet', 'B737-800 / B737 MAX 8 / B737 MAX 9'],
      ['Income tax', 'UAE (no personal income tax)'],
    ],

    routesJa: 'ドバイ国際空港から、アフリカ・中央アジア・コーカサス・欧州・GCC と中東・インド亜大陸・東南アジアへ（採用サイトの会社紹介では125を超える就航地・55か国）。',
    routesEn: 'From Dubai International to Africa, Central Asia, the Caucasus, Europe, the GCC and the Middle East, the Indian Subcontinent and South-East Asia — more than 125 destinations in 55 countries, according to the careers site.',
    fleetJa: 'Boeing 737 の単一機材（737-800 / 737 MAX 8 / 737 MAX 9）。応募条件も B737（300〜900 の EFIS / NG / MAX）の型式を基準にしている。',
    fleetEn: 'A single-type Boeing 737 fleet (737-800, 737 MAX 8 and 737 MAX 9). The entry requirements are written around the B737 (300 to 900, EFIS / NG / MAX) type rating.',

    trainingJa: [
      ['選考の流れ', 'オンライン応募 → オンラインの適性検査 → 録画面接 → 書類の確認 → オンラインの面接 → 1日目（シミュレーター審査と入社前の健康診断）→ 2日目（適性検査・2回目の面接・飛行書類の確認）。'],
      ['訓練ボンド', '3年。額は B737 の型式を持っているかどうかで違う（採用ページに記載）。'],
    ],
    trainingEn: [
      ['Selection', 'Online application → online assessment tests → on-demand video interview → application review → online competency-based interview → Day 1 (simulator assessment and pre-employment medical) → Day 2 (psychometric assessment, possibly a second interview, and a check of flying documents).'],
      ['Training bond', 'Three years. The amount differs for type-rated and non-type-rated pilots (stated on the careers page).'],
    ],

    benefitsJa: [
      ['🏠', '住宅手当・交通手当', '基本給と一緒に月額に含まれている（機長 月 AED 50,235・副操縦士 月 AED 37,000）。'],
      ['✈️', '乗務手当', '飛んだ時間で変わる。採用ページの月平均は月70時間で計算した額。'],
      ['📅', '有給休暇', '年42日。'],
      ['🎓', '教育補助', '採用ページに記載（額は書かれていない）。'],
      ['🩺', '医療保険・所得補償', '医療保険と操縦士の所得補償（Pilot income protection）。'],
      ['💼', '退職金・契約', '退職時の手当（End of service benefit）。期間の定めのない契約。'],
    ],
    benefitsEn: [
      ['🏠', 'Housing and transport', 'Included in the monthly figure with basic salary (AED 50,235 for captains, AED 37,000 for first officers).'],
      ['✈️', 'Flying pay', 'Varies with the hours flown. The careers page’s monthly average is based on 70 flying hours.'],
      ['📅', 'Leave', '42 days of paid leave a year.'],
      ['🎓', 'Education assistance', 'Listed on the careers page (no amount given).'],
      ['🩺', 'Medical and income protection', 'Medical insurance and pilot income protection.'],
      ['💼', 'End of service and contract', 'End-of-service benefit, on an open-ended contract.'],
    ],

    hiringStatusJa: '採用ページに機長・副操縦士の募集要項が載っている（2026年10月31日に確認）。',
    hiringStatusEn: 'The careers site lists captain and first officer requirements (checked 31 October 2026).',
    hiring: { color: null, tagClass: 'tag-gray', tagJa: '採用ページあり', tagEn: 'Careers page' },
    job: {
      titleJa: '機長・副操縦士（B737）',
      subJa: '拠点はドバイ。B737 の型式を持つ人と持たない人で条件が違う。',
      titleEn: 'Captain and first officer (B737)',
      subEn: 'Dubai-based. Requirements differ for type-rated and non-type-rated pilots.',
    },
    hiringRowsJa: [
      ['共通', 'ICAO ATPL・ICAO 第1種身体検査・英語能力証明レベル4以上・高校卒業以上'],
      ['機長（型式あり）', '直近24か月に B737 の型式・総5,000時間・多人数運航機の機長1,500時間・B737 の機長1,000時間'],
      ['機長（型式なし）', '総5,000時間＋55トン超のジェットの機長1,500時間、または総6,000時間＋50トン超のジェットの機長1,500時間'],
      ['副操縦士（型式あり）', '直近24か月に B737 の型式・多人数運航1,500時間・B737 で500時間'],
      ['副操縦士（型式なし）', '総2,500時間・10トン超の多人数運航機1,000時間・多人数運航1,500時間'],
    ],
    hiringRowsEn: [
      ['All', 'ICAO ATPL, ICAO Class 1 medical, ELP level 4 or above, high school diploma or equivalent'],
      ['Captain (type rated)', 'B737 endorsed within 24 months, 5,000 hours total, 1,500 hours in command of multi-crew aircraft, 1,000 hours in command on the B737'],
      ['Captain (non type rated)', '5,000 hours total and 1,500 hours in command on jets over 55 tonnes, or 6,000 hours total and 1,500 hours in command on jets over 50 tonnes'],
      ['First officer (type rated)', 'B737 endorsed within 24 months, 1,500 MPA hours, 500 hours on the B737'],
      ['First officer (non type rated)', '2,500 hours total, 1,000 hours on multi-crew aircraft over 10 tonnes, 1,500 MPA hours'],
    ],
    hiringNoteJa: '※ 条件は採用ページの記載（2026年10月31日に確認）。応募の前に、採用ページで最新の条件を確かめる。',
    hiringNoteEn: 'Requirements as listed on the careers site (checked 31 October 2026). Check the current terms there before applying.',

    faqEn: (h) => [
      [`What is ${h.A.en} captain salary in 2026?`,
       `We estimate ${h.A.en} captain pay at about ${h.mm(h.A.cap.avg)} a year. The careers page lists basic salary plus housing and transportation allowances at AED 50,235 a month, and variable flying pay averaging AED 16,310 a month (based on 70 flying hours); the estimate adds the two and multiplies by 12. The fixed part alone is about ${h.mm(h.A.cap.lo)} a year. The UAE has no personal income tax.`],
      [`What is ${h.A.en} first officer salary?`,
       `We estimate ${h.A.en} first officer pay at about ${h.mm(h.A.fo.avg)} a year: AED 37,000 a month in basic salary, housing and transportation allowances, plus flying pay averaging AED 11,410 a month (70 flying hours), times 12. Without flying pay it is about ${h.mm(h.A.fo.lo)} a year.`],
      [`What are the requirements to fly for ${h.A.en}?`,
       `Every applicant needs an ICAO ATPL, an ICAO Class 1 medical and ELP level 4 or above. Type-rated captains need a B737 endorsed within the last 24 months, 5,000 hours total, 1,500 hours in command of multi-crew aircraft and 1,000 hours in command on the B737. Type-rated first officers need 1,500 MPA hours and 500 hours on the B737. Non-type-rated candidates have separate hour requirements, and there is a three-year training bond.`],
    ],
    compareNoteEn: compareFootEn(),
  },

  'air-peace': {
    code: 'P4',
    donor: 'spirit',
    donorColor: '#FFD700',
    donorTokens: [
      'spirit', 'Spirit', 'スピリット', 'FFD700', 'ffd700', '786508', 'ULCC',
      'フォートローダーデール', 'Fort Lauderdale', 'Miramar', 'フロリダ', 'Florida',
    ],
    /* 公式サイト（flyairpeace.com）の theme-color。導出していない。 */
    color: '#004296',
    flag: '🇳🇬',
    countryJa: 'ナイジェリア', countryEn: 'Nigeria',
    tags: { ja: ['ラゴス拠点', '外国人の契約パイロット'], en: ['Lagos-based', 'Expat contract pilots'] },
    subtitleJa: 'Air Peace — ナイジェリア・ラゴスを拠点とする航空会社。',
    subtitleEn: 'Air Peace — an airline based in Lagos, Nigeria.',
    statsJa: [['機材', 'B777 / B737 / E195-E2 / E145'], ['拠点', 'ラゴス']],
    statsEn: [['Fleet', 'B777 / B737 / E195-E2 / E145'], ['Base', 'Lagos']],
    /* 2026-10-31 に開いて確かめた。公式サイトは本物（社名・ラゴスの本社の住所）。Brookfield の求人は掲載中。 */
    careers: [
      { url: 'https://flyairpeace.com/', ja: 'エア・ピース 公式サイト（外部サイト）', en: 'Air Peace official site (external)' },
      { url: 'https://pilotsdb.brookfieldav.com/showjob/01290/E190-195-Captains---Air-Peace', ja: 'Brookfield Aviation の E190/195 機長の求人（外部サイト）', en: 'Brookfield Aviation: E190/195 captains (external)' },
    ],

    rowSubJa: { cap: 'E190/195（外国人の契約）', fo: 'E190/195（外国人の契約）' },
    rowSubEn: { cap: 'E190/195 (expat contract)', fo: 'E190/195 (expat contract)' },
    payTag: { ja: 'USD建て・手取り', en: 'Paid in USD, net' },
    stepTag: { ja: '代理店の求人から', en: 'From agency postings' },
    tableNote: {
      ja: '※ 推定年収は、採用代理店の求人に書かれた外国人の契約パイロットの月額（手取り）を12倍した額です。',
      en: 'The estimate is the monthly pay (net) in recruitment-agency postings for expat contract pilots, times 12.',
    },
    ldTail: {
      ja: '採用代理店の求人（外国人の契約パイロット・手取り）から計算した推定年収と、応募条件。',
      en: 'Estimated from recruitment-agency postings for expat contract pilots (net pay), plus the entry requirements.',
    },

    basisJa: '※ 出典：採用代理店 Brookfield Aviation の求人「E190/195 Captains / First Officers - Air Peace」（2026年10月31日も掲載中）と、'
      + 'Flight Crew International の求人（2026年7月24日掲載・8月21日締切）。機長 月 USD 9,000・副操縦士 月 USD 7,000（手取り）。'
      + '1年契約（更新可）・ラゴス拠点・8週勤務／3週休み。',
    basisEn: 'Sources: Brookfield Aviation’s postings “E190/195 Captains / First Officers - Air Peace” (still listed on 31 October 2026) and a Flight Crew International posting (posted 24 July 2026, closed 21 August 2026). '
      + 'Captains USD 9,000 a month and first officers USD 7,000 a month, net. One-year renewable contract, Lagos base, 8 weeks on / 3 weeks off.',

    overviewJa: 'Air Peace はナイジェリアの航空会社で、本社はラゴス州イケジャにある。国内線・西アフリカの地域路線・国際線を運航し、'
      + '公式サイトにはラゴス・アブジャとロンドンを結ぶ便の案内が載っている。採用代理店の求人によると、2013年設立で、機材は Boeing 777・Boeing 737・Embraer E195-E2・E145。'
      + 'E190/195 の機長・副操縦士は、採用代理店を通した外国人の契約パイロットとしても募集している。',
    overviewEn: 'Air Peace is a Nigerian airline headquartered in Ikeja, Lagos State. It flies domestic, West African regional and international routes, '
      + 'and its official site carries notices for its Lagos and Abuja services to London. According to recruitment-agency postings, it was founded in 2013 and flies the Boeing 777, Boeing 737, Embraer E195-E2 and E145. '
      + 'It also recruits E190/195 captains and first officers as expat contract pilots through recruitment agencies.',

    factsJa: [
      ['本社', 'ラゴス州イケジャ（ナイジェリア）'],
      ['拠点', 'ラゴス'],
      ['設立', '2013年（採用代理店の求人による）'],
      ['機材', 'B777 / B737 / E195-E2 / E145（採用代理店の求人による）'],
      ['航空当局', 'ナイジェリア民間航空局（NCAA）'],
    ],
    factsEn: [
      ['Headquarters', 'Ikeja, Lagos State, Nigeria'],
      ['Base', 'Lagos'],
      ['Founded', '2013 (per recruitment-agency postings)'],
      ['Fleet', 'B777 / B737 / E195-E2 / E145 (per recruitment-agency postings)'],
      ['Regulator', 'Nigerian Civil Aviation Authority (NCAA)'],
    ],

    routesJa: '国内線・西アフリカの地域路線・国際線。公式サイトにはラゴス・アブジャとロンドンを結ぶ便の案内がある。',
    routesEn: 'Domestic, West African regional and international routes. The official site carries notices for its Lagos and Abuja services to London.',
    fleetJa: 'Boeing 777・Boeing 737・Embraer E195-E2・E145（採用代理店の求人による）。代理店の求人は E190/195 の操縦士。',
    fleetEn: 'Boeing 777, Boeing 737, Embraer E195-E2 and E145 (per recruitment-agency postings). The agency vacancies are for E190/195 pilots.',

    trainingJa: [
      ['契約の形', '採用代理店を通した1年契約（更新可）。拠点はラゴス、勤務は8週勤務・3週休み。'],
      ['応募書類', 'E175/195 の型式つきの ATP 免許・直近の OPC/LPC・ログブックの直近3ページなど（Brookfield の求人）。'],
    ],
    trainingEn: [
      ['Contract', 'A one-year renewable contract through a recruitment agency. Lagos base, 8 weeks on / 3 weeks off.'],
      ['Documents', 'ATP license with the E175/195 rating endorsed, last OPC/LPC on the E175/195, last three pages of the logbook and more (Brookfield posting).'],
    ],

    benefitsJa: [
      ['💵', '月額（手取り）', '機長 月 USD 9,000・副操縦士 月 USD 7,000（Flight Crew International の求人に「NET」と明記）。'],
      ['✈️', '乗務1回ごとの手当・日当', '求人に書かれているが、額は書かれていない。'],
      ['📅', '勤務の形', '8週勤務・3週休み。'],
    ],
    benefitsEn: [
      ['💵', 'Monthly pay (net)', 'Captains USD 9,000 and first officers USD 7,000 a month (stated as NET in the Flight Crew International posting).'],
      ['✈️', 'Pay per sector and per diem', 'Listed in the postings, with no amount given.'],
      ['📅', 'Roster', '8 weeks on, 3 weeks off.'],
    ],

    hiringStatusJa: '採用代理店 Brookfield Aviation に E190/195 の機長・副操縦士の求人が載っている（2026年10月31日に確認・日付の記載なし）。',
    hiringStatusEn: 'Brookfield Aviation lists E190/195 captain and first officer vacancies (checked 31 October 2026; no posting date given).',
    hiring: { color: null, tagClass: 'tag-gray', tagJa: '代理店の求人', tagEn: 'Agency vacancy' },
    job: {
      titleJa: 'E190/195 機長・副操縦士（外国人の契約）',
      subJa: '採用代理店を通した1年契約（更新可）。拠点はラゴス。',
      titleEn: 'E190/195 captain and first officer (expat contract)',
      subEn: 'One-year renewable contract through a recruitment agency. Lagos base.',
    },
    hiringRowsJa: [
      ['免許', 'E175/195 の型式つきの ATP 免許'],
      ['機長', '総5,000時間・E175/195 の機長1,000時間（Brookfield）'],
      ['副操縦士', '総3,000時間・E175/195 の副操縦士500時間（Brookfield）'],
      ['勤務', '8週勤務・3週休み・ラゴス拠点'],
    ],
    hiringRowsEn: [
      ['License', 'ATP license with the E175/195 rating'],
      ['Captain', '5,000 hours total and 1,000 PIC hours on the E175/195 (Brookfield)'],
      ['First officer', '3,000 hours total and 500 SIC hours on the E175/195 (Brookfield)'],
      ['Roster', '8 weeks on, 3 weeks off, Lagos base'],
    ],
    hiringNoteJa: '※ 条件は採用代理店の求人の記載（2026年10月31日に確認）。応募の前に、求人のページで最新の条件を確かめる。',
    hiringNoteEn: 'Requirements as listed in the agency postings (checked 31 October 2026). Check the current terms on the posting before applying.',

    faqEn: (h) => [
      [`What is ${h.A.en} captain salary in 2026?`,
       `We estimate ${h.A.en} captain pay at about ${h.mm(h.A.cap.avg)} a year, take-home. Recruitment-agency postings for E190/195 expat contract captains list USD 9,000 a month (stated as net), times 12. Pay per sector and per diem are also listed, with no amount given.`],
      [`What is ${h.A.en} first officer salary?`,
       `We estimate ${h.A.en} first officer pay at about ${h.mm(h.A.fo.avg)} a year, take-home: USD 7,000 a month (stated as net) in the agency postings for E190/195 expat contract first officers, times 12.`],
      [`What are the requirements to fly for ${h.A.en}?`,
       `The Brookfield Aviation postings ask for an ATP license with the E175/195 rating. Captains need 5,000 hours total and 1,000 PIC hours on the E175/195; first officers need 3,000 hours total and 500 SIC hours on the E175/195. The contract is one year, renewable, based in Lagos, on an 8 weeks on / 3 weeks off roster.`],
    ],
    compareNoteEn: compareFootEn(),
  },

  /* ★2026-10-31 吉祥航空（投稿先だけの一覧から道Aへ上げた3社目）。機長はオーナー「一旦2017年の資料でいい」・副操縦士は機長の約3分の2。 */
  'juneyao-airlines': {
    code: 'HO',
    donor: 'spirit',
    donorColor: '#FFD700',
    donorTokens: [
      'spirit', 'Spirit', 'スピリット', 'FFD700', 'ffd700', '786508', 'ULCC',
      'フォートローダーデール', 'Fort Lauderdale', 'Miramar', 'フロリダ', 'Florida',
    ],
    /* 公式サイト（www.juneyaoair.com）でいちばん多く使われている色。導出していない。 */
    color: '#7F094A',
    flag: '🇨🇳',
    countryJa: '中国', countryEn: 'China',
    tags: { ja: ['上海拠点', '上場 603885'], en: ['Shanghai-based', 'Listed 603885'] },
    subtitleJa: 'Juneyao Airlines — 上海を拠点とする中国の航空会社。',
    subtitleEn: 'Juneyao Airlines — a Chinese airline based in Shanghai.',
    statsJa: [['機材', 'A320 / B787'], ['拠点', '上海']],
    statsEn: [['Fleet', 'A320 / B787'], ['Base', 'Shanghai']],
    /* 2026-10-31 に2本とも開いて、吉祥航空の公式サイトであることを確かめた（題が「吉祥航空」「Juneyaoair」）。 */
    careers: [
      { url: 'https://www.juneyaoair.com/', ja: '吉祥航空 公式サイト（外部サイト）', en: 'Juneyao Airlines official site, Chinese (external)' },
      { url: 'https://global.juneyaoair.com/', ja: '吉祥航空 国際サイト（外部サイト）', en: 'Juneyao Airlines international site (external)' },
    ],

    rowSubJa: { cap: 'A320（外国人機長の契約・2017年の資料）', fo: '資料なし（機長の約3分の2）' },
    rowSubEn: { cap: 'A320 (expat captain contract, 2017 document)', fo: 'No source (about two-thirds of captain)' },
    payTag: { ja: 'USD建て（2017年の資料）', en: 'USD (2017 document)' },
    stepTag: { ja: '機長の約3分の2', en: 'About two-thirds of captain' },
    tableNote: {
      ja: '※ 機長の推定年収は、採用代理店 Pilot Movers の資料（2017年）にある外国人機長の契約の「年収の目安」です。副操縦士は資料が無いため、機長の推定の約3分の2です。',
      en: 'The captain estimate is the “Expected Annual Salary (Approx.)” for an expat captain contract in a 2017 document from the recruitment agency Pilot Movers. There is no first officer source, so that figure is about two-thirds of the captain estimate.',
    },
    ldTail: {
      ja: '採用代理店の資料（2017年・外国人機長の契約）から計算した推定年収。',
      en: 'Estimated from a recruitment-agency document (2017, expat captain contract).',
    },

    basisJa: '※ 出典：採用代理店 Pilot Movers の資料「Juneyao Airlines A320 Captains」（2017年・発行日の記載なし）の'
      + '「Improved Terms for Pilots joining as from 1/06/2017」の表。Option 1（居住型）の年収の目安 US$317,640・表の最高額 Option 2 US$330,140。'
      + '税引き前か手取りかは書かれていない。',
    basisEn: 'Source: the recruitment agency Pilot Movers’ document “Juneyao Airlines A320 Captains” (2017, no publication date given), '
      + 'table “Improved Terms for Pilots joining as from 1/06/2017”: Option 1 (residential) Expected Annual Salary (Approx.) US$317,640; the highest in the table, Option 2, US$330,140. '
      + 'The document does not say whether these are before or after tax.',

    overviewJa: '吉祥航空（上海吉祥航空股份有限公司・Juneyao Airlines）は上海を本拠とする中国の航空会社で、上海証券取引所に上場している（証券コード 603885）。'
      + '採用代理店の資料（2017年）では、外国人機長を A320 で募集し、B787 の受領を予定していた。',
    overviewEn: 'Juneyao Airlines (Shanghai Juneyao Airlines Co., Ltd.) is a Chinese airline based in Shanghai, listed on the Shanghai Stock Exchange (stock code 603885). '
      + 'A recruitment-agency document from 2017 shows it hiring expat captains for the A320, with B787 deliveries planned.',

    factsJa: [
      ['本社', '上海（中国）'],
      ['上場', '上海証券取引所（603885）'],
      ['機材', 'A320 / B787（採用代理店の資料による）'],
      ['所得税', '中国（課税国）'],
    ],
    factsEn: [
      ['Headquarters', 'Shanghai, China'],
      ['Listing', 'Shanghai Stock Exchange (603885)'],
      ['Fleet', 'A320 / B787 (per recruitment-agency documents)'],
      ['Income tax', 'China (taxed)'],
    ],

    routesJa: '上海を拠点とする。就航地は公式サイトで確かめる。',
    routesEn: 'Based in Shanghai. Check the official site for the current network.',
    fleetJa: 'A320 と B787（採用代理店の資料による。2017年の資料では B787 は受領予定）。',
    fleetEn: 'A320 and B787 (per recruitment-agency documents; the 2017 document lists the B787 as planned).',

    trainingJa: [
      ['契約の選択肢', '2017年の採用代理店の資料には、居住型・通勤型など5つの契約（Option 1〜5）がある。いちばん低い Option 5 は4週勤務・4週休み。'],
    ],
    trainingEn: [
      ['Contract options', 'The 2017 agency document lists five contract options (Option 1 to 5), residential and commuting. The lowest, Option 5, is 4 weeks on, 4 weeks off.'],
    ],

    benefitsJa: [
      ['💵', '契約満了賞与', '2017年の資料では1契約あたり US$40,000（Option 1〜3）・US$20,000（Option 4〜5）。'],
      ['✈️', '海外勤務手当・旅行手当', '同じ資料で年 US$8,000・US$10,000（Option 1〜3）、年 US$4,000・US$5,000（Option 4〜5）。'],
    ],
    benefitsEn: [
      ['💵', 'Completion bonus', 'In the 2017 document, US$40,000 per contract (Options 1 to 3) or US$20,000 (Options 4 and 5).'],
      ['✈️', 'Overseas and travel allowances', 'In the same document, US$8,000 and US$10,000 a year (Options 1 to 3), or US$4,000 and US$5,000 (Options 4 and 5).'],
    ],

    hiringStatusJa: '採用代理店の資料（2017年）に外国人機長（A320）の募集がある。いまの募集は確かめていない。',
    hiringStatusEn: 'A 2017 recruitment-agency document lists expat captain (A320) hiring. Current hiring has not been checked.',
    hiring: { color: null, tagClass: 'tag-gray', tagJa: '2017年の資料', tagEn: '2017 document' },
    job: {
      titleJa: '機長（A320・外国人の契約）',
      subJa: '採用代理店 Pilot Movers の資料（2017年）。',
      titleEn: 'Captain (A320, expat contract)',
      subEn: 'From the recruitment agency Pilot Movers’ document (2017).',
    },
    hiringRowsJa: [
      ['機種', 'A320'],
      ['契約', 'Option 1〜5（居住型・通勤型）'],
    ],
    hiringRowsEn: [
      ['Type', 'A320'],
      ['Contract', 'Options 1 to 5 (residential and commuting)'],
    ],
    hiringNoteJa: '※ 条件は2017年の採用代理店の資料の記載。応募の前に、会社と採用代理店で最新の条件を確かめる。',
    hiringNoteEn: 'Terms as listed in a 2017 recruitment-agency document. Check the current terms with the airline and the agency before applying.',

    faqEn: (h) => [
      [`What is ${h.A.en} captain salary?`,
       `We estimate ${h.A.en} captain pay at about ${h.mm(h.A.cap.avg)} a year. That is the “Expected Annual Salary (Approx.)” of US$317,640 for the Option 1 expat captain contract on the A320, in a 2017 document from the recruitment agency Pilot Movers. The same table goes up to US$330,140 (Option 2). The document does not say whether the figures are before or after tax.`],
      [`What is ${h.A.en} first officer salary?`,
       `There is no first officer source, so we estimate ${h.A.en} first officer pay at about ${h.mm(h.A.fo.avg)} a year — about two-thirds of the captain estimate.`],
    ],
    compareNoteEn: compareFootEn(),
  },

  /* ★2026-11-02 米国の貨物5社。FedEx・UPS は投稿先だけの一覧（airline-ops.mjs）から道Aへ（B5・コードは変えない）。
     Atlas・ABX・Kalitta は新しく道Aで足す。借り元はスピリット航空。本文は短く、確かめた事実だけ。 */
  'fedex-express': {
    code: 'FX',
    donor: 'spirit',
    donorColor: '#FFD700',
    donorTokens: [
      'spirit', 'Spirit', 'スピリット', 'FFD700', 'ffd700', '786508', 'ULCC',
      'フォートローダーデール', 'Fort Lauderdale', 'Miramar', 'フロリダ', 'Florida',
    ],
    /* 採用サイト（careers.fedex.com）の app.css でいちばん多く使われている色（FedEx のパープル・65か所）。導出していない。
       同じ CSS に FedEx Express のオレンジ #FF6200（31か所）も在る。 */
    color: '#4D148C',
    flag: '🇺🇸',
    countryJa: '米国', countryEn: 'United States',
    tags: { ja: ['メンフィス拠点', '貨物航空', 'ALPA の協約'], en: ['Memphis-based', 'Cargo airline', 'ALPA contract'] },
    subtitleJa: 'フェデックス・エクスプレス — メンフィスを本拠とする米国の貨物航空会社。雇用主は Federal Express Corporation。',
    subtitleEn: 'FedEx Express — a Memphis-based US cargo airline. The employer is Federal Express Corporation.',
    statsJa: [['機材', 'B777F / B767F / MD-11 / A300 / B757'], ['拠点', 'メンフィス（MEM）・インディアナポリス（IND）ほか']],
    statsEn: [['Fleet', 'B777F / B767F / MD-11 / A300 / B757'], ['Bases', 'Memphis (MEM), Indianapolis (IND) and others']],
    /* 2026-11-02 に開いて、FedEx の採用サイトの操縦士のページであることを確かめた（題「Pilot Careers | FedEx Careers」・200）。 */
    careers: [
      { url: 'https://careers.fedex.com/career-areas/pilot/', ja: 'FedEx 操縦士の採用ページ（外部サイト）', en: 'FedEx pilot careers (external)' },
    ],

    rowSubJa: { cap: 'B777F / B767F / A300（大型機の時給表）', fo: 'B777F / B767F / A300（大型機の時給表）' },
    rowSubEn: { cap: 'B777F / B767F / A300 (widebody pay table)', fo: 'B777F / B767F / A300 (widebody pay table)' },
    payTag: { ja: 'USD建て・税引前', en: 'Paid in USD, pre-tax' },
    stepTag: { ja: '年次制（労働協約）', en: 'Seniority scale (union contract)' },
    tableNote: {
      ja: '※ 推定年収は、労働協約の大型機の時給（機長12年目・副操縦士6年目）に年884時間（4週ごとの最低保証68時間 × 13）を掛けた額です。利益配分・日当・会社の年金は入れていません。幅の下の端は B757 の時給表の1年目、上の端は大型機の時給表の15年目で同じ計算をした額です。',
      en: 'The estimate is the contract’s widebody hourly rate (year-12 captain, year-6 first officer) times 884 hours a year (the 68-hour minimum per four-week period, 13 times a year). Profit sharing, per diem and the company retirement plan are not included. The low end is year 1 on the B757 table and the high end is year 15 on the widebody table, worked out the same way.',
    },
    ldTail: {
      ja: 'パイロットの労働協約の時給表から計算した推定年収と、応募条件。',
      en: 'Estimated from the pilot contract’s pay table, plus the entry requirements.',
    },

    basisJa: '※ 出典：FedEx Express のパイロットの労働協約（ALPA と結んだもの・2026年6月29日発効）の時給表（2026年7月の bid period から）。'
      + '機長は大型機（B777F / B767F / A300）の12年目 時給 $456.35 × 年884時間（4週ごとの最低保証68時間 × 13）＝ $403,413.40。'
      + '副操縦士は同じ表の6年目 時給 $283.40 × 884時間 ＝ $250,525.60。'
      + '利益配分・日当・国際線の加算は入れていない。会社の年金は、在職者が従来の確定給付と確定拠出から選ぶ制度で拠出率が分からないため入れていない。円は1ドル＝158.95円で換算。',
    basisEn: 'Source: FedEx Express’s pilot contract with ALPA (effective 29 June 2026), pay table from the July 2026 bid period. '
      + 'Captains: year-12 widebody (B777F / B767F / A300) rate of $456.35 an hour × 884 hours a year (the 68-hour minimum per four-week period × 13) = $403,413.40. '
      + 'First officers: year-6 rate on the same table, $283.40 × 884 hours = $250,525.60. '
      + 'Profit sharing, per diem and international premiums are not included. The company retirement plan (a choice between the legacy defined-benefit plan and defined contribution for current pilots) is left out because the contribution rate is not known. Converted at 158.95 yen to the dollar.',

    overviewJa: 'FedEx Express は、米国テネシー州メンフィスを本拠とする貨物航空会社。雇用主は Federal Express Corporation（FedEx Corporation の主な事業会社）で、親会社の年次報告書（2026年5月期）は「1973年に速達の輸送を切り開いた」と書いている。'
      + 'メンフィスの仕分け拠点が航空網の中心で、2つ目の全米ハブはインディアナポリス。操縦士は労働組合 ALPA が代表し、新しい労働協約は2026年6月に批准された。',
    overviewEn: 'FedEx Express is a cargo airline based in Memphis, Tennessee. The employer is Federal Express Corporation, FedEx Corporation’s main operating company, which its parent’s annual report (year to May 2026) says pioneered express transportation in 1973. '
      + 'The Memphis sorting facility is the center of the air network, with a second national hub in Indianapolis. Pilots are represented by ALPA, and a new contract was ratified in June 2026.',

    factsJa: [
      ['本社', 'メンフィス（テネシー州）'],
      ['航空網の中心', 'メンフィス。2つ目の全米ハブはインディアナポリス'],
      ['操縦士の基地', 'MEM・IND・OAK・ANC'],
      ['事業開始', '1973年'],
      ['労働組合', 'ALPA（新しい協約は2026年6月に批准）'],
      ['所得税', '米国（課税）'],
    ],
    factsEn: [
      ['Headquarters', 'Memphis, Tennessee'],
      ['Network center', 'Memphis, with a second national hub in Indianapolis'],
      ['Pilot bases', 'MEM, IND, OAK, ANC'],
      ['Started', '1973'],
      ['Union', 'ALPA (new contract ratified June 2026)'],
      ['Income tax', 'United States (taxed)'],
    ],

    routesJa: 'メンフィスを中心にした航空網で、220を超える国・地域へ配送している（親会社の年次報告書）。',
    routesEn: 'An air network centered on Memphis, delivering to more than 220 countries and territories (parent company’s annual report).',
    fleetJa: '2026年5月31日時点で B777F 59機・B767F 152機・MD-11 29機・A300-600 57機・B757-200 86機（親会社の年次報告書）。MD-11 は2025年11月の耐空性改善命令で運航を止め、2026年5月から順に戻している。',
    fleetEn: 'As of 31 May 2026: 59 B777F, 152 B767F, 29 MD-11, 57 A300-600 and 86 B757-200 (parent company’s annual report). The MD-11s were grounded by an FAA emergency directive in November 2025 and have been returning to service since May 2026.',

    trainingJa: [
      ['選考', '採用ページにプロフィールを登録 → 選ばれた人にメールで応募の案内 → 遠隔のコンピューター試験 → 1日の対面の面接（パネル面接と状況面接）。'],
      ['入り方', '経験者の採用のほか、大学・軍・Purple Runway（FedEx の小型機のフィーダー網を飛ぶ会社から大型機へ進む育成制度）。'],
    ],
    trainingEn: [
      ['Selection', 'Create a profile on the careers site → selected applicants get an email with a link to apply → remote computer-based testing → a one-day in-person panel and situational interview.'],
      ['Pathways', 'Qualified pilots, college, military, and Purple Runway (a development program from FedEx’s feeder-network airlines to the widebody fleet).'],
    ],

    benefitsJa: [
      ['📅', '年休', '勤続（その年の12月31日時点）1〜4年未満 15日・5〜9年未満 22日・10〜19年未満 29日・20年以上 36日。翌年に使う（2026年の協約）。'],
      ['🍽️', '日当', '国内 1時間あたり $2.85・国際 $3.85（2026年の協約。24か月後に $3.00・$4.05）。'],
      ['💼', '年金', '在職者は従来の確定給付と確定拠出の選択制。新しく入る人は従来の確定給付の対象外。'],
      ['✈️', '私用の旅行', '本人と対象の家族が他社便に空席待ちで乗れる（ALPA の案内）。'],
    ],
    benefitsEn: [
      ['📅', 'Vacation', 'Earned for the following year by years of service at 31 December: 15 days (1 to under 4 years), 22 (5 to under 9), 29 (10 to under 19), 36 (20 or more) — 2026 contract.'],
      ['🍽️', 'Per diem', '$2.85 an hour domestic and $3.85 international (2026 contract; $3.00 and $4.05 after 24 months).'],
      ['💼', 'Retirement', 'Current pilots choose between the legacy defined-benefit plan and defined contribution. New hires are not eligible for the legacy defined-benefit plan.'],
      ['✈️', 'Personal travel', 'Pilots and eligible dependents can fly standby on other airlines (ALPA guidance).'],
    ],

    hiringStatusJa: '採用ページにプロフィールを登録し、選ばれた人に応募の案内が届く形（2026年11月2日に確認）。',
    hiringStatusEn: 'Pilots register a profile on the careers site; selected applicants are emailed a link to apply (checked 2 November 2026).',
    hiring: { color: null, tagClass: 'tag-gray', tagJa: '採用ページあり', tagEn: 'Careers page' },
    job: {
      titleJa: '操縦士',
      subJa: '就労ビザの支援は無い。米国の市民権か永住権が要る。',
      titleEn: 'Pilots',
      subEn: 'No work-visa sponsorship: non-US citizens need a Permanent Resident Card.',
    },
    hiringRowsJa: [
      ['免許など', 'ATP・第1種身体検査・無線の許可（Radiotelephone Operator Permit）・有効な米国のパスポート・SIDA の資格'],
      ['飛行時間', '固定翼で総1,500時間。機長時間（ジェット・12,500ポンド以上の多発ターボプロップなど）500時間以上が必須・1,000時間が望ましい'],
      ['学歴', '4年制大学の学位が望ましい'],
      ['就労資格', '就労ビザの支援なし。米国人以外は永住権（グリーンカード）が要る'],
    ],
    hiringRowsEn: [
      ['Licenses', 'ATP, first-class medical, radiotelephone operator permit, valid US passport, SIDA badge eligibility'],
      ['Flight hours', '1,500 hours total fixed-wing; at least 500 hours PIC (jets, multi-engine turboprops of 12,500 lb or more, and similar), 1,000 hours PIC preferred'],
      ['Education', 'Bachelor’s degree preferred'],
      ['Work authorization', 'No visa sponsorship; non-US citizens need a Permanent Resident Card'],
    ],
    hiringNoteJa: '※ 条件は採用ページの記載（2026年11月2日に確認）。応募の前に、採用ページで最新の条件を確かめる。',
    hiringNoteEn: 'Requirements as listed on the careers site (checked 2 November 2026). Check the current terms there before applying.',

    faqEn: (h) => [
      [`What is ${h.A.en} captain salary in 2026?`,
       `We estimate ${h.A.en} captain pay at about ${h.mm(h.A.cap.avg)} a year: the year-12 widebody (B777F / B767F / A300) captain rate of $456.35 an hour in the pilot contract that took effect on 29 June 2026, times 884 hours a year (the 68-hour minimum per four-week bid period, 13 times a year). Profit sharing, per diem and the company retirement plan are not included.`],
      [`What is ${h.A.en} first officer salary?`,
       `We estimate ${h.A.en} first officer pay at about ${h.mm(h.A.fo.avg)} a year: the year-6 widebody first officer rate of $283.40 an hour times the same 884 hours.`],
      [`What are the requirements to fly for ${h.A.en}?`,
       `The careers page asks for an ATP certificate, a first-class medical, a radiotelephone operator permit, a valid US passport and SIDA badge eligibility, plus 1,500 hours total fixed-wing time with at least 500 hours PIC (1,000 hours preferred). FedEx does not sponsor work visas: non-US citizens need a Permanent Resident Card.`],
    ],
    compareNoteEn: compareFootEn(),
  },

  'ups-airlines': {
    code: '5X',
    donor: 'spirit',
    donorColor: '#FFD700',
    donorTokens: [
      'spirit', 'Spirit', 'スピリット', 'FFD700', 'ffd700', '786508', 'ULCC',
      'フォートローダーデール', 'Fort Lauderdale', 'Miramar', 'フロリダ', 'Florida',
    ],
    /* UPS の求人サイト（jobs-ups.com）のボタンの地の色（UPS のゴールド）。導出していない。
       同じ所と CSS の --brand-color-secondary に UPS のブラウン #351C15 も在る（暗い画面ではほぼ見えない 1.2:1）。 */
    color: '#FFB500',
    flag: '🇺🇸',
    countryJa: '米国', countryEn: 'United States',
    tags: { ja: ['ルイビル拠点', '貨物航空', 'IPA の協約'], en: ['Louisville-based', 'Cargo airline', 'IPA contract'] },
    subtitleJa: 'ユーピーエス・エアラインズ — ケンタッキー州ルイビルの Worldport を中心に飛ぶ、UPS の貨物航空会社。',
    subtitleEn: 'UPS Airlines — UPS’s cargo airline, flying a network centered on Worldport in Louisville, Kentucky.',
    statsJa: [['機材', 'B767 / B757 / B747 / A300'], ['拠点', 'ルイビル（SDF）ほか']],
    statsEn: [['Fleet', 'B767 / B757 / B747 / A300'], ['Bases', 'Louisville (SDF) and others']],
    /* 2026-11-02 に UPS の操縦士の採用ページを確かめられなかった（cargo-notes.md）。確かめていないリンクは貼らない。 */
    careers: [],

    rowSubJa: { cap: '全機種共通の時給表', fo: '全機種共通の時給表' },
    rowSubEn: { cap: 'One pay table for all fleets', fo: 'One pay table for all fleets' },
    payTag: { ja: 'USD建て・税引前', en: 'Paid in USD, pre-tax' },
    stepTag: { ja: '年次制（労働協約）', en: 'Seniority scale (union contract)' },
    tableNote: {
      ja: '※ 推定年収は、労働協約の時給（2025年9月1日からの表・全機種共通。機長12年目・副操縦士6年目）に年975時間（28日ごとの75時間 × 13）を掛け、会社の確定拠出年金 12% を足した額です。確定給付の年金・利益配分・日当は入れていません。幅の下の端は1年目（機長は2年目。1年目の機長欄は全員共通の初年度の時給のため）、上の端は15年目で同じ計算をした額です。',
      en: 'The estimate is the contract hourly rate (table from 1 September 2025, all fleets; year-12 captain, year-6 first officer) times 975 hours a year (75 hours per 28-day period × 13), plus the 12% company defined contribution. The defined-benefit pension, profit sharing and per diem are not included. The low end is year 1 (year 2 for captains, because the year-1 captain column is the common first-year rate) and the high end is year 15, worked out the same way.',
    },
    ldTail: {
      ja: 'パイロットの労働協約の時給表から計算した推定年収。',
      en: 'Estimated from the pilot contract’s pay table.',
    },

    basisJa: '※ 出典：UPS Airlines のパイロットの労働協約（IPA と結んだもの）の時給表（2025年9月1日からの表）と、組合の比較資料（28日ごとの時間・会社の確定拠出年金 12%）。'
      + '機長は12年目 時給 $390.21 × 年975時間（28日ごとの75時間 × 13）＝ $380,454.75、確定拠出年金 12% を足して $426,109.32。'
      + '副操縦士は6年目 時給 $242.32 × 975時間 ＝ $236,262.00、12% を足して $264,613.44。'
      + '確定給付の年金・利益配分・日当は入れていない。協約は2025年9月1日に改定できるようになり、交渉中（親会社の年次報告書・2025年12月期）。円は1ドル＝158.95円で換算。',
    basisEn: 'Source: UPS Airlines’ pilot contract with the IPA, pay table from 1 September 2025, plus the union’s comparison material (hours per 28-day period and the 12% company defined contribution). '
      + 'Captains: year-12 rate of $390.21 an hour × 975 hours a year (75 hours per 28-day period × 13) = $380,454.75; with the 12% defined contribution, $426,109.32. '
      + 'First officers: year-6 rate of $242.32 × 975 hours = $236,262.00; with 12%, $264,613.44. '
      + 'The defined-benefit pension, profit sharing and per diem are not included. The contract became amendable on 1 September 2025 and was under negotiation (parent company’s annual report for 2025). Converted at 158.95 yen to the dollar.',

    overviewJa: 'UPS Airlines は、米国の物流会社 UPS（United Parcel Service）の貨物航空会社。親会社の年次報告書（2025年12月期）によると、米国内はハブ・アンド・スポークで飛び、中心のハブはケンタッキー州ルイビルの Worldport。'
      + '操縦士は約3,400人で、労働組合 IPA（Independent Pilots Association）が代表している。MD-11 は2025年10〜12月に運航を止めて退役させた。',
    overviewEn: 'UPS Airlines is the cargo airline of UPS (United Parcel Service). According to the parent company’s annual report for 2025, its US flying runs on a hub-and-spoke pattern centered on Worldport in Louisville, Kentucky. '
      + 'About 3,400 pilots are represented by the Independent Pilots Association (IPA). The MD-11 fleet was permanently grounded and retired in the fourth quarter of 2025.',

    factsJa: [
      ['親会社', 'United Parcel Service, Inc.'],
      ['中心のハブ', 'Worldport（ケンタッキー州ルイビル・SDF）'],
      ['操縦士の基地', 'SDF・ANC・ONT・MIA'],
      ['操縦士', '約3,400人（IPA が代表）'],
      ['所得税', '米国（課税）'],
    ],
    factsEn: [
      ['Parent', 'United Parcel Service, Inc.'],
      ['Main hub', 'Worldport, Louisville, Kentucky (SDF)'],
      ['Pilot bases', 'SDF, ANC, ONT, MIA'],
      ['Pilots', 'About 3,400 (represented by the IPA)'],
      ['Income tax', 'United States (taxed)'],
    ],

    routesJa: '米国内はルイビルの Worldport を中心にしたハブ・アンド・スポーク。欧州の主なハブはドイツ、アジアは中国と香港に主なハブが複数ある（親会社の年次報告書）。',
    routesEn: 'Hub-and-spoke in the US, centered on Worldport in Louisville. The main European hub is in Germany, and there are several major hubs in China and Hong Kong (parent company’s annual report).',
    fleetJa: '2025年12月31日時点で B757-200 75機・B767-300 89機（ほかに改造貨物機10機・18機を発注）・A300-600 52機・B747-400F 13機（改造機を含む）・B747-8F 30機（親会社の年次報告書）。MD-11 は2025年10〜12月に運航を止め、退役させた。',
    fleetEn: 'As of 31 December 2025: 75 B757-200, 89 B767-300 (plus 10 converted freighters, with 18 on order), 52 A300-600, 13 B747-400 freighters (including conversions) and 30 B747-8F (parent company’s annual report). The MD-11s were grounded and retired in the fourth quarter of 2025.',

    trainingJa: [
      ['協約', '2025年9月1日に改定できるようになり、交渉中（親会社の年次報告書・2025年12月期）。'],
    ],
    trainingEn: [
      ['Contract', 'Amendable since 1 September 2025 and under negotiation (parent company’s annual report for 2025).'],
    ],

    benefitsJa: [
      ['💼', '年金', '会社の確定拠出 12% と確定給付の両方（組合の比較資料）。'],
      ['🍽️', '日当', '国内 1時間あたり $3.35・国際 $4.10（2025年1月1日の参考値。2026年の額は確かめていない）。'],
      ['🌏', '国際線の加算', '機長 1時間あたり $6.50・副操縦士 $4.50（組合の比較資料）。'],
      ['📅', '年休', '比較資料の参考値で、勤続2年 14日・5年 21日・12年 28日・20年 35日。'],
    ],
    benefitsEn: [
      ['💼', 'Retirement', 'Both a 12% company defined contribution and a defined-benefit pension (union comparison material).'],
      ['🍽️', 'Per diem', '$3.35 an hour domestic and $4.10 international (reference rates from 1 January 2025; 2026 rates not confirmed).'],
      ['🌏', 'International premium', '$6.50 an hour for captains and $4.50 for first officers (union comparison material).'],
      ['📅', 'Vacation', 'Reference figures from comparison material: 14 days at 2 years of service, 21 at 5, 28 at 12, 35 at 20.'],
    ],

    hiringStatusJa: 'UPS の求人サイト（jobs-ups.com）で「pilot」を検索しても、操縦士の求人は出てこなかった（2026年11月2日に確認）。',
    hiringStatusEn: 'A search for “pilot” on UPS’s jobs site (jobs-ups.com) returned no pilot postings (checked 2 November 2026).',
    hiring: { color: null, tagClass: 'tag-gray', tagJa: '求人の掲載なし', tagEn: 'No posting found' },
    job: {
      titleJa: '操縦士',
      subJa: '公式の募集要項は確かめられていない。',
      titleEn: 'Pilots',
      subEn: 'No official requirements page could be confirmed.',
    },
    hiringRowsJa: [
      ['労働組合', 'IPA（Independent Pilots Association）'],
      ['協約', '2025年9月1日に改定可能・交渉中（親会社の年次報告書・2025年12月期）'],
    ],
    hiringRowsEn: [
      ['Union', 'Independent Pilots Association (IPA)'],
      ['Contract', 'Amendable since 1 September 2025, under negotiation (parent company’s annual report for 2025)'],
    ],
    hiringNoteJa: '※ 応募の前に、UPS の求人サイトで最新の募集を確かめる。',
    hiringNoteEn: 'Check UPS’s jobs site for current openings before applying.',

    faqEn: (h) => [
      [`What is ${h.A.en} captain salary in 2026?`,
       `We estimate ${h.A.en} captain pay at about ${h.mm(h.A.cap.avg)} a year: the year-12 captain rate of $390.21 an hour (one table for all fleets, from 1 September 2025) times 975 hours a year (75 hours per 28-day period, 13 times a year), plus the 12% company defined contribution. The defined-benefit pension, profit sharing and per diem are not included.`],
      [`What is ${h.A.en} first officer salary?`,
       `We estimate ${h.A.en} first officer pay at about ${h.mm(h.A.fo.avg)} a year: the year-6 rate of $242.32 an hour times the same 975 hours, plus the 12% defined contribution.`],
      [`Is ${h.A.en} hiring pilots?`,
       `We could not find a pilot posting on UPS’s jobs site (checked 2 November 2026). UPS pilots are represented by the Independent Pilots Association (IPA); their contract became amendable on 1 September 2025 and was under negotiation according to the parent company’s 2025 annual report.`],
    ],
    compareNoteEn: compareFootEn(),
  },

  'atlas-air': {
    code: '5Y',
    donor: 'spirit',
    donorColor: '#FFD700',
    donorTokens: [
      'spirit', 'Spirit', 'スピリット', 'FFD700', 'ffd700', '786508', 'ULCC',
      'フォートローダーデール', 'Fort Lauderdale', 'Miramar', 'フロリダ', 'Florida',
    ],
    /* 会社のサイト（atlasairworldwide.com）のテーマの style.css で h1 と .btn-primary の色（いちばん多く使われている色・78か所）。導出していない。
       ロゴの金 #FFB608（logo_atlas-air_main_v2.svg）とヘッダーの紺 #101E40 も在る。 */
    color: '#25B0ED',
    flag: '🇺🇸',
    countryJa: '米国', countryEn: 'United States',
    tags: { ja: ['B747 貨物', 'ACMI・チャーター', 'Teamsters の協約'], en: ['747 freighters', 'ACMI and charter', 'Teamsters contract'] },
    subtitleJa: 'Atlas Air — B747・B777 の貨物機と旅客チャーターを運航する米国の航空会社。',
    subtitleEn: 'Atlas Air — a US airline flying 747 and 777 freighters as well as passenger charters.',
    statsJa: [['機材', 'B747 / B777 / B767'], ['基地', 'ANC / JFK / ORD / LAX / MIA / SEA']],
    statsEn: [['Fleet', 'B747 / B777 / B767'], ['Bases', 'ANC / JFK / ORD / LAX / MIA / SEA']],
    /* 2026-11-02 に2本とも開いて確かめた。1本目は会社の採用ページ（題「Careers - Atlas Air Worldwide」・Pilots の節あり）。
       2本目は副操縦士の登録窓口（Greenhouse の API で題「First Officer Talent Community」・2026-05-28 更新を確認）。 */
    careers: [
      { url: 'https://www.atlasairworldwide.com/careers/', ja: 'アトラス航空 採用ページ（外部サイト）', en: 'Atlas Air careers (external)' },
      { url: 'https://www.atlasairworldwide.com/careers/job-board/?gh_jid=4194418009', ja: '副操縦士の登録窓口（外部サイト）', en: 'First officer talent community (external)' },
    ],

    rowSubJa: { cap: 'B747（2021年の協約・2025年9月の列）', fo: 'B747（2021年の協約・2025年9月の列）' },
    rowSubEn: { cap: 'B747 (2021 contract, September 2025 column)', fo: 'B747 (2021 contract, September 2025 column)' },
    payTag: { ja: 'USD建て・税引前', en: 'Paid in USD, pre-tax' },
    stepTag: { ja: '年次制（労働協約）', en: 'Seniority scale (union contract)' },
    tableNote: {
      ja: '※ 推定年収は、労働協約の B747 の時給（2025年9月1日の列。機長12年目・副操縦士6年目）に年768時間（月の最低保証64時間 × 12）を掛け、会社の確定拠出年金 16% を足した額です。利益配分と日当は入れていません。幅の下の端は1年目（機長は B767 の表）、上の端は B747 の表の12年目で同じ計算をした額です。',
      en: 'The estimate is the contract’s B747 hourly rate (1 September 2025 column; year-12 captain, year-6 first officer) times 768 hours a year (the 64-hour monthly minimum × 12), plus the 16% company defined contribution. Profit sharing and per diem are not included. The low end is year 1 (on the B767 table for captains) and the high end is year 12 on the B747 table, worked out the same way.',
    },
    ldTail: {
      ja: 'パイロットの労働協約の時給表から計算した推定年収と、応募条件。',
      en: 'Estimated from the pilot contract’s pay table, plus the entry requirements.',
    },

    basisJa: '※ 出典：Atlas Air のパイロットの労働協約（Teamsters Local 2750 と結んだ2021年の協約）の時給表の2025年9月1日の列。'
      + '月64時間の最低保証は協約と副操縦士の募集要項（2026年5月更新）に、確定拠出年金 16% は参考表（2026年）に書かれている。'
      + '機長は B747 の12年目 時給 $332.68 × 年768時間（64時間 × 12）＝ $255,498.24、16% を足して $296,377.96。'
      + '副操縦士は B747 の6年目 時給 $195.07 × 768時間 ＝ $149,813.76、16% を足して $173,783.96。'
      + '利益配分（制度はある）と日当は入れていない。協約は2026年9月10日から改定できる。円は1ドル＝158.95円で換算。',
    basisEn: 'Source: Atlas Air’s 2021 pilot contract with Teamsters Local 2750, 1 September 2025 column of the pay table. '
      + 'The 64-hour monthly minimum is in the contract and the first officer posting (updated May 2026); the 16% defined contribution is from a reference table (2026). '
      + 'Captains: year-12 B747 rate of $332.68 an hour × 768 hours a year (64 × 12) = $255,498.24; with 16%, $296,377.96. '
      + 'First officers: year-6 B747 rate of $195.07 × 768 hours = $149,813.76; with 16%, $173,783.96. '
      + 'Profit sharing (the plan exists) and per diem are not included. The contract became amendable on 10 September 2026. Converted at 158.95 yen to the dollar.',

    overviewJa: 'Atlas Air は、貨物機と旅客チャーターを運航する米国の航空会社（親会社は Atlas Air Worldwide）。会社のサイトによると、B747 の貨物機を世界でいちばん多く持ち、B747・B777・B767 を飛ばす。'
      + '顧客に機体と乗員を貸す ACMI・CMI とチャーターが中心で、米軍の輸送や人道支援の便も飛ぶ。2026年3月に Airbus A350F を20機発注した。本社はニューヨーク州ホワイトプレーンズ、運航の拠点（Global Operations Center）はケンタッキー州アーランガー。',
    overviewEn: 'Atlas Air is a US airline flying freighters and passenger charters (parent: Atlas Air Worldwide). According to the company’s site, it operates the world’s largest fleet of 747 freighters, alongside 777s and 767s. '
      + 'Its work is mainly ACMI, CMI and charter, including military charters and humanitarian missions. In March 2026 it ordered 20 Airbus A350Fs. Headquarters are in White Plains, New York, and the Global Operations Center is in Erlanger, Kentucky.',

    factsJa: [
      ['本社', 'ホワイトプレーンズ（ニューヨーク州）'],
      ['運航の拠点', 'Global Operations Center（ケンタッキー州アーランガー）'],
      ['操縦士の基地', 'ANC・JFK・ORD・LAX・MIA・SEA'],
      ['機材', 'B747 / B777 / B767（A350F を20機発注）'],
      ['労働組合', 'Teamsters Local 2750（2021年の協約）'],
      ['所得税', '米国（課税）'],
    ],
    factsEn: [
      ['Headquarters', 'White Plains, New York'],
      ['Operations', 'Global Operations Center, Erlanger, Kentucky'],
      ['Pilot bases', 'ANC, JFK, ORD, LAX, MIA, SEA'],
      ['Fleet', 'B747 / B777 / B767 (20 A350F on order)'],
      ['Union', 'Teamsters Local 2750 (2021 contract)'],
      ['Income tax', 'United States (taxed)'],
    ],

    routesJa: '決まった路線網ではなく、顧客との契約（ACMI・CMI）とチャーターで世界中を飛ぶ。副操縦士の募集要項では、70を超える国で運航していると紹介している。',
    routesEn: 'No fixed route network: it flies worldwide under customer contracts (ACMI and CMI) and charters. The first officer posting describes operations in more than 70 countries.',
    fleetJa: 'B747・B777・B767（会社のサイトでは、B747 の貨物機の数は世界一）。2026年3月に Airbus A350F を20機発注した。',
    fleetEn: 'B747, B777 and B767 (the company’s site says it has the world’s largest 747 freighter fleet). It ordered 20 Airbus A350Fs in March 2026.',

    trainingJa: [
      ['選考で見るもの', '飛行時間は、機材の複雑さ・運航の種類・直近の飛行・記録の確かさもあわせて見る（副操縦士の募集要項）。'],
    ],
    trainingEn: [
      ['What selection looks at', 'Flight hours are weighed with the complexity of the aircraft, the type of operation, recency, and how verifiable the logs are (first officer posting).'],
    ],

    benefitsJa: [
      ['✈️', '通勤', '米国内で基地から130マイルより遠くに住む人に、通勤の確定席の航空券。米国外に住む人には片道 $1,250 までの gateway travel。'],
      ['💵', '最低保証', '入社の日から月64時間。休みの日に飛ぶと割増。'],
      ['🏨', 'ホテル', '基地での滞在・乗務の前後・予備勤務中のホテルは会社負担。'],
      ['💼', '年金・利益配分', '会社の確定拠出（参考表では2026年 16%）と利益配分の制度。'],
      ['📅', '年休', '勤続6年未満 14日・6〜11年 21日・12年以上 28日（協約）。'],
      ['🧳', '家族の旅行', '入社6か月後から、近い家族が MyID Travel で他社便を使える。'],
    ],
    benefitsEn: [
      ['✈️', 'Commuting', 'Positive-space tickets for pilots living more than 130 miles from base within the US; gateway travel of up to $1,250 each way for crew living outside the US.'],
      ['💵', 'Minimum pay', 'A 64-hour monthly guarantee from the date of hire, and premium pay for flying on days off.'],
      ['🏨', 'Hotels', 'Company-paid hotels in base, before and after trips, and on reserve.'],
      ['💼', 'Retirement and profit sharing', 'A company direct contribution (16% in 2026 per a reference table) and a profit sharing plan.'],
      ['📅', 'Vacation', '14 days under 6 years of service, 21 days for 6 to 11 years, 28 days from 12 years (contract).'],
      ['🧳', 'Family travel', 'Travel benefits via MyID Travel for immediate family after 6 months of employment.'],
    ],

    hiringStatusJa: '副操縦士は「いまは採用していない・再開の時期は未定」で、登録窓口だけが開いている（2026年5月28日更新・2026年11月2日に確認）。',
    hiringStatusEn: 'First officers: “not currently hiring” with no restart date; only the talent community is open (updated 28 May 2026, checked 2 November 2026).',
    hiring: { color: null, tagClass: 'tag-gray', tagJa: '登録受付のみ', tagEn: 'Talent community only' },
    job: {
      titleJa: '副操縦士（登録窓口）',
      subJa: '採用を再開する時期は未定。登録しておくと再開のときに連絡が来る。',
      titleEn: 'First officer (talent community)',
      subEn: 'Not hiring now, with no restart date. Register to be contacted when hiring resumes.',
    },
    hiringRowsJa: [
      ['免許など', '米国 FAA の ATP（多発・英語能力の記載）・第1種身体検査・FCC の無線の許可'],
      ['飛行時間', '総1,500時間。うち固定翼1,000時間、または121部・135部の運航会社で500時間（回転翼の軍の課程を出た人は固定翼の機長250時間）'],
      ['年齢', '23歳以上・65歳まで'],
      ['就労資格・旅券', '米国で働ける資格（市民権・永住権・EAD など）と、有効期間24か月以上のパスポート'],
      ['望ましい', '総2,500時間・タービン500時間・直近12か月で200時間を超える飛行'],
    ],
    hiringRowsEn: [
      ['Licenses', 'FAA ATP (multi-engine, English proficiency endorsement), FAA Class 1 medical, FCC restricted radiotelephone operator permit'],
      ['Flight hours', '1,500 hours total, with 1,000 hours fixed-wing or 500 hours with a Part 121 or 135 operator (rotary-wing military graduates: 250 hours fixed-wing PIC)'],
      ['Age', '23 to 65'],
      ['Work authorization and passport', 'Legally authorized to work in the US (citizen, green card, EAD or other), passport valid for at least 24 months'],
      ['Preferred', '2,500 hours total, 500 hours turbine, more than 200 hours in the last 12 months'],
    ],
    hiringNoteJa: '※ 条件は副操縦士の募集要項（2026年5月28日更新）の記載（2026年11月2日に確認）。応募の前に、採用ページで最新の条件を確かめる。',
    hiringNoteEn: 'Requirements as listed in the first officer posting (updated 28 May 2026, checked 2 November 2026). Check the current terms on the careers site before applying.',

    faqEn: (h) => [
      [`What is ${h.A.en} captain salary in 2026?`,
       `We estimate ${h.A.en} captain pay at about ${h.mm(h.A.cap.avg)} a year: the year-12 B747 captain rate of $332.68 an hour (1 September 2025 column of the 2021 contract) times 768 hours a year (the 64-hour monthly minimum × 12), plus the 16% company defined contribution. Profit sharing and per diem are not included.`],
      [`What is ${h.A.en} first officer salary?`,
       `We estimate ${h.A.en} first officer pay at about ${h.mm(h.A.fo.avg)} a year: the year-6 B747 rate of $195.07 an hour times the same 768 hours, plus 16%.`],
      [`Is ${h.A.en} hiring pilots?`,
       `The first officer posting (updated 28 May 2026) says Atlas is not currently hiring and has no timeline for resuming; pilots can join the talent community to be contacted. The posting asks for an FAA ATP, a Class 1 medical and 1,500 hours total time, and offers positive-space commuting and a 64-hour monthly guarantee from the date of hire.`],
    ],
    compareNoteEn: compareFootEn(),
  },

  'abx-air': {
    code: 'GB',
    donor: 'spirit',
    donorColor: '#FFD700',
    donorTokens: [
      'spirit', 'Spirit', 'スピリット', 'FFD700', 'ffd700', '786508', 'ULCC',
      'フォートローダーデール', 'Fort Lauderdale', 'Miramar', 'フロリダ', 'Florida',
    ],
    /* 会社のサイト（abxair.com）のロゴ（ABXAir-Header-Logo.png）の赤。画像の色表から読んだ値で、導出していない。
       サイトの CSS の赤 #CB0024 は ATSG のグループ共通の stylesheets/shared/ に在るので、ABX のものとは言い切れない。 */
    color: '#D13239',
    flag: '🇺🇸',
    countryJa: '米国', countryEn: 'United States',
    tags: { ja: ['B767 貨物', 'ACMI・CMI'], en: ['767 freighters', 'ACMI and CMI'] },
    subtitleJa: 'ABX Air — B767 の貨物機で ACMI・CMI を飛ばす米国の貨物航空会社。本社はオハイオ州ウィルミントン。',
    subtitleEn: 'ABX Air — a US cargo airline flying Boeing 767 freighters on ACMI and CMI contracts, headquartered in Wilmington, Ohio.',
    statsJa: [['機材', 'B767-300F / B767-200F'], ['基地', 'シンシナティ（CVG）']],
    statsEn: [['Fleet', 'B767-300F / B767-200F'], ['Base', 'Cincinnati (CVG)']],
    /* 2026-11-02 に2本とも開いて、ABX Air の会社のサイトであることを確かめた（題「ABX Air Pilots | ABX Air Services」「ACC Pathway Program | ABX Air Services」）。 */
    careers: [
      { url: 'https://www.abxair.com/careers/abx-air-pilots', ja: 'ABX Air 操縦士の採用ページ（外部サイト）', en: 'ABX Air pilot careers (external)' },
      { url: 'https://www.abxair.com/careers/acc-pathway-program', ja: 'Air Cargo Carriers からの採用の道（外部サイト）', en: 'ACC pathway program (external)' },
    ],

    rowSubJa: { cap: 'B767（協約の「B767/A330」の時給区分）', fo: 'B767（協約の「B767/A330」の時給区分）' },
    rowSubEn: { cap: 'B767 (the contract’s “B767/A330” pay class)', fo: 'B767 (the contract’s “B767/A330” pay class)' },
    payTag: { ja: 'USD建て・税引前', en: 'Paid in USD, pre-tax' },
    stepTag: { ja: '年次制（労働協約）', en: 'Seniority scale (union contract)' },
    tableNote: {
      ja: '※ 推定年収は、労働協約の時給（2026年1月1日の表。機長12年目・副操縦士6年目）に年777.92時間（2週ごとの最低保証29.92時間 × 26）を掛け、会社の確定拠出年金 14% を足した額です。日当と割増は入れていません。幅の下の端は1年目（機長は2年目。表の機長1年目 $164.58 は2年目 $210.30 より大きく低いため）、上の端は12年目で同じ計算をした額です。',
      en: 'The estimate is the contract hourly rate (1 January 2026 table; year-12 captain, year-6 first officer) times 777.92 hours a year (the 29.92-hour minimum per two-week pay period × 26), plus the 14% company defined contribution. Per diem and premiums are not included. The low end is year 1 (year 2 for captains, because the table’s year-1 captain rate of $164.58 is far below year 2’s $210.30) and the high end is year 12, worked out the same way.',
    },
    ldTail: {
      ja: 'パイロットの労働協約の時給表から計算した推定年収と、応募条件。',
      en: 'Estimated from the pilot contract’s pay table, plus the entry requirements.',
    },

    basisJa: '※ 出典：ABX Air のパイロットの労働組合（APA Teamsters Local 1224）の採用資料にある2026〜2030年の時給表（2026年1月1日の表）と、2週ごとの最低保証・会社の確定拠出年金（2026年 14%・2027〜30年 15%）。'
      + '機長は12年目 時給 $314.14 × 年777.92時間（29.92時間 × 26）＝ $244,375.79、14% を足して $278,588.40。'
      + '副操縦士は6年目 時給 $183.08 × 777.92時間 ＝ $142,421.59、14% を足して $162,360.62。'
      + '日当（1日 $71〜$93）と割増は入れていない。2027年から毎年1月に3%ずつ上がる表が決まっている。円は1ドル＝158.95円で換算。',
    basisEn: 'Source: the 2026–2030 pay tables in the ABX pilots’ union (APA Teamsters Local 1224) hiring material (1 January 2026 table), with the two-week minimum and the company defined contribution (14% in 2026, 15% in 2027–30). '
      + 'Captains: year-12 rate of $314.14 an hour × 777.92 hours a year (29.92 × 26) = $244,375.79; with 14%, $278,588.40. '
      + 'First officers: year-6 rate of $183.08 × 777.92 hours = $142,421.59; with 14%, $162,360.62. '
      + 'Per diem ($71 to $93 a day) and premiums are not included. The tables rise 3% every January from 2027. Converted at 158.95 yen to the dollar.',

    overviewJa: 'ABX Air は、オハイオ州ウィルミントンに本社を置く米国の貨物航空会社。会社のサイトによると、1980年4月に Airborne Express の名前で始まり、2003年8月に今の名前になった。2007年から ATSG が親会社。'
      + 'B767 の貨物機で、電子商取引・速達の会社や米国政府向けに ACMI と CMI を飛ばしている。操縦士の基地はシンシナティ（CVG）。',
    overviewEn: 'ABX Air is a US cargo airline headquartered in Wilmington, Ohio. According to its site, it was founded in April 1980 under the Airborne Express name and took its current name in August 2003; ATSG has been its parent since 2007. '
      + 'It flies Boeing 767 freighters on ACMI and CMI contracts for e-commerce and express customers and the US government. Pilots are based in Cincinnati (CVG).',

    factsJa: [
      ['本社', 'ウィルミントン（オハイオ州）'],
      ['設立', '1980年4月（Airborne Express として）'],
      ['親会社', 'ATSG（2007年から）'],
      ['機材', 'B767-300F 26機・B767-200F 7機'],
      ['操縦士の基地', 'シンシナティ（CVG）'],
      ['所得税', '米国（課税）'],
    ],
    factsEn: [
      ['Headquarters', 'Wilmington, Ohio'],
      ['Founded', 'April 1980 (as Airborne Express)'],
      ['Parent', 'ATSG (since 2007)'],
      ['Fleet', '26 B767-300F, 7 B767-200F'],
      ['Pilot base', 'Cincinnati (CVG)'],
      ['Income tax', 'United States (taxed)'],
    ],

    routesJa: '決まった路線網ではなく、顧客との契約（ACMI・CMI）で飛ぶ。会社の沿革には、2015年に Amazon と ACMI の契約を始め、DHL との運航契約を2028年4月まで延ばしたとある。',
    routesEn: 'No fixed route network: it flies under customer contracts (ACMI and CMI). The company history notes ACMI agreements with Amazon from 2015 and DHL operating agreements extended to April 2028.',
    fleetJa: 'B767-300F 26機・B767-200F 7機（会社のサイト）。時給表の区分の名前に A330 が入っているが、A330 を運航しているかは確かめていない。',
    fleetEn: '26 B767-300F and 7 B767-200F (company site). The pay class is named “B767/A330”, but we have not confirmed any A330 flying.',

    trainingJa: [
      ['訓練', 'オハイオ州ウィルミントンの Airborne Training Services で約8週間：地上学科3週間 → 固定のシミュレーター → B767 のフルモーション・シミュレーター（レベルC）→ 審査のあと約3週間の路線訓練。終えると B767 の型式と ETOPS の資格を持つ副操縦士になる。'],
      ['訓練中の待遇', '65時間の保証・日当・個室のホテル（約60日。組合の採用資料）。'],
    ],
    trainingEn: [
      ['Training', 'About eight weeks at Airborne Training Services in Wilmington, Ohio: three weeks of ground school, fixed-base simulator, then full-motion training in a Level C B767 simulator, a proficiency check and about three weeks of initial operating experience. Pilots finish as type-rated B767 first officers with ETOPS.'],
      ['Pay in training', 'A 65-hour guarantee, per diem and a single hotel room (about 60 days; union hiring material).'],
    ],

    benefitsJa: [
      ['💼', '年金', '会社の確定拠出 2026年 14%・2027〜30年 15%（本人の拠出は要らない）。'],
      ['🍽️', '日当', '1日 国内 $71・国際 $93（2026年1月1日）。'],
      ['📅', '年休', '1年未満は月1日・1〜4年 14日・5〜14年 21日・15年以上 28日。'],
      ['🩺', '医療保険', 'United Healthcare（保険料の75%を会社負担）・歯科・眼科・就業不能保険・生命保険。'],
      ['🗓️', '公休', '月の最低公休は、通常のラインで14日・予備勤務で13日。'],
      ['✈️', '通勤', 'CASS と Known Crewmember に参加。国内の通勤は、出頭前に着く予定の便を1便試みれば守られる（組合の採用資料）。'],
    ],
    benefitsEn: [
      ['💼', 'Retirement', 'Company defined contribution of 14% in 2026 and 15% in 2027–30, with no pilot match required.'],
      ['🍽️', 'Per diem', '$71 a day domestic and $93 international (1 January 2026).'],
      ['📅', 'Vacation', '1 day a month in the first year, 14 days for 1–4 years, 21 days for 5–14 years, 28 days from 15 years.'],
      ['🩺', 'Health', 'United Healthcare with 75% of the premium paid by the company, plus dental, vision, disability and life insurance.'],
      ['🗓️', 'Days off', 'At least 14 days off a month on a regular line and 13 on reserve.'],
      ['✈️', 'Commuting', 'CASS and Known Crewmember. Domestic commuters are protected if they try one listed flight due to arrive before report time (union hiring material).'],
    ],

    hiringStatusJa: '会社の採用ページに操縦士の募集要項が載っている（2026年11月2日に確認）。',
    hiringStatusEn: 'The company careers page lists pilot requirements (checked 2 November 2026).',
    hiring: { color: null, tagClass: 'tag-gray', tagJa: '採用ページあり', tagEn: 'Careers page' },
    job: {
      titleJa: '副操縦士（B767）',
      subJa: '訓練を終えると B767 の型式と ETOPS の資格を持つ副操縦士になる。',
      titleEn: 'First officer (B767)',
      subEn: 'Training ends with a B767 type rating and ETOPS qualification.',
    },
    hiringRowsJa: [
      ['免許など', '米国 FAA の ATP（多発・英語能力の記載）・第1種身体検査'],
      ['飛行時間', '固定翼で総1,500時間'],
      ['パスポート', '有効期間が2年以上残り、海外渡航の制限がないもの'],
      ['学歴', '大学の学位が望ましい'],
      ['別の道', 'Air Cargo Carriers で機長を2年務めると、ABX の面接なしで B767 の副操縦士になれる（ABX が採用中で、推薦があるとき。各クラスの最大25%）'],
    ],
    hiringRowsEn: [
      ['Licenses', 'FAA ATP (multi-engine, English proficiency endorsement), first-class medical'],
      ['Flight hours', '1,500 hours total fixed-wing'],
      ['Passport', 'At least two years’ validity and no restrictions on international travel'],
      ['Education', 'College degree preferred'],
      ['Pathway', 'Two years as a captain at Air Cargo Carriers leads to a B767 first officer job without the ABX interview (when ABX is hiring and with a recommendation; up to 25% of each class)'],
    ],
    hiringNoteJa: '※ 条件は採用ページの記載（2026年11月2日に確認）。応募の前に、採用ページで最新の条件を確かめる。',
    hiringNoteEn: 'Requirements as listed on the careers page (checked 2 November 2026). Check the current terms there before applying.',

    faqEn: (h) => [
      [`What is ${h.A.en} captain salary in 2026?`,
       `We estimate ${h.A.en} captain pay at about ${h.mm(h.A.cap.avg)} a year: the year-12 captain rate of $314.14 an hour (1 January 2026 table) times 777.92 hours a year (the 29.92-hour minimum per two-week pay period × 26), plus the 14% company defined contribution. Per diem and premiums are not included.`],
      [`What is ${h.A.en} first officer salary?`,
       `We estimate ${h.A.en} first officer pay at about ${h.mm(h.A.fo.avg)} a year: the year-6 rate of $183.08 an hour times the same 777.92 hours, plus 14%.`],
      [`What are the requirements to fly for ${h.A.en}?`,
       `The careers page asks for an unrestricted FAA ATP with a multi-engine rating and English proficiency endorsement, 1,500 hours total fixed-wing time, a first-class medical and a passport with two years’ validity; a college degree is preferred. New first officers train for about eight weeks in Wilmington, Ohio, and finish type-rated on the B767 with ETOPS.`],
    ],
    compareNoteEn: compareFootEn(),
  },

  'kalitta-air': {
    code: 'K4',
    donor: 'spirit',
    donorColor: '#FFD700',
    donorTokens: [
      'spirit', 'Spirit', 'スピリット', 'FFD700', 'ffd700', '786508', 'ULCC',
      'フォートローダーデール', 'Fort Lauderdale', 'Miramar', 'フロリダ', 'Florida',
    ],
    /* 会社のサイト（kalittaair.com）の CSS（kalittaair.shared.*.min.css）の --accent--primary-1。導出していない。 */
    color: '#B53835',
    flag: '🇺🇸',
    countryJa: '米国', countryEn: 'United States',
    tags: { ja: ['B747・B777 貨物', '通勤の航空券は会社負担'], en: ['747 and 777 freighters', 'Company-paid commuting'] },
    subtitleJa: 'Kalitta Air — B747・B777 の貨物機を飛ばす米国の航空会社。本社はミシガン州イプシランティ。',
    subtitleEn: 'Kalitta Air — a US airline flying 747 and 777 freighters, headquartered in Ypsilanti, Michigan.',
    statsJa: [['機材', 'B747-400F / B777F'], ['本社', 'ウィローラン空港（ミシガン州）']],
    statsEn: [['Fleet', 'B747-400F / B777F'], ['Headquarters', 'Willow Run Airport, Michigan']],
    /* 2026-11-02 に2本とも開いて、Kalitta Air の会社のサイトであることを確かめた（題「Kalitta Air - Pilots」「Kalitta Air - Careers」。2本目に副操縦士の応募の窓口）。
       応募先の ADP（workforcenow.adp.com）は JS で描く画面で中身を確かめられないので貼らない。 */
    careers: [
      { url: 'https://www.kalittaair.com/teams/pilots', ja: 'カリッタ航空 操縦士の採用ページ（外部サイト）', en: 'Kalitta Air pilot careers (external)' },
      { url: 'https://www.kalittaair.com/careers', ja: '採用ページ・副操縦士の応募（外部サイト）', en: 'Careers and first officer applications (external)' },
    ],

    rowSubJa: { cap: 'B747 / B777（整数の参考表）', fo: 'B747 / B777（整数の参考表）' },
    rowSubEn: { cap: 'B747 / B777 (whole-dollar reference table)', fo: 'B747 / B777 (whole-dollar reference table)' },
    payTag: { ja: 'USD建て・税引前', en: 'Paid in USD, pre-tax' },
    stepTag: { ja: '参考表（整数）', en: 'Reference table (whole dollars)' },
    tableNote: {
      ja: '※ 推定年収は、整数で書かれた時給の参考表（適用年は確かめられていない。機長12年目・副操縦士6年目）に年768時間（月の最低保証64時間 × 12）を掛け、会社の確定拠出年金 12% を足した額です。副操縦士1年目の時給 $117 だけは採用ページの額と一致します。日当と割増は入れていません。幅の下の端は1年目（機長は2年目。表の機長1年目 $165 は2年目 $211 より大きく低いため）、上の端は12年目で同じ計算をした額です。',
      en: 'The estimate uses a whole-dollar reference pay table (year not confirmed; year-12 captain, year-6 first officer) times 768 hours a year (the 64-hour monthly minimum × 12), plus the 12% company defined contribution. Only the first-year first officer rate of $117 matches the careers page. Per diem and premiums are not included. The low end is year 1 (year 2 for captains, because the table’s year-1 captain rate of $165 is far below year 2’s $211) and the high end is year 12, worked out the same way.',
    },
    ldTail: {
      ja: '時給の参考表と採用ページから計算した推定年収と、応募条件。',
      en: 'Estimated from a reference pay table and the careers page, plus the entry requirements.',
    },

    basisJa: '※ 出典：Kalitta Air の採用ページ（1年目 時給 $117・月64時間の保証・確定拠出年金 12%。2026年11月2日に確認）と、整数で書かれた時給の参考表（適用年は確かめられていない）。'
      + '機長は12年目 時給 $316 × 年768時間（64時間 × 12）＝ $242,688、12% を足して $271,810.56。'
      + '副操縦士は6年目 時給 $184 × 768時間 ＝ $141,312、12% を足して $158,269.44。'
      + '日当と、休みの日の乗務の割増（150%）は入れていない。円は1ドル＝158.95円で換算。',
    basisEn: 'Sources: Kalitta Air’s careers page ($117 an hour in the first year, a 64-hour monthly guarantee and a 12% 401(k) direct contribution; checked 2 November 2026) and a whole-dollar reference pay table (year not confirmed). '
      + 'Captains: year-12 rate of $316 an hour × 768 hours a year (64 × 12) = $242,688; with 12%, $271,810.56. '
      + 'First officers: year-6 rate of $184 × 768 hours = $141,312; with 12%, $158,269.44. '
      + 'Per diem and the 150% premium for flying on days off are not included. Converted at 158.95 yen to the dollar.',

    overviewJa: 'Kalitta Air は、ミシガン州イプシランティのウィローラン空港に本社を置く米国の貨物航空会社。会社のサイトによると、コンラッド・カリッタが全部を持つミシガン州の有限責任会社で、2000年11月に B747 の3機で運航を始めた。'
      + 'B747-400F・B777-200F・B777-300ERSF で、定期便とチャーターの貨物を世界中へ飛ばす。操縦士は米国内のどこに住んでもよく、乗務の地までの航空券を会社が買う。',
    overviewEn: 'Kalitta Air is a US cargo airline headquartered at Willow Run Airport in Ypsilanti, Michigan. According to its site, it is a Michigan limited liability company owned solely by Conrad Kalitta, and it began service in November 2000 with three Boeing 747s. '
      + 'It flies scheduled and on-demand cargo worldwide with the 747-400F, 777-200F and 777-300ERSF. Pilots may live almost anywhere in the US, and the company buys their tickets to and from duty.',

    factsJa: [
      ['本社', 'ウィローラン空港（ミシガン州イプシランティ）'],
      ['運航開始', '2000年11月'],
      ['所有', 'コンラッド・カリッタ（100%）'],
      ['機材', 'B747-400F / B777-200F / B777-300ERSF'],
      ['訓練', '本社の訓練センター（B777 と B747-400 のフルモーション・シミュレーターが2台ずつ）'],
      ['所得税', '米国（課税）'],
    ],
    factsEn: [
      ['Headquarters', 'Willow Run Airport, Ypsilanti, Michigan'],
      ['Began service', 'November 2000'],
      ['Owner', 'Conrad Kalitta (100%)'],
      ['Fleet', 'B747-400F / B777-200F / B777-300ERSF'],
      ['Training', 'Company training center with two 777 and two 747-400 full-motion simulators'],
      ['Income tax', 'United States (taxed)'],
    ],

    routesJa: '定期便とチャーターで世界中へ。採用ページはシドニー・ホノルル・香港・ロサンゼルス・アンカレッジを例に挙げている。',
    routesEn: 'Scheduled and charter flying worldwide. The careers page gives Sydney, Honolulu, Hong Kong, Los Angeles and Anchorage as examples.',
    fleetJa: 'B747-400F・B777-200F・B777-300ERSF の3種類（会社のサイト）。B777-300ERSF はカリッタ航空が最初の顧客。',
    fleetEn: 'Three types: 747-400F, 777-200F and 777-300ERSF (company site). Kalitta Air is the launch customer for the 777-300ERSF.',

    trainingJa: [
      ['訓練の場所', '入社の日から型式のシミュレーター審査まで、訓練はすべてイプシランティの本社で行う。'],
      ['訓練中の給与', '訓練の初日から乗務と同じ給与（1年目 時給 $117・月64時間の保証）。'],
    ],
    trainingEn: [
      ['Where', 'All training, from the first day of orientation to the type-rating simulator check, is at company headquarters in Ypsilanti.'],
      ['Pay in training', 'Full flight pay from the first day of training ($117 an hour in the first year, with a 64-hour monthly guarantee).'],
    ],

    benefitsJa: [
      ['✈️', '通勤', '米国内のほぼどこに住んでもよい（アラスカ・ハワイも）。乗務の地までの往復は、会社が確定席の航空券を買う。'],
      ['📅', '勤務の形', '16日勤務・15日休み（30日の月は14日休み）。8日勤務・15日休み・8日勤務のような分け方も、あれば選べる。'],
      ['💵', '休みの日の乗務', '時給の150%。junior manning（休みの日の乗務の割り当て）は無い。'],
      ['💼', '年金', '会社の確定拠出 12%（401(k)）。'],
      ['🩺', '医療保険', 'Blue Cross Blue Shield の医療・歯科・眼科。'],
    ],
    benefitsEn: [
      ['✈️', 'Commuting', 'Live virtually anywhere in the US, including Alaska and Hawaii; the company buys positive-space tickets to and from duty.'],
      ['📅', 'Schedule', '16 days on, 15 off (14 off in a 30-day month). Split schedules such as 8 on, 15 off, 8 on can be bid when available.'],
      ['💵', 'Flying on days off', 'Paid at 150% of the hourly rate. No junior manning.'],
      ['💼', 'Retirement', '12% 401(k) direct contribution.'],
      ['🩺', 'Health', 'Blue Cross Blue Shield health, dental and vision.'],
    ],

    hiringStatusJa: '採用ページに副操縦士の応募の窓口が載っている（2026年11月2日に確認）。',
    hiringStatusEn: 'The careers page has a first officer application link (checked 2 November 2026).',
    hiring: { color: null, tagClass: 'tag-gray', tagJa: '採用ページあり', tagEn: 'Careers page' },
    job: {
      titleJa: '副操縦士',
      subJa: '米国内のどこに住んでもよい。訓練はイプシランティの本社。',
      titleEn: 'First officer',
      subEn: 'Live anywhere in the US. Training at headquarters in Ypsilanti.',
    },
    hiringRowsJa: [
      ['免許など', '米国 FAA の ATP（多発・制限なし）・第1種身体検査・FCC の無線の免許'],
      ['飛行時間', '総1,500時間以上（2,000時間以上が望ましい）。タービン1,000時間・タービンの機長500時間が望ましい（軍の出身者は柔軟に見る）'],
      ['パスポート', '有効な米国のパスポート・海外渡航の制限がないこと'],
      ['審査', '10年分の身元調査・入社前の薬物とアルコールの検査'],
    ],
    hiringRowsEn: [
      ['Licenses', 'Unrestricted FAA multi-engine ATP, FAA Class 1 medical, FCC radio license'],
      ['Flight hours', '1,500+ hours total (2,000+ preferred); 1,000 hours turbine and 500 hours turbine PIC preferred (flexible for military)'],
      ['Passport', 'Current US passport, no restrictions on international travel'],
      ['Checks', '10-year security background check and pre-employment drug and alcohol test'],
    ],
    hiringNoteJa: '※ 条件は採用ページの記載（2026年11月2日に確認）。応募の前に、採用ページで最新の条件を確かめる。',
    hiringNoteEn: 'Requirements as listed on the careers page (checked 2 November 2026). Check the current terms there before applying.',

    faqEn: (h) => [
      [`What is ${h.A.en} captain salary in 2026?`,
       `We estimate ${h.A.en} captain pay at about ${h.mm(h.A.cap.avg)} a year: a year-12 captain rate of $316 an hour from a whole-dollar reference table (year not confirmed) times 768 hours a year (the 64-hour monthly minimum × 12), plus the 12% 401(k) direct contribution. Per diem and the 150% day-off premium are not included.`],
      [`What is ${h.A.en} first officer salary?`,
       `We estimate ${h.A.en} first officer pay at about ${h.mm(h.A.fo.avg)} a year: a year-6 rate of $184 an hour from the same reference table times 768 hours, plus 12%. The careers page lists first-year pay of $117 an hour with a 64-hour monthly guarantee, paid in full from day one of training.`],
      [`What are the requirements to fly for ${h.A.en}?`,
       `The careers page asks for an unrestricted FAA multi-engine ATP, 1,500+ hours total time (2,000+ preferred), a Class 1 medical, an FCC radio license and a current US passport. Pilots can live anywhere in the US: the company buys positive-space tickets to and from duty.`],
    ],
    compareNoteEn: compareFootEn(),
  },
  /* NA20 ── ★2026-11-03 北米追加20社の5社。本文は助手が会社のサイトで確かめた下書き（scratchpad の content/*.json）・英語の FAQ は推定年収の計算の書き方と同じ。
     作り直し：scratchpad の make-content.mjs（リポジトリの外）。 */
  'avelo-airlines': {
    code: 'XP',
    donor: 'spirit',
    donorColor: '#FFD700',
    /* 借り元（スピリット航空）の字が残っていないかを見る語。その会社の本文に本当に出る地名（Contour の FLL 基地など）は外す */
    donorTokens: [
      'spirit', 'Spirit', 'スピリット', 'FFD700', 'ffd700', '786508', 'ULCC', 'フォートローダーデール', 'Fort Lauderdale', 'Miramar', 'フロリダ', 'Florida',
    ],
    /* aveloair.com のテーマの CSS（wp-content/themes/avelo-web-20/style.css）で、いちばん多く使われている紫 #4c12a1（12回。メニューの選択中の下線・ボタンの地・FAQ の見出しなど）。導出していない。 */
    color: '#4C12A1',
    flag: '🇺🇸',
    countryJa: '米国', countryEn: 'United States',
    tags: { ja: ['B737 の低運賃航空', '12年分の時給表を公開'], en: ['737 low-fare airline', 'Publishes a 12-year pay scale'] },
    subtitleJa: 'Avelo Airlines — B737 で米国の東海岸と中西部を飛ぶ低運賃航空会社。本社はテキサス州ヒューストン。',
    subtitleEn: 'Avelo Airlines — a US low-fare airline flying Boeing 737s on East Coast and Midwest routes, headquartered in Houston, Texas.',
    statsJa: [["機材","B737-800 / B737-700"],["基地","ニューヘイブン（HVN）ほか3か所"]],
    statsEn: [["Fleet","737-800 / 737-700"],["Base","New Haven (HVN) and 3 more"]],
    careers: [
      { url: 'https://www.aveloair.com/pilots', ja: 'アベロ航空 操縦士の採用ページ（外部サイト）', en: 'Avelo Airlines pilot careers (external)' },
    ],

    rowSubJa: { cap: 'B737（会社の給与表）', fo: 'B737（会社の給与表）' },
    rowSubEn: { cap: 'B737 (company pay scale)', fo: 'B737 (company pay scale)' },
    payTag: { ja: 'USD建て・税引前', en: 'Paid in USD, pre-tax' },
    stepTag: { ja: '年次制（会社の給与表）', en: 'Seniority scale (company pay scale)' },
    tableNote: {
      ja: '※ 推定年収は、会社の採用ページの給与表の時給（機長12年目・副操縦士6年目）に年840時間（月70時間の保証 × 12）を掛けた額です。401(k) のマッチ・利益配分・日当は入っていません。円は1ドル＝158.95円で換算。',
      en: 'The estimate is the hourly rate on the company’s pay scale (year-12 captain, year-6 first officer) times 840 hours a year (the 70-hour monthly guarantee × 12). The 401(k) match, profit sharing and per diem are not included. Converted at 158.95 yen to the dollar.',
    },
    ldTail: {
      ja: 'パイロットの給与表から計算した推定年収と、応募条件。',
      en: 'Estimated from the pilot pay scale, plus the entry requirements.',
    },

    basisJa: '※ 出典と計算：会社の採用ページの給与表の時給（機長12年目・副操縦士6年目）に年840時間（月70時間の保証 × 12）を掛けた額です。401(k) のマッチ・利益配分・日当は入っていません。円は1ドル＝158.95円で換算。',
    basisEn: 'Source and method: the hourly rate on the company’s pay scale (year-12 captain, year-6 first officer) times 840 hours a year (the 70-hour monthly guarantee × 12). The 401(k) match, profit sharing and per diem are not included. Converted at 158.95 yen to the dollar.',

    overviewJa: 'Avelo Airlines は、テキサス州ヒューストンに本社を置く米国の低運賃航空会社。会社の発表によると、2021年4月28日に運航を始めた（創業者で CEO は Andrew Levy）。B737-800 と B737-700 で東海岸と中西部の路線を飛ばし、操縦士の基地はニューヘイブン・ウィルミントン（デラウェア州）・レイクランド・コンコード（ノースカロライナ州）の4か所。',
    overviewEn: 'Avelo Airlines is a US low-fare airline headquartered in Houston, Texas. According to the company, it began flying on 28 April 2021; founder Andrew Levy is its CEO. It flies Boeing 737-800s and 737-700s on East Coast and Midwest routes, with pilot bases in New Haven, Wilmington (Delaware), Lakeland and Concord (North Carolina).',

    factsJa: [
      ['本社', 'ヒューストン（テキサス州）'],
      ['運航開始', '2021年4月28日'],
      ['機材', 'B737-800 / B737-700（計17機・2026年10月の発表）'],
      ['操縦士の基地', 'ニューヘイブン（HVN）・ウィルミントン（ILG・デラウェア州）・レイクランド（LAL）・コンコード（USA・ノースカロライナ州）'],
      ['所得税', '米国（課税）'],
    ],
    factsEn: [
      ['Headquarters', 'Houston, Texas'],
      ['Began service', '28 April 2021'],
      ['Fleet', '737-800 / 737-700 (17 aircraft, October 2026 release)'],
      ['Pilot bases', 'New Haven (HVN), Wilmington, Delaware (ILG), Lakeland (LAL), Concord, North Carolina (USA)'],
      ['Income tax', 'United States (taxed)'],
    ],

    routesJa: '東海岸と中西部を中心に、プエルトリコを含む39都市へ（2026年10月の発表）。会社によると、路線の多くは少なくとも片側が混まない小さめの空港。',
    routesEn: 'Mostly East Coast and Midwest flying to 39 destinations, including Puerto Rico (October 2026 release). The company says most of its routes use at least one small, convenient airport.',
    fleetJa: 'B737-800 と B737-700 で計17機（2026年10月の発表）。2025年9月に E195-E2 を100機まで発注し、2028年から飛ばす予定（2026年4月の発表）。',
    fleetEn: '17 Boeing Next-Generation 737s, -800s and -700s (October 2026 release). Avelo ordered up to 100 Embraer E195-E2s in September 2025 and plans to start flying them in 2028 (April 2026 release).',

    trainingJa: [
      ['訓練', 'ダラスの Avenger Flight Group の訓練センターで行う。訓練中のホテルと移動は会社が用意し、入社時の制服と会社の iPad も支給される。'],
      ['訓練中の給与', '新しく入った人は訓練中 月 $6,020。'],
    ],
    trainingEn: [
      ['Training', 'At the Avenger Flight Group Dallas Training Center. Hotels and travel during training are provided, along with the initial uniform and a company-issued iPad.'],
      ['Pay in training', '$6,020 a month for new hires in training.'],
    ],

    benefitsJa: [
      ['⏱️', '保証と超過', '月70時間の保証（リザーブも70時間）。月75時間を超えた分は時給の125%。'],
      ['🗓️', '公休', 'ライン・リザーブとも月12日以上。'],
      ['💼', '年金・利益配分', 'Fidelity の 401(k) に会社の上乗せ（率は採用ページに無い）。会社が利益の目標に届いた年は利益配分。'],
      ['🩺', '医療保険', 'Blue Cross Blue Shield（HDP・PPO）・歯科・眼科・FSA と HSA。'],
      ['🛡️', '就業不能・免許喪失', '長期と短期の就業不能保険・Harvey Watt の免許喪失の補償と FAA の身体検査の相談・会社負担の生命保険。'],
      ['✈️', '通勤・優待', 'CASS と KCM に参加。米国の全社とジャンプシートの協定。Air Canada・Delta・United など多くの会社で割引運賃。'],
    ],
    benefitsEn: [
      ['⏱️', 'Guarantee and overtime', '70-hour monthly guarantee (70 hours on reserve too). Hours over 75 a month are paid at 125%.'],
      ['🗓️', 'Days off', 'At least 12 days off a month for both line holders and reserves.'],
      ['💼', 'Retirement and profit sharing', 'Fidelity 401(k) with a company match (the rate is not listed on the careers page). Profit sharing when the company reaches its earnings goal.'],
      ['🩺', 'Health', 'Blue Cross Blue Shield medical (HDP and PPO), dental, vision, and FSA and HSA options.'],
      ['🛡️', 'Disability and loss of license', 'Long- and short-term disability, loss of license protection and FAA medical advocacy through Harvey Watt, plus company-provided life insurance.'],
      ['✈️', 'Commuting and travel', 'CASS and KCM, jumpseat agreements with all US carriers, and reduced-rate travel on Air Canada, Delta, United and many others.'],
    ],

    hiringStatusJa: '採用ページに「副操縦士と直接入社の機長を常に募集」とあり、応募の窓口（AirlineApps）に両方の募集が載っている（2026年11月3日に確認）。',
    hiringStatusEn: 'The careers page says Avelo is constantly hiring first officers and direct entry captains, and both openings are posted on its AirlineApps page (checked 3 November 2026).',
    hiring: { color: null, tagClass: 'tag-gray', tagJa: '採用ページあり', tagEn: 'Careers page' },
    job: {
      titleJa: '副操縦士（B737）',
      subJa: '直接入社の機長も募集している。訓練はダラス。',
      titleEn: 'First officer (737)',
      subEn: 'Direct entry captains are hired too. Training is in Dallas.',
    },
    hiringRowsJa: [
      ['免許など', '制限なしの ATP（多発）か軍の R-ATP（特に優れた人は軍以外の R-ATP も可）・ATP-CTP と ATP の筆記・第1種身体検査'],
      ['飛行時間', '14 CFR 121.436 の最低時間：航空の学士（Part 141）1,000時間・航空の準学士 1,250時間・それ以外は21歳以上で1,500時間'],
      ['国籍・旅券', '米国の市民で、有効期間が6か月以上残る米国のパスポート・米国の運転免許'],
      ['審査', 'DOT の入社前の薬物検査'],
      ['望ましい経験', '大型ジェットかボーイングの経験、または B737 の型式'],
    ],
    hiringRowsEn: [
      ['Licenses', 'Unrestricted ATP with airplane multi-engine rating, or military R-ATP (non-military R-ATP for highly exceptional candidates); ATP-CTP and ATP written; FAA first-class medical'],
      ['Flight hours', '14 CFR 121.436 minimums: 1,000 hours with an aviation bachelor’s degree (Part 141), 1,250 with an aviation associate degree, otherwise 1,500 hours and age 21'],
      ['Citizenship and passport', 'US citizen with a US passport valid for at least six more months; valid US driver’s license'],
      ['Checks', 'DOT pre-employment drug screening'],
      ['Preferred', 'Heavy jet or Boeing experience, or a 737 type rating'],
    ],
    hiringNoteJa: '※ 条件は採用ページの記載（2026年11月3日に確認）。応募の前に、採用ページで最新の条件を確かめる。',
    hiringNoteEn: 'Requirements as listed on the careers page (checked 3 November 2026). Check the current terms there before applying.',

    faqEn: (h) => [
      [`What is ${h.A.en} captain salary in 2026?`,
       `We estimate ${h.A.en} captain pay at about ${h.mm(h.A.cap.avg)} a year: the year-12 captain rate of $298 an hour on Avelo’s published B737 pay scale times 840 hours a year (the 70-hour monthly guarantee × 12).`],
      [`What is ${h.A.en} first officer salary?`,
       `We estimate ${h.A.en} first officer pay at about ${h.mm(h.A.fo.avg)} a year: the year-6 rate of $171 an hour on the same scale times 840 hours a year.`],
    ],
    compareNoteEn: compareFootEn(),
  },
  'gojet': {
    code: 'G7',
    donor: 'spirit',
    donorColor: '#FFD700',
    /* 借り元（スピリット航空）の字が残っていないかを見る語。その会社の本文に本当に出る地名（Contour の FLL 基地など）は外す */
    donorTokens: [
      'spirit', 'Spirit', 'スピリット', 'FFD700', 'ffd700', '786508', 'ULCC', 'フォートローダーデール', 'Fort Lauderdale', 'Miramar', 'フロリダ', 'Florida',
    ],
    /* gojetairlines.com のロゴの画像（wp-content/uploads/2025/04/Logo@2x-e1744336172602.png・alt「GoJet Logo blue Color」）の色表を読んだ値。不透明な画素の 76.6% が #0078C2（17.6% が #0079C2、残りは黒の文字）。導出していない。サイトの CSS（Elementor の全体の色 uploads/elementor/css/post-7.css）の primary は #1572FE で、ロゴとは別の値。 */
    color: '#0078C2',
    flag: '🇺🇸',
    countryJa: '米国', countryEn: 'United States',
    tags: { ja: ['ユナイテッド・エクスプレス', 'CRJ550'], en: ['United Express', 'CRJ550'] },
    subtitleJa: 'GoJet Airlines — ユナイテッド・エクスプレスとして CRJ550 を飛ばす米国の地域航空会社。本社はミズーリ州セントルイス。',
    subtitleEn: 'GoJet Airlines — a US regional airline flying the CRJ550 as United Express, headquartered in St. Louis, Missouri.',
    statsJa: [["機材","CRJ550"],["基地","5か所（EWR・IAD・IAH・ORD・STL）"]],
    statsEn: [["Fleet","CRJ550"],["Bases","5 (EWR, IAD, IAH, ORD, STL)"]],
    careers: [
      { url: 'https://gojetairlines.com/pilot-careers/', ja: 'ゴージェット航空 操縦士の採用ページ（外部サイト）', en: 'GoJet Airlines pilot careers (external)' },
    ],

    rowSubJa: { cap: 'CRJ550（会社の給与表）', fo: 'CRJ550（会社の給与表）' },
    rowSubEn: { cap: 'CRJ550 (company pay scale)', fo: 'CRJ550 (company pay scale)' },
    payTag: { ja: 'USD建て・税引前', en: 'Paid in USD, pre-tax' },
    stepTag: { ja: '年次制（会社の給与表）', en: 'Seniority scale (company pay scale)' },
    tableNote: {
      ja: '※ 推定年収は、会社の給与表の時給（協約の署名から3年目の列。機長12年目・副操縦士6年目＝副操縦士の表の最上段）に年900時間（月75時間の最低保証 × 12）を掛けた額です。日当・401(k) のマッチは入っていません。円は1ドル＝158.95円で換算。',
      en: 'The estimate is the hourly rate on the company pay scale (the third-year column after the contract signing; year-12 captain, year-6 first officer, the top of the first officer scale) times 900 hours a year (the 75-hour monthly minimum × 12). Per diem and the 401(k) match are not included. Converted at 158.95 yen to the dollar.',
    },
    ldTail: {
      ja: 'パイロットの給与表から計算した推定年収と、応募条件。',
      en: 'Estimated from the pilot pay scale, plus the entry requirements.',
    },

    basisJa: '※ 出典と計算：会社の給与表の時給（協約の署名から3年目の列。機長12年目・副操縦士6年目＝副操縦士の表の最上段）に年900時間（月75時間の最低保証 × 12）を掛けた額です。日当・401(k) のマッチは入っていません。円は1ドル＝158.95円で換算。',
    basisEn: 'Source and method: the hourly rate on the company pay scale (the third-year column after the contract signing; year-12 captain, year-6 first officer, the top of the first officer scale) times 900 hours a year (the 75-hour monthly minimum × 12). Per diem and the 401(k) match are not included. Converted at 158.95 yen to the dollar.',

    overviewJa: 'GoJet Airlines は、ミズーリ州セントルイスに本社を置く米国の地域航空会社。会社のサイトによると2005年に設立され、ユナイテッド航空の便だけをユナイテッド・エクスプレスとして飛ばしている。機材は CRJ550 で、1日250便以上・50都市以上へ。社員は1,100人以上で、ユナイテッド航空と10年の契約を結んでいる。',
    overviewEn: 'GoJet Airlines is a US regional airline headquartered in St. Louis, Missouri. According to its site, it was established in 2005 and flies exclusively for United Airlines as United Express, with more than 250 daily flights to over 50 destinations on the CRJ550. It has more than 1,100 employees and a 10-year contract with United.',

    factsJa: [
      ['本社', 'セントルイス（ミズーリ州）'],
      ['設立', '2005年'],
      ['運航', 'ユナイテッド・エクスプレス（ユナイテッド航空の便だけ）'],
      ['機材', 'CRJ550（50席）'],
      ['操縦士の基地', 'ニューアーク（EWR）・ワシントン・ダレス（IAD）・ヒューストン（IAH）・シカゴ（ORD）・セントルイス（STL）'],
      ['所得税', '米国（課税）'],
    ],
    factsEn: [
      ['Headquarters', 'St. Louis, Missouri'],
      ['Founded', '2005'],
      ['Operation', 'United Express (flies only for United Airlines)'],
      ['Fleet', 'CRJ550 (50 seats)'],
      ['Pilot bases', 'Newark (EWR), Washington Dulles (IAD), Houston (IAH), Chicago (ORD), St. Louis (STL)'],
      ['Income tax', 'United States (taxed)'],
    ],

    routesJa: 'ユナイテッド航空の便として、1日250便以上・50都市以上へ（会社のサイト）。路線図はシカゴ（ORD）・ワシントン・ダレス（IAD）・ニューアーク（EWR）・ヒューストン（IAH）の基地ごとに載っている。',
    routesEn: 'More than 250 daily flights to over 50 destinations for United (company site). Route maps are listed by base: Chicago (ORD), Washington Dulles (IAD), Newark (EWR) and Houston (IAH).',
    fleetJa: 'CRJ550 の3クラス50席（ファースト10席・エコノミープラス20席・エコノミー20席）。',
    fleetEn: 'CRJ550 in a three-cabin, 50-seat layout: 10 first class, 20 Economy Plus and 20 economy.',

    trainingJa: [
      ['Wingman', '操縦士の訓練校に在籍中の人の制度。セントルイスの本社の見学（費用は会社）で新人の座学に同席でき、R-ATP か ATP の時間に届くと、副操縦士の採用と訓練日の選択で優先される。見学のあとはユナイテッド航空のスタンバイ搭乗も使える。'],
      ['直接入社の機長', '入社1日目の導入を終えると先任順位を確保でき、6か月以内に訓練へ戻ればよい（その日は全額支給・往復の移動とホテルは会社負担）。'],
      ['United Aviate', 'GoJet で飛んでいると、ユナイテッド航空の Aviate に応募できる。'],
    ],
    trainingEn: [
      ['Wingman', 'For pilots still in a training program: a company-paid visit to St. Louis headquarters to sit in on a new-hire ground school class, then priority for first officer hiring and class dates once they reach R-ATP or ATP minimums. United standby travel is available after the visit.'],
      ['Direct entry captains', 'Complete day 1 of indoctrination to lock in seniority, then return for training within six months. Day 1 is paid in full, with round-trip travel and hotel covered.'],
      ['United Aviate', 'GoJet pilots can apply to United’s Aviate program.'],
    ],

    benefitsJa: [
      ['💼', '年金', '401(k) に本人の拠出の50%を会社が上乗せ・1年で権利確定（上乗せの上限の率は書いていない）。'],
      ['🩺', '医療保険', 'UnitedHealthcare・Delta Dental の歯科・VSP の眼科。'],
      ['🛡️', '保険', '長期の就業不能保険・AD&D・生命保険。'],
      ['📅', '休み', '有給の病気休暇。年休は在籍年数に応じて増える。'],
      ['✈️', '航空券', 'ユナイテッド航空の優待と ZED。'],
      ['💵', '乗務の扱い', '日当は1時間 $2.10。欠航とデッドヘッドは100%支給（デッドヘッドは副操縦士のページ）。制服手当 月 $25。'],
    ],
    benefitsEn: [
      ['💼', 'Retirement', '401(k) with a 50% company match, vested after one year (the cap on the match is not listed).'],
      ['🩺', 'Health', 'UnitedHealthcare, Delta Dental and VSP Vision.'],
      ['🛡️', 'Insurance', 'Long-term disability, AD&D and life insurance.'],
      ['📅', 'Time off', 'Paid sick time; vacation accrues with length of service.'],
      ['✈️', 'Travel', 'United flight benefits and ZED fares.'],
      ['💵', 'Pay rules', 'Per diem of $2.10 an hour. Cancellations and deadheads are paid at 100% (deadhead pay is listed on the page for first officers). $25 monthly uniform allowance.'],
    ],

    hiringStatusJa: '採用ページに副操縦士と直接入社の機長の応募の窓口が載っている（2026年11月3日に確認）。',
    hiringStatusEn: 'The careers pages have application links for first officers and direct entry captains (checked 3 November 2026).',
    hiring: { color: null, tagClass: 'tag-gray', tagJa: '採用ページあり', tagEn: 'Careers page' },
    job: {
      titleJa: '副操縦士（CRJ550）',
      subJa: 'ユナイテッド・エクスプレスの CRJ550 に乗る。GoJet で飛びながら United Aviate に応募できる。',
      titleEn: 'First officer (CRJ550)',
      subEn: 'Fly the United Express CRJ550, with the option to apply to United Aviate.',
    },
    hiringRowsJa: [
      ['免許など', 'ATP・R-ATP か事業用（多発陸上）・計器飛行証明・第1種身体検査・FCC の無線の許可・ATP-CTP と ATP の筆記'],
      ['飛行時間', 'ATP か R-ATP の総時間の最低に届いていること。夜間100時間・計器75時間・野外飛行200時間・多発25時間'],
      ['就労・旅券', '米国で働けて、米国を自由に出入りできること・有効なパスポート'],
      ['直接入社の機長', '23歳以上・ATP・総1,750時間（すべて固定翼）・多発1,000時間・エアキャリア1,000時間・タービン1,000時間。他社の在籍を18年まで1対1で給与の年次に数える'],
    ],
    hiringRowsEn: [
      ['Licenses', 'ATP, restricted ATP or commercial multi-engine land; instrument rating; first-class medical; FCC radio operator permit; ATP-CTP and ATP written'],
      ['Flight hours', 'ATP or R-ATP total-time minimums, with 100 hours night, 75 instrument, 200 cross-country and 25 multi-engine'],
      ['Work and passport', 'Eligible to work in the US and travel in and out of the US freely; current, valid passport'],
      ['Direct entry captain', 'Age 23+, ATP, 1,750 hours (all fixed-wing), 1,000 multi-engine, 1,000 air carrier and 1,000 turbine. Up to 18 years of longevity from another carrier counts 1:1 for pay'],
    ],
    hiringNoteJa: '※ 条件は採用ページの記載（2026年11月3日に確認）。応募の前に、採用ページで最新の条件を確かめる。',
    hiringNoteEn: 'Requirements as listed on the careers page (checked 3 November 2026). Check the current terms there before applying.',

    faqEn: (h) => [
      [`What is ${h.A.en} captain salary in 2026?`,
       `We estimate ${h.A.en} captain pay at about ${h.mm(h.A.cap.avg)} a year: the year-12 captain rate of $202.86 an hour on GoJet’s CRJ550 pay scale times 900 hours a year (the 75-hour monthly minimum guarantee × 12).`],
      [`What is ${h.A.en} first officer salary?`,
       `We estimate ${h.A.en} first officer pay at about ${h.mm(h.A.fo.avg)} a year: the year-6 rate of $105.61 an hour, the top of the first officer scale, times the same 900 hours.`],
    ],
    compareNoteEn: compareFootEn(),
  },
  'northern-air-cargo': {
    code: 'NC',
    donor: 'spirit',
    donorColor: '#FFD700',
    /* 借り元（スピリット航空）の字が残っていないかを見る語。その会社の本文に本当に出る地名（Contour の FLL 基地など）は外す */
    donorTokens: [
      'spirit', 'Spirit', 'スピリット', 'FFD700', 'ffd700', '786508', 'ULCC', 'フォートローダーデール', 'Fort Lauderdale', 'Miramar', 'フロリダ', 'Florida',
    ],
    /* 会社のサイト（nac.aero）のヘッダーのロゴ画像 NAC-new-logo-Registered.png の赤（不透明な画素の94%。残りは黒 #000000）。画像の色表から読んだ値で、導出していない。サイトの CSS の --secondary-color #d73832 はテーマの色なので使わなかった。 */
    color: '#ED2024',
    flag: '🇺🇸',
    countryJa: '米国', countryEn: 'United States',
    tags: { ja: ['B737 貨物', 'アラスカ州内の定期貨物便'], en: ['737 freighters', 'Scheduled cargo across Alaska'] },
    subtitleJa: 'ノーザン・エア・カーゴ — アンカレッジを拠点に、B737 の貨物機でアラスカ州内へ定期の貨物便を飛ばす米国の航空会社。',
    subtitleEn: 'Northern Air Cargo — a US cargo airline flying scheduled Boeing 737 freighter service across Alaska from its Anchorage hub.',
    statsJa: [["機材","B737-300 / B737-400"],["基地","アンカレッジ（ANC）"]],
    statsEn: [["Fleet","B737-300 / B737-400"],["Base","Anchorage (ANC)"]],
    careers: [
      { url: 'https://www.nac.aero/employment/', ja: 'ノーザン・エア・カーゴの採用ページ（外部サイト）', en: 'Northern Air Cargo careers (external)' },
    ],

    rowSubJa: { cap: 'B737（労働協約の時給表）', fo: 'B737（労働協約の時給表）' },
    rowSubEn: { cap: 'B737 (contract pay table)', fo: 'B737 (contract pay table)' },
    payTag: { ja: 'USD建て・税引前', en: 'Paid in USD, pre-tax' },
    stepTag: { ja: '年次制（労働協約）', en: 'Seniority scale (union contract)' },
    tableNote: {
      ja: '※ 推定年収は、労働協約の B737 の時給（2023年7月の表に、協約で決まった毎年7月の2%を2026年まで入れた額。機長12年目・副操縦士6年目）に年780時間（月65時間の保証 × 12）を掛け、会社の確定拠出 4% と 401(k) のマッチ 4% を足した額です。日当は入っていません。円は1ドル＝158.95円で換算。',
      en: 'The estimate is the contract B737 hourly rate (the July 2023 table with the 2% July raises set in the contract through 2026; year-12 captain, year-6 first officer) times 780 hours a year (the 65-hour monthly guarantee × 12), plus the 4% company DC contribution and the 4% 401(k) match. Per diem is not included. Converted at 158.95 yen to the dollar.',
    },
    ldTail: {
      ja: 'パイロットの給与表から計算した推定年収と、応募条件。',
      en: 'Estimated from the pilot pay scale, plus the entry requirements.',
    },

    basisJa: '※ 出典と計算：労働協約の B737 の時給（2023年7月の表に、協約で決まった毎年7月の2%を2026年まで入れた額。機長12年目・副操縦士6年目）に年780時間（月65時間の保証 × 12）を掛け、会社の確定拠出 4% と 401(k) のマッチ 4% を足した額です。日当は入っていません。円は1ドル＝158.95円で換算。',
    basisEn: 'Source and method: the contract B737 hourly rate (the July 2023 table with the 2% July raises set in the contract through 2026; year-12 captain, year-6 first officer) times 780 hours a year (the 65-hour monthly guarantee × 12), plus the 4% company DC contribution and the 4% 401(k) match. Per diem is not included. Converted at 158.95 yen to the dollar.',

    overviewJa: 'ノーザン・エア・カーゴ（NAC）は、アラスカ州アンカレッジに本社を置く米国の貨物航空会社。会社のサイトによると、1956年に C-82 の2機でチャーターの貨物会社として始まり、2006年3月に運輸の持株会社 Saltchuk Resources の傘下に入った。アンカレッジを拠点に、ベセル・ノーム・コッツビューなどアラスカ州内へ定期の貨物便を飛ばし、州内と米本土48州でチャーターも受ける。',
    overviewEn: 'Northern Air Cargo (NAC) is a US cargo airline headquartered in Anchorage, Alaska. According to its site, it started in 1956 as a charter airfreight company with two C-82s and became part of Saltchuk Resources, a transportation holding company, in March 2006. From its Anchorage hub it flies scheduled cargo to communities across Alaska such as Bethel, Nome and Kotzebue, and flies charters within Alaska and the contiguous US.',

    factsJa: [
      ['本社', 'アンカレッジ（アラスカ州）'],
      ['設立', '1956年'],
      ['親会社', 'Saltchuk Resources（2006年から）'],
      ['機材', 'B737-300 / B737-400'],
      ['操縦士の基地', 'アンカレッジ（ANC）'],
      ['所得税', '米国（課税）'],
    ],
    factsEn: [
      ['Headquarters', 'Anchorage, Alaska'],
      ['Founded', '1956'],
      ['Parent', 'Saltchuk Resources (since 2006)'],
      ['Fleet', 'B737-300 / B737-400'],
      ['Pilot base', 'Anchorage (ANC)'],
      ['Income tax', 'United States (taxed)'],
    ],

    routesJa: 'アンカレッジから、アニアク・バロー・ベセル・デッドホース・ディリングハム・キングサーモン・コッツビュー・ノーム・ウナラクリートへ定期の貨物便（会社のサイト）。チャーターはアラスカ州内と米本土48州。副操縦士の求人には、ACMI の運航で最長20日続けて基地を離れることがあると書かれている。',
    routesEn: 'Scheduled cargo from Anchorage to Aniak, Barrow, Bethel, Deadhorse, Dillingham, King Salmon, Kotzebue, Nome and Unalakleet (company site), plus charters within Alaska and the contiguous US. The first officer posting notes ACMI flying of up to 20 consecutive days away from domicile.',
    fleetJa: 'B737-300・B737-400（会社のサイトのチャーターの案内）。機数は会社のサイトに書かれていない。',
    fleetEn: '737-300s and 737-400s (company charter page). The site does not give aircraft numbers.',

    trainingJa: [
      ['訓練', '入社後の訓練の長さと内容は、会社のサイトと求人に書かれていない。Part 121 で乗務するには、その機種の型式限定と多発陸上の限定が要る（求人）。'],
    ],
    trainingEn: [
      ['Training', 'The company site and posting do not describe the length or content of new-hire training. Part 121 flying requires the aircraft type rating and an airplane multi-engine land rating (posting).'],
    ],

    benefitsJa: [
      ['🩺', '医療保険', '医療・歯科・眼科・処方薬の保険（正社員）。'],
      ['💼', '年金', '401(k)。会社のマッチあり（率は会社のサイトに書かれていない）。'],
      ['🛡️', '生命保険', '会社負担の生命保険。'],
      ['📅', '休暇', '有給休暇（PTO）と有給の祝日。'],
      ['✈️', '割引', '他社の航空券（インターライン）と貨物の割引。'],
      ['🎓', 'その他', '学費の補助・フィットネスの補助。'],
    ],
    benefitsEn: [
      ['🩺', 'Health', 'Medical, dental, vision and prescription drug coverage for regular full-time employees.'],
      ['💼', 'Retirement', '401(k) with company-matched contributions (the match rate is not given on the company site).'],
      ['🛡️', 'Life insurance', 'Company-paid life insurance.'],
      ['📅', 'Time off', 'Paid time off and paid holidays.'],
      ['✈️', 'Discounts', 'Interline discounts on travel and freight.'],
      ['🎓', 'Other', 'Tuition assistance and fitness benefits.'],
    ],

    hiringStatusJa: '求人の一覧に B737 の副操縦士の募集が載っている（2026年10月27日掲載。2026年11月3日に確認）。',
    hiringStatusEn: 'The job board lists a 737 first officer opening (posted 27 October 2026; checked 3 November 2026).',
    hiring: { color: null, tagClass: 'tag-gray', tagJa: '採用ページあり', tagEn: 'Careers page' },
    job: {
      titleJa: '副操縦士（B737）',
      subJa: 'アンカレッジの勤務。ACMI の運航で最長20日続けて基地を離れることがある。',
      titleEn: 'First officer (737)',
      subEn: 'Based in Anchorage. ACMI flying can mean up to 20 consecutive days away from domicile.',
    },
    hiringRowsJa: [
      ['免許など', '米国 FAA の ATP（多発）・第1種身体検査・FCC の無線の許可（Restricted Radiotelephone Operator Permit）・運転免許。FAR 61.151 に沿った航空英語'],
      ['飛行時間', '総1,500時間・野外飛行500時間・夜間100時間・計器75時間・機長（PIC）250時間。ターボジェットの経験があれば望ましい'],
      ['学歴', '高校卒業か GED'],
      ['審査', '入社前の薬物検査・5年分の職歴の調査・10年分の犯罪歴の照会・TSA のセキュリティ審査（STA）。海外渡航に制限がないこと'],
    ],
    hiringRowsEn: [
      ['Licenses', 'FAA ATP with multi-engine rating, FAA first-class medical, FCC Restricted Radiotelephone Operator Permit, valid driver’s license; aviation English per FAR 61.151'],
      ['Flight hours', '1,500 hours total, 500 cross-country, 100 night, 75 instrument and 250 PIC; turbojet experience preferred'],
      ['Education', 'High school diploma or GED'],
      ['Checks', 'Pre-employment drug test, 5-year employment background investigation, 10-year criminal history records check and TSA Security Threat Assessment; able to travel internationally without restriction'],
    ],
    hiringNoteJa: '※ 条件は採用ページの記載（2026年11月3日に確認）。応募の前に、採用ページで最新の条件を確かめる。',
    hiringNoteEn: 'Requirements as listed on the careers page (checked 3 November 2026). Check the current terms there before applying.',

    faqEn: (h) => [
      [`What is ${h.A.en} captain salary in 2026?`,
       `We estimate ${h.A.en} captain pay at about ${h.mm(h.A.cap.avg)} a year: the year-12 B737 captain rate in the pilot contract, $208.89 an hour in July 2023 and $221.68 after the 2% July raises the contract sets through 2026, times 780 hours a year (the 65-hour monthly guarantee × 12), plus the 4% company DC contribution and the 4% 401(k) match.`],
      [`What is ${h.A.en} first officer salary?`,
       `We estimate ${h.A.en} first officer pay at about ${h.mm(h.A.fo.avg)} a year: the year-6 rate of $127.08 an hour on the same basis, times 780 hours, plus the same 8%.`],
    ],
    compareNoteEn: compareFootEn(),
  },
  'contour': {
    code: 'LF',
    donor: 'spirit',
    donorColor: '#FFD700',
    /* 借り元（スピリット航空）の字が残っていないかを見る語。その会社の本文に本当に出る地名（Contour の FLL 基地など）は外す */
    donorTokens: [
      'spirit', 'Spirit', 'スピリット', 'FFD700', 'ffd700', '786508', 'ULCC', 'Miramar', 'フロリダ', 'Florida',
    ],
    /* 採用サイト（careers.contourairlines.com）のヘッダーのロゴ画像 Contour_Final.png の紺（文字「CONTOUR」の色・不透明な画素の76%）。画像の色表から読んだ値で、導出していない。ロゴの十字の青は #0077C8・#005EB8・#00A3E0・#71C5E8。 */
    color: '#082C88',
    flag: '🇺🇸',
    countryJa: '米国', countryEn: 'United States',
    tags: { ja: ['ERJ・CRJ200', '年額制の給与'], en: ['ERJ and CRJ200', 'Annual salary scale'] },
    subtitleJa: 'コンツアー航空 — テネシー州スマーナに本社を置き、リージョナルジェットで定期便とチャーターを飛ばす米国の航空会社。',
    subtitleEn: 'Contour Airlines — a US regional airline based in Smyrna, Tennessee, flying scheduled and charter service with regional jets.',
    statsJa: [["機材","ERJ-135/145 / CRJ200"],["本社","スマーナ（テネシー州）"]],
    statsEn: [["Fleet","ERJ-135/145 / CRJ200"],["Headquarters","Smyrna, Tennessee"]],
    careers: [
      { url: 'https://www.careers.contourairlines.com/pilots-careers', ja: 'コンツアー航空 操縦士の採用ページ（外部サイト）', en: 'Contour Airlines pilot careers (external)' },
    ],

    rowSubJa: { cap: 'ERJ・CRJ（会社の年額の給与表）', fo: 'ERJ・CRJ（会社の年額の給与表）' },
    rowSubEn: { cap: 'ERJ / CRJ (company salary scale)', fo: 'ERJ / CRJ (company salary scale)' },
    payTag: { ja: 'USD建て・税引前', en: 'Paid in USD, pre-tax' },
    stepTag: { ja: '年額制（会社の給与表）', en: 'Annual salary scale (company pay scale)' },
    tableNote: {
      ja: '※ 推定年収は、会社の採用ページの年額の給与表（2024年。機長は表の最上段の10年目・副操縦士6年目）に、401(k) のマッチ 6% を足した額です。日当・一時金は入っていません。円は1ドル＝158.95円で換算。',
      en: 'The estimate is the annual salary on the company’s 2024 pay scale (year-10 captain, the top of the scale; year-6 first officer), plus the 6% 401(k) match. Per diem and bonuses are not included. Converted at 158.95 yen to the dollar.',
    },
    ldTail: {
      ja: 'パイロットの給与表から計算した推定年収と、応募条件。',
      en: 'Estimated from the pilot pay scale, plus the entry requirements.',
    },

    basisJa: '※ 出典と計算：会社の採用ページの年額の給与表（2024年。機長は表の最上段の10年目・副操縦士6年目）に、401(k) のマッチ 6% を足した額です。日当・一時金は入っていません。円は1ドル＝158.95円で換算。',
    basisEn: 'Source and method: the annual salary on the company’s 2024 pay scale (year-10 captain, the top of the scale; year-6 first officer), plus the 6% 401(k) match. Per diem and bonuses are not included. Converted at 158.95 yen to the dollar.',

    overviewJa: 'コンツアー航空は、テネシー州スマーナに本社を置く Contour Aviation のリージョナル航空のブランド。会社のサイトによると、Contour Aviation は1982年にビジネスジェットのチャーター会社 Corporate Flight Management として始まり、いまは機体の管理・整備・FBO なども手がける。リージョナルジェット（ERJ-135/145・CRJ200）で定期便とチャーターを飛ばし、アラスカ航空・アメリカン航空・ジェットブルー・ユナイテッド航空とインターラインの提携を結んでいる。',
    overviewEn: 'Contour Airlines is the regional airline brand of Contour Aviation, headquartered in Smyrna, Tennessee. According to its site, Contour Aviation was founded in 1982 as Corporate Flight Management, a private jet charter company, and now also handles aircraft management, maintenance and FBO services. The airline flies scheduled and charter service with regional jets (ERJ-135/145 and CRJ200) and has interline agreements with Alaska, American, JetBlue and United.',

    factsJa: [
      ['本社', 'スマーナ（テネシー州）'],
      ['設立', '1982年（Corporate Flight Management として）'],
      ['機材', 'ERJ-135/145 / CRJ200'],
      ['操縦士の基地', 'ERJ：シャーロット（CLT）・フェニックス（PHX）／CRJ：シカゴ・フォートローダーデール（FLL）・ホワイトプレインズ（HPN）'],
      ['所得税', '米国（課税）'],
    ],
    factsEn: [
      ['Headquarters', 'Smyrna, Tennessee'],
      ['Founded', '1982 (as Corporate Flight Management)'],
      ['Fleet', 'ERJ-135/145 / CRJ200'],
      ['Pilot bases', 'ERJ: Charlotte (CLT), Phoenix (PHX); CRJ: Chicago, Fort Lauderdale (FLL), White Plains (HPN)'],
      ['Income tax', 'United States (taxed)'],
    ],

    routesJa: '小さな町と大きな空港を結ぶ定期便（採用サイトでは36路線）と、チャーター。乗り継ぎは、アラスカ航空・アメリカン航空・ジェットブルー・ユナイテッド航空とのインターラインで。',
    routesEn: 'Scheduled service linking smaller communities with major airports (36 routes, according to the careers site), plus charters. Connections are through interline agreements with Alaska, American, JetBlue and United.',
    fleetJa: 'ERJ-135/145 と CRJ200（会社のサイトと採用ページ）。会社の発表では、定期便は30席のリージョナルジェットで飛ぶ。機数は会社のサイトに書かれていない。',
    fleetEn: 'ERJ-135/145s and CRJ200s (company site and careers pages). Company announcements describe scheduled flights on its 30-seat regional jets. The site does not give aircraft numbers.',

    trainingJa: [
      ['訓練', '会社の中に FAR Part 141 の操縦士・整備士の訓練部門がある（採用サイトの会社紹介）。入社後の訓練の長さと内容は、採用ページに書かれていない。'],
    ],
    trainingEn: [
      ['Training', 'The company runs an FAR Part 141 pilot and maintenance training operation (careers site). The careers pages do not describe the length or content of new-hire training.'],
    ],

    benefitsJa: [
      ['✈️', '航空券', '本人と対象の家族が、コンツアー航空と MyIDTravel の提携会社に空席待ちで乗れる。操縦士は KCM と CASS（相互のジャンプシート）に登録。'],
      ['💼', '年金', '401(k)。会社のマッチ 6%、入社初日から入れる。'],
      ['🩺', '医療保険', '医療（PPO か HDHP/HSA を選ぶ）・歯科・眼科・短期と長期の就業不能保険・ペット保険。生命保険は任意加入（Symetra）。'],
      ['🍽️', '日当', '1時間あたり：定期便 国内 $2.08・国際 $3.14、チャーター 国内 $3.08・国際 $4.14（採用ページの2024年の表）。'],
      ['💵', '機長の一時金', '入社の一時金 $15,000・型式が有効な人に $10,000・在籍の一時金 $10,000（あとの2つは24か月）。審査役（Check Airman）は年 $25,000 の上乗せ（採用ページの2024年の画像）。'],
    ],
    benefitsEn: [
      ['✈️', 'Travel', 'Employees and eligible family members fly space-available on Contour and MyIDTravel partners. Pilots are enrolled in KCM and CASS with reciprocal jumpseat agreements.'],
      ['💼', 'Retirement', '401(k) with a 6% match and no waiting period; pilots can join on day one.'],
      ['🩺', 'Health', 'Medical (PPO or HDHP/HSA), dental, vision, short- and long-term disability and pet insurance; voluntary life insurance through Symetra.'],
      ['🍽️', 'Per diem', 'Per hour: scheduled flying $2.08 domestic and $3.14 international; charter $3.08 domestic and $4.14 international (2024 table on the careers page).'],
      ['💵', 'Captain bonuses', '$15,000 signing bonus, $10,000 24-month current-type bonus and $10,000 24-month retention bonus; check airmen get a $25,000 annual override (2024 image on the careers page).'],
    ],

    hiringStatusJa: '採用ページに CRJ200 の機長の募集が載っている。ERJ・CRJ の副操縦士は、いまは募集なし（2026年11月3日に確認）。',
    hiringStatusEn: 'The careers page lists a CRJ200 captain opening; there are no ERJ or CRJ first officer openings at the moment (checked 3 November 2026).',
    hiring: { color: null, tagClass: 'tag-gray', tagJa: '採用ページあり', tagEn: 'Careers page' },
    job: {
      titleJa: '機長（CRJ200）',
      subJa: '基地は面接で相談する。1年目の機長には、条件つきの一時金がある。',
      titleEn: 'Captain (CRJ200)',
      subEn: 'Base is discussed at interview. First-year captains are eligible for qualifying bonuses.',
    },
    hiringRowsJa: [
      ['飛行時間（機長）', '総1,500時間以上（2,500時間を推奨）・機長（PIC）500時間以上（1,000時間を推奨）・多発500時間以上（1,000時間を推奨）'],
      ['型式', '型式限定と最近の乗務経験があれば望ましい'],
      ['副操縦士（ERJ・CRJ）', '総500時間以上・多発25時間以上（いまは募集なし）'],
    ],
    hiringRowsEn: [
      ['Flight hours (captain)', '1,500 hours total minimum (2,500 recommended), 500 PIC minimum (1,000 recommended), 500 multi-engine minimum (1,000 recommended)'],
      ['Type rating', 'Type rating and currency recommended'],
      ['First officer (ERJ/CRJ)', '500 hours total minimum and 25 multi-engine minimum (no openings at the moment)'],
    ],
    hiringNoteJa: '※ 条件は採用ページの記載（2026年11月3日に確認）。応募の前に、採用ページで最新の条件を確かめる。',
    hiringNoteEn: 'Requirements as listed on the careers page (checked 3 November 2026). Check the current terms there before applying.',

    faqEn: (h) => [
      [`What is ${h.A.en} captain salary in 2026?`,
       `We estimate ${h.A.en} captain pay at about ${h.mm(h.A.cap.avg)} a year: the year-10 captain salary of $147,365.83 at the top of Contour’s 2024 pay scale, plus the 6% 401(k) match.`],
      [`What is ${h.A.en} first officer salary?`,
       `We estimate ${h.A.en} first officer pay at about ${h.mm(h.A.fo.avg)} a year: the year-6 first officer salary of $40,730.70 on the same scale, plus the 6% match.`],
    ],
    compareNoteEn: compareFootEn(),
  },
  'jazz': {
    code: 'QK',
    donor: 'spirit',
    donorColor: '#FFD700',
    /* 借り元（スピリット航空）の字が残っていないかを見る語。その会社の本文に本当に出る地名（Contour の FLL 基地など）は外す */
    donorTokens: [
      'spirit', 'Spirit', 'スピリット', 'FFD700', 'ffd700', '786508', 'ULCC', 'フォートローダーデール', 'Fort Lauderdale', 'Miramar', 'フロリダ', 'Florida',
    ],
    /* 会社のサイト（flyjazz.com）のヘッダーのロゴ画像 jazz-logo.png（wp-content/themes/jazz/library/images/）の赤。画像の色は1色だけ。色表から読んだ値で、導出していない。 */
    color: '#CF3628',
    flag: '🇨🇦',
    countryJa: 'カナダ', countryEn: 'Canada',
    tags: { ja: ['エア・カナダ・エクスプレス', 'エア・カナダへの移籍の制度'], en: ['Air Canada Express', 'Flow to Air Canada'] },
    subtitleJa: 'ジャズ航空 — エア・カナダ・エクスプレスの便を飛ばすカナダのリージョナル航空会社。本社はノバスコシア州エンフィールド（ハリファックス）。',
    subtitleEn: 'Jazz Aviation — a Canadian regional airline flying Air Canada Express, with its head office in Enfield, Nova Scotia, near Halifax.',
    statsJa: [["機材","E175 / CRJ900 / Dash 8-400"],["基地","トロント・モントリオール・カルガリー・バンクーバー"]],
    statsEn: [["Fleet","E175 / CRJ900 / Dash 8-400"],["Bases","Toronto, Montreal, Calgary, Vancouver"]],
    careers: [
      { url: 'https://flyjazz.com/en/pilot-recruitment/', ja: 'ジャズ航空 操縦士の採用ページ（外部サイト）', en: 'Jazz pilot recruitment (external)' },
    ],

    rowSubJa: { cap: '全機材で1本の時給表', fo: '全機材で1本の時給表' },
    rowSubEn: { cap: 'One pay table for all fleets', fo: 'One pay table for all fleets' },
    payTag: { ja: 'CAD建て・税引前', en: 'Paid in CAD, pre-tax' },
    stepTag: { ja: '年次制（労働協約）', en: 'Seniority scale (union contract)' },
    tableNote: {
      ja: '※ 推定年収は、2026年7月1日からの時給（全機材で1本。機長12年目・副操縦士6年目）に年990時間（会社が出している月平均82.5時間 × 12）を掛けた額です。確定拠出年金のマッチ・日当は入っていません。円は1カナダドル＝115.49円で換算。',
      en: 'The estimate is the hourly rate from 1 July 2026 (one table for all fleets; year-12 captain, year-6 first officer) times 990 hours a year (the company’s 82.5-hour monthly average × 12). The pension match and per diem are not included. Converted at 115.49 yen to the Canadian dollar.',
    },
    ldTail: {
      ja: 'パイロットの給与表から計算した推定年収と、応募条件。',
      en: 'Estimated from the pilot pay scale, plus the entry requirements.',
    },

    basisJa: '※ 出典と計算：2026年7月1日からの時給（全機材で1本。機長12年目・副操縦士6年目）に年990時間（会社が出している月平均82.5時間 × 12）を掛けた額です。確定拠出年金のマッチ・日当は入っていません。円は1カナダドル＝115.49円で換算。',
    basisEn: 'Source and method: the hourly rate from 1 July 2026 (one table for all fleets; year-12 captain, year-6 first officer) times 990 hours a year (the company’s 82.5-hour monthly average × 12). The pension match and per diem are not included. Converted at 115.49 yen to the Canadian dollar.',

    overviewJa: 'ジャズ航空（Jazz Aviation LP）は、ノバスコシア州エンフィールド（ハリファックス）に本社と運航の拠点を置くカナダのリージョナル航空会社。会社のサイトによると、2002年に Air Canada Jazz のブランドで始まり、2010年から Chorus Aviation（トロント証券取引所 CHR）の傘下。エア・カナダとの契約で、エア・カナダ・エクスプレスの便を E175・CRJ900・Dash 8-400 で飛ばす。操縦士の基地はトロント・モントリオール・カルガリー・バンクーバーの4つ。',
    overviewEn: 'Jazz Aviation LP is a Canadian regional airline with its head office and operations center in Enfield, Nova Scotia, near Halifax. According to its site, the Air Canada Jazz brand launched in 2002, and Jazz has been owned by Chorus Aviation (TSX: CHR) since 2010. It flies Air Canada Express under its agreement with Air Canada, using the E175, CRJ900 and Dash 8-400. Pilots are based in Toronto, Montreal, Calgary and Vancouver.',

    factsJa: [
      ['本社', 'エンフィールド（ノバスコシア州・ハリファックス）'],
      ['ブランドの始まり', '2002年（Air Canada Jazz として）'],
      ['親会社', 'Chorus Aviation（2010年から）'],
      ['機材', 'E175 25機・CRJ900 30機・Dash 8-400 33機'],
      ['操縦士の基地', 'トロント・モントリオール・カルガリー・バンクーバー'],
      ['所得税', 'カナダ（課税）'],
    ],
    factsEn: [
      ['Headquarters', 'Enfield, Nova Scotia (Halifax)'],
      ['Brand launched', '2002 (as Air Canada Jazz)'],
      ['Parent', 'Chorus Aviation (since 2010)'],
      ['Fleet', '25 E175, 30 CRJ900, 33 Dash 8-400'],
      ['Pilot bases', 'Toronto, Montreal, Calgary, Vancouver'],
      ['Income tax', 'Canada (taxed)'],
    ],

    routesJa: 'エア・カナダ・エクスプレスとして、カナダ41・米国24の計65地点へ1日約380便（会社の概要。2026年6月時点）。2019年のエア・カナダとの契約で、エア・カナダ・エクスプレスの主な運航会社の立場は2035年まで。',
    routesEn: 'As Air Canada Express, about 380 daily flights to 65 destinations, 41 in Canada and 24 in the US (company fact sheet, effective June 2026). A 2019 agreement with Air Canada secures its role as the primary Air Canada Express operator through 2035.',
    fleetJa: 'E175 25機・CRJ900 30機・Dash 8-400 33機の計88機（会社のサイトのエア・カナダ・エクスプレスの機材の表）。',
    fleetEn: '88 aircraft: 25 E175s, 30 CRJ900s and 33 Dash 8-400s (Air Canada Express fleet table on the company site).',

    trainingJa: [
      ['入社後', '採用の流れの最後は「Jazz Initial Pilot Training」。期間と内容は採用ページに書かれていない。iPad と Bose のヘッドセットが支給される。'],
      ['訓練生の道', 'Jazz Approach：CAE と Cygnet Aviation Academy との制度。選ばれると条件付きの採用通知が出て、Cygnet で18か月の ATPL 一貫課程 → CAE のトロントの施設でジェットへの移行訓練。'],
      ['機長への準備', 'PICUS（監督下で機長を務める）の制度がある。'],
    ],
    trainingEn: [
      ['After hiring', 'The hiring process ends with Jazz Initial Pilot Training; the recruitment page does not give its length or content. Pilots are issued an iPad and a Bose aviation headset.'],
      ['Cadet pathway', 'Jazz Approach, with CAE and Cygnet Aviation Academy: selected cadets receive a conditional letter of employment, complete an 18-month integrated ATPL at Cygnet, then jet transition training at CAE in Toronto.'],
      ['Upgrade', 'A Pilot in Command Under Supervision (PICUS) program for pilots building upgrade qualifications.'],
    ],

    benefitsJa: [
      ['💼', '年金', '確定拠出年金（会社のマッチは毎年上がり、最大8%）と従業員持株制度。'],
      ['🍽️', '日当・手当', '1日ごとの非課税の食事の日当。会社の例では年平均 C$9,000（平均の月82.5クレジット時間・2026年7月1日）。身体検査の費用・パスポート・制服の手当で年 C$1,600 超。'],
      ['🩺', '保険', '医療・歯科・就業不能の保険（会社と本人で保険料を分担）。'],
      ['📅', '休み', '月の公休は最低12日。育児の休業は1回ごとに最長52週で、先任順位を失わない。'],
      ['✈️', '航空券', 'エア・カナダの路線網での社員旅行の特典。'],
      ['🛫', 'エア・カナダへ', '移籍の制度（flow program）があり、採用ページはエア・カナダの操縦士の優先の供給元と書いている。'],
    ],
    benefitsEn: [
      ['💼', 'Retirement', 'Defined contribution pension with a company match that rises each year to a maximum of 8%, plus an employee share ownership program.'],
      ['🍽️', 'Per diem and allowances', 'Daily tax-free meal per diems, averaging about C$9,000 a year in the company’s example (82.5 average monthly credit hours, 1 July 2026). Medical fees, passport and uniform allowances total over C$1,600 a year.'],
      ['🩺', 'Health', 'Health, dental and disability coverage with company/pilot cost sharing.'],
      ['📅', 'Days off', 'At least 12 days off a month guaranteed. Up to 52 weeks of parental leave per birth, adoption, foster or ward custody, without loss of seniority.'],
      ['✈️', 'Travel', 'Employee travel benefits across the Air Canada network.'],
      ['🛫', 'Path to Air Canada', 'A flow program; the recruitment page describes Jazz as Air Canada’s preferential source of qualified pilots.'],
    ],

    hiringStatusJa: '採用ページから副操縦士の募集（Pilot (First Officer)・2026年6月30日掲載）に応募できる（2026年11月3日に確認）。',
    hiringStatusEn: 'The recruitment page links to an open first officer posting, Pilot (First Officer), posted 30 June 2026 (checked 3 November 2026).',
    hiring: { color: null, tagClass: 'tag-gray', tagJa: '採用ページあり', tagEn: 'Careers page' },
    job: {
      titleJa: '副操縦士',
      subJa: '基地はトロント・モントリオール・カルガリー・バンクーバーの4つ。基地の移動もできる。',
      titleEn: 'First officer',
      subEn: 'Four bases: Toronto, Montreal, Calgary and Vancouver, with the option to move between them.',
    },
    hiringRowsJa: [
      ['免許など', 'カナダ運輸省の事業用操縦士（CPL）・計器飛行証明 Group 1（計器飛行の最近の経験の要件を満たすこと）・第1種身体検査。705 類の機材で副操縦士として乗れる資格'],
      ['飛行時間', '総500時間以上'],
      ['就労資格', 'カナダの市民権か永住権。米国に入国できること（恩赦のない有罪歴がない）。永住者は米国内の乗務に要る乗員ビザを取れること'],
      ['優遇', 'カナダの ATPL・2人乗務の多発タービンの経験・航空の大学や専門学校の卒業・民間か軍の飛行経験・FMS やグラスコックピットの経験'],
      ['別の道', '提携校の卒業生は Jazz Direct で250時間から応募できる（ATPL 一貫課程は250時間より前でも可）'],
    ],
    hiringRowsEn: [
      ['Licenses', 'Transport Canada commercial pilot license, valid Group 1 instrument rating meeting recency requirements, Class 1 medical; licensed to act as first officer on 705-category aircraft'],
      ['Flight hours', '500 hours total minimum'],
      ['Work eligibility', 'Canadian citizen or permanent resident, legally able to enter the US (no criminal conviction without a pardon); permanent residents must be able to obtain crew visas for US operations'],
      ['Preferred', 'Canadian ATPL, two-crew multi-engine turbine experience, an aviation college degree or diploma, commercial or military flying, FMS or glass cockpit experience'],
      ['Pathway', 'Graduates of Jazz-affiliated schools can apply through Jazz Direct from 250 hours (integrated ATPL graduates may move forward sooner)'],
    ],
    hiringNoteJa: '※ 条件は採用ページの記載（2026年11月3日に確認）。応募の前に、採用ページで最新の条件を確かめる。',
    hiringNoteEn: 'Requirements as listed on the careers page (checked 3 November 2026). Check the current terms there before applying.',

    faqEn: (h) => [
      [`What is ${h.A.en} captain salary in 2026?`,
       `We estimate ${h.A.en} captain pay at about ${h.mm(h.A.cap.avg)} a year: the year-12 captain rate of C$158.83 an hour from 1 July 2026 (one table for all fleets) times 990 hours a year (the company’s 82.5-hour monthly average × 12).`],
      [`What is ${h.A.en} first officer salary?`,
       `We estimate ${h.A.en} first officer pay at about ${h.mm(h.A.fo.avg)} a year: the year-6 rate of C$80.58 an hour on the same table times the same 990 hours.`],
    ],
    compareNoteEn: compareFootEn(),
  },
  /* /NA20 */
};

const C = CONTENT[slug];
if (!C) {
  console.error(`✗ CONTENT に ${slug} の本文が無い。\n  年収だけ SSOT に足してもページは作れない（テンプレの穴埋めで水増ししないため）。`);
  process.exit(1);
}

/* ── 借り元。写してある（airline-donor-pages.mjs）ならそれ、無ければリポジトリのページ ── */
const kept = (lang) => (DONOR_PAGES[C.donor] || {})[lang];
const donorName = (lang) => kept(lang) ? `airline-donor-pages.mjs の ${C.donor}（${lang}）`
  : (lang === 'ja' ? `airlines/${C.donor}.html` : `en/airlines/${C.donor}.html`);
const donorHtml = (donor, lang) => kept(lang) || fs.readFileSync(path.join(ROOT, donor), 'utf8');

/* ── 出力先。既にあるものには絶対に書かない ───────────────────── */
const targets = [
  { rel: `airlines/${slug}.html`, donor: donorName('ja'), lang: 'ja' },
  { rel: `en/airlines/${slug}.html`, donor: donorName('en'), lang: 'en' },
];
for (const t of targets) {
  if (fs.existsSync(path.join(ROOT, t.rel)) && !FORCE) {
    console.error(`✗ 既にある: ${t.rel}\n  1社を直したいときはそのページを直接編集する（CLAUDE.md）。`);
    process.exit(1);
  }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/* 日本語の社名の行。和名と英名が同じ字の会社（FedEx Express・UPS Airlines）は1回だけ（「FedEx Express（FedEx Express）」にしない）。2026-11-02 */
const nameJa = A.ja === A.en ? esc(A.ja) : `${esc(A.ja)}（${esc(A.en)}）`;
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
<div class="glass p-8 fade-up"><div class="section-badge mb-4">概要</div><h2 class="text-2xl font-bold mb-4">${nameJa}について</h2>
<div class="grid lg:grid-cols-2 gap-8"><p class="text-muted leading-relaxed">${esc(C.overviewJa)}</p>
<div class="grid grid-cols-2 gap-4">${facts}</div></div></div>
<div class="glass p-8 fade-up"><div class="section-badge mb-4">年収データ</div>
<h2 class="text-2xl font-bold mb-2">パイロット年収（2026年・推定）</h2>
<p class="text-xs text-muted mb-6">${esc(C.tableNote.ja)}</p>
<div class="overflow-x-auto mb-4"><table><thead><tr><th>ポジション</th><th>年収レンジ</th><th>推定年収</th><th>備考</th></tr></thead><tbody>
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
<h2 class="text-2xl font-bold mb-2">Pilot salary (2026 reference)</h2>
<p class="text-xs text-muted mb-6">${esc(C.tableNote.en)}</p>
<div class="overflow-x-auto mb-4"><table><thead><tr><th>Position</th><th>Annual range</th><th>Estimated salary</th><th>Notes</th></tr></thead><tbody>
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
<h2 class="text-2xl font-bold mb-6">${esc(A.en)} vs other ${regionEn} carriers</h2>
<div class="overflow-x-auto"><table>
<thead><tr><th>Airline</th><th>Captain (range)</th><th>First Officer</th><th>Income Tax</th></tr></thead>
<tbody>
<tr><td><span class="font-bold" style="color:${C.color}">${esc(A.en)} ${C.flag}</span></td><td><span class="font-bold" style="color:${C.color}">${mmR(A.cap)}</span></td><td>${mmR(A.fo)}</td><td>${A.taxFree ? '<span class="tag tag-green">0% (tax-free)</span>' : '<span class="tag tag-gray">Income tax applies</span>'}</td></tr>
${peerSlugs.map((p) => `<tr><td>${peerNameEn(p)}</td><td>${mmR(SALARY[p].cap)}</td><td>${mmR(SALARY[p].fo)}</td><td>${taxCellEn(p)}</td></tr>`).join('\n')}
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
<h1 class="text-4xl lg:text-5xl font-extrabold tracking-tight mb-2" style="background:linear-gradient(135deg,#fff,${C.color});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${nameJa}</h1>
<p class="text-muted text-lg">${esc(C.subtitleJa)}</p></div></div>
<div class="grid grid-cols-2 md:grid-cols-4 gap-4">${stats}</div>
</div></div>`;
}

function heroEn() {
  const tags = [`<span class="tag tag-orange">${C.flag} ${esc(C.countryEn)}</span>`,
    ...C.tags.en.map((t, i) => `<span class="tag ${i === 0 ? 'tag-orange' : i === 1 ? 'tag-gray' : 'tag-blue'}">${esc(t)}</span>`)].join('');
  const stats = [
    [mm(A.cap.avg), 'Capt. est. (pre-tax)', C.color],
    [mm(A.fo.avg), 'FO est. (pre-tax)', C.color],
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
  const k = (v) => Math.round(v * 10000 / USD_RATE / 1000);   // 万円 → USD千ドル（レートは currency.js が正）
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
  let html = donorHtml(donor, lang);

  /* 1) 管理ブロックを剥がす。中身はパイプラインが入れ直す。 */
  html = html.replace(/<!--PV-SEO-->[\s\S]*?<!--\/PV-SEO-->[ \t]*\n?/g, '')
             .replace(/<!--PV-CLINK-->[\s\S]*?<!--\/PV-CLINK-->[ \t]*\n?/g, () => '')
             /* 古い借り元に橙の帯が残っていても持ち込まない（2026-10-08 に全会社ページから外した）。 */
             .replace(/<div style="background:rgba\(249,115,22,\.06\)[^>]*>\s*<a href="\.\.\/pilot-tenshoku\.html"[^>]*>[^<]*<\/a>\s*<\/div>[ \t]*\n?/g, () => '')
             .replace(/<!--PV-FAQ-->[\s\S]*?<!--\/PV-FAQ-->[ \t]*\n?/g, '')
             .replace(/<!--PV-3P-->[\s\S]*?<!--\/PV-3P-->[ \t]*\n?/g, '')
             /* 明るい色の画面の濃さの塊は、借り元の色で書いてある。patch-airline-pages.mjs がこの会社の色で書き直すので持ち込まない（2026-10-31）。 */
             .replace(/\n?<style data-pv-light>[\s\S]*?<\/style>/g, () => '');

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
    : `${A.en} Pilot Salary 2026 — Captain $${Math.round(A.cap.avg * 10000 / USD_RATE / 1000)}K | PILOT VALUE`;
  if (!/<title[^>]*>/i.test(html)) throw new Error(`${donor}: <title> が無い`);
  html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);

  /* 4) ヒーローと本文を丸ごと差し替える。借り元の段落を1つも残さない。
        差し替える範囲は「</nav> の直後のヒーロー」から「本文の終わり」まで。
        ナビ・フッター・スクリプトだけを借りる。 */
  const heroStart = html.indexOf('<div class="hero-airline"');
  if (heroStart === -1) throw new Error(`${donor}: ヒーローが見つからない`);
  const bodyStart = html.indexOf(CONTAINER, heroStart);
  if (bodyStart === -1) throw new Error(`${donor}: 本文コンテナが見つからない`);
  /* ★2026-10-08 まで日本語は転職CTAの橙の帯を「本文の終わり」の目印にしていた。
       帯は全会社ページから外したので、日英とも <footer を目印にする。 */
  const tailAnchor = html.slice(bodyStart).search(/<footer\b/i) + bodyStart;
  if (tailAnchor <= bodyStart) throw new Error(`${donor}: 本文の終わりが見つからない`);

  const hero = lang === 'ja' ? heroJa() : heroEn();
  const inner = lang === 'ja' ? bodyJa() : bodyEn();
  html = html.slice(0, heroStart) + hero + '\n\n' + CONTAINER + inner + '</div>\n\n' + html.slice(tailAnchor);

  /* 5) 借り元固有のトークンを置き換える（nav・footer・body 属性・canonical 等）*/
  /* 色は #FF6600 / #FF660012 のように末尾へ不透明度が付く。長い方から消せば全部拾える。 */
  /* ★2026-10-31 借り元の色は donorColor（無ければ easyJet の #FF6600）。大文字・小文字の両方の書き方を拾う（スピリットは #FFD700 と #ffd700 の両方がある）。 */
  html = html.split(C.donor).join(slug).replace(new RegExp(C.donorColor || '#FF6600', 'gi'), () => C.color);
  html = html.replace(/(<html[^>]*lang=")[a-z-]+(")/i, `$1${lang}$2`);

  /* 6) 検査。1つでも残っていたら書かない。 */
  const left = C.donorTokens.filter((t) => html.includes(t));
  if (left.length) throw new Error(`${donor}: 借り元の語が残っている → ${left.join(', ')}`);
  const need = lang === 'ja'
    ? ['"@type":"FAQPage"', '<footer']
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
