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
  const MONEY = ['f-gross', 'f-netpay', 'f-perdiem', 'f-bonus-mo', 'f-housing-amt',
                 'f-bonus', 'f-base', 'f-command', 'f-transport', 'f-other', 'f-profit'];
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

  /* ⑧ 必須の印（2026-08-13 その4）。★これがこのファイルで一番効く検査。
     画面に出す「必須」と、送信を止めるゲートは、必ず同じ欄でなければならない。
     ズレると ①必須と書いてあるのに空でも送れる ②印が無い欄で送信が黙って止まる
     のどちらかが起き、どちらも触っている本人には原因が見えない。
     ★f-year / f-month（対象月）は select で常に値が入るためゲートに書かれていないが、
       中身は必須。ここだけ「ゲートに現れなくてよい欄」として明示的に許す。 */
  const GATE_FREE = ['f-year', 'f-month'];
  const REQ = ['f-airline', 'f-airline-other', 'f-position', 'f-fleet', 'f-jobrole', 'f-age', 'f-year',
               'f-block', 'f-stay', 'f-currency', 'f-gross', 'f-netpay', 'f-bonus-mo',
               'f-perdiem', 'f-housing', 'f-housing-amt', 'f-base',
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

  /* ── 総支給と内訳は排他。ただし額面の欄は消さない ─────────────
     両方入った行は「年収は総額から・支給構成は内訳から」という食い違った行になる。
     ★2026-08-13 オーナー指摘＝「ボーナスの前に額面を聞く欄が無い」。原因は、
       くわしく入れるを開くと欄そのものを隠していたこと。今は欄は残り、
       開いているあいだは下の内訳の合計を映す読み取り専用になる。
       送るのは片方だけ（gross_monthly は open のとき null）。 */
  const toggleDetail = (open) => page.evaluate((o) => {
    const d = document.getElementById('pay-detail');
    d.open = o;
    d.dispatchEvent(new Event('toggle'));
  }, open);
  await toggleDetail(true);
  await new Promise((r) => setTimeout(r, 150));
  ok(await vis('f-gross'), '★内訳を開いても額面の欄は残る（隠さない）');
  ok(await page.$eval('#f-gross', (el) => el.readOnly),
     '内訳を開くと額面は読み取り専用になる（内訳の合計だから）');
  ok(!(await page.$eval('#f-gross', (el) => el.disabled)),
     '読み取り専用でも disabled にしない（薄くなって一番大事な数字が読めなくなる）');
  ok(await visFold('f-base'), '内訳を開くと基本給が出る');
  ok((await vis('gross-hint-sum')) && !(await vis('gross-hint-own')),
     '額面の説明が「下の内訳の合計」に入れ替わる');

  /* 額面の欄が映すのは monthlyDetail() の合計。画面の額面と年換算が
     別々の式で出ていたら、ここで食い違いとして出る。 */
  /* 30000（基本給）＋5000（パーディアム）＋17500（住宅手当）＝ 52500。
     ★パーディアムと住宅手当は 2026-08-13 に内訳の外へ出たが、合計の式には
       今までどおり入る（サーバの pv_annual_total も同じ順で足している）。 */
  bad.push(...await setF({ 'f-base': '30000', 'f-perdiem': '5000' }));
  const mirror = await page.evaluate(() => ({
    shown: document.getElementById('f-gross').value, sum: monthlyDetail(),
  }));
  ok(Number(mirror.shown.replace(/,/g, '')) === mirror.sum && mirror.sum === 52500,
     `額面の欄が内訳の合計を映す → ${mirror.shown}`, `合計は ${mirror.sum}（期待 52500）`);

  /* ★手当だけの行を段のゲートに通さない。開いているあいだ額面の欄には合計が
     映るので、そこを見てしまうとパーディアムだけで先に進めてしまい、
     送信でサーバに弾かれる（＝入力を全部終えてから断られる）。 */
  const allowanceOnly = await page.evaluate(() => {
    const b = document.getElementById('f-base'), h = document.getElementById('f-hourly');
    const kb = b.value, kh = h.value;
    b.value = ''; h.value = '';
    const r = payEntered();
    b.value = kb; h.value = kh;
    return r;
  });
  ok(allowanceOnly === false,
     '★手当だけ（基本給も時給も空）は報酬が入ったと見なさない');

  await toggleDetail(false);
  await new Promise((r) => setTimeout(r, 150));
  ok((await fv('f-gross')) === GROSS_M,
     `内訳を閉じると手で入れた額面が戻る → ${await fv('f-gross')}`, `期待 ${GROSS_M}`);
  ok(!(await page.$eval('#f-gross', (el) => el.readOnly)),
     '閉じると額面は自分で入れられる');
  ok((await fv('f-base')) === '',
     '内訳を閉じると内訳の値は消える（画面に無い数字を送らない）');
  /* ★逆に、内訳の外へ出た欄は閉じても消えないこと。消すと、開閉しただけで
     必須が空に戻り、§4 と送信ボタンが出たまま送れない状態になる。 */
  ok((await fv('f-perdiem')) === '5000' && (await fv('f-housing-amt')) === SAMPLE['f-housing-amt']
     && (await fv('f-netpay')) === NET_M,
     '★閉じてもパーディアム・住宅手当・手取りは残る',
     `${await fv('f-perdiem')} / ${await fv('f-housing-amt')} / ${await fv('f-netpay')}`);
  const backToGross = await page.evaluate(() => annualTotal());
  ok(backToGross === Number(GROSS_M) * 12,
     `閉じたあとの年換算は額面×12 に戻る → ${backToGross}`, `期待 ${Number(GROSS_M) * 12}`);

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
  const KEYS_BEFORE = [   // 手入力で埋まる30キー。1つでも欠けたら静かに壊れる
    'airline', 'airline_other', 'position', 'fleet', 'job_role', 'base_iata',
    'period_year', 'period_month', 'currency', 'base_pay', 'hourly_rate',
    'guaranteed_hours', 'block_hours', 'duty_days', 'per_diem', 'housing_type',
    'housing_amount', 'transport', 'command_pay', 'other_allowance',
    'bonus_annual', 'profit_share_annual', 'pension_pct', 'contract_type',
    'tax_country', 'tax_rate_pct', 'seniority_years', 'lang',
    /* 2026-08-12 追加。かんたん入力の「その月の額面（総支給）」。
       ★内訳とは排他。base_pay へ入れると支給構成が「基本給100%」の嘘の図になる。 */
    'gross_monthly',
    /* 2026-08-13 追加。手取りと勤務時間は明細専用の隠し欄から普通の欄へ出た
       （手取りは必須・勤務時間は任意）。ステイ日数と今月出たボーナスは新設。 */
    'net_pay_actual', 'duty_hours', 'stay_nights', 'bonus_month',
    /* 2026-08-18 追加。年代（10歳の幅）。年収は年齢とともに上がるので、
       これが無いと「同じ会社の機長」同士が実は入社3年目と定年間際の比較になる。 */
    'age_bucket'];
  const KEYS_PAYSLIP = [  // 明細から読めたぶん。手入力では埋まらない
    'ytd_taxable', 'flight_variable_pay', 'deduction_total',
    'night_hours', 'credit_hours',
    /* 2026-08-14 追加。読めた手当を1行ずつそのまま溜める列。画面には出さない。
       ★source より前に置く（下の wrongZero が「手入力では null」の側を
         KEYS_PAYSLIP.slice(0, 6) で数えているため）。 */
    'payslip_detail',
    'source'];

  const missing = KEYS_BEFORE.concat(KEYS_PAYSLIP).filter((k) => !(k in p));
  ok(missing.length === 0, `payload が41キーを全部送っている`, missing.join(','));
  const extra = Object.keys(p).filter((k) => !KEYS_BEFORE.includes(k) && !KEYS_PAYSLIP.includes(k));
  ok(extra.length === 0, `知らないキーが増えていない`, extra.join(','));

  /* ★この画面は手入力。明細は1枚も出していない。
     ・5列は null であること（0 を送ると「深夜0時間・控除0円」という嘘の実データになる）
     ・source は 'web' であること（'payslip' と申告されると出所の意味が消える） */
  const wrongZero = KEYS_PAYSLIP.slice(0, 6).filter((k) => p[k] !== null && p[k] !== undefined);
  ok(wrongZero.length === 0, `★手入力では明細由来の6列を送らない（0 で埋めない）`,
     wrongZero.map((k) => `${k}=${p[k]}`).join(','));
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
  /* ★内訳で入れた行に総支給が残っていないこと。残ると pv_annual_total が
     総支給を優先して、画面が出した年収と DB の年収が食い違う。
     欄を隠すのをやめた（額面が内訳の合計を映すようになった）ので、
     ページが送らないこと自体を payload でも縛る。 */
  ok(p.gross_monthly === null,
     `★内訳を開いているときは総支給を送らない → ${JSON.stringify(p.gross_monthly)}`);
  ok(r.gross_monthly === null, `内訳で入れた行に総支給は入らない → ${r.gross_monthly}`);
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
  /* ★内訳を開いていた人の額面は保存しない（内訳の合計を映しただけの値で、
     手で入れた額面ではない）。残ると翌月「額面と内訳の両方が入った行」になる。 */
  ok(await page.$eval('#pay-detail', (el) => el.open),
     '内訳で入れた人は内訳側が開いた状態で戻る');
  ok(await page.$eval('#f-gross', (el) => el.readOnly),
     '戻ってきた額面は読み取り専用（合計を映しているだけ）');

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
