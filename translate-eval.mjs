/* ════════════════════════════════════════════════════════════════
   translate-eval.mjs — 口コミの日↔英 翻訳を手元で訳し比べる

   なぜ要るか:
     プロンプトを1文字直すたびに「Supabase ダッシュボードで Deploy →
     口コミを投稿し直す」が要ると、訳の質は詰められない。
     ここは supabase/functions/translate-review/index.ts の
     **プロンプトと翻訳の実体をそのまま import して**動かす。
     コピーを持たないので本体と乖離しない（Node 24 は .ts を直接読める）。

   使い方:
     node translate-eval.mjs              定型の題材で日→英・英→日の両方
     node translate-eval.mjs --ja         日本語の題材だけ（ja→en）
     node translate-eval.mjs --en         英語の題材だけ（en→ja）
     node translate-eval.mjs --row <id>   本番の口コミ1件で試す（DBは書き換えない）

   要るもの: mail-bot/.env の ANTHROPIC_API_KEY（gitignore 済み・開発用）
             --row を使うときは SUPABASE_URL / SUPABASE_SERVICE_KEY も

   ⚠️ ここは API を実際に叩いて課金される。CI やデプロイ前チェックには入れない。
      形の検証（ネットワーク不要）は node assert-translate-review.mjs が受け持つ。
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

/* ── .env（mail-bot と同じ読み方） ── */
const envPath = join(ROOT, 'mail-bot/.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const [k, ...v] = s.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY がありません。mail-bot/.env に開発用のキーを1行足してください。');
  console.error('   （このファイルは gitignore 済み。リポジトリには入りません）');
  process.exit(1);
}

/* ── 本体を読み込む。Deno.env / Deno.serve だけ差し替える ── */
globalThis.Deno = {
  env: { get: (k) => process.env[k] ?? '' },
  serve: () => {},           // Edge Function の入口は動かさない
};
const fn = await import('./supabase/functions/translate-review/index.ts');

/* ── 題材。実在の投稿は使わない（このリポジトリは PUBLIC）。
      業界語・金額・機種が一通り入るように書いてある。 ── */
const CASES = [
  {
    tag: 'ja→en',
    ctx: { airline: 'ana', position: 'captain' },
    fields: [
      ['culture', '外資と比べると上下関係ははっきりしているが、コックピットでの意見は言いやすい。安全に関わる指摘を年次で止める空気は無い。'],
      ['salary', '機長で年収1,800万円ほど。乗務手当の比率が高いので、飛べない月があると手取りは目に見えて落ちる。ここ数年は物価に追いついていない。'],
      ['benefits', '住宅補助と社員割引搭乗はあるが、外資のような住宅そのものの提供は無い。企業年金は手厚い方だと思う。'],
      ['wlb', '国内線主体の月は生活が読めるが、国際線が混ざると時差の戻しに数日かかる。ステイ先での連泊は減った。'],
      ['ops', 'B787とA320が中心。整備は丁寧で、機材都合の欠航はほとんど無い。'],
      ['training', '定期審査は年2回。教官によって当たり外れがあるのは事実だが、自社養成の教育の土台はしっかりしている。'],
      ['mgmt', '乗務手当への依存を下げて、基本給を上げてほしい。若手が生活設計を立てられない。'],
    ],
  },
  {
    tag: 'en→ja',
    ctx: { airline: 'emirates', position: 'captain' },
    fields: [
      ['culture', 'Over 140 nationalities on the line, so you fly with someone new almost every trip. It is a big, process-driven company and the hierarchy is real, but nobody stops you raising a safety point.'],
      ['salary', 'Roughly USD 225K a year as a captain, and Dubai is tax-free, so the take-home is well ahead of most European carriers. A large slice of it is flying pay, so a light roster month is felt immediately.'],
      ['benefits', 'Company villa or a generous housing allowance, full medical for the family, school fees covered, and staff travel on Cat A/C that is actually usable.'],
      ['wlb', 'Ultra-long-haul pairings back to back will catch up with you. Roster stability varies month to month and fatigue management is on you as much as on the company.'],
      ['ops', 'B777 and A380 only, all wide-body, and the maintenance standard is high. SOPs are tight and the same everywhere on the network.'],
      ['training', 'Full-flight simulators in Dubai are as good as anywhere. The recurrent check is genuinely demanding and the standard of instruction does not drop off.'],
      ['mgmt', 'Give us more roster predictability on the ULR pairings. That is what decides whether people stay past their second contract.'],
    ],
  },
];

const only = process.argv.includes('--ja') ? 'ja→en'
  : process.argv.includes('--en') ? 'en→ja' : null;
const rowIdx = process.argv.indexOf('--row');
const ROW_ID = rowIdx >= 0 ? process.argv[rowIdx + 1] : null;

const KEYS = ['culture', 'salary', 'benefits', 'wlb', 'ops', 'training', 'mgmt'];

/* --row: 本番の1件を読むだけ。翻訳結果は表示するだけで DB は書き換えない。 */
async function loadRow(id) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ --row には SUPABASE_URL / SUPABASE_SERVICE_KEY が要ります。');
    process.exit(1);
  }
  const cols = ['id', 'airline', 'position', ...KEYS.map((k) => `${k}_comment`)].join(',');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/reviews_v2?id=eq.${encodeURIComponent(id)}&select=${cols}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY },
  });
  if (!res.ok) throw new Error(`REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const row = (await res.json())[0];
  if (!row) throw new Error(`id=${id} が見つかりません`);
  const fields = KEYS.map((k) => [k, (row[`${k}_comment`] ?? '').trim()]).filter(([, t]) => t);
  return { tag: 'row', ctx: { airline: row.airline, position: row.position }, fields };
}

/* 日本語には単語の区切りが無いので、空白では折れない。文字数で折り、
   直前に空白があればそこまで戻す（英語のときだけ効く）。 */
function wrap(text, label) {
  const WIDTH = 60;
  const lines = [];
  let rest = [...(text ?? '')];
  while (rest.length) {
    let n = Math.min(WIDTH, rest.length);
    if (n === WIDTH) {
      const sp = rest.slice(0, n + 1).lastIndexOf(' ');
      if (sp > WIDTH - 20) n = sp;
    }
    lines.push(rest.slice(0, n).join('').trim());
    rest = rest.slice(n);
  }
  if (!lines.length) lines.push('');
  return lines.map((l, i) => `  ${i === 0 ? label : '    '} │ ${l}`).join('\n');
}

async function run(c) {
  const from = fn.detectLang(c.fields.map(([, t]) => t).join('\n'));
  const to = from === 'ja' ? 'en' : 'ja';
  console.log(`\n${'═'.repeat(76)}`);
  console.log(`${c.tag}  (判定: ${from} → ${to})  会社=${c.ctx.airline ?? '-'} 職位=${c.ctx.position ?? '-'}  model=${fn.MODEL}`);
  console.log('═'.repeat(76));

  let draft = {}, suspect = {};
  const t0 = process.hrtime.bigint();
  const final = await fn.translate(c.fields, from, to, c.ctx, (d, s) => { draft = d; suspect = s; });
  const secs = Number(process.hrtime.bigint() - t0) / 1e9;

  let changed = 0;
  for (const [k, src] of c.fields) {
    console.log(`\n── ${k} ──`);
    console.log(wrap(src, '原文'));
    console.log(wrap(draft[k] ?? '(訳が出なかった)', '下訳'));
    if (final[k] !== draft[k]) {
      changed++;
      console.log(wrap(final[k] ?? '(訳が出なかった)', '推敲'));
    } else {
      console.log('  推敲 │ （変更なし）');
    }
    if (suspect[k]) console.log(`  ⚠️ 下訳に見当たらなかった数字: ${suspect[k].join(', ')}`);
    const still = final[k] ? fn.missingNumbers(src, final[k]) : [];
    if (still.length) console.log(`  ⚠️ 推敲後も見当たらない数字: ${still.join(', ')}（言い換えなら問題なし・目視）`);
  }

  console.log(`\n合計 ${c.fields.length} 欄 / 推敲が直した欄 ${changed} / ${secs.toFixed(1)} 秒`);
  const dropped = c.fields.filter(([k]) => !final[k]).map(([k]) => k);
  if (dropped.length) console.log(`⚠️ 訳が出なかった欄: ${dropped.join(', ')}（表示は原文に落ちる）`);
}

const targets = ROW_ID ? [await loadRow(ROW_ID)] : CASES.filter((c) => !only || c.tag === only);
for (const c of targets) await run(c);
console.log('\n訳が不自然なら supabase/functions/translate-review/index.ts の GLOSSARY に'
  + '\n**実際に出た誤訳だけ**を足して、もう一度ここで回す。良ければダッシュボードで Deploy。');
