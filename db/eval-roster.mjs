/* ════════════════════════════════════════════════════════════════
   eval-roster.mjs — 勤務表（ロスター）の読み取りが「どのくらい外すか」を数字で出す（2026-11-09）

   なぜ要るか:
     db/test-roster-parse.mjs は整形（sanitize）と日付の決め方を偽の答えで測る＝ API を叩かない。
     **モデルが画像から本当に正しく読むか**は、それでは1つも分からない。
     ここは正解が全部分かっている架空の勤務表を手元で絵にして、本物の頼み方（buildRequest / systemPrompt）で
     読ませ、本物の readReply → sanitize（＋前の画像の続き・会員が選んだ月）を通した答えを1欄ずつ突き合わせる。
     Edge Function は経由しない＝本番の回数を1つも消費しない（db/eval-payslip.mjs と同じ作り）。

   架空の様式（6つ・数字も名前も全部作り話）:
     ecrew     eCrew/Sabre 風の表（日付・記号・D-ON・便・区間・STD/STA・BLK・D-OFF・乗員の欄）
     lido      LIDO 風の一覧（UTC・ICAO 4字・行に「02.09.」）
     mobile    スマホのアプリ（1日1枚のカード・DH の札・+1）
     calendar  月のカレンダー（マスの中に OFF/VAC と便。前後の月の灰色のマス）
     jp        日本の勤務表（公休・有休・待機・訓練・便乗・翌・辞書に無い漢字・同乗者の氏名）
     split     長い勤務表を3枚のスクリーンショットに（2日の重なり・1日が画像をまたいで切れる・途中で切れた行）
   どれにも、答えに出てはいけない乗員の名前・社員番号・ホテル名を印字してある。

   出す数字:
     ★黙って外した数（silent）＝ 値が違うのに、その日にも区間にも切れの印（cut / partial）が無いもの。
       画面が何も言わずに保存してしまう誤り。**この数字だけが本当の指標。**
     空（miss）＝ 見えている欄が null。聞き直せば済む（作り話ではない）。
     日付なし（undated）・捨てた日／区間／欄（dropped）＝ sanitize が落とした数（checks のまま）。
     ctx ＝ この画像では見えない欄に値が入っていた（前の画像の続きから写した）。
     漏れ ＝ 印字した名前・番号が答え（sanitize の後）のどこかに出た。**0 でなければならない。**
       raw は sanitize の前（モデルの生の答え）。参考に出すだけ（sanitize が落とせば実害は無い）。
     merge ＝ split の3枚を pv-report-engine.js の PVReport.mergePages で1つにした結果
       （同じ日が1回・区間が2重にならない・切れた日が埋まる）。エンジンが無ければ skipped と出す。

   使い方:
     node db/eval-roster.mjs --dry                 絵を作って計画を見るだけ（費用ゼロ）。絵の置き場を出す
     node db/eval-roster.mjs                       6様式ぜんぶ（8枚・≒$0.3〜0.6）
     node db/eval-roster.mjs --only jp,split       様式をしぼる（カンマ区切り）
     node db/eval-roster.mjs --dir <フォルダ>      公開されている見本の画像を読む（リポジトリの外のフォルダだけ）
         画像 png/jpg/webp。名前が「…-p1.png」「…-p2.png」なら1つの勤務表の続き（前の画像の続きを渡す）。
         「<名前>.answer.json」があれば採点する（部分の答え。書いてある欄だけ採点）:
           { "hint": {"year":2024,"month":5}|null, "complete": false, "pii_tokens": ["…"],
             "days": [{ "date":"YYYY-MM-DD", "code":…, "d_on":…, "d_off":…, "legs":[{flight,from,to,out,in,block,kind}],
                        "legs_complete": false }] }
     --budget <ドル>     超えそうなら次の1回を送らずに止める（既定 3.00）
     --ledger <ファイル> 使った費用を足し込んでいく帳面（回をまたいで上限を守る）
     --save <ファイル>   モデルの生の答えを保存（★リポジトリの外だけ）。--rescore <ファイル> で費用ゼロの採点し直し
                         （sanitize を直したあと、同じ答えで測り直すため）
     --out <フォルダ>    作った絵を置く場所（既定は一時フォルダ・リポジトリの外だけ）
     --env <ファイル>    鍵を読む .env（既定 mail-bot/.env。worktree から流すときは本体の mail-bot/.env を指す）
   費用は返事のトークン数から数える（入力 $2・出力 $10 ／ 100万トークン）。

   要るもの: mail-bot/.env の ANTHROPIC_API_KEY（gitignore 済み・開発用）
   ⚠️ API を実際に叩いて課金される。**デプロイ前チェックの一覧には入れない。**
   ⚠️ --dir の画像から読んだものは、リポジトリに1つも書かない（画面に出すだけ）。
   ════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';
import vm from 'vm';
import { readFileSync, existsSync, writeFileSync, mkdtempSync, mkdirSync, readdirSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const DRY = argv.includes('--dry');
const ONLY = (opt('--only', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const SAMPLES = opt('--dir', null);
const BUDGET = Number(opt('--budget', '3'));
const LEDGER = opt('--ledger', null);
const SAVE = opt('--save', null);
const RESCORE = opt('--rescore', null);
const PRICE = { in: 2 / 1e6, out: 10 / 1e6 };
const NEXT_MAX = 0.2;          // 1回で使いうる上限の見積もり（画像≒5千＋答え 16000 でも $0.18）
const MAX_EDGE = 2560;         // 送る画像の長辺（payslip.js の MAX_EDGE と同じ）
const NOW = new Date();

/* ★リポジトリの中へは書かない（--dir の答え・生の答え・絵）。 */
const inRepo = (p) => { const r = path.relative(ROOT, path.resolve(p)); return !r.startsWith('..') && !path.isAbsolute(r); };
for (const [k, p] of [['--save', SAVE], ['--out', opt('--out', null)], ['--ledger', LEDGER]]) {
  if (p && inRepo(p)) { console.error(`❌ ${k} はリポジトリの外を指定してください（公開リポジトリ）`); process.exit(1); }
}
if (SAMPLES && inRepo(SAMPLES)) { console.error('❌ --dir はリポジトリの外のフォルダだけ（見本の画像をリポジトリに入れない）'); process.exit(1); }

/* ── 本体をそのまま読み込む（写経した複製を測らない）── */
globalThis.Deno = { env: { get: (k) => process.env[k] ?? '' }, serve: () => {} };
const RD = await import('../supabase/functions/parse-roster/index.ts');
const { sanitize, sanitizeTail, buildRequest, readReply, dayCodeOf, parseClock, parseBlock, flightOf, tok, RE } = RD;

/* ── エンジン（分割スクショをまとめる）。db/test-year-report.mjs と同じ読み方 ── */
function loadEngine() {
  const f = path.join(ROOT, 'pv-report-engine.js');
  if (!existsSync(f)) return null;
  const win = { document: { documentElement: { getAttribute: () => 'ja' }, addEventListener() {} }, addEventListener() {} };
  win.window = win;
  const ctx = vm.createContext(win);
  try {
    const viz = path.join(ROOT, 'pay-viz.js');
    if (existsSync(viz)) vm.runInContext(readFileSync(viz, 'utf8'), ctx);
    vm.runInContext(readFileSync(f, 'utf8'), ctx);
  } catch { return null; }
  return win.PVReport && typeof win.PVReport.mergePages === 'function' ? win.PVReport : null;
}
const ENGINE = loadEngine();

/* ── 鍵（eval-payslip.mjs と同じ読み方。値は表示しない）── */
const needKey = !DRY && !RESCORE;
if (needKey) {
  /* 作業用の別の作業場（worktree）には .env が無いので、--env で本体の mail-bot/.env を指せる */
  const envPath = opt('--env', path.join(ROOT, 'mail-bot/.env'));
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const s = line.trim();
      if (!s || s.startsWith('#')) continue;
      const [k, ...v] = s.split('=');
      if (k && v.length) process.env[k.trim()] = v.join('=').trim();
    }
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY がありません。mail-bot/.env に開発用のキーを1行足してください（gitignore 済み）。');
    process.exit(1);
  }
}

/* ── 費用の帳面 ── */
let spent = 0, inflight = 0;
if (LEDGER && existsSync(LEDGER)) spent = Number(JSON.parse(readFileSync(LEDGER, 'utf8')).usd) || 0;
const startSpent = spent;
const charge = (u) => {
  const usd = (u?.input_tokens || 0) * PRICE.in + (u?.output_tokens || 0) * PRICE.out;
  spent += usd;
  if (LEDGER) writeFileSync(LEDGER, JSON.stringify({ usd: Math.round(spent * 1e6) / 1e6, at: new Date().toISOString() }));
  return usd;
};
const SAVED = RESCORE ? JSON.parse(readFileSync(RESCORE, 'utf8')) : {};
const toSave = {};

/* ═══ 小道具 ═══════════════════════════════════════════════════ */
const pad2 = (n) => String(n).padStart(2, '0');
const WD3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD2 = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WDJ = ['日', '月', '火', '水', '木', '金', '土'];
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const wdOf = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();
const dOf = (iso) => Number(iso.slice(8, 10));
const mOf = (iso) => Number(iso.slice(5, 7));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const accOf = (w) => (Array.isArray(w) ? w : [w]);
const first = (w) => accOf(w)[0];
/* 印字する1つの値。data-pv が「どの日・どの区間・どの欄か」（画像のどこに見えているかを測る札）。 */
const T = (key, text) => `<span data-pv="${key}">${esc(text)}</span>`;
const compact = (t) => t.replace(':', () => '');
const blk0 = (b) => (b.length === 4 ? '0' + b : b);          // '2:15' → '02:15'

/* 正解の形（sanitize の答えと同じ形・正規化した値）。配列はどれでも正解。 */
const leg = (flight, from, to, out, inn, block, o = {}) =>
  ({ flight, from, to, loc: null, out, in: inn, in_day: 0, block, role: null, kind: 'operating', ...o });
const gnd = (loc, out, inn, o = {}) =>
  ({ flight: null, from: null, to: null, loc, out, in: inn, in_day: 0, block: null, role: null, kind: 'ground', ...o });
const day = (date, code, d_on = null, d_off = null, legs = [], o = {}) =>
  ({ date, code, d_on, d_off, d_off_day: 0, legs, ...o });

/* ═══ 1. eCrew / Sabre 風の表（現地時刻・3字コード）═══════════════ */
const ECREW = {
  id: 'ecrew', note: 'eCrew/Sabre 風の表（現地・IATA）',
  hint: { year: 2026, month: 10 }, width: 1180, dpr: 1,
  hdr: { period: '2026-10-01..2026-10-31', kind: ['planned', null], time_ref: 'local' },
  names: ['QUILLFEATHER', 'ROBIN', '730514', 'THISTLEWOOD', 'BRAMBLECOTE', 'MARROWDALE', '731822', '744190', 'AURORA'],
  days: [
    day('2026-10-01', 'OFF'),
    day('2026-10-02', 'P4417', '05:50', '12:30', [
      leg('ZK1301', 'BCN', 'LHR', '06:40', '07:55', '2:15', { role: 'CPT' }),
      leg('ZK1302', 'LHR', 'BCN', '08:50', '12:00', '2:10', { role: 'CPT' })]),
    day('2026-10-03', 'SBY', '05:00', '17:00'),
    day('2026-10-04', 'P4420', '14:20', '20:20', [
      leg('ZK1455', 'BCN', 'FCO', '15:10', '17:00', '1:50', { role: 'CPT' }),
      leg('ZK1456', 'FCO', 'BCN', '17:55', '19:50', '1:55', { role: 'CPT' })]),
    day('2026-10-05', 'TRN', '08:30', '17:30', [gnd('TRC1', '09:00', '17:00')]),
    day('2026-10-06', 'P4431', '19:45', '01:25', [
      leg('ZK1210', 'BCN', 'MAD', '20:30', '21:45', '1:15', { role: 'DH', kind: 'deadhead' }),
      leg('ZK1788', 'MAD', 'LPA', '22:50', '00:55', '3:05', { role: 'CPT', in_day: 1 })], { d_off_day: 1 }),
    day('2026-10-07', null, '12:40', '20:30', [
      leg('ZK1789', 'LPA', 'MAD', '13:40', '17:35', '2:55', { role: 'CPT' }),
      leg('ZK1219', 'MAD', 'BCN', '18:45', '20:00', '1:15', { role: 'DH', kind: 'deadhead' })]),
    day('2026-10-08', 'OFF'),
    day('2026-10-09', 'VAC'),
    day('2026-10-10', 'VAC'),
    day('2026-10-11', 'P4450', '06:10', '18:25', [
      leg('ZK1101', 'BCN', 'CDG', '07:00', '08:55', '1:55', { role: 'CPT' }),
      leg('ZK1102', 'CDG', 'BCN', '09:45', '11:35', '1:50', { role: 'CPT' }),
      leg('ZK1309', 'BCN', 'LHR', '12:40', '13:55', '2:15', { role: 'CPT' }),
      leg('ZK1310', 'LHR', 'BCN', '14:50', '17:55', '2:05', { role: 'CPT' })]),
    day('2026-10-12', 'OFF'),
  ],
  crew: { '2026-10-02': 'CP THISTLEWOOD K 731822 / FO BRAMBLECOTE S 744190', '2026-10-04': 'CP MARROWDALE J / FO BRAMBLECOTE S',
          '2026-10-06': 'CP THISTLEWOOD K / FO MARROWDALE J', '2026-10-11': 'CP THISTLEWOOD K 731822 / FO BRAMBLECOTE S 744190' },
  html(L) {
    const rows = [];
    for (const d of L.days) {
      const legs = d.legs.length ? d.legs : [null];
      legs.forEach((l, i) => {
        const k = d.date, lk = `${d.date}|L${i + 1}`, last = i === legs.length - 1;
        const g = l && l.kind === 'ground';
        rows.push(`<tr class="${i === 0 ? 'f' : ''}">
          <td>${i === 0 ? T(k + '|date', `${WD3[wdOf(k)]} ${pad2(dOf(k))}`) : ''}</td>
          <td class="c">${i === 0 && d.code ? T(k + '|code', d.pc || d.code) : ''}</td>
          <td>${i === 0 && d.d_on ? T(k + '|d_on', d.d_on) : ''}</td>
          <td>${l && first(l.role) ? T(lk + '|role', first(l.role)) : ''}</td>
          <td>${l && l.flight ? T(lk + '|flight', l.flight.replace(/^([A-Z]{2})/, (m) => m + ' ')) : ''}</td>
          <td>${l ? (g ? T(lk + '|loc', l.loc) : T(lk + '|from', l.from)) : ''}</td>
          <td>${l && !g ? T(lk + '|to', l.to) : ''}</td>
          <td>${l ? T(lk + '|out', l.out) : ''}</td>
          <td>${l ? T(lk + '|in', l.in + (l.in_day ? '+1' : '')) : ''}</td>
          <td>${l && l.block ? T(lk + '|block', blk0(l.block)) : ''}</td>
          <td>${last && d.d_off ? T(k + '|d_off', d.d_off + (d.d_off_day ? '+1' : '')) : ''}</td>
          <td class="crew">${i === 0 && L.crew[k] ? esc(L.crew[k]) : ''}</td></tr>`);
      });
    }
    return `<style>body{font:13px/1.35 Arial,Helvetica,sans-serif;margin:0;padding:18px 22px;color:#1b1b1b;background:#fff}
      h1{font-size:17px;margin:0 0 4px}.meta{color:#333;margin:2px 0}.bar{background:#0b3d6e;color:#fff;padding:6px 10px;margin:10px 0 0;font-weight:bold}
      table{border-collapse:collapse;width:100%}th{background:#dfe7f1;text-align:left;padding:4px 6px;border:1px solid #9fb0c6;font-size:12px}
      td{padding:3px 6px;border-left:1px solid #c9d3e0;border-right:1px solid #c9d3e0;white-space:nowrap}tr.f td{border-top:1px solid #9fb0c6}
      td.c{font-weight:bold}td.crew{font-size:11px;color:#444}.tot td{border-top:2px solid #333;font-weight:bold}
      .rem{margin-top:12px;font-size:12px;color:#333;border:1px dashed #999;padding:6px 8px}</style>
      <h1>Sample Airways — Individual Crew Roster</h1>
      <div class="meta">Crew member: QUILLFEATHER, Robin (CPT) &nbsp;·&nbsp; Staff No 730514 &nbsp;·&nbsp; Base BCN</div>
      <div class="meta">Period: 01Oct2026 - 31Oct2026 &nbsp;·&nbsp; Status: PUBLISHED &nbsp;·&nbsp; All times local (LT)</div>
      <div class="bar">Roster details</div>
      <table><thead><tr><th>Date</th><th>Duty</th><th>D-ON</th><th>Pos</th><th>Flight</th><th>From</th><th>To</th><th>STD</th><th>STA</th><th>Block</th><th>D-OFF</th><th>Crew</th></tr></thead>
      <tbody>${rows.join('')}<tr class="tot"><td colspan="9">Totals 01Oct–12Oct</td><td>30:05</td><td colspan="2">Duty 61:40</td></tr></tbody></table>
      <div class="rem">Remarks: 06Oct Hotel Aurora Gran Canaria, transport 01:45 &nbsp;·&nbsp; Crew Control 24h: ext. 4412 &nbsp;·&nbsp; Please confirm your passport is valid.</div>`;
  },
};

/* ═══ 2. LIDO 風の一覧（UTC・ICAO・行に日と月）═══════════════════ */
const LIDO = {
  id: 'lido', note: 'LIDO 風の一覧（UTC・ICAO）',
  hint: { year: 2026, month: 9 }, width: 1120, dpr: 1,
  hdr: { period: null, kind: 'actual', time_ref: 'utc' },
  names: ['QUILLFEATHER', 'ROBIN', '0815327', 'MARROWDALE', 'ASHGROVE', 'BRAMBLECOTE', 'LAUREL', 'AURORA'],
  days: [
    day('2026-09-01', 'OFF'),
    day('2026-09-02', 'FLT', '05:10', '15:05', [leg('LH0400', 'EDDF', 'KJFK', '06:10', '14:35', '8:25', { role: 'CP' })]),
    day('2026-09-03', 'OFF', null, null, [], { pc: 'REST' }),        // 語の辞書で OFF
    day('2026-09-04', 'FLT', '20:45', '06:35', [leg('LH0401', 'KJFK', 'EDDF', '22:15', '06:05', '7:50', { role: 'CP', in_day: 1 })], { d_off_day: 1 }),
    day('2026-09-05', 'OFF'),
    day('2026-09-06', 'OFF'),
    day('2026-09-07', 'TRN', '08:30', '13:30', [gnd('EDDF', '09:00', '13:00')], { pc: 'SIM' }),
    day('2026-09-08', 'FLT', '06:00', '15:35', [
      leg('LH0094', 'EDDF', 'EDDM', '06:45', '07:40', '0:55', { role: 'DH', kind: 'deadhead' }),
      leg('LH1700', 'EDDM', 'LEMD', '09:00', '11:30', '2:30', { role: 'CP' }),
      leg('LH1801', 'LEMD', 'EDDM', '12:30', '15:05', '2:35', { role: 'CP' })]),
    day('2026-09-09', 'RES', '04:00', '16:00'),
    day('2026-09-10', 'VAC'),
  ],
  html(L) {
    const rows = [];
    for (const d of L.days) {
      const legs = d.legs.length ? d.legs : [null];
      legs.forEach((l, i) => {
        const k = d.date, lk = `${d.date}|L${i + 1}`, last = i === legs.length - 1;
        const g = l && l.kind === 'ground';
        rows.push(`<tr${i === 0 ? ' class="f"' : ''}>
          <td>${i === 0 ? T(k + '|date', `${WD2[wdOf(k)]} ${pad2(dOf(k))}.${pad2(mOf(k))}.`) : ''}</td>
          <td>${i === 0 && d.code ? T(k + '|code', d.pc || d.code) : ''}</td>
          <td>${i === 0 && d.d_on ? T(k + '|d_on', d.d_on) : ''}</td>
          <td>${l && first(l.role) ? T(lk + '|role', first(l.role)) : ''}</td>
          <td>${l && l.flight ? T(lk + '|flight', l.flight) : ''}</td>
          <td>${l ? (g ? T(lk + '|loc', l.loc) : T(lk + '|from', l.from)) : ''}</td>
          <td>${l && !g ? T(lk + '|to', l.to) : ''}</td>
          <td>${l ? T(lk + '|out', l.out) : ''}</td>
          <td>${l ? T(lk + '|in', l.in + (l.in_day ? ' +1' : '')) : ''}</td>
          <td>${l && l.block ? T(lk + '|block', l.block) : ''}</td>
          <td>${last && d.d_off ? T(k + '|d_off', d.d_off + (d.d_off_day ? ' +1' : '')) : ''}</td></tr>`);
      });
    }
    return `<style>body{font:13px/1.45 "Courier New",Courier,monospace;margin:0;padding:20px 24px;color:#111;background:#fbfbf7}
      .top{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:6px}h1{font:bold 16px Arial,sans-serif;margin:0}
      table{border-collapse:collapse;width:100%;margin-top:10px}th{text-align:left;border-bottom:1px solid #111;padding:3px 6px;font-weight:bold}
      td{padding:2px 6px;white-space:nowrap}tr.f td{border-top:1px dotted #888}tbody tr:nth-child(even) td{background:#f0f0ea}
      .foot{margin-top:14px;font-size:12px;border-top:1px solid #111;padding-top:6px}</style>
      <div class="top"><h1>PERSONAL DUTY PLAN</h1><div>Month: 09/2026 &nbsp; Printed 11.10.2026 07:12</div></div>
      <div>Crew member: QUILLFEATHER Robin &nbsp; PersNo: 0815327 &nbsp; Rank: CP &nbsp; Homebase: EDDF</div>
      <div><b>ACTUAL (flown) times &nbsp;—&nbsp; All times in UTC</b></div>
      <table><thead><tr><th>Date</th><th>Duty</th><th>C/I</th><th>Func</th><th>Flight</th><th>From</th><th>To</th><th>Dep</th><th>Arr</th><th>Blk</th><th>C/O</th></tr></thead>
      <tbody>${rows.join('')}</tbody></table>
      <div class="foot">Crew LH0400/LH0401: CP Quillfeather R., FO Marrowdale T., PU Ashgrove L., FA Laurel B.<br>
      Hotel KJFK: Hotel Aurora Jamaica, 02.09.–04.09. &nbsp;·&nbsp; Message: Bramblecote will contact you re. SIM slot.<br>Sum block: 22:15 &nbsp; Sum duty: 41:50</div>`;
  },
};

/* ═══ 3. スマホのアプリ（1日1枚・DH の札）════════════════════════ */
const MOBILE = {
  id: 'mobile', note: 'スマホのアプリ（1日1枚のカード）',
  hint: { year: 2026, month: 10 }, width: 390, dpr: 2,
  hdr: { period: null, kind: null, time_ref: 'local' },
  names: ['THISTLEWOOD', 'ROWAN', 'BRAMBLECOTE', 'INES', 'ASHGROVE', 'MARROWDALE', 'QUILLFEATHER'],
  days: [
    day('2026-10-15', null, '07:00', '15:45', [leg('EK0201', 'DXB', 'JFK', '08:30', '15:15', '14:45', { role: 'CPT' })]),
    day('2026-10-16', null, '21:25', '19:55', [leg('EK0202', 'JFK', 'DXB', '22:55', '19:25', '12:30', { role: 'CPT', in_day: 1 })], { d_off_day: 1 }),
    day('2026-10-18', 'OFF'),
    day('2026-10-19', 'SBY', '04:00', '16:00'),
    day('2026-10-20', null, '13:10', '21:15', [
      leg('EK0611', 'DXB', 'KHI', '14:40', '17:55', '2:15', { role: ['DH', null], kind: 'deadhead' }),
      leg('EK0612', 'KHI', 'DXB', '19:30', '20:45', '2:15', { role: 'CPT' })]),
    day('2026-10-21', 'TRN', '08:30', '13:30', [gnd('TC2', '09:00', '13:00')], { pc: 'SIM' }),
  ],
  crew: { '2026-10-15': 'Capt. Rowan Thistlewood · FO Ines Bramblecote · Purser Hal Ashgrove',
          '2026-10-20': 'Capt. Rowan Thistlewood · FO Dana Marrowdale' },
  html(L) {
    const card = (d) => {
      const k = d.date;
      const pc = d.pc || d.code;
      const badge = pc ? `<span class="badge">${T(k + '|code', pc)}</span>` : '';
      const rr = d.d_on || d.d_off ? `<div class="rr">Report ${d.d_on ? T(k + '|d_on', d.d_on) : '—'} &nbsp;·&nbsp; Release ${
        d.d_off ? T(k + '|d_off', d.d_off + (d.d_off_day ? '⁺¹' : '')) : '—'}</div>` : '';
      const legs = d.legs.map((l, i) => {
        const lk = `${k}|L${i + 1}`;
        if (l.kind === 'ground') {
          return `<div class="leg"><div class="ln1"><b>Simulator</b> · Training centre ${T(lk + '|loc', l.loc)}</div>
            <div class="ln2">${T(lk + '|out', l.out)} – ${T(lk + '|in', l.in)}</div></div>`;
        }
        const dh = l.kind === 'deadhead' ? `<span class="dh">${T(lk + '|role', 'DH')}</span>` : '';
        const role = l.kind !== 'deadhead' && first(l.role) ? `<span class="pos">${T(lk + '|role', first(l.role))}</span>` : '';
        return `<div class="leg"><div class="ln1">${dh}<b>${T(lk + '|flight', l.flight.replace(/^([A-Z]{2})/, (m) => m + ' '))}</b> ${role}</div>
          <div class="ln2"><span class="ap">${T(lk + '|from', l.from)}</span> ${T(lk + '|out', l.out)} → <span class="ap">${T(lk + '|to', l.to)}</span> ${
          T(lk + '|in', l.in + (l.in_day ? '⁺¹' : ''))}</div><div class="ln3">Block ${T(lk + '|block', l.block)}</div></div>`;
      }).join('');
      const crew = L.crew[k] ? `<div class="crew">👥 ${esc(L.crew[k])}</div>` : '';
      const off = pc === 'OFF' ? '<div class="sub">Day off</div>' : pc === 'SBY' ? '<div class="sub">Home standby</div>' : '';
      return `<div class="card"><div class="hd">${T(k + '|date', `${WD3[wdOf(k)]}, ${dOf(k)} ${MON3[mOf(k) - 1]}`)}${badge}</div>${off}${rr}${legs}${crew}</div>`;
    };
    return `<style>body{font:15px/1.35 -apple-system,"Helvetica Neue",Arial,sans-serif;margin:0;background:#eef1f5;color:#15202b}
      .app{padding:12px 12px 20px}.bar{display:flex;justify-content:space-between;align-items:center;padding:6px 4px 10px}
      .bar b{font-size:20px}.bar span{font-size:12px;color:#5b6b7c}
      .card{background:#fff;border-radius:14px;padding:10px 12px;margin:0 0 10px;box-shadow:0 1px 2px rgba(20,30,50,.12)}
      .hd{display:flex;justify-content:space-between;font-weight:700;font-size:16px;margin-bottom:4px}
      .badge{background:#1f6feb;color:#fff;border-radius:8px;padding:1px 8px;font-size:13px}
      .sub{color:#5b6b7c;font-size:13px}.rr{color:#38495a;font-size:13px;margin:2px 0 4px}
      .leg{border-top:1px solid #e5e9ef;padding:5px 0}.ln2{font-size:15px}.ln3{font-size:12px;color:#5b6b7c}.ap{font-weight:700}
      .dh{background:#f2a516;color:#fff;border-radius:6px;padding:0 6px;font-size:12px;margin-right:6px}
      .pos{color:#5b6b7c;font-size:12px;border:1px solid #c7d0db;border-radius:6px;padding:0 5px}
      .crew{font-size:12px;color:#5b6b7c;border-top:1px solid #e5e9ef;padding-top:4px}</style>
      <div class="app"><div class="bar"><b>My Roster · Oct 2026</b><span>Times shown in local time</span></div>${L.days.map(card).join('')}</div>`;
  },
};

/* ═══ 4. 月のカレンダー（マスの中に OFF/VAC と便）══════════════════ */
const CAL = {
  id: 'calendar', note: '月のカレンダー（マスの中に便）',
  hint: { year: 2026, month: 11 }, width: 1260, dpr: 1,
  hdr: { period: null, kind: ['planned', null], time_ref: ['local', null] },
  names: ['QUILLFEATHER', '0815327', 'ASHGROVE', 'NIAMH'],
  days: [
    day('2026-11-01', 'OFF'),
    day('2026-11-02', null, null, null, [leg('LX1612', 'ZRH', 'LHR', '07:05', '07:50', null), leg('LX1613', 'LHR', 'ZRH', '08:45', '11:25', null)]),
    day('2026-11-03', 'SBY'),
    day('2026-11-04', 'VAC'), day('2026-11-05', 'VAC'), day('2026-11-06', 'VAC'),
    day('2026-11-07', 'OFF'),
    day('2026-11-08', null, null, null, [leg('LX0180', 'ZRH', 'SIN', '22:35', '17:05', null, { in_day: 1 })]),
    day('2026-11-11', null, null, null, [leg('LX0181', 'SIN', 'ZRH', '23:55', '07:10', null, { in_day: 1 })]),
    day('2026-11-13', 'OFF'), day('2026-11-14', 'OFF'),
    day('2026-11-15', 'TRN', null, null, [gnd('ZRH', '13:00', '17:00')], { pc: 'SIM' }),
    day('2026-11-16', null, null, null, [
      leg('LX1638', 'ZRH', 'CDG', '06:50', '08:05', null, { kind: 'deadhead', role: ['DH', null] }),
      leg('LX0657', 'CDG', 'ZRH', '09:10', '10:20', null)]),
    day('2026-11-17', 'OFF'),
    day('2026-11-18', null, null, null, [leg('LX1612', 'ZRH', 'LHR', '07:05', '07:50', null), leg('LX1613', 'LHR', 'ZRH', '08:45', '11:25', null)]),
    day('2026-11-19', 'SBY'),
    day('2026-11-20', 'OFF'), day('2026-11-21', 'OFF'),
    day('2026-11-22', null, null, null, [leg('LX2804', 'ZRH', 'ATH', '14:05', '18:00', null), leg('LX2805', 'ATH', 'ZRH', '18:50', '20:45', null)]),
    day('2026-11-23', 'TRN', null, null, [gnd('ZRH', '09:00', '16:00')]),
    day('2026-11-24', 'OFF'),
    day('2026-11-25', 'VAC'), day('2026-11-26', 'VAC'), day('2026-11-27', 'VAC'),
    day('2026-11-28', 'OFF'),
    day('2026-11-29', null, null, null, [leg('LX1612', 'ZRH', 'LHR', '07:05', '07:50', null), leg('LX1613', 'LHR', 'ZRH', '08:45', '11:25', null)]),
    day('2026-11-30', 'OFF'),
  ],
  html(L) {
    const by = new Map(L.days.map((d) => [d.date, d]));
    const cells = [];
    // 2026-11 は日曜始まり。月曜始まりの格子：前の月 26〜31日・次の月 1〜6日は灰色（中身なし）
    for (let i = 26; i <= 31; i++) cells.push(`<td class="o"><div class="n">${i}</div></td>`);
    for (let i = 1; i <= 30; i++) {
      const k = `2026-11-${pad2(i)}`, d = by.get(k);
      let body = '';
      if (d) {
        if (d.code) body += `<div class="code c-${d.pc || d.code}">${T(k + '|code', d.pc || d.code)}</div>`;
        d.legs.forEach((l, j) => {
          const lk = `${k}|L${j + 1}`;
          if (l.kind === 'ground') body += `<div class="lg">${T(lk + '|loc', l.loc)} ${T(lk + '|out', compact(l.out))}-${T(lk + '|in', compact(l.in))}</div>`;
          else body += `<div class="lg">${l.kind === 'deadhead' ? `<i>${T(lk + '|role', 'DH')}</i> ` : ''}<b>${T(lk + '|flight', l.flight)}</b> ${
            T(lk + '|from', l.from)}-${T(lk + '|to', l.to)}<br>${T(lk + '|out', compact(l.out))}-${T(lk + '|in', compact(l.in) + (l.in_day ? '+1' : ''))}</div>`;
        });
      }
      cells.push(`<td><div class="n">${T(k + '|date', String(i))}</div>${body}</td>`);
    }
    for (let i = 1; i <= 6; i++) cells.push(`<td class="o"><div class="n">${i}</div></td>`);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(`<tr>${cells.slice(i, i + 7).join('')}</tr>`);
    return `<style>body{font:12px/1.3 "Segoe UI",Arial,sans-serif;margin:0;padding:16px;background:#fff;color:#222}
      .wrap{display:flex;gap:14px}.side{width:150px;font-size:11px;color:#444;border-right:1px solid #ddd;padding-right:10px}
      h1{font-size:20px;margin:0 0 2px}.sub{color:#555;margin-bottom:8px}
      table{border-collapse:collapse;table-layout:fixed;width:1060px}th{background:#30475e;color:#fff;padding:4px;font-weight:600}
      td{border:1px solid #c8ccd2;vertical-align:top;height:78px;padding:3px 4px}td.o{background:#f1f2f4;color:#aaa}
      .n{font-weight:700;font-size:12px;color:#30475e}td.o .n{color:#b5b8bd}
      .code{display:inline-block;font-weight:700;padding:0 5px;border-radius:3px;margin:1px 0}
      .c-OFF{background:#e3f1e3}.c-VAC{background:#fde8c8}.c-SBY{background:#e6e3f7}.c-SIM,.c-TRN{background:#dbeefa}
      .lg{font-size:11px;margin-top:2px}.lg i{color:#b5651d;font-style:normal;font-weight:700}</style>
      <div class="wrap"><div class="side"><b>R. QUILLFEATHER</b><br>Staff 0815327<br>Base ZRH · A330/A340<br><br>
        <b>Contacts</b><br>Crew control duty officer:<br>Niamh Ashgrove<br><br><b>Legend</b><br>OFF day off<br>VAC vacation<br>SBY standby<br>DH deadhead</div>
      <div><h1>Roster November 2026</h1><div class="sub">Status: Published · Times LT</div>
      <table><thead><tr>${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => `<th>${w}</th>`).join('')}</tr></thead>
      <tbody>${weeks.join('')}</tbody></table></div></div>`;
  },
};

/* ═══ 5. 日本の勤務表（漢字の記号・便乗・翌）═══════════════════════ */
const JP = {
  id: 'jp', note: '日本の勤務表（公休・有休・待機・訓練・便乗・翌）',
  hint: { year: 2026, month: 12 }, width: 1180, dpr: 1,
  hdr: { period: null, kind: 'planned', time_ref: ['local', null] },
  names: ['山田', '太郎', '架空', '次郎', '試験', '花子', '584213', '590077', '架空ホテル'],
  days: [
    day('2026-12-01', 'OFF', null, null, [], { pc: '公休' }),
    day('2026-12-02', 'T2105', '06:20', '16:05', [
      leg('ZJ0571', 'HND', 'CTS', '07:00', '08:35', '1:35', { role: 'CAP' }),
      leg('ZJ0574', 'CTS', 'HND', '09:40', '11:15', '1:35', { role: 'CAP' }),
      leg('ZJ0213', 'HND', 'ITM', '12:30', '13:35', '1:05', { role: 'CAP' }),
      leg('ZJ0222', 'ITM', 'HND', '14:30', '15:35', '1:05', { role: 'CAP' })]),
    day('2026-12-03', 'SBY', '05:30', '13:30', [], { pc: '待機' }),
    day('2026-12-04', 'VAC', null, null, [], { pc: '有休' }),
    day('2026-12-05', 'VAC', null, null, [], { pc: '有休' }),
    day('2026-12-06', 'OFF', null, null, [], { pc: '公休' }),
    day('2026-12-07', 'TRN', '08:30', '17:30', [gnd('HND', '09:00', '17:00')], { pc: '訓練' }),
    day('2026-12-08', 'T2140', '22:45', '06:50', [leg('ZJ0841', 'HND', 'SIN', '23:55', '06:20', '7:25', { role: 'CAP', in_day: 1 })], { d_off_day: 1 }),
    day('2026-12-10', 'T2140', '06:45', '16:10', [leg('ZJ0842', 'SIN', 'HND', '07:45', '15:40', '6:55', { role: 'CAP' })]),
    day('2026-12-11', 'OFF', null, null, [], { pc: '公休' }),
    day('2026-12-12', null, '09:00', '17:00', [], { pc: '研修' }),          // ★辞書に無い漢字 → 記号は null
    day('2026-12-13', 'T2177', '07:10', '13:05', [
      leg('ZJ0101', 'HND', 'FUK', '08:00', '09:55', '1:55', { kind: 'deadhead', pr: '便乗' }),
      leg('ZJ0110', 'FUK', 'HND', '11:00', '12:35', '1:35', { role: 'CAP' })]),
    day('2026-12-14', 'OFF', null, null, [], { pc: '代休' }),
    day('2026-12-15', 'SBY', null, null, [], { pc: '予備' }),
    day('2026-12-16', 'TRP', '09:00', '18:00', [], { pc: '出張' }),
  ],
  extra: { '2026-12-09': '滞在' },   // 印字はあるが答えに出てはいけない（辞書に無い・ほかに何も無い）
  crew: { '2026-12-02': '山田 太郎（機長）／架空 次郎', '2026-12-08': '試験 花子／架空 次郎 584213', '2026-12-13': '山田 太郎 590077' },
  memo: { '2026-12-08': 'ホテル：架空ホテル チャンギ', '2026-12-07': '持参品：免許・身体検査証明', '2026-12-12': '安全推進室' },
  html(L) {
    const by = new Map(L.days.map((d) => [d.date, d]));
    const rows = [];
    for (let i = 1; i <= 16; i++) {
      const k = `2026-12-${pad2(i)}`, d = by.get(k);
      const legs = d && d.legs.length ? d.legs : [null];
      legs.forEach((l, j) => {
        const lk = `${k}|L${j + 1}`, last = j === legs.length - 1, g = l && l.kind === 'ground';
        const code = d ? (d.pc || d.code) : L.extra[k];
        const codeKey = d ? k + '|code' : k + '|xcode';
        rows.push(`<tr${j === 0 ? ' class="f"' : ''}>
          <td class="d">${j === 0 ? T(k + '|date', String(i)) : ''}</td>
          <td class="w w${wdOf(k)}">${j === 0 ? WDJ[wdOf(k)] : ''}</td>
          <td class="c">${j === 0 && code ? T(codeKey, code) : ''}</td>
          <td>${j === 0 && d && d.d_on ? T(k + '|d_on', d.d_on) : ''}</td>
          <td>${l && l.flight ? T(lk + '|flight', l.flight.replace(/^([A-Z]{2})/, (m) => m + ' ')) : ''}</td>
          <td>${l ? (g ? T(lk + '|loc', l.loc) : `${T(lk + '|from', l.from)}-${T(lk + '|to', l.to)}`) : ''}</td>
          <td>${l ? T(lk + '|out', l.out) : ''}</td>
          <td>${l ? T(lk + '|in', (l.in_day ? '翌' : '') + l.in) : ''}</td>
          <td>${l && l.block ? T(lk + '|block', l.block) : ''}</td>
          <td>${last && d && d.d_off ? T(k + '|d_off', (d.d_off_day ? '翌' : '') + d.d_off) : ''}</td>
          <td>${l && l.pr ? esc(l.pr) : l && first(l.role) ? T(lk + '|role', first(l.role)) : ''}</td>
          <td class="s">${j === 0 && L.crew[k] ? esc(L.crew[k]) : ''}</td>
          <td class="s">${j === 0 && L.memo[k] ? esc(L.memo[k]) : ''}</td></tr>`);
      });
    }
    return `<style>body{font:13px/1.4 "Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif;margin:0;padding:18px 22px;background:#fff;color:#111}
      h1{font-size:18px;margin:0 0 4px;letter-spacing:.08em}.meta{font-size:12px;color:#333;margin-bottom:8px}
      table{border-collapse:collapse;width:100%}th{background:#e9edf3;border:1px solid #8a96a8;padding:3px 5px;font-size:12px;font-weight:600}
      td{border-left:1px solid #b9c2cf;border-right:1px solid #b9c2cf;padding:2px 5px;white-space:nowrap}tr.f td{border-top:1px solid #8a96a8}
      td.d{text-align:right}.w0{color:#c0262d}.w6{color:#1f5fbf}td.c{font-weight:700}td.s{font-size:11px;color:#444}
      .foot{margin-top:10px;font-size:12px}</style>
      <h1>2026年12月 乗務予定表（予定）</h1>
      <div class="meta">所属：運航乗員部 第2課　社員番号 571148　氏名 架空 一郎　資格 CAP　※時刻は現地時間</div>
      <table><thead><tr><th>日</th><th>曜</th><th>勤務</th><th>出頭</th><th>便名</th><th>区間</th><th>出発</th><th>到着</th><th>乗務</th><th>退勤</th><th>役</th><th>同乗者</th><th>備考</th></tr></thead>
      <tbody>${rows.join('')}</tbody></table>
      <div class="foot">乗務時間計 23:40　／　勤務日数 9日　／　問い合わせ：乗員スケジュール課 内線 3302</div>`;
  },
};
JP.names.push('571148', '一郎');

/* ═══ 6. 長い勤務表を3枚のスクリーンショットに（重なり・切れ）══════════ */
const SPLIT = {
  id: 'split', note: '長い勤務表を3枚に（2日の重なり・1日が画像をまたぐ・途中で切れた行）',
  hint: { year: 2026, month: 10 }, width: 1100, dpr: 1,
  hdr: { period: '2026-10-20..2026-11-04', kind: [null, 'planned'], time_ref: 'local' },   // 「Duty Plan」は予定と読んでよい
  names: ['QUILLFEATHER', 'MARROWDALE', 'THISTLEWOOD', 'BRAMBLECOTE', 'ASHGROVE', '730514', '731822', '744190', 'AURORA'],
  days: [
    day('2026-10-20', 'OFF'),
    day('2026-10-21', 'P601', '05:30', '15:50', [
      leg('ZV401', 'SYD', 'MEL', '06:15', '07:50', '1:35', { role: 'CPT' }),
      leg('ZV410', 'MEL', 'SYD', '08:40', '10:10', '1:30', { role: 'CPT' }),
      leg('ZV433', 'SYD', 'BNE', '11:20', '12:55', '1:35', { role: 'CPT' }),
      leg('ZV436', 'BNE', 'SYD', '13:45', '15:20', '1:35', { role: 'CPT' })]),
    day('2026-10-22', 'OFF'),
    day('2026-10-23', 'SBY', '04:00', '12:00'),
    day('2026-10-24', 'P614', '13:05', '00:50', [
      leg('ZV455', 'SYD', 'PER', '14:00', '16:55', '5:05', { role: 'CPT' }),
      leg('ZV458', 'PER', 'SYD', '18:00', '00:20', '4:20', { role: 'CPT', in_day: 1 })], { d_off_day: 1 }),
    day('2026-10-25', 'OFF'),
    day('2026-10-26', 'TRN', '07:30', '12:30', [gnd('SYD', '08:00', '12:00')], { pc: 'SIM' }),
    day('2026-10-27', 'P622', '06:00', '14:05', [
      leg('ZV503', 'SYD', 'OOL', '06:45', '08:15', '1:30', { role: 'CPT' }),
      leg('ZV506', 'OOL', 'SYD', '09:00', '10:35', '1:35', { role: 'CPT' }),
      leg('ZV411', 'SYD', 'MEL', '12:00', '13:35', '1:35', { role: 'DH', kind: 'deadhead' })]),
    day('2026-10-28', 'P623', '07:00', '20:15', [
      leg('ZV418', 'MEL', 'SYD', '07:45', '09:15', '1:30', { role: 'CPT' }),
      leg('ZV441', 'SYD', 'CNS', '10:30', '13:30', '3:00', { role: 'CPT' }),
      leg('ZV444', 'CNS', 'SYD', '14:30', '17:35', '3:05', { role: 'CPT' }),
      leg('ZV309', 'SYD', 'CBR', '18:50', '19:45', '0:55', { role: 'CPT' })]),
    day('2026-10-29', 'OFF'),
    day('2026-10-30', 'VAC'),
    day('2026-10-31', 'VAC'),
    day('2026-11-01', 'VAC'),
    day('2026-11-02', 'P640', '05:15', '12:55', [
      leg('ZV421', 'SYD', 'ADL', '06:00', '07:25', '1:55', { role: 'CPT' }),
      leg('ZV424', 'ADL', 'SYD', '08:50', '12:25', '2:05', { role: 'CPT' })]),
    day('2026-11-03', 'OFF'),
    day('2026-11-04', 'P651', '21:30', '04:00', [leg('ZV471', 'SYD', 'AKL', '22:30', '03:30', '3:00', { role: 'CPT', in_day: 1 })], { d_off_day: 1 }),
  ],
  cutDay: '2026-10-28',
  crew: { '2026-10-21': 'CPT QUILLFEATHER R · FO MARROWDALE T 731822', '2026-10-24': 'CPT QUILLFEATHER R · FO THISTLEWOOD K',
          '2026-10-27': 'CPT QUILLFEATHER R · FO BRAMBLECOTE S 744190', '2026-10-28': 'CPT QUILLFEATHER R · FO BRAMBLECOTE S 744190',
          '2026-11-02': 'CPT QUILLFEATHER R · FO ASHGROVE P', '2026-11-04': 'CPT QUILLFEATHER R · FO MARROWDALE T 731822' },
  html(L) {
    const rows = [];
    for (const d of L.days) {
      const legs = d.legs.length ? d.legs : [null];
      legs.forEach((l, i) => {
        const k = d.date, lk = `${d.date}|L${i + 1}`, last = i === legs.length - 1, g = l && l.kind === 'ground';
        rows.push(`<tr data-tr="${k}|${i}"${i === 0 ? ' class="f"' : ''}>
          <td>${i === 0 ? T(k + '|date', `${WD3[wdOf(k)]} ${pad2(dOf(k))}`) : ''}</td>
          <td class="c">${i === 0 && d.code ? T(k + '|code', d.pc || d.code) : ''}</td>
          <td>${i === 0 && d.d_on ? T(k + '|d_on', compact(d.d_on)) : ''}</td>
          <td>${l && first(l.role) ? T(lk + '|role', first(l.role)) : ''}</td>
          <td>${l && l.flight ? T(lk + '|flight', l.flight) : ''}</td>
          <td>${l ? (g ? T(lk + '|loc', l.loc) : `${T(lk + '|from', l.from)}-${T(lk + '|to', l.to)}`) : ''}</td>
          <td>${l ? T(lk + '|out', compact(l.out)) : ''}</td>
          <td>${l ? T(lk + '|in', compact(l.in) + (l.in_day ? '+1' : '')) : ''}</td>
          <td>${l && l.block ? T(lk + '|block', blk0(l.block)) : ''}</td>
          <td>${last && d.d_off ? T(k + '|d_off', compact(d.d_off) + (d.d_off_day ? '+1' : '')) : ''}</td>
          <td class="crew">${i === 0 && L.crew[k] ? esc(L.crew[k]) : ''}</td></tr>`);
      });
    }
    return `<style>body{font:15px/1.3 Roboto,Arial,sans-serif;margin:0;padding:0 0 600px;background:#fff;color:#1d2733}
      .title{padding:14px 18px 8px;background:#173a5e;color:#fff}.title h1{font-size:19px;margin:0}.title div{font-size:13px;opacity:.9}
      table{border-collapse:separate;border-spacing:0;width:100%}
      thead th{position:sticky;top:0;background:#dde6ef;text-align:left;padding:7px 8px;font-size:13px;border-bottom:2px solid #7d93ab;z-index:2}
      td{padding:0 8px;height:38px;border-bottom:1px solid #e4e9ef;white-space:nowrap}tr.f td{border-top:1px solid #9fb2c6}
      td.c{font-weight:700}td.crew{font-size:12px;color:#556}.tot td{font-weight:700;border-top:2px solid #333}
      .rem{padding:10px 18px;font-size:13px;color:#445}</style>
      <div class="title"><h1>Duty Plan</h1><div>Period 20 Oct 2026 – 04 Nov 2026 · Base SYD · All times local (LT)</div>
        <div>QUILLFEATHER R · Staff 730514</div></div>
      <table><thead><tr><th>Date</th><th>Duty</th><th>C/I</th><th>Pos</th><th>Flight</th><th>Sector</th><th>Dep</th><th>Arr</th><th>Blk</th><th>C/O</th><th>Crew</th></tr></thead>
      <tbody>${rows.join('')}<tr class="tot"><td colspan="8">Total</td><td>43:05</td><td colspan="2">Duty days 8</td></tr></tbody></table>
      <div class="rem">Hotel CNS 28Oct: Hotel Aurora Esplanade · Notes: Thistlewood swap approved</div>`;
  },
};

const LAYOUTS = [ECREW, LIDO, MOBILE, CAL, JP, SPLIT];
if (ONLY.length) {
  const unknown = ONLY.filter((id) => !LAYOUTS.some((L) => L.id === id));
  if (unknown.length && !SAMPLES) { console.error(`❌ 知らない様式: ${unknown.join(', ')}（ある様式: ${LAYOUTS.map((L) => L.id).join(' ')}）`); process.exit(1); }
}

/* ═══ 絵を作る（本番の画面と同じ JPEG・長辺 MAX_EDGE まで）＋ 各欄が画像のどこに見えているか ═══ */
const OUT = opt('--out', null) || mkdtempSync(path.join(os.tmpdir(), 'pv-roster-eval-'));
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

/* 札（data-pv）ごとに full / partial / hidden。band は画像に写っている縦の範囲（その時の画面の座標）。 */
async function measure(page, bandTop, bandBottom) {
  return page.evaluate((top, bot) => {
    const out = [];
    for (const e of document.querySelectorAll('[data-pv]')) {
      const r = e.getBoundingClientRect();
      const st = r.top >= top - 1 && r.bottom <= bot + 1 ? 'full' : (r.bottom <= top + 1 || r.top >= bot - 1) ? 'hidden' : 'partial';
      out.push([e.dataset.pv, st]);
    }
    return out;
  }, bandTop, bandBottom);
}
const RANK = { full: 3, partial: 2, hidden: 1 };
function visMap(pairs) {
  const m = new Map();
  for (const [k, st] of pairs) if (!m.has(k) || RANK[st] > RANK[m.get(k)]) m.set(k, st);
  return m;
}

/* 長辺が MAX_EDGE を超えるときだけ縮めて JPEG にする（payslip.js と同じ考え方・引き伸ばさない）。 */
async function prepImage(browser, buf, mime) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(async (u, max) => {
      const im = new Image(); im.src = u; await im.decode();
      const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(im, 0, 0, c.width, c.height);
      return { b64: c.toDataURL('image/jpeg', 0.88).split(',')[1], w: c.width, h: c.height };
    }, `data:${mime};base64,${buf.toString('base64')}`, MAX_EDGE);
  } finally { await page.close(); }
}

async function render(browser, L) {
  const page = await browser.newPage();
  await page.setViewport({ width: L.width, height: 900, deviceScaleFactor: L.dpr });
  await page.setContent(`<!doctype html><meta charset="utf-8">${L.html(L)}`, { waitUntil: 'load' });
  const shots = [];
  if (L.id !== 'split') {
    await page.setViewport({ width: L.width, height: 200, deviceScaleFactor: L.dpr });
    const h = await page.evaluate(() => Math.ceil(document.body.getBoundingClientRect().bottom + 16));
    await page.setViewport({ width: L.width, height: h, deviceScaleFactor: L.dpr });
    const vis = visMap(await measure(page, 0, h));
    const buf = await page.screenshot({ type: 'png', fullPage: true });
    shots.push({ buf, vis, hdr: true });
  } else {
    /* 行の位置（文書の座標）から3枚の切り方を決める */
    const g = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('tr[data-tr]')].map((r) => {
        const b = r.getBoundingClientRect(); return { k: r.dataset.tr, top: b.top + scrollY, bottom: b.bottom + scrollY };
      });
      const th = document.querySelector('thead').getBoundingClientRect();
      const tot = document.querySelector('.rem').getBoundingClientRect();
      return { rows, theadH: th.height, end: tot.bottom + scrollY };
    });
    const at = (k) => g.rows.find((r) => r.k === k);
    const cut = SPLIT.cutDay;
    const plan = [
      { y: 0, bottom: at('2026-10-26|0').bottom + 6, hdr: true },                         // 1枚目：見出し〜26日まで（日の境で切れる）
      { y: at('2026-10-25|0').top - g.theadH - 6,                                         // 2枚目：25・26日が重なる
        bottom: (at(cut + '|2').top + at(cut + '|2').bottom) / 2, hdr: false },           //        28日の3区間目の行の真ん中で切れる
      { y: at(cut + '|1').top - g.theadH - 2, bottom: g.end + 10, hdr: false },          // 3枚目：28日の2区間目から（日付の行は見えない）
    ];
    for (const p of plan) {
      const h = Math.round(p.bottom - p.y);
      await page.setViewport({ width: L.width, height: h, deviceScaleFactor: L.dpr });
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(p.y));
      await new Promise((r) => setTimeout(r, 60));
      const bandTop = await page.evaluate(() => document.querySelector('thead th').getBoundingClientRect().bottom);   // 貼りつくのは th
      const vis = visMap(await measure(page, bandTop, h));     // ★撮る前に測る（撮ると位置が戻ることがある）
      const buf = await page.screenshot({ type: 'png', captureBeyondViewport: false });
      shots.push({ buf, vis, hdr: p.hdr });
    }
  }
  await page.close();
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    const pr = await prepImage(browser, s.buf, 'image/png');
    Object.assign(s, pr, { kb: Math.round(pr.b64.length * 3 / 4 / 1024) });
    s.file = path.join(OUT, `${L.id}-${i + 1}.jpg`);
    writeFileSync(s.file, Buffer.from(pr.b64, 'base64'));
    delete s.buf;
  }
  return shots;
}

/* 正解の欄が全部札つきで印字されているか（様式の作り間違いを先に見つける）。 */
function untagged(L, shots) {
  const all = new Map();
  for (const s of shots) for (const [k, st] of s.vis) if (!all.has(k) || RANK[st] > RANK[all.get(k)]) all.set(k, st);
  const miss = [];
  for (const d of L.days) {
    for (const f of ['code', 'd_on', 'd_off']) if (first(d[f]) != null && !all.has(`${d.date}|${f}`)) miss.push(`${d.date}|${f}`);
    if (!all.has(`${d.date}|date`)) miss.push(`${d.date}|date`);
    d.legs.forEach((l, i) => {
      for (const f of ['flight', 'from', 'to', 'loc', 'out', 'in', 'block']) if (first(l[f]) != null && !all.has(`${d.date}|L${i + 1}|${f}`)) miss.push(`${d.date}|L${i + 1}|${f}`);
    });
  }
  const notFull = [...all].filter(([, st]) => st !== 'full').map(([k]) => k);
  return { miss, notFull };
}

/* ═══ 読ませる（Edge Function を経由しない）═══════════════════════ */
async function callApi(body) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 180_000);
    const t0 = Date.now();
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: ac.signal,
      });
    } catch { clearTimeout(timer); if (attempt) return { code: 'upstream_unreachable', ms: Date.now() - t0, usd: 0, it: 0, ot: 0 }; continue; }
    clearTimeout(timer);
    const ms = Date.now() - t0;
    if (!res.ok) {
      /* 手元の検査なので、断られた理由の文（API の検品の文・勤務表の中身は入らない）も出す */
      let t = ''; try { const e = (await res.json())?.error; t = (e?.type || '') + (e?.message ? ' — ' + String(e.message).slice(0, 300) : ''); } catch { /* 本文は見ない */ }
      if ((res.status === 429 || res.status >= 500) && !attempt) { await new Promise((r) => setTimeout(r, 15000)); continue; }
      return { code: `upstream_${res.status}${t ? ':' + t : ''}`, ms, usd: 0, it: 0, ot: 0 };
    }
    const data = await res.json();
    const usd = charge(data.usage);
    const got = readReply(data);
    return { code: got.ok ? 'ok' : got.code, raw: got.ok ? got.raw : null, ms, usd, it: got.it, ot: got.ot, stop: got.stop };
  }
  return { code: 'upstream_retry', ms: 0, usd: 0, it: 0, ot: 0 };
}
let stopped = false;
async function readOne(key, body) {
  if (SAVED[key]) return { ...SAVED[key], usd: 0, saved: true };
  if (DRY) return null;
  if (spent + (inflight + 1) * NEXT_MAX > BUDGET) { stopped = true; return { code: 'budget', usd: 0 }; }
  inflight++;
  try {
    const r = await callApi(body);
    if (SAVE) { toSave[key] = { code: r.code, raw: r.raw, ms: r.ms, it: r.it, ot: r.ot, stop: r.stop }; writeFileSync(SAVE, JSON.stringify({ ...SAVED, ...toSave })); }
    return r;
  } finally { inflight--; }
}

/* ═══ 採点 ═══════════════════════════════════════════════════════
   欄ごと:
     正解と同じ → ok（見えている欄だけ数える。見えない欄に値が入っていたら ctx）
     null       → 見えている欄なら miss（作り話ではない）
     違う値     → wrong。その日に cut も区間に partial も無ければ ★silent（黙って外した）
   日: 正解に無い日を出した → 余分な日（cut が無ければ silent）。見えている日を出さなかった → 抜けた日。
   区間: 便名・区間・時刻で正解の区間と組み合わせる。組めない答えの区間 → 余分（partial が無ければ silent）。
   ════════════════════════════════════════════════════════════════ */
const LEG_F = ['flight', 'from', 'to', 'loc', 'out', 'in', 'block', 'role'];
function scorePage(TR, R, o = {}) {
  const vis = o.vis || null, complete = o.complete !== false;
  const m = { dExp: 0, dHit: 0, dMiss: 0, dExtra: 0, dCtx: 0, lExp: 0, lHit: 0, lMiss: 0, lExtra: 0,
              fExp: 0, fOk: 0, fMiss: 0, fWrong: 0, silent: 0, ctx: 0, notes: [] };
  const bestOf = (prefix) => {
    if (!vis) return 'full';
    let b = null;
    for (const [k, st] of vis) if (k.startsWith(prefix) && (!b || RANK[st] > RANK[b])) b = st;
    return b || 'hidden';
  };
  const st = (key, want) => (first(want) == null && !accOf(want).some((w) => w != null) ? 'absent' : vis ? (vis.get(key) || 'full') : 'full');
  const field = (where, f, got, want, status, flagged) => {
    if (want === undefined) return;                       // 部分の答えで書いていない欄は採点しない
    const acc = accOf(want), wantNN = acc.some((w) => w !== null);
    if (status === 'full' && wantNN) m.fExp++;
    if (acc.some((w) => w === got)) {
      if (got !== null && status === 'hidden') { m.ctx++; m.notes.push(`  · ${where} ${f}=${got}（この画像では見えない欄に値）`); }
      else if (status === 'full' && wantNN) m.fOk++;      // null も正解に入れてある欄（DH の札など）は null で正解
      return;
    }
    if (got === null) {
      if (status === 'full' && wantNN) { m.fMiss++; m.notes.push(`  - ${where} ${f}: 空（正 ${acc[0]}）`); }
      return;
    }
    m.fWrong++;
    if (!flagged) m.silent++;
    m.notes.push(`  ${flagged ? '⚠' : '❌'} ${where} ${f}=${got}（正 ${acc.map((x) => String(x)).join('|')}${status !== 'full' ? '・' + status : ''}）`);
  };

  // ── 見出し（期間・実績/予定・UTC/現地）
  if (o.hdr) {
    const H = o.hdrVisible ? TR.hdr : { period: [null, first(TR.hdr.period)], kind: [null, ...accOf(TR.hdr.kind)], time_ref: [null, ...accOf(TR.hdr.time_ref)] };
    const per = R.period ? `${R.period.from}..${R.period.to}` : null;
    field('見出し', 'period', per, H.period, o.hdrVisible ? 'full' : 'absent', false);
    field('見出し', 'kind', R.hints?.kind ?? null, H.kind, o.hdrVisible ? 'full' : 'absent', false);
    field('見出し', 'time_ref', R.hints?.time_ref ?? null, H.time_ref, o.hdrVisible ? 'full' : 'absent', false);
  }

  const tBy = new Map(TR.days.map((d) => [d.date, d]));
  for (const od of R.days) {
    if (tBy.has(od.date)) continue;
    if (!complete) continue;
    m.dExtra++;
    if (!od.cut) m.silent++;
    m.notes.push(`  ${od.cut ? '⚠' : '❌'} 余分な日 ${od.date}（${od.code || ''} ${od.legs.length}区間）`);
  }
  for (const t of TR.days) {
    const ds = bestOf(t.date + '|');
    const od = R.days.find((d) => d.date === t.date);
    if (ds === 'full') m.dExp++;
    if (!od) {
      if (ds === 'full') { m.dMiss++; m.notes.push(`  - 抜けた日 ${t.date}`); }
      continue;
    }
    if (ds === 'full') m.dHit++;
    if (ds === 'hidden') { m.dCtx++; m.notes.push(`  · ${t.date} はこの画像に無いのに出た`); }
    const flagged = !!od.cut;
    field(t.date, 'code', od.code, t.code, st(t.date + '|code', t.code), flagged);
    field(t.date, 'd_on', od.d_on, t.d_on, st(t.date + '|d_on', t.d_on), flagged);
    field(t.date, 'd_off', od.d_off, t.d_off, st(t.date + '|d_off', t.d_off), flagged);
    if (od.d_off !== null && t.d_off != null && od.d_off === first(t.d_off) && t.d_off_day !== undefined) {
      field(t.date, 'd_off_day', od.d_off_day, t.d_off_day, st(t.date + '|d_off', t.d_off), flagged);
    }
    if (!Array.isArray(t.legs)) continue;                 // 部分の答えで区間を書いていない日
    const legsComplete = complete && t.legs_complete !== false;
    // 区間の組み合わせ
    const K = ['flight', 'from', 'to', 'loc', 'out', 'in'];
    const cand = [];
    t.legs.forEach((tl, i) => od.legs.forEach((ol, j) => {
      let sc = 0;
      for (const k of K) if (tl[k] !== undefined && ol[k] != null && accOf(tl[k]).includes(ol[k])) sc++;
      cand.push({ i, j, sc, dist: Math.abs(i - j) });
    }));
    cand.sort((a, b) => b.sc - a.sc || a.dist - b.dist);
    const ti = new Set(), oj = new Set(), pairs = [];
    for (const c of cand) { if (c.sc < 1 || ti.has(c.i) || oj.has(c.j)) continue; ti.add(c.i); oj.add(c.j); pairs.push(c); }
    t.legs.forEach((tl, i) => {
      const ls = bestOf(`${t.date}|L${i + 1}|`);
      if (ls === 'full') m.lExp++;
      const p = pairs.find((x) => x.i === i);
      if (!p) { if (ls === 'full') { m.lMiss++; m.notes.push(`  - ${t.date} 区間${i + 1}（${first(tl.flight) || first(tl.loc) || ''}）が無い`); } return; }
      if (ls === 'full') m.lHit++;
      const ol = od.legs[p.j], fl = flagged || ol.partial;
      const where = `${t.date} 区間${i + 1}`;
      const lst = (f) => (vis ? (vis.get(`${t.date}|L${i + 1}|${f}`) || (accOf(tl[f]).some((w) => w != null) ? 'full' : 'absent')) : (accOf(tl[f]).some((w) => w != null) ? 'full' : 'absent'));
      for (const f of LEG_F) field(where, f, ol[f], tl[f], lst(f), fl);
      if (ol.in !== null && tl.in != null && accOf(tl.in).includes(ol.in) && tl.in_day !== undefined) field(where, 'in_day', ol.in_day, tl.in_day, lst('in'), fl);
      if (tl.kind !== undefined) field(where, 'kind', ol.kind === 'unknown' ? null : ol.kind, tl.kind, ls === 'hidden' ? 'hidden' : ls === 'partial' ? 'partial' : 'full', fl);
    });
    od.legs.forEach((ol, j) => {
      if (oj.has(j) || !legsComplete) return;
      m.lExtra++;
      const fl = flagged || ol.partial;
      if (!fl) m.silent++;
      m.notes.push(`  ${fl ? '⚠' : '❌'} ${t.date} 余分な区間 ${ol.flight || ''} ${ol.from || ol.loc || ''}-${ol.to || ''} ${ol.out || ''}`);
    });
  }
  return m;
}

/* 名前・番号が答えに出ていないか。4字以上の英字は大小を問わず、数字と漢字はそのまま探す。 */
function leakHits(names, obj) {
  const s = JSON.stringify(obj ?? null), S = s.toUpperCase();
  const hits = [];
  for (const n of names || []) {
    const t = String(n);
    if (/^\d+$/.test(t) || /[぀-ヿ㐀-鿿]/.test(t)) { if (s.includes(t)) hits.push(t); }
    else if (t.length >= 4 && S.includes(t.toUpperCase())) hits.push(t);
    else if (t.length < 4 && new RegExp(`"${t.toUpperCase()}"`).test(S)) hits.push(t);
  }
  return hits;
}

/* ═══ 表の小道具 ══════════════════════════════════════════════════ */
const rowsOut = [];
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');
function line(tag, sc, ch, leakS, leakR, usd, extra = '') {
  rowsOut.push({ tag, sc, ch, leakS, leakR, usd });
  const f = sc ? `${sc.fOk}/${sc.fExp} ${pct(sc.fOk, sc.fExp)}` : '-';
  console.log(`  ${tag.padEnd(18)} 日 ${sc ? `${sc.dHit}/${sc.dExp}` : '-'}`.padEnd(30)
    + ` 区間 ${sc ? `${sc.lHit}/${sc.lExp}` : '-'}`.padEnd(13)
    + ` 欄 ${f}`.padEnd(17)
    + ` 空 ${sc ? sc.fMiss : '-'}`.padEnd(6) + ` 違 ${sc ? sc.fWrong : '-'}`.padEnd(6)
    + ` ★黙 ${sc ? sc.silent : '-'}`.padEnd(7) + ` ctx ${sc ? sc.ctx + sc.dCtx : '-'}`.padEnd(7)
    + ` 日付なし ${ch ? ch.undated : '-'} 捨 ${ch ? `${ch.dropped_days}/${ch.dropped_legs}/${ch.dropped_fields}` : '-'}`.padEnd(22)
    + ` 漏れ ${leakS ? leakS.length : '-'}(raw ${leakR ? leakR.length : '-'})`
    + `${usd ? `  $${usd.toFixed(4)}` : ''}${extra}`);
}

/* ═══ 合成の6様式 ═══════════════════════════════════════════════ */
async function runSynthetic(browser) {
  const layouts = LAYOUTS.filter((L) => !ONLY.length || ONLY.includes(L.id));
  console.log(`\n合成の勤務表 ${layouts.length} 様式（${layouts.map((L) => L.id).join(' ')}）／絵の置き場 ${OUT}`);
  console.log(`   エンジン（分割スクショをまとめる）: ${ENGINE ? 'あり（PVReport.mergePages）' : 'なし'}`);
  const rendered = [];
  for (const L of layouts) {
    const shots = await render(browser, L);
    const u = untagged(L, shots);
    rendered.push({ L, shots });
    const legs = L.days.reduce((a, d) => a + d.legs.length, 0);
    const toks = shots.map((s) => Math.round((s.w * s.h) / 750));
    console.log(`   ${L.id.padEnd(9)} ${L.note}`);
    console.log(`      正解 ${L.days.length}日・${legs}区間 ／ ${shots.length}枚 ${shots.map((s) => `${s.w}×${s.h} ${s.kb}KB`).join(', ')}`
      + ` ／ 画像の見込み ≒${toks.join('+')} tokens`);
    if (u.miss.length) console.log(`      ⚠️ 札の無い正解の欄（様式の作り間違い）: ${u.miss.slice(0, 8).join(' ')}`);
    if (L.id !== 'split' && u.notFull.length) console.log(`      ⚠️ 1枚の様式なのに見切れている欄: ${u.notFull.slice(0, 6).join(' ')}`);
    if (L.id === 'split') {
      shots.forEach((s, i) => {
        const part = [...s.vis].filter(([, x]) => x === 'partial').map(([k]) => k);
        const days = [...new Set([...s.vis].filter(([, x]) => x !== 'hidden').map(([k]) => k.split('|')[0]))];
        console.log(`      ${i + 1}枚目 ${days[0]}〜${days[days.length - 1]}（${days.length}日）${part.length ? ` 切れた欄 ${part.join(' ')}` : ''}`);
      });
    }
  }
  const sysTok = Math.round(buildRequest('', 'image/jpeg', { page: 1, pages: 1 }).system.length / 3.6);
  const pages = rendered.reduce((a, r) => a + r.shots.length, 0);
  const estOut = rendered.reduce((a, r) => a + r.shots.length * (r.L.days.length * 60 + r.L.days.reduce((x, d) => x + d.legs.length, 0) * 110), 0);
  const estIn = rendered.reduce((a, r) => a + r.shots.reduce((x, s) => x + Math.min(6000, Math.round((s.w * s.h) / 750)) + sysTok + 200, 0), 0);
  console.log(`   見込み: ${pages}枚 ／ 入力 ≒${estIn} ・答え ≒${estOut} tokens ／ ≒$${(estIn * PRICE.in + estOut * PRICE.out).toFixed(2)}（上限 $${BUDGET.toFixed(2)}・これまで $${spent.toFixed(4)}）`);
  if (DRY && !RESCORE) return [];

  /* 様式ごとに並べて読ませる（1つの様式の中は順番に：前の画像の続きを渡すため） */
  const results = await Promise.all(rendered.map(async ({ L, shots }) => {
    const pagesOut = [];
    let tail = [];
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i];
      const body = buildRequest(s.b64, 'image/jpeg', { page: i + 1, pages: shots.length, tail });
      const rep = await readOne(`${L.id}#${i + 1}`, body);
      if (!rep || !rep.raw) { pagesOut.push({ i, rep, err: rep ? rep.code : 'dry' }); tail = []; continue; }
      const out = sanitize(rep.raw, { page: i + 1, hint: L.hint, tail, now: NOW });
      tail = sanitizeTail(out.roster.days, NOW);
      const sc = scorePage(L, out.roster, { vis: s.vis, hdr: true, hdrVisible: s.hdr });
      pagesOut.push({ i, rep, out, sc, leakS: leakHits(L.names, out), leakR: leakHits(L.names, rep.raw) });
    }
    return { L, shots, pagesOut };
  }));

  console.log('\n── 採点（1枚ずつ）─────────────────────────────────────────────────────────────');
  for (const { L, shots, pagesOut } of results) {
    for (const p of pagesOut) {
      const tag = `${L.id}${shots.length > 1 ? ' ' + (p.i + 1) + '/' + shots.length : ''}`;
      if (!p.out) { console.log(`  ${tag.padEnd(18)} 💥 ${p.err}`); rowsOut.push({ tag, err: p.err }); continue; }
      line(tag, p.sc, p.out.checks, p.leakS, p.leakR, p.rep.usd,
        `  ${(p.rep.ms / 1000 || 0).toFixed(0)}s out=${p.rep.ot}${p.out.checks.code_mapped ? ` 記号の置き換え ${p.out.checks.code_mapped}` : ''}${p.out.checks.cut_days ? ` cut ${p.out.checks.cut_days}` : ''}${p.out.checks.partial_legs ? ` partial ${p.out.checks.partial_legs}` : ''} anchor=${p.out.checks.anchor}`);
    }
    /* split：3枚をまとめる */
    if (shots.length > 1) {
      if (!ENGINE) { console.log('  merge: skipped (engine not ready)'); continue; }
      if (pagesOut.some((p) => !p.out)) { console.log('  merge: skipped（読めなかった画像がある）'); continue; }
      const mg = ENGINE.mergePages(pagesOut.map((p) => p.out.roster));
      const R = { days: mg.days, period: mg.period, hints: mg.hints };
      const sc = scorePage(L, R, { vis: null, hdr: true, hdrVisible: true });
      const cd = mg.days.find((d) => d.date === L.cutDay);
      const want = L.days.find((d) => d.date === L.cutDay);
      const cutOk = !!cd && cd.d_on === want.d_on && cd.d_off === want.d_off && cd.legs.length === want.legs.length
        && !cd.cut && cd.legs.every((l) => !l.partial);
      const dup = mg.days.length !== new Set(mg.days.map((d) => d.date)).size;
      const issues = {};
      for (const x of mg.issues) issues[x.type] = (issues[x.type] || 0) + 1;
      line(`${L.id} merge`, sc, null, leakHits(L.names, mg), [], 0,
        `  同じ日が2回 ${dup ? '❌' : 'なし'} ・切れた日 ${L.cutDay} ${cutOk ? '✅ 埋まった' : '❌ ' + JSON.stringify(cd ? { d_on: cd.d_on, d_off: cd.d_off, legs: cd.legs.length, cut: cd.cut } : null)} ・issues ${JSON.stringify(issues)}`);
      results.find((r) => r.L === L).merge = { sc, mg };
    }
  }
  console.log('\n── 外した欄（❌＝黙って外した・⚠＝切れの印つき・-＝空・·＝見えない欄に値）');
  for (const { L, shots, pagesOut, merge } of results) {
    for (const p of pagesOut) {
      if (!p.sc) continue;
      const notes = p.sc.notes;
      if (!notes.length && !p.leakS.length && !p.leakR.length) continue;
      console.log(`  ${L.id}${shots.length > 1 ? ' ' + (p.i + 1) + '/' + shots.length : ''}`);
      for (const x of p.leakS) console.log(`    🔓 名前・番号が答えに出た: ${x}`);
      for (const x of p.leakR) console.log(`    （raw）sanitize の前のモデルの答えに: ${x}`);
      for (const n of notes.slice(0, 40)) console.log('  ' + n);
      if (notes.length > 40) console.log(`    …ほか ${notes.length - 40}`);
    }
    if (merge && merge.sc.notes.length) {
      console.log(`  ${L.id} merge`);
      for (const n of merge.sc.notes.slice(0, 30)) console.log('  ' + n);
      for (const x of merge.mg.issues.slice(0, 12)) console.log(`    issue ${JSON.stringify(x)}`);
    }
  }
  return results;
}

/* ═══ 公開されている見本（--dir）═════════════════════════════════
   ★読んだものはリポジトリに書かない。画面に数と記号だけを出す。 */
function normAnswer(a) {
  const nc = (v) => (v == null ? null : (parseClock(v)?.t ?? null));
  const legN = (l) => {
    const o = {};
    if ('flight' in l) o.flight = l.flight == null ? null : flightOf(l.flight);
    if ('from' in l) o.from = l.from == null ? null : tok(l.from, RE.apt);
    if ('to' in l) o.to = l.to == null ? null : tok(l.to, RE.apt);
    if ('loc' in l) o.loc = l.loc == null ? null : tok(l.loc, RE.loc);
    if ('out' in l) o.out = nc(l.out);
    if ('in' in l) o.in = nc(l.in);
    if ('in_day' in l) o.in_day = l.in_day;
    if ('block' in l) o.block = l.block == null ? null : parseBlock(l.block);
    if ('role' in l) o.role = l.role == null ? null : tok(l.role, RE.role);
    if ('kind' in l) o.kind = l.kind;
    return o;
  };
  const out = (Array.isArray(a.days) ? a.days : []).map((d) => {
    const o = { date: d.date };
    if ('code' in d) o.code = d.code == null ? null : dayCodeOf(d.code).code;
    if ('d_on' in d) o.d_on = nc(d.d_on);
    if ('d_off' in d) o.d_off = nc(d.d_off);
    if ('d_off_day' in d) o.d_off_day = d.d_off_day;
    if (Array.isArray(d.legs)) o.legs = d.legs.map(legN);
    if (d.legs_complete === false) o.legs_complete = false;
    return o;
  });
  /* 記号が語でしか印字されていない日（「RIPOSO MENSILE」「Day Off」）は、形の決まりで答えに出せない。
     ほかに何も無ければ採点から外して数だけ出す（読み手の誤りではなく、決まりで落ちる日）。 */
  const keep = out.filter((d) => ['code', 'd_on', 'd_off'].some((f) => d[f] != null) || (d.legs && d.legs.length));
  normAnswer.unrep = out.length - keep.length;
  return keep;
}

async function runDir(browser, dir) {
  const files = readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
  const groups = new Map();
  for (const f of files) {
    const m = f.match(/^(.*)-p(\d+)\.(png|jpe?g|webp)$/i);
    const key = m ? m[1] : f.replace(/\.(png|jpe?g|webp)$/i, '');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ f, n: m ? Number(m[2]) : 1 });
  }
  const keys = [...groups.keys()].filter((k) => !ONLY.length || ONLY.some((o) => k.includes(o)));
  console.log(`\n公開の見本 ${keys.length} 件（${files.length} 枚）／フォルダ ${dir}`);
  const out = [];
  await Promise.all(keys.map(async (key) => {
    const imgs = groups.get(key).sort((a, b) => a.n - b.n);
    const ansPath = path.join(dir, key + '.answer.json');
    const ans = existsSync(ansPath) ? JSON.parse(readFileSync(ansPath, 'utf8')) : null;
    const hint = ans && ans.hint && ans.hint.year && ans.hint.month ? { year: ans.hint.year, month: ans.hint.month } : null;
    let now = hint ? new Date(Date.UTC(hint.year, hint.month - 1, 15)) : NOW;
    const pagesOut = [];
    let tail = [];
    for (let i = 0; i < imgs.length; i++) {
      const fp = path.join(dir, imgs[i].f);
      const mime = /\.png$/i.test(fp) ? 'image/png' : /\.webp$/i.test(fp) ? 'image/webp' : 'image/jpeg';
      const pr = await prepImage(browser, readFileSync(fp), mime);
      const body = buildRequest(pr.b64, 'image/jpeg', { page: i + 1, pages: imgs.length, tail });
      const rep = await readOne(`dir:${imgs[i].f}`, body);
      if (!rep || !rep.raw) { pagesOut.push({ f: imgs[i].f, rep, err: rep ? rep.code : 'dry', px: `${pr.w}×${pr.h}` }); tail = []; continue; }
      let res = sanitize(rep.raw, { page: i + 1, hint, tail, now });
      let shifted = false;
      /* 古い見本は ±400日の窓の外に落ちる。答えの月が無いときは、印字された年の月に窓を合わせて読み直す（数え方は同じ） */
      const ym = rep.raw.month && rep.raw.month.y ? rep.raw.month
        : (Array.isArray(rep.raw.days) ? rep.raw.days : []).map((d) => (d && d.y && d.m ? { y: d.y, m: d.m } : null)).find(Boolean);
      if (!hint && !res.roster.days.length && res.checks.dropped_days > 0 && ym) {
        now = new Date(Date.UTC(ym.y, (ym.m || 6) - 1, 15));
        res = sanitize(rep.raw, { page: i + 1, hint, tail, now });
        shifted = true;
      }
      tail = sanitizeTail(res.roster.days, now);
      pagesOut.push({ f: imgs[i].f, rep, out: res, px: `${pr.w}×${pr.h}`, shifted });
    }
    out.push({ key, ans, pagesOut });
  }));
  out.sort((a, b) => a.key.localeCompare(b.key));
  console.log('\n── 見本ごと ───────────────────────────────────────────────────────────────');
  for (const { key, ans, pagesOut } of out) {
    for (const p of pagesOut) {
      if (!p.out) { console.log(`  ${p.f}  💥 ${p.err} (${p.px})`); rowsOut.push({ tag: key, err: p.err }); continue; }
      const r = p.out.roster, ch = p.out.checks;
      const codes = [...new Set(r.days.map((d) => d.code).filter(Boolean))];
      const toks = [...new Set(r.days.flatMap((d) => d.legs.flatMap((l) => [l.flight, l.role, l.loc].filter(Boolean))))];
      const span = r.days.length ? `${r.days[0].date}〜${r.days[r.days.length - 1].date}` : '—';
      console.log(`  ${p.f} (${p.px}) 日 ${r.days.length}（${span}）区間 ${ch.legs} ／ 日付なし ${ch.undated} 捨てた日/区間/欄 ${ch.dropped_days}/${ch.dropped_legs}/${ch.dropped_fields}`
        + ` cut ${ch.cut_days} partial ${ch.partial_legs} 記号の置き換え ${ch.code_mapped} anchor=${ch.anchor} hints=${JSON.stringify(r.hints)}${p.shifted ? '（窓を印字の年へ）' : ''}  $${(p.rep.usd || 0).toFixed(4)} ${((p.rep.ms || 0) / 1000).toFixed(0)}s`);
      console.log(`      記号 ${codes.join(' ') || '—'} ／ 便・役割・場所 ${toks.slice(0, 24).join(' ') || '—'}`);
    }
    const okPages = pagesOut.filter((p) => p.out);
    let R = null;
    if (okPages.length === 1) R = okPages[0].out.roster;
    else if (okPages.length > 1 && ENGINE) { const mg = ENGINE.mergePages(okPages.map((p) => p.out.roster)); R = { days: mg.days, period: mg.period, hints: mg.hints }; }
    else if (okPages.length > 1) console.log('      merge: skipped (engine not ready)');
    if (ans && R) {
      const TR = { days: normAnswer(ans), hdr: null };
      const sc = scorePage(TR, R, { vis: null, complete: ans.complete === true });
      const leakS = leakHits(ans.pii_tokens || [], R);
      const leakR = leakHits(ans.pii_tokens || [], okPages.map((p) => p.rep.raw));
      line(`  ↳ ${key.slice(0, 15)}`, sc, null, leakS, leakR, 0, `（部分の答えで採点${normAnswer.unrep ? `・語だけの記号で出せない日 ${normAnswer.unrep} は外した` : ''}）`);
      for (const x of leakS) console.log(`    🔓 名前・番号が答えに出た: ${x}`);
      for (const n of sc.notes.slice(0, 25)) console.log('  ' + n);
    } else if (R) {
      rowsOut.push({ tag: key, sc: null, leakS: [], leakR: [] });
    }
  }
  return out;
}

/* ═══ 実行 ═══════════════════════════════════════════════════════ */
const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
try {
  if (SAMPLES) await runDir(browser, path.resolve(SAMPLES));
  else await runSynthetic(browser);
} finally { await browser.close(); }

if (stopped) console.log(`\n⏹  上限 $${BUDGET.toFixed(2)} に届きそうなので、残りを送らずに止めました`);
if (!DRY || RESCORE) {
  const done = rowsOut.filter((r) => r.sc);
  const sum = (k) => done.reduce((a, r) => a + r.sc[k], 0);
  const silent = sum('silent');
  const leaks = rowsOut.reduce((a, r) => a + (r.leakS ? r.leakS.length : 0), 0);
  const rawLeaks = rowsOut.reduce((a, r) => a + (r.leakR ? r.leakR.length : 0), 0);
  console.log(`\n${'═'.repeat(96)}`);
  console.log(`採点できた ${done.length} ／ 読めなかった ${rowsOut.filter((r) => r.err).length}`);
  console.log(`  日     ${sum('dHit')}/${sum('dExp')}  ${pct(sum('dHit'), sum('dExp'))}（余分な日 ${sum('dExtra')}・見えない日 ${sum('dCtx')}）`);
  console.log(`  区間   ${sum('lHit')}/${sum('lExp')}  ${pct(sum('lHit'), sum('lExp'))}（余分な区間 ${sum('lExtra')}）`);
  console.log(`  欄     ${sum('fOk')}/${sum('fExp')}  ${pct(sum('fOk'), sum('fExp'))}（空 ${sum('fMiss')}・違う ${sum('fWrong')}・見えない欄に値 ${sum('ctx')}）`);
  console.log(`  ★黙って外した ${silent}   ← この数字だけが本当の指標`);
  console.log(`  🔓 名前・番号が答えに出た ${leaks}（sanitize の前 ${rawLeaks}）   ← 0 でなければならない`);
  console.log(`  費用 この回 $${(spent - startSpent).toFixed(4)} ／ 帳面の合計 $${spent.toFixed(4)} ／ 上限 $${BUDGET.toFixed(2)}`);
  console.log(`${'═'.repeat(96)}\n`);
  process.exit(leaks ? 1 : 0);
}
