/* ════════════════════════════════════════════════════════════════
   gen-airport-tz.mjs — 空港（IATA 3字）→ タイムゾーン（IANA）の表 pv-airport-tz.js を作る
   ★2026-11-11 オーナー「Local タイムでも計算されるようにしてよ」── 勤務表の時刻が現地時刻のとき、
     出発地と到着地のタイムゾーンで UTC に直して便の時間を出す（pv-report-engine.js の legOf）。

   出典：mwgg/Airports（MIT License, Copyright (c) 2014 mwgg）https://github.com/mwgg/Airports
   ★元の airports.json（約9MB）はリポジトリに入れない。手元に落としてから流す：
     curl -sL -o /tmp/airports.json https://raw.githubusercontent.com/mwgg/Airports/master/airports.json
     node gen-airport-tz.mjs /tmp/airports.json
   ★書くのは「IATA の3字とタイムゾーン」だけ（空港名・位置は持たない）。何度流しても同じ結果になる。
   ★2026-11-12 もう1枚 pv-airport-geo.js（空港 → 位置と街の名前）も書く。スケジュールの地球儀（my-globe.js）が、
     飛んだ区間を地図に描くのに使う（地球儀を開いたときだけ読む）。位置は小数2桁（約1km）・街の名前は英語（mwgg）と、
     サイトの就航地の表（airline-destinations.mjs）に在る空港だけ日本語も。
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { PLACES, RESEARCH_PLACES, CODE_PLACES } from './airline-destinations.mjs';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const src = process.argv[2];
if (!src) { console.error('使い方: node gen-airport-tz.mjs <airports.json>'); process.exit(1); }
const j = JSON.parse(readFileSync(src, 'utf8'));
const by = {};
for (const a of Object.values(j)) {
  if (!a || !/^[A-Z0-9]{3}$/.test(a.iata || '') || !/^[A-Za-z_]+(\/[A-Za-z0-9_+\-]+)+$/.test(a.tz || '')) continue;
  (by[a.tz] = by[a.tz] || new Set()).add(a.iata);
}
const tzs = Object.keys(by).sort();
let n = 0;
const body = tzs.map((tz) => { const c = [...by[tz]].sort(); n += c.length; return `    ${JSON.stringify(tz)}: '${c.join('')}'`; }).join(',\n');
const out = `/* pv-airport-tz.js — 空港（IATA 3字）→ タイムゾーン（IANA）。★生成物：node gen-airport-tz.mjs <airports.json>（手で直さない）
   出典：mwgg/Airports（MIT License, Copyright (c) 2014 mwgg）https://github.com/mwgg/Airports
   用途：勤務表の時刻が現地時刻のとき、出発地と到着地のタイムゾーンで便の時間を出す（pv-report-engine.js の legOf）。
   ${n}空港・${tzs.length}のタイムゾーン。 */
(function (w) {
  'use strict';
  var Z = {
${body}
  };
  var M = null;
  w.PV_AIRPORT_TZ = function (code) {
    if (!M) {
      M = {};
      Object.keys(Z).forEach(function (tz) { var s = Z[tz]; for (var i = 0; i + 3 <= s.length; i += 3) M[s.slice(i, i + 3)] = tz; });
    }
    return M[String(code || '').toUpperCase()] || null;
  };
}(typeof window !== 'undefined' ? window : globalThis));
`;
writeFileSync(path.join(ROOT, 'pv-airport-tz.js'), out);
console.log(`pv-airport-tz.js: ${n}空港・${tzs.length}のタイムゾーン・${(out.length / 1024).toFixed(0)}KB`);

/* ── 2枚目：pv-airport-geo.js（IATA と ICAO → [緯度, 経度, 街の名前 en, ja]）──────────── */
const JA = Object.assign({}, CODE_PLACES, RESEARCH_PLACES, PLACES);
const rows = [];
for (const a of Object.values(j)) {
  if (!a || !/^[A-Z0-9]{3}$/.test(a.iata || '')) continue;
  const lat = Number(a.lat), lon = Number(a.lon);
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
  const icao = /^[A-Z0-9]{4}$/.test(a.icao || '') ? a.icao : '';
  const clean = (t) => String(t || '').replace(/[|;]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  const ja = JA[a.iata] ? clean(JA[a.iata][0]) : '';
  rows.push([a.iata, icao, Math.round(lat * 100), Math.round(lon * 100), clean(a.city), ja]);
}
rows.sort((p, q) => (p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0));
const seen = new Set();
const uniq = rows.filter((r) => (seen.has(r[0]) ? false : (seen.add(r[0]), true)));
const packed = uniq.map((r) => r.join('|')).join(';');
const geo = `/* pv-airport-geo.js — 空港（IATA 3字・ICAO 4字）→ 位置と街の名前。★生成物：node gen-airport-tz.mjs <airports.json>（手で直さない）
   出典：mwgg/Airports（MIT License, Copyright (c) 2014 mwgg）https://github.com/mwgg/Airports
   日本語の街の名前は airline-destinations.mjs（サイトの就航地の表）に在る空港だけ。
   用途：スケジュールの地球儀（my-globe.js）が飛んだ区間を描く。地球儀を開いたときだけ読む。${uniq.length}空港。 */
(function (w) {
  'use strict';
  var P = '${packed.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}';
  var M = null;
  w.PV_AIRPORT_GEO = function (code) {
    if (!M) {
      M = {};
      P.split(';').forEach(function (s) {
        var f = s.split('|'), o = { iata: f[0], lat: +f[2] / 100, lon: +f[3] / 100, en: f[4] || '', ja: f[5] || '' };
        M[f[0]] = o; if (f[1]) M[f[1]] = o;
      });
    }
    return M[String(code || '').toUpperCase()] || null;
  };
}(typeof window !== 'undefined' ? window : globalThis));
`;
writeFileSync(path.join(ROOT, 'pv-airport-geo.js'), geo);
console.log(`pv-airport-geo.js: ${uniq.length}空港・${(geo.length / 1024).toFixed(0)}KB`);
