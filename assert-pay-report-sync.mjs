/* ════════════════════════════════════════════════════════════════
   assert-pay-report-sync.mjs
   給与レポート（pay-report.html / en/pay-report.html）の日英が、
   **片方だけ直されていないか**を見る。

   ── なぜ要るか ──────────────────────────────────────────────
   この2枚は同じ JS を1,900行ずつ**2つ持っている**。CSS は
   2026-08-27 に pay-report.css へ1本化したが、JS は文言が
   50か所ほど混ざっているので今も2つ持ち。
   いちばん静かな壊れ方は「日本語だけ直して英語を忘れる」で、
   画面は両方とも普通に動いたまま、英語で出した人のデータだけ
   欠ける。気づくのは何日も後になる（実際に何度も起きている）。

   ── 何を見るか ──────────────────────────────────────────────
   文言の違いは**見ない**（違って当たり前）。見るのは骨格だけ:
   触る DOM の id ／ querySelector の目印 ／ RPC とテーブル名 ／
   関数名 ／ payload のキー ／ localStorage のキー ／
   検証（showErr）の数と val/num で読む欄。
   片方にだけ欄・関数・保存先が増えたら、ここで落ちる。

   ── D) 共有 JS（2026-09-08 に追加）─────────────────────────────
   5ステップの器は pay-wizard.js へ切り出して**日英で1本を共有**する。
   共有にすると、日英のズレは減る代わりに新しい静かな壊れ方が3つ増える:
     ・片方のページが読み込む <script src> を書き忘れる
       （window.PVPayWizard が無いまま＝その言語だけ器が消え、
         1枚の長いページに戻る。画面は普通に動くので気づかない）
     ・ページが呼んでいる WZ.〜 が pay-wizard.js に無い
       （押した瞬間だけ TypeError。撮った絵には出ない）
     ・片方の言語だけ新しい WZ.〜 を使い始める（動作が日英でズレる）
   この3つを下で見る。

   ⚠️ コメントは必ず落としてから照合する。落とさないと英語の
   地の文（"would have left…" / "default: anything already…"）が
   関数名やキーに化けて、嘘の食い違いが3件出る。

   ⚠️ パーサは使わない。esprima は puppeteer の**孫**として
   たまたま入っているだけで、依存に足していない。
   ここの stripNoise() は正規表現リテラルの中のクォートで
   壊れないように、直前の文字を見て正規表現かどうかを決める。

   使い方: node assert-pay-report-sync.mjs
   ネットも localhost も鍵も使わない。
   ════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ── 本体の <script>（src の無いいちばん長いもの）を取り出す ──────
   行番号で切らない。あの2枚は毎日動いていて、番号は必ず腐る。 */
function mainScript(html, label) {
  let best = '';
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))
    if (m[1].length > best.length) best = m[1];
  /* ★2026-09-08、下限を 2万文字から 5千文字へ下げた。
     この数字は「本体を取り違えていないか」を見るためだけのもので、
     **インラインを外へ出すことを禁じる意味は無い**（5ステップの器は
     pay-wizard.js へ出した）。切り出しの安全は下の D) が見ている。 */
  if (best.length < 5000) {
    console.log('❌ ' + label + ': 本体の <script> が見つからない（' + best.length + '文字）');
    console.log('   外部ファイルへ切り出したなら、このスクリプトの読む先を直すこと。');
    process.exit(1);
  }
  return best;
}

/* ── コメントを落とす。文字列と正規表現リテラルの中は触らない ──── */
function stripNoise(src) {
  let out = '', i = 0;
  const n = src.length;
  // 直前の意味のあるトークンが「値」なら / は割り算、そうでなければ正規表現
  let prev = '';
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; out += c; i++;
      while (i < n && src[i] !== q) { if (src[i] === '\\') { out += src[i]; i++; } out += src[i]; i++; }
      out += q; i++; prev = 'str'; continue;
    }
    if (c === '/' && !/[\w$)\]]/.test(prev)) {        // 正規表現リテラル
      out += c; i++;
      let cls = false;
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        if (src[i] === '[') cls = true;
        else if (src[i] === ']') cls = false;
        else if (src[i] === '/' && !cls) break;
        else if (src[i] === '\n') break;             // 壊れた入力で暴走しない
        out += src[i]; i++;
      }
      out += src[i] || ''; i++; prev = 'str'; continue;
    }
    out += c;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

/* ── 骨格の signature。文言は入らない ─────────────────────────── */
const SIGS = {
  '触る DOM の id':        [/\$\(\s*'([^']+)'/g, /getElementById\(\s*'([^']+)'/g],
  'querySelector の目印':  [/querySelector(?:All)?\(\s*'([^']+)'/g],
  'RPC・テーブル':          [/\.(?:rpc|from)\(\s*'([^']+)'/g],
  '関数名':                [/function\s+([A-Za-z_$][\w$]*)/g,
                            /const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g,
                            /const\s+([A-Za-z_$][\w$]*)\s*=\s*function/g],
  'payload のキー':        [/^[ \t]*([a-z_][a-z0-9_]*)\s*:/gm],
  'localStorage のキー':   [/localStorage\.(?:getItem|setItem|removeItem)\(\s*'([^']+)'/g],
  '読む欄（val/num/pick）': [/\b(?:val|num|pick)\(\s*'([^']+)'/g],
};

/* 直したい理由があって食い違っているものだけ、理由つきでここに置く。
   ⚠️ 増やすときは必ず「なぜ日英で違ってよいのか」を書く。空のまま増やさない。 */
const ALLOW = {
  '関数名': {
    countryPhrase: '英語だけ。国名の前に the が要る国（the US / the UK …）を足す。日本語に相当する処理が無い。',
  },
};

let fail = 0, checked = 0;
const ja = stripNoise(mainScript(read('pay-report.html'), 'pay-report.html'));
const en = stripNoise(mainScript(read('en/pay-report.html'), 'en/pay-report.html'));
console.log('日: ' + ja.length.toLocaleString() + '文字 / 英: ' + en.length.toLocaleString() + '文字（コメントを落とした後）\n');

for (const [name, res] of Object.entries(SIGS)) {
  const A = new Set(), B = new Set();
  for (const [src, set] of [[ja, A], [en, B]])
    for (const re of res) for (const m of src.matchAll(re)) if (m[1]) set.add(m[1]);
  const allow = ALLOW[name] || {};
  const onlyJa = [...A].filter((x) => !B.has(x) && !allow[x]);
  const onlyEn = [...B].filter((x) => !A.has(x) && !allow[x]);
  const ok = !onlyJa.length && !onlyEn.length;
  checked++;
  if (!ok) fail++;
  console.log((ok ? '✅' : '❌') + ' ' + name + '  （日 ' + A.size + ' / 英 ' + B.size + '）');
  if (onlyJa.length) console.log('      日本語にしか無い: ' + onlyJa.join(', '));
  if (onlyEn.length) console.log('      英語にしか無い  : ' + onlyEn.join(', '));
}

/* ── 検証の数。片方で1つ弾き忘れると、その言語だけ空の行が保存される ── */
const cnt = (s, re) => (s.match(re) || []).length;
for (const [name, re] of [['showErr（送信前に止める数）', /showErr\(/g],
                          ['req-tag を読む場所', /is-req/g],
                          ['openOpt（節の開け閉め）', /openOpt\(/g]]) {
  const a = cnt(ja, re), b = cnt(en, re);
  checked++;
  if (a !== b) fail++;
  console.log((a === b ? '✅' : '❌') + ' ' + name + '  （日 ' + a + ' / 英 ' + b + '）');
}

/* ── D) 共有 JS（pay-wizard.js）─────────────────────────────────
   ★生の HTML を見る（mainScript() は src 付きの <script> を捨てるので、
     読み込みそのものはあちらでは見えない）。 */
const jaHtml = read('pay-report.html');
const enHtml = read('en/pay-report.html');

/* D-1 それぞれが正しい相対パスで読み込んでいるか。en/ は1つ上。 */
for (const [label, html, want] of [['日 pay-report.html', jaHtml, 'pay-wizard.js'],
                                   ['英 en/pay-report.html', enHtml, '../pay-wizard.js']]) {
  const re = new RegExp('<script[^>]*\\bsrc="' + want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"');
  const ok = re.test(html);
  checked++;
  if (!ok) fail++;
  console.log((ok ? '✅' : '❌') + ' 共有 JS の読み込み  （' + label + ' → ' + want + '）');
  if (!ok) console.log('      これが無いと window.PVPayWizard が undefined のまま＝'
                     + 'その言語だけ5ステップが消える（画面は普通に動く）。');
}

/* D-2 ページが呼ぶ WZ.〜 が、pay-wizard.js の API に実在するか。
   ★呼ぶ側の綴り間違いは、押した瞬間にしか出ない（絵にも撮れない）。 */
const wiz = read('pay-wizard.js');
const apiHave = new Set();
{
  const body = wiz.slice(wiz.indexOf('var API = {'));
  for (const m of body.matchAll(/^  ([A-Za-z_$][\w$]*)\s*:/gm)) apiHave.add(m[1]);
}
const used = (src) => {
  const out = new Set();
  for (const m of src.matchAll(/\bWZ\.([A-Za-z_$][\w$]*)/g)) out.add(m[1]);
  return out;
};
const jaUse = used(ja), enUse = used(en);
{
  const missing = [...new Set([...jaUse, ...enUse])].filter((k) => !apiHave.has(k));
  checked++;
  if (missing.length) fail++;
  console.log((missing.length ? '❌' : '✅') + ' WZ の参照先  （呼ぶ ' + new Set([...jaUse, ...enUse]).size
            + ' / pay-wizard.js が持つ ' + apiHave.size + '）');
  if (missing.length) console.log('      pay-wizard.js に無い: ' + missing.join(', '));
}

/* D-3 日英が同じ WZ.〜 を使っているか（＝器の使い方が同じか）。 */
{
  const onlyJa = [...jaUse].filter((k) => !enUse.has(k));
  const onlyEn = [...enUse].filter((k) => !jaUse.has(k));
  const ok = !onlyJa.length && !onlyEn.length;
  checked++;
  if (!ok) fail++;
  console.log((ok ? '✅' : '❌') + ' WZ の使い方が日英で同じ  （日 ' + jaUse.size + ' / 英 ' + enUse.size + '）');
  if (onlyJa.length) console.log('      日本語にしか無い: ' + onlyJa.join(', '));
  if (onlyEn.length) console.log('      英語にしか無い  : ' + onlyEn.join(', '));
}

console.log('\n══ ' + (checked - fail) + ' 通過 / ' + fail + ' 失敗 ══');
if (fail) {
  console.log('\n日英のどちらかにだけ手が入っている。両方に同じ直しを入れること。');
  console.log('わざと違えているなら、このファイルの ALLOW に理由つきで置く。');
  process.exitCode = 1;
}
