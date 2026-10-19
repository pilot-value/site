/* assert-proof-offer.mjs — パイロットであることの確認の「申請」ポップアップ（pv-proof-offer.js）とマイページの入口（2026-10-16）、
   ホテルの欄の会員の鍵の1行の入口（2026-10-18 オーナー Q2）。

   実行: node assert-proof-offer.mjs --static   … ブラウザなし（切り出し・指紋・呼ぶ名前・読むページ・ホテルの欄から開くのは鍵の1行だけ）
         node assert-proof-offer.mjs            … ＋ブラウザの場面（check.mjs web に入っている ── 2026-10-18 から）
   場面のつくり（MOCK の画面 ＋ REAL LOCAL SQL）
     ★手元だけ。小さな配信を空いている番号（OS が選ぶ・3000 / 3100 / 3111 は使わない）で立て、
       そのページの外への通信は全部止めて書き留める（最後に「0本」を見る）。supabase-js は読まない。
     ★ページの sb は、呼ばれた関数をこの検査の中の PGlite（本物の db/*.sql）へその会員として渡すだけの細い橋。
       ＝ ポップアップの画面は MOCK、返事と保存は REAL LOCAL SQL。本番の証拠にはならない。
     ★場面5は本物のマイページ（profile.html ／ en/profile.html）を、local-chain.mjs の使い捨ての保存先（serve-local の
       start ・ OS が選ぶ番号）で開く（REAL LOCAL CONNECTION）。入口のボタンが出た瞬間の場所から動かないこと（WP-towns-13w）。
     ★場面6は本物の会社の画面（JAL の最初の就航地）のホテルの欄を、同じく使い捨ての保存先で開く（REAL LOCAL CONNECTION・2026-10-18
       オーナー Q2）。会員の鍵の1行の入口からこのポップアップが開く・未ログインには出ない・ホテルの追加からは開かない・出しても何も開かない。
   ⚠️ 会員を名指しで書かない。ここの人は全員、作り物の uuid。 */
import { readFileSync, existsSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'fs';
import { createHash } from 'crypto';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8');
const STATIC = process.argv.includes('--static');
let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };
const J = (v) => JSON.stringify(v);
const sha = (t) => createHash('sha256').update(t, 'utf8').digest('hex');

/* ── 静的 ── */
console.log('\n▼ 静的：止まった会員の板の切り出しそのまま・呼ぶ名前・入口');
const POP = read('pv-proof-offer.js');
/* pv-proof.js（main 05c7f2f）の5つの切り出し。K1・K5 はクラス名の頭 pvpf- を pvpo- にした後の指紋。 */
const KS = [
  { id: 'K1', from: '  var CSS = [', to: "  ].join('');\n", swap: true, sha: '3f41d3682fb6ac4a0d37997aa1a4ef38578ce9d68fc612a218c675546c5c97bd' },
  { id: 'K2', from: '  function esc(s) {', to: '\n  }\n', sha: 'fb7e7f22b95efaaff829ede103f5c017a96b2530f8fffbd2818538b85439b75a' },
  { id: 'K3', from: '  function borrowed() {', to: '\n  }\n', sha: 'd13a8588e9afff8120434ea16059159fa608a01ca5ec782cc27fedd62f5e1cdd' },
  { id: 'K3b', from: '  function viaClient(c, name, args) {', to: '\n  }\n', sha: 'f9345232d91f9f96a5655a74a685819a626d0495d152f41517bb966326dafc9b' },
  { id: 'K4', from: '  /* ── 画像を小さくして JPEG に焼き直す', to: '\n  /* ▲ */', drop: '\n  /* ▲ */'.length, sha: '1814dde97b16f23dd8630da7f88dc60e2ec0e86e14f64cac7aead8ee52773f59' },
  { id: 'K5', from: '  function hush(el) {', to: '\n  /* ▲ */', drop: '\n  /* ▲ */'.length, swap: true, sha: '4bb6684b9431cecc02ec7952b55e7c82fb715383800737fb17e22d4150701935' },
];
const cut = (text, k, to = k.to, drop = k.drop || 0) => { const i = text.indexOf(k.from); if (i < 0 || text.indexOf(k.from, i + 1) >= 0) return null;
  const j = text.indexOf(to, i); return j < 0 ? null : text.slice(i, j + to.length - drop).replace(/\n+$/, ''); };
const MAIN_TO = { K4: ['\n  /* ── 板 ─', '\n  /* ── 板 ─'.length], K5: ['\n  function open() {', '\n  function open() {'.length] };
const hasMain = existsSync(path.join(ROOT, 'pv-proof.js'));     // main を取り込んだあと
for (const k of KS) {
  const mine = cut(POP, k);
  ok(mine && sha(mine) === k.sha, `★${k.id} は pv-proof.js（main）の切り出しと1文字も違わない${k.swap ? '（クラス名の頭だけ pvpo-）' : ''}`, mine ? sha(mine) : 'not found');
  if (hasMain) {
    const m = read('pv-proof.js'); const [to, dr] = MAIN_TO[k.id] || [k.to, 0];
    const t = cut(m, k, to, dr); const tt = t && k.swap ? t.split('pvpf-').join('pvpo-') : t;
    ok(tt === mine, `★（取り込み後）${k.id} は、いまの pv-proof.js と同じ（片方だけ直していない）`);
  }
}
const code = POP.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const rpcNames = [...code.matchAll(/rpc\('([a-z0-9_]+)'/g)].map((m) => m[1]);
ok(rpcNames.length >= 1 && rpcNames.every((n) => n === 'pv_stay_apply'), '★サーバへ呼ぶのは pv_stay_apply だけ', J(rpcNames));
ok(!/pv_proof_submit|pv_proof_state|proofWrite|proofRead|proofDue|'pv_proof'|localStorage|sessionStorage|indexedDB/.test(code),
   '★止まった会員の板の入口・写しに触らない・保存領域を1つも使わない');
ok(!/\.innerHTML\s*=\s*[^;]*\b(v|r|st|status)\b(?!\w)/.test(code.replace(/card\.innerHTML = html\(\);/, '').replace(/back\.innerHTML = '[^;]*;/, '')),
   'サーバの返事を innerHTML に入れない（返事は決まった文言に置き換える）');
const stay = read('career-stay.js');
/* ★ホテルの欄（career-stay.js）からこのポップアップを開くのは、会員の鍵の1行の入口だけ（2026-10-18 オーナー Q2「もし中身が見たいなら
   証明を提出してもらうポップアップ出さないと」。前は「開かない・申請を呼ばない」── L2 の付け替え。ホテルの追加から開かないのは同じ）。
   ・申請の口 pv_stay_apply を呼ぶのは1か所だけで、引数は空の {}（状態を読むだけ。画像はこのファイルを通らない）。
   ・ポップアップを開く呼び出し（P.open({…})）は openProof の中の1か所だけ。openProof を呼ぶのは、欄の中の 'proof' のボタンだけ
     （欄の外の追加の面からは呼ばない）。そのボタンを作るのも proofEntry の1か所だけ。
   ・押すと開く印（data-pv-proof-open）は使わない。
   未ログインに出ないこと・ホテルの追加の途中で開かないこと・出しても何も開かないことは、場面6が本物の画面で見る。 */
{
  const sc = stay.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const fnBody = (name) => (sc.match(new RegExp(`\\n  function ${name}\\(\\) \\{\\n([\\s\\S]*?)\\n  \\}\\n`)) || [])[1] || '';
  const applyAt = [...sc.matchAll(/pv_stay_apply/g)].length, applyCalls = [...sc.matchAll(/rpc\('pv_stay_apply', ([^)]*)\)/g)].map((m) => m[1]);
  const opens = sc.split('P.open({').length - 1, opensIn = fnBody('openProof').split('P.open({').length - 1;
  const calls = sc.split('openProof(').length - 1;
  const bound = /\n\s*else if \(act === 'proof'\)\s*\{ if \(slot\.contains\(b\)\) openProof\(\); \}[ \t]*\n/.test(sc);
  const made = sc.split(", 'proof')").length - 1, madeIn = fnBody('proofEntry').split("btn('crl-link crs-proof', T.proofPick, 'proof')").length - 1;
  ok(applyAt === 1 && J(applyCalls) === J(['{}']) && opens === 1 && opensIn === 1 && calls === 2 && bound && made === 1 && madeIn === 1
     && !/data-pv-proof-open|pv-proof-offer\.js/.test(sc),
     '★ホテルの欄（career-stay.js）：申請の口は状態を読む1か所だけ（空の {}）・ポップアップを開くのは鍵の1行の入口（proofEntry が作る \'proof\' のボタン → openProof）の1か所だけ・押すと開く印は使わない',
     J({ applyAt, applyCalls, opens, opensIn, calls, bound, made, madeIn }));
  /* 入口と、出したあとの1行の字は、このポップアップ（とマイページの入口）の字と1文字も違わない（新しい言葉を作らない） */
  const csWord = (k) => { const m = [...stay.matchAll(new RegExp(`\\n\\s*${k}:\\s*'([^']*)'`, 'g'))]; return m.length === 1 ? m[0][1] : null; };
  const popJa = (code.match(/\n    ja: \{\n([\s\S]*?)\n    \},\n/) || [])[1] || '';
  const popWord = (k) => { const m = [...popJa.matchAll(new RegExp('\\n\\s*' + k + ':\\s*\'([^\']*)\'', 'g'))]; return m.length === 1 ? m[0][1] : null; };
  const pair = { proofPick: [csWord('proofPick'), popWord('pick')], proofWait: [csWord('proofWait'), popWord('doneS')] };
  ok(!!pair.proofPick[0] && pair.proofPick[0] === pair.proofPick[1] && !!pair.proofWait[0] && pair.proofWait[0] === pair.proofWait[1]
     && pair.proofPick[0] === '画像を選んで提出する' && pair.proofWait[0] === '運営が確認するまでお待ちください。',
     '★鍵の1行の入口「画像を選んで提出する」と出したあとの1行「運営が確認するまでお待ちください。」は、ポップアップの T.pick・T.doneS と同じ字', J(pair));
}
/* オーナーの字（2026-10-16）。「見られるのは VERIFIED PILOT だけ」の言い方は全部「Only VERIFIED PILOT」（大文字は O だけ）、
   状態は「VERIFIED PILOT です」。ホテルの欄の鍵の1行（career-stay.js）と同じ字 ── ONLY と Only を並べない。 */
const OWNER = { lead2: 'Only VERIFIED PILOT', slotS: 'Only VERIFIED PILOT', okT: 'VERIFIED PILOT です' };
const jaT = (code.match(/\n    ja: \{\n([\s\S]*?)\n    \},\n/) || [])[1] || '';
const word = (k) => { const m = [...jaT.matchAll(new RegExp('\\n\\s*' + k + ':\\s*\'([^\']*)\'', 'g'))]; return m.length === 1 ? m[0][1] : null; };
const lockW = [...stay.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\n\s*locked:\s*'([^']*)'/g)].map((m) => m[1]);
const gotW = { lead2: word('lead2'), slotS: word('slotS'), okT: word('okT') };
ok(J(gotW) === J(OWNER) && J(lockW) === J([OWNER.slotS]) && !/確認済みのパイロット|ONLY VERIFIED PILOT/.test(code),
   '★日本語の lead2・slotS は「Only VERIFIED PILOT」、okT は「VERIFIED PILOT です」── ホテルの鍵の1行と同じ字・「確認済みのパイロット」「ONLY VERIFIED PILOT」はどこにも無い',
   J({ gotW, lockW }));
/* 英語も同じ形（2026-10-16）。「confirmed pilot(s)」は「確認済みのパイロット」の訳で、オーナーが VERIFIED PILOT に改めた。 */
const OWNER_EN = { lead2: 'Only VERIFIED PILOT', slotS: 'Only VERIFIED PILOT', okT: 'You are a VERIFIED PILOT' };
const enT = (code.match(/\n    en: \{\n([\s\S]*?)\n    \},?\n/) || [])[1] || '';
const wordEn = (k) => { const m = [...enT.matchAll(new RegExp('\\n\\s*' + k + ':\\s*\'([^\']*)\'', 'g'))]; return m.length === 1 ? m[0][1] : null; };
const gotEn = { lead2: wordEn('lead2'), slotS: wordEn('slotS'), okT: wordEn('okT') };
ok(J(gotEn) === J(OWNER_EN) && !/confirmed pilot/i.test(code),
   '★英語の lead2・slotS は「Only VERIFIED PILOT」、okT は「You are a VERIFIED PILOT」── 「confirmed pilot」はどこにも無い',
   J(gotEn));
for (const [page, pre] of [['profile.html', ''], ['en/profile.html', '../']]) {
  const h = read(page);
  const want = createHash('sha256').update(readFileSync(path.join(ROOT, 'pv-proof-offer.js'))).digest('hex').slice(0, 8);
  const m = h.match(new RegExp('"' + (pre + 'pv-proof-offer.js').replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&') + '\\?v=([0-9a-f]+)"'));
  ok(m && m[1] === want, `${page}: pv-proof-offer.js を中身の指紋（?v=${want}）で読んでいる`, m ? m[1] : 'not found');
  ok(h.split('<div id="pv-proof-slot"></div>').length === 2 && h.indexOf('<div id="pv-proof-slot"></div>') > h.indexOf('id="profile-card"')
     && h.indexOf('<div id="pv-proof-slot"></div>') < h.indexOf('id="pay-tracker"'), `${page}: 入口はマイページの ① YOUR STATUS の中に1か所だけ`);
}
/* 読むページは2種類だけ（2026-10-18 オーナー Q2 から）。マイページ（日英・上の2行）と、ホテルの欄を持つ画面（career.html と会社の画面5枚 ──
   career-stay.js より前に、今の中身の指紋で1回だけ読む）。ホテルの欄の画面には、マイページの入口の置き場（pv-proof-slot）も、押すと開く印
   （data-pv-proof-open）も置かない ＝ そこでの入口は会員の鍵の1行だけ。ほかのページ（サイトの HTML 全部）は読まない。
   （前は「ほかの5枚はまだ読まない」── L2 の付け替え：見るページをサイト全部に広げ、読んでよい8枚をちょうどこの8枚に固定した） */
{
  const want = createHash('sha256').update(readFileSync(path.join(ROOT, 'pv-proof-offer.js'))).digest('hex').slice(0, 8);
  const HOTEL = ['career.html', 'airlines/jal.html', 'airlines/ana.html', 'airlines/cathay-pacific.html', 'airlines/etihad.html', 'airlines/eva-air.html'];
  for (const page of HOTEL) {
    const h = read(page), pre = page.startsWith('airlines/') ? '../' : '';
    const e = (s) => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
    const m = [...h.matchAll(new RegExp('<script src="' + e(pre + 'pv-proof-offer.js') + '\\?v=([0-9a-f]+)"></script>', 'g'))];
    const iP = h.indexOf('"' + pre + 'pv-proof-offer.js?v='), iS = h.indexOf('"' + pre + 'career-stay.js?v=');
    ok(m.length === 1 && m[0][1] === want && h.split('pv-proof-offer.js').length === 2 && iP >= 0 && iS > iP && !/pv-proof-slot|data-pv-proof-open/.test(h),
       `${page}: ホテルの欄の画面 ── pv-proof-offer.js を career-stay.js より前に、今の中身の指紋（?v=${want}）で1回だけ読む・マイページの入口の置き場も押すと開く印も無い`,
       J({ hits: m.map((x) => x[1]), iP, iS }));
  }
  const allow = new Set(['profile.html', 'en/profile.html', ...HOTEL]);
  const pages = [];
  for (const dir of ['', 'airlines', 'en', 'en/airlines']) {
    for (const f of readdirSync(path.join(ROOT, dir || '.'))) if (f.endsWith('.html')) pages.push(dir ? `${dir}/${f}` : f);
  }
  const readers = pages.filter((f) => /pv-proof-offer\.js|pv-proof-slot|data-pv-proof-open/.test(read(f)));
  ok(pages.length > 300 && J(readers.slice().sort()) === J([...allow].sort()),
     `ほかのページ（サイトの HTML ${pages.length}枚のうち、マイページ日英とホテルの欄の6枚のほか）は、このポップアップを読まない`, J(readers.filter((f) => !allow.has(f))));
}

if (!STATIC) await scenes();
console.log(`\n${fail ? '❌' : '✅'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

async function scenes() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  const puppeteer = (await import('puppeteer')).default;
  console.log('\n▼ 場面の準備（手元の PGlite に本物の SQL・空いている番号の小さな配信）');
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.waitReady;
  await db.exec(`
    create schema if not exists extensions; create schema if not exists auth;
    create role anon; create role authenticated;
    grant usage on schema public, extensions, auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    create table public.profiles (id uuid primary key, email text, name text, gender text, birthdate date, country text, company text, "position" text);
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('pv.uid', true), '')::uuid $$;
    create table public.reviews_v2 (id uuid primary key default gen_random_uuid(), proof_hash text not null, airline text not null,
      "position" text, tenure_bucket text, age_bucket text, fleet text, job_role text,
      monthly_salary integer, bonus integer, annual_salary integer, base_annual integer, flight_allowance_annual integer,
      culture_score integer, salary_score integer, benefits_score integer, wlb_score integer, ops_score integer, training_score integer, mgmt_score integer,
      culture_comment text, salary_comment text, benefits_comment text, wlb_comment text, ops_comment text, training_comment text, mgmt_comment text,
      orig_lang text, translations jsonb, created_at timestamptz not null default now());`);
  const merged = existsSync(path.join(ROOT, 'db/pilot-proof.sql'));
  for (const f of ['db/airlines.generated.sql', 'db/vocab.generated.sql', 'db/schema-additions.sql', 'db/pay-reports.sql',
                   'db/pay-report-pending.sql', 'db/pay-rows.sql', 'db/admin.sql',
                   ...(merged ? ['db/deep-pay.sql', 'db/reviews-gate.sql', 'db/pilot-proof.sql'] : ['db/proof-store.sql']),
                   'db/proof-offer.sql', 'db/stays.sql']) await db.exec(read(f));
  const OWN = '00000000-0000-4000-8000-00000000ad11', A = '00000000-0000-4000-8000-0000000000a1',
        V = '00000000-0000-4000-8000-0000000000c2', CHK = '00000000-0000-4000-8000-0000000000d2';
  for (const id of [OWN, A, V, CHK]) {
    await db.query(`insert into auth.users(id,email) values($1,$2)`, [id, id.slice(-4) + '@example.com']);
    await db.query(`insert into public.profiles(id,email) values($1,$2) on conflict (id) do nothing`, [id, id.slice(-4) + "@example.com"]);
  }
  await db.query(`insert into public.pv_stay_owner(user_id) values($1)`, [OWN]);
  await db.query(`insert into public.pv_stay_viewers(user_id,state,decided_by,decided_at) values($1,'approved',$2,now())`, [V, OWN]);
  await db.query(`insert into public.pv_proof(user_id,state,submitted_at) values($1,'submitted',now())`, [CHK]);
  ok(true, 'SQL を流した（' + (merged ? 'main を取り込んだあとの形' : 'このブランチの形') + '）');

  let who = A;                                   // ページの「ログインしている会員」（null ＝ 未ログイン）
  const calls = [];
  const bridge = async (name, args) => {
    calls.push({ name, args });
    await db.exec(who ? `set role authenticated` : `set role anon`);
    await db.query(`select set_config('pv.uid', $1, false)`, [who || '']);
    try { return (await db.query(`select public.${name}($1::jsonb) as v`, [J(args && args.p)])).rows[0].v; }
    catch (e) { return { __err: String(e.message) }; }
    finally { await db.exec(`reset role`); await db.query(`select set_config('pv.uid', '', false)`); }
  };
  const HARNESS = (lang) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>harness</title>
    <link rel="stylesheet" href="/pv-tokens.css"><link rel="stylesheet" href="/my-value.css"></head>
    <body><main><section id="your-status"><button id="other">ほかのボタン</button><div id="pv-proof-slot"></div></section>
    <p><button type="button" id="later" data-pv-proof-open>開く</button></p></main>
    <script>const sb = { rpc: (n, a) => window.__rpc(n, a).then((d) => d && d.__err ? { data: null, error: { message: d.__err } } : { data: d, error: null }) };</script>
    <script src="/pv-proof-offer.js"></script></body></html>`;
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/h-ja.html' || u.pathname === '/h-en.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(HARNESS(u.pathname === '/h-en.html' ? 'en' : 'ja'));
    }
    const f = path.join(ROOT, path.normalize(u.pathname).replace(/^(\.\.[/\\])+/, ''));
    if (!f.startsWith(ROOT) || !existsSync(f) || !/\.(js|css)$/.test(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': f.endsWith('.css') ? 'text/css' : 'text/javascript' }); res.end(readFileSync(f));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  ok(![3000, 3100, 3111].includes(port), `空いている番号で立てた（${port}）`);
  const base = `http://127.0.0.1:${port}`;
  const outside = [];
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'pv-proof-offer-'));
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);
    await page.setRequestInterception(true);
    page.on('request', (r) => { const u = r.url();
      if (u.startsWith(base + '/') || u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
      outside.push(u); return r.abort(); });
    await page.exposeFunction('__rpc', bridge);
    const state = () => page.evaluate(() => ({
      dialog: !!document.querySelector('#pvpo-back [role=dialog]'),
      inert: document.querySelectorAll('[inert]').length,
      lock: document.documentElement.classList.contains('pvpo-lock'),
      card: (document.querySelector('#pv-proof-slot .mp-row') || {}).textContent || '',
      cardT: (document.querySelector('#pv-proof-slot .mp-row-t') || {}).textContent || '',
      cardS: (document.querySelector('#pv-proof-slot .mp-row-s') || {}).textContent || '',
      cardState: (document.querySelector('#pv-proof-slot [data-pvpo-state]') || { getAttribute: () => '' }).getAttribute('data-pvpo-state'),
      text: (document.querySelector('#pvpo-back') || {}).textContent || '',
      focus: document.activeElement && (document.activeElement.id || document.activeElement.className || document.activeElement.tagName),
      store: [localStorage.length, sessionStorage.length] }));
    const waitFor = (fn, ...a) => page.waitForFunction(fn, { timeout: 15000 }, ...a);
    /* 入口のカードが「見えて」いる（返事が来たその場で、見えないまま場所を取る ── 見えるまでは押せない） */
    const cardShown = () => { const c = document.querySelector('#pv-proof-slot [data-pvpo-state]'); return !!c && getComputedStyle(c).visibility === 'visible'; };
    const until = async (fn, ms = 10000) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('until timeout'); await new Promise((r) => setTimeout(r, 50)); } };

    console.log('\n▼ 場面1（A）マイページの入口 → ポップアップ → 画像を出す（REAL LOCAL SQL）');
    await page.goto(base + '/h-ja.html');
    await waitFor(cardShown);
    let s = await state();
    ok(s.cardState === 'none' && s.card.includes('パイロットであることの確認をお願いします') && s.card.includes('画像を選んで提出する'),
       '申請していない会員：入口のカードに「パイロットであることの確認をお願いします」と「画像を選んで提出する」', J(s));
    ok(calls.length === 1 && calls[0].name === 'pv_stay_apply' && J(calls[0].args) === J({ p: {} }), '入口は状態を1回読むだけ（画像は送らない）', J(calls));
    await page.click('#pv-proof-slot button');
    await waitFor(() => document.querySelector('#pvpo-back [role=dialog]'));
    s = await state();
    ok(s.dialog && s.lock && s.inert >= 1 && !s.text.includes('停止'), '★ポップアップが開く（下の画面は触れない）・「停止」の字はどこにも無い', J(s));
    const leadP = await page.evaluate(() => [...document.querySelectorAll('#pvpo-back .pvpo-s')].map((p) => p.textContent));
    ok(J(leadP) === J(['パイロットであることが分かる画像を1枚ご提出ください。', 'Only VERIFIED PILOT']) && !/確認済みのパイロット/.test(s.text),
       '★ポップアップの説明は「パイロットであることが分かる画像を1枚ご提出ください。」と「Only VERIFIED PILOT」だけ（オーナーの字）', J(leadP));
    const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 2400; c.height = 1600; const x = c.getContext('2d');
      for (let i = 0; i < 400; i++) { x.fillStyle = `hsl(${i % 360},70%,${30 + (i % 40)}%)`; x.fillRect((i * 37) % 2400, (i * 53) % 1600, 180, 120); }
      return c.toDataURL('image/png').split(',')[1]; });
    const pngPath = path.join(tmp, 'wings.png'); writeFileSync(pngPath, Buffer.from(png, 'base64'));
    const n0 = calls.length;
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.click('#pvpo-back .pvpo-go[data-act="pick"]')]);
    await chooser.accept([pngPath]);
    await waitFor(() => document.querySelector('#pvpo-back .pvpo-prev img'));
    ok(calls.length === n0, '選んだだけでは何も送らない');
    await page.click('#pvpo-back .pvpo-go[data-act="send"]');
    await waitFor(() => /画像を受け取りました/.test((document.querySelector('#pvpo-back') || {}).textContent || ''));
    const sent = calls.slice(n0);
    const img0 = sent.find((x) => x.args && x.args.p && 'image' in x.args.p);
    const bytes = img0 && Buffer.from(String(img0.args.p.image), 'base64');
    const withImg = sent.filter((x) => x.args && x.args.p && 'image' in x.args.p);
    ok(sent.every((x) => x.name === 'pv_stay_apply') && withImg.length === 1 && J(Object.keys(withImg[0].args.p)) === J(['image'])
       && sent.filter((x) => x !== withImg[0]).every((x) => J(x.args) === J({ p: {} })),
       '★送ったのは pv_stay_apply だけ：画像を送ったのは1回・中身は image の1つだけ（あとは入口の読み直し）', J(sent.map((x) => [x.name, Object.keys(x.args.p || {})])));
    ok(bytes && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes.length <= 800000 && Buffer.from(png, 'base64').length !== bytes.length,
       '★PNG は canvas で JPEG に焼き直して送った（800KB 以内）', bytes ? `${bytes.length} bytes` : 'none');
    const row = (await db.query(`select b.state, i.byte_len, encode(i.bytes,'hex') = $2 as same from public.pv_proof b join public.pv_proof_images i on i.user_id = b.user_id where b.user_id = $1`,
                                [A, bytes ? bytes.toString('hex') : ''])).rows[0];
    ok(row && row.state === 'offered' && row.same === true, '★保存先には申請（offered）が1行と、送ったのと同じ画像が1枚', J(row));
    await page.click('#pvpo-back .pvpo-go[data-act="close"]');
    await waitFor(() => !document.querySelector('#pvpo-back') && document.querySelector('#pv-proof-slot [data-pvpo-state="offered"]'));
    s = await state();
    ok(!s.dialog && s.inert === 0 && !s.lock, '★閉じたら、下の画面は元どおり（inert も lock も残らない）', J(s));
    ok(s.card.includes('画像を受け取りました') && s.card.includes('別の画像を出し直す'), '入口は「画像を受け取りました」「別の画像を出し直す」に変わる', s.card);
    ok(s.store[0] === 0 && s.store[1] === 0, '★保存領域に何も書いていない（画像も状態も）', J(s.store));

    console.log('\n▼ 場面2（A）閉じ方は3つ（×・ESC・外側）。どれでも元どおり');
    for (const [how, act] of [['×', async () => page.click('#pvpo-back .pvpo-x')], ['ESC', async () => page.keyboard.press('Escape')],
                              ['外側', async () => page.mouse.click(5, 5)]]) {
      await page.click('#later');
      await waitFor(() => document.querySelector('#pvpo-back [role=dialog]'));
      await act();
      await waitFor(() => !document.querySelector('#pvpo-back'));
      s = await state();
      ok(!s.dialog && s.inert === 0 && !s.lock && s.focus === 'later', `★${how}で閉じる・inert も lock も残らない・押したボタンへ戻る`, J(s));
    }

    console.log('\n▼ 場面3（A）画像でないもの・受け付けられない人・見てよい人・未ログイン');
    await page.click('#later'); await waitFor(() => document.querySelector('#pvpo-back [role=dialog]'));
    const txt = path.join(tmp, 'note.txt'); writeFileSync(txt, 'not an image');
    const n1 = calls.length;
    const [ch2] = await Promise.all([page.waitForFileChooser(), page.click('#pvpo-back .pvpo-go[data-act="pick"]')]);
    await ch2.accept([txt]);
    await waitFor(() => /読み込めませんでした/.test(document.querySelector('#pvpo-back').textContent));
    ok(calls.length === n1, '画像でないものは「読み込めませんでした」・何も送らない');
    await page.keyboard.press('Escape');
    who = CHK;
    await page.goto(base + '/h-ja.html'); await waitFor(() => window.PVProofOffer);
    await new Promise((r) => setTimeout(r, 300));
    await page.click('#later'); await waitFor(() => document.querySelector('#pvpo-back [role=dialog]'));
    const [ch3] = await Promise.all([page.waitForFileChooser(), page.click('#pvpo-back .pvpo-go[data-act="pick"]')]);
    await ch3.accept([pngPath]);
    await waitFor(() => document.querySelector('#pvpo-back .pvpo-prev img'));
    await page.click('#pvpo-back .pvpo-go[data-act="send"]');
    await waitFor(() => /いまは受け付けられません/.test(document.querySelector('#pvpo-back').textContent));
    ok(J((await db.query(`select state from public.pv_proof where user_id=$1`, [CHK])).rows) === J([{ state: 'submitted' }]),
       '★運営の確認の途中の人には「いまは受け付けられません」とだけ出し、その行には触らない');
    await page.keyboard.press('Escape');
    s = await state();
    ok(s.cardState === 'none', 'その人のマイページの入口は、ほかの会員と同じ「none」の形（確認を求められたことを画面へ渡さない）', J(s));
    who = V; await page.goto(base + '/h-ja.html');
    await waitFor(cardShown);
    s = await state();
    ok(s.cardState === 'approved' && s.cardT === 'VERIFIED PILOT です' && s.cardS === 'Only VERIFIED PILOT' && !(await page.$('#pv-proof-slot button')),
       '★見てよい人：「VERIFIED PILOT です」と「Only VERIFIED PILOT」だけ（ボタンは無い・オーナーの字）', J(s));
    who = OWN; calls.length = 0; await page.goto(base + '/h-ja.html');
    await until(() => calls.length >= 1); await new Promise((r) => setTimeout(r, 300));
    ok((await state()).card === '' && calls.length === 1, 'オーナーには入口を描かない');
    who = null; calls.length = 0; await page.goto(base + '/h-ja.html'); await until(() => calls.length >= 1); await new Promise((r) => setTimeout(r, 300));
    ok((await state()).card === '', '未ログインには入口を描かない');

    console.log('\n▼ 場面4（A）英語');
    who = A; await page.goto(base + '/h-en.html');
    await waitFor(cardShown);
    s = await state();
    ok(s.cardState === 'offered' && s.card.includes('We have received your image') && s.card.includes('Submit a different image'), '英語の入口', s.card);

    ok(outside.length === 0, '★ページから外への通信は0本（手元の配信だけ）', outside.join(' '));

    /* 場面5（WP-towns-13w・P12.48）本物のマイページ（profile.html ／ en/profile.html）で、入口のボタンは出た瞬間の場所から動かない。
       マイページはカードより上の段（名前・会員の情報の行）をあとから埋め、書体もあとから入れ替わる ── 先に描くと、出た直後に
       ボタンが数十 px 上下する（すぐ押した指が外れる）。出た絵から60枚（約1秒・決まりの10枚より長く）見て、上下の幅が2px 以内。
       「出た」＝見えた絵から数える（カードは返事が来たその場で、見えないまま最後の形で場所を取り、落ち着いてから見せる）。
       ★もう1行：カードが見えたとき、その下の NEXT ACTION のボタン（#na-cta ＝ このページの本題）を押し下げない。
         場所を空けたまま待つと、空いた場所に NEXT ACTION が上がって出て、カードが出た瞬間に最初の画面の外へ押し出される。
         見えた絵の1枚前と見えた絵で2px 以内／いちど最初の画面に入ったら、そのあと外へ出ない・消えない。
       ★手元の使い捨ての保存先（local-chain.mjs の bring ・ OS が選ぶ番号・3000 番は使わない）に、手元の会員 'a' として入る。
         本番にも 3000 番にも通信しない（*.supabase.* もほかの行き先も0本）。 */
    console.log('\n▼ 場面5（A）本物のマイページ：入口のボタンは、出た瞬間の場所から動かない（手元の保存先・REAL LOCAL CONNECTION）');
    const { bring, open: openAs } = await import('./local-chain.mjs');
    const LC = await bring();
    try {
      for (const [lang, wd, ht] of [['ja', 390, 844], ['en', 390, 844], ['ja', 1440, 900], ['en', 1440, 900]]) {
        const { ctx, page: mp, st } = await openAs(browser, LC.base, { who: 'a', w: wd, h: ht });
        await mp.evaluateOnNewDocument(() => {
          window.__pvBtn = [];                 // 見えた絵から1枚ずつ、ボタンの上端（画面の座標）。見えたあとで消えたら・隠れたら null
          window.__pvNa = [];                  // 最初の絵から1枚ずつ、[NEXT ACTION のボタンの上端（出ていなければ null）, カードのボタンが見えていたか]
          const shown = (el) => !!el && !el.hidden && getComputedStyle(el).visibility === 'visible' && el.getBoundingClientRect().height > 0;
          const tick = () => {
            const b = document.querySelector('#pv-proof-slot [data-pvpo-state="none"] button');
            const seen = shown(b);
            if (seen || window.__pvBtn.length) window.__pvBtn.push(seen ? b.getBoundingClientRect().top : null);
            const n = document.getElementById('na-cta');
            window.__pvNa.push([shown(n) ? n.getBoundingClientRect().top : null, seen]);
            if (window.__pvBtn.length < 61 && window.__pvNa.length < 1200) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        await mp.goto(LC.base + (lang === 'en' ? '/en/profile.html' : '/profile.html'), { waitUntil: 'load' });
        /* 待つのはボタンが出て60枚たつまで（出なければ、この下の1行が赤くなる ── ここで止めない） */
        await mp.waitForFunction(() => window.__pvBtn.length >= 61, { timeout: 20000 }).catch(() => {});
        const ys = await mp.evaluate(() => window.__pvBtn);
        const nums = ys.filter((y) => typeof y === 'number');
        const spread = nums.length ? Math.round((Math.max(...nums) - Math.min(...nums)) * 10) / 10 : null;
        ok(ys.length >= 61 && nums.length === ys.length && spread !== null && spread <= 2 && st.supa.size === 0 && st.blocked.size === 0 && st.errs.length === 0,
           `★${lang} ${wd}px：マイページの入口のボタンは、出た瞬間の場所から動かない（出てから60枚の上下が2px 以内・消えない・外への通信0本）`,
           J({ frames: ys.length, first: nums[0], spread, moved: [...new Set(ys.map((y) => (y === null ? null : Math.round(y))))].slice(0, 6),
               supa: [...st.supa], blocked: [...st.blocked], errs: st.errs.slice(0, 2) }));
        const na = await mp.evaluate(() => window.__pvNa);
        const k = na.findIndex((f) => f[1]);                                   // カードのボタンが初めて見えた絵
        const before = k > 0 ? na[k - 1][0] : null, at = k >= 0 ? na[k][0] : null;
        const on = (y) => typeof y === 'number' && y < ht;                    // 最初の画面の中（上端が画面の下端より上）
        const f0 = na.findIndex((f) => on(f[0]));                              // NEXT ACTION が初めて最初の画面に入った絵
        const out = f0 < 0 ? -1 : na.findIndex((f, i) => i > f0 && !on(f[0]));
        const last = na.length ? na[na.length - 1][0] : null;
        ok(k >= 0 && typeof last === 'number' && (before === null || (typeof at === 'number' && Math.abs(at - before) <= 2)) && out < 0,
           `★${lang} ${wd}px：カードが見えても、NEXT ACTION のボタンは押し下げられない（見える前後で2px 以内・最初の画面に入ったら外へ出ない）`,
           J({ shownAt: k, before: before === null ? null : Math.round(before), at: at === null ? null : Math.round(at),
               firstOn: f0, pushedOutAt: out, outY: out < 0 ? null : na[out][0], last: last === null ? null : Math.round(last), h: ht }));
        await ctx.close();
      }
    } finally { await LC.stop(); }

    /* 場面6（WP-ans-c・2026-10-18 オーナー Q2「もし中身が見たいなら証明を提出してもらうポップアップ出さないと」）
       本物の会社の画面（JAL の最初の就航地）のホテルの欄を、手元の使い捨ての保存先で歩く（REAL LOCAL CONNECTION ── local-chain.mjs の bring・
       OS が選ぶ番号・3000 番は使わない。本番にも 3000 番にも通信しない）。
       ★未ログイン：鍵の1行は「ログイン」の入口のまま（確認の入口は無い）・申請の口を呼ばない。
       ★ホテルの追加（未ログインでも会員でも、名前 → 送る）の途中で、このポップアップは1回も開かない（追加は名前 → 送信1回）。
       ★ログインしている会員（見てよい人ではない 'a'）：鍵の1行に「画像を選んで提出する」の入口が1つ → 押すとこのポップアップ。
         画像を出すと、鍵の1行は「運営が確認するまでお待ちください。」に替わり、読み直しても同じ（サーバーの申請の状態から）。
         ★出しても何も開かない：返事は locked のまま・見てよい人の名簿に居ない（承認はオーナーが verified を押したときだけ）。
       ★見てよい人 'pilot'・オーナー 'op'：欄が開く（確認の入口も、申請の口への呼び出しも無い）。
       画像は scene 1 と同じ、その場で描いた絵（本物の画像は使わない）。 */
    console.log('\n▼ 場面6（A）ホテルの欄の、会員の鍵の1行から このポップアップへ（未ログインには出さない・ホテルの追加からは開かない）── 本物の会社の画面・手元の保存先（REAL LOCAL CONNECTION）');
    {
      const { bring: bring6, open: open6, rpcAs } = await import('./local-chain.mjs');
      const LC6 = await bring6();
      const outs = [];
      try {
        const IATA = (read('airlines/jal.html').match(/href="#stay-([A-Z]{3})" data-city="\1"/) || [])[1];
        const SL = '#pvg-city .crl[data-live="hotels"]', ZN = SL + ' + .crs-zone', FM = ZN + ' .crs-formbox > .crs-form';
        const LOCK = 'Only VERIFIED PILOT', LOGIN = 'ログイン', PICK = '画像を選んで提出する', WAIT = '運営が確認するまでお待ちください。';
        const A_ID = '00000000-0000-4000-8000-0000000000a1';           // serve-local.mjs の手元の会員 'a'（模擬）
        const ready = (p) => p.waitForFunction((sl, zn) => {
          const e = document.querySelector(sl);
          return !!e && e.getClientRects().length > 0 && !/^(idle|loading)$/.test(e.dataset.state || '') && !!document.querySelector(zn + ' .crs-ent[data-kind="hotel"]');
        }, { timeout: 20000 }, SL, ZN).then(() => true, () => false);
        const go = async (who) => {
          const o = await open6(browser, LC6.base, { who, w: 1440, h: 820 });
          outs.push(o.st);
          await o.page.evaluateOnNewDocument(() => {
            window.__pvpo = 0;                                         // このポップアップ（#pvpo-back）が画面に出た回数
            new MutationObserver((ms) => { ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.id === 'pvpo-back') window.__pvpo++; })); })
              .observe(document, { childList: true, subtree: true });
          });
          await o.page.goto(`${LC6.base}/airlines/jal.html#stay-${IATA}`, { waitUntil: 'load' });
          o.ok = await ready(o.page);
          return o;
        };
        const see = (p) => p.evaluate((sl) => {
          const e = document.querySelector(sl), tx = (x) => (x ? x.textContent.replace(/\s+/g, ' ').trim() : '');
          return { state: e.dataset.state, who: e.getAttribute('data-who'), text: tx(e),
            proof: [...e.querySelectorAll('[data-crs-proof]')].map((x) => `${x.tagName.toLowerCase()}:${x.getAttribute('data-crs-proof')}`).join(','),
            pvpo: window.__pvpo, dialog: !!document.querySelector('#pvpo-back') };
        }, SL);
        const applied = (st) => st.sent.filter((x) => x.fn === 'pv_stay_apply');
        /* 欄の外の「ホテルを追加」→ 名前だけ打つ → 送る（1回押す）。返事を待ち、面が答えを出すまで待つ。 */
        const addHotel = async (p, st, name) => {
          const n0 = st.got.filter((g) => g.fn === 'pv_stay_add').length;
          await p.click(`${ZN} .crs-ent[data-kind="hotel"]`);
          await p.waitForSelector(`${FM} [data-k="name"]`, { visible: true });
          await p.focus(`${FM} [data-k="name"]`);
          await p.keyboard.type(name);
          await p.click(`${FM} button[type="submit"]`);
          await until(() => st.got.filter((g) => g.fn === 'pv_stay_add').length > n0, 20000).catch(() => {});
          await p.waitForFunction((zn) => { const z = document.querySelector(zn + ' .crs-zone-say'); return !!z && /追加しました/.test(z.textContent); },
            { timeout: 20000 }, ZN).catch(() => {});
          const r = st.got.filter((g) => g.fn === 'pv_stay_add').slice(n0)[0];
          try { return JSON.parse(r.text); } catch { return null; }
        };

        /* 未ログイン */
        const g = await go(null);
        const g1 = await see(g.page);
        const gAdd = await addHotel(g.page, g.st, '検査用のゲストのホテル（場面6・手元）');
        const g2 = await see(g.page);
        ok(g.ok && g1.state === 'locked' && g1.who === 'login' && g1.text === LOCK + LOGIN && g1.proof === '' && !!gAdd && gAdd.ok === true
           && g2.pvpo === 0 && !g2.dialog && g2.proof === '' && applied(g.st).length === 0,
           `★未ログイン：鍵の1行は「${LOGIN}」の入口のまま（確認の入口は無い）・ホテルを追加しても（名前 → 送る）ポップアップは1回も開かない・申請の口を呼ばない`,
           J({ g1, gAdd, g2, apply: applied(g.st).length }));
        await g.ctx.close();

        /* ログインしている会員（見てよい人ではない） */
        const m = await go('a');
        let v = await see(m.page);
        ok(m.ok && v.state === 'locked' && v.who === 'member' && v.text === LOCK + PICK && v.proof === 'button:none'
           && J(applied(m.st).map((x) => x.p)) === J([{}]),
           `★ログインしている会員（見てよい人ではない）：鍵の1行に「${PICK}」の入口が1つ（「${LOGIN}」は無い）・申請の口は状態を読む1回だけ（空の {}）`,
           J({ v, apply: applied(m.st).map((x) => x.p) }));
        const mAdd = await addHotel(m.page, m.st, '検査用の会員のホテル（場面6・手元）');
        v = await see(m.page);
        ok(!!mAdd && mAdd.ok === true && v.pvpo === 0 && !v.dialog && applied(m.st).length === 1 && v.text === LOCK + PICK,
           '★会員がホテルを追加しても（名前 → 送る）、ポップアップは開かない・申請の口を呼ばない・鍵の1行の入口はそのまま', J({ mAdd, v }));
        const pressed = await m.page.click(`${SL} [data-crs-proof="none"]`).then(() => true, () => false);
        const opened = pressed && await m.page.waitForSelector('#pvpo-back [role=dialog]', { timeout: 15000 }).then(() => true, () => false);
        const popT = opened ? await m.page.evaluate(() => document.getElementById('pvpo-t').textContent) : '';
        ok(opened && popT === 'パイロットであることの確認をお願いします' && (await see(m.page)).pvpo === 1,
           '★鍵の1行の入口を押すと、このポップアップ（マイページの入口と同じもの）が開く', popT);
        const n1 = applied(m.st).length;
        let sentOk = false;
        if (opened) {
          const [ch6] = await Promise.all([m.page.waitForFileChooser(), m.page.click('#pvpo-back .pvpo-go[data-act="pick"]')]);
          await ch6.accept([pngPath]);
          await m.page.waitForSelector('#pvpo-back .pvpo-prev img');
          await m.page.click('#pvpo-back .pvpo-go[data-act="send"]');
          sentOk = await m.page.waitForFunction(() => /画像を受け取りました/.test((document.querySelector('#pvpo-back') || {}).textContent || ''), { timeout: 20000 })
            .then(() => true, () => false);
          await m.page.click('#pvpo-back .pvpo-go[data-act="close"]').catch(() => {});
          await m.page.waitForFunction(() => !document.querySelector('#pvpo-back'), { timeout: 10000 }).catch(() => {});
        }
        v = await see(m.page);
        const sentImg = applied(m.st).slice(n1);
        const rs = await rpcAs(LC6.base, 'a', 'pv_stays', { airline: 'jal', iata: IATA });
        const vw = (await LC6.q(`select count(*)::int as n from public.pv_stay_viewers where user_id = $1 and state = 'approved'`, [A_ID])).rows[0].n;
        const pf = (await LC6.q(`select state from public.pv_proof where user_id = $1`, [A_ID])).rows;
        ok(sentOk && v.text === LOCK + WAIT && v.proof === 'span:offered' && sentImg.length === 1 && typeof (sentImg[0].p || {}).image === 'string'
           && !!rs.body && rs.body.ok === true && rs.body.state === 'locked' && vw === 0 && J(pf) === J([{ state: 'offered' }]),
           `★画像を出したあと：鍵の1行は「${WAIT}」に替わる・出しても何も開かない（ホテルの返事は locked のまま・見てよい人の名簿に居ない・申請は offered）`,
           J({ sentOk, v, sentImg: sentImg.length, rs: rs.text, vw, pf }));
        await m.page.reload({ waitUntil: 'load' });
        const back = await ready(m.page);
        v = await see(m.page);
        ok(back && v.state === 'locked' && v.text === LOCK + WAIT && v.proof === 'span:offered' && v.pvpo === 0,
           `読み直しても「${WAIT}」（サーバーの申請の状態から。入口のボタンは出ない）`, J(v));
        await m.ctx.close();

        /* 見てよい人・オーナー */
        for (const who of ['pilot', 'op']) {
          const o = await go(who);
          const w6 = await see(o.page);
          ok(o.ok && w6.state !== 'locked' && w6.proof === '' && w6.pvpo === 0 && applied(o.st).length === 0,
             `${who === 'op' ? 'オーナー' : '見てよい人'} '${who}'：欄が開く（確認の入口も、申請の口への呼び出しも無い）`, J(w6));
          await o.ctx.close();
        }
        const supa = outs.flatMap((st) => [...st.supa]), blocked = outs.flatMap((st) => [...st.blocked]), errs = outs.flatMap((st) => st.errs);
        ok(supa.length === 0 && blocked.length === 0 && errs.length === 0,
           '★場面6のどのページも、手元と書体・部品の配信元のほかへ1本も投げていない・ページのエラー0', J({ supa, blocked, errs: errs.slice(0, 2) }));
      } finally { await LC6.stop(); }
    }
  } finally {
    await browser.close(); srv.close(); rmSync(tmp, { recursive: true, force: true });
  }
}
