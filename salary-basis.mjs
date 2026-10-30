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
     出所・対象・計算方法が確認できない       → 公開数値を「推定」・元の値は held.was に残す

   ── ★2026-09-30 オーナー指示で上書き ────────────────────────────
   「なんで各航空会社の機長、FOの平均年収を確認中にしちゃうんだよ。
     確認中じゃなくて推定とかにすりゃいいじゃん。」

   ここは2026-09-29 に「出所を確認できない数字は画面から金額ごと下げる（確認中）」と
   実装した。25社×2職位のうち36件が金額ごと消え、ランキング・レベリング図・国別平均も
   一緒に落ちた。オーナーの指示はその取り消しではなく、**線の引き直し**:

     やめるのは「平均」と名乗ること。やめるのは「数字を出すこと」ではない。

   だから等級 estimate（推定）を足し、held の36件をそこへ移した。
   ⚠️ 上の「⚠️『参考値』『推計平均』への言い換えで残さない」は、この指示より前のもの。
      **今も生きているのは「平均」の語のほう**（canSayAverage は observed_mean だけ）。
      数字そのものは「推定」として出す。
   ⚠️ この2つを1つの関数で決め直さない。canSayAverage（平均と名乗ってよいか）と
      canPublishNumber（金額を公開用JSONに流してよいか）は別のことを聞いている。
   ────────────────────────────────────────────────────────────

   ⚠️ 「矛盾する資料が見つからない」は掲載根拠にならない。
   ⚠️ SSOT と一致するだけで「事実確認済み」と数えない。
   ⚠️ 推定に落とした数値を 0 や空欄にしない。held.was に元の値を残す（履歴を消さない）。
   ⚠️ 等級 held は残してある。本当に数字が1つも無い会社のために要る。
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
  estimate:         { ja: '推定',         en: 'Estimated',        avg: false },
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

/** KINDS の英語。英語ページと、検索エンジンに渡す機械可読の欄で使う。
    ★ KINDS に鍵を足したらここにも足す（無い鍵は英語側で鍵名がそのまま出る）。 */
export const KINDS_EN = {
  cash_y:       'cash pay, annual',
  cash_m:       'cash pay, monthly',
  pkg_y:        'total package, annual (includes the cash pay)',
  max_y:        'maximum quoted in the vacancy, annual',
  target_y:     'target annual salary',
  allow_m_from: 'monthly allowance (only the lower bound is published)',
  cash_y_over:  'annual pay (the figure the airline says is exceeded)',
  reward_y:     'annual reward (approx., three cash items combined)',
  base_m:       'basic pay, monthly',
  avg_y:        'average annual pay published by the airline',
  start_m:      'starting pay, monthly',
  train_m:      'monthly pay during initial training',
  allow_train_m: 'training allowance, monthly (not a salary)',
};

/** 原貨 → 万円（比較用）。★ここ以外で円に直さない。 */
export const man = (cur, amount) => Math.round((amount * JPY_PER[cur]) / 10000);
/** 「約2,489万円」の形。 */
export const manText = (cur, amount) => `約${man(cur, amount).toLocaleString('en-US')}万円`;

/** 換算の断り書き。画面に出す。 */
/* lang 'en'（2026-10-22 d2 ＝ EN-2）は英語のページの言い方（英語の会社ページに今ある注と同じ形） */
export const fxNote = (cur, lang = 'ja') => (lang === 'en'
  ? `Yen amounts are converted for comparison at 1 ${cur} = ${JPY_PER[cur]} JPY as of ${FX_AS_OF}, and are not a current exchange rate.`
  : `円額は比較用の換算です（1 ${cur}＝${JPY_PER[cur]}円・${FX_AS_OF} 時点）。現在の為替レートではありません。`);

/* ────────────────────────────────────────────────────────────────
   BASIS
     src[]   画面に出す出所：発行元 pub / 資料名 name / 適用時点 as_of /
             確認日 accessed / リンク url。★確認日 ≠ 発行日。
             secondary: true は「会社の公表ではない資料」（報道など・推定の根拠）の印。
             ⚠️ 「会社が公表している金額」の出どころとして並べない（career.html は外している）。
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
     est     ★2026-10-05（会社ページ改良・主要5社）。**推定年収に添える 根拠・算出方法・時点**の記録。
             { basis, method, as_of } の3つがそろった職位にだけ置く。
               basis ＝ 根拠（何を読んだか）／method ＝ 算出方法（1文）／as_of ＝ いつの話か。
             ⚠️ 額はここに書かない（推定の数字は salary-data.mjs の SALARY が正）。
             ⚠️ 1つでも欠けたら est を置かず、est_status: 'unconfirmed' と est_why を置く。
             ★2026-10-06 オーナー指示「年収のところ確認中にするなよ」（2026-09-30 のご判断と同じ）。
                読む側（pv-airline-view.mjs）は、est が在っても無くても**推定年収を額で出す**。
                est が決めるのは、説明の中に 根拠・算出方法・時点 の3行を出すかどうかだけ
                （無い職位は「当サイトの推定（公開情報からの推計）」の1行）。
                ⚠️ est が無いことを理由に、額を「確認中」に戻さない。
             ⚠️ 求人の上限・会社の公表額・乗員全体の平均を est に流し込まない（種類が違う）。
             ⚠️ これを読むのは主要5社の会社ページの新しい塊だけ。ほかの107社と、
                タイトル・FAQ・国別ページは今までどおり tier を読む（＝足しても1文字も変わらない）。
             est_note は、調べて出てきた食い違い（候補）。画面には出さない。
     card    ★2026-10-25。'estimate' のとき、1つの額しか置けない場所（一覧のカード・airlines-meta.js の salary）に
             会社の公表額ではなく**推定年収**（SALARY の avg）を出す。読むのは下の cardFigure() の1か所だけ。
             会社ページの「会社が公表している金額」の一覧・FAQ・説明文は今までどおり groups を読む（変わらない）。
             いま置いているのはエミレーツの機長・副操縦士だけ（下のエミレーツの節）。
     pay_tax ★2026-10-30。資料の額が税引き前でないとき：'net'（手取りと書いてある）／'unknown'（税引き前か手取りか書いていない）。
             無ければ税引き前。読むのは gen-faq.mjs の PAY_TAX の1か所（FAQ が「すべて税引き前」と言い切らないため）。
             ⚠️ 税率で手取り ⇄ 税引き前を作り直さない（推測を数字にすることになる）。
   ──────────────────────────────────────────────────────────────── */
export const BASIS = {

  /* ══ エミレーツ ══ 決定①（オーナー・2026-09-29）
     「公式の現金給与と総待遇を両方掲載する。全社員の平均とは区別する」
     決定②（オーナー・2026-10-25 ── 推定年収の見直し P12.105 の質問1＝③）
     「エミレーツの推定年収は、会社公表の総待遇（社宅込み）ぜんぶ」。SALARY は機長 5,130万・副操縦士 3,900万
     （AED 1,185,000／900,000）。1つの額しか置けない場所も、ほかの推定の会社と同じく「推定」としてこの額を出す
     （card: 'estimate'）── 前は年間の現金給与（2,489万・公式募集例）を出していて、会社ページの推定と食い違っていた。
     会社が公表している金額の一覧（groups）は決定①のまま両方とも載せる。 */
  'emirates': {
    cur: 'AED',
    tax: '非課税（UAE に個人所得税なし）',
    src: [
      { pub: 'エミレーツ航空（Emirates Group Careers）', pub_en: 'Emirates (Emirates Group Careers)',
        name: 'Pilots / Our role details — Direct Entry Captains',
        as_of: '発行日の記載なし', accessed: '2026-09-26',
        url: 'https://www.emiratesgroupcareers.com/pilots/our-role-details/?name=direct-entry-captains' },
      { pub: 'エミレーツ航空（Emirates Group Careers）', pub_en: 'Emirates (Emirates Group Careers)',
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
      'The total package is a valuation that already contains that cash figure plus housing, transport, school fees, medical cover, insurance, leave tickets and the company pension contribution.',
      'The total package is modeled on the pilot, a spouse and two eligible children.',
      'Enhanced applies to first officers who meet a set experience and licensing bar. It is not a figure common to all first officers.',
      'None of these figures is an all-staff average, a guaranteed minimum, or any individual’s final take-home pay.',
    ],
    cap: {
      tier: 'employer_example',
      groups: [
        { name: '直接入社機長', name_en: 'Direct entry captain', cash_y: 575000, cash_m: 48000, pkg_y: 1185000,
          req: '最低総飛行時間 7,000時間・英語能力証明レベル5以上' },
      ],
      card: 'estimate',
      est: {
        basis: 'エミレーツ航空（Emirates Group Careers）の公式募集例「Pilots / Our role details — Direct Entry Captains」',
        basis_en: 'Emirates (Emirates Group Careers) official posting, “Pilots / Our role details — Direct Entry Captains”',
        method: '公式募集例の年間総待遇〈現金給与を含む〉をそのまま推定年収にしています。住宅・交通・学費・医療・保険・休暇航空券・会社の年金拠出等を含めた評価額で、全社員の平均ではありません。',
        method_en: 'The official posting\u2019s total package, annual (includes the cash pay), is used as the estimate as it stands. It is a valuation that includes housing, transport, school fees, medical cover, insurance, leave tickets and the company pension contribution, and is not an all-staff average.',
        as_of: '発行日の記載なし（2026年10月25日に確認）',
        as_of_en: 'No publication date given (checked 25 October 2026)',
      },
      held: { was: { avg: 3700, lo: 3350, hi: 5050 },
        why: '出所の記録が無い。salary-data.mjs は自ら「フリート全体の平均推計」と書いており、どの資料から作ったかが残っていない。出所台帳は「現金給与＋社宅の現物を年収と見ている可能性が高い」と推測しているが、推測は掲載根拠にならない。' },
    },
    fo: {
      tier: 'employer_example',
      groups: [
        { name: '副操縦士・Standard', name_en: 'First officer, Standard', cash_y: 385000, cash_m: 32100, pkg_y: 900000,
          req: '最低総飛行時間 2,000時間・英語能力証明レベル4以上' },
        { name: '副操縦士・Enhanced', name_en: 'First officer, Enhanced', cash_y: 415000, cash_m: 34600, pkg_y: 935000,
          req: '総飛行時間 4,000時間以上（最大離陸重量20トン超のジェット）かつ最大離陸重量50トン超の多人数運航ジェットで2,000時間以上・英語能力証明レベル5以上' },
      ],
      card: 'estimate',
      est: {
        basis: 'エミレーツ航空（Emirates Group Careers）の公式募集例「Pilots / Our role details — First Officers」',
        basis_en: 'Emirates (Emirates Group Careers) official posting, “Pilots / Our role details — First Officers”',
        method: '公式募集例の Standard の年間総待遇〈現金給与を含む〉をそのまま推定年収にしています。住宅・交通・学費・医療・保険・休暇航空券・会社の年金拠出等を含めた評価額で、全社員の平均ではありません。',
        method_en: 'The official posting\u2019s Standard total package, annual (includes the cash pay), is used as the estimate as it stands. It is a valuation that includes housing, transport, school fees, medical cover, insurance, leave tickets and the company pension contribution, and is not an all-staff average.',
        as_of: '発行日の記載なし（2026年10月25日に確認）',
        as_of_en: 'No publication date given (checked 25 October 2026)',
      },
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
    pay_tax: 'unknown',
    cur: 'HKD',
    tax: '課税（香港）',
    src: [
      { pub: 'キャセイパシフィック航空（Cathay Pacific Careers）', pub_en: 'Cathay Pacific (Cathay Pacific Careers)',
        name: 'Our teams / Pilot（First Officer パネル）',
        as_of: '2026年1月時点（脚注 "Latest figures as of Jan 2026, subject to periodic review"）',
        accessed: '2026-09-26',
        url: 'https://careers.cathaypacific.com/en/careers/our-teams/pilot/pilot-detail-page' },
      /* g4 src */
      { pub: 'Aviation A2Z', pub_en: 'Aviation A2Z', name: 'Cathay Pacific Pilot Salary in 2026', name_en: 'Cathay Pacific Pilot Salary in 2026',
        as_of: '2026-04-20 掲載', as_of_en: 'Published 20 April 2026', accessed: '2026-10-29', secondary: true,
        url: 'https://aviationa2z.com/index.php/2026/04/20/cathay-pacific-pilot-salary-2026/' },
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
        { name: '副操縦士（First Officer）', name_en: 'First Officer', target_y: 964646, allow_m_from: 20000,
          req: '最低総飛行時間 1,500時間（3,000時間が望ましい）・うち機長時間 500時間以上・英語能力証明レベル4以上', leave: '年次有給 28日' },
        { name: '二等航空士（Second Officer）', name_en: 'Second Officer', target_y: 629109, allow_m_from: 14000,
          req: '最低総飛行時間 250時間', leave: '年次有給 21日' },
      ],
      est_status: 'unconfirmed',
      est_why: '会社の公表は「目標年収」（目標の飛行時間を飛んだ場合の、入社条件としての額）で、在籍する副操縦士の年収ではない。推定を組み立てる根拠が別に無い。',
      held: { was: { avg: 2400, lo: 1800, hi: 3230 },
        why: '公式の目標年収 HKD 964,646 は約1,956万円で、このレンジの下寄りに入るだけ。レンジと平均そのものを支える資料は無い。' },
    },
    cap: { /* g4 cap */ est: {
        basis: 'Aviation A2Z の記事「Cathay Pacific Pilot Salary in 2026」（2026年4月）',
        basis_en: 'The Aviation A2Z article “Cathay Pacific Pilot Salary in 2026” (April 2026)',
        method: '記事の「経験を積んだ機長は、特に A350・B777 の長距離機で、年の総額が HKD 2,500,000〜3,800,000 に上がる（基本給・長距離の手当・乗務手当などを含む）」の下の端 HKD 2,500,000 を使っています。税引き前か手取りかは書かれていません。幅の上は HKD 3,800,000 です。幅の下は前の値のままです。',
        method_en: 'Set at the lower end, HKD 2,500,000, of the article’s “with increased seniority, particularly on long-haul fleets such as the Airbus A350 and Boeing 777, captains often see total annual earnings rise to between HKD 2,500,000 and HKD 3,800,000 per year”, which it says include base salary, long-haul allowances, duty pay and additional operational incentives. It does not say whether the figures are before or after tax. The top of the range is HKD 3,800,000. The bottom of the range is unchanged.',
        as_of: '2026年4月', as_of_en: 'April 2026',
      },
      tier: 'estimate',
      est_status: 'unconfirmed',
      est_why: '会社は機長の金額をどこにも出していない。見つかったのは報道（基本給の最上位の月額）と匿名の投稿サイトだけで、年収の算出方法が立たない。',
      held: { was: { avg: 3600, lo: 3000, hi: 5650 },
        why: '機長の金額が公式のどのページにも無い（掲載は Cadet / Second Officer / First Officer の3職位のみ）。' },
    },
  },

  /* ══ エティハド ══ 求人（別枠）。「最大」「月75時間」の2条件つき。 */
  'etihad': {
    cur: 'AED',
    tax: '非課税（UAE に個人所得税なし）',
    src: [
      { pub: 'エティハド航空（SmartRecruiters・ref 80371）', pub_en: 'Etihad Airways (SmartRecruiters, ref 80371)', name: 'Captain A320',
        as_of: '2026-07-31 掲載', accessed: '2026-09-26',
        url: 'https://jobs.smartrecruiters.com/EtihadAirways5/744000140889348-captain' },
      { pub: 'エティハド航空（SmartRecruiters・ref 80372）', pub_en: 'Etihad Airways (SmartRecruiters, ref 80372)', name: 'First Officer A320',
        as_of: '2026-07-31 掲載', accessed: '2026-09-26',
        url: 'https://jobs.smartrecruiters.com/EtihadAirways5/744000140889248-first-officer' },
      /* g4 src */
      { pub: 'PILOT VALUE', pub_en: 'PILOT VALUE', name: 'REAL PAY（会員が出した給与）', name_en: 'REAL PAY (pay submitted by members)',
        as_of: '2026-10-30 集計', as_of_en: 'Counted 30 October 2026', accessed: '2026-10-30',
        url: 'https://pilot-value.com/actual-pay.html' },
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
        { name: '機長 A320（求人の上限）', name_en: 'Captain, A320 (top of the advertised range)', max_y: 674029,
          req: '総5,500時間・多人数運航ガラスコックピットの機長時間 2,500時間・A320系の機長時間 1,500時間・直近12か月に A320系・入社日に59歳未満・英語能力証明レベル4以上' },
      ],
      est_status: 'unconfirmed',
      est_why: 'あるのは求人に書かれた上限だけ（上限は推定ではない）。在籍する機長の年収を示す資料が無い。',
      held: { was: { avg: 3400, lo: 3000, hi: 6000 },
        why: '求人の上限 AED 674,029 は約2,917万円で、このレンジの下端をわずかに下回る。レンジと平均そのものを支える資料は無い。' },
    },
    fo: { from: 'members', /* g4 fo */ est: {
        basis: 'PILOT VALUE にエティハド航空の副操縦士が出した給与（直近24か月）',
        basis_en: 'Pay submitted to PILOT VALUE by Etihad Airways first officers (past 24 months)',
        method: '会員が出した年収の中央値です（1人につき最新の1件・1万円単位）。会社の年金拠出など、給与明細に載らない分は入っていません。',
        method_en: 'The median of the annual pay members have submitted (the latest entry per person, to the nearest ¥10,000). Amounts that do not appear on a payslip, such as the company pension contribution, are not included.',
        as_of: '2026年10月30日 集計', as_of_en: 'Counted 30 October 2026',
      },
      tier: 'offer_posting',
      groups: [
        { name: '副操縦士 A320（求人の上限）', name_en: 'First officer, A320 (top of the advertised range)', max_y: 513732,
          req: 'A：総2,000時間かつ多人数運航ガラスコックピット1,500時間かつ同型500時間／B：総1,500時間かつ A320系1,000時間。加えて直近12か月に A320系・入社日に50歳未満・英語能力証明レベル4以上' },
      ],
      est_status: 'unconfirmed',
      est_why: 'あるのは求人に書かれた上限だけ（上限は推定ではない）。在籍する副操縦士の年収を示す資料が無い。',
      held: { was: { avg: 2300, lo: 1900, hi: 3100 },
        why: '求人の上限 AED 513,732 は約2,224万円で、このレンジの中に入るだけ。レンジと平均そのものを支える資料は無い。' },
    },
  },

  /* ══ エバー航空 ══ 公式に副操縦士の金額がある。「超」を落とさない。 */
  'eva-air': {
    cur: 'USD',
    tax: '課税（台湾）',
    src: [
      { pub: 'エバー航空（EVA Air）', pub_en: 'EVA Air', name: 'Careers / Job openings / Pilots（en-global 版）',
        as_of: '発行日の記載なし', accessed: '2026-10-02',
        url: 'https://www.evaair.com/en-global/about-eva-air/careers/job-openings/pilots/' },
      { pub: '桃園市機師職業工會 長榮分會・長榮航空', pub_en: 'Taoyuan City Pilots’ Union, EVA branch, and EVA Air', name: '労使合意（正駕駛 月13,500元ほかの引き上げ・今周刊の報道で確認）',
        as_of: '2024年1月28日', accessed: '2026-10-02', secondary: true,
        url: 'https://www.businesstoday.com.tw/article/category/183027/post/202401280021/' },
      { pub: '鏡週刊', pub_en: 'Mirror Media (鏡週刊)', name: '【長榮不罷工內幕2】正機師年薪480萬起跳 長榮華航星宇搶第一',
        as_of: '2024年2月6日', accessed: '2026-10-02', secondary: true,
        url: 'https://www.mirrormedia.mg/story/20240205inv013' },
      { pub: 'CTWANT', pub_en: 'CTWANT', name: '18萬旅客解套1／長榮機師底薪落後變老三「不罷工換加薪」',
        as_of: '2024年1月30日', accessed: '2026-10-02', secondary: true,
        url: 'https://www.ctwant.com/article/314950/' },
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
        { name: '副操縦士（4年契約）', name_en: 'First officer (four-year contract)', cash_y_over: 100000,
          req: '最低総飛行時間 2,000時間・多人数運航ジェット（最大離陸重量20トン超）500時間・ICAO ATPL・英語能力証明レベル4' },
      ],
      est_status: 'unconfirmed',
      est_why: '会社の公表は下限（年収 USD 100,000 超）だけ。表示している 1,590万 はその下限そのもの ＝ 算出方法が無い。幅の両端を支える資料も無い。',
      held: { was: { avg: 980, lo: 600, hi: 1180 },
        why: '★2026-10-02 に 1,300〜1,850万（avg 1,590万）へ直した。旧値（600〜1,180万・avg 980万）は、会社が自分で公表している下限（年収 USD 100,000 超 ＝ 約1,589万円）を avg も hi も下回っていた。会社は「初回の運航から適用」と明記しているので、経験の浅さでは説明できない。新しい avg は会社の公表下限そのもの、lo は台湾籍の副操縦士（月 約20万元・CTWANT）を13か月で見た額、hi は資深副駕駛までの幅。⚠️ 旧値の出所の記録は最初から無い。' },
    },
    cap: {
      tier: 'estimate',
      est: {
        basis: '鏡週刊 2024年2月6日の報道',
        basis_en: 'Mirror Media, 6 February 2024 (press report)',
        method: '同紙が書く機長の年収（500万元から・経験の長い機長は700万元以上）の幅の、ほぼ中央に置いています。',
        method_en: 'Set near the middle of the range the report gives for captains: from NTD 5 million a year, and NTD 7 million or more for senior captains.',
        as_of: '2024年2月',
        as_of_en: 'February 2024',
      },
      est_note: '⚠️ 候補（2026-10-05 の調べ）。算出方法のとおり中央を取ると (500万＋700万)÷2 ＝ NTD 600万 ＝ 約2,998万円（fx-rates.mjs の TWD 4.9966）。表示している 2,950万（NTD 約590万）と約48万円・1.6% ずれている。数字を直すか、説明（下の why の「NTD 約590万」）を直すかはオーナーの判断。SALARY は私の判断で動かさない。根拠の弱さ ── 1紙・出どころは匿名／500万は「起跳」・700万は「以上」＝どちらも下限／CTWANT の幅（350〜650万元）は機長と副操縦士をあわせた話。',
      held: { was: { avg: 1750, lo: 1370, hi: 2200 },
        why: '★2026-10-02 に 2,500〜4,000万（avg 2,950万）へ直した。旧値（1,370〜2,200万・avg 1,750万）は hi でさえ、台湾の報道2本が一致して書く機長の**下限**（年 NTD 500万 ＝ 約2,498万円）に届いていなかった。⚠️ 機長の金額は公式のどこにも無い（zh-tw に1文字も無く、外国籍向けの募集は副操縦士だけ。2024-01-28 の労使合意に「外国籍を機長として直接採用しない」条項がある）。だから新しい値も推定で、根拠は 鏡週刊 2024-02-06（長榮 正機師 年薪 500万元起跳／資深 700万元以上／少数 800万元超）と CTWANT 2024-01-30（350万〜650万元・飛行時間が多ければ700万元超）の重なる範囲。avg 2,950万 は両紙が機長の大勢と書く NTD 500〜700万 の中央（NTD 約590万）で、ここだけは当サイトの内挿。' },
    },
  },

  /* ══ チャイナエアライン ══ 公式は英語版・中文版とも金額ゼロ。
     中文版の「按飛時經驗支薪」が給与に触れた唯一の文で、それでも金額が無い。 */
  /* ★2026-10-29（オーナー OK・Gemini の年収の調べ 2回目）── 報道の年額で作り直した（機長 2,000万 → 3,500万・副操縦士 1,100万 → 1,500万）。
     額は salary-data.mjs、出どころの記録は salary-sources.mjs。会社も組合も額を出していない＝ 報道の印（secondary）を付ける。
     前の held（出所の記録が無かった旧値 2,000万・1,100万）は、根拠の付いた推定に置き換えたので外した（旧値は salary-sources.mjs の note に残してある）。 */
  'china-airlines': {
    cur: 'USD',
    tax: '課税（台湾）', tax_en: 'Taxed (Taiwan)',
    src: [
      { pub: '鏡週刊（Mirror Media）', pub_en: 'Mirror Media (Taiwan)', name: '【長榮不罷工內幕2】', name_en: 'Inside EVA Air’s no-strike deal, part 2',
        as_of: '2024-02-05 掲載', as_of_en: 'Published 5 February 2024', accessed: '2026-10-29', secondary: true,
        url: 'https://www.mirrormedia.mg/story/20240205inv013' },
      { pub: '經濟日報（udn）', pub_en: 'Economic Daily News (udn)', name: '華航、長榮航機師 300萬起跳', name_en: 'China Airlines and EVA Air pilots start from TWD 3 million',
        as_of: '2026-03-08 掲載', as_of_en: 'Published 8 March 2026', accessed: '2026-10-29', secondary: true,
        url: 'https://money.udn.com/money/story/5612/9366097' },
    ],
    notes: [],
    notes_en: [],
    cap: { tier: 'estimate', est: {
      basis: '台湾の週刊誌・鏡週刊の調査記事（2024年2月）',
      basis_en: 'An investigative piece in Taiwan’s Mirror Media (February 2024)',
      method: '記事の「ベテランの機長は年 700萬台湾ドル以上」に置いています。幅は同じ記事の「機長は 480萬台湾ドルから・多く飛ぶ人は 800萬台湾ドル超」です。この一文は台湾の大手の機長に共通の話として書かれています。その後の賞与・昇給と日当は入れていません。',
      method_en: 'Set at the article’s “senior captains earn TWD 7 million or more a year”. The range follows the same article: captains start from TWD 4.8 million, and those who fly the most exceed TWD 8 million. The article states this for captains at Taiwan’s major carriers in general. Later bonuses, pay rises and per diem are not included.',
      as_of: '2024年2月', as_of_en: 'February 2024',
    } },
    fo: { tier: 'estimate', est: {
      basis: '經濟日報の記事（2026年3月）',
      basis_en: 'An Economic Daily News article (March 2026)',
      method: '記事の「訓練を終えて副操縦士として乗り始めると年 300萬台湾ドル以上」に置いています。6年目の額の資料が無いため、乗り始めの額で示しています（低めの見積もり）。幅の下は前の値のままです。',
      method_en: 'Set at the article’s “once trained and flying the line, first officers earn TWD 3 million or more a year”. There is no source for a year-6 figure, so this is the starting figure (a conservative estimate). The bottom of the range is unchanged.',
      as_of: '2026年3月', as_of_en: 'March 2026',
    } },
  },

  /* ══ スターラックス ══ ★2026-09-30 オーナー指摘③
     「各航空会社ページに本人1名の申告から計算した給与例を出してるのおかしいでしょ。」
     → 月額 NTD 422,500 × 13か月（¥2,744万）と、訓練中の月額 NTD 285,000 × 13か月（¥1,851万）を
       画面から外し、他社と同じ「推定」に戻した。この形の出所はサイト全体でこの1社だけだった。

     ⚠️ 計算そのものは消さずに retired_groups / retired_src として残してある。
        名前を groups に戻すと figures() が拾い、月収の答え・国別ページ・構造化データに
        1名の申告から作った金額が**そのまま復活する**（画面は普通に動いたまま）。
     ⚠️ src を空にしたのは、1名の体験記を「この金額の出所」として画面に出さないため。
        推定の数字に出所の資料は無い（公開情報からの推計）ので、出所の節も置かない。 */
  'starlux': {
    cur: 'TWD',
    tax: '課税（台湾）',
    src: [], notes: [], notes_en: [],
    retired_src: [
      { pub: '内定者の実体験（機長歴10年で応募したパイロット本人の申告・1名）',
        name: '本サイトの採用試験ガイドに掲載している月額の表',
        as_of: '2025年前半', accessed: '2026-09-28',
        url: 'https://pilot-value.com/airlines/starlux-tenshoku.html' },
    ],
    cap: {
      tier: 'estimate',
      retired_groups: [
        { name: '昇格後（機長歴10年目安）', name_en: 'After upgrade (about ten years as a captain)', month: 422500, months: 13,
          cond: '月75時間の乗務保証を含む月額 × 13か月' },
      ],
      held: { was: { avg: 3100, hi: 3900 },
        why: 'avg 3,100万と hi 3,900万には計算式が無い（3,900万は出所の記録が無かった旧値の据え置き）。' },
    },
    fo: {
      tier: 'estimate',
      retired_groups: [
        { name: '訓練中', name_en: 'During training', month: 285000, months: 13, training: true,
          cond: '50時間の乗務分を含む訓練中の月額 × 13か月' },
      ],
      held: { was: { avg: 1950, hi: 2050 },
        why: 'avg 1,950万と hi 2,050万には計算式が無い。⚠️ 掲載していた月額は機長候補者の訓練中の額で、副操縦士の給与そのものではない（副操縦士の実額は1件も無い）。' },
    },
  },

  /* ══ シンガポール航空 ══ 機長・副操縦士の求人に「報酬」の節そのものが無い。
     金銭に触れるのは "more than just a competitive salary" だけで金額なし。 */
  'singapore-airlines': {
    pay_tax: 'unknown',
    cur: 'USD',
    tax: '課税（シンガポール）',
    src: [
      /* g4 src */
      { pub: 'Aviation A2Z', pub_en: 'Aviation A2Z', name: 'Singapore Airlines Pilot Salary in 2025', name_en: 'Singapore Airlines Pilot Salary in 2025',
        as_of: '2025-12-13 掲載', as_of_en: 'Published 13 December 2025', accessed: '2026-10-29', secondary: true,
        url: 'https://aviationa2z.com/index.php/2025/12/13/singapore-airlines-pilot-salary-in-2025/' },
    ],
    notes: [],
    notes_en: [],
    cap: { /* g4 cap */ est: {
        basis: 'Aviation A2Z の記事「Singapore Airlines Pilot Salary in 2025」（2025年12月）',
        basis_en: 'The Aviation A2Z article “Singapore Airlines Pilot Salary in 2025” (December 2025)',
        method: '記事の「経験を積んだ機長の年収は SGD 285,000〜355,000（機材・路線・訓練や審査の役割による）」の真ん中 SGD 320,000 を使っています。利益配分の賞与と、中央積立基金（CPF）への会社の拠出は足していません。税引き前か手取りかは書かれていません。幅の上は SGD 355,000 です。幅の下は前の値のままです。',
        method_en: 'Set at the midpoint, SGD 320,000, of the article’s “with increased seniority, yearly captain earnings typically range from SGD 285,000 to SGD 355,000, depending on the fleet type, route mix, and any additional duties”. The profit-sharing bonus and the employer’s CPF contribution are not added. It does not say whether the figures are before or after tax. The top of the range is SGD 355,000. The bottom of the range is unchanged.',
        as_of: '2025年12月', as_of_en: 'December 2025',
      }, tier: 'estimate', held: { was: { avg: 3400, lo: 2750, hi: 4150 },
      why: '公式の採用ページに報酬の節そのものが無く、金額の記載が1件も無い。レンジの出所の記録も無い。' } },
    fo: { tier: 'estimate', held: { was: { avg: 1850, lo: 1100, hi: 2280 },
      why: '機長と同じ理由。' } },
  },

  /* ══ ガルフ・エア ══ パイロットの募集そのものが1件も無い（2026-09-26 時点）。
     ＝公式には金額も応募要件も存在しない。数字を埋めない。 */
  'gulf-air': {
    pay_tax: 'unknown',
    cur: 'USD',
    tax: '非課税（バーレーンに個人所得税なし）',
    src: [
      /* g4 src */
      { pub: 'Ready For Take-Off Book', pub_en: 'Ready For Take-Off Book', name: 'Gulf Air | Pilot Careers, Pay, Fleet & Work-Life Guide', name_en: 'Gulf Air | Pilot Careers, Pay, Fleet & Work-Life Guide',
        as_of: '2026-06-08 掲載', as_of_en: 'Published 8 June 2026', accessed: '2026-10-30', secondary: true,
        url: 'https://readyfortakeoffbook.com/blogs/pilot-conditions/gulf-air' },
    ],
    notes: [],
    notes_en: [],
    cap: { /* g4 cap */ est: {
        basis: 'Ready For Take-Off Book のガルフ・エアのページ「Gulf Air | Pilot Careers, Pay, Fleet & Work-Life Guide」（2026年6月）',
        basis_en: 'Ready For Take-Off Book’s Gulf Air page, “Gulf Air | Pilot Careers, Pay, Fleet & Work-Life Guide” (June 2026)',
        method: '表「総待遇の見込み（非課税）」の「A320 の機長（若手）年 約 US$190,000〜255,000」と「787 のベテラン機長 年 約 US$255,000〜340,000」の真ん中どうしの真ん中 US$260,000 を使っています。A320 のベテランの段は表にありません。幅の上は US$340,000 です。幅の下は前の値のままです。',
        method_en: 'Set at US$260,000, the midpoint between the middles of two steps in the “Estimated Total Package (Tax-Free)” table: “Captain (junior, A320) ~$190,000 – $255,000” and “Captain (senior, 787 widebody) ~$255,000 – $340,000” a year. The table has no senior A320 step. The top of the range is US$340,000. The bottom of the range is unchanged.',
        as_of: '2026年6月', as_of_en: 'June 2026',
      }, tier: 'estimate', held: { was: { avg: 2700, lo: 2300, hi: 3300 },
      why: 'パイロットの募集が1件も無く、公式に金額が存在しない。レンジの出所の記録も無い。' } },
    fo: { /* g4 fo */ est: {
        basis: 'Ready For Take-Off Book のガルフ・エアのページ「Gulf Air | Pilot Careers, Pay, Fleet & Work-Life Guide」（2026年6月）',
        basis_en: 'Ready For Take-Off Book’s Gulf Air page, “Gulf Air | Pilot Careers, Pay, Fleet & Work-Life Guide” (June 2026)',
        method: '同じ表の「経験のある副操縦士（A320／787）年 約 US$145,000〜190,000」の真ん中 US$167,500 を、6年目の額として使っています（その前の段は「最初の数年」）。幅の上は US$190,000 です。幅の下は前の値のままです。',
        method_en: 'Set at the midpoint, US$167,500, of the same table’s “First Officer (senior, A320 / 787) ~$145,000 – $190,000” a year, used as the year-6 figure (the step before it covers the first years on the line). The top of the range is US$190,000. The bottom of the range is unchanged.',
        as_of: '2026年6月', as_of_en: 'June 2026',
      }, tier: 'estimate', held: { was: { avg: 1500, lo: 1250, hi: 1850 },
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
    pay_tax: 'unknown',
    cur: 'QAR',
    tax: '非課税（カタールに個人所得税なし）',
    src: [
      /* g4 src */
      { pub: 'Aviation A2Z', pub_en: 'Aviation A2Z', name: 'Qatar Airways Pilot Salary in 2026', name_en: 'Qatar Airways Pilot Salary in 2026',
        as_of: '2026-10-18 掲載', as_of_en: 'Published 18 October 2026', accessed: '2026-10-30', secondary: true,
        url: 'https://aviationa2z.com/index.php/2026/10/18/qatar-airways-pilot-salary-2026/' },
      { pub: 'Ready For Take-Off Book', pub_en: 'Ready For Take-Off Book', name: 'Qatar Airways | Pilot Pay, Rosters, Fleet & Benefits', name_en: 'Qatar Airways | Pilot Pay, Rosters, Fleet & Benefits',
        as_of: '2026-05-19 掲載', as_of_en: 'Published 19 May 2026', accessed: '2026-10-30', secondary: true,
        url: 'https://readyfortakeoffbook.com/blogs/pilot-conditions/qatar-airways' },
    ],
    notes: [],
    notes_en: [],
    cap: { /* g4 cap */ est: {
        basis: 'Ready For Take-Off Book のカタール航空のページ「Qatar Airways | Pilot Pay, Rosters, Fleet & Benefits」（2026年5月）',
        basis_en: 'Ready For Take-Off Book’s Qatar Airways page, “Qatar Airways | Pilot Pay, Rosters, Fleet & Benefits” (May 2026)',
        method: '機長の「年の現金の総額の見込み 約 US$139,000〜250,000」のうち、「乗務時間の多い広胴機のベテラン機長は US$250,000 に近づく」の US$250,000 を使っています。住宅手当と交通手当は足していません。幅は前の値のままです。',
        method_en: 'Set at US$250,000 from the captain’s “estimated annual cash gross ~US$139,000 to 250,000”, where the page says “senior widebody Captains with high block hours can approach US$250,000”. Housing and transport allowances are not added. The range is unchanged.',
        as_of: '2026年5月', as_of_en: 'May 2026',
      }, tier: 'estimate', held: { was: { avg: 2900, lo: 2600, hi: 4800 },
      why: '公式・過去の公式求人・第三者掲示のすべてで金額が0件。レンジの出所の記録も無い。加えてページ内で「住宅・教育手当を含めた実質パッケージ2,900万」なのに含まないはずのレンジ上限が4,800万で、同じページの中で矛盾している。' } },
    fo: { /* g4 fo */ est: {
        basis: 'Aviation A2Z の記事「Qatar Airways Pilot Salary in 2026」（2026年10月）',
        basis_en: 'The Aviation A2Z article “Qatar Airways Pilot Salary in 2026” (October 2026)',
        method: '記事の「副操縦士の年収は QAR 360,000〜660,000（入社したばかりは下の端・長距離機の経験者は上）」の真ん中 QAR 510,000 を使っています。記事に年数ごとの段は無く、6年目の額ではありません。住宅手当は足していません。幅の上は QAR 660,000 です。幅の下は前の値のままです。',
        method_en: 'Set at the midpoint, QAR 510,000, of the article’s “first officers at Qatar Airways typically earn between QAR 360,000 and QAR 660,000 per year”, with new first officers near the lower end and experienced long-haul pilots higher. The article gives no steps by year, so this is not a year-6 figure. Housing allowance is not added. The top of the range is QAR 660,000. The bottom of the range is unchanged.',
        as_of: '2026年10月', as_of_en: 'October 2026',
      }, tier: 'estimate', held: { was: { avg: 2050, lo: 1850, hi: 2700 },
      why: '機長と同じ理由。' } },
  },

  /* ══ オマーン航空 ══ 2017年の募集広告が1件だけ。現行の公式には金額ゼロ。
     公式の採用システムは 502 を返して読めない（サーバ側の故障）。 */
  'oman-air': {
    cur: 'GBP',
    tax: '課税（王令 56/2025。2028年初から課税所得の5%・年 OMR 42,000 が基準額）',
    src: [
      { pub: '航空会社の募集広告（採用パートナー L3 経由）を第三者サイト FlightDeckFriend が再掲したもの', pub_en: 'The airline’s recruitment advert (through the recruitment partner L3), republished by the third-party site FlightDeckFriend',
        name: 'Oman Air Pilot Recruitment — B737 NG First Officers / Direct Entry Captain',
        as_of: '2017-06-28 掲載（★ページに「募集終了」と書かれている）', accessed: '2026-09-29',
        url: 'https://www.flightdeckfriend.com/job/oman-air-b737-first-officers/' },
      /* g4 src */
      { pub: 'Ready For Take-Off Book', pub_en: 'Ready For Take-Off Book', name: 'Oman Air | Pilot Careers, Pay, Benefits & Roster Guide', name_en: 'Oman Air | Pilot Careers, Pay, Benefits & Roster Guide',
        as_of: '2026-05-04 掲載', as_of_en: 'Published 4 May 2026', accessed: '2026-10-30', secondary: true,
        url: 'https://readyfortakeoffbook.com/blogs/pilot-conditions/oman-air' },
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
    cap: { card: 'estimate', /* g4 cap */ est: {
        basis: 'Ready For Take-Off Book のオマーン航空のページ「Oman Air | Pilot Careers, Pay, Benefits & Roster Guide」（2026年5月）',
        basis_en: 'Ready For Take-Off Book’s Oman Air page, “Oman Air | Pilot Careers, Pay, Benefits & Roster Guide” (May 2026)',
        method: '表の年額の見込み（税引き前）の「737 の中堅の機長 約 US$160,000〜185,000」と「787 のベテラン機長 約 US$190,000〜230,000」の真ん中どうしの真ん中 US$191,250 を使っています。737 のベテランの段は表にありません。幅の上は US$230,000 です。幅の下は前の値のままです。',
        method_en: 'Set at US$191,250, the midpoint between the middles of “Captain, mid-seniority (737) ~$160,000 to $185,000” and “Senior Captain (787) ~$190,000 to $230,000” in the table’s annual gross estimates. The table has no senior 737 step. The top of the range is US$230,000. The bottom of the range is unchanged.',
        as_of: '2026年5月', as_of_en: 'May 2026',
      },
      tier: 'past_ad',
      groups: [
        { name: '機長 B737 NG（2017年・募集終了）', name_en: 'Captain, B737 NG (2017 advert, no longer open)', reward_y: 90000,
          req: '多人数運航機の機長時間 5,000時間・同型 500時間・25歳以上55歳未満・英語能力証明レベル4以上' },
      ],
      held: { was: { avg: 2500, lo: 2100, hi: 3000 },
        why: '2017年の広告の約1,951万円がこのレンジの下端を下回る。レンジと平均そのものを支える資料は無い。' },
    },
    fo: { card: 'estimate', /* g4 fo */ est: {
        basis: 'Ready For Take-Off Book のオマーン航空のページ「Oman Air | Pilot Careers, Pay, Benefits & Roster Guide」（2026年5月）',
        basis_en: 'Ready For Take-Off Book’s Oman Air page, “Oman Air | Pilot Careers, Pay, Benefits & Roster Guide” (May 2026)',
        method: '表の年額の見込み（税引き前）の「ベテランの副操縦士（737／787）約 US$85,000〜100,000」の真ん中 US$92,500 を、6年目の額として使っています（その前の段は「3〜5年目」）。幅は前の値のままです。',
        method_en: 'Set at the midpoint, US$92,500, of “F/O Senior (737/787) ~$85,000 to $100,000” in the table’s annual gross estimates, used as the year-6 figure (the step before it is “F/O Year 3 to 5”). The range is unchanged.',
        as_of: '2026年5月', as_of_en: 'May 2026',
      },
      tier: 'past_ad',
      groups: [
        { name: '副操縦士 B737 NG（2017年・募集終了）', name_en: 'First officer, B737 NG (2017 advert, no longer open)', reward_y: 65000,
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
      { pub: 'サウディア（Saudi Arabian Airlines・自社サイト）', pub_en: 'Saudia (Saudi Arabian Airlines, own site)', name: 'Advert – Captains',
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
        { name: '機長 B747 Classic / MD-11（2005年・月額の基本給）', name_en: 'Captain, B747 Classic / MD-11 (2005, monthly basic pay)', base_m: 19587,
          req: '2005年当時の広告。現行の機長要件は総6,000時間ほか（金額の記載は無い）' },
        { name: '機長 EMB170（2005年・月額の基本給）', name_en: 'Captain, EMB170 (2005, monthly basic pay)', base_m: 16107 },
      ],
      held: { was: { avg: 3300, lo: 2700, hi: 4200 },
        why: '2005年の基本給しか資料が無く、年額を支える資料は無い（基本給に21項目が乗るので、基本給から年収は出せない）。レンジの出所の記録も無い。' },
    },
    fo: {
      tier: 'past_ad',
      groups: [
        { name: '副操縦士 B747 Classic / MD-11（2005年・月額の基本給）', name_en: 'First officer, B747 Classic / MD-11 (2005, monthly basic pay)', base_m: 13475 },
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
    pay_tax: 'unknown',
    cur: 'KRW',
    tax: '課税（韓国・6〜45%）',
    src: [
      /* g4 src */
      { pub: 'Aviation A2Z', pub_en: 'Aviation A2Z', name: 'Korean Air Pilot Salary in 2026', name_en: 'Korean Air Pilot Salary in 2026',
        as_of: '2026-04-11 掲載', as_of_en: 'Published 11 April 2026', accessed: '2026-10-29', secondary: true,
        url: 'https://aviationa2z.com/index.php/2026/04/11/korean-air-pilot-salary-2026/' },
    ], notes: [], notes_en: [],
    cap: { /* g4 cap */ est: {
        basis: 'Aviation A2Z の記事「Korean Air Pilot Salary in 2026」（2026年4月）',
        basis_en: 'The Aviation A2Z article “Korean Air Pilot Salary in 2026” (April 2026)',
        method: '記事の「国際線の手当・乗務手当などを含めた機長の年の総額は KRW 210,000,000〜240,000,000」の真ん中 KRW 225,000,000 を使っています。税引き前か手取りかは書かれていません。幅は前の値のままです。',
        method_en: 'Set at the midpoint, KRW 225,000,000, of the article’s “including international allowances, flight pay, and additional operational earnings, total annual compensation usually reaches between KRW 210,000,000 and KRW 240,000,000”. It does not say whether the figures are before or after tax. The range is unchanged.',
        as_of: '2026年4月', as_of_en: 'April 2026',
      }, tier: 'estimate', held: { was: { avg: 2450, lo: 1850, hi: 2750 },
      why: '公式の求人・採用サイト全26ページ・有価証券報告書のすべてで、パイロットの金額が0件。レンジの出所の記録も無い。' } },
    fo: { /* g4 fo */ est: {
        basis: 'Aviation A2Z の記事「Korean Air Pilot Salary in 2026」（2026年4月）',
        basis_en: 'The Aviation A2Z article “Korean Air Pilot Salary in 2026” (April 2026)',
        method: '記事の「乗務手当・長距離の手当などを含めた副操縦士の年の総額は KRW 100,000,000〜125,000,000」の真ん中 KRW 112,500,000 を使っています。記事に年数ごとの段は無く、6年目の額ではありません。税引き前か手取りかは書かれていません。幅は前の値のままです。',
        method_en: 'Set at the midpoint, KRW 112,500,000, of the article’s “when additional earnings such as flight pay, long-haul allowances, and duty-related incentives are included, total annual income usually rises to between KRW 100,000,000 and KRW 125,000,000”. The article gives no steps by year, so this is not a year-6 figure. It does not say whether the figures are before or after tax. The range is unchanged.',
        as_of: '2026年4月', as_of_en: 'April 2026',
      }, tier: 'estimate', held: { was: { avg: 1250, lo: 950, hi: 1430 }, why: '機長と同じ理由。' } },
  },

  /* ══ タイ国際航空 ══ 公式の2026年募集に金額ゼロ。
     ★会社自身が「給与体系に従った給与を受け取る」と書くだけで、金額も体系も公開していない
       （Student Pilot FAQ）。応募ポータルのデータの型に、給与を入れる欄がそもそも無い。
     公式に出ている金額は受験料・身体検査料など、受験者が払う費用だけ。 */
  'thai-airways': {
    cur: 'THB',
    tax: '課税（タイ）',
    src: [], notes: [], notes_en: [],
    cap: { tier: 'estimate', held: { was: { avg: 1850, lo: 1500, hi: 2420 },
      why: '公式の募集要項・応募ポータル・自社養成の案内のすべてで金額が0件。会社は「給与体系に従う」と書くだけで体系も公開していない。レンジの出所の記録も無い。' } },
    fo: { tier: 'estimate', held: { was: { avg: 880, lo: 660, hi: 1140 }, why: '機長と同じ理由。' } },
  },

  /* ══ エア・インディア ══ 会社名義の採用サイトの現役パイロット求人4本とも金額ゼロ
     （全文を取得して salary / CTC / ₹ / lakh / per month / package を機械検索して0件。
      数字として出るのは飛行時間と年齢上限だけ）。
     ⚠️ その4本は本文に "This opportunity is with Air India Express." と書かれており、
        エア・インディア本体の運航乗務の求人は現在1本も出ていない。
     ⚠️ 「₹85 lakh〜₹1.8 crore」等はすべて第三者の推計。会社の資料に対応する原文は無い。 */
  'air-india': {
    pay_tax: 'unknown',
    cur: 'INR',
    tax: '課税（インド）',
    src: [
      /* g4 src */
      { pub: 'The Times of India', pub_en: 'The Times of India', name: 'Past tense, eye on future: Air India hikes pilots’ pay by 8% to 15%', name_en: 'Past tense, eye on future: Air India hikes pilots’ pay by 8% to 15%',
        as_of: '2026-08-07 掲載', as_of_en: 'Published 7 August 2026', accessed: '2026-10-30', secondary: true,
        url: 'https://timesofindia.indiatimes.com/india/past-tense-eye-on-future-air-india-hikes-pilots-pay-by-8-to-15/articleshow/133036959.cms' },
      { pub: 'Business Standard', pub_en: 'Business Standard', name: 'Air India announces salary hike, annual performance bonus for pilots', name_en: 'Air India announces salary hike, annual performance bonus for pilots',
        as_of: '2024-05-23 掲載', as_of_en: 'Published 23 May 2024', accessed: '2026-10-30', secondary: true,
        url: 'https://www.business-standard.com/companies/news/air-india-announces-fixed-monthly-salary-hike-performance-bonus-for-pilots-124052301551_1.html' },
    ], notes: [], notes_en: [],
    cap: { /* g4 cap */ est: {
        basis: 'The Times of India の記事（2026年8月・エア・インディアの昇給の報道）と、Business Standard の記事（2024年5月・年の業績賞与の報道）',
        basis_en: 'An article in The Times of India on Air India’s pay rise (August 2026) and a Business Standard article on its annual performance bonus (May 2024)',
        method: '記事の「月 約55時間飛ぶ上級機長（senior commander）は月 Rs 8.3 lakh」を12倍し、2024年に始まった年の業績賞与（評価3の上級機長 Rs 1.8 lakh）を足しています。広胴機の手当と宿泊の手当は足していません。税引き前か手取りかは書かれていません。幅は前の値のままです。',
        method_en: 'Set at the article’s “a senior commander flying for about 55 hours in a month will get Rs 8.3 lakh” × 12, plus the annual performance bonus introduced in 2024 (Rs 1.8 lakh for a senior commander rated 3, “meets expectations”). The widebody allowance and layover allowances are not added. It does not say whether the figures are before or after tax. The range is unchanged.',
        as_of: '2026年8月（業績賞与は2024年5月の報道）', as_of_en: 'August 2026 (performance bonus as reported in May 2024)',
      }, tier: 'estimate', held: { was: { avg: 1550, lo: 1100, hi: 2000 },
      why: '会社名義の求人4本すべてで金額が0件。レンジの出所の記録も無い。' } },
    fo: { tier: 'estimate', held: { was: { avg: 720, lo: 540, hi: 900 }, why: '機長と同じ理由。' } },
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
      { pub: 'パイロット専門の人材会社 Yufeng Consulting（中国・chinaaviationjob.com）が出した求人', pub_en: 'A vacancy posted by Yufeng Consulting, a pilot recruitment agency (China, chinaaviationjob.com)',
        name: 'A330 / B787 / B777 Captain – China Southern（3ページとも給与表は同一）',
        as_of: '2019-08-16 掲載（★広告自身が「新しい契約の草案に基づく要約」と断っている）',
        accessed: '2026-09-29',
        url: 'https://www.chinaaviationjob.com/a330-captain-china-southern/' },
    ],
    notes: [
      '代理店が2019年に出した求人で、広告自身が「新しい契約の草案に基づく要約」と断っています。現在の条件ではありません。',
      '月額は年次で上がります（1年目 USD 19,000・2年目 19,000・3年目 20,000・4年目 21,000）。型式未保有での入社は1年目が USD 18,000 です。',
      'この月額のほかに、年 USD 6,000 の安全運航賞と年 USD 10,000 の住宅手当が別建てで付きます。',
      '前提は月間ブロック80時間、基地は広州、契約は4年・更新可。税引き前か後かの記載はありません。',
      '外国人パイロット向けの契約で、通勤便と家族用の年6往復の航空券が付きます。',
      '機長だけの求人です。副操縦士の金額はどの資料にもありません。',
      'このほかに別の代理店（VOR Holdings）が2013年に出した機長の広告があり、月額 USD 18,000〜20,000（手取りと明記）・月160時間超は1時間 USD 225 と書かれています。13年前の資料です。',
    ],
    notes_en: [
      'These figures come from an agency posting from 2019, and the posting itself says it summarizes "the new DRAFT contract elements". They are not current terms.',
      'The monthly figure rises by year of service (USD 19,000 in year one, 19,000 in year two, 20,000 in year three, 21,000 in year four). Joining without the type rating starts at USD 18,000.',
      'On top of the monthly figure there is a USD 6,000 annual safety and operation award and a USD 10,000 annual housing allowance.',
      'It assumes 80 block hours a month, a Guangzhou base and a four-year renewable contract. The posting does not say whether the figure is before or after tax.',
      'It is a contract for foreign pilots, with commuting flights and six return tickets a year for the family.',
      'The posting is for captains only. No figure for first officers appears in any source.',
      'A separate agency (VOR Holdings) advertised captain positions in 2013 at USD 18,000\u201320,000 a month, stated as net, plus USD 225 an hour beyond 160 hours a month. That material is thirteen years old.',
    ],
    cap: { tier: 'past_ad',
      groups: [
        { name: '機長 A330 / B787 / B777・1年目（2019年の代理店求人・月額）', name_en: 'Captain, A330 / B787 / B777, first year (2019 agency posting, monthly)', base_m: 19000,
          req: '型式ごとに年齢上限と当該型式の機長時間が決まっている（A330 保有なら57歳・500時間、B737NG からの転換なら50歳・1,500時間など）' },
        { name: '同・1年目（型式未保有での入社）', name_en: 'Same, first year (joining without the type rating)', base_m: 18000 },
        { name: '同・4年目', name_en: 'Same, fourth year', base_m: 21000 },
      ],
      held: { was: { avg: 2950, lo: 2100, hi: 4700 },
        why: '会社の公表は金額ゼロ。金額があるのは代理店の2019年の求人（しかも草案）と2013年の求人だけで、年額の平均・レンジを支える資料は無い。' } },
    fo: { tier: 'estimate', held: { was: { avg: 1500, lo: 980, hi: 2100 },
      why: '副操縦士の金額はどの資料にも無い（代理店の求人も機長だけ）。' } },
  },

  /* ══ 中国国際航空 ══ ★会社自身の「薪酬福利（報酬と福利）」のページが在り、そこに金額が1つも無い。
     書いてあるのは「固定給・飛行出張手当・賞与・各種手当・年度インセンティブで構成され、
     報酬水準は業界内で先頭にある」という構成の説明だけ（金額なし・発行日なし）。
     候補生選抜の公告3本（最新 2025-11-04）・自社養成の案内（2023-10-20）・招飞信息にも金額が無い。
     お金に触れているのは「訓練費は会社が負担し、学費は家庭が負担する」の1行だけで、額は無い。
     人材会社の現行求人も0件（WAS Inc・APAS・China Aviation HK の一覧に旅客側の中国国際航空は無い）。
     ⚠️ chinaaviation.hk にある「B777 機長 月 USD 18,200」等は **中国国際航空貨運（Air China Cargo）** の求人。
        別会社なので、旅客側の機長の金額として使わない（監査が警告している取り違えそのもの）。
     ⚠️ 第三者のまとめサイトの「機長 月 USD 16,500〜25,000」は出所にならない。
     ⚠️ 中国国際航空の年次報告の「従業員一人あたり」は全職種の平均で、構造上パイロットの平均にならない。 */
  'air-china': {
    cur: 'CNY',
    tax: '課税（中国）',
    src: [
      { pub: '中国国際航空（Air China のパイロット採用サイト zhaopin.airchina.com.cn）', pub_en: 'Air China (pilot recruitment site zhaopin.airchina.com.cn)',
        name: '飞行员招聘 ／ 薪酬福利（パイロットの報酬と福利のページ）',
        as_of: '発行日・適用時点の記載なし', accessed: '2026-09-29',
        url: 'https://zhaopin.airchina.com.cn/cn/about_us/recruitment/pilot_salary.shtml' },
    ],
    notes: [
      '会社のパイロット採用サイトに報酬のページがありますが、そこに金額は1つも書かれていません。報酬が「固定給・飛行出張手当・賞与・各種手当・年度インセンティブ」で構成されること、水準が業界内で高いことだけが書かれています。発行日も適用時点もありません。',
      '同じサイトの候補生選抜の公告（最新は2025-11-04）と自社養成の案内（2023-10-20）にも金額はありません。お金に触れているのは「訓練費は会社が負担し、学費は家庭が負担する」の1行だけで、額は書かれていません。',
      '⚠️ 人材会社が出している「B777 機長 月 USD 18,200」などの求人は、中国国際航空貨運（Air China Cargo）のものです。別会社なので、旅客側の機長の金額としては扱っていません。',
      '当サイトが確認した資料の範囲では、機長・副操縦士の年収・月収を書いた資料は見つかりませんでした。見つかった時点で、対象と時点を付けてこの節に足します。',
    ],
    notes_en: [
      'The airline has a pay and benefits page for pilots on its own recruitment site, and it states no amount at all. It says only that pay is made up of fixed salary, flight duty allowance, bonuses, other allowances and an annual incentive, and that the level is high within the industry. The page carries no publication date and no effective date.',
      'The cadet selection notices on the same site (the newest from 2025-11-04) and the cadet program brief (2023-10-20) state no amount either. The only line that touches money says the company bears the training cost while the family bears the tuition, with no figure.',
      'Warning: agency postings quoting figures such as USD 18,200 a month for a B777 captain are for Air China Cargo, a separate company. We do not treat them as figures for captains on the passenger side.',
      'In the material we have checked, we found no document stating annual or monthly pay for captains or first officers. If one appears, we will add it here with its subject and its date.',
    ],
    cap: { tier: 'estimate', held: { was: { avg: 3050, lo: 2200, hi: 4800 },
      why: '会社の報酬ページに金額がゼロ。採用公告にも金額が無く、旅客側の人材会社の求人も現行では0件。年額の平均・レンジを支える資料が無い（元の値の出所の記録も無い）。' } },
    fo: { tier: 'estimate', held: { was: { avg: 1550, lo: 1000, hi: 2200 },
      why: '機長と同じ理由。副操縦士の金額を書いた資料は、会社側にも人材会社側にも無い。' } },
  },

  /* ══ 中国東方航空 ══ ★会社の採用サイトにパイロットの募集そのものが無い。
     招飞（候補生選抜）の枠は募集0件・お知らせ0件、外国人パイロットの枠は「no data」を返す
     （「Airplane Captain」は絞り込みの選択肢だけで、求人が1件も無い）。
     トップページのパイロット向けリンクの先は消えた記事（NewsId 5436 が「查询无数据」）。
     社会人採用42件・新卒採用48件を1件ずつ見て、飛ぶ職種は1件も無い（飛行総隊の枠も管理職）。
     ★金額があるのは香港の人材会社 APAS が出している現行の A330 機長の求人だけ。
     ⚠️ ページに日付が1つも無い。Internet Archive の保存（2025-06-17・2026-06-05）が同じ金額。
     ⚠️ 年間総待遇 USD 300,000 は月額を含む（234,000＋30,000＋12,000＋24,000＝300,000 とこちらで検算）。
        pkg_y にもう一度月額や手当を足さない。12で割って月給と呼ばない。
     ⚠️ 月額 19,500 ÷ 75時間 = 260 で、同じ求人の「1時間 USD 345」と合わない。
        求人はこの3つの数字の関係を説明していないので、こちらで結びつけない。 */
  'china-eastern': {
    cur: 'USD',
    tax: '課税（中国）',
    pay_tax: 'unknown',
    src: [
      { pub: '人材会社 Asia Pacific Aviation Services Limited（APAS・香港）が出した求人', pub_en: 'A vacancy posted by the recruitment agency Asia Pacific Aviation Services Limited (APAS, Hong Kong)',
        name: 'China Eastern Airlines - A330 Captains（上海基地・3年契約・更新可）',
        as_of: 'ページに日付の記載が1つも無い（Internet Archive の保存では 2025-06-17 から同じ金額）',
        accessed: '2026-10-30',
        url: 'https://www.apasnet.com/Jobs/detail.aspx?u=28&JobType=0' },
    ],
    notes: [
      '香港の人材会社が出している求人の掲載額です。求人のページには日付が1つも書かれていません（Internet Archive の保存では 2025-06-17 の時点から同じ金額です）。',
      '前提は暦月あたり75時間・上海基地・3年契約（更新可）・21日勤務10日休み・年次有給15日。条件は A330 の型式限定と、PIC 5,500時間以上（うち当該型式 500時間以上）です。',
      '年間総待遇 USD 300,000 は月額を含んだ額です。内訳は月額 19,500×12＝234,000、住宅手当 年30,000、追加の航空手当 年12,000、年次賞与 年24,000 で、合計がちょうど 300,000 になります（求人に内訳の計算は書かれていないため、こちらで検算しました）。月額と二重に数える数字ではありません。',
      '住宅手当（月 USD 2,500）と追加の航空手当（月 USD 1,000）は、最初の3か月の訓練期間の後から付きます。年次賞与は月 USD 2,000 相当を契約年度の末にまとめて支払うと書かれています。',
      '同じ求人に「1時間 USD 345」とも書かれていますが、月額 19,500 を75時間で割ると 260 で、求人はこの2つの関係を説明していません。そのため、こちらで結びつけていません。',
      '税引き前か後かの記載はありません。中国と国交のある国の国籍が条件の、外国人パイロット向けの契約です。',
      '副操縦士の求人はありません。副操縦士の金額は、会社側にも人材会社側にも見つかりませんでした。',
    ],
    notes_en: [
      'These are the amounts stated in a posting by a recruitment company in Hong Kong. The posting page carries no date at all (Internet Archive snapshots show the same figures from 2025-06-17 onwards).',
      'It assumes 75 hours per calendar month, a Shanghai base, a three-year renewable contract, 21 days on and 10 days off, and 15 days of annual leave. The requirements are an A330 type rating and 5,500 hours of PIC time, of which 500 hours on type.',
      'The annual figure of USD 300,000 includes the monthly pay. Its parts are 19,500 x 12 = 234,000 of monthly pay, 30,000 of housing allowance, 12,000 of extra air travel allowance and 24,000 of annual bonus, which come to exactly 300,000 (the posting does not show this arithmetic; we checked it ourselves). It is not a figure to be counted twice with the monthly pay.',
      'The housing allowance (USD 2,500 a month) and the extra air travel allowance (USD 1,000 a month) start after the first three months of training. The annual bonus is stated as USD 2,000 a month, paid in one sum at the end of the contract year.',
      'The same posting also states USD 345 an hour, but 19,500 divided by 75 hours is 260, and the posting does not explain how the two relate. We have therefore not connected them.',
      'The posting does not say whether the figures are before or after tax. It is a contract for foreign pilots, and requires the nationality of a state that has diplomatic relations with China.',
      'There is no posting for first officers. We found no figure for first officers, either from the airline or from a recruitment company.',
    ],
    cap: { tier: 'offer_posting',
      groups: [
        { name: '機長 A330（上海基地・暦月75時間・3年契約）', name_en: 'Captain, A330 (Shanghai base, 75 hours a calendar month, three-year contract)', cash_m: 19500, pkg_y: 300000,
          req: 'A330 の型式限定・総 PIC 5,500時間以上・うち当該型式 500時間以上・中国と国交のある国の国籍' },
      ],
      card: 'estimate',
      est: {
        basis: '人材会社 APAS（香港）が出した中国東方の A330 機長の求人',
        basis_en: 'A posting by the recruitment agency APAS (Hong Kong) for A330 captains at China Eastern',
        method: '求人の「年間総待遇 US$300,000（月給・年次賞与・住宅手当・追加の航空手当）」をそのまま推定年収にしています。外国人パイロット向けの契約（上海基地・3年契約）の額で、中国人の社員の給与表ではありません。税引き前か後かは書かれていません。幅の下は前の値のままです。',
        method_en: 'The posting’s “annual salary package of USD 300,000 (monthly pay, annual bonus, living allowance and extra air travel allowance)” is used as the estimate as it stands. It is a contract for foreign pilots (Shanghai base, three years), not China Eastern’s own staff pay scale. It does not say whether the figure is before or after tax. The bottom of the range is unchanged.',
        as_of: 'ページに日付の記載なし（2026年10月30日に確認）',
        as_of_en: 'No date given on the page (checked 30 October 2026)',
      },
      held: { was: { avg: 2900, lo: 2100, hi: 4600 },
        why: '（2026-10-30 まで）会社の公表は金額ゼロ（採用サイトにパイロットの募集自体が無い）。金額があるのは人材会社の求人1本（A330 機長・日付なし）だけで、年額の平均・レンジを支える資料は無い。2026-10-30 にオーナーの判断（代理店の求人を使ってよい）でこの求人の年額を推定年収にした。' } },
    fo: { tier: 'estimate', held: { was: { avg: 1480, lo: 980, hi: 2100 },
      why: '副操縦士の金額はどの資料にも無い（人材会社の求人も機長だけ）。' } },
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
    cap: { tier: 'estimate', held: { was: { avg: 1900, lo: 1300, hi: 2600 },
      why: 'パイロットの募集そのものが無く（公式の採用システムの27件に1件も無い）、金額を書いた公式資料も無い。レンジの出所の記録も無い。' } },
    fo: { tier: 'estimate', held: { was: { avg: 1000, lo: 650, hi: 1350 }, why: '機長と同じ理由。' } },
  },

  /* ══ ANA ══ ★有資格パイロットの募集要項が、採用サイトに載っていない（キャリア採用の一覧に運航乗務職の枠が無い）。
     ⚠️ 「募集そのものが無い」とは書かない。会社は職種紹介で「ライセンサーの採用も行っている」と書いている
        （airline-facts.mjs の ana.jobs の license_holders。2026-10-08 に両方のページを開いて確かめた）。
     金額があるのは2つ ── 自社養成の新卒募集要項（訓練生の入社時の月額）と、
     有報 第76期が初めて載せた運航乗務職の平均（★3社をあわせた額。機長と副操縦士を分けていない）。
     ⚠️ crew の額を全日本空輸だけの額・機長の額・副操縦士の額として使わない（表の注 ※2）。
     ⚠️ ANAホールディングスの有報の「一般従業員 276名 7,302千円」を使わない。
        持株会社（管理部門）の全従業員の平均で、しかも全日本空輸からの出向者が主体。
        同じ有報の全日本空輸の職種別の表には、男女の賃金差異・平均年齢・人員構成比しか無く金額が無い。
     ⚠️ 連合の「回答速報」に出る運航乗務職（訓練生）T等級 9,000円は引き上げ額。年収の裏づけにならない。 */
  'ana': {
    cur: 'JPY',
    tax: '課税（日本）',
    src: [
      { pub: 'ANAホールディングス株式会社（EDINET・有価証券報告書）', pub_en: 'ANA Holdings Inc. (EDINET, annual securities report)',
        name: '第76期 有価証券報告書 ５【従業員の状況等】＜参考＞職種別 グループ連結 平均年間給与',
        as_of: '2026年3月期（2026年6月25日提出・書類ID S100YKL4）', accessed: '2026-10-04',
        url: 'https://disclosure2dl.edinet-fsa.go.jp/searchdocument/pdf/S100YKL4.pdf' },
      { pub: '全日本空輸株式会社（ANA 採用サイト）', pub_en: 'All Nippon Airways Co., Ltd. (ANA recruitment site)',
        name: '2027年度入社 新卒採用 募集要項（運航乗務職／自社養成パイロット）',
        as_of: '給与欄に「2026年度予定（2026年3月16日更新）」', accessed: '2026-09-29',
        url: 'https://www.ana.co.jp/group/recruit/ana-recruit/occupation/entry/' },
    ],
    notes: [
      '平均は機長と副操縦士をあわせた運航乗務職全体の額です。機長だけ・副操縦士だけの平均は公表されていません。',
      '全日本空輸だけの額ではなく、全日本空輸・ANAウイングス・エアージャパンをあわせた額です（会社が表の注でそう書いています）。',
      '訓練生が人数に入るか、賞与と基準外賃金を含むかは、この表には書かれていません。',
      '訓練生の額は自社養成パイロット（運航乗務職）の入社時の額です。機長・副操縦士の金額ではありません。',
      '訓練生の額は月額の基本部分だけです。家族手当・住宅手当・深夜労働手当などの諸手当と年3回の賞与は、「支給する」と書かれているだけで金額がありません。',
      '訓練生の額について、会社は「2026年度予定（2026年3月16日更新）」と書いています。2027年度入社者に確定した額ではありません。',
      '訓練生の額が税引き前か後かは書かれていません。',
      '採用人数は65名程度。乗務開始後は東京勤務で、休日は月10日程度です。',
    ],
    notes_en: [
      'The average is for flight crew as a whole, captains and first officers together; the filing does not break it out by rank.',
      'It is not a figure for All Nippon Airways alone: it combines three group airlines, All Nippon Airways, ANA Wings and Air Japan, as the note to the table states.',
      'The table does not say whether trainees are counted, or whether bonuses and non-standard pay are included.',
      'The trainee figure is the starting pay for the airline’s own ab-initio cadet program. It is not a figure for captains or first officers.',
      'The trainee figure is the basic monthly amount only. Family, housing and night-work allowances and three bonus payments a year are listed as payable, with no amounts given.',
      'The airline labels the trainee figure "planned for FY2026, updated 16 March 2026". It is not a confirmed figure for those joining in FY2027.',
      'The posting does not say whether the trainee figure is before or after tax.',
      'About 65 places are offered. Once flying, the base is Tokyo with around ten days off a month.',
    ],
    crew: { tier: 'observed_mean',
      groups: [
        /* ⚠️ 画面に出る字に「◯社」と書かない（career.html は掲載社数を置かない決まりで、検査が数字＋社を見ている）。 */
        { name: '運航乗務職（ANA／ANAウイングス／エアージャパンの合計・2026年3月期）',
          name_en: 'Flight crew, three group airlines combined, year ended March 2026', avg_y: 23355000 },
      ] },
    trainee: { tier: 'employer_example',
      groups: [
        { name: '自社養成パイロット訓練生・院卒（入社時）', name_en: 'Company-sponsored pilot cadet, master’s graduate (on joining)', start_m: 276528,
          req: '2027年4月1日入社予定・FCAT 受験が必須・プレエントリー締切 2026年3月10日' },
        { name: '自社養成パイロット訓練生・大卒／高等専門学校（専攻科）卒（入社時）', name_en: 'Company-sponsored pilot cadet, bachelor’s or KOSEN advanced-course graduate (on joining)', start_m: 267770 },
      ] },
    cap: { tier: 'estimate', est_status: 'unconfirmed',
      est_why: 'ANA の機長の年収を示す資料が1件も無い。会社が公表しているのは3社（ANA・ANAウイングス・エアージャパン）をあわせた運航乗務職全体の平均だけで、職位では分かれていない。旧額の出所の記録も無い。',
      held: { was: { avg: 2700, lo: 2200, hi: 3500 },
      why: '有資格パイロットの募集要項が採用サイトに載っておらず（キャリア採用の一覧に運航乗務職の枠が無い）、機長の金額を書いた公式資料が1件も無い。有報にあるのは3社をあわせた運航乗務職全体の平均だけで、機長の数字は無い。レンジの出所の記録も無い。' } },
    fo: { tier: 'estimate', est_status: 'unconfirmed',
      est_why: '機長と同じ理由。',
      held: { was: { avg: 1800, lo: 1400, hi: 2100 }, why: '機長と同じ理由。' } },
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
      { pub: '日本航空株式会社（EDINET・有価証券報告書）', pub_en: 'Japan Airlines Co., Ltd. (EDINET, annual securities report)',
        name: '第76期 有価証券報告書 ５【従業員の状況】（参考情報）平均年間給与',
        as_of: '2025年3月期（2025年6月23日提出・書類ID S100W1KL）', accessed: '2026-09-29',
        url: 'https://disclosure2dl.edinet-fsa.go.jp/searchdocument/pdf/S100W1KL.pdf' },
      { pub: '日本航空株式会社（EDINET・有価証券報告書）', pub_en: 'Japan Airlines Co., Ltd. (EDINET, annual securities report)',
        name: '第75期 有価証券報告書 ５【従業員の状況】（参考情報）平均年間給与',
        as_of: '2024年3月期（2024年6月19日提出・書類ID S100TNGJ）', accessed: '2026-09-29',
        url: 'https://disclosure2dl.edinet-fsa.go.jp/searchdocument/pdf/S100TNGJ.pdf' },
      { pub: '日本航空株式会社（JAL 採用サイト）', pub_en: 'Japan Airlines Co., Ltd. (JAL recruitment site)',
        name: '運航乗務員訓練生（自社養成パイロット）募集要項',
        as_of: '給与欄に「※2026年3月27日時点」', accessed: '2026-09-29',
        url: 'https://www.job-jal.com/recruit/requirement/new-graduate05.html' },
    ],
    notes: [
      'これは機長と副操縦士をあわせた運航乗務員全体の平均です。機長だけ・副操縦士だけの平均は公表されていません。',
      '日本航空単体ではなくグループ連結の数字です（会社が注でそう書いています）。',
      '算定方法は会社の注のとおり「連結人件費に含まれる現金給与相当額を当事業年度中の平均在籍人数で除して算出」＝税引き前の考え方です。賞与・手当を含むかは注に明記がありません。',
      '訓練生の額は運航乗務員訓練生の入社時の月額で、機長・副操縦士の金額ではありません。自社養成パイロットの募集には、事業用操縦士免許を保有または過去に取得した人は応募できません。',
      '採用予定数は2027年度入社で新卒・キャリア合計50名程度、乗務開始後の休日は原則月10日です。',
    ],
    notes_en: [
      'This is the average for flight crew as a whole, captains and first officers together; the filing does not break it out by rank.',
      'It covers the JAL group on a consolidated basis, not Japan Airlines alone — the filing says so in its note.',
      'The airline states the method: cash-equivalent pay within consolidated personnel costs, divided by the average headcount on the books during the year. That is a pre-tax basis. The note does not say whether bonuses and allowances are included.',
      'The trainee figure is the starting monthly pay for a flight-crew trainee, not a figure for captains or first officers. Anyone who holds or has held a commercial pilot license cannot apply to the airline’s own ab-initio cadet program.',
      'About 50 places are offered for FY2027 across graduate and career intake, with around ten days off a month once flying.',
    ],
    crew: { tier: 'observed_mean',
      groups: [
        { name: '運航乗務員（グループ連結・2025年3月期）',
          name_en: 'Flight crew, group consolidated, year ended March 2025', avg_y: 20051000 },
        { name: '運航乗務員（グループ連結・2024年3月期）',
          name_en: 'Flight crew, group consolidated, year ended March 2024', avg_y: 19593000 },
      ] },
    trainee: { tier: 'employer_example',
      groups: [{ name: '運航乗務員訓練生（入社時）', name_en: 'Flight crew trainee (on joining)', start_m: 263000,
        req: '矯正視力1.0以上・屈折度 -6.0〜+2.0ジオプトリー・事業用操縦士免許の保有者および過去に取得した者は応募不可' }] },
    cap: { tier: 'estimate', est_status: 'unconfirmed',
      est_why: 'JAL の機長の年収を示す資料が1件も無い。会社が公表しているのは運航乗務員全体（グループ連結）の平均だけで、職位では分かれていない。旧額の出所の記録も無い。',
      held: { was: { avg: 2700, lo: 2200, hi: 3500 },
      why: '会社が公表しているのは機長と副操縦士をあわせた運航乗務員全体の平均で、職位別の平均は公表されていない。機長の募集要項そのものが無く（ライセンス保有者枠は「在籍中の各養成機関に問い合わせ」とだけ）、金額も無い。レンジの出所の記録も無い。' } },
    fo: { tier: 'estimate', est_status: 'unconfirmed',
      est_why: '機長と同じ理由。',
      held: { was: { avg: 1800, lo: 1400, hi: 2100 }, why: '機長と同じ理由。' } },
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
      { pub: 'スカイマーク株式会社（EDINET・有価証券報告書）', pub_en: 'Skymark Airlines Inc. (EDINET, annual securities report)',
        name: '第29期 有価証券報告書 【従業員の状況】（1）提出会社の状況',
        as_of: '2025年3月31日現在（2025年6月26日提出・書類ID S100W68U）', accessed: '2026-09-29',
        url: 'https://disclosure2dl.edinet-fsa.go.jp/searchdocument/pdf/S100W68U.pdf' },
      { pub: 'スカイマーク株式会社（採用サイト）', pub_en: 'Skymark Airlines Inc. (recruitment site)', name: '自社養成パイロット訓練生 募集要項',
        as_of: '掲載時点の記載なし', accessed: '2026-09-29',
        url: 'https://www.skymark.co.jp/ja/company/recruit/saiyo/recruit/' },
      /* g4 src */
      { pub: 'PILOT VALUE', pub_en: 'PILOT VALUE', name: 'REAL PAY（会員が出した給与）', name_en: 'REAL PAY (pay submitted by members)',
        as_of: '2026-10-30 集計', as_of_en: 'Counted 30 October 2026', accessed: '2026-10-30',
        url: 'https://pilot-value.com/actual-pay.html' },
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
      'This is the average for 290 flight crew, captains and first officers together; the filing does not break it out by rank.',
      'It covers Skymark alone, and the filing’s note excludes trainees from the headcount.',
      'Flight crew seconded from staffing agencies are counted in the headcount but excluded from the pay calculation, as the filing states.',
      'Bonuses and non-standard wages are included, per the filing’s note. The figure is as at 31 March 2025.',
      'The trainee figure is basic pay and includes the defined-contribution pension election amount, as the airline states. The airline also notes it varies once training begins.',
      'For experienced hires (B737 captain and first officer candidates) the airline states that pay is not disclosed and follows internal rules.',
    ],
    crew: { tier: 'observed_mean',
      groups: [{ name: '運航乗務員 290名（スカイマーク単体・2025年3月31日現在）',
        name_en: 'Flight crew, 290 people (Skymark alone, as at 31 March 2025)', avg_y: 16456000 }] },
    trainee: { tier: 'employer_example',
      groups: [{ name: '自社養成パイロット訓練生・院卒／大卒（入社時の基本給）', name_en: 'Company-sponsored pilot cadet, master’s or bachelor’s graduate (base pay on joining)', start_m: 250000,
        req: 'TOEIC 750点以上または IELTS Overall 6.0以上・矯正視力0.7以上（両眼1.0以上）・事業用操縦士免許保有者は応募不可' }] },
    cap: { tier: 'estimate', held: { was: { avg: 1900, lo: 1600, hi: 2300 },
      why: '会社が公表しているのは機長と副操縦士をあわせた運航乗務員全体の平均で、職位別の平均は公表されていない。経験者採用の求人は「給与 非公開」「当社規程による」で金額が無い。レンジの出所の記録も無い。' } },
    fo: { from: 'members', /* g4 fo */ est: {
        basis: 'PILOT VALUE にスカイマークの副操縦士が出した給与（直近24か月）',
        basis_en: 'Pay submitted to PILOT VALUE by Skymark Airlines first officers (past 24 months)',
        method: '会員が出した年収の中央値です（1人につき最新の1件・1万円単位）。会社の年金拠出など、給与明細に載らない分は入っていません。',
        method_en: 'The median of the annual pay members have submitted (the latest entry per person, to the nearest ¥10,000). Amounts that do not appear on a payslip, such as the company pension contribution, are not included.',
        as_of: '2026年10月30日 集計', as_of_en: 'Counted 30 October 2026',
      }, tier: 'estimate', held: { was: { avg: 950, lo: 700, hi: 1200 }, why: '機長と同じ理由。' } },
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
      { pub: '株式会社ジェイエア（採用サイト）', pub_en: 'J-AIR Corporation (recruitment site)',
        name: '運航乗務員訓練生（自社養成パイロット）募集要項',
        as_of: 'ページ冒頭に「募集は終了しております。前回分を参考までに掲載します。」', accessed: '2026-09-29',
        url: 'https://www.jair.co.jp/about/recruit/pilot/apply02.html' },
      /* g4 src */
      { pub: 'PILOT VALUE', pub_en: 'PILOT VALUE', name: 'REAL PAY（会員が出した給与）', name_en: 'REAL PAY (pay submitted by members)',
        as_of: '2026-10-30 集計', as_of_en: 'Counted 30 October 2026', accessed: '2026-10-30',
        url: 'https://pilot-value.com/actual-pay.html' },
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
      groups: [{ name: '運航乗務員訓練生（入社後の初期訓練期間中・募集終了の要項）', name_en: 'Flight crew trainee (during initial training after joining; terms of a closed recruitment)', train_m: 221100,
        req: '採用予定数15名程度・矯正視力0.7以上（両眼1.0以上）・事業用操縦士免許保有者は応募不可・入社要件に IELTS と航空無線通信士' }] },
    cap: { tier: 'estimate', held: { was: { avg: 2000, lo: 1800, hi: 2300 },
      why: '機長の募集要項は「当社規程による」「面接時に説明」で金額が無い。非上場で有価証券報告書が無く、親会社の有報にも職種別の給与が無い。レンジの出所の記録も無い。' } },
    fo: { from: 'members', /* g4 fo */ est: {
        basis: 'PILOT VALUE にジェイエアの副操縦士が出した給与（直近24か月）',
        basis_en: 'Pay submitted to PILOT VALUE by J-Air (J-AIR) first officers (past 24 months)',
        method: '会員が出した年収の中央値です（1人につき最新の1件・1万円単位）。会社の年金拠出など、給与明細に載らない分は入っていません。',
        method_en: 'The median of the annual pay members have submitted (the latest entry per person, to the nearest ¥10,000). Amounts that do not appear on a payslip, such as the company pension contribution, are not included.',
        as_of: '2026年10月30日 集計', as_of_en: 'Counted 30 October 2026',
      }, tier: 'estimate', held: { was: { avg: 1250, lo: 1100, hi: 1500 }, why: '機長と同じ理由。' } },
  },

  /* ══ ジェットスター・ジャパン ══ 会社名義の募集要項は2016年のもの1本だけで、
     ★給与の節そのものが存在しない（全文を読んで確認）。
     現行の採用サイトは接続できず、採用管理システムの求人は0件。非上場で有報も無い。
     ⚠️ ページに書いてある「副操縦士の月額基本給 ¥150万」は出所が無く、同じページの
        副操縦士の上限1,600万と矛盾する（×12＝1,800万）。英語版は ¥125万で日英も食い違う。 */
  'jetstar-japan': {
    cur: 'JPY',
    tax: '課税（日本）',
    src: [
      /* g4 src */
      { pub: 'PILOT VALUE', pub_en: 'PILOT VALUE', name: 'REAL PAY（会員が出した給与）', name_en: 'REAL PAY (pay submitted by members)',
        as_of: '2026-10-30 集計', as_of_en: 'Counted 30 October 2026', accessed: '2026-10-30',
        url: 'https://pilot-value.com/actual-pay.html' },
    ], notes: [], notes_en: [],
    cap: { from: 'members', /* g4 cap */ est: {
        basis: 'PILOT VALUE にジェットスター・ジャパンの機長が出した給与（直近24か月）',
        basis_en: 'Pay submitted to PILOT VALUE by Jetstar Japan captains (past 24 months)',
        method: '会員が出した年収の中央値です（1人につき最新の1件・1万円単位）。会社の年金拠出など、給与明細に載らない分は入っていません。',
        method_en: 'The median of the annual pay members have submitted (the latest entry per person, to the nearest ¥10,000). Amounts that do not appear on a payslip, such as the company pension contribution, are not included.',
        as_of: '2026年10月30日 集計', as_of_en: 'Counted 30 October 2026',
      }, tier: 'estimate', held: { was: { avg: 2400, lo: 2000, hi: 2900 },
      why: '会社名義の募集要項（2016年）に給与の節そのものが無い。現行の採用サイトは読めず、採用管理システムの求人は0件。非上場で有価証券報告書も無い。レンジの出所の記録も無い。' } },
    fo: { from: 'members', /* g4 fo */ est: {
        basis: 'PILOT VALUE にジェットスター・ジャパンの副操縦士が出した給与（直近24か月）',
        basis_en: 'Pay submitted to PILOT VALUE by Jetstar Japan first officers (past 24 months)',
        method: '会員が出した年収の中央値です（1人につき最新の1件・1万円単位）。会社の年金拠出など、給与明細に載らない分は入っていません。',
        method_en: 'The median of the annual pay members have submitted (the latest entry per person, to the nearest ¥10,000). Amounts that do not appear on a payslip, such as the company pension contribution, are not included.',
        as_of: '2026年10月30日 集計', as_of_en: 'Counted 30 October 2026',
      }, tier: 'estimate', held: { was: { avg: 1450, lo: 1250, hi: 1600 },
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
      { pub: 'Peach Aviation株式会社（採用サイト）', pub_en: 'Peach Aviation Limited (recruitment site)', name: 'パイロットチャレンジ制度 応募要領',
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
      'It applies to trainees before they hold a license, on an initial two-year fixed-term contract. It is not a figure for captains or first officers.',
      'Training costs fall on the trainee. The airline states training costs of about 14.6 million yen (FY2022 actual), with a partner bank loan available; Peach covers the later domestic phase in full.',
      'A bonus is listed as payable with no amount. The posting does not say whether the figure is before or after tax.',
      'The FY2023 intake is closed, and the terms are not stated as applying to the next round.',
      'For captains the posting says pay follows internal rules and is explained during selection, with no amount. There is no first officer vacancy at all.',
    ],
    trainee: { tier: 'employer_example',
      groups: [{ name: 'パイロットチャレンジ制度の訓練生（有期契約・ライセンス取得前）', name_en: 'Pilot Challenge trainee (fixed-term contract, before licensing)', allow_train_m: 250000,
        req: '2027年4月1日時点で矯正視力0.7以上（両眼1.0以上）・ジオプトリ -5.5〜+4.5・GTEC 660点相当程度・事業用および自家用操縦士免許の非保有・FCAT 合格・募集人数は若干名' }] },
    cap: { tier: 'estimate', held: { was: { avg: 2350, lo: 2000, hi: 2800 },
      why: '機長の求人の給与が「当社規定による（選考時に説明）」で金額が無い。非上場で有価証券報告書も無く、親会社の有報にも職種別の給与が無い。レンジの出所の記録も無い。' } },
    fo: { tier: 'estimate', held: { was: { avg: 1400, lo: 1000, hi: 1600 },
      why: '副操縦士の募集そのものが無いので、会社の資料に金額が存在しない。レンジの出所の記録も無い。' } },
  },

  /* ══ ZIPAIR ══ 公式の募集要項に給与の節はあるが、金額が書かれていない
     （「当社規程により支給。詳細については、選考における面接時に説明します。」）。
     非上場で有報が無く、親会社 JAL の有報にも ZIPAIR の職種別給与は無い。 */
  'zipair': {
    cur: 'JPY',
    tax: '課税（日本）',
    src: [], notes: [], notes_en: [],
    cap: { tier: 'estimate', held: { was: { avg: 2500, lo: 2200, hi: 3100 },
      why: '公式の募集要項の給与の節が「当社規程により支給。詳細については、選考における面接時に説明します。」で金額が無い。非上場で有価証券報告書も無い。レンジの出所の記録も無い。' } },
    fo: { tier: 'estimate', held: { was: { avg: 1500, lo: 1200, hi: 1900 }, why: '機長と同じ理由。' } },
  },

  /* ══ KLM・スイス・オーストリア ══ ★2026-10-29（オーナー OK・Gemini の年収の調べ 2回目「01-欧州の大手5社」）。
     額は salary-data.mjs、出どころの記録と計算の内訳は salary-sources.mjs。会社の公表額は無い（groups なし）＝ どの職位も「推定」。
     ★KLM はオーナーの決め（2026-10-29「上乗せなし。他にどれくらい増えるのか書いてね」）── 年齢に応じた現金の手当3つ
       （明細の 2590・2591 ＝ 年金の代わりの手当／1085 ＝ levensloop）は推定年収に入れず、増える額を算出方法の文に書く。
       機長は B737 と長距離の最上段の真ん中（オーナー「その真ん中で詳細は会社ページにかこう」）。副操縦士は入社23歳・6年目と仮に置いた。
     ⚠️ 第三者のサイトに置かれた協約の写し・報道・利用者が書き込む表には secondary を付ける。
     ⚠️ 円額をここに書かない（ユーロ・フランのまま）。 */
  'klm': {
    tax: '課税（オランダ）', tax_en: 'Taxed (Netherlands)',
    src: [
      { pub: 'KLM とパイロット組合 VNV の労働協約（第三者のサイトに置かれた写し）', pub_en: 'KLM–VNV pilot collective agreement (copy hosted on a third-party site)',
        name: 'CAO voor KLM-vliegers op vleugelvliegtuigen — versie april 2026',
        as_of: '2026年4月版', as_of_en: 'April 2026 version', accessed: '2026-10-29', secondary: true,
        url: 'https://content.helloflex.com/PublicCaoDocument/0fb8eccb-870b-4327-baf3-ebabc85649f3/downloadcao.pdf' },
      { pub: 'KLM パイロットの年金基金（Pensioenfonds Vliegend Personeel KLM）', pub_en: 'KLM pilots’ pension fund (Pensioenfonds Vliegend Personeel KLM)',
        name: 'Premieverdeling waarbij werkgever en werknemer beide bijdragen',
        as_of: '2026年1月1日の表', as_of_en: 'Rates effective 1 January 2026', accessed: '2026-10-29',
        url: 'https://klmvliegendfonds.nl/onze-regelingen/pensioenopbouw/pensioen-opbouwen-de-basispensioenregeling/hoe-bouwt-u-basispensioen-op/premieverdeling-waarbij-werkgever-en-werknemer-beide-bijdragen' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', est: {
      basis: 'KLM とパイロット組合 VNV の労働協約（2026年4月版）の給与の式と、KLM パイロットの年金基金の掛け金の表（2026年）',
      basis_en: 'The pay formula in the KLM–VNV pilot collective agreement (April 2026 version) and the KLM pilots’ pension fund contribution table (2026)',
      method: 'B737 の機長の最上段（年 €322,490）と、長距離機（B777・B787・A330・A350）の機長の最上段（年 €391,398）の真ん中です。どちらも月給の12か月分に、休暇手当 8%・年末手当 8.33%・年金の掛け金の手当 11%・会社の年金拠出 3.2% を足した額です。'
            + 'ほかに、年齢に応じて毎月払われる現金の手当が3つあります（年金の積み立ての代わりに払われる2つと levensloop）。推定年収には入れていませんが、52歳の機長では年に約 €133,700（B737）〜€169,400（長距離）増えます。'
            + '利益配分と日当も、直近の支給の資料が無いため入れていません。幅の上端は長距離の機長の最上段、下は前の値のままです。',
      method_en: 'The midpoint between a top-scale B737 captain (€322,490 a year) and a top-scale long-haul captain on the B777, B787, A330 or A350 (€391,398 a year). Both are 12 months’ salary plus the 8% holiday allowance, the 8.33% year-end payment, the 11% pension contribution allowance and the 3.2% company pension contribution. '
            + 'On top of this, three age-related cash allowances are paid monthly (two paid in place of pension accrual, plus levensloop). They are not included in the estimate, but at age 52 they add about €133,700 (B737) to €169,400 (long-haul) a year. '
            + 'Profit sharing and per diem are not included, as there is no source for recent payouts. The top of the range is a top-scale long-haul captain; the bottom is unchanged.',
      as_of: '2026年4月版の協約', as_of_en: 'April 2026 agreement',
    } },
    fo: { tier: 'estimate', est: {
      basis: 'KLM とパイロット組合 VNV の労働協約（2026年4月版）の給与の式と、KLM パイロットの年金基金の掛け金の表（2026年）',
      basis_en: 'The pay formula in the KLM–VNV pilot collective agreement (April 2026 version) and the KLM pilots’ pension fund contribution table (2026)',
      method: '入社23歳・6年目（29歳）と仮に置き、B737 の副操縦士（年 €143,330）と長距離機の副操縦士（年 €187,180）の真ん中にしています。どちらも機長と同じく、月給の12か月分に休暇手当・年末手当・年金の掛け金の手当・会社の年金拠出を足した額です。実際の額は入社の年齢と席次で変わります。'
            + '年齢に応じた現金の手当3つは推定年収に入れていませんが、29歳では年に約 €31,300 増えます。利益配分と日当も入れていません。幅の上端は長距離の副操縦士の最上段、下は前の値のままです。',
      method_en: 'Assumes joining at 23 and being in year 6 (age 29), and takes the midpoint between a B737 first officer (€143,330 a year) and a long-haul first officer (€187,180 a year). As for captains, both are 12 months’ salary plus the holiday allowance, year-end payment, pension contribution allowance and company pension contribution. Actual pay depends on age at joining and seniority. '
            + 'The three age-related cash allowances are not included, but at age 29 they add about €31,300 a year. Profit sharing and per diem are not included either. The top of the range is a top-scale long-haul first officer; the bottom is unchanged.',
      as_of: '2026年4月版の協約', as_of_en: 'April 2026 agreement',
    } },
  },

  'swiss': {
    tax: '課税（スイス）', tax_en: 'Taxed (Switzerland)',
    src: [
      { pub: 'Blick', pub_en: 'Blick', name: 'Die Swiss findet keine Piloten',
        as_of: '2025-11-08 掲載', as_of_en: 'Published 8 November 2025', accessed: '2026-10-29', secondary: true,
        url: 'https://www.blick.ch/wirtschaft/die-swiss-findet-keine-piloten/yb068hb' },
      { pub: 'PilotJobsNetwork（利用者が書き込む表）', pub_en: 'PilotJobsNetwork (user-contributed table)', name: 'Swiss International Air Lines',
        as_of: '2025-06-23 更新', as_of_en: 'Updated 23 June 2025', accessed: '2026-10-29', secondary: true,
        url: 'https://www.pilotjobsnetwork.com/jobs/Swiss_International_Air_Lines' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', est: {
      basis: 'スイス紙 Blick の記事（2025年11月）と、労働協約（GAV 2023）から写したとされる給与表',
      basis_en: 'An article in the Swiss paper Blick (November 2025) and a pay table said to be copied from the collective agreement (GAV 2023)',
      method: '記事の「長く勤めた機長は年 220,000 スイスフラン」に置いています。給与表の最上段（27年目 219,956 フラン）も同じ額です。年金・業績の上乗せ・日当は、資料が足りず入れていません。何時間飛んでも給与は同じとされています。幅は前の値のままです。',
      method_en: 'Set at the article’s “long-serving captains earn CHF 220,000 a year”. The top step of the pay table (year 27, CHF 219,956) matches. Pension, performance bonuses and per diem are not included, as the sources are not enough. Pay is reported to be the same regardless of hours flown. The range is unchanged.',
      as_of: '2025年11月', as_of_en: 'November 2025',
    } },
    fo: { tier: 'estimate' },
  },

  'austrian': {
    tax: '課税（オーストリア）', tax_en: 'Taxed (Austria)',
    src: [
      { pub: 'オーストリア航空の乗務員の労働協約', pub_en: 'Austrian Airlines cabin and cockpit crew collective agreement',
        name: 'Kollektivvertrag für das Bordpersonal der Austrian Airlines（Gehaltstabellen gültig ab 01.01.2026）',
        name_en: 'Kollektivvertrag für das Bordpersonal der Austrian Airlines (pay tables valid from 1 January 2026)',
        as_of: '2026年1月からの給与表（2026年6月の変更を含む）', as_of_en: 'Pay tables from 1 January 2026 (including the June 2026 changes)', accessed: '2026-10-29',
        url: 'https://www.kollektivvertrag.at/volltext?doc-set-id=SI-2022_de' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', est: {
      basis: 'オーストリア航空の乗務員の労働協約（2026年1月からの給与表）',
      basis_en: 'The Austrian Airlines crew collective agreement (pay tables from January 2026)',
      method: 'Mainline の機長の最上段（29年目）の月の総額 €17,093.51 を、協約どおり年14回（6月と11月の特別支給を含む）受け取る形にし、会社の年金拠出 5%（15年目から）を足しています。幅の下は1年目の機長です。業績に連動する配分と日当は、直近の支給の資料が無いため入れていません。',
      method_en: 'A top-step Mainline captain (year 29) at €17,093.51 gross a month, paid 14 times a year as the agreement sets out (including the June and November special payments), plus the 5% company pension contribution (from year 15). The bottom of the range is a first-year captain. Profit-linked pay and per diem are not included, as there is no source for recent payouts.',
      as_of: '2026年1月からの給与表', as_of_en: 'Pay tables from January 2026',
    } },
    fo: { tier: 'estimate', est: {
      basis: 'オーストリア航空の乗務員の労働協約（2026年1月からの給与表）',
      basis_en: 'The Austrian Airlines crew collective agreement (pay tables from January 2026)',
      method: '副操縦士の6年目の月の総額 €7,754.06 を年14回受け取る形にし、会社の年金拠出 4% を足しています。幅は1年目から29年目までです。業績に連動する配分と日当は入れていません。',
      method_en: 'A year-6 first officer at €7,754.06 gross a month, paid 14 times a year, plus the 4% company pension contribution. The range runs from year 1 to year 29. Profit-linked pay and per diem are not included.',
      as_of: '2026年1月からの給与表', as_of_en: 'Pay tables from January 2026',
    } },
  },

  /* ══ ルフトハンザ ══ ★2026-10-27（オーナー判断 P12.133「ルフトハンザの機長 1」）。
     機長の推定年収を、2026年の報道の額に合わせて上げた（3,440万 → 3,900万。額は salary-data.mjs、出どころの記録は salary-sources.mjs）。
     会社の公表額は無い（groups なし）＝ 機長・副操縦士とも「推定」のまま。ここに置くのは、機長の推定に添える 根拠・算出方法・時点（est）と、その記事だけ。
     ⚠️ 記事は額の出どころを「Eine aktuelle Analyse」「Quellen」としか書いていない（会社・組合の資料名は無い）＝ 報道の印（secondary）を付ける。
     ⚠️ cur と tax は置いていない。画面に出す外貨の額が無い（cur を置くと換算の断り書きが出る）・税の札は今までどおり出さない。
     副操縦士は今までどおり（出どころの記録なし）。
     ★2026-10-28（オーナー判断 P12.134「ルフトの上限もあげよう」）── 機長の幅の上端も同じ記事の「上位の職 約€260,000」に合わせた
       （4,320万 → 4,830万）。算出方法に、そのことを1文だけ足した。 */
  'lufthansa': {
    src: [
      { pub: 'MARES', pub_en: 'MARES', name: 'Lufthansa Piloten verdienen 2026 bis 300.000 Euro jährlich',
        as_of: '2026-09-04 掲載', accessed: '2026-10-27', secondary: true,
        url: 'https://joinmares.com/artikel/lufthansa-piloten-verdienen-2026-bis-300-000-euro-jaehrlich' },
    ],
    notes: [], notes_en: [],
    cap: {
      tier: 'estimate',
      est: {
        basis: 'MARES の記事「Lufthansa Piloten verdienen 2026 bis 300.000 Euro jährlich」（2026年9月4日。ルフトハンザのパイロットの給与を紹介した報道）',
        basis_en: 'MARES, “Lufthansa Piloten verdienen 2026 bis 300.000 Euro jährlich”, 4 September 2026 (a press report on Lufthansa pilot pay)',
        method: '記事は、長距離の機長は年20万ユーロを超え、上位の職では約26万ユーロと書いています。推定年収は、その20万ユーロを少し上回る額に置いています。幅の上端は、その約26万ユーロに置いています。',
        method_en: 'The article says long-haul captains earn more than EUR 200,000 a year and that top positions reach about EUR 260,000. The estimate is set just above EUR 200,000. The top of the range is set at about EUR 260,000.',
        as_of: '2026年9月',
        as_of_en: 'September 2026',
      },
    },
    fo: { tier: 'estimate' },
  },

  /* ══ 給与表から作り直した11社 ══ ★2026-10-29（オーナー OK「11社ぜんぶ」・WP-compare-all-26）。
     米国6社・エア・カナダ・カンタス・ジェットスター・イベリア・TAP。額は salary-data.mjs、出どころの記録と計算の内訳は salary-sources.mjs。
     ここに置くのは、推定に添える 根拠・算出方法・時点（est）と画面に出す出どころだけ。会社の公表額は無い（groups なし）＝ どの職位も「推定」。
     オーナーの決まり（2026-10-29）：機長＝最上段（米国は12年目）・いちばん多い機材／副操縦士＝6年目。時給 × 年間の時間（豪州は年俸）＋ 利益配分 ＋
       会社の年金拠出。日当は「家を離れている時間」の資料がある会社だけ（ジェットスター・TAP）。最低保証の時間で出して今より低くなる値は下げない。
     ⚠️ サウスウエスト・アラスカ・ジェットブルーの副操縦士と、イベリアの副操縦士は、推定年収そのものは前の値のまま（算出方法の文がそう言う）。
     ⚠️ 第三者の資料（報道・まとめ記事・第三者のサイトに置かれた協約の写し）には secondary を付ける。組合・官報・公正労働委員会の資料には付けない。
     ⚠️ cur は置いていない（画面に出す外貨の額は無い ＝ 換算の断り書きを出さない）。tax は置く（gen-faq.mjs の税の問がこの字を読む）。 */
  'delta': {
    tax: '課税（米国）', tax_en: 'Taxed (United States)',
    src: [
      { pub: 'ALPA デルタ支部（Delta MEC）', pub_en: 'ALPA Delta MEC', name: 'pilot contract COMPARISON',
        as_of: '2026年1月1日の時給（2025年夏時点の資料）', as_of_en: 'Pay rates effective 1 January 2026', accessed: '2026-10-29',
        url: 'https://dal.alpa.org/Portals/1/ThemePluginPro/uploads/2025/9/2/DALContractComparison-2026.pdf' },
      { pub: 'airlinepilothiring.net（協約の写し）', pub_en: 'airlinepilothiring.net (copy of the contract)', name: 'Delta Pilot Working Agreement 2023 — Section 3 Compensation',
        as_of: '2026年1月の時給表', as_of_en: 'Pay table effective January 2026', accessed: '2026-10-29', secondary: true,
        url: 'https://airlinepilothiring.net/TentativeAgreements/2023Delta.pdf' },
      { pub: 'デルタ航空（SEC 提出書類）', pub_en: 'Delta Air Lines (SEC filing)', name: '2026 Proxy Statement (DEF 14A)',
        as_of: '2026-05-08 掲載', accessed: '2026-10-29',
        url: 'https://www.sec.gov/Archives/edgar/data/27904/000130817926000345/dal014970-def14a.htm' },
      { pub: 'Paddle Your Own Kanoo', pub_en: 'Paddle Your Own Kanoo', name: 'American Airlines Flight Attendants Furious Over 0.3% Profit-Sharing Bonus Amid Operational Meltdown',
        as_of: '2026-01-27 掲載', accessed: '2026-10-29', secondary: true,
        url: 'https://www.paddleyourownkanoo.com/2026/01/27/american-airlines-flight-attendants-furious-over-0-3-profit-sharing-bonus-amid-operational-meltdown/' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', est: {
      basis: 'パイロット組合 ALPA デルタ支部の「pilot contract COMPARISON」（2026年1月1日の時給・月の時間・会社の年金拠出）と、利益配分の報道（2026年1月）・デルタ航空の株主総会資料（2026年5月）',
      basis_en: 'ALPA Delta MEC, “pilot contract COMPARISON” (pay rates effective 1 January 2026, monthly hours and the company 401(k) contribution), plus a news report on profit sharing (January 2026) and Delta’s 2026 proxy statement (May 2026)',
      method: '12年目の機長（A321・737-900）の時給 $390.30 に、会社が組む月の時間 73〜78時間のまん中（年906時間）を掛け、2025年分の利益配分 8.9% と会社の年金拠出 18% を足しています。幅は、1年目の B717 の機長から12年目の広胴機の機長までです。日当は入れていません（家を離れている時間の資料が無いため）。',
      method_en: 'A year-12 A321/737-900 captain’s rate of $390.30 an hour, times the middle of Delta’s 73–78 hour monthly line value (906 hours a year), plus 8.9% profit sharing for 2025 and the 18% company 401(k) contribution. The range runs from a year-1 B717 captain to a year-12 widebody captain. Per diem is not included (no source for time away from base).',
      as_of: '2026年1月の時給・2025年分の利益配分', as_of_en: 'Pay rates from January 2026; profit sharing for 2025',
    } },
    fo: { tier: 'estimate', est: {
      basis: '協約（2023年）の2026年1月の時給表（第三者のサイトに置かれた写し）と、パイロット組合 ALPA デルタ支部の「pilot contract COMPARISON」・利益配分の報道',
      basis_en: 'The 2023 pilot contract’s January 2026 pay table (a copy hosted by a third-party site), ALPA Delta MEC’s “pilot contract COMPARISON” and a news report on profit sharing',
      method: '6年目の副操縦士（A321・737-900）の時給 $242.91 に年906時間を掛け、利益配分 8.9% と会社の年金拠出 18% を足しています。$242.91 は協約の表の $238.12 に、表の12年目と組合資料の2026年1月の12年目の差と同じ 2.01% を掛けた額です。幅は、1年目から12年目の広胴機の副操縦士までです。日当は入れていません。',
      method_en: 'A year-6 A321/737-900 first officer’s rate of $242.91 an hour times 906 hours a year, plus 8.9% profit sharing and the 18% company 401(k) contribution. $242.91 is the contract table’s $238.12 raised by the same 2.01% that separates the table’s year-12 rate from the union’s January 2026 year-12 rate. The range runs from year 1 to a year-12 widebody first officer. Per diem is not included.',
      as_of: '2026年1月の時給・2025年分の利益配分', as_of_en: 'Pay rates from January 2026; profit sharing for 2025',
    } },
  },

  'united': {
    tax: '課税（米国）', tax_en: 'Taxed (United States)',
    src: [
      { pub: 'ALPA ユナイテッド支部（United MEC）', pub_en: 'ALPA United MEC', name: 'United Pilot Agreement 2023 (redline) — Pay Rates January 2026',
        as_of: '2026年1月の時給表', as_of_en: 'Pay table effective January 2026', accessed: '2026-10-29',
        url: 'https://d2r1lrrqctgamh.cloudfront.net/UAL/TA/upa23-2023-09-01-redline.pdf' },
      { pub: 'ALPA デルタ支部（Delta MEC）', pub_en: 'ALPA Delta MEC', name: 'pilot contract COMPARISON',
        as_of: '2026年1月1日の時給（2025年夏時点の資料）', as_of_en: 'Pay rates effective 1 January 2026', accessed: '2026-10-29',
        url: 'https://dal.alpa.org/Portals/1/ThemePluginPro/uploads/2025/9/2/DALContractComparison-2026.pdf' },
      { pub: 'Paddle Your Own Kanoo', pub_en: 'Paddle Your Own Kanoo', name: 'American Airlines Flight Attendants Furious Over 0.3% Profit-Sharing Bonus Amid Operational Meltdown',
        as_of: '2026-01-27 掲載', accessed: '2026-10-29', secondary: true,
        url: 'https://www.paddleyourownkanoo.com/2026/01/27/american-airlines-flight-attendants-furious-over-0-3-profit-sharing-bonus-amid-operational-meltdown/' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', est: {
      basis: 'ユナイテッド航空のパイロットの協約 UPA 2023（2026年1月の時給表）、パイロット組合 ALPA デルタ支部の「pilot contract COMPARISON」（月の保証・会社の年金拠出）、利益配分の報道（2026年1月）',
      basis_en: 'United’s pilot contract, UPA 2023 (January 2026 pay table), ALPA Delta MEC’s “pilot contract COMPARISON” (monthly guarantee and company 401(k) contribution) and a news report on profit sharing (January 2026)',
      method: '12年目の機長（737-800・A320）の時給 $388.27 に、月の最低保証 70時間（年840時間）を掛け、利益配分 4.5% と会社の年金拠出 18% を足しています。幅の下は1年目です。上端は前の値のままです（最低保証の時間で出すと今より低くなるため）。日当は入れていません（家を離れている時間の資料が無いため）。',
      method_en: 'A year-12 737-800/A320 captain’s rate of $388.27 an hour, times the 70-hour monthly minimum guarantee (840 hours a year), plus 4.5% profit sharing and the 18% company 401(k) contribution. The bottom of the range is year 1; the top is unchanged (on the minimum guarantee it would come out below today’s figure). Per diem is not included (no source for time away from base).',
      as_of: '2026年1月の時給・2025年分の利益配分', as_of_en: 'Pay rates from January 2026; profit sharing for 2025',
    } },
    fo: { tier: 'estimate', est: {
      basis: 'ユナイテッド航空のパイロットの協約 UPA 2023（2026年1月の時給表）、パイロット組合 ALPA デルタ支部の「pilot contract COMPARISON」、利益配分の報道（2026年1月）',
      basis_en: 'United’s pilot contract, UPA 2023 (January 2026 pay table), ALPA Delta MEC’s “pilot contract COMPARISON” and a news report on profit sharing (January 2026)',
      method: '6年目の副操縦士（737-800・A320）の時給 $241.75 に、月の最低保証 70時間（年840時間）を掛け、利益配分 4.5% と会社の年金拠出 18% を足しています。幅は、1年目から12年目の広胴機の副操縦士までです。日当は入れていません。',
      method_en: 'A year-6 737-800/A320 first officer’s rate of $241.75 an hour, times the 70-hour monthly minimum guarantee (840 hours a year), plus 4.5% profit sharing and the 18% company 401(k) contribution. The range runs from year 1 to a year-12 widebody first officer. Per diem is not included.',
      as_of: '2026年1月の時給・2025年分の利益配分', as_of_en: 'Pay rates from January 2026; profit sharing for 2025',
    } },
  },

  'american': {
    tax: '課税（米国）', tax_en: 'Taxed (United States)',
    src: [
      { pub: 'ALPA デルタ支部（Delta MEC）', pub_en: 'ALPA Delta MEC', name: 'pilot contract COMPARISON',
        as_of: '2026年1月1日の時給（2025年夏時点の資料）', as_of_en: 'Pay rates effective 1 January 2026', accessed: '2026-10-29',
        url: 'https://dal.alpa.org/Portals/1/ThemePluginPro/uploads/2025/9/2/DALContractComparison-2026.pdf' },
      { pub: 'aerocrewnews.com（協約案の写し）', pub_en: 'aerocrewnews.com (copy of the agreement)', name: 'American Airlines / APA 2023 Tentative Agreement — Full Pay Tables',
        as_of: '2026年5月2日の時給表', as_of_en: 'Pay table effective 2 May 2026', accessed: '2026-10-29', secondary: true,
        url: 'https://aerocrewnews.com/wp-content/uploads/2023/07/American-Airlines-TA.pdf' },
      { pub: 'Paddle Your Own Kanoo', pub_en: 'Paddle Your Own Kanoo', name: 'American Airlines Flight Attendants Furious Over 0.3% Profit-Sharing Bonus Amid Operational Meltdown',
        as_of: '2026-01-27 掲載', accessed: '2026-10-29', secondary: true,
        url: 'https://www.paddleyourownkanoo.com/2026/01/27/american-airlines-flight-attendants-furious-over-0-3-profit-sharing-bonus-amid-operational-meltdown/' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', est: {
      basis: 'パイロット組合 ALPA デルタ支部の「pilot contract COMPARISON」（2026年1月1日の時給・月の保証・会社の年金拠出）と、協約案（2023年）の時給表（第三者のサイトに置かれた写し）・利益配分の報道（2026年1月）',
      basis_en: 'ALPA Delta MEC, “pilot contract COMPARISON” (pay rates effective 1 January 2026, monthly guarantee and company 401(k) contribution), the 2023 tentative agreement’s pay tables (a copy hosted by a third-party site) and a news report on profit sharing (January 2026)',
      method: '12年目の機長（狭胴機・737/A320 系）の時給 $390.30 に、月の最低保証 77時間（年924時間）を掛け、利益配分 0.3% と会社の年金拠出 18% を足しています。幅の下は1年目です。上端は前の値のままです（最低保証の時間で出すと今より低くなるため）。日当は入れていません（家を離れている時間の資料が無いため）。',
      method_en: 'A year-12 narrowbody (737/A320 family) captain’s rate of $390.30 an hour, times the 77-hour monthly minimum (924 hours a year), plus 0.3% profit sharing and the 18% company 401(k) contribution. The bottom of the range is year 1; the top is unchanged (on the minimum it would come out below today’s figure). Per diem is not included (no source for time away from base).',
      as_of: '2026年1月の時給・2025年分の利益配分', as_of_en: 'Pay rates from January 2026; profit sharing for 2025',
    } },
    fo: { tier: 'estimate', est: {
      basis: '協約案（2023年）の2026年5月の時給表（第三者のサイトに置かれた写し）と、パイロット組合 ALPA デルタ支部の「pilot contract COMPARISON」・利益配分の報道',
      basis_en: 'The 2023 tentative agreement’s May 2026 pay table (a copy hosted by a third-party site), ALPA Delta MEC’s “pilot contract COMPARISON” and a news report on profit sharing',
      method: '6年目の副操縦士（狭胴機）の時給 $242.91 に年924時間を掛け、利益配分 0.3% と会社の年金拠出 18% を足しています。$242.91 は協約案の表の $238.12 に、表の12年目と組合資料の2026年1月の12年目の差と同じ 2.01% を掛けた額です。幅は、1年目から12年目の広胴機の副操縦士までです。日当は入れていません。',
      method_en: 'A year-6 narrowbody first officer’s rate of $242.91 an hour times 924 hours a year, plus 0.3% profit sharing and the 18% company 401(k) contribution. $242.91 is the agreement table’s $238.12 raised by the same 2.01% that separates the table’s year-12 rate from the union’s January 2026 year-12 rate. The range runs from year 1 to a year-12 widebody first officer. Per diem is not included.',
      as_of: '2026年の時給・2025年分の利益配分', as_of_en: 'Pay rates from 2026; profit sharing for 2025',
    } },
  },

  'southwest': {
    tax: '課税（米国）', tax_en: 'Taxed (United States)',
    src: [
      { pub: 'ALPA デルタ支部（Delta MEC）', pub_en: 'ALPA Delta MEC', name: 'pilot contract COMPARISON',
        as_of: '2026年1月1日の時給（2025年夏時点の資料）', as_of_en: 'Pay rates effective 1 January 2026', accessed: '2026-10-29',
        url: 'https://dal.alpa.org/Portals/1/ThemePluginPro/uploads/2025/9/2/DALContractComparison-2026.pdf' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', est: {
      basis: 'パイロット組合 ALPA デルタ支部の「pilot contract COMPARISON」（2026年1月1日の時給・月の保証・利益配分・会社の年金拠出）',
      basis_en: 'ALPA Delta MEC, “pilot contract COMPARISON” (pay rates effective 1 January 2026, monthly guarantee, profit sharing and company retirement contribution)',
      method: '12年目の機長（737）の時給 $394.27 に、保証の TFP を時間に直した年918時間を掛け、利益配分 1.10%（2024年分）と会社の年金拠出 20% を足しています。幅は前の値のままです（下は1年目の表が無く、上は最低保証の時間で出すと今より低くなるため）。日当は入れていません（家を離れている時間の資料が無いため）。',
      method_en: 'A year-12 737 captain’s rate of $394.27 an hour, times the guaranteed TFP converted to hours (918 hours a year), plus 1.10% profit sharing (for 2024) and the 20% company retirement contribution (401(k) and MBCBP). The range is unchanged (there is no year-1 table for the bottom, and the top would come out lower on the minimum guarantee). Per diem is not included (no source for time away from base).',
      as_of: '2026年1月の時給・2024年分の利益配分', as_of_en: 'Pay rates from January 2026; profit sharing for 2024',
    } },
    fo: { tier: 'estimate', est: {
      basis: 'パイロット組合 ALPA デルタ支部の「pilot contract COMPARISON」（幅の上端だけ。推定年収そのものの出どころの記録はありません）',
      basis_en: 'ALPA Delta MEC, “pilot contract COMPARISON” (for the top of the range only; there is no record of where the estimate itself came from)',
      method: '推定年収は前の値のままです（6年目の副操縦士の時給が、どの資料にも無いため）。幅の上端は、12年目の副操縦士の時給 $275.99 に年918時間を掛け、利益配分 1.10% と会社の年金拠出 20% を足した額です。',
      method_en: 'The estimate is unchanged (no source gives a year-6 first officer rate). The top of the range is a year-12 first officer’s rate of $275.99 an hour times 918 hours a year, plus 1.10% profit sharing and the 20% company retirement contribution.',
      as_of: '幅の上端は2026年1月の時給', as_of_en: 'Top of the range: pay rates from January 2026',
    } },
  },

  'alaska-airlines': {
    tax: '課税（米国）', tax_en: 'Taxed (United States)',
    src: [
      { pub: 'ALPA デルタ支部（Delta MEC）', pub_en: 'ALPA Delta MEC', name: 'pilot contract COMPARISON',
        as_of: '2026年1月1日の時給（2025年夏時点の資料）', as_of_en: 'Pay rates effective 1 January 2026', accessed: '2026-10-29',
        url: 'https://dal.alpa.org/Portals/1/ThemePluginPro/uploads/2025/9/2/DALContractComparison-2026.pdf' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', est: {
      basis: 'パイロット組合 ALPA デルタ支部の「pilot contract COMPARISON」（2026年1月1日の時給・月の保証・利益配分・会社の年金拠出）',
      basis_en: 'ALPA Delta MEC, “pilot contract COMPARISON” (pay rates effective 1 January 2026, monthly guarantee, profit sharing and company 401(k) contribution)',
      method: '12年目の機長（737）の時給 $375.74 に、月の最低保証 75時間（年900時間）を掛け、利益配分 11.48%（2024年分）と会社の年金拠出 17% を足しています。幅の上端も同じ額です。下は前の値のままです（1年目の表が無いため）。日当は入れていません（家を離れている時間の資料が無いため）。',
      method_en: 'A year-12 737 captain’s rate of $375.74 an hour, times the 75-hour monthly minimum guarantee (900 hours a year), plus 11.48% profit sharing (for 2024) and the 17% company 401(k) contribution. The top of the range is the same figure; the bottom is unchanged (there is no year-1 table). Per diem is not included (no source for time away from base).',
      as_of: '2026年1月の時給・2024年分の利益配分', as_of_en: 'Pay rates from January 2026; profit sharing for 2024',
    } },
    fo: { tier: 'estimate', est: {
      basis: 'パイロット組合 ALPA デルタ支部の「pilot contract COMPARISON」（幅の上端だけ。推定年収そのものの出どころの記録はありません）',
      basis_en: 'ALPA Delta MEC, “pilot contract COMPARISON” (for the top of the range only; there is no record of where the estimate itself came from)',
      method: '推定年収は前の値のままです（副操縦士の年次ごとの時給が公開されていないため）。幅の上端は、12年目の副操縦士の時給 $259.75 に年900時間を掛け、利益配分 11.48% と会社の年金拠出 17% を足した額です。',
      method_en: 'The estimate is unchanged (first officer rates by year are not published). The top of the range is a year-12 first officer’s rate of $259.75 an hour times 900 hours a year, plus 11.48% profit sharing and the 17% company 401(k) contribution.',
      as_of: '幅の上端は2026年1月の時給', as_of_en: 'Top of the range: pay rates from January 2026',
    } },
  },

  'jetblue': {
    tax: '課税（米国）', tax_en: 'Taxed (United States)',
    src: [
      { pub: 'ALPA デルタ支部（Delta MEC）', pub_en: 'ALPA Delta MEC', name: 'pilot contract COMPARISON',
        as_of: '2026年1月1日の時給（2025年夏時点の資料）', as_of_en: 'Pay rates effective 1 January 2026', accessed: '2026-10-29',
        url: 'https://dal.alpa.org/Portals/1/ThemePluginPro/uploads/2025/9/2/DALContractComparison-2026.pdf' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', est: {
      basis: 'パイロット組合 ALPA デルタ支部の「pilot contract COMPARISON」（2026年1月1日の時給・月の時間・会社の年金拠出）',
      basis_en: 'ALPA Delta MEC, “pilot contract COMPARISON” (pay rates effective 1 January 2026, monthly hours and company 401(k) contribution)',
      method: '12年目の機長（A321）の時給 $359.40 に、会社が組む月の目標 74〜86時間のまん中（年960時間）を掛け、会社の年金拠出 17% を足しています（この資料に2024年の利益配分の率はありません）。幅の上端も同じ額です。下は前の値のままです（1年目の表が無いため）。日当は入れていません（家を離れている時間の資料が無いため）。',
      method_en: 'A year-12 A321 captain’s rate of $359.40 an hour, times the middle of JetBlue’s 74–86 hour monthly bid target (960 hours a year), plus the 17% company 401(k) contribution (the source gives no 2024 profit-sharing rate). The top of the range is the same figure; the bottom is unchanged (there is no year-1 table). Per diem is not included (no source for time away from base).',
      as_of: '2026年1月の時給', as_of_en: 'Pay rates from January 2026',
    } },
    fo: { tier: 'estimate', est: {
      basis: 'パイロット組合 ALPA デルタ支部の「pilot contract COMPARISON」（幅の上端だけ。推定年収そのものの出どころの記録はありません）',
      basis_en: 'ALPA Delta MEC, “pilot contract COMPARISON” (for the top of the range only; there is no record of where the estimate itself came from)',
      method: '推定年収は前の値のままです（6年目の副操縦士の時給が、このサイトが使える資料に無いため）。幅の上端は、12年目の副操縦士の時給 $248.45 に年960時間を掛け、会社の年金拠出 17% を足した額です。',
      method_en: 'The estimate is unchanged (no source we can use gives a year-6 first officer rate). The top of the range is a year-12 first officer’s rate of $248.45 an hour times 960 hours a year, plus the 17% company 401(k) contribution.',
      as_of: '幅の上端は2026年1月の時給', as_of_en: 'Top of the range: pay rates from January 2026',
    } },
  },

  'air-canada': {
    tax: '課税（カナダ）', tax_en: 'Taxed (Canada)',
    src: [
      { pub: 'Flight Trainers', pub_en: 'Flight Trainers', name: 'Air Canada Pilot Salary',
        as_of: '2026-09-21 掲載', accessed: '2026-10-29', secondary: true,
        url: 'https://flighttrainers.ca/air-canada-pilot-salary/' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', est: {
      basis: 'Flight Trainers の記事「Air Canada Pilot Salary」（2026年9月21日。2026年9月30日からの時給表を載せた解説）',
      basis_en: 'Flight Trainers, “Air Canada Pilot Salary”, 21 September 2026 (an explainer carrying the pay rates effective 30 September 2026)',
      method: '12年目の機長（A320・737）の時給 C$337.33 に航法手当 C$17.09 を足し、年900時間の保証を掛けています。幅は、1年目の A220 の機長から12年目の 777 の機長までです。会社の年金・利益配分と日当は、額の資料が無いので入れていません。',
      method_en: 'A year-12 A320/737 captain’s rate of C$337.33 an hour plus C$17.09 nav pay, times the 900-hour annual guarantee. The range runs from a year-1 A220 captain to a year-12 777 captain. The company pension, profit sharing and per diem are not included (no source for the amounts).',
      as_of: '2026年9月30日からの時給', as_of_en: 'Pay rates effective 30 September 2026',
    } },
    fo: { tier: 'estimate', est: {
      basis: 'Flight Trainers の記事「Air Canada Pilot Salary」（2026年9月21日。2026年9月30日からの時給表を載せた解説）',
      basis_en: 'Flight Trainers, “Air Canada Pilot Salary”, 21 September 2026 (an explainer carrying the pay rates effective 30 September 2026)',
      method: '6年目の副操縦士（A320・737）の時給 C$182.62 に航法手当 C$8.55 を足し、年900時間の保証を掛けています。幅は、1年目から12年目の 777 の副操縦士までです。会社の年金・利益配分と日当は、額の資料が無いので入れていません。',
      method_en: 'A year-6 A320/737 first officer’s rate of C$182.62 an hour plus C$8.55 nav pay, times the 900-hour annual guarantee. The range runs from year 1 to a year-12 777 first officer. The company pension, profit sharing and per diem are not included (no source for the amounts).',
      as_of: '2026年9月30日からの時給', as_of_en: 'Pay rates effective 30 September 2026',
    } },
  },

  'qantas': {
    tax: '課税（オーストラリア）', tax_en: 'Taxed (Australia)',
    src: [
      { pub: 'オーストラリア公正労働委員会（Fair Work Commission）', pub_en: 'Fair Work Commission (Australia)', name: 'Qantas Airways Limited Pilots (Short Haul) Enterprise Agreement 2024 (AE528955)',
        as_of: '2026年9月1日からの年俸', as_of_en: 'Salaries from 1 September 2026', accessed: '2026-10-29',
        url: 'https://www.fwc.gov.au/documents/agreements/approved/ae528955.pdf' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', est: {
      basis: 'カンタス航空の短距離のパイロットの労働協約 AE528955（オーストラリアの公正労働委員会が承認・2026年9月1日からの年俸）',
      basis_en: 'Qantas Short Haul pilots’ enterprise agreement AE528955 (approved by the Fair Work Commission; salaries from 1 September 2026)',
      method: '短距離（737・A320）の機長の最上段 Year 6 の年俸 A$307,241 に、法律で決まった会社の年金拠出 12%（上限まで）を足しています。幅の下は Year 1 です。上端は前の値のままです（長距離の協約の表を開けていないため）。家を離れた時間ごとの手当は入れていません。',
      method_en: 'The top short-haul (737/A320) captain step, Year 6, at A$307,241 a year, plus the 12% superannuation guarantee (up to the cap). The bottom of the range is Year 1; the top is unchanged (we have not opened the long-haul agreement’s tables). Travel allowance for time away from base is not included.',
      as_of: '2026年9月1日からの年俸', as_of_en: 'Salaries from 1 September 2026',
    } },
    fo: { tier: 'estimate', est: {
      basis: 'カンタス航空の短距離のパイロットの労働協約 AE528955（オーストラリアの公正労働委員会が承認・2026年9月1日からの年俸）',
      basis_en: 'Qantas Short Haul pilots’ enterprise agreement AE528955 (approved by the Fair Work Commission; salaries from 1 September 2026)',
      method: '短距離の副操縦士の最上段 Year 5（副操縦士として4年を終えると上がる段で、6年目はここ）の年俸 A$197,833 に、法律で決まった会社の年金拠出 12% を足しています。幅の下は Year 1 です。上端は前の値のままです（長距離の協約の表を開けていないため）。家を離れた時間ごとの手当は入れていません。',
      method_en: 'The top short-haul first officer step, Year 5 (reached after four years in the seat, so a year-6 first officer sits here), at A$197,833 a year, plus the 12% superannuation guarantee. The bottom of the range is Year 1; the top is unchanged (we have not opened the long-haul agreement’s tables). Travel allowance for time away from base is not included.',
      as_of: '2026年9月1日からの年俸', as_of_en: 'Salaries from 1 September 2026',
    } },
  },

  'jetstar': {
    tax: '課税（オーストラリア）', tax_en: 'Taxed (Australia)',
    src: [
      { pub: 'オーストラリア公正労働委員会（Fair Work Commission）', pub_en: 'Fair Work Commission (Australia)', name: 'Jetstar Airways Pilots Enterprise Agreement 2026 (AE533389)',
        as_of: '2026年7月1日からの年俸', as_of_en: 'Salaries from 1 July 2026', accessed: '2026-10-29',
        url: 'https://www.fwc.gov.au/documents/agreements/approved/ae533389.pdf' },
      { pub: 'パイロット組合 AFAP', pub_en: 'AFAP (pilots’ union)', name: 'Jetstar EA 2025 Update #36 — Details of In-Principle agreement',
        as_of: '2026-03-31 掲載', accessed: '2026-10-29',
        url: 'https://8ce06ce48b.sdkhosting.net/pub/dw7a/z1swde28/kxg/lav/cbv/Details%20of%20In-Principle%20agreement.pdf' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', est: {
      basis: 'ジェットスター航空のパイロットの労働協約 AE533389（オーストラリアの公正労働委員会が承認・2026年7月1日からの年俸）と、パイロット組合 AFAP の説明資料（2026年3月31日）',
      basis_en: 'Jetstar pilots’ enterprise agreement AE533389 (approved by the Fair Work Commission; salaries from 1 July 2026) and the AFAP’s explanatory note (31 March 2026)',
      method: '狭胴機の機長の最上段（Level 3・4）の年俸 A$280,433 に、法律で決まった会社の年金拠出 12%（上限まで）と、日帰りの乗務の手当（1時間 A$8.39 × 年600時間。600時間は組合資料にある会社のデータ）を足しています。幅は Level 1 から広胴機の最上段までで、同じ手当を足しています。泊まりの手当は入れていません（時間の資料が無いため）。',
      method_en: 'The top narrowbody captain step (Level 3/4), A$280,433 a year, plus the 12% superannuation guarantee (up to the cap) and domestic travel allowance (A$8.39 an hour × 600 hours a year; the 600 hours are Jetstar data quoted by the AFAP). The range runs from Level 1 to the top widebody step, with the same allowance added. Overnight allowance is not included (no source for the hours).',
      as_of: '2026年7月1日からの年俸', as_of_en: 'Salaries from 1 July 2026',
    } },
    fo: { tier: 'estimate', est: {
      basis: 'ジェットスター航空のパイロットの労働協約 AE533389（オーストラリアの公正労働委員会が承認・2026年7月1日からの年俸）と、パイロット組合 AFAP の説明資料（2026年3月31日）',
      basis_en: 'Jetstar pilots’ enterprise agreement AE533389 (approved by the Fair Work Commission; salaries from 1 July 2026) and the AFAP’s explanatory note (31 March 2026)',
      method: '6年目の副操縦士（狭胴機の Level 3。協約では「4年を終えてから6年目まで」）の年俸 A$171,818 に、法律で決まった会社の年金拠出 12% と、日帰りの乗務の手当（1時間 A$8.39 × 年600時間）を足しています。幅は Level 1 から広胴機の最上段までです。泊まりの手当は入れていません。',
      method_en: 'A year-6 first officer (narrowbody Level 3, which the agreement gives from the end of year 4 through year 6) at A$171,818 a year, plus the 12% superannuation guarantee and domestic travel allowance (A$8.39 an hour × 600 hours a year). The range runs from Level 1 to the top widebody step. Overnight allowance is not included.',
      as_of: '2026年7月1日からの年俸', as_of_en: 'Salaries from 1 July 2026',
    } },
  },

  'iberia': {
    tax: '課税（スペイン）', tax_en: 'Taxed (Spain)',
    src: [
      { pub: 'スペイン官報（BOE）', pub_en: 'Boletín Oficial del Estado (BOE)', name: 'BOE-A-2026-14409 — tablas salariales 2025 del X Convenio colectivo de Iberia LAE y sus tripulantes pilotos',
        as_of: '2026-07-02 掲載', accessed: '2026-10-29',
        url: 'https://www.boe.es/boe/dias/2026/07/02/pdfs/BOE-A-2026-14409.pdf' },
      { pub: 'スペイン官報（BOE）', pub_en: 'Boletín Oficial del Estado (BOE)', name: 'BOE-A-2022-23017 — X Convenio colectivo de Iberia LAE y sus tripulantes pilotos',
        as_of: '2022-12-28 掲載', accessed: '2026-10-29',
        url: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2022-23017' },
      { pub: 'スペイン官報（BOE）', pub_en: 'Boletín Oficial del Estado (BOE)', name: 'BOE-A-2024-25500 — modificación del X Convenio (pilotos de Iberia)',
        as_of: '2024-12-06 掲載', accessed: '2026-10-29',
        url: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-25500' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', est: {
      basis: 'スペイン官報（BOE）に載ったイベリア航空のパイロットの労働協約（2022年）と、その改定（2024年）・2025年の給与表（2026年7月掲載）',
      basis_en: 'Iberia’s pilot collective agreement as published in Spain’s official gazette (BOE, 2022), its 2024 amendment and the 2025 pay tables (published July 2026)',
      method: '段4（勤続15〜16年ほど）・短中距離の機長の月額 €8,955 を年15回受け取る形にし、年1回の手当、利益配分（運航の目標に左右されない 2.71%）、会社の年金拠出を足しています。乗務は月70時間の保証で計算しています（＝下限）。幅の上端は、最上段・長距離の機長です。下は前の値のままです（保証の時間で出すと今より低くなるため）。日当は入れていません（日数の資料が無いため）。',
      method_en: 'A level-4 short/medium-haul captain (around 15–16 years of service) at €8,955 a month, paid 15 times a year, plus the yearly items, profit sharing (the 2.71% not tied to operational targets) and the company pension contributions, with flying worked out on the 70-hour monthly guarantee (a floor). The top of the range is a top-level long-haul captain; the bottom is unchanged (it would come out lower on the guarantee). Per diem is not included (no source for the number of days).',
      as_of: '2025年の給与表（2026年7月掲載）', as_of_en: '2025 pay tables (published July 2026)',
    } },
    fo: { tier: 'estimate', est: {
      basis: 'スペイン官報（BOE）に載ったイベリア航空のパイロットの労働協約（2022年）と、その改定（2024年）・2025年の給与表（2026年7月掲載）',
      basis_en: 'Iberia’s pilot collective agreement as published in Spain’s official gazette (BOE, 2022), its 2024 amendment and the 2025 pay tables (published July 2026)',
      method: '推定年収は前の値のままです。協約の表（段8・勤続加算2回 ＝ 6年目ごろ）を月70時間の保証で計算すると、今の値より低くなるためです（保証の時間で出した額では下げません）。幅の上端は、長距離の副操縦士の段3（年15回の月額に同じ手当・利益配分・年金を足した額）です。日当は入れていません（日数の資料が無いため）。',
      method_en: 'The estimate is unchanged: worked out from the agreement’s tables (level 8 with two seniority steps, around year 6) on the 70-hour monthly guarantee, it comes out below today’s figure, and we do not lower a figure on the guarantee alone. The top of the range is a level-3 long-haul first officer (15 monthly payments plus the same items, profit sharing and pension). Per diem is not included (no source for the number of days).',
      as_of: '2025年の給与表（2026年7月掲載）', as_of_en: '2025 pay tables (published July 2026)',
    } },
  },

  'tap': {
    tax: '課税（ポルトガル）', tax_en: 'Taxed (Portugal)',
    src: [
      { pub: 'ポルトガル労働公報（BTE）', pub_en: 'Boletim do Trabalho e Emprego (BTE)', name: 'BTE n.º 29/2023 — Acordo de empresa entre a TAP e o SPAC (revisão global)',
        as_of: '2023-08-08 掲載', accessed: '2026-10-29',
        url: 'https://bte.dgcp.mtsss.gov.pt/completos/2023/bte29_2023.pdf' },
      { pub: 'ポルトガル労働公報（BTE）', pub_en: 'Boletim do Trabalho e Emprego (BTE)', name: 'BTE n.º 16/2024 — Acordo de empresa TAP / SPAC (alteração)',
        as_of: '2024-04-29 掲載', accessed: '2026-10-29',
        url: 'https://bte.dgcp.mtsss.gov.pt/completos/2024/bte16_2024.pdf' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', est: {
      basis: 'ポルトガル労働公報（BTE）に載った TAP とパイロット組合 SPAC の労働協約（2023年）と、その一部改定（2024年）',
      basis_en: 'The TAP–SPAC pilot company agreement as published in Portugal’s labour bulletin (BTE, 2023) and its 2024 partial amendment',
      method: '在籍16年・機長6年（＋2024年の1年加算）の機長の月額を2026年の水準（2023年の表 × 1.0612）にして年14回受け取る形にし、協約が給与と書く乗務の日当の最低（1日 €270 × 月5日 × 11か月）と会社の年金拠出 6% を足しています。副操縦士の年数も職務の年数に数えています。幅は、機長になったばかりの人から、在籍31年・広胴機の機長までです。',
      method_en: 'A captain with 16 years at TAP and 6 years in command (plus the extra year granted in 2024), monthly pay brought to 2026 levels (2023 table × 1.0612) and paid 14 times a year, plus the minimum per diem the agreement treats as pay (€270 a day × 5 days a month × 11 months) and the 6% company pension contribution. Years as a first officer are counted toward years in function. The range runs from a newly upgraded captain to a widebody captain with 31 years at TAP.',
      as_of: '2023年の表を2026年の水準に直した額', as_of_en: '2023 tables brought to 2026 levels',
    } },
    fo: { tier: 'estimate', est: {
      basis: 'ポルトガル労働公報（BTE）に載った TAP とパイロット組合 SPAC の労働協約（2023年）と、その一部改定（2024年）',
      basis_en: 'The TAP–SPAC pilot company agreement as published in Portugal’s labour bulletin (BTE, 2023) and its 2024 partial amendment',
      method: '6年目の副操縦士（OP3・在籍7年）の月額を2026年の水準にして年14回受け取る形にし、協約が給与と書く乗務の日当の最低（1日 €202.50 × 月5日 × 11か月）と会社の年金拠出 6% を足しています。幅は、1年目（OP1）から在籍16年・広胴機の副操縦士までです。',
      method_en: 'A year-6 first officer (OP3, 7 years at TAP) with monthly pay brought to 2026 levels and paid 14 times a year, plus the minimum per diem the agreement treats as pay (€202.50 a day × 5 days a month × 11 months) and the 6% company pension contribution. The range runs from year 1 (OP1) to a widebody first officer with 16 years at TAP.',
      as_of: '2023年の表を2026年の水準に直した額', as_of_en: '2023 tables brought to 2026 levels',
    } },
  },
  /* ★2026-10-30（オーナー OK・Gemini の年収の調べ 2回目の続き）── 額は salary-data.mjs、出どころの記録は salary-sources.mjs。 */
  'royal-jordanian': {
    cur: 'USD',
    pay_tax: 'net',
    src: [
      { pub: '採用代理店 Brookfield Aviation（英国）が出した求人', pub_en: 'A vacancy posted by the recruitment agency Brookfield Aviation (UK)',
        name: 'A320 Captains – Royal Jordanian (Amman, Jordan)', name_en: 'A320 Captains – Royal Jordanian (Amman, Jordan)',
        as_of: '2026-02-09 掲載', as_of_en: 'Posted 9 February 2026', accessed: '2026-10-30',
        url: 'https://www.brookfieldav.com/jobs/a320-captains-%E2%80%93-royal-jordanian-(amman%2C-jordan)' },
      { pub: '採用代理店 Brookfield Aviation（英国）が出した求人', pub_en: 'A vacancy posted by the recruitment agency Brookfield Aviation (UK)',
        name: 'A320 First Officers Required – Royal Jordanian (Amman, Jordan)', name_en: 'A320 First Officers Required – Royal Jordanian (Amman, Jordan)',
        as_of: '2026-02-03 掲載', as_of_en: 'Posted 3 February 2026', accessed: '2026-10-30',
        url: 'https://www.brookfieldav.com/jobs/a320-first-officers-required-%E2%80%93-royal-jordanian-(amman%2C-jordan)' },
    ],
    notes: [
      '英国の採用代理店が出している求人の掲載額です。',
      '額は手取り（NET）で、Brookfield と結ぶ12か月（更新可）の契約です。宿泊（5つ星ホテル）・送迎・帰国の航空券・医療保険は現物で支給され、額は書かれていません。',
    ],
    notes_en: [
      'These are the amounts stated in postings by a recruitment agency in the UK.',
      'The amounts are take-home (net), on a 12-month renewable contract with Brookfield. Accommodation (a five-star hotel), transport, flights home and medical insurance are provided in kind, with no stated value.',
    ],
    cap: { tier: 'offer_posting',
      groups: [
        { name: '機長 A320（アンマン・Brookfield との12か月契約・手取り）', name_en: 'Captain, A320 (Amman, 12-month Brookfield contract, net)', month: 12300, months: 12 },
      ],
      card: 'estimate',
      est: {
        basis: '採用代理店 Brookfield Aviation（英国）が出したロイヤル・ヨルダンの A320 機長の求人（2026年2月）',
        basis_en: 'A posting by the recruitment agency Brookfield Aviation (UK) for A320 captains at Royal Jordanian (February 2026)',
        method: '求人の「月 US$12,300（手取り）」を、12か月の契約の月数で年額にしています。Brookfield と結ぶ外国人パイロット向けの契約の一律の額で、ロイヤル・ヨルダンの社員の給与表ではありません。手取りの額なので、税引き前ならこれより大きくなります。現物の宿泊・送迎・航空券・医療保険は入れていません。幅の下は前の値のままです。',
        method_en: 'The posting’s “USD 12,300 net per month” is turned into a yearly figure over the 12 months of the contract. It is a single rate for foreign pilots on a contract with Brookfield, not Royal Jordanian’s own staff pay scale. As it is a take-home figure, the pre-tax amount would be higher. Accommodation, transport, flights home and medical insurance provided in kind are not included. The bottom of the range is unchanged.',
        as_of: '2026年2月', as_of_en: 'February 2026',
      } },
    fo: { tier: 'offer_posting',
      groups: [
        { name: '副操縦士 A320（アンマン・Brookfield との12か月契約・手取り）', name_en: 'First officer, A320 (Amman, 12-month Brookfield contract, net)', month: 8500, months: 12 },
      ],
      card: 'estimate',
      est: {
        basis: '採用代理店 Brookfield Aviation（英国）が出したロイヤル・ヨルダンの A320 副操縦士の求人（2026年2月）',
        basis_en: 'A posting by the recruitment agency Brookfield Aviation (UK) for A320 first officers at Royal Jordanian (February 2026)',
        method: '求人の「月 US$8,500（手取り）」を、12か月の契約の月数で年額にしています。総飛行 1,500時間（うち A320 の副操縦士 500時間）以上の人に一律の額で、6年目の額ではありません。手取りの額なので、税引き前ならこれより大きくなります。現物の宿泊・送迎・航空券・医療保険は入れていません。幅の下は前の値のままです。',
        method_en: 'The posting’s “USD 8,500 net per month” is turned into a yearly figure over the 12 months of the contract. It is a single rate for anyone with 1,500 flight hours, including 500 hours as an A320 first officer, not a year-6 figure. As it is a take-home figure, the pre-tax amount would be higher. Accommodation, transport, flights home and medical insurance provided in kind are not included. The bottom of the range is unchanged.',
        as_of: '2026年2月', as_of_en: 'February 2026',
      } },
  },
  'aer-lingus': {
    tax: '課税（アイルランド）', tax_en: 'Taxed (Ireland)',
    src: [
      { pub: 'The Irish Times', pub_en: 'The Irish Times', name: 'Aer Lingus pilot pay row heading for Labour Court', name_en: 'Aer Lingus pilot pay row heading for Labour Court',
        as_of: '2024-02-21 掲載', as_of_en: 'Published 21 February 2024', accessed: '2026-10-30', secondary: true,
        url: 'https://www.irishtimes.com/business/2024/02/21/aer-lingus-pilot-pay-row-heading-for-labour-court/' },
      { pub: 'The Standard（PA 通信）', pub_en: 'The Standard (PA)', name: 'Aer Lingus pilots’ industrial action', name_en: 'Aer Lingus pilots’ industrial action',
        as_of: '2024-06-21 掲載', as_of_en: 'Published 21 June 2024', accessed: '2026-10-30', secondary: true,
        url: 'https://www.standard.co.uk/news/uk/aer-lingus-government-ireland-b1165905.html' },
      { pub: 'RTÉ', pub_en: 'RTÉ', name: 'Aer Lingus accepts Labour Court recommendation on pay', name_en: 'Aer Lingus accepts Labour Court recommendation on pay',
        as_of: '2024-07-08 掲載', as_of_en: 'Published 8 July 2024', accessed: '2026-10-30', secondary: true,
        url: 'https://www.rte.ie/news/business/2024/0708/1458716-aer-lingus-ialpa/' },
      { pub: 'Irish Examiner', pub_en: 'Irish Examiner', name: 'Aer Lingus pilots vote to accept 17.75% pay rise', name_en: 'Aer Lingus pilots vote to accept 17.75% pay rise',
        as_of: '2024-07-23 掲載', as_of_en: 'Published 23 July 2024', accessed: '2026-10-30', secondary: true,
        url: 'https://www.irishexaminer.com/news/arid-41442025.html' },
      /* g4 src */
      { pub: 'Ready For Take-Off Book', pub_en: 'Ready For Take-Off Book', name: 'Aer Lingus | Pilot Careers, Pay, Roster, Fleet & Benefits', name_en: 'Aer Lingus | Pilot Careers, Pay, Roster, Fleet & Benefits',
        as_of: '2026-03-07 掲載', as_of_en: 'Published 7 March 2026', accessed: '2026-10-30', secondary: true,
        url: 'https://readyfortakeoffbook.com/blogs/pilot-conditions/aer-lingus' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', est: {
      basis: 'アイルランド紙 The Irish Times の記事（2024年2月）と、2024年7月に会社と組合員が受け入れた労働裁判所の昇給の勧告（RTÉ・Irish Examiner の報道）',
      basis_en: 'An article in The Irish Times (February 2024) and the Labour Court pay award accepted by the airline and by the pilots in July 2024 (reported by RTÉ and the Irish Examiner)',
      method: '記事の「勤続20年の機長は年 23万9,000ユーロ」に、その後の昇給（2023年1月〜2026年7月の8回で計17.75%）を掛けています。勧告は前の給与表を1本の表に作り直すとも書いているため、近い値です。幅の上は PA 通信（2024年6月）の「最上段の待遇は年金などの価値を含めて約28万7,000ユーロ」に同じ率を掛けた額です。会社の年金拠出と日当は、資料で確かめられず入れていません。幅の下は前の値のままです。',
      method_en: 'Set at the article’s “captains who reach year 20 can earn €239,000”, raised by the later pay award (17.75% in eight steps from January 2023 to July 2026). The award also replaced the previous pay scales with a single scale, so this is an approximation. The top of the range is PA’s “top pay package of around €287,000, including the value of pensions and other benefits” (June 2024), raised by the same rate. The company pension contribution and per diem could not be confirmed from the sources and are not included. The bottom of the range is unchanged.',
      as_of: '2024年2月（昇給は2026年7月まで）', as_of_en: 'February 2024 (pay rises through July 2026)',
    } },
    fo: { /* g4 fo */ est: {
        basis: 'Ready For Take-Off Book のエア・リンガスのページ（2026年3月）と、The Irish Times の記事（2024年2月）・2024年7月に会社と組合員が受け入れた労働裁判所の昇給の勧告（RTÉ の報道）',
        basis_en: 'Ready For Take-Off Book’s Aer Lingus page (March 2026), an article in The Irish Times (February 2024) and the Labour Court pay award accepted by the airline and the pilots in July 2024 (reported by RTÉ)',
        method: '副操縦士の表の「3〜5年目 年 約 €95,000〜120,000」（基本給・乗務手当・通常の手当を含む税引き前の見込み）の真ん中 €107,500 を、6年目の額として使っています（次の段は「7〜10年目」）。幅の上は The Irish Times の「副操縦士は最大 €121,519」に、機長と同じ昇給 17.75% を掛けた額です。会社の年金拠出と日当は足していません。幅の下は前の値のままです。',
        method_en: 'Set at the midpoint, €107,500, of the first officer table’s “Year 3-5 €95,000 - €120,000” (annual gross estimates including base salary, flight pay and standard allowances), used as the year-6 figure (the next step is “Year 7-10”). The top of the range is The Irish Times’ “Aer Lingus co-pilots could earn up to €121,519”, raised by the same 17.75% pay award as for captains. The company pension contribution and per diems are not added. The bottom of the range is unchanged.',
        as_of: '2026年3月', as_of_en: 'March 2026',
      }, tier: 'estimate' },
  },
  'finnair': {
    tax: '課税（フィンランド）', tax_en: 'Taxed (Finland)',
    src: [
      { pub: 'Suomenmaa（STT 通信の記事）', pub_en: 'Suomenmaa (STT news agency report)', name: 'Palta: Tällaisia summia Finnairin lentäjät tienaavat', name_en: 'Palta: this is what Finnair pilots earn',
        as_of: '2024-12-18 掲載', as_of_en: 'Published 18 December 2024', accessed: '2026-10-30', secondary: true,
        url: 'https://www.suomenmaa.fi/uutiset/palta-tallaisia-summia-finnairin-lentajat-tienaavat-tyonantajapuoli-pitaa-vaatimuksia-kohtuuttomina/' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', est: {
      basis: 'フィンエアー側の雇用者団体 Palta が、2024年12月の協約交渉の中で公表した額（STT 通信の報道）',
      basis_en: 'Figures published by Palta, the employers’ association on Finnair’s side, during the December 2024 pay talks (reported by the STT news agency)',
      method: 'Palta の「機長の平均は年 20万ユーロ強」に置いています。手当を含み、乗務の日当は含みません。機長全体の平均で、最上段の額ではありません。幅の上は同じ記事の「機長に払われた最大は年 約34万ユーロ」です。会社の上乗せの年金とその後の昇給は入れていません。幅の下は前の値のままです。',
      method_en: 'Set at Palta’s “the average captain earns a little over €200,000 a year”. It includes allowances but not per diem. It is the average across all captains, not the top of the scale. The top of the range is the same article’s “the most paid to a captain is about €340,000 a year”. Any extra company pension and later pay rises are not included. The bottom of the range is unchanged.',
      as_of: '2024年12月', as_of_en: 'December 2024',
    } },
    fo: { tier: 'estimate', est: {
      basis: 'フィンエアー側の雇用者団体 Palta が、2024年12月の協約交渉の中で公表した額（STT 通信の報道）',
      basis_en: 'Figures published by Palta, the employers’ association on Finnair’s side, during the December 2024 pay talks (reported by the STT news agency)',
      method: 'Palta の「副操縦士の平均は年 10万ユーロ弱」に置いています（10万ユーロを超えないよう切り下げ）。手当を含み、日当は含みません。副操縦士全体の平均で、6年目の額ではありません。幅は前の値のままです。',
      method_en: 'Set at Palta’s “the average first officer earns just under €100,000 a year” (rounded down so as not to exceed €100,000). It includes allowances but not per diem. It is the average across all first officers, not a year-6 figure. The range is unchanged.',
      as_of: '2024年12月', as_of_en: 'December 2024',
    } },
  },
  'wizz-air': {
    tax: '課税（英国）', tax_en: 'Taxed (United Kingdom)',
    pay_tax: 'unknown',
    src: [
      { pub: 'Irish Examiner（ウィズ・エアーの発表の報道）', pub_en: 'Irish Examiner (report of a Wizz Air announcement)', name: 'Wizz Air offers free pilot training as it announces recruitment drive in Ireland', name_en: 'Wizz Air offers free pilot training as it announces recruitment drive in Ireland',
        as_of: '2025-10-15 掲載', as_of_en: 'Published 15 October 2025', accessed: '2026-10-30', secondary: true,
        url: 'https://www.irishexaminer.com/business/companies/arid-41724570.html' },
      { pub: '採用代理店 FCI が出した求人', pub_en: 'A vacancy posted by the recruitment agency FCI', name: 'A320 TR / NTR First Officers – UK Nationals – Wizz Air', name_en: 'A320 TR / NTR First Officers – UK Nationals – Wizz Air',
        as_of: 'ページに日付の記載なし', as_of_en: 'No date given on the page', accessed: '2026-10-30',
        url: 'https://fci.aero/jobs/a320-tr-ntr-first-officers-uk-nationals-wizz-air-immediate-assessments-373113/' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', est: {
      basis: 'ウィズ・エアーが2025年10月の訓練生の募集で示した額（Irish Examiner の報道）',
      basis_en: 'Figures Wizz Air gave when announcing its cadet recruitment in October 2025 (reported by the Irish Examiner)',
      method: '会社の「機長に昇格すると年 最大20万ポンド」を、最上段の額として置いています。給与表の段の額ではなく、税引き前か手取りかは書かれていません。3年勤めた機長への引き留めの賞与（一部の基地・1回だけ）と年金は入れていません。幅の下は前の値のままです。',
      method_en: 'Set at the company’s “up to £200,000 a year on promotion to captain”, used as the top-of-scale figure. It is not a step on a pay scale, and it is not stated whether it is before or after tax. The retention bonus for captains after three years (some bases, paid once) and the pension are not included. The bottom of the range is unchanged.',
      as_of: '2025年10月', as_of_en: 'October 2025',
    } },
    fo: { tier: 'estimate', est: {
      basis: '同じ発表（Irish Examiner の報道）と、採用代理店 FCI の英国の副操縦士の求人',
      basis_en: 'The same announcement (reported by the Irish Examiner) and a UK first officer posting by the recruitment agency FCI',
      method: '会社の「副操縦士の資格を取って2年後に年 9万ポンド」に置いています。FCI の求人にも「年の手取りの見込み 9万ポンド」とあります。6年目ではなく2年後の額です（低めの見積もり）。ランダム勤務を選んだ人の上乗せ（月 最大800ポンド）・引き留めの賞与・年金は入れていません。幅の下は前の値のままです。',
      method_en: 'Set at the company’s “£90,000 a year two years after qualifying as a first officer”. The FCI posting also states an “expected annual take-home salary of £90,000”. It is a two-year figure, not year 6 (a conservative estimate). The extra pay for choosing a random roster (up to £800 a month), the retention bonus and the pension are not included. The bottom of the range is unchanged.',
      as_of: '2025年10月', as_of_en: 'October 2025',
    } },
  },
  /* ★2026-10-30（オーナー：はじいた資料も使う・上がるときだけ）── 額は salary-data.mjs、出どころの記録は salary-sources.mjs。 */
  'turkish-airlines': {
    tax: '課税（トルコ）', tax_en: 'Taxed (Turkey)',
    src: [
      /* g4 src */
      { pub: 'Ready For Take-Off Book', pub_en: 'Ready For Take-Off Book', name: 'Turkish Airlines | Pilot Pay, Rosters and Career Outlook', name_en: 'Turkish Airlines | Pilot Pay, Rosters and Career Outlook',
        as_of: '2026-03-21 掲載', as_of_en: 'Published 21 March 2026', accessed: '2026-10-29', secondary: true,
        url: 'https://readyfortakeoffbook.com/blogs/pilot-conditions/turkish-airlines' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', /* g4 cap */ est: {
      basis: 'Ready For Take-Off Book のトルコ航空のページ（2026年3月）',
      basis_en: 'Ready For Take-Off Book’s Turkish Airlines page (March 2026)',
      method: '機長の表の「狭胴機の機長 月 ₺580,000〜620,000」と「広胴機の機長 月 ₺620,000〜660,000」の上の端どうしの真ん中 ₺640,000 を12倍しています。表は月70時間の乗務を前提にした税引き前の月額です。四半期ごとの賞与と日当は足していません。幅は前の値のままです。',
      method_en: 'Set at ₺640,000 a month × 12: the midpoint of the tops of two steps in the captain table, “Captain (Narrowbody) ₺580,000 - ₺620,000” and “Captain (Widebody) ₺620,000 - ₺660,000”. The table gives gross monthly pay based on 70 hours a month. Quarterly bonuses and per diems are not added. The range is unchanged.',
      as_of: '2026年3月', as_of_en: 'March 2026',
    } },
    fo: { tier: 'estimate', /* g4 fo */ est: {
      basis: 'Ready For Take-Off Book のトルコ航空のページ（2026年3月）',
      basis_en: 'Ready For Take-Off Book’s Turkish Airlines page (March 2026)',
      method: '副操縦士の表の「3〜5年目（狭胴機）月 ₺340,000〜400,000」の上の端 ₺400,000 を6年目の額として12倍しています（次の段「広胴機の上級副操縦士」の下の端と同じ額）。表は月70時間の乗務を前提にした税引き前の月額です。70時間を超えた分の割増・四半期ごとの賞与・日当は足していません。幅は前の値のままです。',
      method_en: 'Set at ₺400,000 a month × 12, used as the year-6 figure: the top of “F/O 3-5 years (Narrowbody) ₺340,000 - ₺400,000”, which is also the bottom of the next step, “Senior F/O (Widebody)”. The table gives gross monthly pay based on 70 flight hours a month. Overtime above 70 hours, quarterly bonuses and per diems are not added. The range is unchanged.',
      as_of: '2026年3月', as_of_en: 'March 2026',
    } },
  },
  /* ★2026-10-30（オーナー：はじいた資料も使う・上がるときだけ）── 額は salary-data.mjs、出どころの記録は salary-sources.mjs。 */
  'air-france': {
    tax: '課税（フランス）', tax_en: 'Taxed (France)',
    src: [
      /* g4 src */
      { pub: 'Ready For Take-Off Book', pub_en: 'Ready For Take-Off Book', name: 'Air France | Pilot Salaries, Roster, Fleet and Career Guide', name_en: 'Air France | Pilot Salaries, Roster, Fleet and Career Guide',
        as_of: '2026-04-13 掲載', as_of_en: 'Published 13 April 2026', accessed: '2026-10-29', secondary: true,
        url: 'https://readyfortakeoffbook.com/blogs/pilot-conditions/air-france' },
      { pub: 'フランス会計検査院（Cour des comptes）', pub_en: 'Cour des comptes (France’s national audit office)', name: 'La caisse de retraite du personnel navigant professionnel de l\'aéronautique civile (CRPN)', name_en: 'La caisse de retraite du personnel navigant professionnel de l\'aéronautique civile (CRPN)',
        as_of: '2025-12-10 公表', as_of_en: 'Published 10 December 2025', accessed: '2026-10-29', secondary: true,
        url: 'https://www.ccomptes.fr/sites/default/files/2025-12/20251210-S2025-1632-Caisse-de-retraite-du-personnel-navigant-de-l-aviation-civile.pdf' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', /* g4 cap */ est: {
      basis: 'Ready For Take-Off Book のエールフランスのページ（2026年4月）と、フランス会計検査院の報告書「乗員の退職年金基金（CRPN）」（2025年12月）',
      basis_en: 'Ready For Take-Off Book’s Air France page (April 2026) and the Cour des comptes report on the aircrew pension fund, CRPN (December 2025)',
      method: '表の「長距離（777／A350）の上級機長 年 約 €220,000〜260,000」の真ん中 €240,000 に、会社が乗員の退職年金基金（CRPN）に払う拠出（2025年の率：給与の 15.13%＋0.05%、年 €47,100 までの分に 0.54%＋0.39%）を足しています。表の年額は基本給・乗務手当・通常の手当を含む税引き前の額です。短距離の機長の最上段は表に無く、長距離だけで出しています。13か月目の支給・利益配分・日当は足していません。幅は前の値のままです。',
      method_en: 'Set at the midpoint, €240,000, of the table’s “Senior CDB (777/A350 long-haul) ~€220,000 - €260,000+” a year, plus the employer’s contribution to the aircrew pension fund (CRPN) at the 2025 rates: 15.13% + 0.05% of salary, and 0.54% + 0.39% on pay up to €47,100 a year. The table’s annual figures are gross and include base salary, flight pay and standard allowances. The table has no top step for short-haul captains, so only long-haul is used. A 13th-month payment, profit-sharing and per diems are not added. The range is unchanged.',
      as_of: '2026年4月（年金の拠出率は2025年）', as_of_en: 'April 2026 (pension contribution rates for 2025)',
    } },
    fo: { tier: 'estimate', /* g4 fo */ est: {
      basis: 'Ready For Take-Off Book のエールフランスのページ（2026年4月）と、フランス会計検査院の報告書「乗員の退職年金基金（CRPN）」（2025年12月）',
      basis_en: 'Ready For Take-Off Book’s Air France page (April 2026) and the Cour des comptes report on the aircrew pension fund, CRPN (December 2025)',
      method: '6年目は表の「3〜5年目 年 約 €85,000〜100,000」と「7〜10年目 年 約 €105,000〜125,000」のあいだで、€100,000 と €105,000 の真ん中 €102,500 に、機長と同じ会社の年金拠出（CRPN・2025年の率）を足しています。表の年額は基本給・乗務手当・通常の手当を含む税引き前の額です。13か月目の支給・利益配分・日当は足していません。幅の上は「10年以上の副操縦士 年 約 €125,000〜150,000」の上の端に同じ拠出を足した額です。幅の下は前の値のままです。',
      method_en: 'Year 6 falls between “Year 3-5 ~€85,000 - €100,000” and “Year 7-10 ~€105,000 - €125,000” a year, so it is set at the midpoint of €100,000 and €105,000 (€102,500), plus the same employer pension contribution (CRPN, 2025 rates) as for captains. The annual figures are gross and include base salary, flight pay and standard allowances. A 13th-month payment, profit-sharing and per diems are not added. The top of the range is the upper end of “Senior F/O (10+ yrs) ~€125,000 - €150,000” plus the same contribution. The bottom of the range is unchanged.',
      as_of: '2026年4月（年金の拠出率は2025年）', as_of_en: 'April 2026 (pension contribution rates for 2025)',
    } },
  },
  /* ★2026-10-30（オーナー：はじいた資料も使う・上がるときだけ）── 額は salary-data.mjs、出どころの記録は salary-sources.mjs。 */
  'asiana': {
    tax: '課税（韓国）', tax_en: 'Taxed (South Korea)',
    src: [
      /* g4 src */
      { pub: 'ExitBasic', pub_en: 'ExitBasic', name: '항공기 조종사 파일럿 분석 : 연봉, 급여, 초봉, 취업, 전망, 진로', name_en: 'Airline pilot analysis: salary, pay, starting pay, hiring, outlook, career path',
        as_of: '2025-03-19 掲載', as_of_en: 'Published 19 March 2025', accessed: '2026-10-29', secondary: true,
        url: 'https://blog.exitbasic.com/pilot/' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', /* g4 cap */ est: {
      basis: 'ExitBasic の記事「항공기 조종사 파일럿 분석」の表「国内の主な航空会社のパイロットの年収（2025年基準・税引き前）」（2025年3月）',
      basis_en: 'The table of pilot pay at major Korean airlines (2025, before tax) in the ExitBasic article “항공기 조종사 파일럿 분석” (March 2025)',
      method: '表のアシアナ航空の「機長（10年目以上）1億3,000万〜2億8,000万ウォン」の真ん中 2億500万ウォンを使っています。表は税引き前の額です。幅の上は2億8,000万ウォンです。幅の下は前の値のままです。',
      method_en: 'Set at the midpoint, KRW 205 million, of Asiana’s “captain (10+ years) KRW 130 million – 280 million” in the table. The figures are before tax. The top of the range is KRW 280 million. The bottom of the range is unchanged.',
      as_of: '2025年', as_of_en: '2025',
    } },
    fo: { tier: 'estimate' },
  },
  /* ★2026-10-30（オーナー：はじいた資料も使う・上がるときだけ）── 額は salary-data.mjs、出どころの記録は salary-sources.mjs。 */
  'aegean': {
    tax: '課税（ギリシャ）', tax_en: 'Taxed (Greece)',
    src: [
      /* g4 src */
      { pub: 'Ready For Take-Off Book', pub_en: 'Ready For Take-Off Book', name: 'Aegean Airlines | Pilot Careers, Pay, Fleet & Roster', name_en: 'Aegean Airlines | Pilot Careers, Pay, Fleet & Roster',
        as_of: '2026-04-15 掲載', as_of_en: 'Published 15 April 2026', accessed: '2026-10-30', secondary: true,
        url: 'https://readyfortakeoffbook.com/blogs/pilot-conditions/aegean-airlines' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', /* g4 cap */ est: {
      basis: 'Ready For Take-Off Book のエーゲ航空のページ「Aegean Airlines | Pilot Careers, Pay, Fleet & Roster」（2026年4月）',
      basis_en: 'Ready For Take-Off Book’s Aegean Airlines page, “Aegean Airlines | Pilot Careers, Pay, Fleet & Roster” (April 2026)',
      method: '機長の表の「9年目以上 年 約 €57,000〜78,000」（基本給だけ）の真ん中 €67,500 に、同じページの「年の日当 約 €3,500（税引き前）」を足しています。1区間あたりの手当・距離の手当・10年以上の機長の賞与は足していません。幅は前の値のままです。',
      method_en: 'Set at the midpoint, €67,500, of the captain table’s “Year 9+ ~€57,000 – €78,000” a year (base salary only), plus the page’s “yearly per diem payments estimated at around €3,500 gross”. Per-sector pay, the per-kilometre allowance and the bonus for captains with 10+ years are not added. The range is unchanged.',
      as_of: '2026年4月', as_of_en: 'April 2026',
    } },
    fo: { tier: 'estimate', /* g4 fo */ est: {
      basis: 'Ready For Take-Off Book のエーゲ航空のページ「Aegean Airlines | Pilot Careers, Pay, Fleet & Roster」（2026年4月）',
      basis_en: 'Ready For Take-Off Book’s Aegean Airlines page, “Aegean Airlines | Pilot Careers, Pay, Fleet & Roster” (April 2026)',
      method: '副操縦士の表の「4年目以上 年 約 €31,200〜38,000」（基本給だけ・表のいちばん上の段）の真ん中 €34,600 に、年の日当 約 €3,500 を足しています。1区間あたりの手当と距離の手当は足していません。幅は前の値のままです。',
      method_en: 'Set at the midpoint, €34,600, of the first officer table’s “Year 4+ ~€31,200 – €38,000” a year (base salary only, the top step of the table), plus yearly per diems of around €3,500. Per-sector pay and the per-kilometre allowance are not added. The range is unchanged.',
      as_of: '2026年4月', as_of_en: 'April 2026',
    } },
  },
  /* ★2026-10-30（オーナー：はじいた資料も使う・上がるときだけ）── 額は salary-data.mjs、出どころの記録は salary-sources.mjs。 */
  'icelandair': {
    tax: '課税（アイスランド）', tax_en: 'Taxed (Iceland)',
    src: [
      /* g4 src */
      { pub: 'Ready For Take-Off Book', pub_en: 'Ready For Take-Off Book', name: 'Icelandair | Pilot Careers, Pay, Fleet & Life at Keflavík', name_en: 'Icelandair | Pilot Careers, Pay, Fleet & Life at Keflavík',
        as_of: '2026-05-17 掲載', as_of_en: 'Published 17 May 2026', accessed: '2026-10-30', secondary: true,
        url: 'https://readyfortakeoffbook.com/blogs/pilot-conditions/icelandair' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', /* g4 cap */ est: {
      basis: 'Ready For Take-Off Book のアイスランド航空のページ「Icelandair | Pilot Careers, Pay, Fleet & Life at Keflavík」（2026年5月）',
      basis_en: 'Ready For Take-Off Book’s Icelandair page, “Icelandair | Pilot Careers, Pay, Fleet & Life at Keflavík” (May 2026)',
      method: '機長の表の年額の見込み（税引き前）の「757／A321LR の5年目の機長 約 ISK 18〜20M」と「767 のベテラン機長（20年以上）約 ISK 21〜24M」の真ん中どうしの真ん中 ISK 20,750,000 を使っています。狭胴機のベテランの段は表にありません。利益配分は足していません。幅の上は ISK 24,000,000 です。幅の下は前の値のままです。',
      method_en: 'Set at ISK 20,750,000, the midpoint between the middles of two steps in the captain table’s annual gross estimates: “Captain, 5 yrs (757/A321LR) ~ISK 18-20M” and “Senior Captain (767 / 20+ yrs) ~ISK 21-24M”. The table has no senior narrowbody step. Profit-sharing is not added. The top of the range is ISK 24,000,000. The bottom of the range is unchanged.',
      as_of: '2026年5月', as_of_en: 'May 2026',
    } },
    fo: { tier: 'estimate', /* g4 fo */ est: {
      basis: 'Ready For Take-Off Book のアイスランド航空のページ「Icelandair | Pilot Careers, Pay, Fleet & Life at Keflavík」（2026年5月）',
      basis_en: 'Ready For Take-Off Book’s Icelandair page, “Icelandair | Pilot Careers, Pay, Fleet & Life at Keflavík” (May 2026)',
      method: '副操縦士の表の「3〜5年目 年 約 ISK 11〜13M」（基本給・通常の手当・日当を含む税引き前の見込み）の真ん中 ISK 12,000,000 を、6年目の額として使っています（次の段は「7〜10年目」）。幅の上は「15年以上の副操縦士 約 ISK 15〜17M」の上の端 ISK 17,000,000 です。幅の下は前の値のままです。',
      method_en: 'Set at the midpoint, ISK 12,000,000, of the first officer table’s “Year 3 - 5 ~ISK 11-13M” (annual gross estimates including base salary plus typical allowances and per diems), used as the year-6 figure (the next step is “Year 7 - 10”). The top of the range is the upper end of “Senior FO (15+ yrs) ~ISK 15-17M”, ISK 17,000,000. The bottom of the range is unchanged.',
      as_of: '2026年5月', as_of_en: 'May 2026',
    } },
  },
  /* ★2026-10-30（オーナー：はじいた資料も使う・上がるときだけ）── 額は salary-data.mjs、出どころの記録は salary-sources.mjs。 */
  'lot': {
    tax: '課税（ポーランド）', tax_en: 'Taxed (Poland)',
    src: [
      /* g4 src */
      { pub: 'Ready For Take-Off Book', pub_en: 'Ready For Take-Off Book', name: 'LOT Polish Airlines | Pilot Conditions, Pay & Careers', name_en: 'LOT Polish Airlines | Pilot Conditions, Pay & Careers',
        as_of: '2026-03-29 掲載', as_of_en: 'Published 29 March 2026', accessed: '2026-10-30', secondary: true,
        url: 'https://readyfortakeoffbook.com/blogs/pilot-conditions/lot-polish-airlines' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', /* g4 cap */ est: {
      basis: 'Ready For Take-Off Book の LOT ポーランド航空のページ「LOT Polish Airlines | Pilot Conditions, Pay & Careers」（2026年3月）',
      basis_en: 'Ready For Take-Off Book’s LOT Polish Airlines page, “LOT Polish Airlines | Pilot Conditions, Pay & Careers” (March 2026)',
      method: '機長の表の年額の見込み（変動給をすべて含む）の「B737 の機長（機長になったばかり）約 PLN 290,000〜360,000」と「B787 のベテラン機長（10,000時間以上）約 PLN 600,000〜710,000」の真ん中どうしの真ん中 PLN 490,000 を使っています。B737 のベテランの段は表にありません。幅の上は PLN 710,000 です。幅の下は前の値のままです。',
      method_en: 'Set at PLN 490,000, the midpoint between the middles of “Captain, B737 (entry command) ~PLN 290,000 - 360,000” and “Senior Captain, B787 (10,000+ hrs) ~PLN 600,000 - 710,000” in the captain table’s annual gross estimates, which the page says include all variable components. The table has no senior B737 step. The top of the range is PLN 710,000. The bottom of the range is unchanged.',
      as_of: '2026年3月', as_of_en: 'March 2026',
    } },
    fo: { tier: 'estimate', /* g4 fo */ est: {
      basis: 'Ready For Take-Off Book の LOT ポーランド航空のページ「LOT Polish Airlines | Pilot Conditions, Pay & Careers」（2026年3月）',
      basis_en: 'Ready For Take-Off Book’s LOT Polish Airlines page, “LOT Polish Airlines | Pilot Conditions, Pay & Careers” (March 2026)',
      method: '副操縦士の表の年額の見込みの「B737 の副操縦士（2〜4年目）約 PLN 170,000〜220,000」と「B787 の上級副操縦士（5年以上）約 PLN 220,000〜265,000」の真ん中どうしの真ん中 PLN 218,750 を使っています。幅の上は PLN 265,000 です。幅の下は前の値のままです。',
      method_en: 'Set at PLN 218,750, the midpoint between the middles of “F/O, B737 (Year 2-4) ~PLN 170,000 - 220,000” and “Senior F/O, B787 (5+ yrs) ~PLN 220,000 - 265,000” in the first officer table’s annual gross estimates. The top of the range is PLN 265,000. The bottom of the range is unchanged.',
      as_of: '2026年3月', as_of_en: 'March 2026',
    } },
  },
  /* ★2026-10-30（オーナー：はじいた資料も使う・上がるときだけ）── 額は salary-data.mjs、出どころの記録は salary-sources.mjs。 */
  'sas': {
    tax: '課税（デンマーク・スウェーデン・ノルウェー）', tax_en: 'Taxed (Denmark, Sweden, Norway)',
    src: [
      /* g4 src */
      { pub: 'Ready For Take-Off Book', pub_en: 'Ready For Take-Off Book', name: 'SAS Scandinavian Airlines | Pilot Pay, Rosters & Benefits', name_en: 'SAS Scandinavian Airlines | Pilot Pay, Rosters & Benefits',
        as_of: '2026-03-27 掲載', as_of_en: 'Published 27 March 2026', accessed: '2026-10-30', secondary: true,
        url: 'https://readyfortakeoffbook.com/blogs/pilot-conditions/sas-scandinavian-airlines' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate' },
    fo: { tier: 'estimate', /* g4 fo */ est: {
      basis: 'Ready For Take-Off Book のスカンジナビア航空のページ「SAS Scandinavian Airlines | Pilot Pay, Rosters & Benefits」（2026年3月）',
      basis_en: 'Ready For Take-Off Book’s SAS page, “SAS Scandinavian Airlines | Pilot Pay, Rosters & Benefits” (March 2026)',
      method: '副操縦士の表の「上級副操縦士（5年以上）年 約 €68,000〜78,000」（税引き前の見込み）の真ん中 €73,000 を使っています。表の額は日当・手当を含まない基本給です。幅は前の値のままです。',
      method_en: 'Set at the midpoint, €73,000, of the first officer table’s “Senior F/O (5+ years) ~68,000 - 78,000” in annual gross euros. The figures are base salary before per diems and allowances. The range is unchanged.',
      as_of: '2026年3月', as_of_en: 'March 2026',
    } },
  },
  /* ★2026-10-30（オーナー：はじいた資料も使う・上がるときだけ）── 額は salary-data.mjs、出どころの記録は salary-sources.mjs。 */
  'virgin-atlantic': {
    tax: '課税（英国）', tax_en: 'Taxed (United Kingdom)',
    src: [
      /* g4 src */
      { pub: 'Ready For Take-Off Book', pub_en: 'Ready For Take-Off Book', name: 'Virgin Atlantic | Pilot Pay, Rosters, Fleet & Benefits', name_en: 'Virgin Atlantic | Pilot Pay, Rosters, Fleet & Benefits',
        as_of: '2026-03-16 掲載', as_of_en: 'Published 16 March 2026', accessed: '2026-10-30', secondary: true,
        url: 'https://readyfortakeoffbook.com/blogs/pilot-conditions/virgin-atlantic' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', /* g4 cap */ est: {
      basis: 'Ready For Take-Off Book のヴァージン・アトランティック航空のページ「Virgin Atlantic | Pilot Pay, Rosters, Fleet & Benefits」（2026年3月）',
      basis_en: 'Ready For Take-Off Book’s Virgin Atlantic page, “Virgin Atlantic | Pilot Pay, Rosters, Fleet & Benefits” (March 2026)',
      method: '機長の表の「14年目以上の機長」の「手当込みの合計の見込み 約 £224,000」（税引き前の年額）を使っています。会社の年金拠出と、教官・審査の上乗せは足していません。幅の上もこの額です。幅の下は前の値のままです。',
      method_en: 'Set at the captain table’s estimated total including allowances for a “Year 14+ Captain”, ~£224,000 a year (gross). The company pension contribution and the uplift for training captains and examiners are not added. The top of the range is the same figure. The bottom of the range is unchanged.',
      as_of: '2026年3月', as_of_en: 'March 2026',
    } },
    fo: { tier: 'estimate', /* g4 fo */ est: {
      basis: 'Ready For Take-Off Book のヴァージン・アトランティック航空のページ「Virgin Atlantic | Pilot Pay, Rosters, Fleet & Benefits」（2026年3月）',
      basis_en: 'Ready For Take-Off Book’s Virgin Atlantic page, “Virgin Atlantic | Pilot Pay, Rosters, Fleet & Benefits” (March 2026)',
      method: '副操縦士の表の「上級副操縦士（5年以上）」の「手当込みの合計の見込み 約 £115,000〜130,000」（税引き前の年額）の真ん中 £122,500 を使っています。会社の年金拠出は足していません。幅の上は £130,000 です。幅の下は前の値のままです。',
      method_en: 'Set at the midpoint, £122,500, of the first officer table’s estimated total including allowances for a “Senior F/O (5+ yrs)”, ~£115,000 - £130,000 a year (gross). The company pension contribution is not added. The top of the range is £130,000. The bottom of the range is unchanged.',
      as_of: '2026年3月', as_of_en: 'March 2026',
    } },
  },
  /* ★2026-10-30（オーナー：はじいた資料も使う・上がるときだけ）── 額は salary-data.mjs、出どころの記録は salary-sources.mjs。 */
  'kenya-airways': {
    tax: '課税（ケニア）', tax_en: 'Taxed (Kenya)',
    pay_tax: 'unknown',
    src: [
      /* g4 src */
      { pub: 'AscendurePro', pub_en: 'AscendurePro', name: 'How to Become a Commercial Pilot in Kenya (2026 Ultimate Guide): Costs, Top Schools & Salaries', name_en: 'How to Become a Commercial Pilot in Kenya (2026 Ultimate Guide): Costs, Top Schools & Salaries',
        as_of: '2026-02-23 掲載', as_of_en: 'Published 23 February 2026', accessed: '2026-10-30', secondary: true,
        url: 'https://ascendurepro.com/how-to-become-a-commercial-pilot-in-kenya/' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', /* g4 cap */ est: {
      basis: 'AscendurePro の記事「How to Become a Commercial Pilot in Kenya (2026 Ultimate Guide)」（2026年2月）',
      basis_en: 'The AscendurePro article “How to Become a Commercial Pilot in Kenya (2026 Ultimate Guide)” (February 2026)',
      method: '記事の「ケニア航空の機長は月 最大 KES 200万（年 約 KSh 2,400万）、乗務手当を含めると約 KES 3,000万に届く」のうち、記事が書いている年額 KSh 2,400万を使っています。税引き前か手取りかは書かれていません。幅の上は乗務手当込みの KES 3,000万です。幅の下は前の値のままです。',
      method_en: 'Set at the yearly figure the article itself gives, KSh 24M, from “a Kenya Airways captain can make up to KES 2 million per month (≈KSh 24M/year), and with flight allowances can reach about KES 30M”. It does not say whether the figures are before or after tax. The top of the range is the KES 30M including flight allowances. The bottom of the range is unchanged.',
      as_of: '2026年2月', as_of_en: 'February 2026',
    } },
    fo: { tier: 'estimate', /* g4 fo */ est: {
      basis: 'AscendurePro の記事「How to Become a Commercial Pilot in Kenya (2026 Ultimate Guide)」（2026年2月）',
      basis_en: 'The AscendurePro article “How to Become a Commercial Pilot in Kenya (2026 Ultimate Guide)” (February 2026)',
      method: '記事の表「ケニアのパイロットの月給」の「大手航空会社の副操縦士（B737／B787）月 KES 600k〜900k」の真ん中 KES 750,000 を12倍しています。税引き前か手取りかは書かれていません。幅の上は月 KES 900,000 の12倍です。幅の下は前の値のままです。',
      method_en: 'Set at the midpoint, KES 750,000, of “Major Airline FO, B737 / B787, 600k – 900k” in the article’s table of monthly pilot salaries in Kenya, multiplied by 12. It does not say whether the figures are before or after tax. The top of the range is KES 900,000 a month × 12. The bottom of the range is unchanged.',
      as_of: '2026年2月', as_of_en: 'February 2026',
    } },
  },
  /* ★2026-10-30（オーナー：はじいた資料も使う・上がるときだけ）── 額は salary-data.mjs、出どころの記録は salary-sources.mjs。 */
  'south-african-airways': {
    tax: '課税（南アフリカ）', tax_en: 'Taxed (South Africa)',
    pay_tax: 'unknown',
    src: [
      /* g4 src */
      { pub: 'Jobrato', pub_en: 'Jobrato', name: 'Commercial Airline Pilot Salary in South Africa: SAA, Airlink & Safair Pay Scales', name_en: 'Commercial Airline Pilot Salary in South Africa: SAA, Airlink & Safair Pay Scales',
        as_of: '2026-01-29 掲載', as_of_en: 'Published 29 January 2026', accessed: '2026-10-30', secondary: true,
        url: 'https://jobrato.co.za/commercial-airline-pilot-salary-in-south-africa-saa-airlink-safair-pay-scales/' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', /* g4 cap */ est: {
      basis: 'Jobrato の記事「Commercial Airline Pilot Salary in South Africa: SAA, Airlink & Safair Pay Scales」（2026年1月）',
      basis_en: 'The Jobrato article “Commercial Airline Pilot Salary in South Africa: SAA, Airlink & Safair Pay Scales” (January 2026)',
      method: '記事の「広胴機（A330・リースの A350）の上級機長は年 R2.2 Million〜R3.5 Million 超」の真ん中 R2,850,000 を使っています。狭胴機の機長の額は記事にありません。税引き前か手取りかは書かれていません。幅の上は R3,500,000 です。幅の下は前の値のままです。',
      method_en: 'Set at the midpoint, R2,850,000, of the article’s “Senior Captains commanding wide-body aircraft (like the Airbus A330 or leased A350 configurations) command premium packages ranging from R2.2 Million to over R3.5 Million annually”. The article gives no figure for narrowbody captains. It does not say whether the figures are before or after tax. The top of the range is R3,500,000. The bottom of the range is unchanged.',
      as_of: '2026年1月', as_of_en: 'January 2026',
    } },
    fo: { tier: 'estimate', /* g4 fo */ est: {
      basis: 'Jobrato の記事「Commercial Airline Pilot Salary in South Africa: SAA, Airlink & Safair Pay Scales」（2026年1月）',
      basis_en: 'The Jobrato article “Commercial Airline Pilot Salary in South Africa: SAA, Airlink & Safair Pay Scales” (January 2026)',
      method: '記事の「副操縦士は月 R70,000〜130,000（国内線の A320 か国際線の長距離かで大きく違う）」の真ん中 R100,000 を12倍しています。税引き前か手取りかは書かれていません。幅の上は月 R130,000 の12倍です。幅の下は前の値のままです。',
      method_en: 'Set at the midpoint, R100,000, of the article’s “First Officers: Earn between R70,000 and R130,000 per month, depending heavily on whether they serve on domestic Airbus A320 routes or international long-haul routes”, multiplied by 12. It does not say whether the figures are before or after tax. The top of the range is R130,000 a month × 12. The bottom of the range is unchanged.',
      as_of: '2026年1月', as_of_en: 'January 2026',
    } },
  },
  /* ★2026-10-30（オーナー：はじいた資料も使う・上がるときだけ）── 額は salary-data.mjs、出どころの記録は salary-sources.mjs。 */
  'indigo': {
    tax: '課税（インド）', tax_en: 'Taxed (India)',
    src: [
      /* g4 src */
      { pub: 'Pilots Academy', pub_en: 'Pilots Academy', name: 'Pilot Salary in India 2026: Monthly Pay by Airline & Rank', name_en: 'Pilot Salary in India 2026: Monthly Pay by Airline & Rank',
        as_of: '2026-07-19 掲載・2026年10月 更新', as_of_en: 'Published 19 July 2026, updated October 2026', accessed: '2026-10-30', secondary: true,
        url: 'https://pilotsacademy.co.in/pilot-salary-in-india/' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', /* g4 cap */ est: {
      basis: 'Pilots Academy の記事「Pilot Salary in India 2026」にある、インディゴの給与の表（記事は社内資料「Airbus Compensation Structure」の数字と書いています・2026年10月更新）',
      basis_en: 'The IndiGo pay table in the Pilots Academy article “Pilot Salary in India 2026”, which the article says comes from IndiGo’s internal “Airbus Compensation Structure” slide (updated October 2026)',
      method: '表の「上級機長（2,500時間超）の月の CTC ₹8.91 Lac」を12倍しています。CTC は固定給と月70時間ぶんの乗務の分を含む、会社が払う総額です。審査（LTC）・教官（TRI）の段と、長く勤めた機長への支払い（5年で ₹15 lakh）は入れていません。幅は前の値のままです。',
      method_en: 'Set at the table’s “Sr. Captain (>2,500 Hrs) monthly CTC ₹8.91 Lac”, multiplied by 12. CTC (cost to company) includes fixed pay and the committed flying component at 70 hours. The check (LTC) and instructor (TRI) steps and the longevity payout for captains (₹15 lakh over five years) are not included. The range is unchanged.',
      as_of: '2026年10月', as_of_en: 'October 2026',
    } },
    fo: { tier: 'estimate', /* g4 fo */ est: {
      basis: 'Pilots Academy の記事「Pilot Salary in India 2026」にある、インディゴの給与の表（記事は社内資料「Airbus Compensation Structure」の数字と書いています・2026年10月更新）',
      basis_en: 'The IndiGo pay table in the Pilots Academy article “Pilot Salary in India 2026”, which the article says comes from IndiGo’s internal “Airbus Compensation Structure” slide (updated October 2026)',
      method: '同じ表の「上級副操縦士（SFO）の月の CTC ₹4.85 Lac」を12倍しています。CTC は固定給と月70時間ぶんの乗務の分を含む、会社が払う総額です。幅の上もこの額です。幅の下は前の値のままです。',
      method_en: 'Set at the same table’s “Senior First Officer monthly CTC ₹4.85 Lac”, multiplied by 12. CTC (cost to company) includes fixed pay and the committed flying component at 70 hours. The top of the range is the same figure. The bottom of the range is unchanged.',
      as_of: '2026年10月', as_of_en: 'October 2026',
    } },
  },
  /* ★2026-10-30（オーナー：はじいた資料も使う・上がるときだけ）── 額は salary-data.mjs、出どころの記録は salary-sources.mjs。 */
  'egyptair': {
    tax: '課税（エジプト）', tax_en: 'Taxed (Egypt)',
    pay_tax: 'unknown',
    src: [
      /* g4 src */
      { pub: 'Ready For Take-Off Book', pub_en: 'Ready For Take-Off Book', name: 'EgyptAir | Pilot Working Conditions, Pay & Careers', name_en: 'EgyptAir | Pilot Working Conditions, Pay & Careers',
        as_of: '2026-05-11 掲載', as_of_en: 'Published 11 May 2026', accessed: '2026-10-30', secondary: true,
        url: 'https://readyfortakeoffbook.com/blogs/pilot-conditions/egyptair' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', /* g4 cap */ est: {
      basis: 'Ready For Take-Off Book のエジプト航空のページ「EgyptAir | Pilot Working Conditions, Pay & Careers」（2026年5月）',
      basis_en: 'Ready For Take-Off Book’s EgyptAir page, “EgyptAir | Pilot Working Conditions, Pay & Careers” (May 2026)',
      method: '機長の表のいちばん上の段「上級の広胴機の機長」の月額「~USD 10,000+」（外貨で払う基本給）と「~EGP 12,000+」（現地通貨の上乗せ・表の見出しは税引き後）を、USD 10,000 と EGP 12,000 として足し、12倍しています。USD の基本給が税引き前か手取りかは書かれていません。1区間あたりの日当（USD 80）・乗務手当・残業代・賞与は足していません。幅の上もこの額です。幅の下は前の値のままです。',
      method_en: 'Set at the top step of the captain table, “Senior Widebody Captain”: “~USD 10,000+” a month (base salary paid in foreign currency) plus “~EGP 12,000+” a month (local supplement, shown as post-tax in the table), taken as USD 10,000 and EGP 12,000 and multiplied by 12. It does not say whether the USD base is before or after tax. The per-sector per diem (USD 80), flight pay, overtime and bonuses are not added. The top of the range is the same figure. The bottom of the range is unchanged.',
      as_of: '2026年5月', as_of_en: 'May 2026',
    } },
    fo: { tier: 'estimate', /* g4 fo */ est: {
      basis: 'Ready For Take-Off Book のエジプト航空のページ「EgyptAir | Pilot Working Conditions, Pay & Careers」（2026年5月）',
      basis_en: 'Ready For Take-Off Book’s EgyptAir page, “EgyptAir | Pilot Working Conditions, Pay & Careers” (May 2026)',
      method: '副操縦士の表の「4〜7年目」（6年目を含む段）の月額「~USD 5,000」（外貨で払う基本給）と「~EGP 4,500」（現地通貨の上乗せ・表の見出しは税引き後）を足し、12倍しています。USD の基本給が税引き前か手取りかは書かれていません。1区間あたりの日当（USD 40）と賞与は足していません。幅は前の値のままです。',
      method_en: 'Set at the first officer table’s “Mid FO (Year 4 to 7)” step, which covers year 6: “~USD 5,000” a month (base salary paid in foreign currency) plus “~EGP 4,500” a month (local supplement, shown as post-tax in the table), multiplied by 12. It does not say whether the USD base is before or after tax. The per-sector per diem (USD 40) and bonuses are not added. The range is unchanged.',
      as_of: '2026年5月', as_of_en: 'May 2026',
    } },
  },
  /* ★2026-10-30（オーナー：はじいた資料も使う・上がるときだけ）── 額は salary-data.mjs、出どころの記録は salary-sources.mjs。 */
  'ethiopian-airlines': {
    tax: '課税（エチオピア）', tax_en: 'Taxed (Ethiopia)',
    src: [
      /* g4 src */
      { pub: 'Pilot Jobs Network', pub_en: 'Pilot Jobs Network', name: 'Ethiopian Airlines', name_en: 'Ethiopian Airlines',
        as_of: '2024-08-27 更新（ページの記載）', as_of_en: 'Last updated 27 August 2024 (as stated on the page)', accessed: '2026-10-30', secondary: true,
        url: 'https://www.pilotjobsnetwork.com/jobs/Ethiopian_Airlines' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', /* g4 cap */ est: {
      basis: 'Pilot Jobs Network のエチオピア航空のページの簡易の給与表（2024年8月27日の書き込み）',
      basis_en: 'The brief pay scale on Pilot Jobs Network’s Ethiopian Airlines page (entry of 27 August 2024)',
      method: '表の「機長の上の段（Capt top）€135,000／ETB 16,330,000」のうち、ブルの額 ETB 16,330,000 を円にしています。表は税引き前の額を書く欄です。幅は前の値のままです。',
      method_en: 'Set at the birr amount, ETB 16,330,000, of “Capt top €135,000 / ETB-16,330,000” in the page’s brief pay scale, which asks for pre-tax figures. The range is unchanged.',
      as_of: '2024年8月', as_of_en: 'August 2024',
    } },
    fo: { tier: 'estimate' },
  },
  /* ★2026-10-30（オーナー：はじいた資料も使う・上がるときだけ）── 額は salary-data.mjs、出どころの記録は salary-sources.mjs。 */
  'ana-wings': {
    tax: '課税（日本）', tax_en: 'Taxed (Japan)',
    src: [
      /* g4 src */
      { pub: 'PILOT VALUE', pub_en: 'PILOT VALUE', name: 'REAL PAY（会員が出した給与）', name_en: 'REAL PAY (pay submitted by members)',
        as_of: '2026-10-30 集計', as_of_en: 'Counted 30 October 2026', accessed: '2026-10-30',
        url: 'https://pilot-value.com/actual-pay.html' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', from: 'members', /* g4 cap */ est: {
      basis: 'PILOT VALUE にANAウイングスの機長が出した給与（直近24か月）',
      basis_en: 'Pay submitted to PILOT VALUE by ANA Wings captains (past 24 months)',
      method: '会員が出した年収の中央値です（1人につき最新の1件・1万円単位）。会社の年金拠出など、給与明細に載らない分は入っていません。',
      method_en: 'The median of the annual pay members have submitted (the latest entry per person, to the nearest ¥10,000). Amounts that do not appear on a payslip, such as the company pension contribution, are not included.',
      as_of: '2026年10月30日 集計', as_of_en: 'Counted 30 October 2026',
    } },
    fo: { tier: 'estimate', from: 'members', /* g4 fo */ est: {
      basis: 'PILOT VALUE にANAウイングスの副操縦士が出した給与（直近24か月）',
      basis_en: 'Pay submitted to PILOT VALUE by ANA Wings first officers (past 24 months)',
      method: '会員が出した年収の中央値です（1人につき最新の1件・1万円単位）。会社の年金拠出など、給与明細に載らない分は入っていません。',
      method_en: 'The median of the annual pay members have submitted (the latest entry per person, to the nearest ¥10,000). Amounts that do not appear on a payslip, such as the company pension contribution, are not included.',
      as_of: '2026年10月30日 集計', as_of_en: 'Counted 30 October 2026',
    } },
  },
  /* ★2026-10-30（オーナー：はじいた資料も使う・上がるときだけ）── 額は salary-data.mjs、出どころの記録は salary-sources.mjs。 */
  'fda': {
    tax: '課税（日本）', tax_en: 'Taxed (Japan)',
    src: [
      /* g4 src */
      { pub: 'PILOT VALUE', pub_en: 'PILOT VALUE', name: 'REAL PAY（会員が出した給与）', name_en: 'REAL PAY (pay submitted by members)',
        as_of: '2026-10-30 集計', as_of_en: 'Counted 30 October 2026', accessed: '2026-10-30',
        url: 'https://pilot-value.com/actual-pay.html' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate', from: 'members', /* g4 cap */ est: {
      basis: 'PILOT VALUE にフジドリームエアラインズ（FDA）の機長が出した給与（直近24か月）',
      basis_en: 'Pay submitted to PILOT VALUE by Fuji Dream Airlines (FDA) captains (past 24 months)',
      method: '会員が出した年収の中央値です（1人につき最新の1件・1万円単位）。会社の年金拠出など、給与明細に載らない分は入っていません。',
      method_en: 'The median of the annual pay members have submitted (the latest entry per person, to the nearest ¥10,000). Amounts that do not appear on a payslip, such as the company pension contribution, are not included.',
      as_of: '2026年10月30日 集計', as_of_en: 'Counted 30 October 2026',
    } },
    fo: { tier: 'estimate' },
  },
  /* ★2026-10-30（オーナー：はじいた資料も使う・上がるときだけ）── 額は salary-data.mjs、出どころの記録は salary-sources.mjs。 */
  'orc': {
    tax: '課税（日本）', tax_en: 'Taxed (Japan)',
    src: [
      /* g4 src */
      { pub: 'PILOT VALUE', pub_en: 'PILOT VALUE', name: 'REAL PAY（会員が出した給与）', name_en: 'REAL PAY (pay submitted by members)',
        as_of: '2026-10-30 集計', as_of_en: 'Counted 30 October 2026', accessed: '2026-10-30',
        url: 'https://pilot-value.com/actual-pay.html' },
    ],
    notes: [], notes_en: [],
    cap: { tier: 'estimate' },
    fo: { tier: 'estimate', from: 'members', /* g4 fo */ est: {
      basis: 'PILOT VALUE にオリエンタルエアブリッジの副操縦士が出した給与（直近24か月）',
      basis_en: 'Pay submitted to PILOT VALUE by Oriental Air Bridge (ORC) first officers (past 24 months)',
      method: '会員が出した年収の中央値です（1人につき最新の1件・1万円単位）。会社の年金拠出など、給与明細に載らない分は入っていません。',
      method_en: 'The median of the annual pay members have submitted (the latest entry per person, to the nearest ¥10,000). Amounts that do not appear on a payslip, such as the company pension contribution, are not included.',
      as_of: '2026年10月30日 集計', as_of_en: 'Counted 30 October 2026',
    } },
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
      out.push({ group: g.name, group_en: g.name_en, key, kind: KINDS[key], kind_en: KINDS_EN[key],
        cur: b.cur, amount: g[key],
        man: man(b.cur, g[key]), text: manText(b.cur, g[key]), training: !!g.training });
    }
    /* 月額 × か月数（スターラックスの13か月給与）。月額と年額の両方を出す。 */
    if (g.month != null) {
      out.push({ group: g.name, group_en: g.name_en, key: 'month', kind: '月額', kind_en: 'monthly pay',
        cur: b.cur, amount: g.month,
        man: man(b.cur, g.month), text: manText(b.cur, g.month), training: !!g.training });
      if (g.months != null) {
        const y = g.month * g.months;
        out.push({ group: g.name, group_en: g.name_en, key: 'month_x',
          kind: `月額 × ${g.months}か月`, kind_en: `monthly pay × ${g.months} months`, cur: b.cur,
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

/** ★金額そのものを公開用の数値（salary-data.json・順位・国別平均・レベリング図）へ
    流してよいか。2026-09-30 オーナー指示「確認中じゃなくて推定とかにすりゃいいじゃん」。

    ⚠️ canSayAverage と混ぜない。あちらは**呼び方**の判定（「平均」と名乗れるのは
       observed_mean だけ）で、こちらは**数字を出すかどうか**の判定。
       2026-09-29 は canSayAverage 1つで両方を決めていたため、平均と名乗れない57件のうち
       50件（確認中36件＋公式募集例・求人・過去広告・給与例19件のうち該当分）が
       公開JSONから金額ごと消え、ランキング・国別平均・レベリング図が一緒に落ちた。
    ⚠️ 台帳に無い会社は true（今までどおり SALARY の値をそのまま使う）。
       台帳は25社ぶんしか無く、残り87社は監査の対象外＝落とす理由が無い。 */
export const canPublishNumber = (slug, rank) =>
  (BASIS[slug]?.[rank]?.tier ?? null) !== 'held';

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

/* ── 1行しか出せない場所のための「1つだけの金額」───────────────────
   一覧カード・国別リンクの丸い札のように、会社名の隣に数字を1つしか
   置けない場所がある。そこに出してよいのは「年額の現金」だけ。

   ⚠️ 総待遇（pkg_y）は返さない。他社の現金と並ぶと、住宅・学費まで
      含んだ額と給与だけの額を同じ列で比べさせることになる。
   ⚠️ 月額を12倍して年額にしない（オーナーが名指しで禁止）。
   ⚠️ 訓練中の額は返さない。
   台帳に無い会社は null を返す＝呼ぶ側は今までどおりで構わない。 */
const CARD_YEARLY_CASH = new Set(
  ['cash_y', 'cash_y_over', 'max_y', 'target_y', 'avg_y', 'reward_y', 'month_x'],
);
const CARD_UPPER = new Set(['max_y']);

export function cardFigure(slug, rank = 'cap') {
  if (!BASIS[slug]) return null;
  const tier = BASIS[slug][rank]?.tier || 'held';
  /* ★推定（2026-09-30 オーナー指示）── **金額はここでは作らない。**
     このファイルは salary-data.mjs から import されているので、こちらから SALARY を
     読むと循環参照になる。台帳の held.was にも同じ数字が控えてあるが、そちらを返すと
     **年収の値がリポジトリに2か所できる**（SSOT は salary-data.mjs だけ）。
     workflows/update-salary.md で SALARY を直した人は台帳を触らないので、
     題名と説明文だけが黙って旧値のまま残る。だから「推定である」ことだけ返し、
     金額は呼ぶ側が SALARY から取る。 */
  /* ★2026-10-25（オーナー：エミレーツの推定年収＝会社公表の総待遇ぜんぶ）。台帳に card: 'estimate' を置いた職位も推定を返す。
       会社の公表額がある職位でも、推定年収そのものが会社の公表額から作られているときは、カードは推定を出して
       会社ページ・比較の1枚と同じ額にする（公表額の一覧は会社ページに残る）。⚠️ 等級（tier）は変えない ──
       変えると会社ページの「会社が公表している金額」の一覧と、その額の検査（check-salary.mjs）まで推定の扱いに落ちる。 */
  if (tier === 'estimate' || BASIS[slug][rank]?.card === 'estimate') {
    return {
      held: false, estimate: true, man: null, up: false, yen: null,
      kindJa: TIERS.estimate.ja, kindEn: TIERS.estimate.en,
    };
  }
  const f = figures(slug, rank).find((x) => CARD_YEARLY_CASH.has(x.key) && !x.training);
  if (!f) {
    /* ★2026-10-02、ここに落ちた社を確認中にするのをやめた。
       丸い札は「年額の現金」しか置けないので、**月額しか取れていない社**
       （中国東方・中国南方・サウジア）が、より強い根拠を持っているのに
       札だけ「確認中」になっていた。同じページの題名は「機長 推定◯万円」で、
       同じ画面の中で食い違っていた。
       ⚠️ 月額を12倍して年額を作るのは禁じられている（オーナー明記）。
          なので他社と同じ**推定**に落とす ── 推定の出どころは salary-data.mjs で、
          その社の金額として画面の他の場所が既に出しているものと同じ。
       月額そのものは会社ページの表に、種類を名乗らせたまま残っている。
       tier:'held'（意図して出さないと決めた職位）だけは今までどおり確認中。 */
    if (tier === 'held') return { held: true, yen: null, kindJa: '確認中', kindEn: 'Under review' };
    return {
      held: false, estimate: true, man: null, up: false, yen: null,
      kindJa: TIERS.estimate.ja, kindEn: TIERS.estimate.en,
    };
  }
  const up = CARD_UPPER.has(f.key);
  return {
    held: false,
    /* man は生の万円。呼ぶ側が別の通貨・別の書き方にしたいときに使う
       （seo-normalize.mjs が題名と説明文をドルで作るのに要る）。
       ⚠️ 選んだのが「上限」の額なら up が立つ。man だけ取って
          「〜」を落とすと、上限が平の額として出る。 */
    man: f.man,
    up,
    yen: `${up ? '〜' : ''}¥${f.man.toLocaleString('en-US')}万`,
    kindJa: `${TIERS[tier].ja}${up ? '（上限）' : ''}`,
    kindEn: `${TIERS[tier].en}${up ? ' (max)' : ''}`,
  };
}

export default BASIS;
