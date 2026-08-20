/* 黒塗り矩形の操作部を「枠の内側」に入れる。
   矩形は既定で画像の上端・左右いっぱいに置かれるので、外側オフセットだと
   ×とつまみが画像の外へ出て切れる＝消せない・縮められない。
   矩形は必ず黒なので、操作部は白丸で固定（テーマ分岐が要らなくなる）。
   実行: node patch-payslip2.mjs                                            */
import { readFileSync, writeFileSync } from 'fs';

const FILES = ['pay-report.html', 'en/pay-report.html'];

const SUBS = [
  [`.ps-rect-del{position:absolute;top:-9px;right:-9px;width:20px;height:20px;line-height:1;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:#1a2029;color:#e8edf2;`,
   `.ps-rect-del{position:absolute;top:6px;right:6px;width:22px;height:22px;line-height:1;border-radius:999px;border:1px solid rgba(0,0,0,.3);background:rgba(255,255,255,.92);color:#0f172a;`],

  [`.ps-rect-grip{position:absolute;right:-6px;bottom:-6px;width:14px;height:14px;`,
   `.ps-rect-grip{position:absolute;right:3px;bottom:3px;width:16px;height:16px;`],

  // 白丸で固定したのでライトモードの上書きは要らない（残すと死にCSS）
  [`[data-theme="light"] .ps-rect-del{background:#fff;border-color:rgba(0,0,0,.25);color:#0f172a}\n`, ``],
];

let n = 0;
for (const f of FILES) {
  let s = readFileSync(f, 'utf8');
  const before = s.length;
  for (const [from, to] of SUBS) {
    const c = s.split(from).length - 1;
    if (c !== 1) throw new Error(`${f}: 「${from.slice(0, 40)}…」が ${c} 箇所（1でない）`);
    s = s.replace(from, to);
  }
  // 触ってはいけないものが無事か
  if ((s.match(/<option /g) || []).length !== 683) throw new Error(`${f}: option 数が変わった`);
  if ((s.match(/class="chip"/g) || []).length !== 8) throw new Error(`${f}: チップ数が変わった`);
  if ((s.match(/<\/html>/g) || []).length !== 1) throw new Error(`${f}: </html> が1つでない`);
  if (!s.includes('/*BEGIN:PVMETA*/') || !s.includes('/*END:PVMETA*/')) throw new Error(`${f}: PVMETA が消えた`);
  if (/transition:\s*all/.test(s)) throw new Error(`${f}: transition:all が入った`);
  if (s.indexOf('/* ── Light mode') > s.indexOf('.ps-rect-grip{position')) { /* 順序は据え置き */ }
  writeFileSync(f, s);
  console.log(`✅ ${f}  ${before} → ${s.length} bytes`);
  n++;
}
console.log(`── ${n} ファイル`);
