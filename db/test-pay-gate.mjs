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

/* 必須欄を全部埋めて、ウィザードを 5/5（送信ボタンのある段）まで歩かせる。
   ★2026-09-09、ここを関数にした。①の再現（pay-login.js を落とした回）でも
     まったく同じ埋め方をしないと、比べているものがずれる。
   ★1枚もの形態（共有 JS が落ちた形）には PVPayWizard が居ないので何もしない
     ── 同じ台本が両方で走る。 */
async function fillForm() {
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
    /* ★ウィザードでは送信ボタンは 5/5 の中にしか無い。歩かずに押さない。
       1枚もの形態（共有 JS が落ちた形）には PVPayWizard が居ないので何もしない
       ── 同じ台本が両方で走る。 */
    if (window.PVPayWizard) window.PVPayWizard.goLast();
    await new Promise((r) => setTimeout(r, 700));
}

for (const [dir, tag] of [['', '(日本語)'], ['/en', '/en']]) {
  const p = await b.newPage();
  await p.setViewport({ width: 1100, height: 900 });
  /* ★紙吹雪は数えるだけの偽物に差し替える（本物の confetti.js は下で落とす）。
     2026-09-09 に鳴る場所を「預かった瞬間」から「登録が済んだ結果カード」へ
     移した。ここで見たいのは絵ではなく **いつ鳴ったか** なので数だけ持つ。
     ★数はページを読み込むたびに 0 に戻る（毎回この台本が走り直すため）。 */
  await p.evaluateOnNewDocument(() => {
    window.__pop = 0;
    window.__badge = 0;
    window.PVConfetti = function () { window.__pop++; };
    window.PVConfetti.badge = function () { window.__badge++; };
  });
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
  let blockPayLogin = false;   // ①の再現。登録の箱を描く1枚だけ届かせない
  let stashFail = false;       // 預けそこねの再現。預かり証を返さない

  p.on('request', (r) => {
    const u = r.url();
    if (/googletagmanager|google-analytics/.test(u)) return r.abort();
    /* 本物の紙吹雪は落とす。落とさないと上で入れた偽物を上書きしてしまう
       （confetti.js は window.PVConfetti = function … と素で代入する）。 */
    if (/\/confetti\.js/.test(u)) return r.abort();
    /* ★①の再現。pay-login.js はページのいちばん最後に読み込まれる1枚で、
       これだけ届かないと登録の箱が高さ34pxの空枠になる（押せるものが0個）。
       細い電波・機内 Wi-Fi・広告ブロッカーで実際に起きうる形。 */
    if (blockPayLogin && /\/pay-login\.js/.test(u)) return r.abort();
    if (!SB_HOST.test(u)) return r.continue();
    if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: CORS, body: '' });
    const json = (o, status = 200) =>
      r.respond({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(o) });

    if (/\/rest\/v1\/rpc\/submit_pay_report_pending\b/.test(u)) {
      stashed.push(r.postData() || '');
      /* ★預けそこねの再現。ok:false を返すと画面は showGate(false) に落ちる
         （通信が切れた・上限に当たった回と同じ枝）。 */
      if (stashFail) return json({ ok: false, reason: 'blocked_by_test' });
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
    return { gateHidden: !g || !g.offsetParent, formThere: !!f && !f.disabled };
  });
  ok(reachable.gateHidden && reachable.formThere, '読み込み直後はログイン壁が出ず、フォームが触れる', reachable);

  /* 1-b) 押す前に「アカウントを作らなくても出せる」と分かること。
         ★見るのは 2) の中（5/5 まで歩いて**ボタンが見えた**時点）。
           ここで textContent だけ読むと、ボタンが1ピクセルも見えていなくても
           文言が合っているというだけで緑になる。 */

  // 2) 必須欄を埋めて送信 → その場でサーバへ預かる
  await p.evaluate(fillForm);
  /* ★可視は offsetParent で見る。getComputedStyle().display は
     **祖先が消えていても自分の block を返す**ので、箱が1ピクセルも見えないまま
     「出ている」と言えてしまう。 */
  const reach = await p.evaluate(() => {
    const b = document.getElementById('submit-btn');
    return { btn: !!(b && b.offsetParent), step: window.PVPayWizard ? window.PVPayWizard.current() : null,
             label: ((b || {}).textContent || '').trim() };
  });
  ok(reach.btn, '★最後まで埋めると、送信ボタンに本当に手が届く（見えている）', reach);
  ok(/匿名で提出|Submit anonymously/.test(reach.label),
     '★手が届いた時点でも「匿名で提出する」と書いてある', reach.label);
  const err = await p.evaluate(async () => {
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
      /* ★祖先ごと消えていないかまで見る（display だけだと #s5 が閉じていても通る）。 */
      shown: !!(g && g.offsetParent),
      ev,
      hasBox: !!document.getElementById('pl-up-btn'),
      title: (document.getElementById('pl-title') || {}).textContent || '',
      /* ★見出しの「字」ではなく、箱が持つ印を見る（2026-09-09）。
         文言は変わる（「受け取りました ✓」→「あと1ステップ」）が、
         **保存済みの側の箱かどうか**という状態は変わらない。
         字で見ていると、言い回しを直すたびにここが赤くなる。 */
      saved: (document.getElementById('pay-login') || {}).getAttribute
        ? document.getElementById('pay-login').getAttribute('data-saved') : null,
      pop: window.__pop, badge: window.__badge,
      claims,
    };
  });
  ok(gate.shown && gate.hasBox, '預かったあと、ページ内に登録の箱が出る', { shown: gate.shown, hasBox: gate.hasBox });
  ok(gate.saved === '1', '保存済みの側の箱が描かれている（data-saved="1"）', { saved: gate.saved, title: gate.title });
  /* ★2026-09-09。ここで鳴らすのをやめた。
     ✓ と紙吹雪でこの画面が終点に見え、8/22 以降 19人中4人が預けたまま
     登録に来なかった（引き取りは全件 0〜5分。その場で登録しない人は戻らない）。
     祝いは会員登録が済んだ結果カードの1か所だけにした（下の 経路2 で見る）。 */
  ok(gate.pop === 0, '★預かっただけでは紙吹雪を鳴らさない（ここを終点に見せない）', gate.pop);
  ok(gate.badge === 0, '★預かった箱に 🎉 バッジを付けない', gate.badge);
  ok(gate.claims.length === 1 && gate.claims[0].t === FAKE_TOKEN, '預かり証を端末に残している', gate.claims);
  ok(gate.ev.includes('pay_report_pending'), 'pay_report_pending が出ている', gate.ev);
  ok(gate.ev.includes('pay_login_shown'), 'pay_login_shown が出ている', gate.ev);

  /* 2-a) 提出が済んだ画面になっていること（2026-09-10）。
          ここまで「ステップ 5/5　確認」「公開イメージ」「戻る」「匿名で提出する」が
          そのまま残っていた。もう一度押しても同じ会社・同じ月は弾かれる（findKey）ので、
          **押しても何も起きない＝壊れて見える**。オーナーが実物を見て
          「これは提出できていないのでは」と読み違えた。
          ★可視は offsetParent。hidden を外し忘れても display だけなら通ってしまうし、
            .wz-nav は display:flex、提出の行は Tailwind の .flex を持っていて
            [hidden] より強い＝hidden を立てただけでは消えない。
          ★#submit-btn そのものは DOM に残す（隠すだけ）。SUBMIT_BTNS() が掴んでいる。 */
  const screen = await p.evaluate(() => {
    const v = (id) => { const el = document.getElementById(id); return !!(el && el.offsetParent); };
    const s5 = document.getElementById('s5');
    const nav = s5 ? s5.querySelector('.wz-nav') : null;
    const head = s5 ? s5.querySelector('.sec-head') : null;
    return { actions: v('submit-actions'), note: v('submit-note'), top: v('wz-top'),
             review: v('wz-review'), nav: !!(nav && nav.offsetParent), done: v('gate-done'),
             head: !!(head && head.offsetParent), draft: v('wz-draft'),
             btnInDom: !!document.getElementById('submit-btn'),
             total: v('live-hint') || !!document.querySelector('.sal-total') };
  });
  ok(!screen.actions, '★預かったあと「匿名で提出する」の行を残さない（押しても何も起きないボタン）', screen);
  ok(!screen.top && !screen.review && !screen.nav && !screen.head,
    '★預かったあと「ステップ 5/5 確認」「5. 確認」「公開イメージ」「戻る」を残さない', screen);
  /* ★「このブラウザに下書きを保存しました」はもう嘘（サーバに預けてある）。
     隣の「下書きを消す」を押させる場面でもない。 */
  ok(!screen.draft, '★預かったあと「下書きを保存しました／下書きを消す」を残さない', screen);
  ok(screen.done, '★預かったことが画面に1行出ている（#gate-done）', screen);
  ok(screen.btnInDom, '（前提）提出ボタンは隠すだけで DOM からは消さない', screen.btnInDom);

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
    gateShown: !!document.getElementById('login-gate').offsetParent,
    title: (document.getElementById('pl-title') || {}).textContent || '',
    saved: (document.getElementById('pay-login') || {}).getAttribute
      ? document.getElementById('pay-login').getAttribute('data-saved') : null,
    /* ★戻ってきた人も showGate(true) を通る（読み込み時の②の枝）。
       押した直後の道だけ直っていて、こちらが元のままという状態を作らせない。 */
    actions: (() => { const el = document.getElementById('submit-actions'); return !!(el && el.offsetParent); })(),
    done: (() => { const el = document.getElementById('gate-done'); return !!(el && el.offsetParent); })(),
  }));
  ok(back.entryHidden && back.gross !== '', 'ログインせずに戻っても入力が残り、入口の2択に戻されない', back);
  ok(back.kept, '預けた下書きを消していない', back);
  ok(back.claims === 1, '預かり証も消していない（登録できるまで持ち続ける）', back);
  ok(back.gateShown && back.saved === '1',
    '戻ってきたら保存済みの側の箱がそのまま出る（もう一度送らせない）', back);
  ok(!back.actions && back.done,
    '★戻ってきた回も提出が済んだ画面のまま（提出ボタンを出し直さない）', back);
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

  /* ── ①：登録の箱そのものが描けなかった回 ─────────────────────
     pay-login.js はページのいちばん最後に読み込まれる1枚。これだけ届かないと、
     フォームも匿名の提出も**成功したまま**、そのあと出る登録の箱だけが
     高さ34pxの空枠になる（Google のボタンもメール欄も無い）。
     2026-09-09 まではそこで5秒待って黙って諦めていた ──
       本人の画面は「受け取りました ✓」で終わり、押せるものが1つも無い
       こちらの GA4 には pay_login_shown だけが立ち、**登録欄を見たのに
       登録しなかった人**に化けていた（箱ができる前に数えていたため）
     8/22 以降、預けたまま登録に来ていない人が19人中4人いる。本番で
     これが起きたかは記録が無いので**分からない**。ここを直すと次から分かる。
     ★見るのは4つ：預かりだけは成立していること・逃げ道が本当に見えること・
       失敗が記録に残ること・箱が無いのに pay_login_shown を立てないこと。 */
  console.log(`\n${tag} ①：pay-login.js が届かなかった回\n`);
  blockPayLogin = true;
  stashed.length = 0;
  await p.evaluate(() => { localStorage.clear(); });
  await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
  await p.click('#entry-manual');
  await p.evaluate(fillForm);
  await p.evaluate(() => { document.getElementById('submit-btn').click(); });
  await new Promise((r) => setTimeout(r, 7500));   // 逃げ道は5秒で出る
  const fb = await p.evaluate(() => {
    const el = document.getElementById('pay-login-fallback');
    const a = el ? el.querySelector('a[href]') : null;
    return {
      box: !!document.getElementById('pl-up-btn'),
      /* ★可視は offsetParent。hidden を外し忘れても display だけなら通ってしまう。 */
      shown: !!(el && el.offsetParent),
      href: a ? a.getAttribute('href') : '',
      done: (() => { const d = document.getElementById('gate-done'); return !!(d && d.offsetParent); })(),
      ev: (window.dataLayer || []).filter((x) => x[0] === 'event').map((x) => x[1]),
    };
  });
  ok(stashed.length === 1, 'pay-login.js が無くても、預かりだけは成立している', stashed.length);
  ok(!fb.box, '（前提）登録の箱は描けていない', fb.box);
  ok(fb.shown, '★描けなかったとき、逃げ道が本当に見えている（空枠で終わらせない）', fb);
  ok(/login\.html/.test(fb.href), '逃げ道にログイン／登録へのリンクがある', fb.href);
  /* ★預かり証を URL に載せない。login.html は GA4 を持っていて、URL が
     page_location として Google に渡る（auth-callback.html にわざと gtag が
     無いのと同じ理由）。載せなくても、預かり証は同じブラウザの localStorage に
     あり、戻り先の pay-report.html も既定の actual-pay.html も拾う。 */
  ok(!/[0-9a-f]{48}/i.test(fb.href), '★逃げ道の URL に預かり証を載せていない', fb.href);
  ok(fb.ev.includes('pay_login_mount_fail'),
    '描けなかったことが記録に残る（これが無いと永久に気づけない）', fb.ev);
  /* ★過去の GA4 と比べるとき：新しい pay_login_shown ＋ pay_login_mount_fail
     ＝ 古い pay_login_shown。 */
  ok(!fb.ev.includes('pay_login_shown'),
    '★箱が描けていないのに pay_login_shown を立てない', fb.ev);
  /* ★箱が描けなくても、預かりは成立している。それだけは画面に出す。
     #gate-done を HTML に直接置いてあるのはこのため（pay-login.js に頼らない）。 */
  ok(fb.done, '★登録の箱が描けなくても「預かりました」の1行は出ている', fb.done);
  blockPayLogin = false;

  /* ── 預けそこねた回：提出ボタンを消さない ───────────────────────
     通信が切れた・上限に当たった回は showGate(false) に落ちる。あちらは
     「ログインできた所からその場で送る」経路なので、提出ボタンを畳むと
     **送る手段が1つも無い画面**になる（サーバにも端末にも何も残らない）。
     2026-09-10 に上の畳み込みを入れたので、ここが一番効く1本。 */
  console.log(`\n${tag} 預けそこねた回（提出ボタンを残す）\n`);
  stashFail = true;
  stashed.length = 0;
  await p.evaluate(() => { localStorage.clear(); });
  await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
  await p.click('#entry-manual');
  await p.evaluate(fillForm);
  await p.evaluate(() => { document.getElementById('submit-btn').click(); });
  await new Promise((r) => setTimeout(r, 1500));
  const miss = await p.evaluate(() => {
    const v = (id) => { const el = document.getElementById(id); return !!(el && el.offsetParent); };
    let claims = [];
    try { claims = JSON.parse(localStorage.getItem('pv_pay_claim') || '[]'); } catch (e) {}
    return { actions: v('submit-actions'), btn: v('submit-btn'), done: v('gate-done'),
             gate: v('login-gate'), claims: claims.length };
  });
  ok(miss.claims === 0, '（前提）預かり証は返ってきていない', miss.claims);
  ok(miss.gate, '預けそこねても登録の箱は出る（ログインしてその場から送るため）', miss);
  ok(miss.actions && miss.btn,
    '★★預けそこねた回は「匿名で提出する」を残す（送る手段の無い画面にしない）', miss);
  ok(!miss.done, '預かっていないのに「預かりました」と言わない', miss.done);
  stashFail = false;

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
  /* ★is_new を立てる。claim_pending_report は中で submit_pay_report を呼んで
     結果をそのまま返すので、初回の引き取りでは本物も真になる。 */
  claimReply = { ok: true, is_new: true, id: '00000000-0000-0000-0000-000000000002', payload: {} };
  claimed.length = 0;
  await p.evaluate(installFakeSession, FAKE_UID);
  await p.goto(`${BASE}${dir}/pay-report.html?claim=${URL_TOKEN}`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));
  const landed = await p.evaluate(() => ({
    claims: (() => { try { return JSON.parse(localStorage.getItem('pv_pay_claim') || '[]').length; } catch (e) { return -1; } })(),
    pop: window.__pop,
  }));
  ok(claimed.some((x) => (x || '').includes(URL_TOKEN)), 'ログイン済みで着地すると URL の1枚を紐付けに出す', claimed.length);
  ok(landed.claims === 0, '紐付けが通った預かり証は端末から消す', landed);
  /* ★祝いは1か所だけ。預かった時点では鳴らさず（上で見ている）、
     引き取りが通ったここで初めて鳴る＝祝いと本当の完了が一致する。 */
  ok(landed.pop === 1, '★紙吹雪は引き取り（会員登録）が済んだここで1回だけ鳴る', landed.pop);

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

/* ⑨-2 給与フォームの中のログインの箱（pay-login.js）も同じ約束を守ること。
      ⑨ は en/login.html しか見ていなかったので、**今回の穴はここでは検知できなかった**。
      pay-login.js は「★必ず絶対パスで書く」とコメントしながら 'en/pay-report.html' と
      相対で書かれていた（callbackUrl() がルートの auth-callback.html を固定で書いていたので
      偶然動いていただけ）。だから**絶対パスであること自体**も見る。 */
console.log('\n給与フォームのログインの箱の戻り先（日英）\n');
for (const [dir, want] of [['', '/pay-report.html'], ['/en', '/en/pay-report.html']]) {
  const label = dir || '(日本語)';
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
  const unwrap = (u) => { let t = u; for (let i = 0; i < 3; i++) t = decodeURIComponent(t); return t; };
  const nextOf = (list) => {
    const m = unwrap(list[list.length - 1] || '').match(/next=([^&]+)/);
    return m ? m[1] : '';
  };

  await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
  await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
  await p.evaluate(() => { showGate(false); });
  // ★箱は「まだ埋めきっていない段」の中なので高さ0。見た目はここの主題ではない
  //   （見えるかどうかは ⑥ と db/test-form-contract.mjs が見ている）。居ることだけ待つ。
  await p.waitForSelector('#pl-up-mail');

  await p.evaluate(() => {
    document.getElementById('pl-up-mail').value = 'someone@example.invalid';
    document.getElementById('pl-up-btn').click();
  });
  await new Promise((rs) => setTimeout(rs, 1200));
  const nOtp = nextOf(otpSent);
  ok(nOtp === want, `${label} コードのメールの戻り先が ${want}`, nOtp || otpSent);
  ok(nOtp.startsWith('/'), `${label} コードの戻り先が絶対パス（相対だと着地が言語ごと壊れる）`, nOtp);

  // Google は押すとページを離れるので最後に押す
  await p.evaluate(() => { document.getElementById('pl-g-up').click(); }).catch(() => {});
  await new Promise((rs) => setTimeout(rs, 1200));
  const nAuth = nextOf(authSent);
  ok(nAuth === want, `${label} Google の戻り先が ${want}`, nAuth || authSent);
  ok(nAuth.startsWith('/'), `${label} Google の戻り先が絶対パス`, nAuth);

  await p.close();
}

await b.close();
console.log(fail ? `\n${fail} fail\n` : '\n全部通った\n');
process.exit(fail ? 1 : 0);
