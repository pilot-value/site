/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — langs.mjs（2026-11-01・多言語化の段0）
   サイトの言語の一覧。**言語を足すときは、まずここに1行足す。**

   ここを読むもの
     seo-normalize.mjs … 各ページの hreflang・og:locale・canonical
     gen-sitemap.mjs   … sitemap.xml のページの一覧と hreflang
     assert-seo.mjs    … 上の2つの出力を確かめる

   約束
     ・フォルダ（dir）が言語を決める。'' が日本語、'en/' が英語。
     ・hand: true ＝ 本文を人が書いている言語（日英）。seo-normalize.mjs が head を作る。
       3つ目からの言語は英語のページから機械で作る（手で書かない）── 段1で足す。
     ・x-default は英語（xDefault: true）。日本語だけのページは日本語を指す。
     ・ページ一覧の並びは「言語の順 × ('' → airlines/ → countries/)」。
       並びを変えると sitemap.xml の行の順が全部動く。
   ════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';

export const ORIGIN = 'https://pilot-value.com';

export const LANGS = [
  { code: 'ja', dir: '',    hreflang: 'ja', htmlLang: 'ja', ogLocale: 'ja_JP', hand: true },
  { code: 'en', dir: 'en/', hreflang: 'en', htmlLang: 'en', ogLocale: 'en_US', hand: true, xDefault: true },
];

/* どの言語にも同じ形で在るフォルダ（言語のフォルダの下） */
export const SUBDIRS = ['', 'airlines/', 'countries/'];

export const LANG = Object.fromEntries(LANGS.map((l) => [l.code, l]));

/* ルートからの相対パス → その言語。いちばん長いフォルダが勝つ（'es-es/' と 'es/' を取り違えない）。 */
export function langOfRel(rel) {
  let best = LANGS.find((l) => l.dir === '');
  for (const l of LANGS) if (l.dir && rel.startsWith(l.dir) && l.dir.length > best.dir.length) best = l;
  return best;
}

/* 言語のフォルダを外した形（日英で同じページは同じ形になる） */
export const bareOf = (rel) => rel.slice(langOfRel(rel).dir.length);

/* 同じページの、別の言語での相対パス */
export const relIn = (bare, code) => LANG[code].dir + bare;

/* 相対パス → 公開の URL。言語のトップ（index.html）だけフォルダの形にする。 */
export function urlOfRel(rel) {
  const l = langOfRel(rel);
  if (rel === `${l.dir}index.html`) return `${ORIGIN}/${l.dir}`;
  return `${ORIGIN}/${rel}`;
}

/* サイトの HTML を全部（言語の順 × SUBDIRS の順・各フォルダの中は名前の順）。
   langs を渡すとその言語だけ。 */
export function listSiteHtml(root, langs = LANGS) {
  const out = [];
  for (const l of langs) {
    for (const sub of SUBDIRS) {
      const rel = l.dir + sub;
      const dir = path.join(root, rel || '.');
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort()) out.push(rel + f);
    }
  }
  return out;
}

/* 同じページの言語ごとの URL（hreflang に書く分）。
   has(code) が true の言語だけ並べ、最後に x-default を付ける。
   x-default は xDefault の言語が在ればそれ・無ければ最初の言語（日本語）。
   返す形：[{ hreflang, url }, …]（言語の順 → x-default） */
export function alternatesFor(bare, has) {
  const present = LANGS.filter((l) => has(l.code));
  const out = present.map((l) => ({ hreflang: l.hreflang, url: urlOfRel(relIn(bare, l.code)) }));
  const def = present.find((l) => l.xDefault) || present[0];
  if (def) out.push({ hreflang: 'x-default', url: urlOfRel(relIn(bare, def.code)) });
  return out;
}
