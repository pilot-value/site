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
     "value": "月65時間分",
     "note": ""
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "65 credit hours a month",
     "note": ""
    }
   },
   {
    "key": "reserve_guarantee",
    "ref": false,
    "ja": {
     "label": "最低保証（Reserve - STBY要員の月）",
     "value": "72〜80時間分（その月の Line（乗務が決まっている月）の平均時間に連動）",
     "note": ""
    },
    "en": {
     "label": "Reserve guarantee",
     "value": "72–80 hours, tied to the month's average line value (ALV)",
     "note": ""
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "加算・割増",
     "value": "",
     "rows": [
      [
       "国際線の加算（機長）",
       "1時間 USD 6.50"
      ],
      [
       "国際線の加算（副操縦士）",
       "1時間 USD 4.50"
      ],
      [
       "対象の追加の乗務",
       "1時間の単価の1.5倍か2倍"
      ],
      [
       "祝日の乗務",
       "割増あり"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Override & premiums",
     "value": "",
     "rows": [
      [
       "International override (CA)",
       "USD 6.50/hr"
      ],
      [
       "International override (FO)",
       "USD 4.50/hr"
      ],
      [
       "Eligible extra flying",
       "150% or 200%"
      ],
      [
       "Holiday flying",
       "Paid at a premium"
      ]
     ],
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
     "label": "日当",
     "value": "",
     "rows": [
      [
       "国内線",
       "1時間 USD 3.30"
      ],
      [
       "国際線",
       "1時間 USD 3.55"
      ]
     ],
     "note": "2025年1月の額。毎年見直し"
    },
    "en": {
     "label": "Per diem",
     "value": "",
     "rows": [
      [
       "Domestic",
       "USD 3.30/hr"
      ],
      [
       "International",
       "USD 3.55/hr"
      ]
     ],
     "note": "January 2025 rates, adjusted every year"
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "会社の年金の積み立て",
     "value": "給与とは別に、会社が給与の18%を確定拠出年金（DC）に積み立てる",
     "note": ""
    },
    "en": {
     "label": "Retirement",
     "value": "18% company DC contribution, on top of pay",
     "note": ""
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "",
     "rows": [
      [
       "改定交渉に入れる日",
       "2026年12月31日"
      ],
      [
       "2026年1月1日",
       "4%の昇給（実施済み）"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Contract",
     "value": "",
     "rows": [
      [
       "Amendable",
       "Dec 31, 2026"
      ],
      [
       "Jan 1, 2026",
       "4% raise (in effect)"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "health",
    "ref": false,
    "ja": {
     "label": "医療保険",
     "value": "医療・歯科・眼科の保険",
     "note": ""
    },
    "en": {
     "label": "Health insurance",
     "value": "Medical, dental and vision",
     "note": ""
    }
   },
   {
    "key": "disability",
    "ref": false,
    "ja": {
     "label": "働けなくなったときの補償",
     "value": "",
     "rows": [
      [
       "長期の所得補償（LTD）",
       "会社負担"
      ],
      [
       "短期の所得補償（STD）",
       "希望者が加入"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Disability insurance",
     "value": "",
     "rows": [
      [
       "Long-term disability (LTD)",
       "Company-paid"
      ],
      [
       "Short-term disability (STD)",
       "Optional"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "family_support",
    "ref": false,
    "ja": {
     "label": "家族の支援",
     "value": "家族のケアと養子縁組の支援",
     "note": ""
    },
    "en": {
     "label": "Family support",
     "value": "Family care and adoption support",
     "note": ""
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "17,281人",
     "note": ""
    },
    "en": {
     "label": "Pilot group size",
     "value": "17,281 pilots",
     "note": ""
    }
   }
  ],
  "work": [
   {
    "key": "vacation",
    "ref": true,
    "ja": {
     "label": "年休",
     "value": "",
     "rows": [
      [
       "2年目",
       "年14日"
      ],
      [
       "5年目",
       "年21日"
      ],
      [
       "12年目",
       "年28日"
      ],
      [
       "20年目",
       "年35日"
      ]
     ],
     "note": "2025年9月時点"
    },
    "en": {
     "label": "Vacation",
     "value": "",
     "rows": [
      [
       "Year 2",
       "14 days"
      ],
      [
       "Year 5",
       "21 days"
      ],
      [
       "Year 12",
       "28 days"
      ],
      [
       "Year 20",
       "35 days"
      ]
     ],
     "note": "As of September 2025"
    }
   }
  ],
  "life": [
   {
    "key": "airport_transit",
    "ref": false,
    "ja": {
     "label": "ATL への鉄道",
     "value": "",
     "rows": [
      [
       "路線",
       "MARTA の赤線・金線で国内線ターミナルへ"
      ],
      [
       "平日",
       "4:45〜翌1:00"
      ],
      [
       "週末",
       "6:00〜翌1:00"
      ],
      [
       "運賃",
       "USD 2.50"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Rail to ATL",
     "value": "",
     "rows": [
      [
       "Route",
       "MARTA Red/Gold lines to the domestic terminal"
      ],
      [
       "Weekdays",
       "4:45 a.m.–1:00 a.m."
      ],
      [
       "Weekends",
       "6:00 a.m.–1:00 a.m."
      ],
      [
       "Fare",
       "USD 2.50"
      ]
     ],
     "note": ""
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
     "value": "月70時間分。割り当てられた勤務がそれより少なくても、70時間分を払う",
     "note": "2024年5月から"
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "70 credit hours; PBS awards below 70 are raised to 70",
     "note": "Since May 2024"
    }
   },
   {
    "key": "reserve_guarantee",
    "ref": true,
    "ja": {
     "label": "最低保証（Reserve - STBY要員の月）",
     "value": "",
     "rows": [
      [
       "6月・7月・8月・12月",
       "77時間分"
      ],
      [
       "ほかの月",
       "73時間分"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Reserve guarantee",
     "value": "",
     "rows": [
      [
       "June, July, August, December",
       "77 hours"
      ],
      [
       "Other months",
       "73 hours"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "加算・割増",
     "value": "",
     "rows": [
      [
       "国際線の加算（機長）",
       "1時間 USD 7"
      ],
      [
       "国際線の加算（副操縦士）",
       "1時間 USD 5"
      ],
      [
       "決められた追加の乗務",
       "1時間の単価の1.5〜2.25倍"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Override & premiums",
     "value": "",
     "rows": [
      [
       "International override (CA)",
       "USD 7/hr"
      ],
      [
       "International override (FO)",
       "USD 5/hr"
      ],
      [
       "Designated extra flying",
       "150–225%"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "profit_sharing",
    "ref": false,
    "ja": {
     "label": "利益分配",
     "value": "あり。会社の利益の10%と20%を元手に、決まった式で分ける（給与に一定の率を足す形ではない）",
     "note": ""
    },
    "en": {
     "label": "Profit sharing",
     "value": "Yes: a pool funded from profits at 10% and 20% under a set formula; not a flat percentage added to your pay",
     "note": ""
    }
   },
   {
    "key": "per_diem",
    "ref": false,
    "ja": {
     "label": "日当",
     "value": "",
     "rows": [
      [
       "国内線",
       "1時間 USD 3.04"
      ],
      [
       "国際線",
       "1時間 USD 3.63"
      ]
     ],
     "note": "2026年の協約の額"
    },
    "en": {
     "label": "Per diem",
     "value": "",
     "rows": [
      [
       "Domestic",
       "USD 3.04/hr"
      ],
      [
       "International",
       "USD 3.63/hr"
      ]
     ],
     "note": "2026 contract rates"
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "",
     "rows": [
      [
       "改定交渉に入れる日",
       "2027年9月30日"
      ],
      [
       "2027年1月の勤務の期間から",
       "約3%の昇給の予定"
      ]
     ],
     "note": "2023年の協約"
    },
    "en": {
     "label": "Contract",
     "value": "",
     "rows": [
      [
       "Amendable",
       "Sep 30, 2027"
      ],
      [
       "January 2027 bid period",
       "About 3% raise due"
      ]
     ],
     "note": "UPA 2023 contract"
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "18,864人",
     "note": ""
    },
    "en": {
     "label": "Pilot group size",
     "value": "18,864 pilots",
     "note": ""
    }
   }
  ],
  "life": [
   {
    "key": "airport_transit",
    "ref": false,
    "ja": {
     "label": "ORD への鉄道",
     "value": "",
     "rows": [
      [
       "路線",
       "CTA の青線（Blue Line）が24時間運行"
      ],
      [
       "都心から",
       "約40〜45分"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Rail to ORD",
     "value": "",
     "rows": [
      [
       "Route",
       "CTA Blue Line, 24 hours"
      ],
      [
       "From downtown",
       "About 40–45 min"
      ]
     ],
     "note": ""
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
     "value": "65時間分か、その月の Line（乗務が決まっている月）の平均時間から決まる下限の、多いほう",
     "note": ""
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "65 hours, or a floor set from the month's average line value (ALV), whichever is greater",
     "note": ""
    }
   },
   {
    "key": "reserve_guarantee",
    "ref": true,
    "ja": {
     "label": "最低保証（Reserve - STBY要員の月）",
     "value": "",
     "rows": [
      [
       "Long call - STBY要員の月（前もって呼ばれる）",
       "73時間分"
      ],
      [
       "Short call - STBY要員の月（すぐ呼ばれる）",
       "76時間分"
      ]
     ],
     "note": "2025年時点"
    },
    "en": {
     "label": "Reserve guarantee",
     "value": "",
     "rows": [
      [
       "Long-call reserve",
       "73 hours"
      ],
      [
       "Short-call reserve",
       "76 hours"
      ]
     ],
     "note": "As of 2025"
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "加算・割増",
     "value": "",
     "rows": [
      [
       "国際線の加算（機長）",
       "1時間 USD 7"
      ],
      [
       "国際線の加算（副操縦士）",
       "1時間 USD 5"
      ],
      [
       "決められた追加の乗務",
       "1時間の単価の1.5倍・1.75倍・2倍"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Override & premiums",
     "value": "",
     "rows": [
      [
       "International override (CA)",
       "USD 7/hr"
      ],
      [
       "International override (FO)",
       "USD 5/hr"
      ],
      [
       "Designated extra flying",
       "150%, 175% or 200%"
      ]
     ],
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
     "label": "日当",
     "value": "",
     "rows": [
      [
       "国内線",
       "1時間 USD 3.41"
      ],
      [
       "国際線",
       "1時間 USD 4.07"
      ]
     ],
     "note": "2025年1月の額。毎年、政府の出張の日当（M&IE）に合わせて見直し"
    },
    "en": {
     "label": "Per diem",
     "value": "",
     "rows": [
      [
       "Domestic",
       "USD 3.41/hr"
      ],
      [
       "International",
       "USD 4.07/hr"
      ]
     ],
     "note": "January 2025 rates, adjusted yearly in line with the federal M&IE rate"
    }
   },
   {
    "key": "retirement",
    "ref": true,
    "ja": {
     "label": "会社の年金の積み立て",
     "value": "給与とは別に、会社が給与の18%を確定拠出年金（DC）に積み立てる",
     "note": ""
    },
    "en": {
     "label": "Retirement",
     "value": "18% company DC contribution, on top of pay",
     "note": ""
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "",
     "rows": [
      [
       "改定交渉に入れる日",
       "2027年8月1日"
      ],
      [
       "改定の交渉",
       "2026年8月に始まった"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Contract",
     "value": "",
     "rows": [
      [
       "Amendable",
       "Aug 1, 2027"
      ],
      [
       "Section 6 talks",
       "Opened August 2026"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "pay_raise",
    "ref": true,
    "ja": {
     "label": "予定されている昇給",
     "value": "2027年に約3%",
     "note": ""
    },
    "en": {
     "label": "Scheduled raise",
     "value": "About 3% in 2027",
     "note": ""
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "約16,000人",
     "note": ""
    },
    "en": {
     "label": "Pilot group size",
     "value": "About 16,000 pilots",
     "note": ""
    }
   }
  ],
  "work": [
   {
    "key": "vacation",
    "ref": true,
    "ja": {
     "label": "年休",
     "value": "",
     "rows": [
      [
       "2年目",
       "年21日"
      ],
      [
       "5年目",
       "年21日"
      ],
      [
       "12年目",
       "年28日"
      ],
      [
       "20年目",
       "年35日"
      ]
     ],
     "note": "2025年9月時点"
    },
    "en": {
     "label": "Vacation",
     "value": "",
     "rows": [
      [
       "Year 2",
       "21 days"
      ],
      [
       "Year 5",
       "21 days"
      ],
      [
       "Year 12",
       "28 days"
      ],
      [
       "Year 20",
       "35 days"
      ]
     ],
     "note": "As of September 2025"
    }
   }
  ],
  "life": [
   {
    "key": "airport_transit",
    "ref": false,
    "ja": {
     "label": "DFW への鉄道",
     "value": "DART のオレンジ線でターミナル A へ",
     "note": ""
    },
    "en": {
     "label": "Rail to DFW",
     "value": "DART Orange Line to Terminal A",
     "note": ""
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
     "value": "",
     "rows": [
      [
       "28日・29日の月",
       "84 TFP"
      ],
      [
       "30日の月",
       "87 TFP"
      ],
      [
       "31日の月",
       "89 TFP"
      ]
     ],
     "note": "TFP は Southwest 独自の給与の単位"
    },
    "en": {
     "label": "Monthly guarantee",
     "value": "",
     "rows": [
      [
       "28/29-day months",
       "84 TFP"
      ],
      [
       "30-day months",
       "87 TFP"
      ],
      [
       "31-day months",
       "89 TFP"
      ]
     ],
     "note": "TFP is Southwest's own pay unit"
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "日当",
     "value": "",
     "rows": [
      [
       "国内線",
       "1時間 USD 3.04"
      ],
      [
       "国際線",
       "1時間 USD 3.63"
      ]
     ],
     "note": "2026年の額（2025年の額に2.5%を足した）"
    },
    "en": {
     "label": "Per diem",
     "value": "",
     "rows": [
      [
       "Domestic",
       "USD 3.04/hr"
      ],
      [
       "International",
       "USD 3.63/hr"
      ]
     ],
     "note": "2026 rate (2025 rate plus 2.5%)"
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "加算・割増",
     "value": "",
     "rows": [
      [
       "追加の乗務",
       "1時間の単価の1.5倍・2倍・3倍"
      ],
      [
       "国際線の乗務",
       "1時間の単価の3%増し"
      ],
      [
       "ETOPS の乗務",
       "1時間の単価の5%増し"
      ],
      [
       "深夜の乗務",
       "1時間の単価の3%増し"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Premiums",
     "value": "",
     "rows": [
      [
       "Premium flying",
       "150%, 200% or 300%"
      ],
      [
       "International trips",
       "+3%"
      ],
      [
       "ETOPS trips",
       "+5%"
      ],
      [
       "Night flying",
       "+3%"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "deadhead_pay",
    "ref": false,
    "ja": {
     "label": "便乗の支払い",
     "value": "1区間ごとに、その区間の時間の100%を給与に数える",
     "note": ""
    },
    "en": {
     "label": "Deadhead pay",
     "value": "100% credit for every deadhead leg",
     "note": ""
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "",
     "rows": [
      [
       "2027年1月1日",
       "全員 4%の昇給"
      ],
      [
       "2028年1月1日",
       "全員 3.25%の昇給"
      ],
      [
       "改定交渉に入れる日",
       "2029年1月1日"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Contract",
     "value": "",
     "rows": [
      [
       "Jan 1, 2027",
       "4% across the board"
      ],
      [
       "Jan 1, 2028",
       "3.25% across the board"
      ],
      [
       "Amendable",
       "Jan 1, 2029"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "parental",
    "ref": false,
    "ja": {
     "label": "産休・育休",
     "value": "",
     "rows": [
      [
       "出産休暇",
       "有給6週（帝王切開は8週）"
      ],
      [
       "育児休暇",
       "有給2週＋無給で最大10週"
      ],
      [
       "無給の育児休暇",
       "出生・養子の受け入れから1年まで延ばせる"
      ],
      [
       "無給の期間",
       "残っている病気休暇・年休で埋められる"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Parental leave",
     "value": "",
     "rows": [
      [
       "Maternity leave",
       "6 paid weeks (8 after a C-section)"
      ],
      [
       "Parental leave",
       "2 paid weeks plus up to 10 unpaid"
      ],
      [
       "Unpaid bonding leave",
       "Up to 1 year after birth or placement"
      ],
      [
       "Unpaid weeks",
       "Can be paid with unused sick leave and vacation"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "disability",
    "ref": false,
    "ja": {
     "label": "生命保険・働けなくなったときの補償",
     "value": "会社が生命保険と所得補償を用意している",
     "note": ""
    },
    "en": {
     "label": "Life & disability insurance",
     "value": "Company-provided life and disability coverage",
     "note": ""
    }
   },
   {
    "key": "medical_exam",
    "ref": false,
    "ja": {
     "label": "航空身体検査の費用",
     "value": "FAA の航空身体検査の費用の大部分を会社が出す（心電図が要るときはその分も）",
     "note": ""
    },
    "en": {
     "label": "Medical exam costs",
     "value": "Company covers most of the cost of FAA medicals, plus an EKG when required",
     "note": ""
    }
   },
   {
    "key": "passport",
    "ref": false,
    "ja": {
     "label": "パスポートの更新",
     "value": "更新の費用を会社が補助",
     "note": ""
    },
    "en": {
     "label": "Passport renewal",
     "value": "Company helps pay for renewal",
     "note": ""
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "11,000人超",
     "note": ""
    },
    "en": {
     "label": "Pilot group size",
     "value": "More than 11,000 pilots",
     "note": ""
    }
   }
  ],
  "work": [
   {
    "key": "vacation",
    "ref": true,
    "ja": {
     "label": "年休",
     "value": "",
     "rows": [
      [
       "2年目",
       "年14日"
      ],
      [
       "5年目",
       "年21日"
      ],
      [
       "12年目",
       "年28日"
      ],
      [
       "20年目",
       "年35日"
      ]
     ],
     "note": "2025年9月時点"
    },
    "en": {
     "label": "Vacation",
     "value": "",
     "rows": [
      [
       "Year 2",
       "14 days"
      ],
      [
       "Year 5",
       "21 days"
      ],
      [
       "Year 12",
       "28 days"
      ],
      [
       "Year 20",
       "35 days"
      ]
     ],
     "note": "As of September 2025"
    }
   },
   {
    "key": "days_off",
    "ref": true,
    "ja": {
     "label": "月の休日（平均）",
     "value": "",
     "rows": [
      [
       "Line - 乗務が決まっている月",
       "17.6日"
      ],
      [
       "Reserve - STBY要員の月",
       "15日"
      ]
     ],
     "note": "2021年の平均"
    },
    "en": {
     "label": "Days off per month (average)",
     "value": "",
     "rows": [
      [
       "Lineholders",
       "17.6 days"
      ],
      [
       "Reserve",
       "15 days"
      ]
     ],
     "note": "2021 averages"
    }
   }
  ],
  "life": [
   {
    "key": "parking",
    "ref": false,
    "ja": {
     "label": "駐車場",
     "value": "",
     "rows": [
      [
       "会社が決めた社員駐車場",
       "会社負担"
      ],
      [
       "ほかの駐車場",
       "年 USD 720 まで補助"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Parking",
     "value": "",
     "rows": [
      [
       "Designated employee parking",
       "Paid by the company"
      ],
      [
       "Other lots",
       "Reimbursed up to USD 720 a year"
      ]
     ],
     "note": ""
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
     "value": "",
     "rows": [
      [
       "Line - 乗務が決まっている月",
       "70時間分"
      ],
      [
       "Long call - STBY要員の月（前もって呼ばれる）",
       "75時間分"
      ],
      [
       "Short call - STBY要員の月（すぐ呼ばれる）",
       "84時間分"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Monthly guarantee",
     "value": "",
     "rows": [
      [
       "Lineholders",
       "70 hours"
      ],
      [
       "Long-call reserve",
       "75 hours"
      ],
      [
       "Short-call reserve",
       "84 hours"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "日当",
     "value": "",
     "rows": [
      [
       "国内線",
       "1時間 USD 2.65"
      ],
      [
       "国際線",
       "1時間 USD 3.10"
      ]
     ],
     "note": "2025年1月の額"
    },
    "en": {
     "label": "Per diem",
     "value": "",
     "rows": [
      [
       "Domestic",
       "USD 2.65/hr"
      ],
      [
       "International",
       "USD 3.10/hr"
      ]
     ],
     "note": "January 2025 rates"
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "加算・割増",
     "value": "",
     "rows": [
      [
       "国際線・ETOPS の加算（機長）",
       "1時間 USD 6.25"
      ],
      [
       "国際線・ETOPS の加算（副操縦士）",
       "1時間 USD 5.25"
      ],
      [
       "追加の乗務",
       "1時間の単価の1.5倍か2倍"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Premiums",
     "value": "",
     "rows": [
      [
       "International/ETOPS pay (CA)",
       "USD 6.25/hr"
      ],
      [
       "International/ETOPS pay (FO)",
       "USD 5.25/hr"
      ],
      [
       "Premium flying",
       "150% or 200%"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "",
     "rows": [
      [
       "2026年9月1日の昇給",
       "4%か、市場の水準に合わせた調整の、高いほう"
      ],
      [
       "ハワイアン航空との統合協約",
       "交渉中"
      ]
     ],
     "note": "2026年11月時点"
    },
    "en": {
     "label": "Contract",
     "value": "",
     "rows": [
      [
       "Raise on 1 September 2026",
       "4% or a market-based adjustment, whichever is higher"
      ],
      [
       "Joint contract (JCBA) with Hawaiian",
       "Under negotiation"
      ]
     ],
     "note": "As of November 2026"
    }
   },
   {
    "key": "retirement",
    "ref": true,
    "ja": {
     "label": "会社の年金の積み立て",
     "value": "会社が給与の17%を確定拠出年金（DC）に積み立てる",
     "note": "2010年1月以降に入社したパイロット。それより前の人は別の制度"
    },
    "en": {
     "label": "Retirement",
     "value": "17% company DC contribution",
     "note": "Pilots hired from January 2010; earlier hires are on a different plan"
    }
   },
   {
    "key": "staff_travel",
    "ref": true,
    "ja": {
     "label": "社員の航空券（家族）",
     "value": "",
     "rows": [
      [
       "対象",
       "配偶者・パートナー、扶養の子、親2人"
      ],
      [
       "親の2枠",
       "ほかの2人に付け替えられる"
      ]
     ],
     "note": "2024年に発表"
    },
    "en": {
     "label": "Staff travel: family",
     "value": "",
     "rows": [
      [
       "Eligible",
       "Spouse or partner, dependent children and 2 parents"
      ],
      [
       "Parent slots",
       "Can go to 2 other people instead"
      ]
     ],
     "note": "Announced in 2024"
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "3,350人",
     "note": ""
    },
    "en": {
     "label": "Pilot group size",
     "value": "3,350 pilots",
     "note": ""
    }
   }
  ],
  "work": [
   {
    "key": "vacation",
    "ref": true,
    "ja": {
     "label": "年休",
     "value": "",
     "rows": [
      [
       "2年目",
       "年15日"
      ],
      [
       "5年目",
       "年21日"
      ],
      [
       "12年目",
       "年24日"
      ],
      [
       "20年目",
       "年35日"
      ]
     ],
     "note": "2025年9月時点"
    },
    "en": {
     "label": "Vacation",
     "value": "",
     "rows": [
      [
       "Year 2",
       "15 days"
      ],
      [
       "Year 5",
       "21 days"
      ],
      [
       "Year 12",
       "24 days"
      ],
      [
       "Year 20",
       "35 days"
      ]
     ],
     "note": "As of September 2025"
    }
   }
  ],
  "life": [
   {
    "key": "late_night_transit",
    "ref": false,
    "ja": {
     "label": "深夜の空港への足",
     "value": "",
     "rows": [
      [
       "シアトル都心から空港",
       "ライトレール（1 Line）で約38分"
      ],
      [
       "電車が終わった後",
       "空港と都心を結ぶ深夜バス"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Late-night airport access",
     "value": "",
     "rows": [
      [
       "Downtown Seattle to SEA",
       "Link 1 Line, about 38 min"
      ],
      [
       "After trains stop",
       "Night Bus between the airport and downtown"
      ]
     ],
     "note": ""
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
     "value": "",
     "rows": [
      [
       "Line - 乗務が決まっている月",
       "70時間分"
      ],
      [
       "Reserve - STBY要員の月",
       "75時間分"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "",
     "rows": [
      [
       "Lineholders",
       "70 hours"
      ],
      [
       "Reserve",
       "75 hours"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "日当",
     "value": "",
     "rows": [
      [
       "国内線",
       "1時間 USD 2.70"
      ],
      [
       "国際線",
       "1時間 USD 3.25"
      ]
     ],
     "note": "2025年1月の額"
    },
    "en": {
     "label": "Per diem",
     "value": "",
     "rows": [
      [
       "Domestic",
       "USD 2.70/hr"
      ],
      [
       "International",
       "USD 3.25/hr"
      ]
     ],
     "note": "January 2025 rates"
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "加算・割増",
     "value": "",
     "rows": [
      [
       "国際線の加算（機長）",
       "1時間 USD 6"
      ],
      [
       "国際線の加算（副操縦士）",
       "1時間 USD 5"
      ],
      [
       "深夜便（01〜05時）の加算",
       "1時間 USD 13"
      ],
      [
       "追加の乗務",
       "1時間の単価の1.5倍か2倍"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Premiums",
     "value": "",
     "rows": [
      [
       "International (CA)",
       "USD 6/hr"
      ],
      [
       "International (FO)",
       "USD 5/hr"
      ],
      [
       "Red-eye flying (0100–0500)",
       "USD 13/hr"
      ],
      [
       "Premium flying",
       "150% or 200%"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "",
     "rows": [
      [
       "改定交渉に入れる日",
       "2025年2月"
      ],
      [
       "状況",
       "新しい協約を交渉中"
      ]
     ],
     "note": "2026年11月時点"
    },
    "en": {
     "label": "Contract",
     "value": "",
     "rows": [
      [
       "Amendable",
       "Since February 2025"
      ],
      [
       "Status",
       "New contract under negotiation"
      ]
     ],
     "note": "As of November 2026"
    }
   },
   {
    "key": "staff_travel",
    "ref": false,
    "ja": {
     "label": "社員の航空券",
     "value": "",
     "rows": [
      [
       "自社便",
       "無料で空席待ち"
      ],
      [
       "一部の他社便",
       "割引で空席待ち"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Staff travel",
     "value": "",
     "rows": [
      [
       "JetBlue",
       "Free standby"
      ],
      [
       "Selected other airlines",
       "Discounted standby"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "parental",
    "ref": false,
    "ja": {
     "label": "育児休暇",
     "value": "",
     "rows": [
      [
       "期間",
       "連続180日（さらに180日延ばせる）"
      ],
      [
       "始める時期",
       "出産・養子・里子の受け入れから原則30日以内"
      ],
      [
       "休んでいる間",
       "勤続の順位はそのまま"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Parental leave",
     "value": "",
     "rows": [
      [
       "Length",
       "180 consecutive days, extendable by another 180"
      ],
      [
       "Start",
       "Normally within 30 days of birth, adoption or foster placement"
      ],
      [
       "During leave",
       "Seniority is retained"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "relocation",
    "ref": false,
    "ja": {
     "label": "転居の支援",
     "value": "新しい基地の開設、今の基地の席を失ったとき、別の基地への呼び戻し、基地の閉鎖で転居するときに支援がある",
     "note": "12か月以内に50マイル以上引っ越す人などが対象"
    },
    "en": {
     "label": "Relocation",
     "value": "Moving support when you relocate because of a new base opening, displacement, recall to another base or a base closure",
     "note": "Conditions apply, e.g. a move of 50+ miles within 12 months"
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "4,687人",
     "note": ""
    },
    "en": {
     "label": "Pilot group size",
     "value": "4,687 pilots",
     "note": ""
    }
   }
  ],
  "work": [
   {
    "key": "vacation",
    "ref": true,
    "ja": {
     "label": "年休",
     "value": "",
     "rows": [
      [
       "2年目",
       "年14日"
      ],
      [
       "5年目",
       "年14日"
      ],
      [
       "12年目",
       "年21日"
      ],
      [
       "20年目",
       "年28日"
      ]
     ],
     "note": "2025年9月時点"
    },
    "en": {
     "label": "Vacation",
     "value": "",
     "rows": [
      [
       "Year 2",
       "14 days"
      ],
      [
       "Year 5",
       "14 days"
      ],
      [
       "Year 12",
       "21 days"
      ],
      [
       "Year 20",
       "28 days"
      ]
     ],
     "note": "As of September 2025"
    }
   }
  ],
  "life": [
   {
    "key": "parking",
    "ref": false,
    "ja": {
     "label": "駐車場",
     "value": "",
     "rows": [
      [
       "自分の基地の空港",
       "無料"
      ],
      [
       "同じ基地扱いの別の空港",
       "無料か精算"
      ],
      [
       "駐車場を使わない人",
       "代わりに月 USD 55"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Parking",
     "value": "",
     "rows": [
      [
       "Your base",
       "Free"
      ],
      [
       "Co-base airports",
       "Free or reimbursed"
      ],
      [
       "If you waive it",
       "USD 55 a month instead"
      ]
     ],
     "note": ""
    }
   }
  ],
  "stay": [
   {
    "key": "hotel",
    "ref": false,
    "ja": {
     "label": "ステイのホテル",
     "value": "",
     "rows": [
      [
       "基地の外で泊まるとき",
       "個室"
      ],
      [
       "区間の間の5時間の休憩・訓練・臨時勤務（TDY）",
       "条件つきで個室"
      ]
     ],
     "note": "オーランド（MCO）の定期訓練は例外あり"
    },
    "en": {
     "label": "Hotel rooms",
     "value": "",
     "rows": [
      [
       "Overnights away from base",
       "Single rooms"
      ],
      [
       "5-hour sits between legs, training, TDY",
       "Single rooms, with conditions"
      ]
     ],
     "note": "Exceptions apply to recurrent training (CQT) at MCO"
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
     "value": "",
     "note": "",
     "rows": [
      [
       "Line - 乗務が決まっている月",
       "75時間分"
      ],
      [
       "Reserve - STBY要員の月",
       "75時間分"
      ]
     ]
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "",
     "note": "",
     "rows": [
      [
       "Lineholders",
       "75 hours"
      ],
      [
       "Reserve",
       "75 hours"
      ]
     ]
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "超過分の割増",
     "value": "月82.5時間を超えた分は、1時間の単価の1.25倍（給与に数える時間）",
     "note": ""
    },
    "en": {
     "label": "Overtime premium",
     "value": "1.25 times the hourly rate for credit above 82.5 hours a month",
     "note": ""
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "日当",
     "value": "1時間 USD 2.15（国内線・国際線とも）",
     "note": "以前の額"
    },
    "en": {
     "label": "Per diem",
     "value": "USD 2.15 an hour, domestic and international",
     "note": "Earlier rate"
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "",
     "rows": [
      [
       "改定交渉に入れる日",
       "2024年1月16日"
      ],
      [
       "改定の交渉",
       "2023年7月から続いている"
      ]
     ],
     "note": "2026年11月時点"
    },
    "en": {
     "label": "Contract",
     "value": "",
     "rows": [
      [
       "Amendable",
       "Since Jan 16, 2024"
      ],
      [
       "Section 6 talks",
       "Ongoing since July 2023"
      ]
     ],
     "note": "As of November 2026"
    }
   },
   {
    "key": "staff_travel",
    "ref": false,
    "ja": {
     "label": "社員の航空券",
     "value": "本人と家族に無料・割引の航空券",
     "note": ""
    },
    "en": {
     "label": "Travel benefits",
     "value": "Free and discounted travel for you and your family",
     "note": ""
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "2,260人",
     "note": ""
    },
    "en": {
     "label": "Pilot group size",
     "value": "2,260 pilots",
     "note": ""
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
     "note": ""
    },
    "en": {
     "label": "Trip pattern",
     "value": "Mostly day trips (turns)",
     "note": ""
    }
   }
  ],
  "life": [
   {
    "key": "airport_transit",
    "ref": false,
    "ja": {
     "label": "DEN への電車",
     "value": "",
     "rows": [
      [
       "路線",
       "Union Station から RTD の A線で約37分"
      ],
      [
       "早朝・深夜",
       "おおむね30分おき"
      ],
      [
       "運賃",
       "空港までの1日券 USD 10・1か月券 USD 88"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Rail to DEN",
     "value": "",
     "rows": [
      [
       "Route",
       "RTD A Line from Union Station, about 37 min"
      ],
      [
       "Early and late",
       "Roughly every 30 min"
      ],
      [
       "Fares",
       "Airport Day Pass USD 10, Monthly Pass USD 88"
      ]
     ],
     "note": ""
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
     "value": "",
     "rows": [
      [
       "Line - 乗務が決まっている月",
       "70時間分"
      ],
      [
       "Reserve - STBY要員の月",
       "72時間分"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "",
     "rows": [
      [
       "Lineholders",
       "70 hours"
      ],
      [
       "Reserve",
       "72 hours"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "duty_period_min",
    "ref": false,
    "ja": {
     "label": "1回の勤務の最低支給",
     "value": "1回の乗務の勤務（FDP）ごとに、最低5時間分",
     "note": "2026年の協約から"
    },
    "en": {
     "label": "Duty period minimum",
     "value": "5 credit hours minimum per flight duty period (FDP)",
     "note": "From the 2026 contract"
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "追加乗務の割増",
     "value": "",
     "rows": [
      [
       "割増つきで募集された空いた乗務",
       "1時間の単価の1.5〜3倍"
      ],
      [
       "会社の追加乗務の呼びかけに応じた分",
       "1時間の単価の2〜3倍"
      ],
      [
       "休みの日に、勤続の短い順に会社が割り当てる乗務",
       "1時間の単価の2倍"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Premium pay",
     "value": "",
     "rows": [
      [
       "Premium Open Time",
       "1.5–3x"
      ],
      [
       "Voluntary Flying Notification",
       "2–3x"
      ],
      [
       "Junior assignment",
       "2x"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "日当",
     "value": "1時間 USD 2.00（国内線・国際線とも）",
     "note": "2026年の額"
    },
    "en": {
     "label": "Per diem",
     "value": "USD 2.00 an hour, domestic and international",
     "note": "2026 rate"
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "会社の年金の積み立て",
     "value": "2027年1月1日から、会社が給与の15%を確定拠出年金（DC）に積み立てる",
     "note": ""
    },
    "en": {
     "label": "Retirement",
     "value": "15% company DC contribution from January 1, 2027",
     "note": ""
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "",
     "rows": [
      [
       "新しい協約",
       "2026年7月31日に批准（2年間）"
      ],
      [
       "給与",
       "2026年7月1日にさかのぼって適用"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Contract",
     "value": "",
     "rows": [
      [
       "New CBA",
       "Two-year deal ratified July 31, 2026"
      ],
      [
       "Pay",
       "Retroactive to July 1, 2026"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "pay_raises",
    "ref": false,
    "ja": {
     "label": "予定されている昇給",
     "value": "2027年1月1日と2028年1月1日に新しい給与表（上がり幅は年数と職位で違う）",
     "note": ""
    },
    "en": {
     "label": "Scheduled raises",
     "value": "New pay scales on January 1, 2027 and January 1, 2028; the increase varies by year and seat",
     "note": ""
    }
   },
   {
    "key": "disability",
    "ref": false,
    "ja": {
     "label": "働けなくなったときの補償",
     "value": "長期の所得補償（LTD）を65歳まで、会社負担で",
     "note": "2026年の協約から"
    },
    "en": {
     "label": "Disability insurance",
     "value": "Company-paid long-term disability (LTD) to age 65",
     "note": "From the 2026 contract"
    }
   },
   {
    "key": "staff_travel",
    "ref": false,
    "ja": {
     "label": "社員の航空券",
     "value": "",
     "rows": [
      [
       "自社便（本人と扶養家族）",
       "空席待ちで回数の制限なし"
      ],
      [
       "一部の他社便・友人や家族向けのパス",
       "少額の費用"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Travel benefits",
     "value": "",
     "rows": [
      [
       "Allegiant (you and dependents)",
       "Unlimited space-available"
      ],
      [
       "Select other airlines, buddy passes",
       "Small fees"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "約1,300人",
     "note": ""
    },
    "en": {
     "label": "Pilot group size",
     "value": "About 1,300 pilots",
     "note": ""
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
     "value": "",
     "rows": [
      [
       "4週の期間",
       "68時間分"
      ],
      [
       "5週の期間",
       "85時間分"
      ],
      [
       "6週の期間",
       "102時間分"
      ]
     ],
     "note": "需要が落ちたとき・休職中・初期訓練中などは例外"
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "",
     "rows": [
      [
       "4-week period",
       "68 credit hours"
      ],
      [
       "5-week period",
       "85 credit hours"
      ],
      [
       "6-week period",
       "102 credit hours"
      ]
     ],
     "note": "Exceptions include demand-driven reductions, leave and initial training"
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "国際線の加算",
     "value": "",
     "rows": [
      [
       "機長",
       "1時間 USD 10"
      ],
      [
       "副操縦士",
       "1時間 USD 8"
      ],
      [
       "超長距離（ULR）の上乗せ（機長）",
       "1時間 USD 24"
      ],
      [
       "超長距離（ULR）の上乗せ（副操縦士）",
       "1時間 USD 17"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "International override",
     "value": "",
     "rows": [
      [
       "Captain",
       "USD 10/hr"
      ],
      [
       "First officer",
       "USD 8/hr"
      ],
      [
       "ULR add-on (CA)",
       "USD 24/hr"
      ],
      [
       "ULR add-on (FO)",
       "USD 17/hr"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "per_diem",
    "ref": false,
    "ja": {
     "label": "日当",
     "value": "",
     "rows": [
      [
       "国内線",
       "1時間 USD 2.85"
      ],
      [
       "国際線",
       "1時間 USD 3.85"
      ],
      [
       "協約から24か月後",
       "国内線 USD 3.00・国際線 USD 4.05"
      ]
     ],
     "note": "2026年の協約から"
    },
    "en": {
     "label": "Per diem",
     "value": "",
     "rows": [
      [
       "Domestic",
       "USD 2.85/hr"
      ],
      [
       "International",
       "USD 3.85/hr"
      ],
      [
       "24 months into the contract",
       "USD 3.00 domestic, USD 4.05 international"
      ]
     ],
     "note": "From the 2026 contract"
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "退職の年金",
     "value": "",
     "rows": [
      [
       "いま在籍している人",
       "従来の確定給付年金（DB）か、確定拠出（DC）などを選ぶ"
      ],
      [
       "新しく入る人",
       "従来の確定給付年金は対象外"
      ],
      [
       "2028年から",
       "市場に連動する給付（MBCB）と確定拠出（DC）"
      ]
     ],
     "note": "2026年時点"
    },
    "en": {
     "label": "Retirement",
     "value": "",
     "rows": [
      [
       "Current pilots",
       "Choose the legacy DB plan or DC options"
      ],
      [
       "New hires",
       "Not eligible for the legacy DB"
      ],
      [
       "From 2028",
       "Market-based cash balance (MBCB) plan and DC"
      ]
     ],
     "note": "As of 2026"
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "",
     "rows": [
      [
       "発効",
       "2026年6月29日"
      ],
      [
       "改定交渉に入れる日",
       "2030年12月"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Contract",
     "value": "",
     "rows": [
      [
       "Effective",
       "June 29, 2026"
      ],
      [
       "Amendable",
       "December 2030"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "pay_raises",
    "ref": false,
    "ja": {
     "label": "予定されている昇給",
     "value": "",
     "rows": [
      [
       "2028年1月",
       "全員 3%"
      ],
      [
       "2029年1月",
       "全員 3%"
      ],
      [
       "2030年1月",
       "全員 3%"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Scheduled raises",
     "value": "",
     "rows": [
      [
       "January 2028",
       "3% across the board"
      ],
      [
       "January 2029",
       "3% across the board"
      ],
      [
       "January 2030",
       "3% across the board"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "staff_travel",
    "ref": false,
    "ja": {
     "label": "社員の航空券",
     "value": "本人と対象の扶養家族が空席待ちで乗れる",
     "note": ""
    },
    "en": {
     "label": "Travel benefits",
     "value": "Personal standby travel for you and eligible dependents",
     "note": ""
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "",
     "rows": [
      [
       "労組（ALPA）の数",
       "4,876人"
      ],
      [
       "会社の数",
       "5,800人以上"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Pilot group size",
     "value": "",
     "rows": [
      [
       "ALPA figure",
       "4,876"
      ],
      [
       "Company figure",
       "5,800+"
      ]
     ],
     "note": ""
    }
   }
  ],
  "work": [
   {
    "key": "vacation",
    "ref": false,
    "ja": {
     "label": "年休",
     "value": "",
     "rows": [
      [
       "1年目",
       "毎月1.5日ずつ（最大10か月）"
      ],
      [
       "勤続1〜4年未満",
       "年15日"
      ],
      [
       "5〜9年未満",
       "年22日"
      ],
      [
       "10〜19年未満",
       "年29日"
      ],
      [
       "20年以上",
       "年36日"
      ],
      [
       "決まり方",
       "12月31日の勤続年数で決まり、翌年に使う（4〜5年・9〜10年・19〜20年の区切りの年は日割り）"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Vacation",
     "value": "",
     "rows": [
      [
       "First year",
       "1.5 days a month, for up to 10 months"
      ],
      [
       "1 to under 4 years",
       "15 days"
      ],
      [
       "5 to under 9 years",
       "22 days"
      ],
      [
       "10 to under 19 years",
       "29 days"
      ],
      [
       "20+ years",
       "36 days"
      ],
      [
       "How it works",
       "Based on seniority on 31 December and used the following year; prorated in the transition years (4–5, 9–10 and 19–20)"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "vacation_pay",
    "ref": false,
    "ja": {
     "label": "年休の日の給与",
     "value": "年休1日を6時間分として給与に数える",
     "note": "2026年の協約から"
    },
    "en": {
     "label": "Vacation pay",
     "value": "6 credit hours per vacation day",
     "note": "From the 2026 contract"
    }
   },
   {
    "key": "reserve_lines",
    "ref": false,
    "hide": "スタンバイの勤務表の型（R-24）の割合という細かい決まりで、日本の読者には意味が通じにくく、比べる意味も薄い",
    "ja": {
     "label": "スタンバイの勤務表",
     "value": "公開されるスタンバイの勤務表のうち、R-24 型を20%以上に（これまでは13%）",
     "note": "2026年の協約から"
    },
    "en": {
     "label": "Reserve lines",
     "value": "At least 20% of published reserve lines are R-24 (up from 13%)",
     "note": "From the 2026 contract"
    }
   }
  ],
  "stay": [
   {
    "key": "hotel",
    "ref": false,
    "ja": {
     "label": "途中の短い停止での休み方",
     "value": "",
     "rows": [
      [
       "メンフィス（MEM）・インディアナポリス（IND）などの短い停止",
       "条件つきで、ホテルの代わりに仮眠室"
      ],
      [
       "2026年の協約から",
       "IND の日中の国内線にも広げた"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Sleep rooms",
     "value": "",
     "rows": [
      [
       "Short en-route stops (MEM, IND, etc.)",
       "Sleep rooms can replace hotels, with conditions"
      ],
      [
       "2026 contract",
       "Extended to daytime domestic flying at IND"
      ]
     ],
     "note": ""
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
     "value": "28日の給与期間ごとに75時間分",
     "note": ""
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "75 credit hours per 28-day pay period",
     "note": ""
    }
   },
   {
    "key": "premiums",
    "ref": true,
    "ja": {
     "label": "加算・割増",
     "value": "",
     "rows": [
      [
       "国際線の加算（機長）",
       "1時間 USD 6.50"
      ],
      [
       "国際線の加算（副操縦士）",
       "1時間 USD 4.50"
      ],
      [
       "追加の乗務",
       "1時間の単価の1.5倍など"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Override & premiums",
     "value": "",
     "rows": [
      [
       "International override (CA)",
       "USD 6.50/hr"
      ],
      [
       "International override (FO)",
       "USD 4.50/hr"
      ],
      [
       "Extra flying",
       "Premium pay, e.g. 150%"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "日当",
     "value": "",
     "rows": [
      [
       "国内線",
       "1時間 USD 3.35"
      ],
      [
       "国際線",
       "1時間 USD 4.10"
      ],
      [
       "太平洋",
       "1時間 USD 3.65"
      ],
      [
       "欧州",
       "1時間 USD 3.40"
      ]
     ],
     "note": "2025年1月の額"
    },
    "en": {
     "label": "Per diem",
     "value": "",
     "rows": [
      [
       "Domestic",
       "USD 3.35/hr"
      ],
      [
       "International",
       "USD 4.10/hr"
      ],
      [
       "Pacific",
       "USD 3.65/hr"
      ],
      [
       "Europe",
       "USD 3.40/hr"
      ]
     ],
     "note": "January 2025 rates"
    }
   },
   {
    "key": "retirement",
    "ref": true,
    "ja": {
     "label": "会社の年金",
     "value": "",
     "rows": [
      [
       "確定拠出（DC）",
       "会社が給与の12%を積み立てる"
      ],
      [
       "確定給付（DB）",
       "年金がある"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Retirement",
     "value": "",
     "rows": [
      [
       "DC plan",
       "12% company contribution"
      ],
      [
       "DB pension",
       "Yes"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "",
     "rows": [
      [
       "改定交渉に入れる日",
       "2025年9月1日"
      ],
      [
       "状況",
       "新しい協約を交渉中"
      ],
      [
       "最後の全員の昇給",
       "2025年9月に3.25%"
      ]
     ],
     "note": "2026年11月時点"
    },
    "en": {
     "label": "Contract",
     "value": "",
     "rows": [
      [
       "Amendable",
       "Since 1 September 2025"
      ],
      [
       "Status",
       "New contract under negotiation"
      ],
      [
       "Last across-the-board raise",
       "3.25% in September 2025"
      ]
     ],
     "note": "As of November 2026"
    }
   },
   {
    "key": "jumpseat",
    "ref": false,
    "ja": {
     "label": "ジャンプシート",
     "value": "私用の移動で、本人がジャンプシートに乗れる",
     "note": ""
    },
    "en": {
     "label": "Jumpseat",
     "value": "Personal jumpseat travel for yourself",
     "note": ""
    }
   },
   {
    "key": "pilot_count",
    "ref": true,
    "ja": {
     "label": "パイロット数",
     "value": "3,400人超",
     "note": ""
    },
    "en": {
     "label": "Pilot group size",
     "value": "More than 3,400 pilots",
     "note": ""
    }
   }
  ],
  "work": [
   {
    "key": "vacation",
    "ref": true,
    "ja": {
     "label": "年休",
     "value": "",
     "rows": [
      [
       "2年目",
       "年14日"
      ],
      [
       "5年目",
       "年21日"
      ],
      [
       "12年目",
       "年28日"
      ],
      [
       "20年目",
       "年35日"
      ]
     ],
     "note": "2025年9月時点"
    },
    "en": {
     "label": "Vacation",
     "value": "",
     "rows": [
      [
       "Year 2",
       "14 days"
      ],
      [
       "Year 5",
       "21 days"
      ],
      [
       "Year 12",
       "28 days"
      ],
      [
       "Year 20",
       "35 days"
      ]
     ],
     "note": "As of September 2025"
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
     "value": "月64時間分",
     "note": "2021年の協約"
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "64 credit hours a month",
     "note": "2021 contract"
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "日当",
     "value": "",
     "rows": [
      [
       "国内",
       "1時間 USD 3.25"
      ],
      [
       "国際",
       "1時間 USD 4.00"
      ]
     ],
     "note": "2026年の額（協約で毎年 USD 0.10 ずつ上がった分を足した）"
    },
    "en": {
     "label": "Per diem",
     "value": "",
     "rows": [
      [
       "Domestic",
       "USD 3.25/hr"
      ],
      [
       "International",
       "USD 4.00/hr"
      ]
     ],
     "note": "2026 rate (includes the contract's USD 0.10 yearly increases)"
    }
   },
   {
    "key": "retirement",
    "ref": true,
    "ja": {
     "label": "会社の年金の積み立て",
     "value": "会社が給与の16%を確定拠出年金（DC）に積み立てる",
     "note": "2026年の率"
    },
    "en": {
     "label": "Retirement",
     "value": "16% company DC contribution",
     "note": "2026 rate"
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "",
     "rows": [
      [
       "いまの協約",
       "2021年の協約"
      ],
      [
       "最後の定期昇給",
       "2025年9月1日に3%"
      ],
      [
       "改定交渉に入れる日",
       "2026年9月10日"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Contract",
     "value": "",
     "rows": [
      [
       "Current contract",
       "2021 CBA"
      ],
      [
       "Last scheduled raise",
       "3% on September 1, 2025"
      ],
      [
       "Amendable",
       "From September 10, 2026"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "staff_travel",
    "ref": false,
    "ja": {
     "label": "社員の航空券",
     "value": "本人と対象の家族が空席待ちで乗れる",
     "note": ""
    },
    "en": {
     "label": "Staff travel",
     "value": "Standby travel for you and eligible family members",
     "note": ""
    }
   },
   {
    "key": "health",
    "ref": false,
    "ja": {
     "label": "医療保険",
     "value": "医療・歯科・眼科の保険",
     "note": ""
    },
    "en": {
     "label": "Health insurance",
     "value": "Medical, dental and vision",
     "note": ""
    }
   }
  ],
  "work": [
   {
    "key": "vacation",
    "ref": false,
    "ja": {
     "label": "年休",
     "value": "",
     "rows": [
      [
       "勤続6年未満",
       "年14日"
      ],
      [
       "6〜11年",
       "年21日"
      ],
      [
       "12年以上",
       "年28日"
      ],
      [
       "付く条件",
       "その月に15日以上、勤務についていることなど"
      ]
     ],
     "note": "2021年の協約"
    },
    "en": {
     "label": "Vacation",
     "value": "",
     "rows": [
      [
       "Under 6 years",
       "14 days"
      ],
      [
       "6–11 years",
       "21 days"
      ],
      [
       "12+ years",
       "28 days"
      ],
      [
       "Accrual",
       "Requires at least 15 active days in the month, among other conditions"
      ]
     ],
     "note": "2021 contract"
    }
   },
   {
    "key": "commuter",
    "ref": false,
    "ja": {
     "label": "出発の空港からの移動",
     "value": "自分が登録した出発の空港から乗務の場所までの移動は、会社が手配する（条件あり）",
     "note": ""
    },
    "en": {
     "label": "Gateway travel",
     "value": "Company-arranged travel from your gateway airport to the trip, subject to eligibility",
     "note": ""
    }
   }
  ],
  "life": [
   {
    "key": "parking",
    "ref": false,
    "ja": {
     "label": "出発の空港までの交通費",
     "value": "自宅から登録した出発の空港までの車の費用・有料道路・駐車場は自分で払う",
     "note": ""
    },
    "en": {
     "label": "Getting to the gateway",
     "value": "Mileage, tolls and parking between home and your gateway airport are paid by the pilot",
     "note": ""
    }
   }
  ],
  "stay": [
   {
    "key": "hotel",
    "ref": false,
    "ja": {
     "label": "ホテル",
     "value": "",
     "rows": [
      [
       "会社負担のホテル",
       "訓練中・基地での滞在中・乗務の前後・スタンバイ中"
      ],
      [
       "部屋",
       "個室（協約で決まっている）"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Hotels",
     "value": "",
     "rows": [
      [
       "Company-paid hotels",
       "Training, in base, before and after trips, and on reserve"
      ],
      [
       "Rooms",
       "Single rooms under the contract"
      ]
     ],
     "note": ""
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
     "value": "2週間の給与期間ごとに29.92時間分",
     "note": ""
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "29.92 credit hours per biweekly pay period",
     "note": ""
    }
   },
   {
    "key": "per_diem",
    "ref": false,
    "ja": {
     "label": "日当",
     "value": "",
     "rows": [
      [
       "国内",
       "1日 USD 71.00"
      ],
      [
       "国際",
       "1日 USD 93.00"
      ],
      [
       "太平洋",
       "1日 USD 94.75"
      ],
      [
       "米領カリブ・カナダ・メキシコ",
       "1日 USD 78.50"
      ]
     ],
     "note": "2026年1月1日から"
    },
    "en": {
     "label": "Per diem",
     "value": "",
     "rows": [
      [
       "Domestic",
       "USD 71.00/day"
      ],
      [
       "International",
       "USD 93.00/day"
      ],
      [
       "Pacific",
       "USD 94.75/day"
      ],
      [
       "US Caribbean, Canada, Mexico",
       "USD 78.50/day"
      ]
     ],
     "note": "From January 1, 2026"
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "追加乗務の割増",
     "value": "",
     "rows": [
      [
       "割増の日（1.5倍の段）",
       "6時間分か、単価の1.5倍の、高いほう"
      ],
      [
       "割増の日（1.75倍の段）",
       "7時間分か、単価の1.75倍の、高いほう"
      ],
      [
       "割増の日（2倍の段）",
       "8時間分か、単価の2倍の、高いほう"
      ],
      [
       "空いている乗務",
       "最低4〜8時間分"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Premium pay",
     "value": "",
     "rows": [
      [
       "Premium day (150% tier)",
       "Greater of 6 hours' pay or 150% pay"
      ],
      [
       "Premium day (175% tier)",
       "Greater of 7 hours' pay or 175% pay"
      ],
      [
       "Premium day (200% tier)",
       "Greater of 8 hours' pay or 200% pay"
      ],
      [
       "Open trips",
       "4–8 hour minimum"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "会社の年金の積み立て（確定拠出）",
     "value": "",
     "rows": [
      [
       "2026年",
       "会社が給与の14%"
      ],
      [
       "2027〜30年",
       "会社が給与の15%（業績で +1%）"
      ],
      [
       "本人の積み立て",
       "要らない"
      ],
      [
       "国の上限（IRS）を超える分",
       "現金で支払う"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Retirement",
     "value": "",
     "rows": [
      [
       "2026",
       "14% company DC contribution"
      ],
      [
       "2027–2030",
       "15%, plus 1% more based on performance"
      ],
      [
       "Your own contribution",
       "Not required"
      ],
      [
       "Above the IRS cap",
       "Paid in cash"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "予定されている昇給",
     "value": "2027〜2030年の毎年1月1日に約3%（年ごとの給与表あり）",
     "note": ""
    },
    "en": {
     "label": "Scheduled raises",
     "value": "About 3% every January 1 from 2027 to 2030, with a pay table for each year",
     "note": ""
    }
   },
   {
    "key": "health",
    "ref": false,
    "ja": {
     "label": "医療保険",
     "value": "",
     "rows": [
      [
       "医療（UnitedHealthcare）",
       "保険料の75%を会社が負担"
      ],
      [
       "歯科・眼科",
       "保険あり"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Health insurance",
     "value": "",
     "rows": [
      [
       "Medical (UnitedHealthcare)",
       "75% of the premium paid by the company"
      ],
      [
       "Dental and vision",
       "Yes"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "disability",
    "ref": false,
    "ja": {
     "label": "働けなくなったときの補償・生命保険",
     "value": "短期・長期の所得補償と生命保険",
     "note": ""
    },
    "en": {
     "label": "Disability & life",
     "value": "Short- and long-term disability and life insurance",
     "note": ""
    }
   }
  ],
  "work": [
   {
    "key": "days_off",
    "ref": false,
    "ja": {
     "label": "月の休日（最低）",
     "value": "",
     "rows": [
      [
       "Line - 乗務が決まっている月",
       "14日"
      ],
      [
       "Reserve - STBY要員の月",
       "13日"
      ],
      [
       "Composite - Line と Reserve が混ざる月",
       "14日"
      ],
      [
       "1週間の年休を取る月（Line）",
       "21日"
      ],
      [
       "1週間の年休を取る月（Reserve）",
       "20日"
      ],
      [
       "1週間の年休を取る月（Composite）",
       "21日"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Minimum days off",
     "value": "",
     "rows": [
      [
       "Lineholders",
       "14"
      ],
      [
       "Reserve",
       "13"
      ],
      [
       "Composite",
       "14"
      ],
      [
       "Month with a vacation week",
       "Line 21, reserve 20, composite 21"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "pattern",
    "ref": false,
    "ja": {
     "label": "勤務の型",
     "value": "",
     "rows": [
      [
       "勤務と休みの組み方",
       "7日勤務・7日休み、8日勤務・6日休み、9日勤務・5日休みなど"
      ],
      [
       "月のブロックタイム",
       "45〜50時間ほど"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Schedule",
     "value": "",
     "rows": [
      [
       "Patterns",
       "7 on/7 off, 8/6, 9/5 and similar"
      ],
      [
       "Block hours",
       "Typically 45–50 a month"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "vacation",
    "ref": false,
    "ja": {
     "label": "年休",
     "value": "",
     "rows": [
      [
       "1年目",
       "毎月1日ずつ（年12日）"
      ],
      [
       "1〜4年",
       "年14日"
      ],
      [
       "5〜14年",
       "年21日"
      ],
      [
       "15年以上",
       "年28日"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Vacation",
     "value": "",
     "rows": [
      [
       "First year",
       "1 day a month (12 a year)"
      ],
      [
       "1–4 years",
       "14 days"
      ],
      [
       "5–14 years",
       "21 days"
      ],
      [
       "15+ years",
       "28 days"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "commuter",
    "ref": false,
    "ja": {
     "label": "飛行機での通勤",
     "value": "",
     "rows": [
      [
       "他社機のジャンプシート",
       "乗れる（CASS という仕組み）"
      ],
      [
       "国内の通勤で乗れなかったとき",
       "出頭の前に着く便を1便、空席待ちで申し込んでいれば、間に合わなくても不利に扱われない"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Commuting",
     "value": "",
     "rows": [
      [
       "Jumpseat",
       "CASS access"
      ],
      [
       "Domestic commuters",
       "Protected if you list for one flight scheduled to arrive before report time"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "sick_leave",
    "ref": false,
    "ja": {
     "label": "病気休暇",
     "value": "",
     "rows": [
      [
       "勤続13か月目",
       "12日"
      ],
      [
       "その後",
       "毎月1日ずつ増える（上限なし）"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Sick leave",
     "value": "",
     "rows": [
      [
       "13th month of employment",
       "12 days"
      ],
      [
       "After that",
       "1 more day a month, no cap"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "training",
    "ref": false,
    "ja": {
     "label": "初期訓練",
     "value": "",
     "rows": [
      [
       "期間",
       "約60日"
      ],
      [
       "訓練中",
       "65時間分の保証・日当・個室のホテル"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Initial training",
     "value": "",
     "rows": [
      [
       "Length",
       "About 60 days"
      ],
      [
       "During training",
       "65-hour guarantee, per diem and a single room"
      ]
     ],
     "note": ""
    }
   }
  ],
  "stay": [
   {
    "key": "hotel",
    "ref": false,
    "ja": {
     "label": "ホテル・食事",
     "value": "",
     "rows": [
      [
       "乗務中",
       "個室のホテル"
      ],
      [
       "空港でのスタンバイ中",
       "会社のホテル"
      ],
      [
       "勤務中の食事",
       "クルーミールが出る"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Hotels, meals",
     "value": "",
     "rows": [
      [
       "On trips",
       "Single rooms"
      ],
      [
       "Airport reserve standby",
       "Company hotel"
      ],
      [
       "On duty",
       "Crew meals"
      ]
     ],
     "note": ""
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
     "value": "月64時間分",
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
     "value": "",
     "rows": [
      [
       "休日に飛んだ分",
       "1時間の単価の1.5倍"
      ],
      [
       "休日に会社が勤続の短い人へ乗務を割り当てること",
       "無い"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Days-off flying",
     "value": "",
     "rows": [
      [
       "Flying on a day off",
       "150%"
      ],
      [
       "Junior manning",
       "Not used"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "会社の年金の積み立て",
     "value": "会社が給与の12%を 401(k)（確定拠出年金）に積み立てる。本人の積み立てに応じて会社が足す分とは別",
     "note": ""
    },
    "en": {
     "label": "Retirement",
     "value": "12% company DC contribution to the 401(k), separate from any match on your own contributions",
     "note": ""
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "日当",
     "value": "",
     "rows": [
      [
       "国内",
       "1時間 USD 2.65"
      ],
      [
       "国際",
       "1時間 USD 3.55"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Per diem",
     "value": "",
     "rows": [
      [
       "Domestic",
       "USD 2.65/hr"
      ],
      [
       "International",
       "USD 3.55/hr"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "health",
    "ref": false,
    "ja": {
     "label": "医療保険",
     "value": "医療・歯科・眼科の保険（Blue Cross Blue Shield）",
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
     "label": "自宅からの通勤",
     "value": "",
     "rows": [
      [
       "住む場所",
       "米国内ならほぼどこでも（アラスカ・ハワイも）"
      ],
      [
       "乗務への行き帰り",
       "会社が確定席を買う（私用の旅行は対象外）"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Home-based commuting",
     "value": "",
     "rows": [
      [
       "Where you live",
       "Almost anywhere in the US, Alaska and Hawaii included"
      ],
      [
       "Travel to and from assignments",
       "Positive-space tickets bought by the company (not personal travel)"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "schedule",
    "ref": false,
    "ja": {
     "label": "勤務と休みの型",
     "value": "",
     "rows": [
      [
       "基本",
       "16日勤務・15日休み（30日の月は14日休み）"
      ],
      [
       "希望で選べる型",
       "16日続けて、または8日勤務・15日休み・8日勤務のような分け方（できるとき）"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Schedule",
     "value": "",
     "rows": [
      [
       "Standard",
       "16 on/15 off (14 off in 30-day months)"
      ],
      [
       "Bid options",
       "16 straight, or splits such as 8 on/15 off/8 on, when possible"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "training",
    "ref": false,
    "ja": {
     "label": "訓練",
     "value": "",
     "rows": [
      [
       "場所",
       "ミシガン州イプシランティの本社（B747・B777）"
      ],
      [
       "給与",
       "訓練の初日から乗務の給与を満額"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Training",
     "value": "",
     "rows": [
      [
       "Location",
       "Ypsilanti, Michigan headquarters (B747/B777)"
      ],
      [
       "Pay",
       "Full flight pay from day one"
      ]
     ],
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
     "value": "",
     "note": "",
     "rows": [
      [
       "Line - 乗務が決まっている月",
       "70時間分"
      ],
      [
       "Reserve - STBY要員の月",
       "70時間分"
      ]
     ]
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "",
     "note": "",
     "rows": [
      [
       "Lineholders",
       "70 hours"
      ],
      [
       "Reserve",
       "70 hours"
      ]
     ]
    }
   },
   {
    "key": "per_diem",
    "ref": true,
    "ja": {
     "label": "日当",
     "value": "国内線 1時間 USD 2.00",
     "note": ""
    },
    "en": {
     "label": "Per diem",
     "value": "USD 2.00 an hour domestic",
     "note": ""
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "",
     "rows": [
      [
       "協約",
       "初めての協約を交渉中"
      ],
      [
       "労組",
       "ALPA（2022年から）"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Contract",
     "value": "",
     "rows": [
      [
       "Contract",
       "Negotiating a first contract"
      ],
      [
       "Union",
       "ALPA since 2022"
      ]
     ],
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
     "value": "",
     "note": "",
     "rows": [
      [
       "Line - 乗務が決まっている月",
       "70時間分"
      ],
      [
       "Reserve - STBY要員の月",
       "70時間分"
      ]
     ]
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "",
     "note": "",
     "rows": [
      [
       "Lineholders",
       "70 hours"
      ],
      [
       "Reserve",
       "70 hours"
      ]
     ]
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "割増",
     "value": "",
     "rows": [
      [
       "月75時間を超えて飛んだ時間",
       "1時間の単価の1.25倍（25%増し）"
      ],
      [
       "休みの日に飛んだ時間",
       "1時間の単価の1.25倍（25%増し）"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Premium pay",
     "value": "",
     "rows": [
      [
       "Hours over 75 a month",
       "1.25 times the hourly rate"
      ],
      [
       "Flying on days off",
       "1.25 times the hourly rate"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "profit_sharing",
    "ref": false,
    "ja": {
     "label": "利益分配",
     "value": "あり（会社が利益の目標を達成したとき）",
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
     "label": "日当",
     "value": "国内線 1時間 USD 2.25",
     "note": ""
    },
    "en": {
     "label": "Per diem",
     "value": "USD 2.25 an hour domestic",
     "note": ""
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "会社の年金の積み立て（本人の積み立てに会社が足す）",
     "value": "",
     "rows": [
      [
       "本人が給与の3%を積み立てる",
       "会社も3%を入れる"
      ],
      [
       "本人が給与の5%を積み立てる",
       "会社は4%を入れる（会社が入れるのはここまで）"
      ],
      [
       "会社が入れたお金",
       "すぐに本人のもの（辞めても返さない）"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Retirement match",
     "value": "",
     "rows": [
      [
       "You put in 3% of pay",
       "The company adds 3%"
      ],
      [
       "You put in 5% of pay",
       "The company adds 4% (the maximum)"
      ],
      [
       "Company money",
       "Yours immediately (fully vested)"
      ]
     ],
     "note": ""
    }
   }
  ],
  "work": [
   {
    "key": "days_off",
    "ref": false,
    "ja": {
     "label": "月の休日（最低）",
     "value": "",
     "note": "",
     "rows": [
      [
       "Line - 乗務が決まっている月",
       "12日"
      ],
      [
       "Reserve - STBY要員の月",
       "12日"
      ]
     ]
    },
    "en": {
     "label": "Minimum days off",
     "value": "",
     "note": "",
     "rows": [
      [
       "Lineholders",
       "12"
      ],
      [
       "Reserve",
       "12"
      ]
     ]
    }
   },
   {
    "key": "training",
    "ref": false,
    "ja": {
     "label": "訓練中の給与",
     "value": "月 USD 6,020",
     "note": ""
    },
    "en": {
     "label": "Training pay",
     "value": "USD 6,020 a month",
     "note": ""
    }
   },
   {
    "key": "commuter",
    "ref": true,
    "ja": {
     "label": "飛行機での通勤",
     "value": "他社機のジャンプシートに乗れる（CASS という仕組み）",
     "note": ""
    },
    "en": {
     "label": "Commuting",
     "value": "Jumpseat access through CASS",
     "note": ""
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
     "value": "月75時間分",
     "note": "2026年時点"
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "75 hours a month",
     "note": "As of 2026"
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "会社の年金の積み立て",
     "value": "本人が積み立てた額の半分を、会社も出す",
     "note": ""
    },
    "en": {
     "label": "Retirement match",
     "value": "50% company match on your contributions",
     "note": ""
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
     "value": "",
     "rows": [
      [
       "ユナイテッド航空",
       "社員向けの航空券の優待"
      ],
      [
       "他社",
       "航空会社の社員向けの割引運賃（ZED）"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Staff travel",
     "value": "",
     "rows": [
      [
       "United",
       "Travel privileges"
      ],
      [
       "Other airlines",
       "ZED fares"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "health",
    "ref": false,
    "ja": {
     "label": "医療保険",
     "value": "",
     "rows": [
      [
       "医療",
       "UnitedHealthcare"
      ],
      [
       "歯科",
       "Delta Dental"
      ],
      [
       "眼科",
       "VSP"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Health insurance",
     "value": "",
     "rows": [
      [
       "Medical",
       "UnitedHealthcare"
      ],
      [
       "Dental",
       "Delta Dental"
      ],
      [
       "Vision",
       "VSP"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "disability",
    "ref": false,
    "ja": {
     "label": "働けなくなったときの補償・生命保険",
     "value": "長期の所得補償（LTD）・事故の死亡や障害の保険（AD&D）・生命保険",
     "note": ""
    },
    "en": {
     "label": "Disability & life",
     "value": "Long-term disability, AD&D and life insurance",
     "note": ""
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
     "label": "機長で直接入る人の訓練",
     "value": "初期訓練の移動とホテルは会社負担",
     "note": ""
    },
    "en": {
     "label": "Direct-entry captains",
     "value": "Company-paid travel and hotels for initial training",
     "note": ""
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
     "value": "",
     "note": "",
     "rows": [
      [
       "Line - 乗務が決まっている月",
       "65時間分"
      ],
      [
       "Reserve - STBY要員の月",
       "65時間分"
      ]
     ]
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "",
     "note": "",
     "rows": [
      [
       "Lineholders",
       "65 credit hours"
      ],
      [
       "Reserve",
       "65 credit hours"
      ]
     ]
    }
   },
   {
    "key": "premiums",
    "ref": true,
    "ja": {
     "label": "割増",
     "value": "",
     "rows": [
      [
       "空いた乗務に手を挙げた分",
       "1時間の単価の1.5倍"
      ],
      [
       "休みの日に会社から指名された乗務",
       "1回目は単価の2倍、2回目は2.5倍（90日に2回まで）"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Premium pay",
     "value": "",
     "rows": [
      [
       "Open time",
       "150%"
      ],
      [
       "Junior man",
       "200% the first time, 250% the second; max twice in 90 days"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "retirement",
    "ref": true,
    "ja": {
     "label": "会社の年金の積み立て",
     "value": "",
     "rows": [
      [
       "本人の積み立てに会社が足す分",
       "あり"
      ],
      [
       "以前の率",
       "4%、3年後から8%"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Retirement",
     "value": "",
     "rows": [
      [
       "Company match",
       "Yes"
      ],
      [
       "Previous rate",
       "4%, rising to 8% after 3 years"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "health",
    "ref": false,
    "ja": {
     "label": "医療保険・生命保険",
     "value": "",
     "rows": [
      [
       "保険",
       "医療・歯科・眼科・処方薬"
      ],
      [
       "生命保険",
       "あり"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Health & life insurance",
     "value": "",
     "rows": [
      [
       "Insurance",
       "Medical, dental, vision, prescription"
      ],
      [
       "Life insurance",
       "Yes"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "staff_travel",
    "ref": false,
    "ja": {
     "label": "社員の航空券",
     "value": "航空会社どうしの取り決めで、他社の航空券が社員割引になる",
     "note": ""
    },
    "en": {
     "label": "Staff travel",
     "value": "Interline discounts on other airlines",
     "note": ""
    }
   }
  ],
  "work": [
   {
    "key": "jumpseat",
    "ref": true,
    "ja": {
     "label": "ジャンプシート",
     "value": "他社機のジャンプシートに乗れる（CASS という仕組み）",
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
 "contour": {
  "pay": [
   {
    "key": "premiums",
    "ref": true,
    "ja": {
     "label": "割増",
     "value": "",
     "rows": [
      [
       "月18日を超えて勤務した分など",
       "1日の額の1.5倍"
      ],
      [
       "1日の額",
       "年俸 ÷ 216"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Premium pay",
     "value": "",
     "rows": [
      [
       "More than 18 duty days a month, and other cases",
       "1.5 times the day rate"
      ],
      [
       "Day rate",
       "Annual salary ÷ 216"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "per_diem",
    "ref": false,
    "ja": {
     "label": "日当",
     "value": "",
     "rows": [
      [
       "定期便・国内",
       "1時間 USD 2.08"
      ],
      [
       "定期便・国際",
       "1時間 USD 3.14"
      ],
      [
       "チャーター・国内",
       "1時間 USD 3.08"
      ],
      [
       "チャーター・国際",
       "1時間 USD 4.14"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Per diem",
     "value": "",
     "rows": [
      [
       "Scheduled, domestic",
       "USD 2.08/hr"
      ],
      [
       "Scheduled, international",
       "USD 3.14/hr"
      ],
      [
       "Charter, domestic",
       "USD 3.08/hr"
      ],
      [
       "Charter, international",
       "USD 4.14/hr"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "会社の年金の積み立て",
     "value": "401(k)（確定拠出年金）に、本人の積み立てに応じて会社が最大6%を足す。入社日から",
     "note": ""
    },
    "en": {
     "label": "Retirement match",
     "value": "401(k) match up to 6%, from your first day",
     "note": ""
    }
   },
   {
    "key": "staff_travel",
    "ref": false,
    "ja": {
     "label": "社員の航空券",
     "value": "Contour の便と、他社便（MyIDTravel）に乗れる。対象の家族も",
     "note": ""
    },
    "en": {
     "label": "Staff travel",
     "value": "Contour and other airlines via MyIDTravel, including eligible family",
     "note": ""
    }
   },
   {
    "key": "health",
    "ref": false,
    "ja": {
     "label": "医療保険・働けなくなったときの補償",
     "value": "",
     "rows": [
      [
       "保険",
       "医療・歯科・眼科"
      ],
      [
       "所得補償",
       "短期・長期"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Health & disability",
     "value": "",
     "rows": [
      [
       "Insurance",
       "Medical, dental, vision"
      ],
      [
       "Disability",
       "Short- and long-term"
      ]
     ],
     "note": ""
    }
   }
  ],
  "work": [
   {
    "key": "training",
    "ref": true,
    "ja": {
     "label": "初期訓練",
     "value": "",
     "rows": [
      [
       "期間",
       "7〜8週間"
      ],
      [
       "訓練中",
       "初日から給与。個室のホテル・移動・日当"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Initial training",
     "value": "",
     "rows": [
      [
       "Length",
       "7–8 weeks"
      ],
      [
       "During training",
       "Paid from day one, with single hotel rooms, travel and per diem"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "jumpseat",
    "ref": false,
    "ja": {
     "label": "ジャンプシート",
     "value": "他社機のジャンプシートに乗れる（CASS という仕組み）",
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
     "value": "",
     "rows": [
      [
       "入社から2年間の副操縦士",
       "月75時間以上"
      ],
      [
       "その後",
       "機材と、Line か Reserve かで変わる"
      ],
      [
       "1年での調整",
       "年900時間を基準に調整する仕組みがある"
      ]
     ],
     "note": "2023〜2027年の協約"
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "",
     "rows": [
      [
       "First officers, first two years",
       "75+ hours a month"
      ],
      [
       "After that",
       "Varies by fleet and by line or reserve"
      ],
      [
       "Annual adjustment",
       "Minimum guarantee adjusted against 900 hours a year"
      ]
     ],
     "note": "2023–2027 contract"
    }
   },
   {
    "key": "per_diem",
    "ref": false,
    "ja": {
     "label": "日当",
     "value": "",
     "rows": [
      [
       "カナダ・米国",
       "政府の出張の日当（NJC）の地域ごとの日額の85%を、24で割って1時間ごとに支払う"
      ],
      [
       "海外",
       "地域ごとに65%・70%・75%など"
      ]
     ],
     "note": "半年ごとに見直し"
    },
    "en": {
     "label": "Per diem",
     "value": "",
     "rows": [
      [
       "Canada/US",
       "85% of the Canadian government (NJC) regional daily rate, divided by 24 and paid per hour"
      ],
      [
       "International",
       "Varies by region (e.g. 65%, 70%, 75%)"
      ]
     ],
     "note": "Updated every six months"
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "会社の年金",
     "value": "入社の時期で、確定給付（DB）・複数の会社でつくる年金（MEPP）・確定拠出（DC）に分かれる",
     "note": ""
    },
    "en": {
     "label": "Pension",
     "value": "Defined benefit (DB), multi-employer plan (MEPP) or defined contribution (DC), depending on when you were hired",
     "note": ""
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "",
     "rows": [
      [
       "協約の期間",
       "2023年9月30日〜2027年9月29日"
      ],
      [
       "いまの給与表",
       "2026年9月30日から"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Contract",
     "value": "",
     "rows": [
      [
       "Term",
       "Sep 30, 2023 – Sep 29, 2027"
      ],
      [
       "Current pay rates",
       "Effective Sep 30, 2026"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "health",
    "ref": false,
    "ja": {
     "label": "医療保険",
     "value": "医療・歯科などの保険",
     "note": ""
    },
    "en": {
     "label": "Health insurance",
     "value": "Medical, dental and other coverage",
     "note": ""
    }
   }
  ],
  "work": [
   {
    "key": "training",
    "ref": false,
    "ja": {
     "label": "訓練中",
     "value": "",
     "rows": [
      [
       "宿泊",
       "ホテルと食事（距離によって泊まり方を選べる）"
      ],
      [
       "タクシー",
       "会社の送迎が無いときは、領収書で精算"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "During training",
     "value": "",
     "rows": [
      [
       "Lodging",
       "Hotel and meals; lodging options depend on distance criteria"
      ],
      [
       "Taxis",
       "Fares reimbursed with receipts when no transportation is provided"
      ]
     ],
     "note": ""
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
     "value": "月77.5時間分",
     "note": ""
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "77.5 hours a month",
     "note": ""
    }
   },
   {
    "key": "premiums",
    "ref": false,
    "ja": {
     "label": "割増",
     "value": "給与に数える時間が85時間を超えた分は割増",
     "note": ""
    },
    "en": {
     "label": "Premium pay",
     "value": "Premium pay above 85 credit hours",
     "note": ""
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "本体の協約は2023年1月1日〜2026年12月31日",
     "note": "グループの Encore は別の協約"
    },
    "en": {
     "label": "Contract",
     "value": "Mainline CBA runs Jan 1, 2023 – Dec 31, 2026",
     "note": "Encore, in the same group, has a separate contract"
    }
   }
  ],
  "work": [
   {
    "key": "bidding",
    "ref": false,
    "ja": {
     "label": "勤務の希望の出し方",
     "value": "",
     "rows": [
      [
       "決め方",
       "勤続の長さの順だけでは決めない"
      ],
      [
       "決まった後",
       "乗務の交換・取りやめ・追加ができる"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Bidding",
     "value": "",
     "rows": [
      [
       "System",
       "Socialized bidding, not seniority-only"
      ],
      [
       "After awards",
       "Trips can be traded, dropped and picked up"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "reserve",
    "ref": false,
    "hide": "スタンバイに2種類あるというだけで、時間も条件も無く、比べる意味が薄い",
    "ja": {
     "label": "スタンバイ",
     "value": "すぐ呼ばれるスタンバイと、前もって呼ばれるスタンバイの2種類",
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
     "value": "他社とお互いにジャンプシートに乗れる取り決めがある",
     "note": ""
    },
    "en": {
     "label": "Jumpseat",
     "value": "Reciprocal jumpseat agreements",
     "note": ""
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
     "value": "月75時間分",
     "note": ""
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "75 hours a month",
     "note": ""
    }
   },
   {
    "key": "per_diem",
    "ref": false,
    "ja": {
     "label": "日当などの手当",
     "value": "",
     "rows": [
      [
       "給与とは別の手当（乗務の量で変わる）",
       "年平均 約 CAD 9,000"
      ],
      [
       "1か月あたりの例",
       "CAD 800〜1,000"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Per diem & allowances",
     "value": "",
     "rows": [
      [
       "Non-salary allowances (vary with flying)",
       "About CAD 9,000 a year on average"
      ],
      [
       "Example per month",
       "CAD 800–1,000"
      ]
     ],
     "note": ""
    }
   },
   {
    "key": "retirement",
    "ref": false,
    "ja": {
     "label": "会社の年金の積み立て",
     "value": "確定拠出年金（DC）に、本人の積み立てに応じて会社が最大8%を足す。勤続年数とともに上がる",
     "note": ""
    },
    "en": {
     "label": "Retirement match",
     "value": "Company match to the DC pension of up to 8%, rising with years of service",
     "note": ""
    }
   },
   {
    "key": "medical_cost",
    "ref": false,
    "ja": {
     "label": "身体検査などの手当",
     "value": "身体検査・パスポート・制服などに、年 CAD 1,600 を超える手当",
     "note": ""
    },
    "en": {
     "label": "Medicals & other allowances",
     "value": "Over CAD 1,600 a year for medicals, passport, uniforms and more",
     "note": ""
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
     "value": "エア・カナダの社員向けの航空券の優待",
     "note": ""
    },
    "en": {
     "label": "Staff travel",
     "value": "Air Canada staff travel privileges",
     "note": ""
    }
   }
  ],
  "work": [
   {
    "key": "bidding",
    "ref": false,
    "ja": {
     "label": "勤務の希望の出し方",
     "value": "勤続の長さの順に希望が通る。アプリで出せる",
     "note": ""
    },
    "en": {
     "label": "Bidding",
     "value": "Seniority-based, done through an app",
     "note": ""
    }
   },
   {
    "key": "equipment",
    "ref": false,
    "ja": {
     "label": "支給の機器",
     "value": "iPad と Bose のヘッドセット",
     "note": ""
    },
    "en": {
     "label": "Equipment",
     "value": "iPad and Bose headset provided",
     "note": ""
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
     "value": "月77.5時間分",
     "note": ""
    },
    "en": {
     "label": "Minimum guarantee",
     "value": "77.5 hours a month",
     "note": ""
    }
   },
   {
    "key": "contract",
    "ref": false,
    "ja": {
     "label": "労働協約",
     "value": "",
     "rows": [
      [
       "労組",
       "2025年8月12日に ALPA に加わった"
      ],
      [
       "協約",
       "初めての協約を交渉中"
      ]
     ],
     "note": ""
    },
    "en": {
     "label": "Contract",
     "value": "",
     "rows": [
      [
       "Union",
       "Joined ALPA on Aug 12, 2025"
      ],
      [
       "Contract",
       "First ALPA contract under negotiation"
      ]
     ],
     "note": ""
    }
   }
  ]
 }
});
