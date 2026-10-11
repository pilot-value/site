/* assert-deep-pay-compare.mjs — 会社比較（deep-pay-compare.html / .js / .css）の約束。

   ★★2026-10-12（オーナー判断「会社比較はまだ出さないでよ」）── 会社比較は**閉じている**。
     入口を外すだけでなく、日英の住所を直に開いても比較は1つも出さない。出るのは
     「会社比較は準備中です」の板1枚（題とリンクの2つの字だけ）で、誰が来ても同じ・
     サーバに1本も聞かない・端末に何も書かない。決めているのは deep-pay-compare.js の
     いちばん上の定数 COMPARE_OPEN（false）。DEEP PAY の側の入口（「会社比較を見る」の
     カード）は deep-pay.js の同じ名前の定数で消してあり、あちらは assert-deep-pay.mjs が見る。

     この検査は2つの姿を見る ──
       ・**配っているファイルのまま**（いま本番で出る姿）… ⓪（字面）と §0（実物）。
         ここが、この回に足した見張り。
       ・**出した日に動く本体** … ① から下ぜんぶ（前からの約束。1つも緩めていない）。
         本体は閉じているあいだも腐らせない ── 手元の確認用サーバでだけ効く試験用の口で
         動かして、今までどおり全部を通す。
     ★試験用の口 ── ページのどの script よりも先に `window.__PV_COMPARE_OPEN = true` を置く
       （下の open()。渡さなければ必ず置く ＝ ① から下は1行も変えずに動く）。読むのは
       deep-pay-compare.js / deep-pay.js の compareOpen() だけで、**location.hostname が
       localhost か 127.0.0.1 のときにしか効かない**。本番の住所（pilot-value.com）では、
       印を置いても閉じたまま ── ⓪ が関数を取り出して住所の表で確かめ、§0 が、手元でない
       住所から同じページを開いて実物でも確かめる。住所の後ろの字・保存領域では開かない。
     ⚠️ 出す日にやること ── 2つの JS の COMPARE_OPEN を true に／⓪ と §0 を「開いている」に
        書き換える（「定数が false」「板の字」「聞かない」は、その日から嘘になる）／
        assert-deep-pay.mjs の ① の辺の集合と §3 の入口／roadmap-config.js を done に／
        open() の印を外す（置いたままでも動くが、要らなくなる）。

   assert-deep-pay.mjs（概要ページ）とは**別ファイル**にしてある。理由は2つ。
   1. この画面の偽サーバは**会社コードごとに違う答えを返す**必要がある。
      1つの payload を返す向こうの FAKE では左右が同じ数字になり、
      「差がつくポイント」も「トレードオフ」も出ない＝素通しで緑になる。
   2. あちらは既に700行を超えている。

   ★2枚にまたがる不変条件（DEEP PAY への入口が**決めた所にだけ在る**こと ── REAL PAY の
     見出しのタブの日英と、行を押すと出る面のボタンの3本。2026-10-11 に公開するまでは
     「対の外から1本も生えていない」だった）は assert-deep-pay.mjs ① に置いてある。
     ここには書かない（2か所で同じことを見張ると、片方だけ緩めたときに気づけない）。
     ★この画面（会社比較）へは、今も対の外から直に繋がない。出した日に入るのは DEEP PAY の
       概要から ── ただし 2026-10-12 から閉じているあいだ、その入口も描かれない
       （＝ いま会社比較へ繋がる線は1本も無い。assert-deep-pay.mjs の ①）。
       タブもこの画面には無い（DEEP PAY の中の1枚）。

   ⚠️ assert-header.mjs の FORM_PAGES にはこの2枚を**足さない**。あちらの偽セッションは
      rpc が null を返すので S.mode='error' → ピッカーが hidden → 欄が0個で
      **素通しで緑になる**。検査が無いより悪い。だから 390px の実測はここで自前にやる。

   ★2026-10-11（オーナー判断）に足した見張り ──
     ・**人数を画面のどこにも出さない**。「◯人 vs ◯人」も会社ごとの人数のピルも
       外し、ピルはサーバが返す信頼度の段になった。本文に「◯人」「◯ pilots」の形の
       字が無いこと（NOCOUNT）と、古いサーバを装って人数を混ぜても画面が1文字も
       変わらないこと（§4b）を見る。例外は錠前の板の100人の行だけ（§2b）。
     ・**錠前の板の行**が理由どおりに出る（§2b。この画面に実際に在った不具合 ──
       100人だけが理由の人に「内訳を出すと開きます」と出ていた）。
     ・**年収と Pay / Block Hour は刻みで出す**（円 1万円・100円／ほか 1,000・1）。
       差は今までどおり画面の2つの字の引き算（§4・§7・§7b・§9b）。
     ・**錠前の板のボタンの行き先**は、足りない物に合わせる（フォームの頭／#ps／
       #pay-detail。§2b）。板の中に入力は置かない ── 入口はこのボタン1本で、
       足りない項目は給与フォームで足してもらう。
     ・**見る資格は「自分に当てはまる項目をぜんぶ答えた人」**（同じ日のオーナー判断。
       前は「内訳が1つでもある」）。板は deep-pay.js と**同じ本体**が組む（④）──
       答えきっていない行・残っている項目の一覧（給与フォームと同じ名前）・断り。
       この画面の器で同じ表が通ること（§2b）と、一覧が幅・明暗で崩れないこと（§2c）を見る。
       名前がフォームの見出しと同じ字であることは assert-deep-pay.mjs の ⑫。
     ・**手当の月額の2桁は、表示通貨の中で寄せる**（ドルで $629 のような端数を
       出さない。§9c）。
     ・**狭い画面でも機材と信頼度の札が出る**（表の見出し行を消していたので、
       スマホではどちらもどこにも出ていなかった。§12b）。
     ・**閉じた画面は、ぼかした影絵の手前に板を出す**（同じ日のオーナー判断
       「DEEP PAY でまだ開かない人には給与詳細を提出させる。背景にはぼかした DEEP PAY を
       表示させる。」）。前の約束「ぼかし・filter・mask をこの画面は1つも持たない」は、
       **狭い例外つき**に替わった ── ぼかしてよいのは影絵（.dp-ghost）の要素だけで、
       その規則は deep-pay.css に1つきり。この画面の CSS・JS・HTML には今も1つも無い（①）。
       それで困らないのは、影絵が**字も数字も持たない固定の絵**だから ── CSS のぼかしは
       開発者ツールで外せるので、外されて困るものを最初から入れない。見るのは ──
       字面と組み上がった HTML（①）／閉じた画面の影絵と板（§2・§2b・§2d）／
       開いた・選ぶ前・片側が薄い・会社が足りない・読み込めなかった・読み込み中 の各画面に
       影絵もぼかしも無い（§3・§4・§5・§10・§13・§2d）／閉じた答えに数字が紛れて来ても
       1文字も描かない（§2d の毒入り）。板の字と行き先は1つも変えていない。
     ・**開いた瞬間のクラッカー**（同じ日のオーナー指示「クラッカーならしてね」）。閉じた板を
       見ていた会員が給与の詳細を出して、この画面が開いたら、紙吹雪を**1回だけ**飛ばす。
       本体は deep-pay.js と**同じ9つの関数**（④）で、印（端末の保存領域の鍵1つ）も
       2つの画面で同じ1つ ── 先に開いたほうで鳴り、もう片方では鳴らない。
       ★印は**飾り**で、門ではない（板・門の側は読まない。クラッカーの側は門の鍵へ書かない）。
       ★① の約束はそのまま ── ぼかし・filter を足していない・乱数を使わない・字も数字も
         描かない・音も出さない。
       見るのは ── 字面（④-b）／実物（§2e ── assert-deep-pay.mjs の §2f と同じ筋書きを、
       この画面の器と試験用の入口で通す）。印の名前を知っている JS が2つだけであることは
       assert-deep-pay.mjs の ⑬（2枚にまたがる見張りは向こうに1つだけ置く）。
     ・**ログインしていない人を、ログイン画面へ送らない**（同じ日のオーナー判断）。来た人には
       「会員で、まだ開いていない人」と**同じ画面**（ぼかした影絵＋板）を出す。前の §1 は
       「ログインへ送られる・戻り先を取り違えない」を見ていた。
       ★板は新しく書いていない ── deep-pay.js と**同じ本体**の anonGate()（「鍵が無く、
         答えきってもいない」会員の門と同じ形の入れ物）を、同じ lockStage へ通すだけ（④）。
       ★ログインしていない人のために、サーバへ**1本も聞かない**。端末にも何も書かない。
       ★端末にセッションが残っているのにサーバが「ログインしていない」と答えた回
         （42501 か HTTP 401。入口の1回でも、2社を引く回でも）も同じ板。ほかの失敗は
         今までどおり「読み込めませんでした」。
       見るのは ── 字面（④-c）／実物（§2f ── assert-deep-pay.mjs の §2g と同じ筋書き）。
       作り物の門を本物の道具に通した答えと、見分けの表（authLost）は、向こうの ⑭ が
       取り出して見ている ── こちらは「同じ本体」であること（④）で足りる。
     ・**閉じた画面の板は、窓の縦の真ん中あたりに置く**（同じ日のオーナー指示「ポップアップは
       わかりやすいように画面のもう少し真ん中にして」）。それまでは見出しのすぐ下に
       寄せてあり、この検査も「器の上から 40px 以内」を見ていた。いまは、板の真ん中が
       窓の高さの 43〜49% に在ること（狙いは 46%）を、**窓に対して**実測する。
       収まらない板は上の余白のすぐ下から（見出しに潜らない・切れない）。スマホは
       真ん中に置かず、見出しの下から。置き方は deep-pay.css の .dp-stage（2つの画面で
       同じ1つ）。決まりは §2d の「板の縦の置き場所」、窓の高さを変えた実測は placeAt
       （§2d の会員の板と、§2f のログインしていない人の板）。

   ⚠️ ここで使う金額・時間は**全部でたらめ**。本物の給与はこのリポジトリに1件も無い。

   使い方: node assert-deep-pay-compare.mjs   （serve.mjs が要る）
*/
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer';

const ROOT = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const BASE = 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (c, l, e = '') => {
  c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + ' ' + e));
};
/* ★コメントを外してから grep する。禁じた語を「なぜ書かないか」という説明の中で
   使うことがあり、素の grep だと解説を書いた瞬間に赤くなる。 */
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

const JS  = read('deep-pay-compare.js');
const CSS = read('deep-pay-compare.css');
const JA  = read('deep-pay-compare.html');
const EN  = read('en/deep-pay-compare.html');
const jsC = decomment(JS);
const cssC = decomment(CSS);

// ════════════════════════════════════════════════════════════════
// ⓪ 会社比較は、まだ出さない（字面。2026-10-12・オーナー判断）
// ════════════════════════════════════════════════════════════════
/* オーナーの言葉「会社比較はまだ出さないでよ」。入口を外すだけでなく、日英の住所を直に
   開いても比較は出さない。ここは字面。実物は下のブラウザの §0。見るのは5つ：
     a) 定数が false のまま ── 配っているファイルで、会社比較は閉じている。
        ⚠️ 出す日は、この行を true に替える**前に**ここを書き換える（冒頭の「出す日にやること」）。
     b) 閉じている枝が、本体の**どの行よりも前**で終わる ── 'use strict' のすぐ後ろに在るのは
        定数・手元かどうかの見分け・板・「閉じていれば板を出して戻る」の4つだけ。
        その手前に、セッション・サーバ・保存領域・通信に触る字が1つも無い。
     c) 試験用の口（compareOpen）は、**手元の住所でしか効かない**。関数を取り出して、
        住所と印の表で実行する ── 本番の住所・似せた住所では、印が在っても false。
     d) 板は、題とリンクの2つの字だけ ── 関数を取り出して日英で実行し、組み上がった HTML を見る。
     e) 見た目に足したのは幅と間だけ（色・影・ぼかしを書き足していない）。
   ★定数と compareOpen は deep-pay.js にも在る（入口のカードの側）。あちらの定数は
     assert-deep-pay.mjs の ①、本体が同じであることは下の ④「写した関数」。 */
console.log('\n════ ⓪ 閉じている（字面）════');
/* ★オーナー指定の字（2026-10-12）。題とリンクの2つだけ ── ほかの文は足さない。 */
const CLOSED_T = {
  ja: { title: '会社比較は準備中です', go: 'DEEP PAY に戻る' },
  en: { title: 'Company comparison is coming soon', go: 'Back to DEEP PAY' }
};
/* 手元かどうかの見分けの、決まった字（空白を1つに畳んだ形）。1文字でも違えば落ちる ──
   条件を足した・緩めた・別の読み口（住所の後ろの字・保存領域）を足した、のどれも通さない。 */
const OPEN_FN = 'function compareOpen() { if (COMPARE_OPEN) return true; try { '
  + 'return w.__PV_COMPARE_OPEN === true && /^(?:localhost|127\\.0\\.0\\.1)$/.test(w.location.hostname); '
  + '} catch (e) { return false; } }';
const OPEN_GUARD = 'if (!compareOpen()) { w.PV_SESSION = Promise.resolve(null); closedBoard(); return; }';
/* compareOpen() を取り出して、作り物の window で実行する（定数は false のまま）。 */
const runOpen = (src, win) => {
  try { return new Function('w', 'var COMPARE_OPEN = false;\n' + src + '\nreturn compareOpen();')(win); }
  catch (e) { return 'threw: ' + e.message; }
};
const HOSTS_NO = ['pilot-value.com', 'www.pilot-value.com', 'localhost.pilot-value.com',
                  'pilot-value.com.localhost', 'notlocalhost', 'localhost.', 'LOCALHOST.example',
                  '127.0.0.1.nip.io', '127.0.0.10', '0.0.0.0', '[::1]', 'localhost:3000', ''];
{
  const norm = (t) => decomment(t).replace(/\s+/g, ' ').trim();
  const count = (re, s) => (s.match(re) || []).length;

  // ── a) 定数 ──
  ok(/^  var COMPARE_OPEN = false;$/m.test(JS) && count(/\bCOMPARE_OPEN\s*=(?!=)/g, jsC) === 1
     && count(/\bCOMPARE_OPEN\b/g, jsC) === 2,
     '★★deep-pay-compare.js の COMPARE_OPEN は false（配っているファイルで、会社比較は閉じている）。'
     + '代入は1か所・読むのは compareOpen() の1か所',
     `代入 ${count(/\bCOMPARE_OPEN\s*=(?!=)/g, jsC)} / 字 ${count(/\bCOMPARE_OPEN\b/g, jsC)}`);

  // ── b) 閉じている枝は、本体のどの行よりも前で終わる ──
  const i0 = jsC.indexOf("'use strict';"), i1 = jsC.indexOf('var V = w.PVViz;');
  const head = (i0 >= 0 && i1 > i0) ? jsC.slice(i0, i1) : '';
  const boardSrc = cutFn(JS, 'closedBoard');
  ok(head.length > 0 && boardSrc.length > 0
     && norm(head) === ["'use strict';", 'var COMPARE_OPEN = false;', OPEN_FN, norm(boardSrc), OPEN_GUARD].join(' '),
     '★★本体より前に在るのは、定数・見分け・板・「閉じていれば板を出して戻る」の4つだけ（字ごと固定）',
     norm(head).slice(-140));
  ok(!/\.rpc\b|\bfetch\b|[sS]torage|\bsb0?\b|\.auth\b|\bawait\b|\.then\b|cookie|addEventListener|setTimeout|setInterval|PVDeepPayCompare|PVGates|PVClaimPending|PVViz|PVCurrency|\bparty\w*\(|\block\w*\(|\bghost\w*\(|\bboot\(|\bload\(|\brender\(/.test(head),
     '★★その手前に、サーバ・通信・保存領域・セッションを待つ字・試験用の入口・本体の描き手が1つも無い',
     (head.match(/[^\n]*(?:\.rpc\b|\bfetch\b|[sS]torage|\.auth\b|\bawait\b|\.then\b|cookie|addEventListener|PVDeepPayCompare)[^\n]*/) || [''])[0].trim().slice(0, 90));
  ok(count(/\bcompareOpen\(/g, jsC) === 2 && count(/\bclosedBoard\(/g, jsC) === 2
     && count(/\bPV_SESSION\s*=(?!=)/g, jsC) === 1 && count(/__PV_COMPARE_OPEN/g, jsC) === 1,
     '★見分けと板を使うのは、その1か所だけ（本体の側からは呼ばない・印を読むのは見分けの中の1回だけ）',
     `compareOpen ${count(/\bcompareOpen\(/g, jsC)} / closedBoard ${count(/\bclosedBoard\(/g, jsC)} / 印 ${count(/__PV_COMPARE_OPEN/g, jsC)}`);
  ok(jsC.indexOf('w.PVDeepPayCompare =') > i1 && count(/w\.PVDeepPayCompare\s*=/g, jsC) === 1,
     '★試験用の入口（PVDeepPayCompare）は本体の側に在る ＝ 閉じているあいだは生えない');

  // ── c) 試験用の口は、手元の住所でしか効かない ──
  const openSrc = cutFn(JS, 'compareOpen');
  ok(norm(openSrc) === OPEN_FN, '★★compareOpen() が決まった字のまま（条件を足していない・緩めていない）',
     norm(openSrc).slice(0, 160));
  const at = (host, flag) => runOpen(openSrc, { __PV_COMPARE_OPEN: flag, location: { hostname: host } });
  ok(at('localhost', true) === true && at('127.0.0.1', true) === true,
     '★手元の住所（localhost / 127.0.0.1）で印を置けば、本体が動く（この検査と撮影の道具が使う口）',
     `${at('localhost', true)} / ${at('127.0.0.1', true)}`);
  {
    const leak = HOSTS_NO.filter((h) => at(h, true) !== false);
    ok(leak.length === 0,
       `★★本番の住所・似せた住所（${HOSTS_NO.length} 通り）では、印が在っても必ず false`, leak.join(' '));
    const loose = ['true', 1, 'yes', {}, [], null, undefined, 0, false].filter((v) => at('localhost', v) !== false);
    ok(loose.length === 0, '★★手元の住所でも、印が true そのものでなければ false（字の "true" や 1 では開かない）',
       JSON.stringify(loose));
    ok(runOpen(openSrc, { __PV_COMPARE_OPEN: true }) === false && runOpen(openSrc, null) === false
       && runOpen(openSrc, { __PV_COMPARE_OPEN: true, location: null }) === false,
       '★住所が読めない窓では false（投げない・開く側へ倒さない）');
  }
  ok(!/\bsearch\b|\bhash\b|\bhref\b|URLSearchParams|\bcookie\b|[sS]torage|\breferrer\b|\bname\b/.test(norm(openSrc)),
     '★見分けは、住所の後ろの字・保存領域・Cookie・リンク元を読まない（読むのは hostname と印の2つ）');

  // ── d) 板は、題とリンクの2つの字だけ ──
  const runBoard = (lang, has) => {
    const root = { innerHTML: null }, ids = [];
    const doc = { documentElement: { getAttribute: (k) => (k === 'lang' ? lang : null) },
                  getElementById: (id) => { ids.push(id); return (has && id === 'dc-root') ? root : null; } };
    let why = '';
    try { new Function('d', boardSrc + '\nclosedBoard();')(doc); } catch (e) { why = String(e && e.message); }
    return { html: root.innerHTML, ids, why };
  };
  for (const lang of ['ja', 'en']) {
    const r = runBoard(lang, true), H = r.html || '', W = CLOSED_T[lang];
    ok(typeof r.html === 'string' && !r.why && r.ids.join(',') === 'dc-root',
       `${lang}: ★★closedBoard() は、外の値を1つも読まずに組み上がる（触る器は #dc-root の1つだけ）`,
       r.why + ' ' + r.ids.join(','));
    ok(H.replace(/<[^>]*>/g, '') === W.title + W.go,
       `${lang}: ★★板の字は、題とリンクの2つだけ（「${W.title}」「${W.go}」。ほかの文が無い）`,
       JSON.stringify(H.replace(/<[^>]*>/g, '')));
    const tags = [...new Set([...H.matchAll(/<([a-z][\w-]*)/gi)].map((m) => m[1].toLowerCase()))].sort();
    ok(tags.join(' ') === 'a div h1 path svg' && count(/<h1[\s>]/g, H) === 1 && count(/<a[\s>]/g, H) === 1,
       `${lang}: ★板のタグは div / h1 / a と絵（svg・path）だけ（見出しは1つ・リンクは1本）`, tags.join(' '));
    ok(new RegExp('<h1 class="dp-msg-t">' + W.title + '</h1>').test(H)
       && /<a class="dp-more-b dp-more-b--on dc-closed-go" href="deep-pay\.html">/.test(H)
       && /^<div class="dp-msg dc-closed">/.test(H),
       `${lang}: ★★題は <h1>・リンクの行き先は相対の deep-pay.html（/en/ からはその言語へ解ける）`);
    ok(!/\b(?:target|rel|id|style|tabindex|on\w+|data-[\w-]+|src)\s*=/i.test(H)
       && !/dp-cta|dp-stage|dp-ghost|dp-msg--lock|dp-pop|pay-report|login|signup/.test(H),
       `${lang}: ★板に、押したときの仕掛け・別の行き先・橙のボタン・影絵の器が無い`);
  }
  {
    const none = runBoard('ja', false);
    ok(none.html === null && !none.why, '★器が無いページでは何もしない（投げない）', none.why);
  }
  ok(!/\b[SVT]\s*[.\[]|\b(?:IC|COL|CN|SEGK|MET)\b|\besc\(|\bel\(|\bsvg\(|\bw\s*\./.test(decomment(boardSrc)),
     '★closedBoard() は、後ろで代入される表や道具（T / IC / esc / el）に触らない（まだ空のうちに走る）');
  for (const lang of ['ja', 'en']) {
    ok(count(new RegExp(CLOSED_T[lang].title, 'g'), jsC) === 1,
       `${lang}: ★題の字は、板の中の1か所だけ（本体の文言の表には無い）`);
  }

  // ── e) 見た目に足したのは幅と間だけ ──
  const rules = [...cssC.matchAll(/([^{}]*\bdc-closed[\w-]*[^{}]*)\{([^{}]*)\}/g)]
    .map((m) => [m[1].trim(), m[2].trim()]);
  const props = rules.flatMap((r) => r[1].split(';').map((x) => x.split(':')[0].trim()).filter(Boolean));
  ok(rules.length === 2 && props.sort().join(' ') === 'margin-top max-width'
     && /\.dc-closed\{max-width:\d+px\}/.test(cssC),
     '★板のための CSS は2行・書いてあるのは max-width と margin-top だけ（色・影・角丸・動きを書き直していない）',
     JSON.stringify(rules));
}

// ════════════════════════════════════════════════════════════════
// ① 隠さない・作らない
// ════════════════════════════════════════════════════════════════
console.log('\n════ ① 隠さない・作らない ════');
{
  /* 錠前は「ぼかして見せる」ではなく「渡さない」で掛かっている。
     ぼかしは開発者ツールで外せるので、値に掛ければ「掛かっているように見えるだけ」になる。
     ★2026-10-11（オーナー判断）から、閉じた画面の板の後ろに、ぼかした影絵を置く。
       ぼかしてよいのは**字も数字も持たない影絵（.dp-ghost）だけ**で、その規則は
       2つの画面が共有する deep-pay.css に1つきり。だから ──
       ・この画面の CSS（deep-pay-compare.css）・JS・HTML には、今までどおり**1つも無い**
       ・deep-pay.css は「影絵の規則1つを抜いた残りに、1つも無い」
       （同じ見方を assert-deep-pay.mjs の ② がしている。片方だけ緩めない。）
     ⚠️ 例外を「.dp-ghost を含むセレクタなら可」に緩めない。`.dp-ghost .dc-c2` のように
        書けば、値の入る要素へぼかしを付けられてしまう。 */
  const hide = [
    [/blur\s*\(/i, 'blur()'], [/(^|[^-\w])filter\s*:/, 'filter:'],
    [/backdrop-filter/i, 'backdrop-filter'], [/\bmask(-image)?\s*:/i, 'mask:'],
    [/clip-path\s*:/i, 'clip-path:'],
    [/user-select\s*:\s*none/i, 'user-select:none']
  ];
  const sharedC = decomment(read('deep-pay.css'));
  const GHOST_RULE = /(^|\})\s*\.dp-ghost\s*\{([^{}]*)\}/g;
  const ghostRules = [...sharedC.matchAll(GHOST_RULE)].map((m) => m[2]);
  ok(ghostRules.length === 1, '★影絵の規則（.dp-ghost{…}）は deep-pay.css にちょうど1つ',
     `今 ${ghostRules.length} 個`);
  const sharedRest = sharedC.replace(GHOST_RULE, (m, head) => head);   // ★関数形（$ を素通しする）
  for (const [re, name] of hide) {
    ok(!re.test(cssC), `★deep-pay-compare.css に ${name} が無い（影絵の形の規則 .dc-gh-* にも書かない）`);
    ok(!re.test(jsC),  `★deep-pay-compare.js に ${name} が無い`);
    ok(!re.test(nohtmlcomment(JA)) && !re.test(nohtmlcomment(EN)), `★HTML（日英）に ${name} が無い`);
    ok(!re.test(sharedRest),
       `★deep-pay.css の ${name} は、影絵の規則の外に1つも無い（値の入る要素をぼかさない）`);
  }
  ok(/(^|[^-\w])filter\s*:\s*blur\(\s*[\d.]+px\s*\)/.test(ghostRules[0] || '')
     && !/backdrop-filter/i.test(ghostRules[0] || '') && !/\bmask(-image)?\s*:/i.test(ghostRules[0] || ''),
     '★影絵のぼかしは filter:blur() の1つ（backdrop-filter と mask は影絵の規則の中でも使わない）');
  ok(!/\.style\.(?:filter|backdropFilter|webkitFilter|webkitBackdropFilter|clipPath|mask\w*|webkitMask\w*)\b/.test(jsC)
     && !/setProperty\(\s*['"](?:-webkit-)?(?:backdrop-)?filter/.test(jsC)
     && !/\bcssText\b/.test(jsC),
     '★deep-pay-compare.js は style.filter を触らない（setProperty・cssText の道も無い）');

  /* ── 影絵は、字も数字も持たない固定の絵（2026-10-11）──────────────────
     ぼかしは外せる。だから**外されて困るものを影絵に入れない**ことが、この例外の土台。
     見方は assert-deep-pay.mjs の ②-b と同じ（あちらに1つずつ理由が書いてある）──
       形を組む5つ（ghBar / ghBars / ghField / ghHead / ghostShapes）の字面に数字・通貨記号・
       サーバの答えや状態への参照が無い／その5つだけを取り出して実行できる／組み上がった
       HTML に字が1文字も無い／色は COL だけ／lockStage は影絵を引数なしで呼ぶ。
     ★ghostShapes() だけはこの画面のもの（表・棒・トレードオフの形）。残りは写し（④）。
     ⚠️「タグの外に数字が無い」へ緩めない。字面ごと数字を禁じてある。 */
  {
    const SHAPE = ['ghBar', 'ghBars', 'ghField', 'ghHead', 'ghostShapes'];
    const src = {};
    for (const n of SHAPE.concat(['ghostTint', 'lockStage'])) src[n] = cutFn(JS, n);
    ok(Object.keys(src).every((n) => src[n].length > 0), '影絵を組む関数が7つとも切り出せる',
       Object.keys(src).filter((n) => !src[n]).join(' '));
    const REFS = /\b[SVTwd]\s*[.\[]|\b(?:CN|IC|COL|SEGCOL|SEGK|MET|ORDER|HEAD|TRADE)\b|\bel\(|payload|\bstats\b|\bgate\b|\bdata\b|\bboot\b|\bside\b|\bhead\b|\bcomp\b|\bwork\b|\bcohort\b|\bpicks\b|[sS]torage|\bMath\b|\bDate\b|\bfmt\b|\bmoney\w*|\bnum\(|\bexact\(|\bsig\w+\(|\bstepIn\(|PVCurrency|\bfetch\b|\brpc\b|\bsb\d?\b|\bairName\(|\blogoHtml\(/;
    for (const n of SHAPE) {
      const c = decomment(src[n]);
      ok(!/[0-9０-９]/.test(c), `★${n}() の字面に数字が1文字も無い`,
         (c.match(/[^\n]*[0-9０-９][^\n]*/) || [''])[0].trim().slice(0, 80));
      ok(!/[¥$€£]|万/.test(c), `★${n}() の字面に通貨記号が無い`);
      /* ★字（'…'）は落としてから見る（クラス名や 'a b c d' の d を読み違えない）。 */
      const bare = c.replace(/'[^']*'/g, "''");
      ok(!REFS.test(bare), `★${n}() がサーバの答え・状態・保存領域・金額の道具・乱数に触らない`,
         (REFS.exec(bare) || [''])[0]);
      ok(!/"/.test(bare) && !/`/.test(bare),
         `★${n}() の字は全部 '…' で書いてある（上の見張りが字を落とし切れている）`);
    }
    ok(/^  function ghostShapes\(\) \{/.test(src.ghostShapes) && /^  function ghostTint\(\) \{/.test(src.ghostTint),
       '★ghostShapes() と ghostTint() は引数を取らない（渡された値で絵を変えない）');
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
    /* ★検査が「会社のカード・数字・板が出たか」を数えているクラスを、影絵が名乗らない。 */
    ok(!/dc-side|dc-kv|dc-dl|dc-c-a|dc-leg|dc-bar--none|dp-msg|dp-cta|dp-todo|dp-cond/.test(H),
       '★影絵が、会社のカードや数字の部品（.dc-side* / .dc-kv-* …）や板の部品のクラスを名乗らない');
    let again = null;
    try { again = new Function(SHAPE.map((n) => src[n]).join('\n') + '\nreturn ghostShapes();')(); } catch (e) {}
    ok(again === html, '★影絵は何度組んでも同じ字（乱数も時刻も無い）');

    const stageC = decomment(src.lockStage);
    ok(/class="dp-ghost" aria-hidden="true" inert /.test(stageC),
       '★lockStage は影絵に aria-hidden="true" と inert を付ける');
    ok(/ghostShapes\(\)/.test(stageC) && /ghostTint\(\)/.test(stageC)
       && !/ghost\w*\(\s*[^)\s]/.test(stageC),
       '★lockStage は影絵を引数なしで呼ぶ（門も答えも渡さない）');
    ok((stageC.match(/\bgate\b/g) || []).length === 2 && /lockHtml\(gate\)/.test(stageC),
       '★lockStage が gate を渡すのは板（lockHtml）にだけ');
    /* ★2026-10-11、呼び出しが1か所から2か所になった（ログインしていない人の板）。
         どちらも shut() の中で、渡すのは「会員の門」か「作り物の門 anonGate()」だけ ──
         答えの入れ物（S.boot）を丸ごと渡す道や、shut() の外から器を置く道は無いまま。
         （定義の1つ ＋ 呼び出しの2つ ＝ 字としては3つ。assert-deep-pay.mjs の ②-b と同じ見方。） */
    const shutC = decomment(cutFn(JS, 'shut'));
    ok((jsC.match(/\blockStage\(/g) || []).length === 3
       && (shutC.match(/\blockStage\(/g) || []).length === 2
       && /lockBoard\(box, lockStage\(\(S\.boot && S\.boot\.gate\) \|\| \{\}\)\);/.test(shutC)
       && /if \(kind === 'anon'\) \{ lockBoard\(box, lockStage\(anonGate\(\)\)\); return; \}/.test(shutC),
       '★影絵を置く道は shut() の中の2本だけ（会員の門／ログインしていない人の作り物の門）',
       `全体 ${(jsC.match(/\blockStage\(/g) || []).length} / shut の中 ${(shutC.match(/\blockStage\(/g) || []).length}`);
    ok((jsC.match(/dp-ghost/g) || []).length === 1 && (jsC.match(/dp-stage/g) || []).length === 1,
       '★影絵と器のクラス（dp-ghost / dp-stage）を書くのは lockStage の中だけ');
    /* 開いた画面の描き手は、影絵の部品を使わない（本物の値を影絵の形で描かない）。 */
    for (const n of ['cards', 'sideCard', 'diff', 'mix', 'barOf', 'trade', 'cta', 'ask', 'dup', 'few',
                     'cond', 'hdr', 'picker', 'only']) {
      const c = decomment(cutFn(JS, n));
      ok(c.length > 0 && !/\bgh[A-Z]\w*\(|ghost\w*\(|lockStage\(|dp-gh-|dc-gh-|dp-ghost|dp-stage/.test(c),
         `★${n}() は影絵の部品を使わない`);
    }
    /* ★試験用の入口 lock() は、閉じる側にしか倒せない（開く道を増やさない）。 */
    const hook = (jsC.match(/lock:\s*function \(boot\) \{([\s\S]*?)\n\s{4}\}/) || ['', ''])[1];
    ok(/S\.mode = 'locked';/.test(hook) && !/'open'/.test(hook),
       '★試験用の入口 lock() は mode を locked にするだけ（これで何かが開くことは無い）',
       hook.replace(/\s+/g, ' ').slice(0, 80));
  }
  ok(!/opacity\s*:\s*0\s*[;}]/.test(cssC), '★deep-pay-compare.css に opacity:0 が無い');
  ok(!/visibility\s*:\s*hidden/.test(cssC), '★deep-pay-compare.css に visibility:hidden が無い');

  /* 作り物のデータを本番に置かない（オーナー明言）。 */
  const fake = [/\bSAMPLE\b/, /\bDEMO\b/, /\bdummy\b/i, /\bmockData\b/i, /Math\.random/];
  for (const re of fake) {
    ok(!re.test(jsC), `★deep-pay-compare.js に作り物のデータが無い（${re.source}）`);
    ok(!re.test(nohtmlcomment(JA)) && !re.test(nohtmlcomment(EN)),
       `★HTML に作り物のデータが無い（${re.source}）`);
  }
  /* 見本の金額が消し忘れで残っていないか。桁の大きい裸の数字は全部それ。
     ★2026-10-11、5桁の字が1つ入った ── '42501'。金額ではなく Postgres の符丁
       （権限が無い ＝ pv_deep_pay() が未ログインのときに投げる）で、authLost() が
       サーバの答えと突き合わせる。通すのは**その関数の中の1つだけ**（数を数えている）。 */
  const nums = (jsC.match(/\b\d{5,}\b/g) || []).filter((n) => n !== '42501');
  ok(nums.length === 0, '★deep-pay-compare.js に5桁以上の裸の数字が無い（見本の金額の残り）',
     nums.join(' '));
  ok((jsC.match(/\b42501\b/g) || []).length === 1 && /=== '42501'/.test(decomment(cutFn(JS, 'authLost'))),
     '★5桁の字で通してよいのは、authLost() の中の符丁 42501 の1つだけ',
     String((jsC.match(/\b42501\b/g) || []).length));

  /* 公開リポジトリ。ログイン名が入る絶対パスを書かない。 */
  for (const [name, src] of [['js', JS], ['css', CSS], ['ja', JA], ['en', EN]]) {
    ok(!/\/Users\//.test(src), `★${name}: 絶対パス（/Users/）を書いていない`);
  }
}

// ════════════════════════════════════════════════════════════════
// ② 言葉 ── 呼んではいけない名前・付けてはいけない順位
// ════════════════════════════════════════════════════════════════
/* 「時給」は否定する文（…ではありません）でだけ使ってよい。
   ★この関数は assert-deep-pay.mjs と同じ本体。片方だけ緩めない。 */
function saysHourly(src) {
  const ja = (src.match(/時給/g) || []).length -
             (src.match(/時給(?:では(?:なく|ありません|ない))/g) || []).length;
  const en = [...src.matchAll(/hourly\s+(?:rate|wage|pay)/gi)]
    .filter((m) => !/\bnot\b/i.test(src.slice(Math.max(0, m.index - 40), m.index)))
    .map((m) => src.slice(Math.max(0, m.index - 40), m.index + 20).replace(/\s+/g, ' '));
  return { ja, en };
}
console.log('\n════ ② 言葉 ════');
{
  for (const [name, src] of [['js', jsC], ['ja', nohtmlcomment(JA)], ['en', nohtmlcomment(EN)]]) {
    const h = saysHourly(src);
    ok(h.ja === 0, `★${name}: 「時給」と呼んでいない（否定する文だけ許す）`, `${h.ja} 件`);
    ok(h.en.length === 0, `★${name}: hourly rate と呼んでいない`, h.en.join(' | '));
    ok(!/上位/.test(src), `★${name}: 「上位○%」を書いていない`);
    ok(!/パーセンタイル|percentile/i.test(src), `★${name}: パーセンタイルを書いていない`);
    /* ★『No ranking.』『順位は付けません』は**順位を付けないと言っている**文。
       ここを素の grep にすると、約束を書いた画面ほど赤くなる（時給と同じ形）。 */
    const rank = [...src.matchAll(/ランキング|\branking\b/gi)]
      .filter((m) => !/\b(no|not|without)\s$/i.test(src.slice(Math.max(0, m.index - 12), m.index)))
      .map((m) => src.slice(Math.max(0, m.index - 24), m.index + 12).replace(/\s+/g, ' '));
    ok(rank.length === 0, `★${name}: ランキングを書いていない（付けないと断る文だけ許す）`,
       rank.join(' / '));
  }
  ok(!/\b9\d(\.\d+)?%\s*(accurate|正確)/i.test(jsC), '★根拠の無い正確さを書いていない');

  /* ★勝ち負けを付けない（オーナー確定「順位は付けません」）。
     「良い」だけは締めの1行『どちらが良いかではなく』に出るので、その1つを引いて0。 */
  const winJa = [/勝/, /優れ/, /おすすめ/, /お得/, /損/];
  for (const re of winJa) {
    ok(!re.test(jsC), `★勝ち負けの語を書いていない（${re.source}）`);
  }
  const yoi = (jsC.match(/良い/g) || []).length;
  const yoiEnd = (jsC.match(/どちらが良いかではなく/g) || []).length;
  ok(yoi - yoiEnd === 0, '★「良い」は締めの1行にしか出ない', `良い ${yoi} / 締め ${yoiEnd}`);
  const winEn = [...jsC.matchAll(/\b(better|best|winner|worse)\b/gi)]
    .filter((m) => !/It is not about which is/i.test(jsC.slice(Math.max(0, m.index - 40), m.index)))
    .map((m) => m[0]);
  ok(winEn.length === 0, '★英語でも勝ち負けの語を書いていない', winEn.join(' '));
}

// ════════════════════════════════════════════════════════════════
// ③ 数え方・出し方の約束（この画面が壊れるときの形）
// ════════════════════════════════════════════════════════════════
console.log('\n════ ③ 数え方・出し方 ════');
{
  /* ★人数の壁は db/deep-pay.sql の1か所だけ（定数 v_min。2026-10-11 から2人）。
     JS が自分で数え始めると SQL を直しても画面が古い壁のまま動き、しかも見た目は
     正しく見える。前は「\.n < 3 が無い」だけを見ていたが、壁の数字が変わった日に
     素通しになる形だった ── **数字を名指しせず、人数を読む行そのもの**を禁じる。 */
  ok(!/\.n\s*[<>]=?\s*\d/.test(jsC), '★JS が人数を自分で比べていない（.n と数の比較が無い）');
  ok(/level\s*===\s*'none'/.test(jsC), '★薄い区分の合図は cohort.level === \'none\' だけ');
  /* ★人数の鍵を読まない（2026-10-11・オーナー判断「人数は出さない」）。
       サーバは区分の人数を返さなくなったが、**古いサーバは返す**。読む行が1つでも
       残っていると、SQL を貼る前の日だけ人数が画面に戻る。
       実際に出ないことは、ブラウザの §4b が毒入りの答えで見ている。 */
  for (const k of ['verified_n', 'detailed_n']) {
    ok(!new RegExp('\\b' + k + '\\b').test(jsC), `★deep-pay-compare.js が人数の鍵 ${k} を読まない`);
  }
  const reads = jsC.match(/\b(?:cohort|c|comp|bonus|b|h|head|x)\.n\b/g) || [];
  ok(reads.length === 0, '★deep-pay-compare.js が区分の人数（cohort.n / comp.n など）を読まない',
     reads.join(' '));
  ok(!/\bnOf\b/.test(jsC), '★人数を取り出す nOf() は残っていない');
  ok(!/\bpeople\s*:|\bvs\s*:/.test(jsC), '★「◯人 vs ◯人」の語（people / vs）を文言に持たない');
  ok(/cohort\.trust\b/.test(jsC), '人数の代わりにサーバの cohort.trust を読んでいる');

  /* ★変動給比率を「100 − 固定・保証給比率」で出さない（2社ぶん並ぶので嘘が倍になる）。
     fixed_pct は 固定＋職位＋役割＋住宅 なので、残りは変動給ではない。 */
  for (const [name, src] of [['deep-pay-compare.js', jsC], ['deep-pay.js', decomment(read('deep-pay.js'))]]) {
    ok(!/100\s*[-−]\s*(Math\.round\()?\s*(fx|fixed)/i.test(src),
       `★${name}: 変動給比率を「100 − 固定給」で出していない`);
  }
  ok(/segPct\(segsOf\(x\),\s*'variable'\)/.test(jsC),
     '★変動給比率は segs の variable から取っている');
  ok(/return null;/.test(JS.slice(JS.indexOf('function segPct'), JS.indexOf('function segPct') + 260)),
     '★segPct は無い区分に null を返す（0 でも 100−fixed でもない）');

  /* ★賞与は棒に入れない（年額。月々の現金の100%を壊す）。表には行として残る。 */
  const segk = /var SEGK = \[([^\]]*)\]/.exec(jsC);
  ok(!!segk, 'SEGK（棒の区分）が読める');
  const keys = segk ? segk[1].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean) : [];
  ok(keys.length === 9, '★棒の区分は9つ（db/deep-pay.sql の cseg と同じ）', keys.join(' '));
  ok(keys.indexOf('bonus') < 0, '★賞与は棒の区分に入っていない（年額なので月々の現金に混ぜない）');
  ok(/mBonus/.test(jsC), '賞与は表の行としては残っている');

  /* ★トレードオフの対から意図的に外した2つ。書かないと後から足される。 */
  const tr = /var TRADE = \[([\s\S]*?)\];/.exec(jsC);
  ok(!!tr, 'TRADE（対にする組）が読める');
  const trs = tr ? tr[1] : '';
  ok(!/'fixed'[\s\S]{0,40}'variable'|'variable'[\s\S]{0,40}'fixed'/.test(trs),
     '★固定・保証給比率 × 変動給比率 を対にしていない（同じ円の裏表で必ず逆に振れる）');
  ok(!/'annual'[\s\S]{0,20}y:\s*'pbh'|'pbh'[\s\S]{0,20}y:\s*'annual'/.test(trs),
     '★年収 × Pay/Block Hour を対にしていない（後者は前者を割ったもの）');
  ok((trs.match(/\{\s*x:/g) || []).length === 3, '★対にするのは3つだけ',
     String((trs.match(/\{\s*x:/g) || []).length));
  ok(/slice\(0,\s*2\)/.test(jsC), '★トレードオフは最大2行');

  /* ★色は PVViz.SEG から引く（マイレポート・Overview と同じ色になる）。 */
  ok(/V\.SEG/.test(jsC), '★色は PVViz.SEG から引いている（自前の色表を持たない）');
  ok(!/#[0-9a-f]{6}/i.test(jsC), '★JS に生の色コードが無い', (jsC.match(/#[0-9a-f]{6}/ig) || []).join(' '));

  /* ★「ほぼ同じ」は画面に出す文字列どうしで判定する（丸めた後に同じ表示になる値がある）。
     2026-10-11 に年収と Pay / Block Hour の刻みが細かくなった（円なら 1万円・100円）。
     同じ表示になる幅は狭くなったが、**判定の仕方は変えていない**（§7 が実物で見る）。 */
  ok(/same:\s*sa === sb/.test(jsC), '★「ほぼ同じ」は表示する文字列で判定している');
  /* ★差は 2026-08-31 から数値で出す（オーナー確定「語を書かず数値だけ」）。
     許されるのは**画面に出ている2つの文字列の引き算**だけ。金額も時間も丸めてから
     画面に出ている（年収と Pay / Block Hour は刻み・手当の月額は有効数字2桁・
     時間は小数1桁）。生の値で引くと、読み手が自分で引き算した答えと合わない数が
     出る＝画面に出ている刻みより細かい精度の主張になる。 */
  const deltaFn = (decomment(JS).match(/function delta\([\s\S]*?\n  \}/) || [''])[0];
  ok(deltaFn.length > 0, '★差を出す delta() が在る');
  ok(!/va\s*[-−]\s*vb|vb\s*[-−]\s*va|va\s*\/\s*vb|vb\s*\/\s*va/.test(deltaFn),
     '★差を生の値で引いていない（丸める前の値で引くと画面の数字と辻褄が合わない）');
  ok(/partsOf\(r\.sa\)[\s\S]{0,80}partsOf\(r\.sb\)/.test(deltaFn),
     '★差は画面に出ている2つの文字列から出している');
  /* ★割合の差は pt。71% と 64% の差は 7 ポイントで 7% ではない。 */
  ok(/'%'\s*\?\s*'pt'/.test(deltaFn), '★割合の差の単位は pt（% と書かない）');
  ok(!/[▲▼↑↓+]-|より高い|の方が/.test(jsC), '★差に勝ち負けの記号・語を添えていない');
}

// ════════════════════════════════════════════════════════════════
// ④ 写した関数がずれていない
// ════════════════════════════════════════════════════════════════
console.log('\n════ ④ 写した関数 ════');
{
  /* ビルドが無いので共有できない。写した以上、ずれていないことを機械で見張る。 */
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
  const DC = bodies(JS);
  const MV = bodies(read('my-value.js'));
  const DP = bodies(read('deep-pay.js'));

  for (const name of ['sec', 'note', 'empty', 'exact', 'usdToJpy']) {
    ok(DC[name] && MV[name] && norm(DC[name]) === norm(MV[name]),
       `★${name}() が my-value.js の写しのまま（ずれていない）`);
  }
  /* ★丸める道具は6つとも1文字も違えない（2026-10-11 に stepIn・moneyRate・sigIn が増えた）。
       違うと、同じ会社の同じ数字が DEEP PAY と会社比較で別の額になる
       ── どちらの画面も普通に動いたまま。
     ★lockLines は錠前の板の行を決める関数。画面ごとに別々に組んで
       いた頃、比較の側だけ「100人に届いていない」の行が抜けていた。
     ★lockHref / lockBoard は、板のボタンの行き先と板の組み方（2026-10-11）。
       片方の画面でだけ行き先が違う、を作らない。
     ★同じ日に4つ増えた（見る資格が「ぜんぶ答えた人」になった回）──
       todoNames（まだ答えていない項目の名前の表）／todoMonth（対象月の言い方）／
       lockTodo（その一覧）／lockHtml（板そのもの）。板は2つの画面で**同じ本体**が組む。
       表だけが片方でずれると、同じ人が DEEP PAY と会社比較で違う名前の一覧を見る。 */
  /* ★同じ日にもう6つ増えた（閉じた画面の後ろに影絵を置いた回）──
       ghBar / ghBars / ghField / ghHead（影絵の部品）／ghostTint（色）／lockStage（器）。
       ずれると、2つの画面で板の後ろの絵の作りが食い違う。特に lockStage は
       aria-hidden・inert を付ける場所なので、片方だけ外れると読み上げに影絵が出る。
       ⚠️ ghostShapes はここに**入れない** ── 画面ごとに形が違う（別物で正しい）。 */
  /* ★同じ日にもう9つ増えた（開いた瞬間のクラッカー。オーナー指示）──
       partyKey（印の鍵の名前）／partyWho（会員の指紋）／partyMark（閉じた板で印を置く）／
       partyDue（印を消して、鳴らしてよいか答える）／partyBit・partySpec（番号だけで決まる
       飛び方）／partyHtml（紙）／partyFire（器と動き）／partyPop（入口）。
       ずれると、2つの画面で印の名前や持ち主の見方が食い違う ── 先に開いた画面で鳴って、
       もう片方では鳴らない、が成り立たなくなる（同じ人に2回鳴る・1回も鳴らない）。 */
  /* ★同じ日にもう2つ増えた（ログインしていない人を、ログイン画面へ送らなくなった回）──
       anonGate（その人に出す板の、作り物の門）／authLost（サーバが「ログインしていない」と
       答えたかの見分け）。ずれると、同じ人が DEEP PAY と会社比較で違う板を見る ── 片方では
       「読み込めませんでした」・もう片方では「給与詳細提出で開きます」。
       本体の中身（門の形・見分けの表）は assert-deep-pay.mjs の ⑭ が取り出して見ている。 */
  for (const name of ['sig2', 'sigIn', 'stepIn', 'money', 'moneyRate', 'moneyExact',
                      'segPct', 'airName', 'lockLines', 'lockHref', 'lockBoard',
                      'todoNames', 'todoMonth', 'lockTodo', 'lockHtml',
                      'ghBar', 'ghBars', 'ghField', 'ghHead', 'ghostTint', 'lockStage',
                      'anonGate', 'authLost',
                      'partyKey', 'partyWho', 'partyMark', 'partyDue', 'partyBit', 'partySpec',
                      'partyHtml', 'partyFire', 'partyPop',
                      /* ★2026-10-12 にもう1つ（会社比較を閉じた回）── compareOpen（手元の住所で
                           だけ効く試験用の口）。ずれると、片方の JS でだけ口が緩む・片方でだけ
                           効かない（入口のカードは出るのに、先の画面は閉じたまま）。
                           字そのものと、住所の表での答えは ⓪ の c)。 */
                      'compareOpen']) {
    ok(DC[name] && DP[name] && norm(DC[name]) === norm(DP[name]),
       `★${name}() が deep-pay.js の写しのまま（ずれていない）`);
  }
  /* ★板の文言は T に在り、T は画面ごとに別の表（関数の突き合わせでは見えない）。
       板だけが使う3つ（答えきっていない行・一覧の見出し・断り）は、2つの JS で
       **1文字も違わない**こと。日英の2つずつ＝どちらの言語にも同じ鍵で在ること。
     ★前の行（lockDet）は、どちらの JS にも残っていない。 */
  {
    const dpC = decomment(read('deep-pay.js'));
    const vals = (src, key) => [...src.matchAll(new RegExp('\\b' + key + ":\\s*'((?:[^'\\\\]|\\\\.)*)'", 'g'))]
      .map((m) => m[1]);
    /* ★2026-10-11 オーナーが決めた字（題・ボタン・答えの行）。作文で戻せないよう、字そのものを縛る。
         題は「まだ開いていません」ではなく何をすれば開くか。ボタンは「匿名で給与を出す」ではない。
         答えの行の後ろ半分（該当なしか 0）と、ボタンの下の注記（集計にしか使いません）は外した。 */
    ok(vals(dpC, 'lockT')[0] === '給与詳細提出で開きます' && vals(jsC, 'lockT')[0] === '給与詳細提出で開きます',
       '★★板の題は「給与詳細提出で開きます」（オーナー指定の字のまま）', vals(dpC, 'lockT')[0]);
    /* ★ボタンの末尾の語は、同じ日にオーナーが「解放」へ直した（トップの
         「Give & Get 全ての待遇データを解放する」と同じ字）。英語は変えていない。 */
    ok(vals(dpC, 'lockGo')[0] === 'Give & Get 詳細を入力して解放する' && vals(jsC, 'lockGo')[0] === 'Give & Get 詳細を入力して解放する',
       '★★板のボタンは「Give & Get 詳細を入力して解放する」（オーナー指定の字のまま・「匿名で」を足さない）', vals(dpC, 'lockGo')[0]);
    ok(vals(dpC, 'lockGo')[1] === 'Give & Get / Enter your details to unlock',
       '★板のボタンの英語は「Give & Get / Enter your details to unlock」のまま', vals(dpC, 'lockGo')[1]);
    ok(vals(dpC, 'lockReady')[0] === '給与の項目をすべて答えると開きます。',
       '★★答えの行は「給与の項目をすべて答えると開きます。」の1文だけ', vals(dpC, 'lockReady')[0]);
    ok(!/支給が無い項目は|Where nothing is paid|集計にしか使いません|only (ever )?used in aggregate|\blockN\b/.test(jsC + dpC),
       '★★外した2つの文（該当なしか 0／集計にしか使いません）が、どちらの JS にも戻っていない');
    ok(/esc\(give \? T\.lockT : T\.lockTWait\)/.test(dpC) && /esc\(give \? T\.lockGo : T\.lockCta\)/.test(dpC),
       '★人数の条件だけで止まっている人には、前の題とボタンを出す（「提出で開きます」と嘘を言わない）');
    for (const key of ['lockReady', 'lockTodoH', 'lockWarn', 'lockT', 'lockTWait', 'lockGo']) {
      const a = vals(jsC, key), b = vals(dpC, key);
      ok(a.length === 2 && b.length === 2 && a.join('\n') === b.join('\n'),
         `★${key} は日英の2つずつ・deep-pay.js と同じ字`,
         `比較 ${a.length} 個 / DEEP PAY ${b.length} 個`);
    }
    ok(!/\blockDet\b/.test(jsC) && !/\blockDet\b/.test(dpC)
       && !/\bg\.detailed\b|\bgate\.detailed\b/.test(jsC),
       '★前の行（lockDet）と前の鍵（gate.detailed）が、どちらの JS にも残っていない');
    /* ★受け手（PVGates.setProgress）は 2026-10-11 から受け取るだけで何もしない ── 読んでいた
         DEEP PAY の札を、3段の表から外したため（assert-deep-pay.mjs の ⑪ と同じ見方）。 */
    ok(/detailed:\s*\(v && v\.give\) \? v\.give\.detailed : null/.test(jsC),
       'PVGates.setProgress へ渡すのは今までどおり give.detailed（門の値ではない。受け手はもう何もしない）');
    /* 板を組む道は lockHtml() の1本。shut() が自前で組み直していない。 */
    ok((jsC.match(/dp-msg--lock/g) || []).length === 1 && (dpC.match(/dp-msg--lock/g) || []).length === 2,
       '★錠前の板（.dp-msg--lock）を組むのは lockHtml() だけ（DEEP PAY の側のもう1つは「人数が足りません」の板）',
       `比較 ${(jsC.match(/dp-msg--lock/g) || []).length} / DEEP PAY ${(dpC.match(/dp-msg--lock/g) || []).length}`);
  }
  /* ★2桁の道具は、表示通貨の中で掛ける側（sigIn）を通っている。円に直した値へ
       じかに sig2 を掛ける形に戻すと、ドルで $629 のような端数が出る（§9c が実物で見る）。 */
  ok(/function moneyExact\(usd\) \{[\s\S]{0,160}exact\(sigIn\(usdToJpy\(n\)\)\)/.test(jsC),
     '★月額（moneyExact）は sigIn を通している（円で丸めてから換算する形に戻っていない）');
  /* ★見出しの2つは刻みの道具を通っている（2桁の道具に戻っていない）。 */
  ok(/annual:\s*\{\s*lab:\s*T\.mAnnual,\s*f:\s*money,/.test(jsC),
     '★年収は money()（刻み）で出している');
  ok(/pbh:\s*\{\s*lab:\s*T\.mPbh,\s*f:\s*moneyRate,/.test(jsC),
     '★Pay / Block Hour は moneyRate()（刻み）で出している（moneyExact に戻っていない）');
  /* ★錠前の板に、行を足したり埋めたりする道が残っていない（実際に在った不具合の形）。 */
  ok(!/lines\.push\(/.test(jsC) && !/lines\.push\(/.test(decomment(read('deep-pay.js'))),
     '★錠前の板の行を lockLines() の外で足していない（別の行で埋めない）');
  /* ★logoHtml() の出どころは actual-pay.js（色を持たない版）。deep-pay.js には無い。
     salary-leveling.js のほうはブランド色が要り、salary-data.json はそれを持たない。
     違うのは CSS の接頭辞（ap- → dc-）だけなので、そこだけ揃えて突き合わせる。 */
  const AP = bodies(read('actual-pay.js'));
  ok(DC.logoHtml && AP.logoHtml
     && norm(DC.logoHtml).split('dc-logo').join('X') === norm(AP.logoHtml).split('ap-logo').join('X'),
     '★logoHtml() が actual-pay.js の写しのまま（接頭辞だけ違う）');
  ok(!/PV_BRAND|brandColor/.test(jsC),
     '★色付きのロゴ（salary-leveling.js 版）を写していない ── salary-data.json は色を持たない');
  ok(!/maskSample|sampleBreakdown/.test(jsC), '★maskSample / sampleBreakdown は写していない');
}

// ════════════════════════════════════════════════════════════════
// ④-b 開いた瞬間のクラッカー（字面）
// ════════════════════════════════════════════════════════════════
/* 2026-10-11・オーナー指示 ── 閉じた板を見ていた会員が給与の詳細を出して、画面が開いたら
   「クラッカーならしてね」。紙吹雪を1回だけ飛ばす（deep-pay-compare.js の「開いた瞬間のクラッカー」の節）。
   ここは字面で見る。実際に出る・出ない・押せる・片づくは、下のブラウザの節（§2e）。
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
console.log('\n════ ④-b 開いた瞬間のクラッカー（字面）════');
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
                   'lockBoard', 'anonGate', 'authLost', 'load', 'pair', 'one', 'picker', 'hdr', 'cond', 'cards', 'sideCard', 'diff',
                   'mix', 'barOf', 'trade', 'cta', 'ask', 'dup', 'few', 'only', 'ghostShapes', 'ghostTint']) {
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
     && /lockBoard\(box, lockStage\(\(S\.boot && S\.boot\.gate\) \|\| \{\}\)\);\s+partyMark\(\);\s+\}/.test(jsC),
     '★印を置くのは、閉じた板を置いた直後だけ（読み込めなかった画面では置かない）');
  /* ★ログインしていない人の板（2026-10-11）は、印を置く行より**前で戻る**。印は「閉じた板を
       見た会員」の控えで、あの板は会員の門を見て出したものではない ── ログインが切れた
       だけの会員には指紋が在るので、通すと、前から開いていた人がログインし直した日に鳴る。 */
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
}

// ════════════════════════════════════════════════════════════════
// ④-c ログインしていない人を、ログイン画面へ送らない（字面。2026-10-11）
// ════════════════════════════════════════════════════════════════
/* オーナー判断 ── ログインしていない人を、ログイン画面へ送らない。「会員で、まだ開いて
   いない人」と**同じ画面**（ぼかした影絵＋板）を出す（経緯は assert-deep-pay.mjs の ⑭）。
   ここは字面。実物は下のブラウザの §2f。見るのは4つ：
     a) 送り先が消えた ── この画面（日英）の HTML に、人をよそへ運ぶ字が1つも無い。
        セッションの見張りは「在ればそれ・無ければ null」を返すだけ。
     b) 聞く前に戻る ── boot() は、セッションが無ければ板を描いて戻る。その行は、指紋を取る行・
        預かり証の引き取り・pv_deep_pay() の**どれよりも前**。
     c) サーバが「ログインしていない」と答えた回も同じ板 ── 入口の1回（load）と、2社を引く回
        （one → pair）の両方。pair は LOST を「引けなかった」より**前**に見る。
     d) 触らないもの ── 端末のログインの控え・門の鍵・解析。板に文もリンクも足していない。
   ★板の中身（作り物の門を本物の道具に通した答え）と、見分けの表（authLost）は、
     assert-deep-pay.mjs の ⑭ が取り出して実行している。こちらは、その2つが deep-pay.js と
     **同じ本体**であること（④）で足りる ── 同じ表を2か所に置かない。 */
console.log('\n════ ④-c ログインしていない人（字面）════');
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
    ok(count(/login\.html/g, bare) === 1
       && /<a class="mr-side-sub" id="pv-anav-login" data-pv-auth="out" href="login\.html">/.test(bare),
       `${name}: ログイン画面の住所は、左メニューの「ログイン」の1本だけ（足していない）`,
       String(count(/login\.html/g, bare)));
  }
  /* ★2026-10-12、location という字が1つ入った ── compareOpen() が location.hostname を**読む**
       （手元の確認用サーバかどうかの見分け。運ぶ字ではない）。その関数は ⓪ の c) が字ごと
       固定しているので、ここでは**その関数だけを抜いて**から、今までどおり見る。
       ⚠️ 「location.hostname なら可」のように字で緩めない（別の関数に書いた日に通ってしまう）。 */
  {
    const openC = decomment(cutFn(JS, 'compareOpen'));
    const rest = openC ? jsC.replace(openC, () => ' ') : jsC;
    ok(openC.length > 0 && (jsC.match(/\blocation\b/g) || []).length === 1
       && (openC.match(/\blocation\b/g) || []).length === 1 && /w\.location\.hostname\b/.test(openC)
       && !/\blocation\b|history\s*\.|window\.open\s*\(/.test(rest),
       '★★deep-pay-compare.js は、人をよそへ運ばない（location・history・window.open という字が無い。'
       + '在るのは compareOpen() が hostname を読む1つだけ）',
       `location の字 ${(jsC.match(/\blocation\b/g) || []).length} 個`);
  }

  // ── b) 聞く前に戻る ──
  const bootC = decomment(cutFn(JS, 'boot'));
  const at = (s) => bootC.indexOf(s);
  const gone = at("if (!session) { S.mode = 'anon'; render(); return; }");
  ok(gone > at('ready.then(function (session) {') && at('ready.then(function (session) {') >= 0,
     '★★boot() は、セッションが無ければ板を描いて戻る（S.mode を anon にして render）', String(gone));
  ok(gone >= 0 && gone < at('S.who = partyWho(session);') && gone < at('PVClaimPending')
     && gone < at('load(client)') && at('load(client)') > 0 && at('PVClaimPending') > 0,
     '★★その行は、指紋を取る行・預かり証の引き取り・pv_deep_pay() のどれよりも前（聞く前に戻る）');
  ok(count(/\bload\(client\)/g, bootC) === 1 && count(/\.rpc\b/g, bootC) === 1 && /if \(!client \|\| !client\.rpc\)/.test(bootC),
     '★boot() の中で pv_deep_pay() へ行く道は load(client) の1本だけ（その手前に、戻る行が在る）');
  /* ★2社を引く道（pair）は、選ぶ欄からしか通らない。欄を触れるのは S.client が入ってから
       （onPick の頭で見ている）で、S.client を入れるのは load() だけ ＝ ログインしていない人の
       画面から pair() へは届かない。 */
  ok(count(/\bS\.client = /g, jsC) === 1 && /S\.client = client;/.test(decomment(cutFn(JS, 'load')))
     && /if \(!S\.client\) return;/.test(decomment(cutFn(JS, 'onPick')))
     && /if \(!client \|\| !pairReady\(\)\) return;/.test(decomment(cutFn(JS, 'pair'))),
     '★2社を引く道（pair）は、入口の1回（load）を通った窓からしか届かない');

  // ── c) サーバが「ログインしていない」と答えた回 ──
  const loadC = decomment(cutFn(JS, 'load'));
  const oneC  = decomment(cutFn(JS, 'one'));
  const pairC = decomment(cutFn(JS, 'pair'));
  const rendC = decomment(cutFn(JS, 'render'));
  ok(count(/'anon'/g, jsC) === 6 && count(/S\.mode = 'anon'/g, bootC) === 1
     && /if \(res && res\.error\) \{ S\.mode = authLost\(res\) \? 'anon' : 'error'; render\(\); return; \}/.test(loadC)
     && count(/S\.mode = 'anon'/g, pairC) === 1,
     '★anon になる道は3つだけ（boot ＝ 聞かずに決まる／load・pair ＝ サーバが「ログインしていない」と答えた）',
     `'anon' の字 ${count(/'anon'/g, jsC)} 個`);
  ok(/if \(S\.mode === 'anon'\)\s+\{ shut\('anon'\);\s+return; \}/.test(rendC)
     && rendC.indexOf("shut('anon')") < rendC.indexOf('partyPop()') && count(/shut\('anon'\)/g, jsC) === 1,
     '★描くのは render() の1行（shut(\'anon\')）で、「開いている」枝より前 ＝ クラッカーを通らない');
  ok(loadC.indexOf('authLost(res)') > 0 && loadC.indexOf('authLost(res)') < loadC.indexOf('PVGates.mark'),
     '★読み込めなかった回・ログインが切れていた回は、左メニューの錠前の控えを書き換える行より前で戻る');
  ok(count(/\bauthLost\(/g, jsC) === 3
     && /if \(!res \|\| res\.error\) return authLost\(res\) \? LOST : null;/.test(oneC),
     '★authLost() を使うのは load() と one() の2か所（one は LOST か null を返す）', String(count(/\bauthLost\(/g, jsC)));
  {
    const lost = pairC.indexOf("if (r[0] === LOST || r[1] === LOST) { S.mode = 'anon'; render(); return; }");
    const miss = pairC.indexOf("if (!r[0] || !r[1]) { S.mode = 'error'; render(); return; }");
    ok(lost > 0 && miss > lost && count(/\bLOST\b/g, jsC) === 4 && /var LOST = \{\};/.test(jsC),
       '★★pair() は LOST を「引けなかった」より前に見る（後ろに置くと、中身の無い目印を答えとして描きに行く）',
       `LOST ${lost} / 引けなかった ${miss} / 字 ${count(/\bLOST\b/g, jsC)} 個`);
  }
  ok(count(/\banonGate\(/g, jsC) === 2 && /lockStage\(anonGate\(\)\)/.test(decomment(cutFn(JS, 'shut'))),
     '★anonGate() を使うのは shut() の1か所だけ（会員の板の道には混ぜない）', String(count(/\banonGate\(/g, jsC)));

  // ── d) 触らないもの ──
  ok(!/log\s?in|sign\s?in|ログイン|サインイン|会員登録|sign\s?up/i.test(jsC),
     '★★deep-pay-compare.js に「ログイン」「Log in」「会員登録」の字が1つも無い（板に文もリンクも足していない）',
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
  ok(!/\.auth\b|signOut|refreshSession|setSession/.test(jsC),
     '★★deep-pay-compare.js は、端末のログインの控えに触らない（サインアウトしない・auth を呼ばない）');
  ok(!/pv_salary_unlock_expiry|pv_unlock_expiry|pv_session_start|pv_last_active|pv_give_seen/.test(jsC),
     '★deep-pay-compare.js は、門とログインの鍵の名前を1つも知らない（読まない・書かない）');
  ok(!/\bgtag\s*\(|dataLayer/.test(jsC), '★解析のイベントを足していない（gtag / dataLayer を呼ばない）');
}

// ════════════════════════════════════════════════════════════════
// ⑤ 器（読み込む順・通貨・他所の CSS を書き換えない）
// ════════════════════════════════════════════════════════════════
console.log('\n════ ⑤ 器 ════');
{
  for (const [name, html] of [['ja', JA], ['en', EN]]) {
    /* ★?v=指紋 が付いていてもいなくても拾う（2026-10-11 にこの画面の JS / CSS へ指紋を
         付けた。指紋そのものが合っているかは assert-links.mjs の STAMPS が見る）。 */
    const at = (f) => html.search(new RegExp('(?:src|href)="[^"]*' + f.split('.').join('\\.')
      + '(?:\\?v=[0-9a-f]+)?"'));
    /* ★この順が効いている。pay-viz.js は esc/num/fmt/SEG を、airline-logos.js は
       PV_LOGOS を、pv-gates.js は PVGates を置く。どれも先に要る。 */
    ok(at('pv-gates.js') >= 0 && at('pv-gates.js') < at('deep-pay-compare.js'),
       `${name}: pv-gates.js は deep-pay-compare.js より前`);
    ok(at('airline-logos.js') >= 0 && at('airline-logos.js') < at('deep-pay-compare.js'),
       `${name}: ★airline-logos.js は deep-pay-compare.js より前（ロゴが出ない）`);
    ok(at('pay-viz.js') >= 0 && at('pay-viz.js') < at('deep-pay-compare.js'),
       `${name}: pay-viz.js は deep-pay-compare.js より前`);
    ok(at('deep-pay.css') >= 0, `${name}: deep-pay.css を読んでいる（.dp-pick-* を借りる）`);
    ok(at('deep-pay-compare.css') >= 0, `${name}: deep-pay-compare.css を読んでいる`);
    ok(/<link\s+rel="icon"/.test(html), `${name}: favicon を宣言している`);
    ok(/fonts\.googleapis\.com\/css2/.test(html), `${name}: Inter を読んでいる`);
    ok(/<title>[^<]+<\/title>/.test(html), `${name}: title が空でない`);
    ok(/name="robots"\s+content="noindex/.test(nohtmlcomment(html)), `${name}: noindex を宣言している`);
    ok(/<div class="pv-no-cur" id="dc-root">/.test(html),
       `${name}: ★pv-no-cur は #dc-root に付いている（自動走査を止める場所は1つ）`);
    /* ★コメントの中でも pv-no-cur に触れている（なぜ1つなのかを書き残してある）。
       素の grep だと**説明を書いた画面ほど赤くなる**ので、先にコメントを落とす。 */
    const bare = nohtmlcomment(html);
    ok((bare.match(/pv-no-cur/g) || []).length === 1, `${name}: ★pv-no-cur は1つだけ`,
       String((bare.match(/pv-no-cur/g) || []).length));
    ok(/<nav class="mr-side"/.test(html), `${name}: 左メニューの器が在る`);
  }
  ok(/addEventListener\('pv-currency-change'/.test(jsC), '通貨の切替を聞いている');

  /* ★他所の画面の CSS をトップレベルで書き換えない（db/test-form-contract.mjs が見ている）。
     要るなら #dc-root .pt-… と囲む。 */
  const top = (cssC.match(/^\s*\.(pt|mv|mr|dp)-[\w-]+\s*[,{]/gm) || []);
  ok(top.length === 0, '★.pt-* / .mv-* / .mr-* / .dp-* をトップレベルで書き換えていない', top.join(' '));

  /* iOS は 16px 未満の入力欄で勝手にズームする。実測は下のブラウザ側でも見る。 */
  ok(/\.dp-pick-s\{[^}]*font-size:16px/.test(read('deep-pay.css')),
     '★選択欄は 16px（iOS の自動ズーム）── deep-pay.css の .dp-pick-s');

  /* 押せるものには全部 hover / focus-visible / active（CLAUDE.md の絶対規則）。 */
  for (const st of [':hover', ':focus-visible', ':active']) {
    ok(cssC.includes(st) || read('deep-pay.css').includes(st),
       `押せる要素に ${st} が在る`);
  }
  ok(!/transition-all/.test(cssC), '★transition-all を使っていない');
}

// ════════════════════════════════════════════════════════════════
// ⑥ ブラウザ
// ════════════════════════════════════════════════════════════════
console.log('\n════ ⑥ ブラウザ ════');

/* ★ここに出てくる数字は**全部作り物**（本番の DB は読まない）。
   会社ごとに違う答えを返すのがこの検査の要なので、payload は
   { air: { 会社コード: 見本 } } の形で渡し、FAKE の中で組み立てる。
   ⚠️ evaluateOnNewDocument に関数は渡せない（構造化複製で落ちる）ので、
      組み立ては必ず FAKE の**中**に置く。 */
const FAKE = function (payload) {
  window.__rpc = {};
  window.__from = 0;
  window.__rpcArgs = [];
  const UID = '00000000-0000-4000-8000-00000000a001';
  const STATS = { reports: 58, month: 12, airlines: 19, contributors: 37 };
  const P = payload || {};
  /* ★gate の形は db/deep-pay.sql の返り値（2026-10-11）。crowd ＝「みんなの側」の門
       （100人以上 or 手動の公開フラグ）。ここの作り物は 37 / 100 人のまま開いている
       ＝手動フラグで開けた日の形なので、開いているときは crowd:true。
     ★gate は { key, ready, todo, crowd, contributors, goal }（同じ日のオーナー判断で
       本人の側の門が入れ替わった）。ready ＝自分に当てはまる項目をぜんぶ答えた月を
       持っているか。todo ＝足りない人にだけ { year, month, items:[コード…] }。
       **前の鍵 detailed は gate に無い**（外の give.detailed は別物で、今も返る）。
     ★__gate を渡すと、その門のまま閉じた答えを返す（錠前の板の行を見る §2b 用）。
       crowd や ready を**書かない** __gate は、古いサーバの形になる。 */
  const GATE = P.__gate ? P.__gate
    : P.__lock ? { key: false, ready: false, todo: null, crowd: false, contributors: 37, goal: 100 }
               : { key: true, ready: true, todo: null, crowd: true, contributors: 37, goal: 100 };
  const SHUT = !!(P.__lock || P.__gate);
  const BOOT = {
    state: SHUT ? 'locked' : 'open',
    /* give.detailed は門とは別の値（pv_my_give の答え）。板には効かない。
       ★読んでいたのは3段の表の DEEP PAY の札で、2026-10-11 に外した ── いま画面でこれを
         使う所は無い（deep-pay-compare.js は PVGates.setProgress へ渡すが、受け手は何もしない）。 */
    gate: GATE, stats: STATS, give: { detailed: !SHUT }
  };
  /* ★選べる組み合わせ（2026-09-01・オーナー確定「選択できる ＝ 実際に数字が返る」）。
     サーバが「数字が返る組み合わせ」を全部返し、**画面はそれを引くだけ**。
       air … 会社を選ぶだけで数字が返る会社
       pos["ana"] … ANA を選んだとき数字が返る役職（"" ＝ 会社を絞らないとき）
       flt["ana|cap"] … ANA × 機長で数字が返る機材
     ⚠️ 自動 fallback は禁止。一覧が無いときに「全社出す」逃げ道は**置かない**
        （置くと「選べるのに数字が出ない」が戻る）。だから既定値は
        **この作り物の中だけ**の話で、製品側の既定値ではない。
        一覧が無い・空のときに欄が消えることは §13 が専用の payload で見る。
     ★会社ごとに違う機材を持たせる（ANA に A380 は無い）。会社だけで数えると
       出ない形＝左右で別々に絞れていないと落ちる。 */
  const DEF_PICKS = (function () {
    const F = { ana: { cap: ['b787', 'b777'], fo: ['a320', 'b787'] },
                jal: { cap: ['b787', 'b767'], fo: ['b737', 'b787'] },
                /* ★sas は見本の表（P.air）に無い＝選んでも「まだ出せません」が返る。
                   **わざと選べるようにしてある。** §5（片側だけ薄い）が見ているのは
                   その形で、本番でも起こりうる（一覧を受け取ったあとに DB が動く）。
                   ここ以外の会社は必ず数字が返る。 */
                sas: { cap: ['a320'], fo: ['a320'] } };
    /* 見本の表にある会社は全部選べるようにする（§4〜§6 は会社を選んで描き手を叩く）。 */
    for (const c of Object.keys(P.air || {}))
      if (!F[c]) F[c] = { cap: ['b787'], fo: ['a320'] };
    const uniq = (l) => [...new Set(l)].sort();
    const air = Object.keys(F).sort();
    const pos = { '': ['cap', 'fo'] }, flt = {}, all = [];
    for (const c of air) {
      pos[c] = Object.keys(F[c]).sort();
      const mine = [];
      for (const k of pos[c]) { flt[c + '|' + k] = F[c][k].slice().sort(); mine.push(...F[c][k]); }
      flt[c + '|'] = uniq(mine); all.push(...mine);
    }
    flt['|'] = uniq(all);
    for (const k of pos['']) flt['|' + k] = uniq(air.flatMap((c) => F[c][k] || []));
    return { air, pos, flt };
  })();
  if (!P.__nopicks) BOOT.picks = P.__picks || DEF_PICKS;
  /* ★__poison ＝ 閉じた答えに、本物らしい数字が紛れて来た形（2026-10-11）。本物のサーバは
       鍵の無い人へ cohort / head / comp / work / var を null で返す。**来ても1文字も
       描かない**ことを §2d が見るためだけの細工（板の後ろの影絵にも、板にも）。 */
  if (P.__poison) Object.assign(BOOT, {
    cohort: { level: 'selected', manual: true, airline: 'ana', pos: 'cap', fleet: 'b787', trust: 'high' },
    head: { annual_usd: 119700, per_block_usd: 102.5, fixed_pct: 62 },
    comp: { segs: [{ k: 'base', pct: 52, med_usd: 4800 }, { k: 'variable', pct: 24, med_usd: 2200 },
                   { k: 'perdiem', pct: 7, med_usd: 640 }], bonus: { pct_of_annual: 5 } },
    work: { block_h: 74.5, duty_h: 141.5, stay_nights: 9 },
    var: [{ k: 'block', pct: 46 }, { k: 'sector', pct: 21 }]
  });
  /* ★入口の1回は state と鍵だけ。cohort / head / comp を混ぜない
     ── 混ぜると「選ぶ前に数字が出ていない」ことを見張れなくなる。 */
  /* ★薄い側。本物は head / comp / work / var を**返り値ごと** null にし、
       信頼度の段（trust）も null で返す。 */
  const THIN = { state: 'open', gate: GATE, stats: STATS,
                 cohort: { level: 'none', manual: true, trust: null },
                 head: null, comp: null, work: null, var: null };
  function side(f) {
    /* ★区分の人数は**入れない**（サーバが返さなくなった）。代わりは cohort.trust。
       f.trust を書いていない見本は、段が来ない形（古いサーバ）になる。
       ★f.poison は「古いサーバが人数を付けてきた」形。**来ても読まない**ことを
         §4b が見るためだけの細工で、本物の新しい答えには無い。 */
    const o = {
      state: 'open', gate: GATE, stats: STATS,
      cohort: { level: 'selected', manual: true },
      head: { annual_usd: f.annual, per_block_usd: f.pbh, fixed_pct: f.fixed },
      comp: {
        segs: f.segs,
        bonus: (f.bonus == null ? null : { pct_of_annual: f.bonus })
      },
      work: { block_h: f.block, stay_nights: f.stay }
    };
    if (f.trust !== undefined) o.cohort.trust = f.trust;
    if (f.poison) {
      o.cohort.n = f.poison; o.head.detailed_n = f.poison; o.head.verified_n = f.poison - 5;
      o.comp.n = f.poison; if (o.comp.bonus) o.comp.bonus.n = f.poison - 3;
    }
    return o;
  }
  const RPC = {
    pv_deep_pay: (args) => {
      const q = (args && args.p) || null;
      if (!q || !q.airline) return BOOT;         // 入口の1回（引数なし）
      const f = (P.air || {})[q.airline];
      return f ? side(f) : THIN;                  // 表に無い会社＝人数の壁に届かない区分
    },
    pv_pay_rows: () => ({ ok: true, state: 'open', rows: [], stats: STATS }),
    pv_give_progress: () => ({ ok: true, contributors: 37, give: { detailed: true } })
  };
  function q(rows) { const o = { data: rows, error: null,
    select: () => o, eq: () => o, in: () => o, order: () => o, limit: () => o,
    update: () => o, insert: () => o,
    single: async () => ({ data: rows[0] || null, error: null }),
    maybeSingle: async () => ({ data: rows[0] || null, error: null }),
    then: (res) => res({ data: rows, error: null }) }; return o; }
  const CLIENT = {
    auth: {
      /* ★__email ＝ 会員のメールを差し替える（2026-10-12。§0 の「運営」の見本）。画面の側に
           運営を見分ける仕掛けは無い ── 運営が全部見えるのはサーバの答えが開いているから。
           それでも「誰のセッションで来ても同じ板」を、名前の違う会員でも通しておく。 */
      getSession: async () => ({ data: { session: P.__anon
        ? null : { user: { id: UID, email: P.__email || 'pilot@example.com' } } } }),
      getUser: async () => ({ data: { user: { id: UID, email: P.__email || 'pilot@example.com' } } }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: () => { window.__from++; return q([]); },
    rpc: (name, args) => {
      window.__rpc[name] = (window.__rpc[name] || 0) + 1;
      if (name === 'pv_deep_pay') window.__rpcArgs.push(args === undefined ? null : args);
      /* ★__wire を立てた見本は、rpc を呼ぶたびに**本物の通信を1本**出す（2026-10-11。§2f）。
           この偽物は窓の中で答えるので、素のままでは「通信に /rpc/ が無い」を見ても
           何も証明しない。呼ばれたら必ず、住所に /rpc/<名前> の入った通信が出るようにして、
           ブラウザの外（puppeteer が記録する通信の一覧）から数えられるようにする。
           行き先は確認用サーバ自身（404 が返るだけ。本番へは1バイトも出ない）。 */
      if (P.__wire) { try { fetch('/rest/v1/rpc/' + name).catch(() => {}); } catch (e) {} }
      /* ★__fail ＝ pv_deep_pay の答えを、渡した形のエラーに差し替える（2026-10-11。§2f）。
           supabase-js の答えは { data, error:{ code, message … }, status }。「ログインして
           いない」（42501・HTTP 401）と、ほかの失敗を画面が見分けることを見るため。
           __failAfter: n は「はじめの n 回は普通に答える」（入口の1回は通って、2社を引く回に
           切れた形）。__reject は、答えの箱そのものが投げる形。
           ⚠️ __err（符丁も番号も無い失敗）は今までどおり ── §10 と §2e が使っている。 */
      if (P.__reject && name === 'pv_deep_pay')
        return { then: (y, n) => Promise.reject(new TypeError('Failed to fetch')).then(y, n) };
      const res = (P.__fail && name === 'pv_deep_pay' && window.__rpc[name] > (P.__failAfter || 0))
        ? Object.assign({ data: null }, P.__fail)
        : (P.__err && name === 'pv_deep_pay')
        ? { data: null, error: { message: 'synthetic failure' } }
        : { data: RPC[name] ? RPC[name](args) : { ok: true }, error: null };
      /* ★__hold を立てた見本は、pv_deep_pay の答えを**手で放すまで**返さない
           （window.__release()）。読み込みのあいだの画面を、時間に頼らず見るため（§2d）。 */
      if (P.__hold && name === 'pv_deep_pay')
        return { then: (y, n) => new Promise((go) => { window.__release = go; })
          .then(() => res).then(y, n) };
      /* ★本物の PostgREST は Promise ではなく then だけを持つ箱を返す。
         .catch を持たせると deep-pay-compare.js の Promise.resolve() 包みが
         効いているかどうかを見張れない。 */
      return { then: (y, n) => Promise.resolve(res).then(y, n) };
    }
  };
  Object.defineProperty(window, 'supabase',
    { value: { createClient: () => CLIENT }, writable: false, configurable: false });
};

/* 見本。**実在の給与ではない。**
   ana ↔ jal   … 9項目とも両側にある（jal が7項目で上・ana が2項目で上）
   lufthansa   … パーディアムの区分が無く賞与も null →**その2行だけ**落ちる
   emirates    … サーバの値は ana と違うのに、**円では同じ字になる**
                 （年収 $119,700 と $119,750 → どちらも ¥1,903万／Pay/BH $103.5 と $104 →
                   どちらも ¥16,500／fixed 62.2 と 61.8 → どちらも 62%）
   singapore-… … ana と**年収だけ刻み1つぶん違う**（$119,800 → ¥1,904万）。ほかは同じ
   qatar-…     … 年収と Pay/BH は上・Block と ステイは下 → 対が割れてトレードオフは出ない
   sas         … air に無い＝薄い側

   ★形は db/deep-pay.sql の返り値（2026-10-11）──
     ・区分の人数は**入れていない**（サーバが返さなくなった）。代わりは trust
       （high / mid / low）。ana は high・jal は mid とわざと違えてある ── 左右の札が
       入れ替わっていないことを見るため。
     ・年収は $50 刻み・Pay/BH は $0.5 刻み（前は有効数字2桁の丸い数だった）。
   ★円で刷られる字（レートは currency.js の RATES。USD 158.95）──
       ana   119700 → ¥1,903万   103.5 → ¥16,500
       jal   127950 → ¥2,034万   105.5 → ¥16,800      差 +¥131万 / +¥300
     値を変えるなら §4 の期待値も一緒に直す。 */
const SEG5 = (fx, va, pd, ho, ot) => [
  { k: 'base', pct: fx }, { k: 'variable', pct: va }, { k: 'perdiem', pct: pd },
  { k: 'housing', pct: ho }, { k: 'other', pct: ot }
];
const ANA = { trust: 'high', annual: 119700, pbh: 103.5, fixed: 62.2, block: 74.0, stay: 9,
              bonus: 5, segs: SEG5(62, 18, 7, 8, 5) };
const AIR = {
  ana: ANA,
  jal: { trust: 'mid', annual: 127950, pbh: 105.5, fixed: 55, block: 79.5, stay: 12,
         bonus: 8, segs: SEG5(55, 24, 9, 7, 5) },
  lufthansa: { trust: 'mid', annual: 96050, pbh: 84.5, fixed: 71, block: 66.0, stay: 6,
               bonus: null, segs: [{ k: 'base', pct: 71 }, { k: 'variable', pct: 14 },
                                   { k: 'housing', pct: 10 }, { k: 'other', pct: 5 }] },
  emirates: { trust: 'high', annual: 119750, pbh: 104, fixed: 61.8, block: 74.04, stay: 9,
              bonus: 5, segs: SEG5(62, 18, 7, 8, 5) },
  'singapore-airlines': { trust: 'low', annual: 119800, pbh: 103.5, fixed: 62.2, block: 74.0,
                          stay: 9, bonus: 5, segs: SEG5(62, 18, 7, 8, 5) },
  'qatar-airways': { trust: 'mid', annual: 139800, pbh: 110, fixed: 66, block: 60.0, stay: 5,
                     bonus: 6, segs: SEG5(66, 15, 6, 9, 4) }
};
const OK   = { air: AIR };
const LOCK = { __lock: true, air: AIR };
const clone = (o) => JSON.parse(JSON.stringify(o));

/* ── 人数を画面に出さない（2026-10-11・オーナー判断）──────────────────
   「◯人」（日）・「◯ pilots」（英）の形の字が、本文（#dc-root）に1つも無いこと。
   その区分に何人いるかも、壁が何人かも出さない。
   ★「1人ずつ」は人数ではなく計算の仕方（Pay / Block Hour の但し書き）なので除く。
   ★例外はたった1つ ── 錠前の板の「…100人に達すること（いま N人）」。それも
     gate.crowd が false のときだけ（§2b が行ごとに見る）。
   ★「2社」は人数ではない（比べるには2社要る、という動かない壁）。
   ⚠️ この物差しは assert-deep-pay.mjs の NOCOUNT と同じ本体。片方だけ緩めない。 */
const NOCOUNT = /[0-9０-９]+\s*(?:人(?!ずつ)|名)|\b[0-9]+\s+pilots?\b/i;
const countIn = (t) => ((t || '').match(new RegExp(NOCOUNT.source, 'gi')) || []).join(' / ');

const SNAP = () => {
  const t = (s) => ((document.querySelector(s) || {}).textContent || '').trim();
  const all = (s) => [...document.querySelectorAll(s)].map((e) => e.textContent.trim());
  const cnt = (s) => document.querySelectorAll(s).length;
  return {
    rpc: window.__rpc, args: window.__rpcArgs,
    hd: t('#dc-hd h1'),
    /* ★中身は .dp-cond-k（「表示中:」のラベル）ではなく、その隣の素の <span>。
       deep-pay.js:497 と同じ形＝ラベルもピルも .dp-cond-l の中に入っている。
       ここを .dp-cond-k のままにすると、拾えるのは「表示中:」の4文字だけになる。 */
    condK: all('#dc-cond .dp-cond-l > span:not(.dp-cond-k):not(.dp-cond-s)'),
    /* ★#dc-sides に限定しない。2026-08-31 から、両方読めるときは
       ロゴ・社名・信頼度の札が**表の見出し行**に出る（カードは出ない）。
       器を問わず「2社の名前が1つずつ出ている」ことを見る（札は下の sideC）。
       （前はここに「人数」と書いていた。人数は 2026-10-11 から画面のどこにも出さない。） */
    sideN: all('#dc-root .dc-side-n'),
    /* ★選んだ機材の札。**社名のすぐ隣**に出ていることを見る ── 両側読めるとき
       カードは出ないので、表の見出しに添えていないと機材がどこにも出ない。 */
    sideF: all('#dc-root .dc-side-f'),
    sideC: all('#dc-root .dc-side-c'),
    cardsShown: !document.getElementById('dc-sides').hidden,
    kvK: all('#dc-sides .dc-kv-k'),
    kvV: all('#dc-sides .dc-kv-v'),
    /* 画面に出ている通貨記号の数。通貨を切り替えたとき「表だけ変わって
       どこかに古い通貨が残る」を捕まえる（カードが出ない配置になったので、
       器を名指しせず #dc-root 全体を数える）。 */
    yen: ((document.getElementById('dc-root').innerText.match(/¥/g) || []).length),
    usd: ((document.getElementById('dc-root').innerText.match(/\$/g) || []).length),
    sideEmpty: [...document.querySelectorAll('#dc-sides .dc-side')]
      .map((e) => (e.querySelector('.pt-empty') || {}).textContent || ''),
    /* ★4列目「見えた違い」は 2026-08-31 に列ごと廃止。差は**高いほうの値のセル**に
       .dc-dl で添える。d = 差の数値、side = どちらの列に付いたか、
       a/b = 差を除いた素の値（同じ表示かどうかをここで見る）。 */
    rows: [...document.querySelectorAll('#dc-diff .dc-tr:not(.dc-th)')].map((r) => {
      const bare = (e) => {
        if (!e) return '';
        const d = e.querySelector('.dc-dl');
        const n = e.querySelector('.dc-c-a');
        let x = e.textContent || '';
        if (d) x = x.replace(d.textContent, '');
        if (n) x = x.replace(n.textContent, '');
        return x.trim();
      };
      const da = (r.querySelector('.dc-c2 .dc-dl') || {}).textContent || '';
      const db = (r.querySelector('.dc-c3 .dc-dl') || {}).textContent || '';
      return {
        k: (r.querySelector('.dc-c1') || {}).textContent || '',
        a: bare(r.querySelector('.dc-c2')),
        b: bare(r.querySelector('.dc-c3')),
        d: (da || db).trim(),
        side: da ? 'a' : (db ? 'b' : '')
      };
    }),
    diffEmpty: t('#dc-diff .pt-empty'),
    bars: [...document.querySelectorAll('#dc-mix .dc-bar-row')]
      .map((r) => r.querySelectorAll('.dc-seg').length),
    barNone: cnt('#dc-mix .dc-bar--none'),
    leg: all('#dc-mix .dc-leg-i'),
    to: all('#dc-trade .dc-to-li'),
    toEnd: t('#dc-trade .dc-to-end'),
    ctaA: [...document.querySelectorAll('#dc-cta a')].map((a) => a.getAttribute('href')),
    ctaOff: [...document.querySelectorAll('#dc-cta button')].filter((b) => b.disabled).length,
    ctaOn: [...document.querySelectorAll('#dc-cta button')].filter((b) => !b.disabled).length,
    msg: t('#dc-sides .dp-msg'),
    ask: cnt('#dc-sides .dp-msg--ask'),
    lock: cnt('#dc-sides .dp-msg--lock'),
    pick: [...document.querySelectorAll('#dc-pick select')].map((s) => s.id),
    pickHidden: !!(document.getElementById('dc-pick') || {}).hidden,
    /* ★hidden 属性だけでは足りない。UA の [hidden]{display:none} は作者側の
       display:grid に負けるので、**属性は付いたまま画面には出ている**という
       壊れ方をする（実際にそうなっていた）。描かれた結果を見る。 */
    pickShown: (function () {
      const e = document.getElementById('dc-pick');
      return !!(e && getComputedStyle(e).display !== 'none');
    })(),
    rst: cnt('#dc-pk-rst'),
    /* ★欄ごとの「いま並んでいる選択肢」。空の1つ目（選択する）は落とす。
       約束は「選べる ＝ 必ず数字が返る」なので、ここが絞れているかが要。 */
    opt: (function () {
      const v = (id) => {
        const e = document.getElementById(id);
        return e ? [...e.options].map((o) => o.value).filter(Boolean) : null;
      };
      return { a: v('dc-pk-a'), b: v('dc-pk-b'), pos: v('dc-pk-pos'),
               fa: v('dc-pk-fa'), fb: v('dc-pk-fb') };
    })(),
    lowHidden: ['dc-diff', 'dc-mix', 'dc-trade', 'dc-cta']
      .filter((id) => !!(document.getElementById(id) || {}).hidden).length,
    /* 錠前の板。行は1行ずつ <p class="dp-msg-s">（2026-10-11。前は1つの <p> を <br> で
       割っていた）。cta ＝ 板の入口（ボタン）の行き先。どの板でも1本。
       todoH / todo ＝「まだ答えていない項目」の見出しと札（箱が無ければ todoH は null）。
       todoPrev ＝ その箱のすぐ上の行の字。warn ＝ 断りの字。warnAtCta ＝ 断りのすぐ次が
       ボタンであること。tags ＝ 板の中のタグの種類。★assert-deep-pay.mjs の lock と同じ形。 */
    lockBox: (function () {
      const m = document.querySelector('#dc-sides .dp-msg--lock');
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
    /* ぼかした影絵とその器（2026-10-11）。**閉じた画面にだけ**在る。
       blurred ＝ 本文（<main>）の中で、ぼかしが**実際に効いている**要素（計算後の値で見る。
       クラス名ではなく効き目を見るので、別の名前でぼかしを足した回にも鳴る）。
       ★assert-deep-pay.mjs の SNAP と同じ数え方。 */
    ghost: cnt('.dp-ghost'),
    stage: cnt('.dp-stage'),
    skel: cnt('#dc-sides .mr-skel'),
    blurred: [...document.querySelectorAll('main *')].filter((e) => {
      const cs = getComputedStyle(e);
      return (cs.filter && cs.filter !== 'none')
        || (cs.backdropFilter && cs.backdropFilter !== 'none');
    }).map((e) => String(e.className || e.tagName).split(' ')[0]),
    /* ★本文だけ（#dc-root）。人数の形の字を探すのはこちら ── body 全体には左メニューや
       ヘッダーの字も入っていて、あれはこの画面の本文ではない。
       （前はここに、左メニューの札「37 / 100人」を名指しで書いていた。あの札は
         2026-10-11 に外したので、いまは body にも無い ── それでも見るのは本文だけ。） */
    main: document.getElementById('dc-root').innerText,
    mainHtml: document.getElementById('dc-root').innerHTML,
    text: document.body.innerText
  };
};

/* ── 影絵が無いこと（2026-10-11）─────────────────────────────────────
   開いた・選ぶ前・片側が薄い・会社が足りない・読み込めなかった・読み込み中 ── 閉じていない
   画面には、影絵（.dp-ghost）もその器（.dp-stage）も**DOM に無く**、ぼかしの効いた要素も
   1つも無い。本物の値が出る画面にぼかした要素が1つでも在れば、それは「値をぼかして
   見せる」入口になる。★assert-deep-pay.mjs の noGhost と同じ本体。 */
const noGhost = (s) => s.ghost === 0 && s.stage === 0 && s.blurred.length === 0;
const ghostWhy = (s) => `影絵 ${s.ghost} / 器 ${s.stage} / ぼかしの効いた要素 ${s.blurred.join(',') || 'なし'}`;

/* ★手元でない住所（2026-10-12。§0 が使う）。試験用の口（compareOpen）は location.hostname が
     localhost / 127.0.0.1 のときにしか効かない ── それを実物で見るには、同じページを
     **別の名前の住所**から開くしかない。ブラウザの中でだけ、作り物の名前 NOT_LOCAL を
     この機械（確認用サーバ）へ向ける。外の網へは1バイトも出ない（.test は実在しない名前）。
     ポートは BASE から取る（番号を2か所に書かない）。 */
const NOT_LOCAL = 'pv-not-local.test';
const ALT = BASE.replace('localhost', () => NOT_LOCAL);
const browser = await puppeteer.launch({ headless: 'shell',
  args: ['--no-sandbox', '--host-resolver-rules=MAP ' + NOT_LOCAL + ' 127.0.0.1'] });
const jars = [];

const PK = { a: 'dc-pk-a', b: 'dc-pk-b', pos: 'dc-pk-pos',
             fltA: 'dc-pk-fa', fltB: 'dc-pk-fb' };
/* ★選択肢が生えるのを待ってから値を入れる。語彙 JSON と pv-airlines.json は
   RPC より遅れて着くので、待たずに入れると空文字が入って**静かに空振りする**。
   待ちは全部「条件が満たされるまで」── sleep で待つと混んだ回に嘘の赤が出る。 */
async function choose(page, sel, expect) {
  const want = {};
  for (const k of Object.keys(PK)) if (sel[k]) want[k] = sel[k];
  await page.waitForFunction((w2, ids) => Object.keys(w2).every(
    (k) => !!document.querySelector('#' + ids[k] + ' option[value="' + w2[k] + '"]')),
    { timeout: 20000 }, want, PK);
  const n = await page.evaluate(() => window.__rpcArgs.length);
  await page.evaluate((x, ids) => {
    for (const k of Object.keys(ids)) {
      const e = document.getElementById(ids[k]);
      if (e) e.value = x[k] || '';
    }
    document.getElementById('dc-pk-a').dispatchEvent(new Event('change', { bubbles: true }));
  }, sel, PK);
  await page.waitForFunction((m) => window.__rpcArgs.length === m
    && !document.getElementById('dc-pk-a').disabled, { timeout: 20000 }, n + expect);
}

/* 社名の辞書が着くまで待つ。
   ★「`.dp-msg` が出た」だけでは足りない（2026-09-06 に実際に踏んだ）──
     入口の「比べる2社を選んでください」も同じ `.dp-msg` で、**辞書が届く前から
     出ている**。deep-pay-compare.js の fewAir() は S.airs が空のうちは判定を
     保留する（「社名の辞書がまだ届いていないだけ」）ので、待たずに写すと
     **選択欄が出たままの途中の絵**を撮ってしまう。46本を並列で走らせた回に
     ここで嘘の赤が3本出た（単独では 259/0 で緑）。
   ★着いたかどうかは #dc-pick の data-sig の2つ目（S.airs.length）で分かる。
   ★「欄が消えた」ほうを待たないのは**わざと**。本当に壊れた回には待ちが
     時間切れになるだけで、下の検査がちゃんと赤くなる。 */
const airsIn = (page) => page.waitForFunction(() => {
  const b = document.getElementById('dc-pick');
  const g = b && b.getAttribute('data-sig');
  return !!g && Number(g.split('|')[1]) > 0;
}, { timeout: 20000 }).catch(() => {});

/* 描き終わるまで待つ（見出しが入り、骨組みが消える）。open() と、読み直したあとの両方で使う。
   ★器の名前は画面で違う（会社比較 #dc-hd / #dc-sides・概要 #dp-hd / #dp-kpi）。
     どちらの画面でも同じ待ち方ができるように、両方の名前で見る。
   ★assert-deep-pay.mjs の drawn と同じ本体。 */
async function drawn(page) {
  await page.waitForFunction(() => !!document.querySelector('#dp-hd h1, #dc-hd h1'), { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('#dp-kpi .mr-skel, #dc-sides .mr-skel'),
                             { timeout: 20000 });
}
/* ★返すのは { page, errs, reqs, navs }。reqs ＝ この窓が出そうとした通信の住所（止めたものも
     含めて全部）・navs ＝ いちばん外の枠が着いた住所（2026-10-11。§2f が「/rpc/ を1本も
     投げない」「よそへ運ばれない」を、窓の外から数えるのに使う。ほかの節は読まない）。
   ★7つ目の opt は、クラッカーの節（§2e）と §2f が使う。渡さなければ今までと1つも変わらない。
     jar    … 同じ入れ物（＝同じ保存領域）で続けて開く。渡した入れ物は呼んだ側が閉じる
              （jars には積まない）。印は端末の保存領域に在るので、「閉じた画面を見た人が
              あとで開く」を作るには、同じ入れ物で2枚開くしかない。
     file   … 開く画面（既定は deep-pay-compare.html。概要を同じ偽サーバで開くのに使う）。
     reduce … 「動きを減らす」設定を装う。
     first  … ページのどの script よりも先に流す関数と引数の組（[[fn, arg], …]）。
     tail   … 住所の後ろに付ける字（'?x=1#y' のように。§2f が「付けて来た字が残る」を見る）。
   ★2026-10-12、会社比較を閉じた。**渡さなければ、試験用の口の印を置いてから開く**
     （window.__PV_COMPARE_OPEN = true。手元の住所でだけ効く ── 冒頭の注）＝ ① から下の
     節は、今までと1行も変えずに「出した日に動く本体」を見ている。閉じた姿を見る §0 だけが、
     次の3つを使う ──
     shipped … true なら印を置かない ＝ **配っているファイルのまま**開く。
     flag    … 印に置く値を名指しする（true でない値では開かないことを見る）。
     closed  … 閉じた板が出るのを待つ（shipped のときは言わなくても待つ）。
     base    … 開く住所の頭（既定は BASE。手元でない住所 ALT から開くのに使う）。 */
async function open(lang, payload, theme, sel, expect, width, opt) {
  const o = opt || {};
  const jar = o.jar || await browser.createBrowserContext();
  if (!o.jar) jars.push(jar);
  const page = await jar.newPage();
  await page.setViewport({ width: width || 1360, height: 1200 });
  if (o.reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  for (const [fn, arg] of (o.first || [])) await page.evaluateOnNewDocument(fn, arg);
  const errs = [], reqs = [], navs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  page.on('framenavigated', (fr) => { if (fr === page.mainFrame()) navs.push(fr.url()); });
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = r.url();
    reqs.push(u);
    if (u.startsWith(BASE) || (o.base && u.startsWith(o.base))) return r.continue();
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
  /* ★試験用の口の印（上の注）。shipped のときだけ置かない。 */
  if (!o.shipped) {
    await page.evaluateOnNewDocument((v) => { window.__PV_COMPARE_OPEN = v; },
                                     ('flag' in o) ? o.flag : true);
  }
  await page.evaluateOnNewDocument(FAKE, payload);
  await page.goto((o.base || BASE) + (lang === 'en' ? '/en/' : '/') + (o.file || 'deep-pay-compare.html') + (o.tail || ''),
                  { waitUntil: 'domcontentloaded', timeout: 30000 });
  /* ★閉じた板を待つ回（§0）。見出しの器も骨組みも無い画面なので、drawn() では待てない。
       ⚠️ 時間切れでも投げない ── 板が出なかった回は、このあとの検査が「何が出たか」を字で言う。 */
  if (o.shipped || o.closed) {
    await page.waitForFunction(() => document.readyState === 'complete'
      && (!!document.querySelector('#dc-root .dc-closed') || !!document.querySelector('#dc-hd h1')),
      { timeout: 20000 }).catch(() => {});
    await page.waitForNetworkIdle({ idleTime: 400, timeout: 20000 }).catch(() => {});
    return { page, errs, reqs, navs };
  }
  /* ★__hold（答えを止めた見本）は待たない ── 骨組みが残っていることを見る筋書き。
     ★__anon（ログインしていない人）も待つ（2026-10-11）。前はログイン画面へ運ばれて
       この画面が消えるので待てなかった。いまはここに居たまま、板を描く。 */
  if (!(payload && payload.__hold)) await drawn(page);
  if (sel) await choose(page, sel, expect == null ? 2 : expect);
  return { page, errs, reqs, navs };
}

// ── 0. 会社比較は閉じている（2026-10-12・オーナー判断「会社比較はまだ出さないでよ」）──
/* ★★いま本番で出る姿。**配っているファイルのまま**（試験用の口の印を置かずに）開く。
   誰が来ても同じ ── ログインしていない人／まだ開いていない会員／開いている会員／運営。
   見るのは：
     板     … 器（#dc-root）の中は板1枚。字は題とリンクの2つだけ（オーナー指定。⓪ の CLOSED_T）。
              題は <h1>。リンクは1本で、その言語の DEEP PAY に解ける（本物のマウスで押すと着く）。
     出ない … 選ぶ欄・表・棒・トレードオフ・見出しの器・骨組み・錠前の板・影絵・紙吹雪・
              出し直しのお願い・全ページの Give → Get の板。数字も金額も1文字も無い。
              試験用の入口（PVDeepPayCompare）も生えていない。
     聞かない … rpc を**1本も**呼ばない（pv_deep_pay も、ほかの名前も。表も引かない）。窓の中の数
              （偽物が数えた呼び出し）と、窓の外の数（通信の住所に /rpc/ が無い）の両方で見る。
              ★この画面の HTML は、すぐ後ろで pv-pay-fix.js（出し直しのお願い）を読む。あちらは
                会員が居ると my_pay_reports を1回引く ── 閉じているあいだは、それも起こさない
                （deep-pay-compare.js が PV_SESSION を「誰も居ない」に置き換えてから終わる）。
     書かない … 保存領域が、ページの script が動く前と**1文字も変わらない**。書きに行った鍵は、
              ページの部品が前から書くもの（テーマ・英語ページの言語の控え）だけ。
     形     … 320 / 390 / 1440 × 明暗で、横スクロールが生えない・板が本文の中に収まる・
              題もリンクも切れない・リンクが押せる（何かの下に隠れていない）・字と面の色が違う。
   そのあと、試験用の口の実物（この検査の ① から下が、何を足場にしているか）：
     ・手元の住所で印を置くと、本体が動く ── 同じ見本の会員で rpc が**実際に出る**ことも、
       ここで確かめる（＝ 上の「聞かない」の網が空振りでない）
     ・手元で**ない**住所（ALT）では、印を置いても閉じたまま
     ・手元の住所でも、true でない印・住所の後ろの字・保存領域の字では開かない
   ⚠️ 窓は見終わったらすぐ閉じる（溜めると、この Mac では混んで嘘の赤が出る）。 */
/* 保存領域の見張り（assert-deep-pay.mjs の ANON_WATCH と同じ本体）。★ページのどの script よりも
   先に流す。ページの部品が自分で書く鍵を、書くはずの値で先に置いてから、中身をまるごと控える
   （__ls0）。書く・消すの呼び出しも、鍵の名前で全部控える（__writes）。 */
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
const CHROME_KEYS = ['local:pv-theme', 'local:pv-lang'];
const anonSeed = (lang, theme, more) =>
  Object.assign({ 'pv-theme': theme }, lang === 'en' ? { 'pv-lang': 'en' } : {}, more || {});
const wires = (reqs) => ({
  rpc: reqs.filter((u) => /\/rpc\//.test(u)),
  api: reqs.filter((u) => /supabase\.co|\/rest\/v1\/|\/auth\/v1\//.test(u)),
  login: reqs.filter((u) => /login\.html|signup\.html|auth-callback/.test(u)),
  give: reqs.filter((u) => /pv-give-first/.test(u)),
  odd: reqs.filter((u) => !u.startsWith(BASE)
    && !/^https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js|^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/|^https:\/\/www\.googletagmanager\.com\/gtag\/js/.test(u))
});
/* 閉じた画面に**在ってはいけないもの**（比較の器と部品・閉じた会員の板の部品・飾り）。 */
const CLOSED_PARTS = ['#dc-hd', '#dc-cond', '#dc-pick', '#dc-sides', '#dc-diff', '#dc-mix', '#dc-trade',
  '#dc-cta', '.dc-top', '.dc-main', 'main select', 'main option', 'main button', 'main input',
  '.dp-pick', '.dp-pick-s', '.dp-cond', '.dc-tbl', '.dc-tr', '.dc-bar', '.dc-bar-row', '.dc-seg',
  '.dc-leg-i', '.dc-to-li', '.dc-side', '.dc-kv', '.dc-logo', 'main .mr-skel', 'main .mr-card',
  '.dp-msg--lock', '.dp-msg--ask', '.dp-msg-s', '.dp-msg-w', '.dp-todo', '.dp-cta', '.pt-empty',
  '.dp-ghost', '.dp-stage', '.dp-pop', '#pv-pay-fix', '#mr-gate', '#pvgf-back', '.pvgf-back'];
/* 紙吹雪・影絵・器が**一瞬でも**出たかを、ページのどの script よりも先から数える。 */
const CLOSED_POP = function () {
  window.__flash = 0;
  new MutationObserver(() => {
    if (document.querySelector('.dp-pop, .dp-ghost, .dp-stage, #dc-root select, #dc-root .dc-tbl')) window.__flash++;
  }).observe(document, { childList: true, subtree: true });
};
const CLOSED_READ = async (parts, key) => {
  const root = document.getElementById('dc-root'), main = document.querySelector('main');
  const b = root && root.querySelector('.dc-closed');
  const h = b && b.querySelector('h1'), a = b && b.querySelector('a');
  let sess = 'threw', fix = 'none';
  try { sess = await window.PV_SESSION; } catch (e) {}
  try { if (window.PVPayFix) fix = await window.PVPayFix.ready; } catch (e) { fix = 'threw'; }
  return {
    url: location.pathname + location.search + location.hash,
    kids: root ? [...root.children].map((e) => e.className) : null,
    lines: main ? main.innerText.split('\n').map((x) => x.trim()).filter(Boolean) : null,
    title: h ? h.textContent : null, h1s: document.querySelectorAll('h1').length,
    go: a ? a.textContent.trim() : null, href: a ? a.getAttribute('href') : null,
    to: a ? (function () { const u = new URL(a.getAttribute('href'), location.href);
                           return u.pathname + u.search + u.hash; })() : null,
    extra: a ? [...a.attributes].map((x) => x.name).sort().join(' ') : null,
    press: main ? main.querySelectorAll('a, button, input, select, textarea, [tabindex], [onclick]').length : -1,
    parts: parts.filter((sel) => document.querySelectorAll(sel).length > 0),
    blurred: main ? [...main.querySelectorAll('*')].filter((e) => {
      const cs = getComputedStyle(e);
      return (cs.filter && cs.filter !== 'none') || (cs.backdropFilter && cs.backdropFilter !== 'none');
    }).length : -1,
    api: typeof window.PVDeepPayCompare,
    rpc: window.__rpc, args: window.__rpcArgs, from: window.__from,
    sess: sess, fix: fix,
    dump: window.__dump ? window.__dump() : null, ls0: window.__ls0 || null,
    writes: (window.__writes || []).slice(),
    mark: (function () { try { return localStorage.getItem(key); } catch (e) { return 'threw'; } })(),
    flash: window.__flash
  };
};
/* 形。★板・題・リンクの箱を測る。色は計算後の値（明暗でトークンが切り替わっていること）。 */
const CLOSED_FIT = () => {
  const de = document.documentElement;
  const b = document.querySelector('#dc-root .dc-closed');
  const h = b && b.querySelector('h1'), a = b && b.querySelector('a'), m = document.querySelector('main');
  if (!b || !h || !a || !m) return null;
  const rb = b.getBoundingClientRect(), rh = h.getBoundingClientRect(), ra = a.getBoundingClientRect();
  const rm = m.getBoundingClientRect();
  const top = document.elementFromPoint(ra.left + ra.width / 2, ra.top + ra.height / 2);
  const cb = getComputedStyle(b), ch = getComputedStyle(h), ca = getComputedStyle(a);
  return {
    over: de.scrollWidth - de.clientWidth,
    w: Math.round(rb.width * 10) / 10,
    inMain: rb.left >= rm.left - 0.5 && rb.right <= rm.right + 0.5 && rb.left >= 0 && rb.right <= innerWidth + 0.5,
    title: rh.left >= rb.left - 0.5 && rh.right <= rb.right + 0.5 && rh.top >= rb.top && h.scrollWidth <= h.clientWidth + 1,
    go: ra.left >= rb.left - 0.5 && ra.right <= rb.right + 0.5 && ra.top >= rh.bottom && ra.bottom <= rb.bottom + 0.5
      && a.scrollWidth <= a.clientWidth + 1,
    goH: Math.round(ra.height), hit: !!top && (top === a || a.contains(top)),
    seen: cb.visibility === 'visible' && cb.display !== 'none' && Number(cb.opacity) === 1 && rb.height > 40,
    bg: cb.backgroundColor, ink: ch.color, goInk: ca.color, goBg: ca.backgroundColor,
    px: [parseFloat(ch.fontSize), parseFloat(ca.fontSize)]
  };
};
/* 来る人の4通り。★どれも __wire 付き ＝ もし rpc を呼べば、窓の外の記録にも1本掛かる。 */
const CLOSED_WHO = [
  ['ログインしていない人', { __anon: true, __wire: true, air: AIR }],
  ['まだ開いていない会員', { __lock: true, __wire: true, air: AIR }],
  ['開いている会員',       { __wire: true, air: AIR }],
  ['運営',                 { __email: 'info@pilot-value.com', __wire: true, air: AIR }]
];
const CLOSED_MARK = 'pv_deep_was_locked';     // クラッカーの印の鍵（下の POP_KEY と同じ字）
{
  const bgOf = {};
  for (const lang of ['ja', 'en']) {
    const path = (lang === 'en' ? '/en/' : '/') + 'deep-pay-compare.html';
    const home = (lang === 'en' ? '/en/' : '/') + 'deep-pay.html';
    const W = CLOSED_T[lang];
    for (const [who, payload] of CLOSED_WHO) {
      for (const theme of ['light', 'dark']) {
        const tag = `${lang}/${theme}/${who}`;
        const { page, errs, reqs, navs } = await open(lang, payload, theme, null, null, null,
          { shipped: true, first: [[ANON_WATCH, anonSeed(lang, theme)], [CLOSED_POP, null]] });
        const r = await page.evaluate(CLOSED_READ, CLOSED_PARTS, CLOSED_MARK);
        const w = wires(reqs);

        // ── 板 ──
        ok(r.url === path && navs.length === 1 && navs[0] === BASE + path && w.login.length === 0,
           `${tag}: ★この住所に居たまま（よそへ運ばれない・ログイン画面へも送られない）`,
           `${r.url} / ${JSON.stringify(navs)}`);
        ok(Array.isArray(r.kids) && r.kids.join('|') === 'dp-msg dc-closed',
           `${tag}: ★★器（#dc-root）の中は、板1枚だけ`, JSON.stringify(r.kids));
        ok(r.title === W.title && r.go === W.go && Array.isArray(r.lines)
           && r.lines.join(' | ') === [W.title, W.go].join(' | ') && r.h1s === 1,
           `${tag}: ★★本文の字は、題とリンクの2つだけ（「${W.title}」／「${W.go}」。見出しは1つ）`,
           JSON.stringify(r.lines) + ' / h1 ' + r.h1s);
        ok(r.href === 'deep-pay.html' && r.to === home && r.press === 1 && r.extra === 'class href',
           `${tag}: ★★押せるものはリンク1本・行き先はその言語の DEEP PAY（${home}）`,
           `${r.href} → ${r.to} / 押せるもの ${r.press} / 属性 ${r.extra}`);

        // ── 出ない ──
        ok(r.parts.length === 0,
           `${tag}: ★★比較の器も部品も DOM に無い（選ぶ欄・表・棒・トレードオフ・骨組み・錠前の板・影絵・お願いの板）`,
           r.parts.join(' '));
        ok(r.blurred === 0 && r.flash === 0 && r.api === 'undefined',
           `${tag}: ★ぼかしの効いた要素が無い・影絵も紙吹雪も選ぶ欄も一瞬も出ていない・試験用の入口が生えていない`,
           `ぼかし ${r.blurred} / 途中で出た ${r.flash} / 入口 ${r.api}`);
        ok(!/[0-9０-９¥$€£]|万|%/.test((r.lines || ['0']).join(' ')) && !NOCOUNT.test((r.lines || []).join(' '))
           && !/null|undefined|NaN|\[object/.test((r.lines || ['null']).join(' ')),
           `${tag}: ★本文に数字も金額も人数も無い`, JSON.stringify(r.lines));

        // ── 聞かない ──
        ok(Object.keys(r.rpc || { x: 1 }).length === 0 && (r.args || [0]).length === 0 && r.from === 0,
           `${tag}: ★★rpc を1本も呼ばない（pv_deep_pay も、ほかの名前も。表も引かない）`,
           JSON.stringify(r.rpc) + ' / from ' + r.from);
        ok(w.rpc.length === 0 && w.api.length === 0,
           `${tag}: ★★窓の外から数えても、住所に /rpc/ の入った通信が0本（通信は全部で ${reqs.length} 本・サーバの API へも0本）`,
           w.rpc.concat(w.api).join(' '));
        ok(w.odd.length === 0 && w.give.length === 0
           && !reqs.some((u) => /pv-vocab\.json|pv-airlines\.json|airline-logos\//.test(u)),
           `${tag}: ★通信の行き先が増えていない・社名の辞書も語彙もロゴも取りに行かない`,
           w.odd.concat(w.give).join(' ') + reqs.filter((u) => /pv-vocab|pv-airlines\.json/.test(u)).join(' '));
        ok(r.sess === null && (r.fix === 0 || r.fix === 'none'),
           `${tag}: ★後ろで読まれる部品（出し直しのお願い）にも本人を渡していない（お願いは引かずに決着）`,
           `渡した値 ${JSON.stringify(r.sess)} / お願い ${r.fix}`);

        // ── 書かない ──
        ok(typeof r.ls0 === 'string' && r.dump === r.ls0,
           `${tag}: ★★保存領域が、ページの script が動く前と1文字も変わらない（localStorage も sessionStorage も）`,
           `前 ${r.ls0} / 後 ${r.dump}`);
        ok(r.writes.every((k) => CHROME_KEYS.includes(k)) && r.mark === null,
           `${tag}: ★★書きに行った鍵は、ページの部品が前から書くものだけ（クラッカーの印も、お願いの控えも、門の鍵も無い）`,
           [...new Set(r.writes)].join(' '));

        // ── 形 ──
        for (const vw of [320, 390, 1440]) {
          await sizeTo(page, vw, 900);
          const f = (await page.evaluate(CLOSED_FIT)) || {};
          ok(f.over <= 0, `${tag}/${vw}: ★★横スクロールが生えない`, `+${f.over}px`);
          ok(f.seen === true && f.inMain === true && f.title === true && f.go === true,
             `${tag}/${vw}: ★板が本文の中に収まる・題もリンクも板からはみ出さない・切れない`,
             JSON.stringify({ seen: f.seen, inMain: f.inMain, title: f.title, go: f.go, w: f.w }));
          ok(f.hit === true && f.goH >= 30 && f.goH <= 44,
             `${tag}/${vw}: ★リンクが押せる（上に何も乗っていない・1行のまま）`, `当たり=${f.hit} 高さ ${f.goH}px`);
          ok(f.ink !== f.bg && f.goInk !== f.goBg && f.px && f.px[0] >= 15 && f.px[1] >= 12,
             `${tag}/${vw}: 字と面の色が違う・字が小さすぎない`, JSON.stringify([f.ink, f.bg, f.goInk, f.goBg, f.px]));
          if (vw === 1440) {
            ok(f.w <= 520.5 && f.w >= 400, `${tag}/1440: ★広い画面でも板は小さいまま（帯にならない）`, `${f.w}px`);
            bgOf[lang + '/' + who + '/' + theme] = f.bg;
          }
        }
        if (theme === 'dark') {
          const a = bgOf[lang + '/' + who + '/light'], d = bgOf[lang + '/' + who + '/dark'];
          ok(!!a && !!d && a !== d, `${lang}/${who}: ★明暗で板の面の色が切り替わる（色はトークンのまま）`, `${a} / ${d}`);
        }

        // ── 何をしても変わらない ──
        if (theme === 'light') {
          const again = await page.evaluate(() => {
            const b = document.querySelector('#dc-root .dc-closed'), a = b && b.querySelector('a');
            if (a) a.focus();
            window.dispatchEvent(new Event('pv-currency-change'));
            window.dispatchEvent(new Event('pv-currency-change'));
            return { same: !!b && document.querySelector('#dc-root .dc-closed') === b
                       && document.getElementById('dc-root').children.length === 1,
                     focus: !!a && document.activeElement === a,
                     rpc: Object.keys(window.__rpc).length, kept: window.__dump() === window.__ls0 };
          });
          ok(again.same && again.focus && again.rpc === 0 && again.kept,
             `${tag}: ★通貨を切り替えても、板は同じ要素のまま・リンクに焦点が当たる・聞きに行かない・書かない`,
             JSON.stringify(again));
        }
        ok(errs.length === 0, `${tag}: JS のエラーが出ない`, errs.join(' / '));

        // ── 押すと着く（本物のマウスで。言語ごとに1回）──
        if (theme === 'light' && who === '開いている会員') {
          await sizeTo(page, 1360, 900);
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
            page.click('#dc-root .dc-closed a')
          ]);
          const landed = await page.evaluate(() => location.pathname);
          ok(landed === home, `${tag}: ★★リンクを押すと、その言語の DEEP PAY に着く`, landed);
        }
        await jars.pop().close().catch(() => {});
      }
    }
  }

  // ── 端末に前の印・前の控えが残っている人（日本語だけ）──
  {
    const tag = 'ja/前の印と控えが残っている会員';
    const seed = anonSeed('ja', 'light', { [CLOSED_MARK]: 'abc123', pv_pay_fix: '{"u":"x","t":1}' });
    const { page, errs, reqs } = await open('ja', { __wire: true, air: AIR }, 'light', null, null, null,
      { shipped: true, first: [[ANON_WATCH, seed], [CLOSED_POP, null]] });
    const r = await page.evaluate(CLOSED_READ, CLOSED_PARTS, CLOSED_MARK);
    ok(r.kids && r.kids.join('|') === 'dp-msg dc-closed' && r.mark === 'abc123' && r.dump === r.ls0
       && r.flash === 0 && !r.writes.some((k) => /was_locked|pv_pay_fix/.test(k)),
       `${tag}: ★★同じ板・クラッカーの印もお願いの控えも消さない・書き換えない・鳴らさない`,
       `印 ${JSON.stringify(r.mark)} / 触った鍵 ${[...new Set(r.writes)].join(' ')}`);
    ok(wires(reqs).rpc.length === 0 && Object.keys(r.rpc).length === 0 && errs.length === 0,
       `${tag}: 聞きに行かない・JS のエラーが出ない`, wires(reqs).rpc.join(' ') + errs.join(' / '));
    await jars.pop().close().catch(() => {});
  }

  // ── 試験用の口の実物 ──
  /* a) 手元の住所 ＋ 印（open() の既定）→ 本体が動く。同じ見本の会員で、rpc が実際に出る。 */
  {
    const tag = '試験用の口/手元の住所＋印';
    const { page, errs, reqs } = await open('ja', { __wire: true, air: AIR }, 'light');
    await page.waitForFunction(() => !!(window.PVPayFix && window.PVPayFix.ready), { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => window.PVPayFix && window.PVPayFix.ready).catch(() => {});
    await page.waitForNetworkIdle({ idleTime: 400, timeout: 20000 }).catch(() => {});
    const s = await page.evaluate(() => ({
      closed: document.querySelectorAll('.dc-closed').length, hd: !!document.querySelector('#dc-hd h1'),
      api: typeof window.PVDeepPayCompare, rpc: window.__rpc }));
    const w = wires(reqs);
    ok(s.closed === 0 && s.hd && s.api === 'object' && s.rpc.pv_deep_pay === 1,
       `${tag}: ★★本体が動く（板は出ない・見出しが入る・入口の1回を引く）＝ ① から下は本体を見ている`,
       JSON.stringify(s));
    ok(w.rpc.some((u) => /\/rpc\/pv_deep_pay$/.test(u)) && s.rpc.my_pay_reports === 1
       && w.rpc.some((u) => /\/rpc\/my_pay_reports$/.test(u)),
       `${tag}: ★（網の自己点検）開いた本体では、同じ見本の会員で pv_deep_pay と my_pay_reports が窓の外の記録に掛かる`,
       w.rpc.join(' ') || '（1本も掛かっていない）');
    ok(errs.length === 0, `${tag}: JS のエラーが出ない`, errs.join(' / '));
    await jars.pop().close().catch(() => {});
  }
  /* b) 手元でない住所 ＋ 印 → 閉じたまま（本番の住所では、印が在っても開かない、の実物）。 */
  for (const lang of ['ja', 'en']) {
    const tag = `試験用の口/${lang}/手元でない住所（${NOT_LOCAL}）＋印`;
    const { page, errs, reqs } = await open(lang, { __wire: true, air: AIR }, 'light', null, null, null,
      { base: ALT, closed: true, first: [[ANON_WATCH, anonSeed(lang, 'light')], [CLOSED_POP, null]] });
    const r = await page.evaluate(CLOSED_READ, CLOSED_PARTS, CLOSED_MARK);
    const host = await page.evaluate(() => [location.hostname, window.__PV_COMPARE_OPEN]);
    ok(host[0] === NOT_LOCAL && host[1] === true,
       `${tag}: （前置き）手元でない住所から開けている・印は置いてある`, JSON.stringify(host));
    ok(r.kids && r.kids.join('|') === 'dp-msg dc-closed' && r.title === CLOSED_T[lang].title
       && r.parts.length === 0 && r.api === 'undefined' && r.flash === 0,
       `${tag}: ★★印を置いても、閉じた板のまま（比較の部品も試験用の入口も無い）`,
       JSON.stringify(r.kids) + ' ' + r.parts.join(' ') + ' ' + r.api);
    ok(Object.keys(r.rpc || { x: 1 }).length === 0 && reqs.filter((u) => /\/rpc\//.test(u)).length === 0
       && r.dump === r.ls0 && errs.length === 0,
       `${tag}: ★★rpc を1本も呼ばない・保存領域が変わらない・JS のエラーが出ない`,
       JSON.stringify(r.rpc) + errs.join(' / '));
    await jars.pop().close().catch(() => {});
  }
  /* c) 手元の住所でも、true でない印・住所の後ろの字・保存領域の字では開かない。 */
  for (const [name, flag] of [['字の "true"', 'true'], ['数の 1', 1]]) {
    const tag = `試験用の口/手元の住所＋${name}＋住所の後ろの字＋保存領域の字`;
    const tail = '?__PV_COMPARE_OPEN=true&open=1&compare=open#open';
    const seed = anonSeed('ja', 'light', { __PV_COMPARE_OPEN: 'true', COMPARE_OPEN: 'true' });
    const { page, errs, reqs } = await open('ja', { __wire: true, air: AIR }, 'light', null, null, null,
      { flag, closed: true, tail, first: [[ANON_WATCH, seed], [CLOSED_POP, null]] });
    const r = await page.evaluate(CLOSED_READ, CLOSED_PARTS, CLOSED_MARK);
    ok(r.url === '/deep-pay-compare.html' + tail && r.kids && r.kids.join('|') === 'dp-msg dc-closed'
       && r.parts.length === 0 && r.api === 'undefined'
       && Object.keys(r.rpc || { x: 1 }).length === 0 && reqs.filter((u) => /\/rpc\//.test(u)).length === 0
       && r.dump === r.ls0 && errs.length === 0,
       `${tag}: ★★閉じた板のまま（開く口は「手元の住所で、印が true そのもの」の1つだけ）`,
       r.url + ' ' + JSON.stringify(r.kids) + ' ' + JSON.stringify(r.rpc) + errs.join(' / '));
    await jars.pop().close().catch(() => {});
  }
}

// ── 1. （欠番）ログインしていない人 → §2f ───────────────────────────
/* 2026-10-11 まで、ここは「未ログインはログイン画面へ送られる・戻り先が deep-pay-compare.html」を
   見ていた。オーナー判断で、送るのをやめた ── ログインしていない人にも、会員の閉じた画面と
   同じ「ぼかした影絵＋板」を出す。見張りは §2f（板・影絵・幅の物差しが §2b〜§2e に在るので、
   それより後ろに置いてある）。字面は ④-c。 */

// ── 2. 鍵が掛かっているとき ─────────────────────────────────────
{
  const { page, errs } = await open('ja', LOCK);
  const s = await page.evaluate(SNAP);
  ok(s.lock === 1 && s.ask === 0, '鍵の画面が出る', `lock=${s.lock} ask=${s.ask}`);
  ok(s.pickHidden === true && s.pickShown === false,
     '★鍵の画面ではピッカーを出さない（どれを選んでも答えが同じ欄を押させない）',
     `hidden=${s.pickHidden} 見えている=${s.pickShown}`);
  ok(s.rows.length === 0 && s.bars.length === 0 && s.leg.length === 0,
     '★鍵の画面に表も棒も凡例も出ない');
  ok(!/[¥$]\s?\d/.test(s.text), '★鍵の画面に金額が1つも出ない');
  /* ★板の後ろに、ぼかした影絵が在る（2026-10-11・オーナー判断）。上の「表も棒も凡例も
       出ない」は今もそのまま ── 影絵は字も数字も持たない形だけで、本物の表・棒・凡例の
       器（#dc-diff / #dc-mix）は畳んだまま。細かい筋書きは §2d。 */
  ok(s.ghost === 1 && s.stage === 1 && s.blurred.join(',') === 'dp-ghost' && s.lowHidden === 4,
     '★鍵の画面は、ぼかした影絵の手前に板（ぼかしが効いているのは影絵だけ・下の4枚は畳んだまま）',
     ghostWhy(s) + ' / 畳んだ数 ' + s.lowHidden);
  ok(s.args.length === 1 && s.args[0] === null,
     '★入口の1回だけ。しかも引数なし（区分を撃たない）', JSON.stringify(s.args));
  ok(errs.length === 0, '鍵の画面で JS のエラーが出ない', errs.join(' / '));
}

// ── 2b. 錠前の板の行は、閉じている理由どおりに出る（2026-10-11）──────
/* ★★ここはこの画面で**実際に在った不具合**の見張り。
   閉じている理由は3つ（鍵が無い／本人が答えきっていない／みんなの側＝100人が未達）。
   この画面は3つめの行を持っておらず、しかも「行が1つも無ければ内訳の行で埋める」
   になっていた ── 鍵も内訳もそろった人（止めているのは人数だけ）に
   「内訳（基本給・手当）まで書いた明細を1件出すと開きます」と出ていた。
   もう出している人に、もう一度出せと言っていたことになる。

   いまは deep-pay.js と同じ本体の lockLines() / lockHtml() が決める（④ が写しのずれを
   見ている）。表は assert-deep-pay.mjs の §2b と同じ ── **2つの画面で同じ表が通ること**が要。
   ★2つめの理由は 2026-10-11 に入れ替わった（オーナー判断）。前は「内訳が1つでもあるか」
     （gate.detailed）。いまは「自分に当てはまる項目をぜんぶ答えたか」（gate.ready）で、
     足りない人には残っている項目の一覧（gate.todo）が同じ板に出る。
     断り（虚偽・不正確な情報について）は、その行が出ているとき**だけ**ボタンの上に出る。
   ★全部 37 / 100 人のまま。crowd:true の行で100人の行が出たら、「contributors < goal」
     で出す形に戻っている（手動フラグで開けた日に、人数が理由でない人へ出てしまう）。
   ★期待する行き先は表に字で書く（式を写すと、式ごと間違えたときに通る）。
   ⚠️ 1通りずつ開き直す ── **わざと**。この節が見たいのは、サーバの答えを読み込む道
      （load → S.boot → shut）で門を読み違えないこと。同じ日に、閉じた画面を描き直す
      試験用の入口（PVDeepPayCompare.lock）を足したが、あれは読み込みの道を通らない。
      描き直しで回すのは、幅と明暗まで掛け合わせる §2d のほう。
      窓は見終わったらすぐ閉じる（溜めると、この Mac では混んで嘘の赤が出る）。 */
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
/* 残りの一覧の見本（作り物）。2026年9月分・6項目。並びはサーバが返す順。 */
const TODO6 = { year: 2026, month: 9,
                items: ['command', 'bonus', 'profit', 'duty_h', 'duty_days', 'instructor'] };
const TODO6_NAMES = {
  ja: ['職位手当', '年間ボーナス', 'プロフィットシェア（年額）', '勤務時間（Duty time）',
       '乗務日数（月）', '教官・訓練担当の手当'],
  en: ['Rank / position allowance', 'Annual bonus', 'Profit share (annual)', 'Duty time',
       'Duty days (month)', 'Instructor / Training allowance']
};
/* [名前, 門, 出る行, ボタンの行き先, 一覧が出るか]
   ★頭の6つがオーナー指定の表（日英とも開く）。残りは組み合わせ（日本語だけ）。
     assert-deep-pay.mjs の LOCK_CASES と同じ表。 */
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
  /* ready を返さない古いサーバ（db/deep-pay.sql を貼る前）。前の鍵 detailed が来ても読まない。 */
  ['古いサーバ（ready が来ない）',
   { key: true,  detailed: true,            crowd: true  }, ['ready'], 'pay-report.html#pay-detail', false],
  // ── ここから組み合わせ（日本語だけ）──
  ['3つとも（鍵・答え・100人）',
   { key: false, ready: false, todo: TODO6, crowd: false }, ['key', 'ready', 'goal'], 'pay-report.html', true],
  ['答えと100人',
   { key: true,  ready: false, todo: TODO6, crowd: false }, ['ready', 'goal'], 'pay-report.html#pay-detail', true],
  ['鍵と100人',
   { key: false, ready: true,  todo: null,  crowd: false }, ['key', 'goal'], 'pay-report.html#ps', false],
  /* 鍵も答えもそろっていて、crowd が来ない。理由が分からないので行を出さない。
     **別の行で埋めない**（直した不具合そのもの）。断りも出さない。 */
  ['理由が分からない（crowd が来ない）',
   { key: true,  ready: true,  todo: null }, [], 'pay-report.html', false]
];
const LOCK_TAGS = ['a', 'div', 'li', 'p', 'path', 'rect', 'svg', 'ul'];
for (const lang of ['ja', 'en']) {
  const cases = lang === 'ja' ? LOCK_CASES : LOCK_CASES.slice(0, 6);
  for (const [name, gate, want, href, list] of cases) {
    const g = Object.assign({ contributors: 37, goal: 100 }, gate);
    const { page, errs } = await open(lang, { __gate: g, air: AIR });
    const s = await page.evaluate(SNAP);
    const b = s.lockBox;
    const exp = want.map((k) => LK[lang][k]);
    ok(b.on && b.lines.join(' | ') === exp.join(' | '),
       `${lang}: ★★錠前の行 ──「${name}」は ${want.length ? want.join('＋') : '行なし'}`,
       `今 ${JSON.stringify(b.lines)}`);
    const rest = s.main.split(LK[lang].goal).join('');
    ok(!NOCOUNT.test(rest), `${lang}: ★「${name}」── 100人の行のほかに人数が出ない`, countIn(rest));
    /* ★どの板にもボタンが必ず1本在る（門の組み合わせで消えない）。 */
    ok(b.cta.join(',') === href && s.pickShown === false && !/[¥$€£]\s?\d|万/.test(s.main),
       `${lang}: ★「${name}」── 入口は1本・行き先は ${href}・選択欄も金額も出ない`,
       b.cta.join(','));
    /* ★断りは「答えきっていない」の行と必ず一緒。置き場所はボタンのすぐ上。 */
    const asks = want.includes('ready');
    ok(asks ? (b.warn.join('|') === LK[lang].warn && b.warnAtCta)
            : (b.warn.length === 0 && !s.main.includes(LK[lang].warn)),
       `${lang}: ★「${name}」── 断りは${asks ? 'ボタンのすぐ上に1つ出る' : '出ない'}`,
       JSON.stringify(b.warn) + ' / ' + b.kids.join(' > '));
    /* ★残りの一覧。出るときは「答えきっていない」の行のすぐ下・届いた順・字のとおり。 */
    ok(list ? (b.todoH === LK[lang].head
               && b.todo.join(' | ') === TODO6_NAMES[lang].join(' | ')
               && b.todoPrev === LK[lang].ready)
            : (b.todoH === null && b.todo.length === 0),
       `${lang}: ★「${name}」── 残りの一覧は${list ? '行のすぐ下に、届いた順で出る' : '箱ごと出ない'}`,
       JSON.stringify([b.todoH, b.todo, b.todoPrev]));
    ok(b.tags.every((t) => LOCK_TAGS.includes(t)) && !/null|undefined|NaN|\[object/.test(b.text)
       && errs.length === 0,
       `${lang}: 「${name}」── 板に余計なタグも null も無い・JS のエラーが出ない`,
       b.tags.join(' ') + ' ' + errs.join(' / '));
    /* ★本物の読み込みを通った錠前は、どの理由でも影絵の手前に出る（2026-10-11）。 */
    ok(s.ghost === 1 && s.stage === 1 && s.blurred.join(',') === 'dp-ghost',
       `${lang}: ★「${name}」── 板の後ろに影絵が1つ（ぼかしが効いているのは影絵だけ）`, ghostWhy(s));
    await jars.pop().close().catch(() => {});
  }
}

// ── 2c. 「まだ答えていない項目」の一覧 ── 知らないコード・幅・明暗（2026-10-11）──
/* 一覧を組むのは deep-pay.js と同じ本体（lockTodo。④）で、細かい筋書き（月の見出し・
   空の箱・年月の欄の字）は assert-deep-pay.mjs の §2c が1枚の窓で回している。
   ここは**この画面の器（#dc-sides）で**同じ板がちゃんと出ることを見る ──
     ① 18項目が届いた順に出る／知らないコードと HTML の形をした字は出ない
     ② 320 / 390 / 1440 で横に溢れない・札が切れない（この画面は器も CSS も別）
     ③ 暗い面でも字が読める
   ★見た目は deep-pay.css の .dp-todo*。この画面の CSS（deep-pay-compare.css）には
     書いていない ── 書くと2つの画面で板の見た目がずれる。 */
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
/* 知らないコードと、HTML の形をした字を**あいだに混ぜる**。出てよいのは18個だけ。 */
const MIXED = ['zzz_new_item', '<img src=x onerror="window.__xss=1">'].concat(ALL18.slice(0, 9),
  ['<script>window.__xss=1</script>', 'constructor', '__proto__', 42, null], ALL18.slice(9), ['<b>bonus</b>']);
/* ★この関数は assert-deep-pay.mjs の LOCK_FIT と同じ本体。片方だけ緩めない。 */
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
    const g = { key: true, ready: false, todo: { year: 2026, month: 9, items: MIXED },
                crowd: false, contributors: 37, goal: 100 };
    const { page, errs } = await open(lang, { __gate: g, air: AIR }, theme);
    const tag = `${lang}/${theme}`;
    if (theme === 'light') {
      const s = await page.evaluate(SNAP);
      const b = s.lockBox;
      ok(b.todoH === LK[lang].head && b.todo.join(' | ') === ALL18_NAMES[lang].join(' | '),
         `${tag}: ★★18項目が届いた順に出る・知らないコードは行ごと出ない`, JSON.stringify(b.todo));
      ok(b.tags.every((t) => LOCK_TAGS.includes(t)) && !/<img|<script|<b>|onerror/i.test(b.raw)
         && !/zzz_new_item|constructor|__proto__|onerror|__xss|\[object/.test(b.text)
         && (await page.evaluate(() => window.__xss)) === undefined,
         `${tag}: ★★HTML の形をしたコードがタグとして入らない・字としても出ない`, b.tags.join(' '));
      ok(b.lines.join(' | ') === [LK[lang].ready, LK[lang].goal].join(' | ') && b.todoPrev === LK[lang].ready
         && b.warn.join('|') === LK[lang].warn && b.warnAtCta
         && b.kids.join(' ') === 'dp-msg-t dp-msg-s dp-todo dp-msg-s dp-msg-w dp-cta',
         `${tag}: ★板の並びは 見出し → 答えの行 → 一覧 → 100人の行 → 断り → ボタン（下に注記は置かない）`,
         b.kids.join(' > '));
    }
    /* 幅は明るいほうで3つ・暗いほうは色だけ見ればよいので1つ（窓を増やさない）。 */
    for (const w of (theme === 'light' ? [320, 390, 1440] : [390])) {
      await page.setViewport({ width: w, height: 1000 });
      await page.waitForFunction((x) => innerWidth === x, { timeout: 10000 }, w);
      const f = await page.evaluate(LOCK_FIT);
      ok(!!f && f.chips === 18 && f.over <= 1 && f.out.length === 0,
         `${tag}/${w}: ★一覧つきの板が横に溢れない（18項目）`,
         f ? `文書 +${f.over}px / 外へ出た ${f.out.slice(0, 4).join(' ｜ ')}` : '板が無い');
      ok(!!f && f.cut.length === 0 && f.lap === 0,
         `${tag}/${w}: ★札も行も切れていない・札どうしが重なっていない`,
         f ? `切れ ${f.cut.join(' ｜ ')} / 重なり ${f.lap}` : '');
      if (w === 1440)
        ok(!!f && f.rows <= 6, `${tag}/${w}: 広い画面では札が横に並んで折り返す（18枚が ${f && f.rows} 段）`);
    }
    const c = (await page.evaluate(LOCK_FIT) || { con: {} }).con;
    ok(['line', 'head', 'chip', 'warn', 'title'].every((k) => c[k] != null && c[k] >= 4.5),
       `${tag}: ★行・見出し・札・断りの字が、下の面から読める（コントラスト比 4.5 以上）`,
       JSON.stringify(c));
    ok(errs.length === 0, `${tag}: 一覧つきの板で JS のエラーが出ない`, errs.join(' / '));
    await jars.pop().close().catch(() => {});
  }
}

// ── 2d. ぼかした影絵と、その手前の板（2026-10-11・オーナー判断）──────────────
/* 「DEEP PAY でまだ開かない人には給与詳細を提出させる。背景にはぼかした DEEP PAY を
     表示させる。」── この画面も、閉じているときは影絵（.dp-ghost）の手前に板を出す。
   影絵の中身だけがこの画面のもの（選ぶ欄5つ・2社の表・棒2本・トレードオフ）で、
   器・ぼかし・板は deep-pay.js / deep-pay.css と同じ本体（④）。

   ★★ぼかしは隠す道具ではない（開発者ツールで誰でも外せる）。だからここが見るのは
     「ぼかしが強いか」ではなく、**ぼかしの下に、見られて困るものが何も無いこと**。
     ぼかしを無視して（textContent と innerHTML で）見る。

   見方は assert-deep-pay.mjs の §2e と同じ（物差しの GHOST_FIT / ghostBad / tabWalk /
   navStill はあちらと**同じ本体**。片方だけ緩めない）── 閉じている理由の11通り
   （§2b の LOCK_CASES）＋ いちばん長い板 × 日英 × 明暗 × 320 / 390 / 1440 で、
   在る・触れない・ぼかし・空・板・押せる・収まる・読める の8つ。
   ★理由と幅は、試験用の入口 PVDeepPayCompare.lock() で**同じ窓のまま**描き直す
     （§2b は本物の読み込みで1通りずつ開いている。ここまで開き直すと、この Mac では
       混んで嘘の赤が出る）。本物の読み込みを通った錠前に影絵が出ることは §2・§2b が見ている。
   ⚠️ 時間で待たない。 */
/* ★ここから ghostBad までは assert-deep-pay.mjs の §2e と**同じ本体**。片方だけ緩めない。 */
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
   ★ここから placeAt までも、assert-deep-pay.mjs の §2e と**同じ本体**。片方だけ緩めない。
   それまで板は見出しのすぐ下に寄せてあった（この検査も「器の上から 40px 以内」を見ていた）。
   いまは、広い画面では**窓の縦の真ん中あたり**に置く。決まりは3つ：
     ① 収まるとき ── 板の真ん中が、窓の高さの MID（43〜49%）に在る。狙いは 46%
        （deep-pay.css の .dp-stage の「真ん中に置くための段」）。**器ではなく窓に対して測る。**
        帯に幅があるのは、器の上の端（ヘッダー＋見出しの高さ）が画面と幅で 131〜154px と
        違うのを、CSS が1つの数（142px）で受けているから（狙いから ±12px ＝ 窓 760px で ±1.6%）。
        ★この画面は見出しの塊が概要より 15px 高いので、板も同じだけ下に来る（47% 台）。
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
/* 入口の答え（閉じている）を、門だけ替えて作る。本物と同じ形 ── 数字は1つも入っていない。 */
const bootWith = (gate) => ({ ok: true, state: 'locked', give: { detailed: false },
  stats: { reports: 58, month: 12, airlines: 19, contributors: 37 }, gate: gate });
/* 毒入り。閉じた答えに、本物らしい数字が紛れて来た形（FAKE の __poison と同じ値）。
   ★門は「鍵は在るが答えきっていない・一覧なし・みんなの側は開いている」＝板に数字が
     ほとんど出ない形（出るのは「…か 0 で答えます。」の 0 だけ）。 */
const POISON_GATE = { key: true, ready: false, todo: null, crowd: true, contributors: 37, goal: 100 };
const POISON_PARTS = {
  cohort: { level: 'selected', manual: true, airline: 'ana', pos: 'cap', fleet: 'b787', trust: 'high' },
  head: { annual_usd: 119700, per_block_usd: 102.5, fixed_pct: 62 },
  comp: { segs: [{ k: 'base', pct: 52, med_usd: 4800 }, { k: 'variable', pct: 24, med_usd: 2200 },
                 { k: 'perdiem', pct: 7, med_usd: 640 }], bonus: { pct_of_annual: 5 } },
  work: { block_h: 74.5, duty_h: 141.5, stay_nights: 9 },
  var: [{ k: 'block', pct: 46 }, { k: 'sector', pct: 21 }]
};
/* 開いた画面を描き直すための、1社ぶんの答え（FAKE の side() と同じ形）。 */
const sideOf = (f) => ({ state: 'open', stats: {}, gate: { key: true, ready: true, crowd: true },
  cohort: { level: 'selected', manual: true, trust: f.trust },
  head: { annual_usd: f.annual, per_block_usd: f.pbh, fixed_pct: f.fixed },
  comp: { segs: f.segs, bonus: f.bonus == null ? null : { pct_of_annual: f.bonus } },
  work: { block_h: f.block, stay_nights: f.stay } });
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
      const cases = LOCK_CASES.map(([name, gate]) => [name, gate])
        .concat([['18項目ぜんぶ＋100人', { key: true, ready: false, crowd: false,
                                            todo: { year: 2026, month: 9, items: ALL18 } }]]);
      for (const [name, gate] of cases) {
        const g = Object.assign({ contributors: 37, goal: 100 }, gate);
        await page.evaluate((p) => window.PVDeepPayCompare.lock(p), bootWith(g));
        const fit = await page.evaluate(GHOST_FIT);
        const c = (await page.evaluate(LOCK_FIT)) || { out: ['板が無い'], cut: [], con: {} };
        const b = ghostBad(fit, c, w);
        for (const k of Object.keys(b)) bad[k].push(`「${name}」${b[k]}`);
      }
      for (const [k, label] of GHOST_KINDS)
        ok(bad[k].length === 0, `${tag}/${w}: ${label}（${cases.length}通り）`,
           bad[k].slice(0, 3).join(' ｜ '));
    }

    /* キーボード。Tab で一周して、影絵の中に1度も焦点が入らない・板のボタンには届く。 */
    await page.evaluate((p) => window.PVDeepPayCompare.lock(p),
      bootWith({ key: true, ready: false, todo: TODO6, crowd: false, contributors: 37, goal: 100 }));
    const walk = await tabWalk(page);
    ok(walk.filter((x) => !x.body).length >= 8 && walk.some((x) => x.cta) && !walk.some((x) => x.ghost),
       `${tag}: ★★Tab で一周しても影絵には入らない・板のボタンには届く（焦点が当たったのは ${walk.filter((x) => !x.body).length} か所）`,
       `ボタンに届いた=${walk.some((x) => x.cta)} 影絵に入った=${walk.some((x) => x.ghost)}`);

    if (theme === 'light') {
      /* 焦点が外れない。同じ答えで描き直しても（通貨の切替でも）、器ごと作り直さない。 */
      const B1 = bootWith({ key: true, ready: false, todo: TODO6, crowd: false, contributors: 37, goal: 100 });
      await page.evaluate((p) => window.PVDeepPayCompare.lock(p), B1);
      const kept = await page.evaluate((p) => {
        const a = document.querySelector('.dp-stage a.dp-cta');
        const st = document.querySelector('.dp-stage'), gh = document.querySelector('.dp-ghost');
        a.focus();
        window.PVDeepPayCompare.lock(p);
        window.dispatchEvent(new Event('pv-currency-change'));
        return { a: document.querySelector('.dp-stage a.dp-cta') === a,
                 st: document.querySelector('.dp-stage') === st,
                 gh: document.querySelector('.dp-ghost') === gh,
                 focus: document.activeElement === a };
      }, B1);
      ok(kept.a && kept.st && kept.gh && kept.focus,
         `${tag}: ★同じ答えで描き直しても、器（影絵＋板）を作り直さない・ボタンの焦点が外れない`,
         JSON.stringify(kept));
      const g0 = await page.evaluate(() => document.querySelector('.dp-ghost').outerHTML);
      await page.evaluate((p) => window.PVDeepPayCompare.lock(p),
        bootWith({ key: false, ready: true, todo: null, crowd: true, contributors: 37, goal: 100 }));
      const swapped = await page.evaluate(SNAP);
      const g1 = await page.evaluate(() => document.querySelector('.dp-ghost').outerHTML);
      ok(swapped.lockBox.lines.join('|') === LK[lang].key && swapped.ghost === 1,
         `${tag}: ★門が変われば板は組み直す（影絵は1つのまま）`, JSON.stringify(swapped.lockBox.lines));
      ok(g0 === g1 && g0.length > 400,
         `${tag}: ★★影絵は門が変わっても1文字も変わらない（答えから作っていない固定の絵）`,
         `長さ ${g0.length} → ${g1.length}`);

      /* 毒入り（描き直しの入口で）。閉じた答えに数字が紛れて来ても、1文字も描かない。 */
      await page.evaluate((p) => window.PVDeepPayCompare.lock(p), bootWith(POISON_GATE));
      const clean = await page.evaluate(SNAP);
      await page.evaluate((p) => window.PVDeepPayCompare.lock(p),
        Object.assign(bootWith(POISON_GATE), POISON_PARTS));
      const poi = await page.evaluate(SNAP);
      ok(poi.mainHtml === clean.mainHtml && poi.main === clean.main && poi.ghost === 1,
         `${tag}: ★★閉じた答えに本物らしい数字が紛れて来ても、画面は1文字も変わらない（影絵にも板にも出ない）`,
         `DOM が同じ=${poi.mainHtml === clean.mainHtml} / 本文が同じ=${poi.main === clean.main}`);
      const marks = ['119700', '119,700', '1,903', '120K', '102.5', '16,300', '4800', '4,800',
                     '760,000', '2200', '74.5', '141.5', '%', '¥', '$', '€', '万'];
      const leak = marks.filter((x) => poi.mainHtml.includes(x));
      const ghostText = await page.evaluate(() => document.querySelector('.dp-ghost').textContent);
      ok(leak.length === 0 && ghostText === '' && poi.rows.length === 0 && poi.kvV.length === 0
         && poi.lowHidden === 4 && poi.pickShown === false,
         `${tag}: ★★毒の値が HTML のどこにも入っていない・影絵は空のまま・表も欄も出ない`,
         leak.join(' ') + ' / ' + JSON.stringify(ghostText.slice(0, 30)));

      /* 閉じた → 開いた。影絵は跡形もなく消える（描き直しの入口で切り替える）。 */
      /* ★この窓は閉じた板を描いてきたので、開いた瞬間にクラッカーが1回鳴る（2026-10-11。
           筋書きは §2e）。紙吹雪の器（.dp-pop）が**出ている最中にも**、影絵とぼかしの効いた
           要素が無いことを見る ── 描き直しと同じ evaluate の中で数える（器は約 2.8 秒で
           片づくので、あとから見に行くと、混んだ回にはもう無い）。 */
      const popped = await page.evaluate((a, b) => {
        window.PVDeepPayCompare.render(a, b, { a: 'ana', b: 'jal' });
        const blur = (root) => !root ? 0 : [...root.querySelectorAll('*')].filter((e) => {
          const c = getComputedStyle(e);
          return (c.filter && c.filter !== 'none') || (c.backdropFilter && c.backdropFilter !== 'none');
        }).length;
        const lay = document.querySelector('.dp-pop');
        return { pop: document.querySelectorAll('.dp-pop').length,
                 papers: lay ? lay.querySelectorAll('.dp-pop-p').length : 0,
                 blur: blur(document.querySelector('main')) + blur(lay),
                 ghost: document.querySelectorAll('.dp-ghost, .dp-stage').length };
      }, sideOf(AIR.ana), sideOf(AIR.jal));
      const opened = await page.evaluate(SNAP);
      ok(noGhost(opened) && opened.lock === 0 && opened.rows.length === 9,
         `${tag}: ★★閉じた → 開いた で、影絵も器も DOM から消える（ぼかしの効いた要素が残らない）`,
         ghostWhy(opened) + ' / 行 ' + opened.rows.length);
      ok(popped.pop === 1 && popped.papers >= 60 && popped.blur === 0 && popped.ghost === 0,
         `${tag}: ★★その瞬間、紙吹雪の器が1つ出ている ── その最中にも、影絵とぼかしの効いた要素が無い（本文にも器にも）`,
         `器 ${popped.pop} / 紙 ${popped.papers} / ぼかし ${popped.blur} / 影絵 ${popped.ghost}`);
      await page.evaluate((p) => window.PVDeepPayCompare.lock(p), bootWith(POISON_GATE));
      const shutAgain = await page.evaluate(SNAP);
      ok(shutAgain.ghost === 1 && shutAgain.stage === 1 && shutAgain.lock === 1
         && shutAgain.rows.length === 0 && shutAgain.lowHidden === 4,
         `${tag}: 開いた → 閉じた で、影絵と板が戻り、表は跡形もなく消える`,
         ghostWhy(shutAgain) + ' / 行 ' + shutAgain.rows.length);
    }

    /* ── 縦の置き場所。窓の高さを変えて測る（決まりと見方は、上の「板の縦の置き場所」と
       placeAt）。板は高さの違う3つ ── 100人だけ（1行）／答えと100人（2行）／一覧つき。
       収まらない板は、3行＋18項目。 ── */
    {
      const draw = (gate) => () => page.evaluate((p) => window.PVDeepPayCompare.lock(p),
        bootWith(Object.assign({ contributors: 37, goal: 100 }, gate)));
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
   上は描き直しの入口。ここは**サーバの答えとして**毒が来た形（FAKE の __poison）を、
   ページを開くところから通す。開いたあと、毒の無い答えで描き直しても1文字も
   変わらないこと ＝ 読み込みの道でも、紛れて来た数字をどこにも描いていない。 */
for (const lang of ['ja', 'en']) {
  const { page, errs } = await open(lang, { __gate: POISON_GATE, __poison: true, air: AIR });
  const poi = await page.evaluate(SNAP);
  await page.evaluate((p) => window.PVDeepPayCompare.lock(p), bootWith(POISON_GATE));
  const clean = await page.evaluate(SNAP);
  ok(poi.lock === 1 && poi.ghost === 1 && poi.mainHtml === clean.mainHtml,
     `${lang}: ★★サーバが閉じた答えに数字を混ぜて返しても、画面は毒の無い答えと1文字も違わない`,
     `板 ${poi.lock} / 影絵 ${poi.ghost} / DOM が同じ=${poi.mainHtml === clean.mainHtml}`);
  ok(!/[¥$€£]\s?\d|万|%/.test(poi.main) && poi.rows.length === 0 && errs.length === 0,
     `${lang}: ★毒入りの錠前に金額も割合も出ない・JS のエラーが出ない`,
     (poi.main.match(/[^\n]*[¥$€£万%][^\n]*/) || [''])[0] + errs.join(' / '));
  await jars.pop().close().catch(() => {});
}

/* ── 読み込み中（最初の答えがまだ来ていない）──────────────────────────
   この画面は前から、答えが来るまで骨組みのまま待つ（render() の load）。そこへ錠前の板や
   影絵が出るようになっていないことを見る ── 開いている人の画面が、霞んでから開かない。
   ⚠️ 時間で待たない。辞書が着いたことは #dc-pick の data-sig（2つ目＝会社の数）で分かる。 */
{
  const { page, errs } = await open('ja', { air: AIR, __hold: true });
  await page.evaluate(() => { window.__sawGhost = 0;
    new MutationObserver(() => { if (document.querySelector('.dp-ghost, .dp-stage')) window.__sawGhost++; })
      .observe(document.getElementById('dc-root'), { childList: true, subtree: true }); });
  await page.waitForFunction(() => {
    const g = (document.getElementById('dc-pick') || { getAttribute: () => '' }).getAttribute('data-sig');
    return !!g && Number(g.split('|')[1]) > 0 && typeof window.__release === 'function';
  }, { timeout: 20000 });
  const mid = await page.evaluate(SNAP);
  ok(mid.skel === 1 && mid.lock === 0 && noGhost(mid),
     '★★読み込みのあいだは骨組みのまま（錠前の板も影絵も出さない）',
     `骨組み ${mid.skel} / 板 ${mid.lock} / ${ghostWhy(mid)}`);
  await page.evaluate(() => window.__release());
  await page.waitForFunction(() => !document.querySelector('#dc-sides .mr-skel'), { timeout: 20000 });
  const aft = await page.evaluate(SNAP);
  ok(aft.ask === 1 && aft.lock === 0 && noGhost(aft)
     && (await page.evaluate(() => window.__sawGhost)) === 0,
     '★★答えが来たら開いた画面になる（開いている人に、板も影絵も1度も出ていない）',
     ghostWhy(aft) + ' / 途中で出た回数 ' + (await page.evaluate(() => window.__sawGhost)));
  ok(errs.length === 0, '読み込み中の画面で JS のエラーが出ない', errs.join(' / '));
  await jars.pop().close().catch(() => {});
}

// ── 2e. 開いた瞬間のクラッカー（2026-10-11・オーナー指示）──────────────────
/* 閉じた板を見ていた会員が給与の詳細を出して、画面が開いたら「クラッカーならしてね」。
   紙吹雪を**1回だけ**飛ばす。字面は上の ④-b。ここは実物で見る ── 日英で同じ筋書き：
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
    /* 画面に出ている「押せるもの」。ヘッダーのボタン・ロゴ・左メニュー・選ぶ欄。 */
    const ctl = ['#theme-toggle', '.mr-brand', 'nav.mr-side a.mr-side-a', '.dp-pick-s', '#pv-ham-btn']
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
/* この画面の出し方。★閉じた板は試験用の入口 lock()・開いた画面は render() で描き直す
   （render は mode を開いた側へ倒すだけ。2社を渡さないので、出るのは「選んでください」の板）。
   もう片方の画面（概要）も、同じ偽サーバのまま開ける ── 入口の1回は引数なしで、
   開いた答えがそのまま返る。 */
const POP_LOCK = LOCK, POP_OPEN = OK, POP_ERR = { __err: true, air: AIR };
const POP_OTHER = 'deep-pay.html';
const popAt = (lang, payload, opt) => open(lang, payload, 'light', null, null, null, opt);
const popLock = (page) => page.evaluate((g) => window.PVDeepPayCompare.lock({ gate: g }),
  { key: true, ready: false, todo: null, crowd: true, contributors: 37, goal: 100 });
const popOpen = (page) => page.evaluate(() => window.PVDeepPayCompare.render(null, null));
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
  await popLock(B);
  const O = await at(POP_OPEN, { file: POP_OTHER });
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

// ── 2f. ログインしていない人（2026-10-11・オーナー判断）──────────────────────
/* 前は、ログインしていない人がここへ来るとログイン画面へ送っていた（前の §1）。いまは
   送らない ── 「会員で、まだ開いていない人」と**同じ画面**（ぼかした影絵＋板）を出す。
   字面は ④-c。筋書きは assert-deep-pay.mjs の §2g と同じ（物差しの ANON_WATCH / ANON_READ /
   wires / anonSettled はあちらと**同じ本体**。片方だけ緩めない）── この画面の器（#dc-sides）で：

     居る   … 住所が変わらない（付けて来た ?… と #… も残る）・着いたのは1回だけ
     同じ板 … 「鍵が無く、答えきってもいない」会員の閉じた画面（§2b の表の1行目）と、
              器ごと**1文字も違わない**。題・行・断り・ボタンはオーナー指定の字そのもの。
              行き先はその言語の給与フォームの頭。残りの一覧も、100人の行も人数も無い
     聞かない … rpc を**1本も**呼ばない。窓の中の数（偽物が数えた呼び出し）と、窓の外の数
              （puppeteer が記録した通信の住所に /rpc/ が無い）の両方で見る。偽物は __wire で、
              呼ばれたら必ず /rpc/<名前> への通信を1本出す ── 網が空振りでないことは、
              下の「ログインが切れていた」の筋書きで同じ網に掛かることで確かめる
     書かない … 保存領域が、ページの script が動く前と**1文字も変わらない**。書きに行った
              鍵は、ページの部品が前から書くもの（テーマ・英語ページの言語の控え）だけ
     出ない … 紙吹雪の器・全ページの Give → Get の板・選ぶ欄・JS のエラー
     形     … §2d と同じ物差しを 320 / 390 / 1440 × 明暗で
   ── ログインが切れていた（端末にはセッションが在るのに、サーバが「ログインしていない」と
      答えた）── 入口の1回でも、2社を引く回でも、**同じ板**。クラッカーの印を置かない。
   ── ほかの失敗 ── 今までどおり「読み込めませんでした」（§10 と同じ）。
   ⚠️ 窓は見終わったらすぐ閉じる（溜めると、この Mac では混んで嘘の赤が出る）。 */
const ANON = { __anon: true, __wire: true, air: AIR };
/* 会員の「鍵が無く、答えきってもいない」門（§2b の LOCK_CASES の1行目と同じ）。 */
const ANON_TWIN = { __gate: { key: false, ready: false, todo: null, crowd: true, contributors: 37, goal: 100 },
                    air: AIR };
/* ★オーナー指定の字（2026-10-11）。会員の板との突き合わせだけだと、2つが一緒にずれた日に
     通ってしまうので、字そのものも置いておく（行と断りは §2b の LK）。 */
const ANON_T = {
  ja: { title: '給与詳細提出で開きます', go: 'Give & Get 詳細を入力して解放する' },
  en: { title: 'Opens when you submit your pay details', go: 'Give & Get / Enter your details to unlock' }
};
/* サーバが「ログインしていない」と答えた形（supabase-js の答えの形）と、ほかの失敗。 */
const LOST   = { error: { code: '42501', message: 'ログインが必要です', details: null, hint: null },
                 status: 401, statusText: 'Unauthorized' };
const LOST_J = { error: { code: 'PGRST301', message: 'JWT expired', details: null, hint: null },
                 status: 401, statusText: 'Unauthorized' };
const NET    = { error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' },
                 status: 0, statusText: '' };
const ERR_TEXT = { ja: '読み込めませんでした。少し待ってから開き直してください。',
                   en: 'Could not load. Please try again in a moment.' };
/* ★保存領域の見張り（ANON_WATCH）・ページの部品が前から書く鍵（CHROME_KEYS）・その種
   （anonSeed）は、§0 の前へ移した（2026-10-12。閉じた画面の節も同じ道具を使う）。 */
/* 落ち着くまで待つ ── 読み込みが終わり・器が出て・社名の辞書が着き・通信が静まるまで
   （時間では待たない。assert-deep-pay.mjs の anonSettled と同じ本体）。 */
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
/* ★通信の住所の振り分け（wires）も、§0 の前へ移した（2026-10-12）。 */
const anonOpen = (lang, payload, theme, more) => open(lang, payload, theme, null, null, null,
  Object.assign({ first: [[ANON_WATCH, anonSeed(lang, theme)], [POP_WATCH, POP_KEY]] }, more || {}));
for (const lang of ['ja', 'en']) {
  const path = (lang === 'en' ? '/en/' : '/') + 'deep-pay-compare.html';
  const form = (lang === 'en' ? '/en/' : '/') + 'pay-report.html';
  let anonStage = '';

  /* 会員の側（同じ門）を先に開いて、器の字を控える。 */
  let twin = '';
  {
    const { page } = await open(lang, ANON_TWIN);
    twin = (await page.evaluate(ANON_READ, POP_KEY)).stage;
    await jars.pop().close().catch(() => {});
  }

  for (const theme of ['light', 'dark']) {
    const tag = `${lang}/${theme}/未ログイン`;
    const tail = theme === 'light' ? '?from=deep#top' : '';
    const { page, errs, reqs, navs } = await anonOpen(lang, ANON, theme, { tail });
    await anonSettled(page);
    const s = await page.evaluate(SNAP);
    const r = await page.evaluate(ANON_READ, POP_KEY);
    const b = s.lockBox, w = wires(reqs);
    if (theme === 'light') anonStage = r.stage;

    // ── 居る ──
    ok(r.url === path + tail && navs.length === 1 && navs[0] === BASE + path + tail,
       `${tag}: ★★ログイン画面へ送られない ── 住所は来たときのまま（${path + tail}）・着いたのは1回だけ`,
       `${r.url} / ${JSON.stringify(navs)}`);
    ok(w.login.length === 0, `${tag}: ★ログイン・登録の画面へ向かう通信が無い`, w.login.join(' '));

    // ── 同じ板 ──
    ok(s.lock === 1 && s.ask === 0 && s.ghost === 1 && s.stage === 1 && s.blurred.join(',') === 'dp-ghost'
       && s.skel === 0 && s.lowHidden === 4,
       `${tag}: ★★閉じた画面が出る ── ぼかした影絵の手前に板（骨組みは残っていない・下の4枚は畳んだまま）`,
       ghostWhy(s) + ' / 畳んだ数 ' + s.lowHidden);
    ok(r.stage.length > 400 && r.stage === twin,
       `${tag}: ★★器（影絵＋板）が、「鍵が無く、答えきってもいない」会員の閉じた画面と1文字も違わない`,
       `長さ ${r.stage.length} / 会員 ${twin.length}`);
    ok(r.title === ANON_T[lang].title && r.go.join('|') === ANON_T[lang].go,
       `${tag}: ★★題とボタンは、オーナー指定の字のまま（「${ANON_T[lang].title}」／「${ANON_T[lang].go}」）`,
       `${r.title} ／ ${r.go.join('|')}`);
    ok(b.lines.join(' | ') === [LK[lang].key, LK[lang].ready].join(' | ')
       && b.warn.join('|') === LK[lang].warn && b.warnAtCta,
       `${tag}: ★★行は「鍵＋答え」の2つ・断りはボタンのすぐ上に1つ（会員の板と同じ字）`,
       JSON.stringify(b.lines) + ' / ' + JSON.stringify(b.warn));
    ok(b.cta.join(',') === 'pay-report.html' && r.to.join(',') === form && r.links === 1,
       `${tag}: ★★板の入口はボタン1本・行き先はその言語の給与フォームの頭（${form}。#ps でも #pay-detail でもない）`,
       `${b.cta.join(',')} → ${r.to.join(',')} / 押せるもの ${r.links}`);
    ok(b.todoH === null && b.todo.length === 0,
       `${tag}: ★★「まだ答えていない項目」の一覧は無い（会員が居ない）`, JSON.stringify([b.todoH, b.todo]));
    ok(!NOCOUNT.test(s.main) && !s.main.includes(LK[lang].goal) && !/[¥$€£]|万|%/.test(s.main),
       `${tag}: ★★人数も 100人の行も金額も出ない（サーバに聞いていないので、数を1つも知らない）`,
       countIn(s.main) + (s.main.match(/[^\n]*[¥$€£万%][^\n]*/) || [''])[0]);
    ok(s.pickHidden === true && s.pickShown === false && s.rows.length === 0 && s.bars.length === 0
       && s.kvV.length === 0 && s.condK.length === 0 && s.hd.length > 0,
       `${tag}: ★選ぶ欄・表・棒・条件の1行のどれも出ない（見出しは出ている）`,
       `欄 ${s.pickShown} / 行 ${s.rows.length} / 見出し「${s.hd}」`);
    ok(b.tags.every((t) => LOCK_TAGS.includes(t)) && !/null|undefined|NaN|\[object/.test(s.main),
       `${tag}: 板に余計なタグも null / undefined も無い`, b.tags.join(' '));

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

    // ── 形（§2d と同じ物差し）──
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
    }
    /* ── 縦の置き場所（§2d の placeAt と同じ物差し）。この板は会員の「鍵＋答え」の板と
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
      const walk = await tabWalk(page);
      ok(walk.filter((x) => !x.body).length >= 8 && walk.some((x) => x.cta) && !walk.some((x) => x.ghost),
         `${tag}: ★★Tab で一周しても影絵には入らない・板のボタンには届く`,
         `ボタンに届いた=${walk.some((x) => x.cta)} 影絵に入った=${walk.some((x) => x.ghost)}`);
    }
    ok(errs.length === 0, `${tag}: JS のエラーが出ない`, errs.join(' / '));
    await jars.pop().close().catch(() => {});
  }

  // ── 前のログインの印が端末に残っている人（日本語だけ）──
  if (lang === 'ja') {
    const tag = `${lang}/未ログイン/前の印が残っている`;
    const { page, errs, reqs } = await open(lang, ANON, 'light', null, null, null,
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
    const { page, errs, reqs, navs } = await anonOpen(lang, { __fail: fail, __wire: true, air: AIR }, 'light');
    await anonSettled(page);
    const s = await page.evaluate(SNAP);
    const r = await page.evaluate(ANON_READ, POP_KEY);
    const w = wires(reqs);
    ok(r.stage === anonStage && s.lock === 1 && !s.main.includes(ERR_TEXT[lang]) && s.pickShown === false,
       `${tag}: ★★ログインしていない人と同じ板（器ごと1文字も違わない）。「読み込めませんでした」は出さない`,
       `同じ=${r.stage === anonStage} / 板 ${s.lock}`);
    ok(s.rpc.pv_deep_pay === 1 && s.args.length === 1 && s.args[0] === null,
       `${tag}: ★聞いたのは入口の1回だけ（聞き直さない）`, JSON.stringify(s.rpc));
    /* ★網の自己点検。この筋書きは実際に聞いているので、窓の外の記録に1本掛かるはず。 */
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

  // ── ログインが切れていた（開いた画面で、2社を引く回に）──
  /* ★__failAfter: 1 ＝ 入口の1回は普通に答え、そのあとの pv_deep_pay（左右の2本）が
       「ログインしていない」で返る。pair() が LOST を「引けなかった」より前に見ていること。 */
  {
    const tag = `${lang}/ログインが切れていた（2社を引く回）`;
    const { page, errs } = await anonOpen(lang, { __fail: LOST, __failAfter: 1, air: AIR }, 'light');
    const before = await page.evaluate(SNAP);
    await choose(page, { a: 'ana', b: 'jal' }, 2);
    await page.waitForFunction(() => !!document.querySelector('.dp-stage'), { timeout: 20000 }).catch(() => {});
    const s = await page.evaluate(SNAP);
    const r = await page.evaluate(ANON_READ, POP_KEY);
    ok(before.ask === 1 && before.lock === 0 && noGhost(before) && before.pickShown === true,
       `${tag}: （前置き）入口の1回は通って、開いた画面（選ぶ前）が出ている`, ghostWhy(before));
    ok(r.stage === anonStage && s.lock === 1 && !s.main.includes(ERR_TEXT[lang]) && s.rows.length === 0
       && s.kvV.length === 0 && s.pickShown === false && s.condK.length === 0 && s.lowHidden === 4
       && !/[¥$€£]\s?\d|万|%/.test(s.main),
       `${tag}: ★★2社を引く回に切れていても、同じ板（表・数字・選ぶ欄は出ない。エラーの板でもない）`,
       `同じ=${r.stage === anonStage} / 行 ${s.rows.length} / 欄 ${s.pickShown}`);
    ok(s.rpc.pv_deep_pay === 3 && r.mark === null && r.pop === 0 && errs.length === 0,
       `${tag}: ★聞き直さない（入口＋左右の2本）・印を置かない・JS のエラーが出ない`,
       JSON.stringify(s.rpc) + ' / 印 ' + JSON.stringify(r.mark) + ' ' + errs.join(' / '));
    await jars.pop().close().catch(() => {});
  }

  // ── ほかの失敗は、今までどおり「読み込めませんでした」──
  for (const [name, payload] of (lang === 'ja'
    ? [['通信が切れた（番号 0）', { __fail: NET, air: AIR }], ['答えの箱が投げた', { __reject: true, air: AIR }]]
    : [['通信が切れた（番号 0）', { __fail: NET, air: AIR }]])) {
    const tag = `${lang}/ほかの失敗（${name}）`;
    const { page, errs } = await open(lang, payload);
    const s = await page.evaluate(SNAP);
    const msg = await page.evaluate(() => [...document.querySelectorAll('#dc-sides .pt-empty')].map((e) => e.textContent));
    ok(msg.join('|') === ERR_TEXT[lang] && noGhost(s) && s.lock === 0 && s.rows.length === 0,
       `${tag}: ★★今までどおり「読み込めませんでした」だけ（板も影絵も出さない ── 給与を出してとは頼まない）`,
       JSON.stringify(msg) + ' / ' + ghostWhy(s));
    ok(s.rpc.pv_deep_pay === 1 && errs.length === 0,
       `${tag}: 聞いたのは1回・JS のエラーが出ない`, JSON.stringify(s.rpc) + errs.join(' / '));
    await jars.pop().close().catch(() => {});
  }
  /* 2社を引く回の「ほかの失敗」も、今までどおりエラーの板（LOST と取り違えない）。 */
  if (lang === 'ja') {
    const tag = `${lang}/ほかの失敗（2社を引く回に通信が切れた）`;
    const { page, errs } = await open(lang, { __fail: NET, __failAfter: 1, air: AIR });
    await choose(page, { a: 'ana', b: 'jal' }, 2);
    await page.waitForFunction(() => !!document.querySelector('#dc-sides .pt-empty'), { timeout: 20000 }).catch(() => {});
    const s = await page.evaluate(SNAP);
    const msg = await page.evaluate(() => [...document.querySelectorAll('#dc-sides .pt-empty')].map((e) => e.textContent));
    ok(msg.join('|') === ERR_TEXT[lang] && noGhost(s) && s.lock === 0 && errs.length === 0,
       `${tag}: ★★「読み込めませんでした」のまま（板も影絵も出さない）`, JSON.stringify(msg) + ' / ' + ghostWhy(s));
    await jars.pop().close().catch(() => {});
  }
}

// ── 3. 選ぶまで何も出さない ─────────────────────────────────────
{
  const { page, errs } = await open('ja', OK);
  const s = await page.evaluate(SNAP);
  ok(s.ask === 1 && s.rows.length === 0 && s.kvV.length === 0,
     '★★2社そろうまで数字を1つも出さない', `ask=${s.ask} 行=${s.rows.length}`);
  ok(noGhost(s), '★選ぶ前の画面（開いている）に影絵が無い', ghostWhy(s));
  ok(s.condK.length === 0, '★★選ぶまで条件バー（表示中:）を出さない', s.condK.join(','));
  ok(s.lowHidden === 4, '★下の4枚（表・棒・トレードオフ・入口）は畳んだまま',
     String(s.lowHidden));
  /* ★2026-09-01 に欄が4つ → 5つになった。機材は**会社ごとに違う**（ANA に A380 は
     無い）ので左右に分けた。役職だけは両社共通（揃えないと比較が成り立たない）。
     並び順は 会社A → 機材A → 役職 → 会社B → 機材B。 */
  ok(s.pickHidden === false
     && s.pick.join(',') === 'dc-pk-a,dc-pk-fa,dc-pk-pos,dc-pk-b,dc-pk-fb',
     '会社A・機材A・役職・会社B・機材B の5つの欄が出ている', s.pick.join(','));
  ok(s.rst === 0, '何も選んでいないうちは「選択をクリア」を出さない');
  /* ★5欄は必ず 3列 × 2段（会社A・機材A・役職 ／ 会社B・機材B・クリア）。
     1段に並べると <select> の内寸が痩せ、一番長い社名が端で切れる ── しかも
     <select> は省略記号すら出さないので、切れたことが画面から分からない。
     幅は勘で振らず `node shot-compare.mjs full ja light <幅> measure` で実測する
     （2026-09-01 の実測 ── 会社 297px / 機材 258px / 役職 127px が最長）。
     ★「2社を選ぶ」の見出しは 2026-08-31 に削除（1画面に収める / オーナー確定）。
     ⚠️ 「選択をクリア」は出たり消えたりする。前はそれが grid の1行目を
        まるごと占めていて、消えた瞬間に欄が1つずつずれた。いまは
        3列目に固定してあるが、**選ぶ前と選んだ後の両方**で見る。
     ★クリアは欄と下端を揃える（背の低いボタンなので上端は当然ずれる）。 */
  const lay = (pg) => pg.evaluate(() => {
    const f = [...document.querySelectorAll('#dc-pick .dp-pick-s')];
    const y = f.map((e) => Math.round(e.getBoundingClientRect().top));
    const b = f.map((e) => Math.round(e.getBoundingClientRect().bottom));
    const r = document.querySelector('#dc-pick .dp-pick-r');
    return { tops: y, rows: [...new Set(y)].length,
             gap: r ? Math.abs(Math.round(r.getBoundingClientRect().bottom)
                               - Math.max(...b)) : null };
  });
  const l0 = await lay(page);
  ok(l0.tops.length === 5, '★5欄そろっている（選ぶ前）', JSON.stringify(l0));
  ok(l0.rows === 2, '★5欄は3列×2段に並ぶ（選ぶ前）', String(l0.rows));
  ok(s.args.length === 1 && s.args[0] === null,
     '★入口の1回は引数なし（state と鍵を取りに行くだけ）', JSON.stringify(s.args));
  ok(errs.length === 0, '入口で JS のエラーが出ない', errs.join(' / '));

  // 片方だけ選んでも引かない
  await choose(page, { a: 'ana' }, 0);
  const h = await page.evaluate(SNAP);
  ok(h.args.length === 1 && h.ask === 1,
     '★片方だけでは引かない・出さない', `${h.args.length}回 ask=${h.ask}`);
  ok(h.rst === 1, '1つでも選ぶと「選択をクリア」が出る');
  const l1 = await lay(page);
  ok(l1.rows === 2 && l1.tops.length === 5 && l1.gap != null && l1.gap <= 4,
     '★「選択をクリア」が出ても並びは 3列×2段のまま（クリアは2段目の右端）',
     JSON.stringify(l1));

  // 同じ会社を2つ
  await choose(page, { a: 'ana', b: 'ana' }, 0);
  const dp = await page.evaluate(SNAP);
  ok(dp.args.length === 1, '★同じ会社を2つ選んでも引かない', `${dp.args.length}回`);
  ok(dp.ask === 1 && /別の会社/.test(dp.msg), '同じ会社には「別の会社を選んでください」', dp.msg);
  ok(noGhost(dp), '★同じ会社を選んだ画面に影絵が無い', ghostWhy(dp));
}

// ── 4. 2社そろって全部出る ──────────────────────────────────────
{
  const { page, errs } = await open('ja', OK, 'light', { a: 'ana', b: 'jal' });
  const s = await page.evaluate(SNAP);
  ok(s.args.length === 3 && s.args[1].p.airline === 'ana' && s.args[2].p.airline === 'jal',
     '★入口1回＋左右2回。選んだ会社をそのままサーバへ渡す',
     JSON.stringify(s.args.map((a) => a && a.p && a.p.airline)));
  ok(s.sideN.length === 2 && /ANA|全日/.test(s.sideN[0]) && /JAL|日本航空/.test(s.sideN[1]),
     '2社の名前が左右に並ぶ', s.sideN.join(' / '));
  /* ★人数のピルは 2026-10-11 に信頼度の札へ替わった（オーナー判断「人数は出さない」）。
     前は '21人,17人'。段はサーバが会社ごとに返す（cohort.trust）── 見本は
     ana＝high・jal＝mid。**左右が入れ替わっていない**ことまで見る。 */
  ok(s.sideC.join(',') === '信頼度 高,信頼度 中',
     '★会社ごとの札は信頼度の段（サーバの答えのまま・左右それぞれ）', s.sideC.join(','));
  /* ★両方読めるときはカード2枚を出さない（2026-08-31・オーナー確定「1画面に収める」）。
     年収・Pay per BH・固定・保証給比率・Block Hours は**すぐ下の表に同じ数字が並ぶ**ので、
     カードは同じ数字の2度書きだった。やめて 153px 減らし、ロゴ・社名・信頼度の札は
     表の見出し行が受け持つ（上の2本がその見出しを見ている）。
     ⚠️ 戻すときは §5 の「薄いのは片側だけ」も一緒に見ること。あちらはカードが要る。 */
  ok(s.cardsShown === false, '★両方読めるならカードは出さない（表の見出しが受け持つ）',
     String(s.cardsShown));
  /* ★条件バーから「◯人 vs ◯人」を外した（2026-10-11）。残るのは対象期間だけ
     （役職を選んでいれば役職も。§13d が見ている）。 */
  ok(s.condK.join(' / ') === '直近24か月',
     '★★条件バーに人数を出さない（残るのは「直近24か月」。12か月ではない）',
     s.condK.join(' / '));
  ok(!NOCOUNT.test(s.main), '★★2社そろった画面の本文に人数の形の字が1つも無い', countIn(s.main));
  ok(s.rows.length === 9, '★9項目とも両側にあるので9行出る', String(s.rows.length));
  /* ── 見出しの2つは刻みで出す（2026-10-11・オーナー判断）────────────
     年収は 1万円刻み・Pay / Block Hour は 100円刻み（前は有効数字2桁で
     ¥1,900万・¥16,000 のような丸い額だった）。差は**画面の2つの字の引き算**なので、
     細かくなったぶん差も細かく出る。3つの数字はいつでも辻褄が合う。 */
  ok(s.rows[0].a === '¥1,903万' && s.rows[0].b === '¥2,034万'
     && s.rows[0].d === '+¥131万' && s.rows[0].side === 'b',
     '★年収は 1万円刻み（¥1,903万 と ¥2,034万）・差はその引き算（+¥131万）',
     JSON.stringify(s.rows[0]));
  ok(s.rows[1].a === '¥16,500' && s.rows[1].b === '¥16,800'
     && s.rows[1].d === '+¥300' && s.rows[1].side === 'b',
     '★Pay / Block Hour は 100円刻み（¥16,500 と ¥16,800）・差は +¥300',
     JSON.stringify(s.rows[1]));
  ok(s.rows.every((r) => r.a.trim() && r.b.trim()), '空のセルが無い');
  /* ★差は**値が違う行にだけ**付く。同じ表示の行に付けると、
     「+0」や「+¥0万」が並んで、丸めた後の同じ数字を違うように見せてしまう。 */
  ok(s.rows.every((r) => (r.a !== r.b) === !!r.d),
     '★値が違う行にだけ差の数値が付く（同じ行にはどちらにも付けない）',
     s.rows.map((r) => `${r.a}|${r.b}|${r.d}`).join(' / '));
  ok(s.rows.every((r) => !r.d || /^\+/.test(r.d)),
     '★差は必ず「+」から始まる（置き場所が高いほうを示すので符号は常に +）',
     s.rows.map((r) => r.d).join(' / '));
  /* ★勝った会社を1列にまとめない。項目ごとに、差が付く側が入れ替わる。 */
  ok(s.rows.filter((r) => r.side === 'b').length === 7
     && s.rows.filter((r) => r.side === 'a').length === 2,
     '★どちらが高いかは項目ごとに入れ替わる（勝った会社をまとめない）',
     s.rows.map((r) => r.side + r.d).join(' / '));
  ok(s.bars.join(',') === '5,5' && s.barNone === 0,
     '★給与構成の棒が左右2本（賞与は棒に入れない＝5区分）', s.bars.join(','));
  ok(s.leg.length === 5 && !s.leg.some((t) => /賞与|ボーナス/.test(t)),
     '★凡例に賞与を入れない（年額なので月々の100%を壊す）', s.leg.join(','));
  ok(s.rows.some((r) => /賞与/.test(r.k)), '賞与は表には行として残る');
  ok(s.to.length === 2, '★トレードオフは最大2行', String(s.to.length));
  ok(/どちらが良いかではなく/.test(s.toEnd), '締めの1行が必ず出る', s.toEnd);
  /* ★「準備中」の押せないボタンは置かない（2026-08-31・オーナー確定）。
     押せないボタンは読み手の時間を1回奪って何も返さない。
     役割別ができたら、そのときリンクを1本足す。 */
  ok(s.ctaA.join(',') === 'deep-pay.html' && s.ctaOn === 1 && s.ctaOff === 0,
     '★下の入口は 戻るリンク1本＋押せるボタン1つ（準備中は置かない）',
     `${s.ctaA.join(',')} on=${s.ctaOn} off=${s.ctaOff}`);
  /* ★『Pay / Block Hour は…（時給ではありません）』は**時給ではないと断っている**文。
     素の grep だと、約束を書いた画面ほど赤くなる。②と同じ数え方を画面にも当てる。 */
  ok(saysHourly(s.text).ja === 0, '★画面で「時給」と呼ばない（否定する文だけ許す）',
     String(saysHourly(s.text).ja));
  ok(/時給ではありません/.test(s.text), '★「時給ではありません」の但し書きが画面に出ている');
  /* ── 数字の定義（2026-09-01・DEEP PAY と同じ土俵にそろえた回）──────
     ★保存時の定義は「年収USD ÷ (12 × Block Hours)」。年収には賞与も住宅手当も
       パーディアムも入っている＝**賞与ぬきの月額報酬ではない**。
       「月額報酬 ÷ Block Hours」と書くと、給与構成の月額で割ったように読める。 */
  ok(!/月額報酬/.test(s.text), '★「月額報酬 ÷ Block Hours」と書かない');
  ok(/1人ずつ/.test(s.text),
     '★Pay / Block Hour は「1人ずつ」出した中央値だと書く（＝で結べるように書かない）');
  /* ★指示 §3 の言い方。住宅手当を外したので「固定給」ではなく「固定・保証給」。 */
  ok(/固定・保証給比率/.test(s.text) && !/固定給比率/.test(s.text),
     '★表の見出しは「固定・保証給比率」（古い「固定給比率」は残っていない）');
  /* ★年収が何を含むかは、これまでどちらの画面にも書いていなかった。 */
  ok(/年収＝/.test(s.text) && /住宅手当/.test(s.text) && /現物の社宅は含みません/.test(s.text),
     '★年収が何を含むかを画面に書く（現物の社宅は含まない）');
  ok(!/上位|パーセンタイル|位です/.test(s.text), '★順位・パーセンタイルを出さない');
  /* ★開いた画面には影絵が無い（2026-10-11）。本物の値が並ぶ画面に、ぼかした要素を
       1つも置かない ── 影絵が在ってよいのは、数字が1つも来ていない閉じた画面だけ。 */
  ok(noGhost(s), '★★2社そろった画面に影絵が無い（ぼかしの効いた要素が1つも無い）', ghostWhy(s));
  ok(errs.length === 0, '2社そろった画面で JS のエラーが出ない', errs.join(' / '));
}

// ── 4b. 人数が来ても出さない／信頼度が来なければ札を出さない（2026-10-11）──
/* ★db/*.sql は push では本番に入らない。**貼る前の本番は古い形で返してくる** ──
   区分の人数（cohort.n・head.verified_n …）が付いていて、信頼度の段が無い。
   ⚠️ 「21人が出ていない」だけを見ない。毒の無い見本と**1文字も違わない**ことを
      見る ── 人数を別の言い方（「21件」「21 reports」）で刷る後戻りも一緒に捕まる。 */
for (const lang of ['ja', 'en']) {
  const { page: p0 } = await open(lang, OK, 'light', { a: 'ana', b: 'jal' });
  const clean = await p0.evaluate(SNAP);
  const bad = clone(AIR);
  bad.ana.poison = 21; bad.jal.poison = 17;
  const { page: p1, errs } = await open(lang, { air: bad }, 'light', { a: 'ana', b: 'jal' });
  const s = await p1.evaluate(SNAP);
  ok(s.rows.length === 9 && s.main === clean.main && s.mainHtml === clean.mainHtml,
     `${lang}: ★★サーバが人数を返してきても、画面は1文字も変わらない（読まない）`,
     `本文が同じ=${s.main === clean.main} / DOM が同じ=${s.mainHtml === clean.mainHtml}`);
  ok(!NOCOUNT.test(s.main) && !/(?:21|17|16|12)\s*(?:人|名|件)|\b(?:21|17|16|12) pilots\b/i.test(s.main),
     `${lang}: ★★毒入りの人数（21・17 ほか）が本文に出ない`, countIn(s.main));
  ok(errs.length === 0, `${lang}: 毒入りの答えで JS のエラーが出ない`, errs.join(' / '));

  /* 信頼度の段が来ない形（古いサーバ）。札ごと出ない ──「—」でも「低」でも埋めない。 */
  const old = clone(AIR);
  delete old.ana.trust; delete old.jal.trust;
  const { page: p2 } = await open(lang, { air: old }, 'light', { a: 'ana', b: 'jal' });
  const o = await p2.evaluate(SNAP);
  ok(o.rows.length === 9 && o.sideC.length === 0 && !/信頼度|Confidence/.test(o.main),
     `${lang}: ★信頼度の段が来なければ札ごと出さない（「—」でも「低」でも埋めない）`,
     JSON.stringify(o.sideC));
  /* 片側だけ来ない形。来た側だけに札が付く（来ない側へ相手の段を写さない）。 */
  const half = clone(AIR);
  delete half.jal.trust;
  const { page: p3 } = await open(lang, { air: half }, 'light', { a: 'ana', b: 'jal' });
  const h = await p3.evaluate(SNAP);
  ok(h.sideC.length === 1 && /高|High/.test(h.sideC[0]),
     `${lang}: ★段が片側だけ来たら、来た側だけに札が付く`, JSON.stringify(h.sideC));
}

// ── 5. 片側だけ薄い ─────────────────────────────────────────────
{
  const { page, errs } = await open('ja', OK, 'light', { a: 'ana', b: 'sas' });
  const s = await page.evaluate(SNAP);
  ok(s.sideEmpty[0] === '' && /まだ出せません/.test(s.sideEmpty[1]),
     '★★薄いのは片側だけ。もう片側は普通に出る',
     JSON.stringify(s.sideEmpty));
  ok(s.kvV.length === 4, '読める側は4項目そのまま出る', String(s.kvV.length));
  /* ★片側が薄いと表は丸ごと畳む（rowsOf() が [] を返す）ので、**読める側の数字は
     このカードにしか出ない**。「薄いのはその側だけ・もう片側は普通に出る」という
     約束を持っているのはこの1枚。§4 で消したからといってここまで消さないこと。 */
  ok(s.cardsShown === true, '★★片側が薄いときはカードを出す（読める側の数字はここにしか出ない）',
     String(s.cardsShown));
  /* ★薄い側には札を付けない（2026-10-11。前は人数のピルに「—」を置いていた）。
     数字を1つも出していない側に「信頼度 低」と付けると、低いなりに数字が在るように
     読める。「—」も置かない ── 置くと「何かが欠けている」ことだけが読める。 */
  ok(s.sideC.join(',') === '信頼度 高', '★信頼度の札は読める側だけ（薄い側には付けない）',
     s.sideC.join(','));
  ok(s.condK.join(' / ') === '直近24か月', '★条件バーにも人数を出さない（「◯人 vs —」は無い）',
     s.condK.join(' / '));
  ok(s.kvV[0] === '¥1,903万' && s.kvV[1] === '¥16,500',
     '★読める側のカードも刻みで出す（年収 ¥1,903万・Pay / Block Hour ¥16,500）',
     JSON.stringify(s.kvV));
  /* ★薄い側の板。壁が何人かを書かない（前は「3人そろった区分から順に出ます。」）。 */
  ok(s.main.includes('データがそろった区分から順に出ます。') && !NOCOUNT.test(s.main),
     '★★片側が薄い画面の本文に人数の形の字が1つも無い', countIn(s.main));
  ok(s.rows.length === 0 && /並べられる項目がまだありません/.test(s.diffEmpty),
     '★空の表ではなく一言のカードにする', s.diffEmpty);
  ok(s.bars.length === 2 && s.barNone === 1,
     '★棒は読める側だけ描き、薄い側は「まだ出せません」の帯', `${s.bars.join(',')} none=${s.barNone}`);
  ok(s.to.length === 0 && /どちらが良いかではなく/.test(s.toEnd),
     '★片側が薄いときトレードオフは1行も出さない（締めの1行は出す）');
  ok(!/\b0%|0人/.test(s.text), '★薄い側を 0 で埋めない');
  /* ★薄い側の「まだ出せません」は、開いた画面の中の話。そこをぼかした絵で埋めない。 */
  ok(noGhost(s), '★★片側が薄い画面に影絵が無い（薄い側を、ぼかした絵で埋めない）', ghostWhy(s));
  ok(errs.length === 0, '薄い側がある画面で JS のエラーが出ない', errs.join(' / '));
}

// ── 6. 片側に無い項目は行ごと落ちる ─────────────────────────────
{
  const { page } = await open('ja', OK, 'light', { a: 'ana', b: 'lufthansa' });
  const s = await page.evaluate(SNAP);
  ok(s.rows.length === 7, '★片側に無い2項目（パーディアム・賞与）が行ごと落ちる',
     String(s.rows.length));
  ok(!s.rows.some((r) => /パーディアム|滞在手当/.test(r.k)),
     '★無い区分を 0% と書かずに消す（「手当が無い会社」に見せない）',
     s.rows.map((r) => r.k).join(','));
  ok(!s.rows.some((r) => /賞与/.test(r.k)), '★賞与が null の側があれば賞与の行も消す');
  ok(s.rows.some((r) => /住宅/.test(r.k)), '両側にある住宅の行は残る');
  ok(s.bars.join(',') === '5,4' && s.barNone === 0,
     '棒の区分数は会社ごとに違ってよい', s.bars.join(','));
  ok(s.leg.length === 5, '凡例は左右どちらかに在る区分を集めて出す', s.leg.join(','));
}

// ── 7. 丸めたら同じ表示になる値 ─────────────────────────────────
/* ★2026-10-11 に年収と Pay / Block Hour の刻みが細かくなった（円なら 1万円・100円。
   前は有効数字2桁）。「同じ表示になる幅」は狭くなったが、決め方は同じ ──
   **画面の字が同じなら差を書かない・違えば書く。** 丸める前の値では比べない。
   見本は3つとも、サーバの値が ana と違う。
     emirates  … 年収 $119,750（ana は $119,700）・Pay/BH $104（ana は $103.5）。
                 円ではどちらも ¥1,903万・¥16,500 ＝**同じ字**になる
     singapore … 年収 $119,800。円では ¥1,904万 ＝**刻み1つぶん違う字**になる
   ⚠️ 前の版の見本は年収も Pay/BH も ana と同じ値だった＝「丸めたら同じ」を
      見ているつもりで、その2行は最初から同じだった。値を違えてある。 */
{
  const { page } = await open('ja', OK, 'light', { a: 'ana', b: 'emirates' });
  const s = await page.evaluate(SNAP);
  ok(s.rows.length === 9 && s.rows.every((r) => r.a === r.b && !r.d),
     '★★同じ数字が並んでいるのに差の数値を書かない（表示文字列で判定）',
     s.rows.map((r) => `${r.a}|${r.b}|${r.d}`).join(' / '));
  ok(s.rows[0].a === '¥1,903万' && s.rows[1].a === '¥16,500',
     '★同じ字になっているのは刻みで出した額（¥1,903万・¥16,500）', JSON.stringify(s.rows.slice(0, 2)));
  ok(!/の方が|より高い|より長い/.test(s.text), '勝ち負けを言う語が1つも出ない');
  ok(s.to.length === 0,
     '★全部同じならトレードオフは出ない（締めの1行だけ）', s.to.join(' / '));

  /* ★表示通貨を変えると、刻みの境目をまたぐ組だけ「同じ」と「違う」が入れ替わる。
     それで正しい ── どの通貨でも、画面の2つの字と差は辻褄が合っている。
     ユーロでは年収が €102K と €103K（差 +€1K）・Pay/BH は €89 と €89（同じ）。 */
  await page.evaluate(() => window.PVCurrency.set('EUR'));
  await page.waitForFunction(
    () => /€/.test((document.querySelector('#dc-diff .dc-tr:not(.dc-th) .dc-c2') || {})
      .textContent || ''), { timeout: 10000 });
  const e = await page.evaluate(SNAP);
  ok(e.rows[0].a === '€102K' && e.rows[0].b === '€103K' && e.rows[0].d === '+€1K'
     && e.rows[0].side === 'b',
     '★ユーロでは年収の字が違うので差が出る（€102K と €103K → +€1K）', JSON.stringify(e.rows[0]));
  ok(e.rows[1].a === '€89' && e.rows[1].b === '€89' && !e.rows[1].d,
     '★ユーロでも Pay / Block Hour は同じ字なので差を書かない（€89 と €89）',
     JSON.stringify(e.rows[1]));
  ok(e.rows.every((r) => (r.a !== r.b) === !!r.d),
     '★通貨を変えても「字が違う行にだけ差が付く」は崩れない',
     e.rows.map((r) => `${r.a}|${r.b}|${r.d}`).join(' / '));
}
// ── 7b. 刻み1つぶんの差は、そのまま出る ───────────────────────────
/* ★差に下限は置いていない。¥1,903万 と ¥1,904万 は違う字なので +¥1万 と出る。
   「小さいから書かない」を画面が決め始めると、同じ字でないのに差が出ない行ができ、
   読み手が自分で引き算した答え（1万）と画面（空欄）が合わなくなる。
   ⚠️ ここは**いまの決め方を固定している**だけ。下限を置くと決めたら、この節と
      deep-pay-compare.js の delta() の注を一緒に直す。 */
{
  const { page } = await open('ja', OK, 'light', { a: 'ana', b: 'singapore-airlines' });
  const s = await page.evaluate(SNAP);
  ok(s.rows.length === 9 && s.rows[0].a === '¥1,903万' && s.rows[0].b === '¥1,904万'
     && s.rows[0].d === '+¥1万' && s.rows[0].side === 'b',
     '★刻み1つぶんの差もそのまま出る（¥1,903万 と ¥1,904万 → +¥1万）', JSON.stringify(s.rows[0]));
  ok(s.rows.slice(1).every((r) => r.a === r.b && !r.d),
     '★ほかの8行は同じ字なので差を書かない',
     s.rows.slice(1).map((r) => `${r.a}|${r.b}|${r.d}`).join(' / '));
  /* 年収だけ上・Block Hours は同じ ＝ 同じ側が2つとも上回っていないので出ない。 */
  ok(s.to.length === 0, '★差が年収の1行だけならトレードオフは出ない', s.to.join(' / '));
  ok(s.sideC.join(',') === '信頼度 高,信頼度 低', '信頼度の札は3段とも出せる（高・低）',
     s.sideC.join(','));
}

// ── 8. トレードオフの発火条件 ───────────────────────────────────
{
  const { page } = await open('ja', OK, 'light', { a: 'ana', b: 'qatar-airways' });
  const s = await page.evaluate(SNAP);
  ok(s.rows.length === 9, '9行そろっている', String(s.rows.length));
  ok(s.to.length === 0,
     '★★上回った側が対で割れていたらトレードオフと呼ばない', s.to.join(' / '));
  ok(/どちらが良いかではなく/.test(s.toEnd), '対が1つも無くても締めの1行は出る');
}

// ── 9. 通貨を切り替えても引き直さない ───────────────────────────
{
  const { page, errs } = await open('ja', OK, 'light', { a: 'ana', b: 'jal' });
  const before = await page.evaluate(SNAP);
  await page.evaluate(() => window.PVCurrency.set('USD'));
  await page.waitForFunction(
    () => /\$/.test((document.querySelector('#dc-diff .dc-tr:not(.dc-th) .dc-c2') || {})
      .textContent || ''), { timeout: 10000 });
  const after = await page.evaluate(SNAP);
  ok(before.rows[0].a !== after.rows[0].a,
     '通貨を切り替えると表の金額が変わる', `${before.rows[0].a} → ${after.rows[0].a}`);
  /* ★2026-08-31 まではカードの金額（kvV）を見ていたが、両方読めるときは
     カードを出さなくなったので対象が消えた。画面ぜんぶを数える形に替える
     ── こちらのほうが強い（「表だけ変わって別のどこかに ¥ が残る」も捕まる）。 */
  ok(before.yen > 0 && after.yen === 0 && after.usd > 0,
     '★画面のどこにも古い通貨が残らない',
     `¥ ${before.yen}→${after.yen} / $ ${before.usd}→${after.usd}`);
  ok(after.args.length === 3,
     '★★通貨を切り替えても pv_deep_pay() を引き直さない（入口1＋左右2 のまま）',
     String(after.args.length));
  ok(after.rows.length === 9 && after.sideN.length === 2, '切替後も画面が崩れない');

  // 選び直す → +2回だけ
  await choose(page, { a: 'ana', b: 'lufthansa' }, 2);
  const re = await page.evaluate(SNAP);
  ok(re.args.length === 5 && re.args[4].p.airline === 'lufthansa',
     '★選び直すと2回だけ引き直す', JSON.stringify(re.args.map((a) => a && a.p && a.p.airline)));

  // クリア → 引き直さずに「選んでください」へ戻る
  await page.evaluate(() => document.getElementById('dc-pk-rst').click());
  await page.waitForFunction(() => !document.getElementById('dc-pk-rst'), { timeout: 10000 });
  const cl = await page.evaluate(SNAP);
  ok(cl.args.length === 5,
     '★★クリアは引き直さない（捨てる答えを取りに行かない）', String(cl.args.length));
  ok(cl.ask === 1 && cl.rows.length === 0 && cl.condK.length === 0,
     '★★クリアすると「選んでください」に戻る（前の数字も条件バーも残さない）',
     `ask=${cl.ask} 行=${cl.rows.length} 条件=${cl.condK.length}`);
  ok(errs.length === 0, '切替と選び直しで JS のエラーが出ない', errs.join(' / '));
}

// ── 9b. 刻みは表示通貨の中で掛ける（2026-10-11）─────────────────
/* 年収と Pay / Block Hour は、**換算してから**刻みに寄せる（円 1万円・100円／
   ほかの通貨 1,000・1）。円で丸めてから換算すると、ドルに切り替えた瞬間だけ
   端数の残った額（$119,723 のような）が出て、1ドル単位まで持っているように読める。
   ★刷られる字そのものを固定する。レートは currency.js の RATES（USD 158.95）。
   ⚠️ 英語ページの既定の通貨は**この機械のタイムゾーン**で決まる。必ず
      PVCurrency.set() で名指ししてから読む。 */
{
  const setCur = async (pg, cur, sym) => {
    await pg.evaluate((c) => window.PVCurrency.set(c), cur);
    await pg.waitForFunction((c, y) => window.PVCurrency.get() === c
      && ((document.querySelector('#dc-diff .dc-tr:not(.dc-th) .dc-c2') || {}).textContent || '')
           .indexOf(y) >= 0, { timeout: 10000 }, cur, sym);
    return pg.evaluate(SNAP);
  };
  const { page } = await open('en', OK, 'light', { a: 'ana', b: 'jal' });
  /* 既定がどの通貨でも通るように、円のときはいったん別の通貨を挟む
     （同じ通貨を set しても何も起きないので、待ちが時間切れになる）。 */
  if (await page.evaluate(() => window.PVCurrency.get()) === 'JPY') await setCur(page, 'USD', '$');
  const y = await setCur(page, 'JPY', '¥');
  ok(y.rows[0].a === '¥19,030,000' && y.rows[0].b === '¥20,340,000' && y.rows[0].d === '+¥1,310,000',
     '★英語＋円 ──「万」に畳まず全部の桁で出す（¥19,030,000 と ¥20,340,000 → +¥1,310,000）',
     JSON.stringify(y.rows[0]));
  ok(y.rows[1].a === '¥16,500' && y.rows[1].b === '¥16,800' && y.rows[1].d === '+¥300',
     '★英語＋円 ── Pay / Block Hour は 100円刻み（¥16,500 と ¥16,800 → +¥300）',
     JSON.stringify(y.rows[1]));
  const u = await setCur(page, 'USD', '$');
  ok(u.rows[0].a === '$120K' && u.rows[0].b === '$128K' && u.rows[0].d === '+$8K',
     '★ドル ── 年収は 1,000 刻み（$120K と $128K → +$8K）', JSON.stringify(u.rows[0]));
  ok(u.rows[1].a === '$104' && u.rows[1].b === '$106' && u.rows[1].d === '+$2',
     '★ドル ── Pay / Block Hour は 1 刻み（$104 と $106 → +$2）', JSON.stringify(u.rows[1]));
  ok(u.rows.every((r) => (r.a !== r.b) === !!r.d),
     '★どの通貨でも「字が違う行にだけ差が付く」',
     u.rows.map((r) => `${r.a}|${r.b}|${r.d}`).join(' / '));
  /* 値のセルが折れていない・切れていない（細かくなったぶん字が増えていないこと）。 */
  const cut = await page.evaluate(() => [...document.querySelectorAll('#dc-diff .dc-c2, #dc-diff .dc-c3')]
    .filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
  ok(cut.length === 0, '★表の値が枠から切れていない', cut.join(' '));
}

// ── 9c. 手当の月額は、表示通貨の中で2桁に寄せる（2026-10-11）──────────
/* パーディアム・住宅手当は、両側に月額がそろったときだけ金額で並ぶ（moneyExact）。
   前は「円で2桁に寄せてから換算」だったので、円以外では端数が戻っていた ──
   サーバの $640 が ¥100,000 を経て **$629** と出る（持っているのは2桁だけなのに、
   1ドル単位まで知っているように読める）。いまは換算してから寄せる（sigIn）。
   ★円の表示は今までどおり。ドルでは、サーバが返した2桁の額がそのまま出る。
   ★差は画面の2つの字の引き算のまま（+$140）── 3つの数字の辻褄は通貨を問わず合う。
   ⚠️ 見本の月額は作り物（640 / 780・460 / 510）。 */
{
  const withAmt = (base, pd, ho) => Object.assign(clone(base), {
    segs: [{ k: 'base', pct: 62 }, { k: 'variable', pct: 18 },
           { k: 'perdiem', pct: 7, med_usd: pd }, { k: 'housing', pct: 8, med_usd: ho },
           { k: 'other', pct: 5 }] });
  const AMT = { air: { ana: withAmt(ANA, 640, 460), jal: withAmt(AIR.jal, 780, 510) } };
  const { page, errs } = await open('ja', AMT, 'light', { a: 'ana', b: 'jal' });
  const rowOf = (snap, re) => snap.rows.find((r) => re.test(r.k)) || { a: '', b: '', d: '' };
  const j = await page.evaluate(SNAP);
  const jp = rowOf(j, /パーディアム（月額）/), jh = rowOf(j, /住宅手当（月額）/);
  ok(jp.a === '¥100,000' && jp.b === '¥120,000' && jp.d === '+¥20,000'
     && jh.a === '¥73,000' && jh.b === '¥81,000' && jh.d === '+¥8,000',
     '★円 ── 手当の月額は今までどおり有効数字2桁（¥100,000 と ¥120,000 → +¥20,000）',
     JSON.stringify([jp, jh]));
  await page.evaluate(() => window.PVCurrency.set('USD'));
  await page.waitForFunction(
    () => /\$/.test((document.querySelector('#dc-diff .dc-tr:not(.dc-th) .dc-c2') || {})
      .textContent || ''), { timeout: 10000 });
  const u = await page.evaluate(SNAP);
  const up = rowOf(u, /パーディアム（月額）/), uh = rowOf(u, /住宅手当（月額）/);
  ok(up.a === '$640' && up.b === '$780' && up.d === '+$140'
     && uh.a === '$460' && uh.b === '$510' && uh.d === '+$50',
     '★★ドル ── 月額はその通貨の中で2桁（$629 のような端数を出さない）・差はその引き算',
     JSON.stringify([up, uh]));
  await page.evaluate(() => window.PVCurrency.set('EUR'));
  await page.waitForFunction(
    () => /€/.test((document.querySelector('#dc-diff .dc-tr:not(.dc-th) .dc-c2') || {})
      .textContent || ''), { timeout: 10000 });
  const e = await page.evaluate(SNAP);
  const ep = rowOf(e, /パーディアム（月額）/), eh = rowOf(e, /住宅手当（月額）/);
  /* 640 → €547.8 → €550 ／ 780 → €667.7 → €670 ／ 460 → €393.8 → €390 ／ 510 → €436.6 → €440 */
  ok(ep.a === '€550' && ep.b === '€670' && ep.d === '+€120'
     && eh.a === '€390' && eh.b === '€440' && eh.d === '+€50',
     '★★ユーロ ── 換算してから2桁に寄せる（どの額も上から2桁のあとは 0）',
     JSON.stringify([ep, eh]));
  ok(errs.length === 0, '（9c）JS のエラーが出ない', errs.join(' / '));
}

// ── 10. 引けなかったとき ────────────────────────────────────────
{
  const { page, errs } = await open('ja', { __err: true, air: AIR });
  const s = await page.evaluate(SNAP);
  ok(s.pickHidden === true && s.pickShown === false && s.rows.length === 0,
     '★引けなかった画面では選ばせない・数字も出さない');
  ok(!/[¥$]\s?\d/.test(s.text), '引けなかった画面に金額が出ない');
  /* ★引けなかった画面は「閉じている」ではない。影絵を出すと、鍵が無いように読める。 */
  ok(noGhost(s) && s.lock === 0, '★引けなかった画面に影絵も錠前の板も出さない', ghostWhy(s));
  ok(errs.length === 0, '引けなくても JS のエラーにしない', errs.join(' / '));
}

// ── 11. 日英 × 明暗 ─────────────────────────────────────────────
for (const [lang, theme] of [['ja', 'dark'], ['en', 'light'], ['en', 'dark']]) {
  const { page, errs } = await open(lang, OK, theme, { a: 'ana', b: 'jal' });
  const s = await page.evaluate(SNAP);
  const tag = `${lang}/${theme}`;
  ok(!/undefined|NaN|\[object|\bnull\b/.test(s.text),
     `${tag}: undefined・NaN・null が出ない`,
     (s.text.match(/.{0,24}(undefined|NaN|\[object|\bnull\b).{0,24}/) || [''])[0]);
  ok(s.rows.length === 9 && s.bars.join(',') === '5,5', `${tag}: 表も棒も同じだけ出る`,
     `${s.rows.length} / ${s.bars.join(',')}`);
  ok(s.to.length === 2 && s.toEnd.length > 0, `${tag}: トレードオフと締めの1行が出る`);
  /* ★人数を出さないのは日英・明暗とも同じ（2026-10-11）。注記の2つの文も、
     壁が在ることだけを言う（前は「3人以上」「3人に満たない」「3 or more pilots」）。 */
  ok(!NOCOUNT.test(s.main), `${tag}: ★★本文に人数の形の字が1つも無い`, countIn(s.main));
  ok(lang === 'ja'
       ? s.main.includes('※ データが十分にそろった区分だけを出しています。Pay / Block Hour は、1人ずつ')
         && s.main.includes('※ データが足りない項目は棒に入れていません。')
       : s.main.includes('Only groups with enough data are shown. Pay / Block Hour is')
         && s.main.includes('Items without enough data are left out of the bar,'),
     `${tag}: ★注記は壁が在ることだけを言う（何人かは書かない）`);
  ok(lang === 'ja' ? s.sideC.join(',') === '信頼度 高,信頼度 中'
                   : s.sideC.join(',') === 'Confidence High,Confidence Medium',
     `${tag}: 信頼度の札が左右それぞれ出る`, s.sideC.join(','));
  ok(s.ctaA.join(',') === 'deep-pay.html',
     `${tag}: 戻り先は相対のまま（/en/ からは /en/deep-pay.html に解ける）`, s.ctaA.join(','));
  if (lang === 'en') {
    ok(saysHourly(s.text).en.length === 0,
       `${tag}: ★hourly rate / wage と呼ばない（否定する文だけ許す）`,
       saysHourly(s.text).en.join(' | '));
    ok(/not an hourly wage/i.test(s.text),
       `${tag}: ★「It is not an hourly wage.」の但し書きが画面に出ている`);
    ok(!/\b(better|best|winner|worse|beats)\b/i.test(s.text.replace(/It is not about which is[^.]*\./g, '')),
       `${tag}: ★勝ち負けの語を書かない`);
    ok(!/percentile|top \d/i.test(s.text), `${tag}: ★順位・パーセンタイルを書かない`);
    /* ★数字の定義（2026-09-01）。日本語だけ直して英語が古いまま、を防ぐ。 */
    ok(/Fixed & guaranteed share/.test(s.text) && !/Fixed pay share/.test(s.text),
       `${tag}: ★見出しは「Fixed & guaranteed share」`);
    ok(/housing in kind is not counted/.test(s.text),
       `${tag}: ★年収が何を含むかを画面に書く（現物の社宅は含まない）`);
    ok(!/monthly pay ÷/i.test(s.text) && /each pilot/i.test(s.text),
       `${tag}: ★Pay / Block Hour は「1人ずつ」（monthly pay ÷ … と書かない）`);
  }
  ok(errs.length === 0, `${tag}: JS のエラーが出ない`, errs.join(' / '));
}

// ── 12. 狭い画面（iOS の自動ズーム） ────────────────────────────
{
  /* ★assert-header.mjs の FORM_PAGES には足せない。あちらの偽セッションは rpc が
     null を返すので S.mode='error' → ピッカーが hidden → 欄が0個で**素通しで緑になる**。
     検査が無いより悪いので、ここで自前に実測する。 */
  const { page } = await open('ja', OK, 'light', null, null, 390);
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('#dc-pick select')]
      .map((e) => getComputedStyle(e).fontSize));
  ok(sizes.length === 5 && sizes.every((v) => parseFloat(v) >= 16),
     '★390px で <select> の実測 font-size が16px 以上（iOS が勝手に拡大しない）',
     JSON.stringify(sizes));
  const over = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 1, '★390px で横に溢れない', String(over));
}
// ── 12b. 狭い画面でも、機材と信頼度の札が出る（2026-10-11）──────────
/* ★実際に在った穴。640px を切ると表の見出し行を display:none にしていた。機材の札と
     信頼度の札は**その行にしか無い**（両側とも読めるときカード2枚は出ない）ので、
     スマホでは**どちらもどこにも出ていなかった**。人数のピルを信頼度の札に替えた回
     （2026-10-11）に、絵で気づいた。
   ★いまは見出し行を残し、「項目」の語だけを落として2社ぶんを頭に並べる。
   ⚠️ 札の見た目は左右で同じ。狭い画面だけ色を付けない（付けると勝ち負けに見える）。 */
for (const lang of ['ja', 'en']) {
  const { page, errs } = await open(lang, OK, 'light',
    { a: 'ana', b: 'jal', pos: 'cap', fltA: 'b787', fltB: 'b767' }, null, 390);
  const m = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const box = (e) => { const r = e.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left),
               r: Math.round(r.right), t: Math.round(r.top) }; };
    const chips = [...document.querySelectorAll('#dc-diff .dc-th .dc-side-c')];
    const flts  = [...document.querySelectorAll('#dc-diff .dc-th .dc-side-f')];
    const names = [...document.querySelectorAll('#dc-diff .dc-th .dc-side-n')];
    const look = (e) => { const c = getComputedStyle(e);
      return [c.color, c.backgroundColor, c.borderTopColor, c.fontSize, c.fontWeight].join('|'); };
    const th = document.querySelector('#dc-diff .dc-th');
    const first = document.querySelector('#dc-diff .dc-tr:not(.dc-th)');
    return {
      thShown: !!th && getComputedStyle(th).display !== 'none',
      itemShown: !!th && getComputedStyle(th.querySelector('.dc-c1')).display !== 'none',
      chips: chips.map((e) => ({ t: e.textContent.trim(), b: box(e), look: look(e) })),
      flts: flts.map((e) => ({ t: e.textContent.trim(), b: box(e),
                               cut: e.scrollWidth > e.clientWidth + 1 })),
      names: names.map((e) => ({ t: e.textContent.trim(), b: box(e) })),
      /* 見出しの2列が、値の2列と同じ並び（左＝会社A・右＝会社B）で頭に在ること。 */
      colsTh: [...th.querySelectorAll('.dc-c2, .dc-c3')].map((e) => box(e).l),
      colsRow: first ? [...first.querySelectorAll('.dc-c2, .dc-c3')].map((e) => box(e).l) : [],
      thTop: th ? box(th).t : 0, rowTop: first ? box(first).t : 0,
      rowNames: first ? [...first.querySelectorAll('.dc-c-a')]
        .filter((e) => getComputedStyle(e).display !== 'none').length : 0,
      out: [...document.querySelectorAll('#dc-diff *')].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.right > vw + 1 || r.left < -1);
      }).length,
      over: document.documentElement.scrollWidth - vw
    };
  });
  const want = lang === 'ja' ? ['信頼度 高', '信頼度 中'] : ['Confidence High', 'Confidence Medium'];
  ok(m.thShown && !m.itemShown,
     `${lang}: ★390px でも表の見出し行は出ている（落とすのは「項目」の語だけ）`,
     `見出し=${m.thShown} 項目の語=${m.itemShown}`);
  ok(m.chips.map((c) => c.t).join(',') === want.join(',')
     && m.chips.every((c) => c.b.w > 0 && c.b.h > 0),
     `${lang}: ★★390px で信頼度の札が左右それぞれ見えている`,
     JSON.stringify(m.chips.map((c) => [c.t, c.b.w, c.b.h])));
  ok(m.chips.length === 2 && m.chips[0].look === m.chips[1].look,
     `${lang}: ★札の見た目は左右で同じ（色で差を付けない）`,
     m.chips.map((c) => c.look).join('  ／  '));
  ok(m.flts.length === 2 && m.flts.every((f) => f.t.length > 0 && f.b.w > 0 && !f.cut),
     `${lang}: ★★390px で機材の札も左右それぞれ見えている（切れていない）`,
     JSON.stringify(m.flts.map((f) => [f.t, f.b.w, f.cut])));
  ok(m.names.length === 2 && m.names.every((n) => n.t.length > 0 && n.b.w > 0),
     `${lang}: 社名も左右それぞれ出ている`, m.names.map((n) => n.t).join(' / '));
  ok(m.colsTh.length === 2 && m.colsRow.length === 2
     && Math.abs(m.colsTh[0] - m.colsRow[0]) <= 1 && Math.abs(m.colsTh[1] - m.colsRow[1]) <= 1
     && m.colsTh[0] < m.colsTh[1] && m.thTop < m.rowTop,
     `${lang}: ★見出しの2列は、値の2列と同じ位置で表の頭に在る（左＝会社A・右＝会社B）`,
     JSON.stringify([m.colsTh, m.colsRow]));
  ok(m.rowNames === 2, `${lang}: 値の側の会社名（行ごと）も今までどおり出ている`, String(m.rowNames));
  ok(m.over <= 1 && m.out === 0, `${lang}: ★見出し行を出しても横に溢れない`,
     `文書 +${m.over}px / 外へ出た要素 ${m.out}`);
  ok(errs.length === 0, `${lang}: 狭い画面で JS のエラーが出ない`, errs.join(' / '));
  await jars.pop().close().catch(() => {});
}

// ── ⑬ 1画面に収まる ＋ <select> が切れていないこと ───────────────
/* オーナー確定 2026-08-31 ── 基準は**オーナーの画面（約 1512×980）**。
   ★2026-08-31 に**収まった**。1685.7 →（詰める）→ 1202 →（表を左・棒を右に並べる）→
     ja 923 / en 932。ここは後戻り止めではなく「1画面に収まる」ことそのものの検査。

   ⚠️ ここの数字は shot-compare.mjs の measure と少しずれる。この検査は外の網を
      1本も引かない＝ Inter が落ちてこないので、**代替フォントは横に広い**
      （ここでの実測 ja 931 / en 938.1）。正確な実測は
      `node shot-compare.mjs full ja light 1512 measure`。
      しきい値 980 はオーナーの画面の高さそのもの。40px ほどの余裕しか無いので、
      段を1つ足せば（100〜300px）必ず赤くなる。
      ★2026-10-11 に測り直した値（人数を外し、文言を替えた回）── ja 912.9 / en 898.2
        （本物のフォント）／ja 915.9 / en 915.9（ここ）。余裕は 64px ほど。
        どこで縮んだかは切り分けていない（上の 931 / 938.1 は 2026-08-31 の値）。

   ★<select> は溢れても省略記号すら出さない ── 「Boeing 787 Dreamli」と読める形で
     止まるので、**切れたことが画面から分からない**。だから毎回測る。 */
for (const lang of ['ja', 'en']) {
  const { page } = await open(lang, OK, 'light', { a: 'ana', b: 'jal' }, null, 1512);
  await page.setViewport({ width: 1512, height: 1000 });
  await page.waitForFunction(() => innerWidth === 1512, { timeout: 10000 });
  const m = await page.evaluate(() => {
    let bottom = 0;
    (function walk(n) {
      for (const c of n.children) {
        const r = c.getBoundingClientRect();
        if (r.height > 0) bottom = Math.max(bottom, r.bottom + scrollY);
        walk(c);
      }
    })(document.getElementById('dc-root'));
    const cv = document.createElement('canvas').getContext('2d');
    const cut = [];
    for (const el of document.querySelectorAll('#dc-pick select')) {
      const st = getComputedStyle(el);
      cv.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
      const wide = [...el.options]
        .reduce((a, o) => Math.max(a, cv.measureText(o.textContent.trim()).width), 0);
      const inner = el.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
      cut.push({ id: el.id, slack: Math.round((inner - wide) * 10) / 10 });
    }
    return { bottom: Math.round(bottom * 10) / 10, cut };
  });
  ok(m.bottom <= 980, `★1画面に収まる（${lang} / 1512×980）`,
     `底 ${m.bottom}`);
  ok(m.cut.every((c) => c.slack >= 0),
     `★<select> の選択肢が切れていない（${lang} / 1512）`,
     m.cut.map((c) => `${c.id} ${c.slack}`).join(' / '));
}

// ── 13. 選べる ＝ 必ず数字が返る（2026-09-01）───────────────────
/* 110社 × 3役職 × 19機種を全部並べても、中身があるのはごく一部。選んで初めて
   「まだ出せません」と分かるのをやめる ── サーバが「数字が返る組み合わせ」を
   全部返し、**画面はそれを引くだけ**（人数の壁は SQL の1か所にしかない）。
   ⚠️ 見るのは6つ。**(b) が命綱**（db/*.sql は push では本番に入らない。
      貼る前に push すると選択欄が空になる ── それが**正しい**ことを見張る）。 */
{
  // (a) 会社は一覧にある会社だけ。左右とも同じ一覧
  {
    const { page, errs } = await open('ja', OK, 'light');
    await page.waitForFunction(() => !!document.querySelector('#dc-pk-a option[value="ana"]'),
                               { timeout: 20000 });
    const s = await page.evaluate(SNAP);
    /* ★並び順は語彙（pv-airlines.json）の順で、一覧の順ではない。集合で見る。 */
    const want = 'ana,emirates,jal,lufthansa,qatar-airways,sas,singapore-airlines';
    const set = (l) => (l || []).slice().sort().join(',');
    ok(set(s.opt.a) === want && set(s.opt.b) === want,
       '★★選べる会社だけが選択肢に残る（110社は並べない・左右とも同じ一覧）',
       `A=${s.opt.a.join(',')} / B=${s.opt.b.join(',')}`);
    ok(s.pickHidden === false && s.pickShown === true,
       '2社以上あるので選択欄は出たまま');
    ok(errs.length === 0, '（13a）JS エラーが出ていない', errs.join(' | '));
  }

  // (b) ★命綱★ 一覧が届かない・空のときは選択欄ごと出さない（全社に逃げない）
  for (const [nm, pl] of [['一覧が届かない', { ...OK, __nopicks: true }],
                          ['一覧が空の', { ...OK, __picks: { air: [], pos: {}, flt: {} } }]]) {
    const { page, errs } = await open('ja', pl, 'light');
    await page.waitForFunction(
      () => !!document.querySelector('#dc-sides .dp-msg'), { timeout: 20000 });
    await airsIn(page);   /* ★辞書が着くまで（.dp-msg だけでは途中を写す）*/
    const s = await page.evaluate(SNAP);
    ok(s.pickShown === false && !s.opt.a && !s.opt.b && s.pick.length === 0,
       `★★${nm}ときは選択欄を出さない（110社を並べる逃げ道は置かない）`,
       `shown=${s.pickShown} / A=${s.opt.a && s.opt.a.length}`);
    ok(noGhost(s) && s.lock === 0, `★${nm}ときの画面に影絵が無い（開いている）`, ghostWhy(s));
    ok(errs.length === 0, `（13b/${nm}）JS エラーが出ていない`, errs.join(' | '));
  }

  // (c) 役職は**両社に共通**の分だけ／機材は 会社 × 役職 で左右べつべつ
  {
    const { page, errs } = await open('ja', OK, 'light');
    await choose(page, { a: 'ana', b: 'sas' }, 2);
    const s = await page.evaluate(SNAP);
    ok(s.opt.pos.join(',') === 'cap,fo',
       '役職は両社に共通の分だけ（ana ∩ sas）', `今 ${s.opt.pos.join(',')}`);
    /* ★機材を左右で分けた理由そのもの。同じ役職でも会社が違えば飛ぶ機材が違う。
         1本にまとめると、どちらかで必ず空振りする組み合わせが選べてしまう。 */
    await choose(page, { a: 'ana', b: 'sas', pos: 'cap' }, 2);
    const c = await page.evaluate(SNAP);
    ok(c.opt.fa.join(',') === 'b777,b787' && c.opt.fb.join(',') === 'a320',
       '★★機材は左右べつべつ（会社 × 役職 で数字が返るものだけ）',
       `A=${c.opt.fa.join(',')} / B=${c.opt.fb.join(',')}`);
    ok(errs.length === 0, '（13c）JS エラーが出ていない', errs.join(' | '));
  }

  // (d) 左右で違う機材を選ぶと、サーバへも違う引数で引く
  {
    const { page, errs } = await open('ja', OK, 'light');
    await choose(page, { a: 'ana', b: 'jal', pos: 'cap' }, 2);
    await choose(page, { a: 'ana', b: 'jal', pos: 'cap', fltA: 'b777', fltB: 'b767' }, 2);
    const s = await page.evaluate(SNAP);
    const l = s.args.slice(-2).map((x) => x && x.p);
    ok(l[0] && l[1] && l[0].airline === 'ana' && l[0].fleet === 'b777'
       && l[1].airline === 'jal' && l[1].fleet === 'b767'
       && l[0].position === 'cap' && l[1].position === 'cap',
       '★★左右で違う機材・同じ役職でサーバを引く（画面と問い合わせがずれない）',
       JSON.stringify(l));
    /* ★機材はどこかに必ず出る。両側読めるときカードは出ないので、
         表の見出しに添えていないと**機材がどこにも出ない画面**ができる。 */
    ok(s.sideF.length === 2 && /777/.test(s.sideF[0]) && /767/.test(s.sideF[1]),
       '★★選んだ機材が左右それぞれの見出しに出る（どこにも出ない画面を作らない）',
       s.sideF.join(' / '));
    ok(errs.length === 0, '（13d）JS エラーが出ていない', errs.join(' | '));
  }

  // (e) 会社を変えると、その会社に無い役職・機材が黙って落ちる
  {
    const { page, errs } = await open('ja', OK, 'light');
    await choose(page, { a: 'ana', b: 'jal', pos: 'cap', fltA: 'b777', fltB: 'b767' }, 2);
    await choose(page, { a: 'sas', b: 'jal', pos: 'cap' }, 2);
    const s = await page.evaluate(SNAP);
    const fa = await page.evaluate(() => document.getElementById('dc-pk-fa').value);
    ok(fa === '' , '★★会社を変えると、その会社に無い機材が落ちる', `機材A "${fa}"`);
    const last = s.args.slice(-2).map((x) => x && x.p && x.p.fleet);
    ok(last[0] === undefined || last[0] === null || last[0] === '',
       '★★落とした後の値でサーバを引く', JSON.stringify(last));
    ok(errs.length === 0, '（13e）JS エラーが出ていない', errs.join(' | '));
  }

  // (f) 1社しか無ければ選ばせず、理由と投稿の入口を出す
  {
    const ONE = { ...OK, __picks: { air: ['ana'], pos: { '': ['cap'], ana: ['cap'] },
                                    flt: { '|': ['b787'], '|cap': ['b787'],
                                           'ana|': ['b787'], 'ana|cap': ['b787'] } } };
    const { page, errs } = await open('ja', ONE, 'light');
    await page.waitForFunction(
      () => !!document.querySelector('#dc-sides .dp-msg'), { timeout: 20000 });
    await airsIn(page);   /* ★辞書が着くまで（.dp-msg だけでは途中を写す）*/
    const s = await page.evaluate(SNAP);
    ok(s.pickHidden === true && s.pickShown === false,
       '★★比べられる会社が1社なら選択欄を出さない', `hidden=${s.pickHidden}`);
    ok(/2社/.test(s.msg), '理由が出ている', s.msg);
    /* ★「比べられる会社が足りない」の板は、開いた画面の中の話。影絵は出さない ──
         出すと「鍵が無いから見えない」と読める（足りないのは会社の数）。 */
    ok(noGhost(s) && s.lock === 0, '★★比べられる会社が足りない板の後ろには影絵を置かない', ghostWhy(s));
    ok(s.ctaA.length > 0 || /pay-report\.html/.test(await page.evaluate(
         () => document.querySelector('#dc-sides a.dp-cta')?.getAttribute('href') || '')),
       '投稿の入口が出ている');
    /* ★出していいのは**動かない壁**のうち「比べるには2社」だけ（2026-10-11 から、
         区分の壁が何人かも書かない。前は「3人そろった会社から順に出ます。」）。
         いま何社あるか・あと何人かを書かない ── 書いた瞬間、その会社の人数が
         1人単位で読める（招待の画面と同じ約束）。 */
    const bare = s.msg.replace(/まだ2社/g, '');
    ok(!/[0-9０-９]/.test(bare) && !/あと/.test(s.msg),
       '★★いま何社・何人いるかを書かない（壁の人数も「あと1人」も書かない）', s.msg);
    ok(s.msg.includes('データがそろった会社から順に出ます。') && !NOCOUNT.test(s.main),
       '★比べられる会社が足りないときの案内に人数を書かない', s.msg);
    ok(errs.length === 0, '（13f）JS エラーが出ていない', errs.join(' | '));

    // (f-en) 英語側も同じ（片方だけ直した、を捕まえる）
    const { page: p2 } = await open('en', ONE, 'light');
    await p2.waitForFunction(
      () => !!document.querySelector('#dc-sides .dp-msg'), { timeout: 20000 });
    await airsIn(p2);     /* ★辞書が着くまで（.dp-msg だけでは途中を写す）*/
    const e = await p2.evaluate(SNAP);
    ok(e.pickShown === false && /Not enough airlines/.test(e.msg),
       '★英語側も同じ（日本語だけ直した、にしない）', e.msg.slice(0, 60));
    ok(!/[0-9]/.test(e.msg) && e.msg.includes('Airlines appear once enough pilots have reported.')
       && !NOCOUNT.test(e.main),
       '★英語側も人数を書かない（数字が1文字も無い。前は「once 3 pilots have reported」）',
       e.msg.slice(0, 80));
  }

  // (g) 鍵が掛かっている人には一覧が無い＝今までどおり選択欄ごと出ない
  {
    const { page } = await open('ja', LOCK, 'light');
    const s = await page.evaluate(SNAP);
    ok(s.pickShown === false && s.lock === 1,
       '鍵が掛かっているときは今までどおり錠前の画面', `${s.pickShown} / ${s.lock}`);
  }
}

/* ── ⑭ 狭い画面でも <select> が切れない（2026-08-31）─────────────
   ★実際に踏んだ形を固定する。「選択をクリア」の列を 640px でも作っていたため、
     その 123px ぶん欄が痩せて社名が 107px 欠けていた。切れても省略記号は出ない
     ので、**画面を見ても気づけない**。だから幅を変えて測る。
   ★2026-09-01 に欄が5つになった（機材を左右に分けた）ので折り返しも測り直した。
     要る幅は **会社 335px / 機材 296px / 役職 165px**（`measure` の「最長」＋▼18＋余白20）。
   ・900 … 2列（3列にすると会社が 335px を割る。折り返しは 1240px）
   ・640 … 1列（2列だと割る。折り返しは 800px）
   ⚠️ ここを緑にするために .dp-pick-f へ justify-self:start を掛けない。
      掛けると欄が中身の幅まで縮んで測定値だけ良くなり、実際は欄の幅が
      バラバラになる（実際にやった）。 */
for (const lang of ['ja', 'en']) {
  for (const w of [900, 640]) {
    const { page } = await open(lang, OK, 'light', { a: 'ana', b: 'jal' }, null, w);
    await page.setViewport({ width: w, height: 1000 });
    await page.waitForFunction((x) => innerWidth === x, { timeout: 10000 }, w);
    const cut = await page.evaluate(() => {
      const cv = document.createElement('canvas').getContext('2d');
      return [...document.querySelectorAll('#dc-pick select')].map((el) => {
        const st = getComputedStyle(el);
        cv.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
        const wide = [...el.options]
          .reduce((a, o) => Math.max(a, cv.measureText(o.textContent.trim()).width), 0);
        const inner = el.clientWidth
          - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
        return { id: el.id, slack: Math.round((inner - wide) * 10) / 10 };
      });
    });
    ok(cut.length === 5 && cut.every((c) => c.slack >= 0),
       `★<select> の選択肢が切れていない（${lang} / ${w}）`,
       cut.map((c) => `${c.id} ${c.slack}`).join(' / '));
  }
}

for (const j of jars) await j.close().catch(() => {});
await browser.close();

console.log(`\n${fail ? '❌' : '✅'} pass ${pass} / fail ${fail}`);
process.exit(fail ? 1 : 0);
