/* ══════════════════════════════════════════════════════════════
   assert-jobs.mjs — 載せている求人が、まだその求人かを検査する

   なぜ要るか
     求人はこちらが何もしなくても消える。掲載元（Latest Pilot Jobs）は
     募集が終わった求人を消し、URL の番号を**別の求人に付け替える**。
     実際 2026-08-15 の時点で、サイトに載っている9本の求人リンクは
     全部おかしくなっていた —
       ・6本 … 押すと /jobs/warning（この求人はもうありません）へ飛ぶ
       ・3本 … 開くが中身が別の求人（「機長 Gulfstream G600」と書いた
               ボタンの先が整備士の求人だった）
     「募集中」と書いてある物を押して、無い／違う求人が出るのは、
     年収の数字を間違えるのと同じだけ信用を削る。

   何を見るか
     静的（既定・ネット不要）
       1) 締切の日付が過ぎているのに「募集中」扱いのまま
       2) 求人一覧の「◯月◯日 更新」が古い（90日以上前）
     ネット（--online）
       3) リンク先が生きているか（/jobs/warning へ飛ばされていないか）
       4) 相手ページの見出しを取ってきて、こちらのカードの見出しと
          並べて出す。機械に是非は決められないので**人が見比べる**ための表。

   使い方
     node assert-jobs.mjs            静的だけ
     node assert-jobs.mjs --online   実際に叩く（9本で10秒ほど）
   ══════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const ONLINE = process.argv.includes('--online');
const STALE_DAYS = 90;
const UA = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36' };

/* 今日。テストしやすいよう上書きできる（node assert-jobs.mjs --today=2026-08-15） */
const todayArg = process.argv.find((a) => a.startsWith('--today='));
const TODAY = todayArg ? new Date(todayArg.slice(8)) : new Date();

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'temporary screenshots') continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (e.name.endsWith('.html')) out.push(f);
  }
  return out;
}

const files = walk(ROOT).map((f) => ({ rel: path.relative(ROOT, f), html: fs.readFileSync(f, 'utf8') }));

let bad = 0, warn = 0;
const fail = (m) => { console.log(`  ❌ ${m}`); bad++; };
const soft = (m) => { console.log(`  ⚠️ ${m}`); warn++; };

const MONTH = 'january february march april may june july august september october november december'.split(' ');
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/* ── 1) 締切が過ぎているのに募集中のまま ──
   日英で4通りの書き方がある。英語版を見落とすと、日本語だけ直して
   英語のカードが「募集中」のまま残る（実際そうなりかけた）。
     world-jobs.html      掲載：2026.03.24 ／ 締切：2026.04.08
     en/world-jobs.html   Posted: 2026.03.24 / Closes: 2026.04.08
     航空会社ページ        締切：2026年3月25日（要最新確認）
     en/航空会社ページ     Deadline: March 25, 2026 (confirm latest)
   JSON-LD の validThrough も見る。過ぎた JobPosting を出したままだと
   Search Console に「期限切れの求人」として警告が出る。 */
console.log('\n── 締切が過ぎた求人 ──');
const DL = [
  [/(?:締切|Closes|Deadline)[：:]\s*(\d{4})\.(\d{1,2})\.(\d{1,2})/gi, (m) => iso(m[1], m[2], m[3])],
  [/締切[：:]\s*(\d{4})年(\d{1,2})月(\d{1,2})日/g, (m) => iso(m[1], m[2], m[3])],
  [/(?:Closes|Deadline)[：:]\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/g,
    (m) => (MONTH.indexOf(m[1].toLowerCase()) < 0 ? null : iso(m[3], MONTH.indexOf(m[1].toLowerCase()) + 1, m[2]))],
  [/validThrough"?\s*:\s*"(\d{4})-(\d{2})-(\d{2})"/g, (m) => iso(m[1], m[2], m[3])],
];
let dlSeen = 0;
for (const f of files) {
  const past = new Set();
  for (const [re, fmt] of DL) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(f.html))) {
      const s = fmt(m);
      if (!s) continue;
      dlSeen++;
      if (new Date(s) < TODAY) past.add(s);
    }
  }
  if (!past.size) continue;
  /* 既に全部「掲載終了」に落としてあるページは対象外 */
  const allExpired = /data-status="expired"/.test(f.html) && !/data-status="active"/.test(f.html);
  if (allExpired) continue;
  fail(`${f.rel} — 締切が過ぎた求人が ${past.size} 件あるのに募集中のまま（${[...past].sort().join(' / ')}）`);
}
if (!bad) console.log(`  締切の記載 ${dlSeen} 件、過ぎているものは無い`);

/* ── 2) 一覧の「更新」が古い ── */
console.log('\n── 求人一覧の更新日 ──');
let updSeen = 0;
for (const f of files) {
  const m = f.html.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s*更新/)
    || f.html.match(/Updated\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) continue;
  updSeen++;
  const d = /^\d{4}$/.test(m[1])
    ? new Date(+m[1], +m[2] - 1, +m[3])
    : new Date(+m[3], MONTH.indexOf(m[1].toLowerCase()), +m[2]);
  const days = Math.round((TODAY - d) / 86400000);
  if (days > STALE_DAYS) fail(`${f.rel} — 「${m[0]}」から ${days} 日経っている（${STALE_DAYS} 日以内に見直す）`);
  else console.log(`  ${f.rel} — ${m[0]}（${days} 日前）`);
}
if (!updSeen) console.log('  更新日の記載は無い');

/* ── 3〜4) リンク先が生きているか ── */
const LINK = /https:\/\/www\.latestpilotjobs\.com\/jobs\/view\/id\/(\d+)\.html/g;
const byId = new Map();
for (const f of files) {
  LINK.lastIndex = 0;
  let m;
  while ((m = LINK.exec(f.html))) {
    if (!byId.has(m[1])) byId.set(m[1], new Set());
    byId.get(m[1]).add(f.rel);
  }
}
console.log(`\n── 外部の求人リンク（${byId.size} 本 / 延べ ${[...byId.values()].reduce((a, b) => a + b.size, 0)} 箇所）──`);

if (!ONLINE) {
  console.log('  --online を付けると実際に叩いて生死を見る');
} else {
  for (const [id, where] of [...byId].sort((a, b) => +a[0] - +b[0])) {
    const u = `https://www.latestpilotjobs.com/jobs/view/id/${id}.html`;
    let status = 0, finalUrl = '', title = '', err = '';
    try {
      const r = await fetch(u, { redirect: 'follow', headers: UA });
      status = r.status; finalUrl = r.url;
      title = ((await r.text()).match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1]
        .replace(/-Latest Pilot Jobs/g, '').replace(/\s+/g, ' ').trim();
    } catch (e) { err = e.code || e.message; }
    const files1 = [...where].join(', ');
    if (err) { soft(`${id} — 繋がらない（${err}）  ${files1}`); continue; }
    if (/\/jobs\/warning/.test(finalUrl) || status >= 400) {
      fail(`${id} — 求人が消えている（押すと「この求人はありません」）  ${files1}`);
    } else {
      console.log(`  ✓ ${id} 生きている  掲載元の見出し「${title}」`);
      console.log(`      載せている所: ${files1}`);
      console.log('      ↑ こちらのカードの見出しと同じ求人か、目で見比べる');
    }
  }
}

console.log(`\n══ ❌ ${bad} 件 / ⚠️ ${warn} 件 ══\n`);
if (bad) process.exitCode = 1;
