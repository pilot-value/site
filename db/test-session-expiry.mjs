/* pv-session.js — ログインを永久に持ち越さないこと。
   ここは「切れること」と「切れすぎないこと」の両方が壊れると痛い。
     ① 切れない → 共有端末・盗難端末に明細と年収が残り続ける
     ② 切れすぎる → 毎月戻ってもらう導線が毎回ログインになり投稿が止まる
   なので実際に localhost のページを読み込み、**本物の pv-session.js** を
   head で走らせた結果を見る（判定式をテスト側に写経しない）。

   実行: node serve.mjs を上げてから node db/test-session-expiry.mjs        */
import puppeteer from 'puppeteer';

const BASE = 'http://localhost:3000';
const PUBLIC_PAGE  = '/404.html';        // 軽くて pv-session.js が入っているページ
const GUARDED_PAGE = '/profile.html';    // ログインが要るページ
const AUTH_KEY = 'sb-vzgmnkrggrwtsrpqndsm-auth-token';

const DAY = 24 * 60 * 60 * 1000;

let pass = 0, fail = 0;
const ok = (c, m, got) => { c ? (pass++, console.log(`  ✅ ${m}`))
                              : (fail++, console.log(`  ❌ ${m}  → 実際: ${JSON.stringify(got)}`)); };

/* 保存セッションを作る。supabase-js は v2.4x 以降 "base64-<base64>" で入れるので
   両方の形を作れるようにしておく（片方しか読めないと全部素通りする）。 */
function makeSession({ signedInDaysAgo = 0 }) {
  return {
    access_token: 'test-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'test-refresh-token',
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'session-test@example.com',
      last_sign_in_at: new Date(Date.now() - signedInDaysAgo * DAY).toISOString(),
    },
  };
}

const browser = await puppeteer.launch({ headless: 'shell' });
const page = await browser.newPage();
/* wipe() の revoke は本物の Supabase に出る。テストから本番を叩かないよう、
   401 を返す偽物で受ける（abort だと fetch の失敗の仕方が実物と変わる）。 */
await page.setRequestInterception(true);
page.on('request', (r) => (/supabase\.co/.test(r.url())
  ? r.respond({ status: 401, contentType: 'application/json', body: '{}' })
  : r.continue()));

/* 状態を仕込んでから読み直す。pv-session.js は head で同期に走るので、
   「仕込む → 読み直す」でないと判定前の状態を作れない。
   ★ページ側が読み込み中に location を書き換えると goto が解決しないので、
     失敗は握りつぶして最終的な URL を後から見る。 */
async function loadWith(path, state) {
  await page.goto(`${BASE}${PUBLIC_PAGE}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((s) => {
    localStorage.clear(); sessionStorage.clear();
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, state);
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (e) { /* 読み込み中のリダイレクトで解決しないことがある */ }
}

const snapshot = () => page.evaluate(() => ({
  user: localStorage.getItem('pv_user'),
  authKeys: Object.keys(localStorage).filter((k) => /^sb-.+-auth-token$/.test(k)),
  unlock: localStorage.getItem('pv_unlock_expiry'),
  expiredFlag: (() => { try { return sessionStorage.getItem('pv_expired'); } catch (e) { return null; } })(),
  lastActive: localStorage.getItem('pv_last_active'),
  path: location.pathname,
}));

const LOGGED_IN = {
  pv_user: JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', name: 'Test Pilot', email: 'session-test@example.com' }),
  pv_unlock_expiry: String(Date.now() + 30 * DAY),
};

console.log('\npv-session.js — 切れること / 切れすぎないこと\n');

// ── ① 入りたての人は切らない ──
await loadWith(PUBLIC_PAGE, {
  ...LOGGED_IN,
  [AUTH_KEY]: JSON.stringify(makeSession({ signedInDaysAgo: 0 })),
  pv_last_active: String(Date.now()),
});
let s = await snapshot();
ok(s.user !== null && s.authKeys.length === 1, '入りたて（0日）→ ログインは残る', s);

// ── ② 無操作6日はまだ切らない（境界の手前） ──
await loadWith(PUBLIC_PAGE, {
  ...LOGGED_IN,
  [AUTH_KEY]: JSON.stringify(makeSession({ signedInDaysAgo: 6 })),
  pv_last_active: String(Date.now() - 6 * DAY),
});
s = await snapshot();
ok(s.user !== null && s.authKeys.length === 1, '無操作6日 → まだ残る（切れすぎない）', s);

// ── ③ 無操作8日で切る ──
await loadWith(PUBLIC_PAGE, {
  ...LOGGED_IN,
  [AUTH_KEY]: JSON.stringify(makeSession({ signedInDaysAgo: 8 })),
  pv_last_active: String(Date.now() - 8 * DAY),
});
s = await snapshot();
ok(s.user === null, '無操作8日 → pv_user を消す', s);
ok(s.authKeys.length === 0, '無操作8日 → supabase のトークンも消す', s);
ok(s.unlock === null, '無操作8日 → 解放期限も消す', s);
ok(s.expiredFlag === '1', '無操作8日 → 案内用の pv_expired が立つ', s);

// ── ④ 毎日来ていても、ログインから31日で切る ──
//    ここが効かないと「この機能を入れる前からログインしっぱなしの人」が永久に残る。
await loadWith(PUBLIC_PAGE, {
  ...LOGGED_IN,
  [AUTH_KEY]: JSON.stringify(makeSession({ signedInDaysAgo: 31 })),
  pv_last_active: String(Date.now()),          // ついさっきまで使っていた
});
s = await snapshot();
ok(s.user === null && s.authKeys.length === 0, 'ログインから31日 → 無操作でなくても切る', s);

// ── ⑤ 保存形式が "base64-" でも読めること ──
//    supabase-js v2.4x 以降の形。ここを外すと全部素通りして永久ログインに戻る。
await page.goto(`${BASE}${PUBLIC_PAGE}`, { waitUntil: 'domcontentloaded' });
await page.evaluate((args) => {
  const [key, session, last, user] = args;
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem(key, 'base64-' + btoa(unescape(encodeURIComponent(JSON.stringify(session)))));
  localStorage.setItem('pv_last_active', last);
  localStorage.setItem('pv_user', user);
}, [AUTH_KEY, makeSession({ signedInDaysAgo: 40 }), String(Date.now()), LOGGED_IN.pv_user]);
await page.goto(`${BASE}${PUBLIC_PAGE}`, { waitUntil: 'domcontentloaded' });
s = await snapshot();
ok(s.user === null && s.authKeys.length === 0, 'base64- 形式の保存でも 40日超を切れる', s);

// ── ⑥ 未ログインの人には何もしない ──
await loadWith(PUBLIC_PAGE, {});
s = await snapshot();
ok(s.user === null && s.lastActive === null, '未ログイン → 何も書かない・何も壊さない', s);

// ── ⑦ サイトに来れば無操作カウントが進む（＝来ている限り切れない） ──
const staleAt = Date.now() - 3 * DAY;
await loadWith(PUBLIC_PAGE, {
  ...LOGGED_IN,
  [AUTH_KEY]: JSON.stringify(makeSession({ signedInDaysAgo: 1 })),
  pv_last_active: String(staleAt),
});
s = await snapshot();
ok(Number(s.lastActive) > staleAt + 2 * DAY, 'ページを開くと pv_last_active が今に進む', { staleAt, now: s.lastActive });

// ── ⑧ 期限切れでログイン必須ページを開いたら、ログイン画面に着く ──
await loadWith(GUARDED_PAGE, {
  ...LOGGED_IN,
  [AUTH_KEY]: JSON.stringify(makeSession({ signedInDaysAgo: 9 })),
  pv_last_active: String(Date.now() - 9 * DAY),
});
// ページ側の getSession ゲートが飛ばすのを待つ
for (let i = 0; i < 40 && !/login\.html$/.test(page.url().split('?')[0]); i++) {
  await new Promise((r) => setTimeout(r, 200));
}
s = await snapshot();
ok(/login\.html$/.test(s.path), '期限切れ + profile.html → login.html に着く', s);

// ── ⑨ ログイン画面に「自動的にログアウトしました」が出る ──
const noticeShown = await page.evaluate(() => {
  const el = document.getElementById('expired-notice');
  return el ? getComputedStyle(el).display !== 'none' : null;
});
ok(noticeShown === true, 'login.html に失効の案内が出る', noticeShown);

// ── ⑩ 案内は一度きり（読み直しても出しっぱなしにしない） ──
await page.reload({ waitUntil: 'domcontentloaded' });
const noticeAgain = await page.evaluate(() => {
  const el = document.getElementById('expired-notice');
  return el ? getComputedStyle(el).display !== 'none' : null;
});
ok(noticeAgain === false, '読み直すと案内は消える（一度きり）', noticeAgain);

await browser.close();

console.log(`\n=== ${pass} pass / ${fail} fail ===\n`);
process.exitCode = fail ? 1 : 0;
