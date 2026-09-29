// patch-stat-avg.mjs
// 航空会社ページ（日本語）の年収を salary-data.mjs の avg（平均）1つに揃える。
//   1) 冒頭のカード … 値を avg 1つに・ラベルを「機長 平均年収」に
//   2) 年収の表    … 3列目の見出しを「平均年収」に・機長／副操縦士の行を SSOT に
//
// なぜ要るか ── 英語版 112枚は最初から "Capt. Avg (pre-tax)" ＝ 平均1つだが、
// 日本語版だけが「機長年収（目安）¥2,000万〜3,900万」のようにレンジを出していて、
// 幅が広すぎて読めない（2026-09-28 オーナー指示「平均として書いてもらえる？全ての航空会社そうして」
// ／同日「ちゃんと平均をかけ」）。
//
// ⚠️ 表の3列目は 70枚が「参考中央値」と名乗っていたが、入っている数は SSOT の avg ＝ 平均。
//    中央値ではない（そもそもこのサイトは中央値を持っていない）。名前が数と違っていた。
//
// ⚠️ 見出しが同じでも中身が平均でない表が5枚あった（アメリカン・キャセイ・ルフトハンザ・
//    サウスウエスト・ユナイテッド）。あれは「機長 Year 1 … $334,010 … 約¥5,010万」のように
//    2列目が現地通貨・3列目がその円換算で、平均はどこにも入っていない。
//    見出しを「年収（現地通貨）／円換算」に直したので、この表はもうここに引っかからない。
//    ⚠️ 戻さない。戻すと「Year 1 の給料」が「平均年収」として出る。
//
// 再実行可能・冪等。SSOT を読み直すだけなので、年収を更新したあとに何度流してもよい。
//   node patch-stat-avg.mjs           書き込む
//   node patch-stat-avg.mjs --check   差分だけ出す（書かない）
//
// ⚠️ 触るのは「その社の機長／副操縦士の年収」だけ。
//    手取り・シニア機長・昇格年数・最高額・訓練生などは名前で外している（SALARY に対応する値が無い）。
//    ⚠️ 同じ職位が表に2行以上ある社（機材ごとに分けている＝リヤド航空）は
//    数字を触らない。SSOT は社に1つしか平均を持っていないので、機材別の行は埋められない。
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SALARY } from './salary-data.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIR = path.join(ROOT, 'airlines');
const CHECK = process.argv.includes('--check');

const man = (n) => '¥' + n.toLocaleString('en-US') + '万';

// カード1枚 = <div class="stat-card …"><div …>値</div><div class="text-xs …">ラベル</div>
const CARD = /(<div class="stat-card[^"]*"[^>]*>\s*<div[^>]*>)([\s\S]{1,200}?)(<\/div>\s*<div class="text-xs[^"]*"[^>]*>)([^<]{1,44})(<\/div>)/g;

// ラベルから「どちらの職位か」を決める。当てはまらないカードは触らない。
function rankOf(label) {
  // 触らないもの ── SALARY に対応する数字が無い
  if (/手取り|シニア|最高|昇格|時給|月給|初任/.test(label)) return null;
  if (!/年収/.test(label)) return null;
  if (/副操縦士|FO/.test(label)) return 'fo';
  if (/機長/.test(label)) return 'cap';
  return null;
}

// ラベルの（…）から残す注記だけを拾う。「目安」「推定」「参考値」は平均に変えるので消す。
// ⚠️ 注記を新しく足さない。元から無いページは「機長 平均年収」だけにする
//    （ANA・JAL など大半が元からこの形。頼まれていない注記を増やさない）。
// ⚠️ 元から付いていた注記は残す。消してよいのは「目安」「参考値」だけ
//    （オーナーが「平均として書いて」と言ったのはこの2語のこと）。
//    2026-09-28、税引前・推定まで落として 39枚から注記が消えた。戻した。
function noteOf(label) {
  if (/非課税/.test(label)) return '（非課税）';
  if (/免税/.test(label)) return '（免税）';
  if (/外国人/.test(label)) return '（外国人契約）';
  if (/税引前/.test(label)) return '（税引前）';
  if (/推定/.test(label)) return '（推定）';
  return '';
}

const nums = (s) => (s.replace(/<[^>]+>/g, '').match(/[\d,]+(?=万)/g) || []).map((x) => +x.replace(/,/g, ''));

// ── 年収の表 ──────────────────────────────────────────────
// 見出しが <th>ポジション</th><th>年収レンジ</th><th>平均年収…</th> の表だけを相手にする。
// ⚠️ ページ全体に当てない。同じ形の <tr> は機種別の表や ANA/JAL 2列の表にもあり、
//    そちらの3列目は「相手の社の数字」なので、上書きすると別の社の年収を書いてしまう。
const TABLE = /<table>[\s\S]*?<\/table>/g;
const TH = /(<th>ポジション<\/th><th>年収レンジ<\/th><th>)(参考中央値|平均・参考値|平均年収)(<\/th>)/;
// 1行 = 職位セル・年収レンジセル・平均年収セル（前後のタグごと拾って組み直す）
const ROW = /(<tr>\s*<td[^>]*>)([\s\S]*?)(<\/td>\s*<td[^>]*>)([\s\S]*?)(<\/td>\s*<td[^>]*>)([\s\S]*?)(<\/td>)/g;

// 1列目のセルから職位を決める。当てはまらない行は触らない。
function rowRank(cell) {
  const t = cell.replace(/<[^>]+>/g, '');
  if (/訓練|Cadet|シニア|教官|審査/.test(t)) return null;
  return rankOf(t.includes('年収') ? t : t + '年収');
}

// 表を SSOT に合わせる。棒の幅は「機長の平均を 100 とした比」（元の付け方と同じ）。
function fixTable(src, d, file) {
  return src.replace(TABLE, (tbl) => {
    if (!TH.test(tbl)) return tbl;
    let out = tbl.replace(TH, (w, a, name, c) => (name === '平均年収' ? w : a + '平均年収' + c));

    // 同じ職位が2行以上ある表（機材ごとに分けている）は数字を触らない
    const seen = {};
    for (const m of out.matchAll(ROW)) {
      const r = rowRank(m[2]);
      if (r) seen[r] = (seen[r] || 0) + 1;
    }
    if ((seen.cap || 0) > 1 || (seen.fo || 0) > 1) {
      tableSkip.push(`${file}  機材ごとに行を分けているので数字は触らない（機長${seen.cap || 0}行・副操縦士${seen.fo || 0}行）`);
      return out;
    }

    // ⚠️ 3列目の形はページごとに違う。当てはまる形だけ書き換え、ほかは一覧に出して触らない。
    //    ・ドル建てのレンジを2列目に置き、円のレンジ＋「平均 ¥…万」を3列目に入れている社がある
    //    ・「¥2,400万（1,850万〜3,200万）」のように1つのセルに3つ入れている社がある
    //    ・「詳細非公開 / 要問合せ」で数字が無い社がある
    return out.replace(ROW, (whole, p1, c1, p2, c2, p3, c3, p4) => {
      const rank = rowRank(c1);
      if (!rank) return whole;
      const who = `${file}  ${rank === 'cap' ? '機長' : '副操縦士'}`;
      const { lo, hi, avg } = d[rank];
      const a2 = nums(c2), a3 = nums(c3);
      if (!a2.length && !a3.length) return whole; // 数字を出していない社

      // 形A: 3列目に「平均 ¥…万」の小字がある ＝ そこだけ直す（2列目はドル建て）
      const AVG_NOTE = /(平均\s*¥)[\d,]+(万)/;
      if (AVG_NOTE.test(c3)) {
        if (nums(c3.match(AVG_NOTE)[0])[0] === avg) return whole;
        tableFix.push(`${who}: 平均 ${nums(c3.match(AVG_NOTE)[0])[0]} → ${avg}（万円）`);
        return p1 + c1 + p2 + c2 + p3 + c3.replace(AVG_NOTE, (w, a, b) => a + avg.toLocaleString('en-US') + b) + p4;
      }

      // 形B: 2列目が円のレンジ2つ・3列目が円の平均1つ ＝ 両方 SSOT に合わせる
      if (a2.length === 2 && a3.length === 1) {
        const rangeOk = a2[0] === lo && a2[1] === hi;
        const avgOk = a3[0] === avg;
        if (rangeOk && avgOk) return whole;
        // ⚠️ 「¥」を勘定に入れる。入れないとレンジだけ直って平均が古いまま残る（実際にそうなった）
        const n2 = rangeOk ? c2 : c2.replace(/(<div class="text-sm">)[^<]*(<\/div>)/, (w, x, y) => x + man(lo) + '〜' + man(hi) + y);
        const n3 = avgOk ? c3 : c3.replace(/>〜?¥?[\d,]+万〜?</, () => '>' + man(avg) + '<');
        const miss = [!rangeOk && n2 === c2 && 'レンジ列', !avgOk && n3 === c3 && '平均列'].filter(Boolean);
        if (miss.length) { tableSkip.push(`${who}: ${miss.join('と')}の書き換え口が見つからない`); return whole; }
        tableFix.push(`${who}: ${a2.join('〜')} / ${a3[0]} → ${lo}〜${hi} / ${avg}（万円）`);
        return p1 + c1 + p2 + n2 + p3 + n3 + p4;
      }

      tableSkip.push(`${who}: 形が違うので触らない（レンジ列 ${a2.join('・') || '—'} / 平均列 ${a3.join('・') || '—'}・SSOT ${lo}〜${hi}・平均 ${avg}）`);
      return whole;
    });
  });
}

const changed = [];
const skipped = [];
const offSsot = [];
const tableFix = [];
const tableSkip = [];

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.html')).sort()) {
  const slug = file.replace(/\.html$/, '');
  const d = SALARY[slug];
  if (!d) continue; // 比較ページ・年収の無い運航会社
  const src = readFileSync(path.join(DIR, file), 'utf8');
  let hits = 0;

  const out = src.replace(CARD, (whole, open, value, mid, label, close) => {
    const rank = rankOf(label);
    if (!rank) return whole;
    const want = d[rank].avg;
    const got = nums(value);
    if (!got.length) {
      skipped.push(`${file}  ${rank}  [${label}]  ${value.replace(/<[^>]+>/g, '')}  ← 金額が読めない`);
      return whole;
    }
    const ok =
      (got.length === 2 && got[0] === d[rank].lo && got[1] === d[rank].hi) ||
      (got.length === 1 && got[0] === want);
    if (!ok) {
      // ページの数字が SSOT とずれていた。SSOT が正なので直すが、何を直したかは必ず出す。
      offSsot.push(`${file}  ${rank}  [${label}]  ${value.replace(/<[^>]+>/g, '')} → ${man(want)}  (SSOT ${d[rank].lo}〜${d[rank].hi})`);
    }
    const name = rank === 'cap' ? '機長' : '副操縦士';
    const newLabel = `${name} 平均年収${noteOf(label)}`;
    const newValue = man(want);
    if (value === newValue && label === newLabel) return whole;
    hits++;
    return open + newValue + mid + newLabel + close;
  });

  const out2 = fixTable(out, d, file);
  if (out2 !== src) {
    changed.push(`${file}  カード${hits}枚${out2 !== out ? '・表も' : ''}`);
    if (!CHECK) writeFileSync(path.join(DIR, file), out2);
  }
}

if (offSsot.length) {
  console.log('⚠️ ページの数字が SSOT とずれていた（SSOT の平均に直した）:');
  for (const s of offSsot) console.log('  ' + s);
  console.log('');
}
if (tableFix.length) {
  console.log('年収の表を SSOT に合わせた（レンジ / 平均）:');
  for (const s of tableFix) console.log('  ' + s);
  console.log('');
}
if (tableSkip.length) {
  console.log('表の数字を触らなかった:');
  for (const s of tableSkip) console.log('  ' + s);
  console.log('');
}
if (skipped.length) {
  console.log('触らなかったカード:');
  for (const s of skipped) console.log('  ' + s);
  console.log('');
}
console.log(`${changed.length}枚を${CHECK ? '直す（--check なので書いていない）' : '直した'}`);
for (const c of changed) console.log('  ' + c);
if (!CHECK && changed.length) console.log('\n次: node check-salary.mjs');
