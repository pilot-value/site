/* ════════════════════════════════════════════════════════════════
   db/test-payslip-flow.mjs — 明細から自動入力の通し（2026-11-04 作り直し）

   ★2026-11-04、端末の中の黒塗りと「塗った明細を確かめる画面」をやめた（オーナー判断）。
     選んだらそのまま読み取りに送り、読み取りのあいだに明細に載っていない質問へ先に進める。
     それまでの db/test-payslip-redact.mjs（黒塗りの命中率・送る枠・文字読み取りの語彙）は、
     測る相手が無くなったので外した。あちらにあった「黒塗り以外の約束」はこのファイルへ移した：
       ・送る中身の欄は3つだけ（image_b64 / lang / mime）
       ・勝手に投稿しない（submit_pay_report を呼ばない）
       ・読めた数字が正しい欄に入る（基本給・保証給・変動給の行・役割の手当・住宅・通貨・対象月…）
       ・分類できなかった行は金額を数えたうえで1問だけ聞く
       ・開けない PDF（鍵付き・XFA・白紙）は1度も送らない
       ・Edge Function のログに画像も明細の字も出さない

   見るもの（どれも「画面は普通に動いたまま静かに壊れる」形）:
     ① 選んだらすぐ読み取り、フォームはその時点で開く（行き止まりにしない）
     ② 送る画像は切り抜かずページ全体・引き伸ばさない・長辺 2560 まで
     ③ 記録（GA4）の段階が分かれている ── 同じ1回で成功と失敗の両方を記録しない
     ④ 失敗しても「もう一度読む／別の明細／手で入力」が出る・自動で送り直さない・連打で二重に読まない
     ⑤ 読み取りの途中でやめたら、あとから来た返事を画面に入れない
     ⑥ 明細を見る画面は blob（このページのメモリだけ）・localStorage に画像を置かない

   ★AI は呼ばない（parse-payslip は偽の返事に差し替える）。Supabase の DB・認証にも1本も出さない。
   使い方: node serve.mjs を動かした状態で node db/test-payslip-flow.mjs
   ════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(DIR, 'fixtures');
const TMP = mkdtempSync(path.join(tmpdir(), 'pv-payslip-'));
const BASE = 'http://localhost:3000';
const URL_JA = BASE + '/pay-report.html';
const URL_EN = BASE + '/en/pay-report.html';
const FN = '/functions/v1/parse-payslip';
let pass = 0, fail = 0;
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log(`  ✅ ${label}${extra ? ' → ' + extra : ''}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' → ' + extra : ''}`); }
};
/* 偽の解析結果。実在の明細ではないし、API も叩かない（db/test-payslip-redact.mjs から移した）。 */
const FAKE = {
  ok: true,
  result: {
    currency: 'JPY',
    period: { year: 2026, month: 7 },
    earnings: [
      { label: '基本給', amount: 420000, kind: 'base' },
      /* ★保証給は基本給とは別の列（2026-08-27）。日本＝基本給が下限、
         米国＝保証給が下限で意味が違うので、1つの列に混ぜると二度と割れない。 */
      { label: '保証給', amount: 90000, kind: 'guarantee' },
      { label: '職務手当', amount: 185000, kind: 'command' },
      /* ★basis＝何に連動する支給か。画面の10択と同じ語彙（2026-08-27）。 */
      { label: '変動付加乗務手当', amount: 148200, kind: 'flight_variable', basis: 'block' },
      { label: '深夜割増', amount: 23400, kind: 'flight_variable', basis: 'night' },
      /* ★役割ごとの手当。専用の列があるので、その他手当にも職位手当にも足し込まない。 */
      { label: '教官手当', amount: 30000, kind: 'instructor' },
      { label: '審査手当', amount: 25000, kind: 'examiner' },
      { label: '住宅手当', amount: 60000, kind: 'housing' },
      { label: '通勤手当', amount: 18000, kind: 'transport' },
      { label: '日当（非課税）', amount: 42000, kind: 'per_diem' },
    ],
    /* ★総支給を持たせる（2026-08-27）。2026-08-26 の作り直しで annualTotal() は
       **本人が入れた総支給だけ**から出すようになった（内訳を足し直さない）ので、
       ここが無いと年換算が 0 になり、時給のカードごと消える。
       本物の明細はどれも総支給を印字している（見本16枚とも `gross_total` を持つ）。
       ★内訳の合計とぴったり合わせてある＝「内訳の合計が総支給を超えています」の
         注意が出ない（出ると絵で見たときに嘘の警告に見える）。 */
    gross_total: 1053600,
    deductions_total: 221354,
    net_pay: 832246,
    hours: [
      { label: '総勤務時間', value: 168.5, kind: 'duty' },
      { label: '乗務時間', value: 78.2, kind: 'block' },
      { label: '深夜時間', value: 12.0, kind: 'night' },
      /* ★保証フライトタイム（2026-08-27）。それまでは語彙に無く、未分類にも落ちずに
         黙って捨てられていた。乗務時間 78.2 より小さくしてある＝
         annualTotal() の Math.max(f-block, f-guar) は 78.2 のまま動かない。 */
      { label: '保証時間', value: 65.0, kind: 'guarantee' },
    ],
    unmapped: [{ label: '特別加算', amount: 12000 }],
    confidence: 'high',
  },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};
const JSONH = { ...CORS, 'Content-Type': 'application/json' };
const dg = (s) => String(s == null ? '' : s).replace(/[^\d.-]/g, '');

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });

/* ★外へは1本も出さない。画面のファイル・CDN の部品（supabase-js・pdf.js・Tailwind・フォント）だけ通す。
   Supabase の DB・認証は空の返事、parse-payslip は場面ごとの偽の返事。 */
const outside = [];
async function open(url, reply, opts = {}) {
  /* ★ページごとに真っさらなブラウザの状態で開く。先に英語のページを開くと言語の好み（pv-lang）が残り、
     次の日本語のページが英語のページへ移る（2026-11-04 に、日本語のページで英語の文が出たと誤って赤くなった）。 */
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: opts.w || 390, height: 900, deviceScaleFactor: 1 });
  const seen = { calls: 0, bodies: [], rpc: [], hold: null };
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    const u = req.url();
    if (u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')) return req.continue();
    if (u.includes(FN)) {
      if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS, body: '' });
      seen.calls++;
      try { seen.bodies.push(JSON.parse(req.postData() || '{}')); } catch { seen.bodies.push(null); }
      const r = typeof reply === 'function' ? reply(seen.calls) : reply;
      if (r === 'hang') { seen.hold = req; return; }
      await new Promise((res) => setTimeout(res, r.delay || 400));
      return req.respond({ status: r.status || 200, headers: JSONH, body: JSON.stringify(r.body) });
    }
    if (/cdn\.tailwindcss\.com|cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(u)) return req.continue();
    if (u.includes('supabase.co')) {
      if (u.includes('/rest/v1/rpc/')) seen.rpc.push(u.split('/rpc/')[1].split('?')[0]);
      if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS, body: '' });
      return req.respond({ status: 200, headers: JSONH, body: '[]' });
    }
    if (!/googletagmanager|google-analytics/.test(u)) outside.push(u.slice(0, 70));
    return req.abort();
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#entry-payslip', { timeout: 15000 });
  await page.click('#entry-payslip');
  await page.waitForFunction(() => { const n = document.getElementById('ps'); return !!n && !n.hidden && n.offsetHeight > 0; }, { timeout: 10000 });
  return { page, seen, errs };
}
const upload = async (page, file) => (await page.$('#ps-file')).uploadFile(path.join(FIX, file));
const events = (page) => page.evaluate(() => (window.dataLayer || [])
  .filter((a) => a && a[0] === 'event' && /^payslip_/.test(a[1]))
  .map((a) => a[1] + (a[2] && a[2].reason ? ':' + a[2].reason : '')));

// ══ ① 選んだらすぐ読み取り・フォームが先に開く ═════════════════════
console.log('\n══ ① 選んだらすぐ読み取り・確認の画面は無い・フォームは先に開く');
{
  const { page, seen, errs } = await open(URL_JA, () => ({ body: FAKE, delay: 1500 }));
  const consent = await page.$eval('#ps-consent', (n) => ({ h: n.offsetHeight, t: n.textContent }));
  ok(consent.h > 0 && /Anthropic/.test(consent.t) && /マイナンバー/.test(consent.t),
     '★選ぶ前に、送る先と扱いの説明（同意）が見えている');
  await upload(page, 'payslip-jp-major.png');
  await page.waitForSelector('.ps-state.is-read', { timeout: 15000 });
  const mid = await page.evaluate(() => ({
    formOpen: !document.getElementById('form-body').hidden,
    cancel: !!document.getElementById('ps-cancel'),
    confirm: !!document.getElementById('ps-confirm') || !!document.getElementById('ps-send'),
    gross: (document.getElementById('f-gross') || {}).value || '',
  }));
  ok(mid.formOpen, '★読み取りのあいだにフォームが開いている（明細に無い質問へ先に進める）');
  ok(mid.cancel, '読み取り中に「やめて手で入力する」がある');
  ok(!mid.confirm, '★塗った明細を確かめる画面（確認のチェック・送るボタン）が無い');
  ok(mid.gross === '', '読み取りが終わるまで金額は入っていない（前月の下書きを混ぜていない）', mid.gross);
  await page.waitForSelector('.ps-res', { timeout: 20000 });

  // ── ② 送る中身 ──
  const sent = seen.bodies[0];
  ok(seen.calls === 1, '読み取りの呼び出しは1回', String(seen.calls));
  ok(!!sent && Object.keys(sent).sort().join(',') === 'image_b64,lang,mime',
     '★送る中身の欄は3つだけ（ファイル名などを送らない）', sent ? Object.keys(sent).join(',') : '');
  ok(sent && sent.mime === 'image/jpeg' && sent.lang === 'ja', '端末で描き直した JPEG を送る');
  if (sent && sent.image_b64) {
    const shot = await page.evaluate((b64) => new Promise((res) => {
      const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res(null);
      im.src = 'data:image/jpeg;base64,' + b64;
    }), sent.image_b64);
    const src = JSON.parse(readFileSync(path.join(FIX, 'payslips.json'), 'utf8')).find((f) => f.file === 'payslip-jp-major.png');
    const want = Math.min(2560, Math.max(src.width, src.height));
    ok(!!shot && Math.abs(Math.max(shot.w, shot.h) - want) <= 2,
       '★切り抜かず・引き伸ばさない（長辺は元の大きさか 2560 の小さいほう）', shot ? `${shot.w}×${shot.h}` : '復号できない');
    ok(!!shot && Math.abs(shot.w / shot.h - src.width / src.height) < 0.02, '★ページ全体を送る（縦横比が元と同じ）');
  }

  // ── ③ 解析結果がフォームに入り、★勝手に投稿されていない ──
  {
    /* ★内訳の表・控除合計・分類できなかった行は <details class="ps-fold"> に畳んである。
       読み取り直後に見たいのは時給と年収ペースであって表ではない、という設計判断で、
       payslip.js に理由つきで書いてある。innerText は閉じた details の中を返さないので、
       ここで開いてから読む。開かずに読むと「捨てている」と誤って落ちる。 */
    await page.evaluate(() => {
      document.querySelectorAll('details.ps-fold').forEach((d) => { d.open = true; });
    });
    const v = await page.evaluate(() => {
      const g = (id) => (document.getElementById(id) || {}).value;
      return {
        base: g('f-base'), command: g('f-command'), other: g('f-other'),
        perdiem: g('f-perdiem'), transport: g('f-transport'),
        housing: g('f-housing'), housingAmt: g('f-housing-amt'),
        block: g('f-block'), cur: g('f-currency'), y: g('f-year'), m: g('f-month'),
        /* ── 2026-08-27 に読めるようになったもの ─────────────────────── */
        guarantee: g('f-guarantee'), guar: g('f-guar'),
        instr: g('f-instructor'), exam: g('f-examiner'),
        instrLabel: g('f-instr-label'), examLabel: g('f-exam-label'),
        instrExtra: g('f-instr-extra'), examExtra: g('f-exam-extra'),
        jobrole: g('f-jobrole'),
        instrShown: !(document.getElementById('s3-instr') || {}).hidden,
        examShown: !(document.getElementById('s3-exam') || {}).hidden,
        /* 変動給は「行」に載る（手で打った人とまったく同じ入れ物）。 */
        varRows: [...(document.getElementById('pd-var-rows') || { children: [] }).children]
          .map((r) => {
            const q = (sel) => { const e = r.querySelector(sel); return e ? e.value.trim() : ''; };
            return { basis: q('.pd-basis'), amt: q('.pd-amt'), label: q('.pd-label') };
          }),
        varSum: g('f-var-sum'), othSum: g('f-oth-sum'), flightvar: g('f-flightvar'),
        /* その他の現金手当も「行」に載る（2026-09-12・指摘3）。
           分類できなかった行は、隠し欄に合算せず項目名ごとここへ来る。 */
        othRows: [...(document.getElementById('pd-oth-rows') || { children: [] }).children]
          .map((r) => {
            const q = (sel) => { const e = r.querySelector(sel); return e ? e.value.trim() : ''; };
            return { amt: q('.pd-amt'), label: q('.pd-label') };
          }),
        /* ★payload と同じ式を「本物の sumField」で引く（写さない）。 */
        fvPay: typeof sumField === 'function' ? sumField('f-flightvar', 'f-var-sum') : null,
        othPay: typeof sumField === 'function' ? sumField('f-other', 'f-var-sum', 'f-oth-sum') : null,
        payitems: g('f-payitems'),
        marked: document.querySelectorAll('.ai-filled').length,
        rate: (document.getElementById('ps-rate') || {}).textContent || '',
        formBodyHidden: document.getElementById('form-body').hidden,
        s1: document.getElementById('s1').offsetParent !== null,
        res: (document.querySelector('.ps-res') || {}).innerText || '',
      };
    });
    /* ★金額の欄は桁区切りを入れて表示する（"420,000"）。生の数字と見比べる。
       ここを `=== '420000'` のままにすると、桁区切りを入れた回に全件が落ちて
       「フォームに入っていない」という嘘の落ち方をする（実際にそうなっていた）。 */
    const dg = (s) => String(s == null ? '' : s).replace(/[^\d.-]/g, '');
    ok(dg(v.base) === '420000', '基本給が入る', v.base);
    ok(dg(v.command) === '185000', '職務手当が機長・役職手当に入る', v.command);
    /* ★2026-08-14：分類できなかった「特別加算 12,000」もここに入る（148200+23400+12000）。
       前はどの欄にも入らず、年収から黙って消えていた。 */
    /* ★2026-08-27 に変動給が「行」へ移り、★2026-09-12 に分類できなかった行も
       「行」へ移った（指摘3）。いま隠し欄（f-other）に残るものは**何も無い**。
       分類できなかった「特別加算 12,000」は、項目名ごと その他の現金手当の行に出る
       ＝ 本人が確認画面で見て直せるようになった。
       **金額の合計は1円も変わらない** ── 下の ★不変条件 で見る。 */
    ok(dg(v.other) === '',
       '★隠し欄には何も残さない（分類できなかった行も「行」へ移った）', v.other);
    ok(v.othRows.length === 1, '★分類できなかった行が1行になる', `${v.othRows.length} 行`);
    if (v.othRows.length === 1) {
      ok(dg(v.othRows[0].amt) === '12000', '★その行に金額が入る', v.othRows[0].amt);
      ok(v.othRows[0].label === '特別加算',
         '★明細上の名称がそのまま残る（前はどこにも残らなかった）', v.othRows[0].label);
    }
    ok(dg(v.othSum) === '12000',
       '★行の合計が「その他の現金手当」の合計欄に入る（隠し欄の代わり）', v.othSum);
    ok(dg(v.perdiem) === '42000', 'パーディアムが入る', v.perdiem);
    ok(dg(v.transport) === '18000', '交通費が入る', v.transport);
    ok(v.housing === 'allowance' && dg(v.housingAmt) === '60000', '住宅手当が現金として入る', v.housingAmt);
    ok(dg(v.block) === '78.2', '乗務時間が入る', v.block);

    /* ══ 2026-08-27：フォームの作り直し（8-26 / 8-27）に読み取りを追いつかせた分 ══
       ここが空だった間、明細を落とした人は「保証給・保証時間・変動給の種類・
       教官・審査」を1つも持てなかった（手で打った人より内訳が薄かった）。 */
    ok(dg(v.guarantee) === '90000',
       '★保証給が専用の欄に入る（基本給に混ぜない）', v.guarantee);
    ok(dg(v.base) === '420000',
       '★その保証給を基本給に足し込んでいない（足すと二度と割れない）', v.base);
    ok(dg(v.guar) === '65',
       '★保証フライトタイムが入る（前は語彙に無く黙って捨てていた）', v.guar);
    ok(v.block === '78.2' || dg(v.block) === '78.2',
       '★保証時間を乗務時間で上書きしていない', `${v.block} / ${v.guar}`);

    /* 変動給は「行」へ（手で打った人とまったく同じ入れ物）。 */
    ok(v.varRows.length === 2, '★変動給が2行になる', `${v.varRows.length} 行`);
    if (v.varRows.length === 2) {
      ok(v.varRows[0].basis === 'block' && v.varRows[1].basis === 'night',
         '★行に「種類」が選ばれている（basis。空だと必須に引っかかって送信できない）',
         v.varRows.map((r) => r.basis).join('／'));
      ok(dg(v.varRows[0].amt) === '148200' && dg(v.varRows[1].amt) === '23400',
         '★行に金額が入る', v.varRows.map((r) => r.amt).join('／'));
      ok(v.varRows[0].label === '変動付加乗務手当' && v.varRows[1].label === '深夜割増',
         '★明細上の名称がそのまま残る（DEEP PAY はこの内訳のために作っている）',
         v.varRows.map((r) => r.label).join('／'));
    }
    ok(/"basis":"block"/.test(v.payitems || '') && /"basis":"night"/.test(v.payitems || ''),
       '★行が pay_items（送られる内訳）にも入っている', (v.payitems || '').slice(0, 120));
    ok(dg(v.varSum) === '171600', '★行の合計（148200+23400）', v.varSum);
    ok(dg(v.flightvar) === '',
       '★行に載せたら f-flightvar は空（ここが二重計上の境目）', v.flightvar);

    /* ★★不変条件 ── 行にしても、送られる2つの列は1円も変わらない。
       flight_variable_pay = f-flightvar + f-var-sum
       other_allowance     = f-other + f-var-sum + f-oth-sum
       ＝ f-var-sum が両方に1回ずつ。前の「f-other と f-flightvar への二重書き」と同じ額。
       ★式は写さず、ページの本物の sumField を呼んで測っている。 */
    ok(v.fvPay === '171600',
       '★★flight_variable_pay は行に移す前と1円も変わらない', String(v.fvPay));
    ok(v.othPay === '183600',
       '★★other_allowance も変わらない（12000 + 171600）。'
       + '12000 の出どころが隠し欄から行に変わっただけ', String(v.othPay));

    /* 役割ごとの手当。専用の列があるので、その他手当にも職位手当にも足し込まない。 */
    ok(v.instrShown && v.examShown, '★教官・審査の節が出ている',
       `${v.instrShown ? '教官○' : '教官×'} ${v.examShown ? '審査○' : '審査×'}`);
    ok(/instructor/.test(v.jobrole || '') && /examiner/.test(v.jobrole || ''),
       '★役職・区分にチェックが付く', v.jobrole);
    ok(v.instrExtra === 'separate' && v.examExtra === 'separate',
       '★「別途支給されている」が選ばれている（これが無いと金額の欄が出ない）',
       `${v.instrExtra}／${v.examExtra}`);
    ok(dg(v.instr) === '30000' && dg(v.exam) === '25000',
       '★教官・審査の額が専用の欄に入る', `${v.instr}／${v.exam}`);
    ok(v.instrLabel === '教官手当' && v.examLabel === '審査手当',
       '★明細上の名称も入る', `${v.instrLabel}／${v.examLabel}`);
    ok(dg(v.command) === '185000',
       '★教官・審査を職位手当に足し込んでいない', v.command);
    ok(v.cur === 'JPY', '通貨が入る', v.cur);
    ok(v.y === '2026' && v.m === '7', '対象月が入る', `${v.y}/${v.m}`);
    ok(v.marked >= 8, 'AIが埋めた欄がハイライトされている', `${v.marked} 欄`);
    /* ★入口で「明細から自動入力」を選んだ時点ではフォームはまだ出ていない（ステップ 1/2）。
       読めた時点で payslip.js が window.PVEnterMode('manual') を呼んで出す。
       ここが出ないと、読み取れても入力を始められないまま行き止まりになる。
       ★2段目以降（会社・職位・機材）は前の段が埋まってから開く段階表示なので、
       明細だけでは開かない。**開いていないのが正しい。**
       代わりに「あと何が要るか」を画面が言っているかを見る。 */
    ok(!v.formBodyHidden && v.s1, '読み取れたらフォームが出る（ステップ 1/2 → 2/2）',
      v.formBodyHidden ? 'form-body が隠れたまま' : '');
    ok(/あと\d+つで送信できます/.test(v.res) && /会社と職位を選ぶ/.test(v.res),
      '★あと何が要るかを画面が言っている（会社・職位・機材は明細に書いていない）');
    ok(/乗務時間あたり/.test(v.rate), '乗務時間あたりの時給が出る');
    ok(/総勤務時間あたり/.test(v.rate), '★総勤務時間あたりの時給が出る（自分では思いつかない方）');
    ok(!seen.rpc.includes('submit_pay_report'),
      '★勝手に投稿していない（submit_pay_report を1度も呼んでいない）',
      seen.rpc.length ? seen.rpc.join(',') : 'RPC 呼び出しなし');

    const body = await page.evaluate(() => document.body.innerText);
    ok(/まだ投稿されていません/.test(body), '「まだ投稿されていません」と書いてある');
    ok(/特別加算/.test(body), '分類できなかった項目を黙って捨てていない');
    ok(/221,354/.test(body) && /832,246/.test(body), '控除合計・差引支給額を画面に出している');

    /* ── 分類できなかった行の扱い（2026-08-14）────────────────────
       前は「これはどれですか？ 分かる方はあとで手で入れてください」と宿題を出し、
       金額はどの欄にも入っていなかった。＝明細を落とした人ほど年収が低く出た。
       いまは金額を先に数えて、最後に軽く1問だけ聞く。答えなくても完成している。 */
    const q = await page.evaluate(() => {
      const c = document.querySelector('.ps-q');
      if (!c) return null;
      return {
        t: (c.querySelector('.ps-q-t') || {}).textContent || '',
        label: (c.querySelector('.ps-q-lb') || {}).textContent || '',
        amount: (c.querySelector('.ps-q-am') || {}).textContent || '',
        skip: !!c.querySelector('.ps-q-skip'),
        chips: [].map.call(c.querySelectorAll('.ps-q-c .chip'), (b) => b.textContent),
        inFold: !!c.closest('details'),
      };
    });
    ok(!!q, '★分類できなかった行があると、最後に確認カードが出る');
    if (q) {
      ok(/あと1項目/.test(q.t), '聞くのは1件ずつ（残り件数を出す）', q.t);
      ok(/特別加算/.test(q.label) && /12,000/.test(q.amount), 'ラベルと金額をそのまま見せる',
         `${q.label} ${q.amount}`);
      ok(q.skip, '★スキップが必ず在る（答えなくてもレポートは完成している）');
      ok(q.chips.length === 6, '6択', q.chips.join('／'));
      ok(!q.inFold, '★畳んだ内訳の外に出ている（中だと既定で閉じていて誰にも見えない）');

      /* 「賞与・一時金」を押す。
         ⚠️ 2026-09-15、フォームから「今月の賞与・ボーナス」の欄が消えた（オーナー決定
            「そもそも賞与は別で支給されんだろ」）。行き先だけ f-other（その他の現金）に
            移してある ── 欄が無い id のままにすると setField が黙って落として、
            **金額がどこにも残らない**。
         ★見るのは2つ。① 金額が f-other に残っていること（消えていない）。
                        ② 内訳データに "asked":"bonus" が残ること（これが語彙の正解データ）。
         ★6択は6択のまま。減らすと、この上の chips.length === 6 と chip[3] が両方ずれる。 */
      await page.evaluate(() => {
        const b = document.querySelectorAll('.ps-q-c .chip')[3];
        if (b) b.click();
      });
      const after = await page.evaluate(() => {
        const g = (id) => (document.getElementById(id) || {}).value;
        return { other: g('f-other'), bonusBox: !!document.getElementById('f-bonus-mo'),
                 detail: g('f-psdetail'), card: !!document.querySelector('.ps-q') };
      });
      ok(after.bonusBox === false,
         '★「今月の賞与・ボーナス」の欄はもう無い（2026-09-15 に廃止）');
      ok(dg(after.other) === '12000',
         '★賞与と答えても金額はその他の現金に残る（どこにも消えない）', after.other || '(空)');
      ok(!after.card, '答え終わったらカードごと消える（1件しか無かった）');
      ok(/"asked":"bonus"/.test(after.detail || ''),
         '★本人の答えが内訳データに残る（これが語彙の正解データになる）');
    }
  }

  const e = await events(page);
  ok(e.filter((x) => x === 'payslip_read_ok').length === 1 && !e.some((x) => x.startsWith('payslip_read_ng')),
     '★「入力欄に入った」は1回だけ・失敗の記録は出ない', e.join(','));
  const order = ['payslip_loaded', 'payslip_prepared', 'payslip_sent', 'payslip_api_ok', 'payslip_read_ok'];
  ok(order.every((x, i) => e.indexOf(x) >= 0 && (i === 0 || e.indexOf(x) > e.indexOf(order[i - 1]))),
     '★記録の段階と順番（選んだ→画像の準備→送信の開始→サーバーの答え→入力欄に入った）', e.join(','));

  // ── ⑥ 明細を見る ──
  await page.click('#ps-view-btn');
  await page.waitForSelector('.ps-view', { timeout: 5000 });
  const v = await page.evaluate(() => ({ blob: (document.querySelector('.ps-view-img') || {}).src || '',
    lock: document.documentElement.classList.contains('ps-view-lock'), dialog: document.querySelector('.ps-view').getAttribute('role') }));
  ok(v.blob.startsWith('blob:') && v.dialog === 'dialog', '★明細を見る画面は blob の画像（このページのメモリだけ）');
  ok(v.lock, '開いているあいだ後ろはスクロールしない');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.ps-view'), { timeout: 3000 }).catch(() => {});
  ok(!(await page.$('.ps-view')) && !(await page.evaluate(() => document.documentElement.classList.contains('ps-view-lock'))),
     'ESC で閉じ、スクロールが戻る');
  ok(!(await page.evaluate(() => { try { return Object.keys(localStorage).some((k) => /^data:image|base64,/.test(localStorage.getItem(k) || '')); } catch (x) { return false; } })),
     '★画像を localStorage に置いていない');
  ok(errs.length === 0, 'ページのエラーが無い', errs.join(' | '));
  await page.close();
}

// ══ ④ 失敗からの戻り ══════════════════════════════════════════════
console.log('\n══ ④ 失敗しても行き止まりにしない・自動で送り直さない・連打で二重に読まない');
{
  const { page, seen, errs } = await open(URL_JA, (n) => (n === 1 ? { body: { ok: false, reason: 'read_busy' } } : { body: FAKE }));
  await upload(page, 'payslip-jp-major.png');
  await page.waitForSelector('.ps-fail', { timeout: 15000 });
  ok(await page.$eval('.ps-fail', (n) => n.getAttribute('data-code')) === 'read_busy', '理由（read_busy）を拾う');
  await new Promise((r) => setTimeout(r, 1500));
  ok(seen.calls === 1, '★自動で送り直さない', String(seen.calls));
  const bar = await page.evaluate(() => ['ps-retry', 'ps-choose', 'ps-manual', 'ps-view-btn'].map((id) => !!document.getElementById(id)));
  ok(bar.every(Boolean), 'もう一度読む・別の明細・手で入力・明細を見る がそろう', JSON.stringify(bar));
  ok(await page.$eval('#form-body', (n) => !n.hidden), 'フォームは開いたまま');
  await page.evaluate(() => { const b = document.getElementById('ps-retry'); b.click(); b.click(); b.click(); });
  await page.waitForSelector('.ps-res', { timeout: 15000 });
  ok(seen.calls === 2, '★連打しても読み取りは1回だけ', String(seen.calls));
  const e = await events(page);
  ok(e.includes('payslip_read_ng:read_busy') && e.filter((x) => x === 'payslip_read_ok').length === 1 && e.includes('payslip_retry'),
     '失敗1回・やり直し・成功1回が別々に記録される', e.join(','));
  ok(errs.length === 0, 'ページのエラーが無い', errs.join(' | '));
  await page.close();
}
{
  const { page } = await open(URL_JA, { status: 500, body: { ok: false, reason: 'read_failed' } });
  await upload(page, 'payslip-jp-major.png');
  await page.waitForSelector('.ps-fail', { timeout: 15000 });
  ok(await page.$eval('.ps-fail', (n) => n.getAttribute('data-code')) === 'read_failed', 'HTTP 500 でも本文の理由を拾う');
  await page.close();
}
{
  const { page } = await open(URL_JA, { body: { ok: false, reason: 'not_a_payslip' } });
  await upload(page, 'payslip-jp-major.png');
  await page.waitForSelector('.ps-fail', { timeout: 15000 });
  const r = await page.evaluate(() => ({ retry: !!document.getElementById('ps-retry'), choose: !!document.getElementById('ps-choose') }));
  ok(!r.retry && r.choose, '同じ画像で直らない失敗（明細ではない）には「もう一度読む」を出さず、別の明細を勧める');
  await page.close();
}
{
  /* 入力欄に入れるところで落ちたら「通信エラー」にしない（2026-11-04 まで read_ok と read_ng:network を両方記録していた） */
  const broken = { ok: true, result: { ...FAKE.result, earnings: 'x' } };
  const { page } = await open(URL_JA, { body: broken });
  await upload(page, 'payslip-jp-major.png');
  await page.waitForSelector('.ps-fail', { timeout: 15000 });
  const e = await events(page);
  ok(await page.$eval('.ps-fail', (n) => n.getAttribute('data-code')) === 'apply_failed' && e.includes('payslip_read_ng:apply_failed')
     && !e.includes('payslip_read_ok') && !e.includes('payslip_read_ng:network'),
     '★入力欄に入れられなかったときは apply_failed（read_ok も network も記録しない）', e.join(','));
  await page.close();
}

// ══ ⑤ やめたあとの返事 ════════════════════════════════════════════
console.log('\n══ ⑤ 読み取りの途中でやめる → あとから返事が来ても画面に入れない');
{
  const { page, seen, errs } = await open(URL_JA, 'hang');
  await upload(page, 'payslip-jp-major.png');
  await page.waitForSelector('#ps-cancel', { timeout: 15000 });
  await page.click('#ps-cancel');
  await page.waitForSelector('.ps-state.is-canceled', { timeout: 5000 });
  for (let i = 0; i < 30 && !seen.hold; i++) await new Promise((r) => setTimeout(r, 100));
  if (seen.hold) await seen.hold.respond({ status: 200, headers: JSONH, body: JSON.stringify(FAKE) });
  await new Promise((r) => setTimeout(r, 1200));
  const g = await page.$eval('#f-gross', (n) => n.value).catch(() => '');
  ok(!g && !(await page.$('.ps-res')), '★やめたあとの返事は画面に入れない', 'f-gross=' + g);
  const e = await events(page);
  ok(e.includes('payslip_cancel') && !e.includes('payslip_read_ok'), 'やめた記録だけが残る', e.join(','));
  ok(errs.length === 0, 'ページのエラーが無い', errs.join(' | '));
  await page.close();
}

// ══ 英語のページも同じ流れ ═════════════════════════════════════════
console.log('\n══ 英語のページも同じ流れ');
{
  const { page, seen } = await open(URL_EN, { body: FAKE });
  ok(/Anthropic/.test(await page.$eval('#ps-consent', (n) => n.textContent)), '英語：選ぶ前に説明と同意が見えている');
  await upload(page, 'payslip-jp-major.png');
  await page.waitForSelector('.ps-res', { timeout: 20000 });
  ok(seen.bodies[0] && seen.bodies[0].lang === 'en', '英語のページは lang=en で送る');
  ok(await page.$eval('#form-body', (n) => !n.hidden), '英語：読めたらフォームが開いている');
  await page.close();
}

console.log('\n══ 開けない PDF（鍵付き・XFA・白紙）');
{
  const buildPdf = (objs, trailerExtra) => {
    let out = '%PDF-1.4\n';
    const off = [];
    objs.forEach((body, i) => {
      off.push(Buffer.byteLength(out, 'latin1'));
      out += (i + 1) + ' 0 obj\n' + body + '\nendobj\n';
    });
    const xref = Buffer.byteLength(out, 'latin1');
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    off.forEach((o) => { out += String(o).padStart(10, '0') + ' 00000 n \n'; });
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R ' + trailerExtra + ' >>\n' +
           'startxref\n' + xref + '\n%%EOF\n';
    return Buffer.from(out, 'latin1');
  };
  const hx = (n) => Array.from({ length: n }, (_, i) => ((i * 7 + 3) & 0xff).toString(16).padStart(2, '0')).join('');
  const BODY = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>',
  ];

  const cases = [
    ['鍵付き（パスワードで保護されている）', 'locked',
     buildPdf([...BODY,
       /* V1/R2・40bit。/U はわざと合わない値 ── pdf.js は鍵を作る前にここで落ちる。 */
       '<< /Filter /Standard /V 1 /R 2 /Length 40 /O <' + hx(32) + '> /U <' + hx(32) + '> /P -1 >>'],
       '/Encrypt 4 0 R /ID [<' + hx(16) + '> <' + hx(16) + '>]'),
     'パスワードで保護されています'],
    ['XFA フォーム（中身が XML 側にあり、ページは空）', 'xfa',
     buildPdf([
       '<< /Type /Catalog /Pages 2 0 R /AcroForm 4 0 R >>',
       BODY[1], BODY[2],
       '<< /Fields [] /XFA [ (preamble) 5 0 R ] >>',
       '<< /Length 9 >>\nstream\n<xdp:xdp>\nendstream'], ''),
     '特殊な形式'],
    ['白紙（正しい PDF だが描き出すものが無い）', 'blank', buildPdf(BODY, ''),
     '描き出せませんでした'],
  ];

  const { page, seen } = await open(URL_JA, { body: FAKE }, { w: 1280 });

  for (const [name, slug, buf, want] of cases) {
    const p = path.join(TMP, `pdf-${slug}.pdf`);
    writeFileSync(p, buf);
    await page.evaluate(() => { const n = document.getElementById('ps-panel'); if (n) n.innerHTML = ''; });
    const inp = await page.$('#ps-file');
    await inp.uploadFile(p);
    /* ★時間で待たない。警告が出るか、確認画面が出るか、どちらかが起きるまで待つ。
       確認画面が出てしまったら、その時点で下の判定が赤くなる。 */
    await page.waitForFunction(
      () => !!document.querySelector('#ps-panel .ps-msg-warn') || !!document.querySelector('.ps-edit'),
      { timeout: 30000 });
    const m = await page.evaluate(() => ({
      warn: (document.querySelector('#ps-panel .ps-msg-warn') || {}).textContent || '',
      edit: !!document.querySelector('.ps-edit'),
      confirm: !!document.getElementById('ps-confirm'),
    }));
    ok(m.warn.includes(want), `★正しい文言が出る：${name}`, `出た文言「${m.warn.slice(0, 60)}」`);
    ok(!m.edit && !m.confirm, `★送る道に乗らない（明細の確認画面が出ない）：${name}`,
       `.ps-edit ${m.edit ? '有' : '無'} / #ps-confirm ${m.confirm ? '有' : '無'}`);
  }
  ok(seen.calls === 0, '★開けない PDF は1度も Edge Function へ送っていない', `${seen.calls} 回`);

  /* ★白紙の JPEG が送られる道（真因）を塞いだままか。
     裸の catch に戻すと、ここは全部緑のまま**本番だけ**が壊れる。 */
  await page.close();
}

// ── コード側の約束：画像・ラベルをログに出していないこと（db/test-payslip-redact.mjs から移した）──
console.log('\n══ Edge Function のログ検査');
const fn = readFileSync(path.join(DIR, '..', 'supabase', 'functions', 'parse-payslip', 'index.ts'), 'utf8');
const logs = fn.match(/console\.(log|info|warn|error|debug)\([^)]*\)/g) || [];
const bad = logs.filter((l) => /body|b64|image|parsed|raw|text|label|amount/.test(l));
ok(bad.length === 0, '画像・明細本文をログに出していない', logs.join(' / ') || 'console 呼び出しなし');
ok(!/storage\.from\(|\.upload\(/.test(fn), '画像を Storage に書いていない');

// ── 画面側の約束：重い文字読み取りの部品を読まない（2026-11-04）──
const PS = readFileSync(path.join(DIR, '..', 'payslip.js'), 'utf8');
ok(!/tesseract/i.test(PS.replace(/\/\*[\s\S]*?\*\//g, '')), '★文字読み取りの部品（tesseract）をもう読み込まない');
ok(/READ_MS = \d+/.test(PS) && /PREP_MS = \d+/.test(PS), '★画像の準備と読み取りの返事に時間の上限がある');

ok(outside.length === 0, '★外の業者へ1本も出ていない', outside.slice(0, 3).join(' '));
await browser.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
