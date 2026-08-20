/* ══════════════════════════════════════════════════════════════
   fix-internal-links.mjs — assert-links.mjs が見つけた「繋がりの穴」を塞ぐ

   assert-links.mjs（構造の検査）が出した指摘の実体は3つだった。
   どれも1枚ずつ見ていると出てこない型なので、まとめてここで直す。

   ── 1) 英語ページが日本語記事へリンクしていた（15箇所 / 5ページ）
      en/index.html が比較記事へ張るリンクが ../airlines/ana-vs-emirates.html
      になっていた。en/airlines/ana-vs-emirates.html は存在するのに、である。
      結果:
        ・英語版の比較記事6本がどこからもリンクされない＝孤立
        ・英語で来た読者が日本語のページに飛ばされる
        ・言語を跨いだ内部リンクが hreflang の signal を薄める
      英語版が存在するときは英語版へ向ける。存在しない場合は触らない
      （日本語しか無い記事へのリンクは、それが唯一の行き先なので正しい）。

   ── 2) sitemap.html に 5社が載っていなかった（日英とも）
      airx-charter / eagle-jet / root-aviation / solairus / virgin-atlantic。
      会社ページ110枚のうち静的リンクを一番配っているのが sitemap.html
      （105本）で、world-airlines.html は一覧を JS で描くため静的リンクを
      1本も持たない。つまり sitemap.html から漏れると、その会社は静的に
      は事実上どこからも辿れない。実際 eagle-jet と root-aviation は
      被リンク0の孤立ページになっていた。
      SSOT（SALARY）を正として、載っていない会社を region に対応する
      セクションへ入れる。

   ── 3) en/airlines/starlux.html から英語版の転職ガイドへの導線が無い
      日本語版には「スターラックス転職・採用試験ガイドを読む →」の
      カードがあるが、英語版は外部の公式採用ページへのボタンだけで、
      自前の en/airlines/starlux-tenshoku.html へ繋がっていない。
      日本語版と同じ位置に同じ役割のカードを置く。

   すべて管理ブロック／存在チェック方式で、何度実行しても同じ結果になる。

   実行: node fix-internal-links.mjs
        node fix-internal-links.mjs --dry
   ══════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SALARY } from './salary-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry');
const read = (r) => fs.readFileSync(path.join(__dirname, r), 'utf8');
const write = (r, s) => { if (!DRY) fs.writeFileSync(path.join(__dirname, r), s); };
const exists = (r) => fs.existsSync(path.join(__dirname, r));

const dirs = ['.', 'airlines', 'countries', 'en', 'en/airlines', 'en/countries'];
const files = dirs.flatMap((d) => {
  const abs = path.join(__dirname, d);
  return fs.existsSync(abs)
    ? fs.readdirSync(abs).filter((f) => f.endsWith('.html')).map((f) => (d === '.' ? f : `${d}/${f}`))
    : [];
});

/* ══ 1) 英語ページ → 英語版へ向け直す ══════════════════════════ */
let xPages = 0, xLinks = 0;
const xDetail = [];
for (const rel of files.filter((f) => f.startsWith('en/'))) {
  const html = read(rel);
  let n = 0;
  const out = html.replace(/(<a\b[^>]*\shref=")([^"#?]+)([^"]*")/gi, (whole, pre, href, post) => {
    if (/^(https?:|mailto:|tel:|javascript:|data:|#)/i.test(href)) return whole;
    /* リンク先をリポジトリ相対に解決する */
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), href));
    if (!target.endsWith('.html') || target.startsWith('en/')) return whole;
    const sibling = `en/${target}`;
    if (!exists(sibling)) return whole;   /* 英語版が無いなら日本語のままが正しい */
    /* 自分の場所から見た英語版への相対パスに書き換える */
    const nu = path.posix.relative(path.posix.dirname(rel), sibling);
    n++;
    xDetail.push(`${rel}: ${href} → ${nu}`);
    return pre + nu + post;
  });
  if (!n) continue;
  xPages++; xLinks += n;
  write(rel, out);
}

/* ══ 2) sitemap.html に漏れている会社を足す ═══════════════════ */
/* SSOT の region → sitemap.html のセクション見出し */
const SECTION = {
  japan: ['日本の航空会社', 'Japanese Airlines'],
  us: ['北米の航空会社', 'North American Airlines'],
  mideast: ['中東の航空会社', 'Middle Eastern Airlines'],
  europe: ['欧州の航空会社', 'European Airlines'],
  asia: ['アジアの航空会社', 'Asian Airlines'],
  oceania: ['オセアニア・中南米・アフリカ', 'Oceania, Latin America &amp; Africa'],
  latam: ['オセアニア・中南米・アフリカ', 'Oceania, Latin America &amp; Africa'],
  africa: ['オセアニア・中南米・アフリカ', 'Oceania, Latin America &amp; Africa'],
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let smAdded = 0;
const smDetail = [];
for (const [smRel, li] of [['sitemap.html', 0], ['en/sitemap.html', 1]]) {
  if (!exists(smRel)) continue;
  let html = read(smRel);
  const prefix = li === 0 ? 'airlines/' : 'airlines/';
  const missing = Object.keys(SALARY).filter((k) => !html.includes(`"${prefix}${k}.html"`));
  if (!missing.length) continue;

  for (const slug of missing) {
    const a = SALARY[slug];
    const title = SECTION[a.region] ? SECTION[a.region][li] : SECTION.asia[li];
    const label = esc(li === 0 ? a.ja : a.en);
    const tag = `<a href="${prefix}${slug}.html" class="sm-link">${label}</a>`;

    /* セクションは
         <div class="sm-section">
           <div class="sm-title">見出し</div>
           <a … class="sm-link">…</a> × n
         </div>
       の並び。そのセクション内の最後の sm-link の直後に差し込む。 */
    const secStart = html.indexOf(`<div class="sm-title">${title}</div>`);
    if (secStart === -1) { smDetail.push(`⚠ ${smRel}: セクション「${title}」が見つからない（${slug} 未追加）`); continue; }

    /* ★ セクションの終わりを「次の sm-section」だけで決めると、最後の
       セクション（オセアニア…）のときに bound がファイル末尾になり、
       フッターのリンクの後ろに差し込んでしまう。フッター／main の閉じも
       境界に入れる。 */
    const bounds = [
      html.indexOf('<div class="sm-section"', secStart + 1),
      html.indexOf('<footer', secStart + 1),
      html.indexOf('</main>', secStart + 1),
    ].filter((i) => i !== -1);
    const bound = bounds.length ? Math.min(...bounds) : html.length;

    const lastLink = html.lastIndexOf('class="sm-link">', bound);
    const at = lastLink === -1 ? -1 : html.indexOf('</a>', lastLink);
    if (lastLink < secStart || at === -1 || at > bound) {
      smDetail.push(`⚠ ${smRel}: ${slug} の差し込み位置が決まらない`); continue;
    }
    html = html.slice(0, at + 4) + `\n        ${tag}` + html.slice(at + 4);
    smAdded++;
    smDetail.push(`${smRel}: +${slug}（${title}）`);
  }
  write(smRel, html);
}

/* ══ 3) EN starlux → EN 転職ガイドへの導線 ════════════════════ */
/* 日本語版と同じ役割・同じ位置。管理ブロックで囲って冪等にする。 */
const SX = 'en/airlines/starlux.html';
const SX_MARK = '<!--PV-XLINK-starlux-tenshoku-->';
let sxDone = 'なし';
if (exists(SX) && exists('en/airlines/starlux-tenshoku.html')) {
  let html = read(SX);
  const had = html.includes(SX_MARK);
  html = html.replace(new RegExp(`${SX_MARK}[\\s\\S]*?<!--/PV-XLINK-starlux-tenshoku-->\\n?`, 'g'), '');
  if (html.includes('starlux-tenshoku.html')) {
    sxDone = 'すでにリンクあり（挿入せず）';
  } else {
    /* ★ style は日本語版のカードの丸写し。色も余白も発明しない。
       ・箱は青系グラデーション（rgba(44,93,229,…)）、ラベルは #5b8dee。
         オレンジなのはボタンだけ。ここを勝手に配色すると、同じ役割の
         カードが言語で違う見た目になる。
       ・margin を持たせない。親が space-y-10 なので、自前で margin を
         足すと日本語版より1段空いてしまう。 */
    const card = `${SX_MARK}
<div class="fade-up" style="background:linear-gradient(135deg,rgba(44,93,229,.12),rgba(44,93,229,.05));border:1px solid rgba(44,93,229,.25);border-radius:16px;padding:28px 32px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px">
  <div>
    <div style="font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#5b8dee;margin-bottom:6px">STARLUX Career Guide</div>
    <h3 style="font-size:1.15rem;font-weight:800;margin:0 0 6px;color:#e8edf2">The Complete 6-Day Selection Guide — A First-Hand Account</h3>
    <p style="font-size:.85rem;color:#8899aa;margin:0">Every stage of the STARLUX hiring process in detail: application documents, SIM check, interview, medical, residence visa and joining paperwork.</p>
  </div>
  <a href="starlux-tenshoku.html" style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;border-radius:10px;background:linear-gradient(135deg,#f97316,#f5c842);color:#000;font-size:.88rem;font-weight:700;text-decoration:none;white-space:nowrap;flex-shrink:0">Read the STARLUX selection guide →</a>
</div>
<!--/PV-XLINK-starlux-tenshoku-->
`;
    /* 外部の公式採用ページCTAの直後、次の glass ブロックの手前に置く
       ＝日本語版でカードが入っているのと同じ位置。 */
    const anchor = html.indexOf('starlux-airlines.com/en-TW/about/career');
    const at = anchor === -1 ? -1 : html.indexOf('<div class="glass p-8 fade-up">', anchor);
    if (at === -1) { sxDone = '⚠ 差し込み位置が見つからない'; }
    else {
      html = html.slice(0, at) + card + html.slice(at);
      sxDone = had ? 'カードを再生成（既存を剥がして入れ直し／増殖はしない）' : 'カードを挿入';
    }
  }
  write(SX, html);
}

/* ══ 出力 ═════════════════════════════════════════════════════ */
console.log(`${DRY ? '[dry] ' : ''}══ 内部リンクの穴を塞ぐ ══\n`);
console.log(`1) 英語ページ→英語版へ向け直し: ${xLinks}箇所 / ${xPages}ページ`);
xDetail.slice(0, 20).forEach((d) => console.log('   ' + d));
console.log(`\n2) sitemap.html への追加: ${smAdded}件`);
smDetail.forEach((d) => console.log('   ' + d));
console.log(`\n3) EN starlux → EN 転職ガイド: ${sxDone}`);
console.log('\n次: node assert-links.mjs で構造を検査し直す');
