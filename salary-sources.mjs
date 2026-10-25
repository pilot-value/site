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
  {
    // ★2026-10-05（会社ページ改良・主要5社の調べ）。JAL・ANA の機長／副操縦士の推定を
    //   組み立てられるかを見るために読んだ。結論は「組み立てられない」── 下の note。
    id:          'jp-wage-census-r7-pilots-by-age',
    scope:       'JP 全国・航空機操縦士（企業規模1,000人以上・男女計・年齢階級別）',
    rank:        'all',
    source_type: 'government',
    name:        '令和7年賃金構造基本統計調査（職種）第1表・第5表 職種（小分類）、年齢階級別きまって支給する現金給与額、所定内給与額及び年間賞与その他特別給与額（産業計）／厚生労働省',
    url:         'https://www.e-stat.go.jp/stat-search/files?stat_infid=000040421120',
    published_at:'2026-03-24',
    accessed_at: '2026-10-04',
    // 年額は「きまって支給する現金給与額 × 12 ＋ 年間賞与その他特別給与額」。掛け算はこちらの計算で、表には無い。
    value_orig:  '企業規模1,000人以上・全年齢（第1表）きまって支給 1,259.1千円/月・年間賞与 1,686.8千円 → 年額 16,796.0千円。'
               + '年齢階級別（第5表・1,000人以上）── '
               + '30〜34歳 943.2／1,040.9 → 12,359.3千円｜'
               + '35〜39歳 1,307.8／1,472.9 → 17,166.5千円｜'
               + '40〜44歳 1,675.4／1,951.5 → 22,056.3千円｜'
               + '45〜49歳 1,891.4／2,711.7 → 25,408.5千円｜'
               + '50〜54歳 1,846.0／2,462.0 → 24,614.0千円｜'
               + '55〜59歳 2,076.8／3,102.6 → 28,024.2千円。',
    quote:       '航空機操縦士 39.7 12.8 151 5 1226.1 1179.5 1604.3 835 39.4 13.7 151 5 1259.1 1207.9 1686.8 700',
    status:      'candidate',
    note:        '⚠️ **これは業界全体の数字で、どの会社の額でもない。** 年齢で切っても職位にはならない'
               + '（35〜39歳には機長になった人が、40〜44歳には副操縦士が混ざる。20代には訓練中の人が入る）。'
               + '年齢階級を労働者数で重みづけすると 40〜59歳で約2,544万円・30〜39歳で約1,393万円になるが、'
               + 'これを「JAL の機長」「ANA の副操縦士」の推定として出さない ── '
               + '会社を示す資料が1件も無く、根拠・算出方法・時点の3つのうち根拠が立たない。'
               + '使い道は令和6年の表と同じ（会社別の数字が国全体から大きく外れていないかの上位チェック）。'
               + '公開 xlsx の該当行を機械抽出（シート「男女計」・2026-10-04）。浮動小数の端数だけ小数1けたに丸めた。',
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
  // ★2026-09-26、エミレーツの一次資料が出た（下）。2026-10-24 までは status:'candidate' のままだった
  //   （「年収に社宅の現物を含めるか」がサイト全体の定義として決まっていなかったため）。
  // ★2026-10-25、オーナーが決めた（見直し案 P12.105 の質問1＝③）：推定年収＝会社が1年に払うものすべて。
  //   エミレーツは会社公表の「総待遇」（社宅込み）をそのまま推定年収にする。
  //   → SALARY を cap avg 3,700→5,130・hi 5,050→5,130／fo avg 2,800→3,900・hi 3,350→4,050 に直し、
  //     2件とも in_use に上げた（同じ日に公式ページを開き直して、金額と「総待遇」の定義の文を確かめた）。
  //   ⚠️ lo（機長3,350・副操縦士2,500）は前の値のまま（下げる向きは動かさない＝オーナーの決まり2）。資料の裏づけは無い。
  'emirates': [
    {
      rank:        'cap',
      source_type: 'official_package',
      name:        'Emirates Group Careers — Pilots / Our role details（Direct Entry Captains）',
      url:         'https://www.emiratesgroupcareers.com/pilots/our-role-details/?name=direct-entry-captains',
      published_at:null,
      accessed_at: '2026-10-25',
      value_orig:  '機長。Annual pay & benefits AED 1,185,000（USD 320,000）／'
                 + 'Annual take home cash AED 575,000（USD 155,000・annualised basic salary & flying pay）／'
                 + 'Monthly take home cash AED 48,000（USD 13,000・monthly basic & 85 hrs flying pay）。'
                 + '社宅は現物で AED 290,000（USD 80,000）相当。最低総飛行時間 7000+、ELP 5 以上。',
      quote:       'Enjoy a tax-free total package comprising of take home cash, schooling, medical, insurance, '
                 + 'annual leave tickets, housing and transport plus our Provident (pension) scheme employer contribution.',
      status:      'in_use',
      note:        '★ cap.avg と cap.hi（どちらも 5,130万）の根拠。AED 1,185,000 × 43.2825（fx-rates.mjs）＝ 約5,129万円 → 10万円単位で 5,130万。'
                 + '2026-10-25 のオーナー承認の見直し（P12.105・推定年収＝会社が1年に払うものすべて／エミレーツは総待遇ぜんぶ＝社宅込み）。'
                 + '数えたもの＝総待遇の全部：年間の現金（基本給＋月85時間の飛行手当）AED 575,000・会社の villa（現物・光熱費込み）AED 290,000・'
                 + '残り AED 320,000（送迎・学費手当〈子1人あたり初等 AED 52,250／中等 AED 79,750・最大3人〉・医療・保険・休暇の航空券・'
                 + 'Provident Fund の会社拠出〈基本給の12%〉。項目ごとの額は非公表）。'
                 + '⚠️ 総待遇は「employee, spouse and 2 eligible children」を前提にした評価額で、現物（社宅・医療・航空券）を含む。'
                 + '独身の人・子どもの無い人が実際に受け取る価値はこれより小さい。全機長の平均でも保証でもない（会社の募集例）。'
                 + '利益配分（条件つき・率の公表なし）は入っていない。'
                 + '金額の行は "Annual pay & benefits / AED 1,185,000"（2026-10-25 に原ページを開いて確認）。'
                 + '⚠️ cap.lo（3,350万）は前の値のまま（資料の裏づけ無し）。年間の現金だけなら AED 575,000 ＝ 約2,489万円で、'
                 + '会社ページ・一覧のカードはこの額を「公式募集例の現金給与」として別に出している（salary-basis.mjs）。'
                 + '2026-10-24 までの SALARY（avg 3,700万）は出所の記録が無かった。',
    },
    {
      rank:        'fo',
      source_type: 'official_package',
      name:        'Emirates Group Careers — Pilots / Our role details（First Officers）',
      url:         'https://www.emiratesgroupcareers.com/pilots/our-role-details/?name=first-officers',
      published_at:null,
      accessed_at: '2026-10-25',
      value_orig:  '副操縦士（standard package）。Annual pay & benefits AED 900,000（USD 245,000）／'
                 + 'Annual take home cash AED 385,000（USD 105,000）／'
                 + 'Monthly take home cash AED 32,100（USD 8,750）。'
                 + 'enhanced package は AED 935,000（USD 255,000）／AED 415,000（USD 115,000）／'
                 + 'AED 34,600（USD 9,600）で、条件は総飛行時間 4,000時間以上（>20T ジェット）かつ'
                 + 'MTOW>50T の多人数運航ジェットで 2,000時間以上・ELP 5 以上。'
                 + '社宅は現物で AED 225,000（USD 61,310）相当。最低総飛行時間 2000+、ELP 4 以上。',
      quote:       'Enjoy a tax-free total package comprising of take home cash, schooling, medical, insurance, '
                 + 'annual leave tickets, housing and transport plus our Provident (pension) scheme employer contribution. '
                 + 'Based on employee, spouse and 2 eligible children.',
      status:      'in_use',
      note:        '★ fo.avg（3,900万）＝ standard の総待遇 AED 900,000 × 43.2825 ＝ 約3,895万円。'
                 + '★ fo.hi（4,050万）＝ enhanced の総待遇 AED 935,000 ＝ 約4,047万円（経験条件を満たす副操縦士だけの額）。'
                 + '2026-10-25 のオーナー承認の見直し（機長の行と同じ定義：総待遇ぜんぶ＝社宅込み）。'
                 + '数えたもの＝総待遇の全部（現金 AED 385,000／415,000・社宅の現物 AED 225,000・残り AED 290,000／295,000＝送迎・学費手当・医療・保険・'
                 + '休暇の航空券・Provident Fund の会社拠出。項目ごとの額は非公表）。'
                 + '⚠️ 本人・配偶者・子2人を前提にした評価額で、現物を含む。全副操縦士の平均でも保証でもない（会社の募集例）。'
                 + '金額の行は "Annual pay & benefits / AED 900,000"・Enhanced "AED 935,000"（2026-10-25 に原ページを開いて確認）。'
                 + '⚠️ fo.lo（2,500万）は前の値のまま（資料の裏づけ無し）。現金だけなら standard AED 385,000 ＝ 約1,666万円。'
                 + '2026-10-24 までの SALARY（avg 2,800万）は出所の記録が無かった。',
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

  // ── 欧州 ──────────────────────────────────────────────────────────
  // ★2026-10-20、オーナーの判断で BA の副操縦士の推定を、BA 自身の 2026年の募集資料に載っている
  //   給与例に合わせた（fo: avg 1,660→2,590／lo 1,170→2,300／hi 2,460→3,400 万円）。
  //   同じ日に機長も同じ資料の給与例に合わせた（cap: avg 3,030→3,980／lo 2,020→3,320／hi 4,040→5,710 万円）。
  //   旧値の出どころは、この台帳には1件も記録が無かった。
  //   ⚠️ BA Cityflyer（別会社・E190）の機長の額（調査パックの r2-cityflyer-cap-*）は使っていない。
  //   資料は2つとも BA の公開募集（締切 2026-10-25）に添付された PDF で、ChatGPT の調査パック
  //   pvr-20261019-british-airways（rev 8・2026-10-20）が原画像で確かめたもの。
  //   ⚠️ こちらではまだ PDF を開いていない ＝ 3件とも candidate。
  //   ⚠️ SFO の PDF には社内向けの定型フッターがあるので、原本も画像もリポジトリに置かない（URL と事実だけ）。
  //   ⚠️ 金額はどれも「2026年8月に入社した人のキャリア例」。乗務手当（FPS・TAFB・DOA/NIA）を含み、
  //      年 713 ブロック時間＋有給の 72 時間を飛んだ前提。平均・保証・上限ではない。税引前後の記載なし。
  //   円は fx-rates.mjs の GBP 216.76（AS_OF 2026-08-22）で直した。
  // ★2026-10-25、オーナー承認の見直し（推定年収＝会社が1年に払うものすべて）で副操縦士だけ作り直した：
  //   fo avg 2,590→2,810万（短距離 SFO 4年目の給与例＋会社の年金拠出15%）・hi 3,400→3,910万（長距離 SFO 18年目＋15%）。
  //   機長は同じ作り方だと下がる（3,980→3,900万）ので今のまま。下の2026-10-25 の2行を見る。
  'british-airways': [
    {
      rank:        'fo',
      source_type: 'job_posting',
      name:        'British Airways — Short Haul Pilot Recruitment Pack 2026（募集 Ref 11673「Direct Entry Pilot - A320 Type Rated Pilot - UK Licence Holder」の添付 PDF）物理4頁 PILOT PAY',
      url:         'https://apply.ba.com/jobs/vacancy/direct-entry-pilot---a320-type-rated-pilot--uk-licence-holder-11673-heathrow-airport-london/11692/description/ajaxaction/downloadfile/?id=5002339',
      published_at:null,
      accessed_at: '2026-10-20',
      value_orig:  'SH Second Officer/First Officer の1年目 £106,259/年（会社の給与例）。'
                 + 'A320 の型式限定・UK Part-FCL・同型 500時間以上の経験者募集で、2026年8月入社者のキャリア例。'
                 + 'FPS・TAFB・DOA/NIA を含み、年 713 ブロック時間＋holiday pay 72時間・'
                 + '年 FPS £15,778・TAFB £10,180・DOA/NIA £900 を前提とする。税引前後の記載なし。',
      quote:       '£106,259',
      status:      'candidate',
      note:        '★ fo.lo（2,300万）の根拠。£106,259 × 216.76 ＝ 約2,303万円 → 2,300万。'
                 + '調査パックの記録 british-airways.pay.r6-a320-sh-sofo-example-y1'
                 + '（場所: 物理4頁 / PILOT PAY / Year 1 / SH Second Officer/First Officer）。'
                 + '⚠️ 見出しが「Second Officer/First Officer」の共通欄で、1年目がどちらの職位かを資料は分けていない'
                 + '（パックも rank を crew にしている）。副操縦士の下端として使うのはオーナーの判断。'
                 + '⚠️ 会社の給与例であって、在籍者全員の号俸表・実績の平均・保証・上限ではない。'
                 + '基本給を逆算しない。PDF をこちらで開いて引用を確かめるまで candidate のまま。',
    },
    {
      rank:        'fo',
      source_type: 'job_posting',
      name:        'British Airways — Senior First Officer Recruitment Pack 2026（募集 Ref 12234「Direct Entry Pilot - Senior First Officer - UK CAA licence holder」の添付 PDF）物理6–7頁 左欄',
      url:         'https://apply.ba.com/jobs/vacancy/direct-entry-pilot---senior-first-officer---uk-caa--licence-holder-12234-heathrow-airport-london/12253/description/ajaxaction/downloadfile/?id=5002331',
      published_at:null,
      accessed_at: '2026-10-20',
      value_orig:  'Long-haul Senior First Officer・BA 在籍18年 £156,789/年（会社の給与例・as of August 2026）。'
                 + '乗務手当の前提は上と同じ（年 713 ブロック時間＋holiday pay 72時間）。税引前後の記載なし。',
      quote:       '£156,789',
      status:      'candidate',
      note:        '★2026-10-25 から fo.hi は 3,910万（この £156,789 に会社の年金拠出 15% を足した £180,307 ＝ 約3,908万円。下の 2026-10-25 の行）。'
                 + '以下はその前（2026-10-20〜24）の記録。'
                 + '★ fo.hi（3,400万）の根拠。£156,789 × 216.76 ＝ 約3,399万円 → 3,400万。'
                 + '調査パックの記録 british-airways.pay.r6-aug2026-lh-sfo-18years'
                 + '（場所: 物理6–7頁 / 左欄 Long-haul Line Captain・Long-haul Senior First Officer）。'
                 + '同じ額は Short Haul の PDF 物理4頁の左欄にも載っているが、そちらは「as of June 2026」で'
                 + '職位の表記は First Officer（SFO と書いていない）。主な根拠は SFO の PDF（August 2026）のほう。'
                 + '⚠️ 在籍18年の1例であって、副操縦士の給与の上限ではない。PDF を開いて確かめるまで candidate。',
    },
    {
      rank:        'fo',
      source_type: 'job_posting',
      name:        'British Airways — Senior First Officer Recruitment Pack 2026 物理6–7頁 PILOT PAY（First seven years・Year 8 の分岐・左欄）＋ Short Haul Pilot Recruitment Pack 2026 物理4頁（Year 6 の分岐 LH SFO）── 副操縦士の給与例 17件',
      url:         'https://apply.ba.com/jobs/vacancy/direct-entry-pilot---senior-first-officer---uk-caa--licence-holder-12234-heathrow-airport-london/12253/description/ajaxaction/downloadfile/?id=5002331',
      published_at:null,
      accessed_at: '2026-10-20',
      value_orig:  '副操縦士の会社の給与例 17件（いずれも £/年）── '
                 + 'SH SFO Year 1〜7: 112,858／112,858／112,858／112,858／114,870／117,027／119,177｜'
                 + 'LH SFO Year 1〜7: 115,178／115,178／115,178／115,178／118,149／121,125／124,092｜'
                 + 'LH FO Year 8（分岐）: 127,067｜LH SFO 在籍18年: 156,789｜'
                 + 'Short Haul の PDF の LH SFO Year 6（分岐）: 121,125。'
                 + '17件の単純平均 £119,504（合計 £2,031,565）。',
      quote:       '£112,858',
      status:      'candidate',
      note:        '★2026-10-25 から fo.avg はこの17件の平均ではない（2,590万→2,810万。下の 2026-10-25 の行＝短距離 SFO 4年目＋会社の年金拠出15%）。'
                 + '以下はその前（2026-10-20〜24）の記録。'
                 + '★ fo.avg（2,590万）の根拠。£119,504 × 216.76 ＝ 約2,590万円。'
                 + '調査パックの記録 british-airways.pay.r6-aug2026-sh-sfo-example-y1〜y7・'
                 + 'r6-aug2026-lh-sfo-example-y1〜y7・r6-branch-lhfo-y8・r6-aug2026-lh-sfo-18years・'
                 + 'r6-a320-branch-lhsfo-y6（quote は各欄の金額そのもの。ここには1件目だけ写した）。'
                 + '⚠️ LH SFO Year 6 の £121,125 は2つの PDF に同じ額で載っていて、17件の中で2回数えている。'
                 + '1回だけにした16件の平均は £119,403（約2,588万円）で、10万円に丸めると同じ 2,590万。'
                 + '⚠️ **これは会社の給与例を足して割った数で、副操縦士の実績の平均ではない。**'
                 + 'SALARY の avg はふだん「全年次の平均の推計」だが、BA だけはオーナーの判断（2026-10-20）で'
                 + 'この単純平均を置いた。例は入社1〜8年目に偏っていて（18年目は1件だけ）、人数で重みづけもしていない。'
                 + '調査パック自身も「会社平均へまとめない」「平均として扱わない」と書いている。'
                 + 'PDF を開いて確かめるまで candidate のまま。',
    },
    /* ★2026-10-25（オーナー承認の見直し P12.105 ── 推定年収＝会社が1年に払うものすべて＝会社の年金拠出も数える）。
         fo.avg 2,590→2,810万・fo.hi 3,400→3,910万。lo（2,300万）は前の値のまま。
         機長は同じ作り方だと 3,980→3,900万に下がるので、オーナーの決まり（下がる向きは動かさない）で今のまま ＝
         機長の avg は年金拠出を含まない4件の平均・副操縦士は含む、と作り方が揃っていない（承知のうえ）。 */
    {
      rank:        'fo',
      source_type: 'job_posting',
      name:        'British Airways — Short Haul Pilot Recruitment Pack 2026（募集 Ref 11673 の添付 PDF）物理4頁 PILOT PAY ── SH Senior First Officer 4年目の給与例',
      url:         'https://apply.ba.com/jobs/vacancy/direct-entry-pilot---a320-type-rated-pilot--uk-licence-holder-11673-heathrow-airport-london/11692/description/ajaxaction/downloadfile/?id=5002339',
      published_at:null,
      accessed_at: '2026-10-25',
      value_orig:  'SH SFO Year 4 £112,858/年（会社の給与例・FPS £15,778・TAFB £10,180・DOA/NIA £900 を含む・'
                 + '年 713 ブロック時間＋holiday pay 72時間の前提）。同じ PDF の Pension 欄「6% employee contribution gives 15% employer contribution」。'
                 + '15% を足すと £129,787。',
      quote:       '£112,858',
      status:      'candidate',
      note:        '★ fo.avg（2,810万）の根拠。£112,858 × 1.15 ＝ £129,787 × 216.76 ＝ 約2,813万円 → 2,810万。'
                 + '短距離（ナローボディ）副操縦士の1〜7年目の給与例のまんなか＝4年目を代表にし、会社の年金拠出 15%（BAPP）を足した。'
                 + '数えたもの＝給与例の全額（基本給＋FPS・TAFB・DOA/NIA の乗務手当）＋会社の年金拠出 15%。賞与・利益配分は資料に無く入っていない。'
                 + '⚠️ 15% は本人が 6% を拠出したとき（求人の共通欄では加入時の初期設定が本人2%・会社7%）。'
                 + 'BAPP の対象給与の定義は未公表で、乗務手当が対象外なら年金分は約 £4,029（約87万円）小さい。'
                 + '⚠️ 会社の給与例であって、在籍者全員の号俸表・平均・保証ではない。'
                 + '調査パック（ChatGPT・2026-10-20）の読み。£112,858 の欄は PDF の中で画像になっていて、こちら（2026-10-25）は'
                 + '文字として読めなかった（Pension の文は読めた）ので candidate のまま。',
    },
    {
      rank:        'fo',
      source_type: 'job_posting',
      name:        'British Airways — Direct Entry Pilot A320 Type Rated（careers.ba.com・Ref 22348）の福利厚生欄 ＋ 募集 PDF 2つの Pension 欄',
      url:         'https://careers.ba.com/en/job/heathrow/direct-entry-pilot-a320-type-rated-pilot-uk-licence-holder/22348/92677578928',
      published_at:null,
      accessed_at: '2026-10-25',
      value_orig:  '会社の年金拠出 最大15%（本人が6%拠出したとき）。加入時の初期設定は本人2%・会社7%。',
      quote:       'Company pension scheme (up to 15% employer contribution)',
      status:      'in_use',
      note:        '★ fo.avg・fo.hi に足した「会社の年金拠出 15%」の根拠（金額ではなく率）。同じページに'
                 + '"Enrolled at 2% employee contributions and 7% employer with an option to increase." とあり、'
                 + 'Short Haul と Senior First Officer の募集 PDF の Pension 欄はどちらも "6% employee contribution gives 15% employer contribution"'
                 + '（2026-10-25 に3つとも開いて文を確認）。'
                 + '⚠️ 15% は上限側（本人が 6% を出す人）。初期設定のままなら 7%。',
    },
    {
      rank:        'cap',
      source_type: 'job_posting',
      name:        'British Airways — Senior First Officer Recruitment Pack 2026（募集 Ref 12234「Direct Entry Pilot - Senior First Officer - UK CAA licence holder」の添付 PDF）物理6–7頁 Year 5・Year 8 の分岐ボックス',
      url:         'https://apply.ba.com/jobs/vacancy/direct-entry-pilot---senior-first-officer---uk-caa--licence-holder-12234-heathrow-airport-london/12253/description/ajaxaction/downloadfile/?id=5002331',
      published_at:null,
      accessed_at: '2026-10-20',
      value_orig:  'SH Captain に5年目で移る経路の例 £153,155/年（会社の給与例）。'
                 + '2026年8月入社者のキャリア例で、FPS・TAFB・DOA/NIA を含み、年 713 ブロック時間＋holiday pay 72時間・'
                 + '年 FPS £15,778・TAFB £10,180・DOA/NIA £900 を前提とする。超過勤務は除く。税引前後の記載なし。',
      quote:       '£153,155',
      status:      'candidate',
      note:        '★ cap.lo（3,320万）の根拠。£153,155 × 216.76 ＝ 約3,320万円。'
                 + '調査パックの記録 british-airways.pay.r6-branch-shcap-y5'
                 + '（場所: 物理6–7頁 / Year5・Year8の分岐ボックス）。'
                 + '⚠️ 昇格や機材の移動を約束する額ではない（「こう進めばこの額」という分岐の1例）。'
                 + '会社の給与例であって、機長の実績の平均・保証・下限ではない。基本給を逆算しない。'
                 + 'PDF を開いて確かめるまで candidate のまま。',
    },
    {
      rank:        'cap',
      source_type: 'job_posting',
      name:        'British Airways — Senior First Officer Recruitment Pack 2026 物理6–7頁 左欄（Long-haul Line Captain）',
      url:         'https://apply.ba.com/jobs/vacancy/direct-entry-pilot---senior-first-officer---uk-caa--licence-holder-12234-heathrow-airport-london/12253/description/ajaxaction/downloadfile/?id=5002331',
      published_at:null,
      accessed_at: '2026-10-20',
      value_orig:  'Long-haul Captain・BA 在籍29年 £263,512/年（会社の給与例・as of August 2026）。'
                 + '乗務手当の前提は上と同じ（年 713 ブロック時間＋holiday pay 72時間）。税引前後の記載なし。',
      quote:       '£263,512',
      status:      'candidate',
      note:        '★ cap.hi（5,710万）の根拠。£263,512 × 216.76 ＝ 約5,712万円 → 5,710万。'
                 + '調査パックの記録 british-airways.pay.r6-aug2026-lh-cap-29years'
                 + '（場所: 物理6–7頁 / 左欄 Long-haul Line Captain・Long-haul Senior First Officer）。'
                 + '同じ額は Short Haul の PDF 物理4頁の左欄にも「as of June 2026」で載っている。主な根拠は SFO の PDF（August 2026）。'
                 + '⚠️ 在籍29年の1例であって、機長の給与の上限ではない。PDF を開いて確かめるまで candidate。',
    },
    {
      rank:        'cap',
      source_type: 'job_posting',
      name:        'British Airways — Senior First Officer Recruitment Pack 2026 物理6–7頁（分岐ボックス・左欄）＋ Short Haul Pilot Recruitment Pack 2026 物理4頁（Year 6 SH Captain）── BA 本体の機長の給与例 4件',
      url:         'https://apply.ba.com/jobs/vacancy/direct-entry-pilot---senior-first-officer---uk-caa--licence-holder-12234-heathrow-airport-london/12253/description/ajaxaction/downloadfile/?id=5002331',
      published_at:null,
      accessed_at: '2026-10-20',
      value_orig:  'BA 本体の機長の会社の給与例 4件（いずれも £/年）── '
                 + 'SH Capt. 5年目（分岐）153,155｜SH Captain 6年目（Short Haul の PDF）156,463｜'
                 + 'SH Capt. 8年目（分岐）162,080｜LH Captain 在籍29年 263,512。'
                 + '4件の単純平均 £183,802.5（合計 £735,210）。',
      quote:       '£156,463',
      status:      'candidate',
      note:        '★ cap.avg（3,980万）の根拠。£183,802.5 × 216.76 ＝ 約3,984万円 → 3,980万。'
                 + '調査パックの記録 british-airways.pay.r6-branch-shcap-y5・r6-a320-branch-shcap-y6・'
                 + 'r6-branch-shcap-y8・r6-aug2026-lh-cap-29years（quote は各欄の金額そのもの。ここには Short Haul の1件だけ写した）。'
                 + '⚠️ **これは会社の給与例を足して割った数で、機長の実績の平均ではない。**'
                 + 'BA だけはオーナーの判断（2026-10-20）でこの単純平均を置いた。'
                 + '4件のうち3件は短距離の5〜8年目、1件は長距離の在籍29年で、人数での重みづけはしていない'
                 + '（29年の1件が平均を押し上げている。3件だけなら約 £157,233 ＝ 約3,408万円）。'
                 + '⚠️ BA Cityflyer（別会社・E190・募集 11323）の機長の額は入れていない。'
                 + '調査パック自身も「平均として扱わない」と書いている。PDF を開いて確かめるまで candidate のまま。',
    },
  ],

  // ★2026-10-25（オーナー承認の見直し P12.105）── 下の欧州5社とオセアニア2社は、労働協約の給与表（スペイン官報 BOE・
  //   ポルトガル労働公報 BTE・豪州 Fair Work Commission の承認原本・イタリアの組合が公開した写し）から推定年収を作り直した。
  //   決まり：推定年収＝会社が1年に払うものすべて（オーナー 2026-10-24）。ただし資料に額や回数が無いもの（乗務時間による上乗せ・
  //   手当・年金拠出の率など）は足していない＝どれも下限寄り。月額しか無い表は、協約が支払回数を書いている会社だけ
  //   月額×その回数（質問5＝②）。新しい資料で数字が**下がる**職位・レンジの端は動かしていない（質問2＝①）。
  //   円は fx-rates.mjs（AS_OF 2026-08-22）の EUR 185.69・AUD 113.88 で直し、10万円単位に丸めた。
  //   原本は 2026-10-25 にこちらで開いて、表の行と条文を確かめた（PDF は read-source-pdf.mjs、イタリアの写しは画像のページを目で読んだ）。
  'ryanair': [
    {
      rank:        'cap',
      source_type: 'union_cba',
      name:        'BOE-A-2023-15123 Convenio colectivo de Pilotos de Ryanair DAC en España ── Anexo 1 Escala salarial 2026（機長・13段）',
      url:         'https://www.boe.es/buscar/doc.php?id=BOE-A-2023-15123',
      published_at:'2023-06-28',
      accessed_at: '2026-10-25',
      value_orig:  'Anexo 1・2026年の機長の表（Total bruto anual・€）: Año 1 139.599 … Año 7 150.831（Salario base 105.350 ＋ '
                 + 'Retribución por sectores 35.131 ＋ Otros 10.350）… Año 13 156.625。「Otros」は機長の手当 年€6.000 と有給29日分の支払い。'
                 + '会社の年金拠出は 7.5.1 で機長 年最大€8.000（本人も同額を拠出する任意の制度）。',
      quote:       'Año 7 | 105.350 | 35.131 | 10.350 | 41,33 | 150.831 … Ingresos brutos indicativos basados en 850 SBH, no garantizados.',
      status:      'in_use',
      note:        '★ cap.avg（2,800万）の根拠。13段のまんなか Año 7 €150,831 × 185.69 ＝ 約2,801万円。'
                 + '数えたもの＝基本給・区間手当（年850ブロック時間の前提）・Otros（年€6,000の手当と有給の支払い）。'
                 + '入れていないもの＝任意の会社年金拠出（最大€8,000・本人の同額拠出が条件。足すと約2,950万）、'
                 + '新任機長の最初の24か月の減額（5.6）。850時間は保証ではなく協約の参考の前提。'
                 + 'スペイン拠点の Ryanair DAC 直接雇用・通年フルタイムだけの表（英国・アイルランドなど他国の契約は別）。'
                 + 'cap.lo（1,450万）・cap.hi（3,100万）は前の値のまま（表の端 €139,599＝約2,592万／€156,625＝約2,908万はその中）。'
                 + '2026-10-24 までの SALARY（avg 2,240万）は出所の記録が無かった。',
    },
    {
      rank:        'fo',
      source_type: 'union_cba',
      name:        'BOE-A-2023-15123 Convenio colectivo de Pilotos de Ryanair DAC en España ── Anexo 2 Primer Oficial 2026 ＋ 7.5.1（年金拠出）',
      url:         'https://www.boe.es/buscar/doc.php?id=BOE-A-2023-15123',
      published_at:'2023-06-28',
      accessed_at: '2026-10-25',
      value_orig:  'Anexo 2・Primer Oficial 2026: Salario base 54.800 ＋ Retribución por sectores (850 h) 14.875 ＋ Otros 9.850 ＝ Total bruto anual €79.525。'
                 + 'Primer Oficial Junior €59.378（年の区分なし）。7.5.1: 副操縦士の会社年金拠出 年最大€3.000（本人も同額）。',
      quote:       '2026 | 54.800 | 14.875 | 9.850 | 17,50 | 79.525 … (3.000 euros Ryanair / 3.000 euros primer oficial)',
      status:      'in_use',
      note:        '★ fo.avg（1,480万）＝ €79,525 × 185.69 ＝ 約1,477万円。'
                 + '★ fo.hi（1,530万）＝ €79,525 ＋ 会社年金拠出の上限 €3,000 ＝ €82,525 ＝ 約1,532万円（拠出は本人の同額拠出が条件の任意の制度なので、上の端にだけ足した）。'
                 + '数えたもの＝基本給・区間手当（850時間の前提・保証なし）・Otros（年€5,500の手当と有給の支払い）。'
                 + 'fo.lo（650万）は前の値のまま（表の Junior FO €59,378＝約1,103万はその上）。スペイン拠点の直接雇用だけ。'
                 + '2026-10-24 までの SALARY（avg 1,030万）は出所の記録が無かった。',
    },
  ],
  'vueling': [
    {
      rank:        'cap',
      source_type: 'union_cba',
      name:        'BOE-A-2026-5693 IV Convenio colectivo de Vueling Airlines, SA y sus tripulantes pilotos ── ANEXO A Tablas salariales（Comandantes）',
      url:         'https://www.boe.es/buscar/doc.php?id=BOE-A-2026-5693',
      published_at:'2026-03-11',
      accessed_at: '2026-10-25',
      value_orig:  'ANEXO A Comandantes・Total bruto fijo Anual（基本給＋特別給の按分＋機長責任手当）: NIVEL 4 €98.292,24 ／ NIVEL 3 €114.277,38 ／ '
                 + 'NIVEL 2 €128.670,92 ／ NIVEL 1 €144.809,97 ／ NIVEL 1A €150.609,62 ／ NIVEL 1B €157.602,37 ／ NIVEL 1C €164.596,32。'
                 + '同じ表の別の欄に Paga prod. trimestral（四半期の生産性手当）年額 NIVEL 1 €3.591,23 など。',
      quote:       'NIVEL 1 | 104.570,78 | 8.714,23 | 20.687,14 | 1.723,93 | 19.552,05 | 1.629,34 | 144.809,97',
      status:      'in_use',
      note:        '★ cap.avg（2,690万）＝ 7段のまんなか NIVEL 1 €144,809.97 × 185.69 ＝ 約2,689万円。'
                 + '★ cap.lo（1,830万）＝ NIVEL 4（約1,825万）／cap.hi（3,060万）＝ NIVEL 1C（約3,056万）。'
                 + '数えたもの＝固定の年額（Total bruto fijo）だけ。入れていないもの＝乗務の変動給・夜間手当（額の資料が無い）と、'
                 + '同じ表に載っている四半期の生産性手当（NIVEL 1 で年€3,591.23。足すと約2,760万）＝下限寄り。'
                 + '⚠️ 表の対象年の記載が無く、毎年さかのぼって見直す条項がある。NIVEL は給与の段で勤続年数とは限らない。スペインの契約だけ。'
                 + '2026-10-24 までの SALARY（avg 1,720万）は出所の記録が無かった。',
    },
    {
      rank:        'fo',
      source_type: 'union_cba',
      name:        'BOE-A-2026-5693 IV Convenio colectivo de Vueling Airlines, SA y sus tripulantes pilotos ── ANEXO A Tablas salariales（Copilotos）',
      url:         'https://www.boe.es/buscar/doc.php?id=BOE-A-2026-5693',
      published_at:'2026-03-11',
      accessed_at: '2026-10-25',
      value_orig:  'ANEXO A Copilotos・Total bruto fijo Anual: NIVEL 6 €17.897,67 ／ NIVEL 5 €37.731,75 ／ NIVEL 4 €52.355,56 ／ NIVEL 3 €58.757,73 ／ '
                 + 'NIVEL 2 €66.928,07 ／ NIVEL 1 €74.031,77 ／ NIVEL 1A €79.016,54 ／ NIVEL 1B €82.210,47。'
                 + 'Paga prod. trimestral 年額 NIVEL 3 €2.942,18 など（別の欄）。',
      quote:       'NIVEL 3 | 50.363,76 | 4.196,98 | 8.393,96 | 699,50 | 58.757,73',
      status:      'in_use',
      note:        '★ fo.avg（1,090万）＝ 8段のまんなか（下から4段目）NIVEL 3 €58,757.73 × 185.69 ＝ 約1,091万円。'
                 + '★ fo.hi（1,530万）＝ NIVEL 1B（約1,527万）。fo.lo（690万）は前の値のまま'
                 + '（表の下端 NIVEL 6 €17,897.67＝約332万は訓練中・1,600時間以下の段、NIVEL 5 は約701万）。'
                 + '固定の年額だけ（変動給・夜間・四半期の生産性手当〈NIVEL 3 で年€2,942.18〉は入れていない）＝下限寄り。スペインの契約だけ。'
                 + '2026-10-24 までの SALARY（avg 950万）は出所の記録が無かった。',
    },
  ],
  'easyjet': [
    {
      rank:        'cap',
      source_type: 'union_cba',
      name:        'Acordo de empresa entre a EasyJet Airline Company Limited e o SPAC（Boletim do Trabalho e Emprego n.º 29/2026）── Anexo I Salário anual básico',
      url:         'https://bte.dgcp.mtsss.gov.pt/documentos/2026/29/01240156.pdf',
      published_at:'2026-08-08',
      accessed_at: '2026-10-25',
      value_orig:  'Anexo I・2026-02-01 から: Comandante (CPT) €160.999,74（final gross annual basic salary）。'
                 + '本文13-: 年間基本給は14回払い（うち2回は休暇手当とクリスマス手当）。',
      quote:       'Comandante (CPT) Captain (CPT) 160 999,74 € final gross annual basic salary',
      status:      'in_use',
      note:        '★ cap.avg（2,990万）＝ €160,999.74 × 185.69 ＝ 約2,990万円。表は等級の無い1つの額。'
                 + '数えたもの＝年間基本給だけ。入れていないもの＝区間ごとの日当（nominal sector €85.84・年の区間数の資料が無い）、'
                 + '賞与（機長は年間基本給の最大20%・目標10%・会社の裁量 ── 同じ協約の賞与の条文）、年金＝下限寄り。'
                 + 'ポルトガル拠点の SPAC 代表パイロットだけ（easyJet の主力の英国などの契約は別）。'
                 + 'cap.lo（2,300万）・cap.hi（3,600万）と副操縦士は前の値のまま（副操縦士は今回の見直しの対象外）。'
                 + '2026-10-24 までの SALARY（avg 2,700万）は出所の記録が無かった。',
    },
  ],
  'ita-airways': [
    {
      rank:        'fo',
      source_type: 'union_cba',
      name:        'Accordo integrativo di secondo livello ITA Airways（2026-07-22 署名）── Tabella A SETTEMBRE 2026（PILOTI – MEDIO RAGGIO／LUNGO RAGGIO）・組合 FAST が公開した写し',
      url:         'https://sindacatofast.it/areacon/compartoaereo/sites/default/files/FAST%20-%20Accordo%202%C2%B0%20Livello%20-%2022.07.2026%20-%20fir_compresse%20d%20%281%29.pdf',
      published_at:'2026-07-23',
      accessed_at: '2026-10-25',
      value_orig:  'Tabella A（同じ職務で12か月以上）・列見出し「Stip.Base x 14 mens」「I.V.M.G. x 14 mens」（月額・年14回）。'
                 + 'PILOTI – MEDIO RAGGIO 年次13: 1.174,45 ＋ 4.004,22 ／ PILOTI – LUNGO RAGGIO 年次0: 912,42 ＋ 2.753,72・年次27: 1.580,80 ＋ 5.647,23（€）。'
                 + 'I.V.M.G. は月30時間ぶんの乗務手当を含む最低保証の飛行手当。',
      quote:       'SETTEMBRE 2026 PILOTI - MEDIO RAGGIO … Stip.Base x 14 mens | I.V.M.G. x 14 mens … 13 | 1.174,45 | 4.004,22',
      status:      'in_use',
      note:        '★ fo.avg（1,350万）＝（€1,174.45 ＋ €4,004.22）× 14 ＝ €72,501.38 × 185.69 ＝ 約1,346万円（年次0〜27のまんなか・中距離）。'
                 + '★ fo.hi（1,880万）＝ 長距離 年次27（€1,580.80 ＋ €5,647.23）× 14 ＝ €101,192.42 ＝ 約1,879万円。'
                 + '月額×14 は、表の列見出しが支払回数（x 14 mens）を書いているから（オーナーの質問5の答え＝②）。'
                 + '入れていないもの＝月30時間を超える乗務手当（IVO・時間の資料が無い）・日当・退職積立（TFR）・会社年金・一時金＝下限寄り。'
                 + 'fo.lo（780万）は前の値のまま（表の下端 長距離 年次0 €51,325.96＝約953万はその上）。'
                 + '機長は同じ作り方だと 2,150→1,960万に下がるので動かしていない。'
                 + '⚠️ 写しはスキャンした画像の PDF で文字の層が無い。2026-10-25 にページの画像を目で読んで値を確かめた。',
    },
  ],
  'norwegian': [
    {
      rank:        'cap',
      source_type: 'union_cba',
      name:        'BOE-A-2024-24738 II Convenio colectivo de pilotos de Norwegian Air Resources Spain SL ── Anexo C 1.02 ＋ Tabla C.1（2025年の基本月給）',
      url:         'https://www.boe.es/buscar/doc.php?id=BOE-A-2024-24738',
      published_at:'2024-11-27',
      accessed_at: '2026-10-25',
      value_orig:  'Tabla C.1 Salario base mensual 2025（€・特別給2回の按分を含む）: CPT level 1 8.784,34 ／ level 5 9.928,67 ／ level 10 11.529,58。'
                 + 'Anexo C 1.02: 年間基本給を12回に按分して払い、特別給2回を含む。',
      quote:       '1.02 Pagas extraordinarias: El salario base anual se abonará prorrateado en doce mensualidades incluyéndose las dos (2) pagas extraordinarias.',
      status:      'in_use',
      note:        '★ cap.avg（2,210万）＝ level 5（1〜10のまんなか）€9,928.67 × 12 ＝ €119,144.04 × 185.69 ＝ 約2,212万円。'
                 + '月額×12 は、協約 1.02 が「年額を12回に按分（特別給2回を含む）」と書いているから（質問5＝②）。表の行は「5 | CPT | 9.734,33 | 9.928,67」（2024年・2025年）。'
                 + '入れていないもの＝乗務時間あたりの変動給（BLH）・毎月の定額の手当・会社の年金拠出（月か年かの記載なし）・2026年の物価改定（前年の物価で1〜3%）＝下限寄り。'
                 + 'cap.lo（1,430万）・cap.hi（2,700万）は前の値のまま（表の端 level 1＝約1,957万／level 10＝約2,569万はその中）。'
                 + 'スペイン法人 Norwegian Air Resources Spain SL の操縦士だけ・2025年の表。'
                 + '2026-10-24 までの SALARY（avg 2,000万）は出所の記録が無かった。',
    },
    {
      rank:        'fo',
      source_type: 'union_cba',
      name:        'BOE-A-2024-24738 II Convenio colectivo de pilotos de Norwegian Air Resources Spain SL ── Anexo C 1.02 ＋ Tabla C.1（2025年の基本月給）',
      url:         'https://www.boe.es/buscar/doc.php?id=BOE-A-2024-24738',
      published_at:'2024-11-27',
      accessed_at: '2026-10-25',
      value_orig:  'Tabla C.1 Salario base mensual 2025: FO level 1 3.570,65 ／ level 5 5.080,48 ／ level 10 5.631,08（€・特別給の按分を含む）。',
      quote:       '5 | FO | 4.981,19 | 5.080,48',
      status:      'in_use',
      note:        '★ fo.avg（1,130万）＝ level 5 €5,080.48 × 12 ＝ €60,965.76 × 185.69 ＝ 約1,132万円（12回は機長の行と同じ 1.02 の条文）。'
                 + '変動給・手当・年金拠出・2026年の改定は入れていない＝下限寄り。'
                 + 'fo.lo（720万）・fo.hi（1,650万）は前の値のまま（表の端 level 1＝約796万／level 10＝約1,255万はその中）。'
                 + '2026-10-24 までの SALARY（avg 1,100万）は出所の記録が無かった。',
    },
  ],

  // ── オセアニア ────────────────────────────────────────────────────
  'qantas': [
    {
      rank:        'fo',
      source_type: 'union_cba',
      name:        'Qantas Airways Limited Pilots (Short Haul) Enterprise Agreement 2024（AE528955・Fair Work Commission 承認の原本）── cl 27.3.3',
      url:         'https://www.fwc.gov.au/documents/agreements/approved/ae528955.pdf',
      published_at:'2025-05-09',
      accessed_at: '2026-10-25',
      value_orig:  'cl 27.3.3 副操縦士の年額給与（1/09/2026 から・豪ドル）: Year 1 $178,532.46 ／ Year 2 $183,357.65 ／ Year 3 $188,182.84 ／ '
                 + 'Year 4 $193,008.09 ／ Year 5 $197,833.29。',
      quote:       '27.3.3 The annual salaries for First Officers at each year and rank level under this Agreement will be as set out in the following table … '
                 + '1 /09/ 2026 $178,532.46 $183,357.65 $188,182.84 $193,008.09 $197,833.29',
      status:      'in_use',
      note:        '★ fo.avg（2,140万）＝ Year 3（1〜5年のまんなか）AUD 188,182.84 × 113.88 ＝ 約2,143万円。'
                 + '入れていないもの＝会社の superannuation（27.8.5 は「法定の率以上」とだけ書き、率が無い）・保証の時間を超えた乗務の分・手当＝下限寄り。'
                 + '短距離（B737/A320 系）の協約だけ（長距離の協約は今回の資料に無い）。年次は副操縦士として路線に出てからの年数。'
                 + 'fo.lo（1,660万）・fo.hi（3,120万）は前の値のまま。'
                 + '機長は同じ協約だけだと 3,700→3,250万に下がるので動かしていない。',
    },
  ],
  'jetstar': [
    {
      rank:        'cap',
      source_type: 'union_cba',
      name:        'Jetstar Airways Pilots Enterprise Agreement 2026（AE533389・Fair Work Commission 承認の原本）── Table 1 Narrow Body Captain／Table 3 Wide Body Captain',
      url:         'https://www.fwc.gov.au/documents/agreements/approved/ae533389.pdf',
      published_at:'2026-07-15',
      accessed_at: '2026-10-25',
      value_orig:  'Base Salary（年額・01-Jul-26 の欄）: Table 1 Narrow Body Captain Level 1 $264,335 ／ Level 2 $272,265 ／ Level 3 $280,433 ／ Level 4 $280,433。'
                 + 'Table 3 Wide Body Captain Level 1 $301,341 ／ Level 2 $310,382 ／ Level 3・4 $319,296。表の記号は $（豪州の協約＝豪ドルと読んだ）。',
      quote:       'The first Base Salary rates of this Agreement, as contained in Tables 1 to 5 below, will take effect from 1 July 2026. … '
                 + 'Table 1 – Narrow Body Captain … 01 - Jul - 26 $264,335 $272,265 $280,433 $280,433',
      status:      'in_use',
      note:        '★ cap.avg（3,100万）＝ 狭胴機長 Level 2（機長として2〜4年目）AUD 272,265 × 113.88 ＝ 約3,101万円。'
                 + '★ cap.lo（3,010万）＝ 狭胴 Level 1（約3,010万）／cap.hi（3,640万）＝ 広胴 Level 3・4（約3,636万）。'
                 + '数えたもの＝年額の Base Salary（41.1.5：休暇手当の加算などの伝統的な手当を組み込んだ額）。'
                 + '入れていないもの＝41.8 の手当・EFA・会社の superannuation（率の資料が無い）＝下限寄り。'
                 + '既存のパイロットは移行の特則があり、年数だけで Level は決まらない。'
                 + '2026-10-24 までの SALARY（avg 2,400万）は出所の記録が無かった。',
    },
    {
      rank:        'fo',
      source_type: 'union_cba',
      name:        'Jetstar Airways Pilots Enterprise Agreement 2026（AE533389・Fair Work Commission 承認の原本）── Table 2 Narrow Body First Officer／Table 4 Wide Body First Officer',
      url:         'https://www.fwc.gov.au/documents/agreements/approved/ae533389.pdf',
      published_at:'2026-07-15',
      accessed_at: '2026-10-25',
      value_orig:  'Base Salary（年額・01-Jul-26 の欄）: Table 2 Narrow Body First Officer Level 1 $147,234 ／ Level 2 $158,601 ／ Level 3 $171,818 ／ Level 4 $171,818。'
                 + 'Table 4 Wide Body First Officer Level 2 $180,805 ／ Level 3・4 $195,873。',
      quote:       'Table 2 – Narrow Body First Officer … 01 - Jul - 26 $147,234 $158,601 $171,818 $171,818',
      status:      'in_use',
      note:        '★ fo.avg（1,810万）＝ 狭胴副操縦士 Level 2 AUD 158,601 × 113.88 ＝ 約1,806万円。'
                 + '★ fo.lo（1,680万）＝ 狭胴 Level 1（約1,677万）／fo.hi（2,230万）＝ 広胴 Level 3・4（約2,231万）。'
                 + '年額の Base Salary だけ（手当・superannuation は入れていない）＝下限寄り。'
                 + '2026-10-24 までの SALARY（avg 1,350万）は出所の記録が無かった。',
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

  /* ── エバー航空 ── 2026-10-02 に全12言語版と台湾側の資料を当たり直した記録 ──
     ★ 副操縦士は会社が年額を自分で公表している（USD 100,000 超）。
     ★ 機長の金額は公式のどこにも無い。zh-tw（台湾籍向け）に1文字も無く、
       外国籍向けの募集は副操縦士だけ。しかも 2024-01-28 の労使合意に
       「不直接以正機師身分進用外國籍機師」＝外国籍を機長として直接採らない条項があり、
       外国籍向けに機長の募集広告が存在しない理由そのものが公式に説明されている。
       機長の水準は台湾の報道2本と労使合意からしか辿れない。
     ⚠️ どちらの職位も、いまの SALARY が資料を下回っている（各 note に差分を書いた）。
        手順1-b のとおり、ここでは数値を書き換えていない。                                */

  'eva-air': [
    {
      rank:        'fo',
      source_type: 'job_posting',
      name:        'EVA Air — Careers / Job openings / Pilots（年額を書いている版：en-global / en-us / en-th / en-kh / en-jp / en-vn / vi-vn）',
      url:         'https://www.evaair.com/en-global/about-eva-air/careers/job-openings/pilots/',
      published_at:null,
      accessed_at: '2026-10-02',
      value_orig:  '副操縦士（A321 / B777 / B787）。年収 USD 100,000 超（初回の運航から適用。'
                 + '補助・手当は別計算）。会社業績に応じた年末賞与、住宅補助または社宅、'
                 + '喪失ライセンス保険、月8日の連続した休み、年次有給 22日から最大42日、'
                 + '有給の病欠 年30日まで。要件は 総飛行 2,000時間・多人数運航ジェット'
                 + '（MTOW 20t 超）500時間・ICAO/JAA/FAA ATPL（frozen は不可）・第一種身体検査・'
                 + 'ICAO English Level 4・航空業界での在職証明5年（学士があれば2年）。契約4年。',
      quote:       'Annual income exceeding USD 100,000, effective from your first operational flight. (Additional subsidies and allowance will be calculated separately.)',
      status:      'in_use',
      note:        '★ 2026-10-02、実ブラウザで12言語版すべてを取得し直した（curl と通常の取得は '
                 + '403 を返すため Puppeteer を使った）。年額を USD で書いているのは '
                 + 'en-global / en-us / en-th / en-kh / en-jp / en-vn / vi-vn の7版。'
                 + '⚠️ **募集しているのは副操縦士だけ**（"EVA Airways requires A321/B777/B787 '
                 + 'first officers"）。機長の募集も機長の金額も、どの言語版にも1文字も無い。'
                 + '⚠️ SALARY の fo（600〜1,180万・avg 980万）は、この公式の**下限**'
                 + '（fx-rates.mjs の USD 158.95 で約1,589万円）を avg も hi も下回っている。'
                 + '差は約35%。会社が「初回の運航から」と明記しているので経験年数の差でも説明できない。'
                 + 'workflows/update-salary.md の手順1-b のとおり、ここでは数値を書き換えず差分だけ記録する。',
    },
    {
      rank:        'fo',
      source_type: 'job_posting',
      name:        'EVA Air — Careers / Job openings / Pilots（月額を書いている版：en-sg / en-gb / en-au / en-my / id-id / zh-hk）',
      url:         'https://www.evaair.com/en-sg/about-eva-air/careers/job-openings/pilots/',
      published_at:null,
      accessed_at: '2026-10-02',
      value_orig:  '副操縦士。初便から満額 NTD 227,000（約113万円）／訓練期間中 NTD 157,500（約79万円）。'
                 + '年次賞与は1か月ぶん（基本給・職務手当・奨励飛行手当を含む）。',
      quote:       'From the first operation flights, FO will receive full salary starting from NTD$227,000; during training period is NTD$157,500.',
      status:      'in_use',
      note:        '★ この金額が月額か年額かは、エバー航空がどの言語版でも金額の近くに書いていない。'
                 + 'だが**年額ではありえない**ことは同じ会社の他の版で決まる ── 年額と読むと '
                 + 'NTD 227,000 ＝ 約113万円 ＝ USD 約7,100 で、同社が7つの版で書いている'
                 + '「年収 USD 100,000 超」と14倍食い違い、総飛行2,000時間・ATPL 必須の職として成立しない。'
                 + '**月額と読むと2つの公式表記が一致する** ── NTD 227,000 × 保障13か月 ＝ '
                 + 'NTD 2,951,000（約1,474万円・USD 約9.3万）で、会社が書いている'
                 + '「補助・手当は別計算」が乗れば「USD 100,000 超」に届く。'
                 + '⚠️ これは月額を12倍して年額を作る行為ではない（それはオーナーが禁じている）。'
                 + '年額は会社が自分で書いており（上のエントリ）、この計算は'
                 + '**月額表記と年額表記が同じ水準を指していることの確認にしか使っていない。**'
                 + '年収の根拠として引くのは上のエントリの USD 100,000 超のほう。'
                 + '⚠️ 「保障13個月（全薪）」は台湾の報道側の記述で、会社の募集ページには'
                 + '「年次賞与1か月ぶん」とだけある（12 + 1 で一致する）。',
    },
    {
      rank:        'cap',
      source_type: 'job_posting',
      name:        'EVA Air — 人才招募專區 / 飛航人員職缺（台湾籍向け・zh-tw）',
      url:         'https://www.evaair.com/zh-tw/about-eva-air/careers/job-openings/pilots/',
      published_at:null,
      accessed_at: '2026-10-02',
      value_orig:  '金額の記載は1文字も無い。区分は3つ ── 一般飛航員（軍退または自学飛行）／'
                 + '培訓飛航學員（飛行経験なし・大専卒）／民航飛行員（ATPL・総飛行2,000時間）。'
                 + '3区分すべてが「中華民國身分證」を要求。いずれも完訓後は**副機長**として任用。'
                 + '福利に階級差が出るのは喪失執照保険の額だけ（副機長 USD 10万／機長 USD 20万）。',
      quote:       '完訓後以副機長任用。',
      status:      'rejected',
      note:        '金額が無いため年収の根拠には使えない。★この版を記録しているのは'
                 + '「機長の公式の金額は存在しない」ことの証拠として要るから。'
                 + '⚠️ 喪失執照保険の 副機長 USD 10万／機長 USD 20万 を**給与として使わない**'
                 + '（体格検査で失効したときの保険金額であって報酬ではない）。'
                 + '⚠️ 台湾籍向けの3区分はどれも入口が副機長で、機長は社内昇格のみ。'
                 + 'そのため外国籍向けページに機長の募集が無いのは版の漏れではなく仕組み'
                 + '（2024-01-28 の労使合意にも「不直接以正機師身分進用外國籍機師」がある）。',
    },
    {
      rank:        'cap',
      source_type: 'union_cba',
      name:        '桃園市機師職業工會 長榮分會 × 長榮航空 労使合意（2024-01-28 締結／今周刊の報道で確認）',
      url:         'https://www.businesstoday.com.tw/article/category/183027/post/202401280021/',
      published_at:'2024-01-28',
      accessed_at: '2026-10-02',
      value_orig:  '本薪と職務手当の引き上げ ── 正駕駛（機長）月 13,500元／資深副駕駛 月 11,000元／'
                 + '副駕駛 月 10,000元。副駕駛と資深副駕駛の年度昇給の上限も引き上げ。'
                 + '全飛行員で年 2.25億元ぶんの増額。行政院副院長 鄭文燦 立会いで署名。'
                 + '組合は 2026-05-31 まで同3件について争議行為をしない。'
                 + 'あわせて会社が「不直接以正機師身分進用外國籍機師」（外国籍を機長として直接採用しない）を約束。',
      quote:       '公司同意於本薪及職務津貼項目，再行調漲飛行員正駕駛每月13,500元、資深副駕駛每月11,000元、副駕駛每月10,000元',
      status:      'in_use',
      note:        '★ これは**水準ではなく変化量**の資料。金額の絶対値は書かれていないので、'
                 + 'これ単独で avg / lo / hi を決められない。支えるのは2つだけ ── '
                 + '(1) 2024年初に機長の月額が 13,500元（約7万円）上がったこと、'
                 + '(2) 外国籍は機長として直接採用されないこと（＝うちの機長の数字は'
                 + '台湾籍の社内昇格者の水準として読むべきで、外国人向け募集の水準ではない）。'
                 + '⚠️ 合意本文（PDF）は公開されていない。今周刊・自由時報・udn・Yahoo 奇摩が'
                 + '同じ3つの引き上げ額を報じており、額そのものは複数で一致している。'
                 + '⚠️ 有効期限 2026-05-31 が過ぎている（今日 2026-10-02）。'
                 + 'その後の協議の結果は未確認。半年以内に見直す。',
    },
    {
      rank:        'cap',
      source_type: 'third_party_reference',
      name:        '鏡週刊「【長榮不罷工內幕2】正機師年薪480萬起跳 長榮華航星宇搶第一」（本刊調査）',
      url:         'https://www.mirrormedia.mg/story/20240205inv013',
      published_at:'2024-02-06',
      accessed_at: '2026-10-02',
      value_orig:  '正機師（機長）の年薪は長榮・華航・星宇の3社とも 480万元起跳（約2,398万円）。'
                 + '長榮は2度の加薪協議後 500万元起跳（約2,498万円）で国籍航空のうち最高。'
                 + '資深正機師は 700万元以上（約3,498万円）、少数は 800万元超（約3,997万円）。'
                 + '月薪は協議前の時点で 長榮 34.6万元（約173万円）／華航 約34万元／星宇 約37万元。'
                 + '本薪は 華航 9万元起跳／星宇 約8万余元／長榮 約8.5万元。'
                 + '長榮の年末賞与は本薪6か月ぶん、年薪13か月を保障。',
      quote:       '長榮航空與機師工會協議2度加薪後，正機師年薪將會是500萬元起跳，是目前國籍航空中最高的',
      status:      'in_use',
      note:        '⚠️ 報道（二次情報）。根拠は「本刊調査」で、組合資料名も会社発表も記事に無い。'
                 + 'だから**単独で断定の根拠にはしない**。それでも引いているのは、'
                 + '(1) 公式に機長の金額が存在せず、(2) 同じ時期に別の媒体（CTWANT）が'
                 + '独立に近い数字を出しており、(3) 直前の労使合意という日付入りの事実と'
                 + '向きも大きさも矛盾しないため。'
                 + '⚠️ SALARY の cap（1,370〜2,200万・avg 1,750万）は、この報道の'
                 + '**下限**（500万元 ≒ 2,498万円）にも hi が届いていない。'
                 + '手順1-b のとおり、ここでは数値を書き換えず差分だけ記録する。'
                 + '⚠️ 2024年2月の記事。2024-01-28 の加薪は反映済みだが、それ以降は未反映。',
    },
    {
      rank:        'cap',
      source_type: 'third_party_reference',
      name:        'CTWANT「18萬旅客解套1／長榮機師底薪落後變老三「不罷工換加薪」」',
      url:         'https://www.ctwant.com/article/314950/',
      published_at:'2024-01-30',
      accessed_at: '2026-10-02',
      value_orig:  '長榮の正駕駛・副駕駛を合わせた年薪は 350万〜650万元（約1,749万〜3,248万円）、'
                 + '飛行時間が多ければ 700万元超（約3,498万円）。'
                 + '月薪（全薪）は 星宇の正駕駛 約37万元が最高、華航 約35〜36万元、長榮 約30万元。'
                 + '別の箇所で長榮の正駕駛の月薪を 34.6万元とも書いている。'
                 + '副駕駛（華航・長榮）は月 約20万多元。'
                 + '昇格直後の機長の底薪は 華航 約9.5万元／長榮・星宇 約7.5万元'
                 + '（長榮は別の箇所で 8.5万元とも書いている）。',
      quote:       '年薪約350萬元～650萬元',
      status:      'in_use',
      note:        '⚠️ 報道（二次情報）。★鏡週刊とは媒体も日付も違い、数字も完全には一致しない'
                 + '（長榮の正駕駛の月薪を「約30万元」とも「34.6万元」とも同じ記事内で書いている）。'
                 + 'だから**点の値としては使わず、幅を支えるのに使う。**'
                 + '2本の報道が重なる範囲は 機長 年 500万〜700万元（約2,498万〜3,498万円）で、'
                 + '上は 800万元（約3,997万円）まで届く者がいる、というところまで。'
                 + '★副駕駛 月 約20万多元（×13 で 約1,300万円以上）は、'
                 + '**台湾籍の副操縦士**の水準。外国籍4年契約の NTD 227,000/月（約113万円）より低い'
                 + '＝うちの fo のレンジの下側は台湾籍、上側は外国籍契約、と読むのが筋が通る。',
    },
    {
      rank:        'all',
      source_type: 'regulatory_filing',
      name:        '長榮航空 永續領航（自社サイト）／公開資訊觀測站 ── 非擔任主管職務之全時員工薪資',
      url:         'https://www.evacsr.com/social/talents01.html',
      published_at:null,
      accessed_at: '2026-10-02',
      value_orig:  '2025年度 ── 非主管職の全時員工（年度平均 8,841人）の薪資平均数 NTD 2,229千元'
                 + '（約1,114万円）、中位数 NTD 1,564千元（約781万円）。前年比 平均 -0.81%・中位 -3.24%。'
                 + '2024年度（公開資訊觀測站）── 8,562人、平均 NTD 2,247千元（約1,123万円）、'
                 + '中位 NTD 1,616千元（約807万円）、支給総額 192.42億元。'
                 + '2021年度 ── 8,464人、平均 124.3万元、中位 72.7万元、総額 105.22億元。',
      quote:       '薪資平均數 新台幣2,229仟元',
      status:      'rejected',
      note:        '★ パイロットの年収としては使えない。**全職種の非管理職**（地上職・整備・客室乗務員を'
                 + '含む 8,841人）の平均で、機師が何人いるかも書かれていない。'
                 + 'starlux と同じ扱いで、**流用を防ぐために記録している。**'
                 + '支えるのは1点だけ ── 機長の年収がこの平均（約1,114万円）を大きく上回ることは'
                 + '確実なので、SALARY の cap avg 1,750万が「全社員平均の1.6倍」でしかないことの'
                 + '不自然さを示す補助資料になる（機長は普通、全社員平均の2〜3倍の層）。'
                 + '⚠️ この数字を「エバー航空のパイロットの平均年収」として書かない。',
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

  // ── 日本の2社（2026-10-05・会社ページ改良の調べ）────────────────────
  // どちらも「機長」「副操縦士」に分かれた資料は1件も見つからなかった。
  // 見つかったのは**運航乗務員をまとめた会社の公表平均**だけ ＝ rank は 'all'。
  // だから salary-basis.mjs では2社とも機長・副操縦士に est を置いていない（推定は「確認中」）。
  'jal': [
    {
      rank:        'all',
      source_type: 'regulatory_filing',
      name:        '日本航空株式会社 有価証券報告書 第77期（2025年4月1日〜2026年3月31日）【従業員の状況】（参考情報）p.108',
      url:         'https://disclosure2dl.edinet-fsa.go.jp/searchdocument/pdf/S100YFIO.pdf',
      published_at:'2026-06-22',
      accessed_at: '2026-10-04',
      value_orig:  '平均年間給与 運航乗務員 21,527千円（グループ連結）。'
                 + '同じ表の ── 地上社員 7,002／客室乗務員 6,327／合計 8,119（千円）。',
      quote:       '運航乗務員 21,527',
      status:      'candidate',
      note:        '★ **いまサイトに出している額より1期新しい。** salary-basis.mjs の jal.crew は'
                 + '2025年3月期の 20,051千円（約2,005万円）のまま。'
                 + '⚠️ 置き換えると、会社ページだけでなくタイトル・国別ページ・FAQ・career.html の額も動く'
                 + '＝ workflows/update-salary.md の手順で、オーナーの判断のうえで行う（この調べでは動かしていない）。'
                 + '算出の定義は表の注 ── 「（注）グループ連結平均年間給与は、当社グループの連結人件費に含まれる'
                 + '現金給与相当額を当事業年度中の平均在籍人数で除して算出しております。」'
                 + '⚠️ グループ連結・全職位の合計。機長と副操縦士を分けていない。訓練生が人数に入るかは書かれていない。'
                 + '同じ報告書の p.107 にある 10,112千円は日本航空の常勤社員ぜんぶ（全職種）の平均で、パイロットの額ではない。'
                 + 'p.109 ── 運航乗務員正社員は男性 97.7%・平均勤続 男性 19.0年／女性 6.7年。',
    },
    {
      rank:        'all',
      source_type: 'official_package',
      name:        'JAL ESG データ（esg.pdf）社会データ p.2 ── 平均年収（運航乗務員）',
      url:         'https://www.jal.com/en/sustainability/esg/pdf/esg.pdf',
      published_at:null,
      accessed_at: '2026-10-04',
      value_orig:  '平均年収（運航乗務員・グループ連結）FY2022 18,797／FY2023 19,593／FY2024 20,051／FY2025 21,527（千円）。'
                 + '平均年収（運航乗務員・男性／日本航空 常勤社員）FY2025 19,951千円。'
                 + '運航乗務員 3,566人（連結・FY2025）／機長＋副操縦士 3,139人（各年度の1月1日時点）／平均年齢 43.1歳。',
      quote:       '平均年収（運航乗務員）/Average annual compensation of employees (Cockpit crew) 千円/thousand yen 18,797 19,593 20,051 21,527',
      status:      'candidate',
      note:        '有価証券報告書の（参考情報）と同じ数字が4期ぶん並んでいる ＝ 21,527千円は会社の資料2本で一致。'
                 + '⚠️ 文書に日付が印字されていない（PDF の作成日は 2026-08-20）。だから published_at は空。'
                 + '⚠️ 「男性・日本航空 常勤社員 19,951千円」は範囲も算出も連結の額と違うので、2つを並べて大小を言わない。'
                 + '女性の 10,173千円は勤続の短い小さな集団（2.3%）の平均で、副操縦士の額ではない。'
                 + '⚠️ 機長と副操縦士の人数・金額の内訳は、この文書のどこにも無い。',
    },
  ],

  'ana': [
    {
      rank:        'all',
      source_type: 'regulatory_filing',
      name:        'ANAホールディングス 有価証券報告書 第76期（2025年4月1日〜2026年3月31日）5【従業員の状況等】＜参考＞ 職種別 グループ連結 平均年間給与（106/191ページ）',
      url:         'https://disclosure2dl.edinet-fsa.go.jp/searchdocument/pdf/S100YKL4.pdf',
      published_at:'2026-06-25',
      accessed_at: '2026-10-04',
      value_orig:  '平均年間給与 運航乗務職 23,355千円（全日本空輸・ANAウイングス・エアージャパンの3社）。',
      quote:       '運航乗務職(※2) 23,355',
      status:      'in_use',
      note:        '★ ANA が運航乗務職の平均を出したのは、この第76期が初めて（第75期には表そのものが無い）。'
                 + '⚠️ **3社をあわせた額で、全日本空輸だけの額ではない**（表の注 ※2）。機長と副操縦士を分けていない。'
                 + '訓練生が入るかどうかは書かれていない。賞与と基準外賃金を含むかは、この参考表には書かれていない'
                 + '（すぐ上の「提出会社の状況」の注には含むとある）。'
                 + '⚠️ 注 ※2 と行の対応は PDF の文字データに無く、ページの画像で確かめた。'
                 + '★2026-10-06、salary-basis.mjs の ana.crew に置いた ── 出すのは会社ページの「乗員全体の公表平均」の欄だけ。'
                 + '機長・副操縦士の欄にも、5社を並べる物差しにも入れない（職位で分かれていない額なので）。'
                 + '同じページの 11,721千円は全日本空輸の全従業員（全職種）の平均で、パイロットの額ではない。'
                 + 'p.109 ── 運航乗務職は男性 97.6%（平均45歳）・女性 2.4%（平均32歳）。',
    },
  ],
};

export default SOURCES;
