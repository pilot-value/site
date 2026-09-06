/* ════════════════════════════════════════════════════════════════
   patch-side-nav.mjs — サイト全体のナビ（7項目）を1か所から配る

   ★2026-09-06、配り先を 16枚 → **408枚**にした（オーナー確定事項10）。
       公開392枚 … トップ（Landing Page）／ VOTE（community）／
                    AIRLINES（world-airlines）／ 航空会社110社 ／ 国別 ／ 記事 …
       アプリ16枚 … .mr-shell を持つ画面（actual-pay / profile / my-value /
                    roadmap / deep-pay / deep-pay-compare / airline-conditions ＋ invite）
     **入れないのは6枚だけ** ── login / signup（日英4枚）・auth-callback ・
     給与フォーム（pay-report 日英。書きかけの値が消えるため従来どおり出さない）。

   なぜ1か所から配るのか ── 同じ項目を人が408か所に書き写せば、必ず古いまま残る。
   実際に 2026-08-23 まで、my-value / airline-conditions の両方に
   「3つだけ」というコメントが残っていた。

   ★「ナビを統一する」と「ページをアプリ化する」は別（オーナー）。
     このスクリプトが公開ページで触るのは次の4つだけで、
     **本文・口コミ・一覧・年収・SEO には1バイトも手を出さない。**
       ① <body> の直後に <nav class="mr-side"> を置く
       ② <body> の class に pv-anav-* を足す
       ③ <head> に pv-tokens.css / app-nav.css を足す（無いときだけ）
       ④ </body> の直前に app-nav.js を足す
     加えて ⑤ ヘッダーの**横並びリンクの div だけ**を外す（確定事項13）。
     ロゴ・検索・テーマ・言語・通貨・ログイン・CTA・「← 一覧に戻る」は残す。

   ★冪等。何度流しても同じ結果になる（`--check` で書かずに差分だけ見る）。

   使い方:
     node patch-side-nav.mjs              書き込む
     node patch-side-nav.mjs --check      食い違っているページを数えるだけ（書かない）
     node patch-side-nav.mjs --only <rel> 1枚だけに配る（目視用）

   ⚠️ 置換は必ず関数形 s.replace(old, () => neu) で書く。
      文字列で渡すと中の $ が特殊記号として解釈される（CLAUDE.md 参照）。
   ════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* ★絶対パスを書かない。自分の位置から解く（公開リポジトリなのでログイン名が漏れる）。 */
const ROOT = fileURLToPath(new URL('.', import.meta.url));

/* HTML が置いてある6つのフォルダ。ここに無いページは配布の対象外。 */
const DIRS = ['.', 'en', 'airlines', 'en/airlines', 'countries', 'en/countries'];

/* ★入れない6枚（ファイル名で外す）。
     login / signup / auth-callback … 認証の流れを壊さない
     pay-report                     … 書きかけの給与が消える（オーナー確定事項10）
   ⚠️ ここから外すと、給与フォームの途中でナビを押した人の入力が消える。 */
const SKIP = new Set(['login.html', 'signup.html', 'auth-callback.html', 'pay-report.html']);

const ICON = {
  /* 家。HOME は Landing Page そのもの（index.html）。 */
  home:    '<path d="M3 9.5 12 2l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  /* 2人。REAL PAY は「他のパイロットの実給与」。 */
  others:  '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  /* 吹き出し。VOTE は口コミ（community.html）。 */
  vote:    '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>',
  /* 旗。運営が目指している先と、そこへ声を出す場所。 */
  roadmap: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  /* 飛行機。AIRLINES は112社の年収一覧（world-airlines.html）。 */
  airlines:'<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  /* 人＋。INVITE は招待（invite.html）。 */
  invite:  '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
  /* 1人。MY PAGE は自分のページ（REAL PAY の「2人」と対にしてある）。 */
  settings:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  add:     '<path d="M12 5v14"/><path d="M5 12h14"/>',
};

/* ★「匿名で給与を追加」だけが色を持つ（is-add）。このサイトで一番押してほしいもの。
     3つも4つも色を付けると、どれも押されなくなる。
     並びの先頭に置く（オーナー確定・2026-09-06「独立CTA ＋ 通常ナビ7つ」）。

   ★7項目の並びと行き先はオーナーが決めたもの。ここで勝手に足さない。
       HOME / REAL PAY / VOTE / ROADMAP & REQUESTS / AIRLINES / INVITE / MY PAGE
     VOTE と AIRLINES は**表示名だけ**。実体は既存の公開ページ
     （community.html / world-airlines.html）で、あちらの UI は1バイトも触らない。

   ★DEEP PAY / VERIFIED PAY はナビから外した（2026-09-06）。
     押せない錠前を2つ常設していたが、DEEP PAY は Phase 6 で REAL PAY の内側へ、
     VERIFIED PAY は実際の検証機能ができるまで出さない。
     ⚠️ deep-pay.html / deep-pay-compare.html は消していない。導線から来る画面になっただけ。

   ★my-value.html（マイレポート）もナビには出さない。
     Phase 2 で profile.html へ統合する予定で、それまでの入口は2つ残っている ──
       pay-tracker.js:315（MY PAGE の「マイレポートを見る →」）
       pay-report.html:3518（給与を出した直後の完了カード）
     ⚠️ URL そのものは生かしたまま（送信済みのリマインドメールが指している）。

   ★href は**言語の根から見た相対**で書く。'en/' を頭に付けない。
     各ページの深さぶんの '../' は下の navPre() が足す。

   ★data-mr-gate は pv-gates.js の目印。錠前は実行時にあちらが付け外しする。
     ⚠️ pv-gates.js を読むのはアプリ16枚だけ。公開392枚では素通しの
        ただのリンクになる（actual-pay.html 側が自分で錠前を持っている）。 */
const ITEMS = [
  { key: 'add',      href: 'pay-report.html#ps',  icon: 'add',      add: true },
  { key: 'home',     href: 'index.html',          icon: 'home' },
  { key: 'others',   href: 'actual-pay.html',     icon: 'others',   gate: 'real' },
  { key: 'vote',     href: 'community.html',      icon: 'vote' },
  { key: 'roadmap',  href: 'roadmap.html',        icon: 'roadmap' },
  { key: 'airlines', href: 'world-airlines.html', icon: 'airlines' },
  { key: 'invite',   href: 'invite.html',         icon: 'invite' },
  { key: 'settings', href: 'profile.html',        icon: 'settings' },
];

/* ★2026-09-05、roadmap の項目名を「ROADMAP & REQUESTS」にした（オーナー指示）。
     ページの大見出しが最初からその綴りで、左メニューだけ ROADMAP と短かった。
     ⚠️ ここを変えたら assert-roadmap.mjs の「patch-side-nav.mjs に … が在る」も
        同じコミットで直す（文言をそのまま見ている）。
   ★日英で同じ語を出すのは、どれもブランドの名前だから（REAL PAY / VOTE / …）。
     訳し分けるのは CTA と「お問い合わせ」「ログイン」だけ。 */
const TEXT = {
  ja: {
    aria: 'メニュー',
    note: '氏名も社員番号も受け取りません。',
    add: '匿名で給与を追加',
    home: 'HOME', others: 'REAL PAY', vote: 'VOTE',
    roadmap: 'ROADMAP & REQUESTS', airlines: 'AIRLINES',
    invite: 'INVITE', settings: 'MY PAGE',
    login: 'ログイン',
    sub: 'お問い合わせ',
  },
  en: {
    aria: 'Menu',
    note: 'We never collect your name or staff number.',
    add: 'Add pay anonymously',
    home: 'HOME', others: 'REAL PAY', vote: 'VOTE',
    roadmap: 'ROADMAP & REQUESTS', airlines: 'AIRLINES',
    invite: 'INVITE', settings: 'MY PAGE',
    login: 'Log in',
    sub: 'Contact',
  },
};

/* どのページがどの項目で光るか。**言語の根から見た道**で引く。
   ここに無いページ（my-value / deep-pay / deep-pay-compare / airline-conditions /
   航空会社110社 / 国別 / 記事）はどれも光らせない。
   ★航空会社ページで AIRLINES を光らせないのは、aria-current="page" が
     「まさにこのページ」を意味するから。似た場所という理由で嘘を書かない。 */
const CURRENT = {
  'index.html': 'home',
  'actual-pay.html': 'others',
  'community.html': 'vote',
  'roadmap.html': 'roadmap',
  'world-airlines.html': 'airlines',
  'invite.html': 'invite',
  'profile.html': 'settings',
};

function buildNav(lang, current, pre) {
  const t = TEXT[lang];
  const rows = ITEMS.map((it) => {
    const on = it.key === current;
    const cls = 'mr-side-a' + (on ? ' is-on' : '') + (it.add ? ' is-add' : '');
    const gate = it.gate ? ' data-mr-gate="' + it.gate + '"' : '';
    const svg = '        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
              + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
              + ICON[it.icon] + '</svg>\n'
              + '        <span>' + t[it.key] + '</span>\n';
    return '      <a class="' + cls + '" href="' + pre + it.href + '"' + gate
         + (on ? ' aria-current="page"' : '') + '>\n' + svg + '      </a>';
  });
  /* ★出口。アプリ画面にはフッターが無く、旧 search.js の引き出しには
       お問い合わせとログインが入っていた。畳んだぶんをここで受ける。
       色は付けない ── 色を持つのは「匿名で給与を追加」1つだけ。

     ★ログインは `.mr-side-a` にしない（`.mr-side-sub` で出す）。
       理由は2つ ── ①ログイン後は消える項目なので、8つの並びに数として混ぜない
       （assert-header.mjs が「板の項目は8つ」を見ている）
       ②公開ページの狭い画面では、ヘッダーの #nav-auth-btn が `hidden md:inline-flex`
       ＝ iPhone では出ていない。板が唯一のログイン導線になる。
     ★出したまま置いて、app-nav.js がログイン済みのときだけ消す。
       hidden で書き出すと、JS が動かない人には永久に出ない。 */
  return '<nav class="mr-side" aria-label="' + t.aria + '">\n'
       + rows.join('\n') + '\n'
       + '      <a class="mr-side-sub" id="pv-anav-login" data-pv-auth="out" href="'
       + pre + 'login.html">' + t.login + '</a>\n'
       + '      <a class="mr-side-sub" href="' + pre + 'contact.html">' + t.sub + '</a>\n'
       + '      <p class="mr-side-note">' + t.note + '</p>\n'
       + '    </nav>';
}

/* ══ 差し込む札 ═══════════════════════════════════════════════════
   ★どれも `PV-NAV:` で始める。これが「このスクリプトが書いた」目印で、
     消して置き直すときの掴みどころになる（冪等性はここに乗っている）。
     ⚠️ 目印を変えるときは下の HEAD_RE / JS_RE も同時に変える。 */
const HEAD_NOTE = {
  ja: '  <!-- PV-NAV: 全ページ共通のナビ（広い画面＝左レール／狭い画面＝左ドロワー）。\n'
    + '       patch-side-nav.mjs が配る。app-nav.css は最後に読む（my-value.css より後）。 -->\n',
  en: '  <!-- PV-NAV: site-wide navigation (left rail on wide screens, left drawer on narrow).\n'
    + '       Written by patch-side-nav.mjs. app-nav.css loads last (after my-value.css). -->\n',
};
const JS_NOTE = {
  ja: '<!-- PV-NAV: ナビの開け閉め。★search.js より**後**に読む ──\n'
    + '     あちらが作った ≡ を繋ぎ直すため（先に読むと search.js:416 の二重注入ガードで\n'
    + '     ヘッダーの自動折り畳みごと止まる）。search.js が無いページでは自分で ≡ を作る。 -->\n',
  en: '<!-- PV-NAV: opens and closes the navigation. Loads AFTER search.js so it can adopt\n'
    + '     the hamburger that file creates; on pages without search.js it makes its own. -->\n',
};
const LINK_NOTE = {
  ja: '<!-- PV-NAV: 横並びのリンクは 2026-09-06 に左のナビへ畳んだ（オーナー確定事項13）。\n'
    + '     ここに足さない。行き先を増やすときは patch-side-nav.mjs の ITEMS に足す。 -->',
  en: '<!-- PV-NAV: the header link row folded into the left navigation on 2026-09-06.\n'
    + '     Do not add links here; add destinations to ITEMS in patch-side-nav.mjs. -->',
};

/* ══ 掴みどころ ═══════════════════════════════════════════════════
   ⚠️ **行頭に錨を打つ。** 錨が無いと、ページのコメントや <style> の中に
      同じ字面が1回でも出た瞬間、そこから最初の閉じまでを丸ごと呑み込む。
      2026-09-05、world-airlines.html に置いた注意書きの中の字面に当たり、
      CSS 240行とヘッダーが消えた（ファイルは壊れたが検査は静かなまま）。 */
const SIDE_RE = /<nav class="mr-side"[\s\S]*?<\/nav>/;
const BODY_TAG_RE = /<body[^>]*>/;
const HEAD_RE = /^[ \t]*<!-- PV-NAV:[\s\S]*?-->\n(?:[ \t]*<link rel="stylesheet" href="(?:\.\.\/)*(?:pv-tokens|app-nav)\.css">[ \t]*\n)*/m;
const JS_RE = /^(<!--(?:(?!-->)[\s\S])*?-->\n)?[ \t]*<script src="(?:\.\.\/)*app-nav\.js"><\/script>[ \t]*\n/m;
/* 下タブ（.mr-tabs）は 2026-09-06 に廃止済み。残骸が戻ってきたときのための見張り。 */
const TAB_RE = /^(<!--(?:(?!-->)[\s\S])*?-->\n)?<nav class="mr-tabs"[\s\S]*?<\/nav>[ \t]*\n?/m;
const TABCSS_RE = /^([ \t]*)<link rel="stylesheet" href="((?:\.\.\/)?)tabs\.css">[ \t]*\n/m;
const CLASS_RE = /(<body[^>]*\bclass=")([^"]*)"/;

/* ヘッダーの横並びリンク（`hidden md:flex` の div）。直前の説明コメントごと拾う。
   ⚠️ 閉じ側は**開き側と同じ字下げ**（\1）で錨を打つ。中に入れ子の div は無い
      （268枚すべてを走査して a.nav-link しか入っていないことを確かめてある）が、
      いつか誰かが入れたときに静かに呑み込ませない。 */
const LINKBOX_RE = /^([ \t]*)(?:<!--(?:(?!-->)[\s\S])*?-->\n[ \t]*)?<div class="hidden md:flex[^"]*">\n([\s\S]*?)^\1<\/div>[ \t]*\n/m;
/* ★1行で書かれている形もある（airlines/ の13枚。リンクが1本しか無い社）。
     上の regex は開きタグの直後の改行を要求するので、素通ししてしまう。
     ⚠️ 落ちても赤くならない ── 板は入るのにヘッダーのリンクだけ残る形になる。 */
const LINKBOX1_RE = /^([ \t]*)<div class="hidden md:flex[^"]*">((?:(?!<\/div>)[\s\S])*?)<\/div>[ \t]*\n/m;

/* ══ 深さの解き方 ═════════════════════════════════════════════════
   2種類あって、混ぜると 404 が生える。
     up     … リポジトリの根まで（app-nav.css / app-nav.js / pv-tokens.css 用）
              en/airlines/ana.html → '../../'
     navPre … **その言語の根**まで（板の行き先用）
              en/airlines/ana.html → '../'（＝ en/index.html を指したい）
              airlines/ana.html    → '../'（＝ index.html） */
const up = (rel) => '../'.repeat(rel.split('/').length - 1);
const inRoot = (rel) => (rel.startsWith('en/') ? rel.slice(3) : rel);
const navPre = (rel) => '../'.repeat(inRoot(rel).split('/').length - 1);

/* ══ 対象を集める ═════════════════════════════════════════════════ */
const only = (() => {
  const i = process.argv.indexOf('--only');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const check = process.argv.includes('--check');

const files = [];
for (const dir of DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs).filter((x) => x.endsWith('.html')).sort()) {
    const rel = dir === '.' ? f : dir + '/' + f;
    if (SKIP.has(path.basename(rel))) continue;
    if (only && rel !== only) continue;
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    /* ヘッダーが2種類。どちらも無いページ（404 / admin / auth-callback / unsubscribe）は
       ナビの器そのものが無いので触らない。 */
    const app = /<header[^>]*class="[^"]*\bmr-top\b/.test(html);
    const pub = html.includes('id="main-nav"');
    if (!app && !pub) continue;
    files.push({ rel, html, kind: app ? 'app' : 'pub' });
  }
}
if (only && !files.length) {
  console.log(`❌ --only ${only} — 対象に入っていない（除外6枚か、ヘッダーが無いページ）`);
  process.exit(1);
}

/* ══ 配る ═════════════════════════════════════════════════════════ */
let changed = 0;
const count = { app: 0, pub: 0 };
const bar = {};      /* ヘッダーの高さの内訳 */
let links = 0;       /* 横並びリンクを外した枚数 */

for (const f of files) {
  const { rel, kind } = f;
  const lang = rel.startsWith('en/') ? 'en' : 'ja';
  const cur = CURRENT[inRoot(rel)] || '';
  const U = up(rel);
  const P = navPre(rel);
  let html = f.html;
  count[kind]++;

  /* ── ① 板の中身。すでに在れば入れ替え、無ければ <body> の直後へ置く。
        ★JS で組み立てない。組み立てると、JS が落ちた人からナビが丸ごと消えるうえ、
          航空会社110枚は内部リンクを3本失ったまま代わりが HTML に無い＝SEO が痩せる。 */
  const want = buildNav(lang, cur, P);
  const got = html.match(SIDE_RE);
  if (got) {
    if (got[0] !== want) html = html.replace(SIDE_RE, () => want);
  } else {
    if (!BODY_TAG_RE.test(html)) {
      console.log(`❌ ${rel} — <body> が見つからない。書かずに飛ばす`);
      process.exitCode = 1;
      continue;
    }
    html = html.replace(BODY_TAG_RE, (m) => m + '\n' + want + '\n');
  }

  /* ── ② <body> の class。
        pv-anav-shell … 板を持つページ（app-nav.css の規則が全部ここに掛かる）
        pv-anav-pub / -app … ヘッダーの種類
        pv-anav-tNN   … **ヘッダーの実測の高さ**。左レールの上端になる。
        ★数を人が写さない。ページの h-[…] を読んで書く。
          読めなかったときは既定（pv-anav-pub の 73px）に落ちる。 */
  let tone = '';
  if (kind === 'pub') {
    const i = html.indexOf('<nav id="main-nav"');
    const m = i >= 0 ? html.slice(i, i + 700).match(/\bh-\[(\d+)px\]/) : null;
    if (m) { tone = 'pv-anav-t' + (Number(m[1]) + 1); bar[m[1]] = (bar[m[1]] || 0) + 1; }
    else { bar['?'] = (bar['?'] || 0) + 1; }
  }
  const add = ['pv-anav-shell', kind === 'app' ? 'pv-anav-app' : 'pv-anav-pub'];
  if (tone) add.push(tone);
  if (CLASS_RE.test(html)) {
    html = html.replace(CLASS_RE, (m, head, cls) => {
      const keep = cls.split(/\s+/).filter((c) => c && c !== 'mr-tabs-pad' && !c.startsWith('pv-anav-'));
      return head + keep.concat(add).join(' ') + '"';
    });
  } else {
    html = html.replace(BODY_TAG_RE, (m) => m.replace(/^<body/, '<body class="' + add.join(' ') + '"'));
  }

  /* ── ③ <head>。無いものだけ足す。**</head> の直前**＝どの <style> よりも後になり、
        アプリ画面では my-value.css より後になる（app-nav.css が勝つ）。
        ⚠️ pv-tokens.css は --pv-* を :root に定義するだけで、規則を1つも持たない。
           足しても見た目は変わらない（388枚ぶん確認済み）。 */
  html = html.replace(HEAD_RE, () => '');
  const need = [];
  if (!new RegExp('href="(?:\\.\\./)*pv-tokens\\.css"').test(html)) need.push('pv-tokens.css');
  if (!new RegExp('href="(?:\\.\\./)*app-nav\\.css"').test(html)) need.push('app-nav.css');
  if (need.length) {
    const block = HEAD_NOTE[lang]
      + need.map((n) => '  <link rel="stylesheet" href="' + U + n + '">\n').join('');
    if (!html.includes('</head>')) {
      console.log(`❌ ${rel} — </head> が無い。書かずに飛ばす`);
      process.exitCode = 1;
      continue;
    }
    html = html.replace('</head>', () => block + '</head>');
  }

  /* ── ④ app-nav.js を </body> の直前へ。★search.js より必ず後になる。 */
  html = html.replace(JS_RE, (m, note) =>
    /* 直前のコメントは、こちらが書いたものだけ落とす（無関係な注意書きは残す）。 */
    (note && !/PV-NAV|app-nav|アプリのナビ|App navigation/.test(note) ? note : ''));
  if (!html.includes('</body>')) {
    console.log(`❌ ${rel} — </body> が無い。書かずに飛ばす`);
    process.exitCode = 1;
    continue;
  }
  html = html.replace('</body>', () =>
    JS_NOTE[lang] + '<script src="' + U + 'app-nav.js"></script>\n</body>');

  /* ── ⑤ ヘッダーの横並びリンクを外す（公開ページだけ・確定事項13）。
        行き先は板に入っている。ロゴ・検索・テーマ・言語・通貨・ログイン・CTA・
        「← 一覧に戻る」は**残す**（あれらは別の div に在る）。 */
  if (kind === 'pub') {
    const i = html.indexOf('<nav id="main-nav"');
    const j = i >= 0 ? html.indexOf('</nav>', i) : -1;
    if (j > 0) {
      const nav = html.slice(i, j);
      const RE  = LINKBOX_RE.test(nav) ? LINKBOX_RE : LINKBOX1_RE;
      const box = nav.match(RE);
      if (box) {
        /* ★呑み込みの見張り。中に在るのは a.nav-link だけのはず。 */
        const inner = box[2].replace(/<a\b[^>]*class="[^"]*\bnav-link\b[^"]*"[^>]*>[\s\S]*?<\/a>\s*/g, '').trim();
        if (inner) {
          console.log(`⚠️ ${rel} — 横並びの中に a.nav-link 以外が在る。外さずに残す`);
        } else {
          const neu = box[1] + LINK_NOTE[lang].split('\n').join('\n' + box[1]) + '\n';
          html = html.slice(0, i) + nav.replace(RE, () => neu) + html.slice(j);
          links++;
        }
      } else if (nav.includes('<div class="hidden md:flex')) {
        console.log(`⚠️ ${rel} — 横並びの形が想定外。外さずに残す`);
      }
    }
  }

  /* ── ⑥ 下タブ（.mr-tabs）の後始末。2026-09-06 に廃止済み。
        いま残骸は1枚も無いが、生成スクリプトの流し直しで戻ることがあるので見張る。 */
  const tab = html.match(TAB_RE);
  if (tab) {
    const nav = tab[0].slice((tab[1] || '').length);
    if (/<\/style>|<!--|<script/.test(nav)) {
      console.log(`❌ ${rel} — 下タブの入れ物が他の中身まで呑み込んでいる。書かずに止める`);
      process.exitCode = 1;
      continue;
    }
    const keep = tab[1] && !tab[1].includes('patch-side-nav.mjs') ? tab[1] : '';
    html = html.replace(TAB_RE, () => keep);
  } else if (html.includes('class="mr-tabs"')) {
    console.log(`⚠️ ${rel} — 下タブの残骸が桁0から始まっていない（手で消す）`);
    process.exitCode = 1;
  }
  if (TABCSS_RE.test(html)) html = html.replace(TABCSS_RE, () => '');

  if (html === f.html) continue;
  changed++;
  console.log(`${check ? '差分' : '書換'} ${rel}`);
  if (!check) fs.writeFileSync(path.join(ROOT, rel), html);
}

console.log(`\n配った先 ${count.pub + count.app} 枚（公開 ${count.pub} ／ アプリ ${count.app}）`
          + `\nヘッダーの横並びリンクを外した ${links} 枚`
          + `\nヘッダーの高さ ${Object.entries(bar).sort().map(([k, v]) => `h-[${k}px]×${v}`).join(' / ')}`
          + `\n${check ? '食い違い' : '書き換え'} ${changed} 枚`);
if (check && changed) process.exitCode = 1;
