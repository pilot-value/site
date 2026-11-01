#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   gen-lp-compare.mjs — トップ（index.html・en/index.html）の「世界の航空会社を比較できる」の
   電話の中身 ＝ 本物の2社比較の画面のスライド（2026-11-01）

   なぜ
     オーナー「比較の画面とかが実際に即していない」「比較の画面はスライドできる（クリックしたらその比較画面になる）」
     「1枚目 JAL・ANA、次はエミレーツ・ユナイテッド、次は任せる（比較的データが多い外資どうし）」。
     3枚目はキャセイパシフィック × エティハド航空（2026-11-01 の本番で、外資のうち給与の提出がいちばん多い2社）。

   何をするか
     本物の比較の画面（career.html・en/career.html ── gen-career.mjs が書く）を読み、その組の
       社名・略号かロゴ・写真・「年収」の板（機長と副操縦士の額・目盛・税の扱い）・写真のクレジット
     を写して、トップの <!--PV-LPCMP-->…<!--/PV-LPCMP--> の中に書く。
     ★額も字も作らない。比較の画面に出ているものをそのまま写す ＝ トップと比較の画面が食い違わない。
     ★英語は、写した円の額をドルの span に焼いてから入れる（gen-career.mjs と同じ bakeHtml）。
       あとで bake-en-currency.mjs を流しても1文字も変わらない。
     ★棒の長さは比較の画面と同じ決め方（2社で1本の目盛 ＝ 2社の data-scale の大きいほう・pv-airline-view.mjs の width）。

   いつ流すか
     career.html を作り直したあと（年収・社名・写真の台帳を直したとき）。gen-career.mjs → gen-lp-compare.mjs の順。
     流し忘れは assert-generated.mjs が捕まえる（HEAD の写しの中で流して、差分が出たら落ちる）。

   使い方
     node gen-lp-compare.mjs           書く
     node gen-lp-compare.mjs --check   差分があれば落ちる（書かない）

   ⚠️ 組を替えるときは PAIRS だけ直す。写真の無い会社は、比較の画面と同じくロゴの札で出る。
   ⚠️ 推定でない額（会社の公表など ── 比較の画面の行に data-kind が付く）が入った組はまだ描けない ＝ ここで止まる。
   ══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unbake, curCore, bakeHtml } from './cur-core.mjs';
import { width } from './pv-airline-view.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

/* 並びはオーナーの指定どおり（1枚目 JAL × ANA・2枚目 エミレーツ × ユナイテッド）。 */
export const PAIRS = [['jal', 'ana'], ['emirates', 'united'], ['cathay-pacific', 'etihad']];

const PAGES = [
  { lang: 'ja', lp: 'index.html', career: 'career.html', up: '' },
  { lang: 'en', lp: 'en/index.html', career: 'en/career.html', up: '../' },
];
const OPEN = '<!--PV-LPCMP-->', CLOSE = '<!--/PV-LPCMP-->';

/* トップにしか無い字（比較の画面には無いもの）。送るボタンと、スライドの読み上げ。 */
const W = {
  ja: { prev: '前の比較', next: '次の比較', nav: '比較の画面の見本', open: (a, b) => `比較の画面を開く：${a}と${b}`, x: ' × ' },
  en: { prev: 'Previous comparison', next: 'Next comparison', nav: 'Comparison screen preview', open: (a, b) => `Open the comparison: ${a} and ${b}`, x: ' × ' },
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function must(m, what) { if (!m) throw new Error(`比較の画面（career.html）から読めない ── ${what}`); return m; }

/* 比較の画面の1言語ぶんを読む。 */
function readCareer(file, lang) {
  let html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (lang === 'en') html = unbake(html);   // 英語はドルの span を元の円の字に戻して読む（data-orig）
  const a = html.indexOf('<section class="cr-view cr-cmp" data-view="compare"');
  if (a < 0) must(null, '比較の段');
  const sec = html.slice(a, html.indexOf('</section>', a));
  const isle = JSON.parse(must(html.match(/<script type="application\/json" id="crc-data">([\s\S]*?)<\/script>/), 'カードの島（#crc-data）')[1]).airlines;
  const word = {
    back: must(sec.match(/<a class="cr-back" id="cr-back"[^>]*>(?:<svg[\s\S]*?<\/svg>)?([^<]+)<\/a>/), '「航空会社を選ぶ」')[1],
    h1: must(sec.match(/<h1 class="cr-h1 cr-cmp-h"[^>]*>([^<]+)<\/h1>/), '見出し')[1],
    pay: must(sec.match(/<h2 class="cr-panel-h" id="cr-cmp-h-pay">([^<]+)<\/h2>/), '「年収」')[1],
    tgt: must(sec.match(/<p class="cr-tgt"><span class="cr-tgt-k">([^<]+)<\/span><span>([^<]+)<\/span><\/p>/), '「推定年収　機種の指定なし」').slice(1, 3),
    roles: [...sec.matchAll(/<h3 class="cr-role">([^<]+)<\/h3>\s*<div class="cr-pair" data-role="(cap|fo)">/g)].map(m => [m[2], m[1]]),
    go: must(sec.match(/<span class="cr-go-t">([^<]+)<\/span>/), '「詳しく」')[1],
    real: must(sec.match(/<h2 class="cr-h2">([^<]+)<span class="cr-h2-s" lang="en">([^<]+)<\/span><\/h2>/), '「提出された年収 REAL PAY」').slice(1, 3),
    photos: must(sec.match(/<p class="cr-credits"><span data-n="1"[^>]*>([^<]+)<\/span><span data-n="2"[^>]*>([^<]+)<\/span>/), 'クレジットの頭').slice(1, 3),
    nearMax: Number(must(sec.match(/data-view="compare" data-near-max="(\d+)"/), '色の近さの線')[1]),
  };
  if (word.roles.map(r => r[0]).join() !== 'cap,fo') throw new Error('比較の画面の職位の並びが「機長・副操縦士」でない');
  /* 1社ぶん。 */
  function air(slug) {
    const rows = {};
    for (const [rank] of word.roles) {
      const p0 = sec.indexOf(`<div class="cr-pair" data-role="${rank}">`);
      const pair = sec.slice(p0, sec.indexOf('<h3 class="cr-role">', p0 + 1) > 0 ? sec.indexOf('<h3 class="cr-role">', p0 + 1) : undefined);
      const m = must(pair.match(new RegExp(
        `<div class="cr-row" data-airline="${reEsc(slug)}"([^>]*)>\\s*` +
        `<div class="cr-row-h"><span class="cr-row-co"><i class="cr-dot" aria-hidden="true"></i>([^<]+)</span><span class="cr-vh">([^<]+)</span><b class="cr-row-v">([^<]+)</b></div>\\s*` +
        `<div class="cr-row-k"><span class="cr-tag">([^<]+)</span></div>\\s*` +
        `<div class="cr-track"[^>]*><i class="cr-fill" data-man="(\\d+)"`)), `${slug} の${rank === 'cap' ? '機長' : '副操縦士'}の行`);
      const at = m[1];
      if (/data-kind=/.test(at)) throw new Error(`${slug}: 推定でない額の行がある（このスライドはまだ描けない ── 頭の注を読む）`);
      rows[rank] = {
        name: m[2], vh: m[3], text: m[4], tag: m[5], man: Number(m[6]),
        scale: Number(must(at.match(/data-scale="(\d+)"/), `${slug} の目盛`)[1]),
        color: must(at.match(/--cr-co:(#[0-9A-Fa-f]{6})/), `${slug} の色`)[1],
        lab: (at.match(/data-lab="([-\d ]+)"/) || [])[1] || null,
      };
    }
    if (rows.cap.name !== rows.fo.name || rows.cap.scale !== rows.fo.scale || rows.cap.color !== rows.fo.color) throw new Error(`${slug}: 機長と副操縦士の行で社名・目盛・色が違う`);
    const tax = must(sec.match(new RegExp(`<span class="cr-go cr-ft" data-airline="${reEsc(slug)}" title="([^"]+)"`)), `${slug} の税の扱い`)[1];
    /* 札：先行5社は写真の札（略号）。ほかの会社は比較の画面と同じく、選ぶ面（段の外の <dialog>）のロゴ（写真があれば地に写真）。 */
    const opt = sec.match(new RegExp(`<div class="cr-opt" data-airline="${reEsc(slug)}"[^>]*>\\s*<span class="cr-opt-p">[\\s\\S]*?<span class="cr-code">([^<]+)</span>`));
    const pk = must(html.match(new RegExp(`<button type="button" class="cr-pk" data-airline="${reEsc(slug)}"[^>]*><span class="cr-pk-lg">([\\s\\S]*?)</span><span class="cr-pk-n">([^<]+)</span><span class="cr-pk-c">([^<]+)</span></button>`)), `${slug} の選ぶ面の1行`);
    const logoImg = must(pk[1].match(/<img [^>]*src="([^"]+)"[^>]*width="(\d+)" height="(\d+)"/), `${slug} のロゴ`);
    const ph = (isle[slug] && isle[slug].photos && isle[slug].photos[0]) || null;
    /* クレジット（その会社の札の写真ぶん ── 比較の画面の段にある1社ぶんの span をそのまま）。 */
    const cr = sec.match(new RegExp(`<span class="cr-credit" data-airline="${reEsc(slug)}"(?: hidden)?>([\\s\\S]*?)</span>`));
    return { slug, ...rows.cap, cap: rows.cap, fo: rows.fo, tax, code: opt ? opt[1] : null, pkCode: pk[3],
      logo: { src: logoImg[1], w: Number(logoImg[2]), h: Number(logoImg[3]) }, photo: ph, credit: cr ? cr[1] : null };
  }
  const axis = top => must(sec.match(new RegExp(`<div class="cr-axis" data-scale="${top}" data-div="(\\d+)"[^>]*><span>0</span><span>([^<]+)</span><span>([^<]+)</span></div>`)), `目盛 ${top}`);
  return { word, air, axis };
}

/* 写真は小さい版（480px ── 比較の画面の srcset と同じファイル）。元の写真が在るのに小さい版が無ければ止まる。
   ★元の写真ごと無いとき（assert-generated.mjs の写し ── 画像を展開しない）は確かめない。 */
function small(ph, up) {
  const rel = ph.src.replace(/^(\.\.\/)+/, '');
  const s = rel.replace(/\.jpg$/, '-480.jpg');
  if (fs.existsSync(path.join(ROOT, rel)) && !fs.existsSync(path.join(ROOT, s))) throw new Error(`写真の小さい版が無い ── ${s}`);
  return { src: up + s, w: 480, h: Math.round(ph.h * 480 / ph.w) };
}

const IC = {
  back: '<svg class="lp-cmp-ic" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  down: '<svg class="lp-cmp-ic" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  swap: '<svg class="lp-cmp-ic" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 8h11l-3-3M17 16H6l3 3"/></svg>',
  go: '<svg class="lp-cmp-ic" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  prev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  next: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
};

/* 色の近い2社（比較の画面と同じ決め方 ── 機長の行の data-lab の距離が data-near-max より小さい）。 */
function near(A, B, max) {
  if (!A.lab || !B.lab) return false;
  const a = A.lab.split(' ').map(Number), b = B.lab.split(' ').map(Number);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < max;
}

/* 札の社名と ▾。英語の社名は最後の語と ▾ を離さない（▾ だけが次の行に落ちない）。日本語は語の切れ目が無いのでそのまま。 */
const nameDown = n => {
  const i = n.lastIndexOf(' ');
  return i < 0 ? esc(n) + IC.down : `${esc(n.slice(0, i + 1))}<span class="lp-cmp-nw">${esc(n.slice(i + 1))}${IC.down}</span>`;
};

function tile(A, side, up) {
  const ph = A.photo ? small(A.photo, up) : null;
  const img = ph ? `<img src="${esc(ph.src)}" width="${ph.w}" height="${ph.h}" alt="" loading="lazy" decoding="async"/>` : '';
  const chip = A.code
    ? `<span class="lp-cmp-code">${esc(A.code)}</span>`
    : `<span class="lp-cmp-lg"><img src="${esc(up + A.logo.src.replace(/^(\.\.\/)+/, ''))}" width="${A.logo.w}" height="${A.logo.h}" alt="" loading="lazy" decoding="async"/></span>`;
  return `<span class="lp-cmp-side" data-side="${side}" style="--co:${A.color}"><span class="lp-cmp-p${ph ? ' is-ph' : ''}">${img}${chip}<span class="lp-cmp-n">${nameDown(A.name)}</span></span></span>`;
}

function slide(pg, C, [a, b], i) {
  const A = C.air(a), B = C.air(b), w = C.word;
  const top = Math.max(A.scale, B.scale);
  const ax = C.axis(top);
  const div = Number(ax[1]);
  const row = (X, rank) => `<span class="lp-cmp-row" style="--co:${X.color}"><span class="lp-vh">${esc(X.name)}</span><span class="lp-vh">${esc(X[rank].vh)}</span><b class="lp-cmp-v">${esc(X[rank].text)}</b><span class="lp-cmp-trk" aria-hidden="true"><i style="--w:${width(X[rank].man, top)}"></i></span></span>`;
  const href = `career.html?view=compare&amp;a=${a}&amp;b=${b}`;
  const pairName = `${A.name}${W[pg.lang].x}${B.name}`;
  return `<a class="lp-cmp-s" href="${href}" data-pv-ev="lp_compare_slide" data-pair="${esc(pairName)}" aria-label="${esc(W[pg.lang].open(A.name, B.name))}"${near(A.cap, B.cap, w.nearMax) ? ' data-near' : ''}>
<span class="lp-cmp-back">${IC.back}${esc(w.back)}</span>
<span class="lp-cmp-h">${esc(w.h1)}</span>
<span class="lp-cmp-pick">${tile(A, 'a', pg.up)}<span class="lp-cmp-swap" aria-hidden="true">${IC.swap}</span>${tile(B, 'b', pg.up)}</span>
<span class="lp-cmp-panel" style="--div:${div}">
<span class="lp-cmp-top"><b class="lp-cmp-ph">${esc(w.pay)}</b><span class="lp-cmp-k">${esc(w.tgt[0])}</span><span class="lp-cmp-t">${esc(w.tgt[1])}</span></span>
${w.roles.map(([rank, label]) => `<span class="lp-cmp-role">${esc(label)}</span>
<span class="lp-cmp-pair">${row(A, rank)}${row(B, rank)}</span>`).join('\n')}
<span class="lp-cmp-axes"><span class="lp-cmp-axis"><span>0</span><span>${esc(ax[3])}</span></span><span class="lp-cmp-axis"><span>0</span><span>${esc(ax[3])}</span></span></span>
<span class="lp-cmp-gos">${[A, B].map(X => `<span class="lp-cmp-go" style="--co:${X.color}"><span class="lp-cmp-gt"><i class="lp-cmp-gd" aria-hidden="true"></i>${esc(w.go)}${IC.go}</span><span class="lp-cmp-tx">${esc(X.tax)}</span></span>`).join('')}</span>
</span>
<span class="lp-cmp-next"><b>${esc(w.real[0])}</b><span lang="en">${esc(w.real[1])}</span></span>
</a>`;
}

function block(pg) {
  const C = readCareer(pg.career, pg.lang);
  const T = W[pg.lang];
  const slides = PAIRS.map((p, i) => slide(pg, C, p, i));
  const names = PAIRS.map(([a, b]) => `${C.air(a).name}${T.x}${C.air(b).name}`);
  /* クレジット：写真が条件つきの会社だけ（比較の画面の1社ぶんの span をそのまま）。どのスライドの写真か（data-slide）を付け、
     見えている組のぶんだけ lp.js が出す。最初は1枚目のぶんだけ。 */
  const credits = [];
  PAIRS.forEach(([a, b], i) => [a, b].forEach(s => {
    const X = C.air(s);
    /* 比較の画面の span の中身をそのまま（社名・作者・ライセンス・手直しの断り）。CC0 の写真は比較の画面にも無い ＝ 書かない。 */
    if (X.photo && X.credit) credits.push(`<span class="lp-cmp-cr" data-slide="${i}"${i ? ' hidden' : ''}>${X.credit}</span>`);
  }));
  const first = credits.filter(c => /data-slide="0"/.test(c)).length;
  const head = `<span data-n="1"${first === 1 ? '' : ' hidden'}>${esc(C.word.photos[0])}</span><span data-n="2"${first === 1 ? ' hidden' : ''}>${esc(C.word.photos[1])}</span>`;
  const body = `${OPEN}
<div class="lp-cmp">
<div class="lp-panel lp-air-panel">
<div class="lp-phone">
<div class="lp-phone-scr lp-cmp-scr">
<i class="lp-phone-pill" aria-hidden="true"></i>
<div class="lp-cmp-track" id="lp-cmp-track" aria-label="${esc(T.nav)}">
${slides.join('\n')}
</div>
</div>
</div>
</div>
<div class="lp-cmp-nav" id="lp-cmp-nav">
<button type="button" class="lp-cmp-arw" id="lp-cmp-prev" aria-label="${esc(T.prev)}" disabled>${IC.prev}</button>
<span class="lp-cmp-mid"><span class="lp-cmp-now" id="lp-cmp-now" aria-live="polite">${esc(names[0])}</span><span class="lp-cmp-dots">${names.map((n, i) => `<button type="button" class="lp-cmp-dot" aria-label="${esc(n)}"${i ? '' : ' aria-current="true"'}></button>`).join('')}</span></span>
<button type="button" class="lp-cmp-arw" id="lp-cmp-next" aria-label="${esc(T.next)}">${IC.next}</button>
</div>
${credits.length ? `<p class="lp-cmp-credits" id="lp-cmp-credits">${head} ${credits.join(' ')}</p>` : ''}
</div>
${CLOSE}`;
  return body;
}

export async function render() {
  const C_EN = await curCore('USD', 'en');
  const out = [];
  for (const pg of PAGES) {
    const file = path.join(ROOT, pg.lp);
    const html = fs.readFileSync(file, 'utf8');
    const a = html.indexOf(OPEN), b = html.indexOf(CLOSE);
    if (a < 0 || b < a) throw new Error(`${pg.lp}: ${OPEN} … ${CLOSE} の印が無い`);
    let blk = block(pg);
    if (pg.lang === 'en') blk = bakeHtml(blk, C_EN);
    /* 写真のクレジットの頭（Photo / Photos）は、1枚目の写真の数で決めてある。lp.js が組を替えるたびに選び直す。 */
    const want = html.slice(0, a) + blk + html.slice(b + CLOSE.length);
    out.push({ file, rel: pg.lp, html, want });
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = await render();
  const changed = out.filter(x => x.want !== x.html);
  if (process.argv.includes('--check')) {
    if (changed.length) { console.log(`✗ 古い：${changed.map(x => x.rel).join('・')}（node gen-lp-compare.mjs を流す）`); process.exit(1); }
    console.log('✓ トップの比較のスライドは career.html と同じ');
  } else {
    for (const x of changed) fs.writeFileSync(x.file, x.want);
    console.log(changed.length ? `書いた：${changed.map(x => x.rel).join('・')}` : '変わりなし');
  }
}
