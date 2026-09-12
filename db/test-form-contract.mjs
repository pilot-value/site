/* フォームと RPC の「契約」を確かめる。
   実行: node db/test-form-contract.mjs   （先に node serve.mjs を起動しておく）

   test-pay-reports.mjs は SQL 単体を確かめる。だが本番で壊れる典型は
   「SQL は正しい・ページも正しい・両者の受け渡しがズレている」であり、
   それはどちらの単体テストにも映らない。ここを閉じる。

   やること：localhost の実ページを開き、実際に入力して送信ボタンを押す。
   _sb.rpc だけを差し替えて PGlite 上の本物の submit_pay_report に流し、
   返り値をページに返して結果パネルまで描かせる。
   ＝ネットワークと認証を除いた全経路が本物。本番には一切触らない。

   とくに見張るのは pay-report.html:1268 が自認している式の二重管理：
   ライブ計算 annualTotal() と DB の pv_annual_total() が同じ額を出すか。
   ここがズレると、ユーザーは送信前と送信後で違う金額を見せられる。 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import puppeteer from 'puppeteer';
import { readFileSync, mkdirSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/* db/ から見て1つ上がリポジトリのルート。
   絶対パスを書くと macOS のユーザー名が公開リポジトリに載る */
const ROOT = fileURLToPath(new URL('..', import.meta.url));
/* ★2026-08-27、給与レポートの CSS を pay-report.css へ切り出した（日英で同じ1枚）。
   検査は今までどおり「HTML ＋ そのページが読む CSS」を1つの材料として見る＝切り出す前と同じ。
   ⚠️ ここを HTML だけに戻すと、CSS を見ている**否定形**の検査
   （「破線に戻っていない」「全部大文字に戻していない」…）が空文字列を相手に**黙って通る**。
   落ちないまま守りだけが消える形なので、下の ★CSS-GUARD が中身の有無を毎回確かめている。 */
const PAGE_CSS = { 'pay-report.html': 'pay-report.css', 'en/pay-report.html': 'pay-report.css' };
const read = (f) => {
  const html = readFileSync(path.join(ROOT, f), 'utf8');
  if (!PAGE_CSS[f]) return html;
  return html + '\n<style>\n' + readFileSync(path.join(ROOT, PAGE_CSS[f]), 'utf8') + '\n</style>\n';
};

/* pdSync() が f-payitems を出すかどうかを決めている式だけを切り出す。
   ⚠️ ここを「並びごと写して」見ない。実際に2度それで落ちている ──
      2026-08-27 に `|| mgt` が末尾に足されたとき、
      2026-09-03 に `|| gnone || vnone` が前へ割り込んだとき。
   見たいのは並びではなく「その式の中にその語が居るか」だけ。 */
const emitCond = (s) => (s.match(/\$\('f-payitems'\)\.value = \(([\s\S]*?)\) \?/) || ['', ''])[1];

/* ★給与を保存したあとに鳴ってよい RPC。ここに書いた名前だけが「ほかの RPC」から外れる。
   待遇の質問（pv-conditions.js）はレポートが出たあとに動く。給与の保存とは別の口で、
   落ちてもレポートに触らない。増やすときは「保存より後にしか鳴らないこと」を確かめてから。
   ⚠️ 2つの検査（下書き経路・ログイン済み経路）の両方から参照するのでモジュール直下に置く。 */
const READ_OK = ['next_condition_questions', 'submit_airline_conditions',
  /* ★この2つは招待の仕組み（pv-referral.js）。正常。
     pv_referral_settle … ?ref= で来た人の紐付けを1回だけ確定する（settle()）
     my_cohort_gap      … 「あと N 人」を出すために自分の区分の人数を聞く（gap()）
     どちらも読むだけで、給与の payload には1バイトも関係しない。
     pay-report.html が pv-referral.js を読んでいる以上、この2つは必ず呼ばれる。 */
  'pv_referral_settle', 'my_cohort_gap'];
/* ★偽の解析結果は、本物の parse-payslip の実装に通してから画面へ返す（写経しない）。
   Edge Function は Deno 向けなので、import する前に最小限の Deno を置く
   （db/test-payslip-parse.mjs と同じ手）。読むだけ＝ネットにも Anthropic にも触らない。
   ⚠️ 写経した複製で偽応答を作ると、サーバ側の金額の読み方（カンマ小数点）が
      腐っても検査は緑のまま通る。ここは必ず本物を通すこと。 */
globalThis.Deno = { env: { get: () => '' }, serve: () => {} };
const { sanitize, reconcile, applyChecks } =
  await import('../supabase/functions/parse-payslip/index.ts');

const OUT = path.join(ROOT, 'temporary screenshots', 'pay-contract');
mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label} ${extra}`); }
};

/* ══ 式が1箇所しか無いか ═══════════════════════════════════════
   時給の分子（年額 − 賞与 ÷12 − パーディアム）は pay-viz.js の monthlyOrig() だけ。
   ★ この式は総支給の3つ目の道（内訳だけで入れた月）でも使う。写すと、同じ月の
     「乗務時間あたり」と「総支給」が別々の分子から出ることになる。
   pay-tracker.js から切り出したとき、元の場所に残す／my-value.js に写す、の
   どちらをやっても「片方だけ直して静かにずれる」に戻る。文字列で見張る。
   ★ここが落ちたら、増えた方を消して pay-viz.js を読む形に直すこと。 */
console.log('\n式の置き場所（pay-viz.js に1つだけ）');
{
  const NUMER = 'return (ann - bonus) / 12;';   // pay-viz.js の monthlyOrig()
  const files = readdirSync(ROOT)
    .filter((f) => /\.(js|html)$/.test(f))
    .concat(readdirSync(path.join(ROOT, 'en')).filter((f) => /\.html$/.test(f)).map((f) => 'en/' + f));
  const holders = files.filter((f) => read(f).includes(NUMER));
  ok(holders.length === 1 && holders[0] === 'pay-viz.js',
     `時給の分子を持っているのは pay-viz.js だけ`, holders.join(','));

  /* 総支給（差引支給額 ＋ 控除合計）も同じ。pay_reports に総支給の列は無いので
     足して出すしかないが、my-value.js の §4（額面と手取り）・§6（前回との差）・
     §7b（累計）が全部「総支給」を名乗る。写した瞬間に、同じページの中で
     違う額面が並ぶ。pay-viz.js の grossOrig() 1つに寄せてある。 */
  const GROSS = 'if (n != null && d != null) return n + d;';
  const gHolders = files.filter((f) => read(f).includes(GROSS));
  ok(gHolders.length === 1 && gHolders[0] === 'pay-viz.js',
     `総支給の式を持っているのは pay-viz.js だけ`, gHolders.join(','));

  /* 読み込み順（pay-viz.js が後だと PVViz が未定義でカードごと消える）
     ★2026-09-06、明細トラッカー（pay-tracker.js・462行）を廃止して
       MY PAGE の ③ YOUR PAY に一本化した。図を描くのは my-value.js 1本だけ。 */
  for (const [f, up] of [['profile.html', ''], ['en/profile.html', '../']]) {
    const s = read(f);
    // ★ファイル名だけで探さない。どちらも本文のコメントに出てくる。
    const viz = s.indexOf(`<script src="${up}pay-viz.js">`);
    const mv  = s.indexOf(`<script src="${up}my-value.js">`);
    ok(viz > 0 && mv > 0 && viz < mv,
       `${f}: pay-viz.js を my-value.js より先に読む`, `viz=${viz} mv=${mv}`);
    ok(!/<script src="(\.\.\/)?pay-tracker\.js">/.test(s),
       `${f}: 廃止した pay-tracker.js を読み戻していない`);
    ok(s.includes(`${up}pay-viz.css`), `${f}: pay-viz.css を読む`);
    ok(!s.includes('.pt-top{'), `${f}: .pt-* をインラインに書き戻していない`);
  }
}

/* ══ 市場価値レポート（my-value）の契約 ══════════════════════════
   明細を出した人に返すページ。ここが静かに壊れると Give to Get の
   Get 側だけが消えて、「明細を出したのに何も返ってこない」になる。 */
console.log('\n市場価値レポート（my-value）');
{
  /* ★コメントは落としてから見る。my-value.js の頭には「Verified は出さない」
     「source では分岐しない」「控除の内訳は持たない」と、やらない理由が
     そのまま書いてある。素の文字列で探すと、その説明文に当たって落ちる。 */
  const strip = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, '')          // ブロックコメント
    .replace(/(^|[^:])\/\/.*$/gm, '$1');       // 行コメント（https:// を守る）
  const MV = strip(read('my-value.js'));

  /* ① 器と CSS。PVViz が未定義だと my-value.js は黙ってページごと出さない。
     ★2026-09-06、レポートの置き場が my-value.html → profile.html（MY PAGE の
       ③ YOUR PAY）に移った。my-value.html は転送1枚になったので、
       器を見るのは MY PAGE の側。 */
  for (const [f, up] of [['profile.html', ''], ['en/profile.html', '../']]) {
    const s = read(f);
    const viz = s.indexOf(`<script src="${up}pay-viz.js">`);
    const mv  = s.indexOf(`<script src="${up}my-value.js">`);
    ok(viz > 0 && mv > 0 && viz < mv,
       `${f}: pay-viz.js を my-value.js より先に読む`, `viz=${viz} mv=${mv}`);
    ok(s.includes(`${up}pay-viz.css`) && s.includes(`${up}my-value.css`),
       `${f}: pay-viz.css と my-value.css を読む`);
    ok(!s.includes('.pt-top{') && !s.includes('.mv-row{'),
       `${f}: 図の CSS をインラインに書き戻していない`);
    // 金額は SVG の中にも入る＝currency.js の自動スキャンでは追えない。
    // pv-no-cur を外すと text が span で包まれ、SVG の中身が壊れる。
    // ★器そのものの開始タグを取り出して見る。ページのどこかに pv-no-cur が
    //   あるだけでは足りない（別の要素に付いていても通ってしまう）。
    const tag = (s.match(/<div[^>]*id="pv-value"[^>]*>/) || [''])[0];
    ok(/\bpv-no-cur\b/.test(tag), `${f}: レポートの器に pv-no-cur が付いている`, tag);
    // 要るのは「検索結果に出ない」こと＝noindex。follow / nofollow の別は問わない
    // （head を書くのは seo-normalize.mjs 一本で、そこは noindex,follow を出す。
    //  ログインの奥のページなのでクローラは中身に到達しない）。
    ok(/<meta name="robots" content="noindex[,"]/.test(s),
       `${f}: 本人の明細のページなので noindex`);
  }

  // ② 図と数字は pay-viz.js から借りる（写さない）
  ok(!/function calc\(|function donut\(|function segments\(/.test(MV),
     `my-value.js は calc()/donut()/segments() を写していない`);

  /* ③ ?new=1 は文言だけ。数字に効かせない。
     ここが増えると「出した直後」と「翌月の再訪」で違うページになり、
     どちらが本当なのか本人にも分からなくなる。 */
  const newHits = (MV.match(/isNew/g) || []).length;
  ok(newHits === 2, `?new=1 は文言1箇所にしか効いていない（宣言＋使用の2回）`, `isNew×${newHits}`);

  /* ④ 検証していないものを Verified と表示しない（VISION）。
     付与は parse-payslip 側の仕事で、まだ動いていない。
     source はクライアントの自己申告なので、ここで分岐させてもいけない。 */
  ok(!/verified/i.test(MV), `my-value.js は Verified を表示しない`);
  ok(!/\bsource\b/.test(MV), `my-value.js は source（自己申告）で分岐していない`);

  /* ⑤ 控除は合計だけ。項目名まで残すと、そこから所属組合が割れる
     （VERIFIED-PILOT Part 6）。いま my_pay_reports() は内訳を返していないが、
     将来 SQL に足したとき、画面が黙って拾い始めるのを止める。
     ★文言では探さない。EN の注記が「tax, pension, union dues は保存しない」と
       項目名を挙げて説明しているので、素の grep では必ず当たる。
       行の読み取り（r.xxx）だけを見る。 */
  const OKDEDUCT = ['deduction_total', 'ytd_taxable'];   // どちらも合計。項目ではない
  const bad = [...new Set([...MV.matchAll(/\br\.([a-z_]+)/g)].map((m) => m[1]))]
    .filter((k) => /deduct|tax|pension|union|insur/.test(k) && !OKDEDUCT.includes(k));
  ok(bad.length === 0, `my-value.js は控除の内訳を読んでいない（合計だけ）`, bad.join(','));

/* ★CSS-GUARD ── 切り出した CSS が本当に読めているか。ここが落ちない限り、
   下の CSS を見ている検査は「空を相手に通った」のではないと言える。 */
for (const f of ['pay-report.html', 'en/pay-report.html']) {
  const s = read(f);
  ok(/<link rel="stylesheet" href="(\.\.\/)?pay-report\.css">/.test(s),
     `${f}: ★pay-report.css を読み込んでいる`);
  ok(s.includes('.pay-detail>summary{') && s.includes('.form-label{') && s.length > 120000,
     `${f}: ★CSS が検査の材料に入っている（空を相手に通っていない）`, `${s.length} 文字`);
}

  // ⑥ 明細を出した直後の着地先が Get 側（レポート）に向いている
  for (const f of ['pay-report.html', 'en/pay-report.html']) {
    const s = read(f);
    /* ★2026-09-06、レポートは MY PAGE の ③ YOUR PAY に統合した。
         ?new=1 は「出した直後」の合図で、レポート側の書き出しが変わる。
         #your-pay まで書くのは、①②を飛ばして実額のところへ着けるため。 */
    ok(s.includes('href="profile.html?new=1#your-pay"'),
       `${f}: 投稿後CTAが MY PAGE の YOUR PAY へ向く`);
    ok(!s.includes('href="my-value.html?new=1"'),
       `${f}: 旧CTA（転送1枚になった my-value.html）が残っていない`);
    ok(!s.includes('href="profile.html#pay-tracker"'),
       `${f}: さらに古い CTA（記録の一覧）も残っていない`);
  }

  /* ⑦ 桁区切り（2026-08-13）。金額の欄だけ type="text" ＋ class="money" にして
     こちらで整形する。type="number" のままだとブラウザがカンマごと値を捨てる。
     ★時間・日数・％の欄に money を付けない。あちらは「, は桁区切り」なので、
       5,5 が 55 に読める。別のクラス（num）と別の読み手を使う ── ⑦-h。 */
  /* ★2026-08-26、内訳の作り直しで f-transport / f-other は画面から消えて
       <input type="hidden"> になった（明細読み取りだけが書く）。人が打つ欄は
       繰り返し行の .pd-amt に変わり、id を持たない＝下の extra には出てこない。 */
  /* ★2026-08-26 その3、教官・訓練の手当。その4で審査・査察の手当。
       増える金額の欄は各1つ（今月の支給額）だけ。
       ★単価の欄は作らない（今月の額 ÷ 数量でこちらが出せる）。
       数量（f-instr-qty / f-exam-qty）と組合の活動日数（f-union-days）、
       管理職の管理業務日数（f-mgmt-days）、兼務・配属の業務日数（f-nonline-days）は
       金額ではないので money を付けない。 */
  const MONEY = ['f-gross', 'f-netpay', 'f-perdiem', 'f-bonus-mo', 'f-housing-amt',
                 'f-bonus', 'f-base', 'f-guarantee', 'f-command', 'f-profit',
                 'f-instructor', 'f-examiner', 'f-union-pay', 'f-mgmt-pay', 'f-nonline-pay'];
  for (const f of ['pay-report.html', 'en/pay-report.html']) {
    const s = read(f);
    for (const id of MONEY) {
      ok(new RegExp(`<input type="text" id="${id}" class="form-input money"`).test(s),
         `${f}: ${id} は桁区切りの出せる欄（text ＋ money）`);
    }
    const withMoney = [...s.matchAll(/<input[^>]*id="([a-z0-9-]+)"[^>]*class="[^"]*\bmoney\b/g)]
      .map((m) => m[1]);
    const extra = withMoney.filter((id) => !MONEY.includes(id));
    ok(extra.length === 0, `${f}: 金額以外の欄に money が付いていない`, extra.join(','));
  }

  /* ⑦-h 時間・日数・率の欄（2026-09-11 オーナー指摘）────────────────
     ここも type="number" のままだと**ブラウザが 85,5 のカンマごと値を捨てる**。
     85,5 と書いた人の飛行時間は 855、5,5 と書いた人の税率は 55% になり、
     欄には 855 / 55 と出るだけで画面はどこも壊れていない。
     ★money を付けて直さない。あちらには「, は桁区切り」の規則があり、
       5,5 が 55 に読める道が戻ってくる。**別のクラス（num）で別の読み手**。
     ★上下限は data-min / data-max に持たせる。min / max のままでは効かない
       ── このページには <form> が無いので checkValidity が一度も走らない。 */
  const NUMF = { 'f-block': ['0', '200', false], 'f-duty-h': ['0', '400', false],
                 'f-guar': ['0', '200', false], 'f-stay': ['0', '31', true],
                 'f-duty': ['0', '31', true], 'f-pension': ['0', '100', false],
                 'f-seniority': ['0', '60', true], 'f-tax': ['0', '100', false] };
  for (const f of ['pay-report.html', 'en/pay-report.html']) {
    const s = read(f);
    for (const [id, [lo, hi, int]] of Object.entries(NUMF)) {
      const m = s.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`));
      ok(!!m && /type="text"/.test(m[0]) && /class="form-input num"/.test(m[0]),
         `${f}: ${id} はカンマを持てる欄（text ＋ num）`, m ? m[0] : 'なし');
      ok(!!m && m[0].includes(`data-min="${lo}"`) && m[0].includes(`data-max="${hi}"`),
         `${f}: ${id} の上下限が data-min / data-max にある（${lo}〜${hi}）`);
      ok(!!m && /\bdata-dec="0"/.test(m[0]) === int,
         `${f}: ${id} の整数／小数の区別が保たれている`);
      ok(!!m && !/\bclass="[^"]*\bmoney\b/.test(m[0]),
         `${f}: ${id} に money が付いていない（桁区切りの規則を持ち込まない）`);
    }
    const nums = [...s.matchAll(/<input[^>]*id="([a-z0-9-]+)"[^>]*class="[^"]*\bnum\b/g)].map((m) => m[1]);
    ok(nums.filter((id) => !NUMF[id]).length === 0,
       `${f}: num が付いているのはこの8つだけ`, nums.filter((id) => !NUMF[id]).join(','));
    /* ★本物の欄だけを見る（解説のコメントにも <input type="number"> と書いてある）。
       人が打つ欄は必ず id を持っているので、そこで絞る。 */
    const leftover = [...s.matchAll(/<input[^>]*type="number"[^>]*id="([a-z0-9-]+)"/g)].map((m) => m[1])
      .concat([...s.matchAll(/<input[^>]*id="([a-z0-9-]+)"[^>]*type="number"/g)].map((m) => m[1]));
    ok(leftover.length === 0,
       `${f}: type="number" の欄が残っていない（残ると打ったカンマが黙って消える）`, leftover.join(','));
  }
  /* ★明細読み取りの中の飛行時間（#ps-ask-block）も同じ。あれは #f-block へ
     そのまま書き込むので、number のままだとここだけカンマが消える。 */
  ok(!/id="ps-ask-block"[^>]*type="number"|type="number"[^>]*id="ps-ask-block"/.test(read('payslip.js')),
     'payslip.js: 明細側の飛行時間も type="number" ではない');
  /* ★明細を読んだあとの「直す表」の金額欄（.ps-amt-in）。ここは
     type="number" ＋ Number(...)||0 で、1.234,56 と打ち直した行が**黙って 0**
     になっていた（表には打った文字が出たまま）。読み方はフォーム本体と
     同じ1本（readMoney）に寄せ、2通りに読めるときは額を書き換えない。 */
  {
    const t = read('payslip.js');
    ok(!/class="ps-amt-in"[^>]*type="number"/.test(t),
       'payslip.js: 表の金額欄も type="number" ではない');
    ok(/window\.readMoney/.test(t),
       'payslip.js: 表の金額は readMoney で読む（独自の読み方を持たない）');
    ok(!/lastTrace\[i\]\.amount\s*=\s*Number\(t2\.value\)\s*\|\|\s*0;\s*\n\s*pushTrace/.test(t),
       'payslip.js: Number(value)||0 の素読みが残っていない');
    ok(/window\.askMoney/.test(t),
       'payslip.js: 2通りに読める金額はその場で聞く（黙って決めない）');
  }

  /* ⑦-b 変動給の「種類」は日英でまったく同じ10択（2026-08-26 オーナー指定）。
     ★value がズレると、同じ明細を日本語版と英語版で入れた2人が別の区分に落ちる。
       集計はコードで数えるので、画面には出ないまま静かに割れる。
     ★並びまで同じに保つ。片方だけ並べ替えると、次に触った人がどちらが正か分からない。 */
  const VBASIS = ['block', 'duty', 'sector', 'overtime', 'reserve',
                  'night', 'weekend', 'holiday', 'other', 'unknown'];
  for (const f of ['pay-report.html', 'en/pay-report.html']) {
    const s = read(f);
    const tpl = (s.match(/<template id="tpl-pd-var">[\s\S]*?<\/template>/) || [''])[0];
    const vals = [...tpl.matchAll(/<option value="([a-z]*)"/g)].map((m) => m[1])
      .filter((v) => v !== '');
    ok(JSON.stringify(vals) === JSON.stringify(VBASIS),
       `${f}: 変動給の種類が10択で同じ並び`, vals.join(','));
    ok(!/class="pd-rule"/.test(tpl),
       `${f}: 変動給の行に支給単価・ルールの欄が無い（計算をさせない）`);

    /* ★2026-08-26 その2 オーナー指示。行の並びは 種類 → 支給額 → 明細上の名称。
       金額を先に書かせると、区分は「あとで」になって選ばれない。 */
    const order = [...tpl.matchAll(/class="[^"]*\b(pd-basis|pd-amt|pd-label)\b/g)].map((m) => m[1]);
    ok(JSON.stringify(order) === JSON.stringify(['pd-basis', 'pd-amt', 'pd-label']),
       `${f}: ★変動給の行は 種類 → 支給額 → 明細上の名称 の順`, order.join(' → '));
    /* ★「必須」の印は種類の select に付く（すぐ後ろに置いてあることまで見る）。 */
    ok(/<label class="form-label">[^<]*<span class="req-tag">[^<]*<\/span><\/label>\s*<select class="form-input pd-basis">/.test(tpl),
       `${f}: ★種類に「必須」の印が付いている（逃げ道は末尾の「わからない」）`);
    ok(/class="[^"]*\bpd-label\b/.test(tpl) && /maxlength="60"/.test(tpl),
       `${f}: 明細上の名称の欄は残っている（消さない・そのまま保存する）`);

    /* ★こちらが「書かなくていい」と言うと、書かれなくなる（オーナー指摘）。
       先頭の option と節の説明の両方から、その言い方を締め出す。 */
    const blank = ((tpl.match(/<option value="">([^<]*)</) || [])[1] || '').trim();
    ok(/^(選んでください|Choose one)$/.test(blank),
       `${f}: ★先頭は「選んでください」（選ばなくていいとは言わない）`, blank);
    const hint = ((s.match(/id="opt-pd-var"[\s\S]*?<p class="fld-hint"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '');
    ok(hint.length > 20, `${f}: 変動給の節に説明がある`, hint.slice(0, 40));
    ok(!/任意|書かなくて|なくても|optional|leave (this )?blank/i.test(hint + ' ' + blank),
       `${f}: ★変動給の節に「任意・書かなくていい」の言い方が無い`, hint);
  }

  /* ⑦-c 教官・訓練の手当（2026-08-26 その3）─────────────────────
     いちばん静かに壊れるのは「教官を選んでいない人にも出る」「外したのに中身が残る」
     の2つ。どちらも画面を見た本人には気づけない（見えていない欄の値が送られる）。
     ★ここは字だけで見る。実際に触る側は下の live のところ。 */
  /* ブロックの終端を「最後の </div>」で切る。次のブロックの説明文を巻き込まないため。 */
  const cut = (t) => t.slice(0, t.lastIndexOf('</div>') + 6);
  const INSTR_TRAIN = ['line', 'sim', 'ground', 'crm', 'other'];
  const INSTR_EXTRA = ['separate', 'included', 'none', 'unknown'];
  const INSTR_METHOD = ['monthly', 'duty', 'session', 'sector', 'hour', 'course', 'other'];
  for (const f of ['pay-report.html', 'en/pay-report.html']) {
    const s = read(f);
    const ja = f === 'pay-report.html';

    /* ① 札の併記（オーナー決定）。同じ金額が会社によって「保証給」とも「職務手当」とも
       呼ばれる。片方しか出さないと、もう片方の人は自分の明細のどこを写せばいいのか
       分からない。★列は guarantee_pay のまま（DB は1バイトも変わっていない）。 */
    const gLab = ja ? 'Flight time 保証手当 / 職務手当' : 'Flight time guarantee / Duty allowance';
    ok(s.includes(`<label class="form-label" for="f-guarantee">${gLab}</label>`),
       `${f}: ★保証給の札が2つの呼び名を併記している`, gLab);
    /* ★2026-09-03、チップは消して欄を最初から出すようにした（REAL PAY の
       「報酬の内訳」を開く必須3項目の1つ。奥に畳んだままでは誰も答えられない
       ── 本番23件で保証手当を書いた人は0人だった）。札の併記だけが残る。 */
    ok(!s.includes('data-open="f-guarantee"'),
       `${f}: ★保証給はチップの奥ではなく最初から出ている`);

    /* ①-a 内訳の欄の左に色の縦棒（2026-09-03 オーナー指摘
         「入力するべきところが文字だけじゃわかりづらい」）。
       ⚠️ 必須の縦棒（.fld.is-req::before）とは**別の印**。
          内訳に req-tag を足すのは禁止（CLAUDE.md 給与フォーム鉄則6・
          「空欄は未回答扱い」）。足した瞬間、内訳を書かない人が送信できなくなる。 */
    const rails = (s.match(/<div class="[^"]*\bis-rail\b[^"]*"/g) || []);
    ok(rails.length === 7,
       `${f}: ★内訳の7つの欄すべてに縦棒が引いてある`, String(rails.length));
    ok(rails.filter((c) => /is-rail-key/.test(c)).length === 3,
       `${f}: ★オレンジ（門の必須3項目）はきっかり3つ`,
       String(rails.filter((c) => /is-rail-key/.test(c)).length));
    /* その3つが本当に 基本給・保証給・変動給 か。id で確かめる
       （並びで数えない。1つ挿し込まれただけでずれる）。 */
    for (const id of ['f-base', 'f-guarantee', 'pd-var-rows']) {
      const i = s.indexOf(`id="${id}"`);
      const head = s.lastIndexOf('is-rail', i);
      ok(i > 0 && head > 0 && /is-rail-key/.test(s.slice(head, i)),
         `${f}: ★${id} の欄がオレンジの縦棒を持っている`);
    }
    /* ①-b 塗り分けは markRail() の1本だけ。
       ⚠️ is-done は markRequired() の持ち物。ここで使い回すと必須の勘定に混ざり、
          内訳を書いた人だけ「必須が埋まった」ことになる（本人には見えない）。 */
    const mrail = (s.match(/function markRail\(\)[\s\S]*?\n}/) || [''])[0];
    ok(mrail.length > 100, `${f}: markRail() が在る`, String(mrail.length));
    ok(/is-rail-done/.test(mrail) && !/'is-done'|"is-done"/.test(mrail),
       `${f}: ★markRail は is-rail-done だけを塗る（必須の is-done を使い回さない）`);
    ok(!/req-tag/.test(mrail),
       `${f}: ★markRail は必須の印を見ない（内訳を必須にしない）`);
    const mreq = (s.match(/function markRequired\(\)[\s\S]*?\n}/) || [''])[0];
    ok(mreq.length > 50 && !/is-rail/.test(mreq),
       `${f}: ★markRequired は縦棒の印を見ない（2つの印が混ざらない）`);
    const miss = (s.match(/function missingRequired\(\)[\s\S]*?\n}/) || [''])[0];
    ok(miss.length > 50 && !/is-rail/.test(miss),
       `${f}: ★送信の条件も縦棒の印を見ない`);
    /* ①-c 変動給の入力欄が最初から1本ある（オーナー指摘
         「『変動給を追加』を押さないと入力画面出てこないの直して」）。
       ⚠️ 空の行は送らないし必須にもならない（下の live で実際に押して確かめる）。 */
    ok(/if \(!PD\.var\.rows\.children\.length\) pdAdd\('var', true\);/.test(s),
       `${f}: ★読み込みのとき変動給の行を1本だけ出す`);
    /* ★その1本を、あとから本物の行が来るときに片づける入れ物が居ること（2026-09-03 その4）。
         居ないと「空の行のあと本物の行」という並びが残る。**送信は止まらない**ので
         画面は普通に動いたまま並びだけが崩れる（db/test-payslip-redact.mjs が
         「変動給が2行になる」で落ちて見つかった。手元では 3 行になっていた）。 */
    ok(/function pdDropEmpty\(kind\)/.test(s), `${f}: ★空の行を片づける入れ物がある`);
    /* ★戻すときは「空の行」ではなく **いま並んでいる行を全部** 片づける（2026-09-11）。
         同じ入力が1回の読み込みで2回戻る道がある ── 先に loadPreset() が
         「前回の内容」（pv_pay_last）を戻し、そのあとウィザードが「下書き」
         （pv_pay_draft）を戻す ── ので、足す形だと行が毎回**倍**になる
         （1 → 2 → 4 → 8）。本番で同じ手当が8回並んだ行が1件保存されていた。
         欄は代入で上書きされるから、この二重復元は**行だけ**を壊す＝目で気づけない。
       ⚠️ pdDropEmpty() は消さない。明細が行を生やす側（payslip.js の
          seedRows）がまだ使っている。 */
    const pdres = (s.match(/function pdRestore\(raw, opts\)[\s\S]*?\n}/) || [''])[0];
    ok(pdres.length > 200 && /rows\.children[\s\S]{0,40}\.remove\(\)/.test(pdres)
       && !/pdDropEmpty/.test(pdres),
       `${f}: ★下書きを戻すときは、いま並んでいる行を全部片づける（後ろに足さない）`,
       String(pdres.length));
    /* ①-d 縦棒そのもの（CSS）。3段の色があること・ライトでも見えること。
       ⚠️ ライトの上書きが無いと、白地に rgba(255,255,255,.13) ＝**何も見えない**。
          画面は普通に動いたままなので、明るいテーマの人だけ字だけの画面になる。 */
    ok(/\.is-rail::before\{content:''/.test(s), `${f}: 縦棒が引かれている`);
    ok(/\.is-rail\.is-rail-key::before\{background:/.test(s)
       && /\.is-rail\.is-rail-done::before\{background:/.test(s),
       `${f}: ★残り（オレンジ）と済み（緑）で色が変わる`);
    ok(/\[data-theme="light"\] \.is-rail::before\{/.test(s)
       && /\[data-theme="light"\] \.is-rail\.is-rail-done::before\{/.test(s),
       `${f}: ★明るいテーマにも色がある（白地で消えない）`);

    /* ★終端は次のブロックの直前。ただし次のブロックの説明文（先頭のコメント）が
       手前に付いてくるので、最後の </div> で切る。付いたままだと、あちらの説明に
       出てくる語（req-tag など）を教官の節の中身と取り違える。 */
    const blk = cut(s.slice(s.indexOf('<div id="s3-instr"'), s.indexOf('<div id="s3-exam"')));
    ok(blk.length > 500, `${f}: 教官・訓練の手当のブロックが在る`, String(blk.length));

    /* ② 既定で隠れていること。ここが開いたままになると、教官でない人の画面に
       教官の欄が出る（しかも読み取り側は「教官だ」と受け取る）。 */
    ok(/<div id="s3-instr" hidden>/.test(s),
       `${f}: ★教官のブロックは既定で隠れている（役職で出す）`);
    ok(/function readRoleBoxes\(\)[\s\S]{0,400}?instrToggle\(\)/.test(s),
       `${f}: ★役職・区分を触るたびに出し入れを見直す（readRoleBoxes → instrToggle）`);
    /* 外したら中身も消す。見えていない欄の値を黙って送らないため。 */
    const tog = (s.match(/function instrToggle\(\)[\s\S]*?\n}/) || [''])[0];
    ok(/b\.checked = false/.test(tog) && /\$\(id\)\.value = ''/.test(tog),
       `${f}: ★教官を外したら、選んだ訓練も入れた金額も消す`, tog.slice(0, 60));

    /* ③ 必須を1つも増やしていない。req-tag が段のゲートと送信の条件の出どころなので、
       ここに1つ置くだけで「教官でない人が送れない」まで飛ぶ。 */
    ok(!/req-tag/.test(blk), `${f}: ★教官の節に「必須」の印が無い（段も送信の条件も動かない）`);

    /* ④ こちらが「書かなくていい」と言うと、書かれなくなる（⑦-b と同じ理由）。 */
    ok(!/任意|書かなくて|なくても|optional|leave (this )?blank/i.test(blk),
       `${f}: ★教官の節に「任意・書かなくていい」の言い方が無い`);
    /* ★カッコの注記も足さない（見出し・ラベル・ボタン）。 */
    ok(!/<summary>[\s\S]*?[（(][^）)]*[）)][\s\S]*?<\/summary>/.test(blk),
       `${f}: ★見出しにカッコの注記を足していない`);

    /* 選択肢は日英でまったく同じ value・同じ並び（⑦-b と同じ理由：
       同じ明細を日本語版と英語版で入れた2人が別の区分に落ちる）。 */
    const optsIn = (id) => [...((blk.match(new RegExp(`<select id="${id}"[\\s\\S]*?</select>`)) || [''])[0])
      .matchAll(/<option value="([a-z]*)"/g)].map((m) => m[1]).filter((v) => v !== '');
    const trains = [...blk.matchAll(/name="f-instr-train" value="([a-z]+)"/g)].map((m) => m[1]);
    ok(JSON.stringify(trains) === JSON.stringify(INSTR_TRAIN),
       `${f}: 担当している訓練が5択で同じ並び`, trains.join(','));
    ok(JSON.stringify(optsIn('f-instr-extra')) === JSON.stringify(INSTR_EXTRA),
       `${f}: 追加の支給が4択で同じ並び`, optsIn('f-instr-extra').join(','));
    ok(JSON.stringify(optsIn('f-instr-method')) === JSON.stringify(INSTR_METHOD),
       `${f}: 支給単位が7択で同じ並び`, optsIn('f-instr-method').join(','));
    /* ★2026-08-26 その4、オーナー指示で「何に対して払われるか」→「支給単位」。 */
    const uLab = ja ? '支給単位' : 'Pay unit';
    ok(s.includes(`<label class="form-label" for="f-instr-method">${uLab}</label>`),
       `${f}: ★教官の支給単位の札が「${uLab}」`, uLab);
    for (const id of ['f-instr-extra', 'f-instr-method']) {
      const b = ((blk.match(new RegExp(`<select id="${id}"[\\s\\S]*?<option value=""[^>]*>([^<]*)<`)) || [])[1] || '').trim();
      ok(/^(選んでください|Choose one)$/.test(b), `${f}: ★${id} の先頭は「選んでください」`, b);
    }

    /* ⑤ 数量のラベルは option 側が持つ。JS に文言を持たせると、
       日本語版と英語版で別々にズレる（そして片方だけ直される）。
       ★2026-08-26 その4、オーナー指示で**単価の欄そのものを消した**
         （「サイトで計算したらわかることをパイロットに聞かない」）。
         data-rate / lab-instr-rate / f-instr-rate が戻っていないことを字で見る。 */
    const meth = (blk.match(/<select id="f-instr-method"[\s\S]*?<\/select>/) || [''])[0];
    const withData = [...meth.matchAll(/<option value="([a-z]*)"[^>]*data-qty="([^"]*)"/g)];
    ok(withData.length === INSTR_METHOD.length + 1,
       `${f}: ★どの option も数量のラベルを自分で持っている`, String(withData.length));
    ok(withData.filter((m) => m[2]).length === INSTR_METHOD.length - 1,
       `${f}: ★月額固定だけは数量も持たない（数える物が無い）`);
    ok(!/data-rate|f-instr-rate|lab-instr-rate/.test(s),
       `${f}: ★単価の欄が戻っていない（今月の額 ÷ 数量でこちらが出す）`);
    const sync = (s.match(/function instrSync\(\)[\s\S]*?\n}/) || [''])[0];
    ok(/dataset\.qty/.test(sync) && !/dataset\.rate/.test(sync),
       `${f}: ★JS は option の data-qty を読むだけ（文言も単価も持たない）`);
    /* ★注釈は読み飛ばす（説明にはその言葉が出る）。動くコードだけを見る。 */
    const syncCode = sync.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    ok(!/単価|回数|per session|per hour/i.test(syncCode),
       `${f}: ★JS に単位の文言が1つも無い（日英で同じコードが動く）`, syncCode.slice(0, 80));

    /* ★教官の額は専用の欄。職位手当・変動給・その他へは足し込まない
       （オーナー指示「二重入力させない」の実体）。合計を作っている3か所に
       f-instructor が混ざっていないことを字で見る。 */
    ok(/instructor_pay:\s*val\('f-instructor'\)/.test(s),
       `${f}: ★教官の額は専用の列へそのまま行く（instructor_pay）`);
    for (const [key, line] of [['command_pay', (s.match(/command_pay:[^\n]*/) || [''])[0]],
                               ['other_allowance', (s.match(/other_allowance:[^\n]*/) || [''])[0]],
                               ['flight_variable_pay', (s.match(/flight_variable_pay:[^\n]*/) || [''])[0]]]) {
      ok(line.length > 10 && !/f-instructor/.test(line),
         `${f}: ★教官の額を ${key} に足し込んでいない`, line.trim());
    }
  }

  /* ⑦-d 審査・査察（Examiner / Check）の手当（2026-08-26 その4）──────
     役割ごとのモジュールの2本目。教官と同じ壊れ方をするので、同じ形で見る。
     ★ここだけの本題は「二重計上させない」── 教官と審査の両方をやっている人が、
       同じ手当を2回入れないこと。だから extra に with_instructor が要る。 */
  const EXAM_CHECK  = ['sim', 'line', 'recurrent', 'upgrade', 'other'];
  const EXAM_EXTRA  = ['separate', 'with_instructor', 'included', 'none', 'unknown'];
  const EXAM_METHOD = ['monthly', 'check', 'session', 'duty', 'hour', 'other'];
  for (const f of ['pay-report.html', 'en/pay-report.html']) {
    const s = read(f);
    const ja = f === 'pay-report.html';
    /* ⚠️ 終わりは組合のブロックの手前。「繰り返し行の型」まで取ると、
       ⑦-e の組合の節をここが丸ごと飲み込む（審査の検査が組合にも当たる）。 */
    const blk = cut(s.slice(s.indexOf('<div id="s3-exam"'), s.indexOf('<div id="s3-union"')));
    ok(blk.length > 500, `${f}: 審査・査察の手当のブロックが在る`, String(blk.length));

    /* ① 既定で隠れている・役職を触るたびに見直す・外したら中身も消す。 */
    ok(/<div id="s3-exam" hidden>/.test(s),
       `${f}: ★審査のブロックは既定で隠れている（役職で出す）`);
    ok(/function readRoleBoxes\(\)[\s\S]{0,400}?examToggle\(\)/.test(s),
       `${f}: ★役職・区分を触るたびに出し入れを見直す（readRoleBoxes → examToggle）`);
    const tog = (s.match(/function examToggle\(\)[\s\S]*?\n}/) || [''])[0];
    ok(/b\.checked = false/.test(tog) && /\$\(id\)\.value = ''/.test(tog),
       `${f}: ★審査を外したら、選んだ Check も入れた金額も消す`, tog.slice(0, 60));

    /* ② 必須をひとつも増やさない・「任意」と書かない・カッコの注記を足さない。 */
    ok(!/req-tag/.test(blk), `${f}: ★審査の節に「必須」の印が無い（段も送信の条件も動かない）`);
    ok(!/任意|書かなくて|なくても|optional|leave (this )?blank/i.test(blk),
       `${f}: ★審査の節に「任意・書かなくていい」の言い方が無い`);
    ok(!/<summary>[\s\S]*?[（(][^）)]*[）)][\s\S]*?<\/summary>/.test(blk),
       `${f}: ★審査の見出しにカッコの注記を足していない`);

    /* ③ 選択肢は日英でまったく同じ value・同じ並び。 */
    const optsIn = (id) => [...((blk.match(new RegExp(`<select id="${id}"[\\s\\S]*?</select>`)) || [''])[0])
      .matchAll(/<option value="([a-z_]*)"/g)].map((m) => m[1]).filter((v) => v !== '');
    const checks = [...blk.matchAll(/name="f-exam-check" value="([a-z]+)"/g)].map((m) => m[1]);
    ok(JSON.stringify(checks) === JSON.stringify(EXAM_CHECK),
       `${f}: 担当している Check が5択で同じ並び`, checks.join(','));
    ok(JSON.stringify(optsIn('f-exam-extra')) === JSON.stringify(EXAM_EXTRA),
       `${f}: 追加の支給が5択で同じ並び`, optsIn('f-exam-extra').join(','));
    ok(optsIn('f-exam-extra').includes('with_instructor'),
       `${f}: ★★「教官の手当とまとめて支給されている」が在る（二重入力を止める唯一の道）`);
    ok(JSON.stringify(optsIn('f-exam-method')) === JSON.stringify(EXAM_METHOD),
       `${f}: 支給単位が6択で同じ並び`, optsIn('f-exam-method').join(','));
    const uLab = ja ? '支給単位' : 'Pay unit';
    ok(blk.includes(`<label class="form-label" for="f-exam-method">${uLab}</label>`),
       `${f}: ★審査の支給単位の札が「${uLab}」`, uLab);
    for (const id of ['f-exam-extra', 'f-exam-method']) {
      const b = ((blk.match(new RegExp(`<select id="${id}"[\\s\\S]*?<option value=""[^>]*>([^<]*)<`)) || [])[1] || '').trim();
      ok(/^(選んでください|Choose one)$/.test(b), `${f}: ★${id} の先頭は「選んでください」`, b);
    }

    /* ④ 数量のラベルは option 側が持つ。★単価の欄は作らない（①のルール）。 */
    const meth = (blk.match(/<select id="f-exam-method"[\s\S]*?<\/select>/) || [''])[0];
    const withData = [...meth.matchAll(/<option value="([a-z_]*)"[^>]*data-qty="([^"]*)"/g)];
    ok(withData.length === EXAM_METHOD.length + 1,
       `${f}: ★どの option も数量のラベルを自分で持っている`, String(withData.length));
    ok(withData.filter((m) => m[2]).length === EXAM_METHOD.length - 1,
       `${f}: ★月額固定だけは数量も持たない（数える物が無い）`);
    ok(!/f-exam-rate|lab-exam-qty"[^>]*data-rate/.test(s),
       `${f}: ★審査にも単価の欄を作っていない（今月の額 ÷ 数量でこちらが出す）`);
    const sync = (s.match(/function examSync\(\)[\s\S]*?\n}/) || [''])[0];
    ok(/dataset\.qty/.test(sync) && !/dataset\.rate/.test(sync),
       `${f}: ★JS は option の data-qty を読むだけ（文言も単価も持たない）`);
    const syncCode = sync.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    ok(!/回数|セッション|Checks this|Sessions this/i.test(syncCode),
       `${f}: ★JS に単位の文言が1つも無い（日英で同じコードが動く）`, syncCode.slice(0, 80));

    /* ⑤ 審査の額は専用の欄。教官・職位手当・変動給・その他へは足し込まない。 */
    ok(/examiner_pay:\s*val\('f-examiner'\)/.test(s),
       `${f}: ★審査の額は専用の列へそのまま行く（examiner_pay）`);
    for (const [key, line] of [['command_pay', (s.match(/command_pay:[^\n]*/) || [''])[0]],
                               ['other_allowance', (s.match(/other_allowance:[^\n]*/) || [''])[0]],
                               ['flight_variable_pay', (s.match(/flight_variable_pay:[^\n]*/) || [''])[0]],
                               ['instructor_pay', (s.match(/instructor_pay:[^\n]*/) || [''])[0]]]) {
      ok(line.length > 10 && !/f-examiner/.test(line),
         `${f}: ★審査の額を ${key} に足し込んでいない`, line.trim());
    }
  }

  /* ⑦-e 組合・乗員代表（Union / Pilot representative）の手当（2026-08-26 その5）──
     役割ごとのモジュールの3本目。教官・審査と同じ壊れ方をするので、同じ形で見る。
     ★ここだけの本題は「支給元」── 組合から出ている額は会社の明細に載っていないので、
       総支給との突き合わせ（#pd-over）に無条件で足すと注意が嘘で出る。
     ★聞くのは3つだけ（活動日数・追加支給の有無・あるなら金額と支給元）。
       Committee の種別・Union 内の役職名・Negotiation / Safety の活動内容・
       給与保障制度は聞かない（オーナー明記）。増えていないことをここで見張る。 */
  const UNION_EXTRA = ['yes', 'none', 'unknown'];
  const UNION_SRC   = ['airline', 'union', 'both', 'other'];
  for (const f of ['pay-report.html', 'en/pay-report.html']) {
    const s = read(f);
    const ja = f === 'pay-report.html';
    /* ⚠️ 終わりは管理職のブロックの手前。「繰り返し行の型」まで取ると
       ⑤で足した #s3-mgmt を組合ごと飲み込んで、下の「聞くのは4欄だけ」が落ちる。 */
    const blk = cut(s.slice(s.indexOf('<div id="s3-union"'),
                            s.indexOf('<div id="s3-mgmt"')));
    ok(blk.length > 400, `${f}: 組合・乗員代表の手当のブロックが在る`, String(blk.length));

    /* ① 既定で隠れている・役職を触るたびに見直す・外したら中身も消す。 */
    ok(/<div id="s3-union" hidden>/.test(s),
       `${f}: ★組合のブロックは既定で隠れている（役職で出す）`);
    ok(/function readRoleBoxes\(\)[\s\S]{0,500}?unionToggle\(\)/.test(s),
       `${f}: ★役職・区分を触るたびに出し入れを見直す（readRoleBoxes → unionToggle）`);
    const tog = (s.match(/function unionToggle\(\)[\s\S]*?\n}/) || [''])[0];
    ok(/indexOf\('union'\)/.test(tog) && /\$\(id\)\.value = ''/.test(tog),
       `${f}: ★組合を外したら、入れた日数も金額も消す`, tog.slice(0, 60));

    /* ② 必須をひとつも増やさない・「任意」と書かない・カッコの注記を足さない。 */
    ok(!/req-tag/.test(blk), `${f}: ★組合の節に「必須」の印が無い（段も送信の条件も動かない）`);
    ok(!/任意|書かなくて|なくても|optional|leave (this )?blank/i.test(blk),
       `${f}: ★組合の節に「任意・書かなくていい」の言い方が無い`);
    ok(!/<summary>[\s\S]*?[（(][^）)]*[）)][\s\S]*?<\/summary>/.test(blk),
       `${f}: ★組合の見出しにカッコの注記を足していない`);

    /* ③ 選択肢は日英でまったく同じ value・同じ並び。 */
    const optsIn = (id) => [...((blk.match(new RegExp(`<select id="${id}"[\\s\\S]*?</select>`)) || [''])[0])
      .matchAll(/<option value="([a-z_]*)"/g)].map((m) => m[1]).filter((v) => v !== '');
    ok(JSON.stringify(optsIn('f-union-extra')) === JSON.stringify(UNION_EXTRA),
       `${f}: 追加の支給が3択で同じ並び`, optsIn('f-union-extra').join(','));
    ok(JSON.stringify(optsIn('f-union-src')) === JSON.stringify(UNION_SRC),
       `${f}: 支給元が4択で同じ並び`, optsIn('f-union-src').join(','));
    for (const id of ['f-union-extra', 'f-union-src']) {
      const b = ((blk.match(new RegExp(`<select id="${id}"[\\s\\S]*?<option value=""[^>]*>([^<]*)<`)) || [])[1] || '').trim();
      ok(/^(選んでください|Choose one)$/.test(b), `${f}: ★${id} の先頭は「選んでください」`, b);
    }

    /* ④ 「なし」「わからない」ならすぐ終わる ── 金額と支給元はまとめて隠す。
       ★単価も1日あたりの額も聞かない（今月の額 ÷ 日数でこちらが出せる）。 */
    ok(/<div class="opt-fld" id="opt-union-pay" hidden>/.test(blk),
       `${f}: ★金額と支給元は既定で隠れている（「あり」を選ぶまで出ない）`);
    const sync = (s.match(/function unionSync\(\)[\s\S]*?\n}/) || [''])[0];
    ok(/=== 'yes'/.test(sync) && /opt-union-pay'\)\.hidden = !yes/.test(sync),
       `${f}: ★「あり」のときだけ金額と支給元を出す`, sync.slice(0, 80));
    ok(/for \(const id of UNION_PAY_IDS\) \$\(id\)\.value = ''/.test(sync),
       `${f}: ★「なし」「わからない」に戻したら、隠した欄の中身も消す`);
    ok(!/f-union-rate|f-union-per-day|f-union-unit/.test(s),
       `${f}: ★組合にも単価・1日あたりの欄を作っていない（今月の額 ÷ 日数でこちらが出す）`);

    /* ⑤ 増やさないと決めたことを増やしていない（オーナー明記）。 */
    ok(!/f-union-(committee|title|role|activity|protect|guarantee)/.test(s),
       `${f}: ★Committee 種別・Union 内の役職名・活動内容・給与保障制度を聞いていない`);
    const inputs = [...blk.matchAll(/<(?:input|select|textarea)[^>]*id="([a-z0-9-]+)"/g)].map((m) => m[1]);
    ok(JSON.stringify(inputs) === JSON.stringify(
         ['f-union-days', 'f-union-extra', 'f-union-pay', 'f-union-src']),
       `${f}: ★組合に聞くのは4欄だけ（日数・有無・金額・支給元）`, inputs.join(','));

    /* ⑥ 組合の額は専用の欄。教官・審査・職位手当・変動給・その他へは足し込まない。 */
    ok(/union_pay:\s*val\('f-union-pay'\)/.test(s),
       `${f}: ★組合の額は専用の列へそのまま行く（union_pay）`);
    for (const [key, line] of [['command_pay', (s.match(/command_pay:[^\n]*/) || [''])[0]],
                               ['other_allowance', (s.match(/other_allowance:[^\n]*/) || [''])[0]],
                               ['flight_variable_pay', (s.match(/flight_variable_pay:[^\n]*/) || [''])[0]],
                               ['instructor_pay', (s.match(/instructor_pay:[^\n]*/) || [''])[0]],
                               ['examiner_pay', (s.match(/examiner_pay:[^\n]*/) || [''])[0]]]) {
      ok(line.length > 10 && !/f-union-pay/.test(line),
         `${f}: ★組合の額を ${key} に足し込んでいない`, line.trim());
    }

    /* ⑦ ★★支給元の扱い。ここだけ教官・審査と違う。
       組合から出ている額は会社の明細に無いので、総支給との突き合わせには
       会社から出ているぶんだけを足す。無条件に足すと
       「内訳の合計が総支給を超えています」が嘘で出る。 */
    const gate = (s.match(/function unionInGross\(\)[\s\S]*?\n}/) || [''])[0];
    ok(/'airline'/.test(gate) && /'both'/.test(gate) && /'other'/.test(gate)
       && !/'union'\s*\|\|/.test(gate) && !/===\s*'union'/.test(gate),
       `${f}: ★総支給と突き合わせるのは会社から出ているぶん（airline / both / other）`,
       gate.slice(0, 80));
    const md = (s.match(/function monthlyDetail\(\)[\s\S]*?\n}/) || [''])[0];
    ok(/unionInGross\(\)\s*\?\s*num\('f-union-pay'\)\s*:\s*0/.test(md),
       `${f}: ★monthlyDetail は条件つきで足している（無条件に足していない）`, md.slice(-120));

    /* ⑦-b ★年収に足すのは「総支給の外で払われたぶん」だけ（2026-09-02）。
       ⚠️ **外は「組合」だけ**。その他（other）を選ぶ人もお金は会社から出ているので、
          ここに入れると総支給に二重で足して年収を盛る（2026-09-02 オーナー判断）。
       unionInGross() の裏返しではない ── 支給元が空のときは**どちらも足さない**。
       あちらは注意を出すかどうかで、外しても誰も損をしない。年収は足すと盛る。
       サーバの pv_union_outside_gross（db/pay-reports.sql 4章）と同じ規則。 */
    const out = (s.match(/function unionOutsideGross\(\)[\s\S]*?\n}/) || [''])[0];
    ok(/'union'/.test(out)
       && !/'other'/.test(out) && !/'airline'/.test(out) && !/'both'/.test(out),
       `${f}: ★年収に足すのは支給元が組合のときだけ`, out.slice(0, 90));
    ok(/f-union-extra'\)\.value\s*!==\s*'yes'/.test(out),
       `${f}: ★「別途の支給あり」と答えた人だけ（分からない・無しでは足さない）`,
       out.slice(0, 90));
    const at = (s.match(/function annualTotal\(\)[\s\S]*?\n}/) || [''])[0];
    ok(/unionOutsideGross\(\)/.test(at) && !/unionInGross\(\)/.test(at),
       `${f}: ★年換算が見ているのは unionOutsideGross（unionInGross ではない）`,
       at.slice(-200));
    ok(/f-union-pay/.test(at),
       `${f}: ★年換算に組合の額が入っている`, at.slice(-200));
    /* 総支給そのものは書き換えない（教官・審査と同じ約束）。 */
    ok(!/\$\('f-gross'\)\.value\s*=/.test(s.replace(/put\('f-gross'[^\n]*/g, '')),
       `${f}: ★総支給の欄をこちらから書き換えていない`);

    /* ⑧ pay_items へ乗る形。組合はオブジェクト1つ（配列ではない）。 */
    ok(/if \(uni\) pi\.union = uni;/.test(s),
       `${f}: ★組合の中身は pay_items.union に乗る`);
    ok(/\buni\b/.test(emitCond(s)),
       `${f}: ★組合だけ書いた人の pay_items が空にされない`, emitCond(s));
  }

  /* ⑦-f 管理・マネジメント（Management / Leadership）の手当（2026-08-26 その6）──
     役割ごとのモジュールの4本目。教官・審査・組合と同じ壊れ方をするので、同じ形で見る。
     ★ここだけの本題は「組合と違って無条件に足す」── 管理職の手当は会社が払う＝
       総支給の中にあるので、内訳の合計（monthlyDetail）には条件なしで足す。
       組合の unionInGross を写して条件を作ると、内訳の合計が実際より小さく出る。
     ★聞くのは2つだけ（管理業務日数・追加支給の有無。あるときだけ金額と支給単位）。
       役職分類・管理人数・会議時間・管理職歴・担当部署・業務の割合は聞かない（オーナー明記）。
     ★数量の欄が無いのは、①の日数がそのまま数量だから（教官・審査より1欄少ない）。 */
  const MGMT_EXTRA  = ['separate', 'included', 'none', 'unknown'];
  const MGMT_METHOD = ['monthly', 'duty', 'other'];
  for (const f of ['pay-report.html', 'en/pay-report.html']) {
    const s = read(f);
    const ja = f === 'pay-report.html';
    /* ⚠️ 終わりは「繰り返し行の型」ではなく、次のブロックの頭で止める。
       ここを直し忘れると⑥（その他の兼務・配属）まで飲み込んで、
       「管理職の節には無いはず」の検査が⑥の中身に当たって落ちる（⑦-d・⑦-e で2度踏んだ）。 */
    const blk = cut(s.slice(s.indexOf('<div id="s3-mgmt"'),
                            s.indexOf('<div id="s3-nonline"')));
    ok(blk.length > 400, `${f}: 管理・マネジメントの手当のブロックが在る`, String(blk.length));

    /* ① 既定で隠れている・役職を触るたびに見直す・外したら中身も消す。 */
    ok(/<div id="s3-mgmt" hidden>/.test(s),
       `${f}: ★管理職のブロックは既定で隠れている（役職で出す）`);
    ok(/function readRoleBoxes\(\)[\s\S]{0,600}?mgmtToggle\(\)/.test(s),
       `${f}: ★役職・区分を触るたびに出し入れを見直す（readRoleBoxes → mgmtToggle）`);
    const tog = (s.match(/function mgmtToggle\(\)[\s\S]*?\n}/) || [''])[0];
    ok(/indexOf\('management'\)/.test(tog) && /\$\(id\)\.value = ''/.test(tog),
       `${f}: ★管理職を外したら、入れた日数も金額も消す`, tog.slice(0, 60));

    /* ② 必須をひとつも増やさない・「任意」と書かない・カッコの注記を足さない。 */
    ok(!/req-tag/.test(blk), `${f}: ★管理職の節に「必須」の印が無い（段も送信の条件も動かない）`);
    ok(!/任意|書かなくて|なくても|optional|leave (this )?blank/i.test(blk),
       `${f}: ★管理職の節に「任意・書かなくていい」の言い方が無い`);
    ok(!/<summary>[\s\S]*?[（(][^）)]*[）)][\s\S]*?<\/summary>/.test(blk),
       `${f}: ★管理職の見出しにカッコの注記を足していない`);

    /* ③ 選択肢は日英でまったく同じ value・同じ並び。 */
    const optsIn = (id) => [...((blk.match(new RegExp(`<select id="${id}"[\\s\\S]*?</select>`)) || [''])[0])
      .matchAll(/<option value="([a-z_]*)"/g)].map((m) => m[1]).filter((v) => v !== '');
    ok(JSON.stringify(optsIn('f-mgmt-extra')) === JSON.stringify(MGMT_EXTRA),
       `${f}: 追加の支給が4択で同じ並び`, optsIn('f-mgmt-extra').join(','));
    ok(JSON.stringify(optsIn('f-mgmt-method')) === JSON.stringify(MGMT_METHOD),
       `${f}: 支給単位が3択で同じ並び`, optsIn('f-mgmt-method').join(','));
    for (const id of ['f-mgmt-extra', 'f-mgmt-method']) {
      const b = ((blk.match(new RegExp(`<select id="${id}"[\\s\\S]*?<option value=""[^>]*>([^<]*)<`)) || [])[1] || '').trim();
      ok(/^(選んでください|Choose one)$/.test(b), `${f}: ★${id} の先頭は「選んでください」`, b);
    }
    /* ★支給単位の言い方は教官・審査と同じ語（オーナー確認済み）。「支給方法」に戻さない。 */
    const mlab = ((blk.match(/<label class="form-label" for="f-mgmt-method">([^<]*)</) || [])[1] || '').trim();
    ok(/^(支給単位|Pay unit)$/.test(mlab), `${f}: ★支給単位の見出しは教官・審査と同じ語`, mlab);

    /* ④ 「含まれる」「なし」「わからない」ならすぐ終わる ── 金額と支給単位はまとめて隠す。
       ★単価も1日あたりの額も聞かない（今月の額 ÷ 日数でこちらが出せる）。 */
    ok(/<div class="opt-fld" id="opt-mgmt-pay" hidden>/.test(blk),
       `${f}: ★金額と支給単位は既定で隠れている（「別途支給」を選ぶまで出ない）`);
    const sync = (s.match(/function mgmtSync\(\)[\s\S]*?\n}/) || [''])[0];
    ok(/=== 'separate'/.test(sync) && /opt-mgmt-pay'\)\.hidden = !sep/.test(sync),
       `${f}: ★「別途支給」のときだけ金額と支給単位を出す`, sync.slice(0, 80));
    ok(/for \(const id of MGMT_PAY_IDS\) \$\(id\)\.value = ''/.test(sync),
       `${f}: ★「含まれる」「なし」「わからない」に戻したら、隠した欄の中身も消す`);

    /* ⑤ 増やさないと決めたことを増やしていない（オーナー明記）。
       ★数量の欄も作らない ── ①の日数がそのまま数量。 */
    ok(!/f-mgmt-(rate|qty|title|headcount|hours|dept|ratio|per-day|unit)/.test(s),
       `${f}: ★単価・数量・役職分類・管理人数・会議時間・担当部署・業務の割合を聞いていない`);
    const inputs = [...blk.matchAll(/<(?:input|select|textarea)[^>]*id="([a-z0-9-]+)"/g)].map((m) => m[1]);
    ok(JSON.stringify(inputs) === JSON.stringify(
         ['f-mgmt-days', 'f-mgmt-extra', 'f-mgmt-pay', 'f-mgmt-method']),
       `${f}: ★管理職に聞くのは4欄だけ（日数・有無・金額・支給単位）`, inputs.join(','));

    /* ⑥ 管理職の額は専用の欄。教官・審査・組合・職位手当・変動給・その他へは足し込まない。 */
    ok(/management_pay:\s*val\('f-mgmt-pay'\)/.test(s),
       `${f}: ★管理職の額は専用の列へそのまま行く（management_pay）`);
    for (const [key, line] of [['command_pay', (s.match(/command_pay:[^\n]*/) || [''])[0]],
                               ['other_allowance', (s.match(/other_allowance:[^\n]*/) || [''])[0]],
                               ['flight_variable_pay', (s.match(/flight_variable_pay:[^\n]*/) || [''])[0]],
                               ['instructor_pay', (s.match(/instructor_pay:[^\n]*/) || [''])[0]],
                               ['examiner_pay', (s.match(/examiner_pay:[^\n]*/) || [''])[0]],
                               ['union_pay', (s.match(/union_pay:[^\n]*/) || [''])[0]]]) {
      ok(line.length > 10 && !/f-mgmt-pay/.test(line),
         `${f}: ★管理職の額を ${key} に足し込んでいない`, line.trim());
    }

    /* ⑦ ★★総支給との突き合わせ。ここが組合と逆になる。
       管理職の手当は会社が払う＝総支給の中にあるので、内訳の合計には無条件で足す。
       組合の unionInGross を写して条件を作ると、内訳の合計が実際より小さく出て
       「超えています」の注意が出るべきときに出なくなる。 */
    ok(!/function mgmtInGross/.test(s),
       `${f}: ★管理職に支給元の条件（mgmtInGross）を作っていない`);
    const md = (s.match(/function monthlyDetail\(\)[\s\S]*?\n}/) || [''])[0];
    ok(/\+ num\('f-mgmt-pay'\)/.test(md),
       `${f}: ★monthlyDetail に管理職の額を条件なしで足している`, md.slice(-160));
    ok(!/f-mgmt-pay[^\n]*\?/.test(md),
       `${f}: ★その足し算に条件が付いていない`, md.slice(-160));
    /* 総支給そのものは書き換えない（教官・審査・組合と同じ約束）。 */
    ok(!/\$\('f-gross'\)\.value\s*=/.test(s.replace(/put\('f-gross'[^\n]*/g, '')),
       `${f}: ★総支給の欄をこちらから書き換えていない`);

    /* ⑧ pay_items へ乗る形。管理職もオブジェクト1つ（配列ではない）。 */
    ok(/if \(mgt\) pi\.management = mgt;/.test(s),
       `${f}: ★管理職の中身は pay_items.management に乗る`);
    ok(/\bmgt\b/.test(emitCond(s)) && /\bnol\b/.test(emitCond(s)),
       `${f}: ★管理職だけ書いた人の pay_items が空にされない`, emitCond(s));
  }

  /* ⑦-g その他の兼務・配属（Other / Non-Line Assignment）の手当（2026-08-27 その7）──
     役割ごとのモジュールの5本目＝最後。上の4本と同じ壊れ方をするので、同じ形で見る。
     ★ここだけの本題は「具体名を1つも聞かない」── 部署名・出向先の会社名・
       プロジェクト名・仕事の中身・勤務割合・Office 勤務時間・配属期間・配属理由は
       聞かない（オーナー明記）。1つでも欄が生えると、勤務先が割れる道になる。
     ★支給単位も数量も無い（オーナーの仕様は金額だけ。教官・審査の形を写さない）。 */
  const NOL_AREA  = ['safety', 'standards', 'fleet', 'dept', 'secondment', 'other'];
  const NOL_EXTRA = ['separate', 'included', 'none', 'unknown'];
  for (const f of ['pay-report.html', 'en/pay-report.html']) {
    const s = read(f);
    const ja = f === 'pay-report.html';
    const blk = cut(s.slice(s.indexOf('<div id="s3-nonline"'),
                            s.indexOf(ja ? '<!-- 繰り返し行の型。' : '<!-- Row templates.')));
    ok(blk.length > 400, `${f}: その他の兼務・配属の手当のブロックが在る`, String(blk.length));

    /* ① 既定で隠れている・役職を触るたびに見直す・外したら中身も消す。 */
    ok(/<div id="s3-nonline" hidden>/.test(s),
       `${f}: ★兼務・配属のブロックは既定で隠れている（役職で出す）`);
    ok(/function readRoleBoxes\(\)[\s\S]{0,700}?nonlineToggle\(\)/.test(s),
       `${f}: ★役職・区分を触るたびに出し入れを見直す（readRoleBoxes → nonlineToggle）`);
    const tog = (s.match(/function nonlineToggle\(\)[\s\S]*?\n  }/) || [''])[0];
    ok(/indexOf\('nonline'\)/.test(tog) && /\$\(id\)\.value = ''/.test(tog)
       && /b\.checked = false/.test(tog),
       `${f}: ★兼務・配属を外したら、選んだ分野も日数も金額も消す`, tog.slice(0, 60));

    /* ② 必須をひとつも増やさない・「任意」と書かない・カッコの注記を足さない。 */
    ok(!/req-tag/.test(blk), `${f}: ★兼務・配属の節に「必須」の印が無い（段も送信の条件も動かない）`);
    ok(!/任意|書かなくて|なくても|optional|leave (this )?blank/i.test(blk),
       `${f}: ★兼務・配属の節に「任意・書かなくていい」の言い方が無い`);
    ok(!/<summary>[\s\S]*?[（(][^）)]*[）)][\s\S]*?<\/summary>/.test(blk),
       `${f}: ★兼務・配属の見出しにカッコの注記を足していない`);

    /* ③ 分野は6択・追加報酬は4択。日英でまったく同じ value・同じ並び。 */
    const areas = [...blk.matchAll(/name="f-nonline-area" value="([a-z_]*)"/g)].map((m) => m[1]);
    ok(JSON.stringify(areas) === JSON.stringify(NOL_AREA),
       `${f}: 担当している分野が6択で同じ並び`, areas.join(','));
    const optsIn = (id) => [...((blk.match(new RegExp(`<select id="${id}"[\\s\\S]*?</select>`)) || [''])[0])
      .matchAll(/<option value="([a-z_]*)"/g)].map((m) => m[1]).filter((v) => v !== '');
    ok(JSON.stringify(optsIn('f-nonline-extra')) === JSON.stringify(NOL_EXTRA),
       `${f}: 追加報酬が4択で同じ並び`, optsIn('f-nonline-extra').join(','));
    const b0 = ((blk.match(/<select id="f-nonline-extra"[\s\S]*?<option value=""[^>]*>([^<]*)</) || [])[1] || '').trim();
    ok(/^(選んでください|Choose one)$/.test(b0), `${f}: ★f-nonline-extra の先頭は「選んでください」`, b0);

    /* ④ 「含まれる」「なし」「わからない」ならすぐ終わる ── 金額の欄そのものを出さない。 */
    ok(/<div class="opt-fld" id="opt-nonline-pay" hidden>/.test(blk),
       `${f}: ★金額は既定で隠れている（「別途支給される」を選ぶまで出ない）`);
    const sync = (s.match(/function nonlineSync\(\)[\s\S]*?\n  }/) || [''])[0];
    ok(/=== 'separate'/.test(sync) && /opt-nonline-pay'\)\.hidden = !sep/.test(sync),
       `${f}: ★「別途支給される」のときだけ金額を出す`, sync.slice(0, 80));
    ok(/for \(const id of NONLINE_PAY_IDS\) \$\(id\)\.value = ''/.test(sync),
       `${f}: ★「含まれる」「なし」「わからない」に戻したら、隠した金額も消す`);

    /* ⑤ ★★具体名を1つも聞いていない（この節のいちばんの本題）。
       支給単位・数量・単価も作らない（オーナーの仕様は金額だけ）。 */
    ok(!/f-nonline-(dept|company|project|label|name|ratio|hours|term|reason|method|qty|rate|unit)/.test(s),
       `${f}: ★部署名・出向先・プロジェクト名・仕事の中身・勤務割合・支給単位・数量・単価を聞いていない`);
    const inputs = [...blk.matchAll(/<(?:input|select|textarea)[^>]*id="([a-z0-9-]+)"/g)].map((m) => m[1]);
    ok(JSON.stringify(inputs) === JSON.stringify(
         ['f-nonline-days', 'f-nonline-extra', 'f-nonline-pay']),
       `${f}: ★兼務・配属に聞くのは3欄だけ（日数・有無・金額）＋分野のチェック`, inputs.join(','));

    /* ⑥ 兼務・配属の額は専用の欄。ほかのどの手当へも足し込まない。 */
    ok(/nonline_pay:\s*val\('f-nonline-pay'\)/.test(s),
       `${f}: ★兼務・配属の額は専用の列へそのまま行く（nonline_pay）`);
    for (const [key, line] of [['command_pay', (s.match(/command_pay:[^\n]*/) || [''])[0]],
                               ['other_allowance', (s.match(/other_allowance:[^\n]*/) || [''])[0]],
                               ['flight_variable_pay', (s.match(/flight_variable_pay:[^\n]*/) || [''])[0]],
                               ['instructor_pay', (s.match(/instructor_pay:[^\n]*/) || [''])[0]],
                               ['examiner_pay', (s.match(/examiner_pay:[^\n]*/) || [''])[0]],
                               ['union_pay', (s.match(/union_pay:[^\n]*/) || [''])[0]],
                               ['management_pay', (s.match(/management_pay:[^\n]*/) || [''])[0]]]) {
      ok(line.length > 10 && !/f-nonline-pay/.test(line),
         `${f}: ★兼務・配属の額を ${key} に足し込んでいない`, line.trim());
    }

    /* ⑦ ★★総支給との突き合わせ。管理職と同じで「無条件に足す」。
       組合の unionInGross を写して条件を作ると、内訳の合計が実際より小さく出て
       「超えています」の注意が出るべきときに出なくなる。 */
    ok(!/function nonlineInGross/.test(s),
       `${f}: ★兼務・配属に支給元の条件（nonlineInGross）を作っていない`);
    const md = (s.match(/function monthlyDetail\(\)[\s\S]*?\n  }/) || [''])[0];
    ok(/\+ num\('f-nonline-pay'\)/.test(md),
       `${f}: ★monthlyDetail に兼務・配属の額を条件なしで足している`, md.slice(-160));
    ok(!/f-nonline-pay[^\n]*\?/.test(md),
       `${f}: ★その足し算に条件が付いていない`, md.slice(-160));

    /* ⑧ pay_items へ乗る形。兼務・配属もオブジェクト1つ（配列ではない）。 */
    ok(/if \(nol\) pi\.nonline = nol;/.test(s),
       `${f}: ★兼務・配属の中身は pay_items.nonline に乗る`);
  }

  /* ⑧ 必須の印（2026-08-13 その4）。★これがこのファイルで一番効く検査。
     画面に出す「必須」と、送信を止めるゲートは、必ず同じ欄でなければならない。
     ズレると ①必須と書いてあるのに空でも送れる ②印が無い欄で送信が黙って止まる
     のどちらかが起き、どちらも触っている本人には原因が見えない。
     ★f-year / f-month（対象月）は select で常に値が入るためゲートに書かれていないが、
       中身は必須。ここだけ「ゲートに現れなくてよい欄」として明示的に許す。 */
  const GATE_FREE = ['f-year', 'f-month'];
  /* ★f-stay（ステイ日数）は 2026-09-12 に 必須 → 任意 へ戻した（オーナー決定5）。
       毎月変わる実績で、明細に載らない会社もある。ここで止めると、
       **書ける人の内訳ごと提出が落ちる**。空欄は 0 ではなく「不明（null）」で保存する。
     ⚠️ 乗務日数（f-duty）は元から任意。2つを取り違えない。 */
  const REQ = ['f-airline', 'f-airline-other', 'f-position', 'f-fleet', 'f-jobrole', 'f-age', 'f-year',
               'f-block', 'f-currency', 'f-gross', 'f-netpay', 'f-bonus-mo',
               'f-perdiem', 'f-housing', 'f-housing-amt',
               'f-contract', 'f-taxcountry', 'f-seniority'];
  for (const f of ['pay-report.html', 'en/pay-report.html']) {
    const s = read(f);
    /* ラベル1枚ずつ取り出して、付いている札を見る。
       同じ欄に「必須」と「任意」が両方付くのは、直した側と直し忘れた側が並んだとき。 */
    const labs = [...s.matchAll(/<label class="form-label" for="([a-z0-9-]+)">((?:(?!<\/label>).)*)<\/label>/g)]
      .map((m) => ({ id: m[1], req: m[2].includes('req-tag'), opt: m[2].includes('opt-tag') }));
    for (const id of REQ) {
      const l = labs.find((x) => x.id === id);
      ok(l && l.req, `${f}: ${id} のラベルに「必須」が出ている`);
    }
    const marked = labs.filter((l) => l.req).map((l) => l.id);
    const over = marked.filter((id) => !REQ.includes(id));
    ok(over.length === 0, `${f}: ゲートに無い欄を必須と書いていない`, over.join(','));
    const both = labs.filter((l) => l.req && l.opt).map((l) => l.id);
    ok(both.length === 0, `${f}: 同じ欄に必須と任意が両方付いていない`, both.join(','));
    /* ★役職・区分は 2026-08-14 に必須へ。印・GATE_ROLE・送信バリデーションの3つが揃うこと
       （REQ に入れてあるので上の①②で見ているが、任意の札が残っていないかはここで見る）。 */
    const jr = labs.find((x) => x.id === 'f-jobrole');
    ok(jr && jr.req && !jr.opt, `${f}: f-jobrole に「必須」が出ている（任意の札は残っていない）`);
    /* ★レールと札の出どころを1つにする。JS が別の一覧を持つと、印とレールが別々にズレる。 */
    ok(/querySelectorAll\('label\.form-label:has\(\.req-tag\)'\)/.test(s),
       `${f}: 必須のレールは req-tag から引いている（別の一覧を持たない）`);
  }
  /* ゲートの側にも同じ欄が書かれているか。日本語版のソースを正とする（EN は同じ JS）。 */
  {
    const s = read('pay-report.html');
    const gates = [...s.matchAll(/const (?:GATE_[A-Z]+|payEntered|housingOk)\s*=[\s\S]*?;\n/g)]
      .map((m) => m[0]).join('\n');
    ok(gates.length > 200, 'ゲートの定義を取り出せている', String(gates.length));
    const missing = REQ.filter((id) => !GATE_FREE.includes(id) && !gates.includes(`'${id}'`));
    ok(missing.length === 0, '必須と書いた欄は全部ゲートが見ている', missing.join(','));
  }

  /* ⑧-b 常設の「匿名で提出」と、足りない必須項目の見せ方（2026-08-27 オーナー指示
       「3.報酬の画面を出したあたりから『匿名で提出』ボタンを常に下に表示させて。
         途中で押したらエラー画面で記入していない必須項目を箇条書きで出るようにして」
       ＋「『匿名で提出』とその上の『年換算の総額』も一緒に」）。
     ★同日その2、箇条書きは作り直した ──
       「やっぱり箇条書きを一旦やめよう。……そのまま必須項目の該当する欄まで飛んで、
         そこを赤く囲うとかはどう？該当する項目の右横に未入力とか書いて」。
     ★ここで見るのは「2つ目の必須一覧を JS に作っていない」こと。
       作った瞬間、画面の印（req-tag）と足りない欄の印が別々にズレて、
       どちらが正しいのか触っている本人には分からなくなる。 */
  for (const f of ['pay-report.html', 'en/pay-report.html']) {
    const s = read(f);
    ok(/<div id="sticky-submit" class="sticky-cta" hidden>/.test(s),
       `${f}: 常設バーは hidden で置いてある（§3 が出てから出す）`);
    /* ★2026-09-08、オーナーが 08-27 の指示を5ステップ化に合わせて更新した ──
         帯に**押す物を置かない**。押すのは各段末尾の Next と 5/5 の提出ボタンだけ。
         送信の入口が2つあると、途中の段から直接送れてしまう。 */
    ok(/id="sticky-total"/.test(s), `${f}: 帯に年換算の総額が出る`);
    ok(!/id="sticky-btn"/.test(s),
       `${f}: ★帯に押す物を置いていない（送信の入口は 5/5 の1つだけ）`);
    ok(/class="sticky-cta-sum pv-no-cur"/.test(s),
       `${f}: 常設バーの金額に pv-no-cur が付いている（currency.js に二度変換させない）`);
    /* ★長い説明はバーに載せない。#live-hint は #submit-block の中の1つだけ。 */
    ok((s.match(/id="live-hint"/g) || []).length === 1,
       `${f}: 年換算の長い説明は1か所だけ（バーは金額とボタンだけ）`);
    /* ★送信ボタンは #submit-btn の1つ。一覧の形は残してある ── 配る先が
         増えた日に、配り忘れた1つが送信中も押せてしまう事故をここで止める。 */
    ok(/const SUBMIT_BTNS = \(\) => \[[^\]]*\]\.map\(\$\)/.test(s),
       `${f}: 送信中の disabled と文言は一覧で配っている`);
    ok(!/addEventListener\('click', submitPayReport\)[\s\S]{0,40}sticky/.test(s)
       && !/sticky-btn'\)\.addEventListener/.test(s),
       `${f}: ★帯から submitPayReport() を呼ぶ経路が無い`);
    /* ★金額は recalc() が同じ文字列を2か所へ書くだけ。式（annualTotal）は1本のまま。 */
    ok((s.match(/annualTotal\(\)\s*;/g) || []).length >= 1
       && /\$\('sticky-total'\)\.innerHTML = totalHTML;/.test(s),
       `${f}: 常設バーの金額は #live-total と同じものを書き写している（式を2本にしない）`);
    ok(!/transition:\s*all/.test(s), `${f}: transition-all を使っていない`);

    /* ── 必須の出どころは req-tag ただ1か所 ─────────────────────── */
    const mr = (s.match(/function missingRequired\(\)[\s\S]*?\n\}/) || [''])[0];
    ok(mr.includes("querySelectorAll('.fld.is-req:not(.is-done)')"),
       `${f}: ★足りない必須は画面の印（.fld.is-req）から拾う（2つ目の一覧を JS に作らない）`,
       String(mr.length));
    ok(mr.includes('markRequired()') && mr.includes('offsetParent') && mr.includes('disabled'),
       `${f}: 隠れている欄・触れない欄は数えない`, String(mr.length));
    ok(!/\[\s*'f-[a-z-]+'\s*,\s*'f-[a-z-]+'[\s\S]{0,200}\]\s*;?\s*\/\/\s*必須/.test(mr),
       `${f}: missingRequired() が欄の名前を並べ持っていない`);
    /* ラベルは画面の <label> から取る＝日英で自動的に正しい。訳の表を持たない。 */
    const rl = (s.match(/const reqLabel = \(f\) => \{[\s\S]*?\n\};/) || [''])[0];
    ok(rl.includes('.form-label') && rl.includes('.req-tag') && rl.includes('.miss-tag'),
       `${f}: ラベルは画面の <label> から作る（訳の一覧を持たない・未入力の札も剥がす）`);
    /* ★止まっている段は開ける。でも #submit-block は開けない
       （全段そろったときだけ出す、という約束はそのまま）。 */
    const rs = (s.match(/function revealSteps\(\)[\s\S]*?\n\}/) || [''])[0];
    ok(rs.length > 20 && !rs.includes('submit-block'),
       `${f}: ★足りない欄を見せるために段は開くが、送信ボタンの枠は開けない`, String(rs.length));
    /* ★#err は #submit-block の外。中に置くと、出していないあいだ何を書いても見えない。 */
    ok(s.indexOf('<div id="err"') > 0 && s.indexOf('<div id="err"') < s.indexOf('id="submit-block"'),
       `${f}: エラーの置き場所は送信ボタンの枠の外（隠れている枠の中に書かない）`);

    /* ── ★2026-08-27（その2）箇条書きをやめ、その欄まで飛んで赤く囲う ──────
         静かに戻る類なので、字で見張る。 */
    ok(!/fa-list["'{]|fa-jump["'{:]/.test(s),
       `${f}: ★箇条書き（.fa-list / .fa-jump）が戻っていない`);
    ok(!/<ul/.test((s.match(/function markMissing\(list\)[\s\S]*?\n\}/) || [''])[0]),
       `${f}: ★足りない必須を <ul> で並べていない`);
    const mm = (s.match(/function markMissing\(list\)[\s\S]*?\n\}/) || [''])[0];
    ok(mm.includes("classList.add('is-miss')") && mm.includes("'miss-tag'"),
       `${f}: ★足りない欄すべてに赤い印（.is-miss）と「未入力」の札を付ける`, String(mm.length));
    ok(mm.includes('jumpTarget(list[0])') && mm.includes('scrollIntoView') && mm.includes('focus('),
       `${f}: ★飛ぶのは先頭ひとつ（その欄まで運んで focus する）`);
    /* ★役職・区分は値を hidden の #f-jobrole が持つ＝.form-input が無い。
         .rolebox を掴めないと、この欄だけ「押しても何も起きない」になる。 */
    const jt = (s.match(/const jumpTarget = [\s\S]*?;\n/) || [''])[0];
    ok(jt.includes('.rolebox input'),
       `${f}: ★役職・区分（hidden の #f-jobrole）にも飛べる`, String(jt.length));
    /* ★赤を落とすのは2か所だけ。埋めた瞬間に消えないと、直したのに赤いままになる。 */
    const mrq = (s.match(/function markRequired\(\)[\s\S]*?\n\}/) || [''])[0];
    ok(mrq.includes("remove('is-miss')") && mrq.includes('.miss-tag'),
       `${f}: ★埋まった欄からは赤も札もその場で落ちる`, String(mrq.length));
    /* ★2026-09-08、赤箱に「誰が書いたか」の印（dataset.from）が付いた。
         1画面1段になったので、埋め終わった段の下に赤が残ると押せないように見える。
         markRequired() が自分で落とすが、落とすのは markMissing() が書いたものだけ
         ── ほかのエラー（額面と時間の食い違い）は「空かどうか」では消せない。 */
    const ce = (s.match(/function clearErr\(\)[^\n]*/) || [''])[0];
    ok(ce.includes("innerHTML = ''") && ce.includes('clearMissMarks()') && ce.includes('dataset.from'),
       `${f}: ★エラーを消したら赤も札も印も全部落ちる`, ce);
    ok(mrq.includes("dataset.from === 'miss'") && mrq.includes(".fld.is-miss"),
       `${f}: ★必須が全部埋まったら「未入力があります」の赤箱も自分で消える`);
    /* ★札の文字は日英でそれぞれ1つ。訳の表を JS に持たない。 */
    const tag = (s.match(/const MISS_TAG = '([^']+)'/) || [])[1] || '';
    ok(tag === (f.startsWith('en/') ? 'Missing' : '未入力'),
       `${f}: ★未入力の札の文字（${tag}）`);
    /* ★札は既存の丸ピル3兄弟に相乗り（4つ目の見た目を発明しない）。 */
    ok(/\.opt-tag,\.req-tag,\.auto-tag,\.miss-tag\{/.test(s),
       `${f}: 未入力の札は既存のピルと同じ形`);
    ok(/\.fld\.is-miss \.form-input\{[^}]*border-color/.test(s)
       && /\.fld\.is-miss \.roleboxes\{/.test(s)
       && /\[data-theme="light"\] \.fld\.is-miss \.form-input\{/.test(s),
       `${f}: ★赤い枠は明・暗の両方にあり、役職・区分にも効く`);

    /* ── ★「＋…を追加」の6つを目立たせる（2026-08-27 オーナー指示
         「DEEP PAYを見るには必須だから」）。6つとも .pay-detail>summary の1か所で決まる。 */
    ok((s.match(/<details class="pay-detail"/g) || []).length === 6,
       `${f}: 「＋…を追加」は6つ（内訳＋役割5つ）`);
    const sum = (s.match(/\.pay-detail>summary\{[^}]*\}/) || [''])[0];
    ok(sum.includes('solid') && !sum.includes('dashed'),
       `${f}: ★閉じているときの「＋…を追加」が破線の弱い見た目に戻っていない`, sum.slice(0, 90));
    ok(sum.includes('#f5c842') && sum.includes('max-width:100%'),
       `${f}: ★ブランド金で、狭い画面でもはみ出さない`);
    /* ★ここに説明文を足さない。DEEP PAY のページはまだ無く「準備中」なので、
         「詳しく出すと開きます」と書くと嘘になる。 */
    const sums = [...s.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>/g)]
      .map((m) => m[1]).filter((t) => t.includes('class="p"'));
    const sumTxt = sums.map((t) => t.replace(/<[^>]+>/g, '').replace(/[+＋]/g, '').trim());
    ok(sums.length === 6 && sumTxt.every((t) => t.length < 60 && !/[。]|\.\s|DEEP PAY/i.test(t)),
       `${f}: ★「＋…を追加」はボタンの名前だけ（説明文も DEEP PAY の約束も足さない）`,
       sumTxt.join(' / '));

    /* ── ★項目名（.form-label）が読める強さであること（2026-08-27 オーナー指摘
         「『対象月』『勤務時間（Duty time）』…が灰色の薄い文字で見えにくい」）。
         小さい・薄い・全部大文字の3つが重なっていた。静かに戻る類なので字で見張る。 */
    const lab = (s.match(/\n\.form-label\{[^}]*\}/) || [''])[0];
    ok(!lab.includes('text-transform:uppercase'),
       `${f}: ★項目名を全部大文字に戻していない（英語が読みにくくなる）`, lab.slice(0, 90));
    ok(!lab.includes('#9ca3af') && /font-size:\.8[3-9]rem/.test(lab),
       `${f}: ★項目名は薄い灰色でも .78rem でもない`, lab.slice(0, 90));
    ok(/\[data-theme="light"\] \.form-label\{/.test(s),
       `${f}: ★ライトにも項目名の色がある（白いカードに暗い地むけの灰色を乗せない）`);
  }

  /* ⑨ 2026-08-13（その4）オーナー指摘で消したもの。戻すと画面がまた重くなる。 */
  for (const f of ['pay-report.html', 'en/pay-report.html']) {
    const s = read(f);
    ok(!s.includes('class="crew-note"'), `${f}: 黄色い注意書きの枠を出していない`);
    ok(!s.includes('class="ps-priv"'), `${f}: 明細画面の長い注意書きを出していない`);
    ok(!/<span class="ps-tag">/.test(s), `${f}: 明細の側に所要時間を書いていない`);
    ok(/<span class="entry-tag">/.test(s), `${f}: 手で入力の側には所要時間が残っている`);
    ok(/id="pay-count"/.test(s), `${f}: 見出しの下の1行は #pay-count の1箇所だけ`);
    /* ★ここに数字を書かない（2026-08-23）。2026-08-23 まで
         「1000件以上の給与情報が提出されました！」と出ていたが、実際の給与レポートは
         2桁に届いていない。一次データを出してもらうための画面で数を盛るのは、
         VISION の「数字を盛らない」と正面からぶつかる。実数を出しても会員数が
         外から分かるだけなので、数そのものを置かず Give & Get を書く。 */
    const pill = (s.match(/<p class="pay-count"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '';
    /* 通すのは「1件共有すると」の 1 だけ。これは相手にお願いする数で、
       たまっている数の主張ではない。それ以外の数字は1つも通さない。 */
    const counted = (pill.match(/[0-9０-９][0-9０-９,，]*/g) || []).filter((n) => n !== '1');
    ok(counted.length === 0, `${f}: 見出しの下の1行に投稿数を書かない`, counted.join(' / ') || pill.trim());
    ok(!/(以上|提出されました|\bover\b|submitted)/i.test(pill),
      `${f}: 「◯件以上が提出されました」の類を書かない`, pill.trim());
    ok(/(見られます|you can see)/.test(pill), `${f}: 1件出すと読めること（Give & Get）を書いている`, pill.trim());
    /* 「検証済み」は書けない（pay_reports.verify_level に書き込む処理がまだ無い）。 */
    ok(!/(検証済み|Verified)</.test(s), `${f}: カードに「検証済み」と書いていない`);
    /* 匿名の約束は消したのではなく2択のカードへ移した。両方のカードに1行ずつある。 */
    const cards = s.split('id="entry-payslip"')[1] || '';
    ok((cards.match(/class="entry-b"/g) || []).length >= 4,
       `${f}: 匿名の1行が明細側・手入力側の両方に出ている`);
  }

  /* ⑩ メールの同意（2026-08-14）。この箱は signup.html を通らないので、
     ここで聞かないと会員になった人へメールを1通も出せない（実際、2026-08-11 の
     時点で月次リマインドの宛先は27人中0人だった）。4つが揃って初めて成立する。 */
  {
    const s = read('pay-login.js');
    ok(/id="pl-optin"[^>]*checked/.test(s), 'pay-login.js: 会員登録の側に同意のチェックがある');
    ok(/optin:\s*'[^']*リマインド/.test(s) && /optin:\s*'[^']*reminder/.test(s),
       'pay-login.js: 同意の文言が日英とも入っている');
    /* 「はじめての方」の側からだけ預ける。ログインの側から預けると、
       既に決めてある人の設定を、レポートを見に来ただけの操作で書き換える。 */
    const stashes = (s.match(/stashOptIn\(\)/g) || []).length;
    ok(stashes === 3, 'pay-login.js: 同意を預けるのは会員登録の2経路だけ（定義1＋呼び出し2）', String(stashes));
    ok(!/'pl-g-in'\), function \(\) \{ stashOptIn/.test(s) && !/pl-in-btn[\s\S]{0,200}stashOptIn/.test(s),
       'pay-login.js: ログインの側からは預けない');
    /* 列を直接書かない。親（メール全般）と同意日時までサーバ側で揃えるため。 */
    ok(/rpc\('set_mail_optin'/.test(s), 'pay-login.js: 同意は set_mail_optin を通す');
    ok(!/from\('profiles'\)[\s\S]{0,80}update/.test(s), 'pay-login.js: profiles の列を直接書いていない');
    /* 一度解除した人を送信に戻さない。 */
    ok(/email_opt_in_at[\s\S]{0,120}return/.test(s), 'pay-login.js: 解除済みの人には触らない');
  }
  for (const f of ['pay-report.html', 'en/pay-report.html']) {
    const s = read(f);
    /* 呼ぶのは「明細が保存できた」あと1箇所だけ。認証の直後に書くと、
       ページを離れる経路（Google・メール内リンク）が抜ける。
       ★2026-08-18：入口が「先に預かる → あとで登録」に変わり、保存が通ったあとの
         後始末が afterSaved() 1つにまとまった。直接送信も、預かりぶんの紐付けも、
         必ずここを通る。以前は「savePreset() から何文字以内か」で場所を測っていたが、
         それは行が動いただけで落ちる。★中身（保存が通った経路だけを通る所にあるか）
         で見る。 */
    ok((s.match(/claimOptIn\(_sb\)/g) || []).length === 1, `${f}: claimOptIn を呼ぶのは1箇所`);
    const body = (s.split('function afterSaved(')[1] || '');
    const inside = body.slice(0, body.indexOf('\n}'));
    ok(inside.includes('claimOptIn(_sb)'),
       `${f}: 呼ぶのは保存が通ったあとの後始末（afterSaved）の中`);
    /* 定義1 + 呼び出し3（直接送信・戻ってきた人・登録直後の紐付け）。
       増えたら「保存できていないのに印だけ立つ」経路が生えていないか確かめる。 */
    const calls = (s.match(/afterSaved\(/g) || []).length;
    ok(calls === 4, `${f}: afterSaved を呼ぶのは保存が通った経路だけ（定義1＋呼び出し3）`, `実際 ${calls}`);
  }
}

// ── PGlite に本番と同じ器を組む（test-pay-reports.mjs と同じ）──────
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
  /* ★口コミの表。中身は使わないが db/pay-rows.sql が参照しているので器だけ要る
     （db/test-pay-rows.mjs と同じ最小の形）。 */
  create table public.reviews_v2 (
    id         uuid primary key default gen_random_uuid(),
    proof_hash text not null,
    airline    text not null,
    "position" text,
    annual_salary            integer,
    base_annual              integer,
    flight_allowance_annual  integer,
    monthly_salary           integer,
    bonus                    integer,
    created_at timestamptz not null default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;
`);
/* ★pay-report-pending.sql も入れる（2026-08-18）。ログイン前の預かりは本番の作りでは
   別テーブル＋別関数なので、これを入れないと「先に預かる」経路を本物で流せない。
   pay-reports.sql のあとに流すこと（中で submit_pay_report を呼んでいる）。 */
/* ★pay-rows.sql も入れる（2026-09-11）。明細1枚が REAL PAY の一覧に出るところまで
   1本で通すため（下の「明細1枚が REAL PAY に出るまで」）。pay-reports.sql の
   あとに流すこと。 */
for (const f of ['db/airlines.generated.sql', 'db/vocab.generated.sql',
                 'db/pay-reports.sql', 'db/pay-report-pending.sql',
                 'db/pay-rows.sql']) {
  await db.exec(read(f));
}

const UID = '00000000-0000-4000-8000-0000000000c1';
await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`, [UID, 'contract@example.com']);
await db.query(`select set_config('pv.uid', $1, false)`, [UID]);

/* 湾岸＝最初の主戦場を想定。job_role は語彙が line/instructor/examiner/management
   なので 'line'（shot-pay.mjs の 'tri' は選択肢に無く、無視されていた）。 */
const SAMPLE = {
  'f-airline': 'emirates', 'f-position': 'cap', 'f-fleet': 'b777', 'f-jobrole': 'line',
  'f-age': '40-49',
  /* ★f-paytype（払われ方）は 2026-08-12 に欄ごと廃止。ここに戻すと setF() が
     「要素が無い」で落ちる＝復活に気づける。
     ★f-base 以下の内訳は <details id="pay-detail"> の中にある。開いてから入れる
       （閉じたまま入れると updatePayMode() が「見えていない欄は消す」で捨てる）。
     ★f-hourly は type="hidden" になった。人には聞かないが、明細から単価が読めた
       ときの経路（列・RPC・年換算の式）が生きていることをここで縛る。 */
  'f-currency': 'AED', 'f-base': '48500', 'f-block': '86.5', 'f-hourly': '210',
  'f-guar': '80', 'f-perdiem': '6200', 'f-housing': 'allowance', 'f-housing-amt': '17500',
  /* 国籍は 2026-08-12 に聞くのをやめた（居住国だけ）。f-nationality をここに
     戻すと setF() が「要素が無い」で落ちる＝復活に気づける。 */
  'f-contract': 'direct', 'f-seniority': '12', 'f-taxcountry': 'AE',
  'f-tax': '0', 'f-command': '3200', 'f-transport': '1500', 'f-other': '900',
  'f-bonus': '52000', 'f-profit': '18000', 'f-pension': '12',
  'f-duty': '17', 'f-base-iata': 'DXB',
  /* 2026-08-13 に増えた欄。ステイ日数・手取り・今月出たボーナスは必須、
     勤務時間（Duty time）は任意。★その月にしか無い値なので、翌月のプリセットには
     持ち越さない（下の「2回目の訪問」でそこを確かめる）。 */
  'f-stay': '12', 'f-netpay': '41200', 'f-bonus-mo': '0', 'f-duty-h': '158.2',
};
/* 必須だけを埋めて「送信に手が届く」まで行く最小の一式。
   ★SAMPLE と分けてある。あちらは内訳・役割まで入る「全部入り」で、
   こちらは**必須の白線**そのもの（GATE_ROLE / GATE_HOURS / GATE_PAY / GATE_CONTRACT）。
   必須が1つ増えたらここが落ちる＝増えたことに気づける。 */
const FALLBACK_FILL = {
  'f-airline': 'emirates', 'f-position': 'cap', 'f-fleet': 'b777', 'f-age': '40-49',
  'f-block': '86.5', 'f-stay': '12',
  'f-currency': 'AED', 'f-gross': '54250', 'f-netpay': '41200',
  'f-bonus-mo': '0', 'f-perdiem': '6200',
  'f-housing': 'allowance', 'f-housing-amt': '17500',
  'f-contract': 'direct', 'f-taxcountry': 'AE', 'f-seniority': '12',
};

/* かんたん入力（内訳を開かない人）が入れる1本。★SAMPLE の内訳とは排他。 */
const GROSS_M = '54250';
const NET_M = '41200';

/* headless:'new' はこの環境で Runtime.callFunctionOn / Page.captureScreenshot が
   返らなくなる（Chrome 側の問題。args を振っても直らない）。検査内容は変えず、
   chrome-headless-shell で回す。 */
const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });

/* ★2026-09-02: 英語のアプリ画面（/en/pay-report.html など）を一度でも開くと
   pv-lang='en' が端末に残り、次に日本語の URL を開いても /en/ へ飛ばされる
   （lang-toggle.js の STICKY_EN。英語を選んだ人を英語のままにするための仕様）。
   ここは「そのページの言語で保存されるか」を測る検査なので、
   どのページも毎回まっさらな言語設定から始める。
   ★消すのは document ができる前（evaluateOnNewDocument）。
     goto の後に消しても、その時にはもう飛ばされている。 */
/* ★2026-09-07: 給与フォームの書きかけ（pv_pay_last）も、ページを開く前に消す。
     この日オーナー指示で左のナビを置いたので、pay-report.html が
     pagehide / visibilitychange のたびに savePreset() を呼ぶようになった
     ＝ **この検査の中で、前のページが次のページへ下書きを残すようになった**。
     製品としては正しい（書きかけを失わないための対）が、検査は
     「開いた直後は空」を前提に 100 項目以上を数えている。
     実際に ja の1件と en の15件が落ちた（会社も年代も入った状態で開くので
     §2 が最初から出る／額面に前回の額が乗って年換算が合わない）。
   ★消すのは document ができる前（evaluateOnNewDocument）。goto の後に
     消しても、その時にはもう loadPreset() が戻し終えている。
   ★ただし **そのページの最初の1回だけ**。2回目以降の訪問（reload）で
     前回の内容が戻ることを見ている節が下に在り、そこまで消すと
     「復元したことを知らせている」が落ちる。sessionStorage は reload を
     またいで残るので、それを目印にする。 */
async function newPage() {
  const p = await browser.newPage();
  await p.evaluateOnNewDocument(() => {
    try { localStorage.removeItem('pv-lang'); } catch (e) {}
    try {
      if (!sessionStorage.getItem('pv-test-fresh')) {
        sessionStorage.setItem('pv-test-fresh', '1');
        localStorage.removeItem('pv_pay_last');
      }
    } catch (e) {}
  });
  return p;
}

/* ══ #pay-detail で来たら「くわしく入れる」が開く（2026-08-25）════════
   DEEP PAY の説明にある「給与内訳を追加する」（pv-gates.js の DETAIL_URL）の行き先。
   ★リンクを張るだけでは効かない。この画面は入口の2択が先に出ていて、
     内訳の欄はまだ DOM に在っても画面に出ていない（form-body が hidden）。
     2026-08-25 まで、踏んでも入口の画面のまま何も起きなかった。
   ★着いた瞬間に内訳の欄へカーソルが入ることは無い。段階表示（updateSteps）が
     §1 会社・§2 乗務時間を埋めるまで §3 を出さず、飛んだ時間は前回の値を
     持ち越さない（毎月変わるので保存していない）＝誰が来ても必ず §1 から。
     だからここで見るのは2つ:
       ① 着いた時点で「くわしく入れる」が先に開いていること（＋フォームの先頭に居ること）
       ② §1・§2 を埋めて §3 が出てきたとき、もう開いた状態で現れること
     ①だけだと「開いた気になっているが、出てきたら畳まれている」形を見逃す。
   ★入力モードの切り替え（総支給が内訳の合計になる）も見る。
     ここを写して書くと2つ目の実装になるので、写さず本物の toggle に任せている。 */
console.log('\n内訳への導線（#pay-detail）');
for (const [lang, url] of [['ja', 'http://localhost:3000/pay-report.html#pay-detail'],
                           ['en', 'http://localhost:3000/en/pay-report.html#pay-detail']]) {
  const page = await newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 900));

  const shot = () => page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    const box = (e) => (e ? e.getBoundingClientRect() : { width: 0, height: 0 });
    return {
      open: !!($('pay-detail') || {}).open,
      entryHidden: !!($('entry') || {}).hidden,
      formShown: box($('form-body')).height > 0,
      airlineShown: box($('f-airline')).height > 0,
      atTop: document.activeElement === $('f-airline'),
      /* ★「フォームの先頭」は会社の欄とは限らない（2026-09-12）。前回の内容が
         サーバから届いた人は「1. 会社と職務」が要約1行に畳まれているので、
         先頭は対象月になる。#f-airline を決め打ちすると、畳まれた回だけ
         嘘の赤が出る（本番は正しく動いているのに）。 */
      atHead: (() => {
        const host = $('form-body');
        if (!host) return false;
        const h = Array.prototype.find.call(
          host.querySelectorAll('input:not([type=hidden]), select, textarea'),
          (e) => !e.disabled && e.offsetParent !== null);
        return !!h && document.activeElement === h;
      })(),
      act: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : '',
      baseShown: box($('f-base')).height > 0,
      grossReadOnly: !!($('f-gross') || {}).readOnly,
      scrollY: Math.round(window.scrollY),
      detailTop: Math.round(box($('pay-detail')).top),
      s3Top: Math.round(box($('s3')).top),
      /* 進捗バーは画面の上に貼り付く。段の頭はその下に来るのが正しい。 */
      barBottom: Math.round(box($('wz-top')).bottom || 0),
      /* 落ちたときに「なぜ先頭が無いのか」が分かるように、段の状態も一緒に出す。 */
      cur: (window.PVPayWizard && window.PVPayWizard.current) ? window.PVPayWizard.current() : '',
      s1Hidden: !!($('s1') || {}).hidden,
      s1BodyHidden: !!($('s1-body') || {}).hidden,
      entryOff: !!(($('entry') || {}).offsetParent)
    };
  });

  const v = await shot();
  ok(v.open, `${lang}: ★#pay-detail で来たら「くわしく入れる」が開いている`, JSON.stringify(v));
  ok(v.entryHidden && v.formShown,
     `${lang}: ★入口の2択を越えて、入力の画面まで進んでいる`, JSON.stringify(v));
  ok(v.atHead,
     `${lang}: ★カーソルがフォームの先頭の欄に入っている（内訳はまだ出ていない）`, JSON.stringify(v));
  /* ★いま出ている段が要約1行に畳まれていない（2026-09-12）。
       前回の内容がある人は「1. 会社と職務」が畳まれるが、その段が
       **いま入力を求めている段**なら畳んではいけない。畳むと画面は
       要約1行と「次へ」だけになり、入れる物が1つも無い
       ── 本人には「押したのに何も始まらない」としか映らない。
     ⚠️ 実際に起きた形：loadPreset() は WZ.init() より前に走るので、
        そのとき「いま居る段」はまだ決まっていない（current() が null）。 */
  ok(!(v.cur === 's1' && v.s1BodyHidden),
     `${lang}: ★★いま入力を求めている段を要約1行に畳まない（空の画面を作らない）`, JSON.stringify(v));
  /* ★2026-08-26、総支給と内訳は排他ではなくなった（オーナー指示
       「入力した総支給額を給与内訳の合計で上書きしない」）。内訳を開いても
       総支給の欄は本人の入力のままで、読み取り専用にしない。
       ここが true に戻ったら、内訳を開いた人の総支給が合計で塗り潰されている。 */
  ok(!v.grossReadOnly,
     `${lang}: ★内訳を開いても総支給は本人の入力のまま（合計で上書きしない）`, JSON.stringify(v));

  /* §1・§2 を埋めて §3 を出す。ゲートは pay-report.html の GATE_ROLE / GATE_HOURS。 */
  await page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    const fire = (el) => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    for (const id of ['f-airline', 'f-position', 'f-fleet', 'f-jobrole', 'f-age']) {
      const el = $(id);
      if (!el) continue;
      if (el.tagName === 'SELECT') {
        const pick = [...el.options].find((o) => o.value && o.value !== 'other');
        if (pick) el.value = pick.value;
      } else el.value = '1';
      fire(el);
    }
    for (const id of ['f-block', 'f-stay']) { const el = $(id); if (el) { el.value = '80'; fire(el); } }
  });
  await new Promise((r) => setTimeout(r, 300));

  /* ★2026-09-08、5ステップになった。埋めただけでは §3 は出ない ── 出るのは
     本人が「次へ」を押したとき。ここで PVPayWizard.go() を呼ばずに**画面の
     ボタンを押す**のは、押せる物が本当にそこに在ることまで一緒に見るため。 */
  const next = async () => {
    const hit = await page.evaluate(() => {
      const cur = ['s1', 's2', 's3', 's4', 's5'].map((i) => document.getElementById(i))
        .find((e) => e && !e.hidden);
      const b = cur && cur.querySelector('.wz-next');
      if (!b) return false;
      b.click();
      return true;
    });
    if (!hit) return false;
    await new Promise((r) => setTimeout(r, 350));
    return true;
  };
  await next();          // 1/5 → 2/5
  await next();          // 2/5 → 3/5

  const w = await shot();
  ok(w.baseShown, `${lang}: ★「次へ」で §3 まで来た（内訳の欄が画面に在る）`, JSON.stringify(w));
  ok(w.open, `${lang}: ★出てきたときには、もう開いている（畳まれた状態で現れない）`, JSON.stringify(w));

  /* ③ 2026-09-03 オーナー指摘「押すとちゃんと給与の内訳入力まで飛ぶようになってる？」。
     §1・§2 を埋め終わった時点では、§3 は画面のずっと下にある。ここで寄せないと
     「内訳を入力する」を押して来た人が、自分で探すことになる。
     ★寄せ先は §3「3. 報酬」の**頭**（同日その5・オーナー指摘
       「いきなり給与の内訳を追加まで飛んでしまう。スライドするなら『3. 報酬』じゃない？」）。
     ⚠️ 内訳（#pay-detail）の頭に寄せてはいけない。同じ節の上半分 ── 通貨・
        その月の総支給額 ── を飛び越える。年収は総支給から出すので、そこを
        見ないまま内訳だけ埋めた人は年収が1円も出ない。
     ⚠️ 時間で待たない（混んだ回に嘘の赤が出る）。位置が落ち着くまで待つ。 */
  /* ⚠️ この画面は scroll-behavior:smooth。動いている途中の位置を読むと嘘の値になる
       （2026-08-28 に assert-referral.mjs で実際に踏んだ形）。止まるまで待つ。 */
  const settle = async () => {
    await page.waitForFunction(() => {
      const y = Math.round(window.scrollY);
      const s = (window.__sy && window.__sy.v === y) ? window.__sy : { v: y, n: 0 };
      s.n++; window.__sy = s;
      return s.n > 10;
    }, { timeout: 8000, polling: 'raf' }).catch(() => {});
    await page.evaluate(() => { window.__sy = null; });
  };
  await page.waitForFunction(() => {
    const r = document.getElementById('s3').getBoundingClientRect();
    return r.top > -80 && r.top < 140;
  }, { timeout: 8000, polling: 'raf' }).catch(() => {});
  await settle();
  const z = await shot();
  /* ★5ステップでは §3 が画面のいちばん上の段になる（1画面1段）。スクロール量そのものは
     もう見ない ── 見るのは「3. 報酬」の頭が、貼り付く進捗バーの**下に出ていて**、
     しかも画面の中に収まっていること。数字を決め打ちにせず、バーの下端から出す
     （バーの高さを変えたときに、この検査だけが嘘になるのを防ぐ）。 */
  ok(z.s3Top >= z.barBottom - 8 && z.s3Top < 420,
     `${lang}: ★「3. 報酬」の頭が画面に入っている（自分で探させない）`, JSON.stringify(z));
  /* ⚠️ ここは変えない。内訳（#pay-detail）の頭に寄せると、同じ節の上半分
        ── 通貨・その月の総支給額 ── を飛び越える。年収は総支給から出すので、
        そこを見ないまま内訳だけ埋めた人は年収が1円も出ない。 */
  ok(z.detailTop > z.s3Top + 100,
     `${lang}: ★内訳を通り越していない（通貨・総支給が頭の上に残っている）`, JSON.stringify(z));

  /* ★旗は1回で消える。消えないと、そのあと欄を触るたびに画面が飛ぶ。 */
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await settle();
  await page.evaluate(() => {
    const el = document.getElementById('f-block');
    el.value = '81';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle();
  const y = await shot();
  ok(y.scrollY < 40, `${lang}: ★そのあと欄を触っても勝手に飛ばない（旗は使い切り）`,
     JSON.stringify(y));

  ok(errs.length === 0, `${lang}: ページのエラーが1件も出ない`, errs.join(' | '));
  await page.close();
}

for (const [lang, url] of [['ja', 'http://localhost:3000/pay-report.html'],
                           ['en', 'http://localhost:3000/en/pay-report.html']]) {
  console.log(`\n▼ ${lang}  ${url}`);
  const page = await newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  page.on('pageerror', (e) => { fail++; console.log(`  ❌ ページ例外: ${e.message}`); });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  /* ja と en は同一オリジン。前の言語が savePreset() した内容を持ち越すと
     「初回訪問の画面」を測れない（復元済みなら全部開いているのが正しい）。 */
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 800));

  /* ページが送る payload を受けて、本物の RPC に流して返す。
     ★2026-08-18：入口が2つになった（ログイン前は預かり＝submit_pay_report_pending、
       ログイン後に本棚入れ＝submit_pay_report）。どちらの口を叩いたかで分けて数える。
       混ぜて数えると「ログイン前に本棚へ入れてしまった」という一番まずい壊れ方が
       そのまま隠れる。 */
  const seen = [];    // 本棚入れ（submit_pay_report）に渡った payload
  const stash = [];   // ログイン前の預かり（submit_pay_report_pending）に渡った payload
  const other = [];   // それ以外に呼ばれた RPC の名前
  const got = [];
  await page.exposeFunction('__pvRpc', async (fn, args) => {
    const p = (args || {}).p;
    const run = async (sql, param) => {
      try {
        const r = await db.query(sql, [param]);
        return { data: r.rows[0].r, error: null };
      } catch (e) {
        return { data: null, error: { message: String(e.message || e) } };
      }
    };
    if (fn === 'submit_pay_report_pending') {
      stash.push(p);
      return run(`select submit_pay_report_pending($1::jsonb) r`, JSON.stringify(p));
    }
    if (fn === 'claim_pending_report') {
      return run(`select claim_pending_report($1::text) r`, (args || {}).p_token);
    }
    if (fn === 'submit_pay_report') {
      seen.push(p);
      try {
        const r = await db.query(`select submit_pay_report($1::jsonb) r`, [JSON.stringify(p)]);
        got.push(r.rows[0].r);
        return { data: r.rows[0].r, error: null };
      } catch (e) {
        got.push({ _error: String(e.message || e) });
        return { data: null, error: { message: String(e.message || e) } };
      }
    }
    if (READ_OK.indexOf(fn) < 0) other.push(fn);
    return { data: { ok: true }, error: null };
  });

  /* rpc だけ差し替える。★ログインゲートは剥がさない ―
     「送信のときに初めてログインを求める」こと自体が今回の検査対象。
     ★関数名も渡す。名前を捨てると、預かりの返事（預かり証）を本棚入れの返事で
       代用してしまい、ページが「預かり証が返らない」で落ちる経路を検査できない。 */
  await page.evaluate(() => {
    if (typeof _sb === 'undefined') throw new Error('_sb が見えない（script の書き方が変わった）');
    _sb.rpc = (fn, args) => window.__pvRpc(fn, args || {});
  });

  /* 選択肢に無い値を黙って捨てさせない（捨てられると必須が抜けたまま送る）
     ★金額の欄は input のたびに桁区切りが付く（2026-08-13）。入れた '54250' は
       画面では '54,250' になるので、照合するときはカンマを落とす。 */
  const setF = (o) => page.evaluate((obj) => {
    const out = [];
    for (const [id, v] of Object.entries(obj)) {
      const el = document.getElementById(id);
      if (!el) { out.push(`${id}: 要素が無い`); continue; }
      el.value = v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      if (el.value.replace(/,/g, '') !== String(v)) out.push(`${id}: '${v}' は選択肢に無い`);
    }
    return out;
  }, o);
  const vis = (id) => page.$eval('#' + id, (el) => el.offsetParent !== null);
  /* ★<details> を閉じても、中の欄の offsetParent は null にならない
     （Chrome の ::details-content は content-visibility:hidden ＝ レイアウトを残す）。
     畳んだ中身が見えているかは checkVisibility() で測る。 */
  const visFold = (id) => page.$eval('#' + id, (el) => el.checkVisibility());
  /* ★常設バー（#sticky-submit）は position:fixed ＝ offsetParent が常に null なので
     vis() では測れない。出す・出さないは hidden ただ1つで決めている。 */
  const stickyOn = () => page.$eval('#sticky-submit', (el) => !el.hidden);
  const pick = (...ids) => Object.fromEntries(ids.map((k) => [k, SAMPLE[k]]));
  /* ★金額の欄は画面では '54,250' と桁区切りで出ている（2026-08-13）。
     入れた値と突き合わせるのが目的なので、読むときにカンマを落とす。
     区切りそのものを見たいときだけ fvRaw（画面に出ている文字列そのまま）。 */
  const fv = (id) => page.$eval('#' + id, (el) => el.value.replace(/,/g, ''));
  const fvRaw = (id) => page.$eval('#' + id, (el) => el.value);

  /* ── 入口の2択（2026-08-13 オーナー指摘＝明細からの自動入力が埋もれている）──
     いちばん最初に出すのは「明細から自動入力／手で入力」の2枚だけ。
     どちらかを選ぶまでフォーム本体は出さない。 */
  ok(await vis('entry'), '★いちばん最初に出るのは入口の2択');
  ok(!(await vis('s1')), '★どちらかを選ぶまでフォームは出さない');
  ok(!(await vis('ps')), '明細の読み込み画面も、選ぶまでは出さない');

  await page.click('#entry-payslip');
  await new Promise((r) => setTimeout(r, 150));
  ok((await vis('ps')) && !(await vis('entry')),
     '「明細から自動入力」を押すと読み込み画面に入る（ステップ 1/2）');
  ok(!(await vis('s1')), '★明細を読んでいるあいだはフォームを出さない');
  ok(await vis('ps-skip'),
     '★「読まずに手で入力する」の逃げ道が常にある（読めない明細で行き止まりにしない）');

  await page.click('#ps-skip');
  await new Promise((r) => setTimeout(r, 150));
  ok(await page.$eval('#ps', (el) => el.classList.contains('is-slim')),
     '手で入力に切り替えても、明細の入口は細い帯で残る');
  /* ★2026-09-12、オーナー決定5で value="0" の直書きを外した。
     初期値の 0 は**本人の回答ではない**（未回答の 0）。0 ＝ 回答済み・空欄 ＝ 未回答、
     という決定1の土台をここで崩さないために、欄は空で始めて案内で 0 と言う。 */
  ok((await page.$eval('#f-bonus-mo', (el) => el.value)) === '',
     '★今月の賞与・ボーナスは空で始まる（未回答の 0 を初期値に置かない）',
     await page.$eval('#f-bonus-mo', (el) => el.value));
  ok(/0/.test(await page.$eval('#f-bonus-mo', (el) => el.placeholder || '')),
     '★代わりに「出なかった月は 0」と案内する',
     await page.$eval('#f-bonus-mo', (el) => el.placeholder || ''));

  /* ── 5ステップ（2026-09-08）────────────────────────────────────
     ★オーナー指示で「埋めた分だけ下に生える」をやめ、1画面1段にした。
       ＝「一度出たものは隠れない」はもう成り立たない（次の段へ移ると前の段は下りる）。
       代わりにここで見るのは3つ：
         ① 埋まっていない段からは**進めない**（門の式は今までと同じもの）
         ② 行き来しても**値が消えない**（戻ると、入れたものがそのまま出る）
         ③ 送信の口は 5/5 ただ1つ（途中の段から直接送れない）
     ★門そのもの（GATE_ROLE / GATE_HOURS / GATE_PAY / GATE_CONTRACT）は1文字も
       変えていない。変わったのは「いつ次を見せるか」だけ。 */
  ok(await vis('s1'), '未ログインでも 1/5 は見えている');
  for (const id of ['s2', 's3', 's4', 's5', 'submit-block']) {
    ok(!(await vis(id)), `読み込み直後は隠れている（#${id}）`);
  }

  /* ★PVPayWizard.go() を呼ばずに**画面のボタンを押す**。
     押せる物が本当にそこに在ることまで、同じ1手で見る。 */
  const cur = () => page.evaluate(() => (['s1', 's2', 's3', 's4', 's5']
    .find((i) => { const e = document.getElementById(i); return e && !e.hidden; }) || ''));
  const tap = async (cls) => {
    const hit = await page.evaluate((c) => {
      /* ★2026-09-12：2回目以降は1つの段に箱が4つ出る（s2 が s1/s3/s4 を連れて出す）。
           「最初の見えている箱の中」で探すと、押す物を持たない #s1 を見て
           「押せなかった」と読んでしまう ── 画面には次へが出ているのに。
         押す物は**画面に出ているものを探す**（本人が押すのと同じ見つけ方）。 */
      const b = [...document.querySelectorAll(c)].find((e) => e.offsetParent !== null);
      if (!b) return false;
      b.click();
      return true;
    }, cls);
    await new Promise((r) => setTimeout(r, 320));
    return hit;
  };
  const goNext = () => tap('.wz-next');
  const goBack = () => tap('.wz-back');
  /* ★送信ボタンは 5/5 の中に在る。今どの段に居るかで offsetParent は変わるので、
     「引っ込んでいないか」は hidden ただ1つで見る（出す・出さないの決め手はそこ）。
     「送信を止めていない」ほうは、必須の抜けが1つも無いことで見る
     ── こちらのほうが元の検査より強い（画面に出ているかではなく、通るかを見る）。 */
  const submitOn = () => page.$eval('#submit-block', (el) => !el.hidden);
  const nothingMissing = () => page.evaluate(() => missingAll().length === 0);
  /* ★submitPayReport() は必須が抜けているとその欄の**段まで運ぶ**（それが仕様）。
     欄の出し入れを見る検査は「3. 報酬」に居ることが前提なので、試したら必ず戻す。 */
  const toPay = () => page.evaluate(() => {
    if (window.PVPayWizard) window.PVPayWizard.go(2, { quiet: true });
  });

  const bad = [];
  bad.push(...await setF(pick('f-airline', 'f-position', 'f-fleet', 'f-jobrole')));
  ok(await goNext(), '1/5 に「次へ」が在る');
  ok(!(await vis('s2')),
     '★年代がまだ空なら「次へ」で 2/5 へ進めない（2026-08-18 に年代も必須になった）');
  ok(await vis('s1'), '★進めなかった人はその場に残る（1/5 のまま）');
  bad.push(...await setF(pick('f-age')));
  await goNext();
  ok(await vis('s2'), '会社・職位・機材・年代を埋めると「次へ」で 2/5 へ進む');
  ok(!(await vis('s1')), '★1画面1段（前の段は画面から下りる）');
  ok(!(await vis('s3')), 'まだ 3/5 は出ない');
  ok(!(await stickyOn()),
     '★帯（年換算の合計）を出すのは 3/5 と 5/5 の2つだけ ── 2/5 では出さない');

  bad.push(...await setF(pick('f-block')));
  await goNext();
  /* ★2026-09-12（オーナー決定5）ステイ日数を任意に戻したので、飛んだ時間だけで進む。
       ⚠️ ここで空のまま進めることと、空を 0 にしないことは別の約束。
          下の「★ステイ日数を空のまま進んでも 0 が入らない」がそちらを見ている。 */
  ok(await vis('s3'), '★フライトタイムだけで 3/5 へ進む（ステイ日数は任意）');
  ok((await fv('f-stay')) === '',
     '★ステイ日数を空のまま進んでも 0 が入らない（不明のまま送る）', await fv('f-stay'));
  bad.push(...await setF(pick('f-stay')));
  ok(!(await vis('s4')), 'まだ 4/5 と送信ボタンは出ない');
  /* ── 帯（2026-09-08 オーナー指示で作り替えた）────────────────
     2026-08-27 の「3.報酬から『匿名で提出』を常に下に出す」は、5ステップ化に
     合わせて更新された ── **押す物は各段末尾の Next と 5/5 の提出だけ**。
     帯に残すのは年換算の合計だけで、途中の段から直接送れる口は作らない。 */
  ok(await stickyOn(), '★帯は「3. 報酬」の段で出る');
  ok(await page.$eval('body', (el) => el.classList.contains('has-cta')),
     '★帯のぶんだけ本文に下余白を足している（最後の欄と「次へ」が隠れない）');
  ok(!(await page.$('#sticky-btn')),
     '★帯に押す物は無い（送信の入口は 5/5 のただ1つ）');
  ok(await page.$eval('#sticky-total', (el) => el.textContent.trim().length > 0),
     '★帯に出ているのは年換算の合計', await page.$eval('#sticky-total', (el) => el.textContent.trim()));

  /* ② 行き来しても値が消えない。戻って、入れたものがそのまま出ることを見る。 */
  await goBack();
  ok((await cur()) === 's2', '「戻る」で 2/5 へ帰る');
  ok((await fv('f-block')) === SAMPLE['f-block'] && (await fv('f-stay')) === SAMPLE['f-stay'],
     '★戻っても乗務の値が残っている', `${await fv('f-block')} / ${await fv('f-stay')}`);
  await goBack();
  ok((await cur()) === 's1', 'もう一度「戻る」で 1/5 へ帰る');
  ok((await fv('f-airline')) === SAMPLE['f-airline'] && (await fv('f-age')) === SAMPLE['f-age'],
     '★いちばん前まで戻っても会社と年代が残っている',
     `${await fv('f-airline')} / ${await fv('f-age')}`);
  await goNext();
  await goNext();
  ok((await cur()) === 's3', '戻った先から「次へ」で 3/5 まで帰ってこられる');

  /* ★かんたん入力（既定）。2026-08-13 に、額面のほかに 手取り・今月出たボーナス・
     パーディアム・住居 が必須になった。1つずつ足して、揃うまで進めないことを見る。 */
  bad.push(...await setF({ 'f-currency': SAMPLE['f-currency'], 'f-gross': GROSS_M }));
  await goNext();
  ok(!(await vis('s4')),
     '★通貨と額面だけでは 4/5 へ進めない（手取り・今月のボーナス・パーディアム・住居が要る）');
  bad.push(...await setF({ 'f-netpay': NET_M, 'f-perdiem': '6200' }));
  await goNext();
  ok(!(await vis('s4')),
     '★今月の賞与が空のあいだは 4/5 へ進めない（空欄は未回答。0 とは違う）');
  /* ★出なかった月は 0 と入れてもらう。**0 は回答**であって未入力ではない。 */
  bad.push(...await setF({ 'f-bonus-mo': '0' }));
  await goNext();
  ok(!(await vis('s4')), '住居を答えるまでは 4/5 へ進めない');
  bad.push(...await setF({ 'f-housing': 'allowance' }));
  await goNext();
  ok(!(await vis('s4')), '★住居で現金を選んで額が空なら先へ進めない');
  bad.push(...await setF({ 'f-housing-amt': SAMPLE['f-housing-amt'] }));
  await goNext();
  ok(await vis('s4'), '住宅手当の額まで入れると 4/5 へ進む');
  ok(!(await stickyOn()), '★4/5 では帯を引っ込める（契約と税に金額は出てこない）');

  /* ③ 送信ボタンは 5/5（確認）の中だけ。§4 が埋まるまでそこへ着けない。 */
  ok(!(await vis('submit-block')), '★契約と税が空のあいだは送信ボタンへ着けない');
  bad.push(...await setF(pick('f-contract', 'f-taxcountry', 'f-seniority')));
  await goNext();
  ok(await vis('s5'), '契約形態・居住国・在籍年数で 5/5（確認）へ進む');
  ok(await vis('submit-block'), '送信ボタンは 5/5 の中に在る');
  /* ★2026-09-08 オーナー指摘「最後の入力確認画面はバーは出さないの？」。
     確認の段でも年換算の合計を出す。あわせて、提出ボタンが画面に入ると帯を
     沈めていた仕掛け（.is-off の IntersectionObserver）を外した ── あれは帯に
     「匿名で提出」が載っていたころ、同じボタンを2つ見せないためのもの。
     押す物が無くなった今それを残すと、いちばん見たい数字が黙って消える。 */
  ok(await stickyOn(), '★5/5（確認）でも帯を出す');
  ok(await page.$eval('#sticky-submit', (el) => !el.classList.contains('is-off')),
     '★提出ボタンが見えていても帯を沈めない（合計が読めたままでいる）');

  /* ★5/5 に「明細から読み取った値」の節を足した（2026-09-11）。あれは明細から
     来た人だけのもの。**手で入れた人の画面には1行も増えない**ことを先に固定する
     （空の欄を出し始めると、確認画面が「（未入力）」の羅列になる）。 */
  ok(await page.$eval('#wz-review', (el) => !/明細から読み取った値/.test(el.textContent)),
     '★手で入力した人の 5/5 に「明細から読み取った値」の節は出ない');

  /* ★確認から戻っても、報酬の段は入れたままで出てくる。
     ここから下は「3. 報酬」の中身を見るので、そこまで帰ってから続ける。 */
  await goBack();
  await goBack();
  ok((await cur()) === 's3', '確認から「戻る」2回で 3/5 へ帰れる');
  ok((await fv('f-gross')) === GROSS_M && (await fv('f-netpay')) === NET_M,
     '★往復しても額面と手取りが消えていない', `${await fv('f-gross')} / ${await fv('f-netpay')}`);
  ok(await vis('f-gross'), 'かんたん入力の額面が見えている');
  /* ★2026-09-08、オーナー指示で「＋給与の内訳を追加」を**最初から開いた**状態にした
     （「入力してくれるかもしれない」）。それまではここで「畳んでいる」ことを見ていた。
     手順書 workflows/pay-form.md の「畳んだ瞬間、門は誰にも開かなくなる」と同じ理由
     ── 本番23件で保証手当を書いた人が0人だったのは、欄が無いのではなく
     **あることに誰も気づいていなかった**から。
     ⚠️ ここが「開いている」に変わっても、奥に置いたままにする2つ
     （職位手当 f-command・その他の現金手当 pd-oth）は今までどおり隠れている。
     それは下の「＋」チップの検査が別に見張っている。 */
  ok(await visFold('f-base'), '★内訳は最初から開いていて、基本給の欄が見えている');
  ok(!(await page.$('#f-paytype')), '「払われ方」の欄はもう無い');
  ok((await page.$eval('#f-hourly', (el) => el.type)) === 'hidden',
     '時給は人に聞かない（hidden として残す）');

  /* ★総支給が入っているときは内訳を一切足さない（サーバの
     coalesce(p_gross_monthly, 内訳の合計) と同じ順番）。額面×12 ちょうどになること。
     ⚠️ 唯一の例外は組合が総支給の外で払われたとき（2026-09-02）。ここは組合の節を
        開いていない＝unionOutsideGross() が 0 なので、今までどおり額面×12。
        例外そのものは上の静的検査 ⑦-b と db/test-pay-reports.mjs が見ている。 */
  const grossOnly = await page.evaluate(() => annualTotal());
  ok(grossOnly === Number(GROSS_M) * 12,
     `額面だけのときは 額面×12 → ${grossOnly}`, `期待 ${Number(GROSS_M) * 12}`);

  /* ★総支給は「明細のとおり」＝ボーナスが出た月は込みの額。×12 する前に、
     その月に出たぶんだけ外す。外さないと、ボーナスの出た月に出した人の年収だけ
     跳ね上がる（2026-08-13 オーナー指摘）。サーバの pv_annual_total と同じ式。 */
  await setF({ 'f-bonus-mo': '10000' });
  const withBonus = await page.evaluate(() => annualTotal());
  ok(withBonus === (Number(GROSS_M) - 10000) * 12,
     `今月出たボーナスは ×12 する前に引く → ${withBonus}`,
     `期待 ${(Number(GROSS_M) - 10000) * 12}`);
  await setF({ 'f-bonus-mo': '0' });

  /* ★桁区切り（2026-08-13 オーナー指摘＝1150000 が読めない）。
     画面には 1,150,000 と出し、送るのとサーバの計算に使うのは素の 1150000 のまま
     （カンマが混じったまま送ると ::numeric がサーバで落ちる）。 */
  await setF({ 'f-gross': '1150000' });
  ok((await fvRaw('f-gross')) === '1,150,000',
     `百万円台は3桁ごとに区切って見せる → ${await fvRaw('f-gross')}`, '期待 1,150,000');
  ok((await page.evaluate(() => val('f-gross'))) === '1150000',
     '★送るのはカンマの無い数字');
  ok((await page.evaluate(() => annualTotal())) === 1150000 * 12,
     '桁区切りが入っても年換算は素の数字で計算する');
  await setF({ 'f-gross': GROSS_M });

  /* ── 総支給と内訳は両立する（2026-08-26 オーナー指示）─────────
     前は「くわしく入れる」を開くと額面が読み取り専用になり、内訳の合計が映っていた。
     会社ごとに建て付けの違う変動給を固定の6欄に入れられない人が多かったので、
     内訳を作り直すのに合わせて **本人が入れた総支給を合計で上書きしない** に変えた。
     ★ここが戻ると、内訳を書いた人の額面が合計で塗り潰される
       ＝「明細に出ているそのままの額」という約束が静かに破れる。
     ★差は pay-viz.js が「どの項目にも入れていない分」として灰色に描く。画面では黙っている。 */
  const toggleDetail = (open) => page.evaluate((o) => {
    const d = document.getElementById('pay-detail');
    d.open = o;
    d.dispatchEvent(new Event('toggle'));
  }, open);
  await toggleDetail(true);
  await new Promise((r) => setTimeout(r, 150));
  ok(await vis('f-gross'), '★内訳を開いても額面の欄は残る（隠さない）');
  ok(!(await page.$eval('#f-gross', (el) => el.readOnly)),
     '★内訳を開いても額面は自分で入れられる（合計で上書きしない）');
  ok(!(await page.$eval('#f-gross', (el) => el.disabled)),
     '額面を disabled にしない（薄くなって一番大事な数字が読めなくなる）');
  ok((await fv('f-gross')) === GROSS_M,
     `開いただけで額面の値が変わらない → ${await fv('f-gross')}`, `期待 ${GROSS_M}`);
  ok(await visFold('f-base'), '内訳を開くと基本給が出る');

  /* ①（2026-09-03 オーナー指摘「入力するべきところが文字だけじゃわかりづらい」）
     ★見るのは「縦棒が在るか」ではなく「埋めると色が変わるか」。
       在るだけなら CSS を消しても誰も気づけない。 */
  const railOf = (id) => page.evaluate((i) => {
    const el = document.getElementById(i);
    const b = el && el.closest('.is-rail');
    return b ? { key: b.classList.contains('is-rail-key'),
                 done: b.classList.contains('is-rail-done') } : null;
  }, id);
  ok((await railOf('f-base') || {}).key === true, '★基本給の欄にオレンジの縦棒がある');
  ok((await railOf('f-base') || {}).done === false, '空のうちは緑にならない');
  await setF({ 'f-base': '300000' });
  ok((await railOf('f-base') || {}).done === true, '★金額を入れると縦棒が緑に変わる');
  await setF({ 'f-base': '' });
  ok((await railOf('f-base') || {}).done === false, '★消すとオレンジに戻る（後始末）');
  ok((await railOf('f-command') || {}).key === false
     && (await railOf('f-command') || {}).done === false,
     '★門に関係しない欄は灰のまま（オレンジは3つだけ）');

  /* ①-b 変動給の入力欄が最初から1本ある（オーナー指摘
       「『変動給を追加』を押さないと入力画面出てこないの直して」）。
     ⚠️ その1本は**空のまま**。必須にしてはいけない（下で実際に送って確かめる）。 */
  const vRows = await page.evaluate(() => {
    const box = document.getElementById('pd-var-rows');
    return { n: box.children.length,
             filled: [...box.querySelectorAll('input, select')]
               .filter((e) => String(e.value || '').trim() !== '').length };
  });
  ok(vRows.n === 1, '★変動給の入力欄が最初から1本出ている（＋を押さなくていい）',
     JSON.stringify(vRows));
  ok(vRows.filled === 0, '★その1本は空（勝手に何かを入れておかない）', JSON.stringify(vRows));
  /* ⚠️ ここが一番静かに壊れる。最初から出した空の1本が必須に数えられると、
       変動給の無い人（大多数）が理由の分からないまま送信できなくなる。
       missingRequired() は「1文字も入っていない .pd-row」を数えない約束。 */
  const vMiss = await page.evaluate(() =>
    missingRequired().map((f) => (f.querySelector('input, select') || {}).className || '')
      .filter((c) => /pd-/.test(c)));
  ok(vMiss.length === 0,
     '★最初から出した空の1本は必須に数えない（送信を止めない）', JSON.stringify(vMiss));
  /* ★2026-08-26。最初から全部を展開しない（オーナー指示）。
     ★2026-09-03、そのうち2つ（保証給・変動給）だけを最初から出す形に変えた。
       REAL PAY の「報酬の内訳」を開く条件がこの3つで、奥に畳んだままでは
       誰も答えられなかったため（本番23件で保証手当を書いた人は0人）。
     ⚠️ 残る2つ（職位手当・その他の現金手当）は「＋」の奥のまま見張り続ける。
        ここが「全部出す」に流れていくのを止める最後の砦。減らさない。 */
  for (const id of ['opt-f-guarantee', 'opt-pd-var']) {
    ok(!(await page.$eval('#' + id, (el) => el.hidden)),
       `★内訳を開いた時点でもう出ている（門の必須3項目） ${id}`);
  }
  for (const id of ['opt-f-command', 'opt-pd-oth']) {
    ok(await page.$eval('#' + id, (el) => el.hidden),
       `★内訳を開いただけでは出さない（＋で足す） ${id}`);
  }
  /* 門の必須3項目には「該当なし」が要る。金額が無い人（保証給の無い会社）が
     ここで詰まると、条件を満たしようがない。 */
  for (const id of ['f-base-none', 'f-guarantee-none', 'f-variable-none']) {
    ok(await visFold(id), `★「該当なし」が出ている（0円ではなく「無い」を言える） ${id}`);
  }
  ok(await page.evaluate(() => {
       const want = ['f-command', 'pd-oth'];
       const gone = ['f-guarantee', 'pd-var'];
       const got = [...document.querySelectorAll('.pay-detail-b .chips .chip')]
         .map((b) => b.dataset.open);
       return want.every((k) => got.includes(k)) && !gone.some((k) => got.includes(k));
     }), '★「＋」に残っているのは職位手当とその他の現金手当だけ（保証給と変動給は出た）');
  ok(await page.evaluate(() => {
       document.querySelector('.pay-detail-b .chip[data-open="f-command"]').click();
       return !document.getElementById('opt-f-command').hidden
              && !document.querySelector('.pay-detail-b .chip[data-open="f-command"]');
     }), '★「＋職位手当」を押すと欄が出て、その「＋」は消える');
  /* 「該当なし」を3つとも入れただけで pay_items が出る（＝空の殻にされない）。
     ⚠️ ここが黙って壊れると、3つとも「該当なし」の人の内訳が丸ごと消えて
        REAL PAY が永久に開かない。DB 側は db/test-pay-reports.mjs が見ている。 */
  const none3 = await page.evaluate(() => {
    for (const id of ['f-base-none', 'f-guarantee-none', 'f-variable-none']) {
      const el = document.getElementById(id);
      el.checked = true;
      el.dispatchEvent(new Event('change'));
    }
    let o = null;
    try { o = JSON.parse(document.getElementById('f-payitems').value || 'null'); } catch (e) {}
    return { o, gDis: document.getElementById('f-guarantee').disabled,
             vDis: document.getElementById('pd-var').disabled };
  });
  ok(none3.o && none3.o.fixed_none === true && none3.o.guarantee_none === true
     && none3.o.variable_none === true,
     '★「該当なし」3つが pay_items に残る（空の殻に潰さない）', JSON.stringify(none3.o));
  ok(none3.gDis && none3.vDis, '★「該当なし」を選ぶとその欄は触れなくなる（0円と混ざらない）');
  await page.evaluate(() => {
    for (const id of ['f-base-none', 'f-guarantee-none', 'f-variable-none']) {
      const el = document.getElementById(id);
      el.checked = false;
      el.dispatchEvent(new Event('change'));
    }
  });
  ok(await vis('gross-hint-own'), '額面の説明は入れ替わらない（いつでも本人の額面）');
  ok(!(await page.$('#gross-hint-sum')), '★「下の内訳の合計」という説明はもう無い');

  /* 内訳を入れても、額面も年換算も動かない。サーバの pv_annual_total も
     総支給があればそちらを正とする（coalesce の第1引数）ので画面と一致する。
     ⚠️ 組合が総支給の外で払われている行だけは例外（2026-09-02）。組合の節は
        「乗員代表」を選んだ人にしか出ないので、ここでは開いていない。 */
  bad.push(...await setF({ 'f-base': '20000', 'f-perdiem': '5000' }));
  const kept = await page.evaluate(() => ({
    shown: document.getElementById('f-gross').value,
    detail: monthlyDetail(), annual: annualTotal(),
  }));
  ok(kept.shown.replace(/,/g, '') === GROSS_M,
     `内訳を入れても額面は本人の数字のまま → ${kept.shown}`, `期待 ${GROSS_M}`);
  ok(kept.annual === Number(GROSS_M) * 12,
     `年換算に内訳を足さない（額面×12） → ${kept.annual}`, `期待 ${Number(GROSS_M) * 12}`);

  /* ── 変動給・その他の現金手当は「行」で足す（2026-08-26）─────────
     Flight Pay / Sector / Reserve … は会社ごとに名前も本数も違う。固定の欄を並べると
     自分の明細を入れられない人が出るので、何行でも足せる形にした。
     ★行そのものは f-payitems（jsonb）で送り、合計だけを既存の列へ寄せる。 */
  const pdFill = (kind, list) => page.evaluate((k, items) => {
    const box = document.getElementById('pd-' + k + '-rows');
    while (box.children.length) box.firstElementChild.remove();
    for (const it of items) {
      const row = pdAdd(k, true);
      const set = (sel, v) => { const e = row.querySelector(sel); if (e && v != null) e.value = v; };
      set('.pd-amt', it.amount); set('.pd-label', it.label);
      set('.pd-basis', it.basis);
    }
    pdSync();
    try { return JSON.parse(document.getElementById('f-payitems').value || 'null'); }
    catch (e) { return { _broken: document.getElementById('f-payitems').value }; }
  }, kind, list);

  let items = await pdFill('var', [
    { amount: '4000', label: 'Flight Pay', basis: 'block' },
    {},                                    // ＋を押しただけの空の行
  ]);
  ok(items && items.variable && items.variable.length === 1
     && items.variable[0].amount === 4000 && items.variable[0].basis === 'block',
     '★変動給が行のまま送られる（空の行は送らない）', JSON.stringify(items));
  /* ★2026-08-26 オーナー指示。「¥4,500 / Block Hour」のような計算はさせない。
     支給単価もルールも聞かない＝欄そのものが無い。行にも残らない。 */
  ok(!(await page.$('#pd-var-rows .pd-rule')),
     '★変動給の行に「支給単価・ルール」の欄が無い（計算をさせない）');
  ok(items && items.variable && !('rule' in items.variable[0]),
     '★送る行にも rule が入っていない', JSON.stringify(items));

  /* ★変動給の行を足したときだけ「何に連動する支給か」は必須（2026-08-26 その2 オーナー指示）。
     ページの submitPayReport() をそのまま呼ぶ。#err に何が出るかで見る。
     ⚠️ 2回目は f-contract を空にしてから呼ぶ。種類の注意を抜けた先で必ず契約で止まるので、
        送信の口（RPC）まで進まない＝ネットにも DB にも触らない。 */
  await pdFill('var', [{ amount: '4000', label: 'Flight Pay' }]);   // 金額だけ・種類が空
  const noBasis = await page.evaluate(async () => {
    await submitPayReport();
    return {
      err: document.getElementById('err').textContent,
      marked: !!document.querySelector('#pd-var-rows .fld.is-miss .pd-basis'),
    };
  });
  /* ⚠️ 2026-09-03、止まる場所が変わった。変動給の欄を最初から出すようにしたので、
     「空のままの必須欄をまとめて出す」段（missingRequired）がこの行を先に掴む。
     前はこの欄ごと hidden ＝ offsetParent が無く、あの段を素通りして下の専用の
     1文まで落ちていた。どちらでも「止まって、その欄に印が付く」ことは同じなので、
     ★見るのは文面ではなく「止まったか・その欄に印が付いたか」にする。 */
  ok(/何に連動する支給か|What it is paid on/.test(noBasis.err) || noBasis.marked,
     '★金額だけの行を作って送ると、種類を選ぶよう止められる',
     `${noBasis.err.slice(0, 40)} / 印 ${noBasis.marked}`);
  await toPay();
  const withUnknown = await page.evaluate(async () => {
    document.querySelector('#pd-var-rows .pd-basis').value = 'unknown';
    const c = document.getElementById('f-contract'), keep = c.value;
    c.value = ''; c.dispatchEvent(new Event('change', { bubbles: true }));
    await submitPayReport();
    const seen = {
      err: document.getElementById('err').textContent,
      /* ★2026-08-27（その2）以降、足りない欄の名前は #err に出ない。
           印は欄そのものに付くので、そちらで見る。 */
      miss: [...document.querySelectorAll('.fld.is-miss')]
        .map((f) => (f.querySelector('input, select') || {}).id || ''),
    };
    c.value = keep; c.dispatchEvent(new Event('change', { bubbles: true }));
    clearErr();
    return seen;
  });
  ok(!/何に連動する支給か|What it is paid on/.test(withUnknown.err)
     && withUnknown.miss.includes('f-contract'),
     '★「わからない」を選ぶと種類では止まらない（次の必須へ進む）',
     `${withUnknown.err.slice(0, 40)} / ${withUnknown.miss.join(',')}`);
  await toPay();
  /* 行を1本も足していない人は、これまでどおり素通りする。 */
  const noRows = await page.evaluate(async () => {
    const box = document.getElementById('pd-var-rows');
    while (box.children.length) box.firstElementChild.remove();
    pdSync();
    const c = document.getElementById('f-contract'), keep = c.value;
    c.value = ''; c.dispatchEvent(new Event('change', { bubbles: true }));
    await submitPayReport();
    const seen = document.getElementById('err').textContent;
    c.value = keep; c.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('err').innerHTML = '';
    return seen;
  });
  ok(!/何に連動する支給か|What it is paid on/.test(noRows),
     '★変動給を1行も足していない人は種類で止まらない', noRows.slice(0, 60));
  await toPay();
  ok((await submitOn()) && (await nothingMissing()),
     '止めた後も送信は止まっていない（契約を戻せば元どおり）');
  items = await pdFill('var', [
    { amount: '4000', label: 'Flight Pay', basis: 'block' },
    {},
  ]);
  ok(items && items.variable && items.variable.length === 1,
     '検査の後始末（変動給を元に戻す）', JSON.stringify(items));
  items = await pdFill('oth', [{ amount: '1000', label: '通勤手当' }]);
  ok(items && items.other && items.other.length === 1 && items.other[0].amount === 1000,
     '★その他の現金手当も行で足せる', JSON.stringify(items));
  const sums = await page.evaluate(() => ({
    v: document.getElementById('f-var-sum').value,
    o: document.getElementById('f-oth-sum').value,
    gross: val('f-gross'), annual: annualTotal(),
  }));
  ok(Number(sums.v) === 4000 && Number(sums.o) === 1000,
     `行の合計が hidden に出る → ${sums.v} / ${sums.o}`);
  ok(sums.gross === GROSS_M && sums.annual === Number(GROSS_M) * 12,
     '★行を足しても額面と年換算は動かない', `${sums.gross} / ${sums.annual}`);
  const gone = await page.evaluate(() => {
    document.querySelector('#pd-oth-rows .pd-del').click();
    return { rows: document.getElementById('pd-oth-rows').children.length,
             sum: document.getElementById('f-oth-sum').value };
  });
  ok(gone.rows === 0 && gone.sum === '', '★行は × で消せる（合計も一緒に消える）',
     JSON.stringify(gone));
  await pdFill('oth', [{ amount: '1000', label: '通勤手当' }]);

  /* ★差の見せ方（オーナー決定「差がおかしいときだけ出す」）。
     プラス側の残り＝どの項目にも入れていない分は普通のことなので黙っている。
     おかしいのは内訳の合計が総支給を**超えた**ときだけで、そのときだけ1行出す。
     ★一致は強制しない・送信も止めない。 */
  const gap = await page.evaluate(() => ({ detail: monthlyDetail(), gross: num('f-gross') }));
  ok(gap.detail < gap.gross, `いま内訳は総支給に足りていない → ${gap.detail} / ${gap.gross}`);
  ok(!(await vis('pd-over')),
     '★内訳が総支給に足りなくても何も言わない（説明できない残りは普通のこと）');
  await setF({ 'f-base': String(Number(GROSS_M) + 1000) });
  await new Promise((r) => setTimeout(r, 150));
  ok(await vis('pd-over'), '★内訳の合計が総支給を超えたときだけ注意が出る');
  ok((await submitOn()) && (await nothingMissing()),
     '注意が出ても送信は止めない（一致は強制しない）');
  await setF({ 'f-base': '20000' });
  await new Promise((r) => setTimeout(r, 150));
  ok(!(await vis('pd-over')), '直すと注意は消える');

  /* ★報酬は総支給の1つだけが必須（2026-08-26）。内訳はぜんぶ任意になった。
     内訳だけ入れて額面が空の行は作らせない（年換算の出しようが無い）。 */
  const onlyDetail = await page.evaluate(() => {
    const g = document.getElementById('f-gross'), keep = g.value;
    g.value = '';
    const r = payEntered();
    g.value = keep;
    return r;
  });
  ok(onlyDetail === false, '★内訳だけ（額面が空）では報酬が入ったと見なさない');

  /* 「該当なし」＝固定・保証給の無い会社。欄を空にして触れなくし、
     内訳そのものは「答えた」として送る（＝空欄のまま出した人と区別できる）。 */
  const none = await page.evaluate(() => {
    const c = document.getElementById('f-base-none'), b = document.getElementById('f-base');
    c.checked = true; c.dispatchEvent(new Event('change'));
    const o = JSON.parse(document.getElementById('f-payitems').value || 'null');
    const seen = { disabled: b.disabled, val: b.value, fixed_none: o && o.fixed_none };
    c.checked = false; c.dispatchEvent(new Event('change'));
    return seen;
  });
  ok(none.disabled && none.val === '' && none.fixed_none === true,
     '★「該当なし」は欄を空にして触れなくし、答えとして送る', JSON.stringify(none));
  await setF({ 'f-base': '20000' });

  await toggleDetail(false);
  await new Promise((r) => setTimeout(r, 150));
  ok((await fv('f-gross')) === GROSS_M,
     `閉じても額面はそのまま → ${await fv('f-gross')}`, `期待 ${GROSS_M}`);
  ok(!(await page.$eval('#f-gross', (el) => el.readOnly)), '閉じても額面は自分で入れられる');
  /* ★2026-08-26、閉じても内訳を消さない。前は「画面に無い数字を送らない」ために
     畳んだ瞬間に全部消していたが、額面と両立するようになったので消す理由が無くなった。
     消すと、うっかり畳んだだけで書いた内訳が全部飛ぶ。 */
  ok((await fv('f-base')) === '20000',
     `閉じても内訳は残る → ${await fv('f-base')}`, '期待 20000');
  ok(await page.evaluate(() => !!document.getElementById('f-payitems').value),
     '★閉じても変動給・その他の行は残る');
  /* 内訳の外へ出た欄も閉じて消えないこと。消すと、開閉しただけで必須が空に戻り、
     §4 と送信ボタンが出たまま送れない状態になる。 */
  ok((await fv('f-perdiem')) === '5000' && (await fv('f-housing-amt')) === SAMPLE['f-housing-amt']
     && (await fv('f-netpay')) === NET_M,
     '★閉じてもパーディアム・住宅手当・手取りは残る',
     `${await fv('f-perdiem')} / ${await fv('f-housing-amt')} / ${await fv('f-netpay')}`);
  const backToGross = await page.evaluate(() => annualTotal());
  ok(backToGross === Number(GROSS_M) * 12,
     `閉じたあとの年換算も額面×12 → ${backToGross}`, `期待 ${Number(GROSS_M) * 12}`);

  // 以降は「くわしく入れる」側で測る（基本給・手当・住宅手当の額を検査したいので）
  await toggleDetail(true);
  await new Promise((r) => setTimeout(r, 150));

  // 任意項目はチップを押して初めて欄が出る
  const chipsLeft = await page.evaluate(() => {
    for (const c of [...document.querySelectorAll('.chip[data-open]')]) c.click();
    return [...document.querySelectorAll('.chip[data-open]')].map((c) => c.dataset.open);
  });
  ok(chipsLeft.length === 0, `チップを押すと欄が開き、チップ自身は消える → 残 ${chipsLeft.length}`);

  /* ── 所得税率の自動概算 ────────────────────────────────────────
     画面が勝手に入れる数字なので、当てずっぽうでないことをここで縛る。
     ★期待値は各国の税務当局が公表している「段の境目」から手で引いたもの。
       境目ちょうどを選ぶと、どの段まで足したかが一意に決まる＝式の誤りが必ず出る。
     ★null を返すべき場面（表の無い国・通貨違い）も同じくらい大事。
       ここが数字を返すようになったら、根拠の無い税率を人に見せている。 */
  const TAX_CASES = [
    // [居住国, 通貨, 年収, 期待する実効税率(%)]
    ['GB', 'GBP',    50270,  15.0],  // 個人手当12,570を引くと基本税率の上限37,700ちょうど
    ['GB', 'GBP',   125140,  34.0],  // 手当が全部消える所得。20%満額＋40%満額
    ['US', 'USD',   100000,  13.4],  // 標準控除15,750→課税84,250。10/12/22%の3段
    ['JP', 'JPY', 12000000,  21.4],  // 給与所得控除195万→基礎控除58万→33%の段＋復興＋住民税
    ['AE', 'AED',   600000,   0.0],  // 個人所得税が無い国は年収を見るまでもなく0
    ['AE', 'USD',        0,   0.0],  // 0%の国は年収が空でも0と言い切れる
    ['JP', 'AED', 12000000,  null],  // 明細がAED＝日本の税率表は当てられない（為替で嘘になる）
    ['FR', 'EUR',   100000,  null],  // 税率表を持っていない国は空欄のまま
    ['',   'JPY', 12000000,  null],  // 居住国が未選択
  ];
  for (const [c, cur, gross, want] of TAX_CASES) {
    const got = await page.evaluate((a, b, d) => estTaxPct(a, b, d), c, cur, gross);
    ok(got === want, `税率の自動概算 ${c || '(未選択)'} ${cur} ${gross} → ${want === null ? '空欄' : want + '%'}`,
       `実際は ${got}`);
  }
  const jpCurve = await page.evaluate(() =>
    [4000000, 8000000, 12000000, 20000000, 40000000].map((v) => estTaxPct('JP', 'JPY', v)));
  ok(jpCurve.every((v, i) => i === 0 || v > jpCurve[i - 1]),
     `日本の税率が年収とともに必ず上がる → ${jpCurve.join(' < ')}`);
  ok(jpCurve.every((v) => v > 0 && v < 60), '日本の税率が現実的な範囲に収まる');

  bad.push(...await setF(SAMPLE));
  ok(bad.length === 0, '入力値がすべて選択肢に存在する', bad.join(' / '));

  /* ── 教官・訓練の手当（2026-08-26 その3）──────────────────────
     ★実際に触る側。ここで見るのは4つ:
       ① 教官を選ぶまで出ない・外すと中身ごと消える
       ② 「追加の支給はない」は数クリックで終わる（金額の欄まで出さない）
       ③ 数量が分からなくても、金額だけで保存できる
       ④ 総支給・年換算・変動給・その他の合計が1つも動かない
          （＝オーナー指示「二重入力させない」「総支給を書き換えない」の実体） */
  const instrState = () => page.evaluate(() => ({
    shown: document.getElementById('s3-instr').offsetParent !== null,
    pay: document.getElementById('opt-instr-pay').hidden,
    unit: document.getElementById('instr-unit').hidden,
    qtyLab: document.getElementById('lab-instr-qty').textContent,
    roles: document.getElementById('f-jobrole').value,
    amount: document.getElementById('f-instructor').value,
    varSum: document.getElementById('f-var-sum').value,
    othSum: document.getElementById('f-oth-sum').value,
    gross: document.getElementById('f-gross').value,
    annual: annualTotal(),
    detail: monthlyDetail(),
    items: (() => {
      try { return JSON.parse(document.getElementById('f-payitems').value || 'null'); }
      catch (e) { return null; }
    })(),
  }));
  const tickInstr = (on) => page.evaluate((v) => {
    const b = document.querySelector('input[name="f-jobrole"][value="instructor"]');
    b.checked = v;
    b.dispatchEvent(new Event('change', { bubbles: true }));
  }, on);

  const i0 = await instrState();
  ok(!i0.shown, '★教官を選ぶまで、教官の欄はそもそも出ない', JSON.stringify(i0.shown));
  ok(!i0.items || !i0.items.instructor, '★出ていないうちは pay_items にも乗らない');

  await tickInstr(true);
  await new Promise((r) => setTimeout(r, 150));
  const i1 = await instrState();
  ok(i1.shown && i1.roles.split(',').includes('instructor'),
     '★教官を選ぶと欄が出る', `${i1.shown} / ${i1.roles}`);
  ok(i1.pay, '★開いた直後は金額の欄まで出さない（まず有無を聞く）');

  /* ②「追加の支給はない」でそこで終わる。 */
  await setF({ 'f-instr-extra': 'none' });
  await new Promise((r) => setTimeout(r, 150));
  const iNone = await instrState();
  ok(iNone.pay, '★「追加の支給はない」なら金額の欄は出ない（数クリックで終わる）');
  ok(iNone.items && iNone.items.instructor && iNone.items.instructor.extra === 'none'
     && iNone.items.instructor.amount === null,
     '★答えとしては残る（金額は空のまま）', JSON.stringify(iNone.items && iNone.items.instructor));

  /* ⑤のラベルは option の data-* から来る（JS が文言を持たない）。 */
  await setF({ 'f-instr-extra': 'separate', 'f-instr-method': 'session' });
  await new Promise((r) => setTimeout(r, 150));
  const iSes = await instrState();
  const wantLab = await page.evaluate(() => {
    const o = [...document.getElementById('f-instr-method').options].find((x) => x.value === 'session');
    return { qty: o.dataset.qty };
  });
  ok(!iSes.pay && !iSes.unit, '★「別途支給されている」を選ぶと、金額と数量の欄が出る');
  ok(iSes.qtyLab === wantLab.qty,
     '★数量のラベルは選んだ支給単位から来る', iSes.qtyLab);
  await setF({ 'f-instr-method': 'monthly' });
  await new Promise((r) => setTimeout(r, 150));
  ok((await instrState()).unit,
     '★月額で固定なら数量は聞かない（数える物が無い）');
  await setF({ 'f-instr-method': 'session' });

  /* ③ 回数が空のまま、金額だけで保存できる。 */
  const before = await instrState();
  await setF({ 'f-instructor': '600' });
  await new Promise((r) => setTimeout(r, 200));
  const iAmt = await instrState();
  ok(iAmt.items && iAmt.items.instructor && iAmt.items.instructor.amount === 600
     && iAmt.items.instructor.qty === null
     && !('rate' in iAmt.items.instructor),
     '★回数が分からなくても、金額だけで残る（単価はもう聞かない）',
     JSON.stringify(iAmt.items && iAmt.items.instructor));
  ok(iAmt.gross === before.gross && iAmt.annual === before.annual,
     '★教官の額を入れても総支給も年換算も動かない', `${iAmt.gross} / ${iAmt.annual}`);
  ok(iAmt.varSum === before.varSum && iAmt.othSum === before.othSum,
     '★変動給・その他の合計は1円も増えない（二重入力させない）',
     `${iAmt.varSum} / ${iAmt.othSum}`);
  ok(iAmt.detail === before.detail + 600,
     '★「内訳の合計」には数える（総支給と見比べる数なので）',
     `${iAmt.detail} / 期待 ${before.detail + 600}`);

  /* 担当している訓練も乗る。 */
  await page.evaluate(() => {
    for (const v of ['line', 'sim']) {
      const b = document.querySelector(`input[name="f-instr-train"][value="${v}"]`);
      b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true }));
    }
    document.getElementById('f-instr-label').value = 'Training Captain';
    document.getElementById('f-instr-label').dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 150));
  const iFull = await instrState();
  ok(iFull.items.instructor.trainings.join(',') === 'line,sim'
     && iFull.items.instructor.label === 'Training Captain'
     && iFull.items.instructor.method === 'session',
     '★担当している訓練・呼び名・支給単位がそのまま乗る',
     JSON.stringify(iFull.items.instructor));

  /* ① 外したら中身ごと消える。見えていない欄の値を黙って送らない。 */
  await tickInstr(false);
  await new Promise((r) => setTimeout(r, 150));
  const iOff = await instrState();
  ok(!iOff.shown && iOff.amount === '' && (!iOff.items || !iOff.items.instructor),
     '★教官を外すと、欄も入れた金額も pay_items の中身も消える',
     JSON.stringify({ shown: iOff.shown, amount: iOff.amount }));
  ok(iOff.detail === before.detail,
     '★消したぶんは「内訳の合計」からも引かれる', `${iOff.detail} / ${before.detail}`);

  /* ── 審査・査察の手当（2026-08-26 その4）────────────────────
     教官と同じ4つに加えて、ここだけの本題がひとつ ──
     ★「教官の手当とまとめて支給されている」を選んだら金額の欄を出さない。
       出すと、同じお金を instructor_pay と examiner_pay に2回入れる道が開く。 */
  const examState = () => page.evaluate(() => ({
    shown: document.getElementById('s3-exam').offsetParent !== null,
    pay: document.getElementById('opt-exam-pay').hidden,
    unit: document.getElementById('exam-unit').hidden,
    qtyLab: document.getElementById('lab-exam-qty').textContent,
    roles: document.getElementById('f-jobrole').value,
    amount: document.getElementById('f-examiner').value,
    instrAmount: document.getElementById('f-instructor').value,
    varSum: document.getElementById('f-var-sum').value,
    othSum: document.getElementById('f-oth-sum').value,
    gross: document.getElementById('f-gross').value,
    annual: annualTotal(),
    detail: monthlyDetail(),
    items: (() => {
      try { return JSON.parse(document.getElementById('f-payitems').value || 'null'); }
      catch (e) { return null; }
    })(),
  }));
  const tickExam = (on) => page.evaluate((v) => {
    const b = document.querySelector('input[name="f-jobrole"][value="examiner"]');
    b.checked = v;
    b.dispatchEvent(new Event('change', { bubbles: true }));
  }, on);

  const e0 = await examState();
  ok(!e0.shown, '★審査を選ぶまで、審査の欄はそもそも出ない', JSON.stringify(e0.shown));
  ok(!e0.items || !e0.items.examiner, '★出ていないうちは pay_items にも乗らない');

  await tickExam(true);
  await new Promise((r) => setTimeout(r, 150));
  const e1 = await examState();
  ok(e1.shown && e1.roles.split(',').includes('examiner'),
     '★審査を選ぶと欄が出る', `${e1.shown} / ${e1.roles}`);
  ok(e1.pay, '★開いた直後は金額の欄まで出さない（まず有無を聞く）');

  /* ★★ここが本題。「教官の手当とまとめて」を選んだら金額を聞かない。 */
  await setF({ 'f-exam-extra': 'with_instructor' });
  await new Promise((r) => setTimeout(r, 150));
  const eWith = await examState();
  ok(eWith.pay,
     '★★「教官の手当とまとめて支給されている」なら金額の欄を出さない（二重計上の道を塞ぐ）');
  ok(eWith.items && eWith.items.examiner && eWith.items.examiner.extra === 'with_instructor'
     && eWith.items.examiner.amount === null,
     '★答えとしては残る（金額は空のまま＝額は教官側に入っている）',
     JSON.stringify(eWith.items && eWith.items.examiner));

  await setF({ 'f-exam-extra': 'none' });
  await new Promise((r) => setTimeout(r, 150));
  ok((await examState()).pay, '★「追加の支給はない」も数クリックで終わる');

  /* 数量のラベルは option の data-qty から来る。 */
  await setF({ 'f-exam-extra': 'separate', 'f-exam-method': 'session' });
  await new Promise((r) => setTimeout(r, 150));
  const eSes = await examState();
  const wantExam = await page.evaluate(() => {
    const o = [...document.getElementById('f-exam-method').options].find((x) => x.value === 'session');
    return o.dataset.qty;
  });
  ok(!eSes.pay && !eSes.unit, '★「別途支給されている」を選ぶと、金額と数量の欄が出る');
  ok(eSes.qtyLab === wantExam, '★数量のラベルは選んだ支給単位から来る', eSes.qtyLab);
  await setF({ 'f-exam-method': 'monthly' });
  await new Promise((r) => setTimeout(r, 150));
  ok((await examState()).unit, '★月額で固定なら数量は聞かない（数える物が無い）');
  await setF({ 'f-exam-method': 'check' });

  /* ★回数が空のまま、金額だけで保存できる。 */
  const eBefore = await examState();
  await setF({ 'f-examiner': '4000' });
  await new Promise((r) => setTimeout(r, 200));
  const eAmt = await examState();
  ok(eAmt.items && eAmt.items.examiner && eAmt.items.examiner.amount === 4000
     && eAmt.items.examiner.qty === null,
     '★回数が分からなくても、金額だけで残る',
     JSON.stringify(eAmt.items && eAmt.items.examiner));
  ok(eAmt.gross === eBefore.gross && eAmt.annual === eBefore.annual,
     '★審査の額を入れても総支給も年換算も動かない', `${eAmt.gross} / ${eAmt.annual}`);
  ok(eAmt.varSum === eBefore.varSum && eAmt.othSum === eBefore.othSum
     && eAmt.instrAmount === eBefore.instrAmount,
     '★変動給・その他・教官の額は1円も増えない（二重入力させない）',
     `${eAmt.varSum} / ${eAmt.othSum} / ${eAmt.instrAmount}`);
  ok(eAmt.detail === eBefore.detail + 4000,
     '★「内訳の合計」には数える（総支給と見比べる数なので）',
     `${eAmt.detail} / 期待 ${eBefore.detail + 4000}`);

  /* 担当している Check と会社の呼び名も乗る。 */
  await page.evaluate(() => {
    for (const v of ['sim', 'line']) {
      const b = document.querySelector(`input[name="f-exam-check"][value="${v}"]`);
      b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true }));
    }
    document.getElementById('f-exam-label').value = 'TRE';
    document.getElementById('f-exam-label').dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 150));
  const eFull = await examState();
  ok(eFull.items.examiner.checks.join(',') === 'sim,line'
     && eFull.items.examiner.label === 'TRE'
     && eFull.items.examiner.method === 'check',
     '★担当している Check・呼び名・支給単位がそのまま乗る',
     JSON.stringify(eFull.items.examiner));

  /* 外したら中身ごと消える。★このあとの payload では審査を選んでいない状態に戻す。 */
  await tickExam(false);
  await new Promise((r) => setTimeout(r, 150));
  const eOff = await examState();
  ok(!eOff.shown && eOff.amount === '' && (!eOff.items || !eOff.items.examiner),
     '★審査を外すと、欄も入れた金額も pay_items の中身も消える',
     JSON.stringify({ shown: eOff.shown, amount: eOff.amount }));
  ok(eOff.detail === eBefore.detail,
     '★消したぶんは「内訳の合計」からも引かれる', `${eOff.detail} / ${eBefore.detail}`);

  /* ── 管理・マネジメントの手当（2026-08-26 その6）───────────────
     教官・審査と同じ4つに加えて、ここだけの本題がひとつ ──
     ★組合と違い、この額は会社が払う＝総支給の中にあるので、内訳の合計には
       条件なしで足す。条件を付けると、内訳の合計が実際より小さく出て
       「総支給を超えています」の注意が出るべきときに出なくなる。 */
  const mgmtState = () => page.evaluate(() => ({
    shown: document.getElementById('s3-mgmt').offsetParent !== null,
    pay: document.getElementById('opt-mgmt-pay').hidden,
    roles: document.getElementById('f-jobrole').value,
    amount: document.getElementById('f-mgmt-pay').value,
    instrAmount: document.getElementById('f-instructor').value,
    examAmount: document.getElementById('f-examiner').value,
    varSum: document.getElementById('f-var-sum').value,
    othSum: document.getElementById('f-oth-sum').value,
    command: document.getElementById('f-command').value,
    gross: document.getElementById('f-gross').value,
    annual: annualTotal(),
    detail: monthlyDetail(),
    items: (() => {
      try { return JSON.parse(document.getElementById('f-payitems').value || 'null'); }
      catch (e) { return null; }
    })(),
  }));
  const tickMgmt = (on) => page.evaluate((v) => {
    const b = document.querySelector('input[name="f-jobrole"][value="management"]');
    b.checked = v;
    b.dispatchEvent(new Event('change', { bubbles: true }));
  }, on);

  const m0 = await mgmtState();
  ok(!m0.shown, '★管理職を選ぶまで、管理職の欄はそもそも出ない', JSON.stringify(m0.shown));
  ok(!m0.items || !m0.items.management, '★出ていないうちは pay_items にも乗らない');

  await tickMgmt(true);
  await new Promise((r) => setTimeout(r, 150));
  const m1 = await mgmtState();
  ok(m1.shown && m1.roles.split(',').includes('management'),
     '★管理職を選ぶと欄が出る', `${m1.shown} / ${m1.roles}`);
  ok(m1.pay, '★開いた直後は金額の欄まで出さない（まず日数と有無を聞く）');

  /* ★「含まれる」「なし」「わからない」は2クリックで終わる（金額を聞かない）。 */
  for (const v of ['included', 'none', 'unknown']) {
    await setF({ 'f-mgmt-extra': v });
    await new Promise((r) => setTimeout(r, 120));
    ok((await mgmtState()).pay, `★「${v}」なら金額の欄を出さない（数クリックで終わる）`);
  }

  /* 管理業務日数だけ書いて終える人も居る。それも残る。 */
  await setF({ 'f-mgmt-extra': '', 'f-mgmt-days': '8' });
  await new Promise((r) => setTimeout(r, 150));
  const mDays = await mgmtState();
  ok(mDays.items && mDays.items.management && mDays.items.management.days === 8,
     '★管理業務日数だけでも残る（Block Hours が少ない月の理由になる）',
     JSON.stringify(mDays.items && mDays.items.management));

  const mBefore = await mgmtState();
  await setF({ 'f-mgmt-extra': 'separate' });
  await new Promise((r) => setTimeout(r, 150));
  ok(!(await mgmtState()).pay, '★「別途支給されている」を選ぶと金額と支給単位が出る');
  await setF({ 'f-mgmt-method': 'monthly', 'f-mgmt-pay': '50000' });
  await new Promise((r) => setTimeout(r, 200));
  const mAmt = await mgmtState();
  ok(mAmt.items && mAmt.items.management && mAmt.items.management.amount === 50000
     && mAmt.items.management.method === 'monthly' && mAmt.items.management.days === 8,
     '★日数・有無・金額・支給単位がそのまま乗る',
     JSON.stringify(mAmt.items && mAmt.items.management));
  ok(mAmt.gross === mBefore.gross && mAmt.annual === mBefore.annual,
     '★管理職の額を入れても総支給も年換算も動かない', `${mAmt.gross} / ${mAmt.annual}`);
  ok(mAmt.varSum === mBefore.varSum && mAmt.othSum === mBefore.othSum
     && mAmt.command === mBefore.command
     && mAmt.instrAmount === mBefore.instrAmount && mAmt.examAmount === mBefore.examAmount,
     '★変動給・その他・職位手当・教官・審査の額は1円も増えない（二重入力させない）',
     `${mAmt.varSum} / ${mAmt.othSum} / ${mAmt.command}`);
  ok(mAmt.detail === mBefore.detail + 50000,
     '★★「内訳の合計」には条件なしで足される（組合と違い、会社が払うお金だから）',
     `${mAmt.detail} / 期待 ${mBefore.detail + 50000}`);

  /* 外したら中身ごと消える。★このあとの payload では管理職を選んでいない状態に戻す。 */
  await tickMgmt(false);
  await new Promise((r) => setTimeout(r, 150));
  const mOff = await mgmtState();
  ok(!mOff.shown && mOff.amount === '' && (!mOff.items || !mOff.items.management),
     '★管理職を外すと、欄も入れた金額も pay_items の中身も消える',
     JSON.stringify({ shown: mOff.shown, amount: mOff.amount }));
  ok(mOff.detail === mBefore.detail,
     '★消したぶんは「内訳の合計」からも引かれる', `${mOff.detail} / ${mBefore.detail}`);

  /* ── その他の兼務・配属の手当（2026-08-27 その7）──────────────
     役割ごとの5本目＝最後。管理職と同じで内訳の合計には条件なしで足す。
     ★ここだけの本題は「聞くのは3つだけ」── 分野・日数・追加報酬（あるときだけ金額）。
       部署名・出向先の会社名・プロジェクト名・仕事の中身は画面に欄そのものが無い。 */
  const nolState = () => page.evaluate(() => ({
    shown: document.getElementById('s3-nonline').offsetParent !== null,
    pay: document.getElementById('opt-nonline-pay').hidden,
    roles: document.getElementById('f-jobrole').value,
    amount: document.getElementById('f-nonline-pay').value,
    instrAmount: document.getElementById('f-instructor').value,
    examAmount: document.getElementById('f-examiner').value,
    mgmtAmount: document.getElementById('f-mgmt-pay').value,
    varSum: document.getElementById('f-var-sum').value,
    othSum: document.getElementById('f-oth-sum').value,
    command: document.getElementById('f-command').value,
    gross: document.getElementById('f-gross').value,
    annual: annualTotal(),
    detail: monthlyDetail(),
    items: (() => {
      try { return JSON.parse(document.getElementById('f-payitems').value || 'null'); }
      catch (e) { return null; }
    })(),
  }));
  const tickNonline = (on) => page.evaluate((v) => {
    const b = document.querySelector('input[name="f-jobrole"][value="nonline"]');
    b.checked = v;
    b.dispatchEvent(new Event('change', { bubbles: true }));
  }, on);

  const n0 = await nolState();
  ok(!n0.shown, '★兼務・配属を選ぶまで、兼務・配属の欄はそもそも出ない', JSON.stringify(n0.shown));
  ok(!n0.items || !n0.items.nonline, '★出ていないうちは pay_items にも乗らない');

  await tickNonline(true);
  await new Promise((r) => setTimeout(r, 150));
  const n1 = await nolState();
  ok(n1.shown && n1.roles.split(',').includes('nonline'),
     '★兼務・配属を選ぶと欄が出る', `${n1.shown} / ${n1.roles}`);
  ok(n1.pay, '★開いた直後は金額の欄まで出さない（まず分野と日数と有無を聞く）');

  /* ★「含まれる」「なし」「わからない」は数クリックで終わる（金額を聞かない）。 */
  for (const v of ['included', 'none', 'unknown']) {
    await setF({ 'f-nonline-extra': v });
    await new Promise((r) => setTimeout(r, 120));
    ok((await nolState()).pay, `★「${v}」なら金額の欄を出さない（数クリックで終わる）`);
  }

  /* 分野だけ選んで終える人も居る。それも残る。 */
  await setF({ 'f-nonline-extra': '' });
  await page.evaluate(() => {
    for (const v of ['safety', 'secondment']) {
      const b = document.querySelector(`input[name="f-nonline-area"][value="${v}"]`);
      b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 150));
  const nArea = await nolState();
  ok(nArea.items && nArea.items.nonline
     && nArea.items.nonline.areas.join(',') === 'safety,secondment',
     '★分野だけでも残る（追加報酬が無いのは普通のこと）',
     JSON.stringify(nArea.items && nArea.items.nonline));

  await setF({ 'f-nonline-days': '8' });
  await new Promise((r) => setTimeout(r, 150));
  const nBefore = await nolState();
  await setF({ 'f-nonline-extra': 'separate' });
  await new Promise((r) => setTimeout(r, 150));
  ok(!(await nolState()).pay, '★「別途支給される」を選ぶと金額が出る');
  await setF({ 'f-nonline-pay': '30000' });
  await new Promise((r) => setTimeout(r, 200));
  const nAmt = await nolState();
  ok(nAmt.items && nAmt.items.nonline && nAmt.items.nonline.amount === 30000
     && nAmt.items.nonline.days === 8
     && nAmt.items.nonline.areas.join(',') === 'safety,secondment',
     '★分野・日数・有無・金額がそのまま乗る',
     JSON.stringify(nAmt.items && nAmt.items.nonline));
  ok(nAmt.gross === nBefore.gross && nAmt.annual === nBefore.annual,
     '★兼務・配属の額を入れても総支給も年換算も動かない', `${nAmt.gross} / ${nAmt.annual}`);
  ok(nAmt.varSum === nBefore.varSum && nAmt.othSum === nBefore.othSum
     && nAmt.command === nBefore.command && nAmt.instrAmount === nBefore.instrAmount
     && nAmt.examAmount === nBefore.examAmount && nAmt.mgmtAmount === nBefore.mgmtAmount,
     '★変動給・その他・職位手当・教官・審査・管理職の額は1円も増えない（二重入力させない）',
     `${nAmt.varSum} / ${nAmt.othSum} / ${nAmt.command}`);
  ok(nAmt.detail === nBefore.detail + 30000,
     '★★「内訳の合計」には条件なしで足される（管理職と同じ）',
     `${nAmt.detail} / 期待 ${nBefore.detail + 30000}`);

  /* ★A（2026-08-27）── 超過の注意は、その額を打った欄の下に出る。
     いま最後に打ったのは兼務・配属の金額なので、出るのは pd-over-nonline だけ。 */
  await page.evaluate(() => {
    const g = document.getElementById('f-gross');
    g.value = '1'; g.dispatchEvent(new Event('input', { bubbles: true }));
    const n = document.getElementById('f-nonline-pay');
    n.dispatchEvent(new Event('input', { bubbles: true }));   // ★最後に触った欄をこちらに戻す
  });
  await new Promise((r) => setTimeout(r, 200));
  const warnN = await page.evaluate(() => ['pd-over', 'pd-over-instr', 'pd-over-exam',
    'pd-over-union', 'pd-over-mgmt', 'pd-over-nonline']
    .filter((id) => { const e = document.getElementById(id); return e && !e.hidden; }));
  ok(warnN.length === 1 && warnN[0] === 'pd-over-nonline',
     '★A: 超過の注意は兼務・配属の金額の下に1つだけ出る', warnN.join(','));
  /* 基本給を最後に触ると、既定の受け皿（内訳の中）へ戻る。 */
  await page.evaluate(() => {
    const b = document.getElementById('f-base');
    b.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 200));
  const warnB = await page.evaluate(() => ['pd-over', 'pd-over-instr', 'pd-over-exam',
    'pd-over-union', 'pd-over-mgmt', 'pd-over-nonline']
    .filter((id) => { const e = document.getElementById(id); return e && !e.hidden; }));
  ok(warnB.length === 1 && warnB[0] === 'pd-over',
     '★A: 内訳の欄を触ったら既定の受け皿へ戻る（受け皿は常に1つだけ）', warnB.join(','));
  /* 総支給を内訳より大きくすると、どの受け皿も消える。
     ★ここは「超えていない状態」を作る必要がある。この通しでは基本給や変動給が
       すでに入っていて、素の 54,250 では内訳のほうが大きい（それが正しい）。 */
  await setF({ 'f-gross': '200000' });
  await new Promise((r) => setTimeout(r, 200));
  const warnOff = await page.evaluate(() => ['pd-over', 'pd-over-instr', 'pd-over-exam',
    'pd-over-union', 'pd-over-mgmt', 'pd-over-nonline']
    .filter((id) => { const e = document.getElementById(id); return e && !e.hidden; }));
  ok(warnOff.length === 0, '★A: 超えていなければ注意は1つも出ない', warnOff.join(','));
  await setF({ 'f-gross': GROSS_M });      // 通しの続きのために戻す
  await new Promise((r) => setTimeout(r, 150));

  /* 外したら中身ごと消える。★このあとの payload では兼務・配属を選んでいない状態に戻す。 */
  await tickNonline(false);
  await new Promise((r) => setTimeout(r, 150));
  const nOff = await nolState();
  ok(!nOff.shown && nOff.amount === '' && (!nOff.items || !nOff.items.nonline),
     '★兼務・配属を外すと、欄も入れた金額も pay_items の中身も消える',
     JSON.stringify({ shown: nOff.shown, amount: nOff.amount }));
  ok(nOff.detail === nBefore.detail,
     '★消したぶんは「内訳の合計」からも引かれる', `${nOff.detail} / ${nBefore.detail}`);

  /* ── ★役割を選んだら、その「追加手当」を最初から開く（2026-09-09 オーナー指示）──
     「役職・区分で line 業務以外を選んだ人は該当する『追加手当』を最初から開いておいて」。
     これまでは外側の箱（#s3-instr など）だけが出て、中の <details> は畳んだままで、
     「＋教官・訓練の手当を追加」の1行しか見えなかった＝中に何を聞かれるか分からない。
     ★開くのは見え方だけ。必須（req-tag）は1つも増えない（手順書「絶対に破らない6つ」の6番）。
     ★外したら畳み直し、中の値も消える（元からの約束）。ここも同時に見る。
     ⚠️ 畳んだ <details> の中身は offsetParent が null にならない
        （Chrome の ::details-content は content-visibility:hidden ＝ レイアウトを残す）。
        開閉は .open と checkVisibility() で測る。 */
  for (const [role, det, probe] of [['instructor', 'instr-detail', 'f-instr-extra'],
                                    ['examiner', 'exam-detail', 'f-exam-extra'],
                                    ['union', 'union-detail', 'f-union-extra'],
                                    ['management', 'mgmt-detail', 'f-mgmt-extra'],
                                    ['nonline', 'nonline-detail', 'f-nonline-extra']]) {
    const tick = (on) => page.evaluate((v, r) => {
      const b = document.querySelector(`input[name="f-jobrole"][value="${r}"]`);
      b.checked = v;
      b.dispatchEvent(new Event('change', { bubbles: true }));
    }, on, role);
    const st = () => page.evaluate((d, q) => ({
      open: !!document.getElementById(d).open,
      probeSeen: document.getElementById(q).checkVisibility(),
      probeVal: document.getElementById(q).value,
    }), det, probe);

    await tick(true);
    await new Promise((r) => setTimeout(r, 180));
    const on = await st();
    ok(on.open && on.probeSeen,
       `★${role} を選んだら「追加手当」が最初から開いている`, JSON.stringify(on));

    /* 本人が畳んだら、そのまま畳んだままにする（勝手に開き直さない）。 */
    await page.evaluate((d) => { document.getElementById(d).open = false; }, det);
    await page.evaluate(() => {
      const b = document.getElementById('f-block');
      b.dispatchEvent(new Event('input', { bubbles: true }));   // updateSteps() を1回まわす
    });
    await new Promise((r) => setTimeout(r, 180));
    ok(!(await st()).open,
       `★${role}：本人が畳んだら畳んだまま（こちらから開き直さない）`);

    await tick(false);
    await new Promise((r) => setTimeout(r, 180));
    const off = await st();
    ok(!off.open && !off.probeSeen && off.probeVal === '',
       `★${role} を外すと畳まれ、中の答えも消える`, JSON.stringify(off));
  }

  /* 送信の payload まで見たいので、もう一度入れ直す。 */
  await tickInstr(true);
  await new Promise((r) => setTimeout(r, 150));
  await setF({ 'f-instr-extra': 'separate', 'f-instr-method': 'session', 'f-instructor': '600' });
  await page.evaluate(() => {
    const b = document.querySelector('input[name="f-instr-train"][value="sim"]');
    b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 200));

  /* ── ログイン前の1押しで「預かる」───────────────────────────
     2026-08-18 に順序を反転させた。以前は「ログインするまでサーバへ送らない」
     だったが、それだと登録が1歩でも詰まった人の入力が丸ごと消えていた。
     ★いま守るのは2つ：
       ① ログイン前でも預かりには届く（＝入力が消えない）
       ② ただし本棚（pay_reports）にはログイン前に1行も入らない。
          誰の行かは本人が確定するまで決められないため。 */
  /* ★件数は日本語版・英語版で通しの器を使い回すので、差分で見る（合計だと2周目で落ちる）。 */
  /* ── B: 途中で押したら、足りない欄まで飛んで赤く囲う ────────────
     2026-08-27 オーナー指示「途中で押したらエラー画面で記入していない必須項目を
     箇条書きで出るようにして」→ 同日その2「やっぱり箇条書きを一旦やめよう。
     ……そのまま必須項目の該当する欄まで飛んで、そこを赤く囲うとかはどう？
     該当する項目の右横に未入力とか書いて」。
     前は早期 return で1件ずつだったので、3つ空いている人は3回押し直していた。
     ★必須の出どころは今までどおり画面の req-tag ただ1か所（上の ⑧-b が字で見張っている）。
       ここでは「印を消した3つが全部赤くなり、先頭に飛ぶ」ことを実際に押して確かめる。 */
  {
    const CLEAR = ['f-netpay', 'f-contract', 'f-seniority'];   // DOM の並び順
    /* 期待するラベルも画面から作る（訳を書き写すと日英でズレる）。 */
    const wantLabels = await page.evaluate((ids) => ids.map((id) => {
      const c = document.getElementById(id).closest('.fld').querySelector('.form-label').cloneNode(true);
      for (const t of c.querySelectorAll('.req-tag, .opt-tag, .auto-tag')) t.remove();
      return c.textContent.trim();
    }), CLEAR);
    ok(wantLabels.every((t) => t.length > 0 && !/必須|Required/.test(t)),
       '★B: 画面のラベルから「必須」の札を落として読めている', wantLabels.join(' / '));

    const seenB = seen.length, stashB = stash.length;
    await setF({ 'f-netpay': '', 'f-contract': '', 'f-seniority': '' });
    await new Promise((r) => setTimeout(r, 150));
    /* ★5ステップ化（2026-09-08）で常設バーの押す口は無くなった。
       押す口は 5/5（確認）の送信ボタンただ一つなので、そこまで歩いてから押す。
       ★値を空にしたあとでも 5/5 へは行ける（全部埋めてから戻って消した人と同じ）。
         見たいのは「その状態で押すとどうなるか」。 */
    await page.evaluate(() => { window.PVPayWizard.goLast(); });
    await new Promise((r) => setTimeout(r, 300));
    ok(await vis('submit-block'), '★B: 確認の段（5/5）には送信ボタンが出ている');
    await page.evaluate(() => document.getElementById('submit-btn').click());
    await new Promise((r) => setTimeout(r, 300));

    const eb = await page.evaluate(() => {
      const e = document.getElementById('err');
      const miss = [...document.querySelectorAll('.fld.is-miss')];
      return {
        /* 赤くなった欄を、中の input/select の id で見る（並びも DOM のまま）。 */
        marked: miss.map((f) => (f.querySelector('input, select') || {}).id || ''),
        /* 右横の札は画面の文字から読む（訳を書き写さない）。 */
        tags: miss.map((f) => {
          const t = f.querySelector('.form-label .miss-tag');
          return t ? t.textContent.trim() : '';
        }),
        /* 飛んだ先。focus({preventScroll:true}) が当たっているはず。 */
        focused: (document.activeElement || {}).id || '',
        title: (e.querySelector('.fa-title') || { textContent: '' }).textContent.trim(),
        ul: !!e.querySelector('ul'),
        /* ★運ばれた先と、そこで先頭の欄が実際に見えているか。 */
        step: window.PVPayWizard.current(),
        shown: document.getElementById('f-netpay').offsetParent !== null,
        /* 確認の段に居座らせない（送信ボタンの前に立ったままにしない）。 */
        onLast: !document.getElementById('s5').hidden,
        /* 送信ボタンの枠そのものは消さない（5/5 の中身だから）。 */
        blockHidden: document.getElementById('submit-block').hidden,
      };
    });
    ok(JSON.stringify(eb.marked) === JSON.stringify(CLEAR),
       '★B: 空にした3つが全部そのまま赤くなる（1件ずつ押し直させない）',
       `${eb.marked.join(' / ')} 期待 ${CLEAR.join(' / ')}`);
    ok(eb.tags.length === 3 && eb.tags.every((t) => t.length > 0 && t === eb.tags[0]),
       '★B: 3つとも右横に「未入力」の札が出ている', eb.tags.join(' / '));
    ok(eb.focused === CLEAR[0],
       `★B: 先頭の欄まで飛んでいる → ${eb.focused}`, `期待 ${CLEAR[0]}`);
    ok(eb.title.length > 0 && !eb.ul,
       '★B: 見出しの1文は出すが、箇条書きは組まない', eb.title);
    /* ★旧：「押したあと §2〜§4 が全部開く」。1画面1段にしたので、全部を同時には出さない。
       守りたいものは同じ ── 「契約形態を入れて」と言いながら欄が画面に無い、にしない。
       代わりに「先頭の足りない欄のある段まで本人を運んで、その欄を見せている」を見る。 */
    ok(eb.step === 's3' && eb.shown,
       '★B: 先頭の足りない欄のある段まで運び、その欄を画面に出す',
       `${eb.step} / 見えている=${eb.shown}`);
    ok(eb.onLast === false && eb.blockHidden === false,
       '★B: 確認の段からは連れ出す（送信ボタンの前に立ったままにしない）',
       `s5が見えている=${eb.onLast}`);
    ok(seen.length === seenB && stash.length === stashB,
       '★B: 足りないうちは本棚にも預かりにも1行も送らない',
       `${seen.length - seenB} / ${stash.length - stashB}`);

    /* ★埋めた欄の赤はその場で落ちる（直したのに赤いまま、にしない）。
       落とすのは markRequired() ただ1か所なので、1つだけ埋めて残り2つを見る。 */
    await setF({ 'f-netpay': NET_M });
    await new Promise((r) => setTimeout(r, 150));
    const after1 = await page.evaluate(() => [...document.querySelectorAll('.fld.is-miss')]
      .map((f) => (f.querySelector('input, select') || {}).id || ''));
    ok(JSON.stringify(after1) === JSON.stringify(['f-contract', 'f-seniority']),
       '★B: 埋めた欄だけ赤が落ちる（残りはそのまま）', after1.join(' / '));

    /* 通しの続きのために埋め直す。★「全部埋めると赤も札も消える」は、
       このあとの本物の送信（#submit-btn）で確かめる。 */
    await setF({ 'f-contract': SAMPLE['f-contract'],
                 'f-seniority': SAMPLE['f-seniority'] });
    await new Promise((r) => setTimeout(r, 200));
    ok(await nothingMissing(),
       '★B: 埋め直したら足りない必須はゼロ',
       String(await page.evaluate(() => missingAll().map(reqLabel))));
    /* ★このあと本物の送信（#submit-btn）を押すので、確認の段まで戻る。 */
    await page.evaluate(() => { window.PVPayWizard.goLast(); });
    await new Promise((r) => setTimeout(r, 300));
    ok(await vis('submit-block'), '★B: 埋め直すと確認の段へ戻って送信できる');
  }

  /* ── C) 金額の読み方が決まるまで送らない（N-1・2026-09-11）──────────
     ヨーロッパ式に 1.000,00 と書いた人の総支給が 1 になり、年収が REAL PAY の
     常識の幅（$10,000〜$700,000）を外れて**行ごと黙って消えて**いた。
     直したのは「黙って推測しない」ところ ── 2通りに読める入力は欄の下で聞き、
     選ぶまで送信を止める。ここでは**押して**その2つを確かめる。 */
  {
    const gross0 = await fv('f-gross');
    const cur0 = await page.$eval('#f-currency', (el) => el.value);
    const stashB = stash.length, seenB = seen.length;

    await setF({ 'f-gross': '1.000' });
    /* ★欄を離れたことにする。setF は change → input の順に投げるので、
       打鍵中の input が「まだ打っている途中」として二択を畳んでしまう
       （本物のブラウザは input → 離れたときに change の順）。 */
    await page.evaluate(() => {
      document.getElementById('f-gross').dispatchEvent(new Event('change', { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 150));
    await page.evaluate(() => { window.PVPayWizard.goLast(); });
    await new Promise((r) => setTimeout(r, 250));
    await page.evaluate(() => document.getElementById('submit-btn').click());
    await new Promise((r) => setTimeout(r, 300));
    const mb = await page.evaluate(() => {
      const el = document.getElementById('f-gross');
      const box = el.nextElementSibling;
      const has = !!(box && box.classList && box.classList.contains('money-ask'));
      return {
        ask: has,
        btns: has ? Array.prototype.map.call(box.querySelectorAll('.ma-b'), (b) => b.textContent) : [],
        rule: has ? !!box.querySelector('.ma-rule') : false,
        blocked: !!window.moneyBlocker(),
      };
    });
    ok(mb.ask && mb.blocked,
       '★★C: 読み方が2通りある金額のままでは送信できない（黙って推測しない）', JSON.stringify(mb));
    ok(mb.btns.length === 2 && mb.btns.indexOf('1,000') >= 0 && mb.btns.indexOf('1') >= 0,
       '★C: 欄の下に「1,000」と「1」の二択が出る', mb.btns.join(' / '));
    ok(mb.rule, 'C: 入力規則の説明はこの二択の中だけに置く（普通の人の画面に足さない）');
    ok(stash.length === stashB && seen.length === seenB,
       '★★C: 読み方が決まらないうちは、預かりにも本棚にも1行も送らない',
       `${stash.length - stashB} / ${seen.length - seenB}`);

    await page.evaluate(() => {
      const el = document.getElementById('f-gross');
      const box = el.nextElementSibling;
      const b = box && box.querySelectorAll
        ? Array.prototype.find.call(box.querySelectorAll('.ma-b'), (x) => x.textContent === '1,000')
        : null;
      if (b) b.click();
    });
    await new Promise((r) => setTimeout(r, 250));
    const picked = await page.evaluate(() => ({
      v: document.getElementById('f-gross').value,
      blocked: !!window.moneyBlocker(),
    }));
    ok(picked.v === '1,000' && !picked.blocked,
       '★C: 選べばその読み方で確定し、送信も止まらない', JSON.stringify(picked));

    /* ── D) 桁のおかしい金額を、送信の直前に一度だけ確かめる（オーナー承認）──
       ★読み取りの修理の代わりではない（上の C が先に効いている）。
       ★数字そのものでは決めない。通貨と月額／年額を通した年換算で見る。 */
    const amt = () => page.evaluate(() => {
      const b = document.getElementById('amt-confirm');
      return {
        shown: !!b && !b.hidden,
        t: ((b.querySelector('.ac-t') || {}).textContent || '').trim(),
        rows: Array.prototype.map.call(b.querySelectorAll('.ac-d div'), (d) =>
          [d.querySelector('dt').textContent.trim(), d.querySelector('dd').textContent.trim()]),
        fix: !!b.querySelector('#ac-fix'), go: !!b.querySelector('#ac-go'),
      };
    });

    /* D-1 普通の金額には1手も増やさない。 */
    await setF({ 'f-currency': cur0, 'f-gross': gross0 });
    await new Promise((r) => setTimeout(r, 200));
    ok((await page.evaluate(() => amtConfirmNeeded())) === false && !(await amt()).shown,
       '★D: 普通の金額では確認を出さない（通常の入力に操作を増やさない）');

    /* D-2 同じ「54250」でも、通貨が違えば答えが違う。
           ＝数字そのものを見て「異常」と決めていない。 */
    await setF({ 'f-currency': 'JPY' });
    await new Promise((r) => setTimeout(r, 200));
    const low = await page.evaluate(() => amtConfirmNeeded());
    const lowBox = await amt();
    ok(low === true,
       '★★D: 同じ数字でも通貨が違えば確認が出る（数字の桁だけで決めていない）');
    ok(lowBox.rows.length === 2 && lowBox.rows.every((r) => /\d/.test(r[1])),
       '★D: 解釈した「その月の総支給額」と「年換算の総額」を出す',
       lowBox.rows.map((r) => r.join('=')).join(' / '));
    ok(lowBox.rows.every((r) => r[1].indexOf('JPY') >= 0),
       '★D: 選ばれている通貨のまま出す（別の通貨に換算して見せない）',
       lowBox.rows.map((r) => r[1]).join(' / '));
    ok(lowBox.fix && lowBox.go, '★D: 「修正する」と「この金額で提出する」の両方が選べる');
    ok(stash.length === stashB && seen.length === seenB,
       'D: 確認を出しているあいだは1行も送らない',
       `${stash.length - stashB} / ${seen.length - seenB}`);

    /* D-3 「この金額で提出する」で素通りする＝正しい少額も出せる。
       ★ここで本当に送ると、このあとの「1押しで1回だけ預ける」が測れなくなる。
         送信の入口だけ数える形に差し替えて、押されたことを見る。 */
    const went = await page.evaluate(() => {
      const real = window.submitPayReport;
      let n = 0;
      window.submitPayReport = function () { n++; };
      document.getElementById('ac-go').click();
      window.submitPayReport = real;
      return { n: n, hidden: document.getElementById('amt-confirm').hidden };
    });
    ok(went.n === 1 && went.hidden,
       '★★D: 「この金額で提出する」で素通りする（正しい少額を止めない）', JSON.stringify(went));
    ok((await page.evaluate(() => amtConfirmNeeded())) === false,
       '★D: 同じ金額には二度と出さない（押すたびに聞かない）');

    /* 通しの続きのために戻す。 */
    await setF({ 'f-currency': cur0, 'f-gross': gross0 });
    await page.evaluate(() => { document.getElementById('amt-confirm').hidden = true; });
    await new Promise((r) => setTimeout(r, 250));
    ok((await fv('f-gross')) === gross0 && (await page.$eval('#f-currency', (el) => el.value)) === cur0,
       'D: 通貨と総支給を元に戻せている', `${await fv('f-gross')} / ${cur0}`);
    await page.evaluate(() => { window.PVPayWizard.goLast(); });
    await new Promise((r) => setTimeout(r, 300));
  }

  /* ── E) 時間・率のカンマ（2026-09-11 オーナー指摘）──────────────────
     金額と同じ誤変換が、飛行時間・税率・年金率でも起きていた。ただし**直し方は
     金額と違う** ── ここに桁区切りは無い（上限が 200時間・100%・31日・60年）。
     カンマもピリオドも小数点として読む。金額の規則を持ち込むと 5,5 が 55 に
     読める道が戻る。ここではそれが**戻っていない**ことまで見る。 */
  {
    const back = { 'f-block': SAMPLE['f-block'], 'f-tax': SAMPLE['f-tax'],
                   'f-stay': SAMPLE['f-stay'], 'f-seniority': SAMPLE['f-seniority'] };
    const settle = (id) => page.evaluate((i) => {
      document.getElementById(i).dispatchEvent(new Event('change', { bubbles: true }));
    }, id);
    const readNumOf = (id) => page.evaluate((i) => {
      const el = document.getElementById(i);
      return { shown: el.value, sent: val(i), n: num(i),
               blocked: (window.numBlocker() || {}).id || null,
               note: (el.nextElementSibling && el.nextElementSibling.classList
                      && el.nextElementSibling.classList.contains('money-ask'))
                     ? el.nextElementSibling.textContent.trim() : '' };
    }, id);

    /* E-1 85,5 は 85.5。画面・計算・送信の3つとも同じ数になる。 */
    await setF({ 'f-block': '85,5' });
    await settle('f-block');
    const b1 = await readNumOf('f-block');
    ok(b1.shown === '85.5' && b1.sent === '85.5' && b1.n === 85.5 && !b1.blocked,
       '★★E: 飛行時間 85,5 が 85.5 として表示・計算・送信される（855 にならない）',
       JSON.stringify(b1));

    /* E-2 税率 5,5 も 5.5。ここは 0〜100 の中に収まってしまうので、
           直さないと**10倍の値が誰にも気づかれずに保存される**唯一の欄。 */
    await setF({ 'f-tax': '5,5' });
    await settle('f-tax');
    const t1 = await readNumOf('f-tax');
    ok(t1.shown === '5.5' && t1.sent === '5.5' && t1.n === 5.5 && !t1.blocked,
       '★★E: 所得税率 5,5 が 5.5 になる（55% にならない）', JSON.stringify(t1));

    /* E-3 ★金額の規則が漏れていない。1,000 を桁区切りと読めば 1000 時間になるが、
           この欄の上限は 200 ── そもそも 1,000 を「千」のつもりで打つ人は居ない。
           ここでは , は小数点だけを意味するので 1.0 と読む。
           ⚠️ この欄の上限は 31日・60年・200/400時間・100% で、**どれも千に届かない**。
              区切りのうしろの3桁が桁区切りとして成立する欄がひとつも無いから、
              この規則には曖昧さが残らない。金額（1.000 を聞き返す）との違いはそこ。 */
    await setF({ 'f-block': '1,000' });
    await settle('f-block');
    const b2 = await readNumOf('f-block');
    ok(b2.n === 1 && b2.shown === '1' && b2.sent === '1' && !b2.blocked,
       '★★E: 時間の欄で 1,000 を桁区切り（1000時間）と読まない', JSON.stringify(b2));

    /* E-4 上下限が初めて実際に効く（<form> が無いので min / max は飾りだった）。 */
    await setF({ 'f-tax': '500' });
    await settle('f-tax');
    const t2 = await readNumOf('f-tax');
    ok(t2.sent === null && t2.blocked === 'f-tax' && /0/.test(t2.note) && /100/.test(t2.note),
       '★E: 範囲の外（税率 500%）は送らない', JSON.stringify(t2));

    /* E-5 整数の欄の約束は残す。ステイ日数 1,5 を 1.5 日にも 15 日にもしない。 */
    await setF({ 'f-stay': '1,5' });
    await settle('f-stay');
    const s1 = await readNumOf('f-stay');
    ok(s1.n !== 15 && s1.sent === null && s1.blocked === 'f-stay' && s1.note.length > 0,
       '★E: 整数の欄（ステイ日数）は小数を受け取らない・15 にもしない', JSON.stringify(s1));

    /* E-6 0 は空ではない。ここを取り違えると「0 と入れてください」と言いながら
           入れた人を弾く（税率・飛行時間・ステイ日数はどれも 0 がふつうにある）。 */
    await setF({ 'f-stay': '0', 'f-tax': '0', 'f-block': '0' });
    await settle('f-stay'); await settle('f-tax'); await settle('f-block');
    const zero = await page.evaluate(() => ({
      stay: val('f-stay'), tax: val('f-tax'), block: val('f-block'),
      blocked: !!window.numBlocker(),
    }));
    ok(zero.stay === '0' && zero.tax === '0' && zero.block === '0' && !zero.blocked,
       '★E: 0 は「空」ではなく 0 として送る', JSON.stringify(zero));

    /* E-7 送信の直前でも止まる（画面を見ずに送られない）。 */
    await setF({ 'f-block': '85,,5' });
    await settle('f-block');
    const stashE = stash.length, seenE = seen.length;
    await page.evaluate(() => { window.PVPayWizard.goLast(); });
    await new Promise((r) => setTimeout(r, 250));
    await page.evaluate(() => document.getElementById('submit-btn').click());
    await new Promise((r) => setTimeout(r, 300));
    ok(stash.length === stashE && seen.length === seenE,
       '★★E: 読めない時間のままでは、預かりにも本棚にも1行も送らない',
       `${stash.length - stashE} / ${seen.length - seenE}`);

    /* 通しの続きのために戻す。 */
    await setF(back);
    for (const id of Object.keys(back)) await settle(id);
    await new Promise((r) => setTimeout(r, 200));
    ok(!(await page.evaluate(() => !!window.numBlocker())),
       'E: 元に戻せている（このあとの通しを邪魔しない）');
    await page.evaluate(() => { window.PVPayWizard.goLast(); });
    await new Promise((r) => setTimeout(r, 300));
  }

  const pendBefore = (await db.query(`select count(*)::int n from pay_reports_pending`)).rows[0].n;
  await page.click('#submit-btn');
  await new Promise((r) => setTimeout(r, 400));
  ok(await vis('login-gate'), '未ログインで送信するとログインを求める');
  ok((await page.evaluate(() => document.querySelectorAll('.fld.is-miss, .miss-tag').length)) === 0,
     '★B: 必須が全部埋まったら赤も「未入力」の札も残らず、そのまま先へ進む');
  ok(stash.length === 1, `★ログイン前の1押しでサーバへ預ける → ${stash.length} 回`);
  ok(seen.length === 0, `★ログイン前に本棚へは1行も入れない → ${seen.length} 回`);
  ok(await page.evaluate(() => {
    try { return (JSON.parse(localStorage.getItem('pv_pay_claim') || '[]')).length === 1; }
    catch (e) { return false; }
  }), '預かり証を端末に持っている（あとで本人のものへ移すため）');
  const stashed = (await db.query(
    `select count(*)::int n from pay_reports_pending where claimed_at is null`)).rows[0].n - pendBefore;
  ok(stashed === 1, `置き場に1件だけ寝る → ${stashed} 件`);

  /* ★もう一度押しても、置き場に2件目を作らないこと。
     2026-09-01、英語版の給与フォームから出したカンタスのパイロットが12秒差で
     同じ会社・同じ月を2回出し、置き場に2行できた。ログインの箱は送信ボタンの
     すぐ上に出るうえ、押したボタンは元に戻る（送信は成功しているので当然）ので、
     「反応が無かった」と思った人はもう一度押す。
     サーバ側でも畳んでいる（db/pay-report-pending.sql）が、あちらは IP が取れる
     本番でしか働かない枝なので、ここでは端末側のガードを見る。
     ★2026-09-10、そもそも押せなくした（預かったら提出ボタンの行ごと畳む）。
       だから**まず「押せないこと」を見る**。これが本当の直しで、下のガードは
       その後ろに残る保険 ── 別のタブ・遅れて届いた1押し・共有 JS が落ちて
       1枚ものに戻った形態では、まだ2回目が飛びうる。
     ⚠️ page.click は使わない（見えない要素は puppeteer が押せず、
        ガードではなく検査そのものが落ちる）。JS から直に呼んで枝を通す。 */
  ok(!(await page.evaluate(() => {
    const b = document.getElementById('submit-btn');
    return !!(b && b.offsetParent);
  })), '★預かったあとは「匿名で提出する」がもう押せない（二度押しの元を断つ）');
  ok(!!(await page.evaluate(() => !!document.getElementById('submit-btn'))),
     '（前提）提出ボタンは隠すだけで DOM からは消さない');
  await page.evaluate(() => { document.getElementById('submit-btn').click(); });
  await new Promise((r) => setTimeout(r, 400));
  ok(stash.length === 1, `★未ログインでもう一度押しても預けは1回のまま → ${stash.length} 回`);
  const stashed2 = (await db.query(
    `select count(*)::int n from pay_reports_pending where claimed_at is null`)).rows[0].n - pendBefore;
  ok(stashed2 === 1, `★二度押ししても置き場は1件のまま → ${stashed2} 件`);
  ok(await vis('login-gate'), '★二度押しでもログインの箱は出たまま（消えると行き場を失う）');
  const pend = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('pv_pay_pending')); } catch (e) { return null; }
  });
  /* ★預けるのは画面に出ている文字列そのまま（金額は桁区切り入り）。戻すときに
     もう一度整形し直すので二重にはならないし、送るときは val() がカンマを落とす。 */
  ok(!!pend && String(pend['f-base']).replace(/,/g, '') === SAMPLE['f-base'] && !!pend['f-year'],
    '入力は対象月ごと端末に預けられている', JSON.stringify(pend && Object.keys(pend).length));

  // 送信前にページが表示している年換算（クライアント式）
  const liveText = await page.$eval('#live-total', (el) => el.textContent);
  const live = Number(liveText.replace(/[^0-9.]/g, '').replace(/\.$/, ''));

  // セッションを持たせて送り直す（＝ログインから戻ってきた状態）
  /* ★2026-09-10、ここも page.click をやめた。預かったあとは提出ボタンの行ごと
     畳んであるので puppeteer は押せない。**製品もここでは押させない** ──
     登録が済むと afterSignedIn() が呼ばれ、預かり分を引き取れなかったときだけ
     submitPayReport() をこちらから呼ぶ。JS からの click はその1本と同じ枝を通る。 */
  await page.evaluate((uid) => {
    _sb.auth.getSession = async () => ({ data: { session: { user: { id: uid } } } });
  }, UID);
  await page.evaluate(() => { document.getElementById('submit-btn').click(); });
  await page.waitForFunction(
    () => document.getElementById('result-wrap') &&
          document.getElementById('result-wrap').offsetParent !== null,
    { timeout: 15000 },
  ).catch(() => {});
  await new Promise((r) => setTimeout(r, 600));

  ok(seen.length === 1, `本棚へ入れるのは1回だけ → ${seen.length} 回`);
  ok(stash.length === 1, `ログイン後に預かりをもう一度作らない → ${stash.length} 回`);
  ok(other.length === 0, `ほかの RPC は呼ばれない → ${other.join(', ') || 'なし'}`);
  ok(await page.evaluate(() => !localStorage.getItem('pv_pay_pending')),
    '送信が通ったら預けた入力は消える（次回開いたときに二重送信しない）');
  const p = seen[0] || {};
  const d = got[0] || null;
  if (d && d._error) { fail++; console.log(`  ❌ RPC が例外を返した: ${d._error}`); }

  // ── 契約 ①：ページが送るキーを RPC が全部受け取れているか ──────
  const reqd = ['airline', 'position', 'fleet', 'currency', 'period_year', 'period_month'];
  ok(reqd.every((k) => p[k]), `必須6キーが埋まっている`, JSON.stringify(reqd.map((k) => [k, p[k]])));

  /* ── 契約 ①-b：payload のキー集合を固定する ────────────────────
     列も RPC も前からあるのに payload に無い、というだけで7列が一度も
     保存されていなかった（明細画像は保存しないので、その分は復元できない）。
     「送り忘れ」は画面にも RPC のエラーにも出ないので、ここで数える。
     ★キーを増やすときはこの表も足す。減らすときは、なぜ消してよいかを考える。 */
  const KEYS_BEFORE = [   // 手入力で埋まる34キー。1つでも欠けたら静かに壊れる
    'airline', 'airline_other', 'position', 'fleet', 'job_role', 'base_iata',
    'period_year', 'period_month', 'currency', 'base_pay',
    /* 2026-08-26 追加。保証給（Minimum Guarantee などの金額）。
       ★base_pay に足し込まない。日本＝基本給、米国＝保証給が下限で、意味が違う。
       ⚠️ guaranteed_hours（保証**時間**）とは別のキー。 */
    'guarantee_pay',
    'hourly_rate',
    'guaranteed_hours', 'block_hours', 'duty_days', 'per_diem', 'housing_type',
    'housing_amount', 'transport', 'command_pay', 'other_allowance',
    'bonus_annual', 'profit_share_annual', 'pension_pct', 'contract_type',
    'tax_country', 'tax_rate_pct', 'seniority_years', 'lang',
    /* 2026-08-12 追加。かんたん入力の「その月の額面（総支給）」。
       ★base_pay へ入れない（支給構成が「基本給100%」の嘘の図になる）。
       ★2026-08-26、内訳との排他はやめた。両方そのまま送り、年換算は総支給を正とする。 */
    'gross_monthly',
    /* 2026-08-13 追加。手取りと勤務時間は明細専用の隠し欄から普通の欄へ出た
       （手取りは必須・勤務時間は任意）。ステイ日数と今月出たボーナスは新設。 */
    'net_pay_actual', 'duty_hours', 'stay_nights', 'bonus_month',
    /* 2026-08-18 追加。年代（10歳の幅）。年収は年齢とともに上がるので、
       これが無いと「同じ会社の機長」同士が実は入社3年目と定年間際の比較になる。 */
    'age_bucket',
    /* 2026-08-26 追加。役職・区分は**複数**選べるようになった（オーナー指示）。
       job_role（単数）は先頭が入って残る＝過去の行と明細読み取りが壊れない。 */
    'job_roles',
    /* 2026-08-26 追加。変動給・その他の現金手当を行のまま溜める列。
       会社ごとに名前も本数も違うので、固定の欄に潰さずそのまま持つ。 */
    'pay_items',
    /* 2026-08-26 追加（その3）。教官・訓練の手当。
       ★command_pay / flight_variable_pay / other_allowance のどれにも足し込まない。
         足し込むと同じお金を2回数えるうえ、「教官をやると月いくら増えるのか」が
         二度と割り戻せなくなる（オーナー指示の「二重入力させない」の実体）。 */
    'instructor_pay',
    /* 2026-08-26 追加（その4）。審査・査察（Examiner / Check）の手当。
       ★instructor_pay とも別の列。「Instructor / Training 手当とまとめて支給される」を
         選んだ人はここを空のまま出す（額はあちら側に入っている）。 */
    'examiner_pay',
    /* 2026-08-26 追加（その5）。組合・乗員代表（Union / Pilot representative）の手当。
       ★これもまた別の列。支給元が組合のこともあるので、画面が総支給と突き合わせる
         ときだけ条件つきで足す（monthlyDetail）。列と payload は無条件。 */
    'union_pay',
    /* 2026-08-26 追加（その6）。管理・マネジメント（Management / Leadership）の手当。
       ★これもまた別の列。ただし組合と違い、この額は会社が払う＝総支給の中にあるので、
         画面の突き合わせ（monthlyDetail）にも条件なしで足す。 */
    'management_pay',
    /* 2026-08-27 追加（その7）。その他の兼務・配属（Other / Non-Line Assignment）の手当。
       ★これもまた別の列。管理職と同じで、画面の突き合わせ（monthlyDetail）にも
         条件なしで足す（出向先が払っていて明細に載っていないことはあるが、
         聞いていないので分けられない ── 分けるなら組合と同じ形で1問足す）。 */
    'nonline_pay'];
  const KEYS_PAYSLIP = [  // 明細から読めたぶん。手入力では埋まらない
    'ytd_taxable', 'deduction_total', 'night_hours', 'credit_hours',
    /* 2026-08-14 追加。読めた手当を1行ずつそのまま溜める列。画面には出さない。
       ★source より前に置く（下の wrongZero が「手入力では null」の側を
         KEYS_PAYSLIP.slice(0, 5) で数えているため）。 */
    'payslip_detail',
    /* ★2026-08-26、ここは手入力でも埋まるようになった。画面の「変動給」の行の
       合計が入る（other_allowance はその上位＝変動給＋その他の合計）。
       だから wrongZero の側（手入力では null であるべき列）には**入れない**。 */
    'flight_variable_pay',
    'source'];

  const missing = KEYS_BEFORE.concat(KEYS_PAYSLIP).filter((k) => !(k in p));
  ok(missing.length === 0,
     `payload が${KEYS_BEFORE.length + KEYS_PAYSLIP.length}キーを全部送っている`,
     missing.join(','));
  const extra = Object.keys(p).filter((k) => !KEYS_BEFORE.includes(k) && !KEYS_PAYSLIP.includes(k));
  ok(extra.length === 0, `知らないキーが増えていない`, extra.join(','));

  /* ★この画面は手入力。明細は1枚も出していない。
     ・5列は null であること（0 を送ると「深夜0時間・控除0円」という嘘の実データになる）
     ・source は 'web' であること（'payslip' と申告されると出所の意味が消える） */
  const wrongZero = KEYS_PAYSLIP.slice(0, 5).filter((k) => p[k] !== null && p[k] !== undefined);
  ok(wrongZero.length === 0, `★手入力では明細由来の5列を送らない（0 で埋めない）`,
     wrongZero.map((k) => `${k}=${p[k]}`).join(','));
  /* ★変動給の行 → flight_variable_pay、変動給＋その他 → other_allowance。
     この入れ子（flight_variable は other の内訳）は pay-viz.js の支給構成の図が
     前提にしている。逆にすると図が壊れる。 */
  ok(Number(p.flight_variable_pay) === 4000,
     `★変動給の行の合計が flight_variable_pay に入る → ${p.flight_variable_pay}`);
  ok(Number(p.other_allowance) === 4000 + 1000 + Number(SAMPLE['f-other']),
     `★other_allowance は変動給＋その他の合計 → ${p.other_allowance}`,
     `期待 ${4000 + 1000 + Number(SAMPLE['f-other'])}`);
  ok(p.pay_items && Array.isArray(p.pay_items.variable) && p.pay_items.variable.length === 1
     && p.pay_items.variable[0].label === 'Flight Pay',
     '★行そのものは pay_items に形のまま乗る', JSON.stringify(p.pay_items));
  ok(Array.isArray(p.job_roles) && p.job_roles.length >= 1 && p.job_role === p.job_roles[0],
     '★役職・区分は配列で送り、単数には先頭が入る',
     `${JSON.stringify(p.job_roles)} / ${p.job_role}`);
  /* ★教官・訓練の手当（2026-08-26 その3）。金額は専用の列、答えの中身は pay_items。
     すぐ上の flight_variable_pay（4000）と other_allowance（4000+1000+f-other）は
     教官の 600 を入れたあとも1円も増えていない ── それがここの本題。 */
  ok(Number(p.instructor_pay) === 600,
     `★教官の額は専用の列で届く → ${p.instructor_pay}`, '期待 600');
  ok(p.pay_items && p.pay_items.instructor && p.pay_items.instructor.method === 'session'
     && p.pay_items.instructor.trainings.includes('sim'),
     '★何の訓練を・何に対して払われたかは pay_items.instructor に乗る',
     JSON.stringify(p.pay_items && p.pay_items.instructor));
  ok(p.job_roles.includes('instructor'),
     '★役職・区分にも教官が入っている（欄が出た理由と揃っている）',
     JSON.stringify(p.job_roles));
  /* ★審査・査察（2026-08-26 その4）。ここでは審査を選んでいないので、
     列は null・pay_items にも乗らない ── 選んでいない役割を黙って送らない証拠。 */
  ok(p.examiner_pay === null || p.examiner_pay === undefined,
     `★審査を選んでいないので examiner_pay は空 → ${p.examiner_pay}`);
  ok(!(p.pay_items && p.pay_items.examiner),
     '★選んでいない役割は pay_items にも乗らない');
  /* ★組合・乗員代表（2026-08-26 その5）。ここでも選んでいないので同じ。 */
  ok(p.union_pay === null || p.union_pay === undefined,
     `★組合を選んでいないので union_pay は空 → ${p.union_pay}`);
  ok(!(p.pay_items && p.pay_items.union),
     '★選んでいない役割（組合）も pay_items に乗らない');
  /* ★管理・マネジメント（2026-08-26 その6）。ここでも選んでいないので同じ。 */
  ok(p.management_pay === null || p.management_pay === undefined,
     `★管理職を選んでいないので management_pay は空 → ${p.management_pay}`);
  ok(!(p.pay_items && p.pay_items.management),
     '★選んでいない役割（管理職）も pay_items に乗らない');
  /* ★その他の兼務・配属（2026-08-27 その7）。ここでも選んでいないので同じ。 */
  ok(p.nonline_pay === null || p.nonline_pay === undefined,
     `★兼務・配属を選んでいないので nonline_pay は空 → ${p.nonline_pay}`);
  ok(!(p.pay_items && p.pay_items.nonline),
     '★選んでいない役割（兼務・配属）も pay_items に乗らない');
  /* 逆に、人が入れた欄はそのまま届いていること */
  ok(p.stay_nights === SAMPLE['f-stay'] && p.bonus_month === SAMPLE['f-bonus-mo']
     && p.net_pay_actual === SAMPLE['f-netpay'] && p.duty_hours === SAMPLE['f-duty-h'],
     `★手入力のステイ日数・今月のボーナス・手取り・勤務時間が届く`,
     `${p.stay_nights} / ${p.bonus_month} / ${p.net_pay_actual} / ${p.duty_hours}`);
  ok(p.source === 'web', `★手入力の出所は 'web'（'payslip' を騙らない） → ${p.source}`);

  // ── 契約 ②：クライアント式とサーバ式が同じ額を出すか（式の二重管理）──
  const row = await db.query(
    `select annual_total_orig, currency, gross_monthly, base_pay, block_hours, fleet_cat, job_role,
            housing_type, housing_amount, seniority_years, tax_country, nationality, lang
       from pay_reports order by created_at desc limit 1`);
  const r = row.rows[0] || {};
  ok(Number(r.annual_total_orig) === live,
     `ライブ計算とサーバ計算が一致 → 画面 ${live} / DB ${r.annual_total_orig}`);

  // ── 契約 ③：原本が原本のまま保存されているか ─────────────────
  ok(r.currency === 'AED', `原本通貨のまま → ${r.currency}`);
  ok(Number(r.base_pay) === 48500, `基本給が原本のまま → ${r.base_pay}`);
  /* ★2026-08-26、総支給と内訳は両方そのまま残る（オーナー指示）。
     年換算は総支給を正とする（pv_annual_total の coalesce の第1引数）ので、
     両方あっても二重に数えない。上の「ライブ計算とサーバ計算が一致」がそれを見ている。
     ★ここが null に戻ったら、内訳を書いた人の総支給が捨てられている。 */
  ok(p.gross_monthly === GROSS_M,
     `★内訳を開いていても総支給はそのまま送る → ${JSON.stringify(p.gross_monthly)}`);
  ok(Number(r.gross_monthly) === Number(GROSS_M),
     `内訳の行にも総支給が残る → ${r.gross_monthly}`, `期待 ${GROSS_M}`);
  ok(Number(r.block_hours) === 86.5, `block hours が原本のまま → ${r.block_hours}`);
  ok(r.fleet_cat === 'w', `fleet_cat が語彙から自動で入る → ${r.fleet_cat}`);
  ok(r.housing_type === 'allowance' && Number(r.housing_amount) === 17500,
     `住居が現金手当として保存 → ${r.housing_type} / ${r.housing_amount}`);
  ok(r.tax_country === 'AE', `居住国が保存されている → ${r.tax_country}`);
  /* 国籍は聞かないので必ず NULL。ここが 'GB' に戻ったら、どこかで欄が復活している。 */
  ok(r.nationality === null, `国籍は保存しない（欄を廃止した）→ ${r.nationality}`);
  ok(r.lang === lang, `lang がページの言語で入る → ${r.lang}`);

  // ── 契約 ④：返り値のキーをページが読めているか ────────────────
  ok(d && d.ok === true, `RPC が ok を返す`, JSON.stringify(d && Object.keys(d)));
  ok(d && d.annual_total_usd != null, `USD 換算が返る → ${d && d.annual_total_usd}`);
  ok(d && d.usd_per_block_hour != null, `$/block hour が返る → ${d && d.usd_per_block_hour}`);
  ok(d && d.access_until, `解放期限が返る → ${d && d.access_until}`);

  // 画面に実際に描かれた文字で確かめる（キー名だけ合っていても描画で落ちる）
  const shown = await page.$eval('#result-wrap', (el) => el.innerText).catch(() => '');
  ok(/block hour/i.test(shown), `結果パネルに $/block hour が描かれている`);
  ok(!/NaN|undefined|\[object/.test(shown), `結果パネルに NaN/undefined が無い`,
     shown.slice(0, 200));

  /* 描かれた文字が「読めるか」まで見る。
     以前ここは <b style="color:#e8edf2"> とダーク用の色を直書きしており、
     インラインは [data-theme="light"] より詳細度が高いので上書きできず、
     既定のライトテーマで白い面に白い字になっていた。
     アサーションはすべて通るのに、いちばん読ませたい一文だけが消える種類の不具合。 */
  const contrast = await page.evaluate(() => {
    const parse = (c) => {
      const n = (c.match(/[\d.]+/g) || [0, 0, 0]).map(Number);
      return { r: n[0], g: n[1], b: n[2], a: n[3] === undefined ? 1 : n[3] };
    };
    /* 半透明を潰さずに実際の見た目の色を出す。
       .bench の背景は rgba(0,0,0,.02) ＝ ほぼ透明で、
       アルファを捨てて「黒」と読むと読める文字まで読めない判定になる。 */
    const flatten = (el) => {
      const stack = [];
      for (let n = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c.a > 0) stack.push(c);
        if (c.a >= 1) break;
      }
      if (!stack.length || stack[stack.length - 1].a < 1) stack.push({ r: 255, g: 255, b: 255, a: 1 });
      let out = stack.pop();
      while (stack.length) {
        const t = stack.pop();
        out = { r: t.r * t.a + out.r * (1 - t.a),
                g: t.g * t.a + out.g * (1 - t.a),
                b: t.b * t.a + out.b * (1 - t.a), a: 1 };
      }
      return out;
    };
    const lum = ({ r, g, b }) => {
      const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    return [...document.querySelectorAll('#result-wrap b, #result-wrap strong')].map((el) => {
      const bg = flatten(el.parentElement);
      const fg0 = parse(getComputedStyle(el).color);
      const fg = { r: fg0.r * fg0.a + bg.r * (1 - fg0.a),
                   g: fg0.g * fg0.a + bg.g * (1 - fg0.a),
                   b: fg0.b * fg0.a + bg.b * (1 - fg0.a) };
      const a = lum(fg), b = lum(bg);
      return { text: el.textContent.slice(0, 28),
               ratio: +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2)) };
    });
  });
  const theme = await page.evaluate(() => document.documentElement.dataset.theme || '(既定)');
  ok(contrast.length > 0, `結果パネルに強調語がある（${theme}）`);
  for (const c of contrast) {
    ok(c.ratio >= 4.5, `強調語が読める（${theme}）「${c.text}」コントラスト比 ${c.ratio}`);
  }

  /* 2回目以降＝プリセットが残っている人。金額は前回の値で戻るが、段は飛ばさない。
     ★プリセットは対象月と飛んだ時間を保存しない（毎月変わる値だから）。
     ★2026-09-08、1画面1段になった。「下の段がまとめて出る」形は無くなったので、
       ここで見るのは同じ2つを別の言い方で：
         ① 前回の値は入ったまま出てくる（＝入力する数が減っている）
         ② その月にしか無い値（飛んだ時間・手取り・今月のボーナス）は空のままで、
            埋めるまで次の段へ進めない（先月の値が黙って今月の実データにならない） */
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 900));
  /* ★入口の2択は2回目以降も毎回出す（2026-08-13 オーナー決定）。
     前回の内容がこの端末に残っている人には、そのことを「手で入力」側に添える。 */
  ok(await vis('entry'), '2回目の訪問でも入口の2択から始まる');
  ok(await vis('entry-prev'), '★前回の内容が残っていることを「手で入力」側に書く');
  await page.click('#entry-manual');
  await new Promise((r) => setTimeout(r, 300));
  /* ★2026-09-12（オーナー決定2）2回目以降は「① 今月の入力 → ② 確認」の2画面。
       会社・契約を毎月通り直させない。
     ⚠️ 段の数は**画面に聞く**。ここで 5 を決め打ちすると、2画面の道では
        存在しない段を叩いて「進めない」と読み、初回の段は測り落とす。 */
  const nStep = await page.evaluate(() => window.PVPayWizard.count());
  ok(nStep === 2, '★前回の内容がある人は2画面で終わる（今月の入力 → 確認）', String(nStep));
  ok((await page.evaluate(() => window.PVPayWizard.current())) === 's2',
     '★1画面目は「今月の入力」');
  for (const id of ['s1', 's2', 's3', 's4']) {
    ok(await vis(id), `★1画面目に会社・対象月・報酬・契約が同居している（#${id}）`);
  }
  ok(!(await vis('s5')), '★確認はまだ出さない（押す物は最後の1つ）');
  ok(!(await vis('submit-block')), '★1画面目からは送れない（送信の口は確認の中だけ）');
  ok(await page.$eval('#restore-bar', (el) => el.offsetParent !== null), '復元したことを知らせている');
  /* ★会社・職位は要約1行に畳むが、値は入ったまま（打ち直させない）。 */
  ok((await fv('f-airline')) === SAMPLE['f-airline'] && (await fv('f-position')) === SAMPLE['f-position'],
     '★前回の会社と職位が入ったまま出てくる',
     `${await fv('f-airline')} / ${await fv('f-position')}`);
  ok(await page.$eval('#s1-body', (el) => el.hidden)
     && await page.$eval('#s1-sum', (el) => !el.hidden),
     '★会社と職務は要約1行に畳んである（毎月読み直させない）');
  ok(await page.$eval('#s4-body', (el) => el.hidden)
     && await page.$eval('#s4-sum', (el) => !el.hidden),
     '★契約と納税地も畳んである');
  /* ★畳んでも「変更する」で開ける（畳む＝隠すではない）。 */
  await page.click('#s1-edit');
  await new Promise((r) => setTimeout(r, 150));
  ok(!(await page.$eval('#s1-body', (el) => el.hidden)),
     '★「変更する」を押せばその場で開く（最初からやり直させない）');

  /* ★その月にしか無い値（CARRY.never）は、前回の額でも 0 でも埋めない。
     埋まっていると、先月の実績が今月の実データとして黙って送られる。 */
  const NEVER6 = ['f-block', 'f-stay', 'f-gross', 'f-netpay', 'f-perdiem', 'f-bonus-mo'];
  const vals6 = {};
  for (const id of NEVER6) vals6[id] = await fv(id);
  ok(NEVER6.every((id) => vals6[id] === ''),
     '★飛んだ時間・ステイ日数・総支給・手取り・パーディアム・今月の賞与は前回の値でも 0 でも埋めない',
     NEVER6.map((id) => `${id}=${vals6[id] === '' ? '空' : vals6[id]}`).join(' / '));
  await goNext();
  ok((await page.evaluate(() => window.PVPayWizard.current())) === 's2',
     '★今月の実績が空のままでは確認へ進めない');
  /* ★ステイ日数は任意（決定5）なので、ここでは入れずに進む。
     それでも進めることと、空が 0 に化けないことを下で見る。 */
  bad.push(...await setF({ 'f-block': SAMPLE['f-block'], 'f-gross': GROSS_M, 'f-netpay': NET_M,
                           'f-perdiem': '6200', 'f-bonus-mo': '0' }));
  await new Promise((r) => setTimeout(r, 150));
  await goNext();
  ok((await page.evaluate(() => window.PVPayWizard.current())) === 's5' && (await submitOn()),
     '★今月の分だけ入れれば確認まで行ける（会社・契約は前回のまま）');
  ok((await fv('f-stay')) === '',
     '★任意のステイ日数は空のまま確認まで来る（0 を入れて埋めない）', await fv('f-stay'));
  ok((await fv('f-bonus-mo')) === '0',
     '★本人が入れた 0 は 0 のまま残る（未回答に戻さない）', await fv('f-bonus-mo'));
  // 復元が生きていること（段だけ出て金額が空なら「30秒で終わる」が嘘になる）
  ok((await fv('f-base')) === SAMPLE['f-base'],
     `前回の基本給が入ったまま出てくる → ${await fv('f-base')}`, `期待 ${SAMPLE['f-base']}`);
  ok((await fv('f-currency')) === SAMPLE['f-currency'],
     `前回の通貨が入ったまま出てくる → ${await fv('f-currency')}`);
  /* ★2026-08-26、額面も普通にプリセットへ入る。内訳の合計を映していた欄ではなく、
     いつでも本人が手で入れた数字になったため。 */
  ok(await page.$eval('#pay-detail', (el) => el.open),
     '内訳で入れた人は内訳側が開いた状態で戻る');
  /* ★2026-09-12：額面は CARRY.never ＝ 引き継がない（上で今月の額を手で入れた）。
     戻ってくるのは「契約で決まっていて毎月同じ額」の側だけ。
     ★引き継いだ欄には印が付く（確認画面が「前回から引き継ぎ」と出すのはこれ1つ）。 */
  ok(await page.$eval('#f-base', (el) => el.classList.contains('pv-carried')),
     '★引き継いだ基本給には「前回から引き継ぎ」の印が付く');
  ok(!(await page.$eval('#f-base', (el) => el.classList.contains('ai-filled'))),
     '★引き継ぎに「明細から読み取り」の緑枠は付かない（本人に嘘をつかない）');
  ok(!(await page.$eval('#f-gross', (el) => el.readOnly)),
     '戻ってきた額面も自分で入れられる');

  await page.screenshot({ path: path.join(OUT, `${lang}-result.png`), fullPage: true });
  console.log(`  → temporary screenshots/pay-contract/${lang}-result.png`);

  // 次の言語のために同一人物の同一月を避ける（別ユーザー扱いにする）
  await db.query(`select set_config('pv.uid', $1, false)`,
    ['00000000-0000-4000-8000-0000000000c2']);
  await page.close();
}

/* ══ 明細から読めた内訳が、列まで届いているか（2026-08-14）═══════════
   payslip.js が hidden 欄 #f-psdetail に JSON を入れる → ページが素通しで送る
   → RPC が検品して payslip_detail 列に入れる。この一本道を実ページで通す。

   ★画面には1文字も出ない経路なので、目視では絶対に気づけない。
     hidden の追加／ALL_IDS／payload の1行／RPC の受け取り のどれか1つが
     欠けただけで、読めた内訳は黙って捨てられる。しかも**遡って集められない**。
   ★val() を通していないことも、ここで初めて分かる（unc() がカンマを全部
     落とすので、通すと JSON が壊れて RPC 側が丸ごと捨てる）。 */
console.log('\n明細の内訳（hidden → RPC → payslip_detail 列）');
{
  const DETAIL = {
    v: 1,
    earnings: [
      { label: '基本給', amount: 480000, kind: 'base' },
      { label: '変動付加乗務手当', amount: 148200, kind: 'flight_variable' },
      { label: '深夜割増', amount: 23400, kind: 'flight_variable' },
    ],
    unmapped: [{ label: '特別加算', amount: 12000 }],
    hours: [{ label: '深夜時間', value: 12, kind: 'night' }],
    gross_printed: 663600,
    currency: 'JPY',
    checks: { gross: 'ok', net: 'ok', diff: 0 },
  };

  const page = await newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  page.on('pageerror', (e) => { fail++; console.log(`  ❌ ページ例外: ${e.message}`); });
  await page.goto('http://localhost:3000/pay-report.html',
    { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 800));

  /* ★ここはログイン済みで始める。だから通るのは本棚入れの口だけで、
     預かりの口（submit_pay_report_pending）は1度も鳴らないのが正しい。 */
  const sent = [];
  const sentOther = [];
  await page.exposeFunction('__pvRpc', async (fn, args) => {
    if (fn !== 'submit_pay_report') {
      if (READ_OK.indexOf(fn) < 0) sentOther.push(fn);
      return { data: { ok: true }, error: null };
    }
    sent.push((args || {}).p);
    const r = await db.query(`select submit_pay_report($1::jsonb) r`, [JSON.stringify(args.p)]);
    return { data: r.rows[0].r, error: null };
  });
  await page.evaluate((uid) => {
    _sb.rpc = (fn, args) => window.__pvRpc(fn, args || {});
    _sb.auth.getSession = async () => ({ data: { session: { user: { id: uid } } } });
  }, '00000000-0000-4000-8000-0000000000c3');
  await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`,
    ['00000000-0000-4000-8000-0000000000c3', 'detail@example.com']);
  await db.query(`select set_config('pv.uid', $1, false)`, ['00000000-0000-4000-8000-0000000000c3']);

  const set = (o) => page.evaluate((obj) => {
    for (const [id, v] of Object.entries(obj)) {
      const el = document.getElementById(id);
      if (!el) throw new Error(`${id} が無い`);
      el.value = v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, o);

  await page.click('#entry-manual');
  await new Promise((r) => setTimeout(r, 250));
  await set({
    'f-airline': 'zipair', 'f-position': 'cap', 'f-fleet': 'a380', 'f-jobrole': 'line',
    'f-age': '40-49', 'f-block': '72.4', 'f-stay': '9', 'f-currency': 'JPY', 'f-gross': '663600',
    'f-netpay': '512000', 'f-bonus-mo': '0', 'f-perdiem': '38000',
    'f-housing': 'none', 'f-contract': 'direct', 'f-taxcountry': 'JP', 'f-seniority': '14',
  });
  await new Promise((r) => setTimeout(r, 250));

  /* payslip.js が入れる形をそのまま入れる（この2つは明細を読んだときだけ埋まる） */
  await set({ 'f-source': 'payslip', 'f-psdetail': JSON.stringify(DETAIL) });

  /* ★送信ボタンは 5/5（確認）の中にある。値は上でまとめて入れてあるので、
     段を1つずつ押さずに最後まで運ぶ（ここで見たいのは hidden の一本道）。 */
  await page.evaluate(() => { if (window.PVPayWizard) window.PVPayWizard.goLast(); });
  await new Promise((r) => setTimeout(r, 400));
  await page.click('#submit-btn');
  await page.waitForFunction(
    () => document.getElementById('result-wrap') &&
          document.getElementById('result-wrap').offsetParent !== null,
    { timeout: 15000 },
  ).catch(() => {});
  await new Promise((r) => setTimeout(r, 600));

  ok(sent.length === 1, `本棚へ入れるのは1回だけ → ${sent.length} 回`);
  ok(sentOther.length === 0,
     `ログイン済みなら預かりの口は通らない → ${sentOther.join(', ') || 'なし'}`);
  const p = sent[0] || {};
  ok(typeof p.payslip_detail === 'string' && p.payslip_detail === JSON.stringify(DETAIL),
     '★ページは hidden の中身を1文字も変えずに送る（val() を通していない）',
     String(p.payslip_detail).slice(0, 120));

  const col = (await db.query(
    `select payslip_detail d, source s from pay_reports order by created_at desc limit 1`)).rows[0] || {};
  const d = col.d;
  ok(col.s === 'payslip', `出所が 'payslip' で入る → ${col.s}`);
  ok(!!d, '★payslip_detail 列に内訳が入っている（列も RPC の受け取りも生きている）');
  ok(d && d.earnings && d.earnings.length === 3,
     `支給の3行がそのまま残る → ${d && d.earnings && d.earnings.length}`);
  /* ★これが今回いちばん欲しかったもの。「深夜手当がいくらか」は画面のどこにも
     出ないが、行として残っていれば、あとで欄を分けたときに遡って埋まる。 */
  const night = (d && d.earnings || []).find((e) => e.label === '深夜割増');
  ok(!!night && night.amount === 23400,
     `★深夜割増が金額つきで1行残る → ${night && night.amount}`);
  ok(d && d.unmapped && d.unmapped[0] && d.unmapped[0].label === '特別加算',
     '分類できなかった行も残る（語彙を実績で足すための材料）');
  ok(d && d.hours && d.hours[0] && Number(d.hours[0].value) === 12,
     '時間の行も残る');
  ok(d && d.checks && d.checks.gross === 'ok',
     '★検算の結果も残る（本物の明細での「黙って外した率」を測る唯一の道）');
  ok(d && Number(d.gross_printed) === 663600, `印字されていた支給合計が残る → ${d && d.gross_printed}`);
  await page.close();

  /* ── 検品：ここを緩めると、ログイン利用者が好きなものを好きなだけ入れられる ──
     ★どれも「内訳だけ落として投稿は通す」。内訳の不備で明細1枚が
       丸ごと無駄になるのがいちばん損。 */
  const base = {
    airline: 'zipair', position: 'cap', fleet: 'a380', currency: 'JPY',
    period_year: 2026, period_month: 3, base_pay: 480000, block_hours: 72.4,
    housing_type: 'none', contract_type: 'direct', tax_country: 'JP', lang: 'ja',
  };
  const via = async (detail, month) => {
    const r = await db.query(`select submit_pay_report($1::jsonb) r`,
      [JSON.stringify(Object.assign({}, base, { period_month: month, payslip_detail: detail }))]);
    const row = await db.query(
      `select payslip_detail d from pay_reports order by created_at desc limit 1`);
    return { ok: r.rows[0].r && r.rows[0].r.ok === true, d: row.rows[0].d };
  };

  const broken = await via('{"earnings":[{"label":"基本給",', 3);
  ok(broken.ok && broken.d === null,
     '★壊れた JSON は内訳だけ捨てて、投稿そのものは通す', JSON.stringify(broken.d));

  const huge = await via(JSON.stringify({
    v: 1, earnings: Array.from({ length: 400 }, (_, i) => ({ label: `行${i}`, amount: i, kind: 'other' })),
  }), 4);
  ok(huge.ok && huge.d === null, '★8KB を超える内訳は捨てる（膨らませられない）',
     JSON.stringify(huge.d && Object.keys(huge.d)));

  const junk = await via(JSON.stringify({
    v: 1, earnings: [{ label: '基本給', amount: 480000, kind: 'base' }],
    deductions: [{ label: '組合費', amount: 4200 }], note: 'x'.repeat(50),
  }), 5);
  ok(junk.ok && junk.d && !('deductions' in junk.d) && !('note' in junk.d),
     '★知らないキーは組み直しで落ちる（控除の内訳は入り得ない）',
     JSON.stringify(junk.d && Object.keys(junk.d)));

  const shell = await via(JSON.stringify({ v: 1, currency: 'JPY' }), 6);
  ok(shell.ok && shell.d === null, '中身の無い殻は溜めない', JSON.stringify(shell.d));

  const none = await via(null, 7);
  ok(none.ok && none.d === null, '手入力（内訳なし）では列は null のまま', JSON.stringify(none.d));
}

/* ══ 明細1枚が REAL PAY に出るまで（2026-09-11）═══════════════════
   オーナーの依頼「PDF・画像のアップロードがちゃんと機能しているか、
   マイレポートや REAL PAY に反映されているか監査して欲しい」への、恒久の答え。

   端から端まで1本で通す ──
     入口で「明細から自動入力」を選ぶ → PDF を落とす → 黒塗りの確認 → 送る
     → 読み取り結果がフォームに入る → 5/5 で送信 → pay_reports の行
     → my_pay_reports（マイページ）→ pv_pay_rows（REAL PAY の一覧）

   ★ここまで通す検査が1本も無かった。db/test-payslip-redact.mjs は本物の
     payslip.js を回すが**一度も送信しない**し、この検査は送信するが
     **明細を1枚も通していなかった**。間のつなぎ目だけが無人だった。

   ★同時に「下書きが明細の値を黙って上書きする」を固定する（2026-09-11 に修理）。
     入口で明細を選んだ人は、読み取りが終わった瞬間に PVEnterMode('manual') で
     ウィザードが走り出し、そこで**先月の下書き**が復元される。順番の都合で、
     いま明細から入れた数字がその場で先月の値へ戻っていた。
     ⚠️ 緑枠（.ai-filled）は外れないので、画面は「明細から読み取りました」と
        言い続ける＝**画面はいつもどおり動いたまま**、先月の総支給が
        マイページにも REAL PAY にも入る。目でも他の検査でも気づけない。
     ⚠️ 直し方を「.ai-filled の付いた欄を守る」に読み替えないこと。writeHidden は
        あの印を付けない（控除合計・年初来・出所など）。守る対象は payslip.js の
        window.PVPayslipFilled() が返す Set で、書いた関数自身が記録している。

   ★偽の解析結果は**本物の index.ts に通してから**返す（写経した複製ではない）。
     だから en の周は、カンマを小数点に使う国の書き方（"8.450,00"）を
     そのまま流し込める＝⑤がサーバ側で効いていることを実ページで確認できる。

   ★OCR は回らないこと（ocrFetched）まで見る。文字の層のある PDF を選んで
     あるので、回れば 40 秒級になり、この検査を SOLO へ追い出す羽目になる。
     将来この PDF が文字層を失ったら、遅くなる前にここが赤くなる。 */
console.log('\n明細1枚が REAL PAY に出るまで（＋下書きが上書きしない）');
{
  const FN = '/functions/v1/parse-payslip';
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  /* ★文字の層を持つ PDF。OCR に落ちない＝40秒の綱渡りが無い。 */
  const PDF = path.join(ROOT, 'db/fixtures/payslip-pdf-gulf.pdf');
  /* モデルの生の出力を、本番と同じ順序でサーバ側の実装に通す。 */
  const srv = (raw) => {
    const p = sanitize(raw);
    return { ok: true, result: applyChecks(p, reconcile(p)) };
  };
  const num = (v) => Number(String(v == null ? '' : v).replace(/[^0-9.-]/g, ''));

  const CASES = [{
    tag: 'ja',
    url: 'http://localhost:3000/pay-report.html',
    uid: '00000000-0000-4000-8000-0000000000c4',
    /* 先月の下書き。明細が入れる欄は**1つ残らずわざと違う値**にしてある
       （同じ値だと「守れた」のか「たまたま一致した」のか区別できない）。 */
    draft: {
      'f-airline': 'jal', 'f-position': 'cap', 'f-fleet': 'b777', 'f-jobrole': 'line',
      'f-age': '40-49', 'f-stay': '9', 'f-bonus-mo': '0', 'f-housing': 'none',
      'f-contract': 'direct', 'f-taxcountry': 'JP', 'f-seniority': '14',
      'f-currency': 'USD', 'f-gross': '111111', 'f-base': '222222', 'f-netpay': '333333',
      'f-block': '55.5', 'f-perdiem': '38000', 'f-year': '2026', 'f-month': '3',
      'f-source': 'manual',
      'f-payitems': JSON.stringify({
        v: 1, fixed_none: false, guarantee_none: false, variable_none: false,
        variable: [{ amount: 99999, label: '先月の変動給', basis: 'duty' }], other: [],
      }),
    },
    raw: {
      currency: 'JPY', period: { year: 2026, month: 7 },
      earnings: [
        { label: '基本給', amount: 420000, kind: 'base' },
        { label: '変動付加乗務手当', amount: 148200, kind: 'flight_variable', basis: 'block' },
        { label: '深夜割増', amount: 23400, kind: 'flight_variable', basis: 'night' },
        { label: '日当（非課税）', amount: 42000, kind: 'per_diem' },
      ],
      hours: [{ label: '乗務時間', value: 78.2, kind: 'block' }],
      gross_total: 633600, deductions_total: 121600, net_pay: 512000,
      unmapped: [], confidence: 'high',
    },
    /* 明細から入るべき欄（下書きに勝つ側）。 */
    want: {
      'f-currency': 'JPY', 'f-gross': '633600', 'f-base': '420000', 'f-netpay': '512000',
      'f-block': '78.2', 'f-perdiem': '42000', 'f-year': '2026', 'f-month': '7',
      'f-source': 'payslip',
    },
    /* 明細が触らない欄（下書きから来てよい側）。 */
    keep: { 'f-airline': 'jal', 'f-contract': 'direct', 'f-taxcountry': 'JP',
            'f-seniority': '14', 'f-stay': '9' },
    rows: [{ amount: 148200, basis: 'block' }, { amount: 23400, basis: 'night' }],
    db: { airline: 'jal', gross: 633600, currency: 'JPY' },
  }, {
    tag: 'en',
    url: 'http://localhost:3000/en/pay-report.html',
    uid: '00000000-0000-4000-8000-0000000000c5',
    draft: {
      'f-airline': 'lufthansa', 'f-position': 'fo', 'f-fleet': 'a320', 'f-jobrole': 'line',
      'f-age': '30-39', 'f-stay': '7', 'f-bonus-mo': '0', 'f-housing': 'none',
      'f-contract': 'direct', 'f-taxcountry': 'DE', 'f-seniority': '6',
      'f-currency': 'USD', 'f-gross': '111111', 'f-base': '222222', 'f-netpay': '333333',
      'f-block': '55.5', 'f-perdiem': '38000', 'f-year': '2026', 'f-month': '3',
      'f-source': 'manual',
      'f-payitems': JSON.stringify({
        v: 1, fixed_none: false, guarantee_none: false, variable_none: false,
        variable: [{ amount: 99999, label: 'Last month', basis: 'duty' }], other: [],
      }),
    },
    /* ★金額を**明細の表記のまま文字列で**返す。ドイツ・フランス・オランダ…は
       「.」が桁区切りで「,」が小数点。2026-09-11 まで、サーバは数字以外を
       全部落として parseFloat していたので 8.450,00 が 8.45000 ＝ **1/1000** に
       なっていた。全行が同じ倍率でずれるので検算（支給合計・手取り）は両方
       成立し、confidence も high のまま画面に出ていた。 */
    raw: {
      currency: 'EUR', period: { year: 2026, month: 7 },
      earnings: [
        { label: 'Basic salary', amount: '5.200,00', kind: 'base' },
        { label: 'Sector pay', amount: '2.150,50', kind: 'flight_variable', basis: 'sector' },
        { label: 'Per diem', amount: '1.099,50', kind: 'per_diem' },
      ],
      hours: [{ label: 'Block hours', value: 78.2, kind: 'block' }],
      gross_total: '8.450,00', deductions_total: '1.450,00', net_pay: '7.000,00',
      unmapped: [], confidence: 'high',
    },
    want: {
      'f-currency': 'EUR', 'f-gross': '8450', 'f-base': '5200', 'f-netpay': '7000',
      'f-block': '78.2', 'f-perdiem': '1099.5', 'f-year': '2026', 'f-month': '7',
      'f-source': 'payslip',
    },
    keep: { 'f-airline': 'lufthansa', 'f-contract': 'direct', 'f-taxcountry': 'DE',
            'f-seniority': '6', 'f-stay': '7' },
    rows: [{ amount: 2150.5, basis: 'sector' }],
    db: { airline: 'lufthansa', gross: 8450, currency: 'EUR' },
  }];

  for (const c of CASES) {
    console.log(`  ── ${c.tag}`);
    const FAKE = srv(c.raw);
    const page = await newPage();
    await page.setViewport({ width: 1440, height: 1200 });
    page.on('pageerror', (e) => { fail++; console.log(`  ❌ [${c.tag}] ページ例外: ${e.message}`); });

    let posted = 0, ocrFetched = false;
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = req.url();
      if (/tesseract/i.test(u)) ocrFetched = true;
      if (!u.includes(FN)) return req.continue();
      if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS, body: '' });
      posted++;
      req.respond({ status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
                    body: JSON.stringify(FAKE) });
    });

    await page.goto(c.url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    /* ★「先月の下書き」を置いてから開き直す。uid は 'anon'（未ログインで書きかけた人）。
       ownsDraft() は「見ている人も匿名なら14日そのまま戻す」ので、これで
       入口の2択を抜けた瞬間に復元が走る状態になる。 */
    await page.evaluate((f) => localStorage.setItem('pv_pay_draft', JSON.stringify(
      { v: 1, uid: 'anon', step: 's3', ts: Date.now(), tab: '', fields: f })), c.draft);
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 800));

    const sent = [], sentOther = [];
    await page.exposeFunction('__pvRpc', async (fn, args) => {
      if (fn !== 'submit_pay_report') {
        if (READ_OK.indexOf(fn) < 0) sentOther.push(fn);
        return { data: { ok: true }, error: null };
      }
      sent.push((args || {}).p);
      await db.query(`select set_config('pv.uid', $1, false)`, [c.uid]);
      const r = await db.query(`select submit_pay_report($1::jsonb) r`, [JSON.stringify(args.p)]);
      return { data: r.rows[0].r, error: null };
    });
    await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`,
      [c.uid, `${c.tag}-e2e@example.com`]);
    /* ★送信のときだけログイン済みにする（読み込みの時点では未ログイン＝匿名の
       下書きが戻る側）。submit は押した瞬間に session を読み直すので、これで
       「匿名で書きかけ → 明細を落とす → ログイン済みで送る」が1本で通る。 */
    await page.evaluate((uid) => {
      _sb.rpc = (fn, args) => window.__pvRpc(fn, args || {});
      _sb.auth.getSession = async () => ({ data: { session: { user: { id: uid } } } });
    }, c.uid);

    // ── 入口で「明細から自動入力」を選ぶ（この道の人だけが踏んでいた）──
    await page.click('#entry-payslip');
    await page.waitForFunction(() => {
      const n = document.getElementById('ps');
      return !!n && !n.hidden && n.offsetHeight > 0;
    }, { timeout: 10000 });

    const input = await page.$('#ps-file');
    await input.uploadFile(PDF);
    await page.waitForSelector('.ps-edit', { timeout: 40000 });
    /* ★時間で待たない。黒塗りを探し終わって「送る」に手が届いた瞬間を条件で待つ。 */
    await page.waitForFunction(() => {
      const b = document.getElementById('ps-confirm');
      return !!b && !b.disabled;
    }, { timeout: 60000 });
    await page.click('#ps-confirm');
    await page.click('#ps-send');
    /* 読み取り結果のパネルが出る＝apply() が最後まで走った（この中で
       PVEnterMode('manual') → WZ.start() → 下書きの復元まで済んでいる）。 */
    await page.waitForFunction(() => !!document.querySelector('.ps-res, .ps-msg-warn'),
      { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 400));

    ok(posted === 1, `[${c.tag}] 明細を1回だけ読み取りに出す`, `${posted} 回`);
    ok(ocrFetched === false,
       `[${c.tag}] ★文字の層があるので OCR は回さない（この検査が40秒級にならない）`,
       ocrFetched ? 'tesseract を取りに行った' : '');

    // ── ④ の回帰：下書きが明細の値を上書きしていない ──────────────
    const got = await page.evaluate((ids) => {
      const o = {};
      for (const id of ids) { const e = document.getElementById(id); o[id] = e ? e.value : null; }
      return o;
    }, Object.keys(c.want).concat(Object.keys(c.keep)));
    /* ★金額の欄は整数で持つ（1,099.50 は 1,100 と入る）。だから丸めの 0.5 未満だけ許す。
       ⚠️ これを「だいたい合っていれば良い」に広げないこと。この幅は
          1/1000 のずれ（8450 が 8.45 になる）を必ず捕まえるために選んである。 */
    for (const [id, v] of Object.entries(c.want)) {
      const same = id === 'f-source' || id === 'f-currency'
        ? String(got[id]) === v : Math.abs(num(got[id]) - num(v)) <= 0.5;
      ok(same, `[${c.tag}] ★${id} は明細の値のまま（先月の下書きに戻っていない）`,
         `${got[id]} / 下書きは ${c.draft[id]}`);
    }
    for (const [id, v] of Object.entries(c.keep)) {
      ok(String(got[id]) === v,
         `[${c.tag}] ${id} は下書きから戻る（明細が触らない欄まで捨てない）`, String(got[id]));
    }

    /* 変動給は欄ではなく「行」。下書きの行が後ろに足されると、DOM の行・
       f-var-sum・f-payitems の**三者が食い違う**（送信は止まらない）。 */
    const tri = await page.evaluate(() => {
      let pi = null;
      try { pi = JSON.parse(document.getElementById('f-payitems').value || 'null'); } catch (e) {}
      return {
        pi,
        rows: Array.from(document.querySelectorAll('#pd-var-rows .pd-row')).map((r) => ({
          amount: (r.querySelector('.pd-amt') || {}).value || '',
          basis: (r.querySelector('.pd-basis') || {}).value || '',
          label: (r.querySelector('.pd-label') || {}).value || '',
        })),
        sum: document.getElementById('f-var-sum').value,
      };
    });
    const wantSum = c.rows.reduce((t, r) => t + r.amount, 0);
    const piVar = (tri.pi && Array.isArray(tri.pi.variable)) ? tri.pi.variable : [];
    ok(tri.rows.length === c.rows.length,
       `[${c.tag}] ★変動給の行は明細のぶんだけ（下書きの行が足されていない）`,
       `${tri.rows.length} 行 / ${JSON.stringify(tri.rows.map((r) => r.label))}`);
    ok(piVar.length === c.rows.length
       && Math.abs(num(tri.sum) - wantSum) <= 0.5 * c.rows.length
       && piVar.every((v, i) => Math.abs(num(v.amount) - c.rows[i].amount) <= 0.5)
       && tri.rows.every((r, i) => Math.abs(num(r.amount) - c.rows[i].amount) <= 0.5
                                   && r.basis === c.rows[i].basis),
       `[${c.tag}] ★DOM の行・f-var-sum・f-payitems が三者一致`,
       `sum ${tri.sum} / payitems ${JSON.stringify(piVar)}`);
    ok(JSON.stringify(tri).indexOf('99999') < 0,
       `[${c.tag}] ★先月の変動給が1行も混ざっていない`);

    /* ★緑枠が嘘をついていないか。明細が入れたと言っている欄が、下書きの値を
       出していたら落とす（2026-09-11 まではここが全部ずれていた）。 */
    const green = await page.evaluate(() => Array.from(document.querySelectorAll('.ai-filled'))
      .filter((e) => e.id).map((e) => ({ id: e.id, v: e.value })));
    /* ★下書きと明細がたまたま同じ値になる欄（年など）は見ない。
       「戻された」のか「元から同じ」のか区別できず、意味のない赤になる。 */
    const lying = green.filter((g) => c.draft[g.id] != null && c.want[g.id] != null
      && num(c.draft[g.id]) !== num(c.want[g.id])
      && Math.abs(num(g.v) - num(c.draft[g.id])) <= 0.5);
    ok(lying.length === 0,
       `[${c.tag}] ★「明細から入った欄です」の緑枠が、下書きの値を出していない`,
       JSON.stringify(lying));
    ok(green.some((g) => g.id === 'f-gross'),
       `[${c.tag}] 総支給に緑枠が付いている（この検査の信号が生きている）`,
       green.map((g) => g.id).join(','));

    /* ★明細に印字されていない「今月の賞与」は、明細からは読めない。
       ここで先月の下書きの 0 を戻すと**未回答の 0 が本人の回答に化ける**ので、
       この欄は空のまま残る ── 本人が答える。2026-09-12 の決定1・5・6。 */
    ok(await page.$eval('#f-bonus-mo', (el) => el.value === ''),
       `[${c.tag}] ★明細に無い当月賞与は空のまま（先月の下書きの 0 を戻さない）`,
       await page.$eval('#f-bonus-mo', (el) => el.value));
    await page.evaluate(() => {
      const e = document.getElementById('f-bonus-mo');
      e.value = '0';
      e.dispatchEvent(new Event('input', { bubbles: true }));
      e.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 200));

    // ── 通し：5/5 → 送信 → pay_reports → マイページ → REAL PAY ──────
    await page.evaluate(() => { if (window.PVPayWizard) window.PVPayWizard.goLast(); });
    await new Promise((r) => setTimeout(r, 400));
    await page.click('#submit-btn');
    await page.waitForFunction(
      () => document.getElementById('result-wrap') &&
            document.getElementById('result-wrap').offsetParent !== null,
      { timeout: 20000 },
    ).catch(() => {});
    await new Promise((r) => setTimeout(r, 600));

    ok(sent.length === 1, `[${c.tag}] ★明細から入った1件が本棚に届く`, `${sent.length} 回`);
    ok(sentOther.length === 0,
       `[${c.tag}] ログイン済みなら預かりの口は通らない`, sentOther.join(', ') || 'なし');
    const p = sent[0] || {};
    ok(String(p.source) === 'payslip', `[${c.tag}] 出所が 'payslip' で送られる`, String(p.source));

    await db.query(`select set_config('pv.uid', $1, false)`, [c.uid]);
    const row = (await db.query(
      `select gross_monthly g, currency cur, source s, payslip_detail d, period_month m
         from pay_reports where airline = $1 order by created_at desc limit 1`,
      [c.db.airline])).rows[0] || {};
    ok(num(row.g) === c.db.gross && row.cur === c.db.currency && row.s === 'payslip'
       && Number(row.m) === 7,
       `[${c.tag}] ★pay_reports に明細どおりの1行が入る`,
       `${row.g} ${row.cur} / ${row.s} / ${row.m}月`);
    ok(!!row.d && Array.isArray(row.d.earnings) && row.d.earnings.length === c.raw.earnings.length,
       `[${c.tag}] 読めた内訳も payslip_detail 列に残る`,
       String(row.d && row.d.earnings && row.d.earnings.length));

    const my = (await db.query(`select my_pay_reports() r`)).rows[0].r || {};
    const mine = (my.reports || []).filter((r) => r.airline === c.db.airline);
    ok(mine.length === 1 && num(mine[0].gross_monthly) === c.db.gross
       && mine[0].source === 'payslip',
       `[${c.tag}] ★マイページ（my_pay_reports）に同じ1件が出る`,
       JSON.stringify(mine.map((r) => [r.airline, r.gross_monthly, r.source])));

    const pr = (await db.query(`select pv_pay_rows() r`)).rows[0].r || {};
    const seat = (pr.rows || []).filter((r) => r.airline === c.db.airline);
    ok(pr.state === 'open' && seat.length === 1 && Number(seat[0].annual_usd) > 0,
       `[${c.tag}] ★REAL PAY の一覧に自分の行が出る（鍵も開いている）`,
       `${pr.state} / ${JSON.stringify(seat)}`);

    await page.evaluate(() => localStorage.clear());
    await page.close();
  }
}

/* ══ 明細を落とし直したとき、前の明細の値が残らない（2026-09-11）══════
   1枚目に GUARANTEE 73.00 とパーディアムがある明細、2枚目にどちらも無い明細を
   続けて落とすと、f-guar と f-perdiem に1枚目の値が**緑枠（明細から入った欄です）
   のまま**残っていた。annualTotal() の Math.max(f-block, f-guar) が時給の分母に
   効くので、**画面は普通に動いたまま、時給だけが前の明細の数で出る**。

   ⚠️ 「2枚目に無い欄を空にする」を「.ai-filled の付いた欄を全部消す」と読み替えない。
      本人が手で直した欄は unmark で印が外れている ＝ **触ってはいけない**。
      ここで f-base を手で書き換えてから2枚目を落とし、その値が生き残ることまで見る。

   ★同じ周で、5/5 の確認画面に「明細から読み取った値」の節が出ることも見る
     （控除合計・年初来・深夜時間…は隠し欄で、5/5 の .fld 巡回には現れない）。

   ★日本語版だけで回す。消す仕掛けも 5/5 の節も payslip.js / pay-wizard.js の
     共有 JS 1か所にあり、言語で分かれていない。2枚目の黒塗りをもう1周させると
     この検査だけで20秒級に伸びるので、言語を増やす価値より時間の害が勝つ。
     ⚠️ 文言（節の見出し・欄の名前）が日英で分かれる側は
        assert-pay-report-sync.mjs が骨格として見張っている。 */
console.log('\n明細を落とし直す（前の値が残らない・5/5 に隠れた値が出る）');
{
  const FN = '/functions/v1/parse-payslip';
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  const PDF = path.join(ROOT, 'db/fixtures/payslip-pdf-gulf.pdf');
  const srv = (raw) => {
    const p2 = sanitize(raw);
    return { ok: true, result: applyChecks(p2, reconcile(p2)) };
  };
  const num = (v) => Number(String(v == null ? '' : v).replace(/[^0-9.-]/g, ''));

  /* 1枚目 ── 保証時間・パーディアム・基本給がある。隠し欄（年初来・控除・深夜・
     クレジット）も埋まる＝5/5 の新しい節に出る材料がそろう。 */
  const RAW1 = {
    currency: 'JPY', period: { year: 2026, month: 7 },
    earnings: [
      { label: '基本給', amount: 420000, kind: 'base' },
      { label: '日当（非課税）', amount: 42000, kind: 'per_diem' },
    ],
    hours: [
      { label: '乗務時間', value: 78.2, kind: 'block' },
      { label: 'GUARANTEE', value: 73, kind: 'guarantee' },
      { label: '深夜時間', value: 12.5, kind: 'night' },
      { label: 'CREDIT', value: 80, kind: 'credit' },
    ],
    gross_total: 462000, deductions_total: 121600, net_pay: 340400,
    ytd_taxable: 4200000, unmapped: [], confidence: 'high',
  };
  /* 2枚目 ── 保証時間もパーディアムも基本給も**無い**。代わりに職位手当がある。 */
  const RAW2 = {
    currency: 'JPY', period: { year: 2026, month: 8 },
    earnings: [{ label: '職位手当', amount: 180000, kind: 'command' }],
    hours: [{ label: '乗務時間', value: 60, kind: 'block' }],
    gross_total: 180000, deductions_total: 40000, net_pay: 140000,
    unmapped: [], confidence: 'high',
  };

  let fake = srv(RAW1);
  const page = await newPage();
  await page.setViewport({ width: 1440, height: 1200 });
  page.on('pageerror', (e) => { fail++; console.log(`  ❌ ページ例外: ${e.message}`); });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (!u.includes(FN)) return req.continue();
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS, body: '' });
    req.respond({ status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
                  body: JSON.stringify(fake) });
  });
  await page.goto('http://localhost:3000/pay-report.html',
    { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });

  /* 明細を1枚読ませて、結果がフォームに入りきるまで待つ（時間で待たない）。 */
  const drop = async (wantGross) => {
    /* ★古い確認欄の id を退かす。落とし直すと payslip.js が panel を作り直すので、
       これで「新しく出てきたほう」を条件で待てる（時間で待つと混んだ回に嘘の赤が出る）。 */
    await page.evaluate(() => {
      const c = document.getElementById('ps-confirm'); if (c) c.id = 'ps-confirm-old';
      const s2 = document.getElementById('ps-send');   if (s2) s2.id = 'ps-send-old';
    });
    const input = await page.$('#ps-file');
    await input.uploadFile(PDF);
    await page.waitForSelector('#ps-confirm', { timeout: 60000 });
    await page.waitForFunction(() => {
      const b = document.getElementById('ps-confirm');
      return !!b && !b.disabled;
    }, { timeout: 60000 });
    await page.click('#ps-confirm');
    await page.click('#ps-send');
    await page.waitForFunction((g) => {
      const e = document.getElementById('f-gross');
      return !!e && Math.abs(Number(String(e.value).replace(/[^0-9.]/g, '')) - g) < 0.5;
    }, { timeout: 60000 }, wantGross);
  };

  await page.click('#entry-payslip');
  await page.waitForFunction(() => {
    const n = document.getElementById('ps');
    return !!n && !n.hidden && n.offsetHeight > 0;
  }, { timeout: 10000 });
  await drop(462000);

  const v = (id) => page.$eval('#' + id, (e) => e.value);
  ok(num(await v('f-guar')) === 73, '前提：1枚目の保証時間が入っている', await v('f-guar'));
  ok(num(await v('f-perdiem')) === 42000, '前提：1枚目のパーディアムが入っている', await v('f-perdiem'));

  /* ── ③ 5/5 に、画面に欄の無い値が出る ─────────────────────────── */
  await page.evaluate(() => { if (window.PVPayWizard) window.PVPayWizard.goLast(); });
  await page.waitForFunction(() => {
    const r = document.getElementById('wz-review');
    return !!r && r.textContent.indexOf('明細から読み取った値') >= 0;
  }, { timeout: 10000 }).catch(() => {});
  const rev = await page.$eval('#wz-review', (e) => e.textContent);
  ok(rev.indexOf('明細から読み取った値') >= 0,
     '★5/5 に「明細から読み取った値」の節が出る', rev.slice(0, 120));
  ok(/控除の合計/.test(rev) && /121,600|JPY 121,600/.test(rev),
     '★控除の合計（隠し欄）が読み返せる', rev.slice(-260));
  ok(/年初来の課税支給額/.test(rev) && /4,200,000/.test(rev),
     '★年初来の課税支給額（隠し欄）が読み返せる', rev.slice(-260));
  ok(/深夜の時間/.test(rev) && /12\.5 時間/.test(rev),
     '★深夜の時間（隠し欄）が読み返せる', rev.slice(-260));
  ok(/クレジット時間/.test(rev) && /80 時間/.test(rev),
     '★クレジット時間（隠し欄）が読み返せる', rev.slice(-260));
  ok(rev.indexOf('f-psdetail') < 0 && !/\{"v":1|earnings/.test(rev),
     '★控えの JSON（f-psdetail）は出さない');

  /* ── ② 本人が手で直した欄は、落とし直しても消えない ───────────── */
  await page.evaluate(() => {
    const e = document.getElementById('f-base');
    e.value = '777777';
    e.dispatchEvent(new Event('input', { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
  });
  ok(await page.$eval('#f-base', (e) => !e.classList.contains('ai-filled')),
     '前提：手で直した欄からは「明細から入った」の印が外れる');

  fake = srv(RAW2);
  await drop(180000);

  ok((await v('f-guar')) === '',
     '★★2枚目に保証時間が無ければ、1枚目の 73 は残らない（時給の分母が前の明細のままにならない）',
     await v('f-guar'));
  ok((await v('f-perdiem')) === '',
     '★★2枚目に無いパーディアムも残らない', await v('f-perdiem'));
  ok(num(await v('f-base')) === 777777,
     '★★手で直した基本給は消さない（本人が触った欄には手を出さない）', await v('f-base'));
  ok(num(await v('f-command')) === 180000,
     '2枚目で新しく出てきた職位手当は入る', await v('f-command'));
  ok((await v('f-month')) === '8', '対象月も2枚目のものになる', await v('f-month'));
  /* ★緑枠が嘘をついていないか。1枚目の値を出したまま「明細から入った欄です」と
     言っている欄が1つも無いこと。 */
  const stale = await page.evaluate(() => Array.from(document.querySelectorAll('.ai-filled'))
    .filter((e) => e.id).map((e) => ({ id: e.id, v: e.value })));
  ok(!stale.some((g) => ['f-guar', 'f-perdiem'].indexOf(g.id) >= 0 && g.v !== ''),
     '★1枚目の値に緑枠が残っていない', JSON.stringify(stale));

  await page.evaluate(() => localStorage.clear());
  await page.close();
}

/* ══ 「前回の内容」の上に明細を落としても、先月の額が積み上がらない（2026-09-11）══
   本番で実際に起きた形。ANA / A320 / 副操縦士の方が8月を手で出したあと、7月ぶんを
   明細で出してくれた。保存された行は **7月の明細の値と8月の手入力が混ざったもの**
   になっていて、内訳の合計が総支給の 2.2 倍あった。
   REAL PAY は「内訳の合計 ≤ 総支給 × 1.02」を満たす行にしか支給構成の帯を出さない
   ので、この方の行だけ帯が出ていなかった（金額も順位も普通に出ているので、
   画面のどこを見ても壊れているとは分からない）。

   原因は2つ重なっていた。どちらも **画面は普通に動いたまま** 起きる。

   A) 同じ入力が1回の読み込みで2回戻る。先に loadPreset() が「前回の内容」
      （pv_pay_last）を戻し、そのあとウィザードが「下書き」（pv_pay_draft）を戻す。
      どちらも同じ f-payitems を持つので、変動給の**行だけ**が毎回倍になる
      （欄は代入で上書きされるので気づけない）。1 → 2 → 4 → 8。
      実際、保存された行には同じ手当が8回並んでいた。

   B) 明細は「明細に載っている手当」しか上書きしない。先月あって今月の明細に
      無い手当 ── 保証給・日当 ── は誰も上書きせず、先月の額がそのまま残る。
      総支給だけ明細の額に入れ替わるので、内訳の合計が総支給を超える。

   ★この検査は「前回の内容」の側から入る（上の2本はどちらも下書きの側からしか
     入っていなかった）。入口で明細を選ぶより前に loadPreset() が走る道は、
     ここでしか通らない。
   ★日本語版だけで回す。直した2か所はどちらも pay-report.html と en/pay-report.html に
     同じ形で写してあり、骨格は assert-pay-report-sync.mjs が見張っている。
     黒塗りをもう1周させると10秒以上伸びるので、言語を増やす価値より時間の害が勝つ。 */
console.log('\n前回の内容の上に明細を落とす（先月の額が積み上がらない）');
{
  const FN = '/functions/v1/parse-payslip';
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  const PDF = path.join(ROOT, 'db/fixtures/payslip-pdf-gulf.pdf');
  const num = (v) => Number(String(v == null ? '' : v).replace(/[^0-9.-]/g, ''));

  /* 先月（本人が手で出した月）。保証給と日当が入っていて、変動給の行も1本ある。
     ★金額は本番の行から持ってきた形だけで、数字そのものは作り話。 */
  const LAST = {
    'f-airline': 'ana', 'f-position': 'fo', 'f-fleet': 'a320', 'f-jobrole': 'line',
    'f-age': '30-39', 'f-housing': 'none', 'f-currency': 'JPY',
    'f-contract': 'direct', 'f-taxcountry': 'JP', 'f-seniority': '5',
    'f-gross': '1250305', 'f-guarantee': '507000', 'f-perdiem': '42000',
    /* ★明細が**絶対に読めない**3つ。印字が無いので payslip.js は触らず、
       前の月の額が誰にも上書きされないまま残る。管理職手当と時給は
       monthlyDetail() にそのまま足され、組合手当は画面の合計には出ないのに
       **保存される列には乗る**（union_pay）＝REAL PAY 側だけで帯が消える。 */
    'f-hourly': '9000', 'f-mgmt-pay': '80000', 'f-union-pay': '55000',
    /* ★画面に出ていない欄（hidden）。value と defaultValue が常に同じになるので、
       「既定へ戻す」書き方だと**1つも消えない**。しかも f-other / f-transport は
       内訳の合計にそのまま足される＝画面に何も出ないまま帯だけが落ちる。 */
    'f-transport': '25000', 'f-other': '60000',
    'f-payitems': JSON.stringify({
      v: 1, fixed_none: false, guarantee_none: false, variable_none: false,
      variable: [{ amount: 113398, label: '先月の変動給', basis: 'block' }], other: [],
    }),
  };
  /* 今月の明細。保証給も日当も**無い**。総支給は読めた手当の合計と一致させてある
     （合わないと検算が「印字と違う」と言い出して、見たい所以外で赤くなる）。 */
  const RAW = {
    currency: 'JPY', period: { year: 2026, month: 7 },
    earnings: [
      { label: '基本給', amount: 399083, kind: 'base' },
      { label: '職務手当', amount: 507000, kind: 'command' },
      { label: '住宅手当', amount: 16700, kind: 'housing' },
      { label: '変動付加乗務時間', amount: 193013, kind: 'flight_variable', basis: 'block' },
      { label: '変動付加乗務回数', amount: 13650, kind: 'flight_variable', basis: 'sector' },
    ],
    hours: [{ label: '乗務時間', value: 78.2, kind: 'block' }],
    gross_total: 1129446, deductions_total: 300000, net_pay: 829446,
    unmapped: [], confidence: 'high',
  };
  const FAKE = (() => { const q = sanitize(RAW); return { ok: true, result: applyChecks(q, reconcile(q)) }; })();

  const page = await newPage();
  await page.setViewport({ width: 1440, height: 1200 });
  page.on('pageerror', (e) => { fail++; console.log(`  ❌ ページ例外: ${e.message}`); });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (!u.includes(FN)) return req.continue();
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS, body: '' });
    req.respond({ status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
                  body: JSON.stringify(FAKE) });
  });
  await page.goto('http://localhost:3000/pay-report.html',
    { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  /* 「前回の内容」を置いてから開き直す。押印は 'anon'（未ログインで出した人）＝
     PVPayLocal.owns() が 60 分の猶予でそのまま戻す。
     ⚠️ 置くのは **evaluateOnNewDocument**（次の文書が動き出す前）。素の
        evaluate で書いて reload すると、離れる拍子の savePreset() が
        **空のフォームの内容で上書きする**（pagehide → savePreset）。
        書いたはずの前回の内容が {"f-currency":"JPY"} だけになり、
        この検査は「直っていないのに前提で赤くなる」という一番たちの悪い形で落ちる。 */
  await page.evaluateOnNewDocument((f, t) => {
    try { localStorage.setItem('pv_pay_last',
      JSON.stringify(Object.assign({}, f, { _own: 'anon', _ts: t, _tab: '' }))); } catch (e) {}
  }, LAST, Date.now());
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction(() => {
    const e = document.getElementById('f-guarantee');
    return !!e && e.value !== '';
  }, { timeout: 10000 }).catch(() => {});

  const v = (id) => page.$eval('#' + id, (e) => e.value);
  const varRows = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('#pd-var-rows .pd-row'))
      .map((r) => (r.querySelector('.pd-amt') || {}).value || '')
      .filter((x) => String(x).trim() !== ''));

  ok(num(await v('f-guarantee')) === 507000, '前提：前回の保証給が戻っている', await v('f-guarantee'));
  ok(num(await v('f-perdiem')) === 42000, '前提：前回の日当が戻っている', await v('f-perdiem'));
  ok((await varRows()).length === 1,
     '前提：前回の変動給は1行だけ', JSON.stringify(await varRows()));

  // ── 入口で「明細から自動入力」を選び、明細を1枚落とす ──────────────
  await page.click('#entry-payslip');
  await page.waitForFunction(() => {
    const n = document.getElementById('ps');
    return !!n && !n.hidden && n.offsetHeight > 0;
  }, { timeout: 10000 });
  const input = await page.$('#ps-file');
  await input.uploadFile(PDF);
  await page.waitForSelector('#ps-confirm', { timeout: 60000 });
  await page.waitForFunction(() => {
    const b = document.getElementById('ps-confirm');
    return !!b && !b.disabled;
  }, { timeout: 60000 });
  await page.click('#ps-confirm');
  await page.click('#ps-send');
  await page.waitForFunction(() => {
    const e = document.getElementById('f-gross');
    return !!e && Math.abs(Number(String(e.value).replace(/[^0-9.]/g, '')) - 1129446) < 0.5;
  }, { timeout: 60000 });
  /* ウィザードが動き出して下書きの復元まで済むのを待つ（時間で待たない）。 */
  await page.waitForFunction(() => {
    const n = document.getElementById('entry');
    return !n || n.hidden || n.offsetHeight === 0;
  }, { timeout: 20000 }).catch(() => {});

  // ── A) 行が倍になっていない ───────────────────────────────
  const rows = await varRows();
  ok(rows.length === 2, '★★変動給の行は明細の2本だけ（前回の行が足されていない）',
     `${rows.length} 行 / ${JSON.stringify(rows)}`);
  ok(rows.every((x) => num(x) !== 113398), '★★前回の変動給が1行も残っていない',
     JSON.stringify(rows));

  // ── B) 明細に無い手当が、先月の額のまま残っていない ─────────────
  ok((await v('f-guarantee')) === '',
     '★★明細に保証給が無ければ、前回の 507,000 は残らない', await v('f-guarantee'));
  ok((await v('f-perdiem')) === '',
     '★★明細に日当が無ければ、前回の 42,000 は残らない', await v('f-perdiem'));
  /* ★明細が読めない欄こそ残りやすい。ここが残ると、画面には何も出ないまま
     REAL PAY の帯だけが消える（保存される列には乗るため）。 */
  ok((await v('f-mgmt-pay')) === '',
     '★★明細に無い管理職手当も、前回の 80,000 は残らない', await v('f-mgmt-pay'));
  ok((await v('f-union-pay')) === '',
     '★★明細に無い組合手当も、前回の 55,000 は残らない', await v('f-union-pay'));
  ok(num(await v('f-hourly')) === 0,
     '★★前回の時給が残らない（残ると 時給×乗務時間 が丸ごと内訳に乗る）', await v('f-hourly'));
  ok(num(await v('f-transport')) === 0,
     '★★画面に出ていない欄（通勤手当）も前回の 25,000 が残らない', await v('f-transport'));
  ok(num(await v('f-other')) === 0,
     '★★画面に出ていない欄（その他手当）も前回の 60,000 が残らない', await v('f-other'));

  // ── 明細が触らない欄まで捨てていない ─────────────────────────
  for (const [id, want] of Object.entries({ 'f-airline': 'ana', 'f-position': 'fo',
      'f-fleet': 'a320', 'f-contract': 'direct', 'f-taxcountry': 'JP', 'f-seniority': '5' })) {
    ok(String(await v(id)) === want, `${id} は前回の内容から残る（明細が触らない欄）`, await v(id));
  }

  /* ── ここが本丸。REAL PAY が支給構成の帯を出す条件そのもの ──────────
     画面が持っている monthlyDetail()（内訳の合計）を呼ぶ。SQL の式を写さない。 */
  const over = await page.evaluate(() => ({
    detail: monthlyDetail(), gross: Number(String(document.getElementById('f-gross').value)
      .replace(/[^0-9.]/g, '')),
    warn: (() => { const e = document.getElementById('pd-over'); return !!e && !e.hidden; })(),
  }));
  ok(over.detail <= over.gross * 1.02,
     '★★内訳の合計が総支給を超えない（＝REAL PAY が支給構成の帯を出せる）',
     `内訳 ${over.detail} / 総支給 ${over.gross}`);
  ok(over.warn === false, '★「内訳の合計が総支給を超えています」の注意が出ていない',
     `内訳 ${over.detail} / 総支給 ${over.gross}`);

  await page.evaluate(() => localStorage.clear());
  await page.close();
}


/* ══ 空ではないが「不正」で止まったときも、その欄のある段へ運ぶ ══════
   2026-09-09。markMissing() が運ぶのは**空の必須欄**だけだった。
   総支給に 0 と入れた人・明細から時給だけ読めた人は、必須はすべて埋まっているので
   markMissing() を素通りし、1件ずつの判定で止まる。以前はそこで
   `showErr()` を呼ぶだけだったので、**赤箱は今いる段（5/5 確認）に出て、
   直すべき欄は画面のどこにも無い**。本人には「押しても何も起きない」としか映らない。
   ★ここは日英とも見る（stopAt() は2枚に写してあるので、片方だけ古くなりうる）。 */
console.log('\n止まった理由の欄まで運ぶ（空ではないが不正）');
for (const [tag, url] of [['ja', 'http://localhost:3000/pay-report.html'],
                          ['en', 'http://localhost:3000/en/pay-report.html']]) {
  const page = await newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  page.on('pageerror', (e) => { fail++; console.log(`  ❌ [${tag}] ページ例外: ${e.message}`); });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 700));
  await page.click('#entry-manual');
  await new Promise((r) => setTimeout(r, 300));

  /* 必須をすべて valid で埋める（選択肢は先頭の実値・数値は 0 でよい）。 */
  await page.evaluate(() => {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const firstOpt = (id) => {
      const s = document.getElementById(id);
      const o = [...s.options].find((x) => x.value && x.value !== 'other');
      return o ? o.value : '';
    };
    ['f-airline', 'f-position', 'f-fleet', 'f-age', 'f-currency', 'f-housing',
     'f-contract', 'f-taxcountry'].forEach((id) => set(id, firstOpt(id)));
    const role = document.querySelector('input[name="f-jobrole"]');
    if (role) { role.checked = true; role.dispatchEvent(new Event('change', { bubbles: true })); }
    ['f-block', 'f-stay', 'f-bonus-mo', 'f-perdiem', 'f-seniority'].forEach((id) => set(id, '0'));
    set('f-gross', '1080000');
    set('f-netpay', '842000');
  });
  await new Promise((r) => setTimeout(r, 300));
  ok((await page.evaluate(() => missingAll().length)) === 0,
     `[${tag}] 前提：必須はひとつも空いていない`,
     String(await page.evaluate(() => missingAll().map(reqLabel))));

  /* ── ① 総支給に 0（空ではない。req の印は付かない）→ 3. 報酬 へ ── */
  const g0 = await page.evaluate(async () => {
    const set = (id, v) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('f-gross', '0');
    window.PVPayWizard.goLast();
    await new Promise((r) => setTimeout(r, 200));
    const before = window.PVPayWizard.current();
    await submitPayReport();
    await new Promise((r) => setTimeout(r, 300));
    const err = document.getElementById('err');
    const fg = document.getElementById('f-gross');
    return { before, after: window.PVPayWizard.current(),
             errShown: !!(err && err.offsetParent && err.textContent.trim()),
             fieldShown: !!fg.offsetParent, focused: (document.activeElement || {}).id || '' };
  });
  ok(g0.before === 's5', `[${tag}] 前提：確認の段から押している`, g0.before);
  ok(g0.after === 's3', `[${tag}] ★総支給 0 で止めたら「3. 報酬」へ運ぶ（確認の段に置き去りにしない）`, g0.after);
  ok(g0.fieldShown, `[${tag}] ★直すべき総支給の欄が画面に出ている`, JSON.stringify(g0));
  ok(g0.errShown, `[${tag}] ★赤箱も運んだ先に出ている（段ごと引っ越して消えない）`, JSON.stringify(g0));
  ok(g0.focused === 'f-gross', `[${tag}] ★その欄に焦点が移っている`, g0.focused);

  /* ── ② 明細から時給だけ読めて、飛んだ時間も保証時間も 0 → 2. 対象月と乗務 へ ──
     f-hourly は明細読み取り専用の hidden。本人が画面から埋める道は無いので、
     ここで止まった人は「どこを直せばいいのか」を欄で示すしかない。 */
  const h0 = await page.evaluate(async () => {
    const set = (id, v) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('f-gross', '1080000');
    set('f-hourly', '5000');
    set('f-block', '0');
    set('f-guar', '');
    window.PVPayWizard.goLast();
    await new Promise((r) => setTimeout(r, 200));
    await submitPayReport();
    await new Promise((r) => setTimeout(r, 300));
    const fb = document.getElementById('f-block');
    return { after: window.PVPayWizard.current(), fieldShown: !!fb.offsetParent,
             focused: (document.activeElement || {}).id || '' };
  });
  ok(h0.after === 's2', `[${tag}] ★時給だけで時間がゼロなら「2. 対象月と乗務」へ運ぶ`, h0.after);
  ok(h0.fieldShown && h0.focused === 'f-block',
     `[${tag}] ★フライトタイムの欄を出して焦点も当てる`, JSON.stringify(h0));

  await page.evaluate(() => localStorage.clear());
  await page.close();
}

/* ══ 下書き（このブラウザだけ・pv_pay_draft）══════════════════════
   2026-09-08、5ステップにしたので「途中でやめた人が帰ってこられる」を足した。
   オーナーが決めた4つを、実ページで1つずつ確かめる。
     ① 明細の画像・PDF・OCR の原文を下書きに入れない
     ② 別のアカウントの下書きは戻さず捨てる（同じ端末を家族で使う）
     ③ 提出が通ったら消える。しかも**それ以降は控え直さない**
     ④ 保存に失敗したら「保存しました」と出さない
   ★どれも画面はいつもどおり動いたまま壊れる形をしている。
     ①は漏れても誰も気づかない。③は「まだ途中です」と出て 5/5 から始まる。 */
console.log('\n下書き（このブラウザだけ・pv_pay_draft）');
{
  /* OCR 原文の目印。下書きの生の文字列にこれが1文字でも出たら落とす。 */
  const MARK = 'OCR-RAW-DO-NOT-SAVE-7f3a';
  const U1 = '00000000-0000-4000-8000-0000000000d1';
  const U2 = '00000000-0000-4000-8000-0000000000d2';

  const page = await newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  page.on('pageerror', (e) => { fail++; console.log(`  ❌ ページ例外: ${e.message}`); });
  await page.goto('http://localhost:3000/pay-report.html',
    { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 800));

  const raw = () => page.evaluate(() => localStorage.getItem('pv_pay_draft'));
  const setF2 = (o) => page.evaluate((obj) => {
    for (const [id, v] of Object.entries(obj)) {
      const el = document.getElementById(id);
      if (!el) throw new Error(`${id} が無い`);
      el.value = v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, o);
  const enter = async () => {
    await page.click('#entry-manual');
    await new Promise((r) => setTimeout(r, 300));
  };

  await enter();
  /* ★f-block と f-netpay は下書きにしか入らない（この端末のプリセット pv_pay_last は
     「その月にしか無い値」を持たないため）。持ち主の判定を見るのはこの2つで行う
     ── f-airline はプリセット側からも戻るので、下書きの証拠にならない。 */
  await setF2({ 'f-airline': 'ana', 'f-position': 'cap', 'f-fleet': 'b777', 'f-age': '40-49',
                'f-block': '86.5', 'f-netpay': '41200' });
  /* 明細を読んだ人と同じ形にする（payslip.js が入れる hidden の2つ）。 */
  await setF2({ 'f-source': 'payslip', 'f-psdetail': JSON.stringify({ v: 1, note: MARK }) });
  await page.evaluate(() => window.PVPayWizard.saveDraft());
  await new Promise((r) => setTimeout(r, 150));

  const r1 = await raw();
  ok(!!r1, '★下書きがこのブラウザに残る');
  ok(r1 && r1.indexOf(MARK) < 0,
     '★明細の読み取り原文は下書きに1文字も入らない（許可リストから外してある）',
     String(r1).slice(0, 160));
  const d1 = JSON.parse(r1 || 'null') || {};
  ok(d1.fields && !('f-psdetail' in d1.fields),
     '★f-psdetail は下書きの中身にも現れない', Object.keys(d1.fields || {}).join(','));
  ok(d1.fields && d1.fields['f-airline'] === 'ana' && d1.fields['f-age'] === '40-49',
     '★打った値のほうはちゃんと控えている', JSON.stringify(d1.fields || {}).slice(0, 120));
  ok(d1.uid === 'anon' && d1.step === 's1',
     '★未ログインの下書きは持ち主なし（anon）で、居た段まで覚えている',
     `${d1.uid} / ${d1.step}`);
  ok(await page.$eval('#wz-draft', (el) => !el.hidden && el.classList.contains('is-ok')
     && /このブラウザ/.test(el.textContent)),
     '★「このブラウザに保存した」と本人に読める形で出す',
     await page.$eval('#wz-draft', (el) => el.textContent.trim()));

  /* ── ④ 保存に失敗したら「保存しました」と出さない ────────────────
     プライベートモード・容量超過では setItem が投げる。握り潰すと、
     入力が残っていない人に嘘の安心を出すことになる。 */
  await page.evaluate(() => {
    window.__realSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); };
  });
  await page.evaluate(() => window.PVPayWizard.saveDraft());
  await new Promise((r) => setTimeout(r, 150));
  const ng = await page.$eval('#wz-draft', (el) => ({
    ok: el.classList.contains('is-ok'), ng: el.classList.contains('is-ng'),
    drop: !!el.querySelector('.wz-draft-drop'), text: el.textContent.trim(),
  }));
  ok(ng.ng && !ng.ok && !ng.drop,
     '★保存できなかったときに「保存しました」と出さない', ng.text);
  ok(/このブラウザ/.test(ng.text), '★失敗のときも「このブラウザ」の話だと分かる', ng.text);
  await page.evaluate(() => { Storage.prototype.setItem = window.__realSet; });

  /* ── ② 別のアカウントの下書きは戻さず捨てる ────────────────────
     まず「同じブラウザで本人が認証しただけ」を通す（anon → 押印し直す）。 */
  await page.evaluate((u) => window.PVPayWizard.setUid(u), U1);
  await page.evaluate(() => window.PVPayWizard.saveDraft());
  const d2 = JSON.parse((await raw()) || 'null') || {};
  ok(d2.uid && d2.uid !== 'anon',
     '★未ログインで書いた下書きは、本人が認証した時点で押印し直す', String(d2.uid));

  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 800));
  await page.evaluate((u) => window.PVPayWizard.setUid(u), U1);
  await enter();
  ok(await page.$eval('#f-block', (el) => el.value === '86.5'),
     '★同じ人なら、次に開いたときに下書きから続けられる',
     await page.$eval('#f-block', (el) => el.value));
  ok(await page.$eval('#wz-draft',
       (el) => !el.hidden && /続けています|Continuing|戻しました|Restored/.test(el.textContent)),
     '★「このブラウザの下書きから戻した」と知らせる',
     await page.$eval('#wz-draft', (el) => el.textContent.trim()));
  /* ★2026-09-12（オーナー決定8）どの月の入力を戻したのかを名指しする。
       月を書かないと、新しい月を始めたつもりの人が**先月の実績を今月として送る**。
       画面はどこも壊れていないので、本人にも運営にも気づけない。 */
  ok(await page.$eval('#wz-draft', (el) => /(19|20)\d\d/.test(el.textContent)),
     '★戻した下書きが「どの月のものか」を名指しする',
     await page.$eval('#wz-draft', (el) => el.textContent.trim()));

  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 800));
  await page.evaluate((u) => window.PVPayWizard.setUid(u), U2);
  await enter();
  ok(await page.$eval('#f-block', (el) => el.value === '')
     && await page.$eval('#f-netpay', (el) => el.value === ''),
     '★別のアカウントでは前の人の下書きが戻らない',
     `${await page.$eval('#f-block', (el) => el.value)} / ${await page.$eval('#f-netpay', (el) => el.value)}`);
  ok((await raw()) === null,
     '★戻さないだけでなく、その場で捨てる（次に本人が来ても残っていない）');
  ok((await page.evaluate(() => window.PVPayWizard.current())) === 's1',
     '★別のアカウントは 1/5 から始まる');

  /* ── ③ 提出が通ったら消える。それ以降は控え直さない ──────────────
     ★消したあとも 2 秒の遅延保存が仕掛かったままだと、出し切った下書きが
       黙って生き返る（2026-09-08 に実際に踏んだ。次に開いた人に「まだ途中です」と
       出て、しかも 5/5 から始まる）。消すだけでなく止まっていることを見る。 */
  await setF2({ 'f-airline': 'jal', 'f-position': 'cap', 'f-block': '70.2' });
  await new Promise((r) => setTimeout(r, 2300));
  ok((await raw()) !== null, '打っていれば黙って控える（2秒の遅延保存）');
  await page.evaluate(() => window.PVPayWizard.clearDraft());
  ok((await raw()) === null, '★提出が通ったら下書きを消す');
  ok(await page.$eval('#wz-draft', (el) => el.hidden), '★「保存しました」の帯も引っ込める');
  await setF2({ 'f-fleet': 'b777' });
  await new Promise((r) => setTimeout(r, 2400));
  ok((await raw()) === null,
     '★消したあとに、仕掛かっていた遅延保存で生き返らない', String(await raw()).slice(0, 80));

  /* ── ⑤ 14日より古い下書きは捨てる（2026-09-09）──────────────────
     ts は前から書いていたが**読んでいなかった**。無期限のままだと、半年前に
     途中でやめた人が「今月の給与」として半年前の総支給・飛んだ時間を持ったまま
     3/5 から再開する。値はそれらしく埋まっていて本人も「前に入れたやつだ」としか
     思わないので、目でも他の検査でも気づけない。預かり（pv_pay_pending）は
     14日で捨てているので、そちらに揃える。 */
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => {
    const old = Date.now() - 15 * 24 * 60 * 60 * 1000;   // 15日前
    localStorage.setItem('pv_pay_draft', JSON.stringify({
      v: 1, uid: 'anon', step: 's3', ts: old,
      fields: { 'f-airline': 'ana', 'f-block': '86.5', 'f-netpay': '41200' },
    }));
  });
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 800));
  ok((await raw()) === null, '★15日前の下書きは、開いた時点でもう残っていない');
  await enter();
  ok(await page.$eval('#f-block', (el) => el.value === '')
     && await page.$eval('#f-netpay', (el) => el.value === ''),
     '★15日前の下書きの値は戻らない',
     `${await page.$eval('#f-block', (el) => el.value)} / ${await page.$eval('#f-netpay', (el) => el.value)}`);
  ok((await page.evaluate(() => window.PVPayWizard.current())) === 's1',
     '★捨てたあとは 1/5 から始まる（覚えていた 3/5 に置き去りにしない）');

  /* 13日前なら**捨てない**（境目を片側だけ見て「消えている」で満足しない）。 */
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => {
    const recent = Date.now() - 13 * 24 * 60 * 60 * 1000;
    localStorage.setItem('pv_pay_draft', JSON.stringify({
      v: 1, uid: 'anon', step: 's2', ts: recent,
      fields: { 'f-airline': 'ana', 'f-block': '86.5' },
    }));
  });
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 800));
  await enter();
  ok(await page.$eval('#f-block', (el) => el.value === '86.5'),
     '★13日前の下書きはちゃんと戻る（期限で全部消していない）',
     await page.$eval('#f-block', (el) => el.value));

  /* ── ⑥ 預かり（pv_pay_pending）を戻した回は、下書きに上書きさせない ──
     ログインを挟んで帰ってきた人の入力は **pv_pay_pending** に預けてある。
     下書きは2秒の遅延保存なので、最後の打鍵の直後に送信を押した人の下書きは
     **送った内容より古い**。以前は預かりを戻したあとに start() が下書きを
     もう一度流し込んでいて、後勝ちで古い値に戻っていた。
     ★あわせて「値は全部あるのに 1/5 に落ちる」も見る。預かり証を取れなかった人は
       showGate() を通らないので、ここで運んでおかないと本人には消えたように見える。 */
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => {
    localStorage.setItem('pv_pay_pending', JSON.stringify({
      'f-airline': 'ana', 'f-position': 'cap', 'f-fleet': 'b777',
      'f-block': '99.9', 'f-year': '2026', 'f-month': '7', _ts: Date.now(),
    }));
    localStorage.setItem('pv_pay_draft', JSON.stringify({
      v: 1, uid: 'anon', step: 's3', ts: Date.now() - 60000,
      fields: { 'f-airline': 'jal', 'f-block': '11.1' },
    }));
  });
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));
  const pv = await page.evaluate(() => ({
    block: document.getElementById('f-block').value,
    air: document.getElementById('f-airline').value,
    step: window.PVPayWizard.current(),
    entryGone: document.getElementById('entry').hidden,
  }));
  ok(pv.block === '99.9' && pv.air === 'ana',
     '★預けたぶんが戻る（古い下書きに上書きされない）', JSON.stringify(pv));
  ok(pv.entryGone, '★入口の2択には戻さない', JSON.stringify(pv));
  ok(pv.step === 's5',
     '★預けたぶんを戻したら最後の段（確認）に居る（1/5 に落とさない）', JSON.stringify(pv));

  /* ★置き土産を片づける。localStorage はこの検査の中の**全部のページ**で共通なので、
     pv_pay_pending を残したまま閉じると、次に pay-report.html を開いた節が
     いきなり 5/5 から始まって（預かりの復元）別人の値で走る。
     実際にこれで確認画面の帯の節が 38 本落ちた（2026-09-09）。 */
  await page.evaluate(() => localStorage.clear());

  await page.close();
}

/* ══ 月をまたぐ比較は「同じ会社」の中だけか ═════════════════════
   §6（前回の明細との差）と §7（月ごとの推移）は、会社をまたぐと意味が壊れる。
   通貨も契約も手当の名前も変わるので、為替が動いただけの月が「昇給」になり、
   円建てと AED 建てが同じ折れ線に乗る。ここは文字列では見張れない
   （絞り忘れても画面は"それらしく"出る）ので、実ページを開いて数える。

   ★ my_pay_reports() は本番にしか無いので、shot-value.mjs と同じやり方で
     Supabase クライアントごと差し替える。数字はすべて合成。 */
console.log('\n市場価値レポート（§6 の差・§7 の線は同一会社に絞る）');
{
  const MV = (o) => Object.assign({
    airline: 'emirates', airline_other: null, position: 'cap', fleet: 'b777',
    base_iata: 'DXB', period_year: 2026, period_month: 6,
    currency: 'AED', fx_to_jpy: 40.8, fx_to_usd: 0.272,
    base_pay: 25500, command_pay: 11000, housing_type: 'allowance', housing_amount: 12000,
    flight_variable_pay: 5800, per_diem: 4200, transport: 1500, other_allowance: 8200,
    bonus_annual: 0, profit_share_annual: 0,
    annual_total_orig: 748800, annual_total_jpy: 30551040,
    net_pay_actual: 54600, deduction_total: 3600, ytd_taxable: 349200,
    block_hours: 86.5, duty_hours: 158.2, source: 'payslip', created_at: '2026-06-05T00:00:00Z'
  }, o);
  // 5月＝月額が 2000AED 多い月（総支給 60200 → 58200 で −3.32%）
  const MAY = { period_month: 5, annual_total_orig: 772800, other_allowance: 10200,
                net_pay_actual: 56600, block_hours: 88.1, duty_hours: 155.7 };
  const JP_PREV = { airline: 'zipair', base_iata: 'ITM', currency: 'JPY', fx_to_jpy: 1, fx_to_usd: 0.0068 };

  const SCENES = {
    // 同社の連続した2ヶ月＝金額3本＋時間2本の5行が出る
    same: [MV(MAY), MV({})],
    // 転職＝前職の月は差にも線にも入れない（枚数は3枚のまま数える）
    job:  [MV(Object.assign({ period_month: 3 }, JP_PREV)),
           MV(Object.assign({ period_month: 4 }, JP_PREV)), MV({})],
    // 同社で支給通貨が変わった＝金額は出さず時間の2行だけ
    cur:  [MV({ period_month: 5, currency: 'USD', fx_to_jpy: 152, fx_to_usd: 1 }), MV({})]
  };

  for (const [name, reports] of Object.entries(SCENES)) {
    const page = await newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    page.on('pageerror', (e) => { fail++; console.log(`  ❌ [${name}] ページ例外: ${e.message}`); });
    await page.evaluateOnNewDocument((rows) => {
      const UID = '00000000-0000-4000-8000-00000000a001';
      const FAKE = {
        auth: {
          getSession: async () => ({ data: { session: { user: { id: UID } } } }),
          getUser: async () => ({ data: { user: { id: UID } } }),
          signOut: async () => ({ error: null })
        },
        from: () => {
          const o = { data: [], error: null, select: () => o, eq: () => o, in: () => o,
            order: () => o, limit: () => o, update: () => o, insert: () => o,
            single: async () => ({ data: null, error: null }),
            maybeSingle: async () => ({ data: null, error: null }),
            then: (res) => res({ data: [], error: null }) };
          return o;
        },
        rpc: async () => ({ data: { ok: true, reports: rows, report_count: rows.length,
          badge: 'none', badge_state: 'none', mail_optin: false, email_opt_in: false }, error: null })
      };
      // 後から読まれる CDN の supabase-js に上書きさせない
      Object.defineProperty(window, 'supabase', {
        value: { createClient: () => FAKE }, writable: false, configurable: false
      });
    }, reports);
    await page.goto('http://localhost:3000/profile.html',
      { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1200));

    const got = await page.evaluate(() => {
      const root = document.getElementById('pv-value');
      const secs = [...root.querySelectorAll('.pt-sec')];
      const cmp = secs.find((s) => s.querySelector('.mv-cmp, .pt-empty') &&
                                   /前回の明細との差/.test(s.textContent));
      return {
        rows:   root.querySelectorAll('.mv-c').length,
        pts:    root.querySelectorAll('.pt-chart circle').length,
        first:  (root.querySelector('.mv-c .d') || {}).textContent || '',
        money:  [...root.querySelectorAll('.mv-c')]
                  .filter((e) => /[¥$€£]/.test(e.textContent)).length,
        why:    cmp ? cmp.querySelectorAll('.pt-note').length : -1,
        sheets: root.textContent.includes('記録した明細')
      };
    });

    if (name === 'same') {
      ok(got.rows === 5, `同社の連続2ヶ月：金額3本＋時間2本の5行`, `rows=${got.rows}`);
      ok(got.first === '−3.3%', `総支給の増減が原本通貨で合っている`, got.first);
      ok(got.pts === 2, `折れ線は2点`, `pts=${got.pts}`);
    }
    if (name === 'job') {
      ok(got.rows === 0, `転職直後は差を出さない（前職と引き算しない）`, `rows=${got.rows}`);
      ok(got.pts === 1, `折れ線に前職の月が乗らない（この会社の1点だけ）`, `pts=${got.pts}`);
      ok(got.why >= 1, `なぜ差が出ないのかを書いている`, `note=${got.why}`);
      ok(got.sheets, `枚数の行は残っている（前職ぶんも記録は記録）`);
    }
    if (name === 'cur') {
      ok(got.rows === 2, `通貨が変わった月とは時間だけ比べる`, `rows=${got.rows}`);
      ok(got.money === 0, `金額の増減は1行も出さない（為替が混ざるため）`, `money=${got.money}`);
      ok(got.why >= 1, `金額を出さない理由を書いている`, `note=${got.why}`);
    }
    await page.close();
  }
}

/* ══ メールの同意を預かって適用する（2026-08-14）═══════════════
   set_mail_optin はログイン後にしか呼べないのに、Google とメール内リンクは
   その手前でページを離れる。だからチェックの状態を端末に預け、送信が通った所で
   1回だけ適用する。上の静的な検査は「4つが繋がっている」ことしか見ないので、
   ここで実際のページに偽の sb を渡して、呼ばれる／呼ばれないを確かめる。
   ★守りたいのは「解除した人を勝手に送信へ戻さない」こと。 */
console.log('\nメールの同意（会員登録の側でだけ預かる）');
{
  const page = await newPage();
  page.on('pageerror', (e) => { fail++; console.log('  ❌ JSERR', e.message); });
  await page.goto('http://localhost:3000/pay-report.html', { waitUntil: 'networkidle2' });

  const r = await page.evaluate(async () => {
    const KEY = 'pv_pay_optin';
    const out = {};
    /* 偽の sb。呼ばれたものを控えるだけ。ネットワークには出ない。 */
    const makeSb = (profile) => {
      const calls = [];
      return {
        calls,
        auth: {
          getUser: async () => ({ data: { user: { id: 'u1', email: 'x@example.com' } } }),
          signInWithOtp: async () => { calls.push('otp'); return { data: {}, error: null }; },
          signInWithPassword: async () => { calls.push('password'); return { data: {}, error: { message: 'no' } }; },
        },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }),
        rpc: async (fn) => { calls.push('rpc:' + fn); return { data: { ok: true } }; },
      };
    };
    const mount = document.getElementById('login-gate');
    const open = (sb) => {
      mount.dataset.plReady = '';
      window.PVPayLogin({ sb, lang: 'ja', mount, onSignedIn: () => {} });
    };
    const wait = () => new Promise((r) => setTimeout(r, 150));

    // 会員登録の側から進む → 預かる
    localStorage.removeItem(KEY);
    const s1 = makeSb(null);
    open(s1);
    document.getElementById('pl-up-mail').value = 'new@example.com';
    document.getElementById('pl-up-btn').click();
    await wait();
    out.signup = localStorage.getItem(KEY);
    out.otp = s1.calls.includes('otp');

    // チェックを外した
    localStorage.removeItem(KEY);
    open(makeSb(null));
    document.getElementById('pl-optin').checked = false;
    document.getElementById('pl-up-mail').value = 'new@example.com';
    document.getElementById('pl-up-btn').click();
    await wait();
    out.unchecked = localStorage.getItem(KEY);

    // ログインの側から進む → 預からない
    localStorage.removeItem(KEY);
    open(makeSb(null));
    document.getElementById('pl-in-mail').value = 'old@example.com';
    document.getElementById('pl-in-pass').value = 'pw';
    document.getElementById('pl-in-btn').click();
    await wait();
    out.login = localStorage.getItem(KEY);

    const claim = async (stash, profile) => {
      if (stash === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify(stash));
      const sb = makeSb(profile);
      await window.PVPayLogin.claimOptIn(sb);
      return sb.calls.join(',');
    };
    const fresh = { on: true, at: Date.now() };
    out.applied = await claim(fresh, { email_opt_in: null, email_opt_in_at: null });
    out.left = localStorage.getItem(KEY);
    out.again = await claim(null, { email_opt_in: null, email_opt_in_at: null });
    out.unsubbed = await claim(fresh, { email_opt_in: false, email_opt_in_at: '2026-01-01T00:00:00Z' });
    out.stale = await claim({ on: true, at: Date.now() - 3 * 3600 * 1000 }, { email_opt_in: null, email_opt_in_at: null });
    out.off = await claim({ on: false, at: Date.now() }, { email_opt_in: null, email_opt_in_at: null });
    localStorage.removeItem(KEY);
    return out;
  });

  ok(r.otp, '会員登録の側はコードを送りに行く');
  ok(/"on":true/.test(r.signup || ''), '会員登録の側から進むと同意を預かる', String(r.signup));
  ok(/"on":false/.test(r.unchecked || ''), 'チェックを外すと外したまま預かる', String(r.unchecked));
  ok(r.login === null, 'ログインの側からは預からない（既に決めてある人を書き換えない）', String(r.login));
  ok(r.applied === 'rpc:set_mail_optin', '送信が通ったら set_mail_optin を1回だけ呼ぶ', r.applied);
  ok(r.left === null, '適用したら預かりは消える', String(r.left));
  ok(r.again === '', '二度目は何も呼ばない', r.again);
  ok(r.unsubbed === '', '★解除済みの人には呼ばない（解除がその人の最後の意思）', r.unsubbed);
  ok(r.stale === '', '古い預かりは使わない（別の日の意思をあとから適用しない）', r.stale);
  ok(r.off === '', 'チェックを外した人には呼ばない', r.off);
  await page.close();
}

/* ══ 共有 JS が落ちた形態でも、提出と会員登録に手が届く（2026-09-09）════════
   pay-report.html は二形態で書いてある ── pay-wizard.js が読めれば5段のウィザード、
   読めなければ元の「埋めた分だけ下が生える1枚もの」。
   ★2026-09-08、5段化のときに1枚もの側の段リスト（STEPS）へ `s5` を入れ忘れ、
     **送信ボタンとログインの箱ごと画面から消えていた**（両方 #s5 の子）。
     必須を全部埋めても押す物が1つも出ない＝「給与を出したのに会員登録できない」。
     手元の検査は全部緑のままだった（このかたちを通す検査が1本も無かった）。
   ★ここでは CDN も止めない。止めるのは pay-wizard.js ただ1本。 */
console.log('\n共有 JS が落ちた形態（1枚ものへ戻る）');
for (const [lang, url] of [['ja', 'http://localhost:3000/pay-report.html'],
                           ['en', 'http://localhost:3000/en/pay-report.html']]) {
  const page = await newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.setRequestInterception(true);
  page.on('request', (r) => (/pay-wizard\.js/.test(r.url()) ? r.abort() : r.continue()));
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 800));

  const seen = (id) => page.$eval('#' + id, (el) => el.offsetParent !== null).catch(() => false);
  ok(await page.evaluate(() => typeof window.PVPayWizard === 'undefined'),
     `[${lang}] 前提：ウィザードが読めていない状態を作れている`);

  await page.evaluate(() => document.getElementById('entry-manual').click());
  await new Promise((r) => setTimeout(r, 300));
  ok(!(await seen('submit-btn')), `[${lang}] 入れる前は送信ボタンに手が届かない`);

  const bad = await page.evaluate((o) => {
    const out = [];
    const cb = document.querySelector('input[name="f-jobrole"][value="line"]');
    if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
    for (const [id, v] of Object.entries(o)) {
      const el = document.getElementById(id);
      if (!el) { out.push(id + ': 要素が無い'); continue; }
      el.value = v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      if (String(el.value).replace(/,/g, '') !== String(v)) out.push(id + ": '" + v + "' が入らない");
    }
    return out;
  }, FALLBACK_FILL);
  await new Promise((r) => setTimeout(r, 600));
  ok(bad.length === 0, `[${lang}] 必須を全部入れられる`, bad.join(' / '));

  /* ★offsetParent で測る。getComputedStyle(el).display は**祖先が消えていても**
     自分の値を返すので、「箱ごと画面に無い」を素通しする（この不具合を見逃した形）。 */
  ok(await seen('s5'), `[${lang}] ★全部埋めると 5. 確認の板が出る`);
  ok(await seen('submit-btn'), `[${lang}] ★送信ボタンに手が届く`);

  /* 未ログインで送信を押した人がたどり着く箱。出すのは showGate() の仕事なので
     本物を呼ぶ（display は既定で none ＝ 押すまで出ない）。 */
  const gate = await page.evaluate(() => {
    try { window.showGate(false); } catch (e) { return 'showGate: ' + e.message; }
    return document.getElementById('login-gate').offsetParent !== null;
  });
  await new Promise((r) => setTimeout(r, 300));
  ok(gate === true, `[${lang}] ★ログイン／登録の箱にも手が届く（親ごと消えていない）`, String(gate));
  ok(errs.length === 0, `[${lang}] この経路で JS が落ちない`, errs.join(' / '));
  await page.close();
}

/* ══ 支給の内訳の横棒（確認の段・5/5）════════════════════════════
   出すのは**その月の実額**（shelf の生の月額）。★確認の段の**一番上**に置く
   （2026-09-09 オーナー指示・Marit と同じ並び）。
   ⚠️ 同じ日に「匿名で公開されるイメージ」を廃止した。あちらは**年額の帯**だったので、
      すぐ上の月額と桁が違って別の話に読めた（オーナー指摘「桁も違うのは何？」）。
      → **#wz-public が復活していないこと**もここで見る。戻すと同じ誤読が戻る。
   ★見張るのは4つ：① 内訳を書いていない人にも帯が出る（2026-09-02 の指示）
                    ② 賞与（年額）を月額の帯に混ぜない
                    ③ 帯の色は一覧の丸と同じ規則から取る（欠片に色を直書きしない）
                    ④ 帯と明細が読み返しより**上**にある */
console.log('\n内訳の横棒（確認の段）');
{
  /* 帯だけを見たいので、内訳のある型・1区分だけの型・内訳なしの型を作る。 */
  const BAR_BASE = { ...FALLBACK_FILL, 'f-year': '2026', 'f-month': '7' };
  const CASES = [
    { name: '内訳あり', fill: { 'f-base': '18500', 'f-command': '3200', 'f-profit': '18000' },
      detail: true, segs: 5 },
    /* パーディアムも住居も0にして、基本給だけにした人。帯は1色になるが**出す**。 */
    { name: '1区分だけ', fill: { 'f-base': '54250', 'f-perdiem': '0', 'f-housing': 'none',
                                 'f-housing-amt': '', 'f-profit': '' },
      detail: true, segs: 1 },
    /* 内訳の箱を一度も開かない人。それでもパーディアムと住居は箱の外にあるので数に入る。 */
    { name: '内訳を開かない', fill: {}, detail: false, segs: 3 },
  ];
  for (const [lang, url] of [['ja', 'http://localhost:3000/pay-report.html'],
                             ['en', 'http://localhost:3000/en/pay-report.html']]) {
    for (const cs of CASES) {
      const page = await newPage();
      await page.evaluateOnNewDocument(() => {
        try { localStorage.removeItem('pv_pay_draft'); } catch (e) {}
      });
      await page.setViewport({ width: 390, height: 900 });
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise((r) => setTimeout(r, 500));
      await page.evaluate(() => document.getElementById('entry-manual').click());
      await new Promise((r) => setTimeout(r, 200));
      const fill = (o) => page.evaluate((obj) => {
        const cb = document.querySelector('input[name="f-jobrole"][value="line"]');
        if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
        for (const [id, v] of Object.entries(obj)) {
          const el = document.getElementById(id);
          if (!el) continue;
          el.value = v;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, o);
      await fill(BAR_BASE);
      if (cs.detail) {
        await page.evaluate(() => { document.getElementById('pay-detail').open = true; });
        await new Promise((r) => setTimeout(r, 200));
      }
      await fill(cs.fill);
      await new Promise((r) => setTimeout(r, 300));
      await page.evaluate(() => window.PVPayWizard.goLast());
      await new Promise((r) => setTimeout(r, 700));

      const r = await page.evaluate(() => {
        const dig = (host) => {
          const root = document.getElementById(host);
          const bar = root.querySelector('.wz-cbar');
          return {
            /* 内訳の箱そのもの。★読み返しの節（.wz-rev-sec）より前にあるか。 */
            compFirst: (function () {
              const comp = root.querySelector('.wz-rev-comp');
              const sec = root.querySelector('.wz-rev-sec');
              if (!comp) return 'no-comp';
              if (!sec) return 'no-sec';
              return (comp.compareDocumentPosition(sec) & Node.DOCUMENT_POSITION_FOLLOWING) ? true : false;
            })(),
            /* 帯の欠片。class から区分名を取り、幅は flex の伸び率で読む。 */
            bar: bar ? [...bar.children].map((c) => ({
              k: (c.className.match(/is-([a-z]+)/) || [])[1] || '',
              w: parseFloat(c.style.flex) || 0,
              /* ★欠片に色を直書きしていないこと。書いた瞬間、一覧の丸と別の色になりうる。 */
              inline: c.style.background || c.style.backgroundColor || '',
              paint: getComputedStyle(c).backgroundColor,
            })) : null,
            aria: bar ? bar.getAttribute('aria-hidden') : null,
            wide: bar ? Math.round(bar.getBoundingClientRect().width) : 0,
            /* 一覧の行。丸の class と項目名。 */
            rows: [...root.querySelectorAll('.wz-rev-seg')].map((x) => ({
              k: (x.querySelector('.wz-seg-dot').className.match(/is-([a-z]+)/) || [])[1] || '',
              name: x.querySelector('.wz-seg-k').textContent.trim(),
              v: x.querySelector('.wz-seg-v').textContent.trim(),
            })),
          };
        };
        return { rev: dig('wz-review'), pubBox: !!document.getElementById('wz-public') };
      });
      const tag = '[' + lang + '/' + cs.name + ']';

      /* 本人用の帯は、総支給が入っていれば必ず出る（内訳を書いていない人にも）。
         2026-09-02「給与を出した人には支給構成を必ず出す」と同じ扱い。 */
      ok(r.rev.bar && r.rev.bar.length > 0,
         tag + ' ★本人用の帯が出る（内訳を書いていない人にも）',
         JSON.stringify(r.rev.bar));
      ok(r.rev.bar && r.rev.bar.length === r.rev.rows.length
         && r.rev.bar.every((b, i) => b.k === r.rev.rows[i].k),
         tag + ' ★本人用：帯の並びと一覧の並びが1つずつ同じ（凡例が要らない形）',
         (r.rev.bar || []).map((b) => b.k).join(',') + ' / ' + r.rev.rows.map((x) => x.k).join(','));
      ok((r.rev.bar || []).every((b) => b.inline === ''),
         tag + ' ★帯の欠片に色を直書きしない（一覧の丸と同じ CSS 規則から取る）',
         (r.rev.bar || []).map((b) => b.inline).join(' / '));
      ok((r.rev.bar || []).every((b) => /^rgba?\(/.test(b.paint) && b.paint !== 'rgba(0, 0, 0, 0)'),
         tag + ' ★その規則が実際に効いている（透明のままの欠片が無い）',
         (r.rev.bar || []).map((b) => b.k + ':' + b.paint).join(' / '));
      ok(r.rev.aria === 'true',
         tag + ' 帯は読み上げから外す（同じ内訳を下の一覧が文字で出している）', String(r.rev.aria));
      ok(r.rev.wide > 200, tag + ' 帯が画面の幅いっぱいに伸びている', String(r.rev.wide));
      /* ★これがいちばん壊れやすい。賞与は**年額**で、月額の帯に混ぜると
         同じ人の内訳が確認画面と REAL PAY で違う形になる。 */
      ok((r.rev.bar || []).every((b) => b.k !== 'bonus'),
         tag + ' ★本人用（月額）の帯に賞与（年額）を混ぜない',
         (r.rev.bar || []).map((b) => b.k).join(','));
      const wsum = (r.rev.bar || []).reduce((a, b) => a + b.w, 0);
      ok(Math.abs(wsum - 1) < 0.01, tag + ' 帯の割り当てが合計1（すき間も食い込みも無い）', String(wsum));

      /* ★オーナー指示の本体。内訳を**一番上**に置く。
         下に戻すと、打った欄の読み返しを全部抜けないと全体像に届かない。 */
      ok(r.rev.compFirst === true,
         tag + ' ★支給の内訳が、打った欄の読み返しより上にある', String(r.rev.compFirst));
      ok((r.rev.bar || []).length === cs.segs,
         tag + ' 区分の数が入力どおり（' + cs.segs + '）',
         (r.rev.bar || []).map((b) => b.k).join(','));
      /* ★「匿名で公開されるイメージ」は 2026-09-09 に廃止した（オーナー指示）。
         年額の帯だったので、すぐ上の月額と桁が違って読めた。戻すと同じ誤読が戻る。 */
      ok(r.pubBox === false,
         tag + ' ★公開イメージの面は無い（月額のすぐ下に年額を並べない）', String(r.pubBox));
      ok(errs.length === 0, tag + ' この経路で JS が落ちない', errs.join(' / '));
      await page.close();
    }
  }
}

/* ══ ★2回目以降の入力 ── オーナー決定の10項目（2026-09-12）══════════════════
   ここは「画面は普通に動いたまま静かに壊れる」ものだけを並べてある。
   どれも本番で起きた／起こしかけた形で、直したあと必ずここへ固定している。

     ★1  基本給あり・保証給 0・変動給1行で提出に手が届く
     ★2  未回答が 0 に変わらない（画面・下書き・payload）
     ★3  別の月を始めたら前月の実績が残らない
     ★4  同じ月の再開では打ったものが全部戻る
     ★5  基本給 0 ＝ 回答済み／空欄 ＝ 入力不足（保証給も同じ）
     ★6  合計の3状態（全行未入力＝空／0 だけの1行＝'0'／未回答混在＝partial）
     ★7  追加用の空の行を「未回答」に数えない
     ★8  新しい月では、前月に本人が打った実績も落ちる（月次手当・活動日数・回数まで）
          ＋ 元の月の下書きは残っている
     ★9  同じ月の再アップロードでは、本人が打った値は落ちない
     ★10 明細を落としても基本情報は引き継がれる（候補にするのは固定金額だけ）

   ⚠️ 0 と空欄は「数に落としてから」では見分けられない（オーナー指摘）。
      見ているのは moneyRead() の state と、送る payload の null / '0' そのもの。 */
console.log('\n★2回目以降の入力（オーナー決定の10項目）');

/* 前回の内容（＝翌月のひな型）。CARRY.info と CARRY.fixed と shape だけ。
   ★実績（CARRY.never）は1つも入れない ── 入れてはいけないものが入っていないことは
     すぐ下の「前月の実績が1つも戻らない」が見ている。 */
const CARRY_LAST = {
  'f-airline': 'emirates', 'f-position': 'cap', 'f-fleet': 'b777', 'f-currency': 'AED',
  'f-age': '40-49', 'f-jobrole': 'line,instructor,union', 'f-housing': 'allowance',
  'f-contract': 'direct', 'f-seniority': '12', 'f-taxcountry': 'AE', 'f-tax': '0',
  'f-base': '48500', 'f-guarantee': '0', 'f-command': '3200', 'f-housing-amt': '17500',
  'f-payitems': JSON.stringify({ v: 1, variable: [{ label: 'Flight Pay', basis: 'block' }] }),
};

for (const [lang, url] of [['ja', 'http://localhost:3000/pay-report.html'],
                           ['en', 'http://localhost:3000/en/pay-report.html']]) {
  const T = `${lang}:`;
  const page = await newPage();
  await page.setViewport({ width: 1440, height: 1200 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  /* ⚠️ 置くのは evaluateOnNewDocument（次の文書が動き出す前）。素の evaluate で
     書いて reload すると、離れる拍子の savePreset() が空のフォームで上書きする。 */
  await page.evaluateOnNewDocument((f, t) => {
    try { localStorage.setItem('pv_pay_last',
      JSON.stringify(Object.assign({}, f, { _own: 'anon', _ts: t, _tab: '' }))); } catch (e) {}
  }, CARRY_LAST, Date.now());
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 500));

  const set = (o) => page.evaluate((obj) => {
    const out = [];
    for (const [id, v] of Object.entries(obj)) {
      const el = document.getElementById(id);
      if (!el) { out.push(id + ': 要素が無い'); continue; }
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return out;
  }, o);
  const fv = (id) => page.$eval('#' + id, (el) => String(el.value).replace(/,/g, ''));
  const fvs = (ids) => page.evaluate((list) => {
    const o = {};
    for (const id of list) { const e = document.getElementById(id); o[id] = e ? e.value : null; }
    return o;
  }, ids);
  /* 送る中身そのもの。画面の見た目ではなく、**保存に渡る値**で 0 と未回答を見分ける。 */
  const pay = () => page.evaluate(() => buildPayload());
  /* 変動給・その他の行を丸ごと入れ替える（本物の pdAdd / pdSync を使う）。 */
  const rows = (kind, list) => page.evaluate((k, items) => {
    const box = document.getElementById('pd-' + k + '-rows');
    while (box.children.length) box.firstElementChild.remove();
    for (const it of items) {
      const row = pdAdd(k, true);
      const put = (sel, v) => { const e = row.querySelector(sel); if (e && v != null) e.value = v; };
      put('.pd-label', it.label); put('.pd-basis', it.basis); put('.pd-amt', it.amount);
    }
    pdSync();
    let pi = null;
    try { pi = JSON.parse(document.getElementById('f-payitems').value || 'null'); } catch (e) {}
    return { pi, sum: document.getElementById('f-var-sum').value };
  }, kind, list);

  await page.click('#entry-manual');
  await new Promise((r) => setTimeout(r, 350));

  /* ── ★3（入口）前月の実績は、ひな型に1つも入っていない ───────────── */
  const NEVER_SHOWN = ['f-gross', 'f-netpay', 'f-block', 'f-stay', 'f-duty', 'f-perdiem',
                       'f-bonus-mo', 'f-other', 'f-transport', 'f-hourly',
                       'f-instructor', 'f-union-pay', 'f-mgmt-pay', 'f-nonline-pay'];
  const n0 = await fvs(NEVER_SHOWN);
  ok(NEVER_SHOWN.every((id) => n0[id] === ''),
     `${T} ★3 2回目の画面に前月の実績が1つも入っていない`,
     Object.entries(n0).filter(([, v]) => v !== '').map(([k, v]) => k + '=' + v).join(' / '));
  /* 固定と分かる額は逆に入っている（打ち直させない）。**0 も有効な前回額**。 */
  ok((await fv('f-base')) === '48500' && (await fv('f-guarantee')) === '0',
     `${T} ★3 契約で決まる額は前回のまま出てくる（保証給の 0 も引き継ぐ）`,
     `${await fv('f-base')} / ${await fv('f-guarantee')}`);
  ok(await page.$eval('#f-base', (el) => el.classList.contains('pv-carried'))
     && !(await page.$eval('#f-base', (el) => el.classList.contains('ai-filled'))),
     `${T} ★3 引き継いだ額には「前回から引き継ぎ」の印だけが付く（明細の緑枠は付けない）`);
  /* 変動給は形だけ ── 項目名は戻り、金額は空。 */
  const vr0 = await page.evaluate(() => Array.from(document.querySelectorAll('#pd-var-rows .pd-row'))
    .map((r) => ({ label: (r.querySelector('.pd-label') || {}).value || '',
                   amt: (r.querySelector('.pd-amt') || {}).value || '' })));
  ok(vr0.length === 1 && vr0[0].label === 'Flight Pay' && vr0[0].amt === '',
     `${T} ★3 変動給は項目名と支給単位だけ引き継ぎ、金額は空で出す`, JSON.stringify(vr0));

  /* ── ★5 基本給・保証給の 0 と空欄 ──────────────────────────────── */
  await page.evaluate(() => { const d = document.getElementById('pay-detail'); if (d) d.open = true; });
  await set({ 'f-base': '0', 'f-guarantee': '0' });
  let p = await pay();
  ok(p.base_pay === '0' && p.guarantee_pay === '0',
     `${T} ★5 基本給 0・保証給 0 は「回答済み」として送る（未回答に化けない）`,
     JSON.stringify({ base: p.base_pay, guar: p.guarantee_pay }));
  await set({ 'f-base': '', 'f-guarantee': '' });
  p = await pay();
  ok(p.base_pay === null && p.guarantee_pay === null,
     `${T} ★5 空欄は未回答（null）のまま送る（0 に書き換えない）`,
     JSON.stringify({ base: p.base_pay, guar: p.guarantee_pay }));
  /* ⚠️ 数に落としてからでは見分けられない。画面側の見分け役は moneyRead() の state。 */
  const st = await page.evaluate(() => {
    const b = document.getElementById('f-base');
    const r = [];
    b.value = '0'; r.push(moneyRead(b).state);
    b.value = '';  r.push(moneyRead(b).state);
    return r;
  });
  ok(st[0] === 'ok' && st[1] === 'empty',
     `${T} ★5 見分けているのは「入っているか」であって「0 より大きいか」ではない`, st.join(' / '));
  await set({ 'f-base': '48500' });

  /* ── ★6 合計の3状態 ＋ ★7 追加用の空の行 ─────────────────────── */
  let r6 = await rows('var', [{ label: 'Flight Pay', basis: 'block' }]);
  ok(r6.sum === '' && !(r6.pi && r6.pi.partial),
     `${T} ★6 実項目が全部未入力なら合計は空（0 と書かない）`, JSON.stringify(r6));
  ok((await pay()).other_allowance === null,
     `${T} ★6 そのとき送るその他手当も未回答（null）`, String((await pay()).other_allowance));

  r6 = await rows('var', [{ label: 'Flight Pay', basis: 'block', amount: '0' }]);
  ok(r6.sum === '0' && !(r6.pi && r6.pi.partial),
     `${T} ★6 本人が入れた 0 は回答 ── 合計も 0（空欄に戻さない）`, JSON.stringify(r6));
  ok((await pay()).other_allowance === '0',
     `${T} ★6 そのとき送るその他手当も '0'`, String((await pay()).other_allowance));

  r6 = await rows('var', [{ label: 'Flight Pay', basis: 'block', amount: '4000' },
                          { label: 'Sector Pay', basis: 'sector' }]);
  ok(r6.sum === '4000' && r6.pi && r6.pi.partial === true,
     `${T} ★6 未回答の実項目が混じれば「入力済み分の合計」＝ partial を立てる`, JSON.stringify(r6));

  r6 = await rows('var', [{ label: 'Flight Pay', basis: 'block', amount: '4000' }, {}]);
  ok(r6.sum === '4000' && !(r6.pi && r6.pi.partial),
     `${T} ★7 ＋を押しただけの空の行は「未回答」に数えない（押すたび partial にしない）`,
     JSON.stringify(r6));

  /* ── ★1 基本給あり・保証給 0・変動給1行で、送信に手が届く ───────── */
  await rows('var', [{ label: 'Flight Pay', basis: 'block', amount: '4000' }]);
  await set({ 'f-year': '2026', 'f-month': '7', 'f-base': '48500', 'f-guarantee': '0',
              'f-gross': '54250', 'f-netpay': '41200', 'f-block': '86.5',
              'f-perdiem': '6200', 'f-bonus-mo': '0' });
  await new Promise((r) => setTimeout(r, 200));
  const miss = await page.evaluate(() => missingAll().map((f) => {
    const e = f.querySelector('input,select,textarea');
    return e ? (e.id || e.name) : (f.id || '?');
  }));
  ok(miss.length === 0,
     `${T} ★1 基本給あり・保証給 0・変動給1行で、足りない必須が1つも無い`, miss.join(' / '));

  /* ── ★2 未回答が 0 に変わらない（画面・下書き・payload）───────────── */
  ok((await fv('f-stay')) === '' && (await fv('f-duty')) === '',
     `${T} ★2 任意のステイ日数・乗務日数は空のまま（0 を置かない）`,
     `${await fv('f-stay')} / ${await fv('f-duty')}`);
  p = await pay();
  ok(p.stay_nights === null && p.duty_days === null,
     `${T} ★2 送るときも未回答（null）── 0 で埋めない`,
     JSON.stringify({ stay: p.stay_nights, duty: p.duty_days }));
  ok(p.bonus_month === '0',
     `${T} ★2 本人が入れた 0 は 0 のまま送る（未回答に戻さない）`, String(p.bonus_month));
  await page.evaluate(() => window.PVPayWizard.saveDraft());
  const dr = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('pv_pay_draft') || 'null'); } catch (e) { return null; }
  });
  ok(dr && dr.fields && !('f-stay' in dr.fields) && dr.fields['f-bonus-mo'] === '0',
     `${T} ★2 下書きでも同じ ── 未回答は控えず、本人の 0 だけを控える`,
     JSON.stringify({ stay: dr && dr.fields ? dr.fields['f-stay'] : '?',
                      bonus: dr && dr.fields ? dr.fields['f-bonus-mo'] : '?' }));

  /* ── ★4 同じ月の再開では、打ったものが全部戻る ──────────────────── */
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 900));
  /* ⚠️ 下書きを戻すのは入口の2択を抜けてから（start()）。ここを飛ばすと
     「戻らなかった」ではなく「まだ戻す場面ではない」を見てしまう。 */
  await page.click('#entry-manual');
  await new Promise((r) => setTimeout(r, 500));
  const back = await fvs(['f-year', 'f-month', 'f-gross', 'f-netpay', 'f-block',
                          'f-bonus-mo', 'f-perdiem', 'f-base', 'f-stay']);
  ok(back['f-gross'].replace(/,/g, '') === '54250' && back['f-netpay'].replace(/,/g, '') === '41200'
     && back['f-block'] === '86.5' && back['f-year'] === '2026' && back['f-month'] === '7',
     `${T} ★4 同じ月の続きは、その月の実績まで全部戻る`, JSON.stringify(back));
  ok(back['f-bonus-mo'] === '0',
     `${T} ★4 本人が入れた 0 も 0 のまま戻る`, back['f-bonus-mo']);
  ok(back['f-stay'] === '',
     `${T} ★4 空欄は空欄のまま戻る（再開のついでに 0 を置かない）`, back['f-stay']);
  const vrBack = await page.evaluate(() => Array.from(document.querySelectorAll('#pd-var-rows .pd-row'))
    .map((r) => ((r.querySelector('.pd-amt') || {}).value || '').replace(/,/g, ''))
    .filter((x) => x !== ''));
  ok(vrBack.length === 1 && vrBack[0] === '4000',
     `${T} ★4 変動給の行も金額ごと戻る（形だけにしない）`, JSON.stringify(vrBack));

  /* ── ★8 新しい月では、前月に本人が打った実績も落ちる ────────────── */
  /* 役割モジュールの「今月ぶん」を入れる。ここが残ると、内訳の合計が総支給を超えて
     REAL PAY の支給構成の帯が黙って消える（2026-09-11 に本番で1件）。 */
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('input[name="f-jobrole"]'))
      if (['line', 'instructor', 'union'].indexOf(b.value) >= 0 && !b.checked) {
        b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true }));
      }
  });
  await new Promise((r) => setTimeout(r, 200));
  /* ⚠️ 金額の欄は「別途支給されている」「あり」を選ぶまで出ていない
     （選ばない人は2〜3クリックで抜けられる作り）。先に開けてから入れる。 */
  await set({ 'f-instr-extra': 'separate', 'f-union-extra': 'yes' });
  await new Promise((r) => setTimeout(r, 150));
  await set({ 'f-instr-method': 'session', 'f-union-src': 'airline' });
  await new Promise((r) => setTimeout(r, 150));
  await set({ 'f-instructor': '21000', 'f-instr-qty': '4',
              'f-union-pay': '30000', 'f-union-days': '3' });
  const before8 = await fvs(['f-instructor', 'f-instr-qty', 'f-union-pay', 'f-union-days']);
  ok(Object.values(before8).every((v) => v && v !== ''),
     `${T} ★8 前提 ── 月次手当と活動日数・回数が入っている`, JSON.stringify(before8));

  await page.evaluate(() => startNewMonth());
  await new Promise((r) => setTimeout(r, 300));
  const MONTHLY = ['f-gross', 'f-netpay', 'f-block', 'f-perdiem', 'f-bonus-mo', 'f-stay', 'f-duty',
                   'f-instructor', 'f-examiner', 'f-union-pay', 'f-mgmt-pay', 'f-nonline-pay',
                   'f-instr-qty', 'f-exam-qty', 'f-union-days', 'f-mgmt-days', 'f-nonline-days'];
  const after8 = await fvs(MONTHLY);
  ok(MONTHLY.every((id) => after8[id] === '' || after8[id] === null),
     `${T} ★8 新しい月では、本人が打った実績も月次手当も活動日数・回数も落ちる`,
     Object.entries(after8).filter(([, v]) => v).map(([k, v]) => k + '=' + v).join(' / '));
  const keep8 = await fvs(['f-airline', 'f-position', 'f-fleet', 'f-contract', 'f-taxcountry', 'f-base']);
  ok(keep8['f-airline'] === 'emirates' && keep8['f-position'] === 'cap'
     && keep8['f-contract'] === 'direct' && keep8['f-taxcountry'] === 'AE'
     && keep8['f-base'].replace(/,/g, '') === '48500',
     `${T} ★8 会社・職位・契約・納税地・固定額はそのまま（毎月通り直させない）`,
     JSON.stringify(keep8));
  const vr8 = await page.evaluate(() => Array.from(document.querySelectorAll('#pd-var-rows .pd-row'))
    .map((r) => ((r.querySelector('.pd-amt') || {}).value || '')).filter((x) => x !== ''));
  ok(vr8.length === 0, `${T} ★8 変動給の金額も残らない`, JSON.stringify(vr8));

  /* 元の月の下書きは残っている ── 月を戻せば「戻しますか」が出て、押せば全部返る。 */
  await set({ 'f-year': '2026', 'f-month': '7' });
  await new Promise((r) => setTimeout(r, 250));
  ok(await page.$eval('#wz-offer', (el) => !el.hidden && /(19|20)\d\d/.test(el.textContent)),
     `${T} ★8 元の月の下書きは残っていて、その月を選ぶと名指しで知らせる`,
     await page.$eval('#wz-offer', (el) => el.textContent.trim()));
  await page.evaluate(() => window.PVPayWizard.restoreMonth('2026-7'));
  await new Promise((r) => setTimeout(r, 300));
  ok((await fv('f-gross')) === '54250' && (await fv('f-instructor')) === '21000',
     `${T} ★8 押せば元の月の実績が全部返る（新しい月を始めても失わない）`,
     `${await fv('f-gross')} / ${await fv('f-instructor')}`);

  /* ── ★9 同じ月の再アップロードでは、本人が打った値は落ちない ───────
     ＋ ★10 基本情報は引き継いだまま・候補にするのは固定金額だけ。 */
  const drop = await page.evaluate(() => ({
    n: window.PVPayDropPrevMonth(),
    carried: Object.assign({}, window.PVPayCarriedDropped()),
  }));
  const after9 = await fvs(['f-gross', 'f-instructor', 'f-netpay']);
  ok(after9['f-gross'].replace(/,/g, '') === '54250'
     && after9['f-instructor'].replace(/,/g, '') === '21000',
     `${T} ★9 明細を落とし直しても、本人がこの月に打った値は消えない`,
     JSON.stringify(after9) + ' / ' + JSON.stringify(drop));
  const keep10 = await fvs(['f-airline', 'f-position', 'f-fleet', 'f-contract', 'f-taxcountry']);
  ok(keep10['f-airline'] === 'emirates' && keep10['f-position'] === 'cap'
     && keep10['f-fleet'] === 'b777' && keep10['f-contract'] === 'direct'
     && keep10['f-taxcountry'] === 'AE',
     `${T} ★10 明細を落としても会社・職位・機材・契約・納税地は引き継いだまま`,
     JSON.stringify(keep10));
  ok((await fv('f-command')) === '' && drop.carried['f-command'] === '3,200',
     `${T} ★10 触っていない固定額は空にして、前回額は候補として控えるだけ（勝手に入れ直さない）`,
     `画面=${await fv('f-command')} / 控え=${JSON.stringify(drop.carried)}`);

  ok(errs.length === 0, `${T} この経路で JS が1つも落ちない`, errs.join(' / '));
  await page.close();
}

/* ══ ★11 確認画面の「出どころの札」が、行の外へ出ない（2026-09-12）══════════
   .wz-rev-src は order:3 + width:100% で「自分の行へ落ちる」つもりで書いてある。
   ところが親の .wz-rev-row に flex-wrap が無いと、札は同じ行に居座ったまま
   幅 100% を主張し、欄名と金額を**1文字ずつの縦書き**に潰して、
   札だけカードの外へはみ出す。── 実際にそうなっていた（shot-pay の絵で気づいた）。
   ⚠️ ページ全体の横溢れ（measure-pay.mjs の②）では捕まらない。1440px では
      はみ出した札が画面の中に収まってしまうし、狭い幅の測定は「3. 報酬」の段しか見ない。
   ⚠️ 札が1枚も無いと、この検査は黙って何も見なくなる。先に枚数を数える。 */
console.log('\n★確認画面の出どころの札（行からはみ出さない）');
for (const [lang, url] of [['ja', 'http://localhost:3000/pay-report.html'],
                           ['en', 'http://localhost:3000/en/pay-report.html']]) {
  const T = `${lang}:`;
  const page = await newPage();
  await page.setViewport({ width: 390, height: 1400 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.evaluateOnNewDocument((f, t) => {
    try { localStorage.setItem('pv_pay_last',
      JSON.stringify(Object.assign({}, f, { _own: 'anon', _ts: t, _tab: '' }))); } catch (e) {}
  }, CARRY_LAST, Date.now());
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 600));
  await page.click('#entry-manual');
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => window.PVPayWizard.goLast());
  await new Promise((r) => setTimeout(r, 700));

  const m = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#wz-review .wz-rev-row'));
    const out = { srcs: 0, sameLine: [], outside: [], thin: [],
                  secs: [], missing: [], guar: null };
    /* ★12 の材料。欄名は画面から読む（日英で文言を書き写さない）。 */
    out.secs = Array.from(document.querySelectorAll('#wz-review section.wz-rev-sec .wz-rev-t'))
      .map((e) => e.textContent.trim());
    const keyOf = (r) => { const k = r.querySelector('.wz-rev-k'); return k ? k.textContent.trim() : ''; };
    const valOf = (r) => { const v = r.querySelector('.wz-rev-v'); return v ? v.textContent.trim() : ''; };
    for (const id of ['f-base', 'f-guarantee', 'f-command', 'f-housing-amt']) {
      const l = document.querySelector('label[for="' + id + '"]');
      if (!l) continue;
      /* ★「必須」「任意」の札は欄名ではない（pay-wizard.js の fieldLabel が落としている）。
         ここで落とさないと「住宅手当（月額）必須」を探して、出ている行を見落とす。 */
      const c = l.cloneNode(true);
      c.querySelectorAll('.req-tag, .opt-tag, .auto-tag, .miss-tag').forEach((t) => t.remove());
      const want = c.textContent.trim();
      const hit = rows.find((r) => keyOf(r) === want);
      if (!hit) out.missing.push(id + '（' + want + '）');
      else if (id === 'f-guarantee') out.guar = valOf(hit);
    }
    for (const row of rows) {
      const rr = row.getBoundingClientRect();
      for (const c of Array.from(row.children)) {
        const cr = c.getBoundingClientRect();
        if (cr.width === 0 && cr.height === 0) continue;
        if (cr.right > rr.right + 1 || cr.left < rr.left - 1)
          out.outside.push((c.className || '') + ' ' + Math.round(cr.left) + '..'
                           + Math.round(cr.right) + ' / 行 ' + Math.round(rr.left) + '..'
                           + Math.round(rr.right));
      }
      const src = row.querySelector('.wz-rev-src');
      const v = row.querySelector('.wz-rev-v');
      if (!src) continue;
      out.srcs++;
      if (v) {
        const sr = src.getBoundingClientRect(), vr = v.getBoundingClientRect();
        /* 札が金額と同じ行に居る＝折り返していない。 */
        if (sr.top < vr.bottom - 1) out.sameLine.push(src.textContent.trim());
        /* ★金額の欄が潰れると、1文字ずつ縦に折れて**高さだけ**が伸びる。
           ⚠️ 幅だけで見ない。「0」も「12」も普通に幅が狭い（中身に合わせた箱なので）。
              見るのは「行数が文字数に近いか」── 1文字ずつ折れている形だけを捕まえる。 */
        const lh = parseFloat(getComputedStyle(v).lineHeight) || 20;
        const lines = Math.max(1, Math.round(vr.height / lh));
        const chars = (v.textContent || '').replace(/\s/g, '').length;
        if (lines > 1 && chars > 0 && lines >= chars * 0.6)
          out.thin.push(v.textContent.trim() + ' ' + lines + '行 / ' + chars + '文字');
      }
    }
    return out;
  });
  ok(m.srcs > 0, `${T} ★11 出どころの札が実際に出ている（検査が空振りしていない）`,
     String(m.srcs));
  ok(m.sameLine.length === 0, `${T} ★11 札は自分の行へ落ちる（金額と同じ行に居座らない）`,
     m.sameLine.join(' / '));
  ok(m.outside.length === 0, `${T} ★11 確認画面の行から、はみ出す要素が1つも無い`,
     m.outside.join(' / '));
  ok(m.thin.length === 0, `${T} ★11 金額の欄が1文字ずつの縦書きに潰れない`,
     m.thin.join(' / '));

  /* ── ★12 確認画面に「出すもの」が全部載る（2026-09-12）────────────────
     2回目以降は1段目が s2 で、s1・s3・s4 を steps[].also で連れて出している。
     確認画面が $(s.id) だけを読んでいたあいだ、**「3. 報酬」が1行も出なかった**
     ── 本人がその画面で打ったばかりの総支給も基本給も、出す前に読み返せない。
     さらに fieldValue() が「札があれば札だけ読む」と分岐していたので、
     **基本給と保証給は「該当なし」の札と同居しているせいで行ごと落ちていた。**
     どちらも画面はどこも壊れないまま静かに消える形。
     ⚠️ 保証給の 0 も1行として出す（0 ＝ 回答済み。空欄と区別がつかなくなる）。 */
  ok(m.secs.length === 4, `${T} ★12 確認画面に4つの節が全部出る（畳んだ節・連れて出した箱も読む）`,
     m.secs.join(' | '));
  ok(m.missing.length === 0, `${T} ★12 基本給・保証給・職位手当・住宅手当が確認画面に出る`,
     m.missing.join(' / '));
  ok(m.guar === '0', `${T} ★12 保証給の 0 が「回答済み」として1行出る（空欄として捨てない）`,
     String(m.guar));
  await page.close();
}

/* ══ ★13 前月の「該当なし」の引き継ぎ（2026-09-12・指摘2）═════════════════════════
   翌月のひな型に写す「該当なし」は**2つだけ**にした。

     基本給なし・保証給なし … 会社にその項目が無いという、去年から変わらない事実。
                              ★引き継ぐ。ただし**チェックではなく「前回の 0」**として
                                金額欄に置く（打ち替えるだけで新しい額になる）。
     変動給なし             … **毎月変わる今月の事実**。★翌月へ持ち込まない。
                              持ち込むと、前月に「なし」と答えた人が今月も一度も
                              聞かれないまま「なし」で提出できる（チェックが自動で入り、
                              必須の判定も回答済みとして通る＝画面はどこも壊れない）。

   ⚠️ 端末に残っている古いひな型には variable_none が入っている。下の NONE_LAST は
      **わざとそれを入れてある** ── 画面側でも落としていることの証拠。
   ⚠️ 過去に保存した行は1件も書き換えない。同じ月の下書きから戻すときは
      今までどおりチェックが復元される（互換）。ここで見ているのは
      「翌月のひな型に持ち込むか」だけ。 */
console.log('\n★13 前月の「該当なし」の引き継ぎ（指摘2）');

const NONE_LAST = {
  'f-airline': 'emirates', 'f-position': 'cap', 'f-fleet': 'b777', 'f-currency': 'AED',
  'f-age': '40-49', 'f-jobrole': 'line', 'f-housing': 'allowance',
  'f-contract': 'direct', 'f-seniority': '12', 'f-taxcountry': 'AE', 'f-tax': '0',
  'f-command': '3200', 'f-housing-amt': '17500',
  'f-payitems': JSON.stringify({ v: 2, fixed_none: true, guarantee_none: true,
                                 variable_none: true }),
};

for (const [lang, url] of [['ja', 'http://localhost:3000/pay-report.html'],
                           ['en', 'http://localhost:3000/en/pay-report.html']]) {
  const T = `${lang}:`;
  const open = async () => {
    const page = await newPage();
    await page.setViewport({ width: 1440, height: 1200 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    await page.evaluateOnNewDocument((o, t) => {
      try { localStorage.setItem('pv_pay_last',
        JSON.stringify(Object.assign({}, o, { _own: 'anon', _ts: t, _tab: '' }))); } catch (e) {}
    }, NONE_LAST, Date.now());
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 500));
    await page.click('#entry-manual');
    await new Promise((r) => setTimeout(r, 350));
    return page;
  };

  const page = await open();
  const st = (id) => page.evaluate((i2) => {
    const e = document.getElementById(i2);
    return e ? { v: String(e.value), carried: e.classList.contains('pv-carried'),
                 disabled: !!e.disabled } : null;
  }, id);
  const chk = (id) => page.evaluate((i2) => {
    const e = document.getElementById(i2); return e ? !!e.checked : null;
  }, id);

  /* ── ★13 「変動給なし」は翌月へ持ち込まない ───────────────────── */
  ok((await chk('f-variable-none')) === false,
     `${T} ★13 前月「変動給なし」でも、今月のチェックは入っていない`);
  ok((await st('f-var-sum')).v === '',
     `${T} ★13 変動給の合計が勝手に 0 で埋まっていない`, (await st('f-var-sum')).v);
  {
    /* いちばんの証拠 ── **今月も書ける**。前月のチェックが入ったままだと
       varNoneSync() が「変動給を追加」も行の欄も触れなくするので、
       今月は変動給を1行も書けないまま「なし」で提出できてしまう。 */
    const st13 = await page.evaluate(() => ({
      btn: !!document.getElementById('pd-var').disabled,
      rows: document.getElementById('pd-var-rows').children.length,
      locked: [...document.getElementById('pd-var-rows')
        .querySelectorAll('input,select')].filter((e) => e.disabled).length,
    }));
    ok(st13.btn === false && st13.locked === 0,
       `${T} ★13 今月も変動給を書ける（前月の「なし」で入力欄を塞がない）`,
       JSON.stringify(st13));
  }
  {
    const p = await page.evaluate(() => buildPayload());
    const pi = p.pay_items || {};
    ok(pi.variable_none !== true,
       `${T} ★13 送る中身にも「変動給なし」が入っていない`, JSON.stringify(pi).slice(0, 160));
  }

  /* ── ★14 「基本給なし・保証給なし」は前回の 0 として金額欄に出る ─────── */
  const b14 = await st('f-base'), g14 = await st('f-guarantee');
  ok(b14.v === '0' && g14.v === '0',
     `${T} ★14 前月「なし」は「前回の 0」として金額欄に出る`,
     `base=${b14.v} / guarantee=${g14.v}`);
  ok(b14.carried && g14.carried,
     `${T} ★14 引き継ぎの印が付く（確認画面で「前回から引き継ぎ」と出る根拠）`);
  ok(!b14.disabled && !g14.disabled,
     `${T} ★14 欄は使えるまま（チェックを外す操作をさせない）`);
  ok((await chk('f-base-none')) === false && (await chk('f-guarantee-none')) === false,
     `${T} ★14 「該当なし」のチェックは入れない（打ち替えるだけで新しい額になる）`);

  /* ── ★15 金額を入れたら、古い「該当なし」が優先しない ────────────── */
  await page.evaluate(() => {
    const e = document.getElementById('f-base');
    e.value = '48500';
    e.dispatchEvent(new Event('input', { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 200));
  {
    const p = await page.evaluate(() => buildPayload());
    const pi = p.pay_items || {};
    ok(pi.fixed_none !== true && String(p.base_pay).replace(/,/g, '') === '48500',
       `${T} ★15 新しい金額が勝つ（古い「基本給なし」は送らない）`,
       `base_pay=${p.base_pay} / pay_items=${JSON.stringify(pi).slice(0, 120)}`);
  }
  {
    /* 同じ月の下書きから戻した人（チェックが入ったまま金額も入る形）にも効く。 */
    const r = await page.evaluate(() => {
      document.getElementById('f-guarantee-none').checked = true;
      const e = document.getElementById('f-guarantee');
      e.value = '7200';
      e.dispatchEvent(new Event('input', { bubbles: true }));
      pdSync();
      let pi = null;
      try { pi = JSON.parse(document.getElementById('f-payitems').value || 'null'); } catch (e2) {}
      return { checked: document.getElementById('f-guarantee-none').checked,
               disabled: !!document.getElementById('f-guarantee').disabled, pi };
    });
    ok(r.checked === false && r.disabled === false && !(r.pi && r.pi.guarantee_none),
       `${T} ★15 金額が入っている欄の「該当なし」は自動で外れる（送らない）`,
       JSON.stringify(r));
  }

  /* ── ★16 会社・職位・契約・通貨が変わったら、引き継いだ固定額を見直す ──── */
  {
    /* f-command は本人が打ち直した（＝印が外れる）。f-housing-amt は引き継いだまま。 */
    await page.evaluate(() => {
      const e = document.getElementById('f-command');
      e.value = '9900';
      e.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const before = { cmd: (await st('f-command')), hou: (await st('f-housing-amt')) };
    const n = await page.evaluate(() => {
      const e = document.getElementById('f-position');
      e.value = 'fo';
      e.dispatchEvent(new Event('change', { bubbles: true }));
      return window.PVPayCarryKeyChanged ? 0 : -1;   // リスナー側で既に走っている
    });
    await new Promise((r) => setTimeout(r, 200));
    const after = { cmd: (await st('f-command')), hou: (await st('f-housing-amt')),
                    base: (await st('f-base')) };
    ok(after.hou.v === '' && !after.hou.carried,
       `${T} ★16 職位が変わったら、引き継いだ住宅手当は空になる`,
       `前=${before.hou.v} 後=${after.hou.v} / n=${n}`);
    ok(after.cmd.v.replace(/,/g, '') === '9900' && after.base.v.replace(/,/g, '') === '48500',
       `${T} ★16 本人が打ち直した額には触らない`,
       `command=${after.cmd.v} / base=${after.base.v}`);
  }
  await page.close();

  /* ── ★17 アップロードでは「前回の 0」を残さない（今回の明細を基準にする）── */
  {
    const p2 = await open();
    const b0 = await p2.$eval('#f-base', (e) => String(e.value));
    const drop = await p2.evaluate(() => ({
      n: window.PVPayDropPrevMonth(),
      carried: Object.assign({}, window.PVPayCarriedDropped()),
    }));
    const b1 = await p2.$eval('#f-base', (e) => String(e.value));
    const g1 = await p2.$eval('#f-guarantee', (e) => String(e.value));
    ok(b0 === '0' && b1 === '' && g1 === '',
       `${T} ★17 明細を落としたら「前回の 0」は消える（読めなかった額を 0 にしない）`,
       `落とす前=${b0} / 落とした後=${b1},${g1} / n=${drop.n}`);
    ok(drop.carried['f-base'] === '0' && drop.carried['f-guarantee'] === '0',
       `${T} ★17 前回の 0 は「候補」として控えるだけ（押されたときだけ入る）`,
       JSON.stringify(drop.carried));
    ok((await p2.evaluate(() => document.getElementById('f-base-none').checked)) === false,
       `${T} ★17 「該当なし」のチェックも入らない`);
    await p2.close();
  }
}

await browser.close();
await db.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
