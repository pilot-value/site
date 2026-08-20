/* ══════════════════════════════════════════════════════════════
   inject-airline-css.mjs — EN 航空会社ページに airline-base.css を静的に張る

   なぜ要るか（assert-perf.mjs の実測）
     EN の航空会社ページは airline-base.css を <link> で読んでいない。
     airline-reviews-ui.js の ensureCSS() が実行時に head 先頭へ差し込む
     作りになっている。つまりブラウザは「HTML を読み終えて → JS を実行して
     → はじめてスタイルシートの存在を知る」ので、

       ・素のHTMLが一瞬そのまま出る（FOUC）
       ・レーティングバナーが CSS 無しの 812px で描かれ、CSS が届いた
         あと 444px に縮む
       ・実測 CLS 0.845（良好は 0.10 以下 / 0.25 超で「不良」）

     JP 側は最初から <link> があるので同じ症状が出ない（実測 0.005）。
     head に1行足すだけで、EN も JP と同じ挙動になる。

   ensureCSS() は既存の <link rel=stylesheet> に airline-base.css が
   あれば何もせず return する。したがってこの注入を入れると実行時注入は
   自動的に無効化される（二重読み込みにならない）。JS 側は触らない。

   ★ 入れる位置は「charset の直後・ページ自身の <style> より前」。
     ensureCSS() は head.firstChild に入れる＝ページのインラインCSSより
     前に置くことで、重複セレクタ（.hero-airline など13個）はページ側を
     勝たせる設計。静的化でその順序が変わると見た目が変わるので、
     カスケード順は同じにする。charset より前には置けない（先頭1024バイト
     ルール）ので、charset の直後が唯一の正解。

   実行: node inject-airline-css.mjs        書き込む
        node inject-airline-css.mjs --dry  差分だけ出して書かない
   ══════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry');

const HREF = '../../airlines/airline-base.css';
const TAG = `<link rel="stylesheet" href="${HREF}"/>`;
const MARKER = /<link[^>]+href="[^"]*airline-base\.css"/i;
/* charset は同じ行に viewport が並んでいる（生成物なので必ずこの形）。
   行末で切って、その直後に差し込む。 */
const AFTER_CHARSET = /(<meta\s+charset=[^>]*>(?:\s*<meta\s+name="viewport"[^>]*>)?)/i;

const dir = path.join(__dirname, 'en', 'airlines');
if (!fs.existsSync(dir)) { console.log('en/airlines が無い'); process.exit(0); }

let added = 0, already = 0, skipped = 0;
const notes = [];

for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html')).sort()) {
  const fp = path.join(dir, f);
  const html = fs.readFileSync(fp, 'utf8');

  if (MARKER.test(html)) { already++; continue; }

  const headEnd = html.search(/<\/head>/i);
  if (headEnd === -1) { skipped++; notes.push(`${f}: </head> が無い`); continue; }

  const head = html.slice(0, headEnd);
  if (!AFTER_CHARSET.test(head)) { skipped++; notes.push(`${f}: charset が見つからない`); continue; }

  /* ページ自身の <style> より前に入れられるかを確かめる。charset の位置が
     インラインCSSより後ろにあるような変則ページは、勝手に入れずに報告する。 */
  const insertAt = head.match(AFTER_CHARSET).index + head.match(AFTER_CHARSET)[1].length;
  const firstStyle = head.search(/<style[\s>]/i);
  if (firstStyle !== -1 && firstStyle < insertAt) {
    skipped++; notes.push(`${f}: インラインCSSが charset より前にある — カスケードが変わるので手で見る`);
    continue;
  }

  const out = head.slice(0, insertAt) + '\n' + TAG + head.slice(insertAt) + html.slice(headEnd);
  if (!DRY) fs.writeFileSync(fp, out);
  added++;
}

console.log(`${DRY ? '[dry] ' : ''}airline-base.css を ${added} 枚に追加 / 既にあり ${already} / 見送り ${skipped}`);
notes.forEach((n) => console.log('  ⚠ ' + n));
if (added) console.log('\n次: node assert-perf.mjs で CLS を測り直す');
