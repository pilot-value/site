/* 乗務時間を打ち始めたら、この箱は「質問」ではなく「欄」になる。
   点線＋黄色の警告っぽい見た目から、静かな欄の見た目へ落とす。
   実行: node patch-ps-ask-filled.mjs                                        */
import { readFileSync, writeFileSync } from 'fs';

const ANCHOR_DARK = `.ps-ask-in span{font-size:.78rem;font-weight:700;color:#a8b3c2}`;
const ADD_DARK = `
.ps-ask.is-filled{border-style:solid;border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.03)}
.ps-ask.is-filled .ps-ask-t{font-size:.74rem;font-weight:700;color:#a8b3c2}`;

const ANCHOR_LIGHT = `[data-theme="light"] .ps-ask-in input:focus{border-color:#a97e00;background:#fffdf5}`;
const ADD_LIGHT = `
[data-theme="light"] .ps-ask.is-filled{border-color:rgba(0,0,0,.1);background:rgba(255,255,255,.7)}
[data-theme="light"] .ps-ask.is-filled .ps-ask-t{color:#475569}`;

for (const file of ['pay-report.html', 'en/pay-report.html']) {
  let s = readFileSync(file, 'utf8');
  const before = s.length;
  if (s.includes('.ps-ask.is-filled{')) throw new Error(`${file}: 既に入っている`);
  for (const [anchor, add] of [[ANCHOR_DARK, ADD_DARK], [ANCHOR_LIGHT, ADD_LIGHT]]) {
    const n = s.split(anchor).length - 1;
    if (n !== 1) throw new Error(`${file}: アンカーが ${n} 箇所 — ${anchor}`);
    s = s.replace(anchor, anchor + add);
  }
  if ((s.split('\n.ps-ask.is-filled{').length - 1) !== 1) throw new Error(`${file}: 個数が合わない`);
  if ((s.match(/<\/html>/g) || []).length !== 1) throw new Error(`${file}: </html> が1つでない`);
  writeFileSync(file, s);
  console.log(`✅ ${file}  ${before} → ${s.length} bytes`);
}
