/* ══════════════════════════════════════════════════════════════
   defer-third-party.mjs — head の第三者タグを整理する

   やることは2つ。
     A) 出さないと決めたタグは消す      ← 現在: AdSense
     B) 出すが急がないタグは後ろへ回す  ← 現在: gtag（GA4）

   ═══ A) AdSense を消す（2026-08-07 オーナー確認）═══
   「このサイトは広告は今の所一切出さない。出す設定になってるなら
     完全に間違い」

   実際に出る設定だった。268枚の HTML に adsbygoogle.js
   （ca-pub-6347707485416495）が入っていた。しかも広告枠 <ins> は
   サイト全体で0個。これは「枠が無いから広告も出ない」ではなく
   **自動広告**＝Google が本文を解析して勝手に位置を決め、枠なしで
   挿し込む方式で、いちばん広く出る設定にあたる。

   ★ localhost で見えなかったのは、出ていない証拠ではない
     AdSense は未承認ドメインに配信しないので、localhost では
     どう設定してあっても何も出ない。「ローカルで見えないから
     大丈夫」は成立しない。本番だけで出る。

   消すのはタグだけで、AdSense アカウントには触っていない。
   出す判断に変われば、この pub ID のタグを1行戻せば復活する。
   （gen-countries.mjs のテンプレートからも同時に消した。残すと
     国別ページを生成し直した瞬間に戻ってくる。）

   ═══ B) gtag を後ろへ回す ═══
   ⚠ 計測に触る変更なので、オーナーの確認が要る。

   ★ 下の実測は「広告と解析の両方が載っていた頃」のもの。
     広告 272KB が消えた今、gtag 単独を後回しにする効き目は
     ここに書いた -1112ms より小さいはず。数字は残すが、
     広告除去後に assert-perf.mjs で測り直すこと。

   ═══ 何が起きていたか（実測・広告があった頃）═══
   トップページの LCP は 6968ms（Slow 4G / CPU 4倍 / 冷キャッシュ）。
   LCP 要素はヒーローの <p>「PILOT DEFINES」＝テキストで、フォントの
   到着待ちだった。そのときの転送量の内訳が問題で：

     fonts.gstatic.com              818KB  ← LCP が待っている本体
     pagead2.googlesyndication.com  272KB  ← 広告
     www.googletagmanager.com       166KB  ← 解析
     cdn.tailwindcss.com            124KB
     ep1.adtrafficquality.google     14KB  ← 広告の付随

   広告と解析で 452KB。どちらも async なのでパースは止めない。だが
   **async は帯域を譲らない**。1.6Mbps しかない回線では、LCP が待って
   いるフォントと同じパイプを 452KB が奪い合う。async だから大丈夫、
   という直感がここでは効かない。

   ═══ どれだけ押し下げているか ═══
   まず「完全にブロックしたら」の上限を測った（＝伸びしろの見積り）。
                          現状      解析のみ     広告のみ     両方
     index.html          6968ms   6688(-280)  6404(-564)  5244(-1724)
     en/index.html       4344ms   4076(-268)  4120(-224)  3880(-464)
     airlines/emirates   3296ms   3032(-264)  3296(+0)    3320(+24)
   片方だけ止めても -280 / -564 にしかならず、両方止めて初めて大きく
   動く（帯域が空いて初めてフォントが一気に届く）。だから両方を回す。

   ★ ただしこの -1724 は「1回ずつ測った差」で、そのまま信じてはいけない。
     このページは1回ごとに 1秒くらい平気でぶれる。実際に後回し版を
     入れて、同じ条件で5回ずつ測り直した中央値が下：

                     直読み(元)              後回し(この変更)        差
       index.html    6676ms [5824-6772]    5564ms [4644-6536]    -1112ms
       en/index.html 4088ms [4056-4100]    3880ms [3868-3980]     -208ms

     index は中央値で -1112ms 縮むが、範囲が重なっているので「必ず
     1.1秒速くなる」とは言えない。en/index は -208ms と小さいかわりに
     範囲がまったく重ならず、こちらは確実な差。**どちらも悪化方向には
     振れなかった**、というのが正確な言い方。

   ═══ 止めるのではなく「後ろへ回す」═══
   gtag は消さない。動きも変えない。読む時刻だけを遅らせる。
   gtag はキュー方式なので、これで計測は落ちない：dataLayer に積んで
   おけば、gtag.js が後から来てまとめて処理する。インライン設定
   （dataLayer / gtag('config')）は今までどおり先に実行するので、
   ページビューは記録される。

   起動の条件は「先に来たほう」：
     ・利用者が最初に触った瞬間（pointerdown / keydown / touchstart /
       scroll / wheel）
     ・load イベント（＝表示に必要なものが全部届き終わったあと）
   触る人は触った時点で、触らない人も load 後に読み込まれる。どちらの
   経路でも必ず読まれるので、広告の表示機会は減らない。

   ★ 承知のうえのトレードオフ
     load より前に離脱した人は解析に乗らない。VISION.md の North Star は
     PV ではなく一次データ投稿数・月次継続率・検証済み比率なので、ここは
     速度と引き換えにして良いと判断した。**不同意ならこのスクリプトを
     revert すれば元に戻る**（管理ブロックを剥がすだけ）。

   実行: node defer-third-party.mjs        書き込む
        node defer-third-party.mjs --dry  差分だけ出して書かない
        node defer-third-party.mjs --undo gtag を直読みに戻す

   ★ --undo は B) だけを戻す。A) は戻さない
     消した広告タグは管理ブロックに残っていないので、--undo しても
     復活しない（＝事故で広告が戻ることはない）。広告を出す判断に
     変わったときは、このコミットを git revert する。

   ★ --undo はバイト単位で元通りにはならない
     剥がしたタグは </head> の直前に戻す。元は gtag がインライン設定の
     前に置かれていたので、位置が変わる。async で dataLayer はキュー
     だから動作は同じだが、差分を完全に消したいなら git revert が確実。
   ══════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry');
const UNDO = process.argv.includes('--undo');

const OPEN = '<!--PV-3P-->';
const CLOSE = '<!--/PV-3P-->';

const dirs = ['.', 'airlines', 'countries', 'en', 'en/airlines', 'en/countries'];
const files = dirs.flatMap((d) => {
  const abs = path.join(__dirname, d);
  return fs.existsSync(abs)
    ? fs.readdirSync(abs).filter((f) => f.endsWith('.html')).map((f) => (d === '.' ? f : `${d}/${f}`))
    : [];
});

/* 直読みしている <script async src="…"> を拾う。属性の並びが版によって
   違う（crossorigin が有る／無い）ので、src だけで判定する。 */
const TAGS = [
  { key: 'gtag', re: /[ \t]*<script\b[^>]*\bsrc="(https:\/\/www\.googletagmanager\.com\/gtag\/js[^"]*)"[^>]*><\/script>\n?/i },
  { key: 'ads', re: /[ \t]*<script\b[^>]*\bsrc="(https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^"]*)"[^>]*><\/script>\n?/i },
];

/* ★ 出さないと決めたもの。直読みタグからも管理ブロックの中からも消す。
   TAGS から ads の行ごと削除しないのは、生成スクリプトや古いページに
   残っていた広告タグを「見つけて消す」ために掴む必要があるため。 */
const DROP = [/pagead2\.googlesyndication\.com/i, /adsbygoogle/i];
const dropped = (src) => DROP.some((re) => re.test(src));

/* 後から読むためのローダー。crossorigin は広告側にだけ付ける（元の
   タグに付いていたものを引き継ぐ）。 */
const loader = (srcs) => `${OPEN}
<script>
/* 広告と解析は、表示が終わるまで読まない。async でも帯域は奪うため。
   利用者が最初に触った時か load の、どちらか早いほうで読み込む。
   戻すときは node defer-third-party.mjs --undo */
(function(){
  var done=false;
  function boot(){
    if(done)return; done=true;
    ${JSON.stringify(srcs)}.forEach(function(it){
      var s=document.createElement('script');
      s.src=it.src; s.async=true;
      if(it.cross)s.crossOrigin='anonymous';
      document.head.appendChild(s);
    });
  }
  ['pointerdown','keydown','touchstart','scroll','wheel'].forEach(function(ev){
    addEventListener(ev,boot,{once:true,passive:true});
  });
  if(document.readyState==='complete')boot();
  else addEventListener('load',boot,{once:true});
})();
</script>
${CLOSE}`;

let changed = 0, undone = 0, adPages = 0;
const notes = { gtag: 0, ads: 0 };

for (const rel of files) {
  const fp = path.join(__dirname, rel);
  const html = fs.readFileSync(fp, 'utf8');
  let out = html;

  /* 載せる src を集める。出どころは2つ：
       ① すでに入っている管理ブロックの中（前回このスクリプトが回した分）
       ② 直読みの <script async>（生成し直したページ・未処理のページ）
     ①を必ず先に剥がしてから②を見る。剥がさないと同じ src が二重に載る。 */
  const srcs = [];

  const had = out.match(new RegExp(`${OPEN}[\\s\\S]*?${CLOSE}\\n?`));
  if (had) {
    const inBlock = [...had[0].matchAll(/"src":"(https:[^"]+)"/g)].map((m) => m[1].replace(/\\u002F/g, '/'));
    if (UNDO) {
      /* ★ 消したものは戻さない。--undo は「後ろへ回した」だけを取り消す。 */
      const restored = inBlock.filter((s) => !dropped(s)).map((s) => `<script async src="${s}"></script>`).join('\n');
      out = out.replace(had[0], restored ? restored + '\n' : '');
      undone++;
      if (!DRY) fs.writeFileSync(fp, out);
      continue;
    }
    out = out.replace(had[0], '');
    /* cross は src から決め直す。ブロックには残っていないため。 */
    inBlock.forEach((s) => srcs.push({ src: s, cross: /adsbygoogle/i.test(s) }));
  }
  if (UNDO) continue;

  /* ② 直読みタグを外す */
  for (const t of TAGS) {
    const m = out.match(t.re);
    if (!m) continue;
    out = out.replace(t.re, '');
    if (srcs.some((s) => s.src === m[1])) continue;   /* ①と重複したら足さない */
    srcs.push({ src: m[1], cross: t.key === 'ads' });
  }

  /* ★ 出さないと決めたものをここで落とす。①経由でも②経由でも同じ扱い。 */
  const before = srcs.length;
  const keep = srcs.filter((s) => !dropped(s.src));
  if (keep.length !== before) { adPages++; notes.ads += before - keep.length; }
  notes.gtag += keep.length;

  /* 全部落ちたらブロックごと置かない（空のローダーを残さない）。 */
  if (keep.length) {
    /* </head> の直前に置く。インラインの gtag('config') はそのまま残る
       ので、dataLayer は今までどおり先に積まれる。 */
    const at = out.search(/<\/head>/i);
    if (at === -1) continue;
    out = out.slice(0, at) + loader(keep) + '\n' + out.slice(at);
  }

  if (out === html) continue;
  changed++;
  if (!DRY) fs.writeFileSync(fp, out);
}

console.log(`${DRY ? '[dry] ' : ''}══ head の第三者タグを整理する ══\n`);
if (UNDO) {
  console.log(`gtag を直読みに戻した: ${undone} 枚（広告は戻さない）`);
} else {
  console.log(`A) 広告（AdSense）を削除   ${adPages} 枚 / ${notes.ads} タグ`);
  if (!adPages) console.log('   （対象なし＝すでに1枚も残っていない）');
  console.log(`B) gtag を表示のあとへ回す  ${notes.gtag} 枚`);
  console.log(`\n書き換えたファイル: ${changed} 枚`);
  console.log('戻すとき（B のみ）: node defer-third-party.mjs --undo');
}
if (!DRY) console.log('\n次: node assert-perf.mjs で転送量と LCP を測り直す');
