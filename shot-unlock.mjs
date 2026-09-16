/* shot-unlock.mjs — 口コミ／年収の「解放」まわりを目で見るためだけのスクリプト
     （判定は assert-unlock.mjs が持つ。こちらは絵を出すだけ）

   2026-08-22 に口コミの鍵から期限を外した。文言から「30日／1ヶ月」を全部落としたので、
   実際の画面に期間の言葉と日付が残っていないかを目で確かめる。

   実行: node shot-unlock.mjs <scene> <lang> [open]
     scene = profile   マイページ上部（解放バッジ2つ。口コミ側に日付が出ないこと）
             gate      航空会社ページの年収枠（鍵つき。口コミの鍵では開かない）
             locked    口コミ一覧の未解放（gate-panel）
             snip      口コミ一覧の未解放カード1枚（先頭40字が読めること）
             snipair   航空会社ページの未解放カード1枚（同上）
             open      口コミ一覧の解放済み（🔓バッジ）
             done      口コミ投稿の完了画面
     lang  = ja | en
     第3引数 open ＝ 撮らずに見える窓で開いたままにする

   ⚠️ localhost が要る（node serve.mjs）。本番の DB には触らない（Supabase ごと差し替える）。
*/
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT  = fileURLToPath(new URL('.', import.meta.url));
const BASE  = 'http://localhost:3000';
const scene = process.argv[2] || 'profile';
const lang  = process.argv[3] === 'en' ? 'en' : 'ja';
const show  = process.argv[4] === 'open';

const YEAR = 365 * 24 * 60 * 60 * 1000;
const UID  = '00000000-0000-4000-8000-00000000b001';

/* assert-unlock.mjs と同じ差し替え。rpc は本物と同じ「then だけを持つ箱」＝ async にしない */
function stub(page, { hasReview, accessUntil, preset }) {
  return page.evaluateOnNewDocument((uid, hasReview, accessUntil, preset) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('pv-theme', 'dark');
    localStorage.setItem('pv_user', JSON.stringify({ id: uid, name: 'Test Pilot', email: 'unlock-test@example.com' }));
    /* 本物のログインした端末には supabase の鍵も在る（2026-09-14）。
       これを置かないと pv-session.js が「名前だけ残った死んだログイン」と見なして
       pv_user と解放の写しを捨てる＝ここから下の検査が全部すり抜ける。 */
    localStorage.setItem('sb-vzgmnkrggrwtsrpqndsm-auth-token', 'base64-dGVzdA==');
    localStorage.setItem('pv_last_active', String(Date.now()));
    for (const [k, v] of Object.entries(preset || {})) localStorage.setItem(k, String(v));

    function q(rows) {
      const o = { data: rows, error: null,
        select: () => o, eq: () => o, in: () => o, order: () => o, limit: () => o,
        single: async () => ({ data: rows[0] || null, error: null }),
        maybeSingle: async () => ({ data: rows[0] || null, error: null }),
        then: (res) => res({ data: rows, error: null }) };
      return o;
    }
    const REPORTS = { ok: true, reports: [], report_count: accessUntil ? 1 : 0,
      access_until: accessUntil || null, badge: null, badge_state: null };
    const FAKE = {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: uid, email: 'unlock-test@example.com' } } } }),
        getUser:    async () => ({ data: { user: { id: uid, email: 'unlock-test@example.com' } } }),
        signOut:    async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      rpc: (name) => {
        let data = { ok: true };
        if (name === 'my_pay_reports') data = REPORTS;
        /* 口コミの本文はサーバ側で止めてある（db/reviews-gate.sql）。
           絵を撮る側も同じ道を通す＝本番と同じ見た目になる。 */
        if (name === 'pv_reviews') {
          /* ★鍵の無い人にも「最初に書かれた欄の先頭40字」が1つだけ付く（2026-09-16）。
               ここを空の配列に戻すと、錠前の場面に口コミカードが1枚も写らない。
               o / t.en はどちらもきっかり40字＋「…」。 */
          const CLIP_JA = 'ここは訓練の面倒見がよく、先輩が丁寧に教えてくれる会社です。路線も落ち着いていて…';
          const CLIP_EN = 'Training here is thorough and the senior…';
          data = { ok: true, unlocked: hasReview,
                   rows: hasReview
                     ? [{ id: 'r1', airline: 'ana', cats: [] }]
                     : [{ id: 'r1', airline: 'ana', position: 'captain',
                          tenure_bucket: '5-9年', created_at: '2026-08-01T00:00:00Z',
                          cats: ['culture'],
                          clip: { k: 'culture', o: CLIP_JA, t: { en: CLIP_EN } } }] };
        }
        const res = { data: data, error: null };
        return { then: (y, n) => Promise.resolve(res).then(y, n) };
      },
      from: (t) => q(t === 'reviews_v2' && hasReview ? [{ id: 'r1' }] : []),
    };
    Object.defineProperty(window, 'supabase',
      { value: { createClient: () => FAKE }, writable: false, configurable: false });
  }, UID, hasReview, accessUntil, preset || {});
}

const FAR    = Date.now() + 50 * YEAR;
const NINETY = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
const p = (jp, en) => (lang === 'en' ? '/en' + en : jp);

const SCENES = {
  profile: { url: p('/profile.html', '/profile.html'),
             opt: { hasReview: true, accessUntil: NINETY, preset: { pv_unlock_expiry: FAR } },
             clip: '#unlock-status' },
  /* ★年収枠は「年収・給与」タブの中にある（airline-reviews-ui.js の switchTab が
       他タブの要素に display:none を入れる）。押さずに撮ると何も写らない。 */
  gate:    { url: p('/airlines/ana.html', '/airlines/ana.html'),
             opt: { hasReview: false, accessUntil: null, preset: {} },
             tab: 'salary', clip: '.premium-gate' },
  rvgate:  { url: p('/airlines/ana.html', '/airlines/ana.html'),
             opt: { hasReview: false, accessUntil: null, preset: {} },
             tab: 'reviews', clip: '.rv-post-gate' },
  locked:  { url: p('/community.html', '/community.html'),
             opt: { hasReview: false, accessUntil: null, preset: {} },
             clip: '#gate-panel' },
  /* ★鍵の無い人のカード1枚（2026-09-16）。先頭40字＋「…」が読めて、
       その下に錠前の面と CTA が残っていることを目で見るための場面。 */
  snip:    { url: p('/community.html', '/community.html'),
             opt: { hasReview: false, accessUntil: null, preset: {} },
             clip: '.review-card' },
  /* 同じ抜粋が航空会社ページ（110社）でも出ること。
     ⚠️ EN の航空会社ページも読み口は airlines/airline-reviews-ui.js（日本語側と同じ1本）。
        en/airlines/en-airline-reviews.js はどの HTML からも読まれていない。 */
  snipair: { url: p('/airlines/ana.html', '/airlines/ana.html'),
             opt: { hasReview: false, accessUntil: null, preset: {} },
             tab: 'reviews', clip: '.rv-card-wrap' },
  open:    { url: p('/community.html', '/community.html'),
             opt: { hasReview: true, accessUntil: null, preset: { pv_unlock_expiry: FAR } },
             clip: '#unlock-badge' },
  done:    { url: p('/submit-review.html', '/submit-review.html'),
             opt: { hasReview: true, accessUntil: null, preset: { pv_unlock_expiry: FAR } },
             clip: '#step-success' },
};
const S = SCENES[scene];
if (!S) { console.error('scene は ' + Object.keys(SCENES).join(' / ')); process.exit(1); }

const browser = await puppeteer.launch(show
  ? { headless: false, defaultViewport: null, args: ['--window-size=1280,1000'] }
  : { headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
if (!show) await page.setViewport({ width: 1280, height: 1000 });
await stub(page, S.opt);
await page.goto(BASE + S.url, { waitUntil: 'networkidle2', timeout: 40000 });
await new Promise((r) => setTimeout(r, 1600));

if (S.tab) {
  await page.evaluate((t) => {
    const b = document.querySelector('.airline-tab-btn[data-tab="' + t + '"]');
    if (b) b.click();
  }, S.tab);
  await new Promise((r) => setTimeout(r, 700));
}

/* 完了画面はサーバに投げないと出ないので、その一枚だけ直に見せる */
if (scene === 'done') {
  await page.evaluate(() => {
    document.querySelectorAll('[id^="step-"]').forEach((el) => { el.style.display = 'none'; });
    const s = document.getElementById('step-success');
    if (s) { s.style.display = ''; s.scrollIntoView({ block: 'center' }); }
  });
  await new Promise((r) => setTimeout(r, 400));
}

if (show) {
  console.log(`見える窓で開いた（${scene} / ${lang}）。閉じるとこのコマンドも終わる。`);
  await new Promise(() => {});
}

const dir = path.join(ROOT, 'temporary screenshots');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const n = readdirSync(dir).filter((f) => /^screenshot-\d+/.test(f))
  .reduce((m, f) => Math.max(m, Number(f.match(/^screenshot-(\d+)/)[1])), 0) + 1;
const out = path.join(dir, `screenshot-${n}-unlock-${scene}-${lang}.png`);

/* ★ scrollIntoView してからビューポートを撮る、では狙った物が写らないことがある
     （口コミ一覧は下まで行くと続きを描き足すので、撮る頃には位置がずれている）。
     要素の箱を測って、その周り 40px ごと切り出す。 */
const el = S.clip ? await page.$(S.clip) : null;
const box = el ? await el.boundingBox() : null;
if (box) {
  const pad = 40;
  const full = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewport({ width: 1280, height: Math.min(full, 4000) });
  await new Promise((r) => setTimeout(r, 500));
  const b2 = (await (await page.$(S.clip)).boundingBox()) || box;
  await page.screenshot({ path: out, clip: {
    x: Math.max(0, b2.x - pad), y: Math.max(0, b2.y - pad),
    width: Math.min(1280, b2.width + pad * 2), height: Math.min(1400, b2.height + pad * 2) } });
} else {
  console.log(`（${S.clip} が無かったので画面全体を撮る）`);
  await page.screenshot({ path: out });
}
console.log(out.replace(ROOT, ''));
await browser.close();
