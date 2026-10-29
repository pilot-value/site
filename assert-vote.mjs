#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — assert-vote.mjs（2026-10-29）
   Vote（community.html / en/community.html ・本文は vote.js）が約束を守っているか。

   守っているもの
     A) 見せてよい字だけ ── 鍵の無い人には、本文はサーバーから届かない（項目名と先頭40字だけ）。
        一覧・項目の絞り込み・引き出しのどこからも、それより先の字が出ない。
     B) 数字は正本のまま ── 会社カードの評価は会社ページと同じ realRated()（写しが1文字もずれていない）。
        月の勤務は pv_work_view() の 25〜75% をそのまま・目盛は 0〜240 時間／0〜31 泊で固定。
        値の無い項目は「未取得」で棒を描かない（0 で埋めない）。機長と副操縦士を混ぜない。
        読めなかったときは「読み出せません」で、「0件」と言わない。
     C) 並びは閲覧数 ── よく見られている会社は vote-popular.json の順（評価順・件数順で代用しない）。
        ファイルに閲覧数そのものを書かない。
     D) 動き（1本だけ）── 口コミを押す → 引き出し → Esc／×／戻るで閉じる。閉じても履歴を増やさない・
        押したカードへフォーカスが戻る・カルーセルの位置もスクロールもそのまま。
     E) 行き先 ── 会社カードは既存の会社ページ #reviews / #work。投稿フォームへは本当の slug
        （旧コード singapore → singapore-airlines）。

   使うもの：serve-local.mjs を**使い捨ての保存先**で立てる（本番には1回も触らない・作り物の口コミは
   ここで入れて、終わったら保存先ごと消す）。ポートは OS が選ぶ（3000 番は使わない）。
   ════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { start, MEMBERS } from './serve-local.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
function ok(c, msg, detail) {
  if (c) { pass++; console.log('  ✅ ' + msg); }
  else { fail++; console.log('  ❌ ' + msg + (detail ? '\n       → ' + detail : '')); }
}
const J = (x) => JSON.stringify(x);

/* ═══ 1. ファイルだけで分かること ═══ */
console.log('\n════ 1. ファイル ════');
const VJ = read('vote.js'), CL = read('career-live.js');
/* 関数・オブジェクトの本体を、波かっこの対で切り出す（空白は詰めて比べる） */
function body(src, head) {
  const i = src.indexOf(head);
  if (i < 0) return null;
  const a = src.indexOf('{', i);
  let dep = 0;
  for (let j = a; j < src.length; j++) {
    if (src[j] === '{') dep++;
    else if (src[j] === '}' && --dep === 0) return src.slice(i, j + 1).replace(/\s+/g, ' ');
  }
  return null;
}
const same = (x, y) => !!x && x === y;
{
  const a = body(VJ, 'function realRated('), b = body(CL, 'function realRated(');
  ok(same(a, b), 'realRated() が会社ページ（career-live.js）と1文字も違わない', a && b ? '' : '見つからない');
  /* 壊す証明：1文字だけ変えると、この照合は落ちる */
  ok(!same(a && a.replace('v <= 0', 'v < 0'), b), '…（壊す証明）1文字変えると違うと分かる');
  ok(same(body(VJ, 'var LEGACY ='), body(CL, 'var LEGACY =')), '旧コードの対応表（LEGACY）が会社ページと同じ');
  const sc = (s) => (/var SCORES = (\[[^\]]+\])/.exec(s) || [])[1];
  ok(!!sc(VJ) && sc(VJ) === sc(CL), '数える6項目（SCORES）が会社ページと同じ');
}
ok(VJ.includes('PVReviewI18n.fetchRows') && !/\.from\(\s*['"]reviews_v2/.test(VJ),
   '口コミは唯一の口（pv_reviews）から読み、表を直接引かない');
ok((VJ.match(/max: 240 \}/g) || []).length === 4 && (VJ.match(/max: 31 \}/g) || []).length === 2,
   '目盛は日英とも 時間 0〜240・泊 0〜31 で固定');
ok(!/viewCount|sort\([^)]*(avg|R\.n|rev\.n)/.test(VJ), '会社の並びを評価・件数で作っていない');
{
  const pop = JSON.parse(read('vote-popular.json'));
  const DIR = JSON.parse(read('pv-airlines.json')).airlines;
  ok(J(Object.keys(pop).sort()) === J(['asOf', 'days', 'slugs']), 'vote-popular.json は並び・日数・日付だけ（閲覧数を書かない）', J(Object.keys(pop)));
  ok(Array.isArray(pop.slugs) && pop.slugs.length === 6 && new Set(pop.slugs).size === 6, '並びは6社・重なりなし');
  const bad = pop.slugs.filter((s) => !(DIR[s] && DIR[s].kind === 'airline' && fs.existsSync(path.join(ROOT, 'airlines', s + '.html')) && fs.existsSync(path.join(ROOT, 'en/airlines', s + '.html'))));
  ok(!bad.length, '6社とも日英の会社ページが在る', bad.join(' '));
}
for (const f of ['community.html', 'en/community.html']) {
  const h = read(f);
  const h1 = [...h.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
  ok(h1.length === 1 && h1[0] === 'Vote', `${f}：見出しはちょうど「Vote」`, J(h1));
  ok(/vote\.js\?v=[0-9a-f]{8}"/.test(h) && /vote\.css\?v=[0-9a-f]{8}"/.test(h), `${f}：vote.js / vote.css を指紋つきで読む`);
}

/* ═══ 2. 手元のサーバー（使い捨ての保存先） ═══ */
const DIRDB = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-vote-'));
const srv = await start({ port: 0, dir: DIRDB, quiet: true });   // 番号は OS が選ぶ（3000・3195・3196 とぶつからない）
const BASE = srv.url;
const db = srv.db;
const uid = (k) => MEMBERS.find((m) => m.key === k).id;
const H = (x) => createHash('sha256').update(x).digest('hex');
/* 作り物の口コミ。末尾に「目印」を付ける ── 先頭40字の抜粋には入らない位置。鍵の無い画面に出たら漏れ。 */
const TAIL = (i) => `【末尾の目印${i}】`;
/* 目印は80字より先に置く（流れるカードは先頭80字まで見せる・2026-10-29 オーナー決定） */
const pad = '（手元の検査用の作り物の文です。実在の投稿ではありません）' + 'です'.repeat(30);
const REV = [
  ['ana', 'fo', '5-10', [4, 3, 4, 3, 4, 4], 3, { wlb: '勤務表が出るのは月末近く。' + pad, salary: '乗務手当で手取りに波がある。' + pad, mgmt: '勤務表をもう少し早く。' + pad }, 0, 'b'],
  ['ana', 'captain', '15-20', [4, 4, 5, 3, 4, 5], null, { training: '定期審査は準備の負担もあるが見直す機会になる。' + pad, culture: '質問しやすい雰囲気。' + pad }, 1, null],
  ['ana', 'fo', '1-5', [3, 3, 4, 2, 4, 4], null, { ops: '機材の更新が進んでいる。' + pad }, 2, null],
  ['jal', 'captain', '10-15', [4, 4, 4, 4, 4, 4], null, { salary: '基本給と乗務手当のバランスは悪くない。' + pad }, 0, null],
  ['singapore', 'captain', '10-15', [4, 4, 4, 3, 4, 4], null, { training: '訓練部門の教官の質が高い。' + pad }, 4, null],
];
const tails = [];
const LENS = [];   // 1件ずつの本文の文字数（7欄の合計）＝ カードの「全 N 文字」の正解
for (const [i, r] of REV.entries()) {
  const [air, pos, ten, s, mg, c, ago, who] = r;
  for (const k of Object.keys(c)) { const t = TAIL(i + k); c[k] = c[k] + t; tails.push(t); }
  LENS.push(Object.values(c).reduce((x, y) => x + y.trim().length, 0));
  const hash = who ? (await db.query(`select public.pv_review_hash($1::uuid, $2) h`, [uid(who), air])).rows[0].h : H('vote-assert-' + i);
  await db.query(
    `insert into public.reviews_v2 (proof_hash, airline, "position", tenure_bucket, culture_score, salary_score, benefits_score, wlb_score, ops_score, training_score, mgmt_score,
       culture_comment, salary_comment, benefits_comment, wlb_comment, ops_comment, training_comment, mgmt_comment, orig_lang, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'ja', now() - ($19 || ' days')::interval)`,
    [hash, air, pos, ten, ...s, mg, c.culture || null, c.salary || null, c.benefits || null, c.wlb || null, c.ops || null, c.training || null, c.mgmt || null, String(ago * 9)]);
}
{
  const now = new Date(); const Y = now.getUTCFullYear(), M = now.getUTCMonth() + 1;
  const ym = (k) => { let y = Y, m = M - k; while (m < 1) { m += 12; y--; } return [y, m]; };
  const W = [['ana', 'fo', [[60, 140, 6], [70, 160, 8], [55, 130, 7], [75, 170, 10]]], ['ana', 'cap', [[65, null, 9], [72, null, 11], [80, null, 12]]],
             ['emirates', 'fo', [[80, 170, 12], [90, 190, 15]]]];
  let p = 0;
  for (const [air, pos, people] of W) for (const [b, d, s] of people) {
    p++;
    for (const k of [1, 2, 3]) {
      const [y, m] = ym(k);
      await db.query(`insert into public.pv_work_months (proof_hash, airline, period_year, period_month, "position", block_hours, duty_hours, stay_nights)
        values ($1,$2,$3,$4,$5,$6,$7,$8)`, [H('vote-assert-w' + p), air, y, m, pos, b + k, d === null ? null : d + k, s]);
    }
  }
}
async function login(who) { return (await (await fetch(`${BASE}/__local/login?member=${who}`)).json()); }
async function rpc(who, fn, p) {
  const headers = { 'content-type': 'application/json' };
  if (who) headers.authorization = 'Bearer ' + (await login(who)).session.access_token;
  return (await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: J({ p }) })).json();
}

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
async function open(url, { who = null, width = 1280, height = 900, block = null } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message)));
  await page.setViewport({ width, height, isMobile: width < 500, hasTouch: width < 500 });
  if (block) {
    await page.setRequestInterception(true);
    page.on('request', (rq) => (block.test(rq.url()) ? rq.abort() : rq.continue()));
  }
  const s = who ? await login(who) : null;
  await page.evaluateOnNewDocument((s) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('pv_local_ui', '0');
    if (!s) return;
    const now = String(Date.now());
    localStorage.setItem('sb-local-auth-token', JSON.stringify(s.session));
    localStorage.setItem('pv_user', JSON.stringify(s.pv_user));
    localStorage.setItem('pv_last_active', now);
    localStorage.setItem('pv_session_start', now);
    const at = Date.parse((s.session.user || {}).last_sign_in_at || '');
    localStorage.setItem('pv_give_seen', JSON.stringify({ t: Date.now(), s: String(isNaN(at) ? now : at) }));
  }, s);
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  /* 読み込みが落ち着くまで待つ（時間ではなく条件で） */
  await page.waitForFunction(() => {
    const f = document.getElementById('review-feed');
    const busy = f && f.getAttribute('aria-busy') === 'true';
    const g = document.getElementById('vt-co-grid');
    const home = document.getElementById('vt-home');
    const coBusy = home && !home.hidden && g && (!g.querySelector('.vt-co,.vt-empty') || /読み込み中|Loading/.test(g.textContent));
    return f && !busy && !coBusy;
  }, { timeout: 30000 });
  return { page, ctx, errs };
}
const html = (page) => page.evaluate(() => document.documentElement.outerHTML);
const leaks = (h) => tails.filter((t) => h.includes(t));

/* ═══ 2-A. 鍵の無い人 ═══ */
console.log('\n════ 2-A. 未ログイン（鍵なし）════');
{
  const { page, ctx, errs } = await open('/community.html');
  const v = await page.evaluate(() => ({
    gate: !!document.getElementById('gate-panel'),
    badge: document.getElementById('unlock-badge').style.display !== 'none',
    order: [...document.querySelectorAll('.vt-co')].map((e) => e.dataset.slug),
    fills: document.querySelectorAll('#vt-co-grid .vt-fill').length,
    locks: [...document.querySelectorAll('#vt-co-grid .vt-co-work')].map((e) => e.textContent),
    ana: (document.querySelector('.vt-co[data-slug="ana"] .vt-rn') || {}).textContent,
    anaN: (document.querySelector('.vt-co[data-slug="ana"] .vt-rc-n') || {}).textContent,
  }));
  ok(v.gate && !v.badge, '鍵の壁が出て、解放中の印は出ない', J(v));
  ok(J(v.order) === J(JSON.parse(read('vote-popular.json')).slugs), 'よく見られている会社は vote-popular.json の順', J(v.order));
  ok(v.fills === 0 && v.locks.every((t) => t.includes('ログインと給与の提出で開きます')), '月の勤務は棒を描かず「ログインと給与の提出で開きます」', J(v.locks.slice(0, 2)));
  /* 会社ページと同じ数え方で、作り物の点数から作り直す */
  const rr = REV.filter((r) => r[0] === 'ana').map((r) => r[3].filter((x) => x > 0)).map((a) => a.reduce((x, y) => x + y, 0) / a.length);
  const want = (rr.reduce((x, y) => x + y, 0) / rr.length).toFixed(1);
  ok(v.ana === want && /口コミ 3件/.test(v.anaN || ''), `ANA の総合評価は ${want}・口コミ 3件（点数は誰にでも見える列）`, J(v));
  ok(!leaks(await html(page)).length, '★ホームのどこにも、先頭80字より先の本文が無い', leaks(await html(page)).join(' '));
  const strip = await page.evaluate(() => ({
    n: document.querySelectorAll('#review-feed .vt-rc').length,
    clones: document.querySelectorAll('#vt-mq-track > .vt-mq-set[data-clone]').length,
    hidden: [...document.querySelectorAll('#vt-mq-track > .vt-mq-set[data-clone]')].every((e) => e.getAttribute('aria-hidden') === 'true' && [...e.querySelectorAll('a')].every((a) => a.tabIndex === -1)),
    anim: getComputedStyle(document.getElementById('vt-mq-track')).animationName,
    stars: [...document.querySelectorAll('#review-feed .vt-rc')].every((c) => c.querySelector('.vt-rc-stars .vt-stars')),
    ghosts: document.querySelectorAll('#review-feed .vt-ghost').length,
    ghostText: [...document.querySelectorAll('.vt-ghost')].map((g) => g.textContent).join(''),
    lens: [...document.querySelectorAll('#review-feed .vt-rc-len')].map((e) => Number(e.textContent.replace(/[^0-9]/g, ''))),
    ex: [...document.querySelectorAll('#review-feed .vt-rc-ex')].map((e) => e.textContent.replace(/…$/, '').length),
    cta: !!document.querySelector('#main-nav .btn-orange'),
  }));
  ok(strip.n === REV.length && strip.n <= 12 && strip.clones >= 1 && strip.hidden && strip.anim === 'vt-mq',
     '最新の口コミは流れる帯（12件まで・写しは読み上げにもタブにも入らない）', J(strip));
  ok(strip.stars, 'どのカードにも星が出る');
  ok(strip.ex.every((x) => x <= 80) && strip.ex.some((x) => x > 40), 'カードは先頭80字まで見せる（40字より多く・80字を超えない）', J(strip.ex));
  ok(strip.ghosts >= 1 && strip.ghostText === '', '★ぼかしは字を持たない影絵（本物の字は届いていない）', J({ g: strip.ghosts, t: strip.ghostText.slice(0, 40) }));
  ok(J([...strip.lens].sort((a, b) => a - b)) === J([...LENS].sort((a, b) => a - b)), '「全 N 文字」は投稿全体（7欄の合計）の文字数', J({ got: strip.lens, want: LENS }));
  ok(!strip.cta, 'ヘッダー右上のオレンジ「匿名で口コミを投稿」は無い');
  /* 引き出しを全部開いても、項目で絞っても出ない */
  const keys = await page.evaluate(() => [...document.querySelectorAll('#review-feed [data-review]')].map((a) => a.dataset.review));
  let worst = [];
  for (const k of keys) {
    await page.evaluate((k) => { location.hash = '#review/' + k; }, k);
    await page.waitForFunction(() => document.getElementById('vt-dialog').open, { timeout: 5000 });
    const h = await page.evaluate(() => document.getElementById('vt-dialog').innerHTML);
    worst = worst.concat(leaks(h));
    if (!/本文は、口コミを1件出した方だけが読めます/.test(h)) worst.push('錠前の文が無い:' + k);
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => !document.getElementById('vt-dialog').open, { timeout: 5000 });
  }
  ok(keys.length >= 4 && !worst.length, `★鍵の無い人の引き出し（${keys.length}件）に本文の続きが無く、錠前の文がある`, worst.join(' '));
  await page.evaluate(() => { location.hash = '#all'; });
  await page.waitForFunction(() => !document.getElementById('vt-all').hidden);
  for (const c of ['culture', 'salary', 'wlb', 'ops', 'training', 'mgmt']) {
    await page.select('#vt-f-cat', c);
    worst = worst.concat(leaks(await html(page)));
  }
  ok(!worst.length, '★項目で絞っても本文の続きが出ない', worst.join(' '));
  ok(!errs.length, 'ページの中でエラーが出ない', errs.join(' / '));
  await ctx.close();
}

/* ═══ 2-B. 運営（全部開いている）═══ */
console.log('\n════ 2-B. 運営（本文も勤務も開いている）════');
{
  const work = await rpc('op', 'pv_work_view', { airline: 'ana' });
  const { page, ctx, errs } = await open('/community.html', { who: 'op' });
  const rowOf = (slug) => page.evaluate((slug) => [...document.querySelectorAll(`.vt-co[data-slug="${slug}"] .vt-wr`)].map((r) => ({
    k: r.dataset.work, v: r.querySelector('.vt-wv').textContent.replace(/\s+/g, ' ').trim(), track: !!r.querySelector('.vt-track'), fill: !!r.querySelector('.vt-fill'),
    scale: r.dataset.scale || '',
  })), slug);
  const fo = await rowOf('ana');
  const want = (x) => (x ? (x.lo === x.hi ? String(x.lo) : `${x.lo}–${x.hi}`) : null);
  const exp = ['block_hours', 'duty_hours', 'stay_nights'].map((k) => want(work.by.fo[k]));
  ok(work.state === 'open' && fo.length === 3 && fo.every((r, i) => exp[i] && r.v.startsWith(exp[i]) && r.fill), 'ANA 副操縦士の3本はサーバーの幅のまま', J({ fo, exp }));
  ok(fo[0].scale === '0-240' && fo[1].scale === '0-240' && fo[2].scale === '0-31', '目盛は 0〜240時間・0〜240時間・0〜31泊（会社どうしで同じ）', J(fo.map((r) => r.scale)));
  const widths = await page.evaluate(() => [...document.querySelectorAll('.vt-co[data-slug="ana"] .vt-track')].map((t) => Math.round(t.getBoundingClientRect().width)));
  ok(widths.length === 3 && new Set(widths).size === 1, '★3本の帯の長さ（目盛の幅）は同じ ── 幅の字数で伸び縮みしない', J(widths));
  await page.click('[data-role="cap"]');
  const cap = await rowOf('ana');
  ok(cap[1].v === '未取得' && !cap[1].track && cap[0].v.startsWith(want(work.by.cap.block_hours)), '機長に切り替えると機長の数だけ（拘束時間は回答が無いので「未取得」・棒なし）', J(cap));
  const em = await rowOf('emirates');
  ok(em.length === 3 && em.every((r) => r.v === '未取得' && !r.track), '2人しか答えていない会社は3本とも「未取得」で棒を描かない（0 にしない）', J(em));
  ok(!(await page.$('#gate-panel')), '運営には鍵の壁が出ない');
  /* 引き出し：7項目が並びどおり・経営陣への提案に点が付かない・本文が全部ある */
  const key = await page.evaluate(() => [...document.querySelectorAll('#review-feed [data-review]')].find((a) => /ANA/.test(a.textContent) && /副操縦士/.test(a.textContent) && /5〜10年/.test(a.textContent)).dataset.review);
  await page.evaluate((k) => { location.hash = '#review/' + k; }, key);
  await page.waitForFunction(() => document.getElementById('vt-dialog').open);
  const d = await page.evaluate(() => ({
    h: [...document.querySelectorAll('#vt-dialog .vt-d-sec h3 > span:first-child')].map((e) => e.textContent),
    mgmtScore: !!document.querySelectorAll('#vt-dialog .vt-d-sec')[6].querySelector('.vt-d-score'),
    text: document.getElementById('vt-dialog').textContent,
  }));
  ok(J(d.h) === J(['企業文化', '給与', '福利厚生', 'ワークライフバランス', '運航環境', '訓練環境', '経営陣への提案']), '引き出しは同じ投稿の7項目を見出しつきで並べる', J(d.h));
  ok(!d.mgmtScore, '経営陣への提案には点を付けない（総合評価に入れない）');
  ok(d.text.includes(TAIL('0wlb')) && d.text.includes(TAIL('0mgmt')), '鍵のある人には本文が最後まで出る');
  await page.evaluate(() => history.back());
  await page.waitForFunction(() => !document.getElementById('vt-dialog').open);

  /* 動き（1本）：流れる帯のカードを押す → Esc ／ × ／ 戻る。開いている間は帯が止まる。 */
  await page.evaluate(() => window.scrollTo(0, 120));
  await page.waitForFunction(() => Math.abs(scrollY - 120) < 2 || document.documentElement.scrollHeight <= innerHeight + 120);
  const before = await page.evaluate(() => ({ L: history.length, y: scrollY }));
  const pick = await page.evaluate(() => document.querySelector('#review-feed .vt-rc').dataset.review);
  for (const how of ['Esc', '×', '戻る']) {
    await page.evaluate((k) => document.querySelector('#review-feed [data-review="' + k + '"]').click(), pick);
    await page.waitForFunction(() => document.getElementById('vt-dialog').open);
    const L1 = await page.evaluate(() => history.length);
    const paused = await page.evaluate(() => getComputedStyle(document.getElementById('vt-mq-track')).animationPlayState);
    if (how === 'Esc') await page.keyboard.press('Escape');
    else if (how === '×') await page.click('#vt-dialog [data-close]');
    else await page.goBack();
    await page.waitForFunction(() => !document.getElementById('vt-dialog').open, { timeout: 5000 });
    await page.waitForFunction((k) => document.activeElement && document.activeElement.dataset && document.activeElement.dataset.review === k, { timeout: 3000 }, pick).catch(() => {});
    const after = await page.evaluate(() => ({ L: history.length, hash: location.hash, y: scrollY,
      focus: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.review : null,
      inFeed: !!(document.activeElement && document.activeElement.closest('#review-feed')),
      lock: document.documentElement.classList.contains('vt-lock') }));
    ok(after.hash === '' && after.L === L1 && after.focus === pick && after.inFeed && Math.abs(after.y - before.y) < 2 && !after.lock && paused === 'paused',
       `${how}で閉じる → 履歴は増えない・押したカードにフォーカス・スクロールの位置はそのまま（開いている間は帯が止まる）`, J({ before, L1, paused, after }));
  }
  /* 直に開いた住所（#review/…）から閉じても、1段も増えない */
  await page.goto(BASE + '/community.html#review/' + key, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('vt-dialog').open, { timeout: 30000 });
  const L0 = await page.evaluate(() => history.length);
  await page.click('#vt-dialog [data-close]');
  await page.waitForFunction(() => !document.getElementById('vt-dialog').open);
  const L2 = await page.evaluate(() => ({ L: history.length, hash: location.hash }));
  ok(L2.L === L0 && L2.hash === '', '住所から直に開いた引き出しを閉じても、履歴は増えない', J({ L0, L2 }));

  /* 行き先 */
  const links = await page.evaluate(() => ({
    main: document.querySelector('.vt-co[data-slug="ana"] .vt-co-main').getAttribute('href'),
    work: document.querySelector('.vt-co[data-slug="ana"] .vt-wk-link').getAttribute('href'),
  }));
  ok(links.main === 'airlines/ana.html#reviews' && links.work === 'airlines/ana.html#work', '会社カードは既存の会社ページの #reviews と #work へ', J(links));
  await page.evaluate(() => { location.hash = '#all'; });
  await page.waitForFunction(() => !document.getElementById('vt-all').hidden);
  await page.select('#vt-f-co', 'singapore-airlines');
  const sg = await page.evaluate(() => ({ post: document.getElementById('vt-all-post').getAttribute('href'),
    names: [...document.querySelectorAll('#vt-list .vt-rc-name')].map((e) => e.textContent) }));
  ok(sg.post === 'submit-review.html?airline=singapore-airlines' && sg.names.length >= 2 && sg.names.every((n) => n === 'Singapore Airlines'),
     '旧コード singapore の口コミも Singapore Airlines にまとまり、投稿フォームへは本当の slug を渡す', J(sg));
  /* 検索 */
  await page.evaluate(() => { location.hash = ''; });
  await page.waitForFunction(() => !document.getElementById('vt-home').hidden);
  await page.type('#vt-home [data-q]', '教官');
  await page.waitForFunction(() => document.getElementById('vt-co-h').textContent === '検索に合う会社', { timeout: 5000 });
  const q = await page.evaluate(() => ({ cards: [...document.querySelectorAll('#review-feed .vt-rc')].map((e) => e.textContent),
    cos: [...document.querySelectorAll('.vt-co')].map((e) => e.dataset.slug) }));
  ok(q.cards.length >= 1 && q.cards.every((t) => t.includes('教官')) && q.cos.includes('singapore-airlines'), '検索：本文の字で口コミと会社が絞れる', J(q));
  await page.click('#vt-home [data-q-clear]');
  await page.waitForFunction(() => document.getElementById('vt-co-h').textContent === 'よく見られている会社', { timeout: 5000 });
  ok(true, '検索をクリアすると、よく見られている会社に戻る');
  ok(!errs.length, 'ページの中でエラーが出ない', errs.join(' / '));
  await ctx.close();
}

/* ═══ 2-C. 鍵の無い会員・読めなかったとき・狭い画面・英語 ═══ */
console.log('\n════ 2-C. いろいろな状態 ════');
{
  const { page, ctx } = await open('/community.html', { who: 'a' });
  const t = await page.evaluate(() => document.querySelector('.vt-co[data-slug="ana"] .vt-co-work').textContent);
  ok(t.includes('給与の提出で開きます') && !t.includes('ログインと'), 'ログインしていて給与を出していない会員 → 「給与の提出で開きます」', t);
  await ctx.close();
}
{
  const { page, ctx } = await open('/community.html', { who: 'op', block: /\/rpc\/pv_reviews/ });
  const v = await page.evaluate(() => ({ st: document.getElementById('vt-feed-status').textContent,
    sum: document.querySelector('.vt-co[data-slug="ana"] .vt-co-sum').textContent }));
  ok(/読み出せませんでした/.test(v.st) && /いま読み出せません/.test(v.sum) && !/口コミ 0件/.test(v.sum), '読めなかったときは「読み出せません」で、「0件」と言わない', J(v));
  await ctx.close();
}
{
  const { page, ctx } = await open('/community.html', { who: 'op', width: 390, height: 844 });
  const v = await page.evaluate(() => ({
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    cut: [...document.querySelectorAll('.vt-wv, .vt-wl, .vt-rc-name, .vt-co-name, .vt-title')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent),
    cols: getComputedStyle(document.getElementById('vt-co-grid')).gridTemplateColumns.split(' ').length,
  }));
  ok(v.over <= 0 && !v.cut.length && v.cols === 1, '390px：横にはみ出さない・数字と単位が切れない・会社は1列', J(v));
  await ctx.close();
}
{
  const { page, ctx, errs } = await open('/en/community.html', { who: 'op' });
  const v = await page.evaluate(() => ({
    h1: document.querySelector('h1').textContent,
    labels: [...document.querySelectorAll('.vt-co[data-slug="ana"] .vt-wl')].map((e) => e.textContent),
    href: document.querySelector('.vt-co[data-slug="ana"] .vt-co-main').getAttribute('href'),
    scale: [...document.querySelectorAll('.vt-co[data-slug="ana"] .vt-wr')].map((e) => e.dataset.scale),
    cta: !!document.querySelector('#main-nav .btn-orange'),
  }));
  ok(v.h1 === 'Vote' && J(v.labels) === J(['Flight time', 'Duty time', 'Layover nights']) && v.href === 'airlines/ana.html#reviews'
     && J(v.scale) === J(['0-240', '0-240', '0-31']) && !v.cta, '英語ページ：見出し Vote・3本の名前と目盛・英語の会社ページへ・オレンジのボタンは無い', J(v));
  ok(!errs.length, '英語ページの中でエラーが出ない', errs.join(' / '));
  await ctx.close();
}

/* ═══ 2-D. ログインせずに口コミを出す → 預かり → 同じタブでログイン → 引き取り（2026-10-29）═══ */
console.log('\n════ 2-D. ログインなしの口コミ（預かり → 引き取り）════');
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message)));
  await page.setViewport({ width: 1100, height: 900 });
  await page.evaluateOnNewDocument(() => { if (!sessionStorage.getItem('s0')) { sessionStorage.setItem('s0', '1'); localStorage.setItem('pv_local_ui', '0'); } });
  await page.goto(BASE + '/submit-review.html', { waitUntil: 'networkidle0', timeout: 45000 });
  const open0 = await page.evaluate(() => ({ form: getComputedStyle(document.getElementById('form-wrap')).display, gate: getComputedStyle(document.getElementById('login-gate')).display }));
  ok(open0.form !== 'none' && open0.gate === 'none', 'ログインしていなくても口コミのフォームが開いている', J(open0));
  /* 作り物の口コミ（実在の投稿ではない） */
  await page.evaluate(() => {
    const sel = document.getElementById('f-airline'); sel.value = 'zipair'; sel.dispatchEvent(new Event('change'));
    const r = document.querySelector('input[name="f-pos"][value="fo"]'); r.checked = true; r.dispatchEvent(new Event('change'));
    document.getElementById('f-tenure').value = '1-5';
    document.getElementById('f-age').value = '30-34';
    for (const k of ['culture', 'salary', 'benefits', 'wlb', 'ops', 'training']) document.querySelector(`.star-group[data-cat="${k}"]`).dataset.score = '4';
    document.getElementById('fc-culture').value = '社内の雰囲気は落ち着いていて、先輩にも相談しやすいです。若い会社なので意見が通りやすく、運航乗務員の声が経営に届く場面も多いと感じます。一方で制度の変更が早く、慣れるまでは少し戸惑いました。';
    document.getElementById('fc-wlb').value = '勤務表は月の中旬に出るので、翌月の予定は立てやすいほうです。長距離の後は休養日がきちんと入り、繁忙期以外は希望休も通りやすいです。家族との時間は以前の会社より取れています。';
    document.getElementById('fc-ops').value = '機材は新しく整備の状態も良いので安心して乗務できます。運航管理との連絡は丁寧で、天候の悪い日も判断の材料がそろっています。成田の混雑する時間帯は地上で待つことが多いです。';
    document.getElementById('fc-salary').value = '基本給は同業の中では標準的ですが、乗務手当が月ごとの飛行時間で変わるので手取りには波があります。賞与は会社の業績しだいで、去年は少し増えました。';
  });
  await page.evaluate(() => goStep(2));
  await page.evaluate(() => goStep(3));
  await page.evaluate(() => submitReview());
  await page.waitForFunction(() => getComputedStyle(document.getElementById('step-pending')).display !== 'none'
    || [...document.querySelectorAll('[id^="err"]')].some((e) => e.textContent.trim()), { timeout: 15000 });
  const sent = await page.evaluate(() => ({ pending: getComputedStyle(document.getElementById('step-pending')).display !== 'none',
    claims: JSON.parse(localStorage.getItem('pv_review_claim') || '[]').length,
    unlock: Number(localStorage.getItem('pv_unlock_expiry') || 0) > Date.now(),
    err: [...document.querySelectorAll('[id^="err"]')].map((e) => e.textContent.trim()).filter(Boolean) }));
  const held = (await db.query(`select count(*)::int n from public.pv_review_pending where airline = 'zipair' and claimed_at is null`)).rows[0].n;
  ok(sent.pending && sent.claims === 1 && !sent.unlock && held === 1, '★未ログインで出すと預かりに入り「あと1ステップ」が出る・まだ鍵は開かない', J({ sent, held }));
  const anon = await rpc(null, 'pv_reviews', { airline: 'zipair' });
  const pr = (anon.rows || []).find((x) => x.pending === true);
  ok(!!pr && !Object.keys(pr).some((k) => /_comment$/.test(k)), '★預かった口コミは一覧に出る（鍵の無い人には本文を返さない）', J(pr || {}).slice(0, 160));
  /* 同じタブでログイン（手元の会員 c）→ フォームへ戻る */
  const s = await login('c');
  await page.evaluate((s) => {
    const now = String(Date.now());
    localStorage.setItem('sb-local-auth-token', JSON.stringify(s.session));
    localStorage.setItem('pv_user', JSON.stringify(s.pv_user));
    localStorage.setItem('pv_last_active', now); localStorage.setItem('pv_session_start', now);
    const at = Date.parse((s.session.user || {}).last_sign_in_at || '');
    localStorage.setItem('pv_give_seen', JSON.stringify({ t: Date.now(), s: String(isNaN(at) ? now : at) }));
  }, s);
  await page.goto(BASE + '/submit-review.html', { waitUntil: 'networkidle0', timeout: 45000 });
  await page.waitForFunction(() => getComputedStyle(document.getElementById('step-success')).display !== 'none'
    || getComputedStyle(document.getElementById('claim-retry')).display !== 'none', { timeout: 15000 });
  const done = await page.evaluate(() => ({ success: getComputedStyle(document.getElementById('step-success')).display !== 'none',
    unlock: Number(localStorage.getItem('pv_unlock_expiry') || 0) > Date.now(), claims: localStorage.getItem('pv_review_claim') }));
  const h = (await db.query(`select public.pv_review_hash($1::uuid, 'zipair') h`, [uid('c')])).rows[0].h;
  const mine = (await db.query(`select count(*)::int n from public.reviews_v2 where proof_hash = $1`, [h])).rows[0].n;
  const left = (await db.query(`select count(*)::int n from public.pv_review_pending where airline = 'zipair' and claimed_at is null`)).rows[0].n;
  ok(done.success && done.unlock && !done.claims && mine === 1 && left === 0,
     '★同じタブでログインして戻ると、本人の口コミになり鍵が開く（預かりは引き取り済み＝一覧に2回出ない）', J({ done, mine, left }));
  ok(!errs.length, 'フォームの中でエラーが出ない', errs.join(' / '));
  await ctx.close();
}

await browser.close();
await srv.close();
fs.rmSync(DIRDB, { recursive: true, force: true });
console.log(`\n${fail ? '❌' : '✅'} ${pass} 通過 / ${fail} 失敗`);
process.exit(fail ? 1 : 0);
