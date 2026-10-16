/* assert-stays.mjs — 就航地の「ホテル」の欄（career-stay.js ⇄ db/stays.sql）を、手元の本物の保存先につないで歩く（2026-10-16）。

   画面だけの検査（assert-airline-glance.mjs の stay ほか）は、サーバーの返事を作り物で返している。
   ここでは serve-local.mjs の使い捨ての保存先に本物の SQL を流し、画面とブラウザの外からの呼び出しの両方で確かめる。

   場面 chain（S1〜S7）
     S1  ログインしていない人は、ホテルが在っても locked の1行だけを受け取る
         （返事は {"ok":true,"state":"locked"} そのもの・名前は返事にも画面にも保存領域にも無い・鍵の1行と「ログイン」）。
     S2  ログインせずに「ホテルを追加」→ 名前 → 送る：保存される・端末の鍵が返る・「あなたの投稿」「確認待ち」が出る・
         運営（オーナー 'op'）の待ち行列が1つ増える。会員 'a' と給与を出した人 'pay' は locked のまま
         （'pay' は鍵の1行だけ）。承認された人 'pilot' にも、確認前の他人の行は返らない。
     S2b ほかのログインなしの人が、公開済みのホテルと同じ名前を送る：保存され、在ることは言わない。運営が通すと exists。
     S2c オーナーではない運営（この保存先の中だけで 'c' を運営の名簿に入れる）：待ち行列は1つ増えて見えるが、一覧は locked。
     S3  運営が通す：承認された人 'pilot' に届く。'a'・'pay'・ほかのログインなしの人は locked のまま。送った人の札から「確認待ち」が消える。
     S4  給与の鍵は、期限が切れていても生きていても何も開かない。承認された人の承認をオーナーが取り消すと
         （本物の口 pv_stay_viewer_decide）、読み直した時から locked。開いているあいだ、保存領域にホテルの名前は無い。
     S5  つながっていない（この保存先の中で pv_stays と pv_stay_add を消す）→「準備中」・入口の3つ・押しても「準備中」・面は開かない。
     S6  読めなかった →「読み込めませんでした」＋「もう一度」→ 押すとやり直せる。
     S7  30秒以内の2つめ →「続けて追加するときは、少し時間をあけてください。」・打った字は面に残る。
     終わりに：どのページも、手元と書体・部品の配信元のほかへ、1本も投げていない（st.blocked・st.supa が空）。

   場面 two（S8・S8b）・login（S9）・kept（S10）・career（S11）── どれも自分の使い捨ての保存先を持つ（chain の S5 が関数を消すため）
     S8  会員 'a' がログインしたまま足す → サイトのログアウト（profile.html の「ログアウト」）→ 札も名前も残らない。
         別の窓の会員 'b' には何も無い。'a' がまた入ると札が戻る。オーナーが承認した2人目 'c'
         （申し込みの行が無いうちは承認できない ── not_found）の開いた一覧は、ほかのタブでログアウトすると鍵の1行に戻る。
         給与提出者 'pay' は locked のまま。
     S8b ログインなしで足す → 同じ窓で 'a' がログイン：札は残り、端末の鍵は端末からも保存先からも消える（引き取り）→
         ログアウトのあとは札なし → 同じ窓の 'b' にも無い → 'a' は別の窓（端末の鍵なし）でも札がある。
     S9  ログインなしで追加の面に打つ（送らない）→「ログイン」→ login.html で手元のコード → 同じ都市へ戻る →
         Give → Get の板をその板の × で閉じる → 打った字と種類が戻っている・書きかけの印は 'a' →
         ログアウト → 'b' が login.html で入る → 同じ都市：追加の面は無く、書きかけも消えている。
     S10 承認された 'pilot' が「写真を追加」→「確認待ち」→ オーナーが公開 → 承認した2人目 'c' に写真が出る（'pay' は locked）。
         「Google マップ」の行き先（貼ったリンク／名前と都市の検索。辿らない）。同じ空港の他社のホテルは、その会社の名前の下に出る。
     S11 career.html?airline=etihad&stay=NRT で S1・S2 をもう一度（鍵の1行・入口・保存・自分の札・オーナーと承認された人）。

   ★本番にも 3000 番にも1回も通信しない（local-chain.mjs の bring・open。終われば保存先ごと消す）。
   ★見てよい人は手元の模擬（serve-local.mjs：'op' ＝ オーナー、'pilot' ＝ そのオーナーが承認した人）。本番の証拠にはならない。
     2人目の 'c' は、その会員としての本物の呼び出し pv_stay_viewer_request と、オーナー 'op' としての pv_stay_viewer_decide で作る
     （画面は申し込みの口を呼ばない。その行には必ずそう書く）。
   ★給与を出した人 'pay' は、その会員としての本物の呼び出し（submit_pay_report）で作る
     （手元の給与フォームから出せるかの下調べが無いため。その行には必ずそう書く）。

   実行: node assert-stays.mjs [--scenes chain,two,login,kept,career] [--only <会社>]（既定：全部の場面・jal。career は etihad の NRT）
*/
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEMBERS, OTP } from './serve-local.mjs';
import { LIBS, bring, open, rpcAs } from './local-chain.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? ' ' + e : ''))); };
const J = (v) => { try { return JSON.stringify(v).slice(0, 400); } catch { return String(v); } };

/* 画面の字（career-stay.js の T・SAY_ADD と同じ字。ここで字を固定する） */
const LOCK = 'ONLY VERIFIED PILOT', LOGIN = 'ログイン';
const MINE = 'あなたの投稿', PENDING = '確認待ち';
const ADDED = '追加しました。確認のあと公開されます。';
const OFF = '準備中', ERR = '読み込めませんでした', RETRY = 'もう一度';
const FAST = '続けて追加するときは、少し時間をあけてください。', EXISTS = '同じ名前が、もう登録されています。';
const ENTS = 'hotel ホテルを追加 ／ food レストランを追加 ／ spot 場所を追加';
const LOCKED = '{"ok":true,"state":"locked"}';
/* ★給与を出した人の作り方（下調べが無いあいだの手）。'pay' の結果の行には、どれにもこれを付ける */
const BYCALL = '（給与提出者は、その会員としての本物の呼び出し submit_pay_report で作った）';

/* ★見てよい2人目の作り方。'c' の承認の行には、どれにもこれを付ける */
const BYVIEW = "（見てよい2人目 'c' は、その会員としての本物の呼び出し pv_stay_viewer_request と、オーナー 'op' としての pv_stay_viewer_decide で作った）";
/* ★ログインの作り方（S8b・S9）。手元の login.html に、手元のコードを入れて通した */
const BYLOGIN = '（ログインは手元の login.html で、手元のコードを入れて通した）';
const MAP = 'Google マップ', OTHERS = '同じ空港で他社が使うホテル', PHOTO_DONE = '写真を追加しました。確認のあと公開されます。';

/* 検査が作る架空のホテルの名前（どれも2〜80字） */
const PUB = '検査用の公開ホテル（手元）';
const GUEST = '検査用のゲストのホテル（手元）';
const NEXT1 = '検査用の続けて送る1つめ（手元）', NEXT2 = '検査用の続けて送る2つめ（手元）';
const A_POST = '検査用の会員Aが足したホテル（手元）', HAND = '検査用の引き取られるホテル（手元）';
const DRAFT_NAME = '検査用の書きかけの店（手元）', DRAFT_NOTE = '検査用の書きかけのメモ（手元）';
const PUB_MAP = '検査用の地図のリンクつき公開ホテル（手元）', OTHER_HOTEL = '検査用の他社のホテル（手元）';
const MAPS_LINK = 'https://maps.app.goo.gl/PvLocalTest123';

const argv = process.argv.slice(2);
const val = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const SCENES = { chain, two, login, kept, career };
const want = (val('--scenes') || Object.keys(SCENES).join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const unknown = want.filter((s) => !SCENES[s]);
if (unknown.length) { console.error(`✗ 知らない場面: ${unknown.join(', ')}（あるのは ${Object.keys(SCENES).join(', ')}）`); process.exit(2); }
const SLUG = val('--only') || 'jal';
if (!/^[a-z0-9-]+$/.test(SLUG) || !fs.existsSync(path.join(ROOT, 'airlines', SLUG + '.html'))) {
  console.error(`✗ 会社のページが無い: airlines/${SLUG}.html`); process.exit(2);
}
/* その会社のページの、就航地の一覧の最初の都市（#stay-XXX で直接開く） */
const IATA = (read(`airlines/${SLUG}.html`).match(/href="#stay-([A-Z]{3})" data-city="\1"/) || [])[1];
if (!IATA) { console.error(`✗ airlines/${SLUG}.html に就航地の都市が無い`); process.exit(2); }

const M = Object.fromEntries(MEMBERS.map((m) => [m.key, m]));
const SLOT = '#pvg-city .crl[data-live="hotels"]';
const ZONE = `${SLOT} + .crs-zone`;
const FORM = `${ZONE} .crs-formbox > .crs-form`;

const tick = () => new Promise((r) => setTimeout(r, 100));
/* 条件がそろうまで待つ（時間では待たない。ms は上限） */
const until = async (cond, ms = 20000) => {
  const t0 = Date.now();
  for (;;) {
    if (await cond()) return true;
    if (Date.now() - t0 > ms) return false;
    await tick();
  }
};
/* 返事の字を、読めれば JSON にしてから書き直す（\u の書き方で名前を見落とさない） */
const norm = (t) => { try { return JSON.stringify(JSON.parse(t)); } catch { return String(t); } };

let browser = null;
const PAGES = [], BROUGHT = [];

/* 2つの面の家族：会社ページ（--only の会社・その最初の都市）と career.html（etihad の NRT）。
   back ＝ 欄の「ログイン」が login.html に渡す戻り先（career-stay.js の loginHref と同じ形） */
const JAL = { airline: SLUG, iata: IATA, path: `airlines/${SLUG}.html#stay-${IATA}`, back: `airlines/${SLUG}.html#stay-${IATA}`, slot: SLOT };
const CAREER = { airline: 'etihad', iata: 'NRT', path: 'career.html?airline=etihad&stay=NRT', back: 'career.html?airline=etihad&stay=NRT',
  slot: '.cr-view[data-view="stay"][data-airline="etihad"][data-stay="NRT"] .crl[data-live="hotels"]' };

/* ════ 場面 ════ */
async function scene(title, fn) {
  console.log(`\n════ ${title} ════`);
  await fn();
}

/* 使い捨ての保存先を1つ立て、その面の家族（W）に向けた道具をそろえる。場面ごとに1つ（終われば消す）。 */
async function kit(W) {
  const L = await bring();
  BROUGHT.push(L);
  if (!browser) browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
  const base = L.base, URL_ = `${base}/${W.path}`;
  const SL = W.slot, ZN = `${SL} + .crs-zone`, FM = `${ZN} .crs-formbox > .crs-form`;
  console.log(`\n手元の保存先 ${base}（使い捨て）・${W.airline} の ${W.iata}`);

  /* ── 道具 ─────────────────────────────────────────────── */
  const page = async (o) => { const p = await open(browser, base, { w: 1440, h: 820, ...o }); PAGES.push(p); return p; };
  const shut = async (p) => { try { await p.ctx.close(); } catch { /* 閉じられなくても先へ */ } };
  const n = (p, fn) => p.st.calls.filter((c) => c === fn).length;
  const replies = (p, fn, from = 0) => p.st.got.filter((g) => g.fn === fn).slice(from);
  /* 欄がその都市で、待ちの絵でない状態になり、欄の外の面（入口）が在る。読み出しの返事が全部届いている。 */
  const settled = async (p, ms = 20000) => {
    const a = await p.page.waitForFunction((sel, code) => {
      const e = document.querySelector(sel);
      return !!e && e.getClientRects().length > 0 && e.getAttribute('data-stay') === code
        && !/^(idle|loading)$/.test(e.dataset.state || '')
        && !!(e.nextElementSibling && e.nextElementSibling.classList.contains('crs-zone'));
    }, { timeout: ms }, SL, W.iata).then(() => true, () => false);
    const b = await until(() => n(p, 'pv_stays') === replies(p, 'pv_stays').length, ms);
    return a && b;
  };
  const visit = async (p) => { await p.page.goto(URL_, { waitUntil: 'load', timeout: 60000 }); return settled(p); };
  const look = (p) => p.page.evaluate((sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const z = e.nextElementSibling && e.nextElementSibling.classList.contains('crs-zone') ? e.nextElementSibling : null;
    const vis = (x) => !!x && x.getClientRects().length > 0, tx = (x) => x ? x.textContent.replace(/\s+/g, ' ').trim() : '';
    const f = z && z.querySelector('.crs-formbox > .crs-form');
    return {
      state: e.dataset.state, who: e.getAttribute('data-who'), text: tx(e),
      entry: [...e.querySelectorAll('a[data-crs-entry]')].map(tx),
      retry: [...e.querySelectorAll('[data-act="retry"]')].map(tx),
      names: [...e.querySelectorAll('.crs-name')].map(tx),
      ents: z ? [...z.querySelectorAll('.crs-ent')].filter(vis).map((b) => `${b.getAttribute('data-kind')} ${tx(b)}`).join(' ／ ') : '',
      say: z ? tx(z.querySelector('.crs-zone-say')) : '',
      own: z ? [...z.querySelectorAll('.crs-own > .crs-card')].map((c) => ({ name: tx(c.querySelector('.crs-name')),
        badges: [...c.querySelectorAll('.crs-top .crs-badge')].map(tx) })) : [],
      form: !!f, fsay: f ? tx(f.querySelector('.crs-form-say')) : '',
      fname: f ? ((f.querySelector('[data-k="name"]') || {}).value || '') : '',
    };
  }, SL);
  /* その名前が、返事（手元の口の返事すべて）・画面（HTML 全体）・保存領域（local と session）のどこに在るか */
  const whereIs = async (p, names) => {
    const dom = await p.page.evaluate(() => document.documentElement.outerHTML);
    const store = await p.page.evaluate(() => {
      const o = {};
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o['l:' + k] = localStorage.getItem(k); } } catch { /* 読めない */ }
      try { for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); o['s:' + k] = sessionStorage.getItem(k); } } catch { /* 読めない */ }
      return JSON.stringify(o);
    });
    const bodies = p.st.got.map((g) => norm(g.text)).join('\n');
    const out = [];
    for (const nm of names) {
      if (bodies.includes(nm)) out.push(`返事に「${nm}」`);
      if (dom.includes(nm)) out.push(`画面に「${nm}」`);
      if (store.includes(nm)) out.push(`保存領域に「${nm}」`);
    }
    return out;
  };
  const storeHas = async (p, names) => (await whereIs(p, names)).filter((s) => s.startsWith('保存領域'));
  /* 欄の外の入口を押して、名前だけ打って、送る（1回押す）。返事が届き、面が答えを出すまで待つ。 */
  const addVia = async (p, name) => {
    const before = replies(p, 'pv_stay_add').length;
    const saidBefore = (await look(p)).say;
    await p.page.click(`${ZN} .crs-ent[data-kind="hotel"]`);
    await p.page.waitForSelector(`${FM} [data-k="name"]`, { visible: true });
    await p.page.focus(`${FM} [data-k="name"]`);
    await p.page.keyboard.type(name);
    await p.page.click(`${FM} button[type="submit"]`);
    await until(() => replies(p, 'pv_stay_add').length > before);
    await p.page.waitForFunction((zone, form, was) => {
      const z = document.querySelector(zone), f = document.querySelector(form);
      const zs = z && z.querySelector('.crs-zone-say'), fs = f && f.querySelector('.crs-form-say');
      const zt = zs ? zs.textContent.trim() : '', ft = fs ? fs.textContent.trim() : '';
      return (!f && zt !== '' && zt !== was) || (!!f && ft !== '' && ft !== '送信中…');
    }, { timeout: 20000 }, ZN, FM, saidBefore).catch(() => {});
    await settled(p);
    const reply = replies(p, 'pv_stay_add').slice(before);
    let body = null;
    try { body = JSON.parse(reply[0].text); } catch { body = null; }
    return { reply: body, sent: p.st.sent.filter((s) => s.fn === 'pv_stay_add').slice(before), v: await look(p) };
  };
  const stays = (who) => rpcAs(base, who, 'pv_stays', { airline: W.airline, iata: W.iata });
  const namesOf = (r) => (r.body && Array.isArray(r.body.places) ? r.body.places.map((x) => x.name) : []);
  const queue = async (who) => { const r = await rpcAs(base, who, 'pv_stay_queue', {}); return r.body && r.body.ok === true ? r.body.places : null; };
  const rowsOf = async (name) => (await L.q(
    `select id::text as id, state, author_hash from public.pv_stay_places where airline = $1 and iata = $2 and name = $3 order by created_at, id`,
    [W.airline, W.iata, name])).rows;
  /* 返事が locked の1行そのものか。読んで書き直した字が LOCKED と同じで、返事の字そのものに現れる鍵の名前も ok と state だけ。 */
  const isLockedBytes = (r) => !!r && r.status === 200 && norm(r.text) === LOCKED
    && [...String(r.text).matchAll(/"((?:[^"\\]|\\.)*)"\s*:/g)].map((m) => m[1]).join() === 'ok,state';

  /* 同じ窓の2枚目のタブ（保存領域を分け合う）。門は local-chain.mjs と同じ決まり（あちらの門は外に出していない）。 */
  const origin = new URL(base).origin;
  const tab = async (p) => {
    const t = await p.ctx.newPage();
    const st = { calls: [], sent: [], got: [], blocked: new Set(), supa: new Set(), errs: [] };
    t.setDefaultTimeout(20000);
    await t.setViewport({ width: 1440, height: 820, deviceScaleFactor: 1 });
    await t.setRequestInterception(true);
    t.on('request', (req) => {
      let u;
      try { u = new URL(req.url()); } catch { return req.continue(); }
      if (u.protocol === 'data:' || u.protocol === 'blob:' || u.protocol === 'about:') return req.continue();
      if (u.origin === origin) { const m = u.pathname.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/); if (m) st.calls.push(m[1]); return req.continue(); }
      if (LIBS.test(u.hostname)) return req.continue();
      if (/supabase\.(co|in|com)$/.test(u.hostname)) st.supa.add(`${req.method()} ${u.hostname}${u.pathname}`);
      else st.blocked.add(`${req.method()} ${u.hostname}`);
      return req.abort();
    });
    t.on('pageerror', (e) => st.errs.push(String(e.message).slice(0, 160)));
    const q = { ctx: p.ctx, page: t, st };
    PAGES.push(q);
    return q;
  };
  /* サイトのログアウト（profile.html の「ログアウト」。確かめの問いには「はい」）。押した画面は index.html へ移る。
     ログインの鍵と pv_user が消えたかを返す。 */
  const logoutVia = async (p) => {
    await p.page.goto(`${base}/profile.html`, { waitUntil: 'load', timeout: 60000 });
    await p.page.waitForSelector('.btn-logout', { visible: true });
    const yes = (d) => { d.accept().catch(() => {}); };
    p.page.on('dialog', yes);
    await Promise.all([p.page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), p.page.click('.btn-logout')]);
    p.page.off('dialog', yes);
    return p.page.evaluate(() => !localStorage.getItem('sb-local-auth-token') && !localStorage.getItem('pv_user'));
  };
  /* login.html で、その会員のメールに手元のコードを入れて入る（login.html に居なければ、戻り先つきで開く）。着いた住所を返す。 */
  const loginVia = async (p, who) => {
    if (!/\/login\.html(\?|$)/.test(p.page.url())) {
      await p.page.goto(`${base}/login.html?redirect=${encodeURIComponent(W.back)}`, { waitUntil: 'load', timeout: 60000 });
    }
    await p.page.click('button[onclick="showEmailStep()"]');
    await p.page.waitForSelector('#otp-email', { visible: true });
    await p.page.type('#otp-email', M[who].email);
    await p.page.click('#otp-send-btn');
    await p.page.waitForSelector('#otp-code', { visible: true });
    await Promise.all([p.page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), p.page.type('#otp-code', OTP)]);
    return p.page.url();
  };
  /* Give → Get の板（pv-give-first.js）が出たら、その板の × で閉じる。'closed' ／ 出なかった 'none' */
  const closeBoard = async (p) => {
    const shown = await p.page.waitForSelector('.pvgf-x', { visible: true, timeout: 10000 }).then(() => true, () => false);
    if (!shown) return 'none';
    await p.page.click('.pvgf-x');
    const gone = await p.page.waitForFunction(() => { const x = document.querySelector('.pvgf-x'); return !x || x.getClientRects().length === 0; },
      { timeout: 10000 }).then(() => true, () => false);
    return gone ? 'closed' : 'stuck';
  };
  /* その名前が、画面・保存領域と、from 番目より後の返事のどこに在るか（前の人のときの返事は数えない） */
  const seenSince = async (p, names, from) => {
    const out = (await whereIs(p, names)).filter((s) => !s.startsWith('返事'));
    const later = p.st.got.slice(from).map((g) => norm(g.text)).join('\n');
    for (const nm of names) if (later.includes(nm)) out.push(`返事に「${nm}」`);
    return out;
  };
  /* 欄の中の、その名前のカードの写真（読み込みの印・札・画素の幅） */
  const photoOf = (p, name) => p.page.evaluate((sel, nm) => {
    const e = document.querySelector(sel);
    const c = e ? [...e.querySelectorAll('.crs-card')].find((x) => (x.querySelector('.crs-name') || {}).textContent === nm) : null;
    const bs = c ? [...c.querySelectorAll('.crs-photos .crs-ph')] : [];
    return { n: bs.length, states: bs.map((b) => b.getAttribute('data-ph')),
      badges: bs.flatMap((b) => [...b.querySelectorAll('.crs-ph-b')].map((x) => x.textContent.trim())),
      w: bs.map((b) => { const im = b.querySelector('img'); return im ? im.naturalWidth : 0; }) };
  }, SL, name);
  /* その都市の書きかけ（このタブの sessionStorage）。無ければ null */
  const DK = `pv_stay_draft:${W.airline}|${W.iata}`;
  const draftOf = async (p) => p.page.evaluate((k) => { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch { return null; } }, DK);

  return { L, base, URL_, SL, ZN, FM, DK, page, shut, n, replies, settled, visit, look, whereIs, storeHas, addVia, stays, namesOf,
    queue, rowsOf, isLockedBytes, tab, logoutVia, loginVia, closeBoard, seenSince, photoOf, draftOf };
}

/* 給与提出者 'pay' ── その会員としての本物の呼び出しで、給与の鍵を生きている状態にする */
async function payKey(K) {
  const YEAR = (await K.L.q(`select extract(year from current_date)::int as y`)).rows[0].y - 1;
  const FLEET = JSON.parse(read('pv-vocab.json')).fleets.find((x) => !x.retired).code;
  const filed = await rpcAs(K.base, 'pay', 'submit_pay_report', { currency: 'USD', lang: 'en', tax_rate_pct: 0, fleet: FLEET,
    position: 'cap', airline: SLUG, period_year: YEAR, period_month: 3, gross_monthly: 9000 });
  const live = (await K.L.q(`select access_until > now() as live from public.profiles where id = $1`, [M.pay.id])).rows[0];
  ok(filed.body && filed.body.ok === true && live && live.live === true,
    `準備：給与提出者 'pay' の給与の鍵（access_until）は生きている${BYCALL}`, J({ reply: filed.body, live }));
  if (!(live && live.live === true)) throw new Error('前提が崩れた（給与の鍵が生きていない）');
}

/* オーナーが見てよい2人目を決める（申し込んだ人だけ）。まず申し込みの行が無いまま承認させて、not_found で断られることを見る。
   それから、その会員が本物の口で申し込み（画面はこの口を呼ばない）、オーナーが本物の口で承認する。開いた返事を返す。 */
async function approve(K, who, tag) {
  const id = M[who].id;
  const d0 = await rpcAs(K.base, 'op', 'pv_stay_viewer_decide', { id, state: 'approved' });
  const n0 = (await K.L.q(`select count(*)::int as n from public.pv_stay_viewers where user_id = $1`, [id])).rows[0].n;
  const r0 = await K.stays(who);
  ok(d0.body && d0.body.ok === false && d0.body.status === 'not_found' && n0 === 0 && K.isLockedBytes(r0),
    `★${tag} 申し込みの行が無い会員 '${who}' をオーナー 'op' が承認しようとすると not_found（名簿に何も書かない）・'${who}' への返事は ${LOCKED} のまま`,
    J({ decide: d0.body, rows: n0, r0: r0.text }));
  const rq = await rpcAs(K.base, who, 'pv_stay_viewer_request', { ask: true });
  const r1 = await K.stays(who);
  const d1 = await rpcAs(K.base, 'op', 'pv_stay_viewer_decide', { id, state: 'approved' });
  const row = (await K.L.q(`select state, decided_by::text as by from public.pv_stay_viewers where user_id = $1`, [id])).rows[0];
  const r2 = await K.stays(who);
  ok(rq.body && rq.body.ok === true && rq.body.state === 'pending' && K.isLockedBytes(r1)
    && d1.body && d1.body.ok === true && d1.body.state === 'approved' && row && row.state === 'approved' && row.by === M.op.id
    && r2.body && r2.body.ok === true && r2.body.state === 'open',
    `準備：'${who}' が申し込み（申し込んだだけでは ${LOCKED} のまま）、オーナー 'op' が承認した（決めた人は 'op'）── そこから一覧が開く${BYVIEW}`,
    J({ request: rq.body, r1: r1.text, decide: d1.body, row, r2: r2.body && r2.body.state }));
  return r2;
}

async function chain() {
  const K = await kit(JAL);
  const { L, base, page, shut, n, replies, settled, visit, look, whereIs, storeHas, addVia, stays, namesOf, queue, rowsOf, isLockedBytes } = K;

  /* ── S1 ─────────────────────────────────────────────── */
  let guest1 = null, guestKey = '';
  await scene('S1 ログインしていない人は、ホテルが在っても locked の1行だけ', async () => {
    const put = await rpcAs(base, 'op', 'pv_stay_add', { airline: SLUG, iata: IATA, kind: 'hotel', name: PUB, publish: true });
    const rows = await rowsOf(PUB);
    ok(put.body && put.body.ok === true && rows.length === 1 && rows[0].state === 'public',
      `準備：運営（オーナー 'op'）が ${SLUG} の ${IATA} に、公開のホテルを1つ置いた（pv_stay_add・publish:true）`, J({ reply: put.body, rows }));
    const g = await page({});
    const ready = await visit(g);
    const v = await look(g);
    const rs = replies(g, 'pv_stays');
    ok(ready && rs.length >= 1 && rs.every(isLockedBytes),
      `★S1 ログインしていない人への pv_stays の返事は、読んで書き直すと ${LOCKED} そのもの（ほかの鍵は1つも無い）`, J(rs.map((r) => r.text)));
    ok(v.state === 'locked' && v.who === 'login' && v.text === LOCK + LOGIN && J(v.entry) === J([LOGIN]) && v.names.length === 0,
      `★S1 欄は鍵の1行「${LOCK}」と「${LOGIN}」だけ`, J(v));
    const seen = await whereIs(g, [PUB]);
    ok(seen.length === 0, `★S1 公開のホテルの名前は、どの返事にも・画面にも・保存領域にも無い`, J(seen));
    guest1 = g;
  });

  /* ── S2・S2c ─────────────────────────────────────────── */
  let opQ0 = 0, cQ0 = 0;
  await scene('S2 ログインせずに「ホテルを追加」→ 名前 → 送る（S2c：オーナーではない運営も、ここで数える）', async () => {
    /* 給与を出した人 ── その会員としての本物の呼び出しで、給与の鍵を生きている状態にする */
    await payKey(K);
    /* オーナーではない運営 ── この使い捨ての保存先の中だけで、会員 'c' を運営の名簿に入れる */
    await L.q(`insert into public.pv_admins (user_id, note) values ($1, '検査：オーナーではない運営（使い捨ての保存先だけ）') on conflict (user_id) do nothing`, [M.c.id]);
    const opBefore = await queue('op'), cBefore = await queue('c');
    ok(Array.isArray(opBefore) && Array.isArray(cBefore), `準備：運営の待ち行列（pv_stay_queue）を、オーナー 'op' と運営 'c' の両方で読めた`, J({ opBefore, cBefore }));
    opQ0 = (opBefore || []).length; cQ0 = (cBefore || []).length;

    const g = guest1;
    const { reply, sent, v } = await addVia(g, GUEST);
    const key = (await g.page.evaluate(() => { try { return localStorage.getItem('pv_stay_key'); } catch { return null; } })) || '';
    ok(sent.length === 1 && sent[0].p && sent[0].p.name === GUEST && sent[0].p.airline === SLUG && sent[0].p.iata === IATA && !('key' in sent[0].p),
      `★S2 「ホテルを追加」→ 名前 →「追加する」の1回で、pv_stay_add が1本だけ・名前と会社と空港を持って出た（ログインなし・申し込みなし）`, J(sent));
    ok(reply && reply.ok === true && /^[0-9a-f]{48}$/.test(reply.key || '') && reply.key === key && reply.item && reply.item.state === 'pending',
      `★S2 返事に端末の鍵が入っていて、この端末だけに置かれた（pv_stay_key）。足した1件は確認待ち`, J({ reply, key }));
    guestKey = key;
    const rows = (await L.q(
      `select s.state, s.author_hash = public.pv_stay_key_hash($4) as by_key,
              exists (select 1 from public.pv_stay_keys k where k.key_hash = s.author_hash) as key_row
         from public.pv_stay_places s where s.airline = $1 and s.iata = $2 and s.name = $3`, [SLUG, IATA, GUEST, key])).rows;
    ok(rows.length === 1 && rows[0].state === 'pending' && rows[0].by_key === true && rows[0].key_row === true,
      `★S2 ログインなしで保存された：保存先に1行・確認待ち・書いた人の印はその端末の鍵`, J(rows));
    ok(v.say === ADDED && J(v.own) === J([{ name: GUEST, badges: [MINE, PENDING] }]),
      `★S2 欄の外に「${ADDED}」と、送ったホテルが「${MINE}」「${PENDING}」の札で出る`, J({ say: v.say, own: v.own }));
    ok(v.state === 'locked' && v.text === LOCK + LOGIN && v.names.length === 0,
      `★S2 欄の中は鍵の1行と「${LOGIN}」のまま（鍵の1行の横に「${PENDING}」は無い）`, J({ state: v.state, text: v.text, names: v.names }));

    const opAfter = await queue('op'), cAfter = await queue('c');
    const hasG = (qq) => Array.isArray(qq) && qq.some((x) => x.name === GUEST && x.state === 'pending' && x.airline === SLUG && x.iata === IATA);
    ok(Array.isArray(opAfter) && opAfter.length === opQ0 + 1 && hasG(opAfter),
      `★S2 運営の数：オーナー 'op' の待ち行列（pv_stay_queue）は、ちょうど1つ増えた（${opQ0} → ${(opAfter || []).length}）。増えた1つは送ったホテル`, J((opAfter || []).map((x) => x.name)));
    ok(Array.isArray(cAfter) && cAfter.length === cQ0 + 1 && hasG(cAfter),
      `★S2c オーナーではない運営 'c' の待ち行列も、送ったホテルの1つだけ増えた（${cQ0} → ${(cAfter || []).length}）`, J((cAfter || []).map((x) => x.name)));
    const rc = await stays('c');
    ok(isLockedBytes(rc), `★S2c オーナーではない運営 'c' への pv_stays の返事は ${LOCKED} そのもの（運営であることだけでは開かない）`, rc.text);

    const ra = await stays('a');
    ok(isLockedBytes(ra), `★S2 会員 'a'（端末の鍵なし）への返事は ${LOCKED} そのもの`, ra.text);
    const rp = await stays('pay');
    ok(isLockedBytes(rp), `★S2 給与提出者 'pay' への返事も ${LOCKED} そのもの（給与の鍵は何も開かない）${BYCALL}`, rp.text);
    const pp = await page({ who: 'pay' });
    const pr = await visit(pp);
    const pv = await look(pp);
    const pseen = await whereIs(pp, [PUB, GUEST]);
    ok(pr && pv.state === 'locked' && pv.who === 'member' && pv.text === LOCK && pv.entry.length === 0 && pseen.length === 0
      && replies(pp, 'pv_stays').length >= 1 && replies(pp, 'pv_stays').every(isLockedBytes),
      `★S2 給与提出者 'pay' の画面は、鍵の1行「${LOCK}」だけ（入口なし・どの名前も返事・画面・保存領域に無い）${BYCALL}`, J({ pv, pseen }));
    await shut(pp);
    const rv = await stays('pilot');
    ok(rv.body && rv.body.state === 'open' && namesOf(rv).includes(PUB) && !norm(rv.text).includes(GUEST),
      `★S2 承認された人 'pilot' には一覧が開く（公開のホテルは在る）が、確認前の他人のホテルは返らない`, J(namesOf(rv)));
    const ro = await stays('op');
    const og = ro.body && Array.isArray(ro.body.places) ? ro.body.places.find((x) => x.name === GUEST) : null;
    ok(ro.body && ro.body.state === 'open' && namesOf(ro).includes(PUB) && !!og && og.state === 'pending',
      `S2 オーナー 'op' の一覧には、確認待ちの他人のホテルも在る`, J(namesOf(ro)));
  });

  /* ── S2b ─────────────────────────────────────────────── */
  await scene('S2b ほかのログインなしの人が、公開済みと同じ名前を送る', async () => {
    const g2 = await page({});
    const ready = await visit(g2);
    const { reply, v } = await addVia(g2, PUB);
    ok(ready && reply && reply.ok === true && reply.item && reply.item.state === 'pending' && !JSON.stringify(reply).includes('exists'),
      `★S2b 公開済みのホテルと同じ名前でも、ログインなしの人の1件は保存される（返事に exists は無い）`, J(reply));
    ok(v.say === ADDED && v.say !== EXISTS && J(v.own) === J([{ name: PUB, badges: [MINE, PENDING] }]) && v.fsay === '',
      `★S2b 面は「${ADDED}」と「${PENDING}」の札だけ ── 同じ名前が在ることは言わない`, J({ say: v.say, own: v.own, fsay: v.fsay }));
    const qq = await queue('op');
    const row = Array.isArray(qq) ? qq.find((x) => x.name === PUB && x.state === 'pending') : null;
    const m = row ? await rpcAs(base, 'op', 'pv_stay_moderate', { target: 'place', id: row.id, state: 'public', rev: row.rev }) : null;
    const rows = await rowsOf(PUB);
    ok(!!row && m && m.body && m.body.ok === false && m.body.status === 'exists'
      && rows.filter((r) => r.state === 'public').length === 1 && rows.filter((r) => r.state === 'pending').length === 1,
      `S2b 運営がその1件を通そうとすると exists（公開の行に同じ名前を2つ作らない）`, J({ m: m && m.body, rows: rows.map((r) => r.state) }));
    await shut(g2);
  });

  /* ── S3 ─────────────────────────────────────────────── */
  await scene('S3 運営が通す → 承認された人に届く・ほかの人は locked のまま', async () => {
    const qq = await queue('op');
    const row = Array.isArray(qq) ? qq.find((x) => x.name === GUEST && x.state === 'pending') : null;
    const m = row ? await rpcAs(base, 'op', 'pv_stay_moderate', { target: 'place', id: row.id, state: 'public', rev: row.rev }) : null;
    ok(!!row && m && m.body && m.body.ok === true && m.body.state === 'public',
      `準備：運営（オーナー 'op'）が、待ち行列の版の印（rev）を添えて、ゲストのホテルを公開した`, J(m && m.body));
    const rv = await stays('pilot');
    ok(rv.body && rv.body.state === 'open' && namesOf(rv).includes(GUEST),
      `★S3 承認された人 'pilot' の返事に、公開したゲストのホテルが入った`, J(namesOf(rv)));
    const vp = await page({ who: 'pilot' });
    const vr = await visit(vp);
    const vv = await look(vp);
    ok(vr && vv.state === 'open' && vv.names.includes(GUEST) && vv.names.includes(PUB),
      `★S3 承認された人 'pilot' の画面の一覧に、ゲストのホテルと公開のホテルが出る`, J({ state: vv.state, names: vv.names }));
    await shut(vp);
    const ra = await stays('a'), rp = await stays('pay'), rg = await stays(null);
    ok(isLockedBytes(ra), `★S3 会員 'a' への返事は、公開のあとも ${LOCKED} そのもの`, ra.text);
    ok(isLockedBytes(rp), `★S3 給与提出者 'pay' への返事も、公開のあとも ${LOCKED} そのもの${BYCALL}`, rp.text);
    ok(isLockedBytes(rg), `★S3 ほかのログインなしの人（端末の鍵なし）への返事も ${LOCKED} そのもの`, rg.text);
    await guest1.page.reload({ waitUntil: 'load', timeout: 60000 });
    const gr = await settled(guest1);
    const gv = await look(guest1);
    ok(gr && gv.state === 'locked' && gv.text === LOCK + LOGIN && J(gv.own) === J([{ name: GUEST, badges: [MINE] }]),
      `★S3 送った人の画面を読み直すと、自分のホテルの札から「${PENDING}」が消える（「${MINE}」は残る。欄の中は鍵の1行のまま）`, J({ state: gv.state, own: gv.own }));
    await shut(guest1);
  });

  /* ── S4 ─────────────────────────────────────────────── */
  await scene('S4 給与の鍵は期限に関係なく何も開かない／承認を取り消されたら、読み直した時から locked', async () => {
    const until0 = (await L.q(`select access_until from public.profiles where id = $1`, [M.pay.id])).rows[0].access_until;
    await L.q(`update public.profiles set access_until = now() - interval '1 day' where id = $1`, [M.pay.id]);
    const ra = await stays('a'), rx = await stays('pay');
    const pp = await page({ who: 'pay' });
    const pr = await visit(pp);
    const pv = await look(pp);
    ok(pr && isLockedBytes(rx) && norm(rx.text) === norm(ra.text) && pv.state === 'locked' && pv.who === 'member' && pv.text === LOCK
      && (await whereIs(pp, [PUB, GUEST])).length === 0,
      `★S4 給与の鍵の期限が切れた 'pay'：返事は会員 'a' と同じ ${LOCKED}・画面は鍵の1行だけ${BYCALL}`, J({ rx: rx.text, pv }));
    await shut(pp);
    await L.q(`update public.profiles set access_until = $2 where id = $1`, [M.pay.id, until0]);
    const ry = await stays('pay');
    const live = (await L.q(`select access_until > now() as live from public.profiles where id = $1`, [M.pay.id])).rows[0];
    ok(live.live === true && isLockedBytes(ry), `★S4 給与の鍵を生きている状態に戻しても、'pay' への返事は ${LOCKED} のまま${BYCALL}`, ry.text);

    const vp = await page({ who: 'pilot' });
    const vr = await visit(vp);
    const v1 = await look(vp);
    const held = await storeHas(vp, [PUB, GUEST]);
    ok(vr && v1.state === 'open' && v1.names.includes(PUB) && held.length === 0,
      `★S4 承認された人 'pilot' の一覧が開いているあいだ、保存領域にホテルの名前は1つも無い`, J({ state: v1.state, names: v1.names, held }));
    const dv = await rpcAs(base, 'op', 'pv_stay_viewer_decide', { id: M.pilot.id, state: 'revoked' });
    ok(dv.body && dv.body.ok === true && dv.body.state === 'revoked',
      `準備：オーナー 'op' が、本物の口（pv_stay_viewer_decide）で 'pilot' の承認を取り消した`, J(dv.body));
    const from = replies(vp, 'pv_stays').length;
    await vp.page.reload({ waitUntil: 'load', timeout: 60000 });
    const r2 = await settled(vp);
    const v2 = await look(vp);
    const after = replies(vp, 'pv_stays', from);
    const seen2 = await whereIs(vp, [PUB, GUEST]);
    ok(r2 && after.length >= 1 && after.every(isLockedBytes) && v2.state === 'locked' && v2.who === 'member' && v2.text === LOCK
      && seen2.filter((s) => !s.startsWith('返事')).length === 0,
      `★S4 承認を取り消された 'pilot' が読み直すと、返事は ${LOCKED} そのもの・画面は鍵の1行だけ（名前は画面にも保存領域にも無い）`,
      J({ after: after.map((r) => r.text), v2, seen2 }));
    await shut(vp);
    const ba = await rpcAs(base, 'op', 'pv_stay_viewer_decide', { id: M.pilot.id, state: 'approved' });
    const rb = await stays('pilot');
    ok(ba.body && ba.body.ok === true && rb.body && rb.body.state === 'open' && namesOf(rb).includes(PUB),
      `S4 オーナー 'op' が同じ口で承認し直すと、'pilot' の一覧はまた開く`, J({ decide: ba.body, names: namesOf(rb) }));
  });

  /* ── S6 ─────────────────────────────────────────────── */
  await scene('S6 読めなかった →「読み込めませんでした」＋「もう一度」→ やり直せる', async () => {
    const g = await page({});
    /* 押すまでの読み出しは全部失敗させる（読み出しが2本あっても、2本目で黙って直らない）。押す前に戻す。 */
    await L.failNext('pv_stays', null, 99);
    const ready = await visit(g);
    const v1 = await look(g);
    await L.failOff();
    const n0 = n(g, 'pv_stays');
    ok(ready && v1.state === 'error' && v1.text === ERR + RETRY && J(v1.retry) === J([RETRY]) && n0 >= 1,
      `S6 一覧の読み出しが失敗した回は「${ERR}」と「${RETRY}」`, J({ v1, calls: n0 }));
    await g.page.click(`${SLOT} [data-act="retry"]`);
    const again = await g.page.waitForFunction((sel) => { const e = document.querySelector(sel); return !!e && e.dataset.state === 'locked'; },
      { timeout: 20000 }, SLOT).then(() => true, () => false);
    const okd = again && (await settled(g));
    const v2 = await look(g);
    ok(okd && v2.text === LOCK + LOGIN && n(g, 'pv_stays') > n0 && isLockedBytes(replies(g, 'pv_stays').at(-1)),
      `S6 「${RETRY}」を押すと読み直し、サーバーの答えのとおり鍵の1行になる`, J({ v2, calls: n(g, 'pv_stays') }));
    await shut(g);
  });

  /* ── S7 ─────────────────────────────────────────────── */
  await scene('S7 30秒以内の2つめ', async () => {
    const g = await page({});
    const ready = await visit(g);
    const a1 = await addVia(g, NEXT1);
    ok(ready && a1.reply && a1.reply.ok === true && a1.v.say === ADDED, `準備：ログインなしで1つ足した（「${ADDED}」）`, J({ reply: a1.reply, say: a1.v.say }));
    const a2 = await addVia(g, NEXT2);
    ok(a2.reply && a2.reply.ok === false && a2.reply.status === 'too_fast' && a2.v.form === true && a2.v.fsay === FAST && a2.v.fname === NEXT2,
      `S7 30秒以内の2つめは「${FAST}」と言い、打った名前は面に残る`, J({ reply: a2.reply, form: a2.v.form, fsay: a2.v.fsay, fname: a2.v.fname }));
    ok((await rowsOf(NEXT2)).length === 0 && n(g, 'pv_stay_add') === 2, `S7 2つめは保存されていない（送ったのは2本）`, J({ rows: await rowsOf(NEXT2), sent: n(g, 'pv_stay_add') }));
    await shut(g);
  });

  /* ── S5（関数を消すので、最後に流す）────────────────────── */
  await scene('S5 つながっていない（pv_stays と pv_stay_add が無い）', async () => {
    await L.q(`drop function if exists public.pv_stays(jsonb)`);
    await L.q(`drop function if exists public.pv_stay_add(jsonb)`);
    const g = await page({});
    const ready = await visit(g);
    const v1 = await look(g);
    ok(ready && v1.state === 'off' && v1.text === OFF && v1.retry.length === 0 && v1.ents === ENTS,
      `S5 欄は「${OFF}」だけ（やり直しの言葉なし）・欄の外に入口が3つ`, J(v1));
    await g.page.click(`${ZONE} .crs-ent[data-kind="hotel"]`);
    const said = await g.page.waitForFunction((zone, t) => { const z = document.querySelector(zone), s = z && z.querySelector('.crs-zone-say'); return !!s && s.textContent.trim() === t; },
      { timeout: 10000 }, ZONE, OFF).then(() => true, () => false);
    const v2 = await look(g);
    ok(said && v2.say === OFF && v2.form === false && n(g, 'pv_stay_add') === 0,
      `S5 入口を押すと「${OFF}」と言うだけ ── 追加の面は開かない（送らない）`, J({ say: v2.say, form: v2.form }));
    await shut(g);
  });
}

/* ════ 場面 two（S8・S8b）════════════════════════════════════ */
async function two() {
  const K = await kit(JAL);
  const { L, base, SL, page, shut, replies, settled, visit, look, whereIs, storeHas, addVia, stays, namesOf, isLockedBytes,
    tab, logoutVia, loginVia, closeBoard, seenSince } = K;
  const put = await rpcAs(base, 'op', 'pv_stay_add', { airline: SLUG, iata: IATA, kind: 'hotel', name: PUB, publish: true });
  ok(put.body && put.body.ok === true && put.body.item && put.body.item.state === 'public',
    `準備：オーナー 'op' が ${SLUG} の ${IATA} に、公開のホテルを1つ置いた（pv_stay_add・publish:true）`, J(put.body));
  await payKey(K);

  /* ── S8 ─────────────────────────────────────────────── */
  await scene('S8 2人の会員：ログインしたまま足す → ログアウト → 別の会員 → また入る／見てよい2人目と、ほかのタブのログアウト', async () => {
    const pa = await page({ who: 'a' });
    const ra = await visit(pa);
    const { reply, sent, v } = await addVia(pa, A_POST);
    const key = await pa.page.evaluate(() => { try { return localStorage.getItem('pv_stay_key'); } catch { return 'unreadable'; } });
    const rows = (await L.q(
      `select state, author_hash = public.pv_stay_hash($4::uuid) as by_login from public.pv_stay_places where airline = $1 and iata = $2 and name = $3`,
      [SLUG, IATA, A_POST, M.a.id])).rows;
    ok(ra && sent.length === 1 && reply && reply.ok === true && !('key' in reply) && key === null
      && rows.length === 1 && rows[0].state === 'pending' && rows[0].by_login === true
      && v.state === 'locked' && v.who === 'member' && v.text === LOCK && J(v.own) === J([{ name: A_POST, badges: [MINE, PENDING] }]),
      `★S8 会員 'a' がログインしたまま足す：pv_stay_add が1本・端末の鍵は返らず置かれない・保存先の1行は確認待ちで 'a' のログインの印・欄の外に「${MINE}」「${PENDING}」の札（欄の中は鍵の1行だけ）`,
      J({ reply, key, rows, v }));
    const out = await logoutVia(pa);
    const from = pa.st.got.length;
    const back = await visit(pa);
    const v2 = await look(pa);
    const after = pa.st.got.slice(from).filter((g) => g.fn === 'pv_stays');
    const seen = await seenSince(pa, [A_POST], from);
    ok(out && back && after.length >= 1 && after.every(isLockedBytes) && v2.own.length === 0
      && v2.state === 'locked' && v2.who === 'login' && v2.text === LOCK + LOGIN && seen.length === 0,
      `★S8 サイトのログアウト（profile.html の「ログアウト」）のあと同じ都市を開くと：返事は ${LOCKED} そのもの・欄の外に札は無い・'a' のホテルの名前は返事にも画面にも保存領域にも無い`,
      J({ out, after: after.map((g) => g.text), v2, seen }));
    const pb = await page({ who: 'b' });
    const rb = await visit(pb);
    const vb = await look(pb);
    const sb = await whereIs(pb, [A_POST]);
    ok(rb && vb.own.length === 0 && vb.state === 'locked' && vb.who === 'member' && sb.length === 0
      && replies(pb, 'pv_stays').length >= 1 && replies(pb, 'pv_stays').every(isLockedBytes),
      `★S8 別の窓で会員 'b' が入る：'b' への返事は ${LOCKED} そのもの・札は無い・'a' のホテルの名前は返事にも画面にも保存領域にも無い`,
      J({ vb, sb }));
    const pa2 = await page({ who: 'a' });
    const ra2 = await visit(pa2);
    const va2 = await look(pa2);
    ok(ra2 && va2.state === 'locked' && va2.text === LOCK && J(va2.own) === J([{ name: A_POST, badges: [MINE, PENDING] }]),
      `★S8 会員 'a' がまた入る（別の窓・端末の鍵なし）：札が戻る（ログインの印で読む）`, J(va2.own));
    await shut(pa); await shut(pb); await shut(pa2);

    /* 見てよい2人目（オーナーが承認した 'c'）の開いた一覧と、ほかのタブでのログアウト */
    const rc = await approve(K, 'c', 'S8');
    ok(namesOf(rc).includes(PUB) && !norm(rc.text).includes(A_POST),
      `S8 承認された 'c' への返事は一覧が開く（公開のホテルは在る・'a' の確認前のホテルは無い）${BYVIEW}`, J(namesOf(rc)));
    const pc = await page({ who: 'c' });
    const okc = await visit(pc);
    const vc = await look(pc);
    const held = await storeHas(pc, [PUB]);
    const t2 = await tab(pc);
    const from2 = pc.st.got.length;
    const out2 = await logoutVia(t2);
    const turned = await pc.page.waitForFunction((sel) => { const e = document.querySelector(sel); return !!e && e.dataset.state === 'locked'; },
      { timeout: 20000 }, SL).then(() => true, () => false);
    const okc2 = turned && (await settled(pc));
    const vc2 = await look(pc);
    const after2 = pc.st.got.slice(from2).filter((g) => g.fn === 'pv_stays');
    const seen2 = await seenSince(pc, [PUB], from2);
    ok(okc && vc.state === 'open' && vc.names.includes(PUB) && held.length === 0
      && out2 && okc2 && vc2.state === 'locked' && vc2.who === 'login' && vc2.text === LOCK + LOGIN && vc2.names.length === 0
      && after2.length >= 1 && after2.every(isLockedBytes) && seen2.length === 0,
      `★S8 'c' の一覧が開いているとき、ほかのタブでサイトのログアウトをすると、開いていた欄は鍵の1行と「${LOGIN}」に変わる・ホテルの名前は画面にも保存領域にも残らない${BYVIEW}`,
      J({ open: { state: vc.state, names: vc.names, held }, out2, after: after2.map((g) => g.text), vc2, seen2 }));
    await shut(pc);
    const rp = await stays('pay');
    ok(isLockedBytes(rp), `★S8 給与提出者 'pay'（給与の鍵だけ）への返事は ${LOCKED} そのもの${BYCALL}`, rp.text);
  });

  /* ── S8b ────────────────────────────────────────────── */
  await scene('S8b 引き取り：ログインなしで足す → 同じ窓でログイン → ログアウト → 別の会員 → 別の窓', async () => {
    const g = await page({});
    const r0 = await visit(g);
    const { reply, v } = await addVia(g, HAND);
    const key = await g.page.evaluate(() => { try { return localStorage.getItem('pv_stay_key'); } catch { return null; } });
    ok(r0 && reply && reply.ok === true && /^[0-9a-f]{48}$/.test(key || '') && reply.key === key
      && J(v.own) === J([{ name: HAND, badges: [MINE, PENDING] }]),
      `準備：ログインなしで1つ足した（端末の鍵が置かれ、欄の外に「${MINE}」「${PENDING}」の札）`, J({ reply, own: v.own }));
    await Promise.all([g.page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), g.page.click(`${SL} a[data-crs-entry="login"]`)]);
    const at = await loginVia(g, 'a');
    await closeBoard(g);
    const r1 = await settled(g);
    const v1 = await look(g);
    const key1 = await g.page.evaluate(() => { try { return localStorage.getItem('pv_stay_key'); } catch { return 'unreadable'; } });
    const kr = (await L.q(`select count(*)::int as n from public.pv_stay_keys where key_hash = public.pv_stay_key_hash($1)`, [key])).rows[0].n;
    const hr = (await L.q(`select author_hash = public.pv_stay_hash($2::uuid) as by_login from public.pv_stay_places where name = $1`, [HAND, M.a.id])).rows;
    ok(at === `${base}/${JAL.back}` && r1 && v1.own.some((x) => x.name === HAND && J(x.badges) === J([MINE, PENDING]))
      && key1 === null && kr === 0 && hr.length === 1 && hr[0].by_login === true,
      `★S8b 同じ窓で 'a' がログインすると：札はそのまま・pv_stay_key は端末から消え、保存先の pv_stay_keys からもその鍵の行が消え、行は 'a' のログインの印になった${BYLOGIN}`,
      J({ at, own: v1.own, key1, keyRows: kr, rows: hr }));
    const out = await logoutVia(g);
    const from = g.st.got.length;
    const back = await visit(g);
    const v2 = await look(g);
    const after = g.st.got.slice(from).filter((x) => x.fn === 'pv_stays');
    const seen = await seenSince(g, [HAND, A_POST], from);
    ok(out && back && v2.own.length === 0 && after.length >= 1 && after.every(isLockedBytes) && seen.length === 0 && v2.text === LOCK + LOGIN,
      `★S8b ログアウトのあと同じ都市を開くと：札は無い・返事は ${LOCKED} そのもの・ホテルの名前は返事にも画面にも保存領域にも無い`,
      J({ out, after: after.map((x) => x.text), v2, seen }));
    await Promise.all([g.page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), g.page.click(`${SL} a[data-crs-entry="login"]`)]);
    const fromB = g.st.got.length;
    const atb = await loginVia(g, 'b');
    await closeBoard(g);
    const rb = await settled(g);
    const vb = await look(g);
    const seenB = await seenSince(g, [HAND, A_POST], fromB);
    ok(atb === `${base}/${JAL.back}` && rb && vb.own.length === 0 && vb.state === 'locked' && vb.who === 'member' && seenB.length === 0,
      `★S8b 同じ窓で 'b' が入る：札は無い・ホテルの名前は返事にも画面にも保存領域にも無い${BYLOGIN}`, J({ atb, vb, seenB }));
    await shut(g);
    const pa = await page({ who: 'a' });
    const ra = await visit(pa);
    const va = await look(pa);
    ok(ra && va.own.some((x) => x.name === HAND),
      `★S8b 'a' は別の窓（端末の鍵なし）でも、引き取った札が出る（ログインの印で読む）`, J(va.own));
    await shut(pa);
  });
}

/* ════ 場面 login（S9）════════════════════════════════════════ */
async function login() {
  const K = await kit(JAL);
  const { base, SL, ZN, FM, DK, page, shut, n, settled, visit, look, whereIs, logoutVia, loginVia, closeBoard, draftOf } = K;
  await scene('S9 ログインの往復：打った字は戻る・書きかけは打った人のもの', async () => {
    const g = await page({ board: true });
    const r0 = await visit(g);
    await g.page.click(`${ZN} .crs-ent[data-kind="hotel"]`);
    await g.page.waitForSelector(`${FM} [data-k="name"]`, { visible: true });
    await g.page.click(`${FM} input[type="radio"][value="food"]`);
    await g.page.focus(`${FM} [data-k="name"]`);
    await g.page.keyboard.type(DRAFT_NAME);
    await g.page.focus(`${FM} [data-k="note"]`);
    await g.page.keyboard.type(DRAFT_NOTE);
    const d0 = await draftOf(g);
    ok(r0 && d0 && d0.u === '' && d0.kind === 'food' && d0.name === DRAFT_NAME && d0.note === DRAFT_NOTE && n(g, 'pv_stay_add') === 0,
      `S9 ログインせずに追加の面に打つ（送らない）：書きかけはこのタブにだけ置かれ（${DK}）、打った人の印は ''`, J(d0));
    const href = await g.page.$eval(`${SL} a[data-crs-entry="login"]`, (a) => a.getAttribute('href'));
    await Promise.all([g.page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), g.page.click(`${SL} a[data-crs-entry="login"]`)]);
    const at = await loginVia(g, 'a');
    ok(at === `${base}/${JAL.back}`,
      `S9 欄の「${LOGIN}」→ login.html で 'a' のメールに手元のコード → 同じ都市（#stay-${IATA}）へ戻った${BYLOGIN}`, J({ href, at }));
    const board = await closeBoard(g);
    ok(board === 'closed' || board === 'none',
      board === 'none' ? `S9 Give → Get の板は、この回は出なかった（出なかったことを、ここに記す）` : `S9 Give → Get の板が画面を覆い、その板の × で閉じた`, board);
    const r1 = await settled(g);
    const back = await g.page.waitForSelector(`${FM} [data-k="name"]`, { timeout: 20000 }).then(() => true, () => false);
    const f1 = await g.page.evaluate((fm) => {
      const f = document.querySelector(fm), r = f ? f.closest('.crs-formbox').getBoundingClientRect() : null;
      return { kind: f ? ((f.querySelector('input[type="radio"]:checked') || {}).value || '') : '',
        name: f ? (f.querySelector('[data-k="name"]') || {}).value : '', note: f ? (f.querySelector('[data-k="note"]') || {}).value : '',
        top: r ? Math.round(r.top) : null, ih: innerHeight, y: Math.round(scrollY),
        overflow: getComputedStyle(document.body).overflow + '/' + getComputedStyle(document.documentElement).overflow };
    }, FM);
    ok(r1 && back && f1.kind === 'food' && f1.name === DRAFT_NAME && f1.note === DRAFT_NOTE
      && !/hidden/.test(f1.overflow) && f1.y > 0 && f1.top !== null && f1.top >= 0 && f1.top < f1.ih,
      `S9 板を閉じると、追加の面が戻っている（種類と打った字のまま）・ページはその都市まで送られていて、画面の中に面が在る（スクロールも止まっていない）`, J(f1));
    const d1 = await draftOf(g);
    ok(d1 && d1.u === M.a.id && d1.name === DRAFT_NAME,
      `★S9 書きかけの印 u は、ログインした 'a' の id になった（ログインせずに打った字は 'a' のものになる）${BYLOGIN}`, J(d1));
    const out = await logoutVia(g);
    const kept = await draftOf(g);
    const atb = await loginVia(g, 'b');
    const boardB = await closeBoard(g);
    const rb = await settled(g);
    const done = await until(async () => (await draftOf(g)) === null || !!(await look(g)).form, 10000);
    const vb = await look(g);
    const d3 = await draftOf(g);
    const seen = (await whereIs(g, [DRAFT_NAME, DRAFT_NOTE])).filter((s) => !s.startsWith('返事'));
    ok(out && atb === `${base}/${JAL.back}` && rb && done && vb.form === false && d3 === null && seen.length === 0,
      `★S9 サイトのログアウト → 'b' が login.html で入る → 同じ都市：追加の面は無い・書きかけ（${DK}）は消えている・'a' の打った字は画面にも保存領域にも無い${BYLOGIN}`,
      J({ out, afterLogout: kept && { u: kept.u }, atb, boardB, form: vb.form, d3, seen }));
    await shut(g);
  });
}

/* ════ 場面 kept（S10）════════════════════════════════════════ */
async function kept() {
  const K = await kit(JAL);
  const { L, base, SL, page, shut, replies, settled, visit, stays, rowsOf, isLockedBytes, photoOf } = K;
  const OTHER = SLUG === 'ana' ? 'jal' : 'ana';
  await scene('S10 前からの動き：写真・「Google マップ」・同じ空港の他社のホテル', async () => {
    /* 30秒に1つの決まりは書いた人ごと。2つめと3つめは会員 'a'・'b' が足し、オーナーが待ち行列の版の印（rev）を添えて公開する */
    const p1 = await rpcAs(base, 'op', 'pv_stay_add', { airline: SLUG, iata: IATA, kind: 'hotel', name: PUB, publish: true });
    const p2 = await rpcAs(base, 'a', 'pv_stay_add', { airline: SLUG, iata: IATA, kind: 'hotel', name: PUB_MAP, maps_url: MAPS_LINK });
    const p3 = await rpcAs(base, 'b', 'pv_stay_add', { airline: OTHER, iata: IATA, kind: 'hotel', name: OTHER_HOTEL });
    const qq = (await rpcAs(base, 'op', 'pv_stay_queue', {})).body;
    const pub = async (nm) => {
      const row = qq && Array.isArray(qq.places) ? qq.places.find((x) => x.name === nm && x.state === 'pending') : null;
      return row ? (await rpcAs(base, 'op', 'pv_stay_moderate', { target: 'place', id: row.id, state: 'public', rev: row.rev })).body : null;
    };
    const m2 = await pub(PUB_MAP), m3 = await pub(OTHER_HOTEL);
    ok(p1.body && p1.body.ok === true && p1.body.item && p1.body.item.state === 'public'
      && p2.body && p2.body.ok === true && p2.body.item && p2.body.item.maps_url === MAPS_LINK && p3.body && p3.body.ok === true
      && m2 && m2.ok === true && m2.state === 'public' && m3 && m3.ok === true && m3.state === 'public',
      `準備：公開のホテルが3つ（${SLUG} の ${IATA} に、オーナー 'op' が置いた1つと、'a' が地図のリンクつきで足して 'op' が公開した1つ。同じ ${IATA} の ${OTHER} に、'b' が足して 'op' が公開した1つ）`,
      J({ p1: p1.body, p2: p2.body, p3: p3.body, m2, m3 }));
    await payKey(K);

    /* 承認された 'pilot' が写真を足す（ページの「写真を追加」。画像はページの中で描いた絵） */
    const place = ((await rowsOf(PUB))[0] || {}).id;
    const pp = await page({ who: 'pilot' });
    const r0 = await visit(pp);
    const sel = `${SL} .crs-file-in[data-place="${place}"]`;
    const has = !!(await pp.page.$(sel));
    const before = replies(pp, 'pv_stay_photo_add').length;
    if (has) await pp.page.evaluate(async (s) => {
      const cv = document.createElement('canvas');
      cv.width = 320; cv.height = 240;
      const cx = cv.getContext('2d');
      cx.fillStyle = '#2f6f5e'; cx.fillRect(0, 0, 320, 240);
      cx.fillStyle = '#f4efe6'; cx.fillRect(40, 40, 120, 80);
      const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'stay.png', { type: 'image/png' }));
      const fi = document.querySelector(s);
      fi.files = dt.files;
      fi.dispatchEvent(new Event('change', { bubbles: true }));
    }, sel);
    await until(() => replies(pp, 'pv_stay_photo_add').length > before);
    const said = await pp.page.waitForFunction((s, t) => { const x = document.querySelector(s + ' .crs-say'); return !!x && x.textContent.trim() === t; },
      { timeout: 20000 }, SL, PHOTO_DONE).then(() => true, () => false);
    await settled(pp);
    await pp.page.waitForFunction((s) => ![...document.querySelectorAll(s + ' .crs-ph')].some((b) => b.getAttribute('data-ph') === 'wait'),
      { timeout: 20000 }, SL).catch(() => {});
    let pr = null;
    try { pr = JSON.parse(replies(pp, 'pv_stay_photo_add').at(-1).text); } catch { pr = null; }
    const ph1 = await photoOf(pp, PUB);
    ok(r0 && has && pr && pr.ok === true && pr.photo && pr.photo.state === 'pending' && said && ph1.n === 1 && J(ph1.badges) === J([PENDING]),
      `S10 承認された 'pilot' が公開のホテルに「写真を追加」→「${PHOTO_DONE}」・その写真に「${PENDING}」の札`, J({ has, pr, said, ph1 }));
    await shut(pp);
    const fs1 = (await L.q(`select id::text as id, state from public.pv_stay_photos where place_id = $1::uuid`, [place])).rows;
    const m = fs1.length === 1 ? await rpcAs(base, 'op', 'pv_stay_moderate', { target: 'photo', id: fs1[0].id, state: 'public' }) : null;
    ok(fs1.length === 1 && m && m.body && m.body.ok === true,
      `準備：オーナー 'op' がその写真を公開した（pv_stay_moderate）`, J({ photos: fs1, m: m && m.body }));

    /* 承認した2人目 'c' に写真が出る。'pay' は locked のまま */
    await approve(K, 'c', 'S10');
    const pc = await page({ who: 'c' });
    const rc = await visit(pc);
    await pc.page.waitForFunction((s) => { const b = [...document.querySelectorAll(s + ' .crs-ph')]; return b.length > 0 && !b.some((x) => x.getAttribute('data-ph') === 'wait'); },
      { timeout: 20000 }, SL).catch(() => {});
    const ph2 = await photoOf(pc, PUB);
    ok(rc && ph2.n === 1 && J(ph2.states) === J(['ok']) && ph2.badges.length === 0 && ph2.w[0] > 0,
      `S10 承認した2人目 'c' の画面に、公開した写真が出る（読み込めた・「${PENDING}」の札なし）${BYVIEW}`, J(ph2));
    const rp = await stays('pay');
    ok(isLockedBytes(rp), `★S10 給与提出者 'pay'（給与の鍵だけ）への返事は ${LOCKED} そのもの（ホテルの名前も写真の印も無い）${BYCALL}`, rp.text);

    /* 「Google マップ」の行き先（辿らない。門は google.com を止めるし、どの検査も Google マップを開かない） */
    const maps = await pc.page.evaluate((s) => {
      const e = document.querySelector(s);
      return { city: e ? e.getAttribute('data-city') : '', cards: e ? [...e.querySelectorAll('.crs-grp .crs-card')].map((c) => {
        const a = c.querySelector('a.crs-map');
        return { name: (c.querySelector('.crs-name') || {}).textContent, href: a ? a.getAttribute('href') : '', text: a ? a.textContent.trim() : '' };
      }) : [] };
    }, SL);
    const search = (nm) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${nm} ${maps.city}`.replace(/\s+/g, ' ').trim());
    const by = Object.fromEntries(maps.cards.map((c) => [c.name, c]));
    ok(!!maps.city && maps.city !== IATA && by[PUB_MAP] && by[PUB_MAP].href === MAPS_LINK && by[PUB] && by[PUB].href === search(PUB)
      && maps.cards.length === 2 && maps.cards.every((c) => c.text === MAP),
      `S10 'c' の画面の「${MAP}」の行き先：貼ったリンクのあるホテルはそのリンク、無いホテルは名前と都市（${maps.city}）の Google マップの検索（辿らずに href を読んだだけ）${BYVIEW}`, J(maps));

    /* 同じ空港の他社のホテル */
    const crc = read(`airlines/${SLUG}.html`).match(/<script[^>]*id="crc-data"[^>]*>([\s\S]*?)<\/script>/);
    let other = '';
    try { other = JSON.parse(crc[1]).airlines[OTHER].ja || ''; } catch { other = ''; }
    await pc.page.waitForFunction((s, nm) => [...document.querySelectorAll(s + ' .crs-co-n')].some((h) => h.textContent === nm),
      { timeout: 10000 }, SL, other).catch(() => {});
    const ov = await pc.page.evaluate((s) => {
      const o = document.querySelector(s + ' .crs-others');
      return o ? { h: (o.querySelector('.crs-h-o') || {}).textContent, groups: [...o.querySelectorAll('.crs-co')].map((g) => ({
        co: (g.querySelector('.crs-co-n') || {}).textContent, names: [...g.querySelectorAll('.crs-name')].map((x) => x.textContent) })) } : null;
    }, SL);
    ok(!!other && ov && ov.h === OTHERS && J(ov.groups) === J([{ co: other, names: [OTHER_HOTEL] }]),
      `S10 'c' の画面で、同じ ${IATA} の ${OTHER} のホテルは「${OTHERS}」の下に、その会社の名前（${other}）で出る${BYVIEW}`, J(ov));
    await shut(pc);
  });
}

/* ════ 場面 career（S11）══════════════════════════════════════ */
async function career() {
  const K = await kit(CAREER);
  const { base, page, shut, replies, visit, look, whereIs, addVia, stays, namesOf, rowsOf, isLockedBytes } = K;
  const AIR = CAREER.airline, AT = CAREER.iata;
  await scene(`S11 career.html?airline=${AIR}&stay=${AT}：S1・S2 をもう一度`, async () => {
    const put = await rpcAs(base, 'op', 'pv_stay_add', { airline: AIR, iata: AT, kind: 'hotel', name: PUB, publish: true });
    ok(put.body && put.body.ok === true && put.body.item && put.body.item.state === 'public',
      `準備：オーナー 'op' が ${AIR} の ${AT} に、公開のホテルを1つ置いた（pv_stay_add・publish:true）`, J(put.body));
    const g = await page({});
    const r0 = await visit(g);
    const v0 = await look(g);
    const rs = replies(g, 'pv_stays');
    const seen0 = await whereIs(g, [PUB]);
    ok(r0 && rs.length >= 1 && rs.every(isLockedBytes) && v0.state === 'locked' && v0.who === 'login' && v0.text === LOCK + LOGIN
      && J(v0.entry) === J([LOGIN]) && v0.ents === ENTS && seen0.length === 0,
      `S11 ログインしていない人：返事は ${LOCKED} そのもの・欄は鍵の1行と「${LOGIN}」・欄の外に入口が3つ・公開のホテルの名前はどこにも無い`,
      J({ rs: rs.map((r) => r.text), v0, seen0 }));
    const { reply, sent, v } = await addVia(g, GUEST);
    const key = await g.page.evaluate(() => { try { return localStorage.getItem('pv_stay_key'); } catch { return null; } });
    const rows = await rowsOf(GUEST);
    ok(sent.length === 1 && sent[0].p && sent[0].p.name === GUEST && sent[0].p.airline === AIR && sent[0].p.iata === AT && !('key' in sent[0].p)
      && reply && reply.ok === true && /^[0-9a-f]{48}$/.test(reply.key || '') && reply.key === key && rows.length === 1 && rows[0].state === 'pending'
      && v.say === ADDED && J(v.own) === J([{ name: GUEST, badges: [MINE, PENDING] }]) && v.state === 'locked' && v.text === LOCK + LOGIN,
      `S11 「ホテルを追加」→ 名前 →「追加する」の1回で pv_stay_add が1本（${AIR}・${AT}・名前）・端末の鍵・保存先に確認待ちの1行・欄の外に「${ADDED}」と「${MINE}」「${PENDING}」の札・欄の中は鍵の1行のまま`,
      J({ sent, reply, rows: rows.map((r) => r.state), say: v.say, own: v.own }));
    await shut(g);
    const pv = await page({ who: 'pilot' });
    const rv = await visit(pv);
    const vv = await look(pv);
    const sv = await whereIs(pv, [GUEST]);
    ok(rv && vv.state === 'open' && vv.names.includes(PUB) && !vv.names.includes(GUEST) && sv.length === 0,
      `S11 承認された人 'pilot' の画面は一覧が開く（公開のホテルは在る・確認前の他人のホテルは返事にも画面にも保存領域にも無い）`, J({ vv, sv }));
    await shut(pv);
    const ro = await stays('op');
    const og = ro.body && Array.isArray(ro.body.places) ? ro.body.places.find((x) => x.name === GUEST) : null;
    ok(ro.body && ro.body.state === 'open' && namesOf(ro).includes(PUB) && !!og && og.state === 'pending',
      `S11 オーナー 'op' の一覧には、確認待ちの他人のホテルも在る`, J(namesOf(ro)));
  });
}

/* 場面ごとに：止まったら1行の失敗にして次の場面へ（どの場面も自分の保存先を持つ）。終わったら窓を閉じ、保存先を消す。 */
const closeAll = async () => {
  for (const p of PAGES) { try { await p.ctx.close(); } catch { /* もう閉じてある */ } }
  for (const L of BROUGHT) await L.stop().catch(() => {});
};
try {
  for (const s of want) {
    try { await SCENES[s](); }
    catch (e) { ok(false, `場面が途中で止まった（${s}）`, String(e && e.stack || e).slice(0, 600)); }
    finally { await closeAll(); }
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  for (const L of BROUGHT) await L.stop().catch(() => {});
}
/* 閉じの行（どの実行でも出す） */
const blocked = PAGES.flatMap((p) => [...p.st.blocked]), supa = PAGES.flatMap((p) => [...p.st.supa]);
console.log('');
ok(PAGES.length > 0 && blocked.length === 0 && supa.length === 0,
  `★どのページ（${PAGES.length}枚）の st.blocked と st.supa も空 ── 手元と書体・部品の配信元のほかへ、1本も投げていない`, J({ blocked, supa }));
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exitCode = fail ? 1 : 0;
