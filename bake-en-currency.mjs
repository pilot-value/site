/* bake-en-currency.mjs — 英語ページの円トークンを、HTML の時点でドルにする（冪等）
   ==========================================================================
   なぜ:
     英語ページの本文は今も「¥37M」と書いてあり、ドルに見えているのは currency.js が
     読み込み後に書き換えているから。**JavaScript を実行しない相手**（ChatGPT や
     Perplexity の取得ロボット、一部の検索クローラ）には、円のままの本文しか届かない。
     「Emirates の機長はいくら」に答えられるページとして選ばれない理由の1つ。

   何をするか:
     currency.js が実行時に作るのと同じ span を、あらかじめ HTML に書き込む。

       ¥37M
       → <span class="pv-cur" data-jpy="37000000" data-orig="¥37M">$233K</span>

     ・`pv-cur` は currency.js の SKIP_CLASS に入っている＝再走査されない（何度流しても同じ）
     ・data-jpy が残るので通貨切替は今までどおり全通貨で動く
     ・円は salary-data.mjs が正のまま。ここは表示だけ

   ★数値も判定も currency.js から読み出す（cur-core.mjs）。写さない。

   使い方:
     node bake-en-currency.mjs --check    何件変わるかだけ出す（書かない）
     node bake-en-currency.mjs            書く
     node bake-en-currency.mjs --undo     span を元の円表記へ戻す（逆変換・完全可逆）
   ========================================================================== */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { curCore, bakeText, unbake } from './cur-core.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const ARG = new Set(process.argv.slice(2));
const CHECK = ARG.has('--check'), UNDO = ARG.has('--undo');

// ── currency.js 側の除外リストを読み出す（写さない）──
const CJS = readFileSync(join(ROOT, 'currency.js'), 'utf8');
const grabObj = (name) => {
  const i = CJS.indexOf(`var ${name}`);
  if (i < 0) throw new Error(`currency.js に var ${name} が無い`);
  let k = CJS.indexOf('{', i), depth = 0;
  for (; k < CJS.length; k++) {
    if (CJS[k] === '{') depth++;
    else if (CJS[k] === '}') { depth--; if (!depth) break; }
  }
  // キーだけ欲しいので、コメント行を落としてから拾う
  return CJS.slice(i, k + 1).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
    .match(/['"]?([A-Za-z-]+)['"]?\s*:/g).map((s) => s.replace(/['":\s]/g, ''));
};
const SKIP_TAG = new Set(grabObj('SKIP_TAG').map((s) => s.toUpperCase()));
const SKIP_CLASS = new Set(grabObj('SKIP_CLASS'));
const VOID = new Set(['AREA','BASE','BR','COL','EMBED','HR','IMG','INPUT','LINK','META','PARAM','SOURCE','TRACK','WBR']);

// ── HTML を「タグ／コメント／地の文」に切り分けて歩く ──
// currency.js の scan() と同じ範囲だけを対象にする＝<body> の中・除外要素の外。
function* segments(html) {
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) { yield { kind: 'text', start: i, end: html.length }; return; }
    if (lt > i) yield { kind: 'text', start: i, end: lt };
    if (html.startsWith('<!--', lt)) {
      const e = html.indexOf('-->', lt); i = e < 0 ? html.length : e + 3;
      yield { kind: 'comment', start: lt, end: i }; continue;
    }
    // 属性値の中の > で切らない
    let k = lt + 1, q = null;
    while (k < html.length) {
      const c = html[k];
      if (q) { if (c === q) q = null; }
      else if (c === '"' || c === "'") q = c;
      else if (c === '>') break;
      k++;
    }
    i = k + 1;
    yield { kind: 'tag', start: lt, end: i, raw: html.slice(lt, i) };
  }
}

function bakeFile(html, C) {
  const out = []; let last = 0;
  let inBody = false, skip = 0;           // skip>0 のあいだ地の文を触らない
  const stack = [];                        // [{name, skips}]
  let nTok = 0;
  for (const seg of segments(html)) {
    if (seg.kind === 'tag') {
      const raw = seg.raw;
      if (/^<\//.test(raw)) {
        const name = (raw.match(/^<\/\s*([A-Za-z][\w-]*)/) || [, ''])[1].toUpperCase();
        if (name === 'BODY') inBody = false;
        for (let j = stack.length - 1; j >= 0; j--) {          // 閉じ忘れに強く
          if (stack[j].name === name) {
            for (let m = stack.length - 1; m >= j; m--) if (stack[m].skips) skip--;
            stack.length = j; break;
          }
        }
        continue;
      }
      const name = (raw.match(/^<\s*([A-Za-z][\w-]*)/) || [, ''])[1].toUpperCase();
      if (!name) continue;
      if (name === 'BODY') { inBody = true; continue; }
      if (VOID.has(name) || /\/>$/.test(raw)) continue;
      const cls = (raw.match(/\sclass\s*=\s*("([^"]*)"|'([^']*)')/i) || [])[0] || '';
      const skips = SKIP_TAG.has(name)
        || cls.split(/[\s"'=]+/).some((c) => SKIP_CLASS.has(c));
      if (skips) skip++;
      stack.push({ name, skips });
      continue;
    }
    if (seg.kind !== 'text' || !inBody || skip > 0) continue;
    const text = html.slice(seg.start, seg.end);
    if (text.indexOf('万') < 0 && text.indexOf('億') < 0 && text.indexOf('¥') < 0) continue;
    const toks = C.tokens(text);
    if (!toks.length) continue;
    const buf = bakeText(text, C);
    nTok += toks.length;
    out.push(html.slice(last, seg.start), buf);
    last = seg.end;
  }
  out.push(html.slice(last));
  return { html: out.join(''), nTok };
}

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (e.endsWith('.html')) acc.push(p);
  }
  return acc;
}

const C = await curCore('USD', 'en');
const files = walk(join(ROOT, 'en')).sort();
let nFiles = 0, nTokAll = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const res = UNDO ? { html: unbake(src), nTok: 0 } : bakeFile(src, C);
  if (res.html === src) continue;
  nFiles++; nTokAll += res.nTok;
  if (!CHECK) writeFileSync(f, res.html);
}
console.log(UNDO
  ? `${files.length}枚を見て ${nFiles}枚を円表記へ戻した`
  : `${files.length}枚を見て ${nFiles}枚・${nTokAll}件をドル表記にした${CHECK ? '（--check なので書いていない）' : ''}`);
