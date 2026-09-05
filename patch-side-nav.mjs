/* ════════════════════════════════════════════════════════════════
   patch-side-nav.mjs — マイページ系の行き先（左メニューと下タブ）を1か所から配る

   配る先は 16枚。
     左メニュー（.mr-side）… マイページ系 7画面 × 日英 ＝ 14枚
     下タブ（.mr-tabs）    … その14枚 ＋ 世界の航空会社一覧 日英2枚
   同じ項目を人が16か所に書き写すと、必ず1枚だけ古いまま残る。
   実際に 2026-08-23 まで、my-value / airline-conditions の両方に
   「3つだけ」というコメントが残っていた。

   ★このスクリプトが触るのは2つの入れ物の**中だけ**。
       <nav class="mr-side" …> 〜 </nav>   ── 左メニュー（広い画面）
       <nav class="mr-tabs" …> 〜 </nav>   ── 下タブ（狭い画面・2026-09-05 追加）
     その前後（コメント・.mr-shell・.mr-main）には手を出さない。
   ★下タブは「入れ物が在るページ」にだけ書く。無いページには作らない。
     新しいページに出したいときは、空の <nav class="mr-tabs"></nav> を
     </body> の直前に1回だけ置き、tabs.css と pv-tokens.css を読ませる
     （.mr-shell を持たないページは <body> に mr-tabs-pad も）。
   ★pay-report.html には置かない。理由は2つ ──
     ① .sticky-cta（この内容で提出する）が既に足元を使っていて帯が2本になる
     ② あの画面は入力の途中で下書きを保存しない。他所へ移る口を足すと、
        書きかけの数字が黙って消える。
     2026-09-05、オーナーの指示で下タブから「給与を追加」そのものを外した。
     狭い画面の入口は 本文の橙のボタンと、左メニューに残した .is-add。
   ★冪等。何度流しても同じ結果になる（`--check` で書かずに差分だけ見る）。

   使い方:
     node patch-side-nav.mjs           書き込む
     node patch-side-nav.mjs --check   食い違っているページを数えるだけ（書かない）

   ⚠️ 置換は必ず関数形 s.replace(old, () => neu) で書く。
      文字列で渡すと中の $ が特殊記号として解釈される（CLAUDE.md 参照）。
   ════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* ★絶対パスを書かない。自分の位置から解く（公開リポジトリなのでログイン名が漏れる）。 */
const ROOT = fileURLToPath(new URL('.', import.meta.url));

const ICON = {
  report:  '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
  deep:    '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  verified:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  others:  '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  add:     '<path d="M12 5v14"/><path d="M5 12h14"/>',
  /* 旗。運営が目指している先と、そこへ声を出す場所。 */
  roadmap: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  /* ★錠前。まだ開いていない段に付ける（pv-gates.js が REAL PAY にも同じものを複製する）。 */
  lock:    '<rect x="4" y="10.5" width="16" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.2.6.77 1 1.41 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
};

/* ★「匿名で給与を追加」だけが色を持つ（is-add）。このサイトで一番押してほしいもの。
     3つも4つも色を付けると、どれも押されなくなる。

   ★給与を見る画面は3枚に分ける（2026-08-24 オーナー指示）。順番も指示どおり。
       REAL PAY     … 他のパイロットの実給与。1行＝1人
       DEEP PAY     … その給与が何で構成されているかを複数の投稿から集計して見る
       VERIFIED PAY … 明細に裏付けのあるものだけを複数の明細から集計して見る
     ⚠️ 後ろ2枚は**まだページが無い**ので soon: true ＝ <a href> にしない。
        リンクにすると assert-links.mjs が 404 で落ちるし、押した人が行き止まりに落ちる。
        ページを作った回に href を入れて soon を外す（ここ1か所で8枚に配られる）。

   ★2026-08-25、soon の出し方を <span aria-disabled> から <button> に変えた。
     span はキーボードから掴めず、押しても何も起きない＝押せそうに見えて死んでいる。
     button なら 404 も作らず、押すと pv-gates.js が
     「何を出すと何が見られるか」を説明する（オーナー指示の Give-to-Get）。

   ★data-mr-gate は pv-gates.js の目印。3段ぶん付ける。
     REAL PAY（others）は鍵が要るので、錠前を出すかは実行時に決まる。 */
const ITEMS = [
  { key: 'report',   href: 'my-value.html',        icon: 'report',   add: false },
  { key: 'others',   href: 'actual-pay.html',      icon: 'others',   add: false, gate: 'real' },
  { key: 'deep',     href: '',                     icon: 'deep',     add: false, soon: true, gate: 'deep' },
  { key: 'verified', href: '',                     icon: 'verified', add: false, soon: true, gate: 'verified' },
  { key: 'add',      href: 'pay-report.html#ps',   icon: 'add',      add: true  },
  /* ★NEW バッジは付けない。色が付くのは is-add の1つだけと決めてある
       （上のコメント）。後で外す前提の飾りのために14枚の生成器を広げない。 */
  { key: 'roadmap',  href: 'roadmap.html',         icon: 'roadmap',  add: false },
  { key: 'settings', href: 'profile.html',         icon: 'settings', add: false },
];

/* ★2026-09-05、roadmap の項目名を「ROADMAP & REQUESTS」にした（オーナー指示）。
     ページの大見出しが最初からその綴りで、左メニューだけ ROADMAP と短かった。
     ⚠️ ここを変えたら assert-roadmap.mjs の「patch-side-nav.mjs に … が在る」も
        同じコミットで直す（文言をそのまま見ている）。 */
const TEXT = {
  ja: {
    aria: 'マイページ',
    note: '氏名も社員番号も受け取りません。',
    report: 'マイレポート', others: 'REAL PAY',
    deep: 'DEEP PAY', verified: 'VERIFIED PAY',
    add: '匿名で給与を追加', roadmap: 'ROADMAP & REQUESTS', settings: '設定',
    /* 錠前の付いた段の読み上げ。pv-gates.js は aria-label が無いときだけ書く
       ＝ここに置いた言い方が正で、JS が落ちても読み上げは死なない。 */
    soonAria: (n) => n + '（準備中・押すと説明が出ます）',
    /* 下タブ。1枠が 70px ほどしか無いので、左メニューより短い言い方にする。
       ★「匿名で」は帯には書かない（左メニューとボタン本体が言っている）。 */
    tabAria: '画面の切り替え',
    tab: { report: 'マイレポート', roadmap: null, others: 'REAL PAY',
           airlines: '各航空会社', settings: 'マイページ' },
  },
  en: {
    aria: 'My page',
    note: 'We never collect your name or staff number.',
    report: 'My report', others: 'REAL PAY',
    deep: 'DEEP PAY', verified: 'VERIFIED PAY',
    add: 'Add pay anonymously', roadmap: 'ROADMAP & REQUESTS', settings: 'Settings',
    soonAria: (n) => n + ' (in preparation) — press for details',
    tabAria: 'Sections',
    tab: { report: 'My report', roadmap: null, others: 'REAL PAY',
           airlines: 'Airlines', settings: 'Account' },
  },
};

/* 下タブに出す5つ。★並びはオーナーが決めた順（2026-09-05）──
     マイレポート / ROADMAP & REQUESTS / REAL PAY / 各航空会社 / マイページ。
   ⚠️ 左メニュー（ITEMS）とは中身も順番も別。揃えようとしない。
   ⚠️ DEEP PAY / VERIFIED PAY は入れない。まだページが無く、帯の中では
      錠前の説明を出す場所も無い（左メニューには残っている）。
   ⚠️ 「給与を追加」は入れない。行き先の pay-report.html に帯が無く、
      押すと帯そのものが消えて行き止まりに見える（オーナーが実機で指摘）。 */
const TABS = ['report', 'roadmap', 'others', 'airlines', 'settings'];

/* 下タブにだけ在る行き先（左メニューには置かない）。
   ★world-airlines.html は日英とも同じファイル名なので、相対のまま両方で当たる。 */
const TAB_HREF = { airlines: 'world-airlines.html' };

/* roadmap だけ3行に割る（オーナー指示「Roadmap / & / Requests、＆は小さく」）。
   ★割る場所をこちらで決める。ブラウザ任せの折り返しだと幅ごとに割れ方が変わる。
   ★日英で同じ形。ROADMAP & REQUESTS は英語のまま出す語なので訳し分けない。 */
const TAB_ROADMAP = '<span>Roadmap</span><span class="mr-tab-am">&amp;</span><span>Requests</span>';

/* どのページがどの項目で光るか。ここに無いページ（airline-conditions 等）は
   どれも光らせない＝導線から来る画面なので「今ここ」を主張しない。 */
const CURRENT = {
  'my-value.html': 'report',
  'actual-pay.html': 'others',
  'profile.html': 'settings',
  'roadmap.html': 'roadmap',
  'world-airlines.html': 'airlines',
};

function buildNav(lang, current) {
  const t = TEXT[lang];
  const rows = ITEMS.map((it) => {
    const on = it.key === current;
    const cls = 'mr-side-a' + (on ? ' is-on' : '') + (it.add ? ' is-add' : '')
              + (it.soon ? ' is-locked' : '');
    const gate = it.gate ? ' data-mr-gate="' + it.gate + '"' : '';
    const svg = '        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
              + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
              + ICON[it.icon] + '</svg>\n'
              + '        <span>' + t[it.key] + '</span>\n';
    /* ★まだ無いページは <button> で出す。
         href の無い <a> はキーボードで拾えず、押せるように見えて何も起きない。
         本物の href を付ければ 404（assert-links.mjs が落ちる）。
         button なら両方避けられて、押すと pv-gates.js が説明を出す。
       ★錠前はここで静的に描く。実行時に足すと一瞬だけ錠前の無い姿が見える。 */
    const lock = '        <svg class="mr-side-lk" width="13" height="13" viewBox="0 0 24 24"'
               + ' fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"'
               + ' stroke-linejoin="round" aria-hidden="true" focusable="false">'
               + ICON.lock + '</svg>\n';
    if (it.soon) {
      return '      <button type="button" class="' + cls + '"' + gate
           + ' aria-label="' + t.soonAria(t[it.key]) + '">\n' + svg + lock + '      </button>';
    }
    return '      <a class="' + cls + '" href="' + it.href + '"' + gate
         + (on ? ' aria-current="page"' : '') + '>\n' + svg + '      </a>';
  });
  return '<nav class="mr-side" aria-label="' + t.aria + '">\n'
       + rows.join('\n') + '\n'
       + '      <p class="mr-side-note">' + t.note + '</p>\n'
       + '    </nav>';
}

/* 下タブ（狭い画面だけ出る）。
   ★今いるページはリンクにしない ── 押しても何も起きないリンクを置かない。
     読み上げには aria-current="page" で「今ここ」と伝える。
   ★aria-label は左メニュー（「マイページ」/「My page」）と別の語にする。
     同じ語の landmark が2つあると、読み上げでどちらか分からなくなる。 */
function buildTabs(lang, current) {
  const t = TEXT[lang];
  const rows = TABS.map((key) => {
    const href = TAB_HREF[key] || (ITEMS.find((x) => x.key === key) || {}).href;
    const on = key === current;
    const body = t.tab[key] === null ? TAB_ROADMAP : t.tab[key];
    /* 3行に割った項目だけ、読み上げ用に1つの語を渡す（Roadmap / & / Requests と
       ばらばらに読ませない）。 */
    /* ★属性の中に & を裸で置かない（HTML の実体参照と紛らわしい）。
       ⚠️ 置換は関数形。文字列で渡すと $ が特殊記号になる（CLAUDE.md）。 */
    const lab = t.tab[key] === null
      ? ' aria-label="' + t[key].replace(/&/g, () => '&amp;') + '"' : '';
    if (on) {
      return '  <span class="mr-tab is-on" aria-current="page"' + lab + '>' + body + '</span>';
    }
    return '  <a class="mr-tab" href="' + href + '"' + lab + '>' + body + '</a>';
  });
  return '<nav class="mr-tabs" aria-label="' + t.tabAria + '">\n'
       + rows.join('\n') + '\n'
       + '</nav>';
}

const files = [];
for (const dir of ['.', 'en']) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs).filter((x) => x.endsWith('.html')).sort()) {
    const rel = dir === '.' ? f : dir + '/' + f;
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    /* ★どちらか一方だけのページが在る（世界の航空会社一覧は下タブだけ）。 */
    if (html.includes('<nav class="mr-side"') || /^<nav class="mr-tabs"/m.test(html))
      files.push({ rel, html });
  }
}

const check = process.argv.includes('--check');
let changed = 0;
let tabPages = 0;
for (const f of files) {
  const { rel } = f;
  const lang = rel.startsWith('en/') ? 'en' : 'ja';
  const base = path.basename(rel);
  const cur = CURRENT[base] || '';
  let html = f.html;
  let dirty = false;

  /* ① 左メニュー。マイページ系にだけ在る。 */
  if (/<nav class="mr-side"/.test(html)) {
    const want = buildNav(lang, cur);
    const re = /<nav class="mr-side"[\s\S]*?<\/nav>/;
    const got = html.match(re);
    if (!got) console.log(`⚠️ ${rel} — <nav class="mr-side"> の閉じが見つからない`);
    else if (got[0] !== want) { html = html.replace(re, () => want); dirty = true; }
  }

  /* ② 下タブ。入れ物が在るページにだけ書く（無いページには作らない）。
     ⚠️ **行頭に錨を打つ。** 入れ物は必ず桁0から書き出す（このスクリプトがそう書く）。
        錨が無いと、ページのコメントや <style> の中に同じ字面が1回でも出た瞬間、
        そこから最初の </nav> までを丸ごと呑み込む。
        2026-09-05、world-airlines.html に置いた注意書きの中の字面に当たり、
        CSS 240行とヘッダーが消えた（ファイルは壊れたが検査は静かなまま）。 */
  /* 錨は**始まり側だけ**。空の入れ物は <nav …></nav> と1行で書かれるので、
     閉じ側にも ^ を打つと初回だけ当たらない。呑み込みは下の見張りで止める。 */
  const TAB_RE = /^<nav class="mr-tabs"[\s\S]*?<\/nav>/m;
  if (TAB_RE.test(html)) {
    tabPages++;
    const want = buildTabs(lang, cur);
    const got = html.match(TAB_RE);
    /* ★呑み込みの見張り。入れ物の中にこれらが在るはずが無い。 */
    if (/<\/style>|<!--|<script/.test(got[0])) {
      console.log(`❌ ${rel} — 下タブの入れ物が他の中身まで呑み込んでいる。書かずに止める`);
      process.exitCode = 1;
      continue;
    }
    if (got[0] !== want) { html = html.replace(TAB_RE, () => want); dirty = true; }
  } else if (html.includes('class="mr-tabs"')) {
    console.log(`⚠️ ${rel} — 下タブの入れ物が桁0から始まっていない（行頭に置く）`);
    process.exitCode = 1;
  }

  if (!dirty) continue;
  changed++;
  console.log(`${check ? '差分' : '書換'} ${rel}`);
  if (!check) fs.writeFileSync(path.join(ROOT, rel), html);
}

console.log(`\n配った先 ${files.length} 枚（うち下タブ ${tabPages} 枚）`
          + ` / ${check ? '食い違い' : '書き換え'} ${changed} 枚`);
if (check && changed) process.exitCode = 1;
