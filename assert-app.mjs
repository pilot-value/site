/* ════════════════════════════════════════════════════════════════
   assert-app.mjs — スマホのホーム画面に置ける形（2026-11-07）

   オーナー採用「スマホのホーム画面に置けるようにする（アプリのように開ける）」・案内はマイページ＋給与を出し終えた画面。

   守っているもの
     ★ 全ページ（日英西）に PV-APP の塊がちょうど1つ・中身は inject-app.mjs の appBlock と1文字も違わない・
       manifest はその言語のもの（日 manifest.webmanifest／英 manifest-en／西 manifest-es）で、住所の先にファイルが在る
     ★ manifest 3つ：名前・start_url（その言語のトップ＋utm_source=homescreen）・scope は / ・standalone・
       アイコン3枚（192・512・マスク用512）が在り、書いてある大きさと本当の大きさが同じ
     ★ 塊を取り除けば元のファイルに戻る形（page-dates.mjs が「直した日」に数えない前提）
     ★ 案内（pv-app.js）：PC では出さない・アプリとして開いているときも出さない・iPhone は「共有→ホーム画面に追加」の1行・
       Android はブラウザの口があれば「追加する」ボタン（押すと追加の画面が1回出る）・無ければメニューの1行・
       出し終えた画面はこの端末で1回だけ（マイページはいつも）・日英西の字・狭い画面で横にはみ出さない
     ★ マイページ（日英西）と給与の結果の画面（日英西）に置き場と読み込みが在る

   自分で小さなサーバーを立てる（localhost:3000 も本番の DB も使わない）。
   実行: node assert-app.mjs   （check.mjs web にも入っている）
   ════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { APP_DIRS, MANIFEST, appBlock, BLOCK_RE } from './inject-app.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
let pass = 0, fail = 0;
const ok = (c, m, e = '') => { c ? (pass++, console.log('  ✅ ' + m)) : (fail++, console.log('  ❌ ' + m + (e ? '\n     ' + e : ''))); };
const pngSize = (f) => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

// ═══ ① 全ページの塊 ═════════════════════════════════════════════
console.log('\n① 全ページの PV-APP の塊');
const DIRS = [...APP_DIRS, ['es', '../', 'es'], ['es/airlines', '../../', 'es'], ['es/countries', '../../', 'es']];
const want = (rel, lang) => lang === 'es' ? appBlock(rel, 'en').replace(MANIFEST.en, () => MANIFEST.es) : appBlock(rel, lang);
let pages = 0;
const wrong = [], noFile = [], twice = [];
for (const [dir, rel, lang] of DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs).filter((x) => x.endsWith('.html'))) {
    const p = path.join(dir, f);
    const html = fs.readFileSync(path.join(ROOT, p), 'utf8');
    pages++;
    const all = html.match(new RegExp(BLOCK_RE.source, 'g')) || [];
    if (all.length !== 1) { twice.push(`${p}（${all.length}）`); continue; }
    if (all[0] !== want(rel, lang)) wrong.push(p);
    const href = (all[0].match(/<link rel="manifest" href="([^"]+)"/) || [])[1] || '';
    if (!fs.existsSync(path.join(ROOT, dir, href))) noFile.push(`${p} → ${href}`);
  }
}
ok(pages >= 600, `日英西の ${pages} 枚を見た`);
ok(twice.length === 0, '全ページに塊がちょうど1つ（入れ忘れ・二重が無い）', twice.slice(0, 8).join(' '));
ok(wrong.length === 0, '塊の中身は inject-app.mjs の appBlock と1文字も違わない（言語ごとの manifest・theme-color・iPhone の3行）', wrong.slice(0, 8).join(' '));
ok(noFile.length === 0, 'manifest の住所の先にファイルが在る', noFile.slice(0, 5).join(' '));

const sample = fs.readFileSync(path.join(ROOT, 'airlines/jal.html'), 'utf8');
ok(sample.replace(new RegExp(BLOCK_RE.source + '\\n'), '') !== sample && !/<!--PV-APP-->/.test(sample.replace(new RegExp(BLOCK_RE.source + '\\n'), '')),
   '塊は「塊＋改行1つ」で入っている（取り除けば元のファイルに戻る＝page-dates.mjs が直した日に数えない）');
const pd = fs.readFileSync(path.join(ROOT, 'page-dates.mjs'), 'utf8');
ok(/const APP = \/<!--PV-APP-->\[\\s\\S\]\*\?<!--\\\/PV-APP-->\\n\/g/.test(pd) && /s\.replace\(APP, ''\)/.test(pd), 'page-dates.mjs が塊を取り除いてから比べる');

// ═══ ② manifest とアイコン ═════════════════════════════════════
console.log('\n② manifest とアイコン');
for (const [lang, f] of Object.entries(MANIFEST)) {
  let m = null;
  try { m = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { ok(false, `${f} が JSON として読める`, String(e)); continue; }
  const top = lang === 'ja' ? '/' : `/${lang}/`;
  ok(m.name === 'PILOT VALUE' && m.short_name === 'PILOT VALUE' && m.lang === lang && m.id === top
     && m.start_url === `${top}?utm_source=homescreen&utm_medium=app` && m.scope === '/' && m.display === 'standalone',
     `${f}：名前・言語・start_url（${top} ＋ utm_source=homescreen）・scope / ・standalone`, JSON.stringify(m).slice(0, 200));
  const icons = m.icons || [];
  const bad = icons.filter((i) => {
    const p = path.join(ROOT, i.src.replace(/^\//, ''));
    if (!fs.existsSync(p)) return true;
    const [w, h] = pngSize(p);
    return i.sizes !== `${w}x${h}`;
  });
  ok(icons.length === 3 && bad.length === 0 && icons.some((i) => i.purpose === 'maskable') && icons.some((i) => i.sizes === '512x512' && i.purpose === 'any'),
     `${f}：アイコン3枚（192・512・マスク用）が在り、大きさが書いてあるとおり`, JSON.stringify(bad));
}
const [fw, fh] = pngSize(path.join(ROOT, 'assets/favicon-180.png'));
ok(fw === 180 && fh === 180, 'iPhone のホーム画面のアイコン（apple-touch-icon・favicon-180.png）は 180×180');

// ═══ ③ 置き場 ═════════════════════════════════════════════════
console.log('\n③ マイページと給与の結果の画面の置き場');
for (const [p, pre] of [['profile.html', ''], ['en/profile.html', '../'], ['es/profile.html', '../']]) {
  const h = fs.readFileSync(path.join(ROOT, p), 'utf8');
  ok(/<div class="glass" data-pv-app="mypage" style="margin-top:20px;display:none"><\/div>/.test(h) && h.includes(`<script src="${pre}pv-app.js?v=`),
     `${p}：置き場（最初は隠れている）と pv-app.js の読み込み`);
}
for (const [p, pre] of [['pay-report.html', ''], ['en/pay-report.html', '../'], ['es/pay-report.html', '../']]) {
  const h = fs.readFileSync(path.join(ROOT, p), 'utf8');
  ok(h.includes(`'<div data-pv-app="done" style="display:none"></div>'`)
     && /\$\('result-wrap'\)\.style\.display = '';\n  if \(window\.PVApp\) window\.PVApp\.mount\(\$\('result-wrap'\)\.querySelector\('\[data-pv-app\]'\), 'done'\);/.test(h)
     && h.includes(`<script src="${pre}pv-app.js?v=`),
     `${p}：結果の画面を描いたあとに案内を置く（PVApp.mount）・pv-app.js の読み込み`);
}

// ═══ ④ 案内の動き（自分のサーバー・作り物のページ）═══════════════
console.log('\n④ 案内の動き');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const FIXTURE = (lang) => `<!doctype html><html lang="${lang}" data-theme="light"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="manifest" href="/${MANIFEST[lang]}"/>
<link rel="stylesheet" href="/pv-tokens.css"/>
<script>window.PV_T=function(T,L){return (document.documentElement.lang==='es'&&T.es)||T[L]};window.__ga=[];window.gtag=function(){window.__ga.push([].slice.call(arguments))};</script>
</head><body style="margin:0;padding:16px;font-family:sans-serif">
<div class="glass" id="mp" data-pv-app="mypage" style="display:none"></div>
<div id="done-wrap"><div id="dn" data-pv-app="done" style="display:none"></div></div>
<script src="/pv-app.js"></script></body></html>`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const m = u.match(/^\/__t\/(ja|en|es)\/?$/);
  if (m) { res.writeHead(200, { 'Content-Type': TYPES['.html'] }); return res.end(FIXTURE(m[1])); }
  const p = path.join(ROOT, u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const UA = {
  pc: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
};
const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
async function open(lang, ua, opts = {}) {
  const ctx = opts.ctx || await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setUserAgent(ua);
  await page.setViewport({ width: opts.w || 390, height: 800, deviceScaleFactor: 1, isMobile: ua !== UA.pc, hasTouch: ua !== UA.pc });
  if (opts.standalone) await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message)));
  await page.goto(`${BASE}/__t/${lang}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.PVApp);
  const s = () => page.evaluate(() => {
    const v = (id) => { const e = document.getElementById(id); return { shown: e.style.display !== 'none', mode: (e.querySelector('.pvapp') || {}).dataset ? e.querySelector('.pvapp').dataset.mode : '', text: e.textContent.trim(), btn: !!e.querySelector('.pvapp-btn'), svg: !!e.querySelector('svg.pvapp-share') }; };
    return { mp: v('mp'), dn: v('dn'), css: !!document.getElementById('pvapp-css'), ga: window.__ga.map((a) => a[1] + ':' + JSON.stringify(a[2] || {})), done: localStorage.getItem('pv_app_hint_done'),
             over: document.documentElement.scrollWidth > window.innerWidth };
  });
  return { page, ctx, errs, s };
}

let o = await open('ja', UA.pc);
let st = await o.s();
ok(!st.mp.shown && !st.dn.shown && !st.css && st.ga.length === 0 && st.done === null, 'PC：どちらも出さない（形も足さない・計測もしない・1回の印も付けない）', JSON.stringify(st));
await o.ctx.close();

o = await open('ja', UA.ios);
st = await o.s();
ok(st.mp.shown && st.mp.mode === 'ios' && !st.mp.btn && st.mp.svg && st.mp.text.includes('ホーム画面に追加') && st.mp.text.includes('共有'),
   'iPhone：マイページに「ホーム画面に追加」と、共有の印＋手順の1行（ボタンは無い）', JSON.stringify(st.mp));
ok(st.dn.shown && st.dn.mode === 'ios' && st.done === '1', 'iPhone：出し終えた画面にも出し、この端末に「出した」の印を付ける');
ok(st.ga.includes('app_hint_view:{"where":"mypage","mode":"ios"}') && st.ga.includes('app_hint_view:{"where":"done","mode":"ios"}'), '出したことを GA に名前だけ送る', st.ga.join(' '));
const ctxKeep = o.ctx;
await o.page.close();
o = await open('ja', UA.ios, { ctx: ctxKeep });
st = await o.s();
ok(st.mp.shown && !st.dn.shown, '出し終えた画面は1回だけ（2回目は出さない）・マイページはいつも出す', JSON.stringify({ mp: st.mp.shown, dn: st.dn.shown }));
await ctxKeep.close();

o = await open('ja', UA.ios, { standalone: true });
st = await o.s();
ok(!st.mp.shown && !st.dn.shown, 'アプリとして開いているとき（iPhone の standalone）は出さない');
await o.ctx.close();

o = await open('ja', UA.android);
st = await o.s();
ok(st.mp.shown && st.mp.mode === 'menu' && !st.mp.btn && st.mp.text.includes('メニュー（⋮）'), 'Android でブラウザの口がまだ無い：メニューの1行', JSON.stringify(st.mp));
await o.page.evaluate(() => {
  window.__prompted = 0;
  const e = new Event('beforeinstallprompt', { cancelable: true });
  e.prompt = () => { window.__prompted++; return Promise.resolve(); };
  e.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(e);
  window.__defaultPrevented = e.defaultPrevented;
});
st = await o.s();
ok(st.mp.shown && st.mp.mode === 'prompt' && st.mp.btn && st.mp.text.includes('追加する')
   && await o.page.evaluate(() => window.__defaultPrevented), 'ブラウザの口が来たら「追加する」のボタン1つ（ブラウザ自身の帯は出さない）', JSON.stringify(st.mp));
await o.page.click('#mp .pvapp-btn');
await o.page.waitForFunction(() => !document.querySelector('#mp .pvapp-btn'));
st = await o.s();
ok(await o.page.evaluate(() => window.__prompted) === 1 && st.mp.mode === 'menu' && st.ga.includes('app_install_click:{"where":"mypage"}'),
   '押すとブラウザの追加の画面が1回だけ出る（口は使い切り＝ボタンは消える）', JSON.stringify(st));
await o.page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
st = await o.s();
ok(st.ga.includes('app_installed:{}'), '追加されたら GA に名前だけ送る');
ok(o.errs.length === 0, 'ページの例外が0', o.errs.join(' / '));
await o.ctx.close();

for (const [lang, t, how] of [['en', 'Add to Home Screen', 'Add to Home Screen'], ['es', 'Agregar a la pantalla de inicio', 'Agregar a inicio']]) {
  o = await open(lang, UA.ios, { w: 320 });
  st = await o.s();
  ok(st.mp.text.includes(t) && st.mp.text.includes(how) && !st.over, `${lang}：字（${t}）・320px で横にはみ出さない`, JSON.stringify(st.mp));
  await o.ctx.close();
}
o = await open('ja', UA.ios, { w: 320 });
st = await o.s();
ok(!st.over, 'ja：320px で横にはみ出さない');
await o.ctx.close();

await browser.close();
server.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
