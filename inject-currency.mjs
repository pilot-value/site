import fs from 'fs';
import path from 'path';

// currency.js（通貨切替ランタイム）を全 HTML に注入する冪等バッチ。
// - currency.js はルート直下にあるため、サブディレクトリからは相対パスで参照する。
// - lang-toggle.js の後に走らせたいので </body> の直前に挿入（トグルが JP/EN 切替の隣に出る）。
// - 既に注入済みのページはスキップ（冪等）。

const dirs = {
  '.':            'currency.js',
  './airlines':    '../currency.js',
  './en':          '../currency.js',
  './en/airlines': '../../currency.js',
};

const MARKER = /src="[^"]*currency\.js"/;

let updated = 0, already = 0, skipped = 0;

for (const [dir, rel] of Object.entries(dirs)) {
  if (!fs.existsSync(dir)) continue;
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.html')) continue;
    const fp = path.join(dir, entry);
    let html = fs.readFileSync(fp, 'utf8');

    if (MARKER.test(html)) { already++; continue; }

    const idx = html.lastIndexOf('</body>');
    if (idx === -1) { skipped++; console.log('  ! </body>なし:', fp); continue; }

    const tag = `<script src="${rel}"></script>\n`;
    html = html.slice(0, idx) + tag + html.slice(idx);
    fs.writeFileSync(fp, html, 'utf8');
    updated++;
  }
}

console.log('\n=== currency.js 注入完了 ===');
console.log(`✓ 注入: ${updated}ページ`);
console.log(`- 既存: ${already}ページ`);
console.log(`- スキップ: ${skipped}ページ`);
