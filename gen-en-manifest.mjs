// Regenerate the EN allowlist blocks in lang-toggle.js from the real contents of en/.
//   EN_AIRLINES — from en/airlines/*.html
//   EN_PAGES    — from en/*.html (top-level pages; index.html is handled separately by jaToEn)
// Run after adding/removing any EN page:  node gen-en-manifest.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const slugs = fs.readdirSync(path.join(__dirname, 'en', 'airlines'))
  .filter(f => f.endsWith('.html'))
  .map(f => f.replace(/\.html$/, ''))
  .sort();

// 6 slugs per line, matching the existing hand-formatted block
const lines = [];
for (let i = 0; i < slugs.length; i += 6) {
  lines.push('    ' + slugs.slice(i, i + 6).map(s => JSON.stringify(s)).join(', '));
}
const block =
  '  /* EN-AIRLINES:BEGIN (auto-generated from en/airlines/*.html — do not hand-edit) */\n' +
  '  var EN_AIRLINES = new Set([\n' +
  lines.join(',\n') + '\n' +
  '  ]);\n' +
  '  /* EN-AIRLINES:END */';

// Top-level EN pages (en/*.html). index.html is mapped by jaToEn's '/' rule, so it is excluded here.
const pages = fs.readdirSync(path.join(__dirname, 'en'))
  .filter(f => f.endsWith('.html') && f !== 'index.html')
  .sort();

const pageLines = [];
for (let i = 0; i < pages.length; i += 4) {
  pageLines.push('    ' + pages.slice(i, i + 4).map(s => JSON.stringify(s)).join(', '));
}
const pageBlock =
  '  /* EN-PAGES:BEGIN (auto-generated from en/*.html — do not hand-edit) */\n' +
  '  var EN_PAGES = new Set([\n' +
  (pageLines.length ? pageLines.join(',\n') + '\n' : '') +
  '  ]);\n' +
  '  /* EN-PAGES:END */';

// Country hub pages (en/countries/*.html)
const countries = fs.existsSync(path.join(__dirname, 'en', 'countries'))
  ? fs.readdirSync(path.join(__dirname, 'en', 'countries'))
      .filter(f => f.endsWith('.html'))
      .map(f => f.replace(/\.html$/, ''))
      .sort()
  : [];

const cLines = [];
for (let i = 0; i < countries.length; i += 4) {
  cLines.push('    ' + countries.slice(i, i + 4).map(s => JSON.stringify(s)).join(', '));
}
const countryBlock =
  '  /* EN-COUNTRIES:BEGIN (auto-generated from en/countries/*.html — do not hand-edit) */\n' +
  '  var EN_COUNTRIES = new Set([\n' +
  (cLines.length ? cLines.join(',\n') + '\n' : '') +
  '  ]);\n' +
  '  /* EN-COUNTRIES:END */';

const file = path.join(__dirname, 'lang-toggle.js');
let src = fs.readFileSync(file, 'utf8');
const re = /  \/\* EN-AIRLINES:BEGIN[\s\S]*?EN-AIRLINES:END \*\//;
if (!re.test(src)) { console.error('EN-AIRLINES markers not found in lang-toggle.js'); process.exit(1); }
src = src.replace(re, block);

const pageRe = /  \/\* EN-PAGES:BEGIN[\s\S]*?EN-PAGES:END \*\//;
if (!pageRe.test(src)) { console.error('EN-PAGES markers not found in lang-toggle.js'); process.exit(1); }
src = src.replace(pageRe, pageBlock);

const countryRe = /  \/\* EN-COUNTRIES:BEGIN[\s\S]*?EN-COUNTRIES:END \*\//;
if (!countryRe.test(src)) { console.error('EN-COUNTRIES markers not found in lang-toggle.js'); process.exit(1); }
src = src.replace(countryRe, countryBlock);

fs.writeFileSync(file, src);
console.log(`EN_AIRLINES  updated: ${slugs.length} slugs`);
console.log(`EN_PAGES     updated: ${pages.length} pages (${pages.join(', ') || 'none'})`);
console.log(`EN_COUNTRIES updated: ${countries.length} countries`);
