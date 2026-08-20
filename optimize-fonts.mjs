/* ══════════════════════════════════════════════════════════════
   optimize-fonts.mjs — head の Google Fonts の読み込みを安くする

   （旧 trim-font-weights.mjs。ウェイト削減だけの名前だったが、
     「head のフォント読み込みを持つ唯一のスクリプト」に役割を広げたので
     改名した。新しいスクリプトを増やさず、ここに集約する。）

   やることは2つ。どちらも見た目は1ピクセルも変えない。
     A) 誰も使っていないウェイトを要求しない
     B) フォント配信元への接続を先に開いておく（preconnect）

   ═══ A) 使っていないウェイトを落とす ═══
   なぜ要るか（.probe-weights.mjs / assert-perf.mjs の実測）
     Slow 4G で測ると JP ページのフォント転送量は index.html で 818KB、
     41リクエスト。LCP 要素はヒーローの本文テキストで、その LCP 6236ms は
     「Noto Sans JP が届くのを待っている時間」だった（フォント最終到着
     9086ms）。つまりフォントを削るとそのまま LCP が縮む。

     Google Fonts の Noto Sans JP は CJK なので unicode-range で 124個の
     チャンクに分割され、しかも**ウェイトごとに別のチャンク群**になる。
     4ウェイト指定＝ @font-face が 496本、CSS だけで 487KB（実測）。
     ウェイトを1つ落とすと 124本ぶんまるごと消える。

   何を落とすか（推測ではなく実測で決めた）
     12ページをブラウザで開き、日本語(CJK)を含むテキストノードの
     computedStyle.fontWeight を全部数えた結果：

       400 → 1531要素 / 500 → 79 / 600 → 398 / 700 → 634 / 800 → 165 / 900 → 118
       300 → 0要素

     日本語を weight 300 で描いている箇所は1つも無い。それでも URL では
     Noto Sans JP に 300 を要求していたので、124チャンクぶんを毎回ダウン
     ロードして一度も使っていなかった。

   ★ Inter の 300 は残す
     欧文側は weight 300 を 18要素が実際に使っている（salary-leveling.js の
     機種コード .lvl-code など、細く字間を空けた Levels.fyi 風のラベル）。
     ここはオーナー確認済みの図なので触らない。落とすのは Noto Sans JP の
     300 だけ＝見た目は1ピクセルも変わらない。

   ★ 600/800/900 を「足す」ことはしない
     上の実測どおり日本語は 600/800/900 でも描かれているが、URL では
     要求していない。ブラウザは近いウェイト（700/900）で代用していて、
     合成ではなく実在のフォントが当たっている。足せば見た目は理想に
     近づくが 1ウェイトあたり 124チャンク増える＝ここまでの削減が消える。
     見た目の詰めと速度のどちらを取るかはオーナーの判断なので、勝手に
     足さない。報告に回す。

   ついでに直すこと
     airlines/ana-wings.html と airlines/starflyer.html だけ URL が
     `family=Noto Sans JP`（+ ではなく生の空白）になっている。ブラウザは
     %20 に直して送るので実害は無い（実測でも 200 / 同一バイト数）が、
     揃っていないと grep も差し替えも取りこぼす。`+` に正規化する。

   ═══ B) 配信元への接続を先に開く（preconnect）═══
   なぜ要るか
     フォントは2つのホストから来る。
       fonts.googleapis.com  @font-face を書いた CSS
       fonts.gstatic.com     実体の woff2（★ 重いのはこっち）
     ブラウザは CSS を読み終えるまで gstatic の存在を知らないので、
     そこから DNS → TCP → TLS を始める。Slow 4G（RTT 150ms）だと
     この往復だけで 400ms 前後、フォントの到着がまるごと後ろへずれる。
     JP ページの LCP はテキスト＝フォント到着待ちなので、そのまま LCP。

     preconnect を書いておくと HTML を読んだ時点で接続を開き始め、
     CSS が届いた瞬間に本体を取りに行ける。

   ★ gstatic 側には crossorigin が要る
     フォントは匿名（CORS）で取得される。crossorigin を付けずに
     preconnect すると別の接続プールが温まってしまい、実際に使う接続は
     冷たいまま＝完全に無駄になる。付け忘れは「効かない preconnect」で、
     見た目には何も分からないので特に注意する。

   実測での欠け方
     392枚のうち preconnect を持っていたのは 111枚だけで、そのうち
     gstatic まで書けていたのは 108枚。残り 268枚は Google Fonts を
     読んでいるのに接続を予告していなかった。しかも欠けていたのは
     airlines/ 232枚とルート直下 36枚＝検索の入口として一番効かせたい
     ページ群だった。

   実行: node optimize-fonts.mjs        書き込む
        node optimize-fonts.mjs --dry  差分だけ出して書かない
   ══════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry');

/* ファミリ名 → 落とすウェイト。実測で「日本語をそのウェイトで描いている
   要素が 0個」だったものだけを入れる。増やすときは必ず測り直すこと。 */
const DROP = { 'Noto Sans JP': ['300'] };

const dirs = ['.', 'airlines', 'countries', 'en', 'en/airlines', 'en/countries'];
const files = dirs.flatMap((d) => {
  const abs = path.join(__dirname, d);
  return fs.existsSync(abs)
    ? fs.readdirSync(abs).filter((f) => f.endsWith('.html')).map((f) => (d === '.' ? f : `${d}/${f}`))
    : [];
});

/* css2?family=A:wght@..&family=B:wght@..&display=swap を組み替える。
   URL 全体を正規表現で丸ごと置換すると、ウェイトの並びが違う版（2種ある）
   を取りこぼすので、family セグメント単位で処理する。 */
const rewrite = (url) => url.replace(/family=([^&:]+):wght@([\d;]+)/g, (whole, fam, wghts) => {
  const name = decodeURIComponent(fam).replace(/\+/g, ' ');
  const drop = DROP[name];
  const kept = drop ? wghts.split(';').filter((w) => !drop.includes(w)) : wghts.split(';');
  /* 全部落ちたらファミリごと消えてしまう。そこまでは自動でやらない。 */
  if (!kept.length) return whole;
  return `family=${name.replace(/ /g, '+')}:wght@${kept.join(';')}`;
});

const scan = /https:\/\/fonts\.googleapis\.com\/css2\?[^"'>]+/g;

/* フォントの <link rel=stylesheet> そのものを掴む。preconnect はこの
   直前に置く必要がある（後ろに置くと、CSS の取得が始まった後に接続を
   開くことになって意味が半分になる）。 */
const FONT_LINK = /[ \t]*<link\b[^>]*href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*"[^>]*>/i;

let changed = 0, hits = 0;
let preAdded = 0;
const seen = new Map();
const preNotes = [];

for (const rel of files) {
  const fp = path.join(__dirname, rel);
  const html = fs.readFileSync(fp, 'utf8');
  let n = 0;
  let out = html.replace(scan, (u) => {
    const v = rewrite(u);
    if (v !== u) { n++; seen.set(u, v); }
    return v;
  });

  /* ── B) preconnect ────────────────────────────────────────── */
  const usesFont = FONT_LINK.test(out);
  if (usesFont) {
    /* すでに書いてあるものは足さない＝何度実行しても増えない。
       gstatic だけ欠けている（3枚あった）ケースも拾えるよう、
       2つを別々に判定する。 */
    const hasCss = /rel="preconnect"[^>]*fonts\.googleapis\.com|fonts\.googleapis\.com[^>]*rel="preconnect"/i.test(out);
    const hasFile = /rel="preconnect"[^>]*fonts\.gstatic\.com|fonts\.gstatic\.com[^>]*rel="preconnect"/i.test(out);
    if (!hasCss || !hasFile) {
      const m = out.match(FONT_LINK);
      /* そのページが <link … /> と閉じているか <link …> かに合わせる。
         HTML5 ではどちらでも同じだが、1行だけ書式が違うと後で
         grep したときに引っかかりが増える。 */
      const selfClose = /\/>\s*$/.test(m[0]);
      const close = selfClose ? ' />' : '>';
      const tags = [];
      if (!hasCss) tags.push(`<link rel="preconnect" href="https://fonts.googleapis.com"${close}`);
      if (!hasFile) tags.push(`<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin${close}`);
      const indent = (m[0].match(/^[ \t]*/) || [''])[0];
      out = out.replace(FONT_LINK, `${indent}${tags.join('')}\n${m[0]}`);
      preAdded++;
      preNotes.push(`${rel}${hasCss ? '（gstatic のみ追加）' : ''}`);
    }
  }

  if (out === html) continue;
  if (n) { hits += n; changed++; }
  if (!DRY) fs.writeFileSync(fp, out);
}

console.log(`${DRY ? '[dry] ' : ''}══ フォント読み込みの最適化 ══\n`);
console.log(`A) 使っていないウェイトを落とす: ${changed} 枚 / ${hits} 箇所`);
for (const [before, after] of seen) {
  console.log(`  - ${before.replace('https://fonts.googleapis.com/css2?', '')}`);
  console.log(`  + ${after.replace('https://fonts.googleapis.com/css2?', '')}`);
}
if (!seen.size) console.log('  （対象なし＝すでに適用済み）');

console.log(`\nB) preconnect を追加: ${preAdded} 枚`);
if (!preAdded) console.log('  （対象なし＝すでに全ページに入っている）');
else {
  const byDir = {};
  preNotes.forEach((p) => { const d = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '.'; byDir[d] = (byDir[d] || 0) + 1; });
  Object.entries(byDir).forEach(([d, c]) => console.log(`  ${String(d).padEnd(16)}${c}枚`));
}
if ((changed || preAdded) && !DRY) console.log('\n次: node assert-perf.mjs で転送量と LCP を測り直す');
