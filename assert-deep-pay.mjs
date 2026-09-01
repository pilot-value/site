/* assert-deep-pay.mjs — 「DEEP PAY」（deep-pay）の約束を機械で確かめる。

   この画面は REAL PAY の詳細版ではない。**その仕事の経済的な実態**を
   ・年収がいくらか
   ・そのうち固定がどれだけか
   ・どれだけ働いてその額なのか
   ・変動給は何でできているか
   ・その数字がどれだけあてになるか
   の5つで見せる集計画面で、個人の明細は1件も出さない。

   ★この検査がいちばん守りたいのは「まだ開けていない」こと。
     2026-08-29 のオーナー判断で、ページ・SQL・JS は全部作るが
     **左メニューの錠前は掛けたまま**にした（オーナーだけが直接 URL で見る）。
     決定を持続させているのは、この下の「錠前」の節だけ。
     patch-side-nav.mjs の soon を外して commit した人は、ここで赤くなる。

   ★開ける日にやること（この検査を書き換える前に、この順で）──
     1. patch-side-nav.mjs の deep を href:'deep-pay.html' / soon を外す、
        pv-gates.js の DEEP PAY を state:'soon' から live へ。
     2. **patch-side-nav.mjs の CURRENT に deep-pay.html を足す。**
        足さないと現在地のハイライトだけが付かない（他は自動で走査される）。
        今わざと足していないのは、錠前が掛かっているうちは
        ハイライトする現在地が存在しないから。
     3. node patch-side-nav.mjs を流して、8枚のナビの差分を同じコミットに入れる。
     4. gen-sitemap.mjs / seo-normalize.mjs / assert-seo.mjs の NOINDEX から外す。
     5. この下の「錠前」の節を、開いた後の姿に書き換える。
     ⚠️ 1〜4 のどれか1つだけやると、sitemap と robots が食い違うのに
        何も赤くならない（CLAUDE.md の「同じ集合が4つある」）。

   見るのは9つ：

     ① 錠前がまだ掛かっている（メニューは soon、どの画面にも入口が無い、
        sitemap にも出ない）
     ② ぼかしで隠していない
        pv-gates.js の冒頭のとおり「隠すのではなく、最初から渡さない」。
        blur / filter / mask / user-select:none をこの画面は1つも持たない。
        ⚠️ 例外を1つでも作らない。区切りの「/」のような無害な用途で許すと、
           次に**値そのもの**へ付いたときに赤くならない。
     ③ 作り物のデータを本番に置いていない（SAMPLE / DEMO / dummy / Math.random）
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

const JA   = read('deep-pay.html');
const EN   = read('en/deep-pay.html');
const JS   = read('deep-pay.js');
const CSS  = read('deep-pay.css');
const SQL  = read('db/deep-pay.sql');
const jsC  = decomment(JS);
const cssC = decomment(CSS);

// ════════════════════════════════════════════════════════════════
// ① 錠前がまだ掛かっている
// ════════════════════════════════════════════════════════════════
console.log('\n════ ① 錠前（この決定を持続させるのはここだけ）════');
{
  const nav = read('patch-side-nav.mjs');
  const line = (decomment(nav).split('\n').find((l) => /key:\s*'deep'/.test(l)) || '');
  ok(/href:\s*''/.test(line), '★左メニューの DEEP PAY は行き先を持たない（href が空）', line.trim().slice(0, 90));
  ok(/soon:\s*true/.test(line), '★左メニューの DEEP PAY は soon（錠前）のまま', line.trim().slice(0, 90));

  const gates = decomment(read('pv-gates.js'));
  const soon = gates.match(/state:\s*'soon'/g) || [];
  ok(soon.length === 2, `★pv-gates.js の soon はちょうど2つ（DEEP と VERIFIED）`, `今 ${soon.length}`);
  ok(/key:\s*'deep',\s*state:\s*'soon'/.test(gates), '★pv-gates.js の deep が soon のまま');

  /* ★DEEP PAY は2枚になった（概要 deep-pay.html と 会社比較 deep-pay-compare.html）。
     2枚は互いに行き来してよいが、**対の外からは1本も生えていない**こと ── これが
     「まだ開けていない」の実体。だから「入口が0本」ではなく**対の閉包**で見る。
     ⚠️ ここを `linked` の中身が特定の配列と一致、に緩めてはいけない。それだと
        index.html から deep-pay-compare.html へ生えた入口を**1本も数えないまま通る**。
        内と外に振り分けて、外を0本に固定する形でなければ今より弱くなる。
     ⚠️ 入口は HTML の <a> だけに在るとは限らない ── 実際いま在る2本は**両方とも JS が
        組み立てている**（deep-pay.js の ln() と deep-pay-compare.js の href="…"）。
        だから root の *.js も同じ網で見る。 */
  const PAIR = new Set([
    'deep-pay.html', 'en/deep-pay.html',
    'deep-pay-compare.html', 'en/deep-pay-compare.html',
    'deep-pay.js', 'deep-pay-compare.js'
  ]);
  /* どちらの画面を指しているかだけ取り出す。'/' か '=' の直後、または先頭。
     ★長いほう（-compare）を先に書く ── 順を逆にすると deep-pay-compare.html が
       deep-pay.html に前方一致で吸われて、行き先を取り違える。 */
  const WHICH = /(?:^|[/=])(deep-pay-compare\.html|deep-pay\.html)/;
  const dirs = ['.', 'en', 'airlines', 'en/airlines'];
  const inside = [], outside = [];
  const add = (rel, target) => (PAIR.has(rel) ? inside : outside).push(rel + ' → ' + target);

  for (const d of dirs) {
    const abs = new URL(d + '/', ROOT);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      if (!f.endsWith('.html')) continue;
      const rel = (d === '.' ? '' : d + '/') + f;
      /* canonical / alternate / stylesheet は deep-pay 自身の head なので数えない
         （見るのは <a> だけ）。ログインの戻り先も <a> ではなく inline の JS。 */
      for (const m of nohtmlcomment(read(rel)).matchAll(/<a\b[^>]*href="([^"]*)"/gi)) {
        const hit = WHICH.exec(m[1]);
        if (hit) add(rel, hit[1]);
      }
    }
  }
  for (const f of readdirSync(ROOT)) {
    /* lang-toggle.js は言語切替の名簿（生成物）で、入口ではない。⑩ が別に見ている。 */
    if (!f.endsWith('.js') || f === 'lang-toggle.js') continue;
    for (const m of decomment(read(f)).matchAll(/['"]([^'"]*deep-pay[\w-]*\.html)['"]/g)) {
      const hit = WHICH.exec(m[1]);
      if (hit) add(f, hit[1]);
    }
  }

  ok(outside.length === 0, '★対の外の画面・JS から DEEP PAY への入口が無い', outside.join(' / '));
  const EDGES = ['deep-pay-compare.js → deep-pay.html',
                 'deep-pay.js → deep-pay-compare.html'].join(' / ');
  /* 日英で同じ JS を共有しているので、2往復ぶんの実体はこの2本。 */
  ok([...new Set(inside)].sort().join(' / ') === EDGES,
     '★対の中の行き来はこの2本だけ（日英が共有）', inside.sort().join(' / '));

  ok(!/deep-pay/.test(read('sitemap.xml')), '★sitemap.xml に出ない（noindex）');
  ok(/name="robots"\s+content="noindex/.test(nohtmlcomment(JA)), 'ja: noindex を宣言している');
  ok(/name="robots"\s+content="noindex/.test(nohtmlcomment(EN)), 'en: noindex を宣言している');
}

// ════════════════════════════════════════════════════════════════
// ② ぼかしで隠していない ／ ③ 作り物を置いていない
// ════════════════════════════════════════════════════════════════
console.log('\n════ ②③ 隠さない・作らない ════');
{
  const hide = [
    [/blur\s*\(/i, 'blur()'],
    [/(^|[^-\w])filter\s*:/, 'filter:'],
    [/backdrop-filter/i, 'backdrop-filter'],
    [/\bmask(-image)?\s*:/i, 'mask:'],
    [/user-select\s*:\s*none/i, 'user-select:none']
  ];
  for (const [re, name] of hide) {
    ok(!re.test(cssC), `★deep-pay.css に ${name} が無い（隠すのではなく渡さない）`);
    ok(!re.test(jsC),  `★deep-pay.js に ${name} が無い`);
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
     （158.95 だけは currency.js が無いときの USD レートの既定値＝my-value.js:671 の写し） */
  const nums = (jsC.match(/\b\d{5,}\b/g) || []).filter((n) => n !== '158');
  ok(nums.length === 0, '★deep-pay.js に5桁以上の裸の数字が無い（見本の金額の残り）', nums.join(' '));
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
  /* ★写してはいけないもの。ぼかしは仕様でも pv-gates.js の冒頭でも禁止。 */
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
     COMP の色に固定されていて**年額前提**。こちらは8区分・月額・賞与抜き。 */
  ok(!/compSegs/.test(jsC), '★PVViz.compSegs を使っていない（5バケツ・年額前提）');
  for (const [name, raw] of [['ja', JA], ['en', EN]]) {
    const html = nohtmlcomment(raw);
    const at = (f) => html.search(new RegExp('(?:src|href)="[^"]*' + f.replace('.', '\\.') + '"'));
    ok(at('pay-viz.css') >= 0 && at('pay-viz.js') >= 0, `${name}: pay-viz を読んでいる`);
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
     ★数を固定する。将来3本目の補助関数を足した人が、grant を忘れる側ではなく
       「revoke を書き忘れる」側で赤くなるように。 */
  const helpers = ['public.pv_my_keys()', 'public.pv_deep_pct(numeric[])'];
  for (const h of helpers) {
    ok(SQL.includes(`revoke all on function ${h} from public, anon, authenticated;`),
       `★${h} は3ロールとも revoke（誰にも開かない）`);
    ok(!new RegExp('grant[^\\n]*' + h.replace(/[()[\]]/g, '\\$&')).test(SQL),
       `★${h} に grant が無い`);
  }
  const created = (SQL.match(/create or replace function public\.(\w+)/g) || [])
    .map((s) => s.split('.').pop());
  ok(created.length === helpers.length + 1,
     `★このファイルが作る関数は ${helpers.length + 1} 本（増えたら権限も書く）`, created.join(' '));

  ok(!/\bto anon\b/.test(SQL), '★anon には何も渡していない');
  ok(/access_until/.test(SQL), '鍵（access_until）を見ている');
  ok(/pv_my_give/.test(SQL), '本人が内訳を出したかを見ている');
  const three = (SQL.match(/>= *3\b/g) || []).length;
  ok(three >= 8, `★n ≧ 3 の門が8か所以上ある（今 ${three}）`);
  /* ★旧 pv_pay_comp を触らない（assert-pay-rows.mjs が本文を grep している）。 */
  ok(!/create or replace function public\.pv_pay_comp/.test(SQL),
     '★旧 pv_pay_comp を作り直していない');
  /* 返り値のキーは jsonb_build_object の中で 'name', の形で出る。
     列としての参照（where created_at >= …）は正しい使い方なので数えない。 */
  for (const k of ['period_month', 'created_at', 'proof_hash', 'airline_other']) {
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
// ブラウザ
// ════════════════════════════════════════════════════════════════
console.log('\n════ ブラウザ ════');

/* 偽物 Supabase。★rpc は本物と同じ「then だけを持つ箱」。 */
const FAKE = function (payload) {
  window.__rpc = {};
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
    from: () => q([]),
    rpc: (name, args) => {
      window.__rpc[name] = (window.__rpc[name] || 0) + 1;
      if (name === 'pv_deep_pay') window.__rpcArgs.push(args === undefined ? null : args);
      const res = (payload && payload.__err && name === 'pv_deep_pay')
        ? { data: null, error: { message: 'synthetic failure' } }
        : { data: RPC[name] ? RPC[name](args) : { ok: true }, error: null };
      return { then: (y, n) => Promise.resolve(res).then(y, n) };   // ★then だけ
    }
  };
  Object.defineProperty(window, 'supabase',
    { value: { createClient: () => CLIENT }, writable: false, configurable: false });
};

const STATS = { reports: 58, month: 12, airlines: 19, contributors: 37 };
const FULL = {
  ok: true, state: 'open',
  gate: { key: true, detailed: true, contributors: 37, goal: 100 },
  give: { detailed: true }, stats: STATS,
  cohort: { level: 'airline_pos_fleet', manual: false, airline: 'ana', pos: 'fo', fleet: 'a320', n: 12 },
  /* ★verified_n は「明細の裏付けがある人数」（db/deep-pay.sql:768 の hagg.vfn）。
     detailed_n と同じく**人数**で、12人のうち4人が明細を出した形。
     SEL 側にはわざと入れていない ── 0/未設定のときは条件バーに足さない
     （「うち明細あり 0人」は「信じるな」と書いているのと同じ）。 */
  /* ⚠️ per_block_usd 93 は annual_usd ÷ 12 ÷ block_h（110000÷12÷74 ≒ 124）と**一致しない**。
     見本が壊れているのではない。db/deep-pay.sql の hagg は**1人ずつ**比を出してから
     中央値を取るので、中央値どうしの割り算とは一致しないのが普通
     （よく飛ぶ人ほど年収が高い形なら必ずこうなる）。
     ★だから「画面の3つの数字が割り算で結べる」検査をここに足さない。
       結べることを確かめるのは db/test-deep-pay.mjs の19節 ── あちらは
       **全員まったく同じ値の区分**をわざと作って、中央値を個人の値に潰している。 */
  head: { annual_usd: 110000, per_block_usd: 93, detailed_n: 12, verified_n: 4, fixed_pct: 62 },
  comp: { total_kind: 'monthly_cash', n: 12,
    segs: [{ k: 'fixed', pct: 52, med_usd: 4800 }, { k: 'variable', pct: 24, med_usd: 2200 },
           { k: 'command', pct: 8, med_usd: 730 }, { k: 'perdiem', pct: 7, med_usd: 640 },
           { k: 'housing', pct: 5, med_usd: 460 }, { k: 'other', pct: 4, med_usd: 370 }],
    bonus: { pct_of_annual: 5, n: 9 } },
  work: { block_h: 74.0, duty_h: 141.0, duty_days: 18, stay_nights: 9 },
  var: [{ k: 'block', pct: 46 }, { k: 'sector', pct: 21 }, { k: 'overtime', pct: 13 },
        { k: 'night', pct: 11 }, { k: 'weekend', pct: 6 }, { k: 'holiday', pct: 3 }]
};
const clone = (o) => JSON.parse(JSON.stringify(o));
/* duty_days と stay_nights が3人に届かなかった形（列ごとの門）。 */
const HOLES = Object.assign(clone(FULL), {
  work: { block_h: 74.0, duty_h: 141.0, duty_days: null, stay_nights: 9 },
  var: [{ k: 'block', pct: 62 }, { k: 'duty', pct: 38 }]
});
/* 数字が1つも読めなかった形（カードは1枚も出ない＝0 を並べない）。 */
const NOHEAD = Object.assign(clone(FULL), {
  head: { annual_usd: null, per_block_usd: null, detailed_n: null, fixed_pct: null },
  comp: null, work: null, var: []
});
/* 手で選んだ区分（自分は ANA の FO なのに、JAL の機長・787 を見ている形）。 */
const SEL = Object.assign(clone(FULL), {
  cohort: { level: 'selected', manual: true, airline: 'jal', pos: 'cap', fleet: 'b787', n: 5 },
  head: { annual_usd: 210000, per_block_usd: 180, detailed_n: 5, fixed_pct: 71 }
});
/* 選んだ区分が3人に届かなかった形。★SQL は広い区分に登らないので、
   ここに来るのは「何も出せない」だけ。全体の数字は1つも入っていない。 */
const NONE = { ok: true, state: 'open', gate: clone(FULL.gate), give: { detailed: true },
  stats: STATS,
  cohort: { level: 'none', manual: true, airline: 'sas', pos: null, fleet: null, n: 0 },
  head: { annual_usd: null, per_block_usd: null, detailed_n: null, fixed_pct: null },
  comp: null, work: null, var: [] };
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
/* variable 区分が3人に届かなかった形。★KPI の「変動給比率」の行が**消える**こと
   （0% とも「100 − 固定給」とも書かない）を見るための見本。 */
const NOVAR = Object.assign(clone(FULL), {
  comp: { total_kind: 'monthly_cash', n: 12,
    segs: [{ k: 'fixed', pct: 52, med_usd: 4800 }, { k: 'command', pct: 8, med_usd: 730 },
           { k: 'perdiem', pct: 7, med_usd: 640 }, { k: 'housing', pct: 5, med_usd: 460 }],
    bonus: { pct_of_annual: 5, n: 9 } }
});
/* 賞与を書いた人が3人に届かず、割合が伏せられている形（comp.bonus が無い）。
   ★このとき月換算に「（賞与ぬき）」と名乗ってはいけない。賞与のある人が
     1〜2人いるかもしれず、その人たちのぶんは年収に入ったままだから。 */
const NOBONUS = Object.assign(clone(FULL), {
  comp: Object.assign(clone(FULL.comp), { bonus: null })
});

/* ★2026-08-30 から、この画面は**選ぶまで何も出さない**。だから見本の配置を見る
   筋書きは、先に区分を選ばせないと空のページを撮ることになる。
   中身は FAKE の鍵に使われるだけで、__pick を持たない見本はどの鍵でも
   同じ payload を返す＝見本そのものは1バイトも直さなくてよい。 */
const MINE = { airline: 'ana', position: 'fo', fleet: 'a320' };

const LOCK = { ok: true, state: 'locked', stats: STATS, give: { detailed: false },
               gate: { key: false, detailed: false, contributors: 37, goal: 100 },
               cohort: null, head: null, comp: null, work: null, var: null };

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const jars = [];
async function open(lang, payload, theme, pick) {
  const jar = await browser.createBrowserContext();
  jars.push(jar);
  const page = await jar.newPage();
  await page.setViewport({ width: 1360, height: 1200 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  /* ★外の網を1本も引かない。CDN（supabase-js）は parser-blocking なので、
     混んだ回や回線の悪い回に DOMContentLoaded ごと遅れて**嘘の赤**が出る
     （実測：新しい窓を3つ続けて開くと、3つ目の goto が 15秒で落ちた）。
     window.supabase は下の evaluateOnNewDocument が先に置いているので、
     CDN の中身は1バイトも要らない。 */
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
  await page.goto(BASE + (lang === 'en' ? '/en/' : '/') + 'deep-pay.html',
                  { waitUntil: 'domcontentloaded', timeout: 30000 });
  /* ★時間で待たない。deep-pay.js は必ず #dp-hd に <h1> を書いてから他を描く。 */
  if (!(payload && payload.__anon)) {
    await page.waitForFunction(() => !!document.querySelector('#dp-hd h1'), { timeout: 20000 });
    await page.waitForFunction(() => !document.querySelector('#dp-kpi .mr-skel'), { timeout: 20000 });
  }
  /* ★選ぶまで何も出ない（2026-08-30）。配置を見る筋書きはここで区分を選ぶ。 */
  if (pick) await choose(page, pick);
  return { page, errs };
}

/* 区分を選ぶ。★選択肢が生えるのを待ってから値を入れる。語彙（pv-vocab.json /
   salary-data.json）は RPC より遅れて着くことがあり、待たずに value を入れると
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
    /* ★注記（.dp-foot）は「どのカードの中に居るか」まで見る。2026-09-01 に
       給与構成のカードから KPI の下（全幅）へ移した ── あのカードは段の高さを
       決めている側で、狭いぶん1文が2〜3行に折れ、折れたぶんだけ画面が下へ伸びた。 */
    foot: q('#dp-root .dp-foot').map((e) => ({
      in: ((e.closest('#dp-kpi,#dp-comp,#dp-work,#dp-var,#dp-more') || {}).id) || '',
      t: e.textContent })),
    cond: (document.querySelector('.dp-cond') || {}).innerText || '',
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

// ── 1. 未ログインはログインへ送られる ───────────────────────────
{
  const { page } = await open('ja', { __anon: true });
  await page.waitForFunction(() => /login\.html/.test(location.pathname + location.search),
                             { timeout: 20000 }).catch(() => {});
  const url = await page.evaluate(() => location.pathname + location.search);
  ok(/\/login\.html/.test(url), '未ログインはログインへ送られる', url);
  ok(/redirect=deep-pay\.html/.test(decodeURIComponent(url)),
     '戻り先に deep-pay.html を渡している', url);
}

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
  ok(errs.length === 0, '鍵が無い形で JS のエラーが出ない', errs.join(' / '));
}

// ── 3. そろった状態（配置の骨格）─────────────────────────────
{
  const { page, errs } = await open('ja', FULL, 'light', MINE);
  const s = await page.evaluate(SNAP);
  /* ★3枚（2026-08-31）。4枚目「詳細投稿数 ◯件」を捨てた ── 中身は
     db/deep-pay.sql の hagg の count(*) ＝**人数**で、単位が「件」なのが誤り。
     しかもすぐ上の条件バーの「◯人」と同じ数で、同じ数を2回出していた。
     人数は条件バーが受け持つ（「12人 / うち明細あり 4人」）。 */
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
  /* ★人数を「件」と書かない。db/deep-pay.sql は proof_hash で1行＝1人に潰している。 */
  ok(!/件/.test(s.cond), '★条件バーで人数を「件」と書かない', s.cond.replace(/\n/g, ' '));
  ok(/うち明細あり\s*4\s*人/.test(s.cond.replace(/\n/g, ' ')),
     '★明細の裏付けがある人数を条件バーに出す（head.verified_n）',
     s.cond.replace(/\n/g, ' '));
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
  ok(s.moreLinks === 1 && s.moreHrefs[0] === 'deep-pay-compare.html'
     && s.moreBtns.length === 0,
     '★「もっと深く見る」は 会社比較へのリンク1本だけ（準備中は置かない）',
     JSON.stringify(s.moreHrefs) + ' / ' + JSON.stringify(s.moreBtns));
  /* ★変動給比率は「100 − 固定・保証給比率」ではない。db/deep-pay.sql の fixed_pct は
     固定＋職位＋役割で、残りにはパーディアム・住宅・その他・未分類も入っている。
     見本は 固定 62% ／ segs の variable 24%。引き算だと 38% になる。
     ⚠️ 本文全体を見ると凡例の 24% でも通ってしまうので、KPI の添え字だけを見る。 */
  ok(s.kpiN.some((t) => /変動給比率\s*24\s*%/.test(t))
     && !s.kpiN.some((t) => /38\s*%/.test(t)),
     '★変動給比率は segs の variable から出す（100 − 固定給 ではない）',
     JSON.stringify(s.kpiN));
  ok(!/undefined|NaN|\[object/.test(s.text), '本文に undefined / NaN が出ない');
  ok(errs.length === 0, 'JS のエラーが出ない', errs.join(' / '));
}

// ── 3c. 数字の定義がそろっている（2026-09-01）──────────────────
/* ChatGPT の指示 ──「同一条件を選んだとき、DEEP PAY ↓ Pay Structure ↓
   Pay / Block Hour ↓ Company Compare の数字が論理的・数学的に完全に整合していること」。
   ここは**画面側**（読み手が電卓で追えるか）。SQL が本当に割り算で結べるかは
   db/test-deep-pay.mjs の19節が、全員同じ値の区分をわざと作って見ている。 */
{
  /* 画面に出ている文字から読み直す。「¥1,700万」→ 1700。 */
  const man = (t) => {
    const m = /¥\s*([\d,]+)\s*万/.exec(t || '');
    return m ? Number(m[1].replace(/,/g, '')) : null;
  };
  /* deep-pay.js の sig2 と同じ（有効数字2桁）。 */
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
  ok(a != null && m != null && m === sig2(a * (1 - 5 / 100) / 12),
     '★月換算は「画面の年収 ×(1−賞与割合)÷12」＝読み手が電卓で出せる',
     `${a}万 × 0.95 ÷ 12 → ${a == null ? '?' : sig2(a * 0.95 / 12)}万 ／ 画面 ${m}万`);
  /* ★負の対照。賞与を引かない「年収÷12」なら別の数字になる。ここが同じ値だと、
     上の検査は何も守っていないことになる（見本の年収 1,700万 では 140万 と 130万）。 */
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

  // ── 年収の定義（指示 §5）と3人の壁 ─────────────────────────
  /* ★注記は KPI の下の**1行にまとめる**。給与構成のカードへ戻すと、
     狭いぶん折れて画面が下へ伸び、「★1画面に収まる」が落ちる。 */
  ok(s.foot.length === 1 && s.foot[0].in === 'dp-kpi',
     '★注記は KPI の下の1行だけ（カードの中に散らさない）',
     JSON.stringify(s.foot.map((f) => f.in)));
  ok(/3人以上/.test(s.foot[0] ? s.foot[0].t : ''), '★3人の壁は注記に残っている');
  ok(/年収＝/.test(s.foot[0] ? s.foot[0].t : '')
     && /住宅手当/.test(s.foot[0].t) && /現物の社宅は含みません/.test(s.foot[0].t),
     '★年収が何を含むかを画面に書く（現物の社宅は含まない）',
     s.foot[0] ? s.foot[0].t : '');

  // ── 対象期間（db/deep-pay.sql の interval '24 months' の写し）──
  ok(/直近\s*24\s*か月/.test(s.cond.replace(/\n/g, ' ')),
     '★条件バーに対象期間（直近24か月）が出る', s.cond.replace(/\n/g, ' '));
}

// ── 3d. 賞与の割合が伏せられているときは「賞与ぬき」と名乗らない ──
/* ★3人に届かず割合が出ていないだけで、賞与が無いとは限らない。
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
}

// ── 3b. variable が3人に届かないと「変動給比率」の行ごと消える ──
/* ★0% と書けば「変動給の無い会社」に見えるが、実際は「3人に届かず出せない」だけ。
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
  ok(s.work.rows === 3, '★3人に届かなかった列は行ごと消える（4→3行）', `今 ${s.work.rows} 行`);
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
    /* ★相対のまま。'/deep-pay-compare.html' に直すと /en/ から日本語版へ飛ぶ。 */
    ok(s.moreHrefs.length === 1 && s.moreHrefs[0] === 'deep-pay-compare.html',
       `${lang}/${theme}: ★会社比較の行き先は相対のまま（/en/ からは /en/ に解ける）`,
       JSON.stringify(s.moreHrefs));
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
}

// ── 9. 見たい区分を選ぶ（2026-08-30）──────────────────────────
/* ★ここが「自分の区分しか見られないなら意味がない」への答えと、
   そのあとのオーナー判断「自動で自分の区分を出す機能自体を消す」の両方の見張り。
   見るのは4つ ── 選ぶまで何も出ない／3つとも選べる／選んでも壁は動かない／
   クリアで「選んでください」に戻る。 */
{
  const { page, errs } = await open('ja', PICKABLE);
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

  await choose(page, { airline: 'jal', position: 'cap', fleet: 'b787' });
  const b = await page.evaluate(SNAP);
  ok(b.args[1] && b.args[1].p && b.args[1].p.airline === 'jal'
     && b.args[1].p.position === 'cap' && b.args[1].p.fleet === 'b787',
     '★選んだ区分をそのままサーバへ渡す', JSON.stringify(b.args[1]));
  ok(/日本航空/.test(b.cond), '★選んだ区分の見出しになる', b.cond.replace(/\n/g, ' '));
  /* ★明細の裏付けが 0 人（この見本は verified_n を持たない）のときは**足さない**。
     「うち明細あり 0人」と書くのは、この数字を信じるなと書いているのと同じ。 */
  ok(!/明細あり/.test(b.cond), '★裏付けが0人のときは条件バーに足さない',
     b.cond.replace(/\n/g, ' '));
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
  /* 5人なので上限は 3（3つとも選んだ）× 人数の判定 2 ＝「中」。 */
  ok(/中/.test(b.cond) && !/高/.test(b.cond),
     '★5人の区分を「信頼度 高」と言わない', b.cond.replace(/\n/g, ' '));

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
  ok(c.kpi === 0, '★3人に届かない区分では KPI が1枚も出ない', `今 ${c.kpi} 枚`);
  ok(c.comp.hidden && c.work.hidden && c.vari.hidden && c.more.hidden,
     '★節も全部消える（空の器を残さない）');
  ok(!/[¥$€£]|万|%/.test(c.text),
     '★★広い区分の数字で埋めない（金額も割合も1つも出ない）',
     (c.text.match(/[^\n]*[¥$€£万%][^\n]*/) || [''])[0].slice(0, 60));
  ok(c.cond === '', '★出せない区分では「表示中:」の行ごと出さない', c.cond);
  ok(/3人/.test(c.text) && !/あと1人|あと 1/.test(c.text),
     '★「あと1人」と書かない（人数が1人単位で読めてしまう）',
     c.text.replace(/\n/g, ' ').slice(0, 80));

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
      ⚠️ en の条件バーは**2段で正しい**。中身が 998px 要るのに幅が 836px しか無い
        （`measure` の「条件バー」の行で見える）。1段に戻そうとして文言を削らない。
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
     3人の壁は SQL の1か所にしかない（画面は人数を数えないし、閾値も持たない）。
   ⚠️ 見るのは6つ。**最後の2つが命綱**（db/*.sql は push では本番に入らない。
      貼る前に push すると選択欄が空になる ── それが**正しい**ことを見張る）。 */
{
  const { page, errs } = await open('ja', HASPICKS);
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
  ok(/3人/.test(e2.text) && !/\$|¥|万円/.test(e2.text),
     '★★空が返ったら金額を1文字も出さない（広い区分の数字で埋めない）',
     e2.text.replace(/\n/g, ' ').slice(0, 90));
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
  }
}

for (const j of jars) await j.close().catch(() => {});
await browser.close();

console.log(`\n${fail ? '❌' : '✅'} pass ${pass} / fail ${fail}`);
process.exit(fail ? 1 : 0);
