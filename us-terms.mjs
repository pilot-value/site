/* us-terms.mjs ── 米国の会社ページの「調べた条件」（2026-11-02）。
 *
 * ★オーナー 2026-11-02「せっかくchat gptで調べてきた内容を無駄にしないで。ちゃんと活用して」。
 *   出どころは ChatGPT の調べ（米国20社・2026-11-02）の、給与のまわり・勤務・通勤・ステイの欄。資料に出典の住所が無いので、
 *   画面は行ごとの出典リンクを持たず、「PILOT VALUE の調べ」と日付の札で出す（gen-airline-glance.mjs の termsCard）。
 *   字は資料の字を写していない（調べた人の言い方を画面の言葉に書き直した）。数字は資料のまま。
 *   ref ＝ 比較表の参考値・過去の年の値など、今と言い切れない行（画面で「参考」の札）。
 *   ⚠️ 年収・年数ごとの給与表（pay-scales.mjs）・家賃（us-housing.mjs）はここに入れない。
 *   ⚠️ 社員が自分で払う額を、会社が出すお金のように書かない（2026-11-02 アメリカンの医療保険で実際に起きた）。
 */
export const TERMS_AT = '2026-11-02';
export const TERMS = Object.freeze({
 "delta": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": false,
    "ja": {
     "label": "最低保証",
     "value": "通常は月65クレジット時間",
     "note": ""
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "65 credit hours a month (normal)",
     "note": ""
    }
   },
   {
    "key": "reserve_guarantee",
    "ref": false,
    "ja": {
     "label": "リザーブの保証",
     "value": "月の平均ラインの時間（ALV）に連動して72〜80時間",
     "note": ""
    },
    "en": {
     "label": "Reserve guarantee",
     "value": "72–80 hours, tied to ALV",
     "note": ""
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "加算・割増",
     "value": "国際線の加算 機長 1時間 USD 6.50・副操縦士 USD 4.50。追加乗務などは150%・200%。休日加算あり",
     "note": ""
    },
    "en": {
     "label": "Override & premiums",
     "value": "International override USD 6.50/hr CA, USD 4.50/hr FO; 150% or 200% for eligible extra flying; holiday pay",
     "note": ""
    }
   },
   {
    "key": "profit_sharing",
    "ref": false,
    "ja": {
     "label": "利益分配",
     "value": "あり",
     "note": ""
    },
    "en": {
     "label": "Profit sharing",
     "value": "Yes",
     "note": ""
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "パーディアム（日当）",
     "value": "国内線 1時間 USD 3.30・国際線 1時間 USD 3.55",
     "note": "2025年1月の額。毎年見直し"
    },
    "en": {
     "label": "Per diem",
     "value": "USD 3.30 an hour domestic, USD 3.55 international",
     "note": "January 2025 rates, reset every year"
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "会社の退職拠出",
     "value": "会社の確定拠出（DC）18%",
     "note": "給与とは別枠"
    },
    "en": {
     "label": "Retirement",
     "value": "18% company DC contribution",
     "note": "On top of pay"
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "改定できる日 2026年12月31日。2026年1月に4%の昇給（実施済み）",
     "note": ""
    },
    "en": {
     "label": "Contract status",
     "value": "Amendable Dec 31, 2026; 4% raise took effect Jan 1, 2026",
     "note": ""
    }
   },
   {
    "key": "health",
    "ref": false,
    "ja": {
     "label": "医療保険",
     "value": "医療・歯科・眼科の保険",
     "note": "社員ぜんたいの制度"
    },
    "en": {
     "label": "Health cover",
     "value": "Medical, dental and vision",
     "note": "Company-wide employee benefit"
    }
   },
   {
    "key": "disability",
    "ref": false,
    "ja": {
     "label": "所得補償",
     "value": "長期の所得補償（LTD）は会社負担・短期（STD）は任意で加入",
     "note": "社員ぜんたいの制度"
    },
    "en": {
     "label": "Disability cover",
     "value": "Company-paid long-term disability (LTD); optional short-term disability (STD)",
     "note": "Company-wide employee benefit"
    }
   },
   {
    "key": "family_support",
    "ref": false,
    "ja": {
     "label": "家族の支援",
     "value": "家族のケア・養子縁組などの支援",
     "note": "社員ぜんたいの制度"
    },
    "en": {
     "label": "Family support",
     "value": "Family care and adoption support",
     "note": "Company-wide employee benefit"
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "17,281人",
     "note": "パイロットの労組の掲載値"
    },
    "en": {
     "label": "Pilot group size",
     "value": "17,281 pilots",
     "note": "Figure posted by the pilots' union"
    }
   }
  ],
  "work": [
   {
    "key": "vacation",
    "ref": true,
    "ja": {
     "label": "年休",
     "value": "2年目 14日・5年目 21日・12年目 28日・20年目 35日",
     "note": "2025年9月の比較表の値。休日とは別"
    },
    "en": {
     "label": "Vacation",
     "value": "14 days at year 2, 21 at year 5, 28 at year 12, 35 at year 20",
     "note": "September 2025 comparison table; separate from days off"
    }
   }
  ],
  "life": [
   {
    "key": "airport_transit",
    "ref": false,
    "ja": {
     "label": "ATL への鉄道",
     "value": "MARTA（赤・金線）で国内線ターミナルへ。平日 4:45〜1:00・週末 6:00〜1:00",
     "note": "旅客向けの一般の案内。運賃 USD 2.50"
    },
    "en": {
     "label": "Rail to ATL",
     "value": "MARTA Red/Gold lines to the domestic terminal; 4:45–1:00 weekdays, 6:00–1:00 weekends",
     "note": "Public passenger info; standard fare USD 2.50"
    }
   }
  ]
 },
 "united": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": false,
    "ja": {
     "label": "最低保証",
     "value": "勤務の自動割り当て（PBS）で付いたクレジットが70時間未満なら70時間に引き上げ",
     "note": "2024年5月から"
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "PBS awards under 70 credit hours are raised to 70",
     "note": "Since May 2024"
    }
   },
   {
    "key": "reserve_guarantee",
    "ref": true,
    "ja": {
     "label": "リザーブの保証",
     "value": "通常は73時間・6月・7月・8月・12月は77時間",
     "note": "比較資料の値"
    },
    "en": {
     "label": "Reserve guarantee",
     "value": "73 hours; 77 in June, July, August and December",
     "note": "From comparison tables"
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "加算・割増",
     "value": "国際線の加算 機長 1時間 USD 7・副操縦士 USD 5。指定の追加乗務は150〜225%など",
     "note": ""
    },
    "en": {
     "label": "Override & premiums",
     "value": "International override USD 7/hr CA, USD 5/hr FO; 150–225% for designated extra flying",
     "note": ""
    }
   },
   {
    "key": "profit_sharing",
    "ref": false,
    "ja": {
     "label": "利益分配",
     "value": "あり。会社の利益の10%・20%を原資にする式",
     "note": "給与への上乗せ率ではない"
    },
    "en": {
     "label": "Profit sharing",
     "value": "Yes; pool funded at 10% and 20% of profits by formula",
     "note": "Not a percentage added to pay"
    }
   },
   {
    "key": "per_diem",
    "ref": false,
    "ja": {
     "label": "パーディアム（日当）",
     "value": "国内線 1時間 USD 3.04・国際線 1時間 USD 3.63",
     "note": "2026年の協約の表"
    },
    "en": {
     "label": "Per diem",
     "value": "USD 3.04 an hour domestic, USD 3.63 international",
     "note": "2026 contract rates"
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "改定できる日 2027年9月30日。2027年1月の期間に約3%の昇給の予定",
     "note": "2023年の協約（UPA23）"
    },
    "en": {
     "label": "Contract status",
     "value": "Amendable Sep 30, 2027; about 3% raise due with the January 2027 bid period",
     "note": "UPA 2023"
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "18,864人",
     "note": "パイロットの労組の掲載値"
    },
    "en": {
     "label": "Pilot group size",
     "value": "18,864 pilots",
     "note": "Figure posted by the pilots' union"
    }
   }
  ],
  "life": [
   {
    "key": "airport_transit",
    "ref": false,
    "ja": {
     "label": "ORD への鉄道",
     "value": "CTA ブルーラインが24時間運行。都心から約40〜45分",
     "note": "旅客向けの一般の案内"
    },
    "en": {
     "label": "Rail to ORD",
     "value": "CTA Blue Line runs 24 hours; about 40–45 min from downtown",
     "note": "Public passenger info"
    }
   }
  ]
 },
 "american": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": false,
    "ja": {
     "label": "最低保証",
     "value": "月の平均ラインの時間（ALV）の下限と65時間の、大きいほう",
     "note": ""
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "Greater of the ALV floor or 65 hours",
     "note": ""
    }
   },
   {
    "key": "reserve_guarantee",
    "ref": true,
    "ja": {
     "label": "リザーブの保証",
     "value": "ロングコール 73時間・ショートコール 76時間",
     "note": "2025年の比較資料の値"
    },
    "en": {
     "label": "Reserve guarantee",
     "value": "Long-call 73 hours, short-call 76 hours",
     "note": "2025 comparison tables"
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "加算・割増",
     "value": "国際線の加算 機長 1時間 USD 7・副操縦士 USD 5。指定の追加乗務は150%・175%・200%など",
     "note": ""
    },
    "en": {
     "label": "Override & premiums",
     "value": "International override USD 7/hr CA, USD 5/hr FO; 150%, 175% or 200% for designated extra flying",
     "note": ""
    }
   },
   {
    "key": "profit_sharing",
    "ref": false,
    "ja": {
     "label": "利益分配",
     "value": "あり",
     "note": ""
    },
    "en": {
     "label": "Profit sharing",
     "value": "Yes",
     "note": ""
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "パーディアム（日当）",
     "value": "国内線 1時間 USD 3.41・国際線 1時間 USD 4.07",
     "note": "2025年1月の額。政府の出張日当（M&IE）に連動し毎年見直し"
    },
    "en": {
     "label": "Per diem",
     "value": "USD 3.41 an hour domestic, USD 4.07 international",
     "note": "January 2025 rates, reset yearly with the federal M&IE rate"
    }
   },
   {
    "key": "retirement",
    "ref": true,
    "ja": {
     "label": "会社の退職拠出",
     "value": "会社の確定拠出（DC）18%",
     "note": "労組の比較資料の値"
    },
    "en": {
     "label": "Retirement",
     "value": "18% company DC contribution",
     "note": "Union comparison table"
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "改定できる日 2027年8月1日。2026年8月に改定の交渉（Section 6）が始まった",
     "note": ""
    },
    "en": {
     "label": "Contract status",
     "value": "Amendable Aug 1, 2027; Section 6 talks opened in August 2026",
     "note": ""
    }
   },
   {
    "key": "pay_raise",
    "ref": true,
    "ja": {
     "label": "予定の昇給",
     "value": "2027年に約3%",
     "note": "2027年時点の比較表の値"
    },
    "en": {
     "label": "Scheduled raise",
     "value": "About 3% in 2027",
     "note": "2027 comparison table"
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "16,000人",
     "note": "パイロットの労組の説明にある概数"
    },
    "en": {
     "label": "Pilot group size",
     "value": "16,000 pilots",
     "note": "Approximate figure from the pilots' union"
    }
   }
  ],
  "work": [
   {
    "key": "vacation",
    "ref": true,
    "ja": {
     "label": "年休",
     "value": "2年目 21日・5年目 21日・12年目 28日・20年目 35日",
     "note": "2025年9月の比較表の値。休日とは別"
    },
    "en": {
     "label": "Vacation",
     "value": "21 days at years 2 and 5, 28 at year 12, 35 at year 20",
     "note": "September 2025 comparison table; separate from days off"
    }
   }
  ],
  "life": [
   {
    "key": "airport_transit",
    "ref": false,
    "ja": {
     "label": "DFW への鉄道",
     "value": "DART オレンジ線でターミナル A へ",
     "note": "旅客向けの一般の案内"
    },
    "en": {
     "label": "Rail to DFW",
     "value": "DART Orange Line to Terminal A",
     "note": "Public passenger info"
    }
   }
  ]
 },
 "southwest": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": false,
    "ja": {
     "label": "最低保証",
     "value": "28・29日の月 84 TFP・30日 87 TFP・31日 89 TFP（TFP＝Southwest の支払い単位）",
     "note": "労組の比較資料"
    },
    "en": {
     "label": "Monthly guarantee",
     "value": "84 TFP in 28/29-day months, 87 TFP in 30-day months, 89 TFP in 31-day months",
     "note": "Union comparison data"
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "パーディアム（日当）",
     "value": "国内線 1時間 USD 3.04・国際線 1時間 USD 3.63",
     "note": "2026年の額（2025年の額に協約の2.5%を足した算定値）"
    },
    "en": {
     "label": "Per diem",
     "value": "USD 3.04 an hour domestic, USD 3.63 international",
     "note": "2026 rates, worked out as 2025 rates plus the 2.5% contract increase"
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "加算・割増",
     "value": "追加乗務 150%・200%・300% など。国際線 3%・ETOPS など 5%・深夜 3% などの加算",
     "note": "対象の乗務だけに付く（全乗務に一律ではない）"
    },
    "en": {
     "label": "Premiums",
     "value": "Premium flying at 150%, 200% or 300%. Add-ons such as 3% international, 5% ETOPS, 3% night",
     "note": "Qualifying trips only, not across all TFP"
    }
   },
   {
    "key": "deadhead_pay",
    "ref": false,
    "ja": {
     "label": "デッドヘッドの支払い",
     "value": "デッドヘッド（移動のための便乗）は1区間ごとに 100% のクレジット",
     "note": "パイロットの採用ページ"
    },
    "en": {
     "label": "Deadhead pay",
     "value": "100% credit for every deadhead leg",
     "note": "Pilot careers page"
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "2027年1月1日に4%、2028年1月1日に3.25%の一律昇給。改定できる日は2029年1月1日",
     "note": ""
    },
    "en": {
     "label": "Contract",
     "value": "Across-the-board raises of 4% on Jan 1, 2027 and 3.25% on Jan 1, 2028. Amendable Jan 1, 2029",
     "note": ""
    }
   },
   {
    "key": "parental",
    "ref": false,
    "ja": {
     "label": "産休・育休",
     "value": "出産休暇は有給6週（帝王切開は8週）。育児休暇は有給2週＋無給で最大10週。出生・養子の受け入れから1年まで無給で延ばせる",
     "note": "パイロットの採用ページ。無給の分は残っている病休・年休で補える"
    },
    "en": {
     "label": "Parental leave",
     "value": "Maternity: 6 paid weeks (8 after a C-section). Parental: 2 paid weeks plus up to 10 unpaid. Unpaid bonding leave can run to 1 year after birth or placement",
     "note": "Pilot careers page. Unused sick and vacation can cover the unpaid weeks"
    }
   },
   {
    "key": "disability",
    "ref": false,
    "ja": {
     "label": "所得補償",
     "value": "会社が用意する生命保険と所得補償（働けなくなったときの補償）がある",
     "note": "パイロットの採用ページ"
    },
    "en": {
     "label": "Disability cover",
     "value": "Company-provided life and disability coverage",
     "note": "Pilot careers page"
    }
   },
   {
    "key": "medical_exam",
    "ref": false,
    "ja": {
     "label": "身体検査の費用",
     "value": "FAA の身体検査（必要なときの心電図も）の費用の大部分を会社が補助",
     "note": "パイロットの採用ページ"
    },
    "en": {
     "label": "Medical exam costs",
     "value": "Company covers most of the cost of FAA medicals, plus an EKG when required",
     "note": "Pilot careers page"
    }
   },
   {
    "key": "passport",
    "ref": false,
    "ja": {
     "label": "旅券の更新",
     "value": "旅券（パスポート）の更新費用を会社が補助",
     "note": "パイロットの採用ページ"
    },
    "en": {
     "label": "Passport renewal",
     "value": "Company helps pay for passport renewal",
     "note": "Pilot careers page"
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "11,000人を超える",
     "note": "労組の説明に載っている人数"
    },
    "en": {
     "label": "Pilot group size",
     "value": "More than 11,000 pilots",
     "note": "As stated by the pilots' union"
    }
   }
  ],
  "work": [
   {
    "key": "vacation",
    "ref": true,
    "ja": {
     "label": "年休",
     "value": "2年目 14日・5年目 21日・12年目 28日・20年目 35日",
     "note": "2025年9月の業界の比較表の値"
    },
    "en": {
     "label": "Vacation",
     "value": "14 days at year 2, 21 at year 5, 28 at year 12, 35 at year 20",
     "note": "From a September 2025 industry comparison table"
    }
   },
   {
    "key": "days_off",
    "ref": true,
    "ja": {
     "label": "月の休日（平均）",
     "value": "ラインホルダー 17.6日・リザーブ 15日",
     "note": "2021年の平均。パイロットの採用ページ"
    },
    "en": {
     "label": "Days off per month",
     "value": "17.6 for lineholders, 15 on reserve (average)",
     "note": "2021 averages from the pilot careers page"
    }
   }
  ],
  "life": [
   {
    "key": "parking",
    "ref": false,
    "ja": {
     "label": "駐車場",
     "value": "指定の社員駐車場は会社負担。ほかの駐車場は年 USD 720 まで補助",
     "note": "パイロットの採用ページ"
    },
    "en": {
     "label": "Parking",
     "value": "Designated employee parking paid by the company; other lots reimbursed up to USD 720 a year",
     "note": "Pilot careers page"
    }
   }
  ]
 },
 "alaska-airlines": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": true,
    "ja": {
     "label": "最低保証",
     "value": "ライン 月70時間・リザーブ 月75時間（ロングコール）・84時間（ショートコール）",
     "note": "会社の採用ページ。労組の比較資料ではライン月75時間"
    },
    "en": {
     "label": "Monthly guarantee",
     "value": "70 hours for lineholders; reserve 75 hours (long call) or 84 (short call)",
     "note": "Company careers page; union comparison data shows 75 for lines"
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "パーディアム（日当）",
     "value": "国内線 1時間 USD 2.65・国際線 1時間 USD 3.10",
     "note": "2025年1月の額"
    },
    "en": {
     "label": "Per diem",
     "value": "USD 2.65 an hour domestic, USD 3.10 international",
     "note": "January 2025 rates"
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "加算・割増",
     "value": "国際線・ETOPS 機長 1時間 USD 6.25・副操縦士 USD 5.25。追加乗務 150% か 200% など",
     "note": ""
    },
    "en": {
     "label": "Premiums",
     "value": "International/ETOPS pay: Captain USD 6.25/hr, FO USD 5.25/hr. Premium flying at 150% or 200%",
     "note": ""
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "2026年9月1日の昇給は4%か市場連動の調整の高いほう。ハワイアン航空との統合協約（JCBA）は交渉中",
     "note": "統合協約の状況は公表された時点のもの"
    },
    "en": {
     "label": "Contract",
     "value": "Sept 1, 2026 raise of 4% or a market-based adjustment, whichever is higher. Joint contract (JCBA) with Hawaiian under negotiation",
     "note": "JCBA status as last announced"
    }
   },
   {
    "key": "retirement",
    "ref": true,
    "ja": {
     "label": "会社の退職拠出",
     "value": "会社の DC（確定拠出年金）拠出 17%",
     "note": "比較資料の値。2010年1月以降に入社したパイロット（それより前は別の制度）"
    },
    "en": {
     "label": "Retirement",
     "value": "17% company DC contribution",
     "note": "Comparison data. Pilots hired from January 2010; earlier hires are on a different plan"
    }
   },
   {
    "key": "staff_travel",
    "ref": true,
    "ja": {
     "label": "社員の航空券（家族）",
     "value": "配偶者など・扶養の子・親2人が対象。親の枠は別の2人に付け替えられる",
     "note": "2024年の社員向けの発表（社員ぜんたいの制度）"
    },
    "en": {
     "label": "Staff travel: family",
     "value": "Spouse or partner, dependent children and 2 parents. The parent slots can go to up to 2 other people instead",
     "note": "2024 announcement to employees (company-wide benefit)"
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "3,350人",
     "note": "労組の説明に載っている人数"
    },
    "en": {
     "label": "Pilot group size",
     "value": "3,350 pilots",
     "note": "As stated by the pilots' union"
    }
   }
  ],
  "work": [
   {
    "key": "vacation",
    "ref": true,
    "ja": {
     "label": "年休",
     "value": "2年目 15日・5年目 21日・12年目 24日・20年目 35日",
     "note": "2025年9月の業界の比較表の値"
    },
    "en": {
     "label": "Vacation",
     "value": "15 days at year 2, 21 at year 5, 24 at year 12, 35 at year 20",
     "note": "From a September 2025 industry comparison table"
    }
   }
  ],
  "life": [
   {
    "key": "late_night_transit",
    "ref": false,
    "ja": {
     "label": "深夜の空港への足",
     "value": "シアトル都心から空港へライトレール（1 Line）で約38分。運行が終わった後は空港と都心を結ぶ深夜バスがある",
     "note": "SEA（シアトル）の公共交通"
    },
    "en": {
     "label": "Late-night airport access",
     "value": "Link 1 Line runs from downtown Seattle to SEA in about 38 minutes; a Night Bus links the airport and downtown after trains stop",
     "note": "Public transit at SEA"
    }
   }
  ]
 },
 "jetblue": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": false,
    "ja": {
     "label": "最低保証",
     "value": "ライン 月70時間・リザーブ 月75時間",
     "note": "労組の比較資料"
    },
    "en": {
     "label": "Monthly guarantee",
     "value": "70 hours for lineholders, 75 on reserve",
     "note": "Union comparison data"
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "パーディアム（日当）",
     "value": "国内線 1時間 USD 2.70・国際線 1時間 USD 3.25",
     "note": "2025年1月の額"
    },
    "en": {
     "label": "Per diem",
     "value": "USD 2.70 an hour domestic, USD 3.25 international",
     "note": "January 2025 rates"
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "加算・割増",
     "value": "1時間あたり 国際線 機長 USD 6・副操縦士 USD 5、深夜便（01〜05時）USD 13。追加乗務 150%・200% など",
     "note": ""
    },
    "en": {
     "label": "Premiums",
     "value": "International: Captain USD 6/hr, FO USD 5/hr. Red-eye flying (0100–0500) USD 13/hr. Premium flying at 150% or 200%",
     "note": ""
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "2025年2月に改定できる時期に入り、新しい協約を交渉中",
     "note": "2026年11月の調べ"
    },
    "en": {
     "label": "Contract",
     "value": "Amendable since February 2025; new contract under negotiation",
     "note": "As of November 2026"
    }
   },
   {
    "key": "staff_travel",
    "ref": false,
    "ja": {
     "label": "社員の航空券",
     "value": "自社便は無料の空席待ち。選ばれた他社便は割引の空席待ち",
     "note": "社員ぜんたいの制度"
    },
    "en": {
     "label": "Staff travel",
     "value": "Free standby on JetBlue; discounted standby on selected other airlines",
     "note": "Company-wide employee benefit"
    }
   },
   {
    "key": "parental",
    "ref": false,
    "ja": {
     "label": "育児休暇",
     "value": "出産・養子・里子の受け入れから原則30日以内に始めて連続180日。さらに180日延ばせる",
     "note": "労働協約。休んでいる間も勤続は保たれる"
    },
    "en": {
     "label": "Parental leave",
     "value": "180 consecutive days after birth, adoption or foster placement, normally starting within 30 days; can be extended by another 180",
     "note": "Pilot contract. Seniority is retained during leave"
    }
   },
   {
    "key": "relocation",
    "ref": false,
    "ja": {
     "label": "転居の支援",
     "value": "新しい基地の開設・押し出し（displacement）・別基地への呼び戻し・基地の閉鎖で転居するときに支援がある",
     "note": "労働協約。50マイル以上の転居・12か月以内などの条件"
    },
    "en": {
     "label": "Relocation",
     "value": "Moving support when a pilot relocates because of a new base opening, displacement, recall to another base or a base closure",
     "note": "Pilot contract. Conditions apply, e.g. a move of 50+ miles within 12 months"
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "4,687人",
     "note": "労組の説明に載っている人数"
    },
    "en": {
     "label": "Pilot group size",
     "value": "4,687 pilots",
     "note": "As stated by the pilots' union"
    }
   }
  ],
  "work": [
   {
    "key": "vacation",
    "ref": true,
    "ja": {
     "label": "年休",
     "value": "2年目 14日・5年目 14日・12年目 21日・20年目 28日",
     "note": "2025年9月の業界の比較表の値"
    },
    "en": {
     "label": "Vacation",
     "value": "14 days at year 2, 14 at year 5, 21 at year 12, 28 at year 20",
     "note": "From a September 2025 industry comparison table"
    }
   }
  ],
  "life": [
   {
    "key": "parking",
    "ref": false,
    "ja": {
     "label": "駐車場",
     "value": "基地の駐車場は無料（コベースを選んだ人はその空港も無料か精算）。使わないなら月 USD 55 の手当",
     "note": "労働協約"
    },
    "en": {
     "label": "Parking",
     "value": "Free parking at your base (co-base airports free or reimbursed too). Waive it and get USD 55 a month instead",
     "note": "Pilot contract"
    }
   }
  ],
  "stay": [
   {
    "key": "hotel",
    "ref": false,
    "ja": {
     "label": "ステイのホテル",
     "value": "業務での基地外の宿泊は個室。区間の間に5時間の休憩があるとき・訓練・臨時勤務（TDY）にも条件つきで",
     "note": "労働協約。オーランド（MCO）の定期訓練（CQT）は例外あり"
    },
    "en": {
     "label": "Hotel rooms",
     "value": "Single rooms for overnights away from base; with conditions, also for 5-hour breaks between legs, training and TDY",
     "note": "Pilot contract. Exception for recurrent training (CQT) at MCO"
    }
   }
  ]
 },
 "frontier": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": false,
    "ja": {
     "label": "最低保証",
     "value": "ライン・リザーブとも月75時間",
     "note": ""
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "75 hours a month for lineholders and reserves",
     "note": ""
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "超過分の割増",
     "value": "月82.5クレジット時間を超えた分は125%",
     "note": "会社の採用ページの案内"
    },
    "en": {
     "label": "Overtime premium",
     "value": "125% for credit above 82.5 hours a month",
     "note": "Company pilot recruiting page"
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "パーディアム（日当）",
     "value": "1時間 USD 2.15（国内線・国際線とも）",
     "note": "過去の参考値。別の資料では USD 2.20"
    },
    "en": {
     "label": "Per diem",
     "value": "USD 2.15 an hour, domestic and international",
     "note": "Older reference rate; another source shows USD 2.20"
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "改定できる日 2024年1月16日。2023年7月から改定の交渉（Section 6）中",
     "note": "2026年11月の調べ"
    },
    "en": {
     "label": "Contract status",
     "value": "Amendable since January 16, 2024; Section 6 talks since July 2023",
     "note": "As of November 2026"
    }
   },
   {
    "key": "staff_travel",
    "ref": false,
    "ja": {
     "label": "社員の航空券",
     "value": "本人と家族に無料・割引の航空券",
     "note": "会社の案内"
    },
    "en": {
     "label": "Travel benefits",
     "value": "Free and discounted travel for you and your family",
     "note": "Company information"
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "2,260人",
     "note": "パイロットの労組の掲載値"
    },
    "en": {
     "label": "Pilot group",
     "value": "2,260 pilots",
     "note": "Figure posted by the union"
    }
   }
  ],
  "work": [
   {
    "key": "trip_pattern",
    "ref": false,
    "ja": {
     "label": "勤務の形",
     "value": "日帰りの乗務が中心",
     "note": "会社の採用ページの説明"
    },
    "en": {
     "label": "Trip pattern",
     "value": "Mostly day trips (turns)",
     "note": "Company pilot recruiting page"
    }
   }
  ],
  "life": [
   {
    "key": "airport_transit",
    "ref": false,
    "ja": {
     "label": "空港への電車",
     "value": "DEN へは RTD A Line で Union Station から約37分。早朝・深夜もおおむね30分おき",
     "note": "デンバー基地。運賃は1日 USD 10・1か月 USD 88"
    },
    "en": {
     "label": "Rail to DEN",
     "value": "RTD A Line from Union Station, about 37 min; roughly every 30 min early and late",
     "note": "Denver base. Airport Day Pass USD 10, Monthly Pass USD 88"
    }
   }
  ]
 },
 "allegiant": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": true,
    "ja": {
     "label": "最低保証",
     "value": "ライン月70時間・リザーブ月72時間",
     "note": "比較表の参考値"
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "70 hours a month for lineholders, 72 for reserves",
     "note": "Reference figures from a comparison table"
    }
   },
   {
    "key": "duty_period_min",
    "ref": false,
    "ja": {
     "label": "1乗務の最低支給",
     "value": "1回の飛行勤務（FDP）ごとに最低5クレジット時間",
     "note": "2026年の新協約"
    },
    "en": {
     "label": "Duty period minimum",
     "value": "Minimum 5 credit hours per flight duty period (FDP)",
     "note": "2026 CBA"
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "追加乗務の割増",
     "value": "Premium Open Time 1.5〜3倍、追加乗務の募集に応じた分（VFN）2〜3倍、ジュニアアサイン 2倍",
     "note": ""
    },
    "en": {
     "label": "Premium pay",
     "value": "Premium Open Time 1.5–3x, Voluntary Flying Notification 2–3x, junior assignment 2x",
     "note": ""
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "パーディアム（日当）",
     "value": "1時間 USD 2.00（国内線・国際線とも）",
     "note": "2026年の参考値"
    },
    "en": {
     "label": "Per diem",
     "value": "USD 2.00 an hour, domestic and international",
     "note": "2026 reference rate"
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "会社の退職拠出",
     "value": "2027年1月1日から DC（確定拠出）15% に変わる予定",
     "note": ""
    },
    "en": {
     "label": "Company retirement",
     "value": "Moving to a 15% DC contribution on January 1, 2027",
     "note": ""
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "2026年7月31日に2年の新協約を批准。給与は7月1日にさかのぼって適用",
     "note": "労組は Teamsters"
    },
    "en": {
     "label": "Contract status",
     "value": "Two-year CBA ratified July 31, 2026; pay retroactive to July 1, 2026",
     "note": "Teamsters-represented pilots"
    }
   },
   {
    "key": "pay_raises",
    "ref": false,
    "ja": {
     "label": "予定されている昇給",
     "value": "2027年1月1日と2028年1月1日に新しい給与表",
     "note": "上がり幅は年数と職位で違う"
    },
    "en": {
     "label": "Scheduled raises",
     "value": "New pay scales on January 1, 2027 and January 1, 2028",
     "note": "Increase varies by step and seat"
    }
   },
   {
    "key": "disability",
    "ref": false,
    "ja": {
     "label": "所得補償",
     "value": "会社負担の長期所得補償（LTD）を65歳まで",
     "note": "2026年の新協約"
    },
    "en": {
     "label": "Disability",
     "value": "Company-paid long-term disability (LTD) to age 65",
     "note": "2026 CBA"
    }
   },
   {
    "key": "staff_travel",
    "ref": false,
    "ja": {
     "label": "社員の航空券",
     "value": "本人と扶養家族は自社便に空席待ちで無制限。一部の他社便と友人・家族のパスは少額の費用",
     "note": "社員ぜんたいの制度"
    },
    "en": {
     "label": "Travel benefits",
     "value": "Unlimited space-available on Allegiant for you and dependents; small fees for select other airlines and buddy passes",
     "note": "Company-wide employee benefit"
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "約1,300人",
     "note": "パイロットの労組の掲載値"
    },
    "en": {
     "label": "Pilot group",
     "value": "About 1,300 pilots",
     "note": "Figure posted by the union"
    }
   }
  ]
 },
 "fedex-express": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": false,
    "ja": {
     "label": "最低保証",
     "value": "4週の期間で68・5週で85・6週で102クレジット時間",
     "note": "需要が落ちたときの減額、休職・初期訓練中などの例外あり"
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "68 credit hours per 4-week period, 85 per 5-week, 102 per 6-week",
     "note": "Exceptions incl. reductions when demand drops, leave, initial training"
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "国際線の加算",
     "value": "機長 1時間 USD 10・副操縦士 USD 8。超長距離（ULR）はさらに機長 USD 24・副操縦士 USD 17",
     "note": "対象トリップのクレジット時間に付く"
    },
    "en": {
     "label": "International override",
     "value": "CA USD 10/hr, FO USD 8/hr; qualifying ULR adds CA USD 24/hr, FO USD 17/hr",
     "note": "Paid on credit for qualifying trips"
    }
   },
   {
    "key": "per_diem",
    "ref": false,
    "ja": {
     "label": "パーディアム（日当）",
     "value": "国内線 1時間 USD 2.85・国際線 1時間 USD 3.85",
     "note": "2026年の新協約。24か月後に USD 3.00・4.05 の予定"
    },
    "en": {
     "label": "Per diem",
     "value": "USD 2.85 an hour domestic, USD 3.85 international",
     "note": "2026 CBA; rising to USD 3.00 / 4.05 after 24 months"
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "退職給付",
     "value": "在籍者は従来の確定給付（DB）と DC などから選ぶ。新しく入る人は従来の DB の対象外",
     "note": "2026年時点。2028年以降は MBCB（市場連動型の給付）と DC"
    },
    "en": {
     "label": "Retirement",
     "value": "Current pilots choose between the legacy DB plan and DC options; new hires are not eligible for the legacy DB",
     "note": "As of 2026; from 2028, a market-based cash balance (MBCB) plan and DC"
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "2026年6月29日発効。改定できる日 2030年12月",
     "note": "労組は ALPA"
    },
    "en": {
     "label": "Contract status",
     "value": "Effective June 29, 2026; amendable December 2030",
     "note": "ALPA-represented pilots"
    }
   },
   {
    "key": "pay_raises",
    "ref": false,
    "ja": {
     "label": "予定されている昇給",
     "value": "2028年1月・2029年1月・2030年1月にそれぞれ3%",
     "note": "1月のビッド期間から全体に"
    },
    "en": {
     "label": "Scheduled raises",
     "value": "3% each in January 2028, 2029 and 2030",
     "note": "Across the board, from the January bid period"
    }
   },
   {
    "key": "staff_travel",
    "ref": false,
    "ja": {
     "label": "社員の航空券",
     "value": "本人と対象の扶養家族が空席待ちで搭乗できる（personal standby travel）",
     "note": "労組（ALPA）の公開案内"
    },
    "en": {
     "label": "Travel benefits",
     "value": "Personal standby travel for you and eligible dependents",
     "note": "ALPA public guidance"
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "4,876人（労組 ALPA の掲載）・5,800人以上（会社の採用ページ）",
     "note": "掲載元ごとに数が違う"
    },
    "en": {
     "label": "Pilot group",
     "value": "4,876 (ALPA); 5,800+ (company careers page)",
     "note": "Sources differ"
    }
   }
  ],
  "work": [
   {
    "key": "vacation",
    "ref": false,
    "ja": {
     "label": "年休",
     "value": "勤続1〜4年未満 15日・5〜9年未満 22日・10〜19年未満 29日・20年以上 36日",
     "note": "12月31日の勤続で決まり翌年に使う。境目の年は按分、初年は月1.5日"
    },
    "en": {
     "label": "Vacation",
     "value": "15 days (1 to <4 yrs), 22 (5 to <9), 29 (10 to <19), 36 (20+)",
     "note": "Set by Dec 31 seniority, used the next year; prorated in transition years, 1.5 days a month in year one"
    }
   },
   {
    "key": "vacation_pay",
    "ref": false,
    "ja": {
     "label": "年休の支給",
     "value": "年休1日につき6クレジット時間",
     "note": "2026年の協約"
    },
    "en": {
     "label": "Vacation pay",
     "value": "6 credit hours per vacation day",
     "note": "2026 CBA"
    }
   },
   {
    "key": "reserve_lines",
    "ref": false,
    "ja": {
     "label": "リザーブのライン",
     "value": "公開されるリザーブのラインのうち R-24 型を20%以上に（従来は13%）",
     "note": "2026年の新協約"
    },
    "en": {
     "label": "Reserve lines",
     "value": "At least 20% of published reserve lines are R-24 (up from 13%)",
     "note": "2026 CBA"
    }
   }
  ],
  "stay": [
   {
    "key": "hotel",
    "ref": false,
    "ja": {
     "label": "途中停止での休養",
     "value": "MEM・IND などの短い途中停止は、条件付きでホテルの代わりに休養室（sleep room）",
     "note": "2026年の新協約で IND の日中の国内線にも拡大"
    },
    "en": {
     "label": "Sleep rooms",
     "value": "On short en-route stops (MEM, IND, etc.), sleep rooms can replace hotels under set conditions",
     "note": "2026 CBA extends this to daytime domestic flying at IND"
    }
   }
  ]
 },
 "ups-airlines": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": true,
    "ja": {
     "label": "最低保証",
     "value": "28日の給与期間ごとに75クレジット時間",
     "note": "比較資料の値"
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "75 credit hours per 28-day pay period",
     "note": "Comparison-table figure"
    }
   },
   {
    "key": "premiums",
    "ref": true,
    "ja": {
     "label": "国際線の加算",
     "value": "機長 1時間 USD 6.50・副操縦士 USD 4.50。追加乗務には150%などの割増",
     "note": "比較資料の値"
    },
    "en": {
     "label": "International override",
     "value": "CA USD 6.50/hr, FO USD 4.50/hr; premium pay such as 150% for extra flying",
     "note": "Comparison-table figures"
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "パーディアム（日当）",
     "value": "国内線 1時間 USD 3.35・国際線 USD 4.10（太平洋 USD 3.65・欧州 USD 3.40）",
     "note": "2025年1月の額"
    },
    "en": {
     "label": "Per diem",
     "value": "USD 3.35 an hour domestic, USD 4.10 international (Pacific USD 3.65, Europe USD 3.40)",
     "note": "January 2025 rates"
    }
   },
   {
    "key": "retirement",
    "ref": true,
    "ja": {
     "label": "退職給付",
     "value": "会社の DC（確定拠出）拠出12%と確定給付年金（DB）の両方",
     "note": "労組の比較資料"
    },
    "en": {
     "label": "Retirement",
     "value": "12% company DC contribution plus a defined benefit (DB) pension",
     "note": "Union comparison data"
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "改定できる日 2025年9月1日。新協約を交渉中",
     "note": "確認できた最後の全体昇給は2025年9月の3.25%"
    },
    "en": {
     "label": "Contract status",
     "value": "Amendable since September 1, 2025; new contract in negotiation",
     "note": "Last confirmed across-the-board raise: 3.25% in September 2025"
    }
   },
   {
    "key": "jumpseat",
    "ref": false,
    "ja": {
     "label": "ジャンプシート",
     "value": "本人が私用でジャンプシートを使える",
     "note": "公的な資料"
    },
    "en": {
     "label": "Jumpseat",
     "value": "Personal jumpseat travel for yourself",
     "note": "Public records"
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "3,400人超",
     "note": "パイロットの労組の掲載値"
    },
    "en": {
     "label": "Pilot group",
     "value": "More than 3,400 pilots",
     "note": "Figure posted by the union"
    }
   }
  ],
  "work": [
   {
    "key": "vacation",
    "ref": true,
    "ja": {
     "label": "年休",
     "value": "2年目 14日・5年目 21日・12年目 28日・20年目 35日",
     "note": "2025年9月の比較表の値。休日とは別"
    },
    "en": {
     "label": "Vacation",
     "value": "14 days at year 2, 21 at year 5, 28 at year 12, 35 at year 20",
     "note": "September 2025 comparison table; separate from days off"
    }
   }
  ]
 },
 "atlas-air": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": false,
    "ja": {
     "label": "最低保証",
     "value": "月64時間（クレジット時間）",
     "note": "2021年の協約（Teamsters Local 2750）"
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "64 credit hours a month",
     "note": "2021 CBA (Teamsters Local 2750)"
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "パーディアム（日当）",
     "value": "対象の1時間あたり 国内 USD 3.25・国際 USD 4.00",
     "note": "2021年協約の額（USD 2.75・3.50）に毎年 USD 0.10 を足した2026年の額"
    },
    "en": {
     "label": "Per diem",
     "value": "USD 3.25 an hour domestic, USD 4.00 international",
     "note": "2026 rate worked out from the 2021 CBA: USD 2.75 / 3.50 plus USD 0.10 a year, 2022–26"
    }
   },
   {
    "key": "retirement",
    "ref": true,
    "ja": {
     "label": "会社の退職拠出",
     "value": "確定拠出（DC）に会社が 16%（2026年）",
     "note": "外部の給与比較表に載る2026年の率"
    },
    "en": {
     "label": "Retirement",
     "value": "16% company DC contribution (2026)",
     "note": "2026 rate from a third-party pay table"
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "協約の状況",
     "value": "2021年の協約。最後の定期昇給は2025年9月1日の 3%。2026年9月10日から改定できる",
     "note": "Teamsters Local 2750"
    },
    "en": {
     "label": "Contract status",
     "value": "2021 CBA; last scheduled raise was 3% on September 1, 2025; amendable from September 10, 2026",
     "note": "Teamsters Local 2750"
    }
   },
   {
    "key": "staff_travel",
    "ref": false,
    "ja": {
     "label": "社員の航空券",
     "value": "本人と対象の家族が空席待ち（スタンバイ）で搭乗できる",
     "note": "社員ぜんたいの制度（会社の案内）。業務のゲートウェイ移動とは別"
    },
    "en": {
     "label": "Staff travel",
     "value": "Standby travel for you and eligible family members",
     "note": "Company-wide employee benefit; separate from gateway travel for work"
    }
   },
   {
    "key": "health",
    "ref": false,
    "ja": {
     "label": "保険",
     "value": "医療・歯科・眼科の保険",
     "note": "社員ぜんたいの制度（会社の案内）"
    },
    "en": {
     "label": "Health cover",
     "value": "Medical, dental and vision plans",
     "note": "Company-wide employee benefit"
    }
   }
  ],
  "work": [
   {
    "key": "vacation",
    "ref": false,
    "ja": {
     "label": "年休",
     "value": "勤続6年未満 14日・6〜11年 21日・12年以上 28日（1年あたり）",
     "note": "2021年の協約。月に15日以上の在籍（active）などが付与の条件"
    },
    "en": {
     "label": "Vacation",
     "value": "14 days under 6 years, 21 days at 6–11 years, 28 days from 12 years",
     "note": "2021 CBA; accrual requires at least 15 active days in the month, among other conditions"
    }
   },
   {
    "key": "commuter",
    "ref": false,
    "ja": {
     "label": "ゲートウェイ方式",
     "value": "ゲートウェイ空港から乗務までの移動は会社が手配（対象になる条件あり）",
     "note": "2021年の協約と会社の案内"
    },
    "en": {
     "label": "Gateway travel",
     "value": "Company-arranged travel from your gateway airport to the trip, subject to eligibility",
     "note": "2021 CBA and company crew information"
    }
   }
  ],
  "life": [
   {
    "key": "parking",
    "ref": false,
    "ja": {
     "label": "空港までの交通費",
     "value": "自宅からゲートウェイ空港までの移動・有料道路・駐車は自分で払う",
     "note": "2021年の協約"
    },
    "en": {
     "label": "Getting to the gateway",
     "value": "Mileage, tolls and parking between home and the gateway airport are paid by the pilot",
     "note": "2021 CBA"
    }
   }
  ],
  "stay": [
   {
    "key": "hotel",
    "ref": false,
    "ja": {
     "label": "ホテル",
     "value": "訓練中・ベースでの滞在中・乗務の前後・リザーブ中は会社負担のホテル。協約で個室",
     "note": "会社の乗員案内と2021年の協約"
    },
    "en": {
     "label": "Hotels",
     "value": "Company-paid hotels in training, in base, before and after trips and on reserve; single rooms under the CBA",
     "note": "Company crew information and 2021 CBA"
    }
   }
  ]
 },
 "abx-air": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": false,
    "ja": {
     "label": "最低保証",
     "value": "2週間の給与期間ごとに 29.92 クレジット時間",
     "note": "組合（APA Teamsters Local 1224）の2026年の採用資料"
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "29.92 credit hours per biweekly pay period",
     "note": "2026 hiring material from the union (APA Teamsters Local 1224)"
    }
   },
   {
    "key": "per_diem",
    "ref": false,
    "ja": {
     "label": "パーディアム（日当）",
     "value": "1日あたり 国内 USD 71.00・国際 USD 93.00・太平洋 USD 94.75・米領カリブ／カナダ／メキシコ USD 78.50",
     "note": "2026年1月1日からの日額（時間単位ではない）"
    },
    "en": {
     "label": "Per diem",
     "value": "USD 71.00 a day domestic, USD 93.00 international, USD 94.75 Pacific, USD 78.50 US Caribbean/Canada/Mexico",
     "note": "Daily rates from January 1, 2026, not hourly"
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "追加乗務の割増",
     "value": "プレミアムデーは 6時間か150%・7時間か175%・8時間か200% の高い方。オープントリップは最低 4〜8時間",
     "note": "組合の2026年の採用資料"
    },
    "en": {
     "label": "Premium pay",
     "value": "Premium days pay the greater of 6 hours or 150%, 7 hours or 175%, 8 hours or 200%; open trips carry a 4–8 hour minimum",
     "note": "Union's 2026 hiring material"
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "会社の退職拠出",
     "value": "会社の DC 拠出 2026年 14%・2027〜30年 15%（業績で +1%）。本人の拠出は不要。IRS の上限を超える分は現金",
     "note": "組合（APA Teamsters Local 1224）の採用資料"
    },
    "en": {
     "label": "Retirement",
     "value": "Company DC contribution of 14% in 2026, 15% in 2027–30, plus 1% on performance; no match required; amounts over the IRS cap paid in cash",
     "note": "Union hiring material (APA Teamsters Local 1224)"
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "協約の昇給予定",
     "value": "2027〜2030年の毎年1月1日に約3%の昇給（各年の給与表あり）",
     "note": "組合（APA Teamsters Local 1224）の採用資料"
    },
    "en": {
     "label": "Scheduled raises",
     "value": "About 3% every January 1 from 2027 to 2030, with a pay table for each year",
     "note": "Union hiring material (APA Teamsters Local 1224)"
    }
   },
   {
    "key": "health",
    "ref": false,
    "ja": {
     "label": "医療保険",
     "value": "医療は UnitedHealthcare で保険料の75%を会社が負担。歯科・眼科の保険あり",
     "note": "組合の採用案内"
    },
    "en": {
     "label": "Health cover",
     "value": "UnitedHealthcare medical with 75% of the premium paid by the company; dental and vision",
     "note": "Union hiring material"
    }
   },
   {
    "key": "disability",
    "ref": false,
    "ja": {
     "label": "所得補償・生命保険",
     "value": "短期・長期の所得補償（disability）と生命保険",
     "note": "組合の採用案内"
    },
    "en": {
     "label": "Disability, life",
     "value": "Short- and long-term disability and life insurance",
     "note": "Union hiring material"
    }
   }
  ],
  "work": [
   {
    "key": "days_off",
    "ref": false,
    "ja": {
     "label": "月の最低休日",
     "value": "ライン 14日・リザーブ 13日・コンポジット 14日。1週間の年休がかかる月は 21日・20日・21日",
     "note": "組合の2026年の採用資料"
    },
    "en": {
     "label": "Minimum days off",
     "value": "14 for lineholders, 13 on reserve, 14 composite; 21, 20 and 21 in a month with a vacation week",
     "note": "Union's 2026 hiring material"
    }
   },
   {
    "key": "pattern",
    "ref": false,
    "ja": {
     "label": "勤務の型",
     "value": "7日勤務・7日休み、8日・6日、9日・5日 などの例。月の乗務は 45〜50 ブロック時間が典型",
     "note": "組合の2026年の採用資料にある例と典型値"
    },
    "en": {
     "label": "Typical schedule",
     "value": "Patterns such as 7 on/7 off, 8/6 and 9/5; typically 45–50 block hours a month",
     "note": "Examples and typical figure from the union's 2026 hiring material"
    }
   },
   {
    "key": "vacation",
    "ref": false,
    "ja": {
     "label": "年休",
     "value": "1年未満は月1日・1〜4年 14日・5〜14年 21日・15年以上 28日（1年あたり）",
     "note": "組合の採用資料"
    },
    "en": {
     "label": "Vacation",
     "value": "1 day a month in the first year; 14 days at 1–4 years, 21 at 5–14, 28 from 15 years",
     "note": "Union hiring material"
    }
   },
   {
    "key": "commuter",
    "ref": false,
    "ja": {
     "label": "航空通勤",
     "value": "他社機のジャンプシートに乗れる仕組み（CASS）あり。国内は出頭前に着く便に1便リストすれば保護",
     "note": "組合の採用資料。業務のデッドヘッドとは別"
    },
    "en": {
     "label": "Commuting",
     "value": "CASS jumpseat access; domestic commuters are protected after listing for one flight due in before report",
     "note": "Union hiring material; separate from company deadheads"
    }
   },
   {
    "key": "sick_leave",
    "ref": false,
    "ja": {
     "label": "病気休暇",
     "value": "勤続13か月目に 12日、その後は月1日ずつ・上限なし",
     "note": "組合の採用資料"
    },
    "en": {
     "label": "Sick leave",
     "value": "12 days in month 13, then 1 a month with no cap",
     "note": "Union hiring material"
    }
   },
   {
    "key": "training",
    "ref": false,
    "ja": {
     "label": "初期訓練",
     "value": "約60日。訓練中も 65時間の保証・パーディアム・個室のホテル",
     "note": "組合の採用資料"
    },
    "en": {
     "label": "Initial training",
     "value": "About 60 days, with a 65-hour guarantee, per diem and a single room",
     "note": "Union hiring material"
    }
   }
  ],
  "stay": [
   {
    "key": "hotel",
    "ref": false,
    "ja": {
     "label": "ホテル・食事",
     "value": "乗務中は個室のホテル。空港でリザーブ待機する間も会社のホテル。乗務中はクルーミールが出る",
     "note": "組合の採用資料"
    },
    "en": {
     "label": "Hotels, meals",
     "value": "Single rooms on trips; a company hotel during airport reserve standby; crew meals on duty",
     "note": "Union hiring material"
    }
   }
  ]
 },
 "kalitta-air": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": false,
    "ja": {
     "label": "最低保証",
     "value": "月64時間",
     "note": ""
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "64 hours a month",
     "note": ""
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "休日の乗務",
     "value": "休日に飛ぶと 150%。休日への強制アサイン（ジュニアマンニング）は無い",
     "note": ""
    },
    "en": {
     "label": "Days-off flying",
     "value": "150% for flying on a day off; no junior manning",
     "note": ""
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "会社の退職拠出",
     "value": "401(k) の確定拠出（DC）に会社が 12%",
     "note": "本人の拠出へのマッチとは別枠"
    },
    "en": {
     "label": "Retirement",
     "value": "12% company DC contribution to the 401(k)",
     "note": "Separate from any match on your own contributions"
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "パーディアム（日当）",
     "value": "対象の1時間あたり 国内 USD 2.65・国際 USD 3.55",
     "note": "外部の給与比較表に載る参考値"
    },
    "en": {
     "label": "Per diem",
     "value": "USD 2.65 an hour domestic, USD 3.55 international",
     "note": "Figure from a third-party pay table"
    }
   },
   {
    "key": "health",
    "ref": false,
    "ja": {
     "label": "保険",
     "value": "医療・歯科・眼科は Blue Cross Blue Shield（BCBS）",
     "note": ""
    },
    "en": {
     "label": "Health cover",
     "value": "Blue Cross Blue Shield medical, dental and vision",
     "note": ""
    }
   }
  ],
  "work": [
   {
    "key": "commuter",
    "ref": false,
    "ja": {
     "label": "航空通勤（ホーム方式）",
     "value": "米国内のほぼどこに住んでもよい（アラスカ・ハワイ含む）。乗務への往復は会社が買う確定席",
     "note": "業務の割当てへの移動。私用の旅行とは別"
    },
    "en": {
     "label": "Home-based commuting",
     "value": "Live almost anywhere in the US, Alaska and Hawaii included; the company buys positive-space travel to and from each assignment",
     "note": "Covers travel to work assignments, not personal travel"
    }
   },
   {
    "key": "schedule",
    "ref": false,
    "ja": {
     "label": "勤務と休みの型",
     "value": "16日勤務・15日休み（30日の月は14日）。可能なときは16日連続か 8日勤務・15日休み・8日勤務などをビッドできる",
     "note": ""
    },
    "en": {
     "label": "Schedule",
     "value": "16 on/15 off (14 off in 30-day months); when possible, bid 16 straight or splits such as 8 on/15 off/8 on",
     "note": ""
    }
   },
   {
    "key": "training",
    "ref": false,
    "ja": {
     "label": "訓練",
     "value": "B747・B777 の訓練はミシガン州イプシランティの本部。訓練の初日から満額の乗務給",
     "note": ""
    },
    "en": {
     "label": "Training",
     "value": "B747/B777 training at the Ypsilanti, Michigan headquarters, with full flight pay from day one",
     "note": ""
    }
   }
  ]
 },
 "breeze-airways": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": true,
    "ja": {
     "label": "最低保証",
     "value": "ライン・リザーブとも月70時間",
     "note": "参考の値"
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "70 hours a month, line and reserve",
     "note": "Reference figure"
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "パーディアム（日当）",
     "value": "国内線 1時間 USD 2.00",
     "note": "参考の掲載値"
    },
    "en": {
     "label": "Per diem",
     "value": "USD 2.00 an hour domestic",
     "note": "Reference figure"
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "初めての協約を交渉中。パイロットの労組は ALPA（2022年から）",
     "note": ""
    },
    "en": {
     "label": "Contract status",
     "value": "Negotiating a first contract; pilots represented by ALPA since 2022",
     "note": ""
    }
   }
  ]
 },
 "avelo-airlines": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": false,
    "ja": {
     "label": "最低保証",
     "value": "ライン・リザーブとも月70時間",
     "note": "会社の公開値"
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "70 hours a month, line and reserve",
     "note": "Company-published"
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "割増",
     "value": "月75時間を超えた分と、休日に飛んだ分は通常の単価の125%",
     "note": "会社の公開値"
    },
    "en": {
     "label": "Premium pay",
     "value": "125% for hours over 75 a month and for flying on days off",
     "note": "Company-published"
    }
   },
   {
    "key": "profit_sharing",
    "ref": false,
    "ja": {
     "label": "利益分配",
     "value": "あり。会社の利益目標を達成したとき",
     "note": ""
    },
    "en": {
     "label": "Profit sharing",
     "value": "Yes, when the company hits its profit targets",
     "note": ""
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "パーディアム（日当）",
     "value": "国内線 1時間 USD 2.25",
     "note": "参考の掲載値"
    },
    "en": {
     "label": "Per diem",
     "value": "USD 2.25 an hour domestic",
     "note": "Reference figure"
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "会社の退職拠出",
     "value": "本人拠出の最初の3%に100%・次の2%に50%を会社が上乗せ。本人5%で会社は最大4%",
     "note": "すぐに権利が確定（即時ベスティング）"
    },
    "en": {
     "label": "Retirement match",
     "value": "100% on the first 3% you put in, 50% on the next 2% — up to 4% from the company at 5%",
     "note": "Immediate vesting"
    }
   }
  ],
  "work": [
   {
    "key": "days_off",
    "ref": false,
    "ja": {
     "label": "月の最低休日",
     "value": "ライン・リザーブとも月12日",
     "note": "会社の公開値"
    },
    "en": {
     "label": "Minimum days off",
     "value": "12 a month, line and reserve",
     "note": "Company-published"
    }
   },
   {
    "key": "training",
    "ref": false,
    "ja": {
     "label": "訓練中の給与",
     "value": "月 USD 6,020",
     "note": "今の採用案内の額"
    },
    "en": {
     "label": "Training pay",
     "value": "USD 6,020 a month",
     "note": "Current recruiting information"
    }
   },
   {
    "key": "commuter",
    "ref": true,
    "ja": {
     "label": "航空通勤",
     "value": "他社機のジャンプシート（CASS）を使える",
     "note": "参考の情報"
    },
    "en": {
     "label": "Commuting",
     "value": "Jumpseat access through CASS",
     "note": "Reference information"
    }
   }
  ]
 },
 "gojet": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": true,
    "ja": {
     "label": "最低保証",
     "value": "月75時間",
     "note": "2026年の求人の転載にある参考の値"
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "75 hours a month",
     "note": "Reference figure from a 2026 job-ad repost"
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "会社の退職拠出",
     "value": "本人の拠出に会社が50%を上乗せ（マッチ）",
     "note": "会社のページ"
    },
    "en": {
     "label": "Retirement match",
     "value": "50% company match on your contributions",
     "note": "Company website"
    }
   },
   {
    "key": "union",
    "ref": false,
    "ja": {
     "label": "労組",
     "value": "Teamsters",
     "note": ""
    },
    "en": {
     "label": "Union",
     "value": "Teamsters",
     "note": ""
    }
   },
   {
    "key": "staff_travel",
    "ref": false,
    "ja": {
     "label": "社員の航空券",
     "value": "United の航空券の優待。他社は ZED 運賃（航空会社の社員向けの割引運賃）",
     "note": "社員ぜんたいの制度"
    },
    "en": {
     "label": "Staff travel",
     "value": "United travel privileges; ZED fares on other airlines",
     "note": "Company-wide employee benefit"
    }
   },
   {
    "key": "health",
    "ref": false,
    "ja": {
     "label": "保険",
     "value": "医療 UnitedHealthcare・歯科 Delta Dental・眼科 VSP",
     "note": "社員ぜんたいの制度"
    },
    "en": {
     "label": "Health cover",
     "value": "Medical (UnitedHealthcare), dental (Delta Dental), vision (VSP)",
     "note": "Company-wide employee benefit"
    }
   },
   {
    "key": "disability",
    "ref": false,
    "ja": {
     "label": "所得補償・生命保険",
     "value": "長期の所得補償（LTD）・事故の死亡傷害（AD&D）・生命保険",
     "note": "社員ぜんたいの制度"
    },
    "en": {
     "label": "Disability & life",
     "value": "Long-term disability, AD&D and life insurance",
     "note": "Company-wide employee benefit"
    }
   },
   {
    "key": "uniform",
    "ref": false,
    "ja": {
     "label": "制服手当",
     "value": "月 USD 25",
     "note": ""
    },
    "en": {
     "label": "Uniform allowance",
     "value": "USD 25 a month",
     "note": ""
    }
   }
  ],
  "work": [
   {
    "key": "training",
    "ref": false,
    "ja": {
     "label": "直接入社の機長",
     "value": "初期訓練の移動とホテルは会社負担",
     "note": "機長での直接入社（DEC）の場合"
    },
    "en": {
     "label": "Direct-entry captains",
     "value": "Company-paid travel and hotels for initial training",
     "note": "Direct-entry captain (DEC) hires"
    }
   }
  ]
 },
 "northern-air-cargo": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": true,
    "ja": {
     "label": "最低保証",
     "value": "ライン・リザーブとも月65クレジット時間",
     "note": "参考の条件"
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "65 credit hours a month, line and reserve",
     "note": "Reference terms"
    }
   },
   {
    "key": "premiums",
    "ref": true,
    "ja": {
     "label": "割増",
     "value": "オープンタイムは150%。ジュニアマン（指名の追加乗務）は1回目200%・2回目250%、90日に2回まで",
     "note": "参考の条件"
    },
    "en": {
     "label": "Premium pay",
     "value": "Open time 150%; junior man 200% the first time and 250% the second, max twice in 90 days",
     "note": "Reference terms"
    }
   },
   {
    "key": "retirement",
    "ref": true,
    "ja": {
     "label": "会社の退職拠出",
     "value": "会社の上乗せ（マッチ）あり。以前の表では 4%、3年後から 8%",
     "note": "率は以前の表の値"
    },
    "en": {
     "label": "Retirement",
     "value": "Company match; an older table shows 4%, rising to 8% after three years",
     "note": "Rates from an older table"
    }
   },
   {
    "key": "health",
    "ref": false,
    "ja": {
     "label": "保険",
     "value": "医療・歯科・眼科・処方薬、生命保険",
     "note": "社員ぜんたいの制度"
    },
    "en": {
     "label": "Health cover",
     "value": "Medical, dental, vision, prescription and life insurance",
     "note": "Company-wide employee benefit"
    }
   },
   {
    "key": "staff_travel",
    "ref": false,
    "ja": {
     "label": "社員の航空券",
     "value": "他社の航空券の割引（インターライン）",
     "note": "社員ぜんたいの制度"
    },
    "en": {
     "label": "Staff travel",
     "value": "Interline discounts on other airlines",
     "note": "Company-wide employee benefit"
    }
   }
  ],
  "work": [
   {
    "key": "jumpseat",
    "ref": true,
    "ja": {
     "label": "ジャンプシート",
     "value": "他社機のジャンプシート（CASS）を使える",
     "note": "参考の情報"
    },
    "en": {
     "label": "Jumpseat",
     "value": "Jumpseat access through CASS",
     "note": "Reference information"
    }
   }
  ]
 },
 "contour": {
  "pay": [
   {
    "key": "premiums",
    "ref": true,
    "ja": {
     "label": "割増",
     "value": "月18勤務日を超えた勤務などは150%。日額は年俸を216で割った額",
     "note": "参考の条件"
    },
    "en": {
     "label": "Premium pay",
     "value": "150% for duty beyond 18 days a month, among others; day rate is annual salary ÷ 216",
     "note": "Reference terms"
    }
   },
   {
    "key": "per_diem",
    "ref": false,
    "ja": {
     "label": "パーディアム（日当）",
     "value": "定期便 国内 USD 2.08・国際 USD 3.14、チャーター 国内 USD 3.08・国際 USD 4.14",
     "note": "1時間あたりの額。会社の公開値"
    },
    "en": {
     "label": "Per diem",
     "value": "Scheduled: USD 2.08 domestic, USD 3.14 international; charter: USD 3.08 and USD 4.14",
     "note": "Hourly rates; company-published"
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "会社の退職拠出",
     "value": "401(k)（確定拠出年金）に会社が最大6%を上乗せ（マッチ）。入社日から",
     "note": "会社の採用ページ"
    },
    "en": {
     "label": "Retirement match",
     "value": "401(k) match up to 6%, from your first day",
     "note": "Company careers page"
    }
   },
   {
    "key": "staff_travel",
    "ref": false,
    "ja": {
     "label": "社員の航空券",
     "value": "Contour の便と他社の優待（MyIDTravel）。対象の家族も",
     "note": "社員ぜんたいの制度"
    },
    "en": {
     "label": "Staff travel",
     "value": "Travel on Contour and other airlines via MyIDTravel, including eligible family",
     "note": "Company-wide employee benefit"
    }
   },
   {
    "key": "health",
    "ref": false,
    "ja": {
     "label": "保険",
     "value": "医療・歯科・眼科、短期・長期の所得補償",
     "note": "社員ぜんたいの制度"
    },
    "en": {
     "label": "Health cover",
     "value": "Medical, dental and vision; short- and long-term disability",
     "note": "Company-wide employee benefit"
    }
   }
  ],
  "work": [
   {
    "key": "training",
    "ref": true,
    "ja": {
     "label": "初期訓練",
     "value": "7〜8週間。初日から給与、個室のホテル・移動・パーディアム",
     "note": "参考の条件"
    },
    "en": {
     "label": "Initial training",
     "value": "7–8 weeks; paid from day one, with single hotel rooms, travel and per diem",
     "note": "Reference terms"
    }
   },
   {
    "key": "jumpseat",
    "ref": false,
    "ja": {
     "label": "ジャンプシート",
     "value": "他社機のジャンプシート（CASS）を使える",
     "note": ""
    },
    "en": {
     "label": "Jumpseat",
     "value": "Jumpseat access through CASS",
     "note": ""
    }
   }
  ]
 },
 "air-canada": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": false,
    "ja": {
     "label": "最低保証",
     "value": "入社から2年間の副操縦士は月75時間以上。その後は機材・ライン・リザーブで変わる。年900時間の調整もある",
     "note": "2023〜2027年の協約"
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "75+ hours a month for first officers in their first two years; after that it varies by fleet and line or reserve, with a 900-hour annual adjustment",
     "note": "2023–2027 CBA"
    }
   },
   {
    "key": "per_diem",
    "ref": false,
    "ja": {
     "label": "パーディアム（日当）",
     "value": "カナダ・米国は政府の出張基準（NJC）の地域の日額の85%を24で割った時間額。海外は地域で65%・70%・75%など",
     "note": "協約の決め方。半年ごとに見直し"
    },
    "en": {
     "label": "Per diem",
     "value": "Canada/US: 85% of the NJC regional daily rate ÷ 24, paid by the hour; international: 65%, 70% or 75% by region",
     "note": "Contract formula; updated every six months"
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "会社の年金",
     "value": "入社の時期で確定給付（DB）・複数事業主の年金（MEPP）・確定拠出（DC）などに分かれる",
     "note": ""
    },
    "en": {
     "label": "Pension",
     "value": "DB, MEPP or DC plans, depending on when you were hired",
     "note": ""
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "2023年9月30日〜2027年9月29日。今の給与表は2026年9月30日から",
     "note": "ALPA"
    },
    "en": {
     "label": "Contract status",
     "value": "CBA runs Sep 30, 2023 – Sep 29, 2027; current pay rates effective Sep 30, 2026",
     "note": "ALPA"
    }
   },
   {
    "key": "health",
    "ref": false,
    "ja": {
     "label": "保険",
     "value": "医療・歯科などの保険",
     "note": "社員ぜんたいの制度"
    },
    "en": {
     "label": "Health cover",
     "value": "Medical, dental and other cover",
     "note": "Company-wide employee benefit"
    }
   }
  ],
  "work": [
   {
    "key": "training",
    "ref": false,
    "ja": {
     "label": "訓練中",
     "value": "ホテルと食事。距離の条件で滞在を選べる。会社の送迎が無いときはタクシー代を領収書で精算",
     "note": "訓練のときの決まり。ふだんの通勤とは別"
    },
    "en": {
     "label": "During training",
     "value": "Hotel and meals, with stay options based on distance; receipted taxi fares reimbursed when no transport is provided",
     "note": "Training only — not your regular commute"
    }
   }
  ]
 },
 "westjet": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": true,
    "ja": {
     "label": "最低保証",
     "value": "月77.5時間",
     "note": "参考の値"
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "77.5 hours a month",
     "note": "Reference figure"
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "割増",
     "value": "85クレジット時間を超えた分は割増",
     "note": "会社の案内"
    },
    "en": {
     "label": "Premium pay",
     "value": "Premium pay above 85 credit hours",
     "note": "Company information"
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "WestJet 本体（Mainline）の協約は2023年1月1日〜2026年12月31日",
     "note": "ALPA。Encore は別"
    },
    "en": {
     "label": "Contract status",
     "value": "Mainline CBA runs Jan 1, 2023 – Dec 31, 2026",
     "note": "ALPA; Encore is separate"
    }
   }
  ],
  "work": [
   {
    "key": "bidding",
    "ref": false,
    "ja": {
     "label": "勤務の希望",
     "value": "ソーシャライズド・ビッド（先任順位だけで決めない）。勤務の交換・削除・追加ができる",
     "note": ""
    },
    "en": {
     "label": "Bidding",
     "value": "Socialized bidding (not seniority-only); trips can be traded, dropped and picked up",
     "note": ""
    }
   },
   {
    "key": "reserve",
    "ref": false,
    "ja": {
     "label": "リザーブ",
     "value": "短い呼び出し（ショートコール）と長い呼び出し（ロングコール）のリザーブがある",
     "note": ""
    },
    "en": {
     "label": "Reserve",
     "value": "Short-call and long-call reserve",
     "note": ""
    }
   },
   {
    "key": "jumpseat",
    "ref": false,
    "ja": {
     "label": "ジャンプシート",
     "value": "他社と相互のジャンプシート（レシプロカル）",
     "note": "会社の案内"
    },
    "en": {
     "label": "Jumpseat",
     "value": "Reciprocal jumpseat agreements",
     "note": "Company information"
    }
   }
  ]
 },
 "jazz": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": true,
    "ja": {
     "label": "最低保証",
     "value": "月75時間",
     "note": "参考の条件"
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "75 hours a month",
     "note": "Reference terms"
    }
   },
   {
    "key": "per_diem",
    "ref": false,
    "ja": {
     "label": "パーディアムなど",
     "value": "給与とは別の手当が年平均 約 CAD 9,000。求人の例では月 CAD 800〜1,000",
     "note": "会社の例。勤務で変わる"
    },
    "en": {
     "label": "Per diem & allowances",
     "value": "Non-salary allowances average about CAD 9,000 a year; job ads cite CAD 800–1,000 a month",
     "note": "Company examples; varies with flying"
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "会社の退職拠出",
     "value": "確定拠出（DC）の年金に会社が最大8%を上乗せ（マッチ）。在籍などで変わる",
     "note": "会社の案内"
    },
    "en": {
     "label": "Retirement match",
     "value": "DC pension match up to 8%, depending on service",
     "note": "Company information"
    }
   },
   {
    "key": "medical_cost",
    "ref": false,
    "ja": {
     "label": "身体検査などの手当",
     "value": "身体検査・パスポート・制服などの手当が年 CAD 1,600 超",
     "note": "会社の例"
    },
    "en": {
     "label": "Medicals & other allowances",
     "value": "Over CAD 1,600 a year for medicals, passport, uniforms and more",
     "note": "Company example"
    }
   },
   {
    "key": "union",
    "ref": false,
    "ja": {
     "label": "労組",
     "value": "ALPA",
     "note": ""
    },
    "en": {
     "label": "Union",
     "value": "ALPA",
     "note": ""
    }
   },
   {
    "key": "staff_travel",
    "ref": false,
    "ja": {
     "label": "社員の航空券",
     "value": "Air Canada の社員の航空券の優待",
     "note": "社員ぜんたいの制度"
    },
    "en": {
     "label": "Staff travel",
     "value": "Air Canada staff travel privileges",
     "note": "Company-wide employee benefit"
    }
   }
  ],
  "work": [
   {
    "key": "bidding",
    "ref": false,
    "ja": {
     "label": "勤務の希望",
     "value": "先任順位で希望を出す。アプリで出せる",
     "note": "会社の案内"
    },
    "en": {
     "label": "Bidding",
     "value": "Seniority-based bidding, done through an app",
     "note": "Company information"
    }
   },
   {
    "key": "equipment",
    "ref": false,
    "ja": {
     "label": "支給の機器",
     "value": "iPad と Bose のヘッドセット",
     "note": "会社の案内"
    },
    "en": {
     "label": "Equipment",
     "value": "iPad and Bose headset provided",
     "note": "Company information"
    }
   }
  ]
 },
 "porter": {
  "pay": [
   {
    "key": "min_guarantee",
    "ref": true,
    "ja": {
     "label": "最低保証",
     "value": "月77.5時間",
     "note": "第三者の参考の値"
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "77.5 hours a month",
     "note": "Third-party reference figure"
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "2025年8月12日に ALPA の組合ができた。初めての協約を交渉中",
     "note": ""
    },
    "en": {
     "label": "Contract status",
     "value": "Pilots joined ALPA on Aug 12, 2025; first ALPA contract under negotiation",
     "note": ""
    }
   }
  ]
 }
});
