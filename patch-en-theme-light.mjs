/* patch-en-theme-light.mjs — 英語の会社ページ（en/airlines/*.html）を、何も選んでいない人には明るい色で開く（2026-10-19）。

   オーナー（2026-10-18 Q4）「①」＝ 日本語と同じ明るい色にそろえる。
   英語の会社ページは、色を選んだことのない人にも暗い色で開いていた（日本語のページは明るい色）。
   色を決めているのは、各ページの2か所の1行だけ：
     ・<head> の先頭 … 描く前に data-theme を決める
     ・本文の最後     … 同じ決め方をもう一度（切替のボタンの絵を合わせる前）
   どちらも「保存した色（pv-theme）が在ればそれ、無ければ既定」。ここで替えるのは**既定の1語だけ**（'dark' → 'light'）。
   ★自分で選んだ色（localStorage の pv-theme）は、今までどおり先に読む ＝ 選んだ人の画面は変わらない。
   ★ほかの行は1文字も触らない（このフォルダのページは main と同じファイル。合流のときは、このスクリプトを流し直せば同じ形になる）。
   ★決まった2つの形だけを書き直す。知らない形で暗い色を既定にしているページが在れば、何も書かずに止まる。

   実行: node patch-en-theme-light.mjs          … 書き直す（何度流しても同じ。2回目は「✓ 変更なし」）
         node patch-en-theme-light.mjs --check  … 書かずに見るだけ（暗い色が既定のページが残っていれば 1 で終わる）
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIR = 'en/airlines';
const DARK = "localStorage.getItem('pv-theme')||'dark'";
const LIGHT = "localStorage.getItem('pv-theme')||'light'";
/* 決まった2つの形（<head> の先頭の1行・本文の最後の1行）。どちらも既定の1語だけが違う。 */
const FORMS = [
  `<script>(function(){var t=${DARK};document.documentElement.setAttribute('data-theme',t);}());</script>`,
  `(function(){var t=${DARK};document.documentElement.setAttribute('data-theme',t)})();`,
];
const check = process.argv.includes('--check');

const count = (s, x) => s.split(x).length - 1;
let wrote = 0, stale = 0;
const files = fs.readdirSync(path.join(ROOT, DIR)).filter((f) => f.endsWith('.html')).sort();
for (const f of files) {
  const rel = `${DIR}/${f}`, p = path.join(ROOT, rel), before = fs.readFileSync(p, 'utf8');
  const dark = count(before, DARK);
  if (!dark) continue;
  const known = FORMS.reduce((n, x) => n + count(before, x), 0);
  if (known !== dark) {
    console.error(`❌ ${rel}: 暗い色を既定にしている所が ${dark}か所、そのうち決まった形は ${known}か所（知らない形は書き直さない）`);
    process.exit(1);
  }
  if (check) { console.error(`❌ ${rel} は、まだ暗い色で開く（node patch-en-theme-light.mjs を流す）`); stale++; continue; }
  let after = before;
  for (const x of FORMS) after = after.split(x).join(x.split(DARK).join(LIGHT));
  if (count(after, DARK) !== 0 || after.length !== before.length + (LIGHT.length - DARK.length) * dark) {
    console.error(`❌ ${rel}: 書き直しの結果が合わない（書かない）`);
    process.exit(1);
  }
  fs.writeFileSync(p, after);
  wrote++;
}
if (stale) process.exit(1);
console.log(wrote ? `✎ ${wrote}枚を明るい色の既定に書き直した（${DIR}）` : `✓ 変更なし（${DIR} の ${files.length}枚は、どれも暗い色を既定にしていない）`);
