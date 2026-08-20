// ─────────────────────────────────────────────────────────────────────────
// salary-data.mjs — 単一データソース（Single Source of Truth）
// パイロット年収（機長平均 / 副操縦士平均 と レンジ）。単位＝万円（¥1万＝10,000円）。
//
// ここが唯一の正。各ページ・ランキング配列・生成スクリプト・SEO注入は
// この値に一致させる。数値を変える時は必ずここを起点に更新し、
// check-salary.mjs で全ページの整合を検証すること。
//
// avg = フリート全体の平均推計（最上位=maxではない）。lo/hi = レンジ。
// taxFree = 非課税国（手取り≒総額）。conf = 出典の確度。
// 出典・調査メモは 2026-07 時点（有報 / 組合契約表 / OpenWork等）。
// ─────────────────────────────────────────────────────────────────────────

export const SALARY = {
  // ── 日本 ────────────────────────────────────────────────
  'ana':               { ja:'全日本空輸（ANA）', en:'All Nippon Airways (ANA)', region:'japan',                                  cap:{avg:2700, lo:2200, hi:3500}, fo:{avg:1800, lo:1400, hi:2100}, taxFree:false, conf:'high' },
  'jal':               { ja:'日本航空（JAL）', en:'Japan Airlines (JAL)', region:'japan',                                        cap:{avg:2700, lo:2200, hi:3500}, fo:{avg:1800, lo:1400, hi:2100}, taxFree:false, conf:'high' },
  'zipair':            { ja:'ZIPAIR Tokyo', en:'ZIPAIR Tokyo', region:'japan',                                                   cap:{avg:2500, lo:2200, hi:3100}, fo:{avg:1500, lo:1200, hi:1900}, taxFree:false, conf:'medium' },
  'jetstar-japan':     { ja:'ジェットスター・ジャパン', en:'Jetstar Japan', region:'japan',                                      cap:{avg:2400, lo:2000, hi:2900}, fo:{avg:1450, lo:1250, hi:1600}, taxFree:false, conf:'medium' },
  'peach':             { ja:'Peach Aviation', en:'Peach Aviation', region:'japan',                                               cap:{avg:2350, lo:2000, hi:2800}, fo:{avg:1400, lo:1000, hi:1600}, taxFree:false, conf:'medium' },
  'solaseed':          { ja:'ソラシドエア', en:'Solaseed Air', region:'japan',                                                   cap:{avg:2000, lo:1800, hi:2300}, fo:{avg:1250, lo:1050, hi:1400}, taxFree:false, conf:'medium' },
  'spring-japan':      { ja:'スプリング・ジャパン', en:'Spring Japan', region:'japan',                                           cap:{avg:2000, lo:1700, hi:2500}, fo:{avg:1150, lo:900,  hi:1400}, taxFree:false, conf:'low' },
  'airdo':             { ja:'AIRDO', en:'AIRDO (AIR DO)', region:'japan',                                                        cap:{avg:1950, lo:1750, hi:2250}, fo:{avg:1200, lo:1000, hi:1400}, taxFree:false, conf:'medium' },
  'starflyer':         { ja:'スターフライヤー', en:'StarFlyer (Star Flyer)', region:'japan',                                     cap:{avg:1950, lo:1650, hi:2200}, fo:{avg:1150, lo:900,  hi:1350}, taxFree:false, conf:'medium' },
  'skymark':           { ja:'スカイマーク', en:'Skymark Airlines', region:'japan',                                               cap:{avg:1900, lo:1600, hi:2300}, fo:{avg:950,  lo:700,  hi:1200}, taxFree:false, conf:'medium' },
  'fda':               { ja:'フジドリームエアラインズ（FDA）', en:'Fuji Dream Airlines (FDA)', region:'japan',                   cap:{avg:1600, lo:1400, hi:1800}, fo:{avg:850,  lo:700,  hi:1050}, taxFree:false, conf:'low' },

  // ── 中東・アジア太平洋 ──────────────────────────────────
  'emirates':          { ja:'エミレーツ', en:'Emirates', region:'mideast',                                                       cap:{avg:3700, lo:3350, hi:5050}, fo:{avg:2800, lo:2500, hi:3350}, taxFree:true,  conf:'high' },
  'qantas':            { ja:'カンタス航空', en:'Qantas', region:'oceania',                                                       cap:{avg:3700, lo:3120, hi:5400}, fo:{avg:2100, lo:1660, hi:3120}, taxFree:false, conf:'medium' },
  'cathay-pacific':    { ja:'キャセイパシフィック', en:'Cathay Pacific', region:'asia',                                          cap:{avg:3600, lo:3000, hi:5650}, fo:{avg:2400, lo:1800, hi:3230}, taxFree:false, conf:'medium' },
  'singapore-airlines':{ ja:'シンガポール航空', en:'Singapore Airlines', region:'asia',                                          cap:{avg:3400, lo:2750, hi:4150}, fo:{avg:1850, lo:1100, hi:2280}, taxFree:false, conf:'medium' },
  'etihad':            { ja:'エティハド航空', en:'Etihad Airways', region:'mideast',                                             cap:{avg:3400, lo:3000, hi:6000}, fo:{avg:2300, lo:1900, hi:3100}, taxFree:true,  conf:'medium' },
  'qatar-airways':     { ja:'カタール航空', en:'Qatar Airways', region:'mideast',                                                cap:{avg:2900, lo:2600, hi:4800}, fo:{avg:2050, lo:1850, hi:2700}, taxFree:true,  conf:'medium' },
  'korean-air':        { ja:'大韓航空', en:'Korean Air', region:'asia',                                                          cap:{avg:2450, lo:1850, hi:2750}, fo:{avg:1250, lo:950,  hi:1430}, taxFree:false, conf:'medium' },
  'asiana':            { ja:'アシアナ航空', en:'Asiana Airlines', region:'asia',                                                 cap:{avg:2180, lo:1650, hi:2450}, fo:{avg:1110, lo:840,  hi:1270}, taxFree:false, conf:'low'    },
  'starlux':           { ja:'スターラックス', en:'STARLUX Airlines', region:'asia',                                              cap:{avg:2800, lo:2000, hi:3900}, fo:{avg:1500, lo:1200, hi:1700}, taxFree:false, conf:'medium' },
  'china-airlines':    { ja:'チャイナエアライン', en:'China Airlines', region:'asia',                                            cap:{avg:2000, lo:1500, hi:2450}, fo:{avg:1100, lo:700,  hi:1280}, taxFree:false, conf:'low' },
  'thai-airways':      { ja:'タイ国際航空', en:'Thai Airways International', region:'asia',                                      cap:{avg:1850, lo:1500, hi:2420}, fo:{avg:880,  lo:660,  hi:1140}, taxFree:false, conf:'medium' },
  'eva-air':           { ja:'エバー航空', en:'EVA Air', region:'asia',                                                           cap:{avg:1750, lo:1370, hi:2200}, fo:{avg:980,  lo:600,  hi:1180}, taxFree:false, conf:'medium' },

  // ── 米州・欧州 ──────────────────────────────────────────
  'united':            { ja:'ユナイテッド航空', en:'United Airlines', region:'us',                                               cap:{avg:6320, lo:5370, hi:8530}, fo:{avg:3870, lo:1790, hi:5220}, taxFree:false, conf:'high' },
  'delta':             { ja:'デルタ航空', en:'Delta Air Lines', region:'us',                                                     cap:{avg:6160, lo:4950, hi:8690}, fo:{avg:3510, lo:1680, hi:5020}, taxFree:false, conf:'high' },
  'american':          { ja:'アメリカン航空', en:'American Airlines', region:'us',                                               cap:{avg:5930, lo:5010, hi:8600}, fo:{avg:3440, lo:1710, hi:5260}, taxFree:false, conf:'high' },
  'southwest':         { ja:'サウスウエスト航空', en:'Southwest Airlines', region:'us',                                          cap:{avg:4820, lo:4140, hi:7110}, fo:{avg:2610, lo:1660, hi:4030}, taxFree:false, conf:'medium' },
  'klm':               { ja:'KLMオランダ航空', en:'KLM Royal Dutch Airlines', region:'europe',                                   cap:{avg:3960, lo:3030, hi:5810}, fo:{avg:2240, lo:1380, hi:4370}, taxFree:false, conf:'medium' },
  'air-france':        { ja:'エールフランス', en:'Air France', region:'europe',                                                  cap:{avg:3530, lo:2750, hi:6020}, fo:{avg:1810, lo:1200, hi:2920}, taxFree:false, conf:'low' },
  'lufthansa':         { ja:'ルフトハンザ', en:'Lufthansa', region:'europe',                                                     cap:{avg:3440, lo:2490, hi:4320}, fo:{avg:1890, lo:1260, hi:3010}, taxFree:false, conf:'medium' },
  'air-canada':        { ja:'エア・カナダ', en:'Air Canada', region:'us',                                                        cap:{avg:3360, lo:2490, hi:4260}, fo:{avg:1510, lo:580,  hi:2200}, taxFree:false, conf:'medium' },
  'british-airways':   { ja:'ブリティッシュ・エアウェイズ', en:'British Airways', region:'europe',                               cap:{avg:3030, lo:2020, hi:4040}, fo:{avg:1660, lo:1170, hi:2460}, taxFree:false, conf:'medium' },

  // ── 第2バッチ：地方・中小・海外中堅（79社） ─────────────────
  // 日本の地方・子会社・GA
  'airjapan':     { ja:'AirJapan', en:'AirJapan', region:'japan',                                                                cap:{avg:2100, lo:1900, hi:2400}, fo:{avg:1350, lo:1150, hi:1550}, taxFree:false, conf:'low' },
  'amx':          { ja:'天草エアライン', en:'Amakusa Airlines (AMX)', region:'japan',                                            cap:{avg:1400, lo:1200, hi:1600}, fo:{avg:850,  lo:700,  hi:1000}, taxFree:false, conf:'low' },
  'ana-wings':    { ja:'ANAウイングス', en:'ANA Wings', region:'japan',                                                          cap:{avg:2000, lo:1700, hi:2300}, fo:{avg:1300, lo:1100, hi:1500}, taxFree:false, conf:'medium' },
  'daiichi-air':  { ja:'第一航空', en:'Daiichi Aviation (Daiichi Air)', region:'japan',                                          cap:{avg:1300, lo:1100, hi:1500}, fo:{avg:800,  lo:650,  hi:950},  taxFree:false, conf:'low' },
  'hac':          { ja:'北海道エアシステム', en:'Hokkaido Air System (HAC)', region:'japan',                                     cap:{avg:1700, lo:1500, hi:1900}, fo:{avg:1000, lo:850,  hi:1200}, taxFree:false, conf:'low' },
  'ibex':         { ja:'IBEXエアラインズ', en:'IBEX Airlines', region:'japan',                                                   cap:{avg:1700, lo:1500, hi:1900}, fo:{avg:1050, lo:900,  hi:1250}, taxFree:false, conf:'medium' },
  'j-air':        { ja:'ジェイエア', en:'J-Air (J-AIR)', region:'japan',                                                         cap:{avg:2000, lo:1800, hi:2300}, fo:{avg:1250, lo:1100, hi:1500}, taxFree:false, conf:'medium' },
  'jac':          { ja:'日本エアコミューター', en:'Japan Air Commuter (JAC)', region:'japan',                                    cap:{avg:1700, lo:1500, hi:1900}, fo:{avg:1000, lo:850,  hi:1200}, taxFree:false, conf:'medium' },
  'jta':          { ja:'日本トランスオーシャン航空', en:'Japan Transocean Air (JTA)', region:'japan',                            cap:{avg:2000, lo:1800, hi:2300}, fo:{avg:1300, lo:1100, hi:1500}, taxFree:false, conf:'medium' },
  'orc':          { ja:'オリエンタルエアブリッジ', en:'Oriental Air Bridge (ORC)', region:'japan',                               cap:{avg:1500, lo:1300, hi:1700}, fo:{avg:850,  lo:700,  hi:1000}, taxFree:false, conf:'low' },
  'rac':          { ja:'琉球エアーコミューター', en:'Ryukyu Air Commuter (RAC)', region:'japan',                                 cap:{avg:1700, lo:1500, hi:1900}, fo:{avg:1000, lo:850,  hi:1200}, taxFree:false, conf:'low' },
  'shin-central': { ja:'新中央航空', en:'Shin Chuo Airlines (Shin Nichi Aviation)', region:'japan',                              cap:{avg:1250, lo:1000, hi:1500}, fo:{avg:750,  lo:650,  hi:900},  taxFree:false, conf:'low' },
  'shin-nihon':   { ja:'新日本航空', en:'Shin Nihon Airlines', region:'japan',                                                   cap:{avg:1200, lo:1000, hi:1400}, fo:{avg:750,  lo:600,  hi:900},  taxFree:false, conf:'low' },
  'toho-air':     { ja:'東邦航空', en:'Toho Air Service', region:'japan',                                                        cap:{avg:1200, lo:1000, hi:1500}, fo:{avg:750,  lo:600,  hi:900},  taxFree:false, conf:'low' },
  'toki-air':     { ja:'トキエア', en:'Toki Air', region:'japan',                                                                cap:{avg:1400, lo:1200, hi:1700}, fo:{avg:800,  lo:650,  hi:950},  taxFree:false, conf:'low' },

  // 中国＋ビジネスジェット・チャーター
  'air-china':      { ja:'中国国際航空', en:'Air China', region:'asia',                                                          cap:{avg:3050, lo:2200, hi:4800}, fo:{avg:1550, lo:1000, hi:2200}, taxFree:false, conf:'medium' },
  'china-eastern':  { ja:'中国東方航空', en:'China Eastern Airlines', region:'asia',                                             cap:{avg:2900, lo:2100, hi:4600}, fo:{avg:1480, lo:980,  hi:2100}, taxFree:false, conf:'medium' },
  'china-southern': { ja:'中国南方航空', en:'China Southern Airlines', region:'asia',                                            cap:{avg:2950, lo:2100, hi:4700}, fo:{avg:1500, lo:980,  hi:2100}, taxFree:false, conf:'medium' },
  'hainan-airlines':{ ja:'海南航空', en:'Hainan Airlines', region:'asia',                                                        cap:{avg:3050, lo:2200, hi:4800}, fo:{avg:1550, lo:1000, hi:2200}, taxFree:false, conf:'medium' },
  'airx-charter':   { ja:'エアX・チャーター', en:'AirX Charter Ltd', region:'europe',                                            cap:{avg:1850, lo:1350, hi:2500}, fo:{avg:1080, lo:750, hi:1500}, taxFree:false, conf:'medium' },
  'eagle-jet':      { ja:'イーグルジェット・インターナショナル', en:'Eagle Jet International, Inc.', region:'europe',            cap:{avg:1400, lo:1050, hi:1900}, fo:{avg:760, lo:550, hi:1050}, taxFree:false, conf:'low' },
  'root-aviation':  { ja:'ルート・アビエーション', en:'Root Aviation', region:'asia',                                            cap:{avg:1300, lo:1000, hi:1800}, fo:{avg:720, lo:500, hi:1000}, taxFree:false, conf:'low' },
  'solairus':       { ja:'ソレイラス・アビエーション', en:'Solairus Aviation', region:'us',                                      cap:{avg:2400, lo:1850, hi:3200}, fo:{avg:1700, lo:1300, hi:2200}, taxFree:false, conf:'medium' },

  // アジア
  'air-india':         { ja:'エア・インディア', en:'Air India', region:'asia',                                                   cap:{avg:1550, lo:1100, hi:2000}, fo:{avg:720,  lo:540, hi:900},  taxFree:false, conf:'medium' },
  'airasia':           { ja:'エアアジア', en:'AirAsia Group', region:'asia',                                                     cap:{avg:1300, lo:1050, hi:1680}, fo:{avg:600,  lo:400, hi:780},  taxFree:false, conf:'medium' },
  'bamboo-airways':    { ja:'バンブー・エアウェイズ', en:'Bamboo Airways', region:'asia',                                        cap:{avg:1850, lo:1300, hi:2400}, fo:{avg:1050, lo:700, hi:1400}, taxFree:false, conf:'low'    },
  'batik-air':         { ja:'バティック・エア', en:'Batik Air', region:'asia',                                                   cap:{avg:880,  lo:590,  hi:1180}, fo:{avg:430,  lo:300, hi:560},  taxFree:false, conf:'low'    },
  'garuda-indonesia':  { ja:'ガルーダ・インドネシア航空', en:'Garuda Indonesia', region:'asia',                                  cap:{avg:1500, lo:1050, hi:2200}, fo:{avg:720,  lo:470, hi:980},  taxFree:false, conf:'medium' },
  'hong-kong-express': { ja:'香港エクスプレス航空', en:'HK Express', region:'asia',                                              cap:{avg:2050, lo:1400, hi:2600}, fo:{avg:1150, lo:800, hi:1500}, taxFree:false, conf:'low'    },
  'indigo':            { ja:'インディゴ航空', en:'IndiGo', region:'asia',                                                        cap:{avg:1600, lo:1150, hi:2200}, fo:{avg:500,  lo:340, hi:650},  taxFree:false, conf:'medium' },
  'malaysia-airlines': { ja:'マレーシア航空', en:'Malaysia Airlines', region:'asia',                                             cap:{avg:1900, lo:1300, hi:2600}, fo:{avg:1000, lo:650, hi:1350}, taxFree:false, conf:'medium' },
  'philippine-airlines':{ ja:'フィリピン航空', en:'Philippine Airlines', region:'asia',                                          cap:{avg:1550, lo:1150, hi:2100}, fo:{avg:750,  lo:500, hi:1050}, taxFree:false, conf:'medium' },
  'scoot':             { ja:'スクート', en:'Scoot', region:'asia',                                                               cap:{avg:2350, lo:1900, hi:2900}, fo:{avg:1150, lo:850, hi:1450}, taxFree:false, conf:'medium' },
  'vietjet':           { ja:'ベトジェット航空', en:'VietJet Air', region:'asia',                                                 cap:{avg:1800, lo:1200, hi:2300}, fo:{avg:950,  lo:600, hi:1350}, taxFree:false, conf:'medium' },
  'vietnam-airlines':  { ja:'ベトナム航空', en:'Vietnam Airlines', region:'asia',                                                cap:{avg:1900, lo:1400, hi:2500}, fo:{avg:1050, lo:700, hi:1450}, taxFree:false, conf:'medium' },

  // 中東・アフリカ
  'egyptair':              { ja:'エジプト航空', en:'EgyptAir', region:'africa',                                                  cap:{avg:1550, lo:1250, hi:1900}, fo:{avg:850,  lo:650,  hi:1050}, taxFree:false, conf:'medium' },
  'ethiopian-airlines':    { ja:'エチオピア航空', en:'Ethiopian Airlines', region:'africa',                                      cap:{avg:1600, lo:1300, hi:1950}, fo:{avg:880,  lo:700,  hi:1100}, taxFree:false, conf:'medium' },
  'gulf-air':              { ja:'ガルフ・エア', en:'Gulf Air', region:'mideast',                                                 cap:{avg:2700, lo:2300, hi:3300}, fo:{avg:1500, lo:1250, hi:1850}, taxFree:true,  conf:'medium' },
  'kenya-airways':         { ja:'ケニア航空', en:'Kenya Airways', region:'africa',                                               cap:{avg:1500, lo:1150, hi:1950}, fo:{avg:750,  lo:550,  hi:1050}, taxFree:false, conf:'medium' },
  'kuwait-airways':        { ja:'クウェート航空', en:'Kuwait Airways', region:'mideast',                                         cap:{avg:2800, lo:2300, hi:3500}, fo:{avg:1550, lo:1250, hi:1950}, taxFree:true,  conf:'medium' },
  'oman-air':              { ja:'オマーン航空', en:'Oman Air', region:'mideast',                                                 cap:{avg:2500, lo:2100, hi:3000}, fo:{avg:1400, lo:1150, hi:1750}, taxFree:true,  conf:'medium' },
  'riyadh-air':            { ja:'リヤド航空', en:'Riyadh Air', region:'mideast',                                                 cap:{avg:4300, lo:3600, hi:5000}, fo:{avg:3000, lo:2700, hi:3400}, taxFree:true,  conf:'medium' },
  'royal-brunei':          { ja:'ロイヤル・ブルネイ航空', en:'Royal Brunei Airlines', region:'asia',                             cap:{avg:2050, lo:1700, hi:2450}, fo:{avg:1100, lo:900,  hi:1350}, taxFree:true,  conf:'medium' },
  'royal-jordanian':       { ja:'ロイヤル・ヨルダン航空', en:'Royal Jordanian', region:'mideast',                                cap:{avg:1700, lo:1350, hi:2200}, fo:{avg:900,  lo:700,  hi:1150}, taxFree:false, conf:'medium' },
  'saudia':                { ja:'サウジア航空', en:'Saudia', region:'mideast',                                                   cap:{avg:3300, lo:2700, hi:4200}, fo:{avg:1800, lo:1450, hi:2300}, taxFree:true,  conf:'medium' },
  'south-african-airways': { ja:'南アフリカ航空', en:'South African Airways (SAA)', region:'africa',                             cap:{avg:1300, lo:1050, hi:1700}, fo:{avg:720,  lo:550,  hi:950},  taxFree:false, conf:'medium' },
  'turkish-airlines':      { ja:'ターキッシュ エアラインズ', en:'Turkish Airlines', region:'europe',                             cap:{avg:2500, lo:2000, hi:3000}, fo:{avg:1400, lo:1150, hi:1800}, taxFree:false, conf:'medium' },

  // 欧州
  'aegean':          { ja:'エーゲ航空', en:'Aegean Airlines', region:'europe',                                                   cap:{avg:1300, lo:1030, hi:1550}, fo:{avg:660, lo:480, hi:780}, taxFree:false, conf:'medium' },
  'aer-lingus':      { ja:'エア・リンガス', en:'Aer Lingus', region:'europe',                                                    cap:{avg:2750, lo:2150, hi:4100}, fo:{avg:1700, lo:1240, hi:2600}, taxFree:false, conf:'medium' },
  'austrian':        { ja:'オーストリア航空', en:'Austrian Airlines', region:'europe',                                           cap:{avg:2600, lo:2000, hi:3300}, fo:{avg:1550, lo:1240, hi:2050}, taxFree:false, conf:'medium' },
  'easyjet':         { ja:'イージージェット', en:'easyJet', region:'europe',                                                     cap:{avg:2700, lo:2300, hi:3600}, fo:{avg:1500, lo:1210, hi:1980}, taxFree:false, conf:'medium' },
  // Eurowings: VC（Vereinigung Cockpit）協約の等級表（2024年1月／+7%反映）が根拠。
  //   FO 1等級 €74,090.50 → 14等級 €124,822.64 ／ 機長 1等級 €119,784.16 → 23等級 €202,253.79。
  //   以後の年次改定は等級表の金額が公開されていないため上乗せしない（低め側で置く）。@¥172/EUR。
  'eurowings':       { ja:'ユーロウイングス', en:'Eurowings', region:'europe',                                                  cap:{avg:2770, lo:2060, hi:3480}, fo:{avg:1710, lo:1270, hi:2150}, taxFree:false, conf:'medium' },
  'finnair':         { ja:'フィンエアー', en:'Finnair', region:'europe',                                                         cap:{avg:3000, lo:2400, hi:3900}, fo:{avg:1550, lo:1150, hi:2300}, taxFree:false, conf:'medium' },
  'iberia':          { ja:'イベリア航空', en:'Iberia', region:'europe',                                                          cap:{avg:2600, lo:2150, hi:3400}, fo:{avg:1380, lo:1000, hi:1890}, taxFree:false, conf:'medium' },
  'icelandair':      { ja:'アイスランド航空', en:'Icelandair', region:'europe',                                                  cap:{avg:2150, lo:1720, hi:2600}, fo:{avg:1200, lo:950, hi:1550}, taxFree:false, conf:'medium' },
  'ita-airways':     { ja:'ITAエアウェイズ', en:'ITA Airways', region:'europe',                                                  cap:{avg:2150, lo:1890, hi:2500}, fo:{avg:1120, lo:780, hi:1460}, taxFree:false, conf:'medium' },
  'lot':             { ja:'LOTポーランド航空', en:'LOT Polish Airlines', region:'europe',                                        cap:{avg:1400, lo:1150, hi:1650}, fo:{avg:730, lo:590, hi:860}, taxFree:false, conf:'medium' },
  'norwegian':       { ja:'ノルウェー・エアシャトル', en:'Norwegian Air Shuttle (Norwegian)', region:'europe',                   cap:{avg:2000, lo:1430, hi:2700}, fo:{avg:1100, lo:720, hi:1650}, taxFree:false, conf:'medium' },
  'ryanair':         { ja:'ライアンエアー', en:'Ryanair', region:'europe',                                                       cap:{avg:2240, lo:1450, hi:3100}, fo:{avg:1030, lo:650, hi:1460}, taxFree:false, conf:'medium' },
  'sas':             { ja:'スカンジナビア航空', en:'SAS Scandinavian Airlines', region:'europe',                                 cap:{avg:2650, lo:2220, hi:3170}, fo:{avg:1150, lo:740, hi:1500}, taxFree:false, conf:'medium' },
  'swiss':           { ja:'スイス インターナショナル エアラインズ', en:'Swiss International Air Lines (SWISS)', region:'europe', cap:{avg:4100, lo:3520, hi:5900}, fo:{avg:2500, lo:1850, hi:3400}, taxFree:false, conf:'medium' },
  'tap':             { ja:'TAPポルトガル航空', en:'TAP Air Portugal', region:'europe',                                           cap:{avg:2240, lo:1720, hi:3100}, fo:{avg:1120, lo:780, hi:1550}, taxFree:false, conf:'medium' },
  'virgin-atlantic': { ja:'ヴァージン・アトランティック航空', en:'Virgin Atlantic', region:'europe',                             cap:{avg:3600, lo:2830, hi:4600}, fo:{avg:1920, lo:1510, hi:2420}, taxFree:false, conf:'medium' },
  'vueling':         { ja:'ブエリング航空', en:'Vueling Airlines', region:'europe',                                              cap:{avg:1720, lo:1200, hi:2400}, fo:{avg:950, lo:690, hi:1380}, taxFree:false, conf:'medium' },
  'wizz-air':        { ja:'ウィズ・エアー', en:'Wizz Air UK', region:'europe',                                                   cap:{avg:2400, lo:1860, hi:3300}, fo:{avg:1120, lo:720, hi:1720}, taxFree:false, conf:'medium' },

  // 米州・オセアニア
  'aeromexico':      { ja:'アエロメヒコ航空', en:'Aeromexico', region:'latam',                                                   cap:{avg:2300, lo:1700, hi:2900}, fo:{avg:1200, lo:850,  hi:1700}, taxFree:false, conf:'low' },
  'air-new-zealand': { ja:'ニュージーランド航空', en:'Air New Zealand', region:'oceania',                                        cap:{avg:3300, lo:2500, hi:4000}, fo:{avg:1750, lo:1150, hi:2300}, taxFree:false, conf:'medium' },
  'alaska-airlines': { ja:'アラスカ航空', en:'Alaska Airlines', region:'us',                                                     cap:{avg:4900, lo:3800, hi:5800}, fo:{avg:2850, lo:1700, hi:3600}, taxFree:false, conf:'medium' },
  'allegiant':       { ja:'アレジアント航空', en:'Allegiant Air', region:'us',                                                   cap:{avg:3000, lo:2600, hi:3600}, fo:{avg:1700, lo:900,  hi:2400}, taxFree:false, conf:'medium' },
  'avianca':         { ja:'アビアンカ航空', en:'Avianca', region:'latam',                                                        cap:{avg:1700, lo:1200, hi:2400}, fo:{avg:850,  lo:550,  hi:1300}, taxFree:false, conf:'low' },
  'breeze-airways':  { ja:'ブリーズ・エアウェイズ', en:'Breeze Airways', region:'us',                                            cap:{avg:3400, lo:3200, hi:4400}, fo:{avg:1900, lo:1650, hi:2500}, taxFree:false, conf:'medium' },
  'copa-airlines':   { ja:'コパ航空', en:'Copa Airlines', region:'latam',                                                        cap:{avg:2300, lo:1700, hi:3000}, fo:{avg:1200, lo:850,  hi:1700}, taxFree:false, conf:'low' },
  'fiji-airways':    { ja:'フィジー・エアウェイズ', en:'Fiji Airways', region:'oceania',                                         cap:{avg:1700, lo:1400, hi:2400}, fo:{avg:1050, lo:800,  hi:1600}, taxFree:false, conf:'low' },
  'frontier':        { ja:'フロンティア航空', en:'Frontier Airlines', region:'us',                                               cap:{avg:3300, lo:2600, hi:4300}, fo:{avg:1750, lo:1100, hi:2200}, taxFree:false, conf:'medium' },
  'jetblue':         { ja:'ジェットブルー航空', en:'JetBlue Airways', region:'us',                                               cap:{avg:4200, lo:3500, hi:4700}, fo:{avg:2400, lo:1500, hi:3000}, taxFree:false, conf:'medium' },
  'jetstar':         { ja:'ジェットスター航空', en:'Jetstar Airways (Jetstar)', region:'oceania',                                cap:{avg:2400, lo:1900, hi:3100}, fo:{avg:1350, lo:950,  hi:1750}, taxFree:false, conf:'medium' },
  'latam':           { ja:'LATAM航空', en:'LATAM Airlines', region:'latam',                                                      cap:{avg:1900, lo:1200, hi:2700}, fo:{avg:950,  lo:550,  hi:1500}, taxFree:false, conf:'low' },
  'porter':          { ja:'ポーター航空', en:'Porter Airlines', region:'us',                                                     cap:{avg:2700, lo:2300, hi:3200}, fo:{avg:1350, lo:1000, hi:1700}, taxFree:false, conf:'medium' },
  'spirit':          { ja:'スピリット航空', en:'Spirit Airlines', region:'us',                                                   cap:{avg:3700, lo:2900, hi:4700}, fo:{avg:2000, lo:1300, hi:3000}, taxFree:false, conf:'medium' },
  'westjet':         { ja:'ウェストジェット航空', en:'WestJet Airlines', region:'us',                                            cap:{avg:3400, lo:2600, hi:4400}, fo:{avg:1800, lo:1400, hi:2200}, taxFree:false, conf:'medium' },
};

// ─────────────────────────────────────────────────────────────────────────
// 按分して入れた社（2026-08-08・オーナー判断）
//
// ■ asiana — cap:2,180 / fo:1,110（conf:'low'）
//   実数として公表されているのはここまで：
//     2023年 운항직 1,397名・給与総額 2,086億ウォン → 1人あたり 1億4,936万ウォン
//     （에너지경제신문 2024-04-29。同日 기본급 +7.5%・안전장려금 +100% の労使暫定合意も報道）
//   ₩1＝¥0.11 で 約1,643万円。**機長／副操縦士の内訳は公表されていない。**
//   そこで2つだけ仮定を置いて按分した。仮定はこの2つで全部：
//     (1) 人数構成 機長:副操縦士 ＝ 50:50
//     (2) 年収比 1.96 ＝ 大韓航空の 2,450 / 1,250 と同じ
//   → fo = 1,643 × 2 / 2.96 ≒ 1,110 ／ cap = 1,110 × 1.96 ≒ 2,180
//   検算：(2,180 + 1,110) / 2 = 1,645 ≒ 1,643。両者とも大韓航空比 88.9% に落ちる。
//   lo/hi は大韓航空の avg に対する比率（cap 75.5%/112.2%・fo 76.0%/114.4%）をそのまま当てた。
//   2024年4月の +7.5% は**上乗せしていない**（実額の公表が2023年までなので）。
//
//   ⚠️ 反証があることも書いておく：기장 승진이 대한항공보다 빠르다 という指摘があり、
//      それが正しければ (1) の 50:50 は機長側に寄り、cap は下振れ・fo は上振れする。
//      だから conf は 'low'。内訳が公表されたら按分を捨てて実数に置き換える。
//
//   ⚠️ このページには賞味期限がある。2026-12-17 に大韓航空へ統合され、
//      アシアナ航空は独立した航空会社として消滅する（同12-16 にスターアライアンス脱退、
//      翌日スカイチーム／アシアナクラブ終了）。その日以降このエントリをどう扱うかは要判断。
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// 調べたうえで「入れなかった」社（2026-08-08 時点）
//
// ここに書く理由は2つ。同じ調査を次のセッションが最初からやり直さないため。
// そして「まだ空いている＝調べていない」と誤解して推測値で埋めないため。
// 出典が公開されたら消してこの上の SALARY に入れる。
//
// ■ Condor（ドイツ）
//   VC との協約は存在し、2024年1月 +7%／2025・2026年 各 +5%／等級表を上に6段拡張／
//   一時金 計3,000ユーロ、という「率」は VC 公式・aeroTELEGRAPH・Austrian Wings で一致する。
//   だが **金額表そのものはどこも公開していない**（VC 公式のリリースに絶対額の記載が無い）。
//   二次情報の機長年収は €104K〜136K／€110K〜170K／€130K〜229K／€148.7K〜224.5K と
//   初任で 43%・上限で 70% ばらけており、どれを採っても外れる。
//   ※ Eurowings を入れられたのは等級表の実額（€74,090.50 等）が取れたから。Condor はそこが無い。
//
// ■ Discover Airlines（ドイツ）
//   給与表は「存在することだけ」確認できた。ver.di 協約（2024-07-01〜2027-12-31、操縦士 +15.7%、
//   以降 毎年 +5%）と、その前に労使協議会と結んだ Betriebsvereinbarung が VC の要求額と
//   「セント単位で一致する」ことは報じられている。**金額は未公開。**
//   唯一表を報じた airliners.de は 403 で読めない。
//
// ■ Jeju Air／T'way Air（韓国）
//   사업보고서から取れるのは**全社員平均のみ**で、操縦士の職種別が無い。
//   Jeju Air は出典間で 7,100／4,900／4,056万ウォンと食い違う（母集団の定義が違う）。
//   T'way は 2025年度を当初 1億3,700万ウォンと開示して 6,900万ウォンへ訂正した経緯がある
//   （上昇率も 110.77% → 6.15%、社員数も TAS を除外して 3,805 → 3,380 に訂正）。
//   この系統の数字は特に慎重に扱う。
// ─────────────────────────────────────────────────────────────────────────

// 表示ヘルパ（¥万表記）。
export const man = (n) => '¥' + n.toLocaleString('en-US') + '万';
export const range = (o) => `¥${o.lo.toLocaleString('en-US')}万〜¥${o.hi.toLocaleString('en-US')}万`;
export const rangeJP = (o) => `${o.lo.toLocaleString('en-US')}万〜${o.hi.toLocaleString('en-US')}万円`;

// ─────────────────────────────────────────────────────────────────────────
// レベリング・グリッド用モデル（Levels.fyi 型の比較UIに供給）
// 全社共通の「背骨」8段（年次×役職）へ各社の実額を割り付ける。数値の唯一の正は
// 上の SALARY。ここは SALARY から機械的に導出するだけで、新しい数字は捏造しない。
//  - ANA/JAL は各社ページで現役監修済みの「年次別年収推移」実数を authored として使用。
//  - 他社は cap/fo の lo–hi レンジを年次3段にスライスした【推計 est】。
//  - 役職段は数値を作らず collect（＝「データ募集中」）とし、現役の実投稿で埋める。
// ─────────────────────────────────────────────────────────────────────────

// 背骨：cadet→mgmt の昇順。UIは上下反転して「役職＝最上段／訓練生＝最下段」で描く。
export const SPINE = [
  { key:'cadet',    label:'訓練生',          years:'〜2年',    rank:'訓練生',   tone:'train' },
  { key:'fo_early', label:'副操縦士 前期',    years:'3–5年',   rank:'副操縦士', tone:'fo'    },
  { key:'fo_mid',   label:'副操縦士 中堅',    years:'6–10年',  rank:'副操縦士', tone:'fo'    },
  { key:'fo_snr',   label:'副操縦士 シニア',  years:'11–15年', rank:'副操縦士', tone:'fo'    },
  { key:'cap_new',  label:'機長 昇格',        years:'15–18年', rank:'機長',     tone:'cap'   },
  { key:'cap_mid',  label:'機長 中堅',        years:'19–24年', rank:'機長',     tone:'cap'   },
  { key:'cap_snr',  label:'シニア機長',       years:'25年〜',  rank:'機長',     tone:'cap'   },
  { key:'mgmt',     label:'役職（査察・教官・管理）', years:'—', rank:'役職',   tone:'mgmt'  },
];

// ANA/JAL：各社ページ監修済みの「年次別年収推移」実数（万円）。[lo, hi]。
// ana.html / jal.html の7段テーブルと一致（両社同一テーブル）。
const AUTHORED_JP_LADDER = {
  cadet:[400,700], fo_early:[1100,1400], fo_mid:[1400,1800], fo_snr:[1700,2100],
  cap_new:[2000,2400], cap_mid:[2400,2700], cap_snr:[2700,3500],
};
export const LADDER_OVERRIDE = { ana: AUTHORED_JP_LADDER, jal: AUTHORED_JP_LADDER };

// lo–hi を「前期/中堅/シニア」の3段（右肩上がり・一部オーバーラップ）にスライス。
const round10 = (n) => Math.round(n / 10) * 10;
function sliceThirds(lo, hi) {
  const s = hi - lo;
  const seg = (a, b) => ({ lo: round10(lo + s * a), hi: round10(lo + s * b) });
  return [seg(0, 0.45), seg(0.28, 0.72), seg(0.55, 1)];
}

// SALARY 1社分から背骨ラダーを推計生成（est）。fo→副操3段、cap→機長3段。
export function deriveLadder(d) {
  const [fe, fm, fs] = sliceThirds(d.fo.lo, d.fo.hi);
  const [cn, cm, cs] = sliceThirds(d.cap.lo, d.cap.hi);
  return {
    cadet:    { lo: Math.max(300, round10(d.fo.lo * 0.30)), hi: Math.max(450, round10(d.fo.lo * 0.50)), kind:'est' },
    fo_early: { ...fe, kind:'est' }, fo_mid: { ...fm, kind:'est' }, fo_snr: { ...fs, kind:'est' },
    cap_new:  { ...cn, kind:'est' }, cap_mid:{ ...cm, kind:'est' }, cap_snr:{ ...cs, kind:'est' },
    mgmt:     { kind:'collect' },
  };
}

// slug の確定ラダー：監修実数(authored)があれば優先、無ければ推計(est)。
export function ladderFor(slug, d) {
  const ov = LADDER_OVERRIDE[slug];
  if (ov) {
    const o = {};
    for (const k of Object.keys(ov)) o[k] = { lo: ov[k][0], hi: ov[k][1], kind:'authored' };
    o.mgmt = { kind:'collect' };
    return o;
  }
  return deriveLadder(d);
}

// ブラウザ供給用ペイロード（gen-salary-json.mjs が JSON 化し world-airlines が fetch）。
// SALARY を全て含めた上で各社に ladder を付与。SSOT から機械導出のみ。
export function buildSalaryJson() {
  const airlines = {};
  for (const [slug, d] of Object.entries(SALARY)) {
    airlines[slug] = { ...d, ladder: ladderFor(slug, d) };
  }
  return { spine: SPINE, airlines };
}

export default SALARY;
