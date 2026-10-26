/* パイロットであることの確認 ── 画面の側（pv-session.js の proofDue・pv-proof.js・admin.html）。

   ★本体はサーバ側で、そちらは db/test-proof.mjs が見ている（止めた会員に中身が返らない・
     承認で画像が消える）。ここで見るのは、画面が約束どおりに振る舞うかだけ：

     A) 出す相手を間違えない
        未ログインには何も読み込まない（通信ゼロ）／止まっていない会員には出さない・
        聞くのは各ページ1回／後から止まった会員には次のページで最新の要求を出す／
        止まっている会員には、次のページから**聞く前に**出る
     B) 板の約束
        閉じる手段が無い（×・外・ESC）／下のページを触れない／オーナーが挙げた4つの例が
        出ている／**確認後の画像の扱いを書いていない**（オーナー指示）／
        Give → Get の板を重ねない／運営に連絡できる画面と規約では出さない
     C) 画像は JPEG に焼き直してから送る（付帯情報が落ちる）・大きさの上限に収まる
     D) 運営が承認したら、自分で消える
     E) 管理画面 ── 入口はサーバーの関数だけ・「破棄しました」は本当に消えたときだけ言う・
        SQL を貼る前でも、ほかの表は今までどおり出る

   ★本番の Supabase には1本も届かせない。supabase.co 宛ては全部ここで答える。
   ★時間で待たない。出るほうは条件待ち（waitForSelector / waitForFunction）。
     「出ない」ほうは、サーバの答えが届いたこと（写しが書かれたこと）を待ってから数える。
   ⚠️ 会員を名指しで書かない。ここの人は全員、作り物。

   実行: node serve.mjs を上げてから node assert-proof.mjs                        */
import puppeteer from 'puppeteer';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (c, m, got) => { c ? (pass++, console.log(`  ✅ ${m}`))
                              : (fail++, console.log(`  ❌ ${m}  → 実際: ${JSON.stringify(got)}`)); };

/* ログイン済みに見せる最小の状態。鍵は生きている（期限が先）形にしておく ──
   pv-proof.js は、生きているトークンが在るときだけ fetch で聞きに行く。 */
const signedInAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const TOKEN = 'test-access-token';
const MEMBER = {
  pv_user: JSON.stringify({ id: 'u-test', email: 'pilot@example.com', name: 'test' }),
  'sb-vzgmnkrggrwtsrpqndsm-auth-token': JSON.stringify({
    access_token: TOKEN, token_type: 'bearer',
    expires_at: Math.floor(Date.now() / 1000) + 3000,
    user: { id: 'u-test', last_sign_in_at: signedInAt } })
};
/* 写し（pv-session.js の K_PROOF）。l はログインの印 ＝ last_sign_in_at の時刻。 */
const cached = (s, a = 0) => ({ ...MEMBER,
  pv_proof: JSON.stringify({ s, a, t: Date.now(), l: String(Date.parse(signedInAt)) }) });

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const tmp = mkdtempSync(join(tmpdir(), 'pv-proof-'));

/* ── サーバの代役 ─────────────────────────────────────────────
   server.state を書き換えると、次に聞かれたときの答えが変わる。 */
function wire(page, server) {
  const cors = { 'access-control-allow-origin': '*',
                 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  page.on('request', (r) => {
    const u = r.url();
    if (u.startsWith(BASE)) return r.continue();
    if (!/supabase\.co/.test(u)) return r.abort();          // 解析タグ・フォントなど。外へ出さない
    /* 事前の問い合わせ（OPTIONS）は数に入れない。数えるのは本物の1本だけ。 */
    if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: cors });
    server.hits.push(u.replace(/^https:\/\/[^/]+/, ''));
    const json = (v, status = 200) => r.respond({ status, headers: cors,
      contentType: 'application/json', body: JSON.stringify(v) });
    if (/\/rpc\/pv_proof_state$/.test(u)) {
      server.auth.push(r.headers().authorization || '');
      if (server.fail) return r.abort();
      const send = () => { server.answered++; return json(server.state); };
      return server.delay ? setTimeout(send, server.delay) : send();
    }
    if (/\/rpc\/pv_proof_submit$/.test(u)) {
      server.sent.push(JSON.parse(r.postData() || '{}'));
      if (server.submitFail) return r.abort();
      return json(server.submit);
    }
    if (/\/auth\/v1\/logout/.test(u)) return json({}, 204);
    return json({});
  });
}
const newServer = (state) => ({ state, hits: [], auth: [], sent: [], delay: 0, fail: false, answered: 0,
                                submit: { ok: true, state: 'submitted' }, submitFail: false });

async function open(url, keys, server, viewport = { width: 1280, height: 800 }) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.setRequestInterception(true);
  wire(page, server);
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await page.evaluate((st) => {
    localStorage.clear(); sessionStorage.clear();
    Object.keys(st).forEach((k) => localStorage.setItem(k, st[k]));
  }, keys);
  server.hits.length = 0; server.auth.length = 0;
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  return page;
}
const proofKey = (page) => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('pv_proof') || 'null'); } catch (e) { return null; } });
const board = (page) => page.evaluate(() => {
  const b = document.getElementById('pvpf-back');
  if (!b) return null;
  const c = b.querySelector('.pvpf-card');
  return { text: c.innerText, title: (c.querySelector('.pvpf-t') || {}).textContent || '',
           ex: [...c.querySelectorAll('.pvpf-ex li:not(.pvpf-etc)')].map((e) => e.textContent),
           buttons: [...c.querySelectorAll('button')].map((e) => e.textContent.trim()),
           links: [...c.querySelectorAll('a')].map((e) => e.getAttribute('href')) };
});
const asks = (server) => server.hits.filter((h) => /pv_proof_state/.test(h)).length;
/* 「確認後の画像の扱い」を書いていないこと（オーナー指示）。 */
const SAYS_FATE = /破棄|削除|消去|捨て|保存|discard|delet|destroy|erase|\bretain|\bstor(e|ed|age)\b/i;

/* ページが読み直される途中で数えると「実行の場が消えた」で落ちる。
   それは答えではないので、読み直しが済むまで同じ条件を聞き直す。 */
async function until(page, fn, arg) {
  for (let i = 0; i < 20; i++) {
    try { await page.waitForFunction(fn, { timeout: 15000 }, arg); return true; }
    catch (e) { if (!/context was destroyed|detached|navigat/i.test(String(e.message))) throw e; }
  }
  return false;
}

for (const dir of ['', '/en']) {
  const L = dir ? 'en' : 'ja';
  const PLAIN = `${dir}/world-airlines.html`;     // supabase を読まない軽いページ
  const DEEP  = `${dir}/airlines/ana.html`;       // 1つ深い階層（相対リンクの検算）
  const W = dir
    ? { t: 'Please confirm that you are a pilot',
        ex: ['Epaulettes', 'Wing badge', 'Commercial pilot licence', 'Roster'],
        pick: 'Choose an image to submit', send: 'Submit this image', doneT: 'We have received your image',
        again: /could not confirm/i, out: 'Log out', net: /could not be sent/i }
    : { t: 'パイロットであることの確認をお願いします',
        ex: ['肩章', 'ウィングバッジ', '事業用操縦士の免許証', '勤務表'],
        pick: '画像を選んで提出する', send: 'この画像を提出する', doneT: '画像を受け取りました',
        again: /確認できませんでした/, out: 'ログアウト', net: /送信できませんでした/ };

  // ════════════════════════════════════════════════════════════
  console.log(`\n════ A) ${L} — 出す相手を間違えない ════`);
  // ════════════════════════════════════════════════════════════
  {
    const sv = newServer({ state: 'required', again: false });
    const page = await open(PLAIN, {}, sv);
    await page.waitForFunction(() => !!window.PVSession);
    ok(await page.$('script[src*="pv-proof.js"]') === null, '未ログイン：pv-proof.js を読み込まない');
    ok(sv.hits.length === 0, '未ログイン：サーバへ1本も投げない', sv.hits);
    ok(await page.$('#pvpf-back') === null, '未ログイン：板は出ない');
    await page.close();
  }
  {
    const sv = newServer({ state: 'none', again: false });
    const page = await open(PLAIN, MEMBER, sv);
    await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('pv_proof') || '{}').s === 'ok'; } catch (e) { return false; } });
    ok(await page.$('#pvpf-back') === null, '止まっていない会員：板は出ない');
    ok(asks(sv) === 1, '止まっていない会員：聞くのは1回だけ', sv.hits);
    ok(sv.auth[0] === 'Bearer ' + TOKEN, '聞くときは本人のトークンを添える', sv.auth[0]);
    sv.hits.length = 0;
    sv.state = { state: 'required', again: false };
    await page.goto(BASE + DEEP, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#pvpf-back.is-in');
    ok(asks(sv) === 1 && (await proofKey(page)).s === 'required',
       '後から止まった会員：古い許可の写しがあっても次のページで最新の要求を出す', sv.hits);
    await page.close();
  }
  {
    // サーバに聞けなかった回は、何も書かない（次のページでもう一度聞く）
    const sv = newServer({ state: 'none', again: false });
    sv.fail = true;
    const page = await open(PLAIN, MEMBER, sv);
    await page.waitForFunction(() => !!window.__pvProof);
    await page.waitForNetworkIdle({ idleTime: 300 });
    ok(await proofKey(page) === null && await page.$('#pvpf-back') === null,
       '聞けなかった回：写しを書かない・板も出さない', await proofKey(page));
    await page.close();
  }

  // ════════════════════════════════════════════════════════════
  console.log(`\n════ B) ${L} — 止まっている会員に出る板 ════`);
  // ════════════════════════════════════════════════════════════
  {
    // ログイン直後の1ページ目（写しはまだ無い → 聞いてから出る）
    const sv = newServer({ state: 'required', again: false });
    const page = await open(PLAIN, MEMBER, sv);
    await page.waitForSelector('#pvpf-back.is-in');
    const b = await board(page);
    ok(b.title === W.t, '見出し', b.title);
    ok(JSON.stringify(b.ex) === JSON.stringify(W.ex), '★例はオーナーが挙げた4つ（肩章・ウィングバッジ・事業用操縦士の免許証・勤務表）', b.ex);
    ok(b.buttons.includes(W.pick), '画像を出すボタンが在る', b.buttons);
    ok(!SAYS_FATE.test(b.text), '★確認後の画像の扱いを書いていない（オーナー指示）', b.text.match(SAYS_FATE));
    ok((await proofKey(page)).s === 'required', '答えの写しを持つ（次のページから聞く前に出すため）', await proofKey(page));

    // 閉じる手段が無い
    const shut = await page.evaluate(() => {
      const c = document.querySelector('.pvpf-card');
      return { x: !!c.querySelector('.mr-gate-x, [aria-label*="閉じ"], [aria-label*="lose"]'),
               modal: c.getAttribute('aria-modal'), role: c.getAttribute('role') };
    });
    ok(!shut.x && shut.modal === 'true' && shut.role === 'dialog', '★× が無い・モーダルとして名乗っている', shut);
    await page.keyboard.press('Escape');
    await page.mouse.click(8, 8);
    ok(await page.$('#pvpf-back') !== null, '★ESC でも、外を押しても閉じない');

    // 下のページを触れない
    const under = await page.evaluate(() => {
      const kids = [...document.body.children].filter((e) => e.id !== 'pvpf-back'
        && !['SCRIPT', 'STYLE', 'LINK'].includes(e.tagName));
      const hit = document.elementFromPoint(innerWidth / 2, 12);
      return { n: kids.length, inert: kids.filter((e) => e.hasAttribute('inert')).length,
               overflow: getComputedStyle(document.body).overflowY + '/'
                       + getComputedStyle(document.documentElement).overflowY,
               top: !!(hit && hit.closest('#pvpf-back')) };
    });
    ok(under.n > 0 && under.inert === under.n, '★下のページの部品はすべて触れない（inert）', under);
    ok(under.overflow === 'hidden/hidden' && under.top,
       '★スクロールが止まったまま（ESC や外押しでほかの部品が戻しても外れない）・画面のどこを押しても板に当たる', under);
    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
    ok(await page.evaluate(() => !!document.activeElement.closest('.pvpf-card')),
       'Tab を何度押しても、フォーカスは板の外へ出ない');

    /* Give → Get の板を重ねない。
       ⚠️ ここだけは時間で待つ（あちらが 700ms の時計で開く作りで、「開かなかった」には
          待つ相手が無い）。混んだ回に嘘の赤は出ない向き ── 遅れても「無い」は「無い」のまま。
          本当の鍵は下の giveFirstDue と、pv-give-first.js の open() の1行目。 */
    await page.waitForFunction(() => performance.now() > 2200);
    ok(await page.$('#pvgf-back') === null, '★Give → Get の板を重ねない');
    ok(await page.evaluate(() => window.PVSession.giveFirstDue()) === false,
       '★止まっている会員には giveFirstDue が false を返す');

    // お問い合わせへの道（1つ深い階層でも切れない）
    ok(b.links.length === 1 && /contact\.html$/.test(b.links[0]), 'お問い合わせへの道が在る', b.links);
    await page.close();
  }
  {
    // 次のページ：写しが「止まっている」なら、サーバの答えを待たずに出る
    const sv = newServer({ state: 'required', again: false });
    sv.delay = 1500;
    const page = await open(DEEP, cached('required'), sv);
    await page.waitForSelector('#pvpf-back');
    const early = { answered: sv.answered, title: (await board(page)).title };
    ok(early.answered === 0 && early.title === W.t,
       '★次のページからは、サーバの答えを待たずに板が出る（中身が一瞬見える、を作らない）', early);
    const href = await page.evaluate(() => document.querySelector('.pvpf-foot a').href);
    const res = await page.evaluate(async (h) => (await fetch(h, { method: 'HEAD' })).status, href);
    ok(res === 200, '1つ深い階層からも、お問い合わせのリンクが切れていない', [href, res]);
    await page.close();
  }
  {
    // 出し直しを求められている会員
    const sv = newServer({ state: 'required', again: true });
    const page = await open(PLAIN, cached('required', 1), sv);
    await page.waitForSelector('#pvpf-back');
    const b = await board(page);
    ok(W.again.test(b.text) && b.buttons.includes(W.pick), '出し直しを求められた会員には、その文が出る', b.text.slice(0, 80));
    ok(!SAYS_FATE.test(b.text), '★出し直しの文にも、画像の扱いを書いていない', b.text.match(SAYS_FATE));
    await page.close();
  }
  {
    // 出さない画面（運営に連絡する道・規約・ログインの途中）と、出す画面
    const sv = newServer({ state: 'required', again: false });
    const page = await open(PLAIN, cached('required'), sv);
    await page.waitForFunction(() => !!window.PVSession);
    const due = await page.evaluate((d) => {
      const at = (p) => { history.pushState({}, '', d + p); return window.PVSession.proofDue(); };
      const off = ['/contact.html', '/terms.html', '/privacy.html', '/personal-data.html',
                   '/login.html', '/signup.html', '/auth-callback.html', '/admin.html'].map(at);
      const on  = ['/index.html', '/actual-pay.html', '/deep-pay.html', '/profile.html',
                   '/pay-report.html', '/airlines/ana.html', '/airline-reviews.html'].map(at);
      return { off, on };
    }, dir);
    ok(due.off.every((x) => x === ''), '運営に連絡できる画面・規約・ログインの途中では出さない', due.off);
    ok(due.on.every((x) => x === 'show'), '★それ以外の画面では必ず出す（REAL PAY・DEEP PAY・マイページ・会社ページ…）', due.on);
    await page.close();
  }

  // ════════════════════════════════════════════════════════════
  console.log(`\n════ C) ${L} — 画像を出す ════`);
  // ════════════════════════════════════════════════════════════
  {
    const sv = newServer({ state: 'required', again: false });
    const page = await open(PLAIN, cached('required'), sv);
    await page.waitForSelector('#pvpf-back');
    /* 素材：このページ自身を PNG に撮ったもの（大きい・JPEG ではない）。 */
    const shot = join(tmp, `in-${L}.png`);
    await page.screenshot({ path: shot, type: 'png' });
    const input = await page.$('#pvpf-back input[type=file]');
    ok(await page.evaluate((e) => e.accept === 'image/*' && e.hidden, input), '選べるのは画像だけ');
    await input.uploadFile(shot);
    await page.waitForSelector('.pvpf-prev img');
    let b = await board(page);
    ok(b.buttons.includes(W.send), '選んだ画像を見せてから、送るかどうかを聞く', b.buttons);
    ok(sv.sent.length === 0, '★選んだだけでは送らない');
    ok(!SAYS_FATE.test(b.text), '★確かめる画面にも、画像の扱いを書いていない', b.text.match(SAYS_FATE));

    // 送れなかったとき
    sv.submitFail = true;
    await page.evaluate(() => document.querySelector('[data-act=send]').click());
    await page.waitForSelector('.pvpf-err');
    b = await board(page);
    ok(W.net.test(b.text) && b.buttons.includes(W.send), '送れなかったら理由を出し、同じ画像でやり直せる', b.text.slice(-60));
    sv.submitFail = false; sv.sent.length = 0;

    await page.evaluate(() => document.querySelector('[data-act=send]').click());
    await page.waitForFunction((t) => (document.querySelector('.pvpf-t') || {}).textContent === t, {}, W.doneT);
    ok(sv.sent.length === 1 && Object.keys(sv.sent[0]).join() === 'p_image_b64',
       '送るのは画像1つだけ（氏名もメールも添えない）', sv.sent.map((x) => Object.keys(x)));
    const buf = Buffer.from(sv.sent[0].p_image_b64 || '', 'base64');
    const src = readFileSync(shot);
    ok(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff, '★JPEG に焼き直してから送っている（元は PNG）', [...buf.slice(0, 3)]);
    ok(buf.length > 1000 && buf.length <= 800000, '★大きさは上限（800KB）に収まっている', buf.length);
    ok(!buf.includes('Exif') && !buf.includes('GPS') && !buf.equals(src), '★付帯情報（Exif）が付いていない・元のファイルそのままではない');
    b = await board(page);
    ok(b.title === W.doneT && !b.buttons.includes(W.pick), '受け取ったあとは「確認待ち」の画面になる', b);
    ok(!SAYS_FATE.test(b.text), '★受け取ったあとの画面にも、画像の扱いを書いていない', b.text.match(SAYS_FATE));
    ok((await proofKey(page)).s === 'submitted', '写しも「確認待ち」になる', await proofKey(page));
    ok(await page.$('#pvpf-back') !== null, '★出しただけでは板は消えない（運営が確認するまで止まったまま）');
    await page.close();
  }

  // ════════════════════════════════════════════════════════════
  console.log(`\n════ D) ${L} — 運営が承認したら自分で消える／ログアウト ════`);
  // ════════════════════════════════════════════════════════════
  {
    const sv = newServer({ state: 'none', again: false });   // 写しは「確認待ち」・サーバはもう承認済み
    sv.delay = 700;   // 開き終わる前に読み直しが始まると、開く側が「中断された」で落ちる
    const page = await open(PLAIN, cached('submitted'), sv);
    await until(page, () => {
      let s = '';
      try { s = JSON.parse(localStorage.getItem('pv_proof') || '{}').s; } catch (e) {}
      const nav = performance.getEntriesByType('navigation')[0];
      return s === 'ok' && document.readyState === 'complete' && !document.getElementById('pvpf-back')
          && nav && nav.type === 'reload';   // 承認後に読み直したページ
    });
    const after = await page.evaluate(() => ({
      inert: [...document.body.children].filter((e) => e.hasAttribute('inert')).length,
      lock: document.documentElement.classList.contains('pvpf-lock') }));
    ok(after.inert === 0 && !after.lock, '★承認されたら板が消え、ページが元どおり触れる', after);
    await page.close();
  }
  {
    const sv = newServer({ state: 'required', again: false });
    const page = await open(DEEP, cached('required'), sv);
    await page.waitForSelector('#pvpf-back');
    const b = await board(page);
    ok(b.buttons.includes(W.out), 'ログアウトのボタンが在る（閉じ込めない）', b.buttons);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      page.evaluate(() => document.querySelector('[data-act=out]').click())]);
    const left = await page.evaluate(() => ({
      path: location.pathname,
      keys: Object.keys(localStorage).filter((k) => /^sb-|^pv_user$|^pv_proof$/.test(k)),
      expired: sessionStorage.getItem('pv_expired') }));
    ok(left.path === `${dir}/index.html` || left.path === `${dir}/`, 'ログアウトするとトップへ戻る', left.path);
    ok(left.keys.length === 0, '★ログインの鍵も、止まっているという写しも端末に残さない', left.keys);
    ok(left.expired === null, '「自動的にログアウトしました」の目印は置いていかない（本人が押した）', left.expired);
    ok(sv.hits.some((h) => /\/auth\/v1\/logout/.test(h)), 'サーバ側のログインも切っている', sv.hits);
    ok(await page.$('#pvpf-back') === null, 'ログアウト後は板が出ない');
    await page.close();
  }
  {
    // スマホの幅：板が画面からはみ出さない・ボタンが見えている
    const sv = newServer({ state: 'required', again: false });
    const page = await open(PLAIN, cached('required'), sv, { width: 360, height: 640 });
    await page.waitForSelector('#pvpf-back.is-in');
    const m = await page.evaluate(() => {
      const c = document.querySelector('.pvpf-card').getBoundingClientRect();
      const g = document.querySelector('.pvpf-go').getBoundingClientRect();
      return { l: c.left, r: c.right, t: c.top, b: c.bottom, gb: g.bottom, vw: innerWidth, vh: innerHeight,
               sx: document.documentElement.scrollWidth };
    });
    ok(m.l >= 0 && m.r <= m.vw && m.t >= 0 && m.b <= m.vh && m.gb <= m.vh,
       'スマホの幅（360×640）で、板もボタンも画面に収まる', m);
    await page.close();
  }
}

// ════════════════════════════════════════════════════════════════
// E) 管理画面
// ════════════════════════════════════════════════════════════════
const U1 = '00000000-0000-4000-8000-00000000a001';   // 確認待ちの会員
const U2 = '00000000-0000-4000-8000-00000000a002';   // 普通の会員
const JPEG_B64 = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60, 0x41)]).toString('base64');

async function admin(lang, cfg) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setRequestInterception(true);
  page.on('request', (r) => (r.url().startsWith(BASE) ? r.continue() : r.abort()));
  const says = [];
  page.on('dialog', async (d) => { says.push({ type: d.type(), text: d.message() }); await d.accept(); });
  await page.evaluateOnNewDocument((cfg, U1, U2, B64) => {
    window.__rpc = []; window.__from = [];
    const USERS = [
      { id: U1, name: 'Sample Pilot', email: 'pilot@example.com', created_at: '2026-01-11T00:00:00Z' },
      { id: U2, name: 'Other Member', email: 'other@example.com', created_at: '2026-01-10T00:00:00Z' }];
    let proofs = [{ user_id: U1, state: 'submitted', required_at: '2026-02-01T00:00:00Z',
                    submitted_at: '2026-02-02T03:00:00Z', has_image: true, byte_len: 64 }];
    const RPC = {
      pv_is_admin: () => true,
      admin_list_profiles: () => USERS,
      admin_list_reviews: () => [],
      admin_list_proofs: () => proofs,
      admin_proof_require: (a) => { proofs = proofs.concat([{ user_id: a.p_user, state: 'required',
                                      required_at: '2026-02-03T00:00:00Z', has_image: false }]);
                                    return { ok: true, state: 'required', changed: true }; },
      admin_proof_image: () => ({ ok: true, mime: 'image/jpeg', b64: B64 }),
      admin_proof_approve: (a) => { proofs = proofs.map((p) => p.user_id === a.p_user
                                      ? { ...p, state: 'approved', has_image: false } : p);
                                    return { ok: true, state: 'approved', discarded: cfg.discarded }; },
      admin_proof_reject: () => ({ ok: true, state: 'required', discarded: 1 })
    };
    const FAKE = {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'ops' } } } }),
              signOut: async () => ({ error: null }) },
      from: (t) => { window.__from.push(t); return {}; },
      rpc: (n, a) => {
        window.__rpc.push([n, a || null]);
        const res = (cfg.noSql && /proof/.test(n))
          ? { data: null, error: { message: 'function does not exist' } }
          : { data: RPC[n] ? RPC[n](a || {}) : null, error: null };
        return { then: (o2, n2) => Promise.resolve(res).then(o2, n2) };
      }
    };
    Object.defineProperty(window, 'supabase',
      { value: { createClient: () => FAKE }, writable: false, configurable: false });
  }, cfg, U1, U2, JPEG_B64);
  await page.goto(BASE + (lang === 'en' ? '/en' : '') + '/admin.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('#users-tbody tr td:not([colspan])').length > 0);
  return { page, says };
}
const calls = (page) => page.evaluate(() => window.__rpc.slice());
const click = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);

for (const lang of ['ja', 'en']) {
  const W = lang === 'en'
    ? { gone: /discard/i, ask: 'Ask for proof', wait: 'Awaiting review' }
    : { gone: /破棄/, ask: '証明を求める', wait: '確認待ち' };

  console.log(`\n════ E) ${lang} — 管理画面：止める・見る・承認する ════`);
  {
    const { page, says } = await admin(lang, { discarded: 1 });
    const first = await page.evaluate(() => ({
      badge: document.getElementById('proof-n').textContent,
      cells: [...document.querySelectorAll('#users-tbody tr')].map((tr) => tr.lastElementChild.innerText.trim()),
      acts: [...document.querySelectorAll('#proofs-tbody [data-pf]')].map((b) => b.getAttribute('data-pf')) }));
    ok(first.badge === '1', '確認待ちの人数がタブに出る', first.badge);
    ok(first.cells[0] === W.wait && first.cells[1] === W.ask,
       '会員一覧：確認待ちの会員には状態、ほかの会員には「証明を求める」', first.cells);
    ok(first.acts.join() === 'view,approve,reject', '確認待ちの会員にできるのは 見る・承認・出し直し の3つ', first.acts);

    // 止める
    await click(page, `#users-tbody [data-pf=require][data-u="${U2}"]`);
    await page.waitForFunction((u) => window.__rpc.some((c) => c[0] === 'admin_proof_require')
      && document.querySelectorAll('#proofs-tbody tr').length === 2, {}, U2);
    const req = (await calls(page)).find((c) => c[0] === 'admin_proof_require');
    ok(req[1].p_user === U2 && Object.keys(req[1]).join() === 'p_user', '「証明を求める」は、その会員の id だけをサーバーへ渡す', req);
    ok(says.length === 1 && says[0].type === 'confirm' && /REAL PAY/.test(says[0].text),
       '★止める前に、何が起きるかを確かめる', says[0]);

    // 見る → 閉じる
    await click(page, `#proofs-tbody [data-pf=view][data-u="${U1}"]`);
    await page.waitForSelector('#pf-view.is-on img');
    ok(await page.evaluate(() => document.querySelector('#pf-view img').src.startsWith('data:image/jpeg;base64,/9j/')),
       '提出された画像が出る');
    await click(page, '#pf-view [data-pf=close]');
    ok(await page.evaluate(() => !document.querySelector('#pf-view img')
         && !document.getElementById('pf-view').classList.contains('is-on')),
       '★閉じたら、画像を画面に残さない');

    // 承認する
    says.length = 0;
    await click(page, `#proofs-tbody [data-pf=approve][data-u="${U1}"]`);
    await page.waitForFunction(() => window.__rpc.filter((c) => c[0] === 'admin_list_proofs').length >= 3);
    const ap = (await calls(page)).find((c) => c[0] === 'admin_proof_approve');
    ok(ap && ap[1].p_user === U1, '承認は、その会員の id だけをサーバーへ渡す', ap);
    ok(says[0] && says[0].type === 'confirm' && W.gone.test(says[0].text),
       '★承認の前に「画像はこの場で破棄される」と確かめる', says[0]);
    ok(says[1] && says[1].type === 'alert' && W.gone.test(says[1].text),
       '★サーバーが画像を消したと返したとき、「破棄しました」と言う', says[1]);
    ok(await page.evaluate(() => window.__from.length) === 0, '表を1つも直接触っていない');
    /* ★2026-10-24 career-page の合流：管理画面は街・宿の確認待ち（db/towns.sql・db/stays.sql の入口4つ）も読む。
         どれもサーバーの入口（表を直接触らない）なので、名前を名指しで足す ── 名前の無い入口は今までどおり落ちる。 */
    ok((await calls(page)).every((c) => /^(pv_is_admin|admin_|pv_town_queue$|pv_stay_(queue|applicants|members)$)/.test(c[0])), '使うのはサーバーの入口だけ', (await calls(page)).map((c) => c[0]));
    await page.close();
  }
  {
    // サーバーが「消した画像は0枚」と返したとき
    const { page, says } = await admin(lang, { discarded: 0 });
    await click(page, `#proofs-tbody [data-pf=approve][data-u="${U1}"]`);
    await page.waitForFunction(() => window.__rpc.filter((c) => c[0] === 'admin_list_proofs').length >= 2);
    const last = says[says.length - 1];
    ok(last && last.type === 'alert' && !W.gone.test(last.text),
       '★壊す証明：サーバーが消していないとき、「破棄しました」とは言わない', last);
    await page.close();
  }
  {
    // db/pilot-proof.sql をまだ貼っていない
    const { page } = await admin(lang, { noSql: true });
    const v = await page.evaluate(() => ({
      dash: getComputedStyle(document.getElementById('dashboard')).display,
      users: document.querySelectorAll('#users-tbody tr').length,
      btn: document.querySelectorAll('#users-tbody [data-pf]').length,
      note: document.getElementById('proofs-tbody').innerText }));
    ok(v.dash !== 'none' && v.users === 2, '★SQL を貼る前でも、会員の表は今までどおり出る', v);
    ok(v.btn === 0 && /pilot-proof\.sql/.test(v.note), '使えないあいだはボタンを出さず、理由を書く', v);
    await page.close();
  }
}

await browser.close();
rmSync(tmp, { recursive: true, force: true });
console.log(`\n════ ${pass} 件 通過 / ${fail} 件 失敗 ════`);
process.exit(fail ? 1 : 0);
