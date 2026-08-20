/* ════════════════════════════════════════════════════════════════
   assert-perf.mjs — 表示速度を実測する（目分量で「速い」と言わないため）

   なぜ要るか
     Core Web Vitals は検索順位の要素で、特にモバイルで効く。ただし
     localhost をそのまま測ると回線もCPUも速すぎて必ず「良好」に出る。
     Google が見ているのは実ユーザーの端末（多くは中位のスマホ）なので、
     回線 Slow 4G・CPU 4倍遅い状態を被せて測る。数字を良く見せない。

   見るもの
     ・LCP  最大要素が描画されるまで（良好 ≤2500ms / 要改善 ≤4000ms）
     ・CLS  読み込み中に画面がガタつく量（良好 ≤0.10）
     ・転送量 と 内訳
     ・レンダリングブロッキング（head の中の defer/async 無し <script>、
       と <link rel=stylesheet>）
     ・幅高さの無い <img>（CLS の主犯になる）

   実行: node serve.mjs を起動した状態で node assert-perf.mjs
        node assert-perf.mjs --all   代表ページではなく全ページを測る
════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';

/* 代表ページ＝テンプレートが違うものを1枚ずつ。同じ生成物を100枚測っても
   同じ数字が100個出るだけなので、型ごとに1枚で足りる。 */
const SAMPLE = [
  'index.html', 'world-airlines.html', 'countries.html',
  'airlines/emirates.html', 'countries/japan.html', 'pilot-salary-guide.html',
  'en/index.html', 'en/world-airlines.html', 'en/countries.html',
  'en/airlines/emirates.html', 'en/countries/japan.html',
];

const listHtml = (d) => (fs.existsSync(path.join(__dirname, d))
  ? fs.readdirSync(path.join(__dirname, d)).filter((f) => f.endsWith('.html')).map((f) => (d === '.' ? f : `${d}/${f}`)) : []);
const targets = process.argv.includes('--all')
  ? [...listHtml('.'), ...listHtml('airlines'), ...listHtml('countries'),
     ...listHtml('en'), ...listHtml('en/airlines'), ...listHtml('en/countries')]
  : SAMPLE;

/* 中位のスマホに寄せる。Lighthouse のモバイル既定とほぼ同じ条件。 */
const NET = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };
const CPU_SLOWDOWN = 4;

const kb = (b) => `${(b / 1024).toFixed(0)}KB`;
const pad = (s, n) => String(s).padEnd(n);

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const rows = [];
const notes = [];

for (const rel of targets) {
  /* ★ 1つのブラウザで続けて測ると、2枚目以降はフォントもJSもキャッシュに
     乗っていて速く出る。「1枚目だけ 7.5秒、あとは全部1秒」という数字は
     ページの差ではなくキャッシュの差でしかない。検索から来る人は毎回
     初回訪問なので、ページごとに使い捨てのコンテキストで測る。 */
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
  await page.setCacheEnabled(false);
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', NET);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });

  /* 転送量は CDP のイベントで数える。performance.getEntries の
     transferSize はキャッシュ状況で 0 になることがあって当てにならない。 */
  const bytes = { total: 0, byType: {} };
  cdp.on('Network.loadingFinished', (e) => { bytes.total += e.encodedDataLength; });
  const urlOfReq = new Map();
  cdp.on('Network.requestWillBeSent', (e) => urlOfReq.set(e.requestId, e.request.url));
  cdp.on('Network.responseReceived', (e) => {
    const t = e.type || 'Other';
    bytes.byType[t] = (bytes.byType[t] || 0) + 0;
    urlOfReq.set(e.requestId + ':type', t);
  });
  cdp.on('Network.loadingFinished', (e) => {
    const t = urlOfReq.get(e.requestId + ':type') || 'Other';
    bytes.byType[t] = (bytes.byType[t] || 0) + e.encodedDataLength;
  });

  await page.evaluateOnNewDocument(() => {
    window.__lcp = 0; window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });

  let failed = null;
  try {
    await page.goto(`${BASE}/${rel}`, { waitUntil: 'networkidle2', timeout: 90000 });
  } catch (e) { failed = e.message.split('\n')[0]; }

  if (failed) { notes.push(`LOAD-FAIL ${rel}: ${failed}`); await page.close(); continue; }

  /* LCP は最後の候補が確定するまで動く。少し待ってから読む。 */
  await new Promise((r) => setTimeout(r, 1200));

  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    const blocking = [...document.head.querySelectorAll('script[src]')]
      .filter((s) => !s.defer && !s.async && s.type !== 'module')
      .map((s) => s.getAttribute('src'));
    const css = [...document.head.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute('href'));
    const imgs = [...document.images];
    const noDim = imgs.filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length;
    const noLazy = imgs.filter((i) => i.loading !== 'lazy').length;
    return {
      lcp: Math.round(window.__lcp), cls: +(window.__cls || 0).toFixed(3),
      fcp: fcp ? Math.round(fcp.startTime) : null,
      dcl: Math.round(nav.domContentLoadedEventEnd || 0),
      nodes: document.getElementsByTagName('*').length,
      blocking, css, imgs: imgs.length, noDim, noLazy,
    };
  });

  rows.push({ rel, ...m, bytes: bytes.total, byType: bytes.byType });
  await page.close();
}
await browser.close();

/* ── 出力 ───────────────────────────────────────────────────── */
const GOOD_LCP = 2500, POOR_LCP = 4000, GOOD_CLS = 0.1;
const mark = (v, good, poor) => (v <= good ? '✓' : v <= poor ? '△' : '✗');

console.log(`\n═══ 表示速度 — Slow 4G / CPU ${CPU_SLOWDOWN}倍遅い / 390x844 ═══\n`);
console.log(`${pad('ページ', 34)}${pad('LCP', 10)}${pad('CLS', 9)}${pad('FCP', 8)}${pad('転送量', 9)}要素数`);
for (const r of rows) {
  console.log(`${pad(r.rel, 34)}${pad(`${mark(r.lcp, GOOD_LCP, POOR_LCP)} ${r.lcp}ms`, 10)}${pad(`${mark(r.cls, GOOD_CLS, 0.25)} ${r.cls}`, 9)}${pad(`${r.fcp}ms`, 8)}${pad(kb(r.bytes), 9)}${r.nodes}`);
}

const worstLcp = [...rows].sort((a, b) => b.lcp - a.lcp)[0];
const worstCls = [...rows].sort((a, b) => b.cls - a.cls)[0];
const heaviest = [...rows].sort((a, b) => b.bytes - a.bytes)[0];

console.log(`\n── 内訳（最も重い ${heaviest.rel}）──`);
Object.entries(heaviest.byType).sort((a, b) => b[1] - a[1])
  .forEach(([t, b]) => b > 0 && console.log(`  ${pad(t, 14)}${kb(b)}`));

const blk = rows.filter((r) => r.blocking.length);
console.log(`\n── レンダリングブロッキング ──`);
if (!blk.length) console.log('  head 内に defer/async 無しの <script> は無い');
else {
  const uniq = [...new Set(blk.flatMap((r) => r.blocking))];
  console.log(`  ${blk.length}/${rows.length} ページ。実体 ${uniq.length} 種:`);
  uniq.forEach((s) => console.log(`    ${s}`));
}
const cssAll = [...new Set(rows.flatMap((r) => r.css))];
console.log(`  <link rel=stylesheet> ${cssAll.length} 種: ${cssAll.join(' , ') || '（無し）'}`);

const dim = rows.filter((r) => r.noDim > 0);
console.log(`\n── 画像 ──`);
if (!dim.length) console.log('  幅高さの無い <img> は無い');
else dim.forEach((r) => console.log(`  ${pad(r.rel, 34)}<img> ${r.imgs}枚中 ${r.noDim}枚に width/height が無い（CLS の主犯）`));

console.log(`\n── 判定 ──`);
console.log(`  LCP 最悪  ${worstLcp.rel} ${worstLcp.lcp}ms（良好 ≤${GOOD_LCP}）`);
console.log(`  CLS 最悪  ${worstCls.rel} ${worstCls.cls}（良好 ≤${GOOD_CLS}）`);
console.log(`  最も重い  ${heaviest.rel} ${kb(heaviest.bytes)}`);
notes.forEach((n) => console.log(`  ⚠ ${n}`));

const failing = rows.filter((r) => r.lcp > POOR_LCP || r.cls > 0.25).length;
console.log(`\n══ ${rows.length} ページ計測 / 不良 ${failing} ══\n`);
