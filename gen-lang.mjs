/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — gen-lang.mjs（2026-11-02・多言語化の段1）
   英語のページから、3つ目からの言語のページを書く。**es/ のファイルは手で直さない**（次に流すと消える）。

   使い方
     node gen-lang.mjs              機械で作る言語（langs.mjs で hand の無い言語）を全部
     node gen-lang.mjs es           langs.mjs の LANG.es.pages を英語のページから作る
     node gen-lang.mjs es --check   書かずに、何が変わるかと訳の足りない文の数だけ出す

   やること（英語のページは読むだけ・1文字も書き換えない）
     1) 本文の文と属性（alt・title・aria-label・placeholder）と、ページの中の台本の画面に出る文字列を、
        訳の辞書 i18n/tm-<言語>.mjs の訳で差し戻す。
        使うのは状態が validated（AI の4段と機械検査を通った）か manual（人が直した）の訳だけ。
        辞書に無い文は英語のまま残す（そのページは検索に出さない＝langs.mjs の indexed に入れない）。
     2) <html lang> をその言語に。
     3) リンク：その言語のページがあればそちらへ、無ければ英語版へ（../en/…）。?next= の戻り先も同じ。
     4) head の管理ブロック（<!--PV-SEO-->）を作り直す：訳した説明文・自分の canonical・
        検索に出すページだけ robots index と hreflang（ja / en / その言語 / x-default）。出さないページは noindex。
   ════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extract, extractHead, restore, splice, findAttrs, escAttr, escText, inlineScriptUnits } from './i18n-core.mjs';
import { LANG, LANGS, relIn, urlOfRel, alternatesFor } from './langs.mjs';
import { needsAI } from './i18n/keep.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const CHECK = process.argv.includes('--check');
const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const CODES = arg ? [arg] : LANGS.filter((l) => !l.hand).map((l) => l.code);
for (const c of CODES) if (!LANG[c] || LANG[c].hand) { console.error(`使い方: node gen-lang.mjs [言語]（機械で作る言語: ${LANGS.filter((l) => !l.hand).map((l) => l.code).join(', ')}）`); process.exit(1); }

for (const code of CODES) {
const L = LANG[code];
const tmFile = path.join(ROOT, 'i18n', `tm-${code}.mjs`);
const { TM } = fs.existsSync(tmFile) ? await import(tmFile) : { TM: {} };
const tr = (key) => (TM[key] && ['validated', 'manual'].includes(TM[key].st) ? TM[key].es : null);
const mine = new Set(L.pages);
const P = path.posix;

/* リンクの行き先。enRel のページの中のリンク v を、outRel のページの中で正しく指す形に */
function fixLink(v, enRel, outRel) {
  if (!v) return null;
  const fixNext = (q) => q.replace(/([?&]next=)([^&#]*)/, (all, k, val) => {
    const dec = decodeURIComponent(val);
    const m = dec.match(/^\/en\/([^?#]*)(.*)$/);
    return m && mine.has(m[1]) ? k + encodeURIComponent(`/${L.dir}${m[1]}${m[2]}`) : all;
  });
  const abs = v.match(/^https:\/\/pilot-value\.com\/en\/([^?#]*)(.*)$/);
  if (abs) return mine.has(abs[1]) ? `https://pilot-value.com/${L.dir}${abs[1]}${abs[2]}` : null;
  if (/^(#|[a-z][a-z0-9+.-]*:|\/\/)/i.test(v)) return null;           // 外のサイト・mailto・ページ内
  if (v.startsWith('/')) {
    const m = v.match(/^\/en\/([^?#]*)(.*)$/);
    return m && mine.has(m[1]) ? `/${L.dir}${m[1]}${fixNext(m[2])}` : null;
  }
  const cut = v.search(/[?#]/);
  const p = cut < 0 ? v : v.slice(0, cut);
  const rest = cut < 0 ? '' : v.slice(cut);
  if (!p) { const q = fixNext(rest); return q === rest ? null : q; }
  const target = P.normalize(P.join(P.dirname(enRel), p));
  if (!target.startsWith('en/')) { const q = fixNext(rest); return q === rest ? null : p + q; }   // 英語以外（共有の JS・CSS・画像・日本語ページ）は同じ深さなのでそのまま
  const bare = target.slice(3);
  const out = mine.has(bare) ? p : P.relative(P.dirname(outRel), target);
  const res = out + fixNext(rest);
  return res === v ? null : res;
}

/* head の管理ブロック */
function seoBlock(enHtml, bare, outRel, title, desc) {
  const en = enHtml.match(/<!--PV-SEO-->[\s\S]*?<!--\/PV-SEO-->/)?.[0] || '';
  const meta = (re) => (en.match(re) || [])[1];
  const img = meta(/<meta property="og:image" content="([^"]*)"/) || 'https://pilot-value.com/assets/og/default-en.jpg';
  const type = meta(/<meta property="og:type" content="([^"]*)"/) || 'website';
  const noindexEn = /<meta name="robots" content="noindex/.test(en);
  const indexed = L.indexed.has(bare) && !noindexEn;
  const self = urlOfRel(outRel);
  const alts = indexed ? alternatesFor(bare, (c) => c === 'ja' || c === 'en' || c === code) : [];
  const ogAlts = alts.filter((a) => a.hreflang !== 'x-default' && a.hreflang !== L.hreflang).map((a) => LANGS.find((l) => l.hreflang === a.hreflang).ogLocale);
  return `<!--PV-SEO-->
<!--PV-GEN lang="${code}" from="en/${bare}" — node gen-lang.mjs ${code} が書く。手で直さない-->
<meta name="description" content="${escAttr(desc)}"/>
<meta name="robots" content="${indexed ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' : 'noindex,follow'}"/>
<link rel="canonical" href="${self}"/>
${alts.map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${a.url}"/>\n`).join('')}<meta property="og:title" content="${escAttr(title)}"/>
<meta property="og:description" content="${escAttr(desc)}"/>
<meta property="og:url" content="${self}"/>
<meta property="og:type" content="${type}"/>
<meta property="og:site_name" content="PILOT VALUE"/>
<meta property="og:locale" content="${L.ogLocale}"/>
${ogAlts.map((o) => `<meta property="og:locale:alternate" content="${o}"/>\n`).join('')}<meta property="og:image" content="${img}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:alt" content="${escAttr(title)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escAttr(title)}"/>
<meta name="twitter:description" content="${escAttr(desc)}"/>
<meta name="twitter:image" content="${img}"/>
<!--/PV-SEO-->`;
}

/* pv-session.js の PV_LANG_PAGES（JS がリンクを その言語 → 英語 の順に探すため）。変わったときだけ書く。
   ★ここが変わると pv-session.js の指紋が変わる ＝ node inject-session.mjs → もう一度 node gen-lang.mjs の順に流す */
{
  const f = path.join(ROOT, 'pv-session.js');
  const s = fs.readFileSync(f, 'utf8');
  const want = '/*PV-LANG-PAGES*/window.PV_LANG_PAGES = ' + JSON.stringify(Object.fromEntries(LANGS.filter((l) => !l.hand).map((l) => [l.code, l.pages]))) + ';/*/PV-LANG-PAGES*/';
  const next = s.replace(/\/\*PV-LANG-PAGES\*\/[\s\S]*?\/\*\/PV-LANG-PAGES\*\//, () => want);
  if (next === s && !s.includes(want)) { console.error('pv-session.js に PV-LANG-PAGES の印が無い'); process.exit(1); }
  if (next !== s) { if (!CHECK) fs.writeFileSync(f, next); console.log('pv-session.js の PV_LANG_PAGES を' + (CHECK ? '書き直す（--check なので書かない）' : '書き直した') + ' → node inject-session.mjs → node gen-lang.mjs'); }
}

let wrote = 0;
const report = [];
for (const bare of L.pages) {
  const enRel = relIn(bare, 'en');
  const outRel = relIn(bare, code);
  const enHtml = fs.readFileSync(path.join(ROOT, enRel), 'utf8');

  /* 1) 本文と属性 */
  const { units, attrs } = extract(enHtml);
  let missing = 0; let done = 0;
  const attrTr = (name, en) => tr(en);
  const edits = [];
  for (const u of units) {
    const t = tr(u.key);
    if (!t) { if (needsAI(u.key)) missing++; continue; }
    edits.push({ start: u.start, end: u.end, text: restore(u, t, attrTr) }); done++;
  }
  for (const a of attrs.filter((x) => !x.inUnit)) {
    const t = tr(a.key);
    if (!t) { if (needsAI(a.key)) missing++; continue; }
    edits.push({ start: a.start, end: a.end, text: a.quote === "'" ? escText(t).replace(/'/g, '&#39;') : escAttr(t) }); done++;
  }
  /* ページの中の台本の、画面に出る文字列（英語のページは触らない・ここで差し替えるだけ） */
  for (const j of inlineScriptUnits(enHtml)) {
    const t = TM[j.key] && ['validated', 'manual'].includes(TM[j.key].st) ? TM[j.key].es.slice(4) : null;
    if (!t) { missing++; continue; }
    edits.push({ start: j.start, end: j.end, text: t }); done++;
  }
  /* <title> */
  const head = extractHead(enHtml);
  const tTitle = head.find((h) => h.name === 'title');
  const title = tTitle ? (tr(tTitle.key) ?? tTitle.key) : '';
  if (tTitle) edits.push({ start: tTitle.start, end: tTitle.end, text: escText(title) });
  const dHead = head.find((h) => h.name === 'description');
  const desc = dHead ? (tr(dHead.key) ?? dHead.key) : '';
  let html = splice(enHtml, edits);

  /* 2) 3) <html lang> とリンク */
  const fixes = [];
  for (const a of findAttrs(html, ['href', 'action', 'lang'])) {
    if (a.name === 'lang') { if (a.tag === 'html') fixes.push({ start: a.start, end: a.end, text: L.htmlLang }); continue; }
    const v = fixLink(a.value, enRel, outRel);
    if (v != null) fixes.push({ start: a.start, end: a.end, text: escAttr(v) });
  }
  /* 管理ブロックの中のリンクは 4) で作り直すので触らない */
  const bs = html.indexOf('<!--PV-SEO-->');
  const be = html.indexOf('<!--/PV-SEO-->') + '<!--/PV-SEO-->'.length;
  html = splice(html, fixes.filter((f) => bs < 0 || f.end <= bs || f.start >= be));

  /* 4) 管理ブロック */
  const s2 = html.indexOf('<!--PV-SEO-->');
  const e2 = html.indexOf('<!--/PV-SEO-->') + '<!--/PV-SEO-->'.length;
  if (s2 >= 0) html = html.slice(0, s2) + seoBlock(enHtml, bare, outRel, title, desc) + html.slice(e2);

  const abs = path.join(ROOT, outRel);
  const prev = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  report.push(`  ${outRel.padEnd(28)} 訳した ${String(done).padStart(4)} / 英語のまま ${String(missing).padStart(3)}${prev === html ? '' : prev === null ? '  （新しく作る）' : '  （変わる）'}`);
  if (prev !== html) { wrote++; if (!CHECK) { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, html); } }
}
console.log(`${CHECK ? '[check] ' : ''}${code}: ${L.pages.length} ページ（${wrote} 枚が${CHECK ? '変わる' : '変わった'}）`);
console.log(report.join('\n'));
}
