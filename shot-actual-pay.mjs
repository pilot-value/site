/* shot-actual-pay.mjs — 「他のパイロットの実給与を見る」を目で見るためだけのスクリプト
     （判定は assert-pay-rows.mjs が持つ。こちらは絵を出すだけ）

   この画面はログインしていないと login.html へ飛ぶ。素の localhost URL では
   中身が出ないので、ここで Supabase ごと差し替えて開く。

   実行: node shot-actual-pay.mjs <scene> <lang> [open]
     scene = locked   鍵が無い人（金額が1つも出ない・導線だけ）
             empty    鍵はあるが1件も無い（正直な1枚）
             rows     いまの本番と同じ規模（13人・全員が手入力＝✓ は付かない）
             many     もっと集まった状態（会社も機材もばらけている）
             picked   会社で絞った状態（絞り込みが効いているところ）
             sel      行を選んだところ（賞与20%のANA＝色が分かれる行）
             mono     ★ほぼ1色になる行を選んだところ（zipair＝月給99%）
             nobd     内訳を出せない行を選んだところ（静かに断る一枚）
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
const show  = process.argv.slice(4).includes('open');
/* ★暗いほうも撮る。図は pay-viz.css が暗い前提で、明るい側だけ actual-pay.css が上書きする。
   どちらか一方しか見ないと、片方の配色が崩れたまま気づけない。 */
const theme = process.argv.slice(4).includes('dark') ? 'dark' : 'light';

const UID = '00000000-0000-4000-8000-00000000c001';

/* 作り物の行。★ana / jal は実在の会社だが、この金額は作った数字。
   サーバは有効数字2桁で返すので、こちらもその形にそろえてある。
   ★1行＝1人。同じ人の複数月はサーバ側で1行に畳まれているので、ここも1人1行。
   ★自由入力の社名の人は airline:'other' で来る（打ち込まれた文字列は来ない）。 */
const R = (air, pos, fleet, usd, vf, comp) => ({
  airline: air, pos: pos, fleet: fleet, annual_usd: usd, verified: !!vf,
  comp: comp || null });

/* 支給の内訳。★サーバ（pv_pay_rows）が返すのと同じ形＝整数パーセント5本で合計100。
   金額は1つも入らない。m 月々の支給 / b 年1回の賞与 / d パーディアム /
   h 住宅手当 / o その他の手当。
   ★下の数字は 2026-08-23 に本番を読んで実測した割合をそのまま写している
     （ANA副操縦士A320 = 75/20/4/1、zipair = 99/1、air-canada = 96/4）。
     ここを「見栄えのいい割合」に作り替えないこと。ほぼ1色になる行が本当に
     出るかどうかを、この絵で確かめている。 */
const C = (m, b, dd, h, o) => ({ m: m, b: b, d: dd, h: h, o: o });

/* ★いまの本番をそのまま写した13行（2026-08-23 に読んで確認した実測）。
   内訳は 本棚8人 ＋ 登録前の預かり5人。会社は7社。
   ・全員が手入力（verify_level 0）なので ✓ Verified は1行も付かない。そこを絵で確かめる。
   ・オーナーの動作確認4行は消してもらう前提なので入れていない。
   ・預かりのうち1件（月額の欄に年額 ¥1,200万）は「常識の幅」で落ちるので入れていない。
   ・10件で1ページなので、この13行で2ページ目が出る。 */
const ROWS = [
  // ── 本棚（pay_reports・8人）
  R('jal', 'fo', 'b737',  81000, 0, C(97, 0, 3, 0, 0)),
  R('ana', 'fo', 'a320', 110000, 0, C(75, 20, 4, 1, 0)),   // ← 実測。色が分かれる行
  R('ana', 'fo', 'a320', 110000, 0, C(76, 19, 4, 1, 0)),
  R('lufthansa', 'fo', 'a320', 140000, 0, C(70, 14, 6, 6, 4)),
  R('jal', 'fo', 'b737',  99000, 0, C(97, 0, 3, 0, 0)),
  R('eva-air', 'cap', 'b777', 170000, 0, C(68, 22, 6, 4, 0)),
  R('ana', 'fo', 'a320',  95000),                          // ← 内訳を出せない行（comp なし）
  R('ana', 'cap', 'b787', 180000, 0, C(96, 0, 3, 1, 0)),   // ← 実測。ほぼ1色
  // ── 登録前の預かり（pay_reports_pending・5人。✓ は付かない）
  R('ana', 'fo', 'b777', 110000, 0, C(78, 17, 4, 1, 0)),
  R('zipair', 'fo', 'a220', 82000, 0, C(99, 0, 1, 0, 0)),  // ← 実測。ほぼ1色
  R('ana', 'fo', 'a320',  94000, 0, C(75, 20, 4, 1, 0)),
  R('singapore-airlines', 'cap', 'b777', 330000, 0, C(62, 26, 7, 5, 0)),
  R('air-canada', 'cap', 'a320', 240000, 0, C(96, 0, 4, 0, 0)),  // ← 実測。ほぼ1色
];
/* もっと集まったら、という絵。★並びは md5(proof_hash) 順＝会社も金額もばらける。
   会社ごとに固めて並べない（固めると「順不同」に見えない）。 */
const MANY = [
  R('ana', 'cap', 'b787', 180000, true, C(74, 21, 4, 1, 0)),
  R('singapore-airlines', 'fo', 'a350', 130000, 0, C(64, 24, 7, 5, 0)),
  R('other', 'cap', 'b737', 130000, 0, C(97, 0, 3, 0, 0)),
  R('lufthansa', 'cap', 'a320', 160000, 0, C(69, 15, 6, 6, 4)),
  R('jal', 'fo', 'b737', 105000, 0, C(96, 0, 4, 0, 0)),
  R('emirates', 'cap', 'b777', 240000, 0, C(55, 9, 12, 24, 0)),   // 住宅手当の大きい形
  R('ana', 'fo', 'b787', 120000),                                  // 内訳なし
  R('cathay-pacific', 'cap', 'a350', 200000, 0, C(71, 16, 8, 5, 0)),
  R('qatar-airways', 'cap', 'a380', 260000, true, C(58, 10, 11, 21, 0)),
  R('jal', 'cap', 'b777', 190000, 0, C(95, 0, 4, 1, 0)),
  R('other', 'fo', 'a320', 90000, 0, C(99, 0, 1, 0, 0)),
  R('korean-air', 'fo', 'b737', 95000),                            // 内訳なし
  R('ana', 'cap', 'b777', 195000, 0, C(73, 22, 4, 1, 0)),
  R('emirates', 'fo', 'b777', 150000, 0, C(57, 8, 13, 22, 0)),
  R('lufthansa', 'fo', 'a320', 110000, 0, C(70, 14, 6, 6, 4)),
  R('jal', 'cap', 'a350', 185000, true, C(94, 0, 5, 1, 0)),
];

/* 自分の明細（my_pay_reports が返す形）。左のドーナツの既定はこれ。
   ★2つ用意する。本番は**ほとんどの人が総支給1本**で出していて、その場合の図は
     灰色（内訳を入れていない分）が大半を占める。そこを絵で確かめるため。
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
  locked: { pay: { ok: true, state: 'locked', rows: [] } },
  empty:  { pay: { ok: true, state: 'open', rows: [] } },
  rows:   { pay: { ok: true, state: 'open', rows: ROWS }, mine: MINE_GROSS },
  many:   { pay: { ok: true, state: 'open', rows: MANY }, mine: MINE_FULL },
  picked: { pay: { ok: true, state: 'open', rows: MANY }, mine: MINE_FULL, pick: 'ana' },
  /* 行を選んだところ。番号は ROWS の並びそのもの（1ページ目に全部ある）。 */
  sel:    { pay: { ok: true, state: 'open', rows: ROWS }, mine: MINE_GROSS, row: 1 },
  mono:   { pay: { ok: true, state: 'open', rows: ROWS }, mine: MINE_GROSS, row: 9 },
  nobd:   { pay: { ok: true, state: 'open', rows: ROWS }, mine: MINE_GROSS, row: 6 },
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
      /* ★左のドーナツの既定＝自分の支給構成。本人の行しか返らない関数。 */
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
  ? { headless: false, defaultViewport: null, args: ['--window-size=1440,1100'] }
  : { headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
if (!show) await page.setViewport({ width: 1440, height: 1100 });
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

if (S.row != null) {
  const hit = await page.evaluate((i) => {
    const tr = document.querySelector('[data-ap-row="' + i + '"]');
    if (!tr) return false;
    tr.click();
    return true;
  }, S.row);
  if (!hit) console.error('⚠️ 行 ' + S.row + ' が見つからなかった（選ばずに撮る）');
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

/* ページ全体を撮る（絞り込みの帯と表の関係が見たいので、要素で切り出さない）。 */
const full = await page.evaluate(() => document.documentElement.scrollHeight);
await page.setViewport({ width: 1440, height: Math.min(full, 3200) });
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: out });
console.log(out.replace(ROOT, ''));
await browser.close();
