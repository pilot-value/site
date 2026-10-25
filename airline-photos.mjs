/* 航空機の写真の台帳（2026-10-03）。
 *
 * 写真は assets/airlines/ に置く。**ここに書いていない写真を置かない**
 * （出所とライセンスが分からない写真は使えない）。
 *
 * ・鍵は salary-data.mjs の SALARY と同じ slug。**SALARY には足さない**
 *   （あちらは gen-salary-json.mjs が丸ごと公開 JSON に展開する）。
 * ・各社の1枚目が画面に出る写真。2枚目以降は共有カードの段で選べるように置いてある。
 * ・aircraft は**写真に写っている機種**。年収の対象機種とは別物なので、
 *   写真の説明（alt）にしか使わない。
 * ・w / h は書き出した大きい方の画素数。gen-career.mjs は <img width height> を
 *   ここから書く（画像ファイルを読まない ── assert-generated.mjs は画像の無い
 *   コピーの中で流すので、読むと必ず落ちる）。
 *   小さい方は幅 480・ファイル名の後ろに -480。
 * ・写真は import-airline-photos.mjs でキャンバスに描き直して書き出したもの。
 *   撮影情報（位置・機材・作者名のタグ）は1つも残っていない。
 *   **元のファイルをそのまま置かない**（assert-no-pii.mjs の B が落とす）。
 *
 * クレジット：CC BY / CC BY-SA は「作者名とライセンス名を示すこと」が使う条件。
 * 画面のクレジットはここから機械で書く（needsCredit）。CC0 には出さない。
 */

export const PHOTO_DIR = 'assets/airlines';
export const SMALL_W = 480;
const CHANGES = '縮小・トリミング';

const BY_SA_2 = { licence: 'CC BY-SA 2.0', licence_url: 'https://creativecommons.org/licenses/by-sa/2.0' };
const BY_4    = { licence: 'CC BY 4.0',    licence_url: 'https://creativecommons.org/licenses/by/4.0' };
const CC0     = { licence: 'CC0',          licence_url: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en' };
/* ★2026-10-25（先行5社のほかの102社の写真・どれも Wikimedia Commons）で足した4つ。
   Public domain は作者が権利を放棄した写真（2つは出どころの印の違いだけ）。needsCredit は CC0 のほかに出すので、
   この2つにもクレジットが出る（出しても問題は無い）。 */
const BY_2    = { licence: 'CC BY 2.0',    licence_url: 'https://creativecommons.org/licenses/by/2.0' };
const BY_SA_4 = { licence: 'CC BY-SA 4.0', licence_url: 'https://creativecommons.org/licenses/by-sa/4.0' };
const PD_MARK = { licence: 'Public domain', licence_url: 'https://creativecommons.org/publicdomain/mark/1.0/' };
const PD_SELF = { licence: 'Public domain', licence_url: 'https://commons.wikimedia.org/wiki/Template:PD-self' };

export const PHOTOS = {
  jal: [
    { file: 'jal-b787', orig: 'airline-jal.jpg', aircraft: 'Boeing 787-9', w: 960, h: 540,
      author: '4300streetcar', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Japan_Airlines_Boeing_787-9_JA881J_on_final_approach_to_Boston_April_2022.jpg' },
    { file: 'jal-a350', orig: 'airline-jal-a350.jpg', aircraft: 'Airbus A350-1000', w: 1280, h: 853,
      author: 'Melvin Loi', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Japan_Airlines_A350-1000_JA01WJ.jpg' },
  ],
  ana: [
    { file: 'ana-b777', orig: 'airline-ana-b777.jpg', aircraft: 'Boeing 777-300ER', w: 1280, h: 853,
      author: 'Masakatsu Ukon', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:All_Nippon_Airways,_Boeing_777-300ER_JA792A_NRT_(26845813980).jpg' },
    { file: 'ana-b787', orig: 'airline-ana.jpg', aircraft: 'Boeing 787-8', w: 960, h: 640,
      author: '玄史生', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:ANA_Boeing_787-8_JA802A_on_Final_Approach_at_Taipei_Songshan_Airport_20150908_(cropped).jpg' },
  ],
  'cathay-pacific': [
    { file: 'cathay-a350', orig: 'airline-cathay.jpg', aircraft: 'Airbus A350-1000', w: 960, h: 640,
      author: 'Melv_L - MACASR', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Cathay_Pacific_Airbus_A350-1000_B-LXB.jpg' },
    { file: 'cathay-a330', orig: 'airline-cathay-a330.jpg', aircraft: 'Airbus A330-300', w: 1280, h: 853,
      author: 'Melv_L - MACASR', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Cathay_Pacific_Airbus_A330-300_B-HLF.jpg' },
  ],
  etihad: [
    { file: 'etihad-a350', orig: 'airline-etihad-a350-flight.jpg', aircraft: 'Airbus A350-1000', w: 1200, h: 800,
      author: 'Anna Zvereva', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Etihad_Airways,_A6-XWA,_Airbus_A350-1041.jpg' },
    { file: 'etihad-b787', orig: 'airline-etihad.jpg', aircraft: 'Boeing 787-9', w: 960, h: 640,
      author: 'Anna Zvereva', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Etihad_Airways,_A6-BLY,_Boeing_787-9_Dreamliner_(51855158314).jpg' },
    { file: 'etihad-a350-jfk', orig: 'airline-etihad-a350.jpg', aircraft: 'Airbus A350-1000', w: 1280, h: 960,
      author: 'Charles from Port Chester, New York', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Etihad_Airways_A350-1041,_A6-XWL,_MSN_762_(11_2025),_as_EY_2_New_York_(JFK)_-_Abu_Dhabi_(AUH),_Flight_time_11_33_(55082822682).jpg' },
  ],
  'eva-air': [
    { file: 'eva-b777', orig: 'airline-eva-b777.jpg', aircraft: 'Boeing 777-300ER', w: 1280, h: 853,
      author: 'Melv_L - MACASR', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Eva_Air_Boeing_777-300ER_B-16716.jpg' },
    { file: 'eva-b787', orig: 'airline-eva.jpg', aircraft: 'Boeing 787-9', w: 960, h: 640,
      author: 'Melvin Loi', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Eva_Air_Boeing_787-9_B-17882.jpg' },
  ],
  /* ★2026-10-25 ここから下は、先行5社のほかの102社（1社1枚・どれも Wikimedia Commons）。見送った4社
     （新日本航空・Eagle Jet International・Root Aviation・Solairus Aviation）は、その会社の機体と言える写真が無い。
     スピリット航空は外す話が保留中なので置かない。 */
  zipair: [
    { file: 'zipair-b787', orig: 'airline-zipair.jpg', aircraft: 'Boeing 787-8', w: 1280, h: 720,
      author: 'S5A-0043', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:(JPN-Chiba)_ZIPAIR_Tokyo_Boeing_787-8_JA824J_@_RJAA_2026-06-12.jpg' },
  ],
  'jetstar-japan': [
    { file: 'jetstar-japan-a321neo', orig: 'airline-jetstar-japan.jpg', aircraft: 'Airbus A321neo', w: 1280, h: 720,
      author: '4300streetcar', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Jetstar_Japan_Airbus_A321neo_JA28LR_on_final_approach_to_Taoyuan_February_2026.jpg' },
  ],
  peach: [
    { file: 'peach-a320', orig: 'airline-peach.jpg', aircraft: 'Airbus A320', w: 1280, h: 720,
      author: 'S5A-0043', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:(JPN-Hokkaido)_Peach_Airbus_A320-214_JA10VA_@_RJCC_2026-06-04.jpg' },
  ],
  solaseed: [
    { file: 'solaseed-b737', orig: 'airline-solaseed.jpg', aircraft: 'Boeing 737-800', w: 1280, h: 720,
      author: 'S5A-0043', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:(JPN-Tokyo)_Solaseed_Air_Boeing_737-86N_JA813X_@_RJTT_2026-06-09.jpg' },
  ],
  'spring-japan': [
    { file: 'spring-japan-b737', orig: 'airline-spring-japan.jpg', aircraft: 'Boeing 737-800', w: 1280, h: 720,
      author: 'S5A-0043', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:(JPN-Chiba)_Spring_Japan_Boeing_737-86N_JA02GR_@_RJAA_2026-06-12.jpg' },
  ],
  airdo: [
    { file: 'airdo-b767', orig: 'airline-airdo.jpg', aircraft: 'Boeing 767-300ER', w: 1280, h: 853,
      author: 'SuFlyer', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Air_Do_Boeing_767-300ER_JA613A_2023-08-27.jpg' },
  ],
  starflyer: [
    { file: 'starflyer-a320', orig: 'airline-starflyer.jpg', aircraft: 'Airbus A320', w: 1280, h: 720,
      author: 'S5A-0043', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:(JPN-Tokyo)_StarFlyer_Airbus_A320-214_JA20MC_@_RJTT_2026-06-09.jpg' },
  ],
  skymark: [
    { file: 'skymark-b737max', orig: 'airline-skymark.jpg', aircraft: 'Boeing 737 MAX 8', w: 1280, h: 720,
      author: 'S5A-0043', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:(JPN-Tokyo)_Skymark_Airlines_Boeing_737_MAX_8_JA738A_@_RJTT_2026-06-10.jpg' },
  ],
  fda: [
    { file: 'fda-e175', orig: 'airline-fda.jpg', aircraft: 'Embraer 175', w: 1280, h: 720,
      author: 'S5A-0043', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:(JPN-Hokkaido)_Fuji_Dream_Airlines_Embraer_ERJ-175STD_JA14FJ_@_RJCC_2026-06-04.jpg' },
  ],
  emirates: [
    { file: 'emirates-b777', orig: 'airline-emirates.jpg', aircraft: 'Boeing 777-300ER', w: 1280, h: 720,
      author: 'S5A-0043', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:(SGP-Singapore)_Emirates_Boeing_777-31HER_A6-EGU_@_WSSS_2026-09-03.jpg' },
  ],
  qantas: [
    { file: 'qantas-a330', orig: 'airline-qantas.jpg', aircraft: 'Airbus A330-300', w: 1280, h: 720,
      author: 'S5A-0043', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:(SGP-Singapore)_Qantas_Airbus_A330-302_VH-QPK_@_WSSS_2026-09-03.jpg' },
  ],
  'singapore-airlines': [
    { file: 'singapore-airlines-b777', orig: 'airline-singapore-airlines.jpg', aircraft: 'Boeing 777-300ER', w: 1280, h: 853,
      author: 'Alan Wilson from Peterborough, Cambs, UK', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Boeing_777-312ER_‘9V-SWP’_Singapore_Airlines_(52149815954).jpg' },
  ],
  'qatar-airways': [
    { file: 'qatar-airways-b787', orig: 'airline-qatar-airways.jpg', aircraft: 'Boeing 787-8', w: 1280, h: 720,
      author: 'Julian Herzog', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Qatar_Airways_Boeing_787-8_Dreamliner_A7-BCO_MUC_2015_02.jpg' },
  ],
  'korean-air': [
    { file: 'korean-air-b747', orig: 'airline-korean-air.jpg', aircraft: 'Boeing 747-8', w: 1280, h: 853,
      author: 'Glenn Beltz', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Korean_Air_Boeing_747-8_Approaching_LAX_(2_of_2)_(55432063341)_-_cropped.jpg' },
  ],
  asiana: [
    { file: 'asiana-a350', orig: 'airline-asiana.jpg', aircraft: 'Airbus A350-900', w: 1280, h: 853,
      author: 'Aubrey', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Asiana_Airlines_-_HL7771_-_OZ521_(ICN-LHR).jpg' },
  ],
  starlux: [
    { file: 'starlux-a350', orig: 'airline-starlux.jpg', aircraft: 'Airbus A350-900', w: 1280, h: 853,
      author: "DUNCAN KIRK from Coeur d'Alene, United States", ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:B-58508_A350-900,_STARLUX,_Taipei_Taoyuan_11-09-25_(55045836027).jpg' },
  ],
  'china-airlines': [
    { file: 'china-airlines-b777', orig: 'airline-china-airlines.jpg', aircraft: 'Boeing 777-300ER', w: 1280, h: 853,
      author: '4300streetcar', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:China_Airlines_Boeing_777-300ER_B-18051_taking_off_from_Taoyuan_February_2026.jpg' },
  ],
  'thai-airways': [
    { file: 'thai-airways-a350', orig: 'airline-thai-airways.jpg', aircraft: 'Airbus A350-900', w: 1280, h: 853,
      author: 'Alan Wilson from Peterborough, Cambs, UK', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Airbus_A350-941_‘HS-THJ’_Thai_Airways_International_(52474123338).jpg' },
  ],
  united: [
    { file: 'united-b737max', orig: 'airline-united.jpg', aircraft: 'Boeing 737 MAX 9', w: 1280, h: 839,
      author: 'Charles from Port Chester, New York', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:United_Airlines_B737-9MAX,_N17429,_MSN_9471_(01_2026),_as_UA_2377_Los_Angeles_(LAX)_-_Houston_(IAH),_Flight_time_2_47_(55282363776).jpg' },
  ],
  delta: [
    { file: 'delta-a330', orig: 'airline-delta.jpg', aircraft: 'Airbus A330-300', w: 1280, h: 961,
      author: 'Alf van Beem', ...PD_SELF, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:N819NW_Delta_Air_Lines_Airbus_A330-323_takeoff_from_Schiphol_(AMS_-_EHAM),_The_Netherlands_pic1.JPG' },
  ],
  american: [
    { file: 'american-a321', orig: 'airline-american.jpg', aircraft: 'Airbus A321', w: 1280, h: 820,
      author: 'Charles', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:American_Airlines_A321-231,_N158AN,_MSN_7009_(03_2016),_as_AA_3334_Los_Angeles_(LAX)_-_Dallas_(DFW),_Flight_time_2_28_(55269650518).jpg' },
  ],
  southwest: [
    { file: 'southwest-b737max', orig: 'airline-southwest.jpg', aircraft: 'Boeing 737 MAX 8', w: 1280, h: 854,
      author: 'Liam Thompson', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Southwest_Airlines_Boeing_737_MAX_8_N9002W_departing_Long_Beach.jpg' },
  ],
  klm: [
    { file: 'klm-a350', orig: 'airline-klm.jpg', aircraft: 'Airbus A350-900', w: 1280, h: 720,
      author: 'Mees Jansen', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Airbus_A350-941XWB_KLM_Royal_Dutch_Airlines_-_PH-ZNA.jpg' },
  ],
  'air-france': [
    { file: 'air-france-a350', orig: 'airline-air-france.jpg', aircraft: 'Airbus A350-900', w: 1280, h: 853,
      author: 'Steven He', ...PD_MARK, changes: CHANGES,
      source: "https://commons.wikimedia.org/wiki/File:Air_France_A350-900_at_Toronto_Pearson_Int'l_Airport.jpg" },
  ],
  lufthansa: [
    { file: 'lufthansa-a380', orig: 'airline-lufthansa.jpg', aircraft: 'Airbus A380-800', w: 1280, h: 846,
      author: 'Charles from Port Chester, New York', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Lufthansa_A380-841,_D-AIMB,_named_München,_MSN_41_(01_2010),_as_LH_452_München_(MUC)_-_Los_Angeles_(LAX),_Flight_time_11_25_(55279529312).jpg' },
  ],
  'air-canada': [
    { file: 'air-canada-a220', orig: 'airline-air-canada.jpg', aircraft: 'Airbus A220-300', w: 1280, h: 768,
      author: 'Quintin Soloviev', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Air_Canada_A220-300_at_CYYG.jpg' },
  ],
  'british-airways': [
    { file: 'british-airways-b777', orig: 'airline-british-airways.jpg', aircraft: 'Boeing 777-300ER', w: 1280, h: 833,
      author: 'Charles from Port Chester, New York', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:British_Airways_B777-336(ER),_G-STBM,_MSN_1667_(09_2020),_as_BA_282_Los_Angeles_(LAX)_-_London_(LHR),_Flight_time_10_09_(55273462803).jpg' },
  ],
  airjapan: [
    { file: 'airjapan-b787', orig: 'airline-airjapan.jpg', aircraft: 'Boeing 787-8', w: 1280, h: 853,
      author: 'Mitchul Hope', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Air_Japan_(JA803A)_Boeing_787-8_Dreamliner_at_Narita_International_Airport_(NRT).jpg' },
  ],
  amx: [
    { file: 'amx-atr42', orig: 'airline-amx.jpg', aircraft: 'ATR 42-600', w: 1280, h: 853,
      author: 'lasta29', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Amakusa_Airlines,_ATR_42,_JA01AM_(25195777673)_(2).jpg' },
  ],
  'ana-wings': [
    { file: 'ana-wings-q400', orig: 'airline-ana-wings.jpg', aircraft: 'De Havilland Canada Dash 8-400', w: 1280, h: 720,
      author: 'S5A-0043', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:(JPN-Hyogo)_ANA_Wings_De_Havilland_Canada_DHC-8-402Q_JA463A_@_RJOO_2024-11-18_-_2.jpg' },
  ],
  'daiichi-air': [
    { file: 'daiichi-air-dhc6', orig: 'airline-daiichi-air.jpg', aircraft: 'De Havilland Canada DHC-6 Twin Otter', w: 1280, h: 960,
      author: 'ブルーノ・プラス', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:First_aviation_spot_at_New_Ishigaki_Airport.jpg' },
  ],
  hac: [
    { file: 'hac-atr42', orig: 'airline-hac.jpg', aircraft: 'ATR 42-600', w: 1280, h: 720,
      author: 'S5A-0043', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:(JPN-Hokkaido)_Hokkaido_Air_System_ATR_42-600_JA13HC_@_RJCH_2026-06-09.jpg' },
  ],
  ibex: [
    { file: 'ibex-crj700', orig: 'airline-ibex.jpg', aircraft: 'Bombardier CRJ700', w: 1280, h: 853,
      author: 'Alan Wilson from Peterborough, Cambs, UK', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Bombardier_CRJ-702_‘JA09RJ’_IBEX_Airlines_(47001512774).jpg' },
  ],
  'j-air': [
    { file: 'j-air-e170', orig: 'airline-j-air.jpg', aircraft: 'Embraer 170', w: 1280, h: 850,
      author: 'contri', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:J-Air_Embraer_ERJ-170-100_(ERJ-170STD)_(JA217J_17000308)_(54851981094).jpg' },
  ],
  jac: [
    { file: 'jac-atr42', orig: 'airline-jac.jpg', aircraft: 'ATR 42-600', w: 1280, h: 812,
      author: '湯小沅', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:JA05JC,_2018-07-04.jpg' },
  ],
  jta: [
    { file: 'jta-b737', orig: 'airline-jta.jpg', aircraft: 'Boeing 737-800', w: 1280, h: 720,
      author: 'S5A-0043', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:(JPN-Tokyo)_Japan_Transocean_Air_Boeing_737-8Q3_JA10RK_@_RJTT_2026-06-09.jpg' },
  ],
  orc: [
    { file: 'orc-q200', orig: 'airline-orc.jpg', aircraft: 'De Havilland Canada Dash 8-200', w: 1280, h: 758,
      author: 'ブルーノ', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:ORC.DHC-8-200.jpg' },
  ],
  rac: [
    { file: 'rac-q400', orig: 'airline-rac.jpg', aircraft: 'De Havilland Canada Dash 8-400 (Q400CC)', w: 1280, h: 854,
      author: 'muroi8210', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Ryukyu_Air_Commuter_Bombardier_DHC8-Q400CC_(JA82RC)_(cropped).jpg' },
  ],
  'shin-central': [
    { file: 'shin-central-do228', orig: 'airline-shin-central.jpg', aircraft: 'Dornier 228', w: 1280, h: 853,
      author: 'Kentaro IEMOTO from Tokyo, Japan', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:New_Central_Air_Service_Do-228NG(JA34CA)_(9171121809).jpg' },
  ],
  'toho-air': [
    { file: 'toho-air-as350', orig: 'airline-toho-air.jpg', aircraft: 'Eurocopter AS350', w: 1280, h: 957,
      author: 'Josephus37', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Eurocopter_AS350_Écureuil_JA506E_operated_by_Toho_Air_Service.jpg' },
  ],
  'toki-air': [
    { file: 'toki-air-atr42', orig: 'airline-toki-air.jpg', aircraft: 'ATR 42-600', w: 1280, h: 869,
      author: 'Kanadi1700', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Toki_Air_ATR42-600(JA03QQ)_RJGG.jpg' },
  ],
  'air-china': [
    { file: 'air-china-a321', orig: 'airline-air-china.jpg', aircraft: 'Airbus A321', w: 1280, h: 853,
      author: '4300streetcar', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Air_China_Airbus_A321_B-6741_at_Taoyuan_February_2026_1.jpg' },
  ],
  'china-eastern': [
    { file: 'china-eastern-b777', orig: 'airline-china-eastern.jpg', aircraft: 'Boeing 777-300ER', w: 1280, h: 720,
      author: 'Tim', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:China_Eastern_777-300_at_LGW.jpg' },
  ],
  'china-southern': [
    { file: 'china-southern-a330', orig: 'airline-china-southern.jpg', aircraft: 'Airbus A330-300', w: 1280, h: 853,
      author: '4300streetcar', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:China_Southern_Airlines_Airbus_A330-300_B-5917_at_Taoyuan_February_2026.jpg' },
  ],
  'hainan-airlines': [
    { file: 'hainan-airlines-b787', orig: 'airline-hainan-airlines.jpg', aircraft: 'Boeing 787-9', w: 1280, h: 853,
      author: '4300streetcar', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Hainan_Boeing_787-9_B-7837_landing_on_Runway_22L_at_Boston_Dec_2024.jpg' },
  ],
  'airx-charter': [
    { file: 'airx-charter-lineage1000', orig: 'airline-airx-charter.jpg', aircraft: 'Embraer Lineage 1000', w: 1280, h: 886,
      author: 'simon butler from halesowen, uk', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:AIR_X_CHARTER_EMBRAER_E190CJ_LINEAGE_1000_9H-FCM_(52126223539).jpg' },
  ],
  'air-india': [
    { file: 'air-india-a350', orig: 'airline-air-india.jpg', aircraft: 'Airbus A350-900', w: 1280, h: 925,
      author: 'simon butler', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:VT-JRE_@_LHR,_2024-10-27.jpg' },
  ],
  airasia: [
    { file: 'airasia-a320', orig: 'airline-airasia.jpg', aircraft: 'Airbus A320', w: 1280, h: 800,
      author: '4300streetcar', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:AirAsia_Airbus_A320_9M-RAT_at_Taoyuan_February_2026_2.jpg' },
  ],
  'bamboo-airways': [
    { file: 'bamboo-airways-b787', orig: 'airline-bamboo-airways.jpg', aircraft: 'Boeing 787-9', w: 1280, h: 853,
      author: 'Colin Cooke Photo', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:VN-A819_Boeing_787-9_Bamboo_Airways_LHR_23.3.22.jpg' },
  ],
  'batik-air': [
    { file: 'batik-air-b737', orig: 'airline-batik-air.jpg', aircraft: 'Boeing 737-800', w: 1280, h: 720,
      author: 'S5A-0043', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:(SGP-Singapore)_Batik_Air_Malaysia_Boeing_737-86N_9M-LDT_@_WSSS_2026-01-29.jpg' },
  ],
  'garuda-indonesia': [
    { file: 'garuda-indonesia-b777', orig: 'airline-garuda-indonesia.png', aircraft: 'Boeing 777-300ER', w: 1280, h: 720,
      author: 'Arthur Chi Yen', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Boeing_777-300ER_Garuda_Indonesia_PK-GIK.png' },
  ],
  'hong-kong-express': [
    { file: 'hong-kong-express-a321neo', orig: 'airline-hong-kong-express.jpg', aircraft: 'Airbus A321neo', w: 1280, h: 854,
      author: 'Dltl2010', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:B-KKD_(13_Feb_2024).jpg' },
  ],
  indigo: [
    { file: 'indigo-a320neo', orig: 'airline-indigo.jpg', aircraft: 'Airbus A320neo family', w: 1280, h: 853,
      author: 'Jubair Bin Iqbal', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:IndiGo_Airline.jpg' },
  ],
  'malaysia-airlines': [
    { file: 'malaysia-airlines-a350', orig: 'airline-malaysia-airlines.jpg', aircraft: 'Airbus A350-900', w: 1280, h: 841,
      author: 'Charles from Port Chester, New York', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Malaysia_Airlines_A350-941,_9M-MAD,_MSN_183_(01_2018),_as_MH_4_Kuala_Lumpur_(KUL)_-_London_(LHR),_Flight_time_12_49_(53208404335).jpg' },
  ],
  'philippine-airlines': [
    { file: 'philippine-airlines-b777', orig: 'airline-philippine-airlines.jpg', aircraft: 'Boeing 777-300ER', w: 1280, h: 720,
      author: '4300streetcar', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Philippines_Airlines_Boeing_777-300ER_RP-C7773_departing_Taoyuan_February_2026_1.jpg' },
  ],
  scoot: [
    { file: 'scoot-a320neo', orig: 'airline-scoot.jpg', aircraft: 'Airbus A320neo', w: 1280, h: 720,
      author: 'S5A-0043', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:(SGP-Singapore)_Scoot_Airbus_A320-271N_9V-TNG_@_WSSS_2026-03-11.jpg' },
  ],
  vietjet: [
    { file: 'vietjet-a321neo', orig: 'airline-vietjet.jpg', aircraft: 'Airbus A321neo', w: 1280, h: 720,
      author: 'S5A-0043', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:(VNM-Ho_Chi_Minh_City)_VietJet_Air_Airbus_A321-271N_VN-A653_@_VVTS_2025-10-08.jpg' },
  ],
  'vietnam-airlines': [
    { file: 'vietnam-airlines-b787', orig: 'airline-vietnam-airlines.jpg', aircraft: 'Boeing 787-10', w: 1280, h: 720,
      author: 'S5A-0043', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:(JPN-Chiba)_Vietnam_Airlines_Boeing_787-10_VN-A873_@_RJAA_2026-06-13.jpg' },
  ],
  egyptair: [
    { file: 'egyptair-a321neo', orig: 'airline-egyptair.jpg', aircraft: 'Airbus A321neo', w: 1280, h: 853,
      author: 'Ian Gratton', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:SU-GFT_Airbus_A321-251N_Egyptair,_Manchester.jpg' },
  ],
  'ethiopian-airlines': [
    { file: 'ethiopian-airlines-a350', orig: 'airline-ethiopian-airlines.jpg', aircraft: 'Airbus A350', w: 1280, h: 853,
      author: 'Oscaracton', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:ET-ATR_Ethiopian_Airlines_A350-EGCC.jpg' },
  ],
  'gulf-air': [
    { file: 'gulf-air-b787', orig: 'airline-gulf-air.jpg', aircraft: 'Boeing 787-9', w: 1280, h: 742,
      author: 'Charles from Port Chester, New York', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Gulf_Air_B787-9P6,_A9C-FF,_MSN_803_(01_2019),_as_GF_3_Bahrain_(BAH)_-_London_(LHR),_Flight_time_6_24_(54506953514).jpg' },
  ],
  'kenya-airways': [
    { file: 'kenya-airways-b787', orig: 'airline-kenya-airways.jpg', aircraft: 'Boeing 787-8', w: 1280, h: 853,
      author: 'Alan Wilson from Peterborough, Cambs, UK', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Boeing_787-8_‘5Y-KZA’_Kenya_Airways_(52182847463).jpg' },
  ],
  'kuwait-airways': [
    { file: 'kuwait-airways-b777', orig: 'airline-kuwait-airways.jpg', aircraft: 'Boeing 777-300ER', w: 1280, h: 798,
      author: 'Charles from Port Chester, New York', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Kuwait_Airways_B777-369(ER),_9K-AOC,_MSN_1448_(11_2016),_as_KU_168_Paris_(CDG)_-_Kuwait_City_(KWI),_Flight_time_5_21_(54508325799).jpg' },
  ],
  'oman-air': [
    { file: 'oman-air-b787', orig: 'airline-oman-air.jpg', aircraft: 'Boeing 787-9', w: 1280, h: 816,
      author: 'simon butler from halesowen, uk', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:OMAN_AIR_BOEING_787-9_A4O-SF_(52893946957).jpg' },
  ],
  'riyadh-air': [
    { file: 'riyadh-air-b787', orig: 'airline-riyadh-air.jpg', aircraft: 'Boeing 787-9', w: 1280, h: 853,
      author: 'Colin Cooke Photo', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:HZ-RXX_Boeing_787-9_Dreamliner_Riyadh_Air_LHR_4.1.26_(55027255204).jpg' },
  ],
  'royal-brunei': [
    { file: 'royal-brunei-b787', orig: 'airline-royal-brunei.jpg', aircraft: 'Boeing 787-8', w: 1280, h: 853,
      author: 'トりン', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:V8-DLA_Royal_Brunei_Boeing_787-8_Dreamliner_YMML.jpg' },
  ],
  'royal-jordanian': [
    { file: 'royal-jordanian-a320', orig: 'airline-royal-jordanian.jpg', aircraft: 'Airbus A320', w: 1280, h: 849,
      author: 'Ian Gratton', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:JY-AZD_Airbus_A320-232SL_Royal_Jordanian_Airlines,_Manchester.jpg' },
  ],
  saudia: [
    { file: 'saudia-b787', orig: 'airline-saudia.jpg', aircraft: 'Boeing 787-9', w: 1280, h: 869,
      author: 'simon butler from halesowen, uk', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:SAUDIA_BOEING_787-9_HZ-AR22_(54532852245).jpg' },
  ],
  'south-african-airways': [
    { file: 'south-african-airways-a340', orig: 'airline-south-african-airways.jpg', aircraft: 'Airbus A340-300', w: 1280, h: 853,
      author: 'N509FZ', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:ZS-SXF@HKG_(20190328180051).jpg' },
  ],
  'turkish-airlines': [
    { file: 'turkish-airlines-b787', orig: 'airline-turkish-airlines.jpg', aircraft: 'Boeing 787-9', w: 1280, h: 853,
      author: 'Siyuan He', ...PD_MARK, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Turkish_Airlines_B787-9_TC-LLK.jpg' },
  ],
  aegean: [
    { file: 'aegean-a320neo', orig: 'airline-aegean.jpg', aircraft: 'Airbus A320neo', w: 1280, h: 853,
      author: 'Ian Gratton', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:SX-NEM_Airbus_A320-271N_Aegean_Airlines,_Manchester.jpg' },
  ],
  'aer-lingus': [
    { file: 'aer-lingus-a330', orig: 'airline-aer-lingus.jpg', aircraft: 'Airbus A330-300', w: 1280, h: 853,
      author: '4300streetcar', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Aer_Lingus_Airbus_A330-300_EI-FNH_taxiing_at_Boston_July_2026.jpg' },
  ],
  austrian: [
    { file: 'austrian-b777', orig: 'airline-austrian.jpg', aircraft: 'Boeing 777-200ER', w: 1280, h: 809,
      author: 'Charles from Port Chester, New York', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Austrian_Airlines_B777-2Z9(ER),_OE-LPB,_named_Heart_of_Europe,_MSN_163_(09_1998),_as_OS_52_Los_Angeles_(LAX)_-_Vienna_(VIE),_Flight_time_11_07_(55272886684).jpg' },
  ],
  easyjet: [
    { file: 'easyjet-a319', orig: 'airline-easyjet.jpg', aircraft: 'Airbus A319', w: 1280, h: 853,
      author: 'Jorge Martyukov', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:OE-LQU_-_Airbus_A319-111_-_Easyjet.jpg' },
  ],
  eurowings: [
    { file: 'eurowings-a319', orig: 'airline-eurowings.jpg', aircraft: 'Airbus A319', w: 1280, h: 853,
      author: 'Oscaracton', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:D-AGWD_Eurowings_A319_EGPH.jpg' },
  ],
  finnair: [
    { file: 'finnair-a321', orig: 'airline-finnair.jpg', aircraft: 'Airbus A321', w: 1280, h: 853,
      author: 'Alan Wilson from Peterborough, Cambs, UK', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Airbus_A321-231_‘OH-LZH’_Finnair_(54351143649).jpg' },
  ],
  iberia: [
    { file: 'iberia-a320neo', orig: 'airline-iberia.jpg', aircraft: 'Airbus A320neo', w: 1280, h: 897,
      author: 'simon butler from halesowen, uk', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:IBERIA_AIRBUS_A320NEO_EC-MXY_(52893947262).jpg' },
  ],
  icelandair: [
    { file: 'icelandair-b737max', orig: 'airline-icelandair.jpg', aircraft: 'Boeing 737 MAX 8', w: 1280, h: 853,
      author: 'Sandro Koechli', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Icelandair_Boeing_737-8_MAX_TF-ICS_ZRH_2025_01.jpg' },
  ],
  'ita-airways': [
    { file: 'ita-airways-a350', orig: 'airline-ita-airways.jpg', aircraft: 'Airbus A350-900', w: 1280, h: 853,
      author: 'SuFlyer', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:ITA_Airways_Airbus_A350-900_EI-IFF_2023-08-27.jpg' },
  ],
  lot: [
    { file: 'lot-b787', orig: 'airline-lot.jpg', aircraft: 'Boeing 787-8', w: 1280, h: 853,
      author: 'Steven He', ...PD_MARK, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:LOT_Polish_Airlines_B787-8.jpg' },
  ],
  norwegian: [
    { file: 'norwegian-b737', orig: 'airline-norwegian.jpg', aircraft: 'Boeing 737-800', w: 1280, h: 960,
      author: 'Alf van Beem', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:EI-FHL_Norwegian_Air_International_Boeing_737-8JP(WL),_cn_42078_at_Schiphol_(AMS_-_EHAM),_Netherlands,_pic1.jpg' },
  ],
  ryanair: [
    { file: 'ryanair-b737max', orig: 'airline-ryanair.jpg', aircraft: 'Boeing 737 MAX 8-200', w: 1280, h: 854,
      author: 'DUNCAN KIRK', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:EI-IFZ_B737_MAX_8-200,_Ryanair,_Palma_De_Mallorca_09-05-26.jpg' },
  ],
  sas: [
    { file: 'sas-a320neo', orig: 'airline-sas.jpg', aircraft: 'Airbus A320neo', w: 1280, h: 960,
      author: 'BOSSHEP', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:SAS_Scandinavian_Airlines_A320-200neo_at_LHR.jpg' },
  ],
  swiss: [
    { file: 'swiss-a220', orig: 'airline-swiss.jpg', aircraft: 'Airbus A220-300', w: 1280, h: 853,
      author: 'Oscaracton', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:HB-JCC_Swiss_A220_EGCC.jpg' },
  ],
  tap: [
    { file: 'tap-a321neo', orig: 'airline-tap.jpg', aircraft: 'Airbus A321neo', w: 1280, h: 853,
      author: 'Siyuan He', ...PD_MARK, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:TAP_Air_Portugal_A321Neo_-_TP257_Lisbon_to_Toronto.jpg' },
  ],
  'virgin-atlantic': [
    { file: 'virgin-atlantic-a330', orig: 'airline-virgin-atlantic.jpg', aircraft: 'Airbus A330-900', w: 1280, h: 853,
      author: '4300streetcar', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Virgin_Atlantic_Airbus_A330-900_G-VTOM_taxiing_at_Boston_July_2026_1.jpg' },
  ],
  vueling: [
    { file: 'vueling-a320', orig: 'airline-vueling.jpg', aircraft: 'Airbus A320', w: 1280, h: 961,
      author: 'Alf van Beem', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:EC-LVA_Vueling_Airbus_A320-214_-_cn_1171_take-off_from_Schiphol_(AMS_-_EHAM),_The_Netherlands,_17may2014,_pic-4.JPG' },
  ],
  'wizz-air': [
    { file: 'wizz-air-a321neo', orig: 'airline-wizz-air.jpg', aircraft: 'Airbus A321neo', w: 1280, h: 720,
      author: 'MarcelX42', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Hamburg-Finkenwerder_Airport_Wizz_Air_UK_Airbus_A321-271NX_G-WUKX_(DSC09942).jpg' },
  ],
  aeromexico: [
    { file: 'aeromexico-b737max', orig: 'airline-aeromexico.jpg', aircraft: 'Boeing 737 MAX 8', w: 1280, h: 853,
      author: 'DUNCAN KIRK', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:XA-AMH_B737_MAX_8,_AeroMexico,_Salt_Lake_City_07-23-26.jpg' },
  ],
  'air-new-zealand': [
    { file: 'air-new-zealand-b777', orig: 'airline-air-new-zealand.jpg', aircraft: 'Boeing 777-300ER', w: 1280, h: 853,
      author: '4300streetcar', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Air_New_Zealand_Boeing_777-300ER_ZK-OKV_taxiing_at_Taoyuan_February_2026_2.jpg' },
  ],
  'alaska-airlines': [
    { file: 'alaska-airlines-b737', orig: 'airline-alaska-airlines.jpg', aircraft: 'Boeing 737-900ER', w: 1280, h: 720,
      author: '4300streetcar', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Alaska_Airlines_Boeing_737-900ER_N403AS_departing_Boston_July_2026.jpg' },
  ],
  allegiant: [
    { file: 'allegiant-b737max', orig: 'airline-allegiant.jpg', aircraft: 'Boeing 737 MAX 8-200', w: 1280, h: 854,
      author: "DUNCAN KIRK from Coeur d'Alene, United States", ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:N810MG_B737_MAX_8-200,_Allegiant_Air,_Fort_Lauderdale_02-20-26_(55150256644).jpg' },
  ],
  avianca: [
    { file: 'avianca-a320neo', orig: 'airline-avianca.jpg', aircraft: 'Airbus A320neo', w: 1280, h: 720,
      author: '4300streetcar', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Avianca_Airbus_A320neo_HK-5366_departing_Boston_Feb_2025_1.jpg' },
  ],
  'breeze-airways': [
    { file: 'breeze-airways-a220', orig: 'airline-breeze-airways.jpg', aircraft: 'Airbus A220-300', w: 1280, h: 816,
      author: 'Charles', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:N204BZ_@_LAX,_2024-12-09.jpg' },
  ],
  'copa-airlines': [
    { file: 'copa-airlines-b737max', orig: 'airline-copa-airlines.jpg', aircraft: 'Boeing 737 MAX 9', w: 1280, h: 853,
      author: 'ZLEA', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Boeing_737-9_MAX_9_(HP-9917CMP,_msn_44178,_ln_8241)_(5-15-2023).jpg' },
  ],
  'fiji-airways': [
    { file: 'fiji-airways-a350', orig: 'airline-fiji-airways.jpg', aircraft: 'Airbus A350-900', w: 1280, h: 854,
      author: 'Kypros1992', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Fiji_Airways_-_DQ-FAN_-_Sydney_Airport_-_24122024.jpg' },
  ],
  frontier: [
    { file: 'frontier-a321neo', orig: 'airline-frontier.jpg', aircraft: 'Airbus A321neo', w: 1280, h: 848,
      author: 'Charles from Port Chester, New York', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Frontier_Airlines_A321-271(NX),_N605FR,_MSN_11161_(12_2022),_as_F9_1756_Los_Angeles_(LAX)_-_Houston_(IAH),_Flight_time_2_51_(55278191166).jpg' },
  ],
  jetblue: [
    { file: 'jetblue-a220', orig: 'airline-jetblue.jpg', aircraft: 'Airbus A220-300', w: 1280, h: 834,
      author: 'Charles', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:JetBlue_Airways_A220-371,_N3271J,_named_A-Blue-Twenty,_MSN_55369_(08_2025),_as_B6_1274_Charleston_(CHS)_-_New_York_(JFK),_Flight_time_1_35_(55278855158).jpg' },
  ],
  jetstar: [
    { file: 'jetstar-a321neo', orig: 'airline-jetstar.jpg', aircraft: 'Airbus A321neo', w: 1280, h: 853,
      author: 'DUNCAN KIRK', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:VH-OFP_A321neo,_Jetstar_Airways,_Melbourne_Tullamarine_01-23-2024.jpg' },
  ],
  latam: [
    { file: 'latam-b787', orig: 'airline-latam.jpg', aircraft: 'Boeing 787-9', w: 1280, h: 779,
      author: 'Charles from Port Chester, New York', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:LATAM_Airlines_B787-916,_CC-BMA,_MSN_619_(10_2017),_as_LA_8181_New_York_(JFK)_-_Sao_Paulo_(GRU),_Flight_time_9_06_(55280459329).jpg' },
  ],
  porter: [
    { file: 'porter-e195e2', orig: 'airline-porter.jpg', aircraft: 'Embraer E195-E2', w: 1280, h: 853,
      author: 'Siyuan He', ...PD_MARK, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Porter_Airlines_E195-E2.jpg' },
  ],
  westjet: [
    { file: 'westjet-b737', orig: 'airline-westjet.jpg', aircraft: 'Boeing 737-700', w: 1280, h: 853,
      author: 'DUNCAN KIRK', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:C-GQWJ_B737-700,_WestJet,_Las_Vegas_07-22-26.jpg' },
  ],
};

/** その社の、画面に出す1枚。 */
export const primary = slug => (PHOTOS[slug] || [])[0] || null;

/** 作者名とライセンス名を示すことが使う条件になっている写真か（CC0 は条件なし）。 */
export const needsCredit = p => p.licence !== 'CC0';

/** 小さい方の高さ（幅 480 に合わせて丸めた値。書き出す側と書く側が同じ式を使う）。 */
export const smallH = p => Math.round(p.h * SMALL_W / p.w);

export const src = (p, small) => `${PHOTO_DIR}/${p.file}${small ? '-' + SMALL_W : ''}.jpg`;

export default PHOTOS;
