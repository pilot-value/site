/* airline-logo.mjs ── 社名の左横のロゴ（会社ページの社名の行）を描く「1か所」（2026-10-21 オーナー
 * 「会社ページ作る時に航空会社名のタイトルの左横はロゴにしてね」／リード P12.86-2 L-LOGO）。
 *
 *   logoHtml(v)   … { slug, color } から、社名（h1）のすぐ左に置く札の HTML（会社ページ・段階4・5の一覧も、これを読む）
 *   LOGOS         … サイトに在るロゴ（assets/airline-logos/<slug>.<拡張子>。一覧は airline-logos.js の PV_LOGOS）
 *   monogram(slug) … ロゴの無い会社の頭文字（salary-leveling.js の monogram と同じ決め方：英語の社名の語の頭2つ）
 *
 * ★ 絵は取りに行かない。サイトに在るロゴだけ。描き方はトップのレベリング図（salary-leveling.js の logoHtml）と同じ：
 *   白い札に元の縦横比のまま・読めなければ会社の色の四角に頭文字。ロゴの無い会社は、はじめから同じ大きさ・同じ場所の頭文字の四角。
 *   社名のすぐ隣の飾りなので alt="" ＋ aria-hidden（社名は h1 が読む）。幅と高さの属性は絵の縦横比（読み込む前後で社名が動かない）。
 * ★ ページを作るときに画像のバイトを1つも読まない。札の大きさ（高さ 64 に直した幅と高さ）は airline-logo-sizes.mjs に
 *   一度だけ計って書いてある（リポジトリに入れる）。ロゴを足した・差し替えたら:
 *     node airline-logo.mjs --write    札の大きさを計り直して airline-logo-sizes.mjs を書く（ここだけが画像を読む）
 *     node airline-logo.mjs --check    計り直した大きさと airline-logo-sizes.mjs が同じか（違えば exit 1）
 *   assert-rollout.mjs が、この関数の答えと生成した会社ページのロゴの札が1文字も違わないこと・大きさの表が絵と合っていることを見る。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SALARY } from './salary-data.mjs';
import { LOGO_SIZES } from './airline-logo-sizes.mjs';
import { ratio, bgForWhite } from './patch-airline-pages.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** サイトに在るロゴ（slug → 拡張子）。airline-logos.js はブラウザ用の1行（window を渡して中身だけ借りる）。 */
export const LOGOS = (() => { const w = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'airline-logos.js'), 'utf8'))(w); return w.PV_LOGOS || {}; })();
/** ロゴのファイルの置き場（ルートから） */
export const logoFile = slug => (LOGOS[slug] ? `assets/airline-logos/${slug}.${LOGOS[slug]}` : '');

/** 頭文字（salary-leveling.js の monogram と同じ決め方：英語の社名の語の頭2つ） */
export const monogram = slug => { const t = String(SALARY[slug].en || '').replace(/[^A-Za-z ]/g, ' ').trim(); if (!t) return '✈'; const w = t.split(/\s+/); return (w.length >= 2 ? w[0][0] + w[1][0] : t.slice(0, 2)).toUpperCase(); };
/* 頭文字の字の色：会社の色が明るいときだけ暗い字（salary-leveling.js と同じ式） */
const lightBg = hex => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150; };
/* ★2026-10-21（全社へ広げる d1 の検査で見つかった：東邦航空 #CC6600 の白い頭文字が 3.84:1）頭文字は読める濃さ（WCAG AA 4.5:1）で描く。
   上の決め方で 4.5:1 に届く札は、今までと1文字も違わない。届かない札だけ、もう片方の字（白 ⇄ 暗い字）。
   どちらの字も届かない色（東邦航空 #CC6600 は 白 3.84・暗い字 4.14／エアアジア #FF0000 は 4.00・3.98）は、白い字のまま、
   地を同じ色合いの濃い色にする（明るい色の画面で白い字が乗るボタンと同じ決め方 ＝ patch-airline-pages.mjs の bgForWhite）。
   ロゴの在る会社の頭文字も同じ（ロゴの絵が読めなかったときに出る）。 */
const DARK_INK = '#1a2233', AA = 4.5;
function monoStyle(color) {
  const c = String(color || '').toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(c)) return '';
  const first = lightBg(c) ? DARK_INK : '#ffffff', ink = [first, first === DARK_INK ? '#ffffff' : DARK_INK].find(x => ratio(x, c) >= AA);
  if (ink) return ink === DARK_INK ? ` style="--pvg-mono-ink:${DARK_INK}"` : '';
  return ` style="background:${bgForWhite(c)}"`;
}

/** 絵の縦横比（SVG の viewBox か width・height／PNG の IHDR）。高さ 64 に直した整数の幅と高さ。読めなければ null。
    ★ 画像を読むのはここだけ（--write・--check と検査）。ページを作るときは呼ばない。 */
export function measure(file) {
  const b = fs.readFileSync(file);
  let w, h;
  if (file.endsWith('.png')) { w = b.readUInt32BE(16); h = b.readUInt32BE(20); }
  else {
    const tag = (/<svg\b[\s\S]*?>/.exec(b.toString('utf8', 0, 8000)) || [''])[0];
    const vb = /viewBox="\s*[-\d.e]+[\s,]+[-\d.e]+[\s,]+([\d.e]+)[\s,]+([\d.e]+)/.exec(tag);
    if (vb) { w = +vb[1]; h = +vb[2]; } else { w = +(/\bwidth="([\d.]+)/.exec(tag) || [])[1]; h = +(/\bheight="([\d.]+)/.exec(tag) || [])[1]; }
  }
  return w > 0 && h > 0 ? { w: Math.max(1, Math.round((64 * w) / h)), h: 64 } : null;
}
/** ロゴの在る会社ぜんぶの札の大きさを、絵から計り直す（slug → [幅, 高さ] か null）。 */
export const measureAll = (root = ROOT) => Object.fromEntries(Object.keys(LOGOS).sort().map(s => {
  const m = measure(path.join(root, logoFile(s)));
  return [s, m ? [m.w, m.h] : null];
}));

/**
 * 社名の左横の札。v ＝ { slug, color }。up ＝ そのページから見たルート（会社ページ airlines/ からは '../'）。
 * 大きさは airline-logo-sizes.mjs の表から（画像は読まない）。表に無いロゴの会社は止める（計り忘れ）。
 */
export function logoHtml(v, { up = '../' } = {}) {
  const ext = LOGOS[v.slug], mono = `<b class="pvg-mono"${monoStyle(v.color)}>${esc(monogram(v.slug))}</b>`;
  if (!ext) return `<span class="pvg-logo is-mono" aria-hidden="true">${mono}</span>`;
  if (!(v.slug in LOGO_SIZES)) throw new Error(`${v.slug}: ロゴの札の大きさが airline-logo-sizes.mjs に無い（node airline-logo.mjs --write）`);
  const box = LOGO_SIZES[v.slug];
  return `<span class="pvg-logo" aria-hidden="true"><img src="${up}${logoFile(v.slug)}" alt=""${box ? ` width="${box[0]}" height="${box[1]}"` : ''} decoding="async" onerror="this.parentNode.classList.add('is-fail')">${mono}</span>`;
}

/* ── 大きさの表を書く・見る ───────────────────────────────── */
const HEAD = `/* airline-logo-sizes.mjs ── 社名の左横のロゴの札の大きさ（高さ 64 に直した幅と高さ）。★生成物。手で直さない。
 *   node airline-logo.mjs --write で絵から計り直して書く（ページを作るときに画像を読まないため・リード P12.86-2）。
 *   値が null の会社は、絵の縦横比が読めなかった会社（札に幅と高さの属性を付けない）。
 */
`;
export const sizesText = sizes => `${HEAD}export const LOGO_SIZES = Object.freeze({\n${Object.entries(sizes).map(([s, b]) => `  '${s}': ${b ? `[${b[0]}, ${b[1]}]` : 'null'},`).join('\n')}\n});\n`;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = path.join(ROOT, 'airline-logo-sizes.mjs'), want = sizesText(measureAll());
  const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (process.argv.includes('--write')) {
    if (now === want) console.log('✓ 変更なし');
    else { fs.writeFileSync(file, want); console.log(`✎ airline-logo-sizes.mjs（${Object.keys(LOGOS).length}社）`); }
  } else if (process.argv.includes('--check')) {
    if (now !== want) { console.error('❌ airline-logo-sizes.mjs が絵と合っていない（node airline-logo.mjs --write）'); process.exit(1); }
    console.log(`✅ airline-logo: ロゴ ${Object.keys(LOGOS).length}社の札の大きさは、どれも絵と合っている`);
  } else console.log('使い方: node airline-logo.mjs --write | --check');
}
