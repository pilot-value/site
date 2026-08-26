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
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8');

/* ★給与を保存したあとに鳴ってよい RPC。ここに書いた名前だけが「ほかの RPC」から外れる。
   待遇の質問（pv-conditions.js）はレポートが出たあとに動く。給与の保存とは別の口で、
   落ちてもレポートに触らない。増やすときは「保存より後にしか鳴らないこと」を確かめてから。
   ⚠️ 2つの検査（下書き経路・ログイン済み経路）の両方から参照するのでモジュール直下に置く。 */
const READ_OK = ['next_condition_questions', 'submit_airline_conditions'];
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
  ok(!/function calc\(/.test(read('pay-tracker.js')),
     `pay-tracker.js は calc() を持ち帰っていない`);

  /* 総支給（差引支給額 ＋ 控除合計）も同じ。pay_reports に総支給の列は無いので
     足して出すしかないが、my-value.js の §4（額面と手取り）・§6（前回との差）・
     §7b（累計）が全部「総支給」を名乗る。写した瞬間に、同じページの中で
     違う額面が並ぶ。pay-viz.js の grossOrig() 1つに寄せてある。 */
  const GROSS = 'if (n != null && d != null) return n + d;';
  const gHolders = files.filter((f) => read(f).includes(GROSS));
  ok(gHolders.length === 1 && gHolders[0] === 'pay-viz.js',
     `総支給の式を持っているのは pay-viz.js だけ`, gHolders.join(','));

  // 読み込み順（pay-viz.js が後だと PVViz が未定義でカードごと消える）
  for (const [f, up] of [['profile.html', ''], ['en/profile.html', '../']]) {
    const s = read(f);
    // ★ファイル名だけで探さない。どちらも本文のコメントに出てくる（JA 側は
    //   <!-- 明細トラッカー（pay-tracker.js が中身を描く） --> が先に当たる）。
    const viz = s.indexOf(`<script src="${up}pay-viz.js">`);
    const trk = s.indexOf(`<script src="${up}pay-tracker.js">`);
    ok(viz > 0 && trk > 0 && viz < trk,
       `${f}: pay-viz.js を pay-tracker.js より先に読む`, `viz=${viz} trk=${trk}`);
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

  // ① 読み込み順。PVViz が未定義だと my-value.js は黙ってページごと出さない
  for (const [f, up] of [['my-value.html', ''], ['en/my-value.html', '../']]) {
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

  // ⑥ 明細を出した直後の着地先が Get 側（レポート）に向いている
  for (const f of ['pay-report.html', 'en/pay-report.html']) {
    const s = read(f);
    ok(s.includes('href="my-value.html?new=1"'), `${f}: 投稿後CTAが市場価値レポートへ向く`);
    ok(!s.includes('href="profile.html#pay-tracker"'),
       `${f}: 旧CTA（記録の一覧）が残っていない`);
  }

  /* ⑦ 桁区切り（2026-08-13）。金額の欄だけ type="text" ＋ class="money" にして
     こちらで整形する。type="number" のままだとブラウザがカンマごと値を捨てる。
     ★時間・日数・％の欄に money を付けない。付けると上限の検査（min/max）が
       効かない欄が黙って増える。 */
  /* ★2026-08-26、内訳の作り直しで f-transport / f-other は画面から消えて
       <input type="hidden"> になった（明細読み取りだけが書く）。人が打つ欄は
       繰り返し行の .pd-amt に変わり、id を持たない＝下の extra には出てこない。 */
  /* ★2026-08-26 その3、教官・訓練の手当が2欄増えた（今月の支給額と単価）。
       数量（f-instr-qty）は金額ではないので money を付けない。 */
  const MONEY = ['f-gross', 'f-netpay', 'f-perdiem', 'f-bonus-mo', 'f-housing-amt',
                 'f-bonus', 'f-base', 'f-guarantee', 'f-command', 'f-profit',
                 'f-instructor', 'f-instr-rate'];
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
    ok(s.includes(`data-open="f-guarantee"><span class="p">+</span>${gLab}`),
       `${f}: ★チップ側の札も併記になっている`, gLab);

    const blk = s.slice(s.indexOf('<div id="s3-instr"'), s.indexOf('<template id="tpl-pd-var">'));
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
       `${f}: 何に対して払われるかが7択で同じ並び`, optsIn('f-instr-method').join(','));
    for (const id of ['f-instr-extra', 'f-instr-method']) {
      const b = ((blk.match(new RegExp(`<select id="${id}"[\\s\\S]*?<option value=""[^>]*>([^<]*)<`)) || [])[1] || '').trim();
      ok(/^(選んでください|Choose one)$/.test(b), `${f}: ★${id} の先頭は「選んでください」`, b);
    }

    /* ⑤ 単価・数量のラベルは option 側が持つ。JS に文言を持たせると、
       日本語版と英語版で別々にズレる（そして片方だけ直される）。 */
    const meth = (blk.match(/<select id="f-instr-method"[\s\S]*?<\/select>/) || [''])[0];
    const withData = [...meth.matchAll(/<option value="([a-z]*)"[^>]*data-rate="([^"]*)"[^>]*data-qty="([^"]*)"/g)];
    ok(withData.length === INSTR_METHOD.length + 1,
       `${f}: ★どの option も単価・数量のラベルを自分で持っている`, String(withData.length));
    ok(withData.filter((m) => m[2] && m[3]).length === INSTR_METHOD.length - 1,
       `${f}: ★月額固定だけは単価も数量も持たない（掛け算する物が無い）`);
    const sync = (s.match(/function instrSync\(\)[\s\S]*?\n}/) || [''])[0];
    ok(/dataset\.rate/.test(sync) && /dataset\.qty/.test(sync),
       `${f}: ★JS は option の data-* を読むだけ（文言を持たない）`);
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

  /* ⑧ 必須の印（2026-08-13 その4）。★これがこのファイルで一番効く検査。
     画面に出す「必須」と、送信を止めるゲートは、必ず同じ欄でなければならない。
     ズレると ①必須と書いてあるのに空でも送れる ②印が無い欄で送信が黙って止まる
     のどちらかが起き、どちらも触っている本人には原因が見えない。
     ★f-year / f-month（対象月）は select で常に値が入るためゲートに書かれていないが、
       中身は必須。ここだけ「ゲートに現れなくてよい欄」として明示的に許す。 */
  const GATE_FREE = ['f-year', 'f-month'];
  const REQ = ['f-airline', 'f-airline-other', 'f-position', 'f-fleet', 'f-jobrole', 'f-age', 'f-year',
               'f-block', 'f-stay', 'f-currency', 'f-gross', 'f-netpay', 'f-bonus-mo',
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
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;
`);
/* ★pay-report-pending.sql も入れる（2026-08-18）。ログイン前の預かりは本番の作りでは
   別テーブル＋別関数なので、これを入れないと「先に預かる」経路を本物で流せない。
   pay-reports.sql のあとに流すこと（中で submit_pay_report を呼んでいる）。 */
for (const f of ['db/airlines.generated.sql', 'db/vocab.generated.sql',
                 'db/pay-reports.sql', 'db/pay-report-pending.sql']) {
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
/* かんたん入力（内訳を開かない人）が入れる1本。★SAMPLE の内訳とは排他。 */
const GROSS_M = '54250';
const NET_M = '41200';

/* headless:'new' はこの環境で Runtime.callFunctionOn / Page.captureScreenshot が
   返らなくなる（Chrome 側の問題。args を振っても直らない）。検査内容は変えず、
   chrome-headless-shell で回す。 */
const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });

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
  const page = await browser.newPage();
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
      baseShown: box($('f-base')).height > 0,
      grossReadOnly: !!($('f-gross') || {}).readOnly
    };
  });

  const v = await shot();
  ok(v.open, `${lang}: ★#pay-detail で来たら「くわしく入れる」が開いている`, JSON.stringify(v));
  ok(v.entryHidden && v.formShown,
     `${lang}: ★入口の2択を越えて、入力の画面まで進んでいる`, JSON.stringify(v));
  ok(v.airlineShown && v.atTop,
     `${lang}: ★カーソルがフォームの先頭に入っている（内訳はまだ出ていない）`, JSON.stringify(v));
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

  const w = await shot();
  ok(w.baseShown, `${lang}: ★§3 が出てきた（内訳の欄が画面に在る）`, JSON.stringify(w));
  ok(w.open, `${lang}: ★出てきたときには、もう開いている（畳まれた状態で現れない）`, JSON.stringify(w));
  ok(errs.length === 0, `${lang}: ページのエラーが1件も出ない`, errs.join(' | '));
  await page.close();
}

for (const [lang, url] of [['ja', 'http://localhost:3000/pay-report.html'],
                           ['en', 'http://localhost:3000/en/pay-report.html']]) {
  console.log(`\n▼ ${lang}  ${url}`);
  const page = await browser.newPage();
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
  ok((await page.$eval('#f-bonus-mo', (el) => el.value)) === '0',
     '★今月の賞与・ボーナスは最初から 0 が入っている（薄い placeholder では「入れなくていい欄」に見える）');

  // ── 段階表示：埋めた分だけ下に生える ─────────────────────────
  ok(await vis('s1'), '未ログインでも S1 は見えている');
  for (const id of ['s2', 's3', 's4', 'submit-block']) {
    ok(!(await vis(id)), `読み込み直後は隠れている（#${id}）`);
  }

  const bad = [];
  bad.push(...await setF(pick('f-airline', 'f-position', 'f-fleet', 'f-jobrole')));
  ok(!(await vis('s2')),
     '★年代がまだ空なら S2 は出ない（2026-08-18 に年代も必須になった）');
  bad.push(...await setF(pick('f-age')));
  ok(await vis('s2'), '会社・職位・機材・年代を埋めると S2 が出る');
  ok(!(await vis('s3')), 'まだ S3 は出ない');

  bad.push(...await setF(pick('f-block')));
  ok(!(await vis('s3')),
     '★フライトタイムだけでは S3 は出ない（ステイ日数も必須になった）');
  bad.push(...await setF(pick('f-stay')));
  ok(await vis('s3'), 'フライトタイムとステイ日数で S3 が出る');
  ok(!(await vis('s4')), 'まだ S4 と送信ボタンは出ない');

  /* ★かんたん入力（既定）。2026-08-13 に、額面のほかに 手取り・今月出たボーナス・
     パーディアム・住居 が必須になった。1つずつ足して、揃うまで開かないことを見る。 */
  bad.push(...await setF({ 'f-currency': SAMPLE['f-currency'], 'f-gross': GROSS_M }));
  ok(!(await vis('s4')),
     '★通貨と額面だけでは S4 は出ない（手取り・今月のボーナス・パーディアム・住居が要る）');
  /* ★今月のボーナスは触らない。最初から 0 が入っているので、ここで止まらないのが正しい
     （初期値を placeholder に戻すと、この検査が落ちる）。 */
  bad.push(...await setF({ 'f-netpay': NET_M, 'f-perdiem': '6200' }));
  ok(!(await vis('s4')), '住居を答えるまでは S4 が出ない');
  bad.push(...await setF({ 'f-housing': 'allowance' }));
  ok(!(await vis('s4')), '★住居で現金を選んで額が空なら先へ進めない');
  bad.push(...await setF({ 'f-housing-amt': SAMPLE['f-housing-amt'] }));
  ok(await vis('s4'), '住宅手当の額まで入れると S4 が出る');

  /* ★送信ボタンは §4（契約と税）が埋まってから出す。
     出したまま押させると、必須が抜けたエラーを押した後で見せることになる。 */
  ok(!(await vis('submit-block')), '★契約と税が空のあいだは送信ボタンを出さない');
  bad.push(...await setF(pick('f-contract', 'f-taxcountry', 'f-seniority')));
  ok(await vis('submit-block'), '契約形態・居住国・在籍年数で送信ボタンが出る');
  ok(await vis('s1'), '一度出たものは隠れない（S1）');
  ok(await vis('f-gross'), 'かんたん入力の額面が見えている');
  ok(!(await visFold('f-base')), 'かんたん入力では基本給を見せない（内訳は畳んでいる）');
  ok(!(await page.$('#f-paytype')), '「払われ方」の欄はもう無い');
  ok((await page.$eval('#f-hourly', (el) => el.type)) === 'hidden',
     '時給は人に聞かない（hidden として残す）');

  /* ★総支給が入っているときは内訳を一切足さない（サーバの
     coalesce(p_gross_monthly, 内訳の合計) と同じ順番）。額面×12 ちょうどになること。 */
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
  /* ★2026-08-26。最初から全部を展開しない（オーナー指示）。
     基本給だけが出て、保証給・変動給・職位手当・その他の現金手当は「＋」で足す。 */
  for (const id of ['opt-f-guarantee', 'opt-pd-var', 'opt-f-command', 'opt-pd-oth']) {
    ok(await page.$eval('#' + id, (el) => el.hidden),
       `★内訳を開いただけでは出さない（＋で足す） ${id}`);
  }
  ok(await page.evaluate(() => {
       const want = ['f-guarantee', 'pd-var', 'f-command', 'pd-oth'];
       const got = [...document.querySelectorAll('.pay-detail-b .chips .chip')]
         .map((b) => b.dataset.open);
       return want.every((k) => got.includes(k));
     }), '★4つの「＋」が並んでいる（保証給・変動給・職位手当・その他の現金手当）');
  ok(await page.evaluate(() => {
       document.querySelector('.pay-detail-b .chip[data-open="f-guarantee"]').click();
       return !document.getElementById('opt-f-guarantee').hidden
              && !document.querySelector('.pay-detail-b .chip[data-open="f-guarantee"]');
     }), '★「＋保証給」を押すと欄が出て、その「＋」は消える');
  ok(await vis('gross-hint-own'), '額面の説明は入れ替わらない（いつでも本人の額面）');
  ok(!(await page.$('#gross-hint-sum')), '★「下の内訳の合計」という説明はもう無い');

  /* 内訳を入れても、額面も年換算も動かない。サーバの pv_annual_total も
     総支給があればそちらを正とする（coalesce の第1引数）ので画面と一致する。 */
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
    return document.getElementById('err').textContent;
  });
  ok(/何に連動する支給か|What it is paid on/.test(noBasis),
     '★金額だけの行を作って送ると、種類を選ぶよう止められる', noBasis.slice(0, 60));
  const withUnknown = await page.evaluate(async () => {
    document.querySelector('#pd-var-rows .pd-basis').value = 'unknown';
    const c = document.getElementById('f-contract'), keep = c.value;
    c.value = ''; c.dispatchEvent(new Event('change', { bubbles: true }));
    await submitPayReport();
    const seen = document.getElementById('err').textContent;
    c.value = keep; c.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('err').innerHTML = '';
    return seen;
  });
  ok(!/何に連動する支給か|What it is paid on/.test(withUnknown)
     && /契約形態|contract type/.test(withUnknown),
     '★「わからない」を選ぶと種類では止まらない（次の必須へ進む）', withUnknown.slice(0, 60));
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
  ok(await vis('submit-block'), '止めた後も送信ボタンは出たまま（契約を戻せば元どおり）');
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
  ok(await vis('submit-block'), '注意が出ても送信は止めない（一致は強制しない）');
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
       ③ 単価・数量が分からなくても、金額だけで保存できる
       ④ 総支給・年換算・変動給・その他の合計が1つも動かない
          （＝オーナー指示「二重入力させない」「総支給を書き換えない」の実体） */
  const instrState = () => page.evaluate(() => ({
    shown: document.getElementById('s3-instr').offsetParent !== null,
    pay: document.getElementById('opt-instr-pay').hidden,
    unit: document.getElementById('instr-unit').hidden,
    rateLab: document.getElementById('lab-instr-rate').textContent,
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
    return { rate: o.dataset.rate, qty: o.dataset.qty };
  });
  ok(!iSes.pay && !iSes.unit, '★「別途支給されている」を選ぶと、金額と単価の欄が出る');
  ok(iSes.rateLab === wantLab.rate && iSes.qtyLab === wantLab.qty,
     '★単価・数量のラベルは選んだ支給方法から来る',
     `${iSes.rateLab} / ${iSes.qtyLab}`);
  await setF({ 'f-instr-method': 'monthly' });
  await new Promise((r) => setTimeout(r, 150));
  ok((await instrState()).unit,
     '★月額で固定なら単価・数量は聞かない（掛け算する物が無い）');
  await setF({ 'f-instr-method': 'session' });

  /* ③ 単価も回数も空のまま、金額だけで保存できる。 */
  const before = await instrState();
  await setF({ 'f-instructor': '600' });
  await new Promise((r) => setTimeout(r, 200));
  const iAmt = await instrState();
  ok(iAmt.items && iAmt.items.instructor && iAmt.items.instructor.amount === 600
     && iAmt.items.instructor.rate === null && iAmt.items.instructor.qty === null,
     '★単価・回数が分からなくても、金額だけで残る',
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
     '★担当している訓練・呼び名・支給方法がそのまま乗る',
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
  const pendBefore = (await db.query(`select count(*)::int n from pay_reports_pending`)).rows[0].n;
  await page.click('#submit-btn');
  await new Promise((r) => setTimeout(r, 400));
  ok(await vis('login-gate'), '未ログインで送信するとログインを求める');
  ok(stash.length === 1, `★ログイン前の1押しでサーバへ預ける → ${stash.length} 回`);
  ok(seen.length === 0, `★ログイン前に本棚へは1行も入れない → ${seen.length} 回`);
  ok(await page.evaluate(() => {
    try { return (JSON.parse(localStorage.getItem('pv_pay_claim') || '[]')).length === 1; }
    catch (e) { return false; }
  }), '預かり証を端末に持っている（あとで本人のものへ移すため）');
  const stashed = (await db.query(
    `select count(*)::int n from pay_reports_pending where claimed_at is null`)).rows[0].n - pendBefore;
  ok(stashed === 1, `置き場に1件だけ寝る → ${stashed} 件`);
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
  await page.evaluate((uid) => {
    _sb.auth.getSession = async () => ({ data: { session: { user: { id: uid } } } });
  }, UID);
  await page.click('#submit-btn');
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
  const KEYS_BEFORE = [   // 手入力で埋まる33キー。1つでも欠けたら静かに壊れる
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
    'instructor_pay'];
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
     ★プリセットは対象月と飛んだ時間を保存しない（毎月変わる値だから）。以前は
       「下の段が満たされていれば間も開く」にしていたので、§2 の飛んだ時間が
       空のまま §3・§4 が開き、段階表示が効いていないように見えた
       （2026-08-13 オーナー指摘）。今は満たせない段で止める。
     ★入力する数は変わらない。飛んだ時間を入れた瞬間に、前回の金額が入った
       §3・§4 がまとめて出る。 */
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 900));
  /* ★入口の2択は2回目以降も毎回出す（2026-08-13 オーナー決定）。
     前回の内容がこの端末に残っている人には、そのことを「手で入力」側に添える。 */
  ok(await vis('entry'), '2回目の訪問でも入口の2択から始まる');
  ok(await vis('entry-prev'), '★前回の内容が残っていることを「手で入力」側に書く');
  await page.click('#entry-manual');
  await new Promise((r) => setTimeout(r, 250));
  for (const id of ['s1', 's2']) {
    ok(await vis(id), `2回目の訪問では §1・§2 が最初から開いている（#${id}）`);
  }
  for (const id of ['s3', 's4', 'submit-block']) {
    ok(!(await vis(id)), `★飛んだ時間が空なら先は出さない（#${id}）`);
  }
  ok(await page.$eval('#restore-bar', (el) => el.offsetParent !== null), '復元したことを知らせている');

  bad.push(...await setF(pick('f-block', 'f-stay')));
  await new Promise((r) => setTimeout(r, 150));
  ok(await vis('s3'), '飛んだ時間とステイ日数を入れると §3 が出る');
  /* ★手取りと今月出たボーナスは「その月にしか無い値」なのでプリセットに入れない。
     入れると、先月の手取りが今月の実データとして黙って送られる。 */
  ok(!(await vis('s4')), '★手取りと今月のボーナスは前回の値で埋めない（毎月変わる）');
  bad.push(...await setF(pick('f-netpay', 'f-bonus-mo')));
  await new Promise((r) => setTimeout(r, 150));
  for (const id of ['s4', 'submit-block']) {
    ok(await vis(id), `その2つを入れると先がまとめて出る（#${id}）`);
  }
  // 復元が生きていること（段だけ出て金額が空なら「30秒で終わる」が嘘になる）
  ok((await fv('f-base')) === SAMPLE['f-base'],
     `前回の基本給が入ったまま出てくる → ${await fv('f-base')}`, `期待 ${SAMPLE['f-base']}`);
  ok((await fv('f-currency')) === SAMPLE['f-currency'],
     `前回の通貨が入ったまま出てくる → ${await fv('f-currency')}`);
  /* ★2026-08-26、額面も普通にプリセットへ入る。内訳の合計を映していた欄ではなく、
     いつでも本人が手で入れた数字になったため。 */
  ok(await page.$eval('#pay-detail', (el) => el.open),
     '内訳で入れた人は内訳側が開いた状態で戻る');
  ok((await fv('f-gross')) === GROSS_M,
     `前回の額面も入ったまま出てくる → ${await fv('f-gross')}`, `期待 ${GROSS_M}`);
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

  const page = await browser.newPage();
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
    const page = await browser.newPage();
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
    await page.goto('http://localhost:3000/my-value.html',
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
  const page = await browser.newPage();
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

await browser.close();
await db.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
