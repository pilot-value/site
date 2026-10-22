/* ════════════════════════════════════════════════════════════════
   import-world-outline.mjs ── 一覧の地図の輪郭 world-outline.mjs を、Natural Earth の国の形から作る（2026-10-23）

     node import-world-outline.mjs --from <生データのフォルダ> --tag <版の名前か commit> --seen <出所のページを読んだ日 YYYY-MM-DD>
     node import-world-outline.mjs … --check     書かずに、コミット済みの world-outline.mjs と比べる（「✓ 変更なし」か最初の違い）
     node import-world-outline.mjs … --sketch    さらに見本の絵 temporary screenshots/wam-sketch.html を書く（オーナーに見せる1枚）

   読むもの: <--from>/ne_110m_admin_0_countries.geojson（Natural Earth「Admin 0 – Countries」1:110m・パブリックドメイン）。
             salary-data.mjs（SALARY ＝ 会社と地域）・airline-countries.mjs（会社の国）・world-outline-probes.mjs（色を読む点）。
   書くもの: world-outline.mjs だけ（--check のときは何も書かない）。--sketch のときは見本の絵も。

   ★ 生データはリポジトリに入れない（.gitignore 済みのフォルダに置く）。フォルダの場所はこのファイルに書かない・
     画面にも全部は出さない（絶対パスには Mac のログイン名が入る）。毎回 --from で渡す。--from の場所には1バイトも書かない。
   ★ ネットを叩かない。時計を読まない（--tag / --seen をそのまま META へ）＝ 何度流しても同じバイトになる。
   ★ 形を許容差で間引かない。消すのは「同じ点の繰り返し」と「ぴったり一直線の途中の点」だけ（形は1単位も変わらない）。
   ★ 黙って飛ばさない。地域の決まらない国・閉じない輪・会社の国なのに形が無い・扱いの決まっていない離れた部分・
     重さの上限超え は、どれも理由を出して止まる（exit 1）。
   ★ 地域の分け方を変えるときは、下の定数（NEUTRAL・EXTRA・POLY …）だけを直して流し直す。world-outline.mjs を手で直さない。
   ★ 文字列の置き換えは関数形だけ（CLAUDE.md）。
   ════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SALARY } from './salary-data.mjs';
import { AIRLINE_COUNTRY } from './airline-countries.mjs';
import { COLOR_AT } from './world-outline-probes.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const FROM = arg('--from');
const TAG = arg('--tag');
const SEEN = arg('--seen');
const CHECK = process.argv.includes('--check');
const SKETCH = process.argv.includes('--sketch');
const RAW = 'ne_110m_admin_0_countries.geojson';
const OUT = path.join(ROOT, 'world-outline.mjs');
const SKETCH_DIR = path.join(ROOT, 'temporary screenshots');

const die = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };

if (!FROM || !TAG || !SEEN) {
  console.error('使い方: node import-world-outline.mjs --from <生データのフォルダ> --tag <版の名前か commit> --seen <YYYY-MM-DD> [--check] [--sketch]');
  process.exit(1);
}
/* 版と日付は META に文字のまま入る。引用符やパスの混ざる形を通さない */
if (!/^[A-Za-z0-9._-]{1,64}$/.test(TAG)) die('--tag に書けるのは英数字と . _ - だけ（例: v5.1.2 か commit の頭）');
if (!/^\d{4}-\d{2}-\d{2}$/.test(SEEN)) die('--seen は YYYY-MM-DD');
const RAW_FILE = path.join(FROM, RAW);
if (!fs.existsSync(RAW_FILE)) die(`--from のフォルダに ${RAW} が無い（フォルダの場所は出さない）`);

/* ── 定数（どれも理由つき） ───────────────────────────────── */

/** どの地域にも入れない陸地（同じ色の灰色で描く・押せない・名前を出さない）。会社の国は必ず先に地域へ入る（規則1が先） */
const NEUTRAL = ['RU', 'GL'];
/** 手で決めた6つ。イランを「アジア」にすると中東の形の間に穴が空き、コーカサスが「中東」の島になる。
    キプロス・北キプロス・ジョージア・アルメニア・アゼルバイジャンは、台帳が欧州に入れているトルコと地続きなので欧州 */
const EXTRA = { IR: 'mideast', CY: 'europe', 'N. Cyprus': 'europe', GE: 'europe', AM: 'europe', AZ: 'europe' };
/** 国の1片だけ別の地域へ：フランスのうち西経30度より西の片（仏領ギアナ）は中南米。
    クリミア半島：この版のデータはロシアの形の1片として持っている（片の中心 34.5 E, 45.3 N）。国際的に認められた境界
    （日本政府の立場も同じ）ではウクライナ ＝ 欧州なので、ロシアの灰色ではなく欧州に入れる（2026-10-23 作り手の判断・リードに報告済み）。 */
const POLY = [
  { code: 'FR', when: (lon, lat) => lon < -30, region: 'latam' },
  { code: 'RU', when: (lon, lat) => lon > 32 && lon < 37 && lat > 44 && lat < 46.5, region: 'europe' },
];
/** 会社の国なのに 1:110m に形が無いもの（どれも、周りの載っている国の形で地域が光る） */
const NO_SHAPE_OK = ['BH', 'HK', 'MT', 'SG'];
/** 国の大きな片から FAR 度より離れているが、その国の地域のままでよい片 [国, 経度, 緯度]（片の中心・度に丸める）。
    最初の実行が出した一覧を、作り手と確かめる人がそれぞれ地図帳で見て、その地域に属すると確かめたものだけ。
    ★ 別の地域に属する片は、ここではなく POLY に1行足す。 */
const FAR_OK = [
  ['CA', -56, 49],    // ニューファンドランド島
  ['CA', -119, 77],   // プリンスパトリック島
  ['CA', -132, 53],   // ハイダ・グワイ（クイーンシャーロット諸島）
  ['CA', -126, 50],   // バンクーバー島
  ['CA', -121, 73],   // バンクス島
  ['CA', -63, 49],    // アンティコスティ島
  ['CA', -63, 46],    // プリンスエドワードアイランド
  ['US', -156, 20],   // ハワイ島
  ['US', -156, 21],   // マウイ島
  ['US', -157, 21],   // モロカイ島
  ['US', -158, 21],   // オアフ島
  ['US', -160, 22],   // カウアイ島
  ['US', -166, 60],   // ヌニバク島（アラスカ）
  ['US', -153, 57],   // コディアック島（アラスカ）
  ['US', -153, 62],   // アラスカの本土
  ['US', -170, 63],   // セントローレンス島（アラスカ）
  ['RU', 179, 71],    // ウランゲリ島の西半分（180度の線の西）
  ['RU', 140, 75],    // コテリヌイ島（ノヴォシビルスク諸島）
  ['RU', 148, 75],    // ノヴァヤシビリ島（ノヴォシビルスク諸島）
  ['RU', 142, 73],    // ボリショイ・リャホフスキー島（ノヴォシビルスク諸島）
  ['RU', 48, 81],     // フランツ・ヨシフ諸島
  ['RU', 22, 55],     // カリーニングラード（ロシアの飛び地）
  ['RU', 58, 74],     // ノヴァヤゼムリャ
  ['RU', 143, 50],    // サハリン
  ['RU', -176, 66],   // チュクチ半島の東の端（180度の線の東）
  ['RU', -179, 71],   // ウランゲリ島の東半分（180度の線の東）
];
/** 写し方（Equal Earth・中心の経線 0）と箱：x = X0 + X*S, y = Y0 - Y*S。S = 1000 / (2 × 2.706630)。南は南緯59度くらいで箱が終わる（南極は描かない） */
const S = 184.731568, X0 = 500, Y0 = 244, VIEW = { w: 1000, h: 440 };
/** 2平方単位より小さい輪は落とす（ただし地域のいちばん大きな輪は必ず残す）・重さの上限・「離れた片」の度数・180度の線のそば */
const A_MIN = 2, CEIL = 32000, FAR = 25, EDGE = 170;
/** 地域の名前を置く所 [経度, 緯度, 'l' ＝ 名前をここから左寄せで書く]。DM1 の見本の絵を見て目で合わせる。
    2026-10-23：幅241px で「中東」と「アジア」の札が 3px 重なったので、アジアを中国の中ほど（96,33 → 105,30）、
    中東をサウジアラビアの中ほど（46,24 → 44,24）へ。4つの幅（1200・520・350・241px）で札どうしが 4px 以上離れる */
const LABEL_AT = {
  us: [-101, 44], latam: [-60, -10], europe: [11, 49], africa: [20, 0], mideast: [44, 24], asia: [105, 30],
  japan: [147, 36, 'l'], oceania: [134, -25],
};
/** 日本の目印：丸の中心と、マウスで当たる半径・指で当たる半径（幅350pxで直径44px）・輪の半径（箱の単位） */
const JAPAN_MARK = { at: [138, 37], rHit: 40, rTouch: 63, rRing: 26 };
/** 見本の絵の地域の名前（一覧のページの名前のまま ── いまは directory-model.mjs の REGIONS が持つ。WP-dd-2 が REGION_CFG から移した）。--sketch だけ */
const SKETCH_NAMES = { us: '北米', latam: '中南米', europe: '欧州', africa: 'アフリカ', mideast: '中東', asia: 'アジア', japan: '日本', oceania: 'オセアニア' };
/** 地図の見た目（E8 の「map」の部分・P12.89 の緑の段・外枠・凡例・名前の札）。--sketch だけが使う。
    DM5a でこのまま pv-directory.css の wam-map の印の間へ移し、この定数は消す（そのあとの --sketch はそちらを読む）。
    ★ 塗りの決まり（D10）：段は地域の <g> に付けて path が受け継ぐ。.wam-land を名指す規則で fill / fill-opacity / stroke を決めない
      （<use> の写しがそれを持ってしまい、外枠にならない）。 */
const MAP_CSS = `/* ── wam-map ── */
.wam-map{position:relative;container-type:inline-size;container-name:wam-map;aspect-ratio:1000 / 440;overflow:hidden;border:1px solid var(--pv-line);border-radius:var(--pv-r);background:var(--pv-bg-sub);scroll-margin-top:86px}
.wam-svg{display:block;width:100%;height:100%}
.wam-r{stroke:var(--pv-surface);stroke-width:1;cursor:pointer}
.wam-t0{fill:var(--pv-accent-ink);fill-opacity:.30}
.wam-t1{fill:var(--pv-accent-ink);fill-opacity:.40}
.wam-t2{fill:var(--pv-accent-ink);fill-opacity:.50}
.wam-t3{fill:var(--pv-accent-ink);fill-opacity:.60}
.wam-t4{fill:var(--pv-accent-ink);fill-opacity:.70}
.wam-t5{fill:var(--pv-accent-ink);fill-opacity:.80}
.wam-t6{fill:var(--pv-accent-ink);fill-opacity:.90}
.wam-nl{fill:var(--pv-ink-3);fill-opacity:.30;stroke:var(--pv-surface);stroke-width:1;vector-effect:non-scaling-stroke}
.wam-land,.wam-lit{vector-effect:non-scaling-stroke}
.wam-hit{fill:transparent;stroke:none;pointer-events:all;cursor:pointer}
.wam-hit-t{pointer-events:none}
@media (pointer:coarse){.wam-hit-t{pointer-events:all}}
.wam-ol{pointer-events:none}
.wam-halo,.wam-lit{fill:none;opacity:0;pointer-events:none;stroke-linejoin:round;vector-effect:non-scaling-stroke;transition:opacity .18s var(--pv-ease)}
.wam-halo{stroke:var(--pv-surface);stroke-width:4}
.wam-lit{stroke:var(--pv-ink);stroke-width:2}
.wam-o.is-hot .wam-halo,.wam-o.is-hot .wam-lit{opacity:.6}
.wam-svg:has(.wam-r:active) .wam-o.is-hot .wam-lit{opacity:.8}
.wam-o.is-on .wam-halo,.wam-o.is-on .wam-lit{opacity:1}
.wam-ring{fill:none;stroke:var(--pv-ink);stroke-width:2;vector-effect:non-scaling-stroke;opacity:0;pointer-events:none;transition:opacity .18s var(--pv-ease)}
.wam-o.is-hot .wam-ring,.wam-o.is-on .wam-ring{opacity:1}
.wam-lbl{position:absolute;transform:translate(-50%,-50%);pointer-events:none;white-space:nowrap;text-align:center;font:700 12px/1.15 Inter,'Noto Sans JP',sans-serif;color:var(--pv-ink);background:var(--pv-surface);padding:1px 4px;border-radius:4px}
.wam-lbl-l{transform:translate(0,-50%);text-align:left}
@container wam-map (max-width:479px){.wam-lbl{font-size:11px}}
@container wam-map (max-width:299px){.wam-lbl{font-size:10px;line-height:1.05}}
.wam-mc{min-width:0}
.wam-key{display:flex;align-items:center;gap:6px;margin:6px 0 0;font:600 11px/1.4 Inter,'Noto Sans JP',sans-serif;color:var(--pv-ink-2)}
.wam-sw{display:block;flex:none;width:70px;height:10px;border-radius:2px;overflow:hidden;background:var(--pv-bg-sub)}
@container wam (min-width:700px){.wam-g{grid-template-columns:minmax(0,min(56%,520px)) minmax(0,1fr)}}
@container wam (min-width:790px){.wam-g{grid-template-columns:minmax(0,520px) minmax(554px,1fr)}}
@media (prefers-reduced-motion:reduce){.wam-halo,.wam-lit,.wam-ring{transition:none}}
/* ── /wam-map ── */`;

/** 塗る順（あとのものが上）。neutral は先に1本の path で描く */
const REGIONS = ['us', 'latam', 'europe', 'africa', 'mideast', 'asia', 'oceania', 'japan'];
const TARGETS = ['neutral', ...REGIONS];
/** 隣の国と境界を消し合えないと形にならない地域（ここが 0 本なら、このファイルでは合わせられない） */
const MUST_CANCEL = ['us', 'latam', 'europe', 'africa', 'mideast', 'asia'];

/* ── 1 台帳：会社の国 → その会社の地域 ─────────────────────── */
const salaryRegions = [...new Set(Object.values(SALARY).map(s => s.region))].sort();
if (salaryRegions.join() !== [...REGIONS].sort().join()) die(`SALARY の地域が8つと違う：${salaryRegions.join(' ')}`);
const FORCED = {};
for (const [slug, cc] of Object.entries(AIRLINE_COUNTRY)) {
  if (!cc) continue;
  const reg = SALARY[slug]?.region;
  if (!reg) die(`${slug}：airline-countries.mjs にあるのに SALARY に地域が無い`);
  if (FORCED[cc] && FORCED[cc] !== reg) die(`${cc} の会社が2つの地域にいる（${FORCED[cc]} / ${reg}）`);
  FORCED[cc] = reg;
}

/* ── 生データ ─────────────────────────────────────────── */
const buf = fs.readFileSync(RAW_FILE);
const SHA = crypto.createHash('sha256').update(buf).digest('hex');
const GEO = JSON.parse(buf.toString('utf8'));
if (GEO.type !== 'FeatureCollection' || !Array.isArray(GEO.features)) die(`${RAW} が FeatureCollection でない`);

const isCode = c => typeof c === 'string' && /^[A-Z]{2}$/.test(c);
const codeOf = p => (isCode(p.ISO_A2) ? p.ISO_A2 : isCode(p.ISO_A2_EH) ? p.ISO_A2_EH : null);
const area2 = ring => { let a = 0; for (let i = 0; i < ring.length; i++) { const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
const meanOf = ring => [ring.reduce((a, p) => a + p[0], 0) / ring.length, ring.reduce((a, p) => a + p[1], 0) / ring.length];
const open = ring => (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring.slice());
const r0 = n => Math.round(n);

/* ── 2 国ごとの地域（規則 0〜4・最初に当たったもの） ─────────────── */
function regionOf(p, code) {
  if (p.CONTINENT === 'Antarctica' || p.CONTINENT === 'Seven seas (open ocean)') return null;   // 0 描かない
  if (code && FORCED[code]) return FORCED[code];                                                // 1 台帳
  if (code && NEUTRAL.includes(code)) return 'neutral';                                         // 2 どこにも入れない陸地
  const ex = EXTRA[code ?? p.NAME] ?? EXTRA[p.NAME];                                            // 3 手で決めた6つ
  if (ex) return ex;
  if (p.SUBREGION === 'Western Asia') return 'mideast';                                         // 4 データの大陸・地方
  const byC = { Asia: 'asia', Europe: 'europe', Africa: 'africa', Oceania: 'oceania', 'South America': 'latam' }[p.CONTINENT];
  if (byC) return byC;
  if (p.CONTINENT === 'North America') return p.SUBREGION === 'Northern America' ? 'us' : 'latam';
  return undefined;
}

const rings = Object.fromEntries(TARGETS.map(t => [t, []]));          // 地域 → 向きをそろえた輪（生の経緯度）
const members = Object.fromEntries(TARGETS.map(t => [t, new Set()]));
const farParts = [];                                                  // 離れた片
const dropped180 = [];                                                // 規則6で落とした片
const usedFarOk = new Set();

for (const f of GEO.features) {
  const p = f.properties || {}, code = codeOf(p), who = code ?? p.NAME;
  const reg = regionOf(p, code);
  if (reg === null) continue;
  if (reg === undefined) die(`地域が決まらない国：${p.NAME}（${p.CONTINENT} / ${p.SUBREGION}）`);
  const g = f.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : die(`${p.NAME}：形の種類 ${g.type}`);
  /* 3 片ごと：輪の向きをそろえる（外側は正・穴は負）・片の中心 ＝ 外側の輪の点の平均 */
  const parts = polys.map(poly => {
    const rs = poly.map(open).map((r, i) => { const a = area2(r); return (i === 0 ? a < 0 : a > 0) ? r.reverse() : r; });
    return { rs, c: meanOf(rs[0]), a: Math.abs(area2(rs[0])) };
  });
  const big = parts.reduce((m, q) => (q.a > m.a ? q : m), parts[0]);
  for (const q of parts) {
    let target = reg, fate = null;
    const row = POLY.find(r => r.code === code && r.when(q.c[0], q.c[1]));
    if (row) { target = row.region; fate = `POLY → ${row.region}`; }
    else if (reg !== 'neutral' && q !== big && Math.sign(q.c[0]) !== Math.sign(big.c[0]) && Math.abs(q.c[0]) > EDGE) {
      dropped180.push(`${who} (${r0(q.c[0])}, ${r0(q.c[1])})`);
      fate = '規則6で落とす';
      target = null;
    }
    if (polys.length > 1 && q !== big && (Math.abs(q.c[0] - big.c[0]) > FAR || Math.abs(q.c[1] - big.c[1]) > FAR)) {
      const key = `${who},${r0(q.c[0])},${r0(q.c[1])}`;
      if (!fate && FAR_OK.some(r => r.join() === key)) { fate = 'FAR_OK'; usedFarOk.add(key); }
      farParts.push({ who, lon: r0(q.c[0]), lat: r0(q.c[1]), reg: target ?? reg, fate });
    }
    if (target === null) continue;
    rings[target].push(...q.rs.map(r => ({ r, who })));
    members[target].add(who);
  }
}

/* ── 4 地域ごと：隣り合う国の境界（a→b と b→a）を生の座標で消し合い、残った辺を輪につなぎ直す ── */
const pk = ([x, y]) => `${x},${y}`;
const cancelled = {};
const merged = {};
for (const t of TARGETS) {
  const cnt = new Map(), pt = new Map(), own = new Map();          // own ＝ 残った辺がどの国のものか（輪の名前を地図帳で確かめるため）
  let c = 0;
  for (const { r, who } of rings[t]) {
    for (let i = 0; i < r.length; i++) {
      const a = pk(r[i]), b = pk(r[(i + 1) % r.length]);
      if (a === b) continue;
      pt.set(a, r[i]); pt.set(b, r[(i + 1) % r.length]);
      const back = `${b}>${a}`;
      if ((cnt.get(back) || 0) > 0) { cnt.set(back, cnt.get(back) - 1); c++; }
      else { cnt.set(`${a}>${b}`, (cnt.get(`${a}>${b}`) || 0) + 1); if (!own.has(`${a}>${b}`)) own.set(`${a}>${b}`, []); own.get(`${a}>${b}`).push(who); }
    }
  }
  cancelled[t] = c;
  const out = new Map();                                              // 始点 → 終点の並び
  for (const [e, n] of cnt) {
    if (n <= 0) continue;
    const [a, b] = e.split('>');
    if (!out.has(a)) out.set(a, []);
    for (let i = 0; i < n; i++) out.get(a).push(b);
  }
  const res = [];
  for (const start of out.keys()) {
    while (out.get(start).length) {
      const ring = [start], who = new Set();
      let prev = start, cur = out.get(start).shift();
      who.add(own.get(`${prev}>${cur}`).shift());
      while (cur !== start) {
        ring.push(cur);
        const nx = out.get(cur);
        if (!nx || !nx.length) die(`閉じない輪：${t} の (${cur}) から先が無い`);
        prev = cur; cur = nx.shift();
        who.add(own.get(`${prev}>${cur}`).shift());
      }
      res.push({ raw: ring.map(k => pt.get(k)), who: [...who].sort() });
    }
  }
  merged[t] = res;
}
for (const t of MUST_CANCEL) if (!cancelled[t]) die(`隣り合う国の境界が一致しない（${t} で消し合った辺が 0 本）`);

/* ── 5 写す・丸める・同じ点とぴったり一直線の途中の点を消す・小さすぎる輪を落とす ── */
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, MM = Math.sqrt(3) / 2;
function project(lon, lat) {
  const l = lon * Math.PI / 180, ph = lat * Math.PI / 180;
  const t = Math.asin(MM * Math.sin(ph)), t2 = t * t, t6 = t2 * t2 * t2;
  const X = l * Math.cos(t) / (MM * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
  const Y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
  return [Math.round(X0 + X * S), Math.round(Y0 - Y * S)];
}
function tidy(r) {
  let pts = r.map(([lon, lat]) => project(lon, lat)), changed = true;
  while (changed && pts.length >= 3) {
    changed = false;
    for (let i = 0; i < pts.length && pts.length >= 3; i++) {
      const A = pts[(i - 1 + pts.length) % pts.length], B = pts[i], C = pts[(i + 1) % pts.length];
      const same = A[0] === B[0] && A[1] === B[1];
      const ux = B[0] - A[0], uy = B[1] - A[1], vx = C[0] - B[0], vy = C[1] - B[1];
      if (same || (ux * vy - uy * vx === 0 && ux * vx + uy * vy > 0)) { pts.splice(i, 1); i--; changed = true; }
    }
  }
  return pts;
}
/* 輪の書き出しを、いちばん左（同じなら上）の点から始める ＝ 何度流しても同じ並び */
const rotate = pts => { let k = 0; pts.forEach((q, i) => { if (q[0] < pts[k][0] || (q[0] === pts[k][0] && q[1] < pts[k][1])) k = i; }); return [...pts.slice(k), ...pts.slice(0, k)]; };
const sep = n => (n < 0 ? `${n}` : ` ${n}`);
const ringPath = pts => {
  let s = `M${pts[0][0]}${sep(pts[0][1])}l`;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
    s += (i === 1 ? `${dx}` : sep(dx)) + sep(dy);
  }
  return `${s}z`;
};

const SHAPES = {}, INFO = {}, SMALL = {};
for (const t of TARGETS) {
  const all = merged[t].map(m => ({ pts: tidy(m.raw), who: m.who })).map(q => ({ ...q, a: q.pts.length >= 3 ? area2(q.pts) : 0 }));
  let rs = all.filter(q => q.pts.length >= 3);
  if (!rs.length) die(`${t} の形が無い`);
  const largest = rs.reduce((m, q) => (Math.abs(q.a) > Math.abs(m.a) ? q : m), rs[0]);
  rs = rs.filter(q => q === largest || Math.abs(q.a) >= A_MIN).map(q => ({ ...q, pts: rotate(q.pts) }));
  SMALL[t] = all.filter(q => !rs.some(k => k.who === q.who && k.a === q.a)).map(q => `${q.who.join('+')} ${Math.abs(q.a).toFixed(1)}（${q.pts.length ? `${q.pts[0][0]}, ${q.pts[0][1]}` : '点なし'}）`);
  rs.sort((p, q) => Math.abs(q.a) - Math.abs(p.a) || p.pts[0][0] - q.pts[0][0] || p.pts[0][1] - q.pts[0][1]);
  SHAPES[t] = rs.map(q => ringPath(q.pts)).join('');
  INFO[t] = rs.map(q => {
    const xs = q.pts.map(p => p[0]), ys = q.pts.map(p => p[1]);
    return { a: q.a, n: q.pts.length, who: q.who, cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2,
      w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), pts: q.pts };
  });
}
const BYTES = Object.fromEntries(TARGETS.map(t => [t, Buffer.byteLength(SHAPES[t])]));
const TOTAL = Object.values(BYTES).reduce((a, b) => a + b, 0);
const MEMBERS = Object.fromEntries(TARGETS.map(t => [t, [...members[t]].sort()]));
const inShape = new Set(Object.values(MEMBERS).flat());
const inUse = Object.keys(FORCED).sort();
const NO_SHAPE = inUse.filter(c => !inShape.has(c));

/* ── 名前の札と日本の目印（箱の単位 → 札は箱に対する％・小数1桁） ── */
const LABELS = Object.fromEntries(REGIONS.map(r => {
  const [lon, lat, l] = LABEL_AT[r], [x, y] = project(lon, lat);
  return [r, { x: Math.round(x / 10 * 10) / 10, y: Math.round(y / 4.4 * 10) / 10, left: l === 'l' }];
}));
const [JX, JY] = project(...JAPAN_MARK.at);

/* ── 見本の絵の段：地域ごとの機長の推定年収の平均（万円・10万円で丸める）と、0〜AX の共通の目盛 ── */
// 見本の絵だけ。ページの段は mapSection が regionMean から作り、M20 が見張る
const capsOf = r => Object.values(SALARY).filter(s => s.region === r).map(s => s.cap.avg);
const MEAN = Object.fromEntries(REGIONS.map(r => [r, Math.round(capsOf(r).reduce((a, b) => a + b, 0) / capsOf(r).length / 10) * 10]));
const AX = Math.ceil(Math.max(...Object.values(SALARY).flatMap(s => [s.cap.avg, s.fo.avg])) / 1000) * 1000;

/* ── 色の段の表（pv-tokens.css の値から計算・ライトとダーク）── */
const TOK = fs.readFileSync(path.join(ROOT, 'pv-tokens.css'), 'utf8');
const block = (open) => { const i = TOK.indexOf(open); if (i < 0) die(`pv-tokens.css に ${open} が無い`); return TOK.slice(i, TOK.indexOf('}', i)); };
const tok = (blk, name) => { const m = blk.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`)); return m ? m[1] : null; };
const LIGHT = block(':root{'), DARK = block('[data-theme="dark"]{');
const THEME = {
  light: { ink: tok(LIGHT, '--pv-accent-ink'), sea: tok(LIGHT, '--pv-bg-sub'), grey: tok(LIGHT, '--pv-ink-3') },
  dark: { ink: tok(DARK, '--pv-accent-ink') ?? tok(LIGHT, '--pv-accent-ink'), sea: tok(DARK, '--pv-bg-sub'), grey: tok(DARK, '--pv-ink-3') },
};
for (const [th, T] of Object.entries(THEME)) for (const [k, v] of Object.entries(T)) if (!v) die(`pv-tokens.css の ${th} に色 ${k} が読めない`);

/* 見本の絵の作業の行（数字はここで作る・手で打たない）。段 k ＝ min(AX/1000 − 1, floor(平均 / 1000))。--sketch は toneOf() で作り直して突き合わせる */
const TONE = Object.fromEntries(REGIONS.map(r => [r, Math.min(AX / 1000 - 1, Math.floor(MEAN[r] / 1000))]));
const ORDER_JA = ['japan', 'asia', 'mideast', 'africa', 'europe', 'us', 'oceania', 'latam'];   // 一覧の地域の並び（順位ではない）
const band = k => (k === 0 ? '1,000万円未満' : `${(k * 1000).toLocaleString('en-US')}万円台`);
const LINE = `段は1,000万円ごと（0〜${AX.toLocaleString('en-US')}万円の共通の目盛）。いま ${[...new Set(Object.values(TONE))].sort((a, b) => a - b)
  .map(k => `${band(k)}＝${ORDER_JA.filter(r => TONE[r] === k).map(r => SKETCH_NAMES[r]).join('・')}`).join('／')}。`;
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const hex = c => `#${c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const over = (fg, bg, a) => rgb(fg).map((v, i) => v * a + rgb(bg)[i] * (1 - a));
const lum = c => { const l = c.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
const ratio = (c1, c2) => { const a = lum(c1), b = lum(c2); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };

/* ── COLOR_AT から、その地域の形の縁までの距離（箱の単位）と、形の中に在るか ── */
const segDist = (px, py, [ax, ay], [bx, by]) => {
  const vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L)) : 0;
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
};
const edgeDist = (t, [px, py]) => Math.min(...INFO[t].flatMap(q => q.pts.map((p, i) => segDist(px, py, p, q.pts[(i + 1) % q.pts.length]))));
const winding = (t, [px, py]) => {
  let w = 0;
  for (const q of INFO[t]) for (let i = 0; i < q.pts.length; i++) {
    const [ax, ay] = q.pts[i], [bx, by] = q.pts[(i + 1) % q.pts.length];
    const cr = (bx - ax) * (py - ay) - (px - ax) * (by - ay);
    if (ay <= py) { if (by > py && cr > 0) w++; } else if (by <= py && cr < 0) w--;
  }
  return w;
};

/* ── 8 出す（いつも） ─────────────────────────────────── */
const NAME_JA = { neutral: 'どこにも入れない陸地', ...SKETCH_NAMES };
console.log(`入力: ${RAW}（${GEO.features.length} 件・sha256 ${SHA}）`);
for (const t of TARGETS) {
  const pts = INFO[t].reduce((a, q) => a + q.n, 0);
  console.log(`\n■ ${t}（${NAME_JA[t]}）国 ${MEMBERS[t].length}：${MEMBERS[t].join(' ')}`);
  console.log(`   消し合った境界 ${cancelled[t]} 本・輪 ${INFO[t].length}・点 ${pts}・${BYTES[t].toLocaleString('en-US')} バイト`);
  INFO[t].forEach((q, i) => console.log(`   輪 ${String(i + 1).padStart(2)}: 面積 ${Math.abs(q.a).toFixed(1).padStart(8)}${q.a > 0 ? '（穴）' : ''}・箱の中心 (${q.cx}, ${q.cy})・幅 ${q.w} × 高さ ${q.h}・国 ${q.who.join(' ')}`));
  if (SMALL[t].length) console.log(`   小さすぎて落とした輪（${A_MIN} 平方単位未満）${SMALL[t].length}：${SMALL[t].join(' / ')}`);
}
console.log(`\n会社の国なのに形が無い: ${NO_SHAPE.join(' ') || 'なし'}`);
console.log(`離れた片（大きな片から ${FAR} 度より遠い）: ${farParts.length ? '' : 'なし'}`);
for (const q of farParts) console.log(`   ${q.who} (${q.lon}, ${q.lat}) → ${q.reg}：${q.fate ?? '★扱いが決まっていない'}`);
console.log(`180度の線で落とした片（規則6）: ${dropped180.join(' / ') || 'なし'}`);
console.log(`\n重さ: 9つの形で ${TOTAL.toLocaleString('en-US')} バイト（上限 ${CEIL.toLocaleString('en-US')}）`);
console.log(`\n色の段（緑 --pv-accent-ink を、海 --pv-bg-sub の上に 0.30 + 0.10 × 段 の濃さで）・目盛は 0〜${AX.toLocaleString('en-US')}万円・${AX / 1000} 段`);
for (const th of ['light', 'dark']) {
  const T = THEME[th];
  console.log(`  ${th}：緑 ${T.ink}・海 ${T.sea}`);
  for (let k = 0; k < AX / 1000; k++) {
    const c = over(T.ink, T.sea, 0.30 + 0.10 * k);
    const who = REGIONS.filter(r => Math.min(AX / 1000 - 1, Math.floor(MEAN[r] / 1000)) === k).map(r => `${SKETCH_NAMES[r]} ${MEAN[r].toLocaleString('en-US')}`);
    console.log(`    段 ${k}（${(0.30 + 0.10 * k).toFixed(2)}）${hex(c)}・海との差 ${ratio(c, rgb(T.sea)).toFixed(2)} : 1${who.length ? '・' + who.join(' / ') : ''}`);
  }
  const g = over(T.grey, T.sea, 0.30);
  console.log(`    どこにも入れない陸地（--pv-ink-3 を 0.30）${hex(g)}・海との差 ${ratio(g, rgb(T.sea)).toFixed(2)} : 1`);
}
console.log(`\n見本の作業の行: ${LINE}`);
console.log('\nCOLOR_AT（色を読む点）から、その地域の形の縁までの距離（箱の単位）:');
for (const r of REGIONS) {
  const d = edgeDist(r, COLOR_AT[r]), w = winding(r, COLOR_AT[r]);
  console.log(`   ${r.padEnd(8)} (${COLOR_AT[r].join(', ')})：${d.toFixed(2)}${w ? '' : '・★形の外'}`);
}

/* ── 7 守り（どれか1つでも当たれば書かずに止まる） ─────────────── */
const bad = [];
for (const t of TARGETS) if (!SHAPES[t]) bad.push(`${t} の形が無い`);
if (TOTAL > CEIL) bad.push(`重さが上限を超えた（${TOTAL} > ${CEIL}）：何も変えずに、上の地域ごとのバイト数をリードへ`);
const jp = INFO.japan.reduce((m, q) => ({ x0: Math.min(m.x0, ...q.pts.map(p => p[0])), x1: Math.max(m.x1, ...q.pts.map(p => p[0])), y0: Math.min(m.y0, ...q.pts.map(p => p[1])), y1: Math.max(m.y1, ...q.pts.map(p => p[1])) }), { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 });
if (jp.x1 - jp.x0 < 20 || jp.y1 - jp.y0 < 20) bad.push(`日本の形が小さすぎる（${jp.x1 - jp.x0} × ${jp.y1 - jp.y0}）`);
for (const c of NO_SHAPE) if (!NO_SHAPE_OK.includes(c)) bad.push(`会社の国 ${c} に形が無い（NO_SHAPE_OK に無い）`);
for (const c of NO_SHAPE_OK) if (inShape.has(c)) bad.push(`NO_SHAPE_OK の ${c} に形がある（定数が古い）`);
for (const c of NO_SHAPE_OK) if (!inUse.includes(c)) console.log(`⚠️ NO_SHAPE_OK の ${c} を使う会社がもう無い（定数から外してよい）`);
for (const q of farParts) if (!q.fate) bad.push(`離れた片 ${q.who} (${q.lon}, ${q.lat}) の扱いが決まっていない（地図帳で見て FAR_OK か POLY へ）`);
for (const r of FAR_OK) if (!usedFarOk.has(r.join())) bad.push(`FAR_OK の ${r.join(', ')} に当たる片が無い（定数が古い）`);
if (bad.length) { for (const b of bad) console.error(`❌ ${b}`); process.exit(1); }

/* ── 9 書く（--check のときは比べるだけ） ─────────────────── */
const q = s => `'${String(s).replace(/[\\']/g, (c) => `\\${c}`)}'`;
const list = xs => `[${xs.map(q).join(', ')}]`;
const TEXT = `// GENERATED by import-world-outline.mjs — 手で直さない。
// 一覧の地図の輪郭：Natural Earth「Admin 0 – Countries」1:110m（パブリックドメイン・クレジットは不要）を Equal Earth で写し、8つの地域と
// どこにも入れない陸地に分けて、隣り合う国の境界を消したもの。地域の分け方を変えるときは import-world-outline.mjs の定数を直して流し直す。
// ★ 確かめる答え（目印の点）は world-outline-probes.mjs に在る（生成物に答えを持たせない）。
export const META = { source: 'Natural Earth — Admin 0 – Countries, 1:110m', file: ${q(RAW)},
  home: 'https://www.naturalearthdata.com/downloads/110m-cultural-vectors/', mirror: 'https://github.com/nvkelso/natural-earth-vector',
  author: 'Natural Earth', licence: 'public domain', tag: ${q(TAG)}, seen: ${q(SEEN)}, sha256: ${q(SHA)},
  projection: 'Equal Earth, central meridian 0', bytes: ${TOTAL} };
export const VIEW = { w: ${VIEW.w}, h: ${VIEW.h} };
export const SHAPES = {
${TARGETS.map(t => `  ${t}: ${q(SHAPES[t])},`).join('\n')}
};
export const MEMBERS = {
${TARGETS.map(t => `  ${t}: ${list(MEMBERS[t])},`).join('\n')}
};
export const NO_SHAPE = ${list(NO_SHAPE)};
export const LABELS = {
${REGIONS.map(r => `  ${r}: { x: ${LABELS[r].x.toFixed(1)}, y: ${LABELS[r].y.toFixed(1)}${LABELS[r].left ? ', left: true' : ''} },`).join('\n')}
};
export const JAPAN_MARK = { cx: ${JX}, cy: ${JY}, rHit: ${JAPAN_MARK.rHit}, rTouch: ${JAPAN_MARK.rTouch}, rRing: ${JAPAN_MARK.rRing} };
`;
const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
if (CHECK) {
  if (old === TEXT) console.log('\n✓ 変更なし（world-outline.mjs）');
  else {
    if (old === null) die('world-outline.mjs が無い');
    const a = old.split('\n'), b = TEXT.split('\n'), i = a.findIndex((l, k) => l !== b[k]);
    console.error(`❌ world-outline.mjs が違う（${i + 1} 行目）\n   いま: ${String(a[i]).slice(0, 120)}\n   作り直すと: ${String(b[i]).slice(0, 120)}`);
    process.exit(1);
  }
} else if (old === TEXT) console.log('\n✓ 変更なし（world-outline.mjs）');
else { fs.writeFileSync(OUT, TEXT); console.log(`\n✓ world-outline.mjs を書いた（${Buffer.byteLength(TEXT).toLocaleString('en-US')} バイト）`); }

/* ── 10 見本の絵（--sketch）：地図の部品は directory-map.mjs の mapBox() をそのまま呼ぶ ── */
if (SKETCH) {
  const { mapBox, toneOf } = await import(pathToFileURL(path.join(ROOT, 'directory-map.mjs')).href);
  const tones = Object.fromEntries(REGIONS.map(r => [r, toneOf(MEAN[r], AX)]));
  for (const r of REGIONS) if (tones[r] !== TONE[r]) die(`toneOf() と作業の行の段が違う（${r}: ${tones[r]} / ${TONE[r]}）`);
  const KEY = '濃いほど機長の推定年収が高い';
  const NS_JA = [['HK', '香港'], ['SG', 'シンガポール'], ['MT', 'マルタ'], ['BH', 'バーレーン']];
  const noShape = [...NS_JA.filter(([c]) => NO_SHAPE.includes(c)).map(([, n]) => n), ...NO_SHAPE.filter(c => !NS_JA.some(([k]) => k === c))].join('・');
  const box = (o) => mapBox({ names: SKETCH_NAMES, tones, key: KEY, id: null, ...o });
  const html = `<!doctype html>
<html lang="ja" data-theme="light"><head><meta charset="utf-8"><title>wam sketch</title>
<link rel="stylesheet" href="../pv-tokens.css">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@700;800&family=Noto+Sans+JP:wght@700&display=swap" rel="stylesheet">
<style>
body{margin:0;padding:32px 40px;background:var(--pv-bg);color:var(--pv-ink);font-family:Inter,'Noto Sans JP',sans-serif}
.sk{margin:0 0 40px}.sk-t{margin:0 0 8px;font-size:14px;font-weight:700}.sk-p{margin:4px 0;font-size:13px;line-height:1.7}
.sk-1{width:1200px}.sk-2{width:520px}.sk-3{width:350px}.sk-4{width:241px}
${MAP_CSS}
</style></head><body>
<div class="sk sk-1"><p class="sk-t">1 地域の分け方と色（緑が濃いほど、その地域の機長の推定年収の平均が高い。灰色＝どの地域にも入れない陸地）</p>${box({ uid: '-1' })}</div>
<div class="sk sk-2"><p class="sk-t">2 画面での見た目（PC・幅520px）── 欧州＝選んだ地域、日本＝指している地域</p>${box({ on: 'europe', hot: 'japan', uid: '-2' })}</div>
<div data-theme="dark" style="background:var(--pv-bg);color:var(--pv-ink);padding:16px;margin:0 0 40px;width:fit-content"><div class="sk-2"><p class="sk-t">2b 同じ地図・暗い表示</p>${box({ on: 'europe', hot: 'japan', uid: '-2b' })}</div></div>
<div class="sk sk-3"><p class="sk-t">3 スマホでの大きさ（幅350px）</p>${box({ on: 'europe', hot: 'japan', uid: '-3' })}</div>
<div class="sk sk-4"><p class="sk-t">4 いちばん狭いとき（幅241px・左のメニューが出る1001pxの画面）</p>${box({ on: 'europe', hot: 'japan', uid: '-4' })}</div>
<div class="sk"><p class="sk-p">トルコ・キプロス・ジョージア・アルメニア・アゼルバイジャンは欧州、イランは中東、メキシコ・中米・カリブは中南米、エジプトはアフリカに入れています。ロシアとグリーンランドはどの地域にも入れていません。</p>
<p class="sk-p">${noShape}はこの縮尺では形がありません（地域は周りの国で光ります）。</p>
<p class="sk-p">${LINE}</p></div>
</body></html>
`;
  fs.mkdirSync(SKETCH_DIR, { recursive: true });
  fs.writeFileSync(path.join(SKETCH_DIR, 'wam-sketch.html'), html);
  console.log('✓ 見本の絵を書いた: temporary screenshots/wam-sketch.html');
}
