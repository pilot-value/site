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
  ['assert-generated.mjs', 0.8],
  ['db/test-aha.mjs', 1], ['db/test-announce.mjs', 1],
  ['db/test-payslip-hours.mjs', 1], ['db/test-payslip-parse.mjs', 1],
  ['db/test-value-breakdown.mjs', 1], ['db/test-value-total.mjs', 1],
];

const SQL = [
  ['db/test-pay-reports.mjs', 15], ['db/test-pay-rows.mjs', 15],
  ['db/test-conditions.mjs', 12], ['db/test-referrals.mjs', 10],
  ['db/test-founding.mjs', 10], ['db/test-admin-grants.mjs', 10],
  ['db/test-payslip-extras.mjs', 10], ['db/test-unlock-rule.mjs', 10],
  ['db/test-remind.mjs', 10], ['db/test-deep-pay.mjs', 2],
];

// localhost:3000 が要るもの。長い順に並べてある。
//
// ⚠️ ここの秒数は **同時4本で回したときの実測**（2026-08-28 に測り直した）。
//    単独で走らせた秒数とは違う。ここが実物とずれると LPT が効かなくなる：
//    2026-08-27 版は db/test-payslip-redact.mjs を 40 と書いていたが実測は 204 で、
//    いちばん重いものが9番目に流れていた（＝終盤に1本だけ残って待つ形）。
//    測り直したら、この表もその場で直す。
//
// 2026-08-28: assert-header.mjs を内部で並列化して 383 → 217 になった
//             （単独なら 98秒。ここでは下の INNER_ENV で2本に絞っているので 217秒）。
//             db/test-payslip-redact.mjs は同じ日から下の SOLO で外に出したので、
//             ここの 258 は並べ替えには効かない（一覧に載せるためだけに残してある）。
//             ＝ プールの中でいちばん長いのは assert-header.mjs。
const WEB = [
  ['db/test-payslip-redact.mjs', 258], ['assert-header.mjs', 217],
  ['assert-jp.mjs', 143], ['assert-referral.mjs', 120],
  ['assert-perf.mjs', 94], ['assert-currency.mjs', 85],
  ['assert-pay-rows.mjs', 73], ['assert-conditions.mjs', 62],
  ['db/test-form-contract.mjs', 52], ['db/test-pay-gate.mjs', 35],
  ['assert-unlock.mjs', 29], ['assert-my-posts.mjs', 26],
  ['assert-founding.mjs', 21], ['assert-admin.mjs', 13],
  ['assert-langtoggle.mjs', 12], ['db/test-login-redirect.mjs', 3],
  ['assert-review-quality.mjs', 1.5], ['db/test-session-expiry.mjs', 0.9],
];

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

// assert-header.mjs は中で自分もタブを並べる（単独なら4本・380秒→98秒）。
// ここから呼ぶときだけ2本に落とす。速さのためではなく、**隣を飢えさせないため**。
//
// 2026-08-28 の実測（8コア・web 全体）──
//   変更前（中1本）406秒 ／ 中2本 317〜332秒 ／ 中4本 315秒
//   下限は「仕事の合計 1245秒 ÷ 同時4本 ＝ 311秒」で、2本の時点でほぼ着いている。
//   4本まで上げても速くならず、db/test-payslip-redact.mjs が**確実に7件落ちる**だけ。
//
// この2本は、いちばん壊れやすかった db/test-payslip-redact.mjs を
// 下の SOLO で外に出したうえでの値。隣を飢えさせる余地はもう小さいが、
// 上げても下限（311秒）に着いているだけなので 2本のままにしてある。
//
// 外から PV_HEADER_JOBS を指定していればそちらを優先する。
const INNER_ENV = { PV_HEADER_JOBS: process.env.PV_HEADER_JOBS || '2' };

const run = (file) => new Promise(res => {
  const t0 = Date.now();
  const p = spawn(process.execPath, [file], { cwd: ROOT, env: { ...process.env, ...INNER_ENV } });
  let out = '';
  p.stdout.on('data', d => { out += d; });
  p.stderr.on('data', d => { out += d; });
  p.on('close', code => res({ file, code, out, secs: (Date.now() - t0) / 1000 }));
  p.on('error', e => res({ file, code: 1, out: String(e), secs: 0 }));
});

// ★ここに書いた検査は、他と一緒に流さない。先に1本だけで流す。
//
// db/test-payslip-redact.mjs は明細の画像から文字を読み取って黒塗りを置く検査で、
// 読み取りに**40秒の制限**がある（payslip.js の OCR_MS）。CPU を他に奪われると
// 一度も動けないまま時間切れになり、`語 0／行 0／0ms` ＝ 黒塗り0枚 ＝ 失敗になる。
// **製品は正しいのに検査だけが赤くなる**ので、本物の赤と見分けがつかない。
// そのファイル自身の冒頭（db/test-payslip-redact.mjs:17-24）が「単独で走らせる」と宣言している。
//
// 2026-08-28 の実測（8コア）── 一緒に流すと同時4本でも3本でも落ちた。
// 同時1本（＝並列化する前とまったく同じ負荷）でも落ちたので、**前からある性質**で、
// これまで通っていたのは運。web 全体は 320秒 → 約450秒に伸びるが、
// 「赤ければ本当に壊れている」を取り戻すほうが安い。
//
// ⚠️ ここに足すと、その1本の間ほぼ全コアが遊ぶ。**本当に単独が要るものだけ**にする。
const SOLO = new Set(['db/test-payslip-redact.mjs']);

const ordered = [...list].sort((a, b) => b[1] - a[1]).map(x => x[0]);
const solo = ordered.filter(f => SOLO.has(f));
const queue = ordered.filter(f => !SOLO.has(f));
const total = solo.length + queue.length;
const results = [];
const started = Date.now();
let running = 0, idx = 0;

const tick = (r) => {
  const mark = r.code === 0 ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`${mark} ${r.file.padEnd(30)} ${r.secs.toFixed(1)}s   [${results.length}/${total}]`);
};

console.log(`\n▸ ${tier}  ${total}本 / 同時${JOBS}本${web ? '  (localhost:3000)' : ''}`);
if (solo.length) console.log(`  ※ ${solo.join(' / ')} は先に単独で流す（理由はソースの SOLO）`);
console.log('');

for (const file of solo) {
  const r = await run(file);
  results.push(r);
  tick(r);
}

await new Promise(done => {
  const next = () => {
    if (idx >= queue.length && running === 0) return done();
    while (running < JOBS && idx < queue.length) {
      const file = queue[idx++];
      running++;
      run(file).then(r => {
        results.push(r);
        tick(r);
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

// 落ちたときに、いちばんありがちな「検査の中身ではない原因」を1行だけ添える。
// 疑うべき先が製品ではなく走らせ方だと分かるまでに時間を溶かすのを防ぐため。
const HINTS = {
  'db/test-payslip-redact.mjs':
    '★ 2026-08-28 から、これは単独で流している（上の SOLO）。'
    + 'つまり CPU の食い合いではなく**本物の赤**の可能性が高い。'
    + 'それでも `語 0／行 0／0ms` と出ていたら、裏で重い別プロセスが動いていないか見る',
};

for (const f of failed) {
  console.log(`\n\x1b[31m──── ${f.file} ────\x1b[0m`);
  if (HINTS[f.file]) console.log(`\x1b[33m${HINTS[f.file]}\x1b[0m`);
  const lines = f.out.trimEnd().split('\n');
  // ★落ちた行そのものを先に出す。末尾40行だけでは足りない：
  //   2026-08-28、244件のうち1件が落ちたのに末尾40行は ✅ ばかりで、
  //   何が落ちたのか分からず単独で流し直す羽目になった。
  //   印は検査ごとにばらばら（db/* は ❌、assert-* は ✗ FAIL）なので両方拾う。
  const bad = lines.filter(l => l.includes('❌') || l.includes('✗'));
  if (bad.length) {
    console.log(`\x1b[31m落ちた行 ${bad.length}本:\x1b[0m`);
    console.log(bad.slice(0, 12).join('\n'));
    if (bad.length > 12) console.log(`  …ほか ${bad.length - 12}本`);
    console.log('\x1b[2m── 以下は末尾40行 ──\x1b[0m');
  }
  console.log(lines.slice(-40).join('\n'));
}

console.log(`\n${'─'.repeat(52)}`);
console.log(`${results.length - failed.length} 通過 / ${failed.length} 失敗`);
console.log(`実時間 ${wall.toFixed(1)}s（直列なら ${serial.toFixed(0)}s ＝ ${(serial / wall).toFixed(1)}倍速い）`);
if (failed.length) console.log(`\n\x1b[31m落ちた: ${failed.map(f => f.file).join(', ')}\x1b[0m`);
process.exit(failed.length ? 1 : 0);
