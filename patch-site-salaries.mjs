// patch-site-salaries.mjs
// salary-data.mjs を単一の正として、index.html のランキング配列と
// world-airlines.html の一覧 salary を機械反映（+再ソート・pct再計算）。
// 再実行可能・冪等。node patch-site-salaries.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { SALARY } from './salary-data.mjs';

const read = (p) => readFileSync(p, 'utf8');
const write = (p, s) => writeFileSync(p, s);

const man = (n) => '¥' + n.toLocaleString('en-US') + '万';
const parseMan = (s) => parseInt(String(s).replace(/[^\d]/g, ''), 10); // '¥9,000万+' -> 9000
const slugOf = (entry) => (entry.match(/page:'airlines\/([^']+)\.html'/) || [])[1];

let report = [];

// ── index.html: captainData / foData ─────────────────────────────
function patchRankingArray(content, varName, which) {
  const re = new RegExp(`const ${varName} = \\[[\\s\\S]*?\\n\\];`);
  const block = content.match(re);
  if (!block) { console.error(`!! ${varName} not found`); return content; }
  const body = block[0];
  const entries = body.match(/\{[^{}]*\}/g) || [];
  // update avg from SALARY where slug matches
  const parsed = entries.map((e) => {
    const slug = slugOf(e);
    let avg = parseMan((e.match(/avg:'([^']*)'/) || [])[1] || '0');
    let updated = e;
    if (slug && SALARY[slug]) {
      avg = SALARY[slug][which].avg;
      updated = e.replace(/avg:'[^']*'/, `avg:'${man(avg)}'`);
      report.push(`${varName}: ${slug} -> ${man(avg)}`);
    }
    return { slug, avg, text: updated };
  });
  const maxAvg = Math.max(...parsed.map((p) => p.avg));
  parsed.sort((a, b) => b.avg - a.avg);
  const out = parsed.map((p) => {
    const pct = Math.max(1, Math.round((p.avg / maxAvg) * 100));
    return p.text.replace(/pct:\s*\d+/, `pct:${pct}`);
  });
  const rebuilt = `const ${varName} = [\n  ${out.join(',\n  ')},\n];`;
  return content.replace(re, rebuilt);
}

let idx = read('index.html');
idx = patchRankingArray(idx, 'captainData', 'cap');
idx = patchRankingArray(idx, 'foData', 'fo');
write('index.html', idx);

// ── world-airlines.html: per-line salary field (captain avg) ─────
let wa = read('world-airlines.html');
let waCount = 0;
wa = wa.replace(/\{[^{}]*file:'airlines\/([^']+)\.html'[^{}]*\}/g, (line, slug) => {
  if (!SALARY[slug]) return line;
  const newSalary = man(SALARY[slug].cap.avg);
  waCount++;
  report.push(`world-airlines: ${slug} -> ${newSalary}`);
  return line.replace(/salary:'[^']*'/, `salary:'${newSalary}'`);
});
write('world-airlines.html', wa);

console.log(report.join('\n'));
console.log(`\n✅ index.html arrays patched. world-airlines.html: ${waCount} rows updated.`);
