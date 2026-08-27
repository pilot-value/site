#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
//  assert-generated.mjs — 生成物が古いまま commit されていないかを見る
//
//  なぜ要るのか。
//  このリポジトリには「元データを直したあと、生成スクリプトを流し直して
//  はじめて正しくなる」ファイルが4種類ある。流し忘れても画面は普通に動くし、
//  検査も1本も赤くならない。実際 2026-08-27 の時点で sitemap.xml が
//  4日ぶん古いまま commit されていた（気づいたのは手で見比べたから）。
//
//  年収だけは check-salary.mjs が拾ってくれる（salary-data.json と
//  salary-data.mjs のズレを見ている）。残りは誰も見ていなかった。
//
//  やり方。
//  生成スクリプトを実際に流して、git の作業ツリーに差分が出るかを見る。
//  差分が出た＝コミット済みの物が古い。流した分は最後に必ず元へ戻すので、
//  この検査はファイルを残さない。
//
//  ★ 作業ツリーが汚れているときは走らせない（exit 1）。
//    元に戻す手段が git checkout しかない以上、未コミットの変更がある状態で
//    走らせると、それを巻き込んで消してしまう。
//    「消さないために緑を返す」のではなく「走れないから赤」にしてある。
//    assert-no-pii.mjs が denylist の無いときに落ちるのと同じ考え方。
//    ＝ 未コミットの変更を消した事故は、このリポジトリで実際に起きている
//      （サブエージェントの git checkout で約90ページ）。
//
//  ★ seo-normalize.mjs はここに入れていない。
//    約250枚の HTML を書き換えるので、途中で止まったときの巻き戻しが重い。
//    あれは「生成物」というより一括編集で、性質が違う。
// ═══════════════════════════════════════════════════════════════════
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const git = (...a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' });

// 流す生成スクリプトと、それが何を作るか（メッセージ用）
const GENERATORS = [
  ['gen-salary-json.mjs',  'salary-data.json（年収の公開用JSON）'],
  ['gen-sitemap.mjs',      'sitemap.xml（検索エンジンに渡す一覧）'],
  ['gen-en-manifest.mjs',  'lang-toggle.js の EN_PAGES（英語版がある頁の一覧）'],
  ['gen-vocab.mjs',        'pv-vocab.json / db/vocab.generated.sql（選択肢と為替）'],
];

// ── 前提: 追跡中のファイルに未コミットの変更が無いこと ──────────────
const dirty = git('status', '--porcelain', '--untracked-files=no').stdout.trimEnd();
if (dirty) {
  console.log('⚠ 走らせられない ── 未コミットの変更がある\n');
  console.log(dirty.split('\n').map(l => '    ' + l).join('\n'));
  console.log('\n  この検査は生成スクリプトを実際に流して差分を見る。');
  console.log('  流した分を戻す手段が git checkout しかないので、この状態で走らせると');
  console.log('  上の変更を巻き込んで消してしまう。');
  console.log('  → 先に commit するか git stash してから流す。');
  console.log('\n  （未追跡ファイルは触らないので、置いたままで構わない）');
  process.exit(1);
}

// ── 生成スクリプトを流す ────────────────────────────────────────
console.log('生成スクリプトを流して、コミット済みの物と食い違わないかを見る\n');
const crashed = [];
for (const [script, what] of GENERATORS) {
  const r = spawnSync('node', [script], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) {
    crashed.push([script, (r.stderr || r.stdout || '').trim().split('\n').slice(-3).join('\n')]);
    console.log(`  ✗ ${script} が落ちた`);
  } else {
    console.log(`  ・${script} を流した → ${what}`);
  }
}

// ── 差分を見る ──────────────────────────────────────────────────
// ⚠ trim() を使わない。1行目の先頭の空白（git の状態欄）が消えて slice(3) が1文字ずれる。
const changed = git('status', '--porcelain', '--untracked-files=no').stdout.trimEnd();

// ── 何があっても元へ戻す ────────────────────────────────────────
if (changed) git('checkout', '--', '.');
const leftover = git('status', '--porcelain', '--untracked-files=no').stdout.trimEnd();

console.log('');
let fail = 0;

if (crashed.length) {
  fail++;
  console.log('✗ 生成スクリプトが落ちた ── 中身の新しさ以前の問題\n');
  for (const [s, msg] of crashed) console.log(`    ${s}\n${msg.split('\n').map(l => '      ' + l).join('\n')}`);
  console.log('');
}

if (changed) {
  fail++;
  const files = changed.split('\n').map(l => l.slice(3));
  console.log('✗ コミット済みの生成物が古い ── 元データを直したあと流し忘れている\n');
  for (const f of files) console.log(`    ${f}`);
  console.log('\n  直し方: 下を流して、出た差分をそのまま commit する。');
  console.log('    node gen-salary-json.mjs && node gen-sitemap.mjs \\');
  console.log('      && node gen-en-manifest.mjs && node gen-vocab.mjs');
  console.log('\n  ⚠ db/vocab.generated.sql が入っていたら、Supabase に貼るまで');
  console.log('    本番の選択肢・為替は古いまま（貼るのはオーナー作業）。');
  console.log('');
}

if (leftover) {
  fail++;
  console.log('✗ 元に戻しきれなかった ── 手で確認する\n');
  console.log(leftover.split('\n').map(l => '    ' + l).join('\n') + '\n');
}

if (!fail) console.log('✅ 生成物は全部いまの元データと一致している');
else console.log(`══ ${fail} 件 ══`);
process.exit(fail ? 1 : 0);
