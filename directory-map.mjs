/* ════════════════════════════════════════════════════════════════
   directory-map.mjs ── 航空会社一覧の地図（8つの地域の形・名前の札・凡例）と、地域のまとめのカードの HTML を作る（段階5・地図の区域）。
   mapBox() と toneOf() は DM1（見本の絵 import-world-outline.mjs --sketch が呼ぶ）。WP-dmap-2 から mapSection()（gen-directory.mjs の
   PV-DIRMAP の中身 ＝ 9枚のカード：すべて ＋ 8地域）と axisOf()。地図の箱をページに入れるのは WP-dmap-4（オーナーが選んだ点の地図・P12.100）。

   ★ カードの額は地域の推定年収の平均（directory-model.mjs の regionMean ＝ 掲載している会社の推定の平均）と、
     その職位の「散らばり」（P12.101：1社に1つの点・いちばん低い会社からいちばん高い会社までの帯・平均の印・最低／最高の額と会社・幅）。
     どの額も o.bake() を通す（英語のページはドルの span に焼く）。属性に額を書かない。
   ★ 帯の目盛の右端は axisOf() の1か所（会社ページと同じ決め方 ＝ pv-airline-view.mjs の scaleTop。決まった上限は持たない ── P12.104）。
   ★ 社名は2つの <ul> の <li> の中だけ（条件/出典の「対象」と、最低／最高の会社）。その <li> に職位の語を入れない
     （check-salary.mjs は社名から職位の語と額へ跨いで読む。</li> を跨いだ読みは捨てる ── 社名を <li> に閉じ込めれば、地域の額を会社の額と読まない）。
   ★ 字はこのファイルの WORDS の1か所（日本語はオーナーの字・英語はリードが採った候補）。

   ★ 形は world-outline.mjs（生成物。import-world-outline.mjs が書く）から読む。ここで形を作らない・直さない。
   ★ 緑の濃さの段は toneOf() の1か所：段 k ＝ min(AX/1000 − 1, floor(地域の機長の推定年収の平均 / 1000))。
     0〜AX の共通の目盛を 1,000万円ごとに切った帯で、額が段を決める（地域どうしの順位では決めない）。
   ★ <path> に fill / stroke / style を書かない。段のクラスは地域の <g> に付けて、path が受け継ぐ（D10 の塗りの決まり）。
     外枠（<use>）は全部、いちばん上の <g class="wam-ol"> に入れる（あとから塗る地域に外枠の半分が隠れないように）。
   ★ 名前・凡例の文は呼び手が渡す（ここに文言を持たない）。名前は HTML のまま入る。
   ★ 文字列の置き換えは関数形だけ（CLAUDE.md）。
   ════════════════════════════════════════════════════════════════ */
import { SHAPES, LABELS, JAPAN_MARK } from './world-outline.mjs';
import { widthOf } from './pv-bars.mjs';
import { scaleTop } from './pv-airline-view.mjs';

/** 塗る順（あとのものが上）。日本はいちばん上の地域 */
export const PAINT = ['us', 'latam', 'europe', 'africa', 'mideast', 'asia', 'oceania', 'japan'];
/** 段の数 ＝ 目盛の端 AX / 1000（いまは ¥7,000万 → 7）。pv-directory.css の .wam-t0 … と凡例の四角の数もこれ。AX が変われば M20 が赤くなる */
export const STEPS = 7;

/** 地域の機長の推定年収の平均（万円）→ 緑の段 k。分からない額（null・数でない）を 0 段にしない＝止まる */
export function toneOf(man, AX) {
  if (!Number.isInteger(AX) || AX <= 0 || AX % 1000 !== 0) throw new Error(`toneOf：目盛の端「${AX}」が 1,000万円の倍数でない`);
  if (typeof man !== 'number' || !Number.isFinite(man) || man < 0) throw new Error(`toneOf：額「${man}」`);
  return Math.min(AX / 1000 - 1, Math.floor(man / 1000));
}

/**
 * 地図の列（地図の箱＋凡例）。
 *   names  { 地域: 名前の HTML }（8つ全部）
 *   tones  { 地域: 段 k }（8つ全部・0〜STEPS−1。toneOf() の答え）
 *   key    凡例の文
 *   on     選んだ地域（外枠を濃く）・hot 指している地域（外枠を薄く）── 見本の絵だけが渡す。ページのブロックはどちらも無しで書く
 *   id     null のとき id="wa-map" を書かない（見本の絵のように、1枚に何枚も並べるとき）
 *   uid    <use> が指す id の後ろに付ける字（1枚に何枚も並べるとき、id がぶつからないように）
 */
export function mapBox(o) {
  const u = o.uid ?? '';
  for (const r of PAINT) {
    if (typeof o.names?.[r] !== 'string' || !o.names[r]) throw new Error(`mapBox：${r} の名前が無い`);
    if (!Number.isInteger(o.tones?.[r]) || o.tones[r] < 0 || o.tones[r] >= STEPS) throw new Error(`mapBox：${r} の段「${o.tones?.[r]}」`);
  }
  if (typeof o.key !== 'string' || !o.key) throw new Error('mapBox：凡例の文が無い');
  for (const k of ['on', 'hot']) if (o[k] != null && !PAINT.includes(o[k])) throw new Error(`mapBox：${k}「${o[k]}」`);
  const st = r => (o.on === r ? ' is-on' : '') + (o.hot === r ? ' is-hot' : '');
  const J = JAPAN_MARK;
  const L = [];
  L.push('<div class="wam-mc">');
  L.push(`<div class="wam-map"${o.id === null ? '' : ' id="wa-map"'}>`);
  L.push('<svg class="wam-svg" viewBox="0 0 1000 440" aria-hidden="true" focusable="false">');
  /* 日本の当たりの丸を先に置く：あとから塗るロシアの陸地（サハリン）とアジアの陸地（朝鮮半島・中国の海岸・台湾）が上に来て、それぞれの答えを持つ */
  L.push(`<circle class="wam-hit wam-hit-t" data-region="japan" cx="${J.cx}" cy="${J.cy}" r="${J.rTouch}"/>`);
  L.push(`<circle class="wam-hit" data-region="japan" cx="${J.cx}" cy="${J.cy}" r="${J.rHit}"/>`);
  L.push(`<path class="wam-nl" d="${SHAPES.neutral}"/>`);
  for (const r of PAINT) L.push(`<g class="wam-r wam-t${o.tones[r]}${st(r)}" data-region="${r}"><path class="wam-land" id="wam-d-${r}${u}" d="${SHAPES[r]}"/></g>`);
  L.push('<g class="wam-ol">');
  for (const r of PAINT) {
    const ring = r === 'japan' ? `<circle class="wam-ring" cx="${J.cx}" cy="${J.cy}" r="${J.rRing}"/>` : '';
    L.push(`<g class="wam-o${st(r)}" data-region="${r}"><use class="wam-halo" href="#wam-d-${r}${u}"/><use class="wam-lit" href="#wam-d-${r}${u}"/>${ring}</g>`);
  }
  L.push('</g>');
  L.push('</svg>');
  for (const r of PAINT) {
    const p = LABELS[r];
    L.push(`<span class="wam-lbl${p.left ? ' wam-lbl-l' : ''}${st(r)}" data-region="${r}" style="left:${p.x.toFixed(1)}%;top:${p.y.toFixed(1)}%">${o.names[r]}</span>`);
  }
  L.push('</div>');
  const sw = Array.from({ length: STEPS }, (_, k) => `<rect class="wam-t${k}" x="${k * 10}" y="0" width="10" height="10"/>`).join('');
  L.push(`<p class="wam-key" aria-hidden="true"><svg class="wam-sw" viewBox="0 0 ${STEPS * 10} 10" focusable="false">${sw}</svg><span>${o.key}</span></p>`);
  L.push('</div>');
  return L.join('\n');
}

/* ── 地域のまとめのカード（WP-dmap-2）────────────────────────────────────────── */

/** 狭い画面（区域の幅 700px 未満）で、地域を指す・選ぶ前からカードが場所を取るか（P7.4・D27）。
    'none' ＝ 取らない（出荷はこれ）／'card' ＝ いつも出す。区域の data-rest に書く */
export const NARROW_REST = 'none';

/** 職位（この順で2行。帯は選んだ職位の1本を見せる ── 区域の data-pos。出荷は機長） */
const POS = ['cap', 'fo'];

/** カードの字（★ここ1か所）。日本語 ＝ オーナーの字（D18）と P12.101 の「最低」「最高」「幅」。
    英語 ＝ リードが採った候補（P12.86-3：C-1〜C-5・C-7・C-9。職位は directory-model.mjs の札と同じ C2）と、
    P12.101 の3語の英語 Lowest / Highest / Range（リード P12.109 で採用）。
    「機長｜副操縦士」の切り替え（P12.100）の2つのボタンの字は、行の札と同じ rank の字（新しい字を作らない） */
const WORDS = {
  ja: {
    all: 'すべて', k: '公開情報からの推定', def: (n) => `掲載${n}社の推定年収の平均`, rank: { cap: '機長', fo: '副操縦士' },
    cond: '条件/出典', who: '対象', count: '対象掲載社数', countN: (n) => `${n}社`, fx: '換算', go: 'この地域の航空会社を見る',
    lo: '最低', hi: '最高', span: '幅', regionN: (l, n) => `${l} ${n}社`,
  },
  en: {
    all: 'All', k: 'Estimate from public information', def: (n) => `Mean of our estimates across ${n} airlines`, rank: { cap: 'Captain', fo: 'First Officer' },
    cond: 'Conditions / Sources', who: 'Airlines included', count: 'Number of airlines', countN: (n) => `${n}`, fx: 'Conversion', go: 'View airlines in this region',
    lo: 'Lowest', hi: 'Highest', span: 'Range', regionN: (l, n) => `${l} ${n}`,
  },
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * 帯の目盛の右端（万円・職位ごと）。会社ページと同じ決め方 ＝ pv-airline-view.mjs の scaleTop（描く額のいちばん大きいものを、
 * 次の 1,000万の刻みへ切り上げる。決まった上限は持たない ── P12.104「MAX7000万はおかしい」）。
 * 数えるのは、帯が描く額だけ ＝ 掲載している全社のその職位の推定年収（avg。最低・最高・平均もこの中の額）。幅の上の額（hi）は
 * 帯に描かないので数えない（リード P12.109）。すべて ＋ 8地域で1本（地域どうしの帯の長さを比べられるように）。
 * 台帳の額が動けば目盛も動く。会員の額を帯にする日（地域のまとめの下の段・05b）は、その額もここへ数える。
 *   ledger ＝ salary-data.mjs の SALARY（呼び手が渡す。このファイルは年収の台帳を import しない）
 */
export const axisOf = (ledger, rank) => scaleTop(Object.values(ledger).map((d) => d[rank].avg));

/**
 * PV-DIRMAP の中身（gen-directory.mjs が両方のページに書く）。
 *   o = { lang, M（directory-model.mjs の model()）, ledger（SALARY）, regionMean(code, rank), bake(text) → string, fxNote（換算の文）, show }
 *   show 'card' ＝ カードだけ（地図の箱は WP-dmap-4 で入る。ほかの値はまだ作らない＝止まる）
 * 9枚のカード（すべて ＋ 8地域。すべてだけ is-shown）は1つの升に重ねる（高さが入れ替わらない）。台本なしでは9枚とも縦に並び、
 * 帯は機長と副操縦士の2本とも見える（<noscript> の規則）。#pv-rp は地域のまとめの下の段（05b）が入る口 ── ここは何も書かない。
 * 「機長｜副操縦士」の切り替え（.wam-pos・P12.100）は hidden で出荷する。台本（pv-directory.js）が動いたときだけ見せる
 * （押しても何も起きないボタンを出さない）。押した方が区域の data-pos を決める（行の大きさ・見せる帯 ── 地図の色は WP-dmap-4）。
 */
export function mapSection(o) {
  const W = WORDS[o.lang];
  if (!W) throw new Error(`mapSection：知らない言語「${o.lang}」`);
  if (o.show !== 'card') throw new Error(`mapSection：show「${o.show}」（地図の箱は WP-dmap-4 で入る）`);
  if (typeof o.fxNote !== 'string' || !o.fxNote) throw new Error('mapSection：換算の文が無い');
  const M = o.M, yen = (m) => o.bake(`¥${m.toLocaleString('en-US')}万`);
  const AX = Object.fromEntries(POS.map((r) => [r, axisOf(o.ledger, r)]));
  const at = (v, ax) => { const w = widthOf(v, ax); if (w === null || v > ax) throw new Error(`mapSection：額 ${v} が帯（0〜${ax}）に載らない`); return w; };
  const meanOf = (g, r) => { const m = o.regionMean(g.code, r); if (!(typeof m === 'number' && m > 0)) throw new Error(`mapSection：${g.code} ${r} の平均「${m}」`); return m; };
  const groups = [{ code: 'all', label: W.all, slugs: M.slugs, n: M.n },
    ...M.regions.map((r) => ({ code: r.code, label: r[o.lang], slugs: r.slugs, n: r.n }))];

  /* その職位の散らばり：1社に1つの点（安い順）・最低〜最高の帯・平均の印・最低／最高の額と会社（同じ額の会社は全部）・幅 */
  const spread = (g, r) => {
    const ax = AX[r], vals = g.slugs.map((s) => ({ s, v: M.airlines[s][r].est.man }));
    if (!vals.length) throw new Error(`mapSection：${g.code} に会社が無い`);
    for (const x of vals) if (!(typeof x.v === 'number' && x.v > 0)) throw new Error(`mapSection：${x.s} ${r} の推定「${x.v}」`);
    const lo = Math.min(...vals.map((x) => x.v)), hi = Math.max(...vals.map((x) => x.v));
    /* 社名はカードの「対象」と同じ出どころ（一覧のカードの社名 ＝ show）。1枚のカードの中で1社を2通りに書かない（リード P12.109） */
    const who = (v) => `<ul class="wam-who">${vals.filter((x) => x.v === v).map((x) => `<li>${esc(M.airlines[x.s].show[o.lang])}</li>`).join('')}</ul>`;
    /* 点は class を持たない <i>（1地域に最大112個 × 2職位 × 2回 ── 字数を食わないように。見た目は .wam-track > i） */
    const dots = vals.slice().sort((a, b) => a.v - b.v).map((x) => `<i style="left:${at(x.v, ax)}"></i>`).join('');
    return [
      `<div class="wam-sp" data-pos="${r}">`,
      `<p class="wam-sp-rk">${esc(W.rank[r])}</p>`,
      `<div class="wam-track" style="--wam-n:${ax / 1000}" aria-hidden="true"><i class="wam-band" style="--a:${at(lo, ax)};--b:${at(hi, ax)}"></i>${dots}<i class="wam-mean" style="left:${at(meanOf(g, r), ax)}"></i></div>`,
      `<p class="wam-ax" aria-hidden="true"><span>0</span><span>${yen(ax)}</span></p>`,
      '<div class="wam-mm">',
      `<div class="wam-lo"><span class="wam-mm-k">${esc(W.lo)}</span><b class="wam-mm-v">${yen(lo)}</b>${who(lo)}</div>`,
      `<div class="wam-hi"><span class="wam-mm-k">${esc(W.hi)}</span><b class="wam-mm-v">${yen(hi)}</b>${who(hi)}</div>`,
      '</div>',
      `<p class="wam-w"><span class="wam-w-k">${esc(W.span)}</span><b class="wam-w-v">${yen(hi - lo)}</b></p>`,
      '</div>',
    ].join('\n');
  };

  const panel = (g) => {
    const names = g.code === 'all'
      ? M.regions.map((r) => `<li>${esc(W.regionN(r[o.lang], r.n))}</li>`)
      : g.slugs.map((s) => `<li>${esc(M.airlines[s].show[o.lang])}</li>`);
    return [
      `<section class="wam-panel${g.code === 'all' ? ' is-shown' : ''}" data-region="${g.code}" id="wam-p-${g.code}">`,
      `<h2 class="wam-h">${esc(g.label)}</h2>`,
      `<div class="wam-est" id="wam-f-${g.code}">`,
      `<p class="wam-k">${esc(W.k)}</p>`,
      `<p class="wam-def">${esc(W.def(g.n))}</p>`,
      ...POS.map((r) => `<p class="wam-row" data-pos="${r}"><span class="wam-rk">${esc(W.rank[r])}</span><b class="wam-n">${yen(meanOf(g, r))}</b></p>`),
      '</div>',
      '<div class="wam-sps">',
      ...POS.map((r) => spread(g, r)),
      '</div>',
      '<details class="wam-cond">',
      `<summary>${esc(W.cond)}</summary>`,
      '<dl class="wam-cl">',
      `<div><dt>${esc(W.who)}</dt><dd><ul class="wam-names">${names.join('')}</ul></dd></div>`,
      `<div><dt>${esc(W.count)}</dt><dd>${esc(W.countN(g.n))}</dd></div>`,
      `<div><dt>${esc(W.fx)}</dt><dd>${esc(o.fxNote)}</dd></div>`,
      '</dl>',
      '</details>',
      '</section>',
    ].join('\n');
  };

  return [
    `<div class="wam" id="wa-map-sec" data-rest="${NARROW_REST}" data-pos="cap">`,
    '<noscript><style>.wam-map,.wam-go,.wam-slot{display:none!important}.wam-card{display:flex!important}.wam-panel{visibility:visible!important;grid-area:auto!important}.wam-sp{visibility:inherit!important;grid-area:auto!important}.wam-sp-rk{display:block!important}</style></noscript>',
    '<div class="wam-g">',
    '<aside class="wam-card" id="wa-sum">',
    `<div class="wam-pos" role="group" hidden>${POS.map((r) => `<button type="button" class="wam-pb" data-pos="${r}" aria-pressed="${r === 'cap'}">${esc(W.rank[r])}</button>`).join('')}</div>`,
    '<div class="wam-cols">',
    '<div class="wam-panels">',
    ...groups.map(panel),
    '</div>',
    `<div class="wam-slot"><div id="pv-rp" class="pv-rp" data-axis-jpy="${Math.max(AX.cap, AX.fo) * 10000}" hidden></div></div>`,
    '</div>',
    `<button type="button" class="wam-go is-off" id="wa-go">${esc(W.go)}</button>`,
    '</aside>',
    '</div>',
    '</div>',
  ].join('\n');
}
