/* ════════════════════════════════════════════════════════════════
   link-countries.mjs — 航空会社ページ232枚から国別ハブへ内部リンクを張る

   なぜ
     国別ページを作っても、既存ページから1本もリンクが無ければ
     sitemap 頼みのぶら下がりページになる。会社ページは既にサイト内で
     一番リンクを集めている面なので、そこから国ハブへ渡すのが一番早い。
     同時に「同じ国の他社」を出すことで、会社ページ同士も横に繋がる。

   どう入れるか
     ページごとに CSS がバラバラ（共通CSSが無いリポジトリ）なので、
     ブロック内はインラインスタイルで完結させ、ライトテーマ分だけ
     ブロック内の <style> で持つ。ページ側の規則に依存しない。

     <!--PV-CLINK--> … <!--/PV-CLINK--> の管理ブロックで囲み、
     毎回「剥がして入れ直す」。何度実行しても同じ結果になる。

   実行: node link-countries.mjs
        node link-countries.mjs --dry
════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { SALARY } from './salary-data.mjs';
import { AIRLINE_COUNTRY, BY_CODE, nameIn } from './airline-countries.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/%20/g, ' ');
const DRY = process.argv.includes('--dry');
const S = SALARY;

const man = (v) => `¥${Math.round(v).toLocaleString('en-US')}万`;
const round10 = (v) => Math.round(v / 10) * 10;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* 国ごとの掲載社・機長平均。数値は SSOT から毎回計算する。 */
const byCountry = new Map();
for (const [slug, code] of Object.entries(AIRLINE_COUNTRY)) {
  if (!S[slug]) continue;
  if (!byCountry.has(code)) byCountry.set(code, []);
  byCountry.get(code).push(slug);
}
for (const [code, list] of byCountry) list.sort((a, b) => S[b].cap.avg - S[a].cap.avg);
const capAvgOf = (code) => round10(
  byCountry.get(code).reduce((s, k) => s + S[k].cap.avg, 0) / byCountry.get(code).length
);

const hasCountryPage = (slug, lang) =>
  fs.existsSync(path.join(ROOT, lang === 'ja' ? 'countries' : 'en/countries', `${slug}.html`));

function block(slug, lang) {
  const code = AIRLINE_COUNTRY[slug];
  if (!code) return null;
  const c = BY_CODE[code];
  if (!c || !hasCountryPage(c.slug, lang)) return null;

  const ja = lang === 'ja';
  /* 英語は文中に置く形（冠詞つき）。"Pilot salary in United States" は英語として壊れている。 */
  const name = ja ? c.ja : nameIn(c);
  const peers = byCountry.get(code).filter((k) => k !== slug).slice(0, 5);
  const n = byCountry.get(code).length;
  const href = `../countries/${c.slug}.html`;

  const pill = (h, t, sub) => `<a href="${h}" class="pvcl-pill"><span>${esc(t)}</span>${sub ? `<em>${esc(sub)}</em>` : ''}</a>`;

  return `<!--PV-CLINK-->
<style>
.pvcl{max-width:1152px;margin:0 auto 44px;padding:22px 24px;border-radius:16px;background:rgba(17,22,32,.66);border:1px solid rgba(255,255,255,.08);box-shadow:0 10px 30px -18px rgba(0,0,0,.9),0 2px 8px -4px rgba(61,155,255,.14)}
.pvcl-label{font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:#6b7d93;margin:0 0 12px}
.pvcl-head{display:flex;align-items:center;gap:14px;text-decoration:none;color:inherit;padding:12px 14px;margin:0 -6px 14px;border-radius:12px;transition:background .22s,transform .22s cubic-bezier(.16,1,.3,1)}
.pvcl-head:hover{background:rgba(255,255,255,.05);transform:translateX(2px)}
.pvcl-head:active{transform:translateX(0)}
.pvcl-flag{font-size:2rem;line-height:1;flex-shrink:0}
.pvcl-t{font-weight:800;font-size:1rem;color:#e8edf2;line-height:1.4}
.pvcl-s{font-size:.78rem;color:#8899aa;font-variant-numeric:tabular-nums;margin-top:2px}
.pvcl-arrow{margin-left:auto;color:#f5c842;font-weight:900;flex-shrink:0}
.pvcl-pills{display:flex;flex-wrap:wrap;gap:8px}
.pvcl-pill{display:inline-flex;align-items:baseline;gap:7px;padding:7px 13px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#c9d4de;font-size:.8rem;font-weight:600;text-decoration:none;transition:background .2s,border-color .2s,color .2s}
.pvcl-pill em{font-style:normal;font-size:.74rem;color:#8899aa;font-variant-numeric:tabular-nums}
.pvcl-pill:hover{background:rgba(245,200,66,.1);border-color:rgba(245,200,66,.32);color:#f5c842}
.pvcl-pill:focus-visible,.pvcl-head:focus-visible{outline:2px solid #f5c842;outline-offset:2px}
[data-theme="light"] .pvcl{background:#fff;border-color:rgba(0,0,0,.09);box-shadow:0 10px 28px -20px rgba(15,23,42,.4),0 2px 6px -3px rgba(61,155,255,.12)}
[data-theme="light"] .pvcl-label,[data-theme="light"] .pvcl-s{color:#64748b}
[data-theme="light"] .pvcl-t{color:#0f172a}
[data-theme="light"] .pvcl-head:hover{background:rgba(0,0,0,.035)}
[data-theme="light"] .pvcl-pill{background:rgba(0,0,0,.04);border-color:rgba(0,0,0,.09);color:#334155}
[data-theme="light"] .pvcl-pill em{color:#64748b}
[data-theme="light"] .pvcl-pill:hover{background:rgba(245,200,66,.16);border-color:rgba(180,140,0,.35);color:#8a6a00}
[data-theme="light"] .pvcl-arrow{color:#a37b00}
</style>
<section class="pvcl">
  <p class="pvcl-label">${ja ? '国別で比べる' : 'Compare by country'}</p>
  <a class="pvcl-head" href="${href}">
    <span class="pvcl-flag" aria-hidden="true">${c.flag}</span>
    <span>
      <span class="pvcl-t">${esc(ja ? `${name}のパイロット年収` : `Pilot salary in ${name}`)}</span>
      <span class="pvcl-s">${ja
    ? `掲載${n}社・機長平均 ${man(capAvgOf(code))}`
    : `${n} airline${n > 1 ? 's' : ''} · captain avg ${man(capAvgOf(code))}`}</span>
    </span>
    <span class="pvcl-arrow" aria-hidden="true">→</span>
  </a>
  <div class="pvcl-pills">
${peers.length ? peers.map((k) => `    ${pill(`${k}.html`, ja ? S[k].ja : S[k].en, man(S[k].cap.avg))}`).join('\n') + '\n' : ''}    ${pill('../countries.html', ja ? '国別のパイロット年収 一覧' : 'All countries')}
  </div>
</section>
<!--/PV-CLINK-->
`;
}

/* ── ハブ面（world-airlines / sitemap）に置く国の帯 ────────────────
   国ページを作っても、既存の強い面から1本もリンクが無ければ
   sitemap 頼みのぶら下がりになる。世界一覧とサイトマップは
   サイト内で最もリンクを集めている2枚なので、ここから流す。 */
function band(lang, howMany) {
  const ja = lang === 'ja';
  const list = [...byCountry.keys()]
    .filter((code) => BY_CODE[code] && hasCountryPage(BY_CODE[code].slug, lang))
    .sort((a, b) => (byCountry.get(b).length - byCountry.get(a).length) || (capAvgOf(b) - capAvgOf(a)));
  const pick = howMany ? list.slice(0, howMany) : list;
  const dir = ja ? 'countries' : 'countries';

  return `<!--PV-CBAND-->
<style>
.pvcb{max-width:1280px;margin:0 auto 24px;padding:16px 20px;border-radius:14px;background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)}
.pvcb-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 11px}
.pvcb-h b{font-size:.82rem;font-weight:800;color:#e8edf2}
.pvcb-h span{font-size:.74rem;color:#6b7d93}
.pvcb-h a{margin-left:auto;font-size:.76rem;font-weight:700;color:#f5c842;text-decoration:none}
.pvcb-h a:hover{text-decoration:underline}
.pvcb-list{display:flex;flex-wrap:wrap;gap:7px}
.pvcb-list a{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);color:#c9d4de;font-size:.78rem;font-weight:600;text-decoration:none;transition:background .2s,border-color .2s,color .2s}
.pvcb-list a:hover{background:rgba(245,200,66,.1);border-color:rgba(245,200,66,.3);color:#f5c842}
.pvcb-list a:focus-visible,.pvcb-h a:focus-visible{outline:2px solid #f5c842;outline-offset:2px}
.pvcb-list i{font-style:normal;font-size:.72rem;color:#7d8b99;font-variant-numeric:tabular-nums}
[data-theme="light"] .pvcb{background:#fff;border-color:rgba(0,0,0,.08)}
[data-theme="light"] .pvcb-h b{color:#0f172a}
[data-theme="light"] .pvcb-h span,[data-theme="light"] .pvcb-list i{color:#64748b}
[data-theme="light"] .pvcb-h a{color:#a37b00}
[data-theme="light"] .pvcb-list a{background:rgba(0,0,0,.04);border-color:rgba(0,0,0,.09);color:#334155}
[data-theme="light"] .pvcb-list a:hover{background:rgba(245,200,66,.16);border-color:rgba(180,140,0,.35);color:#8a6a00}
</style>
<section class="pvcb">
  <p class="pvcb-h"><b>${ja ? '国別のパイロット年収' : 'Pilot salary by country'}</b><span>${ja
    ? `掲載${list.length}カ国`
    : `${list.length} countries`}</span><a href="countries.html">${ja ? 'すべての国 →' : 'All countries →'}</a></p>
  <div class="pvcb-list">
${pick.map((code) => {
    const c = BY_CODE[code]; const n = byCountry.get(code).length;
    return `    <a href="${dir}/${c.slug}.html">${c.flag} ${esc(ja ? c.ja : c.en)}<i>${ja ? `${n}社` : n}</i></a>`;
  }).join('\n')}
  </div>
</section>
<!--/PV-CBAND-->
`;
}

/* 帯の差し込み先。アンカーの直後に入れる。 */
const BANDS = [
  { rel: 'world-airlines.html', lang: 'ja', after: /<!-- ── WORLD MAP[^\n]*\n/, n: 14 },
  { rel: 'en/world-airlines.html', lang: 'en', after: /<!-- ── WORLD MAP[^\n]*\n/, n: 14 },
  /* sitemap は <body> 直後に入れると position:fixed のナビの下に潜って
     ロゴと重なる（実測）。見出しの導入文の直後＝本文の先頭に置く。 */
  { rel: 'sitemap.html', lang: 'ja', after: /<p style="color:#6b7d93;margin-bottom:48px">[^<]*<\/p>\n?/, n: 0 },
  { rel: 'en/sitemap.html', lang: 'en', after: /<p style="color:#6b7d93;margin-bottom:48px">[^<]*<\/p>\n?/, n: 0 },
];

let bandChanged = 0;
for (const { rel, lang, after, n } of BANDS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { console.warn(`  ! 無い: ${rel}`); continue; }
  const html = fs.readFileSync(abs, 'utf8');
  const stripped = html.replace(/<!--PV-CBAND-->[\s\S]*?<!--\/PV-CBAND-->[ \t]*\n?/g, '');
  const m = stripped.match(after);
  if (!m) { console.warn(`  ! アンカーが無い: ${rel}`); continue; }
  const at = m.index + m[0].length;
  const out = stripped.slice(0, at) + band(lang, n) + stripped.slice(at);
  if (out !== html) { if (!DRY) fs.writeFileSync(abs, out); bandChanged++; }
}

let changed = 0; let skipped = 0;
const files = [
  ...fs.readdirSync(path.join(ROOT, 'airlines')).filter((f) => f.endsWith('.html')).map((f) => ({ rel: `airlines/${f}`, lang: 'ja' })),
  ...fs.readdirSync(path.join(ROOT, 'en/airlines')).filter((f) => f.endsWith('.html')).map((f) => ({ rel: `en/airlines/${f}`, lang: 'en' })),
];

for (const { rel, lang } of files) {
  const abs = path.join(ROOT, rel);
  const slug = path.basename(rel, '.html');
  let html = fs.readFileSync(abs, 'utf8');

  /* まず剥がす。国が変わったときも、リンク先が消えたときも同じ扱いで直る。 */
  const stripped = html.replace(/<!--PV-CLINK-->[\s\S]*?<!--\/PV-CLINK-->[ \t]*\n?/g, '');

  const b = block(slug, lang);
  if (!b) {
    /* 比較記事など SSOT に無いページ。剥がしたまま残す。 */
    skipped++;
    if (stripped !== html && !DRY) { fs.writeFileSync(abs, stripped); changed++; }
    continue;
  }

  const at = stripped.search(/<footer\b/i);
  if (at === -1) { console.warn(`  ! <footer> が無い: ${rel}`); skipped++; continue; }

  const out = stripped.slice(0, at) + b + stripped.slice(at);
  if (out !== html) { if (!DRY) fs.writeFileSync(abs, out); changed++; }
}

console.log(`${DRY ? '[dry-run] ' : ''}国別リンクを挿入: ${changed} / ${files.length} ページ更新（対象外 ${skipped}）`);
console.log(`${DRY ? '[dry-run] ' : ''}国の帯: ${bandChanged} / ${BANDS.length} ハブ面を更新`);
