/* assert-stays.mjs — 就航地の「ホテル」の欄（career-stay.js ⇄ db/stays.sql）を、手元の本物の保存先につないで歩く（2026-10-16）。

   画面だけの検査（assert-airline-glance.mjs の stay ほか）は、サーバーの返事を作り物で返している。
   ここでは serve-local.mjs の使い捨ての保存先に本物の SQL を流し、画面とブラウザの外からの呼び出しの両方で確かめる。

   場面 chain（S1〜S7）
     S1  ログインしていない人は、ホテルが在っても locked の1行だけを受け取る
         （返事は {"ok":true,"state":"locked"} そのもの・名前は返事にも画面にも保存領域にも無い・鍵の1行と「ログイン」）。
     S2  ログインせずに「ホテルを追加」→ 名前 → 送る：保存される・端末の鍵が返る・「あなたの投稿」「確認待ち」が出る・
         運営（オーナー 'op'）の待ち行列が1つ増える。会員 'a' と給与を出した人 'pay' は locked のまま
         （'pay' は鍵の1行と確認の入口「画像を選んで提出する」だけ）。承認された人 'pilot' にも、確認前の他人の行は返らない。
     S2b ほかのログインなしの人が、公開済みのホテルと同じ名前を送る：保存され、在ることは言わない。運営が通すと exists。
     S2c オーナーではない運営（この保存先の中だけで 'c' を運営の名簿に入れる）：待ち行列は1つ増えて見えるが、一覧は locked。
     S3  運営が通す：承認された人 'pilot' に届く。'a'・'pay'・ほかのログインなしの人は locked のまま。送った人の札から「確認待ち」が消える。
     S4  給与の鍵は、期限が切れていても生きていても何も開かない。承認された人の承認をオーナーが取り消すと
         （本物の口 pv_stay_viewer_decide）、読み直した時から locked。開いているあいだ、保存領域にホテルの名前は無い。
         取り消された人は申し込みの行から承認された人なので、決める口では承認し直せない（no_image・P12.51）。
         もう一度申請し（画像はその場で描いた FIXTURE）、オーナーが画像の面の口で verified にすると、また開く。
     S5  つながっていない（この保存先の中で pv_stays と pv_stay_add を消す）→「準備中」・入口の3つ・押しても「準備中」・面は開かない。
     S6  読めなかった →「読み込めませんでした」＋「もう一度」→ 押すとやり直せる。
     S7  10秒以内の2つめ →「続けて追加するときは、少し時間をあけてください。」・打った字は面に残る。
     S7c （P12.56 B6）その開き直し（390×680 と 1440×820）で、検査が画面を送らなくても、戻した面の最初の欄（種類）と名前の欄が
         画面の中に在る（ページが自分で寄せる）・焦点は面に入らない。
     S7b （P12.54）同じ人が確認待ちを20件まで足し（本物の口・端末の鍵）、書きかけを残したまま 390×680 で開き直す →
         面は自分の分の列より上・ホテルの欄（鍵の1行）まで下りた最初の画面に、面の最初の欄（種類）と名前の欄が在る（上に何も重なっていない）。
     終わりに：どのページも、手元と書体・部品の配信元のほかへ、1本も投げていない（st.blocked・st.supa が空）。

   場面 two（S8・S8b）・login（S9）・kept（S10）・career（S11）── どれも自分の使い捨ての保存先を持つ（chain の S5 が関数を消すため）
     S8  会員 'a' がログインしたまま足す → サイトのログアウト（profile.html の「ログアウト」）→ 札も名前も残らない。
         別の窓の会員 'b' には何も無い。'a' がまた入ると札が戻る。オーナーが承認した2人目 'c'
         （申し込みの行が無いうちは決める口で承認できない ── not_found・申し込んだだけでも決める口では承認されない ── no_image。
         申請の画像を見て verified にする）の開いた一覧は、ほかのタブでログアウトすると鍵の1行に戻る。
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
     2人目の 'c' は、その会員としての本物の呼び出し pv_stay_viewer_request と pv_stay_apply、オーナー 'op' としての
     pv_stay_viewer_verify（画像の面の道 via applicant）で作る（画面は申し込みの口を呼ばない。その行には必ずそう書く）。
     ★2026-10-17（P12.51）から、申し込んだことのある人は決める口（pv_stay_viewer_decide）では承認されない（no_image）。
       申請の画像は、その場で空のタブのキャンバスに描いた FIXTURE だけ（本物の画像は使わない・ファイルも作らない）。
   ★給与を出した人 'pay' は、その会員としての本物の呼び出し（submit_pay_report）で作る
     （手元の給与フォームから出せるかの下調べが無いため。その行には必ずそう書く）。

   場面 suggest（S12）── ホテルの名前の候補（pv-hotel-suggest.js ⇄ supabase/functions/hotel-suggest ⇄ db/hotel-suggest.sql。2026-10-18 オーナー V7）
     Google の代わりに、この検査が 127.0.0.1 に立てた模擬の Google（鍵は作り物の字）。手元の保存先の口 /functions/v1/hotel-suggest は
     本物の Edge Function をそのまま動かし、数え札は本物の SQL（serve-local.mjs の fnCall）。
     S12a ログインなしで「ホテルを追加」→ 名前に1字では送らない・2字で1本 → 候補（名前・住所）と「Google Maps」→ 矢印と Enter で選ぶ →
          名前と地図の欄に入る（住所の欄は空のまま・Enter で送られない・書きかけに残る）→「追加する」→ 保存先に地図のリンクつきの1行。
     S12b 390 の指で選ぶ。
     S12c ★止まっている（数え札が 10,000）→ ping が「出せない」と答える → 打った字は「追加する」まで、どの通信にも乗らない・候補は出ない・
          欄はただの欄・Google へは0本 → 名前を打って「追加する」で保存される。
     S12d ★つながっていない（鍵が無い）→ 同じく、打った字はどの通信にも乗らない・ただの欄・数え札は進まない・Google へ0本。
     S12e Google が失敗 → ただの欄・送った1回は数える。
     （打った字を送るかどうかは「打つのが止まってから」決まるので、確かめは local-chain.mjs の settleSuggest で、その時計が鳴り終わるまで
       焦点を欄に置いたまま待ってから読む ── 時間では待たない）
     S12f 管理ページの「追加」のホテル（日本語 1440・英語 390、オーナー 'op'）でも、同じ候補が出て、選ぶと名前と地図の欄に入る。
     ★作り物の鍵の字は、どのページの返事・画面・保存領域にも無い。模擬の Google が受け取ったのは places:autocomplete だけ。
     ★管理ページでも、候補の口へは名もなし（見出しは公開の鍵だけ・オーナーのログインの鍵は付けない）。

   実行: node assert-stays.mjs [--scenes chain,two,login,kept,career,suggest] [--only <会社>]（既定：全部の場面・jal。career は etihad の NRT）
*/
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEMBERS, OTP } from './serve-local.mjs';
import { LIBS, bring, open, rpcAs, watchSuggest, settleSuggest } from './local-chain.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? ' ' + e : ''))); };
const J = (v) => { try { return JSON.stringify(v).slice(0, 400); } catch { return String(v); } };

/* 画面の字（career-stay.js の T・SAY_ADD と同じ字。ここで字を固定する） */
const LOCK = 'Only VERIFIED PILOT', LOGIN = 'ログイン';
/* 会員（ログインの鍵が在る人）の鍵の1行に添える、確認のポップアップへの入口（2026-10-18 オーナー Q2。pv-proof-offer.js の T.pick と同じ字）。
   まだ画像を出していない会員の欄は「鍵の1行＋この入口」。ポップアップそのもの・ホテルの追加から開かないことは assert-proof-offer.mjs の場面6が見る。 */
const PICK = '画像を選んで提出する';
const MINE = 'あなたの投稿', PENDING = '確認待ち';
const ADDED = '追加しました。確認のあと公開されます。';
const OFF = '準備中', ERR = '読み込めませんでした', RETRY = 'もう一度';
const FAST = '続けて追加するときは、少し時間をあけてください。', EXISTS = '同じ名前が、もう登録されています。';
const ENTS = 'hotel ホテルを追加 ／ food レストランを追加 ／ spot 場所を追加';
const LOCKED = '{"ok":true,"state":"locked"}';
/* ★給与を出した人の作り方（下調べが無いあいだの手）。'pay' の結果の行には、どれにもこれを付ける */
const BYCALL = '（給与提出者は、その会員としての本物の呼び出し submit_pay_report で作った）';

/* ★見てよい2人目の作り方。'c' の承認の行には、どれにもこれを付ける */
const BYVIEW = "（見てよい2人目 'c' は、その会員としての本物の呼び出し pv_stay_viewer_request と pv_stay_apply（申請の画像はその場で描いた FIXTURE）、オーナー 'op' としての pv_stay_viewer_verify（画像の面の道）で作った）";
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
const SCENES = { chain, two, login, kept, career, suggest };
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
async function kit(W, o = {}) {
  const L = await bring(o);
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
      proof: [...e.querySelectorAll('[data-crs-proof]')].map((x) => x.getAttribute('data-crs-proof')).join(','),
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

/* 申請の画像（P12.51 から、申し込んだことのある人は画像の面からしか見てよい人にならない）。
   ★その場で空のタブ（about:blank・どこにも通信しない）のキャンバスに描いた FIXTURE だけ
     （本物の画像は使わない・ファイルも作らない ── assert-towns.mjs の AD7 と同じ絵）。 */
let FIXTURE_B64 = null;
async function fixtureImage() {
  if (FIXTURE_B64) return FIXTURE_B64;
  const tab = await browser.newPage();
  try {
    FIXTURE_B64 = await tab.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 480; c.height = 240;
      const g = c.getContext('2d');
      g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 480, 240);
      g.fillStyle = '#1b1b1b'; g.font = 'bold 64px sans-serif'; g.fillText('FIXTURE', 92, 140);
      return c.toDataURL('image/jpeg', 0.85).split(',')[1];
    });
  } finally { await tab.close(); }
  return FIXTURE_B64;
}

/* オーナーが見てよい2人目を決める。まず申し込みの行が無いまま決める口で承認させて、not_found で断られることを見る。
   それから、その会員が本物の口で申し込む（画面はこの口を呼ばない）。★P12.51 から、申し込んだことのある人は決める口では
   承認されない（no_image・名簿は変わらない）。そこで、その会員が本物の口で申請し（画像は FIXTURE）、オーナーが画像の面の
   本物の口（verified の via applicant）で承認する。開いた返事を返す。 */
async function approve(K, who, tag) {
  const id = M[who].id;
  const d0 = await rpcAs(K.base, 'op', 'pv_stay_viewer_decide', { id, state: 'approved' });
  const n0 = (await K.L.q(`select count(*)::int as n from public.pv_stay_viewers where user_id = $1`, [id])).rows[0].n;
  const r0 = await K.stays(who);
  ok(d0.body && d0.body.ok === false && d0.body.status === 'not_found' && n0 === 0 && K.isLockedBytes(r0),
    `★${tag} 申し込みの行が無い会員 '${who}' をオーナー 'op' が承認しようとすると not_found（名簿に何も書かない）・'${who}' への返事は ${LOCKED} のまま`,
    J({ decide: d0.body, rows: n0, r0: r0.text }));
  const rowOf = async () => (await K.L.q(`select state, decided_by::text as by, asked_at::text as at from public.pv_stay_viewers where user_id = $1`, [id])).rows[0];
  const rq = await rpcAs(K.base, who, 'pv_stay_viewer_request', { ask: true });
  const r1 = await K.stays(who);
  const rowQ = await rowOf();
  const d1 = await rpcAs(K.base, 'op', 'pv_stay_viewer_decide', { id, state: 'approved' });
  const rowD = await rowOf();
  const rD = await K.stays(who);
  ok(rq.body && rq.body.ok === true && rq.body.state === 'pending' && K.isLockedBytes(r1)
    && d1.body && d1.body.ok === false && d1.body.status === 'no_image' && !!rowQ && rowQ.state === 'pending' && J(rowD) === J(rowQ)
    && K.isLockedBytes(rD),
    `★${tag} '${who}' が申し込みの口で申し込んだだけでは ${LOCKED} のまま・オーナー 'op' が決める口（pv_stay_viewer_decide）で承認しようとしても no_image（P12.51：申し込んだことのある人は画像の面からだけ）・名簿は1文字も変わらない`,
    J({ request: rq.body, r1: r1.text, decide: d1.body, rowQ, rowD, rD: rD.text }));
  const ap = await rpcAs(K.base, who, 'pv_stay_apply', { image: await fixtureImage() });
  const vf = await rpcAs(K.base, 'op', 'pv_stay_viewer_verify', { id, state: 'approved', via: 'applicant' });
  const row = await rowOf();
  const img = (await K.L.q(`select count(*)::int as n from public.pv_proof_images where user_id = $1`, [id])).rows[0].n;
  const r2 = await K.stays(who);
  ok(ap.body && ap.body.ok === true && ap.body.state === 'offered'
    && vf.body && vf.body.ok === true && vf.body.state === 'approved' && vf.body.discarded === 1 && img === 0
    && row && row.state === 'approved' && row.by === M.op.id
    && r2.body && r2.body.ok === true && r2.body.state === 'open',
    `準備：'${who}' が申請し（画像は FIXTURE）、オーナー 'op' が画像の面の口で verified にした（決めた人は 'op'・画像はその場で消えた）── そこから一覧が開く${BYVIEW}`,
    J({ apply: ap.body, verify: vf.body, row, img, r2: r2.body && r2.body.state }));
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
    ok(pr && pv.state === 'locked' && pv.who === 'member' && pv.text === LOCK + PICK && pv.proof === 'none' && pv.entry.length === 0 && pseen.length === 0
      && replies(pp, 'pv_stays').length >= 1 && replies(pp, 'pv_stays').every(isLockedBytes),
      `★S2 給与提出者 'pay' の画面は、鍵の1行「${LOCK}」と確認の入口「${PICK}」だけ（ログインの入口なし・どの名前も返事・画面・保存領域に無い）${BYCALL}`, J({ pv, pseen }));
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
    ok(pr && isLockedBytes(rx) && norm(rx.text) === norm(ra.text) && pv.state === 'locked' && pv.who === 'member' && pv.text === LOCK + PICK && pv.proof === 'none'
      && (await whereIs(pp, [PUB, GUEST])).length === 0,
      `★S4 給与の鍵の期限が切れた 'pay'：返事は会員 'a' と同じ ${LOCKED}・画面は鍵の1行と確認の入口「${PICK}」だけ${BYCALL}`, J({ rx: rx.text, pv }));
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
    ok(r2 && after.length >= 1 && after.every(isLockedBytes) && v2.state === 'locked' && v2.who === 'member' && v2.text === LOCK + PICK && v2.proof === 'none'
      && seen2.filter((s) => !s.startsWith('返事')).length === 0,
      `★S4 承認を取り消された 'pilot' が読み直すと、返事は ${LOCKED} そのもの・画面は鍵の1行と確認の入口「${PICK}」だけ（名前は画面にも保存領域にも無い）`,
      J({ after: after.map((r) => r.text), v2, seen2 }));
    await shut(vp);
    /* ★P12.51: 'pilot' は申し込みの行から承認された人（手元の模擬は申し込んだ時刻つきの行）＝申し込んだことのある人。
         決める口では承認し直せない（no_image・名簿は変わらない）。戻す道は画像の面：'pilot' が本物の口で申請し（画像は FIXTURE）、
         オーナーがその面の本物の口（verified の via applicant）で承認する */
    const pRow = async () => (await L.q(`select state, decided_by::text as by, decided_at::text as at from public.pv_stay_viewers where user_id = $1`, [M.pilot.id])).rows[0];
    const row0 = await pRow();
    const ba = await rpcAs(base, 'op', 'pv_stay_viewer_decide', { id: M.pilot.id, state: 'approved' });
    const row1 = await pRow(), rn = await stays('pilot');
    ok(ba.body && ba.body.ok === false && ba.body.status === 'no_image' && !!row0 && row0.state === 'revoked' && J(row1) === J(row0) && isLockedBytes(rn),
      `★S4 取り消された 'pilot'（申し込みの行から承認された人）を、オーナー 'op' が決める口で承認し直そうとしても no_image（P12.51）・名簿は1文字も変わらない・返事は ${LOCKED} のまま`,
      J({ decide: ba.body, row0, row1, rn: rn.text }));
    const sApply = await rpcAs(base, 'pilot', 'pv_stay_apply', { image: await fixtureImage() });
    const sVerify = await rpcAs(base, 'op', 'pv_stay_viewer_verify', { id: M.pilot.id, state: 'approved', via: 'applicant' });
    const rb = await stays('pilot');
    ok(sApply.body && sApply.body.ok === true && sApply.body.state === 'offered' && sVerify.body && sVerify.body.ok === true && sVerify.body.state === 'approved'
      && rb.body && rb.body.state === 'open' && namesOf(rb).includes(PUB),
      `S4 'pilot' がもう一度申請し（画像は FIXTURE）、オーナー 'op' が画像の面の口（pv_stay_viewer_verify・via applicant）で承認し直すと、'pilot' の一覧はまた開く`,
      J({ apply: sApply.body, verify: sVerify.body, names: namesOf(rb) }));
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
  await scene('S7 10秒以内の2つめ', async () => {
    const g = await page({});
    const ready = await visit(g);
    const a1 = await addVia(g, NEXT1);
    ok(ready && a1.reply && a1.reply.ok === true && a1.v.say === ADDED, `準備：ログインなしで1つ足した（「${ADDED}」）`, J({ reply: a1.reply, say: a1.v.say }));
    const a2 = await addVia(g, NEXT2);
    ok(a2.reply && a2.reply.ok === false && a2.reply.status === 'too_fast' && a2.v.form === true && a2.v.fsay === FAST && a2.v.fname === NEXT2,
      `S7 10秒以内の2つめは「${FAST}」と言い、打った名前は面に残る`, J({ reply: a2.reply, form: a2.v.form, fsay: a2.v.fsay, fname: a2.v.fname }));
    ok((await rowsOf(NEXT2)).length === 0 && n(g, 'pv_stay_add') === 2, `S7 2つめは保存されていない（送ったのは2本）`, J({ rows: await rowsOf(NEXT2), sent: n(g, 'pv_stay_add') }));

    /* ── S7b（P12.54）：確認待ちを20件足した人が、書きかけの面を残したまま 390 で開き直す。面は自分の分の列より上 ＝ 面の最初の欄
       （種類）と名前の欄が、開いた最初の画面に在る。20件は、この端末の鍵での本物の追加の口（pv_stay_add）で足す
       （連投の10秒は、この使い捨ての保存先の中だけで、足した時刻を前へずらして越える）。 */
    const gk = await g.page.evaluate(() => { try { return localStorage.getItem('pv_stay_key'); } catch { return null; } });
    const more = [];
    for (let i = 2; i <= 20; i++) {
      await L.q(`update public.pv_stay_places set created_at = created_at - interval '11 seconds' where author_hash = public.pv_stay_key_hash($1)`, [gk]);
      const r = await rpcAs(base, null, 'pv_stay_add', { airline: SLUG, iata: IATA, kind: 'hotel', name: `検査用の確認待ち ${i}（手元）`, key: gk });
      more.push(r.body && r.body.ok === true ? 'ok' : (r.body && r.body.status) || r.status);
    }
    if (!more.every((x) => x === 'ok')) throw new Error('前提が崩れた（20件まで足せない）: ' + J(more));
    await g.page.setViewport({ width: 390, height: 680, deviceScaleFactor: 1 });
    await g.page.goto('about:blank');
    await g.page.goto(K.URL_, { waitUntil: 'load', timeout: 60000 });
    const back = (await settled(g)) && (await g.page.waitForFunction((fm, nm) => { const i = document.querySelector(fm + ' [data-k="name"]'); return !!i && i.value === nm; },
      { timeout: 20000 }, K.FM, NEXT2).then(() => true, () => false));
    const firstScreen = () => g.page.evaluate((zn, fm) => {
      const z = document.querySelector(zn), f = document.querySelector(fm), ul = z && z.querySelector('.crs-own');
      const box = (n) => { if (!n) return null; const r = n.getBoundingClientRect(), at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), in: r.height > 0 && r.top >= 0 && r.bottom <= innerHeight, onTop: !!at && n.contains(at) }; };
      const kind = box(f && f.querySelector('.crs-kinds')), name = box(f && f.querySelector('[data-k="name"]')), own = ul ? ul.getBoundingClientRect() : null;
      return { own: ul ? ul.querySelectorAll('.crs-card').length : 0, kind, name, formBottom: f ? Math.round(f.getBoundingClientRect().bottom) : null,
        ownTop: own ? Math.round(own.top) : null, y: Math.round(scrollY), ih: innerHeight,
        ok: !!(f && kind && name && kind.in && kind.onTop && name.in && name.onTop && own && f.getBoundingClientRect().bottom <= own.top) };
    }, K.ZN, K.FM);
    /* ── S7c（P12.56 B6）：開き直したまま（検査は送らない）── 書きかけを戻した面は、ページが自分で画面へ寄せる。焦点は取らない。
       幅の広い 1440×820 でも、同じく開き直して確かめる。 */
    const noFocus = () => g.page.evaluate((fm) => { const f = document.querySelector(fm); return !!f && !f.contains(document.activeElement); }, K.FM);
    const near390 = await until(async () => (await firstScreen()).ok, 8000);
    const fs7c = await firstScreen(), nf390 = await noFocus();
    await g.page.setViewport({ width: 1440, height: 820, deviceScaleFactor: 1 });
    await g.page.goto('about:blank');
    await g.page.goto(K.URL_, { waitUntil: 'load', timeout: 60000 });
    const back1440 = (await settled(g)) && (await g.page.waitForFunction((fm, nm) => { const i = document.querySelector(fm + ' [data-k="name"]'); return !!i && i.value === nm; },
      { timeout: 20000 }, K.FM, NEXT2).then(() => true, () => false));
    const near1440 = await until(async () => (await firstScreen()).ok, 8000);
    const fs1440 = await firstScreen(), nf1440 = await noFocus();
    ok(back && near390 && fs7c.ok && nf390 && back1440 && near1440 && fs1440.ok && nf1440,
      `S7c 書きかけを戻して開き直した 390×680 と 1440×820：検査が送らなくても、面の最初の欄（種類）と名前の欄が画面の中に在る・焦点は面に入らない（P12.56）`,
      J({ at390: { y: fs7c.y, kind: fs7c.kind, name: fs7c.name, noFocus: nf390 }, at1440: { y: fs1440.y, kind: fs1440.kind, name: fs1440.name, noFocus: nf1440 } }));
    await g.page.setViewport({ width: 390, height: 680, deviceScaleFactor: 1 });
    await g.page.goto('about:blank');
    await g.page.goto(K.URL_, { waitUntil: 'load', timeout: 60000 });
    await settled(g);
    /* 読む人がホテルの欄（鍵の1行）まで下りた所 ＝ 欄の頭を画面の頭に合わせる（都市の写真の分は、自分の分の数に関係なく同じ） */
    await g.page.evaluate((sl) => document.querySelector(sl).scrollIntoView({ block: 'start' }), K.SL);
    await until(async () => (await firstScreen()).ok, 5000);
    const fs7 = await firstScreen();
    ok(back && fs7.own === 20 && fs7.ok,
      `S7b 確認待ちを20件足した人が 390×680 で開き直す：書きかけの面は自分の分の列（20件）より上・ホテルの欄まで下りた最初の画面に、面の最初の欄（種類）と名前の欄が在る（P12.54）`,
      J({ back, ...fs7 }));
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
      && v.state === 'locked' && v.who === 'member' && v.text === LOCK + PICK && v.proof === 'none' && J(v.own) === J([{ name: A_POST, badges: [MINE, PENDING] }]),
      `★S8 会員 'a' がログインしたまま足す：pv_stay_add が1本・端末の鍵は返らず置かれない・保存先の1行は確認待ちで 'a' のログインの印・欄の外に「${MINE}」「${PENDING}」の札（欄の中は鍵の1行と確認の入口「${PICK}」だけ）`,
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
    ok(ra2 && va2.state === 'locked' && va2.text === LOCK + PICK && va2.proof === 'none' && J(va2.own) === J([{ name: A_POST, badges: [MINE, PENDING] }]),
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
    /* 10秒に1つの決まりは書いた人ごと。2つめと3つめは会員 'a'・'b' が足し、オーナーが待ち行列の版の印（rev）を添えて公開する */
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
    /* その会社の名前は、ステイ先の面の決まり（日本の会社は日本語・ほかは英語。オーナー 2026-10-18）。
       検査が持つ写し：pv-airlines.json の ja / en を地域（region）で選ぶ（career-stay.js の決め方を読み込まない） */
    let other = '';
    try { const pa = JSON.parse(read('pv-airlines.json')).airlines[OTHER]; other = (pa.region === 'japan' ? pa.ja : pa.en) || ''; } catch { other = ''; }
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

/* ════ 場面 suggest（S12）════════════════════════════════════
   ホテルの名前の候補。Google の代わりは、ここで 127.0.0.1 に立てる模擬の Google（打たれた字にかかわらず、決まった3つを返す）。 */
const SG_KEY = 'pv-stays-test-not-a-real-google-key';   // 作り物の鍵（どの返事・画面・保存領域にも出てはいけない字）
const SG_BY = 'Google Maps';                             // 候補の一覧の下の帰属表示（Google の決まりの字。訳さない）
const SG = [['ChIJpvStayTest00001', '検査用の候補ホテル 空港前（手元）', '検査用の住所 1（手元）'],
            ['ChIJpvStayTest00002', '検査用の候補ホテル 駅前（手元）', '検査用の住所 2（手元）'],
            ['ChIJpvStayTest00003', '検査用の候補ホテル 港（手元）', '検査用の住所 3（手元）']];
const SG_STOP = '検査用の止まっている時のホテル（手元）';
const sgLink = (id, nm) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(nm) + '&query_place_id=' + id;
async function suggest() {
  const G = { mode: 'ok', reqs: [] };
  const mock = http.createServer((req, res) => {
    let b = '';
    req.on('data', (c) => { b += c; });
    req.on('end', () => {
      let j = null;
      try { j = JSON.parse(b); } catch { j = null; }
      G.reqs.push({ m: req.method, path: req.url, key: req.headers['x-goog-api-key'] || '', input: j && j.input });
      if (G.mode === 'fail') { res.writeHead(500, { 'content-type': 'application/json' }); return res.end('{}'); }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ suggestions: SG.map(([id, nm, ad]) => ({ placePrediction: { placeId: id,
        structuredFormat: { mainText: { text: nm }, secondaryText: { text: ad } } } })) }));
    });
  });
  await new Promise((r) => mock.listen(0, '127.0.0.1', r));
  const places = { endpoint: `http://127.0.0.1:${mock.address().port}/v1/places:autocomplete`, key: SG_KEY, timeoutMs: 3000 };
  try {
    const K = await kit(JAL, { places });
    const { L, base, ZN, FM, page, shut, replies, visit, whereIs, rowsOf, draftOf } = K;
    const FN = '/functions/v1/hotel-suggest';
    const NAME = `${FM} [data-k="name"]`;
    const now = `date_trunc('month', now() at time zone 'UTC')::date`, nowLa = `date_trunc('month', now() at time zone 'America/Los_Angeles')::date`;
    const counter = async () => (await L.q(`select
        coalesce(max(n) filter (where bucket = 'utc' and month = ${now}), 0)::int as utc,
        coalesce(max(n) filter (where bucket = 'la' and month = ${nowLa}), 0)::int as la from public.pv_hotel_suggest_quota`)).rows[0];
    const setCounter = (n) => L.q(`insert into public.pv_hotel_suggest_quota (bucket, month, n) values ('utc', ${now}, $1), ('la', ${nowLa}, $1)
        on conflict (bucket, month) do update set n = excluded.n`, [n]);
    const fnReplies = (p) => replies(p, FN).map((g) => { try { return JSON.parse(g.text); } catch { return null; } });
    /* この場面のページ：候補の時計と通信を数える台本を先に置き、出ていった通信を（見出しごと）全部控える */
    const spage = async (o) => {
      const p = await page(o);
      await watchSuggest(p.page);
      p.rq = [];
      p.page.on('request', (r) => { p.rq.push({ m: r.method(), u: r.url(), h: r.headers(), b: r.postData() || '' }); });
      return p;
    };
    /* その字が乗った通信（行き先・中身・見出しのどこかに、そのままの字か URL の形か JSON の形で） */
    const carries = (p, w) => p.rq.filter((r) => [r.u, r.b, JSON.stringify(r.h)].some((x) => x.includes(w) || x.includes(encodeURIComponent(w)) || x.includes(JSON.stringify(w).slice(1, -1))));
    const isPing = (x) => !!x && x.ok === true && 'on' in x && !('items' in x);
    /* 名前の欄（ただの欄なら role も aria-* も無い）と、開いている一覧 */
    const field = (p, form) => p.page.evaluate((fm) => {
      const f = document.querySelector(fm), i = f && f.querySelector('[data-k="name"]'), b = f && f.querySelector('.pvhs');
      const tx = (x) => x ? x.textContent.replace(/\s+/g, ' ').trim() : '';
      return { attrs: i ? [...i.attributes].map((a) => a.name).filter((n) => n === 'role' || /^aria-/.test(n)).sort() : null,
        open: !!b && !b.hidden, opts: b ? [...b.querySelectorAll('.pvhs-o')].map((o) => [tx(o.querySelector('.pvhs-n')), tx(o.querySelector('.pvhs-a'))]) : [],
        by: b ? tx(b.querySelector('.pvhs-by')) : '', name: i ? i.value : null,
        map: ((f && f.querySelector('[data-k="maps_url"]')) || {}).value ?? null, addr: ((f && f.querySelector('[data-k="address"]')) || {}).value ?? null };
    }, form);
    const openAdd = async (p) => {
      await p.page.click(`${ZN} .crs-ent[data-kind="hotel"]`);
      await p.page.waitForSelector(NAME, { visible: true });
      await p.page.focus(NAME);
    };
    const listShown = (p, form) => p.page.waitForSelector(`${form} .pvhs:not([hidden]) .pvhs-o`, { visible: true, timeout: 15000 }).then(() => true, () => false);
    const wantOpts = J(SG.map(([, nm, ad]) => [nm, ad]));
    /* 閉じる前に、そのページの返事・画面・保存領域に作り物の鍵の字が無いかを見ておく（閉じたページは読めない） */
    const leaks = [];
    const close = async (p) => { leaks.push(...await whereIs(p, [SG_KEY])); await shut(p); };

    await scene('S12 ホテルの名前の候補（模擬の Google・手元の本物の Edge Function と数え札）', async () => {
      /* S12a 1440・ログインなし */
      const g = await spage({});
      ok(await visit(g), 'S12a 準備：会社ページの就航地の欄が読み終わった');
      await openAdd(g);
      const f0 = await field(g, FM);
      await g.page.keyboard.type('ヒルトン');
      const shown = await listShown(g, FM);
      const f1 = await field(g, FM);
      const fr1 = fnReplies(g);
      ok(J(f0.attrs) === '[]' && shown && f1.open && J(f1.opts) === wantOpts && f1.by === SG_BY
         && J(f1.attrs) === J(['aria-autocomplete', 'aria-controls', 'aria-expanded', 'role']) && G.reqs.length === 1
         && fr1.length === 2 && isPing(fr1[0]) && fr1[0].on === true && fr1[1] && fr1[1].ok === true && Array.isArray(fr1[1].items),
        `S12a 「ホテルを追加」の名前の欄は、開いた時はただの欄（role も aria-* も無い）→「ヒルトン」と打つと、Google へ1本（打つあいだは送らない）→ 候補3つ（名前・住所）と「${SG_BY}」`,
        J({ f0: f0.attrs, f1, reqs: G.reqs.length, fr1 }));
      const addsBefore = replies(g, 'pv_stay_add').length;
      await g.page.keyboard.press('ArrowDown');
      await g.page.keyboard.press('ArrowDown');
      await g.page.keyboard.press('Enter');
      const f2 = await field(g, FM);
      const d2 = await draftOf(g);
      const link1 = sgLink(SG[1][0], SG[1][1]);
      ok(f2.name === SG[1][1] && f2.map === link1 && f2.addr === '' && !f2.open && replies(g, 'pv_stay_add').length === addsBefore
         && !!(await g.page.$(FM)) && d2 && d2.name === SG[1][1] && d2.maps_url === link1,
        'S12a 矢印で2つめ → Enter：名前と地図の欄（place ID つきの Google マップ）に入る・住所の欄は空のまま・Enter では送られない・書きかけに名前と地図が残る',
        J({ f2, d2 }));
      await g.page.click(`${FM} button[type="submit"]`);
      await until(() => replies(g, 'pv_stay_add').length > addsBefore);
      const sent = g.st.sent.filter((s) => s.fn === 'pv_stay_add').at(-1);
      const row = (await L.q(`select state, maps_url, address from public.pv_stay_places where airline = $1 and iata = $2 and name = $3`, [SLUG, IATA, SG[1][1]])).rows;
      ok(sent && sent.p && sent.p.name === SG[1][1] && sent.p.maps_url === link1 && sent.p.address === null
         && row.length === 1 && row[0].state === 'pending' && row[0].maps_url === link1 && row[0].address === null,
        'S12a 「追加する」の1回で保存先に1行（選んだ名前・地図のリンク・住所は空・確認待ち）', J({ sent, row }));
      const c1 = await counter();
      ok(c1.utc === 1 && c1.la === 1, 'S12a 数え札は Google へ送った1回だけ進んだ（UTC の月・LA の月とも 1）', J(c1));
      await close(g);

      /* S12b 390・指で選ぶ */
      const t = await spage({ w: 390, h: 844, touch: true });
      await visit(t);
      await openAdd(t);
      await t.page.keyboard.type('ヒルトン');
      const tShown = await listShown(t, FM);
      await t.page.tap(`${FM} .pvhs-o:nth-child(3)`);
      const ft = await field(t, FM);
      ok(tShown && ft.name === SG[2][1] && ft.map === sgLink(SG[2][0], SG[2][1]) && ft.addr === '' && !ft.open,
        'S12b 390 の指で3つめを選ぶ：名前と地図の欄に入る（住所は空のまま）・一覧は閉じる', J(ft));
      await close(t);

      /* S12c ★止まっている（10,000）→ ただの欄・Google へ0本・打った名前で足せる */
      await setCounter(10000);
      const gBefore = G.reqs.length;
      const s = await spage({});
      await visit(s);
      await openAdd(s);
      await s.page.keyboard.type('ヒルトン');
      await settleSuggest(s.page);
      const fs1 = await field(s, FM);
      await s.page.click(NAME, { clickCount: 3 });
      await s.page.keyboard.type(SG_STOP);
      await settleSuggest(s.page);
      const sLeft = [...carries(s, 'ヒルトン'), ...carries(s, SG_STOP)].map((r) => `${r.m} ${r.u}`);
      const aBefore = replies(s, 'pv_stay_add').length;
      await s.page.click(`${FM} button[type="submit"]`);
      await until(() => replies(s, 'pv_stay_add').length > aBefore);
      const sRow = await rowsOf(SG_STOP);
      const c2 = await counter();
      const sr = fnReplies(s);
      ok(sr.length === 1 && isPing(sr[0]) && sr[0].on === false && sr[0].has_key === true && sr[0].has_db === true && sLeft.length === 0
         && !fs1.open && J(fs1.attrs) === '[]' && fs1.opts.length === 0
         && G.reqs.length === gBefore && sRow.length === 1 && sRow[0].state === 'pending' && c2.utc === 10000 && c2.la === 10000,
        '★S12c 数え札が 10,000（止まっている）：ping が「出せない」と答え、打った字（ヒルトン・名前）は「追加する」まで、どの通信にも乗らない・候補は出ない・名前の欄はただの欄のまま・Google へは0本・数え札は 10,000 のまま → 打った名前で「追加する」→ 保存される',
        J({ sr, sLeft, fs1, google: G.reqs.length - gBefore, sRow, c2 }));
      await close(s);

      /* S12d つながっていない（鍵が無い） */
      await setCounter(0);
      places.key = '';
      const n = await spage({});
      await visit(n);
      await openAdd(n);
      await n.page.keyboard.type('ヒルトン');
      await settleSuggest(n.page);
      const fn1 = await field(n, FM), nr = fnReplies(n), c3 = await counter();
      const nLeft = carries(n, 'ヒルトン').map((r) => `${r.m} ${r.u}`);
      ok(nr.length === 1 && isPing(nr[0]) && nr[0].on === false && nr[0].has_key === false && nLeft.length === 0
         && !fn1.open && J(fn1.attrs) === '[]' && fn1.name === 'ヒルトン' && G.reqs.length === gBefore && c3.utc === 0 && c3.la === 0,
        '★S12d 鍵が無い：ping が「出せない」と答え（has_key は偽）、打った字はどの通信にも乗らない・ただの欄のまま（打った字はそのまま）・数え札は進まない・Google へ0本', J({ nr, nLeft, fn1, c3 }));
      await close(n);
      places.key = SG_KEY;

      /* S12e Google が失敗 */
      G.mode = 'fail';
      const e = await spage({});
      await visit(e);
      await openAdd(e);
      await e.page.keyboard.type('ヒルトン');
      await settleSuggest(e.page);
      const fe = await field(e, FM), er = fnReplies(e).filter((x) => !isPing(x)), c4 = await counter();
      ok(er.length === 1 && er[0] && er[0].reason === 'read_failed' && !fe.open && J(fe.attrs) === '[]' && G.reqs.length === gBefore + 1 && c4.utc === 1 && c4.la === 1,
        'S12e Google が 500：read_failed・ただの欄のまま・送った1回は数え札に残る', J({ er, fe, c4 }));
      await close(e);
      G.mode = 'ok';

      /* S12f 管理ページの「追加」のホテル（オーナー 'op'）。日本語 1440・英語 390 */
      const AF = 'form[data-adm="add-hotel"]';
      for (const [lang, w, h, typed, pickI] of [['ja', 1440, 900, 'ヒルトン', 0], ['en', 390, 844, 'Hilton', 1]]) {
        const a = await spage({ who: 'op', w, h });
        await a.page.goto(`${base}/${lang === 'en' ? 'en/' : ''}admin.html`, { waitUntil: 'load', timeout: 60000 });
        await a.page.waitForSelector('#adm-b-a', { visible: true, timeout: 30000 });
        await a.page.click('#adm-b-a');
        await a.page.waitForSelector('input[name="adm-kind"][value="hotel"]', { visible: true });
        await a.page.click('input[name="adm-kind"][value="hotel"]');
        await a.page.waitForSelector(`${AF} [data-k="name"]`, { visible: true });
        const af0 = await field(a, AF);
        await a.page.focus(`${AF} [data-k="name"]`);
        await a.page.keyboard.type(typed);
        const aShown = await listShown(a, AF);
        const af1 = await field(a, AF);
        await a.page.click(`${AF} .pvhs-o:nth-child(${pickI + 1})`);
        const af2 = await field(a, AF);
        const sentLang = G.reqs.at(-1) && G.reqs.at(-1).input;
        /* 候補の口へは名もなし：見出しは公開の鍵（anon）だけ・オーナーのログインの鍵はどこにも無い */
        const opTok = await a.page.evaluate(() => { try { const x = JSON.parse(localStorage.getItem('sb-local-auth-token')); return [x.access_token || '', x.refresh_token || '']; } catch { return ['', '']; } });
        const fq = a.rq.filter((r) => r.u === `${base}${FN}`);
        const role = (k) => { try { return JSON.parse(Buffer.from(String(k).split('.')[1], 'base64url').toString('utf8')).role; } catch { return null; } };
        const anon = fq.length >= 2 && !!opTok[0] && fq.every((r) => r.m === 'POST' && r.h.authorization === `Bearer ${r.h.apikey}` && role(r.h.apikey) === 'anon'
          && !('cookie' in r.h) && ![r.u, r.b, JSON.stringify(r.h)].some((x) => x.includes(opTok[0]) || (opTok[1] && x.includes(opTok[1]))));
        ok(J(af0.attrs) === '[]' && aShown && J(af1.opts) === wantOpts && af1.by === SG_BY
           && af2.name === SG[pickI][1] && af2.map === sgLink(SG[pickI][0], SG[pickI][1]) && af2.addr === '' && !af2.open && sentLang === typed && anon,
          `S12f 管理ページ（${lang}・${w}）の「追加」のホテル：同じ候補と「${SG_BY}」→ 選ぶと名前と地図の欄に入る（住所は空のまま）・候補の口へは名もなし（公開の鍵だけ）`,
          J({ af0: af0.attrs, af1, af2, sentLang, anon, fq: fq.map((r) => ({ m: r.m, a: (r.h.authorization || '').slice(0, 20), b: r.b })) }));
        await close(a);
      }

      /* ★作り物の鍵の字は、どこにも無い・Google が受け取ったのは places:autocomplete だけ */
      const fnAll = PAGES.flatMap((p) => replies(p, FN));
      ok(fnAll.length >= 7 && leaks.length === 0 && fnAll.every((x) => !x.text.includes(SG_KEY)),
        `★S12 作り物の鍵の字は、候補の口の返事（${fnAll.length}本）・7枚の画面・保存領域のどこにも無い`, J({ leaks, fn: fnAll.filter((x) => x.text.includes(SG_KEY)).length }));
      ok(G.reqs.length >= 4 && G.reqs.every((r) => r.m === 'POST' && r.path === '/v1/places:autocomplete' && r.key === SG_KEY),
        `★S12 模擬の Google が受け取った ${G.reqs.length} 本は全部 POST /v1/places:autocomplete（鍵は見出しだけ。Place Details・写真・口コミは0本）`,
        J([...new Set(G.reqs.map((r) => `${r.m} ${r.path}`))]));
    });
  } finally {
    await new Promise((r) => mock.close(r));
  }
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
