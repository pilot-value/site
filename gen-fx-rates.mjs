/* ════════════════════════════════════════════════════════════════
   gen-fx-rates.mjs — 換算レートを取り直して fx-rates.mjs と currency.js を書き替える

   なぜ要るか。2026-08-22 まで換算レートは currency.js に手書きの7通貨しか無く、
   ポンドと豪ドルが実勢から15%ずれていた。直す手段が無かったので腐った。
   語彙（pv-vocab.mjs）は45通貨を受け付けるので、レートが無い38通貨で出した人は
   annual_total_usd が null になり、集計から黙って外れていた（エバー航空の台湾ドル）。

   実行: node gen-fx-rates.mjs            取り直して書く
         node gen-fx-rates.mjs --check    差分を出すだけ。書かない

   ⚠️ ネットを叩く。デプロイ前チェックの一覧には入れない。
   ⚠️ 流したあと必ずやること:
        1. node gen-vocab.mjs        （db/vocab.generated.sql を作り直す）
        2. db/vocab.generated.sql を Supabase で流す（オーナー作業。流すまで DB は古いまま）
        3. node assert-jp.mjs / node assert-currency.mjs
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CURRENCIES } from './pv-vocab.mjs';

const ROOT  = fileURLToPath(new URL('.', import.meta.url));
const CHECK = process.argv.includes('--check');
const API   = 'https://open.er-api.com/v6/latest/USD';

const p = (f) => path.join(ROOT, f);
const read = (f) => readFileSync(p(f), 'utf8');

/* ── 取ってくる ─────────────────────────────────────────── */
const res = await fetch(API, { signal: AbortSignal.timeout(20000) });
if (!res.ok) { console.error(`❌ ${API} が ${res.status}。何も書いていない。`); process.exit(1); }
const j = await res.json();
if (j.result !== 'success' || !j.rates || !(j.rates.JPY > 0)) {
  console.error('❌ 返ってきた形が想定と違う。何も書いていない。'); process.exit(1);
}

const missing = CURRENCIES.map((c) => c.code).filter((c) => c !== 'JPY' && !(j.rates[c] > 0));
if (missing.length) {
  console.error(`❌ 提供元に無い通貨がある: ${missing.join(' ')}。1つでも欠けたら書かない`);
  process.exit(1);
}

const AS_OF = new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10);
const USDJPY = j.rates.JPY;

/* 1通貨あたりの円。大きい通貨ほど小数を減らす（クウェートディナールは520円、
   ベトナムドンは0.006円。同じ桁数だとどちらかが意味を失う） */
const jpyPer = (code) => {
  if (code === 'JPY') return 1;
  const v = USDJPY / j.rates[code];
  return Number(v >= 100 ? v.toFixed(2) : v >= 1 ? v.toFixed(4) : v.toFixed(6));
};
const NEW = Object.fromEntries(CURRENCIES.map((c) => [c.code, jpyPer(c.code)]));

/* ── 差分を出す（currency.js に今ある7通貨だけ、表示が動く） ── */
const cjs = read('currency.js');
const mOrder = cjs.match(/var ORDER = \[([^\]]*)\];/);
if (!mOrder) { console.error('❌ currency.js の ORDER が読めない（形が変わった？）'); process.exit(1); }
const ORDER = mOrder[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);

const mRates = cjs.match(/ {2}var RATES = \{[^}]*\};/);
if (!mRates) { console.error('❌ currency.js の RATES が読めない（形が変わった？）'); process.exit(1); }
const OLD = Object.fromEntries(
  mRates[0].replace(/^[^{]*\{|\};$/g, '').split(',').map((kv) => {
    const [k, v] = kv.split(':').map((s) => s.trim());
    return [k, Number(v)];
  }),
);

console.log(`提供元 ${j.provider}  基準日 ${AS_OF}  USD/JPY ${USDJPY}`);
console.log(`\n── サイトの表示が動く ${ORDER.length} 通貨 ──`);
for (const c of ORDER) {
  const o = OLD[c], n = NEW[c];
  const d = o ? ((n - o) / o) * 100 : 0;
  console.log(`  ${c.padEnd(4)} ${String(o).padStart(9)} → ${String(n).padStart(9)}  ${d >= 0 ? '+' : ''}${d.toFixed(1)}%`);
}
console.log(`\n── 集計だけに効く ${CURRENCIES.length - ORDER.length} 通貨（サイトの表示には出ない） ──`);
console.log('  ' + CURRENCIES.map((c) => c.code).filter((c) => !ORDER.includes(c)).join(' '));

/* ── 書く ────────────────────────────────────────────── */
const pad = (s, n) => String(s).padEnd(n);
const body = CURRENCIES.map((c) =>
  `  ${pad(c.code + ':', 5)} ${String(NEW[c.code]).padStart(11)},   // ${c.ja}`).join('\n');

const out = `/* ════════════════════════════════════════════════════════════════
   fx-rates.mjs — ★自動生成。手で編集しない。
     生成元: node gen-fx-rates.mjs（${j.provider} の USD 基準スナップショット）
     基準日: ${AS_OF}（USD/JPY = ${USDJPY}）

   1通貨あたりの円。ここが換算レートの唯一の正で、
     ・currency.js の RATES（サイトの通貨切替。下の ${ORDER.length} 通貨だけ）
     ・db/vocab.generated.sql の fx_rates（DB の集計。${CURRENCIES.length} 通貨すべて）
   の両方がここから作られる。片方だけ直すと、画面の金額と集計の金額が食い違う。

   ⚠️ レートは腐る。半年に一度は node gen-fx-rates.mjs で取り直す
      （2026-08-22 時点で、前のレートはポンドが15%ずれていた）。
   ════════════════════════════════════════════════════════════════ */

export const AS_OF = '${AS_OF}';
export const SOURCE = '${j.provider}';

/** 1通貨あたりの円 */
export const JPY_PER = {
${body}
};
`;

if (CHECK) { console.log('\n[--check] 何も書いていない。--check を外すと書く。'); process.exit(0); }

writeFileSync(p('fx-rates.mjs'), out, 'utf8');

/* currency.js は非ESモジュール（<script> 直読み）なので import できない。
   ORDER の分だけ数値を差し替える。行の形は変えない。 */
const ratesLine = '  var RATES = { ' + ORDER.map((c) => `${c}: ${NEW[c]}`).join(', ') + ' };';
let next = cjs.replace(mRates[0], ratesLine);

/* 「2026年時点」のままだと、いつのレートか読んだ人に分からない */
const asOfJa = `${AS_OF.slice(0, 4)}年${Number(AS_OF.slice(5, 7))}月時点`;
const asOfEn = `as of ${new Date(AS_OF + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
next = next.replace(/ {2}var AS_OF = \{[^}]*\};/,
  `  var AS_OF = { ja: '${asOfJa}', en: '${asOfEn}' };`);
if (next === cjs) { console.error('❌ currency.js を書き替えられなかった'); process.exit(1); }
writeFileSync(p('currency.js'), next, 'utf8');

console.log(`\n✅ fx-rates.mjs（${CURRENCIES.length}通貨）と currency.js（${ORDER.length}通貨・${asOfJa}）を書いた`);
console.log('   次に: node gen-vocab.mjs → db/vocab.generated.sql を Supabase で流す（オーナー作業）');
