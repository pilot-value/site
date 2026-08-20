/* 読み取り後の画面（時給を先頭に・その場で直す・次の行動）で足りないCSS。
   既存の .ps-edit は「黒塗り編集パネルの箱」なので、表の中の金額入力には使えない。
   金額入力は .ps-amt-in、通貨の接頭は .ps-cur。
   実行: node patch-ps-edit-css.mjs                                          */
import { readFileSync, writeFileSync } from 'fs';

const ANCHOR_DARK = `.ps-pd input{accent-color:#f5c842;cursor:pointer}`;
const ADD_DARK = `
.ps-tbl-edit td{padding:5px 0}
.ps-tbl-edit .ps-amt{display:flex;align-items:center;justify-content:flex-end;gap:6px}
.ps-cur{font-size:.66rem;font-weight:700;letter-spacing:.04em;color:#6b7d93}
.ps-cur:empty{display:none}
.ps-amt-in{width:9ch;min-width:74px;padding:5px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#e8edf2;font:inherit;font-weight:700;font-variant-numeric:tabular-nums;text-align:right;transition:border-color .2s,background .2s,color .2s}
.ps-amt-in::-webkit-outer-spin-button,.ps-amt-in::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.ps-amt-in:hover{border-color:rgba(255,255,255,.3)}
.ps-amt-in:focus{outline:none;border-color:rgba(245,200,66,.7);background:rgba(245,200,66,.07);color:#fff}
.ps-amt-in:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:1px}
.ps-ask{margin-top:12px;padding:12px 14px;border-radius:12px;border:1px dashed rgba(245,200,66,.34);background:rgba(245,200,66,.05)}
.ps-ask[hidden]{display:none}
.ps-ask-t{font-size:.8rem;font-weight:700;color:#f5c842}
.ps-ask-l{font-size:.72rem;line-height:1.65;color:#a8b3c2;margin-top:3px}
.ps-ask-in{display:flex;align-items:center;gap:7px;margin-top:9px}
.ps-ask-in input{width:112px;padding:8px 10px;border-radius:9px;border:1px solid rgba(245,200,66,.4);background:rgba(0,0,0,.25);color:#e8edf2;font:inherit;font-weight:700;font-variant-numeric:tabular-nums;text-align:right;transition:border-color .2s,background .2s}
.ps-ask-in input:hover{border-color:rgba(245,200,66,.65)}
.ps-ask-in input:focus{outline:none;border-color:#f5c842;background:rgba(0,0,0,.4)}
.ps-ask-in input:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:2px}
.ps-ask-in span{font-size:.78rem;font-weight:700;color:#a8b3c2}
.ps-next{margin-top:16px;padding:14px 16px;border-radius:12px;border:1px solid rgba(52,211,153,.26);background:rgba(52,211,153,.06)}
.ps-next-t{font-size:.86rem;font-weight:800;letter-spacing:-.01em;color:#34d399}
.ps-next-l{font-size:.74rem;line-height:1.65;color:#a8b3c2;margin-top:4px}
.ps-next .btn-orange{margin-top:11px;padding:10px 20px;font-size:.85rem}`;

const ANCHOR_LIGHT = `[data-theme="light"] .ps-pd{color:#475569}`;
const ADD_LIGHT = `
[data-theme="light"] .ps-cur{color:#64748b}
[data-theme="light"] .ps-amt-in{border-color:rgba(0,0,0,.14);background:#fff;color:#0f172a}
[data-theme="light"] .ps-amt-in:hover{border-color:rgba(0,0,0,.3)}
[data-theme="light"] .ps-amt-in:focus{border-color:rgba(200,149,0,.8);background:rgba(200,149,0,.08);color:#0f172a}
[data-theme="light"] .ps-ask{border-color:rgba(200,149,0,.4);background:rgba(200,149,0,.07)}
[data-theme="light"] .ps-ask-t{color:#a97e00}
[data-theme="light"] .ps-ask-l,[data-theme="light"] .ps-ask-in span,[data-theme="light"] .ps-next-l{color:#475569}
[data-theme="light"] .ps-ask-in input{border-color:rgba(200,149,0,.45);background:#fff;color:#0f172a}
[data-theme="light"] .ps-ask-in input:focus{border-color:#a97e00;background:#fffdf5}
[data-theme="light"] .ps-next{border-color:rgba(13,138,99,.28);background:rgba(13,138,99,.06)}
[data-theme="light"] .ps-next-t{color:#0d8a63}`;

for (const file of ['pay-report.html', 'en/pay-report.html']) {
  let s = readFileSync(file, 'utf8');
  const before = s.length;
  if (s.includes('.ps-amt-in{')) throw new Error(`${file}: 既に入っている`);
  for (const [anchor, add] of [[ANCHOR_DARK, ADD_DARK], [ANCHOR_LIGHT, ADD_LIGHT]]) {
    const n = s.split(anchor).length - 1;
    if (n !== 1) throw new Error(`${file}: アンカーが ${n} 箇所 — ${anchor}`);
    s = s.replace(anchor, anchor + add);
  }
  // ★ダーク側の定義が1つだけ入ったことを見る（行頭＝テーマ接頭辞なし）
  for (const sel of ['.ps-amt-in{', '.ps-ask{', '.ps-next{', '.ps-cur{', '.ps-tbl-edit td{']) {
    const n = (s.split('\n' + sel).length - 1);
    if (n !== 1) throw new Error(`${file}: ${sel} が ${n} 個`);
  }
  if ((s.match(/transition-all/g) || []).length) throw new Error(`${file}: transition-all`);
  if ((s.match(/<\/html>/g) || []).length !== 1) throw new Error(`${file}: </html> が1つでない`);
  writeFileSync(file, s);
  console.log(`✅ ${file}  ${before} → ${s.length} bytes`);
}
