/* ═══════════════════════════════════════════════════════════════════════
   read-source-pdf.mjs — 出所資料の PDF から本文と表を読む
   ───────────────────────────────────────────────────────────────────────
   salary-sources.mjs（出所台帳）に value_orig / quote を入れるとき、
   原本 PDF の該当箇所を実際に読むための道具。DATA-PROVENANCE.md 5. の
   受入条件2「引用が実際にその資料に存在すること」を機械で満たすために使う。

   使い方:
     node read-source-pdf.mjs sources-raw/xxx.pdf              # 全ページ
     node read-source-pdf.mjs sources-raw/xxx.pdf 25 26        # 印字ページ指定
     node read-source-pdf.mjs sources-raw/xxx.pdf 25 --pos     # 座標つき（表用）

   ★ 表を読むときは必ず --pos を使うこと。
     平文の順に読むと列が混ざる。実例: DALContractComparison-2026.pdf の p.25 は
     Delta / American / United の3社が横に並ぶ表で、平文だと同じ行に $373.33 と
     $375.28 が現れてどちらがどの社か分からない。--pos なら Pay Rate 欄の x 座標
     （Delta=235 / American=384 / United=533）で社を確定できる。

   ★ 外部依存なし（node:zlib のみ）。この Mac には poppler も mutool も無い。
     PDF の構造は自前で読む: 間接オブジェクト → /ObjStm 展開 → /ToUnicode CMap。

   ⚠️ 原本 PDF は sources-raw/（.gitignore 済み）に置く。リポジトリに commit しない
      （public + GitHub Pages のルート配信なので、そのまま公開されてしまう）。
════════════════════════════════════════════════════════════════════════ */
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

const argv = process.argv.slice(2);
const POS  = argv.includes('--pos');
const file = argv.find(a => !a.startsWith('--'));
const want = argv.filter(a => !a.startsWith('--') && a !== file).map(Number);

if (!file) {
  console.error('使い方: node read-source-pdf.mjs <file.pdf> [印字ページ...] [--pos]');
  process.exit(1);
}

const buf = readFileSync(file);
const S   = buf.toString('latin1');

// ── 1. 平文の間接オブジェクトを集める ────────────────────────────
const objs = new Map();   // num -> {dict:string, stream:Buffer|null}

function inflate(raw, dict) {
  try {
    if (/\/FlateDecode/.test(dict)) return zlib.inflateSync(raw);
    return raw;
  } catch { return null; }
}

const objRe = /(\d+)\s+(\d+)\s+obj\b/g;
let m;
while ((m = objRe.exec(S))) {
  const num = +m[1];
  const start = m.index + m[0].length;
  const sIdx = S.indexOf('stream', start);
  const eObj = S.indexOf('endobj', start);
  let dict, stream = null;
  if (sIdx >= 0 && (eObj < 0 || sIdx < eObj)) {
    dict = S.slice(start, sIdx);
    let p = sIdx + 6;
    if (buf[p] === 13) p++;
    if (buf[p] === 10) p++;
    // /Length が直値ならそれを使う。間接参照なら endstream を探す。
    const lm = dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/);
    let end = lm ? p + (+lm[1]) : S.indexOf('endstream', p);
    if (!lm) end = S.lastIndexOf('endstream', S.indexOf('endstream', p) + 1);
    stream = buf.subarray(p, end);
  } else {
    dict = S.slice(start, eObj < 0 ? start + 4000 : eObj);
  }
  objs.set(num, { dict, stream });
}

// ── 2. オブジェクトストリーム（/ObjStm）を展開 ────────────────────
// PDF 1.5 以降はフォント辞書やページ辞書がここに畳み込まれている。
// 展開しないと /ToUnicode に辿り着けず、数字がすべて文字化けする。
for (const [, o] of [...objs]) {
  if (!/\/Type\s*\/ObjStm/.test(o.dict) || !o.stream) continue;
  const data = inflate(o.stream, o.dict);
  if (!data) continue;
  const n     = +(o.dict.match(/\/N\s+(\d+)/) || [])[1];
  const first = +(o.dict.match(/\/First\s+(\d+)/) || [])[1];
  const head  = data.subarray(0, first).toString('latin1').trim().split(/\s+/).map(Number);
  const body  = data.subarray(first).toString('latin1');
  for (let i = 0; i < n; i++) {
    const num = head[i * 2], off = head[i * 2 + 1];
    const nxt = i + 1 < n ? head[i * 2 + 3] : body.length;
    if (!objs.has(num)) objs.set(num, { dict: body.slice(off, nxt), stream: null });
  }
}

const deref = (tok) => {
  const r = String(tok).match(/^(\d+)\s+\d+\s+R$/);
  return r ? objs.get(+r[1]) : null;
};

// ── 3. ToUnicode CMap を読む ─────────────────────────────────────
// サブセット埋め込みフォントは文字コードがグリフ番号になっていて、そのままでは
// 意味を持たない（"$465.13" が "ISUTßPR" に見える）。CMap で元の文字へ戻す。
function parseCMap(objNum) {
  const o = objs.get(objNum);
  if (!o?.stream) return null;
  const data = inflate(o.stream, o.dict);
  if (!data) return null;
  const t = data.toString('latin1');
  const map = new Map();
  const hex2str = (h) => {
    let s = '';
    for (let i = 0; i + 3 < h.length + 1; i += 4) s += String.fromCharCode(parseInt(h.substr(i, 4), 16));
    return s;
  };
  for (const blk of t.match(/beginbfchar([\s\S]*?)endbfchar/g) || []) {
    for (const p of blk.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g) || []) {
      const [, a, b] = p.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/);
      map.set(parseInt(a, 16), hex2str(b));
    }
  }
  for (const blk of t.match(/beginbfrange([\s\S]*?)endbfrange/g) || []) {
    const re = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let r;
    while ((r = re.exec(blk))) {
      const lo = parseInt(r[1], 16), hi = parseInt(r[2], 16), dst = parseInt(r[3], 16);
      for (let c = lo; c <= hi && c - lo < 512; c++) map.set(c, String.fromCharCode(dst + (c - lo)));
    }
  }
  return map.size ? map : null;
}

// ── 4. ページの /Resources からフォント名 -> CMap を組む ───────────
// ⚠️ << >> は入れ子（/Resources<</ExtGState<<…>>/Font<<…>>>>）。非貪欲マッチだと
//    最初の >> で切れて /Font に届かない。また /Resources の直後にスペースが
//    無いことがあるので \s+ ではなく \s* で受ける。ここを間違えるとフォント辞書が
//    空になり、全部が生のグリフ番号で出てくる。
function sliceDict(s, at) {
  let d = 0;
  for (let i = at; i < s.length - 1; i++) {
    if (s[i] === '<' && s[i + 1] === '<') { d++; i++; }
    else if (s[i] === '>' && s[i + 1] === '>') { d--; i++; if (!d) return s.slice(at, i + 1); }
  }
  return s.slice(at);
}
function subDict(dict, key) {
  const mm = dict.match(new RegExp('\\/' + key + '\\s*(\\d+\\s+\\d+\\s+R|<<)'));
  if (!mm) return null;
  if (mm[1] === '<<') return sliceDict(dict, mm.index + mm[0].length - 2);
  return deref(mm[1])?.dict ?? null;
}

function fontMapFor(resTok) {
  const res = /^\d+\s+\d+\s+R$/.test(String(resTok).trim()) ? deref(resTok)?.dict : String(resTok);
  const out = new Map();
  if (!res) return out;
  const fdict = subDict(res, 'Font');
  if (!fdict) return out;
  for (const p of fdict.match(/\/([A-Za-z0-9#+._-]+)\s+(\d+)\s+\d+\s+R/g) || []) {
    const [, name, num] = p.match(/\/([A-Za-z0-9#+._-]+)\s+(\d+)\s+\d+\s+R/);
    const fo = objs.get(+num);
    if (!fo) continue;
    const two = /\/Subtype\s*\/Type0/.test(fo.dict);   // Type0 は2バイトCID
    const tu  = fo.dict.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/);
    let cmap = tu ? parseCMap(+tu[1]) : null;
    if (!cmap) {   // Type0 は子フォント側に ToUnicode がぶら下がることがある
      const df = fo.dict.match(/\/DescendantFonts\s*\[?\s*(\d+)\s+\d+\s+R/);
      const d  = df && objs.get(+df[1]);
      const t2 = d && d.dict.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/);
      if (t2) cmap = parseCMap(+t2[1]);
    }
    out.set(name, { cmap, two });
  }
  return out;
}

// ── 5. 文字列のデコード ───────────────────────────────────────────
function decodeStr(raw, isHex, font) {
  let codes = [];
  if (isHex) {
    const h = raw.replace(/[^0-9A-Fa-f]/g, '');
    const step = font?.two ? 4 : 2;
    for (let i = 0; i < h.length; i += step) codes.push(parseInt(h.substr(i, step).padEnd(step, '0'), 16));
  } else {
    const t = raw.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (x, g) =>
      /^[0-7]/.test(g) ? String.fromCharCode(parseInt(g, 8)) : ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' }[g] ?? g));
    if (font?.two) { for (let i = 0; i < t.length; i += 2) codes.push((t.charCodeAt(i) << 8) | (t.charCodeAt(i + 1) || 0)); }
    else codes = [...t].map(c => c.charCodeAt(0));
  }
  // cmap があるのに引けない文字は捨てる。cmap 自体が無いフォントは WinAnsi 相当として素通し。
  return codes.map(c => font?.cmap?.get(c) ?? (font?.cmap ? '' : String.fromCharCode(c))).join('');
}

// ── 6. コンテンツストリームを走査する ─────────────────────────────
function pageText(content, fonts) {
  let out = '', cur = null;
  const re = /\/([A-Za-z0-9#+._-]+)\s+[\d.]+\s+Tf|\((?:\\.|[^()\\])*\)|<[0-9A-Fa-f\s]*>|\bTJ\b|\bTj\b|\bTD\b|\bTd\b|\bT\*\b|\bET\b/g;
  let t;
  while ((t = re.exec(content))) {
    const s = t[0];
    if (s.endsWith('Tf')) { cur = fonts.get(t[1]) || null; continue; }
    if (s === 'TD' || s === 'Td' || s === 'T*' || s === 'ET') { out += '\n'; continue; }
    if (s[0] === '(') out += decodeStr(s.slice(1, -1), false, cur);
    else if (s[0] === '<') out += decodeStr(s.slice(1, -1), true, cur);
  }
  return out;
}

// 表の列（＝どの航空会社の欄か）を確定させるため、文字列を座標つきで拾う。
// Tm で絶対位置、Td/TD で相対移動、TL/T* で行送り。
function pageItems(content, fonts) {
  const items = [];
  let cur = null, x = 0, y = 0, lx = 0, ly = 0, lead = 0, bufS = '';
  const flush = () => { if (bufS.trim()) items.push({ x: lx, y: ly, s: bufS }); bufS = ''; };
  const re = /(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm|(-?[\d.]+)\s+(-?[\d.]+)\s+(TD|Td)|(-?[\d.]+)\s+TL|\/([A-Za-z0-9#+._-]+)\s+[\d.]+\s+Tf|\((?:\\.|[^()\\])*\)|<[0-9A-Fa-f\s]*>|\bT\*|\bBT\b|\bET\b/g;
  let t;
  while ((t = re.exec(content))) {
    const s = t[0];
    if (s.endsWith('Tm'))         { flush(); x = lx = +t[5]; y = ly = +t[6]; continue; }
    if (/(TD|Td)$/.test(s))       { flush(); x = lx = x + +t[7]; y = ly = y + +t[8]; if (t[9] === 'TD') lead = -+t[8]; continue; }
    if (s.endsWith('TL'))         { lead = +t[10]; continue; }
    if (s.endsWith('Tf'))         { cur = fonts.get(t[11]) || null; continue; }
    if (s === 'T*')               { flush(); y = ly = y - lead; x = lx; continue; }
    if (s === 'BT' || s === 'ET') { flush(); continue; }
    if (s[0] === '(') bufS += decodeStr(s.slice(1, -1), false, cur);
    else if (s[0] === '<') bufS += decodeStr(s.slice(1, -1), true, cur);
  }
  flush();
  return items;
}

// ── 7. ページを順に処理 ──────────────────────────────────────────
const pages = [];
for (const [num, o] of objs) {
  if (!/\/Type\s*\/Page[^s]/.test(o.dict)) continue;
  pages.push({ num, dict: o.dict });
}
pages.sort((a, b) => a.num - b.num);

let shown = 0;
for (const p of pages) {
  const cm = p.dict.match(/\/Contents\s+(?:(\d+)\s+\d+\s+R|\[([^\]]*)\])/);
  if (!cm) continue;
  const nums = cm[1] ? [+cm[1]] : [...(cm[2].match(/(\d+)\s+\d+\s+R/g) || [])].map(x => +x.match(/(\d+)/)[1]);
  let content = '';
  for (const n of nums) {
    const c = objs.get(n);
    if (!c?.stream) continue;
    const d = inflate(c.stream, c.dict);
    if (d) content += d.toString('latin1');
  }
  if (!content) continue;

  const rm = p.dict.match(/\/Resources\s*(\d+\s+\d+\s+R|<<)/);
  const resTok = !rm ? '' : rm[1] === '<<' ? sliceDict(p.dict, rm.index + rm[0].length - 2) : rm[1];
  const fonts  = fontMapFor(resTok);

  const clean = pageText(content, fonts).replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  const printed = (clean.match(/^\s*(\d{1,3})\b/) || [])[1];   // ページ番号は本文の先頭に出る
  if (want.length && !want.includes(+printed)) continue;
  shown++;

  console.log(`\n═══ obj ${p.num} ／ 印字ページ ${printed ?? '?'} ═══`);
  if (!POS) { console.log(clean); continue; }

  // y 降順（上から下）→ x 昇順（左から右）で、行ごとに座標つきで出す
  const rows = [];
  for (const i of pageItems(content, fonts).sort((a, b) => (b.y - a.y) || (a.x - b.x))) {
    const r = rows.find(r => Math.abs(r.y - i.y) < 4);
    if (r) r.cells.push(i); else rows.push({ y: i.y, cells: [i] });
  }
  for (const r of rows) {
    console.log(`y=${r.y.toFixed(0).padStart(4)} │ ` +
      r.cells.sort((a, b) => a.x - b.x).map(c => `${c.x.toFixed(0)}:${c.s}`).join('  '));
  }
}

if (!shown) {
  console.error(want.length ? `該当ページなし（印字ページ ${want.join(', ')}）` : 'テキストを取り出せるページがありません');
  process.exitCode = 1;
}
