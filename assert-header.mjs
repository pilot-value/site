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
import os from 'node:os';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:3000';

/* ── 同時に開くタブの数 ─────────────────────────────────────────────
   162 回の読み込みのうち **3分の2 は、ただ待っている時間**（下の 1200ms の
   再フィット待ちと networkidle2 の 500ms）。CPU を使うのは1マスあたり 0.8 秒だけ。
   ＝ 4本並べても、実際に描いているのは平均 1.3 本ぶんしかない。
   既定は「コアの半分・2〜6本」。check.mjs:78 の web 側（コア数から引いて頭打ち）と
   同じ考え方に揃えてある。8コアで 4本。

   2026-08-28 の実測（単独・8コア）── 直列 380秒 / -j 4 で 98秒 / -j 10 で 49秒。
   どれも直列版と出力が1バイトも違わなかった。

   ⚠️ **ここを上げても `check.mjs web` は速くならない。他の検査を落とすだけ。**
      実際にやってこうなった（同じ日・同じ機械）:
        中4タブ → web 全体 315秒。ただし db/test-payslip-redact.mjs が7件落ちる
        中2タブ → web 全体 317秒。18本すべて通る
      web 全体は既に CPU で頭打ちで、下限は「仕事の合計 1245秒 ÷ 同時4本 ＝ 311秒」。
      317秒はもうそこに着いている＝タブを増やしても全体は縮まず、奪った CPU のぶん
      隣が飢えるだけ。とくに db/test-payslip-redact.mjs は OCR を40秒で打ち切る決まりで、
      奪われると黒塗りが1つも置けず**最初の様式が7件落ちる**
      （理由は db/test-payslip-redact.mjs:17-24）。
      なので check.mjs は自分から呼ぶときだけ PV_HEADER_JOBS=2 を渡す（check.mjs:104）。
      単独で流すときは既定の4本のまま速い。
   ⚠️ 上げるほど「測る瞬間に他のタブが CPU を持っている」確率が上がる。
      上げたら必ず直列版（PV_HEADER_JOBS=1）と出力を diff し直すこと。 */
const jArg = process.argv.indexOf('-j');
const JOBS = Math.max(1,
  Number(process.env.PV_HEADER_JOBS || (jArg >= 0 ? process.argv[jArg + 1] : 0))
  || Math.min(6, Math.max(2, os.cpus().length >> 1)));

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
  /* ★ロードマップと要望。テンプレートは同じ .mr-shell だが、これは
       このリポジトリで唯一「自由に書ける textarea を持つマイページ」で、
       下の FORM_PAGES にも自動で入る（390px で入力欄が 16px 未満なら iOS が拡大する）。 */
  ['/roadmap.html',         'ja ロードマップ', { ham: 'always', login: true }],
  ['/en/roadmap.html',      'en ロードマップ', { ham: 'always', login: true }],
  /* ★認証4枚。2026-08-27 に header.mr-top 型へ揃えた。それまでは body 直下に
       fixed の div を2つ置くだけの「第3のヘッダー」で、search.js の inject() が
       #main-nav も header.mr-top も見つけられず即 return ＝ ≡ も引き出しも
       原理的に出なかった。この一覧にも撮影にも入っていなかったので誰も見ていなかった。
     ⚠️ login:true を付けない。セッションがあると login.html の「もう入っている人は
        マイページへ」が働いてヘッダーごと消え、必ず落ちる。 */
  ['/login.html',           'ja ログイン',   { ham: 'always' }],
  ['/signup.html',          'ja 新規登録',   { ham: 'always' }],
  ['/en/login.html',        'en ログイン',   { ham: 'always' }],
  ['/en/signup.html',       'en 新規登録',   { ham: 'always' }],
];
/* ★320px は iPhone SE(1) / 5s の実幅。ここが入っていなかったので
   「最後の段まで畳んでもまだ 30〜40px 足りない」を長いあいだ見逃していた。 */
const WIDTHS = [320, 360, 375, 390, 768, 900, 1024, 1152, 1280, 1440];
const MIN_GAP = 19;          /* search.js の BREATH=20 に測定誤差ぶんの余裕 */
/* ★すき間の検査は 390px 未満では見ない。320px でロゴとボタンのあいだに 20px は
   物理的に取れないし、そこで要るのは「はみ出さない・2行に折れない」だけ
   （search.js の fit() も段④だけは BREATH を見ない。同じ理由）。 */
const GAP_FROM = 390;

/* ★並列にしたので console.log を直に呼ばない。行はページごとの箱へ積み、
   全部終わってから **宣言順に** まとめて吐く（PAGES の順・幅の昇順・FORM_PAGES の順）。
   直列で回していた頃と出力を1バイトも変えないため。ここが揃っているから
   「直列版と diff して同一」が検証として使える。
   ran / fail は素のカウンタ。Node は1本の糸で回り、++ と if のあいだに await が
   挟まらないので、並べても数は狂わない。 */
let fail = 0, ran = 0;
const fmt = (cond, name, detail = '') =>
  `  ${cond ? '✓' : '✗ FAIL'}  ${name}${detail ? `\n          → ${detail}` : ''}`;
const mkOk = (lines) => (cond, name, detail = '') => {
  ran++;
  if (!cond) fail++;
  lines.push(fmt(cond, name, detail));
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

/* ── 形が落ち着くまで待つ（下の 1200ms の「後ろ」に足すだけ）──────────────
   search.js:653-660 は load と [0,300,1200]ms の setTimeout から
   requestAnimationFrame 経由で fit() をやり直す。タブを何枚も並べると、
   その最後の 1200ms がこちらの sleep より後ろへずれることがある
   ＝ **最後の再フィットを見ないまま測って ✓ を出す**。並列化でいちばん怖いのはこれ。

   ここで見るのは3つ。どれも「もっと待つ」方向にしか効かない。
     ① ページ側の時計で DOMContentLoaded + 1200ms を過ぎたか
        （search.js は body 末尾の同期スクリプトなので fit の起点は DCL。
          こちらの sleep はページの時計とは別物なので、ページ側で数え直す）
     ② webfont が落ち着いたか（Inter と Noto Sans JP は外から来る。
        当たると文字幅が変わり、nav の形も変わる）
     ③ nav の class と中身の座標が、2フレーム続けて同じか

   ⚠️ **これは 1200 を短くする道具ではない。** 下の sleep は残したまま、その後に
      呼ぶ。上限まで待って駄目なら黙って進み、その回数だけ最後に stderr へ出す
      （0 でないなら -j を下げる合図）。 */
const REFIT_MS = 1200;    /* search.js:660 の最後の setTimeout と同じ数 */
const SETTLE_MAX = 3000;  /* これ以上は待たない */

const settleFn = (refitMs, maxMs) => new Promise((done) => {
  const nav = document.getElementById('main-nav') || document.querySelector('header.mr-top');
  if (!nav || !nav.firstElementChild) return done('nonav');  /* noNav は measure 側が落とす */
  const e = performance.getEntriesByType('navigation')[0];
  const deadline = (e ? e.domContentLoadedEventEnd : 0) + refitMs;
  const t0 = performance.now();
  const sig = () => {
    let s = nav.className;   /* fit() が付け外しする段（compact / tight / min / micro） */
    for (const c of nav.firstElementChild.children) {
      const b = c.getBoundingClientRect();
      s += '|' + Math.round(b.left) + ',' + Math.round(b.right) + ',' + Math.round(b.top);
    }
    return s;
  };
  let fonts = false;
  const mark = () => { fonts = true; };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(mark, mark);
  let prev = sig(), same = 0;
  const tick = () => {
    const s = sig();
    same = s === prev ? same + 1 : 0;
    prev = s;
    const now = performance.now();
    if (fonts && now >= deadline && same >= 2) return done('ok');
    if (now - t0 >= maxMs) return done('timeout');
    /* rAF が来ない場面でも進むよう、保険の setTimeout も張る（先に来たほうで1回だけ） */
    let fired = false;
    const go = () => { if (!fired) { fired = true; tick(); } };
    requestAnimationFrame(go);
    setTimeout(go, 50);
  };
  tick();
});

let settleTimeouts = 0;
const settle = async (page) => {
  try { if (await page.evaluate(settleFn, REFIT_MS, SETTLE_MAX) === 'timeout') settleTimeouts++; }
  catch (e) { settleTimeouts++; }   /* 落ちても黙って進む。合否は measure が出す */
};

async function runPage(href, label, opt, ok) {
  /* ★ページごとに使い捨ての入れ物。**これは保険ではなく必須。**
     localStorage は同一オリジンで全タブ共有で、実際に書く者と読む者が両方いる：
       書く — index.html:1976。`/` を開くとセッションがあれば pv_user を書く。
              下の runForm は**全ページに偽セッションを注入する**ので、
              入力欄の検査が `/` を踏んだ瞬間に書かれる
       読む — search.js:577。pv_user があると**引き出しのログインリンクの文字と
              行き先を差し替える** ＝ readDrawer の結果が変わる
     直列だった頃は入力欄ループが後ろにあったので、この2つは出会わなかった。
     並べて混ぜた瞬間に出会う。入れ物を分けて、出会えなくする。
     ⚠️ **マスごとではなくページごと。** マスごとにすると10幅すべてがキャッシュ
        空っぽからの読み込みになり、外から来るフォントの到着が毎回レースになる
        （＝測る文字幅が変わる）。10幅で1つの入れ物を共有するのは今と同じ状態。 */
  const ctx = await browser.createBrowserContext();
  try {
  let drawerDone = false;

  for (const w of WIDTHS) {
    const page = await ctx.newPage();
    try {
    await page.setViewport({ width: w, height: 820 });
    page.setDefaultNavigationTimeout(60000);   /* 並べると 30s では足りない回が出る */
    if (opt.login) await page.evaluateOnNewDocument(FAKE_SESSION);
    await page.goto(BASE + href, { waitUntil: 'networkidle2' });
    /* 通貨ピルと言語ボタンはあとから右側に差し込まれる。差し込まれた後を測る。 */
    await new Promise((r) => setTimeout(r, 1200));
    await settle(page);   /* ★足したのはこの1行。上の 1200ms は削っていない */

    const m = await page.evaluate(measure);
    if (m.noNav) {
      ok(false, `${w}px — ヘッダーがある`, `いま ${page.url()}`);
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
    } finally { await page.close(); }   /* ★continue でも例外でも閉じ漏れない */
  }
  } finally { await ctx.close(); }
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

/* ここは反復どうしの依存がゼロ。見ているのも文字の大きさだけで、混雑に鈍い。
   settle は要らない（レイアウトが落ち着いたかではなく font-size を読むだけ）。 */
async function runForm(href, ok) {
  const ctx = await browser.createBrowserContext();
  try {
    const page = await ctx.newPage();
    try {
      await page.setViewport({ width: 390, height: 820 });
      page.setDefaultNavigationTimeout(60000);
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
    } finally { await page.close(); }
  } finally { await ctx.close(); }
}

/* ═══ 走らせる ═══════════════════════════════════════════════════════
   **出す順は宣言順に固定し、走らせる順だけプールに任せる。**
   重い仕事（1ページ＝10幅で約25秒）が先に並び、軽い FORM（1枚 約2.6秒）が
   後ろにあるので、終盤の空きスロットが自然に埋まる。 */
const tasks = [];
for (const [href, label, opt = {}] of PAGES) {
  const lines = [`\n═══ ${label}  ${href} ═══`];
  tasks.push({ label, lines, run: () => runPage(href, label, opt, mkOk(lines)) });
}
const pageTasks = [...tasks];
tasks.push({ label: '(見出し)',   /* 走らせるものは無い。行の場所を取るだけ */
  lines: [`\n═══ 触れる入力欄が 16px 未満でない（${FORM_PAGES.length}枚 × 390px）═══`] });
for (const href of FORM_PAGES) {
  const lines = [];
  tasks.push({ label: href, lines, run: () => runForm(href, mkOk(lines)) });
}
const formTasks = tasks.slice(pageTasks.length);

/* assert-links.mjs:249-256 と同じカーソル式のプール。 */
const pool = async (list) => {
  let cur = 0;
  await Promise.all(Array.from({ length: JOBS }, async () => {
    while (cur < list.length) {
      const t = list[cur++];
      if (!t.run) continue;
      try { await t.run(); }
      catch (e) {
        /* 途中で落ちた仕事を「黙って通った」ことにしない。
           stdout には FAIL を1行だけ、詳しいものは stderr へ（stdout の形を保つ）。 */
        ran++; fail++;
        t.lines.push(fmt(false, `${t.label} が最後まで走らなかった`, String(e?.message || e).slice(0, 160)));
        console.error(e);
      }
    }
  }));
};

/* PV_HEADER_PHASED=1 で「PAGES を全部やってから FORM」に戻せる。
   出力が直列版とずれたとき、原因が FORM の混走かどうかを切り分けるための栓。 */
if (process.env.PV_HEADER_PHASED) { await pool(pageTasks); await pool(formTasks); }
else { await pool(tasks); }

/* ★ここまで stdout に1文字も書いていない。宣言順にまとめて吐く。
   console.log(x) は x + '\n' を書くだけなので、join('\n') + '\n' と同じ。 */
const write = (s) => new Promise((r) => process.stdout.write(s, r));
const out = tasks.flatMap((t) => t.lines);
if (out.length) await write(out.join('\n') + '\n');

await browser.close();
await write(`\n==== ${ran - fail}/${ran} passed ====\n`);
if (settleTimeouts) {
  /* 1〜2個なら普通。手前の 1200ms で既に足りているので合否には出ない
     （2026-08-28、既定 -j 4 の5回中1回で1マス出たが、出力は直列版と完全一致だった）。
     十マス単位で出るようになったら -j を下げる。 */
  console.error(`· 形が落ち着くのを待ちきれなかったマス ${settleTimeouts} 個 / 150（数マスなら想定内。十マス単位なら -j を下げる）`);
}
/* ⚠️ まとめて吐くようにした瞬間に生まれた穴 ── check.mjs は spawn の既定＝
   パイプで読むので、最後の数十KB がパイプに残ったまま process.exit すると消える。
   上の write を await してからでないと終われない。 */
process.exit(fail ? 1 : 0);
