#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   patch-airline-pages.mjs — 会社ページ（airlines/*.html・en/airlines/*.html のうち <body data-airline> を持つ全部）の2つ

   ① 上の帯の「← 一覧に戻る」（英語は「← World Airlines」）を外す
      ★2026-10-19 オーナー「「← 一覧に戻る」いらないでしょ」。戻り道は左のナビの AIRLINES と、ページの下の帯の「←」。
      外すのは上の帯（<nav id="main-nav">）の中の1本だけ。比較のページ（*-hikaku・*-vs-*）・下の帯・ほかの画面は触らない。
      ⚠️ 帯に右の箱を持たないページでは、airline-base.js が帯の「最後の要素」をテーマの切替の箱へ移していた（＝戻るリンク）。
         リンクを外すと最後の要素はロゴになるので、airline-base.js は何も移さないように直してある（ロゴは左端のまま）。

   ② 明るい色の画面で、その会社の色の字を読める濃さにする（<style data-pv-light> を <head> に1つ）
      ★2026-10-19（WP-ans-f）。会社の色は暗い色の画面のために選んだ明るい色（例 style="color:#FFD700"）で、
        白い面の上では 1.1〜2.9:1 しか無かった。英語ページを明るい色で開くようにしてから、初めて来た人が皆これを見ていた。
      書くのは [data-theme="light"] で始まる行だけ ＝ 暗い色の画面には1つも効かない。同じ色合いのまま、濃くするだけ。
      直す相手は3つ：
        ・ページに書いてある style="…color:#xxxxxx…"（border-color などは別物。^color: か ;color: だけを見る）
        ・ページの <style> の .section-badge と、そのページだけの .tag-…（共通の6色は airline-base.css が直す）
        ・ページの <style> の .btn-primary の地の色（白い字が読めない濃さのとき）
      線は WCAG AA。色の付いた面（ヒーローの帯・会社の色を薄く敷いた箱）の上でも 4.6:1 を超える濃さにする。
      共通の部品（控えめの字・タブ・口コミの欄など）の色は airlines/airline-base.css に在る（ここでは書かない）。
      測るのは assert-airline-glance.mjs の場面 contrast（会社ページ全部 × タブ全部）。

   ③ 日本語の会社ページが読む airline-base.js の ?v= を、ファイルの中身の指紋にする
      ★2026-10-19 まで ?v=4 の手書きの固定だった ＝ airline-base.js を直しても、前の版を持っているブラウザはそれを使い続ける。
        ①で戻るリンクを外した HTML と前の版の airline-base.js が組み合わさると、帯のロゴが切替の箱へ移される（帯の部品が左へ寄る）。
        airline-base.js を直したら、このスクリプトを流す（流し忘れは assert-airline-glance.mjs --static が捕まえる）。

   ★冪等。何度流しても同じ結果（2回目は「✓ 変更なし」）。
   使い方:
     node patch-airline-pages.mjs           書き込む
     node patch-airline-pages.mjs --check   食い違うページを数えるだけ（書かない・あれば終了コード 1）
   ⚠️ 置換は slice で書く（String.replace の「新しい側」に文字列を渡さない ── $ が化ける。CLAUDE.md）。
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const CHECK = process.argv.includes('--check');

/* ── 会社ページ ─────────────────────────────────────────────── */
export function companyPages() {
  const out = [];
  for (const dir of ['airlines', 'en/airlines']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).filter(x => x.endsWith('.html')).sort()) {
      const rel = dir + '/' + f;
      const s = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      if (/<body\b[^>]*\bdata-airline="/.test(s)) out.push(rel);
    }
  }
  return out;
}

/* ── ① 上の帯の戻るリンク ───────────────────────────────────── */
const BACK_RE = /\n[ \t]*<a href="(?:\.\.\/world-airlines\.html|\.\.\/index\.html|\.\.\/\.\.\/en\/world-airlines\.html)" class="btn-ghost text-sm py-2 px-4(?: hidden md:inline-flex)?">← (?:一覧に戻る|World Airlines)<\/a>[ \t]*(?=\n)/g;
export function navOf(h) {
  const a = h.indexOf('<nav id="main-nav">');
  const b = a < 0 ? -1 : h.indexOf('</nav>', a);
  return a < 0 || b < 0 ? null : { a, b: b + '</nav>'.length };
}
function dropBack(h, rel, problems) {
  const n = navOf(h);
  if (!n) { problems.push(`${rel}: 上の帯（<nav id="main-nav">）が見つからない`); return h; }
  const nav = h.slice(n.a, n.b);
  const hits = [...nav.matchAll(BACK_RE)];
  const left = nav.split(BACK_RE).join('');
  if (/<a\b[^>]*>←/.test(left)) { problems.push(`${rel}: 上の帯に、知らない形の「←」のリンクが在る（外さずに残す）`); return h; }
  if (!hits.length) return h;
  return h.slice(0, n.a) + left + h.slice(n.b);
}

/* ── 色の計算（WCAG のコントラスト比・OKLab で色合いを保ったまま濃くする） ─── */
const hexRgb = (x) => { let s = x.replace('#', ''); if (s.length === 3) s = s.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)); };
const rgbHex = (c) => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const unlin = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export const ratio = (a, b) => { const x = lum(hexRgb(a)), y = lum(hexRgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (top, alpha, under) => { const t = hexRgb(top), u = hexRgb(under); return rgbHex(t.map((v, i) => v * alpha + u[i] * (1 - alpha))); };
function oklab(c) {
  const [r, g, b] = c.map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function fromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s].map(unlin);
}
/* 同じ色合いのまま、明るさだけを下げていき、ok(候補) が真になった最初の色（色域の外に出たら彩度を少しずつ落とす） */
function darkenUntil(hex, ok) {
  if (ok(hex.toLowerCase())) return hex.toLowerCase();
  const [L0, a0, b0] = oklab(hexRgb(hex));
  const C0 = Math.hypot(a0, b0), h = Math.atan2(b0, a0);
  for (let L = L0; L > 0; L -= 0.004) {
    let C = C0, rgb;
    for (;;) { rgb = fromOklab([L, C * Math.cos(h), C * Math.sin(h)]); if (rgb.every(v => v >= -0.5 && v <= 255.5) || C < 1e-4) break; C *= 0.97; }
    const cand = rgbHex(rgb);
    if (ok(cand)) return cand;
  }
  return '#000000';
}
const HERO = '#e5ebf7';                     /* 明るい色のヒーローの帯でいちばん濃い所（上端・青を 7% 敷いた所） */
const TARGET = 4.6;
/* 白い字が乗るボタンの地：白と 4.6:1 */
export const bgForWhite = (hex) => darkenUntil(hex, c => ratio('#ffffff', c) >= TARGET);
/* サイトの色（会社の色ではない）は、airline-base.css が明るい面で使う色にそろえる */
const SITE = { '#3d9bff': '#1d4ed8', '#5fb0ff': '#1d4ed8', '#f5c842': '#7a5800', '#fb923c': '#a8380a' };
/* 背景の宣言（#rgb・#rrggbb・#rrggbbaa・rgba()）→ [色, 濃さ]。読めなければ null */
function bgOf(v) {
  if (!v) return null;
  let m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (m) { const s = m[1]; return s.length === 8 ? ['#' + s.slice(0, 6), parseInt(s.slice(6), 16) / 255] : ['#' + s, 1]; }
  m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  return m ? [rgbHex([+m[1], +m[2], +m[3]]), m[4] == null ? 1 : +m[4]] : null;
}
/* 暗い色の画面のために置いた、暗い色を半分透かした地（明るい面では灰色の板に見える）→ 明るい面ではその会社の色を薄く敷く */
const darkPlate = (b) => !!b && lum(hexRgb(b[0])) < 0.05 && b[1] >= 0.25;
const tint = (x) => { const [r, g, b] = hexRgb(x); return `rgba(${r},${g},${b},.12)`; };
/* 字が乗る面（明るい面）：自分の地が在ればそれを帯の色の上に重ねたもの、無ければ帯の色 */
const under = (x, b) => (b && !darkPlate(b) ? mix(b[0], b[1], HERO) : darkPlate(b) ? mix(x, 0.12, HERO) : HERO);
/* 明るい面で使う色：サイトの色 → airline-base.css が既に持つ色 → 同じ色合いの濃い色（どの面の上でも 4.6:1 になるまで） */
const readsOn = (refs) => (c) => refs.every(r => ratio(c, r) >= TARGET);
const inkOf = (x, shared, refs) => [SITE[x], shared[x]].find(c => c && readsOn(refs)(c)) || darkenUntil(x, readsOn(refs));

/* airline-base.css が既に明るい面で直している style="color:#…" と、その色 */
export function sharedInline() {
  const css = fs.readFileSync(path.join(ROOT, 'airlines/airline-base.css'), 'utf8');
  const map = {};
  for (const m of css.matchAll(/\[data-theme="light"\] \[style(?:\*|\^)="color:(#[0-9a-f]{3,6})"(?: i)?\][^{]*\{color:(#[0-9a-f]{3,6})!important\}/gi)) map[m[1].toLowerCase()] = m[2].toLowerCase();
  return map;
}
const SHARED_TAGS = new Set(['tag-blue', 'tag-gold', 'tag-green', 'tag-gray', 'tag-orange', 'tag-red']);
const decl = (d, p) => { const m = d.match(new RegExp('(?:^|;)\\s*' + p + '\\s*:\\s*([^;!]+)', 'i')); return m ? m[1].trim() : null; };

/* ── ② 1ページ分の明るい色の行 ─────────────────────────────── */
export function lightRules(h, shared) {
  const rules = [];
  const head = h.slice(0, h.indexOf('</head>'));
  const body = h.slice(h.indexOf('<body'));
  /* (a) style="…color:#…"（同じ style に地の色が在れば、字はその上に乗る） */
  const hexes = new Map(), plates = new Map();
  for (const m of body.matchAll(/\sstyle="([^"]*)"/g)) {
    for (const c of m[1].matchAll(/(?:^|;)color:(#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?)(?=;|$)/g)) {
      const x = c[1].toLowerCase(), bgd = decl(m[1], 'background(?:-color)?'), b = bgOf(bgd);
      if (!hexes.has(x)) hexes.set(x, new Set([HERO]));
      hexes.get(x).add(under(x, b));
      if (darkPlate(b)) plates.set(`${bgd}|${c[1]}`, x);
    }
  }
  for (const x of [...hexes.keys()].sort()) {
    const refs = [...hexes.get(x)];
    if (readsOn(refs)(shared[x] || x)) continue;
    const sel = [`[style="color:${x}" i]`, `[style^="color:${x};" i]`, `[style*=";color:${x};" i]`, `[style$=";color:${x}" i]`].map(s => '[data-theme="light"] ' + s).join(',');
    rules.push(`${sel}{color:${inkOf(x, shared, refs)}!important}`);
  }
  for (const k of [...plates.keys()].sort()) {
    const [bgd, lit] = k.split('|');
    rules.push(`[data-theme="light"] [style*="${bgd}" i][style*="color:${lit}" i]{background:${tint(plates.get(k))}!important}`);
  }
  /* (b)(c) ページの <style> */
  const css = [...head.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].filter(m => !/data-pv-light/.test(m[0].slice(0, 40))).map(m => m[1].replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
  const last = {};
  for (const r of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const sel = r[1].trim(), d = r[2];
    for (const one of sel.split(',').map(x => x.trim())) {
      if (!/^\.(section-badge|tag-[a-z0-9-]+|btn-primary(?::hover)?)$/.test(one)) continue;
      const c = (decl(d, 'color') || '').match(/^#[0-9a-f]{3,6}$/i);
      const bg = decl(d, 'background(?:-color)?');
      const was = last[one] || {};
      last[one] = { c: c ? c[0].toLowerCase() : was.c, bg: bgOf(bg) ? bg : was.bg };
    }
  }
  for (const one of Object.keys(last).sort()) {
    const { c, bg } = last[one], b = bgOf(bg);
    if (/^\.btn-primary/.test(one)) {
      if (b && b[1] === 1 && ratio('#ffffff', b[0]) < TARGET) rules.push(`[data-theme="light"] ${one}{background:${bgForWhite(b[0])}!important}`);
      continue;
    }
    if (!c || (one.startsWith('.tag-') && SHARED_TAGS.has(one.slice(1)))) continue;
    const refs = [HERO, under(c, b), mix(c, 0.13, HERO)];
    const plate = darkPlate(b);
    if (!plate && readsOn(refs)(c)) continue;
    rules.push(`[data-theme="light"] ${one}{${plate ? `background:${tint(c)}!important;` : ''}color:${inkOf(c, shared, refs)}!important}`);
  }
  return rules;
}
const NOTE = {
  ja: '/* PV-LIGHT: 明るい色の画面で、この会社の色の字を同じ色合いの読める濃さにする（暗い色の画面には効かない）。patch-airline-pages.mjs が書く・手で直さない。 */',
  en: '/* PV-LIGHT: on the light theme, this airline\'s colours are drawn in a darker shade of the same hue so the text stays readable (no effect on the dark theme). Written by patch-airline-pages.mjs - do not edit by hand. */',
};
const BLOCK_RE = /\n?<style data-pv-light>[\s\S]*?<\/style>/;
export function withLight(h, rel, shared) {
  const m = h.match(BLOCK_RE);
  if (m) h = h.slice(0, m.index) + h.slice(m.index + m[0].length);
  const rules = lightRules(h, shared);
  if (!rules.length) return h;
  const block = '\n<style data-pv-light>' + NOTE[rel.startsWith('en/') ? 'en' : 'ja'] + '\n' + rules.join('\n') + '\n</style>';
  /* 置き場所：左メニューの <link> の塊（PV-NAV）の前。主要5枚は、gen-airline-glance.mjs の部品の塊（PV-GLANCE-HEAD）の前
     （あちらも「PV-NAV の直前」に置き直すので、こちらがその前に居れば、どちらを先に流しても同じページになる）。 */
  const end = h.indexOf('</head>');
  const glance = h.lastIndexOf('<!--PV-GLANCE-HEAD-->', end);
  const nav = glance >= 0 ? glance : h.lastIndexOf('<!-- PV-NAV:', end);
  let at = nav >= 0 ? h.lastIndexOf('\n', nav) : h.lastIndexOf('\n', end);
  if (at < 0) at = end;
  return h.slice(0, at) + block + h.slice(at);
}

/* ── ③ airline-base.js の指紋 ─────────────────────────────────── */
export const baseStamp = () => createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'airlines/airline-base.js'))).digest('hex').slice(0, 8);
export function withStamp(h, stamp) {
  const parts = h.split(/(<script src="airline-base\.js(?:\?v=[0-9a-z]+)?"><\/script>)/);
  return parts.map((p, i) => (i % 2 ? `<script src="airline-base.js?v=${stamp}"></script>` : p)).join('');
}

/* ── 実行 ───────────────────────────────────────────────────── */
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const shared = sharedInline();
  const problems = [];
  let changed = 0, back = 0, light = 0, stamped = 0;
  const pages = companyPages(), stamp = baseStamp();
  for (const rel of pages) {
    const file = path.join(ROOT, rel);
    const h0 = fs.readFileSync(file, 'utf8');
    const h1 = dropBack(h0, rel, problems);
    const hs = withStamp(h1, stamp);
    const h2 = withLight(hs, rel, shared);
    if (h1 !== h0) back++;
    if (hs !== h1) stamped++;
    if (h2 !== hs) light++;
    if (h2 === h0) continue;
    changed++;
    if (CHECK) { console.log(`✗ ${rel} — ${[h1 !== h0 && '上の帯に戻るリンクが残っている', hs !== h1 && 'airline-base.js の指紋が古い', h2 !== hs && '明るい色の行が古い'].filter(Boolean).join('・')}`); continue; }
    fs.writeFileSync(file, h2);
  }
  for (const p of problems) console.log('⚠️ ' + p);
  if (CHECK) {
    console.log(changed ? `✗ 会社ページ ${pages.length}枚のうち ${changed}枚が食い違っている（node patch-airline-pages.mjs で直す）` : `✓ 変更なし（会社ページ ${pages.length}枚）`);
    process.exit(changed || problems.length ? 1 : 0);
  }
  console.log(changed ? `✎ 会社ページ ${pages.length}枚のうち ${changed}枚を書き直した（上の帯の戻るリンク ${back}枚・airline-base.js の指紋 ${stamped}枚・明るい色の行 ${light}枚）` : `✓ 変更なし（会社ページ ${pages.length}枚）`);
  if (problems.length) process.exit(1);
}
