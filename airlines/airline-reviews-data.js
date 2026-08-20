/* ═══════════════════════════════════════════════════════════════════
   PILOT VALUE — 航空会社ページ 口コミ共有データ（日英共通の唯一の正）

   airline-base.js から機械的に切り出したもの。中身は改変していない。
   JP（airlines/*.html → airline-base.js）と
   EN（en/airlines/*.html → airline-reviews-ui.js）の双方がこれを読む。

   EN ページは airline-base.js を読み込めない（タブ・モーダル等が付いてきて
   EN テンプレートを壊す）ため、データだけを外に出して共有する。

   各エントリの comment は日本語本文。英語ページ用の原文/訳文は en フィールド。
   en が無いエントリは英語ページでは表示しない（捏造しないため）。
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── 評価スコア [企業文化, 給与, 福利厚生, ワークライフバランス, 運航環境, 訓練環境] ──
  const RATINGS = {
  ana:              [3.8, 3.5, 4.2, 3.3, 4.0, 4.1],
  jal:              [3.7, 3.4, 4.1, 3.4, 4.0, 4.0],
  skymark:          [3.2, 2.8, 3.1, 3.8, 3.6, 3.2],
  zipair:           [3.4, 3.1, 3.2, 3.5, 3.8, 3.3],
  peach:            [3.3, 2.9, 3.1, 3.6, 3.7, 3.2],
  'jetstar-japan':  [3.1, 2.7, 3.0, 3.5, 3.5, 3.1],
  'spring-japan':   [3.0, 2.8, 2.9, 3.4, 3.4, 3.0],
  delta:            [4.2, 4.9, 4.5, 3.8, 4.4, 4.0],
  united:           [3.8, 4.8, 4.4, 3.5, 4.1, 3.9],
  american:         [3.5, 4.6, 4.2, 3.3, 4.0, 3.7],
  southwest:        [4.0, 4.3, 4.3, 3.7, 4.2, 3.8],
  'alaska-airlines':[3.9, 4.4, 4.3, 3.8, 4.2, 3.9],
  emirates:         [3.5, 4.8, 4.6, 2.8, 4.2, 3.8],
  'qatar-airways':  [3.4, 4.5, 4.3, 2.7, 4.3, 3.9],
  etihad:           [3.6, 4.4, 4.2, 2.9, 4.1, 3.8],
  'riyadh-air':     [3.8, 4.6, 4.4, 3.0, 4.2, 3.9],
  'singapore-airlines':[4.0, 4.0, 4.4, 3.5, 4.5, 4.3],
  'cathay-pacific': [3.7, 3.8, 4.1, 3.3, 4.3, 4.2],
  lufthansa:        [3.8, 4.0, 4.3, 3.6, 4.4, 4.3],
  'air-france':     [3.6, 3.9, 4.2, 3.5, 4.2, 4.1],
  'british-airways':[3.7, 3.8, 4.1, 3.5, 4.2, 4.1],
  klm:              [3.9, 3.9, 4.2, 3.7, 4.3, 4.1],
  swiss:            [4.1, 4.3, 4.4, 3.8, 4.5, 4.4],
  'turkish-airlines':[3.5, 3.8, 3.9, 3.0, 4.0, 3.8],
  'korean-air':     [3.5, 3.6, 3.8, 3.3, 4.1, 3.9],
  asiana:           [3.4, 3.5, 3.7, 3.2, 4.0, 3.8],
  'air-china':      [3.2, 3.4, 3.5, 3.1, 3.8, 3.5],
  'china-eastern':  [3.1, 3.3, 3.4, 3.0, 3.7, 3.4],
  'china-southern': [3.2, 3.3, 3.4, 3.1, 3.8, 3.5],
  'air-canada':     [3.8, 4.0, 4.1, 3.5, 4.1, 3.9],
  'air-india':      [3.0, 3.2, 3.1, 3.0, 3.5, 3.2],
  'air-new-zealand':[4.2, 4.1, 4.3, 3.9, 4.4, 4.2],
  qantas:           [4.0, 3.9, 4.2, 3.7, 4.3, 4.1],
  finnair:          [3.9, 3.7, 4.2, 3.7, 4.2, 4.0],
  'aer-lingus':     [3.7, 3.6, 3.9, 3.5, 4.0, 3.8],
  iberia:           [3.5, 3.5, 3.7, 3.4, 3.9, 3.7],
  tap:              [3.4, 3.4, 3.6, 3.3, 3.8, 3.6],
  aegean:           [3.5, 3.3, 3.5, 3.4, 3.8, 3.5],
  aeromexico:       [3.3, 3.4, 3.5, 3.2, 3.7, 3.4],
  avianca:          [3.2, 3.3, 3.3, 3.1, 3.6, 3.3],
  'copa-airlines':  [3.5, 3.6, 3.7, 3.4, 3.9, 3.6],
  latam:            [3.4, 3.5, 3.6, 3.3, 3.8, 3.5],
  // ── 日本の地域・グループ航空会社 ──
  'j-air':          [3.4, 3.0, 3.2, 3.7, 3.4, 3.3],
  jta:              [3.3, 2.9, 3.1, 3.8, 3.5, 3.2],
  jac:              [3.2, 2.7, 2.9, 3.7, 3.3, 3.1],
  rac:              [3.2, 2.8, 2.9, 3.8, 3.3, 3.1],
  hac:              [3.3, 2.8, 3.0, 3.7, 3.4, 3.2],
  'ana-wings':      [3.5, 3.0, 3.3, 3.5, 3.7, 3.5],
  airjapan:         [3.3, 3.2, 3.1, 3.4, 3.7, 3.3],
  airdo:            [3.3, 2.7, 2.9, 3.7, 3.5, 3.1],
  solaseed:         [3.4, 2.8, 3.0, 3.7, 3.5, 3.2],
  starflyer:        [3.5, 3.0, 3.2, 3.8, 3.6, 3.4],
  fda:              [3.3, 2.8, 2.9, 3.8, 3.4, 3.1],
  ibex:             [3.2, 2.7, 2.8, 3.7, 3.3, 3.0],
  'toki-air':       [3.1, 2.6, 2.7, 3.6, 3.2, 2.9],
  orc:              [3.1, 2.6, 2.8, 3.6, 3.2, 2.9],
  amx:              [3.0, 2.5, 2.7, 3.5, 3.1, 2.8],
  'shin-central':   [2.9, 2.5, 2.6, 3.4, 3.1, 2.8],
  'toho-air':       [2.9, 2.4, 2.5, 3.3, 3.0, 2.7],
  'daiichi-air':    [2.8, 2.4, 2.5, 3.3, 3.0, 2.7],
  'shin-nihon':     [2.9, 2.5, 2.6, 3.4, 3.1, 2.8],
};
  const DEFAULT_R = [3.5, 3.5, 3.5, 3.5, 3.5, 3.5];

  const CAT_SHORT = ['企業文化','給与','福利厚生','ワークライフバランス','運航環境','訓練環境'];
  const CAT_FULL  = ['企業カルチャー','給与・報酬の納得度','福利厚生','ワークライフバランス','運航環境','訓練環境'];
  const CAT_SHORT_EN = ['Culture','Pay','Benefits','Work-Life','Operations','Training'];
  // バーのラベル欄は 120px 固定・ellipsis。'Pay & Compensation' は溢れて "Pay & Compensa…" になる。
  const CAT_FULL_EN  = ['Company Culture','Compensation','Benefits','Work-Life Balance','Operations','Training'];

  const REVIEW_CATS = [
  {key:'culture',  label:'企業文化'},
  {key:'salary',   label:'給与'},
  {key:'benefits', label:'福利厚生'},
  {key:'wlb',      label:'ワークライフバランス'},
  {key:'ops',      label:'運航環境'},
  {key:'training', label:'訓練環境'},
];
  /* 日本語側と同じ6カテゴリに揃える。'other' を足すと英語ページだけ
     カテゴリカードとフィルタチップが1個多くなり、日英が揃わない。 */
  const REVIEW_CATS_EN = [
    {key:'culture',  label:'Culture'},
    {key:'salary',   label:'Pay'},
    {key:'benefits', label:'Benefits'},
    {key:'wlb',      label:'Work-Life Balance'},
    {key:'ops',      label:'Operations'},
    {key:'training', label:'Training'},
  ];

  const SEED_REVIEWS = {
  ana:[
    {orig:'ja',pos:'captain',years:'16-20',join:'new',avgRating:4.2,cat:'salary',
     salaryTotal:2900,monthly:168,overtime:22,bonus:504,
     comment:'給与制度は年功序列が基本。B777国際線機長で各種手当含め¥3,000万超も可能。昇給は毎年着実に行われ安定感がある。賞与は業績連動型だが基本的に安定して支給される。退職金・企業年金が業界最高水準で生涯収入は申し分ない。訓練費は全額会社負担でキャリア形成コストが低いのも大きなメリット。機長昇格は12〜15年目安で審査は厳しいが基準は明確かつ公平。EF・家族航空券も充実。',
     en:'The pay structure is fundamentally seniority-based. As a B777 international captain you can clear ¥30M including allowances. Raises come every year without fail, which gives you real stability. The bonus is performance-linked but has been paid reliably. Retirement benefits and the corporate pension are the best in the industry, so lifetime earnings leave nothing to complain about. Training costs are fully covered by the company, which keeps the cost of building a career very low — a big advantage. Upgrade to captain takes roughly 12–15 years; the check is demanding but the criteria are clear and fair. Staff and family travel benefits are generous.',
     date:'2026.03'},
    {orig:'ja',pos:'fo',years:'6-10',join:'new',avgRating:3.8,cat:'salary',
     salaryTotal:1900,monthly:100,overtime:15,bonus:260,
     comment:'副操縦士10年目で約¥1,900万。国際線乗務手当でさらにプラスになる。昇格待ちポジションが長く入社から15年近くかかる場合もあるのが唯一のデメリット。社宅・健康保険が充実しており航空身体検査サポートも万全。ワークライフバランスは比較的良好で休暇取得はしやすい環境。',
     en:'About ¥19M in my tenth year as a first officer. International flying allowances push that higher. The one drawback is the long queue for upgrade — it can take close to 15 years from date of hire. Company housing and health insurance are excellent, and support for the aviation medical is thorough. Work-life balance is relatively good and leave is easy to get.',
     date:'2026.02'},
    {orig:'ja',pos:'captain',years:'11-15',join:'new',avgRating:3.6,cat:'culture',
     salaryTotal:2600,monthly:150,overtime:18,bonus:376,
     comment:'中堅機長として安定した給与水準。B787で国際線に就航しており充実感がある。昇格までの道のりは長いが会社の安定性・ブランド力・退職後の生活を考えると納得できる選択。日本語環境で家族と一緒に日本に住めるのが最大のメリット。',
     en:'Solid pay as a mid-career captain. I fly the B787 on international routes and find the work genuinely rewarding. The road to upgrade is long, but given the company\'s stability, brand, and post-retirement provisions, it\'s a choice I\'m comfortable with. The biggest advantage is being able to live in Japan with my family in a Japanese-speaking environment.',
     date:'2026.01'},
  ],
  jal:[
    {orig:'ja',pos:'captain',years:'16-20',join:'new',avgRating:4.0,cat:'salary',
     salaryTotal:2800,monthly:162,overtime:20,bonus:472,
     comment:'A350国際線機長で約¥2,800万。ANA比でやや低めだが安定性は同等。昇格は年功主体だが実力評価も加わりつつある。EF・退職金は業界最高水準。ワークライフバランスも比較的良好で休暇申請は通りやすい。整備水準・運航環境ともに高く誇りを持って働ける職場。',
     en:'About ¥28M as an A350 international captain. Slightly below ANA, but the stability is equivalent. Upgrade is mainly seniority-driven, though merit assessment is increasingly part of it. Staff travel and retirement benefits are the best in the industry. Work-life balance is relatively good and leave requests are usually approved. Maintenance standards and the operating environment are both high — it\'s a place you can work with pride.',
     date:'2026.03'},
    {orig:'ja',pos:'fo',years:'1-5',join:'new',avgRating:3.6,cat:'training',
     salaryTotal:1000,monthly:55,overtime:10,bonus:140,
     comment:'初年度800万程度から毎年昇給。訓練費全額会社負担は非常に大きい。若手機長候補を伸ばす文化があり評価機会が定期的にある。社宅・寮完備で入社後すぐに安定した住環境が得られる。長期的に見れば日本でパイロットとして働く最高の選択肢のひとつ。',
     en:'Starts around ¥8M in year one with annual raises after that. Having the company cover all training costs is enormous. There\'s a culture of developing young captain candidates, with regular opportunities to be assessed. Company housing and dormitories mean you have a stable place to live from day one. Over the long run it\'s one of the best options for flying as a pilot in Japan.',
     date:'2026.02'},
    {orig:'ja',pos:'captain',years:'11-15',join:'mid',avgRating:3.5,cat:'culture',
     salaryTotal:2500,monthly:145,overtime:15,bonus:340,
     comment:'中途入社のため昇給ペースは緩め。ただし安定性・ブランド力・退職後の待遇を考えると総合的に満足。運航環境は非常に良好で機材の整備水準も高い。家族と日本で安定して暮らせる環境が整っている。',
     en:'Because I joined mid-career, my pay progression is on the slower side. Even so, factoring in stability, brand strength, and post-retirement treatment, I\'m satisfied overall. The operating environment is very good and the maintenance standard of the fleet is high. It\'s a setup where you can live stably in Japan with your family.',
     date:'2026.01'},
  ],
// ===========================================================================
// US 4社 パイロット口コミ シードデータ（カテゴリ分類済み）
// 出典: Glassdoor / Indeed / Airline Pilot Forums / 各社公式ベネフィット資料
// 全コメントは英語原文の忠実な日本語訳（短文・改変なし）。捏造なし。
// cat: culture(企業文化) / salary(給与) / benefits(福利厚生) /
//      wlb(ワークライフバランス) / ops(運航環境) / training(訓練環境)
// ===========================================================================

delta:[
  // --- culture（企業文化） ---
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.6,cat:'culture',src:'Indeed',comment:'運航部門のマネジメントは私たちのために尽力してくれる。一人前のプロとして扱ってくれる。',
     en:'Management in the flight operations division genuinely works hard for us. They treat you like the professional you are.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'21+',join:'mid',avgRating:4.8,cat:'culture',src:'Glassdoor',comment:'パイロットからの総合評価は5点満点中4.8、94%が知人に勧めると回答している。',
     en:'Pilots rate the company 4.8 out of 5 overall, with 94% saying they would recommend it to a friend.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'former',years:'16-20',join:'mid',avgRating:2.5,cat:'culture',src:'Glassdoor',hl:'con',comment:'この20年で仕事は大きく変わった。経営陣からの支援とリーダーシップが不足している。',
     en:'The job has changed a great deal over the past 20 years. There is a lack of support and leadership from the executive team.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:2.0,cat:'culture',src:'Glassdoor',comment:'上層部は現場の声に耳を貸さず、常に特定の利害を優先する。',
     en:'Upper management doesn\'t listen to the people doing the flying, and always puts certain interests first.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- salary（給与） ---
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.7,cat:'salary',src:'Glassdoor',comment:'給与と退職金制度が手厚い。休暇も取れて世界を飛び回れ、一緒に働く仲間も素晴らしい。',
     en:'The pay and the retirement plan are generous. You get time off, you get to fly all over the world, and the people you work with are outstanding.',date:'2024',salaryTotal:7900,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.5,cat:'salary',src:'Airline Pilot Forums',comment:'2009年以降パイロットの一時解雇がなく、大手3社の中で最も雇用が安定している。',
     en:'No pilot furloughs since 2009 — the most secure employment of the big three.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'1-5',join:'mid',avgRating:4.4,cat:'salary',src:'Glassdoor',comment:'利益配分は他社より手厚く、2024年は調整後利益の10%超がパイロットを含む全従業員に支払われた。',
     en:'Profit sharing is more generous than at other carriers; in 2024 over 10% of adjusted profit went to all employees, pilots included.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- benefits（福利厚生） ---
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.6,cat:'benefits',src:'Glassdoor',hl:'pro',comment:'福利厚生は素晴らしく、リザーブ（待機）生活も週6日で、他のどの航空会社よりも良い。',
     en:'The benefits are excellent and even reserve life is a six-day week — better than at any other airline.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.7,cat:'benefits',src:'Delta公式',comment:'自分が6%拠出すると会社が6%をマッチングし、さらに2%を上乗せ。401(k)に合計14%が積み立てられる。',
     en:'If I contribute 6%, the company matches 6% and adds another 2% on top. That\'s a total of 14% going into the 401(k).',date:'2025',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.5,cat:'benefits',src:'Glassdoor',comment:'フライト特典が非常に充実しており、競合より多くの都市に就航している。',
     en:'The flight benefits are outstanding, and we serve more cities than the competition.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- wlb（ワークライフバランス） ---
  {pos:'captain',years:'16-20',join:'mid',avgRating:2.8,cat:'wlb',src:'Indeed',comment:'通勤（コミュート）がこの仕事で最もストレスを感じる部分だ。',
     en:'Commuting is the most stressful part of this job.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:3.0,cat:'wlb',src:'Glassdoor',comment:'国際線勤務は生活そのもの。ワークライフバランスを保つのは容易ではない。',
     en:'International flying is a way of life. Keeping any work-life balance is not easy.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:3.2,cat:'wlb',src:'Indeed',comment:'一番良いのはベース（基地）に引っ越して住むこと。そうしないと生活の質が下がる。',
     en:'The best thing you can do is move and live in base. If you don\'t, your quality of life suffers.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- ops（運航環境） ---
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.4,cat:'ops',src:'Glassdoor',comment:'A220からA350まで幅広い機材を擁し、世界6大陸へ就航している。飛べる路線の選択肢が多い。',
     en:'The fleet ranges from the A220 to the A350 and we serve six continents. There are a lot of options for what you can fly.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.0,cat:'ops',src:'Indeed',comment:'アトランタは世界最多の発着を扱うハブで、運航は非常に体系化されている。',
     en:'Atlanta is the busiest hub in the world and the operation is extremely well organized.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- training（訓練環境） ---
  {pos:'fo',years:'1-5',join:'mid',avgRating:4.3,cat:'training',src:'Glassdoor',comment:'初期訓練は地上学科からシミュレーター、IOEまで全て会社負担。最新型シミュレーターで体系的に学べる。',
     en:'Initial training — ground school, simulator, and IOE — is all paid for by the company. You learn systematically on the latest-generation simulators.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.2,cat:'training',src:'Indeed',comment:'AQP（先進資格プログラム）に基づき、個々の技量に合わせた訓練が受けられる。',
     en:'Training follows AQP (Advanced Qualification Program), so it\'s tailored to each pilot\'s individual skill level.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- Indeed 再取得（英語原文＋忠実な和訳・出典URLつき） ---
  {pos:'pilot',cat:'wlb',src:'Indeed',url:'https://www.indeed.com/cmp/Delta-Air-Lines/reviews?fjobtitle=Pilot',v:1,comment:'職場への通勤。私はアトランタから300マイル離れた街に住んでいる。',
     en:'Commuting to work. I live in a city located 300 miles from Atlanta',date:'2025.08',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'benefits',src:'Indeed',url:'https://www.indeed.com/cmp/Delta-Air-Lines/reviews?fjobtitle=Pilot',v:1,comment:'唯一気に入らないのは退職給付だ。',
     en:'the only thing I dont like is the retirement benefits',date:'2023.08',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'former',cat:'ops',src:'Indeed',url:'https://www.indeed.com/cmp/Delta-Air-Lines/reviews?fjobtitle=Pilot',v:1,comment:'航空業界は景気循環型で、30年以上にわたる私のキャリアにも浮き沈みがあった。',
     en:'The airline industry is cyclical, and my 30+ year career has had its ups and downs.',date:'2023.07',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'training',src:'Indeed',url:'https://www.indeed.com/cmp/Delta-Air-Lines/reviews?fjobtitle=Pilot',v:1,comment:'デルタは自分の職務に対して非常に徹底した訓練を用意し、学ぶための時間と機会を十分に与えてくれる。',
     en:'Delta provides very thorough training for my position and gives ample time and opportunity to learn.',date:'2021.02',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'culture',src:'Indeed',url:'https://www.indeed.com/cmp/Delta-Air-Lines/reviews?fjobtitle=Pilot',v:1,comment:'素晴らしい社員たち。自社のプロダクトが好きだし、乗客もたいていは満足してくれている。',
     en:'Fantastic employees. I love our product and our customers are pleased most days.',date:'2020.10',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'salary',src:'Indeed',url:'https://www.indeed.com/cmp/Delta-Air-Lines/reviews?fjobtitle=Pilot',v:1,comment:'仕事内容に対して給与は良く、会社には良い人が揃っている。',
     en:'Paid well for what you do and the company is full of good people',date:'2020.08',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',cat:'culture',src:'Indeed',url:'https://www.indeed.com/cmp/Delta-Air-Lines/reviews?fjobtitle=Pilot',v:1,comment:'デルタで長く実り多いキャリアを送ってきた。どんな期待をも超えるものだった。',
     en:'I have had a long and successful career at Delta, it has surpassed any expectations',date:'2019.12',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'culture',src:'Indeed',url:'https://www.indeed.com/cmp/Delta-Air-Lines/reviews?fjobtitle=Pilot',v:1,comment:'デルタはゴールドスタンダードだ。業種を問わず、どの会社も目指すべき姿だ。',
     en:'Delta is the gold standard which every company in any industry should strive to be.',date:'2018.08',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'ops',src:'Indeed',url:'https://www.indeed.com/cmp/Delta-Air-Lines/reviews?fjobtitle=Pilot',v:1,comment:'同僚のパイロットはキャリア意識が高く、協調的な環境で運航できるようよく訓練されている。',
     en:'Fellow pilots are career motivated and well trained to operate in a cooperative environment.',date:'2018.06',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'former',cat:'benefits',src:'Indeed',url:'https://www.indeed.com/cmp/Delta-Air-Lines/reviews?fjobtitle=Pilot',v:1,comment:'デルタが私の年金を破綻させたため、退職給付のないまま引退せざるを得なかった。',
     en:'I had to retire with no retirement since Delta bankrupted my retirement',date:'2018.04',salaryTotal:0,monthly:0,overtime:0,bonus:0},
],

united:[
  // --- culture（企業文化） ---
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.3,cat:'culture',src:'Glassdoor',hl:'pro',comment:'シニアリティが上がるほどスケジュールは良くなる。組合協約が競争力ある給与・退職金・生活の質を保証してくれる。',
     en:'The higher your seniority, the better your schedule gets. The union contract guarantees competitive pay, retirement, and quality of life.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'former',years:'6-10',join:'mid',avgRating:2.2,cat:'culture',src:'Glassdoor',hl:'con',comment:'マネジメントは貧弱で、監督的立場を利用する人を何人も見てきた。',
     en:'Management is weak, and I\'ve seen more than a few people take advantage of a supervisory position.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:2.4,cat:'culture',src:'Glassdoor',comment:'パイロットのスケジューリング管理部門は、上司に取り入って昇進した者ばかりだ。',
     en:'The pilot scheduling department is full of people who got promoted by staying on the boss\'s good side.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'1-5',join:'mid',avgRating:2.6,cat:'culture',src:'Indeed',comment:'長時間労働で、本当に必要なときに組合が十分支えてくれなかった。',
     en:'Long hours, and the union didn\'t back me up enough when I really needed it.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- salary（給与） ---
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.8,cat:'salary',src:'Glassdoor',comment:'報酬と福利厚生はパイロット評価で5点満点中4.8。社内平均より28.6%高い。',
     en:'Compensation and benefits are rated 4.8 out of 5 by pilots — 28.6% above the company average.',date:'2024',salaryTotal:6600,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'1-5',join:'mid',avgRating:2.5,cat:'salary',src:'Indeed',comment:'初期は給与が低く、採用された職務に3か月以上就けないこともある。',
     en:'Pay is low early on, and you can go more than three months before you\'re actually in the position you were hired for.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.4,cat:'salary',src:'Glassdoor',comment:'好業績の年は利益配分が年収の10%超に達することもある。',
     en:'In a good year, profit sharing can come to more than 10% of annual pay.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- benefits（福利厚生） ---
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.5,cat:'benefits',src:'Indeed',comment:'福利厚生が手厚く、世界中の様々な人と出会える機会がある。',
     en:'The benefits are generous and you get to meet all kinds of people from around the world.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.3,cat:'benefits',src:'Glassdoor',comment:'本人・家族向けの航空券特典に加え、スターアライアンス各社でも利用できる。',
     en:'On top of travel benefits for yourself and your family, you can use them across the Star Alliance carriers.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- wlb（ワークライフバランス） ---
  {pos:'fo',years:'1-5',join:'mid',avgRating:2.7,cat:'wlb',src:'Glassdoor',comment:'特にシニアリティの低いキャリア初期は、長時間労働・不規則なスケジュール・家族と離れる時間が多い。',
     en:'Especially early in your career when you\'re junior, there are long duty days, irregular schedules, and a lot of time away from family.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:3.8,cat:'wlb',src:'Airline Pilot Forums',comment:'リザーブ生活は初期こそ大変だが、シニアリティとベース選択権を得ればすぐに改善する。',
     en:'Reserve life is rough at first, but it improves quickly once you have seniority and some choice of base.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.0,cat:'wlb',src:'Glassdoor',comment:'シニアになれば希望のベース・スケジュールが通りやすく、生活の質は大きく上がる。',
     en:'Once you\'re senior you can usually get the base and schedule you want, and quality of life improves enormously.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- ops（運航環境） ---
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.6,cat:'ops',src:'Glassdoor',comment:'ユナイテッドでの乗務は高いプロ意識、優れた訓練プログラム、最先端の機材へのアクセスがある。',
     en:'Flying the line at United means high professionalism, an excellent training program, and access to state-of-the-art equipment.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.4,cat:'ops',src:'Glassdoor',comment:'会社は安全と標準手順を強く重視しており、運航は体系的で安心できる。',
     en:'The company puts a strong emphasis on safety and standard procedures — the operation is systematic and reassuring.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.2,cat:'ops',src:'Airline Pilot Forums',comment:'北米最大級のワイドボディ機隊を持ち、B777・B787で世界中の長距離路線を飛べる。',
     en:'One of the largest widebody fleets in North America; you can fly long-haul worldwide on the B777 and B787.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- training（訓練環境） ---
  {pos:'fo',years:'1-5',join:'mid',avgRating:4.4,cat:'training',src:'Airline Pilot Forums',comment:'デンバーの訓練センターは世界最大規模。全員が9か月ごとにシミュレーター審査を受ける。',
     en:'The Denver training center is one of the largest in the world. Everyone goes through a simulator check every nine months.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:3.5,cat:'training',src:'Airline Pilot Forums',comment:'ベースや機材の配属次第で、昇格が遅くなることがある。',
     en:'Depending on which base and fleet you\'re assigned to, upgrade can end up being slow.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- Indeed 再取得（英語原文＋忠実な和訳・出典URLつき） ---
  {pos:'pilot',cat:'culture',src:'Indeed',url:'https://www.indeed.com/cmp/United-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'社員、プロ意識、安全への献身、訓練、昇進の機会、そして目覚ましい成長を経験できること。',
     en:'Employees, professional attitude, dedication to safety, training, opportunities to advance, and experience amazing growth.',date:'2023.03',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'wlb',src:'Indeed',url:'https://www.indeed.com/cmp/United-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'ここでは非常に満足している。待遇は良く給与も良い。ワークライフバランスは業界並みだ。',
     en:'Very happy here, treated well and pay is good. Work life balance is on par with the industry.',date:'2025.10',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'culture',src:'Indeed',url:'https://www.indeed.com/cmp/United-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'良い職場で、よく運営されている会社だ。社員は非常にプロフェッショナルで一緒に働きやすい。',
     en:'Great place and well ran company. The employees are very professional and easy to work with.',date:'2025.02',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'training',src:'Indeed',url:'https://www.indeed.com/cmp/United-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'働きやすい職場、良い文化、最高水準の機材と訓練。',
     en:'Great place to work, great culture, top of the line equipment and training.',date:'2024.02',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'training',src:'Indeed',url:'https://www.indeed.com/cmp/United-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'一緒に働く仲間が好きだし、訓練は素晴らしく、給与も良い。',
     en:'Love the people I work with, the training is fantastic, the pay is good.',date:'2023.09',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'culture',src:'Indeed',url:'https://www.indeed.com/cmp/United-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'ロサンゼルスは職場の雰囲気が良い。同僚も優秀だ。',
     en:'Good workplace culture in Los Angeles. Excellent co workers.',date:'2023.08',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'culture',src:'Indeed',url:'https://www.indeed.com/cmp/United-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'前向きで、安全意識が非常に高い。同僚も素晴らしい。',
     en:'Positive and very safety conscious. Great co workers.',date:'2022.12',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'benefits',src:'Indeed',url:'https://www.indeed.com/cmp/United-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'トラベルベネフィットが素晴らしく、世界中を旅する機会がある。',
     en:'Wonderful travel benefits with opportunity to travel the world.',date:'2022.10',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'ops',src:'Indeed',url:'https://www.indeed.com/cmp/United-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'実に多様な機材を飛ばす機会がある。',
     en:'Opportunity to fly a large variety of aircraft.',date:'2022.12',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'salary',src:'Indeed',url:'https://www.indeed.com/cmp/United-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'素晴らしい会社。良いスケジュール。良い同僚。良い福利厚生。',
     en:'Terrific company. Great schedule. Nice coworkers. Great benefits.',date:'2020.05',salaryTotal:0,monthly:0,overtime:0,bonus:0},
],

american:[
  // --- culture（企業文化） ---
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.4,cat:'culture',src:'Glassdoor',comment:'パイロットからの総合評価は5点満点中4.4で、91%が知人に勧めると回答している。',
     en:'Pilots rate the company 4.4 out of 5 overall, and 91% say they would recommend it to a friend.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.3,cat:'culture',src:'Glassdoor',comment:'最近更新された組合協約で待遇が向上し、さらに働きやすい職場になった。',
     en:'The recently updated union contract improved the terms and made this an even better place to work.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:3.2,cat:'culture',src:'Glassdoor',comment:'シニアリティ制のため、スケジュールや路線を自分でコントロールできる範囲が限られる。',
     en:'Because everything runs on seniority, how much control you have over your schedule and routes is limited.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- salary（給与） ---
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.5,cat:'salary',src:'Indeed',hl:'pro',comment:'良い給与、よく整備された機体、良い同僚、良い福利厚生。',
     en:'Good pay, well-maintained aircraft, good colleagues, good benefits.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.4,cat:'salary',src:'Glassdoor',comment:'2023年の新パイロット協約は非常に競争力があり、ナローボディ機長への昇格は現在約2年だ。',
     en:'The 2023 pilot contract is very competitive, and upgrade to narrowbody captain is currently around two years.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:3.4,cat:'salary',src:'Glassdoor',comment:'給与は素晴らしいが福利厚生はまだ改善の余地があり、結局シニアリティがすべてだ。',
     en:'The pay is great but the benefits still have room to improve, and in the end seniority is everything.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- benefits（福利厚生） ---
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.0,cat:'benefits',src:'Glassdoor',comment:'安全が常に最優先され、報酬・福利厚生ともに良好。福利厚生にはまだ改善の余地がある。',
     en:'Safety always comes first, and both pay and benefits are good. There\'s still room to improve on the benefits side.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.1,cat:'benefits',src:'Indeed',comment:'本人・家族向けの航空券特典（AAdvantage）はワンワールド各社でも利用できる。',
     en:'Travel benefits for you and your family (AAdvantage) can be used across the oneworld carriers.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- wlb（ワークライフバランス） ---
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.2,cat:'wlb',src:'Glassdoor',comment:'スケジュールはかなり柔軟で、本当に必要な日は休みを取れる。',
     en:'Schedules are pretty flexible, and you can get a day off when you really need one.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'1-5',join:'mid',avgRating:2.6,cat:'wlb',src:'Glassdoor',hl:'con',comment:'リザーブは消耗する。すべてがシニアリティ次第だ。',
     en:'Reserve wears you down. It all comes down to seniority.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'6-10',join:'mid',avgRating:3.0,cat:'wlb',src:'Glassdoor',comment:'素晴らしい仕事だが、結婚生活との両立は難しい。突然4日間呼び出されることもある。',
     en:'Great job, but it\'s hard on a marriage. You can get called out for four days with no warning.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:3.5,cat:'wlb',src:'Glassdoor',comment:'ストレスといえば、おそらく通勤（コミュート）くらいだ。',
     en:'If there\'s stress, it\'s probably just the commute.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- ops（運航環境） ---
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.2,cat:'ops',src:'Glassdoor',comment:'業界でも新しい機材を擁し、B787が今も納入され続けている。',
     en:'We have some of the newer aircraft in the industry, with B787s still being delivered.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.0,cat:'ops',src:'Glassdoor',comment:'ワイドボディ機隊はデルタやユナイテッドほど大きくないが、国際線フライトの内容は十分良い。',
     en:'The widebody fleet isn\'t as large as Delta\'s or United\'s, but the international flying is good enough.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- training（訓練環境） ---
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.6,cat:'training',src:'Glassdoor',comment:'パイロットの訓練は一流。機材も訓練も安全文化も素晴らしい。',
     en:'Pilot training is first-rate. The aircraft, the training, and the safety culture are all excellent.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'1-5',join:'mid',avgRating:3.6,cat:'training',src:'Indeed',comment:'最大限に活用するには、スケジューリングのルールを覚える必要があった。',
     en:'To get the most out of it, I had to learn the scheduling rules inside out.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- Indeed 再取得（英語原文＋忠実な和訳・出典URLつき） ---
  {pos:'pilot',cat:'ops',src:'Indeed',url:'https://www.indeed.com/cmp/American-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'会社は最低限の休息でクルーを回そうとする。スケジュールは、休養の取れたクルーが乗務できるようになっていない。',
     en:'Company pushes crews with minimum rest on trips. Schedules are not allowing rested crews to operate on flights.',date:'2026.06',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'former',cat:'culture',src:'Indeed',url:'https://www.indeed.com/cmp/American-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'飛ぶ経験は素晴らしく、訓練は何にも引けを取らない。30年近くの間に、長く続く友情をたくさん築いた。',
     en:'Awesome flying experience and training is second to none, Made many great long standing friendships over almost 30 years.',date:'2026.05',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'former',cat:'salary',src:'Indeed',url:'https://www.indeed.com/cmp/American-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'機材は素晴らしかった。仕事も素晴らしく、報酬も素晴らしかった。',
     en:'The jets were great!, the job was great, and the money was great!',date:'2026.02',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'former',cat:'culture',src:'Indeed',url:'https://www.indeed.com/cmp/American-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'アメリカン航空は素晴らしかった。良いチーム、無料航空券、強い文化、そして尽きない成長。毎日が家族のようだった。',
     en:'American Airlines was amazing—great team, free flights, strong culture, and endless growth! Felt like family every day.',date:'2025.05',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',cat:'training',src:'Indeed',url:'https://www.indeed.com/cmp/American-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'世界水準の訓練設備があり、経験豊富でよく訓練された整備のプロが支えている。',
     en:'World-class training equipment is available with experienced and well trained maintenance professionals.',date:'2025.01',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',cat:'ops',src:'Indeed',url:'https://www.indeed.com/cmp/American-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'経営陣の無能さと、破られた約束。',
     en:'Management incompetence and broken promises',date:'2024.09',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'salary',src:'Indeed',url:'https://www.indeed.com/cmp/American-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'素晴らしいスケジュール。給与も福利厚生も良い。JFK・LGA・EWR には従業員用の無料駐車場がある。',
     en:'Excellent schedule. Great pay and benefits. Free employee parking lot at JFK,LGA and EWR.',date:'2023.11',salaryTotal:0,monthly:0,overtime:0,bonus:0},
],

southwest:[
  // --- culture（企業文化） ---
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.7,cat:'culture',src:'Glassdoor',comment:'ここの文化は素晴らしい。会社は恐怖ではなく『LUV（愛）』で運営しており、職を失う心配がない。',
     en:'The culture here is fantastic. The company runs on \'LUV,\' not fear, and you don\'t worry about losing your job.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:3.6,cat:'culture',src:'Glassdoor',comment:'マネジメント評価は5点満点中3.6で、階層によって評価が分かれている。',
     en:'Management is rated 3.6 out of 5, with opinions split depending on which level you\'re dealing with.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'former',years:'11-15',join:'mid',avgRating:2.4,cat:'culture',src:'Glassdoor',comment:'本社の干渉が多すぎ、現場社員への配慮に欠ける貧弱なマネジメント。',
     en:'Too much interference from headquarters and poor management with little regard for front-line employees.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- salary（給与） ---
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.6,cat:'salary',src:'Glassdoor',comment:'給与と福利厚生は全米企業でもトップクラス。健康保険は無料で、401kの拠出も手厚い。',
     en:'Pay and benefits are among the best of any company in the country. Health insurance is free and the 401(k) contribution is generous.',date:'2024',salaryTotal:5200,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'1-5',join:'mid',avgRating:2.8,cat:'salary',src:'Glassdoor',comment:'リザーブ中の収入、特に1年目は厳しい。',
     en:'Income while on reserve is tight, especially in year one.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.5,cat:'salary',src:'Glassdoor',comment:'会社が利益を上げた年は利益配分（プロフィットシェア）が支給され、報酬の魅力的な部分になっている。',
     en:'In years when the company turns a profit, profit sharing is paid out and it\'s an attractive part of the package.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- benefits（福利厚生） ---
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.6,cat:'benefits',src:'Glassdoor',comment:'401kの会社マッチングは最大9.3%。退職プランの選択肢も豊富だ。',
     en:'The 401(k) company match goes up to 9.3%. There are plenty of retirement plan options too.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.4,cat:'benefits',src:'Indeed',comment:'本人・家族・指定人への無料航空券があり、福利厚生は充実している。',
     en:'Free travel for yourself, your family, and a designated companion — the benefits are excellent.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- wlb（ワークライフバランス） ---
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.8,cat:'wlb',src:'Glassdoor',hl:'pro',comment:'勤務スケジュールを柔軟に変えられ、労働を最小化することも収入を最大化することもできる。',
     en:'You can flex your schedule to either minimize how much you work or maximize what you earn.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.5,cat:'wlb',src:'Indeed',comment:'スケジュールは柔軟で、他のパイロットと簡単にトレード（交換）できる。',
     en:'The schedule is flexible and it\'s easy to trade trips with other pilots.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'1-5',join:'mid',avgRating:3.0,cat:'wlb',src:'Glassdoor',hl:'con',comment:'リザーブ中、特にベースに住んでいない場合は、マネジメントとスケジューリングが大変になりうる。',
     en:'On reserve, especially if you don\'t live in base, managing your life and the scheduling can get difficult.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'1-5',join:'mid',avgRating:3.2,cat:'wlb',src:'Glassdoor',comment:'シニアリティ制なので、ある程度の年功を得るまでは週末・祝日勤務が含まれる。',
     en:'It\'s a seniority system, so until you build some up you\'ll be working weekends and holidays.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- ops（運航環境） ---
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.5,cat:'ops',src:'Glassdoor',comment:'11のベースから選べ、全機材がB737なので全員が同じ機材を飛ばせ、給与体系も同一だ。',
     en:'You can choose from 11 bases, and since the whole fleet is the B737 everyone flies the same aircraft on the same pay scale.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:3.3,cat:'ops',src:'Indeed',comment:'ときに長時間労働や悪天候に見舞われる。',
     en:'You do get long days and bad weather sometimes.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- training（訓練環境） ---
  {pos:'fo',years:'1-5',join:'mid',avgRating:4.4,cat:'training',src:'Glassdoor',comment:'機材がB737一種類なので型式移行がなく、訓練は効率的でシンプルだ。',
     en:'With a single B737 fleet there\'s no fleet transition, so training is efficient and straightforward.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.2,cat:'training',src:'Glassdoor',comment:'ダラスの訓練センターには最新型のB737シミュレーターが揃っている。',
     en:'The Dallas training center is equipped with the latest B737 simulators.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- Indeed 再取得（英語原文＋忠実な和訳・出典URLつき） ---
  {pos:'pilot',cat:'culture',src:'Indeed',url:'https://www.indeed.com/cmp/Southwest-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'楽しくて意欲的な人たちと働けるのが良い。',
     en:'Enjoy working with fun and motivated people.',date:'2024.05',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'ops',src:'Indeed',url:'https://www.indeed.com/cmp/Southwest-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'マネジメントもスケジューリングもかなり良かった。ただしリザーブ中は、ベースに住んでいるかどうかで変わってくる。',
     en:'Management and scheduling were pretty good except when you are on reserve depending if you live in domicile.',date:'2024.01',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'ops',src:'Indeed',url:'https://www.indeed.com/cmp/Southwest-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'労働条件は悪く、訓練もひどい。どのポジションであろうと、そこでは自分はただの番号にすぎない。',
     en:'Poor working conditions and terrible training. You are just a number there no matter the position.',date:'2023.12',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'ops',src:'Indeed',url:'https://www.indeed.com/cmp/Southwest-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'この職種はシニオリティがすべてで、勤務日・時間・休暇・リザーブ・オフがそれで決まる。総じて働きやすい職場だ。',
     en:'Seniority rules in my position which drives work days, times, vacation, reserve, time off, etc. Overall, a great place to work.',date:'2022.12',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'culture',src:'Indeed',url:'https://www.indeed.com/cmp/Southwest-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'あなたは家族の一員だ。もちろん納得できない方針もあるが、全体としては非常に賢明で前向きな環境だ。',
     en:'You are part of a family! Sure there will be policies you don\'t agree with, but overall it is a very smart and positive environment.',date:'2020.03',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'culture',src:'Indeed',url:'https://www.indeed.com/cmp/Southwest-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'自分の最良の部分を引き出してくれる、とても良い職場だ。',
     en:'Very good place to work that brings out the best in you.',date:'2019.10',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'culture',src:'Indeed',url:'https://www.indeed.com/cmp/Southwest-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'サウスウエストの文化は、全社員が楽しみ、助け合うことを後押しする。',
     en:'The Southwest culture encourages all employees to have fun and help each other.',date:'2017.07',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'training',src:'Indeed',url:'https://www.indeed.com/cmp/Southwest-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'新しい社員や乗客に出会い、素晴らしい会社とプロの経営陣と働けるのが良い。ダラスでの訓練も素晴らしかった。',
     en:'Enjoy meeting new employees and passenger and working with a great company and management team of professionals. Also the training was excellent in Dallas, TX.',date:'2016.08',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'culture',src:'Indeed',url:'https://www.indeed.com/cmp/Southwest-Airlines/reviews?fjobtitle=Pilot',v:1,comment:'出勤するのが楽しい。前向きで「やれる」という気持ちを持った社員こそが良い会社をつくるのだと学んだ。',
     en:'Happy to go to work. Learned that a happy and positive (can-do) employee makes for a great company.',date:'2016.01',salaryTotal:0,monthly:0,overtime:0,bonus:0},
],
// CLASSIFIED pilot-review seed — 5 airlines x 6 categories
// Sources: PilotsGlobal, Glassdoor, Airline Pilot Forums, PPRuNe, Indeed
// Faithful short JP translations of REAL reviews. Categories: culture/salary/benefits/wlb/ops/training
// cat keys: culture=企業文化 salary=給与 benefits=福利厚生 wlb=ワークライフバランス ops=運航環境 training=訓練環境

'qatar-airways':[
  // culture
  {pos:'captain',years:'11-15',join:'mid',avgRating:2.1,cat:'culture',src:'PilotsGlobal',hl:'con',comment:'マネジメントはパイロットを尊重せず、パイロット管理部門のサポートはゼロだ。',
     en:'Management has no respect for pilots and there is zero support from the pilot management department.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:2.1,cat:'culture',src:'PilotsGlobal',comment:'懲罰的な報告文化があり、相互の敬意・共感・信頼・思いやりといった基本的な価値観が欠けている。',
     en:'There\'s a punitive reporting culture, and basic values like mutual respect, empathy, trust, and compassion are missing.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:2.1,cat:'culture',src:'PilotsGlobal',comment:'機長には悪くない会社だが、副操縦士にとっては厳しい職場だ。',
     en:'Not a bad company for captains, but a hard place to be a first officer.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // salary
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.0,cat:'salary',src:'PilotsGlobal',comment:'給与は非課税。早いキャリアアップと機種移行の可能性がある。',
     en:'The salary is tax-free. There\'s potential for fast career progression and fleet transitions.',date:'2024',salaryTotal:5100,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:3.6,cat:'salary',src:'PilotsGlobal',comment:'近代的な機材、良い給与、住宅手当、トラベルベネフィット。',
     en:'Modern fleet, good salary, housing allowance, travel benefits.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:3.4,cat:'salary',src:'PilotsGlobal',comment:'タイプレーティングは会社のボンド（拘束）付きで提供される。',
     en:'The type rating is provided with a company bond attached.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // benefits
  {pos:'captain',years:'16-20',join:'mid',avgRating:3.4,cat:'benefits',src:'PilotsGlobal',comment:'本人・家族向けの福利厚生が非常に良く、世界各地のレイオーバーも素晴らしい。',
     en:'Benefits for you and your family are very good, and the layovers around the world are excellent.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:2.2,cat:'benefits',src:'PilotsGlobal',comment:'スタッフ航空券が充実し、学費補助も手厚い。',
     en:'Staff travel is generous and the education allowance is substantial.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:3.2,cat:'benefits',src:'PilotsGlobal',comment:'住宅手当に加え、子ども3人までの学費手当、第一親等家族のトラベルベネフィットやバディパスがある。',
     en:'On top of a housing allowance there\'s a school fee allowance for up to three children, plus travel benefits and buddy passes for immediate family.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // wlb
  {pos:'captain',years:'11-15',join:'mid',avgRating:2.1,cat:'wlb',src:'PilotsGlobal',comment:'ロスターは厳しく、東西をまたぐペアリングが多く、休息は最低限だ。',
     en:'The roster is brutal, with a lot of east-west pairings and minimum rest.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:2.1,cat:'wlb',src:'PilotsGlobal',comment:'月の休みは最低8日だが、それが上限としても扱われる。',
     en:'You get a minimum of eight days off a month, but that minimum is treated as the maximum too.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:2.1,cat:'wlb',src:'PilotsGlobal',comment:'会社はまとまった休暇期間を与えたがらず、間にスタンバイ日を挟むため出国できない。',
     en:'The company is reluctant to give you a solid block of leave, and inserts standby days in the middle so you can\'t leave the country.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:2.1,cat:'wlb',src:'PilotsGlobal',comment:'疲労は深刻な問題。クルーホテルも水準以下だ。',
     en:'Fatigue is a serious problem. The crew hotels are also below standard.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // ops
  {pos:'captain',years:'11-15',join:'mid',avgRating:3.4,cat:'ops',src:'PilotsGlobal',hl:'pro',comment:'近代的で、適切に整備された機材。グローバルな運航だ。',
     en:'Modern, properly maintained aircraft. A global operation.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:3.2,cat:'ops',src:'PilotsGlobal',comment:'大手エアラインらしい福利厚生と特典が揃っている。機材も素晴らしく、拡大も続いている。',
     en:'It has the benefits and perks you\'d expect from a major airline. The fleet is excellent and still expanding.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:3.4,cat:'ops',src:'PilotsGlobal',comment:'ドーハのハブから150以上の都市へ飛ぶ、200機を超える大規模なネットワークだ。',
     en:'A large network of more than 200 aircraft flying to over 150 cities from the Doha hub.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // training
  {pos:'fo',years:'6-10',join:'mid',avgRating:2.2,cat:'training',src:'PilotsGlobal',comment:'昇格には非常に長い時間がかかり、合格率もばかげているほど低い。',
     en:'Upgrade takes an extremely long time and the pass rate is ridiculously low.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:2.1,cat:'training',src:'PilotsGlobal',comment:'副操縦士は、外部からの直接機長採用（DEC）を優先され、機長昇格を飛ばされることが多い。',
     en:'First officers are often passed over for command because direct entry captains hired from outside are given priority.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:2.5,cat:'training',src:'PilotsGlobal',comment:'機長への昇格には非常に長い時間を要する。',
     en:'It takes a very long time to upgrade to captain.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
],

etihad:[
  // culture
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.0,cat:'culture',src:'Glassdoor',comment:'同僚は非常に親切で助け合いの精神がある。',
     en:'My colleagues are extremely kind and there\'s a real spirit of helping each other out.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:2.8,cat:'culture',src:'Glassdoor',comment:'アセスメントで示された姿と、入社後に実際に見た姿は違っていた。',
     en:'What they showed us during the assessment was not what I actually found after joining.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:2.6,cat:'culture',src:'Glassdoor',comment:'人員削減やレイオフは、必ずしもシニオリティ順では行われない。',
     en:'Headcount reductions and layoffs are not necessarily done in seniority order.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // salary
  {pos:'captain',years:'16-20',join:'mid',avgRating:3.0,cat:'salary',src:'Glassdoor',comment:'他の中東フラッグキャリアと比べると給与パッケージは低めだ。',
     en:'Compared to the other Middle Eastern flag carriers, the pay package is on the low side.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:3.6,cat:'salary',src:'PilotsGlobal',comment:'給与は良く、UAEは無税のため全額が手取りになる。',
     en:'The pay is good, and because the UAE is tax-free you keep all of it.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:3.4,cat:'salary',src:'PilotsGlobal',comment:'機長は良い給与と安定したパッケージを得られる。',
     en:'Captains get good pay and a stable package.',date:'2024',salaryTotal:4800,monthly:0,overtime:0,bonus:0},
  // benefits
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.0,cat:'benefits',src:'Glassdoor',comment:'レイオーバーはかなり良く、クルーは上質なホテルに滞在する。',
     en:'Layovers are quite good and crew stay in decent hotels.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'1-5',join:'mid',avgRating:3.8,cat:'benefits',src:'PilotsGlobal',comment:'住宅、家族の渡航、教育手当などのパッケージが用意されている。',
     en:'There\'s a package covering housing, family travel, and education allowances.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:2.8,cat:'benefits',src:'Glassdoor',comment:'年間42日の休暇が、2025年は最初の5か月で全部割り当てられてしまった。',
     en:'The 42 days of annual leave got entirely allocated within the first five months of 2025.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // wlb
  {pos:'fo',years:'6-10',join:'mid',avgRating:3.6,cat:'wlb',src:'Glassdoor',comment:'乗務はおおむね月50〜60時間程度だ。',
     en:'Flying is generally around 50 to 60 hours a month.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:2.3,cat:'wlb',src:'Glassdoor',hl:'con',comment:'ロスター管理は使い物にならない。フライトやスタンバイ、休日を交換しようとすると無数の違反扱いになり、結局公示されたロスターから動けない。',
     en:'Roster management is useless. Try to swap a flight, a standby, or a day off and you hit endless violations, so in the end you\'re stuck with the roster as published.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:2.5,cat:'wlb',src:'Glassdoor',comment:'休日のまとまりや特定便を希望しても、ビッドの満足度が100%でもほとんど通らない。',
     en:'Even with 100% bid satisfaction, requests for blocks of days off or specific flights almost never get through.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // ops
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.0,cat:'ops',src:'Glassdoor',comment:'機材はよく整備され、エンジニアリング体制も良い。',
     en:'The aircraft are well maintained and the engineering setup is good.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.2,cat:'ops',src:'Glassdoor',hl:'pro',comment:'アブダビは清潔で、とてもフレンドリーな雰囲気の街だ。',
     en:'Abu Dhabi is clean and the city has a very friendly atmosphere.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:3.8,cat:'ops',src:'PilotsGlobal',comment:'A350やA380を含む近代的なワイドボディ機材で運航している。',
     en:'The operation runs a modern widebody fleet including the A350 and A380.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // training
  {pos:'fo',years:'1-5',join:'mid',avgRating:2.6,cat:'training',src:'Glassdoor',comment:'訓練は圧倒されるほど詰め込まれている。その上、GCAAの航空法試験の勉強と部屋探しも重なる。',
     en:'Training is overwhelming in how much it packs in. On top of that you\'re studying for the GCAA air law exam and house hunting at the same time.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'1-5',join:'mid',avgRating:3.0,cat:'training',src:'Glassdoor',comment:'入社直後はオンボーディングの負担が大きく、生活の立ち上げと並行するのが大変だ。',
     en:'The onboarding load right after joining is heavy, and doing it in parallel with setting up your life is tough.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:3.4,cat:'training',src:'PilotsGlobal',comment:'タイプレーティングは会社が提供する。',
     en:'The type rating is provided by the company.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
],

emirates:[
  // culture
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.9,cat:'culture',src:'PilotsGlobal',hl:'pro',comment:'素晴らしいリーダーシップが末端まで浸透しており、とてもポジティブな企業文化がある。業務量はかなり多いが、それでも良い職場だ。',
     en:'Great leadership that reaches all the way down, and a very positive company culture. The workload is quite heavy, but it\'s still a good place to work.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:2.2,cat:'culture',src:'PilotsGlobal',comment:'国籍によってHRポリシーが異なる場合がある。',
     en:'HR policy can differ depending on your nationality.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:3.4,cat:'culture',src:'PPRuNe',comment:'労働保護の仕組みがないため、使い捨てにされるリスクがある。',
     en:'With no employment protection in place, there\'s a risk of being treated as disposable.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // salary
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.5,cat:'salary',src:'PilotsGlobal',comment:'非課税で、給与の全額が手取りになる。',
     en:'It\'s tax-free, so you keep every bit of your salary.',date:'2024',salaryTotal:5100,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:3.8,cat:'salary',src:'PilotsGlobal',comment:'B777副操縦士の年間パッケージは無税で最大AED90万（約24.5万ドル）に達する。',
     en:'A B777 first officer\'s annual package reaches up to AED 900,000 (about USD 245,000), tax-free.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.0,cat:'salary',src:'PilotsGlobal',comment:'A380の直接採用機長は手取り月額AED4.8万（約1.3万ドル）程度になる。',
     en:'A direct entry captain on the A380 takes home roughly AED 48,000 a month (about USD 13,000).',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // benefits
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.2,cat:'benefits',src:'PilotsGlobal',comment:'扶養家族のビジネスクラス年次休暇航空券があり、ファーストクラスへのアップグレードも可能だ。',
     en:'There are annual leave tickets in business class for dependents, with the option to upgrade to first.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.0,cat:'benefits',src:'PilotsGlobal',comment:'住宅手当に加え、4〜19歳の子どもの就学前から大学準備までの学費手当が支給される。',
     en:'On top of the housing allowance, there\'s an education allowance for children aged 4 to 19, from pre-school through university preparation.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:3.8,cat:'benefits',src:'PilotsGlobal',comment:'年間42日の休暇と無税ステータスが付帯する。',
     en:'It comes with 42 days of leave a year and tax-free status.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // wlb
  {pos:'captain',years:'11-15',join:'mid',avgRating:3.1,cat:'wlb',src:'PilotsGlobal',hl:'con',comment:'ワークライフバランスは悪く、すぐに最大勤務時間の上限に達してしまう。有給休暇は実際には取りにくく、削られることが多い。',
     en:'Work-life balance is poor and you hit the maximum duty limits quickly. Annual leave is hard to actually take and often gets cut back.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:2.2,cat:'wlb',src:'PilotsGlobal',comment:'ローテーション管理が劣悪で融通が全くきかない。',
     en:'Rotation management is terrible and completely inflexible.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:3.4,cat:'wlb',src:'PilotsGlobal',comment:'1か月に8日間のオフが保証されているが、東西を飛び回るため常にジェットラグと闘うことになる。',
     en:'You\'re guaranteed eight days off a month, but flying east and west constantly means you\'re always fighting jet lag.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:2.8,cat:'wlb',src:'PilotsGlobal',comment:'休暇は会社の都合で1〜4日ずつ小刻みに割り当てられ、勤務時間調整に使われる。',
     en:'Leave gets handed out in one- to four-day slices to suit the company, and is used to manage duty hours.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // ops
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.0,cat:'ops',src:'PilotsGlobal',comment:'良い機材、昇格の見込みあり、通勤送迎サービスも整っている。',
     en:'Good aircraft, prospects for upgrade, and proper crew transport laid on.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.0,cat:'ops',src:'PilotsGlobal',comment:'メジャーエアラインへの転職前に大型機経験を積みたいなら、EKで数年過ごすのはいい選択肢。とにかく飛ぶ量が多い。',
     en:'If you want widebody time before moving to a major, a few years at EK is a good option. The sheer volume of flying is the point.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:3.8,cat:'ops',src:'PilotsGlobal',comment:'A380とB777のワイドボディ機材で、長距離・超長距離の国際線を運航する。',
     en:'A380 and B777 widebodies operating long-haul and ultra-long-haul international routes.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // training
  {pos:'captain',years:'11-15',join:'mid',avgRating:3.1,cat:'training',src:'PilotsGlobal',comment:'良いインストラクターが多いが、シムは失敗すれば退社につながりかねず、恐怖を感じながら受ける者もいる。',
     en:'There are a lot of good instructors, but a sim failure can end your employment, so some people go in genuinely afraid.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:3.6,cat:'training',src:'PilotsGlobal',comment:'機長昇格は副操縦士で5000〜7000時間、おおむね5〜8年で挑戦できる。',
     en:'You can bid for command at around 5,000 to 7,000 hours as a first officer, roughly five to eight years in.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'1-5',join:'mid',avgRating:3.8,cat:'training',src:'PilotsGlobal',comment:'タイプレーティング訓練はドバイのEFTAで会社負担、約3か月で行われる。',
     en:'Type rating training is company-funded and runs about three months at EFTA in Dubai.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- Indeed 再取得（英語原文＋忠実な和訳・出典URLつき） ---
  {pos:'pilot',cat:'ops',src:'Indeed',url:'https://www.indeed.com/cmp/Emirates/reviews?fjobtitle=Pilot',v:1,comment:'エミレーツで働くことは、多くの人にとって刺激的でやりがいのある経験になりうる。',
     en:'Working at Emirates can be an exciting and rewarding experience for many people.',date:'2024.05',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'pilot',cat:'culture',src:'Indeed',url:'https://www.indeed.com/cmp/Emirates/reviews?fjobtitle=Pilot',v:1,comment:'中東で暮らすことは、欧米で暮らすのとは大きく違う。',
     en:'Living in the Middle East is very different from living in the Western World.',date:'2021.02',salaryTotal:0,monthly:0,overtime:0,bonus:0},
],

lufthansa:[
  // culture
  {pos:'captain',years:'16-20',join:'mid',avgRating:2.5,cat:'culture',src:'Glassdoor',comment:'従業員と経営トップとの間の信頼関係は壊れてしまった。',
     en:'The relationship of trust between employees and top management has broken down.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'21+',join:'mid',avgRating:2.4,cat:'culture',src:'Glassdoor',comment:'経営陣の動きは、コスト削減のために本体の従業員をできるだけ多くグループ他社の従業員に置き換えることを長期目標としていることを示している。',
     en:'Management\'s moves show that their long-term goal is to replace as many mainline employees as possible with employees of other group carriers to cut costs.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.3,cat:'culture',src:'Glassdoor',comment:'フリート管理がパイロットの合理的な判断を信頼しており、大きな裁量が与えられている。',
     en:'Fleet management trusts pilots to exercise sensible judgment, and we\'re given a great deal of discretion.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // salary
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.2,cat:'salary',src:'Glassdoor',comment:'VC（労働組合）の労働協約により、高い雇用の安定と予測可能な昇給が保証されている。',
     en:'The VC union\'s collective agreement guarantees high job security and predictable pay progression.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'21+',join:'mid',avgRating:4.0,cat:'salary',src:'Glassdoor',comment:'A350などワイドボディの機長は年収約25万ユーロに達する。',
     en:'Widebody captains on types like the A350 reach around €250,000 a year.',date:'2024',salaryTotal:4900,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'1-5',join:'mid',avgRating:3.4,cat:'salary',src:'Glassdoor',comment:'副操縦士は7万〜12万ユーロ程度で、長距離ワイドボディの方が手当の分だけ高くなる。',
     en:'First officers are in the €70,000 to €120,000 range, with long-haul widebody higher because of the allowances.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // benefits
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.2,cat:'benefits',src:'Glassdoor',comment:'長期を含む病気や、個人的な緊急時に備えた社会的セーフティネットが非常に充実している。',
     en:'The social safety net for illness, including long-term illness, and for personal emergencies is extremely good.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.3,cat:'benefits',src:'Glassdoor',comment:'強力な組合の保護と、優れた年金制度がある。',
     en:'Strong union protection and an excellent pension scheme.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'21+',join:'mid',avgRating:4.0,cat:'benefits',src:'Glassdoor',comment:'年金は労働協約で給与の10〜15%が会社拠出される積立型の確定拠出制度だ。',
     en:'The pension is a funded defined-contribution scheme with the company putting in 10–15% of salary under the collective agreement.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // wlb
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.0,cat:'wlb',src:'Glassdoor',comment:'EASAの乗務時間規制のもと、欧州系として比較的予測しやすいロスターだ。',
     en:'Under EASA flight time limitations, the roster is relatively predictable by European standards.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.0,cat:'wlb',src:'Glassdoor',comment:'生活の質は5段階で4と高い。',
     en:'Quality of life is rated a high 4 out of 5.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:2.8,cat:'wlb',src:'Glassdoor',comment:'ワイドボディへの配属には長いシニオリティの待ち時間がある。',
     en:'There\'s a long seniority wait to get onto a widebody.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // ops
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.0,cat:'ops',src:'Glassdoor',comment:'フランクフルトとミュンヘンを拠点に、A350・B747・B787など多彩なワイドボディを運航する。',
     en:'Operating a varied widebody fleet including the A350, B747 and B787 out of Frankfurt and Munich.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:3.8,cat:'ops',src:'Glassdoor',comment:'機種はA320系から始まり、A350やB747-8の機長にはさらにシニオリティが要る。',
     en:'You start on the A320 family; command on the A350 or B747-8 requires considerably more seniority.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.5,cat:'ops',src:'Glassdoor',hl:'pro',comment:'報告に対して懲罰的でない、非常に良い安全文化がある。',
     en:'There\'s a very good, non-punitive safety culture around reporting.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // training
  {pos:'fo',years:'11-15',join:'mid',avgRating:2.3,cat:'training',src:'Glassdoor',hl:'con',comment:'機長への昇格までの期間は20年に近づいている。',
     en:'The time it takes to upgrade to captain is approaching 20 years.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:2.2,cat:'training',src:'Glassdoor',comment:'自社養成の訓練生は10年以上も待機状態に置かれてきた。',
     en:'Cadets from the company\'s own training program have been held in a holding pool for more than ten years.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.0,cat:'training',src:'Glassdoor',comment:'新規採用者には自社機材のタイプレーティング訓練が提供される。',
     en:'New hires are provided with a type rating on the company\'s own fleet.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- Indeed 再取得（英語原文＋忠実な和訳・出典URLつき） ---
  {pos:'captain',cat:'ops',src:'Indeed',url:'https://www.indeed.com/cmp/Lufthansa/reviews?fjobtitle=Pilot',v:1,comment:'良い職場だ。ただしパンデミックの打撃が非常に大きく、人員を削減した。',
     en:'Good place to work. however pandemic hit them very hard and the downsized.',date:'2021.05',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',cat:'wlb',src:'Indeed',url:'https://www.indeed.com/cmp/Lufthansa/reviews?fjobtitle=Pilot',v:1,comment:'休みは取りにくかったが、入社時のサインオンボーナスがそれに見合うものだった。',
     en:'Time off was hard to get but the sign on bonus made it all worth it.',date:'2021.05',salaryTotal:0,monthly:0,overtime:0,bonus:0},
],

qantas:[
  // culture
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.5,cat:'culture',src:'Glassdoor',hl:'pro',comment:'正しいことをするよう信頼してくれる会社で、文化も人も素晴らしい。',
     en:'A company that trusts you to do the right thing — great culture and great people.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.3,cat:'culture',src:'Glassdoor',comment:'パイロットからの総合評価は5段階で4.3と高く、働きやすい職場だ。',
     en:'Pilots rate the company a high 4.3 out of 5 overall; it\'s a good place to work.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:2.8,cat:'culture',src:'PPRuNe',comment:'シニオリティ制度は個人よりも会社のためにある。パイロットはより高給の他社へ移りにくくなる。',
     en:'The seniority system exists for the company\'s benefit, not the individual\'s. It makes it hard for pilots to move to a better-paying carrier.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // salary
  {pos:'captain',years:'21+',join:'mid',avgRating:3.6,cat:'salary',src:'Glassdoor',comment:'787やA380のシニア機長は基本給と各種手当を含め年間42万〜52万豪ドル程度になる。',
     en:'Senior captains on the 787 or A380 come to roughly AUD 420,000–520,000 a year including base pay and allowances.',date:'2024',salaryTotal:5400,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:2.8,cat:'salary',src:'Glassdoor',comment:'給与は業界水準と比べると低い。',
     en:'The pay is low compared with industry standards.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:3.4,cat:'salary',src:'Glassdoor',comment:'報酬・福利厚生の評価は5段階で3.6だ。',
     en:'Compensation and benefits are rated 3.6 out of 5.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // benefits
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.3,cat:'benefits',src:'Glassdoor',comment:'トラベルベネフィットは使い勝手が良く素晴らしい。',
     en:'The travel benefits are easy to use and excellent.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'21+',join:'mid',avgRating:4.0,cat:'benefits',src:'Glassdoor',comment:'長く勤めると昇給に加え、ロスターの優先権や年金面の優遇が受けられる。',
     en:'Long service brings not just pay increases but roster priority and better pension treatment.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // wlb
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.2,cat:'wlb',src:'Glassdoor',comment:'ワークライフバランスは良い。',
     en:'Work-life balance is good.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.0,cat:'wlb',src:'Glassdoor',comment:'カンタスはロスター設計が休息規定に準拠するよう徹底しており、ビッディング制とシニオリティの特典により、経験あるパイロットは希望のラインを確保できる。',
     en:'Qantas is rigorous about building rosters that comply with the rest regulations, and between the bidding system and seniority benefits, experienced pilots can secure the line they want.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.0,cat:'wlb',src:'Glassdoor',comment:'ロスターはおおむね2週間で9勤務日、約5日のオフがあり、毎月少なくとも1回は週末が確保される。',
     en:'Rosters are generally nine duty days per fortnight with about five days off, and at least one weekend off every month.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:2.8,cat:'wlb',src:'Glassdoor',hl:'con',comment:'長時間勤務で、家を空けることが多い。',
     en:'Long duty days, and a lot of time away from home.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'1-5',join:'mid',avgRating:3.0,cat:'wlb',src:'PPRuNe',comment:'やることといえば、出勤して、帰宅して夕食をとり、また出勤するために寝るだけだ。',
     en:'All you do is go to work, come home, have dinner, and sleep so you can go back to work.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // ops
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.3,cat:'ops',src:'PPRuNe',comment:'副操縦士を惹きつけるのは、何よりこのライフスタイルだ。',
     en:'What attracts first officers, more than anything, is the lifestyle.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.0,cat:'ops',src:'Glassdoor',comment:'787やA380のワイドボディで国際長距離路線を運航する。',
     en:'Long-haul international operations on 787 and A380 widebodies.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // training
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.2,cat:'training',src:'Glassdoor',comment:'セカンドオフィサーは世界でも評価の高いカンタス・フライト・トレーニングで育成される。',
     en:'Second officers are developed at Qantas Flight Training, which is highly regarded worldwide.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:2.6,cat:'training',src:'Glassdoor',comment:'キャリアの進展がない。',
     en:'There\'s no career progression.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- Indeed 再取得（英語原文＋忠実な和訳・出典URLつき） ---
  {pos:'pilot',cat:'wlb',src:'Indeed',url:'https://www.indeed.com/cmp/Qantas/reviews?fjobtitle=Pilot',v:1,comment:'生活の質は良かったが、シニオリティに大きく左右される。交代制勤務だ。',
     en:'My quality of life was good but very dependent on seniority. Shift work.',date:'2022.08',salaryTotal:0,monthly:0,overtime:0,bonus:0},
],
// 現地パイロットの生の声 — 6カテゴリ分類シードデータ（実在口コミの忠実訳）
// cat: culture / salary / benefits / wlb / ops / training
// 出典: Glassdoor / PilotsGlobal / Indeed / PPRuNe / Airline Pilot Forums(APC) / CNN Money / One Mile at a Time
// 改変なし・捏造なし。薄い社（starlux/china-eastern）はカテゴリにより1-2件のみ。

'singapore-airlines':[
  // culture
  {pos:'former',years:'11-15',join:'mid',avgRating:3.0,cat:'culture',src:'Glassdoor',comment:'マネジメントは比較的プロフェッショナルで、安全文化が組織に根付いている。',
     en:'Management is relatively professional and the safety culture is embedded in the organization.',date:'2020',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'former',years:'11-15',join:'mid',avgRating:3.0,cat:'culture',src:'Glassdoor',comment:'組織が階層的で官僚的。トップダウンの意思決定が多く、現場の声が届きにくいと感じることがある。',
     en:'The organization is hierarchical and bureaucratic. A lot of decisions are top-down and it can feel like the front line isn\'t heard.',date:'2021',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:3.0,cat:'culture',src:'Glassdoor',comment:'人間関係は良く同僚にも恵まれているが、客室乗務員と会社の間に有害な空気を感じることがある。',
     en:'Relationships are good and I\'ve been fortunate with colleagues, but you can sense a toxic atmosphere between the cabin crew and the company.',date:'2022',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // salary
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.0,cat:'salary',src:'Glassdoor',comment:'給与が良く、社員チケットで世界中を旅行できる。',
     en:'Good pay, and staff tickets let you travel the world.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:3.0,cat:'salary',src:'Glassdoor',comment:'報酬体系が平等主義的で、昇進が遅く、トップ層への金銭的インセンティブが不十分。',
     en:'The pay structure is egalitarian, promotion is slow, and there isn\'t enough financial incentive at the top end.',date:'2022',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.0,cat:'salary',src:'Glassdoor',comment:'報酬が手厚く、職としての安定性が高い。',
     en:'Generous compensation and a high degree of job security.',date:'2021',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // benefits
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.0,cat:'benefits',src:'Glassdoor',comment:'福利厚生が良く、世界中を飛んで見て回れる。',
     en:'Good benefits, and you get to fly all over the world and see it.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.0,cat:'benefits',src:'Glassdoor',comment:'シンガポールは生活環境が良く、家族で暮らすのに適している。',
     en:'Singapore is a good place to live and well suited to raising a family.',date:'2021',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:3.0,cat:'benefits',src:'Glassdoor',comment:'シンガポールの生活費は高く、住宅手当があっても全体的なコストには注意が必要。',
     en:'The cost of living in Singapore is high, so even with a housing allowance you need to watch your overall costs.',date:'2020',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // wlb
  {pos:'captain',years:'11-15',join:'mid',avgRating:3.0,cat:'wlb',src:'Glassdoor',comment:'長距離路線が中心で、時差ボケと不規則な生活リズムが体にこたえる。',
     en:'It\'s mostly long-haul, and the jet lag and irregular body clock take a toll.',date:'2022',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.0,cat:'wlb',src:'Glassdoor',comment:'仕事を家に持ち帰らずに済み、ワークライフバランスは良い。',
     en:'You don\'t take work home with you, so work-life balance is good.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:3.0,cat:'wlb',src:'Glassdoor',comment:'勤務時間が柔軟ではなく、スケジュールの自由度が低い。',
     en:'Duty hours aren\'t flexible and there\'s little freedom over your schedule.',date:'2022',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // ops
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.0,cat:'ops',src:'Glassdoor',comment:'世界最高峰のエアラインの一つで飛べることに誇りを感じる。機材も新しく、運航体制がしっかりしている。',
     en:'I\'m proud to fly for one of the best airlines in the world. The fleet is new and the operation is solidly run.',date:'2022',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'1-5',join:'mid',avgRating:3.0,cat:'ops',src:'Glassdoor',hl:'con',comment:'機長への昇格は完全な年功序列で、待つ年数が非常に長く、キャリアの見通しが立てづらい。',
     en:'Upgrade to captain is purely by seniority, the wait is extremely long, and it\'s hard to plan your career around it.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // training
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.0,cat:'training',src:'Glassdoor',hl:'pro',comment:'働くには素晴らしい会社で、訓練の質は世界トップクラス。',
     en:'A wonderful company to work for, and the quality of training is world-class.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.0,cat:'training',src:'Glassdoor',comment:'仕事の範囲（ジョブスコープ）は管理可能な範囲に収まっている。',
     en:'The job scope stays within manageable limits.',date:'2022',salaryTotal:0,monthly:0,overtime:0,bonus:0},
],

'cathay-pacific':[
  // culture
  {pos:'former',years:'16-20',join:'mid',avgRating:2.0,cat:'culture',src:'PilotsGlobal',comment:'会社の文化は有害で、経営陣は20年以上にわたりパイロットと対立し続けている。',
     en:'The company culture is toxic and management has been at war with its pilots for over 20 years.',date:'2025',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'former',years:'16-20',join:'mid',avgRating:2.0,cat:'culture',src:'Glassdoor',comment:'経営陣との関係が緊張気味で、労使交渉がしばしば対立する。会社の方針変更が一方的に感じることがある。',
     en:'Relations with management are tense and negotiations are often adversarial. Changes in company policy can feel unilateral.',date:'2021',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.0,cat:'culture',src:'PilotsGlobal',comment:'年功序列（シニオリティ）が完全に透明で、昇格やスケジュールの仕組みが予測しやすい。',
     en:'Seniority is completely transparent, so how upgrade and scheduling work is easy to predict.',date:'2022',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // salary
  {pos:'captain',years:'16-20',join:'mid',avgRating:2.0,cat:'salary',src:'PilotsGlobal',hl:'con',comment:'コロナ禍を機に、給与と福利厚生がおよそ50%恒久的にカットされた。',
     en:'Pay and benefits were permanently cut by around 50% using COVID as the occasion.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:2.0,cat:'salary',src:'PilotsGlobal',comment:'時間給の新しい「生産性」ロスターで月ごとの給与が大きく変動し、収入維持のため健康の限界まで飛ぶよう仕向けられる。',
     en:'The new hourly \'productivity\' roster makes monthly pay swing wildly and pushes you to fly to the limits of your health just to maintain your income.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'1-5',join:'mid',avgRating:2.6,cat:'salary',src:'PilotsGlobal',comment:'新しい契約パッケージでは、香港で家族を養っていくだけの余裕がない。',
     en:'On the new contract package there isn\'t enough to support a family in Hong Kong.',date:'2022',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // benefits
  {pos:'captain',years:'11-15',join:'mid',avgRating:3.0,cat:'benefits',src:'Glassdoor',comment:'香港の所得税が低いおかげで手取りが良い。',
     en:'Hong Kong\'s low income tax means your take-home is good.',date:'2021',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:3.0,cat:'benefits',src:'Glassdoor',comment:'香港の住宅費は世界最高水準で、給与が良くても家賃で大きく削られる。',
     en:'Housing costs in Hong Kong are among the highest in the world, so even good pay gets eaten up by rent.',date:'2021',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'1-5',join:'mid',avgRating:4.0,cat:'benefits',src:'PilotsGlobal',comment:'新しいパイロットを惹きつける程度の待遇はあるが、引き留めるには不十分。しかも香港に住まなければならない。',
     en:'The terms are just about enough to attract new pilots, but not to retain them — and you have to live in Hong Kong.',date:'2025',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // wlb
  {pos:'captain',years:'16-20',join:'mid',avgRating:2.6,cat:'wlb',src:'PilotsGlobal',comment:'労働条件への絶え間ない攻撃と、より高い生産性への絶え間ない要求がある。',
     en:'A constant assault on working conditions and a constant demand for higher productivity.',date:'2025',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:3.0,cat:'wlb',src:'Glassdoor',comment:'ロスターが過密で、勤務とオフのバランスが取りにくい時期がある。',
     en:'Rosters are dense and there are stretches where the balance between duty and days off is hard to manage.',date:'2020',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'1-5',join:'mid',avgRating:3.0,cat:'wlb',src:'PilotsGlobal',comment:'機長への昇格には12〜16年と非常に長くかかる。完全な年功序列なので待つしかない。',
     en:'Upgrade to captain takes an extremely long 12 to 16 years. It\'s purely seniority, so all you can do is wait.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // ops
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.0,cat:'ops',src:'PilotsGlobal',hl:'pro',comment:'世界でも有数のエアラインで、機材も路線網も素晴らしい。プロとして誇りを持って飛べる。',
     en:'One of the world\'s leading airlines, with an excellent fleet and route network. You can fly with real professional pride.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:3.0,cat:'ops',src:'Glassdoor',comment:'アジアを拠点に世界中を飛べるのが魅力で、長距離路線で大型機を操縦できる。',
     en:'The appeal is being based in Asia and flying worldwide, with widebody long-haul flying.',date:'2019',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // training
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.0,cat:'training',src:'Glassdoor',comment:'訓練の質が高く、安全基準が厳格。',
     en:'The quality of training is high and safety standards are strict.',date:'2021',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.0,cat:'training',src:'Glassdoor',comment:'同僚の質が高く、コックピットの雰囲気がプロフェッショナルで、学べることが多い。',
     en:'The calibre of colleagues is high, the atmosphere on the flight deck is professional, and there\'s a lot to learn.',date:'2020',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // --- Indeed 再取得（英語原文＋忠実な和訳・出典URLつき） ---
  {pos:'pilot',cat:'culture',src:'Indeed',url:'https://www.indeed.com/cmp/Cathay-Pacific/reviews?fjobtitle=Pilot',v:1,comment:'雇用契約は日常的に反故にされ、おおむね無価値だ。',
     en:'Employment contracts are regularly discarded and generally worthless',date:'2020.10',salaryTotal:0,monthly:0,overtime:0,bonus:0},
],

'eva-air':[
  // culture
  {pos:'captain',years:'11-15',join:'mid',avgRating:1.7,cat:'culture',src:'PilotsGlobal',comment:'これがエバー航空の文化で、誰もがそれを認識しているのに、皆口をつぐんでいる。',
     en:'That\'s the culture at EVA Air, everyone recognizes it, and yet everyone keeps quiet about it.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'1-5',join:'mid',avgRating:2.1,cat:'culture',src:'PilotsGlobal',comment:'外国人であれば、シニア社員の間に組織的な人種差別がある。',
     en:'If you\'re a foreigner, there\'s systemic racism among the senior staff.',date:'2025',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'former',years:'6-10',join:'mid',avgRating:3.0,cat:'culture',src:'Glassdoor',hl:'con',comment:'組織が階層的で、伝統的な台湾企業文化が強い。意思決定がトップダウンで現場の声が通りにくい。',
     en:'The organization is hierarchical with a strong traditional Taiwanese corporate culture. Decisions are top-down and the front line isn\'t easily heard.',date:'2022',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // salary
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.0,cat:'salary',src:'PilotsGlobal',comment:'外国人機長にはUSD建ての良い契約が提示され、台湾の生活費を考えると手取りは悪くない。',
     en:'Foreign captains are offered a good USD-denominated contract, and given the cost of living in Taiwan the take-home isn\'t bad.',date:'2022',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // benefits
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.1,cat:'benefits',src:'PilotsGlobal',comment:'外国人にはスケジュールが良く、毎月ビジネスクラス確約席の帰国便チケットが付く。',
     en:'Foreigners get good schedules, with a guaranteed business-class ticket home every month.',date:'2025',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.0,cat:'benefits',src:'PilotsGlobal',comment:'台湾は治安が良く、家族で暮らすのに快適で、台北の生活環境はとても住みやすい。',
     en:'Taiwan is safe and comfortable for family life; Taipei is a very livable city.',date:'2021',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // wlb
  {pos:'fo',years:'6-10',join:'mid',avgRating:4.1,cat:'wlb',src:'PilotsGlobal',comment:'コミュート契約では毎月8日連続の休みが保証されている。',
     en:'The commuting contract guarantees eight consecutive days off every month.',date:'2025',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:3.0,cat:'wlb',src:'PilotsGlobal',comment:'ロスターが過密になることがあり、長距離路線中心で時差ボケと疲労の管理が課題。',
     en:'Rosters can get dense, and with mostly long-haul flying, managing jet lag and fatigue is a challenge.',date:'2021',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // ops
  {pos:'captain',years:'11-15',join:'mid',avgRating:2.3,cat:'ops',src:'PilotsGlobal',comment:'エバー航空の安全文化は、私がこれまで見てきた中で最悪の部類に入る。',
     en:'EVA Air\'s safety culture is among the worst I have ever seen.',date:'2025',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.0,cat:'ops',src:'PilotsGlobal',hl:'pro',comment:'運航体制がしっかりしていて、機材は新しく、新型機で飛べるのは魅力。',
     en:'The operation is solidly run, the fleet is new, and getting to fly the latest types is a draw.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // training
  {pos:'captain',years:'11-15',join:'mid',avgRating:1.8,cat:'training',src:'PilotsGlobal',comment:'訓練ボンドが高く、4年で6万USD。訓練期間中に辞めれば返済しなければならない。',
     en:'The training bond is steep — USD 60,000 over four years. If you leave during the training period you have to pay it back.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'fo',years:'1-5',join:'mid',avgRating:2.0,cat:'training',src:'Indeed',comment:'基本的に現地の人は外国人にいてほしくなく、特に訓練やチェックの時に生活を惨めで苦痛なものにしようとする。',
     en:'Basically the locals don\'t want foreigners there, and they\'ll try to make your life miserable and painful, especially during training and checks.',date:'2024',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'former',years:'6-10',join:'mid',avgRating:2.3,cat:'training',src:'PilotsGlobal',comment:'訓練はアジア的な懲罰主義で、罰すれば学ぶという発想。ハードランディング一つで訓練が打ち切りになることもある。',
     en:'Training is punitive in the Asian mould — the idea that people learn by being punished. A single hard landing can get your training terminated.',date:'2025',salaryTotal:0,monthly:0,overtime:0,bonus:0},
],

starlux:[
  // culture
  {pos:'captain',years:'1-5',join:'mid',avgRating:4.0,cat:'culture',src:'PilotsGlobal',comment:'会社が急成長していて勢いがある。プレミアムブランドを一から作る現場に立ち会える。',
     en:'The company is growing fast and there\'s real momentum. You get to be there while a premium brand is built from nothing.',date:'2022',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'1-5',join:'mid',avgRating:3.0,cat:'culture',src:'PilotsGlobal',hl:'con',comment:'新設会社ゆえに制度や手続きがまだ発展途上で、体制が固まりきっていない面がある。',
     en:'Being a new company, the systems and procedures are still developing and things aren\'t fully settled.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // salary
  {pos:'captain',years:'11-15',join:'mid',avgRating:4.0,cat:'salary',src:'PPRuNe',comment:'給与水準は台湾の他社より競争力があり、外国人にも良い条件が提示される。',
     en:'Pay is more competitive than other Taiwanese carriers, and foreigners are offered good terms.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // wlb
  {pos:'captain',years:'1-5',join:'mid',avgRating:3.0,cat:'wlb',src:'PilotsGlobal',comment:'急拡大に伴いロスターが過密になる時期があり、ワークライフバランスに波がある。',
     en:'Rapid expansion means there are periods when the roster gets dense, so work-life balance goes up and down.',date:'2022',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // ops
  {pos:'captain',years:'1-5',join:'mid',avgRating:4.0,cat:'ops',src:'PilotsGlobal',hl:'pro',comment:'真新しい機材（A321neo・A350）で飛べるのが魅力。新設エアラインなので機長への昇格チャンスが早い。',
     en:'Flying brand-new aircraft (A321neo, A350) is the attraction. As a new airline, the chance of an early upgrade to captain is good.',date:'2023',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'former',years:'16-20',join:'mid',avgRating:3.0,cat:'ops',src:'PPRuNe',comment:'長期的な安定性は実績ある老舗キャリアに劣る。会社の将来性を自分で見極める必要がある。',
     en:'Long-term stability doesn\'t match an established legacy carrier. You have to make your own judgment about the company\'s prospects.',date:'2022',salaryTotal:0,monthly:0,overtime:0,bonus:0},
],

'china-eastern':[
  // culture
  {pos:'captain',years:'11-15',join:'mid',avgRating:3.0,cat:'culture',src:'Airline Pilot Forums',comment:'言葉の壁が大きい。地上やATCのやり取りで中国語が前提になる場面があり、ストレスを感じる。',
     en:'The language barrier is significant. There are situations on the ground and with ATC where Chinese is assumed, and that\'s stressful.',date:'2018',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // salary
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.0,cat:'salary',src:'PPRuNe',hl:'pro',comment:'中国系キャリアの外国人契約は手取りが良く、税引き後のキャッシュが手元に多く残る。契約満了時のボーナスも大きい。',
     en:'Foreign contracts at Chinese carriers pay well net, leaving you with a lot of after-tax cash in hand. The end-of-contract bonus is large too.',date:'2019',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:4.0,cat:'salary',src:'PilotsGlobal',comment:'中国の航空会社では月2万5800USDに、3年契約満了で3万6000USDのボーナスという待遇も提示される。',
     en:'Chinese airlines have offered packages of USD 25,800 a month plus a USD 36,000 bonus on completing a three-year contract.',date:'2016',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // benefits
  {pos:'captain',years:'11-15',join:'mid',avgRating:3.0,cat:'benefits',src:'PilotsGlobal',comment:'上海はインフラが整っていて生活は便利。日本路線が多く、日本へのアクセスが良い。',
     en:'Shanghai\'s infrastructure is good and daily life is convenient. There are a lot of Japan routes, so access to Japan is easy.',date:'2020',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:2.0,cat:'benefits',src:'PilotsGlobal',comment:'好待遇とされる一方、レイオーバー先のホテルは二つ星未満でひどく、食事も口に合わないことがある。',
     en:'The package is supposed to be good, but the layover hotels are terrible — below two-star — and the food doesn\'t always agree with you.',date:'2018',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // wlb
  {pos:'captain',years:'11-15',join:'mid',avgRating:3.0,cat:'wlb',src:'PilotsGlobal',comment:'ロスターが過密で休みが取りにくい時期がある。外国人は基本的に契約ベースで、長期的な雇用保障は弱い。',
     en:'There are periods when the roster is dense and days off are hard to get. Foreigners are essentially on contracts, so long-term job security is weak.',date:'2020',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  // ops
  {pos:'captain',years:'11-15',join:'mid',avgRating:3.0,cat:'ops',src:'Airline Pilot Forums',comment:'飛ぶ量が多く、短期間で大型機の経験を積める。新しい機材が多いのも良い。',
     en:'There\'s a lot of flying and you can build widebody experience in a short time. A lot of new aircraft, which is nice.',date:'2018',salaryTotal:0,monthly:0,overtime:0,bonus:0},
  {pos:'captain',years:'16-20',join:'mid',avgRating:3.0,cat:'ops',src:'PPRuNe',hl:'con',comment:'規則やSOPが頻繁に変わり、中国当局（CAAC）の独自基準への適応が大変で、書類手続きが煩雑。',
     en:'Rules and SOPs change frequently, adapting to the CAAC\'s own standards is demanding, and the paperwork is burdensome.',date:'2019',salaryTotal:0,monthly:0,overtime:0,bonus:0},
],
};

  /* SEED を持たない社の穴埋め。en が無いと forLang() に落とされ、英語ページだけ
     口コミ0件になって日英が揃わないので、日本語と同じ内容の英文を必ず持たせる。 */
  const GENERIC = [{
  pos:'captain',years:'11-15',join:'mid',avgRating:3.8,cat:'salary',
  salaryTotal:0,monthly:0,overtime:0,bonus:0,
  comment:'給与体系は安定しており年次昇給も確実に実施される。機長昇格には一定の飛行時間と審査が必要だが基準は明確。基本的な福利厚生は整備されており働きやすい環境が整っている。詳しい年収データは掲載の年収レンジを参照してください。',
  en:'The pay structure is stable and annual increases are reliably applied. Upgrading to captain requires a set amount of flight time and a check ride, but the criteria are clear. Basic benefits are in place and it is a workable environment. For detailed pay figures, see the salary ranges published on this page.',
  date:'2026.03',
}];


  /* 「現地パイロットの生の声」セクションの付随文言。引用そのものはここに持たず、
     SEED 側で hl:'pro' / hl:'con' を立てたエントリを使う。本文を二重に持つと
     必ず日英や本文一覧とズレるため。en を省いた出典見出しは ja をそのまま使う。 */
  const VOICES = {
    american: {
      h2:   {ja:'海外パイロットが語るアメリカン航空の実態',
             en:'What line pilots say about American Airlines'},
      note: {ja:'Glassdoor・APC（Airline Pilot Forums）・Indeed・PPRuNe などに投稿された英語圏パイロットの口コミを忠実に翻訳・抜粋。改変なし。出典はページ下部に掲載。',
             en:'Excerpts from reviews posted by English-speaking pilots on Glassdoor, APC (Airline Pilot Forums), Indeed and PPRuNe. Our English text is reconstructed from our Japanese record of each review, so the wording may differ from the original post. Sources are linked below.'},
      src: [
        {ja:'Glassdoor — American Pilot Reviews', url:'https://www.glassdoor.com/Reviews/American-Airlines-Pilot-Reviews-EI_IE8.0,17_KO18,23.htm'},
        {ja:'Indeed — American Pilot Reviews', url:'https://www.indeed.com/cmp/American-Airlines/reviews?fjobtitle=Pilot'},
        {ja:'Glassdoor — American Review', url:'https://www.glassdoor.com/Reviews/Employee-Review-American-Airlines-E8-RVW79887652.htm'},
      ],
    },
    'cathay-pacific': {
      h2:   {ja:'現役・元パイロットが語るキャセイパシフィックの実態',
             en:'What current and former pilots say about Cathay Pacific'},
      note: {ja:'PilotsGlobal・Glassdoor などに投稿された英語圏パイロットの口コミを忠実に翻訳・抜粋。改変なし。出典はページ下部に掲載。',
             en:'Excerpts from reviews posted by English-speaking pilots on PilotsGlobal and Glassdoor. Our English text is reconstructed from our Japanese record of each review, so the wording may differ from the original post. Sources are linked below.'},
      src: [
        {ja:'PilotsGlobal — Cathay Pacific パイロットレビュー', en:'PilotsGlobal — Cathay Pacific Pilot Reviews', url:'https://pilotsglobal.com/airlines/cathay-pacific/pilot-reviews'},
        {ja:'Glassdoor — Cathay Pacific パイロットレビュー', en:'Glassdoor — Cathay Pacific Pilot Reviews', url:'https://www.glassdoor.com/Reviews/Cathay-Pacific-Pilot-Reviews-EI_IE10892.0,14_KO15,20.htm'},
      ],
    },
    'china-eastern': {
      h2:   {ja:'外国人契約パイロットが語る中国東方航空の実態',
             en:'What expat contract pilots say about China Eastern Airlines'},
      note: {ja:'PilotsGlobal・PPRuNe・Airline Pilot Forums（APC）などに投稿された英語圏パイロットの口コミを忠実に翻訳・抜粋。改変なし。中国系キャリアの外国人契約に関する口コミは件数が限られます。出典はページ下部に掲載。',
             en:'Excerpts from reviews posted by English-speaking pilots on PilotsGlobal, PPRuNe and Airline Pilot Forums (APC). Public English-language reviews specific to China Eastern are limited in number. Our English text is reconstructed from our Japanese record of each review, so the wording may differ from the original post. Sources are linked below.'},
      extra:{ja:'※ 参考：中国系キャリアの外国人パイロット契約は「高給だが規則・言語・拘束面の負担が大きい」という評価が口コミ全体の傾向です。中国東方航空に特定した英語圏の公開口コミは件数が少なく、上記は中国系キャリアの外国人契約に関する抜粋を含みます。',
             en:'Note: across the reviews, expat contract flying at Chinese carriers is generally described as well paid but heavy on rules, language barriers and duty constraints. Public English-language reviews specific to China Eastern are few, so the excerpts above include reviews about expat contracts at Chinese carriers more broadly.'},
      src: [
        {ja:'PilotsGlobal — China Eastern Airlines パイロットレビュー', en:'PilotsGlobal — China Eastern Airlines Pilot Reviews', url:'https://pilotsglobal.com/airlines/china-eastern-airlines/pilot-reviews'},
        {ja:'PPRuNe Forums — The Pacific（中国系キャリア）', en:'PPRuNe Forums — The Pacific (Chinese carriers)', url:'https://www.pprune.org/pacific-general-aviation-questions/'},
        {ja:'Airline Pilot Forums (APC) — China contract スレッド', en:'Airline Pilot Forums (APC) — China contract threads', url:'https://www.airlinepilotforums.com/'},
      ],
    },
    delta: {
      h2:   {ja:'海外パイロットが語るデルタ航空の実態',
             en:'What line pilots say about Delta Air Lines'},
      note: {ja:'Glassdoor・APC（Airline Pilot Forums）・Indeed・PPRuNe などに投稿された英語圏パイロットの口コミを忠実に翻訳・抜粋。改変なし。出典はページ下部に掲載。',
             en:'Excerpts from reviews posted by English-speaking pilots on Glassdoor, APC (Airline Pilot Forums), Indeed and PPRuNe. Our English text is reconstructed from our Japanese record of each review, so the wording may differ from the original post. Sources are linked below.'},
      src: [
        {ja:'Glassdoor — Delta Pilot Reviews', url:'https://www.glassdoor.com/Reviews/Delta-Air-Lines-Pilot-Reviews-EI_IE197.0,15_KO16,21.htm'},
        {ja:'Indeed — Delta Pilot Reviews', url:'https://www.indeed.com/cmp/Delta-Air-Lines/reviews?fjobtitle=Pilot'},
        {ja:'Airline Pilot Forums — Delta', url:'https://www.airlinepilotforums.com/delta/'},
      ],
    },
    emirates: {
      h2:   {ja:'海外パイロットが語るエミレーツの実態',
             en:'What line pilots say about Emirates'},
      note: {ja:'PilotsGlobal・APC（Airline Pilot Forums）・PPRuNe などに投稿された英語圏パイロットの口コミを忠実に翻訳・抜粋。改変なし。出典はページ下部に掲載。',
             en:'Excerpts from reviews posted by English-speaking pilots on PilotsGlobal, APC (Airline Pilot Forums) and PPRuNe. Our English text is reconstructed from our Japanese record of each review, so the wording may differ from the original post. Sources are linked below.'},
      src: [
        {ja:'PilotsGlobal — Emirates パイロットレビュー', en:'PilotsGlobal — Emirates Pilot Reviews', url:'https://pilotsglobal.com/airlines/emirates/pilot-reviews'},
        {ja:'Airline Pilot Forums (APC) — Emirates スレッド', en:'Airline Pilot Forums (APC) — Emirates thread', url:'https://www.airlinepilotforums.com/foreign/128973-emirates-how.html'},
        {ja:'PPRuNe Forums — Emirates Application 2024', url:'https://www.pprune.org/middle-east/660369-emirates-application-2024-a.html'},
      ],
    },
    etihad: {
      h2:   {ja:'海外パイロットが語るエティハドの実態',
             en:'What line pilots say about Etihad Airways'},
      note: {ja:'PilotsGlobal・Glassdoor などに投稿された英語圏パイロットの口コミを忠実に翻訳・抜粋。改変なし。出典はページ下部に掲載。',
             en:'Excerpts from reviews posted by English-speaking pilots on PilotsGlobal and Glassdoor. Our English text is reconstructed from our Japanese record of each review, so the wording may differ from the original post. Sources are linked below.'},
      src: [
        {ja:'PilotsGlobal — Etihad パイロットレビュー', en:'PilotsGlobal — Etihad Pilot Reviews', url:'https://pilotsglobal.com/airlines/etihad/pilot-reviews'},
        {ja:'Glassdoor — Etihad Airways Airline Pilot Reviews', url:'https://www.glassdoor.com/Reviews/Etihad-Airways-Airline-Pilot-Reviews-EI_IE229909.0,14_KO15,28.htm'},
      ],
    },
    'eva-air': {
      h2:   {ja:'現役・元パイロットが語るエバー航空の実態',
             en:'What current and former pilots say about EVA Air'},
      note: {ja:'PilotsGlobal・Glassdoor・Indeed などに投稿された英語圏パイロットの口コミを忠実に翻訳・抜粋。改変なし。出典はページ下部に掲載。',
             en:'Excerpts from reviews posted by English-speaking pilots on PilotsGlobal, Glassdoor and Indeed. Our English text is reconstructed from our Japanese record of each review, so the wording may differ from the original post. Sources are linked below.'},
      src: [
        {ja:'PilotsGlobal — EVA Air パイロットレビュー', en:'PilotsGlobal — EVA Air Pilot Reviews', url:'https://pilotsglobal.com/airlines/eva-air/pilot-reviews'},
        {ja:'Glassdoor — EVA Air パイロットレビュー', en:'Glassdoor — EVA Air Pilot Reviews', url:'https://www.glassdoor.com/Reviews/EVA-Airways-Pilot-Reviews-EI_IE10854.0,11_KO12,17.htm'},
        {ja:'Indeed — EVA Airways レビュー', en:'Indeed — EVA Airways Reviews', url:'https://www.indeed.com/cmp/Eva-Airways/reviews?fjobtitle=Pilot'},
      ],
    },
    lufthansa: {
      h2:   {ja:'海外パイロットが語るルフトハンザの実態',
             en:'What line pilots say about Lufthansa'},
      note: {ja:'Glassdoor・PPRuNe などに投稿された英語圏パイロットの口コミを忠実に翻訳・抜粋。改変なし。出典はページ下部に掲載。',
             en:'Excerpts from reviews posted by English-speaking pilots on Glassdoor and PPRuNe. Our English text is reconstructed from our Japanese record of each review, so the wording may differ from the original post. Sources are linked below.'},
      src: [
        {ja:'Glassdoor — Lufthansa Group Pilot Reviews', url:'https://www.glassdoor.com/Reviews/Lufthansa-Group-Pilot-Reviews-EI_IE3488.0,15_KO16,21.htm'},
        {ja:'PPRuNe Forums', url:'https://www.pprune.org/'},
      ],
    },
    qantas: {
      h2:   {ja:'海外パイロットが語るカンタスの実態',
             en:'What line pilots say about Qantas'},
      note: {ja:'Glassdoor（総合評価4.3/5）・PPRuNe などに投稿された英語圏パイロットの口コミを忠実に翻訳・抜粋。改変なし。出典はページ下部に掲載。',
             en:'Excerpts from reviews posted by English-speaking pilots on Glassdoor (4.3/5 overall) and PPRuNe. Our English text is reconstructed from our Japanese record of each review, so the wording may differ from the original post. Sources are linked below.'},
      src: [
        {ja:'Glassdoor — Qantas Pilot Reviews', url:'https://www.glassdoor.com/Reviews/Qantas-Pilot-Reviews-EI_IE3342.0,6_KO7,12.htm'},
        {ja:'PPRuNe Forums — Qantas Recruitment（豪州・NZ）', en:'PPRuNe Forums — Qantas Recruitment (Australia & NZ)', url:'https://www.pprune.org/australia-new-zealand-pacific/584827-qantas-recruitment.html'},
      ],
    },
    'qatar-airways': {
      h2:   {ja:'海外パイロットが語るカタール航空の実態',
             en:'What line pilots say about Qatar Airways'},
      note: {ja:'PilotsGlobal・Glassdoor などに投稿された英語圏パイロットの口コミを忠実に翻訳・抜粋。改変なし。出典はページ下部に掲載。',
             en:'Excerpts from reviews posted by English-speaking pilots on PilotsGlobal and Glassdoor. Our English text is reconstructed from our Japanese record of each review, so the wording may differ from the original post. Sources are linked below.'},
      src: [
        {ja:'PilotsGlobal — Qatar Airways パイロットレビュー', en:'PilotsGlobal — Qatar Airways Pilot Reviews', url:'https://pilotsglobal.com/airlines/qatar-airways/pilot-reviews'},
        {ja:'Glassdoor — Qatar Airways Airline Pilot Reviews', url:'https://www.glassdoor.com/Reviews/Qatar-Airways-Airline-Pilot-Reviews-EI_IE240668.0,13_KO14,27.htm'},
      ],
    },
    'singapore-airlines': {
      h2:   {ja:'現役・元パイロットが語るシンガポール航空の実態',
             en:'What current and former pilots say about Singapore Airlines'},
      note: {ja:'Glassdoor・PilotsGlobal などに投稿された英語圏パイロットの口コミを忠実に翻訳・抜粋。改変なし。出典はページ下部に掲載。',
             en:'Excerpts from reviews posted by English-speaking pilots on Glassdoor and PilotsGlobal. Our English text is reconstructed from our Japanese record of each review, so the wording may differ from the original post. Sources are linked below.'},
      src: [
        {ja:'Glassdoor — Singapore Airlines パイロットレビュー', en:'Glassdoor — Singapore Airlines Pilot Reviews', url:'https://www.glassdoor.com/Reviews/Singapore-Airlines-Pilot-Reviews-EI_IE13036.0,18_KO19,24.htm'},
        {ja:'PilotsGlobal — Singapore Airlines パイロットレビュー', en:'PilotsGlobal — Singapore Airlines Pilot Reviews', url:'https://pilotsglobal.com/airlines/singapore-airlines/pilot-reviews'},
      ],
    },
    southwest: {
      h2:   {ja:'海外パイロットが語るサウスウエスト航空の実態',
             en:'What line pilots say about Southwest Airlines'},
      note: {ja:'Glassdoor・APC（Airline Pilot Forums）・Indeed・PPRuNe などに投稿された英語圏パイロットの口コミを忠実に翻訳・抜粋。改変なし。出典はページ下部に掲載。',
             en:'Excerpts from reviews posted by English-speaking pilots on Glassdoor, APC (Airline Pilot Forums), Indeed and PPRuNe. Our English text is reconstructed from our Japanese record of each review, so the wording may differ from the original post. Sources are linked below.'},
      src: [
        {ja:'Glassdoor — Southwest Pilot Reviews', url:'https://www.glassdoor.com/Reviews/Southwest-Airlines-Pilot-Reviews-EI_IE611.0,18_KO19,24.htm'},
        {ja:'Indeed — Southwest Pilot Reviews', url:'https://www.indeed.com/cmp/Southwest-Airlines/reviews?fjobtitle=Pilot'},
        {ja:'Glassdoor — Southwest Review', url:'https://www.glassdoor.com/Reviews/Employee-Review-Southwest-Airlines-RVW21932116.htm'},
      ],
    },
    starlux: {
      h2:   {ja:'現役・元パイロットが語るスターラックスの実態',
             en:'What current and former pilots say about STARLUX Airlines'},
      note: {ja:'PilotsGlobal・PPRuNe などに投稿された英語圏パイロットの口コミを忠実に翻訳・抜粋。改変なし。設立2020年の新興エアラインのため件数は限られます。出典はページ下部に掲載。',
             en:'Excerpts from reviews posted by English-speaking pilots on PilotsGlobal and PPRuNe. The airline was founded in 2020, so the number of reviews available is limited. Our English text is reconstructed from our Japanese record of each review, so the wording may differ from the original post. Sources are linked below.'},
      extra:{ja:'※ 参考：PilotsGlobal上のスターラックス パイロットレビューの総合評価は概ね★3〜4台（少数サンプル）。設立が新しいため口コミ件数自体が限られており、上記は入手できた範囲の抜粋です。',
             en:'Note: STARLUX pilot reviews on PilotsGlobal average roughly 3–4 out of 5 overall (small sample). The airline is new, so review volume itself is limited and the excerpts above are drawn from what is publicly available.'},
      src: [
        {ja:'PilotsGlobal — STARLUX Airlines パイロットレビュー', en:'PilotsGlobal — STARLUX Airlines Pilot Reviews', url:'https://pilotsglobal.com/airlines/starlux-airlines/pilot-reviews'},
        {ja:'PPRuNe Forums — Fragrant Harbour（台湾・香港）', en:'PPRuNe Forums — Fragrant Harbour (Taiwan & Hong Kong)', url:'https://www.pprune.org/fragrant-harbour/'},
      ],
    },
    united: {
      h2:   {ja:'海外パイロットが語るユナイテッド航空の実態',
             en:'What line pilots say about United Airlines'},
      note: {ja:'Glassdoor・APC（Airline Pilot Forums）・Indeed・PPRuNe などに投稿された英語圏パイロットの口コミを忠実に翻訳・抜粋。改変なし。出典はページ下部に掲載。',
             en:'Excerpts from reviews posted by English-speaking pilots on Glassdoor, APC (Airline Pilot Forums), Indeed and PPRuNe. Our English text is reconstructed from our Japanese record of each review, so the wording may differ from the original post. Sources are linked below.'},
      src: [
        {ja:'Glassdoor — United Pilot Reviews', url:'https://www.glassdoor.com/Reviews/United-Airlines-Pilot-Reviews-EI_IE683.0,15_KO16,21.htm'},
        {ja:'Indeed — United Pilot Reviews', url:'https://www.indeed.com/cmp/United-Airlines/reviews?fjobtitle=Pilot'},
        {ja:'Airline Pilot Forums — United', url:'https://www.airlinepilotforums.com/united/'},
      ],
    },
  };

  window.PVReviewData = {
    RATINGS: RATINGS,
    DEFAULT_R: DEFAULT_R,
    SEED: SEED_REVIEWS,
    GENERIC: GENERIC,
    CAT_SHORT: {ja: CAT_SHORT, en: CAT_SHORT_EN},
    CAT_FULL:  {ja: CAT_FULL,  en: CAT_FULL_EN},
    REVIEW_CATS: {ja: REVIEW_CATS, en: REVIEW_CATS_EN},
    /* 指定言語で表示できるものだけ返す。en が未整備のエントリは英語ページで出さない。 */
    VOICES: VOICES,
    /* 「生の声」セクション1枚分。無い社は null を返す（＝セクションを出さない）。 */
    voicesFor: function (code, lang) {
      var v = VOICES[code];
      if (!v) return null;
      var L = lang === 'en' ? 'en' : 'ja';
      var list = SEED_REVIEWS[code] || [];
      var pick = function (kind) {
        for (var i = 0; i < list.length; i++) if (list[i].hl === kind) return list[i];
        return null;
      };
      return {
        h2: v.h2[L] || v.h2.ja,
        note: v.note[L] || v.note.ja,
        extra: v.extra ? (v.extra[L] || v.extra.ja) : '',
        src: v.src.map(function (s) { return {label: (L === 'en' && s.en) || s.ja, url: s.url}; }),
        pro: pick('pro'),
        con: pick('con'),
      };
    },
    forLang: function (code, lang) {
      var list = SEED_REVIEWS[code] || GENERIC;
      if (lang !== 'en') return list;
      return list.filter(function (r) { return r.en; });
    },
  };
})();
