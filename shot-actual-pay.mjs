/* shot-actual-pay.mjs — 「他のパイロットの実給与を見る」を目で見るためだけのスクリプト
     （判定は assert-pay-rows.mjs が持つ。こちらは絵を出すだけ）

   この画面はログインしていないと login.html へ飛ぶ。素の localhost URL では
   中身が出ないので、ここで Supabase ごと差し替えて開く。

   実行: node shot-actual-pay.mjs <scene> <lang> [open]
     scene = locked   鍵が無い人（金額が1つも出ない・導線だけ）
             empty    鍵はあるが1件も無い（正直な1枚）
             rows     いまの本番と同じ規模（13人・全員が手入力＝✓ は付かない）
             many     もっと集まった状態（2ページ目・数字のページ番号が出る）
             picked   会社で絞った状態（絞り込みが効いているところ）
             find     会社を打ち込んで絞ったところ
             nostat   ★サーバがまだ古い（stats を返さない）＝カードが2枚だけ出る
     lang  = ja | en
     第3引数以降  open  撮らずに見える窓で開いたままにする
                  dark  暗いほうで撮る
                  w=980 幅を変えて撮る（既定 1440）。★2段組が畳まれる幅を見るのに要る

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
const show  = process.argv.slice(4).includes('open');
/* ★暗いほうも撮る。カードも表も右の棒も、暗い側でだけ崩れることがある。 */
const theme = process.argv.slice(4).includes('dark') ? 'dark' : 'light';
/* 幅。★.ap-cols（表＋右の棒）は 1080px で1段に畳まれ、.mr-side は 960px で横並びになる。
   どちらも「畳まれた側」を見ないと崩れに気づけない。 */
const wArg = process.argv.slice(4).find((a) => /^w=\d+$/.test(a));
const W = wArg ? Number(wArg.slice(2)) : 1440;

const UID = '00000000-0000-4000-8000-00000000c001';

/* 作り物の行。★ana / jal は実在の会社だが、この金額は作った数字。
   サーバは有効数字2桁で返すので、こちらもその形にそろえてある。
   ★1行＝1人。同じ人の複数月はサーバ側で1行に畳まれているので、ここも1人1行。
   ★自由入力の社名の人は airline:'other' で来る（打ち込まれた文字列は来ない）。
   ★機材（fleet）も支給の内訳（comp）も 2026-08-24 に返さなくした。
     ここに足すと、サーバが返さないものを絵にしてしまう。 */
const R = (air, pos, usd, vf) => ({
  airline: air, pos: pos, annual_usd: usd, verified: !!vf });

/* 数え上げ。★サーバ（pv_pay_rows）の stats と同じ形。
   reports ＝ 提出の件数（同じ人の複数月もそれぞれ1件）、month ＝ 今月に入った件数。
   ⚠️ 必ず reports ≧ 行数。ここを行数より小さくすると、
      「126件なのに表は60行」の逆＝説明のつかない絵になる。 */
const ST = (reports, month) => ({ reports: reports, month: month });

/* ★いまの本番をそのまま写した13行（2026-08-23 に読んで確認した実測）。
   内訳は 本棚8人 ＋ 登録前の預かり5人。会社は7社。
   ・全員が手入力（verify_level 0）なので ✓ Verified は1行も付かない。そこを絵で確かめる。
   ・オーナーの動作確認4行は消してもらう前提なので入れていない。
   ・預かりのうち1件（月額の欄に年額 ¥1,200万）は「常識の幅」で落ちるので入れていない。
   ・10件で1ページなので、この13行で2ページ目が出る。 */
const ROWS = [
  // ── 本棚（pay_reports・8人）
  R('jal', 'fo',  81000),
  R('ana', 'fo', 110000),
  R('ana', 'fo', 110000),
  R('lufthansa', 'fo', 140000),
  R('jal', 'fo',  99000),
  R('eva-air', 'cap', 170000),
  R('ana', 'fo',  95000),
  R('ana', 'cap', 180000),
  // ── 登録前の預かり（pay_reports_pending・5人。✓ は付かない）
  R('ana', 'fo', 110000),
  R('zipair', 'fo', 82000),
  R('ana', 'fo',  94000),
  R('singapore-airlines', 'cap', 330000),
  R('air-canada', 'cap', 240000),
];
/* もっと集まったら、という絵。★並びは md5(proof_hash) 順＝会社も金額もばらける。
   会社ごとに固めて並べない（固めると「順不同」に見えない）。 */
const MANY = [
  R('ana', 'cap', 180000, true),
  R('singapore-airlines', 'fo', 130000),
  R('other', 'cap', 130000),
  R('lufthansa', 'cap', 160000),
  R('jal', 'fo', 105000),
  R('emirates', 'cap', 240000),
  R('ana', 'fo', 120000),
  R('cathay-pacific', 'cap', 200000),
  R('qatar-airways', 'cap', 260000, true),
  R('jal', 'cap', 190000),
  R('other', 'fo', 90000),
  R('korean-air', 'fo', 95000),
  R('ana', 'cap', 195000),
  R('emirates', 'fo', 150000),
  R('lufthansa', 'fo', 110000),
  R('jal', 'cap', 185000, true),
  R('ana', 'fo', 98000),
  R('jal', 'fo', 112000),
  R('zipair', 'fo', 86000),
  R('eva-air', 'fo', 105000),
  R('korean-air', 'cap', 175000),
  R('cathay-pacific', 'fo', 125000),
];

/* 自分の明細（my_pay_reports が返す形）。使い道は分布の「あなた」の破線ただ1つで、
   金額も内訳もこの画面には出ない。
   ★fx_to_jpy は 1（円で出した人）。金額は作り物。 */
const MINE_GROSS = [{
  period_year: 2026, period_month: 7, currency: 'JPY', fx_to_jpy: 1,
  gross_monthly: 950000, bonus_month: 0, bonus_annual: 2200000,
  per_diem: 42000, housing_type: 'allowance', housing_amount: 20000,
  annual_total_usd: 96000,
}];
const MINE_FULL = [{
  period_year: 2026, period_month: 7, currency: 'JPY', fx_to_jpy: 1,
  base_pay: 620000, command_pay: 90000, flight_variable_pay: 110000,
  other_allowance: 140000, per_diem: 42000,
  housing_type: 'allowance', housing_amount: 20000, transport: 18000,
  bonus_annual: 2200000, annual_total_usd: 132000,
}];

const SCENES = {
  /* ★鍵が無い人には stats も来ない（サーバがそう作ってある）。カードは1枚も出ない。 */
  locked: { pay: { ok: true, state: 'locked', rows: [] } },
  empty:  { pay: { ok: true, state: 'open', rows: [], stats: ST(0, 0) } },
  rows:   { pay: { ok: true, state: 'open', rows: ROWS, stats: ST(17, 4) }, mine: MINE_GROSS },
  many:   { pay: { ok: true, state: 'open', rows: MANY, stats: ST(58, 11) }, mine: MINE_FULL },
  picked: { pay: { ok: true, state: 'open', rows: MANY, stats: ST(58, 11) },
            mine: MINE_FULL, pick: 'ana' },
  find:   { pay: { ok: true, state: 'open', rows: MANY, stats: ST(58, 11) },
            mine: MINE_FULL, q: 'jal' },
  /* ★サーバをまだ貼り替えていないとき。カードは「一覧のパイロット」と「航空会社」の
     2枚だけになる。空いた分に 0 を置かない＝画面に嘘の数字を作らない、を絵で確かめる。 */
  nostat: { pay: { ok: true, state: 'open', rows: ROWS }, mine: MINE_GROSS },
};
const S = SCENES[scene];
if (!S) { console.error('scene は ' + Object.keys(SCENES).join(' / ')); process.exit(1); }

/* assert-pay-rows.mjs と同じ差し替え。
   ⚠️ rpc は本物と同じ「then だけを持つ箱」＝ async にしない。 */
function stub(page, pay, mine) {
  return page.evaluateOnNewDocument((uid, pay, mine, theme) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('pv-theme', theme);
    const RPC = {
      pv_pay_rows: pay,
      /* ★分布の「あなた」の破線だけに使う。本人の行しか返らない関数。 */
      my_pay_reports: { ok: true, reports: mine || [] },
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
  }, UID, pay, mine, theme);
}

const browser = await puppeteer.launch(show
  ? { headless: false, defaultViewport: null, args: ['--window-size=' + W + ',1100'] }
  : { headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
if (!show) await page.setViewport({ width: W, height: 1100 });
await stub(page, S.pay, S.mine);
await page.goto(BASE + (lang === 'en' ? '/en/' : '/') + 'actual-pay.html',
                { waitUntil: 'networkidle2', timeout: 40000 });
await new Promise((r) => setTimeout(r, 2200));

if (S.pick) {
  await page.evaluate((v) => {
    const s = document.getElementById('ap-air');
    if (!s) return;
    s.value = v;
    s.dispatchEvent(new Event('change', { bubbles: true }));
  }, S.pick);
  await new Promise((r) => setTimeout(r, 500));
}

if (S.q) {
  await page.evaluate((v) => {
    const i = document.getElementById('ap-q');
    if (!i) return;
    i.value = v;
    i.dispatchEvent(new Event('input', { bubbles: true }));
  }, S.q);
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
const out = path.join(dir,
  `screenshot-${n}-actualpay-${scene}-${lang}${W === 1440 ? '' : '-w' + W}${theme === 'dark' ? '-dark' : ''}.png`);

/* ページ全体を撮る（絞り込みの帯と表の関係が見たいので、要素で切り出さない）。 */
const full = await page.evaluate(() => document.documentElement.scrollHeight);
await page.setViewport({ width: W, height: Math.min(full, 3200) });
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: out });
console.log(out.replace(ROOT, ''));
await browser.close();
