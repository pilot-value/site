// ぜんぶのチェックを1コマンドで走らせる。
//
// これまでは CLAUDE.md の「デプロイ前チェック」を上から手で叩いていた。
// 直列で約18分かかり、途中で1つ飛ばしても誰も気づかなかった。
// ここは既存の検査を1行も書き換えずに「まとめて・同時に」走らせるだけ。
//
//   node check.mjs            速いものだけ（静的＋SQL）
//   node check.mjs all        ぜんぶ（ブラウザ検査も含む）
//   node check.mjs web        ブラウザ検査だけ
//   node check.mjs fast       静的だけ（数秒）
//   node check.mjs sql        PGlite だけ
//   node check.mjs all -j 6   同時に走らせる本数を変える
//
// ⚠️ 絶対パスを書かない（このリポジトリは PUBLIC）。自分の位置から解く。

import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

// 秒数は 2026-08-27 に実測した値。長いものから先に流すため（LPT）だけに使う。
// ずれても結果は変わらない。並べ替えが少し鈍るだけ。
const FAST = [
  ['check-salary.mjs', 1.7], ['check-sources.mjs', 0.1],
  ['assert-seo.mjs', 0.1], ['assert-links.mjs', 0.1],
  ['assert-admin-notify.mjs', 0.1], ['assert-translate-review.mjs', 0.1],
  ['assert-jobs.mjs', 0.1], ['assert-no-pii.mjs', 1.0],
  ['assert-pay-report-sync.mjs', 0.1],
  ['db/test-aha.mjs', 1], ['db/test-announce.mjs', 1],
  ['db/test-payslip-hours.mjs', 1], ['db/test-payslip-parse.mjs', 1],
  ['db/test-value-breakdown.mjs', 1], ['db/test-value-total.mjs', 1],
];

const SQL = [
  ['db/test-pay-reports.mjs', 15], ['db/test-pay-rows.mjs', 15],
  ['db/test-conditions.mjs', 12], ['db/test-referrals.mjs', 10],
  ['db/test-founding.mjs', 10], ['db/test-admin-grants.mjs', 10],
  ['db/test-payslip-extras.mjs', 10], ['db/test-unlock-rule.mjs', 10],
  ['db/test-remind.mjs', 10],
];

// localhost:3000 が要るもの。長い順に並べてある（assert-header が全体の4割）。
const WEB = [
  ['assert-header.mjs', 383], ['assert-referral.mjs', 103],
  ['assert-perf.mjs', 91], ['assert-jp.mjs', 88],
  ['assert-currency.mjs', 87], ['assert-pay-rows.mjs', 73],
  ['assert-conditions.mjs', 62], ['db/test-form-contract.mjs', 60],
  ['db/test-payslip-redact.mjs', 40], ['assert-unlock.mjs', 29],
  ['assert-my-posts.mjs', 26], ['assert-founding.mjs', 22],
  ['db/test-pay-gate.mjs', 20], ['assert-admin.mjs', 13],
  ['assert-langtoggle.mjs', 12], ['db/test-session-expiry.mjs', 12],
  ['db/test-login-redirect.mjs', 10], ['assert-review-quality.mjs', 1.4],
];

// assert-salary-input.mjs は 2026-08-16 から休止中（走らせると全部落ちる）。
// 直すか消すかが決まるまで、ここには入れない。

const argv = process.argv.slice(2);
const tier = argv.find(a => !a.startsWith('-')) || 'quick';
const jFlag = argv.indexOf('-j');
const cpus = os.cpus().length;

function pick(t) {
  if (t === 'fast') return { list: FAST, web: false };
  if (t === 'sql') return { list: SQL, web: false };
  if (t === 'web') return { list: WEB, web: true };
  if (t === 'all') return { list: [...WEB, ...SQL, ...FAST], web: true };
  return { list: [...SQL, ...FAST], web: false }; // quick
}

const { list, web } = pick(tier);
if (!list.length) { console.error(`知らない区分: ${tier}`); process.exit(2); }

// ブラウザ検査は1本ごとに Chrome が1つ立つ。積みすぎると逆に遅くなる。
const defaultJobs = web ? Math.min(4, Math.max(2, cpus - 2)) : Math.min(8, Math.max(2, cpus - 1));
const JOBS = jFlag >= 0 ? Number(argv[jFlag + 1]) || defaultJobs : defaultJobs;

const portFree = () => new Promise(res => {
  const s = net.createConnection({ port: 3000, host: '127.0.0.1' });
  s.on('connect', () => { s.destroy(); res(false); });
  s.on('error', () => res(true));
});

let server = null;
if (web && await portFree()) {
  console.log('· localhost:3000 が空いていたので serve.mjs を起こす');
  server = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, stdio: 'ignore', detached: false });
  for (let i = 0; i < 40 && await portFree(); i++) await new Promise(r => setTimeout(r, 100));
}

const run = (file) => new Promise(res => {
  const t0 = Date.now();
  const p = spawn(process.execPath, [file], { cwd: ROOT });
  let out = '';
  p.stdout.on('data', d => { out += d; });
  p.stderr.on('data', d => { out += d; });
  p.on('close', code => res({ file, code, out, secs: (Date.now() - t0) / 1000 }));
  p.on('error', e => res({ file, code: 1, out: String(e), secs: 0 }));
});

const queue = [...list].sort((a, b) => b[1] - a[1]).map(x => x[0]);
const results = [];
const started = Date.now();
let running = 0, idx = 0;

console.log(`\n▸ ${tier}  ${queue.length}本 / 同時${JOBS}本${web ? '  (localhost:3000)' : ''}\n`);

await new Promise(done => {
  const next = () => {
    if (idx >= queue.length && running === 0) return done();
    while (running < JOBS && idx < queue.length) {
      const file = queue[idx++];
      running++;
      run(file).then(r => {
        results.push(r);
        const mark = r.code === 0 ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
        console.log(`${mark} ${r.file.padEnd(30)} ${r.secs.toFixed(1)}s   [${results.length}/${queue.length}]`);
        running--; next();
      });
    }
  };
  next();
});

if (server) server.kill();

const failed = results.filter(r => r.code !== 0);
const wall = (Date.now() - started) / 1000;
const serial = results.reduce((s, r) => s + r.secs, 0);

for (const f of failed) {
  console.log(`\n\x1b[31m──── ${f.file} ────\x1b[0m`);
  console.log(f.out.trimEnd().split('\n').slice(-40).join('\n'));
}

console.log(`\n${'─'.repeat(52)}`);
console.log(`${results.length - failed.length} 通過 / ${failed.length} 失敗`);
console.log(`実時間 ${wall.toFixed(1)}s（直列なら ${serial.toFixed(0)}s ＝ ${(serial / wall).toFixed(1)}倍速い）`);
if (failed.length) console.log(`\n\x1b[31m落ちた: ${failed.map(f => f.file).join(', ')}\x1b[0m`);
process.exit(failed.length ? 1 : 0);
