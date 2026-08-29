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

  /* どの画面からも入口が生えていないこと。canonical / alternate / stylesheet は
     deep-pay 自身の head なので数えない（見るのは <a> だけ）。 */
  const dirs = ['.', 'en', 'airlines', 'en/airlines'];
  const linked = [];
  for (const d of dirs) {
    const abs = new URL(d + '/', ROOT);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      if (!f.endsWith('.html')) continue;
      const rel = (d === '.' ? '' : d + '/') + f;
      const html = nohtmlcomment(read(rel));
      if (/<a\b[^>]*href="[^"]*deep-pay\.html/i.test(html)) linked.push(rel);
    }
  }
  ok(linked.length === 0, '★どの画面にも DEEP PAY への入口（<a href>）が無い', linked.join(' '));

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
  const revoke = SQL.indexOf('revoke all on function public.pv_deep_pay() from public, anon;');
  const grant  = SQL.indexOf('grant execute on function public.pv_deep_pay() to authenticated;');
  ok(revoke >= 0, 'pv_deep_pay() を public と anon から revoke している');
  ok(grant  >= 0, 'pv_deep_pay() を authenticated に grant している');
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
  const lists = [
    ['gen-sitemap.mjs',     'NOINDEX'],
    ['seo-normalize.mjs',   'NOINDEX と COPY'],
    ['assert-seo.mjs',      'NOINDEX'],
    ['assert-links.mjs',    'APPFLOW'],
    ['assert-founding.mjs', '除外リスト']
  ];
  for (const [f, what] of lists) {
    ok(read(f).includes("'deep-pay.html'"), `${f} の ${what} に入っている`);
  }
  ok(/'deep-pay\.html':\s*\{/.test(read('seo-normalize.mjs')),
     "★seo-normalize.mjs の COPY に日英の t/d が在る（noindex でも <title> は出る）");
  ok(read('lang-toggle.js').includes('deep-pay.html'),
     'lang-toggle.js の EN_PAGES に入っている（gen-en-manifest.mjs の生成物）');
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
  const RPC = {
    pv_deep_pay: () => payload,
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
    rpc: (name) => {
      window.__rpc[name] = (window.__rpc[name] || 0) + 1;
      const res = (payload && payload.__err && name === 'pv_deep_pay')
        ? { data: null, error: { message: 'synthetic failure' } }
        : { data: RPC[name] ? RPC[name]() : { ok: true }, error: null };
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
  cohort: { level: 'airline_pos_fleet', airline: 'ana', pos: 'fo', fleet: 'a320', n: 12 },
  head: { annual_usd: 110000, per_block_usd: 93, detailed_n: 12, fixed_pct: 62 },
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
const LOCK = { ok: true, state: 'locked', stats: STATS, give: { detailed: false },
               gate: { key: false, detailed: false, contributors: 37, goal: 100 },
               cohort: null, head: null, comp: null, work: null, var: null };

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const jars = [];
async function open(lang, payload, theme) {
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
  return { page, errs };
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
    empty: q('#dp-root .pt-empty').length,
    donut: q('#dp-comp svg').length,
    compCta: q('#dp-comp a[href*="pay-report"]').length,
    legend: q('#dp-comp .pt-leg:not(.dp-th) .amt').map((e) => e.textContent),
    comp: sec('dp-comp'), work: sec('dp-work'), vari: sec('dp-var'),
    notes: sec('dp-notes'), more: sec('dp-more'),
    bars: q('#dp-var .dp-li-f').map((e) => getComputedStyle(e).backgroundColor),
    moreBtns: q('#dp-more button').map((e) => ({ dis: e.disabled, tag: e.tagName })),
    moreLinks: q('#dp-more a').length,
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
  ok(/pay-report\.html/.test(await page.evaluate(() => document.getElementById('dp-root').innerHTML)),
     '鍵が無い人には「出す」入口を出している（Give → Get）');
  ok(errs.length === 0, '鍵が無い形で JS のエラーが出ない', errs.join(' / '));
}

// ── 3. そろった状態（配置の骨格）─────────────────────────────
{
  const { page, errs } = await open('ja', FULL);
  const s = await page.evaluate(SNAP);
  ok(s.kpi === 4, 'そろっていれば KPI は4枚', `今 ${s.kpi} 枚`);
  ok(s.donut === 1, 'ドーナツは1つ', `今 ${s.donut} 個`);
  ok(s.legend.length === 6, '凡例は渡した6区分ぶん', `今 ${s.legend.length} 行`);
  ok(s.work.rows === 4, '働き方は4行', `今 ${s.work.rows} 行`);
  ok(s.vari.rows === 6, '変動給は6行', `今 ${s.vari.rows} 行`);
  /* ★night / weekend / holiday は3つのまま（1行にまとめない）。 */
  const nwh = ['夜間', '週末', '祝'].filter((w) => s.vari.text.includes(w));
  ok(nwh.length === 3, '★夜間・週末・祝日は3行のまま（1つにまとめない）', nwh.join(''));
  /* ★棒は全部同じ色（色で良し悪しを言わない）。 */
  ok(new Set(s.bars).size === 1, '★変動給の棒は全部同じ色', [...new Set(s.bars)].join(' '));
  ok(s.moreLinks === 0 && s.moreBtns.length === 2 && s.moreBtns.every((b) => b.dis),
     '★「もっと深く見る」は無効のボタン（無い先へリンクしない）',
     JSON.stringify(s.moreBtns));
  ok(!/undefined|NaN|\[object/.test(s.text), '本文に undefined / NaN が出ない');
  ok(errs.length === 0, 'JS のエラーが出ない', errs.join(' / '));
}

// ── 4. 読めなかった列は行ごと消える（0 を並べない）──────────────
{
  const { page } = await open('ja', HOLES);
  const s = await page.evaluate(SNAP);
  ok(s.work.rows === 3, '★3人に届かなかった列は行ごと消える（4→3行）', `今 ${s.work.rows} 行`);
  ok(!/(^|[^\d.])0([^\d.%]|$)/.test(s.work.text.replace(/\n/g, ' ')),
     '★消えた列の代わりに 0 を置いていない', s.work.text.replace(/\n/g, ' ').slice(0, 80));
  ok(s.vari.rows === 2, '変動給は渡した2区分だけ', `今 ${s.vari.rows} 行`);
  ok(!/夜間|週末|祝/.test(s.vari.text), '★渡していない区分が勝手に生えない');
}

// ── 5. 数字が1つも読めないときは、カードごと出ない ──────────────
{
  const { page } = await open('ja', NOHEAD);
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
  const { page } = await open('ja', FULL);
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
  ok(after.rpc.pv_deep_pay === 1,
     '★★通貨を切り替えても pv_deep_pay() を引き直さない', JSON.stringify(after.rpc));
  /* 切り替えた先で数字が枠から切れていないこと（英語ページの JPY が11文字になる）。 */
  const clipped = await page.evaluate(() => Array.prototype.slice
    .call(document.querySelectorAll('.dp-kpi-v, #dp-comp .amt'))
    .filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
  ok(clipped.length === 0, '★数字が枠から切れていない（… で途中まで出ない）', clipped.join(' '));
}

// ── 7. 日英・明暗 ───────────────────────────────────────────────
for (const lang of ['ja', 'en']) {
  for (const theme of ['light', 'dark']) {
    const { page, errs } = await open(lang, FULL, theme);
    const s = await page.evaluate(SNAP);
    ok(!/undefined|NaN|\[object|null/.test(s.text),
       `${lang}/${theme}: 本文に undefined / NaN / null が出ない`,
       (s.text.match(/[^\n]*(undefined|NaN|\[object|null)[^\n]*/) || [''])[0].slice(0, 60));
    const h = saysHourly(s.text);
    ok(h.ja === 0 && h.en.length === 0,
       `${lang}/${theme}: ★画面で「時給」と呼んでいない`, h.en.join(' / '));
    ok(/Pay \/ Block Hour/.test(s.text), `${lang}/${theme}: Pay / Block Hour が出ている`);
    ok(!/上位|percentile/i.test(s.text), `${lang}/${theme}: ★順位を書いていない`);
    ok(s.kpi === 4, `${lang}/${theme}: KPI は4枚`, `今 ${s.kpi} 枚`);
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

for (const j of jars) await j.close().catch(() => {});
await browser.close();

console.log(`\n${fail ? '❌' : '✅'} pass ${pass} / fail ${fail}`);
process.exit(fail ? 1 : 0);
