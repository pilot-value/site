/* gen-datemod.mjs — 記事ページの構造化データに「いつ書いた・いつ直した」を入れる（冪等）
   ==========================================================================
   なぜ:
     Article の構造化データに datePublished / dateModified が無いと、検索にも
     AI の引用にも「いつの情報か」が伝わらない。年収は年で変わる数字なので、
     日付が無いページは「古いかもしれない」側に置かれる。

   日付はどこから:
     ★作文しない。git が知っている実際の日付を使う。決め方は page-dates.mjs の1か所
       （gen-sitemap.mjs の lastmod も同じものを呼ぶ＝2つは必ず同じ日付になる）。
       datePublished = そのファイルが最初に入ったコミットの日
       dateModified  = 中身が最後に変わったコミットの日（未コミットの変更があれば今日）
     ★分からない日付は書かない。履歴が 2026-08-20 から始まっているので、
       それより前からあるページには datePublished を入れない（dateModified だけ）。

   使い方:
     node gen-datemod.mjs --check   何枚変わるかだけ出す（書かない）
     node gen-datemod.mjs           書く（★seo-normalize.mjs のあと・コミットの直前に流す）
     流し忘れは assert-generated.mjs が捕まえる。
   ========================================================================== */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageDates, historyStart } from './page-dates.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const CHECK = process.argv.includes('--check');
// ── JSON-LD の中の Article ノードに日付を差し込む ──
/* ★git が知らない日付は、ページに元から手で書いてあった日付を残す。
     履歴が始まった日（SINCE）より前の日付は、このスクリプトが git から作ったものではあり得ない
     ＝人が書いたもの。2026-09-18 の初版はこれを SINCE の日付で上書きしていた
     （pilot-vs-isha.html の公開日 2026-05-16 が 2026-08-20 になった）。
   ★SINCE ちょうどの日付は残さない。初版が「履歴の始まり＝公開日」として書いたもので、
     本当の公開日ではない。 */
const SINCE = historyStart(ROOT);
const pick = (git, old) => git || (old && old < SINCE ? old : undefined);

const LD = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g;
const missed = new Set();                                  // 直す必要があったのに直せなかったページ
function stamp(rel, html, pub, mod) {
  return html.replace(LD, (all, open, json, close) => {
    let o;
    try { o = JSON.parse(json); } catch { return all; }
    let hit = 0;
    const visit = (v) => {
      if (Array.isArray(v)) return v.map(visit);
      if (!v || typeof v !== 'object') return v;
      const out = {};
      const isArticle = v['@type'] === 'Article';
      if (isArticle) hit++;
      for (const k of Object.keys(v)) {
        if (isArticle && (k === 'datePublished' || k === 'dateModified')) continue;  // 入れ直す
        out[k] = visit(v[k]);
        if (isArticle && k === '@type') {
          const p = pick(pub, v.datePublished), m = pick(mod, v.dateModified);
          if (p) out.datePublished = p;                     // 分からない日付は書かない
          if (m) out.dateModified = m;
        }
      }
      return out;
    };
    const neu = visit(o);
    if (!hit || JSON.stringify(neu) === JSON.stringify(o)) return all;          // 直すことが無い
    if (JSON.stringify(o) === json.trim()) return open + JSON.stringify(neu) + close;
    const out = hit === 1 ? inPlace(json, neu) : null;
    if (out === null) { missed.add(rel); return all; }
    return open + out + close;
  });
}

/* 1行に詰めていないブロック（ana-vs-jal.html・pilot-salary-guide.html・starlux-tenshoku.html の日英）。
   丸ごと書き直すと関係ない全行が差分になるので、Article の { … } の中の日付だけを差し替える。
   ★差し替えた結果を JSON として読み直し、欲しい中身と1文字も違わないときだけ採る。
     違えば null（＝書かずに「直せなかった」に名前を出す）。 */
function inPlace(json, want) {
  const ty = [...json.matchAll(/"@type"(\s*:\s*)"Article"/g)];
  if (ty.length !== 1) return null;
  const at = ty[0].index, sep = ty[0][1], stack = [];
  let s = -1, e = -1, level = 0, inStr = false;            // Article の { … } の範囲（文字列の中の括弧は数えない）
  for (let i = 0; i < json.length && e < 0; i++) {
    if (i === at) { s = stack[stack.length - 1] ?? -1; level = stack.length; }
    const c = json[i];
    if (inStr) { if (c === '\\') i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') stack.push(i);
    else if (c === '}') { if (s >= 0 && stack.length === level) e = i + 1; stack.pop(); }
  }
  if (s < 0 || e < 0) return null;
  const node = (function find(v) {
    if (Array.isArray(v)) { for (const x of v) { const r = find(x); if (r) return r; } return null; }
    if (!v || typeof v !== 'object') return null;
    if (v['@type'] === 'Article') return v;
    for (const k of Object.keys(v)) { const r = find(v[k]); if (r) return r; }
    return null;
  })(want);
  const obj = json.slice(s, e)
    .replace(/\s*"date(?:Published|Modified)"\s*:\s*"[^"]*"\s*,/g, () => '')          // 途中にある日付
    .replace(/,\s*"date(?:Published|Modified)"\s*:\s*"[^"]*"(?=\s*\})/g, () => '')    // 最後の項目だった日付
    .replace(/("@type"\s*:\s*"Article"\s*,)(\s*)/, (m, a, lead) => a + lead            // @type の直後に、周りと同じ書き方で
      + ['datePublished', 'dateModified'].filter((k) => node[k]).map((k) => `"${k}"${sep}"${node[k]}",${lead}`).join(''));
  const out = json.slice(0, s) + obj + json.slice(e);
  try { if (JSON.stringify(JSON.parse(out)) === JSON.stringify(want)) return out; } catch { /* 採らない */ }
  return null;
}

const walk = (dir, acc = []) => {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git' || e === 'temporary screenshots') continue;
    const p = join(dir, e);
    statSync(p).isDirectory() ? walk(p, acc) : e.endsWith('.html') && acc.push(p);
  }
  return acc;
};

const pages = walk(ROOT).sort()
  .map((f) => ({ f, rel: relative(ROOT, f).split('\\').join('/'), src: readFileSync(f, 'utf8') }))
  .filter((p) => /"@type": ?"Article"/.test(p.src));
const dates = pageDates(ROOT, pages.map((p) => p.rel));

let n = 0, noGit = [];
for (const { f, rel, src } of pages) {
  const { published: pub, modified: mod } = dates.get(rel);
  if (!mod) noGit.push(rel);                              // 2026-08-20 から一度も直していない＝日付が分からない
  const neu = stamp(rel, src, pub, mod);
  if (neu === src) continue;
  n++;
  if (!CHECK) writeFileSync(f, neu);
}
console.log(`日付を入れた: ${n}枚${CHECK ? '（--check なので書いていない）' : ''}`);
if (noGit.length) console.log(`更新日が分からないので入れなかった ${noGit.length}件（履歴の始まり 2026-08-20 から一度も直していない）:\n  ` + noGit.join('\n  '));
/* ★直せなかったページを黙って見逃さない。日付が古いまま残る＝「いつの情報か」を偽る。 */
if (missed.size) {
  console.log(`✗ 日付を直せなかった ${missed.size}件（JSON-LD の書き方を読み切れなかった。日付は古いまま）:\n  ` + [...missed].join('\n  '));
  process.exitCode = 1;
}
