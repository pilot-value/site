/* shot-glance.mjs ── 会社ページ改良の台紙（見本｜現行｜初稿）を作る

   何のためか
     主要5社の会社ページと「情報を足す画面」を iPhone・iPad・PC の大きさで撮り、
     見本・今の画面・初稿を横に並べた1枚にする。
     大きさ・釣り合い・仕上がりは、この台紙を見て人が決める（検査が緑でも合格ではない）。

   使い方
     node shot-glance.mjs shoot current      今の画面を撮る（★ページを触る前に撮っておく）
     node shot-glance.mjs shoot draft        初稿を撮る
     node shot-glance.mjs sheet --ref <見本のフォルダ> [--ref <もう1つ>]   台紙にする
       --only jal,ana         会社・画面を絞る（鍵で）
       --sizes iphone,pc      大きさを絞る
       --set airline,contrib  組を絞る
     node shot-glance.mjs shoot draft --set stay [--only jal] [--sizes iphone,ipad-p,pc]
                            ステイ先（就航地の詳細）を、読む人が出会う状態ごとに撮る（最初の1画面だけ）。
                            --only は会社（jal）か、会社と番号（jal-s3）。(5) だけ 3000 番・ほかは使い捨ての手元の保存先

   置き場  temporary screenshots/glance/（gitignore 済み）
     current/ draft/   撮った絵と、撮ったときの覚え書き（meta.json）
     ref/              見本の写し（★commit しない。古い数字と架空の例が入っている）
     sheets/           台紙（PNG と、localhost で開ける HTML。入口は sheets/index.html）

   ⚠️ 見本のフォルダの場所をこのファイルに書かない（ログイン名が入る）。--ref で渡す。
   ⚠️ 高さは「ブラウザのバーを引いた実寸」（iPhone は 844 ではなく 680）。
      端末の仕様表の数字に戻すと、最初の1画面に入っていない物が入って見える。
   ⚠️ 公開ページは未ログインの読み手として 3000 番（serve.mjs）で撮る。
      解析タグは止め、本番の DB へは「読むだけ」の呼び出ししか通さない（READ_RPC）。
      止めた通信は黙って捨てず、最後に一覧で出す。
   ⚠️ ログインが要る画面は、手元の保存先（serve-local.mjs）を**使い捨ての置き場**で
      自分で立てて撮る ＝ 本番とは1回も通信しない・3100 番の保存先も汚さない。
      そこで入れた回答は「手元の試験の回答」で、本物の投稿ではない。
   時間では待たない。字・絵・通信・動きが落ち着いたことを条件で待つ。 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { networkOf } from './airline-destinations.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const OUT  = path.join(ROOT, 'temporary screenshots', 'glance');
const PUB  = process.env.PV_PUB || 'http://localhost:3000';

/* ── 大きさ ─────────────────────────────────────────────
   col ＝ 台紙の上での1列の幅（px）。絵はこの幅に縮めて並べる。 */
export const SIZES = {
  'iphone': { ja: 'iPhone', w: 390,  h: 680, touch: true,  col: 390 },
  'ipad-p': { ja: 'iPad 縦', w: 768,  h: 950, touch: true,  col: 560 },
  'ipad-l': { ja: 'iPad 横', w: 1024, h: 700, touch: true,  col: 660 },
  'pc':     { ja: 'PC',      w: 1440, h: 820, touch: false, col: 720 },
};

/* ── 撮るもの ───────────────────────────────────────────
   ref ＝ 見本のファイル名（大きさごと）。無い大きさは台紙に「見本なし」と出る。
   見本は配置の見本であって、中の数字・口コミ・件数は古いか架空。 */
const AIR = [
  ['jal', 'JAL', 'jal'], ['ana', 'ANA', 'ana'], ['cathay-pacific', 'キャセイパシフィック', 'cathay'],
  ['etihad', 'エティハド', 'etihad'], ['eva-air', 'エバー航空', 'eva'],
];
const REF_NOTE = {
  'final-mobile-0.jpg': 'スマホの見本は1社ぶんだけ（概要・以前の版）',
  '01-overview-desktop.png': '概要の見本',
  'work-question-form.jpg': 'PC の絵だけ', 'taxi-question-form.jpg': 'PC の絵だけ',
  'contribution-etihad-topics.png': 'PC の絵だけ', 'photo-hotel-upload-preview.jpg': 'PC の絵だけ',
  'staff-travel-conditions-preview.jpg': 'PC の絵だけ',
};
const wide = (f) => ({ 'pc': f, 'ipad-l': f });
const tall = (f) => ({ 'iphone': f, 'ipad-p': f });
const Q = (id) => `/airline-conditions.html?airline=jal&q=${id}`;
const ROW = (id) => `.pvcf-q[data-qid="${id}"]`;
/* 今の待遇アンケートは「出さない画面」の一覧に入っていない ＝ 登録だけの会員が開くと、
   最初の1回は Give → Get の板が上に重なる。台紙は板の下の画面を撮る（板は閉じてある）。 */
const BOARD = '登録だけの会員には、この上に Give → Get の板が1回重なる（板を閉じた後の画面）';

/* ステイ先の状態 [番号, 何の画面か, { who, pub, prep, focus, list, label }]。並びは撮る順
   （(4) の「まだ0件」は、(3) がホテルを入れる前に撮る）。label は絵の札（手元の本物か・模擬か・本番を読んだだけか）。 */
const STAY_SLOT = '#pvg-city .crl[data-live="hotels"]';
const STAY_ZONE = `${STAY_SLOT} + .crs-zone`;
const STAY_FORM = `${STAY_ZONE} .crs-formbox > .crs-form`;
const STAY_STATES = [
  ['1', 'ログインしていない人', { label: '手元の保存先（REAL LOCAL）' }],
  ['2', '会員（見てよい人ではない）', { who: 'a', label: '手元の保存先（REAL LOCAL）・会員は模擬' }],
  ['4', '見てよい人・まだ0件', { who: 'pilot', label: '手元の保存先（REAL LOCAL）・見てよい人は模擬' }],
  ['3', '見てよい人・ホテルと「同じ空港で他社が使うホテル」', { who: 'pilot', prep: 'staySeed', label: '手元の保存先（REAL LOCAL）・見てよい人とホテルは模擬' }],
  ['5', 'SQL を貼る前の「準備中」（この枝のページを、本番の DB につないでゲストで見た）', { pub: true, label: '3000 番・本番の DB を読むだけ（本番の会員の画面は未確認）' }],
  ['6', '読み込めなかった', { prep: 'stayFail', label: 'MOCK（手元のサーバーにわざと失敗させた）' }],
  ['7', '「レストランを追加」で開いた面', { prep: 'stayForm', focus: STAY_ZONE, label: '手元の保存先（REAL LOCAL）' }],
  ['8', '送った人の確認待ちの投稿', { prep: 'stayAdd', focus: STAY_ZONE, label: '手元の保存先（REAL LOCAL）' }],
  ['10', '「戻る」のあとの一覧（探す字が残っている）', { list: true, prep: 'stayBack', focus: '#pvg-st-q', label: '手元の保存先（REAL LOCAL）' }],
  ['11', 'ログインから戻った画面（板は -board.png）・板を閉じた後の書きかけの面', { prep: 'stayLogin', focus: STAY_ZONE, label: '手元の保存先（REAL LOCAL）・会員は模擬' }],
];

export const TARGETS = [
  ...AIR.map(([slug, ja, r]) => ({
    set: 'airline', key: slug, ja: `${ja} 会社ページ`,
    current: { path: `/airlines/${slug}.html` },
    draft:   { path: `/airlines/${slug}.html` },
    ref: { ...wide([`final-${r}-overview.png`, '01-overview-desktop.png']), ...tall(['final-mobile-0.jpg']) },
  })),

  /* 情報を足す画面。「現行」は今の待遇アンケート（ログイン専用の1枚）。
     draft は初稿が出来た段で埋める（それまで台紙には「まだ無い」と出る）。 */
  { set: 'contrib', key: 'topics', ja: '話題の一覧', who: 'a',
    current: { path: '/airline-conditions.html?airline=jal' }, currentNote: BOARD,
    ref: { ...wide(['contribution-etihad-topics.png']), ...tall(['community-empty-mobile390.png']) } },
  { set: 'contrib', key: 'work', ja: '月の勤務', who: 'a',
    current: null, currentNote: '今は単独の画面が無い（給与フォームの中にしか無い）',
    ref: wide(['work-question-form.jpg']) },
  { set: 'contrib', key: 'taxi', ja: '通勤・タクシー', who: 'a',
    current: { path: Q('commuting_transport'), focus: ROW('commuting_transport') }, currentNote: BOARD,
    ref: wide(['taxi-question-form.jpg']) },
  { set: 'contrib', key: 'staff', ja: 'Staff Travel', who: 'a',
    current: { path: Q('staff_travel'), focus: ROW('staff_travel') }, currentNote: BOARD,
    ref: wide(['staff-travel-conditions-preview.jpg']) },
  { set: 'contrib', key: 'upgrade', ja: '機長昇格', who: 'a',
    current: { path: Q('upgrade_years'), focus: ROW('upgrade_years') }, currentNote: BOARD, ref: {} },
  { set: 'contrib', key: 'stay', ja: 'ホテル・レストランの追加', who: null,
    current: { path: '/career.html?airline=etihad&stay=BKK' },
    currentNote: '未ログインで追加',
    ref: { ...wide(['photo-hotel-upload-preview.jpg']), ...tall(['community-hotel-gate-mobile390.png']) } },
  { set: 'contrib', key: 'fail', ja: '送れなかった時', who: 'a',
    current: { path: Q('staff_travel'), prep: 'failOne', qid: 'staff_travel', code: 'yes', focus: ROW('staff_travel') },
    currentNote: '手元のサーバーにわざと1回失敗させている', ref: {} },
  { set: 'contrib', key: 'edit', ja: '前の回答が入った状態（修正）', who: 'a',
    current: { path: Q('commuting_transport'), prep: 'answerThenReload', qid: 'commuting_transport', code: 'conditional', focus: ROW('commuting_transport') },
    currentNote: '手元の試験の回答（本物の投稿ではない）', ref: {} },

  /* ステイ先（就航地の詳細）── 会社ごとに、就航地の一覧の最初の都市（#stay-CTS など）を、読む人が出会う状態で撮る。
     「新」の側（draft）だけ。最初の1画面だけ撮る（状態は都市の詳細の中に在るので、ページ全体は撮らない）。
     見本は採っていない。番号はステイ先の設計の「## evidence」の番号（(9) の地図は作らないので無い）。
     手元の読み手は serve-local.mjs の模擬の会員：'a' ＝ 会員（見てよい人ではない）／'pilot' ＝ 見てよい人（名簿で承認済みの模擬）。
     (5) だけは 3000 番を未ログインで開く（本番の DB は読むだけ）。 */
  ...AIR.flatMap(([slug, ja]) => {
    const c = networkOf(slug).list[0];
    return STAY_STATES.map(([n, what, o]) => ({
      set: 'stay', key: `${slug}-s${n}`, slug, ja: `${ja} ステイ先 ${c.city}（${c.iata}）(${n})`, who: o.who || null, local: !o.pub,
      caption: `(${n}) ${what}・${o.label}`, refNone: 'ステイ先のタブの見本は採っていない',
      current: null, currentNote: '前の版はこのツールでは撮り直せない',
      draft: { path: `/airlines/${slug}.html#stay${o.list ? '' : '-' + c.iata}`, prep: o.prep, focus: o.focus || STAY_SLOT,
        slug, iata: c.iata, other: AIR.map((x) => x[0]).find((s) => s !== slug && (networkOf(s) || { list: [] }).list.some((d) => d.iata === c.iata)) },
      foldOnly: true, ref: {},
    }));
  }),
];

/* 本番の DB へ通してよい「読むだけ」の関数。ここに無い rpc は止めて、一覧で知らせる。 */
const READ_RPC = /^(pv_reviews|pv_give_progress|pv_pay_rows|pv_stays|next_condition_questions|my_pay_reports|my_airline_conditions)$/;
const LIBS = /^(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.tailwindcss\.com)$/;

/* ── 引数 ───────────────────────────────────────────── */
const argv = process.argv.slice(2);
const vals = (name) => argv.flatMap((a, i) => (a === name && argv[i + 1] ? [argv[i + 1]] : []));
const list = (name) => vals(name).flatMap((v) => v.split(',')).map((s) => s.trim()).filter(Boolean);

function pick() {
  const only = list('--only'), sets = list('--set'), sizes = list('--sizes');
  const bad = sizes.filter((s) => !SIZES[s]);
  if (bad.length) throw new Error(`知らない大きさ: ${bad.join(', ')}（${Object.keys(SIZES).join(' / ')}）`);
  return {
    targets: TARGETS.filter((t) => (!only.length || only.includes(t.key) || (t.slug && only.includes(t.slug))) && (!sets.length || sets.includes(t.set))),
    sizes: Object.keys(SIZES).filter((s) => !sizes.length || sizes.includes(s)),
  };
}
const idOf = (t, size) => `${t.set}-${t.key}-${size}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ── ブラウザ ─────────────────────────────────────────
   headless:'new' はこの環境で page.screenshot() が返ってこないことがある（screenshot.mjs の注記）。 */
const launch = () => puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });

/* 通してよい通信だけ通す。止めたものは blocked に残す。 */
function gate(req, base, blocked) {
  let u;
  try { u = new URL(req.url()); } catch { return req.continue(); }
  if (u.protocol === 'data:' || u.protocol === 'blob:' || u.protocol === 'about:') return req.continue();
  if (u.origin === base || LIBS.test(u.hostname)) return req.continue();
  if (/\.supabase\.co$/.test(u.hostname) && base === PUB) {
    const rpc = u.pathname.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/);
    const read = (req.method() === 'GET' || req.method() === 'HEAD' || req.method() === 'OPTIONS') && u.pathname.startsWith('/rest/v1/');
    if (read || (rpc && READ_RPC.test(rpc[1]))) return req.continue();
    blocked.add(`本番DB ${req.method()} ${u.pathname}`);
    return req.abort();
  }
  if (!/google|gtag|clarity|doubleclick|facebook/.test(u.hostname)) blocked.add(`${req.method()} ${u.hostname}`);
  return req.abort();
}

/* 字・通信・絵・動きが落ち着くまで待つ。待ちきれなかった所は notes に残す（黙って撮らない）。 */
async function settle(page, notes) {
  const soft = (p, what) => p.catch(() => { notes.add(what); });
  await page.waitForFunction(() => document.readyState === 'complete', { timeout: 45000 });
  await page.evaluate(() => document.fonts.ready.then(() => 1));
  await soft(page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 }), '通信が落ち着く前に撮った');
  /* 下まで歩いて戻る ── 画面に入ってから読む絵・現れる動きを先に起こしておく。
     ⚠️ scroll-behavior:smooth のページでは、ふつうの scrollTo は途中の位置を返す。 */
  await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const step = Math.max(200, Math.floor(innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo({ top: y, behavior: 'instant' }); await frame();
    }
    scrollTo({ top: 0, behavior: 'instant' }); await frame();
  });
  await soft(page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 }), '通信が落ち着く前に撮った');
  await soft(page.waitForFunction(() => Array.from(document.images).every((i) => i.complete || !i.getClientRects().length), { timeout: 20000 }), '読み終わっていない絵がある');
  await soft(page.waitForFunction(() => document.getAnimations().every((a) => {
    const t = a.effect && a.effect.getComputedTiming();
    return a.playState !== 'running' || (t && t.iterations === Infinity);
  }), { timeout: 15000 }), '動きが止まる前に撮った');
}

/* 撮る前のひと手間（今ある画面を実際に操作して、その状態を作る）。 */
const PREP = {
  /* 1問答える → 保存されたのを見届ける → 読み込み直す ＝ 前の回答が入った状態 */
  async answerThenReload(page, spec, ctx) {
    const row = `.pvcf-q[data-qid="${spec.qid}"]`;
    const opt = `${row} .pvc-opt[data-code="${spec.code}"]`;
    await page.waitForSelector(opt, { visible: true, timeout: 20000 });
    const picked = await page.$eval(opt, (b) => b.classList.contains('is-picked'));
    if (!picked) {
      await page.click(opt);
      await page.waitForFunction((r) => {
        const s = document.querySelector(r + ' .pvcf-state');
        return s && s.textContent.trim() && !s.classList.contains('is-bad');
      }, { timeout: 20000 }, row);
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page, ctx.notes);
    await page.waitForSelector(`${opt}.is-picked`, { timeout: 20000 });
  },
  /* 手元のサーバーに次の1回を失敗させてから答える ＝ 送れなかった時 */
  async failOne(page, spec, ctx) {
    const row = `.pvcf-q[data-qid="${spec.qid}"]`;
    const opt = `${row} .pvc-opt[data-code="${spec.code}"]`;
    await page.waitForSelector(opt, { visible: true, timeout: 20000 });
    await fetch(`${ctx.base}/__local/fail?n=1&match=submit_airline_conditions`);
    await page.click(opt);
    await page.waitForSelector(`${row} .pvcf-state.is-bad`, { timeout: 20000 });
  },

  /* ── ステイ先（set 'stay'）── 手元の保存先の上で、今ある画面を実際に操作して、その状態を作る ── */
  /* (3) 手元のオーナー 'op' が、その都市に公開のホテルを1つ、同じ空港に就航する別の会社にも1つ足す → 読み直す */
  async staySeed(page, spec, ctx) {
    const HERE = '撮影用のホテル（手元の見本）', OTHER = '撮影用の他社のホテル（手元の見本）';
    const has = async (airline, name) => {
      const r = await localRpc(ctx.base, 'op', 'pv_stays', { airline, iata: spec.iata });
      return !!(r && Array.isArray(r.places) && r.places.some((x) => x.name === name));
    };
    if (!(await has(spec.slug, HERE))) {
      const r = await localRpc(ctx.base, 'op', 'pv_stay_add', { airline: spec.slug, iata: spec.iata, kind: 'hotel', name: HERE, publish: true });
      if (!r || r.ok !== true) ctx.notes.add(`見本のホテル（${spec.slug}）を入れられない: ${JSON.stringify(r)}`);
    }
    /* 他社のぶんは、ログインしていない人が足し、オーナーが公開する（オーナーが続けて2つ足すと「続けて」で止まるため） */
    if (!spec.other) ctx.notes.add('同じ空港に就航する別の会社が、5社の中に無い');
    else if (!(await has(spec.other, OTHER))) {
      const g = await localRpc(ctx.base, null, 'pv_stay_add', { airline: spec.other, iata: spec.iata, kind: 'hotel', name: OTHER });
      const m = g && g.ok && g.item ? await localRpc(ctx.base, 'op', 'pv_stay_moderate', { target: 'place', id: g.item.id, state: 'public' }) : null;
      if (!m || m.ok !== true) ctx.notes.add(`他社の見本のホテル（${spec.other}）を公開できない: ${JSON.stringify(m || g)}`);
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page, ctx.notes);
    await stayState(page, 'open');
  },
  /* (6) 手元のサーバーに一覧の読み出しを失敗させたまま読み直す（欄が「読み込めませんでした」になったら戻す） */
  async stayFail(page, spec, ctx) {
    await fetch(`${ctx.base}/__local/fail?n=99&match=pv_stays`);
    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await stayState(page, 'error');
    } finally { await fetch(`${ctx.base}/__local/fail?n=0`); }
  },
  /* (7) 欄の外の「レストランを追加」を押す */
  async stayForm(page) {
    await stayState(page);
    await page.click(`${STAY_ZONE} .crs-ent[data-kind="food"]`);
    await page.waitForSelector(`${STAY_FORM} [data-k="name"]`, { visible: true, timeout: 20000 });
  },
  /* (8) 「ホテルを追加」→ 名前だけ打つ → 送る（1回押す）→ 送った人にだけ見える確認待ちのカード */
  async stayAdd(page) {
    await stayState(page);
    await page.click(`${STAY_ZONE} .crs-ent[data-kind="hotel"]`);
    await page.waitForSelector(`${STAY_FORM} [data-k="name"]`, { visible: true, timeout: 20000 });
    await page.type(`${STAY_FORM} [data-k="name"]`, '撮影用に足したホテル（手元の見本）');
    await page.click(`${STAY_FORM} button[type="submit"]`);
    await page.waitForFunction((z) => !!document.querySelector(z + ' .crs-own > .crs-card'), { timeout: 20000 }, STAY_ZONE);
  },
  /* (10) ステイ先の一覧で都市の3字を打つ → その都市を開く → ブラウザの「戻る」 */
  async stayBack(page, spec) {
    const q = '#pvg-st-q';
    const shown = () => page.$eval(q, (e) => e.getClientRects().length > 0).catch(() => false);
    if (!(await shown())) await page.click('#pvg-tabs [data-pvg-tab="stay"]');
    await page.waitForSelector(q, { visible: true, timeout: 20000 });
    await page.click(q);
    await page.type(q, spec.iata);
    const city = `#pvg-st-list a.pvg-city[data-city="${spec.iata}"]`;
    await page.waitForSelector(city, { visible: true, timeout: 20000 });
    await page.click(city);
    await page.waitForFunction(() => { const c = document.getElementById('pvg-city'); return !!c && c.getClientRects().length > 0; }, { timeout: 20000 });
    await page.evaluate(() => history.back());
    await page.waitForFunction((s, code) => {
      const e = document.querySelector(s), c = document.getElementById('pvg-city');
      return !!e && e.getClientRects().length > 0 && e.value === code && !(c && c.getClientRects().length);
    }, { timeout: 20000 }, q, spec.iata);
  },
  /* (11) ログインせずに「レストランを追加」に打つ（送らない）→ 欄の「ログイン」→ login.html で手元の会員 'b' のメールと
     手元のコード → 同じ都市へ戻る → Give → Get の板（その絵は -board.png）→ 板の × → 書きかけの面が戻る */
  async stayLogin(page, spec, ctx) {
    await stayState(page, 'locked');
    await page.click(`${STAY_ZONE} .crs-ent[data-kind="food"]`);
    await page.waitForSelector(`${STAY_FORM} [data-k="name"]`, { visible: true, timeout: 20000 });
    await page.type(`${STAY_FORM} [data-k="name"]`, '撮影用の書きかけの店（手元の見本）');
    await page.type(`${STAY_FORM} [data-k="note"]`, '撮影用の書きかけのひとこと（手元の見本）');
    await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }), page.click(`${STAY_SLOT} a[data-crs-entry="login"]`)]);
    const st = await (await fetch(`${ctx.base}/__local/state`)).json();
    await page.click('button[onclick="showEmailStep()"]');
    await page.waitForSelector('#otp-email', { visible: true, timeout: 20000 });
    await page.type('#otp-email', st.members.find((m) => m.key === 'b').email);
    await page.click('#otp-send-btn');
    await page.waitForSelector('#otp-code', { visible: true, timeout: 20000 });
    await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }), page.type('#otp-code', st.otp)]);
    await page.waitForSelector('.pvgf-x', { visible: true, timeout: 20000 });
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), { timeout: 15000 }).catch(() => ctx.notes.add('板の動きが止まる前に撮った'));
    await page.screenshot({ path: path.join(ctx.dir, `${ctx.id}-board.png`) });
    await page.click('.pvgf-x');
    await page.waitForFunction(() => { const x = document.querySelector('.pvgf-x'); return !x || !x.getClientRects().length; }, { timeout: 20000 });
    await page.waitForSelector(`${STAY_FORM} [data-k="name"]`, { visible: true, timeout: 20000 });
  },
};

/* 手元の保存先の関数を、その会員として外から呼ぶ（who が null ならログインなし）。返事の JSON（読めなければ null）。 */
async function localRpc(base, who, fn, p) {
  const headers = { 'content-type': 'application/json' };
  if (who) headers.authorization = `Bearer ${(await (await fetch(`${base}/__local/login?member=${who}`)).json()).session.access_token}`;
  const r = await fetch(`${base}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify({ p }) });
  return r.json().catch(() => null);
}
/* 都市の詳細の欄が、読み出しの待ちでない状態になるまで待つ（want を渡せば、その状態になるまで） */
const stayState = (page, want) => page.waitForFunction((sel, w) => {
  const e = document.querySelector(sel);
  const s = e && e.getClientRects().length ? e.getAttribute('data-state') || '' : '';
  return w ? s === w : !!s && !/^(idle|loading)$/.test(s);
}, { timeout: 20000 }, STAY_SLOT, want || '');

async function shootOne(browser, t, sizeKey, label, local, log) {
  const size = SIZES[sizeKey], spec = t[label];
  const base = t.who || t.local ? local.url : PUB;
  const notes = new Set(), blocked = new Set();
  const bctx = await browser.createBrowserContext();
  const page = await bctx.newPage();
  try {
    await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: 2, isMobile: size.touch, hasTouch: size.touch });
    await page.setRequestInterception(true);
    page.on('request', (req) => gate(req, base, blocked));
    page.on('pageerror', (e) => notes.add(`ページの中でエラー: ${String(e.message).slice(0, 120)}`));

    if (t.who || t.local) {
      /* 手元の会員として入る（t.local だけなら、ログインしていない人のまま）。切替の札は隠し、
         Give → Get の板は「さっき見た」ことにする（板そのものを撮りたいのではなく、その下の画面を撮りたい）。 */
      const d = t.who ? await (await fetch(`${base}/__local/login?member=${t.who}`)).json() : null;
      if (t.who && (!d || !d.session)) throw new Error(`手元の会員 ${t.who} で入れない`);
      await page.evaluateOnNewDocument((origin, s) => {
        if (location.origin !== origin) return;
        try {
          if (localStorage.getItem('pv_local_seeded')) return;
          localStorage.setItem('pv_local_ui', '0');
          localStorage.setItem('pv_local_seeded', '1');
          if (!s) return;
          const now = String(Date.now());
          localStorage.setItem('sb-local-auth-token', JSON.stringify(s.session));
          localStorage.setItem('pv_user', JSON.stringify(s.pv_user));
          localStorage.setItem('pv_last_active', now);
          localStorage.setItem('pv_session_start', now);
          /* ⚠️ 板の「ログインの印」は last_sign_in_at が第一（pv-session.js の sessionStart() と同じ順）。
             ここを now で書くと印が合わず、板が毎回出て下の画面を覆う（実際に踏んだ）。 */
          const at = Date.parse((s.session.user || {}).last_sign_in_at || '');
          localStorage.setItem('pv_give_seen', JSON.stringify({ t: Date.now(), s: String(isNaN(at) ? now : at) }));
        } catch (e) {}
      }, base, d);
    }

    const dir = path.join(OUT, label);
    fs.mkdirSync(dir, { recursive: true });
    const id = idOf(t, sizeKey);
    for (const f of fs.readdirSync(dir)) if (f.startsWith(id + '-')) fs.unlinkSync(path.join(dir, f));

    await page.goto(base + spec.path, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await settle(page, notes);
    if (spec.prep) {
      await PREP[spec.prep](page, spec, { base, notes, dir, id, size: sizeKey });
      await settle(page, notes);
    }
    const landed = new URL(page.url());
    const at = landed.pathname + landed.search + (spec.path.includes('#') ? landed.hash : '');
    if (at !== spec.path) notes.add(`別の住所へ移った: ${at}`);

    /* 最初の1画面（そのまま2倍の細かさで）。
       質問を指して開いた画面は、ページが運んでくれる位置（その行が画面のまんなか）で撮る。
       ⚠️ settle() は下まで歩いて先頭へ戻すので、何もしないと「目当ての質問」が写らない。 */
    if (spec.focus) {
      const ok = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el || !el.getClientRects().length) return false;
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        return true;
      }, spec.focus);
      if (!ok) notes.add('目当ての行が画面に無い');
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    }
    await page.screenshot({ path: path.join(dir, `${id}-fold.png`) });

    /* ページ全体。長いページは1枚に収まらないので、縦に切って撮る（台紙の上で積む）。foldOnly は最初の1画面だけ。 */
    if (!t.foldOnly) {
      await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: 1, isMobile: size.touch, hasTouch: size.touch });
      await settle(page, notes);
    }
    const H = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0));
    const CUT = 6000, slices = [];
    for (let y = 0, i = 0; !t.foldOnly && y < H; y += CUT, i++) {
      const f = `${id}-full-${i}.png`;
      await page.screenshot({ path: path.join(dir, f), clip: { x: 0, y, width: size.w, height: Math.min(CUT, H - y) }, captureBeyondViewport: true });
      slices.push(f);
    }
    log(`  ✓ ${id}  高さ ${H}px${notes.size ? '  ⚠ ' + [...notes].join(' / ') : ''}`);
    return {
      id, key: t.key, set: t.set, size: sizeKey, path: spec.path, who: t.who || null, caption: t.caption || null,
      base: t.who || t.local ? '手元の保存先' : '本番を読むだけ（未ログイン）',
      height: H, slices, notes: [...notes], blocked: [...blocked], at: new Date().toISOString(),
    };
  } finally {
    await bctx.close();
  }
}

async function shoot(label) {
  if (label !== 'current' && label !== 'draft') throw new Error('shoot current か shoot draft');
  const { targets, sizes } = pick();
  const todo = targets.filter((t) => t[label]);
  const skipped = targets.filter((t) => !t[label]);
  if (!todo.length) throw new Error('撮るものが無い');

  let local = null, tmp = null;
  if (todo.some((t) => t.who || t.local)) {
    const { start } = await import('./serve-local.mjs');
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-glance-'));
    console.log('  手元の保存先（使い捨て）を立てている…');
    local = await start({ port: 0, dir: tmp, quiet: true });
  }
  if (todo.some((t) => !t.who && !t.local)) {
    const ok = await fetch(PUB + '/index.html').then((r) => r.ok, () => false);
    if (!ok) throw new Error(`${PUB} が動いていない（node serve.mjs）`);
  }

  const browser = await launch();
  const metaPath = path.join(OUT, label, 'meta.json');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
  const failed = [], blockedAll = new Set();
  try {
    /* 画面ごとに全部の大きさを撮り切ってから次へ（回答を入れる画面は TARGETS の最後に置いてある）。 */
    for (const t of todo) {
      for (const s of sizes) {
        try {
          const m = await shootOne(browser, t, s, label, local, console.log);
          meta[m.id] = m;
          m.blocked.forEach((b) => blockedAll.add(b));
        } catch (e) {
          failed.push(`${idOf(t, s)}: ${String(e.message).split('\n')[0].slice(0, 200)}`);
          console.log(`  ✗ ${idOf(t, s)}  ${String(e.message).split('\n')[0].slice(0, 200)}`);
        }
      }
    }
  } finally {
    await browser.close();
    if (local) await local.close();
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(metaPath), { recursive: true });
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 1));

  if (skipped.length) console.log(`  — ${label} が無いもの: ${skipped.map((t) => t.key).join(', ')}`);
  if (blockedAll.size) { console.log('  止めた通信（解析タグ以外）:'); for (const b of blockedAll) console.log('    ' + b); }
  if (failed.length) { console.log(`\n  ✗ 撮れなかった ${failed.length} 枚`); process.exitCode = 1; }
  else console.log(`\n  ✓ ${label}: ${todo.length} 画面 × ${sizes.length} つの大きさ`);
}

/* ── 台紙 ─────────────────────────────────────────────── */
function refs() {
  const dirs = vals('--ref');
  const dst = path.join(OUT, 'ref');
  fs.mkdirSync(dst, { recursive: true });
  const want = new Set(TARGETS.flatMap((t) => Object.values(t.ref || {}).flat()));
  for (const name of want) {
    for (const d of dirs) {
      const hit = [d, path.join(d, 'screenshots'), path.join(d, 'images')].map((p) => path.join(p, name)).find((p) => fs.existsSync(p));
      if (hit) { fs.copyFileSync(hit, path.join(dst, name)); break; }
    }
  }
  return (name) => (fs.existsSync(path.join(dst, name)) ? `../ref/${encodeURIComponent(name)}` : null);
}

const CSS = `
:root{--bg:#f2f0ea;--ink:#17201b;--mute:#667069;--line:#d6d2c7;--card:#fff;--mark:#b3402e}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 -apple-system,"Hiragino Sans","Yu Gothic",sans-serif}
header{padding:22px 28px 6px}
h1{font-size:19px;margin:0;letter-spacing:.01em}
.sub{color:var(--mute);font-size:12.5px;margin-top:2px}
.cols{display:flex;gap:28px;padding:14px 28px 36px;align-items:flex-start}
figure{margin:0;flex:none}
figcaption{font-weight:700;font-size:15px;margin-bottom:8px;min-height:44px}
figcaption small{display:block;font-weight:400;font-size:12px;color:var(--mute)}
.frame{background:var(--card);border:1px solid var(--line);overflow:hidden;position:relative}
.frame img{display:block;width:100%}
.frame img+img{border-top:1px dashed var(--line)}
.none{display:flex;align-items:center;justify-content:center;color:var(--mute);padding:28px;text-align:center;min-height:180px}
.fold{position:absolute;left:0;right:0;height:0;border-top:2px dashed var(--mark);pointer-events:none}
.fold span{position:absolute;right:6px;top:2px;font-size:11px;color:var(--mark);background:rgba(255,255,255,.86);padding:0 4px}
ul{padding:8px 28px 40px 48px;margin:0}
li{margin:3px 0}
a{color:#1f5f4a}
h2{font-size:15px;margin:22px 28px 0}
`;

function column(title, note, body, col) {
  return `<figure style="width:${col}px"><figcaption>${esc(title)}<small>${esc(note || '')}</small></figcaption>${body}</figure>`;
}

function sheetHtml(t, sizeKey, mode, ref, metas) {
  const size = SIZES[sizeKey], col = size.col, k = col / size.w;
  const foldH = Math.round(size.h * k);
  const id = idOf(t, sizeKey);

  const refNames = (t.ref && t.ref[sizeKey]) || [];
  const refUrls = refNames.map((n) => [n, ref(n)]).filter(([, u]) => u);
  const refNote = refUrls.length
    ? [...new Set(refUrls.map(([n]) => REF_NOTE[n]).filter(Boolean)), '数字・口コミ・件数は古いか架空（配置の見本）'].join('・')
    : '';
  let refBody;
  if (!refUrls.length) refBody = `<div class="frame none" style="height:${mode === 'fold' ? foldH : 260}px">${esc(t.refNone || 'この大きさの見本は無い')}</div>`;
  else if (mode === 'fold') refBody = `<div class="frame" style="height:${foldH}px"><img src="${refUrls[0][1]}" alt=""></div>`;
  else refBody = `<div class="frame">${refUrls.map(([, u]) => `<img src="${u}" alt="">`).join('')}</div>`;

  const shot = (label, emptyNote) => {
    const m = metas[label] && metas[label][id];
    if (!m) return [`<div class="frame none" style="height:${mode === 'fold' ? foldH : 260}px">${esc(emptyNote)}</div>`, ''];
    const note = [m.caption, m.base + (m.who ? `・会員 ${m.who}` : ''), `高さ ${m.height}px`, ...(m.notes || [])].filter(Boolean).join('・');
    if (mode === 'fold') return [`<div class="frame" style="height:${foldH}px"><img src="../${label}/${id}-fold.png" alt=""></div>`, note];
    return [`<div class="frame">${m.slices.map((f) => `<img src="../${label}/${f}" alt="">`).join('')}` +
      `<div class="fold" style="top:${foldH}px"><span>最初の1画面はここまで</span></div></div>`, note];
  };
  const [curBody, curNote] = shot('current', t.current ? 'まだ撮っていない' : (t.currentNote || '今は無い'));
  const [draBody, draNote] = shot('draft', 'まだ無い');

  const head = `${t.ja} — ${size.ja} ${size.w}×${size.h} — ${mode === 'fold' ? '最初の1画面' : 'ページ全体'}`;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex"><title>${esc(head)}</title><style>${CSS}</style></head><body>` +
    `<header><h1>${esc(head)}</h1><div class="sub">見本｜現行｜初稿</div></header><div class="cols">` +
    column('見本', refNote, refBody, col) +
    column('現行', [t.current && t.currentNote, curNote].filter(Boolean).join('・'), curBody, col) +
    column('初稿', draNote, draBody, col) +
    `</div></body></html>`;
}

async function sheet() {
  const { targets, sizes } = pick();
  const ref = refs();
  const metas = {};
  for (const label of ['current', 'draft']) {
    const p = path.join(OUT, label, 'meta.json');
    metas[label] = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
  }
  const dir = path.join(OUT, 'sheets');
  fs.mkdirSync(dir, { recursive: true });
  const urlOf = (f) => `${PUB}/${encodeURIComponent('temporary screenshots')}/glance/sheets/${f}`;
  const ok = await fetch(PUB + '/index.html').then((r) => r.ok, () => false);
  if (!ok) throw new Error(`${PUB} が動いていない（node serve.mjs）`);

  const browser = await launch();
  const made = [];
  try {
    const page = await browser.newPage();
    for (const t of targets) {
      for (const s of sizes) {
        for (const mode of t.foldOnly ? ['fold'] : ['fold', 'full']) {
          const name = `${idOf(t, s)}-${mode}`;
          fs.writeFileSync(path.join(dir, name + '.html'), sheetHtml(t, s, mode, ref, metas));
          const W = SIZES[s].col * 3 + 28 * 4;
          /* 高さは小さく置く（scrollHeight は「中身」と「窓」の大きいほうを返すので、
             窓を 900 にすると短い台紙の下に余白が付く）。 */
          await page.setViewport({ width: W, height: 120, deviceScaleFactor: mode === 'fold' ? 2 : 1 });
          await page.goto(urlOf(name + '.html'), { waitUntil: 'load', timeout: 45000 });
          await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0), { timeout: 30000 });
          for (const f of fs.readdirSync(dir)) if (f.startsWith(name + '.') && f.endsWith('.png') || f.startsWith(name + '-') && f.endsWith('.png')) fs.unlinkSync(path.join(dir, f));
          const H = await page.evaluate(() => document.documentElement.scrollHeight);
          const CUT = 7000, pngs = [];
          if (H <= CUT) {
            await page.screenshot({ path: path.join(dir, name + '.png'), fullPage: true });
            pngs.push(name + '.png');
          } else {
            for (let y = 0, i = 0; y < H; y += CUT, i++) {
              const f = `${name}-${i}.png`;
              await page.screenshot({ path: path.join(dir, f), clip: { x: 0, y, width: W, height: Math.min(CUT, H - y) }, captureBeyondViewport: true });
              pngs.push(f);
            }
          }
          made.push({ t, s, mode, name, pngs });
        }
      }
    }
  } finally {
    await browser.close();
  }

  /* 入口の1枚（開いて回る用）。絞って作り直した回も、在る台紙は全部載せる。 */
  const all = fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html');
  const rows = TARGETS.map((t) => {
    const links = Object.keys(SIZES).flatMap((s) => (t.foldOnly ? ['fold'] : ['fold', 'full']).map((mode) => {
      const f = `${idOf(t, s)}-${mode}.html`;
      return all.includes(f) ? `<a href="${f}">${esc(SIZES[s].ja)}・${mode === 'fold' ? '最初の1画面' : '全体'}</a>` : null;
    })).filter(Boolean);
    return links.length ? `<li><b>${esc(t.ja)}</b>　${links.join('　')}</li>` : '';
  }).join('');
  fs.writeFileSync(path.join(dir, 'index.html'),
    `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex"><title>台紙の一覧</title><style>${CSS}</style></head><body>` +
    `<header><h1>台紙の一覧</h1><div class="sub">見本｜現行｜初稿　── 会社ページの初稿（方向の確認用）。情報を足す画面と、5つのタブ分けは未着手</div></header><ul>${rows}</ul></body></html>`);

  console.log(`  ✓ 台紙 ${made.length} 枚 → temporary screenshots/glance/sheets/`);
  console.log(`  入口 ${urlOf('index.html')}`);
}

/* ── コマンド ─────────────────────────────────────────── */
try {
  const cmd = argv[0];
  if (cmd === 'shoot') await shoot(argv[1]);
  else if (cmd === 'sheet') await sheet();
  else {
    console.log('使い方: node shot-glance.mjs shoot current|draft [--only …] [--sizes …] [--set …]');
    console.log('        node shot-glance.mjs shoot draft --set stay [--only jal|jal-s3] [--sizes iphone,ipad-p,pc]');
    console.log('        node shot-glance.mjs sheet --ref <見本のフォルダ> [--ref …]');
    process.exitCode = 1;
  }
} catch (e) {
  console.error('  ✗ ' + String(e.message).split('\n')[0].slice(0, 260));
  process.exitCode = 1;
}
