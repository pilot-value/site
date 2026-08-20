/* ════════════════════════════════════════════════════════════════
   inject-salary-gate.mjs — 各社ページの年収詳細を premium-gate で包む冪等バッチ

   「給与明細を1枚出すと年収の詳細が90日読める」を全ページで成立させる。
   これが入っていないページは、明細を出す理由がそもそも画面に出ない。

   包む範囲（1ページに複数の枠を置く。連続したカードだけを1つにまとめる）:
     日本語 airlines/*.html
       枠1  「年収データ」＋「年収推移」          … 全112社（年収推移は ana / jal のみ）
       枠2  「手取り計算」＋「機種別データ」＋「詳細比較」 … ana / jal
       枠3  「手取り比較」                        … cathay-pacific / emirates / lufthansa /
                                                    qatar-airways / singapore-airlines
       枠4  「ANA比較」                           … american / delta / southwest / united
     英語   en/airlines/*.html
       枠1  「Salary Data」＋「Career Ladder」    … 全112社
       ※ 英語の「Comparison」は各国SEOの本体なので開けたまま（オーナー決定・2026-08-16）

   ★中身は1文字も書き換えない。数字にも文言にも触らない。
   ★行番号で切らない。glass カードの開きから </div> の深さを数えて閉じを見つける。
     日本語112枚のうち70枚は glass と section-badge が同じ行、42枚は別の行にあり、
     行の形が揃っていない。構造で取れば224枚すべて正しく取れる（確認済み）。

   ⚠️ 枠に入れたカードは「年収・給与」タブへ移る。振り分けは
      airline-reviews-ui.js の secSalary が見出しの語で決めているので、
      ここに新しい語を足すときは向こうの正規表現も一緒に広げる。
      overview のままだと枠のタブ属性が上書きされ、タブが空になる。

   冪等性:
     ・対象カードが「すでに premium-gate の中にある」なら、その枠は飛ばす。
       枠の開き `<div class="premium-gate` と閉じコメントの数を数えて判定するので、
       手で書いた枠（emirates / starlux）も同じ扱いになる。
     ・年収のカードを持たない比較記事（gaishi-vs-nikkei など6枚）は自動的に対象外。

   実行: node inject-salary-gate.mjs
════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

const TARGETS = [
  {
    dir: 'airlines',
    // このページを対象にするかの足切り。年収の表を持たない記事ページを外す。
    entry: '年収データ',
    groups: [
      // 年収推移＝英語の Career Ladder と同じ「年次別の詳細表」。ana / jal の2枚だけが持つ。
      { badges: ['年収データ', '年収推移'], label: '年収詳細' },
      { badges: ['手取り計算', '機種別データ', '詳細比較'], label: '手取りの内訳・機種別・他社比較' },
      { badges: ['手取り比較'], label: '非課税国と日本の手取り比較' },
      { badges: ['ANA比較'], label: '日系との年収比較' },
    ],
    lockTag: '<script src="premium-auth-lock.js"></script>',
    comment: (g) => `<!-- ▼ premium-gate: ${g.label}（給与明細の提出で90日解放。口コミでは開かない） -->`,
    close: '</div><!-- ▲ /premium-gate -->',
  },
  {
    dir: path.join('en', 'airlines'),
    entry: 'Salary Data',
    groups: [
      { badges: ['Salary Data', 'Career Ladder'], label: 'detailed pay data' },
    ],
    lockTag: '<script src="../../airlines/premium-auth-lock.js"></script>',
    comment: (g) => `<!-- premium-gate: ${g.label} (unlocked for 90 days by submitting a payslip; a review does not unlock it) -->`,
    close: '</div><!-- /premium-gate -->',
  },
];

const BADGE = (label) => 'section-badge mb-4">' + label;

const GATE_OPEN  = /<div class="premium-gate/g;
const GATE_CLOSE = /<!--\s*(?:▲\s*)?\/premium-gate\s*-->/g;

const countOf = (s, re) => (s.match(re) || []).length;

/* section-badge を含む <div class="glass …> カードの範囲を返す。
   <div> / </div> の深さを数えるので、行の折り方に左右されない。 */
function cardRange(html, label) {
  const b = html.indexOf(BADGE(label));
  if (b < 0) return null;
  const open = html.lastIndexOf('<div class="glass', b);
  if (open < 0) return null;

  const re = /<div\b|<\/div>/g;
  re.lastIndex = open;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[0] === '</div>') {
      depth--;
      if (depth === 0) return { open, end: re.lastIndex };
    } else {
      depth++;
    }
  }
  return null;
}

/* 2枚目以降は、直前のカードのすぐ後ろにあるときだけ一緒に包む。
   あいだの HTML コメント（`<!-- 年次別年収推移 -->` など）は「離れている」と見なさない。 */
function contiguous(html, from, range) {
  if (!range || range.open < from) return false;
  return html.slice(from, range.open).replace(/<!--[\s\S]*?-->/g, '').trim() === '';
}

/* pv-session.js の直後に premium-auth-lock.js を置く（既存2枚と同じ位置）。
   ゲートの判定はログイン状態を見るので、セッションより後に読ませる。 */
function injectLockTag(html, tag) {
  if (html.includes('premium-auth-lock.js')) return html;
  const m = html.match(/<script src="[^"]*pv-session\.js"><\/script>\n?/);
  if (!m) return null;
  const at = m.index + m[0].length;
  return html.slice(0, at) + tag + '\n' + html.slice(at);
}

let wrapped = 0, wrappedPages = 0, already = 0, notTarget = 0, failed = 0;
const notTargetList = [];

for (const t of TARGETS) {
  const dir = path.join(ROOT, t.dir);
  if (!fs.existsSync(dir)) continue;

  for (const entry of fs.readdirSync(dir).sort()) {
    if (!entry.endsWith('.html')) continue;
    const fp = path.join(dir, entry);
    let html = fs.readFileSync(fp, 'utf8');

    if (!html.includes(BADGE(t.entry))) {
      notTarget++; notTargetList.push(path.join(t.dir, entry));
      continue;
    }

    let hit = 0;
    for (const g of t.groups) {
      const first = cardRange(html, g.badges[0]);
      if (!first) continue;                     // このページには無い見出し

      // すでに枠の中にあるカードは二重に包まない（前回の実行ぶん・手書きの枠とも）
      const head = html.slice(0, first.open);
      if (countOf(head, GATE_OPEN) > countOf(head, GATE_CLOSE)) { already++; continue; }

      let end = first.end;
      for (const b of g.badges.slice(1)) {
        const next = cardRange(html, b);
        if (!contiguous(html, end, next)) break; // 離れていたらそこで打ち切る
        end = next.end;
      }

      // カードの行頭の字下げを引き継ぐ（引き継がないと 25 枚で字下げだけが消えて差分が汚れる）
      const lineStart = html.lastIndexOf('\n', first.open) + 1;
      const lead = html.slice(lineStart, first.open);
      const indent = /^[ \t]*$/.test(lead) ? lead : '';
      const at = indent ? lineStart : first.open;

      html = html.slice(0, at)
           + indent + t.comment(g) + '\n'
           + indent + '<div class="premium-gate pv-locked" data-gate-key="salary_detail">\n'
           + html.slice(at, end)
           + '\n' + indent + t.close
           + html.slice(end);
      hit++;
    }

    if (!hit) continue;

    const withTag = injectLockTag(html, t.lockTag);
    if (withTag === null) { failed++; console.log('  ! pv-session.js が無い:', fp); continue; }

    fs.writeFileSync(fp, withTag, 'utf8');
    wrapped += hit; wrappedPages++;
  }
}

console.log('\n=== 年収の枠（premium-gate）注入 ===');
console.log(`✓ 包んだ            : ${wrapped}枠 / ${wrappedPages}ページ`);
console.log(`- すでに枠の中      : ${already}箇所`);
console.log(`- 年収のカード無し  : ${notTarget}ページ  ${notTargetList.join(' ')}`);
if (failed) {
  console.log(`❌ 失敗             : ${failed}ページ`);
  process.exitCode = 1;
}
