/* shot-founding.mjs — FOUNDING PILOT 100（創設メンバー）の板の見た目を撮る／見せる。

   本物の板は「自分が創設メンバーか」をサーバー（my_founding）に聞いて決めるので、
   手では作れない。shot-referral.mjs と同じやり方で
   Supabase クライアントごと差し替え、返る中身だけを場面ごとに変える。
   描くのは本物の pv-founding.js ＝撮った絵がそのまま本番の絵になる。

   実行: node shot-founding.mjs <scene> <lang> <theme> <width> [open|page]
     scene: has   … 称号あり
            none  … 称号なし（まだ給与も口コミも出していない人）
                    ★どちらも数字が1文字も出ないのが正しい
            gone  … RPC が答えない＝db/founding.sql をまだ貼っていない状態
                    （★板が1枚も出ないのが正しい）
     lang : ja | en    theme: dark | light    width: 390 / 1280 など
     第5引数 open ＝撮らずに見える窓で開いたままにする（自分の目で見る用）
     第5引数 page ＝1画面ぶんでなくページ全体を撮る
   保存先は screenshot.mjs と同じ ./temporary screenshots/

   ⚠️ localhost が要る（node serve.mjs）。本番の DB には触らない。
*/
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scene = process.argv[2] || 'has';
const lang  = process.argv[3] || 'ja';
const theme = process.argv[4] || 'dark';
const vw    = Number(process.argv[5] || 1280);
const open  = process.argv[6] === 'open';
const full  = process.argv[6] === 'page';

/* ★番号は「持っているか」の判定にしか使わない（2026-08-23 に画面から外した）。
   no が 1 でも 100 でも絵は同じになる ＝ 場面は has / none / gone の3つで足りる。 */
const PAYLOAD = {
  has:   { ok: true, no: 7 },
  none:  { ok: true, no: null },
  gone:  null                     // ★null ＝ rpc がエラーを返す
};
if (!Object.prototype.hasOwnProperty.call(PAYLOAD, scene)) {
  console.error(`場面は ${Object.keys(PAYLOAD).join(' / ')} のどれか（渡された値: ${scene}）`);
  process.exit(2);
}

const dir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const label = `founding-${scene}-${lang}-${theme}-${vw}`;
let n = 1;
while (fs.existsSync(path.join(dir, `screenshot-${n}-${label}.png`))) n++;
const outPath = path.join(dir, `screenshot-${n}-${label}.png`);

const url = `http://localhost:3000/${lang === 'en' ? 'en/' : ''}profile.html`;

/* ★ headless:'new' はこの環境で page.screenshot() が返ってこない（shot-tracker.mjs 参照）。 */
const browser = await puppeteer.launch(open
  ? { headless: false, defaultViewport: null, args: ['--no-sandbox', `--window-size=${vw},1100`] }
  : { headless: 'shell', args: ['--no-sandbox'] });
const page = (await browser.pages())[0] || await browser.newPage();
if (!open) await page.setViewport({ width: vw, height: 1100 });

await page.evaluateOnNewDocument((payload, theme) => {
  localStorage.setItem('pv-theme', theme);
  /* 本番の GA4 プロパティに送らない（公式のオプトアウト）。 */
  window['ga-disable-G-3XYF69VQ3X'] = true;

  const UID = '00000000-0000-4000-8000-00000000a001';
  const RPC = {
    my_founding: () => payload,
    my_pay_reports: () => ({ ok: true, reports: [], report_count: 0, streak_months: 0,
      access_until: null, badge: 'none', badge_state: 'none', mail_optin: false, pay_day_of_month: 5 }),
    my_cohort_gap:      () => ({ ok: true, state: 'none' }),
    my_referral_code:   () => ({ ok: true, code: 'K7QD3XZM', invited: 0, converted: 0 }),
    claim_referral:     () => ({ ok: true, status: 'none' }),
    my_airline_conditions: () => ({ ok: true, answers: [], answered_total: 0, questions_total: 32 }),
    next_condition_questions: () => ({ ok: true, airline: 'zipair', mine_count: 0, questions: [] })
  };
  function q(rows) {
    const o = { data: rows, error: null,
      select: () => o, eq: () => o, in: () => o, order: () => o, limit: () => o,
      update: () => o, insert: () => o,
      single: async () => ({ data: rows[0] || null, error: null }),
      maybeSingle: async () => ({ data: rows[0] || null, error: null }),
      then: (res) => res({ data: rows, error: null }) };
    return o;
  }
  const FAKE = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: UID, email: 'pilot@example.com' } } } }),
      getUser:    async () => ({ data: { user: { id: UID, email: 'pilot@example.com' } } }),
      signOut:    async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    /* ★架空のパイロット。ZIPAIR は A380 を運航していない＝実在しない組み合わせ。
       「実在しそうな値に直す」ことをしない。 */
    from: (t) => t === 'profiles'
      ? q([{ id: UID, name: 'Sample Pilot', email: 'pilot@example.com',
             company: 'ZIPAIR', position: 'captain', email_opt_in: true }])
      : q([]),
    /* ★本物の supabase-js が返すのは「then だけを持つ箱」で catch も finally も無い。
       async にすると本番には無い .catch が生える（2026-08-19 の真っ白事故）。 */
    rpc: (name) => {
      const has = Object.prototype.hasOwnProperty.call(RPC, name);
      const val = has ? RPC[name]() : { ok: true };
      const res = (name === 'my_founding' && val === null)
        ? { data: null, error: { message: 'function public.my_founding() does not exist', code: '42883' } }
        : { data: val, error: null };
      return { then: (y, ng) => Promise.resolve(res).then(y, ng) };
    }
  };
  Object.defineProperty(window, 'supabase',
    { value: { createClient: () => FAKE }, writable: false, configurable: false });
}, PAYLOAD[scene], theme);

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await new Promise((r) => setTimeout(r, 2200));

if (open) {
  console.log(`開きました（${scene} / ${lang} / ${theme} / ${vw}px）。窓を閉じると終わります。`);
  /* ★時間で待たない。puppeteer の待ちは既定30秒で、時間切れを握りつぶすと
     誰も触っていないのに窓が消える（2026-08-19 に実際に起きた）。 */
  await new Promise((r) => browser.on('disconnected', r));
  process.exit(0);
}

/* ── 撮る前に「出ているべきものが出ているか」を判定する ───────────── */
const seen = await page.evaluate(() => {
  const p = document.querySelector('.pvf');
  return { found: !!p, state: p ? p.getAttribute('data-pvf') : '', text: p ? p.innerText : '' };
});
if (scene === 'gone') {
  if (seen.found) { console.error('❌ SQL 未適用のときに板が出ている（出ないのが正しい）'); process.exit(1); }
  console.log('板は出ていない（gone ではこれが正しい）。ページ全体を撮る。');
} else if (!seen.found) {
  console.error('❌ 板が出ていない。node serve.mjs は動いているか？');
  process.exit(1);
} else {
  console.log(`板: [${seen.state}] ${JSON.stringify(seen.text)}`);
}

/* ★scrollIntoView を使わない。板はページのいちばん上にあり、nav が sticky なので
   'start' で寄せると板の頭が nav の下に潜る（ワードマークが隠れる）。
   本番で最初に見える姿は「いちばん上」そのものなので、そこへ戻す。 */
await page.evaluate(() => window.scrollTo(0, 0));
await new Promise((r) => setTimeout(r, 400));

await page.screenshot({ path: outPath, fullPage: full });
await browser.close();
console.log(`保存: ${path.relative(__dirname, outPath)}`);
