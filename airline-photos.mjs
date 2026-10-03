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
};

/** その社の、画面に出す1枚。 */
export const primary = slug => (PHOTOS[slug] || [])[0] || null;

/** 作者名とライセンス名を示すことが使う条件になっている写真か（CC0 は条件なし）。 */
export const needsCredit = p => p.licence !== 'CC0';

/** 小さい方の高さ（幅 480 に合わせて丸めた値。書き出す側と書く側が同じ式を使う）。 */
export const smallH = p => Math.round(p.h * SMALL_W / p.w);

export const src = (p, small) => `${PHOTO_DIR}/${p.file}${small ? '-' + SMALL_W : ''}.jpg`;

export default PHOTOS;
