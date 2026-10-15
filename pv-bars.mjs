/* pv-bars.mjs — 0 から始まる横棒（額の棒）を、書く・読み戻す・確かめる。生成スクリプトと検査だけが読む（配信しない）。
 * ここが決めないもの（呼ぶ側が決める）：額の字（通貨・円の書き方・pv-no-cur）／行の名前／どの行を1組にするか（＝1つの物差し）／
 * 目盛の右端へ渡す最大の額（1組の全部の額から）／見た目（CSS・色・幅）／並び（並べ替えない）。label・sub・text・none・endText・caption・attrs は
 * 呼ぶ側がエスケープ済みの HTML。行を自分で書く呼び手（段階5の地域の図）は、widthOf と checkWidth だけを使う。
 *
 *   axisEnd(max)                    目盛の右端。いちばん大きい額を、そのけたの半分の刻みへ切り上げる（419,300 → 450,000）
 *   widthOf(value, axis)            棒の長さ（'NN.NN%'）。額が無い（0 以下・数でない）か右端が 0 以下なら null ＝ 棒を描かない
 *   checkWidth(width, value, axis)  書かれた長さが widthOf と1文字も違わないか → { ok, why }
 *   barRow / barGroup               行と組の HTML（行の attrs は data-bar のうしろにそのまま書く）
 *   readBars(html, prefix)          書いた HTML を読み戻す（組ごとに attrs・caption・右端の字・行）
 *   checkBars(groups, expect)       読み戻した組が、額に比例しているか（すべての組で1つの目盛・0 から）
 *
 * 見るもの: node pv-bars.mjs --check
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isNum = v => typeof v === 'number' && Number.isFinite(v) && v > 0;
const noWidth = w => w === null || w === undefined || w === '';

/** 目盛の右端。number > 0 → number。刻み ＝ 10 の（けた − 1）乗の半分。 */
export function axisEnd(max) {
  if (!isNum(max)) throw new Error(`axisEnd: 正の数ではない（${max}）`);
  const step = 10 ** Math.floor(Math.log10(max)) / 2;
  return step * Math.ceil(max / step - 1e-9);
}

/** 棒の長さ。右端を超える額は 100% で止める（右端は1組の最大から作るので、ふつうは起きない）。 */
export function widthOf(value, axis) {
  if (!isNum(value) || !isNum(axis)) return null;
  return `${(Math.min(1, value / axis) * 100).toFixed(2)}%`;
}

/** 書かれた長さ（width）が、額と右端から決まる長さと同じか。 */
export function checkWidth(width, value, axis) {
  if (!isNum(axis)) return { ok: false, why: '目盛の右端が 0 以下' };
  const expected = widthOf(value, axis);
  if (expected === null) return noWidth(width) ? { ok: true, why: '' } : { ok: false, why: '額が無いのに棒が在る' };
  if (noWidth(width)) return { ok: false, why: '棒が無い' };
  if (width !== expected) return { ok: false, why: `比例していない（${width} ≠ ${expected}）` };
  return { ok: true, why: '' };
}

/** 1行。額の無い行は棒を描かず、none の字を出す。 */
export function barRow({ prefix, id, label, sub = '', value, end, text, none, attrs = '' }) {
  if (isNum(value) && isNum(end) && value > end) throw new Error(`barRow: 額（${value}）が目盛の右端（${end}）を超えている（右端は1組の最大から作る）`);
  const w = widthOf(value, end);
  const name = `<span class="${prefix}-n">${label}${sub ? `<small>${sub}</small>` : ''}</span>`;
  if (w === null) return `<li class="${prefix}-row is-none" data-bar="${id}"${attrs}>${name}<span class="${prefix}-x">${none}</span></li>`;
  return `<li class="${prefix}-row" data-bar="${id}"${attrs}>${name}<span class="${prefix}-track"><i class="${prefix}-fill" style="width:${w}"></i></span><span class="${prefix}-v">${text}</span></li>`;
}

/** 1組（1つの物差し）。並べ替えない。目盛は 0 と右端の2つの字だけ。 */
export function barGroup({ prefix, rows, end, endText, zero = '0', caption = '', attrs = '' }) {
  return `<div class="${prefix}-g"${attrs}>${caption ? `<p class="${prefix}-t">${caption}</p>` : ''}
<ul class="${prefix}-rows">
${rows.map(r => barRow({ prefix, end, ...r })).join('\n')}
<li class="${prefix}-axis" aria-hidden="true"><span></span><span class="${prefix}-ax"><i>${zero}</i><i>${endText}</i></span><span></span></li>
</ul>
</div>`;
}

const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const plain = s => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/** 書いた HTML を読み戻す。→ [{ attrs, caption, end, rows: [{ id, label, width, text, none }] }] */
export function readBars(html, prefix) {
  const p = reEsc(prefix);
  const groups = [];
  const G = new RegExp(`<div class="${p}-g"([^>]*)>([\\s\\S]*?)\\n</ul>\\n</div>`, 'g');
  for (const m of html.matchAll(G)) {
    const body = m[2];
    const cap = new RegExp(`^<p class="${p}-t">([\\s\\S]*?)</p>`).exec(body);
    const ax = new RegExp(`<span class="${p}-ax"><i>([\\s\\S]*?)</i><i>([\\s\\S]*?)</i></span>`).exec(body);
    const rows = [];
    for (const r of body.matchAll(new RegExp(`<li class="${p}-row( is-none)?" data-bar="([^"]*)"[^>]*>([\\s\\S]*?)</li>(?=\\n)`, 'g'))) {
      const inner = r[3];
      /* 名前の span は、棒（-track）か「額なし」（-x）の span の手前まで（名前の中に em などの字が在ってもよい）。小さい字（sub）は除く。 */
      const head = `<span class="${prefix}-n">`;
      const t = inner.indexOf(`<span class="${prefix}-track">`), x = inner.indexOf(`<span class="${prefix}-x">`), v = inner.indexOf(`<span class="${prefix}-v">`);
      const stop = t >= 0 ? t : x >= 0 ? x : inner.length;
      const name = inner.startsWith(head) ? inner.slice(head.length, stop).replace(/<\/span>$/, '').replace(/<small>(?:(?!<small>)[\s\S])*<\/small>$/, '') : '';
      const fill = new RegExp(`<i class="${p}-fill" style="width:([^"]*)"></i>`).exec(inner);
      const tail = v >= 0 ? inner.slice(v) : x >= 0 ? inner.slice(x) : '';
      rows.push({ id: r[2], label: plain(name), width: fill ? fill[1] : null, text: plain(tail), none: !!r[1] });
    }
    groups.push({ attrs: m[1], caption: cap ? cap[1] : '', end: ax ? plain(ax[2]) : '', rows });
  }
  return groups;
}

/* 書かれた長さ w（'NN.NN%'）と額 v が同時に成り立つ、目盛の右端の幅 [lo, hi]。2けたの丸めの幅だけ広い（境目は両方に含める）。 */
const range = (v, w) => {
  const pct = parseFloat(w);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return null;
  const lo = pct >= 100 ? 0 : 100 * v / (pct + 0.005), hi = 100 * v / (pct - 0.005);
  return [lo * (1 - 1e-9), hi * (1 + 1e-9)];
};

/** 読み戻した組が、額に比例しているか。expect = [[{ id, value | null }, …], …]（組の順）。→ { bad, end }
    END（右端）は1つ ＝ すべての組で1つの目盛・0 から。いちばん大きい額とその長さから右端を出す（first）。
    ただし長さは2けたに丸めてあるので、丸めの境目（55,935 / 300,000 ＝ ちょうど 18.645%）では、ちょうど書いた側の右端でしか全部の長さが
    戻らない。そこで、どの行の長さとも食い違わない区間の中から、けたの少ない数を順に試し、食い違う行がいちばん少ない右端を使う
    （同じなら first に近いほう）。axisEnd は呼ばない（呼ぶ側が、END と書かれた右端の字を比べる）。 */
export function checkBars(groups, expect) {
  const bad = [];
  if (!Array.isArray(groups) || !Array.isArray(expect) || groups.length !== expect.length) {
    bad.push(`組の数が違う（${groups?.length} ≠ ${expect?.length}）`);
    return { bad, end: null };
  }
  const pairs = [];
  groups.forEach((g, i) => {
    const ids = g.rows.map(r => r.id).join(','), want = expect[i].map(e => e.id).join(',');
    if (ids !== want) { bad.push(`組${i + 1}: 行の並びが違う（${ids} ≠ ${want}）`); return; }
    g.rows.forEach((r, j) => pairs.push([r, expect[i][j].value]));
  });
  if (bad.length) return { bad, end: null };
  for (const [r] of pairs) if (r.width != null && parseFloat(r.width) > 100) bad.push(`${r.id}: いちばん長い棒が 100% を超えている（${r.width}）`);
  const valued = pairs.filter(([r, v]) => isNum(v) && r.width != null && r.width !== '');
  let end = null;
  if (valued.length) {
    const [top, tv] = valued.reduce((a, b) => (b[1] > a[1] ? b : a));
    const first = tv / (parseFloat(top.width) / 100);
    /* 行ごとの区間と、いちばん多くの行が重なる区間 */
    const iv = valued.map(([r, v]) => range(v, r.width)).filter(Boolean);
    const pts = iv.flatMap(([lo, hi]) => [[lo, 1], [hi, -1]]).sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    let k = 0, best = 0, seg = null;
    pts.forEach(([x, d], i) => { k += d; if (d > 0 && k > best && i + 1 < pts.length) { best = k; seg = [x, pts[i + 1][0]]; } });
    const cands = [first];
    for (const [lo, hi] of [...iv, ...(seg ? [seg] : [])]) {
      const mid = (lo + hi) / 2;
      for (let d = 1; d <= 12; d++) { const c = Number(mid.toPrecision(d)); if (c >= lo && c <= hi) cands.push(c); }
      cands.push(mid);
    }
    const misses = e => pairs.filter(([r, v]) => !checkWidth(r.width, v, e).ok).length;
    end = cands.filter(e => e > 0).map(e => [e, misses(e)]).sort((a, b) => a[1] - b[1] || Math.abs(a[0] - first) - Math.abs(b[0] - first))[0][0];
  }
  for (const [r, v] of pairs) {
    if (isNum(v) && !r.none && !r.text) bad.push(`${r.id}: 額の在る行に字が無い`);
    const c = end === null ? (isNum(v) ? { ok: false, why: '棒が無い' } : checkWidth(r.width, v, 1)) : checkWidth(r.width, v, end);
    if (!c.ok) bad.push(`${r.id}: ${c.why}`);
  }
  return { bad, end };
}

/* ════════════ 検査 ════════════ */

export function check() {
  const bad = [];
  let n = 0;
  const ok = (cond, what) => { n++; if (!cond) bad.push(what); };
  const thr = (f, what) => { n++; try { f(); bad.push(what); } catch { /* 止まるのが正しい */ } };

  ok(axisEnd(419300) === 450000, 'axisEnd(419300) === 450000');
  ok(axisEnd(35000) === 35000, 'axisEnd(35000) === 35000');
  ok(axisEnd(19583.33) === 20000, 'axisEnd(19583.33) === 20000');
  ok(axisEnd(100000) === 100000, 'axisEnd(100000) === 100000');
  thr(() => axisEnd(0), 'axisEnd(0) が止まらない');
  thr(() => axisEnd(NaN), 'axisEnd(NaN) が止まらない');
  ok(widthOf(220200, 450000) === '48.93%', "widthOf(220200, 450000) === '48.93%'");
  ok(widthOf(5000, 4000) === '100.00%', "widthOf(5000, 4000) === '100.00%'");
  ok(widthOf(0, 10) === null, 'widthOf(0, 10) === null');
  ok(widthOf(null, 10) === null, 'widthOf(null, 10) === null');
  ok(widthOf(5, 0) === null, 'widthOf(5, 0) === null');
  ok(widthOf(NaN, 10) === null, 'widthOf(NaN, 10) === null');
  ok(checkWidth('48.93%', 220200, 450000).ok === true, "checkWidth('48.93%', 220200, 450000).ok === true");
  { const c = checkWidth('50.00%', 220200, 450000); ok(c.ok === false && c.why.startsWith('比例していない'), "checkWidth('50.00%', 220200, 450000) → 比例していない"); }
  ok(checkWidth(null, null, 10).ok === true, 'checkWidth(null, null, 10).ok === true');
  ok(checkWidth('10.00%', null, 10).why === '額が無いのに棒が在る', "checkWidth('10.00%', null, 10) → 額が無いのに棒が在る");
  ok(checkWidth(null, 5, 10).why === '棒が無い', 'checkWidth(null, 5, 10) → 棒が無い');
  thr(() => barRow({ prefix: 'x', id: 'a', label: 'A', value: 11, end: 10, text: '11', none: '—' }), 'barRow で額が右端を超えても止まらない');

  /* 3行・うち1行は額なし。書いて → 読み戻す（id・長さ・none・字・右端） */
  const rows = [
    { id: 'a', label: '品川', sub: '東京都港区', value: 220200, text: '22.02万円' },
    { id: 'b', label: '豊洲', value: null, text: '', none: '—' },
    { id: 'c', label: '横浜', value: 135700, text: '13.57万円' },
  ];
  const end = axisEnd(220200);
  const html = barGroup({ prefix: 'pvg-rb', rows, end, endText: '45万円', caption: '1LDK', attrs: ' data-pvg-rent="ldk1"' });
  const back = readBars(html, 'pvg-rb');
  const g = back[0] || { rows: [] };
  ok(back.length === 1 && g.attrs === ' data-pvg-rent="ldk1"' && g.caption === '1LDK' && g.end === '45万円', '読み戻し: 組・attrs・caption・右端の字');
  ok(g.rows.map(r => r.id).join() === 'a,b,c', '読み戻し: 行の id と並び');
  ok(g.rows[0]?.width === widthOf(220200, end) && g.rows[1]?.width === null && g.rows[2]?.width === widthOf(135700, end), '読み戻し: 棒の長さ（額なしは null）');
  ok(g.rows[1]?.none === true && g.rows[0]?.none === false && g.rows[1]?.text === '—', '読み戻し: none と、その字');
  ok(g.rows[0]?.label === '品川' && g.rows[0]?.text === '22.02万円', '読み戻し: 名前（small を除く）と額の字');
  const want = [rows.map(r => ({ id: r.id, value: r.value }))];
  ok(checkBars(back, want).bad.length === 0, 'checkBars: 書いたとおりの組 → bad なし');
  {
    const edited = readBars(html.replace(`width:${widthOf(135700, end)}`, () => 'width:40.00%'), 'pvg-rb');
    const b = checkBars(edited, want).bad;
    ok(b.length === 1 && b.filter(x => x.includes('比例していない')).length === 1, 'checkBars: 手で1本の長さを変えると「比例していない」がちょうど1行');
  }
  {
    const tracked = html.replace(/<li class="pvg-rb-row is-none" data-bar="b">([\s\S]*?)<\/li>/,
      (m, inner) => `<li class="pvg-rb-row" data-bar="b">${inner.replace('<span class="pvg-rb-x">—</span>', () => '<span class="pvg-rb-track"><i class="pvg-rb-fill" style="width:10.00%"></i></span><span class="pvg-rb-v">x</span>')}</li>`);
    const b = checkBars(readBars(tracked, 'pvg-rb'), want).bad;
    ok(b.some(x => x.includes('額が無いのに棒が在る')), 'checkBars: 額の無い行に棒を足すと「額が無いのに棒が在る」');
  }
  /* 行の attrs（A5 e）: data-bar のうしろにそのまま書かれ、読み戻しは今までと同じ */
  {
    const h2 = barGroup({ prefix: 'pvg-rb', rows: rows.map(r => ({ ...r, attrs: ` data-town="${r.id}x"` })), end, endText: '45万円' });
    const g2 = readBars(h2, 'pvg-rb')[0] || { rows: [] };
    ok(h2.includes('data-bar="a" data-town="ax"') && h2.includes('data-bar="b" data-town="bx"')
      && JSON.stringify(g2.rows) === JSON.stringify(g.rows) && checkBars([g2], want).bad.length === 0, '行の attrs: 書かれて、読み戻しは同じ');
  }
  return { n, bad };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { n, bad } = check();
  if (bad.length) {
    for (const b of bad) console.log('❌ ' + b);
    console.log(`\n❌ pv-bars: ${bad.length}件`);
    process.exit(1);
  }
  console.log(`✅ pv-bars: ${n}項目（目盛の右端・棒の長さ（額なしは描かない・100%で止める）・長さの照合・書いて読み戻す・比例の照合・行の attrs）`);
}
