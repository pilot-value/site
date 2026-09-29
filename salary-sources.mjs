/* ═══════════════════════════════════════════════════════════════════════
   salary-sources.mjs — 公開情報（salary-data.mjs の SALARY）の出所台帳
   ───────────────────────────────────────────────────────────────────────
   方針の本文は DATA-PROVENANCE.md。ここはその実体。

   ★ ここは「領収書」であって「金額」ではない。
     数値の唯一の正は salary-data.mjs の SALARY。この台帳の value_orig が
     SALARY と食い違っても、SALARY を書き換える権限はここに無い
     （差分は status:'candidate' と note に残し、workflows/update-salary.md で判断する）。

   ★ SALARY 本体に出所を書かない理由：
     gen-salary-json.mjs が salary-data.mjs の各エントリを { ...d } で丸ごと
     salary-data.json に吐く。SALARY に src を足すと出所URLがブラウザから
     fetch できる公開ファイルに載ってしまう。このファイルは誰も import しない。

   ★ このファイルを削除すると第三者由来の来歴だけが消え、SALARY の数値も
     Supabase の一次データ（pay_reports）も無傷で残る（DATA-PROVENANCE.md 6.）。

   検証: node check-sources.mjs  ／  node check-sources.mjs --online
════════════════════════════════════════════════════════════════════════ */

// 出所の語彙。DATA-PROVENANCE.md 1. の表と1対1で対応させる。
// 前半＝公開情報の層、後半＝一次データの層（一次データの出所は Supabase 側が持つので
// この台帳には現れないが、語彙としては同じ集合を使う）。
export const SOURCE_TYPES = [
  'official_package',      // 航空会社が自ら公表した報酬パッケージ
  'published_pay_scale',   // 公開されている給与等級表（実額入り）
  'regulatory_filing',     // 有価証券報告書・사업보고서・年次報告書
  'union_cba',             // 労働協約・CBA・組合が公表した pay scale
  'government',            // 政府・公的統計
  'job_posting',           // 航空会社公式の求人票
  'third_party_reference', // 給与まとめサイト・報道・二次情報
  'community_reference',   // フォーラム・口コミ・SNS
  'manual_report',         // ユーザーの手入力（＝Supabase 側）
  'payslip_derived',       // 給与明細由来（＝Supabase 側）
];

export const STATUSES = [
  'in_use',     // 検証済み。SALARY の数値を支える根拠として採用している
  'candidate',  // URL は生きているが、引用または数値の目視確認が未了
  'rejected',   // 確認したが採用しない（矛盾・母集団違い・信頼性不足）
  'stale',      // かつて採用したが、資料が失効・改訂された
];

/* ───────────────────────────────────────────────────────────────────────
   REFERENCES — 特定の航空会社に紐づかない一次資料
   会社別の数値を支える根拠にはならないが、市場全体の水準を確認する土台になる。
   ⚠️ ここの数値を会社別の数値と同じ分布に混ぜない（DATA-PROVENANCE.md 3.）。
─────────────────────────────────────────────────────────────────────── */
export const REFERENCES = [
  {
    id:          'jp-wage-census-r6-pilots',
    scope:       'JP 全国・航空機操縦士（企業規模計・男女計）',
    rank:        'all',
    source_type: 'government',
    name:        '令和6年賃金構造基本統計調査 職種（小分類）、性別きまって支給する現金給与額、所定内給与額及び年間賞与その他特別給与額（産業計）／厚生労働省・e-Stat',
    url:         'https://www.e-stat.go.jp/stat-search/files?stat_infid=000040247854',
    published_at:'2025-03-17',
    accessed_at: '2026-08-09',
    // 表の「航空機操縦士」行（企業規模計・男女計）から実測。年収換算は
    // きまって支給する現金給与額 × 12 + 年間賞与その他特別給与額。
    value_orig:  'きまって支給する現金給与額 1,268.4千円/月・年間賞与その他特別給与額 1,749.9千円 → 年収換算 16,970.7千円（≒1,697万円）',
    quote:       '航空機操縦士｜年齢40.4歳｜勤続12.7年｜きまって支給する現金給与額1,268.4千円｜所定内給与額1,217.7千円｜年間賞与その他特別給与額1,749.9千円｜労働者数12,610人',
    status:      'in_use',
    note:        '公開xlsxを実際にダウンロードして該当行を機械抽出・検算済み（2026-08-09）。'
               + '⚠️ 機長／副操縦士の別が無い全操縦士の平均なので、会社別の cap/fo を直接支えることはできない。'
               + '日本の会社別数値が国全体の平均から大きく外れていないかの上位チェックに使う。',
  },
  {
    id:          'tw-mol-occupational-wage-113-pilots',
    scope:       'TW 全国・航空駕駛員（非管理職）',
    rank:        'all',
    source_type: 'government',
    name:        '113年職類別薪資調查統計結果／中華民國勞動部 統計處',
    url:         'https://www.mol.gov.tw/1607/1632/1640/80495/',
    published_at:'2025-05-29',
    accessed_at: '2026-09-26',
    value_orig:  '月薪・年薪ともに航空駕駛員が全細職類の最上位。ただし本文が示すのは帯だけで、'
               + '月薪は「均逾10萬元」（航空駕駛員・精算師・醫師・職業運動員・船舶監管人員が該当）、'
               + '年薪は「均逾150萬元」（航空駕駛員・精算師・醫師・船舶監管人員・電信工程師・律師・'
               + '職業運動員が該当）。航空駕駛員そのものの実数はこのページに載っていない。',
    quote:       '就各細職類月薪（不含主管及監督人員）觀察，以航空駕駛員最高，精算師次之，餘依序為醫師、'
               + '職業運動員、船舶監管人員（含引水人員），均逾10萬元；年薪亦以航空駕駛員、精算師較高，'
               + '醫師、船舶監管人員（含引水人員）、電信工程師、律師、職業運動員均逾150萬元。',
    status:      'candidate',
    note:        '★ この資料の価値は金額ではなく「順位」── 台湾政府が、航空駕駛員を全職種で'
               + '月額トップと明記している。台湾3社の記事でそのまま引ける（金額は引かない）。'
               + '⚠️ 基準が2つある ── 月額は113年7月の「經常性薪資」（本薪＋月ごとに払う固定の手当と'
               + '賞与。税・保険・組合費は引いていない額面）。年額は112年全年の源泉徴収票「50薪資」の'
               + '給付總額（本薪＋業績賞与＋年末賞与＋各種手当。★残業代と非課税枠内の食事手当は含まない）。'
               + '＝どちらも現金であって、福利厚生込みの総額パッケージではない。'
               + '⚠️ 航空駕駛員の実数は動的検索 https://pswst.mol.gov.tw/psdn/ の中だけにあり、'
               + 'POST が WAF に弾かれて取得できなかった。添付PDFの中国語は埋め込みフォントの都合で'
               + '機械抽出できず、細職類の行は読めていない（取れたのは大分類の集計だけ）。'
               + 'ブラウザで開けば取れる見込み。実数が未確認のため candidate。',
  },
];

/* ───────────────────────────────────────────────────────────────────────
   SOURCES — 会社別の出所。キーは SALARY と同じ slug。
   1エントリ＝1資料。同じ会社に複数の資料がぶら下がってよい。
─────────────────────────────────────────────────────────────────────── */
export const SOURCES = {

  // ── 米国メガキャリア ──────────────────────────────────────────────
  // Delta MEC（ALPA）が Section 6 交渉に向けて公表した契約比較。p.25 が12年目機長、
  // p.26 が12年目副操縦士の料率表で、Delta / American / United を同じ物差しで3列に並べている。
  // だからこの1資料が3社の根拠になる。列は座標で確定させた（Delta=x235 / American=x384 /
  // United=x533 の Pay Rate 欄）。⚠️ 平文の順に読むと列が混ざる（$373.33 と $375.28 が
  // 同じ行に並ぶ）ので、社別の値を取るときは必ず x 座標で分けること。
  //
  // ⚠️ ここに入っているのは「12年目の時間あたり料率」であって年収ではない。
  //    SALARY の avg はフリート全体・全年次の平均推計なので、この資料が直接支えるのは
  //    レンジ（lo–hi）の上端側であって avg ではない。年収換算（年間乗務時間 × ドル円）は
  //    台帳では行わない（DATA-PROVENANCE.md 2.「原通貨・原単位のまま」）。
  'delta': [
    {
      rank:        'cap',
      source_type: 'union_cba',
      name:        'pilot contract COMPARISON — DELTA p.25「2025 12-Year Captain Pay Comparison」（Delta MEC Negotiating Committee／ALPA Economic & Financial Analysis Dept.）',
      url:         'https://dal.alpa.org/Portals/1/ThemePluginPro/uploads/2025/9/2/DALContractComparison-2026.pdf',
      published_at:null,
      accessed_at: '2026-08-09',
      value_orig:  'Delta 12年目機長・時間あたり $465.13（A-350-900 / A-330 / B-767-400ER）〜 $335.95（B-717）。'
                 + '内訳: 広胴 $465.13／B-767-300ER・B-757・A-321neo $389.34／A-321・B-737-900 $375.28／'
                 + 'A-320・A-319・B-737-800 $373.33／A-220-300 $360.24／A-220-100 $345.50／B-717 $335.95',
      quote:       '12-Year Captain rates, effective January 1, 2025',
      status:      'in_use',
      note:        'PDF原本を取得し、フォントの ToUnicode CMap を解いて表を機械抽出・列を座標で確定（2026-08-09）。'
                 + '同ページの注記「2) No rate set at Delta for A-350-1000, B-777-300/X, B-787-10 or B-737-MAX10/MAX9/MAX8」より、'
                 + 'これらの機種に Delta の料率は存在しない。'
                 + 'published_at は資料に明示が無いので null（本文は "The data in this comparison is current through summer 2025."、'
                 + '機材数は "Centre for Aviation Fleet Database as of June 30, 2025"）。',
    },
    {
      rank:        'fo',
      source_type: 'union_cba',
      name:        'pilot contract COMPARISON — DELTA p.26「2025 12-Year First Officer Pay Comparison」（Delta MEC Negotiating Committee）',
      url:         'https://dal.alpa.org/Portals/1/ThemePluginPro/uploads/2025/9/2/DALContractComparison-2026.pdf',
      published_at:null,
      accessed_at: '2026-08-09',
      value_orig:  'Delta 12年目副操縦士・時間あたり $317.73（広胴）〜 $229.43（B-717）。'
                 + '内訳: 広胴 $317.73／B-767-300ER・B-757・A-321neo $265.92／A-321・B-737-900 $256.33／'
                 + 'A-320・A-319・B-737-800 $254.99／A-220-300 $246.05／A-220-100 $235.97／B-717 $229.43',
      quote:       '12-Year First Officer rates, effective January 1, 2025',
      status:      'in_use',
      note:        '同上（p.26）。副操縦士は機長のおよそ 68%（$317.73 / $465.13）で、'
                 + 'SALARY の fo.avg / cap.avg の比（3,510 / 6,160 ≒ 57%）より高い。'
                 + '⚠️ これは矛盾ではない。この表は12年目のみ、SALARY は全年次の平均で、'
                 + '副操縦士側に低年次が多く含まれるため比が下がる。数値は動かさない。',
    },
  ],

  'united': [
    {
      rank:        'all',
      source_type: 'union_cba',
      name:        'United Pilot Agreement 2023（UPA 2023）締結版全文／United MEC・ALPA',
      url:         'https://d2r1lrrqctgamh.cloudfront.net/UAL/TA/upa23-2023-09-29.pdf',
      published_at:'2023-09-29',
      accessed_at: '2026-08-09',
      value_orig:  null,
      quote:       '',
      status:      'candidate',
      note:        'HTTP 206 / application/pdf を確認済み（ALPA の配信CDN）。労働協約そのもの＝最も硬い出所。'
                 + '⚠️ 10MB超で自動取得できず本文未読。Section 3（Compensation）の料率表を人が開いて確認すること。',
    },
    {
      rank:        'cap',
      source_type: 'union_cba',
      name:        'pilot contract COMPARISON — DELTA p.25「2025 12-Year Captain Pay Comparison」United 欄',
      url:         'https://dal.alpa.org/Portals/1/ThemePluginPro/uploads/2025/9/2/DALContractComparison-2026.pdf',
      published_at:null,
      accessed_at: '2026-08-09',
      value_orig:  'United 12年目機長・時間あたり $465.13（A-350-900 / B-777 / B-787 / B-767-400ER）〜 $373.33（A-320・A-319・B-737-MAX8/800/700）。'
                 + '中間: B-767-300ER・B-757・A-321xlr・A-321neo $389.34／B-737-MAX10・MAX9・B-737-900 $375.28',
      quote:       '12-Year Captain rates, effective January 1, 2025',
      status:      'in_use',
      note:        'PDF原本から機械抽出。United の Pay Rate 欄は x=533（座標で列を確定）。'
                 + '⚠️ 他組合（Delta MEC）が作った比較表なので、当該組合の UPA 2023 原本より一段落ちる。'
                 + '原本 Section 3 が読めたらそちらを in_use にし、こちらは stale に落とす。',
    },
    {
      rank:        'fo',
      source_type: 'union_cba',
      name:        'pilot contract COMPARISON — DELTA p.26「2025 12-Year First Officer Pay Comparison」United 欄',
      url:         'https://dal.alpa.org/Portals/1/ThemePluginPro/uploads/2025/9/2/DALContractComparison-2026.pdf',
      published_at:null,
      accessed_at: '2026-08-09',
      value_orig:  'United 12年目副操縦士・時間あたり $317.73（広胴）〜 $254.99（A-320・A-319・B-737-MAX8/800/700）。'
                 + '中間: B-767-300ER・B-757・A-321xlr・A-321neo $265.92／B-737-MAX10・MAX9・B-737-900 $256.33',
      quote:       '12-Year First Officer rates, effective January 1, 2025',
      status:      'in_use',
      note:        '同上（p.26・x=533）。UPA 2023 原本が読めたら stale に落とす。',
    },
  ],

  'american': [
    {
      rank:        'all',
      source_type: 'union_cba',
      name:        'American Airlines Pilots Approve New Contract／Allied Pilots Association (APA)',
      url:         'https://www.alliedpilots.org/Services/View-FullArticle?ArticleId=11662',
      published_at:'2023-08-21',
      accessed_at: '2026-08-09',
      value_orig:  null,
      quote:       "On average, pilots will see an immediate pay raise of more than 21%. Combined with increases in pilots' 401(k) contributions and subsequent pay raises each May, pilot compensation rates rise by more than 46% during the contract's duration.",
      status:      'candidate',
      note:        '当該組合（APA）公式。HTTP 200・見出し・日付・引用を実取得で確認済み。'
                 + '⚠️ 上昇率しか書かれておらず絶対額が無いので、これ単体では cap/fo を支えられない。'
                 + '⚠️ negotiations.alliedpilots.org/Contract2023 は名前解決しない（死亡）ので使わない。',
    },
    {
      rank:        'cap',
      source_type: 'union_cba',
      name:        'pilot contract COMPARISON — DELTA p.25「2025 12-Year Captain Pay Comparison」American 欄',
      url:         'https://dal.alpa.org/Portals/1/ThemePluginPro/uploads/2025/9/2/DALContractComparison-2026.pdf',
      published_at:null,
      accessed_at: '2026-08-09',
      value_orig:  'American 12年目機長・時間あたり $465.13（B-777 / B-787）〜 $375.28（A-321・A-320・A-319・B-737-MAX8・B-737-800）。'
                 + '中間: A-321neo・B-737-MAX10 $389.34。B-737-MAX9 に American の料率は無い（United 欄のみ）',
      quote:       '12-Year Captain rates, effective January 1, 2025',
      status:      'in_use',
      note:        'PDF原本から機械抽出。American の Pay Rate 欄は x=384（座標で列を確定）。'
                 + '⚠️ 他組合（Delta MEC）が作った比較表。APA（当該組合）公式の料率表が取れたら置き換える。',
    },
    {
      rank:        'fo',
      source_type: 'union_cba',
      name:        'pilot contract COMPARISON — DELTA p.26「2025 12-Year First Officer Pay Comparison」American 欄',
      url:         'https://dal.alpa.org/Portals/1/ThemePluginPro/uploads/2025/9/2/DALContractComparison-2026.pdf',
      published_at:null,
      accessed_at: '2026-08-09',
      value_orig:  'American 12年目副操縦士・時間あたり $317.73（B-777 / B-787）〜 $256.33（A-321・A-320・A-319・B-737-MAX8・B-737-800）。'
                 + '中間: A-321neo・B-737-MAX10 $265.92。B-737-MAX9 に American の料率は無い（United 欄のみ）',
      quote:       '12-Year First Officer rates, effective January 1, 2025',
      status:      'in_use',
      note:        '同上（p.26・x=384）。APA 公式の料率表が取れたら置き換える。',
    },
  ],

  // ── 日本 ──────────────────────────────────────────────────────────
  // ⚠️ ana / jal は conf:'high' だが、機長／副操縦士の実額を支える一次資料を
  //    まだ1件も特定できていない。有価証券報告書に載るのは全社員平均年収であって
  //    職種別ではないため、ANA/JAL の有報は cap/fo の根拠にならない（＝載せない）。
  //    REFERENCES の賃金構造基本統計調査も全操縦士平均で、会社別ではない。
  //    check-sources.mjs がこの2社を「出所ゼロ」として警告し続けるのが正しい状態。

  // ── 中東 ──────────────────────────────────────────────────────────
  // ★2026-09-26、エミレーツの一次資料が出た（下）。それまでここには
  //   「一次資料が出てこない場合、conf を medium に落とすことを検討する」と書いてあった。
  //   資料は出たが、まだ status:'candidate' のままにしてある ── 理由は下の note。
  //   candidate のあいだ check-sources.mjs は emirates を「出所ゼロ」として警告し続ける。
  //   それが今の正しい状態（オーナーが「年収に社宅の現物を含めるか」を決めるまで）。
  'emirates': [
    {
      rank:        'cap',
      source_type: 'official_package',
      name:        'Emirates Group Careers — Pilots / Our role details（Direct Entry Captains）',
      url:         'https://www.emiratesgroupcareers.com/pilots/our-role-details/?name=direct-entry-captains',
      published_at:null,
      accessed_at: '2026-09-26',
      value_orig:  '機長。Annual pay & benefits AED 1,185,000（USD 320,000）／'
                 + 'Annual take home cash AED 575,000（USD 155,000）／'
                 + 'Monthly take home cash AED 48,000（USD 13,000）。'
                 + '社宅は現物で AED 290,000（USD 80,000）相当。最低総飛行時間 7000+、ELP 5 以上。',
      quote:       'Annual take home cash',
      status:      'candidate',
      note:        '⚠️ このページは金額を3つの意味で出しており、取り違えると2倍ずれる。'
                 + '(1) Annual take home cash＝"annualised basic salary & flying pay"（月85時間の乗務を前提）。'
                 + '(2) Annual pay & benefits＝(1)に社宅・学費・医療・航空券・年金を足した総額で、'
                 + '「employee, spouse and 2 eligible children」を前提にした値。'
                 + '(3) 社宅そのものの金額。'
                 + '円に直すと（fx-rates.mjs の USD 158.95）'
                 + '(1)＝約2,464万円・(2)＝約5,086万円・(1)+(3)＝約3,735万円。'
                 + 'SALARY の cap は 3,350〜5,050万（avg 3,700万）なので、'
                 + '(1) 単独では下に外れ、(1)+(3) がほぼ avg に一致する。'
                 + '＝いまの SALARY は「現金＋社宅の現物」を年収と見ている可能性が高い。'
                 + '★ status を in_use に上げない。上げた瞬間に check-sources.mjs の'
                 + '「conf:high なのに出所ゼロ」警告が消えるが、'
                 + '「年収に社宅の現物を含めるか」はサイト全体の定義の問題で、まだ決まっていない'
                 + '（給与レポートの年収は総支給＝現金）。workflows/update-salary.md で判断する。',
    },
    {
      rank:        'fo',
      source_type: 'official_package',
      name:        'Emirates Group Careers — Pilots / Our role details（First Officers）',
      url:         'https://www.emiratesgroupcareers.com/pilots/our-role-details/?name=first-officers',
      published_at:null,
      accessed_at: '2026-09-26',
      value_orig:  '副操縦士（standard package）。Annual pay & benefits AED 900,000（USD 245,000）／'
                 + 'Annual take home cash AED 385,000（USD 105,000）／'
                 + 'Monthly take home cash AED 32,100（USD 8,750）。'
                 + 'enhanced package は AED 935,000（USD 255,000）／AED 415,000（USD 115,000）／'
                 + 'AED 34,600（USD 9,600）で、条件は総飛行時間 4,000時間以上（>20T ジェット）かつ'
                 + 'MTOW>50T の多人数運航ジェットで 2,000時間以上・ELP 5 以上。'
                 + '社宅は現物で AED 225,000（USD 61,310）相当。最低総飛行時間 2000+、ELP 4 以上。',
      quote:       'Annual take home cash',
      status:      'candidate',
      note:        '機長側と同じ理由で candidate（上の note を参照）。'
                 + '円に直すと Annual take home cash＝約1,669万円・'
                 + 'Annual pay & benefits＝約3,894万円・現金＋社宅＝約2,643万円。'
                 + 'SALARY の fo は 2,500〜3,350万（avg 2,800万）で、ここでも現金＋社宅が近い。',
    },
  ],

  // ★2026-09-26、エティハドも金額が出た。ただし在りかが2つに割れている ──
  //   福利厚生ページ（careers.etihad.com/teams/pilots）は
  //   「…basic salary, flying pay, housing allowance, and layover and meal allowances.」で文が終わる。
  //   求人広告は同じ文が「…, with the potential to earn up to AED … per year based on
  //   75 flying hours per month.」と続く。**同じ文の続きに金額がある。**
  //   福利厚生ページだけを見て「金額なし」と結論しない。
  'etihad': [
    {
      rank:        'fo',
      source_type: 'job_posting',
      name:        'Etihad Airways — First Officer A320（SmartRecruiters・ref 80372）',
      url:         'https://jobs.smartrecruiters.com/EtihadAirways5/744000140889248-first-officer',
      published_at:'2026-07-31',
      accessed_at: '2026-09-26',
      value_orig:  '副操縦士。年額 最大 AED 513,732（USD 138,318）／月75時間の乗務を前提。'
                 + '内訳は basic salary ＋ flying pay ＋ housing allowance ＋ layover and meal allowances の4つ。'
                 + '要件は2つのうちどちらか ── A: 総2,000時間かつ多人数運航ガラスコックピット1,500時間かつ'
                 + '同型500時間／B: 総1,500時間かつ A320 系 1,000時間。'
                 + '加えて直近12か月に A320 系を飛んでいること・ICAO の ATPL または凍結 ATPL・'
                 + '第1種身体検査・入社日に50歳未満・ICAO English Level 4 以上。年休42日。非課税と明記。',
      quote:       'with the potential to earn up to AED 513,732 (USD 138,318) per year based on 75 flying hours per month',
      status:      'in_use',
      note:        'fx-rates.mjs の AED 43.2825 で約2,224万円。SALARY の fo は 1,900〜3,100万なので'
                 + 'レンジの中（真ん中 2,300万のすぐ下）に入る＝レンジを支える根拠として採用する。'
                 + '⚠️ **「年収」と書き写さない。** 2つの条件が付いている ──'
                 + '(1)「up to」＝最大。(2) 月75時間飛んだ場合。75時間は上限に近い飛び方なので、'
                 + '普通の月の実額はこれより下がる。'
                 + '⚠️ **含まれていないものがある** ── 教育手当（初等 AED 40,000／中等 AED 55,000・3人まで）・'
                 + '所得補償・保険・社員割引航空券・退職金・引越し支援は、同じページで別立ての箇条書きになっている。'
                 + '★エミレーツと違い、住宅は「手当（現金）」なので、これは現金に近い性質の数字。'
                 + 'エミレーツの社宅は現物なので、2社を並べるときに同じものとして足さない。',
    },
    {
      rank:        'cap',
      source_type: 'job_posting',
      name:        'Etihad Airways — Captain A320（SmartRecruiters・ref 80371）',
      url:         'https://jobs.smartrecruiters.com/EtihadAirways5/744000140889348-captain',
      published_at:'2026-07-31',
      accessed_at: '2026-09-26',
      value_orig:  '機長。年額 最大 AED 674,029（USD 181,589）／月75時間の乗務を前提。内訳は副操縦士と同じ4つ。'
                 + '要件は 総5,500時間・多人数運航ガラスコックピットの PIC 2,500時間・A320 系の PIC 1,500時間・'
                 + '直近12か月に A320 系・ICAO の ATPL・第1種身体検査・入社日に59歳未満・'
                 + 'ICAO English Level 4 以上。交代要員つきの便は75%換算。年休42日。',
      quote:       'with the potential to earn up to AED 674,029 (USD 181,589) per year based on 75 flying hours per month',
      status:      'candidate',
      note:        '約2,917万円で、SALARY の cap 3,000〜6,000万 の**下端をわずかに下回る**（差 約83万円・2.8%）。'
                 + '上の副操縦士と同じく「最大・月75時間」の条件付きで、'
                 + '教育手当・退職金・保険・航空券が含まれていないぶん低く出ていると考えられる。'
                 + '外れ方が小さく説明も付くので SALARY は動かさないが、'
                 + 'レンジの下端を支える根拠としては採用しない（＝candidate のまま）。'
                 + '⚠️ 参考：同社の訓練生は月額で明記されている'
                 + '（AED 5,000 →（技能試験合格後）16,667 →（路線訓練後）24,000 → 4年で上限 34,000 →'
                 + 'ATPL 取得で上級副操縦士 39,853）。SALARY に訓練生の段は無いので数値には使わない。',
    },
  ],

  // ── アジア ────────────────────────────────────────────────────────
  // キャセイは今回当たった14社のうち、公式が職位別の年収額を出している唯一の会社。
  // しかも SALARY のレンジの中に入った＝この台帳で初めて、公開情報が公開情報を裏づけた。
  'cathay-pacific': [
    {
      rank:        'fo',
      source_type: 'official_package',
      name:        'Cathay Pacific Careers — Our teams / Pilot（First Officer パネル）',
      url:         'https://careers.cathaypacific.com/en/careers/our-teams/pilot/pilot-detail-page',
      published_at:null,
      accessed_at: '2026-09-26',
      value_orig:  'First Officer: Target Annual Salary HKD 964,646＊／Monthly allowance From HKD 20,000＊／'
                 + 'Annual leave 28 days／最低総飛行時間 1,500時間（3,000時間が望ましい）・うち P1 500時間以上'
                 + '（P1 U/S は最大250時間まで）／ICAO English Level 4 以上。'
                 + '同じページの Second Officer は Target Annual Salary HKD 629,109＊／'
                 + 'Monthly Allowance From HKD 14,000＊／Annual Leave 21 days／最低250時間。',
      quote:       'Target Annual Salary based on achieving Target Annual Block Hours',
      status:      'in_use',
      note:        '＊は同ページの脚注 "Latest figures as of Jan 2026, subject to periodic review" を指す。'
                 + '⚠️ 保証額ではない ── 目標ブロックアワーを飛んだ場合の目標年収。'
                 + 'fx-rates.mjs の HKD 20.2744 で約1,956万円。SALARY の fo は 1,800〜3,230万なので'
                 + 'レンジの中（下寄り）に入る＝レンジの下端側を支える根拠として採用する。'
                 + '⚠️ 機長の金額はこのページに無い（Cadet / Second Officer / First Officer の3職位のみ）。'
                 + 'SALARY の cap を支える出所はまだ無い。'
                 + '税の記述は "Typical Hong Kong tax rate at around 17%"。taxFree:false と矛盾しない。',
    },
  ],

  // ★スターラックスは公式の4つの募集ページに給与の語が1つも無い（薪・待遇・福利・salary で0件）。
  //   台湾の上場企業なので法定開示に金額はあるが、**あれはパイロットの給与ではない。**
  //   ここに rejected で残すのは、次に調べた人が同じ数字を見つけて
  //   「公式の開示だから使える」と判断するのを止めるため。
  'starlux': [
    {
      rank:        'all',
      source_type: 'community_reference',
      name:        '内定者の実体験（2025年前半・機長歴10年で応募したパイロット本人の申告） — 本サイトの採用試験ガイドに掲載している月額の表',
      url:         'https://pilot-value.com/airlines/starlux-tenshoku.html',
      published_at: null,
      accessed_at: '2026-09-28',
      value_orig:  '訓練中 約 NTD 285,000/月（50時間乗務分を含む）・昇格後 約 NTD 422,500〜/月（75時間乗務保証を含む）・住宅手当 NTD 30,000/月・交通費 NTD 1,000/月・13ヶ月給与・75時間超は約 NTD 5,500/H。',
      quote:       '昇格後（機長歴10年目安） 約 NTD 422,500〜 / 月 75時間乗務保証含む',
      status:      'candidate',
      note:        "★**2026-09-28、オーナーの判断でこの月額を正として SALARY を合わせた。** 旧値は cap 2,000〜3,900万（平均2,800万）／fo 1,200〜1,700万（平均1,500万）で、**どこから来た数字か記録が残っていなかった**（スターラックスは公式に給与額を一切出していない＝同じ台帳の rejected の行を参照）。計算は TWD/JPY = 4.9966（fx-rates.mjs の AS_OF 2026-08-22）で、cap.lo = 422,500×13ヶ月 = ¥2,744万 → **2,750万**／fo.lo = 285,000×13ヶ月 = ¥1,851万 → **1,850万**／fo.hi = それに住宅・交通手当の年額 372,000 を足して ¥2,037万 → **2,050万**。cap.hi は動かしていない（3,900万のまま・出どころは元から不明）。cap.avg 3,100万 と fo.avg 1,950万 はレンジの中で置いた値で、資料が支えているものではない。⚠️ **この行は status:'candidate' のまま置く。** 出どころは公式でも法定開示でもなく本人1名の申告で、しかも「機長歴10年」という1点の条件が付いている。fo.lo に使った 285,000 は**機長候補者の訓練中**の額であって副操縦士の給与そのものではない（＝副操縦士の実額はいまも1件も無い）。⚠️ **75時間超の割増（NTD 5,500/H）は一切足していない。** 足せば上限はさらに上がるが、飛んだ時間が分からないので計算できない。★次にやるべきは、この会社の一次データ（本人の給与レポート）を1件でも集めること。",
    },
    {
      rank:        'all',
      source_type: 'regulatory_filing',
      name:        '台湾証券取引所 公開API — 上市公司ESG資訊揭露彙總資料・人力發展（公司代號 2646 星宇航空・報告年度 114＝2025年度）',
      url:         'https://openapi.twse.com.tw/v1/opendata/t187ap46_L_5',
      published_at:'2026-09-26',
      accessed_at: '2026-09-26',
      value_orig:  '員工薪資平均數 1,137 千台湾ドル／人（約568万円）・'
                 + '非擔任主管職務之全時員工薪資平均數 1,115 千台湾ドル（前年比 +1.83%）・'
                 + '非擔任主管之全時員工薪資中位數 722 千台湾ドル（約361万円・前年比 +1.26%）・'
                 + '員工福利平均數 1,312 千台湾ドル（約656万円）。',
      quote:       '非擔任主管之全時員工薪資中位數(仟元/人) 722',
      status:      'rejected',
      note:        '★**パイロットの給与ではないので使わない。** 客室乗務員・地上職・整備を含む'
                 + '全職種の平均と中央値。中央値 722 が平均 1,115 を大きく下回るのは、'
                 + '人数の多い低賃金の職種に引っ張られているため（公開說明書の2024年時点で'
                 + '飛航員 318人に対し空服員 1,094人・全体 4,534人）。'
                 + 'パイロットが平均を押し上げる側にいるのはほぼ確実だが、それは推測なので数値にできない。'
                 + '⚠️ **この開示は4つの数字を並べており、系列が2本ある。混ぜると取り違える。**'
                 + '「非擔任主管」（管理職を除く）の系列＝平均 1,115・中央値 722。'
                 + '「員工」（管理職を含む全社員）の系列＝薪資 1,137・福利 1,312。'
                 + '**比べてよいのは同じ系列の中だけ**（722 の相手は 1,115。1,137 ではない）。'
                 + '2026-09-27、この注記が 722 と 1,137 を並べていたために、'
                 + '比較ページの日英2枚が「非管理職の平均 1,137」と書いて公開前に見つかった。'
                 + '⚠️ 「福利」（1,312）と「薪資」（1,137）を取り違えない。福利のほうが高い。'
                 + '⚠️ MOPS の画面（t100sb15）は JavaScript 駆動でエラーページに飛ぶ。'
                 + '同じデータは上の公開API から取れる。',
    },
  ],

  'eva-air': [
    {
      rank:        'fo',
      source_type: 'job_posting',
      name:        'EVA Air — About EVA Air / Careers / Job openings / Pilots（en-global）',
      url:         'https://www.evaair.com/en-global/about-eva-air/careers/job-openings/pilots/',
      published_at:null,
      accessed_at: '2026-09-26',
      value_orig:  '副操縦士。年収 USD 100,000 超（初回の運航から適用。手当・補助は別計算）。'
                 + '会社業績に応じた年末賞与、住宅補助または社宅、月8日連続の休み、'
                 + '年次有給 22日から最大42日、最低総飛行時間 2,000時間・'
                 + '多人数運航ジェット（MTOW 20t 超）500時間、ICAO ATPL、ICAO English Level 4、契約4年。',
      quote:       'Annual income exceeding USD 100,000, effective from your first operational flight.',
      status:      'candidate',
      note:        '⚠️ SALARY と食い違う。fx-rates.mjs の USD 158.95 で約1,589万円だが、'
                 + 'SALARY の fo は 600〜1,180万（avg 980万）＝公式の下限がうちの上限を約35%上回る。'
                 + '公式が4年契約で外から採る副操縦士の待遇で、SALARY が現地採用を含む'
                 + '広い集団を見ているため、と考えられる（どちらも誤りとは限らない）。'
                 + 'オーナー判断待ちのため candidate。SALARY は動かさない。'
                 + '⚠️ 地域別のページで版が違う ── en-global / en-us / en-th はこの USD 表記、'
                 + 'en-sg / en-gb / en-au / zh-hk は古い "NTD$227,000 / NTD$157,500" のまま、'
                 + 'zh-tw / ja-jp / ko-kr / vi-vn は金額なし。'
                 + '★ NTD の数字は月額か年額かをエバー航空がどの言語でも書いていないので使わない'
                 + '（"per month" "月薪" "年薪" のどれも金額の近くに無いことを全言語で確認した）。',
    },
  ],

  /* ── 2026-09-26、アジア5社の公式サイト・公式求人・法定開示を全部当たった記録 ──
     ★ 5社とも、パイロットの給与額は公式のどこにも1文字も無かった。
       以下は「無い」ことと、「隣にある似た数字を金額として使ってはいけない」ことの記録。
       次に調べる人がゼロから同じ道を歩かないため、および全社員平均を
       パイロットの年収として流用しないために置いている（starlux と同じ扱い）。       */

  'china-airlines': [
    {
      rank:        'all',
      source_type: 'job_posting',
      name:        'China Airlines — Pilot Recruitment（英語版応募ポータル）',
      url:         'https://calcfec.china-airlines.com/PilotResume/enDefault.aspx',
      published_at:null,
      accessed_at: '2026-09-26',
      value_orig:  '金額の記載なし。要件のみ ── 機長 総飛行 5,000時間以上／商用ジェットPIC 1,000時間以上／'
                 + '同型機PIC 500時間以上、副操縦士 総飛行 1,500時間以上／同型機 500時間以上。'
                 + '両職位に共通で ATPL、直近18暦月の実飛行、第一種航空身体検査、ICAO English Level 4 以上、'
                 + '高卒以上、在職証明、無犯罪証明。',
      quote:       'A minimum of 5,000 total flight hours; including 1,000 PIC hours on commercial jet',
      status:      'rejected',
      note:        '金額・手当・休日の記述が1つも無いため、年収の根拠には使えない（要件だけ引ける）。'
                 + '⚠️ 応募区分は FIRST OFFICER の1つだけが表示されているが、CAPTAIN の要件ブロックは'
                 + 'HTML の中に style="display: none" で残っている＝要件は公式に書かれているが'
                 + '2026-09-26 時点では機長を募集していない形。'
                 + '⚠️ 中文版と機長の飛行時間が食い違う（中文版「民航機師」は 總飛時 3,500時間／'
                 + 'PIC 800時間、副駕駛 1,500時間）。記事に書くときは必ず「英語版の要件」と'
                 + '断る（外国籍が入れる道は英語版の1本だけで、中文版は全区分が'
                 + '「中華民國國籍及國內戶籍」を要求している）。'
                 + '⚠️ 英語版年報（2025・162ページ）を全文抽出したが、賃金は率だけで金額が無い'
                 + '（"The average salary for all employees of the Company increased by about 4.36% in 2025."）。'
                 + '賞与は団体協約41条の算式（年末に基本給1か月ぶん＋利益があれば税前利益の20%を'
                 + '別途配分、従業員報酬は税前利益の3%以上）で、やはり金額は無い。'
                 + '従業員総数 11,642人（2025年末）に職種別の内訳が無く、機師が何人かも書かれていない。'
                 + '桃園市機師工會との団体協約が2021-12-29に締結されたことは年報が認めているが、'
                 + '協約の本文は見つからなかった。台湾の法定開示項目「非擔任主管職務之全時員工薪資」は'
                 + '英語版年報に入っておらず MOPS 側にあるはずだが、今回は開けていない。',
    },
    {
      rank:        'all',
      source_type: 'job_posting',
      name:        'China Airlines — 機師招募（中文版応募ポータル）',
      url:         'https://calcfec.china-airlines.com/pilotresume/chdefault.aspx',
      published_at:null,
      accessed_at: '2026-09-26',
      value_orig:  '金額の記載なし。★公式が明記している拘束年限 ── 培訓機師 7年、CPL民間機師 4年、'
                 + '民航機師 3年または定年まで、軍方退役機師 4年。'
                 + '全5区分が「中華民國國籍及國內戶籍」を要求。',
      quote:       '軍方退役機師：按飛時經驗支薪；完訓合格後敘任為副機師。服務年限至少四年。',
      status:      'rejected',
      note:        '金額が無いため年収の根拠には使えない。'
                 + '★ quote の「按飛時經驗支薪」（飛行時間の経験に応じて支給）が、今回当たった'
                 + 'アジア5社の全ページの中で給与に触れた唯一の文。それでも金額は書かれていない。'
                 + '⚠️ 英語版は1区分・中文版は5区分と、同じサイトで版が違う（上のエントリ参照）。'
                 + '英語要件も公式に細かい ── 培訓機師は TOEIC Speaking / Writing とも140以上に加えて'
                 + 'IELTS 6.0 / TOEIC 750（Listening 400以上）/ TOEFL ITP 527 / Linguaskill 160 の'
                 + 'いずれか。同一区分の受験は2回まで（「報名同一類別機師以兩次為限。」）。',
    },
  ],

  'hong-kong-express': [
    {
      rank:        'all',
      source_type: 'official_package',
      name:        'HK Express — About Us / Our People / Pilots（公式の待遇紹介ページ）',
      url:         'https://www.hkexpress.com/en/About-Us/Our-People/Pilots',
      published_at:null,
      accessed_at: '2026-09-26',
      value_orig:  '金額の記載なし。福利の項目名だけ ── Medical Insurance／Loss of Income Insurance／'
                 + 'Staff Travel Benefits (UO, CX and interline)／Up to 35-day Leave／Bonus／'
                 + 'Relocation Assistance。このページで唯一の数字が休暇の「最大35日」。'
                 + '賞与は有無だけで率も月数も無い。飛行時間の要件も無い。',
      quote:       'Up to 35-day Leave',
      status:      'rejected',
      note:        '⚠️ 上の項目名は「カードの見出し語」であって文章ではない。'
                 + '記事で引くときは箇条書きの項目名として引き、文のように繋がない。'
                 + '金額が無いため年収の根拠には使えない。'
                 + '⚠️ 求人検索（https://careers.hkexpress.com/cw/en/search/?search-keyword=Pilot）は'
                 + '2026-09-26 時点でコックピットの募集が "Line Training Captain (Internal Application)" の'
                 + '1件だけ（カテゴリのラベルは "Cockpit (0)" / "Flight Operations (1)"）。'
                 + '詳細ページは PageUp のボット対策で HTTP 202・0バイトが返り、本文は取得できなかった。'
                 + '過去の A320 First Officer の求人URLは全て jobnotfound へリダイレクト＝掲載終了。'
                 + '★ 公式ページが外国籍の副操縦士を実名で紹介しており、'
                 + '「ターボプロップの機長が副操縦士として入る」道が公式に読める（記事に使える事実）。',
    },
  ],

  'vietnam-airlines': [
    {
      rank:        'all',
      source_type: 'regulatory_filing',
      name:        'Vietnam Airlines — Báo cáo thường niên 2025（2025年 年次報告書・119ページ）',
      url:         'https://www.vietnamairlines.com/content/dam/vna/vna-footer/investor-relations/bao-cao-thuong-nien/2026/BCTN2025.TIENGVIET.pdf',
      published_at:null,
      accessed_at: '2026-09-26',
      value_orig:  '★ パイロット人数は正確に開示されている ── 2025-12-31 時点の運航パイロット'
                 + '（VASCO 込み）1,055人、うち機長 532人・副操縦士 523人、'
                 + 'ベトナム人 966人（91.60%）・外国人 99人（9.40%）。'
                 + '2025年に副操縦士から機長へ昇格したのは20人（計画20人・達成100%）、機種移行は112人。'
                 + '⚠️ 賃金は率だけで金額が無い。',
      quote:       'Tổng số phi công khai thác tại thời điểm 31/12/2025 (gồm cả phi công VASCO): '
                 + '1.055 phi công, trong đó: Lái chính: 532, Lái phụ: 523; '
                 + 'Phi công Việt Nam: 966 (91,60%), Phi công nước ngoài: 99 (9,40%).',
      status:      'rejected',
      note:        '★ 金額の根拠としては使えない（rejected はそのため）が、'
                 + '**パイロットの人数と機長／副操縦士の内訳が公式に出ている唯一の会社**。'
                 + '記事では「1,055人中 機長532・副操縦士523、外国人は9.4%」として引ける。'
                 + '⚠️ 賃金に触れた文は率だけ ── 「Thu nhập bình quân đã tăng hơn 25% so với năm 2019, '
                 + 'trong khi tiền lương bình quân tăng gần 40%.」（2019年比で平均収入+25%超・'
                 + '平均賃金+40%近く）。**全社員の率であってパイロットの数字ではない。**'
                 + '⚠️ 採用サイトは JavaScript の殻で HTML に求人が1件も入っていない。'
                 + 'サーバー側で描画される本物の一覧は https://skyhr.vietnamairlines.com/jobs で、'
                 + '2026-09-26 時点の21件にパイロットの募集は1件も無い。'
                 + '全ての行に「Mức lương: Thỏa thuận」（給与：応相談）とだけ書かれている。',
    },
  ],

  'vietjet': [
    {
      rank:        'all',
      source_type: 'regulatory_filing',
      name:        'VietJet Air — Báo cáo thường niên 2025（2025年 年次報告書・123ページ）',
      url:         'https://ir.vietjetair.com/File_Upload/thong-tin-tai-chinh/bao-cao-thuong-nien-parent/bao-cao-thuong-nien/20260417_VJC_AR2025_VN_Final%201.pdf',
      published_at:null,
      accessed_at: '2026-09-26',
      value_orig:  '⚠️ 出ているのは全社員の平均月収であってパイロットの給与ではない。'
                 + '従業員総数 7,632人、職種別は 客室乗務員 27.92%／パイロット 12.47%／その他 59.60%。'
                 + '平均収入のグラフは単位「triệu đồng/người/tháng」（百万ドン/人/月）で、'
                 + '値は 14,2 / 23,0 / 38,1 / 46,1 / 47,6 / 50,5、人数は 5.701 / 6.541 / 5.467 / '
                 + '5.338 / 5.729 / 7.632（年ラベルは 2020〜2025）。',
      quote:       'Theo công việc: Tiếp viên 27,92% / Phi công 12,47% / Nhân sự khác 59,60%',
      status:      'rejected',
      note:        '★ この平均月収を「パイロットの給与」として使わない。3つ理由がある ── '
                 + '(1) 全社員の平均で、パイロットは 12.47% しかいない。'
                 + '(2) 年と値の対応がグラフ抽出のため崩れていて、本文で裏が取れているのは'
                 + '7.632＝2025年（総数の記述と一致）だけ。そこから 50,5 が2025年だと考えられるが'
                 + 'こちらの推測なので、使うならオーナーが PDF を目視で確認する必要がある。'
                 + '(3) 報告書は「thu nhập」（収入）と「tiền lương」（賃金）を使い分けているが、'
                 + '福利厚生込みかどうかの定義は書かれていない。'
                 + '○ 単位に「/tháng」（月）が明記されている点だけは良い'
                 + '（エバー航空の NTD で踏んだ「期間が書いていない」罠には当たらない）。'
                 + '⚠️ 求人側 ── 2026-09-26 時点でパイロットの募集は0件'
                 + '（部門ラベルが "Pilots (0)"）。掲載終了の A320/A321F の募集要項は本文が残っており、'
                 + '**「Salary:」という欄そのものは在るのに値が空**（隠しているのではなく最初から'
                 + '書いていない）。要件は機長 総4,000時間／多人数機PIC 1,500時間（PICUS除く）／'
                 + 'A320F 1,500時間／A320F PIC 500時間、副操縦士 総4,000時間／A320F 1,500時間。'
                 + 'https://jobs.vietjetair.com/Jobs/Vacancy/2517（Open 2025-02-14／Close 2025-02-17）。',
    },
  ],

  'philippine-airlines': [
    {
      rank:        'all',
      source_type: 'job_posting',
      name:        'Philippine Airlines — Careers / Pilot And Cabin',
      url:         'https://careers.philippineairlines.com/go/Pilot-And-Cabin/734544/',
      published_at:null,
      accessed_at: '2026-09-26',
      value_orig:  '金額も要件も1文字も無い。2026-09-26 時点でパイロットの募集が0件。',
      quote:       'There are currently no open positions matching this category or location.',
      status:      'rejected',
      note:        '公式に出ている情報が何も無い会社。記事では「公式には金額を出していません」で通す。'
                 + '⚠️ aboutus/careers 系の旧URLは2本とも HTTP 404。生きているのは careers. 側だけ。'
                 + '⚠️ PAL Holdings の 17-A（法定開示）は PSE EDGE の JavaScript ビューアの奥にあり開けなかった。'
                 + '★★ フィリピン統計庁（psa.gov.ph / psada / openstat）は全て 403・Cloudflare で'
                 + '1ページも開けていない。検索結果のスニペットに 2024年 Occupational Wages Survey の'
                 + '航空機パイロット平均月額として **PhP 137,999** という数字が見えたが、'
                 + '**公式ページを開けていない＝未検証。記事に使わない。**'
                 + '（オーナーがブラウザで PSA を開ければ一次資料として取れる見込み）'
                 + '⚠️ ALPAP（フィリピンのパイロット組合）の団体協約の本文は、'
                 + 'ALPAP のドメインにも DOLE にも見つからなかった。',
    },
  ],

  'singapore-airlines': [
    {
      rank:        'all',
      source_type: 'job_posting',
      name:        'Singapore Airlines — Direct Entry Captains (Contract)（公式求人・req 57638244）',
      url:         'https://careers.singaporeair.com/sia/job/Direct-Entry-Captains-%28Contract%29/57638244/',
      published_at:null,
      accessed_at: '2026-09-26',
      value_orig:  '金額の記載なし。★金額以外の条件はかなり具体的に公開されている ── '
                 + '機長 総飛行 7,000時間以上（うち国際線の商用ジェットPIC 3,000時間以上、'
                 + 'A350 か A380 のPIC 1,500時間以上）、機長として同型機で2年以上。'
                 + '副操縦士 副操縦士として3,000時間が望ましく1,500時間以上も可（ただし A350／A380 で'
                 + '1,500時間以上は必須）、同型機で2年以上。'
                 + '両職位に共通で ICAO English Level 5 以上、身長 1.58m 以上、'
                 + '契約は最長12か月の有期。訓練生は副操縦士に任命された日から7年の拘束。',
      quote:       'Minimum height requirement of 1.58m to ensure full reach and the safe operation of '
                 + 'all flight deck controls',
      status:      'rejected',
      note:        '金額が1つも無いため年収の根拠には使えない（日額・月額・年額のいずれも無し）。'
                 + '⚠️ **機長と副操縦士の求人ページには「報酬」の節そのものが無い**（節は Selection Process／'
                 + 'Training／Tenure of Service だけで、competitive も attractive も出てこない）。'
                 + '金銭に触れているのは案内ページの「more than just a competitive salary」と'
                 + '訓練生の「an attractive salary」だけで、どちらも金額なし。'
                 + '案内ページで数えられる待遇はすべて金銭以外（年1回の無償搭乗・割引搭乗・'
                 + '医療と歯科と保険・訓練と昇進機会）。年休の日数は書かれていない。'
                 + '⚠️ 2026-09-26 時点で生きている募集は3件（Direct Entry Captains (Contract)／'
                 + 'Direct Entry First Officers (Contract)／Ab Initio Cadet Pilot (Singapore)）。'
                 + 'Direct Entry Second Officer は「currently closed」と明示されている。'
                 + '⚠️ ICAO English は Level 5 以上＝エティハドやスターラックスの Level 4 より厳しい'
                 + '（記事で比べられる公式の事実）。'
                 + '⚠️ 地域版の違いは未確認（米国・英語版が返ってきた）。',
    },
  ],

  'gulf-air': [
    {
      rank:        'all',
      source_type: 'job_posting',
      name:        'Gulf Air — Careers（公式採用ページ／採用システムは gulfairgroup.sniperhire.net）',
      url:         'https://www.gulfair.com/careers',
      published_at:null,
      accessed_at: '2026-09-26',
      value_orig:  '金額の記載なし。★それ以前に、2026-09-26 時点でパイロットの募集が1件も無い。'
                 + '掲載中の求人10件を全件列挙してパイロット職ゼロを確認し、'
                 + 'さらに pilot／captain／first officer の3語で検索して3回とも'
                 + '「No vacancies were found.」。求人テンプレートの待遇欄は1行だけ。',
      quote:       'Competitive salary package.',
      status:      'rejected',
      note:        '金額も要件（飛行時間・免許・英語・年齢）も、募集そのものが無いため公式には1つも無い。'
                 + '記事では「公式には金額を出していません」で通し、要件の数字を埋めない。'
                 + '⚠️ 検索エンジンに出てくる jobs.gulfair.com と careers.gulfair.com は'
                 + '**DNS が引けない**（Could not resolve host）。生きている採用システムは'
                 + 'https://gulfairgroup.sniperhire.net/ で、次に調べる人はそこを見る。'
                 + '⚠️ 組合（GAPTU）との労働協約のプレスリリース（2024-07-27・'
                 + 'https://www.gulfair.com/about-gulf-air/media-center/Gulf-Air-signs-a-Collective-Labour-Agreement-with-Gulf-Air-Pilots-Trade-Union-GAPTU ）は'
                 + '「手当の条件がまとまった」と伝えるだけで**金額が1つも書かれていない**。'
                 + '組合サイト gaptu.com は 1,577バイトの仮ページで、組合名と連絡先メールしかない'
                 + '（協約の本文も待遇表も非公開）。',
    },
  ],

  'scoot': [
    {
      rank:        'all',
      source_type: 'job_posting',
      name:        'Scoot — Careers（公式採用サイト／到達できず）',
      url:         'https://careers.flyscoot.com/',
      published_at:null,
      accessed_at: '2026-09-26',
      value_orig:  '取得できず。公式ページを1枚も開けていないため、金額も要件も未確認。',
      quote:       '',
      status:      'rejected',
      note:        '★ careers.flyscoot.com は全URLが HTTP 403（Akamai のボット遮断）で、'
                 + 'ブラウザ相当のヘッダを付けた curl でも同じ。flyscoot.com 側の採用パスは'
                 + '空または404。web.archive.org も使えず、控えも取れなかった。'
                 + '確認できたのは検索結果に出ていた**求人のタイトルだけ**'
                 + '（Direct Entry A320 Captain 2026 (Singapore Assessment Centre)／'
                 + 'Direct Entry First Officer 2026／Direct Entry B787 Captain 2026）。'
                 + '⚠️ **飛行時間・ICAO レベル・身体検査・年齢・金額のどれも、'
                 + 'スクートの名前で書いてはいけない。** まとめサイトには数字が流れているが、'
                 + '公式で裏が取れていない。記事では「公式には金額を出していません」で通す。'
                 + '（親会社のシンガポール航空とは別会社なので、あちらの条件を当てない）',
    },
  ],

  'riyadh-air': [
    {
      rank:        'all',
      source_type: 'job_posting',
      name:        'Riyadh Air — Careers / Pilots（公式採用ページ／到達できず）',
      url:         'https://www.riyadhair.com/en/careers/pilots',
      published_at:null,
      accessed_at: '2026-09-26',
      value_orig:  '取得できず。公式ページを1枚も開けていないため、金額も要件も未確認。',
      quote:       '',
      status:      'rejected',
      note:        '★ riyadhair.com は全URLが HTTP 403（Akamai）。Chrome／Safari／Googlebot／iPhone の'
                 + '4種のユーザーエージェント、www の有無も試して全部同じ。'
                 + '⚠️ 採用システム側（pilots-riyadhair.icims.com）の機長・B787副操縦士の求人は'
                 + '2件とも 302 で汎用の採用トップへ飛ぶ＝**掲載が取り下げられている**。'
                 + 'talentcommunity.riyadhair.com の職種一覧に運航乗務の区分は無く、'
                 + '出てくるのは Human Resources だけ。'
                 + '⚠️ **飛行時間・免許・ICAO レベル・年齢・身体検査・非課税パッケージの'
                 + 'どれも、リヤド航空の名前で書いてはいけない。** 流通している数字は'
                 + 'すべてまとめサイト由来で、公式では1つも裏が取れていない。'
                 + '公式ドメインから唯一取れた文は詐欺注意の一文だけ ── '
                 + '「Riyadh Air will only engage with potential applicants through our official '
                 + 'channels and that Riyadh Air would never request any payments or personal bank '
                 + 'details during the application process.」',
    },
  ],
};

export default SOURCES;
