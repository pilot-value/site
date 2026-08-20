/* ══════════════════════════════════════════════════════════════
   optimize-logo.mjs — ナビ／フッターのロゴを表示サイズに見合った画像に差し替える

   なぜ要るか（assert-perf.mjs / .probe-res.mjs の実測）
     baland_ass/ロゴイメージ.png は 1048x808 の 129KB。これを 384枚すべての
     ページが読んでいて、CSS 上の表示は .logo-img{height:44px}（最大でも
     h-12=48px）。44px で見せるために 808px の画像を落としている。
     Slow 4G（1.6Mbps）では 129KB ＝ 約0.65秒。しかもロゴは head の直後の
     ナビにあるので、フォント（JPページで 818KB）と帯域を取り合う位置にいる。

     実測では index.html のフォント最終到着が 9086ms、LCP は 6236ms で、
     LCP 要素はテキスト（P.hero-en）＝ Noto Sans JP の到着待ちだった。
     ロゴを削るぶんがそのままフォントに回る。

   何をするか
     ・master（baland_ass/ロゴイメージ.png）は触らない。ブランド資産なので
       原寸を残す。
     ・assets/logo.png（228x176・18KB）を作る。表示 44px に対して 4倍なので
       Retina でも眠くならない。
     ・HTML の <img> の参照だけを差し替える。

   ★ トリミングはしない
     master は「濃い背景色のカードの中央に小さくワードマークが載っている」
     画像で、余白がかなり広い。内容に合わせて切り詰めると同じ CSS 高さでも
     ワードマークが大きく見える＝見た目が変わる。速くするために見た目を
     変えるのは別の話なので、縦横比そのままの単純な縮小だけにする。

   ★ 差し替えないもの（意図的）
     ・seo-normalize.mjs の Organization.logo（構造化データ）
     ・gen-og-images.mjs が OGP 画像を合成するときの元画像
       どちらも「大きいほど良い」側の用途なので master のままにする。
     ・favicon / og:image
       そもそも別ファイル。

   生成コマンド（このスクリプトが無くても再現できるように残す）
     sips -z 176 228 "baland_ass/ロゴイメージ.png" --out assets/logo.png

   実行: node optimize-logo.mjs        書き込む
        node optimize-logo.mjs --dry  差分だけ出して書かない
   ══════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry');

const MASTER = 'baland_ass/ロゴイメージ.png';
const OPT = 'assets/logo.png';

if (!fs.existsSync(path.join(__dirname, OPT))) {
  console.error(`${OPT} が無い。先に生成する:\n  sips -z 176 228 "${MASTER}" --out ${OPT}`);
  process.exit(1);
}

const dirs = ['.', 'airlines', 'countries', 'en', 'en/airlines', 'en/countries'];
const files = dirs.flatMap((d) => {
  const abs = path.join(__dirname, d);
  return fs.existsSync(abs)
    ? fs.readdirSync(abs).filter((f) => f.endsWith('.html')).map((f) => (d === '.' ? f : `${d}/${f}`))
    : [];
});

/* 既存の ../ の数を数え直すのではなく、ファイル自身の深さから正しい相対
   パスを組み立てる。深さの違う 3種（root / 1階層 / 2階層）が混在していて、
   数え直すほうが間違えやすい。 */
const relTo = (rel) => {
  const up = '../'.repeat(rel.split('/').length - 1);
  return up + OPT;
};

/* ファイル名の3つの書かれ方をまとめて拾う。
     ロゴイメージ.png                        HTML の素の src
     %E3%83%AD%E3%82%B4...                   URLエンコード済み
     ロゴイメージ    JS の文字列リテラル（★）
   ★ search.js と airlines/airline-base.js が JS でナビを組み立てていて、
     そこだけ \u エスケープで書かれている。`ロゴイメージ` で grep しても
     引っかからないので、実測（ブラウザのリクエスト一覧）で見つけるまで
     取りこぼしていた。文字で探さず、出るリクエストで確かめること。 */
const NAME = String.raw`(?:ロゴイメージ|%E3%83%AD%E3%82%B4%E3%82%A4%E3%83%A1%E3%83%BC%E3%82%B8|\\u30ed\\u30b4\\u30a4\\u30e1\\u30fc\\u30b8)\.png`;

/* <img> の src だけを対象にする。JSON-LD の "logo": や og:image に同じ
   ファイル名が出てきても巻き込まないため、img タグごと捕まえて中で置換する。 */
const IMG = /<img\b[^>]*>/g;
const SRC = new RegExp(String.raw`(\ssrc=")((?:\.\./)*)baland_ass/${NAME}(")`);

/* JS 側は `変数 + 'baland_ass/….png'` の形。前の連結部分（相対パスを
   組み立てている変数）はそのまま残し、ファイルの場所だけ差し替える。 */
const JS_FILES = ['search.js', 'airlines/airline-base.js'];
const JS_SRC = new RegExp(String.raw`baland_ass/${NAME}`, 'g');

let changed = 0, imgs = 0;
for (const rel of files) {
  const fp = path.join(__dirname, rel);
  const html = fs.readFileSync(fp, 'utf8');
  let n = 0;
  const out = html.replace(IMG, (tag) => {
    if (!SRC.test(tag)) return tag;
    n++;
    return tag.replace(SRC, `$1${relTo(rel)}$3`);
  });
  if (!n) continue;
  imgs += n;
  changed++;
  if (!DRY) fs.writeFileSync(fp, out);
}

/* JS が組み立てるナビ（ドロワー）。ここを直さないとページ側を全部
   差し替えても master がもう1回落ちてくる（実測で 148KB＝両方来ていた）。 */
let jsHits = 0;
for (const rel of JS_FILES) {
  const fp = path.join(__dirname, rel);
  if (!fs.existsSync(fp)) continue;
  const js = fs.readFileSync(fp, 'utf8');
  const n = (js.match(JS_SRC) || []).length;
  if (!n) continue;
  jsHits += n;
  if (!DRY) fs.writeFileSync(fp, js.replace(JS_SRC, 'assets/logo.png'));
}

const kb = (p) => (fs.statSync(path.join(__dirname, p)).size / 1024).toFixed(0);
console.log(`${DRY ? '[dry] ' : ''}${changed} 枚のページ / ${imgs} 個の <img> を ${OPT} に差し替え`);
if (jsHits) console.log(`  JS が組み立てるナビ ${jsHits} 箇所も差し替え（${JS_FILES.join(', ')}）`);
console.log(`  master ${kb(MASTER)}KB → ${kb(OPT)}KB（1ページあたり ${kb(MASTER) - kb(OPT)}KB 減）`);

/* 取りこぼしの確認。<img> 以外（構造化データなど）は残っていて正しいので、
   残っているのが <img> でないことだけ見る。--dry では何も書いていないので
   ディスクを読み直しても意味がない（必ず全部残っていると出る）。 */
if (!DRY) {
  const leftovers = files.filter((rel) => {
    const html = fs.readFileSync(path.join(__dirname, rel), 'utf8');
    return (html.match(IMG) || []).some((t) => SRC.test(t));
  });
  console.log(leftovers.length
    ? `  ⚠ まだ master を指す <img> が ${leftovers.length} 枚に残っている: ${leftovers.slice(0, 5).join(', ')}`
    : '  ✓ master を指す <img> は残っていない');
}
if (changed && !DRY) console.log('\n次: node assert-perf.mjs で転送量を測り直す');
