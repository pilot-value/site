/* patch-pay-viz.mjs — profile.html / en/profile.html を pay-viz.css / pay-viz.js に載せ替える。

   背景：.pt-* の約60ルールが両ファイルにインラインで入っていて、数字と図の
   コードは pay-tracker.js に閉じていた。my-value.html（市場価値レポート）が
   同じ図を出すので、そのままだと 4ファイルへの手写しになって必ずドリフトする。

   やることは2つだけ。見た目は1pxも動かさない：
     ① <style> の中の .pt-* ブロックを消し、</style> の直後に pay-viz.css を貼る
     ② pay-tracker.js の直前に pay-viz.js を読む

   ★ --pt-dot だけ #pay-tracker から :root へ広げてある（pay-viz.css 側の理由参照）。
     解決する値は同じなので profile.html の見た目は変わらない。

   実行: node patch-pay-viz.mjs */
import { readFileSync, writeFileSync } from 'fs';

const CSS_FROM = '/* ── 明細トラッカー（pay-tracker.js が描く）────────────────── */\n';
const CSS_TO   = '    @media(max-width:520px){.pt-stats{grid-template-columns:1fr}.pt-bigs{grid-template-columns:1fr}}\n';

const FILES = [
  { f: 'profile.html',    up: '' },
  { f: 'en/profile.html', up: '../' },
];

const once = (s, needle, what, f) => {
  const n = s.split(needle).length - 1;
  if (n !== 1) throw new Error(`${what} anchor not unique (${n}): ${f}`);
};

let n = 0;
for (const { f, up } of FILES) {
  let s = readFileSync(f, 'utf8');
  const before = s;

  // 二重適用よけ
  if (s.includes('pay-viz.css')) { console.log(`skip (already patched): ${f}`); continue; }

  // ① .pt-* の CSS を外へ出す
  once(s, CSS_FROM, 'css start', f);
  once(s, CSS_TO, 'css end', f);
  once(s, '</style>', 'style close', f);
  const i = s.indexOf(CSS_FROM);
  const j = s.indexOf(CSS_TO) + CSS_TO.length;
  if (j <= i) throw new Error(`css block inverted: ${f}`);
  /* 抜き出した中身が本当に .pt-* だけか確かめてから捨てる。
     ★ .skeleton / @keyframes は同じ <style> の中で .pt-* の直後にいる。
       ここまで巻き込むと、消えたことに気づけないまま出てしまう。 */
  const cut = s.slice(i, j);
  if (!/\.pt-top/.test(cut) || !/\.pt-sw/.test(cut)) throw new Error(`css block looks wrong: ${f}`);
  if (/skeleton|keyframes/.test(cut)) throw new Error(`css block reaches past .pt-*: ${f}`);
  s = s.slice(0, i) + s.slice(j);

  s = s.replace('</style>',
    `</style>\n  <!-- 明細まわりの図の見た目。pay-tracker と my-value が共有する -->\n` +
    `  <link rel="stylesheet" href="${up}pay-viz.css">`);

  // ② 数字と図の本体を pay-tracker.js より先に読む
  const SCRIPT = `<script src="${up}pay-tracker.js"></script>`;
  once(s, SCRIPT, 'pay-tracker script', f);
  s = s.replace(SCRIPT, `<script src="${up}pay-viz.js"></script>\n${SCRIPT}`);

  if (s === before) throw new Error(`no change: ${f}`);
  writeFileSync(f, s);
  n++;
  console.log(`patched: ${f}  (css ${j - i} bytes moved out)`);
}
console.log(`\n${n} file(s) patched`);
if (n !== 2 && n !== 0) throw new Error(`expected 2 files, got ${n}`);
