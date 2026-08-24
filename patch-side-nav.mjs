/* ════════════════════════════════════════════════════════════════
   patch-side-nav.mjs — マイページ系のサイドバー（.mr-side）を1か所から配る

   .mr-side を持つページは 8枚（4画面 × 日英）。
   同じ項目を人が8か所に書き写すと、必ず1枚だけ古いまま残る。
   実際に 2026-08-23 まで、my-value / airline-conditions の両方に
   「3つだけ」というコメントが残っていた。

   ★このスクリプトが触るのは <nav class="mr-side" …> 〜 </nav> の**中だけ**。
     その前後（コメント・.mr-shell・.mr-main）には手を出さない。
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
        ページを作った回に href を入れて soon を外す（ここ1か所で8枚に配られる）。 */
const ITEMS = [
  { key: 'report',   href: 'my-value.html',        icon: 'report',   add: false },
  { key: 'others',   href: 'actual-pay.html',      icon: 'others',   add: false },
  { key: 'deep',     href: '',                     icon: 'deep',     add: false, soon: true },
  { key: 'verified', href: '',                     icon: 'verified', add: false, soon: true },
  { key: 'add',      href: 'pay-report.html#ps',   icon: 'add',      add: true  },
  { key: 'settings', href: 'profile.html',         icon: 'settings', add: false },
];

const TEXT = {
  ja: {
    aria: 'マイページ',
    note: '氏名も社員番号も受け取りません。',
    report: 'マイレポート', others: 'REAL PAY',
    deep: 'DEEP PAY', verified: 'VERIFIED PAY',
    add: '匿名で給与を追加', settings: '設定',
  },
  en: {
    aria: 'My page',
    note: 'We never collect your name or staff number.',
    report: 'My report', others: 'REAL PAY',
    deep: 'DEEP PAY', verified: 'VERIFIED PAY',
    add: 'Add pay anonymously', settings: 'Settings',
  },
};

/* どのページがどの項目で光るか。ここに無いページ（airline-conditions 等）は
   どれも光らせない＝導線から来る画面なので「今ここ」を主張しない。 */
const CURRENT = {
  'my-value.html': 'report',
  'actual-pay.html': 'others',
  'profile.html': 'settings',
};

function buildNav(lang, current) {
  const t = TEXT[lang];
  const rows = ITEMS.map((it) => {
    const on = it.key === current;
    const cls = 'mr-side-a' + (on ? ' is-on' : '') + (it.add ? ' is-add' : '')
              + (it.soon ? ' is-soon' : '');
    const svg = '        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
              + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
              + ICON[it.icon] + '</svg>\n'
              + '        <span>' + t[it.key] + '</span>\n';
    /* ★まだ無いページは <span> で出す。href の無い <a> はキーボードで拾えず、
         押せるように見えて何も起きない（一番たちの悪い形）。 */
    if (it.soon) {
      return '      <span class="' + cls + '" aria-disabled="true">\n' + svg + '      </span>';
    }
    return '      <a class="' + cls + '" href="' + it.href + '"'
         + (on ? ' aria-current="page"' : '') + '>\n' + svg + '      </a>';
  });
  return '<nav class="mr-side" aria-label="' + t.aria + '">\n'
       + rows.join('\n') + '\n'
       + '      <p class="mr-side-note">' + t.note + '</p>\n'
       + '    </nav>';
}

const files = [];
for (const dir of ['.', 'en']) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs).filter((x) => x.endsWith('.html')).sort()) {
    const rel = dir === '.' ? f : dir + '/' + f;
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    if (html.includes('<nav class="mr-side"')) files.push({ rel, html });
  }
}

const check = process.argv.includes('--check');
let changed = 0;
for (const { rel, html } of files) {
  const lang = rel.startsWith('en/') ? 'en' : 'ja';
  const base = path.basename(rel);
  const want = buildNav(lang, CURRENT[base] || '');
  const re = /<nav class="mr-side"[\s\S]*?<\/nav>/;
  const got = html.match(re);
  if (!got) { console.log(`⚠️ ${rel} — <nav class="mr-side"> の閉じが見つからない`); continue; }
  if (got[0] === want) continue;
  changed++;
  console.log(`${check ? '差分' : '書換'} ${rel}`);
  if (!check) fs.writeFileSync(path.join(ROOT, rel), html.replace(re, () => want));
}

console.log(`\n.mr-side を持つページ ${files.length} 枚 / ${check ? '食い違い' : '書き換え'} ${changed} 枚`);
if (check && changed) process.exitCode = 1;
