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
            long  … 書く欄に500字ちょうど入れた状態（★全文が見えて、
                    右の列からはみ出さないことを目で見る）
            img   … 添付の絵（★公開済みは出て、確認待ちは自分の行にだけ出る）
            priv  … 「運営だけに見せる」の札が付いた行
            attach… 絵を1枚選んだ直後（★端末の中での焼き直しを実際に走らせる）
            talk  … コメントを開いた状態（★投稿者・運営・匿名1・匿名2 の名乗り）
            nogive… 給与を1件も出していない人がコメントを開いた（★門が閉じている）
     lang : ja | en    theme: light | dark    width: 1280 / 390 など
     第5引数 open ＝撮らずに見える窓で開いたままにする（オーナーに見せる用）
     第5引数 top  ＝縦に全部つなげず、上から1画面ぶんだけ撮る
     第5引数 probe＝撮らずに寸法だけ出す（横溢れ・絵の実寸）
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

const SCENES = ['full', 'empty', 'admin', 'dead', 'near', 'long', 'img', 'priv', 'attach',
                'talk', 'nogive'];
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
    like_count: 1, liked_by_me: false, is_hidden: null, comment_count: 0,
    /* ★サーバは必ずこの2つを返す。見本でも必ず持たせる
       （持たせないと「返ってこないときの見え方」を撮ってしまう）。 */
    image: 'none', visibility: 'public'
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

  /* 添付の絵。★確認待ちの絵は、サーバが第三者へ image:'none' を返す
     （あることすら出さない）。見本もそのとおりに作る。
     img  … 一般ユーザー。1件目は公開済み・2件目は自分が出した確認待ち
     admin … 運営。確認待ちがそのまま見えて、公開／見送りの操作が出る */
  if (scene === 'img' || scene === 'admin') {
    ITEMS[0].image = 'public';
    ITEMS[1].image = 'pending';
  }
  /* コメントの見本。★名乗りは who と n だけ ── サーバはハッシュを返さない。
     `<script>` を1件入れてあるのは、要望の本文と同じく文字として出ることを目で見るため。 */
  const COMMENTS = [
    { id: 'c1', who: 'author', n: null, mine: false, is_hidden: null,
      created_at: '2026-08-12T10:00:00Z',
      body: '書いた本人です。長距離と短距離だけでなく、貨物も分けて見たいです。' },
    { id: 'c2', who: 'staff', n: null, mine: false, is_hidden: null,
      created_at: '2026-08-13T09:30:00Z',
      body: '運営です。機材と職位までは既に持っているので、路線の区分をどう取るかを検討します。' },
    { id: 'c3', who: 'anon', n: 1, mine: false, is_hidden: null,
      created_at: '2026-08-14T22:10:00Z',
      body: '同じことを思っていました。同じ777でも貨物は Days off がまるで違います。\n'
          + '月あたりのブロック時間も一緒に並べてもらえると助かります。' },
    { id: 'c4', who: 'anon', n: 2, mine: true, is_hidden: null,
      created_at: '2026-08-15T07:45:00Z',
      body: '<script>alert(1)</script> と書いても、そのまま文字として出ますか？' }
  ];
  if (scene === 'admin') {
    COMMENTS.forEach((c) => { c.is_hidden = false; });
    COMMENTS.push({ id: 'c5', who: 'anon', n: 3, mine: false, is_hidden: true,
                    created_at: '2026-08-16T11:00:00Z',
                    body: '（伏せたコメントの見本。一般ユーザーには返らない）' });
  }
  if (scene === 'talk' || scene === 'nogive' || scene === 'admin') {
    ITEMS[0].comment_count = COMMENTS.length;
    ITEMS[2].comment_count = 2;
  }

  if (scene === 'priv') {
    ITEMS[1].visibility = 'private';
    ITEMS[3].visibility = 'private';
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
    /* 見本の絵はその場で描いて JPEG にする（大きな定数をこのファイルに置かない）。
       ★本物と同じく base64 だけを返す（data: の頭はサーバも付けない）。 */
    pv_request_image: () => {
      const cv = document.createElement('canvas');
      cv.width = 960; cv.height = 540;
      const cx = cv.getContext('2d');
      const g = cx.createLinearGradient(0, 0, 960, 540);
      g.addColorStop(0, '#132038'); g.addColorStop(1, '#2b4770');
      cx.fillStyle = g; cx.fillRect(0, 0, 960, 540);
      cx.fillStyle = 'rgba(255,255,255,.16)';
      for (let i = 0; i < 6; i++) cx.fillRect(80, 120 + i * 56, 300 + i * 88, 26);
      cx.fillStyle = '#ffffff';
      cx.font = 'bold 40px sans-serif';
      cx.fillText('見本の画像（スクリーンショット）', 80, 80);
      return { ok: true, mime: 'image/jpeg', w: 960, h: 540, state: 'public',
               b64: cv.toDataURL('image/jpeg', 0.8).split(',')[1] };
    },
    pv_request_set_image_state: (a) => ({ ok: true, image: (a && a.p_state) || 'public' }),
    /* ★書けるかを決めるのはサーバ（pv_my_give の basic）。画面はこの真偽に従うだけ。 */
    pv_request_comments_list: (a) => ({
      ok: true, id: (a && a.p_id) || '', total: COMMENTS.length,
      limit: 50, offset: 0, can_write: scene !== 'nogive', items: COMMENTS.slice()
    }),
    pv_request_comment_add: (a) => ({
      ok: true,
      item: { id: 'c9', who: 'anon', n: 4, mine: true, is_hidden: null,
              created_at: '2026-09-04T00:00:00Z', body: (a && a.p_body) || '' }
    }),
    pv_request_comment_set_hidden: (a) => ({ ok: true, is_hidden: !!(a && a.p_hidden) }),
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

/* 絵は行ごとに後から取る（一覧の返事に画素を載せないため）。
   ★描き終わる前に撮ると、空の枠だけが写って「絵が出ていない」と誤読する。 */
await page.waitForFunction(() => {
  const box = [...document.querySelectorAll('.rm-req-img')];
  if (!box.length) return true;
  return box.every((b) => {
    const im = b.querySelector('img');
    return im && im.complete && im.naturalWidth > 0;
  });
}, { timeout: 8000 }).catch(() => {});

/* ★long ── 500字ちょうど。値を入れるだけでは伸びない（roadmap.js は input で伸ばす）ので、
   本物の input を投げる。ここを await の外に出すと、伸びる前に撮れる。 */
if (scene === 'long') {
  await page.$eval('#rm-body', (el) => {
    const S = '整備の遅延で出発が遅れたとき、待機している間の手当がどう付くのかを会社ごとに並べて見たいです。'
            + '同じ機種・同じ職位でも会社によってまるで違うはずで、そこが転職を考えるときにいちばん知りたい所です。'
            + 'できれば待機1時間あたりの額と、月に何時間くらい発生しているのかの両方が見られると助かります。'
            + 'あと国内線と国際線で分けて見られるとさらに良いです。改行も入れてみます。\n'
            + 'ここから先は、欄がどこまで伸びるのかを確かめるための埋め草です。';
    let v = '';
    while (v.length < 500) v += S;
    el.value = v.slice(0, 500);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() =>
    document.getElementById('rm-body').scrollHeight
      <= document.getElementById('rm-body').clientHeight + 1, { timeout: 5000 });
}

/* talk / nogive ── コメントを実際に開く。★押されるまで取りにいかない造りなので、
   ここを飛ばすと「畳んだままの絵」を撮ってしまう。 */
if (scene === 'talk' || scene === 'nogive') {
  await page.$eval('.rm-cbtn', (b) => b.click());
  await page.waitForFunction(() =>
    !!document.querySelector('.rm-c-list, .rm-c-gate'), { timeout: 8000 });
}

if (open) {
  console.log(`見える窓で開いた: ${url}（${scene} / ${lang} / ${theme}）`);
  console.log('見終わったら Ctrl+C で閉じる。');
  await new Promise(() => {});
}

/* 第5引数 probe ── 撮らずに寸法だけ読む。★横に溢れていないか・絵が本当に
   描けているかは、縮んだ PNG を目で見るより数で見たほうが確かなときがある。 */
/* attach ── 絵を1枚選んだ直後。★端末の中での焼き直し（shrinkImage）を本当に走らせる。
   ここが動かないと絵は1枚も届かないのに、画面は普通に見えたままになる。
   わざと PNG を渡す（JPEG に焼き直す道を通す＝SVG も PNG も必ず JPEG になる）。 */
if (scene === 'attach') {
  await page.evaluate(async () => {
    const cv = document.createElement('canvas');
    cv.width = 1400; cv.height = 900;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#0f1c33'; cx.fillRect(0, 0, 1400, 900);
    cx.fillStyle = 'rgba(255,255,255,.18)';
    for (let i = 0; i < 7; i++) cx.fillRect(90, 190 + i * 84, 420 + i * 120, 38);
    cx.fillStyle = '#ffffff';
    cx.font = 'bold 56px sans-serif';
    cx.fillText('見本のスクリーンショット', 90, 130);
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'screenshot.png', { type: 'image/png' }));
    const el = document.getElementById('rm-img');
    el.files = dt.files;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const p = document.getElementById('rm-img-p');
    const im = p && p.querySelector('img');
    return p && !p.hidden && im && im.complete && im.naturalWidth > 0;
  }, { timeout: 20000 });
}

if (process.argv[6] === 'probe') {
  const r = await page.evaluate(() => {
    const de = document.documentElement;
    const imgs = [...document.querySelectorAll('.rm-req-img img, .rm-f-prev img')]
      .map((im) => ({ nat: im.naturalWidth + 'x' + im.naturalHeight,
                      box: Math.round(im.getBoundingClientRect().width) + 'x' +
                           Math.round(im.getBoundingClientRect().height) }));
    let wide = [];
    document.querySelectorAll('*').forEach((el) => {
      const b = el.getBoundingClientRect();
      if (b.right > de.clientWidth + 1) wide.push(el.className || el.tagName);
    });
    return { doc: de.scrollWidth + ' / ' + de.clientWidth, imgs,
             wide: wide.slice(0, 6),
             wait: [...document.querySelectorAll('.rm-img-w')].map((x) => x.textContent) };
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
  process.exit(0);
}

await page.screenshot({ path: outPath, fullPage: !top });
await browser.close();
console.log(`撮った: ${path.relative(__dirname, outPath)}`);
