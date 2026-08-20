/* ════════════════════════════════════════════════════════════════
   eval-payslip.mjs — 明細の読み取りが「どのくらい外すか」を数字で出す

   なぜ要るか:
     明細まわりのテストは合計1,400件以上通っているが、測っているのは
     黒塗りの命中率・配管・フォームの契約であって、
     **モデルが返した数字が合っているか**は1件も見ていなかった。
     db/test-payslip-redact.mjs は偽の解析結果を注入して API を叩かない。
     db/smoke-parse-payslip.mjs --live は「earnings が0行でない」しか見ない。
     合成明細は20枚以上あり、正解の金額はこちらが作ったので全部分かっているのに、
     一度も突き合わせていなかった。だから「読み取りは完璧か」に
     「たぶん大丈夫」としか答えられなかった。**それを数字に変える。**

   何を測るか（本番と同じ経路で）:
     ブラウザを実際に動かして pay-report.html に明細を落とし、
     **ネットワークに出ていく直前の image_b64 を横取りして**それを Anthropic へ送る。
     つまり PDF の焼き直し・縮小・黒塗り・JPEG 再エンコードまで全部通った、
     本番でモデルが実際に見る絵を採点している。
     読み取り側も supabase/functions/parse-payslip/index.ts の
     systemPrompt / sanitize / reconcile を**そのまま import** して使う。
     Edge Function は経由しない＝本番の回数制限を1つも消費しない。

   出す数字:
     ★黙って外した数（silent errors）
       ＝ 金額が違う AND confidence が low でない AND 検算も ok だったもの。
       止める手立てが1つも働かなかった誤り＝そのままフォームに入って投稿される。
       **この1つの数字だけが本当の指標。**
     分類ずれ ＝ 総額は合っているが kind の内訳が違うもの。
       年収は変わらないので別に数える。
     聞き返し ＝ unmapped に落ちたもの。設計どおりの動作であって誤りではない。

   使い方（node serve.mjs が動いている状態で）:
     node db/eval-payslip.mjs                     15枚ぜんぶ  ≒$0.30
     node db/eval-payslip.mjs --id gulf           1枚だけ     ≒$0.02
     node db/eval-payslip.mjs --id oceania,latam,sea  カンマ区切りで何枚でも
     node db/eval-payslip.mjs --list              正解表を見るだけ（費用ゼロ）

   要るもの: mail-bot/.env の ANTHROPIC_API_KEY（gitignore 済み・開発用）

   ⚠️ API を実際に叩いて課金される。**デプロイ前チェックの一覧には入れない。**
      ネットワーク不要の検証は node db/test-payslip-parse.mjs が受け持つ。

   ★正解表 db/fixtures/payslips.expected.json は自動更新しない。手で直す。
     自動で書き戻すと、退化した出力がそのまま正解になって検査が死ぬ。
   ════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const FIX = path.join(DIR, 'fixtures');
const FN = '/functions/v1/parse-payslip';
const PAGE = { ja: 'http://localhost:3000/pay-report.html',
               en: 'http://localhost:3000/en/pay-report.html' };

const argv = process.argv.slice(2);
/* --id はカンマ区切りで何枚でも受ける（新しく足した様式だけ回すため）。
   ★知らない id は黙って無視しない。打ち間違えたときに「0枚が全部緑」で終わるのが
     いちばん危ない（測っていないのに測ったつもりになる）。 */
const only = (() => {
  const i = argv.indexOf('--id');
  return i >= 0 && argv[i + 1] ? argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean) : null;
})();
const listOnly = argv.includes('--list');

const EXPECTED = JSON.parse(readFileSync(path.join(FIX, 'payslips.expected.json'), 'utf8'));
if (only) {
  const unknown = only.filter((id) => !EXPECTED.slips.some((s) => s.id === id));
  if (unknown.length) {
    console.error(`❌ 正解表にない id: ${unknown.join(', ')}`);
    console.error(`   ある id: ${EXPECTED.slips.map((s) => s.id).join(' ')}`);
    process.exit(1);
  }
}
const slips = EXPECTED.slips.filter((s) => !only || only.includes(s.id));

if (listOnly) {
  console.log('\n正解表（db/fixtures/payslips.expected.json）— 数字はすべて作り話\n');
  for (const s of EXPECTED.slips) {
    console.log(`── ${s.id}  [${s.lang}]  ${s.file}`);
    console.log(`   ${s.note}`);
    console.log(`   支給合計 ${s.gross_total} / 控除 ${s.deductions_total} / 手取り ${s.net_pay}`);
    console.log(`   ${Object.entries(s.kinds).map(([k, v]) => `${k}=${v}`).join(' ')}`);
    console.log(`   時間 ${Object.entries(s.hours).map(([k, v]) => `${k}=${v}`).join(' ')}\n`);
  }
  process.exit(0);
}

/* ── .env（translate-eval.mjs と同じ読み方）── */
const envPath = path.join(ROOT, 'mail-bot/.env');
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

/* ── 本体をそのまま読み込む（写経した複製を測らない）── */
globalThis.Deno = { env: { get: (k) => process.env[k] ?? '' }, serve: () => {} };
const { systemPrompt, sanitize, reconcile, applyChecks, isCountRow } =
  await import('../supabase/functions/parse-payslip/index.ts');

/* 分類できなかった行のうち「金額の行」だけ。乗務日数・SECTORS のような
   回数の行は年収に足さない（画面 payslip.js の apply() と同じ判定を使う）。 */
const unmappedMoney = (r) => (r.unmapped || []).filter(
  (u) => u && typeof u.amount === 'number' && u.amount && !u.count && !isCountRow(u.label, u.amount));

/* ═══ 送る画像を、本番と同じ道で作る ═══════════════════════════ */
async function capturePayload(browser, slip) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1400, deviceScaleFactor: 1 });
  /* ★その国のパイロットの端末を再現する。
     payslip.js の extraLang() は navigator.languages を見て OCR の字形データを
     1つだけ足す（zh→chi_sim / ko→kor）。検査のブラウザは既定で en-US なので、
     これが無いと中国・韓国の様式だけ手がかりが取れず、
     **実際には起きない落ち方**を測ることになる。
     独仏はラテン文字なので既定の eng で読める＝この行があってもなくても同じ。 */
  if (slip.locale) {
    const langs = [slip.locale, slip.locale.split('-')[0], 'en-US'];
    await page.setExtraHTTPHeaders({ 'Accept-Language': langs.join(',') });
    await page.evaluateOnNewDocument((ls) => {
      Object.defineProperty(navigator, 'languages', { get: () => ls });
      Object.defineProperty(navigator, 'language', { get: () => ls[0] });
    }, langs);
  }
  let sent = null;
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (!u.includes(FN)) return req.continue();
    if (req.method() === 'OPTIONS') {
      return req.respond({ status: 204, body: '', headers: { 'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
    }
    try { sent = JSON.parse(req.postData() || '{}'); } catch { sent = null; }
    /* 読み取りはここではなく、この下で直接 Anthropic に投げる。
       画面には「読めませんでした」が出るが、欲しいのはバイト列なので構わない。 */
    req.respond({ status: 200, body: JSON.stringify({ ok: false, reason: 'read_failed' }),
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  });

  await page.goto(PAGE[slip.lang] || PAGE.ja, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 400));

  /* ★明細の欄は最初 hidden。入口カード（明細を落とす／手で入れる）を押すと出てくる。
     押さずに隠れた #ps-file へ落とすと、確認画面が高さ0で描かれてボタンが押せない。 */
  await page.waitForSelector('#entry-payslip', { timeout: 10000 });
  await page.click('#entry-payslip');
  await page.waitForFunction(() => {
    const n = document.getElementById('ps');
    return !!n && !n.hidden && n.offsetHeight > 0;
  }, { timeout: 10000 });

  const input = await page.$('#ps-file');
  await input.uploadFile(path.join(FIX, slip.file));
  await page.waitForSelector('.ps-edit', { timeout: 40000 });
  // 黒塗りの探索が終わる＝確認チェックが押せるようになる（初回は学習データ 8.7MB）
  await page.waitForFunction(() => {
    const c = document.getElementById('ps-confirm');
    return !!c && !c.disabled;
  }, { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 250));
  await page.click('#ps-confirm');
  await page.click('#ps-send');
  await page.waitForFunction(() => !!document.querySelector('.ps-res, .ps-msg-warn'), { timeout: 20000 })
    .catch(() => {});
  await page.close();
  return sent;
}

/* ═══ 読み取り（Edge Function を経由しない）═══════════════════ */
async function readSlip(payload) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      system: systemPrompt(payload.lang),
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: payload.mime, data: payload.image_b64 } },
          { type: 'text', text: 'Return the JSON object described in the system prompt. Nothing else.' },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const data = await res.json();
  const text = (data?.content ?? []).map((c) => c.text ?? '').join('').trim();
  const raw = text.startsWith('{') ? text : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const parsed = sanitize(JSON.parse(raw));
  return applyChecks(parsed, reconcile(parsed));
}

/* ═══ 採点 ═══════════════════════════════════════════════════ */
/* 金額の許容差は index.ts の検算と同じ考え方（1通貨単位 か 0.5%）。
   時間は 0.1 まで（sanitize が小数第1位に丸めている）。 */
const near = (a, b, tol) => a !== null && b !== null && Math.abs(a - b) <= tol;
/* 配列の期待値＝どれでも正解（通貨記号が印字されていない明細、
   仏の Cumul annuel を年初来と取るか null と取るかなど、どちらも嘘ではない場合）。 */
const anyOf = (want) => (Array.isArray(want) ? want : [want]);
const one = (got, want) => {
  if (want === null) return got === null;
  if (typeof got !== 'number') return false;
  return near(got, want, Math.max(1, Math.abs(want) * 0.005));
};
const moneyOk = (got, want) => anyOf(want).some((w) => one(got, w));
const scalarOk = (got, want) => anyOf(want).some((w) => (w === null ? got === null : got === w));
const pStr = (p) => (p ? `${p.year}/${p.month}` : 'null');
const periodOk = (got, want) => anyOf(want).some((w) => pStr(got) === pStr(w));

function score(slip, r) {
  const money = [];    // 金額そのものの誤り＝収入が変わる
  const cls = [];      // 分類ずれ＝総額は合っているが内訳が違う
  const asked = [];    // unmapped に落ちた＝設計どおり本人に聞き返す

  // ① 通貨・対象月
  if (!scalarOk(r.currency, slip.currency)) money.push(`通貨 ${r.currency}（正 ${anyOf(slip.currency).join('か')}）`);
  if (!periodOk(r.period, slip.period)) {
    money.push(`対象月 ${pStr(r.period)}（正 ${anyOf(slip.period).map(pStr).join('か')}）`);
  }

  // ② 印字された合計 3つ
  for (const k of ['gross_total', 'deductions_total', 'net_pay', 'ytd_taxable']) {
    if (!moneyOk(r[k], slip[k])) money.push(`${k} ${r[k]}（正 ${slip[k]}）`);
  }

  /* ③ 支給の総額（分類をまたいだ合計。分類ずれでは動かない）
     ★unmapped も足す（2026-08-14）。分類できなかった行も画面は「未分類の支給」として
       年収に数えるようになったので、ここで足さないと**測る側だけが古くなり**、
       名前を知らない手当が1つ出るたびに「金額を外した」と嘘の赤が出る。
       外したのは分類であって金額ではない、を④と⑤の切り分けのまま保つ。 */
  const gotSum = Math.round(
    [...(r.earnings || []), ...unmappedMoney(r)].reduce((a, e) => a + e.amount, 0) * 100) / 100;
  const wantSum = Math.round(Object.values(slip.kinds).reduce((a, v) => a + v, 0) * 100) / 100;
  if (!moneyOk(gotSum, wantSum)) money.push(`支給の総額 ${gotSum}（正 ${wantSum}）`);

  // ④ kind ごとの内訳
  const byKind = {};
  for (const e of r.earnings || []) byKind[e.kind] = (byKind[e.kind] || 0) + e.amount;
  const kinds = new Set([...Object.keys(slip.kinds), ...Object.keys(byKind)]);
  let kindHit = 0;
  for (const k of kinds) {
    const want = slip.kinds[k] ?? null, got = k in byKind ? Math.round(byKind[k] * 100) / 100 : null;
    if (want !== null && got !== null && moneyOk(got, want)) { kindHit++; continue; }
    if (want !== null && got === null) {
      const amt = (r.unmapped || []).some((u) => moneyOk(u.amount, want));
      (amt ? asked : cls).push(`${k} が無い（正 ${want}${amt ? '／unmapped にある' : ''}）`);
    } else if (want === null) cls.push(`余分な ${k}=${got}`);
    else cls.push(`${k} ${got}（正 ${want}）`);
  }

  // ⑤ 時間（時給の分母。ここが外れると時給が直接ずれる）
  const byHour = {};
  for (const h of r.hours || []) byHour[h.kind] = h.value;
  let hourHit = 0;
  const hourKinds = new Set([...Object.keys(slip.hours), ...Object.keys(byHour)]);
  for (const k of hourKinds) {
    const want = slip.hours[k] ?? null, got = byHour[k] ?? null;
    if (want !== null && near(got, want, 0.1)) { hourHit++; continue; }
    money.push(want === null ? `余分な時間 ${k}=${got}` : `時間 ${k} ${got}（正 ${want}）`);
  }

  /* ⑥ must_not ＝ これを返したら大事故（年初来の列・単価の列・桁区切りの取り違え・通貨の誤り）。
     ★ここは①〜⑤の「違っている」とは別に数える。桁と通貨の誤りは、支給の各行も
       印字された合計も同じ倍率でずれるので**検算を両方すり抜ける**。
       ①〜⑤には出ても confidence は high のままで、拾い上げる手立てがここしかない。 */
  const fatal = [];
  const mn = slip.must_not || {};
  // 通貨の取り違えは金額そのものは1円も動かないのに年収が何倍もずれる（人民元の ¥ が典型）
  if ('currency' in mn && r.currency === mn.currency) fatal.push(`通貨=${mn.currency}`);
  for (const [k, v] of Object.entries(mn.kinds || {})) if (moneyOk(byKind[k] ?? null, v)) fatal.push(`${k}=${v}`);
  for (const [k, v] of Object.entries(mn.hours || {})) if (near(byHour[k] ?? null, v, 0.05)) fatal.push(`時間 ${k}=${v}`);
  if ('gross_total' in mn && moneyOk(r.gross_total, mn.gross_total)) fatal.push(`gross_total=${mn.gross_total}`);
  if (mn.period && r.period && r.period.year === mn.period.year && r.period.month === mn.period.month) {
    fatal.push(`対象月=${mn.period.year}/${mn.period.month}`);
  }

  /* ★黙って外した ＝ 金額が違うのに、confidence も検算も何も言わなかった。
     止める手立てが1つも働かなかった誤り。そのままフォームに入って投稿される。 */
  const loud = r.confidence === 'low' || r.checks?.gross === 'mismatch' || r.checks?.net === 'mismatch';
  return {
    money, cls, asked, fatal, loud,
    silent: (money.length > 0 || fatal.length > 0) && !loud,
    kindHit, kindAll: Object.keys(slip.kinds).length,
    hourHit, hourAll: Object.keys(slip.hours).length,
  };
}

/* ═══ 実行 ═══════════════════════════════════════════════════ */
try {
  const probe = await fetch('http://localhost:3000/pay-report.html');
  if (!probe.ok) throw new Error(String(probe.status));
} catch {
  console.error('❌ localhost:3000 が応答しません。先に `node serve.mjs` を起動してください。');
  process.exit(1);
}

console.log(`\n明細 ${slips.length} 枚を本番と同じ経路で読ませます（≒$${(slips.length * 0.02).toFixed(2)}）\n`);
const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const rows = [];

for (const slip of slips) {
  process.stdout.write(`  ${slip.id.padEnd(14)} 画像を作成中…`);
  let payload, r, err = null;
  try {
    payload = await capturePayload(browser, slip);
    if (!payload?.image_b64) throw new Error('画像が送信されなかった');
    process.stdout.write(`\r  ${slip.id.padEnd(14)} 読み取り中…（${Math.round(payload.image_b64.length / 1024)}KB）   `);
    r = await readSlip(payload);
  } catch (e) { err = e.message; }
  const s = r ? score(slip, r) : null;
  rows.push({ slip, r, s, err, kb: payload ? Math.round(payload.image_b64.length / 1024) : 0 });
  const mark = err ? '💥' : s.fatal.length ? '🚨' : s.silent ? '❌' : s.money.length ? '⚠️ ' : s.cls.length ? '△' : '✅';
  console.log(`\r  ${slip.id.padEnd(14)} ${mark}${' '.repeat(24)}`);
}
await browser.close();

// ── 表 ──────────────────────────────────────────────────────
const H = ['id', '通貨', '対象月', '支給合計', '手取り', 'kind', '時間', '検算', 'conf', '判定'];
const W = [14, 5, 7, 9, 9, 6, 6, 9, 7, 0];
const cell = (v, i) => String(v).padEnd(W[i]);
console.log('\n' + H.map(cell).join(' '));
console.log('─'.repeat(84));
const yn = (b) => (b ? '✅' : '❌');
for (const { slip, r, s, err } of rows) {
  if (err) { console.log(`${cell(slip.id, 0)} 💥 ${err}`); continue; }
  const verdict = s.fatal.length ? `🚨 大事故 ${s.fatal.join(' / ')}`
    : s.silent ? '❌ 黙って外した'
    : s.money.length ? '⚠️  外したが検算が拾った'
    : s.cls.length ? '△ 分類ずれ（総額は合っている）'
    : '✅';
  console.log([
    slip.id, yn(scalarOk(r.currency, slip.currency)), yn(periodOk(r.period, slip.period)),
    yn(moneyOk(r.gross_total, slip.gross_total)), yn(moneyOk(r.net_pay, slip.net_pay)),
    `${s.kindHit}/${s.kindAll}`, `${s.hourHit}/${s.hourAll}`,
    r.checks?.gross === 'mismatch' || r.checks?.net === 'mismatch' ? 'NG' : (r.checks?.gross ?? '-'),
    r.confidence, verdict,
  ].map(cell).join(' '));
}

// ── 中身 ────────────────────────────────────────────────────
for (const { slip, s, err } of rows) {
  if (err || (!s.money.length && !s.cls.length && !s.asked.length && !s.fatal.length)) continue;
  console.log(`\n── ${slip.id}`);
  for (const m of s.fatal) console.log(`   🚨 大事故: ${m}`);
  for (const m of s.money) console.log(`   金額: ${m}`);
  for (const m of s.cls) console.log(`   分類: ${m}`);
  for (const m of s.asked) console.log(`   聞き返し（設計どおり）: ${m}`);
}

// ── まとめ ──────────────────────────────────────────────────
const done = rows.filter((x) => !x.err);
const silent = done.filter((x) => x.s.silent).length;
const caught = done.filter((x) => !x.s.silent && (x.s.money.length || x.s.fatal.length)).length;
const clsOnly = done.filter((x) => !x.s.money.length && !x.s.fatal.length && x.s.cls.length).length;
const clean = done.filter((x) => !x.s.money.length && !x.s.fatal.length && !x.s.cls.length).length;
console.log(`\n${'═'.repeat(84)}`);
console.log(`読めた ${done.length}/${rows.length} 枚`);
console.log(`  ✅ 全部合っていた            ${clean}`);
console.log(`  △ 分類ずれだけ（年収は同じ） ${clsOnly}`);
console.log(`  ⚠️  外したが検算/低確信が拾った ${caught}`);
console.log(`  ❌ ★黙って外した             ${silent}   ← この数字だけが本当の指標`);
if (rows.length - done.length) console.log(`  💥 読めなかった              ${rows.length - done.length}`);
/* ★分類できなかった行の数（2026-08-14）。採点には入れない。
   金額は数えているので年収は正しく、レポートも完成する（＝誤りではない）。
   ただし1行につき1問だけ本人に確認が出るので、**手間の量**として見えるようにする。
   ここが減っていくのが、語彙を足した効果とラベル辞書が育った効果の両方。 */
const askedRows = done.reduce((a, x) => a + unmappedMoney(x.r).length, 0);
const askedSlips = done.filter((x) => unmappedMoney(x.r).length).length;
console.log(`  ─ 分類できず本人に聞いた行   ${askedRows} 行 / ${askedSlips} 枚（金額は数えている＝年収は正しい）`);
console.log(`${'═'.repeat(84)}\n`);
process.exit(silent || rows.length - done.length ? 1 : 0);
