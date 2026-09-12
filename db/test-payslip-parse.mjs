/* ════════════════════════════════════════════════════════════════
   parse-payslip の「受け取ったものを整える」と「合っているか確かめる」を測る。

   [supabase/functions/parse-payslip/index.ts:12] が
   「db/test-payslip-parse.mjs がこのファイルを grep して検査している」と
   書いていたのに、そのファイルが無かった（2026-08-13 に作成）。
   ソース側のコメントが約束していた検査が、1つも存在しない状態だった。

   なぜこのテストが要るか:

   ① モデルの出力は毎回違う。**整形（sanitize）が最後の砦**で、
      ここが緩むと誤読がそのままフォームに入って投稿される。
      マイナス表記（△ ▲ 全角 括弧）、語彙外の kind、60進の時間、
      どれも「黙って通る」向きに壊れる。

   ② **検算（reconcile）が今回の主題。**
      これまで「支給の合計が印字された支給合計と合っているか自分で確かめろ」と
      モデルに言っていたが、印字された支給合計を返させていなかったので、
      サーバ側には突き合わせる相手が無かった。1行落ちても桁を間違えても
      confidence:"high" のまま画面に出る道が空いていた。
      検算はそれを塞ぐ唯一の仕掛けなので、境界まで固定しておく。

   ③ **設計上の約束2（ログに画像・ラベル・金額を出さない）。**
      1行 console.error を足すだけで「保存しません」が嘘になる。
      人の目では守れないので機械で見張る。

   ★本体（TypeScript）をそのまま import する。Node 24 は .ts を直接読めるので、
     写経した複製ではなく**本番と同じ実体**を動かしている。
     Deno.env / Deno.serve だけ差し替える（assert-translate-review.mjs と同じ手）。

   ★ここに出てくる金額・時間は全部こちらで作った作り話。
     実物の明細の数字はこのリポジトリに1つも無い。

   ネットワークも API キーも使わない。費用ゼロ。
   実行: node db/test-payslip-parse.mjs
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(ROOT, 'supabase/functions/parse-payslip/index.ts'), 'utf8');

globalThis.Deno = { env: { get: () => '' }, serve: () => {} };
const { sanitize, parseHours, reconcile, applyChecks, payTolerance, systemPrompt,
        EARNING_KINDS, HOUR_KINDS, VARIABLE_BASIS, isCountRow, COUNT_MAX,
        readMoneyNum, isAmbiguousMoney, CUR_DEC } =
  await import('../supabase/functions/parse-payslip/index.ts');

let pass = 0, fail = 0;
const ok = (c, m, extra) => {
  if (c) { pass++; console.log('  ✅ ' + m); }
  else { fail++; console.log('  ❌ ' + m + (extra ? `\n       ${extra}` : '')); }
};
const eq = (got, want, m) =>
  ok(JSON.stringify(got) === JSON.stringify(want), m,
     `got ${JSON.stringify(got)} / want ${JSON.stringify(want)}`);
const near = (got, want, tol, m) =>
  ok(typeof got === 'number' && Math.abs(got - want) <= tol, m, `got ${got} / want ${want}±${tol}`);

/* 明細1枚ぶんの「モデルがこう返してきた」を組み立てる小道具。 */
const slip = (o) => sanitize({
  currency: 'JPY', period: { year: 2026, month: 7 },
  earnings: [], gross_total: null, deductions_total: null, net_pay: null,
  ytd_taxable: null, hours: [], unmapped: [], confidence: 'high', ...o,
});
const E = (label, amount, kind) => ({ label, amount, kind });

// ═══ ① 金額の読み取り ════════════════════════════════════════════
console.log('\n① 支給欄のマイナス表記（日本の明細は「-」だけではない）');
for (const [raw, want] of [
  ['-18000', -18000], ['△18,000', -18000], ['▲18,000', -18000],
  ['−18,000', -18000], ['(18,000)', -18000], ['△１８，０００', -18000],
  ['¥18,000', 18000], ['18,000円', 18000],
]) {
  const r = slip({ earnings: [E('不就労減額', raw, 'absence')] });
  eq(r.earnings[0].amount, want < 0 ? want : -Math.abs(want),
     `"${raw}" → ${want < 0 ? want : -Math.abs(want)}（absence は定義上マイナス）`);
}

console.log('\n①-b 符号の扱いは kind で決まる');
eq(slip({ earnings: [E('住宅手当', -8000, 'housing')] }).earnings[0].amount, 8000,
   '手当がマイナスなのは読み違い → 絶対値に直す');
eq(slip({ earnings: [E('株式積立奨励金', -2000, 'other')] }).earnings[0].amount, -2000,
   '★other だけは符号をそのまま残す（何が来るか決められないので直さない）');
eq(slip({ earnings: [E('不就労減額', 18000, 'absence')] }).earnings[0].amount, -18000,
   'absence は正で来てもマイナスに倒す');

console.log('\n①-c 落とすもの・落とさないもの');
eq(slip({ earnings: [E('プロフィットシェア', 0, 'profit')] }).earnings.length, 0,
   '0円行は落とす（印字だけあって中身が無い欄）');
eq(slip({ earnings: [E('', 5000, 'base')] }).earnings.length, 0, 'ラベルが無い行は落とす');
eq(slip({ earnings: [E('不就労減額', -18000, 'absence')] }).earnings.length, 1,
   '★マイナス行は落とさない（落とすと支給合計が水増しされる向きにずれる）');

console.log('\n①-d 語彙に無い kind は捨てずに unmapped へ');
{
  const r = slip({ earnings: [E('謎手当', 3000, 'mystery'), E('本給A', 150000, 'base')] });
  eq(r.earnings.length, 1, '語彙外は earnings に入らない');
  eq(r.unmapped, [{ label: '謎手当', amount: 3000 }], '★捨てずに残して、あとで本人に聞く');
}
eq(slip({ earnings: [E('本給A', 150000, '')] }).unmapped.length, 1, 'kind が空でも捨てない');
/* ★数ではなく顔ぶれで見る。数だけだと「1つ足して1つ消した」が通ってしまう。 */
eq([...EARNING_KINDS], ['base', 'guarantee', 'command', 'housing', 'flight_variable', 'per_diem',
                        'transport', 'absence', 'notional', 'instructor', 'examiner',
                        'other', 'bonus', 'profit'], '支給の語彙（14種）');
eq([...HOUR_KINDS], ['block', 'duty', 'night', 'credit', 'guarantee'], '時間の語彙（5種）');
/* ⚠️ pension を作らない。日本の明細の厚生年金は**控除**であって支給ではないので、
      kind を作った瞬間に控除の行が収入として立つ道が開く（f-pension は手入力のまま）。 */
ok(!EARNING_KINDS.includes('pension'), '★pension という kind を作っていない（あれは控除）');

console.log('\n①-e 分からない行のうち「金額でない行」だけ印を付ける');
{
  /* 分類できなかった行は画面で年収に足す（そうしないと明細を落とすほど年収が低く出る）。
     ただし「乗務日数 14」まで足すと 14円 が混ざる。かといって語だけで外すと
     「変動付加乗務回数 82,400」という本物の手当が年収から黙って消える。
     ★外し方を間違えたときの実害が非対称なので、語と額の両方がそろったときだけ外す。 */
  const money = [
    ['乗務回数手当', 34000], ['変動付加乗務回数', 82400], ['Sector Pay', 1485],
    ['基本給', 420000], ['Meal & Incidentals', 684], ['Flying Allowance', 1120],
  ];
  for (const [l, a] of money) ok(isCountRow(l, a) === false, `金額として数える: ${l} ${a}`);
  const counts = [['乗務日数', 14], ['SECTORS', 42], ['LEGS', 22], ['Flight days', 18]];
  for (const [l, a] of counts) ok(isCountRow(l, a) === true, `金額でない行: ${l} ${a}`);
  ok(isCountRow('乗務日数', COUNT_MAX + 1) === false,
     `★${COUNT_MAX} を超えたら額とみなす（日数にしては大きすぎる＝金額の可能性）`);
  ok(isCountRow('本給A', null) === false, '額が読めない行を勝手に外さない');

  const r = slip({ earnings: [E('本給A', 150000, 'base')],
                   unmapped: [{ label: 'Sector Pay', amount: 1485 },
                              { label: '乗務日数', amount: 14 }] });
  eq(r.unmapped, [{ label: 'Sector Pay', amount: 1485 }, { label: '乗務日数', amount: 14, count: true }],
     '★印が付くのは金額でない行だけ');
}

console.log('\n①-f 画面（payslip.js）が同じ判定を持っている');
{
  /* この関数はダッシュボードで手作業で貼り替える＝サイト（push で出る）より
     古い時期が必ずある。だから画面側にも同じ判定を置いてある。
     ★写経した複製を突き合わせても意味が無いので、payslip.js から実体を切り出して動かす。 */
  const FRONT = readFileSync(path.join(ROOT, 'payslip.js'), 'utf8');
  const cut = FRONT.match(/\n {2}function isCountRow\(label, amount\) \{[\s\S]*?\n {2}\}/);
  ok(!!cut, '★payslip.js から isCountRow を切り出せた（名前や形を変えたらここで気づく）');
  const front = new Function(cut[0] + '\nreturn isCountRow;')();
  const probe = [['乗務日数', 14], ['SECTORS', 42], ['LEGS', 22], ['Flight days', 18],
                 ['乗務回数手当', 34000], ['変動付加乗務回数', 82400], ['Sector Pay', 1485],
                 ['基本給', 420000], ['Meal & Incidentals', 684], ['乗務日数', COUNT_MAX + 1],
                 ['本給A', null], ['', 14]];
  for (const [l, a] of probe)
    ok(front(l, a) === isCountRow(l, a), `画面とサーバで同じ答え: ${l || '（空）'} ${a}`);
}

console.log('\n①-g 変動給の「何に連動する支給か」（basis）');
{
  /* ★語彙は画面の <select class="pd-basis"> と1つ違わず同じ並びでなければならない。
     片方だけ足すと、読み取った行が画面で「選んでください」のまま必須に引っかかる
     （画面は普通に動いたまま、明細から入った人だけが送信できなくなる）。 */
  for (const f of ['pay-report.html', 'en/pay-report.html']) {
    const html = readFileSync(path.join(ROOT, f), 'utf8');
    const tpl = html.match(/<template id="tpl-pd-var">[\s\S]*?<\/template>/);
    ok(!!tpl, `${f} から tpl-pd-var を切り出せた`);
    const opts = [...tpl[0].matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
    eq(opts, [...VARIABLE_BASIS], `★${f} の10択と VARIABLE_BASIS が同じ並び`);
  }
  const V = (basis) => slip({ earnings: [{ label: 'FLIGHT PAY', amount: 180000,
                                           kind: 'flight_variable', basis }] }).earnings[0];
  eq(V('block').basis, 'block', '語彙にある basis はそのまま通る');
  eq(V('per_sector').basis, 'unknown', '★語彙に無い basis は捨てずに unknown へ倒す');
  eq(V(undefined).basis, 'unknown', '★basis が無くても行は unknown を持つ（画面の必須に引っかからない）');
  eq(slip({ earnings: [{ label: '本給A', amount: 150000, kind: 'base', basis: 'block' }] })
       .earnings[0].basis, undefined, '★変動給以外に付いてきた basis は落とす（置き場が無い）');
}

// ═══ ② 時間 ══════════════════════════════════════════════════════
console.log('\n② 時間は raw（印字そのまま）を優先する');
{
  /* モデルが 60進を 10進のつもりで返してきた場合。raw があれば raw が勝つ。 */
  const r = slip({ hours: [{ label: '勤務時間', raw: '111H59', value: 111.59, kind: 'duty' }] });
  near(r.hours[0].value, 112, 0.05, '111H59 → 112.0（111時間59分。111.59 ではない）');
}
eq(slip({ hours: [{ label: 'BLOCK', raw: '78:12', value: 78.2, kind: 'block' }] }).hours[0].value, 78.2,
   '78:12 → 78.2（欧米のコロン表記）');
eq(slip({ hours: [{ label: '勤務時間', raw: '', value: 120.5, kind: 'duty' }] }).hours[0].value, 120.5,
   'raw が読めなければ value に落ちる');
eq(slip({ hours: [{ label: '不就労時間', raw: '5H00', value: 5, kind: 'absence' }] }).hours.length, 0,
   '★時間の語彙に無い kind は落とす（不就労時間を分母に混ぜない）');
eq(slip({ hours: [{ label: '勤務時間', raw: '999H00', value: 999, kind: 'duty' }] }).hours.length, 0,
   '900時間超は読み違い。通さない');
eq(slip({ hours: [{ label: '深夜時間', raw: '0H00', value: 0, kind: 'night' }] }).hours.length, 0,
   '0時間の欄は落とす（印字だけあって中身が無い）');
eq(parseHours('111H73'), null, '分が60以上＝読み違い');

// ═══ ③ 対象月・通貨 ══════════════════════════════════════════════
console.log('\n③ 対象月と通貨');
eq(slip({ period: { year: 2026, month: 7 } }).period, { year: 2026, month: 7 }, '普通の月');
eq(slip({ period: { year: 2014, month: 7 } }).period, null, '2015年より前は通さない');
eq(slip({ period: { year: 2099, month: 7 } }).period, null, '未来の年は通さない');
eq(slip({ period: { year: 2026, month: 13 } }).period, null, '13月は通さない');
eq(slip({ period: null }).period, null, '読めなければ null（失敗ではない）');
eq(slip({ currency: 'aed' }).currency, 'AED', '小文字は大文字に倒す');
eq(slip({ currency: '¥' }).currency, null, '記号は通貨コードではない');
eq(slip({ currency: 'JPYEN' }).currency, null, '3文字でないものは通さない');
eq(slip({ confidence: 'とても自信あり' }).confidence, 'medium', '語彙外の confidence は medium に倒す');

console.log('\n③-b 金額の読み方（小数点とけた区切り）');
{
  /* ★ここが唯一の防波堤（2026-09-11）。
     カンマを小数点に使う国は45通貨のうち20を超える（EUR圏・BRL・IDR …）。
     8.450,00 を parseFloat で読むと 8.45 になり、**全行が同じ倍率でずれる**ので
     支給合計の検算も手取りの検算も両方 ok のまま通り、confidence も high のまま
     画面に出る。1/1000 になった年収がそのまま REAL PAY まで届く。
     検算では絶対に捕まらないので、読み方そのものを固定する。 */
  // [印字, 通貨の小数桁, 期待]
  const M = [
    ['1,234.56', 2, 1234.56], ['1.234,56', 2, 1234.56], ['8.450,00', 2, 8450],
    ['1,150,000', 0, 1150000], ['1.234.567', 2, 1234567],
    ['1,5', 2, 1.5], ['1000,50', 2, 1000.5], ['0.500', 2, 0.5], ['1.0', 2, 1],
    ['1,23,456', 2, null], ['12.34.56', 2, null], ['', 2, null], [null, 2, null],
    [12345, 2, 12345], ['1234', 0, 1234], ['０', 0, 0],
  ];
  for (const [s, dec, want] of M)
    eq(readMoneyNum(s, dec), want, `${JSON.stringify(s)}（小数${dec}桁）→ ${want}`);

  /* ★1.000 / 500.000 だけは 1000 とも 1.0 とも読める。画面は本人に聞くが、
     サーバは聞けないので**通貨の小数桁で決める**。dec が 3 でない通貨で
     小数3桁の金額はその通貨では成立しない書式＝推測ではなく消去法。 */
  for (const [s, dec, want] of [
    ['1.000', 0, 1000], ['1.000', 2, 1000], ['1.000', 3, 1],
    ['500.000', 0, 500000], ['500.000', 2, 500000], ['500.000', 3, 500],
  ]) eq(readMoneyNum(s, dec), want, `★曖昧は通貨で決める: ${s}（小数${dec}桁）→ ${want}`);
  ok(isAmbiguousMoney('1.000') && isAmbiguousMoney('500.000'), '★曖昧な形を見分けられる');
  ok(!isAmbiguousMoney('0.500') && !isAmbiguousMoney('1.0') && !isAmbiguousMoney('8.450,00'),
     '★曖昧でない形に印を立てない（毎回警告が出ると読み飛ばされる）');
  ok(!isAmbiguousMoney(1000), '★数で返ってきたものは曖昧ではない');

  /* 明細の印字そのまま（記号・通貨コード・全角・△▲・括弧）でも読む。
     プロンプトが「分からなければ印字のまま文字列で返してよい」と言うため。 */
  for (const [s, want] of [
    ['¥18,000', 18000], ['18,000円', 18000], ['USD 1,234.56', 1234.56],
    ['1.234,56 EUR', 1234.56], ['1 234,56', 1234.56], ['１２３４', 1234],
    ['△18,000', -18000], ['▲21,802', -21802], ['−21,802', -21802],
    ['-1,234.56', -1234.56], ['(1.234,56)', -1234.56],
    ['5,000 (net 4,000)', null], ['abc', null],
  ]) eq(readMoneyNum(s, 2), want, `印字のまま読む: ${JSON.stringify(s)} → ${want}`);

  /* ★CUR_DEC は pv-vocab.mjs の写し（Edge Function は .mjs を import できない）。
     小数桁が1つ違うだけで 1.000 の読み方が画面と食い違う。 */
  const { CURRENCIES } = await import('../pv-vocab.mjs');
  const want = Object.fromEntries(CURRENCIES.map((c) => [c.code, c.dec]));
  eq(Object.keys(CUR_DEC).sort(), Object.keys(want).sort(),
     `★CUR_DEC の通貨が pv-vocab.mjs と同じ（${CURRENCIES.length}件）`);
  eq(Object.keys(want).filter((k) => CUR_DEC[k] !== want[k]), [],
     '★小数桁が1件も違わない');

  /* ★画面（pay-report.html の readMoney）と同じ答えを返すか。
     これは写しなので腐る。写経した複製ではなく実体を切り出して動かす
     （①-f と同じ手）。切り出せなくなったらその場で落ちる。 */
  const HTML = readFileSync(path.join(ROOT, 'pay-report.html'), 'utf8');
  const cutG = HTML.match(/\nfunction grp\(s\) \{[\s\S]*?\n\}/);
  const cutR = HTML.match(/\nfunction readMoney\(s\) \{[\s\S]*?\n\}/);
  ok(!!cutG && !!cutR, '★pay-report.html から grp / readMoney を切り出せた');
  const front = new Function(cutG[0] + cutR[0] + '\nreturn readMoney;')();
  /* 画面は「本人が欄に打った文字」を読む＝記号や単位は付かない。
     両方が受け取る素の書式だけを突き合わせる。 */
  const SHARED = [
    ['1,234.56', 2, 1234.56], ['1.234,56', 2, 1234.56], ['8.450,00', 2, 8450],
    ['1,150,000', 0, 1150000], ['1.234.567', 2, 1234567], ['1,5', 2, 1.5],
    ['1000,50', 2, 1000.5], ['0.500', 2, 0.5], ['1.0', 2, 1], ['1234', 0, 1234],
    ['1,23,456', 2, null], ['12.34.56', 2, null],
    ['1.000', 0, 1000], ['1.000', 3, 1], ['500.000', 2, 500000], ['500.000', 3, 500],
  ];
  for (const [s, dec, wantN] of SHARED) {
    const f = front(s);
    /* 画面が「2通りに読める」と言ったときは、サーバが通貨で選ぶほうと同じになるか。
       alts[0] ＝ けた区切り（1000）／ alts[1] ＝ 小数（1.0）。 */
    const mine = f.state === 'ok' ? f.n
      : f.state === 'ambiguous' ? (dec === 3 ? f.alts[1].n : f.alts[0].n)
      : null;
    ok(mine === wantN && readMoneyNum(s, dec) === wantN,
       `画面とサーバで同じ答え: ${JSON.stringify(s)}（小数${dec}桁）→ ${wantN}`,
       `画面=${mine} / サーバ=${readMoneyNum(s, dec)}`);
  }
}

console.log('\n③-c 金額の規則を年・月・時間に持ち込んでいない');
{
  /* ★numOr（数字以外を全部落として parseFloat）は金額には使えないが、
     時間には要る。111H59 に金額の規則を当てると読めずに分母が消える。
     逆に金額に numOr を当てると 8.450,00 が 8.45 になる。**両立しない。**
     どちらがどちらに使われているかを固定する。 */
  const r = slip({ currency: 'EUR',
                   earnings: [E('Basic', '8.450,00', 'base')],
                   gross_total: '8.450,00',
                   period: { year: '2026', month: '7' },
                   hours: [{ label: 'BLOCK', raw: '111H59', value: 111.59, kind: 'block' }] });
  eq(r.earnings[0].amount, 8450, '★金額は金額の規則で読む（8.450,00 → 8450）');
  eq(r.gross_total, 8450, '★支給合計も同じ');
  eq(r.period, { year: 2026, month: 7 }, '年・月は今までどおり');
  near(r.hours[0].value, 112, 0.05, '★時間は raw を優先（111H59 → 111.98…）');
}

// ═══ ④ 検算 ══════════════════════════════════════════════════════
/* 合成明細 payslip-jp-compact.png と同じ（全部でたらめな）数字。 */
const JP = [
  E('本給A', 150000, 'base'), E('本給B', 210000, 'base'),
  E('住宅手当', 8000, 'housing'), E('不就労減額', -18000, 'absence'),
  E('職務手当', 460000, 'command'),
  E('変動付加乗務時間', 160000, 'flight_variable'),
  E('深夜変動付加割増', 2000, 'flight_variable'),
  E('変動付加乗務回数', 11000, 'flight_variable'),
  E('深夜勤務割増手当', 6000, 'flight_variable'),
  E('土日祝出勤手当', 5000, 'flight_variable'),
  E('特別勤務割増手当', 40000, 'flight_variable'),
  E('航空券課税', 9000, 'notional'),
  E('株式積立奨励金', 2000, 'other'),
];
const GROSS = 1045000, DEDUCT = 375275, NET = 669725;

console.log('\n④ 検算A：内訳の合計 と 印字された支給合計');
{
  const c = reconcile(slip({ earnings: JP, gross_total: GROSS, deductions_total: DEDUCT, net_pay: NET }));
  eq(c.gross, 'ok', '13行を符号のまま足すと印字の支給合計に一致する');
  eq(c.gross_summed, GROSS, '足し算の結果');
  eq(c.gross_diff, 0, '差はゼロ');
  eq(c.net, 'ok', '検算B：支給合計 − 控除合計 ＝ 差引支給額');
}
{
  /* ★これが今回いちばん塞ぎたかった穴。1行落ちても今までは誰も気づかなかった。 */
  const c = reconcile(slip({ earnings: JP.filter((e) => e.label !== '職務手当'),
                             gross_total: GROSS, deductions_total: DEDUCT, net_pay: NET }));
  eq(c.gross, 'mismatch', '★職務手当 460,000 が1行落ちたら mismatch');
  eq(c.gross_diff, -460000, '落ちた額がそのまま差として出る');
}
{
  const c = reconcile(slip({ earnings: JP.map((e) => e.label === '不就労減額' ? E(e.label, 18000, 'other') : e),
                             gross_total: GROSS }));
  eq(c.gross, 'mismatch', '★マイナス記号を落とすと mismatch（差は2倍の36,000）');
  eq(c.gross_diff, 36000, '符号を取り違えた向きも分かる');
}
{
  const c = reconcile(slip({ earnings: JP.map((e) => e.label === '本給B' ? E(e.label, 2100000, 'base') : e),
                             gross_total: GROSS }));
  eq(c.gross, 'mismatch', '★桁を1つ間違えたら mismatch');
}

console.log('\n④-b 読めなかったら unknown（★unknown は失敗ではない）');
{
  const c = reconcile(slip({ earnings: JP, gross_total: null }));
  eq(c.gross, 'unknown', '支給合計が印字されていない明細は普通にある');
  eq(c.net, 'unknown', '支給合計が無ければ手取りの検算もできない');
  eq(c.gross_diff, null, '差は出さない（0 と unknown を混同させない）');
}
eq(reconcile(slip({ earnings: [], gross_total: GROSS })).gross, 'unknown',
   '支給欄が1行も読めなければ「合計0で不一致」ではなく unknown');
eq(reconcile(slip({ earnings: JP, gross_total: GROSS, deductions_total: DEDUCT, net_pay: null })).net,
   'unknown', '手取りが読めなければ検算B は unknown');

console.log('\n④-c 検算B は検算A と独立に効く');
{
  const c = reconcile(slip({ earnings: JP, gross_total: GROSS, deductions_total: DEDUCT, net_pay: 969725 }));
  eq(c.gross, 'ok', '支給側は全部読めている');
  eq(c.net, 'mismatch', '★それでも手取りの読み違いは捕まる（差 300,000）');
  eq(c.net_expected, NET, '期待した手取りも一緒に返す');
  eq(c.net_diff, 300000, 'いくらずれたか');
}

console.log('\n④-d 許容差の境界（1通貨単位 か 0.5% の大きいほう）');
eq(payTolerance(1045000), 5225, 'JPY 104.5万 → 0.5% ＝ 5,225円');
eq(payTolerance(100), 1, '小さい額は 1通貨単位が下限');
eq(payTolerance(-1000), 5, 'マイナスでも幅は正');
{
  /* AED は小数第2位まで印字される。四捨五入のずれは飲む。 */
  const near1 = reconcile(slip({ currency: 'AED', earnings: [E('Basic Salary', 32110.5, 'base')],
                                 gross_total: 32110 }));
  eq(near1.gross, 'ok', '0.50 のずれは飲む（丸めの誤差）');
  const far = reconcile(slip({ currency: 'AED', earnings: [E('Basic Salary', 32110, 'base')],
                               gross_total: 74272 }));
  eq(far.gross, 'mismatch', '★どの項目も支給合計の0.5%より大きいので、1行の抜けは飲まない');
}
ok(payTolerance(74272) < 15700,
   '★湾岸明細でいちばん小さい手当（住宅 15,700）より許容差が小さい＝抜けは必ず出る');

console.log('\n④-e notional も符号のまま足す');
{
  /* ここは「支給欄に印字されている行の合計」であって、収入の定義ではない。
     収入から notional を外すのはフォーム側（payslip.js）の仕事。 */
  const c = reconcile(slip({ earnings: JP, gross_total: GROSS }));
  eq(c.gross_summed, GROSS, '航空券課税 9,000 を含めて足すから印字と合う');
  const wrong = JP.filter((e) => e.kind !== 'notional').reduce((a, e) => a + e.amount, 0);
  ok(wrong !== GROSS, '★収入の定義（notional を外した額）で検算すると必ず外れる');
}

console.log('\n④-f 分類できなかった行も、支給の合計に入れる');
{
  /* 海外の変動給は会社ごとに名前が違う（Sector Pay / FDP Allowance / …）ので、
     語彙に無い名前は必ず出る。前はそれが1行あるだけで「支給合計と合いません」に
     なり、confidence が low に落ちて赤い警告が出ていた。
     ★unmapped も明細の支給欄に印字されている行なので、足す側に入れるのが正しい。
       これは検算を緩めるのではない。モデルが行そのものを落としたときは今までどおり出る。 */
  const HALF = JP.filter((e) => e.label !== '職務手当');
  const c = reconcile(slip({ earnings: HALF, gross_total: GROSS, deductions_total: DEDUCT, net_pay: NET,
                             unmapped: [{ label: 'Sector Pay', amount: 460000 }] }));
  eq(c.gross, 'ok', '★分類できなかった1行があっても、額が合っていれば ok');
  eq(c.gross_summed, GROSS, '足し算に unmapped が入っている');
  const p = slip({ earnings: HALF, gross_total: GROSS, unmapped: [{ label: 'Sector Pay', amount: 460000 }] });
  eq(applyChecks(p, reconcile(p)).confidence, 'high',
     '★赤い警告が出なくなった（明細を落とした人ほど損をする形をやめた）');
}
{
  const c = reconcile(slip({ earnings: JP, gross_total: GROSS,
                             unmapped: [{ label: '乗務日数', amount: 14 }] }));
  eq(c.gross, 'ok', '★金額でない行（乗務日数 14）は足さない');
  eq(c.gross_summed, GROSS, '14 が混ざっていない');
}
{
  const c = reconcile(slip({ earnings: JP.filter((e) => e.label !== '職務手当'), gross_total: GROSS }));
  eq(c.gross, 'mismatch', '★モデルが行そのものを落としたときは今までどおり mismatch');
}

// ═══ ⑤ 検算の結果を confidence に反映する ════════════════════════
console.log('\n⑤ 検算が外れたら confidence を low に落とす');
{
  const p = slip({ earnings: JP, gross_total: GROSS, deductions_total: DEDUCT, net_pay: NET });
  const good = applyChecks(p, reconcile(p));
  eq(good.confidence, 'high', '合っていればモデルの申告のまま');
  eq(good.checks.gross, 'ok', 'checks は必ず付けて返す');

  const p2 = slip({ earnings: JP.slice(1), gross_total: GROSS });
  const bad = applyChecks(p2, reconcile(p2));
  eq(bad.confidence, 'low', '★payslip.js は low のときだけ警告を出すので、落とさないと画面に何も出ない');

  const p3 = slip({ earnings: JP, gross_total: null });
  eq(applyChecks(p3, reconcile(p3)).confidence, 'high',
     '★unknown では落とさない（読めなかったことを間違い扱いしない）');

  const p4 = slip({ earnings: JP, gross_total: GROSS, confidence: 'low' });
  eq(applyChecks(p4, reconcile(p4)).confidence, 'low', 'モデルが low なら上げない');
  ok(!('checks' in p), 'applyChecks は元のオブジェクトを書き換えない');
}

console.log('\n⑤-b 読み方の検査（通貨・小数点・桁）');
{
  /* どれも送信は止めない。画面の同じ場所（chkMsg）に1行出すだけ。 */
  const eu = slip({ currency: 'EUR', earnings: JP, gross_total: GROSS });
  const c1 = reconcile(eu);
  eq(c1.currency, 'ok', '45通貨の中なら ok');
  eq(c1.money, 'ok', '通貨が分かっていれば仮定していない');
  eq(c1.scale, 'ok', '普通の金額');

  /* ★45通貨の外（NGN / PKR / RUB …）。いまは #f-currency に無いので
     画面の通貨欄が空のまま、どの通貨が足りないかがオーナーに永久に届かなかった。 */
  const ngn = slip({ currency: 'NGN', earnings: [E('Basic', 900000, 'base')], gross_total: 900000 });
  eq(ngn.currency, 'NGN', '★45通貨の外でもコードは落とさずに返す');
  eq(reconcile(ngn).currency, 'unsupported', '★「まだ選べない通貨」と分かる形で返す');
  eq(reconcile(slip({ currency: '¥', earnings: [E('本給A', 150000, 'base')] })).currency, 'unknown',
     '読めなかったときは unknown（unsupported と区別する）');

  /* ★通貨が分からないまま 1.000 を読んだときだけ「仮定した」と言う。
     曖昧な形が1つも無ければ黙っている（毎回出ると読み飛ばされる）。 */
  const amb = slip({ currency: null, earnings: [E('Basic', '1.000', 'base')], gross_total: '1.000' });
  eq(amb.gross_total, 1000, '通貨不明のときは小数2桁を仮定＝けた区切りとして読む');
  eq(reconcile(amb).money, 'assumed', '★仮定したことを画面に伝える');
  const amb2 = slip({ currency: null, earnings: [E('Basic', '1,234.56', 'base')], gross_total: '1,234.56' });
  eq(reconcile(amb2).money, 'ok', '★曖昧な形が無ければ通貨不明でも黙っている');
  const amb3 = slip({ currency: 'KWD', earnings: [E('Basic', '1.000', 'base')], gross_total: '1.000' });
  eq(amb3.gross_total, 1, '★KWD は小数3桁なので 1.000 は 1.000（数字は変えない）');
  /* ★2026-09-11。ここは前まで 'ok' だった＝「通貨が分かっているなら迷っていない」。
     小数3桁の通貨（KWD / BHD / OMR / JOD）だけは**それが成り立たない**。
     1.000 は 1000 とも 1.000 とも読めて、どちらを採るかの根拠が「通貨の小数桁」
     しか無い。KWD 1.000 と KWD 1000 では年収が1000倍ちがう。 */
  eq(reconcile(amb3).money, 'assumed', '★小数3桁の通貨は「そう読んだ」と画面に出す');
  /* ★広げない。dec が 0 や 2 の通貨で 1.000 を 1000 と読むのは**消去法**
     （その通貨に小数3桁は無い＝1.0 とは読めない）＝迷う余地が無い。
     EUR まで旗を立てると、欧州の明細が毎回この注意を出して読み飛ばされる。 */
  const amb4 = slip({ currency: 'EUR', earnings: [E('Basic', '8.450', 'base')], gross_total: '8.450' });
  eq(amb4.gross_total, 8450, 'EUR の 8.450 は 8450');
  eq(reconcile(amb4).money, 'ok', '★EUR には旗を立てない（消去法で決まる）');
  const amb5 = slip({ currency: 'JPY', earnings: [E('本給A', '1.000', 'base')], gross_total: '1.000' });
  eq(reconcile(amb5).money, 'ok', '★JPY（小数0桁）にも立てない');

  /* ★月の支給合計が100を下回る通貨は45件のどれにも無い。
     小数点を1つ読み違えて 1/1000 になった形。数字はいじらず旗だけ立てる。 */
  const small = slip({ currency: 'EUR', earnings: [E('Basic', 8.45, 'base')], gross_total: 8.45 });
  const cs = reconcile(small);
  eq(cs.scale, 'suspect', '★支給合計が100未満なら桁を疑う');
  eq(applyChecks(small, cs).confidence, 'low', '★confidence も落とす（落とさないと内訳が畳まれたまま）');
  eq(reconcile(slip({ currency: 'EUR', earnings: [E('Basic', 100, 'base')], gross_total: 100 })).scale,
     'ok', '100 ちょうどは疑わない');
  eq(reconcile(slip({ currency: 'JPY', gross_total: null })).scale, 'ok',
     '★読めなかったものを疑わない（unknown は失敗ではない）');
}

// ═══ ⑥ 画面が checks を読んでいるか ══════════════════════════════
console.log('\n⑥ 画面（payslip.js）が検算の結果を使っている');
{
  const FRONT = readFileSync(path.join(ROOT, 'payslip.js'), 'utf8');
  ok(/res\.checks/.test(FRONT), 'renderResult が checks を見ている');
  ok(/chk\.gross === 'mismatch'/.test(FRONT) && /chk\.net === 'mismatch'/.test(FRONT),
     '支給側・手取り側の両方に文言がある');
  ok(/chkGross:/.test(FRONT) && /chkNet:/.test(FRONT), 'JA/EN 両方の文言が定義されている');
  ok((FRONT.match(/chkGross:/g) || []).length === 2, '日本語と英語で2本（片方だけ足していない）');
  ok(/gross_diff/.test(FRONT) && /net_diff/.test(FRONT), '★差額を画面に出す（出さないと見比べる先が分からない）');
  /* 通貨・小数点・桁の3つも同じ場所（chkMsg）に積む。★say() に書くと
     直後の clearPanel() で消える＝画面には何も出ない。 */
  ok(/chkMsg\.push\(T\.chkCur\(/.test(FRONT) && /chkMsg\.push\(T\.chkMoney\)/.test(FRONT) &&
     /chkMsg\.push\(T\.chkScale\)/.test(FRONT),
     '★通貨・小数点・桁の3つも chkMsg に積んでいる（say() ではない）');
  for (const k of ['chkCur:', 'chkMoney:', 'chkScale:'])
    ok((FRONT.match(new RegExp(k, 'g')) || []).length === 2, `${k} が日英2本ある`);
  ok(/T\.chkCur\(esc2\(/.test(FRONT), '★通貨コードは esc2 してから文言に渡す（el が innerHTML で入れる）');
  ok(/payslip_currency_missing/.test(FRONT),
     '★選べない通貨を GA4 に送る（どれを足すべきかが分かる唯一の経路）');
  ok(!/checks[\s\S]{0,200}return;/.test(FRONT.slice(FRONT.indexOf('function renderResult'),
                                                    FRONT.indexOf('function renderResult') + 1200)),
     '★検算が外れても送信を止めていない（止めると一次データが減る）');
}

// ═══ ⑦ プロンプトが約束していること ══════════════════════════════
console.log('\n⑦ systemPrompt の中身');
{
  const P = systemPrompt('ja');
  for (const k of EARNING_KINDS) ok(P.includes(k), `支給の語彙 "${k}" を列挙している`);
  for (const k of HOUR_KINDS) ok(P.includes(k), `時間の語彙 "${k}" を列挙している`);
  ok(P.includes('Never itemise deductions'), '控除は合計しか返させない');
  ok(P.includes('NEVER return 組合費'),
     '★組合名を返させない（どの組合に属しているかは極めて機微。合計だけで足りる）');
  ok(/"raw" MUST be the value copied EXACTLY as printed, character for character/.test(P),
     '時間は印字そのままを写させる（割り算はこちらでやる）');
  ok(/ALWAYS read the CURRENT PERIOD column/.test(P) && /YEAR-TO-DATE/.test(P),
     '★年初来の列を月給と取り違えないよう、読む列を固定している');
  ok(/do not fall back to the year-to-date column/.test(P),
     '★年初来しか見えないときは空で返させる（推測させない）');
  ok(/The money is the AMOUNT/.test(P) && /RATE \(a price per hour/.test(P),
     '★米国様式の単価の列を金額と取り違えないようにしている');
  ok(/"gross_total" is the TOTAL of the earnings column as PRINTED/.test(P),
     '印字された支給合計を返させている（検算の突き合わせ相手）');
  ok(/Do NOT compute it yourself/.test(P), '支給合計を自分で足させない（足すのはこちら）');
  ok(/Never invent a number that is not printed/.test(P), '数字をでっち上げさせない');
  ok(/put it in "unmapped" instead of forcing it into "other"/.test(P), '迷ったら unmapped に落とさせる');
  ok(/it may be in any language/.test(P),
     '★言語を数え上げない（3つに限ると、それ以外を「読めない」扱いする口実になる）');
  ok(/Black rectangles are redactions/.test(P), '黒塗りを「読めない」理由にさせない');
  /* ★2026-08-14 の実測で実際に外した所。米国の明細の「OVERRIDE - INTL」を
     機長手当（command）に入れてしまった。原因は語彙の書き方で、command の例に
     「captain override」と1語だけ置いてあった＝こちらが誘っていた。
     年収の合計は動かないので検算では絶対に拾えない（＝黙って外す形）。
     時間あたりの割増か、階級に対する定額かで書き分けた。 */
  ok(/OVERRIDE - INTL/.test(P) && /international override/.test(P),
     '★時間あたりの割増（OVERRIDE-INTL）を変動給の側に置いている');
  ok(/a FIXED monthly amount paid for holding the rank/.test(P),
     '★機長手当は「階級に対する定額」と書いてある（時間で動くものと混ぜない）');
  /* ★2026-08-14 の実測で実際に起きた大事故。中国の明細の通貨を JPY と答えた。
     ¥ は日本と中国の両方で印字されるので、記号だけを見ると必ずこうなる。
     年収が20倍にずれるのに、支給合計との検算も手取りとの検算も両方通る
     （通貨を取り違えても金額の数字自体は正しいまま）＝黙って外す形。
     記号ではなくラベルの言語で決めさせる。 */
  ok(/A currency SYMBOL never decides this on its own/.test(P),
     '★通貨は記号だけで決めさせない');
  ok(/基本工资/.test(P) && /CNY, not JPY/.test(P),
     '★簡体字のラベルが出たら CNY だと書いてある（¥ に引きずられない）');
  /* ★2026-08-14 の実測（豪州の様式）で unmapped に落ちた語。落ちても金額は
     年収に入るので事故ではないが、同じ質問を全員に出すことになる。
     ★足したのは**実際に落ちた2語だけ**。他の言い回しは推測なので足さない
     （落ちた行は本人に聞いて、その答えが pv_label_hints に溜まる）。 */
  ok(/sector pay/i.test(P) && /FDP allowance/i.test(P),
     '★実測で落ちた変動給の名前（sector pay / FDP allowance）を語彙に持っている');
  /* ★2026-08-27 に足した3つ（フォームの作り直しに読み取りを追いつかせた）。
     どれも「言葉ひとつで静かに壊れる」たぐいなので、規則が本文に在ることを字で見張る。 */
  ok(/職務手当 and 役職手当 are NOT guarantee/.test(P),
     '★保証給と職務手当を混ぜさせない（混ぜると日本の全員の内訳が壊れる）');
  ok(/the FLOOR amount paid when the hours actually flown fall below/.test(P),
     '★保証給を「下限を割ったときに埋められる額」と behaviour で定義している');
  ok(/never return it as "block" or "credit"/.test(P),
     '★保証時間を実際に飛んだ時間と混ぜさせない');
  ok(/INSTRUCTOR PAY/.test(P) && /CHECK AIRMAN/.test(P),
     '★教官・審査の印字を語彙に持っている');
  ok(/If the label does not clearly say training\s*\n?\s*or checking, use "unmapped"/.test(P),
     '★教官か審査かはっきりしない行は unmapped に落とさせる（推測で列に入れない）');
  ok(!/union|組合/i.test(P.split('Classification rules:')[1].split('CRITICAL — do not guess:')[0]),
     '★分類規則に組合を1語も足していない（組合名は返させない）');
  ok(systemPrompt('en').includes('The user reads English'), 'lang=en で英語話者向けになる');
  ok(systemPrompt('ja').includes('The user reads Japanese'), 'lang=ja で日本語話者向けになる');
  ok(systemPrompt('en').includes('keep "label" exactly as printed'),
     '★ラベルは明細のまま返させる（訳させると元の言い方が消える）');
}

// ═══ ⑧ 設計上の約束（index.ts の先頭に書いてあること）════════════
console.log('\n⑧ 約束2：画像・ラベル・金額をログに出さない');
{
  /* [index.ts:12] が「このファイルが grep して検査している」と書いている当のもの。
     1行 console.error を足すだけで「保存しません」が嘘になるので機械で見張る。 */
  const calls = SRC.match(/console\.\w+\([^\n]*/g) || [];
  ok(calls.length > 0, `console 呼び出しは ${calls.length} 箇所`);
  const BAD = /\b(b64|body|raw|text|data|parsed|earnings|label|amount|net_pay|gross_total|err|e)\b/;
  for (const c of calls) ok(!BAD.test(c), `ログに中身が混ざっていない: ${c.trim().slice(0, 60)}`);
  ok(/console\.error\('parse failed'\)/.test(SRC),
     '★例外オブジェクトも出さない（パース対象の文字列が混ざる）');
  ok(!/console\.\w+\(.*\berror\b/.test(SRC), 'エラー本文をそのまま出していない');
  ok(/const errType = await anthropicErrorType\(res\)/.test(SRC),
     'API のエラーは固定語彙の error.type だけ読む');
}

console.log('\n⑧-b 約束1・4・5');
ok(!/storage\.from\(/.test(SRC) && !/from\('pay_reports'\)/.test(SRC),
   '★画像も結果も Storage / DB に書いていない');
ok(!/image_b64[^\n]*json\(/.test(SRC), '画像をレスポンスに返していない');
ok(/return json\(\{ ok: true, result: applyChecks\(/.test(SRC),
   '返すのはフォームの下書きだけ（投稿は本人が確認してから）');
ok(/reason: 'quota_unavailable' \}, 503\)/.test(SRC),
   '★回数を数える所が動かないときは通さない（fail closed）');
ok(/const MODEL = '[a-z0-9-]+';/.test(SRC) && (SRC.match(/claude-[a-z0-9-]+/g) || []).length === 1,
   '★モデル名は定数1か所だけ（散らばると片方だけ古くなる）');

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
