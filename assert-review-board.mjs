/* 口コミを1項目ずつ聞く板（pv-review-board.js・2026-11-20）── 画面の通し。

   オーナー決定「書いた項目は、全社ぶん読める。7項目書けば全部読める。」
   誰に・いつ・どの会社か・何が読めるかはサーバが決める（db/test-review-items.mjs が見ている）。
   ここで見るのは、画面が約束どおりに動くことだけ:
     ① 出さないと決まった人の通信を増やさない ── 未ログイン・出さない画面（口コミのフォームなど）では読み込みもしない
     ② 給与を出した会員には会社を聞かない（給与の会社の「給与」から始まる）。会社が分からない会員にだけ会社と職位を聞く
     ③ 40字に届くまで送れない・送ると1項目だけ保存・「← 前の質問」「今回はスキップ」・書きかけは端末に残る
     ④ 板を開いたら pv_review_board_seen を1回だけ。次に聞いてよい時刻（7日後）が端末に残り、次のページでは聞かない
     ⑤ Vote：書きかけの会員には7つのマスと「続きを書く」。書いた項目は他社の口コミも全文、書いていない項目は
        「書くと読めます」── ★書いていない項目の本文は、どの通信にも画面にも1文字も来ない
     ⑥ 自分で押して開いた板は7日を待たない・pv_review_board_seen を呼ばない／英語・スペイン語で日本語が混ざらない
     ⑦ フォームで全部出した会員には板を出さない（Vote も今までどおり全部読める）
   ★本番には一切つながらない。手元の使い捨ての DB（serve-local.mjs）を自分のポートで立てる。

   実行: node assert-review-board.mjs                                                    */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { createHash } from 'node:crypto';
import puppeteer from 'puppeteer';
import { start } from './serve-local.mjs';

let pass = 0, fail = 0;
const ok = (c, m, got) => { c ? (pass++, console.log(`  ✅ ${m}`))
                              : (fail++, console.log(`  ❌ ${m}  → 実際: ${JSON.stringify(got)}`)); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const H = (x) => createHash('sha256').update(x).digest('hex');

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-rvb-'));
const srv = await start({ port: 0, dir: DIR, quiet: true, reviewBoard: true });
const BASE = srv.url, db = srv.db;
const UID = { a: '00000000-0000-4000-8000-0000000000a1', b: '00000000-0000-4000-8000-0000000000b2',
              pay: '00000000-0000-4000-8000-0000000000d4' };

/* ── ほかの人の口コミ（フォームで出した形・作り物）。項目ごとに末尾へ印を付け、どの本文が届いたかを見る ── */
const CATS = ['culture', 'salary', 'benefits', 'wlb', 'ops', 'training', 'mgmt'];
/* 印は80字より後ろ（鍵の無い人にも見せる先頭80字の抜粋に、印が入らないように） */
const body = (cat, mark) => `${cat} について。乗務の組み方と手当の付き方を書いた作り物の文です。実在の投稿ではありません。`
  + `勤務表の出る時期や休みの取りやすさ、手当の付き方など、項目ごとに違うことを書いています。${mark}`;
const MARK = (air, cat) => `MK${air.toUpperCase()}${cat.toUpperCase()}ZZ`;
async function otherReview(air, seed) {
  const cols = CATS.map((k) => `${k}_comment`).join(', ');
  await db.query(`insert into public.reviews_v2 (proof_hash, airline, "position", culture_score, salary_score, benefits_score,
       wlb_score, ops_score, training_score, mgmt_score, ${cols}, orig_lang, created_at)
     values ($1, $2, 'fo', 4, 3, 4, 3, 4, 4, 3, ${CATS.map((_, i) => '$' + (i + 3)).join(', ')}, 'ja', now() - interval '3 days')`,
    [H('rvb-' + seed), air, ...CATS.map((k) => body(k, MARK(air, k)))]);
}
await otherReview('jal', 1);
await otherReview('ana', 2);

/* 会員A：フォームで全部出した人（7項目そろった口コミ・書きかけの印なし） */
await db.query(`insert into public.reviews_v2 (proof_hash, airline, "position", culture_score, salary_score, benefits_score,
     wlb_score, ops_score, training_score, mgmt_score, ${CATS.map((k) => k + '_comment').join(', ')}, orig_lang)
   values (public.pv_review_hash($1::uuid, 'skymark'), 'skymark', 'captain', 4, 4, 4, 4, 4, 4, 4,
           ${CATS.map((_, i) => '$' + (i + 2)).join(', ')}, 'ja')`, [UID.a, ...CATS.map((k) => body(k, 'MKMINE' + k))]);

/* 給与提出者：JAL の機長として先月の給与を出した（本物の submit_pay_report を通す） */
{
  const FLEET = (await db.query(`select code from public.pv_fleets where active order by code limit 1`)).rows[0].code;
  const d = new Date(), y = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear(), m = d.getMonth() === 0 ? 12 : d.getMonth();
  await db.query(`select set_config('pv.uid', $1, false)`, [UID.pay]);
  const r = (await db.query(`select public.submit_pay_report($1::jsonb) v`, [JSON.stringify({
    currency: 'JPY', lang: 'ja', tax_rate_pct: 20, position: 'cap', fleet: FLEET, airline: 'jal', period_year: y, period_month: m,
    base_pay: 900000, flight_variable_pay: 300000, other_allowance: 50000 })])).rows[0].v;
  await db.query(`select set_config('pv.uid', '', false)`);
  if (!r || r.ok !== true) { console.log('❌（準備が崩れた）給与を出せなかった', r); process.exit(1); }
}

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

/* 通信を数える（手元のサーバーへの rpc だけ）。届いた中身も取っておき、読めないはずの本文が来ていないかを見る */
let calls = [], bodies = [];
page.on('request', (req) => { const m = req.url().match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/); if (m && req.method() === 'POST') calls.push(m[1]); });
page.on('response', async (res) => {
  if (!/\/rest\/v1\/(rpc\/|reviews_v2)/.test(res.url())) return;
  try { bodies.push(await res.text()); } catch { /* 移った後の応答は読めない */ }
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const SESS = {};
for (const k of ['a', 'b', 'pay']) SESS[k] = await (await fetch(`${BASE}/__local/login?member=${k}`)).json();
/* ログインした状態で開く（端末を空にしてから入れ直す）。Give & Get の板はさっき見た扱い（この検査の外）。 */
async function as(member, url, extra = {}) {
  await page.goto(BASE + '/contact.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate((s, extra) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('pv_local_ui', '0');
    if (s) {
      const now = String(Date.now());
      localStorage.setItem('sb-local-auth-token', JSON.stringify(s.session));
      localStorage.setItem('pv_user', JSON.stringify(s.pv_user));
      localStorage.setItem('pv_last_active', now); localStorage.setItem('pv_session_start', now);
      const at = Date.parse((s.session.user || {}).last_sign_in_at || '');
      localStorage.setItem('pv_give_seen', JSON.stringify({ t: Date.now() - 3600e3, s: String(isNaN(at) ? now : at) }));
    }
    Object.keys(extra).forEach((k) => localStorage.setItem(k, extra[k]));
  }, member ? SESS[member] : null, extra);
  calls = []; bodies = [];
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
}
const go = async (url) => { calls = []; bodies = []; await page.goto(BASE + url, { waitUntil: 'domcontentloaded' }); };
const loaded = () => page.evaluate(() => document.querySelectorAll('script[src*="pv-review-board.js"]').length);
/* 「聞きに行かない」は、聞きに行く道が終わるまで待ってから数える（待遇の板の ASK_DELAY ＋ 口コミの板の ASK_DELAY ＋ 余裕） */
const settle = () => wait(4200);
const board = () => page.waitForSelector('[data-pvrb] .pvrb-m', { timeout: 12000 }).then(() => true, () => false);
const text = (sel) => page.$eval(sel, (el) => el.textContent.trim()).catch(() => null);
const rowOf = async (uid, air) => (await db.query(
  `select r.*, exists (select 1 from public.pv_review_partial p where p.rid = r.id) as partial
     from public.reviews_v2 r where r.proof_hash = public.pv_review_hash($1::uuid, $2)`, [uid, air])).rows[0];
const typeIn = async (s) => {
  await page.$eval('.pvrb-ta', (el) => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('.pvrb-ta', s);
};
const RVASK = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('pv_rvask')); } catch { return null; } });

console.log('\n════ ① 出さないと決まった人・画面では、読み込みもしない ════');
await as(null, '/community.html');
await settle();
ok(await loaded() === 0 && !calls.includes('pv_review_board'), '未ログイン → 読み込みもしない・サーバにも聞かない', [await loaded(), calls]);
await as('pay', '/submit-review.html');
await settle();
/* フォームは書きかけを読むために pv_review_board を自分で呼ぶ（manual）。板そのものは読み込まない・窓も始めない */
ok(await loaded() === 0 && !(await page.$('[data-pvrb]')) && !calls.includes('pv_review_board_seen'), '口コミのフォームの画面では板を出さない', [await loaded(), calls]);

console.log('\n════ ② 給与を出した会員には会社を聞かない ════');
await as('pay', '/world-airlines.html');
ok(await board(), '給与を出した会員 → 板が出る');
const head = await text('#pvrb-h');
ok(/日本航空/.test(head || '') && /1項目だけ/.test(head || ''), `見出しに給与の会社（${head}）`, head);
ok(!(await page.$('.pvrb-sel')) && !!(await page.$('.pvrb-ta')), '会社を選ぶ欄は出ない・いきなり書く欄', null);
ok(await text('.pvrb-item') === '給与', '最初の項目は「給与」', await text('.pvrb-item'));
ok(await page.$eval('.pvrb-m', (el) => el.getAttribute('role') === 'dialog' && el.getAttribute('aria-modal') === 'true'), 'role=dialog・aria-modal');
const fz = await page.$eval('.pvrb-ta', (el) => parseFloat(getComputedStyle(el).fontSize));
ok(fz >= 16, `書く欄の字は 16px 以上（${fz}px・iPhone が拡大しない）`, fz);
await page.waitForFunction(() => true);
await wait(400);
ok(calls.filter((c) => c === 'pv_review_board_seen').length === 1, '板を開いたら pv_review_board_seen を1回', calls);
const rv = await RVASK();
const days = rv && (rv.n - Date.now()) / 86400e3;
ok(!!rv && days > 6.9 && days <= 7.01, `次に聞きに行くのは約7日後（${days && days.toFixed(2)} 日）`, rv);

console.log('\n════ ③ 40字・1項目ずつ保存・前の質問・スキップ・書きかけ ════');
const BASE45 = [...'基本給は年次で上がるが乗務手当の比重が大きく、月によって手取りの差が大きいと感じる。夏は多い月もある。'];
const S39 = BASE45.slice(0, 39).join(''), S40 = BASE45.slice(0, 40).join('');
ok([...S39].length === 39 && [...S40].length === 40, '（準備）39字と40字の文');
await page.click('.pvrb-star[data-s="3"]');
await typeIn(S39);
ok(await page.$eval('.pvrb-send', (b) => b.disabled), '39字では「匿名で送る」を押せない');
await typeIn(S40);
ok(await page.$eval('.pvrb-send', (b) => !b.disabled), '40字で押せる');
calls = [];
await page.click('.pvrb-send');
await page.waitForSelector('.pvrb-more', { timeout: 8000 }).catch(() => {});
ok(calls.filter((c) => c === 'submit_review_item').length === 1, '送ると submit_review_item を1回', calls);
const r1 = await rowOf(UID.pay, 'jal');
ok(!!r1 && r1.salary_comment === S40 && r1.salary_score === 3 && r1.partial === true
   && CATS.filter((k) => k !== 'salary').every((k) => r1[k + '_comment'] == null) && r1.position === 'captain',
   '保存されたのは「給与」の1項目だけ（職位は給与の職位・書きかけの印つき）', r1 && { s: r1.salary_comment, p: r1.position, partial: r1.partial });
ok(/給与の口コミ、送りました/.test(await text('#pvrb-h') || '') && await text('.pvrb-step') === '1 / 7', '「給与の口コミ、送りました」「1 / 7」',
   [await text('#pvrb-h'), await text('.pvrb-step')]);

await page.click('.pvrb-more');
await page.waitForSelector('.pvrb-ta', { timeout: 5000 });
ok(await text('.pvrb-item') === 'ワークライフバランス', '続けて次の項目（ワークライフバランス）', await text('.pvrb-item'));
const DRAFT = '勤務表が出るのは月末近く。翌月の予定が立てにくいのが一番の不満。';
await page.click('.pvrb-star[data-s="4"]');
await typeIn(DRAFT);
await wait(500);                                              // 書きかけは打ち終えて 0.3 秒で端末へ
await page.click('.pvrb-prev');
await page.waitForFunction(() => document.querySelector('.pvrb-item') && document.querySelector('.pvrb-item').textContent.trim() === '給与', { timeout: 4000 }).catch(() => {});
ok(await page.$eval('.pvrb-ta', (el) => el.value).catch(() => null) === S40, '「← 前の質問」で給与へ戻ると、送った文が入っている', await page.$eval('.pvrb-ta', (el) => el.value).catch(() => null));
calls = [];
await page.click('.pvrb-skip');
await page.waitForFunction(() => document.querySelector('.pvrb-item') && document.querySelector('.pvrb-item').textContent.trim() !== '給与', { timeout: 4000 }).catch(() => {});
ok(await text('.pvrb-item') === 'ワークライフバランス' && await page.$eval('.pvrb-ta', (el) => el.value) === DRAFT && !!(await text('.pvrb-saved')),
   '「今回はスキップ」で次へ・書きかけの文が戻る（「書きかけを戻しました」）', [await text('.pvrb-item'), await text('.pvrb-saved')]);
await page.click('.pvrb-x');
await page.waitForFunction(() => !document.querySelector('[data-pvrb]'), { timeout: 4000 }).catch(() => {});
ok(!(await page.$('[data-pvrb]')) && !calls.includes('submit_review_item'), '× で閉じる・スキップも × も何も送らない', calls);
const r2 = await rowOf(UID.pay, 'jal');
ok(r2.wlb_comment == null, '書きかけ（送っていない文）はサーバに無い', r2.wlb_comment);

console.log('\n════ ④ 次のページでは聞かない ════');
await go('/en/world-airlines.html');
await settle();
ok(!calls.includes('pv_review_board') && await loaded() === 0, '7日の窓の中 → 読み込みもしない', [calls, await loaded()]);

console.log('\n════ ⑤ Vote：マスと「続きを書く」・書いた項目だけ全社ぶん読める ════');
await go('/community.html');
await page.waitForSelector('#gate-panel.vt-rbg', { timeout: 15000 }).catch(() => {});
ok(!!(await page.$('#gate-panel.vt-rbg')), '書きかけの会員には、7つのマスの枠が出る');
ok(await page.$$eval('#gate-panel .vt-rbg-tile', (a) => a.length) === 7 && await page.$$eval('#gate-panel .vt-rbg-tile.on', (a) => a.length) === 1,
   'マスは7つ・書いた1つに印', await page.$$eval('#gate-panel .vt-rbg-tile.on', (a) => a.map((x) => x.textContent)));
ok(/続きを書く/.test(await text('#gate-panel .vt-rbg-go') || ''), '「続きを書く（約30秒）」', await text('#gate-panel .vt-rbg-go'));
await page.waitForFunction(() => [...document.querySelectorAll('a[data-review]')].some((x) => /日本航空|JAL/.test(x.textContent) && /副操縦士/.test(x.textContent)), { timeout: 15000 }).catch(() => {});
const href = await page.evaluate(() => { const a = [...document.querySelectorAll('a[data-review]')].find((x) => /日本航空|JAL/.test(x.textContent) && /副操縦士/.test(x.textContent)); return a && a.getAttribute('href'); });
ok(!!href, 'ほかの人の JAL の口コミ（副操縦士）が一覧に出る', href);
if (href) {
  await page.evaluate((h) => { location.hash = h.replace(/^.*#/, ''); }, href);
  await page.waitForSelector('#vt-dialog[open] .vt-d-sec', { timeout: 10000 }).catch(() => {});
  await wait(500);
  const dlg = await page.$eval('#vt-dialog', (el) => el.textContent).catch(() => '');
  ok(dlg.includes(MARK('jal', 'salary')), '書いた「給与」は、ほかの人の口コミも全文読める', dlg.slice(0, 120));
  ok(!dlg.includes(MARK('jal', 'wlb')) && /ワークライフバランスを書くと、全社のこの項目が読めます。/.test(dlg) && !!(await page.$('#vt-dialog .vt-rbl-go')),
     '書いていない項目は本文が無く「〇〇を書くと、全社のこの項目が読めます。」＋「書く」', dlg.slice(0, 200));
}
const leaked = CATS.filter((k) => k !== 'salary')
  .flatMap((k) => ['jal', 'ana'].map((a) => MARK(a, k))).filter((mk) => bodies.some((b) => b.includes(mk)));
const html = await page.content();
ok(!leaked.length && !CATS.filter((k) => k !== 'salary').some((k) => html.includes(MARK('jal', k)) || html.includes(MARK('ana', k)))
   && bodies.some((b) => b.includes(MARK('jal', 'salary'))),
   '★書いていない項目の本文は、どの通信にも画面にも来ない', leaked);
await page.keyboard.press('Escape');
await wait(400);

console.log('\n════ ⑥ 自分で押して開く板（7日を待たない）・英語とスペイン語 ════');
await go('/community.html');
await page.waitForSelector('#gate-panel .vt-rbg-go', { timeout: 15000 }).catch(() => {});
calls = [];
await page.click('#gate-panel .vt-rbg-go');
ok(await board(), '「続きを書く」で、7日の窓の中でも板が開く');
ok(await text('.pvrb-item') === 'ワークライフバランス' && await page.$eval('.pvrb-ta', (el) => el.value).catch(() => '') === DRAFT,
   '書きかけの項目から・書きかけの文が戻る', await text('.pvrb-item'));
await wait(300);
ok(!calls.includes('pv_review_board_seen'), '自分で開いた板では pv_review_board_seen を呼ばない（7日の窓を延ばさない）', calls);
await page.click('.pvrb-x');
await wait(400);
for (const [lang, url] of [['en', '/en/community.html'], ['es', '/es/community.html']]) {
  await go(url);
  await page.waitForSelector('#gate-panel .vt-rbg-go', { timeout: 15000 }).catch(() => {});
  await page.click('#gate-panel .vt-rbg-go').catch(() => {});
  const shown = await board();
  const t = await page.$eval('[data-pvrb]', (el) => el.innerText).catch(() => '');
  /* 日本語の字（かな・漢字）が1つも無い ── 社名は英語の社名で出る */
  ok(shown && t.length > 20 && !/[぀-ヿ一-鿿]/.test(t), `${lang}：板に日本語が混ざらない`, t.slice(0, 160));
  const g = await page.$eval('#gate-panel', (el) => el.innerText).catch(() => '');
  ok(g.length > 10 && !/[぀-ヿ一-鿿]/.test(g), `${lang}：Vote の枠に日本語が混ざらない`, g.slice(0, 160));
  await page.click('.pvrb-x').catch(() => {});
}

console.log('\n════ ⑦ 会社が分からない会員・フォームで全部出した会員 ════');
await as('b', '/world-airlines.html');
ok(await board(), '給与も口コミも無い会員 → 板が出る');
ok(!!(await page.$('.pvrb-sel')) && await page.$$eval('.pvrb-pos button', (a) => a.length) === 2 && await page.$eval('.pvrb-next', (b) => b.disabled),
   '会社と職位を聞く（選ぶまで「次へ」は押せない）', null);
await page.click('.pvrb-x').catch(() => {});
await as('a', '/community.html');
await settle();
ok(!(await page.$('[data-pvrb]')) && !(await page.$('#gate-panel.vt-rbg')), 'フォームで全部出した会員 → 板も「続きを書く」の枠も出ない', calls);
await page.waitForFunction(() => [...document.querySelectorAll('a[data-review]')].some((x) => /日本航空|JAL/.test(x.textContent) && /副操縦士/.test(x.textContent)), { timeout: 15000 }).catch(() => {});
const hrefA = await page.evaluate(() => { const a = [...document.querySelectorAll('a[data-review]')].find((x) => /日本航空|JAL/.test(x.textContent) && /副操縦士/.test(x.textContent)); return a && a.getAttribute('href'); });
if (hrefA) {
  await page.evaluate((h) => { location.hash = h.replace(/^.*#/, ''); }, hrefA);
  await page.waitForSelector('#vt-dialog[open] .vt-d-sec', { timeout: 10000 }).catch(() => {});
  await wait(500);
  const dlg = await page.$eval('#vt-dialog', (el) => el.textContent).catch(() => '');
  ok(CATS.every((k) => dlg.includes(MARK('jal', k))) && !(await page.$('#vt-dialog .vt-rbl')), '今までどおり7項目とも全文読める', dlg.slice(0, 120));
} else ok(false, 'JAL の口コミが一覧に出る', null);

ok(!errors.length, 'ページの例外が出ない', errors.slice(0, 3));

await browser.close();
await srv.close?.();
fs.rmSync(DIR, { recursive: true, force: true });
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
