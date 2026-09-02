/* ════════════════════════════════════════════════════════════════
   test-aha.mjs — 「n=0 のアハ」が名乗ってよい範囲を固定する。

   なぜこのテストが要るか:

   ① SSOT（salary-data.mjs）に機種別の粒度は無い。だから
      「同じ機材の平均より＋◯%」とは1文字も書いてはいけない。
      pay_reports.fleet は自前データ側にしかなく、n≥5 まで開かない。
      ★書いた瞬間に「作った数字」になる。ここを grep で固定する。

   ② 画面の比較は currency.js の RATES で円に直し、
      送信後に保存される換算額は DB の fx_rates で決まる。
      この2つがズレると「画面 ¥3,180万 → 保存 ¥3,050万」になり、
      どちらが本当か誰にも分からなくなる。同じ値であることを測る。

   ③ フォームの110社・5職位が、全部 SSOT に着地すること。
      1社でも落ちると、その人にはアハが永久に出ない（沈黙して壊れる）。

   ④ レンジのどこに立つかの判定（下／中／上・平均との差）が、
      境界で反転しないこと。

   実行: node db/test-aha.mjs
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SALARY } from '../salary-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };

const payslip = read('payslip.js');
const salJson = JSON.parse(read('salary-data.json'));

// ── ① 機材別を名乗らない ────────────────────────────────
console.log('\n① 機材別を名乗っていない（SSOT に機種別の粒度が無いため）');
{
  /* 「同機材」「同じ機材」「same fleet」「per fleet」…＝持っていない粒度の主張。
     f-fleet / fleet という識別子そのものは他の用途で出るので、
     “比較の文脈で機材を主語にしている”言い回しだけを禁じる。

     ★見るのは「画面に出る文字列」だけ。禁止を説明したコメント自身
       （「…とは絶対に書かない」）を拾って落ちても意味が無いので、
       ソースからコメントを剥がしてから当てる。 */
  const strip = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, ' ')          // ブロックコメント
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');   // 行コメント（https:// は : の直後なので残る）
  const code = strip(payslip);
  ok(!/絶対に書かない/.test(code) && /絶対に書かない/.test(payslip),
     'コメント剥がしが効いている（説明文は消え、原本には残っている）');
  const BANNED = [
    /同[じ]?機材[のと]?.{0,12}(平均|中央|レンジ|比べ|より)/,
    /機材別.{0,10}(平均|中央|レンジ|比較)/,
    /(平均|中央値|レンジ).{0,10}同[じ]?機材/,
    /same\s+fleet.{0,20}(average|median|range)/i,
    /(average|median|range).{0,20}(for|of)\s+(the\s+)?same\s+fleet/i,
    /per[- ]fleet\s+(average|median|benchmark)/i,
  ];
  /* ★ 比較の文言を出す画面が増えたら、必ずここへ足すこと。
     my-value.js（市場価値レポート）は機材を §1 に表示するので、
     「B777 の平均より…」へ一歩で滑る位置にいる。SSOT に機種別の
     粒度は無いままなので、書いた瞬間に持っていない数字の主張になる。 */
  const SURFACES = [['payslip.js', code], ['my-value.js', strip(read('my-value.js'))]];
  SURFACES.forEach(([f, src]) => {
    BANNED.forEach((re) => {
      const hit = src.match(re);
      ok(!hit, `${f}: 禁止表現なし: ` + re + (hit ? '  ← 見つかった: ' + hit[0] : ''));
    });
  });
  // 逆に、機材を含めていないと自分から断っていること
  ok(/機材・経験年数・契約形態は入っていません/.test(payslip),
     'JP: 「機材・経験年数・契約形態は入っていません」と自分から断っている');
  ok(/does not account for fleet, years of experience or contract type/.test(payslip),
     'EN: 同じ断りが英語にもある');
  // 無税国との比較は「実際の差はもっと大きい」＝過小に振る側へ断る（煽らない）
  ok(/実際の差は大きくなります/.test(payslip) && /the real gap is wider/.test(payslip),
     '無税国との比較は「実際の差はもっと大きい」と断る（上振れに丸めない）');
}

// ── ② 画面のレートと DB のレートが同じ ──────────────────
console.log('\n② currency.js の RATES ＝ DB の fx_rates（画面と保存で換算が食い違わない）');
{
  const js = read('currency.js').match(/var RATES = \{([^}]*)\}/);
  ok(!!js, 'currency.js の RATES を読めた');
  const front = {};
  for (const m of (js ? js[1] : '').matchAll(/([A-Z]{3})\s*:\s*([\d.]+)/g)) front[m[1]] = Number(m[2]);

  const sql = read('db/vocab.generated.sql');
  const blk = sql.slice(sql.indexOf("insert into public.fx_rates"));
  const back = {};
  for (const m of blk.matchAll(/\('([A-Z]{3})',\s*[\d.]+,\s*([\d.]+)\)/g)) back[m[1]] = Number(m[2]);

  ok(Object.keys(front).length > 0 && Object.keys(back).length > 0,
     '両方から通貨を読めた（画面 ' + Object.keys(front).length + ' / DB ' + Object.keys(back).length + '）');
  // 顔ぶれは一致しない（画面の切替メニューは7通貨・DB は45通貨）。
  // 要るのは「画面に出る通貨が全部 DB にもあって、同じ値であること」の片側だけ。
  // 逆向き（DB にあって画面に無い）は正常なので見ない。
  const orphan = Object.keys(front).filter((c) => !(c in back));
  ok(orphan.length === 0,
     '画面の ' + Object.keys(front).length + '通貨が全部 DB にもある' +
     (orphan.length ? '  ← DB に無い: ' + orphan.join(',') : ''));
  Object.keys(front).forEach((c) => ok(front[c] === back[c], c + ' のレートが一致（' + front[c] + '）'));
}

// ── ③ フォームの選択肢が全部 SSOT に着地する ───────────
console.log('\n③ フォームの110社・3職位が SSOT に着地する');
{
  const html = read('pay-report.html');
  const grab = (id) => {
    const m = html.match(new RegExp('<select[^>]*id="' + id + '"[\\s\\S]*?</select>'));
    return [...(m ? m[0] : '').matchAll(/value="([^"]*)"/g)].map((x) => x[1]).filter(Boolean);
  };
  const airlines = grab('f-airline').filter((v) => v !== 'other');
  const missing = airlines.filter((k) => !SALARY[k]);
  ok(missing.length === 0, 'f-airline の ' + airlines.length + '社が全部 SSOT にある' +
     (missing.length ? '  ← 無い: ' + missing.join(',') : ''));

  const noBand = airlines.filter((k) => !(SALARY[k].cap && SALARY[k].cap.avg > 0) ||
                                        !(SALARY[k].fo && SALARY[k].fo.avg > 0));
  ok(noBand.length === 0, '全社が cap / fo の平均を持っている' +
     (noBand.length ? '  ← 欠け: ' + noBand.join(',') : ''));

  /* payslip.js の BAND は cadet を持たない＝訓練生には比較を出さない。
     出さないことは正しいが、「黙って別の帯の数字を出す」に化けていないか見る。
     ★職位は 2026-08-18 に3択（機長・副操縦士・訓練生）へ減らし、
       2026-09-02 に訓練生も外して2択にした（オーナー指示）。SFO・教官機長は
       役職・区分（f-jobrole）で聞くので、公開レンジへ寄せる処理そのものが無くなった。
     ⚠️ cadet の帯を作らないこと。選択肢からは消えたが、既に入っている2件は
        REAL PAY に残っており、帯を足すと訓練中の給与が機長・副操縦士の
        レンジと並んでしまう。 */
  const band = payslip.match(/var BAND = \{([^}]*)\}/);
  ok(!!band, 'payslip.js の BAND を読めた');
  const mapped = Object.fromEntries([...(band ? band[1] : '').matchAll(/(\w+)\s*:\s*'(\w+)'/g)].map((m) => [m[1], m[2]]));
  const positions = grab('f-position');
  ok(positions.join(',') === ['cap', 'fo'].join(','),
     '★f-position は 機長→副操縦士 の2択（訓練生は 2026-09-02 に外した）: ' + positions.join(','));
  ok(!mapped.cadet, '訓練生（cadet）には帯を割り当てていない＝比較を出さない');
  ok(mapped.fo === 'fo' && mapped.cap === 'cap', '副操縦士・機長はそれぞれ自分の帯で見る');
  ok(Object.keys(mapped).sort().join(',') === 'cap,fo',
     '帯へ寄せている職位は無い（寄せるなら注記を戻すこと）: ' + Object.keys(mapped).join(','));
  ok(!/ahaBandNote/.test(payslip), '寄せが無いので「どの帯で見たか」の注記も残っていない');
}

// ── ④ salary-data.json が SSOT と一致している ──────────
console.log('\n④ 画面が読む salary-data.json が SSOT と同じ数字である');
{
  const keys = Object.keys(SALARY);
  ok(Object.keys(salJson.airlines).length === keys.length,
     '社数が一致（SSOT ' + keys.length + ' / json ' + Object.keys(salJson.airlines).length + '）');
  const drift = keys.filter((k) => {
    const a = SALARY[k], b = salJson.airlines[k];
    if (!b) return true;
    return ['cap', 'fo'].some((p) => ['avg', 'lo', 'hi'].some((f) => a[p][f] !== b[p][f])) ||
           a.taxFree !== b.taxFree;
  });
  ok(drift.length === 0, 'cap/fo の avg・lo・hi と taxFree が全社一致' +
     (drift.length ? '  ← ズレ: ' + drift.slice(0, 5).join(',') : ''));
}

// ── ⑤ レンジ判定の境界 ─────────────────────────────────
console.log('\n⑤ レンジのどこに立つかが境界で反転しない');
{
  /* payslip.js の renderAha と同じ式をここで組み直して測る。
     式が1本しかないので、ここが通れば画面も通る。 */
  const where = (man, r) => {
    const span = r.hi - r.lo;
    const dot = Math.max(0, Math.min(100, (man - r.lo) / span * 100));
    if (man < r.lo) return 'under';
    if (man > r.hi) return 'over';
    return ['low', 'mid', 'high'][Math.min(2, Math.floor(dot / 33.34))];
  };
  const r = { lo: 2200, avg: 2700, hi: 3500 };   // ANA 機長（SSOT の実値）
  ok(where(2199, r) === 'under', 'lo の1万円下 → レンジの下');
  ok(where(2200, r) === 'low',   'ちょうど lo → レンジの下寄り（under にしない）');
  ok(where(3500, r) === 'high',  'ちょうど hi → レンジの上寄り（over にしない）');
  ok(where(3501, r) === 'over',  'hi の1万円上 → レンジの上');
  ok(where(2800, r) === 'mid',   '真ん中は真ん中');
  ok(where(3400, r) === 'high',  '上端の手前は上寄り');

  // 平均との差は ±2% 未満を「ほぼ同じ」に倒す（1万円の差を「上」と言わない）
  const vs = (man, avg) => Math.abs(man - avg) / avg < 0.02 ? 'same' : (man > avg ? 'up' : 'down');
  ok(vs(2700, 2700) === 'same', '平均ちょうど → ほぼ同じ');
  ok(vs(2750, 2700) === 'same', '+1.9% → ほぼ同じ');
  ok(vs(2760, 2700) === 'up',   '+2.2% → 高い');
  ok(vs(2640, 2700) === 'down', '−2.2% → 低い');

  /* 順位。自分より平均が高い社の数＋1。同着は上に数えない（＝控えめ側）。 */
  const rank = (man, band) => {
    const pool = Object.values(SALARY).map((a) => a[band].avg).filter((v) => v > 0);
    return { rank: Math.min(pool.length, pool.filter((v) => v > man).length + 1), n: pool.length };
  };
  const top = rank(99999, 'cap');
  ok(top.rank === 1, '誰より高ければ1位');
  ok(top.n === Object.keys(SALARY).length, '母数は SSOT の全社（' + top.n + '社）');
  const bottom = rank(0, 'cap');
  ok(bottom.rank === bottom.n,
     '全社より低くても母数を超えない＝「110社中111番目」を出さない（' + bottom.rank + '/' + bottom.n + '）');
  ok(/Math\.min\(pool\.length, above \+ 1\)/.test(payslip),
     'payslip.js 側でも順位を母数で頭打ちにしている');
}

// ── ⑥ 解放期間のコピーが DB と一致している ─────────────
console.log('\n⑥ 画面の「解放◯日」が DB の実装と一致している');
{
  const sql = read('db/pay-reports.sql');
  const days = sql.match(/now\(\) \+ interval '(\d+) days'\)/);
  ok(!!days, 'submit_pay_report の解放日数を読めた: ' + (days ? days[1] : '?') + '日');
  const d = days ? days[1] : '';
  [['pay-report.html', new RegExp('給与詳細が' + d + '日間')],
   ['en/pay-report.html', new RegExp('full pay detail for ' + d + ' days')]].forEach(([f, re]) => {
    ok(re.test(read(f)), f + ' が ' + d + '日と書いている');
  });
  ['pay-report.html', 'en/pay-report.html'].forEach((f) => {
    const s = read(f);
    ok(!/12ヶ月に伸び|extends to 12 months/.test(s), f + ' に「12ヶ月に伸びる」が残っていない');
  });
}

console.log('\n──────────────────────────────');
console.log(pass + ' pass / ' + fail + ' fail');
process.exit(fail ? 1 : 0);
