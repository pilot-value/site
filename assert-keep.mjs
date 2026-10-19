/* assert-keep.mjs — 打ってまだ送っていない入力は、戻る・押し間違い・切れたログインのあとも、このタブに30分残る。
   ログインが知らせなく終わったら、ログインのあいだに読んだ値は、その場で画面から消える（WP-keep-1・2026-10-17）。

   オーナーのことば（2026-10-16）：「これ書いたのに何らかの理由で戻るとか間違えて押して、このページに戻ってきたら全部消えてるってこと？
   それならしばらくは消えないようにして。消えてたらやり直すのイライラするから」／（ログインが切れた時の画面）「おすすめでいいよ」。

   面は5つ：月の勤務（work）・質問のまとまり（roster）・住みやすい街（town）・ホテルの追加（career-stay.js）・
   ほかの会社について答える面（PVContrib.openFor ＝ 読む人自身の会社）。会社ページは jal、ほかの会社は ANA。

   場面 back（KA1）  面ごとに：打つ・選ぶ → 戻る → 進む／ほかのページへ行って戻る／読み直す／閉じて開き直す → 打った字と選んだものがそのまま。
   場面 clock（KA2） 31分前の下書きは出ない・残らない。29分前のものは戻る（時刻は sessionStorage の at を書き換える ＝ 時間では待たない）。
   場面 reader（KA3・KA4） 'a' が打つ → 自動のログアウト（PVSession.wipe と時計の1回）→ 同じタブの login.html で 'b' が入る →
                    'a' の下書きは出ない・残らない。
                    サイトの「ログアウト」（profile.html）→ 下書きは全部消える（同じ 'a' がログインし直しても戻らない）。
                    自動のログアウト → 下書きは残る → 同じ 'a' が login.html で入り直すと戻る。
   場面 store（KA5） 打ったあいだ：下書きの鍵は localStorage に1つも無い・打った字はどの通信にも計測（gtag）にも乗らない ── 送るを押すまで。
                    （ホテルの名前の候補の口が無いとき ＝ いまの本番。候補の部品は先に ping だけを聞き、名前の字も送らない）
                    ★例外は1つだけ（2026-10-19 P12.74・オーナー「ホテルの名前を入れると勝手に google map の該当するであろう候補が出てきて」）：
                    候補が出せるとき、ホテルの「追加」の名前の欄（種類がホテルのとき）の字だけが、このサイトの候補の口
                    （/functions/v1/hotel-suggest）へ、名もなしで（公開の鍵だけ）出ていく。中身は { q: 名前, lang, near } だけ。
                    住所・補足・ほかの種類の名前・ほかの4つの面の字は、候補が出せるときも、送るを押すまでどの通信にも乗らない。
                    打った字を送るかどうかは「打つのが止まってから」決まるので、local-chain.mjs の settleSuggest で、その時計が
                    鳴り終わるまで焦点を欄に置いたまま待ってから読む（時間では待たない）。
   場面 fail（KA6）  送れなかった：「送れていません」・打った値はそのまま・もう1回押すと保存される。
                    ほかの会社について答えている途中でログインがサーバに断られた：login.html へ → 同じ人が入り直して開き直すと、選んだ答えが戻り
                    「ログインしました」・押すと保存される。
   場面 gone（KA7）  給与を出した会員が REAL PAY の行を見ている → ログインの鍵が消える（同じタブの自動のログアウト・ほかのタブ）→
                    時計の1回のうちに、読んだ行の字はページのどこにも無い・ログインしていない人の入口が出る・下書きは1文字も変わらない。
   場面 bfcache（KA8）ブラウザが手元に置いたページが「戻る」でそのまま戻る時（back-forward cache・pageshow の persisted）。
                    通信の差し替え（setRequestInterception）を使うとブラウザがこの置き方をやめるので、この場面だけ使わない：
                    手元のサーバーの前に、サイトのファイルだけ GitHub Pages と同じ見出し（Cache-Control: max-age=600）で渡す口を置き、
                    ブラウザは localhost と書体・部品の配信元（LIBS の4つ）のほかは名前を引けない（ほかへは1本も出られない）。
                    ① 同じ 'a' のまま：ほかのページへ行って「戻る」→ 打った街のひとことはそのまま。
                    ② ほかのページで自動のログアウト（pv-session.js の wipe）→「戻る」→ 閉じた面を開き直しても 'a' の字は出ない・
                       右上は「ログイン」・'a' の下書きはこのタブに 'a' の印のまま残る（WP-keep-1 の決まりのまま）。
                    ③ サイトの「ログアウト」（profile.html）→「戻る」2回：ログインの知らせ（BroadcastChannel）が来ても
                       ページを捨てないブラウザ（Chrome は捨てる。Safari などは確かめていない）を、その窓口を外して作る →
                       開き直しても 'a' の字は出ない・右上は「ログイン」・離れても 'a' の字を置き直さない。
                    ④ 別の会員が入ったあと（日英）：'a' のマイページ → ほかのページで自動のログアウト → login.html で 'b' がコードで入る →
                       「戻る」の一覧から 'a' のマイページを選ぶ（手元から戻る・③ と同じく知らせの窓口を外したブラウザ）→
                       戻った瞬間も 'a' の名前とメールは画面に無い・着いたマイページは 'b' のもの。
                    どの確かめも、ブラウザが手元から戻さなかった（読み直した）時は、最初から新しいタブでやり直す（5回まで・時間では待たず
                    「戻る」のあとの pageshow を待つ）。5回とも戻らなければ、その行は「確かめられなかった（not proven）」で赤
                    （読み直しを「戻った」とは数えない）。

   ★本番にも 3000 番にも1回も通信しない（local-chain.mjs の bring・open。終われば保存先ごと消す）。
   ★手元の会員（serve-local.mjs の MEMBERS）は模擬。ここで通ったことは、本番で通った証拠にはならない。
   ★画面の字（「送れていません」「ログインしました」など）は、ここで持つ（pv-contrib.js から読み込まない）。

   実行: node assert-keep.mjs [--scenes back,clock,reader,store,fail,gone,bfcache]（既定：全部）
*/
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEMBERS, OTP } from './serve-local.mjs';
import { bring, open, rpcAs, seedOf, LIBS, watchSuggest, settleSuggest } from './local-chain.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? ' ' + e : ''))); };
const J = (v) => { try { return JSON.stringify(v).slice(0, 600); } catch { return String(v); } };

const argv = process.argv.slice(2);
const val = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const SCENES = { back, clock, reader, store, fail: failed, gone, bfcache };
const want = (val('--scenes') || Object.keys(SCENES).join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const unknown = want.filter((s) => !SCENES[s]);
if (unknown.length) { console.error(`✗ 知らない場面: ${unknown.join(', ')}（あるのは ${Object.keys(SCENES).join(', ')}）`); process.exit(2); }

const SLUG = 'jal', CO = { airline: 'ana', name: 'ANA', ask: ['reserve_duty'] };
const IATA = (read(`airlines/${SLUG}.html`).match(/href="#stay-([A-Z]{3})" data-city="\1"/) || [])[1];
if (!IATA) { console.error(`✗ airlines/${SLUG}.html に就航地の都市が無い`); process.exit(2); }
const PAGE = `airlines/${SLUG}.html`, CITY = `${PAGE}#stay-${IATA}`;
const M = Object.fromEntries(MEMBERS.map((m) => [m.key, m]));
const MIN = 60 * 1000;
/* 画面の字（ここで固定する） */
const FAIL_T = '送れていません', BACK_T = 'ログインしました', LOCK_PAY = '給与の提出で開きます';
/* 打つ字（どれも検査の中だけの架空の字） */
const T = {
  note: '検査用の打ちかけのひとこと（手元・KA）', good: '検査用の打ちかけの良い点（手元・KA）',
  hotel: '検査用の打ちかけの店（手元・KA）', qnote: '検査用の打ちかけの補足（手元・KA）', conote: '検査用のほかの会社の補足（手元・KA）',
  haddr: '検査用の打ちかけの住所（手元・KA）', hnote: '検査用の打ちかけの店のひとこと（手元・KA）', food: '検査用の打ちかけの食堂（手元・KA）',
};
/* 面ごとの名前・開き方・打ち方・読み方 */
const SLOT = '#pvg-city .crl[data-live="hotels"]', ZN = `${SLOT} + .crs-zone`, FM = `${ZN} .crs-formbox > .crs-form`;

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

let browser = null;
const PAGES = [], BROUGHT = [];
async function scene(title, fn) {
  console.log(`\n════ ${title} ════`);
  try { await fn(); } catch (e) { ok(false, `「${title}」が最後まで進んだ`, String(e && e.message || e).split('\n')[0].slice(0, 300)); }
}

/* ── 道具 ─────────────────────────────────────────────────── */
async function kit(o = {}) {
  const L = await bring(o);
  BROUGHT.push(L);
  if (!browser) browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
  const base = L.base;
  console.log(`\n手元の保存先 ${base}（使い捨て）`);

  /* 1枚開く。どの台本よりも先に：計測（gtag）の呼び出しを控える・60秒の時計（ログインの見張り）を控えて、検査から1回ずつ回せるようにする。
     出ていった通信は、行き先と送った中身を全部控える（p.reqs）。 */
  const page = async (o = {}) => {
    const p = await open(browser, base, { w: 390, h: 680, ...o });
    p.reqs = [];
    p.full = [];   // 同じ通信を、行き先・中身・見出しごと（KA5 の例外が見る）
    p.page.on('request', (r) => {
      p.reqs.push(r.url() + ' ' + (r.postData() || ''));
      p.full.push({ m: r.method(), u: r.url(), h: r.headers(), b: r.postData() || '' });
    });
    await p.page.evaluateOnNewDocument(() => {
      window.__ticks = [];
      const every = window.setInterval;
      window.setInterval = function (fn, ms) { if (ms === 60000 && typeof fn === 'function') window.__ticks.push(fn); return every.apply(this, arguments); };
    });
    PAGES.push(p);
    return p;
  };
  const go = async (p, at = PAGE) => {
    await p.page.goto(`${base}/${at}`, { waitUntil: 'load', timeout: 60000 });
    await p.page.waitForFunction(() => !!window.PVContrib && [...document.styleSheets].some((s) => s.href && s.href.includes('pv-contrib.css')), { timeout: 30000 });
  };
  /* 戻る・進む・読み直しのあと、ページが使えるようになるまで */
  const ready = (p) => p.page.waitForFunction(() => document.readyState === 'complete' && !!window.PVContrib, { timeout: 30000 });
  /* 時計の1回（pv-session.js・pv-contrib.js・career-stay.js が仕掛けた60秒の見回りを、全部1回ずつ） */
  const tickAll = (p) => p.page.evaluate(() => { (window.__ticks || []).forEach((f) => { try { f(); } catch (e) { /* 1つ落ちても残りは回す */ } }); return (window.__ticks || []).length; });
  /* 自動のログアウト（pv-session.js が無操作の期限で切る時と同じ関数）→ 時計の1回 */
  const idle = async (p) => { await p.page.evaluate(() => window.PVSession.wipe()); return tickAll(p); };

  /* 面（pv-contrib.js）：開く・開き切るまで・閉じる */
  const formIn = (p, topic) => p.page.waitForFunction((t) => {
    const r = document.querySelector('.pvc-root');
    if (!r || r.hidden || !r.classList.contains('is-in')) return false;
    const f = r.querySelector('form[data-pvc-form="' + t + '"]'), s = f && f.querySelector('fieldset.pvc-set');
    const wt = r.querySelector('[data-pvc-wait]');
    return !!s && !s.disabled && (!wt || !/確認しています/.test(wt.textContent));
  }, { timeout: 20000 }, topic);
  const closed = (p) => p.page.waitForFunction(() => {
    const r = document.querySelector('.pvc-root');
    return (!r || !r.classList.contains('is-in')) && !(history.state && history.state.pvc);
  }, { timeout: 20000 });
  const shutSheet = async (p) => { await p.page.evaluate(() => window.PVContrib.close()); await closed(p); };
  /* 街の面はページの入口から（「暮らし・家族」のタブの中。見えていなければ先にタブを押す） */
  const openTown = async (p) => {
    const sel = '[data-pvc-open="town"][data-pvc-base]';
    if (!(await p.page.$eval(sel, (n) => n.getClientRects().length > 0).catch(() => false))) {
      await p.page.click('.pvg-tabs [data-pvg-tab="life"]');
      await p.page.waitForFunction((s) => { const n = document.querySelector(s); return !!n && n.getClientRects().length > 0; }, { timeout: 20000 }, sel);
    }
    await p.page.click(sel);
    await formIn(p, 'town');
  };
  const SURF = {
    work: {
      name: '月の勤務', topic: 'work',
      open: async (p) => { await p.page.evaluate(() => window.PVContrib.open({ topic: 'work' })); await formIn(p, 'work'); },
      type: async (p) => { await p.page.select('.pvc-root select[name="position"]', 'cap'); await fill(p, 'block_hours', '71.5'); await fill(p, 'note', T.note); },
      read: (p) => fields(p, ['position', 'block_hours', 'note']),
      want: { position: 'cap', block_hours: '71.5', note: T.note },
    },
    roster: {
      name: '質問のまとまり（勤務スケジュール）', topic: 'roster',
      open: async (p) => { await p.page.evaluate(() => window.PVContrib.open({ topic: 'roster' })); await formIn(p, 'roster'); },
      type: async (p) => {
        await p.page.select('.pvc-root select[name="reserve_duty"]', 'yes');
        await p.page.select('.pvc-root select[name="days_off_request"]', 'partial');
        await noteOpen(p, 'reserve_duty');
        await fill(p, 'reserve_duty_note', T.qnote);
      },
      read: (p) => fields(p, ['reserve_duty', 'days_off_request', 'reserve_duty_note']),
      want: { reserve_duty: 'yes', days_off_request: 'partial', reserve_duty_note: T.qnote },
    },
    town: {
      name: '住みやすい街', topic: 'town',
      open: openTown,
      type: async (p) => { await fill(p, 'good', T.good); },
      read: (p) => fields(p, ['good']),
      want: { good: T.good },
    },
    co: {
      name: 'ほかの会社（ANA）について答える面', topic: 'roster',
      open: async (p) => {
        await p.page.evaluate((o) => window.PVContrib.openFor(o), CO);
        await formIn(p, 'roster');
        await p.page.waitForFunction(() => { const l = document.querySelector('.pvc-root .pvc-ctx-line'); return !!l && l.textContent.indexOf('ANA · ') === 0; }, { timeout: 20000 });
      },
      type: async (p) => {
        await p.page.select('.pvc-root select[name="days_off_request"]', 'partial');
        await noteOpen(p, 'days_off_request');
        await fill(p, 'days_off_request_note', T.conote);
      },
      read: async (p) => ({ ...(await fields(p, ['days_off_request', 'days_off_request_note'])),
        line: await p.page.evaluate(() => { const l = document.querySelector('.pvc-root .pvc-ctx-line'); return l ? l.textContent.slice(0, 6) : ''; }) }),
      want: { days_off_request: 'partial', days_off_request_note: T.conote, line: 'ANA · ' },
    },
  };
  /* 欄に打つ（空にしてから、キーで打つ） */
  async function fill(p, name, v) {
    await p.page.$eval(`.pvc-root form [name="${name}"]`, (n) => { n.focus(); if (n.select) n.select(); });
    await p.page.keyboard.press('Backspace');
    if (v !== '') await p.page.keyboard.type(String(v));
  }
  /* 補足の欄を開く（畳まれていれば押す） */
  async function noteOpen(p, qid) {
    const hid = await p.page.$eval(`.pvc-root form [name="${qid}_note"]`, (n) => !!n.closest('[hidden]'));
    if (hid) await p.page.$eval(`.pvc-root [data-q-more="${qid}"]`, (b) => { b.scrollIntoView({ block: 'center' }); b.click(); });
    await p.page.waitForFunction((q) => { const n = document.querySelector('.pvc-root form [name="' + q + '_note"]'); return !!n && !n.closest('[hidden]'); }, { timeout: 10000 }, qid);
  }
  function fields(p, names) {
    return p.page.evaluate((ns) => {
      const o = {};
      for (const n of ns) { const e = document.querySelector('.pvc-root form [name="' + n + '"]'); o[n] = e ? e.value : null; }
      return o;
    }, names);
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /* ホテルの追加（career-stay.js）：都市を開く・面を開く・打つ・読む */
  const cityIn = (p) => p.page.waitForFunction((sel, code) => {
    const e = document.querySelector(sel);
    return !!e && e.getClientRects().length > 0 && e.getAttribute('data-stay') === code && !/^(idle|loading)$/.test(e.dataset.state || '')
      && !!(e.nextElementSibling && e.nextElementSibling.classList.contains('crs-zone'));
  }, { timeout: 30000 }, SLOT, IATA);
  const hotelType = async (p) => {
    await p.page.click(`${ZN} .crs-ent[data-kind="hotel"]`);
    await p.page.waitForSelector(`${FM} [data-k="name"]`, { visible: true });
    await p.page.focus(`${FM} [data-k="name"]`);
    await p.page.keyboard.type(T.hotel);
  };
  const hotelForm = (p) => p.page.evaluate((fm) => { const f = document.querySelector(fm); return f ? ((f.querySelector('[data-k="name"]') || {}).value || '') : null; }, FM);
  /* 面が戻るまで（restoreDraft は都市の答えが届いてから） */
  const hotelBack = async (p) => { await cityIn(p); await until(async () => (await hotelForm(p)) !== null, 8000); return hotelForm(p); };

  /* 下書き（このタブの sessionStorage）：鍵の一覧・1件・時刻の書き換え */
  const drafts = (p) => p.page.evaluate(() => { const o = {}; for (const k of Object.keys(sessionStorage)) if (/^pv_(contrib|stay)_draft:/.test(k)) o[k] = sessionStorage.getItem(k); return o; });
  const restamp = (p, key, ago) => p.page.evaluate((k, a) => {
    const o = JSON.parse(sessionStorage.getItem(k)); o.at = Date.now() - a; sessionStorage.setItem(k, JSON.stringify(o)); return o.at;
  }, key, ago);
  const fpOf = (p, who) => p.page.evaluate((id) => 'm:' + window.PVPayLocal.fp(id), M[who].id);
  /* その字が、画面（HTML 全体）・保存領域（local と session）のどこに在るか */
  const whereIs = async (p, names) => {
    const dom = await p.page.evaluate(() => document.documentElement.outerHTML + '\n' + [...document.querySelectorAll('input,textarea,select')].map((n) => n.value).join('\n'));
    const st = await p.page.evaluate(() => {
      const o = [];
      for (const s of [localStorage, sessionStorage]) for (let i = 0; i < s.length; i++) { const k = s.key(i); o.push(k + '=' + s.getItem(k)); }
      return o.join('\n');
    });
    const out = [];
    for (const n of names) { if (dom.includes(n)) out.push(`画面に「${n}」`); if (st.includes(n)) out.push(`保存領域に「${n}」`); }
    return out;
  };

  /* login.html で、その会員のメールに手元のコードを入れて入る（login.html に居なければ、戻り先つきで開く）。着いた住所を返す。 */
  const loginVia = async (p, who, back = PAGE) => {
    if (!/\/login\.html(\?|$)/.test(p.page.url())) {
      await p.page.goto(`${base}/login.html?redirect=${encodeURIComponent(back)}`, { waitUntil: 'load', timeout: 60000 });
    }
    await p.page.click('button[onclick="showEmailStep()"]');
    await p.page.waitForSelector('#otp-email', { visible: true });
    await p.page.type('#otp-email', M[who].email);
    await p.page.click('#otp-send-btn');
    await p.page.waitForSelector('#otp-code', { visible: true });
    await Promise.all([p.page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), p.page.type('#otp-code', OTP)]);
    await ready(p);
    return p.page.url();
  };
  /* Give → Get の板が出たら、その板の × で閉じる */
  const closeBoard = async (p) => {
    const shown = await p.page.waitForSelector('.pvgf-x', { visible: true, timeout: 4000 }).then(() => true, () => false);
    if (!shown) return 'none';
    await p.page.click('.pvgf-x');
    await p.page.waitForFunction(() => { const x = document.querySelector('.pvgf-x'); return !x || x.getClientRects().length === 0; }, { timeout: 10000 }).catch(() => {});
    return 'closed';
  };
  /* サイトのログアウト（profile.html の「ログアウト」。確かめの問いには「はい」）。鍵と pv_user が消えたかを返す */
  const logoutVia = async (p) => {
    await p.page.goto(`${base}/profile.html`, { waitUntil: 'load', timeout: 60000 });
    await p.page.waitForSelector('.btn-logout', { visible: true });
    const yes = (d) => { d.accept().catch(() => {}); };
    p.page.on('dialog', yes);
    await Promise.all([p.page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), p.page.click('.btn-logout')]);
    p.page.off('dialog', yes);
    return p.page.evaluate(() => !localStorage.getItem('sb-local-auth-token') && !localStorage.getItem('pv_user'));
  };
  return { L, base, page, go, ready, tickAll, idle, formIn, closed, shutSheet, SURF, fill, fields, same, cityIn, hotelType, hotelForm, hotelBack,
    drafts, restamp, fpOf, whereIs, loginVia, closeBoard, logoutVia };
}

/* ════ 場面 back（KA1）════════════════════════════════════════ */
async function back() {
  const K = await kit();
  const { base, page, go, ready, SURF, same, shutSheet, closed, cityIn, hotelType, hotelForm, hotelBack } = K;
  for (const key of ['work', 'roster', 'town', 'co']) {
    const S = SURF[key];
    await scene(`KA1 ${S.name}：戻る・ほかのページ・読み直し・開き直しのあとも、打った字と選んだものがそのまま`, async () => {
      const p = await page({ who: 'a' });
      await go(p);
      await S.open(p);
      await S.type(p);
      const r0 = await S.read(p);
      if (!same(r0, S.want)) throw new Error('前提が崩れた（打った形になっていない）: ' + J(r0));
      /* 戻る（面の段を降りる ＝ 閉じる）→ 進む（面の段へ戻る） */
      await p.page.goBack(); await closed(p);
      await p.page.goForward(); await K.formIn(p, S.topic);
      const r1 = await S.read(p);
      /* ほかのページへ行って、戻る（押し間違い）→ 開く */
      await p.page.goto(`${base}/terms.html`, { waitUntil: 'load', timeout: 60000 });
      await p.page.goBack({ waitUntil: 'load' }); await ready(p);
      await S.open(p);
      const r2 = await S.read(p);
      /* 読み直す → 開く */
      await p.page.reload({ waitUntil: 'load' }); await ready(p);
      await S.open(p);
      const r3 = await S.read(p);
      /* 閉じて、開き直す */
      await shutSheet(p);
      await S.open(p);
      const r4 = await S.read(p);
      ok(same(r1, S.want) && same(r2, S.want) && same(r3, S.want) && same(r4, S.want),
        `★KA1 ${S.name}：戻る → 進む／ほかのページへ行って戻る／読み直す／閉じて開き直す の4つとも、打った字と選んだものが1文字も違わずに戻る`,
        J({ r1, r2, r3, r4 }));
    });
  }
  await scene('KA1 ホテルの追加：ほかのページへ行って戻る・読み直すと、追加の面が打った字のまま戻る', async () => {
    const p = await page({ who: 'a' });
    await go(p, CITY);
    await cityIn(p);
    await hotelType(p);
    const h0 = await hotelForm(p);
    if (h0 !== T.hotel) throw new Error('前提が崩れた（追加の面に打てていない）: ' + J(h0));
    await p.page.goto(`${base}/terms.html`, { waitUntil: 'load', timeout: 60000 });
    await p.page.goBack({ waitUntil: 'load' }); await ready(p);
    const h1 = await hotelBack(p);
    await p.page.reload({ waitUntil: 'load' }); await ready(p);
    const h2 = await hotelBack(p);
    ok(h1 === T.hotel && h2 === T.hotel, '★KA1 ホテルの追加：ほかのページへ行って戻る／読み直す の2つとも、追加の面が打った字のまま戻る', J({ h1, h2 }));
  });
}

/* ════ 場面 clock（KA2）═══════════════════════════════════════ */
async function clock() {
  const K = await kit();
  const { page, go, ready, SURF, same, drafts, restamp, cityIn, hotelType, hotelBack, hotelForm } = K;
  const S = SURF.work, KEY = `pv_contrib_draft:${SLUG}:work`, HKEY = `pv_stay_draft:${SLUG}|${IATA}`;
  const away = (p) => p.page.goto(`${K.base}/terms.html`, { waitUntil: 'load', timeout: 60000 });
  await scene('KA2 月の勤務：31分前の下書きは出ない・残らない／29分前のものは戻る', async () => {
    const p = await page({ who: 'a' });
    await go(p);
    await S.open(p); await S.type(p);
    await p.page.evaluate(() => window.PVContrib.close());
    /* ページを離れてから（離れる時に面が下書きを置き直す）、離れているあいだに時間が経ったことにする → 戻って開く */
    await away(p);
    const has0 = !!(await drafts(p))[KEY];
    await restamp(p, KEY, 31 * MIN);
    await go(p);
    await S.open(p);
    const r31 = await S.read(p), d31 = (await drafts(p))[KEY];
    ok(has0 && r31.block_hours === '' && r31.note === '' && d31 === undefined,
      '★KA2 31分前に打った下書きは、開いても出ない・このタブにも残らない（読んだ所で消える）', J({ has0, r31, d31: d31 && d31.slice(0, 80) }));
    await S.type(p);
    await p.page.evaluate(() => window.PVContrib.close());
    await away(p);
    await restamp(p, KEY, 29 * MIN);
    await go(p);
    await S.open(p);
    const r29 = await S.read(p);
    ok(same(r29, S.want), '★KA2 29分前に打った下書きは、読み直して開くと、打ったとおりに戻る', J(r29));
  });
  await scene('KA2 ホテルの追加：31分前の書きかけは出ない・残らない／29分前のものは戻る', async () => {
    const p = await page({ who: 'a' });
    await go(p, CITY);
    await cityIn(p); await hotelType(p);
    const has0 = !!(await drafts(p))[HKEY];
    await restamp(p, HKEY, 31 * MIN);
    await p.page.reload({ waitUntil: 'load' }); await ready(p);
    await cityIn(p);
    await until(async () => (await hotelForm(p)) !== null, 3000);
    const f31 = await hotelForm(p), d31 = (await drafts(p))[HKEY];
    ok(has0 && f31 === null && d31 === undefined, '★KA2 31分前に打った書きかけは、都市を開いても追加の面に出ない・このタブにも残らない', J({ has0, f31, d31 }));
    await hotelType(p);
    await restamp(p, HKEY, 29 * MIN);
    await p.page.reload({ waitUntil: 'load' }); await ready(p);
    const f29 = await hotelBack(p);
    ok(f29 === T.hotel, '★KA2 29分前に打った書きかけは、読み直すと追加の面が打った字のまま戻る', J(f29));
  });
}

/* ════ 場面 reader（KA3・KA4）════════════════════════════════════ */
async function reader() {
  const K = await kit();
  const { page, go, ready, idle, SURF, same, drafts, fpOf, whereIs, loginVia, closeBoard, logoutVia, cityIn, hotelType, hotelForm, hotelBack } = K;
  const S = SURF.work, KEY = `pv_contrib_draft:${SLUG}:work`, HKEY = `pv_stay_draft:${SLUG}|${IATA}`;
  /* 'a' が月の勤務とホテルの追加に打つ（送らない） */
  const typeBoth = async (p) => {
    await go(p, CITY);
    await cityIn(p); await hotelType(p);
    await S.open(p); await S.type(p);
    await p.page.evaluate(() => window.PVContrib.close());
    const d = await drafts(p);
    if (!d[KEY] || !d[HKEY]) throw new Error('前提が崩れた（2つの下書きが置かれていない）: ' + J(Object.keys(d)));
    return d;
  };
  const after = async (p) => {
    await go(p, CITY);
    await closeBoard(p);
    await cityIn(p);
    await until(async () => (await hotelForm(p)) !== null, 3000);
    const hotel = await hotelForm(p);
    await S.open(p);
    return { work: await S.read(p), hotel, keys: Object.keys(await drafts(p)) };
  };
  await scene('KA3 自動のログアウトのあと、同じタブで別の会員が入る：前の人の下書きは出ない・残らない', async () => {
    const p = await page({ who: 'a' });
    await typeBoth(p);
    const ticks = await idle(p);
    const kept = await drafts(p);
    const atb = await loginVia(p, 'b', CITY);
    const v = await after(p);
    const seen = await whereIs(p, [T.note, T.hotel]);
    ok(ticks >= 2 && !!kept[KEY] && !!kept[HKEY] && atb.endsWith(CITY) && v.work.block_hours === '' && v.work.note === '' && v.hotel === null
      && !v.keys.includes(HKEY) && !v.keys.includes(KEY) && seen.length === 0,
      `★KA3 'a' が打つ → 自動のログアウト → 同じタブの login.html で 'b' が入る → 'a' の月の勤務もホテルの書きかけも出ない・このタブにも残らない（'a' の字は画面にも保存領域にも無い）`,
      J({ ticks, kept: Object.keys(kept), atb, v, seen }));
  });
  await scene('KA4 サイトのログアウト：下書きは全部消え、同じ会員が入り直しても戻らない', async () => {
    const p = await page({ who: 'a' });
    await typeBoth(p);
    const out = await logoutVia(p);
    const left = await drafts(p);
    await loginVia(p, 'a', CITY);
    const v = await after(p);
    ok(out && Object.keys(left).length === 0 && v.work.block_hours === '' && v.work.note === '' && v.hotel === null && v.keys.length === 0,
      '★KA4 profile.html の「ログアウト」を押すと、このタブの下書き（月の勤務・ホテル）が全部消える。同じ \'a\' がすぐ入り直しても戻らない',
      J({ out, left: Object.keys(left), v }));
  });
  await scene('KA4 自動のログアウト：下書きは残り、同じ会員が入り直すと戻る', async () => {
    const p = await page({ who: 'a' });
    const d0 = await typeBoth(p);
    const ticks = await idle(p);
    const kept = await drafts(p), fa = await fpOf(p, 'a');
    let wk = null, hk = null;
    try { wk = JSON.parse(kept[KEY]); hk = JSON.parse(kept[HKEY]); } catch { /* 下で落ちる */ }
    const ata = await loginVia(p, 'a', CITY);
    const v = await after(p);
    ok(ticks >= 2 && kept[KEY] === d0[KEY] && kept[HKEY] === d0[HKEY] && !!wk && wk.by === fa && !!hk && hk.u === M.a.id,
      '★KA4 自動のログアウト（無操作の期限・時計の1回）では、下書きは1文字も変わらずに残る（月の勤務は \'a\' の指紋の印・ホテルは \'a\' の印のまま）',
      J({ ticks, kept: Object.keys(kept), by: wk && wk.by, u: hk && hk.u }));
    ok(ata.endsWith(CITY) && same(v.work, S.want) && v.hotel === T.hotel,
      '★KA4 同じ \'a\' が login.html で入り直すと、月の勤務は打ったとおりに・ホテルの追加の面は打った字のまま戻る', J(v));
  });
}

/* ════ 場面 store（KA5）══════════════════════════════════════ */
const FNP = '/functions/v1/hotel-suggest';   // ホテルの名前の候補の口（KA5 の例外の、ただ1つの行き先）
async function store() {
  const K = await kit();
  const { page, go, SURF, drafts, cityIn, hotelType } = K;
  await scene('KA5 下書きは localStorage に置かない・送るまで通信にも計測にも乗らない（ホテルの名前の候補の口が無いとき ＝ いまの本番）', async () => {
    const p = await page({ who: 'a' });
    await watchSuggest(p.page);
    await go(p, CITY);
    await cityIn(p); await hotelType(p);
    /* 打つのが止まってから送るまでの時計が鳴り終わるまで、焦点を名前の欄に置いたまま待つ（候補の部品が「送るかどうか」を決め終わる） */
    await settleSuggest(p.page);
    for (const key of ['work', 'roster', 'town', 'co']) {
      const S = SURF[key];
      await S.open(p); await S.type(p);
      await p.page.evaluate(() => window.PVContrib.close());
      await K.closed(p);
    }
    const words = [T.note, T.qnote, T.good, T.hotel, T.conote];
    const local = await p.page.evaluate(() => { const o = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o.push([k, localStorage.getItem(k)]); } return o; });
    const lk = local.filter(([k]) => /^pv_(contrib|stay)_draft:/.test(k)).map(([k]) => k);
    const lw = words.filter((w) => local.some(([k, v]) => String(k).includes(w) || String(v).includes(w)));
    const nw = words.filter((w) => p.reqs.some((r) => r.includes(w) || r.includes(encodeURIComponent(w)) || r.includes(JSON.stringify(w).slice(1, -1))));
    /* 計測に渡したもの ＝ ページの dataLayer（gtag はページの頭の台本が dataLayer に積む形で持っている。手元では外へは出ない） */
    const gt = await p.page.evaluate(() => (window.dataLayer || []).map((a) => { try { return JSON.stringify(Array.from(a)); } catch (e) { return String(a); } }));
    const gw = words.filter((w) => gt.some((g) => g.includes(w) || g.includes(JSON.stringify(w).slice(1, -1))));
    const sess = Object.values(await drafts(p)).join('\n');
    const sw = words.filter((w) => sess.includes(w) || sess.includes(JSON.stringify(w).slice(1, -1)));
    ok(lk.length === 0 && lw.length === 0, '★KA5 打ったあいだ、下書きの鍵（pv_contrib_draft:・pv_stay_draft:）も打った字も、localStorage に1つも無い', J({ lk, lw }));
    const pings = p.reqs.filter((r) => r.startsWith(`${K.base}${FNP} `));
    ok(pings.length >= 1 && pings.every((r) => r === `${K.base}${FNP} {"ping":1}`),
      `KA5 ホテルの名前の候補の部品は、先に ping（打った字なし）だけを聞いた（${pings.length}本）── 口が無いので、名前の字は送らない`, J(pings));
    ok(nw.length === 0 && p.reqs.length > 0, `★KA5 送るを押すまで、打った字はどの通信（行き先と中身。${p.reqs.length}本）にも乗らない（候補が出せないあいだは、ホテルの名前も）`, J(nw));
    ok(gw.length === 0 && gt.length > 0, `★KA5 打った字は、計測（gtag の呼び出し ${gt.length}回）にも乗らない`, J(gw));
    ok(sw.length === words.length, '下書きはこのタブ（sessionStorage）には在る（5つの面の字が全部）', J({ missing: words.filter((w) => !sw.includes(w)) }));
  });

  /* ★KA5 の例外：候補が出せるとき（手元の本物の Edge Function と数え札・Google の代わりは、ここで 127.0.0.1 に立てる模擬の Google） */
  const G = { reqs: [] };
  const mock = http.createServer((req, res) => {
    let b = '';
    req.on('data', (c) => { b += c; });
    req.on('end', () => {
      let j = null;
      try { j = JSON.parse(b); } catch { j = null; }
      G.reqs.push({ m: req.method, path: req.url, input: j && j.input });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ suggestions: [{ placePrediction: { placeId: 'ChIJpvKeepTest00001',
        structuredFormat: { mainText: { text: '検査用の候補の店（手元・KA）' }, secondaryText: { text: '検査用の候補の住所（手元・KA）' } } } }] }));
    });
  });
  await new Promise((r) => mock.listen(0, '127.0.0.1', r));
  try {
    const K2 = await kit({ places: { endpoint: `http://127.0.0.1:${mock.address().port}/v1/places:autocomplete`, key: 'pv-keep-test-not-a-real-google-key', timeoutMs: 3000 } });
    await scene('KA5 の例外：候補が出せるとき、出ていくのはホテルの名前の欄の字だけ・このサイトの候補の口へだけ・名もなしで', async () => {
      const p = await K2.page({ who: 'a' });
      await watchSuggest(p.page);
      await K2.go(p, CITY);
      await K2.cityIn(p);
      const NM = `${FM} [data-k="name"]`;
      /* ① 種類がレストランの名前：候補の対象ではない（送らない）。打って、時計が鳴り終わるまで待ち、消してから種類をホテルに */
      await p.page.click(`${ZN} .crs-ent[data-kind="food"]`);
      await p.page.waitForSelector(NM, { visible: true });
      await p.page.focus(NM);
      await p.page.keyboard.type(T.food);
      await settleSuggest(p.page);
      await p.page.$eval(NM, (n) => { n.focus(); n.select(); });
      await p.page.keyboard.press('Backspace');
      await p.page.$eval(`${FM} input[type="radio"][value="hotel"]`, (r) => { (r.closest('label') || r).click(); });
      await p.page.waitForFunction((fm) => { const r = document.querySelector(fm + ' input[type="radio"][value="hotel"]'); return !!r && r.checked; }, { timeout: 10000 }, FM);
      /* ② 住所・ひとことに打つ（どちらも、送るを押すまで出てはいけない字）→ ③ 名前に打つ → 候補が出る */
      for (const [k, v] of [['address', T.haddr], ['note', T.hnote], ['name', T.hotel]]) {
        await p.page.focus(`${FM} [data-k="${k}"]`);
        await p.page.keyboard.type(v);
        await settleSuggest(p.page);
      }
      const shown = await p.page.waitForSelector(`${FM} .pvhs:not([hidden]) .pvhs-o`, { visible: true, timeout: 15000 }).then(() => true, () => false);
      await p.page.keyboard.press('Escape');
      /* ④ ほかの4つの面にも打つ（KA5 と同じ） */
      for (const key of ['work', 'roster', 'town', 'co']) {
        const S = K2.SURF[key];
        await S.open(p); await S.type(p);
        await p.page.evaluate(() => window.PVContrib.close());
        await K2.closed(p);
      }
      await settleSuggest(p.page);

      const FNURL = `${K2.base}${FNP}`;
      const tok = await p.page.evaluate(() => { try { const x = JSON.parse(localStorage.getItem('sb-local-auth-token')); return [x.access_token || '', x.refresh_token || '']; } catch { return ['', '']; } });
      const devk = await p.page.evaluate(() => { try { return localStorage.getItem('pv_stay_key') || ''; } catch { return ''; } });
      const forms = (w) => [w, encodeURIComponent(w), JSON.stringify(w).slice(1, -1)];
      const has = (r, w) => [r.u, r.b, JSON.stringify(r.h)].some((x) => forms(w).some((f) => x.includes(f)));
      const bodyOf = (r) => { try { return JSON.parse(r.b); } catch { return null; } };
      const fnReqs = p.full.filter((r) => r.u === FNURL);
      /* 候補の口へ出た中身：{ ping: 1 } か、{ q: 名前の欄の字（の頭から）, lang, near: 都市 } だけ */
      const shapeBad = fnReqs.filter((r) => {
        const b = bodyOf(r);
        if (r.m !== 'POST' || !b || typeof b !== 'object' || Array.isArray(b)) return true;
        if (J(b) === '{"ping":1}') return false;
        return !Object.keys(b).every((k) => ['q', 'lang', 'near'].includes(k)) || typeof b.q !== 'string' || !b.q || !T.hotel.startsWith(b.q)
          || !['ja', 'en'].includes(b.lang) || ('near' in b && (typeof b.near !== 'string' || [...b.near].length > 40));
      }).map((r) => `${r.m} ${r.u} ${r.b}`);
      const named = fnReqs.filter((r) => { const b = bodyOf(r); return !!b && b.q === T.hotel; });
      const elsewhere = p.full.filter((r) => r.u !== FNURL && has(r, T.hotel)).map((r) => `${r.m} ${r.u}`);
      const gIn = G.reqs.filter((g) => typeof g.input === 'string' && g.input.startsWith(T.hotel));
      ok(shown && named.length >= 1 && gIn.length >= 1 && shapeBad.length === 0 && elsewhere.length === 0,
        `★KA5 の例外 候補が出せるとき、ホテルの名前の欄の字は、このサイトの候補の口（${FNP}）へだけ出る（${fnReqs.length}本）── 中身は { q: 名前, lang, near } か { ping } だけ・ほかの行き先（${p.full.length - fnReqs.length}本）には1本も無い・候補は出た`,
        J({ shown, named: named.length, google: gIn.length, shapeBad, elsewhere }));
      /* 名もなし：見出しは公開の鍵（anon）だけ・ログインの鍵・会員の番号とメール・書きかけの印・端末の控えの鍵は、行き先・中身・見出しのどこにも無い */
      const role = (k) => { try { return JSON.parse(Buffer.from(String(k).split('.')[1], 'base64url').toString('utf8')).role; } catch { return null; } };
      const ids = [tok[0], tok[1], M.a.id, M.a.email, devk, 'pv_stay_draft', 'pv_contrib_draft'].filter(Boolean);
      const notAnon = fnReqs.filter((r) => !(r.h.authorization === `Bearer ${r.h.apikey}` && role(r.h.apikey) === 'anon' && !('cookie' in r.h)
        && !ids.some((x) => [r.u, r.b, JSON.stringify(r.h)].some((y) => y.includes(x))))).map((r) => ({ u: r.u, a: (r.h.authorization || '').slice(0, 24), b: r.b }));
      ok(fnReqs.length >= 2 && !!tok[0] && notAnon.length === 0,
        `★KA5 の例外 候補の口へは名もなし（${fnReqs.length}本）：見出しは公開の鍵（anon）だけ・ログインの鍵・会員の番号とメール・書きかけの印・端末の控えの鍵はどこにも無い`, J(notAnon));
      const others = [T.food, T.haddr, T.hnote, T.note, T.qnote, T.good, T.conote];
      const ow = others.filter((w) => p.full.some((r) => has(r, w)));
      ok(ow.length === 0 && p.full.length > 0,
        `★KA5 の例外 ホテルの名前のほか（レストランの名前・住所・ひとこと・ほかの4つの面）に打った字は、候補が出せるときも、送るを押すまでどの通信（${p.full.length}本）にも乗らない（候補の口へも）`, J(ow));
    });
  } finally {
    await new Promise((r) => mock.close(r));
  }
}

/* ════ 場面 fail（KA6）═══════════════════════════════════════ */
async function failed() {
  const K = await kit();
  const { L, page, go, ready, SURF, same, fields, loginVia, closeBoard } = K;
  const own = async (p) => {
    const on = await p.page.$eval('.pvc-root input[name="own"]', (n) => n.checked);
    if (!on) await p.page.$eval('.pvc-root label.pvc-own', (l) => { l.scrollIntoView({ block: 'center' }); l.click(); });
    await p.page.waitForFunction(() => { const n = document.querySelector('.pvc-root input[name="own"]'); return !!n && n.checked; }, { timeout: 10000 });
  };
  const sendBtn = '.pvc-root form .pvc-send[type="submit"]';
  const msgOf = (p, kind) => p.page.evaluate((k) => { const n = document.querySelector('.pvc-root .pvc-msg[data-pvc-msg="' + k + '"]'); return n ? n.innerText : null; }, kind);
  await scene('KA6 送れなかった：「送れていません」・打った値はそのまま・もう1回押すと保存される', async () => {
    const S = SURF.work;
    const p = await page({ who: 'a' });
    await go(p);
    await S.open(p); await S.type(p); await own(p);
    await L.failNext('submit_work_month');
    await p.page.click(sendBtn);
    await p.page.waitForSelector('.pvc-root .pvc-msg[data-pvc-msg="fail"]', { timeout: 20000 });
    const m = await msgOf(p, 'fail'), v = await S.read(p);
    await p.page.click(sendBtn);
    const saved = await p.page.waitForSelector('.pvc-root [data-pvc-saved]', { timeout: 20000 }).then(() => true, () => false);
    const rows = (await L.q(`select block_hours::float8 as h, note from public.pv_work_months
      where airline = $2::text and proof_hash = public.pv_work_hash($1::uuid, $2::text, null)`, [M.a.id, SLUG]).catch(() => ({ rows: null }))).rows;
    ok(!!m && m.includes(FAIL_T) && same(v, S.want), `★KA6 送れなかった回は「${FAIL_T}」と出て、打った値（職位・乗務時間・ひとこと）が1文字も消えない`, J({ m, v }));
    ok(saved && Array.isArray(rows) && rows.length === 1 && parseFloat(rows[0].h) === 71.5 && rows[0].note === T.note,
      '★KA6 同じ送るボタンをもう1回押すと、その値のまま保存される（保存先に1行）', J({ saved, rows }));
  });
  await scene('KA6 ほかの会社について答えている途中で、ログインがサーバに断られる：入り直すと選んだ答えが戻り、押すと保存される', async () => {
    const S = SURF.co;
    let at = '開く';
    try {
    const p = await page({ who: 'a' });
    await go(p);
    await S.open(p); at = '打つ'; await S.type(p); at = '確認のチェック'; await own(p);
    at = '押す';
    /* 押す直前に、ログインの控えを「サーバが受け取らない・取り直せない」ものに替える（id は読めるまま）＝ 期限が切れて、取り消されたログイン。
       替えるのと押すのは同じ1回の中で（あいだにログインの見回りが入らないように） */
    await p.page.evaluate((sel) => {
      const k = 'sb-local-auth-token', s = JSON.parse(localStorage.getItem(k)), now = Math.floor(Date.now() / 1000);
      s.access_token = 'not-a-valid-token'; s.refresh_token = 'local.00000000-0000-4000-8000-000000000000'; s.expires_at = now - 120; s.expires_in = -120;
      localStorage.setItem(k, JSON.stringify(s));
      document.querySelector(sel).click();
    }, sendBtn);
    /* 住所が login.html になり、読み終わるまで（同じページの中の履歴の動きでは止まらない） */
    const atLogin = await until(async () => /\/login\.html\?/.test(p.page.url()) && (await p.page.evaluate(() => document.readyState).catch(() => '')) === 'complete', 20000);
    if (!atLogin) {
      const why = await p.page.evaluate(() => [...document.querySelectorAll('.pvc-root .pvc-msg')].map((m) => m.getAttribute('data-pvc-msg') + ':' + m.innerText.slice(0, 40))).catch(() => []);
      throw new Error('login.html へ行かない（' + p.page.url().replace(K.base, '') + '・面の知らせ ' + J(why) + '・送った ' + J(p.st.calls.slice(-6)) + '）');
    }
    at = 'login.html で入る（' + p.page.url().replace(K.base, '') + '）';
    await loginVia(p, 'a', PAGE);
    at = '開き直す（' + p.page.url().replace(K.base, '') + '）';
    await closeBoard(p);
    /* 戻ってきたのは、このページの会社の面ではない（?add も付かない）。このページの会社の下書きも作られていない */
    const back = { at: p.page.url().replace(K.base, ''), open: await p.page.evaluate(() => window.PVContrib.isOpen()),
      page: Object.keys(await K.drafts(p)).filter((k) => k.startsWith(`pv_contrib_draft:${SLUG}:`)) };
    await S.open(p);
    const v = await S.read(p), note = await p.page.evaluate(() => { const n = document.querySelector('.pvc-root .pvc-msg[data-pvc-msg="back"]'); return n ? n.innerText : ''; });
    at = '確認のチェック（2回目）';
    await own(p);
    at = '押す（2回目）';
    await p.page.$eval(sendBtn, (b) => b.click());
    const saved = await p.page.waitForSelector('.pvc-root [data-pvc-saved]', { timeout: 20000 }).then(() => true, () => false);
    const rows = (await L.q(`select question_id, answer_code as code from public.airline_conditions
      where airline = $2::text and proof_hash = public.pv_condition_hash($1::uuid, $2::text, null) order by 1`, [M.a.id, CO.airline]).catch(() => ({ rows: null }))).rows;
    ok(atLogin && back.at === '/' + PAGE && back.open === false && back.page.length === 0,
      `★KA6 断られた回は login.html へ行き、入り直すと同じ会社ページへ戻る（?add は付かず、このページの会社の面は開かない・その会社の下書きも作らない）`, J(back));
    ok(same(v, S.want) && note.includes(BACK_T),
      `★KA6 同じ 'a' が開き直すと、ANA について選んだ答えと補足がそのまま戻り「${BACK_T}」と出る`, J({ v, note }));
    ok(saved && Array.isArray(rows) && rows.some((r) => r.question_id === 'days_off_request' && r.code === 'partial'),
      '★KA6 押すと、ANA の答えとして保存される', J({ saved, rows }));
    } catch (e) { throw new Error(at + '：' + String(e && e.message || e).split('\n')[0]); }
  });
}

/* ════ 場面 gone（KA7）═══════════════════════════════════════ */
async function gone() {
  const K = await kit();
  const { L, base, page, go, tickAll, SURF, drafts } = K;
  /* 給与を出した会員 'pay'（その会員としての本物の呼び出し submit_pay_report） */
  const YEAR = (await L.q(`select extract(year from current_date)::int as y`)).rows[0].y - 1;
  const FLEET = JSON.parse(read('pv-vocab.json')).fleets.find((x) => !x.retired).code;
  const filed = await rpcAs(base, 'pay', 'submit_pay_report', { currency: 'USD', lang: 'en', tax_rate_pct: 0, fleet: FLEET,
    position: 'cap', airline: SLUG, period_year: YEAR, period_month: 3, gross_monthly: 9000 });
  ok(filed.body && filed.body.ok === true, `準備：'pay' が ${SLUG} の給与を、その会員としての本物の呼び出しで出した`, J(filed.body));
  const SLOTP = '.crl[data-live="realpay"]';
  const payOpen = async (p) => {
    await p.page.click('.pvg-tabs [data-pvg-tab="pay"]');
    await p.page.waitForFunction((s) => [...document.querySelectorAll(s)].some((e) => e.getClientRects().length && e.getAttribute('data-state') === 'open'), { timeout: 30000 }, SLOTP);
    return p.page.evaluate((s) => [...document.querySelectorAll(s + ' .crl-rows > li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean), SLOTP);
  };
  const slotNow = (p) => p.page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => ({ state: e.getAttribute('data-state'), text: e.textContent.replace(/\s+/g, ' ').trim(),
    login: [...e.querySelectorAll('a')].some((a) => a.textContent.trim() === 'ログイン' && /login\.html/.test(a.getAttribute('href') || '')) })), SLOTP);
  /* その行の字が、ページのどこかに残っているか（ページ全体の字と、要素の属性の値の両方を探す） */
  const leftIn = (p, rows) => p.page.evaluate((rs) => {
    const text = document.documentElement.textContent.replace(/\s+/g, ' ');
    const attrs = [...document.querySelectorAll('*')].flatMap((e) => [...e.attributes].map((a) => a.value)).join('\n').replace(/\s+/g, ' ');
    return rs.filter((r) => text.includes(r) || attrs.includes(r));
  }, rows);
  for (const how of ['same', 'other']) {
    await scene(how === 'same' ? 'KA7 同じタブの自動のログアウト：時計の1回のうちに、REAL PAY の読んだ行がページから消え、ログインの入口が出る・下書きはそのまま'
      : 'KA7 ほかのタブでログインの鍵が消える：このタブに触らなくても、REAL PAY の読んだ行が消え、ログインの入口が出る・下書きはそのまま', async () => {
      const p = await page({ who: 'pay', w: 1440, h: 820 });
      await go(p);
      await SURF.work.open(p); await SURF.work.type(p);
      await p.page.evaluate(() => window.PVContrib.close());
      await K.closed(p);
      const rows = await payOpen(p);
      const d0 = await drafts(p);
      const pre = await leftIn(p, rows);
      if (!rows.length || pre.length !== rows.length || !Object.keys(d0).length) throw new Error('前提が崩れた（REAL PAY の行が出ていない・探し方で見つからない・下書きが無い）: ' + J({ rows, pre, d0: Object.keys(d0) }));
      let first;
      if (how === 'same') {
        first = await p.page.evaluate((s) => {
          window.PVSession.wipe();
          (window.__ticks || []).forEach((f) => { try { f(); } catch (e) { /* 1つ落ちても残りは回す */ } });
          const all = document.documentElement.outerHTML;
          return { open: [...document.querySelectorAll(s)].some((e) => e.getAttribute('data-state') === 'open'), html: all.length };
        }, SLOTP);
      } else {
        /* ほかのタブ（同じ窓）。台本の無い同じ住所の文書で開く ＝ そのタブからは、ほかの通信を1本も出さない */
        const t = await p.ctx.newPage();
        await t.goto(`${base}/pv-vocab.json`, { waitUntil: 'load', timeout: 60000 });
        await t.evaluate(() => { localStorage.removeItem('sb-local-auth-token'); });
        await t.close();
        first = { open: null };
      }
      const cleared = await until(async () => (await leftIn(p, rows)).length === 0, how === 'same' ? 500 : 10000);
      const entry = await until(async () => (await slotNow(p)).some((s) => s.state === 'locked' && s.login && s.text.includes(LOCK_PAY)), 20000);
      const readsOf = () => p.st.got.filter((g) => g.fn === 'pv_pay_rows').map((g) => { try { return JSON.parse(g.text).state; } catch { return null; } });
      await until(async () => readsOf().length >= 2, 10000);
      const reads = readsOf();
      const left = await leftIn(p, rows), d1 = await drafts(p);
      ok(cleared && left.length === 0 && (how === 'other' || first.open === false),
        `★KA7 ${how === 'same' ? '時計の1回のうちに' : 'このタブに触らなくても'}、ログインのあいだに読んだ REAL PAY の行（${rows.length}行）の字は、ページのどこにも無い`, J({ first, left, rows }));
      ok(entry && reads.length >= 2 && reads[0] === 'open' && reads[reads.length - 1] === 'locked',
        `★KA7 REAL PAY の欄は、ログインしていない人として読み直した形（「${LOCK_PAY}」と「ログイン」の入口）になる`, J({ slot: await slotNow(p), reads }));
      ok(JSON.stringify(d1) === JSON.stringify(d0), '★KA7 打ってまだ送っていない下書きは、1文字も変わらない', J({ d0: Object.keys(d0), d1: Object.keys(d1) }));
    });
  }
}

/* ════ 場面 bfcache（KA8）════════════════════════════════════ */
/* 手元のサーバーの前の口：サイトのファイルの no-store だけを GitHub Pages と同じ max-age=600 に替えて渡す（ほかは1字も替えない）。
   serve-local.mjs の no-store のままだと、ブラウザはページを手元に置かない（MainResourceHasCacheControlNoStore）＝ 本番と違う。 */
async function pagesFront(base) {
  const to = new URL(base);
  const srv = http.createServer((req, res) => {
    const up = http.request({ host: '127.0.0.1', port: to.port, path: req.url, method: req.method, headers: { ...req.headers, host: to.host } }, (r) => {
      const h = { ...r.headers };
      if (!/^\/(rest|auth|functions|storage|realtime)\/v1(\/|$)|^\/__local\//.test(req.url) && /no-store/.test(h['cache-control'] || '')) h['cache-control'] = 'max-age=600';
      res.writeHead(r.statusCode, h);
      r.pipe(res);
    });
    up.on('error', () => { res.writeHead(502); res.end(); });
    req.pipe(up);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  if (port === 3000) { srv.close(); throw new Error('3000 番は使わない'); }
  return { base: `http://localhost:${port}`, close: () => new Promise((r) => { srv.close(r); srv.closeAllConnections?.(); }) };
}
async function bfcache() {
  const L = await bring();
  BROUGHT.push(L);
  const fr = await pagesFront(L.base);
  /* 新しい headless（'shell' はこの置き方をしない：BackForwardCacheDisabledForDelegate）。名前を引けるのは localhost と LIBS の4つだけ */
  const bb = await puppeteer.launch({ headless: true, args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE cdn.jsdelivr.net, '
    + 'EXCLUDE fonts.googleapis.com, EXCLUDE fonts.gstatic.com, EXCLUDE cdn.tailwindcss.com'] });
  const base = fr.base, AT = `${base}/${PAGE}`, OFF = '/world-airlines.html';
  const TB = { same: '検査用の戻るで戻る街のひとこと（手元・KA8）', exp: '検査用のログアウト前の街のひとこと（手元・KA8）' };
  const tab = async (noBc) => {
    const ctx = await bb.createBrowserContext();
    const page = await ctx.newPage();
    const st = { blocked: new Set(), supa: new Set(), errs: [] };
    page.setDefaultTimeout(30000);
    await page.setViewport({ width: 1440, height: 820, deviceScaleFactor: 1 });
    page.on('request', (r) => {
      let u; try { u = new URL(r.url()); } catch { return; }
      if (['data:', 'blob:', 'about:'].includes(u.protocol) || u.hostname === 'localhost' || LIBS.test(u.hostname)) return;
      if (/supabase\.(co|in|com)$/.test(u.hostname)) st.supa.add(`${r.method()} ${u.hostname}`); else st.blocked.add(`${r.method()} ${u.hostname}`);
    });
    page.on('pageerror', (e) => st.errs.push(String(e.message).slice(0, 160)));
    page.on('dialog', (x) => { x.accept().catch(() => {}); });
    await page.evaluateOnNewDocument((nb) => {
      window.__ps = [];
      window.addEventListener('pageshow', (e) => { window.__ps.push({ p: e.persisted, t: Date.now() }); });
      try { localStorage.setItem('pv_local_ui', '0'); } catch (e) { /* 保存領域に触れない画面はそのまま */ }
      if (nb) { try { window.BroadcastChannel = undefined; } catch (e) { /* 消せなければそのまま */ } }
    }, !!noBc);
    const p = { ctx, page, st };
    PAGES.push(p);
    return p;
  };
  /* 'a' として入る（open と同じ置き方。Give → Get の板は「さっき見た」）→ そのページ（既定は会社ページ）を開く。
     置くのはいつも会社ページの上 ── マイページはログインしていないと自分で login.html へ移るので、置いている途中で移らないように */
  const seedIn = async (p, at) => {
    const s = await seedOf(L.base, 'a');
    await p.page.goto(AT, { waitUntil: 'load', timeout: 60000 });
    await p.page.evaluate((x) => {
      const now = String(Date.now()), at = Date.parse((x.session.user || {}).last_sign_in_at || '');
      localStorage.setItem('sb-local-auth-token', JSON.stringify(x.session));
      localStorage.setItem('pv_user', JSON.stringify(x.pv_user));
      localStorage.setItem('pv_last_active', now);
      localStorage.setItem('pv_session_start', now);
      localStorage.setItem('pv_give_seen', JSON.stringify({ t: Date.now(), s: String(isNaN(at) ? now : at) }));
    }, s);
    await p.page.goto(at, { waitUntil: 'load', timeout: 60000 });
  };
  const enter = async (p) => {
    await seedIn(p, AT);
    await p.page.waitForFunction(() => !!window.PVContrib && !!window.PVSession, { timeout: 30000 });
  };
  const townIn = (p) => p.page.waitForFunction(() => {
    const r = document.querySelector('.pvc-root');
    if (!r || r.hidden || !r.classList.contains('is-in')) return false;
    const f = r.querySelector('form[data-pvc-form="town"]'), s = f && f.querySelector('fieldset.pvc-set');
    return !!s && !s.disabled;
  }, { timeout: 20000 });
  const townShut = async (p) => {
    await p.page.evaluate(() => window.PVContrib.close());
    await p.page.waitForFunction(() => { const r = document.querySelector('.pvc-root'); return (!r || !r.classList.contains('is-in')) && !(history.state && history.state.pvc); }, { timeout: 20000 });
  };
  const townType = async (p, t) => {
    await p.page.evaluate(() => window.PVContrib.open({ topic: 'town' })); await townIn(p);
    await p.page.$eval('.pvc-root form [name="good"]', (n) => n.focus());
    await p.page.keyboard.type(t);
    await townShut(p);
  };
  const townRead = async (p) => {
    await p.page.evaluate(() => window.PVContrib.open({ topic: 'town' })); await townIn(p);
    const v = await p.page.$eval('.pvc-root form [name="good"]', (n) => n.value);
    await townShut(p);
    return v;
  };
  /* ページの中のリンクを押して移る（人が押すのと同じ、ページから始まる移動） */
  const leave = (p, to) => Promise.all([p.page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }),
    p.page.evaluate((h) => { const a = document.createElement('a'); a.href = h; document.body.appendChild(a); a.click(); }, to)]);
  /* 戻ってきたページが、ブラウザの手元から戻ったか（読み直しなら false）。押した時刻より後の pageshow が届くまで待つ
     （手元から戻ったページには、前に開いた時の pageshow の控えも残っている ＝ 最後の1つが「いまの戻る」のものとは限らない） */
  const lastShow = (p, t0) => p.page.evaluate((t) => {
    const a = window.__ps, x = Array.isArray(a) && a.length ? a[a.length - 1] : null;
    return x && x.t >= t && document.readyState === 'complete' ? x : null;
  }, t0).catch(() => null);
  const backTo = async (p) => {
    const t0 = Date.now();
    await p.page.goBack({ waitUntil: 'load', timeout: 60000 });
    await p.page.waitForFunction((t) => {
      const a = window.__ps;
      return Array.isArray(a) && a.length > 0 && a[a.length - 1].t >= t && !!window.PVContrib;
    }, { timeout: 30000 }, t0);
    return p.page.evaluate(() => window.__ps[window.__ps.length - 1].p === true);
  };
  /* 手元から戻らなかった時の、ブラウザの言い分（読み直したページの notRestoredReasons） */
  const whyNot = (p) => p.page.evaluate(() => {
    try {
      const n = performance.getEntriesByType('navigation')[0], r = n && n.notRestoredReasons;
      const w = []; const walk = (x) => { if (!x) return; (x.reasons || []).forEach((y) => w.push(y.reason || String(y))); (x.children || []).forEach(walk); };
      walk(r);
      return w.length ? w.join(',') : (n ? n.type : '?');
    } catch (e) { return '?'; }
  }).catch(() => '?');
  /* ブラウザが手元から戻さなかった（読み直した）時は、その確かめを最初から新しいタブでやり直す（5回まで）。
     5回とも戻らなければ「確かめられなかった（not proven）」＝ その行は赤（読み直しを「戻った」とは数えない）。 */
  const TRIES = 5;
  const tries = async (fn) => {
    const why = [];
    for (let i = 1; i <= TRIES; i++) {
      const r = await fn(i);
      if (r.restored) return { ...r, tries: i, why };
      why.push(r.why || '?');
    }
    return { restored: false, tries: TRIES, why, proof: `not proven（${TRIES}回とも手元から戻らなかった）` };
  };
  /* やり直した時だけ、1行の知らせ（検査の行ではない。ブラウザがどれだけ読み直したかを後から読めるように） */
  const redo = (tag, r) => { if (r.tries > 1 || !r.restored) console.log(`  ↻ ${tag}：手元から戻るまで ${r.restored ? r.tries : 'ー'} 回（読み直された回の理由：${r.why.join(' / ') || 'ー'}）`); };
  const head = (p) => p.page.evaluate(() => { const b = document.getElementById('nav-auth-btn'); return b ? b.textContent.trim() : null; });
  const town = (p) => p.page.evaluate(() => { const o = {}; for (const k of Object.keys(sessionStorage)) if (/^pv_contrib_draft:/.test(k)) o[k] = sessionStorage.getItem(k); return o; });
  try {
    await scene('KA8 戻るでそのまま戻ったページ（同じ会員のまま・ほかのページで自動のログアウト）', async () => {
      /* ① 'a' として入り、街のひとことを打って、ほかのページへ行って「戻る」 */
      const r1 = await tries(async () => {
        const p = await tab(false);
        await enter(p);
        const named = await head(p);
        await townType(p, TB.same);
        await leave(p, OFF);
        if (!(await backTo(p))) return { restored: false, why: await whyNot(p) };
        return { restored: true, p, named, good: await townRead(p) };
      });
      redo('KA8 ①', r1);
      ok(r1.restored && r1.good === TB.same && r1.named === '会員A',
        '★KA8 ① 同じ \'a\' のまま、ほかのページへ行って「戻る」で手元から戻ったページ（pageshow の persisted）：開き直した街の面に、打ったひとことがそのまま',
        J({ restored: r1.restored, tries: r1.tries, good: r1.good, named: r1.named, why: r1.why, proof: r1.proof }));
      /* ② 'a' の下書きがあるページから、ほかのページで自動のログアウト →「戻る」。1回目は ① のタブの続き。
         やり直しは新しいタブで、① の手前（'a' で入って打つ）まで作り直す */
      const r2 = await tries(async (i) => {
        let p = i === 1 && r1.restored ? r1.p : null;
        if (!p) { p = await tab(false); await enter(p); await townType(p, TB.same); }
        const d0 = await town(p);
        await leave(p, OFF);
        await p.page.evaluate(() => window.PVSession.wipe());
        if (!(await backTo(p))) return { restored: false, why: await whyNot(p) };
        const h = await head(p), v = await townRead(p), d1 = await town(p);
        return { restored: true, h, v, d0, d1, mine: Object.values(d1).some((x) => x.includes(TB.same) && x.includes('"by":"m:')) };
      });
      redo('KA8 ②', r2);
      ok(r2.restored && r2.v === '' && r2.h === 'ログイン',
        '★KA8 ② ほかのページで自動のログアウトを迎えて「戻る」（手元から戻る）：開き直した街の面に \'a\' の字は出ない・右上は「ログイン」',
        J({ restored: r2.restored, tries: r2.tries, good: r2.v, head: r2.h, why: r2.why, proof: r2.proof }));
      ok(r2.restored && JSON.stringify(r2.d1) === JSON.stringify(r2.d0) && r2.mine,
        '★KA8 ② そのとき、\'a\' の下書きはこのタブに \'a\' の印のまま1文字も変わらずに残る（自動のログアウトでは消さない・WP-keep-1 のまま）',
        J({ d0: Object.keys(r2.d0 || {}), d1: Object.keys(r2.d1 || {}), mine: r2.mine, tries: r2.tries, proof: r2.proof }));
    });
    await scene('KA8 サイトのログアウトのあと「戻る」で、ページを捨てないブラウザ', async () => {
      const r = await tries(async () => {
        const p = await tab(true);
        await enter(p);
        await townType(p, TB.exp);
        await leave(p, '/profile.html');
        await p.page.waitForSelector('.btn-logout', { visible: true, timeout: 30000 });
        await Promise.all([p.page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), p.page.click('.btn-logout')]);
        await p.page.goBack({ waitUntil: 'load', timeout: 60000 });
        /* マイページは、ログインしていない人の道（login.html）へ移る。着いてから、もう1回「戻る」 */
        await p.page.waitForFunction(() => /\/login\.html$/.test(location.pathname) && document.readyState === 'complete', { timeout: 30000 });
        if (!(await backTo(p))) return { restored: false, why: await whyNot(p) };
        const h = await head(p), v = await townRead(p);
        await leave(p, OFF);
        const left = await town(p);
        return { restored: true, h, v, left, seen: Object.values(left).some((x) => x.includes(TB.exp)) };
      });
      redo('KA8 ③', r);
      ok(r.restored && r.v === '' && r.h === 'ログイン' && !r.seen && Object.keys(r.left).length === 0,
        '★KA8 ③ profile.html の「ログアウト」→「戻る」2回で手元から戻ったページ：開き直した街の面に \'a\' の字は出ない・右上は「ログイン」・離れても下書きを置き直さない',
        J({ restored: r.restored, tries: r.tries, good: r.v, head: r.h, left: Object.keys(r.left || {}), why: r.why, proof: r.proof }));
    });
    /* ④ 別の会員が入ったあと、前の会員のマイページへ「戻る」（日英）。'a' のマイページ → ほかのページで自動のログアウト →
       login.html で 'b' がコードで入る →「戻る」の一覧から 'a' のマイページを選ぶ（ブラウザの履歴をたどる移動 ＝ 長押しの「戻る」）。
       ログインの知らせ（BroadcastChannel）が来てもページを捨てないブラウザを、③ と同じくその窓口を外して作る。
       戻った瞬間の画面は、ページ自身の pageshow のあとに足した控え（このタブの sessionStorage）で読む ── 読み直しで消えないため。 */
    for (const lang of ['', 'en/']) {
      await scene(`KA8 別の会員が入ったあと「戻る」で、前の会員のマイページ（${lang ? 'en' : 'ja'}）`, async () => {
        const PROF = `/${lang}profile.html`, ELSE = `/${lang}world-airlines.html`, A = M.a, B = M.b;
        const seeOf = (p, x) => p.page.evaluate((y) => {
          const t = ((document.body && document.body.innerText) || '') + '\n' + [...document.querySelectorAll('input,textarea')].map((n) => n.value).join('\n');
          return { path: location.pathname, b: t.includes(y.bm), aName: t.includes(y.an), aMail: t.includes(y.am) };
        }, x).catch(() => null);
        const want = { bm: B.email, an: A.ja, am: A.email };
        const r = await tries(async () => {
          const p = await tab(true);
          await seedIn(p, `${base}${PROF}`);
          const pre = await p.page.waitForFunction((n, m) => Array.isArray(window.__ps) && window.__ps.length > 0
            && !!document.body && document.body.innerText.includes(n) && document.body.innerText.includes(m), { timeout: 30000 }, A.ja, A.email)
            .then(() => true, () => false);
          await p.page.evaluate((n, m) => {
            window.addEventListener('pageshow', (e) => {
              const t = ((document.body && document.body.innerText) || '') + '\n' + [...document.querySelectorAll('input,textarea')].map((x) => x.value).join('\n');
              try { sessionStorage.setItem('ka8-other', JSON.stringify({ at: Date.now(), persisted: e.persisted, name: t.includes(n), mail: t.includes(m) })); } catch (x) { /* 控えられなければ確かめられない */ }
            });
          }, A.ja, A.email);
          await leave(p, ELSE);
          await p.page.evaluate(() => window.PVSession.wipe());
          await leave(p, 'login.html?redirect=world-airlines.html');
          await p.page.click('button[onclick="showEmailStep()"]');
          await p.page.waitForSelector('#otp-email', { visible: true });
          await p.page.type('#otp-email', B.email);
          await p.page.click('#otp-send-btn');
          await p.page.waitForSelector('#otp-code', { visible: true });
          await Promise.all([p.page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), p.page.type('#otp-code', OTP)]);
          const who = await p.page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('pv_user') || 'null') || {}).id || null; } catch (e) { return null; } });
          const cdp = await p.page.createCDPSession();
          const h = await cdp.send('Page.getNavigationHistory');
          const ent = h.entries.slice(0, h.currentIndex).filter((x) => { try { return new URL(x.url).pathname === PROF; } catch { return false; } }).pop();
          if (!ent) { await cdp.detach().catch(() => {}); return { restored: false, why: 'no My Page in the history' }; }
          const t0 = Date.now();
          await cdp.send('Page.navigateToHistoryEntry', { entryId: ent.id });
          await cdp.detach().catch(() => {});
          /* 手元から戻ったページだけが控えを書く（読み直しで来たページには控えの仕掛けが無い）。控えが出るか、控えの無いまま
             読み直したページが開き切るまで待つ（戻ったページが自分で読み直しても、控えはこのタブに残る） */
          const rec = () => p.page.evaluate(() => { try { return JSON.parse(sessionStorage.getItem('ka8-other') || 'null'); } catch (e) { return null; } }).catch(() => null);
          let at = null;
          await until(async () => {
            const s = await rec();
            if (s && s.at >= t0) { at = s; return true; }
            const l = await lastShow(p, t0);
            return !!l && l.p === false && !(await rec());
          }, 30000);
          if (!at || !at.persisted) return { restored: false, why: await whyNot(p) };
          /* 着いた先が落ち着くまで（'b' のメールが出る）。出なければ、そのままを読む */
          await until(async () => { const s = await seeOf(p, want); return !!s && s.b; }, 30000);
          return { restored: true, pre, who, at, end: await seeOf(p, want) };
        });
        redo(`KA8 ④（${lang ? 'en' : 'ja'}）`, r);
        const e = r.end || {};
        ok(r.restored && r.pre && r.who === B.id && !r.at.name && !r.at.mail,
          `★KA8 ④ 'b' が入ったあと「戻る」で手元から戻った 'a' のマイページ（${lang ? 'en' : 'ja'}・pageshow の persisted）：戻った瞬間（ページ自身の pageshow のあと）、'a' の名前もメールも画面に無い`,
          J({ restored: r.restored, tries: r.tries, before: r.pre, live: r.who, at: r.at, why: r.why, proof: r.proof }));
        ok(r.restored && e.path === PROF && e.b && !e.aName && !e.aMail,
          `★KA8 ④ そのあと着いたマイページ（${lang ? 'en' : 'ja'}）は 'b' のもの（'b' のメールが出る・'a' の名前もメールもどこにも無い）`,
          J({ restored: r.restored, end: r.end, proof: r.proof }));
      });
    }
  } finally {
    await bb.close().catch(() => {});
    await fr.close();
  }
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
const blocked = PAGES.flatMap((p) => [...p.st.blocked]), supa = PAGES.flatMap((p) => [...p.st.supa]), errs = PAGES.flatMap((p) => p.st.errs);
console.log('');
ok(PAGES.length > 0 && blocked.length === 0 && supa.length === 0,
  `★どのページ（${PAGES.length}枚）の st.blocked と st.supa も空 ── 手元と書体・部品の配信元のほかへ、1本も投げていない`, J({ blocked, supa }));
ok(errs.length === 0, '★どのページにも、スクリプトの止まり（pageerror）が無い', J(errs));
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exitCode = fail ? 1 : 0;
