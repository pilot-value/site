/* shot-deep.mjs — DEEP PAY（deep-pay.html）を localhost の実ページで撮る。

   shot-value.mjs と同型。pv_deep_pay() はオーナーが db/deep-pay.sql を
   Supabase に貼るまで本番に入らないので、クライアントごと差し替えて
   合成データで実物を描かせる。
   ★ ここで使う数字は全部でたらめ。実物の給与はこのリポジトリに1つも無い。
   ⚠️ shot-*.mjs の見本は**腐る**（CLAUDE.md の ST_LOCK と同じ）。
      「本番でもこう出る」と読まないこと。ここで確かめるのは**配置だけ**。
   ⚠️ 2026-08-30 以降、画面は**区分を選ぶまで何も出さない**。だからここも
      「開く → 選択肢が生えるのを待つ → 選ぶ → 描き終わるのを待つ」まで
      やってから撮る。選ばずに撮ると、どの scene も同じ空の板が写る。

   実行: node shot-deep.mjs <scene> <lang> <theme> <幅> [open]
     scene: full  … 全部そろった状態（モックと同じ配置。既定）
            day1  … 現実の初日。KPI は4枚中2枚・給与構成は出ない・
                    働き方は1行しか無いので節ごと消える・変動給も出ない
            fold  … 3人に満たない項目が「その他・未分類」に畳まれた状態
                    （灰色の意味が変わるので but 書きが1行増える）
            ask   … 開いた直後。まだ何も選んでいない（★これが入口の見た目）
            pos   … 役職だけ選んで会社を選ばなかった状態
            pick  … 自分の区分ではない区分を手で選んだ状態（JAL / 機長 / B787）
            thin  … 手で選んだ区分が3人に届かなかった状態
                    （★広い区分の数字で埋めない。何も出ないのが正しい）
            lock  … 鍵がまだ無い（給与を1件も出していない）
            det   … 鍵はあるが内訳を書いていない
            err   … サーバが返らなかった
     lang : ja | en
     theme: light | dark
   保存先は screenshot.mjs と同じ ./temporary screenshots/

   末尾に open を付けると、撮らずに**見える窓で開いたまま**にする。
     node shot-deep.mjs full ja light 1440 open
*/
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scene = process.argv[2] || 'full';
const lang  = process.argv[3] || 'ja';
const theme = process.argv[4] || 'light';
const vw    = Number(process.argv[5]) || 1440;
const open  = process.argv.includes('open');
const measure = process.argv.includes('measure');

const dir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const label = `deep-${scene}-${lang}-${theme}` + (vw !== 1440 ? `-${vw}` : '');
let n = 1;
while (fs.existsSync(path.join(dir, `screenshot-${n}-${label}.png`))) n++;
const outPath = path.join(dir, `screenshot-${n}-${label}.png`);

const url = `http://localhost:3000/${lang === 'en' ? 'en/' : ''}deep-pay.html`;

/* scene ごとに「窓の中で何を選ぶか」。★画面は選ぶまで何も出さないので、
   これが無いと撮れるのは「区分を選んでください」の板だけになる。
   lock / err / 未登録の scene は選ばない（選べる欄がそもそも出ない）。 */
const PICK = {
  /* ★ask は載せない（＝何も選ばない）。それが開いた直後の見た目そのもの。 */
  full: { airline: 'ana', position: 'cap', fleet: 'b787' },
  day1: { airline: 'ana' },
  fold: { airline: 'ana', position: 'cap' },
  pos:  { position: 'cap' },
  pick: { airline: 'jal', position: 'cap', fleet: 'b787' },
  thin: { airline: 'sas' },
  det:  { airline: 'ana' }
}[scene] || null;

/* ★ headless:'new' はこの環境で page.screenshot() が返ってこない
   （shot-tracker.mjs に実測の経緯あり）。chrome-headless-shell を使う。 */
const browser = await puppeteer.launch(open
  ? { headless: false, defaultViewport: null, args: ['--no-sandbox', `--window-size=${vw},1000`] }
  : { headless: 'shell', args: ['--no-sandbox'] });
const page = (await browser.pages())[0] || await browser.newPage();
if (!open) await page.setViewport({ width: vw, height: 1000 });

page.on('pageerror', (e) => console.log('❌ page error:', e.message));

/* ★ setRequestInterception は使わない（CDP デッドロック。shot-tracker.mjs 参照）。
   CDN の supabase-js に上書きさせない目的は defineProperty で達成する。 */
await page.evaluateOnNewDocument((scene, theme) => {
  localStorage.setItem('pv-theme', theme);
  const UID = '00000000-0000-4000-8000-00000000a001';

  const STATS = { reports: 58, month: 12, airlines: 19, contributors: 37 };

  /* 段1（会社×役職×機材）まで届いた状態。★合計はちょうど100。
     サーバ（db/deep-pay.sql の pv_deep_pct）が最大剰余法で揃えて返すため。 */
  const FULL = {
    ok: true, state: 'open',
    gate: { key: true, detailed: true, contributors: 37, goal: 100 },
    give: { detailed: true },
    stats: STATS,
    cohort: { level: 'airline_pos_fleet', airline: 'ana', pos: 'fo', fleet: 'a320', n: 12 },
    head: { annual_usd: 110000, per_block_usd: 93, detailed_n: 12, verified_n: 7, fixed_pct: 62 },
    comp: {
      total_kind: 'monthly_cash', n: 12,
      segs: [
        { k: 'fixed',    pct: 52, med_usd: 4800 },
        { k: 'variable', pct: 24, med_usd: 2200 },
        { k: 'command',  pct: 8,  med_usd: 730 },
        { k: 'perdiem',  pct: 7,  med_usd: 640 },
        { k: 'housing',  pct: 5,  med_usd: 460 },
        { k: 'other',    pct: 4,  med_usd: 370 }
      ],
      bonus: { pct_of_annual: 5, n: 9 }
    },
    work: { block_h: 74.0, duty_h: 141.0, duty_days: 18, stay_nights: 9 },
    /* ⚠️ night / weekend / holiday は3つのまま。1行にまとめない（仕様の明示的な禁止）。 */
    var: [
      { k: 'block',    pct: 46 }, { k: 'sector',  pct: 21 },
      { k: 'overtime', pct: 13 }, { k: 'night',   pct: 11 },
      { k: 'weekend',  pct: 6 },  { k: 'holiday', pct: 3 }
    ]
  };

  /* 現実の初日。10〜30人が30社×4役職に散っているので、届くのは段4だけ。
     ★ここで「出ない」ことが正しい出力。0 を並べた画面と見比べるために撮る。 */
  const DAY1 = Object.assign({}, FULL, {
    cohort: { level: 'pos', airline: 'ana', pos: 'fo', fleet: 'a320', n: 12 },
    head: { annual_usd: 110000, per_block_usd: null, detailed_n: 12,
            verified_n: 3, fixed_pct: null },
    comp: null,
    work: { block_h: 74.0, duty_h: null, duty_days: null, stay_nights: null },
    var: []
  });

  // 3人に満たない項目が未分類に畳まれた状態（灰色の意味が変わる）
  const FOLD = Object.assign({}, FULL, {
    cohort: { level: 'airline_pos_cat', airline: 'ana', pos: 'fo', fleet: 'a320', n: 5 },
    head: { annual_usd: 96000, per_block_usd: 78, detailed_n: 5, verified_n: 2, fixed_pct: 58 },
    comp: {
      total_kind: 'monthly_cash', n: 5,
      segs: [
        { k: 'fixed',    pct: 58, med_usd: 2900 },
        { k: 'variable', pct: 26, med_usd: 1300 },
        { k: 'perdiem',  pct: 7,  med_usd: 350 },
        { k: 'rest',     pct: 9,  med_usd: null }
      ],
      bonus: null
    },
    work: { block_h: 68.5, duty_h: 128.0, duty_days: null, stay_nights: 7 },
    var: [{ k: 'block', pct: 62 }, { k: 'duty', pct: 38 }]
  });

  const POS = Object.assign({}, FULL, {
    cohort: { level: 'pos', airline: 'ana', pos: 'fo', fleet: 'a320', n: 22 }
  });

  const LOCK = { ok: true, state: 'locked', stats: STATS, give: { detailed: false },
                 gate: { key: false, detailed: false, contributors: 37, goal: 100 },
                 cohort: null, head: null, comp: null, work: null, var: null };
  const DET  = Object.assign({}, LOCK, { give: { detailed: false },
                 gate: { key: true, detailed: false, contributors: 37, goal: 100 } });

  /* 手で選んだ区分（2026-08-30）。自分は ANA の FO なのに JAL の機長・787 を見ている。
     ★n=5 なので信頼度は「中」。3つとも選んでいても人数で頭打ちになる。 */
  const PICK = Object.assign({}, FULL, {
    cohort: { level: 'selected', manual: true, airline: 'jal', pos: 'cap', fleet: 'b787', n: 5 },
    head: { annual_usd: 210000, per_block_usd: 180, detailed_n: 5, verified_n: 3, fixed_pct: 71 }
  });
  /* 選んだ区分が3人に届かなかった状態。★広い区分に登らないので、出るものが何も無い。
     「あと1人」とも書かない（書くと人数が1人単位で読める）。 */
  const THIN = { ok: true, state: 'open', stats: STATS, give: { detailed: true },
    gate: { key: true, detailed: true, contributors: 37, goal: 100 },
    cohort: { level: 'none', manual: true, airline: 'sas', pos: null, fleet: null, n: 0 },
    head: { annual_usd: null, per_block_usd: null, detailed_n: null, fixed_pct: null },
    comp: null, work: null, var: [] };

  const SCENES = { full: FULL, day1: DAY1, fold: FOLD, pos: POS,
                   pick: PICK, thin: THIN, lock: LOCK, det: DET };
  const DEEP = SCENES[scene] || FULL;

  const RPC = {
    /* ★選んだ区分に答える（2026-08-30）。ここを () => DEEP のままにすると、
       窓の中でセレクタを動かしても**答えが1つも変わらない**＝
       「壊れている」ように見えて、配置の確認にならない。
       返す数字はでたらめだが、**選んだ値をそのまま映す**ところは本物と同じ。
       ⚠️ sas（スカンジナビア航空）だけは「3人に届かなかった」を返す。
          空の状態を窓の中で実際に踏めるようにするための細工で、
          本番の人数とは何の関係も無い。 */
    pv_deep_pay: (a) => {
      const q = (a && a.p) || {};
      if (!q.airline && !q.position && !q.fleet) return DEEP;   /* 選んでいない＝その scene のまま */
      const echo = { manual: true, airline: q.airline || null,
                     pos: q.fleet && !q.position ? null : (q.position || null),
                     fleet: q.fleet || null };
      if (q.airline === 'sas')
        return Object.assign({}, THIN,
          { cohort: Object.assign({ level: 'none', n: 0 }, echo) });
      /* ★土台は**その scene の payload**。FULL に潰すと day1（薄い初日）や
         fold（畳まれた状態）が選んだ瞬間に満杯へ化けて、確かめたい配置が消える。 */
      const k = (q.airline ? 1 : 0) + (q.position ? 1 : 0) + (q.fleet ? 1 : 0);
      return Object.assign({}, DEEP, {
        cohort: Object.assign({ level: 'selected', n: k >= 3 ? 5 : k === 2 ? 9 : 14 }, echo),
        head: (k >= 3 && DEEP === FULL) ? PICK.head : DEEP.head
      });
    },
    pv_pay_rows: () => ({ ok: true, state: 'open', rows: [], stats: STATS,
                          give: { detailed: !!(DEEP.give && DEEP.give.detailed) } }),
    pv_give_progress: () => ({ ok: true, contributors: STATS.contributors,
                               give: DEEP.give || { detailed: false } }),
    pv_my_referral: () => ({ ok: true, code: 'SAMPLE', tier: 0 })
  };

  function q(rows) {
    const o = {
      data: rows, error: null,
      select: () => o, eq: () => o, in: () => o, order: () => o, limit: () => o,
      update: () => o, insert: () => o,
      single: async () => ({ data: Array.isArray(rows) ? rows[0] : rows, error: null }),
      maybeSingle: async () => ({ data: Array.isArray(rows) ? (rows[0] || null) : rows, error: null }),
      then: (res) => res({ data: Array.isArray(rows) ? rows : [rows].filter(Boolean), error: null })
    };
    return o;
  }
  const FAKE = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: UID, email: 'pilot@example.com' } } } }),
      getUser:    async () => ({ data: { user: { id: UID, email: 'pilot@example.com' } } }),
      signOut:    async () => ({ error: null })
    },
    from: (t) => {
      if (t === 'profiles') return q([{ id: UID, name: 'Sample Pilot',
        email: 'pilot@example.com', company: 'ANA', position: 'fo' }]);
      return q([]);
    },
    /* err のときだけ error を返す。★画面が「読み込めませんでした」を出すか、
       それとも 0 を並べるかは、ここでしか見分けられない。 */
    rpc: async (name, a) => (scene === 'err' && name === 'pv_deep_pay')
      ? { data: null, error: { message: 'synthetic failure' } }
      : { data: RPC[name] ? RPC[name](a) : { ok: true }, error: null }
  };
  Object.defineProperty(window, 'supabase', {
    value: { createClient: () => FAKE }, writable: false, configurable: false
  });
}, scene, theme);

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
/* ★時間で待たない（混んだ回に嘘の結果が出る）。「描き終わった」条件で待つ。
   deep-pay.js は必ず #dp-hd に <h1> を書き込んでから他を描く。 */
await page.waitForFunction(
  () => !!document.querySelector('#dp-hd h1'), { timeout: 15000 });
await page.waitForFunction(
  () => !document.querySelector('#dp-kpi .mr-skel'), { timeout: 15000 });

if (PICK) {
  const IDS = { airline: 'dp-pk-air', position: 'dp-pk-pos', fleet: 'dp-pk-flt' };
  /* ★選択肢が生えるのを待ってから入れる。語彙（pv-vocab.json / salary-data.json）は
     RPC より遅れて着くことがあり、待たずに value を入れると空文字のまま静かに
     素通りする＝「選んだのに何も出ない」という嘘の結果になる。 */
  await page.waitForFunction((p, ids) => Object.keys(p).every((k) =>
    !!document.querySelector('#' + ids[k] + ' option[value="' + p[k] + '"]')),
    { timeout: 15000 }, PICK, IDS);
  await page.evaluate((p, ids) => {
    for (const k of Object.keys(p)) {
      const e = document.getElementById(ids[k]);
      e.value = p[k];
      e.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, PICK, IDS);
  /* 描き終わり＝KPI か「まだ出せません」の板のどちらかが在ること。 */
  await page.waitForFunction(
    () => !!document.querySelector('#dp-kpi .dp-kpi, #dp-kpi .dp-msg'), { timeout: 15000 });
}

/* ── 実測（`measure` を付けたとき）────────────────────────────────
   ★<select> は中身が入り切らなくても黙って端で切る（省略記号すら出ない）。
     選択肢の実幅を canvas で測り、欄の内寸と突き合わせる。 */
if (measure) {
  const rep = await page.evaluate(() => {
    const px = (v) => Math.round(v * 10) / 10;
    const cv = document.createElement('canvas').getContext('2d');
    return [...document.querySelectorAll('.dp-pick-s')].map((e) => {
      const cs = getComputedStyle(e);
      cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const widest = [...e.options].reduce(
        (a, o) => Math.max(a, cv.measureText(o.text).width), 0);
      const inner = e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const selw = cv.measureText(e.selectedOptions[0]?.text || '').width;
      return { id: e.id, box: px(e.getBoundingClientRect().width), inner: px(inner),
               widest: px(widest), sel: e.selectedOptions[0]?.text || '',
               /* ★見えているのは「選んだ1つ」。落ちるのはそれが切れたときだけ。
                  いちばん長い選択肢は、開いた一覧の中でしか出ない（端末側の描画）。 */
               cut: px(inner - 18 - selw),
               short: px(inner - 18 - widest) };   // 18px ≒ 端末の▼
    });
  });
  console.log(`── ${scene} / ${lang} / ${theme} / ${vw}px ──`);
  for (const s of rep)
    console.log(`  ${s.cut < 0 ? '❌' : (s.short < 0 ? '△' : '✓ ')} ${s.id.padEnd(10)} `
      + `欄 ${String(s.box).padStart(6)}px 内寸 ${String(s.inner).padStart(6)} / `
      + `いま出ている ${String(s.cut).padStart(6)} / 最長 ${String(s.short).padStart(6)}  [${s.sel}]`);
  await browser.close();
  process.exit(0);
}

if (open) {
  console.log(`開きました（${scene} / ${lang} / ${theme}）。窓を閉じると終わります。`);
  await new Promise((r) => browser.on('disconnected', r));
  process.exit(0);
}
await page.screenshot({ path: outPath, fullPage: true });

/* ★横スクロールはスクショに写らない。幅を指定して撮ったら必ず数えて出す。 */
const over = await page.evaluate(() => {
  const w = document.documentElement.clientWidth;
  const list = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || getComputedStyle(el).position === 'fixed') continue;
    if (r.right > w + 1 || r.left < -1) {
      list.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}` +
                `${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}` +
                ` → ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
  }
  return { doc: document.documentElement.scrollWidth, view: w, list: list.slice(0, 8) };
});
console.log(over.doc > over.view + 1
  ? `❌ 横スクロールがある（文書 ${over.doc}px / 画面 ${over.view}px）\n   ${over.list.join('\n   ')}`
  : `✓ 横スクロールなし（${over.view}px）`);

await browser.close();
console.log(outPath);
