/* assert-referral.mjs — 招待（データ密度ループ）の約束を機械で確かめる。

   作ったのはシェアボタンではない。「同じ会社・職位・機種・年で5人そろわないと
   比較が出ない」という行き止まりを、「あと2人で、より詳しい比較 → 仲間を1人招待」に
   変える仕組み。だから守るべき約束は、見た目ではなくこの5つ：

     ① n≦2 のとき、画面に数字が1文字も出ない
        （「5人未満の件数は出さない」は pay-tracker.js:23-25 / index.html:652-654 /
          my-value.js:802-804 の3か所に理由つきで書いてある。今回の例外は
          n=3・4 のときの「2」「1」だけ。ここが破れたら機能ごと引き上げる）
     ② n=3・4 でだけ「あと2人／あと1人」、n≧5 では招待の導線を出さない
     ③ ?ref= が Google・6桁コード・言語切替をまたいで生き残る
        （クエリを捨てる場所が4つあるので、運び手は localStorage）
     ④ 待遇モーダル（pv-conditions.js）とぶつからない
        ＝こちらは本物のモーダルを作らない。ソースを grep して position:fixed /
          role="dialog" / aria-modal / body.style.overflow を禁じる
          （覆いが2枚出るとどちらも閉じられない）。
          着地の1枚は画面の中央に出るが、スクロールを止めず nav も覆わない＝
          下へ動かせば必ず抜けられる。閉じ方も3つ（× ・カードの外 ・ESC）ある。
     ⑤ マイページの常設入口は条件で消えない
        （給与を1件も出していなくても・5人そろっていても・回数制限の休み中でも出る。
          文脈カードはこの3つで消えるので、ここが消えると「招待したい」と
          思った人の行き先がサイトから無くなる。2026-08-19 に実際そうなっていた）

   ついでに「嘘をつかない」も見る：招待の文面に金額も勤務先の名前も入らないこと。
   そして送る文面に VISION が入っていること — この文面はサービスを外から見る
   唯一の入口で、「便利なサイトがある」だけに戻すと招待の意味が消える
   （2026-08-19、オーナー指摘。同時に文面の変種3つを消した）。

   ⚠️ 偽物 Supabase の rpc は本物と同じ「then だけを持つ箱」にしてある。
      async にすると本番に無い .catch が生えて、2026-08-19 の真っ白事故と
      同じ穴がまた開く（assert-conditions.mjs に経緯あり）。

   実行: node assert-referral.mjs
   ⚠️ localhost が要る（node serve.mjs）。本番の DB には触らない。
*/
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';

const ROOT = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const BASE = 'http://localhost:3000';

/* 招待コードの見本。db/referrals.sql と同じ字種（0 1 I L O U を使わない8文字）。
   ★実在のコードではない。テストが作った文字列。 */
const CODE = 'K7QD3XZM';

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + ' ' + e)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ════════════════════════════════════════════════════════════════
// 0. ソースの検査（ブラウザを開かなくても分かること）
// ════════════════════════════════════════════════════════════════
console.log('\n════ ソース ════');

/* ★言葉ではなく実体を見る。pv-referral.js のヘッダーには「position:fixed も
   role="dialog" も書かない」という説明そのものが書いてあり、index.html には
   「lang-toggle.js より前に読む」という注意書きが script タグより前に出てくる。
   素朴に grep すると、説明を足した人が赤くする＝説明を消して直すことになる。 */
const nocomment = (js) => js.replace(/\/\*[\s\S]*?\*\//g, '');
const nohtml = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
const tagAt = (s, name) =>
  s.search(new RegExp('<script[^>]*\\bsrc="[^"]*' + name.replace(/\./g, '\\.') + '"'));

{
  const js = nocomment(read('./pv-referral.js'));

  /* ★これが「待遇モーダルとぶつからない」の本体。仕組みで防ぐのではなく、
     そもそも覆いを作らないことで防いでいる。あとから誰かがモーダル化したら
     ここが赤くなる。position:fixed は CSS 文字列の書き方（隠し textarea の
     ta.style.position = 'fixed' は覆いではないので当たらない）。 */
  for (const [pat, why] of [
    ['position:fixed', '画面に貼り付く箱を作らない'],
    ['aria-modal',     'モーダルにしない'],
    ['role="dialog"',  'ダイアログにしない'],
    ["role='dialog'",  'ダイアログにしない（引用符違い）'],
    ['body.style.overflow', '背後のスクロールを止めない']
  ]) {
    /* occluded() は「覆いが開いているか」を aria-modal で読むだけ＝作ってはいない。
       読む側の1行を除いて数える。 */
    const hits = js.split(pat).length - 1
      - (pat === 'aria-modal' ? (js.split('[aria-modal="true"]').length - 1) : 0);
    ok(hits === 0, `pv-referral.js に ${pat} が無い（${why}）`, String(hits));
  }

  /* ★読み込み順。lang-toggle.js は pv-lang==='en' の人を location.replace() で
     /en/ へ飛ばし、そのときクエリを丸ごと捨てる。先に読まないとコードが消える。 */
  for (const f of ['index.html', 'en/index.html']) {
    const s = read('./' + f);
    const a = tagAt(s, 'pv-referral.js'), b = tagAt(s, 'lang-toggle.js');
    ok(a > 0 && b > 0 && a < b, `${f} は pv-referral.js を lang-toggle.js より前に読む`, `${a} / ${b}`);
  }

  /* 日英2ファイルの罠（pay-report.html:1687 の警告）。片方だけ直すと本番で割れる。 */
  for (const f of ['pay-report.html', 'en/pay-report.html']) {
    const s = nohtml(read('./' + f));
    ok(s.includes('id="bench-gap"'), `${f} に床（id="bench-gap"）がある`);
    ok(s.includes('mountAfterReport'), `${f} が mountAfterReport を呼ぶ`);
    ok(s.includes('PVReferral.settle'), `${f} が afterSaved で settle を呼ぶ`);
    ok((s.split('PVReferral.claim').length - 1) === 2,
       `${f} は claim を2経路（afterSignedIn と起動時）から呼ぶ`);
    /* ★読み込む位置。起動時のインラインスクリプトが window.PVReferral.claim() を
       呼ぶので、script タグがそれより後ろだと「招待リンクから来た人」の紐づけだけが
       黙って落ちる（pv-conditions.js の並び＝ファイル末尾に置いて実際に落ちた）。 */
    ok(tagAt(s, 'pv-referral.js') > 0 && tagAt(s, 'pv-referral.js') < s.indexOf('PVReferral.claim'),
       `${f} は pv-referral.js を claim を呼ぶスクリプトより前に読む`);
  }

  /* 差込口は3つ要る。★pubSection を忘れると、pay_benchmarks にセルが1つも
     無い人＝いちばん区分が薄い人＝この機能の対象そのものが永久に見られない。 */
  const mv = nocomment(read('./my-value.js'));
  ok((mv.split('refSlot()').length - 1) >= 4,
     'my-value.js に差込口が3か所ある（機会・公開情報・機会の空）',
     String(mv.split('refSlot()').length - 1));
  ok(mv.includes('PVReferral.mountCohort'), 'my-value.js が mountCohort を呼ぶ');
  ok(mv.includes('PVReferral.claim'), 'my-value.js が load() で claim を呼ぶ');

  /* ★マイページは2つの役目を持つ。裏で claim を呼ぶ（招待リンクから来た人の紐づけ）のと、
     常設の招待入口を描くの2つ。片方だけ入れる事故を止めるため両方を見る。
     常設入口はサイトで唯一「招待したいと思ったときに自分から行ける場所」で、
     文脈カード（マイレポート／給与を出した直後）は条件が揃わないと出ない。
     この1行を消すと、招待の入口がサイトからゼロになる（2026-08-19 に本番でそうなっていた）。 */
  for (const f of ['profile.html', 'en/profile.html']) {
    const h = nohtml(read('./' + f));
    ok(h.includes('PVReferral.claim'), `${f} が claim を呼ぶ（Google 登録の戻り先）`);
    ok(h.includes('id="pv-invite-slot"'), `${f} に常設入口の差込口がある`);
    ok(h.includes('PVReferral.mountInvite'), `${f} が mountInvite を呼ぶ`);
  }

  /* ★「招待する」「リンクをコピー」の配線は1組しか無い。
     常設カードが自前の配線を持つと patch-payslip.mjs 〜 patch-payslip5.mjs と
     同じ増え方をして、片方だけ直した日に送られる文面が2種類になる。 */
  ok((js.match(/querySelector\('\[data-pvr-go\]'\)/g) || []).length === 1 &&
     (js.match(/querySelector\('\[data-pvr-copy\]'\)/g) || []).length === 1,
     '★送る配線は wireShare の1組だけ（文面が2種類に割れない）');

  /* 字種が片方だけ変わると、正しいコードを画面が弾く（または DB が弾く）。 */
  const sql = read('./db/referrals.sql');
  ok(js.includes('/^[2-9A-HJ-NP-Z]{8}$/'), 'pv-referral.js の字種が 2-9A-HJ-NP-Z の8文字');
  ok(sql.includes("'23456789ABCDEFGHJKMNPQRSTVWXYZ'"), 'db/referrals.sql の字種が同じ30文字');
  ok(sql.includes("'^[2-9A-HJ-NP-Z]{8}$'"), 'db/referrals.sql も同じ形で弾く');

  /* このファイルは anon に何も渡さない（コードの実在を試せる窓口を作らない）。 */
  ok(!/grant\s+execute[^;]*to\s+[^;]*\banon\b/i.test(sql),
     'db/referrals.sql は anon に1つも実行させない');
}

// ════════════════════════════════════════════════════════════════
// 共通：偽物 Supabase
// ════════════════════════════════════════════════════════════════
/* ★本物の supabase-js が返すのは「then だけを持つ箱」で catch も finally も無い。
   async にすると本物の Promise になり、本番より優しくなる。形を揃える。 */
const FAKE = function (gapPayload, code) {
  window.__rpc = [];

  const UID = '00000000-0000-4000-8000-00000000a001';
  /* ★テスト用の架空プロフィール。ZIPAIR は A380 を運航しておらず、ITM は国内線専用で A380 が入れない。
     この組み合わせに当てはまる実在のパイロットは居ない。実在しそうな組み合わせに「直さない」こと。 */
  const REPORT = {
    airline: 'zipair', airline_other: null, position: 'cap', fleet: 'a380', base_iata: 'ITM',
    period_year: 2026, period_month: 8, period_ym: 2026 * 12 + 8,
    currency: 'JPY', fx_to_jpy: 1, fx_to_usd: 0.0067,
    base_pay: 1050000, command_pay: 180000, housing_type: 'allowance', housing_amount: 60000,
    per_diem: 48000, transport: 22000, other_allowance: 260000, bonus_annual: 0,
    block_hours: 71.5, duty_hours: 139, net_pay_actual: 1360000, deduction_total: 260000,
    annual_total_orig: 19440000, annual_total_jpy: 19440000, annual_total_usd: 130248,
    net_annual_jpy: 15000000, usd_per_block_hour: 145.6,
    source: 'payslip', verify_level: 1, contract_type: 'direct',
    created_at: '2026-08-05T00:00:00Z'
  };
  const RPC = {
    my_cohort_gap: () => gapPayload,
    my_referral_code: () => ({ ok: true, code: code, invited: 0, converted: 0 }),
    claim_referral: () => ({ ok: true, status: 'attributed' }),
    pv_referral_settle: () => ({ ok: true }),
    my_pay_reports: () => ({ ok: true, reports: [REPORT], report_count: 1, streak_months: 1,
      access_until: new Date(Date.now() + 62 * 86400000).toISOString(),
      badge: 'silver', badge_state: 'active', mail_optin: false, pay_day_of_month: 5 }),
    next_condition_questions: () => ({ ok: true, airline: 'zipair', mine_count: 0,
      questions: [{ id: 'days_off_request', mine_code: null },
                  { id: 'schedule_bidding', mine_code: null },
                  { id: 'external_hiring', mine_code: null }] }),
    my_airline_conditions: () => ({ ok: true, answers: [], answered_total: 0, questions_total: 32 }),
    submit_airline_conditions: () => ({ ok: true, airline: 'zipair', saved: 1, skipped: 0, rejected: [] })
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
  const CLIENT = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: UID, email: 'pilot@example.com' } } } }),
      getUser: async () => ({ data: { user: { id: UID, email: 'pilot@example.com' } } }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: (t) => t === 'profiles'
      ? q([{ id: UID, name: 'Sample Pilot', email: 'pilot@example.com',
             company: 'ZIPAIR', position: 'captain', email_opt_in: false }])
      : q([]),
    rpc: (name, args) => {
      window.__rpc.push({ name: name, args: args });
      const res = { data: RPC[name] ? RPC[name](args) : { ok: true }, error: null };
      return { then: (y, n) => Promise.resolve(res).then(y, n) };   // ★then だけ
    }
  };
  Object.defineProperty(window, 'supabase',
    { value: { createClient: () => CLIENT }, writable: false, configurable: false });
};

/* 給与レポートの見た目を作る入口。本番の submit と同じ形で renderResult を呼ぶ。
   ★benchmark: null ＝「まだ5人に届いていない」経路（床が出るところ）。 */
const RENDER = function () {
  window.renderResult(
    { ok: true, is_new: true, currency: 'JPY', annual_total_orig: 19440000,
      annual_total_jpy: 19440000, annual_total_usd: 130248, net_annual_jpy: 15000000,
      usd_per_block_hour: 145.6, streak_months: 1, benchmark: null,
      access_until: new Date(Date.now() + 90 * 86400000).toISOString() },
    { airline: 'zipair', airline_other: null, position: 'cap', fleet: 'a380',
      base_iata: 'ITM', contract_type: 'direct', currency: 'JPY',
      period_year: 2026, period_month: 8 });
};

const GAP = {
  none:  { ok: true, state: 'none' },
  few:   { ok: true, state: 'few' },                                  // ★整数がゼロ個
  near2: { ok: true, state: 'near', remaining: 2, gained: 0, crossed: false },
  near1: { ok: true, state: 'near', remaining: 1, gained: 0, crossed: false },
  open:  { ok: true, state: 'open', gained: 3, crossed: true }
};

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });

/* ★1件ごとにまっさらな入れ物で開く。localStorage を持ち越すと
   （pv_ref_cap の「7日は空ける」／pv-lang の英語設定）、前の検査の副作用で
   次の検査が黙って別のことを測る。実際に全部それで落ちた。 */
const jars = [];
async function fresh(seed) {
  const jar = await browser.createBrowserContext();
  jars.push(jar);
  const page = await jar.newPage();
  await page.setViewport({ width: 1280, height: 1100 });
  /* 本番の GA4 プロパティに送らない（公式のオプトアウト）。
     dataLayer には積まれるので、こちらの検査には影響しない。 */
  await page.evaluateOnNewDocument(() => { window['ga-disable-G-3XYF69VQ3X'] = true; });
  if (seed) await page.evaluateOnNewDocument(seed);
  return page;
}

/* ★ページ自身が <head> で function gtag(){dataLayer.push(arguments)} を宣言するので、
   こちらが先に window.gtag を置いても上書きされる。積まれた先を読む。 */
const events = (page) => page.evaluate(() => Array.prototype.slice.call(window.dataLayer || [])
  .filter((a) => a && a[0] === 'event')
  .map((a) => ({ n: a[1], p: a[2] || {} })));
const clearEvents = (page) => page.evaluate(() => { if (window.dataLayer) window.dataLayer.length = 0; });


// ════════════════════════════════════════════════════════════════
// 1. 着地の1枚（トップページ）
// ════════════════════════════════════════════════════════════════
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / 着地の1枚 ════`);
  const home = BASE + (lang === 'en' ? '/en/' : '/');
  const page = await fresh();

  await page.goto(home + '?ref=' + CODE.toLowerCase(), { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1000);
  let v = await page.evaluate(() => {
    const s = document.querySelector('.pvr-strip');
    const nav = document.querySelector('nav');
    return {
      strip: !!s,
      pos: s ? getComputedStyle(s).position : '',
      text: s ? s.innerText : '',
      navTop: nav ? getComputedStyle(nav).top : '',
      ref: localStorage.getItem('pv_ref') || ''
    };
  });
  let ev = await events(page);
  ok(v.strip, '?ref= 付きで来た人に招待状が出る');
  ok(JSON.parse(v.ref || '{}').c === CODE, '小文字で来ても大文字に直して預かる', v.ref);
  ok(ev.filter((e) => e.n === 'referral_land').length === 1, 'referral_land を1回だけ撃つ',
     JSON.stringify(ev.map((e) => e.n)));
  /* ★レイアウトを1px も動かさない。nav の top も #hero-section の高さも触らない
     （lp.css:857 に 123px のマーキーで CLS 0.0996 を出した記録がある）。 */
  ok(v.pos === 'absolute', 'フローの高さを占めない（absolute で浮かせる）', v.pos);
  ok(v.navTop === '0px', 'nav の位置を動かさない', v.navTop);
  ok(lang === 'ja' ? /パイロット/.test(v.text) : /pilot/i.test(v.text),
     'ページの言語の文面が出る', JSON.stringify(v.text).slice(0, 90));
  ok(!/\d/.test(v.text), '数字が1文字も出ない（招待コードも人数も見せない）', v.text);
  /* ★送った文面の最後の1行と同じ行を着地にも置く（2026-08-19・特別感）。
     招待された人は同じ言葉を2度読むことになる。ここが消えると地続きでなくなる。 */
  ok(/Know your value\. Raise our value\./.test(v.text),
     '★送った文面の最後の1行が着地にもある', JSON.stringify(v.text).slice(0, 120));
  /* ★見出しで匿名だと言う（2026-08-19 オーナー指示）。招待された人がいちばん先に
     気にするのは「誰が招待したか相手に分かるのか」で、但し書きより先に答える。 */
  ok(lang === 'ja' ? /匿名のパイロットから招待されています/.test(v.text)
                   : /an anonymous pilot invited you/i.test(v.text),
     '★見出しが「匿名の」と言っている', JSON.stringify(v.text).slice(0, 120));
  /* ★VISION の2行。ここは招待された人がこのサービスを見る唯一の入口なので、
     何を目指しているかを書く。消すと「招待状」だけで中身が無くなる。 */
  ok(lang === 'ja' ? /パイロットという職業の価値を高める/.test(v.text)
                   : /raise the value of the profession/i.test(v.text),
     '★VISION（職業の価値を高める）が着地に書いてある', JSON.stringify(v.text).slice(0, 200));
  {
    const order = await page.evaluate(() => {
      const c = document.querySelector('.pvr-card');
      return [...c.children].map((e) => e.className.split(' ')[0]).join('>');
    });
    ok(order === 'pvr-x>pvr-eyebrow>pvr-strip-t>pvr-tag>pvr-strip-v>pvr-rule>pvr-strip-s>pvr-go',
       '★並び順（招待状 → 見出し → タグライン → VISION → 罫 → 但し書き → ボタン）', order);
  }
  /* ★スマホで見出しが1文字あふれると「す」だけ2行目に落ちる（実際に落ちた）。
     見出しもVISIONも、狭い画面で言葉の途中で切れないことを幅で見る。 */
  {
    const before = page.viewport();
    await page.setViewport({ width: 390, height: 844 });
    await sleep(350);
    const fit = await page.evaluate(() => {
      const t = document.querySelector('.pvr-strip-t');
      const v = document.querySelector('.pvr-strip-v');
      const lh = (e) => parseFloat(getComputedStyle(e).lineHeight);
      const over = [...v.querySelectorAll('.pvr-nb')]
        .filter((e) => e.getBoundingClientRect().width > v.getBoundingClientRect().width - 0.5).length;
      return { h: Math.round(t.getBoundingClientRect().height / lh(t)), over: over };
    });
    ok(fit.h === 1, '★390px で見出しが1行に収まる', JSON.stringify(fit));
    ok(fit.over === 0, '★390px で VISION が1かたまりも幅からあふれない', JSON.stringify(fit));
    await page.setViewport(before);
    await sleep(250);
  }

  /* ★「画面の中央に出す」（2026-08-19 オーナー指示）。上端の細い帯に戻したら赤くなる。 */
  const mid = await page.evaluate(() => {
    const c = document.querySelector('.pvr-card');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { dy: Math.abs((r.top + r.bottom) / 2 - innerHeight / 2),
             dx: Math.abs((r.left + r.right) / 2 - innerWidth / 2) };
  });
  ok(mid && mid.dy <= 10 && mid.dx <= 10, '★招待状が画面の中央に出る', JSON.stringify(mid));

  /* ★見た目はモーダルでも、閉じ込めが起きないこと。ここが今回いちばん大事。
     スクロールを止めていないので、下へ動かせば必ず抜けられる。 */
  const trap = await page.evaluate(async () => {
    const before = getComputedStyle(document.body).overflow;
    scrollTo(0, 0); scrollBy(0, 500);
    await new Promise((r) => setTimeout(r, 250));
    const y = scrollY;
    scrollTo(0, 0);
    const nav = document.querySelector('nav');
    return { overflow: before, y: y,
             z: Number(getComputedStyle(document.querySelector('.pvr-strip')).zIndex),
             navZ: nav ? Number(getComputedStyle(nav).zIndex) : 0 };
  });
  ok(trap.overflow !== 'hidden', '★背後のスクロールを止めない（閉じ込めが起きない）', trap.overflow);
  ok(trap.y > 100, '★出ている間もページを下へ動かせる', String(trap.y));
  ok(trap.z < trap.navZ, '★nav より下に置く（ロゴも操作も生きたまま）', `${trap.z} / ${trap.navZ}`);

  // × は「招待を断る」ではない。この1枚だけ消して、コードは預かったままにする
  await page.evaluate(() => document.querySelector('.pvr-strip [data-pvr-x]').click());
  await sleep(700);
  v = await page.evaluate(() => ({
    strip: !!document.querySelector('.pvr-strip'),
    ref: localStorage.getItem('pv_ref') || '',
    off: sessionStorage.getItem('pv_ref_strip') || ''
  }));
  ev = await events(page);
  ok(!v.strip, '× で消える');
  ok(v.off === '0' && ev.filter((e) => e.n === 'referral_strip_dismissed').length === 1,
     '閉じたことを覚える');
  ok(JSON.parse(v.ref || '{}').c === CODE, '★閉じても招待コードは残る（閉じる＝断るではない）');

  /* ★閉じ方を3つ置いてある（× ・カードの外 ・ESC）。1つしか無い覆いは、
     その1つが押せない状況で詰む。残り2つがまだ効くことをここで押さえる。 */
  for (const [how, act] of [
    ['カードの外を押す', () => document.querySelector('.pvr-strip').click()],
    ['ESC を押す', () => document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))]
  ]) {
    await page.evaluate(() => sessionStorage.removeItem('pv_ref_strip'));
    await page.goto(home, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(900);
    ok(await page.evaluate(() => !!document.querySelector('.pvr-strip')),
       `もう一度出る（${how} の前）`);
    await page.evaluate(act);
    await sleep(800);
    ok(await page.evaluate(() => !document.querySelector('.pvr-strip')), `★${how}と閉じる`);
  }

  /* ★カードの中を押しても閉じない（読んでいる途中で消えない）。 */
  await page.evaluate(() => sessionStorage.removeItem('pv_ref_strip'));
  await page.goto(home, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(900);
  await page.evaluate(() => document.querySelector('.pvr-strip-t').click());
  await sleep(500);
  ok(await page.evaluate(() => !!document.querySelector('.pvr-strip')),
     'カードの中を押しても閉じない');

  /* ★別の覆いが先に開いていたら出さない。index.html は pv-conditions.js を
     読んでいないので今は起こらないが、いつか読み込まれた日にここが効く。 */
  const two = await page.evaluate(() => {
    const s = document.querySelector('.pvr-strip');
    if (s) s.remove();
    sessionStorage.removeItem('pv_ref_strip');
    const fake = document.createElement('div');
    fake.setAttribute('aria-modal', 'true');
    document.body.appendChild(fake);
    window.PVReferral.mountStrip();
    const drew = !!document.querySelector('.pvr-strip');
    fake.remove();
    return drew;
  });
  ok(!two, '★別の覆いが開いている間は出さない（覆いが2枚にならない）', String(two));
  await page.evaluate(() => sessionStorage.setItem('pv_ref_strip', '0'));

  // 形の合わないものは預からない（招待状も出さない）
  await page.evaluate(() => { localStorage.removeItem('pv_ref'); sessionStorage.clear(); });
  await page.goto(home + '?ref=zzz', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);
  v = await page.evaluate(() => ({ strip: !!document.querySelector('.pvr-strip'),
                                   ref: localStorage.getItem('pv_ref') }));
  ok(!v.strip && !v.ref, 'でたらめなコードは預からない・招待状も出さない', JSON.stringify(v));

  // 期限切れ（31日前）は捨てる
  await page.evaluate((c) => localStorage.setItem('pv_ref',
    JSON.stringify({ c: c, ts: Date.now() - 31 * 86400000 })), CODE);
  await page.goto(home, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);
  v = await page.evaluate(() => ({ strip: !!document.querySelector('.pvr-strip'),
                                   ref: localStorage.getItem('pv_ref') }));
  ok(!v.strip && !v.ref, '31日たった招待は捨てる（預かりと同じ30日）', JSON.stringify(v));
}

/* ★言語切替をまたぐ回帰テスト。lang-toggle.js は pv-lang==='en' の人を
   location.replace() で /en/ へ飛ばし、そのときクエリを丸ごと捨てる。
   pv-referral.js を先に読んでいなければ、ここでコードが消える。 */
{
  console.log('\n════ 言語切替をまたいでも消えない ════');
  const page = await fresh(() => localStorage.setItem('pv-lang', 'en'));
  await page.goto(BASE + '/?ref=' + CODE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1400);
  const v = await page.evaluate(() => ({ path: location.pathname, search: location.search,
    ref: localStorage.getItem('pv_ref') || '', strip: !!document.querySelector('.pvr-strip') }));
  ok(/^\/en\/?$/.test(v.path), '英語設定の人は /en/ へ飛ばされる（ここは既存の挙動）', v.path);
  ok(v.search === '', '飛ばされた先では ?ref= が消えている（だから localStorage に写す）', v.search);
  ok(JSON.parse(v.ref || '{}').c === CODE, '★それでも招待コードは残っている', v.ref);
  ok(v.strip, '飛ばされた先でも招待状が出る');
}

// ════════════════════════════════════════════════════════════════
// 2. 給与を出した直後（bench 姿）
// ════════════════════════════════════════════════════════════════
for (const lang of ['ja', 'en']) {
  const url = BASE + (lang === 'en' ? '/en/' : '/') + 'pay-report.html';

  for (const key of ['none', 'few', 'near2', 'near1', 'open']) {
    console.log(`\n════ ${lang} / 給与レポート直後 / ${key} ════`);
    const page = await fresh();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
    await page.evaluateOnNewDocument(FAKE, GAP[key], CODE);
    await page.evaluateOnNewDocument((c) => localStorage.setItem('pv_ref',
      JSON.stringify({ c: c, ts: Date.now() })), CODE);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1600);

    /* 起動の時点で紹介者に結びつく。★claimPending() より前に呼んでいるので、
       まだ投稿が0件のうちに帰属して、この最初の1件で成立する。 */
    if (key === 'few') {
      const cl = await page.evaluate(() => ({
        called: (window.__rpc || []).filter((r) => r.name === 'claim_referral'),
        ref: localStorage.getItem('pv_ref')
      }));
      ok(cl.called.length >= 1, 'ページを開いた時点で claim_referral を撃つ', String(cl.called.length));
      ok(cl.called[0] && cl.called[0].args && cl.called[0].args.p_code === CODE,
         '送るのは8文字のコードだけ', JSON.stringify(cl.called[0] && cl.called[0].args));
      ok(!cl.ref, 'サーバが確定的な答えを返したら鍵を捨てる');
    }

    await clearEvents(page);
    await page.evaluate(RENDER);
    await sleep(900);

    const v = await page.evaluate(() => {
      const c = document.querySelector('.pvr[data-v="bench"]');
      const floor = document.getElementById('bench-gap');
      return {
        card: !!c,
        text: c ? c.innerText : '',
        go: !!document.querySelector('[data-pvr-go]'),
        win: c ? (c.querySelector('.pvr-win') || {}).textContent || '' : '',
        floor: !!floor,
        floorText: floor ? floor.innerText : ''
      };
    });
    const ev = await events(page);
    const shown = ev.filter((e) => e.n === 'referral_prompt_shown');

    if (key === 'none') {
      ok(!v.card && v.floor, '★state:none では床（いまの一文）がそのまま残る');
      ok(lang === 'ja' ? /5人/.test(v.floorText) : /five pilots/i.test(v.floorText),
         '床の文言は今までどおり', JSON.stringify(v.floorText).slice(0, 80));
    } else {
      ok(v.card && !v.floor, '床がカードに置き換わる', JSON.stringify(v).slice(0, 120));
    }

    if (key === 'few') {
      /* ★このファイルでいちばん大事な1行。
         n≦2 の区分では、人数を推測できる数字を1文字も出さない。 */
      /* ★禁じているのは「その区分に何人いるか」を推測できる数字。
         日本語に残る数字は2つだけで、どちらも payload と無関係の決め打ち：
           ・「5人そろうと」＝解放のしきい値。サイト中どこにでも出ている定数
           ・「1人招待」　　＝ CTA。招待する人数であって、記録の件数ではない
         state:'few' の payload には整数が1つも入っていない（GAP.few）ので、
         この2つを除いてなお数字が残ったら、それは n が漏れている。
         （英語は "five pilots" / "one pilot" と綴るので、そもそも数字が無い） */
      const leak = v.text.replace(/5人/g, '').replace(/1人/g, '')
                         .replace(/five pilots/gi, '').replace(/one pilot/gi, '');
      ok(!/\d/.test(leak), '★n≦2 では人数を推測できる数字が1文字も出ない', JSON.stringify(v.text));
      ok(lang === 'ja' ? /まだ記録が少ない/.test(v.text) : /very few records/i.test(v.text),
         '「まだ記録が少ないです」とだけ言う', JSON.stringify(v.text).slice(0, 90));
      ok(v.go, '招待の導線は出る（行き止まりにしない）');
      ok(shown.length === 1 && shown[0].p.remaining === 0,
         'GA4 にも生の n を渡さない（few の remaining は必ず 0）', JSON.stringify(shown));
    }
    if (key === 'near2' || key === 'near1') {
      const k = key === 'near2' ? 2 : 1;
      ok(lang === 'ja'
           ? v.text.includes('あと' + k + '人で、より詳しい比較')
           : (k === 1 ? /One more pilot/.test(v.text) : /2 more pilots/.test(v.text)),
         `n=${5 - k} では「あと${k}人」と出す`, JSON.stringify(v.text).slice(0, 90));
      /* 「誰か1人招待すれば埋まる」とは言えない。動くのは同じ区分の人だけ。 */
      ok(lang === 'ja' ? /同じ会社・職位・機種・年/.test(v.text)
                       : /same airline, rank/.test(v.text),
         '★「同じ会社・職位・機種・年で記録した人が」と必ず添える');
      ok(shown.length === 1 && shown[0].p.remaining === k,
         `GA4 の remaining は ${k}`, JSON.stringify(shown));
      ok(!v.win, 'まだ増えていないので「良くなりました」は出さない', v.win);
    }
    if (key === 'open') {
      ok(!v.go, '★n≧5（比較が出ている）では招待の導線を出さない');
      ok(lang === 'ja' ? /5人そろいました/.test(v.win) : /reached five pilots/i.test(v.win),
         '代わりに「5人そろいました」だけ出す', JSON.stringify(v.win));
      ok(shown.length === 0, '勧誘していないので prompt_shown は撃たない');
      const g = ev.filter((e) => e.n === 'referral_cohort_open' || e.n === 'referral_cohort_gained');
      ok(g.length === 2, '「開いた」と「増えた」を1回ずつ撃つ', JSON.stringify(g));
      ok(!/ana|airline|19440000|130248/.test(JSON.stringify(g)),
         '★計測に会社名も金額も送らない', JSON.stringify(g));
    }
    ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
  }
}

// ════════════════════════════════════════════════════════════════
// 3. 床が抜けない・モーダルと共存する・送る文面
// ════════════════════════════════════════════════════════════════
{
  console.log('\n════ 床が抜けない（PVReferral が読めなかったとき）════');
  const page = await fresh();
  await page.evaluateOnNewDocument(FAKE, GAP.near2, CODE);
  await page.goto(BASE + '/pay-report.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1400);
  await page.evaluate(() => { delete window.PVReferral; });
  await page.evaluate(RENDER);
  await sleep(900);
  const v = await page.evaluate(() => {
    const f = document.getElementById('bench-gap');
    return { floor: !!f, text: f ? f.innerText : '', card: !!document.querySelector('.pvr') };
  });
  ok(v.floor && !v.card, '★pv-referral.js が無くても、いまの一文はそのまま出る');
  ok(/まだ5人に届いていません/.test(v.text), '床の文言が壊れていない', JSON.stringify(v.text).slice(0, 80));
}

{
  console.log('\n════ 待遇モーダルと共存する ════');
  const page = await fresh();
  await page.evaluateOnNewDocument(FAKE, GAP.near2, CODE);
  await page.goto(BASE + '/pay-report.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1400);
  await page.evaluate(RENDER);
  await sleep(1800);            // 待遇モーダルの 700ms 待ち ＋ 描画
  let v = await page.evaluate(() => {
    const m = document.querySelector('[data-pvc]');
    return { modal: !!m, card: !!document.querySelector('.pvr[data-v="bench"]'),
             overlays: document.querySelectorAll('[aria-modal="true"]').length,
             cardInModal: !!(m && m.querySelector('.pvr')) };
  });
  ok(v.modal && v.card, '待遇モーダルと招待カードが同時に立っていられる', JSON.stringify(v));
  ok(v.overlays === 1, '★覆いは1枚だけ（招待は覆いを作らない）', String(v.overlays));
  ok(!v.cardInModal, '招待カードはモーダルの中に紛れ込まない');
  await page.keyboard.press('Escape');
  await sleep(600);
  v = await page.evaluate(() => ({ modal: !!document.querySelector('[data-pvc]'),
                                   card: !!document.querySelector('.pvr[data-v="bench"]') }));
  ok(!v.modal && v.card, 'モーダルを閉じても招待カードは残る');
}

{
  /* ★交差監視は「画面の中に入ったか」しか見ない。覆いの裏に隠れているかは
     見ないので、モーダルが開いている間に数えると、一度も読まれないまま
     上限（4回）に達する。覆いが閉じるまで待つこと。 */
  console.log('\n════ 覆いの裏では「見えた」に数えない ════');
  const page = await fresh();
  await page.evaluateOnNewDocument(FAKE, GAP.near2, CODE);
  await page.goto(BASE + '/pay-report.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1400);
  // 先にモーダルだけ開けてから、あとでカードを差し込む
  await page.evaluate(() => {
    const sb = window.supabase.createClient();
    window.PVConditions.afterReport({ sb: sb, airline: 'zipair', airline_other: null,
      airlineName: 'ZIPAIR', year: 2026, month: 8, position: 'cap', fleet: 'a380',
      base_iata: 'ITM', contract_type: 'direct' });
  });
  await sleep(1600);
  await clearEvents(page);
  await page.evaluate(() => {
    const slot = document.createElement('div');
    slot.id = 'bench-gap';
    document.body.insertBefore(slot, document.body.firstChild);   // 画面の中に置く
    window.PVReferral.mountAfterReport({ sb: window.supabase.createClient() });
  });
  await sleep(1400);
  const drew = await page.evaluate(() => !!document.querySelector('.pvr'));
  ok(drew, 'カードそのものは覆いの裏でも描かれる（閉じたときには既にそこに在る）');
  let n = (await events(page)).filter((e) => e.n === 'referral_prompt_shown').length;
  ok(n === 0, '★モーダルが開いている間は「見えた」を数えない', String(n));
  await page.keyboard.press('Escape');
  await sleep(1400);
  n = (await events(page)).filter((e) => e.n === 'referral_prompt_shown').length;
  ok(n === 1, 'モーダルを閉じたら1回だけ数える', String(n));
}

for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / 送る文面 ════`);
  const page = await fresh();
  await page.evaluateOnNewDocument(FAKE, GAP.near2, CODE);
  await page.goto(BASE + (lang === 'en' ? '/en/' : '/') + 'pay-report.html',
                  { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1200);
  /* ★_text は引数が url ひとつ。文面の変種はもう無い。
     このページは 'ZIPAIR' を知っている（下のカードにも出ている）のに、
     文面には出ない。それを下で確かめる。 */
  const t = await page.evaluate((code) => {
    const url = (document.documentElement.lang === 'en' ? 'https://pilot-value.com/en/'
                                                        : 'https://pilot-value.com/') + '?ref=' + code;
    return window.PVReferral._text(url);
  }, CODE);
  ok(t.includes('?ref=' + CODE), '文面に招待リンクが入る', t);
  ok(!/ZIPAIR/.test(t), '★勤務先の名前は入らない（ページは知っているのに文面には出ない）', t);

  /* ★これが今回の主目的。文面は機能の説明ではなく VISION.md の使命を語る。
     「パイロットの給与を比べられるサイトを使っています」だけの文面に
     戻したら、ここが赤くなる。 */
  ok(/PILOT VALUE/.test(t), '★文面が PILOT VALUE を名乗る', t);
  ok(/Know your value\. Raise our value\./.test(t), '★タグラインが入る', t);
  if (lang === 'ja') {
    ok(/職業の価値/.test(t), '★日本語：職業そのものの価値を上げる話が入る', t);
    ok(/完全匿名/.test(t), '★日本語：完全匿名だと書いてある', t);
    ok(/パイロット自身の匿名の実データ/.test(t), '日本語ページの文面は日本語', t);
  } else {
    ok(/the profession/.test(t), '★英語：職業そのものの価値を上げる話が入る', t);
    ok(/Fully anonymous/.test(t), '★英語：完全匿名だと書いてある（トップページと同じ言い方）', t);
    ok(!/[ぁ-んァ-ヶ一-龠]/.test(t), '英語ページの文面に日本語が混ざらない', t);
  }
  /* URL は本文と空行1つで分かれている（LINE / WhatsApp で読みやすい）。 */
  ok(t.includes('\n\nhttps://pilot-value.com/'), 'URL の前に空行が1つ入る', JSON.stringify(t.slice(-70)));

  /* ★給与額を Share payload に入れない（仕様の禁止事項）。 */
  ok(!/19,?440,?000|130,?248|1,?944|¥|\$|万円/.test(t), '金額が1つも入らない', t);
  ok(!/pilot-value\.com\/(my-value|pay-report)/.test(t), '自分のレポートのURLを渡さない', t);
  ok(!/(拡散|広めて|spread the word|share this with everyone)/i.test(t),
     '「みんなに拡散してください」とは言わない');

  /* ★文面を選ばせるチップは置かない。選択肢を増やしても招待は増えず、
     勤務先名が文面に入る道が生えるだけ（2026-08-19 に3つ消した）。 */
  const chips = await page.evaluate(() => {
    const slot = document.createElement('div');
    slot.id = 'bench-gap';
    document.body.insertBefore(slot, document.body.firstChild);
    window.PVReferral.mountAfterReport({ sb: window.supabase.createClient() });
    return new Promise((r) => setTimeout(() => r({
      drew: !!document.querySelector('.pvr'),
      chip: document.querySelectorAll('.pvr-chip,[data-pvr-v]').length
    }), 1200));
  });
  ok(chips.drew, 'カードが描かれている（チップの数を見る前提）');
  ok(chips.chip === 0, '★送る文面を選ばせるチップは1つも無い', String(chips.chip));
}

// ════════════════════════════════════════════════════════════════
// 4. マイレポート（my-value.html／card 姿）
// ════════════════════════════════════════════════════════════════
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / マイページ ════`);
  const page = await fresh(() => localStorage.setItem('pv-theme', 'dark'));
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.evaluateOnNewDocument(FAKE, GAP.near2, CODE);
  await page.goto(BASE + (lang === 'en' ? '/en/' : '/') + 'my-value.html',
                  { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2800);
  /* ★「機会」の節はページのずっと下。画面に入れないと交差監視が動かない
     ＝「見えた」が永久に立たない（本番でも同じで、それが正しい）。 */
  await page.evaluate(() => { const c = document.querySelector('.pvr'); if (c) c.scrollIntoView({ block: 'center' }); });
  await sleep(1000);

  let v = await page.evaluate(() => {
    const c = document.querySelector('.pvr[data-v="card"]');
    return { slot: !!document.getElementById('mr-ref-slot'), card: !!c,
             text: c ? c.innerText : '',
             go: !!document.querySelector('[data-pvr-go]') };
  });
  let ev = await events(page);
  ok(v.card, 'マイページの「機会」の下にカードが出る', JSON.stringify(v).slice(0, 120));
  ok(lang === 'ja' ? /あと2人で、より詳しい比較/.test(v.text) : /2 more pilots/.test(v.text),
     '「あと2人で、より詳しい比較」が出る', JSON.stringify(v.text).slice(0, 90));
  /* ★順位の言い方をしない。「あなたの位置が数字で出ます」は 2026-08-19 に
     オーナーがランキング表現として却下した。増えるのは順位ではない。 */
  ok(!/位置が数字|順位|ランキング|your position|your rank|ranking/i.test(v.text),
     '★順位・ランキングの言い方をしない', JSON.stringify(v.text).slice(0, 120));
  ok(ev.filter((e) => e.n === 'referral_prompt_shown').length === 1, '「見えた」を1回数える',
     JSON.stringify(ev.map((e) => e.n)));

  /* ★通貨を切り替えると my-value.js の render() が innerHTML を作り直す。
     そこで描くのをやめると、通貨を変えただけで招待の導線が消える。 */
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('pv-currency-change')));
  await sleep(1400);
  v = await page.evaluate(() => ({
    card: !!document.querySelector('.pvr[data-v="card"]'),
    go: !!document.querySelector('[data-pvr-go]'),
    gap: (window.__rpc || []).filter((r) => r.name === 'my_cohort_gap').length
  }));
  ev = await events(page);
  ok(v.card && v.go, '★通貨を切り替えてもカードが消えない');
  ok(ev.filter((e) => e.n === 'referral_prompt_shown').length === 1,
     '描き直しを2回目の表示として数えない（実績を水増ししない）',
     JSON.stringify(ev.map((e) => e.n)));
  ok(v.gap === 1, 'my_cohort_gap は1ページ1回しか引かない（数字がちらつかない）', String(v.gap));
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

/* 7日以内の2回目は勧誘しない。ただし「稼いだ情報」は回数制限の外なので出す。 */
{
  console.log('\n════ 出しすぎない（7日以内の2回目）════');
  const page = await fresh(() => localStorage.setItem('pv_ref_cap',
    JSON.stringify({ n: 1, last: Date.now() - 2 * 86400000, off: 0, dismiss: 0 })));
  await page.evaluateOnNewDocument(FAKE,
    { ok: true, state: 'near', remaining: 2, gained: 2, crossed: false }, CODE);
  await page.goto(BASE + '/my-value.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2800);
  await page.evaluate(() => { const c = document.querySelector('.pvr'); if (c) c.scrollIntoView({ block: 'center' }); });
  await sleep(1000);
  const v = await page.evaluate(() => {
    const c = document.querySelector('.pvr');
    return { card: !!c, go: !!document.querySelector('[data-pvr-go]'),
             win: c ? (c.querySelector('.pvr-win') || {}).textContent || '' : '' };
  });
  const ev = await events(page);
  ok(!v.go, '2日前に出したばかりなら、もう頼まない');
  ok(/2件増えました/.test(v.win), '★でも「増えました」は出す（勧誘ではなく稼いだ情報）', v.win);
  ok(ev.filter((e) => e.n === 'referral_prompt_shown').length === 0,
     '頼んでいないので prompt_shown も撃たない', JSON.stringify(ev.map((e) => e.n)));
}

// ════════════════════════════════════════════════════════════════
// 5. マイページの常設入口（profile.html／profile 姿）
// ════════════════════════════════════════════════════════════════
/* ★ここは「招待したい」と思った人が自分から行ける唯一の場所。
   文脈カード（マイレポート／給与を出した直後）には消える道が3つある
   ── 給与を1件も記録していない（state:'none'）／5人そろっている（state:'open'）／
   回数制限の休み中 ── ので、条件で消えない入口が別に要る。
   2026-08-19、本番のマイページに招待の導線が1つも無いことにオーナーが気づいた。
   下の1つ目と2つ目が、その穴そのものの再発検知。 */

/* 押したときに何が clipboard へ行ったかを見る。実際の clipboard は
   ヘッドレスでは読めないので、書き込み口だけ差し替えて控えを取る。 */
const CLIP = function () {
  window.__copied = [];
  try {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: function (t) { window.__copied.push(t); return Promise.resolve(); } },
      configurable: true
    });
  } catch (e) {}
};

for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / マイページの常設入口 ════`);
  const page = await fresh(() => localStorage.setItem('pv-theme', 'dark'));
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.evaluateOnNewDocument(CLIP);
  await page.evaluateOnNewDocument(FAKE, GAP.none, CODE);      // ★給与を1件も出していない人
  await page.goto(BASE + (lang === 'en' ? '/en/' : '/') + 'profile.html',
                  { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2200);

  const v = await page.evaluate(() => {
    const c = document.querySelector('.pvr[data-v="profile"]');
    const box = document.getElementById('profile-card');
    return {
      card: !!c,
      inside: !!(c && box && box.contains(c)),
      text: c ? c.innerText : '',
      go: !!(c && c.querySelector('[data-pvr-go]')),
      copy: !!(c && c.querySelector('[data-pvr-copy]')),
      x: document.querySelectorAll('[data-pvr-x]').length,
      cap: localStorage.getItem('pv_ref_cap') || '',
      code: (window.__rpc || []).filter((r) => r.name === 'my_referral_code').length,
      gap: (window.__rpc || []).filter((r) => r.name === 'my_cohort_gap').length
    };
  });

  ok(v.card, '★給与を1件も出していない人にも招待の入口が出る', JSON.stringify(v).slice(0, 120));
  ok(v.inside, 'プロフィールカードの中に入っている（カードを1枚増やさない）');
  ok(v.go && v.copy, '「招待する」と「リンクをコピー」が両方ある');

  /* ★このカードには数字が1文字も出ない。招待した数・成立した数・残り何人・順位、
     どれも出さない。区分（gap）を引いていないので「あと○人」すら出しようがない。
     数え上げの言い方を1つずつ禁じるより、数字そのものを禁じるほうが確か。
     ★2026-08-19、見出しから「1人」が消えて例外がゼロになった
     （「パイロット仲間を1人招待する」→「パイロットの仲間を招待する」）。 */
  ok(!/\d/.test(v.text), '★数字が1文字も無い（招待数も成立数も残り人数も出さない）',
     JSON.stringify(v.text).slice(0, 140));
  ok(!/位置が数字|順位|ランキング|your position|your rank|ranking/i.test(v.text),
     '★順位・ランキングの言い方をしない', JSON.stringify(v.text).slice(0, 120));
  ok(v.gap === 0, '区分（my_cohort_gap）を引かない＝人数の話をしない', String(v.gap));
  ok(v.x === 0, '★× を置かない（常設の入口は消す対象ではない）', String(v.x));

  /* ★自分で見に来た画面なので、文脈カードの「4回見せたら30日休む」を食わない。
     ここで数えると、マイページを4回開いただけでレポート側の勧誘が黙って止まる。 */
  ok(v.cap === '', '★開いただけでは回数の予算を食わない（文脈カード側が減らない）', v.cap);
  ok(v.code === 0, '★開いただけでは招待コードを作らない', String(v.code));

  /* 押してはじめてコードを引き、文面を渡す。 */
  await page.evaluate(() => document.querySelector('.pvr[data-v="profile"] [data-pvr-copy]').click());
  await sleep(1200);
  const a = await page.evaluate(() => ({
    t: (window.__copied || [])[0] || '',
    code: (window.__rpc || []).filter((r) => r.name === 'my_referral_code').length,
    label: (document.querySelector('.pvr[data-v="profile"] [data-pvr-copy]') || {}).textContent || ''
  }));
  ok(a.code === 1, '押したときに1回だけ招待コードを引く', String(a.code));
  ok(a.t.includes('?ref=' + CODE), 'コピーされた文面に招待リンクが入る', a.t);
  ok(/PILOT VALUE/.test(a.t) && /Know your value\. Raise our value\./.test(a.t),
     '★文面はレポート側と同じ VISION（配線が1組だから同じになる）', a.t);
  ok(!/ZIPAIR/.test(a.t), '★勤務先の名前が入らない（この画面は ZIPAIR を表示しているのに）', a.t);
  ok(!/19,?440,?000|130,?248|万円|¥|\$/.test(a.t), '金額が1つも入らない', a.t);
  ok(!/pilot-value\.com\/(my-value|pay-report|profile)/.test(a.t),
     '自分のページのURLを渡さない', a.t);
  ok(lang === 'ja' ? /コピーしました/.test(a.label) : /Copied/i.test(a.label),
     'コピーしたと分かる', a.label);
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));

  /* ★5人そろっている人（勧誘カードが引っ込む状態）でも入口は残る。 */
  const p2 = await fresh(() => localStorage.setItem('pv-theme', 'dark'));
  await p2.evaluateOnNewDocument(FAKE, GAP.open, CODE);
  await p2.goto(BASE + (lang === 'en' ? '/en/' : '/') + 'profile.html',
                { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2200);
  ok(await p2.evaluate(() => !!document.querySelector('.pvr[data-v="profile"]')),
     '★5人そろっている人にも入口が残る（勧誘は止めても入口は閉じない）');
}

// ════════════════════════════════════════════════════════════════
// 6. 日英の文言が同じ形をしている
// ════════════════════════════════════════════════════════════════
{
  console.log('\n════ 日英の文言 ════');
  const keys = {};
  for (const lang of ['ja', 'en']) {
    const page = await fresh();
    await page.goto(BASE + (lang === 'en' ? '/en/' : '/') + 'pay-report.html',
                    { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(900);
    keys[lang] = await page.evaluate(() => Object.keys(window.PVReferral._T).sort());
  }
  ok(keys.ja.length > 0 && JSON.stringify(keys.ja) === JSON.stringify(keys.en),
     '日本語と英語で文言のキーがそろっている（片方だけ足すと undefined が出る）',
     JSON.stringify({ ja: keys.ja.length, en: keys.en.length }));
}

for (const jar of jars) { try { await jar.close(); } catch (e) {} }
await browser.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
