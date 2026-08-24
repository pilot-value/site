/* shot-actual-pay.mjs — 「他のパイロットの実給与を見る」を目で見るためだけのスクリプト
     （判定は assert-pay-rows.mjs が持つ。こちらは絵を出すだけ）

   この画面はログインしていないと login.html へ飛ぶ。素の localhost URL では
   中身が出ないので、ここで Supabase ごと差し替えて開く。

   実行: node shot-actual-pay.mjs <scene> <lang> [open]
     scene = locked   鍵が無い人（金額が1つも出ない・導線だけ）
             empty    鍵はあるが1件も無い（正直な1枚）
             rows     SQL を貼る前（明細だけの13人・全員が手入力＝✓ は付かない）
             merged   ★SQL を貼った後（口コミ由来の7人が混ざって20人になる）
             many     もっと集まった状態（2ページ目・数字のページ番号が出る）
             picked   会社で絞った状態（絞り込みが効いているところ）
             find     会社を打ち込んで絞ったところ
             nostat   ★サーバがまだ古い（stats を返さない）＝カードが1枚だけ出る
     lang  = ja | en
     第3引数以降  open  撮らずに見える窓で開いたままにする
                  dark  暗いほうで撮る
                  w=900 幅を変えて撮る（既定 1440）。★カードと6列の表が畳まれる幅を見る

   ★2026-08-24、この画面から図を全部外した。右の棒も「あなた」の破線も無い。
     だから本人の明細（my_pay_reports）はもう引いていない＝ここでも作らない。

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
/* ★暗いほうも撮る。カードも表も、暗い側でだけ崩れることがある。 */
const theme = process.argv.slice(4).includes('dark') ? 'dark' : 'light';
/* 幅。★カード3枚は 760px で1列に畳まれ、.mr-side は 960px で横並びになる。
   表は6列あるので、狭いほうから先に「投稿時期」が詰まる。
   「畳まれた側」を見ないと崩れに気づけない。 */
const wArg = process.argv.slice(4).find((a) => /^w=\d+$/.test(a));
const W = wArg ? Number(wArg.slice(2)) : 1440;

const UID = '00000000-0000-4000-8000-00000000c001';

/* 作り物の行。★ana / jal は実在の会社だが、この金額は作った数字。
   サーバは有効数字2桁で返すので、こちらもその形にそろえてある。
   ★1行＝1人。同じ人の複数月はサーバ側で1行に畳まれているので、ここも1人1行。
   ★自由入力の社名の人は airline:'other' で来る（打ち込まれた文字列は来ない）。
   ★機材（fleet）も支給の内訳（comp）も 2026-08-24 に返さなくした。
     ここに足すと、サーバが返さないものを絵にしてしまう。
   ★age ＝ 投稿時期の段。0=1ヶ月以内 / 1=3ヶ月以内 / 2=6ヶ月以内 / 3=1年以内 / 4=それより前。
     サーバが返すのはこの番号だけで、日付も年月も返らない。ここでも番号しか作らない。 */
const R = (air, pos, usd, vf, age) => ({
  airline: air, pos: pos, annual_usd: usd, verified: !!vf, age: age || 0 });

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
   ・10件で1ページなので、この13行で2ページ目が出る。
   ⚠️ 実測なのは金額と会社と職位まで。**時期の段はこちらで振った作り物**
      （本番の投稿日は読んでいない）。だいたい直近＝0〜1 に寄せてある。 */
const ROWS = [
  // ── 本棚（pay_reports・8人）
  R('jal', 'fo',  81000, false, 0),
  R('ana', 'fo', 110000, false, 0),
  R('ana', 'fo', 110000, false, 1),
  R('lufthansa', 'fo', 140000, false, 0),
  R('jal', 'fo',  99000, false, 1),
  R('eva-air', 'cap', 170000, false, 2),
  R('ana', 'fo',  95000, false, 1),
  R('ana', 'cap', 180000, false, 0),
  // ── 登録前の預かり（pay_reports_pending・5人。✓ は付かない）
  R('ana', 'fo', 110000, false, 0),
  R('zipair', 'fo', 82000, false, 1),
  R('ana', 'fo',  94000, false, 0),
  R('singapore-airlines', 'cap', 330000, false, 2),
  R('air-canada', 'cap', 240000, false, 1),
];

/* ★口コミに書かれていた給与（2026-08-24 に合流させたぶん）。
   本番は8件あるが、うち1人は同じ会社・同じ職位で明細も出していたのでサーバ側で落ちる＝7行。
   内訳は ana 3 / jal 2 / emirates 1 / other 1。
   ・口コミフォームはもう金額を集めていないので、**この7行が打ち止め**。将来増えない
   ・だから時期の段は 3〜4（1年以内・それより前）に寄る。ここが列を足した甲斐のあるところ
   ・出典は明細と同じ「本人記録」（札を3種類に増やさない＝オーナー決定）
   ⚠️ 金額は作り物。実際の8件の額はここに写していない。 */
const FROM_REVIEWS = [
  R('ana', 'cap', 170000, false, 3),
  R('ana', 'cap', 160000, false, 4),
  R('ana', 'fo',  100000, false, 3),
  R('jal', 'cap', 180000, false, 4),
  R('jal', 'fo',   96000, false, 4),
  R('emirates', 'cap', 230000, false, 3),
  R('other', 'fo',  88000, false, 4),
];

/* 合流した後の20行。★並びは md5(人のキー) 順なので、口コミ由来は末尾に固まらない。
   後ろにくっつけると「古いのが下」に見えてしまい、並びに時間があるように読める。 */
const MERGED = [
  ROWS[0], FROM_REVIEWS[3], ROWS[1], ROWS[2], FROM_REVIEWS[0],
  ROWS[3], FROM_REVIEWS[6], ROWS[4], ROWS[5], FROM_REVIEWS[2],
  ROWS[6], ROWS[7], FROM_REVIEWS[5], ROWS[8], ROWS[9],
  FROM_REVIEWS[1], ROWS[10], FROM_REVIEWS[4], ROWS[11], ROWS[12],
];
/* もっと集まったら、という絵。★並びは md5(proof_hash) 順＝会社も金額も時期もばらける。
   会社ごとに固めて並べない（固めると「順不同」に見えない）。
   ★時期の段も5つ全部を混ぜてある。並びが時期順に見えたら、それは崩れているということ。 */
const MANY = [
  R('ana', 'cap', 180000, true, 0),
  R('singapore-airlines', 'fo', 130000, false, 3),
  R('other', 'cap', 130000, false, 1),
  R('lufthansa', 'cap', 160000, false, 4),
  R('jal', 'fo', 105000, false, 0),
  R('emirates', 'cap', 240000, false, 2),
  R('ana', 'fo', 120000, false, 4),
  R('cathay-pacific', 'cap', 200000, false, 1),
  R('qatar-airways', 'cap', 260000, true, 0),
  R('jal', 'cap', 190000, false, 3),
  R('other', 'fo', 90000, false, 2),
  R('korean-air', 'fo', 95000, false, 4),
  R('ana', 'cap', 195000, false, 1),
  R('emirates', 'fo', 150000, false, 0),
  R('lufthansa', 'fo', 110000, false, 3),
  R('jal', 'cap', 185000, true, 2),
  R('ana', 'fo', 98000, false, 0),
  R('jal', 'fo', 112000, false, 1),
  R('zipair', 'fo', 86000, false, 4),
  R('eva-air', 'fo', 105000, false, 2),
  R('korean-air', 'cap', 175000, false, 3),
  R('cathay-pacific', 'fo', 125000, false, 0),
];

const SCENES = {
  /* ★鍵が無い人には stats も来ない（サーバがそう作ってある）。カードは1枚も出ない。 */
  locked: { pay: { ok: true, state: 'locked', rows: [] } },
  empty:  { pay: { ok: true, state: 'open', rows: [], stats: ST(0, 0) } },
  rows:   { pay: { ok: true, state: 'open', rows: ROWS,   stats: ST(17, 4) } },
  /* ★口コミ由来の7人が混ざった状態。行が13→20に増え、
     いちばん右に「1年以内」「それより前」が出てくる。 */
  merged: { pay: { ok: true, state: 'open', rows: MERGED, stats: ST(24, 4) } },
  many:   { pay: { ok: true, state: 'open', rows: MANY, stats: ST(58, 11) } },
  picked: { pay: { ok: true, state: 'open', rows: MANY, stats: ST(58, 11) }, pick: 'ana' },
  find:   { pay: { ok: true, state: 'open', rows: MANY, stats: ST(58, 11) }, q: 'jal' },
  /* ★サーバをまだ貼り替えていないとき。数えられるのは会社数だけなので
     カードは1枚になる。空いた分に 0 を置かない＝画面に嘘の数字を作らない、を絵で確かめる。 */
  nostat: { pay: { ok: true, state: 'open', rows: ROWS } },
};
const S = SCENES[scene];
if (!S) { console.error('scene は ' + Object.keys(SCENES).join(' / ')); process.exit(1); }

/* assert-pay-rows.mjs と同じ差し替え。
   ⚠️ rpc は本物と同じ「then だけを持つ箱」＝ async にしない。 */
function stub(page, pay) {
  return page.evaluateOnNewDocument((uid, pay, theme) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('pv-theme', theme);
    /* ★my_pay_reports は置かない。この画面はもう本人の明細を引かないので、
       置くと「引いても気づかない」状態を自分で作ることになる。 */
    const RPC = {
      pv_pay_rows: pay,
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
  }, UID, pay, theme);
}

const browser = await puppeteer.launch(show
  ? { headless: false, defaultViewport: null, args: ['--window-size=' + W + ',1100'] }
  : { headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
if (!show) await page.setViewport({ width: W, height: 1100 });
await stub(page, S.pay);
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
