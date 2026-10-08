/* ════════════════════════════════════════════════════════════════
   link-countries.mjs — 国別ハブへの入口を世界一覧とサイトマップに置く
                        ＋ 会社ページの旧い帯を外す

   いまやること（2つ）
     1) 世界一覧（world-airlines）とサイトマップ（sitemap）の日英4枚に、
        国別ページへの帯（<!--PV-CBAND-->）を貼り直す。
        国別ページを作っても、強い面から1本もリンクが無ければ
        sitemap 頼みのぶら下がりページになるため。
     2) 会社ページ（airlines/ ・ en/airlines/）から旧い帯を2つ**外す**。
          ・「✈ パイロット転職を検討中の方へ …」の橙の帯
          ・その直後の「国別で比べる／同じ国の他社」の箱（<!--PV-CLINK-->）
        ★2026-10-08 オーナー指示で全会社ページから外した。
          以前はこの道具が PV-CLINK を「剥がして入れ直して」いたので、
          流すたびに帯が戻っていた。いまは**外すだけ**で、もう書かない。
          ⚠️ 入れ直す処理を足し戻さない（assert-basis.mjs の J が見張っている）。
          比較記事（SALARY に無い slug）の橙の帯は会社ページではないので触らない。

   何度流しても同じ結果になる（外す物が無ければ1バイトも書かない）。

   実行: node link-countries.mjs
        node link-countries.mjs --dry
════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { SALARY } from './salary-data.mjs';
import { AIRLINE_COUNTRY, BY_CODE } from './airline-countries.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/%20/g, ' ');
const DRY = process.argv.includes('--dry');
const S = SALARY;

const round10 = (v) => Math.round(v / 10) * 10;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* 国ごとの掲載社・機長平均。数値は SSOT から毎回計算する。 */
const byCountry = new Map();
for (const [slug, code] of Object.entries(AIRLINE_COUNTRY)) {
  if (!S[slug]) continue;
  if (!byCountry.has(code)) byCountry.set(code, []);
  byCountry.get(code).push(slug);
}
/* 国の帯の並び順に使う（社数 → この値の順）。画面には出さない。 */
const capAvgOf = (code) => round10(
  byCountry.get(code).reduce((s, k) => s + S[k].cap.avg, 0) / byCountry.get(code).length
);

const hasCountryPage = (slug, lang) =>
  fs.existsSync(path.join(ROOT, lang === 'ja' ? 'countries' : 'en/countries', `${slug}.html`));

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

/* ── 会社ページの旧い帯を外す（2026-10-08）──────────────────────────
   ⚠️ 置き換え側は必ず関数形（文字列で渡すと中の $ が化ける）。
   ⚠️ 「帯から <footer まで」を1本の正規表現で切らない。
      starlux は帯と PV-CLINK のあいだに FAQ の <script> がある。 */
const OLD_CLINK = /<!--PV-CLINK-->[\s\S]*?<!--\/PV-CLINK-->[ \t]*\n?/g;
const OLD_BAND = /<div style="background:rgba\(249,115,22,\.06\)[^>]*>\s*<a href="\.\.\/pilot-tenshoku\.html"[^>]*>[^<]*<\/a>\s*<\/div>[ \t]*\n?/g;

let changed = 0; let skipped = 0;
const files = [
  ...fs.readdirSync(path.join(ROOT, 'airlines')).filter((f) => f.endsWith('.html')).map((f) => `airlines/${f}`),
  ...fs.readdirSync(path.join(ROOT, 'en/airlines')).filter((f) => f.endsWith('.html')).map((f) => `en/airlines/${f}`),
];

for (const rel of files) {
  const abs = path.join(ROOT, rel);
  const slug = path.basename(rel, '.html');
  const html = fs.readFileSync(abs, 'utf8');

  /* 国別の箱はどのページからも外す（比較記事には元から無い）。 */
  let out = html.replace(OLD_CLINK, () => '');
  /* 橙の帯は会社ページだけ。比較記事（SALARY に無い slug）は対象外。 */
  if (S[slug]) out = out.replace(OLD_BAND, () => '');
  else skipped++;

  if (out !== html) { if (!DRY) fs.writeFileSync(abs, out); changed++; }
}

console.log(`${DRY ? '[dry-run] ' : ''}会社ページの旧い帯（転職の帯・国別の箱）を外した: ${changed} / ${files.length} ページ更新（会社ページ以外 ${skipped}）`);
console.log(`${DRY ? '[dry-run] ' : ''}国の帯: ${bandChanged} / ${BANDS.length} ハブ面を更新`);
