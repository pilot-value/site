/* shot-actual-pay.mjs — 「他のパイロットの実給与を見る」を目で見るためだけのスクリプト
     （判定は assert-pay-rows.mjs が持つ。こちらは絵を出すだけ）

   この画面はログインしていないと login.html へ飛ぶ。素の localhost URL では
   中身が出ないので、ここで Supabase ごと差し替えて開く。

   実行: node shot-actual-pay.mjs <scene> <lang> [open]
     scene = locked   鍵が無い人（金額が1つも出ない・骨組みと導線だけ）
             locked-nostat ★サーバをまだ貼り替えていない＝数字カードが1枚も出ない
             locked-panel ★左メニューの DEEP PAY を押して説明を出したところ
             locked-ready ★先に内訳を出してくれた人（✓ 準備は完了しています）
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
     サーバが返すのはこの番号だけで、日付も年月も返らない。ここでも番号しか作らない。
   ⚠️ **段 3・4 をここで作らないこと**（2026-08-25 オーナー指摘
      「このサイト始めたの4ヶ月前くらいなんだけど。それより前とかあるはずがない」）。
      いちばん古い会員登録が 2026-05-04＝約4ヶ月前なので、本番にありうるのは 0〜2 だけ。
      3・4 の言葉が画面に出ていたら、それは作り物を見せているということ。
      （サーバ側は5段のまま。来年になれば普通に届く。）
   ★並びは**新しい順（新しいほうが上）**（2026-08-25 オーナー指示）。
      段は同じ時刻から出るので、上から下へ段は 0→2 の向きにしか動かない。
      ここで作る行も必ずその向きに並べる。逆流させると本番に無い絵になる。 */
const R = (air, pos, usd, vf, age) => ({
  airline: air, pos: pos, annual_usd: usd, verified: !!vf, age: age || 0 });

/* 数え上げ。★サーバ（pv_pay_rows）の stats と同じ形。
   reports ＝ 提出の件数（同じ人の複数月もそれぞれ1件）、month ＝ 今月に入った件数。
   ⚠️ 必ず reports ≧ 行数。ここを行数より小さくすると、
      「126件なのに表は60行」の逆＝説明のつかない絵になる。 */
const ST = (reports, month) => ({ reports: reports, month: month });

/* ★鍵が無い人にも来る数え上げ（2026-08-25 オーナー判断）。
   行が1件も返らないので、社数もサーバーが数えて渡す。
   contributors ＝ 給与を出したユニークな人数（DEEP PAY の「N / 100人」の分子）。
   ⚠️ ここは**いまの本番の実測**（13行 / 7社 / 出した人は14人。2026-08-25 に db/usage.mjs で確認）に合わせてある。
      分子を大きく作ると、本番に無い絵を見ることになる。 */
const ST_LOCK = { reports: 13, month: 4, airlines: 7, contributors: 14 };

/* ★いまの本番をそのまま写した13行（2026-08-23 に読んで確認した実測）。
   内訳は 本棚8人 ＋ 登録前の預かり5人。会社は7社。
   ・全員が手入力（verify_level 0）なので ✓ Verified は1行も付かない。そこを絵で確かめる。
   ・オーナーの動作確認4行は消してもらう前提なので入れていない。
   ・預かりのうち1件（月額の欄に年額 ¥1,200万）は「常識の幅」で落ちるので入れていない。
   ・10件で1ページなので、この13行で2ページ目が出る。
   ⚠️ 実測なのは金額と会社と職位まで。**時期の段はこちらで振った作り物**
      （本番の投稿日は読んでいない）。給与レポートも預かりも 2026-08 に入ってからの
      ものばかりなので 0（1ヶ月以内）に寄せ、少しだけ 1 を混ぜてある。
   ★並びは新しい順なので、段の小さいほう（新しいほう）から先に置く。
   ★13人の内訳は 本棚（pay_reports）8人 ＋ 登録前の預かり（pending）5人。
      サーバは出どころで分けずに時刻だけで並べるので、ここでも混ぜて置く
      （出どころごとに固めると、本番に無い並びの絵になる）。 */
const ROWS = [
  R('ana', 'fo', 110000, false, 0),                 // 預かり
  R('singapore-airlines', 'cap', 330000, false, 0), // 預かり
  R('ana', 'fo',  94000, false, 0),                 // 預かり
  R('air-canada', 'cap', 240000, false, 0),         // 預かり
  R('zipair', 'fo', 82000, false, 0),               // 預かり
  R('eva-air', 'cap', 170000, false, 0),
  R('ana', 'cap', 180000, false, 0),
  R('lufthansa', 'fo', 140000, false, 0),
  R('ana', 'fo', 110000, false, 0),
  R('jal', 'fo',  81000, false, 0),
  R('ana', 'fo',  95000, false, 1),
  R('jal', 'fo',  99000, false, 1),
  R('ana', 'fo', 110000, false, 1),
];

/* ★口コミに書かれていた給与（2026-08-24 に合流させたぶん）。
   本番は8件あるが、うち1人は同じ会社・同じ職位で明細も出していたのでサーバ側で落ちる＝7行。
   内訳は ana 3 / jal 2 / emirates 1 / other 1。
   ・口コミフォームはもう金額を集めていないので、**この7行が打ち止め**。将来増えない
   ・給与レポートより前の時期のものなので、段は 1〜2 に寄る。
     ⚠️ 3・4 にしないこと。サイトはまだ約4ヶ月しか経っていない（上の ⚠️）
   ・出典は明細と同じ「本人記録」（札を3種類に増やさない＝オーナー決定）
   ・1行は airline:'other'＝打ち込まれた社名が語彙に当たらなかった人。
     画面は「一覧にない航空会社」と書く（2026-08-25 オーナー指示。前は「その他の航空会社」）
   ⚠️ 金額は作り物。実際の8件の額はここに写していない。 */
const FROM_REVIEWS = [
  R('ana', 'fo',  100000, false, 1),
  R('jal', 'fo',   96000, false, 1),
  R('ana', 'cap', 170000, false, 1),
  R('emirates', 'cap', 230000, false, 2),
  R('other', 'fo',  88000, false, 2),
  R('jal', 'cap', 180000, false, 2),
  R('ana', 'cap', 160000, false, 2),
];

/* 合流した後の20行。★並びは**新しい順（新しいほうが上）**。
   口コミ由来は給与レポートより古いので、自然と後ろのほうに来る。
   ここを混ぜ返さないこと＝本番と違う絵になる。 */
const MERGED = [...ROWS, ...FROM_REVIEWS];
/* もっと集まったら、という絵。★並びは新しい順（新しいほうが上）なので、
   段は上から 0 → 1 → 2 の向きにしか動かない。
   会社と金額はばらけさせる（会社ごとに固めると絞り込みの絵が読めない）。
   ★段は 0〜2 だけ。サイトはまだ約4ヶ月なので 3・4 は本番にありえない（上の ⚠️）。 */
const MANY = [
  R('cathay-pacific', 'fo', 125000, false, 0),
  R('korean-air', 'cap', 175000, false, 0),
  R('ana', 'fo', 98000, false, 0),
  R('emirates', 'fo', 150000, false, 0),
  R('qatar-airways', 'cap', 260000, true, 0),
  R('jal', 'fo', 105000, false, 0),
  R('ana', 'cap', 180000, true, 0),
  R('eva-air', 'fo', 105000, false, 1),
  R('other', 'fo', 90000, false, 1),
  R('zipair', 'fo', 86000, false, 1),
  R('jal', 'fo', 112000, false, 1),
  R('lufthansa', 'fo', 110000, false, 1),
  R('ana', 'cap', 195000, false, 1),
  R('cathay-pacific', 'cap', 200000, false, 1),
  R('emirates', 'cap', 240000, false, 1),
  R('jal', 'cap', 185000, true, 2),
  R('other', 'cap', 130000, false, 2),
  R('korean-air', 'fo', 95000, false, 2),
  R('jal', 'cap', 190000, false, 2),
  R('ana', 'fo', 120000, false, 2),
  R('lufthansa', 'cap', 160000, false, 2),
  R('singapore-airlines', 'fo', 130000, false, 2),
];

const SCENES = {
  /* ★鍵が無い人の画面（2026-08-25 に作り直した）。
     数え上げは見せる。行は1件も返らないので、一覧は中身の無い骨組みで出る。
     ⚠️ 骨組みは**ぼかしではない**。隠しているのではなく、渡されていない。 */
  locked: { pay: { ok: true, state: 'locked', rows: [], stats: ST_LOCK,
                   give: { basic: false, detailed: false, payslip: false } } },
  /* ★サーバ（db/pay-rows.sql）をまだ貼り替えていないとき。
     数が1つも読めないので、カードは1枚も出ない＝埋めるための 0 を置かない。 */
  'locked-nostat': { pay: { ok: true, state: 'locked', rows: [] } },
  /* ★左メニューのロックを押したときの説明（2026-08-25）。
     覆いではないので、下のページが残ったまま上に1枚差し込まれる。
     DEEP PAY は条件が2つ（100人 ／ 本人の内訳）。まだ内訳を出していない人の絵。 */
  'locked-panel': { pay: { ok: true, state: 'locked', rows: [], stats: ST_LOCK,
                           give: { basic: false, detailed: false, payslip: false } },
                    gate: 'deep' },
  /* ★先に内訳を出してくれた人。「出し損」に見えないことを絵で確かめる。 */
  'locked-ready': { pay: { ok: true, state: 'locked', rows: [], stats: ST_LOCK,
                           give: { basic: true, detailed: true, payslip: false } },
                    gate: 'deep' },
  empty:  { pay: { ok: true, state: 'open', rows: [], stats: ST(0, 0) } },
  rows:   { pay: { ok: true, state: 'open', rows: ROWS,   stats: ST(17, 4) } },
  /* ★口コミ由来の7人が混ざった状態。行が13→20に増える。
     口コミのほうが古いので、下のほうに「6ヶ月以内」が並ぶ。 */
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

if (S.gate) {
  await page.evaluate((k) => {
    const b = document.querySelector('[data-mr-gate="' + k + '"]');
    if (b) b.click();
  }, S.gate);
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
