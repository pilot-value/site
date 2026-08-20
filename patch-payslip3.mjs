/* 「これが、これから送られる画像です。」を画像の真下に出すための1行。
   ps-lead と同じ太さだと見出しが2つ並んで見えるので、少しだけ落とす。
   実行: node patch-payslip3.mjs                                            */
import { readFileSync, writeFileSync } from 'fs';

const FILES = ['pay-report.html', 'en/pay-report.html'];
const FROM = `.ps-lead{font-size:.82rem;font-weight:700;color:#e8edf2;margin-bottom:10px}`;
const TO = FROM + `\n.ps-lead-sm{font-size:.78rem;font-weight:600;color:#f5c842;margin:10px 0 2px}`;
const LIGHT_FROM = `[data-theme="light"] .ps-rect{border-color:rgba(200,149,0,.85)}`;
const LIGHT_TO = LIGHT_FROM + `\n[data-theme="light"] .ps-lead-sm{color:#a97e00}`;

for (const f of FILES) {
  let s = readFileSync(f, 'utf8');
  const before = s.length;
  for (const [from, to] of [[FROM, TO], [LIGHT_FROM, LIGHT_TO]]) {
    const c = s.split(from).length - 1;
    if (c !== 1) throw new Error(`${f}: 「${from.slice(0, 40)}…」が ${c} 箇所`);
    s = s.replace(from, to);
  }
  if (s.indexOf('[data-theme="light"] .ps-lead-sm') < s.indexOf('.ps-lead-sm{font-size'))
    throw new Error(`${f}: ライトの上書きがダークより前にある`);
  if ((s.match(/<option /g) || []).length !== 683) throw new Error(`${f}: option 数が変わった`);
  if (/transition:\s*all/.test(s)) throw new Error(`${f}: transition:all が入った`);
  writeFileSync(f, s);
  console.log(`✅ ${f}  ${before} → ${s.length} bytes`);
}
