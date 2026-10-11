/* assert-deep-pay.mjs — 「DEEP PAY」（deep-pay）の約束を機械で確かめる。

   この画面は REAL PAY の詳細版ではない。**その仕事の経済的な実態**を
   ・年収がいくらか
   ・そのうち固定がどれだけか
   ・どれだけ働いてその額なのか
   ・変動給は何でできているか
   ・その数字がどれだけあてになるか
   の5つで見せる集計画面で、個人の明細は1件も出さない。

   ★2026-10-11、DEEP PAY を公開した（オーナー判断）。
     それまでこの検査がいちばん守っていたのは「まだ開けていない」ことだった
     （2026-08-29 のオーナー判断で、ページ・SQL・JS は全部作るが入口は1本も置かない。
      オーナーだけが直接 URL で見ていた）。
     いま ① が守っているのは **入口がどこに在るか** ── 決めた所にだけ在り、黙って増えない。

     入口はちょうどこれだけ（オーナー指示「上の REAL PAY の横に DEEP PAY の入り口作って。
     タブみたいな形に」）──
       ・REAL PAY の見出しのタブ … actual-pay.html / en/actual-pay.html（静的な <a>）
       ・REAL PAY の行を押すと出る面のボタン … actual-pay.js
     DEEP PAY の側にも同じタブが在り、REAL PAY へ戻れる（deep-pay.html の日英）。

     公開しても**変えていないもの**（① が今も見ている）──
       ・左メニューに DEEP PAY の段は無い（7項目のまま。段を足すのは別の回）
       ・検索に出さない（noindex）・sitemap に載せない
       ・3段の表（pv-gates.js の giveGetHTML）は DEEP PAY の**名前だけ**を出す。
         札も、押せる所も、DEEP PAY への住所も持たない（同じ日のオーナー指示
         「3段の表の DEEP PAY の札自体もういらない」）。あの表は全ページの板
         （pv-give-first.js）にも出るので、住所を1つ書くと入口が約400枚に生える。
       ・VERIFIED PAY は準備中のまま

   ★★2026-10-12（オーナー判断「会社比較はまだ出さないでよ」）── 会社比較は**閉じている**。
     DEEP PAY そのものは公開のまま・1つも変えていない。変わったのは2つ ──
       ・この画面から会社比較へ行く入口（開いた画面のいちばん下の「もっと深く見る／
         会社比較を見る」のカード）を、**枠ごと出さない**。決めているのは deep-pay.js の
         定数 COMPARE_OPEN（false）。下の段は「何をすると給与が増えるか」が幅いっぱいになる。
       ・会社比較の画面そのものは、deep-pay-compare.js の同じ名前の定数で閉じてある
         （直に開いても「準備中」の板だけ）。あちらは assert-deep-pay-compare.mjs が見る。
     ここで見るのは ── ① 会社比較へ繋がる**生きた線が1本も無い**（字面）／§3・§7 開いた画面の
     どこにも会社比較へのリンクが無い・カードの器が畳まれている／§3h 幅 320 / 390 / 1440 で
     下の段が崩れていない（空の列が残らない）。
     ★カードの描き手は消していない（出す日に1行で戻る）。腐らせないために、手元の住所で
       だけ効く試験用の口（compareOpen。注は assert-deep-pay-compare.mjs の冒頭）で動かして、
       前からの約束（リンクは1本・相対のまま・「準備中」のボタンを置かない）を §3h で見続ける。
       クラッカーの「2つの画面で印は1つ」（§2f の f）も、同じ口で会社比較の本体を動かして見る。
     ⚠️ 出す日は、2つの JS の定数を**一緒に** true にして、① の辺の集合・§3・§7・§3h を
        「開いている」に書き換える（手順は assert-deep-pay-compare.mjs の冒頭）。

   ★左メニューに段を足す日にやること（この検査を書き換える前に、この順で）──
     1. patch-side-nav.mjs の一覧に deep を **href:'deep-pay.html' で**足す
        （前の形 ── href が空・soon:true ── で足さない。押しても何も起きない段になる）。
     2. patch-side-nav.mjs の CURRENT に deep-pay.html（と会社比較）を足す。
        足さないと現在地のハイライトだけが付かない。
     3. node patch-side-nav.mjs を流して、ナビの差分を同じコミットに入れる。
        assert-pay-rows.mjs の左メニューの並び（NAV_ORDER / NAV_HREF・「CTA ＋ 7項目」）も
        合わせる（左メニューを持つ**枚数**は変わらない）。
     4. ① の「左メニュー」と「辺の集合」を、足した後の姿に書き換える。
     ★検索に出す日は別の話 ── gen-sitemap.mjs / seo-normalize.mjs / assert-seo.mjs の
       NOINDEX は3つで対。1つだけ外すと、sitemap と robots が食い違うのに何も赤くならない
       （CLAUDE.md の「同じ集合が4つある」）。数字が出るのはログインして条件を満たした人
       だけの画面なので、今は出さない（ログインしていない人に開くのは板だけ ── 下の ⑭）。

   見るのは9つ：

     ① 入口は決めた所にだけ在る（REAL PAY のタブと、行の面のボタン。左メニューにも
        3段の表にも無い・sitemap にも出ない）。タブそのものの形は ①-b と §0。
     ② ぼかしで隠していない
        pv-gates.js の冒頭のとおり「隠すのではなく、最初から渡さない」。
        ★2026-10-11（オーナー判断「DEEP PAY でまだ開かない人には給与詳細を提出させる。
          背景にはぼかした DEEP PAY を表示させる。」）から、例外が**1つだけ**在る ──
          閉じている画面で、板の後ろに置く影絵（.dp-ghost）。前の約束は「blur / filter /
          mask / user-select:none をこの画面は1つも持たない」だった。
        ぼかしてよいのは、その影絵の要素**だけ**。それで困らないのは、影絵が
        **字も数字も持たない固定の絵**だから ── CSS のぼかしは開発者ツールで誰でも
        外せるので、外されて困るものを最初から入れない（サーバの答え・保存領域・
        計算した値のどれも入らない。鍵の無い人へは、サーバが数字を返していないまま）。
        見るのは5つ：
          a) blur / filter / clip-path / user-select:none は、deep-pay.css の `.dp-ghost`
             の規則1つの中にだけ在る。backdrop-filter と mask はどこにも無い。
             JS は style.filter を触らない。HTML にも無い。（下の ②）
          b) 影絵を組む関数（ghostShapes ほか）の字面に、数字・通貨記号・サーバの答えや
             保存領域や金額の道具への参照が無い。組み上がった HTML に字が1文字も無い。（下の ②）
          c) 閉じた画面では影絵が在り、aria-hidden ＋ inert で、ぼかしが実際に効き、
             キーボードでも入れず、押せない。板は手前に在って、面が透けていない。（§2e）
          d) 開いた・選ぶ前・薄い・一覧が無い・読み込めなかった・読み込み中 の各画面には、
             影絵も、ぼかしの効いた要素も1つも無い。（§2e・§3・§5・§8・§9・§11）
          e) 閉じた答えに head / comp / work / var が紛れて来ても、画面は1文字も
             変わらない。（§2e の毒入り）
        ⚠️ 例外をこれ以上増やさない。値の入る要素へぼかしを付けると「隠しているように
           見えるだけ」になる。区切りの「/」のような無害な用途でも許さない ── 許すと、
           次に**値そのもの**へ付いたときに赤くならない。
     ③ 作り物のデータを本番に置いていない（SAMPLE / DEMO / dummy / Math.random）
        ★影絵は絵であってデータではない（字も数字も無い）。影絵に「それらしい数字」を
          描いたら、それがこの③の作り物になる ── ② の b) が字面と HTML の両方で止める。
     ④ 「時給」と呼んでいない
        Block Hours から出した指標なので、名前は Pay / Block Hour のまま。
        「時給」と書いた瞬間に、待機や地上業務を含まない数字が
        労働時間あたりの賃金として読まれる。
     ⑤ 順位を書いていない（「上位○%」「percentile」）
        仕様の明示的な禁止。ランキングは Give & Get ではなく競争になる。
     ⑥ my-value.js から**写した**関数がずれていない
        my-value.js は IIFE に閉じていて export が無いので、写すしかなかった。
        写しは黙って腐る。ここが唯一の見張り。
     ⑦ 絵は pay-viz.js を借りている（ドーナツを自前で描いていない）
     ⑧ 通貨を切り替えても pv_deep_pay() を引き直さない
     ⑨ SQL の権限（revoke → grant の順・補助関数は誰にも開かない・anon に渡さない）

   ★2026-10-11（オーナー判断）に足した見張り。どれもブラウザの節に在る：
     ・**人数を画面のどこにも出さない**（その区分に何人いるかも、壁が何人かも）。
       「◯人」「◯ pilots」の形の字が本文に1つも無いことを、開いた／薄い／
       選ぶ前／一覧が無いの各状態 × 日英で見る（NOCOUNT）。古いサーバを装って
       n を混ぜた**毒入りの答え**でも、画面が1文字も変わらないことを見る（§3f）。
       たった1つの例外は錠前の板の「…100人に達すること（いま N人）」で、
       それも gate.crowd が false のときだけ（§2b）。
     ・**見出しの2つは刻みで出す**（年収 1万円／1,000・Pay / Block Hour 100円／1）。
       日本語＋円・英語＋円・ドル・ユーロで、刷られる字そのものを固定する（§3g）。
     ・**錠前の板の行**は理由どおりに出る（鍵／本人が答えきったか／100人 の組み合わせ。§2b）。
     ・**信頼度の段**はサーバの答え（cohort.trust）をそのまま出し、来なければ
       札ごと出さない（§3・§3f）。
     ・**錠前の板のボタンの行き先**は、足りない物に合わせる（フォームの頭／#ps／
       #pay-detail。字は ⑪・画面は §2b）。板の中に入力は置かない ── 入口はこの
       ボタン1本で、足りない項目は給与フォームで足してもらう。
     ・**見る資格は「自分に当てはまる項目をぜんぶ答えた人」**（同じ日のオーナー判断。
       前は「内訳が1つでもある」）。サーバは gate.ready と gate.todo（残っている項目の
       コード）を返し、板がそれを**給与フォームの言葉で**並べる。見るのは ──
       SQL が返す形（⑨）／名前がフォームの見出しと同じ字（⑫）／行・行き先・断りの
       出し分け（§2b）／一覧そのもの（§2c ── 届いた順・知らないコードは出さない・
       サーバの字が HTML に入らない・月の見出し）／幅と明暗（§2d）。
       ★断り（虚偽・不正確な情報について）は「答えきっていない」の行と必ず一緒で、
         その行が無い板には出ない。
     ・**月額と月換算の2桁は、表示通貨の中で寄せる**（ドルで $4,781 のような端数を
       出さない。円の表示は変わらない。§3g）。
     ・**閉じた画面は、ぼかした影絵の手前に板を出す**（同じ日のオーナー判断）。影絵は
       字も数字も持たない固定の絵で、ぼかしてよいのはその要素だけ（上の ②・§2e）。
       板の字・行・一覧・断り・ボタンの行き先は1つも変えていない（§2b〜§2d がそのまま見る）。
       ★最初の答えが来るまでは骨組みのまま待つ ── 前は、開いている人にも錠前の板が
         一瞬出ていた（§2e の「読み込み中」）。
     ・**開いた瞬間のクラッカー**（同じ日のオーナー指示「クラッカーならしてね」）。閉じた板を
       見ていた会員が給与の詳細を出して、この画面が開いたら、紙吹雪を**1回だけ**飛ばす。
       ★②③ の約束はそのまま ── ぼかし・filter を足していない（紙吹雪の器にも無い）・
         乱数を使わない（何枚目かだけで決まる動き）・字も数字も描かない・音も出さない。
       ★端末に置く印（保存領域の鍵1つ）は**飾り**で、門ではない。板・門・左メニューの側は
         印を読まず、クラッカーの側は門の鍵へ1つも書かない。印の中身は uid ではなく指紋。
       見るのは ── 字面（⑬）／実物（§2f ── 出る相手と出ない相手・押せない器・下のボタンが
       押せる・横スクロールが生えない・片づく・「動きを減らす」設定・2つの画面で1回・
       裏のタブ・保存領域が投げる端末）。
       ★§2e の「閉じた → 開いた で影絵が消える」は、紙吹雪の器が出ている最中に見ている
         （あの筋書きは同じ窓で閉じた板を描いてから開くので、そこで1回鳴る）。
     ・**ログインしていない人を、ログイン画面へ送らない**（同じ日のオーナー判断）。公開の
       入口（REAL PAY のタブ）ができたので、来た人には「会員で、まだ開いていない人」と
       **同じ画面**（ぼかした影絵＋板）を出す。前の §1 は「ログインへ送られる」を見ていた。
       ★板は新しく書いていない ── 「鍵が無く、答えきってもいない」会員の門と同じ形の
         入れ物（anonGate）を、同じ lockStage へ通すだけ。だから字も行き先も、会員の
         その板と**1文字も違わない**ことを、実物どうしの突き合わせで見る。
       ★ログインしていない人のために、サーバへ**1本も聞かない**（pv_deep_pay() は未ログイン
         だと必ず落ちる）。端末にも何も書かない（クラッカーの印・門の鍵のどちらも）。
       ★端末にセッションが残っているのにサーバが「ログインしていない」と答えた回
         （42501 か HTTP 401）も同じ板。ほかの失敗は今までどおり「読み込めませんでした」。
       見るのは ── 字面（⑭ ── 送り先が消えた・聞く前に戻る・作り物の門を本物の道具に
       通した答え・見分けの表）／実物（§2g ── 住所が変わらない・器と板・会員の板と同じ字・
       通信に /rpc/ が1本も無い・保存領域が1文字も変わらない・紙吹雪が出ない・
       タブが押せる・幅と明暗）。
     ・**閉じた画面の板は、窓の縦の真ん中あたりに置く**（同じ日のオーナー指示「ポップアップは
       わかりやすいように画面のもう少し真ん中にして」）。それまでは見出しのすぐ下に
       寄せてあり、この検査も「器の上から 40px 以内」を見ていた。いまは、板の真ん中が
       窓の高さの 43〜49% に在ること（狙いは 46%）を、**窓に対して**実測する。
       収まらない板は上の余白のすぐ下から（見出しに潜らない・切れない）。スマホは
       真ん中に置かず、見出しの下から。決まりは §2e の「板の縦の置き場所」、
       窓の高さを変えた実測は placeAt（§2e の会員の板と、§2g のログインしていない人の板）。

   ⚠️ 偽物 Supabase の rpc は本物と同じ「then だけを持つ箱」にしてある。
      async にすると本番に無い .catch が生えて、本番だけ真っ白になる穴が開く
      （assert-referral.mjs / assert-conditions.mjs に経緯あり）。

   ⚠️ 時間で待たない。「描き終わった」条件で待つ（混んだ回に嘘の赤が出る）。

   実行: node assert-deep-pay.mjs
   ⚠️ localhost が要る（node serve.mjs）。本番の DB には触らない。
*/
import puppeteer from 'puppeteer';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const ROOT = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const BASE = 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + ' ' + e)); };

/* CSS / JS のコメントを落としてから中身を見る。
   ★どのファイルも「何を置かないか」をコメントで説明している。素朴に grep すると
     説明を書いた人が赤くなる（＝説明を消すのが直し方になってしまう）。 */
const decomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, ' ');
const nohtmlcomment = (s) => s.replace(/<!--[\s\S]*?-->/g, ' ');
/* IIFE の直下（字下げ2つ）の関数を、名前で1つ切り出す。無ければ空文字。 */
const cutFn = (src, name) => {
  const m = new RegExp('^  function ' + name + '\\(([^)]*)\\) \\{', 'm').exec(src);
  if (!m) return '';
  let d = 0, j;
  for (j = m.index + m[0].length - 1; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (d === 0) break; }
  }
  return src.slice(m.index, j + 1);
};

const JA   = read('deep-pay.html');
const EN   = read('en/deep-pay.html');
const JS   = read('deep-pay.js');
const CSS  = read('deep-pay.css');
const SQL  = read('db/deep-pay.sql');
const jsC  = decomment(JS);
const cssC = decomment(CSS);

// ════════════════════════════════════════════════════════════════
// ① 入口は決めた所にだけ在る（2026-10-11 に公開）
// ════════════════════════════════════════════════════════════════
console.log('\n════ ① 入口（決めた所にだけ在る・黙って増えない）════');
{
  /* ── 左メニュー ── DEEP PAY の段は無いまま（公開しても7項目。段を足すのは別の回）。
       ★2026-09-06、左メニューから DEEP PAY / VERIFIED PAY の段そのものを撤去した
         （ナビを7項目へ畳んだ回）。
       ⚠️ DEEP PAY の段を足す日は、**必ず `href: 'deep-pay.html'` で足す**。前の形
          （`href: ''` ＋ `soon: true`）で足すと、押しても何も起きない段になる。
          足す手順は冒頭の「左メニューに段を足す日にやること」。そのときここを書き換える。
       ⚠️ VERIFIED PAY はまだページが無い ── 段が無いか、在るなら空＋soon。 */
  const nav = decomment(read('patch-side-nav.mjs'));
  const navLine = (k) => (nav.split('\n').find((l) => new RegExp("key:\\s*'" + k + "'").test(l)) || '');
  ok(navLine('deep') === '', '★左メニューの配り元に DEEP PAY の段が無い（7項目のまま）',
     navLine('deep').trim().slice(0, 90));
  ok(navLine('verified') === ''
     || (/href:\s*''/.test(navLine('verified')) && /soon:\s*true/.test(navLine('verified'))),
     '★左メニューに VERIFIED の行き先を作らない（段が無いか、在るなら空＋soon）',
     navLine('verified').trim().slice(0, 90));
  ok(!/deep-pay(-compare)?\.html/.test(nav),
     '★★左メニューの配り元が deep-pay の URL を1つも持たない', nav.match(/deep-pay[^'"\s]*/g) ? String(nav.match(/deep-pay[^'"\s]*/g)) : '');
  /* 配り元だけでなく、配られた先（この画面自身のナビ）も見る。 */
  for (const [name, html] of [['ja', JA], ['en', EN]]) {
    const i = html.indexOf('class="mr-side"');
    const side = i < 0 ? '' : html.slice(i, html.indexOf('</nav>', i));
    ok(side.length > 0 && !/DEEP PAY|deep-pay/.test(side),
       `${name}: ★この画面の左メニューにも DEEP PAY の段が無い`);
  }

  /* ── 3段の表（pv-gates.js）── DEEP PAY は live・名前だけ。入口も、条件も、人数も持たない。
       ★あの表は登録完了の画面と、全ページに出る板（pv-give-first.js）にも出る。
         ここに住所を1つ書くと、入口が約400枚に一度に生える。だから「deep-pay という字が
         コードに1つも無い」で見る（説明のコメントは落としてから数える）。
       ★公開前の案内（札・「N / 100人」・説明のパネル・人数を聞く通信）が戻っていない。 */
  const gates = decomment(read('pv-gates.js'));
  const soon = gates.match(/state:\s*'soon'/g) || [];
  ok(soon.length === 1 && /key:\s*'verified',\s*state:\s*'soon'/.test(gates),
     '★pv-gates.js の soon はちょうど1つ（VERIFIED だけ）', `今 ${soon.length}`);
  ok(/key:\s*'deep',\s*state:\s*'live'/.test(gates) && /key:\s*'real',\s*state:\s*'live'/.test(gates),
     '★pv-gates.js の deep が live（REAL PAY と同じ強さで名前が出る）');
  ok(!/deep-pay/.test(gates), '★★pv-gates.js に DEEP PAY への住所が1つも無い（3段の表は入口ではない）',
     (gates.match(/[^\n]*deep-pay[^\n]*/) || [''])[0].trim().slice(0, 90));
  ok(!/data-pv-give/.test(gates) && !/<button[^>]*pv-give-p/.test(gates),
     '★3段の表に押せる札が無い（DEEP PAY の札は外した・VERIFIED の札は押せないまま）');
  ok(!/\.rpc\s*\(|pv_give_progress|\bfetch\s*\(/.test(gates),
     '★pv-gates.js は通信を1本も投げない（人数を聞く仕掛けを戻していない）');
  ok(!/100|準備は完了|already qualified|more pilots|opens at|で開きます|内訳を共有|pay breakdown/i.test(gates),
     '★公開前の DEEP PAY の案内（100人・準備は完了・内訳を共有すると…）が1語も残っていない',
     (gates.match(/[^\n]*(?:100|準備は完了|already qualified|more pilots|opens at|で開きます|内訳を共有|pay breakdown)[^\n]*/i) || [''])[0].trim().slice(0, 90));
  ok(!/\bdeepN?\s*:\s*\{/.test(gates), '★説明のパネルに DEEP PAY の文面が無い（verified と real だけ）');
  ok(/function setProgress\(\)\s*\{\s*\}/.test(gates),
     '★PVGates.setProgress は受け取って何もしない（呼ぶ側が残っているので名前だけ在る）');
  ok(/if \(kind === 'deep'\) return;/.test(gates),
     "★PVGates.open('deep') は何もしない（公開前の説明を出さない）");

  /* ── 辺の集合 ── DEEP PAY の2枚（概要 deep-pay.html と 会社比較 deep-pay-compare.html）へ
     繋がる線は、対の外からは**ちょうど3本**。
       actual-pay.html    → deep-pay.html   … REAL PAY の見出しのタブ（日本語）
       en/actual-pay.html → deep-pay.html   … 同じタブ（英語）
       actual-pay.js      → deep-pay.html   … 行を押すと出る面のボタン（日英が共有）
     ⚠️ ここを「外に1本以上ある」に緩めてはいけない。それだと index.html や会社ページから
        生えた4本目を**数えないまま通る**。内と外に振り分けて、外を**この3本ちょうど**に
        固定する形でなければ、入口が黙って増える。
     ⚠️ 入口は HTML の <a> だけに在るとは限らない ── 対の中の2本は**両方とも JS が
        組み立てている**（deep-pay.js の ln() と deep-pay-compare.js の href="…"）し、
        面のボタンも JS。だから *.js も同じ網で見る。
     ★網は 2026-10-11 に広げた（国別ページと、会社ページの下の JS）。入口を作った日に、
       見ていない場所を残さない。 */
  const PAIR = new Set([
    'deep-pay.html', 'en/deep-pay.html',
    'deep-pay-compare.html', 'en/deep-pay-compare.html',
    'deep-pay.js', 'deep-pay-compare.js'
  ]);
  /* どちらの画面を指しているかだけ取り出す。'/' か '=' の直後、または先頭。
     ★長いほう（-compare）を先に書く ── 順を逆にすると deep-pay-compare.html が
       deep-pay.html に前方一致で吸われて、行き先を取り違える。 */
  const WHICH = /(?:^|[/=])(deep-pay-compare\.html|deep-pay\.html)/;
  const dirs = ['.', 'en', 'airlines', 'en/airlines', 'countries', 'en/countries'];
  const inside = [], outside = [];
  const add = (rel, target) => (PAIR.has(rel) ? inside : outside).push(rel + ' → ' + target);
  let seenHtml = 0, seenJs = 0;

  for (const d of dirs) {
    const abs = new URL(d + '/', ROOT);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      const rel = (d === '.' ? '' : d + '/') + f;
      if (f.endsWith('.html')) {
        seenHtml++;
        /* canonical / alternate / stylesheet は deep-pay 自身の head なので数えない
           （見るのは <a> だけ）。★2026-10-11 まで inline の JS に在った「ログインの戻り先」
           （自分の住所を書いた字）は、ログインへ送るのをやめたので今は無い（⑭）。 */
        for (const m of nohtmlcomment(read(rel)).matchAll(/<a\b[^>]*href="([^"]*)"/gi)) {
          const hit = WHICH.exec(m[1]);
          if (hit) add(rel, hit[1]);
        }
      } else if (f.endsWith('.js')) {
        /* lang-toggle.js は言語切替の名簿（生成物）で、入口ではない。⑩ が別に見ている。 */
        if (rel === 'lang-toggle.js') continue;
        seenJs++;
        for (const m of decomment(read(rel)).matchAll(/['"]([^'"]*deep-pay[\w-]*\.html)['"]/g)) {
          const hit = WHICH.exec(m[1]);
          if (hit) add(rel, hit[1]);
        }
      }
    }
  }
  /* 網そのものが空振りしていないこと（フォルダの名前を替えた日に、0枚を見て緑にならない）。 */
  ok(seenHtml > 300 && seenJs > 20, '（前置き）入口を探す網が、画面と JS を実際に読んでいる',
     `HTML ${seenHtml} 枚 / JS ${seenJs} 本`);

  const ENTRANCES = ['actual-pay.html → deep-pay.html',
                     'actual-pay.js → deep-pay.html',
                     'en/actual-pay.html → deep-pay.html'];
  ok(outside.slice().sort().join(' / ') === ENTRANCES.join(' / '),
     '★★対の外から DEEP PAY へ繋がる線は、ちょうど3本（REAL PAY のタブの日英・行の面のボタン）',
     outside.slice().sort().join(' / ') || '（1本も無い）');
  ok(!outside.some((e) => /deep-pay-compare\.html$/.test(e)),
     '★会社比較へは、対の外から直に繋がない');
  /* ── 対の中の線 ── 2026-10-12（オーナー判断「会社比較はまだ出さないでよ」）から、
       **会社比較へ繋がる生きた線は1本も無い**。字として残っているのは2本 ──
         deep-pay-compare.js → deep-pay.html         … 生きている（「準備中」の板の「DEEP PAY に戻る」。
                                                        出した日の、下の入口の同じリンクも同じ字）
         deep-pay.js → deep-pay-compare.html         … **眠っている**（「会社比較を見る」のカード）
       2本めは、定数 COMPARE_OPEN が false のあいだ描かれない。消していないのは、出す日に
       1行で戻すため。「眠っている」と言えるのは、下の4つがそろっているときだけ：
         a) 定数が false（代入は1か所）
         b) 会社比較の住所の字は deep-pay.js に1つきりで、more() の中に在る
         c) more() は、その字より**前**で「閉じていれば器を空にして畳んで戻る」
         d) 開ける口（compareOpen）は手元の住所でしか効かない（字は assert-deep-pay-compare.mjs
            の ⓪ が固定し、2つの JS で同じ本体であることを ④ が見る。ここは在ることだけ）
       ⚠️ a)〜c) のどれかを緩めると、会社比較への入口が黙って戻る。実物は §3・§7・§3h。 */
  const DORMANT = 'deep-pay.js → deep-pay-compare.html';
  const LIVE = 'deep-pay-compare.js → deep-pay.html';
  /* 日英で同じ JS を共有しているので、実体はこの2本。 */
  ok([...new Set(inside)].sort().join(' / ') === [LIVE, DORMANT].join(' / '),
     '★対の中に字として在る線は2本（会社比較 → DEEP PAY に戻る／眠っている「会社比較を見る」）',
     inside.sort().join(' / '));
  {
    const cnt = (re, t) => (t.match(re) || []).length;
    const moreC = decomment(cutFn(JS, 'more'));
    const guard = moreC.indexOf("if (!compareOpen()) { box.innerHTML = ''; box.hidden = true; return; }");
    const addr = moreC.indexOf("'deep-pay-compare.html'");
    ok(/^  var COMPARE_OPEN = false;$/m.test(JS) && cnt(/\bCOMPARE_OPEN\s*=(?!=)/g, jsC) === 1
       && cnt(/\bCOMPARE_OPEN\b/g, jsC) === 2,
       '★★deep-pay.js の COMPARE_OPEN は false（会社比較への入口は出さない）。代入は1か所・読むのは compareOpen() の1か所',
       `代入 ${cnt(/\bCOMPARE_OPEN\s*=(?!=)/g, jsC)} / 字 ${cnt(/\bCOMPARE_OPEN\b/g, jsC)}`);
    ok(cnt(/deep-pay-compare\.html/g, jsC) === 1 && addr > 0,
       '★★会社比較の住所の字は deep-pay.js に1つきりで、more() の中に在る（ほかの描き手から繋がない）',
       `字 ${cnt(/deep-pay-compare\.html/g, jsC)} 個 / more() の中 ${addr}`);
    ok(guard > 0 && guard < addr && guard < moreC.indexOf('innerHTML = \'<section')
       && moreC.indexOf('var box = el(\'dp-more\');') < guard,
       '★★more() は、閉じていれば**何も組まずに**器を空にして畳んで戻る（その行は、住所の字よりも板の HTML よりも前）',
       `戻る行 ${guard} / 住所 ${addr}`);
    ok(cnt(/\bmore\(\)/g, jsC) === 2 && /kpis\(\); comp\(\); work\(\); vari\(\); more\(\);/.test(decomment(cutFn(JS, 'render'))),
       '★more() を呼ぶのは render() の「開いている」枝の1か所だけ');
    ok(cnt(/\bcompareOpen\(/g, jsC) === 2 && cutFn(JS, 'compareOpen').length > 0
       && cnt(/__PV_COMPARE_OPEN/g, jsC) === 1,
       '★開ける口（compareOpen）を使うのは more() の1か所だけ（印を読むのは、その関数の中の1回）',
       `compareOpen ${cnt(/\bcompareOpen\(/g, jsC)} / 印 ${cnt(/__PV_COMPARE_OPEN/g, jsC)}`);
    /* ★カードの字（題・説明・リンクの名前）も、more() のほかでは使っていない。 */
    ok(cnt(/\bT\.more[TS1]\b/g, jsC) === 3 && cnt(/\bT\.more[TS1]\b/g, moreC) === 3,
       '★カードの字（moreT / moreS / more1）を使うのは more() の中だけ', String(cnt(/\bT\.more[TS1]\b/g, jsC)));
  }

  ok(!/deep-pay/.test(read('sitemap.xml')), '★sitemap.xml に出ない（noindex。公開しても検索には出さない）');
  ok(/name="robots"\s+content="noindex/.test(nohtmlcomment(JA)), 'ja: noindex を宣言している');
  ok(/name="robots"\s+content="noindex/.test(nohtmlcomment(EN)), 'en: noindex を宣言している');
}

// ════════════════════════════════════════════════════════════════
// ①-b REAL PAY ⇄ DEEP PAY のタブ（字面。実物は §0）
// ════════════════════════════════════════════════════════════════
console.log('\n════ ①-b タブ（字面）════');
/* 2つのスタイルシートから、タブの塊（BEGIN〜END のあいだ）を切り出す。無ければ空文字。 */
const tabBlock = (css) => {
  const a = css.indexOf('PV-PAYTABS:BEGIN'), b = css.indexOf('PV-PAYTABS:END');
  return (a < 0 || b < a) ? '' : css.slice(a, b);
};
const TAB_LABEL = { ja: 'REAL PAY と DEEP PAY の切り替え', en: 'Switch between REAL PAY and DEEP PAY' };
{
  /* ★タブは HTML に静的に在る（JS が動く前から見えている）。並びは2枚で同じ ── REAL PAY が左。
       この画面では DEEP PAY が <h1>（いま居る側）、REAL PAY がただのリンク。 */
  for (const [name, raw] of [['ja', JA], ['en', EN]]) {
    const html = nohtmlcomment(raw);
    const want = new RegExp(
      '<div class="mr-hd" id="dp-hd">\\s*'
      + '<nav class="pv-paytabs" aria-label="' + TAB_LABEL[name] + '">\\s*'
      + '<a class="pv-paytab" href="actual-pay\\.html">REAL PAY</a>\\s*'
      + '<h1 class="pv-paytab is-on" aria-current="page">DEEP PAY</h1>\\s*'
      + '</nav>\\s*</div>');
    ok(want.test(html), `${name}: ★★見出しの器（#dp-hd）に、REAL PAY（リンク）→ DEEP PAY（h1・いま居る側）のタブが静的に在る`);
    ok((html.match(/<h1[\s>]/g) || []).length === 1, `${name}: ★<h1> は HTML にちょうど1つ`,
       String((html.match(/<h1[\s>]/g) || []).length));
    ok((html.match(/aria-current="page"/g) || []).length === 1
       && /<h1[^>]*aria-current="page"[^>]*>DEEP PAY<\/h1>/.test(html),
       `${name}: ★aria-current="page" は DEEP PAY の1つだけ（左メニューには付かない）`);
    ok((html.match(/class="pv-paytab(?: is-on)?"/g) || []).length === 2,
       `${name}: タブは2つ（3つ目を足していない）`);
  }
  /* ★JS は見出しを書かない・器を丸ごと書き換えない（書き換えるとタブ＝戻る道ごと消える）。 */
  const headFn = decomment(cutFn(JS, 'head'));
  ok(!/<h1/.test(jsC), '★deep-pay.js は <h1> を書かない（見出しは HTML のタブが持つ）');
  ok(headFn.length > 0 && !/\.innerHTML\s*=/.test(headFn) && /insertAdjacentHTML\('beforeend'/.test(headFn)
     && /querySelector\('\.dp-cond'\)/.test(headFn) && /removeChild\(/.test(headFn),
     '★★head() は #dp-hd を丸ごと書き換えない（前の条件の1行を外して、新しい1行を後ろへ足すだけ）');
  /* ★会社比較にはタブを置いていない（あちらは DEEP PAY の中の1枚）。 */
  for (const f of ['deep-pay-compare.html', 'en/deep-pay-compare.html']) {
    ok(!/pv-paytab/.test(nohtmlcomment(read(f))), `${f}: ★タブを置いていない（会社比較は変えていない）`);
  }

  /* ★見た目は2つのファイルに**同じ塊**で在る（deep-pay.css と actual-pay.css）。
       片方だけ直すと、画面を替えたときにタブの形や位置が変わって見える。
       ⚠️ 塊の外へタブの規則を書かない（そこは突き合わせが届かない）。 */
  const A = read('actual-pay.css'), blkD = tabBlock(CSS), blkA = tabBlock(A);
  ok(blkD.length > 400 && blkD === blkA,
     '★★タブの CSS（PV-PAYTABS:BEGIN〜END）が deep-pay.css と actual-pay.css で1文字も違わない',
     `deep-pay.css ${blkD.length} 字 / actual-pay.css ${blkA.length} 字`);
  for (const [f, css, blk] of [['deep-pay.css', CSS, blkD], ['actual-pay.css', A, blkA]]) {
    ok(!/\.pv-paytab/.test(decomment(css.replace(blk, () => ' '))),
       `★${f}: タブの規則は塊の中にだけ在る（外に書き足していない）`);
  }
  const blk = decomment(blkD);
  const moved = [...blk.matchAll(/transition\s*:\s*([^;}]+)/g)]
    .flatMap((m) => m[1].split(',').map((x) => x.trim().split(/\s+/)[0]));
  ok(moved.length > 0 && moved.every((x) => x === 'transform' || x === 'opacity' || x === 'none'),
     '★タブで動かすのは transform と opacity だけ（transition:all も色の変化も無い）', moved.join(' '));
  ok(!/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(blk) && /var\(--pv-ink\)/.test(blk)
     && /var\(--pv-ink-3\)/.test(blk) && /var\(--pv-orange\)/.test(blk),
     '★タブの色はトークンだけ（明暗の切り替えがそのまま効く・色を発明していない）');
  ok(/a\.pv-paytab:hover/.test(blk) && /a\.pv-paytab:focus-visible\{[^}]*outline:/.test(blk)
     && /a\.pv-paytab:active\{[^}]*transform:/.test(blk),
     '★リンクの側に hover / focus-visible / active が在る');
  ok(/prefers-reduced-motion:reduce/.test(blk), '「動きを減らす」設定では動かさない');
}

// ════════════════════════════════════════════════════════════════
// ② ぼかしで隠していない ／ ③ 作り物を置いていない
// ════════════════════════════════════════════════════════════════
console.log('\n════ ②③ 隠さない・作らない ════');
{
  /* ── ②-a ぼかしてよいのは、影絵の規則1つだけ（2026-10-11・オーナー判断）──────
     前はここで「blur / filter / mask / user-select:none が CSS にも JS にも1つも無い」を
     見ていた。閉じた画面の後ろに、ぼかした影絵を置くことになったので、CSS の側にだけ
     **狭い例外**を作った ── deep-pay.css の `.dp-ghost{…}` という規則1つ。
     ★見方：その規則を抜いた残りに、隠す系の宣言が1つも無いこと。
       ・例外になるのは、セレクタが `.dp-ghost` **だけ**の、いちばん外の規則。
         `.dp-ghost .x{…}`・`.a,.dp-ghost{…}`・@media の中の `.dp-ghost{…}` は例外にしない
         （影絵の中の部品や、条件つきの規則へ広げた時点で赤くなる）。
       ・backdrop-filter と mask は、その規則の中でも許さない。
       ・JS と HTML は今までどおり**1文字も**許さない（JS が style.filter を触る道も塞ぐ）。
     ⚠️ ここを「.dp-ghost を含むセレクタなら可」に緩めない。`.dp-ghost .dp-kpi-v` のように
        書けば、値の入る要素へぼかしを付けられてしまう。 */
  const hide = [
    [/blur\s*\(/i, 'blur()'],
    [/(^|[^-\w])filter\s*:/, 'filter:'],
    [/backdrop-filter/i, 'backdrop-filter'],
    [/\bmask(-image)?\s*:/i, 'mask:'],
    [/clip-path\s*:/i, 'clip-path:'],
    [/user-select\s*:\s*none/i, 'user-select:none']
  ];
  const GHOST_RULE = /(^|\})\s*\.dp-ghost\s*\{([^{}]*)\}/g;
  const ghostRules = [...cssC.matchAll(GHOST_RULE)].map((m) => m[2]);
  ok(ghostRules.length === 1, '★影絵の規則（.dp-ghost{…}）は deep-pay.css にちょうど1つ',
     `今 ${ghostRules.length} 個`);
  const ghostRule = ghostRules[0] || '';
  const cssRest = cssC.replace(GHOST_RULE, (m, head) => head);   // ★関数形（$ を素通しする）
  for (const [re, name] of hide) {
    ok(!re.test(cssRest),
       `★deep-pay.css の ${name} は、影絵の規則の外に1つも無い（値の入る要素をぼかさない）`,
       (cssRest.match(new RegExp('[^{}]*\\{[^{}]*' + re.source + '[^{}]*\\}', 'i')) || [''])[0]
         .trim().slice(0, 80));
    ok(!re.test(jsC),  `★deep-pay.js に ${name} が無い`);
    ok(!re.test(nohtmlcomment(JA)) && !re.test(nohtmlcomment(EN)),
       `★HTML（日英）に ${name} が無い`);
  }
  {
    const b = /(^|[^-\w])filter\s*:\s*blur\(\s*([\d.]+)px\s*\)/.exec(ghostRule);
    ok(!!b && Number(b[2]) >= 6 && Number(b[2]) <= 10,
       '★影絵のぼかしは filter:blur(6〜10px) の1つ', b ? b[2] + 'px' : ghostRule.slice(0, 80));
    ok(!/backdrop-filter/i.test(ghostRule) && !/\bmask(-image)?\s*:/i.test(ghostRule),
       '★影絵の規則の中でも backdrop-filter と mask は使わない');
    ok(/pointer-events\s*:\s*none/.test(ghostRule) && /user-select\s*:\s*none/.test(ghostRule),
       '★影絵は押せない・選べない（inert を知らないブラウザのための重ね掛け）');
    /* JS がぼかしを付けたり外したりしない（付ける場所は CSS の1規則だけ）。 */
    ok(!/\.style\.(?:filter|backdropFilter|webkitFilter|webkitBackdropFilter|clipPath|mask\w*|webkitMask\w*)\b/.test(jsC)
       && !/setProperty\(\s*['"](?:-webkit-)?(?:backdrop-)?filter/.test(jsC)
       && !/\bcssText\b/.test(jsC),
       '★deep-pay.js は style.filter を触らない（setProperty・cssText の道も無い）');
  }

  /* ── ②-b 影絵は、字も数字も持たない固定の絵（2026-10-11）────────────────
     ぼかしは外せる。だから**外されて困るものを影絵に入れない**ことが、この例外の土台。
     影絵を組むのは deep-pay.js の ghBar / ghBars / ghField / ghHead / ghostShapes
     （形）と ghostTint（色）で、器に入れるのは lockStage。見るのは ──
       ① 形を組む5つの字面に、数字・通貨記号が1文字も無い（コメントは落として見る）
       ② 同じ5つが、サーバの答え・状態・保存領域・金額の道具・乱数・日付に触らない
       ③ その5つ**だけ**を取り出して実行できる（外の値を1つでも読めば ReferenceError）
       ④ 組み上がった HTML のタグの外が空（字が1文字も無い）・属性にも数字が無い・
          押せるものも読み込むものも無い（div / span / i だけ）
       ⑤ 色は COL（PVViz.SEG から引いた色の表）だけを読む
       ⑥ lockStage は影絵を**引数なし**で呼び、gate は板（lockHtml）にだけ渡す。
          aria-hidden と inert を付ける。影絵を置く道は shut() の中の2本だけ
          （会員の閉じた板と、ログインしていない人の板。2026-10-11 に1本増えた ──
            どちらも数字が1つも来ていない画面）
     ⚠️ ① を「タグの外に数字が無い」へ緩めない。属性（style・data-*）に値を入れてから
        CSS で見せる道（content:attr(…)）が開く。字面ごと数字を禁じてある。 */
  {
    const SHAPE = ['ghBar', 'ghBars', 'ghField', 'ghHead', 'ghostShapes'];
    const src = {};
    for (const n of SHAPE.concat(['ghostTint', 'lockStage'])) src[n] = cutFn(JS, n);
    ok(Object.keys(src).every((n) => src[n].length > 0), '影絵を組む関数が7つとも切り出せる',
       Object.keys(src).filter((n) => !src[n]).join(' '));
    const REFS = /\b[SVTwd]\s*[.\[]|\b(?:CN|VN|IC|COL|SEGCOL)\b|\bel\(|payload|\bstats\b|\bgate\b|\bdata\b|\bhead\b|\bcomp\b|\bwork\b|\bcohort\b|\bpicks\b|[sS]torage|\bMath\b|\bDate\b|\bfmt\b|\bmoney\w*|\bnum\(|\bexact\(|\bsig\w+\(|\bstepIn\(|PVCurrency|\bfetch\b|\brpc\b|\bsb\d?\b/;
    for (const n of SHAPE) {
      const c = decomment(src[n]);
      ok(!/[0-9０-９]/.test(c), `★${n}() の字面に数字が1文字も無い`,
         (c.match(/[^\n]*[0-9０-９][^\n]*/) || [''])[0].trim().slice(0, 80));
      ok(!/[¥$€£]|万/.test(c), `★${n}() の字面に通貨記号が無い`);
      /* ★字（'…'）は落としてから見る。クラス名の dp-list--work や 'a b c d' の d を、
           答えの鍵や document だと読み違えない。字の中身そのものは ①④ が見ている。 */
      const bare = c.replace(/'[^']*'/g, "''");
      ok(!REFS.test(bare), `★${n}() がサーバの答え・状態・保存領域・金額の道具・乱数に触らない`,
         (REFS.exec(bare) || [''])[0]);
      ok(!/"/.test(bare) && !/`/.test(bare),
         `★${n}() の字は全部 '…' で書いてある（上の見張りが字を落とし切れている）`);
    }
    ok(/^  function ghostShapes\(\) \{/.test(src.ghostShapes) && /^  function ghostTint\(\) \{/.test(src.ghostTint),
       '★ghostShapes() と ghostTint() は引数を取らない（渡された値で絵を変えない）');

    /* ③④ 5つだけを取り出して組み上げる。外の値に触っていれば、ここで落ちる。 */
    let html = null, why = '';
    try { html = new Function(SHAPE.map((n) => src[n]).join('\n') + '\nreturn ghostShapes();')(); }
    catch (e) { why = String(e && e.message); }
    ok(typeof html === 'string' && html.length > 400,
       '★★ghostShapes() は、外の値を1つも読まずに組み上がる（固定の文字列）', why);
    const H = html || '0';
    ok(H.replace(/<[^>]*>/g, '') === '',
       '★★組み上がった影絵に、字が1文字も無い（タグの外が空）',
       JSON.stringify(H.replace(/<[^>]*>/g, '').slice(0, 40)));
    ok(!/[0-9０-９¥$€£万%]/.test(H),
       '★★組み上がった影絵の HTML に、数字も通貨記号も % も無い（属性の中にも）',
       (H.match(/[^<>]{0,20}[0-9０-９¥$€£万%][^<>]{0,20}/) || [''])[0]);
    const tags = [...new Set([...H.matchAll(/<([a-z][\w-]*)/gi)].map((m) => m[1].toLowerCase()))].sort();
    ok(tags.join(' ') === 'div i span',
       '★影絵のタグは div / i / span だけ（押せるもの・読み込むもの・スクリプトが無い）', tags.join(' '));
    ok(!/\b(?:href|src|tabindex|contenteditable|on\w+|data-[\w-]+|id)\s*=/i.test(H),
       '★影絵に href / src / tabindex / on* / data-* / id が無い');
    ok(!/dp-kpi(?:["\s]|--)|dp-msg|dp-cta|dp-todo|dp-trust|dp-cond/.test(H),
       '★影絵が、本物の KPI のカード（.dp-kpi）や板の部品のクラスを名乗らない（検査が数えている）');
    /* 2回組んでも同じ（中で何も数えていない・乱数も時刻も無い）。 */
    let again = null;
    try { again = new Function(SHAPE.map((n) => src[n]).join('\n') + '\nreturn ghostShapes();')(); } catch (e) {}
    ok(again === html, '★影絵は何度組んでも同じ字（乱数も時刻も無い）');

    /* ⑤ 色。COL だけを読み、--gh-<区分>:<色> の並びだけを返す。値が無い区分は出さない。 */
    const tintC = decomment(src.ghostTint);
    ok(!/[0-9０-９]/.test(tintC) && !/\b[SVTwd]\s*[.\[]|payload|\bgate\b|\bdata\b|[sS]torage|\bMath\b|PVCurrency/.test(tintC),
       '★ghostTint() の字面に数字が無く、COL のほかは読まない');
    let tint = null;
    try { tint = new Function('COL', src.ghostTint + '\nreturn ghostTint();')(
      { base: 'red', variable: 'blue', rest: '', other: null }); } catch (e) {}
    ok(tint === '--gh-base:red;--gh-variable:blue',
       '★ghostTint() は COL の色を --gh-<区分> として渡すだけ（色の無い区分は出さない）', String(tint));

    /* ⑥ 器。 */
    const stageC = decomment(src.lockStage);
    ok(/class="dp-ghost" aria-hidden="true" inert /.test(stageC),
       '★lockStage は影絵に aria-hidden="true" と inert を付ける');
    ok(/ghostShapes\(\)/.test(stageC) && /ghostTint\(\)/.test(stageC)
       && !/ghost\w*\(\s*[^)\s]/.test(stageC),
       '★lockStage は影絵を引数なしで呼ぶ（門も答えも渡さない）');
    ok((stageC.match(/\bgate\b/g) || []).length === 2 && /lockHtml\(gate\)/.test(stageC),
       '★lockStage が gate を渡すのは板（lockHtml）にだけ');
    ok(!/\bS\s*\.|\bdata\b|\bhead\b|\bcomp\b|[sS]torage/.test(stageC),
       '★lockStage が状態にも保存領域にも触らない');
    /* ★2026-10-11、呼び出しが1か所から2か所になった（ログインしていない人の板）。
         どちらも shut() の中で、渡すのは「会員の門」か「作り物の門 anonGate()」だけ ──
         答えの入れ物（S.data）を丸ごと渡す道や、shut() の外から器を置く道は無いまま。
         （定義の1つ ＋ 呼び出しの2つ ＝ 字としては3つ。） */
    const shutC = decomment(cutFn(JS, 'shut'));
    ok((jsC.match(/\blockStage\(/g) || []).length === 3
       && (shutC.match(/\blockStage\(/g) || []).length === 2
       && /lockBoard\(box, lockStage\(\(S\.data && S\.data\.gate\) \|\| \{\}\)\);/.test(shutC)
       && /if \(kind === 'anon'\) \{ lockBoard\(box, lockStage\(anonGate\(\)\)\); return; \}/.test(shutC),
       '★影絵を置く道は shut() の中の2本だけ（会員の門／ログインしていない人の作り物の門）',
       `全体 ${(jsC.match(/\blockStage\(/g) || []).length} / shut の中 ${(shutC.match(/\blockStage\(/g) || []).length}`);
    ok((jsC.match(/dp-ghost/g) || []).length === 1 && (jsC.match(/dp-stage/g) || []).length === 1,
       '★影絵と器のクラス（dp-ghost / dp-stage）を書くのは lockStage の中だけ');
    /* 開いた画面の描き手（KPI・給与構成・働き方・変動給）は、影絵の部品を使わない。 */
    for (const n of ['kpis', 'comp', 'work', 'vari', 'more', 'ask', 'thin', 'head', 'picker']) {
      const c = decomment(cutFn(JS, n));
      ok(c.length > 0 && !/\bgh[A-Z]\w*\(|ghost\w*\(|lockStage\(|dp-gh-|dp-ghost|dp-stage/.test(c),
         `★${n}() は影絵の部品を使わない（本物の値を影絵の形で描かない）`);
    }
    /* ★読み込みのあいだは骨組みのまま（錠前の板へ落とさない）。 */
    ok(/if \(S\.mode === 'load'\)\s+return;\s*if \(S\.mode !== 'open'\)\s+\{ shut\('lock'\);/.test(jsC),
       '★render() は、最初の答えが来るまで錠前の板（と影絵）を出さない');
  }
  /* ★「見えないところに置いてある」形も無い。opacity:0 / visibility:hidden で
       値を伏せると、DOM には出たまま＝検査は通るのに人には読めない。 */
  ok(!/opacity\s*:\s*0\s*[;}]/.test(cssC), '★deep-pay.css に opacity:0 が無い');
  ok(!/visibility\s*:\s*hidden/.test(cssC), '★deep-pay.css に visibility:hidden が無い');

  const fake = [/\bSAMPLE\b/, /\bDEMO\b/, /\bdummy\b/i, /\bmockData\b/i, /Math\.random/];
  for (const re of fake) {
    ok(!re.test(jsC), `★deep-pay.js に作り物のデータが無い（${re.source}）`);
    ok(!re.test(nohtmlcomment(JA)) && !re.test(nohtmlcomment(EN)),
       `★HTML に作り物のデータが無い（${re.source}）`);
  }
  /* 数字は必ずサーバから来る。JS に埋めた「見本の年収」が残っていないこと。
     （158.95 だけは currency.js が無いときの USD レートの既定値＝my-value.js:671 の写し）
     ★2026-10-11、5桁の字が1つ入った ── '42501'。金額ではなく Postgres の符丁
       （権限が無い ＝ pv_deep_pay() が未ログインのときに投げる）で、authLost() が
       サーバの答えと突き合わせる。通すのは**その関数の中の1つだけ**。ほかの場所に
       同じ字が増えたら、ここが落ちる（数を数えている）。 */
  const authC = decomment(cutFn(JS, 'authLost'));
  const nums = (jsC.match(/\b\d{5,}\b/g) || []).filter((n) => n !== '158' && n !== '42501');
  ok(nums.length === 0, '★deep-pay.js に5桁以上の裸の数字が無い（見本の金額の残り）', nums.join(' '));
  ok((jsC.match(/\b42501\b/g) || []).length === 1 && /=== '42501'/.test(authC),
     '★5桁の字で通してよいのは、authLost() の中の符丁 42501 の1つだけ',
     String((jsC.match(/\b42501\b/g) || []).length));

  /* ★人数の鍵を読まない（2026-10-11・オーナー判断「人数は出さない」）。
       サーバ（db/deep-pay.sql）は区分の人数を返さなくなったが、**古いサーバは返す**。
       読む行が1つでも残っていると、SQL を貼る前の日だけ人数が画面に戻る。
     ⚠️ `.n` を丸ごと禁じない。`o.n` は KPI カードの添え字（note）の欄で、人数ではない。
        人数の鍵の名前と、鍵を持つ入れ物の名前で見る。
     ★実際に出ないことは、ブラウザの §3f が毒入りの答えで見ている。 */
  for (const k of ['verified_n', 'detailed_n']) {
    ok(!new RegExp('\\b' + k + '\\b').test(jsC), `★deep-pay.js が人数の鍵 ${k} を読まない`);
  }
  const reads = jsC.match(/\b(?:cohort|c|comp|bonus|b|h|head|x)\.n\b/g) || [];
  ok(reads.length === 0, '★deep-pay.js が区分の人数（cohort.n / comp.n など）を読まない',
     reads.join(' '));
  /* ★信頼度の段を画面で作り直さない。作るには人数が要る＝式が残っていれば、
       人数を読む道も残っている。段は db/deep-pay.sql の trust が返す。 */
  ok(!/\btrustOf\b|\bTCAP\b/.test(jsC), '★信頼度の式を画面に持たない（段はサーバが返す）');
  ok(/\.trust\b/.test(jsC), '信頼度はサーバの cohort.trust を読んでいる');
  /* ★「◯人」「◯ pilots」の単位の語を持たない（人数を出す場所が無いので要らない）。 */
  ok(!/\bpeople\s*:|\bverif\s*:/.test(jsC), '★人数の単位の語（people / verif）を文言に持たない');
}

// ════════════════════════════════════════════════════════════════
// ④ 「時給」と呼んでいない ／ ⑤ 順位を書いていない
// ════════════════════════════════════════════════════════════════
console.log('\n════ ④⑤ 言葉 ════');
/* ★「時給」は**それを否定している文**でだけ許す。
   「時給ではなく、働き方の前提とセットで見ます」は画像そのままの文言で、
   むしろ禁止を読み手に伝えている1行だから消さない。
   ここを「時給という語が無いこと」に緩めるとその1行が消え、
   逆に「時給を含む文は全部許す」に緩めると、値のラベルが
   「時給: ¥14,800」になった日に赤くならない。だから**否定形だけ**。 */
function saysHourly(src) {
  const ja = (src.match(/時給/g) || []).length -
             (src.match(/時給(?:では(?:なく|ありません|ない))/g) || []).length;
  const en = [...src.matchAll(/hourly\s+(?:rate|wage|pay)/gi)]
    .filter((m) => !/\bnot\b/i.test(src.slice(Math.max(0, m.index - 40), m.index)))
    .map((m) => src.slice(Math.max(0, m.index - 40), m.index + 20).replace(/\s+/g, ' '));
  return { ja, en };
}
{
  for (const [name, src] of [['js', jsC], ['ja', nohtmlcomment(JA)], ['en', nohtmlcomment(EN)]]) {
    const h = saysHourly(src);
    ok(h.ja === 0, `★${name}: 「時給」と呼んでいない（否定する文だけ許す）`, `否定でない「時給」が ${h.ja} 個`);
    ok(h.en.length === 0, `★${name}: hourly rate と呼んでいない`, h.en.join(' / '));
    ok(!/上位/.test(src), `★${name}: 「上位○%」を書いていない`);
    ok(!/パーセンタイル|percentile/i.test(src), `★${name}: パーセンタイルを書いていない`);
    ok(!/ランキング|\branking\b/i.test(src), `★${name}: ランキングを書いていない`);
  }
  /* 名前は日英とも Pay / Block Hour のまま（文言は T にある）。 */
  const pbh = (jsC.match(/Pay \/ Block Hour/g) || []).length;
  ok(pbh >= 2, '★Pay / Block Hour が日英ぶん在る', `今 ${pbh} 個`);
  ok(/per_block_usd/.test(jsC), 'サーバの鍵は per_block_usd（hourly ではない）');
  /* 根拠の無い精度を書かない（「98% accurate」の類）。 */
  ok(!/\b9\d(\.\d+)?%\s*(accurate|正確)/i.test(jsC), '★根拠の無い正確さを書いていない');
}

// ════════════════════════════════════════════════════════════════
// ⑥ 写した関数がずれていない
// ════════════════════════════════════════════════════════════════
console.log('\n════ ⑥ my-value.js から写した関数 ════');
{
  /* my-value.js は IIFE に閉じていて export が無い＝借りられず、写すしかなかった。
     写しは黙って腐る（あちらだけ直っても画面は動き続ける）。ここが唯一の見張り。 */
  const bodies = (src) => {
    const out = {};
    const re = /^  function (\w+)\(([^)]*)\) \{/gm;
    let m;
    while ((m = re.exec(src))) {
      let d = 0, j;
      for (j = re.lastIndex - 1; j < src.length; j++) {
        if (src[j] === '{') d++;
        else if (src[j] === '}') { d--; if (d === 0) break; }
      }
      out[m[1]] = src.slice(m.index, j + 1);
    }
    return out;
  };
  const norm = (t) => decomment(t).replace(/\s+/g, ' ').trim();
  const MV = bodies(read('my-value.js'));
  const DP = bodies(JS);
  for (const name of ['sec', 'note', 'empty', 'exact', 'usdToJpy']) {
    const a = MV[name], b = DP[name];
    ok(a && b && norm(a) === norm(b),
       `★${name}() が my-value.js の写しのまま（ずれていない）`,
       !a ? 'my-value.js に無い' : !b ? 'deep-pay.js に無い' : '中身が違う');
  }
  /* ★写してはいけないもの。あの2つは「見本の値をぼかして見せる」道具で、仕様でも
       pv-gates.js の冒頭でも禁止。閉じた画面の影絵（2026-10-11）は別物 ── 値をぼかして
       いるのではなく、字も数字も無い形をぼかしている（② の b）。 */
  ok(!/maskSample|sampleBreakdown/.test(jsC), '★maskSample / sampleBreakdown は写していない');
}

// ════════════════════════════════════════════════════════════════
// ⑦ 絵は pay-viz.js を借りている
// ════════════════════════════════════════════════════════════════
console.log('\n════ ⑦ 絵の実体は1か所だけ ════');
{
  ok(/donutFromSegs/.test(jsC), 'ドーナツは PVViz.donutFromSegs を呼んでいる');
  ok(!/stroke-dasharray/.test(jsC), '★deep-pay.js が stroke-dasharray を自前で持たない');
  ok(!/Math\.PI/.test(jsC), '★deep-pay.js が 2πr を自前で持たない');
  /* ★compSegs は使わない。あちらは pv_pay_rows() の5バケツ {m,b,d,h,o} と
     COMP の色に固定されていて**年額前提**。こちらは9区分・月額・賞与抜き。 */
  ok(!/compSegs/.test(jsC), '★PVViz.compSegs を使っていない（5バケツ・年額前提）');
  for (const [name, raw] of [['ja', JA], ['en', EN]]) {
    const html = nohtmlcomment(raw);
    /* ★?v=指紋 が付いていてもいなくても拾う（2026-10-11 に deep-pay.js / deep-pay.css へ
         指紋を付けた。指紋そのものが合っているかは assert-links.mjs の STAMPS が見る）。 */
    const at = (f) => html.search(new RegExp('(?:src|href)="[^"]*' + f.replace('.', '\\.')
      + '(?:\\?v=[0-9a-f]+)?"'));
    ok(at('pay-viz.css') >= 0 && at('pay-viz.js') >= 0, `${name}: pay-viz を読んでいる`);
    ok(at('deep-pay.js') >= 0 && at('deep-pay.css') >= 0, `${name}: deep-pay.js と deep-pay.css を読んでいる`);
    ok(at('pay-viz.js') < at('deep-pay.js'), `${name}: pay-viz.js は deep-pay.js より前`);
    ok(at('pv-gates.js') < at('deep-pay.js'), `${name}: pv-gates.js は deep-pay.js より前`);
    ok(/<link\s+rel="icon"/.test(html), `${name}: favicon を宣言している`);
    ok(/fonts\.googleapis\.com\/css2/.test(html), `${name}: Inter を読んでいる`);
    ok(/<title>[^<]+<\/title>/.test(html), `${name}: title が空でない`);
  }
  /* ★.pt-* / .mv-* をトップレベルで再定義しない（db/test-form-contract.mjs が見ている）。
     上書きは必ず器（#dp-comp / #dp-root）で囲む。 */
  const top = (cssC.match(/^\s*\.(pt|mv)-[\w-]+\s*[,{]/gm) || []);
  ok(top.length === 0, '★.pt-* / .mv-* をトップレベルで書き換えていない', top.join(' '));
}

// ════════════════════════════════════════════════════════════════
// ⑧ 通貨（静的側）
// ════════════════════════════════════════════════════════════════
console.log('\n════ ⑧ 通貨 ════');
{
  for (const [name, raw] of [['ja', JA], ['en', EN]]) {
    const html = nohtmlcomment(raw);
    ok(/<div class="pv-no-cur" id="dp-root">/.test(html),
       `${name}: ★pv-no-cur は #dp-root に付いている（自動走査を止める場所は1つ）`);
    ok((html.match(/pv-no-cur/g) || []).length === 1,
       `${name}: ★pv-no-cur は1つだけ`);
  }
  ok(/addEventListener\('pv-currency-change'/.test(jsC), '通貨の切替を聞いている');
  /* 切替で引き直さないことは、下のブラウザ検査が実際に数えて確かめる。 */
}

// ════════════════════════════════════════════════════════════════
// ⑨ SQL の権限
// ════════════════════════════════════════════════════════════════
console.log('\n════ ⑨ SQL の権限 ════');
{
  const revoke = SQL.indexOf('revoke all on function public.pv_deep_pay(jsonb) from public, anon;');
  const grant  = SQL.indexOf('grant execute on function public.pv_deep_pay(jsonb) to authenticated;');
  ok(revoke >= 0, 'pv_deep_pay(jsonb) を public と anon から revoke している');
  ok(grant  >= 0, 'pv_deep_pay(jsonb) を authenticated に grant している');
  ok(revoke >= 0 && grant >= 0 && revoke < grant,
     '★revoke が grant より前（順番を入れ替えると誰も呼べなくなる）');

  /* 補助関数は誰にも開かない（security definer の中からだけ呼ぶ）。
     ★数を固定する。将来もう1本補助関数を足した人が、grant を忘れる側ではなく
       「revoke を書き忘れる」側で赤くなるように。
     ★2026-10-11 に pv_deep_step（見出しの数字を刻みに寄せる道具）が増えて3本、
       同じ日に pv_deep_missing（その1行でまだ答えていない項目を返す。見る資格の線）が
       増えて4本。⚠️ pv_deep_missing は引数が**表の行そのもの**なので、API からは
       「その表の計算列」に見える。grant を足した瞬間に外から届く（db/deep-pay.sql の 2-c 章）。 */
  const helpers = ['public.pv_my_keys()', 'public.pv_deep_pct(numeric[])',
                   'public.pv_deep_step(numeric, numeric)',
                   'public.pv_deep_missing(public.pay_reports)'];
  for (const h of helpers) {
    ok(SQL.includes(`revoke all on function ${h} from public, anon, authenticated;`),
       `★${h} は3ロールとも revoke（誰にも開かない）`);
    ok(!new RegExp('grant[^\\n]*' + h.replace(/[()[\]]/g, '\\$&')).test(SQL),
       `★${h} に grant が無い`);
  }
  /* ★ログイン済みに開く関数は pv_deep_pay の1本だけ。**名前で固定する。**
       本数だけ見ていると、1本消して別の1本を足した回に緑のまま通る。 */
  const opened = ['pv_deep_pay'];
  const created = (SQL.match(/create or replace function public\.(\w+)/g) || [])
    .map((s) => s.split('.').pop());
  const wantFns = helpers.map((h) => h.slice('public.'.length).split('(')[0]).concat(opened);
  ok(created.slice().sort().join(' ') === wantFns.slice().sort().join(' '),
     `★このファイルが作る関数は ${wantFns.length} 本（補助${helpers.length}＋開く1。増えたら権限も書く）`,
     created.join(' '));

  ok(!/\bto anon\b/.test(SQL), '★anon には何も渡していない');
  ok(/access_until/.test(SQL), '鍵（access_until）を見ている');
  /* ★pv_my_give は、いまは**門ではない**（2026-10-11）。前はここで「本人が内訳を
       出したか」を読んで門にしていた。門は pv_deep_missing の線（下の「見る資格」）へ
       移り、pv_my_give の答えは give としてそのまま画面へ返すだけになった
       （画面は give.detailed を PVGates.setProgress へ渡すが、あちらは 2026-10-11 から
        受け取るだけで何もしない ── 3段の表の DEEP PAY の札「N / 100人」を外したため）。 */
  ok(/v_give := public\.pv_my_give\(\);/.test(SQL) && /'give',\s+v_give,/.test(SQL),
     '本人の Give の状態（pv_my_give）を、そのまま give として返している（門はもう読まない）');

  /* ── 人数の壁（2026-10-11 に 3人 → 2人・オーナー判断）──────────────
     前は「>= 3 が8か所以上」を数えていた。壁の数字は関数の頭の定数 v_min の
     **1か所だけ**になり、本文の比較は全部その名前で書いてある。見るのは形：
       ① 定数の宣言が字面どおり1つ在る
       ② pv_deep_pay の本文に「>= v_min」が十分に在る（区分・列・項目ごとの門）
       ③「< v_min」はちょうど1つ（thin ＝ 返り値そのものを伏せる最後の壁）
       ④ 本文に、人数を**裸の 2 や 3 と比べる**行が無い（定数を素通りする門を作らない）
     ⚠️ コメントを落としてから見る。SQL のコメントは壁の説明で数字を何度も書いている。
     ⚠️ ここを「>= 2 が在ること」に緩めない。直書きを許した瞬間に、定数だけ直して
        門の半分が古い人数のまま残る形ができる。 */
  const sqlC = SQL.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
  const fnBody = (name) => {
    const i = sqlC.indexOf('create or replace function public.' + name + '(');
    if (i < 0) return '';
    const j = sqlC.indexOf('$fn$;', i);
    return j < 0 ? '' : sqlC.slice(i, j);
  };
  const dpBody = fnBody('pv_deep_pay');
  ok(dpBody.length > 0, 'pv_deep_pay の本文が切り出せる');
  ok((dpBody.match(/v_min constant int := 2;/g) || []).length === 1,
     '★人数の壁は定数 v_min の1か所（v_min constant int := 2;）');
  const ge = (dpBody.match(/>=\s*v_min\b/g) || []).length;
  const lt = (dpBody.match(/<\s*v_min\b/g) || []).length;
  /* 2026-10-11 の実数は 50（db/deep-pay.sql の自己点検 9 と同じ数）。増えるのは構わない。
     減ったら、どこかの門を1つ外したということ ── 数を下げて通さず、外した門を見る。 */
  ok(ge >= 50, `★「>= v_min」の門が区分・列・項目ごとに在る（今 ${ge} か所）`);
  ok(lt === 1, `★「< v_min」は thin の1か所だけ（今 ${lt} か所）`);
  const bare = dpBody.match(/[^\n]{0,40}[<>]=?\s*[23]\b[^\n]{0,20}/g) || [];
  ok(bare.length === 0, '★本文に、人数を裸の 2 や 3 と比べる行が無い（壁は v_min だけ）',
     bare.map((s) => s.trim()).join(' / '));

  /* ★人数を返さない（2026-10-11）。隠すのではなく、最初から渡さない。
       返り値のキーは jsonb_build_object の中で 'name', の形で出る。 */
  for (const k of ['n', 'detailed_n', 'verified_n']) {
    ok(!new RegExp("'" + k + "'\\s*,").test(dpBody),
       `★pv_deep_pay が人数のキー '${k}' を返さない`);
  }
  ok(/'trust'\s*,/.test(dpBody) && /'crowd'\s*,/.test(dpBody),
     '★代わりに信頼度の段（cohort.trust）と、みんなの側の門（gate.crowd）を返す');

  /* ── 見る資格（2026-10-11・オーナー判断「ぜんぶ答えた人にだけ開く」）──────
     画面（錠前の板）が読むのは gate の ready と todo。**前の鍵 detailed は gate に無い。**
     ★ここは「画面が読む形」の見張り。門の中身（どの欄をどう読むか）は SQL の
       自己点検 25〜30 と db/test-deep-pay.mjs が見ている（30 は 2026-10-11 に足した
       「公開より前に内訳の3つに答えていた人は開いたまま」。自己点検の表はいま30行）。
     ⚠️ gate の中へ detailed を足し戻さない。画面はもう読まないので、戻しても
        何も赤くならないまま「内訳が1つでもあれば開く」と読める鍵が外へ出る。
        （返り値のいちばん外の give.detailed は別物 ── pv_my_give の答えで、今も返る。） */
  const gateObj = (/'gate',\s*jsonb_build_object\(([\s\S]*?)\),\s*'give',/.exec(dpBody) || ['', ''])[1];
  ok(gateObj.length > 0, 'gate の jsonb_build_object が切り出せる');
  ok(/'ready',\s+v_rdy,/.test(gateObj) && /'todo',\s+v_todo,/.test(gateObj),
     "★gate は 'ready'（門と同じ値 v_rdy）と 'todo'（残っている項目）を返す",
     gateObj.replace(/\s+/g, ' ').slice(0, 160));
  ok(!/'detailed'/.test(gateObj),
     "★gate の中に前の鍵 'detailed' が無い（「内訳が1つでもある」は、もう門ではない）");
  ok((gateObj.match(/'(\w+)'\s*,/g) || []).map((s) => s.replace(/[^\w]/g, '')).join(' ')
       === 'key ready todo crowd contributors goal',
     '★gate の鍵は key / ready / todo / crowd / contributors / goal の6つだけ（金額も会社も足さない）',
     (gateObj.match(/'(\w+)'\s*,/g) || []).join(' '));
  ok(/v_open := v_key and v_rdy and v_crd;/.test(dpBody),
     '★門の式は 鍵・答えきったか・みんなの側 の3つ（v_key and v_rdy and v_crd）');

  /* ★旧 pv_pay_comp を触らない（assert-pay-rows.mjs が本文を grep している）。 */
  ok(!/create or replace function public\.pv_pay_comp/.test(SQL),
     '★旧 pv_pay_comp を作り直していない');
  /* 返り値のキーは jsonb_build_object の中で 'name', の形で出る。
     列としての参照（where created_at >= …）は正しい使い方なので数えない。 */
  for (const k of ['period_month', 'created_at', 'airline_other', 'proof_hash']) {
    ok(!new RegExp("'" + k + "'\\s*,").test(SQL),
       `★${k} を返り値のキーにしていない（準識別子）`);
  }
}

// ════════════════════════════════════════════════════════════════
// ⑩ 登録の足並み（1つ忘れても何も赤くならない穴を1枚ぶん塞ぐ）
// ════════════════════════════════════════════════════════════════
console.log('\n════ ⑩ ページ登録 ════');
{
  /* ★CLAUDE.md の「ページを1枚足すとき」の表。同じ集合が4つあり、1つ忘れると
     sitemap と robots が食い違うのに何も赤くならない。DEEP PAY は2枚あるので
     **2枚とも回す** ── 概要だけ登録して比較を忘れる、が一番起きやすい。 */
  const lists = [
    ['gen-sitemap.mjs',     'NOINDEX'],
    ['seo-normalize.mjs',   'NOINDEX と COPY'],
    ['assert-seo.mjs',      'NOINDEX'],
    ['assert-links.mjs',    'APPFLOW'],
    ['assert-founding.mjs', '除外リスト']
  ];
  for (const page of ['deep-pay.html', 'deep-pay-compare.html']) {
    for (const [f, what] of lists) {
      ok(read(f).includes("'" + page + "'"), `${f} の ${what} に ${page} が入っている`);
    }
    ok(new RegExp("'" + page.split('.').join('\\.') + "':\\s*\\{").test(read('seo-normalize.mjs')),
       `★seo-normalize.mjs の COPY に ${page} の日英 t/d が在る（noindex でも <title> は出る）`);
    ok(read('lang-toggle.js').includes(page),
       `lang-toggle.js の EN_PAGES に ${page} が入っている（gen-en-manifest.mjs の生成物）`);
  }
}

// ════════════════════════════════════════════════════════════════
// ⑪ 錠前の板のボタンの行き先（2026-10-11）
// ════════════════════════════════════════════════════════════════
/* 板の入口はボタン1本。足りない物に合わせて、給与フォームの「どこから始めるか」を変える
   （鍵が無く答えきってもいない → フォームの頭／鍵だけ切れた → #ps／
     鍵は在るが答えきっていない → #pay-detail）。
   足りない項目はこの画面では聞かない ── 給与フォームで足してもらう（オーナー判断）。
   ここは字だけ。画面に出た行き先は、下のブラウザの §2b が門の組み合わせごとに見る。 */
console.log('\n════ ⑪ 錠前の板のボタンの行き先 ════');
{
  /* ★板のボタンの行き先は lockHref() の1か所。足りない物に合わせて変える。 */
  ok(/function lockHref\(gate\)/.test(jsC)
     && /'pay-report\.html#pay-detail'/.test(jsC) && /'pay-report\.html#ps'/.test(jsC),
     '★板のボタンの行き先（lockHref）が、フォームの頭／#ps／#pay-detail の3つを持つ');
  /* ★2026-10-11 まで、突き合わせる相手は pv-gates.js の DETAIL_URL だった（公開前の
       説明の「給与内訳を追加する」）。あの説明ごと外したので、いま同じ住所を持つのは
       REAL PAY の「報酬の内訳の門」（actual-pay.js）。 */
  ok(/DETAIL_URL = 'pay-report\.html#pay-detail'/.test(read('actual-pay.js')),
     '「内訳の節」の住所が actual-pay.js の DETAIL_URL と同じ');
  /* ★行き先の2つは、給与フォームに**本当に在る**住所（日英とも）。フォームが id を
       変えると、ボタンはフォームの頭へ落ちるだけで何も赤くならない。 */
  for (const f of ['pay-report.html', 'en/pay-report.html']) {
    const h = nohtmlcomment(read(f));
    ok(/<details class="pay-detail" id="pay-detail">/.test(h) && /\bid="ps"/.test(h),
       `${f}: ★行き先の #pay-detail と #ps が給与フォームに在る`);
  }
  /* ★前の門（内訳が1つでもあるか）を読む道が、板のどこにも残っていない（2026-10-11）。
       サーバは gate.detailed を名前ごと外した。読む行が残っていると、値が無い＝
       「内訳が無い」と読んで、答えきった人にも古い頼みごとを出す。
     ⚠️ give.detailed は別物（pv_my_give の答え。load() が PVGates.setProgress へ渡す ──
        あちらは 2026-10-11 から受け取るだけで何もしない）。
        だから語を丸ごと禁じず、**門の入れ物から読む形**だけを禁じる。 */
  ok(!/\bg\.detailed\b|\bgate\.detailed\b/.test(jsC) && !/\blockDet\b/.test(jsC),
     '★板が前の鍵（gate.detailed）も前の行（lockDet）も持たない');
  ok(/g\.ready !== true/.test(jsC) && /g\.ready === true/.test(jsC),
     '★答えきったかは gate.ready を「=== true」で読む（値が無い古いサーバを開いている側へ倒さない）');
  ok(/detailed:\s*\(v && v\.give\) \? v\.give\.detailed : null/.test(jsC),
     'PVGates.setProgress へ渡すのは今までどおり give.detailed（門の値ではない。受け手はもう何もしない）');
}

// ════════════════════════════════════════════════════════════════
// ⑫ 「まだ答えていない項目」の名前は、給与フォームの見出しと同じ字（2026-10-11）
// ════════════════════════════════════════════════════════════════
/* 板は、足りない項目を**給与フォームの言葉で**並べる。板で読んだ名前を、フォームで
   そのまま探せることが要 ── 板が「住宅手当」と言い、フォームの欄が「住居」だと、
   読んだ人はその欄を見つけられない。
   ★表は deep-pay.js の todoNames()（deep-pay-compare.js にも同じ本体。写しのずれは
     assert-deep-pay-compare.mjs の ④）。ここは**フォームの HTML から見出しを切り出して**、
     表の字と1文字ずつ突き合わせる。フォームの見出しを変えた人は、ここで赤くなる。
   ★コードの集合と並びは db/deep-pay.sql の pv_deep_missing の array[…] が正。
     表に無いコードは板に出ない（黙って抜ける）ので、**集合が同じこと**もここで見る。
   ⚠️ 見出しから落とすのは「必須」「任意」の札（.req-tag / .opt-tag）だけ。
      ここで字をならして通さない（全角半角・前後の空白もそのまま比べる）。 */
console.log('\n════ ⑫ まだ答えていない項目の名前 ⇄ 給与フォーム ════');
{
  /* deep-pay.js から todoNames() の本体を切り出して、そのまま評価する
     （表を検査の側へ書き写さない。写すと、写しが合っているだけの検査になる）。 */
  const cut = (src, name) => {
    const m = new RegExp('^  function ' + name + '\\(([^)]*)\\) \\{', 'm').exec(src);
    if (!m) return '';
    let d = 0, j;
    for (j = m.index + m[0].length - 1; j < src.length; j++) {
      if (src[j] === '{') d++;
      else if (src[j] === '}') { d--; if (d === 0) break; }
    }
    return src.slice(m.index, j + 1);
  };
  const fnSrc = cut(JS, 'todoNames');
  ok(fnSrc.length > 0, 'deep-pay.js の todoNames() が切り出せる');
  const namesOf = (lang) => {
    try { return new Function('L', fnSrc + '\nreturn todoNames();')(lang) || null; }
    catch (e) { return null; }
  };
  const N = { ja: namesOf('ja'), en: namesOf('en') };
  ok(!!(N.ja && N.en && N.ja.item && N.ja.role && N.en.item && N.en.role),
     'todoNames() が日英とも表を返す');

  /* コード → フォームのどの欄の見出しか。★変動給だけは欄が行の集まりなので、
     見出しは合計の隠し欄（#f-var-sum）の <label> に付いている。 */
  const FIELD = {
    base: 'f-base', guarantee: 'f-guarantee', variable: 'f-var-sum', command: 'f-command',
    perdiem: 'f-perdiem', housing: 'f-housing', bonus: 'f-bonus', profit: 'f-profit',
    block: 'f-block', duty_h: 'f-duty-h', duty_days: 'f-duty', stay: 'f-stay', roles: 'f-jobrole'
  };
  const ROLES = ['instructor', 'examiner', 'union', 'management', 'nonline'];
  /* <label class="form-label" for="…">見出し<span class="req-tag">必須</span></label>
     から、札を落として字だけにする。 */
  const labelOf = (html, id) => {
    const m = new RegExp('<label class="form-label" for="' + id + '">([\\s\\S]*?)</label>').exec(html);
    if (!m) return null;
    return m[1].replace(/<span class="(?:req|opt)-tag">[^<]*<\/span>/g, '')
               .replace(/<[^>]+>/g, '');
  };
  /* <label class="rolebox"><input type="checkbox" name="f-jobrole" value="…"><span>字</span> */
  const roleOf = (html, code) => {
    const m = new RegExp('<input type="checkbox" name="f-jobrole" value="' + code
      + '"><span>([^<]*)</span>').exec(html);
    return m ? m[1] : null;
  };

  /* サーバが返しうるコードの集合と並び（pv_deep_missing の then '…' end を上から）。 */
  const missBody = (SQL.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')
    .match(/create or replace function public\.pv_deep_missing\([\s\S]*?\$fn\$;/) || [''])[0];
  const sqlCodes = [...missBody.matchAll(/then\s+'(\w+)'\s+end/g)].map((m) => m[1]);
  ok(sqlCodes.join(' ') === Object.keys(FIELD).concat(ROLES).join(' '),
     '★pv_deep_missing が返すコードは18個・この並び（増えたら表とこの検査に足す）',
     sqlCodes.join(' '));

  for (const [lang, file] of [['ja', 'pay-report.html'], ['en', 'en/pay-report.html']]) {
    const form = nohtmlcomment(read(file));
    const T2 = N[lang] || { item: {}, role: {}, sfx: '' };
    ok(Object.keys(T2.item).join(' ') === Object.keys(FIELD).join(' ')
       && Object.keys(T2.role).join(' ') === ROLES.join(' '),
       `${lang}: ★表のコードはサーバが返す集合と同じ（抜けも余りも無い）`,
       Object.keys(T2.item).concat(Object.keys(T2.role)).join(' '));
    for (const code of Object.keys(FIELD)) {
      const want = labelOf(form, FIELD[code]);
      ok(want != null && want.length > 0 && T2.item[code] === want,
         `${lang}: ★${code} ＝ フォームの #${FIELD[code]} の見出し「${want}」と同じ字`,
         `表「${T2.item[code]}」`);
    }
    for (const code of ROLES) {
      const want = roleOf(form, code);
      ok(want != null && want.length > 0 && T2.role[code] === want,
         `${lang}: ★${code} ＝ フォームの役職・区分の箱「${want}」と同じ字`,
         `表「${T2.role[code]}」`);
    }
    ok(typeof T2.sfx === 'string' && T2.sfx === (lang === 'ja' ? 'の手当' : ' allowance'),
       `${lang}: 役割の名前に足す語は「${lang === 'ja' ? 'の手当' : ' allowance'}」`, JSON.stringify(T2.sfx));
    /* ★2026-10-11、板の1行目から「支給が無い項目は「該当なし」か 0 で答えます。」を外した
         （オーナー指示「文言不要」）。板はもうフォームの「該当なし」の札の字を引いていない。 */
  }
}

// ════════════════════════════════════════════════════════════════
// ⑬ 開いた瞬間のクラッカー（字面）
// ════════════════════════════════════════════════════════════════
/* 2026-10-11・オーナー指示 ── 閉じた板を見ていた会員が給与の詳細を出して、画面が開いたら
   「クラッカーならしてね」。紙吹雪を1回だけ飛ばす（deep-pay.js の「開いた瞬間のクラッカー」の節）。
   ここは字面で見る。実際に出る・出ない・押せる・片づくは、下のブラウザの節（§2f）。
   見るのは6つ：
     a) 乱数も時刻も使わない（番号だけで決める ＝ ③ の「作り物を置かない」と同じ網の中）。
        音を出さない。canvas も外のスクリプトも使わない。
     b) 動かすのは transform と opacity だけ（Web Animations API）。ぼかし・filter・
        transition を持たない。CSS には置き場所と紙の形しか無い（動きも色も書かない）。
     c) 印（端末の保存領域の鍵1つ）は**飾り**。書くのは partyMark()・読んで消すのは
        partyDue() の2か所だけで、板・門・左メニューの側は名前も知らない。
        クラッカーの側から門の鍵へは1つも書かない。置くのは uid ではなく指紋。
     d) 保存領域に触る行は、ぜんぶ try の中。
     e) 鳴らす前に印を消す。「動きを減らす」設定は、消したあと・器を作る前に見る。
     f) 紙は空の <i> だけ（字・数字・押せるものが無い）。色は COL と --pv-accent を名前で渡す。
   ⚠️ a) の乱数の禁止を「クラッカーは飾りだから」と緩めない。緩めると、同じ道具が
      影絵や数字の側へ持ち込まれた日に赤くならない。 */
console.log('\n════ ⑬ 開いた瞬間のクラッカー（字面）════');
{
  const PARTY = ['partyKey', 'partyWho', 'partyMark', 'partyDue', 'partyBit', 'partySpec',
                 'partyHtml', 'partyFire', 'partyPop'];
  const KEY = 'pv_deep_was_locked';
  const src = {};
  for (const n of PARTY) src[n] = cutFn(JS, n);
  ok(PARTY.every((n) => src[n].length > 0), 'クラッカーの関数が9つとも切り出せる',
     PARTY.filter((n) => !src[n]).join(' '));
  const bare = {};
  for (const n of PARTY) bare[n] = decomment(src[n]);
  const all = PARTY.map((n) => bare[n]).join('\n');
  /* クラッカーの節を抜いた残り（板・門・描き手・起動）。 */
  let rest = jsC;
  for (const n of PARTY) rest = rest.split(bare[n]).join(' ');
  const css = decomment(read('deep-pay.css'));
  const count = (re, s) => (s.match(re) || []).length;

  // ── a) 乱数・時刻・音・外の道具 ──
  ok(!/Math\.random|\bcrypto\b|\bDate\b|performance\s*\./.test(all),
     '★★クラッカーは乱数も時刻も使わない（番号だけで決める）');
  const SOUND = /\bAudio\s*\(|<audio|AudioContext|speechSynthesis|\.play\s*\(\s*\)|\.(?:mp3|wav|ogg|m4a)\b/i;
  ok(!SOUND.test(jsC) && !SOUND.test(css) && !SOUND.test(nohtmlcomment(JA)) && !SOUND.test(nohtmlcomment(EN)),
     '★★音を出さない（JS・CSS・HTML のどこにも音の道具が無い）');
  ok(!/canvas|getContext|\bfetch\b|\brpc\b|XMLHttpRequest|\bimport\b|\bsrc\b|\bhref\b|<script|<img|<svg/i.test(all)
     && count(/createElement\(/g, all) === 1 && /d\.createElement\('div'\)/.test(all),
     '★canvas も外のスクリプトも画像も使わない（作る要素は器の div 1つ）');

  // ── b) 動かすのは transform と opacity だけ ──
  ok(!/filter\s*[:=]|blur|backdrop|\bmask\b|clip-?path/i.test(all),
     '★★クラッカーの字面に filter / blur / mask が無い（ぼかしてよいのは影絵だけ）');
  ok(!/transition|@keyframes|animation\s*:/i.test(all) && !/\.style\b/.test(all),
     '★クラッカーは transition も CSS の animation も style の直書きも使わない');
  ok(!/transition\s*:\s*all|transition-all/.test(css) && !/transition\s*:\s*all|transition-all/.test(jsC),
     '★transition:all を使っていない（CSS・JS）');
  {
    const fire = bare.partyFire;
    const calls = [...fire.matchAll(/\.animate\(\[([\s\S]*?)\],\s*t\);/g)].map((m) => m[1]);
    const keys = [...new Set(calls.join('\n').replace(/'[^']*'/g, "''").match(/\b[a-zA-Z]+(?=\s*:)/g) || [])].sort();
    ok(calls.length === 3 && count(/\.animate\(/g, all) === 3,
       '★紙1枚の動きは3本（落ちる・飛ぶ・舞う）。動かす道は Element.animate だけ', String(calls.length));
    ok(keys.join(' ') === 'easing offset opacity transform',
       '★★キーフレームに書くのは transform と opacity だけ（ほかは easing と offset）', keys.join(' '));
    /* easing の字（'cubic-bezier(…)'）は落としてから、transform の関数名だけを拾う。 */
    const fns = [...new Set((calls.join('\n').replace(/'cubic-bezier\([^']*\)'/g, "''")
      .match(/\b[a-zA-Z]+(?=\()/g) || []))].sort();
    ok(fns.join(' ') === 'rotate rotateX scale translateX translateY',
       '★transform の中身は translate / rotate / scale だけ（位置や寸法の指定を動かさない）', fns.join(' '));
    ok(/var t = \{ duration: s\.dur, delay: s\.wait, fill: 'both' \};/.test(fire),
       '★長さと出だしは partySpec() の答えから（終わったあとも見えない状態で止まる ＝ fill:both）');
    /* 寸法を読むのは、器を置くより前に1回だけ（読み書きを交互にしない）。 */
    const READ = /getBoundingClientRect|getComputedStyle|\boffset(?:Width|Height|Top|Left)\b|\bscroll(?:Width|Height|Top|Left)\b|\bclient(?:Width|Height)\b|\binner(?:Width|Height)\b/g;
    const reads = [...fire.matchAll(READ)].map((m) => m.index);
    ok(count(/getBoundingClientRect/g, fire) === 1 && reads.length === 3
       && Math.max(...reads) < fire.indexOf('lay.innerHTML') && fire.indexOf('lay.innerHTML') < fire.indexOf('appendChild'),
       '★寸法を読むのは器を置く前だけ（本文の箱を1回・窓の幅と高さ）。置いたあとは読まない',
       `読む行 ${reads.length}`);
    ok(/d\.body\.appendChild\(lay\)/.test(fire) && /lay\.className = 'dp-pop';/.test(fire)
       && /lay\.setAttribute\('aria-hidden', 'true'\);/.test(fire),
       '★器は body の直下に置く（本文の器の外 ＝ 描き直しで消えない・本文の字を変えない）。aria-hidden を付ける');
    ok(/catch \(e\) \{ gone\(\); return; \}/.test(fire) && /w\.setTimeout\(gone, last \+ \d+\);/.test(fire)
       && count(/setTimeout/g, jsC) === 1,
       '★器は終わったら外す（途中で投げた回もその場で外す）。タイマーはこの片づけの1本だけ');
    const m = /var count = wide < \d+ \? (\d+) : (\d+), half = count \/ 2/.exec(fire);
    ok(!!m && [m[1], m[2]].every((v) => Number(v) >= 60 && Number(v) <= 90 && Number(v) % 2 === 0),
       '★紙は 60〜90 枚（左右で半分ずつ）', m ? m[1] + ' / ' + m[2] : '見つからない');
  }
  {
    /* CSS ── 置き場所と紙の形だけ。 */
    const rules = [...css.matchAll(/([^{}]*\.dp-pop[^{}]*)\{([^{}]*)\}/g)];
    const lay = (css.match(/(?:^|\})\s*\.dp-pop\s*\{([^{}]*)\}/) || ['', ''])[1];
    const body = rules.map((r) => r[2]).join(';');
    ok(rules.length >= 5 && /position\s*:\s*fixed/.test(lay) && /inset\s*:\s*0/.test(lay)
       && /overflow\s*:\s*hidden/.test(lay) && /pointer-events\s*:\s*none/.test(lay),
       '★★器（.dp-pop）は fixed・画面いっぱい・はみ出しを切る・押せない', lay.trim().slice(0, 90));
    const z = Number((/z-index\s*:\s*(\d+)/.exec(lay) || [])[1]);
    ok(z > 200 && z < 240, '★器の重なりは、ヘッダー（200）より上・ナビの引き出し（240〜）より下', String(z));
    ok(!/transition|animation|filter|blur|opacity|visibility|content\s*:|#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|background/i.test(body),
       '★クラッカーの CSS に、動き・ぼかし・色・字（content）が無い（置き場所と形だけ）',
       (body.match(/[^;]*(?:transition|animation|filter|blur|opacity|visibility|content\s*:|#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|background)[^;]*/i) || [''])[0].trim());
    ok(/@media\s*\(prefers-reduced-motion\s*:\s*reduce\)\s*\{\s*\.dp-pop\s*\{\s*display\s*:\s*none\s*;?\s*\}\s*\}/.test(css),
       '★「動きを減らす」設定では、器が在っても出さない（CSS の重ね掛け）');
    ok(!/@keyframes/.test(css), '★deep-pay.css に @keyframes が無い（動きの出どころは JS の1か所）');
  }

  // ── c) 印は飾り ──
  ok(count(new RegExp(KEY, 'g'), jsC) === 1 && bare.partyKey.includes("'" + KEY + "'"),
     '★★印の鍵の名前を書くのは partyKey() の1か所だけ');
  ok(PARTY.filter((n) => n !== 'partyKey' && /\bpartyKey\(\)/.test(bare[n])).join(' ') === 'partyMark partyDue'
     && count(/\bpartyKey\(/g, jsC) === 3,
     '★★印に触るのは partyMark()（書く）と partyDue()（読んで消す）の2つだけ');
  ok(count(/[sS]torage/g, rest) === 0 && count(/localStorage/g, all) === 3
     && count(/sessionStorage|indexedDB|document\.cookie/g, jsC) === 0,
     '★保存領域に触る行は、クラッカーの2つの関数の中にしか無い（板・門・描き手は触らない）',
     `外 ${count(/[sS]torage/g, rest)} / 中 ${count(/localStorage/g, all)}`);
  ok(count(/\.setItem\(/g, jsC) === 1 && /w\.localStorage\.setItem\(partyKey\(\), S\.who\)/.test(bare.partyMark),
     '★★書くのは印の1つだけ・中身は指紋（S.who）');
  ok(!/pv_salary_unlock_expiry|pv_unlock_expiry|pv_user|pv_pay_|access_until|PVGates|PVUnlock|PVSession|\bgate\b|\bsb-/.test(all),
     '★★クラッカーの側から、門の鍵にも門の道具にも触らない（書かない・読まない）');
  ok(/session\.user\.id/.test(bare.partyWho) && /P\.fp\(id\)/.test(bare.partyWho) && /w\.PVPayLocal/.test(bare.partyWho)
     && !/\buid\b|\bemail\b/.test(all) && count(/session/g, all) === count(/session/g, bare.partyWho),
     '★置くのは uid ではなく指紋（pv-session.js の PVPayLocal.fp を借りる。2つ目の畳み方を作らない）');
  ok(count(/\bS\.who\b/g, rest) === 1 && /S\.who = partyWho\(session\);/.test(rest)
     && count(/\bS\.popped\b/g, rest) === 0 && count(/\bpartyWho\(/g, jsC) === 2,
     '★指紋（S.who）を入れるのは起動の1行・読むのはクラッカーだけ。S.popped も外では読まない');
  /* 板・門・描き手が、印もクラッカーの状態も読まない。 */
  for (const n of ['lockLines', 'lockHref', 'todoNames', 'todoMonth', 'lockTodo', 'lockHtml', 'lockStage',
                   'lockBoard', 'anonGate', 'authLost', 'load', 'picker', 'head', 'kpis', 'comp', 'work',
                   'vari', 'more', 'ask', 'thin', 'ghostShapes', 'ghostTint']) {
    const c = decomment(cutFn(JS, n));
    ok(c.length > 0 && !/\bparty[A-Z]\w*|\bS\.(?:who|popped)\b|[sS]torage/.test(c),
       `★${n}() は印もクラッカーの状態も読まない`);
  }
  /* 呼ぶ場所。鳴らすのは「開いている」枝の1か所・印を置くのは閉じた板を置いた直後の1か所。
     どちらも返り値を使わない（＝ 画面の描き分けに関わらない）。 */
  ok(count(/\bpartyPop\(/g, jsC) === 2
     && /if \(S\.mode !== 'open'\)\s+\{ shut\('lock'\);\s+return; \}\s+partyPop\(\);/.test(jsC),
     '★★鳴らすのは render() の「開いている」枝だけ（閉じた画面・読み込めなかった画面・読み込み中は通らない）');
  ok(count(/\bpartyMark\(/g, jsC) === 2
     && /lockBoard\(box, lockStage\(\(S\.data && S\.data\.gate\) \|\| \{\}\)\);\s+partyMark\(\);\s+\}/.test(jsC),
     '★印を置くのは、閉じた板を置いた直後だけ（読み込めなかった画面では置かない）');
  /* ★ログインしていない人の板（2026-10-11）は、印を置く行より**前で戻る**。印は「閉じた板を
       見た会員」の控えで、あの板は会員の門を見て出したものではない ── ログインが切れた
       だけの会員には指紋が在るので、通すと、前から開いていた人がログインし直した日に鳴る。
       読み込めなかった画面（error）も同じく手前で戻る。 */
  {
    const sh = decomment(cutFn(JS, 'shut'));
    const e = sh.indexOf("if (kind === 'error')"), a = sh.indexOf("if (kind === 'anon')");
    const m = sh.indexOf('partyMark()');
    ok(e >= 0 && a > e && m > a
       && /if \(kind === 'anon'\) \{ lockBoard\(box, lockStage\(anonGate\(\)\)\); return; \}/.test(sh)
       && count(/\breturn;/g, sh.slice(a, m)) === 1,
       '★★ログインしていない人の板は、印を置く行の手前で戻る（端末に何も書かない）');
  }
  ok(count(/\bpartyDue\(/g, jsC) === 2 && count(/\bpartyFire\(/g, jsC) === 3
     && !/[=!(,?:&|]\s*party(?:Pop|Mark|Fire)\(/.test(jsC),
     '★partyDue() を呼ぶのは partyPop() だけ。partyPop / partyMark / partyFire の返り値は使わない');

  // ── d) e) 保存領域は try の中・消してから鳴らす・動きを減らす設定 ──
  ok(/try \{ w\.localStorage\.setItem\(partyKey\(\), S\.who\); \} catch \(e\) \{\}/.test(bare.partyMark)
     && /^  function partyMark\(\) \{\s+if \(!S\.who\) return;/.test(bare.partyMark),
     '★印を書く行は try の中。指紋が無い回は書かない');
  {
    const due = bare.partyDue;
    const t0 = due.indexOf('try {'), t1 = due.indexOf('} catch (e) { return false; }');
    const g = due.indexOf('localStorage.getItem'), r = due.indexOf('localStorage.removeItem');
    ok(t0 >= 0 && t0 < g && g < r && r < t1 && count(/localStorage/g, due) === 2,
       '★印を読む・消す行は try の中（投げた回は鳴らさない）');
    ok(r < due.indexOf('S.popped = true') && /if \(v == null\) return false;/.test(due)
       && /if \(!S\.who \|\| v !== S\.who \|\| S\.popped\) return false;/.test(due),
       '★★印は答えを出す前に消す。自分の指紋と違う印・指紋が無い回・もう鳴らした回は鳴らさない');
  }
  {
    const pop = bare.partyPop;
    const a = pop.indexOf('partyDue()'), b = pop.indexOf('prefers-reduced-motion: reduce'), c = pop.indexOf('partyFire(');
    ok(/^  function partyPop\(\) \{\s+if \(!partyDue\(\)\) return;/.test(pop) && a < b && b < c,
       '★★印を消す → 「動きを減らす」設定を見る → 器を作る、の順（設定の人も印は消える）');
    ok(/var calm = true;/.test(pop) && /catch \(e\) \{ calm = true; \}/.test(pop)
       && /if \(calm \|\| !d\.body \|\| typeof d\.body\.animate !== 'function'\) return;/.test(pop),
       '★設定が読めない回・Web Animations API が無いブラウザでは、器を作らない');
  }

  // ── a) の続き：番号だけで決まる（取り出して実行する。外の値を読めば ReferenceError）──
  {
    const run = (n, rx, ry, drop) => new Function(src.partyBit + '\n' + src.partySpec
      + '\nvar o = []; for (var i = 0; i < ' + n + '; i++) o.push(partySpec(i, ' + (n / 2) + ', '
      + rx + ', ' + ry + ', ' + drop + ')); return o;')();
    let A = null, B = null, why = '';
    try { A = run(84, 700, 420, 860); B = run(84, 700, 420, 860); } catch (e) { why = String(e && e.message); }
    ok(Array.isArray(A) && A.length === 84, '★★partySpec() は、番号と寸法のほかに何も読まずに答える', why);
    const S0 = A || [];
    ok(JSON.stringify(A) === JSON.stringify(B), '★★何度作っても同じ絵（同じ番号には同じ飛び方）');
    ok(S0.every((s) => Object.keys(s).sort().join(' ') === 'ang dur fall far flip size turn wait'
       && Object.values(s).every((v) => typeof v === 'number' && Number.isFinite(v))),
       '★1枚ぶんの答えは8つの数（向き・距離・落ち幅・長さ・出だし・回転2つ・大きさ）');
    ok(S0.every((s) => s.dur >= 2200 && s.dur + s.wait <= 2800 && s.wait >= 0),
       '★1枚は 2.2〜2.8 秒で終わる（出だしのずれを足しても 2.8 秒まで）',
       String(Math.max(0, ...S0.map((s) => s.dur + s.wait))));
    ok(S0.slice(0, 42).every((s) => s.ang >= -8 && s.ang <= 88)
       && S0.slice(42).every((s) => s.ang >= 92 && s.ang <= 188),
       '★左の角の紙は右下へ・右の角の紙は左下へ（外へは飛ばさない）');
    ok(S0.every((s) => s.far > 0 && s.far <= 700 && s.fall > 0 && s.fall <= 860),
       '★飛ぶ距離と落ちる幅は、渡した上限まで');
    const uniq = (k) => new Set(S0.map((s) => s[k])).size;
    ok(uniq('ang') >= 50 && uniq('far') >= 60 && uniq('fall') >= 60 && uniq('dur') >= 40
       && uniq('wait') >= 40 && uniq('turn') >= 60 && uniq('size') >= 30,
       '★向き・距離・落ち幅・長さ・出だし・回転・大きさが、紙ごとに散っている（同じ動きの紙が並ばない）',
       ['ang', 'far', 'fall', 'dur', 'wait', 'turn', 'size'].map((k) => k + ' ' + uniq(k)).join(' / '));
    /* 寸法を変えれば、扇の形だけが変わる（縦長の画面では深く）。 */
    let T = [];
    try { T = run(60, 234, 420, 860); } catch (e) {}
    ok(T.length === 60 && Math.max(...T.map((s) => s.far)) > 300
       && T.filter((s) => s.ang <= 20).every((s) => s.far <= 234 + 42),
       '★縦長の画面では、横へは幅なりに・下へは深く開く',
       String(Math.max(0, ...T.map((s) => s.far))));

    // ── f) 紙は空の <i> だけ ──
    let H = '';
    try { H = new Function(src.partyHtml + "\nreturn partyHtml(0, 84, ['var(--a)', 'var(--b)', 'var(--c)']);")(); }
    catch (e) { why = String(e && e.message); }
    ok(H.length > 400 && H.replace(/<[^>]*>/g, '') === '',
       '★★紙の HTML に字が1文字も無い（タグの外が空）', why || JSON.stringify(H.replace(/<[^>]*>/g, '').slice(0, 40)));
    ok(!/[0-9０-９¥$€£万%]/.test(H), '★紙の HTML に数字も通貨記号も無い（属性の中にも）',
       (H.match(/[^<>]{0,20}[0-9０-９¥$€£万%][^<>]{0,20}/) || [''])[0]);
    const tags = [...new Set([...H.matchAll(/<([a-z][\w-]*)/gi)].map((m) => m[1].toLowerCase()))].join(' ');
    ok(tags === 'i' && count(/<i class="dp-pop-p /g, H) === 84 && count(/<i class="dp-pop-f">/g, H) === 84,
       '★紙は3重の <i> だけ（押せるもの・読み込むものが無い）', tags);
    ok(!/\b(?:href|src|tabindex|contenteditable|on\w+|data-[\w-]+|id|title|alt)\s*=/i.test(H)
       && [...new Set((H.match(/\s([a-z-]+)=/g) || []).map((x) => x.trim()))].sort().join(' ') === 'class= style=',
       '★紙の属性は class と style だけ');
    ok([...new Set(H.match(/dp-pop-p--[a-z]/g) || [])].length === 4
       && [...new Set(H.match(/var\(--[a-z]\)/g) || [])].length === 3,
       '★形は4種類・色は渡した色を全部使う（番号の余りで回す）');
    ok(/Object\.keys\(COL\)/.test(bare.partyFire) && /k !== 'rest'/.test(bare.partyFire)
       && /'var\(--gh-' \+ k \+ '\)'/.test(bare.partyFire) && /'var\(--pv-accent\)'/.test(bare.partyFire)
       && /lay\.setAttribute\('style', ghostTint\(\)\)/.test(bare.partyFire)
       && !/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(all),
       '★色は給与構成の色（COL ＝ PVViz.SEG）と --pv-accent だけ。色の値を書かない・灰色（rest）は使わない');
  }

  /* ★2枚にまたがる見張り（会社比較の側には書かない ── 2か所で同じことを見ると、片方だけ
       緩めたときに気づけない）。印の名前を知っているのは、この2つの JS だけ。
       門の側（pv-gates.js・pv-session.js・pv-give-first.js …）は読みも書きもしない。 */
  const knows = readdirSync(ROOT).filter((f) => f.endsWith('.js') && read(f).includes(KEY)).sort();
  ok(knows.join(' ') === 'deep-pay-compare.js deep-pay.js',
     '★★印の名前を知っている JS は deep-pay.js と deep-pay-compare.js だけ（門の側は名前も知らない）',
     knows.join(' '));
}

// ════════════════════════════════════════════════════════════════
// ⑭ ログインしていない人を、ログイン画面へ送らない（字面。2026-10-11）
// ════════════════════════════════════════════════════════════════
/* オーナー判断 ── DEEP PAY には公開の入口が在る（REAL PAY の見出しのタブ。あちらは
   未ログインの人にも見える）。来た人をログイン画面へ送らず、「会員で、まだ開いていない人」と
   **同じ画面**（ぼかした影絵＋板）を出す。REAL PAY が未ログインの人に、ログインの壁では
   なく伏せた一覧を見せるのと同じ考え方。ここは字面。実物は下のブラウザの §2g。
   見るのは5つ：
     a) 送り先が消えた ── この画面（日英）の HTML に、人をよそへ運ぶ字が1つも無い。
        セッションの見張りは「在ればそれ・無ければ null」を返すだけ。
        （会社比較の2枚は assert-deep-pay-compare.mjs が同じ形で見る。）
     b) 聞く前に戻る ── boot() は、セッションが無ければ板を描いて戻る。その行は、指紋を取る行・
        預かり証の引き取り・pv_deep_pay() の**どれよりも前**に在る ＝ ログインしていない人の
        ために通信を1本も投げない（pv_deep_pay() は未ログインだと必ず落ちる）。
     c) 板は新しく書いていない ── anonGate() は引数も外の値も読まない固定の値で、
        取り出して本物の lockLines / lockHref に通すと「鍵の行＋答えの行・行き先は
        フォームの頭」になる。文言の表（T）に、この人たちのための字を足していない。
     d) サーバの答えの見分け（authLost）── 取り出して表で見る。「ログインしていない」と
        読むのは 42501 と HTTP 401 だけ。通信が切れた・サーバが落ちた・知らないエラーは
        今までどおり「読み込めませんでした」。
     e) 触らないもの ── 端末のログインの控え（サインアウトしない・消さない）・門の鍵・解析。
   ⚠️ d) を「エラーなら全部、板」へ緩めない。通信が悪いだけの会員に「給与を出してください」
      と頼むことになる。 */
console.log('\n════ ⑭ ログインしていない人（字面）════');
{
  const count = (re, s) => (s.match(re) || []).length;

  // ── a) 送り先が消えた ──
  /* ★HTML のコメントと、inline の JS のコメントの両方を落としてから見る（「前は
       login.html?redirect=… へ送っていた」という説明を、わざと残してある）。 */
  for (const [name, raw] of [['ja', JA], ['en', EN]]) {
    const bare = decomment(nohtmlcomment(raw));
    ok(!/login\.html\?redirect|encodeURIComponent/.test(bare),
       `${name}: ★★ログイン画面へ送る行（login.html?redirect=…）が、HTML から消えている`);
    ok(!/\blocation\b|history\s*\.\s*(?:pushState|replaceState|back|go)\b|window\.open\s*\(|http-equiv\s*=\s*["']?refresh/i.test(bare),
       `${name}: ★★HTML に、人をよそへ運ぶ字（location・history・window.open・meta refresh）が1つも無い`,
       (bare.match(/[^\n]*(?:\blocation\b|history\s*\.|window\.open|http-equiv)[^\n]*/i) || [''])[0].trim().slice(0, 90));
    ok(/window\.PV_SESSION = \(async function \(\) \{\s*const \{ data: \{ session \} \} = await sb\.auth\.getSession\(\);\s*return session \|\| null;\s*\}\(\)\);/.test(bare),
       `${name}: ★セッションの見張りは「在ればそれ・無ければ null」を返すだけ（分かれ道を持たない）`);
    /* ログイン画面の住所が出てくるのは、左メニューの「ログイン」の1本だけ（前から在る）。 */
    ok(count(/login\.html/g, bare) === 1
       && /<a class="mr-side-sub" id="pv-anav-login" data-pv-auth="out" href="login\.html">/.test(bare),
       `${name}: ログイン画面の住所は、左メニューの「ログイン」の1本だけ（足していない）`,
       String(count(/login\.html/g, bare)));
  }
  /* ★2026-10-12、location という字が1つ入った ── compareOpen() が location.hostname を**読む**
       （手元の確認用サーバかどうかの見分け。運ぶ字ではない）。その関数の字は
       assert-deep-pay-compare.mjs の ⓪ が固定しているので、ここでは**その関数だけを抜いて**
       から、今までどおり見る。
       ⚠️ 「location.hostname なら可」のように字で緩めない（別の関数に書いた日に通ってしまう）。 */
  {
    const openC = decomment(cutFn(JS, 'compareOpen'));
    const rest = openC ? jsC.replace(openC, () => ' ') : jsC;
    ok(openC.length > 0 && count(/\blocation\b/g, jsC) === 1 && count(/\blocation\b/g, openC) === 1
       && /w\.location\.hostname\b/.test(openC)
       && !/\blocation\b|history\s*\.|window\.open\s*\(/.test(rest),
       '★★deep-pay.js は、人をよそへ運ばない（location・history・window.open という字が無い。'
       + '在るのは compareOpen() が hostname を読む1つだけ）',
       `location の字 ${count(/\blocation\b/g, jsC)} 個`);
  }

  // ── b) 聞く前に戻る ──
  const bootC = decomment(cutFn(JS, 'boot'));
  const at = (s) => bootC.indexOf(s);
  const gone = at("if (!session) { S.mode = 'anon'; render(); return; }");
  ok(gone > at('ready.then(function (session) {') && at('ready.then(function (session) {') >= 0,
     '★★boot() は、セッションが無ければ板を描いて戻る（S.mode を anon にして render）',
     String(gone));
  ok(gone >= 0 && gone < at('S.who = partyWho(session);') && gone < at('PVClaimPending')
     && gone < at('load(client)') && at('load(client)') > 0 && at('PVClaimPending') > 0,
     '★★その行は、指紋を取る行・預かり証の引き取り・pv_deep_pay() のどれよりも前（聞く前に戻る）');
  ok(count(/\bload\(client\)/g, bootC) === 1 && count(/\.rpc\b/g, bootC) === 1 && /if \(!client \|\| !client\.rpc\)/.test(bootC),
     '★boot() の中で pv_deep_pay() へ行く道は load(client) の1本だけ（その手前に、戻る行が在る）');
  /* anon になる道は2つだけ ── 聞かずに決まる boot() と、サーバが「ログインしていない」と
     答えた load()。描く側は render() の1行で、「開いている」枝（クラッカー）より前。 */
  const loadC = decomment(cutFn(JS, 'load'));
  const rendC = decomment(cutFn(JS, 'render'));
  ok(count(/'anon'/g, jsC) === 5 && count(/S\.mode = 'anon'/g, bootC) === 1
     && /if \(res && res\.error\) \{ S\.mode = authLost\(res\) \? 'anon' : 'error'; render\(\); return; \}/.test(loadC),
     '★anon になる道は2つだけ（boot ＝ 聞かずに決まる／load ＝ サーバが「ログインしていない」と答えた）',
     `'anon' の字 ${count(/'anon'/g, jsC)} 個`);
  ok(/if \(S\.mode === 'anon'\)\s+\{ shut\('anon'\);\s+return; \}/.test(rendC)
     && rendC.indexOf("shut('anon')") < rendC.indexOf('partyPop()') && count(/shut\('anon'\)/g, jsC) === 1,
     '★描くのは render() の1行（shut(\'anon\')）で、「開いている」枝より前 ＝ クラッカーを通らない');
  ok(loadC.indexOf('authLost(res)') > 0 && loadC.indexOf('authLost(res)') < loadC.indexOf('PVGates.mark'),
     '★読み込めなかった回・ログインが切れていた回は、左メニューの錠前の控えを書き換える行より前で戻る');

  // ── c) 板は新しく書いていない ──
  const gateSrc = cutFn(JS, 'anonGate'), gateC = decomment(gateSrc);
  ok(/^  function anonGate\(\) \{ return \{ key: false, ready: false, todo: null, crowd: true \}; \}$/.test(gateC),
     '★★anonGate() は固定の値（鍵なし・答えきっていない・一覧なし・100人の行なし）。引数も外の値も読まない',
     gateC.replace(/\s+/g, ' ').slice(0, 100));
  ok(count(/\banonGate\(/g, jsC) === 2 && /lockStage\(anonGate\(\)\)/.test(decomment(cutFn(JS, 'shut'))),
     '★anonGate() を使うのは shut() の1か所だけ（会員の板の道には混ぜない）', String(count(/\banonGate\(/g, jsC)));
  {
    /* 作り物の門を、**本物の** lockLines / lockHref に通す（文言の表だけ、目印の字に替える）。 */
    let got = null, why = '';
    try {
      got = new Function('T', cutFn(JS, 'lockLines') + '\n' + cutFn(JS, 'lockHref') + '\n' + gateSrc
        + '\nvar a = anonGate(), b = anonGate();'
        + '\nreturn { lines: lockLines(a), href: lockHref(a), keys: Object.keys(a).sort().join(" "),'
        + ' fresh: a !== b, same: JSON.stringify(a) === JSON.stringify(b) };')(
        { lockKey: 'KEY', lockReady: 'READY', lockGoal: 'GOAL {goal} {n}' });
    } catch (e) { why = String(e && e.message); }
    ok(!!got && got.lines.join(' | ') === 'KEY | READY' && got.href === 'pay-report.html',
       '★★作り物の門を本物の道具に通すと、行は「鍵＋答え」・行き先は給与フォームの頭（#ps でも #pay-detail でもない）',
       why || JSON.stringify(got));
    ok(!!got && got.keys === 'crowd key ready todo' && got.fresh && got.same,
       '★門の入れ物は毎回あたらしく作る・中身はいつも同じ（人数の鍵 contributors / goal を持たない ＝ 100人の行は出ようが無い）',
       why || JSON.stringify(got));
  }
  /* 文言の表に、この人たちのための字を足していない（板の字は会員の板と同じ鍵から出る）。 */
  ok(!/log\s?in|sign\s?in|ログイン|サインイン|会員登録|sign\s?up/i.test(jsC),
     '★★deep-pay.js に「ログイン」「Log in」「会員登録」の字が1つも無い（板に文もリンクも足していない）',
     (jsC.match(/[^\n]*(?:log\s?in|sign\s?in|ログイン|サインイン|会員登録|sign\s?up)[^\n]*/i) || [''])[0].trim().slice(0, 90));
  {
    const keys = (lang) => {
      const m = new RegExp('\\n    ' + lang + ': \\{([\\s\\S]*?)\\n    \\}').exec(jsC);
      return m ? [...m[1].matchAll(/(?:^|[\s,{])(lock\w+):/g)].map((x) => x[1]).sort().join(' ') : '';
    };
    const WANT = 'lockCta lockGo lockGoal lockKey lockReady lockT lockTWait lockTodoH lockWarn';
    ok(keys('ja') === WANT && keys('en') === WANT,
       '★板の文言の鍵は今までの9つのまま（日英とも。ログインしていない人のための鍵を足していない）',
       keys('ja') + ' ／ ' + keys('en'));
  }

  // ── d) サーバの答えの見分け ──
  const lostSrc = cutFn(JS, 'authLost'), lostC = decomment(lostSrc);
  ok(count(/\bauthLost\(/g, jsC) === 2,
     '★authLost() を使うのは load() の1か所だけ', String(count(/\bauthLost\(/g, jsC)));
  ok(lostC.length > 0 && !/\b[SVTwd]\s*[.\[]|[sS]torage|PVGates|PVSession|\bsb\d?\b|\bfetch\b|\brpc\b|signOut/.test(lostC),
     '★authLost() は渡された答えを読むだけ（状態・保存領域・門・通信に触らない）');
  {
    /* [名前, サーバの答え, 「ログインしていない」と読むか] */
    const TABLE = [
      ['pv_deep_pay() が未ログインで投げた（42501・HTTP 401）',
       { data: null, error: { code: '42501', message: 'ログインが必要です' }, status: 401 }, true],
      ['符丁だけ（42501・HTTP 403）', { data: null, error: { code: '42501' }, status: 403 }, true],
      ['符丁が数で来た', { data: null, error: { code: 42501 } }, true],
      ['鍵の期限切れ（PGRST301・HTTP 401）', { data: null, error: { code: 'PGRST301', message: 'JWT expired' }, status: 401 }, true],
      ['HTTP 401 が字で来た', { data: null, error: { message: 'x' }, status: '401' }, true],
      ['通信が切れた（status 0）', { data: null, error: { message: 'TypeError: Failed to fetch', code: '' }, status: 0 }, false],
      ['サーバが落ちた（500）', { data: null, error: { code: 'XX000' }, status: 500 }, false],
      ['関数が無い（404）', { data: null, error: { code: 'PGRST202' }, status: 404 }, false],
      ['ほかの権限の符丁（403）', { data: null, error: { code: '42883' }, status: 403 }, false],
      ['符丁も番号も無い', { data: null, error: { message: 'synthetic failure' } }, false],
      ['似た字（425010）', { data: null, error: { code: '425010' }, status: 400 }, false],
      ['エラーが無い（答えは来ている）', { data: { state: 'locked' }, error: null, status: 200 }, false],
      ['エラーが無いのに 401', { data: null, error: null, status: 401 }, false],
      ['空の入れ物', {}, false],
      ['null', null, false],
      ['undefined', undefined, false]
    ];
    let bad = [], why = '';
    try {
      const fn = new Function(lostSrc + '\nreturn authLost;')();
      bad = TABLE.filter(([, res, want]) => fn(res) !== want).map(([name]) => name);
    } catch (e) { why = String(e && e.message); bad = ['実行できない']; }
    ok(bad.length === 0,
       `★★authLost() の表（${TABLE.length} 通り）──「ログインしていない」と読むのは 42501 と HTTP 401 だけ`,
       why || bad.join(' ／ '));
  }

  // ── e) 触らないもの ──
  ok(!/\.auth\b|signOut|refreshSession|setSession/.test(jsC),
     '★★deep-pay.js は、端末のログインの控えに触らない（サインアウトしない・auth を呼ばない）');
  ok(!/\bgtag\s*\(|dataLayer/.test(jsC), '★解析のイベントを足していない（gtag / dataLayer を呼ばない）');
  ok(!/pv_salary_unlock_expiry|pv_unlock_expiry|pv_session_start|pv_last_active|pv_give_seen/.test(jsC),
     '★deep-pay.js は、門とログインの鍵の名前を1つも知らない（読まない・書かない）');
  /* ★全ページに出る Give → Get の板（pv-give-first.js）は、この2枚では誰にも出さない
       （同じ3段を本文で出している）。出す・出さないを決めるのは pv-session.js の1か所で、
       この回は触っていない ── 一覧に2枚とも入ったままであることだけ見る。 */
  ok(/var GF_SKIP = \/[^\n]*\|deep-pay\|deep-pay-compare\)\\\.html\$\//.test(read('pv-session.js')),
     '★Give → Get の板を出さない画面の一覧（pv-session.js の GF_SKIP）に、2枚とも入ったまま');
}

// ════════════════════════════════════════════════════════════════
// ブラウザ
// ════════════════════════════════════════════════════════════════
console.log('\n════ ブラウザ ════');

/* 偽物 Supabase。★rpc は本物と同じ「then だけを持つ箱」。 */
const FAKE = function (payload) {
  window.__rpc = {};
  window.__from = 0;
  const UID = '00000000-0000-4000-8000-00000000a001';
  const STATS = { reports: 58, month: 12, airlines: 19, contributors: 37 };
  window.__rpcArgs = [];
  /* ★既定の「選べる組み合わせ」（2026-09-01）。本物は開いている限り毎回返す。
     見本ごとに書くと同じものを何十か所へ写すことになるので、**自分で持って
     いない見本にはこれを配る**。どの筋書きでも区分を選べるように、
     ana / jal / sas × cap / fo × a320 / b787 を全部入れてある。
     ⚠️ 自分で picks を持つ見本（一覧そのものを見る筋書き）はそちらが勝つ。
     ⚠️ __nopicks を立てた見本には**配らない**＝「一覧が届かない」を作れる。 */
  const DEF_PICKS = (function () {
    const A = ['ana', 'jal', 'sas'], P = ['cap', 'fo'], F = ['a320', 'b787'];
    const pos = { '': P.slice() }, flt = { '|': F.slice() };
    for (const c of A) {
      pos[c] = P.slice(); flt[c + '|'] = F.slice();
      for (const x of P) flt[c + '|' + x] = F.slice();
    }
    for (const x of P) flt['|' + x] = F.slice();
    return { air: A.slice(), pos: pos, flt: flt };
  })();
  const RPC = {
    /* ★選んだ区分ごとに違う答えを返す。鍵は 会社|役職|機材。
       選んでいないとき deep-pay.js は**引数を渡さない**ので鍵は '||' になり、
       素の payload に落ちる（＝今までと同じ呼び方に戻っていることも確かめられる）。 */
    pv_deep_pay: (args) => {
      const q = (args && args.p) || {};
      const k = [q.airline || '', q.position || '', q.fleet || ''].join('|');
      const r = (!payload || !payload.__pick) ? payload
        : (payload.__pick[k] || (k === '||' ? payload : payload.__pick.__none || payload));
      /* ★鍵が開いているときだけ配る。閉じている答えに一覧を付けると
         「鍵が無いのに区分を選ばせる」画面ができる（本物は null を返す）。 */
      if (r && r.state === 'open' && !r.picks && !(payload && payload.__nopicks))
        return Object.assign({ picks: (payload && payload.picks) || DEF_PICKS }, r);
      return r;
    },
    pv_pay_rows: () => ({ ok: true, state: 'open', rows: [], stats: STATS }),
    pv_give_progress: () => ({ ok: true, contributors: 37, give: { detailed: true } })
  };
  function q(rows) {
    const o = { data: rows, error: null,
      select: () => o, eq: () => o, in: () => o, order: () => o, limit: () => o,
      update: () => o, insert: () => o,
      single: async () => ({ data: rows[0] || null, error: null }),
      maybeSingle: async () => ({ data: rows[0] || null, error: null }),
      then: (res) => res({ data: rows, error: null }) };
    return o;
  }
  const CLIENT = {
    auth: {
      getSession: async () => ({ data: { session: payload && payload.__anon
        ? null : { user: { id: UID, email: 'pilot@example.com' } } } }),
      getUser: async () => ({ data: { user: { id: UID, email: 'pilot@example.com' } } }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: () => { window.__from++; return q([]); },
    rpc: (name, args) => {
      window.__rpc[name] = (window.__rpc[name] || 0) + 1;
      if (name === 'pv_deep_pay') window.__rpcArgs.push(args === undefined ? null : args);
      /* ★__wire を立てた見本は、rpc を呼ぶたびに**本物の通信を1本**出す（2026-10-11。§2g）。
           この偽物は窓の中で答えるので、素のままでは「通信に /rpc/ が無い」を見ても
           何も証明しない。呼ばれたら必ず、住所に /rpc/<名前> の入った通信が出るようにして、
           ブラウザの外（puppeteer が記録する通信の一覧）から数えられるようにする。
           行き先は確認用サーバ自身（404 が返るだけ。本番へは1バイトも出ない）。 */
      if (payload && payload.__wire) { try { fetch('/rest/v1/rpc/' + name).catch(() => {}); } catch (e) {} }
      /* ★__fail ＝ pv_deep_pay の答えを、渡した形のエラーに差し替える（2026-10-11。§2g）。
           supabase-js の答えは { data, error:{ code, message … }, status }。「ログインして
           いない」（42501・HTTP 401）と、ほかの失敗（通信が切れた・サーバが落ちた）を
           画面が見分けることを見るため。__failAfter: n は「はじめの n 回は普通に答える」
           （開いた画面を見ている途中で切れた形）。__reject は、答えの箱そのものが投げる形。
           ⚠️ __err（符丁も番号も無い失敗）は今までどおり ── §8 と §2f が使っている。 */
      if (payload && payload.__reject && name === 'pv_deep_pay')
        return { then: (y, n) => Promise.reject(new TypeError('Failed to fetch')).then(y, n) };
      const res = (payload && payload.__fail && name === 'pv_deep_pay'
                   && window.__rpc[name] > (payload.__failAfter || 0))
        ? Object.assign({ data: null }, payload.__fail)
        : (payload && payload.__err && name === 'pv_deep_pay')
        ? { data: null, error: { message: 'synthetic failure' } }
        : { data: RPC[name] ? RPC[name](args) : { ok: true }, error: null };
      /* ★__hold を立てた見本は、pv_deep_pay の答えを**手で放すまで**返さない
           （window.__release()）。読み込みのあいだの画面を、時間に頼らず見るため（§2e）。 */
      if (payload && payload.__hold && name === 'pv_deep_pay')
        return { then: (y, n) => new Promise((go) => { window.__release = go; })
          .then(() => res).then(y, n) };
      return { then: (y, n) => Promise.resolve(res).then(y, n) };   // ★then だけ
    }
  };
  Object.defineProperty(window, 'supabase',
    { value: { createClient: () => CLIENT }, writable: false, configurable: false });
};

const STATS = { reports: 58, month: 12, airlines: 19, contributors: 37 };
/* ★見本の形は db/deep-pay.sql の返り値（2026-10-11）に合わせてある。
     ・区分の人数は**どこにも入っていない**（cohort.n / head.detailed_n /
       head.verified_n / comp.n / comp.bonus.n はサーバが返さなくなった）。
       代わりに cohort.trust（high / mid / low）が1つ来る。
     ・gate.crowd ＝「みんなの側」の門（100人以上 or 手動の公開フラグ）。
       ここの見本は 37 / 100 人のまま開いている＝**手動フラグで開けた日**の形なので、
       開いている見本は全部 crowd:true。閉じている見本（LOCK）は false。
     ・見出しの2つは刻みで来る ── annual_usd は $50 刻み・per_block_usd は $0.5 刻み
       （前は有効数字2桁だった。110000 / 93 のような丸い数ではもう来ない）。
       給与構成の med_usd は今も有効数字2桁。
     ・gate は { key, ready, todo, crowd, contributors, goal }（2026-10-11）。
       ready ＝本人が、自分に当てはまる項目をぜんぶ答えた月を持っているか。
       todo  ＝足りない人にだけ { year, month, items:[コード…] }（足りている人・
                窓の中に自分の行が無い人は null）。**前の鍵 detailed は gate に無い**
       （いちばん外の give.detailed は別物で、今も返る ── 読んでいた DEEP PAY の札は
        2026-10-11 に外したので、いま画面でこれを使う所は無い）。
     ⚠️ 人数の鍵をここへ足し戻さない。毒入りの答え（古いサーバの形）は POISON が
        別に持っている ── あちらは「来ても読まない」ことを見るための見本。 */
const FULL = {
  ok: true, state: 'open',
  gate: { key: true, ready: true, todo: null, crowd: true, contributors: 37, goal: 100 },
  give: { detailed: true }, stats: STATS,
  cohort: { level: 'airline_pos_fleet', manual: false, airline: 'ana', pos: 'fo', fleet: 'a320',
            trust: 'high' },
  /* ★この2つの値は、刷られる字を §3g が固定している。
       119700 × 158.95 ＝ 19,026,315 円 → 1万円刻みで ¥1,903万 ／ ドルなら $120K
       102.5  × 158.95 ＝ 16,292 円     → 100円刻みで ¥16,300  ／ ドルなら $103
     値を変えるなら §3g の期待値も一緒に直す（レートは currency.js の RATES）。 */
  /* ⚠️ per_block_usd 102.5 は annual_usd ÷ 12 ÷ block_h（119700÷12÷74 ≒ 135）と**一致しない**。
     見本が壊れているのではない。db/deep-pay.sql の hagg は**1人ずつ**比を出してから
     中央値を取るので、中央値どうしの割り算とは一致しないのが普通
     （よく飛ぶ人ほど年収が高い形なら必ずこうなる）。
     ★だから「画面の3つの数字が割り算で結べる」検査をここに足さない。
       結べることを確かめるのは db/test-deep-pay.mjs の19節 ── あちらは
       **全員まったく同じ値の区分**をわざと作って、中央値を個人の値に潰している。 */
  head: { annual_usd: 119700, per_block_usd: 102.5, fixed_pct: 62 },
  comp: { total_kind: 'monthly_cash',
    segs: [{ k: 'base', pct: 52, med_usd: 4800 }, { k: 'variable', pct: 24, med_usd: 2200 },
           { k: 'command', pct: 8, med_usd: 730 }, { k: 'perdiem', pct: 7, med_usd: 640 },
           { k: 'housing', pct: 5, med_usd: 460 }, { k: 'other', pct: 4, med_usd: 370 }],
    bonus: { pct_of_annual: 5 } },
  work: { block_h: 74.0, duty_h: 141.0, duty_days: 18, stay_nights: 9 },
  var: [{ k: 'block', pct: 46 }, { k: 'sector', pct: 21 }, { k: 'overtime', pct: 13 },
        { k: 'night', pct: 11 }, { k: 'weekend', pct: 6 }, { k: 'holiday', pct: 3 }]
};
const clone = (o) => JSON.parse(JSON.stringify(o));
/* duty_days と stay_nights が人数の壁に届かなかった形（列ごとの門）。 */
const HOLES = Object.assign(clone(FULL), {
  work: { block_h: 74.0, duty_h: 141.0, duty_days: null, stay_nights: 9 },
  var: [{ k: 'block', pct: 62 }, { k: 'duty', pct: 38 }]
});
/* 数字が1つも読めなかった形（カードは1枚も出ない＝0 を並べない）。 */
const NOHEAD = Object.assign(clone(FULL), {
  head: { annual_usd: null, per_block_usd: null, fixed_pct: null },
  comp: null, work: null, var: []
});
/* 手で選んだ区分（自分は ANA の FO なのに、JAL の機長・787 を見ている形）。
   ★信頼度は「中」で返す ── 画面がサーバの段をそのまま出していること（＝自分で
     「高」に作り直していないこと）を見るため、FULL の high とわざと違えてある。 */
const SEL = Object.assign(clone(FULL), {
  cohort: { level: 'selected', manual: true, airline: 'jal', pos: 'cap', fleet: 'b787',
            trust: 'mid' },
  head: { annual_usd: 211350, per_block_usd: 180.5, fixed_pct: 71 }
});
/* 選んだ区分が人数の壁に届かなかった形。★SQL は広い区分に登らないので、
   ここに来るのは「何も出せない」だけ。全体の数字は1つも入っていない
   （本物も head / comp / work / var を**返り値ごと** null にする。trust も null）。 */
const NONE = { ok: true, state: 'open', gate: clone(FULL.gate), give: { detailed: true },
  stats: STATS,
  cohort: { level: 'none', manual: true, airline: 'sas', pos: null, fleet: null, trust: null },
  head: null, comp: null, work: null, var: null };
/* ★毒入りの答え（古いサーバの形）。db/deep-pay.sql を貼る前の本番は、区分の人数を
     まだ返してくる。**来ても1文字も出さない**ことを §3f が見る。
     数は 12 と 7 ── FULL の本文に出る他の数字（%・時間・金額）と、単位つきでは
     かぶらない（「12人」「7人」「12 pilots」という字は、人数を刷らない限り出ない）。 */
const POISON = (function () {
  const p = clone(FULL);
  p.cohort.n = 12;
  p.head.detailed_n = 12; p.head.verified_n = 7;
  p.comp.n = 12; p.comp.bonus.n = 9;
  return p;
})();
/* 信頼度の段が来ない形（古いサーバ）。札ごと出ないのが正しい。 */
const NOTRUST = (function () { const p = clone(FULL); delete p.cohort.trust; return p; })();
const PICKABLE = Object.assign(clone(FULL),
  { __pick: { 'jal|cap|b787': SEL, 'sas||': NONE } });
/* 選べる組み合わせつき（2026-09-01）。形は db/deep-pay.sql の avail と同じ ──
   会社 ／ 会社ごとの職位 ／「会社|職位」ごとの機材。空文字の鍵は「そこで絞っていない」。
   ★ANA と JAL で持っている職位・機材を**わざと違えてある** ── 会社を変えたときに
     その会社に無い職位・機材が落ちることを見るため。
   ★jal を選んでも薄い答えを返させる（__pick の 'jal||'）── 選択肢どおりに
     選んでも、一覧を受け取った後に人が減れば空になり得る。そのとき広い区分の
     数字で埋めないことを見る。 */
const PICKS3 = {
  air: ['jal', 'ana'],          /* ★並びは画面側が語彙の順に直す（ana, jal になる）*/
  pos: { '': ['cap', 'fo'], jal: ['cap'], ana: ['cap', 'fo'] },
  flt: { '|': ['a320', 'b787'], '|cap': ['b787'], '|fo': ['a320'],
         'jal|': ['b787'], 'jal|cap': ['b787'],
         'ana|': ['a320', 'b787'], 'ana|cap': ['b787'], 'ana|fo': ['a320'] }
};
const HASPICKS = Object.assign(clone(PICKABLE), {
  picks: PICKS3,
  __pick: { 'jal|cap|b787': SEL, 'sas||': NONE, 'jal||': NONE }
});
/* 一覧が空で届いた形（まだ誰も内訳を書いていない日）。★自動 fallback は禁止＝
   110社を並べる逃げ道は無い。選択欄ごと出ないのが正しい。 */
const NOPICKS = Object.assign(clone(FULL),
  { picks: { air: [], pos: {}, flt: {} } });
/* 一覧そのものが届かなかった形（db/deep-pay.sql を Supabase に貼る前がこれ）。
   ★__nopicks は FAKE への合図で、サーバの返り値の中身ではない。 */
const NOLIST = Object.assign(clone(FULL), { __nopicks: true });
/* variable 区分が人数の壁に届かなかった形。★KPI の「変動給比率」の行が**消える**こと
   （0% とも「100 − 固定給」とも書かない）を見るための見本。 */
const NOVAR = Object.assign(clone(FULL), {
  comp: { total_kind: 'monthly_cash',
    segs: [{ k: 'base', pct: 52, med_usd: 4800 }, { k: 'command', pct: 8, med_usd: 730 },
           { k: 'perdiem', pct: 7, med_usd: 640 }, { k: 'housing', pct: 5, med_usd: 460 }],
    bonus: { pct_of_annual: 5 } }
});
/* 賞与を書いた人が人数の壁に届かず、割合が伏せられている形（comp.bonus が無い）。
   ★このとき月換算に「（賞与ぬき）」と名乗ってはいけない。賞与のある人が
     壁の手前の人数だけいるかもしれず、その人たちのぶんは年収に入ったままだから。 */
const NOBONUS = Object.assign(clone(FULL), {
  comp: Object.assign(clone(FULL.comp), { bonus: null })
});

/* ★2026-08-30 から、この画面は**選ぶまで何も出さない**。だから見本の配置を見る
   筋書きは、先に区分を選ばせないと空のページを撮ることになる。
   中身は FAKE の鍵に使われるだけで、__pick を持たない見本はどの鍵でも
   同じ payload を返す＝見本そのものは1バイトも直さなくてよい。 */
const MINE = { airline: 'ana', position: 'fo', fleet: 'a320' };

const LOCK = { ok: true, state: 'locked', stats: STATS, give: { detailed: false },
               gate: { key: false, ready: false, todo: null, crowd: false, contributors: 37, goal: 100 },
               cohort: null, head: null, comp: null, work: null, var: null };
/* 錠前の板の筋書き用。閉じている理由（鍵／本人が答えきったか／みんなの側）を1つずつ変える。
   ★crowd や ready を**渡さない**（undefined）と、古いサーバの形になる。
   ★give.detailed は門とは別の値（pv_my_give の答え）。板には効かないので false で固定。 */
const lockWith = (gate) => Object.assign(clone(LOCK), { gate: gate });

/* ── 人数を画面に出さない（2026-10-11・オーナー判断）──────────────────
   「◯人」（日）・「◯ pilots」（英）の形の字が、本文に1つも無いこと。
   その区分に何人いるかも、壁が何人かも出さない。
   ★「1人ずつ」は人数ではなく計算の仕方（Pay / Block Hour の添え字）なので除く。
   ★例外はたった1つ ── 錠前の板の「…100人に達すること（いま N人）」。それも
     gate.crowd が false のときだけ。だからこの物差しは**開いた画面**に当て、
     錠前の板は §2b が行ごとに見る。
   ⚠️ 例外を増やさない。「あと◯人」「◯人以上」を許した瞬間、その区分の人数が
      1人単位で読める。 */
const NOCOUNT = /[0-9０-９]+\s*(?:人(?!ずつ)|名)|\b[0-9]+\s+pilots?\b/i;
const countIn = (t) => ((t || '').match(new RegExp(NOCOUNT.source, 'gi')) || []).join(' / ');

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const jars = [];
/* 描き終わるまで待つ（見出しが入り、骨組みが消える）。open() と、読み直したあとの両方で使う。
   ★器の名前は画面で違う（概要 #dp-hd / #dp-kpi・会社比較 #dc-hd / #dc-sides）。
     どちらの画面でも同じ待ち方ができるように、両方の名前で見る。
   ★概要の <h1> は 2026-10-11 から HTML に静的に在る（REAL PAY ⇄ DEEP PAY のタブ）ので、
     1つめの待ちは概要ではすぐ通る。**描き終わりを捕まえているのは2つめ**（骨組みが消える。
     deep-pay.js は1回の描画で見出しの条件の1行から KPI までを続けて描く）。
     会社比較の <h1> は今も JS が書くので、1つめも外さない（あちらの drawn と同じ本体のまま）。 */
async function drawn(page) {
  await page.waitForFunction(() => !!document.querySelector('#dp-hd h1, #dc-hd h1'), { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('#dp-kpi .mr-skel, #dc-sides .mr-skel'),
                             { timeout: 20000 });
}
/* ★返すのは { page, errs, reqs, navs }。reqs ＝ この窓が出そうとした通信の住所（止めたものも
     含めて全部）・navs ＝ いちばん外の枠が着いた住所（2026-10-11。§2g が「/rpc/ を1本も
     投げない」「よそへ運ばれない」を、窓の外から数えるのに使う。ほかの節は読まない）。
   ★5つ目の opt は、クラッカーの節（§2f）と §2g が使う。渡さなければ今までと1つも変わらない。
     jar    … 同じ入れ物（＝同じ保存領域）で続けて開く。渡した入れ物は呼んだ側が閉じる
              （jars には積まない）。印は端末の保存領域に在るので、「閉じた画面を見た人が
              あとで開く」を作るには、同じ入れ物で2枚開くしかない。
     file   … 開く画面（既定は deep-pay.html。会社比較を同じ偽サーバで開くのに使う）。
     reduce … 「動きを減らす」設定を装う。
     first  … ページのどの script よりも先に流す関数と引数の組（[[fn, arg], …]）。
     tail   … 住所の後ろに付ける字（'?x=1#y' のように。§2g が「付けて来た字が残る」を見る）。
     cmp    … true なら、会社比較を動かす試験用の口の印を置いてから開く（2026-10-12。
              window.__PV_COMPARE_OPEN = true。手元の住所でだけ効く ── 冒頭の注）。
              ★**渡さなければ置かない** ＝ この検査は、配っているファイルのままの DEEP PAY を見る
                （会社比較へのカードは出ない）。使うのは §2f の f と §3h だけ。 */
async function open(lang, payload, theme, pick, opt) {
  const o = opt || {};
  const jar = o.jar || await browser.createBrowserContext();
  if (!o.jar) jars.push(jar);
  const page = await jar.newPage();
  await page.setViewport({ width: 1360, height: 1200 });
  if (o.reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  for (const [fn, arg] of (o.first || [])) await page.evaluateOnNewDocument(fn, arg);
  const errs = [], reqs = [], navs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  page.on('framenavigated', (fr) => { if (fr === page.mainFrame()) navs.push(fr.url()); });
  /* ★外の網を1本も引かない。CDN（supabase-js）は parser-blocking なので、
     混んだ回や回線の悪い回に DOMContentLoaded ごと遅れて**嘘の赤**が出る
     （実測：新しい窓を3つ続けて開くと、3つ目の goto が 15秒で落ちた）。
     window.supabase は下の evaluateOnNewDocument が先に置いているので、
     CDN の中身は1バイトも要らない。 */
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = r.url();
    reqs.push(u);
    if (u.startsWith(BASE)) return r.continue();
    if (/supabase-js|cdn\.jsdelivr/.test(u))
      return r.respond({ status: 200, contentType: 'application/javascript', body: '' });
    if (/fonts\.googleapis|fonts\.gstatic/.test(u))
      return r.respond({ status: 200, contentType: 'text/css', body: '' });
    return r.abort();
  });
  await page.evaluateOnNewDocument((t) => {
    window['ga-disable-G-3XYF69VQ3X'] = true;
    localStorage.setItem('pv-theme', t);
  }, theme || 'light');
  if (o.cmp) await page.evaluateOnNewDocument(() => { window.__PV_COMPARE_OPEN = true; });
  await page.evaluateOnNewDocument(FAKE, payload);
  await page.goto(BASE + (lang === 'en' ? '/en/' : '/') + (o.file || 'deep-pay.html') + (o.tail || ''),
                  { waitUntil: 'domcontentloaded', timeout: 30000 });
  /* ★時間で待たない。描き終わりは drawn() が「骨組みが消えた」で捕まえる（上の注）。
     ★__hold（答えを止めた見本）は待たない ── 骨組みが残っていることを見る筋書きなので、
       ここで待つと必ず時間切れになる。
     ★__anon（ログインしていない人）も待つ（2026-10-11）。前はログイン画面へ運ばれて
       この画面が消えるので待てなかった。いまはここに居たまま、板を描く。 */
  if (!(payload && payload.__hold)) await drawn(page);
  /* ★選ぶまで何も出ない（2026-08-30）。配置を見る筋書きはここで区分を選ぶ。 */
  if (pick) await choose(page, pick);
  return { page, errs, reqs, navs };
}

/* 区分を選ぶ。★選択肢が生えるのを待ってから値を入れる。語彙（pv-vocab.json /
   pv-airlines.json）は RPC より遅れて着くことがあり、待たずに value を入れると
   空文字のまま静かに素通りする＝「選んだのに何も出ない」という**嘘の緑**になる。 */
const PK_ID = { airline: 'dp-pk-air', position: 'dp-pk-pos', fleet: 'dp-pk-flt' };
async function choose(page, sel) {
  const want = {};
  for (const k of Object.keys(PK_ID)) if (sel[k]) want[k] = sel[k];
  await page.waitForFunction((w, ids) => Object.keys(w).every(
    (k) => !!document.querySelector('#' + ids[k] + ' option[value="' + w[k] + '"]')),
    { timeout: 15000 }, want, PK_ID);
  const n = await page.evaluate(() => window.__rpcArgs.length);
  await page.evaluate((x, ids) => {
    for (const k of Object.keys(ids)) {
      const e = document.getElementById(ids[k]);
      if (e) e.value = x[k] || '';
    }
    document.getElementById('dp-pk-flt')
      .dispatchEvent(new Event('change', { bubbles: true }));
  }, sel, PK_ID);
  /* ★時間で待たない。引いた回数が1つ増えて、欄が触れる状態に戻るまで待つ。 */
  await page.waitForFunction((m) => window.__rpcArgs.length === m
    && !document.getElementById('dp-pk-air').disabled, { timeout: 15000 }, n + 1);
}

/* ★選択欄が生えるまで待つ（2026-09-12）。deep-pay.js は一覧（RPC）と
   語彙（pv-vocab.json / pv-airlines.json）が**両方**着いてから <select> を作る。
   open() が待っているのは見出しと KPI までなので、区分を読む筋書きは
   ここで待たないと、混んだ回に **一覧が空だったのか、まだ来ていないのか**の
   区別が付かないまま読み出して落ちる（2026-09-12、check.mjs all で実際に
   「null の n を読んだ」で止まった）。時間では待たない。 */
async function waitPicks(page) {
  await page.waitForFunction(() => {
    const e = document.getElementById('dp-pk-air');
    return !!e && e.options.length > 1;
  }, { timeout: 15000 });
}

/* 画面から一度に読み取るもの（ケースごとに見方を変えない）。 */
const SNAP = () => {
  const q = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
  const root = document.getElementById('dp-root');
  const sec = (id) => {
    const e = document.getElementById(id);
    return { hidden: !!(e && e.hidden), text: e ? e.innerText : '', rows: e ? e.querySelectorAll('.dp-li').length : 0 };
  };
  return {
    url: location.pathname + location.search,
    text: root ? root.innerText : '',
    kpi: q('.dp-kpi').length,
    kpiV: q('.dp-kpi-v').map((e) => e.textContent),
    kpiN: q('.dp-kpi-n').map((e) => e.textContent),
    empty: q('#dp-root .pt-empty').length,
    donut: q('#dp-comp svg').length,
    compCta: q('#dp-comp a[href*="pay-report"]').length,
    legend: q('#dp-comp .pt-leg:not(.dp-th) .amt').map((e) => e.textContent),
    comp: sec('dp-comp'), work: sec('dp-work'), vari: sec('dp-var'),
    more: sec('dp-more'),
    bars: q('#dp-var .dp-li-f').map((e) => getComputedStyle(e).backgroundColor),
    /* ★働き方の節の棒（2026-08-31 に廃止）。Block 74h・Duty 141h・勤務 18日・
       ステイ 9泊は**単位が違う**ので、同じ基準の棒で並べても長さを比べる意味が無い。
       0 なら「棒が無い」＝正しい。 */
    workBars: q('#dp-work .dp-li-b').length,
    /* ★変動給の1行の要約（一番大きい区分）。2区分以上あるときだけ出す。 */
    varLead: q('#dp-var .dp-lead').map((e) => e.textContent),
    moreBtns: q('#dp-more button').map((e) => ({ dis: e.disabled, tag: e.tagName })),
    moreLinks: q('#dp-more a').length,
    moreHrefs: q('#dp-more a').map((e) => e.getAttribute('href')),
    /* ★会社比較へ繋がるリンク（2026-10-12）。器を名指しせず、**文書ぜんたい**で数える ──
         閉じているあいだは 0 本（ヘッダーにも左メニューにも本文にも無い）。
         moreKids ＝ カードの器（#dp-more）の中身の数、moreShown ＝ その器が描かれているか
         （hidden 属性ではなく、計算後の display で見る）。 */
    cmpLinks: q('a[href*="deep-pay-compare"], [onclick*="deep-pay-compare"]').length,
    moreKids: (document.getElementById('dp-more') || { children: [] }).children.length,
    moreShown: (function () {
      const e = document.getElementById('dp-more');
      return !!(e && getComputedStyle(e).display !== 'none');
    })(),
    /* ★注記（.dp-foot）は「どのカードの中に居るか」まで見る。2026-09-01 に
       給与構成のカードから KPI の下（全幅）へ移した ── あのカードは段の高さを
       決めている側で、狭いぶん1文が2〜3行に折れ、折れたぶんだけ画面が下へ伸びた。 */
    foot: q('#dp-root .dp-foot').map((e) => ({
      in: ((e.closest('#dp-kpi,#dp-comp,#dp-work,#dp-var,#dp-more') || {}).id) || '',
      t: e.textContent })),
    cond: (document.querySelector('.dp-cond') || {}).innerText || '',
    /* 信頼度の札（サーバの cohort.trust をそのまま出す。来なければ札ごと無い）。 */
    trust: q('#dp-root .dp-trust').map((e) => e.textContent.trim()),
    /* ぼかした影絵とその器（2026-10-11）。**閉じた画面にだけ**在る。
       blurred ＝ 本文（<main>）の中で、ぼかしが**実際に効いている**要素（計算後の値で見る。
       クラス名ではなく効き目を見るので、別の名前でぼかしを足した回にも鳴る）。 */
    ghost: q('.dp-ghost').length,
    stage: q('.dp-stage').length,
    skel: q('#dp-kpi .mr-skel').length,
    blurred: q('main *').filter((e) => {
      const cs = getComputedStyle(e);
      return (cs.filter && cs.filter !== 'none')
        || (cs.backdropFilter && cs.backdropFilter !== 'none');
    }).map((e) => String(e.className || e.tagName).split(' ')[0]),
    /* 錠前の板。行は1行ずつ <p class="dp-msg-s">（2026-10-11。前は1つの <p> を <br> で
       割っていた）。cta ＝ 板の入口（ボタン）の行き先。どの板でも1本。
       todoH / todo ＝「まだ答えていない項目」の見出しと札（箱が無ければ todoH は null）。
       todoPrev ＝ その箱のすぐ上の行の字（「答えきっていない」の行のすぐ下に在ること）。
       warn ＝ 断りの字。warnAtCta ＝ 断りのすぐ次がボタンであること。
       kids ＝ 板の直下の並び（クラスの頭）。raw ＝ 板の HTML（タグが紛れていないかを見る）。 */
    lock: (function () {
      const m = document.querySelector('#dp-kpi .dp-msg--lock');
      const all = (s) => m ? [...m.querySelectorAll(s)] : [];
      const td = m && m.querySelector('.dp-todo');
      const w = m && m.querySelector('.dp-msg-w');
      const a = m && m.querySelector('a.dp-cta');
      return { on: !!m,
               lines: all('.dp-msg-s').map((e) => e.textContent.trim()),
               todoH: td ? ((td.querySelector('.dp-todo-h') || {}).textContent || '') : null,
               todo: all('.dp-todo-i').map((e) => e.textContent),
               todoPrev: (td && td.previousElementSibling)
                 ? td.previousElementSibling.textContent.trim() : '',
               warn: all('.dp-msg-w').map((e) => e.textContent),
               warnAtCta: !!(w && a && w.nextElementSibling === a),
               kids: m ? [...m.children].map((e) => String(e.className).split(' ')[0]) : [],
               tags: m ? [...new Set([...m.querySelectorAll('*')]
                 .map((e) => e.tagName.toLowerCase()))].sort() : [],
               raw: m ? m.innerHTML : '',
               text: m ? m.innerText : '',
               cta: all('a.dp-cta').map((e) => e.getAttribute('href')) };
    })(),
    pick: (function () {
      const e = document.getElementById('dp-pick');
      const one = (id) => {
        const x = document.getElementById(id);
        return x ? { v: x.value, n: x.options.length, dis: !!x.disabled } : null;
      };
      /* ★hidden 属性だけでは足りない。UA の [hidden]{display:none} は作者側の
         display:flex/grid に負けるので、**属性は付いたまま画面には出ている**
         という壊れ方をする（実際にそうなっていた）。描かれた結果も見る。 */
      /* ★中身の値そのものを持ち出す（個数だけでは「一覧どおりか」が見えない）。
         先頭の「選択する」（value が空）は数に入れない。 */
      const vals = (id) => {
        const x = document.getElementById(id);
        return x ? [...x.options].map((o) => o.value).filter(Boolean) : null;
      };
      return { hidden: !!(e && e.hidden),
               shown: !!(e && getComputedStyle(e).display !== 'none'),
               air: one('dp-pk-air'), pos: one('dp-pk-pos'), flt: one('dp-pk-flt'),
               airV: vals('dp-pk-air'), posV: vals('dp-pk-pos'), fltV: vals('dp-pk-flt'),
               note: ((e && e.querySelector('.dp-pick-n')) || {}).textContent || '',
               groups: e ? e.querySelectorAll('optgroup').length : 0,
               grp: e ? [...e.querySelectorAll('#dp-pk-air optgroup')]
                          .map((g) => g.label) : [],
               airOn: e ? [...e.querySelectorAll('#dp-pk-air optgroup')]
                            .map((g) => [...g.querySelectorAll('option')]
                                          .map((o) => o.value)) : [],
               reset: !!document.getElementById('dp-pk-rst') };
    })(),
    args: window.__rpcArgs || [],
    rpc: window.__rpc
  };
};

/* ── 影絵が無いこと（2026-10-11）─────────────────────────────────────
   開いた・選ぶ前・薄い・一覧が無い・読み込めなかった・読み込み中 ── 閉じていない画面には、
   影絵（.dp-ghost）もその器（.dp-stage）も**DOM に無く**、ぼかしの効いた要素も1つも無い。
   ★本物の値が出る画面に、ぼかした要素が1つでも在れば、それは「値をぼかして見せる」
     入口になる。影絵が在ってよいのは、数字が1つも来ていない閉じた画面だけ。 */
const noGhost = (s) => s.ghost === 0 && s.stage === 0 && s.blurred.length === 0;
const ghostWhy = (s) => `影絵 ${s.ghost} / 器 ${s.stage} / ぼかしの効いた要素 ${s.blurred.join(',') || 'なし'}`;

// ── 0. REAL PAY ⇄ DEEP PAY のタブ（2026-10-11・オーナー指示）──────────────────
/* 「上の REAL PAY の横に DEEP PAY の入り口作って。タブみたいな形に」。
   この画面では DEEP PAY がいま居る側（<h1>）、REAL PAY が戻る道（リンク）。字面は ①-b。
   ここは実物で見る：

     在る   … タブが2つ・並びは REAL PAY → DEEP PAY・<h1> は画面に1つ・aria-current は DEEP PAY
     行き先 … REAL PAY のリンクは、その言語の actual-pay.html に解ける
     押せる … 閉じた画面（ぼかした影絵＋板）でも、開いた画面でも、タブのまんなかを押して
              当たるのがタブ自身（影絵・幕・板・紙吹雪の器に取られない）。
              閉じた画面では、本物のマウスで押して REAL PAY へ着くところまで見る
     的     … リンクの的は縦 44px 以上（字の箱は約40px。的だけ外へ広げてある）
     収まる … 320 / 390 / 1440 のどの幅でも1行・窓の中・横スクロールが生えない
     色     … いま居る側は濃い字＋橙の下線、もう片方は薄い字で下線は畳んである。
              暗い面では字の色が明るい側とは別の色（トークンが切り替わっている）
     残る   … 開いた画面を描き直しても、タブは同じ要素のまま・条件の1行は1つのまま
              （deep-pay.js が器を丸ごと書き換える形に戻ると、タブが消えるか作り直される）
   ⚠️ 時間で待たない。幅は「本当にその幅になった」で待つ。 */
const TABS = () => {
  const vw = document.documentElement.clientWidth;
  const nav = document.querySelector('#dp-hd > nav.pv-paytabs, #ap-hd > nav.pv-paytabs');
  const o = { vw, nav: !!nav, h1s: document.querySelectorAll('h1').length,
              over: document.documentElement.scrollWidth - vw,
              conds: document.querySelectorAll('#dp-hd .dp-cond').length };
  if (!nav) return o;
  window.scrollTo(0, 0);
  const kids = [...nav.children];
  const cur = nav.querySelector('[aria-current="page"]');
  const link = nav.querySelector('a.pv-paytab');
  o.label = nav.getAttribute('aria-label') || '';
  o.order = kids.map((k) => k.tagName.toLowerCase() + ':' + k.textContent.trim()).join(' | ');
  o.curs = document.querySelectorAll('.mr-main [aria-current]').length;
  o.cur = cur ? cur.tagName.toLowerCase() + ':' + cur.textContent.trim() : '';
  o.href = link ? link.getAttribute('href') : '';
  o.to = link ? new URL(link.getAttribute('href'), location.href).pathname : '';
  if (!cur || !link || kids.length !== 2) return o;
  const rs = kids.map((k) => k.getBoundingClientRect());
  /* 1行 ＝ 2つの下端がそろっていて、左のタブの右に右のタブが居る。折れると高さが倍になる。 */
  o.oneLine = Math.abs(rs[0].bottom - rs[1].bottom) <= 1 && rs[0].right <= rs[1].left
    && rs.every((r) => r.height < 2 * parseFloat(getComputedStyle(kids[0]).fontSize));
  o.inView = rs.every((r) => r.left >= 0 && r.right <= vw + 0.5 && r.width > 0 && r.height > 0);
  const at = (x, y) => document.elementFromPoint(x, y);
  const mid = (r) => [(r.left + r.right) / 2, (r.top + r.bottom) / 2];
  o.hit = kids.map((k, i) => { const t = at.apply(null, mid(rs[i])); return !!t && (t === k || k.contains(t)); });
  /* 的の高さ ── リンクのまんなかの縦の線を 1px ずつ下りて、リンクに当たる点を数える。 */
  const lr = link.getBoundingClientRect();
  let tall = 0;
  for (let y = Math.floor(lr.top) - 12; y <= Math.ceil(lr.bottom) + 12; y++) {
    if (y < 0) continue;
    const t = at((lr.left + lr.right) / 2, y + 0.5);
    if (t && (t === link || link.contains(t))) tall++;
  }
  o.target = tall;
  const stage = document.querySelector('.dp-stage');
  o.stage = !!stage;
  o.aboveStage = stage ? Math.round(stage.getBoundingClientRect().top - nav.getBoundingClientRect().bottom) : null;
  const cc = getComputedStyle(cur), lc = getComputedStyle(link);
  const bar = (e) => getComputedStyle(e, '::after');
  o.cCur = cc.color; o.cLink = lc.color;
  o.barOn = bar(cur).transform; o.barOff = bar(link).transform;
  o.barBg = bar(cur).backgroundColor; o.barH = bar(cur).height;
  o.moves = lc.transitionProperty.replace(/\s+/g, '');
  o.deco = lc.textDecorationLine;
  o.size = [cc.fontSize, lc.fontSize, cc.fontWeight, lc.fontWeight].join('/');
  return o;
};
const TAB_WIDTHS = [1440, 390, 320];
/* ★幅を変えた直後は測らない。広い幅の左メニューは、狭い幅では右の外へ滑っていく板に
     なる（320ms・そのあいだは見えたまま）。滑っている板がタブの上を通るので、
     待たずに当たり判定を見ると「タブの上に左メニューが乗っている」という嘘の赤になる
     （実際に踏んだ）。navStill は時間ではなく「板が止まった」で待つ。 */
async function tabsAt(page, w) {
  await page.setViewport({ width: w, height: 900 });
  await page.waitForFunction((x) => innerWidth === x, { timeout: 10000 }, w);
  await navStill(page);
  return page.evaluate(TABS);
}
/* 2枚で共通の物差し（REAL PAY の側は assert-pay-rows.mjs が同じ形で見ている）。 */
function tabShape(t, tag, want) {
  ok(t.nav && t.order === 'a:REAL PAY | h1:DEEP PAY',
     `${tag}: ★★タブが2つ・並びは REAL PAY（リンク）→ DEEP PAY（h1）`, t.order || '（タブが無い）');
  ok(t.h1s === 1 && t.cur === 'h1:DEEP PAY' && t.curs === 1,
     `${tag}: ★<h1> は画面に1つ・aria-current は DEEP PAY の1つだけ`, `h1 ${t.h1s} / ${t.cur} / ${t.curs}`);
  ok(t.label === want.label, `${tag}: ナビの名前が読み上げに渡る`, t.label);
  ok(t.href === 'actual-pay.html' && t.to === want.to,
     `${tag}: ★★REAL PAY のリンクが、その言語の REAL PAY に解ける`, `${t.href} → ${t.to}`);
  ok(t.oneLine === true && t.inView === true && t.over <= 0,
     `${tag}: ★★1行に入り、窓の中に居て、横スクロールが生えない`,
     `1行=${t.oneLine} 窓の中=${t.inView} はみ出し=${t.over}px（幅 ${t.vw}）`);
  ok(Array.isArray(t.hit) && t.hit.every(Boolean),
     `${tag}: ★★タブのまんなかを押して当たるのはタブ自身（上に何も乗っていない）`, JSON.stringify(t.hit));
  ok(t.target >= 44, `${tag}: ★リンクの的は縦 44px 以上`, `${t.target}px`);
  ok(t.cCur !== t.cLink && t.barOn === 'none' && /^matrix\(0,/.test(t.barOff)
     && !/rgba\(0, 0, 0, 0\)|transparent/.test(t.barBg) && t.barH === '3px',
     `${tag}: ★いま居る側だけが濃い字＋橙の下線（もう片方の下線は畳んである）`,
     `${t.cCur} / ${t.cLink} / ${t.barOn} / ${t.barOff} / ${t.barBg} ${t.barH}`);
  ok(t.moves === 'transform,opacity' && t.deco === 'none',
     `${tag}: ★動かすのは transform と opacity だけ・下線は自前（ブラウザの下線が出ていない）`,
     `${t.moves} / ${t.deco}`);
}
for (const lang of ['ja', 'en']) {
  const want = { label: TAB_LABEL[lang], to: (lang === 'en' ? '/en/' : '/') + 'actual-pay.html' };
  const ink = {};
  for (const theme of ['light', 'dark']) {
    // ── 閉じた画面（影絵＋板）──
    {
      const { page, errs } = await open(lang, LOCK, theme);
      for (const w of TAB_WIDTHS) {
        const t = await tabsAt(page, w);
        const tag = `${lang}/${theme}/閉じた/${w}`;
        tabShape(t, tag, want);
        ok(t.stage === true && t.aboveStage >= 0,
           `${tag}: ★★タブは影絵と板の器（.dp-stage）より上に居る`, `すき間 ${t.aboveStage}px`);
        if (w === 1440) ink[theme] = t.cCur;
      }
      /* ★エラーは押す前に数える（押したあとは REAL PAY の画面で、ここの偽サーバは
           あちらの答えを持っていない）。 */
      ok(errs.length === 0, `${lang}/${theme}/閉じた: JS のエラーが出ない`, errs.join(' / '));
      /* ★本物のマウスで押す（当たり判定そのもの）。影絵・幕・板のどれかがタブの上へ
           はみ出していれば、ここで着かない。いちばん狭い幅（320）のまま押す。 */
      if (theme === 'light') {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
          page.click('#dp-hd a.pv-paytab')
        ]);
        const path = await page.evaluate(() => location.pathname);
        ok(path === want.to, `${lang}: ★★閉じた画面のタブを押すと REAL PAY へ着く`, path);
      }
    }
    // ── 開いた画面（区分を選んで、条件の1行が出ている）──
    {
      const { page, errs } = await open(lang, FULL, theme, MINE);
      await page.evaluate(() => { window.__tabs = document.querySelector('#dp-hd > nav.pv-paytabs'); });
      for (const w of TAB_WIDTHS) {
        const t = await tabsAt(page, w);
        const tag = `${lang}/${theme}/開いた/${w}`;
        tabShape(t, tag, want);
        ok(t.stage === false && t.conds === 1,
           `${tag}: ★開いた画面には器が無く、条件の1行はタブの隣（か下）に1つ`,
           `器=${t.stage} / 条件の1行 ${t.conds}`);
      }
      /* 描き直しても、タブは同じ要素のまま・条件の1行は増えない。 */
      const again = await page.evaluate(() => {
        window.dispatchEvent(new Event('pv-currency-change'));
        window.dispatchEvent(new Event('pv-currency-change'));
        return { same: document.querySelector('#dp-hd > nav.pv-paytabs') === window.__tabs,
                 conds: document.querySelectorAll('#dp-hd .dp-cond').length,
                 h1s: document.querySelectorAll('h1').length,
                 kids: [...document.getElementById('dp-hd').children]
                   .map((c) => c.tagName.toLowerCase() + '.' + String(c.className).split(' ')[0]).join(' ') };
      });
      ok(again.same && again.conds === 1 && again.h1s === 1 && again.kids === 'nav.pv-paytabs div.dp-cond',
         `${lang}/${theme}: ★★描き直しても、タブは同じ要素のまま・条件の1行は1つのまま`,
         JSON.stringify(again));
      ok(errs.length === 0, `${lang}/${theme}/開いた: JS のエラーが出ない`, errs.join(' / '));
    }
  }
  ok(!!ink.light && !!ink.dark && ink.light !== ink.dark,
     `${lang}: ★暗い面では、いま居る側の字の色が明るい面と違う（トークンが切り替わっている）`,
     `${ink.light} / ${ink.dark}`);
}

// ── 1. （欠番）ログインしていない人 → §2g ───────────────────────────
/* 2026-10-11 まで、ここは「未ログインはログインへ送られる・戻り先に deep-pay.html を渡す」を
   見ていた。オーナー判断で、送るのをやめた ── ログインしていない人にも、会員の閉じた画面と
   同じ「ぼかした影絵＋板」を出す。見張りは §2g（板・影絵・幅の物差しが §2b〜§2f に在るので、
   それより後ろに置いてある）。字面は ⑭。 */

// ── 2. 鍵が無い人には金額が1文字も出ない ────────────────────────
{
  const { page, errs } = await open('ja', LOCK);
  const s = await page.evaluate(SNAP);
  ok(s.kpi === 0, '鍵が無いと KPI のカードが1枚も出ない', `今 ${s.kpi} 枚`);
  ok(!/[¥$€£]|万/.test(s.text), '★鍵が無いと金額の形をした文字が1つも出ない',
     (s.text.match(/[^\n]*[¥$€£万][^\n]*/) || [''])[0].slice(0, 60));
  ok(s.comp.hidden && s.work.hidden && s.vari.hidden,
     '鍵が無いと 給与構成・働き方・変動給 の節ごと出ない');
  ok(s.pick.hidden && !s.pick.shown,
     '★鍵が無いと区分も選ばせない（どれを選んでも答えは同じ）',
     `hidden=${s.pick.hidden} 見えている=${s.pick.shown}`);
  ok(/pay-report\.html/.test(await page.evaluate(() => document.getElementById('dp-root').innerHTML)),
     '鍵が無い人には「出す」入口を出している（Give → Get）');
  /* ★板の後ろに、ぼかした影絵が在る（2026-10-11・オーナー判断）。本物の読み込みを通った
       錠前で見る ── 描き直しの入口（PVDeepPay.render）を通る細かい筋書きは §2e。 */
  ok(s.ghost === 1 && s.stage === 1 && s.blurred.join(',') === 'dp-ghost',
     '★鍵が無い人の画面は、ぼかした影絵の手前に板（ぼかしが効いているのは影絵だけ）', ghostWhy(s));
  ok(errs.length === 0, '鍵が無い形で JS のエラーが出ない', errs.join(' / '));
}

// ── 2b. 錠前の板の行は、閉じている理由どおりに出る（2026-10-11）──────
/* 閉じている理由は3つ（鍵が無い／本人が答えきっていない／みんなの側＝100人が未達）。
   **当てはまる行だけ**を、当てはまるぶん全部出す。決めるのは deep-pay.js の
   lockLines() 1つで、deep-pay-compare.js にも同じ本体が在る
   （あちらの画面は assert-deep-pay-compare.mjs の §2b が同じ表で見ている）。

   ★2つめは 2026-10-11 に入れ替わった（オーナー判断）。前は「内訳が1つでもあるか」
     （gate.detailed）。いまは「自分に当てはまる項目をぜんぶ答えたか」（gate.ready）で、
     足りない人には**残っている項目の一覧**（gate.todo）が同じ板に出る。
     給与フォームは変えていない ── 足りない分は、板のボタンからフォームで足してもらう。

   ★ここが止めている後戻りは4つ。
     ① 100人の行を「contributors < goal」で出す形 ── 前はそうだった。門は
        「100人以上 **または 手動の公開フラグ**」なので、フラグで開けた日（37人の
        まま開いている）に、鍵の無い人へ「100人に達すること」が出てしまう。
        その人を止めているのは人数ではない。下の表は全部 37 / 100 人のままなので、
        crowd:true の行で100人の行が出たら、それがこの後戻り。
     ② 当てはまる行が無いときに別の行で埋める形 ── 比較の画面に実際に在った
        （鍵も内訳もそろった人に「内訳を出すと開きます」）。
     ③ ready を返さない古いサーバの答えを「答えきっている」と読む形。値が無いのを
        開いている側へ倒さない（`=== true` で読む）。一覧は無いので出さない。
     ④ 断り（虚偽・不正確な情報について）を、頼まれていない人へ出す形。出すのは
        「答えきっていない」の行が出ているとき**だけ**。鍵だけ・人数だけの人には出さない。
   ★{goal}人・{n}人はサイト全体の数で、この画面で人数が出てよいたった1つの行。
     ほかの行に「◯人」が紛れていないことも一緒に見る（一覧の見出しの「2026年9月分」は
     人数の形ではない。物差しがそこで鳴らないことは、下の「物差しの自己点検」が見る）。
   ★板のボタンの行き先は、足りない物に合わせて変わる（deep-pay.js の lockHref）──
       鍵が無く答えきってもいない → フォームの頭 ／ 鍵だけ無い（答えきっている）→ #ps ／
       鍵は在るが答えきっていない → #pay-detail ／ 鍵も答えも在る → フォームの頭。
     **期待する行き先は表に字で書く**（式を写すと、式ごと間違えたときに通る）。
     ⚠️ どの板でも入口は**1本**（板の中に入力は置かない。足りない項目は給与フォームで
        足してもらう）。鍵の無い人の板から pay-report.html が消えないこと（Give → Get の
        入口）は §2 が見ている。 */
const LK = {
  ja: { key:   '給与を1件出すと、90日ぶん開きます。',
        ready: '給与の項目をすべて答えると開きます。',
        goal:  '給与を出したパイロットが100人に達すること（いま37人）。',
        warn:  '虚偽の情報や不正確な情報を提出した場合、利用規約に基づきアカウントを停止することがあります。',
        head:  'まだ答えていない項目（2026年9月分）' },
  en: { key:   'Share one pay report and it opens for 90 days.',
        ready: 'It opens once every item on your pay report is answered.',
        goal:  'It opens once 100 pilots have shared their pay (currently 37).',
        warn:  'Submitting false or inaccurate information may result in suspension of your account under our Terms of Service.',
        head:  'Still unanswered (September 2026)' }
};
/* 残りの一覧の見本（作り物）。2026年9月分・6項目。
   ★並びはサーバが返す順（db/deep-pay.sql の pv_deep_missing の固定の並び）。 */
const TODO6 = { year: 2026, month: 9,
                items: ['command', 'bonus', 'profit', 'duty_h', 'duty_days', 'instructor'] };
const TODO6_NAMES = {
  ja: ['職位手当', '年間ボーナス', 'プロフィットシェア（年額）', '勤務時間（Duty time）',
       '乗務日数（月）', '教官・訓練担当の手当'],
  en: ['Rank / position allowance', 'Annual bonus', 'Profit share (annual)', 'Duty time',
       'Duty days (month)', 'Instructor / Training allowance']
};
/* [名前, 門, 出る行, ボタンの行き先, 一覧が出るか]
   ★頭の6つがオーナー指定の表。残りは組み合わせ（行が重なるとき・古いサーバ）。 */
const LOCK_CASES = [
  ['鍵が無い（まだ1件も出していない）',
   { key: false, ready: false, todo: null,  crowd: true  }, ['key', 'ready'], 'pay-report.html', false],
  ['鍵は在るが答えきっていない（残りの一覧つき）',
   { key: true,  ready: false, todo: TODO6, crowd: true  }, ['ready'], 'pay-report.html#pay-detail', true],
  ['鍵は在るが答えきっていない（一覧なし）',
   { key: true,  ready: false, todo: null,  crowd: true  }, ['ready'], 'pay-report.html#pay-detail', false],
  ['答えきっているが鍵が切れた',
   { key: false, ready: true,  todo: null,  crowd: true  }, ['key'], 'pay-report.html#ps', false],
  ['100人だけ未達',
   { key: true,  ready: true,  todo: null,  crowd: false }, ['goal'], 'pay-report.html', false],
  /* ready を返さない古いサーバ（db/deep-pay.sql を貼る前）。前の鍵 detailed が来ても読まない。
     「答えきっていない・一覧なし」として扱う。 */
  ['古いサーバ（ready が来ない）',
   { key: true,  detailed: true,            crowd: true  }, ['ready'], 'pay-report.html#pay-detail', false],
  // ── ここから組み合わせ ──
  ['3つとも（鍵・答え・100人）',
   { key: false, ready: false, todo: TODO6, crowd: false }, ['key', 'ready', 'goal'], 'pay-report.html', true],
  ['答えと100人',
   { key: true,  ready: false, todo: TODO6, crowd: false }, ['ready', 'goal'], 'pay-report.html#pay-detail', true],
  ['鍵と100人',
   { key: false, ready: true,  todo: null,  crowd: false }, ['key', 'goal'], 'pay-report.html#ps', false],
  ['古いサーバ（ready が来ない・鍵も無い・100人も未達）',
   { key: false, detailed: false,           crowd: false }, ['key', 'ready', 'goal'], 'pay-report.html', false],
  /* 鍵も答えもそろっていて、crowd が来ない。理由が分からないので行を出さない。
     **別の行で埋めない。** 断りも出さない。 */
  ['理由が分からない（crowd が来ない）',
   { key: true,  ready: true,  todo: null }, [], 'pay-report.html', false],
  /* ★足りている人に一覧が付いてきても出さない（サーバは null にして返す。念のため）。 */
  ['答えきっている人に一覧が付いてきた（鍵が切れた）',
   { key: false, ready: true,  todo: TODO6, crowd: true  }, ['key'], 'pay-report.html#ps', false]
];
/* 板の中に在ってよいタグ（錠前の絵・行・一覧・ボタン）。これ以外が1つでも在れば、
   サーバから来た字が HTML として入ったということ。 */
const LOCK_TAGS = ['a', 'div', 'li', 'p', 'path', 'rect', 'svg', 'ul'];
for (const lang of ['ja', 'en']) {
  /* ★1枚の窓で描き直す（試験用の入口 PVDeepPay.render）。本物の読み込みを通った
       錠前は上の §2 が見ている。ここは行の出し分けだけなので、開き直さない
       （12通り × 日英を開き直すと、この Mac では混んで嘘の赤が出る）。 */
  const { page, errs } = await open(lang, LOCK);
  for (const [name, gate, want, href, list] of LOCK_CASES) {
    const g = Object.assign({ contributors: 37, goal: 100 }, gate);
    await page.evaluate((p) => window.PVDeepPay.render(p), lockWith(g));
    const s = await page.evaluate(SNAP);
    const exp = want.map((k) => LK[lang][k]);
    ok(s.lock.on && s.lock.lines.join(' | ') === exp.join(' | '),
       `${lang}: ★錠前の行 ──「${name}」は ${want.length ? want.join('＋') : '行なし'}`,
       `今 ${JSON.stringify(s.lock.lines)}`);
    /* 100人の行を除いた残りに、人数の形の字が無い。 */
    const rest = s.text.split(LK[lang].goal).join('');
    ok(!NOCOUNT.test(rest), `${lang}: ★「${name}」── 100人の行のほかに人数が出ない`, countIn(rest));
    /* ★どの板にもボタンが必ず1本在る（門の組み合わせで消えない）。 */
    ok(s.lock.cta.join(',') === href && s.kpi === 0 && !/[¥$€£]|万/.test(s.text),
       `${lang}: ★「${name}」── 入口は1本・行き先は ${href}・金額は1文字も出ない`,
       s.lock.cta.join(','));
    /* ★断りは「答えきっていない」の行と**必ず一緒**。その行が無い板には出ない。
         置き場所はボタンのすぐ上（断りのすぐ次の要素がボタン）。 */
    const asks = want.includes('ready');
    ok(asks ? (s.lock.warn.join('|') === LK[lang].warn && s.lock.warnAtCta)
            : (s.lock.warn.length === 0 && !s.text.includes(LK[lang].warn)),
       `${lang}: ★「${name}」── 断りは${asks ? 'ボタンのすぐ上に1つ出る' : '出ない'}`,
       JSON.stringify(s.lock.warn) + ' / ' + s.lock.kids.join(' > '));
    /* ★残りの一覧。出るときは「答えきっていない」の行のすぐ下・見出しと名前は字のとおり。
         出ないときは箱ごと無い（見出しだけの空の箱を出さない）。 */
    ok(list ? (s.lock.todoH === LK[lang].head
               && s.lock.todo.join(' | ') === TODO6_NAMES[lang].join(' | ')
               && s.lock.todoPrev === LK[lang].ready)
            : (s.lock.todoH === null && s.lock.todo.length === 0),
       `${lang}: ★「${name}」── 残りの一覧は${list ? '行のすぐ下に、届いた順で出る' : '箱ごと出ない'}`,
       JSON.stringify([s.lock.todoH, s.lock.todo, s.lock.todoPrev]));
    ok(s.lock.tags.every((t) => LOCK_TAGS.includes(t)) && !/null|undefined|NaN|\[object/.test(s.lock.text),
       `${lang}: 「${name}」── 板に余計なタグも null / undefined も無い`,
       s.lock.tags.join(' '));
  }
  /* ★数が欠けていたら 100人の行ごと出さない（0 や空で埋めない）。 */
  await page.evaluate((p) => window.PVDeepPay.render(p),
    lockWith({ key: true, ready: true, todo: null, crowd: false, contributors: null, goal: 100 }));
  const z = await page.evaluate(SNAP);
  ok(z.lock.lines.length === 0 && !/null|undefined|NaN/.test(z.text),
     `${lang}: ★いまの人数が来ていないときは 100人の行ごと出さない（null とも 0 とも書かない）`,
     JSON.stringify(z.lock.lines));
  ok(errs.length === 0, `${lang}: 錠前の板の描き直しで JS のエラーが出ない`, errs.join(' / '));
  /* 窓は見終わったらすぐ閉じる（溜めると、この Mac では混んで嘘の赤が出る）。 */
  await jars.pop().close().catch(() => {});
}

// ── 2c. 「まだ答えていない項目」の一覧（2026-10-11）────────────────────
/* サーバが返すのは**コードだけ**（gate.todo.items）。画面が給与フォームの言葉に直す
   （表は deep-pay.js の todoNames()。フォームの見出しと同じ字であることは ⑫）。
   見るのは5つ ──
     ① 18個ぜんぶが、届いた順に、字のとおり出る（画面の側で並べ替えない）
     ② 表に無いコードは**行ごと出ない**（コードをそのまま画面に出さない）
     ③ サーバから来た字が HTML として入らない（<script> も <img> も、年・月の欄からも）
     ④ 月の見出しが日英とも正しい（1月・12月・年の変わり目）
     ⑤ 見出しだけの空の箱を出さない（一覧が空・全部知らないコード・月が読めない）
   ★物差しの自己点検つき。「◯人」の物差しが月の見出しで鳴らず、頭数ではまだ鳴ること。 */
const ALL18 = ['base', 'guarantee', 'variable', 'command', 'perdiem', 'housing', 'bonus', 'profit',
               'block', 'duty_h', 'duty_days', 'stay', 'roles',
               'instructor', 'examiner', 'union', 'management', 'nonline'];
const ALL18_NAMES = {
  ja: ['基本給', 'Flight time 保証手当 / 職務手当', '変動給', '職位手当',
       'パーディアム（その月の合計）', '住居', '年間ボーナス', 'プロフィットシェア（年額）',
       'フライトタイム', '勤務時間（Duty time）', '乗務日数（月）', 'ステイ日数', '役職・区分',
       '教官・訓練担当の手当', '審査・査察担当の手当', '組合・乗員代表の手当',
       '管理・マネジメントの手当', 'その他の兼務・配属の手当'],
  en: ['Base pay', 'Flight time guarantee / Duty allowance', 'Variable pay',
       'Rank / position allowance', 'Per diem (total for the month)', 'Housing', 'Annual bonus',
       'Profit share (annual)', 'Flight time', 'Duty time', 'Duty days (month)', 'Layover nights',
       'Role', 'Instructor / Training allowance', 'Examiner / Check allowance',
       'Union / Pilot representative allowance', 'Management / Leadership allowance',
       'Other / Non-Line Assignment allowance']
};
{
  /* ── 物差しの自己点検（ブラウザは要らない）──
     月の見出しは「数字＋年／月」。NOCOUNT が見ているのは「数字＋人／名／pilots」なので
     鳴らないはず。鳴らないことと、**頭数ではまだ鳴る**ことの両方を固定する
     （見出しを通すために物差しを緩めた、を作らない）。 */
  for (const t of ['まだ答えていない項目（2026年9月分）', 'Still unanswered (September 2026)',
                   'まだ答えていない項目（2025年12月分）\n基本給', 'Still unanswered (January 2026)\nBase pay'])
    ok(!NOCOUNT.test(t), `物差し: 月の見出しでは鳴らない ──「${t.replace(/\n/g, ' ⏎ ')}」`, countIn(t));
  for (const t of ['まだ答えていない項目（2026年9月分）12人', '12人', '全体で 3 名', '12 pilots',
                   'Still unanswered (September 2026) 12 pilots', '2026 pilots'])
    ok(NOCOUNT.test(t), `物差し: 頭数ではまだ鳴る ──「${t}」`);
}
const todoGate = (todo, more) => lockWith(Object.assign(
  { key: true, ready: false, todo: todo, crowd: true, contributors: 37, goal: 100 }, more || {}));
for (const lang of ['ja', 'en']) {
  const { page, errs } = await open(lang, LOCK);
  const draw = async (todo, more) => {
    await page.evaluate((p) => window.PVDeepPay.render(p), todoGate(todo, more));
    return page.evaluate(SNAP);
  };

  // ① 18個ぜんぶ・届いた順
  let s = await draw({ year: 2026, month: 9, items: ALL18 });
  ok(s.lock.todo.join(' | ') === ALL18_NAMES[lang].join(' | '),
     `${lang}: ★18項目ぜんぶが、届いた順に、フォームと同じ名前で出る`,
     JSON.stringify(s.lock.todo));
  /* ★並べ替えない。逆順で渡せば逆順で出る（表の順に並べ直していない）。 */
  s = await draw({ year: 2026, month: 9, items: ALL18.slice().reverse() });
  ok(s.lock.todo.join(' | ') === ALL18_NAMES[lang].slice().reverse().join(' | '),
     `${lang}: ★並びは届いた順のまま（画面の側で並べ替えない）`, JSON.stringify(s.lock.todo.slice(0, 3)));
  /* 同じコードが2回来ても1回だけ。 */
  s = await draw({ year: 2026, month: 9, items: ['bonus', 'bonus', 'command', 'bonus'] });
  ok(s.lock.todo.join(' | ') === [ALL18_NAMES[lang][6], ALL18_NAMES[lang][3]].join(' | '),
     `${lang}: 同じコードが重なって来ても1回だけ出る`, JSON.stringify(s.lock.todo));

  // ②③ 知らないコード・HTML の形をした字
  await page.evaluate(() => { window.__xss = 0; });
  const BAD = ['command', 'zzz_new_item', '<img src=x onerror="window.__xss=1">',
               '<script>window.__xss=1</script>', '<b>bonus</b>', 'constructor', '__proto__',
               'toString', 'hasOwnProperty', 'item', 'role', 'sfx', '', ' bonus', 'BONUS',
               42, null, true, { k: 'bonus' }, ['bonus'], 'profit'];
  s = await draw({ year: 2026, month: 9, items: BAD });
  /* ★字でないもの（数・真偽・入れ物・配列）はコードとして読まない。['bonus'] を
       'bonus' と読み替えない。前後に空白の付いた字・大文字も別物。
       残るのは頭の command と尻の profit の2つだけ。 */
  ok(s.lock.todo.join(' | ') === [ALL18_NAMES[lang][3], ALL18_NAMES[lang][7]].join(' | '),
     `${lang}: ★★表に無いコードは行ごと出ない（知っている2つだけが残る）`, JSON.stringify(s.lock.todo));
  ok(!/zzz_new_item|constructor|__proto__|toString|hasOwnProperty|onerror|__xss|BONUS|\[object|function /.test(s.lock.text),
     `${lang}: ★★知らないコードを、そのままの字でも出さない`,
     (s.lock.text.match(/[^\n]*(zzz_new_item|constructor|__proto__|toString|onerror|\[object)[^\n]*/) || [''])[0]);
  ok(s.lock.tags.every((t) => LOCK_TAGS.includes(t)) && !/<img|<script|<b>|onerror/i.test(s.lock.raw)
     && (await page.evaluate(() => window.__xss)) === 0,
     `${lang}: ★★HTML の形をしたコードが、タグとして入らない（実行もされない）`, s.lock.tags.join(' '));
  /* 年・月の欄に字が来ても、HTML にも見出しにも入らない（数に直せなければ一覧ごと出さない）。 */
  for (const [what, todo] of [
    ['年がタグつきの字', { year: '<b>2026</b>', month: 9, items: ['bonus'] }],
    ['月がスクリプトの字', { year: 2026, month: '<script>window.__xss=1</script>', items: ['bonus'] }],
    ['月が13', { year: 2026, month: 13, items: ['bonus'] }],
    ['月が0', { year: 2026, month: 0, items: ['bonus'] }],
    ['月が小数', { year: 2026, month: 9.5, items: ['bonus'] }],
    ['年が無い', { month: 9, items: ['bonus'] }],
    ['年が5桁', { year: 20260, month: 9, items: ['bonus'] }]]) {
    s = await draw(todo);
    ok(s.lock.todoH === null && s.lock.todo.length === 0
       && s.lock.lines.join('|') === LK[lang].ready && s.lock.warn.length === 1
       && s.lock.tags.every((t) => LOCK_TAGS.includes(t))
       && !/<b>|<script/i.test(s.lock.raw) && !/NaN|undefined|null/.test(s.lock.text)
       && (await page.evaluate(() => window.__xss)) === 0,
       `${lang}: ★月が読めない（${what}）ときは一覧ごと出さない ── 行と断りは残る`,
       JSON.stringify([s.lock.todoH, s.lock.todo]));
  }
  /* 数として読める字（"2026"・"9"）は通す ── jsonb は数で来るが、字で来ても同じ月。 */
  s = await draw({ year: '2026', month: '9', items: ['bonus'] });
  ok(s.lock.todoH === LK[lang].head, `${lang}: 年・月が数字の字で来ても同じ見出し`, String(s.lock.todoH));

  // ④ 月の見出し
  for (const [y, m, ja, en] of [[2026, 1, '2026年1月分', 'January 2026'],
                                [2025, 12, '2025年12月分', 'December 2025'],
                                [2026, 10, '2026年10月分', 'October 2026']]) {
    s = await draw({ year: y, month: m, items: ['bonus'] });
    const want = lang === 'ja' ? `まだ答えていない項目（${ja}）` : `Still unanswered (${en})`;
    ok(s.lock.todoH === want, `${lang}: ★月の見出し ── ${y}-${m} →「${want}」`, String(s.lock.todoH));
  }

  // ⑤ 空の箱を出さない
  for (const [what, todo] of [
    ['一覧が空', { year: 2026, month: 9, items: [] }],
    ['全部知らないコード', { year: 2026, month: 9, items: ['zzz_a', 'zzz_b'] }],
    ['items が配列でない', { year: 2026, month: 9, items: 'bonus' }],
    ['items が無い', { year: 2026, month: 9 }],
    ['todo が字', 'bonus'],
    ['todo が配列', ['bonus']]]) {
    s = await draw(todo);
    ok(s.lock.todoH === null && s.lock.todo.length === 0 && s.lock.lines.join('|') === LK[lang].ready,
       `${lang}: ★${what} ── 見出しだけの空の箱を出さない（行はそのまま）`,
       JSON.stringify([s.lock.todoH, s.lock.todo, s.lock.lines]));
  }
  ok(errs.length === 0, `${lang}: 一覧の描き直しで JS のエラーが出ない`, errs.join(' / '));
  await jars.pop().close().catch(() => {});
}

// ── 2d. 一覧つきの板が、どの幅でもはみ出さない・暗い面でも読める（2026-10-11）──
/* ★いちばん長い形（18項目ぜんぶ ＋ 100人の行）を、320 / 390 / 1440 で測る。
     英語の札のいちばん長い1つ（Union / Pilot representative allowance）は 320px の
     器より長い ── 札の中で折り返すので、**外へは出ない**ことを見る。
   ★読めるかは「字の色と、その下の面の色の差」で見る（コントラスト比 4.5 以上）。
     明暗とも。トークンを取り違えて面と同じ色の字を置いた回に赤くなる。
   ⚠️ 時間で待たない。幅が本当に変わってから測る。 */
const LOCK_FIT = () => {
  const vw = document.documentElement.clientWidth;
  const m = document.querySelector('.dp-msg--lock');
  if (!m) return null;
  const mb = m.getBoundingClientRect();
  const out = [], cut = [];
  for (const e of m.querySelectorAll('*')) {
    const r = e.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.right > mb.right + 1 || r.left < mb.left - 1 || r.right > vw + 1 || r.left < -1)
      out.push((e.className || e.tagName) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
  }
  for (const e of m.querySelectorAll('.dp-todo-i, .dp-todo-h, .dp-msg-s, .dp-msg-w, .dp-cta'))
    if (e.scrollWidth > e.clientWidth + 1) cut.push(e.textContent.slice(0, 24));
  /* 札どうしが重なっていない（折り返しが壊れると、次の札が上に乗る）。 */
  const chips = [...m.querySelectorAll('.dp-todo-i')].map((e) => e.getBoundingClientRect());
  let lap = 0;
  for (let i = 0; i < chips.length; i++) for (let j = i + 1; j < chips.length; j++) {
    const a = chips[i], b = chips[j];
    if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) lap++;
  }
  /* 字の色 ⇄ その下の面の色。面は、透けていない祖先に当たるまで重ねて求める。 */
  const rgba = (c) => { const x = (c.match(/[\d.]+/g) || []).map(Number);
    return { r: x[0] || 0, g: x[1] || 0, b: x[2] || 0, a: x.length > 3 ? x[3] : 1 }; };
  const under = (e) => {
    const stack = [];
    for (let n = e; n; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor);
      if (c.a > 0) { stack.push(c); if (c.a >= 1) break; }
    }
    let o = { r: 255, g: 255, b: 255 };
    for (let i = stack.length - 1; i >= 0; i--) {
      const c = stack[i];
      o = { r: c.r * c.a + o.r * (1 - c.a), g: c.g * c.a + o.g * (1 - c.a), b: c.b * c.a + o.b * (1 - c.a) };
    }
    return o;
  };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (e) => { const a = lum(rgba(getComputedStyle(e).color)), b = lum(under(e));
    return Math.round((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) * 100) / 100; };
  const one = (s) => { const e = m.querySelector(s); return e ? ratio(e) : null; };
  return { vw, over: document.documentElement.scrollWidth - vw, out, cut, lap,
           chips: chips.length, rows: new Set(chips.map((r) => Math.round(r.top))).size,
           h: Math.round(mb.height),
           con: { line: one('.dp-msg-s'), head: one('.dp-todo-h'), chip: one('.dp-todo-i'),
                  warn: one('.dp-msg-w'), title: one('.dp-msg-t') } };
};
for (const lang of ['ja', 'en']) {
  for (const theme of ['light', 'dark']) {
    const { page, errs } = await open(lang, LOCK, theme);
    await page.evaluate((p) => window.PVDeepPay.render(p),
      todoGate({ year: 2026, month: 9, items: ALL18 }, { crowd: false }));
    /* 幅は明るいほうで3つ・暗いほうは色だけ見ればよいので1つ（窓を増やさない）。 */
    for (const w of (theme === 'light' ? [320, 390, 1440] : [390])) {
      await page.setViewport({ width: w, height: 1000 });
      await page.waitForFunction((x) => innerWidth === x, { timeout: 10000 }, w);
      const f = await page.evaluate(LOCK_FIT);
      ok(!!f && f.chips === 18 && f.over <= 1 && f.out.length === 0,
         `${lang}/${theme}/${w}: ★一覧つきの板が横に溢れない（18項目）`,
         f ? `文書 +${f.over}px / 外へ出た ${f.out.slice(0, 4).join(' ｜ ')}` : '板が無い');
      ok(!!f && f.cut.length === 0 && f.lap === 0,
         `${lang}/${theme}/${w}: ★札も行も切れていない・札どうしが重なっていない`,
         f ? `切れ ${f.cut.join(' ｜ ')} / 重なり ${f.lap}` : '');
      /* 広い画面では札が横に並ぶ（1行に1つずつの縦長の板になっていない）。 */
      if (w === 1440)
        ok(!!f && f.rows <= 6, `${lang}/${theme}/${w}: 広い画面では札が横に並んで折り返す（18枚が ${f && f.rows} 段）`);
    }
    const c = (await page.evaluate(LOCK_FIT) || { con: {} }).con;
    ok(['line', 'head', 'chip', 'warn', 'title'].every((k) => c[k] != null && c[k] >= 4.5),
       `${lang}/${theme}: ★行・見出し・札・断りの字が、下の面から読める（コントラスト比 4.5 以上）`,
       JSON.stringify(c));
    ok(errs.length === 0, `${lang}/${theme}: 幅を変えても JS のエラーが出ない`, errs.join(' / '));
    await jars.pop().close().catch(() => {});
  }
}

// ── 2e. ぼかした影絵と、その手前の板（2026-10-11・オーナー判断）──────────────
/* 「DEEP PAY でまだ開かない人には給与詳細を提出させる。背景にはぼかした DEEP PAY を
     表示させる。」── 閉じた画面は、ぼかした影絵（.dp-ghost）の手前に、今までの板を出す。

   ★★ぼかしは隠す道具ではない（開発者ツールで誰でも外せる）。だからここが見るのは
     「ぼかしが強いか」ではなく、**ぼかしの下に、見られて困るものが何も無いこと**。
     影絵が字を1文字も持たないこと・サーバの答えが影絵にも画面のどこにも出ないことを、
     ぼかしを無視して（textContent と innerHTML で）見る。

   見るのは、閉じている理由の12通り（§2b の LOCK_CASES）× 日英 × 明暗 × 320 / 390 / 1440：
     在る    … 影絵が1つ・器が1つ・器の中は「影絵 → 板」の順・影絵が器いっぱいに敷いてある・
               本文でぼかしが効いているのは影絵**だけ**
     触れない … aria-hidden="true" と inert・中に焦点の当たるものが無い・pointer-events:none・
               選べない・器の隅を押しても影絵の中の要素が返らない
     ぼかし  … 計算後の filter が blur(6〜10px)
     空      … textContent が空（字が1文字も無い＝数字も通貨記号も社名も無い）・
               class と style のほかに属性が無い・タグは div / i / span だけ
     板      … 面が透けていない（背景の α が 1）・画面の幅に収まる・器の左右の真ん中・
               幅は 640px まで・**縦は窓の真ん中あたり**（下の「板の縦の置き場所」。
               スマホでは真ん中に置かず、見出しの下から）・板の上に何も乗っていない・
               器からはみ出さない・影が重ねてある
     押せる  … ボタンの真ん中を押すと、当たるのはボタン
     収まる  … 横スクロールが生えない・板の中身が切れない・器が、板と窓のどちらに対しても
               伸びすぎない
     読める  … 板の字と、その下の面（板そのものの面）の差が 4.5 以上
   ★1つの幅ぶんを1行にまとめて出す（12通りを1行ずつ出すと 1,000 行を超える）。
     落ちたときは、どの理由の板で落ちたかを添える。
   ⚠️ 窓は 日英 × 明暗 の4枚だけ。理由と幅は、同じ窓で描き直して回す（開き直すと、
      この Mac では混んで嘘の赤が出る）。時間では待たない。 */
const GHOST_FIT = () => {
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const gs = document.querySelectorAll('.dp-ghost'), st = document.querySelectorAll('.dp-stage');
  const blurred = [...document.querySelectorAll('main *')].filter((e) => {
    const cs = getComputedStyle(e);
    return (cs.filter && cs.filter !== 'none') || (cs.backdropFilter && cs.backdropFilter !== 'none');
  }).map((e) => String(e.className || e.tagName).split(' ')[0]);
  const o = { vw, ghost: gs.length, stage: st.length, blurred,
              over: document.documentElement.scrollWidth - vw };
  if (gs.length !== 1 || st.length !== 1) return o;
  const e = gs[0], stage = st[0], cs = getComputedStyle(e);
  const m = stage.querySelector(':scope > .dp-msg');
  const a = m && m.querySelector('a.dp-cta');
  if (!m || !a) return o;
  window.scrollTo(0, 0);
  const r1 = (v) => Math.round(v * 10) / 10;
  const gr = e.getBoundingClientRect(), sr = stage.getBoundingClientRect(), mb = m.getBoundingClientRect();
  /* 見出しの塊（概要は #dp-hd ＝ .mr-hd・会社比較は見出しと添え書きを包む .dc-top）。 */
  const hd = document.querySelector('.dc-top') || document.querySelector('.mr-hd');
  const all = [...e.querySelectorAll('*')];
  o.kids = [...stage.children].map((c) => String(c.className).split(' ')[0]).join(' ');
  o.aria = e.getAttribute('aria-hidden');
  o.inert = e.hasAttribute('inert') && e.inert === true;
  o.blur = Number((/blur\(([\d.]+)px\)/.exec(cs.filter) || [])[1]);
  o.pe = cs.pointerEvents;
  o.us = cs.userSelect || cs.webkitUserSelect;
  o.text = e.textContent;
  o.shapes = all.length;
  o.tags = [...new Set(all.map((x) => x.tagName.toLowerCase()))].sort().join(' ');
  o.focusable = e.querySelectorAll(
    'a,button,input,select,textarea,summary,iframe,[tabindex],[contenteditable]').length;
  o.attrs = all.reduce((n, x) =>
    n + [...x.attributes].filter((t) => !/^(class|style)$/.test(t.name)).length, 0);
  o.cover = ['left', 'right', 'top', 'bottom'].every((k) => Math.abs(gr[k] - sr[k]) <= 1);
  o.stageH = Math.round(sr.height); o.boardH = Math.round(mb.height); o.boardW = Math.round(mb.width);
  o.left = r1(mb.left); o.right = r1(mb.right);
  o.centre = r1((mb.left + mb.right) / 2 - (sr.left + sr.right) / 2);
  o.topGap = Math.round(mb.top - sr.top);
  o.underTitle = hd ? Math.round(mb.top - hd.getBoundingClientRect().bottom) : null;
  o.inside = mb.bottom <= sr.bottom + 1;
  /* 縦の置き場所（2026-10-11）。★窓に対して測る（いちばん上までスクロールした状態）。
     mid   ＝ 板の真ん中が、窓の高さの何 % のところに在るか
     below ＝ 板の下に、器（影絵）が何 px 残っているか
     reach ＝ 板の下の端まで、ページをスクロールして届くか */
  const bar = document.querySelector('.mr-top');
  o.vh = vh;
  o.top = r1(mb.top); o.bottom = r1(mb.bottom);
  o.mid = r1((mb.top + mb.bottom) / 2 / vh * 100);
  o.below = Math.round(sr.bottom - mb.bottom);
  o.underBar = bar ? Math.round(mb.top - bar.getBoundingClientRect().bottom) : null;
  o.reach = document.documentElement.scrollHeight >= mb.bottom - 1;
  const bg = (getComputedStyle(m).backgroundColor.match(/[\d.]+/g) || []).map(Number);
  o.alpha = bg.length > 3 ? bg[3] : (bg.length === 3 ? 1 : 0);
  o.shadows = (getComputedStyle(m).boxShadow.match(/rgba?\(|color\(/g) || []).length;
  o.z = [Number(cs.zIndex), Number(getComputedStyle(m).zIndex)];
  /* 板の上に何も乗っていない ── 板の9点（見えている範囲）で、当たるのが板の中の要素。
     ★隅は 12px 内へ入れる。板の角は丸い（--pv-r-lg ＝ 20px）ので、6px だと丸みの外＝
       器の面に当たる点ができる（実際に英語の 1440 で1点だけ外れた）。 */
  const yb = Math.min(mb.bottom - 12, vh - 12);
  const pts = [];
  for (const px of [mb.left + 12, (mb.left + mb.right) / 2, mb.right - 12])
    for (const py of [mb.top + 12, (mb.top + yb) / 2, yb]) pts.push([px, py]);
  o.covered = pts.filter(([px, py]) => {
    const t = document.elementFromPoint(px, py);
    return !(t && m.contains(t));
  }).length;
  /* 影絵は押せない ── 器の左下の隅（板の外）を押しても、影絵の中の要素は返らない。 */
  const t2 = document.elementFromPoint(sr.left + 4, Math.min(sr.bottom - 8, vh - 8));
  o.hitGhost = !!(t2 && e.contains(t2));
  /* ボタンの真ん中を押すと、当たるのはボタン。 */
  a.scrollIntoView({ block: 'center' });
  const ar = a.getBoundingClientRect();
  const t3 = document.elementFromPoint((ar.left + ar.right) / 2, (ar.top + ar.bottom) / 2);
  o.btn = !!(t3 && (t3 === a || a.contains(t3)));
  o.btnIn = ar.left >= mb.left - 0.5 && ar.right <= mb.right + 0.5 && ar.right <= vw + 0.5;
  window.scrollTo(0, 0);
  return o;
};
/* Tab を押して回る。影絵の中に焦点が入らないこと・板のボタンには届くことを見る。
   ★終わりは「同じ要素にもう一度来た」＝ページを一周した、で決める（時間では待たない）。
     body に来たことでは決めない ── どこから回り始めるかは Chrome が持っていて
     （直前に触った場所の次から始まる）、1回目の Tab が body に落ちる回も、いきなり
     板のボタンに来る回もある（実際に両方踏んだ）。 */
async function tabWalk(page) {
  await page.evaluate(() => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    window.scrollTo(0, 0);
    window.__tabSeen = new Set();
  });
  const seen = [];
  for (let i = 0; i < 160; i++) {
    await page.keyboard.press('Tab');
    const s = await page.evaluate(() => {
      const a = document.activeElement;
      const body = !a || a === document.body || a === document.documentElement;
      const again = !body && window.__tabSeen.has(a);
      if (!body) window.__tabSeen.add(a);
      return { body, again,
               ghost: !!(a && a.closest && a.closest('.dp-ghost')),
               cta: !!(a && a.matches && a.matches('.dp-stage a.dp-cta')) };
    });
    if (s.again) break;
    seen.push(s);
  }
  return seen;
}
/* 幅を変えたあと、左メニューが落ち着くまで待つ。★狭い幅では右から出る引き出しになり、
   閉じるのに 0.32 秒かけて画面の外へ滑る（app-nav.css の transform）。そのあいだは板の上に
   居るので、すぐ elementFromPoint を呼ぶと「板の上に何か乗っている」と読み違える
   （実際に 320 と 390 で踏んだ）。時間では待たない ── 居場所で待つ。 */
async function navStill(page) {
  await page.waitForFunction(() => {
    const n = document.querySelector('nav.mr-side');
    if (!n) return true;
    const r = n.getBoundingClientRect();
    if (innerWidth > 1000) return r.left >= -1 && r.right <= 200;
    return getComputedStyle(n).visibility === 'hidden' || r.left >= innerWidth - 1 || r.right <= 1;
  }, { timeout: 10000 });
}
/* ── 板の縦の置き場所（2026-10-11・オーナー指示「ポップアップはわかりやすいように
     画面のもう少し真ん中にして」）──────────────────────────────
   それまで板は見出しのすぐ下に寄せてあった（この検査も「器の上から 40px 以内」を見ていた）。
   いまは、広い画面では**窓の縦の真ん中あたり**に置く。決まりは3つ：
     ① 収まるとき ── 板の真ん中が、窓の高さの MID（43〜49%）に在る。狙いは 46%
        （deep-pay.css の .dp-stage の「真ん中に置くための段」）。**器ではなく窓に対して測る。**
        帯に幅があるのは、器の上の端（ヘッダー＋見出しの高さ）が画面と幅で 131〜154px と
        違うのを、CSS が1つの数（142px）で受けているから（狙いから ±12px ＝ 窓 760px で ±1.6%）。
     ② 収まらないとき（項目の多い一覧・背の低い窓）── 板は上の余白（PAD_WIDE ＝ 36px）の
        すぐ下から始まる。真ん中は帯より下に来るが、それ以上は上がれない、ということ。
        **見出しにもヘッダーにも掛からない・切れない**（器ごと伸びて、ページがスクロールする）。
     ③ スマホ（640px 以下）── 真ん中に置かない。器の上の端から GAP_PHONE（20〜28px。
        CSS は 24px）。板の高さに関わらず同じ場所。
   ★①と②を1つの式で見る ──「真ん中が帯より上に無い」かつ「帯より下に在るなら、板は
     上の余白にぴったり付いている」。CSS の段の高さ（92vh − 356px）を写していない
     ＝ 写しが腐って嘘の緑になることが無い。
   ★どちらの形になったかは、下の「窓の大きさを変えて測る」の節が、形を名指しして見る
     （この式だけだと、どの板もたまたま②になっている回に気づけない）。 */
const MID = [43, 49];
const PAD_WIDE = 36;
const GAP_PHONE = [20, 28];
const placeWhy = (f, w) => {
  if (!(f.underTitle >= 1 && f.underBar >= 1 && f.topGap >= 0))
    return `見出しかヘッダーに掛かっている（見出しの下から ${f.underTitle}px・ヘッダーの下から ${f.underBar}px）`;
  if (w <= 640)
    return (f.topGap >= GAP_PHONE[0] && f.topGap <= GAP_PHONE[1] && f.underTitle <= GAP_PHONE[1] + 16)
      ? '' : `スマホ：器の上から ${f.topGap}px・見出しの下から ${f.underTitle}px`;
  if (f.topGap < PAD_WIDE - 1) return `上の余白が足りない（器の上から ${f.topGap}px）`;
  if (f.mid < MID[0]) return `真ん中より上に在る（窓の ${f.mid}%・器の上から ${f.topGap}px）`;
  if (f.mid > MID[1] && f.topGap > PAD_WIDE + 1)
    return `真ん中より下に在る（窓の ${f.mid}%。まだ ${f.topGap - PAD_WIDE}px 上がれる）`;
  return '';
};
/* 12通りを1つの幅で回して、落ちた理由の名前を種類ごとに集める。 */
const GHOST_KINDS = [
  ['exist', '★★どの理由でも、影絵が1つ・器が1つ・「影絵 → 板」の順（ぼかしが効くのは影絵だけ）'],
  ['touch', '★★影絵は aria-hidden ＋ inert・焦点の当たるものが無い・押せない・選べない'],
  ['blur',  '★影絵に、ぼかしが実際に効いている（計算後の filter が blur(6〜10px)）'],
  ['empty', '★★影絵に字が1文字も無い（数字も通貨記号も無い）・class と style のほかに属性が無い'],
  ['board', '★板は手前・面が透けていない・幅に収まり左右の真ん中・縦は窓の真ん中あたり（スマホは見出しの下）・何も乗っていない'],
  ['click', '★板のボタンの真ん中を押すと、当たるのはボタン'],
  ['fit',   '★横スクロールが生えない・板の中身が切れない・器が伸びすぎない'],
  ['con',   '★板の字が、板の面から読める（コントラスト比 4.5 以上）']
];
const ghostBad = (f, c, w) => {
  const bad = {};
  if (!(f.ghost === 1 && f.stage === 1 && f.kids === 'dp-ghost dp-msg' && f.cover
        && f.blurred.join(',') === 'dp-ghost'))
    bad.exist = `影絵 ${f.ghost} 器 ${f.stage} 並び「${f.kids}」敷き ${f.cover} ぼかし ${f.blurred.join(',')}`;
  if (f.ghost !== 1 || f.stage !== 1 || f.kids !== 'dp-ghost dp-msg') return bad;
  if (!(f.aria === 'true' && f.inert && f.focusable === 0 && f.pe === 'none' && f.us === 'none'
        && !f.hitGhost))
    bad.touch = `aria=${f.aria} inert=${f.inert} 焦点 ${f.focusable} pe=${f.pe} us=${f.us} 隅で当たる=${f.hitGhost}`;
  if (!(f.blur >= 6 && f.blur <= 10)) bad.blur = `blur ${f.blur}`;
  if (!(f.text === '' && f.attrs === 0 && f.shapes >= 40 && f.tags === 'div i span'))
    bad.empty = `字 ${JSON.stringify(String(f.text).slice(0, 30))} 属性 ${f.attrs} 形 ${f.shapes} タグ ${f.tags}`;
  const place = placeWhy(f, w);
  if (!(f.alpha >= 0.99 && f.left >= 0 && f.right <= f.vw + 0.5 && Math.abs(f.centre) <= 1
        && f.boardW <= 640 && f.covered === 0 && f.inside && f.z[1] > f.z[0] && f.shadows >= 3
        && !place))
    bad.board = `α ${f.alpha} 左右 ${f.left}..${f.right}/${f.vw} ずれ ${f.centre} 幅 ${f.boardW} 乗っている点 ${f.covered}`
      + ` はみ出し ${!f.inside} z ${f.z} 影 ${f.shadows} 縦 ${place || `窓の ${f.mid}%`}`;
  if (!(f.btn && f.btnIn)) bad.click = `当たる=${f.btn} 板の中=${f.btnIn}`;
  /* ★器の高さは、次の3つのいちばん大きいものまで。それを超えて伸びていたら、影絵の中身に
       器が引っぱられている（影絵は器の高さを決めない ── スマホの影絵は中身が 1,800px ほど在り、
       1000px 以下の幅でも列が縦に畳まれて 1,000px を超える）。
       ・760px（器の素の高さの頭打ち。＋20 は端数）
       ・板 ＋ 上下の余白（いちばん広いのはスマホの 24＋200px。下の 200px は、板の下に
         影絵を覗かせる場所）
       ・広い画面だけ：窓の高さ − 200px。板を窓の真ん中へ置くための段（2026-10-11）が
         器を押し広げる分で、背の高い窓（1,080px あたりから上）でだけ 760px を超える。
         段が決める器の高さは 上の余白 36 ＋ 段（92vh − 356px）＋ 下の余白 88 ＝ 窓の 92% − 232px。
         板の真ん中の狙いが窓の半分より上に在るかぎり、「窓 − 200px」を超えることは無い
         （狙いを動かしても、この線は動かさなくてよい）。
         ⚠️ この項が通すのは窓より低い器だけ。窓より長い影絵の中身（＝捕まえたい伸び）は通さない。 */
  if (!(f.over <= 1 && c.out.length === 0 && c.cut.length === 0
        && f.stageH <= Math.max(780, f.boardH + 230, w > 640 ? f.vh - 200 : 0)))
    bad.fit = `文書 +${f.over}px 外 ${c.out.slice(0, 2).join(' ')} 切れ ${c.cut.slice(0, 2).join(' ')} 器 ${f.stageH} 板 ${f.boardH} 窓 ${f.vh}`;
  const con = c.con || {};
  if (!(con.title != null && Object.keys(con).every((k) => con[k] == null || con[k] >= 4.5)))
    bad.con = JSON.stringify(con);
  return bad;
};
/* ── 窓の大きさを変えて、板の縦の置き場所を測る（2026-10-11）──────────────
   上の ghostBad は窓の高さ 1000px でしか回らない。板の置き場所は**窓の高さで決まる**ので、
   高さを変えて、どの形になったかを名指しで見る（決まりは上の「板の縦の置き場所」）：
     PLACE_FIT   … 収まる窓。板の真ん中が窓の 43〜49%・板がまるごと窓の中・見出しにも
                   ヘッダーにも掛からない・板の上にも下にも影絵が見えている・左右の真ん中。
                   ★高さの違う板を続けて描いて、**低い板ほど下から始まる**ことも見る
                     ── 上に寄せているだけなら、どの板も同じ場所から始まる。
     PLACE_TALL  … 収まらない窓（1024×620 に 3行＋18項目の板）。板は上の余白のすぐ下から・
                   真ん中は帯より下（＝本当に「収まらない形」を踏んでいる）・板が切れない・
                   器が板ごと伸びる・板の下の端までスクロールで届く。
     PLACE_PHONE … スマホ。器の上の端から 20〜28px・**板の高さが違っても同じ場所から**
                   （真ん中に置いていない）・板の頭は窓の上から3分の1より上・板の下に
                   影絵が覗いている・横スクロールが生えない。
   boards … [[名前, 描く関数]]。描く関数が null なら、いま出ている板のまま測る
            （ログインしていない人の板は、試験用の入口からは描けない）。
   tall   … 収まらない板を描く関数。渡さなければ、PLACE_TALL では置き場所の決まりだけを見る。
   ★窓は増やさない（呼んだ側の窓を、大きさだけ変えて使い回す）。終わりに 1440×1000 へ戻す。
   ⚠️ 時間で待たない。窓の幅と高さが本当に変わり、左メニューが止まってから測る。 */
const PLACE_FIT = [[1440, 1000], [1440, 760], [1024, 768], [768, 1024]];
const PLACE_TALL = [1024, 620];
const PLACE_PHONE = [[390, 844], [320, 640]];
async function sizeTo(page, w, h) {
  await page.setViewport({ width: w, height: h });
  await page.waitForFunction((x, y) => innerWidth === x && innerHeight === y, { timeout: 10000 }, w, h);
  await navStill(page);
}
async function placeAt(page, tag, boards, tall) {
  const fitOf = async (draw) => {
    if (draw) await draw();
    return (await page.evaluate(GHOST_FIT)) || {};
  };
  const all = async () => {
    const got = [];
    for (const [name, draw] of boards) got.push([name, await fitOf(draw)]);
    return got;
  };
  const say = (got, k, unit) => got.map(([n, f]) => `${n} ${f[k]}${unit}`).join('・');
  /* 低い板ほど下から始まる（高さが 16px より違う組だけ比べる）。 */
  const lowerWhenShorter = (got) => got.every(([, a]) => got.every(([, b]) =>
    !(a.boardH + 16 < b.boardH) || a.top > b.top + 4));

  for (const [w, h] of PLACE_FIT) {
    await sizeTo(page, w, h);
    const got = await all();
    ok(got.every(([, f]) => f.stage === 1 && f.mid >= MID[0] && f.mid <= MID[1]),
       `${tag}/${w}×${h}: ★★板の真ん中が、窓の高さの ${MID[0]}〜${MID[1]}% に在る（${say(got, 'mid', '%')}）`,
       say(got, 'top', 'px') + ' / 板の高さ ' + say(got, 'boardH', 'px'));
    ok(got.every(([, f]) => f.top >= 0 && f.bottom <= f.vh && f.underTitle >= PAD_WIDE && f.underBar >= PAD_WIDE
         && f.topGap >= PAD_WIDE - 1 && f.below >= 80 && f.inside
         && Math.abs(f.centre) <= 1 && f.over <= 0)
       && lowerWhenShorter(got),
       `${tag}/${w}×${h}: ★板がまるごと窓の中・見出しにもヘッダーにも掛からない・上にも下にも影絵が見える・左右の真ん中`
         + (got.length > 1 ? '・低い板ほど下から始まる' : ''),
       got.map(([n, f]) => `${n} ${f.top}..${f.bottom}/${f.vh} 見出しの下 ${f.underTitle} 下の影絵 ${f.below} ずれ ${f.centre} 横 +${f.over}`).join(' ｜ '));
  }

  {
    const [w, h] = PLACE_TALL;
    await sizeTo(page, w, h);
    const got = await all();
    ok(got.every(([, f]) => f.stage === 1 && !placeWhy(f, w) && f.inside && f.reach && f.over <= 0),
       `${tag}/${w}×${h}: ★背の低い窓でも、板は見出しに掛からず、収まる板は真ん中・収まらない板は上の余白のすぐ下（${say(got, 'mid', '%')}）`,
       got.map(([n, f]) => `${n} ${placeWhy(f, w) || 'ok'} 器の上から ${f.topGap}`).join(' ｜ '));
    if (tall) {
      const f = await fitOf(tall);
      const c = (await page.evaluate(LOCK_FIT)) || { out: ['板が無い'], cut: [] };
      ok(f.stage === 1 && Math.abs(f.topGap - PAD_WIDE) <= 1 && f.mid > MID[1]
         && f.underTitle >= PAD_WIDE && f.underBar >= PAD_WIDE,
         `${tag}/${w}×${h}: ★★収まらない板（3行＋18項目・高さ ${f.boardH}px）は、上の余白（${PAD_WIDE}px）のすぐ下から始まる ── 見出しに潜らない`,
         `器の上から ${f.topGap} 見出しの下から ${f.underTitle} 真ん中 ${f.mid}% 下の端 ${f.bottom}/${f.vh}`);
      ok(f.inside && f.below >= 80 && f.reach && f.stageH >= f.boardH + PAD_WIDE + 80
         && c.out.length === 0 && c.cut.length === 0 && Math.abs(f.centre) <= 1 && f.over <= 0,
         `${tag}/${w}×${h}: ★★その板は切れない ── 器が板ごと伸び（${f.stageH}px）、下の端までスクロールで届く・横にも溢れない`,
         `器の中=${f.inside} 下の影絵 ${f.below} 届く=${f.reach} 外 ${c.out.slice(0, 2).join(' ')} 切れ ${c.cut.slice(0, 2).join(' ')} 横 +${f.over}`);
    }
  }

  for (const [w, h] of PLACE_PHONE) {
    await sizeTo(page, w, h);
    const got = await all();
    const tops = got.map(([, f]) => f.top);
    ok(got.every(([, f]) => f.stage === 1 && !placeWhy(f, w) && f.top <= f.vh / 3 && f.below >= 160
         && f.inside && f.reach && f.over <= 0)
       && Math.max.apply(null, tops) - Math.min.apply(null, tops) <= 0.5,
       `${tag}/${w}×${h}: ★スマホは真ん中に置かない ── 器の上から ${GAP_PHONE[0]}〜${GAP_PHONE[1]}px（${say(got, 'topGap', 'px')}）・`
         + (got.length > 1 ? 'どの板も同じ場所から・' : '') + '頭は窓の上3分の1より上・下に影絵が覗く・横に溢れない',
       got.map(([n, f]) => `${n} 頭 ${f.top}/${f.vh} 見出しの下 ${f.underTitle} 下の影絵 ${f.below} 横 +${f.over}`).join(' ｜ '));
  }
  await sizeTo(page, 1440, 1000);
}
/* 毒入りの錠前（閉じているのに、本物らしい数字が紛れて来た答え）。本物のサーバは
   鍵の無い人へ head / comp / work / var を null で返す。**来ても1文字も描かない**ことを見る。
   ★門は「鍵は在るが答えきっていない・一覧なし・みんなの側は開いている」＝板に数字が
     ほとんど出ない形（出るのは「…か 0 で答えます。」の 0 だけ）。紛れた数字が見つけやすい。 */
const POISON_GATE = { key: true, ready: false, todo: null, crowd: true, contributors: 37, goal: 100 };
const POISON_LOCK = Object.assign(lockWith(POISON_GATE), {
  cohort: clone(FULL.cohort), head: clone(FULL.head), comp: clone(FULL.comp),
  work: clone(FULL.work), var: clone(FULL.var)
});
for (const lang of ['ja', 'en']) {
  for (const theme of ['light', 'dark']) {
    const { page, errs } = await open(lang, LOCK, theme);
    const tag = `${lang}/${theme}`;
    for (const w of [320, 390, 1440]) {
      await page.setViewport({ width: w, height: 1000 });
      await page.waitForFunction((x) => innerWidth === x, { timeout: 10000 }, w);
      await navStill(page);
      const bad = {};
      for (const [k] of GHOST_KINDS) bad[k] = [];
      /* ★一覧つきのいちばん長い板（18項目＋100人の行）も一緒に回す ── 板が器より高くなる形。 */
      const cases = LOCK_CASES.map(([name, gate]) => [name, gate])
        .concat([['18項目ぜんぶ＋100人', { key: true, ready: false, crowd: false,
                                            todo: { year: 2026, month: 9, items: ALL18 } }]]);
      for (const [name, gate] of cases) {
        const g = Object.assign({ contributors: 37, goal: 100 }, gate);
        await page.evaluate((p) => window.PVDeepPay.render(p), lockWith(g));
        const fit = await page.evaluate(GHOST_FIT);
        const c = (await page.evaluate(LOCK_FIT)) || { out: ['板が無い'], cut: [], con: {} };
        const b = ghostBad(fit, c, w);
        for (const k of Object.keys(b)) bad[k].push(`「${name}」${b[k]}`);
      }
      for (const [k, label] of GHOST_KINDS)
        ok(bad[k].length === 0, `${tag}/${w}: ${label}（${cases.length}通り）`,
           bad[k].slice(0, 3).join(' ｜ '));
    }

    /* ── キーボード。Tab で回って、影絵の中に1度も焦点が入らない・板のボタンには届く。
       幅は 1440 のまま（左メニューが出ていて、焦点の当たるものがいちばん多い）。 ── */
    await page.evaluate((p) => window.PVDeepPay.render(p),
      lockWith({ key: true, ready: false, todo: TODO6, crowd: false, contributors: 37, goal: 100 }));
    const walk = await tabWalk(page);
    ok(walk.filter((x) => !x.body).length >= 8 && walk.some((x) => x.cta) && !walk.some((x) => x.ghost),
       `${tag}: ★★Tab で一周しても影絵には入らない・板のボタンには届く（焦点が当たったのは ${walk.filter((x) => !x.body).length} か所）`,
       `ボタンに届いた=${walk.some((x) => x.cta)} 影絵に入った=${walk.some((x) => x.ghost)}`);

    if (theme === 'light') {
      const html = () => page.evaluate(() => document.getElementById('dp-root').innerHTML);
      /* ── 焦点が外れない。同じ答えで描き直しても（通貨の切替でも）、器ごと作り直さない。 ── */
      const G1 = lockWith({ key: true, ready: false, todo: TODO6, crowd: false, contributors: 37, goal: 100 });
      await page.evaluate((p) => window.PVDeepPay.render(p), G1);
      const kept = await page.evaluate((p) => {
        const a = document.querySelector('.dp-stage a.dp-cta');
        const st = document.querySelector('.dp-stage'), gh = document.querySelector('.dp-ghost');
        a.focus();
        window.PVDeepPay.render(p);
        window.dispatchEvent(new Event('pv-currency-change'));
        return { a: document.querySelector('.dp-stage a.dp-cta') === a,
                 st: document.querySelector('.dp-stage') === st,
                 gh: document.querySelector('.dp-ghost') === gh,
                 focus: document.activeElement === a };
      }, G1);
      ok(kept.a && kept.st && kept.gh && kept.focus,
         `${tag}: ★同じ答えで描き直しても、器（影絵＋板）を作り直さない・ボタンの焦点が外れない`,
         JSON.stringify(kept));
      /* 門が変われば板は組み直す（古い板のまま固まらない）。影絵の字は同じ。 */
      const g0 = await page.evaluate(() => document.querySelector('.dp-ghost').outerHTML);
      await page.evaluate((p) => window.PVDeepPay.render(p),
        lockWith({ key: false, ready: true, todo: null, crowd: true, contributors: 37, goal: 100 }));
      const swapped = await page.evaluate(SNAP);
      const g1 = await page.evaluate(() => document.querySelector('.dp-ghost').outerHTML);
      ok(swapped.lock.lines.join('|') === LK[lang].key && swapped.ghost === 1,
         `${tag}: ★門が変われば板は組み直す（影絵は1つのまま）`, JSON.stringify(swapped.lock.lines));
      ok(g0 === g1 && g0.length > 400,
         `${tag}: ★★影絵は門が変わっても1文字も変わらない（答えから作っていない固定の絵）`,
         `長さ ${g0.length} → ${g1.length}`);

      /* ── 毒入り。閉じた答えに head / comp / work / var が紛れて来ても、1文字も描かない。 ── */
      await page.evaluate((p) => window.PVDeepPay.render(p), lockWith(POISON_GATE));
      const clean = { s: await page.evaluate(SNAP), h: await html() };
      await page.evaluate((p) => window.PVDeepPay.render(p), POISON_LOCK);
      const poi = { s: await page.evaluate(SNAP), h: await html() };
      ok(poi.h === clean.h && poi.s.text === clean.s.text && poi.s.ghost === 1,
         `${tag}: ★★閉じた答えに本物らしい数字が紛れて来ても、画面は1文字も変わらない（影絵にも板にも出ない）`,
         `DOM が同じ=${poi.h === clean.h} / 本文が同じ=${poi.s.text === clean.s.text}`);
      const ghostText = await page.evaluate(() => document.querySelector('.dp-ghost').textContent);
      ok(ghostText === '' && poi.s.kpi === 0 && !/[¥$€£]|万|%/.test(poi.s.text)
         && poi.s.comp.hidden && poi.s.work.hidden && poi.s.vari.hidden && !poi.s.pick.shown,
         `${tag}: ★★毒入りでも、影絵は空のまま・金額も割合も出ない・節も選択欄も出ない`,
         JSON.stringify(ghostText.slice(0, 30)) + ' / ' + (poi.s.text.match(/[^\n]*[¥$€£万%][^\n]*/) || [''])[0]);
      /* 毒の値そのもの（見本の年収・単価・月額）が、HTML のどこにも字で入っていない
         （属性の中にも）。★生の値と、画面が刷るはずだった形の両方を探す ── FULL の
           119700 / 102.5 / 4800 / 2200 と、その円・ドルの字（§3g の期待値と同じ）。
           通貨記号・「万」・% は、閉じた画面の HTML には1つも無いはず。 */
      const marks = ['119700', '119,700', '1,903', '120K', '102.5', '16,300', '4800', '4,800',
                     '760,000', '2200', '350,000', '%', '¥', '$', '€', '万'];
      const leak = marks.filter((x) => poi.h.includes(x));
      ok(leak.length === 0, `${tag}: ★★毒の値が HTML のどこにも入っていない（属性の中にも）`,
         leak.join(' '));

      /* ── 閉じた → 開いた。影絵は跡形もなく消える（描き直しの入口で切り替える）。 ── */
      /* ★この窓は閉じた板を描いてきたので、開いた瞬間にクラッカーが1回鳴る（2026-10-11。
           筋書きは §2f）。紙吹雪の器（.dp-pop）が**出ている最中にも**、影絵とぼかしの効いた
           要素が無いことを見る ── 描き直しと同じ evaluate の中で数える（器は約 2.8 秒で
           片づくので、あとから見に行くと、混んだ回にはもう無い）。 */
      const popped = await page.evaluate((p) => {
        window.PVDeepPay.render(p);
        const blur = (root) => !root ? 0 : [...root.querySelectorAll('*')].filter((e) => {
          const c = getComputedStyle(e);
          return (c.filter && c.filter !== 'none') || (c.backdropFilter && c.backdropFilter !== 'none');
        }).length;
        const lay = document.querySelector('.dp-pop');
        return { pop: document.querySelectorAll('.dp-pop').length,
                 papers: lay ? lay.querySelectorAll('.dp-pop-p').length : 0,
                 blur: blur(document.querySelector('main')) + blur(lay),
                 ghost: document.querySelectorAll('.dp-ghost, .dp-stage').length };
      }, FULL);
      const opened = await page.evaluate(SNAP);
      ok(noGhost(opened) && !opened.lock.on,
         `${tag}: ★★閉じた → 開いた で、影絵も器も DOM から消える（ぼかしの効いた要素が残らない）`,
         ghostWhy(opened));
      ok(popped.pop === 1 && popped.papers >= 60 && popped.blur === 0 && popped.ghost === 0,
         `${tag}: ★★その瞬間、紙吹雪の器が1つ出ている ── その最中にも、影絵とぼかしの効いた要素が無い（本文にも器にも）`,
         `器 ${popped.pop} / 紙 ${popped.papers} / ぼかし ${popped.blur} / 影絵 ${popped.ghost}`);
      await page.evaluate((p) => window.PVDeepPay.render(p), lockWith(POISON_GATE));
      const shutAgain = await page.evaluate(SNAP);
      ok(shutAgain.ghost === 1 && shutAgain.stage === 1 && shutAgain.lock.on,
         `${tag}: 開いた → 閉じた で、影絵と板が戻る`, ghostWhy(shutAgain));
    }

    /* ── 縦の置き場所。窓の高さを変えて測る（決まりと見方は、上の「板の縦の置き場所」と
       placeAt）。板は高さの違う3つ ── 100人だけ（1行）／答えと100人（2行）／一覧つき。
       収まらない板は、3行＋18項目。 ── */
    {
      const draw = (gate) => () => page.evaluate((p) => window.PVDeepPay.render(p),
        lockWith(Object.assign({ contributors: 37, goal: 100 }, gate)));
      await placeAt(page, tag, [
        ['1行', draw({ key: true, ready: true, todo: null, crowd: false })],
        ['2行', draw({ key: true, ready: false, todo: null, crowd: false })],
        ['一覧つき', draw({ key: true, ready: false, todo: TODO6, crowd: false })]],
        draw({ key: false, ready: false, crowd: false, todo: { year: 2026, month: 9, items: ALL18 } }));
    }
    ok(errs.length === 0, `${tag}: 影絵の描き直しで JS のエラーが出ない`, errs.join(' / '));
    await jars.pop().close().catch(() => {});
  }
}

/* ── 毒入り（本物の読み込みで）──────────────────────────────────────
   上は描き直しの入口。ここは**サーバの答えとして**毒が来た形を、ページを開くところから
   通す（閉じているのに cohort / head / comp / work / var が入っている）。開いたあと、
   毒の無い答えで描き直しても1文字も変わらないこと ＝ 読み込みの道でも、紛れて来た
   数字をどこにも描いていない。 */
for (const lang of ['ja', 'en']) {
  const { page, errs } = await open(lang, POISON_LOCK);
  const html = () => page.evaluate(() => document.getElementById('dp-root').innerHTML);
  const poi = { s: await page.evaluate(SNAP), h: await html() };
  await page.evaluate((p) => window.PVDeepPay.render(p), lockWith(POISON_GATE));
  const clean = { s: await page.evaluate(SNAP), h: await html() };
  ok(poi.s.lock.on && poi.s.ghost === 1 && poi.h === clean.h,
     `${lang}: ★★サーバが閉じた答えに数字を混ぜて返しても、画面は毒の無い答えと1文字も違わない`,
     `板 ${poi.s.lock.on} / 影絵 ${poi.s.ghost} / DOM が同じ=${poi.h === clean.h}`);
  ok(poi.s.kpi === 0 && !/[¥$€£]|万|%/.test(poi.s.text) && errs.length === 0,
     `${lang}: ★毒入りの錠前に金額も割合も出ない・JS のエラーが出ない`,
     (poi.s.text.match(/[^\n]*[¥$€£万%][^\n]*/) || [''])[0] + errs.join(' / '));
  await jars.pop().close().catch(() => {});
}

/* ── 読み込み中（最初の答えがまだ来ていない）──────────────────────────
   ★前は、社名の辞書が RPC より先に届くと、**開いている人にも**「DEEP PAY はまだ
     開いていません」の板が一瞬出ていた（deep-pay.js の render() の注）。板の後ろに影絵を
     置いたいま、同じことが起きると画面まるごとが霞んでから開く。
   見るのは ── 答えを止めているあいだ：骨組みのまま・板も影絵も無い ／ 放したあと：
   開いた画面（選ぶ前の板）になり、影絵は1度も出ていない。
   ⚠️ 時間で待たない。辞書が着いたことは #dp-pick の data-sig（2つ目＝会社の数）で分かる。 */
for (const lang of ['ja', 'en']) {
  const { page, errs } = await open(lang, Object.assign(clone(FULL), { __hold: true }));
  await page.evaluate(() => { window.__sawGhost = 0;
    new MutationObserver(() => { if (document.querySelector('.dp-ghost, .dp-stage')) window.__sawGhost++; })
      .observe(document.getElementById('dp-root'), { childList: true, subtree: true }); });
  await page.waitForFunction(() => {
    const g = (document.getElementById('dp-pick') || { getAttribute: () => '' }).getAttribute('data-sig');
    return !!g && Number(g.split('|')[1]) > 0 && typeof window.__release === 'function';
  }, { timeout: 20000 });
  const mid = await page.evaluate(SNAP);
  ok(mid.skel === 1 && !mid.lock.on && noGhost(mid) && mid.kpi === 0,
     `${lang}: ★★読み込みのあいだは骨組みのまま（錠前の板も影絵も出さない）`,
     `骨組み ${mid.skel} / 板 ${mid.lock.on} / ${ghostWhy(mid)}`);
  await page.evaluate(() => window.__release());
  await page.waitForFunction(() => !document.querySelector('#dp-kpi .mr-skel'), { timeout: 20000 });
  const aft = await page.evaluate(SNAP);
  ok(aft.skel === 0 && !aft.lock.on && noGhost(aft)
     && (await page.evaluate(() => window.__sawGhost)) === 0,
     `${lang}: ★★答えが来たら開いた画面になる（開いている人に、板も影絵も1度も出ていない）`,
     ghostWhy(aft) + ' / 途中で出た回数 ' + (await page.evaluate(() => window.__sawGhost)));
  ok(errs.length === 0, `${lang}: 読み込み中の画面で JS のエラーが出ない`, errs.join(' / '));
  await jars.pop().close().catch(() => {});
}

// ── 2f. 開いた瞬間のクラッカー（2026-10-11・オーナー指示）──────────────────
/* 閉じた板を見ていた会員が給与の詳細を出して、画面が開いたら「クラッカーならしてね」。
   紙吹雪を**1回だけ**飛ばす。字面は上の ⑬。ここは実物で見る ── 日英で同じ筋書き：
     a) 閉じた画面を描くと、端末に印が置かれる（中身は指紋。uid そのものではない）。
        閉じた画面では鳴らない。読み直しても印は残る。印のほかには何も書かれない。
     ・ 読み込めなかった画面では鳴らない・印も減らない（開いた日のために残る）。
     b) 同じ会員で開いた画面になると、器がちょうど1つ出る。押せない（pointer-events:none）・
        aria-hidden・字が無い・動くのは transform と opacity だけ・ぼかしが無い・
        飛んでいるあいだも横スクロールが生えない・紙の真ん中を押しても紙に当たらない
        （＝ 下のボタンや欄がそのまま押せる）・約 2.8 秒で DOM から外れる。印は飛ばす前に消える。
     c) 同じ表示の中で描き直しても、読み直しても、もう鳴らない。
     d) 印が無ければ鳴らない。別の会員の印・指紋でない字の印は、鳴らさずに消す。
     e) 「動きを減らす」設定の人には器を作らない（印は消える）。
     f) 2つの画面で印は1つ ── もう片方の画面で先に鳴ったら、こちらでは鳴らない。
     ・ 裏のタブで開いた回は、その場では鳴らさず、表に出たときに1回鳴らす
        （見えないところで飛び終わってしまわないように）。
     g) 保存領域が投げても、閉じた画面も開いた画面も今までどおり描ける（鳴らないだけ）。
   ★器の中身は、**DOM に入った瞬間に**窓の中で測る（POP_WATCH）。外から時間を置いて
     見に行くと、混んだ回には器がもう片づいている。飛んでいる途中の絵は、動きを止めて
     時刻を名指しして作る（300 / 900 / 1600 / 2500 / 2800ms）── 時間では待たない。
   ⚠️ 窓は言語ごとに1つの入れ物（同じ保存領域）で続けて開く。印は端末に在るので、
      入れ物を分けると「閉じた画面を見た人が、あとで開く」を作れない。 */
const POP_KEY = 'pv_deep_was_locked';
const POP_UID = '00000000-0000-4000-8000-00000000a001';     // FAKE の UID と同じ字
const POP_TIMES = [0, 300, 900, 1600, 2500, 2800];
const POP_WATCH = function (key) {
  const P = window.__pop = { seen: 0, gone: 0, life: null, snap: null, t0: 0 };
  const isPop = (n) => n.nodeType === 1 && n.classList && n.classList.contains('dp-pop');
  const probe = (lay) => {
    const cs = getComputedStyle(lay);
    const an = lay.getAnimations({ subtree: true });
    const papers = [...lay.querySelectorAll('.dp-pop-p')];
    const kids = [...lay.querySelectorAll('*')];
    const every = [lay].concat(kids);
    const props = new Set();
    for (const a of an) for (const k of a.effect.getKeyframes())
      for (const name of Object.keys(k))
        if (!/^(offset|computedOffset|easing|composite)$/.test(name)) props.add(name);
    const ends = an.map((a) => a.effect.getComputedTiming().endTime);
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const lr = lay.getBoundingClientRect();
    /* 画面に出ている「押せるもの」。ヘッダーのボタン・ロゴ・左メニュー・選ぶ欄と、
       見出しのタブ（REAL PAY へ戻る道。2026-10-11 ── 紙吹雪の器に取られないこと）。
       ★会社比較にはタブが無い ＝ そちらでは最後の1つが居ないだけ（下で落とす）。 */
    const ctl = ['#theme-toggle', '.mr-brand', 'nav.mr-side a.mr-side-a', '.dp-pick-s', '#pv-ham-btn',
                 '#dp-hd a.pv-paytab']
      .map((s) => document.querySelector(s)).filter((e) => {
        if (!e) return false;
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw;
      });
    const frame = (ms) => {
      an.forEach((a) => { a.pause(); a.currentTime = ms; });
      const rects = papers.map((p) => p.getBoundingClientRect());
      const inView = rects.filter((r) => r.right > 0 && r.left < vw && r.bottom > 0 && r.top < vh);
      /* 紙の真ん中を押しても、当たるのは紙ではない（下の要素）。 */
      let hit = 0;
      for (const r of inView) {
        const t = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
        if (t && lay.contains(t)) hit++;
      }
      const through = ctl.filter((e) => {
        const r = e.getBoundingClientRect();
        const t = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
        return !!t && (t === e || e.contains(t));
      }).length;
      const xs = rects.map((r) => (r.left + r.right) / 2);
      return { ms, over: document.documentElement.scrollWidth - vw,
               high: document.documentElement.scrollHeight, n: inView.length, hit, through,
               /* cols ＝ 紙の真ん中が在る場所の数（8px の升目で数える。出だしは左右の角の2つ）。
                  mid ＝ 窓の幅のまんなか3分の1に居る紙の数（内へ広がったことの目印）。 */
               cols: new Set(xs.map((x) => Math.round(x / 8))).size,
               mid: xs.filter((x) => x > vw / 3 && x < vw * 2 / 3).length,
               /* 見えている紙の数（落ちる入れ子の opacity。出だしの前と終わったあとは 0）。 */
               vis: papers.filter((p) =>
                 Number(getComputedStyle(p.parentNode.parentNode).opacity) > 0.5).length };
    };
    const high0 = document.documentElement.scrollHeight;
    const frames = [0, 300, 900, 1600, 2500, 2800].map(frame);
    an.forEach((a) => { a.currentTime = 0; a.play(); });      // 測り終えたら、頭から流し直す
    return {
      one: document.querySelectorAll('.dp-pop').length,
      body: lay.parentNode === document.body, inMain: !!lay.closest('main'),
      aria: lay.getAttribute('aria-hidden'), pe: cs.pointerEvents, pos: cs.position,
      ov: cs.overflowX + ' ' + cs.overflowY,
      cover: Math.abs(lr.left) <= 1 && Math.abs(lr.top) <= 1
        && Math.abs(lr.right - vw) <= 1 && Math.abs(lr.bottom - vh) <= 1,
      peKids: kids.filter((e) => getComputedStyle(e).pointerEvents !== 'none').length,
      text: lay.textContent,
      tags: [...new Set(kids.map((e) => e.tagName.toLowerCase()))].sort().join(' '),
      attrs: every.reduce((n, e) => n + [...e.attributes]
        .filter((t) => !/^(class|style|aria-hidden)$/.test(t.name)).length, 0),
      focusable: lay.querySelectorAll(
        'a,button,input,select,textarea,summary,iframe,[tabindex],[contenteditable]').length,
      filt: every.filter((e) => {
        const c = getComputedStyle(e);
        return (c.filter && c.filter !== 'none') || (c.backdropFilter && c.backdropFilter !== 'none');
      }).length,
      props: [...props].sort().join(' '), anims: an.length, papers: papers.length,
      endMax: Math.round(Math.max(...ends)), endMin: Math.round(Math.min(...ends)),
      mark: (function () { try { return localStorage.getItem(key); } catch (e) { return 'threw'; } })(),
      ctl: ctl.length, vw, high0, frames
    };
  };
  new MutationObserver((list) => {
    for (const m of list) {
      for (const n of m.addedNodes) if (isPop(n)) {
        P.seen++; P.t0 = performance.now();
        try { P.snap = probe(n); } catch (e) { P.snap = { threw: String(e && e.message) }; }
      }
      for (const n of m.removedNodes) if (isPop(n)) {
        P.gone++; P.life = Math.round(performance.now() - P.t0);
      }
    }
  }).observe(document, { childList: true, subtree: true });
};
/* 保存領域が投げる端末を装う。★まず印の鍵**だけ**を投げさせる（ページのほかの部品 ──
   テーマ・通貨・ログインの写し ── は今までどおり読める）。__denyAll() を呼ぶと、
   どの鍵でも投げる。__rawGet は、検査が中身を確かめるための素の読み口。 */
const POP_DENY = function (key) {
  const P = Storage.prototype, g = P.getItem, s = P.setItem, r = P.removeItem;
  window.__deny = 0;
  window.__rawGet = (k) => g.call(window.localStorage, k);
  const no = () => { window.__deny++; throw new DOMException('denied', 'SecurityError'); };
  P.getItem = function (k) { return k === key ? no() : g.apply(this, arguments); };
  P.setItem = function (k) { return k === key ? no() : s.apply(this, arguments); };
  P.removeItem = function (k) { return k === key ? no() : r.apply(this, arguments); };
  window.__denyAll = () => { P.getItem = P.setItem = P.removeItem = function () { return no(); }; };
};
/* 裏のタブを装う（document.hidden を true にしておき、__show() で表に出す）。 */
const POP_HIDE = function () {
  let hid = true;
  Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => hid });
  window.__show = () => { hid = false; document.dispatchEvent(new Event('visibilitychange')); };
};
const popState = (page) => page.evaluate((key, uid) => {
  const get = (k) => (window.__rawGet ? window.__rawGet(k) : localStorage.getItem(k));
  const P = window.__pop || {};
  return {
    seen: P.seen, gone: P.gone, life: P.life, snap: P.snap,
    now: document.querySelectorAll('.dp-pop').length,
    mark: get(key), fp: window.PVPayLocal.fp(uid),
    calm: matchMedia('(prefers-reduced-motion: reduce)').matches,
    stage: document.querySelectorAll('.dp-stage').length,
    ghost: document.querySelectorAll('.dp-ghost').length,
    msg: document.querySelectorAll('main .dp-msg').length,
    skel: document.querySelectorAll('#dp-kpi .mr-skel, #dc-sides .mr-skel').length,
    blurred: [...document.querySelectorAll('main *')].filter((e) => {
      const c = getComputedStyle(e);
      return (c.filter && c.filter !== 'none') || (c.backdropFilter && c.backdropFilter !== 'none');
    }).length,
    deny: window.__deny || 0, hidden: document.hidden
  };
}, POP_KEY, POP_UID);
/* 保存領域の中身まるごと（印の鍵を除く）。クラッカーの前後で1文字も変わらないことを見る。 */
const popDump = (page) => page.evaluate((key) => JSON.stringify(Object.keys(localStorage)
  .filter((k) => k !== key).sort().map((k) => [k, localStorage.getItem(k)])), POP_KEY);
const popReload = async (page) => {
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await drawn(page);
};
/* この画面の出し方。★閉じた板・開いた画面は、試験用の入口（PVDeepPay.render）で描き直す。
   もう片方の画面（会社比較）も、同じ偽サーバのまま開ける ── 入口の1回は引数なしで、
   開いた答え（FULL）がそのまま返る。 */
const POP_LOCK = LOCK, POP_OPEN = FULL, POP_ERR = { __err: true };
const POP_OTHER = 'deep-pay-compare.html';
const popAt = (lang, payload, opt) => open(lang, payload, 'light', null, opt);
const popLock = (page) => page.evaluate((x) => window.PVDeepPay.render(x),
  lockWith({ key: true, ready: false, todo: null, crowd: true, contributors: 37, goal: 100 }));
const popOpen = (page) => page.evaluate((x) => window.PVDeepPay.render(x), FULL);
for (const lang of ['ja', 'en']) {
  const jar = await browser.createBrowserContext();
  const first = [[POP_WATCH, POP_KEY]];
  const errs = [];
  const at = async (payload, more) => {
    const r = await popAt(lang, payload, Object.assign({ jar, first }, more || {}));
    r.errs.forEach((e) => errs.push(e));
    r.page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
    return r.page;
  };
  let s;

  // ── a) 閉じた画面 → 印 ──
  const A = await at(POP_LOCK);
  s = await popState(A);
  ok(s.stage === 1 && s.mark === s.fp && /^[0-9a-f]{1,8}$/.test(s.mark || ''),
     `${lang}: ★★閉じた板を描くと、端末に印が置かれる（中身は会員の指紋）`,
     `器 ${s.stage} / 印 ${JSON.stringify(s.mark)} / 指紋 ${s.fp}`);
  ok(s.mark !== POP_UID && !/-/.test(s.mark || '-') && (s.mark || '').length < POP_UID.length / 3,
     `${lang}: ★★印は uid そのものではない（短く畳んだ指紋だけ）`, JSON.stringify(s.mark));
  ok(s.seen === 0 && s.now === 0, `${lang}: ★閉じた画面では鳴らない`, `出た回数 ${s.seen}`);
  {
    /* 印のほかには何も書かない ── 印を消して描き直すと、戻るのは印だけ。 */
    const d0 = await popDump(A);
    await A.evaluate((k) => localStorage.removeItem(k), POP_KEY);
    await popLock(A);
    const d1 = await popDump(A);
    s = await popState(A);
    ok(d0 === d1 && s.mark === s.fp,
       `${lang}: ★★閉じた板の描き直しで書かれるのは印の1つだけ（門の鍵・ほかの鍵は1文字も変わらない）`,
       `ほかの鍵が同じ=${d0 === d1} / 印 ${JSON.stringify(s.mark)}`);
  }
  await popReload(A);
  s = await popState(A);
  ok(s.stage === 1 && s.mark === s.fp && s.seen === 0,
     `${lang}: 閉じたまま読み直しても、印は残り、鳴らない`, `印 ${JSON.stringify(s.mark)} / 出た ${s.seen}`);
  await A.close();

  // ── 読み込めなかった画面 ──
  const E = await at(POP_ERR);
  s = await popState(E);
  ok(s.seen === 0 && s.now === 0 && s.stage === 0 && s.msg === 1 && s.mark === s.fp,
     `${lang}: ★読み込めなかった画面では鳴らない・印も減らない（開いた日のために残る）`,
     `出た ${s.seen} / 板 ${s.msg} / 印 ${JSON.stringify(s.mark)}`);
  await E.close();

  // ── b) 同じ会員で開いた → ちょうど1回 ──
  const B = await at(POP_OPEN);
  await B.waitForFunction(() => window.__pop.seen >= 1, { timeout: 20000 }).catch(() => {});
  s = await popState(B);
  const p = s.snap || {};
  const fr = p.frames || [];
  const f = (ms) => fr.find((x) => x.ms === ms) || {};
  ok(s.seen === 1 && p.one === 1 && !p.threw,
     `${lang}: ★★開いた画面で、紙吹雪の器がちょうど1つ出る`,
     `出た ${s.seen} / 同時に ${p.one} / ${p.threw || ''} / 裏のタブ=${s.hidden}`);
  ok(p.mark === null, `${lang}: ★★印は、飛ばす前に消えている（読み直しで2度鳴らない）`, JSON.stringify(p.mark));
  ok(p.aria === 'true' && p.pe === 'none' && p.peKids === 0 && p.focusable === 0,
     `${lang}: ★★器は aria-hidden・押せない（pointer-events:none が紙の1枚1枚まで）・焦点の当たるものが無い`,
     `aria=${p.aria} pe=${p.pe} 押せる紙=${p.peKids} 焦点=${p.focusable}`);
  ok(p.pos === 'fixed' && p.cover && p.ov === 'hidden hidden' && p.body && !p.inMain,
     `${lang}: ★器は画面いっぱいの fixed・はみ出しを切る・body の直下（本文の器の外）`,
     `${p.pos} 覆う=${p.cover} overflow=${p.ov} body=${p.body} 本文の中=${p.inMain}`);
  ok(p.text === '' && p.tags === 'div i' && p.attrs === 0,
     `${lang}: ★★器に字が1文字も無い（数字も絵文字も無い）・タグは div と i だけ・class と style のほかに属性が無い`,
     `字 ${JSON.stringify(String(p.text).slice(0, 20))} タグ ${p.tags} 属性 ${p.attrs}`);
  ok(p.props === 'opacity transform' && p.anims === p.papers * 3 && p.papers >= 60 && p.papers <= 90,
     `${lang}: ★★動くのは transform と opacity だけ（紙 ${p.papers} 枚 × 3本）`,
     `動かしている名前「${p.props}」/ 動き ${p.anims} 本 / 紙 ${p.papers} 枚`);
  ok(p.filt === 0 && s.blurred === 0 && s.ghost === 0 && s.stage === 0,
     `${lang}: ★★器にも本文にも、ぼかしの効いた要素が無い（開いた画面に影絵も残らない）`,
     `器 ${p.filt} / 本文 ${s.blurred} / 影絵 ${s.ghost}`);
  ok(p.endMin >= 2200 && p.endMax <= 2800,
     `${lang}: ★紙は 2.2〜2.8 秒で終わる`, `${p.endMin}〜${p.endMax}ms`);
  ok(fr.length === POP_TIMES.length && fr.every((x) => x.over <= 0 && x.high === p.high0),
     `${lang}: ★★飛んでいるあいだ、横スクロールが生えない・ページの高さも変わらない（${POP_TIMES.join(' / ')}ms）`,
     fr.map((x) => `${x.ms}:+${x.over}/${x.high - p.high0}`).join(' '));
  ok(p.ctl >= 3 && fr.every((x) => x.through === p.ctl) && fr.every((x) => x.hit === 0),
     `${lang}: ★★紙吹雪の下のボタンや欄は、そのまま押せる（${p.ctl} か所。紙の真ん中を押しても紙には当たらない）`,
     fr.map((x) => `${x.ms}:${x.through}/${p.ctl} 紙に当たった ${x.hit}`).join(' ｜ '));
  ok(f(0).vis === 0 && f(900).vis >= p.papers * 0.9 && f(2800).vis === 0,
     `${lang}: ★出だしの前と終わったあとは紙が見えない（角に固まって残らない）・途中は見えている`,
     fr.map((x) => `${x.ms}:${x.vis}`).join(' '));
  ok(f(0).cols === 2 && f(0).mid === 0 && f(900).n >= p.papers * 0.6
     && f(900).cols >= p.papers * 0.5 && f(900).mid >= p.papers * 0.1,
     `${lang}: ★左右の2つの角から出て、内へ広がる（0.9 秒で、窓の中に ${f(900).n} 枚・まんなかに ${f(900).mid} 枚）`,
     fr.map((x) => `${x.ms}:場所 ${x.cols} まんなか ${x.mid} 窓の中 ${x.n}`).join(' ｜ '));
  await B.waitForFunction(() => window.__pop.gone >= 1 && !document.querySelector('.dp-pop'),
                          { timeout: 20000 }).catch(() => {});
  s = await popState(B);
  ok(s.gone === 1 && s.now === 0 && s.life >= 2200 && s.life <= 4000,
     `${lang}: ★★飛び終わったら、器ごと DOM から外れる（出てから ${s.life}ms）`,
     `外れた ${s.gone} / 残り ${s.now} / ${s.life}ms`);
  ok(s.mark === null && s.stage === 0 && s.skel === 0,
     `${lang}: 鳴ったあと、印は無い・開いた画面のまま`, `印 ${JSON.stringify(s.mark)} / 器 ${s.stage}`);

  // ── c) 同じ表示の中では1回まで・読み直しても鳴らない ──
  await popOpen(B); await popOpen(B);
  await B.evaluate(() => window.dispatchEvent(new Event('pv-currency-change')));
  s = await popState(B);
  ok(s.seen === 1 && s.now === 0, `${lang}: ★開いた画面を描き直しても（通貨の切替でも）、もう鳴らない`,
     `出た ${s.seen}`);
  {
    await popLock(B);
    const m1 = (await popState(B)).mark;
    const x1 = await popDump(B);
    await popOpen(B);
    const x2 = await popDump(B);
    s = await popState(B);
    ok(m1 === s.fp && s.mark === null && s.seen === 1 && s.now === 0,
       `${lang}: ★★同じ表示の中では1回まで（もう一度 閉じた → 開いた でも鳴らない。印は消える）`,
       `印 ${JSON.stringify(m1)} → ${JSON.stringify(s.mark)} / 出た ${s.seen}`);
    ok(x1 === x2, `${lang}: ★★開いた画面の側で消えるのは印の1つだけ（ほかの鍵は1文字も変わらない）`);
  }
  await popReload(B);
  s = await popState(B);
  ok(s.seen === 0 && s.now === 0 && s.mark === null && s.stage === 0,
     `${lang}: ★★読み直しても鳴らない（印が無い ＝ 板を見ていない人には鳴らない）`, `出た ${s.seen}`);

  // ── d) 別の会員の印・指紋でない字の印 ──
  for (const [name, val] of [['別の会員の印', null], ['uid をそのまま置いた印', POP_UID]]) {
    const put = await B.evaluate((k, v) => {
      const x = v || window.PVPayLocal.fp('00000000-0000-4000-8000-00000000b002');
      localStorage.setItem(k, x);
      return x;
    }, POP_KEY, val);
    await popReload(B);
    s = await popState(B);
    ok(put !== s.fp && s.seen === 0 && s.now === 0 && s.mark === null && s.stage === 0,
       `${lang}: ★★${name}では鳴らない・その印は消す`,
       `置いた ${put} / 自分 ${s.fp} / 出た ${s.seen} / 残った印 ${JSON.stringify(s.mark)}`);
  }

  // ── e) 「動きを減らす」設定 ──
  await popLock(B);
  ok((await popState(B)).mark === s.fp, `${lang}: （e の前置き）印を置き直した`);
  const R = await at(POP_OPEN, { reduce: true });
  s = await popState(R);
  ok(s.calm === true && s.seen === 0 && s.now === 0 && s.mark === null && s.stage === 0 && s.skel === 0,
     `${lang}: ★★「動きを減らす」設定の人には器を作らない（印は消える・画面は開く）`,
     `設定=${s.calm} / 出た ${s.seen} / 印 ${JSON.stringify(s.mark)}`);
  await R.close();

  // ── f) 2つの画面で印は1つ ──
  /* ★2026-10-12、会社比較は閉じている（配っているファイルのままなら、あちらの画面は板を
       出して終わる ── 鳴らさない・印にも触らない。それは assert-deep-pay-compare.mjs の §0 が見る）。
       ここで見ているのは「出した日に、2つの画面が同じ印を使う」ことなので、あちらの本体を
       試験用の口（cmp）で動かす。 */
  await popLock(B);
  const O = await at(POP_OPEN, { file: POP_OTHER, cmp: true });
  await O.waitForFunction(() => window.__pop.seen >= 1, { timeout: 20000 }).catch(() => {});
  s = await popState(O);
  ok(s.seen === 1 && (s.snap || {}).one === 1 && (s.snap || {}).pe === 'none'
     && (s.snap || {}).props === 'opacity transform' && s.mark === null,
     `${lang}: ★★もう片方の画面（${POP_OTHER}）を先に開くと、そちらで鳴る（印は同じ1つ）`,
     `出た ${s.seen} / 印 ${JSON.stringify(s.mark)} / 裏のタブ=${s.hidden}`);
  await O.close();
  const B2 = await at(POP_OPEN);
  s = await popState(B2);
  ok(s.seen === 0 && s.now === 0 && s.stage === 0,
     `${lang}: ★★そのあとこの画面を開いても鳴らない（先に開いたほうで1回だけ）`, `出た ${s.seen}`);
  await B2.close();

  // ── 裏のタブで開いた回 ──
  await popLock(B);
  const H = await at(POP_OPEN, { first: first.concat([[POP_HIDE, null]]) });
  s = await popState(H);
  ok(s.hidden === true && s.seen === 0 && s.now === 0 && s.mark === null && s.stage === 0,
     `${lang}: ★裏のタブで開いた回は、その場では鳴らさない（印は消えている・画面は開いている）`,
     `裏=${s.hidden} / 出た ${s.seen} / 印 ${JSON.stringify(s.mark)}`);
  await H.evaluate(() => window.__show());
  await H.waitForFunction(() => window.__pop.seen >= 1, { timeout: 20000 }).catch(() => {});
  await H.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  s = await popState(H);
  ok(s.seen === 1 && (s.snap || {}).one === 1 && (s.snap || {}).props === 'opacity transform',
     `${lang}: ★表に出たときに1回だけ鳴る（そのあとタブを行き来しても増えない）`, `出た ${s.seen}`);
  await H.close();
  await B.close();

  // ── g) 保存領域が投げる ──
  const before = errs.length;
  const G = await at(POP_LOCK, { first: first.concat([[POP_DENY, POP_KEY]]) });
  s = await popState(G);
  ok(s.stage === 1 && s.deny >= 1 && s.mark === null && s.seen === 0,
     `${lang}: ★★印を書けない端末でも、閉じた板は今までどおり出る（書こうとして投げられた ${s.deny} 回）`,
     `器 ${s.stage} / 印 ${JSON.stringify(s.mark)}`);
  const n1 = s.deny;
  await popOpen(G);
  s = await popState(G);
  ok(s.stage === 0 && s.skel === 0 && s.msg >= 1 && s.seen === 0 && s.deny > n1,
     `${lang}: ★★印を読めない端末でも、開いた画面は今までどおり出る（鳴らないだけ）`,
     `器 ${s.stage} / 板 ${s.msg} / 出た ${s.seen} / 投げられた ${s.deny} 回`);
  await G.evaluate(() => window.__denyAll());
  await popLock(G);
  const g1 = await popState(G);
  await popOpen(G);
  const g2 = await popState(G);
  ok(g1.stage === 1 && g2.stage === 0 && g2.msg >= 1 && g2.seen === 0 && g2.deny > g1.deny && g1.deny > s.deny,
     `${lang}: ★★どの鍵でも投げる端末でも、閉じた → 開いた を描ける（鳴らないだけ）`,
     `閉 ${g1.stage} / 開 ${g2.stage} / 出た ${g2.seen} / 投げられた ${g2.deny} 回`);
  await G.close();
  ok(errs.length === before, `${lang}: ★★保存領域が投げても JS のエラーが出ない`, errs.slice(before).join(' / '));
  ok(before === 0, `${lang}: クラッカーの筋書きで JS のエラーが出ない`, errs.slice(0, before).join(' / '));
  await jar.close().catch(() => {});
}

// ── 2g. ログインしていない人（2026-10-11・オーナー判断）──────────────────────
/* DEEP PAY には公開の入口が在る（REAL PAY の見出しのタブ。あちらは未ログインの人にも見える）。
   前は、ログインしていない人がここへ来るとログイン画面へ送っていた（前の §1）。いまは
   送らない ── 「会員で、まだ開いていない人」と**同じ画面**（ぼかした影絵＋板）を出す。
   字面は ⑭。ここは実物で、日英とも：

     居る   … 住所が変わらない（付けて来た ?… と #… も残る）・いちばん外の枠が着いたのは
              1回だけ・ログイン画面へ向かう通信が無い
     同じ板 … 「鍵が無く、答えきってもいない」会員の閉じた画面（§2b の表の1行目）と、
              器ごと**1文字も違わない**（会員の側を実際に開いて突き合わせる）。題・行・断り・
              ボタンの字は、オーナー指定の字そのもの。行き先はその言語の給与フォームの頭。
              残りの一覧は無い（会員が居ない）・100人の行も人数も無い（サーバに聞いていない）
     聞かない … rpc を**1本も**呼ばない（pv_deep_pay() は未ログインだと必ず落ちる）。
              ★窓の中の数（偽物が数えた呼び出し）と、窓の外の数（puppeteer が記録した通信の
                住所に /rpc/ が無い）の**両方**で見る。偽物は __wire で、呼ばれたら必ず
                /rpc/<名前> への通信を1本出す ── 網が空振りでないことは、下の「ログインが
                切れていた」の筋書きで同じ網に1本掛かることで確かめる。
              待つのは「読み込みが終わり、板が出て、社名の辞書も着き、通信が静まった」まで
              （時間では待たない ── 辞書が着いたあとの描き直しでも聞きに行かないことまで見る）
     書かない … 保存領域（localStorage と sessionStorage）が、ページの script が動く前と
              **1文字も変わらない**。書きに行った鍵は、ページの部品が前から書くもの
              （テーマ・英語ページの言語の控え）だけ ── クラッカーの印も、門の鍵も無い。
              前のログインの印が端末に残っている人でも、その印を消さない・書き換えない
     出ない … 紙吹雪の器・全ページの Give → Get の板・JS のエラー
     形     … §2e と同じ物差し（影絵は aria-hidden＋inert・ぼかし・字が無い／板は手前・
              押せる・切れない・読める）を 320 / 390 / 1440 × 明暗で。タブは §0 と同じ物差しで、
              本物のマウスで押して REAL PAY へ着くところまで
   ── ログインが切れていた（端末にはセッションが在るのに、サーバが「ログインしていない」と
      答えた）──
     42501・HTTP 401 のどちらでも、**同じ板**（ログインしていない人の器と1文字も違わない）。
     「読み込めませんでした」は出さない。クラッカーの印を置かない（この人には指紋が在る ──
     置くと、前から開いていた人がログインし直した日に鳴る）。聞き直さない（1回だけ）。
     区分を選んだ回に切れていても同じ。
   ── ほかの失敗（通信が切れた・サーバが落ちた・答えの箱が投げた）──
     今までどおり「読み込めませんでした」。板も影絵も出さない（§8 と同じ）。
   ⚠️ 窓は見終わったらすぐ閉じる（溜めると、この Mac では混んで嘘の赤が出る）。 */
const ANON = { __anon: true, __wire: true };
/* 会員の「鍵が無く、答えきってもいない」門（§2b の LOCK_CASES の1行目と同じ）。 */
const ANON_TWIN = lockWith({ key: false, ready: false, todo: null, crowd: true, contributors: 37, goal: 100 });
/* ★オーナー指定の字（2026-10-11）。会員の板との突き合わせだけだと、2つが一緒にずれた日に
     通ってしまうので、字そのものも置いておく（行と断りは §2b の LK）。 */
const ANON_T = {
  ja: { title: '給与詳細提出で開きます', go: 'Give & Get 詳細を入力して解放する' },
  en: { title: 'Opens when you submit your pay details', go: 'Give & Get / Enter your details to unlock' }
};
/* サーバが「ログインしていない」と答えた形（supabase-js の答えの形）。
   LOST   … pv_deep_pay() が未ログインのときに投げる 42501（PostgREST は 401 で返す）
   LOST_J … 鍵の期限切れ。符丁は別物で、番号だけが 401
   NET    … 通信が切れた（postgrest-js は投げずに、番号 0 の答えを返す）
   DOWN   … サーバが落ちた */
const LOST   = { error: { code: '42501', message: 'ログインが必要です', details: null, hint: null },
                 status: 401, statusText: 'Unauthorized' };
const LOST_J = { error: { code: 'PGRST301', message: 'JWT expired', details: null, hint: null },
                 status: 401, statusText: 'Unauthorized' };
const NET    = { error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' },
                 status: 0, statusText: '' };
const DOWN   = { error: { code: 'XX000', message: 'internal error', details: null, hint: null },
                 status: 500, statusText: 'Internal Server Error' };
const ERR_TEXT = { ja: '読み込めませんでした。少し待ってから開き直してください。',
                   en: 'Could not load. Please try again in a moment.' };
/* 保存領域の見張り。★ページのどの script よりも先に流す。
     ・ページの部品が自分で書く鍵を、**書くはずの値で**先に置く（seed ── テーマと、英語ページの
       言語の控え）。そのうえで中身をまるごと控える（__ls0）＝ あとで「1文字も変わらない」を
       素直に比べられる。
     ・書く・消すの呼び出しを、鍵の名前で全部控える（__writes）。書いてすぐ消す、のように
       前後の中身には残らない触り方も、ここには残る。 */
const ANON_WATCH = function (seed) {
  for (const k of Object.keys(seed)) localStorage.setItem(k, seed[k]);
  const P = Storage.prototype, s = P.setItem, r = P.removeItem, c = P.clear;
  const where = (x) => (x === window.sessionStorage ? 'session:' : 'local:');
  window.__writes = [];
  P.setItem = function (k) { window.__writes.push(where(this) + k); return s.apply(this, arguments); };
  P.removeItem = function (k) { window.__writes.push(where(this) + k); return r.apply(this, arguments); };
  P.clear = function () { window.__writes.push(where(this) + '*'); return c.apply(this, arguments); };
  window.__dump = () => JSON.stringify([
    Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]),
    Object.keys(sessionStorage).sort().map((k) => [k, sessionStorage.getItem(k)])]);
  window.__ls0 = window.__dump();
};
/* ページの部品が前から書く鍵（この回に足したものではない）── テーマ（inline の applyTheme）と、
   英語ページの言語の控え（lang-toggle.js）。 */
const CHROME_KEYS = ['local:pv-theme', 'local:pv-lang'];
const anonSeed = (lang, theme, more) =>
  Object.assign({ 'pv-theme': theme }, lang === 'en' ? { 'pv-lang': 'en' } : {}, more || {});
/* 落ち着くまで待つ ── 読み込みが終わり・器が出て・社名の辞書が着き（そのあとの描き直しも
   済み）・通信が静まるまで。★時間では待たない（通信が 400ms 途切れた、という条件で待つ）。 */
async function anonSettled(page) {
  await page.waitForFunction(() => {
    const g = document.getElementById('dp-pick') || document.getElementById('dc-pick');
    const sig = g && g.getAttribute('data-sig');
    return document.readyState === 'complete' && !!document.querySelector('.dp-stage')
      && !!sig && Number(sig.split('|')[1]) > 0;
  }, { timeout: 20000 }).catch(() => {});
  /* ★時間切れでも投げない。器が出なかった回は、このあとの検査が「何が出ていないか」を
       字で言う（ここで投げると、理由を言わないまま検査ごと止まる ── 実際に、わざと壊して
       確かめた回にそうなった）。 */
  await page.waitForNetworkIdle({ idleTime: 400, timeout: 20000 }).catch(() => {});
}
const ANON_READ = (key) => ({
  url: location.pathname + location.search + location.hash,
  stage: (document.querySelector('.dp-stage') || {}).outerHTML || '',
  title: ((document.querySelector('.dp-stage .dp-msg-t') || {}).textContent || '').trim(),
  go: [...document.querySelectorAll('.dp-stage a.dp-cta')].map((a) => a.textContent.trim()),
  to: [...document.querySelectorAll('.dp-stage a.dp-cta')].map((a) => {
    const u = new URL(a.getAttribute('href'), location.href);
    return u.pathname + u.search + u.hash;
  }),
  links: document.querySelectorAll('.dp-stage a, .dp-stage button, .dp-stage input, .dp-stage select').length,
  from: window.__from, dump: window.__dump ? window.__dump() : null, ls0: window.__ls0 || null,
  writes: (window.__writes || []).slice(),
  mark: (function () { try { return localStorage.getItem(key); } catch (e) { return 'threw'; } })(),
  pop: document.querySelectorAll('.dp-pop').length, popSeen: (window.__pop || {}).seen,
  gf: document.querySelectorAll('#pvgf-back, .pvgf-back').length
});
/* この窓が出そうとした通信を、行き先で分ける。 */
const wires = (reqs) => ({
  rpc: reqs.filter((u) => /\/rpc\//.test(u)),
  api: reqs.filter((u) => /supabase\.co|\/rest\/v1\/|\/auth\/v1\//.test(u)),
  login: reqs.filter((u) => /login\.html|signup\.html|auth-callback/.test(u)),
  give: reqs.filter((u) => /pv-give-first/.test(u)),
  /* 確認用サーバの外へ向かったもの（検査が全部止めている）。ページの部品が前から読む
     3つ（supabase-js の CDN・書体・解析のタグ）のほかに、行き先が増えていないこと。 */
  odd: reqs.filter((u) => !u.startsWith(BASE)
    && !/^https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js|^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/|^https:\/\/www\.googletagmanager\.com\/gtag\/js/.test(u))
});
for (const lang of ['ja', 'en']) {
  const want = { label: TAB_LABEL[lang], to: (lang === 'en' ? '/en/' : '/') + 'actual-pay.html' };
  const path = (lang === 'en' ? '/en/' : '/') + 'deep-pay.html';
  const form = (lang === 'en' ? '/en/' : '/') + 'pay-report.html';
  let anonStage = '';

  /* 会員の側（同じ門）を先に開いて、器の字を控える。 */
  let twin = null;
  {
    const { page } = await open(lang, ANON_TWIN);
    twin = { s: await page.evaluate(SNAP), r: await page.evaluate(ANON_READ, POP_KEY) };
    await jars.pop().close().catch(() => {});
  }

  for (const theme of ['light', 'dark']) {
    const tag = `${lang}/${theme}/未ログイン`;
    const tail = theme === 'light' ? '?from=tab#top' : '';
    const { page, errs, reqs, navs } = await open(lang, ANON, theme, null,
      { tail, first: [[ANON_WATCH, anonSeed(lang, theme)], [POP_WATCH, POP_KEY]] });
    await anonSettled(page);
    const s = await page.evaluate(SNAP);
    const r = await page.evaluate(ANON_READ, POP_KEY);
    const w = wires(reqs);
    if (theme === 'light') anonStage = r.stage;

    // ── 居る ──
    ok(r.url === path + tail && navs.length === 1 && navs[0] === BASE + path + tail,
       `${tag}: ★★ログイン画面へ送られない ── 住所は来たときのまま（${path + tail}）・着いたのは1回だけ`,
       `${r.url} / ${JSON.stringify(navs)}`);
    ok(w.login.length === 0, `${tag}: ★ログイン・登録の画面へ向かう通信が無い`, w.login.join(' '));

    // ── 同じ板 ──
    ok(s.lock.on && s.ghost === 1 && s.stage === 1 && s.blurred.join(',') === 'dp-ghost' && s.skel === 0,
       `${tag}: ★★閉じた画面が出る ── ぼかした影絵の手前に板（骨組みは残っていない）`, ghostWhy(s));
    ok(r.stage.length > 400 && r.stage === twin.r.stage,
       `${tag}: ★★器（影絵＋板）が、「鍵が無く、答えきってもいない」会員の閉じた画面と1文字も違わない`,
       `長さ ${r.stage.length} / 会員 ${twin.r.stage.length}`);
    ok(r.title === ANON_T[lang].title && r.go.join('|') === ANON_T[lang].go,
       `${tag}: ★★題とボタンは、オーナー指定の字のまま（「${ANON_T[lang].title}」／「${ANON_T[lang].go}」）`,
       `${r.title} ／ ${r.go.join('|')}`);
    ok(s.lock.lines.join(' | ') === [LK[lang].key, LK[lang].ready].join(' | ')
       && s.lock.warn.join('|') === LK[lang].warn && s.lock.warnAtCta,
       `${tag}: ★★行は「鍵＋答え」の2つ・断りはボタンのすぐ上に1つ（会員の板と同じ字）`,
       JSON.stringify(s.lock.lines) + ' / ' + JSON.stringify(s.lock.warn));
    ok(s.lock.cta.join(',') === 'pay-report.html' && r.to.join(',') === form && r.links === 1,
       `${tag}: ★★板の入口はボタン1本・行き先はその言語の給与フォームの頭（${form}。#ps でも #pay-detail でもない）`,
       `${s.lock.cta.join(',')} → ${r.to.join(',')} / 押せるもの ${r.links}`);
    ok(s.lock.todoH === null && s.lock.todo.length === 0,
       `${tag}: ★★「まだ答えていない項目」の一覧は無い（会員が居ない）`,
       JSON.stringify([s.lock.todoH, s.lock.todo]));
    ok(!NOCOUNT.test(s.text) && !s.text.includes(LK[lang].goal) && !/[¥$€£]|万|%/.test(s.text),
       `${tag}: ★★人数も 100人の行も金額も出ない（サーバに聞いていないので、数を1つも知らない）`,
       countIn(s.text) + (s.text.match(/[^\n]*[¥$€£万%][^\n]*/) || [''])[0]);
    ok(s.kpi === 0 && s.comp.hidden && s.work.hidden && s.vari.hidden && s.more.hidden
       && s.pick.hidden && !s.pick.shown && s.cond === '' && s.empty === 0,
       `${tag}: ★数字の節・選ぶ欄・条件の1行・「読み込めませんでした」のどれも出ない`,
       `KPI ${s.kpi} / 欄 ${s.pick.shown} / 条件「${s.cond}」/ 板 ${s.empty}`);
    ok(s.lock.tags.every((t) => LOCK_TAGS.includes(t)) && !/null|undefined|NaN|\[object/.test(s.text),
       `${tag}: 板に余計なタグも null / undefined も無い`, s.lock.tags.join(' '));

    // ── 聞かない ──
    ok(Object.keys(s.rpc).length === 0 && s.args.length === 0 && r.from === 0,
       `${tag}: ★★rpc を1本も呼ばない（pv_deep_pay も、ほかの名前も。表も引かない）`,
       JSON.stringify(s.rpc) + ' / from ' + r.from);
    ok(w.rpc.length === 0 && w.api.length === 0,
       `${tag}: ★★窓の外から数えても、住所に /rpc/ の入った通信が0本（通信は全部で ${reqs.length} 本・サーバの API へも0本）`,
       w.rpc.concat(w.api).join(' '));
    ok(w.odd.length === 0 && w.give.length === 0,
       `${tag}: ★通信の行き先が増えていない（確認用サーバと、前から読む CDN・書体・解析のタグだけ。全ページの板の部品も読まない）`,
       w.odd.concat(w.give).join(' '));

    // ── 書かない ──
    ok(typeof r.ls0 === 'string' && r.dump === r.ls0,
       `${tag}: ★★保存領域が、ページの script が動く前と1文字も変わらない（localStorage も sessionStorage も）`,
       `前 ${r.ls0} / 後 ${r.dump}`);
    ok(r.writes.every((k) => CHROME_KEYS.includes(k)) && r.mark === null
       && !r.writes.some((k) => /was_locked|unlock|expiry|pv_user|pv_pay|pv_give|session_start|last_active|sb-/.test(k)),
       `${tag}: ★★書きに行った鍵は、ページの部品が前から書くものだけ（クラッカーの印も、門の鍵も無い）`,
       [...new Set(r.writes)].join(' '));

    // ── 出ない ──
    ok(r.pop === 0 && r.popSeen === 0, `${tag}: ★紙吹雪の器は1度も出ない`, `いま ${r.pop} / 出た回数 ${r.popSeen}`);
    ok(r.gf === 0, `${tag}: ★全ページの Give → Get の板は出ない（同じ3段を本文で出す画面のまま）`, String(r.gf));

    // ── 形（§2e・§0 と同じ物差し）──
    for (const vw of [320, 390, 1440]) {
      await page.setViewport({ width: vw, height: 1000 });
      await page.waitForFunction((x) => innerWidth === x, { timeout: 10000 }, vw);
      await navStill(page);
      const fit = await page.evaluate(GHOST_FIT);
      const c = (await page.evaluate(LOCK_FIT)) || { out: ['板が無い'], cut: [], con: {} };
      const bad = ghostBad(fit, c, vw);
      for (const [k, label] of GHOST_KINDS)
        ok(!bad[k], `${tag}/${vw}: ${label}`, bad[k] || '');
      ok(fit.over <= 0, `${tag}/${vw}: ★★横スクロールが生えない`, `+${fit.over}px`);
      const t = await page.evaluate(TABS);
      tabShape(t, `${tag}/${vw}`, want);
      ok(t.stage === true && t.aboveStage >= 0,
         `${tag}/${vw}: ★★タブは影絵と板の器（.dp-stage）より上に居る`, `すき間 ${t.aboveStage}px`);
    }
    /* ── 縦の置き場所（§2e の placeAt と同じ物差し）。この板は会員の「鍵＋答え」の板と
       同じ形だが、**本物の読み込みを通った板**で、窓の高さを変えて測る。 ── */
    await placeAt(page, tag, [['ログインしていない人の板', null]], null);

    if (theme === 'light') {
      /* 描き直しても（通貨の切替でも）、器を作り直さない・聞きに行かない・書かない。 */
      const again = await page.evaluate(() => {
        const st = document.querySelector('.dp-stage'), a = document.querySelector('.dp-stage a.dp-cta');
        if (a) a.focus();
        window.dispatchEvent(new Event('pv-currency-change'));
        window.dispatchEvent(new Event('pv-currency-change'));
        return { st: !!st && document.querySelector('.dp-stage') === st,
                 focus: !!a && document.activeElement === a,
                 rpc: Object.keys(window.__rpc).length, same: window.__dump() === window.__ls0 };
      });
      ok(again.st && again.focus && again.rpc === 0 && again.same,
         `${tag}: ★描き直しても、器は同じ要素のまま・ボタンの焦点が外れない・聞きに行かない・書かない`,
         JSON.stringify(again));
      /* キーボード。影絵には入らない・板のボタンには届く（幅は 1440 のまま）。 */
      const walk = await tabWalk(page);
      ok(walk.filter((x) => !x.body).length >= 8 && walk.some((x) => x.cta) && !walk.some((x) => x.ghost),
         `${tag}: ★★Tab で一周しても影絵には入らない・板のボタンには届く`,
         `ボタンに届いた=${walk.some((x) => x.cta)} 影絵に入った=${walk.some((x) => x.ghost)}`);
    }
    ok(errs.length === 0, `${tag}: JS のエラーが出ない`, errs.join(' / '));
    /* ★最後に、本物のマウスで REAL PAY のタブを押す（押したあとはあちらの画面）。 */
    if (theme === 'light') {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
        page.click('#dp-hd a.pv-paytab')
      ]);
      const landed = await page.evaluate(() => location.pathname);
      ok(landed === want.to, `${tag}: ★★REAL PAY のタブを押すと、その言語の REAL PAY へ着く`, landed);
    }
    await jars.pop().close().catch(() => {});
  }

  // ── 前のログインの印が端末に残っている人 ──
  {
    const tag = `${lang}/未ログイン/前の印が残っている`;
    const { page, errs, reqs } = await open(lang, ANON, 'light', null,
      { first: [[ANON_WATCH, anonSeed(lang, 'light', { [POP_KEY]: 'abc123' })], [POP_WATCH, POP_KEY]] });
    await anonSettled(page);
    const r = await page.evaluate(ANON_READ, POP_KEY);
    ok(r.stage === anonStage && r.mark === 'abc123' && r.dump === r.ls0
       && !r.writes.some((k) => k.includes(POP_KEY)) && r.pop === 0 && r.popSeen === 0,
       `${tag}: ★★同じ板が出る・印は消さない・書き換えない・鳴らさない`,
       `印 ${JSON.stringify(r.mark)} / 触った鍵 ${[...new Set(r.writes)].join(' ')} / 出た ${r.popSeen}`);
    ok(wires(reqs).rpc.length === 0 && errs.length === 0,
       `${tag}: 聞きに行かない・JS のエラーが出ない`, wires(reqs).rpc.join(' ') + errs.join(' / '));
    await jars.pop().close().catch(() => {});
  }

  // ── ログインが切れていた（入口の1回で）──
  for (const [name, fail] of (lang === 'ja' ? [['42501・HTTP 401', LOST], ['鍵の期限切れ・HTTP 401', LOST_J]]
                                             : [['42501・HTTP 401', LOST]])) {
    const tag = `${lang}/ログインが切れていた（${name}）`;
    const { page, errs, reqs, navs } = await open(lang, { __fail: fail, __wire: true }, 'light', null,
      { first: [[ANON_WATCH, anonSeed(lang, 'light')], [POP_WATCH, POP_KEY]] });
    await anonSettled(page);
    const s = await page.evaluate(SNAP);
    const r = await page.evaluate(ANON_READ, POP_KEY);
    const w = wires(reqs);
    ok(r.stage === anonStage && s.empty === 0 && s.lock.on,
       `${tag}: ★★ログインしていない人と同じ板（器ごと1文字も違わない）。「読み込めませんでした」は出さない`,
       `同じ=${r.stage === anonStage} / エラーの板 ${s.empty}`);
    ok(s.rpc.pv_deep_pay === 1 && s.args.length === 1 && s.args[0] === null,
       `${tag}: ★聞いたのは入口の1回だけ（聞き直さない）`, JSON.stringify(s.rpc));
    /* ★網の自己点検。この筋書きは実際に聞いているので、窓の外の記録に1本掛かるはず
         ── 掛からなければ、上の「0本」は網が空振りしていただけ。 */
    ok(w.rpc.filter((u) => /\/rpc\/pv_deep_pay$/.test(u)).length === 1,
       `${tag}: ★（網の自己点検）聞いた1本は、窓の外の記録に /rpc/pv_deep_pay として掛かっている`,
       w.rpc.join(' ') || '（1本も掛かっていない）');
    ok(r.mark === null && !r.writes.some((k) => k.includes(POP_KEY))
       && !r.writes.some((k) => /unlock|expiry/.test(k)) && r.pop === 0 && r.popSeen === 0,
       `${tag}: ★★クラッカーの印を置かない（この人には指紋が在る）・門の鍵を書き換えない・鳴らさない`,
       `印 ${JSON.stringify(r.mark)} / 触った鍵 ${[...new Set(r.writes)].join(' ')}`);
    ok(navs.length === 1 && w.login.length === 0 && errs.length === 0,
       `${tag}: よそへ運ばない・JS のエラーが出ない`, JSON.stringify(navs) + errs.join(' / '));
    await jars.pop().close().catch(() => {});
  }

  // ── ログインが切れていた（開いた画面で、区分を選んだ回に）──
  {
    const tag = `${lang}/ログインが切れていた（区分を選んだ回）`;
    const { page, errs } = await open(lang, Object.assign(clone(FULL), { __fail: LOST, __failAfter: 1 }),
      'light', null, { first: [[ANON_WATCH, anonSeed(lang, 'light')], [POP_WATCH, POP_KEY]] });
    const before = await page.evaluate(SNAP);
    await choose(page, MINE);
    await page.waitForFunction(() => !!document.querySelector('.dp-stage'), { timeout: 20000 }).catch(() => {});
    const s = await page.evaluate(SNAP);
    const r = await page.evaluate(ANON_READ, POP_KEY);
    ok(!before.lock.on && noGhost(before) && before.pick.shown,
       `${tag}: （前置き）入口の1回は通って、開いた画面（選ぶ前）が出ている`, ghostWhy(before));
    ok(r.stage === anonStage && s.empty === 0 && s.kpi === 0 && !s.pick.shown && s.cond === ''
       && !/[¥$€£]|万|%/.test(s.text),
       `${tag}: ★★選んだ回に切れていても、同じ板（数字・選ぶ欄・条件の1行は出ない。エラーの板でもない）`,
       `同じ=${r.stage === anonStage} / KPI ${s.kpi} / 欄 ${s.pick.shown} / エラーの板 ${s.empty}`);
    ok(s.rpc.pv_deep_pay === 2 && r.mark === null && r.pop === 0 && errs.length === 0,
       `${tag}: ★聞き直さない（入口＋選んだ1回）・印を置かない・JS のエラーが出ない`,
       JSON.stringify(s.rpc) + ' / 印 ' + JSON.stringify(r.mark) + ' ' + errs.join(' / '));
    await jars.pop().close().catch(() => {});
  }

  // ── ほかの失敗は、今までどおり「読み込めませんでした」──
  for (const [name, payload] of (lang === 'ja'
    ? [['通信が切れた（番号 0）', { __fail: NET }], ['サーバが落ちた（500）', { __fail: DOWN }],
       ['答えの箱が投げた', { __reject: true }]]
    : [['通信が切れた（番号 0）', { __fail: NET }]])) {
    const tag = `${lang}/ほかの失敗（${name}）`;
    const { page, errs } = await open(lang, payload);
    const s = await page.evaluate(SNAP);
    const msg = await page.evaluate(() => [...document.querySelectorAll('#dp-kpi .pt-empty')].map((e) => e.textContent));
    ok(msg.join('|') === ERR_TEXT[lang] && s.kpi === 0 && noGhost(s) && !s.lock.on,
       `${tag}: ★★今までどおり「読み込めませんでした」だけ（板も影絵も出さない ── 給与を出してとは頼まない）`,
       JSON.stringify(msg) + ' / ' + ghostWhy(s));
    ok(s.rpc.pv_deep_pay === 1 && errs.length === 0,
       `${tag}: 聞いたのは1回・JS のエラーが出ない`, JSON.stringify(s.rpc) + errs.join(' / '));
    await jars.pop().close().catch(() => {});
  }
}

// ── 3. そろった状態（配置の骨格）─────────────────────────────
{
  const { page, errs } = await open('ja', FULL, 'light', MINE);
  const s = await page.evaluate(SNAP);
  /* ★3枚（2026-08-31）。4枚目「詳細投稿数 ◯件」を捨てた ── 中身は
     db/deep-pay.sql の hagg の count(*) ＝**人数**で、単位が「件」なのが誤り。
     ★2026-10-11 からは人数そのものをどこにも出さない（条件バーの「◯人」も外した）。
       ⚠️ 4枚目を人数で足し戻さない。 */
  ok(s.kpi === 3, 'そろっていれば KPI は3枚', `今 ${s.kpi} 枚`);
  ok(s.donut === 1, 'ドーナツは1つ', `今 ${s.donut} 個`);
  ok(s.legend.length === 6, '凡例は渡した6区分ぶん', `今 ${s.legend.length} 行`);
  ok(s.work.rows === 4, '働き方は4行', `今 ${s.work.rows} 行`);
  /* ★働き方に棒を戻さない。時間・日・泊は単位が違うので、
     同じ基準で伸ばした棒は長さを比べる意味が無い（戻すと静かに嘘になる）。 */
  ok(s.workBars === 0, '★働き方の行に棒を付けない（時間・日・泊は単位が違う）',
     `今 ${s.workBars} 本`);
  ok(!/棒の長さ/.test(s.work.text), '★消した棒の説明書きも残っていない');
  /* ★「何をすると給与が増えるか」の1行。一番大きい区分を名指しする。 */
  ok(s.varLead.length === 1 && /46\s*%/.test(s.varLead[0]),
     '★変動給の節に「一番大きい区分」の1行が出る', JSON.stringify(s.varLead));
  /* ★条件バーに人数を出さない（2026-10-11・オーナー判断）。前は
     「12人 / うち明細あり 4人」と出していた。件数でも人数でも、数は置かない。
     残るのは 区分の語 ／ 対象期間 ／ 信頼度の札 の3つだけ。 */
  const condLine = s.cond.replace(/\n/g, ' ');
  ok(!/件/.test(condLine) && !NOCOUNT.test(condLine) && !/明細あり/.test(condLine),
     '★★条件バーに人数を出さない（「◯人」「うち明細あり ◯人」「◯件」のどれも無い）', condLine);
  ok(/全日本空輸|ANA/.test(condLine) && /副操縦士/.test(condLine) && /直近\s*24\s*か月/.test(condLine),
     '条件バーには区分の語と対象期間が残っている', condLine);
  /* ★信頼度はサーバが返した段（cohort.trust）をそのまま出す。見本は high。 */
  ok(s.trust.length === 1 && s.trust[0] === '信頼度 高',
     '★信頼度の札はサーバの段をそのまま出す（high →「信頼度 高」）', JSON.stringify(s.trust));
  /* ★開いた画面のどこにも「◯人」が無い（注記・補足・節の見出しまで全部）。 */
  ok(!NOCOUNT.test(s.text), '★★開いた画面の本文に人数の形の字が1つも無い', countIn(s.text));
  ok(s.vari.rows === 6, '変動給は6行', `今 ${s.vari.rows} 行`);
  /* ★night / weekend / holiday は3つのまま（1行にまとめない）。 */
  const nwh = ['夜間', '週末', '祝'].filter((w) => s.vari.text.includes(w));
  ok(nwh.length === 3, '★夜間・週末・祝日は3行のまま（1つにまとめない）', nwh.join(''));
  /* ★棒は全部同じ色（色で良し悪しを言わない）。 */
  ok(new Set(s.bars).size === 1, '★変動給の棒は全部同じ色', [...new Set(s.bars)].join(' '));
  /* ★「準備中」の押せないボタンは置かない（2026-08-31・オーナー確定）。
     押せないボタンは、その場で読み手の時間を1回奪って何も返さない。
     出来た先へリンクを足すのはそのときで、それまでは在る道1本だけを出す。
     ⚠️ ここを 0 に固定しているので、次に「準備中」を足そうとすると赤くなる。
        足したくなったら、まずこの行と assert-deep-pay-compare.mjs の
        「下の入口」を見ること（あちらも同じ日に 0 にした）。 */
  /* ★★2026-10-12（オーナー判断「会社比較はまだ出さないでよ」）── いまは、その「在る道1本」も
       出さない。入口が会社比較しか無いので、カードは**枠ごと**出ない（題と説明だけの箱も、
       押せないボタンも置かない）。前の約束（リンクは1本・準備中は置かない）は、試験用の口で
       カードを出して §3h が見続けている。 */
  ok(s.more.hidden && s.moreShown === false && s.moreKids === 0 && s.moreLinks === 0 && s.moreBtns.length === 0,
     '★★「もっと深く見る」のカードは枠ごと出ない（器は畳んだまま・中は空・リンクもボタンも無い）',
     `hidden=${s.more.hidden} 描かれている=${s.moreShown} 中身 ${s.moreKids} / ${JSON.stringify(s.moreHrefs)}`);
  ok(s.cmpLinks === 0 && !/会社比較|もっと深く見る/.test(s.text),
     '★★開いた画面のどこにも、会社比較へのリンクが無い（文書ぜんたいで0本。カードの字も本文に無い）',
     `リンク ${s.cmpLinks} 本`);
  /* ★変動給比率は「100 − 固定・保証給比率」ではない。db/deep-pay.sql の fixed_pct は
     固定＋職位＋役割で、残りにはパーディアム・住宅・その他・未分類も入っている。
     見本は 固定 62% ／ segs の variable 24%。引き算だと 38% になる。
     ⚠️ 本文全体を見ると凡例の 24% でも通ってしまうので、KPI の添え字だけを見る。 */
  ok(s.kpiN.some((t) => /変動給比率\s*24\s*%/.test(t))
     && !s.kpiN.some((t) => /38\s*%/.test(t)),
     '★変動給比率は segs の variable から出す（100 − 固定給 ではない）',
     JSON.stringify(s.kpiN));
  ok(!/undefined|NaN|\[object/.test(s.text), '本文に undefined / NaN が出ない');
  /* ★開いた画面には影絵が無い（2026-10-11）。本物の値が並ぶ画面に、ぼかした要素を
       1つも置かない ── 影絵が在ってよいのは、数字が1つも来ていない閉じた画面だけ。 */
  ok(noGhost(s), '★★開いた画面に影絵が無い（ぼかしの効いた要素が1つも無い）', ghostWhy(s));
  ok(errs.length === 0, 'JS のエラーが出ない', errs.join(' / '));
}

// ── 3c. 数字の定義がそろっている（2026-09-01）──────────────────
/* ChatGPT の指示 ──「同一条件を選んだとき、DEEP PAY ↓ Pay Structure ↓
   Pay / Block Hour ↓ Company Compare の数字が論理的・数学的に完全に整合していること」。
   ここは**画面側**（読み手が電卓で追えるか）。SQL が本当に割り算で結べるかは
   db/test-deep-pay.mjs の19節が、全員同じ値の区分をわざと作って見ている。 */
{
  /* 画面に出ている文字から読み直す。「¥1,903万」→ 1903。 */
  const man = (t) => {
    const m = /¥\s*([\d,]+)\s*万/.exec(t || '');
    return m ? Number(m[1].replace(/,/g, '')) : null;
  };
  /* deep-pay.js の sig2 と同じ（有効数字2桁）。★月換算は「約」なので2桁のまま。
     細かくなったのは年収のほう（2026-10-11 から 1万円刻み）で、ここは
     **画面に出ている年収**から割り直すので、年収の細かさに勝手についていく。 */
  const sig2 = (v) => {
    const p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10) - 1);
    return Math.round(v / p) * p;
  };
  const { page } = await open('ja', FULL, 'light', MINE);
  const s = await page.evaluate(SNAP);
  const a = man(s.kpiV[0]), m = man(s.kpiN[0]);

  // ── 年収カードの月換算 ──────────────────────────────────────
  ok(/月換算（賞与ぬき）約/.test(s.kpiN[0] || ''),
     '★賞与の割合が出ている区分では「月換算（賞与ぬき）」と名乗る', s.kpiN[0]);
  /* ★割り算の元が「2桁に丸めた年収」に戻っていないこと。見本は ¥1,903万。
     2桁に丸めた ¥1,900万 から割っても同じ 150万 になるので、**年収の字そのもの**を
     先に見る（100万の倍数でない＝刻みで出ている）。 */
  ok(a != null && a % 100 !== 0,
     '★年収は 1万円刻みで出ている（有効数字2桁の丸い額に戻っていない）', `画面 ${s.kpiV[0]}`);
  ok(a != null && m != null && m === sig2(a * (1 - 5 / 100) / 12),
     '★月換算は「画面の年収 ×(1−賞与割合)÷12」＝読み手が電卓で出せる',
     `${a}万 × 0.95 ÷ 12 → ${a == null ? '?' : sig2(a * 0.95 / 12)}万 ／ 画面 ${m}万`);
  /* ★負の対照。賞与を引かない「年収÷12」なら別の数字になる。ここが同じ値だと、
     上の検査は何も守っていないことになる（見本の年収 1,903万 では 160万 と 150万）。 */
  ok(a != null && m !== sig2(a / 12),
     '★賞与を引かない「年収÷12」とは別の数字になる（引く必要があることの証拠）',
     `年収÷12 → ${a == null ? '?' : sig2(a / 12)}万 ／ 画面 ${m}万`);

  // ── 固定・保証給比率（指示 §3 の言い方）─────────────────────
  ok(/固定・保証給比率/.test(s.text) && !/固定給比率/.test(s.text),
     '★見出しは「固定・保証給比率」（古い「固定給比率」は残っていない）');
  ok(/乗務量に左右されにくい報酬/.test(s.kpiN[1] || ''),
     '★その補足は「乗務量に左右されにくい報酬」', s.kpiN[1]);

  // ── Pay / Block Hour（指示 §7）──────────────────────────────
  /* ★保存時の定義は「年収USD ÷ (12 × Block Hours)」（db/pay-reports.sql）。
     年収には賞与も住宅手当もパーディアムも入っている＝**賞与ぬきの月額報酬ではない**。
     「月額報酬 ÷ Block Hours」と書くと、給与構成の月額で割ったように読める。 */
  ok(!/月額報酬/.test(s.text), '★画面のどこにも「月額報酬 ÷ Block Hours」と書かない');
  ok(/1人ずつ/.test(s.kpiN[2] || ''),
     '★Pay / Block Hour は「1人ずつ」出した中央値だと書く（＝で結べるように書かない）',
     s.kpiN[2]);

  // ── 年収の定義（指示 §5）と人数の壁 ─────────────────────────
  /* ★注記は KPI の下の**1行にまとめる**。給与構成のカードへ戻すと、
     狭いぶん折れて画面が下へ伸び、「★1画面に収まる」が落ちる。 */
  ok(s.foot.length === 1 && s.foot[0].in === 'dp-kpi',
     '★注記は KPI の下の1行だけ（カードの中に散らさない）',
     JSON.stringify(s.foot.map((f) => f.in)));
  /* ★壁が**在ること**は言う。**何人か**は言わない（2026-10-11・オーナー判断）。
     前は「※ 3人以上そろった区分だけを出します。3人未満は 0 ではなく…」だった。 */
  ok((s.foot[0] ? s.foot[0].t : '').includes(
       '※ データが十分にそろった区分だけを出します。足りない項目は 0 ではなく行ごと出しません。'),
     '★人数の壁が在ることは注記に残っている（何人かは書かない）',
     s.foot[0] ? s.foot[0].t : '');
  ok(!NOCOUNT.test(s.foot[0] ? s.foot[0].t : ''), '★注記に人数を書かない',
     countIn(s.foot[0] ? s.foot[0].t : ''));
  ok(/年収＝/.test(s.foot[0] ? s.foot[0].t : '')
     && /住宅手当/.test(s.foot[0].t) && /現物の社宅は含みません/.test(s.foot[0].t),
     '★年収が何を含むかを画面に書く（現物の社宅は含まない）',
     s.foot[0] ? s.foot[0].t : '');

  // ── 対象期間（db/deep-pay.sql の interval '24 months' の写し）──
  ok(/直近\s*24\s*か月/.test(s.cond.replace(/\n/g, ' ')),
     '★条件バーに対象期間（直近24か月）が出る', s.cond.replace(/\n/g, ' '));
}

// ── 3d. 賞与の割合が伏せられているときは「賞与ぬき」と名乗らない ──
/* ★人数の壁に届かず割合が出ていないだけで、賞与が無いとは限らない。
   そこで「賞与ぬき」と書くと、賞与のある1〜2人ぶんを黙って隠したことになる。 */
{
  const { page } = await open('ja', NOBONUS, 'light', MINE);
  const s = await page.evaluate(SNAP);
  /* ⚠️ 本文全体で数えない。給与構成のカードの副題が「月々の現金・賞与ぬき」で、
     あちらは**割合が出ていなくても正しい**（SQL の ucm が賞与を引いた月額だから）。
     ここで見たいのは年収カードの添え字1本だけ。 */
  ok(!/賞与ぬき/.test(s.kpiN[0] || ''),
     '★割合が出ていない区分では月換算に「賞与ぬき」と書かない', s.kpiN[0]);
  ok(/月換算 約/.test(s.kpiN[0] || ''), '★ラベルは「月換算 約」のまま', s.kpiN[0]);
}

// ── 3e. 英語側も同じ定義になっている ───────────────────────────
{
  const { page } = await open('en', FULL, 'light', MINE);
  const s = await page.evaluate(SNAP);
  ok(/Fixed & guaranteed share/.test(s.text) && !/Fixed pay share/.test(s.text),
     '★英語も「Fixed & guaranteed share」');
  ok(/bonus excluded/.test(s.kpiN[0] || ''), '★英語も月換算は賞与ぬき', s.kpiN[0]);
  ok(/Per-pilot/.test(s.kpiN[2] || '') && !/monthly pay/i.test(s.text),
     '★英語の Pay / Block Hour も「1人ずつ」（monthly pay ÷ … と書かない）', s.kpiN[2]);
  ok(s.foot.length === 1 && s.foot[0].in === 'dp-kpi'
     && /housing in kind is not counted/.test(s.foot[0].t),
     '★英語も注記1行に年収の定義が入っている',
     JSON.stringify(s.foot));
  ok(/last 24 months/.test(s.cond.replace(/\n/g, ' ')),
     '★英語の条件バーにも対象期間が出る', s.cond.replace(/\n/g, ' '));
  /* ★人数を出さないのは英語も同じ（2026-10-11）。前は「12 pilots / payslip-backed 4 pilots」
     と「Groups of 3+ pilots only; fewer than 3 is left out, not zero.」だった。 */
  ok(s.foot[0].t.includes(
       'Only groups with enough data are shown; anything short of that is left out, not shown as zero.'),
     '★英語の注記も、壁が在ることだけを言う（何人かは書かない）', s.foot[0].t);
  ok(!NOCOUNT.test(s.text) && !/payslip-backed/i.test(s.text),
     '★★英語の本文にも人数の形の字が1つも無い（◯ pilots）', countIn(s.text));
  ok(s.trust.length === 1 && s.trust[0] === 'Confidence High',
     '★英語の信頼度の札もサーバの段をそのまま出す', JSON.stringify(s.trust));
}

// ── 3f. 人数が来ても出さない／信頼度が来なければ札を出さない（2026-10-11）──
/* ★db/*.sql は push では本番に入らない。**貼る前の本番は古い形で返してくる** ──
   区分の人数（cohort.n・head.verified_n …）が付いていて、信頼度の段が無い。
   そのどちらでも、画面が人数を刷らないこと・段を自分で作らないことを見る。
   ⚠️ 「12人が出ていない」だけを見ない。毒の無い見本と**1文字も違わない**ことを
      見る ── 人数を別の言い方（「12件」「12 reports」）で刷る後戻りも一緒に捕まる。 */
for (const lang of ['ja', 'en']) {
  const dom = (pg) => pg.evaluate(() => document.getElementById('dp-root').innerHTML);
  const { page: p0 } = await open(lang, FULL, 'light', MINE);
  const clean = { s: await p0.evaluate(SNAP), h: await dom(p0) };
  const { page: p1, errs } = await open(lang, POISON, 'light', MINE);
  const bad = { s: await p1.evaluate(SNAP), h: await dom(p1) };
  ok(bad.s.kpi === 3 && bad.s.text === clean.s.text && bad.h === clean.h,
     `${lang}: ★★サーバが人数を返してきても、画面は1文字も変わらない（読まない）`,
     `本文が同じ=${bad.s.text === clean.s.text} / DOM が同じ=${bad.h === clean.h}`);
  ok(!NOCOUNT.test(bad.s.text) && !/12\s*(?:人|名|件)|7\s*(?:人|名|件)|\b12 pilots\b|\b7 pilots\b/i.test(bad.s.text),
     `${lang}: ★★毒入りの人数（12・7）が本文に出ない`, countIn(bad.s.text));
  ok(errs.length === 0, `${lang}: 毒入りの答えで JS のエラーが出ない`, errs.join(' / '));

  const { page: p2 } = await open(lang, NOTRUST, 'light', MINE);
  const nt = await p2.evaluate(SNAP);
  ok(nt.kpi === 3 && nt.trust.length === 0 && !/信頼度|Confidence/.test(nt.cond),
     `${lang}: ★信頼度の段が来なければ札ごと出さない（「低」で埋めない・自分で作らない）`,
     JSON.stringify(nt.trust) + ' / ' + nt.cond.replace(/\n/g, ' '));
  ok(/直近\s*24\s*か月|last 24 months/.test(nt.cond),
     `${lang}: 札が無くても条件バーの残りはそのまま出る`, nt.cond.replace(/\n/g, ' '));
}

// ── 3g. 見出しの2つは刻みで出す（2026-10-11・オーナー判断）──────────
/* 年収の中央値と Pay / Block Hour だけ、**表示通貨の中で**刻みに寄せる。
     円     … 年収 1万円      ／ Pay / Block Hour 100円
     ほか   … 年収 1,000      ／ Pay / Block Hour 1
   サーバは USD を刻み（$50・$0.5）で返す。見本は $119,700 と $102.5。
   ★刷られる字そのものを固定する。レートは currency.js の RATES（USD 158.95・
     EUR 185.69）。レートを取り直すとここの期待値も動く ── そのときは下の表を
     計算し直す（119700 × USD ÷ その通貨、を刻みに寄せる）。
   ⚠️ 英語ページの既定の通貨は**この機械のタイムゾーン**で決まる。必ず
      PVCurrency.set() で名指ししてから読む（既定に任せると置き場所で答えが変わる）。
   ⚠️ 給与構成の月額は細かくしていない（有効数字2桁のまま）。そちらまで
      刻みにすると、項目ごとの少ない人数から実額を割り戻しやすくなる。 */
{
  /* 通貨を名指しして、KPI がその通貨で描き直されるまで待つ（時間では待たない）。 */
  const setCur = async (pg, cur, sym) => {
    await pg.evaluate((c) => window.PVCurrency.set(c), cur);
    await pg.waitForFunction((c, y) => window.PVCurrency.get() === c
      && ((document.querySelector('.dp-kpi-v') || {}).textContent || '').indexOf(y) === 0,
      { timeout: 10000 }, cur, sym);
    return pg.evaluate(SNAP);
  };
  const { page: ja } = await open('ja', FULL, 'light', MINE);
  const j = await ja.evaluate(SNAP);
  ok(j.kpiV[0] === '¥1,903万' && j.kpiV[2] === '¥16,300',
     '★日本語＋円 ── 年収は 1万円刻み（¥1,903万）・Pay / Block Hour は 100円刻み（¥16,300）',
     JSON.stringify(j.kpiV));
  ok(/^¥[\d,]+万$/.test(j.kpiV[0] || '') && !/00万$/.test(j.kpiV[0] || ''),
     '★年収が「万」で出ていて、100万の倍数に丸まっていない', j.kpiV[0]);
  ok(/^¥[\d,]*00$/.test(j.kpiV[2] || ''),
     '★Pay / Block Hour は 100円の倍数で終わる（1円単位まで持っているように見せない）', j.kpiV[2]);
  /* ★給与構成の月額は今までどおり有効数字2桁（$4,800 → ¥760,000）。 */
  ok(j.legend[0] === '¥760,000',
     '★給与構成の月額は細かくしていない（有効数字2桁のまま）', JSON.stringify(j.legend));

  const u = await setCur(ja, 'USD', '$');
  ok(u.kpiV[0] === '$120K' && u.kpiV[2] === '$103',
     '★ドル ── 年収は 1,000 刻み（$120K）・Pay / Block Hour は 1 刻み（$103）',
     JSON.stringify(u.kpiV));
  /* ── 有効数字2桁も、表示通貨の中で掛ける（2026-10-11）────────────────
     前は「円で2桁に寄せてから換算」だったので、円以外では端数が戻っていた ──
     サーバの $4,800 が ¥760,000 を経て **$4,781** と出る（持っているのは2桁だけなのに、
     1ドル単位まで知っているように読める）。いまは換算してから寄せる（deep-pay.js の sigIn）。
     ★ドルでは、サーバが返した2桁の額がそのまま出る（4800 / 2200 / 730 / 640 / 460 / 370）。
     ★月換算も同じ。ドルなら「$120K × 0.95 ÷ 12 ＝ $9.5K」と、画面の字のまま検算できる
       （円で寄せてから換算すると $9.4K になって合わない）。 */
  ok(u.legend.join(' ') === '$4,800 $2,200 $730 $640 $460 $370',
     '★★ドル ── 給与構成の月額は、その通貨の中で2桁（$4,781 のような端数を出さない）',
     u.legend.join(' '));
  ok(/\$9\.5K$/.test(u.kpiN[0] || ''),
     '★ドル ── 月換算は画面の年収から検算できる（$120K × 0.95 ÷ 12 ＝ $9.5K）', u.kpiN[0]);
  const e = await setCur(ja, 'EUR', '€');
  ok(e.kpiV[0] === '€102K' && e.kpiV[2] === '€88',
     '★ユーロ ── 換算してから刻みに寄せる（€102K・€88。端数の残った額を出さない）',
     JSON.stringify(e.kpiV));
  ok(e.legend.join(' ') === '€4,100 €1,900 €620 €550 €390 €320' && /€8\.1K$/.test(e.kpiN[0] || ''),
     '★★ユーロ ── 月額も月換算も、換算してから2桁に寄せる（どの額も上から2桁のあとは 0）',
     e.legend.join(' ') + ' ／ ' + e.kpiN[0]);
  for (const [nm, snap] of [['ドル', u], ['ユーロ', e]]) {
    const odd = snap.legend.filter((t) => !/^[1-9]\d?0*$/.test(t.replace(/\D/g, '')));
    ok(odd.length === 0, `★${nm} ── 月額に3桁目以降の端数が残っていない`, odd.join(' '));
  }
  /* ★円に戻すと、最初と1文字も違わない（換算の行き帰りで額がずれない）。
       月額も同じ ── 円の表示は、この直しの前と1文字も変わっていない。 */
  const back = await setCur(ja, 'JPY', '¥');
  ok(back.kpiV.join('|') === j.kpiV.join('|') && back.kpiN[0] === j.kpiN[0],
     '★通貨を切り替えて円に戻すと、見出しの数字は1文字も違わない',
     JSON.stringify(back.kpiV));
  ok(back.legend.join(' ') === j.legend.join(' ')
     && j.legend.join(' ') === '¥760,000 ¥350,000 ¥120,000 ¥100,000 ¥73,000 ¥59,000'
     && /約 ¥150万$/.test(j.kpiN[0] || ''),
     '★★円の月額・月換算は今までどおり（¥760,000 … ／ 約 ¥150万）で、戻しても同じ',
     j.legend.join(' ') + ' ／ ' + j.kpiN[0]);

  const { page: en } = await open('en', FULL, 'light', MINE);
  /* 既定がどの通貨でも通るように、いったん別の通貨を挟んでから円にする
     （同じ通貨を set しても何も起きないので、待ちが時間切れになる）。 */
  const cur0 = await en.evaluate(() => window.PVCurrency.get());
  if (cur0 === 'JPY') await setCur(en, 'USD', '$');
  const y = await setCur(en, 'JPY', '¥');
  ok(y.kpiV[0] === '¥19,030,000' && y.kpiV[2] === '¥16,300',
     '★英語＋円 ──「万」に畳まず全部の桁で出す（¥19,030,000・¥16,300）',
     JSON.stringify(y.kpiV));
  /* ★いちばん長い字はここ（英語＋円の 11文字）。切れていないことをこの状態で測る。 */
  const clipped = await en.evaluate(() => Array.prototype.slice
    .call(document.querySelectorAll('.dp-kpi-v'))
    .filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent));
  ok(clipped.length === 0, '★細かくした額が KPI のカードから切れていない（英語＋円）',
     clipped.join(' '));
  const eu = await setCur(en, 'USD', '$');
  ok(eu.kpiV[0] === '$120K' && eu.kpiV[2] === '$103',
     '★英語＋ドルも同じ額（$120K・$103）', JSON.stringify(eu.kpiV));
}

// ── 3h. 会社比較を閉じているあいだの、下の段（2026-10-12・オーナー判断）──────────
/* 「会社比較はまだ出さないでよ」。開いた画面のいちばん下の段は、前は
   「何をすると給与が増えるか｜もっと深く見る」の2枚だった。右のカードを枠ごと出さなくなった
   ので、見るのは ──
     形 … 320 / 390 / 1440 のどの幅でも、左のカードが**段の幅いっぱい**（右に空の列も、
          その手前の間も残っていない）・横スクロールが生えない・器（#dp-more）は場所を取らない。
          ★前の CSS は列を2本とも名指ししていたので、右を hidden にすると 256px の空の列が
            残った（deep-pay.css の .dp-row--var の注）。ここが、その後戻りの見張り。
     無い … 日英のどの幅でも、会社比較へのリンクが文書ぜんたいで0本。
   続けて、**眠っているカード**を試験用の口（cmp）で出す ── 出す日に戻る姿が腐っていないこと：
     リンクは1本・行き先は相対の deep-pay-compare.html（/en/ からは /en/ に解ける）・
     「準備中」の押せないボタンを置かない・広い画面では右に 256px の列で並ぶ（前と同じ寸法）。 */
const ROW_FIT = () => {
  const row = document.querySelector('.dp-row--var');
  const v = document.getElementById('dp-var'), m = document.getElementById('dp-more');
  const de = document.documentElement;
  if (!row || !v || !m) return null;
  const rr = row.getBoundingClientRect(), rv = v.getBoundingClientRect(), rm = m.getBoundingClientRect();
  const a = m.querySelector('a');
  return {
    over: de.scrollWidth - de.clientWidth,
    row: [Math.round(rr.left * 10) / 10, Math.round(rr.right * 10) / 10],
    vari: [Math.round(rv.left * 10) / 10, Math.round(rv.right * 10) / 10, Math.round(rv.width * 10) / 10],
    more: [Math.round(rm.left * 10) / 10, Math.round(rm.right * 10) / 10, Math.round(rm.width * 10) / 10,
           Math.round(rm.top - rv.top)],
    moreShown: getComputedStyle(m).display !== 'none', moreKids: m.children.length,
    cols: getComputedStyle(row).gridTemplateColumns.split(' ').length,
    links: document.querySelectorAll('a[href*="deep-pay-compare"]').length,
    href: a ? a.getAttribute('href') : null,
    to: a ? new URL(a.getAttribute('href'), location.href).pathname : null,
    btns: m.querySelectorAll('button').length,
    cut: [...document.querySelectorAll('#dp-var .dp-li, #dp-more a')]
      .filter((e) => e.scrollWidth > e.clientWidth + 1).length
  };
};
for (const lang of ['ja', 'en']) {
  // ── 配っているファイルのまま（カードは出ない）──
  {
    const { page, errs } = await open(lang, FULL, 'light', MINE);
    for (const vw of [320, 390, 1440]) {
      await page.setViewport({ width: vw, height: 1000 });
      await page.waitForFunction((x) => innerWidth === x, { timeout: 10000 }, vw);
      await navStill(page);
      const f = (await page.evaluate(ROW_FIT)) || { row: [], vari: [], more: [] };
      ok(f.over <= 0, `${lang}/${vw}: ★★横スクロールが生えない（カードを出さない姿）`, `+${f.over}px`);
      ok(f.moreShown === false && f.moreKids === 0 && f.more[2] === 0 && f.links === 0,
         `${lang}/${vw}: ★★カードの器は場所を取らない・中は空・会社比較へのリンクは文書ぜんたいで0本`,
         `描かれている=${f.moreShown} 中身 ${f.moreKids} 幅 ${f.more[2]} リンク ${f.links}`);
      ok(Math.abs(f.vari[0] - f.row[0]) <= 0.6 && Math.abs(f.vari[1] - f.row[1]) <= 0.6 && f.cols === 1 && f.vari[2] > 200,
         `${lang}/${vw}: ★★「何をすると給与が増えるか」が段の幅いっぱい（右に空の列が残っていない）`,
         `段 ${f.row.join('..')} / カード ${f.vari.join('..')} / 列 ${f.cols}`);
      ok(f.cut === 0, `${lang}/${vw}: 変動給の行が切れていない`, `切れた行 ${f.cut}`);
    }
    ok(errs.length === 0, `${lang}: JS のエラーが出ない（カードを出さない姿）`, errs.join(' / '));
    await jars.pop().close().catch(() => {});
  }
  // ── 眠っているカード（試験用の口で出す ＝ 出す日に戻る姿）──
  {
    const { page, errs } = await open(lang, FULL, 'light', MINE, { cmp: true });
    const s = await page.evaluate(SNAP);
    /* ★「準備中」の押せないボタンは置かない（2026-08-31・オーナー確定）。出来た先へリンクを
         足すのはそのときで、それまでは在る道1本だけを出す。⚠️ 0 に固定してある。 */
    ok(s.moreShown === true && s.moreLinks === 1 && s.moreHrefs[0] === 'deep-pay-compare.html'
       && s.moreBtns.length === 0 && s.cmpLinks === 1,
       `${lang}: ★（出す日の姿）「もっと深く見る」は 会社比較へのリンク1本だけ（準備中は置かない）`,
       JSON.stringify(s.moreHrefs) + ' / ' + JSON.stringify(s.moreBtns) + ' / 文書ぜんたい ' + s.cmpLinks);
    for (const vw of [390, 1440]) {
      await page.setViewport({ width: vw, height: 1000 });
      await page.waitForFunction((x) => innerWidth === x, { timeout: 10000 }, vw);
      await navStill(page);
      const f = (await page.evaluate(ROW_FIT)) || { row: [], vari: [], more: [] };
      /* ★相対のまま。'/deep-pay-compare.html' に直すと /en/ から日本語版へ飛ぶ。 */
      ok(f.href === 'deep-pay-compare.html' && f.to === (lang === 'en' ? '/en/' : '/') + 'deep-pay-compare.html',
         `${lang}/${vw}: ★（出す日の姿）会社比較の行き先は相対のまま（/en/ からは /en/ に解ける）`, `${f.href} → ${f.to}`);
      ok(f.over <= 0 && f.cut === 0 && f.btns === 0,
         `${lang}/${vw}: （出す日の姿）横スクロールが生えない・字が切れない`, `+${f.over}px / 切れた ${f.cut}`);
      if (vw === 1440)
        ok(Math.abs(f.more[2] - 256) <= 0.6 && Math.abs(f.more[1] - f.row[1]) <= 0.6 && f.more[3] === 0
           && f.vari[1] < f.more[0] && Math.abs(f.vari[0] - f.row[0]) <= 0.6,
           `${lang}/1440: ★（出す日の姿）右に 256px の列で並ぶ・頭がそろう（前と同じ寸法）`,
           `段 ${f.row.join('..')} / 左 ${f.vari.join('..')} / 右 ${f.more.join('..')}`);
      else
        ok(Math.abs(f.more[0] - f.row[0]) <= 0.6 && Math.abs(f.more[1] - f.row[1]) <= 0.6 && f.more[3] > 0,
           `${lang}/390: （出す日の姿）狭い画面では下に積む（幅いっぱい）`,
           `段 ${f.row.join('..')} / 右 ${f.more.join('..')}`);
    }
    ok(errs.length === 0, `${lang}: JS のエラーが出ない（出す日の姿）`, errs.join(' / '));
    await jars.pop().close().catch(() => {});
  }
}

// ── 3b. variable が人数の壁に届かないと「変動給比率」の行ごと消える ──
/* ★0% と書けば「変動給の無い会社」に見えるが、実際は「人数の壁に届かず出せない」だけ。
   ここが緑のままだと、比較ページで同じ嘘が左右2つ並ぶ。 */
{
  const { page } = await open('ja', NOVAR, 'light', MINE);
  const s = await page.evaluate(SNAP);
  ok(s.kpi === 3, 'カードの枚数は変わらない（消えるのは中の1行）', `今 ${s.kpi} 枚`);
  ok(!s.kpiN.some((t) => /変動給/.test(t)),
     '★variable が無い区分では「変動給比率」を書かない（0% とも 38% とも書かない）',
     JSON.stringify(s.kpiN));
  ok(!/38\s*%/.test(s.text.replace(/\n/g, ' ')),
     '★「100 − 固定給」の値が本文のどこにも出ない');
}

// ── 4. 読めなかった列は行ごと消える（0 を並べない）──────────────
{
  const { page } = await open('ja', HOLES, 'light', MINE);
  const s = await page.evaluate(SNAP);
  ok(s.work.rows === 3, '★人数の壁に届かなかった列は行ごと消える（4→3行）', `今 ${s.work.rows} 行`);
  ok(!/(^|[^\d.])0([^\d.%]|$)/.test(s.work.text.replace(/\n/g, ' ')),
     '★消えた列の代わりに 0 を置いていない', s.work.text.replace(/\n/g, ' ').slice(0, 80));
  ok(s.vari.rows === 2, '変動給は渡した2区分だけ', `今 ${s.vari.rows} 行`);
  ok(!/夜間|週末|祝/.test(s.vari.text), '★渡していない区分が勝手に生えない');
}

// ── 5. 数字が1つも読めないときは、カードごと出ない ──────────────
{
  const { page } = await open('ja', NOHEAD, 'light', MINE);
  const s = await page.evaluate(SNAP);
  ok(s.kpi === 0, '★読める数字が無いと KPI は1枚も出ない', `今 ${s.kpi} 枚`);
  ok(s.empty >= 1, 'その代わり「まだ出せません」を1つ出す', `今 ${s.empty} 個`);
  ok(!/[¥$€£]|万/.test(s.text), '★埋めるための 0 や仮の金額を置かない');
  ok(s.vari.hidden && s.work.hidden, '中身の無い節（変動給・働き方）は出ない');
  /* ★給与構成だけは節が残る。灰色だけの円を描くのではなく「出す」入口に置き換わる
     （Give → Get）。ここも hidden にすると、初日に一番効く誘いが画面から消える。 */
  ok(!s.comp.hidden && s.donut === 0 && s.compCta === 1,
     '★給与構成は空の円を描かず「出す」入口に置き換わる',
     `hidden=${s.comp.hidden} 円=${s.donut} 入口=${s.compCta}`);
  /* ★数字が読めない区分の「まだ出せません」は、開いた画面の中の話。影絵は出さない。 */
  ok(noGhost(s), '★読める数字が無い区分でも影絵は出さない（開いた画面）', ghostWhy(s));
}

// ── 6. 通貨を切り替えても引き直さない ───────────────────────────
{
  const { page } = await open('ja', FULL, 'light', MINE);
  const before = await page.evaluate(SNAP);
  await page.evaluate(() => window.PVCurrency.set('USD'));
  await page.waitForFunction(
    () => /^\$/.test((document.querySelector('#dp-comp .pt-leg:not(.dp-th) .amt') || {}).textContent || ''),
    { timeout: 10000 });
  const after = await page.evaluate(SNAP);
  ok(before.legend[0] !== after.legend[0],
     '通貨を切り替えると凡例の金額が変わる', `${before.legend[0]} → ${after.legend[0]}`);
  ok(before.kpiV[0] !== after.kpiV[0],
     '通貨を切り替えると KPI の数字も変わる', `${before.kpiV[0]} → ${after.kpiV[0]}`);
  ok(after.rpc.pv_deep_pay === 2,
     '★★通貨を切り替えても pv_deep_pay() を引き直さない（入口1＋選択1 のまま）',
     JSON.stringify(after.rpc));
  /* 切り替えた先で数字が枠から切れていないこと（英語ページの JPY が11文字になる）。 */
  const clipped = await page.evaluate(() => Array.prototype.slice
    .call(document.querySelectorAll('.dp-kpi-v, #dp-comp .amt'))
    .filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
  ok(clipped.length === 0, '★数字が枠から切れていない（… で途中まで出ない）', clipped.join(' '));
}

// ── 7. 日英・明暗 ───────────────────────────────────────────────
for (const lang of ['ja', 'en']) {
  for (const theme of ['light', 'dark']) {
    const { page, errs } = await open(lang, FULL, theme, MINE);
    const s = await page.evaluate(SNAP);
    ok(!/undefined|NaN|\[object|null/.test(s.text),
       `${lang}/${theme}: 本文に undefined / NaN / null が出ない`,
       (s.text.match(/[^\n]*(undefined|NaN|\[object|null)[^\n]*/) || [''])[0].slice(0, 60));
    const h = saysHourly(s.text);
    ok(h.ja === 0 && h.en.length === 0,
       `${lang}/${theme}: ★画面で「時給」と呼んでいない`, h.en.join(' / '));
    ok(/Pay \/ Block Hour/.test(s.text), `${lang}/${theme}: Pay / Block Hour が出ている`);
    ok(!/上位|percentile/i.test(s.text), `${lang}/${theme}: ★順位を書いていない`);
    ok(s.kpi === 3, `${lang}/${theme}: KPI は3枚`, `今 ${s.kpi} 枚`);
    /* ★会社比較は閉じている（2026-10-12）。日英・明暗のどれでも、入口は1本も出ない。
         （「行き先は相対のまま」は、試験用の口でカードを出して §3h が見る。） */
    ok(s.cmpLinks === 0 && s.moreHrefs.length === 0 && s.moreShown === false
       && !/会社比較|Compare airlines|もっと深く見る|Go deeper/.test(s.text),
       `${lang}/${theme}: ★★会社比較へのリンクが無い・カードが出ていない（字も本文に無い）`,
       `リンク ${s.cmpLinks} 本 / ${JSON.stringify(s.moreHrefs)}`);
    ok(errs.length === 0, `${lang}/${theme}: JS のエラーが出ない`, errs.join(' / '));
  }
}

// ── 8. サーバが返らなかったとき ─────────────────────────────────
{
  const { page } = await open('ja', { __err: true });
  const s = await page.evaluate(SNAP);
  ok(s.kpi === 0 && s.empty >= 1, 'サーバが返らないと「読み込めませんでした」だけを出す',
     `カード ${s.kpi} / 板 ${s.empty}`);
  ok(!/[¥$€£]|万/.test(s.text), '★エラーのときに 0 や仮の金額を置かない');
  /* ★読み込めなかった画面は「閉じている」ではない。影絵を出すと、鍵が無いように読める。 */
  ok(noGhost(s) && !s.lock.on, '★読み込めなかった画面に影絵も錠前の板も出さない', ghostWhy(s));
}

// ── 9. 見たい区分を選ぶ（2026-08-30）──────────────────────────
/* ★ここが「自分の区分しか見られないなら意味がない」への答えと、
   そのあとのオーナー判断「自動で自分の区分を出す機能自体を消す」の両方の見張り。
   見るのは4つ ── 選ぶまで何も出ない／3つとも選べる／選んでも壁は動かない／
   クリアで「選んでください」に戻る。 */
{
  const { page, errs } = await open('ja', PICKABLE);
  await waitPicks(page);
  const a = await page.evaluate(SNAP);
  ok(!a.pick.hidden && a.pick.shown && a.pick.air && a.pick.pos && a.pick.flt,
     '★会社・役職・機材の3つとも選べる');
  /* ★2026-09-01 に約束が入れ替わった。**前は「110社ぜんぶ並ぶ」を見ていた**が、
     オーナー確定「選択できる ＝ 実際に数字が返る」により、並ぶのは
     サーバが返した一覧の分だけになった。ここの作り物は3社（ana/jal/sas）×
     2職位 × 2機材。数え方は「選択肢の数 ＝ 一覧の数 ＋「選択する」1つ」。
     ⚠️ 中身が正しく絞れているか（会社ごとに違う職位・機材）は §11 が見ている。 */
  ok(a.pick.air.n === 4, '会社は一覧にある会社だけ（全社を並べない）',
     `今 ${a.pick.air && a.pick.air.n} 個`);
  ok(a.pick.groups >= 2, '会社は地域ごとにまとまっている（組の作りは残っている）',
     `今 ${a.pick.groups} 組`);
  ok(a.pick.pos.n === 3 && a.pick.flt.n === 3,
     '役職と機材も一覧にある分だけ（＋「選択する」1つ）',
     `役職 ${a.pick.pos.n} / 機材 ${a.pick.flt.n}`);
  ok(!a.pick.reset, '何も選んでいないうちは「選択をクリア」を出さない');
  /* ★3欄は必ず**1段**（オーナー確定 2026-08-31「常に出したまま1段に詰める」）。
     見出し（区分を選ぶ）は同じ日に消した ── 見出しだけで1段ぶん使っていて、
     この画面を1画面に収める約束と両立しなかった。
     ⚠️ 「選択をクリア」は出たり消えたりする。前はそれが grid の1行目を
        まるごと占めていて、消えた瞬間に欄が1つ上へ吸い込まれて並びが崩れた。
        いまは4列目に固定してあるが、**選ぶ前と選んだ後の両方**で見る。
     ★クリアは align-items:flex-end で欄と下端を揃えている。上端ではなく
       **下端**で見る（背の低いボタンなので上端は当然ずれる）。 */
  const lay = (pg) => pg.evaluate(() => {
    const y = [...document.querySelectorAll('#dp-pick .dp-pick-s')]
      .map((e) => Math.round(e.getBoundingClientRect().top));
    const b = [...document.querySelectorAll('#dp-pick .dp-pick-s')]
      .map((e) => Math.round(e.getBoundingClientRect().bottom));
    const r = document.querySelector('#dp-pick .dp-pick-r');
    return { tops: y, rows: [...new Set(y)].length,
             gap: r ? Math.abs(Math.round(r.getBoundingClientRect().bottom)
                               - Math.max(...b)) : null };
  });
  const l0 = await lay(page);
  ok(l0.tops.length === 3 && l0.rows === 1,
     '★3欄は1段のまま（選ぶ前）', JSON.stringify(l0));
  ok(a.args.length === 1 && a.args[0] === null,
     '★入口の1回は引数なし（state と鍵を取りに行くだけ）', JSON.stringify(a.args));
  /* ★★ここがこの回のオーナー判断そのもの。前は3つとも空だと db/deep-pay.sql の
     はしごが降りて「副操縦士・全社 12人」のような**別の区分**の数字が出ていた。
     読み手はそれを自分の会社の数字だと読み違える。選ぶまで出さなければ起きない。
     ⚠️ ここを緩めて「最初から出す」に戻すと、その誤読が黙って復活する。 */
  ok(a.kpi === 0, '★★選ぶまで KPI は1枚も出ない', `今 ${a.kpi} 枚`);
  ok(a.cond === '', '★★選ぶまで条件バー（表示中:）を出さない', a.cond);
  ok(!/[¥$€£]|万|%/.test(a.text), '★★選ぶまで金額も割合も1文字も出ない',
     (a.text.match(/[^\n]*[¥$€£万%][^\n]*/) || [''])[0].slice(0, 60));
  ok(a.comp.hidden && a.work.hidden && a.vari.hidden && a.more.hidden,
     '★選ぶまで節も出ない（空の器を残さない）');
  ok(!NOCOUNT.test(a.text), '★選ぶ前の画面にも人数を書かない', countIn(a.text));
  ok(noGhost(a), '★選ぶ前の画面（開いている）に影絵が無い', ghostWhy(a));

  await choose(page, { airline: 'jal', position: 'cap', fleet: 'b787' });
  const b = await page.evaluate(SNAP);
  ok(b.args[1] && b.args[1].p && b.args[1].p.airline === 'jal'
     && b.args[1].p.position === 'cap' && b.args[1].p.fleet === 'b787',
     '★選んだ区分をそのままサーバへ渡す', JSON.stringify(b.args[1]));
  ok(/日本航空/.test(b.cond), '★選んだ区分の見出しになる', b.cond.replace(/\n/g, ' '));
  /* ★手で選んだ区分の条件バーにも人数を出さない（2026-10-11）。 */
  ok(!/明細あり/.test(b.cond) && !NOCOUNT.test(b.cond),
     '★選んだ区分の条件バーにも人数を出さない', b.cond.replace(/\n/g, ' '));
  ok(b.kpi === 3, '★選んでから数字が出る', `今 ${b.kpi} 枚`);
  /* 見本の固定・保証給比率は 選んだ区分 71% ／ 素の payload 62%。
     ★71 が出ることが「選んだ区分の答えを描いている」ことの証拠。 */
  ok(/^71/.test(b.kpiV[1] || ''), '★数字は選んだ区分のもの（素の見本の 62% ではない）',
     JSON.stringify(b.kpiV));
  ok(b.pick.reset, '選んだら「選択をクリア」が出る');
  const l1 = await lay(page);
  ok(l1.tops.length === 3 && l1.rows === 1 && l1.gap != null && l1.gap <= 4,
     '★「選択をクリア」が出ても3欄は同じ段のまま（クリアも同じ段）',
     JSON.stringify(l1));
  /* ★信頼度はサーバが返した段のまま。この見本は mid で返す（入口の見本は high）。
     ここで「高」が出たら、画面が段を自分で作り直している（＝3つとも選んだから高い、
     と人数を見ずに決めている）。式は db/deep-pay.sql の trust にしか無い。 */
  ok(b.trust.length === 1 && b.trust[0] === '信頼度 中' && !/高/.test(b.cond),
     '★信頼度はサーバの段のまま（mid →「信頼度 中」。画面で作り直さない）',
     b.cond.replace(/\n/g, ' '));

  /* ★選んだあとに通貨を切り替えても、選び直しにはならない。 */
  await page.evaluate(() => window.PVCurrency.set('USD'));
  await page.waitForFunction(
    () => /^\$/.test((document.querySelector('.dp-kpi-v') || {}).textContent || ''),
    { timeout: 10000 });
  const f = await page.evaluate(SNAP);
  ok(f.rpc.pv_deep_pay === 2,
     '★★通貨を切り替えても引き直さない（入口1＋選択1 のまま）', JSON.stringify(f.rpc));
  ok(f.pick.air.v === 'jal' && f.pick.reset, '通貨を切り替えても選択が飛ばない');

  await choose(page, { airline: 'sas', position: '', fleet: '' });
  const c = await page.evaluate(SNAP);
  ok(c.kpi === 0, '★人数の壁に届かない区分では KPI が1枚も出ない', `今 ${c.kpi} 枚`);
  ok(c.comp.hidden && c.work.hidden && c.vari.hidden && c.more.hidden,
     '★節も全部消える（空の器を残さない）');
  ok(!/[¥$€£]|万|%/.test(c.text),
     '★★広い区分の数字で埋めない（金額も割合も1つも出ない）',
     (c.text.match(/[^\n]*[¥$€£万%][^\n]*/) || [''])[0].slice(0, 60));
  ok(c.cond === '', '★出せない区分では「表示中:」の行ごと出さない', c.cond);
  /* ★薄い区分の板。壁が何人かも「あと1人」も書かない（2026-10-11 に壁の人数も外した。
     前は「3人そろった区分から順に出ます。」）。 */
  ok(c.text.includes('データがそろった区分から順に出ます。')
     && !NOCOUNT.test(c.text) && !/あと/.test(c.text),
     '★★薄い区分の板に人数を1つも書かない（壁の人数も「あと1人」も）',
     c.text.replace(/\n/g, ' ').slice(0, 80));
  ok(c.trust.length === 0, '★数字を出していない区分に信頼度の札を付けない',
     JSON.stringify(c.trust));
  /* ★薄い区分の板は、錠前の板と同じ器（.dp-msg--lock）を使うが、**閉じてはいない**。
       影絵は出さない ── 出すと「鍵が無いから見えない」と読める（足りないのは人数）。 */
  ok(noGhost(c) && c.lock.on, '★★薄い区分の板の後ろには影絵を置かない（開いた画面の中の話）',
     ghostWhy(c));

  await page.evaluate(() => document.getElementById('dp-pk-rst').click());
  /* ★クリアは引き直さない（捨てるだけの答えを取りに行かない）。だから
     __rpcArgs.length が増えるのを待つと、ここで10秒待って嘘の赤になる。
     待つのはボタンが消えること。 */
  await page.waitForFunction(() => !document.getElementById('dp-pk-rst'), { timeout: 10000 });
  const e = await page.evaluate(SNAP);
  ok(e.rpc.pv_deep_pay === 3, '★「選択をクリア」は引き直さない', JSON.stringify(e.rpc));
  ok(e.kpi === 0 && e.cond === '',
     '★★クリアすると「選んでください」に戻る（前の区分の数字も見出しも残さない）',
     `${e.kpi} 枚 / ${e.cond}`);
  ok(e.pick.air.v === '' && e.pick.pos.v === '' && e.pick.flt.v === '',
     '★クリアしたら欄も空に戻る');
  ok(errs.length === 0, '選ぶ操作で JS のエラーが出ない', errs.join(' / '));
}

// ── 10. 1画面に収まる（オーナー確定 2026-08-31）─────────────────
/* 「各画像いいかんじだから、画面にできればおさまるといいかな。いま収まってないから」
   ── 基準は**オーナーの画面（約 1512×980）**。窓を 1512×1000 にして、
   #dp-root の中で**いちばん下まで伸びている物**を測る。

   ⚠️ ここの数字は shot-deep.mjs の measure と**一致しない**。
      この検査は外の網を1本も引かない＝ Inter が落ちてこないので、
      文字は代替フォントで組まれ、行の高さが数px ずれる。
      **正確な実測は `node shot-deep.mjs full ja light 1512 measure`。**
      ここが守っているのは「段が1つ増えた」級の後戻り（数十〜百px）。

   ⚠️ しきい値を上げて通さない。上げた瞬間にこの回の作業が黙って巻き戻る。
      実測（2026-09-01・選択肢を絞った回）── ja 903 / en 905（本物のフォント）／
      **ja 905 / en 931（ここ・代替フォント）**。en は 940 まで残り約9px しか無い。
      ★この回、選択欄の下に断り1行（.dp-pick-n）を足した。あの1行は**段が1つ増える**
        ので、置いただけで 27px 伸びる。増えたぶんは**この画面の中でだけ**刻みを
        詰めて相殺した（器の上下 16→14 / 段の間 14→12 / 見出しの下 12→10 /
        選択欄の器 9→8・段の間 10→8 / 条件バーの段の間 12→5 / 注記の上 9→7・6→5）。
        my-value.css 側（マイページ全体の刻み）は1つも触っていない。
      ★実測（2026-10-11・条件バーから人数を外した回）── ja 888 / en 884.6（本物のフォント）／
        **ja 904.8 / en 907.4（ここ・代替フォント）**。en は 940 まで約33px に広がった。
        条件バーの「◯ pilots / payslip-backed ◯ pilots」が無くなり、en の条件バーが
        **1段に収まるようになった**ため（前は2段で正しかった ── 中身が 998px 要るのに
        幅が 836px しか無かった。`measure` の「条件バー」の行で見える）。
        ⚠️ 空いたぶんを当てにして条件バーへ語を足すと、また2段へ落ちて約27px 伸びる。
      ⚠️ 注記や補足に**1文字足すとここが落ちる**。落ちたら文言を削るか、
        `node shot-deep.mjs full en light 1512 measure` で**どの行が折れたか**を見る
        （折れた1行 ＝ 約17px。カードの補足が折れると段ごと 15px 伸びる）。
      ★落ちたときは #dp-root の直下が「どこで何px使っているか」も一緒に出る。 */
for (const lang of ['ja', 'en']) {
  const { page } = await open(lang, FULL, 'light', MINE);
  await page.setViewport({ width: 1512, height: 1000 });
  /* ★時間で待たない。幅が本当に 1512 になってから測る。 */
  await page.waitForFunction(() => innerWidth === 1512, { timeout: 10000 });
  const m = await page.evaluate(() => {
    let bottom = 0;
    const root = document.getElementById('dp-root');
    (function walk(n) {
      for (const c of n.children) {
        const r = c.getBoundingClientRect();
        if (r.height > 0) bottom = Math.max(bottom, r.bottom + scrollY);
        walk(c);
      }
    })(root);
    const rows = [...root.children].map((c) => {
      const r = c.getBoundingClientRect();
      return `${c.id || c.className} y${Math.round(r.top + scrollY)} h${Math.round(r.height)}`;
    });
    /* <select> は溢れても省略記号を出さない＝**切れたことが画面から分からない**。
       描画に使っている実際のフォントで一番長い選択肢を測り、内寸と比べる。 */
    const cv = document.createElement('canvas').getContext('2d');
    const cut = [];
    for (const el of document.querySelectorAll('#dp-pick select')) {
      const st = getComputedStyle(el);
      cv.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
      const wide = [...el.options]
        .reduce((a, o) => Math.max(a, cv.measureText(o.textContent.trim()).width), 0);
      /* 右の矢印ぶん（padding-right）は既に inner から引かれている。 */
      const inner = el.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
      cut.push({ id: el.id, slack: Math.round((inner - wide) * 10) / 10 });
    }
    return { bottom: Math.round(bottom * 10) / 10, cut, rows };
  });
  /* ★落ちたときだけ、上から順に「どこが何px使っているか」を出す。
     底の数字だけでは、段が増えたのか1行折れたのかが分からない。 */
  ok(m.bottom <= 940, `★1画面に収まる（${lang} / 1512×1000）`,
     `底 ${m.bottom}\n     ` + m.rows.join('\n     '));
  ok(m.cut.every((c) => c.slack >= 0),
     `★<select> の選択肢が切れていない（${lang} / 1512）`,
     m.cut.map((c) => `${c.id} ${c.slack}`).join(' / '));
}

// ── 11. 選べる ＝ 必ず数字が返る（2026-09-01）─────────────────
/* 会社110社 × 職位3つ × 機材19機種を全部並べると、ほとんどの組み合わせが空振りする。
   ★サーバが「数字が返る組み合わせ」を全部返し、**画面はそれを引くだけ**。
     人数の壁は SQL の1か所にしかない（画面は人数を数えないし、閾値も持たない）。
   ⚠️ 見るのは6つ。**最後の2つが命綱**（db/*.sql は push では本番に入らない。
      貼る前に push すると選択欄が空になる ── それが**正しい**ことを見張る）。 */
{
  const { page, errs } = await open('ja', HASPICKS);
  await waitPicks(page);
  const a = await page.evaluate(SNAP);

  // (a) 会社は一覧にある2社だけ。110社は並ばない
  ok((a.pick.airV || []).join(',') === 'ana,jal',
     '★★会社は数字が返る会社だけ（110社を並べない）',
     `今 ${(a.pick.airV || []).join(',')}`);
  ok(!a.pick.grp.includes('数字が出る会社') && !a.pick.grp.includes('まだ人数が足りない会社'),
     '★2つの組に分ける作りは残っていない（地域ごとのまま）', a.pick.grp.join(' / '));

  // (b) 断り1行 ── 数字が1文字も入らない（招待の画面と同じ約束）
  ok(/データが十分にある条件のみ/.test(a.pick.note),
     '★「データが十分にある条件のみ表示しています」の1行が出る', a.pick.note);
  ok(!/[0-9０-９]/.test(a.pick.note),
     '★★断り書きに数字が1文字も入らない（人数が読めてしまう）', a.pick.note);

  // (c) 職位は選んだ会社で数字が返るものだけ／機材は 会社×職位 で返るものだけ
  await choose(page, { airline: 'jal', position: '', fleet: '' });
  const c = await page.evaluate(SNAP);
  ok((c.pick.posV || []).join(',') === 'cap',
     '★職位は選んだ会社で数字が返るものだけ', `今 ${(c.pick.posV || []).join(',')}`);
  ok((c.pick.fltV || []).join(',') === 'b787',
     '★機材は 会社 × 職位 で数字が返るものだけ', `今 ${(c.pick.fltV || []).join(',')}`);

  /* ★会社を先に変えてから職位を選ぶ（2段に分ける）。JAL のときは職位の欄に
     「副操縦士」が**そもそも無い**ので、1回で ana+fo を入れようとすると
     生えてこない選択肢を待ち続けて固まる。人が触る順そのまま。 */
  await choose(page, { airline: 'ana', position: '', fleet: '' });
  await choose(page, { airline: 'ana', position: 'fo', fleet: '' });
  const c2 = await page.evaluate(SNAP);
  ok((c2.pick.fltV || []).join(',') === 'a320',
     '★★同じ会社でも職位を変えると機材が入れ替わる（会社だけで数えたら出ない形）',
     `今 ${(c2.pick.fltV || []).join(',')}`);

  // (d) 会社を変えると、その会社に無い職位・機材が黙って落ちる
  await choose(page, { airline: 'ana', position: 'fo', fleet: 'a320' });
  const n0 = await page.evaluate(() => window.__rpcArgs.length);
  await page.evaluate(() => {
    const e = document.getElementById('dp-pk-air');
    e.value = 'jal'; e.dispatchEvent(new Event('change', { bubbles: true }));
  });
  /* ★時間で待たない。引いた回数が増えて、欄が触れる状態に戻るまで待つ。 */
  await page.waitForFunction((m) => window.__rpcArgs.length > m
    && !document.getElementById('dp-pk-air').disabled, { timeout: 15000 }, n0);
  const d = await page.evaluate(SNAP);
  ok(d.pick.pos.v === '' && d.pick.flt.v === '',
     '★★会社を変えると、その会社に無い職位・機材が落ちる',
     `職位 "${d.pick.pos.v}" / 機材 "${d.pick.flt.v}"`);
  {
    const last = (d.args[d.args.length - 1] || {}).p || {};
    ok(last.airline === 'jal' && !last.position && !last.fleet,
       '★★落とした後の値でサーバを引く（画面の見た目とサーバへの問い合わせがずれない）',
       JSON.stringify(last));
  }

  // (e) 選択肢どおりに選んでも空が返ることはある。そのとき広い区分で埋めない
  await choose(page, { airline: 'jal', position: '', fleet: '' });
  const e2 = await page.evaluate(SNAP);
  ok(e2.text.includes('データがそろった区分から順に出ます。') && !/\$|¥|万円/.test(e2.text),
     '★★空が返ったら金額を1文字も出さない（広い区分の数字で埋めない）',
     e2.text.replace(/\n/g, ' ').slice(0, 90));
  ok(!NOCOUNT.test(e2.text), '★空が返った板にも人数を書かない', countIn(e2.text));
  ok(errs.length === 0, '（11）JS のエラーが出ない', errs.join(' / '));

  // (f) ★命綱★ 一覧が届かない・空のときは選択欄ごと出さない
  for (const [nm, pl] of [['一覧が空の', NOPICKS], ['一覧が届かない', NOLIST]]) {
    const { page: p2 } = await open('ja', pl);
    const b = await p2.evaluate(SNAP);
    ok(!b.pick.air && !b.pick.pos && !b.pick.flt,
       `★★${nm}ときは選択欄を出さない（110社を並べる逃げ道は置かない）`,
       JSON.stringify({ air: !!b.pick.air, pos: !!b.pick.pos, flt: !!b.pick.flt }));
    ok(/選べる条件がまだありません/.test(b.pick.note),
       `★${nm}ときは理由を1行出す`, b.pick.note);
    /* ★同じ画面で「まだありません」と「選んでください」を並べない（2026-09-01）。
         欄が消えている＝押せるものが画面に無いので、「選んでください」は
         読み手に「自分の操作が悪い」と読ませる。絵で見つけた。 */
    ok(/給与が集まるとここに出ます/.test(b.text) && !/選んでください/.test(b.text),
       `★★${nm}ときは「選んでください」と書かない（押せるものが無い）`,
       b.text.replace(/\n/g, ' ').slice(0, 80));
    ok(noGhost(b), `★${nm}ときの画面に影絵が無い（開いている）`, ghostWhy(b));
    /* ★何人そろえば出るかを書かない（2026-10-11。前は「3人以上そろった区分ができると…」）。 */
    ok(b.text.includes('データが十分にそろった区分ができると、会社・役職・機材で選べるようになります。')
       && !NOCOUNT.test(b.text),
       `★${nm}ときの案内にも人数を書かない`, countIn(b.text) || b.text.replace(/\n/g, ' ').slice(0, 80));
  }

  // (g) 英語も同じ（文言は言語ごとに別物なので両方見る）
  {
    const { page: p3 } = await open('en', NOLIST);
    const b = await p3.evaluate(SNAP);
    ok(/No groups can be shown yet/.test(b.pick.note) &&
       /Numbers appear as pay reports come in/.test(b.text) &&
       !/Choose a group to see/.test(b.text),
       '★★一覧が届かないときの英語も「選んでください」と書かない',
       b.text.replace(/\n/g, ' ').slice(0, 80));
    ok(b.text.includes('Once a group has enough data, you can pick an airline, seat or fleet.')
       && !NOCOUNT.test(b.text),
       '★英語の案内にも人数を書かない（◯ pilots）', countIn(b.text) || b.text.replace(/\n/g, ' ').slice(0, 80));
  }

  // (h) 英語の薄い区分の板にも人数を書かない（文言は言語ごとに別物）
  {
    const { page: p4 } = await open('en', HASPICKS);
    await waitPicks(p4);
    await choose(p4, { airline: 'jal', position: '', fleet: '' });
    const b = await p4.evaluate(SNAP);
    ok(b.kpi === 0 && b.text.includes('Groups appear once enough pilots have reported.')
       && !NOCOUNT.test(b.text),
       '★★英語の薄い区分の板にも人数を書かない（前は「once 3 pilots have reported」）',
       countIn(b.text) || b.text.replace(/\n/g, ' ').slice(0, 80));
  }
}

// ── 12. 給与構成の節の断りにも人数を書かない（2026-10-11）──────────
/* 壁に届かない項目は「その他・未分類」に畳まれ、その断りが1行出る。内訳が
   そろわない区分では、節ごと「出す」入口に置き換わる。どちらの文にも、前は
   「3人」が入っていた。 */
{
  const FOLD = Object.assign(clone(FULL), {
    comp: { total_kind: 'monthly_cash',
      segs: [{ k: 'base', pct: 58, med_usd: 2900 }, { k: 'variable', pct: 26, med_usd: 1300 },
             { k: 'perdiem', pct: 7, med_usd: 350 }, { k: 'rest', pct: 9, med_usd: null }],
      bonus: null } });
  for (const [lang, rest, none] of [
    ['ja', '※「その他・未分類」には、データが足りず個別に出せなかった項目を含みます。',
           '内訳まで書いた明細が集まると、ここに構成が出ます。'],
    ['en', '“Other / unclassified” includes items held back because there was not enough data to show them separately.',
           'It appears once enough pilots have reported a full breakdown.']]) {
    const { page } = await open(lang, FOLD, 'light', MINE);
    const f = await page.evaluate(SNAP);
    ok(f.donut === 1 && f.comp.text.includes(rest) && !NOCOUNT.test(f.text),
       `${lang}: ★「その他・未分類」の断りに人数を書かない`,
       countIn(f.text) || f.comp.text.replace(/\n/g, ' ').slice(-90));
    const { page: p2 } = await open(lang, NOHEAD, 'light', MINE);
    const n = await p2.evaluate(SNAP);
    ok(n.compCta === 1 && n.comp.text.includes(none) && !NOCOUNT.test(n.text),
       `${lang}: ★給与構成がまだ出せないときの案内に人数を書かない`,
       countIn(n.text) || n.comp.text.replace(/\n/g, ' ').slice(0, 90));
  }
}

for (const j of jars) await j.close().catch(() => {});
await browser.close();

console.log(`\n${fail ? '❌' : '✅'} pass ${pass} / fail ${fail}`);
process.exit(fail ? 1 : 0);
