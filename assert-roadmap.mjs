/* ════════════════════════════════════════════════════════════════
   assert-roadmap.mjs — ROADMAP & REQUESTS の静的検査（ブラウザ不要・約0.1秒）

   この画面は「普通に動いたまま静かに壊れる」形をいくつも持っている。
   実際に壊れうるものだけを、1つずつ見張る。

     ① 匿名が解ける ── author_hash が一覧 RPC から外へ出る。
        あれは同じ人なら毎回同じ値＝安定した仮名 ID なので、1度出れば
        「この12件は同じ人が書いた」が組める。SQL に select r.* と1行
        書くだけでそうなる（画面は何も変わらない）。
     ② 要望の本文が innerHTML に入る ── 利用者が書く文字がそのまま
        HTML として解釈される。画面は普通に見える。
     ③ 日英どちらかだけ直す ── T.ja に鍵を足して T.en に足し忘れると、
        英語の画面だけ undefined が出る。日本語で見ている限り気づけない。
     ④ 数を作る ── 人数・件数を JS 側で足し引きしたり、取れなかったときに
        0 と書いたりする。0 と書くと「本当に0件」と読める。
     ⑤ 区分・状態の白リストが SQL と画面でズレる ── 画面で選べる区分が
        SQL の check に無いと、送信だけが静かに失敗する。
     ⑥ ページ登録の一覧を1つ忘れる ── sitemap と robots が食い違うのに
        何も赤くならない（CLAUDE.md「ページを1枚足すとき」）。

   使い方: node assert-roadmap.mjs
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from 'fs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) pass++; else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
};

const CFG_SRC  = read('./roadmap-config.js');
const JS       = read('./roadmap.js');
const HTML_JA  = read('./roadmap.html');
const HTML_EN  = read('./en/roadmap.html');
const SQL      = read('./db/requests.sql');

/* ★「書いていないこと」を見る検査は、そのまま流すと相手のコメントに引っかかる。
   このファイルが見張っている禁則は、向こうのファイルの注意書きに一字一句
   そのまま書いてあるからで、そこで赤くなると「本当に混入した日」に気づけない。
   だからコードだけを見る。 */
const noJsCmt  = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ')
                         .replace(/(^|[^:'"`])\/\/[^\n]*/gm, (m, head) => head);
const noSqlCmt = (t) => t.replace(/--[^\n]*/g, ' ');
const noTagCmt = (t) => t.replace(/<!--[\s\S]*?-->/g, ' ');
const JSC      = noJsCmt(JS);
const SQLC     = noSqlCmt(SQL);
const H_JA     = noTagCmt(HTML_JA);
const H_EN     = noTagCmt(HTML_EN);

/* 設定ファイルは window に1つ立てるだけの素の <script>。そのまま読める。 */
const win = {};
new Function('window', CFG_SRC)(win);
const CFG = win.PVRoadmap;

/* ════════════════════════════════════════════════════════════════
   ① roadmap-config.js の形
   ════════════════════════════════════════════════════════════════ */
console.log('\n── 設定ファイル ─────────────────────────');
ok('window.PVRoadmap がある', !!CFG);

const MILE = [100, 500, 1000, 2000, 5000];
ok('段は 100 / 500 / 1,000 / 2,000 / 5,000',
   JSON.stringify(CFG.milestones) === JSON.stringify(MILE), JSON.stringify(CFG.milestones));

/* ★roadmap.js は config が読めなかったときのために同じ配列を持っている。
   片方だけ直すと、config が落ちた画面だけ違う段を出す。 */
const jsMile = (JS.match(/\[\s*100,\s*500,\s*1000,\s*2000,\s*5000\s*\]/) || [])[0];
ok('roadmap.js の控えの段が config と同じ', !!jsMile, '見つからない');

ok('段ごとの文言が全部ある',
   MILE.every((n) => (CFG.goals || []).some((g) => g.n === n)),
   (CFG.goals || []).map((g) => g.n).join(', '));
for (const g of CFG.goals || []) {
  ok(`${g.n} の段が日英そろっている`, !!(g.ja && g.ja.t && g.en && g.en.t));
}

/* 2026-09-04、オーナーの指示でヒーローの長文（3原則・「なぜ作るのか」3枚・
   Built with pilots, for pilots.）を全部消し、Mission と Vision の2文だけにした。
   ★ここに説明文を足し戻さない。1画面に収まらなくなる。 */
ok('★ヒーローは Mission と Vision の2つだけ',
   !!(CFG.mission && CFG.vision) && !CFG.tenets && !CFG.why,
   [CFG.tenets ? 'tenets が残っている' : '', CFG.why ? 'why が残っている' : ''].join(' '));
ok('Mission が日英そろっている', !!(CFG.mission && CFG.mission.ja && CFG.mission.en));
ok('Vision が日英そろっている', !!(CFG.vision && CFG.vision.ja && CFG.vision.en));

const STATE4 = new Set(['done', 'building', 'planned', 'considering']);
const seen = new Set();
const TODAY = '2026-12-31';   // 未来日の検出だけに使う粗い上限（時計に依らせない）
for (const t of CFG.tasks || []) {
  ok(`task ${t.id} の id が kebab-case`, /^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.id || ''), t.id);
  ok(`task ${t.id} の id が重複していない`, !seen.has(t.id), t.id);
  seen.add(t.id);
  ok(`task ${t.id} の state が4値のどれか`, STATE4.has(t.state), t.state);
  ok(`task ${t.id} が日英そろっている`, !!(t.ja && t.ja.t && t.en && t.en.t));
  if (t.state === 'done') {
    /* ★完了には日付が要る。無いと「最近のアップデート」の並びが崩れる。
       ★未来の日付は書かない（まだ出していないものを出したことにしない）。 */
    ok(`task ${t.id} に完了日がある`, /^\d{4}-\d{2}-\d{2}$/.test(t.date || ''), t.date);
    ok(`task ${t.id} の完了日が未来でない`, String(t.date) <= TODAY, t.date);
  } else {
    ok(`task ${t.id} は完了していないので日付を持たない`, !t.date, t.date);
  }
}
ok('完了したものが1つ以上ある', (CFG.tasks || []).some((t) => t.state === 'done'));
ok('進行中がちょうど1つ',
   (CFG.tasks || []).filter((t) => t.state === 'building').length === 1);

/* ★「上から順に、いま手が付いているもの」と見出しに書いてある以上、
   開発中が先頭に来ることが約束。ORDER[x] || 9 と書くと building の 0 が
   falsy で 9 に化け、開発中だけ最後に落ちる（画面は普通に出たまま並びが逆）。 */
{
  const os = JSC.indexOf('var ORDER = {');
  const ORDER = new Function('return ' + JSC.slice(JSC.indexOf('{', os), JSC.indexOf('}', os) + 1))();
  const rk = (x) => (Object.prototype.hasOwnProperty.call(ORDER, x) ? ORDER[x] : 9);
  ok('★運営が進めていること ── 開発中が予定・検討中より先',
     rk('building') < rk('planned') && rk('planned') < rk('considering'));
  ok('★順位づけで || を使っていない（0 が falsy で潰れる）',
     !/ORDER\s*\[[^\]]+\]\s*\|\|/.test(JSC));
}

/* ★数字を直書きしない。人数も件数もサーバから来る。 */
ok('★config に人数・件数の直書きが無い',
   !/\b(contributors|members|pilots|count)\s*:\s*\d+/.test(CFG_SRC));

/* ════════════════════════════════════════════════════════════════
   ② 日英の文言（T.ja と T.en の鍵が完全に同じ）
   ════════════════════════════════════════════════════════════════
   assert-pay-report-sync.mjs と同じ狙い。片方だけ直すと英語だけ
   undefined が出るが、日本語で見ている限り一生気づけない。 */
console.log('\n── 日英の文言 ───────────────────────────');
const dStart = JS.indexOf('var DICT = {');
const dEnd = JS.indexOf('var T = DICT[LANG];');
ok('DICT が見つかる', dStart > 0 && dEnd > dStart);
const DICT = new Function('return ' + JS.slice(dStart + 'var DICT = '.length, JS.lastIndexOf('};', dEnd) + 1))();

const kJa = Object.keys(DICT.ja).sort();
const kEn = Object.keys(DICT.en).sort();
ok('★T.ja と T.en の鍵が完全に同じ', JSON.stringify(kJa) === JSON.stringify(kEn),
   `ja だけ: ${kJa.filter((k) => !kEn.includes(k)).join(', ') || 'なし'}\n`
   + `      en だけ: ${kEn.filter((k) => !kJa.includes(k)).join(', ') || 'なし'}`);
for (const k of kJa) {
  ok(`${k} の型が日英で同じ`, typeof DICT.ja[k] === typeof DICT.en[k],
     `ja=${typeof DICT.ja[k]} en=${typeof DICT.en[k]}`);
  if (typeof DICT.ja[k] === 'function') {
    ok(`${k} の引数の数が日英で同じ`, DICT.ja[k].length === DICT.en[k].length);
  }
}
/* ★履歴の日付は 5.6em の固定幅の列に入る。長い月名（'September 2026'）に戻すと
   何も言わずに2行へ折れ、題名の左端が行ごとにずれる。 */
for (const lg of ['ja', 'en']) {
  const w = [...Array(12)].map((_, i) => DICT[lg].ym(2026, i + 1));
  const longest = w.reduce((a, b) => (a.length >= b.length ? a : b));
  ok(`${lg} の履歴の日付が日付の列に収まる長さ`, longest.length <= 9, longest);
}

/* 区分と状態の対応表は、鍵まで一致していないと片方の言語だけ空欄になる。 */
for (const sub of ['cat', 'st']) {
  ok(`${sub} の鍵が日英で同じ`,
     JSON.stringify(Object.keys(DICT.ja[sub]).sort())
     === JSON.stringify(Object.keys(DICT.en[sub]).sort()));
}
/* コードから呼んでいる鍵が本当に在るか。T.foo と書いて DICT に無いと undefined が出る。 */
const used = new Set([...JSC.matchAll(/\bT\.([a-zA-Z][a-zA-Z0-9_]*)/g)].map((m) => m[1]));
for (const k of used) ok(`T.${k} が日英ともに在る`, k in DICT.ja && k in DICT.en);

/* ★実装と食い違う約束を書かない。ハッシュは運営側で照合できる。 */
ok('★「運営にも誰かわからない」と書いていない',
   !/運営に(も)?誰(か|が)(わから|分から)/.test(JSC + H_JA));
ok('匿名の説明が日英ともに在る', !!(DICT.ja.privacy && DICT.en.privacy));

/* ════════════════════════════════════════════════════════════════
   ③ XSS と「数を作らない」
   ════════════════════════════════════════════════════════════════ */
console.log('\n── 本文の入れ方・数の作り方 ─────────────');
ok('★要望の本文は textContent で入る', /\.textContent\s*=\s*it\.body/.test(JS));
ok('★要望の本文が innerHTML に入らない',
   !/innerHTML[^\n]*\bit\.body\b/.test(JS) && !/\besc\(\s*it\.body/.test(JS));
/* 枠は定数から組むので innerHTML を使ってよい。使ってよい相手だけに限る。 */
ok('innerHTML に渡すのは定数か組み立てた枠だけ',
   ![...JS.matchAll(/innerHTML\s*=\s*([^\n;]+)/g)]
     .some((m) => /\b(it|r|row|item)\.(body|category|status)\b/.test(m[1])));

ok('★人数が取れないときは 0 で埋めない（countPending がある）',
   !!DICT.ja.countPending && !!DICT.en.countPending);
ok('★件数が取れないときは — を出す', DICT.ja.unknown === '—' && DICT.en.unknown === '—');
ok('取れなかったときに読み直せる', !!DICT.ja.retry && /rm-retry/.test(JS));
/* ★取れなかった所に 0 を書かない（0 は「本当に0件」と読めてしまう）。
   一覧・要望の人気・折れ線の3つとも、同じ retryP() で「—」と読み直しを出す。 */
ok('★取れなかったときの出し分けが1か所にまとまっている',
   /function retryP\(/.test(JS)
   && (JS.match(/retryP\(/g) || []).length >= 4);
/* ♡ の数はサーバの戻りで必ず上書きする（見た目だけ先に動かすのは許す）。 */
ok('★♡ はサーバの実数で上書きする', /applyLike\(btn,\s*it,\s*v\.like_count/.test(JS));
ok('★♡ が失敗したら元に戻す', /applyLike\(btn,\s*it,\s*wasN,\s*wasOn\)/.test(JS));
/* 楽観更新で並べ替えない（行が指の下で動くと、次の指が別の要望を押す）。 */
ok('★♡ の楽観更新で並べ替えない', !/applyLike[\s\S]{0,400}?paintList\(\)/.test(JS));

/* ════════════════════════════════════════════════════════════════
   ④ 色とテーマ
   ════════════════════════════════════════════════════════════════ */
console.log('\n── 色 ───────────────────────────────────');
const hex = [...JSC.matchAll(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g)].map((m) => m[0]);
ok('★hex の色を1つも書いていない', hex.length === 0, hex.join(' '));
ok('★rgb()/rgba() を書いていない', !/\brgba?\(/.test(JSC));
/* このリポジトリのテーマは localStorage['pv-theme'] が唯一の正。
   prefers-color-scheme を持ち込むと、切替と食い違う面ができる。 */
ok('★prefers-color-scheme を持ち込んでいない', !/prefers-color-scheme/.test(JSC + H_JA + H_EN));
ok('動きを減らす設定に従う', /prefers-reduced-motion/.test(JS));
ok('transition-all を使っていない', !/transition\s*:\s*all/.test(JSC));
/* 押せるものには hover / focus-visible / active を全部付ける。 */
for (const sel of ['.rm-tab', '.rm-like', '.rm-f-b', '.rm-open', '.rm-retry', '.rm-more-btn']) {
  for (const st of [':hover', ':focus-visible', ':active']) {
    ok(`${sel}${st} がある`, JS.includes(sel + st));
  }
}

/* ════════════════════════════════════════════════════════════════
   ⑤ 読み上げ・キーボード
   ════════════════════════════════════════════════════════════════ */
console.log('\n── 読み上げ ─────────────────────────────');
ok('♡ は button で aria-pressed を持つ',
   /btn\.type\s*=\s*'button'/.test(JS) && /btn\.setAttribute\('aria-pressed'/.test(JS));
ok('★♡ の読み上げに現在の数が入る', /aria-label[\s\S]{0,40}T\.likeLabel\(/.test(JS));
ok('描き直すたびに読み上げも書き換わる', /btn\.setAttribute\('aria-label',\s*T\.likeLabel/.test(JS));
ok('状態を色だけで伝えない（記号＋語）', /'●'|'○'|'\?'/.test(JS) && /'✓ '/.test(JS));
for (const h of [HTML_JA, HTML_EN]) {
  ok('role="status" aria-live="polite" が1つある',
     (h.match(/aria-live="polite"/g) || []).length === 1);
  ok('textarea に本物の label が付いている', /<label[^>]*for="rm-body"/.test(h));
  ok('select に本物の label が付いている', /<label[^>]*for="rm-cat"/.test(h));
  /* ★静的に置いてはじめて assert-header.mjs の 390px / 16px 検査に入る。 */
  ok('textarea が静的 HTML にある', /<textarea[^>]*id="rm-body"/.test(h));
}
ok('入力欄が 16px を切らない', /\.rm-f-t\{[\s\S]*?font-size:16px/.test(JS)
   && /\.rm-f-s\{[\s\S]*?font-size:16px/.test(JS));

/* ════════════════════════════════════════════════════════════════
   ⑥ 日英の骨格が同じ
   ════════════════════════════════════════════════════════════════ */
console.log('\n── 日英の骨格 ───────────────────────────');
const idsOf = (h) => [...h.matchAll(/\bid="([a-z0-9-]+)"/g)].map((m) => m[1]).sort();
ok('★日英で id の顔ぶれが同じ',
   JSON.stringify(idsOf(HTML_JA)) === JSON.stringify(idsOf(HTML_EN)),
   `ja: ${idsOf(HTML_JA).join(',')}\n      en: ${idsOf(HTML_EN).join(',')}`);

const srcOf = (h) => [...h.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1].replace(/^\.\.\//, ''));
ok('★日英でスクリプトの並びが同じ',
   JSON.stringify(srcOf(HTML_JA)) === JSON.stringify(srcOf(HTML_EN)),
   `ja: ${srcOf(HTML_JA).join(',')}\n      en: ${srcOf(HTML_EN).join(',')}`);
/* ★pv-gates.js が先。roadmap.js が人数を1回だけ取って渡す＝
   ヒーローの数字と左メニューの門が必ず同じ数になり、通信も1回で済む。 */
const s2 = srcOf(HTML_JA);
ok('★pv-gates.js を roadmap.js より先に読む', s2.indexOf('pv-gates.js') < s2.indexOf('roadmap.js'));
ok('roadmap-config.js を roadmap.js より先に読む',
   s2.indexOf('roadmap-config.js') < s2.indexOf('roadmap.js'));
ok('人数を PVGates へ渡している', /PVGates\.setProgress\(/.test(JS));
ok('★人数を取る RPC は1本だけ',
   (JSC.match(/pv_give_progress/g) || []).length === 1);

/* en 側は ../ で読む（ここを間違えると英語版だけ全部 404 になる）。 */
for (const m of HTML_EN.matchAll(/<script src="([^"]+)"|<link rel="stylesheet" href="([^"]+)"/g)) {
  const u = m[1] || m[2];
  if (/^https?:/.test(u)) continue;
  ok(`en 側の ${u} が ../ で始まる`, u.startsWith('../'), u);
}
ok('日英とも .mr-side を空で置いている（patch-side-nav.mjs が埋める）',
   /<nav class="mr-side"[^>]*><\/nav>/.test(HTML_JA) || HTML_JA.includes('mr-side-a'));

/* ════════════════════════════════════════════════════════════════
   ⑦ 1画面に収める作り（2026-09-04 の作り直し）
   ════════════════════════════════════════════════════════════════
   前の形は 1,280×3,026px ＝ 縦に3画面あった。オーナーの指示は
   「1画面でできればこれが見えるように・文字多すぎ・グラフで見せて」。
   ここで見るのは、その形が黙って元に戻っていないか。 */
console.log('\n── 1画面の作り ──────────────────────────');

/* 図は pay-viz.js（PVViz）を借りる。折れ線を自前で描き直さない。 */
for (const [name, h, pre] of [['ja', HTML_JA, ''], ['en', HTML_EN, '../']]) {
  ok(`${name} が pay-viz.css を読む`, h.includes(`href="${pre}pay-viz.css"`));
  ok(`${name} が pay-viz.js を読む`, h.includes(`src="${pre}pay-viz.js"`));
  /* ★pay-viz.css は my-value.css より前。あとに置くと、このページ用の
     上書きを my-value.css 側が塗り替える向きが逆になる。 */
  ok(`${name} の pay-viz.css が my-value.css より前`,
     h.indexOf('pay-viz.css') < h.indexOf('my-value.css'));
}
ok('★pay-viz.js を roadmap.js より先に読む', s2.indexOf('pay-viz.js') < s2.indexOf('roadmap.js'));
ok('折れ線は PVViz.chart() を借りている（自前で描き直していない）',
   /PVViz\.chart\(/.test(JS));
/* ★SVG の presentation attribute では var() が効かない。文字列のまま渡すと
   線が黒か透明になる（画面は普通に出たまま線だけ消える）。 */
ok('★線の色は getComputedStyle で解いてから渡す',
   /getPropertyValue/.test(JS) && !/color\s*:\s*'var\(/.test(JS));
/* ★chart() の既定の値札は金額（fmt）。人数に使うと「¥23」と出る。 */
ok('★人数の値札に fmtVal を渡している', /fmtVal\s*:/.test(JS));

/* 骨格 ── 左は JS が描き、右（入力欄と一覧）だけ静的 HTML に置く。 */
for (const [name, h] of [['ja', HTML_JA], ['en', HTML_EN]]) {
  ok(`${name} に #rm-left がある`, /id="rm-left"/.test(h));
  ok(`${name} の外枠が2カラム`, /class="mr-2col rm-grid"/.test(h));
  /* ★h1 の下の副題は消した。足し戻すと1画面に入らなくなる。 */
  ok(`${name} に h1 の副題が無い`, !/mr-hd-s/.test(h));
  ok(`${name} に古い骨格が残っていない`,
     !/id="rm-top"|id="rm-tasks"|id="rm-ship"/.test(h));
}
/* ★外の2カラムをメディアクエリで切らない。サイドバーが 1000px で畳まれて
   使える幅が反転するので、画面幅で分けると 1001px だけ極端に細い2列になる。 */
ok('★外の2カラムは flex-basis で倒す（@media で切らない）',
   /\.rm-grid>\.rm-l\{flex:/.test(JS) && /\.rm-grid>\.rm-r\{flex:/.test(JS)
   && !/@media[^']*rm-grid/.test(JS));
/* ★ページ固有CSSを .rm-x .mr-y（0,2,0）で書かない。my-value.css の
   @media 側（0,1,0）に勝ってしまい、狭いときの折り返しだけが黙って効かなくなる。 */
{
  const bad = [...JS.matchAll(/'\s*\.rm-[a-z0-9-]+\s+\.mr-[a-z0-9-]+/g)].map((m) => m[0].trim());
  ok('★共有クラスを .rm-x .mr-y で上書きしていない', bad.length === 0, bad.join(' '));
}

/* 折れ線の材料。★人数と同じ数え方（pv_pay_person_map）でなければ、
   同じ画面に違う人数が2つ出る。 */
ok('★折れ線を取る RPC は1本だけ', (JSC.match(/pv_give_growth/g) || []).length === 1);
ok('折れ線が取れないときの文言が日英ともに在る',
   !!DICT.ja.growthErr && !!DICT.en.growthErr);
ok('★折れ線が人物単位で数えている（proof_hash で数えていない）',
   /pv_give_growth[\s\S]{0,1200}pv_pay_person_map\(\)/.test(SQLC));
ok('★pv_give_growth は anon から実行できない',
   /revoke all on function public\.pv_give_growth\(int\) from public, anon/.test(SQLC));
ok('pv_give_growth はログインした人だけ',
   /grant execute on function public\.pv_give_growth\(int\) to authenticated/.test(SQLC));
/* ★貼る順を間違えると折れ線だけが黙って出ない画面になる。前提で落とす。 */
ok('★pv_pay_person_map が無いと SQL が最初に落ちる',
   /pv_pay_person_map\(\)'\)\s*is null/.test(SQLC));

/* ════════════════════════════════════════════════════════════════
   ⑧ 区分・状態の白リストが SQL と画面で一致
   ════════════════════════════════════════════════════════════════ */
console.log('\n── 白リスト ─────────────────────────────');
const listOf = (re) => {
  const m = SQL.match(re);
  return m ? [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort() : null;
};
const sqlCat = listOf(/category\s+in\s*\(([^)]*)\)/);
const sqlSt  = listOf(/status\s+in\s*\(([^)]*)\)/);
const jsCat  = [...(JS.match(/var CATS\s*=\s*\[([^\]]*)\]/) || [, ''])[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
const jsSt   = [...(JS.match(/var STATES\s*=\s*\[([^\]]*)\]/) || [, ''])[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();

ok('★区分の白リストが SQL と roadmap.js で同じ', JSON.stringify(sqlCat) === JSON.stringify(jsCat),
   `sql: ${sqlCat}\n      js : ${jsCat}`);
ok('★状態の白リストが SQL と roadmap.js で同じ', JSON.stringify(sqlSt) === JSON.stringify(jsSt),
   `sql: ${sqlSt}\n      js : ${jsSt}`);
for (const [name, h] of [['ja', HTML_JA], ['en', HTML_EN]]) {
  const opt = [...h.matchAll(/<option value="([a-z]+)"/g)].map((m) => m[1]).sort();
  ok(`${name} の区分の選択肢が白リストと同じ`, JSON.stringify(opt) === JSON.stringify(jsCat), opt.join(','));
}
ok('区分の対応表が白リストを網羅している',
   jsCat.every((c) => c in DICT.ja.cat && c in DICT.en.cat));
ok('状態の対応表が白リストを網羅している',
   jsSt.every((c) => c in DICT.ja.st && c in DICT.en.st));

/* ════════════════════════════════════════════════════════════════
   ⑨ SQL 側の急所（詳しくは db/test-requests.mjs が PGlite で回す）
   ════════════════════════════════════════════════════════════════
   ここで見るのは「貼る前に落としたい」ものだけ。 */
console.log('\n── SQL の急所 ───────────────────────────');
ok('★一覧 RPC が select r.* を書いていない', !/select\s+r\.\*/i.test(SQLC));
/* ★ハッシュを jsonb に詰める形（'who', r.author_hash）を禁じる。
   これが1行入るだけで、以後それは安定した仮名 ID になる。 */
ok('★ハッシュを jsonb の値に詰めていない',
   !/'[a-z_]+'\s*,\s*[a-z_]*\.?(?:author|liker)_hash/i.test(SQLC));
ok('★行ごと jsonb に変換していない', !/to_jsonb\s*\(\s*r\s*\)|row_to_json/i.test(SQLC));
/* ★一覧を組み立てる関数の中では author_hash という語を1度も使わない。
   使う必要が無いので、出てきたら必ず何かが漏れている。 */
{
  const from = SQLC.indexOf('function public.pv_requests_list');
  /* 関数の後ろに続く comment on … is '…' は本文ではない。手前で切る。 */
  const to = SQLC.slice(from + 10).search(/create or replace function|comment on /);
  const body = SQLC.slice(from, to > 0 ? from + 10 + to : undefined);
  ok('★一覧 RPC が author_hash に触れていない', from > 0 && !/author_hash/.test(body));
}
ok('★ハッシュ関数を画面から呼べない',
   /revoke\s+all\s+on\s+function\s+public\.pv_request_hash\(uuid\)\s+from\s+public,\s*anon,\s*authenticated/i.test(SQL));
ok('★1人1票は主キーで担保している',
   /primary\s+key\s*\(\s*request_id\s*,\s*liker_hash\s*\)/i.test(SQL));
ok('表を閉じている（RLS 有効）',
   (SQL.match(/enable\s+row\s+level\s+security/gi) || []).length === 2);
ok('★表そのものを anon / authenticated から revoke している',
   (SQL.match(/revoke\s+all\s+on\s+public\.pv_request/gi) || []).length === 2);
for (const fn of ['pv_request_set_status', 'pv_request_set_hidden']) {
  const body = SQL.slice(SQL.indexOf('function public.' + fn));
  ok(`★${fn} が pv_is_admin() で門を掛けている`,
     /if\s+not\s+public\.pv_is_admin\(\)\s+then/i.test(body.slice(0, 1400)));
}
/* ★要望1件ごとに余計な管理者メールを飛ばさない（db/referrals.sql の写し間違い）。 */
ok('★profiles に行を作らない', !/insert\s+into\s+public\.profiles/i.test(SQL));
/* $$ の対。一括編集で $ が化けた前例がある（CLAUDE.md）。 */
{
  const counts = {};
  for (const m of SQLC.matchAll(/\$([a-z_]*)\$/g)) counts[m[1]] = (counts[m[1]] ?? 0) + 1;
  const odd = Object.entries(counts).filter(([, n]) => n % 2 !== 0);
  ok('$$ の開きと閉じが対になっている', odd.length === 0,
     odd.map(([t, n]) => `$${t}$ が ${n} 個`).join(' / '));
}

/* ════════════════════════════════════════════════════════════════
   ⑩ ページ登録の一覧（1つ忘れても何も赤くならない場所）
   ════════════════════════════════════════════════════════════════ */
console.log('\n── ページ登録 ───────────────────────────');
for (const f of ['./gen-sitemap.mjs', './seo-normalize.mjs', './assert-seo.mjs']) {
  ok(`${f} の NOINDEX に roadmap.html が在る`, /'roadmap\.html'/.test(read(f)));
}
/* ★noindex でも <title> は出る。COPY が無いと次に流した人がタイトルを空にする。 */
ok('seo-normalize.mjs の COPY に roadmap.html が在る',
   /'roadmap\.html'\s*:\s*\{\s*\n?\s*ja:/.test(read('./seo-normalize.mjs')));
ok('pv-session.js の GUARDED に roadmap が在る', /\|roadmap\)\\?\.html/.test(read('./pv-session.js')));
ok('lang-toggle.js の STICKY_EN に roadmap.html が在る',
   /STICKY_EN[\s\S]{0,400}'roadmap\.html'/.test(read('./lang-toggle.js')));
ok('assert-header.mjs が日英2枚を測る',
   /'\/roadmap\.html'/.test(read('./assert-header.mjs'))
   && /'\/en\/roadmap\.html'/.test(read('./assert-header.mjs')));
ok('assert-founding.mjs が称号を出さない一覧に入れている',
   /'roadmap\.html',\s*'en\/roadmap\.html'/.test(read('./assert-founding.mjs')));
ok('patch-side-nav.mjs に ROADMAP が在る', /roadmap:\s*'ROADMAP'/.test(read('./patch-side-nav.mjs')));
ok('notify-admin が pv_requests を知っている',
   /pv_requests:\s*buildRequest/.test(read('./supabase/functions/notify-admin/index.ts')));
ok('Webhook の表に pv_requests が在る', /'pv_requests'/.test(read('./db/notify-admin-webhooks.sql')));
ok('★♡ の表には Webhook を作らない',
   !/'pv_request_likes'/.test(read('./db/notify-admin-webhooks.sql')));

/* ════════════════════════════════════════════════════════════════ */
console.log(`\n${fail ? '❌' : '✅'} ${pass} 件通過 / ${fail} 件失敗`);
if (fail) process.exitCode = 1;
