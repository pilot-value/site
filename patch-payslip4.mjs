/* 確認画像の高さを画面に収める。
   縦長の写真（スマホで撮った明細＝ほぼ全部これ）だと、原寸比で幅いっぱいに
   広げると画像だけで数画面ぶんになり、「この画像を送る」がはるか下に沈む。
   確認画面は「一目で全部見えて、その場で押せる」こと自体が仕事なので、
   画像は 62vh に収める。

   ★矩形は .ps-stage に対する % で置いているので、stage が canvas より
     大きいとズレる（＝見えている黒帯と、実際に焼く場所が食い違う）。
     stage を canvas に張り付かせる（width:fit-content）ことでズレを防ぐ。
   実行: node patch-payslip4.mjs                                            */
import { readFileSync, writeFileSync } from 'fs';

const FILES = ['pay-report.html', 'en/pay-report.html'];
const SUBS = [
  [`.ps-stage{position:relative;line-height:0;border-radius:10px;overflow:hidden;background:#0b0f14;touch-action:none}`,
   `.ps-stage{position:relative;display:block;width:fit-content;max-width:100%;margin:0 auto;line-height:0;border-radius:10px;overflow:hidden;background:#0b0f14;touch-action:none}`],
  [`.ps-cv{width:100%;height:auto;display:block}`,
   `.ps-cv{display:block;max-width:100%;max-height:62vh;width:auto;height:auto}`],
];

for (const f of FILES) {
  let s = readFileSync(f, 'utf8');
  const before = s.length;
  for (const [from, to] of SUBS) {
    const c = s.split(from).length - 1;
    if (c !== 1) throw new Error(`${f}: 「${from.slice(0, 40)}…」が ${c} 箇所`);
    s = s.replace(from, to);
  }
  if ((s.match(/<option /g) || []).length !== 683) throw new Error(`${f}: option 数が変わった`);
  if (/transition:\s*all/.test(s)) throw new Error(`${f}: transition:all が入った`);
  writeFileSync(f, s);
  console.log(`✅ ${f}  ${before} → ${s.length} bytes`);
}
