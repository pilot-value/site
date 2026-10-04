/* QR コードの符号化（2026-10-04）。依存なし ── import が1つも無い。
 *
 * 共有カード（career.html の ?view=card）に載せる、各社の公開ページの URL の QR を作る。
 * 呼ぶのは gen-career.mjs（行列を HTML の <script id="crc-data"> に書く）。
 * .mjs は配信されないので、ブラウザがこのファイルを読むことは無い。
 *
 *   qrMatrix(text)  → 0／1 の行列（[行][列]・1 が暗いマス）。**静かな余白は入っていない**
 *   selfTest()      → { ok, total, failed:[…] }。node career-qr.mjs --check で同じものが走る
 *
 * 決めてあること：バイトモード（UTF-8）・誤り訂正 M・版は入るうちでいちばん小さいもの（1〜40）・
 * マスクは8通りを採点していちばん点の低いもの。M で入るのは 2,331 バイトまで。
 * 同じ文字列からは必ず同じ行列が出る（乱数も時刻も使わない＝生成物が流すたびに変わらない）。
 *
 * ⚠️ 描く側が守ること（行列には入っていない。どれも 2026-10-04 に4つの読み取り器で測った）
 *   ・四方に **4マスぶんの明るい余白** を置く。
 *     余白なしで暗い地に置くと、4つのうち3つが5社とも読めなかった。
 *   ・**1 を暗い色・0 を明るい色**で描く。暗い地に明るいマス（反転）にしない
 *     ── 反転は、4つのうち1つが5社とも読めなかった。
 *     黒×金のデザインでも QR の下に明るい板を敷く（黒に近い色／金の板 は4つとも読めた）。
 *   ・1マスは整数の画素数で描く（にじませない・拡大縮小で補間させない）。
 *   ・行列の大きさは文字列の長さで変わる（版1 = 21マス・版が1つ上がるごとに +4）。
 *     5社の URL でも 29マス（JAL・ANA）と 33マス（ほか3社）がある。**マスの数を決め打ちしない。**
 *
 * ⚠️ 表（EC_PER_BLOCK・BLOCKS）や模様の置き方を直したら、**別の読み取り器で読み直す。**
 *   selfTest() の往復は、同じ表を使う自前の読み取りなので、表ごと間違えていても通る。
 *   それを捕まえるのが FROZEN ── 別の読み取り器で読めた行列の指紋。
 *   指紋が変わったら、読み直してから指紋を書き換える（読み直し方はファイルの末尾）。
 */

// ── 表（誤り訂正 M の列だけ。添字 = 版）
// 1ブロックあたりの訂正語の数
const EC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26,
  26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
// ブロックの数
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16,
  17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];

const MAX_VER = 40;
const sizeOf = ver => ver * 4 + 17;

// ── GF(256)（x^8 + x^4 + x^3 + x^2 + 1）
const EXP = new Uint8Array(510);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = EXP[i + 255] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

// (x - α^0)(x - α^1)…(x - α^(deg-1))。係数は次数の高い順・先頭は 1
const gens = [];
function rsGen(deg) {
  if (gens[deg]) return gens[deg];
  let g = [1];
  for (let i = 0; i < deg; i++) {
    const next = new Array(g.length + 1).fill(0);
    g.forEach((v, j) => { next[j] ^= v; next[j + 1] ^= mul(v, EXP[i]); });
    g = next;
  }
  return (gens[deg] = g);
}

// データを生成多項式で割った余り＝訂正語
function rsRemainder(data, deg) {
  const g = rsGen(deg);
  const rem = new Array(deg).fill(0);
  for (const b of data) {
    const k = b ^ rem.shift();
    rem.push(0);
    for (let i = 0; i < deg; i++) rem[i] ^= mul(g[i + 1], k);
  }
  return rem;
}

// ── 形式情報（誤り訂正の段 M = 00 とマスクの番号）と版の情報。どちらも BCH 符号
function formatBits(mask) {
  let rem = mask;                                   // M = 00 なので上の2ビットは 0
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((mask << 10) | rem) ^ 0x5412;
}
function versionBits(ver) {
  let rem = ver;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (ver << 12) | rem;
}

// 形式情報を置くマス。2か所に同じ15ビット（添字 = ビットの番号）
function formatCells(n) {
  const a = [], b = [];
  for (let i = 0; i <= 5; i++) a.push([i, 8]);
  a.push([7, 8], [8, 8], [8, 7]);
  for (let i = 9; i < 15; i++) a.push([8, 14 - i]);
  for (let i = 0; i < 8; i++) b.push([8, n - 1 - i]);
  for (let i = 8; i < 15; i++) b.push([n - 15 + i, 8]);
  return [a, b];
}
// 版の情報を置くマス（版7から）。右上と左下に同じ18ビット
function versionCells(n) {
  const out = [];
  for (let i = 0; i < 18; i++) {
    const a = n - 11 + (i % 3), b = Math.floor(i / 3);
    out.push([[b, a], [a, b]]);
  }
  return out;
}

// 位置合わせの模様の中心（行・列で共通）
function alignPos(ver) {
  if (ver === 1) return [];
  const count = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (count * 2 - 2)) * 2;
  const out = [6];
  for (let p = sizeOf(ver) - 7; out.length < count; p -= step) out.splice(1, 0, p);
  return out;
}

// ── 版ごとの土台：動かない模様（dark）と、データを置けないマスの印（fixed）
const frames = [];
function frame(ver) {
  if (frames[ver]) return frames[ver];
  const n = sizeOf(ver);
  const dark = Array.from({ length: n }, () => new Uint8Array(n));
  const fixed = Array.from({ length: n }, () => new Uint8Array(n));
  const set = (r, c, v) => { dark[r][c] = v ? 1 : 0; fixed[r][c] = 1; };

  for (let i = 0; i < n; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }      // 目盛
  for (const [cr, cc] of [[3, 3], [3, n - 4], [n - 4, 3]]) {                           // 3隅の目印と、その周りの明るい帯
    for (let dr = -4; dr <= 4; dr++) for (let dc = -4; dc <= 4; dc++) {
      const r = cr + dr, c = cc + dc;
      if (r < 0 || r >= n || c < 0 || c >= n) continue;
      const d = Math.max(Math.abs(dr), Math.abs(dc));
      set(r, c, d !== 2 && d !== 4);
    }
  }
  const pos = alignPos(ver), last = pos.length - 1;                                     // 位置合わせ（3隅と重なる所は置かない）
  pos.forEach((r, i) => pos.forEach((c, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  }));
  const fmt = formatCells(n).flat();
  for (const [r, c] of fmt) set(r, c, 0);                                               // 形式情報は場所だけ取る（中身はマスクが決まってから）
  set(n - 8, 8, 1);                                                                     // いつも暗い1マス
  if (ver >= 7) {
    const bits = versionBits(ver);
    versionCells(n).forEach((pair, i) => { for (const [r, c] of pair) set(r, c, (bits >>> i) & 1); });
  }

  let free = 0;
  for (const row of fixed) for (const v of row) free += 1 - v;
  const total = free >>> 3;                                                             // 全部の語の数（端数のビットは 0 のまま残る）
  const nb = BLOCKS[ver], ec = EC_PER_BLOCK[ver];
  return (frames[ver] = {
    n, dark, fixed, fmt, total, nb, ec,
    data: total - nb * ec,                                                              // データに使える語の数
    short: Math.floor(total / nb) - ec,                                                 // 短い方のブロックのデータの長さ
    nShort: nb - (total % nb),                                                          // 短い方のブロックの数（残りは1語長い）
  });
}

// データを置く順（右下から2列ずつ、上・下・上…と折り返す）に、置けるマスを1つずつ渡す
function walk(ver, fn) {
  const { n, fixed } = frame(ver);
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;                                                         // 縦の目盛の列は飛ばす
    const up = ((right + 1) & 2) === 0;
    for (let k = 0; k < n; k++) {
      const r = up ? n - 1 - k : k;
      for (const c of [right, right - 1]) if (!fixed[r][c]) fn(r, c);
    }
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r, c) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

// ── 文字列 → バイト
const utf8 = text => {
  if (typeof text !== 'string') throw new Error('career-qr: 文字列を渡す');
  if (text === '') throw new Error('career-qr: 空の文字列（URL が抜けている）');
  const bytes = new TextEncoder().encode(text);
  // 対になっていないサロゲートは TextEncoder が黙って別の字に置き換える ＝ 読んだ結果が元と違ってしまう
  if (new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes) !== text) throw new Error('career-qr: 壊れた文字が入っている');
  return bytes;
};

const lenBits = ver => (ver < 10 ? 8 : 16);                                             // 文字数を書く欄の幅
const capacity = ver => (frame(ver).data * 8 - 4 - lenBits(ver)) >>> 3;                 // その版に入るバイト数

function pickVersion(len, min = 1) {
  for (let ver = min; ver <= MAX_VER; ver++) if (len <= capacity(ver)) return ver;
  throw new Error(`career-qr: 長すぎる（${len} バイト。入るのは ${capacity(MAX_VER)} バイトまで）`);
}

// バイト → データの語（モード・文字数・本体・終わりの印・埋め草）
function codewords(bytes, ver) {
  const cap = frame(ver).data * 8;
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, lenBits(ver));
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const out = new Uint8Array(cap >>> 3);
  bits.forEach((b, i) => { out[i >>> 3] |= b << (7 - (i & 7)); });
  return out;
}

// データの語をブロックに分け、訂正語を付け、1語ずつ交互に並べ直す
function interleave(data, ver) {
  const { nb, ec, short, nShort } = frame(ver);
  const blocks = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const len = short + (i < nShort ? 0 : 1);
    const d = data.subarray(k, k + len);
    k += len;
    blocks.push({ d, e: rsRemainder(d, ec) });
  }
  const out = [];
  for (let i = 0; i <= short; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < ec; i++) for (const b of blocks) out.push(b.e[i]);
  return out;
}

// 土台にデータを置く（マスクはまだ掛けない）
function place(ver, stream) {
  const m = frame(ver).dark.map(row => Uint8Array.from(row));
  let i = 0;
  walk(ver, (r, c) => {
    if (i < stream.length * 8) m[r][c] = (stream[i >>> 3] >>> (7 - (i & 7))) & 1;
    i++;
  });
  return m;
}

// マスクを掛け、形式情報を書く
function masked(base, ver, mask) {
  const { n, fixed } = frame(ver);
  const hit = MASKS[mask];
  const m = base.map((row, r) => row.map((v, c) => (!fixed[r][c] && hit(r, c) ? v ^ 1 : v)));
  const bits = formatBits(mask);
  for (const cells of formatCells(n)) cells.forEach(([r, c], i) => { m[r][c] = (bits >>> i) & 1; });
  return m;
}

// ── 読みにくさの採点（低いほど良い）
function penalty(m) {
  const n = m.length;
  let p = 0;
  const line = get => {
    // 同じ色が5つ以上続く
    for (let i = 1, run = 1; i <= n; i++) {
      if (i < n && get(i) === get(i - 1)) { run++; continue; }
      if (run >= 5) p += 3 + (run - 5);
      run = 1;
    }
    // 3隅の目印と同じ並び（暗・明・暗暗暗・明・暗）の前か後ろに、明が4つ。外側は余白＝明
    const at = i => (i < 0 || i >= n ? 0 : get(i));
    for (let i = 0; i + 6 < n; i++) {
      if (!(at(i) && !at(i + 1) && at(i + 2) && at(i + 3) && at(i + 4) && !at(i + 5) && at(i + 6))) continue;
      if (!at(i - 1) && !at(i - 2) && !at(i - 3) && !at(i - 4)) p += 40;
      if (!at(i + 7) && !at(i + 8) && !at(i + 9) && !at(i + 10)) p += 40;
    }
  };
  for (let k = 0; k < n; k++) { line(i => m[k][i]); line(i => m[i][k]); }
  // 同じ色の 2×2
  for (let r = 0; r + 1 < n; r++) for (let c = 0; c + 1 < n; c++) {
    const v = m[r][c];
    if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) p += 3;
  }
  // 暗いマスの割合が半分から離れるほど（5% ごとに 10 点）
  let dark = 0;
  for (const row of m) for (const v of row) dark += v;
  p += Math.floor((Math.abs(dark * 2 - n * n) * 10) / (n * n)) * 10;
  return p;
}

/* 文字列 → QR の行列。opts は検査用（画面を作る側は渡さない）。
 *   opts.mask        0〜7 を渡すと採点せずそのマスクで作る（別の符号化器と1マスずつ突き合わせるため）
 *   opts.minVersion  これより小さい版にしない（短い文字列で大きい版を作るため）
 *   ⚠️ 5社の大きさをそろえる目的で minVersion を使わない。ANA の URL を版4にした行列は、
 *      読み取り器の1つ（ZXing の JS 版）が1マス4画素以上で読めなかった。既定のままなら5社とも読めた。
 */
export function qrMatrix(text, opts = {}) {
  const bytes = utf8(text);
  const { mask, minVersion = 1 } = opts;
  if (!Number.isInteger(minVersion) || minVersion < 1 || minVersion > MAX_VER) throw new Error('career-qr: minVersion は 1〜40');
  if (mask !== undefined && !(Number.isInteger(mask) && mask >= 0 && mask <= 7)) throw new Error('career-qr: mask は 0〜7');
  const ver = pickVersion(bytes.length, minVersion);
  const base = place(ver, interleave(codewords(bytes, ver), ver));
  let best = null;
  for (const k of mask === undefined ? MASKS.keys() : [mask]) {
    const m = masked(base, ver, k);
    const p = penalty(m);
    if (!best || p < best.p) best = { m, p };                                           // 同点なら番号の小さい方
  }
  return best.m.map(row => Array.from(row));
}

/* ──────────────────────────────────────────────────────────────────────────
 * ここから下は検査。
 * ────────────────────────────────────────────────────────────────────────── */

// 行列 → 文字列（自前の読み取り。誤りは直さない ── 1ビットでも合わなければ投げる）
function read(matrix) {
  const n = matrix.length;
  const ver = (n - 17) / 4;
  if (!Number.isInteger(ver) || ver < 1 || ver > MAX_VER || matrix.some(row => row.length !== n)) throw new Error('大きさが QR の形でない');
  if (matrix.some(row => row.some(v => v !== 0 && v !== 1))) throw new Error('0／1 でない値がある');
  const F = frame(ver);

  const [fa, fb] = formatCells(n).map(cells => cells.reduce((acc, [r, c], i) => acc | (matrix[r][c] << i), 0));
  if (fa !== fb) throw new Error('形式情報が2か所で違う');
  const mask = [...MASKS.keys()].find(k => formatBits(k) === fa);
  if (mask === undefined) throw new Error('形式情報が読めない（誤り訂正 M のどのマスクでもない）');

  const isFmt = new Set(F.fmt.map(([r, c]) => r * n + c));
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (F.fixed[r][c] && !isFmt.has(r * n + c) && matrix[r][c] !== F.dark[r][c]) throw new Error(`動かない模様が違う（${r},${c}）`);
  }

  const stream = new Uint8Array(F.total);
  let i = 0, tail = 0;
  walk(ver, (r, c) => {
    const bit = matrix[r][c] ^ (MASKS[mask](r, c) ? 1 : 0);
    if (i < F.total * 8) stream[i >>> 3] |= bit << (7 - (i & 7)); else tail |= bit;
    i++;
  });
  if (tail) throw new Error('端数のビットが 0 でない');

  const blocks = Array.from({ length: F.nb }, (_, b) => ({ len: F.short + (b < F.nShort ? 0 : 1), d: [], e: [] }));
  let k = 0;
  for (let j = 0; j <= F.short; j++) for (const b of blocks) if (j < b.len) b.d.push(stream[k++]);
  for (let j = 0; j < F.ec; j++) for (const b of blocks) b.e.push(stream[k++]);
  blocks.forEach((b, bi) => {
    for (let j = 0; j < F.ec; j++) {
      let s = 0;
      for (const v of [...b.d, ...b.e]) s = mul(s, EXP[j]) ^ v;
      if (s) throw new Error(`訂正語が合わない（ブロック ${bi}）`);
    }
  });

  const data = blocks.flatMap(b => b.d);
  let pos = 0;
  const take = len => {
    let v = 0;
    for (let j = 0; j < len; j++, pos++) v = (v << 1) | ((data[pos >>> 3] >>> (7 - (pos & 7))) & 1);
    return v;
  };
  if (take(4) !== 0b0100) throw new Error('バイトモードでない');
  const len = take(lenBits(ver));
  const bytes = new Uint8Array(len);
  for (let j = 0; j < len; j++) bytes[j] = take(8);
  const end = Math.min(4, data.length * 8 - pos);
  if (take(end) !== 0) throw new Error('終わりの印が 0 でない');
  if (pos % 8 && take(8 - (pos % 8)) !== 0) throw new Error('語の境目までが 0 で埋まっていない');
  for (let pad = 0xec; pos < data.length * 8; pad ^= 0xec ^ 0x11) if (take(8) !== pad) throw new Error('埋め草が EC・11 の交互でない');
  return { text: new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes), ver, mask };
}

// 行列の指紋（大きさ:FNV-1a）。変わったことに気づくためのもので、暗号ではない
function print(m) {
  let h = 0x811c9dc5;
  for (const row of m) for (const v of row) h = Math.imul(h ^ v, 0x01000193) >>> 0;
  return `${m.length}:${h.toString(16).padStart(8, '0')}`;
}

// 別の読み取り器で読めた行列の指紋（5社の公開ページ）。書き換える前に、読み直す
const FROZEN = {
  'https://pilot-value.com/airlines/jal.html': '29:9e793494',
  'https://pilot-value.com/airlines/ana.html': '29:35de1896',
  'https://pilot-value.com/airlines/cathay-pacific.html': '33:adb0bc2c',
  'https://pilot-value.com/airlines/etihad.html': '33:aa2131e4',
  'https://pilot-value.com/airlines/eva-air.html': '33:267b6f08',
};

// 規格書の表から（上の計算と別の出どころ ── 両方が同じ答えなら、片方の写し間違いではない）
const KNOWN = {
  // 誤り訂正 M でデータに使える語の数（版1〜40）
  data: [16, 28, 44, 64, 86, 108, 124, 154, 182, 216, 254, 290, 334, 365, 415, 453, 507, 563, 627, 669,
    714, 782, 860, 914, 1000, 1062, 1128, 1193, 1267, 1373, 1455, 1541, 1631, 1725, 1812, 1914, 1992, 2102, 2216, 2334],
  // 形式情報（M・マスク 0〜7）
  format: [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0],
  // 版の情報（版7〜40）
  version: [0x07c94, 0x085bc, 0x09a99, 0x0a4d3, 0x0bbf6, 0x0c762, 0x0d847, 0x0e60d, 0x0f928, 0x10b78,
    0x1145d, 0x12a17, 0x13532, 0x149a6, 0x15683, 0x168c9, 0x177ec, 0x18ec4, 0x191e1, 0x1afab,
    0x1b08e, 0x1cc1a, 0x1d33f, 0x1ed75, 0x1f250, 0x209d5, 0x216f0, 0x228ba, 0x2379f, 0x24b0b,
    0x2542e, 0x26a64, 0x27541, 0x28c69],
  // 位置合わせの模様の中心
  align: { 2: [6, 18], 7: [6, 22, 38], 14: [6, 26, 46, 66], 15: [6, 26, 48, 70], 21: [6, 28, 50, 72, 94],
    32: [6, 34, 60, 86, 112, 138], 36: [6, 24, 50, 76, 102, 128, 154], 40: [6, 30, 58, 86, 114, 142, 170] },
  // 「HELLO WORLD」を版1・M に入れたときのデータの語と、その訂正語
  rs: { d: [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17], e: [196, 35, 39, 119, 235, 215, 231, 226, 93, 23] },
};

export function selfTest() {
  const failed = [];
  let total = 0;
  const ok = (cond, msg) => { total++; if (!cond) failed.push(msg); };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const throws = fn => { try { fn(); return false; } catch { return true; } };

  // 1) 計算した値 ⇄ 規格書の表
  for (let v = 1; v <= MAX_VER; v++) ok(frame(v).data === KNOWN.data[v - 1], `版${v}: データの語の数が ${frame(v).data}（表は ${KNOWN.data[v - 1]}）`);
  KNOWN.format.forEach((bits, k) => ok(formatBits(k) === bits, `形式情報: マスク${k}`));
  KNOWN.version.forEach((bits, i) => ok(versionBits(i + 7) === bits, `版の情報: 版${i + 7}`));
  for (const [v, pos] of Object.entries(KNOWN.align)) ok(same(alignPos(+v), pos), `位置合わせの模様: 版${v}`);
  ok(same(rsRemainder(KNOWN.rs.d, 10), KNOWN.rs.e), '訂正語: HELLO WORLD（版1・M）');
  ok(capacity(1) === 14 && capacity(10) === 213 && capacity(MAX_VER) === 2331, '入るバイト数（版1 = 14・版10 = 213・版40 = 2,331）');

  // 2) 往復：行列 → 自前の読み取り → 元の文字列
  const round = (text, want) => {
    try {
      const m = qrMatrix(text);
      const got = read(m);
      ok(got.text === text, `往復: 読んだ結果が違う（${text.length}字）`);
      if (want) ok(got.ver === want, `往復: ${text.length}字が版${got.ver} に入った（版${want} のはず）`);
      return m;
    } catch (e) { ok(false, `往復: ${text.slice(0, 24)}…（${text.length}字） ${e.message}`); return null; }
  };
  for (const [url, fp] of Object.entries(FROZEN)) {
    const m = round(url);
    ok(m && print(m) === fp, `指紋が変わった: ${url}（別の読み取り器で読み直してから FROZEN を書き換える）`);
  }
  ok(Object.keys(FROZEN).length === 5, 'FROZEN は5社ぶん');
  // どの版も、ちょうど入る長さはその版に・1バイト多いと次の版に
  const fill = len => Array.from({ length: len }, (_, i) => 'pilot-value.com/'[i % 16]).join('');
  for (let v = 1; v <= MAX_VER; v++) {
    round(fill(capacity(v)), v);
    if (v < MAX_VER) round(fill(capacity(v) + 1), v + 1);
  }
  round('a', 1);
  round('エティハド航空 機長・副操縦士', 4);                                                // 3バイトの字（43バイト）
  round('✈︎🛫 A320／B787', 2);                                                            // 4バイトの字
  round('﻿BOM から始まる', 2);
  round('0123456789', 1);                                                                 // 数字だけでもバイトモードのまま
  // マスクを名指ししても読める・版を下げない指定が効く
  for (const k of MASKS.keys()) {
    try { const got = read(qrMatrix('https://pilot-value.com/', { mask: k })); ok(got.mask === k && got.text === 'https://pilot-value.com/', `マスク${k} を名指し`); }
    catch (e) { ok(false, `マスク${k} を名指し: ${e.message}`); }
  }
  ok(qrMatrix('a', { minVersion: 4 }).length === sizeOf(4), 'minVersion: 4 → 33マス');

  // 3) 形
  const m = qrMatrix('https://pilot-value.com/');
  ok(m.length === sizeOf(2) && m.every(row => Array.isArray(row) && row.length === m.length && row.every(v => v === 0 || v === 1)), '行列は正方形で 0／1 だけ');
  ok(same(m, qrMatrix('https://pilot-value.com/')), '同じ文字列から同じ行列');
  ok(!same(m, qrMatrix('https://pilot-value.com/a')), '違う文字列からは違う行列');
  ok(m[0].slice(0, 8).join('') === '11111110' && m[7].slice(0, 8).join('') === '00000000' && m[m.length - 8][8] === 1, '左上の目印・明るい帯・いつも暗い1マス');

  // 4) 断るもの
  ok(throws(() => qrMatrix('')), '空の文字列を断る');
  ok(throws(() => qrMatrix(undefined)) && throws(() => qrMatrix(123)), '文字列でないものを断る');
  ok(throws(() => qrMatrix(fill(capacity(MAX_VER) + 1))), '長すぎるものを断る');
  ok(throws(() => qrMatrix('\ud800')), '壊れた文字を断る');
  ok(throws(() => qrMatrix('a', { mask: 8 })) && throws(() => qrMatrix('a', { minVersion: 41 })), '範囲の外の指定を断る');

  // 5) 自前の読み取りが、壊れた行列を通さない（通すなら 2) は何も確かめていない）
  const flip = (r, c) => { const x = m.map(row => row.slice()); x[r][c] ^= 1; return x; };
  ok(throws(() => read(flip(m.length - 1, m.length - 1))), '読み取り: データが1マス違えば投げる');
  ok(throws(() => read(flip(0, 0))), '読み取り: 目印が1マス違えば投げる');
  ok(throws(() => read(flip(8, 0))), '読み取り: 形式情報が1マス違えば投げる');

  return { ok: failed.length === 0, total, failed };
}

/* 確かめ方（別の読み取り器で読み直す）
 *   行列を、1マス数画素・四方に4マスの余白を付けた白黒の画像にして、読み取り器に渡す。
 *   リポジトリに依存を足さない ── 読み取り器は作業用のフォルダに入れる（npm i jsqr zxing-wasm など）。
 *   Chrome の BarcodeDetector は依存なしで使える（Puppeteer で canvas に描いて detect）。
 *   https の文脈でしか出ないので、要求を横取りして空のページを返すか、localhost で開く。
 *
 *   2026-10-04 に確かめたこと（5社の URL ＋ 長さ 1〜2,331 バイト・版1〜40 ぜんぶ・マスク 0〜7・日本語と絵文字 の 174本）
 *     ・jsQR … 174本とも同じ文字列・同じ版
 *     ・zxing-cpp（wasm）… 174本とも同じ文字列・同じ版・誤り訂正 M
 *     ・Chrome の BarcodeDetector（macOS の読み取り器）… 174本とも同じ文字列
 *     ・ZXing の JS 版 … 行列をそのまま渡す読み方は 174本とも。画像から探す読み方は 160本
 *       （落ちた14本は、別の符号化器が作った同じ行列でも同じように落ちる ＝ 読み取り器の側の癖。
 *         既定のままの5社の URL は1本も入っていない。入っているのは ANA を版4に上げた形 ── qrMatrix の注意書き）
 *     ・別の符号化器（npm の qrcode）と1マスずつ突き合わせ … 174本 × マスク8通り がぜんぶ一致
 *
 *   手元の電話で見たいときは  node career-qr.mjs "https://pilot-value.com/airlines/etihad.html"
 *   （端末に QR が出る）。
 */
if (typeof process !== 'undefined' && /(^|[\\/])career-qr\.mjs$/.test(process.argv?.[1] ?? '')) {
  const arg = process.argv[2];
  if (arg === undefined || arg === '--check') {
    const r = selfTest();
    for (const f of r.failed) console.log('❌ ' + f);
    console.log(r.ok ? `✅ career-qr: ${r.total} 項目` : `❌ career-qr: ${r.failed.length} / ${r.total} 項目が落ちた`);
    process.exit(r.ok ? 0 : 1);
  } else {
    const m = qrMatrix(arg);
    const pad = '\x1b[47m  \x1b[0m';
    const edge = pad.repeat(m.length + 8);
    const rows = m.map(row => pad.repeat(4) + row.map(v => (v ? '\x1b[40m  \x1b[0m' : pad)).join('') + pad.repeat(4));
    console.log([edge, edge, edge, edge, ...rows, edge, edge, edge, edge].join('\n'));
    console.log(`${m.length} × ${m.length} マス`);
  }
}
