/* ════════════════════════════════════════════════════════════════
   gen-airport-tz.mjs — 空港（IATA 3字）→ タイムゾーン（IANA）の表 pv-airport-tz.js を作る
   ★2026-11-11 オーナー「Local タイムでも計算されるようにしてよ」── 勤務表の時刻が現地時刻のとき、
     出発地と到着地のタイムゾーンで UTC に直して便の時間を出す（pv-report-engine.js の legOf）。

   出典：mwgg/Airports（MIT License, Copyright (c) 2014 mwgg）https://github.com/mwgg/Airports
   ★元の airports.json（約9MB）はリポジトリに入れない。手元に落としてから流す：
     curl -sL -o /tmp/airports.json https://raw.githubusercontent.com/mwgg/Airports/master/airports.json
     node gen-airport-tz.mjs /tmp/airports.json
   ★書くのは「IATA の3字とタイムゾーン」だけ（空港名・位置は持たない）。何度流しても同じ結果になる。
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
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
