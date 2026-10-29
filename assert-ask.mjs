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

console.log('\n════ 英語 ════');
reset();
await visit('/en/world-airlines.html', GAVE);
ok(await board(), '英語のページでも出る');
const headEn = await text('#pvc-eyebrow');
ok(!!headEn && /^Tell us one thing about .+\.$/.test(headEn) && !/your airline/.test(headEn), `見出し「${headEn}」`, headEn);
await page.keyboard.press('Escape');

console.log('\n════ 本物のサーバ ════');
ok(!REAL.length, '答えを用意していない supabase への要求が1本も無い（本物へは出していない）', REAL);

await browser.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
