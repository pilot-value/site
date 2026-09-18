/* page-dates.mjs — ページごとの「最初に出した日」と「最後に中身を直した日」を git の履歴から出す
   ==========================================================================
   使うのは2本:
     gen-datemod.mjs … JSON-LD の Article の datePublished / dateModified
     gen-sitemap.mjs … sitemap.xml の lastmod
   ★2本が別々に数えていた頃は、同じページがサイトマップでは「9月18日」、
     JSON-LD では「9月7日」と食い違っていた（2026-09-18）。日付の決め方はここ1か所。

   決め方:
     published = そのファイルが最初に入ったコミットの日
     modified  = 中身が最後に変わったコミットの日
                 （まだコミットしていない変更があれば今日。まだ一度も
                   コミットしていないページは published も今日）

   ★分からない日付は null を返す（作文しない）。
     このリポジトリの履歴は 2026-08-20 の1コミット（親の無いコミット）から始まっていて、
     それより前からあるページも「その日に初めて入った」ように見えるが、本当の公開日は
     git からは分からない（pilot-salary-guide.html には手書きで 2026-03-30 とある）。
     なので、親の無いコミットで入ったページの published は null。
     そのコミットより後に一度も中身が変わっていないページは modified も null。

   ★「日付を入れただけ」の変更は、直した日に数えない。
     gen-datemod.mjs が日付を書き込むとファイルが変わり、そのコミットが
     「最後に触った日」になる。素直に数えると、中身が1文字も変わっていない
     ページまで毎回「今日直した」になる＝数字を盛る。
     なので、比べる前に日付の部分（strip）を両側から取り除き、それでも違う
     コミットだけを「直した」と数える。コミットした後でも同じ答えが出る。

   ★日付は手元の時計の日付（git の %cs と同じく、その土地の日付）。
     toISOString() は UTC なので、日本では 0〜9時に「昨日」になり、
     コミットの日付と1日ずれる。

   ★リポジトリには何も書かない（.git の索引にも触れない）。
     assert-generated.mjs が HEAD の使い捨てコピーの中でこれを走らせ、
     .git だけ貸している。作業ツリーの判定を git diff に頼らず、
     blob のハッシュを自分で計算しているのはそのため。
   ========================================================================== */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

/* 「日付の部分」を取り除いた形。JSON-LD を JSON として読み、Article の datePublished /
   dateModified を落としてから書き直す。
   ★文字列の置換で消す形だと、整形して書いてあるブロック（ana-vs-jal.html など）で
     日付の行を差し替えたときにカンマの位置が動き、「中身が変わった」と数えてしまう
     （2回目に流すと2枚が「今日直した」になった）。JSON として比べればその差は出ない。 */
const LD = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g;
const drop = (v) => {
  if (Array.isArray(v)) return v.map(drop);
  if (!v || typeof v !== 'object') return v;
  const out = {};
  for (const k of Object.keys(v)) {
    if (v['@type'] === 'Article' && (k === 'datePublished' || k === 'dateModified')) continue;
    out[k] = drop(v[k]);
  }
  return out;
};
const strip = (s) => s.replace(LD, (all, open, json, close) => {
  try { return open + JSON.stringify(drop(JSON.parse(json))) + close; } catch { return all; }
});

export const localToday = () => new Date().toLocaleDateString('sv-SE');   // YYYY-MM-DD（手元の時計）

const ZERO = /^0+$/;
const blobSha = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

/**
 * @param {string} root   リポジトリのルート
 * @param {string[]} rels ルートからの相対パス（/ 区切り）
 * @returns {Map<string, {published: string|null, modified: string|null}>}
 * git が使えないときは例外を投げる（呼ぶ側が mtime などへ逃がす）。
 */
export function pageDates(root, rels) {
  const git = (args) => execFileSync('git', ['-c', 'core.quotePath=false', ...args],
    { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
  const today = localToday();

  // HEAD に入っている HTML の blob
  const headBlob = new Map();
  for (const line of git(['ls-tree', '-r', 'HEAD']).split('\n')) {
    const m = line.match(/^\d+ blob ([0-9a-f]{40})\t(.+\.html)$/);
    if (m) headBlob.set(m[2], m[1]);
  }

  // ファイルごとの変更履歴（新しい順）。ファイルごとに git を呼ぶと数百回になるので1回で舐める
  const events = new Map();
  let date = null;
  let isRoot = false;
  for (const line of git(['log', '--no-renames', '--raw', '--no-abbrev', '--format=C%cs %P', '--', '*.html']).split('\n')) {
    if (line.startsWith('C')) { [date] = line.slice(1).split(' '); isRoot = !line.slice(1).trim().includes(' '); continue; }
    const m = line.match(/^:\d+ \d+ ([0-9a-f]{40}) ([0-9a-f]{40}) ([A-Z])\d*\t(.+)$/);
    if (!m || !date) continue;
    const [, old, neu, st, p] = m;
    if (!events.has(p)) events.set(p, []);
    events.get(p).push({ date: isRoot ? null : date, old, neu, st });   // 親の無いコミット＝日付は分からない
  }

  // blob の中身をまとめて1プロセスで読む
  const blobs = (shas) => {
    const want = [...new Set(shas)].filter((s) => s && !ZERO.test(s));
    const out = new Map();
    if (!want.length) return out;
    const r = spawnSync('git', ['cat-file', '--batch'],
      { cwd: root, input: want.join('\n') + '\n', maxBuffer: 1 << 30 });
    if (r.status !== 0) throw new Error('git cat-file が失敗した: ' + String(r.stderr));
    const buf = r.stdout;
    let i = 0;
    while (i < buf.length) {
      const nl = buf.indexOf(10, i);
      const [sha, type, size] = buf.toString('utf8', i, nl).split(' ');
      if (type === 'missing' || size === undefined) { i = nl + 1; continue; }
      const n = Number(size);
      out.set(sha, buf.toString('utf8', nl + 1, nl + 1 + n));
      i = nl + 1 + n + 1;                                  // 中身のあとに改行が1つ付く
    }
    return out;
  };

  const res = new Map();
  let pending = [];                                        // [rel, 履歴の何番目を見るか]
  const wt = [];
  for (const rel of rels) {
    const hb = headBlob.get(rel);
    if (!hb) { res.set(rel, { published: today, modified: today }); continue; }   // まだコミットしていない
    const ev = events.get(rel) || [];
    res.set(rel, { published: ev.length ? ev[ev.length - 1].date : today, modified: undefined });
    const cur = readFileSync(join(root, rel));
    if (blobSha(cur) === hb) pending.push([rel, 0]);
    else wt.push([rel, cur.toString('utf8'), hb]);
  }

  // まだコミットしていない変更: 日付の部分を除いても HEAD と違えば今日
  const head = blobs(wt.map((w) => w[2]));
  for (const [rel, cur, hb] of wt) {
    if (strip(cur) !== strip(head.get(hb) ?? '')) res.get(rel).modified = today;
    else pending.push([rel, 0]);
  }

  // 履歴を新しい順に1段ずつ遡る。ほとんどのページは1段目で決まる
  while (pending.length) {
    const shas = [];
    for (const [rel, i] of pending) {
      const e = events.get(rel)?.[i];
      if (e && e.st === 'M') shas.push(e.old, e.neu);
    }
    const bl = blobs(shas);
    const next = [];
    for (const [rel, i] of pending) {
      const r = res.get(rel);
      const e = events.get(rel)?.[i];
      if (!e) { r.modified = r.published; continue; }      // 遡り切った（日付を入れただけの変更しか無い。まず起きない）
      if (e.st === 'D') { next.push([rel, i + 1]); continue; }
      if (e.st !== 'M' || strip(bl.get(e.old) ?? '') !== strip(bl.get(e.neu) ?? '')) { r.modified = e.date; continue; }
      next.push([rel, i + 1]);                             // 日付を入れただけのコミット → もう1つ前へ
    }
    pending = next;
  }
  return res;
}

/** 履歴が始まった日（親の無いコミットの日）。これより前の日付は git からは作れない。 */
export function historyStart(root) {
  return execFileSync('git', ['log', '--max-parents=0', '--format=%cs'], { cwd: root, encoding: 'utf8' })
    .split('\n').filter(Boolean).sort()[0];
}
