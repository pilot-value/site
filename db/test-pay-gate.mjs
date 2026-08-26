/* 「出したら会員になっていた」が成立し続けているかを見る。

   このサイトは 2026-08-17 から、**送信を押した瞬間にサーバへ保存**して、
   アカウントはそのあとで作ってもらう形になっている（db/pay-report-pending.sql）。
   だから次の3つが壊れると、給与データは1件も残らなくなる：
     ① 読み込んだ瞬間にログインを求めてしまう（フォームを見る前に帰る）
     ② 送信を押しても submit_pay_report_pending を呼ばない（入力が捨てられる）
     ③ 返ってきた預かり証を残さない（サーバにはあるのに本人へ渡せない）
   どれも画面を開けば分かるが、開かないと分からない。ここで毎回通す。

   ★2026-08-22 追加。本番を調べたら**登録まで済ませたのにデータが消えた人が2人**いた
     （8/21 シンガポール航空2件・8/18 ANA と ZIPAIR）。原因はひとつで、預かり証は
     **提出したブラウザの localStorage にしかない**のに、ログイン用メールのリンクを押すと
     メールアプリの中の別のブラウザが開く。3枚重ねで塞いだので、3枚とも毎回見る：
       経路1 同じブラウザ           … 預かり証がそのまま効く（③と④）
       経路2 ?claim= で別のブラウザ  … 戻り先URLに載せた1枚を拾う（⑥）
       経路3 マイページ             … どの入口から入っても最後に必ず通る（⑦）
     入口の形（押せるもの2つ・入力欄1つ）と、6桁を貼ると押さずに進むことも見る。
     ここが2ブロック5ボタンに戻ると、消えた人が見ていた画面へ逆戻りする。

   ★2026-08-22 追加その2。メールからリンクを外したのは **Supabase ダッシュボードの設定**で、
     リポジトリからは見えない。だから崩れたことにも気づけない。こちら側から2つ守る（末尾）：
       ⑧ サイトの言葉  … 日英4ページ＋pay-login.js が「リンクを送る／開く」と言っていないこと。
                        言ったままだと**サイトの説明が嘘になる**。あわせて、貼る元の原本
                        mail-bot/auth-emails/signin-code.html にリンクが戻っていないことも見る。
       ⑨ 英語版の戻り先 … en/login.html から素でログインした人が /en/ に着くこと。
                        既定が 'profile.html' だと、ルートの auth-callback が
                        **日本語のマイページ**に落としていた（同日修正）。

   ついでに計測も見る。この経路に計測が無かった間、明細の読み取り17回に対して
   保存0件という数字の理由が「詰まった」のか「出す気が無かった」のか
   誰にも答えられなかった。イベントが消えたら黙って同じ状態に戻る。

   ★GA へは実際に送らない（googletagmanager を落として dataLayer だけ読む）。
   ★★本番の DB にも本番の認証にも1回も触らない。Supabase 宛ての通信は
     **全部ここで横取りする**（localhost のページが見ている Supabase は本番なので、
     素通しにすると置き場にゴミが溜まり、OTP メールも実際に飛ぶ）。
     横取りした本文もそのまま検査する＝「何を送っているか」までここで見える。

   実行: node serve.mjs を上げてから node db/test-pay-gate.mjs */
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASE = 'http://localhost:3000';
const b = await puppeteer.launch({ headless: 'shell' });
let fail = 0;
const ok = (c, m, got) => { c ? console.log(`  ✅ ${m}`) : (fail++, console.log(`  ❌ ${m} → ${JSON.stringify(got)}`)); };

const FAKE_TOKEN = 'a'.repeat(48);   // サーバが返す形（24バイトの hex）に合わせる
const URL_TOKEN  = 'b'.repeat(48);   // 別のブラウザに着地した人が URL で持ってくる1枚
const SB_HOST    = /vzgmnkrggrwtsrpqndsm\.supabase\.co/;
const FAKE_UID   = '00000000-0000-0000-0000-000000000001';

/* ログイン済みの人を、本番の認証に1回も触らずに作る。
   supabase-js は localStorage の sb-<ref>-auth-token を読むだけで、access_token の
   中身は自分では確かめない（署名を見るのはサーバ側）。ここは全部横取りしてある。 */
function installFakeSession(uid) {
  const b64 = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: uid, aud: 'authenticated', role: 'authenticated',
    email: 'someone@example.invalid', app_metadata: {}, user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const at = b64({ alg: 'HS256', typ: 'JWT' }) + '.'
    + b64({ sub: uid, aud: 'authenticated', role: 'authenticated', exp: now + 3600, iat: now, email: user.email })
    + '.not-a-real-signature';
  localStorage.setItem('sb-vzgmnkrggrwtsrpqndsm-auth-token', JSON.stringify({
    access_token: at, token_type: 'bearer', expires_in: 3600,
    expires_at: now + 3600, refresh_token: 'fake', user,
  }));
}

for (const [dir, tag] of [['', '(日本語)'], ['/en', '/en']]) {
  const p = await b.newPage();
  await p.setViewport({ width: 1100, height: 900 });
  await p.setRequestInterception(true);

  /* Supabase 宛ては1本残らずここで受ける。
     ★CORS の見出しを必ず付ける。付けないとブラウザが答えを捨てて、ページ側からは
       「通信が落ちた」に見える（実際これで pay_report_error だけが立った）。
       別オリジンなので OPTIONS の下見も飛んでくる。これも同じ見出しで返す。 */
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'POST, GET, PATCH, OPTIONS',
  };
  const stashed = [];      // submit_pay_report_pending へ送った本文
  const claimed = [];      // claim_pending_report へ送った本文
  const otpSent = [];      // signInWithOtp の宛先URL（戻り先が載っている）
  let verifyCalls = 0;     // verifyOtp を呼んだ回数
  let claimReply = { ok: false, reason: 'blocked_by_test' };

  p.on('request', (r) => {
    const u = r.url();
    if (/googletagmanager|google-analytics/.test(u)) return r.abort();
    if (!SB_HOST.test(u)) return r.continue();
    if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: CORS, body: '' });
    const json = (o, status = 200) =>
      r.respond({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(o) });

    if (/\/rest\/v1\/rpc\/submit_pay_report_pending\b/.test(u)) {
      stashed.push(r.postData() || '');
      return json({ ok: true, claim_token: FAKE_TOKEN, id: '00000000-0000-0000-0000-000000000000' });
    }
    if (/\/rest\/v1\/rpc\/claim_pending_report\b/.test(u)) {
      claimed.push(r.postData() || '');
      return json(claimReply);
    }
    // 本送信は預かり分の紐付けで置き換わったはず。万一呼ばれても本番へは通さない
    if (/\/rest\/v1\/rpc\/submit_pay_report\b/.test(u)) return json({ ok: false, reason: 'blocked_by_test' });
    // ★メールを実際に飛ばさない。宛先URLだけ控える（戻り先に預かり証が載っているか見る）
    if (/\/auth\/v1\/otp\b/.test(u)) { otpSent.push(u); return json({}); }
    if (/\/auth\/v1\/verify\b/.test(u)) {
      verifyCalls++;
      return json({ error: 'invalid_grant', error_description: 'blocked_by_test' }, 400);
    }
    if (/\/auth\/v1\/user\b/.test(u)) {
      return json({ id: FAKE_UID, aud: 'authenticated', role: 'authenticated', email: 'someone@example.invalid', app_metadata: {}, user_metadata: {} });
    }
    if (/\/rest\/v1\//.test(u)) return json([]);   // profiles / reviews / 解放判定
    return json({}, 400);                          // 残りの認証は1本も通さない
  });

  await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
  await p.evaluate(() => { localStorage.clear(); });
  await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });

  console.log(`\n${tag} pay-report.html を未ログインで通す\n`);

  // 1) フォームがログイン壁なしで触れること
  await p.click('#entry-manual');
  const reachable = await p.evaluate(() => {
    const g = document.getElementById('login-gate');
    const f = document.getElementById('f-airline');
    return { gateHidden: !g || getComputedStyle(g).display === 'none', formThere: !!f && !f.disabled };
  });
  ok(reachable.gateHidden && reachable.formThere, '読み込み直後はログイン壁が出ず、フォームが触れる', reachable);

  /* 1-b) 押す前に「アカウントを作らなくても出せる」と分かること。
         ここが元の文言のままだと、押すまで登録が要ると思われる。 */
  const label = await p.evaluate(() => (document.getElementById('submit-btn').textContent || '').trim());
  ok(/匿名で提出|Submit anonymously/.test(label), '未ログインの送信ボタンが「匿名で提出する」になっている', label);

  // 2) 必須欄を埋めて送信 → その場でサーバへ預かる
  const err = await p.evaluate(async () => {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const firstOpt = (id) => {
      const s = document.getElementById(id);
      const o = [...s.options].find((x) => x.value && x.value !== 'other');
      return o ? o.value : '';
    };
    set('f-airline', firstOpt('f-airline'));
    set('f-position', firstOpt('f-position'));
    set('f-fleet', firstOpt('f-fleet'));
    /* ★役職・区分は 2026-08-26 からチェックボックス群（値は hidden の #f-jobrole）。
       絵の側を押して、ページの sync に hidden を書かせる。 */
    const role = document.querySelector('input[name="f-jobrole"]');
    if (role) { role.checked = true; role.dispatchEvent(new Event('change', { bubbles: true })); }
    set('f-age', firstOpt('f-age'));
    set('f-currency', firstOpt('f-currency'));
    set('f-housing', firstOpt('f-housing'));
    set('f-contract', firstOpt('f-contract'));
    set('f-taxcountry', firstOpt('f-taxcountry'));
    ['f-block', 'f-stay', 'f-bonus-mo', 'f-perdiem', 'f-seniority'].forEach((id) => set(id, '0'));
    set('f-gross', '1080000');
    set('f-netpay', '842000');
    document.getElementById('submit-btn').click();
    await new Promise((r) => setTimeout(r, 800));
    const e = document.querySelector('.err, #err, [id*="err"]');
    return e && e.offsetParent ? (e.textContent || '').trim().slice(0, 90) : '';
  });
  if (err) console.log(`     （バリデーションで止まった: ${err}）`);
  await new Promise((r) => setTimeout(r, 600));

  ok(stashed.length === 1, '送信を押すと submit_pay_report_pending を1回だけ呼ぶ', stashed.length);
  /* 何を送っているか。会社と対象月が入っていて、メールアドレスは入っていない。 */
  let body = null;
  try { body = JSON.parse(stashed[0] || '{}').p; } catch (e) {}
  ok(!!(body && body.airline && body.period_year && body.period_month && body.currency),
    '預ける中身に会社・対象月・通貨が入っている', body && Object.keys(body).length);
  ok(!/@/.test(JSON.stringify(body || {})), '預ける中身にメールアドレスが混ざっていない', body);

  const gate = await p.evaluate(() => {
    const g = document.getElementById('login-gate');
    const ev = (window.dataLayer || []).filter((a) => a[0] === 'event').map((a) => a[1]);
    let claims = [];
    try { claims = JSON.parse(localStorage.getItem('pv_pay_claim') || '[]'); } catch (e) {}
    return {
      shown: g && getComputedStyle(g).display !== 'none',
      ev,
      hasBox: !!document.getElementById('pl-up-btn'),
      title: (document.getElementById('pl-title') || {}).textContent || '',
      claims,
    };
  });
  ok(gate.shown && gate.hasBox, '預かったあと、ページ内に登録の箱が出る', { shown: gate.shown, hasBox: gate.hasBox });
  ok(/受け取りました|We have your pay data/.test(gate.title), '見出しが「受け取りました」になっている', gate.title);
  ok(gate.claims.length === 1 && gate.claims[0].t === FAKE_TOKEN, '預かり証を端末に残している', gate.claims);
  ok(gate.ev.includes('pay_report_pending'), 'pay_report_pending が出ている', gate.ev);
  ok(gate.ev.includes('pay_login_shown'), 'pay_login_shown が出ている', gate.ev);

  /* 2-b) 入口の形。2026-08-22 まで「はじめての方」「お持ちの方」の2ブロックで、
          押せるものが5つ・入力欄が3つあった。ここに戻すと、どちらを選ぶかで迷わせる。
          signInWithOtp({shouldCreateUser:true}) は新規も既存も同じ1本を通るので分ける意味が無い。 */
  const shape = await p.evaluate(() => {
    const main = document.getElementById('pl-main');
    const outside = (sel) => [...main.querySelectorAll(sel)].filter((el) => !el.closest('details'));
    const pass = document.querySelector('.pl-pass');
    return {
      buttons: outside('button').map((el) => el.id),
      inputs: outside('input:not([type=checkbox])').map((el) => el.id),
      passFolded: !!pass && !pass.open,
      passInside: !!document.getElementById('pl-in-btn'),
    };
  });
  ok(shape.buttons.length === 2 && shape.inputs.length === 1,
    '入口は1つ（押せるもの2つ・入力欄1つ）', shape);
  ok(shape.passFolded && shape.passInside,
    'パスワードは折りたたみの中にあり、既定では閉じている', shape);

  /* 2-c) 受け取った中身を1行返す。★金額は1文字も出さない（Give to Get の壁）。
          ここが無いと届いたか分からず、同じ人が同じ内容をもう一度送る
          （2026-08-21 20:11 と 20:17 に実際に起きた）。 */
  const recap = await p.evaluate(() => {
    const el = document.getElementById('pl-recap');
    const s = document.getElementById('f-airline');
    return {
      text: el ? (el.textContent || '').trim() : '',
      shown: !!el && getComputedStyle(el).display !== 'none',
      airline: s && s.selectedOptions[0] ? s.selectedOptions[0].textContent.trim() : '',
    };
  });
  ok(recap.shown && recap.text.length > 0 && recap.text.includes(recap.airline),
    '受け取った中身を1行返している（会社名が入っている）', recap);
  ok(!/\d{5,}|[¥$€£]|万|円|,\d{3}/.test(recap.text), 'その1行に金額が出ていない', recap.text);

  // 3) 入口の計測。宛先が壊れているとメールの手前で止まる
  await p.type('#pl-up-mail', 'not-an-email');
  await p.click('#pl-up-btn');
  await new Promise((r) => setTimeout(r, 400));
  const ev = await p.evaluate(() => (window.dataLayer || [])
    .filter((a) => a[0] === 'event')
    .map((a) => [a[1], JSON.stringify(a[2] || {})].join(' ')));
  ok(ev.some((x) => x.startsWith('pay_login_start') && x.includes('code')), 'pay_login_start{code} が出ている', ev);
  ok(ev.some((x) => x.startsWith('pay_login_code_fail') && x.includes('bad_email')), 'pay_login_code_fail{bad_email} が出ている', ev);
  const leaks = await p.evaluate(() => (window.dataLayer || [])
    .filter((a) => a[0] === 'event' && /^pay_(login|report)_/.test(a[1]))
    .filter((a) => JSON.stringify(a[2] || {}).match(/@|[0-9]{4,}/)));
  ok(leaks.length === 0, '計測にメールアドレスも金額も混ざっていない', leaks);

  /* 3-b) コードを送る → 6桁の段。メールは横取りしてあるので実際には飛ばない。
          ★戻り先URLに預かり証が載っていること＝別のブラウザに着地しても持って行ける。
          ★案内文にリンクの話が残っていないこと（メールからリンクを外したので嘘になる）。
          ★6桁そろったら押さずに進むこと。全角のまま貼っても効くこと（\D は全角数字を
            丸ごと落とすので、寄せ忘れると欄が黙って空になる）。 */
  await p.evaluate(() => { document.getElementById('pl-up-mail').value = 'someone@example.invalid'; });
  await p.click('#pl-up-btn');
  await new Promise((r) => setTimeout(r, 500));

  const back2 = (() => { try { return decodeURIComponent(decodeURIComponent(otpSent[0] || '')); } catch (e) { return otpSent[0] || ''; } })();
  ok(otpSent.length === 1 && back2.includes('claim=' + FAKE_TOKEN),
    'メールの戻り先URLに預かり証が載っている（別のブラウザでも拾える）', back2.slice(-120));

  const step = await p.evaluate(() => ({
    shown: getComputedStyle(document.getElementById('pl-code-step')).display !== 'none',
    note: (document.getElementById('pl-code-note') || {}).textContent || '',
  }));
  ok(step.shown, 'コードを送ると6桁の段に進む', step.shown);
  ok(step.shown && !/リンク|\blink\b/i.test(step.note), '案内文にリンクの話が残っていない', step.note);

  await p.evaluate(() => {
    const el = document.getElementById('pl-code');
    el.value = '１２３４５６';                                   // 全角のまま貼った人
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 600));
  const typed = await p.evaluate(() => ({
    value: document.getElementById('pl-code').value,
    ev: (window.dataLayer || []).filter((a) => a[0] === 'event').map((a) => [a[1], JSON.stringify(a[2] || {})].join(' ')),
  }));
  ok(typed.value === '123456', '全角で貼った6桁が半角に寄る（欄が空にならない）', typed.value);
  ok(verifyCalls === 1, '6桁そろうと押さずに確認へ進む', verifyCalls);
  ok(typed.ev.some((x) => x.startsWith('pay_login_code_fail') && x.includes('wrong_code')),
    '間違ったコードは pay_login_code_fail{wrong_code} になる', typed.ev.slice(-3));

  /* 4) 登録せずに戻ってきた人。もう保存は済んでいるので、入力が残るだけでなく
        「受け取りました」の状態のまま登録の箱へ戻ること。
        Google を途中でやめた人・別のアカウントを選んだ人・戻り先が別のサイトに
        なった人（localhost で Google を押すと戻り先が本番になるので必ずこうなる）は、
        以前ここで入力を丸ごと失って入口の2択に戻されていた。 */
  await p.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 900));
  const back = await p.evaluate(() => ({
    entryHidden: document.getElementById('entry').hidden,
    gross: document.getElementById('f-gross').value,
    kept: !!localStorage.getItem('pv_pay_pending'),
    claims: (() => { try { return JSON.parse(localStorage.getItem('pv_pay_claim') || '[]').length; } catch (e) { return -1; } })(),
    gateShown: getComputedStyle(document.getElementById('login-gate')).display !== 'none',
    title: (document.getElementById('pl-title') || {}).textContent || '',
  }));
  ok(back.entryHidden && back.gross !== '', 'ログインせずに戻っても入力が残り、入口の2択に戻されない', back);
  ok(back.kept, '預けた下書きを消していない', back);
  ok(back.claims === 1, '預かり証も消していない（登録できるまで持ち続ける）', back);
  ok(back.gateShown && /受け取りました|We have your pay data/.test(back.title),
    '戻ってきたら「受け取りました」の箱がそのまま出る（もう一度送らせない）', back);
  ok(stashed.length === 1, '戻ってきただけで二重に預けない', stashed.length);
  ok(claimed.length === 0, '未ログインのあいだは紐付けを呼ばない', claimed.length);

  /* 5) 預かり証が無いときは、古すぎる下書きを持たない。
        （預かり証があるあいだは下書きも捨てない＝4で見ている） */
  await p.evaluate(() => {
    localStorage.removeItem('pv_pay_claim');
    const o = JSON.parse(localStorage.getItem('pv_pay_pending') || '{}');
    o._ts = Date.now() - 30 * 24 * 60 * 60 * 1000;
    localStorage.setItem('pv_pay_pending', JSON.stringify(o));
  });
  await p.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 700));
  const stale = await p.evaluate(() => ({
    entryShown: !document.getElementById('entry').hidden,
    gone: !localStorage.getItem('pv_pay_pending'),
  }));
  ok(stale.entryShown && stale.gone, '2週間より古い下書きは捨てる（預かり証が無いとき）', stale);

  /* ── 経路2：別のブラウザに着地した人（?claim=） ─────────────────
     メールのリンクを押した人・Google の往復で環境が変わった人は、端末に預かり証を
     持っていない。戻り先URLに載せた1枚がその人にとって唯一の綱になる。 */
  console.log(`\n${tag} 経路2：?claim= で別のブラウザに着地する\n`);
  await p.evaluate(() => { localStorage.clear(); });
  await p.goto(`${BASE}${dir}/pay-report.html?claim=${URL_TOKEN}`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));
  const arrived = await p.evaluate(() => ({
    search: location.search,
    claims: (() => { try { return JSON.parse(localStorage.getItem('pv_pay_claim') || '[]').map((x) => x.t); } catch (e) { return []; } })(),
  }));
  ok(arrived.claims.length === 1 && arrived.claims[0] === URL_TOKEN, 'URL の預かり証を端末に取り込む', arrived);
  ok(!/claim=/.test(arrived.search), 'アドレスバーから claim= を消している', arrived.search);

  await p.goto(`${BASE}${dir}/pay-report.html?claim=${URL_TOKEN}`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 400));
  const twice = await p.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('pv_pay_claim') || '[]').length; } catch (e) { return -1; }
  });
  ok(twice === 1, '同じ URL をもう一度開いても増えない', twice);

  // ログインが済んだ状態で着地すると、その1枚がそのまま本人のものになる
  claimReply = { ok: true, id: '00000000-0000-0000-0000-000000000002', payload: {} };
  claimed.length = 0;
  await p.evaluate(installFakeSession, FAKE_UID);
  await p.goto(`${BASE}${dir}/pay-report.html?claim=${URL_TOKEN}`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));
  const landed = await p.evaluate(() => ({
    claims: (() => { try { return JSON.parse(localStorage.getItem('pv_pay_claim') || '[]').length; } catch (e) { return -1; } })(),
  }));
  ok(claimed.some((x) => (x || '').includes(URL_TOKEN)), 'ログイン済みで着地すると URL の1枚を紐付けに出す', claimed.length);
  ok(landed.claims === 0, '紐付けが通った預かり証は端末から消す', landed);

  /* ── 経路3：マイページ（最後の網） ───────────────────────────
     login.html / signup.html から入った人は pay-report.html を通らずにここへ着く。
     ここでも拾えるので、同じブラウザでどこからログインしても必ず紐付く。 */
  console.log(`\n${tag} 経路3：マイページで拾う（最後の網）\n`);
  claimed.length = 0;
  await p.evaluate((tok) => {
    localStorage.setItem('pv_pay_claim', JSON.stringify([{ t: tok, ts: Date.now() }]));
  }, URL_TOKEN);
  await p.goto(`${BASE}${dir}/profile.html`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  const mine = await p.evaluate(() => ({
    here: /profile\.html$/.test(location.pathname),
    note: (() => { const n = document.getElementById('claim-note'); return n ? getComputedStyle(n).display : 'missing'; })(),
    claims: (() => { try { return JSON.parse(localStorage.getItem('pv_pay_claim') || '[]').length; } catch (e) { return -1; } })(),
  }));
  ok(mine.here && claimed.some((x) => (x || '').includes(URL_TOKEN)), 'マイページでも預かり証を紐付けに出す', mine);
  ok(mine.note === 'block', '拾えたことを1行だけ知らせる', mine.note);
  ok(mine.claims === 0, '紐付けが通った預かり証は端末から消す（マイページ）', mine);

  claimReply = { ok: false, reason: 'blocked_by_test' };
  await p.close();
}

/* ⑧ サイトの言葉：「リンクを送ります／リンクを開いてください」と言っていないこと。
      ★コメントは落としてから見る。コメントには「なぜリンクを消したのか」を
        わざと書き残してあるので、素で探すと必ず引っかかって役に立たない。 */
console.log('\n(共通) メールにリンクが無い前提と、サイトの言葉が食い違っていないか\n');
{
  const strip = (t) => t
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const PROMISE = /リンク|login link|sign-in link|link and a \d-digit|open the link/i;
  for (const f of ['login.html', 'signup.html', 'en/login.html', 'en/signup.html', 'pay-login.js']) {
    const m = strip(readFileSync(ROOT + f, 'utf8')).match(PROMISE);
    ok(!m, `${f} が「メールのリンク」を案内していない`, m && m[0]);
  }
  // 逆向きにも見る。文言ごと消えて何も案内しなくなっていたら、それはそれで詰む
  for (const [f, re] of [
    ['login.html', /6桁のログインコード/], ['signup.html', /6桁のログインコード/],
    ['en/login.html', /6-digit sign-in code/], ['en/signup.html', /6-digit sign-in code/],
  ]) ok(re.test(readFileSync(ROOT + f, 'utf8')), `${f} が「6桁のコードを送る」と言っている`, f);

  /* 6桁の欄が全角を半角へ寄せていること。日本語のメールから貼ると全角で来るので、
     ここが素の \\D 落としだけだと**欄が空になる**。貼った人には「効かない」としか見えない。 */
  for (const f of ['login.html', 'signup.html', 'en/login.html', 'en/signup.html', 'pay-login.js']) {
    const t = readFileSync(ROOT + f, 'utf8');
    ok(/[\uFF10-\uFF19]-\u3000?|0xFEE0/.test(t), `${f} が全角の6桁を半角に寄せる`, f);
  }

  /* メール本文の原本。ダッシュボードの中身はここからは見えないので、
     せめて**貼る元**にリンクが書き戻されていないことだけは毎回見る。
     2026-08-22 まで本文に「このままログイン / Log in」のボタンが入っていて、
     押した人のブラウザが入れ替わり、預かり証ごと給与データが4件消えた。 */
  const MAIL = readFileSync(ROOT + 'mail-bot/auth-emails/signin-code.html', 'utf8');
  ok(!/ConfirmationURL/.test(MAIL), 'メール本文の原本にログインリンクが無い', 'ConfirmationURL');
  ok((MAIL.match(/\{\{\s*\.Token\s*\}\}/g) || []).length === 1, 'メール本文の原本に6桁のコードが1つ入っている');
  /* 期限は日英に1つずつ書いてある。片方だけ直すと**どちらかが嘘になる**。
     実際の値（Sign In / Providers → Email → Email OTP expiration）はここからは読めないので、
     数字そのものは固定せず、日英が食い違っていないことだけを見る。 */
  const ja = (MAIL.match(/(\d+)\s*分で無効/) || [])[1];
  const en = (MAIL.match(/expires in (\d+) minutes/) || [])[1];
  ok(ja && en && ja === en, 'メール本文の原本で有効期限の数字が日英で一致する', { ja, en });
}

/* ⑨ 英語版の戻り先：?next= を付けずに en/login.html から入った人が /en/ に着くこと。
      ここは既定が 'profile.html' で、しかも「既定のときだけ next を付けない」分岐が
      あったため、ルートの auth-callback.html が /profile.html＝日本語版へ落としていた。
      静的に読むと分岐を戻されたときに気づけないので、実際に押して宛先URLを見る。 */
console.log('\n/en ?next= 無しでログインした人が英語版に着くか\n');
{
  const p = await b.newPage();
  await p.setRequestInterception(true);
  const otpSent = [], authSent = [];
  p.on('request', (r) => {
    const u = r.url();
    if (/googletagmanager|google-analytics/.test(u)) return r.abort();
    if (!SB_HOST.test(u)) return r.continue();
    const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
    if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: H, body: '' });
    if (/\/auth\/v1\/otp\b/.test(u)) otpSent.push(u);
    if (/\/auth\/v1\/authorize\b/.test(u)) authSent.push(u);
    return r.respond({ status: 200, headers: H, contentType: 'application/json', body: '{}' });
  });

  // 二重に包まれている（otp?redirect_to=…auth-callback.html?next=…）ので2回ほどく
  const unwrap = (u) => { let t = u; for (let i = 0; i < 3; i++) t = decodeURIComponent(t); return t; };
  const landsInEn = (list) => {
    const t = unwrap(list[list.length - 1] || '');
    const m = t.match(/next=([^&]+)/);
    return m ? m[1].startsWith('/en/') : false;
  };

  await p.goto(`${BASE}/en/login.html`, { waitUntil: 'networkidle0' });
  await p.evaluate(() => { localStorage.clear(); });
  await p.goto(`${BASE}/en/login.html`, { waitUntil: 'networkidle0' });

  await p.evaluate(() => {
    showEmailStep();
    const el = document.getElementById('otp-email');
    el.value = 'someone@example.invalid';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await p.click('#otp-send-btn');
  await new Promise((rs) => setTimeout(rs, 1200));
  ok(otpSent.length === 1, 'コードを送るを押すとメールが1通だけ出る', otpSent.length);
  ok(landsInEn(otpSent), 'メールの戻り先が /en/ の中を指す（日本語版に落とさない）', unwrap(otpSent[0] || ''));

  await p.evaluate(() => { handleGoogle(); }).catch(() => {});
  await new Promise((rs) => setTimeout(rs, 1200));
  ok(landsInEn(authSent), 'Google の戻り先も /en/ の中を指す', unwrap(authSent[0] || ''));

  await p.close();
}

await b.close();
console.log(fail ? `\n${fail} fail\n` : '\n全部通った\n');
process.exit(fail ? 1 : 0);
