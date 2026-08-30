/* shot-compare.mjs — 会社比較（deep-pay-compare.html）を localhost の実ページで撮る。

   shot-deep.mjs と同型。違いは1つだけ ── **会社コードごとに違う答えを返す**
   偽クライアントを入れる。1つの payload を返す偽物では左右が同じ数字になり、
   「差がつくポイント」も「トレードオフ」も出ないので配置の確認にならない。

   ★ ここで使う数字は全部でたらめ。実物の給与はこのリポジトリに1つも無い。
   ⚠️ shot-*.mjs の見本は**腐る**（CLAUDE.md の ST_LOCK と同じ）。
      「本番でもこう出る」と読まないこと。確かめるのは**配置だけ**。
   ⚠️ 画面は**2社そろうまで何も出さない**。だからここも
      「開く → 選択肢が生えるのを待つ → 2社選ぶ → 描き終わるのを待つ」まで
      やってから撮る。選ばずに撮ると、どの scene も同じ「2社選んでください」が写る。

   実行: node shot-compare.mjs <scene> <lang> <theme> <幅> [open]
     scene: full … 両側そろった状態（モック2枚目と同じ配置。既定）
                   ★JAL 側が年収も Block Hours も上回るので**トレードオフが出る**
            thin … 片側が3人に届かなかった状態（右だけ「まだ出せません」・左は普通に出る）
            drop … 片側にパーディアムが無い状態（★その行だけ表から消える。0 と書かない）
            same … 表示される文字列が同じになる状態（★「ほぼ同じ」・勝ち負けの語は出ない）
            ask  … まだ2社そろっていない（入口の板）
            dup  … 左右に同じ会社を選んだ
            lock … 鍵がまだ無い（給与を1件も出していない）
            err  … サーバが返らなかった
     lang : ja | en
     theme: light | dark
   保存先は screenshot.mjs と同じ ./temporary screenshots/

   末尾に open を付けると、撮らずに**見える窓で開いたまま**にする。
     node shot-compare.mjs full ja light 1440 open
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
const label = `cmp-${scene}-${lang}-${theme}` + (vw !== 1440 ? `-${vw}` : '');
let n = 1;
while (fs.existsSync(path.join(dir, `screenshot-${n}-${label}.png`))) n++;
const outPath = path.join(dir, `screenshot-${n}-${label}.png`);

const url = `http://localhost:3000/${lang === 'en' ? 'en/' : ''}deep-pay-compare.html`;

/* scene ごとに「窓の中で何を選ぶか」。★2社そろうまで何も出ないので、
   これが無いと撮れるのは入口の板だけになる。ask / lock / err は選ばない。 */
const PICK = {
  full: { a: 'ana', b: 'jal', pos: 'cap', flt: 'b787' },
  thin: { a: 'ana', b: 'sas' },
  drop: { a: 'ana', b: 'lufthansa' },
  same: { a: 'ana', b: 'emirates' },
  dup:  { a: 'ana', b: 'ana' }
}[scene] || null;

/* ★ headless:'new' はこの環境で page.screenshot() が返ってこない
   （shot-tracker.mjs に実測の経緯あり）。chrome-headless-shell を使う。 */
const browser = await puppeteer.launch(open
  ? { headless: false, defaultViewport: null, args: ['--no-sandbox', `--window-size=${vw},1000`] }
  : { headless: 'shell', args: ['--no-sandbox'] });
const page = (await browser.pages())[0] || await browser.newPage();
if (!open) await page.setViewport({ width: vw, height: 1000 });

page.on('pageerror', (e) => console.log('❌ page error:', e.message));

/* ★ setRequestInterception は使わない（CDP デッドロック。shot-tracker.mjs 参照）。 */
await page.evaluateOnNewDocument((scene, theme) => {
  localStorage.setItem('pv-theme', theme);
  const UID = '00000000-0000-4000-8000-00000000a001';
  const STATS = { reports: 58, month: 12, airlines: 19, contributors: 37 };

  /* 会社ごとの見本。★合計はちょうど100（本番は pv_deep_pct が最大剰余法で揃える）。
     ⚠️ night / weekend / holiday は3つのまま。1行にまとめない（仕様の明示的な禁止）。 */
  const AIR = {
    ana: {
      n: 12,
      head: { annual_usd: 110000, per_block_usd: 93, detailed_n: 12, verified_n: 7, fixed_pct: 62 },
      comp: { total_kind: 'monthly_cash', n: 12, bonus: { pct_of_annual: 5, n: 9 },
        segs: [
          { k: 'fixed',    pct: 52, med_usd: 4800 },
          { k: 'variable', pct: 24, med_usd: 2200 },
          { k: 'command',  pct: 8,  med_usd: 730 },
          { k: 'perdiem',  pct: 7,  med_usd: 640 },
          { k: 'housing',  pct: 5,  med_usd: 460 },
          { k: 'other',    pct: 4,  med_usd: 370 }
        ] },
      work: { block_h: 74.0, duty_h: 141.0, duty_days: 18, stay_nights: 9 }
    },
    /* ★年収も Block Hours もステイも上回る＝**トレードオフの文が出る**側。
       「たくさん飛んでたくさんもらう」がひと目で分かる形にしてある。 */
    jal: {
      n: 8,
      head: { annual_usd: 128000, per_block_usd: 105, detailed_n: 8, verified_n: 5, fixed_pct: 55 },
      comp: { total_kind: 'monthly_cash', n: 8, bonus: { pct_of_annual: 8, n: 6 },
        segs: [
          { k: 'fixed',    pct: 46, med_usd: 4900 },
          { k: 'variable', pct: 31, med_usd: 3300 },
          { k: 'command',  pct: 9,  med_usd: 950 },
          { k: 'perdiem',  pct: 6,  med_usd: 640 },
          { k: 'housing',  pct: 4,  med_usd: 420 },
          { k: 'rest',     pct: 4,  med_usd: null }
        ] },
      work: { block_h: 79.5, duty_h: 152.0, duty_days: 19, stay_nights: 12 }
    },
    /* ★パーディアムの区分が無い会社。表の「パーディアム比率」の行が
       **まるごと消える**ことを見るための見本。0% と書いたら負け。 */
    lufthansa: {
      n: 6,
      head: { annual_usd: 96000, per_block_usd: 84, detailed_n: 6, verified_n: 3, fixed_pct: 71 },
      comp: { total_kind: 'monthly_cash', n: 6, bonus: null,
        segs: [
          { k: 'fixed',    pct: 68, med_usd: 5100 },
          { k: 'variable', pct: 19, med_usd: 1400 },
          { k: 'housing',  pct: 8,  med_usd: 600 },
          { k: 'other',    pct: 5,  med_usd: 380 }
        ] },
      work: { block_h: 66.0, duty_h: 124.0, duty_days: 16, stay_nights: 6 }
    },
    /* ★丸めた後の**表示文字列**が ANA と同じになる見本（年収・固定給比率・
       Block Hours）。生の値では違うのに画面では同じ ── ここで
       「ほぼ同じ」と出ずに勝ち負けを書いたら、それは嘘。 */
    emirates: {
      n: 9,
      head: { annual_usd: 112000, per_block_usd: 93, detailed_n: 9, verified_n: 4, fixed_pct: 62 },
      comp: { total_kind: 'monthly_cash', n: 9, bonus: { pct_of_annual: 5, n: 7 },
        segs: [
          { k: 'fixed',    pct: 49, med_usd: 5200 },
          { k: 'variable', pct: 21, med_usd: 2200 },
          { k: 'perdiem',  pct: 12, med_usd: 1250 },
          { k: 'housing',  pct: 14, med_usd: 1480 },
          { k: 'other',    pct: 4,  med_usd: 420 }
        ] },
      work: { block_h: 74.2, duty_h: 138.0, duty_days: 17, stay_nights: 13 }
    }
  };

  const BOOT = { ok: true, state: 'open', stats: STATS, give: { detailed: true },
                 gate: { key: true, detailed: true, contributors: 37, goal: 100 },
                 cohort: null, head: null, comp: null, work: null, var: null };
  const LOCK = Object.assign({}, BOOT, { state: 'locked', give: { detailed: false },
                 gate: { key: false, detailed: false, contributors: 37, goal: 100 } });

  /* 3人に届かなかった側。★広い区分に登らないので、出るものが何も無い。
     「あと1人」とも書かない（書くと人数が1人単位で読める）。 */
  function thin(code, q) {
    return { ok: true, state: 'open', stats: STATS, give: { detailed: true },
      gate: { key: true, detailed: true, contributors: 37, goal: 100 },
      cohort: { level: 'none', manual: true, airline: code,
                pos: q.position || null, fleet: q.fleet || null, n: 0 },
      head: { annual_usd: null, per_block_usd: null, detailed_n: null,
              verified_n: null, fixed_pct: null },
      comp: null, work: null, var: [] };
  }

  const RPC = {
    /* ★引数なし＝入口の1回（state と鍵を取りに行くだけ）。
       会社を渡されたら**その会社の見本**を返す。ここを1つの payload に
       潰すと左右が同じ数字になり、確かめたい配置が全部消える。
       ⚠️ 一覧に無い会社は「3人に届かなかった」を返す ── 空の状態を窓の中で
          実際に踏めるようにするための細工で、本番の人数とは何の関係も無い。 */
    pv_deep_pay: (a) => {
      const q = (a && a.p) || {};
      if (!q.airline) return scene === 'lock' ? LOCK : BOOT;
      const src = AIR[q.airline];
      if (!src) return thin(q.airline, q);
      return { ok: true, state: 'open', stats: STATS, give: { detailed: true },
        gate: { key: true, detailed: true, contributors: 37, goal: 100 },
        cohort: { level: 'selected', manual: true, airline: q.airline,
                  pos: q.position || null, fleet: q.fleet || null, n: src.n },
        head: src.head, comp: src.comp, work: src.work, var: [] };
    },
    pv_pay_rows: () => ({ ok: true, state: 'open', rows: [], stats: STATS,
                          give: { detailed: true } }),
    pv_give_progress: () => ({ ok: true, contributors: STATS.contributors,
                               give: { detailed: true } }),
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
   deep-pay-compare.js は必ず #dc-hd に <h1> を書き込んでから他を描く。 */
await page.waitForFunction(
  () => !!document.querySelector('#dc-hd h1'), { timeout: 15000 });
await page.waitForFunction(
  () => !document.querySelector('#dc-sides .mr-skel'), { timeout: 15000 });

if (PICK) {
  const IDS = { a: 'dc-pk-a', b: 'dc-pk-b', pos: 'dc-pk-pos', flt: 'dc-pk-flt' };
  /* ★選択肢が生えるのを待ってから入れる。語彙（pv-vocab.json / salary-data.json）は
     RPC より遅れて着くことがあり、待たずに value を入れると空文字のまま静かに
     素通りする＝「選んだのに何も出ない」という嘘の結果になる。 */
  await page.waitForFunction((p, ids) => Object.keys(p).every((k) =>
    !!document.querySelector('#' + ids[k] + ' option[value="' + p[k] + '"]')),
    { timeout: 15000 }, PICK, IDS);
  /* 値は4つとも入れてから change を1回。★1つずつ投げると、途中の
     「片方だけ選んだ対」で余計な RPC が走る（本物の操作でも起きるが、
     ここで見たいのは選び終わった後の画面）。 */
  await page.evaluate((p, ids) => {
    for (const k of Object.keys(p)) {
      const e = document.getElementById(ids[k]);
      if (e) e.value = p[k];
    }
    const first = document.getElementById(ids.a);
    if (first) first.dispatchEvent(new Event('change', { bubbles: true }));
  }, PICK, IDS);
  /* 描き終わり＝2枚のカードか、板（同じ会社・鍵）のどちらかが在って骨が消えたこと。 */
  await page.waitForFunction(
    () => !document.querySelector('#dc-sides .mr-skel') &&
          !!document.querySelector('#dc-sides .dc-side, #dc-sides .dp-msg'),
    { timeout: 15000 });
}

/* ── 実測（`measure` を付けたとき）────────────────────────────────
   ★スクショを目で見て「詰まっている気がする」で直さない。ここで数える。
     <select> は中身が入り切らなくても**黙って端で切る**（省略記号すら出ない）ので、
     選択肢の実幅を canvas で測り、欄の内寸と突き合わせる。 */
if (measure) {
  const rep = await page.evaluate(() => {
    const px = (v) => Math.round(v * 10) / 10;
    const cv = document.createElement('canvas').getContext('2d');
    const sels = [...document.querySelectorAll('.dp-pick-s')].map((e) => {
      const cs = getComputedStyle(e);
      cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const widest = [...e.options].reduce(
        (a, o) => Math.max(a, cv.measureText(o.text).width), 0);
      const inner = e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const selw = cv.measureText(e.selectedOptions[0]?.text || '').width;
      return { id: e.id, font: cs.fontSize, box: px(e.getBoundingClientRect().width),
               inner: px(inner), widest: px(widest), sel: e.selectedOptions[0]?.text || '',
               /* ★見えているのは「選んだ1つ」。落ちるのはそれが切れたときだけ。
                  いちばん長い選択肢は、開いた一覧の中でしか出ない（端末側の描画）。 */
               cut: px(inner - 18 - selw),
               short: px(inner - 18 - widest) };   // 18px ≒ 端末の▼
    });
    const box = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { sel, x: px(r.left), y: px(r.top + scrollY), w: px(r.width), h: px(r.height) };
    };
    const cond = [...document.querySelectorAll('#dc-cond .dp-cond > *')].map((e) => {
      const r = e.getBoundingClientRect();
      return `${e.className || e.tagName} ${px(r.left)}..${px(r.right)}`;
    });
    return { sels, cond,
      boxes: ['#dc-pick .dp-pick', '#dc-cond .dp-cond', '#dc-trade .mr-card',
              '#dc-notes .mr-card', '#dc-mix .mr-card'].map(box).filter(Boolean) };
  });
  console.log(`── ${scene} / ${lang} / ${theme} / ${vw}px ──`);
  for (const s of rep.sels)
    console.log(`  ${s.cut < 0 ? '❌' : (s.short < 0 ? '△' : '✓ ')} ${s.id.padEnd(10)} `
      + `欄 ${String(s.box).padStart(6)}px 内寸 ${String(s.inner).padStart(6)} / `
      + `いま出ている ${String(s.cut).padStart(6)} / 最長 ${String(s.short).padStart(6)}  [${s.sel}]`);
  console.log('  条件バー: ' + (rep.cond.join(' | ') || '（無し）'));
  for (const b of rep.boxes)
    console.log(`  ${b.sel.padEnd(24)} x${String(b.x).padStart(6)} y${String(b.y).padStart(6)} `
      + `w${String(b.w).padStart(6)} h${String(b.h).padStart(6)}`);
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
