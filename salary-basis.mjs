/* ════════════════════════════════════════════════════════════════
   salary-basis.mjs — 「その数字は誰の、何を含んだ、どの時点の金額か」の唯一の正。

   salary-data.mjs（SALARY）が持っているのは万円の推計値で、ファイル冒頭が自ら
   「フリート全体の平均推計」と書いている。どの資料から作ったかの記録は無い。
   ここは会社ごと・職位ごとに **根拠の等級（tier）** を持ち、画面に出していい数字と、
   一緒に出す前提・出所を持つ。

   ★ SALARY 本体に列を足さない。
     gen-salary-json.mjs が { ...d } で展開するので、足した列は salary-data.json に
     載って公開される（出所URLが漏れる。DATA-PROVENANCE.md）。だから別ファイルにする。

   ★ 円額はここに書かない。man() が fx-rates.mjs から毎回計算する。
     原貨（AED / USD / HKD / TWD）が正本で、円は比較用の換算。
     「現在の為替レート」としては表示しない（基準日つきで出す）。

   ── 根拠の等級（オーナー確定・2026-09-29）────────────────────────
     母集団・期間・算定方法が確認できる平均   → 対象を明示して「平均」
     公式募集の給与額                         → 「公式募集例」
     採用会社の求人・過去広告・本人の体験     → 出典の種類・対象・時期を明記して別枠
     資料と計算式が確認できるモデル額         → 「月○時間・○年目の給与例」等、条件付き
     出所・対象・計算方法が確認できない       → 公開数値を「確認中」・元の値は held に残す

   ⚠️ 「矛盾する資料が見つからない」は掲載根拠にならない。
   ⚠️ SSOT と一致するだけで「事実確認済み」と数えない。
   ⚠️ 「参考値」「推計平均」への言い換えで残さない（オーナーが明示的に却下）。
   ⚠️ 保留した数値を 0 や空欄にしない。held.was に元の値を残す。
   ════════════════════════════════════════════════════════════════ */

import { JPY_PER, AS_OF as FX_AS_OF } from './fx-rates.mjs';

export { FX_AS_OF };

/** 等級。画面に出す呼び方はここ1か所で決める（各ページに文言を写さない）。 */
export const TIERS = {
  observed_mean:    { ja: '平均',         en: 'Average',          avg: true  },
  employer_example: { ja: '公式募集例',    en: 'Official posting', avg: false },
  offer_posting:    { ja: '求人の掲載額',  en: 'Job posting',      avg: false },
  past_ad:          { ja: '過去の募集広告', en: 'Past ad',         avg: false },
  self_report:      { ja: '本人の申告',    en: 'Self-reported',    avg: false },
  model_calc:       { ja: '条件つきの給与例', en: 'Modelled example', avg: false },
  held:             { ja: '確認中',        en: 'Under review',     avg: false },
};

/** 金額の種類と、画面に出す言い方。エミレーツの3つはオーナー提示の表の見出しそのまま。
    ★ groups[] に新しい欄を足したら必ずここにも足す。
      check-salary.mjs も gen-faq.mjs もこの並びを読んで「載っているべき数字」を決めるので、
      足し忘れた欄は黙って検査からも文章からも外れる。 */
export const KINDS = {
  cash_y:       '年間の現金給与',
  cash_m:       '月間の現金給与',
  pkg_y:        '年間総待遇〈現金給与を含む〉',
  max_y:        '求人に書かれた年額の上限',
  target_y:     '目標年収',
  allow_m_from: '月額手当（公表されているのは下限だけ）',
  cash_y_over:  '年収（会社が「これを超える」と書いた下限）',
  reward_y:     '年間の待遇額（約・現金3項目の合計）',
  base_m:       '月額の基本給',
  avg_y:        '会社が公表した平均年間給与',
  start_m:      '入社時の月額',
  train_m:      '初期訓練期間中の月額',
  allow_train_m: '訓練期間中の手当（月額・給与ではありません）',
};

/** 原貨 → 万円（比較用）。★ここ以外で円に直さない。 */
export const man = (cur, amount) => Math.round((amount * JPY_PER[cur]) / 10000);
/** 「約2,489万円」の形。 */
export const manText = (cur, amount) => `約${man(cur, amount).toLocaleString('en-US')}万円`;

/** 換算の断り書き。画面に出す。 */
export const fxNote = (cur) =>
  `円額は比較用の換算です（1 ${cur}＝${JPY_PER[cur]}円・${FX_AS_OF} 時点）。現在の為替レートではありません。`;

/* ────────────────────────────────────────────────────────────────
   BASIS
     src[]   画面に出す出所：発行元 pub / 資料名 name / 適用時点 as_of /
             確認日 accessed / リンク url。★確認日 ≠ 発行日。
     notes[] 画面に出す前提。そのまま出す（要約しない）。
     cap/fo  tier と、掲載する額（groups）と、保留した元の値（held）。
     ★ 職位の鍵は4つある。cap（機長）/ fo（副操縦士）は全社にあり、
       crew（運航乗務員＝機長と副操縦士をあわせた全体。会社が職位別に割っていない平均）と
       trainee（自社養成の訓練生）は、その資料がある会社にだけ置く。
       ⚠️ crew の平均を機長の平均・副操縦士の平均として使わない（会社が分けていない）。
       ⚠️ trainee の初任給を「パイロットの給与」として出さない。
     groups[] 採用区分ごと。cash_y / cash_m / pkg_y は原貨の整数。
             ⚠️ 月額×12 と年額を一致させない（公表値をそのまま残す）。
             ⚠️ pkg_y に現金給与や住宅・学費をもう一度足さない。
             ⚠️ pkg_y を12で割って月給と呼ばない。
   ──────────────────────────────────────────────────────────────── */
export const BASIS = {

  /* ══ エミレーツ ══ 決定①（オーナー・2026-09-29）
     「公式の現金給与と総待遇を両方掲載する。全社員の平均とは区別する」 */
  'emirates': {
    cur: 'AED',
    tax: '非課税（UAE に個人所得税なし）',
    src: [
      { pub: 'エミレーツ航空（Emirates Group Careers）',
        name: 'Pilots / Our role details — Direct Entry Captains',
        as_of: '発行日の記載なし', accessed: '2026-09-26',
        url: 'https://www.emiratesgroupcareers.com/pilots/our-role-details/?name=direct-entry-captains' },
      { pub: 'エミレーツ航空（Emirates Group Careers）',
        name: 'Pilots / Our role details — First Officers',
        as_of: '発行日の記載なし', accessed: '2026-09-26',
        url: 'https://www.emiratesgroupcareers.com/pilots/our-role-details/?name=first-officers' },
    ],
    notes: [
      '現金給与は会社公表の「take home cash」です。基本給と月85時間の飛行手当を前提とする募集例です。',
      '総待遇は、その現金給与に住宅・交通・学費・医療・保険・休暇航空券・会社の年金拠出等を含めた評価額です。',
      '総待遇のモデルは、本人・配偶者・対象となる子ども2人を前提としています。',
      'Enhanced は所定の経験・資格条件を満たす副操縦士向けです。全副操縦士に共通の金額ではありません。',
      'これらは全社員の平均、最低保証、各個人の最終的な手取り額を示すものではありません。',
    ],
    notes_en: [
      'The cash figure is the airline’s own "take home cash". It is a recruitment example built on basic pay plus a flying allowance for 85 hours a month.',
      'The total package adds housing, transport, school fees, medical cover, insurance, leave tickets and the company pension contribution on top of that cash figure.',
      'The total package is modelled on the pilot, a spouse and two eligible children.',
      'Enhanced applies to first officers who meet a set experience and licensing bar. It is not a figure common to all first officers.',
      'None of these figures is an all-staff average, a guaranteed minimum, or any individual’s final take-home pay.',
    ],
    cap: {
      tier: 'employer_example',
      groups: [
        { name: '直接入社機長', cash_y: 575000, cash_m: 48000, pkg_y: 1185000,
          req: '最低総飛行時間 7,000時間・英語能力証明レベル5以上' },
      ],
      held: { was: { avg: 3700, lo: 3350, hi: 5050 },
        why: '出所の記録が無い。salary-data.mjs は自ら「フリート全体の平均推計」と書いており、どの資料から作ったかが残っていない。出所台帳は「現金給与＋社宅の現物を年収と見ている可能性が高い」と推測しているが、推測は掲載根拠にならない。' },
    },
    fo: {
      tier: 'employer_example',
      groups: [
        { name: '副操縦士・Standard', cash_y: 385000, cash_m: 32100, pkg_y: 900000,
          req: '最低総飛行時間 2,000時間・英語能力証明レベル4以上' },
        { name: '副操縦士・Enhanced', cash_y: 415000, cash_m: 34600, pkg_y: 935000,
          req: '総飛行時間 4,000時間以上（最大離陸重量20トン超のジェット）かつ最大離陸重量50トン超の多人数運航ジェットで2,000時間以上・英語能力証明レベル5以上' },
      ],
      held: { was: { avg: 2800, lo: 2500, hi: 3350 },
        why: '機長と同じ理由（出所の記録が無い）。' },
    },
    /* ⚠️ 社宅は現物支給で AED 290,000（機長）/ 225,000（副操縦士）相当。
          総待遇 pkg_y に既に入っている。別立てで足すと二重計上になる。 */
  },

  /* ══ キャセイパシフィック ══
     副操縦士だけ公式に金額がある。機長の金額はどの公式ページにも無い
     （Cadet / Second Officer / First Officer の3職位しか載っていない）。 */
  'cathay-pacific': {
    cur: 'HKD',
    tax: '課税（香港）',
    src: [
      { pub: 'キャセイパシフィック航空（Cathay Pacific Careers）',
        name: 'Our teams / Pilot（First Officer パネル）',
        as_of: '2026年1月時点（脚注 "Latest figures as of Jan 2026, subject to periodic review"）',
        accessed: '2026-09-26',
        url: 'https://careers.cathaypacific.com/en/careers/our-teams/pilot/pilot-detail-page' },
    ],
    notes: [
      '目標年収（Target Annual Salary）は、会社が定める目標ブロックアワーを飛んだ場合の金額です。保証額ではありません。',
      '月額手当（Monthly allowance）は「HKD 20,000 から」と書かれた下限で、上限は公表されていません。',
      '会社が「2026年1月時点の数字。定期的に見直す」と付記しています。',
    ],
    notes_en: [
      'The Target Annual Salary is what the airline says you reach if you fly its target block hours. It is not a guaranteed amount.',
      'The monthly allowance is published only as a floor — "from HKD 20,000" — with no ceiling given.',
      'The airline notes these are the latest figures as of January 2026 and are subject to periodic review.',
    ],
    fo: {
      tier: 'model_calc',
      groups: [
        { name: '副操縦士（First Officer）', target_y: 964646, allow_m_from: 20000,
          req: '最低総飛行時間 1,500時間（3,000時間が望ましい）・うち機長時間 500時間以上・英語能力証明レベル4以上', leave: '年次有給 28日' },
        { name: '二等航空士（Second Officer）', target_y: 629109, allow_m_from: 14000,
          req: '最低総飛行時間 250時間', leave: '年次有給 21日' },
      ],
      held: { was: { avg: 2400, lo: 1800, hi: 3230 },
        why: '公式の目標年収 HKD 964,646 は約1,956万円で、このレンジの下寄りに入るだけ。レンジと平均そのものを支える資料は無い。' },
    },
    cap: {
      tier: 'held',
      held: { was: { avg: 3600, lo: 3000, hi: 5650 },
        why: '機長の金額が公式のどのページにも無い（掲載は Cadet / Second Officer / First Officer の3職位のみ）。' },
    },
  },

  /* ══ エティハド ══ 求人（別枠）。「最大」「月75時間」の2条件つき。 */
  'etihad': {
    cur: 'AED',
    tax: '非課税（UAE に個人所得税なし）',
    src: [
      { pub: 'エティハド航空（SmartRecruiters・ref 80371）', name: 'Captain A320',
        as_of: '2026-07-31 掲載', accessed: '2026-09-26',
        url: 'https://jobs.smartrecruiters.com/EtihadAirways5/744000140889348-captain' },
      { pub: 'エティハド航空（SmartRecruiters・ref 80372）', name: 'First Officer A320',
        as_of: '2026-07-31 掲載', accessed: '2026-09-26',
        url: 'https://jobs.smartrecruiters.com/EtihadAirways5/744000140889248-first-officer' },
    ],
    notes: [
      '「最大（up to）」の額で、月75時間の乗務を前提としています。75時間は上限に近い飛び方なので、普通の月の実額はこれより下がります。',
      '内訳は基本給・飛行手当・住宅手当・レイオーバー／食事手当の4つです。',
      '教育手当（初等 AED 40,000／中等 AED 55,000・子3人まで）・所得補償・保険・社員割引航空券・退職金・引越し支援は、この額に含まれていません。',
      '交代要員つきの便は75%換算です（機長）。',
    ],
    notes_en: [
      'These are "up to" figures and assume 75 flying hours a month, which is close to the ceiling, so a normal month pays less.',
      'They are made up of four items: basic pay, flying allowance, housing allowance and layover/meal allowance.',
      'The education allowance (AED 40,000 primary / AED 55,000 secondary, up to three children), income protection, insurance, staff travel, end-of-service benefit and relocation support are not included in the figure.',
      'Flights carrying a relief crew count as 75% (captains).',
    ],
    cap: {
      tier: 'offer_posting',
      groups: [
        { name: '機長 A320（求人の上限）', max_y: 674029,
          req: '総5,500時間・多人数運航ガラスコックピットの機長時間 2,500時間・A320系の機長時間 1,500時間・直近12か月に A320系・入社日に59歳未満・英語能力証明レベル4以上' },
      ],
      held: { was: { avg: 3400, lo: 3000, hi: 6000 },
        why: '求人の上限 AED 674,029 は約2,917万円で、このレンジの下端をわずかに下回る。レンジと平均そのものを支える資料は無い。' },
    },
    fo: {
      tier: 'offer_posting',
      groups: [
        { name: '副操縦士 A320（求人の上限）', max_y: 513732,
          req: 'A：総2,000時間かつ多人数運航ガラスコックピット1,500時間かつ同型500時間／B：総1,500時間かつ A320系1,000時間。加えて直近12か月に A320系・入社日に50歳未満・英語能力証明レベル4以上' },
      ],
      held: { was: { avg: 2300, lo: 1900, hi: 3100 },
        why: '求人の上限 AED 513,732 は約2,224万円で、このレンジの中に入るだけ。レンジと平均そのものを支える資料は無い。' },
    },
  },

  /* ══ エバー航空 ══ 公式に副操縦士の金額がある。「超」を落とさない。 */
  'eva-air': {
    cur: 'USD',
    tax: '課税（台湾）',
    src: [
      { pub: 'エバー航空（EVA Air）', name: 'Careers / Job openings / Pilots（en-global 版）',
        as_of: '発行日の記載なし', accessed: '2026-09-26',
        url: 'https://www.evaair.com/en-global/about-eva-air/careers/job-openings/pilots/' },
    ],
    notes: [
      '「年収 USD 100,000 超」と書かれた下限です。上限は公表されていません。',
      '初回の運航から適用され、手当・補助は別計算です。',
      '会社業績に応じた年末賞与、住宅補助または社宅、月8日連続の休み、年次有給22〜42日が付きます。',
      '4年契約で外から採用する副操縦士の条件です。',
    ],
    notes_en: [
      'The airline writes "annual salary over USD 100,000". That is a floor; no ceiling is published.',
      'It applies from the first line flight, with allowances and subsidies calculated separately.',
      'A year-end bonus tied to company results, a housing subsidy or company accommodation, eight consecutive days off a month and 22–42 days of annual leave are added.',
      'These are the terms for first officers hired from outside on a four-year contract.',
    ],
    fo: {
      tier: 'employer_example',
      groups: [
        { name: '副操縦士（4年契約）', cash_y_over: 100000,
          req: '最低総飛行時間 2,000時間・多人数運航ジェット（最大離陸重量20トン超）500時間・ICAO ATPL・英語能力証明レベル4' },
      ],
      held: { was: { avg: 980, lo: 600, hi: 1180 },
        why: '公式の下限（約1,589万円）がこのレンジの上限を約35%上回っている。レンジの出所の記録は無い。⚠️ 差の原因は特定できていない（金額が近いことだけを理由に「訓練中の給与の取り違え」と断定しない）。' },
    },
    cap: {
      tier: 'held',
      held: { was: { avg: 1750, lo: 1370, hi: 2200 },
        why: '機長の金額が公式にも第三者資料にも無い。' },
    },
  },

  /* ══ チャイナエアライン ══ 公式は英語版・中文版とも金額ゼロ。
     中文版の「按飛時經驗支薪」が給与に触れた唯一の文で、それでも金額が無い。 */
  'china-airlines': {
    cur: 'USD',
    tax: '課税（台湾）',
    src: [],
    notes: [],
    notes_en: [],
    cap: { tier: 'held', held: { was: { avg: 2000, lo: 1500, hi: 2450 },
      why: '公式の採用ページ（英語版・中文版）に金額が1件も無い。レンジの出所の記録も無い。' } },
    fo: { tier: 'held', held: { was: { avg: 1100, lo: 700, hi: 1280 },
      why: '機長と同じ理由。' } },
  },

  /* ══ スターラックス ══ 決定④（オーナー・2026-09-29）
     「変更済みの計算値の根拠を確認する。根拠が不足すれば公開表示を保留する」
     → 計算式が残っている2つだけ条件つきで掲載し、残りは確認中。 */
  'starlux': {
    cur: 'TWD',
    tax: '課税（台湾）',
    src: [
      { pub: '内定者の実体験（機長歴10年で応募したパイロット本人の申告・1名）',
        name: '本サイトの採用試験ガイドに掲載している月額の表',
        as_of: '2025年前半', accessed: '2026-09-28',
        url: 'https://pilot-value.com/airlines/starlux-tenshoku.html' },
    ],
    notes: [
      '本人1名の申告で、「機長歴10年」という1点の条件が付いています。会社の公表額ではありません。',
      'スターラックス航空は給与額を公式に公表していません。',
      '月額に13を掛けています（13か月給与）。住宅手当 NTD 30,000/月・交通費 NTD 1,000/月は別です。',
      '月75時間を超えた分の割増（約 NTD 5,500/時間）は足していません（飛んだ時間が分からないため）。',
    ],
    notes_en: [
      'This is one pilot’s own account, with the single condition "ten years as a captain". It is not a figure the airline publishes.',
      'STARLUX Airlines does not publish pay figures officially.',
      'The monthly figure is multiplied by 13 (a 13-month salary). A housing allowance of NTD 30,000 a month and NTD 1,000 transport are separate.',
      'Premium for hours beyond 75 a month (about NTD 5,500 an hour) is not added, because the hours actually flown are not known.',
    ],
    cap: {
      tier: 'model_calc',
      groups: [
        { name: '昇格後（機長歴10年目安）', month: 422500, months: 13,
          cond: '月75時間の乗務保証を含む月額 × 13か月' },
      ],
      held: { was: { avg: 3100, hi: 3900 },
        why: 'avg 3,100万と hi 3,900万には計算式が無い（3,900万は出所の記録が無かった旧値の据え置き）。' },
    },
    fo: {
      tier: 'model_calc',
      groups: [
        { name: '訓練中', month: 285000, months: 13, training: true,
          cond: '50時間の乗務分を含む訓練中の月額 × 13か月' },
      ],
      held: { was: { avg: 1950, hi: 2050 },
        why: 'avg 1,950万と hi 2,050万には計算式が無い。⚠️ 掲載している月額は機長候補者の訓練中の額で、副操縦士の給与そのものではない（副操縦士の実額は1件も無い）。' },
    },
  },

  /* ══ シンガポール航空 ══ 機長・副操縦士の求人に「報酬」の節そのものが無い。
     金銭に触れるのは "more than just a competitive salary" だけで金額なし。 */
  'singapore-airlines': {
    cur: 'USD',
    tax: '課税（シンガポール）',
    src: [],
    notes: [],
    notes_en: [],
    cap: { tier: 'held', held: { was: { avg: 3400, lo: 2750, hi: 4150 },
      why: '公式の採用ページに報酬の節そのものが無く、金額の記載が1件も無い。レンジの出所の記録も無い。' } },
    fo: { tier: 'held', held: { was: { avg: 1850, lo: 1100, hi: 2280 },
      why: '機長と同じ理由。' } },
  },

  /* ══ ガルフ・エア ══ パイロットの募集そのものが1件も無い（2026-09-26 時点）。
     ＝公式には金額も応募要件も存在しない。数字を埋めない。 */
  'gulf-air': {
    cur: 'USD',
    tax: '非課税（バーレーンに個人所得税なし）',
    src: [],
    notes: [],
    notes_en: [],
    cap: { tier: 'held', held: { was: { avg: 2700, lo: 2300, hi: 3300 },
      why: 'パイロットの募集が1件も無く、公式に金額が存在しない。レンジの出所の記録も無い。' } },
    fo: { tier: 'held', held: { was: { avg: 1500, lo: 1250, hi: 1850 },
      why: '機長と同じ理由。' } },
  },

  /* ══ カタール航空 ══ 金額が1件も無い。
     現行の採用サイト（求人384件・運航乗務は2件）・過去の公式求人6件・
     第三者の求人掲示3件のすべてで、金額を含む文が0件。
     報酬に触れた唯一の文が "We offer competitive remuneration…"（2024-11-26）と
     「待遇は対面のロードショーで説明する」という書き方。
     ⚠️ 手当は名前だけ公表されている（2011年の flight deck ページに9項目）。
        本サイトが書いている教育手当「21歳まで」は、辿れるのが第三者のまとめサイトだけで
        カタール航空の文書に行き当たらない。★ここは触らないこと（オーナー明示指示）。
        「子3人まで」はサウディアの2005年広告の条件なので、カタールに当てはめない。 */
  'qatar-airways': {
    cur: 'QAR',
    tax: '非課税（カタールに個人所得税なし）',
    src: [],
    notes: [],
    notes_en: [],
    cap: { tier: 'held', held: { was: { avg: 2900, lo: 2600, hi: 4800 },
      why: '公式・過去の公式求人・第三者掲示のすべてで金額が0件。レンジの出所の記録も無い。加えてページ内で「住宅・教育手当を含めた実質パッケージ2,900万」なのに含まないはずのレンジ上限が4,800万で、同じページの中で矛盾している。' } },
    fo: { tier: 'held', held: { was: { avg: 2050, lo: 1850, hi: 2700 },
      why: '機長と同じ理由。' } },
  },

  /* ══ オマーン航空 ══ 2017年の募集広告が1件だけ。現行の公式には金額ゼロ。
     公式の採用システムは 502 を返して読めない（サーバ側の故障）。 */
  'oman-air': {
    cur: 'GBP',
    tax: '課税（王令 56/2025。2028年初から課税所得の5%・年 OMR 42,000 が基準額）',
    src: [
      { pub: '航空会社の募集広告（採用パートナー L3 経由）を第三者サイト FlightDeckFriend が再掲したもの',
        name: 'Oman Air Pilot Recruitment — B737 NG First Officers / Direct Entry Captain',
        as_of: '2017-06-28 掲載（★ページに「募集終了」と書かれている）', accessed: '2026-09-29',
        url: 'https://www.flightdeckfriend.com/job/oman-air-b737-first-officers/' },
    ],
    notes: [
      '2017年の、しかも募集終了済みの広告です。現在の水準ではありません。',
      '原文は "approx.（約）" 付きの額で、基本給・住宅手当・パイロット手当の3つの合計と読めます。',
      '月に飛んだ時間による日当（per diem）はこの額の上に乗ります。含まれていません。',
      '所得補償・社員旅行特典・年次有給36日＋祝日10日・教育補助・医療および傷害保険は別掲で、この額に入っていません。',
      '前提となる月間の乗務時間は書かれていません。税引き前か後かも書かれていません。',
      '機種は B737 NG、契約は2年・更新可、通貨は英ポンドです。',
    ],
    notes_en: [
      'This is a 2017 advert, and the page itself says applications have closed. It is not a current figure.',
      'The original is an "approx." figure and reads as the sum of three cash items: basic pay, housing allowance and pilot allowance.',
      'Per diems based on hours flown in a month sit on top of this figure and are not included.',
      'Income protection, staff travel, 36 days of annual leave plus 10 public holidays, education assistance and medical and personal accident insurance are listed separately and are not in this figure.',
      'No assumed monthly flying hours are stated, and the advert does not say whether the figure is before or after tax.',
      'The type is the B737 NG, the contract two years renewable, and the currency is pounds sterling.',
    ],
    cap: {
      tier: 'past_ad',
      groups: [
        { name: '機長 B737 NG（2017年・募集終了）', reward_y: 90000,
          req: '多人数運航機の機長時間 5,000時間・同型 500時間・25歳以上55歳未満・英語能力証明レベル4以上' },
      ],
      held: { was: { avg: 2500, lo: 2100, hi: 3000 },
        why: '2017年の広告の約1,951万円がこのレンジの下端を下回る。レンジと平均そのものを支える資料は無い。' },
    },
    fo: {
      tier: 'past_ad',
      groups: [
        { name: '副操縦士 B737 NG（2017年・募集終了）', reward_y: 65000,
          req: '多人数運航機 1,500時間・同型 300時間・46歳未満・英語能力証明レベル4以上' },
      ],
      held: { was: { avg: 1400, lo: 1150, hi: 1750 },
        why: '2017年の広告の約1,409万円はこのレンジの中に入るだけ。レンジと平均そのものを支える資料は無い。' },
    },
  },

  /* ══ サウディア ══ 会社自身が金額を印字した資料は2005年の広告1本だけ。
     現行の採用サイト（求人6件・運航乗務は国籍限定の Cadet のみ）に金額は無い。
     ★この広告は「基本給」と「基本給の上に付く21項目」を公式に分けており、
       乗務時間の前提（65〜75時間保証）まで書いてある。形としては
       エミレーツ・エティハドに最も近いが、21年前の資料である。 */
  'saudia': {
    cur: 'SAR',
    tax: '非課税（サウジアラビアに個人所得税なし）',
    src: [
      { pub: 'サウディア（Saudi Arabian Airlines・自社サイト）', name: 'Advert – Captains',
        as_of: '2005年（著作権表記）・保存 2006-03-16', accessed: '2026-09-29',
        url: 'http://www.saudiairlines.com/aboutus/advert_captains_1.jsp' },
    ],
    notes: [
      '2005年の広告です。現在の給与ではありません。',
      '掲載しているのは「月額の基本給（Monthly Base Pay）」だけです。飛行手当など21項目は、会社自身が「基本給の上に付くもの」として別に並べています。',
      '会社は「12.3か月分・非課税」「機種グループにより月65〜75時間の乗務を保証」と書いています。',
      '契約は3年・更新可。契約完了手当が月 US$1,432（機長）／US$591.25（副操縦士）。',
      '教育補助は王国内の学校・子3人まで。応募は53歳未満（53〜55歳は該当機種の FAA 型式限定が必要）。',
    ],
    notes_en: [
      'This is a 2005 advert. It is not current pay.',
      'What we show is the Monthly Base Pay only. The airline itself lists 21 further items as benefits "over and above Base pay".',
      'The airline states a "12.3 months tax free salary" and guaranteed monthly flying hours of 65–75 depending on aircraft group.',
      'The contract is three years renewable, with a completion bonus of US$1,432 a month for captains and US$591.25 for first officers.',
      'Education subsidy is for in-Kingdom schooling, up to three children. Applicants must be under 53 (53–55 requires the relevant FAA type rating).',
    ],
    cap: {
      tier: 'past_ad',
      groups: [
        { name: '機長 B747 Classic / MD-11（2005年・月額の基本給）', base_m: 19587,
          req: '2005年当時の広告。現行の機長要件は総6,000時間ほか（金額の記載は無い）' },
        { name: '機長 EMB170（2005年・月額の基本給）', base_m: 16107 },
      ],
      held: { was: { avg: 3300, lo: 2700, hi: 4200 },
        why: '2005年の基本給しか資料が無く、年額を支える資料は無い（基本給に21項目が乗るので、基本給から年収は出せない）。レンジの出所の記録も無い。' },
    },
    fo: {
      tier: 'past_ad',
      groups: [
        { name: '副操縦士 B747 Classic / MD-11（2005年・月額の基本給）', base_m: 13475 },
      ],
      held: { was: { avg: 1800, lo: 1450, hi: 2300 },
        why: '機長と同じ理由。' },
    },
  },

  /* ══ 大韓航空 ══ 公式の求人2本（募集中・受付終了）とも金額ゼロ。
     採用サイトに「報酬体系」という専用ページがあるが、中身は見出しと画像だけで本文が1行も無い。
     サイトマップの全26ページを機械で探して、給与・年俸・報酬・手当・万ウォン・億ウォンが1件もヒットしない。
     ⚠️ 有価証券報告書（2026-03-18 提出）の「1人平均給与額 1億4,900万ウォン」を機長の年収に使わない。
        あれは「航空運送事業・男性」の行で、整備士・地上職・客室乗務員を含む全男性社員をならした数字。
        報告書の表は事業部門×性別までしか割っておらず、運航乗務職の行は構造として存在しない。
     ⚠️ 操縦士の労働組合は一般職の組合と別で、2026-09 時点で調停申請の段階。賃金表は公表されていない。 */
  'korean-air': {
    cur: 'KRW',
    tax: '課税（韓国・6〜45%）',
    src: [], notes: [], notes_en: [],
    cap: { tier: 'held', held: { was: { avg: 2450, lo: 1850, hi: 2750 },
      why: '公式の求人・採用サイト全26ページ・有価証券報告書のすべてで、パイロットの金額が0件。レンジの出所の記録も無い。' } },
    fo: { tier: 'held', held: { was: { avg: 1250, lo: 950, hi: 1430 }, why: '機長と同じ理由。' } },
  },

  /* ══ タイ国際航空 ══ 公式の2026年募集に金額ゼロ。
     ★会社自身が「給与体系に従った給与を受け取る」と書くだけで、金額も体系も公開していない
       （Student Pilot FAQ）。応募ポータルのデータの型に、給与を入れる欄がそもそも無い。
     公式に出ている金額は受験料・身体検査料など、受験者が払う費用だけ。 */
  'thai-airways': {
    cur: 'THB',
    tax: '課税（タイ）',
    src: [], notes: [], notes_en: [],
    cap: { tier: 'held', held: { was: { avg: 1850, lo: 1500, hi: 2420 },
      why: '公式の募集要項・応募ポータル・自社養成の案内のすべてで金額が0件。会社は「給与体系に従う」と書くだけで体系も公開していない。レンジの出所の記録も無い。' } },
    fo: { tier: 'held', held: { was: { avg: 880, lo: 660, hi: 1140 }, why: '機長と同じ理由。' } },
  },

  /* ══ エア・インディア ══ 会社名義の採用サイトの現役パイロット求人4本とも金額ゼロ
     （全文を取得して salary / CTC / ₹ / lakh / per month / package を機械検索して0件。
      数字として出るのは飛行時間と年齢上限だけ）。
     ⚠️ その4本は本文に "This opportunity is with Air India Express." と書かれており、
        エア・インディア本体の運航乗務の求人は現在1本も出ていない。
     ⚠️ 「₹85 lakh〜₹1.8 crore」等はすべて第三者の推計。会社の資料に対応する原文は無い。 */
  'air-india': {
    cur: 'INR',
    tax: '課税（インド）',
    src: [], notes: [], notes_en: [],
    cap: { tier: 'held', held: { was: { avg: 1550, lo: 1100, hi: 2000 },
      why: '会社名義の求人4本すべてで金額が0件。レンジの出所の記録も無い。' } },
    fo: { tier: 'held', held: { was: { avg: 720, lo: 540, hi: 900 }, why: '機長と同じ理由。' } },
  },

  /* ══ 中国南方航空 ══ 公式サイトは金額ゼロ（募集中14件・パンフレット10件・
     過去分を含むお知らせ2,038件を全件取得。パイロット関係83件は全部が候補生選抜の案内で、
     お金に触れているのは「訓練費は会社が負担する」の1行だけ）。英語版の採用ページは無い。
     ★金額があるのは代理店が出した求人だけ。しかも2019年で、広告自身が「草案に基づく要約」と断っている。
     ⚠️ これを「現在の条件」として書かない。副操縦士の求人は1本も無い（機長だけ）。 */
  'china-southern': {
    cur: 'USD',
    tax: '課税（中国）',
    src: [
      { pub: 'パイロット専門の人材会社 Yufeng Consulting（中国・chinaaviationjob.com）が出した求人',
        name: 'A330 / B787 / B777 Captain – China Southern（3ページとも給与表は同一）',
        as_of: '2019-08-16 掲載（★広告自身が「新しい契約の草案に基づく要約」と断っている）',
        accessed: '2026-09-29',
        url: 'https://www.chinaaviationjob.com/a330-captain-china-southern/' },
    ],
    notes: [
      '⚠️ 会社の公表ではありません。代理店が2019年に出した求人で、広告自身が「新しい契約の草案に基づく要約」と断っています。現在の条件ではありません。',
      '月額は年次で上がります（1年目 USD 19,000・2年目 19,000・3年目 20,000・4年目 21,000）。型式未保有での入社は1年目が USD 18,000 です。',
      'この月額のほかに、年 USD 6,000 の安全運航賞と年 USD 10,000 の住宅手当が別建てで付きます。',
      '前提は月間ブロック80時間、基地は広州、契約は4年・更新可。税引き前か後かの記載はありません。',
      '外国人パイロット向けの契約で、通勤便と家族用の年6往復の航空券が付きます。',
      '機長だけの求人です。副操縦士の金額はどの資料にもありません。',
      'このほかに別の代理店（VOR Holdings）が2013年に出した機長の広告があり、月額 USD 18,000〜20,000（手取りと明記）・月160時間超は1時間 USD 225 と書かれています。13年前の資料です。',
    ],
    notes_en: [
      'These are not the airline\u2019s own figures. They come from an agency posting from 2019, and the posting itself says it summarises "the new DRAFT contract elements". They are not current terms.',
      'The monthly figure rises by year of service (USD 19,000 in year one, 19,000 in year two, 20,000 in year three, 21,000 in year four). Joining without the type rating starts at USD 18,000.',
      'On top of the monthly figure there is a USD 6,000 annual safety and operation award and a USD 10,000 annual housing allowance.',
      'It assumes 80 block hours a month, a Guangzhou base and a four-year renewable contract. The posting does not say whether the figure is before or after tax.',
      'It is a contract for foreign pilots, with commuting flights and six return tickets a year for the family.',
      'The posting is for captains only. No figure for first officers appears in any source.',
      'A separate agency (VOR Holdings) advertised captain positions in 2013 at USD 18,000\u201320,000 a month, stated as net, plus USD 225 an hour beyond 160 hours a month. That material is thirteen years old.',
    ],
    cap: { tier: 'past_ad',
      groups: [
        { name: '機長 A330 / B787 / B777・1年目（2019年の代理店求人・月額）', base_m: 19000,
          req: '型式ごとに年齢上限と当該型式の機長時間が決まっている（A330 保有なら57歳・500時間、B737NG からの転換なら50歳・1,500時間など）' },
        { name: '同・1年目（型式未保有での入社）', base_m: 18000 },
        { name: '同・4年目', base_m: 21000 },
      ],
      held: { was: { avg: 2950, lo: 2100, hi: 4700 },
        why: '会社の公表は金額ゼロ。金額があるのは代理店の2019年の求人（しかも草案）と2013年の求人だけで、年額の平均・レンジを支える資料は無い。' } },
    fo: { tier: 'held', held: { was: { avg: 1500, lo: 980, hi: 2100 },
      why: '副操縦士の金額はどの資料にも無い（代理店の求人も機長だけ）。' } },
  },

  /* ══ マレーシア航空 ══ ★パイロットの求人そのものが無い。
     公式の採用ページの入口は客室乗務員・整備士・その他の3つだけ。会社名義の採用システムの
     募集中27件を1件ずつ取得して pilot / captain / first officer / cadet が0件。
     報酬に触れた唯一の1行が「業界水準と経験に見合った競争力のある待遇」で、金額なし。
     自社養成は2026-01-16 で受付終了。訓練費・訓練中の手当・卒業後の給与はいずれも非公表。
     ⚠️ 「2025年8月に新しい給与レンジを確認」「副操縦士 RM72,000〜204,000」等は第三者のまとめ記事が出どころ。 */
  'malaysia-airlines': {
    cur: 'MYR',
    tax: '課税（マレーシア）',
    src: [], notes: [], notes_en: [],
    cap: { tier: 'held', held: { was: { avg: 1900, lo: 1300, hi: 2600 },
      why: 'パイロットの募集そのものが無く（公式の採用システムの27件に1件も無い）、金額を書いた公式資料も無い。レンジの出所の記録も無い。' } },
    fo: { tier: 'held', held: { was: { avg: 1000, lo: 650, hi: 1350 }, why: '機長と同じ理由。' } },
  },

  /* ══ ANA ══ ★有資格パイロットの募集そのものが無い（キャリア採用に運航乗務職の枠が無い）。
     金額があるのは自社養成の新卒募集要項＝訓練生の入社時の月額だけ。
     ⚠️ ANAホールディングスの有報の「一般従業員 276名 7,302千円」を使わない。
        持株会社（管理部門）の全従業員の平均で、しかも全日本空輸からの出向者が主体。
        同じ有報の全日本空輸の職種別の表には、男女の賃金差異・平均年齢・人員構成比しか無く金額が無い。
     ⚠️ 連合の「回答速報」に出る運航乗務職（訓練生）T等級 9,000円は引き上げ額。年収の裏づけにならない。 */
  'ana': {
    cur: 'JPY',
    tax: '課税（日本）',
    src: [
      { pub: '全日本空輸株式会社（ANA 採用サイト）',
        name: '2027年度入社 新卒採用 募集要項（運航乗務職／自社養成パイロット）',
        as_of: '給与欄に「2026年度予定（2026年3月16日更新）」', accessed: '2026-09-29',
        url: 'https://www.ana.co.jp/group/recruit/ana-recruit/occupation/entry/' },
    ],
    notes: [
      'これは自社養成パイロット（運航乗務職）の入社時の額です。機長・副操縦士の金額ではありません。',
      '月額の基本部分だけです。家族手当・住宅手当・深夜労働手当などの諸手当と年3回の賞与は、「支給する」と書かれているだけで金額がありません。',
      '会社は「2026年度予定（2026年3月16日更新）」と書いています。2027年度入社者に確定した額ではありません。',
      '税引き前か後かは書かれていません。',
      '採用人数は65名程度。乗務開始後は東京勤務で、休日は月10日程度です。',
    ],
    notes_en: [
      'This is the starting pay for the airline’s own ab-initio cadet programme. It is not a figure for captains or first officers.',
      'It is the basic monthly figure only. Family, housing and night-work allowances and three bonus payments a year are listed as payable, with no amounts given.',
      'The airline labels it "planned for FY2026, updated 16 March 2026". It is not a confirmed figure for those joining in FY2027.',
      'The posting does not say whether the figure is before or after tax.',
      'About 65 places are offered. Once flying, the base is Tokyo with around ten days off a month.',
    ],
    trainee: { tier: 'employer_example',
      groups: [
        { name: '自社養成パイロット訓練生・院卒（入社時）', start_m: 276528,
          req: '2027年4月1日入社予定・FCAT 受験が必須・プレエントリー締切 2026年3月10日' },
        { name: '自社養成パイロット訓練生・大卒／高等専門学校（専攻科）卒（入社時）', start_m: 267770 },
      ] },
    cap: { tier: 'held', held: { was: { avg: 2700, lo: 2200, hi: 3500 },
      why: '有資格パイロットの募集そのものが無く（キャリア採用に運航乗務職の枠が無い）、機長の金額を書いた公式資料が1件も無い。有報にもパイロットの数字は無い。レンジの出所の記録も無い。' } },
    fo: { tier: 'held', held: { was: { avg: 1800, lo: 1400, hi: 2100 }, why: '機長と同じ理由。' } },
  },

  /* ══ JAL ══ ★★ サイトで初めて「平均」と書ける根拠。
     有価証券報告書の【従業員の状況】に、地上社員・運航乗務員・客室乗務員を分けた
     平均年間給与が載っている（＝第三者の推計ではなく会社が出した数字で、
     母集団・期間・算定方法の3つが確認できる）。
     ⚠️ ただし機長と副操縦士を分けていない。職位別の平均としては使えない。
     ⚠️ 日本航空単体の「常勤社員 14,431名 9,494千円」は全従業員の平均。パイロットの数字ではない。 */
  'jal': {
    cur: 'JPY',
    tax: '課税（日本）',
    src: [
      { pub: '日本航空株式会社（EDINET・有価証券報告書）',
        name: '第76期 有価証券報告書 ５【従業員の状況】（参考情報）平均年間給与',
        as_of: '2025年3月期（2025年6月23日提出・書類ID S100W1KL）', accessed: '2026-09-29',
        url: 'https://disclosure2dl.edinet-fsa.go.jp/searchdocument/pdf/S100W1KL.pdf' },
      { pub: '日本航空株式会社（EDINET・有価証券報告書）',
        name: '第75期 有価証券報告書 ５【従業員の状況】（参考情報）平均年間給与',
        as_of: '2024年3月期（2024年6月19日提出・書類ID S100TNGJ）', accessed: '2026-09-29',
        url: 'https://disclosure2dl.edinet-fsa.go.jp/searchdocument/pdf/S100TNGJ.pdf' },
      { pub: '日本航空株式会社（JAL 採用サイト）',
        name: '運航乗務員訓練生（自社養成パイロット）募集要項',
        as_of: '給与欄に「※2026年3月27日時点」', accessed: '2026-09-29',
        url: 'https://www.job-jal.com/recruit/requirement/new-graduate05.html' },
    ],
    notes: [
      'これは機長と副操縦士をあわせた運航乗務員全体の平均です。機長だけ・副操縦士だけの平均は公表されていません。',
      '日本航空単体ではなくグループ連結の数字です（会社が注でそう書いています）。',
      '算定方法は会社の注のとおり「連結人件費に含まれる現金給与相当額を当事業年度中の平均在籍人数で除して算出」＝税引き前の考え方です。賞与・手当を含むかは注に明記がありません。',
      '訓練生の額は運航乗務員訓練生の入社時の月額で、機長・副操縦士の金額ではありません。事業用操縦士免許を保有または過去に取得した人は応募できません。',
      '採用予定数は2027年度入社で新卒・キャリア合計50名程度、乗務開始後の休日は原則月10日です。',
    ],
    notes_en: [
      'This is the average for flight crew as a whole, captains and first officers together. The airline does not publish a separate average for either rank.',
      'It covers the JAL group on a consolidated basis, not Japan Airlines alone — the filing says so in its note.',
      'The airline states the method: cash-equivalent pay within consolidated personnel costs, divided by the average headcount on the books during the year. That is a pre-tax basis. The note does not say whether bonuses and allowances are included.',
      'The trainee figure is the starting monthly pay for a flight-crew trainee, not a figure for captains or first officers. Anyone who holds or has held a commercial pilot licence cannot apply.',
      'About 50 places are offered for FY2027 across graduate and career intake, with around ten days off a month once flying.',
    ],
    crew: { tier: 'observed_mean',
      groups: [
        { name: '運航乗務員（グループ連結・2025年3月期）', avg_y: 20051000 },
        { name: '運航乗務員（グループ連結・2024年3月期）', avg_y: 19593000 },
      ] },
    trainee: { tier: 'employer_example',
      groups: [{ name: '運航乗務員訓練生（入社時）', start_m: 263000,
        req: '矯正視力1.0以上・屈折度 -6.0〜+2.0ジオプトリー・事業用操縦士免許の保有者および過去に取得した者は応募不可' }] },
    cap: { tier: 'held', held: { was: { avg: 2700, lo: 2200, hi: 3500 },
      why: '会社が公表しているのは機長と副操縦士をあわせた運航乗務員全体の平均で、職位別の平均は公表されていない。機長の募集要項そのものが無く（ライセンス保有者枠は「在籍中の各養成機関に問い合わせ」とだけ）、金額も無い。レンジの出所の記録も無い。' } },
    fo: { tier: 'held', held: { was: { avg: 1800, lo: 1400, hi: 2100 }, why: '機長と同じ理由。' } },
  },

  /* ══ スカイマーク ══ ★★ ここも有報に運航乗務員だけの平均年間給与がある。
     しかも会社が注で前提を4つ書いている（単体・訓練生を除く・人材会社からの受入出向を
     金額の計算から除く・賞与および基準外賃金を含む）＝算定方法が確認できる。
     ⚠️ 機長と副操縦士は分かれていない。
     ⚠️ 経験者採用（B737機長・副操縦士候補）は会社が「給与 非公開」「当社規程による」と書いている。 */
  'skymark': {
    cur: 'JPY',
    tax: '課税（日本）',
    src: [
      { pub: 'スカイマーク株式会社（EDINET・有価証券報告書）',
        name: '第29期 有価証券報告書 【従業員の状況】（1）提出会社の状況',
        as_of: '2025年3月31日現在（2025年6月26日提出・書類ID S100W68U）', accessed: '2026-09-29',
        url: 'https://disclosure2dl.edinet-fsa.go.jp/searchdocument/pdf/S100W68U.pdf' },
      { pub: 'スカイマーク株式会社（採用サイト）', name: '自社養成パイロット訓練生 募集要項',
        as_of: '掲載時点の記載なし', accessed: '2026-09-29',
        url: 'https://www.skymark.co.jp/ja/company/recruit/saiyo/recruit/' },
    ],
    notes: [
      'これは機長と副操縦士をあわせた運航乗務員290名の平均です。機長だけ・副操縦士だけの平均は公表されていません。',
      'スカイマーク単体（提出会社）の数字で、会社の注により訓練生は人数から除かれています。',
      '人材会社からの受入出向の運航乗務員は、人数には含まれますが金額の計算からは除かれています（会社の注）。',
      '賞与および基準外賃金を含みます（会社の注）。時点は2025年3月31日現在です。',
      '訓練生の額は基本給で、確定拠出年金選択金を含みます（会社がそう書いています）。会社は「訓練開始以降は変動あり」とも書いています。',
      '経験者採用（B737の機長候補・副操縦士候補）の給与は、会社が「非公開」「当社規程による」としています。',
    ],
    notes_en: [
      'This is the average for 290 flight crew, captains and first officers together. The airline does not publish a separate average for either rank.',
      'It covers Skymark alone, and the filing’s note excludes trainees from the headcount.',
      'Flight crew seconded from staffing agencies are counted in the headcount but excluded from the pay calculation, as the filing states.',
      'Bonuses and non-standard wages are included, per the filing’s note. The figure is as at 31 March 2025.',
      'The trainee figure is basic pay and includes the defined-contribution pension election amount, as the airline states. The airline also notes it varies once training begins.',
      'For experienced hires (B737 captain and first officer candidates) the airline states that pay is not disclosed and follows internal rules.',
    ],
    crew: { tier: 'observed_mean',
      groups: [{ name: '運航乗務員 290名（スカイマーク単体・2025年3月31日現在）', avg_y: 16456000 }] },
    trainee: { tier: 'employer_example',
      groups: [{ name: '自社養成パイロット訓練生・院卒／大卒（入社時の基本給）', start_m: 250000,
        req: 'TOEIC 750点以上または IELTS Overall 6.0以上・矯正視力0.7以上（両眼1.0以上）・事業用操縦士免許保有者は応募不可' }] },
    cap: { tier: 'held', held: { was: { avg: 1900, lo: 1600, hi: 2300 },
      why: '会社が公表しているのは機長と副操縦士をあわせた運航乗務員全体の平均で、職位別の平均は公表されていない。経験者採用の求人は「給与 非公開」「当社規程による」で金額が無い。レンジの出所の記録も無い。' } },
    fo: { tier: 'held', held: { was: { avg: 950, lo: 700, hi: 1200 }, why: '機長と同じ理由。' } },
  },

  /* ══ J-AIR ══ 金額があるのは訓練生の募集要項1本だけで、会社自身が
     「募集は終了しております。前回分を参考までに掲載します。」と書いている。
     しかも「入社後の初期訓練期間中」に限った額。機長の募集要項は
     「当社規程による／給与等は選考における面接時に説明いたします」で金額が無い。
     非上場で有価証券報告書が無く、親会社 JAL の有報にも J-AIR の職種別給与は無い。 */
  'j-air': {
    cur: 'JPY',
    tax: '課税（日本）',
    src: [
      { pub: '株式会社ジェイエア（採用サイト）',
        name: '運航乗務員訓練生（自社養成パイロット）募集要項',
        as_of: 'ページ冒頭に「募集は終了しております。前回分を参考までに掲載します。」', accessed: '2026-09-29',
        url: 'https://www.jair.co.jp/about/recruit/pilot/apply02.html' },
    ],
    notes: [
      '会社自身が「募集は終了しております。前回分を参考までに掲載します。」と書いている要項の額です。現在の額とは書かれていません。',
      '「入社後の初期訓練期間中」に限った額です。訓練が進んだあとの額ではありません。',
      '諸手当の項目そのものがありません。税引き前か後かも書かれていません。',
      '副操縦士に発令されるまでは契約社員で、発令後に正社員になります（会社の要項）。',
      '機長の募集要項は「当社規程による」「給与等は選考における面接時に説明いたします」で、金額がありません。',
    ],
    notes_en: [
      'The airline itself marks this posting "applications closed — the previous round is shown for reference". It is not stated as a current figure.',
      'It applies only to the initial training period after joining, not to later stages.',
      'There is no allowances section at all, and the posting does not say whether the figure is before or after tax.',
      'Trainees are on fixed-term contracts until they are appointed first officer, after which they become permanent staff.',
      'For captains the posting states that pay follows internal rules and is explained at interview, with no amount given.',
    ],
    trainee: { tier: 'past_ad',
      groups: [{ name: '運航乗務員訓練生（入社後の初期訓練期間中・募集終了の要項）', train_m: 221100,
        req: '採用予定数15名程度・矯正視力0.7以上（両眼1.0以上）・事業用操縦士免許保有者は応募不可・入社要件に IELTS と航空無線通信士' }] },
    cap: { tier: 'held', held: { was: { avg: 2000, lo: 1800, hi: 2300 },
      why: '機長の募集要項は「当社規程による」「面接時に説明」で金額が無い。非上場で有価証券報告書が無く、親会社の有報にも職種別の給与が無い。レンジの出所の記録も無い。' } },
    fo: { tier: 'held', held: { was: { avg: 1250, lo: 1100, hi: 1500 }, why: '機長と同じ理由。' } },
  },

  /* ══ ジェットスター・ジャパン ══ 会社名義の募集要項は2016年のもの1本だけで、
     ★給与の節そのものが存在しない（全文を読んで確認）。
     現行の採用サイトは接続できず、採用管理システムの求人は0件。非上場で有報も無い。
     ⚠️ ページに書いてある「副操縦士の月額基本給 ¥150万」は出所が無く、同じページの
        副操縦士の上限1,600万と矛盾する（×12＝1,800万）。英語版は ¥125万で日英も食い違う。 */
  'jetstar-japan': {
    cur: 'JPY',
    tax: '課税（日本）',
    src: [], notes: [], notes_en: [],
    cap: { tier: 'held', held: { was: { avg: 2400, lo: 2000, hi: 2900 },
      why: '会社名義の募集要項（2016年）に給与の節そのものが無い。現行の採用サイトは読めず、採用管理システムの求人は0件。非上場で有価証券報告書も無い。レンジの出所の記録も無い。' } },
    fo: { tier: 'held', held: { was: { avg: 1450, lo: 1250, hi: 1600 },
      why: '機長と同じ理由。加えて、ページに書いてあった「副操縦士の月額基本給 ¥150万」は出所が無く、同じページの上限1,600万と矛盾していた（×12＝1,800万）。' } },
  },

  /* ══ Peach ══ ★金額があるのは「チャレンジ手当」だけで、これは給与ではない。
     会社自身が「海外訓練期間中の生活費等の支援を目的に」支給するものだと書いている。
     ⚠️ 同じ制度概要ページに、訓練費用約1,460万円（2022年度実績）が本人負担のローンだと書いてある。
     機長の求人は「当社規定による（詳細については、選考時に説明します）」。
     ⚠️ 副操縦士の募集そのものが無い（機長と自社養成だけ）。非上場で有報も無い。 */
  'peach': {
    cur: 'JPY',
    tax: '課税（日本）',
    src: [
      { pub: 'Peach Aviation株式会社（採用サイト）', name: 'パイロットチャレンジ制度 応募要領',
        as_of: 'ページ冒頭に「2023年度採用選考は終了いたしました。」', accessed: '2026-09-29',
        url: 'https://recruit.flypeach.com/recruiting_momotane/info.html' },
    ],
    notes: [
      'これは給与ではなく「チャレンジ手当」です。会社は「海外訓練期間中の生活費等の支援を目的に、訓練期間中はチャレンジ手当を約24か月支給」と書いています。',
      '対象はライセンス取得前の訓練生で、初回2年の有期契約です。機長・副操縦士の金額ではありません。',
      '⚠️ 訓練費用は本人負担です。会社は「訓練費用約1,460万円（2022年度実績）」に提携ローンが用意されていると書いています（後半の国内訓練分は全額 Peach 負担）。',
      '賞与は「あり」とだけ書かれ、金額がありません。税引き前か後かも書かれていません。',
      '2023年度の選考は終了しています。次回の条件とは書かれていません。',
      '機長の求人の給与は「当社規定による（詳細については、選考時に説明します）」で、金額がありません。副操縦士の募集そのものがありません。',
    ],
    notes_en: [
      'This is not salary. The airline calls it a "challenge allowance" and says it is paid for about 24 months to support living costs during overseas training.',
      'It applies to trainees before they hold a licence, on an initial two-year fixed-term contract. It is not a figure for captains or first officers.',
      'Training costs fall on the trainee. The airline states training costs of about 14.6 million yen (FY2022 actual), with a partner bank loan available; Peach covers the later domestic phase in full.',
      'A bonus is listed as payable with no amount. The posting does not say whether the figure is before or after tax.',
      'The FY2023 intake is closed, and the terms are not stated as applying to the next round.',
      'For captains the posting says pay follows internal rules and is explained during selection, with no amount. There is no first officer vacancy at all.',
    ],
    trainee: { tier: 'employer_example',
      groups: [{ name: 'パイロットチャレンジ制度の訓練生（有期契約・ライセンス取得前）', allow_train_m: 250000,
        req: '2027年4月1日時点で矯正視力0.7以上（両眼1.0以上）・ジオプトリ -5.5〜+4.5・GTEC 660点相当程度・事業用および自家用操縦士免許の非保有・FCAT 合格・募集人数は若干名' }] },
    cap: { tier: 'held', held: { was: { avg: 2350, lo: 2000, hi: 2800 },
      why: '機長の求人の給与が「当社規定による（選考時に説明）」で金額が無い。非上場で有価証券報告書も無く、親会社の有報にも職種別の給与が無い。レンジの出所の記録も無い。' } },
    fo: { tier: 'held', held: { was: { avg: 1400, lo: 1000, hi: 1600 },
      why: '副操縦士の募集そのものが無いので、会社の資料に金額が存在しない。レンジの出所の記録も無い。' } },
  },

  /* ══ ZIPAIR ══ 公式の募集要項に給与の節はあるが、金額が書かれていない
     （「当社規程により支給。詳細については、選考における面接時に説明します。」）。
     非上場で有報が無く、親会社 JAL の有報にも ZIPAIR の職種別給与は無い。 */
  'zipair': {
    cur: 'JPY',
    tax: '課税（日本）',
    src: [], notes: [], notes_en: [],
    cap: { tier: 'held', held: { was: { avg: 2500, lo: 2200, hi: 3100 },
      why: '公式の募集要項の給与の節が「当社規程により支給。詳細については、選考における面接時に説明します。」で金額が無い。非上場で有価証券報告書も無い。レンジの出所の記録も無い。' } },
    fo: { tier: 'held', held: { was: { avg: 1500, lo: 1200, hi: 1900 }, why: '機長と同じ理由。' } },
  },
};

/* ── 読む側のための小物 ───────────────────────────────────────── */

/** その会社・その職位について「画面に出していい金額」を、言い方つきで返す。
    ★ 円に直すのも、言い方を決めるのもここ1か所。各スクリプト・各ページに写さない。
    ⚠️ 月額×12 と年額を一致させない（公表値をそのまま並べる）。
    ⚠️ pkg_y に現金給与や住宅・学費をもう一度足さない。12で割って月給と呼ばない。 */
export function figures(slug, rank) {
  const b = BASIS[slug], r = b?.[rank];
  if (!r?.groups) return [];
  const out = [];
  for (const g of r.groups) {
    for (const key of Object.keys(KINDS)) {
      if (g[key] == null) continue;
      out.push({ group: g.name, key, kind: KINDS[key], cur: b.cur, amount: g[key],
        man: man(b.cur, g[key]), text: manText(b.cur, g[key]), training: !!g.training });
    }
    /* 月額 × か月数（スターラックスの13か月給与）。月額と年額の両方を出す。 */
    if (g.month != null) {
      out.push({ group: g.name, key: 'month', kind: '月額', cur: b.cur, amount: g.month,
        man: man(b.cur, g.month), text: manText(b.cur, g.month), training: !!g.training });
      if (g.months != null) {
        const y = g.month * g.months;
        out.push({ group: g.name, key: 'month_x', kind: `月額 × ${g.months}か月`, cur: b.cur,
          amount: y, man: man(b.cur, y), text: manText(b.cur, y), cond: g.cond, training: !!g.training });
      }
    }
  }
  return out;
}

/** 年額として通る金額だけ（月額・月手当は外す）。文章で「年収は…」と言うときに使う。 */
const YEARLY = new Set(['cash_y', 'pkg_y', 'max_y', 'target_y', 'cash_y_over', 'reward_y', 'month_x', 'avg_y']);
export const yearly = (slug, rank) => figures(slug, rank).filter((f) => YEARLY.has(f.key));

/** その会社・その職位が確認中か。国別平均・順位・倍率から外す判定に使う。 */
export const isHeld = (slug, rank) => (BASIS[slug]?.[rank]?.tier ?? null) === 'held';

/** 平均として表示していいか（tier が observed_mean のときだけ true）。 */
export const canSayAverage = (slug, rank) => {
  const t = BASIS[slug]?.[rank]?.tier;
  return t ? !!TIERS[t]?.avg : false;
};

/** 確認中に落ちた（会社, 職位, 元の値）の一覧。報告と検査に使う。 */
export function heldList() {
  const out = [];
  for (const [slug, b] of Object.entries(BASIS)) {
    for (const rank of ['cap', 'fo']) {
      const r = b[rank];
      if (!r?.held) continue;
      out.push({ slug, rank, tier: r.tier, was: r.held.was, why: r.held.why });
    }
  }
  return out;
}

export default BASIS;
