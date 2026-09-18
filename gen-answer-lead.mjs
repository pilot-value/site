/* gen-answer-lead.mjs — 航空会社ページの冒頭に「質問の答えそのもの」を1段落置く（冪等）
   ==========================================================================
   なぜ:
     「Emirates の機長の年収は？」に対して、うちのページは会社紹介の文で始まり、
     数字は下の表にしか無かった。ChatGPT や Perplexity が引用元に選ぶのは、
     **質問文とほぼ同じ形の答えが本文の先頭にある**ページ（実際に引用されていた
     競合3社はどれもその形だった）。表を読ませるのではなく、先に言い切る。

   何を置くか（例・英語）:
     An Emirates captain earns an average of $233K per year, typically $211K–$318K.
     First officers average $176K ($157K–$211K). Pay is tax-free — the UAE levies
     no personal income tax. Figures are as of March 2026.

   ★数値は salary-data.mjs（SSOT）だけから作る。文中に数字を書き写さない。
   ★英語ページは currency.js と同じ span に焼き込む（cur-core.mjs の bakeText）。
     日本語ページは標準の円表記のまま置く＝currency.js が実行時に包む（サイトの作法）。

   使い方:
     node gen-answer-lead.mjs --check   何枚変わるかだけ出す（書かない）
     node gen-answer-lead.mjs           書く
     node gen-answer-lead.mjs --undo    段落を取り除く
   ========================================================================== */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SALARY } from './salary-data.mjs';
import { AIRLINE_COUNTRY, BY_CODE, nameIn } from './airline-countries.mjs';
import { curCore, bakeText } from './cur-core.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const ARG = new Set(process.argv.slice(2));
const CHECK = ARG.has('--check'), UNDO = ARG.has('--undo');

// 数値の見せ方は SSOT の「万円」から作る。円の書き方はサイトの標準表記だけを使う
// （独自の書式にすると currency.js の検出から漏れて assert-currency.mjs が落ちる）。
const yen = (man) => `¥${man.toLocaleString('en-US')}万`;
const AS_OF_EN = 'March 2026', AS_OF_JA = '2026年3月';

const country = (slug) => {
  const c = BY_CODE[AIRLINE_COUNTRY[slug]];
  return c ? { en: nameIn(c), ja: c.ja } : null;
};

function sentenceEn(slug, d) {
  const c = country(slug);
  const tax = d.taxFree
    ? (c ? `Pay is tax-free — ${c.en} levies no personal income tax.` : 'Pay is tax-free (no personal income tax).')
    : 'Figures are gross annual pay, before tax.';
  return `An <b>${d.en}</b> captain earns an average of ${yen(d.cap.avg)} per year, `
       + `typically ${yen(d.cap.lo)}–${yen(d.cap.hi)}. `
       + `First officers average ${yen(d.fo.avg)} (${yen(d.fo.lo)}–${yen(d.fo.hi)}). `
       + `${tax} Figures are as of ${AS_OF_EN}.`;
}
function sentenceJa(slug, d) {
  const c = country(slug);
  const tax = d.taxFree
    ? (c ? `${c.ja}は個人所得税が無く、この額がそのまま手元に残る。` : '個人所得税が無く、この額がそのまま手元に残る。')
    : 'いずれも税引き前の年額。';
  return `<b>${d.ja}</b>の機長の年収は平均${yen(d.cap.avg)}、幅はおおむね${yen(d.cap.lo)}〜${yen(d.cap.hi)}。`
       + `副操縦士は平均${yen(d.fo.avg)}（${yen(d.fo.lo)}〜${yen(d.fo.hi)}）。`
       + `${tax}${AS_OF_JA}時点。`;
}

// 冒頭のリード文（h1 直後の <p class="text-muted text-lg…">）の直後に置く。
// 既に置いてあれば中身ごと差し替える＝何度流しても1つしか増えない。
const MARK = /\n?<p class="pv-answer">[\s\S]*?<\/p>/;
const ANCHOR = /(<\/h1>\s*<p class="text-muted text-lg[^"]*">[\s\S]*?<\/p>)/;

const C = await curCore('USD', 'en');
let n = 0, skipped = [];
for (const [slug, d] of Object.entries(SALARY)) {
  for (const [p, lang] of [[`airlines/${slug}.html`, 'ja'], [`en/airlines/${slug}.html`, 'en']]) {
    const f = ROOT + p;
    if (!existsSync(f)) { skipped.push(p + '（ページが無い）'); continue; }
    const src = readFileSync(f, 'utf8');
    let body = src.replace(MARK, '');                       // まず前回ぶんを剥がす
    if (!UNDO) {
      if (!ANCHOR.test(body)) { skipped.push(p + '（リード文が見つからない）'); continue; }
      const text = lang === 'en' ? sentenceEn(slug, d) : sentenceJa(slug, d);
      const html = lang === 'en'
        ? text.split(/(<[^>]+>)/).map((s) => (s.startsWith('<') ? s : bakeText(s, C))).join('')
        : text;
      body = body.replace(ANCHOR, (_, lead) => `${lead}\n<p class="pv-answer">${html}</p>`);
    }
    if (body === src) continue;
    n++;
    if (!CHECK) writeFileSync(f, body);
  }
}
console.log(`${UNDO ? '取り除いた' : '置いた'}: ${n}枚${CHECK ? '（--check なので書いていない）' : ''}`);
if (skipped.length) console.log(`置けなかった ${skipped.length}件:\n  ` + skipped.join('\n  '));
