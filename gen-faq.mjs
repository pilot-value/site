/* ════════════════════════════════════════════════════════════════
   gen-faq.mjs — 航空会社ページ220枚の FAQ を SSOT から作り直す

   ── 日本語側で直すこと ────────────────────────────────────────
   1. 110枚のうち98枚が、FAQPage の構造化データを出しているのに
      ページ本文にFAQが1問も無い。Google の FAQ 構造化データは
      「回答がページ上でユーザーに見えていること」が条件なので、
      今の状態は無効なだけでなく手動対策の対象になりうる。
      残り12枚は手書きのFAQがあるが、その本文とJSON-LDの中身が
      別物になっている。書いてある内容と申告がずれている。

   2. 出ている3問が seo-batch-update.mjs 由来の定型文で、
      副操縦士・月収・手取りに一言も答えていない。
      狙っているのは「[社名] 副操縦士 年収」「パイロット 月収」
      「[社名] 手取り」なので、答えが無いページは拾われない。

   ── 英語側で足すこと ──────────────────────────────────────
   英語版は captain / first officer / requirements / 比較（＋非課税社は
   tax-free）を既に持っているが、月額に答える問がどこにも無い。
   "pilot salary per month" 系のクエリに対して答えを持っていない。
   1問だけ足す。既存の4〜5問には手を触れない。

   ── どう作るか ────────────────────────────────────────────
   数値は全て salary-data.mjs（SSOT）から毎回計算する。
   ページに書いてある数字を読み取って再利用はしない。

   日本語・可視FAQが無いページ … SSOT から5問（機長／副操縦士／月収／
     非課税または比較）を組み、可視セクションとJSON-LDを
     <!--PV-FAQ--> の管理ブロックに一緒に入れる。同じ配列から両方を
     作るので、本文と構造化データが原理的にずれない。

   日本語・可視FAQがあるページ … 本文は書き換えない（手書きの中身のほうが
     濃い）。ページに見えている <details> から Q/A を読み取って JSON-LD を
     組み直す。申告を本文に合わせる向きで直す。

   英語（全110枚） … 月収の1問を可視FAQの末尾と FAQPage の両方に足す。

   starlux（日本語） … FAQをJSで描画していて <details> が無い。対象外。

   ── 通貨の扱い ────────────────────────────────────────────
   currency.js は <script> を走査対象から外すので、JSON-LD は実行時に
   変換されない。英語ページの既定表示は USD なので、
     ・可視テキスト → ¥…M（英語ページの既存表記。currency.js が $…K へ変換する）
     ・JSON-LD     → 変換後と同じ見え方になる USD を直接書く
   と書き分ける。レートと圧縮表記は currency.js から読んで合わせるので、
   ページに出る文字列と構造化データの文字列が一致する（実測で確認済み。
   例: zipair 可視 ¥2.08M → 表示 $13K、LD も $13K）。
   日本語ページは既定 JPY なので、可視も LD も ¥…万 のままでよい。

   ── 書かない数字 ──────────────────────────────────────────
   ・課税国の手取り額（税率を推測で埋めることになる）
   ・SSOT に無い機種別・年次別の内訳

   実行: node gen-faq.mjs
        node gen-faq.mjs --dry
════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { SALARY } from './salary-data.mjs';
import { AIRLINE_COUNTRY, BY_CODE } from './airline-countries.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/%20/g, ' ');
const DRY = process.argv.includes('--dry');

/* 通貨切替（currency.js）が拾える標準の円表記だけを使う。独自フォーマットは
   assert-currency / assert-jp が落ちる。CLAUDE.md「通貨表記のルール」。 */
const man = (v) => `¥${Math.round(v).toLocaleString('en-US')}万`;
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* レートと圧縮表記は currency.js の実装をそのまま写す。数字を二重管理しない。 */
const CUR = fs.readFileSync(path.join(ROOT, 'currency.js'), 'utf8');
const RATE_USD = (() => {
  const m = CUR.match(/RATES\s*=\s*\{[^}]*USD:\s*([\d.]+)/);
  if (!m) throw new Error('currency.js から USD レートが読めない。RATES の書式が変わった可能性がある');
  return parseFloat(m[1]);
})();
const trimZero = (s) => String(s).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
/* currency.js の compact() と同じ丸め。ページに出る文字列と一致させるため。 */
function usd(manYen) {
  const v = Math.round(manYen) * 10000 / RATE_USD;
  const a = Math.abs(v);
  if (a >= 1e6) return '$' + trimZero((v / 1e6).toFixed(1)) + 'M';
  if (a >= 1e4) return '$' + Math.round(v / 1e3).toLocaleString('en-US') + 'K';
  if (a >= 1e3) return '$' + trimZero((v / 1e3).toFixed(1)) + 'K';
  return '$' + Math.round(v).toLocaleString('en-US');
}

/* 比較の基準は日本の大手。ANA と JAL は SSOT で同値。 */
const BASE = SALARY.ana.cap.avg;

/* ── 日本語・SSOT から5問 ─────────────────────────────────────── */
function buildJa(slug) {
  const d = SALARY[slug];
  const name = d.ja;
  const { cap, fo } = d;
  const country = BY_CODE[AIRLINE_COUNTRY[slug]];
  const gap = cap.avg - fo.avg;
  const ratio = (cap.avg / fo.avg).toFixed(1);

  const items = [
    {
      q: `${name}の機長の年収はいくらですか？`,
      a: `${name}の機長（Captain）の年収は平均${man(cap.avg)}です（レンジ${man(cap.lo)}〜${man(cap.hi)}）。`
        + (d.taxFree
          ? `${country ? country.ja : '所在国'}は個人所得税が無いため、この金額がそのまま手取りに近くなります。`
          : `いずれも税引き前の金額です。`)
        + `機種・在籍年数・乗務する路線によって上下します。`,
    },
    {
      q: `${name}の副操縦士の年収はいくらですか？`,
      a: `${name}の副操縦士（First Officer）の年収は平均${man(fo.avg)}です（レンジ${man(fo.lo)}〜${man(fo.hi)}）。`
        + `機長との差は平均で${man(gap)}、倍率にすると約${ratio}倍です。`
        + `副操縦士の年収は在籍年数とともに上がり、機長昇格で大きく段が変わります。`,
    },
    {
      q: `${name}のパイロットの月収はいくらですか？`,
      a: `年収を12で割った単純計算では、機長で1か月あたり約${man(cap.avg / 12)}、副操縦士で約${man(fo.avg / 12)}です。`
        + `実際の支給額は月ごとの乗務時間で変動します。賞与のある会社では毎月の支給額はこれより低く、賞与月に上振れします。`,
    },
  ];

  /* 手取りの問。**課税国の社にだけ**置く。
     非課税の社には下の「本当に非課税ですか？」が同じことを答えているので、
     語違いの2問目を作らない。
     ★ 税率は書かない。居住国・扶養・控除で変わるものを一律の割合で出すと
       推測を数字にすることになる（VERIFIED-PILOT.md の原則）。 */
  if (!d.taxFree) {
    items.push({
      q: `${name}のパイロットの手取りはいくらですか？`,
      a: `このページに載せている金額はすべて税引き前（額面）です。機長平均${man(cap.avg)}、副操縦士平均${man(fo.avg)}も額面で、ここから所得税・住民税・社会保険料が引かれます。`
        + `手取りは居住国・扶養・各種控除で変わるため、額面から一律の割合で出すことはできません。`
        + `同じ額面でも、個人所得税の無い国（UAE・カタールなど）の航空会社とは手元に残る額が変わります。`,
    });
  }

  if (d.taxFree) {
    items.push({
      q: `${name}のパイロットの給与は本当に非課税ですか？`,
      a: `${country ? country.ja : '所在国'}には個人所得税が無いため、${name}の給与は額面がほぼそのまま手取りになります。`
        + `機長平均${man(cap.avg)}は、額面と手取りがほぼ同じ額と考えられます。`
        + `日本の航空会社の年収は税引き前の金額なので、同じ額面でも手元に残る金額は大きく変わります。`
        + `なお日本の居住者判定など個人の税務は別途確認が必要です。`,
    });
  }

  if (slug !== 'ana' && slug !== 'jal') {
    const diff = cap.avg - BASE;
    const cmp = diff === 0 ? 'ほぼ同水準です'
      : diff > 0 ? `${man(diff)}高い水準です`
        : `${man(-diff)}低い水準です`;
    items.push({
      q: `${name}のパイロット年収はANA・JALと比べてどうですか？`,
      a: `${name}の機長は平均${man(cap.avg)}、ANA・JALはともに機長平均${man(BASE)}で、${cmp}。`
        + `副操縦士は${name}が平均${man(fo.avg)}、ANA・JALが平均${man(SALARY.ana.fo.avg)}です。`
        + (d.taxFree
          ? `ただし${name}は非課税、ANA・JALは税引き前の金額なので、手取りで比べると差はさらに広がります。`
          : `いずれも税引き前の金額どうしの比較です。`),
    });
  }

  return items;
}

/* ── 英語・足す問。可視は円（実行時に変換）、LD は変換後と同じ USD ──
   英語ページの既存表記は `¥25M`（＝2,500万）で、生の万表記は使わない。
   月額もその書式に合わせる（208万 → ¥2.08M）。currency.js の 7) `¥N M` が拾う。

   ★ 何を足すかは、既に答えている問を数えてから決めた。英語110枚には
     captain salary / first officer salary / requirements / vs ANA・JAL
     （非課税の社は tax-free も）が既にある。だから
     "How much do {Airline} pilots make?" は上の2問の言い換えにしかならず、足さない。
     まだどこにも答えが無いのは次の2つ:
       ・pay scale（段階別の給与表はページにあるのに、問としては無い）
       ・税引き前か後か（非課税の社にしか税の問が無い）                  */
const manM = (v) => `¥${trimZero((Math.round(v) / 100).toFixed(2))}M`;
function buildEnExtra(slug) {
  const d = SALARY[slug];
  const name = d.en;
  const { cap, fo } = d;
  const capM = Math.round(cap.avg / 12);
  const foM = Math.round(fo.avg / 12);
  const ratio = (cap.avg / fo.avg).toFixed(1);
  const items = [];

  const monthly = `Dividing the annual average by 12, ${name} captains earn about {CAP} a month and first officers about {FO}. `
    + `What actually lands each month moves with block hours flown, and where an annual bonus is paid the regular monthly figure sits lower with a spike in the bonus month.`;
  items.push({
    q: `What is ${name} pilot salary per month?`,
    aHtml: monthly.replace('{CAP}', manM(capM)).replace('{FO}', manM(foM)),
    aLd: monthly.replace('{CAP}', usd(capM)).replace('{FO}', usd(foM)),
  });

  /* 給与表はページ内にある（"Pay Scale by Seniority"）。その段差を数字で言う。 */
  const scale = `${name} first officers average {FO} and captains {CAP} — a step of about {GAP}, or roughly ${ratio}×. `
    + `The full range runs {FOLO} to {CAPHI}, and where you sit inside it is set by seniority, type rating and the routes you fly. `
    + `The seniority table on this page breaks the same range into career stages.`;
  const fill = (f) => scale.replace('{FO}', f(fo.avg)).replace('{CAP}', f(cap.avg))
    .replace('{GAP}', f(cap.avg - fo.avg)).replace('{FOLO}', f(fo.lo)).replace('{CAPHI}', f(cap.hi));
  items.push({
    q: `What is the ${name} pilot pay scale?`,
    aHtml: fill(manM), aLd: fill(usd),
  });

  /* 税引き前か後か。非課税の社には既に tax-free の問があるので置かない。
     ★ 税率は書かない。居住国と控除で変わるものを推測で数字にしない。 */
  if (!d.taxFree) {
    const tax = `Every figure on this page is gross, before income tax. Captains average {CAP} and first officers {FO} pre-tax, `
      + `and income tax, social insurance and any local levies come out of that. `
      + `Take-home depends on where you are resident and on your own deductions, so no single percentage applies. `
      + `Airlines based in countries with no personal income tax — the UAE, Qatar, Saudi Arabia — leave more of the same gross figure in your hand.`;
    items.push({
      q: `Is ${name} pilot salary before or after tax?`,
      aHtml: tax.replace('{CAP}', manM(cap.avg)).replace('{FO}', manM(fo.avg)),
      aLd: tax.replace('{CAP}', usd(cap.avg)).replace('{FO}', usd(fo.avg)),
    });
  }

  return items;
}

/* 前回の実行ぶんを落とすための、管理している問の見分け方。
   文言を変えても重複しないよう、問文そのものではなく型で当てる。 */
const EN_MANAGED = [/pilot salary per month\?$/i, /pilot pay scale\?$/i, /pilot salary before or after tax\?$/i];

/* ── 可視ブロック。ページ側で既に定義されているクラスに乗せる ──────
   glass / section-badge / fade-up は日本語110枚すべてに存在することを確認済み。
   独自CSSを足さないので、ライトテーマもページ側の規則がそのまま効く。 */
function visibleJa(slug, items) {
  const name = SALARY[slug].ja;
  return `<!--PV-FAQ-->
<div class="glass p-8 fade-up">
  <div class="section-badge mb-4">よくある質問</div>
  <h2 class="text-2xl font-bold mb-6">${escHtml(name)}パイロット年収 よくある質問（FAQ）</h2>
  <div class="space-y-4">
${items.map(({ q, a }) => `    <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
      <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">${escHtml(q)}<span class="text-muted text-xl">+</span></summary>
      <div class="px-5 pb-5 text-sm text-muted leading-relaxed">${escHtml(a)}</div>
    </details>`).join('\n')}
  </div>
</div>
<!--/PV-FAQ-->
`;
}

/* 英語は既存の <details> と同じ形（gen_en_airlines.mjs 由来の info-card）に合わせる。 */
function visibleEn({ q, aHtml }) {
  return `<!--PV-FAQ-->
<details class="info-card cursor-pointer">
<summary class="font-semibold">${escHtml(q)}</summary>
<p class="text-sm text-muted mt-3">${escHtml(aHtml)}</p>
</details>
<!--/PV-FAQ-->
`;
}

/* ── 可視FAQを持つページから Q/A を読む ───────────────────────────
   <details> は全ページで FAQ 見出しより後ろにしか無いことを確認済み。
   summary 内の「＋」記号（span）は質問文ではないので先に落とす。 */
function extractVisible(html, marker) {
  const at = html.indexOf(marker);
  if (at === -1) return [];
  const out = [];
  const re = /<details[^>]*>([\s\S]*?)<\/details>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m.index < at) continue;
    const inner = m[1];
    const s = inner.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
    if (!s) continue;
    const q = strip(s[1].replace(/<span[^>]*>[\s\S]*?<\/span>/g, ''));
    const a = strip(inner.slice(s.index + s[0].length));
    if (q.length >= 6 && a.length >= 20) out.push({ q, a });
  }
  return out;
}
const strip = (s) => s
  .replace(/<[^>]*>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/* ── FAQPage の mainEntity を書き換える ────────────────────────────
   FAQPage は単独タグのことも、BreadcrumbList / Article と同じ配列に
   入っていることもある。script タグごと足したり消したりせず、
   見つけた FAQPage の中身だけ差し替えて他の型を巻き添えにしない。
   mutate(list) が新しい mainEntity を返す。 */
function patchFaqLd(html, mutate) {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let json;
    try { json = JSON.parse(m[1]); } catch { continue; }
    const arr = Array.isArray(json) ? json : [json];
    const faq = arr.find((x) => x && x['@type'] === 'FAQPage');
    if (!faq) continue;
    faq.mainEntity = mutate(faq.mainEntity || []);
    const rebuilt = `<script type="application/ld+json">${JSON.stringify(Array.isArray(json) ? arr : arr[0])}</script>`;
    return { html: html.replace(m[0], () => rebuilt), done: true };
  }
  return { html, done: false };
}
const asQuestion = ({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } });

/* 管理ブロックの剥がし。末尾の空行まで食う — 食わないと、ブロックだけ消えて
   前後の改行が毎回1本ずつ残り、再実行のたびにファイルが伸びて冪等でなくなる。
   （差し込み位置の直後は必ず閉じタグなので、意味のある空行を巻き込まない） */
const STRIP = /<!--PV-FAQ-->[\s\S]*?<!--\/PV-FAQ-->[ \t\n]*/g;
/* 英語は既存の <details> の直後に足すので、こちらが自分で入れた前後の改行も一緒に返す。
   剥がした結果が元のファイルと1バイトも違わないので、何回流しても同じ形に落ち着く。 */
const STRIP_EN = /\n?<!--PV-FAQ-->[\s\S]*?<!--\/PV-FAQ-->[ \t\n]*/g;

/* ── 日本語の差し込み位置。本文コンテナ（max-w-7xl … pb-24）の中の末尾。
      直後にある転職CTAの帯を目印にして、コンテナを閉じる </div> の手前へ。
      110枚すべてに両方あることを確認済み。 */
const CTA = '<div style="background:rgba(249,115,22,.06)';

const report = [];
let jaMade = 0, jaRelinked = 0, enAdded = 0, skipped = 0, failed = 0;

/* ══ 日本語 ═══════════════════════════════════════════════════ */
for (const slug of Object.keys(SALARY)) {
  const abs = path.join(ROOT, 'airlines', `${slug}.html`);
  if (!fs.existsSync(abs)) { report.push(`  ? ja ${slug}: ページが無い`); skipped++; continue; }
  const orig = fs.readFileSync(abs, 'utf8');

  /* まず剥がす。問数が変わっても、SSOT が動いても、同じ扱いで直る。 */
  let html = orig.replace(STRIP, '');

  const existing = extractVisible(html, 'よくある質問');
  let items, mode;
  if (existing.length >= 2) {
    items = existing;
    mode = '本文→LD';
  } else if (/よくある質問/.test(html)) {
    /* 見出しはあるが <details> が無い（starlux はJSで描画）。本文の作りが読めない。 */
    report.push(`  - ja ${slug}: 可視FAQがJS描画。対象外`);
    skipped++;
    continue;
  } else {
    items = buildJa(slug);
    mode = 'SSOT→本文+LD';
    const cta = html.indexOf(CTA);
    const at = cta === -1 ? -1 : html.lastIndexOf('</div>', cta);
    if (at === -1) { report.push(`  ! ja ${slug}: 差し込み位置が見つからない`); failed++; continue; }
    html = html.slice(0, at) + visibleJa(slug, items) + html.slice(at);
  }

  const r = patchFaqLd(html, () => items.map(asQuestion));
  if (!r.done) { report.push(`  ! ja ${slug}: FAQPage の JSON-LD が見つからない`); failed++; continue; }
  html = r.html;

  if (html !== orig) {
    if (!DRY) fs.writeFileSync(abs, html);
    if (mode === '本文→LD') jaRelinked++; else jaMade++;
  }
  report.push(`  ${mode === '本文→LD' ? '↺' : '＋'} ja ${slug.padEnd(20)} ${String(items.length).padStart(2)}問  ${mode}`);
}

/* ══ 英語 — 月収の1問だけ足す ══════════════════════════════════ */
const EN_ANCHOR = /<h2[^>]*>Frequently Asked Questions<\/h2>/;
for (const slug of Object.keys(SALARY)) {
  const abs = path.join(ROOT, 'en/airlines', `${slug}.html`);
  if (!fs.existsSync(abs)) { skipped++; continue; }
  const orig = fs.readFileSync(abs, 'utf8');
  let html = orig.replace(STRIP_EN, '');

  const at = html.search(EN_ANCHOR);
  if (at === -1) { report.push(`  ! en ${slug}: FAQ の見出しが無い`); failed++; continue; }
  const last = html.lastIndexOf('</details>');
  if (last < at) { report.push(`  ! en ${slug}: FAQ の <details> が無い`); failed++; continue; }

  const extra = buildEnExtra(slug);
  const pos = last + '</details>'.length;
  html = html.slice(0, pos) + '\n' + extra.map(visibleEn).join('') + html.slice(pos);

  /* 既に入っている管理下の問（前回の実行ぶん）は落としてから足す。文言を変えても重複しない。 */
  const r = patchFaqLd(html, (list) => [
    ...list.filter((x) => !EN_MANAGED.some((re) => re.test(x && x.name || ''))),
    ...extra.map((it) => asQuestion({ q: it.q, a: it.aLd })),
  ]);
  if (!r.done) { report.push(`  ! en ${slug}: FAQPage の JSON-LD が見つからない`); failed++; continue; }
  html = r.html;

  if (html !== orig) { if (!DRY) fs.writeFileSync(abs, html); enAdded++; }
  report.push(`  ＋ en ${slug.padEnd(20)} ${extra.length}問追加`);
}

console.log(report.join('\n'));
console.log(`\n${DRY ? '[dry-run] ' : ''}日本語: 可視FAQを新設 ${jaMade}枚 ／ 既存FAQに構造化データを合わせた ${jaRelinked}枚`);
console.log(`${DRY ? '[dry-run] ' : ''}英語:   月収・給与表・税引き前後の問を追加 ${enAdded}枚`);
console.log(`${DRY ? '[dry-run] ' : ''}対象外 ${skipped}枚 ／ 失敗 ${failed}枚`);
if (failed) process.exitCode = 1;
