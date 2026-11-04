/* ════════════════════════════════════════════════════════════════
   eval-payslip.mjs — 明細の読み取りが「どのくらい外すか」を数字で出す

   なぜ要るか:
     明細まわりのテストは合計1,400件以上通っているが、測っているのは
     黒塗りの命中率・配管・フォームの契約であって、
     **モデルが返した数字が合っているか**は1件も見ていなかった。
     db/test-payslip-flow.mjs は偽の解析結果を注入して API を叩かない（2026-11-04 まで db/test-payslip-redact.mjs）。
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
     node db/eval-payslip.mjs                     16枚ぜんぶ  ≒$0.30
     node db/eval-payslip.mjs --id gulf           1枚だけ     ≒$0.02
     node db/eval-payslip.mjs --id oceania,latam,sea  カンマ区切りで何枚でも
     node db/eval-payslip.mjs --list              正解表を見るだけ（費用ゼロ）

   ★2026-11-04 に足した口（旧い頼み方と比べるため）:
     --variant off,old     頼み方を並べて同じ画像で読ませる（カンマ区切り・既定は off）
         off   … 本番の頼み方（index.ts の buildRequest の既定＝考える処理なし・構造化出力・上限 8000）
         low   … 考える処理あり（effort low）・構造化出力・上限 8000
         adapt … 考える処理あり（effort 既定）・構造化出力・上限 8000
         old   … 2026-11-04 より前の頼み方そのもの（--old-ref の版の index.ts を読み込んで、
                 その systemPrompt・上限 2000・考える処理の指定なし・括弧を切り出す読み方で再現）
     --old-ref <git の版>  old に使う版（既定 11af0204 ＝ 作り直す直前の main）
     --direct              画面を通さず、正解表の PNG をそのまま送る（PDF は飛ばす）
     --base <URL>          画面の置き場所（既定 http://localhost:3000）
     --budget <ドル>       この費用を超えそうなら次の1回を送らずに止める（既定 0.50）
     --ledger <ファイル>   使った費用を足し込んでいく帳面（回をまたいで上限を守る）
     費用は返事のトークン数から数える（入力 $2・出力 $10 ／ 100万トークン）。

   要るもの: mail-bot/.env の ANTHROPIC_API_KEY（gitignore 済み・開発用）

   ⚠️ API を実際に叩いて課金される。**デプロイ前チェックの一覧には入れない。**
      ネットワーク不要の検証は node db/test-payslip-parse.mjs が受け持つ。

   ★正解表 db/fixtures/payslips.expected.json は自動更新しない。手で直す。
     自動で書き戻すと、退化した出力がそのまま正解になって検査が死ぬ。
   ════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from 'fs';
import { execFileSync } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const FIX = path.join(DIR, 'fixtures');
const FN = '/functions/v1/parse-payslip';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = opt('--base', 'http://localhost:3000').replace(/\/$/, '');
const PAGE = { ja: BASE + '/pay-report.html', en: BASE + '/en/pay-report.html' };
const DIRECT = argv.includes('--direct');
const VARIANTS = opt('--variant', 'off').split(',').map((x) => x.trim()).filter(Boolean);
const OLD_REF = opt('--old-ref', '11af0204');
const BUDGET = Number(opt('--budget', '0.50'));
const LEDGER = opt('--ledger', null);
/* --save <ファイル> … 読めた結果（sanitize 後の形）と時間・トークンを保存する。
   ★採点の規則を直したときに、お金をかけずに採点し直すため（--rescore <ファイル>）。 */
const SAVE = opt('--save', null);
const RESCORE = opt('--rescore', null);
/* 料金（ドル / トークン）。このモデルの公開価格。返事の usage から1回ずつ数える。 */
const PRICE = { in: 2 / 1e6, out: 10 / 1e6 };
const KNOWN = ['off', 'low', 'adapt', 'old'];
if (VARIANTS.some((v) => !KNOWN.includes(v))) {
  console.error(`❌ --variant は ${KNOWN.join(' / ')} のどれか（カンマ区切り）`);
  process.exit(1);
}
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
const slips = EXPECTED.slips.filter((s) => !only || only.includes(s.id))
  .filter((s) => !DIRECT || /\.png$/i.test(s.file));
/* 明細に印字してある氏名・社員番号・口座（黒塗りの正解表 payslips.json の pii）。
   ★答えのどこかにこれが1つでも出たら「漏れ」として数える（2026-11-04）。 */
const PII = Object.fromEntries(JSON.parse(readFileSync(path.join(FIX, 'payslips.json'), 'utf8'))
  .map((f) => [f.file, (f.pii || []).map((p) => p.text)]));
const squash = (t) => String(t).replace(/[\s　]+/g, '');
/* ★照合の単位（2026-11-04 に1回誤検知して直した）:
     ・数字は5けた以上の並びだけ（社員番号・口座番号）。4けた以下（支店番号 200・銀行コード 0009）は
       金額や年号と区別がつかないので見ない ── 見ると「200,000円」で漏れと数えてしまう。
     ・字の部分は空白で区切った1語ずつ（姓だけ・名だけが出ても漏れ）。数字と記号だけの語は上の規則に任せる。 */
function leaks(file, result) {
  const out = squash(JSON.stringify(result));
  const hits = [];
  for (const t of PII[file] || []) {
    const parts = [
      ...(String(t).match(/\d{5,}/g) || []),
      ...String(t).split(/[\s　]+/).filter((w) => w.length >= 2 && /[^\d\-.,()]/.test(w)),
    ];
    for (const p of parts) if (out.includes(squash(p))) { hits.push(p); break; }
  }
  return hits;
}

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
const { systemPrompt, sanitize, reconcile, applyChecks, isCountRow, buildRequest, readReply } =
  await import('../supabase/functions/parse-payslip/index.ts');

/* ★旧い頼み方は、その版の index.ts をそのまま読み込んで再現する（写さない）。 */
let OLD = null;
if (VARIANTS.includes('old')) {
  const src = execFileSync('git', ['show', `${OLD_REF}:supabase/functions/parse-payslip/index.ts`],
                           { cwd: ROOT, encoding: 'utf8' });
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pv-old-parse-'));
  const file = path.join(dir, 'index.ts');
  writeFileSync(file, src);
  OLD = { ...(await import(file)), model: (src.match(/const MODEL = '([a-z0-9-]+)'/) || [])[1] };
}

/* ── 費用の帳面 ── */
let spent = 0;
if (LEDGER && existsSync(LEDGER)) spent = Number(JSON.parse(readFileSync(LEDGER, 'utf8')).usd) || 0;
const charge = (u) => {
  const usd = (u?.input_tokens || 0) * PRICE.in + (u?.output_tokens || 0) * PRICE.out;
  spent += usd;
  if (LEDGER) writeFileSync(LEDGER, JSON.stringify({ usd: Math.round(spent * 1e6) / 1e6, at: new Date().toISOString() }));
  return usd;
};
const NEXT_MAX = 0.04;   // 1回で使いうる上限の見積もり（画像≒5千トークン＋答え≒2千トークンでも $0.03 未満）

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
  /* ★2026-11-04 から、選んだらそのまま読み取りに送られる（黒塗りと確認の画面は無い）。 */
  const t0 = Date.now();
  while (!sent && Date.now() - t0 < 30000) await new Promise((r) => setTimeout(r, 100));
  await page.close();
  return sent;
}

/* ═══ 読み取り（Edge Function を経由しない）═══════════════════ */
/* 頼み方ごとの要求。off/low/adapt は本番の buildRequest、old は旧い版そのもの。 */
function requestFor(variant, payload) {
  if (variant === 'old') {
    return {
      model: OLD.model,
      max_tokens: 2000,
      system: OLD.systemPrompt(payload.lang),
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: payload.mime, data: payload.image_b64 } },
          { type: 'text', text: 'Return the JSON object described in the system prompt. Nothing else.' },
        ],
      }],
    };
  }
  const o = variant === 'low' ? { thinking: 'adaptive', effort: 'low' }
    : variant === 'adapt' ? { thinking: 'adaptive' } : {};
  return buildRequest(payload.image_b64, payload.mime, payload.lang, o);
}

/* 1回読ませる。★返すのは結果と「なぜ失敗したか」の固定の語・stop_reason・トークン・時間。 */
async function readSlip(variant, payload) {
  const t0 = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestFor(variant, payload)),
  });
  const ms = Date.now() - t0;
  if (!res.ok) {
    let t = ''; try { t = (await res.json())?.error?.type || ''; } catch { /* 本文は見ない */ }
    return { ms, code: `upstream_${res.status}${t ? ':' + t : ''}`, stop: '', it: 0, ot: 0, usd: 0 };
  }
  const data = await res.json();
  const usd = charge(data.usage);
  const base = { ms, stop: data.stop_reason || '', it: data.usage?.input_tokens || 0,
                 ot: data.usage?.output_tokens || 0, usd };
  if (variant === 'old') {
    /* ★旧い読み方そのまま（括弧を切り出す）。失敗の理由は stop_reason から後で分ける。 */
    try {
      const text = (data?.content ?? []).map((c) => c.text ?? '').join('').trim();
      const raw = text.startsWith('{') ? text : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const parsed = OLD.sanitize(JSON.parse(raw));
      return { ...base, code: 'ok', r: OLD.applyChecks(parsed, OLD.reconcile(parsed)) };
    } catch {
      return { ...base, code: base.stop === 'max_tokens' ? 'read_truncated' : 'read_bad_format' };
    }
  }
  const got = readReply(data);
  if (!got.ok) return { ...base, code: got.code };
  const parsed = sanitize(got.raw);
  return { ...base, code: 'ok', r: applyChecks(parsed, reconcile(parsed)) };
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
if (!DIRECT) {
  try {
    const probe = await fetch(PAGE.ja);
    if (!probe.ok) throw new Error(String(probe.status));
  } catch {
    console.error(`❌ ${BASE} が応答しません。先に画面のサーバーを起動してください（または --direct）。`);
    process.exit(1);
  }
}

if (RESCORE) {
  const saved = JSON.parse(readFileSync(RESCORE, 'utf8'));
  globalThis.__RESCORED = saved.map((z) => {
    const slip = EXPECTED.slips.find((s) => s.id === z.id);
    const s = z.r ? score(slip, z.r) : null;
    return { slip, variant: z.variant, x: z.x, r: z.r, s, err: z.err, leak: z.r ? leaks(slip.file, z.r) : [] };
  });
}
if (!RESCORE) console.log(`\n明細 ${slips.length} 枚 × 頼み方 ${VARIANTS.join('/')}（${DIRECT ? 'PNG をそのまま' : '画面と同じ経路'}）`);
console.log(`   上限 $${BUDGET.toFixed(2)} ／ これまでに使った分 $${spent.toFixed(4)}\n`);
const browser = (DIRECT || RESCORE) ? null : await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const rows = RESCORE ? globalThis.__RESCORED : [];
let stopped = false;

for (const slip of (RESCORE ? [] : slips)) {
  let payload = null, perr = null;
  try {
    if (DIRECT) {
      payload = { image_b64: readFileSync(path.join(FIX, slip.file)).toString('base64'), mime: 'image/png', lang: slip.lang };
    } else {
      payload = await capturePayload(browser, slip);
      if (!payload?.image_b64) throw new Error('画像が送信されなかった');
    }
  } catch (e) { perr = e.message; }
  for (const variant of VARIANTS) {
    if (perr) { rows.push({ slip, variant, err: perr }); continue; }
    if (spent + NEXT_MAX > BUDGET) { stopped = true; break; }
    process.stdout.write(`  ${slip.id.padEnd(14)} ${variant.padEnd(6)} 読み取り中…`);
    let x, err = null;
    try { x = await readSlip(variant, payload); } catch (e) { err = String(e.message).slice(0, 80); }
    const r = x && x.r;
    const s = r ? score(slip, r) : null;
    const leak = r ? leaks(slip.file, r) : [];
    rows.push({ slip, variant, x, r, s, err: err || (x && x.code !== 'ok' ? x.code : null), leak,
                kb: Math.round(payload.image_b64.length / 1024) });
    const mark = (err || !r) ? '💥' : leak.length ? '🔓' : s.fatal.length ? '🚨' : s.silent ? '❌'
      : s.money.length ? '⚠️ ' : s.cls.length ? '△' : '✅';
    console.log(`\r  ${slip.id.padEnd(14)} ${variant.padEnd(6)} ${mark} ${x ? `${(x.ms / 1000).toFixed(1)}s stop=${x.stop || '-'} out=${x.ot} $${x.usd.toFixed(4)}` : ''}${err ? ' ' + err : (x && x.code !== 'ok' ? ' ' + x.code : '')}`);
  }
  if (stopped) break;
}
if (browser) await browser.close();
if (SAVE) writeFileSync(SAVE, JSON.stringify(rows.map((x) => ({ id: x.slip.id, variant: x.variant, x: x.x
  ? { ms: x.x.ms, stop: x.x.stop, it: x.x.it, ot: x.x.ot, usd: x.x.usd, code: x.x.code } : null, r: x.r || null, err: x.err || null })), null, 1));
if (stopped) console.log(`\n⏹  上限 $${BUDGET.toFixed(2)} に届きそうなので、ここで止めました（使った分 $${spent.toFixed(4)}）`);

// ── 表 ──────────────────────────────────────────────────────
const H = ['id', '通貨', '対象月', '支給合計', '手取り', 'kind', '時間', '検算', 'conf', '判定'];
const W = [14, 5, 7, 9, 9, 6, 6, 9, 7, 0];
const cell = (v, i) => String(v).padEnd(W[i]);
console.log('\n' + H.map(cell).join(' '));
console.log('─'.repeat(84));
const yn = (b) => (b ? '✅' : '❌');
for (const { slip, variant, r, s, err } of rows) {
  if (!r) { console.log(`${cell(slip.id + ' ' + variant, 0)} 💥 ${err}`); continue; }
  const verdict = s.fatal.length ? `🚨 大事故 ${s.fatal.join(' / ')}`
    : s.silent ? '❌ 黙って外した'
    : s.money.length ? '⚠️  外したが検算が拾った'
    : s.cls.length ? '△ 分類ずれ（総額は合っている）'
    : '✅';
  console.log([
    (slip.id + ' ' + variant).slice(0, 14), yn(scalarOk(r.currency, slip.currency)), yn(periodOk(r.period, slip.period)),
    yn(moneyOk(r.gross_total, slip.gross_total)), yn(moneyOk(r.net_pay, slip.net_pay)),
    `${s.kindHit}/${s.kindAll}`, `${s.hourHit}/${s.hourAll}`,
    r.checks?.gross === 'mismatch' || r.checks?.net === 'mismatch' ? 'NG' : (r.checks?.gross ?? '-'),
    r.confidence, verdict,
  ].map(cell).join(' '));
}

// ── 中身 ────────────────────────────────────────────────────
for (const { slip, variant, s, r, leak } of rows) {
  if (!r || (!s.money.length && !s.cls.length && !s.asked.length && !s.fatal.length && !leak.length)) continue;
  console.log(`\n── ${slip.id}（${variant}）`);
  for (const m of leak) console.log(`   🔓 明細の個人情報が答えに出た: ${m.slice(0, 2)}…`);
  for (const m of s.fatal) console.log(`   🚨 大事故: ${m}`);
  for (const m of s.money) console.log(`   金額: ${m}`);
  for (const m of s.cls) console.log(`   分類: ${m}`);
  for (const m of s.asked) console.log(`   聞き返し（設計どおり）: ${m}`);
}

// ── まとめ ──────────────────────────────────────────────────
const done = rows.filter((x) => x.r);
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
/* ── 頼み方ごとの比べ（2026-11-04）── */
console.log('\n頼み方ごと（読めた枚数・失敗の理由・時間・答えのトークン・費用・漏れ）');
for (const v of VARIANTS) {
  const vs = rows.filter((x) => x.variant === v && x.x);
  if (!vs.length) continue;
  const okN = vs.filter((x) => x.r).length;
  const codes = {};
  for (const x of vs) if (!x.r) codes[x.x.code] = (codes[x.x.code] || 0) + 1;
  const ms = vs.map((x) => x.x.ms).sort((a, b) => a - b);
  const med = ms[Math.floor(ms.length / 2)];
  const ot = Math.round(vs.reduce((a, x) => a + x.x.ot, 0) / vs.length);
  const usd = vs.reduce((a, x) => a + x.x.usd, 0);
  const mOk = vs.filter((x) => x.r && !x.s.money.length && !x.s.fatal.length).length;
  const lk = vs.filter((x) => x.leak && x.leak.length).length;
  const stops = {};
  for (const x of vs) stops[x.x.stop || '-'] = (stops[x.x.stop || '-'] || 0) + 1;
  console.log(`  ${v.padEnd(6)} 読めた ${okN}/${vs.length}  金額すべて一致 ${mOk}/${vs.length}  中央 ${(med / 1000).toFixed(1)}s  答え平均 ${ot}トークン  $${usd.toFixed(4)}  漏れ ${lk}`
    + `  stop: ${JSON.stringify(stops)}${Object.keys(codes).length ? '  失敗: ' + JSON.stringify(codes) : ''}`);
}
console.log(`  使った費用の合計（帳面） $${spent.toFixed(4)} ／ 上限 $${BUDGET.toFixed(2)}`);
console.log(`${'═'.repeat(84)}\n`);
const leaked = rows.some((x) => x.leak && x.leak.length);
process.exit(silent || leaked || rows.length - done.length ? 1 : 0);
