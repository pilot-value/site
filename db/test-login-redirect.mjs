/* ログイン後の戻り先。ここは2つの意味で壊れると痛い。
   ① 名前が合わないと戻れない（＝「そのまま送信されます」が嘘になる）
   ② 緩いと外部サイトへ飛ばせる（＝ログイン直後にフィッシングへ流せる）
   なので、実際に localhost のページを読み込んで**本物のコード**を呼ぶ。
   auth-callback の判定は関数になっていないので、HTML から該当ブロックを
   切り出してそのまま実行する（判定式をテスト側に写経すると、写経の方だけ
   直して本体が古いまま、という一番まずい通り方をしてしまう）。
   実行: node serve.mjs を上げてから node db/test-login-redirect.mjs        */
import puppeteer from 'puppeteer';

const BASE = 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (c, m, got) => { c ? (pass++, console.log(`  ✅ ${m}`))
                              : (fail++, console.log(`  ❌ ${m}  → 実際: ${JSON.stringify(got)}`)); };

/* 期待値は「どのディレクトリのログイン画面から入ったか」で変わる。
   /en/login.html?next=pay-report.html は /en/pay-report.html に解決されるのが正しい
   （英語の人を日本語ページに落とさない）。だから dir を受け取る形で書く。 */
const CASES = [
  // [クエリ, 期待(dir => path), 説明]
  ['',                                   (d) => `${d}/profile.html`,      '指定なし → profile'],
  ['?redirect=profile.html',             (d) => `${d}/profile.html`,      'redirect=（既存の名前）'],
  ['?next=pay-report.html',              (d) => `${d}/pay-report.html`,   'next=（給与レポート。ここが壊れていた）'],
  ['?next=submit-review.html',           (d) => `${d}/submit-review.html`,'next=（口コミ投稿）'],
  ['?return=%2Fairlines%2Fjal.html',     ()  => '/airlines/jal.html',     'return=（航空会社ページ。絶対パスで来る）'],
  ['?return=..%2Fpay-report.html',       ()  => '/pay-report.html',       'return= の相対パス'],
  // ここから下は「外へ飛ばせないこと」
  ['?next=https://evil.com/x.html',      (d) => `${d}/profile.html`,      '外部URL → 捨てる'],
  ['?next=//evil.com/x.html',            (d) => `${d}/profile.html`,      'プロトコル相対 → 捨てる'],
  ['?next=javascript:alert(1)',          (d) => `${d}/profile.html`,      'javascript: → 捨てる'],
  ['?next=%5C%5Cevil.com',               (d) => `${d}/profile.html`,      'バックスラッシュ → 捨てる'],
  ['?next=http:%2F%2Fevil.com%2Fa.html', (d) => `${d}/profile.html`,      'エンコードされた外部URL → 捨てる'],
];

const browser = await puppeteer.launch({ headless: 'shell' });
const page = await browser.newPage();

for (const dir of ['', '/en']) {
  const label = dir || '(日本語)';

  console.log(`\n${label} login.html の getRedirect()\n`);
  for (const [q, want, desc] of CASES) {
    // ★セッションが残っていると読み込んだ瞬間に飛ぶので、毎回消してから開く
    await page.goto(`${BASE}${dir}/login.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${BASE}${dir}/login.html${q}`, { waitUntil: 'domcontentloaded' });
    const got = await page.evaluate(() => {
      try { return new URL(getRedirect(), location.href).pathname; } catch (e) { return 'THREW:' + e.message; }
    });
    ok(got === want(dir), `${desc}  ${q || '(なし)'} → ${want(dir)}`, got);
  }

  /* ★signup.html も同じ3つの名前を受けること。
     2026-08-11 まで signup.html は redirect= しか読まず、しかも同一オリジン検査が
     無かった。実害は2つあった：
       ① 口コミを書きに来て登録した人が全員 profile.html に落ちていた（意図の消失）
       ② ?redirect=https://evil.com をそのまま location.href に入れていた（外部誘導）
     login.html と同じ CASES をそのまま当てる。 */
  console.log(`\n${label} signup.html の getRedirect()\n`);
  for (const [q, want, desc] of CASES) {
    await page.goto(`${BASE}${dir}/signup.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${BASE}${dir}/signup.html${q}`, { waitUntil: 'domcontentloaded' });
    const got = await page.evaluate(() => {
      try { return new URL(getRedirect(), location.href).pathname; } catch (e) { return 'THREW:' + e.message; }
    });
    ok(got === want(dir), `${desc}  ${q || '(なし)'} → ${want(dir)}`, got);
  }

  /* ★登録完了画面。?next= で来た人を、登録前にやろうとしていた場所へ戻す。
     ここが submit-review.html 固定だと、明細を出しに来た人まで口コミへ送ってしまう。

     行き先だけでなく**3行の文言**も見る。ボタンの行き先が正しくても、
     見出し「口コミを1件投稿すると…」が残っていると画面が食い違う。実際に
     英語側が `to` = '/en/pay-report.html' でファイル名比較に入らず、
     行き先は正しいのにボタンが "Continue →" のままだった（行き先だけの検査は通っていた）。 */
  console.log(`\n${label} signup.html 登録完了画面の行き先と文言\n`);
  // [クエリ, 期待パス, {見出しとボタンに要る語, 「あとで」の行}, 説明]
  const R = dir ? { word: 'review',  later: 'Later → Go to the site' }
                : { word: '口コミ',  later: 'あとで書く → サイトへ' };
  const P = dir ? { word: 'payslip', later: 'Later → Go to the site' }
                : { word: '明細',    later: 'あとで出す → サイトへ' };
  const CTA = [
    ['',                              `${dir}/submit-review.html`, R, '指定なし → 既定の口コミ'],
    ['?next=submit-review.html',      `${dir}/submit-review.html`, R, 'next=口コミ → 口コミ'],
    ['?next=pay-report.html',         `${dir}/pay-report.html`,    P, 'next=明細 → 明細（ここが固定だと迷子になる）'],
    ['?next=https://evil.com/x.html', `${dir}/submit-review.html`, R, '外部URL → 捨てて既定へ'],
  ];
  for (const [q, want, exp, desc] of CTA) {
    await page.goto(`${BASE}${dir}/signup.html${q}`, { waitUntil: 'domcontentloaded' });
    const got = await page.evaluate(() => {
      const b = document.getElementById('success-cta');
      if (!b) return { err: 'NOT_FOUND: #success-cta が無い' };
      showSuccessCta();
      const txt = (id) => (document.getElementById(id) || {}).textContent || '';
      return {
        path: new URL(b.dataset.href || 'submit-review.html', location.href).pathname,
        cta: b.textContent, lead: txt('success-lead'), later: txt('success-later'),
      };
    });
    ok(got.path === want, `${desc}  ${q || '(なし)'} → ${want}`, got.path || got.err);
    ok([got.cta, got.lead].every((t) => t && t.includes(exp.word)) && got.later === exp.later,
       `${desc}  見出し・ボタン・あとでの3行が「${exp.word}」で揃っている`,
       [got.cta, got.lead, got.later]);
  }

  /* ★login.html →「新規登録」リンクで戻り先を落とさないこと。
     ここが素の signup.html だったせいで、上の getRedirect をいくら直しても
     口コミ経由の人には何も渡っていなかった（リンク1本で意図が消える）。 */
  console.log(`\n${label} login.html →「新規登録」への引き継ぎ\n`);
  // [クエリ, next= の期待（空なら付かない）, リンク自体の行き先, 説明]
  const LINK = [
    ['?next=submit-review.html', `${dir}/submit-review.html`, `${dir}/signup.html`,     '口コミから来た人'],
    ['?next=pay-report.html',    `${dir}/pay-report.html`,    `${dir}/signup.html`,     '明細から来た人'],
    // ★既定が signup.html だと「出さずに登録だけして帰る」道が残る。給与の画面へ送る。
    ['',                         '',                          `${dir}/pay-report.html`, '指定なし → 給与の画面（登録は送信時にその場で済む）'],
  ];
  for (const [q, wantNext, wantPath, desc] of LINK) {
    await page.goto(`${BASE}${dir}/login.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${BASE}${dir}/login.html${q}`, { waitUntil: 'domcontentloaded' });
    const got = await page.evaluate(() => {
      const a = document.getElementById('to-signup');
      if (!a) return { err: 'NOT_FOUND: #to-signup が無い' };
      const u = new URL(a.getAttribute('href'), location.href);
      return { next: u.searchParams.get('next') || '', path: u.pathname };
    });
    const norm = got.next ? new URL(got.next, `${BASE}${dir}/`).pathname : '';
    ok(norm === wantNext, `${desc}  ${q || '(なし)'} → next=${wantNext || '(付けない)'}`, got.next ?? got.err);
    ok(got.path === wantPath, `${desc}  ${q || '(なし)'} → リンク先 ${wantPath}`, got.path ?? got.err);
  }

  /* ★トップページに「出さずに登録する」入口が無いこと。
     2026-08-17 まで、給与の導線のすぐ隣に signup.html 直行のボタンと文中リンクが
     並んでいた。会員18人・給与レポート0件の状態は、その逃げ道の側から入っていた。
     登録は pay-report.html の送信時にその場で済むので、トップに別入口は要らない。
     日英で同じ形であることも同時に見る（片方だけ塞ぐと英語側から抜けられる）。 */
  console.log(`\n${label} トップページに signup.html への入口が無い\n`);
  await page.goto(`${BASE}${dir}/`, { waitUntil: 'domcontentloaded' });
  const top = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href]')]
      .map((a) => ({ href: a.getAttribute('href'), text: (a.textContent || '').trim().slice(0, 40) }))
      .filter((x) => /(^|\/)signup\.html/.test(x.href));
    const pay = [...document.querySelectorAll('a[href]')]
      .filter((a) => /(^|\/)pay-report\.html/.test(a.getAttribute('href'))).length;
    return { links, pay };
  });
  ok(top.links.length === 0, 'signup.html へのリンクが1本も無い', top.links);
  ok(top.pay >= 3, `給与の画面への導線が残っている（${top.pay}本）`, top.pay);

  console.log(`\n${label} auth-callback.html の next 判定（HTMLから切り出して実行）\n`);
  for (const [q, want, desc] of CASES.filter((c) => c[0].startsWith('?next='))) {
    await page.goto(`${BASE}${dir}/auth-callback.html${q}`, { waitUntil: 'domcontentloaded' });
    const got = await page.evaluate(async (dir) => {
      const src = await (await fetch(`${dir}/auth-callback.html`)).text();
      const m = src.match(/const raw = new URLSearchParams[\s\S]*?window\.location\.replace\(next \|\| 'profile\.html'\);/);
      if (!m) return 'NOT_FOUND: 判定ブロックが見つからない（本体が書き換わった？）';
      const body = m[0].replace("window.location.replace(next || 'profile.html');",
                               "return next || 'profile.html';");
      try { return new URL(new Function(body)(), location.href).pathname; }
      catch (e) { return 'THREW:' + e.message; }
    }, dir);
    ok(got === want(dir), `${desc}  ${q} → ${want(dir)}`, got);
  }
}

/* ★リンク元とログイン画面の名前が合っていることも見る。
   サイト内で使われているパラメータ名が3つ（next / redirect / return）で
   固定されている限りは通る。4つ目が生えたらここで落ちる。 */
console.log('\nサイト内のログインリンクが使っている名前\n');
const names = await page.evaluate(async () => {
  const files = ['/pay-report.html', '/en/pay-report.html', '/airlines/premium-auth-lock.js',
                 '/airlines/airline-reviews-ui.js', '/submit-review.html'];
  const found = new Set();
  for (const f of files) {
    const t = await (await fetch(f)).text();
    for (const m of t.matchAll(/login\.html\?([a-z]+)=/g)) found.add(m[1]);
  }
  return [...found].sort();
});
ok(names.every((n) => ['next', 'redirect', 'return'].includes(n)),
   `使われている名前 = ${names.join(' / ')}（3つとも getRedirect が受ける）`, names);

await browser.close();
console.log(`\n${pass} pass / ${fail} fail\n`);
process.exit(fail ? 1 : 0);
