/* ═══════════════════════════════════════════════════════════════════
   assert-header.mjs — ヘッダーが幅ごとに正しく畳まれるか

   なぜ要るか
     ヘッダーは Tailwind の `md:`（768px）で真ん中のリンク群が出てくるが、
     **768px では入りきらない**。入らないぶんは文字が2行に折れ、ロゴに重なり、
     英語版は画面の外へ 173px 出ていた（2026-08-19 実測）。
     いまは search.js が **実測して自動で畳む**。畳む判断が JS にあるので、
     HTML を1枚も触っていなくても壊れうる。だから毎回ここで測る。

     ⚠️ `scrollWidth` では測れない。文字が折れて逃げるあいだ `scrollWidth` は
     増えないので「入っていない」ことを検出できない。子の幅を足して比べる。

   見るもの（日英10ページ × 10幅 = 100マス）
     ★ヘッダーは2種類ある。`#main-nav`（サイトの56枚）と `header.mr-top`
       （マイページ系8枚）。**どちらも search.js が ≡ と引き出しを付ける**。
     ★2026-08-27 に一覧を広げた。それまで 6ページ × 7幅（いちばん狭くて 390px）で
       210/210 通っていたが、**壊れている4枚が一覧に無かった**。
       `pay-report` / `submit-review` の日英4枚は `id="main-nav"` を持ちながら
       `search.js` を読んでおらず、iPhone で「← 世界の航空会社」が4行に折れて
       本文へ 109px 垂れていた。320px（iPhone SE 1 / 5s の実幅）も入れてある。
     1) ヘッダーの中身が画面からはみ出さない
     2) `#main-nav` の中に2行になった要素が無い
     3) 隣り合う中身が 20px 未満まで近づかない（入っていても詰まって見える）
     4) 畳んだときだけ ≡ が出る／畳んでいないとき ≡ は出ない
     5) CTA は残る — バーから消えるのは最後の段だけで、そのときは引き出しの先頭にある
     6) 引き出しにそのページのリンクが入っていて、**国別年収が入っていない**、
        **口コミへ行ける**（オーナー決定 2026-08-19）
     7) ★**触れる入力欄の文字が 16px 未満でない**（入力欄のある18枚を 390px で1周）。
        iOS は 16px 未満の入力欄に触れた瞬間ページごと拡大する（**戻らない**。
        こちらから呼ぶ `focus()` でも起きる ── `pay-report` の「匿名で提出」は
        足りない欄へ飛んで focus する）。拡大しているあいだ、`position:fixed` の
        ヘッダーと常設バーは**広げられたレイアウト幅**の箱になり、見えている窓から
        左右へはみ出す＝**両端が切れる**。1)〜3) が全部 ✓ でも実機では切れる。
        2026-08-27、オーナーの iPhone 16 の写真から 1.09 倍の拡大を実測した
        （45.6px の入力欄が 116px。拡大なしなら 107px のはず）。
        手当ては各ページの CSS に
        `@media (pointer:coarse),(max-width:820px){…{font-size:16px}}` を足すこと。
        ⚠️ **16px を下げない。**ここは見た目より先に、拡大させないことが目的。

   使い方（node serve.mjs を起動した状態で）
     node assert-header.mjs
   ═══════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';
import fs from 'fs';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:3000';

/* テンプレートが違うものを1枚ずつ。同じ生成物を並べても同じ形が増えるだけ。 */
const PAGES = [
  ['/',                     'ja トップ'],
  ['/en/',                  'en トップ'],
  ['/world-airlines.html',  'ja 航空会社一覧'],
  ['/community.html',       'ja 口コミ'],
  ['/airlines/ana.html',    'ja 航空会社ページ'],
  ['/en/airlines/ana.html', 'en 航空会社ページ'],
  /* ★ここから下が 2026-08-27 に足した4枚。上の6枚と違うのは
       「ログインの先」＝アプリ側の画面だということ。 */
  ['/pay-report.html',      'ja 給与を出す'],
  ['/submit-review.html',   'ja 口コミを出す'],
  ['/en/pay-report.html',   'en 給与を出す'],
  /* マイページ系（header.mr-top）。ログインしないとヘッダーごと出ないので
     セッションを差し込む。畳む段が無いので ≡ は常に出ているのが正しい。 */
  ['/my-value.html',        'ja マイレポート', { ham: 'always', login: true }],
];
/* ★320px は iPhone SE(1) / 5s の実幅。ここが入っていなかったので
   「最後の段まで畳んでもまだ 30〜40px 足りない」を長いあいだ見逃していた。 */
const WIDTHS = [320, 360, 375, 390, 768, 900, 1024, 1152, 1280, 1440];
const MIN_GAP = 19;          /* search.js の BREATH=20 に測定誤差ぶんの余裕 */
/* ★すき間の検査は 390px 未満では見ない。320px でロゴとボタンのあいだに 20px は
   物理的に取れないし、そこで要るのは「はみ出さない・2行に折れない」だけ
   （search.js の fit() も段④だけは BREATH を見ない。同じ理由）。 */
const GAP_FROM = 390;

let fail = 0, ran = 0;
const ok = (cond, name, detail = '') => {
  ran++;
  if (!cond) fail++;
  console.log(`  ${cond ? '✓' : '✗ FAIL'}  ${name}${detail ? `\n          → ${detail}` : ''}`);
};

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });

/* ── 見た目を測る（1マスぶん）──────────────────────────────────── */
const measure = () => {
  const nav = document.getElementById('main-nav') || document.querySelector('header.mr-top');
  if (!nav || !nav.firstElementChild) return { noNav: true };
  const inner = nav.firstElementChild;
  const vw = document.documentElement.clientWidth;

  const shown = [].filter.call(inner.children, (c) => getComputedStyle(c).display !== 'none');
  const boxes = shown.map((c) => c.getBoundingClientRect()).sort((a, b) => a.left - b.left);
  let minGap = Infinity;
  for (let i = 1; i < boxes.length; i++) minGap = Math.min(minGap, boxes[i].left - boxes[i - 1].right);

  /* 2行になったか — getClientRects() の top を **10px の幅でまとめて** 数える。
     絵文字（🇯🇵）や「▾」はベースラインが 1〜4px ずれるので、
     そのまま重複除去すると全部が「2行」になる。 */
  const SEL = 'a.nav-link,a.btn-ghost,a.btn-primary,a.btn-orange,#nav-auth-btn';
  let over = 0, twoLine = 0;
  const overNames = [], twoNames = [];
  nav.querySelectorAll(SEL).forEach((el) => {
    const b = el.getBoundingClientRect();
    if (b.width === 0) return;
    const label = (el.textContent || '').trim().slice(0, 14);
    if (b.right > vw + 0.5 || b.left < -0.5) { over++; overNames.push(label); }
    const rg = document.createRange();
    rg.selectNodeContents(el);
    const tops = [...rg.getClientRects()].map((r) => Math.round(r.top)).sort((a, c) => a - c);
    const lines = [];
    tops.forEach((t) => { if (!lines.length || t - lines[lines.length - 1] > 10) lines.push(t); });
    if (lines.length > 1) { twoLine++; twoNames.push(label); }
  });

  /* ★リンクや btn-* を持たないヘッダー（マイページ系）でも、はみ出しは見たい。
     中身の箱そのものが画面の外に出ていないかを見る（上の SEL とは別の目）。 */
  let boxOver = 0;
  shown.forEach((c) => {
    const b = c.getBoundingClientRect();
    if (b.width === 0) return;
    if (b.right > vw + 0.5 || b.left < -0.5) boxOver++;
  });

  const ham = document.getElementById('pv-ham-btn');
  const cta = nav.querySelector('.btn-primary,.btn-orange');
  return {
    minGap: minGap === Infinity ? null : Math.round(minGap),
    over, overNames, twoLine, twoNames, boxOver,
    hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    hamVisible: !!ham && getComputedStyle(ham).display !== 'none',
    collapsed: nav.classList.contains('pv-nav-compact'),
    ctaInBar: cta ? cta.getBoundingClientRect().width > 0 : null,
    ctaHidden: nav.classList.contains('pv-nav-min'),
  };
};

/* ── 引き出しの中身を読む ──────────────────────────────────────── */
const readDrawer = () => {
  const btn = document.getElementById('pv-ham-btn');
  if (btn) btn.click();
  const d = document.getElementById('pv-nav-drawer');
  if (!d) return { noDrawer: true };
  const links = [...d.querySelectorAll('.pv-nd-link')].map((a) => ({
    text: (a.textContent || '').trim(),
    href: a.getAttribute('href') || '',
  }));
  const cta = d.querySelector('.pv-nd-cta');
  /* マイページ系のヘッダーには a.nav-link が無い（写す物がゼロ＝共通の6本が出る）。 */
  const navHrefs = [...document.querySelectorAll('#main-nav a.nav-link')].map((a) => a.getAttribute('href') || '');
  return {
    links,
    cta: cta ? { text: (cta.textContent || '').trim(), href: cta.getAttribute('href') || '' } : null,
    navHrefs,
  };
};

const abs = (href, base) => { try { return new URL(href, base).pathname.replace(/\/index\.html$/, '/'); } catch (e) { return href; } };

/* ログインの先の画面は、素の URL だと login.html へ飛ぶ。ヘッダーを測りたいだけなので
   Supabase を丸ごと差し替えてセッションだけ在ることにする。**本番の DB には触らない。**
   ⚠️ rpc / from は本物と同じ「then だけを持つ箱」。async 関数に戻さない
   （呼ぶ側は .select().eq().order() と鎖にしてから await する）。 */
const FAKE_SESSION = () => {
  const UID = '00000000-0000-4000-8000-0000000000aa';
  const box = (data) => {
    const t = {
      select: () => t, eq: () => t, neq: () => t, in: () => t, is: () => t,
      order: () => t, limit: () => t, range: () => t, single: () => t, maybeSingle: () => t,
      then: (f, g) => Promise.resolve({ data, error: null }).then(f, g),
    };
    return t;
  };
  const FAKE = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: UID, email: 'pilot@example.com' } } }, error: null }),
      getUser: () => Promise.resolve({ data: { user: { id: UID, email: 'pilot@example.com' } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: () => Promise.resolve({ error: null }),
    },
    rpc: () => box(null),
    from: () => box([]),
    storage: { from: () => ({ upload: () => Promise.resolve({ data: null, error: null }) }) },
  };
  Object.defineProperty(window, 'supabase', {
    value: { createClient: () => FAKE }, writable: false, configurable: false,
  });
};

for (const [href, label, opt = {}] of PAGES) {
  console.log(`\n═══ ${label}  ${href} ═══`);
  let drawerDone = false;

  for (const w of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: 820 });
    if (opt.login) await page.evaluateOnNewDocument(FAKE_SESSION);
    await page.goto(BASE + href, { waitUntil: 'networkidle2' });
    /* 通貨ピルと言語ボタンはあとから右側に差し込まれる。差し込まれた後を測る。 */
    await new Promise((r) => setTimeout(r, 1200));

    const m = await page.evaluate(measure);
    if (m.noNav) {
      ok(false, `${w}px — ヘッダーがある`, `いま ${page.url()}`);
      await page.close();
      continue;
    }
    const tag = `${String(w).padStart(4)}px`;
    ok(m.over === 0 && m.boxOver === 0, `${tag} 画面からはみ出していない`,
       m.over ? m.overNames.join(' / ') : (m.boxOver ? `中身の箱が ${m.boxOver} 個` : ''));
    ok(m.twoLine === 0, `${tag} 2行に折れた項目が無い`, m.twoLine ? m.twoNames.join(' / ') : '');
    ok(!m.hScroll, `${tag} ページが横に溢れていない`,
       m.hScroll ? 'iOS はここでレイアウト幅を広げ、position:fixed の常設バーが画面より広くなる' : '');
    if (w >= GAP_FROM) {
      ok(m.minGap === null || m.minGap >= MIN_GAP, `${tag} 中身どうしが ${MIN_GAP}px 以上あいている`,
         m.minGap === null ? '' : `いちばん狭いところ ${m.minGap}px`);
    }
    if (opt.ham === 'always') {
      /* マイページ系には畳む段が無い（リンクも CTA も無いので fits() が素通りする）。
         ここで見るのは「≡ がどの幅でも出ている」＝オーナー指示「どの画面も」。 */
      ok(m.hamVisible, `${tag} ≡ が常に出ている`);
    } else {
      ok(m.collapsed === m.hamVisible || (w <= 767 && m.hamVisible),
         `${tag} ≡ は畳んだときだけ出る`, `畳んだ=${m.collapsed} ≡=${m.hamVisible}`);
    }
    /* CTA が無いページ（← トップ だけの一覧・航空会社ページ）は対象外 */
    if (m.ctaInBar !== null) {
      ok(m.ctaInBar || m.ctaHidden, `${tag} CTA が黙って消えていない`,
         m.ctaInBar ? '' : '最後の段＝引き出しの先頭に移した');
    }

    /* 引き出しの中身はページごとに1回だけ（幅で変わらない）。畳む幅で開ける。 */
    if (!drawerDone && m.hamVisible) {
      drawerDone = true;
      const d = await page.evaluate(readDrawer);
      if (d.noDrawer) {
        ok(false, '引き出しがある');
      } else {
        const paths = d.links.map((l) => abs(l.href, BASE + href));
        const navPaths = d.navHrefs.map((h) => abs(h, BASE + href))
          .filter((p) => !/countries\.html$/.test(p));
        const missing = navPaths.filter((p) => !paths.includes(p));
        ok(missing.length === 0, '引き出しにそのページのリンクが全部入っている',
           missing.length ? `足りない: ${missing.join(' / ')}` : `${d.links.length}本`);
        ok(!paths.some((p) => /countries\.html$/.test(p)), '引き出しに国別年収が入っていない',
           paths.filter((p) => /countries\.html$/.test(p)).join(' / '));
        ok(paths.some((p) => /community\.html$/.test(p)), '引き出しから口コミへ行ける');
        /* CTA を持たないページ（← トップ だけの一覧・航空会社ページ）にも
           pv-nav-min は付く。持っているページだけ見る。 */
        if (m.ctaHidden && m.ctaInBar !== null) {
          ok(!!d.cta, 'バーから消した CTA が引き出しの先頭にある', d.cta ? d.cta.text : '');
        }
      }
    }
    await page.close();
  }
}

/* ═══ 7) 触れる入力欄の文字の大きさ（iOS の自動拡大よけ）════════════════════
   上の1)〜6) は「畳んだ後の形」を見ている。ここで見るのは**拡大の引き金**。
   入力欄のある18枚を 390px で1周し、画面に出ている text / select / textarea が
   1つでも 16px 未満なら落とす（checkbox・radio・button は拡大の引き金にならない）。
   ⚠️ 手元の Chrome は `pointer:fine` なので、当たるのは `max-width:820px` の側だけ。
   実機の iPad は 1024px でも `pointer:coarse` で同じ規則が当たる。 */
const HERE = fileURLToPath(new URL('.', import.meta.url));
const hasField = (f) => {
  const t = fs.readFileSync(f, 'utf8');
  return /<textarea|<select|<input(?![^>]*type=["']?(hidden|checkbox|radio|submit|button|file))/i.test(t);
};
const FORM_PAGES = [
  ...fs.readdirSync(HERE).filter((f) => f.endsWith('.html')).map((f) => '/' + f),
  ...fs.readdirSync(HERE + 'en').filter((f) => f.endsWith('.html')).map((f) => '/en/' + f),
].filter((h) => hasField(HERE + h.slice(1)))
  /* ★静的な HTML に <input> が無くても、JS があとから欄を作る画面がある。
     待遇アンケート（pv-conditions.js）と、トップの比較図の会社さがし
     （salary-leveling.js）。ここは手で足す。 */
  .concat(['/airline-conditions.html', '/en/airline-conditions.html', '/', '/en/']);

const smallFields = () => {
  const out = [];
  document.querySelectorAll('input,select,textarea').forEach((el) => {
    const ty = (el.type || '').toLowerCase();
    if (['hidden', 'checkbox', 'radio', 'file', 'submit', 'button', 'range', 'color'].includes(ty)) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const fs2 = parseFloat(cs.fontSize);
    if (fs2 >= 16) return;
    out.push(el.tagName.toLowerCase() + '.' + ((el.className || '').toString().trim().split(/\s+/)[0] || '?') + ' ' + fs2 + 'px');
  });
  return [...new Set(out)];
};

console.log(`\n═══ 触れる入力欄が 16px 未満でない（${FORM_PAGES.length}枚 × 390px）═══`);
for (const href of FORM_PAGES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 820 });
  await page.evaluateOnNewDocument(FAKE_SESSION);   /* ログインの先も測る */
  await page.goto(BASE + href, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 900));
  /* 給与フォームは入口を押すまで欄が出ない（23本ある本体がここから先） */
  await page.evaluate(() => {
    document.getElementById('entry-manual')?.click();   /* 給与フォームの入口 */
    document.getElementById('pv-search-btn')?.click();  /* ヘッダーの検索窓（全ページ） */
  });
  await new Promise((r) => setTimeout(r, 400));
  const small = await page.evaluate(smallFields);
  ok(small.length === 0, `${href}`, small.slice(0, 6).join(' / '));
  await page.close();
}

await browser.close();
console.log(`\n==== ${ran - fail}/${ran} passed ====`);
process.exit(fail ? 1 : 0);
