/* patch-pay-tracker.mjs — profile.html / en/profile.html に明細トラッカーを載せる。
   入れるのは3点だけ：CSS・マウント先の空カード・<script src>。
   既存の要素は1つも書き換えない（口コミ欄・編集フォーム・メール通知は無傷）。
   実行: node patch-pay-tracker.mjs */
import { readFileSync, writeFileSync } from 'fs';

const CSS = `
    /* ── 明細トラッカー（pay-tracker.js が描く）────────────────── */
    #pay-tracker{--pt-dot:#0a0c0f}
    .pt-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:18px}
    .pt-title{font-size:.98rem;font-weight:800;letter-spacing:-.01em}
    .pt-lead{font-size:.76rem;color:#6b7d93;margin-top:4px;line-height:1.6}
    .pt-pill{flex:none;display:inline-flex;align-items:center;padding:4px 12px;border-radius:999px;font-size:.72rem;font-weight:700;background:rgba(255,255,255,.05);color:#6b7d93;border:1px solid rgba(255,255,255,.1)}
    .pt-pill.on{background:rgba(72,199,142,.1);color:#48c78e;border-color:rgba(72,199,142,.25)}
    .pt-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    .pt-stat{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px 12px;text-align:center}
    .pt-stat b{display:block;font-size:1.5rem;font-weight:800;letter-spacing:-.03em;line-height:1.15;font-variant-numeric:tabular-nums}
    .pt-stat b i{font-style:normal;font-size:.78rem;font-weight:700;margin-left:2px;opacity:.6}
    .pt-stat span{display:block;font-size:.7rem;color:#6b7d93;margin-top:5px;font-weight:600}
    .pt-sec{margin-top:22px}
    .pt-h{font-size:.8rem;font-weight:700;margin-bottom:12px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
    .pt-sub{font-size:.72rem;color:#6b7d93;font-weight:600}
    .pt-bigs{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .pt-big{background:linear-gradient(160deg,rgba(245,200,66,.09),rgba(249,115,22,.03));border:1px solid rgba(245,200,66,.18);border-radius:12px;padding:14px}
    .pt-big b{display:block;font-size:1.3rem;font-weight:800;letter-spacing:-.03em;color:#f5c842}
    .pt-big span{display:block;font-size:.7rem;color:#9ca3af;margin-top:4px;font-weight:600}
    .pt-note{font-size:.7rem;color:#6b7d93;line-height:1.65;margin-top:8px}
    .pt-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
    .pt-tab{padding:5px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:transparent;color:#9ca3af;font-size:.74rem;font-weight:600;cursor:pointer;font-family:inherit;transition:color .18s cubic-bezier(.2,.8,.2,1),border-color .18s cubic-bezier(.2,.8,.2,1),background-color .18s cubic-bezier(.2,.8,.2,1)}
    .pt-tab:hover{border-color:rgba(245,200,66,.35);color:#e8edf2}
    .pt-tab:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:2px}
    .pt-tab:active{transform:translateY(1px)}
    .pt-tab.on{border-color:rgba(245,200,66,.5);background:rgba(245,200,66,.09);color:#f5c842}
    .pt-chart{width:100%}
    .pt-svg{display:block;max-width:100%;color:#e8edf2}
    .pt-donut-wrap{display:flex;gap:20px;align-items:center;flex-wrap:wrap}
    .pt-donut{position:relative;flex:none;width:132px;height:132px}
    .pt-donut-c{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
    .pt-donut-c b{font-size:.9rem;font-weight:800;letter-spacing:-.02em}
    .pt-legend{flex:1;min-width:210px;display:flex;flex-direction:column;gap:7px}
    .pt-leg{display:flex;align-items:center;gap:8px;font-size:.75rem}
    .pt-leg i{width:9px;height:9px;border-radius:3px;flex:none}
    .pt-leg .nm{color:#9ca3af;flex:1;min-width:0}
    .pt-leg .amt{font-weight:700;font-variant-numeric:tabular-nums}
    .pt-leg .pct{color:#6b7d93;width:34px;text-align:right;font-variant-numeric:tabular-nums}
    .pt-empty,.pt-locked{font-size:.76rem;color:#6b7d93;line-height:1.7;background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.1);border-radius:12px;padding:14px 16px}
    .pt-cmp{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
    .pt-cmp b{font-size:1.15rem;font-weight:800;letter-spacing:-.02em}
    .pt-cmp span{font-size:.73rem;color:#6b7d93}
    .pt-btn{display:inline-flex;align-items:center;gap:6px;margin-top:20px;padding:11px 22px;background:linear-gradient(135deg,#f5c842,#f97316);color:#000;border-radius:10px;font-size:.83rem;font-weight:800;text-decoration:none;box-shadow:0 6px 18px -8px rgba(245,200,66,.7),0 2px 6px -2px rgba(249,115,22,.4);transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s cubic-bezier(.2,.8,.2,1)}
    .pt-btn:hover{transform:translateY(-1px);box-shadow:0 10px 24px -8px rgba(245,200,66,.8),0 3px 8px -2px rgba(249,115,22,.5)}
    .pt-btn:focus-visible{outline:2px solid rgba(245,200,66,.7);outline-offset:3px}
    .pt-btn:active{transform:translateY(0)}
    .pt-btn.ghost{background:rgba(245,200,66,.09);color:#f5c842;border:1px solid rgba(245,200,66,.28);box-shadow:none}
    .pt-btn.ghost:hover{background:rgba(245,200,66,.14);box-shadow:0 6px 16px -10px rgba(245,200,66,.6)}
    .pt-first{background:linear-gradient(160deg,rgba(245,200,66,.1),rgba(249,115,22,.03));border:1px solid rgba(245,200,66,.22);border-radius:14px;padding:20px}
    .pt-first-h{font-size:.95rem;font-weight:800;line-height:1.5;margin-bottom:8px}
    .pt-first-s{font-size:.76rem;color:#9ca3af;line-height:1.7}
    .pt-first .pt-btn{margin-top:16px}
    .pt-remind-row{display:flex;align-items:center;justify-content:space-between;gap:14px}
    .pt-remind-h{font-size:.84rem;font-weight:700}
    .pt-sw{flex:none;width:52px;height:30px;border-radius:999px;border:none;cursor:pointer;position:relative;background:rgba(255,255,255,.14);transition:background-color .2s cubic-bezier(.2,.8,.2,1)}
    .pt-sw span{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;transition:transform .2s cubic-bezier(.2,.8,.2,1)}
    .pt-sw.on{background:#f5c842}
    .pt-sw.on span{transform:translateX(22px)}
    .pt-sw:focus-visible{outline:2px solid rgba(245,200,66,.7);outline-offset:2px}
    [data-theme="light"] #pay-tracker{--pt-dot:#fff}
    [data-theme="light"] .pt-stat{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.07)}
    [data-theme="light"] .pt-pill{background:rgba(0,0,0,.04);border-color:rgba(0,0,0,.1)}
    [data-theme="light"] .pt-tab{border-color:rgba(0,0,0,.12);color:#64748b}
    [data-theme="light"] .pt-tab:hover{color:#0f172a;border-color:rgba(161,114,0,.4)}
    [data-theme="light"] .pt-tab.on{border-color:rgba(161,114,0,.42);background:rgba(161,114,0,.07);color:#a07200}
    [data-theme="light"] .pt-big{background:linear-gradient(160deg,rgba(161,114,0,.08),rgba(249,115,22,.03));border-color:rgba(161,114,0,.2)}
    [data-theme="light"] .pt-big b{color:#a07200}
    [data-theme="light"] .pt-svg{color:#0f172a}
    [data-theme="light"] .pt-empty,[data-theme="light"] .pt-locked{background:rgba(0,0,0,.02);border-color:rgba(0,0,0,.13)}
    [data-theme="light"] .pt-first{background:linear-gradient(160deg,rgba(161,114,0,.08),rgba(249,115,22,.03));border-color:rgba(161,114,0,.22)}
    [data-theme="light"] .pt-first-s,[data-theme="light"] .pt-big span,[data-theme="light"] .pt-leg .nm{color:#64748b}
    [data-theme="light"] .pt-btn.ghost{background:rgba(161,114,0,.08);color:#a07200;border-color:rgba(161,114,0,.3)}
    [data-theme="light"] .pt-sw{background:rgba(0,0,0,.16)}
    @media(max-width:520px){.pt-stats{grid-template-columns:1fr}.pt-bigs{grid-template-columns:1fr}}`;

/* ★ display:none で置く。my_pay_reports がまだ本番に無い間は
   pay-tracker.js が出さないまま終わる＝空の枠が残らない。 */
const MOUNT = (comment) => `
    <!-- ${comment} -->
    <div class="glass pv-no-cur" id="pay-tracker" style="margin-top:20px;display:none"></div>
`;

const FILES = [
  { f: 'profile.html',    src: 'pay-tracker.js',    cur: '<script src="currency.js"></script>',
    anchor: '    <!-- Edit form -->', comment: '明細トラッカー（pay-tracker.js が中身を描く）' },
  { f: 'en/profile.html', src: '../pay-tracker.js', cur: '<script src="../currency.js"></script>',
    anchor: '    <!-- Edit form -->', comment: 'Payslip tracker (rendered by pay-tracker.js)' },
];

let n = 0;
for (const it of FILES) {
  let s = readFileSync(it.f, 'utf8');
  const before = s;

  // 二重適用よけ
  if (s.includes('id="pay-tracker"')) { console.log(`skip (already patched): ${it.f}`); continue; }

  // ① CSS を既存 <style> の末尾に足す（既存規則は触らない）
  const styleEnd = '    .skeleton{background:rgba(255,255,255,.06);border-radius:6px;animation:pulse 1.5s ease-in-out infinite}';
  if (s.split(styleEnd).length - 1 !== 1) throw new Error(`CSS anchor not unique: ${it.f}`);
  s = s.replace(styleEnd, styleEnd + '\n' + CSS.trim().split('\n').map((l) => l.replace(/^\s{4}/, '    ')).join('\n'));

  // ② マウント先（プロフィールカードの直後・編集フォームの手前）
  if (s.split(it.anchor).length - 1 !== 1) throw new Error(`mount anchor not unique: ${it.f}`);
  s = s.replace(it.anchor, MOUNT(it.comment).replace(/\n$/, '') + '\n' + it.anchor);

  // ③ currency.js の後ろに読む（PVCurrency と sb が揃ってから動く）
  if (s.split(it.cur).length - 1 !== 1) throw new Error(`script anchor not unique: ${it.f}`);
  s = s.replace(it.cur, it.cur + `\n<script src="${it.src}"></script>`);

  if (s === before) throw new Error(`no change: ${it.f}`);
  writeFileSync(it.f, s);
  n++;
  console.log(`patched: ${it.f}`);
}
console.log(`\n${n} file(s) patched`);
if (n !== 2 && n !== 0) throw new Error(`expected 2 files, got ${n}`);
