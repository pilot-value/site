/* ════════════════════════════════════════════════════════════════
   gen-mail-airline-shots.mjs — お知らせメール（send.mjs pages）に埋め込む、会社ページの「概要」の絵を撮る
   （2026-10-30 オーナー指示「自分の所属する航空会社の概要ページのスクショをメール上で見れるように」）

   撮るのは**本番の公開ページを、ログインしていない訪問者として**。会員がリンクを押して見るものと同じ絵になる。
   ・PC の画面（1280px・1.5倍。オーナー「pc 画面のを送ればいいよ」）・ライトのテーマ・日本語は円／英語はドル（英語は米国の時計で開く＝既定がドル）
   ・ページの頭から、概要のタブの「給与」のカードの推定年収まで（下端は背景へぼかす）
   ・GA4 などの解析タグの通信は止める（撮影で訪問数を汚さない）
   ・JPEG（撮影情報は付かない）。1枚 200KB を超えたら画質を下げて撮り直す

   出るもの: mail-bot/.page-shots/{code}-{ja|en}.jpg（会社ページのある112社）と directory-{ja|en}.jpg（一覧）・vote-{ja|en}.jpg（Vote）
     ★gitignore 済み。リポジトリに入れない（絵はメールに埋め込んで送る）。

   使い方:
     node gen-mail-airline-shots.mjs                    … 全社 × 日英（一覧の2枚も）
     node gen-mail-airline-shots.mjs --only=jal,emirates … 数社だけ（下見用）
     node gen-mail-airline-shots.mjs --lang=ja           … 片方の言語だけ
     node gen-mail-airline-shots.mjs --missing           … まだ撮っていない絵だけ
   ════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/* ★絶対パスを書かない（このリポジトリは PUBLIC）。 */
const ROOT = fileURLToPath(new URL('.', import.meta.url));
export const SHOT_DIR = path.join(ROOT, 'mail-bot', '.page-shots');
const BASE = 'https://pilot-value.com';

const args = process.argv.slice(2);
const arg = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || '';
const ONLY = arg('only').split(',').map((s) => s.trim()).filter(Boolean);
const LANGS = arg('lang') ? [arg('lang')] : ['ja', 'en'];
const MISSING = args.includes('--missing');
const MAX_BYTES = 200 * 1024;
const VW = 1280;
const DPR = 1.5;

/* 会社ページを持つのは pv-airlines.json の kind === 'airline' の会社だけ（チャーター・ビジネスジェット等はページが無い）。 */
const AIR = JSON.parse(fs.readFileSync(path.join(ROOT, 'pv-airlines.json'), 'utf8')).airlines || {};
const CODES = Object.keys(AIR).filter((c) => AIR[c].kind === 'airline');
/* 会社ではない2枚：一覧（directory）と Vote（vote）。 */
const PAGES = { directory: 'world-airlines.html', vote: 'community.html' };
const bad = ONLY.filter((c) => !PAGES[c] && !CODES.includes(c));
if (bad.length) { console.error(`❌ 会社ページの無いコード: ${bad.join(', ')}`); process.exit(1); }

const jobs = [];
for (const l of LANGS) {
  const pre = l === 'en' ? 'en/' : '';
  const list = ONLY.length ? ONLY : [...CODES, ...Object.keys(PAGES)];
  for (const c of list) {
    const url = PAGES[c] ? `${BASE}/${pre}${PAGES[c]}` : `${BASE}/${pre}airlines/${c}.html`;
    jobs.push({ code: c, lang: l, url, out: path.join(SHOT_DIR, `${c}-${l}.jpg`) });
  }
}
fs.mkdirSync(SHOT_DIR, { recursive: true });

/* 解析・広告の通信は止める。サイト本体と Supabase（公開の読み取り）とフォントは通す。 */
const BLOCK = /googletagmanager|google-analytics|analytics\.google|doubleclick|googlesyndication|clarity\.ms|facebook|hotjar|plausible|cloudflareinsights/i;

/* headless:'new' はこの環境で screenshot が返ってこないことがある（shot-remind.mjs と同じ）。 */
const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
let ok = 0, fail = 0;
try {
  for (const j of jobs) {
    if (MISSING && fs.existsSync(j.out)) continue;
    /* 1枚ごとに新しい窓＝保存領域もログインも持ち越さない（いつも初めての訪問者）。 */
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    try {
      /* ★PC の画面で撮る（2026-10-30 オーナー「pc 画面のを送ればいいよ」）。 */
      await page.setViewport({ width: VW, height: 900, deviceScaleFactor: DPR });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.emulateTimezone(j.lang === 'en' ? 'America/New_York' : 'Asia/Tokyo');
      await page.setRequestInterception(true);
      page.on('request', (r) => (BLOCK.test(r.url()) ? r.abort() : r.continue()));
      const res = await page.goto(j.url, { waitUntil: 'networkidle2', timeout: 60000 });
      if (!res || res.status() !== 200) throw new Error(`HTTP ${res ? res.status() : '—'}`);
      await page.evaluate(() => document.fonts && document.fonts.ready);
      /* Vote は会社のカードを後から読み込む。読み込み中の灰色の板が消えるまで待つ。 */
      if (j.code === 'vote') {
        await page.waitForFunction(() => {
          const g = document.querySelector('#vt-co-grid');
          return g && g.children.length > 0 && !g.querySelector('.vt-skel');
        }, { timeout: 30000 });
        await new Promise((r) => setTimeout(r, 600));   // 六角形と棒が描き終わるのを待つ
      }
      /* 切り取る範囲：
         ・会社ページ … ページの頭から「給与」のカードの推定年収の棒（.pvg-ranks）の下まで
           ★その下（提出された年収・Give & Get のボタン）は写さない ── 全員に送るお知らせに誘いのボタンを載せない。
         ・Vote … 「よく見られている会社」の段（#companies）の1列目のカードまで。左のメニューは含めない。
           ★「最新の口コミ」の段は写さない ── お知らせメールに口コミの本文を載せない決まり（週のまとめと同じ。
             本文に金額を書いた投稿もある）。その段の下の「投稿して解放する」の誘いも写さない。
         ・一覧 … 最初の1画面
         切れ目は下の 56px を背景の色へぼかして、途中で切れた感じを消す。 */
      const kind = PAGES[j.code] ? j.code : 'airline';
      const clip = await page.evaluate((kind, VW) => {
        window.scrollTo(0, 0);
        let c = { x: 0, y: 0, width: VW, height: 900 };
        if (kind === 'airline') {
          const el = document.querySelector('.pvg-pay .pvg-ranks') || document.querySelector('.pvg-co');
          if (!el) return null;
          c.height = Math.ceil(el.getBoundingClientRect().bottom + window.scrollY + 40);
        } else if (kind === 'vote') {
          const sec = document.querySelector('#companies');
          const cards = [...document.querySelectorAll('#vt-co-grid > *')];
          if (!sec || !cards.length) return null;
          const s = sec.getBoundingClientRect();
          const top0 = cards[0].getBoundingClientRect().top;
          const row = cards.filter((x) => Math.abs(x.getBoundingClientRect().top - top0) < 4);
          const bottom = Math.max(...row.map((x) => x.getBoundingClientRect().bottom));
          c = { x: Math.max(0, Math.floor(s.left - 24)), y: Math.floor(s.top + window.scrollY - 24),
                width: Math.ceil(s.width + 48), height: Math.ceil(bottom - s.top + 24 + 40) };
        }
        const bg = getComputedStyle(document.body).backgroundColor || '#fff';
        const fade = document.createElement('div');
        fade.style.cssText = `position:absolute;left:0;right:0;top:${c.y + c.height - 56}px;height:56px;z-index:2147483647;`
          + `pointer-events:none;background:linear-gradient(to bottom,transparent,${bg})`;
        document.body.appendChild(fade);
        return c;
      }, kind, VW);
      if (!clip) throw new Error('切る目印が見つからない（ページの形が変わった？）');
      clip.height = Math.min(clip.height, 2400);
      let q = 72;
      for (;;) {
        await page.screenshot({ path: j.out, type: 'jpeg', quality: q, clip, captureBeyondViewport: true });
        const size = fs.statSync(j.out).size;
        if (size <= MAX_BYTES || q <= 40) break;
        q -= 8;
      }
      ok++;
      console.log(`✓ ${path.basename(j.out)}  ${Math.round(fs.statSync(j.out).size / 1024)}KB  高さ ${clip.height}px`);
    } catch (e) {
      fail++;
      console.error(`❌ ${j.code}-${j.lang}: ${e.message}`);
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
console.log(`\n${ok} 枚 ／ 失敗 ${fail}`);
process.exit(fail ? 1 : 0);
