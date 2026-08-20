/* 「出したら会員になっていた」が成立し続けているかを見る。

   このサイトは 2026-08-17 から、**送信を押した瞬間にサーバへ保存**して、
   アカウントはそのあとで作ってもらう形になっている（db/pay-report-pending.sql）。
   だから次の3つが壊れると、給与データは1件も残らなくなる：
     ① 読み込んだ瞬間にログインを求めてしまう（フォームを見る前に帰る）
     ② 送信を押しても submit_pay_report_pending を呼ばない（入力が捨てられる）
     ③ 返ってきた預かり証を残さない（サーバにはあるのに本人へ渡せない）
   どれも画面を開けば分かるが、開かないと分からない。ここで毎回通す。

   ついでに計測も見る。この経路に計測が無かった間、明細の読み取り17回に対して
   保存0件という数字の理由が「詰まった」のか「出す気が無かった」のか
   誰にも答えられなかった。イベントが消えたら黙って同じ状態に戻る。

   ★GA へは実際に送らない（googletagmanager を落として dataLayer だけ読む）。
   ★実在しないアドレスしか打たない（本物の OTP メールを飛ばさない）。
   ★★本番の DB に1行も書かない。submit_pay_report_pending への POST は
     ここで横取りして偽の預かり証を返す（localhost のページが見ている Supabase は
     本番なので、素通しにするとこの検査を回すたびに置き場にゴミが溜まる）。
     横取りした本文もそのまま検査する＝「何を送っているか」までここで見える。

   実行: node serve.mjs を上げてから node db/test-pay-gate.mjs */
import puppeteer from 'puppeteer';
const BASE = 'http://localhost:3000';
const b = await puppeteer.launch({ headless: 'shell' });
let fail = 0;
const ok = (c, m, got) => { c ? console.log(`  ✅ ${m}`) : (fail++, console.log(`  ❌ ${m} → ${JSON.stringify(got)}`)); };

const FAKE_TOKEN = 'a'.repeat(48);   // サーバが返す形（24バイトの hex）に合わせる

for (const [dir, tag] of [['', '(日本語)'], ['/en', '/en']]) {
  const p = await b.newPage();
  await p.setViewport({ width: 1100, height: 900 });
  await p.setRequestInterception(true);

  /* 置き場への POST を横取りする。本文は後で中身を見る。
     ★CORS の見出しを必ず付ける。付けないとブラウザが答えを捨てて、ページ側からは
       「通信が落ちた」に見える（実際これで pay_report_error だけが立った）。
       別オリジンなので OPTIONS の下見も飛んでくる。これも同じ見出しで返す。 */
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  const stashed = [];
  p.on('request', (r) => {
    const u = r.url();
    if (/googletagmanager|google-analytics/.test(u)) return r.abort();
    const isStash = /\/rest\/v1\/rpc\/submit_pay_report_pending\b/.test(u);
    /* 紐付けと本送信はログインしていないと呼ばれないが、万一呼ばれても本番を触らせない。 */
    const isOther = /\/rest\/v1\/rpc\/(claim_pending_report|submit_pay_report)\b/.test(u);
    if (!isStash && !isOther) return r.continue();
    if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: CORS, body: '' });
    if (isStash) {
      stashed.push(r.postData() || '');
      return r.respond({
        status: 200,
        headers: CORS,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, claim_token: FAKE_TOKEN, id: '00000000-0000-0000-0000-000000000000' }),
      });
    }
    return r.respond({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'blocked_by_test' }) });
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
    set('f-jobrole', firstOpt('f-jobrole'));
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

  // 3) 入口の計測。実在しないアドレスなのでメールは飛ばない
  if (gate.hasBox) {
    await p.type('#pl-up-mail', 'not-an-email');
    await p.click('#pl-up-btn');
    await new Promise((r) => setTimeout(r, 400));
    const ev = await p.evaluate(() => (window.dataLayer || [])
      .filter((a) => a[0] === 'event')
      .map((a) => [a[1], JSON.stringify(a[2] || {})].join(' ')));
    ok(ev.some((x) => x.startsWith('pay_login_start') && x.includes('code_new')), 'pay_login_start{code_new} が出ている', ev);
    ok(ev.some((x) => x.startsWith('pay_login_code_fail') && x.includes('bad_email')), 'pay_login_code_fail{bad_email} が出ている', ev);
    const leaks = await p.evaluate(() => (window.dataLayer || [])
      .filter((a) => a[0] === 'event' && /^pay_(login|report)_/.test(a[1]))
      .filter((a) => JSON.stringify(a[2] || {}).match(/@|[0-9]{4,}/)));
    ok(leaks.length === 0, '計測にメールアドレスも金額も混ざっていない', leaks);
  }

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

  await p.close();
}
await b.close();
console.log(fail ? `\n${fail} fail\n` : '\n全部通った\n');
process.exit(fail ? 1 : 0);
