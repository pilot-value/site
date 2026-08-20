/* ════════════════════════════════════════════════════════════════
   gen-salary-json.mjs
   単一データソース salary-data.mjs の SALARY を、ブラウザから fetch できる
   salary-data.json に書き出す。（gen-airline-codes.mjs と同型の生成物）

   用途: サラリーエンジン（world-airlines.html のレンジ比較ビュー等）が
   実行時にこの JSON を fetch して、会社×機長/副操縦士×レンジを描画する。
   salary-data.mjs はビルド時用ESMでブラウザから直接読めないため、ここで
   同一内容の JSON を生成して供給する。

   ⚠️ salary-data.json は「生成物」。手編集禁止。数値を変える時は必ず
   salary-data.mjs（＝唯一の正）を更新し、本スクリプトを再実行すること。
   整合は check-salary.mjs が検証する（json==SALARY を含む）。

   実行: node gen-salary-json.mjs
════════════════════════════════════════════════════════════════ */
import { writeFileSync } from 'fs';
import { buildSalaryJson } from './salary-data.mjs';

// 出力は {spine: 背骨8段, airlines: {slug: {...SALARY, ladder}}}。
// ladder は salary-data.mjs が SSOT から機械導出（ANA/JAL=監修実数, 他社=推計）。
const payload = buildSalaryJson();
const out = new URL('./salary-data.json', import.meta.url);
writeFileSync(out, JSON.stringify(payload));

const n = Object.keys(payload.airlines).length;
console.log('✅ salary-data.json 書き出し:', n, '社 ／ 背骨', payload.spine.length, '段');
