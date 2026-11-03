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
     ・3つ目からの言語（hand が無い）は gen-lang.mjs が英語のページから作る。
       pages ＝ 作るページ（ここに無いページへのリンクは英語版へ向ける）。
       indexed ＝ 検索に出すページ（AI の4段＋機械検査を全部通ったもの・段4で足していく）。
       ここに無いページは noindex で、サイトマップにも hreflang にも出さない。
     ・ページ一覧の並びは「言語の順 × ('' → airlines/ → countries/)」。
       並びを変えると sitemap.xml の行の順が全部動く。
   ════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';

export const ORIGIN = 'https://pilot-value.com';

export const LANGS = [
  { code: 'ja', dir: '',    hreflang: 'ja', htmlLang: 'ja', ogLocale: 'ja_JP', hand: true },
  { code: 'en', dir: 'en/', hreflang: 'en', htmlLang: 'en', ogLocale: 'en_US', hand: true, xDefault: true },
  /* スペイン語（中南米）。スペイン版は後から 'es-es/'（hreflang es-ES・base: 'es'）で足す（2026-11-01 オーナー決定）。 */
  { code: 'es', dir: 'es/', hreflang: 'es', htmlLang: 'es-419', ogLocale: 'es_LA', base: 'en',
    pages: ['pay-report.html', 'signup.html', 'login.html', 'profile.html', 'actual-pay.html', 'my-value.html',
      'terms.html', 'privacy.html', 'personal-data.html', 'contact.html',
      /* 段3（2026-11-02）：入口と中身。スペイン語圏の6社・5か国 */
      'index.html', 'world-airlines.html', 'pilot-salary-guide.html', 'countries.html', 'submit-review.html', 'airline-conditions.html',
      /* 2026-11-02 オーナー「2社比較と Vote もやらないと意味ない」：会社の概要と2社比較・口コミ一覧 */
      'career.html', 'community.html',
      /* 2026-11-02 本番で足された米国の貨物5社 */
      'airlines/abx-air.html', 'airlines/atlas-air.html', 'airlines/fedex-express.html', 'airlines/kalitta-air.html', 'airlines/ups-airlines.html',
      /* ★2026-11-03 北米追加20社の5社（会社ページは全部スペイン語にもする） */
      'airlines/avelo-airlines.html', 'airlines/gojet.html', 'airlines/northern-air-cargo.html', 'airlines/contour.html', 'airlines/jazz.html',
      'airlines/iberia.html', 'airlines/vueling.html', 'airlines/aeromexico.html', 'airlines/avianca.html', 'airlines/copa-airlines.html', 'airlines/latam.html',
      'countries/spain.html', 'countries/mexico.html', 'countries/colombia.html', 'countries/chile.html', 'countries/panama.html',
      /* 2026-11-02 オーナー「会社ページはやりたい」：残りの会社ページ（比較のページ・国のページは後回し）。
         スピリットは入れない（2026-10-11 にサイトから外すと決めた会社・古い鍵の部品を使う唯一のページ） */
      'airlines/aegean.html', 'airlines/aer-lingus.html', 'airlines/air-canada.html', 'airlines/air-china.html', 'airlines/air-france.html',
      'airlines/air-india.html', 'airlines/air-new-zealand.html', 'airlines/air-peace.html', 'airlines/airasia.html', 'airlines/airdo.html',
      'airlines/airjapan.html', 'airlines/airx-charter.html', 'airlines/alaska-airlines.html', 'airlines/allegiant.html',
      'airlines/american.html', 'airlines/amx.html', 'airlines/ana-wings.html', 'airlines/ana.html', 'airlines/asiana.html',
      'airlines/austrian.html', 'airlines/bamboo-airways.html', 'airlines/batik-air.html', 'airlines/breeze-airways.html',
      'airlines/british-airways.html', 'airlines/cathay-pacific.html', 'airlines/china-airlines.html', 'airlines/china-eastern.html',
      'airlines/china-southern.html', 'airlines/daiichi-air.html', 'airlines/delta.html', 'airlines/eagle-jet.html', 'airlines/easyjet.html',
      'airlines/egyptair.html', 'airlines/emirates.html', 'airlines/ethiopian-airlines.html', 'airlines/etihad.html', 'airlines/eurowings.html',
      'airlines/eva-air.html', 'airlines/fda.html', 'airlines/fiji-airways.html', 'airlines/finnair.html', 'airlines/flydubai.html',
      'airlines/frontier.html', 'airlines/garuda-indonesia.html', 'airlines/gulf-air.html', 'airlines/hac.html', 'airlines/hainan-airlines.html',
      'airlines/hong-kong-express.html', 'airlines/ibex.html', 'airlines/icelandair.html', 'airlines/indigo.html', 'airlines/ita-airways.html',
      'airlines/j-air.html', 'airlines/jac.html', 'airlines/jal.html', 'airlines/jetblue.html', 'airlines/jetstar-japan.html',
      'airlines/jetstar.html', 'airlines/jta.html', 'airlines/juneyao-airlines.html', 'airlines/kenya-airways.html', 'airlines/klm.html',
      'airlines/korean-air.html', 'airlines/kuwait-airways.html', 'airlines/lot.html', 'airlines/lufthansa.html',
      'airlines/malaysia-airlines.html', 'airlines/norwegian.html', 'airlines/oman-air.html', 'airlines/orc.html', 'airlines/peach.html',
      'airlines/philippine-airlines.html', 'airlines/porter.html', 'airlines/qantas.html', 'airlines/qatar-airways.html', 'airlines/rac.html',
      'airlines/riyadh-air.html', 'airlines/root-aviation.html', 'airlines/royal-brunei.html', 'airlines/royal-jordanian.html',
      'airlines/ryanair.html', 'airlines/sas.html', 'airlines/saudia.html', 'airlines/scoot.html', 'airlines/shin-central.html',
      'airlines/shin-nihon.html', 'airlines/singapore-airlines.html', 'airlines/skymark.html', 'airlines/solairus.html',
      'airlines/solaseed.html', 'airlines/south-african-airways.html', 'airlines/southwest.html',
      'airlines/spring-japan.html', 'airlines/starflyer.html', 'airlines/starlux.html', 'airlines/swiss.html', 'airlines/tap.html',
      'airlines/thai-airways.html', 'airlines/toho-air.html', 'airlines/toki-air.html', 'airlines/turkish-airlines.html', 'airlines/united.html',
      'airlines/vietjet.html', 'airlines/vietnam-airlines.html', 'airlines/virgin-atlantic.html', 'airlines/westjet.html',
      'airlines/wizz-air.html', 'airlines/zipair.html'],
    /* ★2026-11-03 オーナー「通ったら push・SEO も上位3位に入るように徹底的に」→ 作った全ページを検索に出す
       （4段の訳＋機械検査＋ページ通読を全部通した）。noindex のページ（フォーム・2社比較など）は今までどおり各道具の NOINDEX が決める。 */
    indexed: 'all' },
];
/* indexed: 'all' は pages と同じ集合 */
for (const l of LANGS) if (l.indexed === 'all') l.indexed = new Set(l.pages);

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

/* 検索に出すページか（日英は全部・機械で作る言語は indexed に入れたものだけ）。noindex の判定は別（各道具の NOINDEX）。 */
export function isPublished(rel) {
  const l = langOfRel(rel);
  return l.hand || !!l.indexed?.has(rel.slice(l.dir.length));
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
