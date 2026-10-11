/* assert-deep-pay-compare.mjs — 会社比較（deep-pay-compare.html / .js / .css）の約束。

   assert-deep-pay.mjs（概要ページ）とは**別ファイル**にしてある。理由は2つ。
   1. この画面の偽サーバは**会社コードごとに違う答えを返す**必要がある。
      1つの payload を返す向こうの FAKE では左右が同じ数字になり、
      「差がつくポイント」も「トレードオフ」も出ない＝素通しで緑になる。
   2. あちらは既に700行を超えている。

   ★2枚にまたがる不変条件（DEEP PAY への入口が対の外から生えていないこと）は
     assert-deep-pay.mjs ① に置いてある。ここには書かない（2か所で同じことを
     見張ると、片方だけ緩めたときに気づけない）。

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
    ok((jsC.match(/\blockStage\(/g) || []).length === 2
       && /lockBoard\(box, lockStage\(\(S\.boot && S\.boot\.gate\) \|\| \{\}\)\);/.test(jsC),
       '★影絵を置く道は shut(\'lock\') の1本だけ（lockStage の呼び出しは1か所）',
       String((jsC.match(/\blockStage\(/g) || []).length));
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
  /* 見本の金額が消し忘れで残っていないか。桁の大きい裸の数字は全部それ。 */
  const nums = (jsC.match(/\b\d{5,}\b/g) || []);
  ok(nums.length === 0, '★deep-pay-compare.js に5桁以上の裸の数字が無い（見本の金額の残り）',
     nums.join(' '));

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
  for (const name of ['sig2', 'sigIn', 'stepIn', 'money', 'moneyRate', 'moneyExact',
                      'segPct', 'airName', 'lockLines', 'lockHref', 'lockBoard',
                      'todoNames', 'todoMonth', 'lockTodo', 'lockHtml',
                      'ghBar', 'ghBars', 'ghField', 'ghHead', 'ghostTint', 'lockStage']) {
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
    for (const key of ['lockReady', 'lockTodoH', 'lockWarn']) {
      const a = vals(jsC, key), b = vals(dpC, key);
      ok(a.length === 2 && b.length === 2 && a.join('\n') === b.join('\n'),
         `★${key} は日英の2つずつ・deep-pay.js と同じ字`,
         `比較 ${a.length} 個 / DEEP PAY ${b.length} 個`);
    }
    ok(!/\blockDet\b/.test(jsC) && !/\blockDet\b/.test(dpC)
       && !/\bg\.detailed\b|\bgate\.detailed\b/.test(jsC),
       '★前の行（lockDet）と前の鍵（gate.detailed）が、どちらの JS にも残っていない');
    ok(/detailed:\s*\(v && v\.give\) \? v\.give\.detailed : null/.test(jsC),
       '左メニューの札へ渡すのは今までどおり give.detailed（門の値ではない）');
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
    /* give.detailed は門とは別の値（左メニューの札が読む）。板には効かない。 */
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
      getSession: async () => ({ data: { session: P.__anon
        ? null : { user: { id: UID, email: 'pilot@example.com' } } } }),
      getUser: async () => ({ data: { user: { id: UID, email: 'pilot@example.com' } } }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: () => q([]),
    rpc: (name, args) => {
      window.__rpc[name] = (window.__rpc[name] || 0) + 1;
      if (name === 'pv_deep_pay') window.__rpcArgs.push(args === undefined ? null : args);
      const res = (P.__err && name === 'pv_deep_pay')
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
       ロゴ・社名・人数が**表の見出し行**に出る（カードは出ない）。
       器を問わず「2社の名前と人数が1つずつ出ている」ことを見る。 */
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
    /* ★本文だけ（#dc-root）。人数の形の字を探すのはこちら ── body 全体には
       左メニューの札（「37 / 100人」）が入っていて、あれはこの画面の本文ではない。 */
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

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
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

async function open(lang, payload, theme, sel, expect, width) {
  const jar = await browser.createBrowserContext();
  jars.push(jar);
  const page = await jar.newPage();
  await page.setViewport({ width: width || 1360, height: 1200 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = r.url();
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
  await page.evaluateOnNewDocument(FAKE, payload);
  await page.goto(BASE + (lang === 'en' ? '/en/' : '/') + 'deep-pay-compare.html',
                  { waitUntil: 'domcontentloaded', timeout: 30000 });
  /* ★__hold（答えを止めた見本）は待たない ── 骨組みが残っていることを見る筋書き。 */
  if (!(payload && (payload.__anon || payload.__hold))) {
    await page.waitForFunction(() => !!document.querySelector('#dc-hd h1'), { timeout: 20000 });
    await page.waitForFunction(() => !document.querySelector('#dc-sides .mr-skel'),
                               { timeout: 20000 });
  }
  if (sel) await choose(page, sel, expect == null ? 2 : expect);
  return { page, errs };
}

// ── 1. 未ログインはログインへ送る ───────────────────────────────
{
  const { page } = await open('ja', { __anon: true, air: AIR });
  await page.waitForFunction(() => /login\.html/.test(location.href), { timeout: 20000 });
  const u = new URL(page.url());
  ok(/\/login\.html$/.test(u.pathname), '未ログインはログイン画面へ送られる', u.pathname);
  ok(u.searchParams.get('redirect') === 'deep-pay-compare.html',
     '★戻り先が deep-pay-compare.html（deep-pay.html に取り違えない）',
     String(u.searchParams.get('redirect')));
}

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
        ready: '給与の項目をすべて答えると開きます。支給が無い項目は「該当なし」か 0 で答えます。',
        goal:  '給与を出したパイロットが100人に達すること（いま37人）。',
        warn:  '虚偽の情報や不正確な情報を提出した場合、利用規約に基づきアカウントを停止することがあります。',
        head:  'まだ答えていない項目（2026年9月分）' },
  en: { key:   'Share one pay report and it opens for 90 days.',
        ready: 'It opens once every item on your pay report is answered. Where nothing is paid, answer “None of this applies” or 0.',
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
                  warn: one('.dp-msg-w'), note: one('.dp-cta-n') } };
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
         && b.kids.join(' ') === 'dp-msg-t dp-msg-s dp-todo dp-msg-s dp-msg-w dp-cta dp-cta-n',
         `${tag}: ★板の並びは 見出し → 答えの行 → 一覧 → 100人の行 → 断り → ボタン → 注記`,
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
    ok(['line', 'head', 'chip', 'warn', 'note'].every((k) => c[k] != null && c[k] >= 4.5),
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
/* 12通りを1つの幅で回して、落ちた理由の名前を種類ごとに集める。 */
const GHOST_KINDS = [
  ['exist', '★★どの理由でも、影絵が1つ・器が1つ・「影絵 → 板」の順（ぼかしが効くのは影絵だけ）'],
  ['touch', '★★影絵は aria-hidden ＋ inert・焦点の当たるものが無い・押せない・選べない'],
  ['blur',  '★影絵に、ぼかしが実際に効いている（計算後の filter が blur(6〜10px)）'],
  ['empty', '★★影絵に字が1文字も無い（数字も通貨記号も無い）・class と style のほかに属性が無い'],
  ['board', '★板は手前・面が透けていない・幅に収まり真ん中・上に寄せてある・何も乗っていない'],
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
  if (!(f.alpha >= 0.99 && f.left >= 0 && f.right <= f.vw + 0.5 && Math.abs(f.centre) <= 1
        && f.boardW <= 640 && f.covered === 0 && f.inside && f.z[1] > f.z[0] && f.shadows >= 3
        && f.topGap >= 0 && f.topGap <= 40 && f.underTitle != null
        && f.underTitle <= (w <= 640 ? 32 : 60)))
    bad.board = `α ${f.alpha} 左右 ${f.left}..${f.right}/${f.vw} ずれ ${f.centre} 幅 ${f.boardW} 乗っている点 ${f.covered}`
      + ` はみ出し ${!f.inside} z ${f.z} 影 ${f.shadows} 器の上から ${f.topGap} 見出しの下から ${f.underTitle}`;
  if (!(f.btn && f.btnIn)) bad.click = `当たる=${f.btn} 板の中=${f.btnIn}`;
  /* ★器の高さは「760px まで」か「板＋上下の余白」の大きいほう。余白はいちばん広い
       スマホで 14＋200px（下の 200px は、板の下に影絵を覗かせる場所）。それを超えて
       伸びていたら、影絵の中身に器が引っぱられている（影絵は器の高さを決めない）。 */
  if (!(f.over <= 1 && c.out.length === 0 && c.cut.length === 0
        && f.stageH <= Math.max(780, f.boardH + 230)))
    bad.fit = `文書 +${f.over}px 外 ${c.out.slice(0, 2).join(' ')} 切れ ${c.cut.slice(0, 2).join(' ')} 器 ${f.stageH} 板 ${f.boardH}`;
  const con = c.con || {};
  if (!(con.note != null && Object.keys(con).every((k) => con[k] == null || con[k] >= 4.5)))
    bad.con = JSON.stringify(con);
  return bad;
};
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
      await page.evaluate((a, b) => window.PVDeepPayCompare.render(a, b, { a: 'ana', b: 'jal' }),
        sideOf(AIR.ana), sideOf(AIR.jal));
      const opened = await page.evaluate(SNAP);
      ok(noGhost(opened) && opened.lock === 0 && opened.rows.length === 9,
         `${tag}: ★★閉じた → 開いた で、影絵も器も DOM から消える（ぼかしの効いた要素が残らない）`,
         ghostWhy(opened) + ' / 行 ' + opened.rows.length);
      await page.evaluate((p) => window.PVDeepPayCompare.lock(p), bootWith(POISON_GATE));
      const shutAgain = await page.evaluate(SNAP);
      ok(shutAgain.ghost === 1 && shutAgain.stage === 1 && shutAgain.lock === 1
         && shutAgain.rows.length === 0 && shutAgain.lowHidden === 4,
         `${tag}: 開いた → 閉じた で、影絵と板が戻り、表は跡形もなく消える`,
         ghostWhy(shutAgain) + ' / 行 ' + shutAgain.rows.length);
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
