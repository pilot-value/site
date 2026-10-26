/* ════════════════════════════════════════════════════════════════
   inject-session.mjs — pv-session.js を全 HTML に注入する冪等バッチ

   手本は inject-currency.mjs。ただし挿入位置だけ違う。

   ★currency.js は </body> の直前だが、pv-session.js は </head> の直前。
     ログイン状態の UI 判定（ナビの名前表示・口コミゲート・プレミアム錠）は
     localStorage の pv_user を body 内のスクリプトで読む。失効判定が
     それより後に走ると「消したはずのユーザー名が一瞬出る」ので、
     head で先に終わらせる必要がある。

   ・pv-session.js はルート直下。サブディレクトリからは相対パスで参照する
   ・中身の指紋を版として付ける。既存の参照も更新する（何度実行しても同じ結果）
   ・"temporary screenshots/" は本番ページではないので対象外

   実行: node inject-session.mjs
════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';

const dirs = {
  '.':              'pv-session.js',
  './airlines':     '../pv-session.js',
  './countries':    '../pv-session.js',
  './en':           '../pv-session.js',
  './en/airlines':  '../../pv-session.js',
  './en/countries': '../../pv-session.js',
};

const MARKER = /src="[^"]*pv-session\.js(?:\?[^"]*)?"/;
const VERSION = createHash('sha256').update(fs.readFileSync('pv-session.js')).digest('hex').slice(0, 8);

let updated = 0, already = 0, skipped = 0;

for (const [dir, rel] of Object.entries(dirs)) {
  if (!fs.existsSync(dir)) continue;
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.html')) continue;
    const fp = path.join(dir, entry);
    let html = fs.readFileSync(fp, 'utf8');

    if (MARKER.test(html)) {
      const next = html.replace(MARKER, () => `src="${rel}?v=${VERSION}"`);
      if (next === html) { already++; continue; }
      fs.writeFileSync(fp, next, 'utf8');
      updated++;
      continue;
    }

    const idx = html.lastIndexOf('</head>');
    if (idx === -1) { skipped++; console.log('  ! </head>なし:', fp); continue; }

    const tag = `<script src="${rel}?v=${VERSION}"></script>\n`;
    html = html.slice(0, idx) + tag + html.slice(idx);
    fs.writeFileSync(fp, html, 'utf8');
    updated++;
  }
}

console.log('\n=== pv-session.js 注入完了 ===');
console.log(`✓ 更新: ${updated}ページ`);
console.log(`- 既存: ${already}ページ`);
console.log(`- スキップ: ${skipped}ページ`);
