/* us-town-notes.mjs ── 北米の住宅地（us-housing.mjs の街）の短い紹介（日英）。2026-11-02（米国）・2026-11-03（北米追加20社の米国・カナダ）。
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
 },
 "us-green": {
  "ja": "アクロンとカントンのあいだにある郊外の市で、アクロン・カントン空港もこの市内にある。かつての農地に住宅地が広がった。",
  "en": "A suburban city between Akron and Canton that is home to Akron–Canton Airport, where former farmland grew into residential areas."
 },
 "us-hudson": {
  "ja": "アクロン都市圏の北部にある郊外の市。コネチカットからの入植者が開いた町で、赤れんがのウェスタン・リザーブ・アカデミーがある。",
  "en": "A suburb in northern Summit County near Akron, with New England roots from its first settlers and the red-brick Western Reserve Academy."
 },
 "us-warwick": {
  "ja": "プロビデンスの南約19km、T・F・グリーン空港がある市。ナラガンセット湾に面し、入り江や海辺の州立公園がある。",
  "en": "A city about 19 km south of Providence and home to T. F. Green Airport, with coves and shoreline state parks on Narragansett Bay."
 },
 "us-east-greenwich": {
  "ja": "ウォリックの南隣の町。水辺と、飲食店や店が並ぶ中心街、そして学区の評価が高いことで知られる。",
  "en": "A town just south of Warwick, known for its waterfront, a downtown of restaurants and shops, and a well-regarded school district."
 },
 "us-estero": {
  "ja": "南西フロリダ国際空港のすぐ南にある村。州立公園が2つあり、湧き水のエステロ川が流れ、ゴルフ場も多い。",
  "en": "A village just south of Southwest Florida International Airport, with two state parks, the spring-fed Estero River and many golf courses."
 },
 "us-bonita-springs": {
  "ja": "エステロの南、メキシコ湾とエステロ湾に面した市。ボニータ・ビーチの砂浜と、中心街を流れるインペリアル川がある。",
  "en": "A city south of Estero on the Gulf of Mexico and Estero Bay, with Bonita Beach and the Imperial River running through downtown."
 },
 "us-vero-beach": {
  "ja": "インディアンリバー・ラグーンの本土側の市街。歴史ある中心街に店や飲食店、画廊が並び、橋で海辺の島へ渡れる。",
  "en": "The mainland side of Vero Beach on the Indian River Lagoon, with a historic downtown of shops, restaurants and galleries."
 },
 "us-indian-river-shores": {
  "ja": "ベロビーチのすぐ北、大西洋とインディアンリバー・ラグーンにはさまれたオーキッド島の町。低密度の住宅地が中心。",
  "en": "A town on Orchid Island just north of Vero Beach, between the Atlantic and the Indian River Lagoon, mostly low-density neighborhoods."
 },
 "us-summerville": {
  "ja": "チャールストンの北西約39kmの町。1847年に木の伐採を法律で禁じた歴史があり、歴史地区に古い家並みが残る。",
  "en": "A town about 39 km northwest of Charleston that protected its trees by law in 1847, with a historic district of older homes."
 },
 "us-mount-pleasant": {
  "ja": "クーパー川をはさんでチャールストンの対岸にある町。ラベネル橋で結ばれ、シェム・クリークの水辺と、町で最も古い地区オールドビレッジがある。",
  "en": "A town across the Cooper River from Charleston, linked by the Ravenel Bridge, with the Shem Creek waterfront and the historic Old Village."
 },
 "us-chesapeake-greenbrier": {
  "ja": "ノーフォーク国際空港の南にあるチェサピーク市の地区。大型のグリーンブライアー・モールがあり、無料で入れる植物園も近い。",
  "en": "A district of Chesapeake south of Norfolk International Airport, with the large Greenbrier Mall and a free-entry arboretum nearby."
 },
 "us-virginia-beach": {
  "ja": "チェサピーク湾の入り口、大西洋に面したリゾートの市。海沿いに長い砂浜が続き、ホテルや飲食店が並ぶ。",
  "en": "A resort city at the mouth of the Chesapeake Bay on the Atlantic, with miles of beaches lined by hotels and restaurants."
 },
 "us-windsor-locks": {
  "ja": "ハートフォードとスプリングフィールドの中間にあり、ブラッドリー国際空港が町の約3分の1を占める。コネチカット川沿いに古い運河が通る。",
  "en": "Midway between Hartford and Springfield, the town is home to Bradley International Airport and a historic canal along the Connecticut River."
 },
 "us-glastonbury": {
  "ja": "ハートフォードの南東約11km、コネチカット川の東岸にある町。1636年に入植が始まり、1655年からの渡し船が今も川を渡る。",
  "en": "A town on the east bank of the Connecticut River, 11 km southeast of Hartford, settled in 1636; a ferry has crossed here since 1655."
 },
 "us-lehi": {
  "ja": "ユタバレー北端の市。IT企業が集まる「シリコン・スロープ」とともに急成長し、中心街は歴史地区に指定されている。",
  "en": "A city at the north end of Utah Valley that has grown fast with the Silicon Slopes tech industry; its downtown is a historic district."
 },
 "us-alpine": {
  "ja": "ユタ郡の北東端、ワサッチ山脈の斜面にある市。高台からの眺めがスイス・アルプスにたとえられ、この名が付いた。",
  "en": "A city on the slopes of the Wasatch Range at the northeast edge of Utah County, named because its views were compared to the Swiss Alps."
 },
 "us-kenner": {
  "ja": "ニューオーリンズの西にある郊外の市で、ルイ・アームストロング・ニューオーリンズ国際空港がある。北はポンチャートレイン湖に面する。",
  "en": "A suburb west of New Orleans and home to Louis Armstrong New Orleans International Airport, bordered by Lake Pontchartrain to the north."
 },
 "us-mandeville": {
  "ja": "ポンチャートレイン湖の北岸、ニューオーリンズの対岸にある市。19世紀にニューオーリンズの人の湖畔の保養地として開けた。",
  "en": "A city on the north shore of Lake Pontchartrain, across the lake from New Orleans, first developed in the 1800s as a lakeside resort."
 },
 "us-branford": {
  "ja": "ニューヘイブンの東約10km、ロングアイランド湾沿いの町。ブランフォード港とストーニークリーク港があり、沖にシンブル諸島が浮かぶ。",
  "en": "A shoreline town on Long Island Sound about 10 km east of New Haven, with two harbors and the Thimble Islands offshore."
 },
 "us-madison": {
  "ja": "コネチカット州のロングアイランド湾沿いの中ほどにある町。1641年に入植が始まり、中心部に歴史地区のグリーン、海辺に砂浜がある。",
  "en": "A town midway along Connecticut's Long Island Sound shore, settled in 1641, with a historic town green and several beaches."
 },
 "us-newark-delaware": {
  "ja": "ウィルミントンの西南西約13kmにある、デラウェア大学の街。1694年に開かれ、フィラデルフィア都市圏に属する。",
  "en": "Home to the University of Delaware, about 13 km west-southwest of Wilmington; founded in 1694 and part of the Philadelphia metro area."
 },
 "us-greenville-delaware": {
  "ja": "ウィルミントン郊外のベッドタウン。近くにデュポン家ゆかりのウィンタートゥールの庭園とハグリー博物館がある。",
  "en": "A bedroom community outside Wilmington, near Winterthur, the former du Pont estate and gardens, and the Hagley Museum."
 },
 "us-south-lakeland": {
  "ja": "レイクランド市の南側に広がる住宅地。市は州間高速4号線沿いのタンパとオーランドのあいだにあり、名前のとおり湖が多い。",
  "en": "The southern side of Lakeland, a city on I-4 between Tampa and Orlando that is named for its many lakes."
 },
 "us-lake-hollingsworth": {
  "ja": "レイクランド中心部近くの湖。湖を一周する遊歩道があり、北岸にはライト設計の校舎で知られるフロリダ・サザン大学がある。",
  "en": "A lake near central Lakeland with a path all the way around and Florida Southern College's Frank Lloyd Wright buildings on its north shore."
 },
 "us-concord": {
  "ja": "シャーロットの北東約32kmにある市。モータースピードウェイなどの施設があり、ユニオン通り沿いの歴史地区に古い邸宅が並ぶ。",
  "en": "A city about 32 km northeast of Uptown Charlotte, home to Charlotte Motor Speedway, with historic homes along Union Street."
 },
 "us-st-charles": {
  "ja": "セントルイスの北西約32km、ミズーリ川沿いの市。1769年ごろに開かれ、ミズーリ州の最初の州都が置かれた。",
  "en": "A city on the Missouri River about 32 km northwest of St. Louis, founded around 1769 and Missouri's first state capital."
 },
 "us-chesterfield": {
  "ja": "セントルイスの西にある郊外の市。ミズーリ川沿いの低地チェスターフィールド・バレーには商業施設が集まる。",
  "en": "A western suburb of St. Louis; the Chesterfield Valley along the Missouri River has become a large commercial area."
 },
 "us-aiea": {
  "ja": "真珠湾に面したホノルル郊外の町。山側のアイエア・ハイツには、真珠湾を見渡せる州立レクリエーション地区と遊歩道がある。",
  "en": "A Honolulu suburb on Pearl Harbor; up in Aiea Heights, a state recreation area has a long trail and views over the harbor."
 },
 "us-kailua-oahu": {
  "ja": "オアフ島の風上側、ホノルルの北東約19kmにある住宅地。弓形に約4km続くカイルア・ビーチや、ラニカイ・ビーチがある。",
  "en": "A mainly residential town on Oahu's windward coast, 19 km northeast of Honolulu, with the 4 km crescent of Kailua Beach."
 },
 "us-harrison": {
  "ja": "マンハッタンの北東約18kmにあるニューヨーク郊外の町。1696年に開かれ、パーチェス地区とウエストチェスター郡空港の一部を含む。",
  "en": "A New York City suburb about 18 km northeast of Manhattan, founded in 1696; it includes Purchase and part of Westchester County Airport."
 },
 "us-scarsdale": {
  "ja": "マンハッタンの北約31km、ブロンクス川の谷にある町。メトロノース鉄道ハーレム線の駅があり、17の住宅地区からなる。",
  "en": "A village in the Bronx River Valley about 31 km north of Midtown Manhattan, on Metro-North's Harlem Line, made up of 17 neighborhoods."
 },
 "ca-etobicoke-central": {
  "ja": "トロント市の西端、ピアソン空港の南東に広がる住宅地。地下鉄2号線の西の終点キプリング駅がある。",
  "en": "Toronto's west end, southeast of Pearson Airport, where Kipling station marks the western end of subway Line 2."
 },
 "ca-mississauga-northwest": {
  "ja": "ピアソン空港の西に広がるミシサガ市の北西部。クレジット川沿いのストリーツビルは、歴史ある建物と町並みを残す旧町。",
  "en": "The northwest corner of Mississauga, west of Pearson Airport. Streetsville, on the Credit River, keeps its historic small-town streetscape."
 },
 "ca-oakville": {
  "ja": "ピアソン空港の南西、オンタリオ湖に面した町。レイクショア通り沿いに中心街があり、湖岸に港がある。",
  "en": "A Lake Ontario town southwest of Pearson Airport, with its downtown along Lakeshore Road and a harbor on the waterfront."
 },
 "ca-markham": {
  "ja": "トロント中心部の北東約30kmの市。IT企業が多く集まり、旧村ユニオンビルの本通りは歴史的町並みの保存地区。",
  "en": "A city about 30 km northeast of downtown Toronto, home to many tech firms; Main Street Unionville is a heritage conservation district."
 },
 "ca-richmond-hill-vaughan-king": {
  "ja": "トロントのすぐ北、ヨーク地域の市と町。リッチモンドヒル北部にはウィルコックス湖があり、キングは丘陵に馬の牧場が広がる。",
  "en": "Cities and a township in York Region just north of Toronto: Richmond Hill has Lake Wilcox, and King is rolling country with horse farms."
 },
 "ca-dorval-lachine-saint-pierre": {
  "ja": "市域の約6割をトルドー空港が占めるドーバルと、東隣のラシーン。サンルイ湖に面し、ラシーン運河の起点がある。",
  "en": "Dorval, where Trudeau Airport covers about 60% of the land, and neighbouring Lachine on Lac Saint-Louis, where the Lachine Canal begins."
 },
 "ca-beaconsfield-baie-d-urfe": {
  "ja": "トルドー空港の西、サンルイ湖の北岸の住宅の町。1950〜60年代に郊外住宅地として発展し、住民の多くが戸建てに住む。",
  "en": "A residential suburb on the north shore of Lac Saint-Louis, west of Trudeau Airport, where most residents live in single-family homes."
 },
 "ca-saint-laurent": {
  "ja": "トルドー空港に接するモントリオールの区。エア・カナダ本社があり、ボワフラン地区は旧飛行場の跡地に造られた住宅地。",
  "en": "A Montréal borough bordering Trudeau Airport and home to Air Canada's head office; Bois-Franc was built on a former airfield."
 },
 "ca-mount-royal-outremont": {
  "ja": "モン・ロワイヤル山の北西側の住宅地。マウントロイヤルは田園都市の考えで計画された町、ウトルモンはローリエ通りに店が並ぶ。",
  "en": "Residential areas northwest of Mount Royal: the Town of Mount Royal, planned as a garden city, and Outremont, with shops on Laurier."
 },
 "ca-richmond": {
  "ja": "バンクーバー空港のあるシーアイランドを含む市。南西端のスティーブストンは、漁港と缶詰工場の史跡が残る旧漁村。",
  "en": "The city that includes Sea Island, home of YVR. Steveston, on its southwest tip, is an old fishing village with a working harbor."
 },
 "ca-kitsilano-point-grey": {
  "ja": "バンクーバー西側、イングリッシュ湾の南岸の住宅地。キツラノ・ビーチから西へ、ジェリコやスパニッシュ・バンクスの浜が続く。",
  "en": "Residential West Side neighborhoods on the south shore of English Bay, from Kitsilano Beach west to Jericho and Spanish Banks."
 },
 "ca-kerrisdale-westside": {
  "ja": "バンクーバー空港の北、市の西側（ウェストサイド）の住宅地。西41番街沿いに商店が並ぶ。",
  "en": "A residential neighborhood on Vancouver's West Side, north of YVR, with a shopping district along West 41st Avenue."
 },
 "ca-west-vancouver": {
  "ja": "バラード入江の北岸、バンクーバー中心部の北西の町。ライオンズゲート橋で中心部と結ばれ、海辺から山の斜面へ住宅地が続く。",
  "en": "On Burrard Inlet's north shore, linked to downtown Vancouver by the Lions Gate Bridge, with homes rising from the water up the mountainside."
 },
 "ca-north-vancouver-district": {
  "ja": "バラード入江の北、ノースショアの山の斜面に広がる町。ディープコーブの入り江やリン渓谷の吊り橋など自然が身近。",
  "en": "Spread across the North Shore mountain slopes above Burrard Inlet, with Deep Cove and Lynn Canyon's suspension bridge close by."
 },
 "ca-st-james": {
  "ja": "ウィニペグ空港を含む市西部の地区。ポーテージ通り沿いに20世紀初めから住宅地が広がり、ブルース公園などの緑地がある。",
  "en": "Winnipeg's west end around the airport, with residential streets along Portage Avenue dating from the early 1900s and parks like Bruce Park."
 },
 "ca-assiniboine-park": {
  "ja": "ウィニペグ南西部、アシニボイン川南岸の広い公園のまわり。公園には動物園や庭園、広いアシニボインの森がある。",
  "en": "Around Assiniboine Park on the south bank of the Assiniboine River in southwest Winnipeg, with a zoo, gardens and the Assiniboine Forest."
 },
 "ca-fort-garry": {
  "ja": "ウィニペグ南西部の地区で、マニトバ大学の本キャンパスがある。ペンビナ・ハイウェイが地区を南北に通る。",
  "en": "A southwest Winnipeg community home to the University of Manitoba's main campus, with Pembina Highway running through it."
 },
 "ca-st-vital": {
  "ja": "ウィニペグ南部、レッド川とセーヌ川にはさまれた住宅地。レッド川沿いにセントバイタル公園がある。",
  "en": "A residential area in south Winnipeg between the Red and Seine rivers, home to St. Vital Park on the Red River."
 },
 "ca-calgary-northeast": {
  "ja": "カルガリー空港のある市の北東部。空港の東のサドルリッジには新しい住宅地が広がり、LRT（CTrain）の駅がある。",
  "en": "Calgary's northeast quadrant around YYC; Saddle Ridge, east of the airport, is a newer suburb at the end of a CTrain line."
 },
 "ca-calgary-northwest": {
  "ja": "カルガリー中心街の北西の住宅地。11km²を超える自然公園ノーズヒル公園があり、在来の草原が残る。",
  "en": "Residential northwest Calgary, home to Nose Hill Park, a natural park of over 11 km² that protects native grassland."
 },
 "ca-calgary-southwest": {
  "ja": "中心街の南西の住宅地。グレンモア貯水池を一周する16kmの遊歩道があり、湖畔に歴史村ヘリテージ・パークがある。",
  "en": "Residential southwest Calgary around the Glenmore Reservoir, circled by a 16 km pathway, with Heritage Park Historical Village on its shore."
 },
 "ca-airdrie-cochrane": {
  "ja": "カルガリーの郊外。北のエアドリーは高速2号線沿いの市、西へ18kmのコクランはボウ川の谷にある町。",
  "en": "Communities near Calgary: Airdrie to the north on Highway 2, and Cochrane, 18 km west of the city in the Bow River valley."
 },
 "ca-leduc": {
  "ja": "エドモントン空港と高速2号線をはさんで向かい合う市。エドモントンの南33kmにあり、東端にテルフォード湖がある。",
  "en": "A city across Highway 2 from Edmonton International Airport, 33 km south of Edmonton, with Telford Lake on its east side."
 },
 "ca-edmonton-southwest": {
  "ja": "空港の北、エドモントン市の南西部の住宅地。ノースサスカチュワン川の谷に公園と遊歩道が続き、テルウィリガー公園もその一つ。",
  "en": "Residential southwest Edmonton, north of the airport, beside the North Saskatchewan River valley parks, including Terwillegar Park."
 },
 "ca-st-albert": {
  "ja": "エドモントンの北西に接する市。スタージョン川が流れ、メティスの集落として始まった古い歴史を持つ。",
  "en": "A city on Edmonton's northwest edge along the Sturgeon River, first settled as a Métis community."
 },
 "ca-strathcona-county": {
  "ja": "エドモントンの東に接する郡。人口の約7割がシャーウッドパークに住み、東にはエルクアイランド国立公園がある。",
  "en": "East of Edmonton, reaching toward Elk Island National Park; about 73% of residents live in the suburban community of Sherwood Park."
 },
 "ca-hunt-club-south-keys": {
  "ja": "オタワ空港のすぐ北の住宅地。サウスキーズ駅はOトレイン2号線と空港線4号線の乗換駅で、隣に大型ショッピングセンターがある。",
  "en": "Just north of Ottawa's airport; South Keys station, next to a shopping center, connects O-Train Line 2 with the Line 4 airport link."
 },
 "ca-nepean": {
  "ja": "オタワ中心部の西にある旧ネピアン市の地域。南西のバーヘイブンは人口10万人を超える郊外の住宅地。",
  "en": "The former city of Nepean, west of central Ottawa, including Barrhaven, a suburb of over 100,000 people to the southwest."
 },
 "ca-glebe-old-ottawa-south": {
  "ja": "オタワ中心部のすぐ南、リドー運河沿いの住宅地。バンク通りに小さな店や飲食店が並び、ランズダウン公園がある。",
  "en": "Neighborhoods just south of downtown Ottawa along the Rideau Canal, with small shops on Bank Street and Lansdowne Park."
 },
 "ca-ottawa": {
  "ja": "オタワ中心部の西約22kmの郊外。カナタは計画的に造られた町で、マーチ通り沿いにIT企業が集まり、隣にスティッツビルがある。",
  "en": "Ottawa's western suburbs, 22 km from downtown: Kanata, a planned community with a tech cluster on March Road, and neighbouring Stittsville."
 }
});
