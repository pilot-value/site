// Audit: how far does each EN airline page's headline salary drift from SSOT?
// Extracts the two "Avg" stat-card values (Capt / FO) as ¥XXM → XX*100 万, compares to SALARY[slug].
// Reports only drift; does NOT modify anything.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SALARY } from './salary-data.mjs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dir = path.join(__dirname, 'en', 'airlines');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

// ¥37M -> 3700 (万) ; ¥6.16M? no, pages use whole/one-decimal M meaning millions-of-yen*... actually ¥37M = 3,700万.
function mToMan(numStr) { return Math.round(parseFloat(numStr) * 100); }

// grab the value immediately before a label like "Capt. Avg" / "FO Avg"
function statVal(html, labelRe) {
  const re = new RegExp('>\\s*~?¥([\\d.]+)M\\s*<[^>]*>\\s*<div class="text-xs text-muted">\\s*' + labelRe, 'i');
  const m = html.match(re);
  return m ? mToMan(m[1]) : null;
}

let drifted = 0, clean = 0, unknown = 0;
const rows = [];
for (const f of files) {
  const slug = f.replace(/\.html$/, '');
  const d = SALARY[slug];
  const html = fs.readFileSync(path.join(dir, f), 'utf8');
  if (!d) { unknown++; rows.push(`?  ${slug.padEnd(22)} (not in SSOT)`); continue; }
  const capEn = statVal(html, 'Capt');
  const foEn  = statVal(html, 'FO Avg');
  const capOk = capEn != null && Math.abs(capEn - d.cap.avg) <= 50;   // ≤¥0.5M tolerance
  const foOk  = foEn  != null && Math.abs(foEn  - d.fo.avg)  <= 50;
  if (capEn == null && foEn == null) { unknown++; rows.push(`?  ${slug.padEnd(22)} (no stat cards matched)`); continue; }
  if (capOk && foOk) { clean++; }
  else {
    drifted++;
    rows.push(`✗  ${slug.padEnd(22)} cap EN=${capEn}万 vs SSOT=${d.cap.avg}万  |  fo EN=${foEn}万 vs SSOT=${d.fo.avg}万`);
  }
}
console.log(rows.join('\n'));
console.log(`\n==== ${files.length} EN pages: ${clean} clean, ${drifted} drifted, ${unknown} unknown ====`);
