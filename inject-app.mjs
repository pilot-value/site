/* ════════════════════════════════════════════════════════════════
   inject-app.mjs — スマホのホーム画面に置ける形（2026-11-07）の head の塊を、全ページに入れる冪等バッチ

   オーナー採用「スマホのホーム画面に置けるようにする（アプリのように開ける）」。
   入れるのは <!--PV-APP-->…<!--/PV-APP--> の1つだけ：
     ・言語ごとの manifest（日 manifest.webmanifest／英 manifest-en／西 manifest-es。start_url がその言語のトップ）
     ・theme-color（ブラウザの上の帯の色）と、iPhone 用の3行（アプリとして開く・名前・上の帯の色）
     ・小さなインライン：サイトのテーマ（data-theme）に合わせて theme-color を替える（切り替えても付いてくる）

   ・置き場所は apple-touch-icon の行の直後（無ければ </head> の直前）。何度流しても同じ結果。
   ・日英のページはここで書く。スペイン語（es/）は gen-lang.mjs が英語のページから写す
     （そのとき manifest-en → manifest-es に置き換える。gen-lang.mjs の「PV-APP」）。
     ⚠️ es/ をここで書かない ── gen-lang.mjs の出力と食い違うと assert-generated.mjs が落ちる。
   ・page-dates.mjs はこの塊を「直した日」に数えない（全ページが一斉に今日直したにならない）。

   ⚠️ 新しいページを足したら流す（gen-countries.mjs・airline-donor-pages.mjs が書くページには入っていない）。
      入れ忘れは assert-app.mjs が捕まえる。

   実行: node inject-app.mjs        書く
         node inject-app.mjs --check 書かずに、直すページの数だけ出す
════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const CHECK = process.argv.includes('--check');

/* 日英の置き場（es/ は gen-lang.mjs）。[フォルダ, ルートへの相対, 言語] */
export const APP_DIRS = [
  ['.', '', 'ja'], ['airlines', '../', 'ja'], ['countries', '../', 'ja'],
  ['en', '../', 'en'], ['en/airlines', '../../', 'en'], ['en/countries', '../../', 'en'],
];
export const MANIFEST = { ja: 'manifest.webmanifest', en: 'manifest-en.webmanifest', es: 'manifest-es.webmanifest' };
export const THEME = { light: '#ffffff', dark: '#0a0c0f' };   // pv-tokens.css の --pv-bg（ライト／ダーク）

export function appBlock(rel, lang) {
  return `<!--PV-APP-->
<link rel="manifest" href="${rel}${MANIFEST[lang]}"/>
<meta name="theme-color" content="${THEME.light}"/>
<meta name="mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-title" content="PILOT VALUE"/>
<meta name="apple-mobile-web-app-status-bar-style" content="default"/>
<script>(function(){try{var d=document.documentElement,m=document.querySelector('meta[name="theme-color"]'),s=function(){m.setAttribute('content',d.getAttribute('data-theme')==='dark'?'${THEME.dark}':'${THEME.light}')};s();new MutationObserver(s).observe(d,{attributes:true,attributeFilter:['data-theme']})}catch(e){}}());</script>
<!--/PV-APP-->`;
}
export const BLOCK_RE = /<!--PV-APP-->[\s\S]*?<!--\/PV-APP-->/;

export function withApp(html, rel, lang) {
  const block = appBlock(rel, lang);
  if (BLOCK_RE.test(html)) return html.replace(BLOCK_RE, () => block);
  /* ★入れるのは「塊＋改行1つ」だけ。前後の空白は1文字も触らない
     （page-dates.mjs が塊＋改行を取り除いて元と比べる＝取り除けば元のファイルに戻る形にしておく）。 */
  const icon = html.match(/<link rel="apple-touch-icon"[^>]*>\n?/);
  if (icon) {
    const at = icon.index + icon[0].length;
    return html.slice(0, at) + block + '\n' + html.slice(at);
  }
  const head = html.lastIndexOf('</head>');
  if (head < 0) return null;
  return html.slice(0, head) + block + '\n' + html.slice(head);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  let wrote = 0, same = 0;
  const noHead = [];
  for (const [dir, rel, lang] of APP_DIRS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).filter((x) => x.endsWith('.html')).sort()) {
      const fp = path.join(abs, f);
      const html = fs.readFileSync(fp, 'utf8');
      const next = withApp(html, rel, lang);
      if (next == null) { noHead.push(path.join(dir, f)); continue; }
      if (next === html) { same++; continue; }
      wrote++;
      if (!CHECK) fs.writeFileSync(fp, next);
    }
  }
  console.log(`PV-APP: ${CHECK ? '直すページ' : '書いた'} ${wrote}枚・そのまま ${same}枚` + (noHead.length ? `・</head> が無い ${noHead.length}枚: ${noHead.join(', ')}` : ''));
  if (CHECK && wrote) process.exitCode = 1;
}
