/* ════════════════════════════════════════════════════════════════
   gen-directory.mjs ── 航空会社一覧（world-airlines.html・en/world-airlines.html）に、
   台帳から作った中身を書く（形は directory-model.mjs。ここは書くだけ）。

   書くもの（印 <!--ID--> … <!--/ID--> の間だけ。印の外は1文字も触らない）
     PV-DIR-CARDS    112社のカード（ロゴ・社名・略号・機長と副操縦士の額・札）。英語は額をドルで焼き込む
     PV-DIR-REGIONS  地域の9つのボタンと社数
     PV-DIR-ELSE     見つからないときの、地域の8つのボタン（どれも hidden で出荷。社数は台本が当たりの数に書き換えてから見せる）
     PV-DIR-N        社数（何か所でも）
     PV-DIR-LD       ItemList の構造化データ
     id="pc-…"       古い地図のピンの社数（地図が在るあいだ）
     ASSETS          一覧が読む部品の ?v=（中身の指紋）
   ★ 何度流しても同じ（2回目は「変更なし」）。
   ★ String.replace は関数形（$ を特殊記号にしない）。
   ★ 画像のファイルも git も読まない（assert-generated.mjs の写しでも流れる）。ロゴの大きさは airline-logo-sizes.mjs の表から。
   ★ 年収・会社・略称・ロゴ・国の別名の台帳を直したら node gen-directory.mjs → node assert-directory.mjs
     （SWITCH ＝ airline-rollout.mjs を直したときも同じ。流さないと一覧だけが古いまま残り、画面は普通に動く）

   使い方: node gen-directory.mjs           ページを書く（違うときだけ）
           node gen-directory.mjs --check   古いページがあれば exit 1（書かない）
           node gen-directory.mjs --model   形を印字する（書かない）
   ════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { model, figure, twoSlugs, tickOf, CARD_RULE, REGIONS, ALL, RANKS } from './directory-model.mjs';
import { curCore, bakeText } from './cur-core.mjs';
import { logoHtml } from './airline-logo.mjs';

export * from './directory-model.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

/** 英語ページの額をドルにする道具（bake-en-currency.mjs と同じ呼び方。レートを手で持たない） */
export const C_EN = await curCore('USD', 'en');
export const bakeOf = (lang) => (lang === 'en' ? (t) => bakeText(t, C_EN) : (t) => t);
export const PAGES = Object.freeze([
  { lang: 'ja', rel: 'world-airlines.html', up: '' },
  { lang: 'en', rel: 'en/world-airlines.html', up: '../' },
]);

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`);
const pageOf = (lang) => { const p = PAGES.find((x) => x.lang === lang); if (!p) throw new Error(`知らない言語「${lang}」`); return p; };
/** 境目の印。カードの社名（リンク）と金額の行のあいだに1つ（check-salary.mjs が社名から額へ跨いで読まないため） */
const BARRIER = '<!--wd>-->';

/** ロゴの札（airline-logo.mjs の1か所が描く）。一覧は112社が1枚に並ぶので、見えるまで絵を読まない（loading="lazy"） */
const logoOf = (A, up) => logoHtml({ slug: A.slug, color: A.color }, { up }).replace('<img ', () => '<img loading="lazy" ');

/** 112社のカード */
export function cards(lang, M = model(), rule = CARD_RULE) {
  const page = pageOf(lang), en = lang === 'en', bake = bakeOf(lang);
  const regionLabel = Object.fromEntries(REGIONS.map((r) => [r.code, r[lang]]));
  return M.slugs.map((slug) => {
    const A = M.airlines[slug], hid = en ? A.en : A.ja;
    const amount = (y) => (y == null ? '—' : en ? bake(y) : esc(y));
    const line = (rank, f, pub) => `<p class="wd-fig${pub ? ' wd-fig-pub' : ''}" data-rank="${rank}"${pub ? ' data-pub="1"' : ''}>`
      + `<span class="wd-vh">${esc(hid)}</span>${esc(en ? f.labelEn : f.labelJa)}<b class="wd-v">${amount(f.yen)}</b></p>`;
    const figs = RANKS.flatMap((rank) => { const f = figure(A, rank, rule); return [line(rank, f, false), ...(f.extra ? [line(rank, f.extra, true)] : [])]; });
    const tags = (A.type === 'fsc' ? '<span class="tag tag-blue">FSC</span>' : A.type === 'lcc' ? '<span class="tag tag-orange">LCC</span>' : '')
      + (A.taxFree ? `<span class="tag tag-gold">${en ? 'Tax-free' : '免税'}</span>` : '')
      + (A.alliance ? `<span class="tag tag-gray">${esc(A.alliance[lang])}</span>` : '');
    const flag = A.show.flag ? `${esc(A.show.flag)} ` : '', second = en ? regionLabel[A.region] : A.show.en;
    return [
      `<li class="wd-li" data-slug="${esc(slug)}" data-region="${esc(A.region)}" data-type="${esc(A.type)}" data-tax="${A.taxFree ? 1 : 0}" data-lvl="${A.lvl ? 1 : 0}" data-two="${!en && A.two ? 1 : 0}" data-c="${esc(A.codes.join(' '))}" data-k="${esc(A.keys.join('|'))}" style="--ac:${esc(A.color)};--pvg-c:${esc(A.color)}">`,
      `<a class="wd-go" href="${esc(A.href)}"><span class="wd-logo">${logoOf(A, page.up)}</span><span class="wd-names"><span class="wd-name" id="wn-${esc(slug)}">${flag}${esc(A.show[lang])}</span><span class="wd-meta"><span class="wd-sub">${esc(second)}</span><span class="wd-code">${esc(A.code)}</span></span></span><span class="wd-chev" aria-hidden="true"></span></a>`,
      BARRIER,
      '<div class="wd-figs">',
      ...figs,
      '</div>',
      /* 比較のチェック（tickOf）は WP-dd-7 でこの帯の右に入る */
      `<div class="wd-foot"><span class="wd-tags">${tags}</span></div>`,
      '</li>',
    ].join('\n');
  }).join('\n');
}

/** 地域の9つのボタン（すべて ＋ 8地域）。押した見た目は aria-pressed だけ（pv-directory.css の PV-DIR-STRIP）──
    class active も直書きの色も書かない（台本も書かない） */
export function strip(lang, M = model()) {
  return [{ ...ALL, n: M.n }, ...M.regions].map((r) => {
    const all = r.code === 'all', label = esc(r[lang]);
    return `<button type="button" class="rstrip-btn" data-region="${r.code}" data-rc="${r.color}" data-emoji="${r.emoji}" data-label="${label}" aria-pressed="${all}" style="--rc:${r.color}"><span aria-hidden="true">${r.emoji}</span><span class="rstrip-l">${label}</span><span class="rstrip-n">${r.n}</span></button>`;
  }).join('\n');
}

/** 見つからないときの、地域の8つのボタン（地域の順・どれも hidden）。社数はその地域の全社数で書き、
    台本（pv-directory.js）が当たりの数に書き換えてから見せる */
export function elseRow(lang, M = model()) {
  return M.regions.map((r) => `<button type="button" class="wd-else-b" data-region="${r.code}" hidden><span class="wd-else-l">${esc(r[lang])}</span><span class="wd-else-n">${r.n}</span></button>`).join('\n');
}
/** ItemList の構造化データ（ページに在ったものと1文字も同じ。社数だけ台帳から） */
export function itemList(lang, M = model()) {
  const n = M.n;
  return lang === 'en'
    ? `<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"ItemList",
  "name":"Pilot Salaries at Airlines Worldwide",
  "description":"Pilot annual salaries, reviews and career information for ${n} airlines worldwide",
  "url":"https://pilot-value.com/en/world-airlines.html",
  "numberOfItems":${n}
}
</script>`
    : `<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"ItemList",
  "name":"世界の航空会社パイロット年収一覧",
  "description":"世界${n}社の航空会社パイロット年収・口コミ・転職情報",
  "url":"https://pilot-value.com/world-airlines.html",
  "numberOfItems":${n}
}
</script>`;
}

/** 書く塊。別の区域は1行足して、ページに <!--ID--> / <!--/ID--> を置く（どの id も「手で書いた社数」の検査から外れる） */
export const BLOCKS = [
  { id: 'PV-DIR-LD', build: itemList },
  { id: 'PV-DIR-N', build: (lang, M) => String(M.n), inline: true, many: true },
  { id: 'PV-DIR-REGIONS', build: strip },
  { id: 'PV-DIR-ELSE', build: elseRow },
  { id: 'PV-DIR-CARDS', build: cards },
];
/** ?v= を書く部品（両方のページが読むこと） */
export const ASSETS = ['pv-directory.css', 'pv-directory.js'];

const sha8 = (f) => createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 8);

/** そのページの「あるべき姿」（読むだけ。書くのは呼ぶ側） */
export function render(lang, html) {
  const M = model();
  let out = html;
  for (const b of BLOCKS) {
    const open = `<!--${b.id}-->`, close = `<!--/${b.id}-->`;
    const re = new RegExp(`${reEsc(open)}[\\s\\S]*?${reEsc(close)}`, 'g');
    const nO = out.split(open).length - 1, nC = out.split(close).length - 1, nP = (out.match(re) || []).length;
    if (b.optional && nO === 0 && nC === 0) continue;
    const body = b.build(lang, M);
    if (b.inline) {
      if (nP < 1 || nO !== nP || nC !== nP || (!b.many && nP !== 1)) throw new Error(`${lang}：${b.id} の印が合わない（開き ${nO}・閉じ ${nC}・組 ${nP}）`);
      out = out.replace(re, () => open + body + close);
    } else {
      if (nP !== 1 || nO !== 1 || nC !== 1) throw new Error(`${lang}：${b.id} の印が合わない（開き ${nO}・閉じ ${nC}・組 ${nP}。ちょうど1組であること）`);
      out = out.replace(re, () => `${open}\n${body}\n${close}`);
    }
  }
  for (const r of M.regions) {
    out = out.replace(new RegExp(`(id="pc-${r.code}">)[^<]*(<)`, 'g'), (_, a, z) => `${a}${lang === 'en' ? `${r.n} airlines` : `${r.n}社`}${z}`);
  }
  for (const f of ASSETS) {
    const v = sha8(f), re = new RegExp(`((?:src|href)=)(["'])((?:\\.\\.\\/)?)${reEsc(f)}(?:\\?v=[0-9a-f]{8})?\\2`, 'g');
    if (!(out.match(re) || []).length) throw new Error(`${lang}：${f} をページが読んでいない（ASSETS に在るのに）`);
    out = out.replace(re, (_, attr, q, up) => `${attr}${q}${up}${f}?v=${v}${q}`);
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), M = model();
  if (args.includes('--model')) {
    const S = M.slugs.map((s) => M.airlines[s]);
    console.log(`社数 ${M.n}`);
    console.log(`地域 ${M.regions.map((r) => `${r.code} ${r.n}`).join(' · ')}`);
    const pubs = S.flatMap((A) => RANKS.filter((r) => A[r].pub).map((r) => `  ${A.slug} ${r} ${A[r].pub.yen} ${A[r].pub.kindJa} / ${A[r].pub.kindEn}`));
    const held = S.flatMap((A) => RANKS.filter((r) => A[r].held).map((r) => `${A.slug} ${r}`));
    console.log(`会社の公表額 ${pubs.length}件（ほかは推定。確認中 ${held.length}件${held.length ? '：' + held.join('・') : ''}）`);
    for (const p of pubs) console.log(p);
    console.log(`2社比較で出せる会社（twoSlugs） ${twoSlugs().join(', ')}`);
    console.log(`機種の段（fleet）の無い会社 ${S.filter((A) => !A.lvl).map((A) => A.slug).join(', ')}`);
    const tj = S.filter((A) => tickOf(A, 'ja')).map((A) => A.slug), te = S.filter((A) => tickOf(A, 'en'));
    console.log(`比較のチェック 日本語 ${tj.length}社（${tj.join(', ')}）・英語 ${te.length}社`);
    console.log(`ロゴ 絵 ${S.filter((A) => A.logo).length}社・頭文字 ${S.filter((A) => !A.logo).length}社（${S.filter((A) => !A.logo).map((A) => A.slug).join(', ')}）`);
    process.exit(0);
  }
  /* 両方のページを先に作ってから書く（片方の印が壊れていたら、どちらも書かない） */
  let next;
  try { next = PAGES.map((p) => { const file = path.join(ROOT, p.rel), now = fs.readFileSync(file, 'utf8'); return { p, file, now, want: render(p.lang, now) }; }); }
  catch (e) { console.error(`❌ ${e.message}（何も書いていない）`); process.exit(1); }
  if (args.includes('--check')) {
    const stale = next.filter((x) => x.now !== x.want);
    for (const x of stale) console.error(`❌ ${x.p.rel} が台帳と合っていない（node gen-directory.mjs）`);
    if (stale.length) process.exit(1);
    console.log('✓ 一覧のページは最新');
    process.exit(0);
  }
  for (const x of next) {
    if (x.now === x.want) console.log(`✓ ${x.p.rel} 変更なし`);
    else { fs.writeFileSync(x.file, x.want); console.log(`✓ ${x.p.rel} を書いた（${M.n}社）`); }
  }
}
