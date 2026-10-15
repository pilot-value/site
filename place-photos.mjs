/* 街と就航地の写真の台帳（2026-10-04）。航空機の台帳（airline-photos.mjs）と同じ形・同じ決まり。
 *
 * 写真は assets/places/ に置く。**ここに書いていない写真を置かない**
 * （出所とライセンスが分からない写真は使えない）。
 *
 * ・鍵は2種類。就航地 = IATA の英大文字3字（NRT）／街 = 小文字の名前
 *   （アブダビは career-facts.mjs の街の鍵・alraha／東京・香港・台北は living-facts.mjs の地区の鍵・ota）。
 *   **言えるのは「就航地」まで。** 乗員が泊まる街かどうかは確かめていないので、
 *   ファイル名も dest-（destination）で、stay とは書かない。
 * ・各鍵の1枚目が画面に出る写真（primary）。
 * ・subject は**写真に写っているもの**。写真の説明（alt）にしか使わない。
 *   その街を代表する景色だと言っているわけではない
 *   （khalifa は住宅地そのものではなく、すぐ横を通る幹線道路の写真）。
 * ・w / h は書き出した大きい方の画素数。<img width height> はここから書く
 *   （画像ファイルを読まない ── assert-generated.mjs は画像の無いコピーの中で流す）。
 *   小さい方は幅 480・ファイル名の後ろに -480。
 *   ⚠️ 縦長が2枚ある（DEL 960×1138・IAD 960×1445）。横長と決めつけて箱を作らない。
 * ・写真は import-airline-photos.mjs --ledger places でキャンバスに描き直して書き出したもの。
 *   撮影情報（位置・機材・作者名のタグ）は1つも残っていない。
 *   **元のファイルをそのまま置かない**（assert-no-pii.mjs の B が落とす）。
 *
 * クレジット：CC BY / CC BY-SA は「作者名とライセンス名を示すこと」が使う条件。
 * 画面のクレジットはここから機械で書く（needsCredit）。CC0 には出さない。
 * 作者名は出所のページ（Wikimedia Commons）に書いてあるとおり。作者が書き方を
 * 指定している写真（MUC・ZRH・FCO・KTI）は、その指定のまま。
 *   FCO … 作者の指定は「DAVID ILIFF」（アカウント名の Diliff ではなく）。ライセンスは写真のページの札
 *         （CC BY 3.0）のとおり。作者の説明ページは CC BY-SA 3.0 の URL を挙げている ── どちらでも
 *         作者名とライセンスを示せば載せられる。こちらで作り変えたものを別の条件で配ることはしない。
 *   KTI … 作者の指定は「Photo: Marcin Konsek / Wikimedia Commons」。
 *
 * ★確かめ方（2026-10-04）。1枚ずつ Commons の API で作者・ライセンスを取り、
 *   手元の元ファイルが、そのページの 960px 版と1バイトも違わないことを突き合わせた。
 *   削除の申し立て・出所なし・ライセンス未確認の札が付いているものは無かった。
 *   ⚠️ 確かめたのは**写真そのもののライセンス**まで。写っている建物・像の権利は、
 *   出所のページが自分で断っているかどうかしか見ていない（断っている写真は下の HELD）。
 *
 * ★2巡目（2026-10-08・就航地 57枚）。確かめ方は上と同じ。断りの札が付いた写真は選んでいない
 *   （付いていたのは「日本では建物を自由に撮って使える」という許す側の札＝UKB と、
 *   ライセンスの確認票＝IAH だけ。IAH は撮った人の持ち込みではなく、写真サイトからの転載を
 *   Commons の係が確かめた1枚）。
 *   ・建物を自由に撮って使える決まりが無い国は、**権利の切れた古い建物**（HAN・SGN・KTI）か、
 *     **1棟が主役にならない広い眺め**（GMP・CMB・JNB）を選んだ。ここはこちらの読みで、
 *     出所のページが保証しているわけではない。止めるなら HELD へ移す（オーナー判断）。
 *   ・作者名のうち3つは、出所の欄に付いていた飾りだけを外した（署名の「(talk)」「by」「User:」
 *     ── LAX・KCZ・HGH）。名前そのものは変えていない。
 *   ・subject の街は「写っている場所」。SHA は静安寺のあたり（虹橋そのものではない）・
 *     KMQ は駅前の広場（街の広い眺めではない）・HND は東京湾側（NRT の新宿とは別の眺め）。
 *   ・縦長は増えていない。
 */

export const PHOTO_DIR = 'assets/places';
export const SMALL_W = 480;
const CHANGES = '縮小・トリミング';

const BY_SA_2    = { licence: 'CC BY-SA 2.0',    licence_url: 'https://creativecommons.org/licenses/by-sa/2.0' };
const BY_SA_3    = { licence: 'CC BY-SA 3.0',    licence_url: 'https://creativecommons.org/licenses/by-sa/3.0' };
const BY_SA_3_DE = { licence: 'CC BY-SA 3.0 DE', licence_url: 'https://creativecommons.org/licenses/by-sa/3.0/de/deed.en' };
const BY_SA_4    = { licence: 'CC BY-SA 4.0',    licence_url: 'https://creativecommons.org/licenses/by-sa/4.0' };
const BY_2       = { licence: 'CC BY 2.0',       licence_url: 'https://creativecommons.org/licenses/by/2.0' };
const BY_25      = { licence: 'CC BY 2.5',       licence_url: 'https://creativecommons.org/licenses/by/2.5' };
const BY_3       = { licence: 'CC BY 3.0',       licence_url: 'https://creativecommons.org/licenses/by/3.0' };
const BY_4       = { licence: 'CC BY 4.0',       licence_url: 'https://creativecommons.org/licenses/by/4.0' };
const CC0        = { licence: 'CC0',             licence_url: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en' };

export const PHOTOS = {
  /* ── 就航地（鍵 = IATA） ── */
  NRT: [
    { file: 'dest-nrt', orig: 'destination-nrt.jpg', subject: '新宿の高層ビル群と富士山（東京）', w: 960, h: 511,
      author: 'Morio', ...BY_SA_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Skyscrapers_of_Shinjuku_2009_January.jpg' },
  ],
  KIX: [
    { file: 'dest-kix', orig: 'destination-kix.jpg', subject: '大阪城と周りのビル（大阪）', w: 960, h: 640,
      author: '663highland', ...BY_25, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Osaka_Castle_03bs3200.jpg' },
  ],
  TPE: [
    { file: 'dest-tpe', orig: 'destination-tpe.jpg', subject: '台北101と台北の街', w: 960, h: 640,
      author: '毛貓大少爺', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Taipei_Skyline_2022.06.29.jpg' },
  ],
  HKG: [
    { file: 'dest-hkg', orig: 'destination-hkg.jpg', subject: 'ビクトリア・ピークから見た香港の夜景', w: 960, h: 468,
      author: 'Haydn Hsin', ...BY_SA_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Hong_Kong_Skyline_viewed_from_Victoria_Peak.jpg' },
  ],
  ICN: [
    { file: 'dest-icn', orig: 'destination-icn.jpg', subject: '徳寿宮の中和殿（ソウル）', w: 960, h: 723,
      author: 'Eunmi Park', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:%EC%A4%91%ED%99%94%EC%A0%84%EC%9D%98_%EB%82%AE.jpg' },
  ],
  BKK: [
    { file: 'dest-bkk', orig: 'destination-bkk.jpg', subject: 'バンコクの高層ビル群', w: 960, h: 622,
      author: 'Ninara from Helsinki, Finland', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:4Y1A1150_Bangkok_(33536339665).jpg' },
  ],
  SIN: [
    { file: 'dest-sin', orig: 'destination-sin.jpg', subject: 'シンガポール中心部の高層ビル群（マリーナベイ）', w: 960, h: 631,
      author: 'Bahnfrend', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:CBD_skyline,_Singapore,_2014_(03).JPG' },
  ],
  KUL: [
    { file: 'dest-kul', orig: 'destination-kul.jpg', subject: 'ブキッ・ビンタンの交差点（クアラルンプール）', w: 960, h: 540,
      author: 'Renek78', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Bukit_Bintang_junction_in_2024_2.jpg' },
  ],
  MNL: [
    { file: 'dest-mnl', orig: 'destination-mnl.jpg', subject: 'マニラの街並み（夕方）', w: 960, h: 540,
      author: 'Bahnfrend', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Cityscape_of_Manila,_2025_(01).jpg' },
  ],
  DEL: [
    { file: 'dest-del', orig: 'destination-del.jpg', subject: 'ジャーマー・マスジド（デリー）', w: 960, h: 1138,
      author: 'Marcin Białek', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Jama_Masjid_2011.jpg' },
  ],
  BOM: [
    { file: 'dest-bom', orig: 'destination-bom.jpg', subject: 'バンドラ・ウォーリ・シーリンク（ムンバイ）', w: 960, h: 720,
      author: 'Rutiknatekar', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Mumbai_Bandra-Worli_Sea_Link.jpg' },
  ],
  BLR: [
    { file: 'dest-blr', orig: 'destination-blr.jpg', subject: 'ベンガルール中心部のビル', w: 960, h: 723,
      author: 'Gpkp', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:View_from_Visvesvaraya_Industrial_and_Technological_Museum_(2025)_02.jpg' },
  ],
  SYD: [
    { file: 'dest-syd', orig: 'destination-syd.jpg', subject: 'シドニー・オペラハウスとハーバーブリッジ（夕暮れ）', w: 960, h: 480,
      author: 'Benh LIEU SONG (Flickr)', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Sydney_Opera_House_and_Harbour_Bridge_Dusk_(2)_2019-06-21.jpg' },
  ],
  MEL: [
    { file: 'dest-mel', orig: 'destination-mel.jpg', subject: 'メルボルンの街並み（手前は戦争慰霊館）', w: 960, h: 682,
      author: 'Melbpal', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Melbourne_skyline_sor.jpg' },
  ],
  LHR: [
    { file: 'dest-lhr', orig: 'destination-lhr.jpg', subject: 'タワーブリッジとテムズ川（ロンドン・夕景）', w: 960, h: 540,
      author: 'Ilya Grigorik', ...BY_SA_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:London_Skyline_(125508655).jpeg' },
  ],
  CDG: [
    { file: 'dest-cdg', orig: 'destination-cdg.jpg', subject: 'エッフェル塔とセーヌ川（パリ）', w: 960, h: 600,
      author: 'Yann Caradec from Paris, France', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:La_Tour_Eiffel_vue_de_la_Tour_Saint-Jacques,_Paris_ao%C3%BBt_2014_(2).jpg' },
  ],
  FRA: [
    { file: 'dest-fra', orig: 'destination-fra.jpg', subject: 'フランクフルトの金融街（空から）', w: 960, h: 540,
      author: 'Dr. Thomas Liptak', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Frankfurt_am_Main,_Central_business_district_(2024).jpg' },
  ],
  MUC: [
    { file: 'dest-muc', orig: 'destination-muc.jpg', subject: '新市庁舎とフラウエン教会（ミュンヘン）', w: 960, h: 649,
      author: 'Thomas Wolf, www.foto-tw.de', ...BY_SA_3_DE, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Stadtbild_M%C3%BCnchen.jpg' },
  ],
  FCO: [
    { file: 'dest-fco', orig: 'destination-fco.jpg', subject: 'トレヴィの泉（ローマ）', w: 960, h: 638,
      author: 'DAVID ILIFF', ...BY_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Trevi_Fountain,_Rome,_Italy_2_-_May_2007.jpg' },
  ],
  ZRH: [
    { file: 'dest-zrh', orig: 'destination-zrh.jpg', subject: 'チューリッヒの旧市街とリマト川', w: 960, h: 524,
      author: 'Thomas Wolf, www.foto-tw.de', ...BY_SA_3_DE, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Altstadt_Z%C3%BCrich_2015.jpg' },
  ],
  MAD: [
    { file: 'dest-mad', orig: 'destination-mad.jpg', subject: 'マドリードの街並み', w: 960, h: 505,
      author: 'Zarateman', ...CC0, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Madrid_-_Sky_Bar_360%C2%BA_(Hotel_Riu_Plaza_Espa%C3%B1a),_vistas_19.jpg' },
  ],
  BCN: [
    { file: 'dest-bcn', orig: 'destination-bcn.jpg', subject: 'バルセロナの街と港（夕方）', w: 960, h: 448,
      author: 'M McBey', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Evening_light_over_Barcelona.jpg' },
  ],
  JFK: [
    { file: 'dest-jfk', orig: 'destination-jfk.jpg', subject: 'エンパイア・ステート・ビルとマンハッタン（ニューヨーク）', w: 960, h: 540,
      author: 'Dllu', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:View_of_Empire_State_Building_from_Rockefeller_Center_New_York_City_dllu_(cropped).jpg' },
  ],
  IAD: [
    { file: 'dest-iad', orig: 'destination-iad.jpg', subject: 'アメリカ合衆国議会議事堂（ワシントンD.C.）', w: 960, h: 1445,
      author: 'Ralf Roletschek', ...BY_SA_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:12-07-13-washington-by-RalfR-08.jpg' },
  ],
  ORD: [
    /* 元の写真の作者と、それを直した人の2人が出所のページに並んでいる。両方を示す。 */
    { file: 'dest-ord', orig: 'destination-ord.jpg', subject: 'シカゴ川と遊覧船', w: 960, h: 679,
      author: 'John Picken (derivative work: Georgfotoart)', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Chicago_River_ferry_b.jpg' },
  ],
  BOS: [
    { file: 'dest-bos', orig: 'destination-bos.jpg', subject: 'ビーコンヒルの石畳の路地（ボストン）', w: 960, h: 626,
      author: 'Ian Howard', ...BY_25, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:ISH_WC_Boston4.jpg' },
  ],
  YYZ: [
    { file: 'dest-yyz', orig: 'destination-yyz.jpg', subject: 'トロントの街並みと CN タワー', w: 960, h: 576,
      author: 'Dillan Payne', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Toronto_Skyline_from_Snake_Island,_September_11_2026_(01).jpg' },
  ],

  /* ── 就航地・2巡目（2026-10-08・57枚。先行5社の就航地のうち、乗り入れる会社が多い空港から） ── */
  PVG: [
    { file: 'dest-pvg', orig: 'destination-pvg.jpg', subject: '黄浦江越しに見る東方明珠塔と陸家嘴の高層ビル群（上海・浦東）', w: 960, h: 720,
      author: 'YouTable', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Lujiazui_from_the_Bund_riverside.jpg' },
  ],
  FUK: [
    { file: 'dest-fuk', orig: 'destination-fuk.jpg', subject: '上空から見た福岡タワーとシーサイドももちの砂浜・ビル群（福岡）', w: 960, h: 720,
      author: 'Nryate', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Fukuoka_Skyline_of_Seaside_Momochi.jpg' },
  ],
  PEK: [
    { file: 'dest-pek', orig: 'destination-pek.jpg', subject: '線路と瓦屋根の建物の向こうに並ぶCBDの高層ビル群（北京）', w: 960, h: 640,
      author: 'N509FZ', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Skyline_of_Beijing_CBD_from_the_southeast_(20210907094201).jpg' },
  ],
  CAN: [
    { file: 'dest-can', orig: 'destination-can.jpg', subject: '珠江の対岸に立つ2本の超高層ビルと珠江新城のビル群（広州）', w: 960, h: 641,
      author: 'xiquinhosilva', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:02540-Guangzhou.jpg' },
  ],
  LAX: [
    { file: 'dest-lax', orig: 'destination-lax.jpg', subject: '雪を頂いた山並みを背にしたダウンタウンの高層ビル群と手前の住宅（ロサンゼルス）', w: 960, h: 574,
      author: 'BDS2006', ...BY_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Los_Angeles_Skyline_telephoto.jpg' },
  ],
  YVR: [
    { file: 'dest-yvr', orig: 'destination-yvr.jpg', subject: 'ヨットの浮かぶ入り江とスタジアム、ダウンタウンのビル群、手前にカナダ国旗（バンクーバー）', w: 960, h: 640,
      author: 'Quintin Soloviev', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Skyline_of_Vancouver,_BC.jpg' },
  ],
  KMQ: [
    { file: 'dest-kmq', orig: 'destination-kmq.jpg', subject: '上から見た小松駅前のロータリーと広場（小松）', w: 960, h: 720,
      author: 'クハ４１９－５', ...BY_SA_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:%E5%B0%8F%E6%9D%BE%E9%A7%85_%E9%A7%85%E5%89%8D_%E3%83%90%E3%82%B9%E3%83%AD%E3%83%BC%E3%82%BF%E3%83%AA%E3%83%BC_-_panoramio.jpg' },
  ],
  MYJ: [
    { file: 'dest-myj', orig: 'destination-myj.jpg', subject: '松山城の天守から見下ろす櫓と市街地、奥に山並み（松山）', w: 960, h: 647,
      author: 'Zairon', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Matsuyama_Matsuyama-jo_Keep_View_to_Matsuyama_27.jpg' },
  ],
  TSA: [
    { file: 'dest-tsa', orig: 'destination-tsa.jpg', subject: '屋上が連なる民生社区の集合住宅と奥の山並み（台北・松山区）', w: 960, h: 540,
      author: '玄史生', ...CC0,
      source: 'https://commons.wikimedia.org/wiki/File:Northeast_Area_of_Minsheng_Community_and_Neihu_District_View_from_Taipei_City_Minsheng_Community_Center_20140920.jpg' },
  ],
  DFW: [
    { file: 'dest-dfw', orig: 'destination-dfw.jpg', subject: '上空から見たダウンタウンの高層ビル群（ダラス）', w: 960, h: 721,
      author: 'Eric Statzer', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Dallas_Skyline_-_Eric_Statzer.jpg' },
  ],
  BRU: [
    { file: 'dest-bru', orig: 'destination-bru.jpg', subject: '市庁舎の塔とギルドハウスに囲まれたグラン＝プラスの石畳（ブリュッセル）', w: 960, h: 640,
      author: 'Celuici', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Grand-Place,_Brussels_-_panorama,_June_2018_(cropped).jpg' },
  ],
  DPS: [
    { file: 'dest-dps', orig: 'destination-dps.jpg', subject: '上空から見たサヌールの砂浜と青い海、赤い屋根と木立（バリ島・デンパサール）', w: 960, h: 720,
      author: 'Magul', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Sanur_Beach,_Bali_2017-08-21_(20).jpg' },
  ],
  HKD: [
    { file: 'dest-hkd', orig: 'destination-hkd.jpg', subject: '函館山から見下ろす雪の市街地と弧を描く海岸線（函館）', w: 960, h: 640,
      author: '掬茶', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:East_view_from_Mount_Hakodate_in_snow.jpg' },
  ],
  ITM: [
    { file: 'dest-itm', orig: 'destination-itm.jpg', subject: '梅田スカイビルから見た梅田の高層ビル群（大阪）', w: 960, h: 586,
      author: 'Zairon', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Osaka_Umeda_Sky_Building_Panoramablick_05.jpg' },
  ],
  HIJ: [
    { file: 'dest-hij', orig: 'destination-hij.jpg', subject: '元安川と原爆ドーム、川沿いの街並み（広島）', w: 960, h: 617,
      author: 'DXR', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Atomic_Bomb_Dome_and_Motoyaso_River,_Hiroshima,_Northwest_view_20190417_1.jpg' },
  ],
  TAK: [
    { file: 'dest-tak', orig: 'destination-tak.jpg', subject: '高台から見下ろす高松の市街地と瀬戸内海の島々（高松）', w: 960, h: 640,
      author: 'Arabrity', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:%E9%AB%98%E6%9D%BE%E5%B8%82%E8%A1%97%E3%81%A8%E7%80%AC%E6%88%B8%E5%86%85%E6%B5%B7%E3%81%AE%E5%B3%B6%E3%80%85.jpg' },
  ],
  OIT: [
    { file: 'dest-oit', orig: 'destination-oit.jpg', subject: '上から見た大分駅前の広場とロータリー、中心街のビル（大分）', w: 960, h: 720,
      author: '大分帰省中', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Oita_oita_sta_funai_chuo_hiroba.jpg' },
  ],
  KMJ: [
    { file: 'dest-kmj', orig: 'destination-kmj.jpg', subject: 'マンション群の向こうの熊本城天守と、手前の高架を走る九州新幹線（熊本）', w: 960, h: 720,
      author: 'Hisagi', ...BY_SA_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Kumamoto_Castle_and_Ky%C5%ABsh%C5%AB_Shinkansen_01.jpg' },
  ],
  KOJ: [
    { file: 'dest-koj', orig: 'destination-koj.jpg', subject: '鹿児島の市街地と錦江湾越しの桜島（鹿児島）', w: 960, h: 720,
      author: 'Ludovic Lubeigt from Taiwan', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Sakurajima_standing_behind_Kagoshima_(15476719475).jpg' },
  ],
  HNL: [
    { file: 'dest-hnl', orig: 'destination-hnl.jpg', subject: 'ワイキキの砂浜と海、ホテル群の奥にダイヤモンドヘッド（ホノルル）', w: 960, h: 720,
      author: 'Alfred Adler', ...BY_SA_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Diamond_Head_from_Waikiki.jpg' },
  ],
  SDJ: [
    { file: 'dest-sdj', orig: 'destination-sdj.jpg', subject: '仙台城跡から見た丘陵と市街地のビル群（仙台）', w: 960, h: 540,
      author: '掬茶', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Cityscape_from_Sendai_Castle_20251221d.jpg' },
  ],
  PER: [
    { file: 'dest-per', orig: 'destination-per.jpg', subject: 'キングスパークから見た中心部の高層ビル群と高速道路、スワン川（パース）', w: 960, h: 540,
      author: 'Benjamin "Jeffrey" Powell', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Perth_from_Kings_Park_2017.jpg' },
  ],
  IST: [
    { file: 'dest-ist', orig: 'destination-ist.jpg', subject: 'ガラタ塔と水辺に並ぶ建物、岸壁のフェリー、空を飛ぶカモメ（イスタンブール）', w: 960, h: 673,
      author: 'SegLig', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Istanbul_skyline_03.jpg' },
  ],
  KHH: [
    { file: 'dest-khh', orig: 'destination-khh.jpg', subject: '高雄85ビルを中心にした高層ビル群（高雄）', w: 960, h: 640,
      author: 'ABOVE THE SKY', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Kaohsiung_skyline_2020_May.jpg' },
  ],
  CNX: [
    { file: 'dest-cnx', orig: 'destination-cnx.jpg', subject: '色とりどりの屋根が広がる市街地と背後のドイ・ステープ山（チェンマイ）', w: 960, h: 719,
      author: 'Blowing Puffer Fish', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Chiang_Mai_and_Doi_Suthep_Mountain_2017.jpg' },
  ],
  BNE: [
    { file: 'dest-bne', orig: 'destination-bne.jpg', subject: 'カンガルー・ポイントの崖から見たブリスベン川と中心部の高層ビル群（ブリスベン）', w: 960, h: 720,
      author: 'Kgbo', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Skylines_of_Brisbane_from_Kangaroo_Point_Cliffs_Park,_2020,_02.jpg' },
  ],
  HYD: [
    { file: 'dest-hyd', orig: 'destination-hyd.jpg', subject: 'チャールミナールと門前の通りを行き交うオートリキシャ（ハイデラバード）', w: 960, h: 720,
      author: 'Hari Om Prakash', ...BY_SA_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Charminar,_Hyderabad,_Telangana.jpg' },
  ],
  MAN: [
    { file: 'dest-man', orig: 'destination-man.jpg', subject: '木立の向こうに並ぶ中心部の高層ビル群（マンチェスター）', w: 960, h: 641,
      author: 'Anthony O\'Neil', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Manchester_city_centre_-_geograph.org.uk_-_8059388.jpg' },
  ],
  HAN: [
    { file: 'dest-han', orig: 'destination-han.jpg', subject: 'ホアンキエム湖に浮かぶ亀の塔と湖畔の木立（ハノイ）', w: 960, h: 640,
      author: 'NKSTTSSHNVN', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Th%C3%A1p_R%C3%B9a_-_NKS.jpg' },
  ],
  CTS: [
    { file: 'dest-cts', orig: 'destination-cts.jpg', subject: 'テレビ塔から見下ろす秋の大通公園と市街地（札幌）', w: 960, h: 720,
      author: 'redlegsfan21', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Odori_Park_(15982613668).jpg' },
  ],
  SGN: [
    { file: 'dest-sgn', orig: 'destination-sgn.jpg', subject: 'サイゴン中央郵便局の正面（ホーチミン）', w: 960, h: 640,
      author: 'Suicasmo', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Saigon_Central_Post_Office_20190922.jpg' },
  ],
  SHA: [
    { file: 'dest-sha', orig: 'destination-sha.jpg', subject: '静安寺と周囲の高層ビル（上海）', w: 960, h: 720,
      author: 'Nikolamikovic82', ...CC0,
      source: 'https://commons.wikimedia.org/wiki/File:Jing\'an_Temple,_Shanghai,_China_2.jpg' },
  ],
  SFO: [
    { file: 'dest-sfo', orig: 'destination-sfo.jpg', subject: 'パレス・オブ・ファイン・アーツの丸屋根越しに見る市街地と高層ビル群（サンフランシスコ）', w: 960, h: 640,
      author: 'Mariordo (Mario Roberto Durán Ortiz)', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:San_Francisco_skyline_from_Golden_Gate_Bridge,_09_2017.jpg' },
  ],
  SEA: [
    { file: 'dest-sea', orig: 'destination-sea.jpg', subject: 'スペースニードルと高層ビル群、遠くにレーニア山（シアトル）', w: 960, h: 640,
      author: 'Sajad Mohamad', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Seattle_Skyline_Kerry_Park.jpg' },
  ],
  NGO: [
    { file: 'dest-ngo', orig: 'destination-ngo.jpg', subject: 'テレビ塔から西を望む市街地と名古屋駅周辺の高層ビル（名古屋）', w: 960, h: 533,
      author: 'Alpsdake', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:View_from_Nagoya_TV_Tower_(west_2015-11-19).jpg' },
  ],
  OKA: [
    { file: 'dest-oka', orig: 'destination-oka.jpg', subject: '首里城の守礼門（那覇）', w: 960, h: 639,
      author: '663highland', ...BY_25, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Naha_Shuri_Castle32bs5s4592.jpg' },
  ],
  GMP: [
    { file: 'dest-gmp', orig: 'destination-gmp.jpg', subject: '漢江越しに見る汝矣島の高層ビル群（ソウル）', w: 960, h: 721,
      author: 'S h y numis', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Skyline_of_Yeouido,_a_prominent_finance_district_in_Seoul.jpg' },
  ],
  HGH: [
    { file: 'dest-hgh', orig: 'destination-hgh.jpg', subject: '西湖の遊覧船と湖畔の木立、その奥の市街地（杭州）', w: 960, h: 640,
      author: 'CatOnMars', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Huanglong_&_Broken_Bridge_-_Hangzhou_Skylines.jpg' },
  ],
  VIE: [
    { file: 'dest-vie', orig: 'destination-vie.jpg', subject: 'カールス教会と手前の池（ウィーン）', w: 960, h: 706,
      author: 'Felix König', ...BY_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Karlskirche_Wien_September_2016.jpg' },
  ],
  KTI: [
    { file: 'dest-kti', orig: 'destination-kti.jpg', subject: '王宮のポチャニ殿（プノンペン）', w: 960, h: 717,
      author: 'Marcin Konsek / Wikimedia Commons', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:2016_Phnom_Penh,_Pa%C5%82ac_Kr%C3%B3lewski,_Preah_Tineang_Phhochani_(14).jpg' },
  ],
  KUH: [
    { file: 'dest-kuh', orig: 'destination-kuh.jpg', subject: '釧路川に架かる幣舞橋と雪の残る岸壁（釧路）', w: 960, h: 640,
      author: 'MaedaAkihiko', ...CC0,
      source: 'https://commons.wikimedia.org/wiki/File:Nusamai-Bridge_West.jpg' },
  ],
  AOJ: [
    { file: 'dest-aoj', orig: 'destination-aoj.jpg', subject: '青森ベイブリッジと港、奥に広がる市街地（青森）', w: 960, h: 640,
      author: 'Suicasmo', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Aomori_Bay_Bridge_20170329.jpg' },
  ],
  OKJ: [
    { file: 'dest-okj', orig: 'destination-okj.jpg', subject: '後楽園の池と築山、奥に岡山城の天守（岡山）', w: 960, h: 626,
      author: 'Fjkelfeimvvn', ...BY_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Okayama_Korakuen_Garden01.jpg' },
  ],
  TKS: [
    { file: 'dest-tks', orig: 'destination-tks.jpg', subject: '眉山の山頂から見下ろす市街地と川、その先の海（徳島）', w: 960, h: 640,
      author: '新幹線', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Tokushima_City_View_from_the_Top_of_Bizan_20200405.jpg' },
  ],
  KCZ: [
    { file: 'dest-kcz', orig: 'destination-kcz.jpg', subject: '松の木越しに見上げる高知城の天守（高知）', w: 960, h: 720,
      author: 'Reggaeman', ...BY_SA_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Kochi_Castle_03.JPG' },
  ],
  NGS: [
    { file: 'dest-ngs', orig: 'destination-ngs.jpg', subject: 'グラバー園から見下ろす長崎港と水辺の公園、対岸の市街地（長崎）', w: 960, h: 638,
      author: 'yoppy', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Cityscape_of_Nagasaki_from_Glover_Park_2013-08-27.jpg' },
  ],
  KMI: [
    { file: 'dest-kmi', orig: 'destination-kmi.jpg', subject: '宮崎県庁本館と前庭のヤシの木（宮崎）', w: 960, h: 720,
      author: 'そらみみ', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Miyazaki_Prefectural_Government_Headquarters_20170319.jpg' },
  ],
  DLC: [
    { file: 'dest-dlc', orig: 'destination-dlc.jpg', subject: '公園の緑と観覧車越しに見る中心部の高層ビル群（大連）', w: 960, h: 640,
      author: 'JesseW900', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:DalianSkyline.JPG' },
  ],
  UKB: [
    { file: 'dest-ukb', orig: 'destination-ukb.jpg', subject: '海から見た神戸ポートタワーとメリケンパーク周辺（神戸）', w: 960, h: 640,
      author: 'Balon Greyjoy', ...CC0,
      source: 'https://commons.wikimedia.org/wiki/File:20190901_Kobe_harbor-1.jpg' },
  ],
  TAO: [
    { file: 'dest-tao', orig: 'destination-tao.jpg', subject: '砂浜と波打ち際、その奥に並ぶ高層ビル（青島）', w: 960, h: 640,
      author: 'Windmemories', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:20240729_Cityscape_of_Taixi,_Qingdao.jpg' },
  ],
  IAH: [
    { file: 'dest-iah', orig: 'destination-iah.jpg', subject: '住宅街の木立越しに見るダウンタウンの高層ビル群（ヒューストン）', w: 960, h: 640,
      author: 'Jason Villanueva', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Houston,_Texas_Skyline_2017.jpg' },
  ],
  HND: [
    { file: 'dest-hnd', orig: 'destination-hnd.jpg', subject: 'お台場側から見たレインボーブリッジと対岸のビル群（東京）', w: 960, h: 703,
      author: 'Tokumeigakarinoaoshima', ...CC0,
      source: 'https://commons.wikimedia.org/wiki/File:Rainbow_Bridge_at_Odaiba.JPG' },
  ],
  CTU: [
    { file: 'dest-ctu', orig: 'destination-ctu.jpg', subject: 'テレビ塔と一面に広がる市街地のビル群（成都）', w: 960, h: 653,
      author: 'George N', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Chengdu_skyline_June_2017.jpg' },
  ],
  MAA: [
    { file: 'dest-maa', orig: 'destination-maa.jpg', subject: 'カパーレーシュワラ寺院の塔門と手前の沐浴池（チェンナイ）', w: 960, h: 654,
      author: 'N. Vivekananthamoorthy', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Kapaleeshwarar_Temple,_Mylapore,_Chennai,_India.jpg' },
  ],
  CMB: [
    { file: 'dest-cmb', orig: 'destination-cmb.jpg', subject: '海越しに見る高層ビル群とロータスタワー（コロンボ）', w: 960, h: 540,
      author: 'XKillSwitchXxx', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Colombo_Skyline_Jan_2022.jpg' },
  ],
  DAC: [
    { file: 'dest-dac', orig: 'destination-dac.jpg', subject: 'ハティルジール湖と白い橋、対岸に密集する建物（ダッカ）', w: 960, h: 585,
      author: 'ASaber91', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Dhaka_21st_March_(25870222381).jpg' },
  ],
  JNB: [
    { file: 'dest-jnb', orig: 'destination-jnb.jpg', subject: 'ネルソン・マンデラ橋と中心業務地区の高層ビル群（ヨハネスブルグ）', w: 960, h: 720,
      author: 'Evan Bench', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Johannesburg_CBD.jpg' },
  ],

  /* ── アブダビの街（鍵 = 小文字の名前） ── */
  alraha: [
    { file: 'town-alraha', orig: 'town-alraha.jpg', subject: 'アルバンダルのマリーナ（アルラハ・ビーチ）', w: 960, h: 665,
      author: 'Xcuneo', ...BY_SA_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Al_Bandar_Marina_Al_Raha_Abu_Dhabi.jpg' },
  ],
  khalifa: [
    { file: 'town-khalifa', orig: 'town-khalifa.jpg', subject: 'ハリファシティの近くを通る幹線道路（シャハマ・ロード）', w: 960, h: 548,
      author: 'Rizwan Ullah Wazir', ...BY_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Abu_Dhabi_-_Shahama_Road_to_Dubai_-_United_Arab_Emirates_-_panoramio_(10).jpg' },
  ],
  masdar: [
    { file: 'town-masdar', orig: 'town-masdar.jpg', subject: 'マスダールシティの街区（夜）', w: 960, h: 540,
      author: 'Renek78', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Masdar_City_in_March_2022_01.jpg' },
  ],
  reem: [
    { file: 'town-reem', orig: 'town-reem.jpg', subject: 'アルリーム島の高層ビル群', w: 960, h: 640,
      author: 'Sa7er90', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Al_reem_island.jpg' },
  ],
  yas: [
    { file: 'town-yas', orig: 'town-yas.jpg', subject: 'ヤス島のゴルフコース', w: 960, h: 539,
      author: 'Tashmetova808', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Golf_club,_Yas_island,_Abu_Dhabi_city,_UAE.jpg' },
  ],

  /* ★東京・香港・台北の地区（2026-10-08）。鍵は living-facts.mjs の rents の key と同じ。
   *  確かめ方は上と同じ（Commons の API で作者・ライセンス・札を1枚ずつ。元は 960px 版）。
   *  ⚠️ subject は写っているものをそのまま書く。**地区の名前が付いた建物の写真ではないものが在る**
   *  （queens_terrace は団地ではなく、同じ上環の通り／taoyuan は桃園市のうち中壢区の中心部／
   *    taipei は台北市のうち文山区の景美）。「この地区の代表の景色」とは言っていない。
   *  2026-10 から、鍵は街の鍵（品川＝shinagawa …）。 */
  ota: [
    { file: 'town-ota', orig: 'town-ota.jpg', subject: '大田区大森の国道15号と沿道のマンション', w: 960, h: 720,
      author: 'Aimaimyi', ...BY_SA_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Japan_National_Route_15_-07.jpg' },
  ],
  minato: [
    { file: 'town-minato', orig: 'town-minato.jpg', subject: '夕方の港区の高層ビル群と東京タワー', w: 960, h: 540,
      author: 'David Kernan', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Minato_City,_Tokyo,_Japan.jpg' },
  ],
  narita: [
    { file: 'town-narita', orig: 'town-narita.jpg', subject: '成田の旧市街の坂道と古い商家の並び', w: 960, h: 720,
      author: 'Zairon', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Narita_Altstadt_3.jpg' },
  ],
  caribbean_coast: [
    { file: 'town-caribbean-coast', orig: 'town-caribbean_coast.jpg', subject: '海越しに見た東涌の映灣園（Caribbean Coast）の高層住宅', w: 960, h: 720,
      author: 'WiNG', ...BY_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:HK_Caribbean_Coast.jpg' },
  ],
  queens_terrace: [
    { file: 'town-sheung-wan', orig: 'town-queens_terrace.jpg', subject: '上環の荷李活道（Hollywood Road）の坂道と沿道の商店・住宅', w: 960, h: 720,
      author: '姒姓賢寧', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Hollywood_Road,_Sheung_Wan_near_Queen%27s_Road_West,_Sheung_Wan_in_February_2022.jpg' },
  ],
  taoyuan: [
    { file: 'town-taoyuan', orig: 'town-taoyuan.jpg', subject: '桃園市中壢区の中心部の街並み（高い所から）', w: 960, h: 720,
      author: 'Foxy1219', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Zhongli_district_scene_2019.jpg' },
  ],
  dayuan: [
    { file: 'town-dayuan', orig: 'town-dayuan.jpg', subject: '大園区の幹線道路と両側の街並み（空から）', w: 960, h: 688,
      author: 'Wing1990hk', ...BY_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Dayuan_District_201506.jpg' },
  ],
  nankan: [
    { file: 'town-luzhu', orig: 'town-luzhu.jpg', subject: '蘆竹区南崁の大通りと高層マンション', w: 960, h: 720,
      author: 'Foxy1219', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Nankan_Luzhu_2018.jpg' },
  ],
  taipei: [
    { file: 'town-taipei', orig: 'town-taipei.jpg', subject: '台北市文山区景美の街並み（高い所から）', w: 960, h: 640,
      author: 'Jirka Matousek', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Jingmei,_Taipei_Cityscape_20220225.jpg' },
  ],
  daan: [
    { file: 'town-daan', orig: 'town-daan.jpg', subject: '大安森林公園の園路と周りのビル', w: 960, h: 640,
      author: '玄史生', ...CC0,
      source: 'https://commons.wikimedia.org/wiki/File:Daan_Park_20240224.jpg' },
  ],
  shinagawa: [
    { file: 'town-shinagawa', orig: 'town-shinagawa.jpg', subject: '品川駅の高輪口の駅前と、駅の向こうの高層ビル群（駅前の歩道橋から）', w: 960, h: 567,
      author: 'Nesnad', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Shinagawa_Station_-_outside_-_May_25_2019_340pm.jpeg' },
  ],
  toyosu: [
    { file: 'town-toyosu', orig: 'town-toyosu.jpg', subject: '豊洲の水辺に架かる赤いアーチの橋と、奥の高層ビル', w: 960, h: 720,
      author: 'Guilhem Vellut from Annecy, France', ...BY_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Bridge_@_Toyosu_(9654163316).jpg' },
  ],
  yokohama: [
    { file: 'town-yokohama', orig: 'town-yokohama.jpg', subject: 'みなとみらいの高層ビル群と運河・観覧車（横浜）', w: 960, h: 540,
      author: 'Matthide127', ...CC0,
      source: 'https://commons.wikimedia.org/wiki/File:20250105_Minato_Mirai_21_(Landmark_Tower,_Queen%27s_Square_Yokohama,_Cosmo_Clock_21)_080219.jpg' },
  ],
  tung_chung: [
    { file: 'town-tung-chung', orig: 'town-tung_chung.jpg', subject: 'ロープウェイ（昂坪360）から見下ろした東涌の高層住宅の並びと山・湾', w: 960, h: 720,
      author: 'LN9267', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Tung_Chung_22-06-2020.jpg' },
  ],
  discovery_bay: [
    { file: 'town-discovery-bay', orig: 'town-discovery_bay.jpg', subject: '山の上（老虎頭）から見下ろした愉景灣の街と海・砂浜', w: 960, h: 720,
      author: 'Underwaterbuffalo', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Discovery_Bay_14.jpg' },
  ],
  tsing_yi: [
    { file: 'town-tsing-yi', orig: 'town-tsing_yi.jpg', subject: '荃灣から海越しに見た青衣の高層住宅の並び', w: 960, h: 720,
      author: 'y-yoshiike', ...BY_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Tsing_Yi_view_from_Tsuen_Wan_-_panoramio.jpg' },
  ],
  qingpu: [
    { file: 'town-qingpu', orig: 'town-qingpu.jpg', subject: '高い所から見た青埔の高層住宅と高鐵桃園駅のあたり', w: 960, h: 482,
      author: 'Foxy1219', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Qingpu,_Taoyuan_City_Skyline_2024.jpg' },
  ],
  linkou: [
    { file: 'town-linkou', orig: 'town-linkou.jpg', subject: '高速道路の高架から見た林口の高層住宅の並び', w: 960, h: 540,
      author: '毛貓大少爺', ...BY_SA_2, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Linkou,_New_Taipei_Skyline_20201220.jpg' },
  ],
};

/* ★入れなかった写真（2026-10-04 の4枚＋2026-10-08 の2枚）。**画面にも assets/places/ にも出ない。**
 *
 * 写真そのもののライセンスと作者は、上と同じやり方で確かめてある（AMS を除く）。
 * 止めた理由は別のところに在る ── 出所のページが自分で「使う前に権利を確かめよ」と
 * 断っている（写っている建物・像の権利は、撮った人のライセンスでは片づかない）か、
 * 「自分で撮った」という申告そのものが確かめられないか。
 * ★2026-10-08 の2枚（HKT・CEB）だけは理由が違う。出所のページに断りは無く、**こちらの用心で止めた**。
 * ★CGK・AMS・MXP は、断りの付かない別の写真を1枚ずつ見つけてある（旧バタビア市庁舎／運河沿いの家並み／
 *   ナヴィリオ運河）。差し替えるかはオーナー判断なので、ここは動かしていない。
 *
 * 使うと決めたら、その1件を PHOTOS へ移して取り込みを流す（オーナー判断）。
 * 取り込みの道具は PHOTOS しか読まないので、ここに置いてある間は書き出されない。
 */
export const HELD = {
  CGK: {
    why: '出所のページに「インドネシアには屋外の著作物を自由に撮って使える決まりが無い」という注意書きが付いている（像が写真の中心）。',
    photo: { file: 'dest-cgk', orig: 'destination-cgk.jpg', subject: 'ホテル・インドネシア前のロータリーと歓迎の像（ジャカルタ）', w: 960, h: 540,
      author: 'Medelam', ...BY_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Bundaran_Hotel_Indonesia_(2025)_(cropped).jpg' },
  },
  AMS: {
    why: '「自分で撮った」という申告を、出所のページからは確かめられなかった（空から撮った写真で、形式が PNG）。',
    photo: { file: 'dest-ams', orig: 'destination-ams.png', subject: 'アムステルダムの運河地区（空から）', w: 960, h: 640,
      author: 'Andrés Barrios', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Imagen_de_los_canales_conc%C3%A9ntricos_en_%C3%81msterdam.png' },
  },
  MXP: {
    why: '出所のページに「イタリアの文化財。商用などに使うには文化省の許可が別に要る」という注意書きが付いている。',
    photo: { file: 'dest-mxp', orig: 'destination-mxp.jpg', subject: 'ミラノ大聖堂', w: 960, h: 721,
      author: 'Jiuguang Wang', ...BY_SA_3, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Milan_Cathedral_from_Piazza_del_Duomo.jpg' },
  },
  HKT: {
    why: '手前に停まっている車のナンバーが読める（出所のページに断りは無い。こちらの用心で止めた）。',
    photo: { file: 'dest-hkt', orig: 'destination-hkt.jpg', subject: 'カラフルなショップハウスが並ぶタラン通りと路上に停まった車（プーケット旧市街）', w: 960, h: 720,
      author: 'Christophe95', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Thalang_Road,_Old_Phuket_Town.jpg' },
  },
  CEB: {
    why: 'フィリピンには建物を自由に撮って使える決まりが無く、手前のホテル1棟が大きめに写っている（出所のページに断りは無い。こちらの用心で止めた）。',
    photo: { file: 'dest-ceb', orig: 'destination-ceb.jpg', subject: '高所から見渡す市街地と高層ビル、遠くに海と山（セブ）', w: 960, h: 720,
      author: 'DisRaptor18', ...CC0,
      source: 'https://commons.wikimedia.org/wiki/File:Cebu_city_skyline_2025.jpg' },
  },
  abudhabi: {
    why: '出所のページに「アラブ首長国連邦には建物を自由に撮って使える決まりが無い」という注意書きが付いている。',
    photo: { file: 'town-abudhabi', orig: 'town-abudhabi.jpg', subject: 'アブダビの街並み（2014年）', w: 960, h: 527,
      author: 'Wadiia', ...BY_SA_4, changes: CHANGES,
      source: 'https://commons.wikimedia.org/wiki/File:Abu_dhabi_skylines_2014.jpg' },
  },
};

/** その鍵（IATA か街の名前）の、画面に出す1枚。無ければ null（＝写真なしで組む）。 */
export const primary = key => (PHOTOS[key] || [])[0] || null;

/** 作者名とライセンス名を示すことが使う条件になっている写真か（CC0 は条件なし）。 */
export const needsCredit = p => p.licence !== 'CC0';

/** 小さい方の高さ（幅 480 に合わせて丸めた値。書き出す側と書く側が同じ式を使う）。 */
export const smallH = p => Math.round(p.h * SMALL_W / p.w);

export const src = (p, small) => `${PHOTO_DIR}/${p.file}${small ? '-' + SMALL_W : ''}.jpg`;

export default PHOTOS;
