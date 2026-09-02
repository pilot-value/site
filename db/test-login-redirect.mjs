/* ログイン後の戻り先。ここは3つの意味で壊れると痛い。
   ① 名前が合わないと戻れない（＝「そのまま送信されます」が嘘になる）
   ② 緩いと外部サイトへ飛ばせる（＝ログイン直後にフィッシングへ流せる）
   ③ 失敗したときに言語と戻り先を落とすと、そこが行き止まりになる
      （2026-09-01、英語版から明細を出した人が登録まで届かなかった実例）
   なので、実際に localhost のページを読み込んで**本物のコード**を呼ぶ。
   auth-callback の判定は pvSafeNext / pvLoginUrl という関数になっているので
   そのまま呼ぶ（判定式をテスト側に写経すると、写経の方だけ直して本体が古いまま、
   という一番まずい通り方をしてしまう）。
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

  /* ★auth-callback.html の判定を**本物の関数として**呼ぶ。
     以前は HTML から正規表現でブロックを切り出して実行していた。だが本体を少し
     書き換えるだけで切り出しが見つからなくなる＝本体より先に検査のほうが壊れる。
     2026-09-01 に本体を pvSafeNext / pvLoginUrl という関数に出したので、直接呼ぶ。 */
  console.log(`\n${label} auth-callback.html の next 判定（本物の関数を呼ぶ）\n`);
  for (const [q, want, desc] of CASES.filter((c) => c[0].startsWith('?next='))) {
    await page.goto(`${BASE}${dir}/auth-callback.html${q}`, { waitUntil: 'domcontentloaded' });
    const got = await page.evaluate(() => {
      if (typeof pvSafeNext !== 'function') return 'NOT_FOUND: pvSafeNext が無い（本体が書き換わった？）';
      try {
        const next = pvSafeNext(new URLSearchParams(location.search).get('next'));
        return new URL(next || 'profile.html', location.href).pathname;
      } catch (e) { return 'THREW:' + e.message; }
    });
    ok(got === want(dir), `${desc}  ${q} → ${want(dir)}`, got);
  }

  /* ★失敗して戻されるときの行き先。ここが今回の穴だった。
     2026-09-01、英語版の給与フォームから明細を出したカンタスのパイロットが
     Google ログインの往復で落ち、言語に関係なく日本語の login.html へ飛ばされ、
     しかも next に載せた預かり証ごと捨てられた＝英語の人には行き止まりだった。
     見るのは4つ ①言語を保つ ②next を保つ ③預かり証を URL に載せない
     （login.html は GA4 を持つので、載せると page_location として Google に渡る）
     ④そのぶん端末には残す。 */
  console.log(`\n${label} auth-callback.html の失敗時の行き先\n`);
  const FAILS = [
    ['?next=%2Fen%2Fpay-report.html',         '/en/login.html',   '/en/pay-report.html', '英語の next → 英語の login'],
    ['?next=%2Fpay-report.html',              '/login.html',      '/pay-report.html',    '日本語の next → 日本語の login'],
    ['?next=https%3A%2F%2Fevil.com%2Fx.html', `${dir}/login.html`, '',                   '外部URL → next を付けない'],
    ['',                                      `${dir}/login.html`, '',                   'next なし → 自分の言語の login'],
  ];
  for (const [q, wantLogin, wantNext, desc] of FAILS) {
    await page.goto(`${BASE}${dir}/auth-callback.html${q}`, { waitUntil: 'domcontentloaded' });
    const got = await page.evaluate(() => {
      if (typeof pvLoginUrl !== 'function') return { err: 'NOT_FOUND: pvLoginUrl が無い' };
      try {
        const u = new URL(pvLoginUrl('no_code'), location.href);
        return { path: u.pathname, next: u.searchParams.get('next') || '', reason: u.searchParams.get('reason') || '' };
      } catch (e) { return { err: 'THREW:' + e.message }; }
    });
    ok(got.path === wantLogin, `${desc}  ${q || '(なし)'} → ${wantLogin}`, got.path ?? got.err);
    ok(got.next === wantNext,  `${desc}  → next=${wantNext || '(付けない)'}`, got.next ?? got.err);
    ok(got.reason === 'no_code', `${desc}  → reason が載る（着地側で GA4 に出す）`, got.reason ?? got.err);
  }

  // ★預かり証つきで戻された場合：URL からは消え、端末には残る
  const TOK = 'a1b2c3d4'.repeat(6);   // 48桁16進
  await page.goto(`${BASE}${dir}/auth-callback.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(`${BASE}${dir}/auth-callback.html?next=` +
                  encodeURIComponent('/en/pay-report.html?claim=' + TOK), { waitUntil: 'domcontentloaded' });
  const claim = await page.evaluate(() => {
    if (typeof pvLoginUrl !== 'function') return { err: 'NOT_FOUND: pvLoginUrl が無い' };
    const url = pvLoginUrl('oauth_error');
    return { url, path: new URL(url, location.href).pathname, stash: localStorage.getItem('pv_pay_claim') || '' };
  });
  ok(!(claim.url || '').includes(TOK), '預かり証が行き先 URL に一度も現れない', claim.url ?? claim.err);
  ok((claim.stash || '').includes(TOK), '預かり証は端末に残っている（登録後に引き取れる）', claim.stash ?? claim.err);
  ok(claim.path === '/en/login.html', '預かり証つきでも英語のまま /en/login.html へ', claim.path ?? claim.err);

  /* ★この画面そのものの言語。英語の人もルート側の auth-callback.html に着地する
     （pay-login.js の callbackUrl() が pilot-value.com/auth-callback.html を固定で書く）。
     2026-09-02 まで、読み込み中の一行も失敗の詳細も日本語のままだった。
     見出しだけ英語で下の一行が日本語だと、英語の人には読めない一行が4秒出るだけになる。
     ※ここに来た時点で認証コードが無いので、本体は既に失敗の表示に入っている。 */
  console.log(`\n${label} auth-callback.html の画面の言語\n`);
  const CJK = /[ぁ-んァ-ヶ一-龯]/;
  for (const [next, wantEn, desc] of [
    ['/en/pay-report.html', true,  '英語の next → 画面ぜんぶ英語'],
    ['/pay-report.html',    false, '日本語の next → 画面ぜんぶ日本語'],
  ]) {
    await page.goto(`${BASE}${dir}/auth-callback.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { try { localStorage.removeItem('pv-lang'); } catch (e) {} });
    await page.goto(`${BASE}${dir}/auth-callback.html?next=${encodeURIComponent(next)}`,
                    { waitUntil: 'domcontentloaded' });
    const seen = await page.evaluate(() => ({
      title: document.title,
      msg:   (document.getElementById('msg') || {}).textContent || '',
      debug: (document.getElementById('debug') || {}).textContent || '',
      lang:  (() => { try { return localStorage.getItem('pv-lang'); } catch (e) { return null; } })(),
    }));
    const all = [seen.title, seen.msg, seen.debug].join(' | ');
    ok(seen.debug.length > 0, `${desc}  失敗の詳細が出ている`, all);
    ok(CJK.test(all) !== wantEn, `${desc}  ${all}`, all);
    /* ★この先ずっと英語のままにする。lang-toggle.js はこの画面では読まない
       （?code= を持ったまま /en/ へ移そうとして認証が落ちるため）ので、
       pv-lang はここが自分で書く。書くのは 'en' だけ・まだ無印の人にだけ。 */
    if (wantEn) ok(seen.lang === 'en', `${desc}  この先も英語のままにする（pv-lang=en）`, String(seen.lang));
  }

  /* ★着地側。login.html が ?error=1&reason= を読んで案内を出すこと。
     2026-09-01 まで ?error=1 は誰も読んでおらず、戻された人の画面には
     何も出なかった（＝何が起きたのか本人にも運営にも分からない）。
     ★next は残す。残っていないと、やり直したログインの後に元の画面へ戻れない。 */
  console.log(`\n${label} login.html が失敗の理由を受ける\n`);
  for (const reason of ['in_app_browser', 'oauth_error', 'no_code', 'set_session', 'timeout', 'zzz<script>']) {
    await page.goto(`${BASE}${dir}/login.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${BASE}${dir}/login.html?error=1&reason=${encodeURIComponent(reason)}&next=` +
                    encodeURIComponent(`${dir}/pay-report.html`), { waitUntil: 'domcontentloaded' });
    const got = await page.evaluate(() => {
      const el = document.getElementById('auth-fail-notice');
      const q = new URLSearchParams(location.search);
      return {
        shown: !!el && getComputedStyle(el).display !== 'none',
        text: el ? (el.textContent || '').trim() : '',
        left: [...q.keys()].sort().join(','),
        next: q.get('next') || '',
        redirect: new URL(getRedirect(), location.href).pathname,
      };
    });
    ok(got.shown && got.text.length > 0, `reason=${reason} → 案内が出る`, got);
    ok(got.left === 'next', `reason=${reason} → error/reason だけ URL から消える`, got.left);
    ok(got.redirect === `${dir}/pay-report.html`, `reason=${reason} → 戻り先が残る`, got.redirect);
  }
  // アプリ内ブラウザだけは「メールにコードを送る」へ案内する（何度押しても Google は通らない）
  await page.goto(`${BASE}${dir}/login.html?error=1&reason=in_app_browser`, { waitUntil: 'domcontentloaded' });
  const inapp = await page.evaluate(() => {
    const t = (document.getElementById('auth-fail-notice') || {}).textContent || '';
    const btns = [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim());
    return { t, hit: btns.some((b) => b && t.includes(b)) };
  });
  ok(inapp.hit, 'アプリ内ブラウザの案内が、実在するボタンの文言をそのまま指している', inapp.t);
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
