// check-sources.mjs — 出所台帳 salary-sources.mjs の検証。
// node check-sources.mjs            構造・語彙・孤児キー・出所ゼロの検出（ネットワーク無し）
// node check-sources.mjs --online   上記に加えて、載っているURLが実際に生きているかを叩いて確認
//
// 方針の本文は DATA-PROVENANCE.md。この検証が守るのは3つ:
//   1. 台帳が SALARY と噛み合っているか（typo・削除済み slug の置き去り）
//   2. status:'in_use'（＝根拠として採用中）に必要な情報が揃っているか
//   3. conf:'high' を名乗る社に、実際に根拠があるか
//
// ★ 3 が本題。「確度が高い」と表示しているのに出所が1件も無い社は、
//   デューデリで最初に突かれる。埋まるまで ⚠️ を出し続けるのが正しい状態なので、
//   ⚠️ では exit 1 にしない（❌ だけ落とす）。
import { SALARY } from './salary-data.mjs';
import { SOURCES, REFERENCES, SOURCE_TYPES, STATUSES } from './salary-sources.mjs';

const ONLINE = process.argv.includes('--online');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
         + '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const RANKS = ['cap', 'fo', 'all'];
const DATE  = /^\d{4}-\d{2}-\d{2}$/;

const bad  = [];   // ❌ 誤り。exit 1 にする
const warn = [];   // ⚠️ 要対応だが、現時点でそうなっているのが正しいこともある

// ── 1エントリの形を見る ────────────────────────────────────────────
// where は「どこの何番目か」を人が追えるようにするためのラベル。
function checkEntry(e, where) {
  if (!RANKS.includes(e.rank))
    bad.push(`❌ ${where} rank='${e.rank}' は ${RANKS.join('/')} のどれかであるべき`);
  if (!SOURCE_TYPES.includes(e.source_type))
    bad.push(`❌ ${where} source_type='${e.source_type}' は語彙外（DATA-PROVENANCE.md 1. の表と一致させる）`);
  if (!STATUSES.includes(e.status))
    bad.push(`❌ ${where} status='${e.status}' は ${STATUSES.join('/')} のどれかであるべき`);

  if (!e.name || !String(e.name).trim())
    bad.push(`❌ ${where} name が空（資料名が無いと後から特定できない）`);
  if (!e.url || !/^https?:\/\//.test(e.url))
    bad.push(`❌ ${where} url が無いか http(s) でない`);

  for (const k of ['published_at', 'accessed_at']) {
    const v = e[k];
    if (v == null) continue;              // null は「未確認」として許す
    if (!DATE.test(v)) bad.push(`❌ ${where} ${k}='${v}' は YYYY-MM-DD か null であるべき`);
  }
  if (!e.accessed_at)
    bad.push(`❌ ${where} accessed_at が無い（いつ確認したかが無い記録は来歴にならない）`);

  // in_use ＝「SALARY の数値を支える根拠として採用中」。ここだけは全部揃っていないといけない。
  if (e.status === 'in_use') {
    if (!e.value_orig) bad.push(`❌ ${where} status:'in_use' なのに value_orig が無い（原通貨・原単位の実額）`);
    if (!e.quote)      bad.push(`❌ ${where} status:'in_use' なのに quote が無い（該当箇所を引用できない資料は採用しない）`);
  }
}

// ── 台帳を回す ────────────────────────────────────────────────────
console.log('── 出所台帳の構造 ──');

const refIds = new Set();
REFERENCES.forEach((e, i) => {
  const where = `REFERENCES[${i}] (${e.id || 'id無し'})`;
  if (!e.id) bad.push(`❌ ${where} id が無い`);
  else if (refIds.has(e.id)) bad.push(`❌ ${where} id が重複`);
  else refIds.add(e.id);
  if (!e.scope) bad.push(`❌ ${where} scope が無い（会社に紐づかない資料は、何を覆う資料かを書く）`);
  checkEntry(e, where);
});

let nEntries = REFERENCES.length;
for (const [slug, list] of Object.entries(SOURCES)) {
  if (!SALARY[slug]) {
    bad.push(`❌ SOURCES['${slug}'] は SALARY に存在しない slug（typo か、SALARY から消えた社の置き去り）`);
    continue;
  }
  if (!Array.isArray(list)) { bad.push(`❌ SOURCES['${slug}'] が配列でない`); continue; }
  if (!list.length)         { warn.push(`⚠️  SOURCES['${slug}'] が空配列（消すか、資料を入れる）`); continue; }
  list.forEach((e, i) => { nEntries++; checkEntry(e, `SOURCES['${slug}'][${i}]`); });
}

const nCompanies = Object.keys(SOURCES).length;
console.log(`${nEntries}件（会社別 ${nCompanies}社 ／ 会社に紐づかない参照 ${REFERENCES.length}件）`);

// ── conf:'high' を名乗る社に根拠があるか ───────────────────────────
console.log('\n── conf:\'high\' の裏付け ──');
const highs = Object.entries(SALARY).filter(([, d]) => d.conf === 'high').map(([s]) => s);
let nBacked = 0;
for (const slug of highs) {
  const list  = SOURCES[slug] || [];
  const inUse = list.filter(e => e.status === 'in_use').length;
  const cand  = list.filter(e => e.status === 'candidate').length;
  if (inUse) { nBacked++; console.log(`✅ ${slug.padEnd(10)} in_use ${inUse}件`); continue; }
  const detail = cand ? `candidate ${cand}件のみ（引用・実額の目視が未了）` : '出所ゼロ';
  warn.push(`⚠️  ${slug.padEnd(10)} conf:'high' だが採用済みの出所が無い — ${detail}`);
}
console.log(`${nBacked}/${highs.length} 社が in_use の出所を持つ`);

// ── URL の生存確認（--online のときだけ） ──────────────────────────
if (ONLINE) {
  console.log('\n── URL 生存確認（--online） ──');
  const all = [...REFERENCES, ...Object.values(SOURCES).flat()];
  const urls = [...new Set(all.map(e => e.url).filter(Boolean))];
  for (const url of urls) {
    // 巨大PDFを丸ごと落とさないよう Range で先頭だけ要求し、ヘッダを見たら本文は捨てる。
    let line;
    try {
      const ac = new AbortController();
      const t  = setTimeout(() => ac.abort(), 30_000);
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Range: 'bytes=0-1024' },
        redirect: 'follow', signal: ac.signal,
      });
      clearTimeout(t);
      res.body?.cancel().catch(() => {});
      const ct = (res.headers.get('content-type') || '').split(';')[0];
      if (res.ok) line = `✅ ${res.status} ${ct.padEnd(24)} ${url}`;
      // 403 はサイト側のbot判定で出ることがあり、資料が消えたとは限らない。落とさず目視送り。
      else if (res.status === 403) { line = `⚠️  403 ${'(bot判定の可能性)'.padEnd(24)} ${url}`; warn.push(`⚠️  403 ${url} — ブラウザで開いて生きているか確認する`); }
      else { line = `❌ ${res.status} ${ct.padEnd(24)} ${url}`; bad.push(`❌ ${res.status} ${url}`); }
    } catch (err) {
      line = `❌ --- ${String(err.message || err).slice(0, 24).padEnd(24)} ${url}`;
      bad.push(`❌ 到達不能 ${url}（${err.message || err}）`);
    }
    console.log(line);
  }
  console.log(`${urls.length}件のURLを確認`);
  console.log('⚠️  200 が返っても中身が404ページのことがある（soft 404）。'
            + 'in_use に上げる前に必ず開いて引用を目視すること。');
}

// ── まとめ ────────────────────────────────────────────────────────
console.log('\n── まとめ ──');
if (warn.length) console.log(warn.join('\n'));
if (bad.length)  console.log(bad.join('\n'));
console.log(`❌${bad.length} ⚠️${warn.length}`);
if (!bad.length && !warn.length) console.log('✅ 問題なし');
if (!ONLINE) console.log('（URLの生存は未確認。node check-sources.mjs --online で叩く）');

if (bad.length) process.exitCode = 1;
