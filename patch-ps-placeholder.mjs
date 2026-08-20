/* 乗務時間の入力欄のプレースホルダ「78.5」が、実際に入った値と同じ見た目だった。
   ＝「もう入っている」と読めてしまう。入っていない状態は必ず薄く出す。
   実行: node patch-ps-placeholder.mjs                                       */
import { readFileSync, writeFileSync } from 'fs';

const ANCHOR_DARK = `.ps-ask-in input:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:2px}`;
const ADD_DARK = `
.ps-ask-in input::placeholder{color:#5c6a7d;font-weight:600;opacity:1}`;

const ANCHOR_LIGHT = `[data-theme="light"] .ps-ask-in input:focus{border-color:#a97e00;background:#fffdf5}`;
const ADD_LIGHT = `
[data-theme="light"] .ps-ask-in input::placeholder{color:#94a3b8}`;

for (const file of ['pay-report.html', 'en/pay-report.html']) {
  let s = readFileSync(file, 'utf8');
  const before = s.length;
  if (s.includes('.ps-ask-in input::placeholder')) throw new Error(`${file}: 既に入っている`);
  for (const [anchor, add] of [[ANCHOR_DARK, ADD_DARK], [ANCHOR_LIGHT, ADD_LIGHT]]) {
    const n = s.split(anchor).length - 1;
    if (n !== 1) throw new Error(`${file}: アンカーが ${n} 箇所 — ${anchor}`);
    s = s.replace(anchor, anchor + add);
  }
  if ((s.split('.ps-ask-in input::placeholder').length - 1) !== 2) throw new Error(`${file}: 個数が合わない`);
  if ((s.match(/<\/html>/g) || []).length !== 1) throw new Error(`${file}: </html> が1つでない`);
  writeFileSync(file, s);
  console.log(`✅ ${file}  ${before} → ${s.length} bytes`);
}
