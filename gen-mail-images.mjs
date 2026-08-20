/* ════════════════════════════════════════════════════════════════
   gen-mail-images.mjs — お知らせメールに貼る図を、実物の画面から作る

   受信箱では SVG も conic-gradient も動かない＝ドーナツと折れ線は
   画像でしか出せない。そこで **my-value.html をそのまま描画させて撮る**。
   HTML を写経して作り直さない（写経すると「メールの図は直したが画面は古い」が
   必ず起きる。数字も見た目も1本にしておく）。

   出るもの（日英4枚）:
     assets/mail/report-cum-ja.png  累計報酬のカード
     assets/mail/report-bd-ja.png   支給構成（ドーナツ＋固定/変動）
     assets/mail/report-cum-en.png / report-bd-en.png

   数字は mail-bot/announce-mail.mjs の SAMPLE_ROWS（架空の機長1人・6ヶ月）。
   本文の見本カードと同じ元を使う＝図と文で違う金額が並ばない。

   使い方: node serve.mjs を起動してから node gen-mail-images.mjs
   ★ローカルにしか触らない。本番のデータは1行も読まない（Supabase 宛の
     通信はすべてこのスクリプトが横取りして、架空の値を返す）。
   ════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { SAMPLE_ROWS } from './mail-bot/announce-mail.mjs';

/* ★絶対パスを書かない（このリポジトリは PUBLIC。/Users/… はログイン名が出る）。 */
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const OUT = path.join(ROOT, 'assets', 'mail');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:3000';
/* my-value.html が持っているのと同じ project ref。ここを間違えると
   偽セッションが別の鍵で入り、ログイン画面へ飛ばされる。 */
const SB_REF = 'vzgmnkrggrwtsrpqndsm';

/* my_pay_reports() が返す形（db/pay-reports.sql）。reports 以外は
   ヘッダーの表示にしか効かないが、欠けると undefined を触って落ちる。 */
const RPC = {
  ok: true,
  reports: SAMPLE_ROWS,
  report_count: SAMPLE_ROWS.length,
  streak_months: SAMPLE_ROWS.length,
  access_until: '2026-11-13T00:00:00Z',
  badge: 'none', badge_state: 'none',
  mail_optin: false, email_opt_in: true,
  pay_day_of_month: 25,
};

const CASES = [
  { lang: 'ja', url: `${BASE}/my-value.html`,    tag: '見本', bd: '支給構成' },
  { lang: 'en', url: `${BASE}/en/my-value.html`, tag: 'SAMPLE', bd: 'How your pay is made up' },
];

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });

for (const c of CASES) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  JSERR', c.lang, e.message));

  /* ① 期限が未来の偽セッションを置く。my-value.html の PV_SESSION は
        getSession() を見るだけ＝これでログイン画面へ飛ばされない。 */
  await page.evaluateOnNewDocument((ref) => {
    const exp = Math.floor(Date.now() / 1000) + 86400 * 365;
    localStorage.setItem('sb-' + ref + '-auth-token', JSON.stringify({
      access_token: 'sample.sample.sample', token_type: 'bearer',
      expires_at: exp, expires_in: 86400 * 365, refresh_token: 'sample',
      user: { id: '00000000-0000-4000-8000-000000000000', aud: 'authenticated', role: 'authenticated' },
    }));
    localStorage.setItem('pv-theme', 'light');
  }, SB_REF);

  /* ② Supabase 宛だけを横取りする。本番のデータは読まない。 */
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (!u.includes('.supabase.co')) return req.continue();
    /* localhost からの呼び出しは別オリジン扱い＝ブラウザが先に OPTIONS を投げる。
       ここを返さないと本番と同じように CORS で弾かれ、カードが1枚も描かれない。 */
    const CORS = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    };
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS, body: '' });
    const json = (body) => req.respond({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify(body),
    });
    if (u.includes('rpc/my_pay_reports')) return json(RPC);
    if (u.includes('/profiles')) return json({ name: null });   // 氏名はカードに写らない
    /* 掲載額・会員の中央値は返さない。n≧5 でしか出ない帯を見本に写すと、
       いま受け取る人の画面には出ないものを見せることになる。 */
    if (u.includes('/pay_benchmarks')) return json([]);
    return json({});
  });

  /* カードの実寸が 600 CSS px になる幅（左右の余白ぶんを足す）。
     メールでは 512px で出すので、実画素は 600×2＝1200px あれば足りる。 */
  await page.setViewport({ width: 632, height: 2000, deviceScaleFactor: 2 });
  await page.goto(c.url, { waitUntil: 'networkidle2', timeout: 45000 });
  await page.waitForSelector('.mr-card.is-hero .mr-cum svg', { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 600));   // Webフォントの入れ替わり待ち

  /* ③ 「見本」の札を焼き込む。画像だけ切り取られて出回っても、
        本人の数字と取り違えられないようにする（.mr-mask-tag と同じ形）。 */
  const shot = await page.evaluate((tag, bdTitle) => {
    const cards = [...document.querySelectorAll('.mr-card')];
    const cum = cards.find((el) => el.classList.contains('is-hero'));
    const bd = cards.find((el) => (el.querySelector('.mr-card-t') || {}).textContent === bdTitle);
    [cum, bd].forEach((el, i) => {
      if (!el) return;
      el.id = 'shot-' + i;
      const h = el.querySelector('.mr-card-h');
      if (!h) return;
      const s = document.createElement('span');
      s.className = 'mr-mask-tag';
      s.textContent = tag;
      h.appendChild(s);
    });
    return { cum: !!cum, bd: !!bd };
  }, c.tag, c.bd);

  if (!shot.cum || !shot.bd) throw new Error(`${c.lang}: カードが見つからない ${JSON.stringify(shot)}`);

  /* 累計のカードは濃紺のグラデーションで、PNG だと 450KB になる（JPEG なら 1/3）。
     支給構成は白地に細かい文字なので JPEG にすると縁がにじむ。カードごとに分ける。 */
  const SHOTS = [
    { i: 0, k: 'cum', ext: 'jpg', opt: { type: 'jpeg', quality: 92 } },
    { i: 1, k: 'bd',  ext: 'png', opt: { type: 'png' } },
  ];

  for (const s of SHOTS) {
    const el = await page.$('#shot-' + s.i);
    const out = path.join(OUT, `report-${s.k}-${c.lang}.${s.ext}`);
    await el.screenshot({ path: out, ...s.opt });
    const box = await el.boundingBox();
    console.log(`${path.relative(ROOT, out)}  ${Math.round(box.width)}×${Math.round(box.height)} CSS px  ` +
      `${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
  }
  await page.close();
}

await browser.close();

/* 画像の版を中身から作る。メールは src に ?v=… で付けている。
   ★Cloudflare が画像を4時間持つので、版を上げないと作り直しても
     受信箱には古い絵が出続ける。中身から作れば上げ忘れが起きない。
   ★ここを直したら mail-bot/announce-mail.mjs の IMG_VER に貼る。
     忘れたら node db/test-announce.mjs が正しい値を出して落ちる。 */
const h = crypto.createHash('sha1');
for (const f of fs.readdirSync(OUT).sort()) h.update(fs.readFileSync(path.join(OUT, f)));
console.log(`\n画像の版 IMG_VER = '${h.digest('hex').slice(0, 8)}'`);
console.log("→ mail-bot/announce-mail.mjs の IMG_VER に貼る（違っていたら test-announce が落ちる）");
