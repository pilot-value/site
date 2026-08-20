// check-salary.mjs — 全ページを salary-data.mjs と突き合わせて整合検証。
// node check-salary.mjs
//
// パス1: 各航空会社ページに、その会社の「機長平均」「副操縦士平均」が載っているか。
// パス2: サイト全 HTML から「社名＋役職＋金額」の並びを拾って SSOT と突き合わせる。
//
// ★ パス2 を足した理由: パス1 は SALARY を回して airlines/{slug}.html しか見ないため、
//   トップ・記事・比較ページが SSOT と一度も照合されていなかった。他社の年収を語る
//   ページは、その他社のページを直しても直らない。実際にこれで見つかった例:
//     world-jobs.html    Cathay Pacific「機長年収2,500万円〜」（SSOT のレンジ下限3,000万すら下回る）
//     pilot-vs-isha.html ANA「機長 ¥4,200万」（SSOT は2,700万）
//     index.html         LCC の FAQ が3社とも平均より高い数字
//   いずれも JSON-LD の FAQ や比較表＝検索結果に出る場所だった。
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SALARY, buildSalaryJson } from './salary-data.mjs';

// ── 生成物 salary-data.json が buildSalaryJson() と完全一致しているか（サラリーエンジン供給の整合） ──
// json は gen-salary-json.mjs の生成物（{spine, airlines:{slug:{...SALARY,ladder}}}）。
// 手編集や再生成漏れ・ラダー導出のズレをここで検出する。
function checkSalaryJson() {
  const p = 'salary-data.json';
  if (!existsSync(p)) return { ok: false, msg: `${p} が無い（node gen-salary-json.mjs を実行）` };
  let json;
  try { json = JSON.parse(readFileSync(p, 'utf8')); }
  catch { return { ok: false, msg: `${p} が壊れている（JSON parse 失敗）` }; }
  const a = JSON.stringify(buildSalaryJson());
  const b = JSON.stringify(json);
  if (a !== b) return { ok: false, msg: `${p} が salary-data.mjs と不一致（node gen-salary-json.mjs で再生成）` };
  const nAir = Object.keys(json.airlines || {}).length;
  return { ok: true, msg: `${p} == buildSalaryJson()（${nAir}社／背骨${(json.spine||[]).length}段）` };
}

const man = (n) => n.toLocaleString('en-US') + '万';

// 既知の「これが残っていたら誤り」な陳腐化文字列（そのページ固有）
const STALE = {
  'skymark': ['2,900万', '2,400万'],
  'delta': ['9,000万'],
  'united': ['8,500万'],
  'american': ['8,000万'],
  'cathay-pacific': ['7,000万'],
  'singapore-airlines': ['5,800万'],
  'emirates': ['5,100万'],
  'qatar-airways': ['5,100万'],
  'jal': ['900万〜2,700万', '900万〜¥2,700万'],
};

let pass = 0, warn = 0, fail = 0;
const lines = [];
for (const [slug, d] of Object.entries(SALARY)) {
  const p = `airlines/${slug}.html`;
  if (!existsSync(p)) { lines.push(`❓ ${slug}: page not found`); warn++; continue; }
  /* ★ 「同じ国の他社」リンク（link-countries.mjs の PV-CLINK ブロック）には
        他社の年収が入っている。そこを一緒に読むと、たとえば skymark のページに
        あるジェットスター・ジャパンの¥2,400万を skymark の古い数値と誤検知する
        （実際に stale:2,400万 の誤報が出た）。このページ自身の主張だけを見る。 */
  const html = readFileSync(p, 'utf8')
    .replace(/<!--PV-CLINK-->[\s\S]*?<!--\/PV-CLINK-->/g, '');
  const capStr = man(d.cap.avg), foStr = man(d.fo.avg);
  const hasCap = html.includes(capStr);
  const hasFo = html.includes(foStr);
  const stale = (STALE[slug] || []).filter((s) => html.includes(s));
  let status = '✅', tag = '';
  if (!hasCap || !hasFo) { status = '❌'; fail++; tag = `missing:${!hasCap?' CAP('+capStr+')':''}${!hasFo?' FO('+foStr+')':''}`; }
  else if (stale.length) { status = '⚠️ '; warn++; tag = `stale:${stale.join(',')}`; }
  else { pass++; }
  lines.push(`${status} ${slug.padEnd(20)} 機長${capStr} 副${foStr}   ${tag}`);
}
console.log(lines.join('\n'));
console.log(`\n${pass} pass · ${warn} warn · ${fail} fail  (of ${Object.keys(SALARY).length})`);

// ── パス2: サイト全 HTML × SSOT のクロスチェック ─────────────────────────
// 「社名 …少し離れて… 役職 …少し離れて… 数値万」という並びを全部拾い、SSOT と比べる。
// 表のセル（<td>ANA</td><td>機長</td><td>2,700万</td>）も拾えるよう、隙間はタグを跨がせる。
//
// ❌ = その会社の [lo, hi] の外。反証の余地なく間違い。
// ⚠️ = レンジ内だが SSOT の節目（avg / lo / hi）でない。人が見る価値がある。
//      ⚠️ には原理的に消せない誤検知が1種類ある — 「中東（Emirates・Qatar など）では
//      機長の平均年収が2,900〜3,700万」のように、複数社の平均をまたぐ言い方。
//      1社の lo/hi と比べる作りなので区別できない。ALLOW に理由つきで置く。

const SKIP_DIR = new Set(['node_modules', '.git', 'temporary screenshots', 'baland_ass', 'supabase', 'db', '.github']);
function walkHtml(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (SKIP_DIR.has(e) || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walkHtml(p, out);
    else if (e.endsWith('.html')) out.push(p);
  }
  return out;
}

// 「全日本空輸（ANA）」→ ['全日本空輸（ANA）', '全日本空輸', 'ANA'] のように呼び名を展開。
// 2文字以下（「JAL」未満の断片）は普通の文中で誤爆するので捨てる。
function aliases(d) {
  const out = new Set();
  for (const raw of [d.ja, d.en]) {
    if (!raw) continue;
    out.add(raw);
    const m = raw.match(/^(.+?)\s*[（(]([^）)]+)[）)]\s*$/);
    if (m) { out.add(m[1].trim()); out.add(m[2].trim()); }
  }
  return [...out].filter((s) => s.length >= 3);
}
const ALIAS = [];
for (const [slug, d] of Object.entries(SALARY)) for (const a of aliases(d)) ALIAS.push({ slug, a });
ALIAS.sort((x, y) => y.a.length - x.a.length); // 長い呼び名を先に当てる
const ALL_ALIAS = ALIAS.map((x) => x.a);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ROLE = '(機長|副操縦士|Captain|Captains|First Officer|First Officers)';
const GAP = '(?:<[^>]*>|[^<>\\d]){0,24}';  // タグを跨ぐ。跨がないと表のセルが全部見えない
const NUM = '([\\d,]{3,6})';
// 年額そのものでない数値（手取り・月額・住宅手当込みの実質パッケージ）は SSOT と一致しなくて当然
const DERIVED = /手取|月収|月額|毎月|月あたり|税引|実質|パッケージ|take-?home|after[- ]tax|per month|monthly|effectively|package/i;
// 社名の直前がこれなら、より長い社名の一部（「日本航空」⊂「新日本航空」、「ANA」⊂「ANAウイングス」）
const NAME_CHAR = /[0-9A-Za-zぁ-ゖァ-ヺー一-鿿]/;

// レンジ内だが節目でない ⚠️ のうち、人が見て正しいと判断したもの。
// 消すのではなく理由を残す（数字を動かしたとき、この理由ごと見直せるように）。
const ALLOW = [
  // 複数社の「平均」をまたぐ言い方。Qatar の平均2,900 → Emirates の平均3,700。正しい。
  ['index.html', '2,900〜3,700万'],
  ['en/index.html', '2,900–3,700万'],
  // キャリア段階の話（「ANA副操縦士時代」）。SSOT の fo レンジ1,400〜2,100 の内側。
  ['airlines/ana-vs-emirates.html', '1,400〜1,800万'],
  ['en/airlines/ana-vs-emirates.html', '1,400–1,800万'],
  // 転職体験記の一人称。SSOT の cap レンジ2,000〜3,900 の内側。
  ['airlines/starlux-tenshoku.html', '2,500〜3,500万'],
];

const files = walkHtml('.');
let nHit = 0, nBad = 0, nWarn = 0;
const cross = [];
for (const f of files) {
  const html = readFileSync(f, 'utf8').replace(/<!--PV-CLINK-->[\s\S]*?<!--\/PV-CLINK-->/g, '');
  for (const { slug, a } of ALIAS) {
    const d = SALARY[slug];
    const re = new RegExp(esc(a) + GAP + ROLE + GAP + NUM + '(?:\\s*万?\\s*[〜~–—-]\\s*' + NUM + ')?\\s*万', 'g');
    let m;
    while ((m = re.exec(html)) !== null) {
      const span = m[0];
      // ① 社名がより長い社名の一部でないか
      if (m.index > 0 && NAME_CHAR.test(html[m.index - 1])) continue;
      if (ALL_ALIAS.some((x) => x.length > a.length && html.startsWith(x, m.index))) continue;
      // ② 社名と金額のあいだに、別の社名や行の切れ目が挟まっていないか
      //    （比較表で「ANA（参考）」の見出しから隣の会社のセルまで届いてしまう）
      const inner = span.slice(a.length);
      if (/<\/(?:tr|thead|tbody|table|section|article|li|ul|ol)>/.test(inner)) continue;
      if (ALL_ALIAS.some((x) => x !== a && !a.includes(x) && inner.includes(x))) continue;
      // ③ 手取り・月額・実質パッケージは年額ではない
      if (DERIVED.test(html.slice(Math.max(0, m.index - 40), m.index + span.length + 20))) continue;

      const role = /機長|Captain/.test(m[1]) ? 'cap' : 'fo';
      const S = d[role];
      const lo = +m[2].replace(/,/g, '');
      const hi = m[3] ? +m[3].replace(/,/g, '') : null;
      nHit++;
      // 単独の数値は avg / lo / hi のどれかであれば正。レンジ表記は lo〜hi と一致すべき。
      if (hi === null ? [S.avg, S.lo, S.hi].includes(lo) : lo === S.lo && hi === S.hi) continue;
      const text = span.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
      if (ALLOW.some(([af, frag]) => f.replace(/^\.\//, '') === af && text.includes(frag))) continue;
      const outside = hi === null ? (lo < S.lo || lo > S.hi) : (hi < S.lo || lo > S.hi);
      if (outside) nBad++; else nWarn++;
      const ln = html.slice(0, m.index).split('\n').length;
      cross.push(`${outside ? '❌' : '⚠️ '} ${f}:${ln}  «${text.slice(0, 56)}»  SSOT ${role} ${S.avg}（${S.lo}〜${S.hi}）`);
    }
  }
}
console.log(`\n── 全ページ × SSOT クロスチェック ──`);
if (cross.length) console.log(cross.sort().join('\n'));
console.log(`${files.length}ファイル・${nHit}件照合  ❌${nBad} ⚠️${nWarn}（許容${ALLOW.length}件は除外）`);

const js = checkSalaryJson();
console.log(`\n${js.ok ? '✅' : '❌'} salary-data.json: ${js.msg}`);

// ★ 以前は salary-data.json の不一致でしか exit 1 にならず、ページ側の ❌ が
//   出力に埋もれて本番まで抜けていた。ページの ❌ も落とす。
if (!js.ok || fail || nBad) process.exitCode = 1;
