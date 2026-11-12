#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   assert-glass-motion.mjs — すりガラスと動き（pv-glass.js）を本物のブラウザで確かめる（2026-11-12）
   ★3000 番を使わない：このファイルが自分で静的な配り口を OS の選ぶ番号で立てる。
   ★本番の Supabase へは1本も出さない（CDP で supabase.co への通信を止める）＝ 画面は「読めなかった」形で出るが、動きの確かめには足りる。

   A) 動かす（window.__pvMotion）── 公開の画面いくつかと会社ページを、少しずつ一番下までスクロールして止まって待つ：
      ・見出しが元の字に戻っている（1字ずつの窓 .ut-sp / .ut-ch が残らない・付けた aria-label が残らない）
      ・待ちの印（.ut-w）と数え上げ（.ut-counting）が残らない・棒の伸び（scale）と円の弧が本当の長さで止まっている
      ・pv-glass.js が例外を出さない・横にはみ出さない（390px と 1280px）
   B) 動かさない（自動の検査の既定 ＝ navigator.webdriver）── 同じ画面で、動きの印が1つも付かない（ほかの検査が途中の形を測らない）。
      ガラス（html[data-ui]）は付く。
   C) 「動きを減らす」設定 ── 動きの印が1つも付かない。
   ══════════════════════════════════════════════════════════════════ */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const BASE = `http://localhost:${srv.address().port}/`;

let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('✓  ' + msg); } else { fail++; console.log('✗  ' + msg + (extra ? '\n     ' + extra : '')); } };

const PAGES = ['index.html', 'world-airlines.html', 'community.html', 'countries/japan.html', 'airlines/ana.html', 'airlines/cathay-pacific.html',
  'pilot-salary-guide.html', 'en/airlines/emirates.html'];
const browser = await puppeteer.launch({ args: ['--no-first-run'] });

async function open(url, { motion, reduce, width }) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e && (e.stack || e.message) || e)));
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.setBlockedURLs', { urls: ['*supabase.co*', '*googletagmanager*', '*google-analytics*'] });
  await page.setViewport(width < 600 ? { width, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { width, height: 900 });
  if (motion) await page.evaluateOnNewDocument(() => { window.__pvMotion = 1; });
  if (reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(url, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
  return { page, errs };
}
const MOTION_SEL = '.ut-w,.ut-split,.ut-rise,.ut-sv,.ut-pre,.ut-counting,.ut-g,.ut-leg-w';

for (const p of PAGES) {
  for (const width of [1280, 390]) {
    const tag = `${p} ${width}px`;
    /* A) 動かす */
    const { page, errs } = await open(BASE + p, { motion: true, width });
    const r = await page.evaluate(async () => {
      document.documentElement.style.scrollBehavior = 'auto';
      const H = document.documentElement.scrollHeight;
      const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (let y = 0; y <= H; y += 220) { window.scrollTo(0, y); await frame(); await new Promise((r) => setTimeout(r, 60)); }
      /* 速く送ると、絵を描くのが遅い機械（検査のブラウザ）では見出しが1コマも映らずに通り過ぎることがある。
         そのときは見出しは割れたまま待つ（次に映ったときにせり上がる）＝ 残っているものは1つずつ画面に入れて確かめる */
      for (const e of [...document.querySelectorAll('.ut-split')]) { e.scrollIntoView({ block: 'center' }); await frame(); await new Promise((r) => setTimeout(r, 400)); }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 4600));
      const sc = (e) => { const cs = getComputedStyle(e); return (cs.scale !== 'none' && cs.scale !== '1') || (cs.transform !== 'none' && cs.transform !== 'matrix(1, 0, 0, 1, 0, 0)'); };
      return {
        glass: document.documentElement.getAttribute('data-ui'),
        sp: document.querySelectorAll('.ut-sp,.ut-ch').length,
        split: document.querySelectorAll('.ut-split').length,
        wait: [...document.querySelectorAll('.ut-w')].filter((e) => e.getClientRects().length).length,
        counting: document.querySelectorAll('.ut-counting').length,
        bars: [...document.querySelectorAll('.ut-hb,.ut-col,.ut-row,.ut-hd')].filter((e) => e.getClientRects().length && sc(e)).length,
        arcs: [...document.querySelectorAll('svg.ut-pie circle')].filter((c) => c._utDash && c.getAttribute('stroke-dasharray') !== c._utDash).length,
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        marked: document.querySelectorAll('.ut-hb,.ut-col,.ut-row,.ut-line,.ut-dot,.ut-hd,.ut-rad,svg.ut-pie').length,
      };
    });
    const mine = errs.filter((e) => /pv-glass\.js/.test(e));
    ok(r.glass === 'glass', `${tag}：ガラスが付く`);
    ok(r.sp === 0 && r.split === 0, `${tag}：見出しが元の字に戻っている`, JSON.stringify(r));
    ok(r.wait === 0 && r.counting === 0 && r.bars === 0 && r.arcs === 0, `${tag}：止まったあと、棒・点・円・数字が本当の形（図の部品 ${r.marked}）`, JSON.stringify(r));
    ok(mine.length === 0, `${tag}：pv-glass.js が例外を出さない`, mine.slice(0, 2).join(' / '));
    ok(r.over <= 1, `${tag}：横にはみ出さない`, 'はみ出し ' + r.over + 'px');
    await page.close();
  }
  /* B) 動かさない（自動の検査の既定）・C) 動きを減らす */
  for (const mode of ['auto', 'reduce']) {
    const { page } = await open(BASE + p, { motion: false, reduce: mode === 'reduce', width: 1280 });
    const r = await page.evaluate(async (SEL) => {
      const H = document.documentElement.scrollHeight;
      for (let y = 0; y <= H; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
      await new Promise((r) => setTimeout(r, 800));
      return { glass: document.documentElement.getAttribute('data-ui'), n: document.querySelectorAll(SEL + ',.ut-sp').length };
    }, MOTION_SEL);
    ok(r.glass === 'glass' && r.n === 0, `${p}（${mode === 'auto' ? '自動の検査' : '動きを減らす'}）：ガラスは付き、動きの印は1つも付かない`, JSON.stringify(r));
    await page.close();
  }
}
await browser.close();
srv.close();
console.log(`\n==== ${pass}/${pass + fail} passed ====`);
if (fail) process.exit(1);
