#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — gen-vote-popular.mjs（2026-10-29）
   Vote（community.html）の「よく見られている会社」の並びを、GA4 の閲覧数から書き出す。

   なぜ GA4 か
     サイトにも DB にも、会社ごとの閲覧数の記録は無い（訪問は GA4 にしか残らない）。
     2026-10-29 オーナー判断：「GA4 の閲覧数から書き出す」。新しい記録の仕組みは作らない。
     ⚠️ **評価順・口コミ件数順で代用しない。** それは「よく見られている」ではない。

   書くもの
     vote-popular.json … { asOf, days, slugs:[上位6社] }
     ★**閲覧数そのものは書かない**（公開ファイル。並びだけを渡す）。数は画面にだけ出す。

   数え方
     airlines/{slug}.html と en/airlines/{slug}.html の screenPageViews を足す（日英で1社）。
     会社の一覧（pv-airlines.json の kind:"airline"）に在り、ページが実在する会社だけ。
     比較ページなど airlines/ の下の会社でないページは入らない。
     ボット（シンガポール）は ga-usage.mjs と同じく除く（ga-core.mjs の NOT_BOT）。

   使い方
     node gen-vote-popular.mjs            直近28日で書き出す
     node gen-vote-popular.mjs --days 60
     node gen-vote-popular.mjs --check    書かずに並びだけ見る
   ⚠️ ネットを叩くので check.mjs に入れない。並びは腐るので**月に1回は流し直す**。
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { gaConnect, NOT_BOT, iso } from './ga-core.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const argv = process.argv.slice(2);
const val = (f) => {
  const i = argv.findIndex((a) => a === f || a.startsWith(f + '='));
  if (i < 0) return null;
  return argv[i].includes('=') ? argv[i].slice(argv[i].indexOf('=') + 1) : (argv[i + 1] ?? null);
};
const DAYS = Math.max(7, Number(val('--days') ?? 28) || 28);
const TOP = 6;
const CHECK = argv.includes('--check');

const DIR = JSON.parse(readFileSync(path.join(ROOT, 'pv-airlines.json'), 'utf8')).airlines;
const isCompany = (slug) => DIR[slug]?.kind === 'airline' && existsSync(path.join(ROOT, 'airlines', slug + '.html'));

const { run } = await gaConnect();
const d0 = new Date(Date.now() - (DAYS - 1) * 86400_000);
const rows = await run({
  dateRanges: [{ startDate: iso(d0), endDate: 'today' }],
  dimensions: [{ name: 'pagePath' }],
  metrics: [{ name: 'screenPageViews' }],
  dimensionFilter: { andGroup: { expressions: [
    NOT_BOT,
    { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'FULL_REGEXP', value: '^/(en/)?airlines/[a-z0-9-]+\\.html$' } } },
  ] } },
  limit: 2000,
});

const views = {};
for (const r of rows) {
  const slug = r.dimensionValues[0].value.match(/airlines\/([a-z0-9-]+)\.html$/)?.[1];
  if (!slug || !isCompany(slug)) continue;
  views[slug] = (views[slug] || 0) + Number(r.metricValues[0].value || 0);
}
const ranked = Object.entries(views).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
if (ranked.length < TOP) {
  console.error(`❌ 会社ページの閲覧が ${ranked.length} 社しか取れませんでした（${TOP} 社に足りない）。書き出しません。`);
  process.exit(1);
}

console.log(`\n━━ 会社ページの閲覧（直近${DAYS}日・日英の合計・ボット除く）━━`);
ranked.slice(0, 12).forEach(([s, n], i) => console.log(`  ${String(i + 1).padStart(2)}. ${s.padEnd(22)} ${String(n).padStart(6)}${i < TOP ? '  ← Vote に出す' : ''}`));

const out = { asOf: iso(Date.now()), days: DAYS, slugs: ranked.slice(0, TOP).map(([s]) => s) };
const file = path.join(ROOT, 'vote-popular.json');
const next = JSON.stringify(out, null, 2) + '\n';
if (CHECK) {
  const prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  console.log(`\n--check：書いていません。いまのファイル: ${prev ? prev.slugs.join(', ') + `（${prev.asOf}）` : '無し'}`);
} else {
  writeFileSync(file, next);
  console.log(`\n✅ vote-popular.json を書きました（${out.asOf}・${out.slugs.join(', ')}）`);
}
