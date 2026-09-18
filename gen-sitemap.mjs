/* ════════════════════════════════════════════════════════════════
   gen-sitemap.mjs — sitemap.xml をディスクの実態から作り直す

   手書きの sitemap.xml が抱えていた問題（assert-seo.mjs の実測）
     ・ログイン／登録／個人領域など noindex のページが6件載っていた。
       noindex と sitemap 掲載は矛盾で、Google に「出したいのか出したく
       ないのか」を同時に伝えることになる。
     ・逆に存在するのに載っていないページがあった。
     ・多言語サイトなのに xhtml:link（hreflang）が1件も無く、日英の
       対応が sitemap 側からは伝わらなかった。
     ・lastmod が全部同じ手書きの日付で、更新の実態を表していなかった。

   設計
     ・URL 集合はディスクを走査して決める。手で足し引きしない。
     ・noindex は seo-normalize.mjs と同じ集合を使う（二重管理を避ける）。
     ・lastmod は中身が最後に変わった日。決め方は page-dates.mjs の1か所で、
       JSON-LD の dateModified（gen-datemod.mjs）と必ず同じ日付になる。
       日付を入れただけのコミットは「変わった」に数えない。git が使えないときは mtime。
     ・日英そろっているページには xhtml:link を3本（ja / en / x-default）。

   実行: node gen-sitemap.mjs
════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { SALARY } from './salary-data.mjs';
import { pageDates } from './page-dates.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/%20/g, ' ');
const ORIGIN = 'https://pilot-value.com';

/* seo-normalize.mjs と同じ集合。片方だけ直すと sitemap と robots が食い違う。 */
const NOINDEX = new Set([
  'admin.html', 'auth-callback.html', 'login.html', 'signup.html',
  'profile.html', 'my-value.html', 'pay-report.html', 'personal-data.html',
  'unsubscribe.html', '404.html', 'submit-review.html',
  /* 本人が自分の会社の待遇を答える画面。ログインが要るので検索に出さない。 */
  'airline-conditions.html',
  /* 給与を出した人だけが金額を読める画面。2026-09-16 から、鍵の無い人にも
     一覧そのものは出る（会社・職位・出典・投稿時期の4つだけの伏せた行）が、
     年収と機材はサーバが渡さない。読ませる中身が無いので検索には出さない。 */
  'actual-pay.html',
  /* 給与の中身（集計）まで読める画面。鍵が要るので検索に出さない。 */
  'deep-pay.html',
  /* 2社を横に並べる画面。同じく鍵が要るので検索に出さない。 */
  'deep-pay-compare.html',
  /* ロードマップと要望の画面。ログインした人だけが読み書きする。 */
  'roadmap.html',
  /* 2026-08-15、求人の掲載を停止した。ページは残すが検索には出さない。 */
  'world-jobs.html',
  'invite.html',
]);

const listHtml = (dir) => (fs.existsSync(path.join(ROOT, dir))
  ? fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.html')).sort() : []);

const files = [
  ...listHtml('.'),
  ...listHtml('airlines').map((f) => `airlines/${f}`),
  ...listHtml('countries').map((f) => `countries/${f}`),
  ...listHtml('en').map((f) => `en/${f}`),
  ...listHtml('en/airlines').map((f) => `en/airlines/${f}`),
  ...listHtml('en/countries').map((f) => `en/countries/${f}`),
].filter((rel) => !NOINDEX.has(path.basename(rel))
  || rel.includes('/airlines/') || rel.includes('/countries/'));

const relToUrl = (rel) => (rel === 'index.html' ? `${ORIGIN}/`
  : rel === 'en/index.html' ? `${ORIGIN}/en/` : `${ORIGIN}/${rel}`);

/* ── lastmod ─────────────────────────────────────────────────── */
/* ★2026-09-18 まで、ここは「そのファイルを最後に触ったコミットの日」を自前で数えていた。
   JSON-LD に日付を入れただけのコミットでも「今日」になり、同じページがサイトマップでは
   9月18日・JSON-LD では9月7日と食い違っていた。 */
let dates = new Map();
try { dates = pageDates(ROOT, files); } catch { /* git が無い環境では mtime にフォールバック */ }

/* 分からない日付（履歴の始まりから一度も直していない）は lastmod を書かない。 */
const lastmod = (rel) => (dates.has(rel) ? dates.get(rel).modified
  : fs.statSync(path.join(ROOT, rel)).mtime.toISOString().slice(0, 10));

/* ── 優先度と更新頻度 ────────────────────────────────────────── */
function rank(rel) {
  const b = path.basename(rel);
  if (rel === 'index.html' || rel === 'en/index.html') return ['1.0', 'weekly'];
  if (/countries\//.test(rel)) return ['0.9', 'weekly'];
  if (/airlines\//.test(rel)) return ['0.8', 'weekly'];
  if (['world-airlines.html', 'pilot-salary-guide.html', 'countries.html'].includes(b)) return ['0.95', 'weekly'];
  /* 地域ハブ（gen-countries.mjs が出す {region}-pilot-salary.html）。国ページ0.9と
     同格。下の /^(pilot-|salary)/ に引っかからない綴りなので明示しないと 0.6 に落ちる。 */
  if (/-pilot-salary\.html$/.test(b)) return ['0.9', 'weekly'];
  if (b === 'community.html') return ['0.9', 'daily'];
  if (/^(pilot-|salary)/.test(b)) return ['0.85', 'monthly'];
  if (['terms.html', 'privacy.html', 'policy.html', 'privacy-pilot.html', 'sitemap.html'].includes(b)) return ['0.3', 'yearly'];
  return ['0.6', 'monthly'];
}

/* ── 日英の対応（ファイルが両方あるときだけ hreflang を出す）──── */
const has = new Set(files);
function alternates(rel) {
  const bare = rel.replace(/^en\//, '');
  const enRel = bare === 'index.html' ? 'en/index.html' : `en/${bare}`;
  if (!has.has(bare) || !has.has(enRel)) return null;
  return { ja: relToUrl(bare), en: relToUrl(enRel) };
}

/* ── 出力 ────────────────────────────────────────────────────── */
const rows = files.map((rel) => {
  const [priority, changefreq] = rank(rel);
  const alt = alternates(rel);
  const links = alt ? [
    `    <xhtml:link rel="alternate" hreflang="ja" href="${alt.ja}"/>`,
    `    <xhtml:link rel="alternate" hreflang="en" href="${alt.en}"/>`,
    // x-default は ja / en のどちらにも当てはまらない検索者への既定。英語版を指す
    // （ドイツ語圏・アラビア語圏のパイロットに日本語版を既定として申告していた）。
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${alt.en}"/>`,
  ].join('\n') : '';
  return `  <url>
    <loc>${relToUrl(rel)}</loc>
${lastmod(rel) ? `    <lastmod>${lastmod(rel)}</lastmod>\n` : ''}    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${links ? '\n' + links : ''}
  </url>`;
});

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- 自動生成: node gen-sitemap.mjs — 手で編集しない -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${rows.join('\n')}
</urlset>
`;

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);

const byKind = (re) => files.filter((f) => re.test(f)).length;
console.log(`sitemap.xml を再生成: ${files.length} URL`);
console.log(`  航空会社 ${byKind(/airlines\//)} / 国別 ${byKind(/countries\//)} / その他 ${files.length - byKind(/(airlines|countries)\//)}`);
console.log(`  hreflang 付き ${files.filter((f) => alternates(f)).length} URL`);
console.log(`  noindex ${NOINDEX.size} 種類を除外`);
console.log(`\n注: 航空会社数の正は salary-data.mjs（${Object.keys(SALARY).length}社）`);
