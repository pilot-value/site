/* gen-datemod.mjs — 記事ページの構造化データに「いつ書いた・いつ直した」を入れる（冪等）
   ==========================================================================
   なぜ:
     Article の構造化データに datePublished / dateModified が無いと、検索にも
     AI の引用にも「いつの情報か」が伝わらない。年収は年で変わる数字なので、
     日付が無いページは「古いかもしれない」側に置かれる。

   日付はどこから:
     ★作文しない。git が知っている実際の日付を使う。
       datePublished = そのファイルが最初に入ったコミットの日
       dateModified  = 最後に触ったコミットの日（未コミットの変更があれば今日）

   使い方:
     node gen-datemod.mjs --check   何枚変わるかだけ出す（書かない）
     node gen-datemod.mjs           書く（★コミットの直前に流す）
   ========================================================================== */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const CHECK = process.argv.includes('--check');
const TODAY = new Date().toISOString().slice(0, 10);

// ── git の日付を1回のログ走査で全部集める（ファイルごとに git を呼ぶと数百回になる）──
const first = new Map(), last = new Map();
{
  const log = execSync('git log --diff-filter=AM --date=short --format="C%ad" --name-only -- "*.html"',
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  let date = null;
  for (const line of log.split('\n')) {
    if (line.startsWith('C')) { date = line.slice(1).trim(); continue; }
    const f = line.trim();
    if (!f || !date) continue;
    if (!last.has(f)) last.set(f, date);   // git log は新しい順
    first.set(f, date);                    // 最後に上書きされるのが一番古い
  }
}
/* 「今日ほんとうに中身が変わったか」を見る。
   ★git status をそのまま使うと、このスクリプト自身が入れた日付でファイルが汚れ、
     次に流したときに**中身が1文字も変わっていないページまで「今日直した」**になる。
     数字を盛らないために、日付の行だけ取り除いてから HEAD と突き合わせる。 */
const STRIP = /"datePublished":"[^"]*","dateModified":"[^"]*",/g;
const dirty = new Set();
for (const rel of execSync('git diff --name-only HEAD -- "*.html"', { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 })
  .split('\n').map((l) => l.trim()).filter(Boolean)) {
  let head = '';
  try { head = execSync(`git show HEAD:"${rel}"`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }); }
  catch { dirty.add(rel); continue; }                       // 新しく足したページ
  const now = readFileSync(join(ROOT, rel), 'utf8');
  if (now.replace(STRIP, '') !== head.replace(STRIP, '')) dirty.add(rel);
}

// ── JSON-LD の中の Article ノードに日付を差し込む ──
// ★ブロックを JSON として読み、元の文字列に戻せることを確かめてからでないと書かない
//   （整形して書いてあるブロックを触ると、関係ない全行が差分になる）。
const LD = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g;
function stamp(html, pub, mod) {
  return html.replace(LD, (all, open, json, close) => {
    let o;
    try { o = JSON.parse(json); } catch { return all; }
    if (JSON.stringify(o) !== json.trim()) return all;      // 元の形に戻せない＝触らない
    let hit = false;
    const visit = (v) => {
      if (Array.isArray(v)) return v.map(visit);
      if (!v || typeof v !== 'object') return v;
      const out = {};
      const isArticle = v['@type'] === 'Article';
      if (isArticle) hit = true;
      for (const k of Object.keys(v)) {
        if (isArticle && (k === 'datePublished' || k === 'dateModified')) continue;  // 入れ直す
        out[k] = visit(v[k]);
        if (isArticle && k === '@type') { out.datePublished = pub; out.dateModified = mod; }
      }
      return out;
    };
    const neu = visit(o);
    return hit ? open + JSON.stringify(neu) + close : all;
  });
}

const walk = (dir, acc = []) => {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git' || e === 'temporary screenshots') continue;
    const p = join(dir, e);
    statSync(p).isDirectory() ? walk(p, acc) : e.endsWith('.html') && acc.push(p);
  }
  return acc;
};

let n = 0, noGit = [], untouched = [];
for (const f of walk(ROOT).sort()) {
  const src = readFileSync(f, 'utf8');
  if (!/"@type": ?"Article"/.test(src)) continue;
  const rel = relative(ROOT, f).split('\\').join('/');
  const pub = first.get(rel), mod = dirty.has(rel) ? TODAY : last.get(rel);
  if (!pub || !mod) { noGit.push(rel); continue; }        // git が知らないファイルは日付を作らない
  const neu = stamp(src, pub, mod);
  /* ★入らなかったページを黙って見逃さない。JSON-LD を整形して書いてあるブロックは
     触らない作りなので、そのぶんは日付が付かない。数が合わないと気づけるように出す。 */
  if (!/"dateModified"/.test(neu)) untouched.push(rel);
  if (neu === src) continue;
  n++;
  if (!CHECK) writeFileSync(f, neu);
}
console.log(`日付を入れた: ${n}枚${CHECK ? '（--check なので書いていない）' : ''}`);
if (noGit.length) console.log(`git に履歴が無いので飛ばした ${noGit.length}件:\n  ` + noGit.join('\n  '));
if (untouched.length) console.log(`日付が付かなかった ${untouched.length}件（JSON-LD が整形して書いてある）:\n  ` + untouched.join('\n  '));
