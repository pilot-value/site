/* shot-roadmap.mjs — ROADMAP & REQUESTS を撮る。

   この画面はログインしないと開かない（pv-session.js の GUARDED）。
   本番の DB も見に行かない ── Supabase のクライアントごと差し替えて、
   本物の roadmap.js に描かせる。撮れた絵はそのまま本番の絵になる。
   やり方は shot-conditions.mjs / shot-tracker.mjs と同じ。

   実行: node shot-roadmap.mjs <scene> <lang> <theme> <width> [open|top]
     scene: full  … ふつうの画面（要望が7件・自分は一般ユーザー）
            empty … 要望がまだ1件も無い（★空でも言葉が出るのが正しい）
            admin … 管理者（★ここにだけ状態を変える操作が出る）
            dead  … 一覧も人数も折れ線も読めなかった
                    （★0件・0人と書かず — と読み直しを出す）
            near  … 次の段の直前（99人）。バーと「あと1人」の見え方
     lang : ja | en    theme: light | dark    width: 1280 / 390 など
     第5引数 open ＝撮らずに見える窓で開いたままにする（オーナーに見せる用）
     第5引数 top  ＝縦に全部つなげず、上から1画面ぶんだけ撮る
   保存先は screenshot.mjs と同じ ./temporary screenshots/

   ⚠️ ここに書く数字は**見本**。本物は pv_give_progress と pv_requests_list が返す。
      画面に出る数を JS 側で作らないことの確認も兼ねているので、
      ここの数字と画面の数字が一致していなければ、そちらが壊れている。
*/
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scene = process.argv[2] || 'full';
const lang  = process.argv[3] || 'ja';
const theme = process.argv[4] || 'light';
const vw    = Number(process.argv[5] || 1280);
const open  = process.argv[6] === 'open';
const top   = process.argv[6] === 'top';

const SCENES = ['full', 'empty', 'admin', 'dead', 'near'];
if (SCENES.indexOf(scene) < 0) {
  console.error(`場面は ${SCENES.join(' / ')} のどれか（渡された値: ${scene}）`);
  process.exit(2);
}

const dir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const label = `roadmap-${scene}-${lang}-${theme}-${vw}`;
let n = 1;
while (fs.existsSync(path.join(dir, `screenshot-${n}-${label}.png`))) n++;
const outPath = path.join(dir, `screenshot-${n}-${label}.png`);

const url = `http://localhost:3000/${lang === 'en' ? 'en/' : ''}roadmap.html`;

const browser = await puppeteer.launch(open
  ? { headless: false, defaultViewport: null, args: [`--window-size=${vw},1000`] }
  : { headless: 'new' });
const page = await browser.newPage();
if (!open) await page.setViewport({ width: vw, height: 1100 });

await page.evaluateOnNewDocument((scene, theme, lang) => {
  localStorage.setItem('pv-theme', theme);
  localStorage.setItem('pv-lang', lang);

  const UID = '00000000-0000-4000-8000-00000000a001';

  /* 見本の要望。★本文はわざと長短・改行・記号を混ぜてある。
     `<script>` を1件入れてあるのは、そのまま文字として出ることを目で見るため
     （roadmap.js は textContent で入れる）。 */
  const mk = (i, o) => Object.assign({
    id: '00000000-0000-4000-8000-0000000000' + String(10 + i),
    body: '要望の本文', category: 'feature', status: 'new',
    created_at: '2026-08-' + String(10 + i).padStart(2, '0') + 'T09:00:00Z',
    like_count: 1, liked_by_me: false, is_hidden: null
  }, o);

  const ITEMS = [
    mk(1, { category: 'data', status: 'building', like_count: 14, liked_by_me: true,
            body: '機種ごとの年収だけでなく、路線（長距離・短距離）で分けて見たいです。同じ777でも貨物と旅客で待遇がかなり違います。' }),
    mk(2, { category: 'feature', status: 'planned', like_count: 9,
            body: 'ローテーションの実態（月あたりの Days off、ホテルの質）を給与と一緒に比べたい。' }),
    mk(3, { category: 'ui', status: 'considering', like_count: 6,
            body: 'スマホで見たときに、給与の入力が1画面で終わるようにしてほしい。\n明細を見ながら打つので、行き来が多いとつらいです。' }),
    mk(4, { category: 'data', status: 'new', like_count: 3,
            body: 'Cathay と HK Express の副操縦士のデータが古いままです。' }),
    mk(5, { category: 'bug', status: 'done', like_count: 2,
            body: '通貨を AED にすると、年収の表示だけ円のままになることがあります。' }),
    mk(6, { category: 'other', status: 'new', like_count: 1,
            body: '<script>alert(1)</script> と書いても、そのまま文字として出ますか？' }),
    mk(7, { category: 'feature', status: 'declined', like_count: 1,
            body: '実名で投稿できるようにしてほしい（※これは受けない要望の見本）。' })
  ];
  if (scene === 'admin') {
    ITEMS.push(mk(8, { category: 'other', status: 'new', like_count: 0, is_hidden: true,
                       body: '（隠した行の見本。一般ユーザーには返らない）' }));
  }

  const N = scene === 'near' ? 99 : 42;
  const RPC = {
    pv_give_progress: () => ({ ok: true, contributors: N, give: { detailed: true } }),
    pv_is_admin: () => scene === 'admin',
    /* 折れ線の見本。★右端は必ず pv_give_progress の人数と同じにする
       （本物の pv_give_growth も pv_pay_person_map を通して同じ数え方をする。
       ここで違う数を返すと、絵で「人数が2つある」を見落とす）。 */
    pv_give_growth: () => {
      const wks = 12, out = [];
      for (let i = 0; i < wks; i++) {
        const t = new Date(Date.UTC(2026, 5, 21) + i * 7 * 864e5);
        out.push({ d: t.toISOString().slice(0, 10),
                   n: Math.max(1, Math.round(N * Math.pow((i + 1) / wks, 1.6))) });
      }
      out[out.length - 1].n = N;
      return out;
    },
    pv_requests_list: (a) => {
      const items = scene === 'empty' ? [] : ITEMS.slice();
      if (a && a.p_sort === 'new') {
        items.sort((x, y) => (x.created_at < y.created_at ? 1 : -1));
      } else {
        items.sort((x, y) => y.like_count - x.like_count);
      }
      /* ★本物と同じく p_limit / p_offset を守る。全件返すと「さらに読む」が
         出ない絵になり、右の列の高さも本番と違ってしまう。 */
      const lim = (a && a.p_limit) || 20, off = (a && a.p_offset) || 0;
      return { ok: true, total: items.length, sort: (a && a.p_sort) || 'popular',
               limit: lim, offset: off, items: items.slice(off, off + lim) };
    },
    pv_request_like_toggle: () => ({ ok: true, like_count: 15, liked_by_me: true }),
    pv_request_submit: (a) => ({
      ok: true,
      item: mk(9, { body: (a && a.p_body) || '', category: (a && a.p_category) || 'other',
                    status: 'new', like_count: 1, liked_by_me: true,
                    created_at: '2026-09-04T00:00:00Z' })
    })
  };

  const FAKE = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: UID, email: 'pilot@example.com' } } } }),
      getUser:    async () => ({ data: { user: { id: UID, email: 'pilot@example.com' } } }),
      signOut:    async () => ({ error: null })
    },
    from: () => {
      const o = {
        data: [], error: null,
        select: () => o, eq: () => o, in: () => o, order: () => o, limit: () => o,
        single: async () => ({ data: null, error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
        then: (res) => res({ data: [], error: null })
      };
      return o;
    },
    /* ★本物の supabase-js が返すのは then だけを持つ箱。async にすると
       本番には無い .catch が生えて、失敗したときの見え方を撮り逃す
       （shot-conditions.mjs に同じ注意書きがある）。 */
    rpc: (name, a) => {
      const DEAD = ['pv_requests_list', 'pv_give_growth', 'pv_give_progress'];
      const res = (DEAD.indexOf(name) >= 0 && scene === 'dead')
        ? { data: null, error: { message: 'stub' } }
        : { data: RPC[name] ? RPC[name](a) : { ok: true }, error: null };
      return { then: (ok, ng) => Promise.resolve(res).then(ok, ng) };
    }
  };
  Object.defineProperty(window, 'supabase', {
    value: { createClient: () => FAKE }, writable: false, configurable: false
  });
}, scene, theme, lang);

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
/* 時間で待たない（混んだ回に嘘の絵になる）。描き終わりの印が出るまで待つ。 */
await page.waitForFunction(() => {
  const list = document.getElementById('rm-req-list');
  const cnt = document.getElementById('rm-count-c');
  const chart = document.getElementById('rm-chart');
  return list && cnt && chart
      && !document.querySelector('.mr-skel')
      && list.children.length > 0;
}, { timeout: 15000 }).catch(() => {});

if (open) {
  console.log(`見える窓で開いた: ${url}（${scene} / ${lang} / ${theme}）`);
  console.log('見終わったら Ctrl+C で閉じる。');
  await new Promise(() => {});
}

await page.screenshot({ path: outPath, fullPage: !top });
await browser.close();
console.log(`撮った: ${path.relative(__dirname, outPath)}`);
