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
     ぼかしは JS を切れば読めるので、掛かっているように見えるだけになる。 */
  const hide = [
    [/blur\s*\(/i, 'blur()'], [/(^|[^-\w])filter\s*:/, 'filter:'],
    [/backdrop-filter/i, 'backdrop-filter'], [/\bmask(-image)?\s*:/i, 'mask:'],
    [/user-select\s*:\s*none/i, 'user-select:none']
  ];
  for (const [re, name] of hide) {
    ok(!re.test(cssC), `★deep-pay-compare.css に ${name} が無い（隠すのではなく渡さない）`);
    ok(!re.test(jsC),  `★deep-pay-compare.js に ${name} が無い`);
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
  /* ★人数の壁は db/deep-pay.sql の1か所だけ。JS が自分で数え始めると
     SQL を直しても画面が古い壁のまま動き、しかも見た目は正しく見える。 */
  ok(!/\.n\s*<\s*3/.test(jsC), '★JS が人数を自分で数えていない（\\.n < 3 が無い）');
  ok(/level\s*===\s*'none'/.test(jsC), '★薄い区分の合図は cohort.level === \'none\' だけ');

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
  ok(keys.length === 8, '★棒の区分は8つ（db/deep-pay.sql の cseg と同じ）', keys.join(' '));
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

  /* ★「ほぼ同じ」は画面に出す文字列どうしで判定する（丸めた後に同じ表示になる値がある）。 */
  ok(/same:\s*sa === sb/.test(jsC), '★「ほぼ同じ」は表示する文字列で判定している');
  /* ★差は 2026-08-31 から数値で出す（オーナー確定「語を書かず数値だけ」）。
     許されるのは**画面に出ている2つの文字列の引き算**だけ。生の値で引くと、
     金額は有効数字2桁（pv_sig2）に丸めてから画面に出ているので、
     読み手が自分で引き算した答えと合わない数が出る＝2桁より細かい精度の主張になる。 */
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
  for (const name of ['sig2', 'money', 'moneyExact', 'segPct', 'airName']) {
    ok(DC[name] && DP[name] && norm(DC[name]) === norm(DP[name]),
       `★${name}() が deep-pay.js の写しのまま（ずれていない）`);
  }
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
    const at = (f) => html.search(new RegExp('(?:src|href)="[^"]*' + f.split('.').join('\\.') + '"'));
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
  const GATE = P.__lock ? { key: false, detailed: false } : { key: true, detailed: true };
  const BOOT = {
    state: P.__lock ? 'locked' : 'open',
    gate: GATE, stats: STATS, give: { detailed: !P.__lock }
  };
  /* ★入口の1回は state と鍵だけ。cohort / head / comp を混ぜない
     ── 混ぜると「選ぶ前に数字が出ていない」ことを見張れなくなる。 */
  const THIN = { state: 'open', gate: GATE, stats: STATS, cohort: { level: 'none' } };
  function side(f) {
    return {
      state: 'open', gate: GATE, stats: STATS,
      cohort: { level: 'airline', n: f.n },
      head: { annual_usd: f.annual, per_block_usd: f.pbh, fixed_pct: f.fixed },
      comp: {
        segs: f.segs,
        bonus: (f.bonus == null ? null : { pct_of_annual: f.bonus })
      },
      work: { block_h: f.block, stay_nights: f.stay }
    };
  }
  const RPC = {
    pv_deep_pay: (args) => {
      const q = (args && args.p) || null;
      if (!q || !q.airline) return BOOT;          // 入口の1回（引数なし）
      const f = (P.air || {})[q.airline];
      return f ? side(f) : THIN;                  // 表に無い会社＝3人に届かない区分
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
   emirates    … 丸めたら ana と同じ表示になる（fixed 61.8 vs 62.2 → どちらも 62%）
   qatar-…     … 年収と Pay/BH は上・Block と ステイは下 → 対が割れてトレードオフは出ない
   sas         … air に無い＝薄い側 */
const SEG5 = (fx, va, pd, ho, ot) => [
  { k: 'fixed', pct: fx }, { k: 'variable', pct: va }, { k: 'perdiem', pct: pd },
  { k: 'housing', pct: ho }, { k: 'other', pct: ot }
];
const ANA = { n: 21, annual: 110000, pbh: 93, fixed: 62.2, block: 74.0, stay: 9,
              bonus: 5, segs: SEG5(62, 18, 7, 8, 5) };
const AIR = {
  ana: ANA,
  jal: { n: 17, annual: 128000, pbh: 105, fixed: 55, block: 79.5, stay: 12,
         bonus: 8, segs: SEG5(55, 24, 9, 7, 5) },
  lufthansa: { n: 12, annual: 96000, pbh: 84, fixed: 71, block: 66.0, stay: 6,
               bonus: null, segs: [{ k: 'fixed', pct: 71 }, { k: 'variable', pct: 14 },
                                   { k: 'housing', pct: 10 }, { k: 'other', pct: 5 }] },
  emirates: { n: 14, annual: 110000, pbh: 93, fixed: 61.8, block: 74.04, stay: 9,
              bonus: 5, segs: SEG5(62, 18, 7, 8, 5) },
  'qatar-airways': { n: 15, annual: 140000, pbh: 105, fixed: 66, block: 60.0, stay: 5,
                     bonus: 6, segs: SEG5(66, 15, 6, 9, 4) }
};
const OK   = { air: AIR };
const LOCK = { __lock: true, air: AIR };

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
    lowHidden: ['dc-diff', 'dc-mix', 'dc-trade', 'dc-cta']
      .filter((id) => !!(document.getElementById(id) || {}).hidden).length,
    text: document.body.innerText
  };
};

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const jars = [];

const PK = { a: 'dc-pk-a', b: 'dc-pk-b', pos: 'dc-pk-pos', flt: 'dc-pk-flt' };
/* ★選択肢が生えるのを待ってから値を入れる。語彙 JSON と salary-data.json は
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
  if (!(payload && payload.__anon)) {
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
  ok(s.args.length === 1 && s.args[0] === null,
     '★入口の1回だけ。しかも引数なし（区分を撃たない）', JSON.stringify(s.args));
  ok(errs.length === 0, '鍵の画面で JS のエラーが出ない', errs.join(' / '));
}

// ── 3. 選ぶまで何も出さない ─────────────────────────────────────
{
  const { page, errs } = await open('ja', OK);
  const s = await page.evaluate(SNAP);
  ok(s.ask === 1 && s.rows.length === 0 && s.kvV.length === 0,
     '★★2社そろうまで数字を1つも出さない', `ask=${s.ask} 行=${s.rows.length}`);
  ok(s.condK.length === 0, '★★選ぶまで条件バー（表示中:）を出さない', s.condK.join(','));
  ok(s.lowHidden === 4, '★下の4枚（表・棒・トレードオフ・入口）は畳んだまま',
     String(s.lowHidden));
  ok(s.pickHidden === false && s.pick.join(',') === 'dc-pk-a,dc-pk-b,dc-pk-pos,dc-pk-flt',
     '会社A・会社B・役職・機材の4つの欄が出ている', s.pick.join(','));
  ok(s.rst === 0, '何も選んでいないうちは「選択をクリア」を出さない');
  /* ★4欄は必ず 2×2。1段に並べると <select> の内寸が 190px まで痩せ、
     「全日本空輸（ANA）」（実測 313px）が端で切れる ── しかも <select> は
     省略記号すら出さないので、切れたことが画面から分からない。
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
  ok(l0.tops.length === 4, '★4欄そろっている（選ぶ前）', JSON.stringify(l0));
  ok(l0.rows === 2, '★4欄は2段（2×2）に並ぶ（選ぶ前）', String(l0.rows));
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
  ok(l1.rows === 2 && l1.tops.length === 4 && l1.gap != null && l1.gap <= 4,
     '★「選択をクリア」が出ても並びは 2×2 のまま（クリアは2段目の右端）',
     JSON.stringify(l1));

  // 同じ会社を2つ
  await choose(page, { a: 'ana', b: 'ana' }, 0);
  const dp = await page.evaluate(SNAP);
  ok(dp.args.length === 1, '★同じ会社を2つ選んでも引かない', `${dp.args.length}回`);
  ok(dp.ask === 1 && /別の会社/.test(dp.msg), '同じ会社には「別の会社を選んでください」', dp.msg);
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
  ok(s.sideC.join(',') === '21人,17人', '人数のピルが左右それぞれ出る', s.sideC.join(','));
  /* ★両方読めるときはカード2枚を出さない（2026-08-31・オーナー確定「1画面に収める」）。
     年収・Pay per BH・固定・保証給比率・Block Hours は**すぐ下の表に同じ数字が並ぶ**ので、
     カードは同じ数字の2度書きだった。やめて 153px 減らし、ロゴ・社名・人数は
     表の見出し行が受け持つ（上の2本がその見出しを見ている）。
     ⚠️ 戻すときは §5 の「薄いのは片側だけ」も一緒に見ること。あちらはカードが要る。 */
  ok(s.cardsShown === false, '★両方読めるならカードは出さない（表の見出しが受け持つ）',
     String(s.cardsShown));
  ok(s.condK.join(' / ') === '21人 vs 17人 / 直近24か月',
     '★条件バーは「◯人 vs ◯人」と「直近24か月」（件ではない・12か月ではない）',
     s.condK.join(' / '));
  ok(s.rows.length === 9, '★9項目とも両側にあるので9行出る', String(s.rows.length));
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
  ok(errs.length === 0, '2社そろった画面で JS のエラーが出ない', errs.join(' / '));
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
  ok(s.sideC.join(',') === '21人,—', '★人数のピルは薄い側だけ —', s.sideC.join(','));
  ok(s.condK[0] === '21人 vs —', '条件バーも片側だけ —', s.condK.join(' / '));
  ok(s.rows.length === 0 && /並べられる項目がまだありません/.test(s.diffEmpty),
     '★空の表ではなく一言のカードにする', s.diffEmpty);
  ok(s.bars.length === 2 && s.barNone === 1,
     '★棒は読める側だけ描き、薄い側は「まだ出せません」の帯', `${s.bars.join(',')} none=${s.barNone}`);
  ok(s.to.length === 0 && /どちらが良いかではなく/.test(s.toEnd),
     '★片側が薄いときトレードオフは1行も出さない（締めの1行は出す）');
  ok(!/\b0%|0人/.test(s.text), '★薄い側を 0 で埋めない');
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
{
  const { page } = await open('ja', OK, 'light', { a: 'ana', b: 'emirates' });
  const s = await page.evaluate(SNAP);
  ok(s.rows.length === 9 && s.rows.every((r) => r.a === r.b && !r.d),
     '★★同じ数字が並んでいるのに差の数値を書かない（表示文字列で判定）',
     s.rows.map((r) => `${r.a}|${r.b}|${r.d}`).join(' / '));
  ok(!/の方が|より高い|より長い/.test(s.text), '勝ち負けを言う語が1つも出ない');
  ok(s.to.length === 0,
     '★全部同じならトレードオフは出ない（締めの1行だけ）', s.to.join(' / '));
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

// ── 10. 引けなかったとき ────────────────────────────────────────
{
  const { page, errs } = await open('ja', { __err: true, air: AIR });
  const s = await page.evaluate(SNAP);
  ok(s.pickHidden === true && s.pickShown === false && s.rows.length === 0,
     '★引けなかった画面では選ばせない・数字も出さない');
  ok(!/[¥$]\s?\d/.test(s.text), '引けなかった画面に金額が出ない');
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
  ok(sizes.length === 4 && sizes.every((v) => parseFloat(v) >= 16),
     '★390px で <select> の実測 font-size が16px 以上（iOS が勝手に拡大しない）',
     JSON.stringify(sizes));
  const over = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 1, '★390px で横に溢れない', String(over));
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

/* ── ⑭ 狭い画面でも <select> が切れない（2026-08-31）─────────────
   ★実際に踏んだ形を固定する。「選択をクリア」の列を 640px でも作っていたため、
     その 123px ぶん欄が痩せて社名が 107px 欠けていた。切れても省略記号は出ない
     ので、**画面を見ても気づけない**。だから幅を変えて測る。
   ・900 … 2列＋クリアは3段目（3列にすると欄が 333px を割る）
   ・640 … 1列（2列だと割る）
   ⚠️ ここを緑にするために .dp-pick-f へ justify-self:start を掛けない。
      掛けると欄が中身の幅まで縮んで測定値だけ良くなり、実際は4つの欄が
      342/342/158/307 とバラバラになる（実際にやった）。 */
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
    ok(cut.length === 4 && cut.every((c) => c.slack >= 0),
       `★<select> の選択肢が切れていない（${lang} / ${w}）`,
       cut.map((c) => `${c.id} ${c.slack}`).join(' / '));
  }
}

for (const j of jars) await j.close().catch(() => {});
await browser.close();

console.log(`\n${fail ? '❌' : '✅'} pass ${pass} / fail ${fail}`);
process.exit(fail ? 1 : 0);
