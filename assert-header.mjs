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
/* ★ham の3種類（2026-09-06）
     'nav'    … 新しい共通ナビが入っているページ ＝ 406枚。広い画面は左のレール、
                狭い画面（≦1000px）だけ ≡ から左にドロワー。**≡ は常には出ない。**
     'always' … 認証4枚。畳む段が無いので、どの幅でも ≡ を出す。
     既定      … 共通ナビを入れないページ ＝ 給与フォーム日英2枚だけ。
                search.js のまま ＝ ≡ は「畳んだときだけ」出る。 */
const PAGES = [
  ['/',                     'ja トップ',        { ham: 'nav' }],
  ['/en/',                  'en トップ',        { ham: 'nav' }],
  ['/world-airlines.html',  'ja 航空会社一覧',  { ham: 'nav' }],
  ['/community.html',       'ja 口コミ',        { ham: 'nav' }],
  ['/airlines/ana.html',    'ja 航空会社ページ', { ham: 'nav' }],
  ['/en/airlines/ana.html', 'en 航空会社ページ', { ham: 'nav' }],
  /* ★給与フォームの日英2枚だけが「共通ナビを入れない通常ページ」。
       書きかけが消えるのでナビを持たせない（オーナー確定事項10 の例外）。
       ＝ ここだけ search.js の畳み方がそのまま残っている。 */
  ['/pay-report.html',      'ja 給与を出す'],
  ['/en/pay-report.html',   'en 給与を出す'],
  ['/submit-review.html',   'ja 口コミを出す',  { ham: 'nav' }],
  /* マイページ系（header.mr-top）。ログインしないとヘッダーごと出ないので
     セッションを差し込む。
     ★2026-09-06、このアプリ14枚だけ ≡ の出方が変わった（ham:'app'）。
       app-nav.js が先に #pv-ham-btn を作り、search.js:416 の二重注入ガードで
       あちらは何もせず戻る。広い画面は左のレール、狭い画面（≦1000px）だけ
       ≡ から左にドロワーが出る ＝ **≡ は常には出ない**のが正しい。
       ⚠️ ham:'always' に戻さない。戻すと「レールも ≡ も両方出ている」を
          正解として通してしまう。 */
  /* ★2026-09-06、マイレポートは MY PAGE（profile.html）の ③ YOUR PAY へ統合した。
     my-value.html は転送1枚になり、**ヘッダーそのものを持たない**ので一覧から外す。
     URL は消せない（送信済みのお知らせメールが指している）。 */
  /* ★ロードマップと要望。テンプレートは同じ .mr-shell だが、これは
       このリポジトリで唯一「自由に書ける textarea を持つマイページ」で、
       下の FORM_PAGES にも自動で入る（390px で入力欄が 16px 未満なら iOS が拡大する）。 */
  ['/roadmap.html',         'ja ロードマップ', { ham: 'nav', login: true }],
  ['/en/roadmap.html',      'en ロードマップ', { ham: 'nav', login: true }],
  /* ★招待（2026-09-06 新設）。中身は既存の PVReferral.mountInvite。 */
  ['/invite.html',          'ja 招待',        { ham: 'nav', login: true }],
  ['/en/invite.html',       'en 招待',        { ham: 'nav', login: true }],
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
/* ★狭い画面のメニューを見る幅。GAP_FROM と同じ数だが意味が別なので分けてある。
     あちらは「ここから中身の隙間を見る」、こちらは「iPhone の幅」。 */
const IPHONE_W = 390;
/* 足元の余白を比べる相手（レールが出ている広い画面）。WIDTHS に在る数を使う。 */
const WIDE_W = 1280;
/* ★広い画面のレールを見る幅（オーナー指定 2026-09-06）。全部 WIDTHS に在る数。 */
const RAIL_W = [1024, 1280, 1440];
/* ★狭い画面で板を**開けて**測る幅（オーナー指定の⑥「320 / 390 で横に溢れない」）。
     390 だけだと、いちばん狭い機種で板が本文を押し広げても気づけない。 */
const NARROW_W = [320, 390];
/* ★レールの寸法。app-nav.css の @media(min-width:1001px) と**対**。
     もとは 208px。段を「絵の上・文字の下」に組み替えて字が横幅を要らなくなった
     ぶん、本文へ返した（オーナー決定 2026-09-06）。
   ⚠️ 片方だけ変えない。ここを直すときは app-nav.css の
      `body.pv-anav-shell{padding-left:…}` と `width:…` の2か所も同時に直す。 */
const RAIL_PX = 144;
/* ★触れる的の下限。サイト全体で守っている数。
   ⚠️ .mr-side-sub（ログイン・お問い合わせ）だけは**別の床**を使う。下の SUB_MIN 参照。 */
const TAP_MIN = 44;
/* ★.mr-side-sub の床。2026-09-06 に実測 33.3px。
     44px に上げるかをオーナーに諮り、「いらない」＝**現状のままでよい**と決まった。
     ただし**黙って縮むのは止める** ── 今回いちばんの反省が
     「33px を誰も見ていなかった」ことなので、数を書いて床を張る。
     44 に届かない理由は「板の主役ではない小さな出口2本だから」であって、
     測っていないからではない。 */
const SUB_MIN = 30;
/* ☰ の置き場（右上）。画面の右端・上端からこれ以内に居ること。
   実測 ── 右から 12〜16px / 上から 12〜14px（ヘッダーの高さで変わる）。 */
const HAM_EDGE = 24;

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
/* ★引き出しは2種類ある（2026-09-06）。
     ① 公開ページ292枚 … search.js が右から出す #pv-nav-drawer
     ② アプリ画面14枚 … app-nav.js が右から出す .mr-side
   ≡ のボタンの id は同じ（pv-ham-btn）── それが二重注入ガードの鍵なので、
   押したあと**どちらの板が立ったか**で見分ける。 */
const readDrawer = () => {
  const btn = document.getElementById('pv-ham-btn');
  if (btn) btn.click();
  const pub = document.getElementById('pv-nav-drawer');
  const app = pub ? null : document.querySelector('.mr-side');
  const d = pub || app;
  if (!d) return { noDrawer: true };
  const links = [...d.querySelectorAll(pub ? '.pv-nd-link' : '.mr-side-a,.mr-side-sub')].map((a) => ({
    text: (a.textContent || '').trim(),
    href: a.getAttribute('href') || '',
  }));
  /* ★バーから消えた CTA の写し。公開ページでは search.js が .pv-nd-cta として
     右の引き出しに置いていたものを、app-nav.js が板へ移し替えている
     （class は板の見た目に揃えるので、目印は data-pv-nd-cta のほう）。 */
  const cta = d.querySelector('.pv-nd-cta,[data-pv-nd-cta]');
  /* ★ヘッダーの CTA そのものの行き先。バーから消えていても href は読める。 */
  const bar = document.querySelector('#main-nav .btn-primary, #main-nav .btn-orange');
  /* マイページ系のヘッダーには a.nav-link が無い（写す物がゼロ＝共通の6本が出る）。 */
  const navHrefs = [...document.querySelectorAll('#main-nav a.nav-link')].map((a) => a.getAttribute('href') || '');
  return {
    links,
    cta: cta ? { text: (cta.textContent || '').trim(), href: cta.getAttribute('href') || '' } : null,
    ctaHref: bar ? bar.getAttribute('href') || '' : '',
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

/* ── 板（ドロワー）が動き終わるのを待つ ──────────────────────────
   ⚠️ **時間で待たない**（CLAUDE.md「混んだ回に嘘の赤を出す」）。
      transform のアニメーションは .32s。途中を読むと右端が 390.3px のように
      **0.3px だけ画面の外**に出た値が返る ── 2026-09-06 に実際に踏んだ。
      「誤差 0.5px 以内」のような幅を持たせて逃げると、今度は**本当に
      ずれている板を通してしまう**。だから幅を持たせず、**止まるまで待つ**。
   ⚠️ **「2回続けて同じ値」では足りない**（2026-09-06、13マスが嘘の赤になった）──
      混んだ回は transition が**まだ始まっていない**うちに同じ値を 2 回読み、
      **閉じた位置**で「止まった」と判定する。そのまま測るので
      「開いた板が右端に無い」と落ちる ── **製品は正しいのに赤い**。
   ★止まった＝**一度でも動いたのを見てから**、同じ値が 3 回続いたとき。
      まったく動かない場面（既に開いている・動きを減らす設定）もあるので、
      **動きを一度も見ないまま 800ms**（transition の .32s より十分長い）経ったら抜ける。
      数え方は `assert-pay-rows.mjs` の SETTLED と同じ。
      transitionend に頼らない ── 動きを減らす設定では発火しないことがある。 */
const drawerSettleFn = (maxMs) => new Promise((done) => {
  const n = document.querySelector('.mr-side');
  if (!n) return done('nodrawer');
  const t0 = performance.now();
  const sig = () => {
    const b = n.getBoundingClientRect();
    return b.left.toFixed(2) + ',' + b.right.toFixed(2) + ',' + getComputedStyle(n).visibility;
  };
  let prev = sig(), same = 0, moved = false;
  const tick = () => {
    const cur = sig();
    if (cur === prev) same += 1; else { same = 0; moved = true; }
    prev = cur;
    const el = performance.now() - t0;
    if (same >= 3 && (moved || el >= 800)) return done('ok');
    if (el >= maxMs) return done('timeout');
    let fired = false;
    const go = () => { if (!fired) { fired = true; tick(); } };
    requestAnimationFrame(go);
    setTimeout(go, 40);
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
  /* 足元の余白は「狭い画面だけ余分に空いていないか」で見る。絶対値では見ない ──
     .mr-shell の base は 2026-08-20 から `padding:28px 24px 96px` で、これは
     下タブとは無関係な本文の余白（広い画面にも同じだけ在る）。閾値で切ると
     「帯を廃止したのに落ちる」検査になる。広い幅と比べる。 */
  const shellPad = {};

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
    /* ★共通のナビ（2026-09-06、足元の帯を廃止して左のドロワーに畳んだ）。
         中身の細かい所は assert-pay-rows.mjs が見ている。ここで見るのは
         **公開ページでもアプリ画面でも同じように出ること**と、
         閉じている板が邪魔をしないこと。
       ★「送っていちばん下を測る」はしない。scroll-behavior:smooth の途中を
         読むことがある（2026-08-28 に assert-referral.mjs で実際に踏んだ形）。 */
    if (NARROW_W.includes(w) && opt.ham === 'nav') {
      const t = await page.evaluate(() => {
        const n = document.querySelector('.mr-side');
        if (!n) return null;
        const b = n.getBoundingClientRect();
        const sh = document.querySelector('.mr-shell') || document.body;
        const h = document.getElementById('pv-ham-btn');
        const hb = h ? h.getBoundingClientRect() : null;
        return { w: innerWidth, left: b.left, right: b.right, width: b.width,
                 vis: getComputedStyle(n).visibility,
                 /* ★助け出したヘッダーの CTA は数に入れない（下の readDrawer 参照）。
                      板そのものは 406枚どこでも CTA ＋ 7項目の8つ。 */
                 n: document.querySelectorAll('.mr-side-a:not([data-pv-nd-cta])').length,
                 ham: !!h,
                 hamBox: hb ? { right: innerWidth - hb.right, top: hb.top, left: hb.left,
                                w: hb.width, h: hb.height } : null,
                 tabs: !!document.querySelector('.mr-tabs'),
                 pos: getComputedStyle(n).position,
                 side: getComputedStyle(n).borderLeftWidth + '/' + getComputedStyle(n).borderRightWidth,
                 pad: Math.round(parseFloat(getComputedStyle(sh).paddingBottom)) };
      });
      if (t) {
        ok(t.ham && t.n === 8, `${tag} ≡ が出て、ドロワーの中身は CTA ＋ 7項目`,
           `≡ ${t.ham} / ${t.n}つ`);
        /* ★position も見る。fixed で無いと板が grid に居座ったまま translate されて
             閉じているのに画面の端へ数 px はみ出す（マイレポートで実際に起きた形）。 */
        ok(t.pos === 'fixed', `${tag} 閉じている板は本文の外（fixed）に居る`, `position ${t.pos}`);
        /* ★2026-09-06、**左外 → 右外**（オーナー指示。板を右から出すようにした）。
           ⚠️ ここは長らく「右端 ≤ 0」＝左外を見ていた。向きを反転したとき
              この1行を直し忘れると、板が右から出ているのに検査は左を見たまま
              落ち続ける（＝直し方を間違える）。**app-nav.css の節4 と対。**
           ★見るのは「左端が画面幅以上」── 板の**幅ぶん丸ごと**右へ逃げていること。
              `left >= innerWidth` は「1pxも見えていない」と同義。 */
        ok(t.left >= t.w - 0.5 && t.vis === 'hidden',
           `${tag} 閉じている板は画面の右外に居る（完全に外）`,
           `左端 ${t.left.toFixed(1)} / 画面幅 ${t.w} / ${t.vis}`);
        /* 線は板の**左**側に立つ（板は右端に居る）。右に立っていたら向きの直し漏れ。 */
        ok(/^1px\//.test(t.side), `${tag} 板の境界線は左側にある（右から出る板の形）`, t.side);
        ok(!t.tabs, `${tag} 足元の帯（下タブ）が残っていない`);
        /* ★☰ は右上（オーナー指定 2026-09-06）。板と同じ側＝指を動かす距離が短い。 */
        if (t.hamBox) {
          ok(t.hamBox.right <= HAM_EDGE && t.hamBox.top <= HAM_EDGE,
             `${tag} ☰ が右上にある`,
             `右から ${t.hamBox.right.toFixed(0)}px / 上から ${t.hamBox.top.toFixed(0)}px（上限 ${HAM_EDGE}）`);
          ok(t.hamBox.left > t.w / 2, `${tag} ☰ は画面の右半分にある`,
             `左端 ${t.hamBox.left.toFixed(0)} / 画面の中央 ${t.w / 2}`);
          ok(t.hamBox.w >= TAP_MIN && t.hamBox.h >= TAP_MIN,
             `${tag} ☰ の的が ${TAP_MIN}px 以上`,
             `${t.hamBox.w.toFixed(0)}×${t.hamBox.h.toFixed(0)}`);
        }
      }

      /* ── 板を**開けて**測る（オーナー指定の①③⑥）─────────────────
         ここまでは「閉じている板」しか見ていなかった。開いた形は
         `assert-pay-rows.mjs` も見ておらず、**33px の的を誰も測っていなかった**。 */
      if (t && t.ham) {
        await page.click('#pv-ham-btn');
        /* ★まず「開いた」印（body.pv-anav-open）が付くのを待つ。
             印が付く前に測ると、閉じたままの位置で止まって見える。 */
        try {
          await page.waitForFunction(
            "document.body.classList.contains('pv-anav-open')", { timeout: 4000, polling: 60 });
        } catch (e) { settleTimeouts++; }
        if (await page.evaluate(drawerSettleFn, 4000) === 'timeout') settleTimeouts++;
        const o = await page.evaluate((TAP, SUB) => {
          const n = document.querySelector('.mr-side');
          const b = n.getBoundingClientRect();
          const vis = (e) => !e.hidden && e.getBoundingClientRect().width > 0;
          const nameOf = (e) => ((e.querySelector('span') || e).textContent || '').trim() || '×';
          const box = (e) => e.getBoundingClientRect();
          const main = [...n.querySelectorAll('.mr-side-a,.mr-side-x')].filter(vis)
            .map((e) => ({ t: nameOf(e), h: +box(e).height.toFixed(1) }));
          const subs = [...n.querySelectorAll('.mr-side-sub')].filter(vis)
            .map((e) => ({ t: nameOf(e), h: +box(e).height.toFixed(1) }));
          return {
            left: b.left, right: b.right, w: innerWidth,
            vis: getComputedStyle(n).visibility,
            zSide: getComputedStyle(n).zIndex,
            zOv: (() => { const v = document.getElementById('pv-anav-ov');
                          return v ? getComputedStyle(v).zIndex : null; })(),
            hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            small: main.filter((r) => r.h < TAP),
            smallSub: subs.filter((r) => r.h < SUB),
            minMain: main.length ? Math.min(...main.map((r) => r.h)) : null,
            minSub: subs.length ? Math.min(...subs.map((r) => r.h)) : null,
            nMain: main.length, nSub: subs.length,
          };
        }, TAP_MIN, SUB_MIN);

        /* ★①「開いたら右端に正しく貼り付く」── 幅を持たせずに厳密に見る。
             上の drawerSettleFn が**止まるまで待って**いるので、
             動いている途中の 390.3px を読むことはない。 */
        ok(Math.abs(o.right - o.w) < 0.5 && o.vis === 'visible',
           `${tag} 開いた板は画面の右端に貼り付く`,
           `右端 ${o.right.toFixed(1)} / 画面幅 ${o.w} / ${o.vis}`);
        ok(o.left > 0, `${tag} 開いた板の左側に背景が見えている（全画面を覆わない）`,
           `左端 ${o.left.toFixed(1)}`);
        /* ⑥ 開いていても横スクロールを生やさない。**右から出す板ならではの罠** ──
             position:fixed が効いていないと、右へ逃がした板が本文の幅を押し広げる。 */
        ok(!o.hScroll, `${tag} 板を開いても横スクロールが生えない`);
        ok(Number(o.zSide) > Number(o.zOv), `${tag} 板は暗幕より上にある`,
           `板 ${o.zSide} / 幕 ${o.zOv}`);
        /* ★③ 板の中の押せるもの**全部**を測る。ここが今回の反省の本体。 */
        ok(o.small.length === 0 && o.nMain > 0,
           `${tag} ★板の中の口（項目・×）が ${TAP_MIN}px 以上`,
           o.small.length ? o.small.map((r) => `${r.t}=${r.h}px`).join(' / ')
                          : `${o.nMain}個・いちばん小さくて ${o.minMain}px`);
        /* ★ログイン・お問い合わせは 44px に届かない（33px）。オーナーが
             「上げなくてよい」と決めた ── ただし**測ってはいる**。
             黙って縮むことだけを止める。 */
        ok(o.smallSub.length === 0,
           `${tag} 出口2本（ログイン・お問い合わせ）が ${SUB_MIN}px を割っていない`,
           o.smallSub.length ? o.smallSub.map((r) => `${r.t}=${r.h}px`).join(' / ')
                             : `${o.nSub}本・いちばん小さくて ${o.minSub}px（44px の例外・オーナー了承済み）`);
      }
    }

    /* ── 広い画面のレール（オーナー指定の⑤⑦）────────────────────
       「絵の上・文字の下」であること・幅と本文の余白が合っていること・
       ☰ が出ていないこと。1024 / 1280 / 1440 の3幅で見る。 */
    if (opt.ham === 'nav' && RAIL_W.includes(w)) {
      const r = await page.evaluate((RAIL) => {
        const n = document.querySelector('.mr-side');
        if (!n) return null;
        const b = n.getBoundingClientRect();
        const cs = getComputedStyle(n);
        const rows = [...n.querySelectorAll('.mr-side-a')]
          .filter((e) => !e.hidden && e.getBoundingClientRect().width > 0)
          .map((e) => {
            const sv = e.querySelector('svg:not(.mr-side-lk)');
            const sp = e.querySelector('span');
            const eb = e.getBoundingClientRect();
            const st = getComputedStyle(e);
            const lh = parseFloat(st.lineHeight) || parseFloat(st.fontSize) * 1.3;
            return {
              t: ((sp || e).textContent || '').trim(),
              h: +eb.height.toFixed(1),
              font: +parseFloat(st.fontSize).toFixed(1),
              /* 絵の下端 ≤ 文字の上端 ＝ 縦積み。横並びだと重なる。 */
              stacked: !!(sv && sp) &&
                       sv.getBoundingClientRect().bottom <= sp.getBoundingClientRect().top + 0.5,
              lines: sp ? Math.round(sp.getBoundingClientRect().height / lh) : 0,
            };
          });
        return {
          width: +b.width.toFixed(1), left: +b.left.toFixed(1),
          pos: cs.position, top: +b.top.toFixed(1),
          pad: Math.round(parseFloat(getComputedStyle(document.body).paddingLeft)),
          canScroll: cs.overflowY === 'auto' || cs.overflowY === 'scroll',
          fits: n.scrollHeight <= n.clientHeight + 1,
          scrollH: n.scrollHeight, clientH: n.clientHeight,
          rows,
          want: RAIL,
        };
      }, RAIL_PX);
      if (r) {
        ok(Math.abs(r.width - RAIL_PX) < 0.5 && r.pad === RAIL_PX,
           `${tag} レールは ${RAIL_PX}px・本文の左余白も同じ`,
           `幅 ${r.width} / padding-left ${r.pad}`);
        ok(r.pos === 'fixed' && Math.abs(r.left) < 0.5,
           `${tag} レールは画面の左端に固定`, `${r.pos} / 左端 ${r.left}`);
        /* ★⑤ 絵の上・文字の下。1つでも横並びが残っていたら落とす。 */
        const flat = r.rows.filter((x) => !x.stacked);
        ok(flat.length === 0 && r.rows.length > 0,
           `${tag} ★レールの段は「絵の上・文字の下」`,
           flat.length ? flat.map((x) => x.t).join(' / ') : `${r.rows.length}段`);
        /* 的の大きさ。縦積みにしたぶん背は伸びるので、割ることは無いはずだが測る。 */
        const shortRows = r.rows.filter((x) => x.h < TAP_MIN);
        ok(shortRows.length === 0, `${tag} レールの段が ${TAP_MIN}px 以上`,
           shortRows.length ? shortRows.map((x) => `${x.t}=${x.h}px`).join(' / ')
                            : `いちばん低くて ${Math.min(...r.rows.map((x) => x.h))}px`);
        /* ★文字を極端に小さくしない（オーナー条件）。狭い画面の 11.2px より大きく。 */
        const tiny = r.rows.filter((x) => x.font < 12);
        ok(tiny.length === 0, `${tag} レールの文字が 12px を下回らない`,
           tiny.length ? tiny.map((x) => `${x.t}=${x.font}px`).join(' / ')
                       : `${r.rows[0].font}px`);
        /* ★ROADMAP & REQUESTS が3行以上にならない（オーナー条件）。
             ⚠️ 名前で探さない ── 英語版も日本語版も同じ段なので、
                **いちばん行数の多い段**を見て、それが2行以内であればよい。 */
        const worst = r.rows.reduce((a, x) => (x.lines > a.lines ? x : a), r.rows[0]);
        ok(worst.lines <= 2, `${tag} レールの段が3行以上に折れていない`,
           `いちばん多い段「${worst.t}」が ${worst.lines}行`);
        /* ★高さの低い画面でも下の項目に手が届く（オーナー条件）。
             入りきらないときは**中でスクロールできること**が条件（許可済み）。
             ⚠️ 「必ず入る」にしない ── 768px の画面では物理的に入らない。 */
        ok(r.fits || r.canScroll,
           `${tag} レールに入りきらないときは中でスクロールできる`,
           r.fits ? '全部入っている' : `中身 ${r.scrollH}px / 見える ${r.clientH}px・overflow-y で届く`);
      }
    }
    if (opt.ham === 'nav' && (w === IPHONE_W || w === WIDE_W)) {
      shellPad[w] = await page.evaluate(() => {
        const sh = document.querySelector('.mr-shell') || document.body;
        return Math.round(parseFloat(getComputedStyle(sh).paddingBottom));
      });
    }
    if (w >= GAP_FROM) {
      ok(m.minGap === null || m.minGap >= MIN_GAP, `${tag} 中身どうしが ${MIN_GAP}px 以上あいている`,
         m.minGap === null ? '' : `いちばん狭いところ ${m.minGap}px`);
    }
    if (opt.ham === 'nav') {
      /* ★共通ナビの406枚。広い画面は左のレール、狭い画面（≦1000px）だけ ≡。
           app-nav.css の @media(max-width:1000px) と対。
         ⚠️ 「畳んだときだけ」に戻さない ── search.js は 768〜1000px では
            まだ畳んでいないので、そこでレールも ≡ も出ない穴になる
            （app-nav.css の 0-c がその穴を塞いでいる）。
         ⚠️ 「常に出ている」にも戻さない ── レールと ≡ が両方出ている状態を
            正解として通してしまう。 */
      ok(m.hamVisible === (w <= 1000), `${tag} ≡ は狭い画面（≦1000px）だけ出る`,
         `≡=${m.hamVisible}`);
    } else if (opt.ham === 'always') {
      /* 認証4枚には畳む段が無い（リンクも CTA も無いので fits() が素通りする）。
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
        /* ★見るのは「写しが在るか」ではなく**行き先へ辿れるか**（2026-09-06）。
             板の1行目が既に同じページを指していることがある ── トップの日英2枚が
             それで、CTA も板も pay-report.html。写しを足すと同じ行が2つ並ぶので
             app-nav.js は足さない。それでも道は塞がっていない。 */
        if (m.ctaHidden && m.ctaInBar !== null && d.ctaHref) {
          const want = abs(d.ctaHref, BASE + href);
          ok(paths.includes(want), 'バーから消した CTA の行き先が板から辿れる',
             paths.includes(want) ? '' : `${want} が板に無い`);
        }
      }
    }
    } finally { await page.close(); }   /* ★continue でも例外でも閉じ漏れない */
  }
  if (opt.ham === 'nav' && shellPad[IPHONE_W] != null && shellPad[WIDE_W] != null) {
    ok(shellPad[IPHONE_W] <= shellPad[WIDE_W],
       '狭い画面だけ足元を余分に空けていない（帯のぶんの余白が残っていない）',
       `${IPHONE_W}px ${shellPad[IPHONE_W]}px / ${WIDE_W}px ${shellPad[WIDE_W]}px`);
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

/* ═══ 8) 招待の着地でもレールが押せる（オーナー指定の⑧）══════════════════
   `?ref=` で来た人には pv-referral.js が**画面いっぱいの招待状**を出す
   （`.pvr-strip` … `position:absolute;width:100%;height:100vh;z-index:150`）。
   レールは `z-index:160` で**その上**に居る決まりにしてある。
   ⚠️ 数字を見るだけにしない ── z-index は「積み重ね文脈」が別なら効かない。
      **本当に指が届くか**（elementFromPoint がレールの中を返すか）で見る。
   ⚠️ ここは招待の中身を見る検査ではない（それは assert-referral.mjs の担当）。
      見るのは**ナビが生きているか**だけ。 */
const REF_CODE = 'K7QD3XZM';   /* ★実在のコードではない。assert-referral.mjs と同じ8文字 */

async function runInviteRail(href, label, needSession, wantStrip, ok) {
  const ctx = await browser.createBrowserContext();
  try {
    const page = await ctx.newPage();
    try {
      await page.setViewport({ width: WIDE_W, height: 900 });
      page.setDefaultNavigationTimeout(60000);
      if (needSession) await page.evaluateOnNewDocument(FAKE_SESSION);
      await page.goto(BASE + href, { waitUntil: 'networkidle2' });
      if (wantStrip) {
        try { await page.waitForSelector('.pvr-strip', { timeout: 15000 }); }
        catch (e) { ok(false, `${label} 招待状が出る（この検査の前提）`, String(e.message || e).slice(0, 80)); return; }
      }
      await settle(page);

      const r = await page.evaluate((RAIL) => {
        const n = document.querySelector('.mr-side');
        if (!n) return { noRail: true, url: location.pathname };
        const b = n.getBoundingClientRect();
        const st = document.querySelector('.pvr-strip');
        /* レールの中の、いちばん上の項目の真ん中を狙う。 */
        const a = [...n.querySelectorAll('.mr-side-a')]
          .find((e) => e.getBoundingClientRect().height > 0);
        let hit = null, inRail = false;
        if (a) {
          const ab = a.getBoundingClientRect();
          const el = document.elementFromPoint(ab.left + ab.width / 2, ab.top + ab.height / 2);
          /* ⚠️ SVG の className は SVGAnimatedString で、文字列化すると
               `[object SVGAnimatedString]` になる。baseVal を先に見る。 */
          const cn = (e) => (typeof e.className === 'string' ? e.className
                             : (e.className && e.className.baseVal) || '');
          const c0 = el ? cn(el).trim().split(/\s+/)[0] : '';
          hit = el ? el.tagName.toLowerCase() + (c0 ? '.' + c0 : '') : null;
          inRail = !!(el && n.contains(el));
        }
        return {
          width: +b.width.toFixed(1), vis: getComputedStyle(n).visibility,
          zRail: getComputedStyle(n).zIndex,
          zStrip: st ? getComputedStyle(st).zIndex : null,
          strip: !!st, hit, inRail, want: RAIL,
        };
      }, RAIL_PX);

      if (r.noRail) { ok(false, `${label} レールがある`, `いま ${r.url}`); return; }
      ok(Math.abs(r.width - RAIL_PX) < 0.5 && r.vis === 'visible',
         `${label} レールが ${RAIL_PX}px で出ている`, `幅 ${r.width} / ${r.vis}`);
      if (r.strip) {
        ok(Number(r.zRail) > Number(r.zStrip),
           `${label} レールは招待状より上にある`, `レール ${r.zRail} / 招待状 ${r.zStrip}`);
      }
      ok(r.inRail, `${label} ★レールの項目を押すと、当たるのはレール自身`,
         r.inRail ? `${r.hit}` : `当たったのは ${r.hit}（招待状に食われている）`);
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
tasks.push({ label: '(見出し)',
  lines: [`\n═══ 招待の着地でもレールが生きている（${WIDE_W}px）═══`] });
for (const [href, label, sess, strip] of [
  ['/?ref=' + REF_CODE, 'トップ ＋ 招待状', false, true],
  ['/en/?ref=' + REF_CODE, 'en トップ ＋ 招待状', false, true],
  ['/invite.html', 'INVITE', true, false],
  ['/en/invite.html', 'en INVITE', true, false],
]) {
  const lines = [];
  tasks.push({ label, lines, run: () => runInviteRail(href, label, sess, strip, mkOk(lines)) });
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
