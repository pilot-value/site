/* ════════════════════════════════════════════════════════════════
   gen-directory.mjs ── 航空会社一覧（world-airlines.html・en/world-airlines.html）に、
   台帳から作った中身を書く（形は directory-model.mjs。ここは書くだけ）。

   書くもの（印 <!--ID--> … <!--/ID--> の間だけ。印の外は1文字も触らない）
     PV-DIR-CARDS    112社のカード（ロゴ・社名・略号・機長と副操縦士の額・札・比べる印）。英語は額をドルで焼き込む
     PV-DIR-REGIONS  地域の9つのボタンと社数
     PV-DIR-ELSE     見つからないときの、地域の8つのボタン（どれも hidden で出荷。社数は台本が当たりの数に書き換えてから見せる）
     PV-DIR-N        社数（何か所でも）
     PV-DIR-LD       ItemList の構造化データ
     PV-DIRMAP       地図と地域のまとめ（点で描く地図・「機長｜副操縦士」・9枚のカード：すべて ＋ 8地域の推定年収の平均と散らばり・
                     条件/出典）── 中身は directory-map.mjs の mapSection
     PV-DIR-LIST     比較リスト（#wd-tray。WP-dmap-10：題・何社目か・行の入れ物・会社を足す欄・決まりの行・2つのボタン。行と候補は台本が作る）
     id="pc-…"       古い地図のピンの社数（古い地図は WP-dmap-4 で消えた。ピンが無ければ何もしない）
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
import { model, figure, twoSlugs, tickOf, regionMean, CARD_RULE, REGIONS, ALL, RANKS } from './directory-model.mjs';
import { curCore, bakeText } from './cur-core.mjs';
import { logoHtml } from './airline-logo.mjs';
import { SALARY } from './salary-data.mjs';
import { mapSection } from './directory-map.mjs';

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

/* カードの字（★ここ1か所）。cmp ＝ 比べる印の読み上げの字（候補 C1。リード P12.86-3 で採った「比較」／«Compare»）。
   off／on ＝ 印の見える字（WP-dmap-10・シートの字：押す前「＋ 比較」・押した後「✓ 比較中」）。on は比較リストの候補の「付けた」印にも使う */
const WORDS = { cmp: { ja: '比較', en: 'Compare' }, off: { ja: '＋ 比較', en: '+ Compare' }, on: { ja: '✓ 比較中', en: '✓ Added' } };
/** 比べる印（tickOf が付けると決めたカードだけ）。WP-dmap-10 で小さなチェックから切り替えのボタンへ（aria-pressed。押した形は台本が書く）。
    読み上げの名前は社名（wn-）と印の字（wc- ＝「比較」）の2つで、押したかどうかは aria-pressed が伝える ── 見える字（「＋ 比較」／「✓ 比較中」）は
    CSS が aria-pressed で入れ替えるだけ（読み上げには出さない）。リンク（a.wd-go）の外・足もとの段の右 */
const tick = (A, lang) => (tickOf(A, lang)
  ? `<button type="button" class="wd-cmp" value="${esc(A.slug)}" aria-pressed="false" aria-labelledby="wn-${esc(A.slug)} wc-${esc(A.slug)}">`
    + `<span class="wd-cmp-off" aria-hidden="true">${esc(WORDS.off[lang])}</span><span class="wd-cmp-on" aria-hidden="true">${esc(WORDS.on[lang])}</span>`
    + `<span class="wd-vh" id="wc-${esc(A.slug)}">${esc(WORDS.cmp[lang])}</span></button>`
  : '');

/* 比較リストの字（★ここ1か所。WP-dmap-10・シートの字。fmt・two・lvl・none は前からページに在った字）。
   rule ＝ 決まりの行（ページに1つだけ。押せないボタンの「なぜ」も、台本がこの行を aria-describedby で指す）・
   why ＝ 機種の段（fleet）の無い社がレベリング比較に入らない理由（その社の行に台本が写す）・close ＝ 地図の全画面の「閉じる」と同じ字 */
const LIST = {
  ja: { h: '比較リスト', fmt: '{n} / {m} 社', add: '会社を追加', open: '＋ 会社を追加', empty: 'カードの「＋ 比較」か、下の欄から追加できます',
    rule: '比較は2社・レベリング比較は5社まで', why: '機材の区分が無いため、レベリング比較には入りません', rm: '外す', close: '閉じる',
    none: '該当する航空会社が見つかりませんでした', two: '航空会社を比較', lvl: 'レベリング比較' },
  en: { h: 'Compare list', fmt: '{n} / {m} airlines', add: 'Add an airline', open: '+ Add an airline', empty: 'Use “+ Compare” on a card, or add one below',
    rule: 'Compare: 2 airlines · Leveling: up to 5', why: 'No aircraft class, so it can’t join the leveling comparison', rm: 'Remove', close: 'Close',
    none: 'No airlines matched your search', two: 'Compare airlines', lvl: 'Leveling Comparison' },
};
const CHEVRON = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 9l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
/** 比較リスト（#wd-tray）。行（#wd-tray-list）と候補（#wd-cl-opts）は空で出荷し、台本がカードの社名とロゴを写して作る。
    台本が動かないときは <noscript> がリストごと隠す（.wd-tray）。「航空会社を比較」の行き先は、そのページから見た career.html?view=compare
    （2社がそろうまで台本が行き先を外す） */
export function listPanel(lang) {
  const W = LIST[lang], e = (k) => esc(W[k]);
  return [
    `<div class="wd-tray" id="wd-tray" role="region" aria-labelledby="wd-cl-h" data-fmt="${e('fmt')}" data-rm="${e('rm')}" data-on="${esc(WORDS.on[lang])}" hidden>`,
    `<div class="wd-cl-head"><div class="wd-cl-tt"><h2 class="wd-cl-h" id="wd-cl-h">${e('h')}</h2><span class="wd-tray-n" id="wd-tray-n" role="status" aria-live="polite"></span></div>`
      + `<button type="button" class="wd-cl-fold" id="wd-cl-fold" aria-expanded="false" aria-controls="wd-cl-body" aria-labelledby="wd-cl-h">${CHEVRON}</button>`
      + `<button type="button" class="wd-cl-close" id="wd-cl-close" aria-label="${e('close')}" title="${e('close')}" hidden></button></div>`,
    '<div class="wd-cl-body" id="wd-cl-body">',
    `<p class="wd-cl-empty" id="wd-cl-empty">${e('empty')}</p>`,
    '<ul class="wd-tray-list" id="wd-tray-list"></ul>',
    `<div class="wd-cl-add"><input type="text" class="wd-cl-q" id="wd-cl-q" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="wd-cl-opts" autocomplete="off" spellcheck="false" placeholder="${e('add')}" aria-label="${e('add')}">`
      + `<ul class="wd-cl-opts" id="wd-cl-opts" role="listbox" aria-label="${e('add')}" hidden></ul><p class="wd-cl-none" id="wd-cl-none" hidden>${e('none')}</p></div>`,
    `<p class="wd-cl-rule" id="wd-cl-rule">${e('rule')}</p>`,
    `<p class="wd-cl-why" id="wd-cl-why" hidden>${e('why')}</p>`,
    '</div>',
    `<div class="wd-cl-acts"><button type="button" class="wd-cl-open" id="wd-cl-open">${e('open')}</button>`
      + `<a class="wd-tray-two" id="wd-tray-two" href="career.html?view=compare">${e('two')}</a><button type="button" class="wd-tray-lvl" id="wd-tray-lvl">${e('lvl')}</button></div>`,
    '</div>',
  ].join('\n');
}

/** 112社のカード。★2026-10-25 英語の EN-9：英語のカードも data-two ＝ 2社比較（en/career.html）で出せる会社（前は英語だけ 0） */
export function cards(lang, M = model(), rule = CARD_RULE) {
  const page = pageOf(lang), en = lang === 'en', bake = bakeOf(lang);
  const regionLabel = Object.fromEntries(REGIONS.map((r) => [r.code, r[lang]]));
  return M.slugs.map((slug) => {
    const A = M.airlines[slug], hid = en ? A.en : A.ja;
    const amount = (y) => (y == null ? '—' : en ? bake(y) : esc(y));
    const line = (rank, f, pub) => `<p class="wd-fig${pub ? ' wd-fig-pub' : ''}" data-rank="${rank}"${pub ? ' data-pub="1"' : ''}>`
      + `<span class="wd-vh">${esc(hid)}</span>${esc(en ? f.labelEn : f.labelJa)}<b class="wd-v">${amount(f.yen)}</b></p>`;
    const figs = RANKS.flatMap((rank) => { const f = figure(A, rank, rule); return [line(rank, f, false), ...(f.extra ? [line(rank, f.extra, true)] : [])]; });
    /* 札は免税と提携だけ。FSC / LCC の札は付けない・種類（data-type）も免税（data-tax）もカードに書かない ── 種類で絞る口が無い
       （WP-dmap-7・オーナー P12.114「スカイマークはLCCだろ。日本でさえこんなに正確にわかられないならもう分けなくっていいよ」「免税もいらないよ」）。
       一覧の行（airlines-meta.js）の type はデータとして残るが、画面のどこも読まない */
    const tags = (A.taxFree ? `<span class="tag tag-gold">${en ? 'Tax-free' : '免税'}</span>` : '')
      + (A.alliance ? `<span class="tag tag-gray">${esc(A.alliance[lang])}</span>` : '');
    const flag = A.show.flag ? `${esc(A.show.flag)} ` : '', second = en ? regionLabel[A.region] : A.show.en;
    return [
      `<li class="wd-li" data-slug="${esc(slug)}" data-region="${esc(A.region)}" data-lvl="${A.lvl ? 1 : 0}" data-two="${A.two ? 1 : 0}" data-c="${esc(A.codes.join(' '))}" data-k="${esc(A.keys.join('|'))}" style="--ac:${esc(A.color)};--pvg-c:${esc(A.color)}">`,
      `<a class="wd-go" href="${esc(A.href)}"><span class="wd-logo">${logoOf(A, page.up)}</span><span class="wd-names"><span class="wd-name" id="wn-${esc(slug)}">${flag}${esc(A.show[lang])}</span><span class="wd-meta"><span class="wd-sub">${esc(second)}</span><span class="wd-code">${esc(A.code)}</span></span></span><span class="wd-chev" aria-hidden="true"></span></a>`,
      BARRIER,
      '<div class="wd-figs">',
      ...figs,
      '</div>',
      `<div class="wd-foot"><span class="wd-tags">${tags}</span>${tick(A, lang)}</div>`,
      '</li>',
    ].join('\n');
  }).join('\n');
}

/** 地域の9つのボタン（すべて ＋ 8地域）。字は名前と社数の2つの span だけ（絵文字の span・style は書かない ── directory-map の DM3・A11）。
    見た目は pv-directory.css の地図の区域の塊（「── wam:」の中）の1か所、押した見た目は [aria-pressed="true"] だけ ──
    class active も直書きの色も書かない（台本も書かない）。data-rc・data-emoji・data-label は古い地図の吹き出しが読む */
export function strip(lang, M = model()) {
  return [{ ...ALL, n: M.n }, ...M.regions].map((r) => {
    const all = r.code === 'all', label = esc(r[lang]);
    return `<button type="button" class="rstrip-btn" data-region="${r.code}" data-rc="${r.color}" data-emoji="${r.emoji}" data-label="${label}" aria-pressed="${all}"><span class="rstrip-l">${label}</span><span class="rstrip-n">${r.n}</span></button>`;
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

/** 換算の文（通貨のメニューと同じ字）。currency.js の AS_OF と NOTE をそのまま評価する（cur-core.mjs と同じやり方。字をここに打たない） */
export function fxNote(lang) {
  const src = fs.readFileSync(path.join(ROOT, 'currency.js'), 'utf8');
  const a = /^\s*var AS_OF\s*=.*;$/m.exec(src), n = /^\s*var NOTE\s*=\s*\{[\s\S]*?^\s*\};/m.exec(src);
  if (!a || !n) throw new Error('currency.js の形が変わった（var AS_OF / var NOTE が読めない）');
  const out = new Function(`${a[0]}\n${n[0]}\nreturn NOTE[${JSON.stringify(lang)}](AS_OF[${JSON.stringify(lang)}]);`)();
  if (typeof out !== 'string' || !out) throw new Error(`currency.js に「${lang}」の換算の文が無い`);
  return out;
}

/** 書く塊。別の区域は1行足して、ページに <!--ID--> / <!--/ID--> を置く（どの id も「手で書いた社数」の検査から外れる） */
export const BLOCKS = [
  { id: 'PV-DIR-LD', build: itemList },
  { id: 'PV-DIR-N', build: (lang, M) => String(M.n), inline: true, many: true },
  { id: 'PV-DIR-REGIONS', build: strip },
  { id: 'PV-DIR-ELSE', build: elseRow },
  { id: 'PV-DIR-CARDS', build: cards },
  { id: 'PV-DIRMAP', build: (lang, M) => mapSection({ lang, M, ledger: SALARY, regionMean, bake: bakeOf(lang), fxNote: fxNote(lang) }) },
  { id: 'PV-DIR-LIST', build: (lang) => listPanel(lang) },
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
