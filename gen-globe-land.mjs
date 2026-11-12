/* ════════════════════════════════════════════════════════════════
   gen-globe-land.mjs ── スケジュールの地球儀（my-globe.js）の陸地の点 pv-globe-land.js を作る（2026-11-12）

     node gen-globe-land.mjs --from <生データのフォルダ>
     node gen-globe-land.mjs --from <…> --check     書かずに、いまの pv-globe-land.js と比べる

   読むもの: <--from>/ne_50m_land.geojson（Natural Earth「Land」1:50m・パブリックドメイン）
             https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson
   書くもの: pv-globe-land.js だけ。

   ★点の細かさは4段（2°・1°・0.5°・0.25°）。地球儀は拡大するほど細かい段を使う（オーナー「拡大したら点も細かく」）。
     どの段も、緯度の行ごとに cos(緯度) に比例した数の点（どこでも同じ間隔）。陸の上の点だけ 1、行ごとに base64。
   ★陸かどうかは行ごとの走査線（その緯度で陸の縁と交わる経度を並べ、左から数えて奇数番目の内側）＝ 速くて、穴（湖）も正しく抜ける。
   ★生データはリポジトリに入れない。フォルダの場所はこのファイルに書かない（ログイン名が入る）。
   ★ネットを叩かない・時計を読まない＝何度流しても同じバイト。
   ════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const from = arg('--from');
if (!from) { console.error('使い方: node gen-globe-land.mjs --from <ne_50m_land.geojson のあるフォルダ> [--check]'); process.exit(1); }
const gj = JSON.parse(fs.readFileSync(path.join(from, 'ne_50m_land.geojson'), 'utf8'));

const STEPS = [2, 1, 0.5, 0.25];        // 点の間隔（度）。地球儀が拡大するほど右の段
const rings = [];                       // 陸の縁（外側も穴も）＝ [lon, lat] の並び
for (const f of gj.features || []) {
  const g = f && f.geometry;
  if (!g) continue;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  for (const p of polys) for (const r of p) rings.push(r);
}
if (!rings.length) { console.error('陸の形が1つも読めない'); process.exit(1); }
/* 縁を辺に（緯度の低い順に並べて、行ごとに交わる辺だけを見る） */
const edges = [];
for (const r of rings) {
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [x1, y1] = r[j], [x2, y2] = r[i];
    if (y1 === y2) continue;
    edges.push(y1 < y2 ? [y1, y2, x1, x2] : [y2, y1, x2, x1]);   // [下の緯度, 上の緯度, 下の経度, 上の経度]
  }
}
edges.sort((a, b) => a[0] - b[0]);

function level(step) {
  const rows = [];
  let dots = 0, all = 0;
  for (let lat = -90 + step / 2; lat < 90; lat += step) {
    const xs = [];
    for (const e of edges) {
      if (e[0] > lat) break;
      if (e[1] <= lat) continue;
      xs.push(e[2] + ((lat - e[0]) / (e[1] - e[0])) * (e[3] - e[2]));
    }
    xs.sort((a, b) => a - b);
    const n = Math.max(1, Math.round((360 / step) * Math.cos((lat * Math.PI) / 180)));
    const bytes = new Uint8Array(Math.ceil(n / 8));
    let k = 0;
    for (let i = 0; i < n; i++) {
      const lon = -180 + (360 * (i + 0.5)) / n;
      while (k < xs.length && xs[k] < lon) k++;
      all++;
      if (k % 2 === 1) { bytes[i >> 3] |= 1 << (i & 7); dots++; }
    }
    rows.push(n + ':' + Buffer.from(bytes).toString('base64'));
  }
  return { step, rows, dots, all };
}
const L = STEPS.map(level);

const out = `/* pv-globe-land.js — スケジュールの地球儀の陸地の点。★生成物：node gen-globe-land.mjs --from <フォルダ>（手で直さない）
   出典：Natural Earth「Land」1:50m（パブリックドメイン）https://www.naturalearthdata.com/
   点の細かさは ${STEPS.length}段（${STEPS.map((s) => s + '°').join('・')}）。拡大するほど細かい段を使う。
   緯度の行ごとに cos(緯度) に比例した数の点・陸の上の点だけ 1（行ごとに base64）。
   ${L.map((l) => l.step + '°＝' + l.dots + '点').join('・')}。 */
(function (w) {
  'use strict';
  var L = [
${L.map((l) => `    { step: ${l.step}, rows: '${l.rows.join(';')}' }`).join(',\n')}
  ];
  /* 段ごとに、行（緯度・点の数・陸の印）を1回だけ読み解く。印は Uint8Array（i 番目の点＝ i>>3 の (i&7) ビット） */
  var cache = [];
  w.PV_GLOBE_LAND = function (lv) {
    lv = Math.max(0, Math.min(L.length - 1, lv | 0));
    if (cache[lv]) return cache[lv];
    var src = L[lv], rs = src.rows.split(';'), lat = -90 + src.step / 2, rows = [];
    for (var r = 0; r < rs.length; r++, lat += src.step) {
      var p = rs[r].split(':'), s = w.atob(p[1]), b = new Uint8Array(s.length);
      for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
      rows.push({ lat: lat, n: +p[0], bits: b });
    }
    return (cache[lv] = { step: src.step, rows: rows });
  };
  w.PV_GLOBE_LAND.levels = L.map(function (x) { return x.step; });
}(typeof window !== 'undefined' ? window : globalThis));
`;
const file = path.join(ROOT, 'pv-globe-land.js');
if (process.argv.includes('--check')) {
  const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  console.log(now === out ? '✓ 変更なし' : '✗ 中身が違う（流し直すと変わる）');
  process.exit(now === out ? 0 : 1);
}
fs.writeFileSync(file, out);
console.log(`pv-globe-land.js: ${L.map((l) => l.step + '°=' + l.dots).join(' / ')}・${(out.length / 1024).toFixed(0)}KB`);
