/* assert-towns.mjs — 住みやすい街（pv-contrib.js の街の面 ⇄ db/towns.sql）を、手元の本物の保存先につないで歩く（2026-10-16）。

   面の字と呼ぶ口は assert-contrib.mjs の「ソース」が見る。ここでは serve-local.mjs の使い捨ての保存先に本物の SQL
   （db/towns.sql・db/towns.generated.sql）を流し、面とブラウザの外からの呼び出しの両方で確かめる。

   場面 frame（F1・F2）
     F1  使い捨ての保存先が立つ・会員 'a' が入る・会社ページが開く・ページの入口から、今ある面の一覧が開く。
     F2  ブラウザの外から：'a' として submit_town_post（種の街）→ ok・保存先に1行・my_town_posts がその1行を返す。
         ログインしていない人の pv_town_board の返事は {"ok":true,"state":"login"} そのもの。
         ログインしていない人の pv_town_options は、その基地の種の名前を、種の並びで返す。
   場面 sheet（S1〜S3）
     S1  見出し「住みやすい街を追加」・文脈の行は「会社 · 基地」・会社も基地も聞かない・候補は入口の名前を入口の並びで・
         札に下の行（区・ラテン文字の表記）を出さない。
     S2  街の検索：2字打つと、その字を含む候補だけが残る・選ぶと欄に入り、候補が全部戻る・選んだ札に焦点が残り、→ で隣の札へ。
     S2b （--only cathay-pacific）ラテン文字の "tung" で東涌だけが残る・選ぶと「東涌」・保存の通信は town '東涌'。
         どの会社でも：カードの下の行の頭の3字を打つと、そのカードの札が出る。
     S3  会員が選ぶ・チェックする・送る：submit_town_post が1本（会社・基地・街・言葉と、答えたものだけ）・
         「情報を追加しました」と「あなたの投稿」・保存先に1行。読み直して開く：その候補に「あなたの投稿」・選ぶと保存した値・
         ボタンは「匿名で更新する」。
     S3b 街だけを出した会員の一覧に「あなたの投稿はまだありません。」が出ない（ok ok・data-pvc-town ok）。
         何も出していない会員には出る。
     S4  直す：良い点を足す →「情報を更新しました」・良い点の横に「確認待ち」・保存先の text_state は pending。
     S4b 街そのもの：保存後のカードの「自分の回答を見る」から別の候補を選んで送る → 通信に was・行は1つで、新しい街の下。
         入口から開いて同じ変更をすると（was なし）行は2つ ＝ 足すのは直すことではない。
     S4c 「修正」（data-pvc-ctx の付いた押し所）から開いて、戻る → 進むで面へ戻っても、直している途中のまま（通信に was）。
     S5  0 と未回答と読めない字：空の所要時間は通信に入らない（null）・「0」はサーバの文で断られ、その欄に印・打った字は残る。
         月額「20万」（通貨あり）は打ったとおりの字で送られ、サーバの「家賃の月額が正しくありません」・月額の欄に印・「20万」は欄に残る。
         「250,000」は数 250000 で送られ、保存される。
     S6  番地のような街の名前：「保存できませんでした」とサーバの文・打った字は残る。間取り「1-2-3」：その文・間取りの欄に印・家賃の欄は開いたまま。
     S7  届かない：「送れていません」→ 読み直すと、一覧に「住みやすい街の回答が、この端末に残っています。」と「続きを開く」→ 打った内容が戻る → 送れる。
     S8  位置を取らない（navigator.geolocation を数える物に替えて、呼ばれた数は0）・「住所」の欄が無い・
         面は pv_town_board も pv_town_queue も呼ばない。
     S9  打った内容は消えない：自分の投稿のある街 X を、良い点を打ってから選ぶ → 打った字のまま（X の保存した字を上に書かない）・
         「あなたの投稿」「匿名で更新する」→ 送ると X の1行が打った字に。打つ前に選ぶと X の保存した値・自分の投稿の無い街へ移ると空に戻る。
     X1  自分の街の投稿の読みが失敗しても（failNext）、月の勤務の入力は保存した値で1回だけ描かれ、読み込み中の行は2度と出ない・
         一覧は今までの2つの状態・街の入力は使える（読み込み中の行は残らない）。読みが止まったままでも、月の勤務はすぐ使える。

   入口：ページに入口（data-pvc-open="town" と data-pvc-base を持つもの）が在ればそれを押す。無ければ、カードと同じ関数
         （gen-airline-glance.mjs の ledgerTowns・baseCode）から同じ4つの属性を作った入口を差し込んで押す（どちらかを出力に書く）。
         差し込む入口の名前は、サーバの候補の種（db/towns.generated.sql）と字まで同じであることを、先に確かめる。

   ★本番にも 3000 番にも1回も通信しない（local-chain.mjs の bring・open。終われば保存先ごと消す）。
   ★手元の会員（serve-local.mjs の MEMBERS）は模擬。ここで通ったことは、本番で通った証拠にはならない。
   ★PV_TOWN_SHOTS=<リポジトリの外のフォルダ> を付けると、面の絵を書き出す（390×680 と 1440×820）。

   実行: node assert-towns.mjs [--scenes frame,sheet] [--only <会社>]（既定：全部の場面・jal）
*/
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEMBERS } from './serve-local.mjs';
import { bring, open, rpcAs } from './local-chain.mjs';
import { viewOf } from './pv-airline-view.mjs';
import { ledgerTowns, baseCode } from './gen-airline-glance.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? ' ' + e : ''))); };
const J = (v) => { try { return JSON.stringify(v).slice(0, 500); } catch { return String(v); } };

/* 画面の字（pv-contrib.js の字。ここで字を固定する） */
const HEAD = '住みやすい街を追加';
const ADDED = '情報を追加しました';
const MINE = 'あなたの投稿';
const ADD_BTN = '匿名で追加する', UPD_BTN = '匿名で更新する';
const LOGIN_STATE = '{"ok":true,"state":"login"}';
const UPDATED = '情報を更新しました', PENDING = '確認待ち', SAY_NO = '保存できませんでした';
const NONE_YET = 'あなたの投稿はまだありません。';
const LOADING = 'これまでの投稿を確認しています…';
const NOREAD = 'これまでの投稿を読み込めませんでした。このまま送れます（同じ街の投稿があれば、今回の内容に置き換わります）。';
const FAIL_T = '送れていません', KEPT = '住みやすい街の回答が、この端末に残っています。', RESUME = '続きを開く';
/* 月の勤務の種（X1）：先月・語彙の最初の機種（打ち込まない） */
const FLEET = JSON.parse(read('pv-vocab.json')).fleets.find((x) => !x.retired).code;
const LAST = (() => { const n = new Date(); let y = n.getFullYear(), m = n.getMonth(); if (m === 0) { y -= 1; m = 12; } return { y, m }; })();

const argv = process.argv.slice(2);
const val = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const SCENES = { frame, sheet };
const want = (val('--scenes') || Object.keys(SCENES).join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const unknown = want.filter((s) => !SCENES[s]);
if (unknown.length) { console.error(`✗ 知らない場面: ${unknown.join(', ')}（あるのは ${Object.keys(SCENES).join(', ')}）`); process.exit(2); }
const SLUG = val('--only') || 'jal';
if (!/^[a-z0-9-]+$/.test(SLUG) || !fs.existsSync(path.join(ROOT, 'airlines', SLUG + '.html'))) {
  console.error(`✗ 会社のページが無い: airlines/${SLUG}.html`); process.exit(2);
}
const SHOTS = process.env.PV_TOWN_SHOTS ? path.resolve(process.env.PV_TOWN_SHOTS) : '';
if (SHOTS && (SHOTS + path.sep).startsWith(ROOT)) { console.error('✗ PV_TOWN_SHOTS はリポジトリの外に置く'); process.exit(2); }

/* 入口の4つの属性（カードと同じ関数・同じ並び。ページに入口が在れば、そちらを押す） */
const VIEW = viewOf(SLUG), BASE = baseCode(VIEW);
if (!VIEW.living || !BASE) { console.error(`✗ ${SLUG} には暮らしの台帳か基地が無い（街の面が開かない会社）`); process.exit(2); }
const ENTRY = {
  base: BASE,
  text: `${VIEW.base.city} ${VIEW.base.iata.join('・')}`,
  ports: VIEW.living.airports.map((a) => a.iata),
  towns: ledgerTowns(VIEW).map((t) => [t.name, t.sub]),
};
const NAMES = ENTRY.towns.map((t) => t[0]);
/* サーバの候補の種（db/towns.generated.sql の「-- 1.」の行）から、この会社・基地の名前を種の並びで */
const SEED_NAMES = (() => {
  const text = read('db/towns.generated.sql'), i = text.indexOf('\n-- 1.'), j = text.indexOf('\n  ) as v(', i);
  return i < 0 ? [] : text.slice(i, j).split('\n').filter((l) => /^ {4}\(/.test(l))
    .map((l) => [...l.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, () => "'")))
    .filter((r) => r[0] === SLUG && r[1] === BASE).map((r) => r[2]);
})();

const M = Object.fromEntries(MEMBERS.map((m) => [m.key, m]));
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
/* 返事の字を、読めれば JSON にしてから書き直す（空白の付け方で比べ損ねない） */
const norm = (t) => { try { return JSON.stringify(JSON.parse(t)); } catch { return String(t); } };
/* 検索の字の比べ方（見た目だけ：小文字・空白なし） */
const fold = (s) => String(s).toLowerCase().replace(/[\s　]+/g, '');

let browser = null;
const PAGES = [], BROUGHT = [];

async function scene(title, fn) {
  console.log(`\n════ ${title} ════`);
  await fn();
}

/* 使い捨ての保存先を1つ立て、道具をそろえる。場面ごとに1つ（終われば消す）。 */
async function kit() {
  const L = await bring();
  BROUGHT.push(L);
  if (!browser) browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
  const base = L.base;
  console.log(`\n手元の保存先 ${base}（使い捨て）・${SLUG}（基地 ${BASE}）`);

  const page = async (o = {}) => { const p = await open(browser, base, { w: 390, h: 680, ...o }); PAGES.push(p); return p; };
  const shut = async (p) => { try { await p.ctx.close(); } catch { /* 閉じられなくても先へ */ } };
  const go = async (p) => {
    await p.page.goto(`${base}/airlines/${SLUG}.html`, { waitUntil: 'load', timeout: 60000 });
    await p.page.waitForFunction(() => !!window.PVContrib
      && [...document.styleSheets].some((s) => s.href && s.href.includes('pv-contrib.css')), { timeout: 30000 });
  };
  /* ページの会社の名前（ページの字。面の写しは読まない） */
  const company = (p) => p.page.evaluate(() => (document.body.getAttribute('data-pvc-name') || '').trim()
    || ((document.querySelector('.hero-airline h1') || {}).textContent || '').trim());
  /* 入口。ページに在ればそれ、無ければ同じ4つの属性の入口を差し込む（どちらだったかを返す） */
  const entry = (p) => p.page.evaluate((e) => {
    if (document.querySelector('[data-pvc-open="town"][data-pvc-base]:not([data-test-entry])')) return 'page';
    if (document.querySelector('[data-test-entry]')) return 'injected';
    const a = document.createElement('a');
    a.href = '?add=town'; a.textContent = '＋住みやすい街を追加';
    a.setAttribute('data-pvc-open', 'town');
    a.setAttribute('data-pvc-base', e.base);
    a.setAttribute('data-pvc-basetext', e.text);
    a.setAttribute('data-pvc-ports', JSON.stringify(e.ports));
    a.setAttribute('data-pvc-towns', JSON.stringify(e.towns));
    a.setAttribute('data-test-entry', '');
    a.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9000;min-height:44px;padding:12px;background:#fff';
    document.body.appendChild(a);
    return 'injected';
  }, ENTRY);
  /* 面が開き切って（滑り込みが終わって）、条件がそろうまで */
  const sheetIn = (p, cond, arg) => p.page.waitForFunction((src, a) => {
    const r = document.querySelector('.pvc-root');
    if (!r || r.hidden || !r.classList.contains('is-in')) return false;
    const s = r.querySelector('.pvc-sheet').getBoundingClientRect();
    if (Math.abs(s.right - document.documentElement.clientWidth) > 1 || Math.abs(s.bottom - window.innerHeight) > 1) return false;
    return new Function('r', 'a', src)(r, a);
  }, { timeout: 20000 }, cond, arg);
  const waitTown = (p) => sheetIn(p, `const f = r.querySelector('form[data-pvc-form="town"]'), s = f && f.querySelector('fieldset.pvc-set');
    return !!s && !s.disabled;`);
  const waitList = (p) => sheetIn(p, `const st = r.querySelector('[data-pvc-state]');
    return !!r.querySelector('.pvc-tiles') && !!st && /^(ok|anon|off|fail) (ok|anon|off|fail)$/.test(st.getAttribute('data-pvc-state'));`);
  const openTown = async (p) => {
    const how = await entry(p);
    await p.page.click('[data-pvc-open="town"][data-pvc-base]');
    await waitTown(p);
    return how;
  };
  /* 街の面の見えている形 */
  const face = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root'), f = r && r.querySelector('form[data-pvc-form="town"]');
    const tx = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
    const vis = (n) => !!n && n.getClientRects().length > 0;
    const title = r ? tx(r.querySelector('.pvc-title')) : '';
    if (!f) return { title, form: false, saved: !!(r && r.querySelector('[data-pvc-saved]')), chips: [], ctl: {}, labels: [], bad: [], msg: [] };
    const chips = [...f.querySelectorAll('.pvc-towns .pvc-chip')].map((c) => {
      const i = c.querySelector('input'), fc = c.querySelector('.pvc-chip-f');
      return { name: i.value, shown: vis(c), text: fc ? fc.innerText.trim() : '', checked: i.checked,
        mine: vis(fc && fc.querySelector('.pvc-mine')), focus: document.activeElement === i };
    });
    const ctl = {};
    for (const n of f.querySelectorAll('input[name],select[name],textarea[name]')) {
      if (n.name === 'town_pick') continue;
      ctl[n.name] = n.type === 'checkbox' ? n.checked : n.value;
    }
    const send = f.querySelector('button.pvc-send[type="submit"]'), wait = f.querySelector('[data-pvc-wait]');
    return {
      title, form: true, ctx: tx(f.querySelector('.pvc-ctx-line')), chips, ctl,
      labels: [...f.querySelectorAll('label.pvc-label')].map((l) => l.firstChild ? l.firstChild.textContent.trim() : ''),
      bad: [...f.querySelectorAll('[aria-invalid="true"]')].map((n) => n.name),
      msg: [...f.querySelectorAll('[data-pvc-msg]')].map((m) => ({ kind: m.getAttribute('data-pvc-msg'),
        title: tx(m.querySelector('.pvc-msg-t')), text: tx(m.querySelector('.pvc-msg-d')) })),
      send: tx(send), sendOff: !!(send && send.disabled), wait: vis(wait) ? tx(wait) : '',
      tag: vis(f.querySelector('#pvc-l-town .pvc-mine')),
      rentOpen: vis(f.querySelector('#pvc-fold-rent')), tripOpen: vis(f.querySelector('#pvc-fold-trip')),
      focusName: document.activeElement ? (document.activeElement.name || '') + ':' + (document.activeElement.value || '') : '',
    };
  });
  /* 保存後のカード */
  const card = (p) => p.page.evaluate(() => {
    const c = document.querySelector('.pvc-root [data-pvc-saved]');
    if (!c) return null;
    const tx = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
    const rows = {};
    for (const x of c.querySelectorAll('.pvc-sum-r')) {
      const v = x.querySelector('.pvc-sum-v'), k = x.querySelector('.pvc-sum-k .pvc-mine');
      rows[x.getAttribute('data-k')] = { v: tx(v), none: v.classList.contains('is-none'), wait: k ? tx(k) : '' };
    }
    return { head: tx(c.querySelector('.pvc-saved-h')), sub: tx(c.querySelector('.pvc-saved-s')),
      mine: !!c.querySelector('.pvc-saved-s .pvc-mine'), rows };
  });
  /* 街の欄に打つ（空にしてから、キーで打つ） */
  const typeTown = async (p, s) => {
    await p.page.$eval('.pvc-root #pvc-f-town', (n) => { n.focus(); n.value = ''; n.dispatchEvent(new Event('input', { bubbles: true })); });
    if (s) await p.page.keyboard.type(s);
  };
  /* 候補の札を押す（札の label を押す ＝ 人が押す所） */
  const pick = async (p, name) => {
    const h = await p.page.evaluateHandle((nm) => [...document.querySelectorAll('.pvc-root .pvc-towns .pvc-chip')]
      .find((c) => c.querySelector('input').value === nm) || null, name);
    const e = h.asElement();
    if (!e) throw new Error(`候補「${name}」の札が無い`);
    await e.click();
    await until(async () => (await face(p)).ctl.town === name, 5000);
  };
  const choose = (p, name, value) => p.page.select(`.pvc-root form[data-pvc-form="town"] select[name="${name}"]`, value);
  const tickOwn = async (p) => {
    const on = await p.page.$eval('.pvc-root input[name="own"]', (n) => n.checked);
    if (!on) await p.page.click('.pvc-root label.pvc-own');
  };
  const sentOf = (p, from = 0) => p.st.sent.filter((s) => s.fn === 'submit_town_post').slice(from);
  /* 送るボタンを押し、保存後のカードか、面の知らせが出るまで待つ。押したあとに出ていった submit_town_post を返す */
  const send = async (p) => {
    const n0 = sentOf(p).length;
    await p.page.click('.pvc-root form[data-pvc-form="town"] .pvc-send[type="submit"]');
    await p.page.waitForFunction(() => {
      const r = document.querySelector('.pvc-root');
      return !!r.querySelector('[data-pvc-saved]') || !!r.querySelector('form[data-pvc-form="town"] .pvc-msg');
    }, { timeout: 20000 });
    return sentOf(p, n0);
  };
  /* 保存先の、その会員の街の投稿（持ち主として読む） */
  const rowsOf = async (who) => (await L.q(
    `select t.name as town, t.state as town_state, s.text_state, s.lived, s.good, s.concern,
            s.rent_amount::text as amount, s.rent_currency as currency, s.trip_mode as mode, s.trip_minutes as minutes
       from public.pv_town_posts s join public.pv_towns t on t.id = s.town_id
      where s.author_hash = public.pv_town_hash($1::uuid, $2) order by t.tkey collate "C"`, [M[who].id, SLUG])).rows;
  /* 面を閉じる（Esc）。閉じ切って、面の段が履歴から降りるまで */
  const closeSheet = async (p) => {
    await p.page.keyboard.press('Escape');
    await p.page.waitForFunction(() => {
      const r = document.querySelector('.pvc-root');
      return (!r || !r.classList.contains('is-in')) && !(history.state && history.state.pvc);
    }, { timeout: 20000 });
  };
  /* ページの入口から一覧を開き、件数の読みが（街の読みまで）届くまで */
  const openList = async (p) => {
    const at = await p.page.evaluate(() => {
      for (const n of document.querySelectorAll('[data-test-hit]')) n.removeAttribute('data-test-hit');
      const n = [...document.querySelectorAll('[data-pvc-open="list"]')].find((x) => x.getClientRects().length);
      if (!n) return false;
      n.setAttribute('data-test-hit', '');
      return true;
    });
    if (!at) throw new Error('ページに一覧の入口が無い');
    await p.page.click('[data-test-hit]');
    await sheetIn(p, `const st = r.querySelector('[data-pvc-state]');
      return !!r.querySelector('.pvc-tiles') && !!st && /^(ok|anon|off|fail) (ok|anon|off|fail)$/.test(st.getAttribute('data-pvc-state'))
        && !/^(loading|idle)$/.test(st.getAttribute('data-pvc-town') || '');`);
  };
  const listFace = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root'), st = r.querySelector('[data-pvc-state]');
    const tx = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
    return { state: st.getAttribute('data-pvc-state'), town: st.getAttribute('data-pvc-town'), text: st.hidden ? '' : tx(st),
      msgs: [...r.querySelectorAll('.pvc-main > .pvc-msg')].map((m) => ({ text: tx(m.querySelector('.pvc-msg-d')),
        acts: [...m.querySelectorAll('[data-pvc-act]')].map((b) => tx(b)) })) };
  });
  /* 打つ欄（input・textarea）に、空にしてから打つ */
  const typeIn = async (p, name, s) => {
    await p.page.$eval(`.pvc-root form[data-pvc-form="town"] [name="${name}"]`, (n) => {
      n.focus(); n.value = ''; n.dispatchEvent(new Event('input', { bubbles: true }));
    });
    if (s) await p.page.keyboard.type(s);
  };
  /* 家賃・通勤の折りたたみを開く（閉じていれば押す） */
  const unfold = async (p, key) => {
    const open = await p.page.$eval(`.pvc-root [data-pvc-fold="${key}"] .pvc-fold-b`, (b) => b.getAttribute('aria-expanded') === 'true');
    if (!open) await p.page.click(`.pvc-root [data-pvc-fold="${key}"] .pvc-fold-b`);
  };
  /* 保存後のカードの「自分の回答を見る」 */
  const edit = async (p) => {
    await p.page.click('.pvc-root [data-pvc-saved] [data-pvc-act="edit"]');
    await waitTown(p);
  };
  const shot = async (p, name) => {
    if (!SHOTS) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    const f = path.join(SHOTS, `towns-${SLUG}-${name}.png`);
    await p.page.screenshot({ path: f });
    console.log(`  （絵）${f}`);
  };
  return { L, base, page, shut, go, company, entry, openTown, waitTown, waitList, face, card, typeTown, pick, choose, tickOwn, send, sentOf, rowsOf, shot,
    closeSheet, openList, listFace, typeIn, unfold, edit, sheetIn };
}

/* ════ 場面 frame（F1・F2）══════════════════════════════════════ */
async function frame() {
  const K = await kit();
  const { L, base, page, shut, go, company, waitList, rowsOf } = K;
  await scene('F1 手元の保存先・会員の入室・会社ページ・面の一覧', async () => {
    const a = await page({ who: 'a' });
    await go(a);
    const co = await company(a);
    const at = await a.page.evaluate(() => {
      const n = [...document.querySelectorAll('[data-pvc-open="list"]')].find((x) => x.getClientRects().length);
      if (!n) return false;
      n.setAttribute('data-test-hit', '');
      return true;
    });
    if (at) await a.page.click('[data-test-hit]');
    await waitList(a);
    const L1 = await a.page.evaluate(() => ({
      title: document.querySelector('.pvc-root .pvc-title').textContent,
      state: document.querySelector('.pvc-root [data-pvc-state]').getAttribute('data-pvc-state'),
    }));
    ok(at && !!co && L1.title === `${co}に情報を追加` && L1.state === 'ok ok' && a.st.supa.size === 0,
      `F1 使い捨ての保存先（${base}）で、会員 'a' が ${SLUG} のページを開き、ページの入口から面の一覧が開く（「${co}に情報を追加」・自分の投稿の読みは ok ok）`,
      J({ at, co, L1 }));
    await shut(a);
  });
  await scene('F2 ブラウザの外から：保存・自分の分・ログインしていない人の一覧と候補', async () => {
    const T0 = SEED_NAMES[0];
    const r = await rpcAs(base, 'a', 'submit_town_post', { airline: SLUG, base_iata: BASE, town: T0, lang: 'ja' });
    const rows = await rowsOf('a');
    const mine = await rpcAs(base, 'a', 'my_town_posts', { airline: SLUG });
    const posts = mine.body && Array.isArray(mine.body.posts) ? mine.body.posts : null;
    ok(!!T0 && r.status === 200 && r.body && r.body.ok === true && r.body.saved === true && rows.length === 1 && rows[0].town === T0
      && posts && posts.length === 1 && posts[0].town === T0 && posts[0].base === BASE,
      `F2 'a' として submit_town_post（種の街「${T0}」）→ ok・保存先に1行・my_town_posts がその1行を返す`, J({ r: r.body, rows, posts }));
    const g = await rpcAs(base, null, 'pv_town_board', { airline: SLUG, base: BASE });
    const keys = [...String(g.text).matchAll(/"((?:[^"\\]|\\.)*)"\s*:/g)].map((m) => m[1]).join();
    ok(g.status === 200 && norm(g.text) === LOGIN_STATE && keys === 'ok,state',
      `F2 ログインしていない人の pv_town_board の返事は ${LOGIN_STATE} そのもの（鍵は ok と state だけ）`, J({ status: g.status, text: g.text }));
    const o = await rpcAs(base, null, 'pv_town_options', { airline: SLUG, base: BASE });
    ok(o.status === 200 && o.body && o.body.ok === true && J(o.body.towns) === J(SEED_NAMES) && SEED_NAMES.length > 0,
      `F2 ログインしていない人の pv_town_options は、${BASE} の種の名前を種の並びで返す（${SEED_NAMES.join('・')}）`, J(o.body));
  });
}

/* ════ 場面 sheet（S1〜S3）══════════════════════════════════════ */
async function sheet() {
  const K = await kit();
  const { L, base, page, shut, go, company, openTown, waitTown, face, card, typeTown, pick, choose, tickOwn, send, rowsOf, shot,
    closeSheet, openList, listFace, typeIn, unfold, edit, sheetIn } = K;
  ok(J(NAMES) === J(SEED_NAMES) && NAMES.length > 0,
    `入口の街の名前（カードと同じ関数 ledgerTowns）は、サーバの候補の種（db/towns.generated.sql）と字まで同じ・同じ並び（${NAMES.join('・')}）`,
    J({ NAMES, SEED_NAMES }));
  const a = await page({ who: 'a' });
  await go(a);
  const co = await company(a);
  await scene('S1 見出し・文脈の行・候補', async () => {
    const how = await openTown(a);
    console.log(how === 'page' ? '  （入口：ページの入口を押した）'
      : '  （入口：ページに無いので、カードと同じ関数から作った同じ4つの属性の入口を差し込んで押した）');
    const f = await face(a);
    await shot(a, '390-form');
    ok(f.title === HEAD, `S1 見出しは「${HEAD}」`, J(f.title));
    ok(f.ctx === `${co} · ${ENTRY.text}`, `S1 文脈の行は「${co} · ${ENTRY.text}」（会社 · 基地）`, J(f.ctx));
    const asked = Object.keys(f.ctl).filter((n) => /airline|base|company/.test(n));
    ok(asked.length === 0 && !f.labels.some((l) => /会社|基地/.test(l)),
      'S1 会社も基地も聞かない（そう名付いた欄も、そう書いた見出しも無い）', J({ names: Object.keys(f.ctl), labels: f.labels }));
    ok(J(f.chips.map((c) => c.name)) === J(NAMES) && f.chips.every((c) => c.shown && !c.checked && !c.mine),
      `S1 候補は入口の名前を、入口の並びで（${NAMES.join('・')}）・どれも出ていて、どれも選ばれていない`, J(f.chips));
    ok(f.chips.every((c) => c.text === c.name),
      'S1 札に出る字は街の名前だけ（カードの下の行 ── 区・ラテン文字の表記 ── を札に出さない）', J(f.chips.map((c) => c.text)));
    if (SHOTS) {
      const w = await page({ who: 'a', w: 1440, h: 820 });
      await go(w);
      await openTown(w);
      await shot(w, '1440-form');
      await shut(w);
    }
  });

  await scene('S2 街の検索', async () => {
    const src = ENTRY.towns.find((t) => t[1]) || ENTRY.towns[0];
    const typed = (src[1] || src[0]).slice(0, 2);
    const expect = ENTRY.towns.filter((t) => fold(t[0]).includes(fold(typed)) || fold(t[1]).includes(fold(typed))).map((t) => t[0]);
    await typeTown(a, typed);
    const f1 = await face(a);
    const shown = f1.chips.filter((c) => c.shown).map((c) => c.name);
    ok(expect.length > 0 && J(shown) === J(expect),
      `S2 「${typed}」と2字打つと、その字を（名前か、カードの下の行に）含む候補だけが残る（${expect.join('・')}）`, J({ shown, expect }));
    const P = expect[0], next = NAMES[(NAMES.indexOf(P) + 1) % NAMES.length];
    await pick(a, P);
    const f2 = await face(a);
    ok(f2.ctl.town === P && f2.chips.every((c) => c.shown) && f2.chips.find((c) => c.name === P).checked && f2.chips.find((c) => c.name === P).focus,
      `S2 「${P}」を選ぶ → 欄に「${P}」・候補が全部戻る・選んだ札に焦点が残る`, J({ town: f2.ctl.town, chips: f2.chips }));
    await a.page.keyboard.press('ArrowRight');
    await until(async () => (await face(a)).ctl.town === next, 5000);
    const f3 = await face(a);
    ok(f3.ctl.town === next && f3.chips.find((c) => c.name === next).focus && f3.chips.find((c) => c.name === next).checked,
      `S2 → で隣の札（「${next}」）へ移り、欄も「${next}」になる`, J({ town: f3.ctl.town, focus: f3.focusName }));
  });

  await scene('S2b ラテン文字・カードの下の行で探す', async () => {
    const bad = [];
    for (const [name, sub] of ENTRY.towns) {
      if (!sub) continue;
      const t3 = [...sub].slice(0, 3).join('');
      await typeTown(a, t3);
      const f = await face(a);
      const c = f.chips.find((x) => x.name === name);
      if (!c || !c.shown) bad.push({ name, sub, t3, shown: f.chips.filter((x) => x.shown).map((x) => x.name) });
    }
    const subs = ENTRY.towns.filter((t) => t[1]).length;
    ok(bad.length === 0, `S2b カードの下の行の頭の3字を打つと、そのカードの札が出る（下の行のある ${subs} 枚どれも）`, J(bad));
    if (SLUG === 'cathay-pacific') {
      await typeTown(a, 'tung');
      const f = await face(a);
      ok(J(f.chips.filter((c) => c.shown).map((c) => c.name)) === J(['東涌']),
        'S2b （キャセイ）ラテン文字の「tung」で、東涌だけが残る', J(f.chips.filter((c) => c.shown).map((c) => c.name)));
      await pick(a, '東涌');
      ok((await face(a)).ctl.town === '東涌', 'S2b 東涌を選ぶ → 欄に「東涌」', J((await face(a)).ctl.town));
    }
  });

  await scene('S3 会員の保存・読み直し', async () => {
    const T0 = NAMES[0];
    if ((await face(a)).ctl.town !== T0) { await typeTown(a, ''); await pick(a, T0); }
    await choose(a, 'lived', 'now');
    await tickOwn(a);
    const f0 = await face(a);
    ok(f0.send === ADD_BTN && !f0.sendOff, `S3 選んでチェックすると、ボタンは「${ADD_BTN}」で押せる`, J({ send: f0.send, off: f0.sendOff }));
    const sent = await send(a);
    const c = await card(a);
    await shot(a, '390-saved');
    const p = sent[0] && sent[0].p ? sent[0].p : {};
    const keys = Object.keys(p).sort().join();
    ok(sent.length === 1 && keys === 'airline,base_iata,concern,good,lang,lived,lived_to_year,town'
      && p.airline === SLUG && p.base_iata === BASE && p.town === T0 && p.lived === 'now' && p.lang === 'ja'
      && p.lived_to_year === null && p.good === null && p.concern === null,
      `S3 送ると submit_town_post が1本：会社・基地・街「${T0}」・言葉と、答えた住んだ時期だけ（ほかは null ＝ 未回答。家賃・通勤・was の鍵は無い）`, J(sent));
    if (SLUG === 'cathay-pacific') ok(p.town === '東涌', "S2b （キャセイ）保存の通信は town '東涌'", J(p.town));
    ok(c && c.head === ADDED && c.mine && c.rows.town && c.rows.town.v === T0 && c.rows.lived && c.rows.lived.v === 'いま住んでいる',
      `S3 保存後のカードは「${ADDED}」と「${MINE}」・街「${T0}」・住んだ時期「いま住んでいる」`, J(c));
    const rows = await rowsOf('a');
    ok(rows.length === 1 && rows[0].town === T0 && rows[0].lived === 'now',
      `S3 保存先に、'a' の行が1つ（「${T0}」・いま住んでいる）`, J(rows));
    await a.page.reload({ waitUntil: 'load' });
    await a.page.waitForFunction(() => !!window.PVContrib, { timeout: 30000 });
    await openTown(a);
    const f1 = await face(a);
    const c0 = f1.chips.find((x) => x.name === T0);
    ok(c0 && c0.mine && f1.chips.filter((x) => x.mine).length === 1 && f1.ctl.town === '' && f1.send === ADD_BTN,
      `S3 読み直して開く：「${T0}」の札に「${MINE}」（ほかの札には無い）・欄は空・ボタンは「${ADD_BTN}」`, J({ chips: f1.chips, town: f1.ctl.town, send: f1.send }));
    await pick(a, T0);
    const f2 = await face(a);
    ok(f2.ctl.lived === 'now' && f2.tag && f2.send === UPD_BTN,
      `S3 「${T0}」を選ぶ → 保存した値（いま住んでいる）が入る・欄の見出しに「${MINE}」・ボタンは「${UPD_BTN}」`, J({ lived: f2.ctl.lived, tag: f2.tag, send: f2.send }));
  });

  const [T0, T1, T2] = NAMES;
  await scene('S3b 街だけを出した会員の一覧', async () => {
    await closeSheet(a);
    await openList(a);
    const la = await listFace(a);
    ok(la.state === 'ok ok' && la.town === 'ok' && la.text !== NONE_YET && la.text === '',
      `S3b 街だけを出した 'a' の一覧：「${NONE_YET}」が出ない（data-pvc-state ok ok・data-pvc-town ok）`, J(la));
    const b = await page({ who: 'b' });
    await go(b);
    await openList(b);
    const lb = await listFace(b);
    ok(lb.state === 'ok ok' && lb.town === 'ok' && lb.text === NONE_YET,
      `S3b 何も出していない 'b' の一覧には「${NONE_YET}」が出る`, J(lb));
    await shut(b);
    await closeSheet(a);
  });

  await scene('S4 直す ── 良い点を足す', async () => {
    await openTown(a);
    await typeTown(a, '');
    await pick(a, T0);
    await typeIn(a, 'good', '駅が近くて静か');
    await tickOwn(a);
    const sent = await send(a);
    const c = await card(a), rows = await rowsOf('a');
    ok(sent.length === 1 && sent[0].p.town === T0 && sent[0].p.good === '駅が近くて静か' && !('was' in sent[0].p)
      && c && c.head === UPDATED && c.rows.good && c.rows.good.v === '駅が近くて静か' && c.rows.good.wait === PENDING
      && rows.length === 1 && rows[0].town === T0 && rows[0].text_state === 'pending' && rows[0].good === '駅が近くて静か',
      `S4 「${T0}」に良い点を足して送る →「${UPDATED}」・良い点の横に「${PENDING}」・保存先は1行のまま（text_state pending）`, J({ sent, c, rows }));
  });

  await scene('S4b 街そのものを直す・足すのは直すことではない', async () => {
    await edit(a);
    const f0 = await face(a);
    await pick(a, T1);
    await tickOwn(a);
    const sent = await send(a);
    const rows = await rowsOf('a');
    ok(f0.ctl.town === T0 && sent.length === 1 && sent[0].p.was === T0 && sent[0].p.town === T1
      && rows.length === 1 && rows[0].town === T1,
      `S4b 保存後のカードの「自分の回答を見る」→「${T1}」を選んで送る：通信に was「${T0}」・行は1つで「${T1}」の下`, J({ f0: f0.ctl.town, sent, rows }));
    await closeSheet(a);
    await openTown(a);
    await typeTown(a, '');
    await pick(a, T0);
    await tickOwn(a);
    const s2 = await send(a);
    const r2 = await rowsOf('a');
    ok(s2.length === 1 && !('was' in s2[0].p) && s2[0].p.town === T0 && r2.length === 2 && J(r2.map((r) => r.town).sort()) === J([T0, T1].sort()),
      `S4b 入口から開いて同じ変更（「${T0}」を選んで送る）：通信に was が無く、行は2つ（足すのは、直すことではない）`, J({ s2, r2 }));
    await closeSheet(a);
  });

  await scene('S4c 「修正」から開いて、戻る → 進む', async () => {
    /* 「修正」の押し所（会社ページの街の欄の「修正」と同じ形 ── data-pvc-open="town" と data-pvc-ctx）。ページにまだ無いので差し込む */
    await a.page.evaluate((nm) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = '修正';
      b.setAttribute('data-pvc-open', 'town'); b.setAttribute('data-pvc-ctx', nm); b.setAttribute('data-test-fix', '');
      b.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9000;min-width:88px;min-height:44px';
      document.body.appendChild(b);
    }, T1);
    await a.page.click('[data-test-fix]');
    await waitTown(a);
    const f0 = await face(a);
    await a.page.evaluate(() => history.back());
    await a.page.waitForFunction(() => { const r = document.querySelector('.pvc-root'); return !r.classList.contains('is-in'); }, { timeout: 20000 });
    await a.page.evaluate(() => history.forward());
    await waitTown(a);
    const f1 = await face(a);
    await pick(a, T2);
    await tickOwn(a);
    const sent = await send(a);
    const rows = await rowsOf('a');
    ok(f0.ctl.town === T1 && f1.ctl.town === T1 && sent.length === 1 && sent[0].p.was === T1 && sent[0].p.town === T2
      && J(rows.map((r) => r.town).sort()) === J([T0, T2].sort()),
      `S4c 「修正」（${T1}）から開く → 戻る → 進む：面は直している途中のまま（欄は「${T1}」）・「${T2}」を選んで送ると通信に was「${T1}」・行は「${T0}」「${T2}」`,
      J({ f0: f0.ctl.town, f1: f1.ctl.town, sent, rows }));
    await closeSheet(a);
    await a.page.evaluate(() => { const b = document.querySelector('[data-test-fix]'); if (b) b.remove(); });
  });

  await scene('S5 0 と未回答と読めない字', async () => {
    await openTown(a);
    await typeTown(a, '');
    await pick(a, T1);
    await unfold(a, 'trip');
    await choose(a, 'mode', 'train');
    await tickOwn(a);
    const s1 = await send(a);
    const c1 = await card(a);
    const p1 = s1[0] && s1[0].p;
    ok(s1.length === 1 && p1.trip && p1.trip.mode === 'train' && p1.trip.minutes === null && !p1.rent && c1 && c1.head === ADDED,
      'S5 交通手段だけ選んで所要時間は空のまま送る → 通信の所要時間は null（0 ではない）・家賃の鍵は無い・保存される', J({ s1, head: c1 && c1.head }));
    await edit(a);
    await typeIn(a, 'minutes', '0');
    await tickOwn(a);
    const s2 = await send(a);
    const f2 = await face(a);
    ok(s2.length === 1 && s2[0].p.trip && s2[0].p.trip.minutes === 0
      && f2.msg.length === 1 && f2.msg[0].title === SAY_NO && f2.msg[0].text === '通勤の所要時間は1〜600分で入れてください'
      && J(f2.bad) === J(['minutes']) && f2.ctl.minutes === '0',
      'S5 所要時間に「0」→ 送られるのは 0・サーバの「通勤の所要時間は1〜600分で入れてください」・所要時間の欄に印・「0」は欄に残る', J({ s2, msg: f2.msg, bad: f2.bad, v: f2.ctl.minutes }));
    await typeIn(a, 'minutes', '');
    await unfold(a, 'rent');
    await choose(a, 'currency', 'JPY');
    await typeIn(a, 'amount', '20万');
    const s3 = await send(a);
    const f3 = await face(a);
    ok(s3.length === 1 && s3[0].p.rent && s3[0].p.rent.amount === '20万' && s3[0].p.rent.currency === 'JPY'
      && f3.msg.length === 1 && f3.msg[0].text === '家賃の月額が正しくありません' && J(f3.bad) === J(['amount']) && f3.ctl.amount === '20万',
      'S5 月額「20万」（通貨 JPY）→ 打ったとおりの字「20万」で送られる・サーバの「家賃の月額が正しくありません」・月額の欄に印・「20万」は欄に残る',
      J({ rent: s3[0] && s3[0].p.rent, msg: f3.msg, bad: f3.bad, v: f3.ctl.amount }));
    await typeIn(a, 'amount', '250,000');
    const s4 = await send(a);
    const c4 = await card(a), r4 = (await rowsOf('a')).find((r) => r.town === T1);
    ok(s4.length === 1 && s4[0].p.rent && s4[0].p.rent.amount === 250000 && c4 && c4.head === UPDATED
      && r4 && Number(r4.amount) === 250000 && r4.currency === 'JPY' && r4.mode === 'train' && r4.minutes === null,
      'S5 月額「250,000」→ 数 250000 で送られ、保存される（保存先は 250000 JPY・所要時間は null のまま）', J({ rent: s4[0] && s4[0].p.rent, r4 }));
  });

  await scene('S6 番地のような字・間取りの断り', async () => {
    await closeSheet(a);
    await openTown(a);
    await typeTown(a, `${T0}1-2-3`);
    await tickOwn(a);
    const s1 = await send(a);
    const f1 = await face(a);
    ok(s1.length === 1 && f1.msg.length === 1 && f1.msg[0].title === SAY_NO && f1.msg[0].text === '街・最寄駅に、番地・部屋番号・URL は書けません'
      && f1.ctl.town === `${T0}1-2-3` && J(f1.bad) === J(['town']),
      `S6 街の欄に「${T0}1-2-3」→「${SAY_NO}」とサーバの「街・最寄駅に、番地・部屋番号・URL は書けません」・打った字は残る・街の欄に印`, J({ msg: f1.msg, v: f1.ctl.town, bad: f1.bad }));
    await typeTown(a, '');
    await pick(a, T1);
    await typeIn(a, 'layout', '1-2-3');
    const s2 = await send(a);
    const f2 = await face(a);
    await shot(a, '390-refused');
    ok(s2.length === 1 && s2[0].p.rent && s2[0].p.rent.layout === '1-2-3'
      && f2.msg.length === 1 && f2.msg[0].text === '間取りが正しくありません' && J(f2.bad) === J(['layout']) && f2.rentOpen && f2.ctl.layout === '1-2-3',
      'S6 間取り「1-2-3」→ サーバの「間取りが正しくありません」・間取りの欄に印・家賃の欄は開いたまま・字は残る', J({ msg: f2.msg, bad: f2.bad, open: f2.rentOpen }));
    await typeIn(a, 'layout', '');
  });

  await scene('S7 届かない → 端末に残る → 続きを開く', async () => {
    await typeIn(a, 'good', '通勤が楽');
    await K.L.failNext('submit_town_post', 'drop', 9);          // 切れた通信はブラウザが自分でやり直すので、何回か切る
    await tickOwn(a);
    const s1 = await send(a);
    const f1 = await face(a);
    await K.L.failOff();
    ok(s1.length === 1 && f1.msg.length === 1 && f1.msg[0].title === FAIL_T && f1.ctl.good === '通勤が楽',
      `S7 通信が切れる →「${FAIL_T}」・打った字は残る`, J({ msg: f1.msg, good: f1.ctl.good }));
    await a.page.reload({ waitUntil: 'load' });
    await a.page.waitForFunction(() => !!window.PVContrib, { timeout: 30000 });
    await K.entry(a);
    await openList(a);
    const l = await listFace(a);
    const box = l.msgs.find((m) => m.text === KEPT);
    ok(!!box && box.acts.includes(RESUME), `S7 読み直して一覧を開く →「${KEPT}」と「${RESUME}」`, J(l.msgs));
    await a.page.click('.pvc-root .pvc-main > .pvc-msg [data-pvc-act="resume"]');
    await waitTown(a);
    const f2 = await face(a);
    ok(f2.ctl.town === T1 && f2.ctl.good === '通勤が楽', `S7 「${RESUME}」→ 街の入力に、打った内容が戻る（「${T1}」・良い点「通勤が楽」）`, J(f2.ctl));
    await tickOwn(a);
    const s2 = await send(a);
    const c2 = await card(a), r2 = (await rowsOf('a')).find((r) => r.town === T1);
    ok(s2.length === 1 && c2 && c2.head === UPDATED && r2 && r2.good === '通勤が楽',
      `S7 そのまま送れる →「${UPDATED}」・保存先の「${T1}」の良い点は「通勤が楽」`, J({ head: c2 && c2.head, r2 }));
    await closeSheet(a);
  });

  await scene('S8 位置を取らない・住所を聞かない・一覧の口を呼ばない', async () => {
    const g = await page({ who: 'b' });
    await g.page.evaluateOnNewDocument(() => {
      const n = { n: 0 };
      window.__geo = n;
      const fake = { getCurrentPosition() { n.n++; }, watchPosition() { n.n++; return 1; }, clearWatch() {} };
      try { Object.defineProperty(Navigator.prototype, 'geolocation', { configurable: true, get: () => fake }); } catch (e) { /* そのまま */ }
    });
    await go(g);
    await openTown(g);
    await pick(g, T0);
    await unfold(g, 'rent');
    await unfold(g, 'trip');
    await typeIn(g, 'good', '検査の字');
    const f = await face(g);
    const geo = await g.page.evaluate(() => window.__geo ? window.__geo.n : -1);
    const named = Object.keys(f.ctl).filter((k) => /addr|住所|lat|lng|geo/i.test(k));
    const gated = g.st.calls.filter((c) => c === 'pv_town_board' || c === 'pv_town_queue');
    ok(geo === 0, 'S8 位置を取らない（navigator.geolocation を数える物に替えて、呼ばれた数は 0）', J({ geo }));
    ok(named.length === 0 && !f.labels.some((l) => /住所/.test(l)), 'S8 「住所」の欄が無い（そう名付いた欄も、そう書いた見出しも無い）', J({ names: Object.keys(f.ctl), labels: f.labels }));
    ok(gated.length === 0 && g.st.calls.includes('pv_town_options'),
      'S8 面は、街の一覧（pv_town_board）も運営の確認待ち（pv_town_queue）も呼ばない（呼ぶのは候補の pv_town_options）', J(g.st.calls));
    await shut(g);
  });

  await scene('S9 打った内容は、自分の投稿のある街を選んでも消えない', async () => {
    const X = T1, Y = T2;
    const put = await rpcAs(base, 'c', 'submit_town_post', { airline: SLUG, base_iata: BASE, town: X, good: '保存した良い点', lang: 'ja' });
    const c = await page({ who: 'c' });
    await go(c);
    await openTown(c);
    await typeIn(c, 'good', '打った良い点');
    await pick(c, X);
    const f1 = await face(c);
    ok(put.body && put.body.ok === true && f1.ctl.good === '打った良い点' && f1.tag && f1.send === UPD_BTN,
      `S9 自分の投稿のある「${X}」を、良い点を打ってから選ぶ → 欄は打った字のまま（保存した字を上に書かない）・「${MINE}」・「${UPD_BTN}」`,
      J({ put: put.body, good: f1.ctl.good, tag: f1.tag, send: f1.send }));
    await tickOwn(c);
    const s1 = await send(c);
    const rows = await rowsOf('c');
    ok(s1.length === 1 && s1[0].p.town === X && s1[0].p.good === '打った良い点' && rows.length === 1 && rows[0].town === X && rows[0].good === '打った良い点',
      `S9 送ると、「${X}」の1行が打った字になる（行は1つ）`, J({ s1, rows }));
    await closeSheet(c);
    await openTown(c);
    await pick(c, X);
    const f2 = await face(c);
    await pick(c, Y);
    const f3 = await face(c);
    ok(f2.ctl.good === '打った良い点' && f2.send === UPD_BTN && f3.ctl.good === '' && f3.send === ADD_BTN && !f3.tag,
      `S9 打つ前に「${X}」を選ぶ → 保存した値が入る／自分の投稿の無い「${Y}」へ移る → 空に戻る（「${ADD_BTN}」）`, J({ f2: f2.ctl.good, f3: f3.ctl.good, send: f3.send }));
    await shut(c);
  });

  await scene('X1 街の読みが失敗・止まっても、月の勤務は待たない', async () => {
    const w = await rpcAs(base, 'b', 'submit_work_month', { airline: SLUG, year: LAST.y, month: LAST.m, position: 'fo', fleet: FLEET, block_hours: 40, stay_nights: 3, lang: 'ja' });
    if (!(w.body && w.body.ok)) throw new Error('前提が崩れた（月の勤務を置けない）: ' + J(w.body || w.text));
    /* 月の勤務の入力が描かれるたびに、読み込み中（欄が閉じている）か・値が入っているかを書き留める */
    const watch = () => {
      const log = [];
      window.__draws = log;
      new MutationObserver((ms) => {
        for (const m of ms) for (const n of m.addedNodes) {
          if (!(n instanceof HTMLElement)) continue;
          const f = n.matches('form[data-pvc-form="work"]') ? n : n.querySelector && n.querySelector('form[data-pvc-form="work"]');
          if (!f) continue;
          const s = f.querySelector('fieldset.pvc-set'), wt = f.querySelector('[data-pvc-wait]');
          log.push({ off: !!(s && s.disabled), wait: wt ? wt.textContent : '', block: (f.querySelector('[name="block_hours"]') || {}).value || '' });
        }
      }).observe(document, { subtree: true, childList: true });
    };
    const workReady = (p) => sheetIn(p, `const f = r.querySelector('form[data-pvc-form="work"]'), s = f && f.querySelector('fieldset.pvc-set');
      return !!s && !s.disabled && f.querySelector('[name="block_hours"]').value !== '';`);
    const b = await page({ who: 'b' });
    await b.page.evaluateOnNewDocument(watch);
    await go(b);
    await K.L.failNext('my_town_posts', '', 1);
    await b.page.evaluate(() => window.PVContrib.open({ topic: 'work' }));
    await workReady(b);
    await until(() => b.st.got.some((x) => x.fn === 'my_town_posts'));
    await b.page.evaluate(() => fetch('/pv-vocab.json', { cache: 'no-store' }).then((r) => r.text()));
    await K.L.failOff();
    const draws = await b.page.evaluate(() => window.__draws);
    const town = b.st.got.filter((x) => x.fn === 'my_town_posts').map((x) => x.status);
    const filled = draws.filter((d) => !d.off), waits = draws.filter((d) => d.wait === LOADING);
    ok(J(town) === J([503]) && filled.length === 1 && filled[0].block === '40' && waits.length <= 1,
      'X1 自分の街の投稿の読みが失敗しても（failNext → 503）、月の勤務の入力は保存した値（40）で1回だけ描かれ、読み込み中の行は2度と出ない',
      J({ town, draws }));
    await b.page.evaluate(() => window.PVContrib.open({ topic: 'list' }));
    await sheetIn(b, `const st = r.querySelector('[data-pvc-state]'); return !!r.querySelector('.pvc-tiles') && !!st && st.getAttribute('data-pvc-town') === 'fail';`);
    const l = await listFace(b);
    ok(l.state === 'ok ok' && l.town === 'fail', 'X1 一覧は今までの2つの状態のまま（ok ok）・街の読みは fail', J(l));
    await K.entry(b);
    await b.page.evaluate(() => window.PVContrib.open({ topic: 'town' }));
    await waitTown(b);
    const f = await face(b);
    ok(f.wait === NOREAD,
      `X1 街の入力は使える（欄が開いている）・読み込み中の行は残らず「${NOREAD}」`, J({ wait: f.wait }));
    await shut(b);

    const s = await page({ who: 'b' });
    await s.page.evaluateOnNewDocument(() => {
      const F = window.fetch;
      window.__stalled = 0;
      window.fetch = function (input, init) {
        const u = String((input && input.url) || input);
        if (/\/rest\/v1\/rpc\/my_town_posts(\?|$)/.test(u)) { window.__stalled++; return new Promise(() => {}); }
        return F.apply(this, arguments);
      };
    });
    await go(s);
    await s.page.evaluate(() => window.PVContrib.open({ topic: 'work' }));
    await workReady(s);
    const held = await s.page.evaluate(() => window.__stalled);
    ok(held >= 1 && !s.st.got.some((x) => x.fn === 'my_town_posts'),
      'X1 街の読みが止まったまま（返事が来ない）でも、月の勤務の入力はすぐ使える（保存した値・欄が開いている）', J({ held }));
    await shut(s);
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
const blocked = PAGES.flatMap((p) => [...p.st.blocked]), supa = PAGES.flatMap((p) => [...p.st.supa]), errs = PAGES.flatMap((p) => p.st.errs);
console.log('');
ok(PAGES.length > 0 && blocked.length === 0 && supa.length === 0,
  `★どのページ（${PAGES.length}枚）の st.blocked と st.supa も空 ── 手元と書体・部品の配信元のほかへ、1本も投げていない`, J({ blocked, supa }));
ok(errs.length === 0, '★どのページにも、スクリプトの止まり（pageerror）が無い', J(errs));
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exitCode = fail ? 1 : 0;
