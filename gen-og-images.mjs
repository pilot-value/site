/* ════════════════════════════════════════════════════════════════
   gen-og-images.mjs — OGP 画像（1200×630）を生成する

   なぜ必要か: 全288ページに og:image が無かった。twitter:card は
   summary_large_image を宣言しているのに画像が無いので、SNS・Slack・
   LINE に貼られたとき文字だけのカードになる。検索順位そのものより
   「共有されたときのクリック率」＝被リンクと指名検索の入口を落としていた。

   出力（JPEG）
     assets/og/default-ja.jpg / default-en.jpg      … サイト共通
     assets/og/a-{slug}-ja.jpg / a-{slug}-en.jpg    … 航空会社110社（年収入り）
     assets/og/c-{country}-ja.jpg / -en.jpg         … 国別ハブ

   ★ PNG ではなく JPEG。背景の SVG ノイズ質感が PNG の可逆圧縮と
     相性最悪で、276枚で 123MB になった（1枚445KB）。JPEG なら
     見た目を保ったまま 1/8 以下になる。OGP に透過は不要。

   年収の数値は salary-data.mjs（SSOT）から取る。画像に焼き込むので
   SSOT を更新したらこのスクリプトも再実行する（冪等・上書き）。

   実行: node gen-og-images.mjs            全部
        node gen-og-images.mjs default    共通のみ（速い）
════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { SALARY } from './salary-data.mjs';
import { COUNTRIES, airlinesOf } from './airline-countries.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/%20/g, ' ');
const OUT = path.join(ROOT, 'assets', 'og');
fs.mkdirSync(OUT, { recursive: true });

/* 引数の意味
     （無し）    … 全部
     default    … 共通カード2枚だけ
     それ以外   … 出力ファイル名にその文字列を含むものだけ（例: eurowings, c-de）
   1社足しただけで324枚を焼き直さないための絞り込み。 */
const only = process.argv[2];

/* 掲載社数は SSOT から取る。ここを固定文字列にすると、社を足したとき
   画像の中の数字だけが古いまま残る（画像は seo-normalize の社数補正が効かない）。 */
const N_AIRLINES = Object.keys(SALARY).length;

/* ワードマークはロゴ PNG を縮小せず CSS で組む。
   baland_ass/ロゴイメージ.png は余白の広い正方形カードなので、
   52px まで縮めると文字が潰れて「小さい黒い箱」にしか見えなかった。 */

/* 万円 → 表示。通貨切替は画像では効かないので、JA は円・EN は USD で焼く。 */
const USD = 160; // 1 USD = 160 JPY（サイト全体の換算レートに合わせる）
const fmtJa = (man) => `${man.toLocaleString('en-US')}万円`;
const fmtEn = (man) => `$${Math.round((man * 10000) / USD / 1000)}K`;

/* ── カード HTML ───────────────────────────────────────────────
   ブランド配色（tailwind.config と同一）: bg #0a0c0f / accent #3d9bff /
   gold #f5c842 / text #e8edf2 / muted #6b7d93
   放射グラデーション2枚＋SVG ノイズで奥行きを出す（CLAUDE.md の指針）。 */
const card = ({ eyebrow, title, stats, lang }) => `
<div class="wrap">
  <div class="glow-a"></div><div class="glow-b"></div><div class="noise"></div>
  <div class="inner">
    <div class="top">
      <span class="mark">PIL<span class="o">O</span>T&nbsp;VALUE</span>
      <span class="eyebrow">${eyebrow}</span>
    </div>
    <h1 class="${lang === 'ja' ? 'ja' : 'en'}">${title}</h1>
    ${stats ? `<div class="stats">${stats.map((s) => `
      <div class="stat">
        <div class="k">${s.k}</div>
        <div class="v">${s.v}</div>
      </div>`).join('')}</div>` : ''}
    <div class="foot">pilot-value.com</div>
  </div>
</div>`;

const shell = (body) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Noto+Sans+JP:wght@400;700;900&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;overflow:hidden;background:#0a0c0f}
  .wrap{position:relative;width:1200px;height:630px;background:#0a0c0f;overflow:hidden}
  .glow-a{position:absolute;width:900px;height:900px;left:-220px;top:-380px;
    background:radial-gradient(circle,rgba(61,155,255,.28) 0%,rgba(61,155,255,0) 62%)}
  .glow-b{position:absolute;width:760px;height:760px;right:-200px;bottom:-330px;
    background:radial-gradient(circle,rgba(245,200,66,.16) 0%,rgba(245,200,66,0) 62%)}
  .noise{position:absolute;inset:0;opacity:.35;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
    background-size:150px}
  .inner{position:relative;height:100%;padding:64px 72px;display:flex;flex-direction:column}
  .top{display:flex;align-items:center;gap:24px;margin-bottom:38px}
  .mark{font-family:Inter,sans-serif;font-size:31px;font-weight:900;letter-spacing:.14em;
    color:#fff;white-space:nowrap}
  /* ロゴの O は照準（クロスヘア）を重ねた字形。円環＋十字で近似する。 */
  .mark .o{position:relative;display:inline-block;color:transparent}
  .mark .o::before{content:'';position:absolute;left:50%;top:50%;width:.72em;height:.72em;
    transform:translate(-50%,-50%);border:3.4px solid #fff;border-radius:50%}
  .mark .o::after{content:'';position:absolute;left:50%;top:50%;width:1.12em;height:1.12em;
    transform:translate(-50%,-50%) rotate(-45deg);
    background:linear-gradient(to right,transparent calc(50% - 1.7px),#fff calc(50% - 1.7px),#fff calc(50% + 1.7px),transparent calc(50% + 1.7px)),
               linear-gradient(to bottom,transparent calc(50% - 1.7px),#fff calc(50% - 1.7px),#fff calc(50% + 1.7px),transparent calc(50% + 1.7px))}
  .eyebrow{font-family:Inter,'Noto Sans JP',sans-serif;font-size:19px;font-weight:700;
    letter-spacing:.16em;text-transform:uppercase;color:#3d9bff;
    border-left:2px solid rgba(61,155,255,.4);padding-left:22px}
  h1{color:#e8edf2;font-weight:900;letter-spacing:-.03em;line-height:1.18;
    max-width:1000px;text-shadow:0 2px 24px rgba(0,0,0,.5)}
  h1.ja{font-family:'Noto Sans JP',sans-serif;font-size:60px}
  h1.en{font-family:Inter,sans-serif;font-size:64px;line-height:1.1}
  .stats{display:flex;gap:18px;margin-top:auto;margin-bottom:26px}
  .stat{flex:1;background:rgba(24,33,47,.72);border:1px solid rgba(255,255,255,.09);
    border-radius:16px;padding:22px 26px;
    box-shadow:0 1px 0 rgba(255,255,255,.05) inset,0 18px 34px -18px rgba(61,155,255,.35),0 4px 14px -6px rgba(0,0,0,.6)}
  .stat .k{font-family:Inter,'Noto Sans JP',sans-serif;font-size:17px;font-weight:600;
    color:#6b7d93;letter-spacing:.05em;margin-bottom:8px}
  .stat .v{font-family:Inter,'Noto Sans JP',sans-serif;font-size:38px;font-weight:800;
    color:#f5c842;letter-spacing:-.02em;white-space:nowrap}
  .foot{margin-top:auto;font-family:Inter,sans-serif;font-size:21px;font-weight:600;
    letter-spacing:.1em;color:#6b7d93}
  .stats + .foot{margin-top:0}
</style></head><body>${body}</body></html>`;

/* ── 生成対象を組み立てる ───────────────────────────────────── */
const jobs = [];

jobs.push({
  file: 'default-ja.jpg',
  html: card({ lang: 'ja', eyebrow: 'Pilot Salary Database',
    title: `世界${N_AIRLINES}社の<br>パイロット年収を、実データで。`,
    stats: [{ k: '掲載航空会社', v: `${N_AIRLINES}社` }, { k: '国内機長 平均', v: fmtJa(SALARY.ana.cap.avg) }, { k: '中東機長 平均', v: fmtJa(SALARY.emirates.cap.avg) }] }),
});
jobs.push({
  file: 'default-en.jpg',
  html: card({ lang: 'en', eyebrow: 'Pilot Salary Database',
    title: `Pilot pay at ${N_AIRLINES} airlines,<br>from real data.`,
    stats: [{ k: 'Airlines', v: `${N_AIRLINES}` }, { k: 'Japan captain', v: fmtEn(SALARY.ana.cap.avg) }, { k: 'Gulf captain', v: fmtEn(SALARY.emirates.cap.avg) }] }),
});

if (only !== 'default') {
  for (const [slug, s] of Object.entries(SALARY)) {
    const tf = s.taxFree;
    jobs.push({
      file: `a-${slug}-ja.jpg`,
      html: card({ lang: 'ja', eyebrow: 'パイロット年収',
        title: `${s.ja}<br>パイロット年収`,
        stats: [
          { k: `機長 平均${tf ? '（非課税）' : ''}`, v: fmtJa(s.cap.avg) },
          { k: '副操縦士 平均', v: fmtJa(s.fo.avg) },
          { k: '機長レンジ', v: `${s.cap.lo.toLocaleString('en-US')}〜${s.cap.hi.toLocaleString('en-US')}万` },
        ] }),
    });
    jobs.push({
      file: `a-${slug}-en.jpg`,
      html: card({ lang: 'en', eyebrow: 'Pilot Salary',
        title: `${s.en}<br>Pilot Salary`,
        stats: [
          { k: `Captain avg${tf ? ' (tax-free)' : ''}`, v: fmtEn(s.cap.avg) },
          { k: 'First officer avg', v: fmtEn(s.fo.avg) },
          { k: 'Captain range', v: `${fmtEn(s.cap.lo)}–${fmtEn(s.cap.hi)}` },
        ] }),
    });
  }
  /* hub フラグでは絞らない。国ページを全カ国分作ったので OG も全カ国分要る。 */
  for (const c of COUNTRIES) {
    const list = airlinesOf(c.code, SALARY).map((slug) => [slug, SALARY[slug]]);
    if (!list.length) continue;
    const caps = list.map(([, s]) => s.cap.avg);
    const top = Math.max(...caps);
    const avg = Math.round(caps.reduce((a, b) => a + b, 0) / caps.length);
    jobs.push({
      file: `c-${c.code.toLowerCase()}-ja.jpg`,
      html: card({ lang: 'ja', eyebrow: `${c.flag}  ${c.ja}`,
        title: `${c.ja}の<br>パイロット年収`,
        stats: [{ k: '掲載社数', v: `${list.length}社` }, { k: '機長 平均', v: fmtJa(avg) }, { k: '最高水準', v: fmtJa(top) }] }),
    });
    jobs.push({
      file: `c-${c.code.toLowerCase()}-en.jpg`,
      html: card({ lang: 'en', eyebrow: `${c.flag}  ${c.en}`,
        title: `Pilot Salary<br>in ${c.en}`,
        stats: [{ k: 'Airlines', v: `${list.length}` }, { k: 'Captain avg', v: fmtEn(avg) }, { k: 'Top payer', v: fmtEn(top) }] }),
    });
  }
}

/* 引数で絞る。`default` は上の分岐で済んでいるのでここは素通し。 */
const targets = (only && only !== 'default') ? jobs.filter((j) => j.file.includes(only)) : jobs;
if (!targets.length) {
  console.error(`✗ "${only}" に一致する出力が無い（例: eurowings / c-de / default）`);
  process.exit(1);
}

/* ── 描画 ───────────────────────────────────────────────────────
   ★ 1枚ごとに setContent すると毎回 Google Fonts を取りに行き、
     networkidle0 が返らずタイムアウトする（実際に2枚目で落ちた）。
     ページは一度だけ組み立て、以降は innerHTML の差し替えだけにする。
     フォントは初回に読んで以後キャッシュに乗るので、待ちも1回で済む。 */
const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.setContent(shell(''), { waitUntil: 'load', timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
/* 実際に使う字形（日本語900・英語900）を明示的に読ませてから始める */
await page.evaluate(() => Promise.all([
  document.fonts.load('900 60px "Noto Sans JP"', 'パイロット年収機長副操縦士平均'),
  document.fonts.load('900 64px Inter', 'Pilot Salary Captain'),
  document.fonts.load('800 38px Inter', '0123456789$K'),
]));

let n = 0;
for (const job of targets) {
  await page.evaluate((h) => { document.body.innerHTML = h; }, job.html);
  await page.screenshot({ path: path.join(OUT, job.file), type: 'jpeg', quality: 86 });
  n++;
  if (n % 25 === 0 || n === targets.length) console.log(`  ${n}/${targets.length}`);
}
await browser.close();
console.log(`✓ OGP 画像 ${n} 枚 → assets/og/`);
