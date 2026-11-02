/* us-town-notes.mjs ── 米国の住宅地（us-housing.mjs の街）の短い紹介（日英）。2026-11-02。
 *
 * ★オーナー「ちゃんと街の画像と、どんなところなのか魅力を簡単に説明も入れてね」。
 *   字は、その街の Wikipedia（英語版）や街の公式サイトで確かめられる事実だけで書いた（場所・街の性格）。
 *   ⚠️ 「富裕層に人気」「高級」「パイロットに人気」と書かない（確かめられない ── メモリの決まり）。家賃・家の値段もここに書かない。
 *   画面は、街を押すと開く詳細の、街の名前のすぐ下（pv-airline-view.mjs の usLivings → pick）。
 */
export const ABOUT = Object.freeze({
 "us-peachtree-city": {
  "ja": "アトランタ空港の南にある1959年創設の計画都市。160km超のゴルフカート用の道が街をめぐり、3つの湖がある。",
  "en": "A planned city south of Atlanta's airport, chartered in 1959, with over 100 miles of golf-cart paths and three lakes."
 },
 "us-newnan": {
  "ja": "アトランタの南西約64kmにあるコウェタ郡の郡庁所在地。南北戦争の被害をほぼ免れ、戦前の邸宅が多く残る。",
  "en": "The Coweta County seat, about 40 miles southwest of Atlanta, largely spared in the Civil War and rich in antebellum architecture."
 },
 "us-johns-creek": {
  "ja": "アトランタ中心部の北東約43kmにある郊外の市。2006年に市となり、南の境をチャタフーチー川が流れる。",
  "en": "A northeastern Atlanta suburb, 27 miles from downtown, that became a city in 2006 and is bounded to the south by the Chattahoochee River."
 },
 "us-braintree": {
  "ja": "ボストンの南、サウスショアにある1640年創設の町。地下鉄レッドラインでボストン中心部へ出られる。",
  "en": "A South Shore town south of Boston, incorporated in 1640, with MBTA Red Line service into the city."
 },
 "us-wellesley": {
  "ja": "ボストンの西郊にある町。ウェルズリー大学とバブソン大学のキャンパスがある大学の町。",
  "en": "A town in Boston's western suburbs, home to the campuses of Wellesley College and Babson College."
 },
 "us-plymouth-area": {
  "ja": "デトロイト空港の北西にある小さな市。中心街にケロッグ公園があり、毎年1月には氷の彫刻祭が開かれる。",
  "en": "A small city northwest of Detroit Metro Airport, with Kellogg Park in its downtown and an ice-carving festival each January."
 },
 "us-northville-area": {
  "ja": "デトロイト空港の北西にある小さな市。中心街のまわりにビクトリア朝の家並みが残り、歴史村ミル・レース・ビレッジがある。",
  "en": "A small city northwest of Detroit Metro Airport, with Victorian-era homes around its downtown and the Mill Race historical village."
 },
 "us-bloomfield-hills-area": {
  "ja": "デトロイト中心部の北西約32km、ウッドワード通り沿いの住宅の市。国定歴史建造物の学園クランブルックがある。",
  "en": "A residential city on the Woodward Corridor, about 20 miles northwest of downtown Detroit, home to the Cranbrook Educational Community."
 },
 "us-el-segundo": {
  "ja": "LAX空港のすぐ南、サンタモニカ湾に面した市。航空宇宙産業の拠点として知られ、宇宙関連の新興企業も集まる。",
  "en": "A city just south of LAX on Santa Monica Bay, long an aerospace hub and now home to many hardware and space startups."
 },
 "us-manhattan-beach": {
  "ja": "LAX空港の南、エルセグンドの南隣の海辺の市。約3.4kmの砂浜と桟橋があり、ビーチバレーやサーフィンが盛ん。",
  "en": "A beach city south of LAX and El Segundo, with about 2 miles of wide sandy beach, a pier, and popular beach volleyball and surfing."
 },
 "us-eagan": {
  "ja": "MSP空港の南東、ミネソタ川の南岸にある市。かつてノースウエスト航空の本社があり、レバノンヒルズ地域公園がある。",
  "en": "A city across the Minnesota River southeast of MSP Airport, once home to Northwest Airlines' headquarters, with Lebanon Hills Regional Park."
 },
 "us-edina": {
  "ja": "ミネアポリスに隣接する郊外の市。公立学校の評価が高いことで知られ、全米最古の屋内型モール、サウスデール・センターがある。",
  "en": "A first-ring Minneapolis suburb known for its public schools and parks, and home to Southdale Center, the oldest indoor mall in the US."
 },
 "us-garden-city": {
  "ja": "ロングアイランドのナッソー郡にある村。1869年から計画的に開発された街で、ゴシック様式の大聖堂がある。",
  "en": "A Nassau County village on Long Island, developed as a planned community from 1869, and home to the Gothic Cathedral of the Incarnation."
 },
 "us-manhasset": {
  "ja": "ロングアイランド北岸、マンハセット湾に面した地区。LIRRでペン駅まで約40分。",
  "en": "A hamlet on Long Island's North Shore by Manhasset Bay, about 40 minutes by LIRR to Penn Station."
 },
 "us-chatham": {
  "ja": "ニューアーク空港の西にあるモリス郡の小さな町。駅と商店街がまとまった歩きやすい町で、ニューヨークへの通勤圏。",
  "en": "A small, walkable Morris County borough west of Newark Airport, with a compact downtown and a rail station used by NYC commuters."
 },
 "us-bountiful": {
  "ja": "ソルトレイクシティの北、ワサッチ山脈のふもとに広がる住宅の街。1847年に開かれたユタで2番目の入植地。",
  "en": "A bedroom community north of Salt Lake City at the foot of the Wasatch Range, settled in 1847 as Utah's second settlement."
 },
 "us-park-city": {
  "ja": "ソルトレイクシティ中心部の南東約51kmの山あいの街。鉱山町の面影を残すメインストリートと、2つの大きなスキー場がある。",
  "en": "A mountain town 32 miles southeast of downtown Salt Lake City, with a historic mining-era Main Street and two major ski resorts."
 },
 "us-burien": {
  "ja": "シアトル・タコマ空港の西、ピュージェット湾に面した市。森と浜辺のあるシーハースト公園がある。",
  "en": "A city on Puget Sound just west of Sea-Tac Airport, home to Seahurst Park with its forest and beach."
 },
 "us-mercer-island": {
  "ja": "シアトルとベルビューの間、ワシントン湖に浮かぶ島の市。州間道90号線の橋とライトレールで両岸とつながる。",
  "en": "An island city in Lake Washington between Seattle and Bellevue, linked to both shores by the I-90 bridges and Link light rail."
 },
 "us-mukilteo": {
  "ja": "シアトルの北約40km、ピュージェット湾に面した市。ペインフィールドに近く、ウィドビー島へのフェリーが発着する。",
  "en": "A Puget Sound city about 25 miles north of Seattle, near Paine Field, with ferries to Whidbey Island and a 1906 lighthouse."
 },
 "us-park-ridge": {
  "ja": "オヘア空港のすぐ北東にある住宅の市。1928年築のアールデコ様式の映画館、ピックウィック劇場が街の目印。",
  "en": "A residential city just northeast of O'Hare whose best-known landmark is the Art Deco Pickwick Theatre, built in 1928."
 },
 "us-hinsdale": {
  "ja": "シカゴ中心部の西約24kmの村。国の歴史地区に指定された中心街に店と駅がまとまり、メトラで市内へ通える。",
  "en": "A village 15 miles west of the Chicago Loop whose historic downtown, with shops and a Metra station, is on the National Register."
 },
 "us-oak-lawn": {
  "ja": "シカゴの南西に接する村。ミッドウェー空港の南にあり、大規模な救命救急病院アドボケイト・クライスト医療センターがある。",
  "en": "A village bordering Chicago's southwest side, south of Midway Airport, and home to Advocate Christ Medical Center, a Level I trauma center."
 },
 "us-reunion-commerce-city-area": {
  "ja": "デンバー空港の西、コマースシティで2001年に開発が始まった計画住宅地。市内に広い野生生物保護区がある。",
  "en": "A master-planned community begun in 2001 in Commerce City, west of Denver's airport; the city is home to a large wildlife refuge."
 },
 "us-greenwood-village": {
  "ja": "デンバーの南にある市。オフィス街デンバー・テック・センターとともに発展し、チェリークリーク学区に属する。",
  "en": "A city south of Denver that grew with the Denver Technological Center office district and lies within the Cherry Creek School District."
 },
 "us-humble-area": {
  "ja": "ヒューストンのブッシュ国際空港（IAH）の東にある街。1904年の油田発見で栄え、エクソンの前身ハンブル石油の本拠地だった。",
  "en": "A city east of Houston’s IAH airport that boomed after oil was struck in 1904 and was home to Humble Oil, a forerunner of Exxon."
 },
 "us-the-woodlands": {
  "ja": "ヒューストンの北約45km、森の木々を残して開発された街。運河沿いの遊歩道やマーケット・ストリートの商業地区、自転車道がある。",
  "en": "A planned community 28 miles north of Houston that kept much of its forest, with a canal-side walk, Market Street shops and bike trails."
 },
 "us-west-university-place": {
  "ja": "ヒューストン市などに囲まれた小さな住宅の街。ライス大学とテキサス・メディカルセンターに近く、愛称は「ネイバーフッド・シティ」。",
  "en": "A small residential city largely surrounded by Houston, near Rice University and the Texas Medical Center, nicknamed “The Neighborhood City.”"
 },
 "us-herndon": {
  "ja": "ダレス国際空港の北東にある町。旧駅舎を博物館として残す歴史ある中心街をW&ODトレイルが通り、メトロ（シルバーライン）の駅もある。",
  "en": "A town northeast of Dulles Airport, with a historic downtown on the W&OD Trail and a Metro Silver Line station since 2022."
 },
 "us-vienna": {
  "ja": "ワシントンD.C.西郊の小さな町。中心部をW&ODトレイルが通り、メトロ（オレンジライン）のビエナ駅が最寄り。",
  "en": "A small town in Washington’s western suburbs, with the W&OD Trail running through downtown and Vienna station on Metro’s Orange Line."
 },
 "us-alexandria": {
  "ja": "ポトマック川西岸でワシントンD.C.に接する街。レーガン・ナショナル空港の南にあり、旧市街（オールドタウン）は歴史地区。",
  "en": "A historic city on the Potomac bordering Washington, D.C., just south of Reagan National Airport. Its Old Town is a historic district."
 },
 "us-san-mateo": {
  "ja": "サンフランシスコ空港（SFO）の南東、サンフランシスコの南約32kmにある街。中心街には800を超える店や飲食店が集まる。",
  "en": "About 20 miles (32 km) south of San Francisco and southeast of SFO, with a downtown of more than 800 shops and restaurants."
 },
 "us-burlingame": {
  "ja": "サンフランシスコ空港（SFO）のすぐ南、湾に面した街。1万8千本を超える公共の木から「木の街」を名乗る。",
  "en": "Just south of SFO on San Francisco Bay, Burlingame calls itself the City of Trees for its more than 18,000 public trees."
 },
 "us-alameda": {
  "ja": "オークランド空港に隣接する、アラメダ市のベイファーム島地区。ラグーンや公園があり、外周を緑地帯がめぐる住宅地。",
  "en": "Bay Farm Island, the part of Alameda next to Oakland Airport: homes around lagoons and parks, with a greenbelt running around the shore."
 },
 "us-lake-nona-area": {
  "ja": "オーランド国際空港の南東、オーランド市内に広がる大規模な計画都市。名前は湖に由来し、大学医学部などが集まるメディカルシティがある。",
  "en": "A large planned community within Orlando, southeast of MCO airport, home to a Medical City that includes UCF’s College of Medicine."
 },
 "us-winter-park": {
  "ja": "オーランドの北にある、運河でつながる湖に囲まれた街。レンガ敷きの道にオークの並木が続き、ロリンズ大学がある。",
  "en": "North of Orlando, set among a chain of lakes linked by canals, with brick streets under old oaks and Rollins College."
 },
 "us-lake-mary": {
  "ja": "オーランド中心部の北約31km、サンフォード空港の西にある郊外の街。通勤鉄道サンレールの駅とクロス・セミノール・トレイルがある。",
  "en": "A suburban city 19 miles (31 km) north of downtown Orlando and west of Sanford airport, with a SunRail station and the Cross Seminole Trail."
 },
 "us-grapevine": {
  "ja": "DFW空港の一部を市域に含む街。メインストリートの歴史ある中心街やワイナリー、隣接するグレープバイン湖がある。",
  "en": "A city that takes in part of DFW Airport, with a historic Main Street downtown, local wineries and Grapevine Lake next door."
 },
 "us-southlake": {
  "ja": "DFW空港の北西、グレープバイン湖の南にある住宅の街。名前は湖にちなみ、商業地区サウスレイク・タウンスクエアがある。",
  "en": "A suburb northwest of DFW Airport, named for Grapevine Lake to its north, with the Southlake Town Square shopping district."
 },
 "us-highland-park-area": {
  "ja": "ダラス中心部の北約6km、ラブフィールド空港の東にある住宅の町。北隣のユニバーシティパークと合わせて「パーク・シティーズ」を成す。",
  "en": "A residential town 4 miles (6 km) north of downtown Dallas, east of Love Field. With University Park, it forms the Park Cities."
 },
 "us-belmont": {
  "ja": "シャーロットの西約19km、カトーバ川とその支流に挟まれた半島の街。歴史地区の中心街とベルモント・アビー大学がある。",
  "en": "A small city 12 miles (19 km) west of Charlotte, on a peninsula between the Catawba River and its South Fork, with a historic downtown."
 },
 "us-davidson": {
  "ja": "シャーロットの北、ノーマン湖のほとりにある大学の町。デビッドソン大学の向かいに歴史地区の中心街が広がる。",
  "en": "A college town north of Charlotte on the shore of Lake Norman, with a historic downtown facing Davidson College."
 },
 "us-doral": {
  "ja": "マイアミ国際空港の西約8kmにある街。空港に近いため、輸出入業をはじめ多くの企業や店が集まる。",
  "en": "A city 5 miles (8 km) west of Miami International Airport, home to many businesses, especially importers and exporters drawn by the airport."
 },
 "us-pinecrest": {
  "ja": "マイアミ中心部の南西約18kmにある郊外の村。旧パロット・ジャングルの跡地を村営の公園パインクレスト・ガーデンズとして開いている。",
  "en": "A suburban village 11 miles (18 km) southwest of downtown Miami, with Pinecrest Gardens, a village park on the former Parrot Jungle site."
 },
 "us-bala-cynwyd-lower-merion-area": {
  "ja": "フィラデルフィア市の西隣、メインライン沿いの戸建て中心の住宅地。劇場や小さな店、飲食店が並ぶバラ・アベニューがある。",
  "en": "On Philadelphia’s western edge along the Main Line, a mostly single-family area with Bala Avenue’s theater, small shops and restaurants."
 },
 "us-media-area": {
  "ja": "フィラデルフィアの西約21km、デラウェア郡の郡庁所在地。中心街のステート・ストリートを路面電車（D1線）が走る。",
  "en": "The seat of Delaware County, about 13 miles (21 km) west of Philadelphia, with SEPTA’s D1 trolley running along State Street downtown."
 },
 "us-chandler": {
  "ja": "フェニックス中心部の南東約35km、イースト・バレーの都市。インテルをはじめ技術系企業の拠点が集まる。",
  "en": "An East Valley city 22 miles (35 km) southeast of downtown Phoenix and a tech hub, with major sites for Intel and other companies."
 },
 "us-scottsdale": {
  "ja": "フェニックスの東隣の都市。歴史ある旧市街（オールドタウン）と、公園を自転車道で結ぶ約19kmのグリーンベルトがある。",
  "en": "A city just east of Phoenix, with a historic Old Town and the 12-mile (19 km) Scottsdale Greenbelt linking city parks by bike path."
 },
 "us-paradise-valley": {
  "ja": "フェニックスとスコッツデールに挟まれた町。キャメルバック山の北に広がり、1〜5エーカーの広い区画の住宅地やゴルフ場で知られる。",
  "en": "A town between Phoenix and Scottsdale, north of Camelback Mountain, known for homes on one-to-five-acre lots and its golf courses."
 },
 "us-buda": {
  "ja": "オースティン中心部の南西約24km、I-35沿いの急成長する郊外。1880年代に鉄道沿いに生まれた中心街が残る。",
  "en": "A fast-growing suburb on I-35, 15 miles southwest of downtown Austin, with a downtown that grew up along the railroad in the 1880s."
 },
 "us-lakeway": {
  "ja": "オースティン中心部の西約26km、レイク・トラビスに面した街。1960年代のホテルとリゾートの開発から始まった。",
  "en": "A city beside Lake Travis, about 16 miles west of Austin, that began in the 1960s as a hotel and resort community."
 },
 "us-ellicott-city": {
  "ja": "BWI空港の北西約16km、ハワード郡の郡庁所在地。パタプスコ川の谷に、18世紀の製粉の町に始まる歴史地区が残る。",
  "en": "Howard County's seat, about 10 miles northwest of BWI, with a historic district in the Patapsco valley that began as a 1770s mill town."
 },
 "us-severna-park": {
  "ja": "BWI空港の南東、セバーン川とマゴシー川にはさまれた水辺の住宅地。鉄道跡を使った自転車道B&Aトレイルが通る。",
  "en": "A waterside community southeast of BWI, between the Severn and Magothy rivers, with the B&A Trail, a former rail line, running through it."
 },
 "us-summerlin-south-area": {
  "ja": "ラスベガス盆地の西端、レッドロック・キャニオンに接する計画住宅地。商業地区ダウンタウン・サマーリンがある。",
  "en": "A master-planned community on the western edge of the Las Vegas Valley, next to Red Rock Canyon, home to Downtown Summerlin."
 },
 "us-anthem-henderson-area": {
  "ja": "ラスベガスの南東、ヘンダーソン市の計画住宅地。1998年に開かれ、カントリークラブやゴルフ場、公園がある。",
  "en": "A master-planned community in Henderson, southeast of Las Vegas, opened in 1998 with a country club, golf courses and parks."
 },
 "us-mount-juliet": {
  "ja": "ナッシュビル空港からI-40で東へ約14kmの郊外の街。二つの湖にはさまれ、通勤鉄道の駅がある。",
  "en": "A Nashville suburb about 9 miles east of the airport on I-40, between Old Hickory and Percy Priest lakes, with a commuter rail stop."
 },
 "us-brentwood": {
  "ja": "ナッシュビルのすぐ南、I-65沿いの住宅の街。約66ヘクタールのクロケット公園をはじめ公園が多い。",
  "en": "A residential suburb just south of Nashville on I-65, with many parks, including the 164-acre Crockett Park."
 },
 "us-south-anchorage-hillside": {
  "ja": "アンカレッジ南部、チュガッチ山地のふもとの斜面に広がる住宅地。市街を見下ろし、州立公園の登山口が近い。",
  "en": "Homes on the Chugach foothills of south Anchorage, looking out over the city, with Chugach State Park trailheads close by."
 },
 "us-eagle-river": {
  "ja": "アンカレッジ市内の北東部、チュガッチ州立公園の山すそに広がる住宅の街。グレン・ハイウェイで中心部と結ばれる。",
  "en": "A community within Anchorage, northeast of downtown on the Glenn Highway, rising toward the Chugach Mountains and Chugach State Park."
 },
 "us-vancouver-wa": {
  "ja": "コロンビア川の北岸、ポートランドのすぐ北の街。1825年の交易拠点に始まり、中心部の川沿いは再開発が進む。",
  "en": "On the Columbia River's north bank, directly north of Portland; founded around Fort Vancouver in 1825, with a redeveloped waterfront."
 },
 "us-lake-oswego": {
  "ja": "ポートランド中心部の南約11km、オスウィーゴ湖を囲む街。19世紀後半にはオレゴンの製鉄の中心だった。",
  "en": "A Portland suburb about 7 miles south of downtown, built around Oswego Lake; it was the hub of Oregon's iron industry in the late 1800s."
 },
 "us-chula-vista": {
  "ja": "サンディエゴ中心部の南約12km、サンディエゴ湾に面した街。名はスペイン語で「美しい眺め」。湾岸に公園とマリーナがある。",
  "en": "On San Diego Bay, halfway between downtown San Diego and Tijuana; its Spanish name means 'beautiful view', and it has a bayfront marina."
 },
 "us-coronado": {
  "ja": "サンディエゴ湾をはさみ中心部の対岸にある海辺の街。1888年開業のホテル・デル・コロナドで知られ、海軍の航空基地がある。",
  "en": "A beach city across San Diego Bay from downtown, known for the 1888 Hotel del Coronado and home to Naval Air Station North Island."
 },
 "us-davie": {
  "ja": "フォートローダーデール空港の西、ブロワード郡の街。乗馬が盛んで、牧場や西部風の建物が残る。",
  "en": "A Broward County town west of Fort Lauderdale's airport, where horseback riding is common and ranches and Western-style buildings remain."
 },
 "us-weston": {
  "ja": "フォートローダーデールのすぐ西、エバーグレーズに接する計画都市。1980年代から住宅地として整備された。",
  "en": "A master-planned city just west of Fort Lauderdale, built from the 1980s; Broward County's westernmost city, bordering the Everglades."
 },
 "us-hebron": {
  "ja": "CVG空港の入口から西へ約5km、ボーン郡北部の住宅地。シンシナティ中心部へは東へ約26km。",
  "en": "A community in northern Boone County, 3 miles west of the CVG airport entrance; downtown Cincinnati is 16 miles east via I-275 and I-75/71."
 },
 "us-fort-mitchell": {
  "ja": "シンシナティ南西、オハイオ川のケンタッキー側にある小さな市。南北戦争でシンシナティを守った砦の一つがあった。",
  "en": "A small Northern Kentucky city southwest of Cincinnati, on the site of one of the Civil War forts built to defend the city."
 },
 "us-indian-hill": {
  "ja": "シンシナティ北東の郊外。約48km²に人口約6千人と、起伏のある元農村の土地にゆったり家が並び、樹木園もある。",
  "en": "A Cincinnati suburb to the northeast, with about 6,000 residents on 18.6 square miles of rolling former farmland, and an arboretum."
 },
 "us-berea": {
  "ja": "クリーブランド西郊、CLE空港のすぐ南の街。ボールドウィン・ウォレス大学があり、砂岩の採石で栄えた歴史を持つ。",
  "en": "A western Cleveland suburb just south of CLE, home to Baldwin Wallace University and a history as a sandstone-quarrying town."
 },
 "us-solon": {
  "ja": "クリーブランド南東の郊外。工場地区と住宅地を分けた街づくりで、市の公園やメトロパークの森、ゴルフ場が市内にある。",
  "en": "A southeast Cleveland suburb planned to keep industry apart from homes, with city parks, part of a Metroparks reservation and golf courses."
 },
 "us-guaynabo-area": {
  "ja": "サンフアンの西隣にあり、首都圏の一部をなす市。島で最初のヨーロッパ人入植地カパラ（1508年）が築かれた土地で、その遺跡が残る。",
  "en": "A city just west of San Juan, within its metro area. Caparra, Puerto Rico’s first European settlement (1508), stood here; its ruins remain."
 },
 "us-dorado-area": {
  "ja": "サンフアンの西約24km、大西洋に面した北岸の町。浜辺が多く、古くからゴルフの町としても知られる。",
  "en": "A town on Puerto Rico’s Atlantic north coast, 24 km (15 mi) west of San Juan, with many beaches and a long history as a golf destination."
 },
 "us-westchase-area": {
  "ja": "タンパ中心部の北西約27km、1991年に開発が始まった計画住宅地。ゴルフ場があり、28の住区（ビレッジ）に分かれている。",
  "en": "A planned community about 27 km (17 mi) northwest of downtown Tampa, developed from 1991, with a golf course and 28 neighborhood “villages.”"
 },
 "us-safety-harbor": {
  "ja": "タンパ湾の西岸にある市。天然の鉱泉エスピリトゥサント・スプリングスで知られ、湾沿いのフィリップ公園には先住民の塚が残る。",
  "en": "A city on the west shore of Tampa Bay, known for its historic Espiritu Santo mineral springs; bayside Philippe Park keeps a Tocobaga mound."
 },
 "us-punta-gorda-isles-area": {
  "ja": "プンタゴルダ市内で1959年に造られた運河沿いの住宅地。総延長約88kmの運河から、シャーロット湾とメキシコ湾へ船で出られる。",
  "en": "A canal-front neighborhood of Punta Gorda, laid out from 1959 with 55 miles (88 km) of canals giving homes boat access to Charlotte Harbor."
 },
 "us-port-charlotte": {
  "ja": "シャーロット湾の北端、プンタゴルダの北西にある町。1950年代にジェネラル・デベロップメント社が計画・開発した。",
  "en": "A community at the north end of Charlotte Harbor, northwest of Punta Gorda, planned in the 1950s by the General Development Corporation."
 },
 "us-macungie-area": {
  "ja": "アレンタウン郊外の小さな町（バラ）。1776年創設と歴史が古く、毎年8月にはメモリアル公園でアンティークカーの祭典が開かれる。",
  "en": "A small borough outside Allentown, founded in 1776, whose Memorial Park hosts an antique car festival, Das Awkscht Fescht, every August."
 },
 "us-center-valley-saucon-valley-area": {
  "ja": "アレンタウンの南東、リーハイバレー南部の地区。2006年開業の屋外型ショッピングセンターと、デセールス大学のキャンパスがある。",
  "en": "A community in the southern Lehigh Valley, southeast of Allentown, home to an open-air shopping center (opened 2006) and DeSales University."
 },
 "us-plainfield": {
  "ja": "インディアナポリス国際空港のすぐ西にある町。歴史ある国道ナショナル・ロード（US40）が目抜き通りで、町内に約32kmの散策路がある。",
  "en": "A town just west of Indianapolis International Airport, with the historic National Road (US 40) as Main Street and some 20 miles of trails."
 },
 "us-carmel": {
  "ja": "インディアナポリスのすぐ北の郊外の市。100を超えるラウンドアバウト（環状交差点）と、市内を通る遊歩道モノン・グリーンウェイで知られる。",
  "en": "A suburban city just north of Indianapolis, known for its 100-plus roundabouts and the Monon Greenway trail running through town."
 },
 "us-moon-township": {
  "ja": "ピッツバーグの北西約19km、オハイオ川沿いの郡区。ピッツバーグ国際空港の地元で、ロバート・モリス大学の本校もある。",
  "en": "A township on the Ohio River 19 km (12 mi) northwest of Pittsburgh, home to Pittsburgh International Airport and Robert Morris University."
 },
 "us-upper-st-clair": {
  "ja": "ピッツバーグ中心部の南約18km、サウスヒルズ地域にある郡区。14の公園と運動場が町の面積の約9%を占める。",
  "en": "A township in Pittsburgh’s South Hills, about 18 km (11 mi) south of downtown, where 14 parks and playing fields cover about 9% of its area."
 },
 "us-germantown": {
  "ja": "メンフィスの東隣の郊外の市。公園が27か所あり、どの家からも歩いて行ける距離に公園がある。毎年6月には馬術ショーも開かれる。",
  "en": "An eastern suburb of Memphis with 27 parks, one within walking distance of every home, and a charity horse show each June."
 },
 "us-collierville": {
  "ja": "メンフィス郊外の町で、シェルビー郡で2番目に古い。国家歴史登録財に載る中心街には、歴史あるタウンスクエアが残る。",
  "en": "Shelby County’s second-oldest town, a Memphis suburb whose downtown and historic square are on the National Register of Historic Places."
 },
 "us-middletown-area": {
  "ja": "ルイビル郊外、ジェファーソン郡北東部にある小さな市。1797年に町として設立され、200年以上の歴史をもつ。",
  "en": "A small suburban city in northeastern Jefferson County, just outside Louisville, first incorporated in 1797."
 },
 "us-prospect-area": {
  "ja": "ルイビル中心部の北東約19km、オハイオ川とハロッズ・クリークに面した市。1960年代から住宅地が開発され、ゴルフ場を備えた住宅地もある。",
  "en": "A city 19 km (12 mi) northeast of downtown Louisville, between the Ohio River and Harrods Creek, built up with subdivisions since the 1960s."
 },
 "us-rancho-cucamonga": {
  "ja": "オンタリオ国際空港の北、サンガブリエル山地のふもとに広がる市。かつてはぶどう畑とワイン造りが盛んで、市域の多くが住宅地。",
  "en": "A city below the San Gabriel Mountains, north of Ontario International Airport, once known for its vineyards and now mostly residential."
 },
 "us-claremont": {
  "ja": "サンガブリエル山地のふもと、7つの大学からなるクレアモント・カレッジズの街。並木道と歴史ある建物が多く、「ビレッジ」と呼ばれる商店街がある。",
  "en": "A foothill college town east of Los Angeles, home to the seven Claremont Colleges and known for tree-lined streets and historic buildings."
 }
});
