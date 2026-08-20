/* 海外評判（overseas-rep/*.json）が「ある会社」の一覧を、
   airlines/airline-reviews-ui.js の中に書き出す。

   なぜ要るか:
   航空会社ページは開くたびに /overseas-rep/<コード>.json を取りに行っていた。
   用意してあるのは 61社ぶんだけなので、残り約51社 × 日英2枚 = 112ページで
   毎回 404 が返っていた。壊れてはいない（受け取れなければ黙って出さない作りになっている）が、
   ・毎回1往復むだに使う
   ・Cloudflare は「無い」も4時間ぶん覚えるので、後から JSON を足しても最大4時間は出てこない
   の2つが起きる。先に「ある会社」だけを持たせておけば、どちらも消える。

   使い方:
     node gen-overseas-rep-list.mjs           一覧を書き出す（JSON を足したら流す）
     node gen-overseas-rep-list.mjs --check   食い違いがあれば 1 で落ちる（assert-links.mjs が呼ぶ）

   ★何度流しても同じ結果になる（並び順は固定・既にある一覧は丸ごと置き換える）。 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const UI = join(ROOT, 'airlines/airline-reviews-ui.js');
const BEGIN = '/* PV_OVERSEAS_LIST:BEGIN */';
const END = '/* PV_OVERSEAS_LIST:END */';

/** overseas-rep/ にある会社コードを並べ替えて返す。 */
export function codesOnDisk() {
  return readdirSync(join(ROOT, 'overseas-rep'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .sort();
}

/** airline-reviews-ui.js に埋まっている一覧を返す。埋め込みが無ければ null。 */
export function codesInUi(src = readFileSync(UI, 'utf8')) {
  const i = src.indexOf(BEGIN);
  const j = src.indexOf(END);
  if (i < 0 || j < 0) return null;
  const body = src.slice(i + BEGIN.length, j);
  const m = body.match(/'([^']+)'/g);
  return m ? m.map((s) => s.slice(1, -1)) : [];
}

function block(codes) {
  /* 1行が長くなりすぎないよう、8個ずつ折り返す。 */
  const lines = [];
  for (let i = 0; i < codes.length; i += 8) {
    lines.push('    ' + codes.slice(i, i + 8).map((c) => `'${c}'`).join(', ') + (i + 8 < codes.length ? ',' : ''));
  }
  return `${BEGIN}\n  var PV_OVERSEAS = [\n${lines.join('\n')}\n  ];\n  ${END}`;
}

/* ⚠️ ここから下は「直接 node で流したとき」だけ動かす。
      assert-links.mjs が上の2つを import して使うので、
      素で書くと検査しただけでファイルを書き換えたり process.exit したりする。 */
const runDirect = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (!runDirect) { /* import されただけ。何もしない。 */ } else {

const isCheck = process.argv.includes('--check');
const want = codesOnDisk();
const src = readFileSync(UI, 'utf8');
const have = codesInUi(src);

if (isCheck) {
  if (have === null) { console.log('❌ airline-reviews-ui.js に一覧の埋め込みが無い'); process.exit(1); }
  const missing = want.filter((c) => !have.includes(c));
  const extra = have.filter((c) => !want.includes(c));
  if (!missing.length && !extra.length) { console.log(`✓ 海外評判の一覧は最新（${want.length}社）`); process.exit(0); }
  if (missing.length) console.log(`❌ JSON はあるのに一覧に無い（画面に出ない）: ${missing.join(', ')}`);
  if (extra.length) console.log(`❌ 一覧にあるのに JSON が無い（404 が出る）: ${extra.join(', ')}`);
  console.log('   → node gen-overseas-rep-list.mjs を流す');
  process.exit(1);
}

if (have === null) {
  console.log('❌ airline-reviews-ui.js に ' + BEGIN + ' … ' + END + ' が無い。手で置いてから流す。');
  process.exit(1);
}
const out = src.slice(0, src.indexOf(BEGIN)) + block(want) + src.slice(src.indexOf(END) + END.length);
if (out === src) { console.log(`変更なし（${want.length}社）`); }
else { writeFileSync(UI, out); console.log(`✓ 一覧を書き出した（${want.length}社）`); }

}
