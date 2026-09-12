/* ════════════════════════════════════════════════════════════════
   明細から読めているのに送っていなかった7列＋出所が、
   ①壊さずに ②落とさずに ③危ない値は送らずに 保存されることを測る。

   なぜこのテストが要るか:

   ① db/pay-reports.sql は net_pay_actual / ytd_taxable / flight_variable_pay /
      deduction_total / duty_hours / night_hours / credit_hours を最初から持ち、
      submit_pay_report も受け取れた。しかしフォームの payload に無く、
      **一度も保存されていなかった**。明細画像は保存しない設計なので、
      送らなかったぶんは後から復元できない。落ちていたら気づけない類の欠損。

   ② ★flight_variable_pay を「その他手当から移す」と年収が丸ごと下がる。
      pay-tracker の donut は flight_variable_pay を other_allowance の
      部分集合として扱い、pv_annual_total() は other_allowance しか足さない。
      しかも annualTotal()（ライブ計算）と pv_annual_total()（サーバ）が
      対称に下がるので、**test-form-contract.mjs では検出できない**。
      だから「二重書きであること」をここで見張る。

   ③ 列の CHECK に触れる値を送ると insert ごと失敗する＝誤読1つで明細1枚を失う。
      "999H00" のような読み違いが素通りしないことを確かめる。

   ④ PRESET_IDS（端末プリセット）に混ぜると、先月の年初来累計が翌月のフォームに
      載り、手入力を永久に source:'payslip' と申告し続ける。混ざっていないこと。

   ここで使う数字はすべて作り話。実物の明細の数字はこのリポジトリに1つも無い。

   実行: node db/test-payslip-extras.mjs
   ════════════════════════════════════════════════════════════════ */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };
const eq = (got, want, m) =>
  ok(got === want, `${m}  → ${JSON.stringify(got)}${got === want ? '' : `  （期待 ${JSON.stringify(want)}）`}`);

const PAYSLIP = read('payslip.js');
const JA = read('pay-report.html');
const EN = read('en/pay-report.html');

/* 隠しフィールド id → payload キー。この対応が唯一の正。 */
const MAP = {
  'f-netpay':   'net_pay_actual',
  'f-ytd':      'ytd_taxable',
  'f-flightvar': 'flight_variable_pay',
  'f-deduct':   'deduction_total',
  'f-duty-h':   'duty_hours',
  'f-night-h':  'night_hours',
  'f-credit-h': 'credit_hours',
  'f-source':   'source',
};

/* ══ ① ページ側の契約 ═══════════════════════════════════════ */
console.log('\n① 隠しフィールドと payload（JA / EN の両方）');
/* ★2026-08-13 に、この2つは隠し欄から普通の欄へ出た（手取りは必須・勤務時間は任意）。
   payload・ALL_IDS・PRESET_IDS の扱いは今までどおりなので、下の検査からは外さない。
   外すのは「隠し欄であること」だけ。
   ★2026-08-13（その2）に、金額の欄は桁区切りを出すため type="text" になった
   （type="number" にはカンマを表示できない。ブラウザが値ごと捨てる）。
   ★2026-09-11、時間・率の欄も text になった。number のままだと `160,5` と打った人の
     値をブラウザが丸ごと捨て、欄が黙って空＝0 になる（画面には打った文字が出たまま）。
     上限は type の属性ではなく data-min / data-max と readNum が見る。
     ⚠️ このページには <form> が無いので、min / max はそもそも一度も効いていなかった
        （checkValidity を呼ぶ場所がどこにも無い）。number をやめて失うものは無い。 */
const NOW_VISIBLE = { 'f-netpay': 'text', 'f-duty-h': 'text' };

for (const [name, s] of [['pay-report.html', JA], ['en/pay-report.html', EN]]) {
  for (const id of Object.keys(MAP)) {
    if (NOW_VISIBLE[id]) {
      ok(new RegExp(`<input type="${NOW_VISIBLE[id]}" id="${id}"`).test(s),
         `${name}: ${id} は表の欄になっている（隠し欄ではない）`);
      continue;
    }
    ok(s.includes(`<input type="hidden" id="${id}">`), `${name}: 隠し欄 ${id} がある`);
  }
  /* ★2026-08-26、flight_variable_pay だけ val() 1つではなくなった。明細から読めた分
     （隠し欄 f-flightvar）に加えて、本人が手で足した「変動給」の行の合計（f-var-sum）も
     足す。だから見るのは書き方ではなく **その隠し欄が payload のそのキーに繋がっているか**。 */
  /* ⚠️ ファイル全体から `キー:` を拾ってはいけない。2026-08-26 その5 に組合の節が
     `{ … source: null … }` を持ったせいで、payload より前の行を拾って落ちた。
     見たいのは payload の中身だけなので、`const payload = {` から先を切り出す。 */
  const body = s.slice(s.indexOf('const payload = {'));
  for (const [id, key] of Object.entries(MAP)) {
    const line = (body.match(new RegExp(`\\n\\s*${key}:[^\\n]*`)) || [''])[0];
    ok(/(val|sumField)\(/.test(line) && line.includes(`'${id}'`),
       `${name}: payload に ${key} がある（隠し欄 ${id} から来ている）`);
  }

  /* ★2026-09-12、引き継ぎの一覧は CARRY という台帳1つになった（前は端末側の
       PRESET_IDS とサーバ側の id 対応表で顔ぶれが違った）。見ている中身は前と同じ ──
       明細由来の欄は「送るもの」には入り、「翌月のひな型」には入らない。 */
  const ledger = s.match(/const CARRY = \{[\s\S]*?\n\};/);
  ok(!!ledger, `${name}: 引き継ぎの台帳 CARRY を読めた`);
  const grp = (k) => {
    const m = (ledger ? ledger[0] : '').match(new RegExp(k + ': \\[([\\s\\S]*?)\\],'));
    return m ? m[1] : '';
  };
  ok(/const PRESET_IDS = CARRY\.info\.concat\(CARRY\.fixed, CARRY\.shape\);/.test(s),
     `${name}: ひな型（PRESET_IDS）は台帳から導いている`);
  ok(/const ALL_IDS = PRESET_IDS\.concat\(CARRY\.never\);/.test(s),
     `${name}: 送るもの（ALL_IDS）も台帳から導いている`);
  for (const id of Object.keys(MAP)) {
    // ★ 送るものには入る（未ログイン→ログイン後の再送で落ちないため）
    ok(grp('never').includes(`'${id}'`), `${name}: CARRY.never に ${id} がある（＝ALL_IDS に入る）`);
    // ★ 翌月のひな型には入れない（持ち越すと先月の実績が今月の欄に残る）
    for (const k of ['info', 'fixed', 'shape']) {
      ok(!grp(k).includes(`'${id}'`), `${name}: ★${id} が翌月のひな型（CARRY.${k}）に混ざっていない`);
    }
  }

  // ★ 乗務日数(duty_days)の f-duty と、勤務時間の f-duty-h は別物
  ok(/duty_days:\s+val\('f-duty'\)/.test(s), `${name}: duty_days は f-duty のまま（乗務日数）`);
  ok(/duty_hours:\s+val\('f-duty-h'\)/.test(s), `${name}: duty_hours は f-duty-h（勤務時間）`);

  // ★ source はクライアント申告。何かの権限をこれで分岐させていない
  ok(/source は「出所ラベル」/.test(s) || /VERIFIED-PILOT 3-2 A-1/.test(s),
     `${name}: source を権限判定に使わない理由が書いてある`);
}

/* ══ ② flight_variable は「移さない・二重に書く」 ═══════════ */
console.log('\n② flight_variable を その他手当 から抜いていない（年収が下がる事故）');
const kindField = PAYSLIP.match(/var KIND_FIELD = \{[\s\S]*?\};/);
ok(!!kindField, 'KIND_FIELD を読めた');
ok(kindField && /flight_variable:\s*'f-other'/.test(kindField[0]),
   "★KIND_FIELD.flight_variable は 'f-other' のまま（＝年収に入り続ける）");
ok(kindField && !/'f-flightvar'/.test(kindField[0]),
   '★KIND_FIELD に f-flightvar を生やしていない（生やすと f-other から移動して年収が下がる）');
ok(/writeHidden\('f-flightvar'/.test(PAYSLIP), 'flight_variable_pay は隠し欄へ別途書いている（二重書き）');
ok(/表で金額を直したら専用列も追随/.test(PAYSLIP) || /pushTrace[\s\S]{0,400}f-flightvar/.test(PAYSLIP),
   '表で直したときも f-flightvar が追随する');

/* ══ ②-b 2026-08-27：読み取りをフォーム（8-26 / 8-27）に追いつかせた分 ══
   ★ここは「どの欄へ行くか」だけを見る。金額が1円も変わらないことは
     db/test-payslip-redact.mjs が**本物のページの sumField** で測っている
     （式をこちらに書き写すと、片方だけ直したときに黙ってズレる）。 */
console.log('\n②-b 保証給・教官・審査の行き先（2026-08-27）');
eq(kindField && /guarantee:\s*'(f-[a-z-]+)'/.exec(kindField[0])?.[1], 'f-guarantee',
   "★保証給は専用の欄へ（基本給に混ぜない。日本＝基本給／米国＝保証給が下限で意味が違う）");
ok(kindField && !/\bpension\b/.test(kindField[0]),
   '★pension という分類を作っていない（日本の明細の厚生年金は控除。支給として立てる道を開かない）');

const roleField = PAYSLIP.match(/var ROLE_FIELD = \{[^}]*\};/);
ok(!!roleField, 'ROLE_FIELD を読めた');
ok(roleField && /instructor:\s*'f-instructor'/.test(roleField[0]) &&
   /examiner:\s*'f-examiner'/.test(roleField[0]),
   '★教官・審査は専用の欄へ（instructor_pay / examiner_pay）');
ok(roleField && !/'f-other'/.test(roleField[0]) && !/'f-command'/.test(roleField[0]),
   '★その他手当にも職位手当にも足し込まない（専用の列があることがその実装そのもの）');
ok(!/ROLE_FIELD\[[^\]]*\][\s\S]{0,200}f-other/.test(PAYSLIP),
   '★役割の枝から f-other へ落ちる道が無い');
/* 組合・管理職・兼務は**読まない**（オーナー決定 2026-08-27）。
   組合は「組合名を返してはいけない」という規則が唯一ぶつかる所で、
   管理職・兼務は明細に決まった印字が無く、誤分類はデータを黙って汚す。 */
for (const c of ['union', 'management', 'nonline']) {
  ok(roleField && !new RegExp(`\\b${c}:`).test(roleField[0]),
     `★${c} は読まない（明細から当てられない／組合名は返してはいけない）`);
}
ok(/basis/.test(PAYSLIP) && /seedRows\('var', varSeed\)/.test(PAYSLIP),
   '★変動給は「行」に載せる（手で打った人と同じ入れ物。種類 basis も入る）');
ok(/seededRows/.test(PAYSLIP),
   '★落とし直したら前に生やした行を消す（足すだけだと2回落とした人の変動給が2倍になる）');

/* ── ★18・★19 明細から読めた手当が、項目名ごと残る（2026-09-12・指摘3）──────
   前は「家族手当」「株式積立奨励金」のような行が、隠し欄 f-other に**合算**されていた。
   金額は other_allowance に届くので年収は正しいが、**項目名はどこにも残らない**
   （診断用の控えの中だけ）。本人の画面にも確認画面にも1行も出ないので、
   読み違えていても気づけず直せない。DEEP PAY の内訳にも名前は一生出ない。
   ⚠️ 画面はどこも壊れないまま静かに消える形。 */
console.log('\n②-c 明細の その他手当・未分類 が「行」に載る（2026-09-12・指摘3）');
ok(/seedRows\('oth', othSeed\)/.test(PAYSLIP),
   '★18 その他の現金手当も「行」に載せる（手で打った人と同じ入れ物）');
ok(/othOK = canRows\('oth'\)/.test(PAYSLIP),
   '★18 行の型が無い古い HTML では今までどおり欄へ落ちる（壊れない）');
ok(/kind === 'other' && othOK/.test(PAYSLIP),
   '★18 その他の支給は f-other に合算せず行へ回す');
{
  /* 行へ回した枝が、そのまま sums['f-other'] にも足していないか（＝二重計上）。
     行へ回す if の中身だけを切り出して見る。 */
  const i = PAYSLIP.indexOf("if (e2.kind === 'other' && othOK) {");
  const blk = i > 0 ? PAYSLIP.slice(i, PAYSLIP.indexOf('\n      }', i)) : '';
  ok(i > 0 && /othSeed\.push/.test(blk) && !/sums\[/.test(blk),
     '★18 行に載せた分を f-other にも書かない（f-oth-sum が拾う＝二重計上になる）');
}
ok(/othOK && sums\['f-other'\] === undefined/.test(PAYSLIP),
   '★18 落とし直したとき、前の明細で f-other に入れた合計を残さない');
{
  const i = PAYSLIP.indexOf("if (othOK) {");
  const blk = i > 0 ? PAYSLIP.slice(i, PAYSLIP.indexOf('\n      }', i)) : '';
  ok(i > 0 && /kind: 'unclassified'/.test(blk) && !/sums\[/.test(blk),
     '★18 分類できなかった行も「行」に載せる（名前が分からない行こそ項目名を残す）');
}
ok(/'pd-oth':\s*\{\s*ja:/.test(PAYSLIP),
   '★18 確認の表に出る行き先の名前がある（pd-oth）');
{
  /* ★19 現物給付は行に載せない（収入に数えない）。
     ★不就労減額は 2026-09-12 に扱いを変えた（指摘2）──
       前 … KIND_FIELD が f-other へ送り、符号のまま合算していた。
             ＝ 項目名がどこにも残らず、印字の総支給（すでに減額後）から
                もう一度引かれて、その他手当が 0 に潰れていた
       後 … どの金額の欄にも足さず、専用の隠し欄 f-absence に
             項目名・符号・金額をそのまま残して保存まで運ぶ。
     「その他の現金手当」の行に並べないのは前と同じ（負の行は読めないうえ合計の検算が壊れる）。 */
  ok(/if \(e2\.kind === 'notional'\) \{ notional\.push\(e2\); return; \}/.test(PAYSLIP),
     '★19 現物給付（航空券課税など）は今までどおり収入に数えない＝行にも載らない');
  ok(!/kind === 'absence'[\s\S]{0,120}othSeed/.test(PAYSLIP),
     '★19 不就労減額（マイナスの行）は「その他の現金手当」に並べない');
  const kf = PAYSLIP.match(/var KIND_FIELD[\s\S]*?\n  \};/);
  ok(!!kf && !/absence:/.test(kf[0]),
     '★19 不就労減額をどの金額の欄にも割り当てない（足すと総支給から二重に引かれる）');
  ok(/if \(e2\.kind === 'absence'\) \{ absence\.push\(e2\); return; \}/.test(PAYSLIP),
     '★19 代わりに専用の入れ物へ寄せる');
  ok(/res\._absence = absence;/.test(PAYSLIP),
     '★19 読み取り結果に載せる（本人の画面に1行出せる）');
  {
    const i = PAYSLIP.indexOf("var absEl = document.getElementById('f-absence')");
    const blk = i > 0 ? PAYSLIP.slice(i, i + 500) : '';
    ok(i > 0, '★19 隠し欄 f-absence に書き出している（送信まで運ぶ）');
    ok(/a\.label \|\| null/.test(blk),
       '★19 明細上の項目名をそのまま残す（名前が消えると誤読に気づけない）');
    ok(/-Math\.abs\(/.test(blk),
       '★19 符号もマイナスのまま残す（手当と見分けが付く）');
  }
}
{
  /* ★18 6択に答えたら行から出す。pushTrace は row 付きを**行へ書き戻す**ので、
     出さないまま field だけ変えると本人の答えが1円も反映されない。 */
  const i = PAYSLIP.indexOf('function answerUnc(');
  const blk = i > 0 ? PAYSLIP.slice(i, i + 1200) : '';
  ok(i > 0 && /t\.row && c\.asked !== 'other'/.test(blk) && /t\.row = null/.test(blk),
     '★18 6択に「その他」以外で答えたら行から出す（答えが反映されないのを防ぐ）');
  ok(/t\.field = t\.row \? 'pd-oth' : c\.field/.test(blk),
     '★18 行に残す答え（その他）は行き先も pd-oth のまま');
}

/* ══ ③ 出荷されるコードをそのまま走らせる ═════════════════════
   writeHidden〜writeExtras を payslip.js から切り出して、偽の document で実行する。
   （書き写しではなく、本当に出荷される文字列を動かす） */
console.log('\n③ writeExtras を実際に走らせる（範囲ガード）');
const s0 = PAYSLIP.indexOf('  function writeHidden(id, v) {');
const s1 = PAYSLIP.indexOf('  /* 表で直した金額を反映');
ok(s0 > 0 && s1 > s0, 'writeHidden〜writeExtras を切り出せた');
const BLOCK = PAYSLIP.slice(s0, s1);

/* ★setField は切り出す範囲の外にある（本体は classList / dispatchEvent を使うので
   偽の document では動かない）。ここでは同じ形の受け皿を差し込み、
   「どの欄が setField を通ったか」を記録する。
   2026-08-13 に手取りと勤務時間が表の欄へ出たので、この2つは writeHidden ではなく
   setField を通らないといけない（通らないと値は入るのに段階表示が進まない）。 */
/* ★mark も切り出す範囲の外にある（本体は payslip.js のモジュール変数 filled に足す）。
   writeHidden は .ai-filled を付けないので、この印だけが
   「明細が書いた隠し欄を下書きで上書きさせない」根拠になっている（2026-09-11）。
   受け皿を差し込まないと ReferenceError で落ちる＝印を外したらここが赤くなる。 */
const build = new Function('document', 'lastHours', 'setField', 'mark',
  BLOCK + '\nreturn { writeExtras: writeExtras, okAmount: okAmount, okHours: okHours, sumKind: sumKind };');

const fakeDoc = (ids) => {
  const els = {};
  (ids || Object.keys(MAP)).forEach((i) => { els[i] = { value: '' }; });
  return { getElementById: (i) => els[i] || null, els };
};
const mkMark = (into) => (id) => { into.push(id); };
const mkSetField = (doc, seen) => (id, v) => {
  const e = doc.getElementById(id);
  if (!e) return false;
  e.value = String(v);
  seen.push(id);
  return true;
};

// ── 正常系 ──
{
  const doc = fakeDoc();
  const seen = [];
  const marked = [];
  const api = build(doc, { block: 86.5, duty: 171.2, night: 12.5, credit: 90 },
                    mkSetField(doc, seen), mkMark(marked));
  api.writeExtras(
    { net_pay: 812345.6, ytd_taxable: 5400000, deductions_total: 233654 },
    [{ field: 'f-other', amount: 120000, kind: 'flight_variable' },
     { field: 'f-other', amount:  30000, kind: 'flight_variable' },
     { field: 'f-other', amount:   5000, kind: 'other' },
     { field: 'f-base',  amount: 480000, kind: 'base' }]
  );
  const v = (id) => doc.els[id].value;
  eq(v('f-netpay'), '812346', 'net_pay が四捨五入で入る');
  eq(v('f-ytd'), '5400000', 'ytd_taxable が入る');
  eq(v('f-deduct'), '233654', 'deductions_total が入る');
  eq(v('f-duty-h'), '171.2', 'duty hours が入る');
  eq(v('f-night-h'), '12.5', 'night hours が入る');
  eq(v('f-credit-h'), '90', 'credit hours が入る');
  eq(v('f-source'), 'payslip', "source は 'payslip'");
  eq(v('f-flightvar'), '150000', '★flight_variable だけを kind で合計（その他 5,000 は混ぜない）');
  ok(seen.includes('f-netpay') && seen.includes('f-duty-h'),
     '★手取りと勤務時間は setField で入れる（表に出た欄なので印と再計算が要る）',
     seen.join(','));
  ok(!seen.includes('f-ytd') && !seen.includes('f-deduct') && !seen.includes('f-flightvar'),
     '画面に出ていない欄は writeHidden のまま（1枚で7回描き直さない）', seen.join(','));
  /* ★ここが④の要。緑枠（.ai-filled）は writeHidden の欄には付かないので、
     この印が無いと f-ytd・f-deduct・f-source などが下書きで黙って書き戻される。 */
  ok(['f-ytd', 'f-deduct', 'f-night-h', 'f-credit-h', 'f-source', 'f-flightvar']
       .every((id) => marked.includes(id)),
     '★★隠し欄も「明細が書いた」と印を付ける（下書きが上書きしない根拠）', marked.join(','));
}

// ── ★2026-08-27：保証時間と、行に載った変動給 ──────────────────
{
  /* f-guar は §2 の表に出ている欄なので writeHidden ではなく setField で入れる
     （印が付いて段階表示も進む）。2026-08-27 まで語彙に無く、未分類にも落ちずに
     黙って捨てられていた（米国の見本は実際に GUARANTEE 73.00 を印字している）。 */
  const doc = fakeDoc([...Object.keys(MAP), 'f-guar']);
  const seen = [];
  const api = build(doc, { block: 78.2, duty: 168.5, guarantee: 65 },
                    mkSetField(doc, seen), mkMark([]));
  api.writeExtras({ net_pay: 832246 },
    [/* 行に載った変動給。f-var-sum が持つので、こちらでは数えない。 */
     { field: 'pd-var', amount: 148200, kind: 'flight_variable', row: {} },
     { field: 'pd-var', amount:  23400, kind: 'flight_variable', row: {} },
     { field: 'f-other', amount: 12000, kind: 'unclassified' }]);
  const v = (id) => doc.els[id].value;
  eq(v('f-guar'), '65', '★保証フライトタイムが入る');
  ok(seen.includes('f-guar'),
     '★f-guar は setField で入れる（隠しにしない＝印が付いて段階表示も進む）');
  eq(v('f-flightvar'), '',
     '★★行に載った変動給は f-flightvar に書かない（ここが二重計上の境目）');
  eq(api.sumKind([{ kind: 'flight_variable', amount: 5000 },
                  { kind: 'flight_variable', amount: 148200, row: {} }], 'flight_variable'), 5000,
     '★sumKind は行に載った分を数えない（欄に残った分だけ）');
}

// ── 範囲外・欠損 ──
{
  const doc = fakeDoc();
  const seen = [];
  const api = build(doc, { block: 80, duty: 999, night: 0, credit: -3 },
                    mkSetField(doc, seen), mkMark([]));
  api.writeExtras({ net_pay: -1, ytd_taxable: null, deductions_total: undefined }, []);
  const v = (id) => doc.els[id].value;
  ok(seen.length === 0, '読めなかった欄は setField を呼ばない（空で上書きするだけ）', seen.join(','));
  eq(v('f-duty-h'), '', '★999h は送らない（CHECK 0..400 に触れると送信ごと失敗する）');
  eq(v('f-night-h'), '', '0h は「読めなかった」として送らない');
  eq(v('f-credit-h'), '', 'マイナスの時間は送らない');
  eq(v('f-netpay'), '', '★マイナスの支給額は送らない（CHECK >= 0）');
  eq(v('f-ytd'), '', 'null はそのまま空（列は NULL になる）');
  eq(v('f-deduct'), '', 'undefined はそのまま空');
  eq(v('f-flightvar'), '', 'flight_variable の行が無ければ空（0 を捏造しない）');
}

// ── 境界 ──
{
  const api = build(fakeDoc(), {}, () => false, () => {});
  eq(api.okHours(400), 400, '400h ちょうどは通す');
  eq(api.okHours(400.1), null, '400.1h は落とす');
  eq(api.okAmount(0), 0, '0 は有効な値として通す（無給の月は実在する）');
  eq(api.okAmount(NaN), null, 'NaN は落とす');
  eq(api.okAmount(Infinity), null, 'Infinity は落とす');
  eq(api.sumKind([{ kind: 'flight_variable', amount: 0 }], 'flight_variable'), 0,
     '合計0でも「行はあった」なら 0 を返す（null と区別する）');
}

// ── 隠し欄が無い古いHTMLでも落ちない ──
{
  const doc = { getElementById: () => null };
  const api = build(doc, { duty: 100 }, () => false, () => {});
  let threw = false;
  try { api.writeExtras({ net_pay: 1 }, []); } catch (e) { threw = true; }
  ok(!threw, '隠し欄が無いページでも例外を投げない');
}

/* ══ ④ 文言 ═══════════════════════════════════════════════ */
console.log('\n④ 「保存していません」が嘘になっていない');
ok(!/控除合計・差引支給額・総勤務時間は、いまは<b>画面に出すだけ<\/b>で保存していません/.test(PAYSLIP),
   '★旧文言「保存していません」が残っていない（保存するようになったので嘘になる）');
ok(/一緒に保存します/.test(PAYSLIP), 'JA: 保存することを言っている');
ok(/stored with this report/.test(PAYSLIP), 'EN: 保存することを言っている');
ok(/控除の<b>内訳<\/b>は保存しません/.test(PAYSLIP), 'JA: 控除の内訳は保存しないと言っている');
ok(/breakdown<\/b> of deductions is never stored/.test(PAYSLIP), 'EN: 控除の内訳は保存しないと言っている');

/* ══ ⑤ PGlite 往復 ═══════════════════════════════════════ */
console.log('\n⑤ 本物の submit_pay_report / my_pay_reports に通す');
const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  grant usage on schema public, extensions to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  create table public.profiles (
    id uuid primary key, email text, name text,
    email_opt_in boolean not null default false
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;
`);
for (const f of ['db/airlines.generated.sql', 'db/vocab.generated.sql', 'db/pay-reports.sql']) {
  await db.exec(read(f));
}
const UID = '00000000-0000-4000-8000-0000000000e1';
await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`, [UID, 'extras@example.com']);
await db.query(`select set_config('pv.uid', $1, false)`, [UID]);

const payload = {
  airline: 'emirates', position: 'cap', fleet: 'b777', job_role: 'line',
  base_iata: 'DXB', period_year: 2026, period_month: 6, currency: 'AED',
  base_pay: 48500, block_hours: 86.5, per_diem: 6200,
  housing_type: 'allowance', housing_amount: 17500,
  command_pay: 3200, transport: 1500, other_allowance: 4100,
  bonus_annual: 52000, profit_share_annual: 18000,
  // ★今回から送る側
  net_pay_actual: 61200, ytd_taxable: 402000, flight_variable_pay: 3200,
  deduction_total: 9800, duty_hours: 171.2, night_hours: 12.5, credit_hours: 90,
  source: 'payslip', lang: 'ja',
};
const res = (await db.query(`select public.submit_pay_report($1::jsonb) as r`, [JSON.stringify(payload)])).rows[0].r;
ok(res && res.ok, 'RPC が ok を返す');

const row = (await db.query(`
  select net_pay_actual, ytd_taxable, flight_variable_pay, deduction_total,
         duty_hours, night_hours, credit_hours, other_allowance, source, base_iata
    from public.pay_reports limit 1`)).rows[0];
eq(Number(row.net_pay_actual), 61200, 'net_pay_actual が保存された');
eq(Number(row.ytd_taxable), 402000, 'ytd_taxable が保存された');
eq(Number(row.flight_variable_pay), 3200, 'flight_variable_pay が保存された');
eq(Number(row.deduction_total), 9800, 'deduction_total が保存された');
eq(Number(row.duty_hours), 171.2, 'duty_hours が保存された');
eq(Number(row.night_hours), 12.5, 'night_hours が保存された');
eq(Number(row.credit_hours), 90, 'credit_hours が保存された');
eq(row.source, 'payslip', 'source が保存された');
ok(Number(row.other_allowance) === 4100,
   '★その他手当は flight_variable_pay を引かれていない（＝年収が下がらない）');

/* ★ source を申告しただけでは何の権限も動かない（VERIFIED-PILOT 3-2 A-1） */
const prof = (await db.query(`select verify_level, badge from public.profiles where id=$1`, [UID])).rows[0];
eq(Number(prof.verify_level || 0), 0, "★source:'payslip' を送っても verify_level は上がらない");

const mine = (await db.query(`select public.my_pay_reports() as r`)).rows[0].r;
const r0 = mine.reports[0];
eq(r0.base_iata, 'DXB', '★my_pay_reports が base_iata を返す（レポート概要の Base）');
eq(Number(r0.duty_hours), 171.2, 'my_pay_reports が duty_hours を返す');
eq(Number(r0.net_pay_actual), 61200, 'my_pay_reports が net_pay_actual を返す');
eq(Number(r0.ytd_taxable), 402000, 'my_pay_reports が ytd_taxable を返す');

/* Gross は列を足さずに出せる（VERIFIED-PILOT 3-4） */
eq(Number(r0.net_pay_actual) + Number(r0.deduction_total), 71000,
   'Gross = net_pay_actual + deduction_total で出せる（新しい列は要らない）');

/* ── ⑥ 不就労減額が保存され、取り出せる（2026-09-12・指摘2/指摘4）────────
   ここは**本物の submit_pay_report / my_pay_reports** を通している。
   ⚠️ pay_items はサーバ側で白リスト（jsonb_build_object）を通って作り直される。
      鍵を1つ足し忘れると**その鍵だけ黙って消える**（画面はどこも壊れない）。
      画面側の検査（db/test-form-contract.mjs ★20）は「送るところ」までしか見ないので、
      保存されたかを見るのはここ1本だけ。 */
console.log('\n⑥ 不就労減額 ── 保存 → 取り出し');
{
  const p2 = Object.assign({}, payload, {
    period_month: 7,
    other_allowance: 4100,
    pay_items: { v: 2, absence: [{ label: '欠勤控除', amount: -18000 }] },
  });
  const r2 = (await db.query(`select public.submit_pay_report($1::jsonb) as r`,
                             [JSON.stringify(p2)])).rows[0].r;
  ok(r2 && r2.ok, 'RPC が ok を返す');

  const saved = (await db.query(`
    select pay_items, other_allowance from public.pay_reports
      where period_month = 7 limit 1`)).rows[0];
  const pi = saved.pay_items;
  ok(pi && Array.isArray(pi.absence) && pi.absence.length === 1,
     '★減額が pay_items.absence[] として保存される（白リストに鍵がある）',
     JSON.stringify(pi));
  if (pi && Array.isArray(pi.absence) && pi.absence.length === 1) {
    eq(pi.absence[0].label, '欠勤控除', '★明細上の項目名がそのまま残る');
    eq(Number(pi.absence[0].amount), -18000, '★符号もマイナスのまま残る');
  }
  /* ★印字された総支給は**すでに減額後**。ここでもう一度引くと二重になる。 */
  eq(Number(saved.other_allowance), 4100,
     '★その他手当の列から減額を引かない（印字の総支給から二重に引かない）');

  const mine2 = (await db.query(`select public.my_pay_reports() as r`)).rows[0].r;
  const m7 = (mine2.reports || []).find((r) => Number(r.period_month) === 7);
  ok(!!m7, '★取り出せる（my_pay_reports がその月を返す）');
  /* ⚠️ my_pay_reports() は pay_items そのものを**返さない**（前からの約束・1492行目）。
     返すのは翌月のひな型に写す pay_items_shape だけ。減額はそこに入ってはいけない
     ── 先月休んだことを今月のひな型に持ち込むと、休んでいない月にも減額が付く。 */
  ok(m7 && !('pay_items' in m7),
     '★取り出しても pay_items そのものは返さない（前からの約束を変えていない）');
  ok(m7 && m7.pay_items_shape && !('absence' in m7.pay_items_shape),
     '★減額は翌月のひな型に持ち込まない（その月だけの事実）',
     JSON.stringify(m7 && m7.pay_items_shape));

  /* ★減額だけしか無い月でも pay_items が空扱いで捨てられない。
     「中身が無い殻」の判定に absence を足し忘れると、ここだけ黙って null になる。 */
  eq(Number(m7 && m7.other_allowance), 4100,
     '★減額を足しても、その月の金額は1円も動かない');
}

console.log(`\n${'─'.repeat(46)}\n${pass} pass / ${fail} fail`);
if (fail) process.exitCode = 1;
