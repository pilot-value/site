/* 規約系6ページがライトモードで読めない。
   既定テーマは light なので、いちばん多く読まれる状態で
   「灰色の板に薄い灰色の字」になっている。プライバシーの開示が
   既定で判読できないのは、書いていないのとほぼ同じ。

   ★.data-row のラベルは style="color:#e8edf2" のインライン指定なので、
     クラス指定では勝てない。author の !important はインラインの通常宣言に
     勝つので、そこだけ !important を使う。
   実行: node patch-policy-light.mjs                                         */
import { readFileSync, writeFileSync } from 'fs';

const FILES = ['personal-data.html', 'privacy.html', 'guide.html',
               'en/personal-data.html', 'en/privacy.html', 'en/guide.html'];

const LIGHT = `
/* ── Light mode ─────────────────────────────────────────── */
[data-theme="light"] .policy-card{background:rgba(255,255,255,.9);border-color:rgba(0,0,0,.08)}
[data-theme="light"] .data-row{border-bottom-color:rgba(0,0,0,.07)}
[data-theme="light"] .data-label{color:#64748b}
[data-theme="light"] h2{color:#0f172a;border-left-color:#1f6fd0}
[data-theme="light"] p,[data-theme="light"] li{color:#475569}
[data-theme="light"] .policy-card p[style]{color:#0f172a!important}
[data-theme="light"] .section-badge{background:rgba(31,111,208,.09);border-color:rgba(31,111,208,.28);color:#1f6fd0}
[data-theme="light"] .btn-ghost{background:rgba(0,0,0,.05);border-color:rgba(0,0,0,.12);color:#0f172a}
[data-theme="light"] .btn-ghost:hover{background:rgba(0,0,0,.09)}
</style>`;

for (const f of FILES) {
  let s = readFileSync(f, 'utf8');
  const before = s.length;

  if (s.includes('[data-theme="light"] .policy-card')) throw new Error(`${f}: すでに入っている`);
  if ((s.match(/<\/style>/g) || []).length !== 1) throw new Error(`${f}: </style> が1つでない`);
  s = s.replace('</style>', LIGHT);

  // ★ライトの上書きは必ずダークの定義より後ろ（後勝ちに頼っている）
  if (s.indexOf('[data-theme="light"] .policy-card') < s.indexOf('.policy-card{background'))
    throw new Error(`${f}: ライトの上書きがダークより前にある`);
  if ((s.match(/<\/style>/g) || []).length !== 1) throw new Error(`${f}: </style> が増えた`);
  if ((s.match(/<\/html>/g) || []).length !== 1) throw new Error(`${f}: </html> が1つでない`);
  if (/transition:\s*all/.test(s)) throw new Error(`${f}: transition:all が入った`);

  writeFileSync(f, s);
  console.log(`✅ ${f}  ${before} → ${s.length} bytes`);
}
console.log(`── ${FILES.length} ファイル`);
