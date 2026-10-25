/* ════════════════════════════════════════════════════════════════
   directory-map.mjs ── 航空会社一覧の地図（点で描く8つの地域・光る層・凡例）と、地域のまとめのカードの HTML を作る（段階5・地図の区域）。
   mapBox()・toneOf()・dotRuns() は地図（見本の絵 import-world-outline.mjs --sketch も呼ぶ）。mapSection() は gen-directory.mjs の
   PV-DIRMAP の中身 ＝ 1枚の面：「機長｜副操縦士」の切り替え・地図・9枚のカード（すべて ＋ 8地域）。WP-dmap-4 で地図が入った
   （オーナーが選んだ「点で描く地図」P12.100・見本 sketch-v4。大陸の名前は地図に書かない P12.99）。

   ★ カードの額は地域の推定年収の平均（directory-model.mjs の regionMean ＝ 掲載している会社の推定の平均）と、
     その職位の「散らばり」（P12.101：1社に1つの点・いちばん低い会社からいちばん高い会社までの帯・平均の印・最低／最高の額と会社・幅）。
     どの額も o.bake() を通す（英語のページはドルの span に焼く）。属性に額を書かない。
   ★ 帯の目盛の右端は axisOf() の1か所（会社ページと同じ決め方 ＝ pv-airline-view.mjs の scaleTop。決まった上限は持たない ── P12.104）。
   ★ 社名は2つの <ul> の <li> の中だけ（条件/出典の「対象」と、最低／最高の会社）。その <li> に職位の語を入れない
     （check-salary.mjs は社名から職位の語と額へ跨いで読む。</li> を跨いだ読みは捨てる ── 社名を <li> に閉じ込めれば、地域の額を会社の額と読まない）。
   ★ 字はこのファイルの WORDS の1か所（日本語はオーナーの字・英語はリードが採った候補）。

   ★ 形は world-outline.mjs（生成物。import-world-outline.mjs が書く）から読む。ここで形を作らない・直さない。
     点はその形から dotRuns() が切り出す（見本 sketch-v4 と同じ格子：横 5.2・縦 5.2 × 0.866 の六角の並び・最初の行は ROW0 ＝ 陸のいちばん北のすぐ下。点の中心が形の中に
     在るところにだけ丸ごと1つの点 ── 縁で半分に切れた点は描かない P12.100）。1つの行の隣り合う点は1本の「M x y h 長さ」に
     まとめ、丸い線端と stroke-dasharray:0 5.2 で点に描く（4,810 個の <circle> にすると 180KB になる）。
   ★ 緑の濃さは toneOf() の1か所：8地域の平均のいちばん低い所 0 〜 いちばん高い所 1 の間で連続（P12.99「色はもっと差をつけて」・
     P12.100 職位ごと）。地域の <g> に --c（機長）と --f（副操縦士）を書き、CSS が区域の data-pos で片方を選んで、緑の淡い方から
     濃い方へ混ぜる（pv-directory.css）。額が濃さを決める（地域どうしの順位では決めない）。台本は濃さに触らない（M15・M20）。
   ★ <path> に fill / stroke / style を書かない。点の見た目は地域の <g> に付けて、path が受け継ぐ（D10 の塗りの決まり。<use> の写しは
     <use> から受け継ぐので、光る層と当たりの層は自分の線を持てる）。光る層（<use>）は全部、いちばん上の <g class="wam-ol"> に入れる。
   ★ 当たり（指す・押す）は点ではなく <g class="wam-hl"> の太い透明な線（点と点のあいだも答える）。日本の丸が先・
     どこにも入れない陸地の透明な線（答えを持たない）がその次・8地域があと（それぞれの陸地が上に来て、自分の答えを持つ）。
   ★ 動かせる地図（WP-dmap-9・オーナー「地図自体を自分で動かせるようにしたい（windy みたいに）」）：svg の層は全部1つの <g class="wam-z"> の中
     （点・当たり・光る層が一緒に動く。動かすのは台本がその transform に書く1か所だけ ── 出荷は1倍 ＝ transform を書かない）。
     地図の枠の右上に 拡大・縮小・元に戻す の丸いボタンの縦の列、まんなかに指の一言（どれも hidden で出荷。台本が動いた時だけ見せる）。
     印は CSS の線だけで描く（地図の塊に2つ目の <svg> を置かない）。字は WORDS の zoom（シートの字）。
     ★WP-dmap-11（オーナー「最初にもう地図どん。windy みたいに」）：ページそのものが地図の画面になったので、全画面のボタンと全画面の「閉じる」は外した
     （シート W3「ページそのものが全画面の地図」）。地図がどう画面を埋めるかは pv-directory.css の wam-stage の塊
     ★WP-dmap-11 の直し（チェッカー：シート W2「カードはスマホでは下から出る板」）：区域 1000px 未満で開いたカードは、地図の下の部分に重なる板
     （地図の枠は動かない）。板の右上に閉じるボタン（.wam-sx・カードの先頭・hidden で出荷）── 字はこのページの比較リストの「閉じる」／Close と同じ
     （新しい字ではない ── gen-directory.mjs の TRAY_WORDS の close）。印は CSS の線（× ）
   ★ 文字列の置き換えは関数形だけ（CLAUDE.md）。
   ════════════════════════════════════════════════════════════════ */
import { SHAPES, JAPAN_MARK } from './world-outline.mjs';
import { widthOf } from './pv-bars.mjs';
import { scaleTop } from './pv-airline-view.mjs';

/** 塗る順（あとのものが上）。日本はいちばん上の地域 */
export const PAINT = ['us', 'latam', 'europe', 'africa', 'mideast', 'asia', 'oceania', 'japan'];
/** 点の格子（見本 sketch-v4 と同じ）：横の間隔・行の間隔（箱の単位。箱は 1000 × 440）。点の大きさは pv-directory.css */
export const GRID = 5.2;
export const ROW = GRID * 0.866;
/** 格子のいちばん上の行の y（箱の単位）＝ 陸のいちばん北（y 3 ＝ グリーンランドの北の端 83.6°N・エルズミーア島 83°N）の 0.4 下。
    ★ WP-dmap-7（オーナー P12.113「地図の上が切れている」）：前は GRID / 2（2.6）＝ どの陸よりも上で、陸に点が乗る最初の行は 7.1（北緯 79.5 度）。
      それより北（グリーンランドとエルズミーア島の北の端など）には点が1つも無く、いちばん上の行が北緯 79.5 度の太い横一列になって
      「上が切り落とされた」ように見えていた。箱は北極まで在り、CSS も viewBox も何も切っていなかった ── 原因は格子の最初の行 */
export const ROW0 = 3.4;
/** 地図の箱（svg の viewBox）。形の箱（1000 × 440）の上に 8 を足し、下の 2 を削る（南は点の無い海だけ）＝ いちばん上といちばん下の点
    （光る層の太さ込み）の外に、上 9.25・下 4.65 の余白。北の陸の上に海が少し見え、上の点が箱の縁に触れない（assert-directory.mjs の M21 が見る）。
    ★ 縦横の比は pv-directory.css の .wam-map の aspect-ratio と同じ数（1000 / 446）にする */
export const VIEWBOX = '0 -8 1000 446';
const r1 = (v) => Math.round(v * 10) / 10;

/** 形（M x y l dx dy … z）→ 輪の点の並び */
function ringsOf(d) {
  return String(d).split('M').filter((s) => s.trim()).map((s) => {
    const n = s.replace(/[lz]/g, () => ' ').match(/-?\d+/g).map(Number), pts = [[n[0], n[1]]];
    for (let i = 2; i + 1 < n.length; i += 2) { const p = pts[pts.length - 1]; pts.push([p[0] + n[i], p[1] + n[i + 1]]); }
    return pts;
  });
}
/** 偶奇の数え方で中か（見本と同じ） */
function inside(rings, px, py) {
  let c = false;
  for (const q of rings) for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const [xi, yi] = q[i], [xj, yj] = q[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/**
 * 形 → 点の列の path の d。行 r（0 から）の y ＝ r1(ROW0 + r × ROW)、その行の点 i の x ＝ r1((r が奇数なら GRID、偶数なら GRID/2) + i × GRID)。
 * 点 ＝ (x, y) が形の中。1つの行で i が続く点を「M{x} {y}h{r1((続く数 − 1) × GRID + 0.1)}」の1本にする
 * （+0.1 は線の終わりの点が丸めの誤差で落ちないための足し。次の点まで GRID 離れているので点は増えない）。
 * assert-directory.mjs の M16 が、このファイルを読まずに同じ決まりで作り直して突き合わせる。
 */
const RUNS = new Map();   // 形の字 → 点の列（同じ形は1回だけ切り出す ── 生成器は1回に何枚も書く）
export function dotRuns(d) {
  if (RUNS.has(d)) return RUNS.get(d);
  const rs = ringsOf(d);
  let out = '';
  for (let r = 0; ; r++) {
    const y = r1(ROW0 + r * ROW);
    if (y >= 440) break;
    let x0 = null, n = 0;
    const flush = () => { if (x0 !== null) out += `M${x0} ${y}h${r1((n - 1) * GRID + 0.1)}`; x0 = null; n = 0; };
    for (let i = 0; ; i++) {
      const x = r1((r % 2 ? GRID : GRID / 2) + i * GRID);
      if (x >= 1000) break;
      if (inside(rs, x, y)) { if (x0 === null) x0 = x; n++; } else flush();
    }
    flush();
  }
  RUNS.set(d, out);
  return out;
}

/** 地域の平均（万円）→ 濃さ 0〜1（小数2桁）。lo・hi ＝ 8地域の平均のいちばん低い所・高い所。分からない額を 0 にしない＝止まる */
export function toneOf(man, lo, hi) {
  for (const [k, v] of [['額', man], ['いちばん低い平均', lo], ['いちばん高い平均', hi]]) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) throw new Error(`toneOf：${k}「${v}」`);
  }
  if (!(hi > lo) || man < lo || man > hi) throw new Error(`toneOf：${man} が ${lo}〜${hi} の中に無い`);
  return Math.round(((man - lo) / (hi - lo)) * 100) / 100;
}

/**
 * 地図の列（地図の箱 ＋ その下の一言と凡例）。
 *   tones  { 地域: { c: 機長の濃さ, f: 副操縦士の濃さ } }（8つ全部・0〜1。toneOf() の答え）
 *   legend { cap: [いちばん低い平均の HTML, いちばん高い平均の HTML], fo: […] }（額は呼び手が焼く）
 *   hint   地図の下の一言（地図をクリックして地域を選ぶ）
 *   on     選んだ地域・hot 指している地域（光る層）── 見本の絵だけが渡す。ページのブロックはどちらも無しで書く
 *   id     null のとき id="wa-map" を書かない（見本の絵のように、1枚に何枚も並べるとき）
 *   uid    <use> が指す id の後ろに付ける字（1枚に何枚も並べるとき、id がぶつからないように）
 *   zoom   動かせる地図のボタンの字 { in, out, reset, touch }（呼び手が esc した字）── ページのブロックだけが渡す。見本の絵は渡さない（ボタンを描かない）
 */
export function mapBox(o) {
  const u = o.uid ?? '';
  const tone = (v) => typeof v === 'number' && v >= 0 && v <= 1;
  for (const r of PAINT) if (!tone(o.tones?.[r]?.c) || !tone(o.tones?.[r]?.f)) throw new Error(`mapBox：${r} の濃さ「${JSON.stringify(o.tones?.[r])}」`);
  for (const p of ['cap', 'fo']) if (!Array.isArray(o.legend?.[p]) || o.legend[p].length !== 2 || !o.legend[p].every((s) => typeof s === 'string' && s)) throw new Error(`mapBox：凡例 ${p}`);
  if (typeof o.hint !== 'string' || !o.hint) throw new Error('mapBox：地図の下の一言が無い');
  for (const k of ['on', 'hot']) if (o[k] != null && !PAINT.includes(o[k])) throw new Error(`mapBox：${k}「${o[k]}」`);
  if (o.zoom != null) for (const k of ZOOM_KEYS) if (typeof o.zoom[k] !== 'string' || !o.zoom[k]) throw new Error(`mapBox：動かすボタンの字 ${k}`);
  const st = (r) => (o.on === r ? ' is-on' : '') + (o.hot === r ? ' is-hot' : '');
  const J = JAPAN_MARK;
  const L = [];
  L.push('<div class="wam-mc">');
  L.push(`<div class="wam-map"${o.id === null ? '' : ' id="wa-map"'}>`);
  L.push(`<svg class="wam-svg" viewBox="${VIEWBOX}" aria-hidden="true" focusable="false">`);
  L.push('<g class="wam-z">');   // 動かす層（WP-dmap-9）── この下の層が全部一緒に動く
  L.push(`<g class="wam-nl"><path id="wam-d-neutral${u}" d="${dotRuns(SHAPES.neutral)}"/></g>`);
  for (const r of PAINT) L.push(`<g class="wam-r${st(r)}" data-region="${r}" style="--c:${o.tones[r].c};--f:${o.tones[r].f}"><path class="wam-land" id="wam-d-${r}${u}" d="${dotRuns(SHAPES[r])}"/></g>`);
  /* 当たりの層：日本の丸が先（あとから重なるサハリンとアジアの陸地が、それぞれの答えを持つ） */
  L.push('<g class="wam-hl">');
  L.push(`<circle class="wam-hit wam-hit-t" data-region="japan" cx="${J.cx}" cy="${J.cy}" r="${J.rTouch}"/>`);
  L.push(`<circle class="wam-hit" data-region="japan" cx="${J.cx}" cy="${J.cy}" r="${J.rHit}"/>`);
  L.push(`<use class="wam-hit wam-hit-n" href="#wam-d-neutral${u}"/>`);
  for (const r of PAINT) L.push(`<use class="wam-hit" data-region="${r}" href="#wam-d-${r}${u}"/>`);
  L.push('</g>');
  /* 光る層（P12.102）：指した・選んだ地域の点が明るく光る（ふだんは見えない。opacity だけが動く） */
  L.push('<g class="wam-ol">');
  for (const r of PAINT) {
    const ring = r === 'japan' ? `<circle class="wam-ring" cx="${J.cx}" cy="${J.cy}" r="${J.rRing}"/>` : '';
    L.push(`<g class="wam-o${st(r)}" data-region="${r}"><use class="wam-halo" href="#wam-d-${r}${u}"/><use class="wam-lit" href="#wam-d-${r}${u}"/>${ring}</g>`);
  }
  L.push('</g>');
  L.push('</g>');
  L.push('</svg>');
  if (o.zoom != null) {
    /* 動かせる地図のボタン（WP-dmap-9 → WP-dmap-11 で全画面と「閉じる」を外した）。字は aria-label と title の2つ（印だけのボタン）。元に戻すは1倍のあいだ隠れている */
    const Z = o.zoom, zb = (z, hid) => `<button type="button" class="wam-zb" data-z="${z}" aria-label="${Z[z]}" title="${Z[z]}"${hid ? ' hidden' : ''}></button>`;
    L.push(`<div class="wam-zc" hidden>${zb('in')}${zb('out')}${zb('reset', true)}</div>`);
    L.push(`<p class="wam-zh" aria-hidden="true" hidden>${Z.touch}</p>`);
  }
  L.push('</div>');
  /* 地図の下の1行：一言（左）と、選んでいる職位の凡例（右・8地域の平均のいちばん低い所〜高い所。CSS が区域の data-pos で片方を見せる） */
  L.push('<div class="wam-foot">');
  L.push(`<p class="wam-hint" aria-hidden="true">${o.hint}</p>`);
  for (const p of ['cap', 'fo']) L.push(`<p class="wam-key" data-pos="${p}" aria-hidden="true"><span>${o.legend[p][0]}</span><i class="wam-kb"></i><span>${o.legend[p][1]}</span></p>`);
  L.push('</div>');
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
    「機長｜副操縦士」の切り替え（P12.100）の2つのボタンの字は、行の札と同じ rank の字（新しい字を作らない）。
    その組の読み上げの名前（aria-label・画面には出ない）は「職位」／Rank（リード P12.112）。
    地図の下の一言 hint は、いまの一覧が古い地図の上に出している字のまま（directory-data WP-dd-9 の字。新しい字ではない）。
    zoom ＝ 動かせる地図（WP-dmap-9）のボタンの字と、指の一言（シートの WP-dmap-9 の wording の字。英語はオーナー #19「自然な英語」）。
    全画面・閉じる の2つは WP-dmap-11 でボタンごと外した（ページそのものが地図の画面）。
    close ＝ 区域 1000px 未満で下から出る板（開いたカード）の閉じるボタンの字（WP-dmap-11 の直し）── このページの比較リストの閉じるボタンと同じ字 */
const WORDS = {
  ja: {
    all: 'すべて', k: '公開情報からの推定', def: (n) => `掲載${n}社の推定年収の平均`, rank: { cap: '機長', fo: '副操縦士' }, rankGroup: '職位',
    cond: '条件/出典', who: '対象', count: '対象掲載社数', countN: (n) => `${n}社`, fx: '換算', go: 'この地域の航空会社を見る',
    lo: '最低', hi: '最高', span: '幅', regionN: (l, n) => `${l} ${n}社`, hint: '地図をクリックして地域を選択',
    zoom: { in: '拡大', out: '縮小', reset: '元に戻す', touch: '2本の指で動かせます' }, close: '閉じる',
  },
  en: {
    all: 'All', k: 'Estimate from public information', def: (n) => `Mean of our estimates across ${n} airlines`, rank: { cap: 'Captain', fo: 'First Officer' }, rankGroup: 'Rank',
    cond: 'Conditions / Sources', who: 'Airlines included', count: 'Number of airlines', countN: (n) => `${n}`, fx: 'Conversion', go: 'View airlines in this region',
    lo: 'Lowest', hi: 'Highest', span: 'Range', regionN: (l, n) => `${l} ${n}`, hint: 'Click the map to choose a region',
    zoom: { in: 'Zoom in', out: 'Zoom out', reset: 'Reset', touch: 'Use two fingers to move the map' }, close: 'Close',
  },
};
/** 動かせる地図のボタンの字の鍵（mapBox が確かめる） */
const ZOOM_KEYS = ['in', 'out', 'reset', 'touch'];

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
 *   o = { lang, M（directory-model.mjs の model()）, ledger（SALARY）, regionMean(code, rank), bake(text) → string, fxNote（換算の文） }
 * 1枚の面（.wam-g）に「機長｜副操縦士」の切り替え・地図の列・カードを置く（並べ方は pv-directory.css：広い画面は地図の右にカード、
 * 区域 1000px 未満は 切り替えの行・地図・カードの順で、カードは地域を選ぶか地図に触れるまで閉じている ── 閉じているあいだは切り替えの右に
 * 見せている地域の名前と額の1〜2行。WP-dmap-11 から地図は最初の1画面を埋める ── pv-directory.css の wam-stage の塊。開いたカードは地図の下の部分に
 * 重なる板で、先頭の閉じるボタン（.wam-sx）で閉じる）。
 * 9枚のカード（すべて ＋ 8地域。すべてだけ is-shown）は1つの升に重ねる（高さが入れ替わらない）。台本なしでは9枚とも縦に並び、
 * 帯は機長と副操縦士の2本とも見える。地図・凡例・一言は台本なしでは出さない（<noscript> の規則 ── 押しても何も起きない地図を出さない）。
 * #pv-rp は地域のまとめの下の段（05b）が入る口 ── ここは何も書かない。
 * 「機長｜副操縦士」の切り替え（.wam-pos・P12.100）は hidden で出荷する。台本（pv-directory.js）が動いたときだけ見せる
 * （押しても何も起きないボタンを出さない）。押した方が区域の data-pos を決める（カードの行の大きさ・見せる帯・地図の濃さ・凡例）。
 */
export function mapSection(o) {
  const W = WORDS[o.lang];
  if (!W) throw new Error(`mapSection：知らない言語「${o.lang}」`);
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

  /* 地図の濃さ（職位ごと）と凡例：8地域のカードに出す平均（同じ regionMean）のいちばん低い所〜高い所 */
  const regs = M.regions.map((r) => r.code);
  const span = Object.fromEntries(POS.map((r) => { const v = regs.map((c) => meanOf({ code: c }, r)); return [r, [Math.min(...v), Math.max(...v)]]; }));
  const tones = Object.fromEntries(regs.map((c) => [c, { c: toneOf(meanOf({ code: c }, 'cap'), ...span.cap), f: toneOf(meanOf({ code: c }, 'fo'), ...span.fo) }]));
  const legend = Object.fromEntries(POS.map((r) => [r, span[r].map(yen)]));

  return [
    `<div class="wam" id="wa-map-sec" data-rest="${NARROW_REST}" data-pos="cap">`,
    '<noscript><style>.wam-map,.wam-key,.wam-hint,.wam-go,.wam-slot{display:none!important}.wam-card{display:flex!important}.wam-panel{visibility:visible!important;grid-area:auto!important}.wam-sp{visibility:inherit!important;grid-area:auto!important}.wam-sp-rk{display:block!important}.wam-g{display:block!important}.wam-card{max-width:720px}</style></noscript>',
    '<div class="wam-g">',
    `<div class="wam-pos" role="group" aria-label="${esc(W.rankGroup)}" hidden>${POS.map((r) => `<button type="button" class="wam-pb" data-pos="${r}" aria-pressed="${r === 'cap'}">${esc(W.rank[r])}</button>`).join('')}</div>`,
    mapBox({ tones, legend, hint: esc(W.hint), zoom: Object.fromEntries(ZOOM_KEYS.map((k) => [k, esc(W.zoom[k])])) }),
    '<aside class="wam-card" id="wa-sum">',
    `<button type="button" class="wam-sx" aria-label="${esc(W.close)}" title="${esc(W.close)}" hidden></button>`,
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
