/* cur-core.mjs — currency.js の「本物の関数」を読み出して Node から使う。
   ------------------------------------------------------------------
   ★写さない。currency.js のソースから該当関数の本文をそのまま切り出して評価する。
     コピーを置くと currency.js を直したときに黙ってズレる（このリポジトリの
     「同じ式が2か所」系の事故と同じ形）。切り出しに失敗したら例外で止まる。

   使う側:
     const C = await curCore('USD');
     C.tokens(text)  → [{start, len, jpy, orig, text}, ...]  （円トークンの並び）
     C.fmt(jpy)      → '$233K'
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const HERE = fileURLToPath(new URL('.', import.meta.url));

// currency.js から「名前付き関数の本文まるごと」を波括弧の対応で切り出す
function mask(src) {
  // 文字列・コメント・正規表現リテラルの中身を空白に潰した複製。
  // 波括弧の対応をこの複製の上で数え、元のソースを同じ位置で切り出す。
  const out = src.split('');
  const blank = (i, j) => { for (let k = i; k < j; k++) if (out[k] !== '\n') out[k] = ' '; };
  let prev = '';                                 // 直前の空白でない文字（除算 / と正規表現 / の判別）
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1; while (j < src.length && !(src[j] === c && src[j - 1] !== '\\')) j++;
      blank(i + 1, j); i = j; prev = c; continue;
    }
    if (c === '/' && src[i + 1] === '/') { let j = src.indexOf('\n', i); if (j < 0) j = src.length; blank(i, j); i = j - 1; continue; }
    if (c === '/' && src[i + 1] === '*') { const j = src.indexOf('*/', i) + 2; blank(i, j); i = j - 1; continue; }
    if (c === '/' && !'0123456789)]}abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$'.includes(prev)) {
      let j = i + 1; while (j < src.length && !(src[j] === '/' && src[j - 1] !== '\\')) j++;
      blank(i + 1, j); i = j; prev = '/'; continue;
    }
    if (!/\s/.test(c)) prev = c;
  }
  return out.join('');
}

// currency.js から「名前付き関数の本文まるごと」を波括弧の対応で切り出す
function grabFn(src, name) {
  const m = mask(src);
  const head = `function ${name}(`;
  const i = m.indexOf(head);
  if (i < 0) throw new Error(`currency.js に function ${name}( が無い（切り出し失敗）`);
  if (m.indexOf(head, i + 1) >= 0) throw new Error(`function ${name}( が2つある（切り出し不能）`);
  let depth = 0;
  for (let k = m.indexOf('{', i); k < m.length; k++) {
    if (m[k] === '{') depth++;
    else if (m[k] === '}') { depth--; if (depth === 0) return src.slice(i, k + 1); }
  }
  throw new Error(`function ${name} の終わりが見つからない`);
}

// var NAME = …; の1行をそのまま切り出す
function grabVar(src, name) {
  const re = new RegExp('^\\s*var\\s+' + name + '\\s*=\\s*.*;$', 'm');
  const m = src.match(re);
  if (!m) throw new Error(`currency.js に var ${name} = … の行が無い`);
  return m[0].trim();
}

/* 焼き込み済みの span を元の円表記へ戻す（完全可逆）。
   ★ページの「ソース」を読んで金額を照合する道具（check-salary.mjs）は、必ずこれを
     通してから読む。通さないと、焼き込んだページが**黙って照合から外れる**
     （タグの中の data-orig は正規表現から見えない）。 */
export const unbake = (html) => html.replace(
  /<span class="pv-cur" data-jpy="\d+" data-orig="([^"]*)"[^>]*>.*?<\/span>/g,
  (_, orig) => orig.replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
);

const attrEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const textEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* 円トークンを含む「地の文1つ」を、currency.js が実行時に作るのと同じ span へ。
   ★span の作り方はここ1か所（bake-en-currency.mjs も本文の生成もこれを呼ぶ）。 */
export function bakeText(text, C) {
  const toks = C.tokens(text);
  if (!toks.length) return text;
  let p = 0, out = '';
  for (const t of toks) {
    out += text.slice(p, t.start)
        + `<span class="pv-cur" data-jpy="${t.jpy}" data-orig="${attrEsc(t.orig)}">`
        + textEsc(C.fmt(t.jpy)) + '</span>';
    p = t.start + t.len;
  }
  return out + text.slice(p);
}

export async function curCore(state = 'USD', lang = 'en') {
  const src = readFileSync(HERE + 'currency.js', 'utf8');
  const body = [
    `var state = ${JSON.stringify(state)};`,
    `var LANG  = ${JSON.stringify(lang)};`,
    grabVar(src, 'RATES'),
    grabVar(src, 'SYM'),
    ...['parseNum', 'trimZero', 'compact', 'sigRound', 'fmt', 'sufMul', 'makeRe', 'matchToParts']
      .map((n) => grabFn(src, n)),
    'return { fmt: fmt, makeRe: makeRe, matchToParts: matchToParts, RATES: RATES };'
  ].join('\n');
  const core = new Function(body)();

  // 1テキスト片の中の円トークンを、currency.js の wrapNode と同じ順・同じ分解で返す
  core.tokens = (text) => {
    const re = core.makeRe(); let m; const out = [];
    while ((m = re.exec(text))) {
      const matched = m[0], start = m.index, parts = core.matchToParts(m);
      if (parts == null) { if (re.lastIndex === start) re.lastIndex++; continue; }
      if (parts.range) {
        out.push({ start, len: parts.loOrig.length, jpy: parts.lo, orig: parts.loOrig });
        out.push({ start: start + matched.length - parts.hiOrig.length, len: parts.hiOrig.length,
                   jpy: parts.hi, orig: parts.hiOrig });
      } else {
        out.push({ start, len: matched.length, jpy: parts.jpy, orig: matched });
      }
      if (re.lastIndex === start) re.lastIndex++;
    }
    return out;
  };
  return core;
}
