/* ════════════════════════════════════════════════════════════════
   gen-globe-land.mjs ── スケジュールの地球儀（my-globe.js）の陸地の点 pv-globe-land.js を作る（2026-11-12）

     node gen-globe-land.mjs --from <生データのフォルダ>
     node gen-globe-land.mjs --from <…> --check     書かずに、いまの pv-globe-land.js と比べる

   読むもの: <--from>/ne_110m_land.geojson（Natural Earth「Land」1:110m・パブリックドメイン）
             https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
   書くもの: pv-globe-land.js だけ。

   ★点は緯度の行ごとに並べる（行の点の数は cos(緯度) に比例＝どこでも同じ間隔）。陸の上にある点だけ 1。
     行ごとの 0/1 を base64 にして持つ（約3KB）。地球儀が緯度経度に戻す。
   ★生データはリポジトリに入れない。フォルダの場所はこのファイルに書かない（ログイン名が入る）。
   ★ネットを叩かない・時計を読まない＝何度流しても同じバイト。
   ════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const from = arg('--from');
if (!from) { console.error('使い方: node gen-globe-land.mjs --from <ne_110m_land.geojson のあるフォルダ> [--check]'); process.exit(1); }
const gj = JSON.parse(fs.readFileSync(path.join(from, 'ne_110m_land.geojson'), 'utf8'));

const STEP = 1.5;                       // 点の間隔（度）。地球儀の大きさでいちばん見栄えのした値
const polys = [];                       // [[ring(外), ring(穴)…]…]（[lon, lat] の並び）
for (const f of gj.features || []) {
  const g = f && f.geometry;
  if (!g) continue;
  if (g.type === 'Polygon') polys.push(g.coordinates);
  else if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => polys.push(p));
}
if (!polys.length) { console.error('陸の形が1つも読めない'); process.exit(1); }
const boxes = polys.map((p) => {
  let a = Infinity, b = -Infinity, c = Infinity, e = -Infinity;
  p[0].forEach(([x, y]) => { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); e = Math.max(e, y); });
  return [a, b, c, e];
});
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function onLand(lon, lat) {
  for (let k = 0; k < polys.length; k++) {
    const b = boxes[k];
    if (lon < b[0] || lon > b[1] || lat < b[2] || lat > b[3]) continue;
    const p = polys[k];
    if (!inRing(lon, lat, p[0])) continue;
    let hole = false;
    for (let h = 1; h < p.length; h++) if (inRing(lon, lat, p[h])) { hole = true; break; }
    if (!hole) return true;
  }
  return false;
}

const rows = [];
let dots = 0, all = 0;
for (let lat = -90 + STEP / 2; lat < 90; lat += STEP) {
  const n = Math.max(1, Math.round((360 / STEP) * Math.cos((lat * Math.PI) / 180)));
  const bytes = new Uint8Array(Math.ceil(n / 8));
  for (let i = 0; i < n; i++) {
    const lon = -180 + (360 * (i + 0.5)) / n;
    all++;
    if (onLand(lon, lat)) { bytes[i >> 3] |= 1 << (i & 7); dots++; }
  }
  rows.push(n + ':' + Buffer.from(bytes).toString('base64'));
}

const out = `/* pv-globe-land.js — スケジュールの地球儀の陸地の点。★生成物：node gen-globe-land.mjs --from <フォルダ>（手で直さない）
   出典：Natural Earth「Land」1:110m（パブリックドメイン）https://www.naturalearthdata.com/
   緯度 ${STEP}° ごとの行に、cos(緯度) に比例した数の点。陸の上の点だけ 1（行ごとに base64）。${dots}点 / ${all}点。 */
(function (w) {
  'use strict';
  var STEP = ${STEP};
  var R = '${rows.join(';')}';
  var cache = null;
  /* → [緯度, 経度, 緯度, 経度, …]（Float32Array） */
  w.PV_GLOBE_LAND = function () {
    if (cache) return cache;
    var rows = R.split(';'), out = [], lat = -90 + STEP / 2;
    for (var r = 0; r < rows.length; r++, lat += STEP) {
      var p = rows[r].split(':'), n = +p[0], s = w.atob(p[1]);
      for (var i = 0; i < n; i++) {
        if (s.charCodeAt(i >> 3) & (1 << (i & 7))) out.push(lat, -180 + 360 * (i + 0.5) / n);
      }
    }
    cache = new Float32Array(out);
    return cache;
  };
}(typeof window !== 'undefined' ? window : globalThis));
`;
const file = path.join(ROOT, 'pv-globe-land.js');
if (process.argv.includes('--check')) {
  const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  console.log(now === out ? '✓ 変更なし' : '✗ 中身が違う（流し直すと変わる）');
  process.exit(now === out ? 0 : 1);
}
fs.writeFileSync(file, out);
console.log(`pv-globe-land.js: ${dots}点 / ${all}点・${(out.length / 1024).toFixed(1)}KB`);
