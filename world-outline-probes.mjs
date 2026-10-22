/* ════════════════════════════════════════════════════════════════
   world-outline-probes.mjs ── 一覧の地図（world-outline.mjs）を確かめるための「目印の点」（手で打つ・生成物ではない）。

   ★ 生成物（world-outline.mjs）に、それを確かめる答えを持たせない。答えはこのファイルだけに置く。
   ★ 数字はどれも 1000 × 440 の箱の中の位置。地名の経緯度を Equal Earth（中心の経線 0）で写したもの
     （import-world-outline.mjs の写し方と同じ式。どれも 2 単位以内）。
   ★ 点を足す・動かすときは、地名をコメントに書く（どこを指しているか、地図帳で確かめられるように）。
   ════════════════════════════════════════════════════════════════ */

/** [地域, x, y, どこか]：地域の中に 25 点 ＋ どの地域にも入れない陸地（ロシア・グリーンランド）に 3 点。どれも内陸 */
export const PROBES = [
  ['japan', 848, 113, 'Nagano'], ['japan', 844, 90, 'central Hokkaido'],
  ['asia', 787, 101, 'Beijing'], ['asia', 702, 139, 'Delhi'], ['asia', 662, 67, 'Astana'], ['asia', 817, 246, 'central Borneo'], ['asia', 770, 132, 'Chengdu'],
  ['mideast', 624, 153, 'Riyadh'], ['mideast', 630, 115, 'Tehran'], ['mideast', 614, 123, 'Baghdad'],
  ['europe', 505, 73, 'Paris'], ['europe', 581, 101, 'Ankara'], ['europe', 609, 95, 'Tbilisi'], ['europe', 570, 69, 'Kyiv'], ['europe', 491, 100, 'Madrid'],
  ['us', 266, 104, 'Kansas City'], ['us', 277, 70, 'Winnipeg'],
  ['latam', 232, 172, 'Mexico City'], ['latam', 376, 331, 'Sao Paulo'], ['latam', 353, 230, 'inland French Guiana'], ['latam', 295, 227, 'Bogota'],
  ['africa', 602, 249, 'Nairobi'], ['africa', 581, 135, 'Cairo'], ['africa', 542, 260, 'Kinshasa'],
  ['oceania', 857, 331, 'Alice Springs'],
  ['neutral', 582, 54, 'Moscow'], ['neutral', 682, 56, 'Novosibirsk'], ['neutral', 423, 17, 'central Greenland'],
];

/** 指す場面が指す所（日本だけは目印の丸の中心） */
export const POINT_AT = {
  japan: [846, 111], asia: [787, 101], mideast: [624, 153], africa: [602, 249], europe: [505, 73], us: [266, 104],
  oceania: [857, 331], latam: [376, 331],
};

/** 色を1画素読む所：内陸で、地図の名前（LABEL_AT の位置）とその縁取りから離れた所。
    地名：Nagano, Changchun, Tehran, Tamanrasset, Vinnytsia, Atlanta, Katherine, Sao Paulo。
    ★ europe は選んだあとにも読むので、欧州の形の縁（外枠の線が引かれる所）から 10 単位以上離す（Kyiv は 5.8 で近すぎた）。
      また「欧州」の名前の札（幅520pxで測って x 494〜556・y 59〜90）の外。
      Vinnytsia（28.5 E, 49.2 N）＝ 縁まで 10.63・札から 9 単位（2026-10-23 の import-world-outline.mjs が出した数。毎回出る）。 */
export const COLOR_AT = {
  japan: [847, 112], asia: [801, 89], mideast: [630, 115], africa: [515, 160], europe: [565, 72], us: [285, 122],
  oceania: [862, 298], latam: [376, 331],
};

/** 海の1点（大西洋のまんなか・37 W 17 N）：どの形にも入らない */
export const SEA = [399, 181];

/** 箱の中の位置 → ページの上の位置（rect ＝ svg.wam-svg の getBoundingClientRect()） */
export const toPage = (rect, x, y) => [rect.left + (x / 1000) * rect.width, rect.top + (y / 440) * rect.height];
