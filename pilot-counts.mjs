/* pilot-counts.mjs ── 会社ごとのパイロットの人数と運航機材の数（ROUND8・2026-11-04 調べ）。地域・国・世界の平均の重み（pilot-weights.mjs）だけが読む。
 *
 * ★出どころ：ChatGPT（Codex）の調査パック ROUND8（124社・受け渡しの決まり 1.1.1・検査の道具でエラー 0）。
 *   1行ずつ、資料の URL・引用（quote）・調べた側の条件（cond）・パックと記録の ID を持つ。人数が見つからなかった会社だけ機材の数を調べている。
 * ★なぜ research-ledger.mjs（取り込みの台帳）に入れないか：あちらは会社ページが読んで画面に出す台帳。
 *   ここは平均の計算だけに使う数で、画面には1行も出さない（会社ページを変えない）。
 * ⚠️ text は資料の字のまま（"more than 5,700"・"１６９"・"1.062" ＝ 点が桁区切り）。数に直すのは pilot-weights.mjs の countOf。
 * ⚠️ 手で直さない。調べ直したら、新しいパックから作り直す（使い捨ての道具はリポジトリの外）。
 * ⚠️ 本番には配らない（.mjs）。
 */
export const COUNTS = Object.freeze({
  "aegean": {
    fleet: {"text":"88","at":"2025-12-31","cond":"AEGEANグループの総数でOlympic Airを含む。AEGEAN単独の機材数ではない。資料に明記された総数を採用し機種別の足し算はしない。","quote":"as of 31.12.2025 the Group’s fleet consists of 88 aircraft.","url":"https://en.about.aegeanair.com/-/media/AboutAegean/IR/IR_Annual_Reports/2025/ENG_AEGEAN_ANNUAL_2025_F15.pdf","publisher":"AEGEAN Airlines","id":"aegean.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-aegean"},
  },
  "aer-lingus": {
    fleet: {"text":"63","at":"2025-12-31","cond":"Aer Lingus公式環境報告書会社概要の年末総機材63機。","quote":"63 Aircraft as at 31 December 2025","url":"https://www.aerlingus.com/media/pdfs/ei-2025-environmental-report.pdf","publisher":"Aer Lingus","id":"aer-lingus.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-aer-lingus"},
  },
  "aeromexico": {
    pilots: {"text":"2,034","at":"2025-12-31","cond":"Grupo Aeroméxico全体の人数でAeroméxico Connectを含む。Aeroméxico単体の人数へ分割できないため、そのまま本体の加重平均用頭数には採用しない。機長副操縦士、訓練生の内訳は記載なし。","quote":"Pilots 2,034 2,082 2,039","url":"https://www.sec.gov/Archives/edgar/data/1561861/000119312526197494/d101275d20f.htm","publisher":"Grupo Aeroméxico, S.A.B. de C.V.","id":"aeromexico.scale.pilots.20261104","pack":"pvr-20261104-r8-aeromexico"},
  },
  "air-canada": {
    pilots: {"text":"more than 5,700","at":null,"cond":"5,700人超という下限表現であり、5,700人の確定値にしない。集計時点は不明。子会社や訓練生の範囲記載なし。","quote":"Air Canada employs more than 5,700 professional pilots.","url":"https://www.alpa.org/supporting-pilots/pilot-groups/air-canada","publisher":"Air Line Pilots Association, International","id":"air-canada.scale.pilots.20261104","pack":"pvr-20261104-r8-air-canada"},
  },
  "air-china": {
    pilots: {"text":"14,756","at":"2025-12-31","cond":"Group（会社および子会社）の Flight crew。客室乗務員は別区分。単体の人数ではない。機長・副操縦士の内訳、訓練生・出向者の扱いは未記載。","quote":"Flight crew 14,756","url":"https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0424/2026042402937.pdf","publisher":"Air China","id":"air-china.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-air-china"},
  },
  "air-france": {
    pilots: {"text":"4,275","at":"2025-12-31","cond":"STAFF欄のAir Franceの人数。機長・副操縦士の内訳、訓練生・出向者・HOP!乗員の包含は人数欄に明記なし。","quote":"Last updated December 31, 2025 4,275 pilots","url":"https://corporate.airfrance.com/en/about-air-france/key-figures","publisher":"Air France","id":"air-france.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-air-france"},
  },
  "air-india": {
    pilots: {"text":"~3300","at":null,"cond":"会社発表は~3300（約3,300名）。正確な人数ではなく概数で、こちらで丸めた値ではない。人数の厳密な基準日は未記載。機長・副操縦士の内訳、訓練生・出向者、AirIndiaExpressを含むかは未記載。","quote":"Pilot count 2X, from ~1600 to ~3300","url":"https://www.airindia.com/in/en/newsroom/articles/Air-India-s-people-transformation-Rebuilt-for-scale-performance-and-the-future.html","publisher":"Air India","id":"air-india.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-air-india"},
  },
  "air-new-zealand": {
    pilots: {"text":"around 1,700","at":null,"cond":"資料はaround（約）1,700名と公表。正確な人数ではなく、この概数を丸め直していない。機長・副操縦士の内訳、訓練生・出向者の扱いは未記載。","quote":"Currently, Air New Zealand employs around 1,700 pilots","url":"https://www3.parliament.nz/media/11736/compendium-of-annual-review-reports-2023-24-vol-1.pdf","publisher":"New Zealand Parliament","id":"air-new-zealand.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-air-new-zealand"},
  },
  "air-peace": {
    fleet: {"text":"over 50","at":null,"cond":"over 50（50機超）という下限表現。正確に50機という意味ではない。本文の会社全体の機材。機長・副操縦士の人数は確認できず代替。記事の公表日と厳密な機材集計日は別。","quote":"With a fleet of over 50 aircraft","url":"https://flyairpeace.com/blog/turkish-airlines-and-air-peace-sign-a-bilateral-spa-interline-agreement-to-strengthen-connectivity-between-nigeria-africa-and-the-world/","publisher":"Air Peace","id":"air-peace.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-air-peace"},
  },
  "airasia": {
    fleet: {"text":"203","at":"2026-03-31","cond":"AirAsiaMalaysia・Thailand・Indonesia・Philippines・CambodiaおよびAirAsiaXMalaysiaの連結AOC合計。AirAsiaMalaysia単体ではない。TAAX11機は別。operatingfleetであり保有240機と区別。","quote":"The Consolidated AOCs increased the operating fleet by 1 YoY to 203 aircraft","url":"https://newsroom.airasia.com/news/airasia-x-records-strong-1q2026-operating-performance-with-passenger-growth-of-9-yoy","publisher":"AirAsia Group","id":"airasia.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-airasia"},
  },
  "airdo": {
    pilots: {"text":"１６９","at":"2026-03-31","cond":"訓練生を含む。運航に関わる委託先の人数は除く。機長・副操縦士の内訳、出向者の扱いは記載なし。","quote":"運航乗務員 １６９名 訓練生含む","url":"https://www.airdo.jp/corporate/safety/","publisher":"株式会社AIRDO","id":"airdo.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-airdo"},
  },
  "airjapan": {
    pilots: {"text":"192","at":"2026-04-01","cond":"うち機長107名・副操縦士85名。会社別の表に書かれた総計。訓練生・出向者の包含は明記なし。運航部の組織人数にはANA兼務98名の記載があるが、その人数と運航乗務員総計192名との重複関係は明記されていない。AirJapanブランドのみの人数とはみなさない。","quote":"機 長 107 名 副操縦士 85 名 総 計 192 名","url":"https://www.ana.co.jp/group/img/safe/outline/report/safety_report_2025.pdf","publisher":"全日本空輸株式会社・株式会社エアージャパン・ANAウイングス株式会社","id":"airjapan.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-airjapan"},
  },
  "airx-charter": {
    fleet: {"text":"21","at":null,"cond":"公式記事に明示された運航機材総数21機。Heavy Jets / Lineage / widebody VIPを含む。記事の更新表示は2026-10-23で、機材総数の厳密な集計日は未記載。","quote":"AirX operates a fleet of 21 aircraft","url":"https://www.airx.aero/airx-secures-approval-to-launch-private-jet-operations-in-saudi-arabia/","publisher":"AirX","id":"airx-charter.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-airx-charter"},
  },
  "alaska-airlines": {
    pilots: {"text":"3,360","at":"2025-12-31","cond":"Alaskaのパイロット。Hawaiian・Horizonは別表であり加算しない。訓練生・出向者の扱い、機長副操縦士内訳は記載なし。","quote":"Pilots 3,360","url":"https://www.sec.gov/Archives/edgar/data/0000766421/000119312526132064/alaska_air_-_2025_ars.pdf","publisher":"Alaska Air Group","id":"alaska-airlines.scale.pilots.20261104","pack":"pvr-20261104-r8-alaska-airlines"},
  },
  "allegiant": {
    pilots: {"text":"Nearly 1,300","at":null,"cond":"約1,300名弱という概数。Sun Country統合後の人数として合算しない。旧1,320は2025年末の概数FTEである。","quote":"Nearly 1,300 pilots represented by the Allegiant Pilots Association, Teamsters Local 2118","url":"https://teamster.org/2026/08/allegiant-air-pilots-ratify-two-year-agreement/","publisher":"International Brotherhood of Teamsters","id":"allegiant.scale.pilots.20261104","pack":"pvr-20261104-r8-allegiant"},
  },
  "american": {
    pilots: {"text":"14,970","at":"2025-12-31","cond":"Mainlineのみ。Envoy・Piedmont・PSAは別掲で含めない。表注はapproximate number of active employees（稼働社員の概数）。厳密な頭数として加重計算へ自動採用しない。","quote":"Allied Pilots Association (APA) Pilots 14,970 2027","url":"https://www.sec.gov/Archives/edgar/data/6201/000000620126000014/aal-20251231.htm","publisher":"American Airlines Group Inc.","id":"american.scale.pilots.20261104","pack":"pvr-20261104-r8-american"},
  },
  "amx": {
    pilots: {"text":"8","at":"2025-08-01","cond":"定期航空運送事業のみの運航乗務員8名。防災ヘリコプター運航受託部門の人数を含む会社全体の操縦士数ではない。機長・副操縦士の内訳、訓練生・出向者の扱いは未記載。","quote":"運航乗務員 8 名","url":"https://www.amx.co.jp/pdf/anzen/anzen_ho2024.pdf","publisher":"天草エアライン株式会社","id":"amx.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-amx"},
  },
  "ana": {
    pilots: {"text":"2,250","at":"2026-04-01","cond":"うち機長1,549名・副操縦士701名。会社別の表に書かれた総計。訓練生・出向者の包含は明記なし。","quote":"機 長 1,549 名 副操縦士 701 名 総 計 2,250 名","url":"https://www.ana.co.jp/group/img/safe/outline/report/safety_report_2025.pdf","publisher":"全日本空輸株式会社・株式会社エアージャパン・ANAウイングス株式会社","id":"ana.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-ana"},
  },
  "ana-wings": {
    pilots: {"text":"595","at":"2026-04-01","cond":"うち機長331名・副操縦士264名。会社別の表に書かれた総計。訓練生・出向者の包含は明記なし。","quote":"機 長 331 名 副操縦士 264 名 総 計 595 名","url":"https://www.ana.co.jp/group/img/safe/outline/report/safety_report_2025.pdf","publisher":"全日本空輸株式会社・株式会社エアージャパン・ANAウイングス株式会社","id":"ana-wings.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-ana-wings"},
  },
  "asiana": {
    pilots: {"text":"1,365","at":"2024","cond":"安全運航の学習教育表に明記された運航乗務員の人数。2024年欄1,365名。訓練実施対象1,442名・組合加入対象1,261名とは別の公表区分。機長・副操縦士の内訳、訓練生・出向者・外国人の扱いは未記載。","quote":"운항승무원 인원 명 1,439 1,417 1,365 1,407","url":"https://k-esg.org/common/fdown?pfiId=4161","publisher":"Asiana Airlines","id":"asiana.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-asiana"},
  },
  "atlas-air": {
    fleet: {"text":"88","at":"2025-12-31","cond":"Atlas Air WorldwideのOperating Fleet。Total Fleet113のうちDry Lease25を除く運航機材数として88が明示される。Atlas Air単独と連結範囲の区別に注意。","quote":"Operating Fleet 88 Dry Lease 25","url":"https://www.atlasairworldwide.com/wp-content/uploads/2026/07/atlas-sustainabilityreport-2025.pdf","publisher":"Atlas Air Worldwide","id":"atlas-air.scale.fleet-total.20261104","pack":"pvr-20261104-r8-atlas-air"},
  },
  "austrian": {
    pilots: {"text":"roughly 1,000","at":"2024-04","cond":"roughly 1,000（約1,000名）の労働協約対象者数。2024年4月の協約締結時の概数であり、2025年末現員として扱わない。","quote":"a new collective agreement for around 2,400 flight attendants and roughly 1,000 pilots.","url":"https://report.lufthansagroup.com/2024/annual-report/en/combined-management-report/business-segments/passenger-airlines-business-segment/austrian-airlines/","publisher":"Lufthansa Group","id":"austrian.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-austrian"},
  },
  "avelo-airlines": {
    pilots: {"text":"nearly 170","at":null,"cond":"170名弱という概数で厳密な頭数ではない。新しい人数を探したが、この公式発表より新しい総人数を確認できなかった。2023年の古い資料。","quote":"Avelo currently employs nearly 170 pilots","url":"https://www.aveloair.com/company-news/avelo-airlines-upgrades-pilot-compensation","publisher":"Avelo Airlines","id":"avelo-airlines.scale.pilots.20261104","pack":"pvr-20261104-r8-avelo-airlines"},
  },
  "breeze-airways": {
    pilots: {"text":"731","at":null,"cond":"数字の大きな表示は731。直後の本文は625名と異なる。採用保留。","quote":"731","url":"https://www.alpa.org/supporting-pilots/pilot-groups/breeze-airways","publisher":"Air Line Pilots Association, International","id":"breeze-airways.scale.pilots.callout.20261104","pack":"pvr-20261104-r8-breeze-airways"},
    pilots_alt: [{"text":"625","at":null,"cond":"本文は625名。見出し数字731と異なる。採用保留。","quote":"Breeze Airways employs a team of 625 professional pilots.","url":"https://www.alpa.org/supporting-pilots/pilot-groups/breeze-airways","publisher":"Air Line Pilots Association, International","id":"breeze-airways.scale.pilots.prose.20261104","pack":"pvr-20261104-r8-breeze-airways"}],
  },
  "british-airways": {
    pilots: {"text":"around 4,000","at":"2024-07-23","cond":"公表はaround 4,000（約4,000名）。最新IAG2025報告の9,107名は複数航空会社全体でありBA単体には使わない。BA単体のより新しい現員数は確認できず、同じ旧記録の概数条件を明示。","quote":"British Airways currently employs around 4,000 pilots.","url":"https://mediacentre.britishairways.com/pressrelease/details/20399","publisher":"British Airways","id":"british-airways.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-british-airways"},
  },
  "cathay-pacific": {
    fleet: {"text":"179","at":"2025-12-31","cond":"Cathay Pacific Airways Limited単体の運航機材。HKExpress、AirHongKongの別行を含めない。","quote":"Total of the Company 140 22 17 179","url":"https://www.cathaypacific.com/content/dam/cx/about-us/investor-relations/interim-annual-reports/en/2025_cx_annual_report_en.pdf","publisher":"Cathay Pacific","id":"cathay-pacific.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-cathay-pacific"},
  },
  "china-airlines": {
    fleet: {"text":"87","at":"2025-12-31","cond":"旅客機69機・貨物機18機を含む。本文に総数87機が明記されており加算していない。","quote":"the fleet size reached 87 aircrafts, including 69 passenger aircrafts and 18 cargo aircrafts.","url":"https://calec.china-airlines.com/annual-report/annual_2025.pdf","publisher":"China Airlines","id":"china-airlines.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-china-airlines"},
  },
  "china-eastern": {
    pilots: {"text":"11,784","at":"2025-12-31","cond":"親会社と主要子会社を含む Group の Pilots。単体ではない。客室乗務員その他航空乗員は別区分。機長・副操縦士の内訳、訓練生・出向者の扱いは未記載。","quote":"Pilots 11,784","url":"https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0427/2026042702576.pdf","publisher":"China Eastern Airlines","id":"china-eastern.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-china-eastern"},
  },
  "china-southern": {
    pilots: {"text":"13,253","at":"2025-12-31","cond":"会社および主要子会社を含む Group の Flight 区分。単体ではない。機長・副操縦士の内訳、訓練生・出向者の扱いは未記載。","quote":"Flight 13,253","url":"https://www.hkexnews.hk/listedco/listconews/sehk/2026/0427/2026042701655.pdf","publisher":"China Southern Airlines","id":"china-southern.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-china-southern"},
  },
  "contour": {
    fleet: {"text":"approximately 30","at":null,"cond":"会社公式採用ページの約30機。Contour Aviationの多様な事業を含む範囲で、定期便ブランドだけの機数とは限らない。時点不明。","quote":"Our fleet of approximately 30 aircraft","url":"https://www.careers.contourairlines.com/about-us","publisher":"Contour Aviation","id":"contour.scale.fleet-total.20261104","pack":"pvr-20261104-r8-contour"},
  },
  "copa-airlines": {
    pilots: {"text":"1,552","at":"2025-12-31","cond":"Copa HoldingsのCompanyとしての社員分類表。Copa Airlines単独と切り分けた頭数とは確定できない。AeroRepúblicaを含む連結対象との範囲確認を要する。訓練生、機長副操縦士内訳は記載なし。","quote":"Pilots 1,552 1,456 1,422","url":"https://www.sec.gov/Archives/edgar/data/1345105/000134510526000019/cpa-20251231.htm","publisher":"Copa Holdings, S.A.","id":"copa-airlines.scale.pilots.20261104","pack":"pvr-20261104-r8-copa-airlines"},
  },
  "daiichi-air": {
    pilots: {"text":"２２","at":"2026-03-31","cond":"公表区分「航空機乗組員」の22名。運航部14名や整備従事者21名は別の集計。機長・副操縦士の内訳、訓練生・出向者の扱いは未記載。","quote":"航空機乗組員 客室乗務員 整備従事者 ２２名 ０名 ２１名","url":"https://www.dai1air.com/images/company/safe.pdf","publisher":"第一航空株式会社","id":"daiichi-air.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-daiichi-air"},
  },
  "delta": {
    pilots: {"text":"17,260","at":"2025-12-31","cond":"Delta本体の労働協約対象人数（表見出しはApproximate Number）。Endeavor Pilotsは別行で含めない。厳密な頭数として自動採用しない。","quote":"Delta Pilots 17,260 ALPA December 31, 2026","url":"https://www.sec.gov/Archives/edgar/data/27904/000002790426000013/dal-20251231.htm","publisher":"Delta Air Lines, Inc.","id":"delta.scale.pilots.20261104","pack":"pvr-20261104-r8-delta"},
  },
  "easyjet": {
    pilots: {"text":"4,988","at":"2025-09-30","cond":"easyJetのHEADCOUNT。資料はMalta employeesをpeople metricsから除外すると明記。機長・副操縦士の内訳・訓練生・出向者の包含は明記なし。","quote":"HEADCOUNT Sep-25 Sep-24 Variance % Pilots 4,988 4,625 363 7.8%","url":"https://s203.q4cdn.com/522538739/files/policies/2026/49677_easyjet_factsheet_Human_Capital_AW2_11-40am_040326.pdf","publisher":"easyJet plc","id":"easyjet.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-easyjet"},
  },
  "egyptair": {
    fleet: {"text":"71","at":"2024-06-30","cond":"2024年6月末。旅客機と貨物機を含む71機。報告書内訳は狭胴45機、広胴22機、貨物4機。将来計画97機・125機を除外。","quote":"EGYPTAIR has a fleet of 71 aircraft in total","url":"https://www.egyptair.com/en/about-egyptair/Documents/ANNUAL%20REPORT%202023%20-%202024.pdf","publisher":"EGYPTAIR","id":"egyptair.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-egyptair"},
  },
  "emirates": {
    pilots: {"text":"5000","at":null,"cond":"会社採用ページのflight deck team。時点不明。5000という公表表記を保持し、当方で丸めない。機長副操縦士、訓練生、管理職の内訳は記載なし。","quote":"5000 Your flight deck team","url":"https://www.emiratesgroupcareers.com/pilots/","publisher":"The Emirates Group","id":"emirates.scale.pilots.20261104","pack":"pvr-20261104-r8-emirates"},
  },
  "ethiopian-airlines": {
    fleet: {"text":"168","at":null,"cond":"2026年1月版に掲載された運航機材総数。貨物20機とビジネスジェット1機を含む表のOperating fleet。厳密な日付は記載なし。Owned fleet147という別概念と混同しない。","quote":"Total Operating fleet 168","url":"https://corporate.ethiopianairlines.com/docs/default-source/ethiopian-factsheet/ethiopian-factsheet-january-2026.pdf","publisher":"Ethiopian Airlines Group","id":"ethiopian-airlines.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-ethiopian-airlines"},
  },
  "etihad": {
    fleet: {"text":"127","at":"2025-12-31","cond":"2025年通期業績で、当年29機追加後のoperating fleetを127と明記。発注・将来計画を含めない。","quote":"the operating fleet grew to 127 aircraft","url":"https://www.etihad.com/en-br/news/etihad-airways-delivers-record-aed-26-billion-us--698-million-profit-in-2025-marking-strongest-performance-in-the-airlines-history","publisher":"Etihad Airways","id":"etihad.scale.fleet-total.20261104","pack":"pvr-20261104-r8-etihad"},
  },
  "eurowings": {
    fleet: {"text":"98","at":"2025-12-31","cond":"年次報告書T011のEW（Eurowings）列、総機材98機。グループ737機とは区別。資料表は総fleetで個別の長期整備・保管状態の切分けは示さない。","quote":"Total aircraft 387 116 67 47 98 22 737","url":"https://report.lufthansagroup.com/2025/annual-report/en/combined-management-report/principles-of-the-group/fleet-and-route-network/fleet/","publisher":"Deutsche Lufthansa AG","id":"eurowings.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-eurowings"},
  },
  "eva-air": {
    fleet: {"text":"89","at":"2025-12-31","cond":"EVAAir機材表の2025年末総数。2026年末予定89機とは別の実績列。貨物機777F9機を含む。","quote":"Total 89 89 0","url":"https://www.evaair.com/en-tw/images/annual-reports-year-114-en_tcm53-98343.pdf","publisher":"EVA Air","id":"eva-air.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-eva-air"},
  },
  "fda": {
    pilots: {"text":"124","at":"2026-03-31","cond":"有資格者の人数。うち機長70名。副操縦士の内訳は単独掲載なしのため差し引いて計算しない。訓練生・出向者の扱いは記載なし。","quote":"運航乗務員 124 名（機長 70 名）","url":"https://www.fujidream.co.jp/company/doc/safetyreport_2026.pdf","publisher":"株式会社フジドリームエアラインズ","id":"fda.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-fda"},
  },
  "fedex-express": {
    pilots: {"text":"5,000","at":null,"cond":"FedEx airlineのpilots。2026年10-Kはパイロット総人数を示さないため会社発表を採用。5,000は資料の公表値そのまま。機長副操縦士の内訳、訓練生の扱いは記載なし。","quote":"the FedEx airline and its 5,000 pilots.","url":"https://newsroom.fedex.com/newsroom/global-english/fedex-reaches-agreement-with-pilots","publisher":"FedEx","id":"fedex-express.scale.pilots.20261104","pack":"pvr-20261104-r8-fedex-express"},
  },
  "fiji-airways": {
    fleet: {"text":"23","at":"2024","cond":"FijiLinkを含む年次報告書の機材総数。図版の23を確認。単体とFijiLinkの人数推計に使わない。","quote":"2024 23 AIRCRAFT","url":"https://www.parliament.gov.fj/wp-content/uploads/2026/03/11Fiji-Airways-Annual-Report-2024-2.pdf","publisher":"FijiAirways","id":"fiji-airways.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-fiji-airways"},
  },
  "finnair": {
    pilots: {"text":"approximately 850","at":null,"cond":"公式FAQがapproximately 850（約850名）と公表。正確な現員数ではなく公表概数。集計時点・機長副操縦士内訳・訓練生や出向者の包含は明記なし。","quote":"We have approximately 850 pilots.","url":"https://company.finnair.com/en/careers/pilots","publisher":"Finnair","id":"finnair.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-finnair"},
  },
  "flydubai": {
    pilots: {"text":"more than 1,520","at":null,"cond":"qualified pilotsが1,520名超。厳密な総人数は示されていない。記事は新たなAb Initio cadetsを別に説明。訓練生を含むかは明記されていない。","quote":"including more than 1,520 qualified pilots","url":"https://news.flydubai.com/flydubai-partners-with-egnatia-aviation-and-skyborne-to-advance-pilot-training-capabilities","publisher":"flydubai","id":"flydubai.scale.pilots.20261104","pack":"pvr-20261104-r8-flydubai"},
  },
  "frontier": {
    pilots: {"text":"2,260","at":null,"cond":"組合公表のprofessional pilots。時点不明。2025年10-Kは約2,300名と記載。年度・集計時点が異なる可能性があり、直ちに競合とはしない。","quote":"Frontier Airlines employs a team of 2,260 professional pilots.","url":"https://www.alpa.org/supporting-pilots/pilot-groups/frontier-airlines","publisher":"Air Line Pilots Association, International","id":"frontier.scale.pilots.20261104","pack":"pvr-20261104-r8-frontier"},
  },
  "garuda-indonesia": {
    pilots: {"text":"1.062","at":"2025","cond":"GarudaIndonesia単体の職種別Pilot総数。男性1,038名・女性24名。インドネシア表記のピリオドは桁区切り。機長・副操縦士の内訳、訓練生・出向者の扱いは未記載。","quote":"Penerbang Pilot 1.038 24 1.062","url":"https://www.garuda-indonesia.com/static/content/dam/garuda/hubungan-investor/AR-GARUDA-2025_Final.pdf","publisher":"PT Garuda Indonesia (Persero) Tbk","id":"garuda-indonesia.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-garuda-indonesia"},
  },
  "gojet": {
    pilots: {"text":"over 520","at":null,"cond":"2016年の組合交渉単位の人数が520名超。現在の頭数として利用しない。会社概要・2022年の組合発表では新しい総人数を見つけられなかった。","quote":"There are over 520 members in the bargaining unit covered by the agreement.","url":"https://teamster.org/2016/03/teamster-pilots-overwhelmingly-ratify-agreement-gojet-airlines/","publisher":"International Brotherhood of Teamsters","id":"gojet.scale.pilots.20261104","pack":"pvr-20261104-r8-gojet"},
  },
  "hac": {
    pilots: {"text":"38","at":"2026-03-31","cond":"当該会社の運航乗務員表の人数。訓練生・出向者の扱い、職位別内訳は記載なし。","quote":"運航乗務員 38名","url":"https://www.jal.com/sites/ja/safety/report/pdf_sites/index_020_ja.pdf","publisher":"日本航空株式会社ほかJALグループ航空会社8社","id":"hac.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-hac"},
  },
  "hainan-airlines": {
    pilots: {"text":"5,470","at":"2025","cond":"海南航空控股の2025年報告範囲のパイロット数。単体と子会社の切り分けはない。機長・副操縦士の内訳、訓練生・出向者の扱いは未記載。","quote":"飞行员数量 人 5,435 5,366 5,470","url":"https://static.cninfo.com.cn/finalpage/2026-04-18/1225119632.PDF","publisher":"Hainan Airlines","id":"hainan-airlines.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-hainan-airlines"},
  },
  "hong-kong-express": {
    pilots: {"text":"436","at":"2025","cond":"HK ExpressのPilots。親会社Cathayの単体人数に転用しない。機長・副操縦士の内訳、訓練生・出向者の扱いは未記載。","quote":"Our 1,955 employees, made up of 876 cabin crew, 436 pilots and 643 office employees,","url":"https://www.cathaypacific.com/content/dam/cx/about-us/sustainability/sustainability-reports/en/cathay-pacific-sustainability-report-2025-en.pdf","publisher":"Cathay Pacific Airways Limited","id":"hong-kong-express.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-hong-kong-express"},
  },
  "iberia": {
    fleet: {"text":"129","at":null,"cond":"2025年度報告書のIberia Group連結範囲（Iberia、Iberia Express、LEVELを含む）のcombined fleet。Iberiaメインライン単独ではない。総fleetで整備・保管の区別は未記載。日付のない会社概要には本文162機と図167機の不整合があり、その値は採用せず年度報告を優先。","quote":"The combined fleet comprises 129 aircraft","url":"https://grupo.iberia.com/contents/archives/475/109/pdfcontent/475_109_1791277386.pdf","publisher":"Iberia","id":"iberia.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-iberia"},
  },
  "ibex": {
    pilots: {"text":"73","at":"2026-03-31","cond":"うち機長36名。副操縦士の人数は別記なしのため計算しない。訓練生・出向者の扱いは記載なし。","quote":"運航乗務員 73 名 （うち機長 36 名）","url":"https://www.ibexair.co.jp/static/img/safe/safety2025.pdf","publisher":"IBEXエアラインズ","id":"ibex.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-ibex"},
  },
  "icelandair": {
    pilots: {"text":"over 600","at":null,"cond":"over 600（600名超）。2018年8月の講演に言及する2019年の公式記事であり非常に古い。2025報告では総パイロット人数を確認できないため過去値としてのみ記録。現在の人数による重み付けには利用注意。","quote":"Linda leads a team of over 600 pilots, of which 12% are female.","url":"https://www.icelandair.com/en-gb/blog/travel-via-equality/","publisher":"Icelandair","id":"icelandair.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-icelandair"},
  },
  "indigo": {
    pilots: {"text":"5,786","at":"2026-03-31","cond":"IndiGoの在籍パイロット総数。子会社Agileの社員数は別記。機長・副操縦士の内訳、訓練生・出向者の扱いは未記載。","quote":"As of 31st March 2026, IndiGo’s workforce comprised 41,907 employees, including 5,786 pilots and 11,203 cabin crew.","url":"https://www.bseindia.com/xml-data/corpfiling/AttachHis/b45f7180-78f4-4e39-9335-03cb2daa1a11.pdf","publisher":"InterGlobe Aviation Limited","id":"indigo.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-indigo"},
  },
  "ita-airways": {
    fleet: {"text":"106","at":"2025-12-31","cond":"2025年末の総機材106機（広胴24機・狭胴82機）。納入10機を含む公表済み年末総数。将来発注数を使わない。総fleetのため整備保管の切分けは資料にない。","quote":"a 106 aerei complessivi a fine anno","url":"https://www.ita-airways.com/content/dam/ita/documents/pdf/world-of-ita-airways/discover-ita-airways/corporate/press-release/2026/ITA_Airways_il_CdA_approva_il_Progetto_di_Bilancio_2025_IT.pdf","publisher":"ITA Airways","id":"ita-airways.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-ita-airways"},
  },
  "j-air": {
    pilots: {"text":"331","at":"2026-03-31","cond":"当該会社の運航乗務員表の人数。訓練生・出向者の扱い、職位別内訳は記載なし。","quote":"運航乗務員 331名","url":"https://www.jal.com/sites/ja/safety/report/pdf_sites/index_020_ja.pdf","publisher":"日本航空株式会社ほかJALグループ航空会社8社","id":"j-air.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-j-air"},
  },
  "jac": {
    pilots: {"text":"118","at":"2026-03-31","cond":"当該会社の運航乗務員表の人数。訓練生・出向者の扱い、職位別内訳は記載なし。","quote":"運航乗務員 118名","url":"https://www.jal.com/sites/ja/safety/report/pdf_sites/index_020_ja.pdf","publisher":"日本航空株式会社ほかJALグループ航空会社8社","id":"jac.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-jac"},
  },
  "jal": {
    pilots: {"text":"2,510","at":"2026-03-31","cond":"休職者を除く。機長・副操縦士の内訳、訓練生・出向者の扱いは記載なし。","quote":"運航乗務員 2,510名","url":"https://www.jal.com/sites/ja/safety/report/pdf_sites/index_020_ja.pdf","publisher":"日本航空株式会社ほかJALグループ航空会社8社","id":"jal.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-jal"},
  },
  "jazz": {
    pilots: {"text":"1,154","at":null,"cond":"労働組合が公表するprofessional pilotsの人数。集計時点・訓練生や出向者の扱い・機長副操縦士内訳は記載なし。時点不明につき日付がある頭数との同列比較には注意。","quote":"Jazz Aviation employs a team of 1,154 professional pilots.","url":"https://www.alpa.org/supporting-pilots/pilot-groups/jazz-aviation","publisher":"Air Line Pilots Association, International","id":"jazz.scale.pilots.20261104","pack":"pvr-20261104-r8-jazz"},
  },
  "jetblue": {
    pilots: {"text":"4,687","at":null,"cond":"労働組合が公表するprofessional pilotsの人数。集計時点・訓練生や出向者の扱い・機長副操縦士内訳は記載なし。時点不明につき日付がある頭数との同列比較には注意。","quote":"JetBlue Airways employs a team of 4,687 professional pilots.","url":"https://www.alpa.org/supporting-pilots/pilot-groups/jetblue-airways","publisher":"Air Line Pilots Association, International","id":"jetblue.scale.pilots.20261104","pack":"pvr-20261104-r8-jetblue"},
  },
  "jetstar": {
    pilots: {"text":"1,117","at":"2025-02","cond":"AFAPが会社から受けた説明の total pilot establishment。2025年2月の公表資料。Jetstar Airwaysの乗員。機長・副操縦士の内訳、訓練生・出向者の扱いは未記載。","quote":"10% of the total pilot establishment (1,117 pilots).","url":"https://d15k2d11r6t6rl.cloudfront.net/pub/dw7a/z1swde28/9o7/40x/y8a/2025020%20%20-%20AFAP%20Jetstar%20Update%20-Feb%20PCC%20and%20AFAP%20%20JQ%20Meeting.pdf","publisher":"Australian Federation of Air Pilots","id":"jetstar.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-jetstar"},
  },
  "jetstar-japan": {
    pilots: {"text":"203","at":"2025-06-30","cond":"ジェットスター・ジャパン単体の人数。豪州Jetstar Airwaysの数ではない。機長・副操縦士の内訳、訓練生・出向者の扱いは記載なし。","quote":"運航乗務員 203 名","url":"https://files.jetstar.com/api/public/content/67b455e113334f05884c8a22d9e180d8","publisher":"ジェットスター・ジャパン株式会社","id":"jetstar-japan.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-jetstar-japan"},
  },
  "jta": {
    pilots: {"text":"170","at":"2026-03-31","cond":"当該会社の運航乗務員表の人数。訓練生・出向者の扱い、職位別内訳は記載なし。","quote":"運航乗務員 170名","url":"https://www.jal.com/sites/ja/safety/report/pdf_sites/index_020_ja.pdf","publisher":"日本航空株式会社ほかJALグループ航空会社8社","id":"jta.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-jta"},
  },
  "juneyao-airlines": {
    pilots: {"text":"1,997","at":"2025-12-31","cond":"親会社と主要子会社を含む公表区分。単体ではない。機長・副操縦士の内訳、訓練生・出向者の扱いは未記載。","quote":"飞行员 1,997","url":"https://static.cninfo.com.cn/finalpage/2026-04-23/1225151299.PDF","publisher":"上海吉祥航空股份有限公司","id":"juneyao-airlines.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-juneyao-airlines"},
  },
  "kalitta-air": {
    pilots: {"text":"950","at":null,"cond":"労働組合が公表するprofessional pilotsの人数。集計時点・訓練生や出向者の扱い・機長副操縦士内訳は記載なし。時点不明につき日付がある頭数との同列比較には注意。","quote":"Kalitta Air employs a team of 950 professional pilots.","url":"https://www.alpa.org/supporting-pilots/pilot-groups/kalitta-air","publisher":"Air Line Pilots Association, International","id":"kalitta-air.scale.pilots.20261104","pack":"pvr-20261104-r8-kalitta-air"},
  },
  "kenya-airways": {
    fleet: {"text":"37","at":"2025-12-31","cond":"グループ全体の運航中機材37機（JambojetのDash8-400を含む）。メインライン単独ではない。地上保管7機とサブリース1機を含む全保有等合計45機ではなく、Aircraft in Service37機を採用。","quote":"Aircraft in Service at Year End Total 37 43 40","url":"https://corporate.kenya-airways.com/contentassets/0160e07788564ab39cbed32da21839b2/annual-report-2025.pdf","publisher":"Kenya Airways PLC","id":"kenya-airways.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-kenya-airways"},
  },
  "klm": {
    pilots: {"text":"over 3,000","at":"2025-02-28","cond":"公式発表はover 3,000（3,000名超）。3,000ちょうどではない。将来のaround 4,000は予測で採用しない。訓練生・出向者・KLM Cityhopper包含は明記なし。","quote":"from over 3,000 pilots now to around 4,000 in the coming years.","url":"https://news.klm.com/klm-breaks-ground-on-new-the-link-training-centre/","publisher":"KLM","id":"klm.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-klm"},
  },
  "korean-air": {
    pilots: {"text":"2,969","at":"2025","cond":"大韓航空公式会社紹介の運航乗務員区分。資料は2025年基準とだけ記載し、厳密な月日は未確認。客室乗務員は別区分。機長・副操縦士の内訳、訓練生・出向者の扱いは未記載。","quote":"운항승무원 : 2,969 (15%)","url":"https://www.koreanair.com/contents/footer/about-us/who-we-are/overview/introduce-corporation?hl=th","publisher":"Korean Air","id":"korean-air.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-korean-air"},
  },
  "kuwait-airways": {
    fleet: {"text":"31","at":null,"cond":"2022年を対象とする会社報告書のoperational fleet31機。古い参考値であり2026年現在の機数とは扱わない。厳密な機数集計日は明記なし。公式Sustainabilityページのボタンから報告書ページへ進み、iframeがheyzine.com/flip-book/c61af12e69.htmlを配信することをブラウザで確認した。","quote":"Kuwait Airways' operational fleet consists of 31 aircraft","url":"https://cdnc.heyzine.com/flip-book/pdf/c61af12e692f4e6ea41bd6a38abe89c176d7c5f3.pdf","publisher":"Kuwait Airways","id":"kuwait-airways.scale.fleet-total.20261104","pack":"pvr-20261104-r8-kuwait-airways"},
  },
  "latam": {
    pilots: {"text":"4,891","at":"2025-12-31","cond":"LATAM Airlines Group連結のCockpit crew。グループ会社の乗員を含む。資料は機長副操縦士、訓練生の内訳を示さない。","quote":"Cockpit crew 4,891 4,500 4,076","url":"https://www.sec.gov/Archives/edgar/data/1047716/000104771626000046/ltm-20251231.htm","publisher":"LATAM Airlines Group S.A.","id":"latam.scale.pilots.20261104","pack":"pvr-20261104-r8-latam"},
  },
  "lot": {
    pilots: {"text":"940","at":"2025-06-25","cond":"国会インフラ委員会におけるLOT運航担当取締役の現在人数についての発言。パイロット940名。訓練生・委託契約者の範囲は記載なし。","quote":"W tej chwili mamy 940 pilotów i ponad 1800 stewardes.","url":"https://api.sejm.gov.pl/sejm/term10/committees/INF/sittings/131/html","publisher":"Sejm Rzeczypospolitej Polskiej","id":"lot.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-lot"},
  },
  "lufthansa": {
    fleet: {"text":"387","at":"2025-12-31","cond":"T011のLH列総数。Lufthansa Airlinesに地域航空会社、Germanwings、Discover Airlinesを含む公表範囲。Lufthansaメインライン単独ではない。グループ全体737機とは区別。","quote":"Total aircraft 387 116 67 47 98 22 737","url":"https://report.lufthansagroup.com/2025/annual-report/en/combined-management-report/principles-of-the-group/fleet-and-route-network/fleet/","publisher":"Deutsche Lufthansa AG","id":"lufthansa.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-lufthansa"},
  },
  "malaysia-airlines": {
    fleet: {"text":"94","at":"2025","cond":"MAG報告書が公表するFleetSize2025年94機。章はMAGの運航実績を説明しMHの指標も並記するため、MalaysiaAirlines単体と他のグループ航空会社の範囲を本文から厳密に切り分けられない。単体の運航機材数として使用する前に母集団確認が必要。","quote":"Fleet Size 77 81 94","url":"https://malaysiaaviationgroup.com.my/content/dam/mag/en/sustainability/sustainability-publications/sustainability-reports/MAG-SUSTAINABILITY-REPORT-2025.pdf","publisher":"Malaysia Aviation Group","id":"malaysia-airlines.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-malaysia-airlines"},
  },
  "norwegian": {
    pilots: {"text":"nearly 1,300","at":"2024-12-16","cond":"公表はnearly 1,300（約1,300名、未満を示唆）。Norwegian単体、Widerøeとは区別。うちノルウェー拠点690名。年次報告2025では職種別現員総数を確認できず。","quote":"Norwegian alone employs nearly 1,300 pilots, 690 of whom are based in Norway.","url":"https://media.uk.norwegian.com/pressreleases/norwegian-enters-collaboration-with-pilot-schools-in-norway-denmark-sweden-and-spain-3360653","publisher":"Norwegian","id":"norwegian.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-norwegian"},
  },
  "oman-air": {
    fleet: {"text":"33","at":null,"cond":"2026年2月1日の受領発表で現在の総機数として33機を明記。集計日の明記なし。発注機を含めない。","quote":"This milestone brings the airline’s total fleet to 33 aircraft","url":"https://services.omanair.com/ch/en/PressRelease/oman-air-continues-fleet-modernization-with-latest-boeing-737-max-8-delivery","publisher":"Oman Air","id":"oman-air.scale.fleet-total.20261104","pack":"pvr-20261104-r8-oman-air"},
  },
  "orc": {
    pilots: {"text":"５８","at":"2025-03-31","cond":"うち機長30名・副操縦士28名。訓練生9名を除く58名で、訓練生込みは別記67名。防災ヘリ運航部は別組織であり同部門の操縦士を含む会社全体人数とは断定しない。出向者の扱いは未記載。","quote":"運航乗務員 ５８名 （６７名） 機長 ３０名、副操縦士 ２８名 （訓練生 9 名） 運航部","url":"https://www.orc-air.co.jp/wp-content/themes/orc-2025/assets/pdf/company/anzen2024.pdf","publisher":"オリエンタルエアブリッジ株式会社","id":"orc.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-orc"},
  },
  "peach": {
    pilots: {"text":"454","at":"2026-03-31","cond":"有資格者人員の運航乗務員数。運航本部全職員1,543名とは別の数。機長・副操縦士の内訳、訓練生・出向者の扱いは記載なし。","quote":"運航乗務員 454 名","url":"https://www.flypeach.com/application/files/3317/8486/4428/APJ_safety-report_2025.pdf","publisher":"Peach Aviation","id":"peach.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-peach"},
  },
  "philippine-airlines": {
    pilots: {"text":"829","at":"2025-12-31","cond":"PALの在籍パイロット829名。APC（PAL Express）従業員表の別掲Pilots290名を含めない。機長・副操縦士の内訳、訓練生・出向者の扱いは未記載。","quote":"Pilots 829","url":"https://phi.com.ph/wp-content/uploads/bsk-pdf-manager/2026/04/PAL-Holdings-Inc_17A_Dec-2025.pdf","publisher":"PAL Holdings, Inc.","id":"philippine-airlines.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-philippine-airlines"},
  },
  "porter": {
    pilots: {"text":"910","at":null,"cond":"労働組合が公表するprofessional pilotsの人数。集計時点・訓練生や出向者の扱い・機長副操縦士内訳は記載なし。時点不明につき日付がある頭数との同列比較には注意。","quote":"Porter Airlines employs a team of 910 professional pilots.","url":"https://www.alpa.org/supporting-pilots/pilot-groups/porter-airlines","publisher":"Air Line Pilots Association, International","id":"porter.scale.pilots.20261104","pack":"pvr-20261104-r8-porter"},
  },
  "qantas": {
    fleet: {"text":"138","at":"2026-06-30","cond":"TotalQantas行。QantasLink127機、Jetstar97機、QantasFreight10機と別に公表。グループ総数372機をQantas単体にしない。","quote":"Total Qantas 128 6 4 2 – – (2) 138","url":"https://investor.qantas.com/FormBuilder/_Resource/_module/doLLG5ufYkCyEPjF1tpgyw/file/annual-reports/2026-Annual-Report.pdf","publisher":"Qantas","id":"qantas.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-qantas"},
  },
  "qatar-airways": {
    fleet: {"text":"300+","at":null,"cond":"2025年4月〜2026年3月の年次報告ページに300+と記載。Qatar Airways Groupの範囲であり本体・Qatar Executive等の切分けはページにない。300機の確定値にしない。","quote":"300+ Number of Aircraft","url":"https://www.qatarairways.com/press-releases/en-WW/pages/2026-annual-report/","publisher":"Qatar Airways Group","id":"qatar-airways.scale.fleet-total.20261104","pack":"pvr-20261104-r8-qatar-airways"},
  },
  "rac": {
    pilots: {"text":"51","at":"2026-03-31","cond":"当該会社の運航乗務員表の人数。訓練生・出向者の扱い、職位別内訳は記載なし。","quote":"運航乗務員 51名","url":"https://www.jal.com/sites/ja/safety/report/pdf_sites/index_020_ja.pdf","publisher":"日本航空株式会社ほかJALグループ航空会社8社","id":"rac.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-rac"},
  },
  "royal-brunei": {
    fleet: {"text":"12","at":null,"cond":"公式調達資料に掲載された運航機材総数。文書名は2025-12-03を示すが、機材数自体の厳密な基準日は未記載。","quote":"RB operates a fleet of 12 aircrafts serving 23 destinations","url":"https://www.flyroyalbrunei.com/wp-content/uploads/2025/12/DigitalAgency_03DEC2025.pdf","publisher":"Royal Brunei Airlines","id":"royal-brunei.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-royal-brunei"},
  },
  "ryanair": {
    pilots: {"text":"7,049","at":"2024-03-31","cond":"全グループ航空会社を含む。契約派遣会社からのパイロットを含む。機長・副操縦士の内訳は明記なし。2025・2026年次報告では職種別人数表がなく、確認できた最新の公表実数は2024年3月末（2024年度末）。","quote":"Pilots 7,049 6,582 5,860","url":"https://investor.ryanair.com/wp-content/uploads/2024/06/Ryanair-2024-Annual-Report.pdf","publisher":"Ryanair Holdings plc","id":"ryanair.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-ryanair"},
  },
  "sas": {
    fleet: {"text":"140","at":"2025-10-31","cond":"SAS Group Aircraft Fleetの運航中総数。SAS Scandinavia69機、Connect32機、Link15機、wet lease24機を含む。phase-out5機を除く。公表総数140機をそのまま採用。","quote":"Total aircraft in operation 21 95 24 140","url":"https://www.sasgroup.net/files/documents/financial-reports/2025/sas-ab-annual-report-fy25.pdf","publisher":"SAS AB","id":"sas.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-sas"},
  },
  "saudia": {
    fleet: {"text":"149","at":null,"cond":"SaudiaとAir Indiaの公式共同発表をAir India公式サイトで確認。Saudiaの現在の運航機材数として149機を明記。Saudia Group他社を合算していない。","quote":"fleet with 149 aircraft.","url":"https://www.airindia.com/content/dam/air-india/newsroom/press-releases/pdf/Press-Release-Saudia-and-Air-India-Sign-Codeshare-Agreement-14-Jan-2026.pdf","publisher":"Saudia / Air India","id":"saudia.scale.fleet-total.20261104","pack":"pvr-20261104-r8-saudia"},
  },
  "scoot": {
    fleet: {"text":"63","at":"2026-03-31","cond":"SIAグループ旅客機のうちScoot運航分。SingaporeAirlines148機および貨物機7機を含めない。 報告書脚注R1のoperating fleetは一時的な駐機中機材を含み、納入済みでも未就航の機材および返却・売却準備で運航から外れた機材を除く。","quote":"148 and 63 of the passenger aircraft were operated by Singapore Airlines and Scoot respectively.","url":"https://www.singaporeair.com/content/dam/sia/web-assets/pdfs/about-us/information-for-investors/annual-report/annualreport2526.pdf","publisher":"Singapore Airlines Limited","id":"scoot.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-scoot"},
  },
  "shin-central": {
    pilots: {"text":"21","at":"2026-03-31","cond":"2025年度安全報告書の運航乗組員総数。運航部33名とは別。機長・副操縦士の内訳、訓練生・出向者を含むかは未記載。","quote":"運航乗組員 整備従事者 運航管理者 21 名 25 名 5 名","url":"https://central-air.co.jp/pdf/safety_info_2025.pdf","publisher":"新中央航空株式会社","id":"shin-central.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-shin-central"},
  },
  "singapore-airlines": {
    pilots: {"text":"3,009","at":"2026-03-31","cond":"フルサービス航空会社（FSC）の Technical crew。Scoot は別の子会社の節。機長・副操縦士・セカンドオフィサーの内訳および訓練生・出向者の扱いは未記載。","quote":"Technical crew 3,009 2,850 + 5.6","url":"https://www.singaporeair.com/content/dam/sia/web-assets/pdfs/about-us/information-for-investors/annual-report/annualreport2526.pdf","publisher":"Singapore Airlines","id":"singapore-airlines.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-singapore-airlines"},
  },
  "skymark": {
    pilots: {"text":"287","at":"2026-03-31","cond":"職種別の運航乗務員人数。機長・副操縦士の内訳、訓練生・出向者の扱いは記載なし。","quote":"運航乗務員 287 名","url":"https://www.skymark.co.jp/ja/company/safetyreport2025.pdf","publisher":"スカイマーク","id":"skymark.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-skymark"},
  },
  "solairus": {
    fleet: {"text":"approximately 360","at":null,"cond":"2026年8月7日の管理機数は約360。買収後500機超は将来予定として別記されるため採用しない。管理機材であり全機が自社定期運航ではない。","quote":"Solairus currently manages approximately 360 aircraft","url":"https://www.solairus.aero/solairus-to-acquire-clay-lacys-aircraft-management-charter-divisions-expanding-its-scale-in-private-aviation-asset-management-services/","publisher":"Solairus Aviation","id":"solairus.scale.fleet-total.20261104","pack":"pvr-20261104-r8-solairus"},
  },
  "solaseed": {
    pilots: {"text":"151","at":"2026-03-31","cond":"ソラシドエアの直接運航に携わる職種別人数。機長・副操縦士の内訳、訓練生・出向者の扱いは記載なし。","quote":"運航乗務員 151 名","url":"https://www.solaseedair.jp/corporate/safety/safty_report.pdf","publisher":"ソラシドエア","id":"solaseed.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-solaseed"},
  },
  "south-african-airways": {
    pilots: {"text":"195","at":"2025-03-31","cond":"FY2025のCEO報告。年度中に22名のパイロットを迎え、合計195名と記載。機長・副操縦士の内訳、訓練生・出向者の包含は明記なし。","quote":"bringing our total number of pilots to 195.","url":"https://www.parliament.gov.za/storage/app/media/Docs/ann_rep/01dx3n75csegmeetwbm5ajbo6fy6unqove.pdf","publisher":"South African Airways / Parliament of South Africa","id":"south-african-airways.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-south-african-airways"},
  },
  "southwest": {
    pilots: {"text":"more than 11,000","at":null,"cond":"11,000名超。厳密な頭数ではない。10-Kの10,321は2025年末の概数FTEなので、この人数と同一指標として扱わない。","quote":"more than 11,000 pilots of Southwest Airlines","url":"https://www.swapa.org/news/2026/swapa-applauds-congress-for-securing-national-airspace-safety-and-strengthening-pilot-profession/","publisher":"Southwest Airlines Pilots Association","id":"southwest.scale.pilots.20261104","pack":"pvr-20261104-r8-southwest"},
  },
  "spring-japan": {
    pilots: {"text":"134","at":"2026-03-31","cond":"人数表の備考に「訓練生5名含む」。同ページ組織図注は「運航乗務員134名及び訓練生5名を含む」とも表記し、訓練生の包含関係に曖昧さが残る。134から引き算や足し算をしない。職位別内訳・出向者の扱いは記載なし。","quote":"運航乗務員 134名","url":"https://www.jal.com/sites/ja/safety/report/pdf_sites/index_020_ja.pdf","publisher":"日本航空株式会社ほかJALグループ航空会社8社","id":"spring-japan.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-spring-japan"},
  },
  "starflyer": {
    pilots: {"text":"125","at":"2026-03-31","cond":"運航乗務員の人数。運航本部の全職員172名とは別の数。機長・副操縦士の内訳、訓練生・出向者の扱いは記載なし。","quote":"運航乗務員 125 名","url":"https://www.starflyer.jp/starflyer/corporate/pdf/fsr2025.pdf","publisher":"スターフライヤー","id":"starflyer.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-starflyer"},
  },
  "starlux": {
    fleet: {"text":"29","at":"2025","cond":"2025年報告の機隊総数。将来予定50機や2026年末計画43機を含めない。","quote":"2025 年機隊共計 29 架採用節油設備及促進環境效益之永續航機。","url":"https://sustainability.jx-starlux.com/public_html/upload/2025%20STARLUX%20Airlines%20Sustainability%20Report.pdf","publisher":"STARLUX Airlines","id":"starlux.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-starlux"},
  },
  "swiss": {
    pilots: {"text":"1,442","at":"2025-12-31","cond":"SWISS従業員のPilots。機長・副操縦士の内訳、訓練生・出向者の包含は明記なし。","quote":"Employees (as of 31 December 2025) Pilots 1,442 (vs. 1,361 as of 31.12.2024)","url":"https://www.swiss.com/corporate/en/company/about-us/company-profile","publisher":"Swiss International Air Lines","id":"swiss.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-swiss"},
  },
  "tap": {
    pilots: {"text":"1.503","at":"2025-12-31","cond":"TAP連結グループのPessoal Navegante Técnico（運航乗務員）。Portugáliaの乗員を含む。TAP単独ではない。期末headcount表を使用し、別表の年間平均人数とは区別。訓練生を含むかは未記載。","quote":"Categoria Profissional Situação 31/12 2025 Pessoal Navegante Técnico 1.503","url":"https://publish-p133109-e1368204.adobeaemcloud.com/content/dam/tap-institucional/media/pdfs/investidores/info-financeira/2026/PT/PT-Relatorio-integrado-TAP-2025-V5.pdf","publisher":"Transportes Aéreos Portugueses S.A.","id":"tap.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-tap"},
  },
  "thai-airways": {
    pilots: {"text":"1,223","at":"2025","cond":"公表区分Pilotsの2025年欄。2023年1,037名、2024年1,161名とは別の列。機長・副操縦士の内訳、訓練生・出向者の扱いは未記載。","quote":"- Pilots | Number of Employees (Persons) 1,037 | 1,161 | 1,223","url":"https://ir.thaiairways.com/wp-content/uploads/2026/03/TG-One-Report-2025-EN.pdf","publisher":"Thai Airways International","id":"thai-airways.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-thai-airways"},
  },
  "toho-air": {
    pilots: {"text":"50","at":"2026-03-31","cond":"運航乗務員総数50名。うち路線機長5名。これは全機長人数ではないので、残り45名を副操縦士と読み替えない。ヘリ運航・航空機使用事業等を含む会社全体。訓練生・出向者の扱いは未記載。","quote":"運航乗務員 ５０名 路線機長 内５名","url":"https://www.tohoair.co.jp/pdf/2025anzen.pdf","publisher":"東邦航空株式会社","id":"toho-air.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-toho-air"},
  },
  "toki-air": {
    pilots: {"text":"16","at":"2026-03-31","cond":"職種別の運航乗務員16名。フライトオペレーション室67名、全社員224名とは別の集計。機長・副操縦士の内訳、訓練生・出向者の扱いは未記載。","quote":"運航乗務員 ※1 16 名","url":"https://tokiair.com/wp/wp-content/uploads/2026/09/SafetyReport2025.pdf","publisher":"トキエア株式会社","id":"toki-air.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-toki-air"},
  },
  "turkish-airlines": {
    pilots: {"text":"8,145","at":"2026-06-30","cond":"資料区分はCockpit Personnel。機長・副操縦士内訳、訓練生・pilot candidatesの包含はこの表に明記なし。旧記録の7.546は2024末、8.085は2025末の別期間であり、2つを合算しない。","quote":"31.12.2025 30.06.2025 30.06.2026 Change(%) Cockpit Personnel 8,085 7,764 8,145 5%","url":"https://investor.turkishairlines.com/documents/board-activity-report-2q2026.pdf","publisher":"Türk Hava Yolları A.O.","id":"turkish-airlines.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-turkish-airlines"},
  },
  "united": {
    pilots: {"text":"17,126","at":"2025-12-31","cond":"United Airlines, Inc.の労組代表対象のパイロット。United Ground Expressは別行。機長・副操縦士、訓練生・出向者の内訳は記載なし。","quote":"Pilots 17,126 Air Line Pilots Association (\"ALPA\") October 2027","url":"https://www.sec.gov/Archives/edgar/data/319687/000010051726000023/ual-20251231.htm","publisher":"United Airlines Holdings, Inc.","id":"united.scale.pilots.20261104","pack":"pvr-20261104-r8-united"},
  },
  "ups-airlines": {
    pilots: {"text":"approximately 3,400","at":"2025-12-31","cond":"約3,400名の労働協約対象パイロット。人数の概数を確定頭数にしない。訓練生・出向者の取扱い、機長副操縦士の内訳記載なし。","quote":"approximately 3,400 of our pilots are represented by the Independent Pilots Association","url":"https://investors.ups.com/sec-filings/all-sec-filings/content/0001628280-26-008432/ups-20251231.htm","publisher":"United Parcel Service, Inc.","id":"ups-airlines.scale.pilots.20261104","pack":"pvr-20261104-r8-ups-airlines"},
  },
  "vietjet": {
    fleet: {"text":"107","at":"2025","cond":"会社の2025年実績として明記された機材総数。グループブランド全体や2026年計画115機と区別。","quote":"số tàu bay của Công ty lên 107 tàu.","url":"https://ir.vietjetair.com/File_Upload/thong-tin-tai-chinh/bao-cao-thuong-nien-parent/bao-cao-thuong-nien/20260417_VJC_AR2025_VN_Final%201.pdf","publisher":"Vietjet Aviation Joint Stock Company","id":"vietjet.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-vietjet"},
  },
  "vietnam-airlines": {
    pilots: {"text":"1,055","at":"2025-12-31","cond":"運航中のパイロット数。VASCOの乗員を含む。うち機長532名・副操縦士523名。訓練生・出向者の扱いは未記載。","quote":"(including pilots of VASCO): 1,055 pilots, comprising: Captains: 532, First Officers: 523;","url":"https://www.vietnamairlines.com/content/dam/vna/vna-footer/investor-relations/bao-cao-thuong-nien/2026/BCTN2025.TIENGANH.pdf","publisher":"Vietnam Airlines","id":"vietnam-airlines.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-vietnam-airlines"},
  },
  "virgin-atlantic": {
    fleet: {"text":"43","at":"2025-12-31","cond":"年次報告書のVirgin Atlantic at a glance掲載の2025機材総数。機種別合計の計算はしていない。","quote":"43 total aircraft","url":"https://corporate.virginatlantic.com/content/dam/corporate/annual-reports/Virgin-Atlantic-Annual-Report-2025.pdf","publisher":"Virgin Atlantic Limited","id":"virgin-atlantic.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-virgin-atlantic"},
  },
  "vueling": {
    pilots: {"text":"1.290","at":"2023-01-01","cond":"2023年度の職種別人数表。男性1,235名・女性55名。人数表に厳密な集計日の明記なし。後続2025 ASG報告書の存在を確認したが現物リンクは404となり本文未読のため、本値を最新値とは扱わない。","quote":"CATEGORÍA LABORAL TOTAL HOMBRES MUJERES PORCENTAJE DE MUJERES Pilotos 1.290 1.235 55 4,3 %","url":"https://static.vueling.com/corporative7/media/2040/vu23-comprimido.pdf","publisher":"vueling","id":"vueling.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-vueling"},
  },
  "westjet": {
    pilots: {"text":"2,306","at":null,"cond":"WestJet Airlinesのprofessional pilots。WestJet Encoreは組合別ページ。集計日・内訳・訓練生の扱い記載なし。","quote":"WestJet Airlines employs a team of 2,306 professional pilots.","url":"https://www.alpa.org/supporting-pilots/pilot-groups/westjet-airlines","publisher":"Air Line Pilots Association, International","id":"westjet.scale.pilots.20261104","pack":"pvr-20261104-r8-westjet"},
  },
  "wizz-air": {
    fleet: {"text":"21","at":"2025-12-23","cond":"会社発行の目論見書に明記されたWizz Air UK Limited単独の運航機材21機。グループ250機や2026年3月末262機をUK機材数に転用しない。","quote":"as at the date of this Base Prospectus operates 21 aircraft;","url":"https://ise-prodnr-eu-west-1-data-integration.s3-eu-west-1.amazonaws.com/202512/c4a2f6d6-eb14-4e5e-8fc0-621e7706aafb.pdf","publisher":"Wizz Air Finance Company B.V. / Wizz Air Holdings Plc","id":"wizz-air.scale.fleet-total.r8-20261104","pack":"pvr-20261104-r8-wizz-air"},
  },
  "zipair": {
    pilots: {"text":"179","at":"2026-03-31","cond":"当該会社の運航乗務員表の人数。訓練生・出向者の扱い、職位別内訳は記載なし。","quote":"運航乗務員 179名","url":"https://www.jal.com/sites/ja/safety/report/pdf_sites/index_020_ja.pdf","publisher":"日本航空株式会社ほかJALグループ航空会社8社","id":"zipair.scale.pilots.r8-20261104","pack":"pvr-20261104-r8-zipair"},
  },
});
