/* shot-actual-pay.mjs — 「他のパイロットの実給与を見る」を目で見るためだけのスクリプト
     （判定は assert-pay-rows.mjs が持つ。こちらは絵を出すだけ）

   この画面はログインしていないと login.html へ飛ぶ。素の localhost URL では
   中身が出ないので、ここで Supabase ごと差し替えて開く。

   実行: node shot-actual-pay.mjs <scene> <lang> [open]
     scene = locked   鍵が無い人（②に金額が1つも出ない・導線だけ）
             empty    鍵はあるが1件も無い（①だけが埋まっている）
             rows     5人ちょうどの区分（1行＝1人）
             mix      機材別 ＋ 機材をまとめた区分の2つの表
             picked   行を選んで右のパネルに区分の中央値が出た状態
     lang  = ja | en
     第3引数 open ＝ 撮らずに見える窓で開いたままにする

   ★行の中身はこのファイルが作った作り物。本番の数字ではない。
   ⚠️ localhost が要る（node serve.mjs）。本番の DB には触らない（Supabase ごと差し替える）。
*/
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT  = fileURLToPath(new URL('.', import.meta.url));
const BASE  = 'http://localhost:3000';
const scene = process.argv[2] || 'rows';
const lang  = process.argv[3] === 'en' ? 'en' : 'ja';
const show  = process.argv[4] === 'open';

const UID = '00000000-0000-4000-8000-00000000c001';

/* 作り物の行。★ana / jal は実在の会社だが、この金額は作った数字。
   サーバは有効数字2桁で返すので、こちらもその形にそろえてある。 */
const F = (air, pos, bucket, usd, vf) => ({
  airline: air, pos: pos, grain: 'fleet', bucket: bucket,
  annual_usd: usd, verified: vf, cohort_median_usd: 180000 });
const C = (air, pos, bucket, usd, vf) => ({
  airline: air, pos: pos, grain: 'cat', bucket: bucket,
  annual_usd: usd, verified: vf, cohort_median_usd: 170000 });

const ROWS = [
  F('ana', 'cap', 'b787', 170000, true),  F('ana', 'cap', 'b787', 180000, false),
  F('ana', 'cap', 'b787', 180000, true),  F('ana', 'cap', 'b787', 190000, false),
  F('ana', 'cap', 'b787', 200000, true),
];
const MIX = ROWS.concat([
  F('jal', 'fo', 'a350', 110000, false), F('jal', 'fo', 'a350', 120000, true),
  F('jal', 'fo', 'a350', 120000, false), F('jal', 'fo', 'a350', 130000, false),
  F('jal', 'fo', 'a350', 140000, true),
  C('ana', 'cap', 'w', 160000, false), C('ana', 'cap', 'w', 170000, true),
  C('ana', 'cap', 'w', 170000, false), C('ana', 'cap', 'w', 180000, true),
  C('ana', 'cap', 'w', 190000, false), C('ana', 'cap', 'w', 200000, true),
  C('ana', 'cap', 'w', 210000, false),
]);

const SCENES = {
  locked: { pay: { ok: true, state: 'locked', rows: [] } },
  empty:  { pay: { ok: true, state: 'open', rows: [] } },
  rows:   { pay: { ok: true, state: 'open', rows: ROWS } },
  mix:    { pay: { ok: true, state: 'open', rows: MIX } },
  picked: { pay: { ok: true, state: 'open', rows: MIX }, click: true },
};
const S = SCENES[scene];
if (!S) { console.error('scene は ' + Object.keys(SCENES).join(' / ')); process.exit(1); }

/* assert-pay-rows.mjs と同じ差し替え。
   ⚠️ rpc は本物と同じ「then だけを持つ箱」＝ async にしない。 */
function stub(page, pay) {
  return page.evaluateOnNewDocument((uid, pay) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('pv-theme', 'light');
    const GAP = { ok: true, state: 'near', remaining: 2, gained: 0, crossed: false };
    const RPC = {
      pv_pay_rows: pay,
      my_cohort_gap: GAP,
      my_referral_code: { ok: true, code: 'K7QD3XZM', invited: 0, converted: 0 },
    };
    function q(rows) {
      const o = { data: rows, error: null,
        select: () => o, eq: () => o, in: () => o, order: () => o, limit: () => o,
        single: async () => ({ data: rows[0] || null, error: null }),
        maybeSingle: async () => ({ data: rows[0] || null, error: null }),
        then: (res) => res({ data: rows, error: null }) };
      return o;
    }
    const FAKE = {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: uid, email: 'pilot@example.com' } } } }),
        getUser:    async () => ({ data: { user: { id: uid, email: 'pilot@example.com' } } }),
        signOut:    async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      rpc: (name) => {
        const res = { data: RPC[name] || { ok: true }, error: null };
        return { then: (y, n) => Promise.resolve(res).then(y, n) };
      },
      from: () => q([]),
    };
    Object.defineProperty(window, 'supabase',
      { value: { createClient: () => FAKE }, writable: false, configurable: false });
  }, UID, pay);
}

const browser = await puppeteer.launch(show
  ? { headless: false, defaultViewport: null, args: ['--window-size=1440,1100'] }
  : { headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
if (!show) await page.setViewport({ width: 1440, height: 1100 });
await stub(page, S.pay);
await page.goto(BASE + (lang === 'en' ? '/en/' : '/') + 'actual-pay.html',
                { waitUntil: 'networkidle2', timeout: 40000 });
await new Promise((r) => setTimeout(r, 2200));

if (S.click) {
  await page.evaluate(() => { const t = document.querySelector('.ap-tr'); if (t) t.click(); });
  await new Promise((r) => setTimeout(r, 500));
}

if (show) {
  console.log(`見える窓で開いた（${scene} / ${lang}）。閉じるとこのコマンドも終わる。`);
  await new Promise(() => {});
}

const dir = path.join(ROOT, 'temporary screenshots');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const n = readdirSync(dir).filter((f) => /^screenshot-\d+/.test(f))
  .reduce((m, f) => Math.max(m, Number(f.match(/^screenshot-(\d+)/)[1])), 0) + 1;
const out = path.join(dir, `screenshot-${n}-actualpay-${scene}-${lang}.png`);

/* ページ全体を撮る（①と②の関係＝混ざっていないことが見たいので、
   要素で切り出すと肝心のところが写らない）。 */
const full = await page.evaluate(() => document.documentElement.scrollHeight);
await page.setViewport({ width: 1440, height: Math.min(full, 3200) });
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: out });
console.log(out.replace(ROOT, ''));
await browser.close();
