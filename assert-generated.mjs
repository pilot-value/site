#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
//  assert-generated.mjs — 生成物が古いまま commit されていないかを見る
//
//  なぜ要るのか。
//  このリポジトリには「元データを直したあと、生成スクリプトを流し直して
//  はじめて正しくなる」ファイルがある。流し忘れても画面は普通に動くし、
//  検査も1本も赤くならない。実際 2026-08-27 の時点で sitemap.xml が
//  4日ぶん古いまま commit されていた（気づいたのは手で見比べたから）。
//  年収だけは check-salary.mjs が拾っていた。残りは無検査だった。
//
//  やり方 ── リポジトリには1バイトも書かない。
//    1. HEAD（次に push される中身）を使い捨てフォルダへ展開する
//    2. その中でハッシュを取る
//    3. その中でだけ生成スクリプトを流す
//    4. もう一度ハッシュを取って、変わったファイルを探す
//    5. フォルダごと捨てる
//  変わった＝コミット済みの生成物が古い。
//
//  ★ 初版は「本物のフォルダで流して git checkout で戻す」形だった。やめた。
//    戻す手段が git checkout ＝「変更を捨てる」操作しかなく、未コミットの
//    変更を巻き込んで消してしまう。このリポジトリでは実際にサブエージェントの
//    git checkout で約90ページを失った事故がある。
//    使い捨てのコピーの中で回せば、そもそも戻す操作が要らない。
//    おまけに ── 作業ツリーが汚れていても走れる（check.mjs に入れられる）／
//    手元の保存し忘れに影響されず、実際に push される中身を見る。
//
//  ★ .git だけはリンクで貸す。gen-sitemap.mjs が lastmod を git のコミット日
//    から作っているため（gen-sitemap.mjs:72）。貸さずに流すと、あの try/catch が
//    黙って mtime へ落ちて sitemap の 760 行が別物になり、毎回「古い」と嘘をつく。
//    ★実際にこの検査を書いている最中に踏んだ。
//    git を使うのは4本のうち gen-sitemap だけで、呼ぶのは git log ＝読むだけ。
//    ただし「今のコードは読むだけ」に頼りたくないので、流す前後で HEAD と index を
//    突き合わせて、本当に書かれていないことを毎回確かめる（下の GIT_GUARD）。
//
//  ★ 画像は展開しない（46MB のうちほとんどが画像で、4本とも読まない）。
//    もし生成物が画像の有無で変わるなら、この検査が緑にならないので気づける。
//
//  ★ seo-normalize.mjs はここに入れていない。約250枚の HTML を書き換える
//    一括編集で、「生成物」とは性質が違う。
// ═══════════════════════════════════════════════════════════════════
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync, symlinkSync } from 'fs';
import { join, relative } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

// 流す生成スクリプトと、それが何を作るか（メッセージ用）
const GENERATORS = [
  ['gen-salary-json.mjs', 'salary-data.json（年収の公開用JSON）'],
  ['gen-sitemap.mjs',     'sitemap.xml（検索エンジンに渡す一覧）'],
  ['gen-en-manifest.mjs', 'lang-toggle.js の EN_PAGES（英語版がある頁の一覧）'],
  ['gen-vocab.mjs',       'pv-vocab.json / db/vocab.generated.sql（選択肢と為替）'],
];

// 4本とも読まない重いもの。展開しないぶん速くなる。
const SKIP = ['*.png','*.jpg','*.jpeg','*.gif','*.webp','*.ico','*.pdf',
              '*.mp4','*.zip','*.woff','*.woff2','*.ttf'];

function hashTree(dir) {
  const out = new Map();
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) out.set(relative(dir, p), createHash('sha1').update(readFileSync(p)).digest('hex'));
    }
  })(dir);
  return out;
}

const work = mkdtempSync(join(tmpdir(), 'pv-generated-'));
let fail = 0;

try {
  // ── 1. HEAD を使い捨てフォルダへ ────────────────────────────
  const ex = SKIP.map(p => `--exclude='${p}'`).join(' ');
  const r = spawnSync('sh', ['-c', `git archive HEAD | tar -x -C "${work}" ${ex}`],
                      { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) {
    console.log('✗ HEAD を取り出せなかった ── git のある場所で流しているか確認する\n');
    console.log((r.stderr || '').trim().split('\n').map(l => '    ' + l).join('\n'));
    process.exit(1);
  }

  console.log('HEAD を使い捨てフォルダに展開して、その中で生成スクリプトを流す');
  console.log('（このリポジトリのファイルには書き込まない）\n');

  // gen-sitemap が git のコミット日を読めるように .git を貸す（読むだけのはず）
  const gitDir = join(ROOT, '.git');
  const guard = () => ['HEAD', 'index', 'ORIG_HEAD'].map(f => {
    const p = join(gitDir, f);
    return existsSync(p) ? createHash('sha1').update(readFileSync(p)).digest('hex') : '-';
  }).join(' ');
  const gitBefore = guard();
  symlinkSync(gitDir, join(work, '.git'));

  const before = hashTree(work);

  // ── 2. コピーの中でだけ流す ────────────────────────────────
  const crashed = [];
  for (const [script, what] of GENERATORS) {
    if (!existsSync(join(work, script))) { crashed.push([script, 'HEAD に入っていない']); continue; }
    const g = spawnSync('node', [join(work, script)], { cwd: work, encoding: 'utf8' });
    if (g.status !== 0) {
      crashed.push([script, (g.stderr || g.stdout || '').trim().split('\n').slice(-3).join('\n')]);
      console.log(`  ✗ ${script} が落ちた`);
    } else {
      console.log(`  ・${script} を流した → ${what}`);
    }
  }

  // ── 3. 見比べる ────────────────────────────────────────────
  const after = hashTree(work);

  // 貸した .git が本当に読まれただけかを確かめる
  if (guard() !== gitBefore) {
    console.log('\n✗ 生成スクリプトが .git を書き換えた ── 貸すのをやめる必要がある\n');
    console.log('    このリポジトリの git の状態が変わっている。手で確認する:');
    console.log('      git status && git log --oneline -3\n');
    process.exitCode = 1; fail++;
  }
  const stale = [];
  for (const [f, h] of after) if (!before.has(f) || before.get(f) !== h) stale.push(f);
  stale.sort();

  console.log('');

  if (crashed.length) {
    fail++;
    console.log('✗ 生成スクリプトが落ちた ── 中身の新しさ以前の問題\n');
    for (const [s, m] of crashed) console.log(`    ${s}\n${m.split('\n').map(l => '      ' + l).join('\n')}`);
    console.log('');
  }

  if (stale.length) {
    fail++;
    console.log('✗ コミット済みの生成物が古い ── 元データを直したあと流し忘れている\n');
    for (const f of stale) console.log(`    ${f}`);
    console.log('\n  直し方: 下を流して、出た差分をそのまま commit する。');
    console.log('    node gen-salary-json.mjs && node gen-sitemap.mjs \\');
    console.log('      && node gen-en-manifest.mjs && node gen-vocab.mjs');
    console.log('\n  ⚠ db/vocab.generated.sql が入っていたら、Supabase に貼るまで');
    console.log('    本番の選択肢・為替は古いまま（貼るのはオーナー作業）。');
    console.log('');
  }

  if (!fail) console.log(`✅ 生成物は全部いまの元データと一致している（${before.size} 本を照合）`);
  else console.log(`══ ${fail} 件 ══`);
} finally {
  // ── 4. 使い捨てフォルダを捨てる ────────────────────────────
  rmSync(work, { recursive: true, force: true });
}

process.exit(fail ? 1 : 0);
