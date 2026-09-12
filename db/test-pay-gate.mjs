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
const LATE_TOKEN = 'c'.repeat(48);   // confetti.js が遅れて届いた回に引き取る1枚
const SB_HOST    = /vzgmnkrggrwtsrpqndsm\.supabase\.co/;
const FAKE_UID   = '00000000-0000-0000-0000-000000000001';
const OTHER_UID  = '00000000-0000-0000-0000-0000000000ff';   // 共有端末の「次の人」

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
    /* ★通貨は JPY を名指しする（2026-09-11）。先頭の選択肢は USD で、下の
       f-gross=1,080,000 と合わせると年 $12,960,000 ＝ 5/5 の確認画面が
       「この金額でよろしいですか？」を出す（極端な金額の確認・オーナー承認）。
       ここで見たいのは預かりの経路なので、金額はありえる範囲に置く。
       確認そのものは db/test-form-contract.mjs が見る。 */
    set('f-currency', 'JPY');
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
    const install = () => {
      window.PVConfetti = function () { window.__pop++; };
      window.PVConfetti.badge = function () { window.__badge++; };
    };
    /* ★URL に late=1 が付いている回だけ、入れずに待つ。confetti.js は
       ページのいちばん最後に読み込まれる1枚で、細い電波では実際に遅れて届く。
       **普段どおり最初から入れてしまうと、遅れて届く形は永久に再現できない**
       （偽物が常に先に居るため）。
       ⚠️ 時間で入れない。goto の待ち方しだいで「もう入っている」状態から
          測り始めてしまう（実際そうなった）。台本の側から明示的に入れる。 */
    window.__installConfetti = install;
    if (!/[?&]late=1/.test(location.search)) install();
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
  let claimStatus = 200;       // 500 にすると「答えが返らなかった回」になる（N-2）
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
      /* ★通信で落ちた回の再現。supabase-js は 5xx を throw せず error で返すので、
         呼んだ側が「預かりが無い」と読み違えられる（N-2 の正体）。 */
      if (claimStatus !== 200) return json({ message: 'blocked_by_test' }, claimStatus);
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
         文言は変わる（「受け取りました ✓」→「あと1ステップ」→「✅完了まであと1ステップです！」）が、
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

  /* ── N-1 金額の読み方（2026-09-11）──────────────────────────────
     ヨーロッパ式に 1.000,00 と書いた人の総支給が **1** になっていた
     （カンマを全部落として parseFloat していた）。画面は普通に動いたまま
     年収が REAL PAY の常識の幅（$10,000〜$700,000）を外れ、行ごと黙って消える
     ＝「出したのに自分の行が出てこない」。本番で実際に起きうる形。
     ★直し方の骨は「黙って推測しない」。2通りに読める入力は欄の下で本人に聞き、
       選ぶまで送信も止める。ここで固定するのはその3つ ──
       ① 正しく読めるものは正しく読む（小数も含めて）
       ② 打っている途中で文字を消さない
       ③ 曖昧なものは聞く／送信を止める・選べば通る
     ★ただし「聞く」のは**両方の読み方が書式として成立する**ときだけ（1.000 など）。
       1,5 のように片方が成立しないものは聞かずに小数として読む（2026-09-11 オーナー指摘）。 */
  console.log(`\n${tag} N-1 金額の読み方（黙って推測しない）\n`);
  await p.evaluate(() => { localStorage.clear(); });
  await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
  const money = await p.evaluate(() => {
    const R = (x) => { const r = window.readMoney(x); return [r.state, r.n]; };
    return {
      euro: R('1.000,00'), anglo: R('1,234.56'), group: R('1,150,000'),
      dec:  R('1234.56'),  half:  R('0.5'),      plain: R('1150000'),
      amb1: R('1.000'),    comdec: R('1,5'),     bad:   R('12万'),
      comdec2: R('1000,50'), zero: R('0.500'),    weird: R('1,23,456'),
    };
  });
  ok(money.euro[0] === 'ok' && money.euro[1] === 1000,
    '★★1.000,00（欧州式）を 1000 と読む ── ここが 1 になって行が消えていた', money.euro);
  ok(money.anglo[0] === 'ok' && money.anglo[1] === 1234.56, '1,234.56（英米式）を 1234.56 と読む', money.anglo);
  ok(money.group[0] === 'ok' && money.group[1] === 1150000, '1,150,000 は桁区切り', money.group);
  ok(money.dec[0] === 'ok' && money.dec[1] === 1234.56, '★小数はそのまま通す（「給与に小数は無い」と決めつけない）', money.dec);
  ok(money.half[0] === 'ok' && money.half[1] === 0.5, '★0.5 も通す', money.half);
  ok(money.plain[0] === 'ok' && money.plain[1] === 1150000, '区切りの無い数はそのまま', money.plain);
  ok(money.amb1[0] === 'ambiguous', '★1.000 は 1000 とも 1.0 とも読める＝聞く（勝手に決めない）', money.amb1);
  /* ★2026-09-11 にオーナー指摘で作り直したところ。以前はここも「聞く」にしていたが、
     「カンマを取れば 15 になる」は読み方ではない（桁区切りとして成立しない書式）。
     普通に小数を書いた人に、要らない二択を出していた。 */
  ok(money.comdec[0] === 'ok' && money.comdec[1] === 1.5,
    '★★1,5 は 1.5（15 とは読まない・普通の小数入力に二択を出さない）', money.comdec);
  ok(money.comdec2[0] === 'ok' && money.comdec2[1] === 1000.5,
    '★1000,50 も 1000.50 と同じ扱い', money.comdec2);
  ok(money.zero[0] === 'ok' && money.zero[1] === 0.5,
    '★0.500 は 0.5（500 を 0.500 とは書かない＝桁区切りとして成立しない）', money.zero);
  ok(money.weird[0] === 'bad',
    '1,23,456 はどちらにも読めない＝読めないと言う（黙って数にしない）', money.weird);
  ok(money.bad[0] === 'bad', '数字として読めないものは、読めないと言う', money.bad);

  /* ② 打鍵中は1文字も書き換えない。桁区切りを出すのは**欄を離れたとき**だけ
     （2026-09-11 オーナー決定。時間・率の欄＝class="num" と同じ形に揃えた）。

     ★それまでは打っている最中にも桁区切りを出していて、その判定が
       「カンマを落としてから数字だけか見る」形だった ＝ **本人が打ったカンマが
       判定から消える**。3500,50 が 350,050 になり、100倍の額が警告ひとつ無く
       保存されていた。. と全角は守られていて、カンマだけが穴だった。
     ★パーサー（readMoney）は最初から正しく 3500,50 を 3500.5 と読める。
       打鍵中に画面が文字列を壊すので、**パーサーがその文字列を見ることが無かった**。
     ⚠️ だからここは**1文字ずつ打つ**。値を代入して input を撒く形（他の検査の setF）では
       この欠陥を一度も踏めない ── 実際、検査を全部素通りしていた。
     ⚠️ 「欄を離れたら整える」まで見ること。打鍵中だけ見ると、整え忘れに気づけない。 */
  const TYPED = [
    // 打つ文字列      離れたあとの表示   送られる数
    ['1.000,00',      '1,000',          1000],
    ['3500,50',       '3,500.5',        3500.5],     // ★100倍になっていた形
    ['1,5',           '1.5',            1.5],        // ★10倍になっていた形
    ['1150000',       '1,150,000',      1150000],
    ['8.450,00',      '8,450',          8450],
  ];
  const moneyKeys = await p.evaluate(async (list) => {
    document.getElementById('entry-manual').click();
    const el = document.getElementById('f-gross');
    const out = [];
    for (const row of list) {
      const src = row[0];
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      for (const c of src) {                      // ★1文字ずつ
        el.value += c;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const mid = el.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      out.push({ src, mid, after: el.value, n: window.moneyRead(el).n });
    }
    /* 貼り付け（1回の input で丸ごと入る）も同じ道を通ること。 */
    el.value = '3500,50';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    const pasteMid = el.value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { rows: out, pasteMid, pasteAfter: el.value, pasteN: window.moneyRead(el).n };
  }, TYPED);
  for (let i = 0; i < TYPED.length; i++) {
    const src = TYPED[i][0], after = TYPED[i][1], n = TYPED[i][2];
    const g = moneyKeys.rows[i];
    ok(g.mid === src, `★★打っている間は1文字も書き換えない（${src}）`, g.mid);
    ok(g.after === after, `欄を離れたら整える（${src} → ${after}）`, g.after);
    ok(g.n === n, `★★送られる数は ${n}（${src}）`, g.n);
  }
  ok(moneyKeys.pasteMid === '3500,50' && moneyKeys.pasteAfter === '3,500.5' && moneyKeys.pasteN === 3500.5,
    '★貼り付けでも同じ（3500,50 → 3,500.5 → 3500.5）', moneyKeys);

  /* ③ 曖昧なら欄の下で聞く。選ぶまで送信を止める。 */
  const amb = await p.evaluate(async () => {
    const el = document.getElementById('f-gross');
    el.value = '1.000';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 120));
    const box = el.nextElementSibling;
    const has = !!(box && box.classList && box.classList.contains('money-ask'));
    return {
      ask: has,
      btns: has ? Array.prototype.map.call(box.querySelectorAll('.ma-b'), (b) => b.textContent) : [],
      rule: has ? !!box.querySelector('.ma-rule') : false,
      blocked: !!window.moneyBlocker(),
    };
  });
  ok(amb.ask, '★曖昧な入力には、その欄の下に二択を出す', amb);
  ok(amb.btns.length === 2 && amb.btns.indexOf('1,000') >= 0 && amb.btns.indexOf('1') >= 0,
    '二択の中身が「1,000」と「1」', amb.btns);
  ok(amb.rule, '入力規則（桁区切りは , 小数点は .）はこの二択の中だけに書く', amb.rule);
  ok(amb.blocked, '★選ぶまでは送信を止める（推測して送らない）', amb.blocked);

  const chosen = await p.evaluate(async () => {
    const el = document.getElementById('f-gross');
    const b = Array.prototype.find.call(
      el.nextElementSibling.querySelectorAll('.ma-b'), (x) => x.textContent === '1,000');
    b.click();
    await new Promise((r) => setTimeout(r, 120));
    const nx = el.nextElementSibling;
    return {
      value: el.value, n: window.moneyRead(el).n, blocked: !!window.moneyBlocker(),
      ask: !!(nx && nx.classList && nx.classList.contains('money-ask')),
    };
  });
  ok(chosen.value === '1,000' && chosen.n === 1000, '選んだ読み方がそのまま欄に入る', chosen);
  ok(!chosen.ask && !chosen.blocked, '選んだら二択は消え、送信も止まらない', chosen);

  /* ── N-2 引き取りの答えが返らなかった回（2026-09-11）───────────
     それまで claim は「預かりが無い」と「通信で落ちた」を同じ null で返していた。
     フォームは後者を前者と読んで**新規保存へ流れ、しかも祝っていた**。
     サーバ側の預かり行は未引き取りのまま残るので、同じ人が REAL PAY に2行、
     pv_contributors() に2人として載る（最大24か月ぶん）。 */
  console.log(`\n${tag} N-2 引き取りに失敗した回（祝わない・二重にしない）\n`);
  claimStatus = 500;
  claimed.length = 0; stashed.length = 0;
  /* ★台本ではなく、実際に歩かせて預かりを作る。預かり証も預けた入力も
     ページ自身に書かせないと、戻ってきた人の画面（5/5・入力が入った状態）に
     ならず、見ているものが本番と違ってしまう。 */
  await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
  await p.click('#entry-manual');
  await p.evaluate(fillForm);
  await p.evaluate(() => { document.getElementById('submit-btn').click(); });
  await new Promise((r) => setTimeout(r, 1500));
  ok(stashed.length === 1, '（前提）匿名で預かるところまでは進んでいる', stashed.length);
  stashed.length = 0;
  /* ここで登録が済んだ ── メールのコードでも Google でも、戻り先は同じこの画面。 */
  await p.evaluate(installFakeSession, FAKE_UID);
  await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 2000));
  const nf = await p.evaluate(() => {
    const cs = document.getElementById('claim-state');
    const b = document.getElementById('submit-btn');
    let claims = [];
    try { claims = JSON.parse(localStorage.getItem('pv_pay_claim') || '[]'); } catch (e) {}
    return {
      shown: !!(cs && cs.offsetParent), retry: !!document.getElementById('cs-retry'),
      claims: claims.length, pop: window.__pop, btn: !!(b && b.offsetParent),
      ev: (window.dataLayer || []).filter((x) => x[0] === 'event').map((x) => x[1]),
    };
  });
  ok(claimed.length === 1, '（前提）引き取りには行っている', claimed.length);
  ok(nf.shown && nf.retry, '★答えが返らなかったら「もう一度取り込む」を出す', nf);
  ok(nf.claims === 1, '★預かり証を消さない（もう一度取りに行けることが唯一の出口）', nf.claims);
  ok(nf.pop === 0, '★祝わない（まだ本人のものになっていない）', nf.pop);
  ok(stashed.length === 0,
    '★★新規保存へ流さない ── ここが二重（REAL PAY に2行・人数に2人）の正体', stashed.length);
  ok(!nf.btn, '新規保存のボタンを出したままにしない', nf.btn);
  ok(nf.ev.includes('pay_claim_state'), '起きたことが記録に残る', nf.ev);

  /* サーバでは成功していて、答えだけ落ちていた回。もう一度押しても重複しない。 */
  claimStatus = 200;
  claimReply = { ok: false, reason: 'already_claimed' };
  claimed.length = 0;
  await p.evaluate(() => { document.getElementById('cs-retry').click(); });
  await new Promise((r) => setTimeout(r, 1500));
  const ac = await p.evaluate(() => ({
    retry: !!document.getElementById('cs-retry'),
    shown: (() => { const c = document.getElementById('claim-state'); return !!(c && c.offsetParent); })(),
    claims: (() => { try { return JSON.parse(localStorage.getItem('pv_pay_claim') || '[]').length; } catch (e) { return -1; } })(),
    pop: window.__pop,
  }));
  ok(claimed.length === 1, '再試行はもう一度サーバに聞きに行く', claimed.length);
  ok(ac.shown && !ac.retry,
    '★サーバが「もう移してある」と答えたら、再試行のボタンは出さない', ac);
  ok(stashed.length === 0,
    '★★「もう移してある」でも新規保存へ流さない（応答だけ落ちた回の二重を止める）', stashed.length);
  ok(ac.claims === 0, '答えが返った預かり証は端末から消す', ac.claims);
  ok(ac.pop === 0, '保存し直していないので祝わない', ac.pop);
  claimReply = { ok: false, reason: 'blocked_by_test' };

  /* ── N-3 / N-4 端末に残った入力は、持ち主のものだけ（2026-09-11）──
     pv_pay_last と pv_pay_claim には持ち主が書かれておらず、共有端末や
     ログアウト後に**前の人の会社・総支給が次の人の画面へ戻り**、
     **次の人が前の人の給与を引き取れた**。下書き（pv_pay_draft）だけは
     持ち主を見ていたので、3つの作法がばらばらだった。 */
  console.log(`\n${tag} N-3/N-4 端末に残った入力は持ち主のものだけ\n`);
  /* ⚠️ 仕込みは**別のページで**やる。pay-report.html は離れる拍子に
     pv_pay_last を書き戻す（pagehide → savePreset）ので、この画面の上で
     置いた細工は goto した瞬間に空の入力で上書きされ、**何を置いても
     通ってしまう検査**になる（実際そうなった）。 */
  /* ★仕込み用の別ページ。**HTML を返すもの**にする（robots.txt は
     application/octet-stream ＝ブラウザが「保存」に回して遷移が起きない）。 */
  const STAGE = `${BASE}/404.html`;
  await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
  /* 押印は本物の関数に作らせる（写すと、指紋の作り方を変えた日に嘘をつく）。 */
  const FP_A = await p.evaluate((uid) => window.PVPayLocal.fp(uid), FAKE_UID);
  /* A が置いていった「前回の内容」。 */
  const putLast = async (own) => {
    await p.goto(STAGE, { waitUntil: 'domcontentloaded' });
    await p.evaluate((o) => {
      localStorage.clear(); sessionStorage.clear();
      localStorage.setItem('pv_pay_last', JSON.stringify({
        'f-airline': 'ana', 'f-gross': '1,080,000', _own: o, _ts: Date.now(),
      }));
    }, own);
  };
  await putLast(FP_A);
  await p.evaluate(installFakeSession, OTHER_UID);
  await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  const bee = await p.evaluate(() => ({
    gross: (document.getElementById('f-gross') || {}).value || '',
    airline: (document.getElementById('f-airline') || {}).value || '',
    /* ★入口の2択に立っている段階なので、見えている印はこちら
       （#restore-bar は「手動で入力」を選んだ先にあり、まだ描かれていない）。 */
    prev: !document.getElementById('entry-prev').hidden,
  }));
  ok(!bee.gross && !bee.airline,
    '★★別のアカウントで開いても、前の人の会社・総支給が戻らない', bee);
  ok(!bee.prev, '入口の「前回の内容が入ります」も出さない', bee.prev);

  await putLast(FP_A);
  await p.evaluate(installFakeSession, FAKE_UID);
  await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  const own = await p.evaluate(() => ({
    gross: (document.getElementById('f-gross') || {}).value || '',
    prev: !document.getElementById('entry-prev').hidden,
  }));
  ok(own.gross === '1,080,000' && own.prev,
    '本人が開けば「前回の内容」は今までどおり戻る（締めすぎていない）', own);

  /* 匿名で置いた分は今までどおり戻る＝匿名入力→登録→引き取りを壊していない。 */
  await putLast('anon');   // ログインもしていない（上の clear で鍵ごと消えている）
  await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));
  const anon = await p.evaluate(() => (document.getElementById('f-gross') || {}).value || '');
  ok(anon === '1,080,000', '★匿名で置いた分は今までどおり戻る（登録前の入力を捨てない）', anon);

  /* ★★同じ場面を「前回の内容」の側でも見る ── A が匿名で入れたまま席を立ち、
     60分以内に B が別のタブから普通にログインして開く。預かり証だけ塞いでも、
     ここが開いていれば **A の会社と総支給が B の画面に出てしまう**。 */
  await p.goto(STAGE, { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => {
    localStorage.clear(); sessionStorage.clear();
    var mine = window.PVPayLocal.tabId();          // B のタブの合言葉
    localStorage.setItem('pv_pay_last', JSON.stringify({
      'f-airline': 'ana', 'f-gross': '1,080,000',
      _own: 'anon', _ts: Date.now() - 60 * 1000, _tab: mine + '-b',   // A のタブ
    }));
  });
  await p.evaluate(installFakeSession, OTHER_UID);
  await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  const anonOther = await p.evaluate(() => ({
    gross: (document.getElementById('f-gross') || {}).value || '',
    airline: (document.getElementById('f-airline') || {}).value || '',
    prev: !document.getElementById('entry-prev').hidden,
  }));
  ok(!anonOther.gross && !anonOther.airline,
    '★★A の匿名入力が、60分以内に別のタブで入った B の画面に戻らない', anonOther);
  ok(!anonOther.prev, '入口の「前回の内容が入ります」も出さない', anonOther.prev);

  /* ★下書き（pv_pay_draft）も同じ場面で見る。ここは3つのうち唯一
     「14日は残す」と約束している入れ物なので、規則が1段だけ違う ──
       ・見ている人も匿名  → 14日そのまま戻す（A と B を見分ける手がかりが無い）
       ・名前のある口座    → **同じタブの続きのときだけ**受け継ぐ
     下で見るのは後者。B がログイン済みで開いても A の書きかけを拾わないこと。 */
  const draftAsB = async (tab) => {
    await p.goto(STAGE, { waitUntil: 'domcontentloaded' });
    await p.evaluate((t) => {
      localStorage.clear(); sessionStorage.clear();
      var mine = window.PVPayLocal.tabId();
      localStorage.setItem('pv_pay_draft', JSON.stringify({
        v: 1, uid: 'anon', step: 's3', ts: Date.now() - 60 * 1000,
        tab: t === 'same' ? mine : mine + '-b',
        fields: { 'f-airline': 'ana', 'f-gross': '1,080,000' },
      }));
    }, tab);
    await p.evaluate(installFakeSession, OTHER_UID);
    await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1500));
    await p.click('#entry-manual');
    await new Promise((r) => setTimeout(r, 600));
    return p.evaluate(() => ({
      gross: (document.getElementById('f-gross') || {}).value || '',
      step: window.PVPayWizard ? window.PVPayWizard.current() : '',
      left: localStorage.getItem('pv_pay_draft') != null,
    }));
  };
  const dOther = await draftAsB('other');
  ok(!dOther.gross,
    '★★A の書きかけの下書きが、別のタブでログインした B の画面に入らない', dOther);
  ok(dOther.step === 's1', 'B は 1/5 から始まる（A の 3/5 に置き去りにしない）', dOther.step);
  ok(dOther.left, 'A の下書きは消さない（A が同じタブに戻れば続きから入れる）', dOther.left);
  const dSame = await draftAsB('same');
  ok(dSame.gross === '1,080,000',
    '★同じタブで匿名から登録した人は、書きかけの続きから入れる', dSame.gross);

  /* 預かり証も同じ規則。次の人が前の人のレポートを引き取らない。 */
  claimed.length = 0;
  await p.goto(STAGE, { waitUntil: 'domcontentloaded' });
  await p.evaluate((own, tok) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('pv_pay_claim', JSON.stringify([{ t: tok, ts: Date.now(), own: own }]));
  }, FP_A, FAKE_TOKEN);
  await p.evaluate(installFakeSession, OTHER_UID);
  await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  const kept = await p.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('pv_pay_claim') || '[]').length; } catch (e) { return -1; }
  });
  ok(claimed.length === 0,
    '★★共有端末で、次の人が前の人の預かりを引き取らない', claimed.length);
  ok(kept === 1, '前の人の預かり証は消さずに残す（本人が戻れば取れる）', kept);

  /* ★匿名で預けた分は誰のものか（PVPayLocal.owns の 'anon' の枝・2026-09-11）。
     押印が 'anon' の預かり証は名前では決められないので、**タブの合言葉**で決める ──
       ① 名前のある押印     → その人だけ（ひとつ上の塊で確認済み）
       ② 匿名 ＋ 合言葉あり → **同じタブの続きのときだけ**。時間では通さない
       ③ 匿名 ＋ 合言葉なし → この直しより前に置かれた分だけ。作って60分以内の経過措置
     合言葉はタブごとの乱数（sessionStorage）。タブを閉じれば消え、別のタブとは一致しない。
     これで「匿名で入力 → その場で登録 → 引き取り」は今までどおり通り、
     共有端末で置き去りにされた分が次の人のものになる道だけが閉じる。
     ⚠️ 2026-09-11 より前は合言葉が定数の '1' で、pay-report.html を開いて離れる
        （pagehide → savePreset → markTab）だけでどのタブにも押されていた。
        つまり実質「60分以内なら次の人でも引き取れる」だった。
     ⚠️ 時計は動かせないので、預かり証の日付を倒して同じ状態を作る。 */
  const anonClaim = async (ageMs, tab) => {
    claimed.length = 0;
    claimReply = { ok: true, is_new: true, id: '00000000-0000-0000-0000-0000000000c1' };
    await p.goto(STAGE, { waitUntil: 'domcontentloaded' });
    await p.evaluate((tok, age, t) => {
      localStorage.clear(); sessionStorage.clear();
      /* 合言葉は本物の関数に作らせる（写すと、作り方を変えた日に嘘をつく）。
         sessionStorage はタブに付くので、このあと遷移しても同じ値が続く。 */
      var mine = window.PVPayLocal.tabId();
      var stamp = t === 'same' ? mine : (t === 'other' ? mine + '-b' : '');
      localStorage.setItem('pv_pay_claim',
        JSON.stringify([{ t: tok, ts: Date.now() - age, own: 'anon', tab: stamp }]));
    }, FAKE_TOKEN, ageMs, tab);
    await p.evaluate(installFakeSession, OTHER_UID);
    await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1500));
    return { calls: claimed.length, left: await p.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('pv_pay_claim') || '[]').length; } catch (e) { return -1; }
    }) };
  };
  const same = await anonClaim(60 * 1000, 'same');
  ok(same.calls === 1,
    '★匿名で入れて、その流れで登録した人は引き取れる（正規の道を塞がない）', same.calls);

  /* ★★オーナーが名指しした場面（2026-09-11）──
     A が匿名で入力して置いていき、60分以内に B が**別のタブ**から普通に
     ログインして入ってくる。時間だけで決めていたら渡ってしまう。 */
  const other = await anonClaim(60 * 1000, 'other');
  ok(other.calls === 0,
    '★★A の匿名入力が、60分以内に別のタブでログインした B へ自動で渡らない', other.calls);
  ok(other.left === 1, '渡さないだけで消さない（A が同じタブに戻れば取れる）', other.left);

  /* 同じタブの続きなら時間では切らない ── 本人が3時間かけて登録しても取れる。 */
  const late = await anonClaim(3 * 60 * 60 * 1000, 'same');
  ok(late.calls === 1,
    '同じタブの続きなら、60分を超えていても本人は引き取れる', late.calls);

  /* ③合言葉なし＝この直しより前に置かれた預かり証だけの経過措置。 */
  const legacy = await anonClaim(60 * 1000, null);
  ok(legacy.calls === 1,
    '直す前に預けた分（合言葉なし）は60分の経過措置で取れる', legacy.calls);
  const leftover = await anonClaim(3 * 60 * 60 * 1000, null);
  ok(leftover.calls === 0,
    '★★合言葉がなく、時間も経っていたら次の人に渡さない', leftover.calls);
  ok(leftover.left === 1, '渡さないだけで消さない（置いていった本人が戻れば取れる）', leftover.left);
  claimReply = { ok: false, reason: 'blocked_by_test' };

  /* ログアウトで4つとも忘れる（profile.html の handleLogout → PVPayLocal.forget）。 */
  const forgot = await p.evaluate(() => {
    localStorage.setItem('pv_pay_last', '{}');
    localStorage.setItem('pv_pay_draft', '{}');
    localStorage.setItem('pv_pay_pending', '{}');
    window.PVPayLocal.forget();
    return ['pv_pay_last', 'pv_pay_draft', 'pv_pay_claim', 'pv_pay_pending']
      .filter((k) => localStorage.getItem(k) != null);
  });
  ok(forgot.length === 0, '★出ていくときは4つとも忘れる（1行消して終わりにしない）', forgot);

  /* ── N-4 下書きを消したら、再読み込みで復活しない ─────────────
     「下書きを消す」は pv_pay_draft しか消していなかった。pv_pay_last が
     残っているので、再読み込みで会社・職位・総支給が戻ってくる
     （本人には、消したはずのものが勝手に生き返って見える）。 */
  console.log(`\n${tag} N-4 下書きを消したら、再読み込みで復活しない\n`);
  await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
  await p.click('#entry-manual');
  await p.evaluate(fillForm);
  const dropped = await p.evaluate(async () => {
    /* 離れる拍子の控え（pagehide）まで含めて、実際と同じ順に起こす。 */
    window.dispatchEvent(new Event('pagehide'));
    if (window.PVPayWizard) window.PVPayWizard.saveDraft();
    await new Promise((r) => setTimeout(r, 100));
    const had = ['pv_pay_last', 'pv_pay_draft'].filter((k) => localStorage.getItem(k) != null);
    const b = document.querySelector('#wz-draft .wz-draft-drop');
    if (b) b.click();
    await new Promise((r) => setTimeout(r, 100));
    window.dispatchEvent(new Event('pagehide'));   // 消した直後に離れても書き戻さない
    return {
      had,
      left: ['pv_pay_last', 'pv_pay_draft'].filter((k) => localStorage.getItem(k) != null),
      bar: (() => { const x = document.getElementById('restore-bar'); return !!(x && x.offsetParent); })(),
    };
  });
  ok(dropped.had.length === 2, '（前提）下書きと「前回の内容」の両方が端末にある', dropped.had);
  ok(dropped.left.length === 0,
    '★★「下書きを消す」で両方消える（片方だけ残るから復活していた）', dropped.left);
  ok(!dropped.bar, '「前回の内容」の帯も畳む', dropped.bar);
  await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 800));
  const revived = await p.evaluate(() => ({
    gross: (document.getElementById('f-gross') || {}).value || '',
    airline: (document.getElementById('f-airline') || {}).value || '',
  }));
  ok(!revived.gross && !revived.airline,
    '★★再読み込みしても会社・総支給が復活しない', revived);

  /* 「保存を消す」（#btn-forget）も同じ後始末を通る。片方だけ消える形をなくす。 */
  await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
  await p.click('#entry-manual');
  await p.evaluate(fillForm);
  const forget2 = await p.evaluate(async () => {
    window.dispatchEvent(new Event('pagehide'));
    if (window.PVPayWizard) window.PVPayWizard.saveDraft();
    await new Promise((r) => setTimeout(r, 100));
    document.getElementById('restore-bar').style.display = '';   // 帯を出した状態にする
    document.getElementById('btn-forget').click();
    await new Promise((r) => setTimeout(r, 100));
    window.dispatchEvent(new Event('pagehide'));
    return ['pv_pay_last', 'pv_pay_draft'].filter((k) => localStorage.getItem(k) != null);
  });
  ok(forget2.length === 0, '★「保存を消す」でも下書きまで一緒に消える', forget2);

  /* ── 逃げ道の文言が、預かりの有無で変わる（2026-09-11）─────────
     預かりに失敗した回にも「入力はサーバーに預けてあります。消えていません。」
     と出ていた。その人の入力はこのブラウザにしか無いので、これは嘘になる。 */
  console.log(`\n${tag} 逃げ道の文言は、預けられたかどうかで変わる\n`);
  stashFail = true;
  blockPayLogin = true;
  stashed.length = 0;
  await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await p.goto(`${BASE}${dir}/pay-report.html`, { waitUntil: 'networkidle0' });
  await p.click('#entry-manual');
  await p.evaluate(fillForm);
  await p.evaluate(() => { document.getElementById('submit-btn').click(); });
  await new Promise((r) => setTimeout(r, 7500));
  const words = await p.evaluate(() => {
    const el = document.getElementById('pay-login-fallback');
    const l = el ? el.querySelector('.plfb-l') : null;
    return { shown: !!(el && el.offsetParent), text: l ? (l.textContent || '').trim() : '' };
  });
  ok(words.shown, '（前提）預けそこねて箱も描けないときも、逃げ道は出る', words.shown);
  ok(!/サーバーに預けてあります|held on our server/.test(words.text),
    '★★預けられていない人に「サーバーに預けてあります」と言わない', words.text.slice(0, 80));
  ok(/このブラウザ|this browser/.test(words.text),
    '★どこに残っているかを正しく言う（このブラウザ）', words.text.slice(0, 80));
  stashFail = false;
  blockPayLogin = false;

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

  /* ── confetti.js が遅れて届いた回 ────────────────────────────
     ★これが**いちばん効く1本**。祝いは登録が済んだこの1か所にしか無いので、
       ここで鳴りそこねると「登録を終えた人にだけ、何も起きない」になる。
       しかも画面は普通に動いたままで、誰も気づけない。
     ★pay-login.js が届かなかった回（2026-09-09 の逃げ道）と同じ形。
       あちらは空の枠が見えたが、こちらは見えるものが何も無い。 */
  claimReply = { ok: true, is_new: true, id: '00000000-0000-0000-0000-000000000003', payload: {} };
  claimed.length = 0;
  await p.goto(`${BASE}${dir}/pay-report.html?late=1`, { waitUntil: 'networkidle0' });
  await p.evaluate(installFakeSession, FAKE_UID);
  await p.evaluate((tok) => {
    localStorage.setItem('pv_pay_claim', JSON.stringify([{ t: tok, ts: Date.now() }]));
  }, LATE_TOKEN);
  await p.goto(`${BASE}${dir}/pay-report.html?late=1`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 900));
  const beforeArrival = await p.evaluate(() => window.__pop);
  /* ここで初めて confetti.js が届いた、という形 */
  await p.evaluate(() => window.__installConfetti());
  await new Promise((r) => setTimeout(r, 400));
  const afterArrival = await p.evaluate(() => window.__pop);
  ok(claimed.some((x) => (x || '').includes(LATE_TOKEN)), '（前提）遅れて届く回でも引き取りには出している', claimed.length);
  ok(beforeArrival === 0, '（前提）confetti.js が届くまでは鳴っていない', beforeArrival);
  ok(afterArrival === 1, '★★confetti.js が遅れて届いた回でも、待って1回だけ鳴る',
     { 届く前: beforeArrival, 届いた後: afterArrival });

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

/* ⑧b 登録で聞くのは3つだけ（2026-09-11 オーナー指示）──────────────
      「居住国・在籍企業・職位だけ必須。名前とか生年月日はそもそも要らない（匿名だし）」。
      ★ここは**日英で同時に**直さないと、英語圏だけ6項目のまま残る（前に一度そうなった）。
      ⚠️ 列は消していない。マイページからは今までどおり入れられるし、
         既に入れた人の値もそのまま残る（handle_new_user は coalesce）。
      ⚠️ 氏名を持たない会員が生まれる＝**ヘッダーを u.name で判定している場所が
         「ログイン」を出したまま**になる。ログイン済みの人に毎ページ「ログイン」と
         出るのは、本人には「登録できていない」としか見えない。6か所を一緒に見る。 */
console.log('\n(共通) 登録で聞くのは居住国・在籍企業・職位の3つだけ\n');
{
  for (const f of ['signup.html', 'en/signup.html']) {
    const t = readFileSync(ROOT + f, 'utf8');
    for (const [id, label] of [['s2-name', '氏名'], ['s2-birth', '生年月日']]) {
      ok(!new RegExp('id="' + id + '"').test(t), `${f} が${label}の欄を持たない`, id);
    }
    ok(!/name="gender"/.test(t), `${f} が性別の欄を持たない`, 'gender');
    for (const [id, label] of [['s2-country', '居住国'], ['s2-company', '在籍企業']]) {
      ok(new RegExp('id="' + id + '"').test(t), `${f} は${label}を聞く`, id);
    }
    ok(/name="position"/.test(t), `${f} は職位を聞く`, 'position');
    /* 欄だけ消して、送るほうに残っていると **undefined を DB へ書きに行く**。 */
    ok(!/\bbirthdate\s*[:,]/.test(t), `${f} が生年月日を送らない`, 'birthdate');
    ok(!/gender\s*:\s*gender/.test(t), `${f} が性別を送らない`, 'gender:');
    /* ★「もう登録済みか」の判定。ここが p.name のままだと、登録を終えた人が
       開くたびにこの画面へ戻される（本人には理由が分からない）。 */
    ok(/p\.country\s*&&\s*p\.company\s*&&\s*p\.position/.test(t),
      `${f} の「登録済み」判定が今の必須3つを見ている`, f);
  }
  /* ヘッダー6か所。氏名が無くてもログイン済みならマイページへ行けること。 */
  for (const f of ['search.js', 'airlines/airline-base.js', 'community.html',
                   'world-airlines.html', 'en/community.html', 'en/world-airlines.html']) {
    const t = readFileSync(ROOT + f, 'utf8');
    ok(!/u\s*&&\s*u\.name\b/.test(t),
      `${f} が「氏名があるか」でログイン済みを判定していない`, f);
    ok(/u\.name\s*\|\|\s*String\(u\.email/.test(t),
      `${f} は氏名が無ければメールの @ より前を出す`, f);
  }
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
