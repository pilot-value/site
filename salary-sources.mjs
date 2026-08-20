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
  // ⚠️ emirates も conf:'high' だが、エミレーツは給与等級表を公開していない。
  //    一次資料が出てこない場合、出所を作るのではなく conf を medium に落とすことを検討する。
};

export default SOURCES;
