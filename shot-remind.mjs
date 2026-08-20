/* shot-remind.mjs — 月次リマインドのメール本文を localhost で見比べる。

   本文は Edge Function の build() が組み立てる。ここで写経すると、
   撮った絵が本物でなくなるので **本物の index.ts をそのまま import する**
   （Node 24 は .ts の型注釈を素通しで剥がす。index.ts 側は Deno.serve を
    条件付きにしてあるので Node から読める）。

   組んだ HTML を temporary screenshots/mail/ に書き出し、serve.mjs 越しに撮る。
   ★ file:/// では撮らない（CLAUDE.md）。

   実行: node shot-remind.mjs             … 月次リマインド6通ぶん書き出して撮る
         node shot-remind.mjs --write     … 書き出すだけ（撮らない）
         node shot-remind.mjs --announce  … お知らせメール（announce-mail.mjs）の側を撮る
*/
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from './supabase/functions/remind-payslip/index.ts';
import { build as buildAnnounce } from './mail-bot/announce-mail.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'temporary screenshots', 'mail');
fs.mkdirSync(outDir, { recursive: true });

const ANNOUNCE = process.argv.includes('--announce');
const day = (n) => new Date(Date.now() + n * 86400000).toISOString();

/* 受け取る人の状態は3つに分かれる。文面と色が変わるので全部見る。 */
const REMIND_CASES = [
  { k: 'ja-normal', p: { name: '高橋 蓮', country: '日本', days_left: 62, access_until: day(62), streak_months: 4, report_count: 4, pay_day: 25 } },
  { k: 'ja-soon', p: { name: '高橋 蓮', country: 'UAE', days_left: 9, access_until: day(9), streak_months: 1, report_count: 1, pay_day: 30 } },
  { k: 'ja-expired', p: { name: '高橋 蓮', country: '日本', days_left: 0, access_until: day(-12), streak_months: 0, report_count: 7, pay_day: 25 } },
  { k: 'en-normal', p: { name: 'Alex Mercer', country: 'UAE', days_left: 62, access_until: day(62), streak_months: 4, report_count: 4, pay_day: 30 } },
  { k: 'en-soon', p: { name: 'Alex Mercer', country: 'アメリカ', days_left: 3, access_until: day(3), streak_months: 11, report_count: 11, pay_day: 16 } },
  // 氏名が無い人。挨拶が「こんにちは」/「Hi,」に落ちるところを見る
  { k: 'en-noname', p: { name: null, country: 'イギリス', days_left: 0, access_until: day(-1), streak_months: 2, report_count: 2, pay_day: 28 } },
];

/* お知らせメール。分かれ方は2つ×3通り＝「明細を出したことがあるか」×「言語」。
   ★氏名は架空（このリポジトリは PUBLIC）。 */
const ANNOUNCE_CASES = [
  { k: 'an-ja-new',   p: { name: '高橋 蓮',       country: '日本', pay_report_count: 0 } },
  { k: 'an-ja-filed', p: { name: '高橋 蓮',       country: '日本', pay_report_count: 4 } },
  { k: 'an-en-new',   p: { name: 'Alex Mercer',   country: 'UAE',  pay_report_count: 0 } },
  { k: 'an-en-filed', p: { name: 'Alex Mercer',   country: 'UAE',  pay_report_count: 2 } },
  // 氏名も居住国も手がかりが無い人＝日英を1通に両方入れる
  { k: 'an-both',     p: { name: 'Ren Aoki', country: null,   pay_report_count: 0 } },
  { k: 'an-noname',   p: { name: null,            country: null,   pay_report_count: 0 } },
];

const CASES = ANNOUNCE ? ANNOUNCE_CASES : REMIND_CASES;

const files = [];
for (const c of CASES) {
  const m = ANNOUNCE
    /* ★siteUrl を localhost にする。お知らせメールの図は
         https://pilot-value.com/assets/mail/ の画像なので、push 前だと 404 になり
         下見が空の枠だらけになる（実際にそう見えて分からなくなる）。 */
    ? buildAnnounce({ id: 'x', unsub_token: '0000-token', ...c.p },
      { supabaseUrl: 'https://example.supabase.co', siteUrl: 'http://localhost:3000' })
    : build({ id: 'x', email: 'x@example.com', unsub_token: '0000-token', ...c.p });
  // 受信箱の見え方に寄せる：白背景・左寄せ・幅600px前後
  const page =
    `<!doctype html><meta charset="utf-8"><title>${c.k}</title>` +
    `<style>body{margin:0;background:#eef1f5;padding:28px;font-family:-apple-system,'Segoe UI','Noto Sans JP',sans-serif}` +
    `.env{max-width:600px;margin:0 auto;background:#fff;border-radius:10px;padding:26px 24px;box-shadow:0 1px 3px rgba(16,24,40,.10),0 8px 28px rgba(16,24,40,.06)}` +
    `.sub{max-width:600px;margin:0 auto 10px;font-size:12px;color:#5b6b7f}</style>` +
    `<div class="sub"><b>Subject:</b> ${m.subject.replace(/</g, '&lt;')}　/　lang=${m.lang}</div>` +
    `<div class="env">${m.html}</div>`;
  const f = path.join(outDir, `${c.k}.html`);
  fs.writeFileSync(f, page);
  files.push({ k: c.k, rel: `temporary screenshots/mail/${c.k}.html` });
  console.log('wrote', f);
}

if (process.argv.includes('--write')) process.exit(0);

/* headless:'new' はこの環境で page.screenshot() が返ってこない（Chrome 側）。
   'shell' だけ返る。描画エンジンは同じ。 */
const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 720, height: 900 });
const dir = path.join(__dirname, 'temporary screenshots');
for (const f of files) {
  await page.goto(`http://localhost:3000/${encodeURI(f.rel)}`, { waitUntil: 'networkidle2', timeout: 30000 });
  let n = 1;
  while (fs.existsSync(path.join(dir, `screenshot-${n}-mail-${f.k}.png`))) n++;
  const out = path.join(dir, `screenshot-${n}-mail-${f.k}.png`);
  await page.screenshot({ path: out, fullPage: true });
  console.log(out);
}
await browser.close();
