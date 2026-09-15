/* 登録だけで止まっている会員に、Give → Get を1回だけ見せる板（pv-give-first.js）。
   オーナー指示（2026-09-15）「会員登録だけの人がログインしたりページに来たら
   毎回1回はこの画面出して」。

   ここで守っているのは6つ。どれも**画面は普通に動いたまま**壊れる形をしている。
     ① 出す相手を間違えない ── 未ログイン・もう給与を出した人・さっき見た人には出ない
     ② 入力の途中の画面と、同じ3段を本文で出している画面（REAL PAY / DEEP PAY）では出ない
     ③ 出さないと決まった人の通信を増やさない ── pv-give-first.js を**読み込みもしない**
     ④ ★左メニューに錠前を足さない。この板は pv-gates.js を「文言を借りるため」だけに
        読む。boot() まで走らせると、頼まれていない 400 枚のナビに錠前が付く
     ⑤ 閉じられる（×・ESC・あとで出す・外側）。閉じたら body のスクロールが戻る
     ⑥ 札に「いま開きます」と書かない（2026-09-15 オーナー指示。条件を書く）

   ★時間で待たない。板を出すかどうかの判定（giveFirstDue）も、読み込むかどうかも
     <head> で同期に済むので、domcontentloaded のあとに数えれば揺れない。
     出るほうだけは待つが、これは条件待ち（waitForSelector）。

   実行: node serve.mjs を上げてから node assert-give-first.mjs                  */
import puppeteer from 'puppeteer';

const BASE = 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (c, m, got) => { c ? (pass++, console.log(`  ✅ ${m}`))
                              : (fail++, console.log(`  ❌ ${m}  → 実際: ${JSON.stringify(got)}`)); };

/* ログイン済みに見せる最小の状態。pv-session.js が見るのは2つだけ ──
   pv_user（名前）と sb-…-auth-token（鍵）。鍵の中の last_sign_in_at が
   「このログインの印」になるので、いつ流しても新しい値を入れる。 */
const signedInAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const MEMBER = {
  pv_user: JSON.stringify({ id: 'u-test', email: 'pilot@example.com', name: 'test' }),
  'sb-test-auth-token': JSON.stringify({ user: { id: 'u-test', last_sign_in_at: signedInAt } })
};
const GAVE = { ...MEMBER, pv_salary_unlock_expiry: String(Date.now() + 30 * 86400 * 1000) };

const browser = await puppeteer.launch({ headless: 'shell' });
const page = await browser.newPage();

/* localStorage を入れてから開き直す。1回目は「その origin を開くため」だけ。 */
async function visit(url, state) {
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await page.evaluate((st) => {
    localStorage.clear(); sessionStorage.clear();
    Object.keys(st).forEach((k) => localStorage.setItem(k, st[k]));
  }, state);
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
}

/* 「読み込んだか」は <head> で同期に決まる。数えるだけで足りる。 */
const loaded = () => page.evaluate(
  () => document.querySelectorAll('script[src*="pv-give-first.js"]').length);

for (const dir of ['', '/en']) {
  const L = dir ? 'en' : 'ja';
  const PLAIN = `${dir}/world-airlines.html`;     // supabase を読まない軽いページ
  const DEEP  = `${dir}/airlines/ana.html`;       // 1つ深い階層（相対リンクの検算）
  const WANT = dir
    ? { pill: 'Share pay to unlock', later: 'Later', cta: 'Add your pay anonymously',
        title: 'One step to go!', open: /open now/i }
    : { pill: '給与提出で解放', later: 'あとで出す', cta: '匿名で給与を追加する',
        title: 'あと1ステップです！', open: /いま開き|今開き/ };

  console.log(`\n════ ${L} / ① 出す相手を間違えない ════\n`);

  await visit(PLAIN, {});
  ok(await loaded() === 0, `${L}: 未ログインの人には読み込みもしない`, await loaded());

  await visit(PLAIN, GAVE);
  ok(await loaded() === 0, `${L}: ★もう給与を出した人には出さない（鍵が生きている）`, await loaded());

  await visit(PLAIN, { pv_user: MEMBER.pv_user });
  ok(await loaded() === 0, `${L}: 名前だけ残った死んだログインには出さない`, await loaded());

  await visit(PLAIN, MEMBER);
  ok(await loaded() === 1, `${L}: ★登録だけの会員には出す`, await loaded());

  console.log(`\n════ ${L} / ② 出さない画面 ════\n`);

  /* ★ページを開き直さずに場所だけ変える（pushState）。
       pay-report / actual-pay は supabase を読むので、ここで開くと
       偽の鍵で本番の認証へ問い合わせが飛ぶ。判定だけを見たいので開かない。 */
  const paths = await page.evaluate(() => {
    const here = location.pathname;
    const out = {};
    /* ★さっき板が出た記録を先に消す。残っていると全部 false になり、
         「出さない画面だから出さない」のか「もう見たから出さない」のか
         区別が付かないまま緑になる。 */
    localStorage.removeItem('pv_give_seen');
    const at = (p) => { history.pushState({}, '', p); return window.PVSession.giveFirstDue(); };
    ['pay-report.html', 'submit-review.html', 'signup.html', 'login.html',
     'auth-callback.html', 'contact.html', 'admin.html', 'unsubscribe.html', '404.html',
     'actual-pay.html', 'deep-pay.html', 'deep-pay-compare.html',
     'index.html', 'community.html', 'my-value.html', 'profile.html',
     'airlines/ana.html',
     'profile.html?claim=xxxx'].forEach((p) => { out[p] = at('/' + p); });
    history.pushState({}, '', here);
    return out;
  });
  for (const p of ['pay-report.html', 'submit-review.html', 'signup.html', 'login.html',
                   'auth-callback.html', 'contact.html', 'admin.html', 'unsubscribe.html',
                   '404.html', 'profile.html?claim=xxxx']) {
    ok(paths[p] === false, `${L}: ${p} では出さない（入力の途中・対象外）`, paths[p]);
  }
  for (const p of ['actual-pay.html', 'deep-pay.html', 'deep-pay-compare.html']) {
    ok(paths[p] === false, `${L}: ★${p} では出さない（同じ3段を本文で出している）`, paths[p]);
  }
  for (const p of ['index.html', 'community.html', 'my-value.html', 'profile.html',
                   'airlines/ana.html']) {
    ok(paths[p] === true, `${L}: ${p} では出す`, paths[p]);
  }

  console.log(`\n════ ${L} / ③ 中身 ════\n`);

  await visit(DEEP, MEMBER);
  await page.waitForSelector('#pvgf-back.is-in', { timeout: 15000 });
  const got = await page.evaluate(() => {
    const b = document.getElementById('pvgf-back');
    const a = b.querySelector('.pvgf-go');
    const live = b.querySelector('.pv-give-r.is-live .pv-give-p');
    return {
      title: (b.querySelector('.mr-gate-t') || {}).textContent || '',
      rows:  b.querySelectorAll('.pv-give-r').length,
      press: b.querySelectorAll('.pv-give-l button').length,
      pill:  (live ? live.textContent : '').trim(),
      cta:   (a.textContent || '').trim(),
      href:  new URL(a.getAttribute('href'), location.href).pathname,
      hash:  new URL(a.getAttribute('href'), location.href).hash,
      later: (b.querySelector('.pvgf-later') || {}).textContent || '',
      text:  b.textContent || '',
      locks: document.querySelectorAll('.mr-side-lk').length,
      textOnly: window.PV_GATES_TEXT_ONLY === true,
      overflow: document.body.style.overflow,
      /* 見た目が本当に当たっているか。板は約420枚に出るが、my-value.css を
         読んでいるのは18枚だけ ── その取り違えを実際にやった（2026-09-15）。 */
      css: {
        sheet: [].slice.call(document.styleSheets)
                 .some((x) => (x.href || '').indexOf('pv-give.css') >= 0),
        scrim: getComputedStyle(b).backgroundColor,
        card:  getComputedStyle(b.querySelector('.pvgf-card')).backgroundColor,
        cta:   getComputedStyle(a).backgroundColor,
        rule:  getComputedStyle(b.querySelector('.pv-give-l')).borderTopWidth
      }
    };
  });

  /* 透けていない＝色が付いている（alpha 0 や transparent でない）。 */
  const painted = (c) => !!c && c !== 'transparent' && !/,\s*0\)$/.test(c);

  ok(got.title.trim() === WANT.title, `${L}: 見出しは「${WANT.title}」`, got.title);
  ok(got.rows === 3, `${L}: Give → Get が3段`, got.rows);
  ok(got.press === 0, `${L}: ★表の札は1つも押せない（下にもう1枚パネルを開かせない）`, got.press);
  ok(got.pill === WANT.pill, `${L}: ★REAL PAY の札は「開く条件」`, got.pill);
  ok(!WANT.open.test(got.text), `${L}: ★「いま開きます」と書かない`, got.text.slice(0, 120));
  ok(got.cta === WANT.cta, `${L}: 主ボタンは「${WANT.cta}」`, got.cta);
  ok(got.href === `${dir}/pay-report.html` && got.hash === '#ps',
     `${L}: ★1つ深い階層からでも給与フォームへ着く`, got.href + got.hash);
  ok(got.later.trim() === WANT.later, `${L}: 「${WANT.later}」が小さく下にある`, got.later);
  ok(got.overflow === 'hidden', `${L}: 開いているあいだは後ろが動かない`, got.overflow);

  console.log(`\n════ ${L} / ③-b 見た目が当たっている ════\n`);
  ok(got.css.sheet, `${L}: ★pv-give.css を読んでいる（18枚しか持っていない）`, got.css.sheet);
  ok(painted(got.css.scrim), `${L}: 後ろが暗くなっている`, got.css.scrim);
  ok(painted(got.css.card), `${L}: ★板に下地がある（素の文字列になっていない）`, got.css.card);
  ok(painted(got.css.cta) && got.css.cta !== got.css.card,
     `${L}: 主ボタンが塗られている`, got.css.cta);
  ok(got.css.rule === '1px', `${L}: ★3段の表に罫線が出ている`, got.css.rule);

  console.log(`\n════ ${L} / ④ 左メニューに錠前を足さない ════\n`);
  ok(got.textOnly === true, `${L}: pv-gates.js は文言だけ借りる印が立っている`, got.textOnly);
  ok(got.locks === 0, `${L}: ★★ナビの REAL PAY に錠前が増えていない`, got.locks);

  console.log(`\n════ ${L} / ⑤ 閉じられる ════\n`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('pvgf-back'), { timeout: 5000 });
  ok(true, `${L}: ESC で閉じる`);
  ok(await page.evaluate(() => document.body.style.overflow) !== 'hidden',
     `${L}: ★閉じたら後ろのスクロールが戻る`);

  console.log(`\n════ ${L} / ⑥ 同じログインで2回出さない ════\n`);
  await page.goto(BASE + DEEP, { waitUntil: 'domcontentloaded' });
  ok(await loaded() === 0, `${L}: ★一度見た人には、同じログインのあいだ出さない`, await loaded());
  const rec = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('pv_give_seen') || 'null'); } catch (e) { return null; }
  });
  ok(rec && typeof rec.t === 'number' && rec.s,
     `${L}: 見せた記録に「いつ」と「どのログインか」が入っている`, rec);

  /* 別のログイン（印が変われば）また出る。「ログインしたら毎回1回」がこれ。 */
  await page.evaluate(() => {
    localStorage.setItem('sb-test-auth-token', JSON.stringify(
      { user: { id: 'u-test', last_sign_in_at: new Date().toISOString() } }));
  });
  await page.goto(BASE + DEEP, { waitUntil: 'domcontentloaded' });
  ok(await loaded() === 1, `${L}: ★ログインし直したらまた出る`, await loaded());
}

await browser.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══\n`);
process.exit(fail ? 1 : 0);
