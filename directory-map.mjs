/* ════════════════════════════════════════════════════════════════
   directory-map.mjs ── 航空会社一覧の地図（8つの地域の形・名前の札・凡例）の HTML を作る（段階5・地図の区域）。
   いまは mapBox() と toneOf() だけ（DM1。見本の絵 import-world-outline.mjs --sketch が呼ぶ）。カードとボタンは WP-dmap-2 から足す。

   ★ 形は world-outline.mjs（生成物。import-world-outline.mjs が書く）から読む。ここで形を作らない・直さない。
   ★ 緑の濃さの段は toneOf() の1か所：段 k ＝ min(AX/1000 − 1, floor(地域の機長の推定年収の平均 / 1000))。
     0〜AX の共通の目盛を 1,000万円ごとに切った帯で、額が段を決める（地域どうしの順位では決めない）。
   ★ <path> に fill / stroke / style を書かない。段のクラスは地域の <g> に付けて、path が受け継ぐ（D10 の塗りの決まり）。
     外枠（<use>）は全部、いちばん上の <g class="wam-ol"> に入れる（あとから塗る地域に外枠の半分が隠れないように）。
   ★ 名前・凡例の文は呼び手が渡す（ここに文言を持たない）。名前は HTML のまま入る。
   ★ 文字列の置き換えは関数形だけ（CLAUDE.md）。
   ════════════════════════════════════════════════════════════════ */
import { SHAPES, LABELS, JAPAN_MARK } from './world-outline.mjs';

/** 塗る順（あとのものが上）。日本はいちばん上の地域 */
export const PAINT = ['us', 'latam', 'europe', 'africa', 'mideast', 'asia', 'oceania', 'japan'];
/** 段の数 ＝ 目盛の端 AX / 1000（いまは ¥7,000万 → 7）。pv-directory.css の .wam-t0 … と凡例の四角の数もこれ。AX が変われば M20 が赤くなる */
export const STEPS = 7;

/** 地域の機長の推定年収の平均（万円）→ 緑の段 k。分からない額（null・数でない）を 0 段にしない＝止まる */
export function toneOf(man, AX) {
  if (!Number.isInteger(AX) || AX <= 0 || AX % 1000 !== 0) throw new Error(`toneOf：目盛の端「${AX}」が 1,000万円の倍数でない`);
  if (typeof man !== 'number' || !Number.isFinite(man) || man < 0) throw new Error(`toneOf：額「${man}」`);
  return Math.min(AX / 1000 - 1, Math.floor(man / 1000));
}

/**
 * 地図の列（地図の箱＋凡例）。
 *   names  { 地域: 名前の HTML }（8つ全部）
 *   tones  { 地域: 段 k }（8つ全部・0〜STEPS−1。toneOf() の答え）
 *   key    凡例の文
 *   on     選んだ地域（外枠を濃く）・hot 指している地域（外枠を薄く）── 見本の絵だけが渡す。ページのブロックはどちらも無しで書く
 *   id     null のとき id="wa-map" を書かない（見本の絵のように、1枚に何枚も並べるとき）
 *   uid    <use> が指す id の後ろに付ける字（1枚に何枚も並べるとき、id がぶつからないように）
 */
export function mapBox(o) {
  const u = o.uid ?? '';
  for (const r of PAINT) {
    if (typeof o.names?.[r] !== 'string' || !o.names[r]) throw new Error(`mapBox：${r} の名前が無い`);
    if (!Number.isInteger(o.tones?.[r]) || o.tones[r] < 0 || o.tones[r] >= STEPS) throw new Error(`mapBox：${r} の段「${o.tones?.[r]}」`);
  }
  if (typeof o.key !== 'string' || !o.key) throw new Error('mapBox：凡例の文が無い');
  for (const k of ['on', 'hot']) if (o[k] != null && !PAINT.includes(o[k])) throw new Error(`mapBox：${k}「${o[k]}」`);
  const st = r => (o.on === r ? ' is-on' : '') + (o.hot === r ? ' is-hot' : '');
  const J = JAPAN_MARK;
  const L = [];
  L.push('<div class="wam-mc">');
  L.push(`<div class="wam-map"${o.id === null ? '' : ' id="wa-map"'}>`);
  L.push('<svg class="wam-svg" viewBox="0 0 1000 440" aria-hidden="true" focusable="false">');
  /* 日本の当たりの丸を先に置く：あとから塗るロシアの陸地（サハリン）とアジアの陸地（朝鮮半島・中国の海岸・台湾）が上に来て、それぞれの答えを持つ */
  L.push(`<circle class="wam-hit wam-hit-t" data-region="japan" cx="${J.cx}" cy="${J.cy}" r="${J.rTouch}"/>`);
  L.push(`<circle class="wam-hit" data-region="japan" cx="${J.cx}" cy="${J.cy}" r="${J.rHit}"/>`);
  L.push(`<path class="wam-nl" d="${SHAPES.neutral}"/>`);
  for (const r of PAINT) L.push(`<g class="wam-r wam-t${o.tones[r]}${st(r)}" data-region="${r}"><path class="wam-land" id="wam-d-${r}${u}" d="${SHAPES[r]}"/></g>`);
  L.push('<g class="wam-ol">');
  for (const r of PAINT) {
    const ring = r === 'japan' ? `<circle class="wam-ring" cx="${J.cx}" cy="${J.cy}" r="${J.rRing}"/>` : '';
    L.push(`<g class="wam-o${st(r)}" data-region="${r}"><use class="wam-halo" href="#wam-d-${r}${u}"/><use class="wam-lit" href="#wam-d-${r}${u}"/>${ring}</g>`);
  }
  L.push('</g>');
  L.push('</svg>');
  for (const r of PAINT) {
    const p = LABELS[r];
    L.push(`<span class="wam-lbl${p.left ? ' wam-lbl-l' : ''}${st(r)}" data-region="${r}" style="left:${p.x.toFixed(1)}%;top:${p.y.toFixed(1)}%">${o.names[r]}</span>`);
  }
  L.push('</div>');
  const sw = Array.from({ length: STEPS }, (_, k) => `<rect class="wam-t${k}" x="${k * 10}" y="0" width="10" height="10"/>`).join('');
  L.push(`<p class="wam-key" aria-hidden="true"><svg class="wam-sw" viewBox="0 0 ${STEPS * 10} 10" focusable="false">${sw}</svg><span>${o.key}</span></p>`);
  L.push('</div>');
  return L.join('\n');
}
