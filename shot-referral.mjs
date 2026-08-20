/* shot-referral.mjs — 招待（データ密度ループ）の見た目を撮る。

   本物の画面は「自分が給与を出していて、その区分の人数が3〜4人」のときにしか
   出ない。人数はサーバー（my_cohort_gap）が決めるので、手では作れない。
   そこで shot-conditions.mjs と同じやり方で Supabase クライアントごと差し替え、
   返ってくる中身だけを場面ごとに変える。描くのは本物の pv-referral.js
   ＝撮った絵がそのまま本番の絵になる。

   実行: node shot-referral.mjs <scene> <lang> <theme> <width> [open|page]
     scene: strip … トップページの着地の1枚（/?ref=…・画面の中央に出る招待状）
            invite… マイページの常設入口（★条件に関係なく必ず出るのが正しい）
            few   … マイページ。n≦2（★人数を推測できる数字が出ないのが正しい）
            near2 … マイページ。あと2人
            near1 … マイページ。あと1人
            open  … マイページ。5人そろった（★招待の導線が出ないのが正しい）
            bfew  … 給与を出した直後。n≦2
            bnear … 給与を出した直後。あと2人
            bopen … 給与を出した直後。5人そろった
            floor … 給与を出した直後、招待が読めなかったとき
                    （★いまの「まだ5人に届いていません」が残るのが正しい）
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
const scene = process.argv[2] || 'near2';
const lang  = process.argv[3] || 'ja';
const theme = process.argv[4] || 'light';
const vw    = Number(process.argv[5] || 1280);
const open  = process.argv[6] === 'open';
const full  = process.argv[6] === 'page';

const SCENES = ['strip', 'invite', 'few', 'near2', 'near1', 'open', 'bfew', 'bnear', 'bopen', 'floor'];
if (SCENES.indexOf(scene) < 0) {
  console.error(`場面は ${SCENES.join(' / ')} のどれか（渡された値: ${scene}）`);
  process.exit(2);
}
const BENCH = scene === 'bfew' || scene === 'bnear' || scene === 'bopen' || scene === 'floor';

/* 場面 → my_cohort_gap() が返す中身。★few には整数が1つも入っていない
   （n≦2 のときサーバーは数を返さない。db/referrals.sql と同じ形）。 */
const GAP = {
  strip:  { ok: true, state: 'none' },
  /* ★常設入口は my_cohort_gap を引かない。none（給与を1件も出していない＝
     文脈カードがいちばん出ない人）を渡して、それでも出ることを見る。 */
  invite: { ok: true, state: 'none' },
  few:   { ok: true, state: 'few' },
  near2: { ok: true, state: 'near', remaining: 2, gained: 0, crossed: false },
  near1: { ok: true, state: 'near', remaining: 1, gained: 1, crossed: false },
  open:  { ok: true, state: 'open', gained: 3, crossed: true },
  bfew:  { ok: true, state: 'few' },
  bnear: { ok: true, state: 'near', remaining: 2, gained: 0, crossed: false },
  bopen: { ok: true, state: 'open', gained: 2, crossed: true },
  floor: { ok: true, state: 'near', remaining: 2, gained: 0, crossed: false }
}[scene];

const CODE = 'K7QD3XZM';   // ★実在のコードではない。この台本が作った8文字

const dir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const label = `ref-${scene}-${lang}-${theme}-${vw}`;
let n = 1;
while (fs.existsSync(path.join(dir, `screenshot-${n}-${label}.png`))) n++;
const outPath = path.join(dir, `screenshot-${n}-${label}.png`);

const base = `http://localhost:3000/${lang === 'en' ? 'en/' : ''}`;
const url = scene === 'strip'  ? base + '?ref=' + CODE
          : scene === 'invite' ? base + 'profile.html'
          : BENCH ? base + 'pay-report.html'
          : base + 'my-value.html';

/* ★ headless:'new' はこの環境で page.screenshot() が返ってこない（shot-tracker.mjs 参照）。 */
const browser = await puppeteer.launch(open
  ? { headless: false, defaultViewport: null, args: ['--no-sandbox', `--window-size=${vw},1100`] }
  : { headless: 'shell', args: ['--no-sandbox'] });
const page = (await browser.pages())[0] || await browser.newPage();
if (!open) await page.setViewport({ width: vw, height: 1100 });

await page.evaluateOnNewDocument((gap, theme, code, scene) => {
  localStorage.setItem('pv-theme', theme);
  /* 本番の GA4 プロパティに送らない（公式のオプトアウト）。 */
  window['ga-disable-G-3XYF69VQ3X'] = true;

  const UID = '00000000-0000-4000-8000-00000000a001';
  const REPORT = {
    airline: 'zipair', airline_other: null, position: 'cap', fleet: 'a380', base_iata: 'ITM',
    period_year: 2026, period_month: 8, period_ym: 2026 * 12 + 8, contract_type: 'direct',
    currency: 'JPY', fx_to_jpy: 1, fx_to_usd: 0.0067,
    base_pay: 1050000, command_pay: 180000, housing_type: 'allowance', housing_amount: 60000,
    per_diem: 48000, transport: 22000, other_allowance: 260000, bonus_annual: 0,
    block_hours: 71.5, duty_hours: 139, net_pay_actual: 1360000, deduction_total: 260000,
    annual_total_orig: 19440000, annual_total_jpy: 19440000, annual_total_usd: 130248,
    net_annual_jpy: 15000000, usd_per_block_hour: 145.6,
    source: 'payslip', verify_level: 1, created_at: '2026-08-05T00:00:00Z'
  };
  const RPC = {
    my_cohort_gap:      () => gap,
    my_referral_code:   () => ({ ok: true, code: code, invited: 0, converted: 0 }),
    claim_referral:     () => ({ ok: true, status: 'attributed' }),
    pv_referral_settle: () => ({ ok: true }),
    my_pay_reports: () => ({ ok: true, reports: [REPORT], report_count: 1, streak_months: 1,
      access_until: new Date(Date.now() + 62 * 86400000).toISOString(),
      badge: 'silver', badge_state: 'active', mail_optin: false, pay_day_of_month: 5 }),
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
    from: (t) => t === 'profiles'
      ? q([{ id: UID, name: 'Sample Pilot', email: 'pilot@example.com',
             company: 'ZIPAIR', position: 'captain', email_opt_in: true }])
      : q([]),
    /* ★本物の supabase-js が返すのは「then だけを持つ箱」で catch も finally も無い。
       async にすると本番には無い .catch が生える（2026-08-19 の真っ白事故）。 */
    rpc: (name) => {
      const res = { data: RPC[name] ? RPC[name]() : { ok: true }, error: null };
      return { then: (ok, ng) => Promise.resolve(res).then(ok, ng) };
    }
  };
  Object.defineProperty(window, 'supabase',
    { value: { createClient: () => FAKE }, writable: false, configurable: false });
}, GAP, theme, CODE, scene);

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await new Promise((r) => setTimeout(r, scene === 'strip' ? 1200 : 2600));

if (BENCH) {
  /* 待遇のモーダルは撮りたいものを丸ごと覆う。ここでは招待カードの見た目を見たいので
     開かないようにする。★2つが共存できることは assert-referral.mjs が見ている
     （こちらは覆いを作らないので、ぶつからない）。 */
  await page.evaluate((floor) => {
    if (window.PVConditions) window.PVConditions.afterReport = function () {};
    /* 紙吹雪は画面いっぱいに降って撮りたいものを隠す。本番では正しい振る舞いなので
       止めない。ここでだけ黙らせる。 */
    window.PVConfetti = Object.assign(function () {}, { badge: function () {} });
    if (floor) delete window.PVReferral;      // 読めなかったときの床を見る
    window.renderResult(
      { ok: true, is_new: true, currency: 'JPY', annual_total_orig: 19440000,
        annual_total_jpy: 19440000, annual_total_usd: 130248, net_annual_jpy: 15000000,
        usd_per_block_hour: 145.6, streak_months: 1, benchmark: null,
        access_until: new Date(Date.now() + 90 * 86400000).toISOString() },
      { airline: 'zipair', airline_other: null, position: 'cap', fleet: 'a380',
        base_iata: 'ITM', contract_type: 'direct', currency: 'JPY',
        period_year: 2026, period_month: 8 });
  }, scene === 'floor');
  await new Promise((r) => setTimeout(r, 1400));
}

/* 撮る対象を画面の真ん中へ持ってくる（マイページの「機会」は下の方にある）。 */
const target = scene === 'strip' ? '.pvr-strip' : BENCH ? '#bench-gap, .pvr' : '.pvr';
/* 常設入口はプロフィールカードの中。カードごと見たいので、上の登録情報から入れる。 */
if (scene === 'invite' && !full) {
  await page.evaluate(() => {
    const el = document.getElementById('profile-card');
    if (el) el.scrollIntoView({ block: 'start' });
  });
  await new Promise((r) => setTimeout(r, 400));
}
if (!full && scene !== 'strip') {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ block: 'center' });
  }, target);
  await new Promise((r) => setTimeout(r, 500));
}

if (open) {
  console.log(`開きました（${scene} / ${lang} / ${theme} / ${vw}px）。窓を閉じると終わります。`);
  /* ★ここを `browser.waitForTarget(() => false)` で待たない。
     puppeteer の待ち時間の既定は30秒で、時間切れの例外を握りつぶすと
     そのまま process.exit(0) に落ちて、**誰も触っていないのに窓が消える**
     （2026-08-19 に実際に起きた。渡した3つの窓が30秒で勝手に閉じた）。
     待つべきは時間ではなく「窓が閉じられたこと」＝ブラウザとの接続が切れたこと。 */
  await new Promise((r) => browser.on('disconnected', r));
  process.exit(0);
}

/* ── 撮る前に「出ているべきものが出ているか」を判定する ───────────── */
const seen = await page.evaluate(() => {
  const c = document.querySelector('.pvr');
  return {
    card: !!c, strip: !!document.querySelector('.pvr-strip'),
    go: !!document.querySelector('[data-pvr-go]'),
    floor: !!document.getElementById('bench-gap'),
    text: c ? c.innerText : (document.getElementById('bench-gap') || {}).innerText || ''
  };
});
const die = async (msg) => { await browser.close(); console.error('❌ ' + msg); process.exit(1); };

if (scene === 'strip' && !seen.strip) await die('招待状が出ていない');
if (scene === 'floor') {
  if (seen.card) await die('招待が読めていないのにカードが出ている');
  if (!seen.floor) await die('床（まだ5人に届いていません）が消えている');
}
if (scene !== 'strip' && scene !== 'floor' && !seen.card) await die('招待カードが出ていない');
/* ★常設入口の約束。gap を引かない＝人数の話をしないので、数字が1文字も出ない。 */
if (scene === 'invite') {
  if (!await page.evaluate(() => !!document.querySelector('.pvr[data-v="profile"]')))
    await die('常設入口が profile の姿で出ていない（暗いページに白いカードが出ていないか）');
  if (/\d/.test(seen.text)) await die('常設入口に数字が出ている: ' + JSON.stringify(seen.text));
}
/* ★この2行がこの機能の約束そのもの。撮る前に機械で確かめる。 */
if ((scene === 'few' || scene === 'bfew')) {
  const leak = seen.text.replace(/5人/g, '').replace(/1人/g, '')
                        .replace(/five pilots/gi, '').replace(/one pilot/gi, '');
  if (/\d/.test(leak)) await die('n≦2 なのに人数を推測できる数字が出ている: ' + JSON.stringify(seen.text));
}
if ((scene === 'open' || scene === 'bopen') && seen.go) await die('5人そろっているのに招待の導線が出ている');

await page.screenshot({ path: outPath, fullPage: full });

/* 横にはみ出していないか（390px でよく起きる）。 */
const over = await page.evaluate(() => {
  const w = document.documentElement.clientWidth, list = [];
  for (const el of document.querySelectorAll('.pvr, .pvr *, .pvr-strip, .pvr-strip *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.right > w + 1 || r.left < -1) list.push(el.className || el.tagName);
  }
  return list;
});
await browser.close();
console.log(`保存: ${outPath}`);
if (over.length) console.log('⚠️ 横にはみ出している: ' + over.join(', '));
