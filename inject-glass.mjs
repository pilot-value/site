/* ════════════════════════════════════════════════════════════════
   inject-glass.mjs — すりガラスと動き（2026-11-12 オーナー採用）の head の塊を、全ページに入れる冪等バッチ

   入れるのは <!--PV-GLASS-->…<!--/PV-GLASS--> の1つだけ（</head> の直前 ＝ ページのどの CSS よりも後に効く）：
     ・字（Google Fonts の Outfit と Zen Kaku Gothic New）
     ・pv-glass.css と pv-glass.js（どちらも中身の指紋 ?v= 付き ＝ 直したら流し直す。古い組み合わせを4時間残さない）
   ・対象は app-nav.css を読んでいるページ（ヘッダーと左メニューのある画面）。運営の画面（admin.html）と DEEP PAY（本番から消した）は入れない。
   ・何度流しても同じ結果。試作のときの2行（ui-trial.css / ui-trial.js）が残っていたら取り除く。
   ・日英のページはここで書く。スペイン語（es/）は gen-lang.mjs が英語のページから写す（同じ深さなので住所はそのまま）。
     ⚠️ es/ をここで書かない ── gen-lang.mjs の出力と食い違うと assert-generated.mjs が落ちる。
   ・page-dates.mjs はこの塊を「直した日」に数えない（全ページが一斉に今日直したにならない）。

   ⚠️ pv-glass.css か pv-glass.js を直したら流す（指紋が変わる）→ そのあと node gen-lang.mjs es。
      流し忘れは assert-glass.mjs が捕まえる（全ページの塊が glassBlock と1文字も違わないか）。
   ⚠️ 新しいページを足したら流す。

   実行: node inject-glass.mjs        書く
         node inject-glass.mjs --check 書かずに、直すページの数だけ出す
════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const CHECK = process.argv.includes('--check');

/* 日英の置き場（es/ は gen-lang.mjs）。[フォルダ, ルートへの相対] */
export const GLASS_DIRS = [
  ['.', ''], ['airlines', '../'], ['countries', '../'],
  ['en', '../'], ['en/airlines', '../../'], ['en/countries', '../../'],
];
/* 運営の画面と、本番から消した DEEP PAY（_config.yml の exclude・検査が通信の行き先と字の色を細かく縛っている）には入れない */
export const SKIP = new Set(['admin.html', 'deep-pay.html', 'deep-pay-compare.html', 'en/deep-pay.html', 'en/deep-pay-compare.html']);
export const FONTS = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300..700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap';
export const fingerprint = (f) => createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 8);

export function glassBlock(rel) {
  return `<!--PV-GLASS-->
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="${rel}pv-glass.css?v=${fingerprint('pv-glass.css')}">
<script src="${rel}pv-glass.js?v=${fingerprint('pv-glass.js')}"></script>
<!--/PV-GLASS-->`;
}
export const BLOCK_RE = /<!--PV-GLASS-->[\s\S]*?<!--\/PV-GLASS-->/;
/* 試作のときの2行（とその注）。見つけたら取り除く */
const TRIAL_RE = /[ \t]*<!-- すりガラスと動きの試作[^\n]*-->\n[ \t]*<link rel="stylesheet" href="[^"]*ui-trial\.css">\n[ \t]*<script src="[^"]*ui-trial\.js"><\/script>\n/;

export const wantsGlass = (html) => /<link rel="stylesheet" href="[^"]*app-nav\.css">/.test(html);

export function withGlass(html, rel) {
  html = html.replace(TRIAL_RE, '');
  const block = glassBlock(rel);
  if (BLOCK_RE.test(html)) return html.replace(BLOCK_RE, () => block);
  /* ★入れるのは「塊＋改行1つ」だけ（page-dates.mjs が塊＋改行を取り除いて元と比べる）。 */
  const head = html.indexOf('</head>');
  if (head < 0) return null;
  return html.slice(0, head) + block + '\n' + html.slice(head);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  let wrote = 0, same = 0, skipped = 0;
  const noHead = [];
  for (const [dir, rel] of GLASS_DIRS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).filter((x) => x.endsWith('.html')).sort()) {
      const fp = path.join(abs, f);
      const html = fs.readFileSync(fp, 'utf8');
      if (SKIP.has(path.posix.join(dir === '.' ? '' : dir, f)) || !wantsGlass(html)) {
        /* 対象外のページに塊が残っていたら外す（あとから対象外にしたページ） */
        if (BLOCK_RE.test(html)) { wrote++; if (!CHECK) fs.writeFileSync(fp, html.replace(new RegExp(BLOCK_RE.source + '\\n?'), '')); }
        else skipped++;
        continue;
      }
      const next = withGlass(html, rel);
      if (next == null) { noHead.push(path.join(dir, f)); continue; }
      if (next === html) { same++; continue; }
      wrote++;
      if (!CHECK) fs.writeFileSync(fp, next);
    }
  }
  console.log(`PV-GLASS: ${CHECK ? '直すページ' : '書いた'} ${wrote}枚・そのまま ${same}枚・対象外 ${skipped}枚` + (noHead.length ? `・</head> が無い ${noHead.length}枚: ${noHead.join(', ')}` : ''));
  if (CHECK && wrote) process.exitCode = 1;
}
