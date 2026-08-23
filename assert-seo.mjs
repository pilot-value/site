/* ════════════════════════════════════════════════════════════════
   assert-seo.mjs — サイト全体の SEO 不変条件テスト（静的・読み取り専用）

   localhost 不要。HTML を直接パースするので速い（全232ページで数百ms）。

   検査項目
     1) <html lang> が ja / en と一致（ディレクトリと矛盾しないこと）
     2) <title> が存在・1個だけ・長すぎない・サイト内で重複しない
     3) meta description が存在・1個だけ・長さが妥当・重複しない
     4) canonical が存在し、自分自身の実 URL と一致する
        （ここがズレると Google はそのページを別 URL の複製とみなして落とす）
     5) hreflang ja / en / x-default が3つ揃い、URL が実在ファイルを指す
        ＋ 相互参照（JP が指す EN 側も同じ組を返すこと）
     6) og:url が canonical と一致（EN トップが JP トップを指す事故の再発防止）
     7) og:title / og:description / og:type / twitter:card の有無
     8) JSON-LD が JSON として壊れていない・@context を持つ
     9) 公開すべきでないページ（管理・認証・個人領域）に noindex があること
        逆に、記事ページに noindex が付いていないこと
    10) sitemap.xml のカバレッジ（公開ページ全件が入っているか／
        noindex ページや実在しない URL が混ざっていないか）
    11) 見出しが古い言い回しに戻っていないか
        （生成スクリプトを流すと seo-normalize.mjs のリネームが黙って消える）

   実行: node assert-seo.mjs
        node assert-seo.mjs --verbose   （OK も全部出す）
════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/%20/g, ' ');
const ORIGIN = 'https://pilot-value.com';
const VERBOSE = process.argv.includes('--verbose');

/* ── 公開対象外（noindex であるべき）ページ ──────────────────────
   検索結果に出しても価値が無く、出ると「薄いページだらけのサイト」と
   評価されるもの。ログイン後の個人領域・認証コールバック・管理画面。       */
const NOINDEX = new Set([
  'admin.html', 'auth-callback.html', 'login.html', 'signup.html',
  'profile.html', 'my-value.html', 'pay-report.html', 'personal-data.html',
  'unsubscribe.html', '404.html', 'submit-review.html',
  /* 本人が自分の会社の待遇を答える画面。ログインが要るので検索に出さない。 */
  'airline-conditions.html',
  /* 給与明細を出した人だけが読める画面。ログインが要るので検索に出さない。 */
  'actual-pay.html',
  /* 2026-08-15 に求人の掲載を停止した。ページは残す（外部からのリンクを 404 に
     しないため）が、中身が「停止中」の1行だけなので検索には出さない。
     gen-sitemap.mjs / seo-normalize.mjs の同名の集合と3つで対にしてある。 */
  'world-jobs.html',
]);

const isNoindexPage = (rel) => NOINDEX.has(path.basename(rel))
  && !rel.includes('/airlines/') && !rel.includes('/countries/');

/* ── 対象ファイルの収集 ─────────────────────────────────────── */
const listHtml = (dir) =>
  fs.existsSync(path.join(ROOT, dir))
    ? fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.html')).sort()
    : [];

const files = [
  ...listHtml('.').map((f) => f),
  ...listHtml('airlines').map((f) => `airlines/${f}`),
  ...listHtml('countries').map((f) => `countries/${f}`),
  ...listHtml('en').map((f) => `en/${f}`),
  ...listHtml('en/airlines').map((f) => `en/airlines/${f}`),
  ...listHtml('en/countries').map((f) => `en/countries/${f}`),
];

/* ── URL 正規化：index.html は /（ディレクトリ）で表す ───────────── */
const relToUrl = (rel) => {
  if (rel === 'index.html') return `${ORIGIN}/`;
  if (rel === 'en/index.html') return `${ORIGIN}/en/`;
  return `${ORIGIN}/${rel}`;
};
/* 逆変換（sitemap 検証用） */
const urlToRel = (url) => {
  const p = url.replace(ORIGIN, '').replace(/^\//, '');
  if (p === '') return 'index.html';
  if (p === 'en/') return 'en/index.html';
  return p;
};

/* ── 表示幅（全角=2 / 半角=1）──────────────────────────────────
   文字数で測ると日英で基準がバラバラになる。Google の切り詰めは
   ピクセル幅なので、全角2・半角1の「幅」で数えると日英を同じ尺度で見られる。
     タイトル  … 目安 60幅（＝日本語30字／英語60字）
     説明文    … 目安 110〜165幅（＝日本語55〜82字／英語110〜165字）      */
const width = (s) => [...s].reduce((n, c) => n + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(c) ? 2 : 1), 0);
const TITLE_MAX = 70;
const DESC_MAX = 170;
const DESC_MIN = 100;

/* ── 戻ってはいけない見出し ────────────────────────────────────
   seo-normalize.mjs の H2_RENAME で直した「書き手の言葉」。中身は
   住宅手当・必要飛行時間・段階別の給与表なのに、見出しがそれを言って
   いなかった。airlines ページは gen_* 系スクリプトが丸ごと上書きする
   ので、誰かが再生成すると seo-normalize を流し直すまで黙って元に戻る。
   ここで落として気づけるようにする。

   ※ 定義を seo-normalize.mjs から import しない。あちらは読み込んだ
     瞬間に406ページを書き換える実行スクリプトで、テストから触れない。 */
const STALE_H2 = [
  ['ベネフィット', '福利厚生'],
  ['Benefits & Perks', 'Pilot Benefits & Allowances'],
  ['Recruitment Info', 'Pilot Hiring & Requirements'],
  ['Pay by Seniority', 'Pay Scale by Seniority'],
];

/* ── 極小 HTML パーサ（head の meta/link/title/ld+json だけ拾う）──── */
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i')) ||
            tag.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, 'i'));
  return m ? m[1] : null;
};

/* HTML 実体参照を戻してから測る。&quot; を4文字、&amp; を5文字として
   数えると、タイトル幅が実際より10以上ふくらんで誤検知になる。 */
const unesc = (s) => (s == null ? s : String(s)
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&'));

function parse(html) {
  const head = html.slice(0, html.search(/<\/head>/i) + 1 || html.length);
  const out = {
    lang: attr(html.match(/<html[^>]*>/i)?.[0] || '', 'lang'),
    titles: [...head.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map((m) => unesc(m[1].trim())),
    metas: [],
    links: [],
    ld: [...head.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]),
  };
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    out.metas.push({ name: attr(m[0], 'name'), property: attr(m[0], 'property'), content: unesc(attr(m[0], 'content')) });
  }
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    out.links.push({ rel: attr(m[0], 'rel'), href: unesc(attr(m[0], 'href')), hreflang: attr(m[0], 'hreflang') });
  }
  out.meta = (n) => out.metas.filter((x) => x.name && x.name.toLowerCase() === n.toLowerCase()).map((x) => x.content);
  out.og = (p) => out.metas.filter((x) => x.property && x.property.toLowerCase() === p.toLowerCase()).map((x) => x.content);
  out.link = (r) => out.links.filter((x) => x.rel && x.rel.toLowerCase() === r.toLowerCase());
  return out;
}

/* ── 結果の集計 ─────────────────────────────────────────────── */
const issues = [];   // {file, code, detail}
const add = (file, code, detail) => issues.push({ file, code, detail });

const docs = new Map();
for (const rel of files) {
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  docs.set(rel, { html, ...parse(html), url: relToUrl(rel), noindexExpected: isNoindexPage(rel) });
}

const seenTitle = new Map();
const seenDesc = new Map();

for (const [rel, d] of docs) {
  const expectLang = rel.startsWith('en/') ? 'en' : 'ja';

  /* 1) lang */
  if (!d.lang) add(rel, 'lang-missing', '<html> に lang 属性が無い');
  else if (d.lang.toLowerCase().split('-')[0] !== expectLang)
    add(rel, 'lang-mismatch', `lang="${d.lang}" だがディレクトリ的には ${expectLang}`);

  /* 2) title */
  if (d.titles.length === 0) add(rel, 'title-missing', '<title> が無い');
  else if (d.titles.length > 1) add(rel, 'title-duplicate-tag', `<title> が ${d.titles.length} 個ある（先頭以外は無視される）`);
  if (d.titles[0]) {
    const t = d.titles[0];
    /* 長さは検索結果での見え方の話。noindex ページはそもそも出ないので測らない。 */
    if (!d.noindexExpected && width(t) > TITLE_MAX) add(rel, 'title-too-long', `幅${width(t)}（上限${TITLE_MAX}／検索結果で切れる）: ${t.slice(0, 44)}…`);
    if (!d.noindexExpected && width(t) < 20) add(rel, 'title-too-short', `幅${width(t)}: ${t}`);
    if (!d.noindexExpected) {
      const prev = seenTitle.get(t);
      if (prev) add(rel, 'title-collision', `${prev} と同一タイトル`);
      else seenTitle.set(t, rel);
    }
  }

  /* 3) description */
  const desc = d.meta('description');
  if (desc.length === 0) add(rel, 'desc-missing', 'meta description が無い');
  else if (desc.length > 1) add(rel, 'desc-duplicate-tag', `meta description が ${desc.length} 個ある`);
  if (desc[0]) {
    const s = desc[0];
    if (!d.noindexExpected && width(s) > DESC_MAX) add(rel, 'desc-too-long', `幅${width(s)}（上限${DESC_MAX}）: ${s.slice(0, 40)}…`);
    if (!d.noindexExpected && width(s) < DESC_MIN) add(rel, 'desc-too-short', `幅${width(s)}（下限${DESC_MIN}）: ${s.slice(0, 40)}…`);
    if (!d.noindexExpected) {
      const prev = seenDesc.get(s);
      if (prev) add(rel, 'desc-collision', `${prev} と同一 description`);
      else seenDesc.set(s, rel);
    }
  }

  /* 4) canonical */
  const can = d.link('canonical');
  if (can.length === 0) add(rel, 'canonical-missing', 'canonical が無い');
  else if (can.length > 1) add(rel, 'canonical-duplicate', `canonical が ${can.length} 個ある`);
  else if (can[0].href !== d.url) add(rel, 'canonical-wrong', `${can[0].href} → 正しくは ${d.url}`);

  /* 5) hreflang */
  const alts = d.link('alternate').filter((x) => x.hreflang);
  const byLang = Object.fromEntries(alts.map((x) => [x.hreflang.toLowerCase(), x.href]));
  for (const need of ['ja', 'en', 'x-default']) {
    if (!byLang[need]) add(rel, 'hreflang-missing', `hreflang="${need}" が無い`);
  }
  for (const [hl, href] of Object.entries(byLang)) {
    if (!href || !href.startsWith(ORIGIN)) { add(rel, 'hreflang-bad-url', `${hl} → ${href}`); continue; }
    const target = urlToRel(href);
    if (!docs.has(target)) add(rel, 'hreflang-404', `${hl} → ${href}（そのファイルは存在しない）`);
  }
  /* 自分自身が自分の言語の hreflang に入っているか */
  if (byLang[expectLang] && byLang[expectLang] !== d.url)
    add(rel, 'hreflang-self-wrong', `hreflang="${expectLang}" が ${byLang[expectLang]}（自分は ${d.url}）`);
  /* x-default は en 側を指す運用。ja / en のどちらにも当てはまらない検索者
     （ドイツ語圏・アラビア語圏など）への既定として、日本語版より英語版が妥当。 */
  if (byLang['x-default'] && byLang['en'] && byLang['x-default'] !== byLang['en'])
    add(rel, 'hreflang-xdefault-mismatch', `x-default=${byLang['x-default']} / en=${byLang['en']}`);

  /* 6) og:url ＝ canonical */
  const ogUrl = d.og('og:url');
  if (ogUrl.length === 0) add(rel, 'og-url-missing', 'og:url が無い');
  else if (ogUrl[0] !== d.url) add(rel, 'og-url-wrong', `${ogUrl[0]} → 正しくは ${d.url}`);

  /* 7) OGP / Twitter の最低限 */
  for (const [p, code] of [['og:title', 'og-title-missing'], ['og:description', 'og-desc-missing'],
                            ['og:type', 'og-type-missing'], ['og:site_name', 'og-sitename-missing'],
                            ['og:image', 'og-image-missing']]) {
    if (d.og(p).length === 0) add(rel, code, `${p} が無い`);
  }
  if (d.meta('twitter:card').length === 0) add(rel, 'twitter-card-missing', 'twitter:card が無い');

  /* 8) JSON-LD が壊れていないか */
  if (d.ld.length === 0 && !d.noindexExpected) add(rel, 'jsonld-missing', '構造化データが無い');
  d.ld.forEach((raw, i) => {
    try {
      const j = JSON.parse(raw);
      const arr = Array.isArray(j) ? j : [j];
      for (const node of arr) {
        if (!node['@context']) add(rel, 'jsonld-no-context', `ld+json[${i}] に @context が無い`);
        /* @graph は @context を親に置いて子ノードが @type を持つ形。
           親に @type が無いのは正しい書き方なので、中身の方を見る。 */
        const kids = Array.isArray(node['@graph']) ? node['@graph'] : null;
        if (kids) {
          if (!kids.length) add(rel, 'jsonld-no-type', `ld+json[${i}] の @graph が空`);
          kids.forEach((k, n) => { if (!k['@type']) add(rel, 'jsonld-no-type', `ld+json[${i}].@graph[${n}] に @type が無い`); });
        } else if (!node['@type']) add(rel, 'jsonld-no-type', `ld+json[${i}] に @type が無い`);
      }
    } catch (e) {
      add(rel, 'jsonld-broken', `ld+json[${i}] が JSON として壊れている: ${e.message}`);
    }
  });

  /* 9) noindex の付け外し */
  const robots = (d.meta('robots')[0] || '').toLowerCase();
  const hasNoindex = robots.includes('noindex');
  if (d.noindexExpected && !hasNoindex) add(rel, 'should-be-noindex', `robots="${robots || '(無し)'}" — 個人領域/認証/管理ページは検索結果に出すべきでない`);
  if (!d.noindexExpected && hasNoindex) add(rel, 'unexpected-noindex', `記事ページなのに noindex: robots="${robots}"`);

  /* 11) 見出しが古い言い回しに戻っていないか。
        <h2> の先頭だけを見る。同じ語が口コミの引用文や本文に出るのは
        自然なので（community.html のレビューに「ベネフィット」がある）、
        見出し以外は落とさない。 */
  for (const m of d.html.matchAll(/<h2\b[^>]*>\s*([^<]{0,80})/g)) {
    const text = unesc(m[1]);
    for (const [stale, fixed] of STALE_H2) {
      if (text.startsWith(stale)) add(rel, 'stale-heading', `<h2>${text.trim()} — 「${fixed}」に直したはず。node seo-normalize.mjs を流し直す`);
    }
  }
}

/* ── 10) sitemap.xml のカバレッジ ─────────────────────────────── */
const smPath = path.join(ROOT, 'sitemap.xml');
if (!fs.existsSync(smPath)) {
  add('sitemap.xml', 'sitemap-missing', 'sitemap.xml が無い');
} else {
  const sm = fs.readFileSync(smPath, 'utf8');
  const locs = [...sm.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]);
  const set = new Set(locs);
  if (locs.length !== set.size) {
    const dup = locs.filter((x, i) => locs.indexOf(x) !== i);
    add('sitemap.xml', 'sitemap-duplicate-url', `重複 ${[...new Set(dup)].length} 件: ${[...new Set(dup)].slice(0, 3).join(', ')}`);
  }
  for (const loc of set) {
    const rel = urlToRel(loc);
    if (!docs.has(rel)) add('sitemap.xml', 'sitemap-dead-url', `${loc} — 実ファイルが無い`);
    else if (docs.get(rel).noindexExpected) add('sitemap.xml', 'sitemap-noindex-url', `${loc} — noindex ページが載っている`);
  }
  for (const [rel, d] of docs) {
    if (d.noindexExpected) continue;
    if (!set.has(d.url)) add('sitemap.xml', 'sitemap-missing-url', `${d.url} が sitemap に無い`);
  }
  if (!/xhtml:link/.test(sm)) add('sitemap.xml', 'sitemap-no-hreflang', 'sitemap に hreflang alternates（xhtml:link）が無い — 多言語の関連付けが Google に伝わりにくい');
}

/* ── 出力 ───────────────────────────────────────────────────── */
const byCode = new Map();
for (const it of issues) {
  if (!byCode.has(it.code)) byCode.set(it.code, []);
  byCode.get(it.code).push(it);
}
const sorted = [...byCode.entries()].sort((a, b) => b[1].length - a[1].length);

console.log(`\n═══ SEO 監査 — ${docs.size} ページ ═══\n`);
if (issues.length === 0) {
  console.log('✓ 指摘なし\n');
} else {
  for (const [code, list] of sorted) {
    console.log(`✗ ${code}  (${list.length}件)`);
    const show = VERBOSE ? list : list.slice(0, 6);
    for (const it of show) console.log(`    ${it.file}  →  ${it.detail}`);
    if (!VERBOSE && list.length > show.length) console.log(`    … 他 ${list.length - show.length} 件（--verbose で全件）`);
    console.log('');
  }
}
console.log(`合計 ${issues.length} 件の指摘 / ${docs.size} ページ`);
process.exitCode = issues.length ? 1 : 0;
