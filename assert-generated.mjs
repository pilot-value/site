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
//  ★ .git だけはリンクで貸す。gen-sitemap.mjs の lastmod と gen-datemod.mjs の
//    JSON-LD の日付を、git の履歴から作っているため（どちらも page-dates.mjs）。貸さずに流すと、あの try/catch が
//    黙って mtime へ落ちて sitemap の 760 行が別物になり、毎回「古い」と嘘をつく。
//    ★実際にこの検査を書いている最中に踏んだ。
//    git を使うのは gen-sitemap と gen-datemod で、呼ぶのは ls-tree / log / cat-file ＝読むだけ
//    （作業ツリーの判定も git diff を使わず自前でハッシュを取る＝索引に触れない）。
//    ただし「今のコードは読むだけ」に頼りたくないので、流す前後で HEAD と index を
//    突き合わせて、本当に書かれていないことを毎回確かめる（下の GIT_GUARD）。
//
//  ★ 画像は展開しない（46MB のうちほとんどが画像で、どれも読まない）。
//    もし生成物が画像の有無で変わるなら、この検査が緑にならないので気づける。
//
//  ★ seo-normalize.mjs はここに入れていない。約250枚の HTML を書き換える
//    一括編集で、「生成物」とは性質が違う。
// ═══════════════════════════════════════════════════════════════════
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync, symlinkSync, realpathSync } from 'fs';
import { join, relative } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

// 流す生成スクリプトと、それが何を作るか（メッセージ用）
const GENERATORS = [
  ['gen-salary-json.mjs', 'salary-data.json（年収の公開用JSON）'],
  ['gen-sitemap.mjs',     'sitemap.xml（検索エンジンに渡す一覧）'],
  /* 2026-09-18 に足した。seo-normalize.mjs が管理ブロックを作り直すたびに日付を消していて、
     216枚の日付が黙って巻き戻っていた（画面は何も変わらない）。流し忘れもこれで分かる。 */
  ['gen-datemod.mjs',     'JSON-LD の datePublished / dateModified（ページの更新日）'],
  ['gen-en-manifest.mjs', 'lang-toggle.js の EN_PAGES（英語版がある頁の一覧）'],
  ['gen-vocab.mjs',       'pv-vocab.json / db/vocab.generated.sql（選択肢と為替）'],
  ['gen-airline-codes.mjs', 'airline-codes.json / pv-airlines.json / 投稿フォーム4枚 / db/airlines.generated.sql'],
  /* 2026-10-03。年収・根拠の台帳・写真の台帳を直したのに流し忘れると、この1枚だけ古い数字が残る。
     career.css / career.js の指紋（?v=）もここが書く。画像ファイルは読まない（このコピーに画像は無い）。
     ★2026-10-25 英語の EN-9：同じ1本が英語の1枚（en/career.html ── 同じ部品・字だけ英語・額はドルの span）も書く（2枚）。 */
  ['gen-career.mjs',      'career.html と en/career.html（概要と2社比較の1枚・日英の2枚）'],
  /* 2026-10-18（WP-close-a）。会社ページの暮らしのカードの街を直したのに流し忘れると、サーバの街の候補の種だけ古いまま残る。 */
  ['gen-towns.mjs',       'db/towns.generated.sql（暮らしのカードの街 → サーバの街の候補の種）'],
  /* 2026-10-29。就航地を出す会社を 19 → 96社に広げたとき、db/stays.sql の手で写した一覧（運営の「追加」が公開で入れてよい空港）を
     直し忘れた。SQL の検査（db/test-stays.mjs の ★N1）でしか分からず、DB を触らない回の push 前には流れない ＝ ここでも見る。 */
  ['gen-stay-network.mjs', 'db/stays.sql の pv_stay_network()（運営の「追加」が公開で入れてよい空港）'],
];

// どれも読まない重いもの。展開しないぶん速くなる。
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

/* ★本当の住所で持つ（2026-10-18・WP-close-a）。macOS の一時フォルダは /var → /private/var のリンクの先にある。
     gen-career.mjs と gen-towns.mjs は「自分が直接呼ばれたときだけ書く」を path.resolve(argv[1]) と
     import.meta.url（Node はリンクを解いた本当の住所を渡す）の一致で決めるので、リンクのままの住所で呼ぶと
     一致せず、**何も書かずに 0 で終わっていた** ＝ この2本は流したことになっていて、古くても赤くならなかった。 */
const work = realpathSync(mkdtempSync(join(tmpdir(), 'pv-generated-')));
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

  // gen-sitemap / gen-datemod が git の履歴を読めるように .git を貸す（読むだけのはず）
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
    console.log('      && node gen-en-manifest.mjs && node gen-vocab.mjs \\');
    console.log('      && node gen-airline-codes.mjs');
    console.log('\n  ⚠ db/vocab.generated.sql が入っていたら、Supabase に貼るまで');
    console.log('    本番の選択肢・為替は古いまま（貼るのはオーナー作業）。');
    console.log('  ⚠ db/airlines.generated.sql も同じ。貼るまで新しい会社の投稿は弾かれ、');
    console.log('    過去の「一覧にない会社」も正しい社名に出ない。');
    console.log('');
  }

  /* ── 3b. 社名の衝突検査そのものが効いているか（2026-09-13）──────────
     gen-airline-codes.mjs は「別法人どうしの社名が正規化後に一致したら落ちる」
     検査を持っている（pv_airline_resolve は複数当たると code の若い順に
     1つ選ぶので、止めないと片方の会社の投稿が黙ってもう片方に混ざる）。
     ここが効かなくなっていても、生成物は何も変わらない＝上の照合では気づけない。
     ★--check は1バイトも書かない。PV_OPS_INJECT も --check のときだけ効く。 */
  {
    const gen = join(work, 'gen-airline-codes.mjs');
    if (!existsSync(gen)) {
      console.log('  （gen-airline-codes.mjs が HEAD に無いので衝突検査は見ない）');
    } else {
      const run = (env) => spawnSync('node', [gen, '--check'],
        { cwd: work, encoding: 'utf8', env: { ...process.env, ...env } });
      const clean = run({});
      if (clean.status !== 0) {
        fail++;
        console.log('✗ いまの名簿が gen-airline-codes.mjs --check で落ちる\n');
        console.log((clean.stderr || '').trim().split('\n').slice(-4).map(l => '    ' + l).join('\n') + '\n');
      }
      const poison = JSON.stringify({ 'pv-collision-probe': {
        ja: '全日本空輸（ANA）', en: 'Probe', region: 'japan', kind: 'charter', src: 'probe' } });
      const bad = run({ PV_OPS_INJECT: poison });
      if (bad.status === 0) {
        fail++;
        console.log('✗ 社名の衝突検査が効いていない ── 別会社の社名がぶつかっても通ってしまう\n');
        console.log('    gen-airline-codes.mjs の「検査③：社名の衝突」を直す。');
        console.log('    ここが効かないと、別法人の投稿が黙って1社の中央値に混ざる。\n');
      } else if (!/社名が別の会社どうしで一致する/.test(bad.stderr || '')) {
        fail++;
        console.log('✗ 衝突検査は落ちたが、理由が社名の衝突ではない\n');
        console.log((bad.stderr || '').trim().split('\n').slice(-4).map(l => '    ' + l).join('\n') + '\n');
      } else {
        console.log('  ・社名の衝突検査が効いている（わざとぶつけたら落ちた）');
      }
    }
  }

  if (!fail) console.log(`✅ 生成物は全部いまの元データと一致している（${before.size} 本を照合）`);
  else console.log(`══ ${fail} 件 ══`);
} finally {
  // ── 4. 使い捨てフォルダを捨てる ────────────────────────────
  rmSync(work, { recursive: true, force: true });
}

process.exit(fail ? 1 : 0);
