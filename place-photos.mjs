/* 街と就航地の写真の台帳（2026-10-04）。航空機の台帳（airline-photos.mjs）と同じ形・同じ決まり。
 *
 * 写真は assets/places/ に置く。**ここに書いていない写真を置かない**
 * （出所とライセンスが分からない写真は使えない）。
 *
 * ・鍵は2種類。就航地 = IATA の英大文字3字（NRT）／アブダビの街 = 小文字の名前（alraha）。
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
 * 指定している写真（MUC・ZRH）は、その指定のまま。
 *
 * ★確かめ方（2026-10-04）。1枚ずつ Commons の API で作者・ライセンスを取り、
 *   手元の元ファイルが、そのページの 960px 版と1バイトも違わないことを突き合わせた。
 *   削除の申し立て・出所なし・ライセンス未確認の札が付いているものは無かった。
 *   ⚠️ 確かめたのは**写真そのもののライセンス**まで。写っている建物・像の権利は、
 *   出所のページが自分で断っているかどうかしか見ていない（断っている写真は下の HELD）。
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
      author: 'Diliff', ...BY_3, changes: CHANGES,
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
};

/* ★入れなかった4枚（2026-10-04）。**画面にも assets/places/ にも出ない。**
 *
 * 写真そのもののライセンスと作者は、上と同じやり方で確かめてある（AMS を除く）。
 * 止めた理由は別のところに在る ── 出所のページが自分で「使う前に権利を確かめよ」と
 * 断っている（写っている建物・像の権利は、撮った人のライセンスでは片づかない）か、
 * 「自分で撮った」という申告そのものが確かめられないか。
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
