/* 戻ってきた会員に「〇〇のこと、ひとつ教えて。」（2026-10-30 オーナー指示）── 画面の通し。

   誰に・何を・どの順・2日に1回かはサーバが決める（db/test-ask-own-airline.mjs が見ている）。
   ここで見るのは、画面が約束どおりに動くことだけ:
     ① 出さないと決まった人の通信を増やさない ── 未ログイン・48時間の窓の中の会員は pv-conditions.js を読み込まず、
        サーバにも聞かない
     ② 出さない画面（入力の途中・連絡先など）と、Give & Get の板が出るページでは聞かない
     ③ 板の見出しは「{社名}のこと、ひとつ教えて。」、最大3問、1問ごとにその場で保存
        ── 1つ選ぶ・数字・複数選ぶの3つの形。数字は範囲の外を送らない。欄の字は 16px 以上（iPhone が拡大しない）
     ④ 板を開いたら pv_ask_seen を1回だけ。次に聞いてよい時刻が端末に残り、次のページでは何もしない
     ⑤ × で閉じたら、見せていた1問だけスキップとして残す
     ⑥ サーバが「まだ」と言えば板を出さず、その時刻まで聞きに行かない
     ⑨ 「← 前の質問」（2026-11-17）── 2問目から・戻ると保存した答えを選んだ形・選び直しは上書きの1本・戻った問のスキップと × は何も送らない
   ★本物のサーバへは1本も出さない。supabase へ向かう要求は全部ここで横取りして答える（残りは止める）。

   実行: node serve.mjs を上げてから node assert-ask.mjs                  */
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';

const BASE = 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (c, m, got) => { c ? (pass++, console.log(`  ✅ ${m}`))
                              : (fail++, console.log(`  ❌ ${m}  → 実際: ${JSON.stringify(got)}`)); };

const BANK = JSON.parse(readFileSync(new URL('./pv-conditions.json', import.meta.url), 'utf8'));
const BY = Object.fromEntries(BANK.questions.map((q) => [q.id, q]));
/* 3つの形を1問ずつ（ASK に在る質問から。打ち込まない） */
const Q_CHOICE = 'days_off_request', Q_NUM = 'roster_lead_days', Q_MULTI = 'commuting_transport_method';
for (const id of [Q_CHOICE, Q_NUM, Q_MULTI]) if (!BY[id]) { console.log(`❌ 質問 ${id} が無い`); process.exit(1); }

const signedInAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const token = JSON.stringify({
  access_token: 'test-token', expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: '00000000-0000-4000-8000-000000000001', last_sign_in_at: signedInAt } });
const GAVE = {   // 給与を出した会員（Give & Get の板は出ない）
  pv_user: JSON.stringify({ id: 'u-test', email: 'pilot@example.com', name: 'test' }),
  'sb-test-auth-token': token,
  pv_salary_unlock_expiry: String(Date.now() + 30 * 86400 * 1000)
};
const BARE = { pv_user: GAVE.pv_user, 'sb-test-auth-token': token };   // 登録だけ（Give & Get の板が出る）

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });

/* ── 偽のサーバ ── */
let server = {};
const REAL = [];   // 答えを用意していない supabase への要求（全部の場面を通して）
const reset = (o = {}) => {
  server = { calls: [], submits: [], seen: 0,
             next: o.next || { ok: true, due: true, airline: 'jal', name_ja: 'JAL', name_en: 'Japan Airlines',
                               questions: [{ id: Q_CHOICE, kind: 'choice', mine_code: null },
                                           { id: Q_NUM, kind: 'num', mine_code: null },
                                           { id: Q_MULTI, kind: 'multi', mine_code: null }] } };
};
reset();
await page.setRequestInterception(true);
page.on('request', (req) => {
  const u = req.url();
  if (!/supabase\.(co|in)\//.test(u)) { req.continue(); return; }
  const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
  const name = m ? m[1] : '';
  let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch {}
  const say = (v) => req.respond({ status: 200, contentType: 'application/json',
                                   headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(v) });
  if (req.method() === 'OPTIONS') { req.respond({ status: 204, headers: {
    'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' } }); return; }
  server.calls.push(name);
  if (name === 'pv_ask_next') {
    const p = body.p || {};
    if (!p.cont) return say(server.next);
    const not = new Set(p.not || []);
    const rest = server.next.questions.filter((q) => !not.has(q.id)).slice(0, p.limit || 3);
    return say(rest.length ? { ...server.next, questions: rest } : { ok: true, due: false, why: 'done' });
  }
  if (name === 'pv_ask_seen') { server.seen++; return say({ ok: true, next_at: new Date(Date.now() + 48 * 3600e3).toISOString() }); }
  if (name === 'submit_airline_conditions') { server.submits.push(body.p); return say({ ok: true, saved: 1 }); }
  if (name === 'pv_proof_state') return say({ state: 'none' });
  REAL.push(u);          // 答えを用意していない要求は止める（本物へは出さない）
  req.abort();
});

async function visit(url, state, keep = false) {
  if (!keep) {
    await page.goto(BASE + '/world-airlines.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((st) => {
      localStorage.clear(); sessionStorage.clear();
      Object.keys(st).forEach((k) => localStorage.setItem(k, st[k]));
    }, state);
    server.calls = []; server.submits = []; server.seen = 0;
  }
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
}
const loaded = () => page.evaluate(() => document.querySelectorAll('script[src*="pv-conditions.js"]').length);
/* 「聞きに行かない」は、聞きに行く道が終わるまで待ってから数える（ASK_DELAY ＋ 余裕）。条件待ちにできない「起きない」ことの確認 */
const settle = () => new Promise((r) => setTimeout(r, 2600));
const board = () => page.waitForSelector('[data-pvc] .pvc-modal', { timeout: 8000 }).then(() => true, () => false);
const text = (sel) => page.$eval(sel, (el) => el.textContent.trim()).catch(() => null);

console.log('\n════ ① 出さないと決まった人の通信を増やさない ════');
await visit('/world-airlines.html', {});
await settle();
ok(await loaded() === 0 && !server.calls.length, '未ログイン → 読み込みもしない・サーバにも聞かない', [await loaded(), server.calls]);

/* 端末の写しの「ログインの印」は pv-session.js が作る値をそのまま使う（形を写さない） */
await visit('/contact.html', GAVE);
await page.evaluate(() => localStorage.setItem('pv_ask',
  JSON.stringify({ s: String(window.PVSession.sessionStart()), n: Date.now() + 3600e3 })));
server.calls = [];
await visit('/world-airlines.html', null, true);
await settle();
ok(await loaded() === 0 && !server.calls.includes('pv_ask_next'), '48時間の窓の中（端末の写し）→ 読み込みもしない', [await loaded(), server.calls]);

console.log('\n════ ② 出さない画面・ほかの板 ════');
await visit('/contact.html', GAVE);
await settle();
ok(!server.calls.includes('pv_ask_next'), '連絡先の画面では聞かない', server.calls);
await visit('/world-airlines.html', BARE);
await settle();
ok(!server.calls.includes('pv_ask_next'), 'Give & Get の板が出るページでは聞かない（同じページに板は1枚）', server.calls);

console.log('\n════ ③④ 板・3つの形・1問ごとの保存 ════');
reset();
await visit('/world-airlines.html', GAVE);
ok(await board(), '給与を出した会員 → 板が出る');
const head = await text('#pvc-eyebrow');
ok(!!head && /.+のこと、ひとつ教えて。$/.test(head) && !head.startsWith('あなたの会社'), `見出し「${head}」`, head);
ok(await page.$eval('.pvc-modal', (el) => el.getAttribute('role') === 'dialog' && el.getAttribute('aria-modal') === 'true'), 'role=dialog・aria-modal');
ok(await text('.pvc-step') === '1 / 3', '「1 / 3」', await text('.pvc-step'));
await page.waitForFunction(() => true);
ok(server.seen === 1, '板を開いたら pv_ask_seen を1回', server.seen);

// 1問目：1つ選ぶ
const c0 = BY[Q_CHOICE].choices[0].code;
await page.click(`.pvc-opt[data-code="${c0}"]`);
await page.waitForFunction(() => document.querySelector('.pvc-step') && document.querySelector('.pvc-step').textContent.trim() === '2 / 3', { timeout: 5000 }).catch(() => {});
const s1 = server.submits[0];
ok(!!s1 && s1.airline === 'jal' && s1.year == null && s1.month == null
   && J(s1.answers) === J([{ question_id: Q_CHOICE, code: c0 }]), '1問目（1つ選ぶ）をその場で保存・年月は送らない', s1);
function J(v) { return JSON.stringify(v); }

// 2問目：数字
const fs = await page.$eval('.pvc-num', (el) => parseFloat(getComputedStyle(el).fontSize)).catch(() => 0);
ok(fs >= 16, `数字の欄の字は 16px 以上（${fs}px）`, fs);
ok(await page.$eval('[data-next]', (b) => b.disabled), '何も打っていないあいだ「次へ」は押せない');
const max = Number(BY[Q_NUM].num.max);
await page.type('.pvc-num', String(max + 1));
await page.click('[data-next]');
await page.waitForSelector('.pvc-warn', { timeout: 3000 }).catch(() => {});
ok(!!(await text('.pvc-warn')) && server.submits.length === 1, `範囲の外（${max + 1}）は送らず、その場に注意を出す`, [await text('.pvc-warn'), server.submits.length]);
await page.$eval('.pvc-num', (el) => { el.value = ''; });
await page.type('.pvc-num', '20');
await page.keyboard.press('Enter');
await page.waitForFunction(() => document.querySelector('.pvc-step') && document.querySelector('.pvc-step').textContent.trim() === '3 / 3', { timeout: 5000 }).catch(() => {});
ok(J(server.submits[1] && server.submits[1].answers) === J([{ question_id: Q_NUM, num: 20 }]), '2問目（数字 20）を Enter で保存', server.submits[1]);

// 3問目：複数選ぶ
const mc = BY[Q_MULTI].choices.filter((c) => c.code !== 'unknown').slice(0, 2).map((c) => c.code);
ok(await page.$eval('[data-next]', (b) => b.disabled), '何も選んでいないあいだ「次へ」は押せない');
for (const c of mc) await page.click(`.pvc-opt[data-code="${c}"]`);
ok(await page.$$eval('.pvc-opt[aria-pressed="true"]', (a) => a.length) === 2, '選んだ2つに印（aria-pressed）');
await page.click('[data-next]');
await page.waitForSelector('.pvc-done', { timeout: 5000 }).catch(() => {});
ok(J(server.submits[2] && server.submits[2].answers) === J([{ question_id: Q_MULTI, codes: mc }]), '3問目（複数選ぶ）を2つまとめて保存', server.submits[2]);
ok(!!(await text('.pvc-done')), '3問で終わり、お礼を出す（4問目を出さない）', server.submits.length);
await page.waitForFunction(() => !document.querySelector('[data-pvc]'), { timeout: 6000 }).catch(() => {});
ok(!(await page.$('[data-pvc]')), 'お礼のあと、板は静かに閉じる');
const rec = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('pv_ask')); } catch { return null; } });
const hrs = rec && (rec.n - Date.now()) / 3600e3;
ok(!!rec && hrs > 47 && hrs <= 48.1, `次に聞きに行くのは約48時間後（${hrs && hrs.toFixed(2)} 時間）`, rec);
ok(server.calls.filter((c) => c === 'pv_ask_seen').length === 1, '1回の板で pv_ask_seen は1回だけ', server.calls);

server.calls = [];
await visit('/en/world-airlines.html', null, true);
await settle();
ok(!server.calls.includes('pv_ask_next') && await loaded() === 0, '次のページでは聞きに行かない（読み込みもしない）', [server.calls, await loaded()]);

console.log('\n════ ⑤ × で閉じる ════');
reset();
await visit('/world-airlines.html', GAVE);
await board();
await page.click('.pvc-x');
await page.waitForFunction(() => !document.querySelector('[data-pvc]'), { timeout: 3000 }).catch(() => {});
await page.waitForFunction(() => true);
await new Promise((r) => setTimeout(r, 300));
ok(!(await page.$('[data-pvc]')), '× で閉じる');
ok(server.submits.length === 1 && J(server.submits[0].answers) === J([{ question_id: Q_CHOICE, skip: true }]),
   '見せていた1問だけスキップとして残す（残りは何も残さない）', server.submits);
const rec2 = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('pv_ask')); } catch { return null; } });
ok(!!rec2 && rec2.n > Date.now() + 47 * 3600e3, '閉じても次は2日後', rec2);

console.log('\n════ ⑥ サーバが「まだ」と言ったら ════');
const later = new Date(Date.now() + 20 * 3600e3).toISOString();
reset({ next: { ok: true, due: false, why: 'wait', next_at: later } });
await visit('/world-airlines.html', GAVE);
await settle();
ok(!(await page.$('[data-pvc]')) && server.seen === 0, '板を出さない・pv_ask_seen を呼ばない', server);
const rec3 = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('pv_ask')); } catch { return null; } });
ok(!!rec3 && Math.abs(rec3.n - Date.parse(later)) < 2000, 'サーバの言う時刻まで、この端末から聞きに行かない', rec3);

console.log('\n════ ⑦ 額（通貨つき）── 着陸手当の額・日当（2026-10-30） ════');
{
  const Q_AMT = 'landing_pay_amount', Q_AMT2 = 'per_diem_domestic', Q_GD = 'ground_duty_pay';
  for (const id of [Q_AMT, Q_AMT2, Q_GD]) if (!BY[id]) ok(false, `質問 ${id} が無い`);
  reset({ next: { ok: true, due: true, airline: 'jal', name_ja: 'JAL', name_en: 'Japan Airlines',
                  questions: [{ id: Q_AMT, kind: 'num', mine_code: null }, { id: Q_AMT2, kind: 'num', mine_code: null },
                              { id: Q_GD, kind: 'choice', mine_code: null }] } });
  await visit('/world-airlines.html', GAVE);
  ok(await board(), '額の質問でも板が出る（通貨の一覧が読めた）');
  const nCur = JSON.parse(readFileSync(new URL('./pv-vocab.json', import.meta.url), 'utf8')).currencies.length;
  const cur0 = await page.$eval('.pvc-cur', (el) => ({ v: el.value, first: el.options[0].textContent, n: el.options.length,
                                                      fs: parseFloat(getComputedStyle(el).fontSize) })).catch(() => null);
  ok(!!cur0 && cur0.v === '' && cur0.first === '通貨を選ぶ' && cur0.n === nCur + 1,
     `通貨を選ぶ欄が空で出る（勝手に通貨を付けない）・選択肢は ${nCur} 通貨`, cur0);
  ok(!!cur0 && cur0.fs >= 16, `通貨の欄の字は 16px 以上（${cur0 && cur0.fs}px）`, cur0);
  await page.type('.pvc-num', '1500');
  await page.click('[data-next]');
  await page.waitForSelector('.pvc-warn', { timeout: 3000 }).catch(() => {});
  ok(/通貨を選んでください/.test(await text('.pvc-warn') || '') && server.submits.length === 0,
     '通貨を選ばずに「次へ」→ 送らずに「通貨を選んでください。」', [await text('.pvc-warn'), server.submits.length]);
  await page.select('.pvc-cur', 'JPY');
  await page.click('[data-next]');
  await page.waitForFunction(() => document.querySelector('.pvc-step') && document.querySelector('.pvc-step').textContent.trim() === '2 / 3', { timeout: 5000 }).catch(() => {});
  ok(J(server.submits[0] && server.submits[0].answers) === J([{ question_id: Q_AMT, num: 1500, currency: 'JPY' }]),
     '額と選んだ通貨をいっしょに保存（1500 JPY）', server.submits[0]);
  ok(await page.$eval('.pvc-cur', (el) => el.value).catch(() => null) === 'JPY', '同じ板の次の額は、さっき本人が選んだ通貨（JPY）で出る');
  await page.type('.pvc-num', '3000.5');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.pvc-step') && document.querySelector('.pvc-step').textContent.trim() === '3 / 3', { timeout: 5000 }).catch(() => {});
  ok(J(server.submits[1] && server.submits[1].answers) === J([{ question_id: Q_AMT2, num: 3000.5, currency: 'JPY' }]),
     '小数の額（3000.5 JPY）も保存', server.submits[1]);
  const help = await text('.pvc-help');
  ok(help === BY[Q_GD].ja.askHelp && !/補足/.test(help || ''), 'この板に無い「補足」を説明で言わない（askHelp を出す）', help);
  await page.keyboard.press('Escape');
}

console.log('\n════ ⑧ 続きの質問は複数選ぶ＋「その他」の欄（2026-11-16 オーナー承認） ════');
{
  /* 「いくつも当てはまるときは何を選べばいい？」「自分で答えを書けるその他が欲しい」。
     欄は「その他」を選んだときだけ出る・外したら消えて空になる・字は「次へ」で答えと一緒に送る（その他を外したら送らない）。 */
  const Q_D1 = 'days_off_request_partial', Q_D2 = 'days_off_request_split';
  for (const id of [Q_D1, Q_D2]) if (!BY[id]) ok(false, `質問 ${id} が無い`);
  ok([Q_D1, Q_D2].every((id) => BY[id].kind === 'multi' && BY[id].otherText === true
       && BY[id].choices.at(-1).code === 'other' && !BY[id].choices.some((c) => c.code === 'mixed' || c.code === 'unknown')),
     '続きの2問は複数選ぶ・最後が「その他」・「いくつか当てはまる・その他」と「わからない」は選択肢に無い（わからないは板が足す）',
     [Q_D1, Q_D2].map((id) => [BY[id].kind, BY[id].choices.map((c) => c.code)]));
  reset({ next: { ok: true, due: true, airline: 'jal', name_ja: 'JAL', name_en: 'Japan Airlines',
                  questions: [{ id: Q_D1, kind: 'multi', mine_code: null }, { id: Q_D2, kind: 'multi', mine_code: null }] } });
  await visit('/world-airlines.html', GAVE);
  ok(await board(), '続きの質問でも板が出る');
  const box = () => page.$eval('[data-other]', (el) => ({ shown: !el.hidden && getComputedStyle(el).display !== 'none',
    v: el.value, max: el.maxLength, ph: el.placeholder, fs: parseFloat(getComputedStyle(el).fontSize) })).catch(() => null);
  const opts = await page.$$eval('.pvc-opt', (a) => a.map((b) => b.getAttribute('data-code')));
  ok(opts.includes('other') && opts.includes('unknown') && !opts.includes('mixed'), '板に「その他」と「わからない」が在り、mixed は無い', opts);
  let b = await box();
  ok(!!b && !b.shown, '「その他」を選ぶまで、その他の欄は出ない', b);
  const d0 = BY[Q_D1].choices[0].code;
  await page.click(`.pvc-opt[data-code="${d0}"]`);
  ok(!(await box()).shown, 'ほかの答えを選んでも出ない', await box());
  await page.click('.pvc-opt[data-code="other"]');
  b = await box();
  ok(!!b && b.shown && b.max === 100 && b.fs >= 16 && b.ph === 'その他の内容',
     `「その他」を選ぶと1行の欄が出る（100字まで・字は ${b && b.fs}px・薄い字「その他の内容」）`, b);
  await page.type('[data-other]', '消える字');
  await page.click('.pvc-opt[data-code="other"]');
  b = await box();
  ok(!!b && !b.shown && b.v === '', '「その他」を外すと欄が消えて空になる', b);
  await page.click('.pvc-opt[data-code="other"]');
  await page.type('[data-other]', '検査用のその他の字');
  await page.click('[data-next]');
  await page.waitForFunction(() => document.querySelector('.pvc-step') && document.querySelector('.pvc-step').textContent.trim() === '2 / 2', { timeout: 5000 }).catch(() => {});
  ok(J(server.submits[0] && server.submits[0].answers) === J([{ question_id: Q_D1, codes: [d0, 'other'], text: '検査用のその他の字' }]),
     '「次へ」で、選んだ答えとその他の字をいっしょに保存（{ codes:[…, "other"], text }）', server.submits[0]);
  // 2問目：その他に書いてから外す → 字は送らない
  const e0 = BY[Q_D2].choices[0].code;
  await page.click(`.pvc-opt[data-code="${e0}"]`);
  await page.click('.pvc-opt[data-code="other"]');
  await page.type('[data-other]', '送らない字');
  await page.click('.pvc-opt[data-code="other"]');
  await page.click('[data-next]');
  await page.waitForSelector('.pvc-done', { timeout: 5000 }).catch(() => {});
  ok(J(server.submits[1] && server.submits[1].answers) === J([{ question_id: Q_D2, codes: [e0] }]),
     '「その他」を外したら、書いていた字は送らない', server.submits[1]);
  await page.keyboard.press('Escape');
}

console.log('\n════ ⑨ 「← 前の質問」（2026-11-17 オーナー指示「前の質問に戻れるように」） ════');
{
  /* 見ること:
       ・1問目には無い／2問目から下の段の左に在る（スマホの幅で、前の質問・「2 / 3」・今回はスキップが1行・押せる高さ）
       ・戻ると、前に保存した答えを選んだ形で出す（1つ選ぶ＝その札・数字＝数と通貨・複数＝選んだ札とその他の字）。
         再確認（今も同じ？）の問へ戻ったときは、普通の選択肢で出す
       ・選び直すと、上書きの保存が1本だけ出る。同じ答えならサーバに残りを聞き直さない／違う答えなら聞き直す（子が付いてくる）
       ・戻った問の「今回はスキップ」と × は何も送らない（答えを消さない・スキップの印も付けない）
       ・答え直しを「答えた」に二重に数えない（計測の condition_answered）
     ⚠️ 計測は板が出たあとで window.gtag を差し替えて数える（本物の解析へは出さない）。 */
  const stepIs = (s) => page.waitForFunction((s) => { const e = document.querySelector('.pvc-step'); return e && e.textContent.trim() === s; },
    { timeout: 5000 }, s).then(() => true, () => false);
  const qText = () => text('.pvc-q');
  const picked = () => page.$$eval('.pvc-opt.is-picked', (a) => a.map((b) => b.getAttribute('data-code')));
  const asks = () => server.calls.filter((c) => c === 'pv_ask_next').length;
  const spy = () => page.evaluate(() => { window.__ev = []; window.gtag = function (k, name) { if (k === 'event') window.__ev.push(name); }; });
  const evs = (name) => page.evaluate((n) => (window.__ev || []).filter((x) => x === n).length, name);
  const c1 = BY[Q_CHOICE].choices[0].code, c2 = BY[Q_CHOICE].choices[2].code;
  /* 1問目は前回の答え（c1）が在る ＝ 再確認の形で出る */
  reset({ next: { ok: true, due: true, airline: 'jal', name_ja: 'JAL', name_en: 'Japan Airlines',
                  questions: [{ id: Q_CHOICE, kind: 'choice', mine_code: c1 },
                              { id: Q_NUM, kind: 'num', mine_code: null },
                              { id: Q_MULTI, kind: 'multi', mine_code: null }] } });
  await visit('/world-airlines.html', GAVE);
  ok(await board(), '板が出る');
  await spy();
  ok(!(await page.$('.pvc-prevq')) && !!(await page.$('.pvc-opt[data-code="__same"]')),
     '1問目には「← 前の質問」が無い（前回の答えが在る問は、再確認の形）');
  await page.click('.pvc-opt[data-code="__same"]');
  ok(await stepIs('2 / 3'), '「変わっていない」で保存して2問目へ');
  ok(J(server.submits.at(-1).answers) === J([{ question_id: Q_CHOICE, code: c1 }]), '   保存したのは前回と同じ答え', server.submits.at(-1));
  ok(await text('.pvc-prevq') === '← 前の質問', '2問目には「← 前の質問」が在る', await text('.pvc-prevq'));
  /* 下の段：左＝前の質問・真ん中＝「2 / 3」・右＝スキップ が1行に・はみ出さない・押せる高さ（390 と 360） */
  const foot = () => page.$eval('.pvc-foot', (f) => {
    const kids = [...f.children].map((c) => ({ c: c.className, r: c.getBoundingClientRect() }));
    const mid = (r) => r.top + r.height / 2;
    const fr = f.getBoundingClientRect();
    return { n: kids.length, line: kids.every((k) => Math.abs(mid(k.r) - mid(kids[0].r)) < 2),
             order: kids[0].c === 'pvc-prevq' && kids[1].c === 'pvc-step' && kids[2].c === 'pvc-skip'
                    && kids[0].r.right <= kids[1].r.left && kids[1].r.right <= kids[2].r.left,
             inside: kids.every((k) => k.r.left >= fr.left - 0.5 && k.r.right <= fr.right + 0.5) && f.scrollWidth <= f.clientWidth,
             tall: Math.round(Math.min(kids[0].r.height, kids[2].r.height)), w: Math.round(fr.width) };
  });
  for (const w of [390, 360]) {
    await page.setViewport({ width: w, height: 844 });
    await new Promise((r) => setTimeout(r, 150));
    const f = await foot();
    ok(f.n === 3 && f.line && f.order && f.inside && f.tall >= 44,
       `   ${w}px：前の質問・「2 / 3」・今回はスキップ が1行に収まる（左・真ん中・右・はみ出さない・押せる高さ ${f.tall}px）`, f);
  }
  await page.setViewport({ width: 390, height: 844 });
  await page.type('.pvc-num', '20');
  await page.keyboard.press('Enter');
  ok(await stepIs('3 / 3'), '2問目（数字 20）を保存して3問目へ');
  const nSave = server.submits.length;
  await page.click('.pvc-prevq');
  ok(await stepIs('2 / 3'), '「← 前の質問」で2問目へ戻る');
  ok(await page.$eval('.pvc-num', (el) => el.value) === '20' && !(await page.$eval('[data-next]', (b) => b.disabled)),
     '   戻った数字の問は、保存した数（20）が入った形・「次へ」が押せる');
  await page.click('.pvc-prevq');
  ok(await stepIs('1 / 3'), 'もう一度押すと1問目へ戻る');
  ok(!(await page.$('.pvc-prevq')) && !(await page.$('.pvc-opt[data-code="__same"]')) && await qText() === BY[Q_CHOICE].ja.label
     && J(await picked()) === J([c1]),
     '   戻った1問目は、再確認ではなく普通の選択肢で、保存した答えの札に印（前の質問は無い）', [await qText(), await picked()]);
  ok(server.submits.length === nSave, '   戻るだけでは何も送らない', server.submits.length - nSave);
  const a0 = asks();
  await page.click(`.pvc-opt[data-code="${c1}"]`);
  ok(await stepIs('2 / 3'), '同じ答えで選び直す → 次へ進む');
  ok(server.submits.length === nSave + 1 && J(server.submits.at(-1).answers) === J([{ question_id: Q_CHOICE, code: c1 }]),
     '   ★上書きの保存が1本だけ出る', server.submits.slice(nSave));
  ok(asks() === a0, '   同じ答えなら、残りをサーバに聞き直さない（さっきの続きのまま）', asks() - a0);
  ok(await page.$eval('.pvc-num', (el) => el.value) === '20', '   続きの2問目は、保存した数のまま');
  await page.click('.pvc-skip');
  ok(await stepIs('3 / 3'), '戻った問の「今回はスキップ」→ 次へ進む');
  ok(server.submits.length === nSave + 1, '   ★戻った・答えてある問のスキップは何も送らない（スキップの印も付けない）', server.submits.slice(nSave + 1));
  await page.click('.pvc-prevq'); await stepIs('2 / 3');
  await page.click('.pvc-prevq'); await stepIs('1 / 3');
  const a1 = asks();
  await page.click(`.pvc-opt[data-code="${c2}"]`);
  ok(await stepIs('2 / 3'), '違う答えで選び直す → 次へ進む');
  ok(server.submits.length === nSave + 2 && J(server.submits.at(-1).answers) === J([{ question_id: Q_CHOICE, code: c2 }]),
     '   ★上書きの保存が1本だけ（新しい答え）', server.submits.slice(nSave + 1));
  ok(asks() === a1 + 1, '   違う答えなら、残りをサーバに聞き直す（親の答えが変わると子の質問も変わる）', asks() - a1);
  await page.$eval('.pvc-num', (el) => { el.value = ''; });
  await page.type('.pvc-num', '25');
  await page.keyboard.press('Enter');
  ok(await stepIs('3 / 3') && J(server.submits.at(-1).answers) === J([{ question_id: Q_NUM, num: 25 }]) && server.submits.length === nSave + 3,
     '戻った数字の問を 25 に直す → 上書きの保存が1本', server.submits.slice(nSave + 2));
  const mc2 = BY[Q_MULTI].choices.filter((c) => c.code !== 'unknown').slice(0, 1).map((c) => c.code);
  for (const c of mc2) await page.click(`.pvc-opt[data-code="${c}"]`);
  await page.click('[data-next]');
  await page.waitForSelector('.pvc-done', { timeout: 5000 }).catch(() => {});
  ok(!!(await text('.pvc-done')), '3問目を答えて、お礼で終わる');
  ok(await evs('condition_answered') === 3 && await evs('condition_skipped') === 0 && await evs('condition_reconfirmed') === 1,
     '★答え直しを二重に数えない（「答えた」は3問で3回・戻った問のスキップは「飛ばした」に数えない）',
     [await evs('condition_answered'), await evs('condition_skipped'), await evs('condition_reconfirmed')]);
  await page.waitForFunction(() => !document.querySelector('[data-pvc]'), { timeout: 6000 }).catch(() => {});

  /* 複数選ぶ（その他の字）と、額（通貨つき）へ戻る。× は戻った問では何も送らない */
  const Q_D1 = 'days_off_request_partial', Q_AMT = 'landing_pay_amount';
  reset({ next: { ok: true, due: true, airline: 'jal', name_ja: 'JAL', name_en: 'Japan Airlines',
                  questions: [{ id: Q_D1, kind: 'multi', mine_code: null }, { id: Q_AMT, kind: 'num', mine_code: null },
                              { id: Q_CHOICE, kind: 'choice', mine_code: null }] } });
  await visit('/world-airlines.html', GAVE);
  ok(await board(), '板が出る（複数選ぶ・額）');
  const d0 = BY[Q_D1].choices[0].code;
  await page.click(`.pvc-opt[data-code="${d0}"]`);
  await page.click('.pvc-opt[data-code="other"]');
  await page.type('[data-other]', '戻っても残る字');
  await page.click('[data-next]');
  ok(await stepIs('2 / 3'), '複数選ぶ（その他の字つき）を保存して2問目へ');
  await page.type('.pvc-num', '1500');
  await page.select('.pvc-cur', 'JPY');
  await page.click('[data-next]');
  ok(await stepIs('3 / 3'), '額（1500 JPY）を保存して3問目へ');
  const nS = server.submits.length;
  await page.click('.pvc-prevq');
  await stepIs('2 / 3');
  const amt = await page.evaluate(() => ({ v: document.querySelector('.pvc-num').value, c: document.querySelector('.pvc-cur').value }));
  ok(amt.v === '1500' && amt.c === 'JPY', '   戻った額の問は、保存した額と通貨（1500 JPY）が入った形', amt);
  await page.click('.pvc-prevq');
  await stepIs('1 / 3');
  const mv = await page.evaluate(() => {
    const o = document.querySelector('[data-other]');
    return { on: [...document.querySelectorAll('.pvc-opt[aria-pressed="true"]')].map((b) => b.getAttribute('data-code')),
             other: o && !o.hidden ? o.value : null, next: !document.querySelector('[data-next]').disabled };
  });
  ok(J(mv.on) === J([d0, 'other']) && mv.other === '戻っても残る字' && mv.next,
     '   戻った複数選ぶの問は、選んだ札とその他の字が入った形・「次へ」が押せる', mv);
  await page.click('.pvc-x');
  await page.waitForFunction(() => !document.querySelector('[data-pvc]'), { timeout: 3000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  ok(server.submits.length === nS, '★戻った・答えてある問で × → 何も送らない（スキップの印を付けない）', server.submits.slice(nS));
}

console.log('\n════ 英語 ════');
reset();
await visit('/en/world-airlines.html', GAVE);
ok(await board(), '英語のページでも出る');
const headEn = await text('#pvc-eyebrow');
ok(!!headEn && /^Tell us one thing about .+\.$/.test(headEn) && !/your airline/.test(headEn), `見出し「${headEn}」`, headEn);
/* 「← 前の質問」の字と、いちばん狭い幅（360px）で下の段が1行に収まるか ── 英語とスペイン語は日本語より字が長い */
const footFits = () => page.$eval('.pvc-foot', (f) => {
  const r = [...f.children].map((c) => c.getBoundingClientRect());
  const mid = (x) => x.top + x.height / 2;
  return r.length === 3 && r.every((x) => Math.abs(mid(x) - mid(r[0])) < 2) && r[0].right <= r[1].left && r[1].right <= r[2].left
    && f.scrollWidth <= f.clientWidth;
});
const toQ2 = async () => {
  await page.click(`.pvc-opt[data-code="${BY[Q_CHOICE].choices[0].code}"]`);
  return page.waitForFunction(() => { const e = document.querySelector('.pvc-step'); return e && e.textContent.trim() === '2 / 3'; },
    { timeout: 5000 }).then(() => true, () => false);
};
await page.setViewport({ width: 360, height: 780 });
ok(await toQ2() && await text('.pvc-prevq') === '← Previous question' && await footFits(),
   '英語：2問目に「← Previous question」・360px で下の段が1行', await text('.pvc-prevq'));
await page.keyboard.press('Escape');
reset();
await visit('/es/world-airlines.html', GAVE);
ok(await board(), 'スペイン語のページでも出る');
ok(await toQ2() && await text('.pvc-prevq') === '← Anterior' && await footFits(),
   'スペイン語：2問目に「← Anterior」・360px で下の段が1行', await text('.pvc-prevq'));
await page.keyboard.press('Escape');
await page.setViewport({ width: 390, height: 844 });

console.log('\n════ 本物のサーバ ════');
ok(!REAL.length, '答えを用意していない supabase への要求が1本も無い（本物へは出していない）', REAL);

await browser.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
