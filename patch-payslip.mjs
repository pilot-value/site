/* 「明細から自動入力（準備中）」のバッジを、実物のドロップゾーンに差し替える。
   JP/EN の2ファイルに同じ変換をかける（文言だけ差分）。
   手で並べるとズレるので必ずこのスクリプト経由。件数 assert つき。 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
/* 自分の位置から解く。絶対パスを書くと macOS のユーザー名が公開リポジトリに載る */
const ROOT = fileURLToPath(new URL('./', import.meta.url));

const once = (h, from, to, l) => {
  const n = h.split(from).length - 1;
  if (n !== 1) throw new Error(`${l}: 一致 ${n} 件（期待1）`);
  return h.split(from).join(to);
};

/* ── 追加する CSS（ダーク） ─────────────────────────────── */
const CSS = `/* ── 明細から自動入力 ── 端末の中で黒塗り → 本人が見る → 送る ── */
.ps{margin-bottom:18px}
.ps-drop{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:14px 16px;border-radius:12px;border:1px dashed rgba(245,200,66,.3);background:linear-gradient(180deg,rgba(245,200,66,.06),rgba(245,200,66,.02));color:#e8edf2;cursor:pointer;transition:border-color .2s,background .2s,transform .2s cubic-bezier(.16,1,.3,1)}
.ps-drop:hover,.ps-drop.is-over{border-color:rgba(245,200,66,.6);background:linear-gradient(180deg,rgba(245,200,66,.12),rgba(245,200,66,.04))}
.ps-drop:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:2px}
.ps-drop:active{transform:translateY(1px)}
.ps-ico{font-size:1.15rem;line-height:1;flex:none}
.ps-drop-txt{display:flex;flex-direction:column;gap:2px;min-width:0}
.ps-drop-txt b{font-size:.86rem;font-weight:700;letter-spacing:-.01em}
.ps-drop-txt small{font-size:.72rem;color:#a8b3c2;line-height:1.5}
.ps-tag{margin-left:auto;flex:none;font-size:.62rem;font-weight:800;letter-spacing:.05em;padding:3px 10px;border-radius:999px;background:rgba(245,200,66,.12);color:#f5c842;border:1px solid rgba(245,200,66,.28)}
.ps-priv{font-size:.72rem;color:#6b7d93;line-height:1.6;margin-top:8px}
.ps-priv b{color:#a8b3c2}
.ps-edit,.ps-res{margin-top:12px;padding:16px;border-radius:14px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.025);box-shadow:0 18px 40px -28px rgba(245,200,66,.35),0 2px 6px -2px rgba(0,0,0,.5);animation:stepIn .34s cubic-bezier(.16,1,.3,1) both}
.ps-lead{font-size:.82rem;font-weight:700;color:#e8edf2;margin-bottom:10px}
.ps-stage{position:relative;line-height:0;border-radius:10px;overflow:hidden;background:#0b0f14;touch-action:none}
.ps-cv{width:100%;height:auto;display:block}
.ps-rect{position:absolute;background:#000;border:1px solid rgba(245,200,66,.75);cursor:move;touch-action:none}
.ps-rect:focus-visible{outline:2px solid #f5c842;outline-offset:2px}
.ps-rect-del{position:absolute;top:-9px;right:-9px;width:20px;height:20px;line-height:1;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:#1a2029;color:#e8edf2;font-size:.8rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s,border-color .2s,color .2s,transform .2s cubic-bezier(.16,1,.3,1)}
.ps-rect-del:hover{background:#dc2626;border-color:#dc2626;color:#fff}
.ps-rect-del:focus-visible{outline:2px solid #f5c842;outline-offset:2px}
.ps-rect-del:active{transform:scale(.9)}
.ps-rect-grip{position:absolute;right:-6px;bottom:-6px;width:14px;height:14px;border-radius:3px;background:#f5c842;border:1px solid rgba(0,0,0,.4);cursor:nwse-resize}
.ps-hint,.ps-note{font-size:.72rem;color:#6b7d93;line-height:1.65;margin-top:8px}
.ps-note b{color:#a8b3c2}
.ps-bar{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.ps-btn{font-size:.78rem;font-weight:700;padding:8px 14px;border-radius:10px;cursor:pointer;transition:color .2s,border-color .2s,background .2s,transform .2s cubic-bezier(.16,1,.3,1)}
.ps-btn:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:2px}
.ps-btn:active{transform:translateY(1px)}
.ps-btn-ghost{color:#a8b3c2;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.16)}
.ps-btn-ghost:hover{color:#e8edf2;border-color:rgba(255,255,255,.34)}
.ps-btn-go{display:block;width:100%;margin-top:12px;padding:13px;font-size:.9rem;font-weight:800;color:#0b0f14;background:linear-gradient(180deg,#f7d15e,#e6b52c);border:1px solid rgba(245,200,66,.9);box-shadow:0 14px 30px -18px rgba(245,200,66,.8)}
.ps-btn-go:hover{background:linear-gradient(180deg,#ffdd77,#f0c33e)}
.ps-btn-go[disabled]{opacity:.6;cursor:default}
.ps-warn{margin-top:10px;font-size:.76rem;line-height:1.6;color:#f5c842}
.ps-msg{margin-top:10px;padding:12px 14px;border-radius:12px;font-size:.8rem;line-height:1.6}
.ps-msg-busy{color:#a8b3c2;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03)}
.ps-msg-warn{color:#f5c842;border:1px solid rgba(245,200,66,.32);background:rgba(245,200,66,.07)}
.ps-res-title{font-size:.95rem;font-weight:800;letter-spacing:-.01em;color:#34d399}
.ps-res-title.ps-sm{font-size:.82rem;color:#a8b3c2;margin-top:18px}
.ps-res-lead{font-size:.78rem;color:#a8b3c2;line-height:1.7;margin-top:4px}
.ps-res-lead b{color:#e8edf2}
.ps-tbl{width:100%;margin-top:10px;border-collapse:collapse;font-size:.78rem}
.ps-tbl th{text-align:left;font-weight:700;color:#6b7d93;font-size:.68rem;letter-spacing:.04em;padding:0 0 6px}
.ps-tbl td{padding:7px 0;border-top:1px solid rgba(255,255,255,.07);color:#e8edf2;vertical-align:top}
.ps-tbl .ps-to{color:#a8b3c2}
.ps-tbl .ps-amt{text-align:right;font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap}
.ps-tbl-dim td{color:#a8b3c2}
.form-input.ai-filled{border-color:rgba(52,211,153,.55);background:rgba(52,211,153,.07)}
.ps-rate{margin-bottom:16px;padding:16px 18px;border-radius:14px;border:1px solid rgba(245,200,66,.28);background:radial-gradient(130% 170% at 100% 0%,rgba(245,200,66,.10),transparent 60%),rgba(255,255,255,.025)}
.ps-rate:empty{display:none}
.ps-rate-t{font-size:.68rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#f5c842}
.ps-rate-row{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.07)}
.ps-rate-row:last-of-type{border-bottom:none}
.ps-rate-k{font-size:.82rem;font-weight:700;color:#e8edf2}
.ps-rate-h{font-size:.7rem;color:#6b7d93;line-height:1.55;margin-top:2px;max-width:30ch}
.ps-rate-v{flex:none;text-align:right;font-size:1.35rem;font-weight:800;letter-spacing:-.02em;color:#f5c842;font-variant-numeric:tabular-nums;line-height:1.15}
.ps-rate-min{display:block;font-size:.68rem;font-weight:600;color:#6b7d93;letter-spacing:0}
.ps-pd{display:inline-flex;align-items:center;gap:7px;margin-top:10px;font-size:.75rem;color:#a8b3c2;cursor:pointer}
.ps-pd input{accent-color:#f5c842;cursor:pointer}
@media (prefers-reduced-motion:reduce){.ps-edit,.ps-res{animation:none}}
`;

/* ── 追加する CSS（ライト） ─────────────────────────────── */
const CSS_LIGHT = `[data-theme="light"] .ps-drop{color:#0f172a;border-color:rgba(200,149,0,.4);background:linear-gradient(180deg,rgba(200,149,0,.08),rgba(200,149,0,.02))}
[data-theme="light"] .ps-drop:hover,[data-theme="light"] .ps-drop.is-over{border-color:rgba(200,149,0,.7);background:linear-gradient(180deg,rgba(200,149,0,.14),rgba(200,149,0,.05))}
[data-theme="light"] .ps-drop-txt small{color:#64748b}
[data-theme="light"] .ps-tag{background:rgba(200,149,0,.12);color:#a97e00;border-color:rgba(200,149,0,.35)}
[data-theme="light"] .ps-priv,[data-theme="light"] .ps-hint,[data-theme="light"] .ps-note,[data-theme="light"] .ps-rate-h,[data-theme="light"] .ps-rate-min{color:#64748b}
[data-theme="light"] .ps-priv b,[data-theme="light"] .ps-note b{color:#334155}
[data-theme="light"] .ps-edit,[data-theme="light"] .ps-res{border-color:rgba(0,0,0,.09);background:rgba(255,255,255,.85);box-shadow:0 18px 40px -30px rgba(200,149,0,.45),0 2px 6px -3px rgba(15,23,42,.18)}
[data-theme="light"] .ps-lead{color:#0f172a}
[data-theme="light"] .ps-stage{background:#e2e8f0}
[data-theme="light"] .ps-rect{border-color:rgba(200,149,0,.85)}
[data-theme="light"] .ps-rect-del{background:#fff;border-color:rgba(0,0,0,.25);color:#0f172a}
[data-theme="light"] .ps-rect-grip{background:#a97e00}
[data-theme="light"] .ps-btn-ghost{color:#475569;background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.16)}
[data-theme="light"] .ps-btn-ghost:hover{color:#0f172a;border-color:rgba(0,0,0,.34)}
[data-theme="light"] .ps-btn-go{color:#3a2c00;background:linear-gradient(180deg,#f7d15e,#e0ac1e);border-color:rgba(200,149,0,.9);box-shadow:0 14px 30px -20px rgba(200,149,0,.85)}
[data-theme="light"] .ps-btn-go:hover{background:linear-gradient(180deg,#ffe083,#eaba2c)}
[data-theme="light"] .ps-warn{color:#8a6600}
[data-theme="light"] .ps-msg-busy{color:#475569;border-color:rgba(0,0,0,.1);background:rgba(0,0,0,.02)}
[data-theme="light"] .ps-msg-warn{color:#8a6600;border-color:rgba(200,149,0,.35);background:rgba(200,149,0,.07)}
[data-theme="light"] .ps-res-title{color:#0d8a63}
[data-theme="light"] .ps-res-title.ps-sm{color:#475569}
[data-theme="light"] .ps-res-lead{color:#475569}
[data-theme="light"] .ps-res-lead b{color:#0f172a}
[data-theme="light"] .ps-tbl th{color:#64748b}
[data-theme="light"] .ps-tbl td{color:#0f172a;border-top-color:rgba(0,0,0,.08)}
[data-theme="light"] .ps-tbl .ps-to,[data-theme="light"] .ps-tbl-dim td{color:#475569}
[data-theme="light"] .form-input.ai-filled{border-color:rgba(13,138,99,.5);background:rgba(13,138,99,.07)}
[data-theme="light"] .ps-rate{border-color:rgba(200,149,0,.32);background:radial-gradient(130% 170% at 100% 0%,rgba(200,149,0,.12),transparent 60%),rgba(255,255,255,.6)}
[data-theme="light"] .ps-rate-t,[data-theme="light"] .ps-rate-v{color:#a97e00}
[data-theme="light"] .ps-rate-k{color:#0f172a}
[data-theme="light"] .ps-rate-row{border-bottom-color:rgba(0,0,0,.08)}
[data-theme="light"] .ps-pd{color:#475569}
`;

/* ── 差し替える HTML ────────────────────────────────────── */
const OLD_JA = `      <div class="autofill">
        <span aria-hidden="true">📄</span>
        <span>明細から自動入力</span>
        <span class="autofill-soon">準備中</span>
      </div>
`;
const OLD_EN = `      <div class="autofill">
        <span aria-hidden="true">📄</span>
        <span>Auto-fill from a payslip</span>
        <span class="autofill-soon">Coming soon</span>
      </div>
`;

const NEW_JA = `      <!-- 明細から自動入力 ── 端末の中で黒塗り → 本人が見る → 送る -->
      <div class="ps" id="ps">
        <button type="button" class="ps-drop" id="ps-drop">
          <span class="ps-ico" aria-hidden="true">📄</span>
          <span class="ps-drop-txt">
            <b>明細から自動入力</b>
            <small>給与明細の画像をここに落とすか、クリックして選んでください</small>
          </span>
          <span class="ps-tag">約1分</span>
        </button>
        <input type="file" id="ps-file" accept="image/png,image/jpeg,image/webp" hidden>
        <p class="ps-priv">氏名・社員番号などは<b>この端末の中で</b>黒く塗ってから送ります。塗る前の画像がこの端末から出ることはありません。画像は解析にだけ使い、保存しません。</p>
        <div id="ps-panel"></div>
      </div>
`;
const NEW_EN = `      <!-- Auto-fill from a payslip — redacted on your device, you approve it, then it is sent -->
      <div class="ps" id="ps">
        <button type="button" class="ps-drop" id="ps-drop">
          <span class="ps-ico" aria-hidden="true">📄</span>
          <span class="ps-drop-txt">
            <b>Auto-fill from a payslip</b>
            <small>Drop an image of your payslip here, or click to choose one</small>
          </span>
          <span class="ps-tag">1 min</span>
        </button>
        <input type="file" id="ps-file" accept="image/png,image/jpeg,image/webp" hidden>
        <p class="ps-priv">Your name and staff number are blacked out <b>on your device</b> before anything is sent. The un-redacted file never leaves this device. Images are used only to read the figures and are never stored.</p>
        <div id="ps-panel"></div>
      </div>
`;

/* 消す：使わなくなった旧バッジの CSS（4行） */
const DEAD = [
  '.autofill{display:flex;align-items:center;gap:10px;padding:12px 16px;margin-bottom:18px;border-radius:12px;border:1px dashed rgba(255,255,255,.16);background:rgba(255,255,255,.02);font-size:.82rem;font-weight:600;color:#a8b3c2}\n',
  '.autofill-soon{margin-left:auto;font-size:.62rem;font-weight:800;letter-spacing:.05em;padding:3px 10px;border-radius:999px;background:rgba(255,255,255,.06);color:#9ca3af;border:1px solid rgba(255,255,255,.14)}\n',
  '[data-theme="light"] .autofill{border-color:rgba(0,0,0,.16);background:rgba(0,0,0,.02);color:#475569}\n',
  '[data-theme="light"] .autofill-soon{background:rgba(0,0,0,.05);color:#64748b;border-color:rgba(0,0,0,.12)}\n',
];

const FILES = [
  { f: 'pay-report.html', old: OLD_JA, next: NEW_JA, src: 'payslip.js', anchor: '<script src="lang-toggle.js"></script>' },
  { f: 'en/pay-report.html', old: OLD_EN, next: NEW_EN, src: '../payslip.js', anchor: '<script src="../lang-toggle.js"></script>' },
];

for (const { f, old, next, src, anchor } of FILES) {
  let h = readFileSync(ROOT + f, 'utf8');
  const before = h.length;

  h = once(h, old, next, `${f}: バッジ`);
  for (const d of DEAD) h = once(h, d, '', `${f}: 旧CSS`);

  // CSS はライトモードの直前に入れる（ダーク定義 → ライト上書きの順を守る）
  h = once(h, '/* ── Light mode ', CSS + '/* ── Light mode ', `${f}: ダークCSSの挿入位置`);
  h = once(h, '</style>', CSS_LIGHT + '</style>', `${f}: ライトCSSの挿入位置`);

  // payslip.js はページ内 inline script より後（$ / num / updateSteps を借りている）
  h = once(h, anchor, `<script src="${src}"></script>\n` + anchor, `${f}: script タグ`);

  // ── 検算 ───────────────────────────────────────────────
  if (h.includes('autofill')) throw new Error(`${f}: autofill が残っている`);
  for (const id of ['ps-drop', 'ps-file', 'ps-panel']) {
    if ((h.split(`id="${id}"`).length - 1) !== 1) throw new Error(`${f}: id="${id}" が1個でない`);
  }
  if ((h.split('id="ps"').length - 1) !== 1) throw new Error(`${f}: id="ps" が1個でない`);
  if ((h.match(/<option /g) || []).length !== 683) throw new Error(`${f}: option が 683 でない`);
  if ((h.match(/class="chip" data-open=/g) || []).length !== 8) throw new Error(`${f}: チップが8個でない`);
  if ((h.match(/<\/html>/g) || []).length !== 1) throw new Error(`${f}: </html> が1個でない`);
  if (!h.includes('/*BEGIN:PVMETA*/') || !h.includes('/*END:PVMETA*/')) throw new Error(`${f}: PVMETA が壊れた`);
  if (h.indexOf('[data-theme="light"] .ps-drop') < h.indexOf('.ps-drop:hover')) {
    throw new Error(`${f}: ライトの上書きがダークより前にある`);
  }
  // transition-all を持ち込んでいないこと（CLAUDE.md）
  if (/transition:\s*all/.test(CSS + CSS_LIGHT)) throw new Error('transition-all は禁止');

  writeFileSync(ROOT + f, h);
  console.log(`✅ ${f}  ${before} → ${h.length} bytes`);
}
